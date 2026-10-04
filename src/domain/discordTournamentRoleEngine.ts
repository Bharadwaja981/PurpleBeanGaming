/**
 * Purple Bean Gaming — Centralized Discord Tournament Role Synchronization Engine
 * 
 * IMPORTANT ARCHITECTURE PRINCIPLE:
 * - PBG database state is the single source of truth.
 * - Discord is strictly a projection of PBG tournament state.
 * - This engine calculates DESIRED role state deterministically and reconciles actual Discord roles.
 * 
 * Role Categories & Canonical PBG Naming:
 * 1. Persistent platform role:
 *    - "PBG Member" (MUST NEVER be removed by tournament sync while Discord is linked)
 *      → DISCORD_PBG_MEMBER_ROLE_ID (Default: 1555885374713237524)
 * 2. Temporary tournament roles:
 *    - "PBG Player"
 *      → DISCORD_PBG_PLAYER_ROLE_ID (Default: 1555884061111746651)
 *    - "PBG Captain"
 *      → DISCORD_PBG_CAPTAIN_ROLE_ID (Default: 1556338549807259658)
 * 3. Dynamic team roles:
 *    - One Discord role per finalized team (<Team Name>), created automatically and stored by returned Discord roleId.
 */

import {
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig
} from './tournamentRegistrationEngine';

/**
 * PurpleBeanGaming canonical Discord role IDs.
 * Matches the official PBG environment convention:
 * - DISCORD_PBG_MEMBER_ROLE_ID: Persistent guild membership role
 * - DISCORD_PBG_PLAYER_ROLE_ID: Temporary tournament participant role
 * - DISCORD_PBG_CAPTAIN_ROLE_ID: Temporary tournament team captain role
 */
export const PBG_DISCORD_ROLE_DEFAULTS = {
  DISCORD_PBG_MEMBER_ROLE_ID: '1555885374713237524',
  DISCORD_PBG_PLAYER_ROLE_ID: '1555884061111746651',
  DISCORD_PBG_CAPTAIN_ROLE_ID: '1556338549807259658'
} as const;

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
  pbgPlayerRoleId?: string;
  pbgCaptainRoleId?: string;
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
 * Discord Role Configuration Validation Result
 */
export interface DiscordRoleConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  roles: {
    DISCORD_PBG_MEMBER_ROLE_ID: string;
    DISCORD_PBG_PLAYER_ROLE_ID: string;
    DISCORD_PBG_CAPTAIN_ROLE_ID: string;
  };
}

/**
 * Validates Discord role environment and tournament config against PBG convention.
 */
export function validateDiscordRoleConfig(config?: Partial<TournamentDiscordConfig>): DiscordRoleConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const memberRoleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
  const playerRoleId = config?.roles?.tournamentPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID;
  const captainRoleId = config?.roles?.captainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID;

  const snowflakeRegex = /^\d{17,20}$/;

  if (!memberRoleId) {
    errors.push('Missing DISCORD_PBG_MEMBER_ROLE_ID: Persistent member role ID must be configured.');
  } else if (!snowflakeRegex.test(memberRoleId)) {
    warnings.push(`DISCORD_PBG_MEMBER_ROLE_ID "${memberRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }

  if (!playerRoleId) {
    errors.push('Missing DISCORD_PBG_PLAYER_ROLE_ID: Temporary tournament player role ID must be configured.');
  } else if (!snowflakeRegex.test(playerRoleId)) {
    warnings.push(`DISCORD_PBG_PLAYER_ROLE_ID "${playerRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }

  if (!captainRoleId) {
    errors.push('Missing DISCORD_PBG_CAPTAIN_ROLE_ID: Temporary tournament captain role ID must be configured.');
  } else if (!snowflakeRegex.test(captainRoleId)) {
    warnings.push(`DISCORD_PBG_CAPTAIN_ROLE_ID "${captainRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }

  // Ensure role IDs are distinct
  if (memberRoleId && playerRoleId && memberRoleId === playerRoleId) {
    errors.push('Collision: DISCORD_PBG_MEMBER_ROLE_ID and DISCORD_PBG_PLAYER_ROLE_ID cannot share the same Discord role ID.');
  }
  if (memberRoleId && captainRoleId && memberRoleId === captainRoleId) {
    errors.push('Collision: DISCORD_PBG_MEMBER_ROLE_ID and DISCORD_PBG_CAPTAIN_ROLE_ID cannot share the same Discord role ID.');
  }
  if (playerRoleId && captainRoleId && playerRoleId === captainRoleId) {
    errors.push('Collision: DISCORD_PBG_PLAYER_ROLE_ID and DISCORD_PBG_CAPTAIN_ROLE_ID cannot share the same Discord role ID.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    roles: {
      DISCORD_PBG_MEMBER_ROLE_ID: memberRoleId,
      DISCORD_PBG_PLAYER_ROLE_ID: playerRoleId,
      DISCORD_PBG_CAPTAIN_ROLE_ID: captainRoleId
    }
  };
}

/**
 * Diagnostic helper: returns a human-readable diagnostic report for Discord role configuration.
 */
export function getDiscordRoleConfigDiagnostics(config?: Partial<TournamentDiscordConfig>): {
  status: 'OK' | 'WARNING' | 'ERROR';
  summary: string;
  validation: DiscordRoleConfigValidation;
} {
  const validation = validateDiscordRoleConfig(config);
  const status = validation.errors.length > 0 ? 'ERROR' : (validation.warnings.length > 0 ? 'WARNING' : 'OK');
  const summary = status === 'OK'
    ? 'Discord PBG role configuration is valid and matches PurpleBeanGaming convention.'
    : (status === 'WARNING'
      ? `Discord PBG role configuration has warnings: ${validation.warnings.join('; ')}`
      : `Discord PBG role configuration has errors: ${validation.errors.join('; ')}`);

  return { status, summary, validation };
}

/**
 * Pure function: calculates the exact DESIRED Discord roles for a user based on PBG tournament state.
 * Mapping convention:
 * - PBG Member  → DISCORD_PBG_MEMBER_ROLE_ID
 * - PBG Player  → DISCORD_PBG_PLAYER_ROLE_ID
 * - PBG Captain → DISCORD_PBG_CAPTAIN_ROLE_ID
 * - Team Role   → Dynamic team role created automatically
 */
export function getDesiredTournamentDiscordRoles(
  context: DiscordSyncContext
): DesiredDiscordRolesResult {
  const { tournament, participant, team, discordLink } = context;
  const pbgMemberRoleId = context.pbgMemberRoleId || process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
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

  const pbgPlayerRoleId = 
    context.pbgPlayerRoleId || 
    discordConfig?.roles?.tournamentPlayerRoleId || 
    process.env.DISCORD_PBG_PLAYER_ROLE_ID || 
    PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID;

  const pbgCaptainRoleId = 
    context.pbgCaptainRoleId || 
    discordConfig?.roles?.captainRoleId || 
    process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || 
    PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID;

  const teamRoleId = team?.discord?.roleId;

  const isTournamentCompleted = 
    tournament.status === 'COMPLETED' || 
    tournament.status === 'ARCHIVED';

  const isTeamEliminated = team?.status === 'ELIMINATED' || participant?.eliminated === true;
  const isParticipantActive = participant && participant.participantStatus === 'ACTIVE';

  // If tournament is completed: ALL temporary tournament roles and team roles must be removed!
  if (isTournamentCompleted) {
    if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
    if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
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
    if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
    if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
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
    // 2. PBG Player Role (Temporary Tournament Player)
    if (pbgPlayerRoleId) {
      desiredRoleIds.add(pbgPlayerRoleId);
      roleDetails.push({
        roleId: pbgPlayerRoleId,
        roleName: 'PBG Player',
        category: 'TOURNAMENT'
      });
    }

    // 3. PBG Captain Role (Temporary Team Captain)
    if (participant.tournamentRole === 'CAPTAIN') {
      if (pbgCaptainRoleId) {
        desiredRoleIds.add(pbgCaptainRoleId);
        roleDetails.push({
          roleId: pbgCaptainRoleId,
          roleName: 'PBG Captain',
          category: 'TOURNAMENT'
        });
      }
    } else {
      // If not captain, captain role should be removed if present
      if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
    }

    // 4. Dynamic Team Role (if active team finalized)
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
    if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
    if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
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
  managedRoleIds: string[]; // all role IDs governed by PBG (PBG Member, PBG Player, PBG Captain, Team roles)
  pbgMemberRoleId?: string;
}): DiscordRoleReconciliationPlan {
  const { guildId, discordUserId, actualDiscordRoles, desiredResult, managedRoleIds } = params;

  const actualSet = new Set(actualDiscordRoles);
  const desiredSet = new Set(desiredResult.desiredRoleIds);
  const managedSet = new Set(managedRoleIds);

  const pbgMemberRoleId = params.pbgMemberRoleId || 
    desiredResult.roleDetails.find(r => r.category === 'PERSISTENT' || r.roleName === 'PBG Member')?.roleId ||
    process.env.DISCORD_PBG_MEMBER_ROLE_ID || 
    PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;

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
