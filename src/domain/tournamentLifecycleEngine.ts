/**
 * Purple Bean Gaming — Tournament Lifecycle Engine & Global Role Entitlements
 * 
 * Central authoritative logic for:
 * 1. Tournament Lifecycle State Machine & Classification:
 *    - ACTIVE_LIKE: In-progress, drafting, active matches, playoffs, review, etc.
 *    - ON_HOLD: Paused tournament (retains temporary roles, disables mutations)
 *    - TERMINAL: COMPLETED, CANCELLED, ABANDONED, DELETED
 * 2. Central Rule: shouldTournamentGrantTemporaryDiscordRoles(tournament)
 * 3. Global Multi-Tournament User Role Entitlements:
 *    - PBG Player is kept if user is active in >= 1 active/on-hold tournament
 *    - PBG Captain is kept if user is active captain in >= 1 active/on-hold tournament
 *    - PBG Member is persistent and NEVER removed by tournament sync/cleanup
 *    - Team roles are tournament-specific (removed on elimination, deleted only on terminal cleanup)
 */

import {
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig
} from './tournamentRegistrationEngine';
import {
  PBG_DISCORD_ROLE_DEFAULTS,
  RoleCategory,
  DesiredRoleItem
} from './discordTournamentRoleEngine';

export type TournamentLifecycleCategory = 'ACTIVE_LIKE' | 'ON_HOLD' | 'TERMINAL';

export type StandardTournamentLifecycleState = 
  | 'ACTIVE'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ABANDONED'
  | 'DELETED';

export interface TournamentLifecycleContext {
  id: string;
  name?: string;
  status?: string;
  lifecycle?: string;
  deleted?: boolean;
  discordConfig?: TournamentDiscordConfig;
  participants?: TournamentParticipantRecord[];
  teams?: TournamentTeamRecord[];
}

/**
 * Classifies any tournament status into ACTIVE_LIKE, ON_HOLD, or TERMINAL.
 */
export function classifyTournamentLifecycle(
  tournamentOrStatus: string | { status?: string; lifecycle?: string; deleted?: boolean; [key: string]: any } | null | undefined
): TournamentLifecycleCategory {
  if (!tournamentOrStatus) return 'TERMINAL';

  if (typeof tournamentOrStatus === 'object') {
    if (tournamentOrStatus.deleted === true) return 'TERMINAL';
    const status = tournamentOrStatus.lifecycle || tournamentOrStatus.status || '';
    return classifyTournamentLifecycle(status);
  }

  const raw = String(tournamentOrStatus).trim().toUpperCase();

  // ON_HOLD states
  if (
    raw === 'ON_HOLD' || 
    raw === 'ON HOLD' || 
    raw === 'PAUSED' || 
    raw === 'AUCTION_PAUSED' ||
    raw === 'HOLD'
  ) {
    return 'ON_HOLD';
  }

  // TERMINAL states
  if (
    raw === 'COMPLETED' || 
    raw === 'COMPLETE' ||
    raw === 'CANCELLED' || 
    raw === 'CANCELED' || 
    raw === 'ABANDONED' || 
    raw === 'DELETED' || 
    raw === 'SOFT_DELETED' ||
    raw === 'ARCHIVED'
  ) {
    return 'TERMINAL';
  }

  // All other states are ACTIVE_LIKE (including draft, registration, auction, live, matches_active, etc.)
  return 'ACTIVE_LIKE';
}

/**
 * Central rule: determines if a tournament grants temporary Discord roles.
 * - ACTIVE_LIKE → yes
 * - ON_HOLD → yes (retain existing temporary roles while paused)
 * - TERMINAL → no
 */
export function shouldTournamentGrantTemporaryDiscordRoles(
  tournament: any
): boolean {
  if (!tournament) return false;
  const category = classifyTournamentLifecycle(tournament);
  switch (category) {
    case 'ACTIVE_LIKE':
      return true;
    case 'ON_HOLD':
      return true;
    case 'TERMINAL':
      return false;
    default:
      return false;
  }
}

export interface UserTournamentRoleEntitlements {
  userId: string;
  activeTournamentIds: string[];
  activeParticipantTournamentIds: string[];
  activeCaptainTournamentIds: string[];
  shouldHavePbgPlayer: boolean;
  shouldHavePbgCaptain: boolean;
  qualifyingTournaments: Array<{
    tournamentId: string;
    tournamentName: string;
    lifecycleCategory: TournamentLifecycleCategory;
    isCaptain: boolean;
    teamId?: string | null;
    teamName?: string | null;
    teamRoleId?: string | null;
  }>;
}

/**
 * Pure calculation: inspects all relevant tournaments for a user to determine
 * whether the user is entitled to global PBG Player and PBG Captain roles.
 * 
 * Rules:
 * - Treat ON_HOLD as still active for Discord entitlement.
 * - Exclude TERMINAL tournaments (COMPLETED, CANCELLED, ABANDONED, DELETED).
 * - Exclude DISQUALIFIED or WITHDRAWN participants.
 * - Exclude ELIMINATED participants for that tournament.
 */
export function getUserTournamentRoleEntitlementsFromContexts(
  userId: string,
  tournaments: TournamentLifecycleContext[]
): UserTournamentRoleEntitlements {
  const activeTournamentIds = new Set<string>();
  const activeParticipantTournamentIds = new Set<string>();
  const activeCaptainTournamentIds = new Set<string>();
  const qualifyingTournaments: UserTournamentRoleEntitlements['qualifyingTournaments'] = [];

  for (const tourney of tournaments) {
    const category = classifyTournamentLifecycle(tourney);

    // TERMINAL tournaments grant ZERO temporary roles
    if (category === 'TERMINAL') {
      continue;
    }

    // Must be ACTIVE_LIKE or ON_HOLD
    const participant = tourney.participants?.find(p => 
      p.userId === userId || 
      (p as any).pbgId === userId || 
      (p as any).id === userId
    );

    const team = tourney.teams?.find(t => 
      (participant?.teamId && (t.id === participant.teamId || (t as any).teamId === participant.teamId)) ||
      t.captainUserId === userId || 
      (t as any).captainId === userId || 
      (participant?.pbgId && ((t as any).captainId === (participant as any).pbgId || t.captainUserId === (participant as any).pbgId)) ||
      t.roster?.includes(userId) ||
      (t as any).primaryRoster?.some((r: any) => r.userId === userId || r.id === userId || (r as any).pbgId === userId)
    );

    if (!participant && !team) {
      continue;
    }

    // Exclude disqualified, withdrawn, or inactive participants
    const isDisqualified = participant && ((participant as any).status === 'DISQUALIFIED' || (participant as any).participantStatus === 'DISQUALIFIED');
    const isWithdrawn = participant && ((participant as any).status === 'WITHDRAWN' || (participant as any).participantStatus === 'WITHDRAWN');
    const isEliminated = (participant && (participant.eliminated === true || (participant as any).status === 'ELIMINATED')) ||
                         (team && team.status === 'ELIMINATED' && !participant);

    if (isDisqualified || isWithdrawn || isEliminated) {
      continue;
    }

    // Active participant in an ACTIVE_LIKE or ON_HOLD tournament
    activeTournamentIds.add(tourney.id);
    activeParticipantTournamentIds.add(tourney.id);

    const isCaptain = 
      participant?.tournamentRole === 'CAPTAIN' || 
      Boolean((participant as any)?.isCaptain) ||
      Boolean(team && (team.captainUserId === userId || (team as any).captainId === userId || (participant && ((team as any).captainId === participant.userId || (team as any).captainId === (participant as any).pbgId))));

    if (isCaptain) {
      activeCaptainTournamentIds.add(tourney.id);
    }

    qualifyingTournaments.push({
      tournamentId: tourney.id,
      tournamentName: tourney.name || tourney.id,
      lifecycleCategory: category,
      isCaptain,
      teamId: participant?.teamId || team?.id || (team as any)?.teamId || null,
      teamName: team?.name || null,
      teamRoleId: team?.discord?.roleId || null
    });
  }

  const pIds = Array.from(activeParticipantTournamentIds);
  const cIds = Array.from(activeCaptainTournamentIds);

  return {
    userId,
    activeTournamentIds: Array.from(activeTournamentIds),
    activeParticipantTournamentIds: pIds,
    activeCaptainTournamentIds: cIds,
    shouldHavePbgPlayer: pIds.length > 0,
    shouldHavePbgCaptain: cIds.length > 0,
    qualifyingTournaments
  };
}

export interface DesiredGlobalDiscordRolesResult {
  userId: string;
  discordUserId?: string;
  discordLinked: boolean;
  pbgMemberActive: boolean;
  shouldHavePbgPlayer: boolean;
  shouldHavePbgCaptain: boolean;
  desiredRoleIds: string[];
  undesiredRoleIds: string[];
  activeTeamRoleIds: string[];
  staleTeamRoleIds: string[];
  roleDetails: DesiredRoleItem[];
  entitlements: UserTournamentRoleEntitlements;
}

/**
 * Calculates global desired Discord roles for a user across all tournaments.
 * Implements:
 * - PBG Member: Persistent platform role, preserved at all times when Discord is linked.
 * - PBG Player: Desired if user is an active participant in >= 1 ACTIVE_LIKE or ON_HOLD tournament.
 * - PBG Captain: Desired if user is an active captain in >= 1 ACTIVE_LIKE or ON_HOLD tournament.
 * - Dynamic Team Roles: Tournament-specific, retained while team is active, removed on elimination/terminal.
 */
export function getDesiredGlobalDiscordRolesForUser(params: {
  userId: string;
  discordLink: {
    discordUserId?: string;
    discordLinked: boolean;
    pbgMemberRoleActive?: boolean;
  };
  tournaments: TournamentLifecycleContext[];
  pbgMemberRoleId?: string;
  pbgPlayerRoleId?: string;
  pbgCaptainRoleId?: string;
}): DesiredGlobalDiscordRolesResult {
  const { userId, discordLink, tournaments } = params;

  const pbgMemberRoleId = params.pbgMemberRoleId || process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
  const pbgPlayerRoleId = params.pbgPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID;
  const pbgCaptainRoleId = params.pbgCaptainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID;

  const entitlements = getUserTournamentRoleEntitlementsFromContexts(userId, tournaments);

  const desiredRoleIds = new Set<string>();
  const undesiredRoleIds = new Set<string>();
  const roleDetails: DesiredRoleItem[] = [];

  const activeTeamRoleIds: string[] = [];
  const staleTeamRoleIds: string[] = [];

  // 1. Persistent Role: PBG Member (NEVER remove while Discord is linked)
  if (discordLink.discordLinked && pbgMemberRoleId) {
    desiredRoleIds.add(pbgMemberRoleId);
    roleDetails.push({
      roleId: pbgMemberRoleId,
      roleName: 'PBG Member',
      category: 'PERSISTENT'
    });
  }

  // If Discord is not linked, no temporary tournament roles apply
  if (!discordLink.discordLinked || !discordLink.discordUserId) {
    return {
      userId,
      discordUserId: undefined,
      discordLinked: false,
      pbgMemberActive: false,
      shouldHavePbgPlayer: false,
      shouldHavePbgCaptain: false,
      desiredRoleIds: [],
      undesiredRoleIds: [pbgPlayerRoleId, pbgCaptainRoleId].filter(Boolean),
      activeTeamRoleIds: [],
      staleTeamRoleIds: [],
      roleDetails: [],
      entitlements
    };
  }

  // 2. Global PBG Player Role
  if (entitlements.shouldHavePbgPlayer && pbgPlayerRoleId) {
    desiredRoleIds.add(pbgPlayerRoleId);
    roleDetails.push({
      roleId: pbgPlayerRoleId,
      roleName: 'PBG Player',
      category: 'TOURNAMENT'
    });
  } else if (pbgPlayerRoleId) {
    undesiredRoleIds.add(pbgPlayerRoleId);
  }

  // 3. Global PBG Captain Role
  if (entitlements.shouldHavePbgCaptain && pbgCaptainRoleId) {
    desiredRoleIds.add(pbgCaptainRoleId);
    roleDetails.push({
      roleId: pbgCaptainRoleId,
      roleName: 'PBG Captain',
      category: 'TOURNAMENT'
    });
  } else if (pbgCaptainRoleId) {
    undesiredRoleIds.add(pbgCaptainRoleId);
  }

  // 4. Dynamic Team Roles (Tournament-Specific)
  // Collect all known team roles for this user across all passed tournaments
  for (const tourney of tournaments) {
    const isTerminal = classifyTournamentLifecycle(tourney) === 'TERMINAL';
    const participant = tourney.participants?.find(p => p.userId === userId);

    for (const team of (tourney.teams || [])) {
      const isMember = team.roster?.includes(userId) || (participant && participant.teamId === team.id);
      if (!isMember || !team.discord?.roleId) continue;

      const teamRoleId = team.discord.roleId;
      const isEliminated = team.status === 'ELIMINATED' || participant?.eliminated === true;

      if (!isTerminal && !isEliminated && shouldTournamentGrantTemporaryDiscordRoles(tourney)) {
        desiredRoleIds.add(teamRoleId);
        activeTeamRoleIds.push(teamRoleId);
        roleDetails.push({
          roleId: teamRoleId,
          roleName: team.discord.roleName || team.name,
          category: 'TEAM'
        });
      } else {
        undesiredRoleIds.add(teamRoleId);
        staleTeamRoleIds.push(teamRoleId);
      }
    }
  }

  return {
    userId,
    discordUserId: discordLink.discordUserId,
    discordLinked: true,
    pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
    shouldHavePbgPlayer: entitlements.shouldHavePbgPlayer,
    shouldHavePbgCaptain: entitlements.shouldHavePbgCaptain,
    desiredRoleIds: Array.from(desiredRoleIds),
    undesiredRoleIds: Array.from(undesiredRoleIds),
    activeTeamRoleIds,
    staleTeamRoleIds,
    roleDetails,
    entitlements
  };
}

export interface TournamentDiscordCleanupReport {
  tournamentId: string;
  status: string;
  participantsProcessed: number;
  teamRolesRemoved: number;
  teamRolesDeleted: number;
  globalPlayerRolesKept: number;
  globalPlayerRolesRemoved: number;
  globalCaptainRolesKept: number;
  globalCaptainRolesRemoved: number;
  skippedTestIdentities: number;
  failures: Array<{ userId?: string; roleId?: string; error: string }>;
}

/**
 * Global helper: alias for calculating user entitlements across multi-tournament contexts.
 */
export function getUserTournamentRoleEntitlements(
  userId: string,
  tournaments: TournamentLifecycleContext[] = []
): UserTournamentRoleEntitlements {
  return getUserTournamentRoleEntitlementsFromContexts(userId, tournaments);
}
