/**
 * Purple Bean Gaming — Trusted Server Authoritative Operations
 * 
 * Executes all high-integrity competition mutations on the trusted server.
 * Clients request operations; this layer authorizes, validates, and commits them,
 * appending immutable audit events and returning sanitized results.
 */

import { 
  Tournament, 
  Player, 
  Team, 
  Match, 
  AuctionTeamState, 
  BracketNode 
} from '../types/tournament';
import { 
  validateTournamentTransition, 
  TournamentStatus 
} from '../domain/tournamentStateMachine';
import { 
  getRosterConfigForGame, 
  validateBidRosterConstraint,
  validateStandInConstraints
} from '../domain/rosterRules';
import { 
  ratingLedger, 
  RatingAdjustmentRecord 
} from '../domain/competitiveRatingEngine';
import { 
  executeResultCorrection, 
  recompileGroupStandings, 
  MatchCorrectionResult 
} from '../domain/resultCorrectionEngine';
import { 
  dotaPlayerRegistry, 
  validateDotaRoles, 
  DotaRolePosition,
  DotaTournamentRegistration,
  PublicDotaPlayerProfile,
  PrivateDotaPlayerAccount,
  RegistrationEvidenceItem,
  EvidenceType,
  MmrIntegrityCase,
  MmrIntegrityCaseType
} from '../domain/dotaPlayerEngine';
import { 
  dotaAuctionEngine, 
  DotaAuctionPlayer, 
  DotaAuctionTeam, 
  DotaAuctionState 
} from '../domain/dotaAuctionEngine';
import {
  dotaPremadeTeamEngine,
  PremadeTeamRegistration,
  PremadeRosterSlot,
  HistoricalRosterSnapshot
} from '../domain/dotaPremadeTeamEngine';
import {
  dotaCompetitionEngine,
  CompetitionStructureState,
  SeedingMode,
  SeededTeam,
  CompetitionMatchNode
} from '../domain/dotaCompetitionEngine';
import {
  dotaMatchOperations,
  DotaMatchRecord,
  CheckInStatus,
  MatchDisputeRecord,
  OpenDotaReconciliationStatus,
  ReconciliationReviewFlag,
  DotaGameStatsDetail
} from '../domain/dotaMatchOperationsEngine';
import {
  dotaCareerHistoryEngine,
  CanonicalMatchRatingPayload
} from '../domain/dotaCareerHistoryEngine';
import {
  dotaTournamentOperations,
  TournamentRuleSection,
  TournamentAnnouncement,
  ReportCategory,
  ReportStatus,
  TournamentSanctionType,
  PlatformSanctionType
} from '../domain/dotaTournamentOperationsEngine';
import { normalizeDotaIdentity } from '../../lib/dota/ids';
import { db, isQuotaExhausted, isQuotaError, setQuotaExhausted } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

import { TournamentRole } from '../types/tournament';

export interface ServerCallerContext {
  userId: string;
  email: string;
  role: TournamentRole;
  teamId?: string;
  isAdmin?: boolean;
}

export interface AuthoritativeAuctionState {
  tournamentId: string;
  status: 'open' | 'paused' | 'sold' | 'unsold' | 'completed';
  revision: number;
  currentBid: number;
  leadingTeamId: string;
  leadingTeamName: string;
  currentPlayer: Player;
  secondsLeft: number;
  bidHistory: Array<{ teamId: string; teamName: string; amount: number; time: string }>;
  soldPlayers: Array<{ playerId: string; teamId: string; amount: number }>;
  unsoldPlayers: string[];
  unselectedPlayers: string[];
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string;
  actorRole: string;
  tournamentId?: string;
  entityId: string;
  entityType: string;
  details: string;
  timestamp: string;
}

export class TrustedTournamentServer {
  private auditLogs: AuditLogEntry[] = [];
  private processedCommandKeys = new Set<string>();

  // In-memory master state maintained by the trusted server
  private auctionState: AuthoritativeAuctionState;
  private teamBudgets: AuctionTeamState[];
  private tournaments: Map<string, Tournament>;
  private matches: Map<string, Match>;
  private teams: Map<string, Team>;
  private brackets: BracketNode[];

  constructor(seed: {
    auctionState: AuthoritativeAuctionState;
    teamBudgets: AuctionTeamState[];
    tournaments: Tournament[];
    matches: Match[];
    teams: Team[];
    brackets: BracketNode[];
  }) {
    this.auctionState = { ...seed.auctionState };
    this.teamBudgets = seed.teamBudgets.map(t => ({ ...t, draftedPlayers: [...t.draftedPlayers] }));
    this.tournaments = new Map(seed.tournaments.map(t => [t.id, { ...t }]));
    this.matches = new Map(seed.matches.map(m => [m.id, { ...m }]));
    this.teams = new Map(seed.teams.map(t => [t.id, { ...t }]));
    this.brackets = seed.brackets.map(b => ({ ...b }));
  }

  public restoreSnapshot(snapshot: any) {
    if (!snapshot) return;
    if (snapshot.auction) {
      this.auctionState.status = snapshot.auction.status || this.auctionState.status;
      this.auctionState.revision = snapshot.auction.revision || this.auctionState.revision;
      this.auctionState.currentBid = snapshot.auction.currentBid || this.auctionState.currentBid;
      this.auctionState.leadingTeamId = snapshot.auction.leadingTeamId || this.auctionState.leadingTeamId;
      this.auctionState.leadingTeamName = snapshot.auction.leadingTeamName || this.auctionState.leadingTeamName;
      if (snapshot.auction.teams && snapshot.auction.teams.length > 0) {
        this.teamBudgets = snapshot.auction.teams.map((t: any) => ({
          teamId: t.teamId || t.id,
          teamName: t.teamName || t.name,
          totalCredits: t.startingCredits || t.initialCredits || 1000000,
          remainingCredits: t.remainingCredits ?? t.purseRemainingCredits ?? 1000000,
          spentCredits: t.spentCredits ?? t.purseSpentCredits ?? t.creditsUsed ?? 0,
          draftedPlayers: t.draftedPlayerIds ? [...t.draftedPlayerIds] : (t.draftedPlayers || [])
        }));
      }
    }
  }

  public exportSnapshot() {
    return {
      auctionState: { ...this.auctionState },
      teamBudgets: this.teamBudgets.map(t => ({ ...t, draftedPlayers: [...t.draftedPlayers] })),
      tournaments: Array.from(this.tournaments.values()),
      matches: Array.from(this.matches.values()),
      teams: Array.from(this.teams.values()),
      brackets: [...this.brackets],
      auditLogs: [...this.auditLogs]
    };
  }

  // -------------------------------------------------------------
  // Audit Trail (Server-Appended Only)
  // -------------------------------------------------------------
  public appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const log: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    return log;
  }

  public getAuditLogs(caller: ServerCallerContext): AuditLogEntry[] {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('Unauthorized: Audit logs can only be inspected by administrators or tournament organizers.');
    }
    return [...this.auditLogs];
  }

  // -------------------------------------------------------------
  // 1. Authoritative Auction Bid Execution (Section 5)
  // -------------------------------------------------------------
  public executeAuthoritativeBid(
    caller: ServerCallerContext,
    params: {
      tournamentId: string;
      teamId: string;
      incrementAmount: number;
      expectedRevision: number;
      idempotencyKey?: string;
    }
  ): { success: boolean; currentBid: number; revision: number; leadingTeamName: string } {
    const { tournamentId, teamId, incrementAmount, expectedRevision, idempotencyKey } = params;

    // Idempotency check: duplicate commands return idempotent success
    if (idempotencyKey && this.processedCommandKeys.has(idempotencyKey)) {
      return {
        success: true,
        currentBid: this.auctionState.currentBid,
        revision: this.auctionState.revision,
        leadingTeamName: this.auctionState.leadingTeamName
      };
    }

    // Role check: Caller must be captain of the bidding team or lead organizer
    const isCaptainRole = caller.role === 'captain' || caller.role === 'team_captain';
    if (caller.role !== 'organizer' && !isCaptainRole) {
      throw new Error('Unauthorized: Only registered team captains or lead organizers can place bids.');
    }

    if (isCaptainRole && caller.teamId && caller.teamId !== teamId) {
      throw new Error(`Permission Denied: Captain cannot submit bids on behalf of rival team '${teamId}'.`);
    }

    // Auction live check
    if (this.auctionState.status !== 'open') {
      throw new Error(`Auction is currently ${this.auctionState.status.toUpperCase()}. Bidding is closed.`);
    }

    // Optimistic concurrency check (Revision lock)
    if (expectedRevision !== undefined && expectedRevision !== this.auctionState.revision) {
      throw new Error(`Concurrency Conflict: Auction state revision has changed (expected ${expectedRevision}, current ${this.auctionState.revision}). Please refresh and retry.`);
    }

    // Team validation
    const team = this.teamBudgets.find(t => t.teamId === teamId);
    if (!team) {
      throw new Error(`Team '${teamId}' is not an active participant in this auction.`);
    }

    const proposedBid = this.auctionState.currentBid + incrementAmount;

    // Game-aware roster & purse reserve validation
    const rosterConfig = getRosterConfigForGame('Dota 2');
    const rosterValidation = validateBidRosterConstraint(
      team.remainingCredits,
      proposedBid,
      team.draftedPlayers.length,
      rosterConfig
    );

    if (!rosterValidation.valid) {
      throw new Error(rosterValidation.reason || 'Illegal bid constraint.');
    }

    // Atomic state commitment
    this.auctionState.currentBid = proposedBid;
    this.auctionState.leadingTeamId = team.teamId;
    this.auctionState.leadingTeamName = team.teamName;
    this.auctionState.revision += 1;
    this.auctionState.secondsLeft = 25; // Reset anti-snipe clock

    const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
    this.auctionState.bidHistory.unshift({
      teamId: team.teamId,
      teamName: team.teamName,
      amount: proposedBid,
      time: timeStr
    });

    if (idempotencyKey) {
      this.processedCommandKeys.add(idempotencyKey);
    }

    // Server-created audit event
    this.appendAuditLog({
      action: 'bid_accepted',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId,
      entityId: team.teamId,
      entityType: 'auction_bid',
      details: `Accepted bid ₹${proposedBid.toLocaleString('en-IN')} by ${team.teamName} for player ${this.auctionState.currentPlayer.username} (rev ${this.auctionState.revision}).`
    });

    return {
      success: true,
      currentBid: proposedBid,
      revision: this.auctionState.revision,
      leadingTeamName: team.teamName
    };
  }

  // -------------------------------------------------------------
  // 2. Authoritative Auction Conclusion (Section 5 & 6)
  // -------------------------------------------------------------
  public executeAuthoritativeAuctionConclusion(
    caller: ServerCallerContext,
    params: {
      tournamentId: string;
      sellToWinner: boolean;
      idempotencyKey?: string;
    }
  ): { outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED'; nextPlayer?: Player } {
    const { tournamentId, sellToWinner, idempotencyKey } = params;

    if (caller.role !== 'organizer') {
      throw new Error('Unauthorized: Only tournament organizers can conclude auction items.');
    }

    if (idempotencyKey && this.processedCommandKeys.has(idempotencyKey)) {
      return { outcome: sellToWinner ? 'SOLD' : 'UNSOLD' };
    }

    const currentPlayer = this.auctionState.currentPlayer;

    if (sellToWinner) {
      const winnerTeam = this.teamBudgets.find(t => t.teamId === this.auctionState.leadingTeamId);
      if (winnerTeam) {
        winnerTeam.remainingCredits -= this.auctionState.currentBid;
        winnerTeam.draftedPlayers.push(currentPlayer);
      }
      this.auctionState.soldPlayers.push({
        playerId: currentPlayer.id,
        teamId: this.auctionState.leadingTeamId,
        amount: this.auctionState.currentBid
      });

      this.appendAuditLog({
        action: 'player_sold',
        actorId: caller.userId,
        actorRole: caller.role,
        tournamentId,
        entityId: currentPlayer.id,
        entityType: 'player',
        details: `Player ${currentPlayer.username} SOLD to ${winnerTeam?.teamName || this.auctionState.leadingTeamId} for ₹${this.auctionState.currentBid.toLocaleString('en-IN')}.`
      });
    } else {
      // Nominated, but expired without winning bid -> UNSOLD
      this.auctionState.unsoldPlayers.push(currentPlayer.id);

      this.appendAuditLog({
        action: 'player_unsold',
        actorId: caller.userId,
        actorRole: caller.role,
        tournamentId,
        entityId: currentPlayer.id,
        entityType: 'player',
        details: `Player ${currentPlayer.username} passed UNSOLD after nomination.`
      });
    }

    // Check if all primary rosters are full
    const rosterConfig = getRosterConfigForGame('Dota 2');
    const allRostersFull = this.teamBudgets.every(
      t => t.draftedPlayers.length >= rosterConfig.primaryRosterSize
    );

    if (allRostersFull) {
      this.auctionState.status = 'completed';

      this.appendAuditLog({
        action: 'auction_completed',
        actorId: caller.userId,
        actorRole: caller.role,
        tournamentId,
        entityId: tournamentId,
        entityType: 'auction',
        details: `Auction completed. All team rosters full. Untouched ${this.auctionState.unselectedPlayers.length} players marked UNSELECTED.`
      });

      if (idempotencyKey) this.processedCommandKeys.add(idempotencyKey);
      return { outcome: 'AUCTION_COMPLETED' };
    }

    // Advance to next unselected player
    const nextPlayerId = this.auctionState.unselectedPlayers.shift();
    if (nextPlayerId) {
      // Reset room for next nomination
      this.auctionState.currentBid = 50000;
      this.auctionState.revision += 1;
      this.auctionState.secondsLeft = 30;
      this.auctionState.bidHistory = [];

      if (idempotencyKey) this.processedCommandKeys.add(idempotencyKey);
      return { outcome: sellToWinner ? 'SOLD' : 'UNSOLD', nextPlayer: this.auctionState.currentPlayer };
    }

    this.auctionState.status = 'completed';
    if (idempotencyKey) this.processedCommandKeys.add(idempotencyKey);
    return { outcome: 'AUCTION_COMPLETED' };
  }

  // -------------------------------------------------------------
  // 3. Authoritative Tournament State Transition (Section 7)
  // -------------------------------------------------------------
  public executeAuthoritativeTournamentTransition(
    caller: ServerCallerContext,
    params: {
      tournamentId: string;
      nextStatus: TournamentStatus;
    }
  ): { success: boolean; status: TournamentStatus } {
    const { tournamentId, nextStatus } = params;

    if (caller.role !== 'organizer') {
      throw new Error('Forbidden: Only tournament organizers can transition tournament state.');
    }

    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      throw new Error(`Tournament '${tournamentId}' not found.`);
    }

    const currentCanonicalStatus: TournamentStatus = 
      tournament.status === 'Live' ? 'competition' : 
      tournament.status === 'Completed' ? 'completed' : 
      tournament.status === 'Registration Open' ? 'registration' : 'auction_live';

    const check = validateTournamentTransition(currentCanonicalStatus, nextStatus);
    if (!check.valid) {
      throw new Error(check.reason || 'Invalid state transition.');
    }

    tournament.status = nextStatus === 'competition' ? 'Live' : nextStatus === 'completed' ? 'Completed' : 'Drafting';

    this.appendAuditLog({
      action: 'tournament_transition',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId,
      entityId: tournamentId,
      entityType: 'tournament',
      details: `Status transitioned from ${currentCanonicalStatus} to ${nextStatus}.`
    });

    return { success: true, status: nextStatus };
  }

  // -------------------------------------------------------------
  // 4. Authoritative Match Finalization & Ratings (Section 19 & 20)
  // -------------------------------------------------------------
  public executeAuthoritativeMatchFinalization(
    caller: ServerCallerContext,
    params: {
      matchId: string;
      scoreA: number;
      scoreB: number;
      winnerId: string;
    }
  ): { success: boolean; ratingRecord: RatingAdjustmentRecord } {
    const { matchId, scoreA, scoreB, winnerId } = params;

    if (caller.role !== 'organizer') {
      throw new Error('Forbidden: Only organizers can finalize match results.');
    }

    const match = this.matches.get(matchId);
    if (!match) {
      throw new Error(`Match '${matchId}' not found.`);
    }

    match.teamA.score = scoreA;
    match.teamB.score = scoreB;
    match.status = 'COMPLETED';
    match.winnerId = winnerId;

    const teamA = this.teams.get(match.teamA.id);
    const teamB = this.teams.get(match.teamB.id);
    const loserId = winnerId === match.teamA.id ? match.teamB.id : match.teamA.id;
    const winnerRating = (winnerId === match.teamA.id ? teamA?.rating : teamB?.rating) || 1800;
    const loserRating = (loserId === match.teamA.id ? teamA?.rating : teamB?.rating) || 1800;

    const ratingResult = ratingLedger.applyMatchResult(
      matchId,
      winnerId,
      loserId,
      winnerRating,
      loserRating
    );

    if (teamA && teamB) {
      if (winnerId === teamA.id) {
        teamA.rating = ratingResult.record.winnerNewRating;
        teamB.rating = ratingResult.record.loserNewRating;
      } else {
        teamB.rating = ratingResult.record.winnerNewRating;
        teamA.rating = ratingResult.record.loserNewRating;
      }
    }

    this.appendAuditLog({
      action: 'match_result_finalized',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: matchId,
      entityType: 'match',
      details: `Match #${(match as any).matchNumber || 1} finalized: ${scoreA}-${scoreB}, Winner: ${winnerId}. Rating delta: +${ratingResult.record.delta}.`
    });

    return { success: true, ratingRecord: ratingResult.record };
  }

  // -------------------------------------------------------------
  // 5. Authoritative Result Correction (Section 10)
  // -------------------------------------------------------------
  public executeAuthoritativeMatchCorrection(
    caller: ServerCallerContext,
    params: {
      matchId: string;
      newScoreA: number;
      newScoreB: number;
      newWinnerId: string;
      reason: string;
    }
  ): MatchCorrectionResult {
    const { matchId, newScoreA, newScoreB, newWinnerId, reason } = params;

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      throw new Error('Forbidden: Only referees or administrators can issue authoritative result corrections.');
    }

    const match = this.matches.get(matchId);
    if (!match) {
      throw new Error(`Match '${matchId}' not found.`);
    }

    const allMatches = Array.from(this.matches.values());
    const allTeams = Array.from(this.teams.values());

    const result = executeResultCorrection({
      match,
      newScoreA,
      newScoreB,
      newWinnerId,
      teams: allTeams,
      allMatches,
      brackets: this.brackets,
      reason,
      refereeUserId: caller.userId
    });

    this.appendAuditLog({
      action: result.auditEvent.action,
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: matchId,
      entityType: 'match_correction',
      details: result.auditEvent.details
    });

    return result;
  }

  // -------------------------------------------------------------
  // Player Identity & Steam Linking Operations
  // -------------------------------------------------------------
  public executeUpdatePlayerProfile(
    caller: ServerCallerContext,
    payload: {
      username?: string;
      avatar?: string;
      city?: string;
      region?: string;
      bio?: string;
      primaryRole?: DotaRolePosition;
      secondaryRole?: DotaRolePosition;
      declaredMmr?: number;
    }
  ): { success: boolean; error?: string; player?: PublicDotaPlayerProfile } {
    // Ensure player exists
    dotaPlayerRegistry.getOrCreatePlayer(caller.userId, caller.email);

    const updateRes = dotaPlayerRegistry.updatePlayerProfile(caller.userId, payload);
    if (!updateRes.success || !updateRes.player) {
      throw new Error(updateRes.error || 'Failed to update player profile.');
    }

    this.appendAuditLog({
      action: 'dota_profile_updated',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: caller.userId,
      entityType: 'player_profile',
      details: `Updated Dota profile: IGN=${updateRes.player.username}, Roles=${updateRes.player.primaryRole} / ${updateRes.player.secondaryRole}`
    });

    return { success: true, player: dotaPlayerRegistry.sanitizeForPublic(updateRes.player) };
  }

  public executeLinkSteam(
    caller: ServerCallerContext,
    payload: { steamIdentifier: string; accountName?: string }
  ): { success: boolean; error?: string; steam?: any } {
    // Normalize and validate
    let norm;
    try {
      norm = normalizeDotaIdentity(payload.steamIdentifier);
    } catch {
      throw new Error('Invalid Steam identifier. Must be a valid Steam64 ID, 32-bit Dota Account ID, or Steam profile URL.');
    }

    dotaPlayerRegistry.getOrCreatePlayer(caller.userId, caller.email);
    const linkRes = dotaPlayerRegistry.linkSteamAccount(
      caller.userId,
      norm.steamId64,
      payload.accountName || `Steam_${norm.accountId}`
    );

    if (!linkRes.success) {
      throw new Error(linkRes.error || 'Failed to link Steam account.');
    }

    this.appendAuditLog({
      action: 'steam_account_linked',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: caller.userId,
      entityType: 'steam_identity',
      details: `Linked Steam64 ${norm.steamId64} (Steam32: ${norm.accountId}) to user ${caller.userId}`
    });

    const player = dotaPlayerRegistry.getPlayer(caller.userId);
    return { success: true, steam: player?.steam };
  }

  public executeUnlinkSteam(
    caller: ServerCallerContext
  ): { success: boolean; error?: string } {
    const unlinkRes = dotaPlayerRegistry.unlinkSteamAccount(caller.userId);
    if (!unlinkRes.success) {
      throw new Error(unlinkRes.error || 'Cannot unlink Steam account at this time.');
    }

    this.appendAuditLog({
      action: 'steam_account_unlinked',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: caller.userId,
      entityType: 'steam_identity',
      details: `Unlinked Steam identity for user ${caller.userId}`
    });

    return { success: true };
  }

  // -------------------------------------------------------------
  // Authoritative Tournament Registration Operations
  // -------------------------------------------------------------
  public executeTournamentRegistration(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      ign: string;
      primaryRole: DotaRolePosition;
      secondaryRole: DotaRolePosition;
      declaredMmr: number;
      rulesAccepted: boolean;
      city?: string;
      region?: string;
    }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    if (!caller.userId) {
      throw new Error('Unauthenticated: Must be signed in to register for tournaments.');
    }

    const tournament = this.tournaments.get(payload.tournamentId);
    if (!tournament) {
      throw new Error('Tournament not found.');
    }

    // Role validation
    const roleValidation = validateDotaRoles(payload.primaryRole, payload.secondaryRole);
    if (!roleValidation.valid) {
      throw new Error(roleValidation.error);
    }

    // MMR validation
    if (typeof payload.declaredMmr !== 'number' || isNaN(payload.declaredMmr) || payload.declaredMmr < 1 || payload.declaredMmr > 15000) {
      throw new Error('Declared MMR must be a realistic number between 1 and 15,000.');
    }

    if (!payload.rulesAccepted) {
      throw new Error('You must accept tournament rules before registering.');
    }

    const regRes = dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: payload.tournamentId,
      userId: caller.userId,
      ign: payload.ign,
      primaryRole: payload.primaryRole,
      secondaryRole: payload.secondaryRole,
      declaredMmr: payload.declaredMmr,
      rulesAccepted: payload.rulesAccepted,
      city: payload.city,
      region: payload.region,
      tournamentStatus: tournament.status.toLowerCase()
    });

    if (!regRes.success || !regRes.registration) {
      throw new Error(regRes.error || 'Registration failed.');
    }

    this.appendAuditLog({
      action: 'tournament_registration_submitted',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: regRes.registration.id,
      entityType: 'registration',
      details: `Player ${payload.ign} submitted registration for ${tournament.name}. Roles: ${payload.primaryRole} / ${payload.secondaryRole}, Declared MMR: ${payload.declaredMmr}`
    });

    return { success: true, registration: regRes.registration };
  }

  public executeTournamentWithdrawal(
    caller: ServerCallerContext,
    payload: { tournamentId: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    const tournament = this.tournaments.get(payload.tournamentId);
    const tourneyStatus = tournament ? tournament.status.toLowerCase() : 'registration';

    const withdrawRes = dotaPlayerRegistry.withdrawTournamentRegistration(
      payload.tournamentId,
      caller.userId,
      tourneyStatus
    );

    if (!withdrawRes.success || !withdrawRes.registration) {
      throw new Error(withdrawRes.error || 'Withdrawal failed.');
    }

    this.appendAuditLog({
      action: 'tournament_registration_withdrawn',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: withdrawRes.registration.id,
      entityType: 'registration',
      details: `User ${caller.userId} voluntarily withdrew tournament registration for ${payload.tournamentId}`
    });

    return { success: true, registration: withdrawRes.registration };
  }

  // -------------------------------------------------------------
  // Phase 1B: Organiser Review, Tournament MMR, Verification & Evidence
  // -------------------------------------------------------------
  private assertOrganiserOrAdmin(caller: ServerCallerContext) {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('Unauthorized: Only tournament organizers (organizer or admin) can perform this action.');
    }
  }

  public executeStartReview(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.startReview(payload.tournamentId, payload.userId, caller.userId);
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to start review.');
    }
    this.appendAuditLog({
      action: 'registration_review_started',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} moved player ${payload.userId} to UNDER_REVIEW`
    });
    return { success: true, registration: res.registration };
  }

  public executeRequestEvidence(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string; prompt: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    if (!payload.prompt || payload.prompt.trim().length === 0) {
      throw new Error('A specific prompt or instruction must be provided when requesting evidence.');
    }
    const res = dotaPlayerRegistry.requestEvidence(payload.tournamentId, payload.userId, payload.prompt, caller.userId);
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to request evidence.');
    }
    this.appendAuditLog({
      action: 'evidence_requested',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} requested evidence from player ${payload.userId}: "${payload.prompt}"`
    });
    return { success: true, registration: res.registration };
  }

  public executeSubmitEvidence(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      registrationId: string;
      type: EvidenceType;
      fileUrl?: string;
      description: string;
    }
  ): { success: boolean; registration: DotaTournamentRegistration; evidenceItem: RegistrationEvidenceItem } {
    if (!caller.userId) {
      throw new Error('Unauthenticated: Must be signed in to submit evidence.');
    }
    const reg = dotaPlayerRegistry.getRegistration(payload.tournamentId, caller.userId);
    if (!reg) {
      throw new Error('Registration not found for user.');
    }
    if (reg.userId !== caller.userId) {
      throw new Error('Unauthorized: You can only submit evidence for your own registration.');
    }
    const res = dotaPlayerRegistry.submitEvidence(payload.tournamentId, caller.userId, {
      type: payload.type,
      fileUrl: payload.fileUrl,
      description: payload.description
    });
    if (!res.success || !res.registration || !res.evidenceItem) {
      throw new Error(res.error || 'Failed to submit evidence.');
    }
    this.appendAuditLog({
      action: 'evidence_submitted',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Player ${caller.userId} submitted evidence (${payload.type}): "${payload.description}"`
    });
    return { success: true, registration: res.registration, evidenceItem: res.evidenceItem };
  }

  public executeConfirmDeclaredMmr(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.confirmDeclaredMmr(payload.tournamentId, payload.userId, caller.userId);
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to confirm declared MMR.');
    }
    this.appendAuditLog({
      action: 'tournament_mmr_confirmed',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} confirmed declared MMR ${res.registration.declaredMmr} as Tournament MMR`
    });
    return { success: true, registration: res.registration };
  }

  public executeSetTournamentMmr(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string; correctedMmr: number; reason: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.setCorrectedTournamentMmr(
      payload.tournamentId,
      payload.userId,
      payload.correctedMmr,
      payload.reason,
      caller.userId
    );
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to set Tournament MMR.');
    }
    this.appendAuditLog({
      action: 'tournament_mmr_calibrated',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} set Tournament MMR to ${payload.correctedMmr}. Reason: ${payload.reason}`
    });
    return { success: true, registration: res.registration };
  }

  public executeVerifyRegistration(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string; tournamentMmr?: number }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.verifyRegistration(
      payload.tournamentId,
      payload.userId,
      caller.userId,
      payload.tournamentMmr
    );
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to verify registration.');
    }
    this.appendAuditLog({
      action: 'registration_verified_and_locked',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} verified player ${payload.userId}. Locked Tournament MMR: ${res.registration.tournamentMmr}. Player is now ELIGIBLE for auction & rosters.`
    });
    return { success: true, registration: res.registration };
  }

  public executeCorrectLockedTournamentMmr(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string; newMmr: number; reason: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.correctLockedTournamentMmr(
      payload.tournamentId,
      payload.userId,
      payload.newMmr,
      payload.reason,
      caller.userId
    );
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to adjust locked Tournament MMR.');
    }
    this.appendAuditLog({
      action: 'locked_tournament_mmr_corrected',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} adjusted locked Tournament MMR to ${payload.newMmr}. Reason: ${payload.reason}`
    });
    return { success: true, registration: res.registration };
  }

  public executeRejectRegistration(
    caller: ServerCallerContext,
    payload: { tournamentId: string; userId: string; reason: string }
  ): { success: boolean; registration: DotaTournamentRegistration } {
    this.assertOrganiserOrAdmin(caller);
    if (!payload.reason || payload.reason.trim().length === 0) {
      throw new Error('A rejection reason must be specified.');
    }
    const res = dotaPlayerRegistry.rejectRegistration(
      payload.tournamentId,
      payload.userId,
      payload.reason,
      caller.userId
    );
    if (!res.success || !res.registration) {
      throw new Error(res.error || 'Failed to reject registration.');
    }
    this.appendAuditLog({
      action: 'registration_rejected',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.registration.id,
      entityType: 'registration',
      details: `Organiser ${caller.userId} rejected player ${payload.userId}. Reason: ${payload.reason}`
    });
    return { success: true, registration: res.registration };
  }

  public executeCreateIntegrityCase(
    caller: ServerCallerContext,
    payload: {
      playerId: string;
      caseType: MmrIntegrityCaseType;
      declaredMmr: number;
      notes: string;
      tournamentId?: string;
    }
  ): { success: boolean; case: MmrIntegrityCase } {
    this.assertOrganiserOrAdmin(caller);
    const newCase = dotaPlayerRegistry.createIntegrityCase(
      payload.playerId,
      payload.caseType,
      payload.declaredMmr,
      payload.notes,
      payload.tournamentId,
      caller.userId
    );
    this.appendAuditLog({
      action: 'integrity_case_opened',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: newCase.id,
      entityType: 'integrity_case',
      details: `Organiser ${caller.userId} opened integrity case (${payload.caseType}) for player ${payload.playerId}`
    });
    return { success: true, case: newCase };
  }

  public executeResolveIntegrityCase(
    caller: ServerCallerContext,
    payload: {
      caseId: string;
      action: 'APPROVE' | 'CORRECT_MMR' | 'REQUEST_EVIDENCE' | 'WARN' | 'DISQUALIFY' | 'REJECT' | 'ESCALATE';
      note: string;
      correctedMmr?: number;
    }
  ): { success: boolean } {
    this.assertOrganiserOrAdmin(caller);
    const res = dotaPlayerRegistry.resolveIntegrityCase(
      payload.caseId,
      payload.action,
      payload.note,
      caller.userId,
      payload.correctedMmr
    );
    if (!res.success) {
      throw new Error(res.error || 'Failed to resolve integrity case.');
    }
    this.appendAuditLog({
      action: 'integrity_case_resolved',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.caseId,
      entityType: 'integrity_case',
      details: `Organiser ${caller.userId} executed action ${payload.action} on case ${payload.caseId}. Note: ${payload.note}`
    });
    return { success: true };
  }

  public getRegistrationEvidenceAuthoritative(
    caller: ServerCallerContext,
    payload: { registrationId: string; targetUserId: string }
  ): RegistrationEvidenceItem[] {
    const isOwner = caller.userId === payload.targetUserId;
    const isOrganiserOrAdmin = caller.role === 'organizer' || caller.isAdmin === true;

    if (!isOwner && !isOrganiserOrAdmin) {
      throw new Error('Unauthorized: Captains, players, and spectators cannot view private evidence.');
    }

    const res = dotaPlayerRegistry.getRegistrationEvidence(payload.registrationId, caller);
    if (!res.success || !res.evidence) {
      throw new Error(res.error || 'Failed to retrieve evidence.');
    }
    return res.evidence;
  }

  // -------------------------------------------------------------
  // Phase 2: Captain Selection & Authoritative Live Auction
  // -------------------------------------------------------------
  public executeAppointCaptain(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      candidateUserId: string;
      teamName: string;
      tag: string;
      color?: string;
      logo?: string;
    }
  ): { success: boolean; team: DotaAuctionTeam } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaAuctionEngine.appointCaptain(
      payload.candidateUserId,
      {
        teamName: payload.teamName,
        tag: payload.tag,
        color: payload.color,
        logo: payload.logo
      },
      caller.userId
    );

    if (!res.success || !res.team) {
      throw new Error(res.error || 'Failed to appoint captain.');
    }

    this.appendAuditLog({
      action: 'captain_appointed',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.team.id,
      entityType: 'team',
      details: `Organiser ${caller.userId} appointed ${res.team.captainIgn} as captain of ${res.team.name}`
    });

    return { success: true, team: res.team };
  }

  public executeNominateAuctionPlayer(
    caller: ServerCallerContext,
    payload: { tournamentId: string; playerId: string }
  ): { success: boolean; nominee: DotaAuctionPlayer } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaAuctionEngine.nominatePlayer(payload.playerId, caller.userId);
    if (!res.success || !res.nominee) {
      throw new Error(res.error || 'Failed to nominate player.');
    }

    this.appendAuditLog({
      action: 'player_nominated',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.playerId,
      entityType: 'player',
      details: `Organiser ${caller.userId} nominated ${res.nominee.username} for bidding`
    });

    return { success: true, nominee: res.nominee };
  }

  public executePlaceDotaBid(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      teamId: string;
      bidAmount: number;
      expectedRevision?: number;
    }
  ): { success: boolean; currentBid: number; revision: number; leadingTeamName: string } {
    const isCaptainRole = caller.role === 'captain' || caller.role === 'team_captain';
    if (caller.role !== 'organizer' && !isCaptainRole) {
      throw new Error('Unauthorized: Only registered team captains or lead organizers can place bids.');
    }

    if (isCaptainRole && caller.teamId && caller.teamId !== payload.teamId) {
      throw new Error(`Permission Denied: Captain cannot submit bids on behalf of rival team '${payload.teamId}'.`);
    }

    const res = dotaAuctionEngine.placeBid({
      teamId: payload.teamId,
      captainUserId: caller.userId,
      bidAmount: payload.bidAmount,
      expectedRevision: payload.expectedRevision
    });

    if (!res.success) {
      throw new Error(res.error || 'Bid rejected by server.');
    }

    this.appendAuditLog({
      action: 'bid_accepted',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'auction_bid',
      details: `Accepted bid ${payload.bidAmount} from ${res.leadingTeamName} (rev ${res.revision}).`
    });

    return {
      success: true,
      currentBid: res.currentBid!,
      revision: res.revision!,
      leadingTeamName: res.leadingTeamName!
    };
  }

  public executeConcludeDotaNomination(
    caller: ServerCallerContext,
    payload: { tournamentId: string; sellToWinner: boolean }
  ): { outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED'; player: DotaAuctionPlayer; teamName?: string; winningBid?: number } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaAuctionEngine.concludeNomination(payload.sellToWinner, caller.userId);

    this.appendAuditLog({
      action: res.outcome === 'SOLD' ? 'player_sold' : res.outcome === 'UNSOLD' ? 'player_unsold' : 'auction_completed',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.player.id,
      entityType: 'player',
      details: `Nomination concluded with outcome: ${res.outcome}`
    });

    return res;
  }

  public executeAssignStandIn(
    caller: ServerCallerContext,
    payload: { tournamentId: string; teamId: string; playerId: string }
  ): { success: boolean; team: DotaAuctionTeam } {
    const isOrganiser = caller.role === 'organizer' || caller.isAdmin === true;
    const isTeamCaptain = (caller.role === 'captain' || caller.role === 'team_captain') && caller.teamId === payload.teamId;

    if (!isOrganiser && !isTeamCaptain) {
      throw new Error('Unauthorized: Only tournament organizers or the team captain can assign stand-ins.');
    }

    const res = dotaAuctionEngine.assignOptionalStandIn(payload.teamId, payload.playerId, caller.userId);
    if (!res.success || !res.team) {
      throw new Error(res.error || 'Failed to assign stand-in.');
    }

    this.appendAuditLog({
      action: 'standin_assigned',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.playerId,
      entityType: 'player',
      details: `Stand-in ${payload.playerId} assigned to ${res.team.name}`
    });

    return { success: true, team: res.team };
  }

  public executeFinalizeDotaAuction(
    caller: ServerCallerContext,
    payload: { tournamentId: string }
  ): { success: boolean; unselectedCount: number } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaAuctionEngine.finalizeAuction(caller.userId);

    this.appendAuditLog({
      action: 'auction_completed',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.tournamentId,
      entityType: 'auction',
      details: `Organiser ${caller.userId} finalized tournament auction. ${res.unselectedCount} untouched contenders marked UNSELECTED.`
    });

    return res;
  }

  // -------------------------------------------------------------
  // Phase 3: Premade Teams & Authoritative Roster Management
  // -------------------------------------------------------------
  public executeRegisterPremadeTeam(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      teamName: string;
      tag: string;
      logo?: string;
      color?: string;
      captainUserId: string;
      persistentClubId?: string;
    }
  ): { success: boolean; team: PremadeTeamRegistration } {
    const isCaptainRole = caller.role === 'captain' || caller.role === 'team_captain';
    if (!isCaptainRole && caller.role !== 'organizer' && caller.isAdmin !== true) {
      throw new Error('Unauthorized: Only designated team captains or tournament organizers can register premade squads.');
    }

    const res = dotaPremadeTeamEngine.registerPremadeTeam({
      tournamentId: payload.tournamentId,
      teamName: payload.teamName,
      tag: payload.tag,
      logo: payload.logo,
      color: payload.color,
      captainUserId: payload.captainUserId,
      persistentClubId: payload.persistentClubId,
      creatorUserId: caller.userId
    });

    if (!res.success || !res.team) {
      throw new Error(res.error || 'Failed to register premade team.');
    }

    this.appendAuditLog({
      action: 'team_registered',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: res.team.teamId,
      entityType: 'team',
      details: `Premade team '${res.team.teamName}' registered in DRAFT state by ${caller.userId}`
    });

    return { success: true, team: res.team };
  }

  public executeAddPlayerToPremadeRoster(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      teamId: string;
      candidateUserId: string;
      isStandIn?: boolean;
      assignedRole?: any;
    }
  ): { success: boolean; team: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.addPlayerToRoster({
      tournamentId: payload.tournamentId,
      teamId: payload.teamId,
      candidateUserId: payload.candidateUserId,
      isStandIn: payload.isStandIn,
      assignedRole: payload.assignedRole,
      actorUserId: caller.userId
    });

    if (!res.success || !res.team) {
      throw new Error(res.error || 'Failed to add player to roster.');
    }

    this.appendAuditLog({
      action: 'player_invited',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'roster_slot',
      details: `Player ${payload.candidateUserId} invited to ${res.team.teamName}`
    });

    return { success: true, team: res.team };
  }

  public executeSubmitPremadeRoster(
    caller: ServerCallerContext,
    payload: { tournamentId: string; teamId: string }
  ): { success: boolean; team: PremadeTeamRegistration } {
    const team = dotaPremadeTeamEngine.getTeam(payload.tournamentId, payload.teamId);
    if (!team) throw new Error('Team not found.');

    if (caller.role !== 'organizer' && caller.isAdmin !== true && team.captainId !== caller.userId) {
      throw new Error('Permission Denied: Only the verified team captain can submit the roster.');
    }

    const res = dotaPremadeTeamEngine.submitTeamRoster(payload.tournamentId, payload.teamId, caller.userId);
    if (!res.success || !res.team) {
      throw new Error(res.error || 'Roster submission failed.');
    }

    this.appendAuditLog({
      action: 'roster_submitted',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'team_roster',
      details: `Full roster for '${res.team.teamName}' submitted for review.`
    });

    return { success: true, team: res.team };
  }

  public executeReviewPremadeTeam(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      teamId: string;
      action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
      reason?: string;
    }
  ): { success: boolean; team: PremadeTeamRegistration } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaPremadeTeamEngine.reviewTeamSubmission({
      tournamentId: payload.tournamentId,
      teamId: payload.teamId,
      action: payload.action,
      reason: payload.reason,
      staffActorId: caller.userId
    });

    if (!res.success || !res.team) {
      throw new Error(res.error || 'Review operation failed.');
    }

    this.appendAuditLog({
      action: `team_${payload.action.toLowerCase()}`,
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'team',
      details: `Organiser ${caller.userId} performed ${payload.action} on ${res.team.teamName}. Reason: ${payload.reason || 'None'}`
    });

    return { success: true, team: res.team };
  }

  public executeLockPremadeRoster(
    caller: ServerCallerContext,
    payload: { tournamentId: string; teamId: string }
  ): { success: boolean; team: PremadeTeamRegistration } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaPremadeTeamEngine.lockPremadeRoster(payload.tournamentId, payload.teamId, caller.userId);
    if (!res.success || !res.team) {
      throw new Error(res.error || 'Failed to lock roster.');
    }

    this.appendAuditLog({
      action: 'roster_locked',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'team_roster',
      details: `Roster for ${res.team.teamName} locked by ${caller.userId}`
    });

    return { success: true, team: res.team };
  }

  public executeEmergencyRosterChange(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      teamId: string;
      outgoingPlayerId: string;
      incomingPlayerId: string;
      role?: any;
      reason: string;
    }
  ): { success: boolean; team: PremadeTeamRegistration } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaPremadeTeamEngine.executeEmergencyRosterChange({
      tournamentId: payload.tournamentId,
      teamId: payload.teamId,
      outgoingPlayerId: payload.outgoingPlayerId,
      incomingPlayerId: payload.incomingPlayerId,
      role: payload.role,
      reason: payload.reason,
      staffActorId: caller.userId
    });

    if (!res.success || !res.team) {
      throw new Error(res.error || 'Emergency roster change failed.');
    }

    this.appendAuditLog({
      action: 'emergency_roster_change',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.teamId,
      entityType: 'team_roster',
      details: `Emergency replacement on ${res.team.teamName}: ${payload.outgoingPlayerId} -> ${payload.incomingPlayerId}. Reason: ${payload.reason}`
    });

    return { success: true, team: res.team };
  }

  // -------------------------------------------------------------
  // Phase 4: Competition Structure, Seeding & Brackets
  // -------------------------------------------------------------
  public executeGenerateSeeds(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      seedingMode: SeedingMode;
      manualSeeds?: Array<{ teamId: string; seed: number }>;
    }
  ): { success: boolean; seededTeams: SeededTeam[] } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaCompetitionEngine.generateSeeds({
      tournamentId: payload.tournamentId,
      seedingMode: payload.seedingMode,
      manualSeeds: payload.manualSeeds,
      staffActorId: caller.userId
    });

    if (!res.success || !res.seededTeams) {
      throw new Error(res.error || 'Failed to generate tournament seeds.');
    }

    this.appendAuditLog({
      action: 'seeds_generated',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.tournamentId,
      entityType: 'tournament_seeds',
      details: `Generated ${payload.seedingMode} seeds for ${res.seededTeams.length} teams by ${caller.userId}`
    });

    return { success: true, seededTeams: res.seededTeams };
  }

  public executeGenerateStructure(
    caller: ServerCallerContext,
    payload: { tournamentId: string }
  ): { success: boolean; structure: CompetitionStructureState } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaCompetitionEngine.generateCompetitionStructure({
      tournamentId: payload.tournamentId,
      staffActorId: caller.userId
    });

    if (!res.success || !res.structure) {
      throw new Error(res.error || 'Failed to generate competition structure.');
    }

    this.appendAuditLog({
      action: 'structure_generated',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.tournamentId,
      entityType: 'competition_structure',
      details: `Generated ${res.structure.config.format} structure with ${res.structure.matches.length} matches by ${caller.userId}`
    });

    return { success: true, structure: res.structure };
  }

  public executeLockCompetitionStructure(
    caller: ServerCallerContext,
    payload: { tournamentId: string }
  ): { success: boolean; structure: CompetitionStructureState } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaCompetitionEngine.lockCompetitionStructure(payload.tournamentId, caller.userId);
    if (!res.success || !res.structure) {
      throw new Error(res.error || 'Failed to lock competition structure.');
    }

    this.appendAuditLog({
      action: 'structure_locked',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.tournamentId,
      entityType: 'competition_structure',
      details: `Competition structure officially LOCKED by ${caller.userId}`
    });

    return { success: true, structure: res.structure };
  }

  public executeEditBracketProgression(
    caller: ServerCallerContext,
    payload: {
      tournamentId: string;
      matchId: string;
      updates: Partial<CompetitionMatchNode>;
    }
  ): { success: boolean } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaCompetitionEngine.updateMatchProgression({
      tournamentId: payload.tournamentId,
      matchId: payload.matchId,
      updates: payload.updates,
      staffActorId: caller.userId,
      userRole: caller.role
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to edit bracket progression.');
    }

    this.appendAuditLog({
      action: 'bracket_progression_edited',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.matchId,
      entityType: 'match_progression',
      details: `Match progression on ${payload.matchId} updated by ${caller.userId}`
    });

    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // Phase 5: Authoritative Match Operations
  // ---------------------------------------------------------------------------

  public executeScheduleMatch(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      tournamentId?: string;
      date: string;
      time: string;
      seriesFormat?: 'BO1' | 'BO3' | 'BO5';
      serverRegion?: string;
      lobbyNotes?: string;
      checkInTime?: string;
    }
  ): { success: boolean; match?: DotaMatchRecord } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.scheduleMatch({
      ...payload,
      staffId: caller.userId,
      callerRole: caller.role
    });

    if (!res.success || !res.match) {
      throw new Error(res.error || 'Failed to schedule match.');
    }

    this.appendAuditLog({
      action: 'match_scheduled',
      actorId: caller.userId,
      actorRole: caller.role,
      tournamentId: payload.tournamentId,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Match ${payload.matchId} scheduled for ${payload.date} ${payload.time} by ${caller.userId}`
    });

    return { success: true, match: res.match };
  }

  public executeCheckInCaptain(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      teamId: string;
      staffOverrideReason?: string;
    }
  ): { success: boolean; status?: CheckInStatus } {
    const res = dotaMatchOperations.checkInCaptain({
      matchId: payload.matchId,
      teamId: payload.teamId,
      callerUserId: caller.userId,
      callerRole: caller.role,
      staffOverrideReason: payload.staffOverrideReason
    });

    if (!res.success) {
      throw new Error(res.error || 'Check-in failed.');
    }

    this.appendAuditLog({
      action: 'captain_check_in',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Team ${payload.teamId} checked in for match ${payload.matchId}. Status: ${res.status}`
    });

    return { success: true, status: res.status };
  }

  public executeSubmitMatchResult(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      submittingTeamId: string;
      scoreA: number;
      scoreB: number;
    }
  ): { success: boolean } {
    const res = dotaMatchOperations.submitResult(
      payload.matchId,
      payload.submittingTeamId,
      payload.scoreA,
      payload.scoreB,
      caller.userId,
      caller.role
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to submit match result.');
    }

    this.appendAuditLog({
      action: 'match_result_submitted',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Score ${payload.scoreA}-${payload.scoreB} submitted by team ${payload.submittingTeamId} for match ${payload.matchId}`
    });

    return { success: true };
  }

  public executeConfirmMatchResult(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      confirmingTeamId: string;
    }
  ): { success: boolean; winnerTeamId?: string } {
    const res = dotaMatchOperations.confirmResult(
      payload.matchId,
      payload.confirmingTeamId,
      caller.userId,
      caller.role
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to confirm match result.');
    }

    this.appendAuditLog({
      action: 'match_result_confirmed',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Result for match ${payload.matchId} confirmed by team ${payload.confirmingTeamId}. Finalized winner: ${res.winnerTeamId}`
    });

    return { success: true, winnerTeamId: res.winnerTeamId };
  }

  public executeOpenMatchDispute(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      disputedByTeamId: string;
      captainIgn: string;
      reason: string;
      notes: string;
      evidenceUrls?: string[];
    }
  ): { success: boolean; disputeId?: string } {
    const res = dotaMatchOperations.openDispute(
      payload.matchId,
      payload.disputedByTeamId,
      payload.captainIgn,
      payload.reason,
      payload.notes,
      payload.evidenceUrls,
      caller.userId,
      caller.role
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to open dispute.');
    }

    this.appendAuditLog({
      action: 'match_dispute_opened',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'match_dispute',
      details: `Dispute opened by ${payload.captainIgn} (${payload.reason}) on match ${payload.matchId}: ${payload.notes}`
    });

    return { success: true, disputeId: res.disputeId };
  }

  public executeResolveMatchDispute(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      disputeId: string;
      action: 'CONFIRM_ORIGINAL' | 'CORRECT_RESULT' | 'ORDER_REMATCH' | 'AWARD_FORFEIT' | 'CANCEL_MATCH' | 'DISMISS_DISPUTE';
      summary: string;
      correctedScore?: { scoreA: number; scoreB: number };
      forfeitWinningTeamId?: string;
    }
  ): { success: boolean; newRematchId?: string } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.resolveDispute(
      payload.matchId,
      payload.disputeId,
      payload.action,
      caller.userId,
      payload.summary,
      payload.correctedScore,
      payload.forfeitWinningTeamId,
      caller.role
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to resolve dispute.');
    }

    this.appendAuditLog({
      action: 'match_dispute_resolved',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.disputeId,
      entityType: 'match_dispute',
      details: `Dispute ${payload.disputeId} on match ${payload.matchId} resolved via ${payload.action} by ${caller.userId}: ${payload.summary}`
    });

    return { success: true, newRematchId: res.newRematchId };
  }

  public executeAwardForfeit(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      winningTeamId: string;
      reason: string;
    }
  ): { success: boolean } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.awardForfeit({
      matchId: payload.matchId,
      winningTeamId: payload.winningTeamId,
      reason: payload.reason,
      staffId: caller.userId,
      callerRole: caller.role
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to award forfeit.');
    }

    this.appendAuditLog({
      action: 'match_forfeit_awarded',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Forfeit awarded to team ${payload.winningTeamId} on match ${payload.matchId} by ${caller.userId}: ${payload.reason}`
    });

    return { success: true };
  }

  public executeOrderRematch(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      reason: string;
    }
  ): { success: boolean; rematchId?: string } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.orderRematch({
      matchId: payload.matchId,
      reason: payload.reason,
      staffId: caller.userId,
      callerRole: caller.role
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to order rematch.');
    }

    this.appendAuditLog({
      action: 'match_rematch_ordered',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Rematch ordered for match ${payload.matchId} by ${caller.userId}: ${payload.reason}`
    });

    return { success: true, rematchId: res.rematchId };
  }

  public executeCorrectFinalizedResult(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      newScoreA: number;
      newScoreB: number;
      reason: string;
    }
  ): { success: boolean } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.correctFinalizedResult(
      payload.matchId,
      payload.newScoreA,
      payload.newScoreB,
      caller.userId,
      payload.reason,
      caller.role
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to correct match result.');
    }

    this.appendAuditLog({
      action: 'match_result_corrected',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match',
      details: `Match ${payload.matchId} result corrected to ${payload.newScoreA}-${payload.newScoreB} by ${caller.userId}: ${payload.reason}`
    });

    return { success: true };
  }

  public executeAdvanceMatch(
    caller: ServerCallerContext,
    payload: { matchId: string }
  ): { success: boolean } {
    const res = dotaMatchOperations.advanceMatch(payload.matchId);
    if (!res.success) {
      throw new Error(res.error || 'Failed to advance match.');
    }
    return { success: true };
  }

  // ===========================================================================
  // PHASE 6: AUTHORITATIVE DOTA MATCH LINKING & OPENDOTA DATA
  // ===========================================================================

  public async executeLinkDotaMatchId(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      gameNumber: number;
      dotaMatchId: string;
      snapshotOverride?: any;
      manualStatusAttempt?: any;
    }
  ): Promise<{
    success: boolean;
    reconciliationStatus: OpenDotaReconciliationStatus;
    game?: DotaGameStatsDetail;
    reviewFlags?: ReconciliationReviewFlag[];
  }> {
    // 1. Security Check: Client must not directly set reconciliation status
    if (payload.manualStatusAttempt || (payload as any).reconciliationStatus) {
      throw new Error('DENIED: Direct client mutation of reconciliation status is forbidden. All reconciliation is server-authoritative.');
    }

    // 2. Execute authoritative linking
    const res = await dotaMatchOperations.linkDotaMatchId(
      payload.matchId,
      payload.gameNumber,
      payload.dotaMatchId,
      caller,
      payload.snapshotOverride
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to link Dota 2 Match ID.');
    }

    // 3. Persist link in Firebase Firestore
    try {
      if (db && !isQuotaExhausted()) {
        setDoc(
          doc(db, 'linkedDotaMatches', `${payload.matchId}_g${payload.gameNumber}`),
          {
            matchId: payload.matchId,
            gameNumber: payload.gameNumber,
            dotaMatchId: payload.dotaMatchId,
            reconciliationStatus: res.reconciliationStatus,
            linkedBy: caller.userId,
            linkedRole: caller.role,
            linkedAt: new Date().toISOString()
          },
          { merge: true }
        ).catch((err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
          }
        });
      }
    } catch {
      // Local execution fallback
    }

    // 4. Authoritative audit log
    this.appendAuditLog({
      action: 'dota_match_linked',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'dota_match_game',
      details: `Linked Dota 2 match ${payload.dotaMatchId} to Game ${payload.gameNumber} of match ${payload.matchId}. Status: ${res.reconciliationStatus}`
    });

    return {
      success: true,
      reconciliationStatus: res.reconciliationStatus!,
      game: res.game,
      reviewFlags: res.reviewFlags
    };
  }

  public async executeRefreshOpenDotaMatchData(
    caller: ServerCallerContext,
    payload: { matchId: string; gameNumber: number }
  ): Promise<{
    success: boolean;
    reconciliationStatus?: OpenDotaReconciliationStatus;
    game?: DotaGameStatsDetail;
    cached?: boolean;
  }> {
    const res = await dotaMatchOperations.refreshOpenDotaMatchData(
      payload.matchId,
      payload.gameNumber,
      caller
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to refresh OpenDota match data.');
    }

    if (!res.cached) {
      this.appendAuditLog({
        action: 'dota_match_refreshed',
        actorId: caller.userId,
        actorRole: caller.role,
        entityId: payload.matchId,
        entityType: 'dota_match_game',
        details: `Refreshed OpenDota data for Game ${payload.gameNumber} of match ${payload.matchId}. Status: ${res.reconciliationStatus}`
      });
    }

    return res;
  }

  public executeReviewMismatchFlag(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      gameNumber: number;
      flagId: string;
      action: 'ACKNOWLEDGE' | 'DISMISS' | 'RESOLVE';
      notes?: string;
    }
  ): { success: boolean } {
    this.assertOrganiserOrAdmin(caller);

    const res = dotaMatchOperations.reviewMismatchFlag(
      payload.matchId,
      payload.gameNumber,
      payload.flagId,
      payload.action,
      caller,
      payload.notes
    );

    if (!res.success) {
      throw new Error(res.error || 'Failed to review mismatch flag.');
    }

    this.appendAuditLog({
      action: 'mismatch_flag_reviewed',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.flagId,
      entityType: 'reconciliation_flag',
      details: `Mismatch flag ${payload.flagId} in Game ${payload.gameNumber} of match ${payload.matchId} reviewed as ${payload.action} by ${caller.userId}`
    });

    return { success: true };
  }

  // -------------------------------------------------------------
  // Phase 7: Careers, Ratings, Rankings & Seasons Server Handlers
  // -------------------------------------------------------------
  public async executeProcessMatchRating(
    caller: ServerCallerContext,
    payload: CanonicalMatchRatingPayload
  ): Promise<{ success: boolean; alreadyProcessed?: boolean; error?: string; eventsCount: number; teamDelta: number }> {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Unauthorized. Only tournament organizers can process rating events.');
    }

    const res = dotaCareerHistoryEngine.processMatchRating(payload, caller);
    if (!res.success) {
      throw new Error(res.error || 'Failed to process match rating.');
    }

    this.appendAuditLog({
      action: 'match_rating_processed',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'rating_event',
      details: `Processed match ${payload.matchId} rating for tournament ${payload.tournamentId}. Delta: ${res.teamDelta}`
    });

    return {
      success: true,
      alreadyProcessed: res.alreadyProcessed,
      eventsCount: res.events.length,
      teamDelta: res.teamDelta
    };
  }

  public async executeFinalizeTournamentCompletion(
    caller: ServerCallerContext,
    tournamentId: string,
    payload: any
  ): Promise<{ success: boolean; alreadyCompleted?: boolean; error?: string; championTeamName?: string }> {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Unauthorized. Only tournament organizers can finalize tournament completion.');
    }

    const res = dotaCareerHistoryEngine.finalizeTournamentCompletion(tournamentId, payload, caller);
    if (!res.success) {
      throw new Error(res.error || 'Failed to finalize tournament completion.');
    }

    this.appendAuditLog({
      action: 'tournament_completion_finalized',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: tournamentId,
      entityType: 'tournament',
      details: `Finalized tournament completion for ${tournamentId}. Champion: ${res.championTeamName}`
    });

    return {
      success: true,
      alreadyCompleted: res.alreadyCompleted,
      championTeamName: res.championTeamName
    };
  }

  public async executeResultCorrectionRebuild(
    caller: ServerCallerContext,
    payload: {
      matchId: string;
      correctedWinnerTeamId: string;
      correctedLoserTeamId: string;
      correctedWinnerScore: number;
      correctedLoserScore: number;
      winnerRosterPlayerIds: string[];
      loserRosterPlayerIds: string[];
    }
  ): Promise<{ success: boolean; totalMatchesProcessed: number }> {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Unauthorized. Only organizers can execute audited result corrections.');
    }

    const res = dotaCareerHistoryEngine.correctMatchResultAndRebuild(
      payload.matchId,
      payload.correctedWinnerTeamId,
      payload.correctedLoserTeamId,
      payload.correctedWinnerScore,
      payload.correctedLoserScore,
      payload.winnerRosterPlayerIds,
      payload.loserRosterPlayerIds,
      caller
    );

    if (!res.success) {
      throw new Error(res.error || 'Result correction failed.');
    }

    this.appendAuditLog({
      action: 'result_correction_rebuild',
      actorId: caller.userId,
      actorRole: caller.role,
      entityId: payload.matchId,
      entityType: 'match_correction',
      details: `Audited result correction on match ${payload.matchId}. Rebuilt ${res.totalMatchesProcessed} matches.`
    });

    return {
      success: true,
      totalMatchesProcessed: res.totalMatchesProcessed
    };
  }

  // Getters for inspecting authoritative server state
  public getAuctionSnapshot(): AuthoritativeAuctionState {
    return { ...this.auctionState };
  }

  public getTeamBudgetsSnapshot(): AuctionTeamState[] {
    return this.teamBudgets.map(t => ({ ...t }));
  }

  // -------------------------------------------------------------
  // Phase 8: Tournament Operations & Admin Methods
  // -------------------------------------------------------------
  public publishTournamentRules(
    tournamentId: string,
    sections: TournamentRuleSection[],
    caller: ServerCallerContext,
    changeSummary?: string
  ) {
    return dotaTournamentOperations.publishRules(tournamentId, sections, caller, changeSummary);
  }

  public postTournamentAnnouncement(
    announcement: Omit<TournamentAnnouncement, 'id' | 'timestamp'>,
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.postAnnouncement(announcement, caller);
  }

  public submitTournamentReport(
    payload: {
      tournamentId?: string;
      targetId: string;
      targetName: string;
      targetType: 'player' | 'team';
      category: ReportCategory;
      description: string;
      evidenceUrls?: string[];
      evidenceText?: string;
    },
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.submitReport(payload, caller);
  }

  public reviewTournamentReport(
    reportId: string,
    action: {
      status: ReportStatus;
      note?: string;
      evidenceRequestNote?: string;
      resolutionSummary?: string;
      sanctionApplied?: string;
    },
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.reviewReport(reportId, action, caller);
  }

  public previewDisqualification(
    tournamentId: string,
    targetId: string,
    targetType: 'player' | 'team',
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.previewDisqualification(tournamentId, targetId, targetType, caller);
  }

  public executeDisqualification(
    payload: {
      tournamentId: string;
      targetId: string;
      targetType: 'player' | 'team';
      reason: string;
      evidenceReference?: string;
    },
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.executeDisqualification(payload, caller);
  }

  public issuePlatformSanction(
    payload: {
      userId: string;
      sanctionType: PlatformSanctionType;
      reason: string;
      durationDays?: number;
    },
    caller: ServerCallerContext
  ) {
    return dotaTournamentOperations.issuePlatformSanction(payload, caller);
  }
}

export const trustedTournamentOps = new TrustedTournamentServer({
  auctionState: {
    tournamentId: 'purple-bean-india-masters-2026',
    status: 'open',
    revision: 1,
    currentBid: 50,
    leadingTeamId: '',
    leadingTeamName: '',
    currentPlayer: {} as any,
    secondsLeft: 30,
    bidHistory: [],
    soldPlayers: [],
    unsoldPlayers: [],
    unselectedPlayers: []
  },
  teamBudgets: [],
  tournaments: [],
  matches: [],
  teams: [],
  brackets: []
});

