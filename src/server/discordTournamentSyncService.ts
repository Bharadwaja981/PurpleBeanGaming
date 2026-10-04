/**
 * Purple Bean Gaming — Server-Side Discord Tournament Role Synchronization Service
 * 
 * Centralized, authoritative Discord role management:
 * - PBG database state is the single source of truth; Discord is a projection.
 * - Compares desired role state vs actual Discord roles.
 * - Idempotently applies differences using PBG Discord Bot.
 * - Never rolls back or corrupts PBG state if Discord API has an outage (creates retryable discordSyncJobs).
 * - Implements persistent PBG Member protection, temporary Tournament Player/Captain roles,
 *   and dynamic Team roles with elimination and tournament-completion cleanups.
 */

import { getAdminDb } from './firebaseAdmin';
import {
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig,
  DiscordSyncJobRecord
} from '../domain/tournamentRegistrationEngine';
import {
  getDesiredTournamentDiscordRoles,
  buildDiscordRoleReconciliationPlan,
  DiscordSyncContext,
  DesiredDiscordRolesResult
} from '../domain/discordTournamentRoleEngine';
import { getPrivateDiscordAccount } from './discordVerificationService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';

// In-memory fallback caches for local development and test environments
export const inMemoryTournamentDiscordConfigs = new Map<string, TournamentDiscordConfig>();
export const inMemoryParticipants = new Map<string, Map<string, TournamentParticipantRecord>>(); // tourneyId -> (userId -> participant)
export const inMemoryTournamentTeams = new Map<string, Map<string, TournamentTeamRecord>>(); // tourneyId -> (teamId -> team)
export const inMemorySyncJobs = new Map<string, DiscordSyncJobRecord>();

export interface DiscordSyncResult {
  success: boolean;
  userId: string;
  tournamentId: string;
  discordUserId?: string;
  rolesAdded: string[];
  rolesRemoved: string[];
  jobId?: string;
  error?: string;
  reconciliationRequired?: boolean;
  skipped?: boolean;
  reason?: string;
}

/**
 * Helper to get the official bot token and guild ID
 */
function getBotConfig(customConfig?: TournamentDiscordConfig) {
  const botToken = process.env.DISCORD_BOT_TOKEN || '';
  const guildId = customConfig?.guildId || process.env.DISCORD_GUILD_ID || '631715510631006219';
  const pbgMemberRoleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';
  return { botToken, guildId, pbgMemberRoleId };
}

/**
 * Fetches actual Discord roles currently assigned to a member in the guild.
 */
export async function fetchActualMemberDiscordRoles(params: {
  guildId: string;
  discordUserId: string;
  botToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ ok: boolean; roles: string[]; error?: string }> {
  const { guildId, discordUserId, botToken, fetchFn = fetch } = params;

  if (!botToken) {
    // If no bot token is configured in local dev/test, return default empty
    return { ok: true, roles: [] };
  }

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
    const res = await fetchFn(url, {
      method: 'GET',
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        return { ok: false, roles: [], error: 'MEMBER_NOT_IN_GUILD' };
      }
      return { ok: false, roles: [], error: `HTTP_${res.status}` };
    }

    const data = await res.json();
    const roles: string[] = Array.isArray(data?.roles) ? data.roles : [];
    return { ok: true, roles };
  } catch (err: any) {
    return { ok: false, roles: [], error: err.message };
  }
}

/**
 * Assigns a single Discord role to a guild member.
 */
export async function assignGuildMemberRole(params: {
  guildId: string;
  discordUserId: string;
  roleId: string;
  botToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; error?: string }> {
  const { guildId, discordUserId, roleId, botToken, fetchFn = fetch } = params;

  if (!botToken) return { success: true };

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });

    if (res.status === 204 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Removes a single Discord role from a guild member.
 */
export async function removeGuildMemberRole(params: {
  guildId: string;
  discordUserId: string;
  roleId: string;
  botToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; error?: string }> {
  const { guildId, discordUserId, roleId, botToken, fetchFn = fetch } = params;

  if (!botToken) return { success: true };

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });

    if (res.status === 204 || res.status === 404 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates a dynamic Discord team role (e.g. "Mumbai Mavericks").
 */
export async function createDiscordTeamRoleAuthoritative(params: {
  guildId: string;
  teamName: string;
  botToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; roleId?: string; error?: string }> {
  const { guildId, teamName, botToken, fetchFn = fetch } = params;

  if (!botToken) {
    const mockRoleId = `mock_role_${Date.now()}`;
    return { success: true, roleId: mockRoleId };
  }

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: teamName,
        color: 0x5CE1E6, // Purple Bean Cyan accent
        hoist: false,
        mentionable: true
      })
    });

    if (!res.ok) {
      return { success: false, error: `HTTP_${res.status}` };
    }

    const data = await res.json();
    return { success: true, roleId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a dynamic Discord team role upon tournament completion.
 */
export async function deleteDiscordTeamRoleAuthoritative(params: {
  guildId: string;
  roleId: string;
  botToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ success: boolean; error?: string }> {
  const { guildId, roleId, botToken, fetchFn = fetch } = params;

  if (!botToken || !roleId) return { success: true };

  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });

    if (res.status === 204 || res.status === 404 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Records or updates a Discord synchronization job in Firestore/memory.
 */
export async function recordDiscordSyncJob(job: DiscordSyncJobRecord): Promise<void> {
  inMemorySyncJobs.set(job.id, job);

  try {
    const db = getAdminDb();
    if (db) {
      await db.collection('discordSyncJobs').doc(job.id).set(job, { merge: true });
    }
  } catch {
    // Memory fallback
  }
}

/**
 * -------------------------------------------------------------
 * CENTRALIZED DISCORD TOURNAMENT ROLE SYNCHRONIZATION SERVICE
 * -------------------------------------------------------------
 * 
 * Authoritative pipeline:
 * PBG tournament state -> desired roles -> reconciliation plan -> PBG Bot -> actual Discord roles
 */
export async function syncDiscordTournamentRoles(params: {
  userId: string;
  tournamentId: string;
  overrideContext?: Partial<DiscordSyncContext>;
  fetchFn?: typeof fetch;
}): Promise<DiscordSyncResult> {
  const { userId, tournamentId, overrideContext, fetchFn = fetch } = params;

  // 1. Resolve Tournament State & Discord Configuration
  let tournamentData: any = overrideContext?.tournament || null;
  let participantData: TournamentParticipantRecord | null = overrideContext?.participant || null;
  let teamData: TournamentTeamRecord | null = overrideContext?.team || null;
  let discordConfig: TournamentDiscordConfig | undefined = overrideContext?.tournament?.discordConfig;

  // Check in-memory maps or Firestore for participant and tournament
  if (!participantData) {
    const tourneyParticipants = inMemoryParticipants.get(tournamentId);
    participantData = tourneyParticipants?.get(userId) || null;
  }
  if (!discordConfig) {
    discordConfig = inMemoryTournamentDiscordConfigs.get(tournamentId);
  }

  // Fallback to Firestore if live DB is accessible
  try {
    const db = getAdminDb();
    if (db) {
      if (!participantData) {
        const pSnap = await db.collection(`tournaments/${tournamentId}/participants`).doc(userId).get();
        if (pSnap.exists) {
          participantData = pSnap.data() as TournamentParticipantRecord;
        }
      }
      if (!discordConfig) {
        const cSnap = await db.collection(`tournaments/${tournamentId}/discordConfig`).doc('config').get();
        if (cSnap.exists) {
          discordConfig = cSnap.data() as TournamentDiscordConfig;
        }
      }
      if (participantData?.teamId && !teamData) {
        const tSnap = await db.collection(`tournaments/${tournamentId}/teams`).doc(participantData.teamId).get();
        if (tSnap.exists) {
          teamData = tSnap.data() as TournamentTeamRecord;
        }
      }
    }
  } catch {
    // In-memory fallback
  }

  // 2. Resolve User's Discord Account Linkage
  let discordLink = overrideContext?.discordLink;
  if (!discordLink) {
    const privateDiscord = await getPrivateDiscordAccount(userId);
    const pbgAcc = !privateDiscord?.discordUserId ? (pbgAccountRegistry.getAccountByUid(userId) || pbgAccountRegistry.getAccountByPbgId(userId)) : null;

    const discordUserId = privateDiscord?.discordUserId || pbgAcc?.discordUserId || undefined;
    const discordLinked = Boolean((privateDiscord?.discordLinked && privateDiscord?.discordUserId) || (pbgAcc?.discordLinked && pbgAcc?.discordUserId));
    const pbgMemberRoleActive = Boolean(privateDiscord?.discord?.pbgMemberRole ?? (privateDiscord as any)?.pbgMemberRole ?? pbgAcc?.discordMemberVerified ?? true);

    discordLink = {
      discordUserId,
      discordLinked,
      pbgMemberRoleActive
    };
  }

  const { botToken, guildId, pbgMemberRoleId } = getBotConfig(discordConfig);

  const context: DiscordSyncContext = {
    tournament: {
      id: tournamentId,
      status: tournamentData?.status || 'REGISTRATION_OPEN',
      discordConfig: discordConfig || {
        enabled: true,
        guildId,
        roles: {
          tournamentPlayerRoleId: 'role_tourney_player_default',
          captainRoleId: 'role_captain_default'
        },
        teamRolesEnabled: true,
        cleanupPolicy: { onElimination: true, onTournamentCompletion: true }
      }
    },
    participant: participantData,
    team: teamData,
    discordLink,
    pbgMemberRoleId
  };

  // Skip explicit test identities cleanly without error
  const isTestIdentity = Boolean(
    participantData?.isTestAccount ||
    participantData?.source === 'TEST_SEED' ||
    userId.startsWith('pbg-test-') ||
    userId.startsWith('dummy-')
  );

  if (isTestIdentity) {
    return {
      success: true,
      userId,
      tournamentId,
      rolesAdded: [],
      rolesRemoved: [],
      skipped: true,
      reason: 'SKIPPED_TEST_IDENTITY',
      reconciliationRequired: false
    };
  }

  // 3. Compute Pure Desired Role State
  const desiredResult = getDesiredTournamentDiscordRoles(context);

  if (!desiredResult.discordUserId) {
    return {
      success: false,
      userId,
      tournamentId,
      rolesAdded: [],
      rolesRemoved: [],
      error: 'DISCORD_NOT_LINKED: User has not connected Discord.',
      reconciliationRequired: true
    };
  }

  const discordUserId = desiredResult.discordUserId;

  // 4. Fetch Actual Discord Member Roles from Bot
  const actualRes = await fetchActualMemberDiscordRoles({
    guildId,
    discordUserId,
    botToken,
    fetchFn
  });

  if (!actualRes.ok) {
    // Bot API is temporarily unreachable: create or update a retryable sync job without failing PBG state!
    const jobId = `sync_${tournamentId}_${userId}`;
    const existingJob = inMemorySyncJobs.get(jobId);
    const job: DiscordSyncJobRecord = {
      id: jobId,
      type: 'SYNC_TOURNAMENT_ROLES',
      tournamentId,
      userId,
      status: 'PENDING',
      attempts: (existingJob?.attempts || 0) + 1,
      lastError: actualRes.error || 'DISCORD_API_UNAVAILABLE',
      createdAt: existingJob?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await recordDiscordSyncJob(job);

    return {
      success: false,
      userId,
      tournamentId,
      discordUserId,
      rolesAdded: [],
      rolesRemoved: [],
      jobId,
      error: `DISCORD_API_RETRY_QUEUED: ${actualRes.error}`
    };
  }

  // 5. Build and Execute Reconciliation Plan
  // Collect all PBG-managed role IDs to avoid tampering with unrelated server roles
  const managedRoleIds = [
    pbgMemberRoleId,
    context.tournament.discordConfig?.roles.tournamentPlayerRoleId,
    context.tournament.discordConfig?.roles.captainRoleId,
    teamData?.discord?.roleId
  ].filter(Boolean) as string[];

  const plan = buildDiscordRoleReconciliationPlan({
    guildId,
    discordUserId,
    actualDiscordRoles: actualRes.roles,
    desiredResult,
    managedRoleIds,
    pbgMemberRoleId
  });

  const rolesAdded: string[] = [];
  const rolesRemoved: string[] = [];

  // Apply Additions
  for (const roleId of plan.rolesToAdd) {
    const addRes = await assignGuildMemberRole({
      guildId,
      discordUserId,
      roleId,
      botToken,
      fetchFn
    });
    if (addRes.success) {
      rolesAdded.push(roleId);
    }
  }

  // Apply Removals
  for (const roleId of plan.rolesToRemove) {
    const remRes = await removeGuildMemberRole({
      guildId,
      discordUserId,
      roleId,
      botToken,
      fetchFn
    });
    if (remRes.success) {
      rolesRemoved.push(roleId);
    }
  }

  const hasFailures = plan.rolesToAdd.length > rolesAdded.length || plan.rolesToRemove.length > rolesRemoved.length;
  let jobId: string | undefined;

  if (hasFailures) {
    jobId = `sync_${tournamentId}_${userId}`;
    const existingJob = inMemorySyncJobs.get(jobId);
    const job: DiscordSyncJobRecord = {
      id: jobId,
      type: 'SYNC_TOURNAMENT_ROLES',
      tournamentId,
      userId,
      status: 'PENDING',
      attempts: (existingJob?.attempts || 0) + 1,
      lastError: 'PARTIAL_ROLE_SYNC_FAILURE',
      createdAt: existingJob?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await recordDiscordSyncJob(job);
  } else {
    // If completed without failure, resolve any existing pending job
    const existingJob = inMemorySyncJobs.get(`sync_${tournamentId}_${userId}`);
    if (existingJob) {
      existingJob.status = 'SUCCESS';
      existingJob.updatedAt = new Date().toISOString();
      await recordDiscordSyncJob(existingJob);
    }
  }

  return {
    success: !hasFailures,
    userId,
    tournamentId,
    discordUserId,
    rolesAdded,
    rolesRemoved,
    jobId,
    error: hasFailures ? 'PARTIAL_ROLE_SYNC_FAILURE' : undefined,
    reconciliationRequired: desiredResult.reconciliationRequired
  };
}

/**
 * -------------------------------------------------------------
 * TEAM ELIMINATION CLEANUP
 * -------------------------------------------------------------
 * When a team is eliminated, removes Tournament Player, Captain, and Team Role
 * from all active members, while strictly preserving PBG Member.
 */
export async function cleanupEliminatedTeamDiscordRoles(params: {
  tournamentId: string;
  team: TournamentTeamRecord;
  participants: TournamentParticipantRecord[];
  fetchFn?: typeof fetch;
}): Promise<{ teamId: string; processedUsers: number; errors: string[] }> {
  const { tournamentId, team, participants, fetchFn = fetch } = params;
  const errors: string[] = [];
  let processed = 0;

  for (const memberUserId of team.roster) {
    const participant = participants.find(p => p.userId === memberUserId);
    if (!participant) continue;

    // Force team status to ELIMINATED in context
    const syncRes = await syncDiscordTournamentRoles({
      userId: memberUserId,
      tournamentId,
      overrideContext: {
        team: { ...team, status: 'ELIMINATED' },
        participant: { ...participant, eliminated: true }
      },
      fetchFn
    });

    if (syncRes.success) {
      processed++;
    } else if (syncRes.error) {
      errors.push(`${memberUserId}: ${syncRes.error}`);
    }
  }

  return {
    teamId: team.id,
    processedUsers: processed,
    errors
  };
}

/**
 * -------------------------------------------------------------
 * TOURNAMENT COMPLETION CLEANUP
 * -------------------------------------------------------------
 * When a tournament is completed, removes all temporary tournament and team roles
 * for every participant, preserves PBG Member, and archives/deletes dynamic team roles.
 */
export async function cleanupTournamentCompletionDiscordRoles(params: {
  tournamentId: string;
  teams: TournamentTeamRecord[];
  participants: TournamentParticipantRecord[];
  discordConfig?: TournamentDiscordConfig;
  fetchFn?: typeof fetch;
}): Promise<{ totalParticipantsCleaned: number; deletedTeamRoles: number }> {
  const { tournamentId, teams, participants, discordConfig, fetchFn = fetch } = params;
  let cleanedCount = 0;
  let deletedRolesCount = 0;

  const { botToken, guildId } = getBotConfig(discordConfig);

  // 1. Strip temporary roles for every participant
  for (const participant of participants) {
    const syncRes = await syncDiscordTournamentRoles({
      userId: participant.userId,
      tournamentId,
      overrideContext: {
        tournament: { id: tournamentId, status: 'COMPLETED', discordConfig }
      },
      fetchFn
    });
    if (syncRes.success || syncRes.error?.includes('DISCORD_NOT_LINKED')) {
      cleanedCount++;
    }
  }

  // 2. Delete dynamic team roles created for this tournament
  for (const team of teams) {
    if (team.discord?.roleId) {
      const delRes = await deleteDiscordTeamRoleAuthoritative({
        guildId,
        roleId: team.discord.roleId,
        botToken,
        fetchFn
      });
      if (delRes.success) {
        deletedRolesCount++;
        // Idempotency: clear roleId after deletion so repeated cleanups don't duplicate calls
        team.discord = undefined;
      }
    }
  }

  return {
    totalParticipantsCleaned: cleanedCount,
    deletedTeamRoles: deletedRolesCount
  };
}

/**
 * -------------------------------------------------------------
 * RETRY PENDING DISCORD SYNC JOBS
 * -------------------------------------------------------------
 * Safely replays pending or failed sync jobs. Idempotent and resilient.
 */
export async function retryPendingDiscordSyncJobs(params?: {
  tournamentId?: string;
  fetchFn?: typeof fetch;
}): Promise<{ totalRetried: number; succeeded: number; failed: number; jobs: DiscordSyncJobRecord[] }> {
  const { tournamentId, fetchFn } = params || {};
  let totalRetried = 0;
  let succeeded = 0;
  let failed = 0;
  const processedJobs: DiscordSyncJobRecord[] = [];

  for (const job of Array.from(inMemorySyncJobs.values())) {
    if (job.status === 'PENDING' && (!tournamentId || job.tournamentId === tournamentId)) {
      totalRetried++;
      if (job.userId) {
        const syncRes = await syncDiscordTournamentRoles({
          userId: job.userId,
          tournamentId: job.tournamentId,
          fetchFn
        });
        if (syncRes.success) {
          succeeded++;
          job.status = 'SUCCESS';
          job.lastError = undefined;
        } else {
          failed++;
          job.attempts++;
          job.lastError = syncRes.error;
        }
        job.updatedAt = new Date().toISOString();
        await recordDiscordSyncJob(job);
        processedJobs.push(job);
      }
    }
  }

  return { totalRetried, succeeded, failed, jobs: processedJobs };
}
