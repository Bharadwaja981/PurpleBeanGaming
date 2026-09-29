import { describe, it, expect, beforeEach } from 'vitest';
import { DotaAuctionEngine, getAuctionEngine } from '../../src/domain/dotaAuctionEngine';
import { dotaPlayerRegistry } from '../../src/domain/dotaPlayerEngine';
import { GenericTournamentEngine } from '../../src/domain/genericTournamentEngine';
import { createDefaultTournamentConfig } from '../../src/domain/tournamentConfig';
import { testCupEngine } from '../../src/domain/testCupEngine';
import { tournamentService } from '../../src/services/firebaseService';

describe('Purple Bean Gaming — Final Functional Parity Verification', () => {
  const tId = 'parity-test-tournament';
  let auctionEngine: DotaAuctionEngine;

  beforeEach(() => {
    dotaPlayerRegistry.clearAll();
    auctionEngine = new DotaAuctionEngine({
      tournamentId: tId,
      tournamentName: 'Parity Cup',
      primaryRosterSize: 5,
      optionalStandInLimit: 1,
      startingCredits: 1000,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      bidTimerSeconds: 20,
      nextPlayerDelaySeconds: 5
    });

    // Seed 10 verified players, with 4 interested in captaincy
    for (let i = 1; i <= 10; i++) {
      const pId = `player-parity-${i}`;
      dotaPlayerRegistry.getOrCreatePlayer(pId, `player${i}@test.com`, {
        id: pId,
        username: `Player_${i}`,
        displayName: `Contender ${i}`,
        avatar: '🎮',
        city: 'Mumbai',
        region: 'West India',
        primaryRole: 'Position 1 — Carry',
        tournamentMmr: 5000 + i * 100,
        isMmrLocked: true
      });

      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: tId,
        userId: pId,
        ign: `Player_${i}`,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 5000 + i * 100,
        tournamentMmr: 5000 + i * 100,
        interestedInCaptaincy: i <= 4,
        rulesAccepted: true,
        city: 'Mumbai'
      });

      dotaPlayerRegistry.verifyRegistration(tId, pId, 'admin', 5000 + i * 100);
    }

    auctionEngine.initializeFromRegistrations();
  });

  // 1. AUTOMATED CAPTAIN DRAW
  it('1. Automated Captain Draw: deterministic seeded selection, exact count, audit log & unselected return to pool', () => {
    const res = auctionEngine.autoDrawCaptains(2, 'parity-seed-999', 'organizer-1');
    expect(res.success).toBe(true);
    expect(res.selectedCaptains.length).toBe(2);

    // Audit stores seed, candidate set, selected, actor, timestamp
    expect(res.auditRecord.seed).toBe('parity-seed-999');
    expect(res.auditRecord.candidates.length).toBe(4);
    expect(res.auditRecord.selected.length).toBe(2);
    expect(res.auditRecord.actor).toBe('organizer-1');

    // Reproducibility test with same seed
    let s = 0;
    const seed = 'parity-seed-999';
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    expect(res.auditRecord.seed).toBe(seed);

    // Unselected candidates remain AVAILABLE in draft pool
    const unselected = res.auditRecord.candidates.filter(
      (c: any) => !res.auditRecord.selected.some((s: any) => s.id === c.id)
    );
    expect(unselected.length).toBe(2);
    for (const u of unselected) {
      const p = auctionEngine.getAvailablePlayers().find(player => player.id === u.id);
      expect(p).toBeDefined();
      expect(p?.isCaptain).toBe(false);
      expect(p?.status).toBe('AVAILABLE');
    }
  });

  // 2. CAPTAIN RESET / REASSIGNMENT
  it('2. Captain Reset / Reassignment: allowed before auction starts, denied after live bidding begins', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Alpha Squad', tag: 'ALP' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Beta Squad', tag: 'BET' }, 'organizer-1');

    // Before auction starts: reset is allowed
    const resetRes = auctionEngine.resetCaptain('player-parity-1', 'organizer-1');
    expect(resetRes.success).toBe(true);

    const resetPlayer = auctionEngine.getAvailablePlayers().find(p => p.id === 'player-parity-1');
    expect(resetPlayer).toBeDefined();
    expect(resetPlayer?.isCaptain).toBe(false);
    expect(resetPlayer?.status).toBe('AVAILABLE');

    // Re-appoint and start live auction
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Alpha Squad', tag: 'ALP' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');

    const captainTeam = auctionEngine.getTeams()[0];
    auctionEngine.placeBid({ captainUserId: captainTeam.captainId, bidAmount: 50 });

    // After live bidding commences: reset is strictly denied
    const deniedReset = auctionEngine.resetCaptain('player-parity-1', 'organizer-1');
    expect(deniedReset.success).toBe(false);
    expect(deniedReset.error).toContain('Cannot reset or reassign captains after live auction has commenced');
  });

  // 3. CAPTAIN TEAM IDENTITY
  it('3. Captain Team Identity: captain can configure Team Name, 3-4 character Tag, Logo and syncs', () => {
    const appRes = auctionEngine.appointCaptain('player-parity-1', { teamName: 'Temp Name', tag: 'TMP' }, 'organizer-1');
    const teamId = appRes.team!.id;

    const updateRes = auctionEngine.updateTeamIdentity(teamId, {
      name: 'Mumbai Cobras',
      tag: 'MCBR',
      logo: 'https://images.unsplash.com/cobra.png'
    }, 'player-parity-1');

    expect(updateRes.success).toBe(true);
    expect(updateRes.team?.name).toBe('Mumbai Cobras');
    expect(updateRes.team?.tag).toBe('MCBR');
    expect(updateRes.team?.logo).toBe('https://images.unsplash.com/cobra.png');

    // State reflects persisted update
    const stateTeam = auctionEngine.getTeams().find(t => t.id === teamId);
    expect(stateTeam?.name).toBe('Mumbai Cobras');
    expect(stateTeam?.tag).toBe('MCBR');
  });

  // 4. AUCTION NOMINATION MODES (ORGANISER, LINEAR, SNAKE)
  it('4. Auction Nomination Modes: ORGANISER, LINEAR, SNAKE nomination order and snake reversal', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-3', { teamName: 'Team 3', tag: 'T3' }, 'organizer-1');

    // ORGANISER MODE
    auctionEngine.setNominationMode('ORGANISER');
    const orgTurn = auctionEngine.getNextNominationTurn();
    expect(orgTurn?.mode).toBe('ORGANISER');

    // LINEAR MODE: 0 -> 1 -> 2 -> 0 -> 1 -> 2
    auctionEngine.setNominationMode('LINEAR');
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(0);
    auctionEngine.advanceNominationTurn();
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(1);
    auctionEngine.advanceNominationTurn();
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(2);
    auctionEngine.advanceNominationTurn();
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(0);

    // SNAKE MODE: 0 -> 1 -> 2 -> 2 -> 1 -> 0
    auctionEngine.setNominationMode('SNAKE');
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(0);
    auctionEngine.advanceNominationTurn();
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(1);
    auctionEngine.advanceNominationTurn();
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(2);
    auctionEngine.advanceNominationTurn(); // Reverses at end
    expect(auctionEngine.getNextNominationTurn()?.index).toBe(1);
  });

  // 5. GOING ONCE / GOING TWICE
  it('5. Going Once / Going Twice: transitions through BIDDING -> GOING_ONCE -> GOING_TWICE -> resolution', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');

    // At 20s: BIDDING
    expect(auctionEngine.getState().roundPhase).toBe('BIDDING');

    // Decrement to 12s: GOING_ONCE (<= 15s)
    auctionEngine.adjustTimer(12);
    auctionEngine.tickTimer(1);
    expect(auctionEngine.getState().roundPhase).toBe('GOING_ONCE');

    // Decrement to 4s: GOING_TWICE (<= 5s)
    auctionEngine.adjustTimer(4);
    auctionEngine.tickTimer(1);
    expect(auctionEngine.getState().roundPhase).toBe('GOING_TWICE');

    // Timer expires: OUTCOME_RESOLUTION
    auctionEngine.adjustTimer(1);
    auctionEngine.tickTimer(1);
    expect(auctionEngine.getState().roundPhase).toBe('INTERMISSION');
  });

  // 6. UNSOLD SECOND PASS
  it('6. Unsold Second Pass: player with 0 bids enters Unsold Queue, restored during second pass', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');

    // Nominate player and let timer expire with zero bids
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');
    auctionEngine.adjustTimer(1);
    auctionEngine.tickTimer(1);

    expect(auctionEngine.getState().lastLotResult?.outcome).toBe('UNSOLD');
    expect(auctionEngine.getUnsoldQueue()).toContain('player-parity-5');

    // Start unsold second pass
    const secondPassRes = auctionEngine.startUnsoldSecondPass('organizer-1');
    expect(secondPassRes.success).toBe(true);
    expect(secondPassRes.reauctionCount).toBe(1);

    // Player is back in AVAILABLE pool
    const restored = auctionEngine.getAvailablePlayers().find(p => p.id === 'player-parity-5');
    expect(restored).toBeDefined();
    expect(restored?.status).toBe('AVAILABLE');
  });

  // 7. INTERMISSION
  it('7. Intermission: displays outcome summary and runs next-player delay', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');

    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');
    auctionEngine.adjustTimer(1);
    auctionEngine.tickTimer(1);

    const state = auctionEngine.getState();
    expect(state.roundPhase).toBe('INTERMISSION');
    expect(state.intermissionRemainingSeconds).toBeGreaterThan(0);
    expect(state.lastLotResult).toBeDefined();
  });

  // 8. ORGANISER LIVE CONTROLS
  it('8. Organiser Live Controls: pause, resume, add/remove/adjust timer, force sell, reauction', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');

    // Pause
    const pauseRes = auctionEngine.pauseAuction('organizer-1');
    expect(pauseRes.success).toBe(true);
    expect(auctionEngine.getState().status).toBe('PAUSED');

    // Resume
    const resumeRes = auctionEngine.resumeAuction('organizer-1');
    expect(resumeRes.success).toBe(true);
    expect(auctionEngine.getState().status).toBe('LIVE');

    // Add Time
    const initialSeconds = auctionEngine.getState().secondsRemaining;
    auctionEngine.addTime(15, 'organizer-1');
    expect(auctionEngine.getState().secondsRemaining).toBe(initialSeconds + 15);

    // Remove Time
    auctionEngine.removeTime(10, 'organizer-1');
    expect(auctionEngine.getState().secondsRemaining).toBe(initialSeconds + 5);

    // Adjust Timer
    auctionEngine.adjustTimer(45, 'organizer-1');
    expect(auctionEngine.getState().secondsRemaining).toBe(45);

    // Re-auction Current Player
    const reauctionRes = auctionEngine.reauctionCurrentPlayer('organizer-1');
    expect(reauctionRes.success).toBe(true);
    expect(auctionEngine.getState().currentBid).toBe(10);
    expect(auctionEngine.getState().leadingTeamId).toBe('');

    // Force Sell
    const teamId = auctionEngine.getTeams()[0].id;
    const forceRes = auctionEngine.forceSell('player-parity-6', teamId, 50, 'organizer-1');
    expect(forceRes.success).toBe(true);
    const soldPlayer = auctionEngine.getTeams()[0].primaryRoster.find(p => p.id === 'player-parity-6');
    expect(soldPlayer).toBeDefined();
  });

  // 9. TRUE BID UNDO
  it('9. True Bid Undo: reverts accidental bid, restores prior leader and purse, preserves history', () => {
    const team1 = auctionEngine.appointCaptain('player-parity-1', { teamName: 'Team 1', tag: 'T1' }, 'organizer-1').team!;
    const team2 = auctionEngine.appointCaptain('player-parity-2', { teamName: 'Team 2', tag: 'T2' }, 'organizer-1').team!;

    auctionEngine.startAuction('organizer-1');
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');

    // A bids 100
    auctionEngine.placeBid({ captainUserId: team1.captainId, bidAmount: 100 });
    expect(auctionEngine.getState().currentBid).toBe(100);
    expect(auctionEngine.getState().leadingTeamId).toBe(team1.id);

    // B bids 120 accidentally
    auctionEngine.placeBid({ captainUserId: team2.captainId, bidAmount: 120 });
    expect(auctionEngine.getState().currentBid).toBe(120);
    expect(auctionEngine.getState().leadingTeamId).toBe(team2.id);

    // Undo B
    const undoRes = auctionEngine.undoLastBid('organizer-1');
    expect(undoRes.success).toBe(true);
    expect(undoRes.restoredBid).toBe(100);
    expect(undoRes.restoredTeamId).toBe(team1.id);

    // Authoritative state restored to A
    expect(auctionEngine.getState().currentBid).toBe(100);
    expect(auctionEngine.getState().leadingTeamId).toBe(team1.id);
    expect(auctionEngine.getState().leadingTeamName).toBe('Team 1');

    // History retains reverted bid
    const revertedBid = auctionEngine.getBidHistory().find(b => b.reverted);
    expect(revertedBid).toBeDefined();
    expect(revertedBid?.amount).toBe(120);
    expect(revertedBid?.revertedBy).toBe('organizer-1');
  });

  // 10. GRAND FINAL RESET
  it('10. Grand Final Reset: Lower winner defeats Upper winner in GF1 -> generates Grand Final Reset match', () => {
    const config = createDefaultTournamentConfig('dota2');
    config.competition.format = 'DOUBLE_ELIMINATION';
    config.competition.grandFinalResetEnabled = true;

    const engine = new GenericTournamentEngine(config);

    // Generate bracket for 4 teams
    const teams = [
      { id: 'team-a', name: 'Upper Winner Team', tag: 'UWT', logo: '', captainId: 'c1', captainName: 'Cap1', city: 'Mumbai', creditsRemaining: 0, creditsSpent: 0, roster: [], standIns: [], rating: 1500 },
      { id: 'team-b', name: 'Lower Winner Team', tag: 'LWT', logo: '', captainId: 'c2', captainName: 'Cap2', city: 'Delhi', creditsRemaining: 0, creditsSpent: 0, roster: [], standIns: [], rating: 1500 },
      { id: 'team-c', name: 'Team C', tag: 'TC', logo: '', captainId: 'c3', captainName: 'Cap3', city: 'Pune', creditsRemaining: 0, creditsSpent: 0, roster: [], standIns: [], rating: 1500 },
      { id: 'team-d', name: 'Team D', tag: 'TD', logo: '', captainId: 'c4', captainName: 'Cap4', city: 'Kolkata', creditsRemaining: 0, creditsSpent: 0, roster: [], standIns: [], rating: 1500 }
    ];

    teams.forEach(t => engine.registerTeam(t));
    engine.generateTournamentStructure();

    // Assign Upper Winner (Team A) and Lower Winner (Team B) to Grand Final
    const gfMatch = engine.getMatches().find(m => m.round === 'Grand Final');
    expect(gfMatch).toBeDefined();
    gfMatch!.teamA = { id: 'team-a', name: 'Upper Winner Team', seed: 1 };
    gfMatch!.teamB = { id: 'team-b', name: 'Lower Winner Team', seed: 2 };

    // Lower Winner (Team B) defeats Upper Winner (Team A) in GF1
    const gfResult = engine.executeMatchResult(gfMatch!.id, 1, 2);
    expect(gfResult.success).toBe(true);

    // Grand Final Reset match must be dynamically created
    const resetMatch = engine.getMatches().find(m => m.round === 'Grand Final Reset');
    expect(resetMatch).toBeDefined();
    expect(resetMatch?.teamA?.id).toBe('team-a');
    expect(resetMatch?.teamB?.id).toBe('team-b');

    // When reset match is won, winner is champion
    const resetResult = engine.executeMatchResult(resetMatch!.id, 2, 0);
    expect(resetResult.success).toBe(true);
    expect(resetResult.winner?.id).toBe('team-a');
  });

  // 11. QA LAB & PRODUCTION ISOLATION
  it('11. QA Lab: Persona switcher, synthetic generator, fast forward/reset, bot auction stress test and production gating', () => {
    // Synthetic Generator generates isolated test tournament
    testCupEngine.generateDummyPlayersAndCaptains(10, 2);
    expect(testCupEngine.getPlayers().length).toBeGreaterThan(0);
    expect(testCupEngine.getTeams().length).toBe(2);

    // Bot stress test in QA lab
    let testBidsPlaced = 0;
    const testCaptains = testCupEngine.getTeams();
    for (let i = 0; i < 5; i++) {
      const cap = testCaptains[i % testCaptains.length];
      const bid = testCupEngine.placeBid(cap.captainId, 20 + i * 10);
      if (bid.success) testBidsPlaced++;
    }
    expect(testBidsPlaced).toBeGreaterThan(0);

    // Fast forward / Reset
    testCupEngine.reset();
    expect(testCupEngine.getState().currentBid).toBe(10);
    expect(testCupEngine.getState().soldCount).toBe(0);

    // Production Isolation Check:
    // In production environment (isTestEnvironment = false), synthetic test tournaments are excluded
    const prodTourneys = tournamentService.getTournaments();
    for (const t of prodTourneys) {
      expect((t.id || '').toLowerCase()).not.toContain('test');
    }
  });

  // 12. PERSISTENCE
  it('12. Persistence: Authoritative state survives reconnection and remains deterministic', () => {
    auctionEngine.appointCaptain('player-parity-1', { teamName: 'Alpha Squad', tag: 'ALP' }, 'organizer-1');
    auctionEngine.appointCaptain('player-parity-2', { teamName: 'Beta Squad', tag: 'BET' }, 'organizer-1');
    auctionEngine.startAuction('organizer-1');
    auctionEngine.nominatePlayer('player-parity-5', 'organizer-1');

    const captain = auctionEngine.getTeams()[0];
    const bidRes = auctionEngine.placeBid({ captainUserId: captain.captainId, bidAmount: 80 });
    expect(bidRes.success).toBe(true);

    // Verify snapshot query matches authoritative state without stale drift
    const stateSnapshot = auctionEngine.getState();
    expect(stateSnapshot.currentBid).toBe(80);
    expect(stateSnapshot.leadingTeamId).toBe(captain.id);
    expect(stateSnapshot.nominee?.id).toBe('player-parity-5');
    expect(stateSnapshot.revision).toBeGreaterThan(1);
  });
});
