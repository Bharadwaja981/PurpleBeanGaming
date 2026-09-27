import { describe, it, expect, beforeEach } from 'vitest';
import { 
  canTransitionTournament, 
  validateTournamentTransition, 
  TournamentStatus 
} from '../../src/domain/tournamentStateMachine';
import { 
  validateBidRosterConstraint, 
  getRosterConfigForGame, 
  GAME_ROSTER_CONFIGS 
} from '../../src/domain/rosterRules';
import { 
  calculateMatchPoints, 
  compileBRLeaderboard, 
  BRTeamMatchResult 
} from '../../src/domain/battleRoyaleEngine';
import { 
  CompetitiveRatingLedger, 
  calculateEloDelta 
} from '../../src/domain/competitiveRatingEngine';
import { tournamentService } from '../../src/services/firebaseService';

describe('1. Tournament State Machine Integrity', () => {
  it('allows canonical sequential transitions', () => {
    expect(canTransitionTournament('draft', 'registration')).toBe(true);
    expect(canTransitionTournament('registration', 'verification')).toBe(true);
    expect(canTransitionTournament('verification', 'rating_review')).toBe(true);
    expect(canTransitionTournament('rating_review', 'player_pool_locked')).toBe(true);
    expect(canTransitionTournament('player_pool_locked', 'auction_ready')).toBe(true);
    expect(canTransitionTournament('auction_ready', 'auction_live')).toBe(true);
    expect(canTransitionTournament('auction_live', 'rosters_locked')).toBe(true);
    expect(canTransitionTournament('rosters_locked', 'competition')).toBe(true);
    expect(canTransitionTournament('competition', 'completed')).toBe(true);
  });

  it('strictly forbids illegal shortcut state jumps', () => {
    // Jump from registration straight to completed must FAIL
    expect(canTransitionTournament('registration', 'completed')).toBe(false);
    const check1 = validateTournamentTransition('registration', 'completed');
    expect(check1.valid).toBe(false);
    expect(check1.reason).toContain('Illegal tournament state transition');

    // Jump from draft straight to auction_live must FAIL
    expect(canTransitionTournament('draft', 'auction_live')).toBe(false);

    // Terminal completed state cannot transition backwards
    expect(canTransitionTournament('completed', 'competition')).toBe(false);
    expect(canTransitionTournament('completed', 'draft')).toBe(false);
  });
});

describe('2. Game-Aware Roster Rules & Stand-In Constraints', () => {
  it('correctly distinguishes Dota 2/Valorant (5) vs BGMI/PUBG (4) roster sizes', () => {
    const dotaConfig = getRosterConfigForGame('Dota 2');
    expect(dotaConfig.primaryRosterSize).toBe(5);
    expect(dotaConfig.optionalStandInAllowed).toBe(true);
    expect(dotaConfig.maxStandIns).toBe(1);

    const bgmiConfig = getRosterConfigForGame('BGMI');
    expect(bgmiConfig.primaryRosterSize).toBe(4);
    expect(bgmiConfig.optionalStandInAllowed).toBe(true);
  });

  it('enforces purse reserve constraint for remaining unfilled slots', () => {
    const config = getRosterConfigForGame('Dota 2');
    // Team has 2 players drafted, needs 2 more primary players (total 5: captain + 4)
    // 2 unfilled slots * ₹10,000 minReserve = ₹20,000 must remain after bid
    
    // Team has ₹1,00,000 credits, attempts ₹95,000 bid -> remaining would be ₹5,000 < ₹20,000 -> INVALID
    const illegalBid = validateBidRosterConstraint(100000, 95000, 2, config);
    expect(illegalBid.valid).toBe(false);
    expect(illegalBid.reason).toContain('Illegal bid! Team must reserve');

    // Team has ₹1,00,000 credits, attempts ₹70,000 bid -> remaining ₹30,000 >= ₹20,000 -> VALID
    const legalBid = validateBidRosterConstraint(100000, 70000, 2, config);
    expect(legalBid.valid).toBe(true);
  });

  it('rejects bids exceeding available purse balance', () => {
    const config = getRosterConfigForGame('Dota 2');
    const res = validateBidRosterConstraint(50000, 60000, 1, config);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Insufficient purse balance');
  });
});

describe('3. Auction Concurrency, Transactions & Idempotency', () => {
  beforeEach(() => {
    tournamentService.switchUser('00000000-0000-4000-8000-000000000001'); // Lead Organizer
  });

  it('safely handles concurrent competing bids in sequence', async () => {
    const initialBid = tournamentService.getAuctionState().currentBid;
    
    // Simulate 3 competing bids placed simultaneously with Promise.all
    const [res1, res2, res3] = await Promise.all([
      tournamentService.placeBid(10000, 't-1'),
      tournamentService.placeBid(20000, 't-2'),
      tournamentService.placeBid(30000, 't-3')
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res3.success).toBe(true);

    const finalState = tournamentService.getAuctionState();
    expect(finalState.currentBid).toBeGreaterThan(initialBid);
    expect(finalState.bidHistory.length).toBeGreaterThanOrEqual(3);
  });

  it('guarantees bid idempotency (preventing duplicate deduction on retry)', async () => {
    const idempotencyKey = 'idemp-bid-unique-test-key-123';
    
    const firstAttempt = await tournamentService.placeBid(10000, 't-1', idempotencyKey);
    expect(firstAttempt.success).toBe(true);

    const stateAfterFirst = tournamentService.getAuctionState().currentBid;

    // Retry with the exact same idempotencyKey
    const retryAttempt = await tournamentService.placeBid(10000, 't-1', idempotencyKey);
    expect(retryAttempt.success).toBe(true);
    expect(retryAttempt.message).toContain('idempotent duplicate request');

    // Current bid must NOT increment twice
    const stateAfterRetry = tournamentService.getAuctionState().currentBid;
    expect(stateAfterRetry).toBe(stateAfterFirst);
  });

  it('preserves SOLD, UNSOLD, and UNSELECTED categories distinctly', () => {
    const initialUnsold = tournamentService.getAuctionState().unsoldPlayers.length;
    
    // Conclude without winner -> UNSOLD
    const unsoldResult = tournamentService.concludeAuctionItem(false);
    expect(unsoldResult.outcome).toBe('UNSOLD');
    expect(tournamentService.getAuctionState().unsoldPlayers.length).toBe(initialUnsold + 1);

    // Conclude with winner -> SOLD
    const soldResult = tournamentService.concludeAuctionItem(true);
    expect(soldResult.outcome).toBe('SOLD');

    // UNSELECTED players must remain untouched in the pool
    expect(tournamentService.getAuctionState().unselectedPlayers).toBeDefined();
  });
});

describe('4. Scoped Roles & Negative Security Authorization', () => {
  it('denies auction bids from unauthenticated spectators', async () => {
    tournamentService.switchUser('guest-spectator'); // Spectator role
    
    const res = await tournamentService.placeBid(10000, 't-1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Unauthorized: Only registered team captains');
  });

  it('denies tournament state transitions from standard players or captains', async () => {
    tournamentService.switchUser('00000000-0000-4000-8000-000000000002'); // Captain
    
    const res = await tournamentService.transitionTournamentStatus('purple-bean-india-masters-2026', 'completed');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Forbidden: Only organizers can transition tournament state');
  });

  it('denies captains from placing bids on behalf of rival teams', async () => {
    tournamentService.switchUser('00000000-0000-4000-8000-000000000002'); // Captain of Mumbai Cobras (t-2)
    
    // Attempts to bid for Purple Bean Titans (t-1)
    const res = await tournamentService.placeBid(10000, 't-1');
    expect(res.success).toBe(false);
    expect(res.message).toContain('Permission Denied: Captain of Mumbai Cobras cannot place bids on behalf of Purple Bean Titans');
  });
});

describe('5. Public Player Privacy Separation', () => {
  it('guarantees zero PII in public player profiles', () => {
    const publicProfile = tournamentService.getPublicPlayer('p-1');
    expect(publicProfile).toBeDefined();
    expect(publicProfile?.username).toBe('SkRossi');
    expect(publicProfile?.mmr).toBe(8980);

    // Critical: No sensitive account data leaked
    expect((publicProfile as any).email).toBeUndefined();
    expect((publicProfile as any).phone).toBeUndefined();
    expect((publicProfile as any).steamId64).toBeUndefined();
    expect((publicProfile as any).moderationNotes).toBeUndefined();
  });

  it('restricts private account access to owner or organizer', () => {
    tournamentService.switchUser('guest-spectator'); // Spectator
    
    const privateRead = tournamentService.getPrivatePlayerAccount('00000000-0000-4000-8000-000000000001');
    expect(privateRead.success).toBe(false);
    expect(privateRead.error).toContain('Permission Denied');
  });
});

describe('6. Battle Royale Points Engine (BGMI & PUBG)', () => {
  it('accurately computes WWCD placement and finish points', () => {
    // 1st place (10 pts) + 8 kills (8 pts) = 18 pts
    const p1 = calculateMatchPoints(1, 8);
    expect(p1.placementPts).toBe(10);
    expect(p1.finishPts).toBe(8);
    expect(p1.total).toBe(18);

    // 2nd place (6 pts) + 4 kills (4 pts) = 10 pts
    const p2 = calculateMatchPoints(2, 4);
    expect(p2.placementPts).toBe(6);
    expect(p2.finishPts).toBe(4);
    expect(p2.total).toBe(10);
  });

  it('compiles multi-match leaderboard with official tiebreak rules', () => {
    const match1: Array<BRTeamMatchResult> = [
      { teamId: 't-1', teamName: 'PB Titans', tag: 'PBT', placement: 1, finishes: 5 }, // 10 + 5 = 15 pts (1 WWCD)
      { teamId: 't-2', teamName: 'Mumbai Cobras', tag: 'MC', placement: 2, finishes: 10 } // 6 + 10 = 16 pts (0 WWCD)
    ];

    const match2: Array<BRTeamMatchResult> = [
      { teamId: 't-1', teamName: 'PB Titans', tag: 'PBT', placement: 3, finishes: 2 }, // 5 + 2 = 7 pts. Total = 22 pts
      { teamId: 't-2', teamName: 'Mumbai Cobras', tag: 'MC', placement: 1, finishes: 4 } // 10 + 4 = 14 pts. Total = 30 pts (1 WWCD)
    ];

    const leaderboard = compileBRLeaderboard([
      { matchId: 'm-1', results: match1 },
      { matchId: 'm-2', results: match2 }
    ]);

    expect(leaderboard.length).toBe(2);
    // Mumbai Cobras (30 pts) should be #1
    expect(leaderboard[0].teamName).toBe('Mumbai Cobras');
    expect(leaderboard[0].totalPoints).toBe(30);
    expect(leaderboard[0].rank).toBe(1);

    // PB Titans (22 pts) should be #2
    expect(leaderboard[1].teamName).toBe('PB Titans');
    expect(leaderboard[1].totalPoints).toBe(22);
    expect(leaderboard[1].rank).toBe(2);
  });
});

describe('7. Competitive Rating Engine & Idempotency', () => {
  it('calculates deterministic Elo deltas and prevents duplicate rating updates', () => {
    const ledger = new CompetitiveRatingLedger();
    const matchId = 'm-final-test-101';
    
    const firstRun = ledger.applyMatchResult(matchId, 'team-alpha', 'team-beta', 1800, 1800);
    expect(firstRun.success).toBe(true);
    expect(firstRun.alreadyApplied).toBe(false);
    expect(firstRun.record.winnerNewRating).toBeGreaterThan(1800);
    expect(firstRun.record.loserNewRating).toBeLessThan(1800);

    // Re-run with the same matchId / idempotency key
    const duplicateRun = ledger.applyMatchResult(matchId, 'team-alpha', 'team-beta', 1800, 1800);
    expect(duplicateRun.success).toBe(true);
    expect(duplicateRun.alreadyApplied).toBe(true);
    expect(duplicateRun.record.delta).toBe(firstRun.record.delta);
  });

  it('correctly handles result corrections by rolling back previous rating delta', () => {
    const ledger = new CompetitiveRatingLedger();
    const matchId = 'm-dispute-test-202';
    
    // Team A originally reported won
    const original = ledger.applyMatchResult(matchId, 'team-a', 'team-b', 1800, 1800);
    
    // Organizer referee corrects result: Team B actually won
    const corrected = ledger.correctMatchResult(
      matchId,
      original.record,
      'team-b',
      'team-a',
      original.record.winnerNewRating,
      original.record.loserNewRating
    );

    expect(corrected.success).toBe(true);
    expect(corrected.record.winnerTeamId).toBe('team-b');
    expect(corrected.record.isCorrection).toBe(true);
  });
});
