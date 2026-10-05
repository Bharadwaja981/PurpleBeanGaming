/**
 * Purple Bean Gaming — Server-Authoritative Tournament Auction Operations
 * 
 * End-to-end execution of:
 * - Authoritative Auction Start Gate (validateAuctionReadiness)
 * - Authoritative Captain and Player Pool Initialization
 * - Server-side Captain Authorization
 * - Transaction-safe Bidding & Mathematical Reserve Validation
 * - Completed Primary Team Suspension
 * - Sold / Unsold / Unselected State Transitions
 * - Stand-in Phase Lifecycle
 * - Team Finalization & Discord Team Role Integration
 * - Audited Organizer Correction Tools
 */

import { getAdminDb } from './firebaseAdmin';
import {
  TournamentParticipantRecord,
  TournamentRegistrationRecord,
  TournamentTeamRecord,
  validateAuctionReadiness
} from '../domain/tournamentRegistrationEngine';
import {
  AuthoritativeAuctionSession,
  AuthoritativeAuctionTeam,
  AuthoritativeAuctionPlayer,
  AuthoritativeNomination,
  AuthoritativeBidRecord,
  AuthoritativeAuctionEvent,
  AuctionConfig,
  DEFAULT_AUCTION_CONFIG,
  calculateTournamentAverageMMR,
  calculateTeamMMR,
  validateBidFeasibility,
  validateAuctionRuntimeIntegrity,
  AuctionRuntimeIntegrityResult,
  canRecallUnsold
} from '../domain/tournamentAuctionEngine';
import {
  inMemoryRegistrations,
  inMemoryCaptains,
  inMemoryLifecycles
} from './tournamentRegistrationOperations';
import {
  inMemoryParticipants,
  inMemoryTournamentTeams,
  syncDiscordTournamentRoles,
  createDiscordTeamRoleAuthoritative
} from './discordTournamentSyncService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { removeUndefinedDeep } from '../utils/sanitizeFirestore';
import { isTestTournament } from '../domain/tournamentDiscovery';

// In-memory sessions store: tournamentId -> AuthoritativeAuctionSession
export const inMemoryAuctionSessions = new Map<string, AuthoritativeAuctionSession>();

// Per-tournament async mutex lock to ensure atomic, serialized bid & lot transactions
export const tournamentAuctionLocks = new Map<string, Promise<any>>();

export function clearAuctionLocks(): void {
  tournamentAuctionLocks.clear();
}

async function withAuctionLock<T>(tournamentId: string, fn: () => Promise<T>): Promise<T> {
  const current = tournamentAuctionLocks.get(tournamentId) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  tournamentAuctionLocks.set(tournamentId, next);
  await current.catch(() => {});
  try {
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Resolves server-side captain authorization strictly from participant records and team ownership.
 * Never relies on client-side booleans.
 */
export function resolveCaptainAuthorization(params: {
  tournamentId: string;
  actorUserId: string;
  session?: AuthoritativeAuctionSession;
}): {
  authorized: boolean;
  captain?: TournamentParticipantRecord;
  team?: AuthoritativeAuctionTeam;
  error?: string;
} {
  const { tournamentId, actorUserId, session } = params;

  const pMap = inMemoryParticipants.get(tournamentId);
  const participant = pMap?.get(actorUserId);

  if (!participant || participant.participantStatus !== 'ACTIVE') {
    return { authorized: false, error: 'NOT_A_PARTICIPANT: User is not an active participant in this tournament.' };
  }

  if (participant.tournamentRole !== 'CAPTAIN' || !participant.captainSlotId) {
    return { authorized: false, error: 'NOT_A_CAPTAIN: Participant does not hold an authorized captain role.' };
  }

  // Find team owned by this captain
  const currentSession = session || inMemoryAuctionSessions.get(tournamentId);
  if (!currentSession) {
    return { authorized: false, error: 'AUCTION_NOT_INITIALIZED: No active auction session found.' };
  }

  const team = Object.values(currentSession.teams).find(t => t.captainUserId === actorUserId);
  if (!team) {
    return { authorized: false, error: 'NO_TEAM_OWNED: Captain does not possess an authorized auction team slot.' };
  }

  return {
    authorized: true,
    captain: participant,
    team
  };
}

/**
 * -------------------------------------------------------------
 * 1. AUCTION START GATE & INITIALIZATION
 * -------------------------------------------------------------
 */
export async function startAuctionSessionAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  targetCaptainCount?: number;
  configOverride?: Partial<AuctionConfig> & { targetCaptainCount?: number };
}): Promise<{
  session: AuthoritativeAuctionSession;
  integrity: AuctionRuntimeIntegrityResult;
}> {
  const { tournamentId, actorUserId, configOverride } = params;

  return await withAuctionLock(tournamentId, async () => {
    // 1. Enforce AUCTION_READY Gate
    const regMap = inMemoryRegistrations.get(tournamentId) || new Map();
    const pMap = inMemoryParticipants.get(tournamentId) || new Map();
    const isTest = isTestTournament(tournamentId) || (configOverride as any)?.testMode === true;
    const lifecycle = inMemoryLifecycles.get(tournamentId) || (isTest ? 'REGISTRATION_CLOSED' : 'REGISTRATION_OPEN');

    const registrations = Array.from(regMap.values());
    const participants = Array.from(pMap.values());

    const activeCaptains = participants.filter(p => p.participantStatus === 'ACTIVE' && p.tournamentRole === 'CAPTAIN');
    const targetCaptainCount = params.targetCaptainCount ?? 
      (configOverride as any)?.targetCaptainCount ?? 
      (activeCaptains.length >= 2 ? activeCaptains.length : 4);

    const readiness = validateAuctionReadiness({
      lifecycle,
      registrations,
      participants,
      targetCaptainCount,
      testMode: isTest
    });

    if (!readiness.isReady) {
      const errorMsg = `AUCTION_GATE_BLOCKED: Tournament is not ready for auction. Blockers: ${readiness.blockers.map(b => b.code).join(', ')}`;
      const err: any = new Error(errorMsg);
      err.blockers = readiness.blockers;
      err.readiness = readiness;
      throw err;
    }

    // 2. Build Authoritative Captain Teams
    // Captains MUST come only from participants where:
    // participantStatus == ACTIVE && tournamentRole == CAPTAIN && captainSlotId != null && auctionStatus == NOT_IN_POOL && teamId == null
    const validCaptains = participants.filter(p => 
      p.participantStatus === 'ACTIVE' &&
      p.tournamentRole === 'CAPTAIN' &&
      p.captainSlotId !== null &&
      p.auctionStatus === 'NOT_IN_POOL' &&
      p.teamId === null
    );

    if (validCaptains.length < 2) {
      throw new Error(`INSUFFICIENT_CAPTAINS: Auction requires at least 2 valid captains (found ${validCaptains.length}).`);
    }

    // 3. Build Authoritative Auction Player Pool
    // Pool MUST come only from participants where:
    // participantStatus == ACTIVE && tournamentRole == PLAYER && auctionStatus == AVAILABLE && teamId == null && eliminated == false
    const validPoolPlayers = participants.filter(p =>
      p.participantStatus === 'ACTIVE' &&
      p.tournamentRole === 'PLAYER' &&
      p.auctionStatus === 'AVAILABLE' &&
      p.teamId === null &&
      !p.eliminated
    );

    if (validPoolPlayers.length === 0) {
      throw new Error('EMPTY_AUCTION_POOL: No available players found in tournament participant pool.');
    }

    const config: AuctionConfig = {
      ...DEFAULT_AUCTION_CONFIG,
      ...configOverride,
      tournamentId
    };

    // Calculate Tournament Average MMR & Target Range
    const { averageMMR, targetRange } = calculateTournamentAverageMMR({
      participants,
      registrations
    });

    // Build teams
    const teamsRecord: Record<string, AuthoritativeAuctionTeam> = {};
    const playersRecord: Record<string, AuthoritativeAuctionPlayer> = {};

    for (const cap of validCaptains) {
      const teamId = `team-${tournamentId}-${cap.captainSlotId}`;
      const reg = registrations.find(r => r.userId === cap.userId);
      const capMMR = reg?.tournamentMMR || reg?.declaredMMR || averageMMR;

      // Add captain as unpurchased player entity
      playersRecord[cap.userId] = {
        id: cap.userId,
        userId: cap.userId,
        pbgId: cap.pbgId,
        displayName: cap.displayName,
        tournamentMMR: capMMR,
        primaryRole: reg?.primaryRole || 'Position 1 — Carry',
        secondaryRole: reg?.secondaryRole,
        status: 'SOLD', // Captain is locked in own team
        teamId,
        soldAmount: 0,
        soldToTeamId: teamId
      };

      teamsRecord[teamId] = {
        teamId,
        tournamentId,
        captainUserId: cap.userId,
        captainSlotId: cap.captainSlotId!,
        name: `${cap.displayName}'s Squad`,
        tag: (cap.displayName.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'PBG').toUpperCase(),
        logo: '🛡️',
        color: '#7C3AED',
        purseTotal: config.pursePerTeam,
        purseRemaining: config.pursePerTeam,
        primaryRosterUserIds: [cap.userId], // Captain counts as 1 of 5
        standInUserIds: [],
        primaryRosterComplete: false,
        standInComplete: false,
        teamMMR: capMMR,
        targetMMRRange: targetRange,
        status: 'ACTIVE',
        updatedAt: new Date().toISOString()
      };
    }

    // Build available pool players
    for (const player of validPoolPlayers) {
      const reg = registrations.find(r => r.userId === player.userId);
      playersRecord[player.userId] = {
        id: player.userId,
        userId: player.userId,
        pbgId: player.pbgId,
        displayName: player.displayName,
        tournamentMMR: reg?.tournamentMMR || reg?.declaredMMR || averageMMR,
        primaryRole: reg?.primaryRole || 'Position 1 — Carry',
        secondaryRole: reg?.secondaryRole,
        status: 'AVAILABLE',
        teamId: null
      };
    }

    const now = new Date().toISOString();
    const startEvent: AuthoritativeAuctionEvent = {
      eventId: `evt_${Date.now()}_start`,
      sequenceNumber: 1,
      timestamp: now,
      actorUserId,
      type: 'AUCTION_STARTED',
      payload: {
        tournamentId,
        totalCaptains: validCaptains.length,
        totalPool: validPoolPlayers.length,
        averageMMR,
        targetRange
      }
    };

    const session: AuthoritativeAuctionSession = {
      tournamentId,
      status: 'LIVE',
      currentPhase: 'PRIMARY',
      currentNomination: null,
      config,
      averageParticipantMMR: averageMMR,
      teamTargetMMRRange: targetRange,
      teams: teamsRecord,
      players: playersRecord,
      bidHistory: [],
      events: [startEvent],
      startedAt: now,
      updatedAt: now,
      revision: 1
    };

    const integrity = validateAuctionRuntimeIntegrity(session);
    if (!integrity.valid) {
      throw new Error(`AUCTION_INTEGRITY_FAILED: ${integrity.blockers.join(', ')}`);
    }

    inMemoryAuctionSessions.set(tournamentId, session);

    // Persist to Firestore (in production/staging only, bypass during unit/integration tests)
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      try {
        const db = getAdminDb();
        if (db) {
          await db.collection(`tournaments/${tournamentId}/auction`).doc('current').set(removeUndefinedDeep({
            status: session.status,
            currentPhase: session.currentPhase,
            config: session.config,
            averageParticipantMMR: session.averageParticipantMMR,
            teamTargetMMRRange: session.teamTargetMMRRange,
            startedAt: session.startedAt,
            updatedAt: session.updatedAt,
            revision: session.revision
          }));

          for (const t of Object.values(session.teams)) {
            await db.collection(`tournaments/${tournamentId}/auctionTeams`).doc(t.teamId).set(removeUndefinedDeep(t));
          }
          for (const p of Object.values(session.players)) {
            await db.collection(`tournaments/${tournamentId}/auctionPlayers`).doc(p.userId).set(removeUndefinedDeep(p));
          }
          await db.collection(`tournaments/${tournamentId}/auctionEvents`).doc(startEvent.eventId).set(removeUndefinedDeep(startEvent));
        }
      } catch (err: any) {
        console.warn('[startAuctionSession] Firestore write note:', err.message);
      }
    }

    return { session, integrity };
  });
}

/**
 * -------------------------------------------------------------
 * 2. NOMINATION FLOW
 * -------------------------------------------------------------
 */
export async function nominatePlayerAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  playerId: string;
  openingBid?: number;
  isOrganiserOverride?: boolean;
}): Promise<AuthoritativeAuctionSession> {
  const { tournamentId, actorUserId, playerId, openingBid, isOrganiserOverride } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    if (session.status !== 'LIVE' && session.status !== 'STANDIN_PHASE') {
      throw new Error(`AUCTION_NOT_LIVE: Cannot nominate while auction is ${session.status}.`);
    }

    if (session.currentNomination) {
      throw new Error(`NOMINATION_ACTIVE: Player ${session.currentNomination.nominatedPlayerId} is currently on the auction block.`);
    }

    // Verify nominator authorization
    let nominatingCaptainId = actorUserId;
    let nominatingTeamId: string | undefined;

    if (!isOrganiserOverride) {
      const auth = resolveCaptainAuthorization({ tournamentId, actorUserId, session });
      if (!auth.authorized || !auth.team) {
        throw new Error(auth.error || 'UNAUTHORIZED: Only franchise captains can nominate players.');
      }

      // Check if captain's team is suspended from primary bidding
      if (session.currentPhase === 'PRIMARY' && auth.team.primaryRosterUserIds.length >= session.config.primaryRosterSize) {
        throw new Error(`TEAM_SUSPENDED: Team ${auth.team.name} has completed primary roster and cannot nominate in primary phase.`);
      }
      nominatingTeamId = auth.team.teamId;
    }

    const player = session.players[playerId];
    if (!player) {
      throw new Error(`PLAYER_NOT_FOUND: Player ${playerId} is not in the tournament auction pool.`);
    }

    if (player.status !== 'AVAILABLE') {
      throw new Error(`INVALID_PLAYER_STATUS: Cannot nominate player with status ${player.status}.`);
    }

    const bid = openingBid && openingBid >= session.config.minimumBid ? openingBid : session.config.minimumBid;
    const now = new Date().toISOString();
    const duration = session.config.nominationTimerSeconds || 30;

    const nomination: AuthoritativeNomination = {
      nominatedPlayerId: playerId,
      nominatedByCaptainId: nominatingCaptainId,
      nominatedAt: now,
      openingBid: bid,
      currentBid: bid,
      currentLeaderCaptainId: nominatingTeamId ? nominatingCaptainId : undefined,
      currentLeaderTeamId: nominatingTeamId,
      bidCount: nominatingTeamId ? 1 : 0,
      expiresAt: Date.now() + duration * 1000,
      phase: session.currentPhase === 'STAND_IN' ? 'STAND_IN' : 'PRIMARY'
    };

    player.status = 'NOMINATED';
    player.nominatedAt = now;
    session.currentNomination = nomination;
    session.revision++;
    session.updatedAt = now;

    // Record nomination event
    const event: AuthoritativeAuctionEvent = {
      eventId: `evt_${Date.now()}_nominate`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'PLAYER_NOMINATED',
      payload: {
        nomination,
        player
      }
    };
    session.events.push(event);

    return session;
  });
}

/**
 * -------------------------------------------------------------
 * 3. TRANSACTION-SAFE BIDDING
 * -------------------------------------------------------------
 */
export async function placeBidAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  bidAmount: number;
}): Promise<{
  session: AuthoritativeAuctionSession;
  bidRecord: AuthoritativeBidRecord;
}> {
  const { tournamentId, actorUserId, bidAmount } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const nomination = session.currentNomination;
    if (!nomination) {
      throw new Error('NO_ACTIVE_NOMINATION: No player is currently on the auction block.');
    }

    const auth = resolveCaptainAuthorization({ tournamentId, actorUserId, session });
    if (!auth.authorized || !auth.team) {
      throw new Error(auth.error || 'UNAUTHORIZED: Only franchise captains can place bids.');
    }

    const team = auth.team;
    if (nomination.currentLeaderTeamId === team.teamId) {
      throw new Error('ALREADY_HIGH_BIDDER: Your team is already holding the winning bid.');
    }

    const candidatePlayer = session.players[nomination.nominatedPlayerId];
    if (!candidatePlayer) {
      throw new Error('NOMINEE_NOT_FOUND: Nominated player record not found.');
    }

    // Validate feasibility (purse, reserve rule, suspension, MMR bounds)
    const feasibility = validateBidFeasibility({
      session,
      team,
      bidAmount,
      candidatePlayer
    });
    if (!feasibility.valid) {
      throw new Error(`BID_REJECTED: ${feasibility.reason}`);
    }

    const now = new Date().toISOString();
    const bidRecord: AuthoritativeBidRecord = {
      bidId: `bid_${Date.now()}_${team.teamId}`,
      tournamentId,
      auctionId: session.tournamentId,
      playerId: candidatePlayer.userId,
      captainUserId: actorUserId,
      teamId: team.teamId,
      amount: bidAmount,
      createdAt: now
    };

    // Update nomination
    nomination.currentBid = bidAmount;
    nomination.currentLeaderCaptainId = actorUserId;
    nomination.currentLeaderTeamId = team.teamId;
    nomination.bidCount++;
    // Extend timer if less than 5 seconds remaining
    const timeLeft = nomination.expiresAt - Date.now();
    if (timeLeft < 5000) {
      nomination.expiresAt = Date.now() + 5000;
    }

    session.bidHistory.push(bidRecord);
    session.revision++;
    session.updatedAt = now;

    // Record Event
    const event: AuthoritativeAuctionEvent = {
      eventId: `evt_${Date.now()}_bid`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'BID_PLACED',
      payload: {
        bid: bidRecord,
        teamName: team.name,
        playerName: candidatePlayer.displayName
      }
    };
    session.events.push(event);

    return { session, bidRecord };
  });
}

/**
 * -------------------------------------------------------------
 * 4. SOLD / UNSOLD RESOLUTION (HAMMER STRIKE)
 * -------------------------------------------------------------
 */
export async function finalizeNominationLotAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  forceUnsold?: boolean;
}): Promise<{
  session: AuthoritativeAuctionSession;
  result: 'SOLD' | 'UNSOLD';
  player: AuthoritativeAuctionPlayer;
  team?: AuthoritativeAuctionTeam;
}> {
  const { tournamentId, actorUserId, forceUnsold } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const nomination = session.currentNomination;
    if (!nomination) {
      throw new Error('NO_ACTIVE_NOMINATION: No player is currently on the auction block.');
    }

    const player = session.players[nomination.nominatedPlayerId];
    if (!player) {
      throw new Error('NOMINEE_NOT_FOUND: Nominated player record not found.');
    }

    const now = new Date().toISOString();

    // 1. SOLD FLOW: Valid leader team exists and not forced unsold
    if (nomination.currentLeaderTeamId && !forceUnsold) {
      const team = session.teams[nomination.currentLeaderTeamId];
      if (!team) {
        throw new Error('WINNING_TEAM_NOT_FOUND: Winning team record was not found.');
      }

      const winningAmount = nomination.currentBid;
      team.purseRemaining = Math.max(0, team.purseRemaining - winningAmount);

      player.status = 'SOLD';
      player.teamId = team.teamId;
      player.soldAmount = winningAmount;
      player.soldToTeamId = team.teamId;
      player.soldAt = now;

      if (session.currentPhase === 'PRIMARY') {
        team.primaryRosterUserIds.push(player.userId);
        if (team.primaryRosterUserIds.length >= session.config.primaryRosterSize) {
          team.primaryRosterComplete = true;
          session.events.push({
            eventId: `evt_${Date.now()}_team_complete`,
            sequenceNumber: session.events.length + 1,
            timestamp: now,
            actorUserId,
            type: 'TEAM_PRIMARY_COMPLETE',
            payload: { teamId: team.teamId, teamName: team.name }
          });
        }
      } else if (session.currentPhase === 'STAND_IN') {
        player.isStandIn = true;
        team.standInUserIds.push(player.userId);
        team.standInComplete = true;
      }

      // Recompute Team MMR
      team.teamMMR = calculateTeamMMR(team.primaryRosterUserIds, session.players);
      team.updatedAt = now;

      // Update Participant record in tournament
      const pMap = inMemoryParticipants.get(tournamentId);
      if (pMap?.has(player.userId)) {
        const participant = pMap.get(player.userId)!;
        participant.auctionStatus = 'SOLD';
        participant.teamId = team.teamId;
        participant.updatedAt = now;
      }

      // Clear current nomination
      session.currentNomination = null;
      session.revision++;
      session.updatedAt = now;

      // Check if ALL teams completed primary rosters
      const allPrimaryComplete = Object.values(session.teams).every(
        t => t.primaryRosterUserIds.length >= session.config.primaryRosterSize
      );

      if (allPrimaryComplete && session.currentPhase === 'PRIMARY') {
        session.status = 'PRIMARY_ROSTERS_COMPLETE';
        session.events.push({
          eventId: `evt_${Date.now()}_all_primary_complete`,
          sequenceNumber: session.events.length + 1,
          timestamp: now,
          actorUserId,
          type: 'ALL_PRIMARY_COMPLETE',
          payload: { totalTeams: Object.keys(session.teams).length }
        });
      }

      // Record Event
      session.events.push({
        eventId: `evt_${Date.now()}_sold`,
        sequenceNumber: session.events.length + 1,
        timestamp: now,
        actorUserId,
        type: session.currentPhase === 'STAND_IN' ? 'STANDIN_SOLD' : 'PLAYER_SOLD',
        payload: {
          playerId: player.userId,
          playerName: player.displayName,
          teamId: team.teamId,
          teamName: team.name,
          amount: winningAmount,
          phase: session.currentPhase
        }
      });

      return { session, result: 'SOLD', player, team };
    }

    // 2. UNSOLD FLOW: No winning bid
    player.status = 'UNSOLD';
    player.teamId = null;
    player.soldAmount = undefined;
    player.soldToTeamId = undefined;

    session.currentNomination = null;
    session.revision++;
    session.updatedAt = now;

    session.events.push({
      eventId: `evt_${Date.now()}_unsold`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'PLAYER_UNSOLD',
      payload: {
        playerId: player.userId,
        playerName: player.displayName
      }
    });

    return { session, result: 'UNSOLD', player };
  });
}

/**
 * -------------------------------------------------------------
 * 5. REINTRODUCE UNSOLD PLAYER
 * -------------------------------------------------------------
 * Rule: UNSOLD re-auction begins only after ALL normal AVAILABLE pool players
 * have been resolved to SOLD or UNSOLD.
 */
export async function reintroduceUnsoldPlayerAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  playerId: string;
  forceOverride?: boolean;
}): Promise<AuthoritativeAuctionSession> {
  const { tournamentId, actorUserId, playerId, forceOverride } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const player = session.players[playerId];
    if (!player) {
      throw new Error('PLAYER_NOT_FOUND: Player not found.');
    }

    if (player.status !== 'UNSOLD') {
      throw new Error(`INVALID_STATUS: Player status is ${player.status}, expected UNSOLD.`);
    }

    const recallCheck = canRecallUnsold(session, playerId, { forceOverride });
    if (!recallCheck.allowed && !forceOverride) {
      throw new Error(recallCheck.reason || 'RECALL_NOT_ALLOWED');
    }

    const now = new Date().toISOString();
    player.status = 'AVAILABLE';
    session.revision++;
    session.updatedAt = now;

    session.events.push({
      eventId: `evt_${Date.now()}_reintroduced`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'PLAYER_REINTRODUCED',
      payload: {
        playerId: player.userId,
        playerName: player.displayName,
        forced: Boolean(forceOverride)
      }
    });

    return session;
  });
}

/**
 * -------------------------------------------------------------
 * 6. STAND-IN PHASE
 * -------------------------------------------------------------
 * Stand-in bidding starts only after primary rosters are complete for every team.
 */
export async function startStandInPhaseAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
}): Promise<AuthoritativeAuctionSession> {
  const { tournamentId, actorUserId } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const allPrimaryComplete = Object.values(session.teams).every(
      t => t.primaryRosterUserIds.length >= session.config.primaryRosterSize
    );

    if (!allPrimaryComplete) {
      throw new Error('PRIMARY_ROSTERS_INCOMPLETE: Stand-in phase requires all teams to complete primary 5-player rosters first.');
    }

    const now = new Date().toISOString();
    session.status = 'STANDIN_PHASE';
    session.currentPhase = 'STAND_IN';
    session.revision++;
    session.updatedAt = now;

    session.events.push({
      eventId: `evt_${Date.now()}_standin_phase`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'STANDIN_PHASE_STARTED',
      payload: { startedAt: now }
    });

    return session;
  });
}

/**
 * -------------------------------------------------------------
 * 7. AUCTION COMPLETION & UNSELECTED DISTINCTION
 * -------------------------------------------------------------
 * When auction completes:
 * Remaining untouched AVAILABLE players become UNSELECTED.
 * UNSOLD players remain UNSOLD.
 */
export async function handleAuctionCompletedAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
}): Promise<{
  session: AuthoritativeAuctionSession;
  totalSold: number;
  totalUnsold: number;
  totalUnselected: number;
}> {
  const { tournamentId, actorUserId } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const now = new Date().toISOString();
    let totalSold = 0;
    let totalUnsold = 0;
    let totalUnselected = 0;

    for (const player of Object.values(session.players)) {
      if (player.status === 'AVAILABLE') {
        // Untouched players become UNSELECTED
        player.status = 'UNSELECTED';
        totalUnselected++;
      } else if (player.status === 'UNSOLD') {
        // Preserves distinct UNSOLD status
        totalUnsold++;
      } else if (player.status === 'SOLD') {
        totalSold++;
      }
    }

    session.status = 'COMPLETED';
    session.currentPhase = 'COMPLETED';
    session.currentNomination = null;
    session.completedAt = now;
    session.updatedAt = now;
    session.revision++;

    session.events.push({
      eventId: `evt_${Date.now()}_completed`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'AUCTION_COMPLETED',
      payload: {
        totalSold,
        totalUnsold,
        totalUnselected,
        completedAt: now
      }
    });

    return { session, totalSold, totalUnsold, totalUnselected };
  });
}

/**
 * -------------------------------------------------------------
 * 8. TEAM FINALIZATION & DISCORD TEAM ROLE INTEGRATION
 * -------------------------------------------------------------
 */
export async function finalizeAuctionTeamsAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  fetchFn?: typeof fetch;
}): Promise<{
  finalizedTeams: TournamentTeamRecord[];
  discordRolesCreated: number;
}> {
  const { tournamentId, actorUserId, fetchFn = fetch } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const botToken = process.env.DISCORD_BOT_TOKEN || '';
    const guildId = process.env.DISCORD_GUILD_ID || '631715510631006219';

    const teamMap = inMemoryTournamentTeams.get(tournamentId) || new Map<string, TournamentTeamRecord>();
    inMemoryTournamentTeams.set(tournamentId, teamMap);

    const finalizedTeams: TournamentTeamRecord[] = [];
    let rolesCreated = 0;

    for (const [teamId, aTeam] of Object.entries(session.teams)) {
      aTeam.status = 'FINALIZED';
      aTeam.updatedAt = new Date().toISOString();

      let discordMapping = aTeam.discordRoleId ? {
        roleId: aTeam.discordRoleId,
        roleName: aTeam.name,
        createdAt: new Date().toISOString()
      } : undefined;

      // Create Discord role if not exists
      if (!discordMapping?.roleId) {
        const createRes = await createDiscordTeamRoleAuthoritative({
          guildId,
          teamName: aTeam.name,
          botToken,
          fetchFn
        });
        if (createRes.success && createRes.roleId) {
          discordMapping = {
            roleId: createRes.roleId,
            roleName: aTeam.name,
            createdAt: new Date().toISOString()
          };
          aTeam.discordRoleId = createRes.roleId;
          rolesCreated++;
        }
      }

      const teamRecord: TournamentTeamRecord = {
        id: aTeam.teamId,
        tournamentId,
        name: aTeam.name,
        tag: aTeam.tag,
        captainUserId: aTeam.captainUserId,
        roster: [...aTeam.primaryRosterUserIds, ...aTeam.standInUserIds],
        discord: discordMapping,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      teamMap.set(teamId, teamRecord);
      finalizedTeams.push(teamRecord);

      // Trigger centralized Discord synchronization for each team member
      for (const memberId of teamRecord.roster) {
        syncDiscordTournamentRoles({
          userId: memberId,
          tournamentId,
          overrideContext: {
            team: teamRecord
          },
          fetchFn
        }).catch(err => console.warn('[finalizeAuctionTeams] Discord sync note:', err));
      }

      // Persist to Firestore
      if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
        try {
          const db = getAdminDb();
          if (db) {
            await db.collection(`tournaments/${tournamentId}/teams`).doc(teamId).set(removeUndefinedDeep(teamRecord));
          }
        } catch {}
      }
    }

    return { finalizedTeams, discordRolesCreated: rolesCreated };
  });
}

/**
 * -------------------------------------------------------------
 * 9. TEAM CUSTOMIZATION (CAPTAIN ONLY)
 * -------------------------------------------------------------
 */
export async function updateTeamBrandingAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  teamId: string;
  branding: {
    name?: string;
    tag?: string;
    logo?: string;
    color?: string;
    bannerUrl?: string;
  };
  isOrganiser?: boolean;
}): Promise<AuthoritativeAuctionTeam> {
  const { tournamentId, actorUserId, teamId, branding, isOrganiser } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const team = session.teams[teamId];
    if (!team) {
      throw new Error('TEAM_NOT_FOUND: Auction team not found.');
    }

    if (!isOrganiser && team.captainUserId !== actorUserId) {
      throw new Error('UNAUTHORIZED: You can only customize your own team.');
    }

    if (branding.name) team.name = branding.name.trim();
    if (branding.tag) team.tag = branding.tag.trim().toUpperCase();
    if (branding.logo) team.logo = branding.logo;
    if (branding.color) team.color = branding.color;
    if (branding.bannerUrl) team.bannerUrl = branding.bannerUrl;
    team.updatedAt = new Date().toISOString();

    return team;
  });
}

/**
 * -------------------------------------------------------------
 * 10. AUDITED ORGANIZER CORRECTIONS
 * -------------------------------------------------------------
 */
export async function executeAuctionCorrectionAuthoritative(params: {
  tournamentId: string;
  actorUserId: string;
  action: 'ROLLBACK_SALE' | 'ADJUST_PURCHASE' | 'PAUSE' | 'RESUME';
  payload: Record<string, any>;
}): Promise<AuthoritativeAuctionSession> {
  const { tournamentId, actorUserId, action, payload } = params;

  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error('NOT_FOUND: No active auction session found.');
    }

    const now = new Date().toISOString();

    if (action === 'PAUSE') {
      session.status = 'PAUSED';
    } else if (action === 'RESUME') {
      session.status = session.currentPhase === 'STAND_IN' ? 'STANDIN_PHASE' : 'LIVE';
    } else if (action === 'ROLLBACK_SALE') {
      const { playerId, teamId } = payload;
      const player = session.players[playerId];
      const team = session.teams[teamId];
      if (player && team && player.status === 'SOLD') {
        const refunded = player.soldAmount || 0;
        team.purseRemaining += refunded;
        team.primaryRosterUserIds = team.primaryRosterUserIds.filter(id => id !== playerId);
        team.standInUserIds = team.standInUserIds.filter(id => id !== playerId);
        team.primaryRosterComplete = team.primaryRosterUserIds.length >= session.config.primaryRosterSize;
        team.teamMMR = calculateTeamMMR(team.primaryRosterUserIds, session.players);

        player.status = 'AVAILABLE';
        player.teamId = null;
        player.soldAmount = undefined;
        player.soldToTeamId = undefined;
      }
    } else if (action === 'ADJUST_PURCHASE') {
      const { playerId, teamId, newAmount } = payload;
      const player = session.players[playerId];
      const team = session.teams[teamId];
      if (player && team && typeof newAmount === 'number' && newAmount >= 0) {
        const diff = (player.soldAmount || 0) - newAmount;
        team.purseRemaining += diff;
        player.soldAmount = newAmount;
      }
    }

    session.revision++;
    session.updatedAt = now;

    session.events.push({
      eventId: `evt_${Date.now()}_correction`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: 'AUCTION_CORRECTION',
      payload: { action, payload }
    });

    return session;
  });
}
