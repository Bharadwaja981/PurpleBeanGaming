/**
 * Purple Bean Gaming — Server-Side Discord Tournament Role Synchronization Service
 * 
 * Centralized, authoritative Discord role management:
 * - PBG database state is the single source of truth; Discord is a projection.
 * - Compares desired role state vs actual Discord roles.
 * - Idempotently applies differences using PBG Discord Bot.
 * - Never rolls back or corrupts PBG state if Discord API has an outage (creates retryable discordSyncJobs).
 * - Implements persistent PBG Member protection (DISCORD_PBG_MEMBER_ROLE_ID),
 *   temporary PBG Player (DISCORD_PBG_PLAYER_ROLE_ID) and PBG Captain (DISCORD_PBG_CAPTAIN_ROLE_ID) roles,
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
import {
  classifyTournamentLifecycle,
  shouldTournamentGrantTemporaryDiscordRoles,
  getUserTournamentRoleEntitlementsFromContexts,
  getDesiredGlobalDiscordRolesForUser,
  type TournamentLifecycleContext,
  type TournamentDiscordCleanupReport,
  type UserTournamentRoleEntitlements
} from '../domain/tournamentLifecycleEngine';
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
  const pbgPlayerRoleId = customConfig?.roles?.tournamentPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || '1555884061111746651';
  const pbgCaptainRoleId = customConfig?.roles?.captainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || '1556338549807259658';
  return { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId };
}

/**
 * Loads all tournament lifecycle contexts across Firestore and in-memory caches.
 */
export async function getAllTournamentLifecycleContexts(): Promise<TournamentLifecycleContext[]> {
  const db = getAdminDb();
  const contextMap = new Map<string, TournamentLifecycleContext>();

  // 1. Load from Firestore
  if (db) {
    try {
      const snap = await db.collection('tournaments').limit(50).get();
      await Promise.all(
        snap.docs.map(async (doc) => {
          const data = doc.data();
          let participants: TournamentParticipantRecord[] = Array.isArray(data.participants) ? data.participants : [];
          let teams: TournamentTeamRecord[] = Array.isArray(data.teams) ? data.teams : [];

          if (participants.length === 0 || teams.length === 0) {
            try {
              const [pSnap, tSnap] = await Promise.all([
                participants.length === 0 ? db.collection(`tournaments/${doc.id}/participants`).get().catch(() => null) : null,
                teams.length === 0 ? db.collection(`tournaments/${doc.id}/teams`).get().catch(() => null) : null
              ]);
              if (pSnap && !pSnap.empty) {
                participants = pSnap.docs.map(d => d.data() as TournamentParticipantRecord);
              }
              if (tSnap && !tSnap.empty) {
                teams = tSnap.docs.map(d => d.data() as TournamentTeamRecord);
              }
            } catch {}
          }

          contextMap.set(doc.id, {
            id: doc.id,
            name: data.name || data.title || doc.id,
            status: data.status,
            lifecycle: data.lifecycle,
            deleted: data.deleted === true,
            discordConfig: data.discordConfig,
            participants,
            teams
          });
        })
      );
    } catch (e) {
      console.warn('[getAllTournamentLifecycleContexts] Firestore query warning:', e);
    }
  }

  // 2. Merge in-memory participants and teams
  for (const [tourneyId, pMap] of inMemoryParticipants.entries()) {
    const existing = contextMap.get(tourneyId) || {
      id: tourneyId,
      name: tourneyId,
      status: 'active',
      lifecycle: 'ACTIVE_LIKE',
      participants: [],
      teams: []
    };
    if (!existing.participants || existing.participants.length === 0) {
      existing.participants = Array.from(pMap.values());
    }
    const tMap = inMemoryTournamentTeams.get(tourneyId);
    if (tMap && (!existing.teams || existing.teams.length === 0)) {
      existing.teams = Array.from(tMap.values());
    }
    contextMap.set(tourneyId, existing);
  }

  return Array.from(contextMap.values());
}

/**
 * Calculates user's authoritative tournament role entitlements across ALL tournaments.
 */
export async function getUserTournamentRoleEntitlements(userId: string): Promise<UserTournamentRoleEntitlements> {
  const contexts = await getAllTournamentLifecycleContexts();
  return getUserTournamentRoleEntitlementsFromContexts(userId, contexts);
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
 * Creates or retrieves a dynamic Discord team role (e.g. "Robinhood's Squad").
 * Idempotently checks if the role already exists on Discord to prevent duplicate team roles.
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
    const rolesUrl = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    
    // 1. Idempotency Check: search for existing role by name to prevent duplicate roles
    try {
      const existingRes = await fetchFn(rolesUrl, {
        headers: { Authorization: `Bot ${botToken}` }
      });
      if (existingRes.ok) {
        const rolesList = await existingRes.json();
        if (Array.isArray(rolesList)) {
          const match = rolesList.find(
            (r: any) => r.name.toLowerCase().trim() === teamName.toLowerCase().trim()
          );
          if (match) {
            return { success: true, roleId: match.id };
          }
        }
      }
    } catch (checkErr) {
      console.warn('[createDiscordTeamRoleAuthoritative] Existing roles check note:', checkErr);
    }

    // 2. Create the role if not existing
    const res = await fetchFn(rolesUrl, {
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
      if (!tournamentData) {
        const tDoc = await db.collection('tournaments').doc(tournamentId).get();
        if (tDoc.exists) {
          tournamentData = tDoc.data();
        }
      }

      if (!participantData) {
        const pSnap = await db.collection(`tournaments/${tournamentId}/participants`).doc(userId).get();
        if (pSnap.exists) {
          participantData = pSnap.data() as TournamentParticipantRecord;
        } else {
          // Fallback 1: Check tournament document captains / teams
          const cap = tournamentData?.captains?.find((c: any) => c.userId === userId);
          const tMember = tournamentData?.teams?.flatMap((t: any) => t.primaryRoster || []).find((p: any) => p.userId === userId || p.id === userId);
          
          if (cap) {
            participantData = {
              userId,
              tournamentId,
              registrationId: userId,
              pbgId: cap.pbgId || userId,
              displayName: cap.displayName || cap.name || userId,
              tournamentRole: 'CAPTAIN',
              captainSlotId: cap.slotId || `slot-${cap.teamId}`,
              teamId: cap.teamId || null,
              participantStatus: 'ACTIVE',
              auctionStatus: 'NOT_IN_POOL',
              eliminated: false,
              source: 'REGISTRATION',
              joinedAt: cap.assignedAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          } else if (tMember) {
            participantData = {
              userId,
              tournamentId,
              registrationId: userId,
              pbgId: tMember.pbgId || userId,
              displayName: tMember.name || tMember.displayName || userId,
              tournamentRole: tMember.isCaptain ? 'CAPTAIN' : 'PLAYER',
              captainSlotId: tMember.isCaptain ? `slot-${tMember.teamId}` : null,
              teamId: tMember.teamId || null,
              participantStatus: 'ACTIVE',
              auctionStatus: 'SOLD',
              eliminated: false,
              source: 'REGISTRATION',
              joinedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
          } else {
            // Fallback 2: Check memberships subcollection
            const mSnap = await db.collection(`tournaments/${tournamentId}/memberships`).doc(userId).get();
            if (mSnap.exists) {
              const mData = mSnap.data();
              participantData = {
                userId,
                tournamentId,
                registrationId: userId,
                pbgId: mData?.pbgId || userId,
                displayName: mData?.displayName || mData?.name || userId,
                tournamentRole: mData?.role === 'captain' ? 'CAPTAIN' : 'PLAYER',
                captainSlotId: mData?.role === 'captain' ? `slot-${mData?.teamId}` : null,
                teamId: mData?.teamId || null,
                participantStatus: 'ACTIVE',
                auctionStatus: mData?.role === 'captain' ? 'NOT_IN_POOL' : 'AVAILABLE',
                eliminated: false,
                source: 'REGISTRATION',
                joinedAt: mData?.assignedAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            } else {
              // Fallback 3: Check registrations subcollection
              const rSnap = await db.collection(`tournaments/${tournamentId}/registrations`).doc(userId).get();
              if (rSnap.exists) {
                const rData = rSnap.data();
                const isApproved = rData?.status === 'verified' || rData?.status === 'registered' || rData?.status === 'APPROVED';
                participantData = {
                  userId,
                  tournamentId,
                  registrationId: rData?.id || userId,
                  pbgId: rData?.pbgId || userId,
                  displayName: rData?.ign || rData?.displayName || userId,
                  tournamentRole: rData?.isCaptainApproved ? 'CAPTAIN' : 'PLAYER',
                  captainSlotId: rData?.isCaptainApproved ? `slot-${rData?.teamId || 'pending'}` : null,
                  teamId: rData?.teamId || null,
                  participantStatus: isApproved ? 'ACTIVE' : 'INACTIVE',
                  auctionStatus: rData?.isCaptainApproved ? 'NOT_IN_POOL' : 'AVAILABLE',
                  eliminated: false,
                  source: 'REGISTRATION',
                  joinedAt: rData?.registeredAt || new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                };
              }
            }
          }
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
        } else {
          // Check tournamentData.teams array
          const rawTeam = tournamentData?.teams?.find((t: any) => t.id === participantData?.teamId);
          if (rawTeam) {
            teamData = {
              teamId: rawTeam.id,
              tournamentId,
              name: rawTeam.name,
              captainUserId: rawTeam.captainId || rawTeam.captainUserId,
              status: 'ACTIVE',
              discord: rawTeam.discord || null
            } as any;
          }
        }
      }

      // If team is active and finalized, ensure dynamic team Discord role exists
      if (teamData && !teamData.discord?.roleId) {
        const botConfig = getBotConfig(discordConfig);
        if (botConfig.botToken) {
          const roleRes = await createDiscordTeamRoleAuthoritative({
            guildId: botConfig.guildId,
            teamName: teamData.name,
            botToken: botConfig.botToken,
            fetchFn
          });
          if (roleRes.success && roleRes.roleId) {
            teamData.discord = {
              roleId: roleRes.roleId,
              roleName: teamData.name,
              createdAt: new Date().toISOString()
            };
            // Persist back to Firestore team document
            const targetTeamId = teamData.id || (teamData as any).teamId;
            if (targetTeamId) {
              await db.collection(`tournaments/${tournamentId}/teams`).doc(targetTeamId).set({
                discord: teamData.discord
              }, { merge: true }).catch(() => {});
            }
          }
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

  const { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig(discordConfig);

  const context: DiscordSyncContext = {
    tournament: {
      id: tournamentId,
      status: tournamentData?.status || 'REGISTRATION_OPEN',
      discordConfig: discordConfig || {
        enabled: true,
        guildId,
        roles: {
          tournamentPlayerRoleId: pbgPlayerRoleId,
          captainRoleId: pbgCaptainRoleId
        },
        teamRolesEnabled: true,
        cleanupPolicy: { onElimination: true, onTournamentCompletion: true }
      }
    },
    participant: participantData,
    team: teamData,
    discordLink,
    pbgMemberRoleId,
    pbgPlayerRoleId,
    pbgCaptainRoleId
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

  // 3. Compute Global Entitlements & Desired Role State
  if (!context.globalEntitlements) {
    try {
      const entitlements = await getUserTournamentRoleEntitlements(userId);
      context.globalEntitlements = {
        shouldHavePbgPlayer: entitlements.shouldHavePbgPlayer,
        shouldHavePbgCaptain: entitlements.shouldHavePbgCaptain
      };
    } catch {
      const isPlayer = participantData?.participantStatus === 'ACTIVE' || (participantData as any)?.status === 'APPROVED';
      const isCaptain = participantData?.tournamentRole === 'CAPTAIN';
      context.globalEntitlements = {
        shouldHavePbgPlayer: Boolean(isPlayer && !participantData?.eliminated),
        shouldHavePbgCaptain: Boolean(isCaptain && !participantData?.eliminated)
      };
    }
  }

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
    context.tournament.discordConfig?.roles?.tournamentPlayerRoleId || pbgPlayerRoleId,
    context.tournament.discordConfig?.roles?.captainRoleId || pbgCaptainRoleId,
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
 * CENTRAL AUTHORITATIVE CLEANUP ENGINE
 * -------------------------------------------------------------
 * Authoritative cleanup of all tournament Discord roles for terminal tournaments
 * (COMPLETED, CANCELLED, ABANDONED, DELETED).
 * 
 * Rules:
 * 1. Remove tournament-specific team roles from real Discord-linked members.
 * 2. Recalculate each user's GLOBAL PBG Player entitlement across other tournaments.
 * 3. Recalculate each user's GLOBAL PBG Captain entitlement across other tournaments.
 * 4. Strictly PRESERVE PBG Member at all times.
 * 5. Delete/archive tournament-created dynamic team roles.
 * 6. Persist cleanup report & append immutable audit log.
 * 7. 100% Idempotent.
 */
export async function cleanupTournamentDiscordState(params: {
  tournamentId: string;
  teams?: TournamentTeamRecord[];
  participants?: TournamentParticipantRecord[];
  discordConfig?: TournamentDiscordConfig;
  fetchFn?: typeof fetch;
}): Promise<TournamentDiscordCleanupReport> {
  const { tournamentId, fetchFn = fetch } = params;
  const db = getAdminDb();

  const report: TournamentDiscordCleanupReport = {
    tournamentId,
    status: 'COMPLETED',
    participantsProcessed: 0,
    teamRolesRemoved: 0,
    teamRolesDeleted: 0,
    globalPlayerRolesKept: 0,
    globalPlayerRolesRemoved: 0,
    globalCaptainRolesKept: 0,
    globalCaptainRolesRemoved: 0,
    skippedTestIdentities: 0,
    failures: []
  };

  // 1. Load tournament
  let tournamentData: any = null;
  if (db) {
    try {
      const tDoc = await db.collection('tournaments').doc(tournamentId).get();
      if (tDoc.exists) {
        tournamentData = tDoc.data();
      }
    } catch {}
  }
  const currentStatus = tournamentData?.status || tournamentData?.lifecycle || 'COMPLETED';
  report.status = currentStatus;

  // 2. Load participants
  let participants: TournamentParticipantRecord[] = params.participants || [];
  if (participants.length === 0) {
    if (db) {
      try {
        const pSnap = await db.collection(`tournaments/${tournamentId}/participants`).get();
        participants = pSnap.docs.map(d => d.data() as TournamentParticipantRecord);
      } catch {}
    }
    if (participants.length === 0) {
      const pMap = inMemoryParticipants.get(tournamentId);
      if (pMap) participants = Array.from(pMap.values());
    }
  }

  // 3. Load teams
  let teams: TournamentTeamRecord[] = params.teams || [];
  if (teams.length === 0) {
    if (db) {
      try {
        const tSnap = await db.collection(`tournaments/${tournamentId}/teams`).get();
        teams = tSnap.docs.map(d => d.data() as TournamentTeamRecord);
      } catch {}
    }
    if (teams.length === 0) {
      const tMap = inMemoryTournamentTeams.get(tournamentId);
      if (tMap) teams = Array.from(tMap.values());
    }
  }

  // 4. Load all tournament contexts across system for global entitlement checks
  const allContexts = await getAllTournamentLifecycleContexts();
  // Ensure the current tournament in allContexts is marked TERMINAL so it does NOT grant entitlements
  const contextsWithCurrentTerminal = allContexts.map(c => 
    c.id === tournamentId 
      ? { ...c, status: currentStatus, lifecycle: 'TERMINAL' }
      : c
  );

  const discordConfig: TournamentDiscordConfig | undefined = 
    params.discordConfig || tournamentData?.discordConfig || inMemoryTournamentDiscordConfigs.get(tournamentId);
  const { botToken, guildId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig(discordConfig);

  // Map of teamId -> team
  const teamById = new Map<string, TournamentTeamRecord>();
  for (const t of teams) {
    teamById.set(t.id, t);
  }

  // 5. Process each participant
  for (const participant of participants) {
    report.participantsProcessed++;

    const isTest = Boolean(
      participant.isTestAccount ||
      participant.source === 'TEST_SEED' ||
      participant.userId.startsWith('pbg-test-') ||
      participant.userId.startsWith('dummy-') ||
      participant.userId.startsWith('p-user-')
    );

    if (isTest) {
      report.skippedTestIdentities++;
      continue;
    }

    const privateAccount = await getPrivateDiscordAccount(participant.userId);
    const pbgAcc = !privateAccount?.discordUserId 
      ? (pbgAccountRegistry.getAccountByUid(participant.userId) || pbgAccountRegistry.getAccountByPbgId(participant.userId))
      : null;
    const discordUserId = privateAccount?.discordUserId || pbgAcc?.discordUserId;

    if (!discordUserId || !botToken || !guildId) {
      continue;
    }

    try {
      // Fetch actual member roles
      const actualRes = await fetchActualMemberDiscordRoles({
        guildId,
        discordUserId,
        botToken,
        fetchFn
      });

      const actualRoles = actualRes.ok ? actualRes.roles : [];

      // A. Remove tournament-specific team role from member
      if (participant.teamId) {
        const team = teamById.get(participant.teamId);
        if (team?.discord?.roleId && actualRoles.includes(team.discord.roleId)) {
          const remRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: team.discord.roleId,
            botToken,
            fetchFn
          });
          if (remRes.success) {
            report.teamRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: team.discord.roleId,
              error: remRes.error || 'FAILED_TO_REMOVE_TEAM_ROLE'
            });
          }
        }
      }

      // Also check if user holds any other team role from this tournament
      for (const t of teams) {
        if (t.discord?.roleId && t.id !== participant.teamId && actualRoles.includes(t.discord.roleId)) {
          await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: t.discord.roleId,
            botToken,
            fetchFn
          });
          report.teamRolesRemoved++;
        }
      }

      // B. Recalculate global entitlements across remaining active tournaments
      const entitlements = getUserTournamentRoleEntitlementsFromContexts(participant.userId, contextsWithCurrentTerminal);

      // PBG Player
      if (entitlements.shouldHavePbgPlayer) {
        report.globalPlayerRolesKept++;
      } else {
        if (pbgPlayerRoleId && actualRoles.includes(pbgPlayerRoleId)) {
          const remPlayerRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: pbgPlayerRoleId,
            botToken,
            fetchFn
          });
          if (remPlayerRes.success) {
            report.globalPlayerRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: pbgPlayerRoleId,
              error: remPlayerRes.error || 'FAILED_TO_REMOVE_PLAYER_ROLE'
            });
          }
        }
      }

      // PBG Captain
      if (entitlements.shouldHavePbgCaptain) {
        report.globalCaptainRolesKept++;
      } else {
        if (pbgCaptainRoleId && actualRoles.includes(pbgCaptainRoleId)) {
          const remCaptainRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: pbgCaptainRoleId,
            botToken,
            fetchFn
          });
          if (remCaptainRes.success) {
            report.globalCaptainRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: pbgCaptainRoleId,
              error: remCaptainRes.error || 'FAILED_TO_REMOVE_CAPTAIN_ROLE'
            });
          }
        }
      }

      // PBG Member is strictly preserved!
    } catch (partErr: any) {
      report.failures.push({
        userId: participant.userId,
        error: partErr.message || 'UNKNOWN_CLEANUP_ERROR'
      });
    }
  }

  // 6. Delete/archive dynamic team roles created for this tournament
  for (const team of teams) {
    if (team.discord?.roleId) {
      const roleIdToDelete = team.discord.roleId;
      try {
        const delRes = await deleteDiscordTeamRoleAuthoritative({
          guildId,
          roleId: roleIdToDelete,
          botToken,
          fetchFn
        });
        if (delRes.success) {
          report.teamRolesDeleted++;
          team.discord = undefined;
          if (db) {
            await db.collection(`tournaments/${tournamentId}/teams`).doc(team.id).set({
              discord: null
            }, { merge: true }).catch(() => {});
          }
        } else {
          report.failures.push({
            roleId: roleIdToDelete,
            error: delRes.error || 'FAILED_TO_DELETE_TEAM_ROLE'
          });
        }
      } catch (delErr: any) {
        report.failures.push({
          roleId: roleIdToDelete,
          error: delErr.message || 'FAILED_TO_DELETE_TEAM_ROLE'
        });
      }
    }
  }

  // 7. Persist cleanup result
  if (db) {
    try {
      await db.collection('tournaments').doc(tournamentId).set({
        discordCleanupStatus: 'COMPLETED',
        discordCleanedAt: new Date().toISOString(),
        discordCleanupReport: report
      }, { merge: true });
    } catch (saveErr) {
      console.warn('[cleanupTournamentDiscordState] Firestore report save warning:', saveErr);
    }

    // 8. Audit event
    try {
      await db.collection('audit_logs').add({
        action: 'tournament_discord_cleanup',
        tournamentId,
        entityType: 'tournament',
        entityId: tournamentId,
        details: `Cleaned tournament Discord state. Participants: ${report.participantsProcessed}, Team roles removed: ${report.teamRolesRemoved}, Team roles deleted: ${report.teamRolesDeleted}`,
        report,
        timestamp: new Date().toISOString()
      });
    } catch {}
  }

  // If there were any failures, queue a retryable sync job
  if (report.failures.length > 0) {
    const jobId = `cleanup_${tournamentId}`;
    const job: DiscordSyncJobRecord = {
      id: jobId,
      type: 'CLEANUP_TOURNAMENT_DISCORD',
      tournamentId,
      status: 'PENDING',
      attempts: 1,
      lastError: `Failed ${report.failures.length} operations during cleanup`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: { failures: report.failures }
    };
    await recordDiscordSyncJob(job);
  }

  return report;
}

/**
 * Backward compatibility wrapper for completion cleanup
 */
export async function cleanupTournamentCompletionDiscordRoles(params: {
  tournamentId: string;
  teams?: TournamentTeamRecord[];
  participants?: TournamentParticipantRecord[];
  discordConfig?: TournamentDiscordConfig;
  fetchFn?: typeof fetch;
}): Promise<{ totalParticipantsCleaned: number; deletedTeamRoles: number }> {
  const report = await cleanupTournamentDiscordState({
    tournamentId: params.tournamentId,
    teams: params.teams,
    participants: params.participants,
    discordConfig: params.discordConfig,
    fetchFn: params.fetchFn
  });
  return {
    totalParticipantsCleaned: report.participantsProcessed,
    deletedTeamRoles: report.teamRolesDeleted
  };
}

/**
 * -------------------------------------------------------------
 * SOFT DELETE TOURNAMENT (SECTION 9)
 * -------------------------------------------------------------
 * Flows: ACTIVE -> CANCELLED/ABANDONED -> Discord cleanup -> DELETED/SOFT_DELETED.
 * Retains complete data for audit, history, and recovery.
 */
export async function softDeleteTournamentAuthoritative(params: {
  tournamentId: string;
  deletedBy: string;
  deleteReason: string;
  fetchFn?: typeof fetch;
}): Promise<{
  success: boolean;
  tournamentId: string;
  cleanupReport: TournamentDiscordCleanupReport;
}> {
  const { tournamentId, deletedBy, deleteReason, fetchFn = fetch } = params;
  const db = getAdminDb();

  // 1. Transition to CANCELLED state first if not already terminal
  if (db) {
    try {
      await db.collection('tournaments').doc(tournamentId).set({
        status: 'cancelled',
        lifecycle: 'CANCELLED',
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch {}
  }

  // 2. Perform authoritative Discord cleanup
  const cleanupReport = await cleanupTournamentDiscordState({
    tournamentId,
    fetchFn
  });

  // 3. Persist soft-deletion metadata
  const now = new Date().toISOString();
  if (db) {
    try {
      await db.collection('tournaments').doc(tournamentId).set({
        deleted: true,
        deletedAt: now,
        deletedBy,
        deleteReason,
        status: 'deleted',
        lifecycle: 'DELETED',
        updatedAt: now
      }, { merge: true });
    } catch {}

    // Audit log
    try {
      await db.collection('audit_logs').add({
        action: 'tournament_soft_delete',
        tournamentId,
        entityType: 'tournament',
        entityId: tournamentId,
        details: `Soft-deleted tournament by ${deletedBy}. Reason: ${deleteReason}`,
        deletedBy,
        deleteReason,
        timestamp: now
      });
    } catch {}
  }

  return {
    success: true,
    tournamentId,
    cleanupReport
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

export interface TournamentDiscordSyncReport {
  processed: number;
  updated: number;
  alreadyCorrect: number;
  skippedTestIdentities: number;
  failed: number;
  failures: Array<{ userId: string; username?: string; error: string }>;
  results: DiscordSyncResult[];
}

/**
 * -------------------------------------------------------------
 * RETROACTIVE DISCORD RECONCILIATION FOR TOURNAMENT
 * -------------------------------------------------------------
 * Iterates through all real Discord-linked active participants in a tournament,
 * calculates current desired roles from authoritative PBG state, reconciles,
 * and skips dummy TEST_SEED identities cleanly.
 */
export async function syncTournamentDiscordRolesAll(params: {
  tournamentId: string;
  fetchFn?: typeof fetch;
}): Promise<TournamentDiscordSyncReport> {
  const { tournamentId, fetchFn = fetch } = params;
  const db = getAdminDb();
  let participants: TournamentParticipantRecord[] = [];

  if (db) {
    try {
      const pSnap = await db.collection(`tournaments/${tournamentId}/participants`).get();
      participants = pSnap.docs.map(d => d.data() as TournamentParticipantRecord);
    } catch {}
  }
  if (participants.length === 0) {
    const pMap = inMemoryParticipants.get(tournamentId);
    if (pMap) participants = Array.from(pMap.values());
  }

  const report: TournamentDiscordSyncReport = {
    processed: 0,
    updated: 0,
    alreadyCorrect: 0,
    skippedTestIdentities: 0,
    failed: 0,
    failures: [],
    results: []
  };

  for (const part of participants) {
    report.processed++;
    const isTest = Boolean(
      part.isTestAccount ||
      part.source === 'TEST_SEED' ||
      part.userId.startsWith('pbg-test-') ||
      part.userId.startsWith('dummy-') ||
      part.userId.startsWith('p-user-')
    );

    if (isTest) {
      report.skippedTestIdentities++;
      continue;
    }

    try {
      const syncRes = await syncDiscordTournamentRoles({
        userId: part.userId,
        tournamentId,
        fetchFn
      });
      report.results.push(syncRes);

      if (syncRes.skipped) {
        report.skippedTestIdentities++;
      } else if (!syncRes.success) {
        report.failed++;
        report.failures.push({
          userId: part.userId,
          username: part.displayName || (part as any).username || part.userId,
          error: syncRes.error || 'SYNC_FAILED'
        });
      } else if (syncRes.rolesAdded.length > 0 || syncRes.rolesRemoved.length > 0) {
        report.updated++;
      } else {
        report.alreadyCorrect++;
      }
    } catch (err: any) {
      report.failed++;
      report.failures.push({
        userId: part.userId,
        username: part.displayName || (part as any).username || part.userId,
        error: err.message || 'UNEXPECTED_ERROR'
      });
    }
  }

  return report;
}

export interface ParticipantDiscordDiagnostic {
  userId: string;
  username: string;
  tournamentRole: string;
  captainSlotId: string | null;
  teamId: string | null;
  teamName: string | null;
  isTestAccount: boolean;
  discordLinked: boolean;
  discordUserId: string | null;
  guildMemberVerified: boolean;
  desiredRoles: string[];
  actualRoles: string[];
  syncStatus: 'SYNCED' | 'OUT_OF_SYNC' | 'NOT_LINKED' | 'SKIPPED_TEST_IDENTITY';
}

export async function getTournamentDiscordDiagnostics(tournamentId: string): Promise<ParticipantDiscordDiagnostic[]> {
  const db = getAdminDb();
  let participants: TournamentParticipantRecord[] = [];

  if (db) {
    try {
      const pSnap = await db.collection(`tournaments/${tournamentId}/participants`).get();
      participants = pSnap.docs.map(d => d.data() as TournamentParticipantRecord);
    } catch {}
  }
  if (participants.length === 0) {
    const pMap = inMemoryParticipants.get(tournamentId);
    if (pMap) participants = Array.from(pMap.values());
  }

  const { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig();
  const diagnostics: ParticipantDiscordDiagnostic[] = [];

  for (const p of participants) {
    const isTest = Boolean(
      p.isTestAccount ||
      p.source === 'TEST_SEED' ||
      p.userId.startsWith('pbg-test-') ||
      p.userId.startsWith('dummy-') ||
      p.userId.startsWith('p-user-')
    );

    if (isTest) {
      diagnostics.push({
        userId: p.userId,
        username: p.displayName || (p as any).username || p.userId,
        tournamentRole: p.tournamentRole,
        captainSlotId: p.captainSlotId || null,
        teamId: p.teamId || null,
        teamName: (p as any).teamName || null,
        isTestAccount: true,
        discordLinked: false,
        discordUserId: null,
        guildMemberVerified: false,
        desiredRoles: [],
        actualRoles: [],
        syncStatus: 'SKIPPED_TEST_IDENTITY'
      });
      continue;
    }

    const privateAccount = await getPrivateDiscordAccount(p.userId);
    const discordUserId = privateAccount?.discordUserId || null;
    const discordLinked = Boolean(privateAccount?.discordLinked && discordUserId);

    let actualRoles: string[] = [];
    let guildMemberVerified = false;

    if (discordLinked && discordUserId && botToken && guildId) {
      try {
        const verifyRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
          headers: { Authorization: `Bot ${botToken}` }
        });
        if (verifyRes.ok) {
          guildMemberVerified = true;
          const memberData = await verifyRes.json();
          actualRoles = Array.isArray(memberData?.roles) ? memberData.roles : [];
        }
      } catch {}
    }

    const desired: string[] = [pbgMemberRoleId, pbgPlayerRoleId];
    if (p.tournamentRole === 'CAPTAIN') desired.push(pbgCaptainRoleId);

    let syncStatus: ParticipantDiscordDiagnostic['syncStatus'] = 'NOT_LINKED';
    if (discordLinked) {
      const allPresent = desired.every(r => actualRoles.includes(r));
      syncStatus = allPresent ? 'SYNCED' : 'OUT_OF_SYNC';
    }

    diagnostics.push({
      userId: p.userId,
      username: p.displayName || (p as any).username || p.userId,
      tournamentRole: p.tournamentRole,
      captainSlotId: p.captainSlotId || null,
      teamId: p.teamId || null,
      teamName: (p as any).teamName || null,
      isTestAccount: false,
      discordLinked,
      discordUserId,
      guildMemberVerified,
      desiredRoles: desired,
      actualRoles,
      syncStatus
    });
  }

  return diagnostics;
}
