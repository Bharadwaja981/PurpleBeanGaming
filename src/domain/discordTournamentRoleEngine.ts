/**
 * Purple Bean Gaming — Centralized Discord Tournament Role Synchronization Engine
 * 
 * IMPORTANT ARCHITECTURE PRINCIPLE:
 * - PBG database state is the single source of truth.
 * - Discord is strictly a projection of PBG tournament state.
 * - This engine calculates DESIRED role state deterministically and reconciles actual Discord roles.
 * 
 * Role Categories:
 * 1. Persistent platform role:
 *    - "PBG Member" (MUST NEVER be removed by tournament sync while Discord is linked)
 * 2. Temporary tournament roles:
 *    - "Tournament Player"
 *    - "Captain"
 * 3. Dynamic team roles:
 *    - One Discord role per finalized team (<Team Name>), assigned to active team members.
 */

import {
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig
} from './tournamentRegistrationEngine';

export interface DiscordSyncContext {
  tournament: {
    id: string;
    status: string; // e.g. 'REGISTRATION_OPEN', 'LIVE', 'COMPLETED', etc.
    discordConfig?: TournamentDiscordConfig;
  };
  participant?: TournamentParticipantRecord | null;
  team?: TournamentTeamRecord | null;
  discordLink: {
    discordUserId?: string;
    discordLinked: boolean;
    pbgMemberRoleActive?: boolean;
  };
  pbgMemberRoleId?: string;
}

export type RoleCategory = 'PERSISTENT' | 'TOURNAMENT' | 'TEAM';

export interface DesiredRoleItem {
  roleId: string;
  roleName: string;
  category: RoleCategory;
}

export interface DesiredDiscordRolesResult {
  userId: string;
  discordUserId?: string;
  pbgMemberActive: boolean;
  desiredRoleIds: string[];
  undesiredRoleIds: string[]; // tournament-managed roles that MUST be revoked
  roleDetails: DesiredRoleItem[];
  reconciliationRequired: boolean;
  reconciliationReason?: string;
}

export interface DiscordRoleReconciliationPlan {
  discordUserId: string;
  guildId: string;
  rolesToAdd: string[];
  rolesToRemove: string[];
  summary: string;
}

/**
 * Pure function: calculates the exact DESIRED Discord roles for a user based on PBG tournament state.
 */
export function getDesiredTournamentDiscordRoles(
  context: DiscordSyncContext
): DesiredDiscordRolesResult {
  const { tournament, participant, team, discordLink } = context;
  const pbgMemberRoleId = context.pbgMemberRoleId || process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';
  const discordConfig = tournament.discordConfig;

  const roleDetails: DesiredRoleItem[] = [];
  const desiredRoleIds = new Set<string>();
  const undesiredRoleIds = new Set<string>();

  // 1. Persistent Role: PBG Member is ALWAYS preserved if Discord is linked
  if (discordLink.discordLinked && pbgMemberRoleId) {
    desiredRoleIds.add(pbgMemberRoleId);
    roleDetails.push({
      roleId: pbgMemberRoleId,
      roleName: 'PBG Member',
      category: 'PERSISTENT'
    });
  }

  // If Discord is not linked, no tournament roles can be applied
  if (!discordLink.discordLinked || !discordLink.discordUserId) {
    return {
      userId: participant?.userId || 'unknown',
      discordUserId: undefined,
      pbgMemberActive: false,
      desiredRoleIds: [],
      undesiredRoleIds: [],
      roleDetails: [],
      reconciliationRequired: true,
      reconciliationReason: 'DISCORD_NOT_LINKED: User has not connected their Discord account.'
    };
  }

  const tournamentPlayerRoleId = discordConfig?.roles?.tournamentPlayerRoleId;
  const captainRoleId = discordConfig?.roles?.captainRoleId;
  const teamRoleId = team?.discord?.roleId;

  const isTournamentCompleted = 
    tournament.status === 'COMPLETED' || 
    tournament.status === 'ARCHIVED';

  const isTeamEliminated = team?.status === 'ELIMINATED' || participant?.eliminated === true;
  const isParticipantActive = participant && participant.participantStatus === 'ACTIVE';

  // If tournament is completed: ALL temporary tournament roles and team roles must be removed!
  if (isTournamentCompleted) {
    if (tournamentPlayerRoleId) undesiredRoleIds.add(tournamentPlayerRoleId);
    if (captainRoleId) undesiredRoleIds.add(captainRoleId);
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);

    return {
      userId: participant?.userId || 'unknown',
      discordUserId: discordLink.discordUserId,
      pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
      desiredRoleIds: Array.from(desiredRoleIds),
      undesiredRoleIds: Array.from(undesiredRoleIds),
      roleDetails,
      reconciliationRequired: false
    };
  }

  // If team is eliminated: temporary tournament roles (Player, Captain, Team Role) are removed!
  if (isTeamEliminated) {
    if (tournamentPlayerRoleId) undesiredRoleIds.add(tournamentPlayerRoleId);
    if (captainRoleId) undesiredRoleIds.add(captainRoleId);
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);

    return {
      userId: participant?.userId || 'unknown',
      discordUserId: discordLink.discordUserId,
      pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
      desiredRoleIds: Array.from(desiredRoleIds),
      undesiredRoleIds: Array.from(undesiredRoleIds),
      roleDetails,
      reconciliationRequired: false
    };
  }

  // Active participant in an ongoing tournament
  if (isParticipantActive) {
    // 2. Tournament Player Role
    if (tournamentPlayerRoleId) {
      desiredRoleIds.add(tournamentPlayerRoleId);
      roleDetails.push({
        roleId: tournamentPlayerRoleId,
        roleName: 'Tournament Player',
        category: 'TOURNAMENT'
      });
    }

    // 3. Captain Role
    if (participant.tournamentRole === 'CAPTAIN') {
      if (captainRoleId) {
        desiredRoleIds.add(captainRoleId);
        roleDetails.push({
          roleId: captainRoleId,
          roleName: 'Captain',
          category: 'TOURNAMENT'
        });
      }
    } else {
      // If not captain, captain role should be removed if present
      if (captainRoleId) undesiredRoleIds.add(captainRoleId);
    }

    // 4. Team Role (if active team finalized)
    if (team && team.status === 'ACTIVE' && teamRoleId) {
      desiredRoleIds.add(teamRoleId);
      roleDetails.push({
        roleId: teamRoleId,
        roleName: team.discord?.roleName || team.name,
        category: 'TEAM'
      });
    }
  } else {
    // Non-participant or inactive: strip any temporary roles
    if (tournamentPlayerRoleId) undesiredRoleIds.add(tournamentPlayerRoleId);
    if (captainRoleId) undesiredRoleIds.add(captainRoleId);
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);
  }

  return {
    userId: participant?.userId || 'unknown',
    discordUserId: discordLink.discordUserId,
    pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
    desiredRoleIds: Array.from(desiredRoleIds),
    undesiredRoleIds: Array.from(undesiredRoleIds),
    roleDetails,
    reconciliationRequired: !discordLink.pbgMemberRoleActive
  };
}

/**
 * Builds an actionable reconciliation plan comparing desired roles with actual Discord roles.
 */
export function buildDiscordRoleReconciliationPlan(params: {
  guildId: string;
  discordUserId: string;
  actualDiscordRoles: string[];
  desiredResult: DesiredDiscordRolesResult;
  managedRoleIds: string[]; // all role IDs governed by PBG (PBG Member, Tournament Player, Captain, Team roles)
  pbgMemberRoleId?: string;
}): DiscordRoleReconciliationPlan {
  const { guildId, discordUserId, actualDiscordRoles, desiredResult, managedRoleIds } = params;

  const actualSet = new Set(actualDiscordRoles);
  const desiredSet = new Set(desiredResult.desiredRoleIds);
  const managedSet = new Set(managedRoleIds);

  const pbgMemberRoleId = params.pbgMemberRoleId || 
    desiredResult.roleDetails.find(r => r.category === 'PERSISTENT' || r.roleName === 'PBG Member')?.roleId ||
    process.env.DISCORD_PBG_MEMBER_ROLE_ID || 
    '1555885374713237524';

  const rolesToAdd: string[] = [];
  const rolesToRemove: string[] = [];

  // Determine roles to add
  for (const roleId of desiredResult.desiredRoleIds) {
    if (!actualSet.has(roleId)) {
      rolesToAdd.push(roleId);
    }
  }

  // Determine roles to remove (ONLY remove roles that are PBG-managed and explicitly undesired or not in desiredSet)
  for (const roleId of actualDiscordRoles) {
    if (managedSet.has(roleId)) {
      // Invariant 8: Tournament cleanup must NEVER remove PBG Member role under any circumstances
      if (roleId === pbgMemberRoleId) {
        continue;
      }
      if (!desiredSet.has(roleId) || desiredResult.undesiredRoleIds.includes(roleId)) {
        rolesToRemove.push(roleId);
      }
    }
  }

  const summary = `Reconcile Discord roles for ${discordUserId}: +${rolesToAdd.length} role(s), -${rolesToRemove.length} role(s).`;

  return {
    discordUserId,
    guildId,
    rolesToAdd,
    rolesToRemove,
    summary
  };
}
