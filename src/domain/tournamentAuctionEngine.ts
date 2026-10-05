/**
 * Purple Bean Gaming — Tournament Auction Integration Engine
 * 
 * Strict Domain Invariants:
 * 1. AUCTION INPUT CONTRACT:
 *    - Captains come exclusively from participants with:
 *      participantStatus == ACTIVE && tournamentRole == CAPTAIN && captainSlotId != null && auctionStatus == NOT_IN_POOL && teamId == null
 *    - Auction player pool comes exclusively from:
 *      participantStatus == ACTIVE && tournamentRole == PLAYER && auctionStatus == AVAILABLE && teamId == null && eliminated == false
 * 2. AUCTION START GATE:
 *    - validateAuctionReadiness(tournamentId) must return ready === true.
 * 3. AUCTION LIFECYCLE:
 *    - NOT_READY -> READY -> LIVE -> PAUSED -> PRIMARY_ROSTERS_COMPLETE -> STANDIN_PHASE -> COMPLETED -> CANCELLED
 * 4. AUCTION PLAYER STATES:
 *    - AVAILABLE -> NOMINATED -> SOLD | UNSOLD -> UNSELECTED (at completion)
 * 5. TEAM MODEL:
 *    - Primary roster target = 5 players (1 captain + 4 drafted primary players).
 *    - Optional stand-in = 0 to 1.
 * 6. TEAM TARGET MMR:
 *    - Tournament average MMR = sum(tournamentMMR of all active participants) / participantCount
 *    - Each team target range: lower = avg * 0.95, upper = avg * 1.05.
 * 7. SERVER-SIDE CAPTAIN AUTHORIZATION:
 *    - Firebase UID -> participant -> tournamentRole == CAPTAIN -> captainSlotId -> auction team -> authorized bidder.
 * 8. BID & PURSE RULES:
 *    - Reserve rule: purseRemaining - bid >= (remainingDraftSlots - 1) * minimumBid.
 *    - Completed primary team (5/5) is suspended from bidding until all teams complete primary rosters.
 * 9. STAND-IN PHASE:
 *    - Begins only after all teams have 5/5 primary rosters.
 * 10. COMPLETION & UNSELECTED:
 *    - Untouched pool players become UNSELECTED (never NOMINATED/SOLD). UNSOLD players retain UNSOLD status.
 */

import {
  TournamentParticipantRecord,
  TournamentRegistrationRecord,
  validateAuctionReadiness,
  AuctionReadinessReport
} from './tournamentRegistrationEngine';

export type AuctionLifecycleStatus = 
  | 'NOT_READY'
  | 'READY'
  | 'LIVE'
  | 'PAUSED'
  | 'PRIMARY_ROSTERS_COMPLETE'
  | 'STANDIN_PHASE'
  | 'COMPLETED'
  | 'CANCELLED';

export type AuctionPlayerRuntimeStatus = 
  | 'AVAILABLE'
  | 'NOMINATED'
  | 'SOLD'
  | 'UNSOLD'
  | 'UNSELECTED';

export interface AuctionConfig {
  tournamentId: string;
  tournamentName?: string;
  pursePerTeam: number;        // default: 1000
  minimumBid: number;          // default: 50
  bidIncrement: number;        // default: 10
  nominationTimerSeconds: number; // default: 30
  bidTimerSeconds: number;     // default: 25
  primaryRosterSize: number;   // default: 5 (1 captain + 4 drafted)
  standInLimit: number;        // default: 1
  minBidderReserve: number;    // calculated from (remainingSlots - 1) * minimumBid
  allowEarlyUnsoldRecall?: boolean;
}

export const DEFAULT_AUCTION_CONFIG: AuctionConfig = {
  tournamentId: '',
  pursePerTeam: 1000,
  minimumBid: 50,
  bidIncrement: 10,
  nominationTimerSeconds: 30,
  bidTimerSeconds: 25,
  primaryRosterSize: 5,
  standInLimit: 1,
  minBidderReserve: 50,
  allowEarlyUnsoldRecall: false
};

export interface AuthoritativeAuctionPlayer {
  id: string; // userId
  userId: string;
  pbgId: string;
  displayName: string;
  username?: string;
  avatar?: string;
  city?: string;
  region?: string;
  tournamentMMR: number;
  primaryRole: string;
  secondaryRole?: string;
  status: AuctionPlayerRuntimeStatus;
  teamId: string | null;
  soldAmount?: number;
  soldToTeamId?: string;
  soldAt?: string;
  nominatedAt?: string;
  isStandIn?: boolean;
}

export interface AuthoritativeAuctionTeam {
  teamId: string;
  tournamentId: string;
  captainUserId: string;
  captainSlotId: string;
  name: string;
  tag: string;
  logo?: string;
  color?: string;
  bannerUrl?: string;
  purseTotal: number;
  purseRemaining: number;
  primaryRosterUserIds: string[]; // max 5 (includes captainUserId)
  standInUserIds: string[];       // max 1
  primaryRosterComplete: boolean;
  standInComplete: boolean;
  teamMMR: number;
  targetMMRRange: {
    min: number;
    max: number;
    target: number;
  };
  discordRoleId?: string;
  status: 'ACTIVE' | 'FINALIZED';
  updatedAt: string;
}

export interface AuthoritativeNomination {
  nominatedPlayerId: string;
  nominatedByCaptainId: string;
  nominatedAt: string;
  openingBid: number;
  currentBid: number;
  currentLeaderCaptainId?: string;
  currentLeaderTeamId?: string;
  bidCount: number;
  expiresAt: number; // epoch ms
  phase: 'PRIMARY' | 'STAND_IN';
}

export interface AuthoritativeBidRecord {
  bidId: string;
  tournamentId: string;
  auctionId: string;
  playerId: string;
  captainUserId: string;
  teamId: string;
  amount: number;
  createdAt: string;
}

export type AuthoritativeAuctionEventType = 
  | 'AUCTION_STARTED'
  | 'PLAYER_NOMINATED'
  | 'BID_PLACED'
  | 'PLAYER_SOLD'
  | 'PLAYER_UNSOLD'
  | 'PLAYER_REINTRODUCED'
  | 'TEAM_PRIMARY_COMPLETE'
  | 'ALL_PRIMARY_COMPLETE'
  | 'STANDIN_PHASE_STARTED'
  | 'STANDIN_SOLD'
  | 'AUCTION_PAUSED'
  | 'AUCTION_RESUMED'
  | 'AUCTION_COMPLETED'
  | 'AUCTION_CORRECTION';

export interface AuthoritativeAuctionEvent {
  eventId: string;
  sequenceNumber: number;
  timestamp: string;
  actorUserId: string;
  type: AuthoritativeAuctionEventType;
  payload: Record<string, any>;
}

export interface AuthoritativeAuctionSession {
  tournamentId: string;
  status: AuctionLifecycleStatus;
  currentPhase: 'PRIMARY' | 'STAND_IN' | 'COMPLETED';
  currentNomination: AuthoritativeNomination | null;
  config: AuctionConfig;
  averageParticipantMMR: number;
  teamTargetMMRRange: {
    min: number;
    max: number;
    target: number;
  };
  teams: Record<string, AuthoritativeAuctionTeam>; // teamId -> team
  players: Record<string, AuthoritativeAuctionPlayer>; // userId -> player
  bidHistory: AuthoritativeBidRecord[];
  events: AuthoritativeAuctionEvent[];
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  revision: number;
}

export interface AuctionRuntimeIntegrityResult {
  valid: boolean;
  blockers: string[];
  warnings: string[];
}

/**
 * -------------------------------------------------------------
 * PURE BUSINESS RULES & CALCULATORS
 * -------------------------------------------------------------
 */

/**
 * Calculates Tournament Average MMR across all active participants (captains + players).
 * Target Range: Lower = 95% of average, Upper = 105% of average.
 */
export function calculateTournamentAverageMMR(params: {
  participants: TournamentParticipantRecord[];
  registrations: TournamentRegistrationRecord[];
}): {
  averageMMR: number;
  targetRange: { min: number; max: number; target: number };
} {
  const { participants, registrations } = params;
  const activeParticipants = participants.filter(p => p.participantStatus === 'ACTIVE');

  if (activeParticipants.length === 0) {
    return {
      averageMMR: 5000,
      targetRange: { min: 4750, max: 5250, target: 5000 }
    };
  }

  let totalMMR = 0;
  for (const p of activeParticipants) {
    const reg = registrations.find(r => r.userId === p.userId);
    const mmr = reg?.tournamentMMR || reg?.declaredMMR || 5000;
    totalMMR += mmr;
  }

  const averageMMR = Math.round(totalMMR / activeParticipants.length);
  const min = Math.round(averageMMR * 0.95);
  const max = Math.round(averageMMR * 1.05);

  return {
    averageMMR,
    targetRange: { min, max, target: averageMMR }
  };
}

/**
 * Calculates Team MMR for primary roster members.
 */
export function calculateTeamMMR(
  primaryRosterUserIds: string[],
  players: Record<string, AuthoritativeAuctionPlayer>
): number {
  if (primaryRosterUserIds.length === 0) return 0;
  let sum = 0;
  for (const uid of primaryRosterUserIds) {
    const p = players[uid];
    if (p) {
      sum += p.tournamentMMR || 0;
    }
  }
  return Math.round(sum / primaryRosterUserIds.length);
}

/**
 * Evaluates whether adding candidatePlayer to a team will violate target MMR range (Section 5).
 * Validates that upon completing 5 players, the team can remain within [targetRange.min, targetRange.max].
 */
export function validateTeamMMRFeasibility(params: {
  team: AuthoritativeAuctionTeam;
  candidatePlayer: AuthoritativeAuctionPlayer;
  targetRange: { min: number; max: number; target: number };
  players: Record<string, AuthoritativeAuctionPlayer>;
}): { feasible: boolean; projectedMMR: number; reason?: string } {
  const { team, candidatePlayer, targetRange, players } = params;

  const currentRoster = [...team.primaryRosterUserIds];
  if (currentRoster.includes(candidatePlayer.userId)) {
    return { feasible: true, projectedMMR: team.teamMMR };
  }

  const nextRoster = [...currentRoster, candidatePlayer.userId];
  const projectedMMR = calculateTeamMMR(nextRoster, {
    ...players,
    [candidatePlayer.userId]: candidatePlayer
  });

  // If primary roster will be full (5/5), check strict bounds
  if (nextRoster.length >= 5) {
    if (projectedMMR < targetRange.min) {
      return {
        feasible: false,
        projectedMMR,
        reason: `Projected team MMR (${projectedMMR}) falls below minimum tournament target bracket of ${targetRange.min}.`
      };
    }
    if (projectedMMR > targetRange.max) {
      return {
        feasible: false,
        projectedMMR,
        reason: `Projected team MMR (${projectedMMR}) exceeds maximum tournament target bracket of ${targetRange.max}.`
      };
    }
  }

  return { feasible: true, projectedMMR };
}

/**
 * Validates bid feasibility against purse, reserve rule, roster limit, and completed team suspension.
 */
export function validateBidFeasibility(params: {
  session: AuthoritativeAuctionSession;
  team: AuthoritativeAuctionTeam;
  bidAmount: number;
  candidatePlayer: AuthoritativeAuctionPlayer;
}): { valid: boolean; reason?: string } {
  const { session, team, bidAmount, candidatePlayer } = params;
  const config = session.config;

  // 1. Session must be LIVE
  if (session.status !== 'LIVE' && session.status !== 'STANDIN_PHASE') {
    return { valid: false, reason: `Auction is currently ${session.status}, bids are suspended.` };
  }

  // 2. Minimum Bid & Increment
  if (session.currentNomination) {
    const requiredMin = session.currentNomination.currentBid > 0 
      ? session.currentNomination.currentBid + config.bidIncrement
      : session.currentNomination.openingBid;

    if (bidAmount < requiredMin) {
      return { valid: false, reason: `Bid of ₹${bidAmount} is below required minimum of ₹${requiredMin}.` };
    }
  } else if (bidAmount < config.minimumBid) {
    return { valid: false, reason: `Bid of ₹${bidAmount} is below starting minimum bid of ₹${config.minimumBid}.` };
  }

  // 3. Team Purse Remaining
  if (bidAmount > team.purseRemaining) {
    return { valid: false, reason: `Insufficient credits: team has ₹${team.purseRemaining} remaining, bid requires ₹${bidAmount}.` };
  }

  // 4. Primary Phase vs Stand-in Phase
  if (session.currentPhase === 'PRIMARY') {
    // Check if team already completed primary roster
    if (team.primaryRosterUserIds.length >= config.primaryRosterSize) {
      return {
        valid: false,
        reason: `Team ${team.name} already has all ${config.primaryRosterSize} primary players and is suspended from primary bidding.`
      };
    }

    // Mathematical Reserve Rule:
    // Team must retain enough credits to afford all remaining mandatory slots at minimumBid
    // draftedCount = team.primaryRosterUserIds.length - 1 (excluding captain)
    // remainingDraftSlots = (config.primaryRosterSize - 1) - draftedCount
    const draftedCount = Math.max(0, team.primaryRosterUserIds.length - 1);
    const neededDraftSlots = (config.primaryRosterSize - 1) - draftedCount; // how many more to buy
    const remainingSlotsAfterThis = Math.max(0, neededDraftSlots - 1);
    const mandatoryReserve = remainingSlotsAfterThis * config.minimumBid;

    if (team.purseRemaining - bidAmount < mandatoryReserve) {
      return {
        valid: false,
        reason: `Reserve Rule: Team must retain ₹${mandatoryReserve} to purchase remaining ${remainingSlotsAfterThis} mandatory slot(s). Max allowable bid is ₹${team.purseRemaining - mandatoryReserve}.`
      };
    }

    // MMR Feasibility
    const mmrCheck = validateTeamMMRFeasibility({
      team,
      candidatePlayer,
      targetRange: session.teamTargetMMRRange,
      players: session.players
    });
    if (!mmrCheck.feasible) {
      return { valid: false, reason: mmrCheck.reason };
    }
  } else if (session.currentPhase === 'STAND_IN') {
    // Stand-in Phase
    if (team.standInUserIds.length >= config.standInLimit) {
      return { valid: false, reason: `Team ${team.name} already has maximum of ${config.standInLimit} stand-in.` };
    }
  }

  return { valid: true };
}

/**
 * Validates complete auction runtime integrity.
 */
export function validateAuctionRuntimeIntegrity(session: AuthoritativeAuctionSession): AuctionRuntimeIntegrityResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const teams = Object.values(session.teams);
  const players = Object.values(session.players);

  // 1. Unique Captains & Teams
  const seenCaptains = new Set<string>();
  const seenSlots = new Set<string>();
  for (const t of teams) {
    if (seenCaptains.has(t.captainUserId)) {
      blockers.push(`Duplicate captain ${t.captainUserId} owns multiple teams.`);
    }
    seenCaptains.add(t.captainUserId);

    if (seenSlots.has(t.captainSlotId)) {
      blockers.push(`Duplicate captain slot ${t.captainSlotId} detected.`);
    }
    seenSlots.add(t.captainSlotId);

    if (t.purseRemaining < 0) {
      blockers.push(`Team ${t.name} has negative purse balance (₹${t.purseRemaining}).`);
    }

    if (t.primaryRosterUserIds.length > session.config.primaryRosterSize) {
      blockers.push(`Team ${t.name} exceeds primary roster limit (${t.primaryRosterUserIds.length}/${session.config.primaryRosterSize}).`);
    }

    if (t.standInUserIds.length > session.config.standInLimit) {
      blockers.push(`Team ${t.name} exceeds stand-in limit (${t.standInUserIds.length}/${session.config.standInLimit}).`);
    }
  }

  // 2. Unique Player Assignment
  const assignedPlayers = new Map<string, string>();
  for (const t of teams) {
    for (const uid of t.primaryRosterUserIds) {
      if (assignedPlayers.has(uid)) {
        blockers.push(`Player ${uid} is assigned to multiple teams (${t.teamId} and ${assignedPlayers.get(uid)}).`);
      }
      assignedPlayers.set(uid, t.teamId);
    }
    for (const uid of t.standInUserIds) {
      if (assignedPlayers.has(uid)) {
        blockers.push(`Player ${uid} is assigned to multiple teams as stand-in.`);
      }
      assignedPlayers.set(uid, t.teamId);
    }
  }

  // 3. Captains never in auction pool
  for (const t of teams) {
    const p = session.players[t.captainUserId];
    if (p && p.status === 'AVAILABLE') {
      blockers.push(`Captain ${t.captainUserId} is erroneously present in the available auction pool.`);
    }
  }

  // 4. SOLD player consistency
  for (const p of players) {
    if (p.status === 'SOLD' && !p.teamId) {
      blockers.push(`Player ${p.displayName || p.userId} has status SOLD but no assigned teamId.`);
    }
    if ((p.status === 'AVAILABLE' || p.status === 'UNSOLD' || p.status === 'UNSELECTED') && p.teamId) {
      blockers.push(`Player ${p.displayName || p.userId} has status ${p.status} but possesses teamId ${p.teamId}.`);
    }
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings
  };
}

/**
 * PurpleBeanGaming Authoritative Rule:
 * UNSOLD players may be recalled only after all normal AVAILABLE players have been resolved to SOLD or UNSOLD.
 */
export function canRecallUnsold(
  session: AuthoritativeAuctionSession,
  playerId: string,
  options?: { forceOverride?: boolean }
): { allowed: boolean; reason?: string } {
  const player = session.players[playerId];
  if (!player) {
    return { allowed: false, reason: 'PLAYER_NOT_FOUND: Player not found in auction pool.' };
  }
  if (player.status !== 'UNSOLD') {
    return { allowed: false, reason: `INVALID_STATUS: Player status is ${player.status}, expected UNSOLD.` };
  }
  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    return { 
      allowed: false, 
      reason: 'AUCTION_COMPLETED: Auction is completed. Reopening the auction room is required to recall unsold players.' 
    };
  }
  // Allowed only when no normal AVAILABLE players remain
  const availableRemaining = Object.values(session.players).filter(p => p.status === 'AVAILABLE');
  if (availableRemaining.length > 0 && !options?.forceOverride) {
    return {
      allowed: false,
      reason: `AVAILABLE_POOL_NOT_EXHAUSTED: ${availableRemaining.length} normal AVAILABLE player(s) remain in the pool. UNSOLD re-auction begins only after all regular players are resolved.`
    };
  }
  // Roster / Stand-in constraints
  const allPrimaryComplete = Object.values(session.teams).every(
    t => t.primaryRosterUserIds.length >= (session.config.primaryRosterSize || 5)
  );
  if (allPrimaryComplete && session.status !== 'STANDIN_PHASE' && !options?.forceOverride) {
    return {
      allowed: false,
      reason: 'PRIMARY_ROSTERS_COMPLETE: Primary rosters are full (5/5). Stand-In auction phase must be active to recall players.'
    };
  }
  return { allowed: true };
}
