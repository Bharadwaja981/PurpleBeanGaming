import { describe, it, expect, beforeEach } from 'vitest';
import { 
  calculateMmrBalancedPurses, 
  CreditAllocationMode, 
  EXPLANATION_TEXT,
  CaptainMmrInput
} from '../../src/domain/dotaAuctionMmrBalancer';
import { 
  DotaAuctionEngine, 
  getAuctionEngine, 
  resetAuctionEngine 
} from '../../src/domain/dotaAuctionEngine';
import { dotaPlayerRegistry } from '../../src/domain/dotaPlayerEngine';
import { tournamentConfigRegistry } from '../../src/domain/tournamentConfigRegistry';

describe('MMR-Balanced Auction Purse Engine', () => {
  beforeEach(() => {
    resetAuctionEngine('tourn-test-1');
    resetAuctionEngine('tourn-test-2');
    resetAuctionEngine('purple-bean-test-cup');
    resetAuctionEngine('tourn-missing-mmr');
    resetAuctionEngine('tourn-strict-mmr');
    resetAuctionEngine('tourn-recalc');
    resetAuctionEngine('tourn-freeze');
    resetAuctionEngine('tourn-reserve-compat');
    resetAuctionEngine('tourn-iso-alpha');
    resetAuctionEngine('tourn-iso-beta');
    resetAuctionEngine('tourn-authority');
    resetAuctionEngine('tourn-persist');
    dotaPlayerRegistry.clearAll();
    dotaPlayerRegistry.seedInitialPlayers();
  });

  function setupContender(
    tournamentId: string, 
    userId: string, 
    ign: string, 
    mmr: number, 
    isVerified = true, 
    isLocked = true
  ) {
    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId,
      userId,
      ign,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMmr: mmr,
      rulesAccepted: true
    });
    if (isVerified) {
      dotaPlayerRegistry.verifyRegistration(tournamentId, userId, 'staff-1', mmr);
      const reg = dotaPlayerRegistry.getRegistration(tournamentId, userId);
      if (reg && !isLocked) {
        reg.isMmrLocked = false;
        reg.tournamentMmr = 0;
        const p = dotaPlayerRegistry.getPlayer(userId);
        if (p) {
          p.isMmrLocked = false;
          p.tournamentMmr = 0;
        }
      }
    }
  }

  // =========================================================================
  // 1. Same MMR Case: 8000 / 8000 / 8000 -> 1000 / 1000 / 1000
  // =========================================================================
  it('Same MMR: 8000 / 8000 / 8000 gives 1000 / 1000 / 1000 with total exactly 3000', () => {
    const captains: CaptainMmrInput[] = [
      { captainId: 'c1', captainIgn: 'CapA', teamId: 't1', teamName: 'Team Alpha', tournamentMmr: 8000, isMmrLocked: true },
      { captainId: 'c2', captainIgn: 'CapB', teamId: 't2', teamName: 'Team Beta', tournamentMmr: 8000, isMmrLocked: true },
      { captainId: 'c3', captainIgn: 'CapC', teamId: 't3', teamName: 'Team Gamma', tournamentMmr: 8000, isMmrLocked: true }
    ];

    const result = calculateMmrBalancedPurses({
      tournamentId: 'tourn-same',
      captains,
      mode: 'CAPTAIN_MMR_BALANCED'
    });

    expect(result.success).toBe(true);
    expect(result.audit).toBeDefined();
    const audit = result.audit!;
    expect(audit.averageCaptainMmr).toBe(8000);
    expect(audit.totalCredits).toBe(3000);
    expect(audit.targetTotalCredits).toBe(3000);

    const creds = audit.entries.map(e => e.finalStartingCredits);
    expect(creds).toEqual([1000, 1000, 1000]);
  });

  // =========================================================================
  // 2. User Specification Example: 8600 / 8450 / 8200 -> 950 / 990 / 1060
  // =========================================================================
  it('User Specification Example: 8600 / 8450 / 8200 -> balanced distribution totaling 3000', () => {
    const captains: CaptainMmrInput[] = [
      { captainId: 'c-aether', captainIgn: 'Aether', teamId: 't1', teamName: 'Team Aether', tournamentMmr: 8600, isMmrLocked: true },
      { captainId: 'c-nova', captainIgn: 'Nova', teamId: 't2', teamName: 'Team Nova', tournamentMmr: 8450, isMmrLocked: true },
      { captainId: 'c-karma', captainIgn: 'Karma', teamId: 't3', teamName: 'Team Karma', tournamentMmr: 8200, isMmrLocked: true }
    ];

    const result = calculateMmrBalancedPurses({
      tournamentId: 'tourn-spec-example',
      captains,
      mode: 'CAPTAIN_MMR_BALANCED'
    });

    expect(result.success).toBe(true);
    const audit = result.audit!;
    expect(audit.totalCredits).toBe(3000);
    expect(audit.targetTotalCredits).toBe(3000);
    expect(audit.averageCaptainMmr).toBe(8417); // (8600 + 8450 + 8200) / 3 = 8416.67 -> 8417 rounded

    const aether = audit.entries.find(e => e.captainIgn === 'Aether')!;
    const nova = audit.entries.find(e => e.captainIgn === 'Nova')!;
    const karma = audit.entries.find(e => e.captainIgn === 'Karma')!;

    expect(aether.finalStartingCredits).toBe(950);
    expect(nova.finalStartingCredits).toBe(990);
    expect(karma.finalStartingCredits).toBe(1060);
    expect(aether.finalStartingCredits + nova.finalStartingCredits + karma.finalStartingCredits).toBe(3000);
  });

  // =========================================================================
  // 3. Large Spread & Caps: 800 / 1200 Caps Respected & Economy Preserved
  // =========================================================================
  it('Large spread respects 800 min and 1200 max caps while preserving total economy', () => {
    const captains: CaptainMmrInput[] = [
      { captainId: 'c-pro', captainIgn: 'ImmortalPro', teamId: 't1', teamName: 'Team Immortals', tournamentMmr: 11000, isMmrLocked: true },
      { captainId: 'c-mid', captainIgn: 'AverageLead', teamId: 't2', teamName: 'Team Medium', tournamentMmr: 7000, isMmrLocked: true },
      { captainId: 'c-low', captainIgn: 'CasualLead', teamId: 't3', teamName: 'Team Underdogs', tournamentMmr: 3000, isMmrLocked: true }
    ];

    const result = calculateMmrBalancedPurses({
      tournamentId: 'tourn-caps',
      captains,
      mode: 'CAPTAIN_MMR_BALANCED',
      minimumCredits: 800,
      maximumCredits: 1200
    });

    expect(result.success).toBe(true);
    const audit = result.audit!;
    expect(audit.totalCredits).toBe(3000);

    const pro = audit.entries.find(e => e.captainIgn === 'ImmortalPro')!;
    const low = audit.entries.find(e => e.captainIgn === 'CasualLead')!;

    // Pro is clamped to min 800 Cr
    expect(pro.finalStartingCredits).toBeGreaterThanOrEqual(800);
    expect(pro.finalStartingCredits).toBe(800);

    // Low is clamped to max 1200 Cr
    expect(low.finalStartingCredits).toBeLessThanOrEqual(1200);
    expect(low.finalStartingCredits).toBe(1200);

    // Total must still equal 3000 exactly
    const sum = audit.entries.reduce((acc, e) => acc + e.finalStartingCredits, 0);
    expect(sum).toBe(3000);
  });

  // =========================================================================
  // 4. Missing Locked MMR -> Auction Ready Denied & Blocking Captain Shown
  // =========================================================================
  it('Missing locked MMR denies Auction Ready status and identifies the blocking captain', () => {
    const tourneyId = 'tourn-missing-mmr';
    const engine = getAuctionEngine(tourneyId);

    // Register 2 captains: 1 verified with locked MMR, 1 verified but MMR NOT locked
    setupContender(tourneyId, 'cap-verified', 'VerifiedCap', 8000, true, true);
    setupContender(tourneyId, 'cap-unlocked', 'UnlockedCap', 7500, true, false);

    engine.initializeFromRegistrations();

    const app1 = engine.appointCaptain('cap-verified', { teamName: 'Verified Squad', tag: 'VSQ' }, 'staff-1');
    const app2 = engine.appointCaptain('cap-unlocked', { teamName: 'Unlocked Squad', tag: 'USQ' }, 'staff-1');
    expect(app1.success).toBe(true);
    expect(app2.success).toBe(true);

    // 1. Engine check
    const readyCheck = engine.isAuctionReady();
    expect(readyCheck.ready).toBe(false);
    expect(readyCheck.blockingCaptain).toBeDefined();
    expect(readyCheck.blockingCaptain?.name).toBe('UnlockedCap');

    // 2. Lifecycle check via tournamentConfigRegistry
    const lifecycle = tournamentConfigRegistry.getAuctionLifecycle(tourneyId);
    expect(lifecycle.status).toBe('NOT_READY');
    expect(lifecycle.description).toContain('UnlockedCap');

    // 3. Attempting to start auction floor must fail
    const startRes = engine.startAuction('staff-1');
    expect(startRes.success).toBe(false);
    expect(startRes.error).toContain('UnlockedCap');
  });

  // =========================================================================
  // 5. Locked Tournament MMR Strictness (Ignores Declared MMR & Estimates)
  // =========================================================================
  it('Strictly ignores Declared MMR and Purple Bean Rating; uses ONLY locked Tournament MMR', () => {
    const tourneyId = 'tourn-strict-mmr';
    const engine = getAuctionEngine(tourneyId);

    // Register with declared 6000, but verified and locked with 8500 by referee
    setupContender(tourneyId, 'cap-strict-1', 'StrictCap1', 6000, true, true);
    // Explicitly lock tournament MMR to 8500
    dotaPlayerRegistry.correctLockedTournamentMmr(tourneyId, 'cap-strict-1', 8500, 'Referee Verification', 'staff-1');

    // Register with declared 9500, but verified and locked with 8500 by referee
    setupContender(tourneyId, 'cap-strict-2', 'StrictCap2', 9500, true, true);
    dotaPlayerRegistry.correctLockedTournamentMmr(tourneyId, 'cap-strict-2', 8500, 'Referee Verification', 'staff-1');

    engine.initializeFromRegistrations();

    const a1 = engine.appointCaptain('cap-strict-1', { teamName: 'Team 1', tag: 'T1' }, 'staff-1');
    const a2 = engine.appointCaptain('cap-strict-2', { teamName: 'Team 2', tag: 'T2' }, 'staff-1');
    expect(a1.success).toBe(true);
    expect(a2.success).toBe(true);

    const res = engine.calculateAndApplyMmrBalancedPurses('staff-1', true);
    expect(res.success).toBe(true);
    const audit = res.audit!;

    // Both captains have locked Tournament MMR = 8500, so average is 8500, not based on declared 6000 or 9500!
    expect(audit.averageCaptainMmr).toBe(8500);
    expect(audit.entries[0].tournamentMmr).toBe(8500);
    expect(audit.entries[1].tournamentMmr).toBe(8500);
    expect(audit.entries[0].finalStartingCredits).toBe(1000);
    expect(audit.entries[1].finalStartingCredits).toBe(1000);
  });

  // =========================================================================
  // 6. EQUAL Mode Option
  // =========================================================================
  it('EQUAL mode allocates base credits (1000 Cr) to every captain regardless of MMR differences', () => {
    const captains: CaptainMmrInput[] = [
      { captainId: 'c1', captainIgn: 'GodTier', teamId: 't1', teamName: 'Team 1', tournamentMmr: 9500, isMmrLocked: true },
      { captainId: 'c2', captainIgn: 'MidTier', teamId: 't2', teamName: 'Team 2', tournamentMmr: 7500, isMmrLocked: true },
      { captainId: 'c3', captainIgn: 'LowTier', teamId: 't3', teamName: 'Team 3', tournamentMmr: 5500, isMmrLocked: true }
    ];

    const result = calculateMmrBalancedPurses({
      tournamentId: 'tourn-equal',
      captains,
      mode: 'EQUAL',
      baseCredits: 1000
    });

    expect(result.success).toBe(true);
    const audit = result.audit!;
    expect(audit.allocationMode).toBe('EQUAL');
    expect(audit.totalCredits).toBe(3000);
    expect(audit.entries.every(e => e.finalStartingCredits === 1000)).toBe(true);
  });

  // =========================================================================
  // 7. Organiser Review Audit & Explanation Text
  // =========================================================================
  it('Provides comprehensive audit snapshot, explanation text, and review data', () => {
    const captains: CaptainMmrInput[] = [
      { captainId: 'c1', captainIgn: 'Aether', teamId: 't1', teamName: 'Team Aether', tournamentMmr: 8600, isMmrLocked: true },
      { captainId: 'c2', captainIgn: 'Nova', teamId: 't2', teamName: 'Team Nova', tournamentMmr: 8450, isMmrLocked: true },
      { captainId: 'c3', captainIgn: 'Karma', teamId: 't3', teamName: 'Team Karma', tournamentMmr: 8200, isMmrLocked: true }
    ];

    const result = calculateMmrBalancedPurses({
      tournamentId: 'tourn-review',
      captains
    });

    expect(result.success).toBe(true);
    const audit = result.audit!;
    expect(audit.timestamp).toBeDefined();
    expect(audit.calculatedBy).toBe('authoritative-server');
    expect(audit.entries.length).toBe(3);

    // Explanation text matches exact requirement
    expect(EXPLANATION_TEXT).toBe(
      "Starting auction credits are balanced using each captain's verified Tournament MMR. Stronger captains receive a smaller purse because the captain already occupies one of the team's five roster slots."
    );

    // Each entry has captain, tournament MMR, diff vs avg, raw credits, clamped, and final
    const aether = audit.entries[0];
    expect(aether.captainIgn).toBe('Aether');
    expect(aether.tournamentMmr).toBe(8600);
    expect(aether.mmrDiffFromAvg).toBe(183);
    expect(aether.finalStartingCredits).toBe(950);
  });

  // =========================================================================
  // 8. Pre-Auction Recalculation (When Captain or MMR changes before start)
  // =========================================================================
  it('Explicit recalculation updates purses before bidding starts when MMR or captain changes', () => {
    const tourneyId = 'tourn-recalc';
    const engine = getAuctionEngine(tourneyId);

    // 1. Initial captains: 8000 and 8000
    setupContender(tourneyId, 'cap-1', 'CapOne', 8000, true, true);
    setupContender(tourneyId, 'cap-2', 'CapTwo', 8000, true, true);

    engine.initializeFromRegistrations();

    engine.appointCaptain('cap-1', { teamName: 'Team One', tag: 'T1' }, 'staff-1');
    engine.appointCaptain('cap-2', { teamName: 'Team Two', tag: 'T2' }, 'staff-1');

    let audit = engine.getPurseAllocationAudit()!;
    expect(audit).toBeDefined();
    expect(audit.entries[0].finalStartingCredits).toBe(1000);
    expect(audit.entries[1].finalStartingCredits).toBe(1000);

    // 2. Organiser updates locked MMR of CapOne from 8000 to 8800 before auction starts
    dotaPlayerRegistry.correctLockedTournamentMmr(tourneyId, 'cap-1', 8800, 'Post-qualifier MMR adjustment', 'staff-1');

    // 3. Organiser requests explicit recalculation
    const recalcRes = engine.recalculatePurses('staff-1');
    expect(recalcRes.success).toBe(true);

    audit = engine.getPurseAllocationAudit()!;
    // Average = (8800 + 8000) / 2 = 8400. CapOne diff = +400 -> raw = 1000 - (400 * 0.25) = 900.
    // CapTwo diff = -400 -> raw = 1000 + (400 * 0.25) = 1100.
    const teamOne = Array.from(engine.getTeams()).find(t => t.captainId === 'cap-1');
    const teamTwo = Array.from(engine.getTeams()).find(t => t.captainId === 'cap-2');

    expect(teamOne?.startingCredits).toBe(900);
    expect(teamTwo?.startingCredits).toBe(1100);
    expect(teamOne!.startingCredits + teamTwo!.startingCredits).toBe(2000);
  });

  // =========================================================================
  // 9. Post-Bid Freeze: Starting Credits are Permanently Immutable After First Bid
  // =========================================================================
  it('Permanently locks starting purses after first bid: recalculation and mode changes are denied', () => {
    const tourneyId = 'tourn-freeze';
    const engine = getAuctionEngine(tourneyId);

    setupContender(tourneyId, 'cap-f1', 'CapF1', 8400, true, true);
    setupContender(tourneyId, 'cap-f2', 'CapF2', 7600, true, true);
    setupContender(tourneyId, 'p-nom', 'Nominee', 7000, true, true);

    engine.initializeFromRegistrations();

    const team1 = engine.appointCaptain('cap-f1', { teamName: 'Team F1', tag: 'TF1' }, 'staff-1').team!;
    const team2 = engine.appointCaptain('cap-f2', { teamName: 'Team F2', tag: 'TF2' }, 'staff-1').team!;

    engine.startAuction('staff-1');
    expect(engine.isPurseAllocationFrozen()).toBe(true);

    // Nominate player and place first bid
    engine.nominatePlayer('p-nom', 'staff-1');
    const bidRes = engine.placeBid({
      teamId: team1.id,
      captainUserId: 'cap-f1',
      bidAmount: 50
    });
    expect(bidRes.success).toBe(true);
    expect(engine.hasBidsStarted()).toBe(true);

    // Attempting recalculation MUST be strictly denied
    const recalcRes = engine.recalculatePurses('staff-1');
    expect(recalcRes.success).toBe(false);
    expect(recalcRes.error).toMatch(/Recalculation Denied.*already started/i);

    // Attempting to change allocation mode MUST be denied
    const modeRes = engine.setAllocationMode('EQUAL', 'staff-1');
    expect(modeRes.success).toBe(false);
    expect(modeRes.error).toMatch(/Cannot change credit allocation mode after bidding has started/i);
  });

  // =========================================================================
  // 10. Reserve Rule Compatibility with Actual Allocated Starting Credits
  // =========================================================================
  it('Reserve rule correctly operates from each team actual allocated purse', () => {
    const tourneyId = 'tourn-reserve-compat';
    const engine = getAuctionEngine(tourneyId);

    // Cap 1: 8400 MMR -> gets 900 Cr
    // Cap 2: 7600 MMR -> gets 1100 Cr
    // Total = 2000 Cr
    setupContender(tourneyId, 'cap-r1', 'RichMmrCap', 8400, true, true);
    setupContender(tourneyId, 'cap-r2', 'LowMmrCap', 7600, true, true);
    setupContender(tourneyId, 'nom-1', 'Nominee1', 7000, true, true);

    engine.initializeFromRegistrations();

    const teamHigh = engine.appointCaptain('cap-r1', { teamName: 'High MMR Team', tag: 'HMT' }, 'staff-1').team!;
    const teamLow = engine.appointCaptain('cap-r2', { teamName: 'Low MMR Team', tag: 'LMT' }, 'staff-1').team!;

    expect(teamHigh.startingCredits).toBe(900);
    expect(teamLow.startingCredits).toBe(1100);

    engine.startAuction('staff-1');
    engine.nominatePlayer('nom-1', 'staff-1');

    // High MMR team: starting credits = 900.
    // Primary slots needed after lot 1 = 3 slots * 10 = 30 credits reserve needed.
    // Max allowable bid = 900 - 30 = 870 Cr.
    // Bidding 880 violates reserve rule (leaves only 20 Cr, needed 30 Cr)
    const highInvalidBid = engine.placeBid({
      teamId: teamHigh.id,
      captainUserId: 'cap-r1',
      bidAmount: 880
    });
    expect(highInvalidBid.success).toBe(false);
    expect(highInvalidBid.error).toMatch(/Reserve Rule Violation/i);

    // Bidding 870 leaves exactly 30 Cr -> MUST SUCCEED
    const highValidBid = engine.placeBid({
      teamId: teamHigh.id,
      captainUserId: 'cap-r1',
      bidAmount: 870
    });
    expect(highValidBid.success).toBe(true);
    expect(highValidBid.currentBid).toBe(870);

    // Low MMR team: starting credits = 1100.
    // Reserve needed = 30 Cr. Max allowable bid = 1100 - 30 = 1070 Cr.
    // Bidding 900 exceeds current bid (870) and easily satisfies 30 Cr reserve (1100 - 900 = 200 >= 30)
    const lowValidBid = engine.placeBid({
      teamId: teamLow.id,
      captainUserId: 'cap-r2',
      bidAmount: 900
    });
    expect(lowValidBid.success).toBe(true);
    expect(lowValidBid.currentBid).toBe(900);
  });

  // =========================================================================
  // 11. Tournament Isolation: Two Different Auction Tournaments Remain Independent
  // =========================================================================
  it('Allocations and purse audits in two distinct tournaments remain completely isolated', () => {
    const tA = 'tourn-iso-alpha';
    const tB = 'tourn-iso-beta';

    const engineA = getAuctionEngine(tA);
    const engineB = getAuctionEngine(tB);

    setupContender(tA, 'cap-a1', 'CapA1', 8600, true, true);
    setupContender(tA, 'cap-a2', 'CapA2', 8200, true, true);

    setupContender(tB, 'cap-b1', 'CapB1', 7000, true, true);
    setupContender(tB, 'cap-b2', 'CapB2', 7000, true, true);

    engineA.initializeFromRegistrations();
    engineB.initializeFromRegistrations();

    engineA.appointCaptain('cap-a1', { teamName: 'Alpha 1', tag: 'A1' }, 'staff-1');
    engineA.appointCaptain('cap-a2', { teamName: 'Alpha 2', tag: 'A2' }, 'staff-1');

    engineB.appointCaptain('cap-b1', { teamName: 'Beta 1', tag: 'B1' }, 'staff-1');
    engineB.appointCaptain('cap-b2', { teamName: 'Beta 2', tag: 'B2' }, 'staff-1');

    const auditA = engineA.getPurseAllocationAudit()!;
    const auditB = engineB.getPurseAllocationAudit()!;

    expect(auditA).toBeDefined();
    expect(auditB).toBeDefined();
    expect(auditA.tournamentId).toBe(tA);
    expect(auditB.tournamentId).toBe(tB);

    // Tournament A average is 8400, credits are 950 and 1050
    expect(auditA.averageCaptainMmr).toBe(8400);
    expect(auditA.entries[0].finalStartingCredits).toBe(950);
    expect(auditA.entries[1].finalStartingCredits).toBe(1050);

    // Tournament B average is 7000, credits are 1000 and 1000
    expect(auditB.averageCaptainMmr).toBe(7000);
    expect(auditB.entries[0].finalStartingCredits).toBe(1000);
    expect(auditB.entries[1].finalStartingCredits).toBe(1000);
  });

  // =========================================================================
  // 12. Server Authority: Client Cannot Set Starting Credits
  // =========================================================================
  it('Server Authority: Starting credits are authoritative, client cannot tamper with purses', () => {
    const tourneyId = 'tourn-authority';
    const engine = getAuctionEngine(tourneyId);

    setupContender(tourneyId, 'cap-auth1', 'CapAuth1', 8000, true, true);
    setupContender(tourneyId, 'cap-auth2', 'CapAuth2', 8000, true, true);
    setupContender(tourneyId, 'nom-auth', 'NomAuth', 7500, true, true);

    engine.initializeFromRegistrations();

    const team1 = engine.appointCaptain('cap-auth1', { teamName: 'Auth Team 1', tag: 'AT1' }, 'staff-1').team!;
    engine.appointCaptain('cap-auth2', { teamName: 'Auth Team 2', tag: 'AT2' }, 'staff-1');

    engine.startAuction('staff-1');
    engine.nominatePlayer('nom-auth', 'staff-1');

    // Attempting to bid 1500 credits when purse is 1000 credits fails
    const overspend = engine.placeBid({
      teamId: team1.id,
      captainUserId: 'cap-auth1',
      bidAmount: 1500
    });
    expect(overspend.success).toBe(false);
    expect(overspend.error).toMatch(/Insufficient credits/i);
  });

  // =========================================================================
  // 13. Persistence & Snapshot Reconnect
  // =========================================================================
  it('Persists allocation snapshot and survives re-fetch or reconnect', () => {
    const tourneyId = 'tourn-persist';
    const engine = getAuctionEngine(tourneyId);

    setupContender(tourneyId, 'cap-p1', 'CapP1', 8600, true, true);
    setupContender(tourneyId, 'cap-p2', 'CapP2', 8200, true, true);

    engine.initializeFromRegistrations();

    engine.appointCaptain('cap-p1', { teamName: 'Persist 1', tag: 'P1' }, 'staff-1');
    engine.appointCaptain('cap-p2', { teamName: 'Persist 2', tag: 'P2' }, 'staff-1');

    const audit1 = engine.getPurseAllocationAudit()!;
    expect(audit1).toBeDefined();
    expect(audit1.allocationVersion).toBe(1);

    // Retrieve via getAuctionEngine (simulating client or server re-fetch)
    const restored = getAuctionEngine(tourneyId);
    const audit2 = restored.getPurseAllocationAudit()!;
    expect(audit2).toEqual(audit1);
    expect(restored.getTeam(audit1.entries[0].teamId)?.startingCredits).toBe(audit1.entries[0].finalStartingCredits);
  });
});
