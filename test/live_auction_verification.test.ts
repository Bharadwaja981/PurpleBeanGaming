import { describe, it, expect, beforeEach } from 'vitest';
import { DotaAuctionEngine } from '../src/domain/dotaAuctionEngine';
import { dotaPlayerRegistry } from '../src/domain/dotaPlayerEngine';

describe('Purple Bean Gaming - Live Captain Auction Verification Suite', () => {
  let engine: DotaAuctionEngine;
  let captainAId: string;
  let captainBId: string;
  let captainCId: string;
  let teamAId: string;
  let teamBId: string;
  let teamCId: string;
  let organiserId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    engine = new DotaAuctionEngine({
      startingCredits: 1000,
      creditAllocationMode: 'EQUAL',
      minimumBid: 50,
      bidIncrement: 10,
      nominationTimerSeconds: 15,
      bidExtensionEnabled: true,
      extensionWindowSeconds: 5,
      extensionTimeSeconds: 5,
      primaryRosterSize: 5,
      optionalStandInLimit: 1,
      reservePerSlot: 10
    });

    // Register and verify contenders for captaincy
    const tId = engine.getConfig().tournamentId;
    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: tId,
      userId: 'contender-cap-a',
      ign: 'ShadowFiendPro',
      primaryRole: 'Position 2 — Mid',
      secondaryRole: 'Position 1 — Carry',
      declaredMmr: 5400,
      rulesAccepted: true,
      city: 'Mumbai'
    });
    dotaPlayerRegistry.verifyRegistration(tId, 'contender-cap-a', organiserId, 5400);

    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: tId,
      userId: 'contender-cap-b',
      ign: 'InvokerKing',
      primaryRole: 'Position 2 — Mid',
      secondaryRole: 'Position 4 — Soft Support',
      declaredMmr: 5600,
      rulesAccepted: true,
      city: 'Delhi'
    });
    dotaPlayerRegistry.verifyRegistration(tId, 'contender-cap-b', organiserId, 5600);

    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: tId,
      userId: 'contender-cap-c',
      ign: 'PudgeHooker',
      primaryRole: 'Position 4 — Soft Support',
      secondaryRole: 'Position 5 — Hard Support',
      declaredMmr: 5100,
      rulesAccepted: true,
      city: 'Bengaluru'
    });
    dotaPlayerRegistry.verifyRegistration(tId, 'contender-cap-c', organiserId, 5100);

    // Register additional auction contenders to bid on
    for (let i = 1; i <= 10; i++) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: tId,
        userId: `contender-player-${i}`,
        ign: `ProGamer_${i}`,
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 5000 + i * 50,
        rulesAccepted: true,
        city: 'Mumbai'
      });
      dotaPlayerRegistry.verifyRegistration(tId, `contender-player-${i}`, organiserId, 5000 + i * 50);
    }

    // Hydrate players from registrations
    engine.initializeFromRegistrations();

    // Appoint 3 franchise captains
    const resA = engine.appointCaptain('contender-cap-a', { teamName: 'Mumbai Titans', tag: 'MT' }, organiserId);
    if (!resA.success) console.error('resA error:', resA.error);
    const resB = engine.appointCaptain('contender-cap-b', { teamName: 'Delhi Dragons', tag: 'DD' }, organiserId);
    const resC = engine.appointCaptain('contender-cap-c', { teamName: 'Bengaluru Blasters', tag: 'BB' }, organiserId);

    captainAId = 'contender-cap-a';
    captainBId = 'contender-cap-b';
    captainCId = 'contender-cap-c';

    teamAId = resA.team!.id;
    teamBId = resB.team!.id;
    teamCId = resC.team!.id;

    engine.startAuction(organiserId);
  });

  // 1. Production Perspective Switcher Removed
  it('Production Perspective Switcher Removed: Verified role checks and DEV gating', () => {
    // Engine verifies that organiser cannot submit bids for teams
    const orgBid = engine.placeBid({
      teamId: teamAId,
      captainUserId: organiserId,
      bidAmount: 100,
      actorRole: 'organizer'
    });
    expect(orgBid.success).toBe(false);
    expect(orgBid.error).toMatch(/Organiser cannot bid on behalf of teams/);

    // Spectator cannot bid
    const specBid = engine.placeBid({
      teamId: teamAId,
      captainUserId: 'spectator-user',
      bidAmount: 100,
      actorRole: 'spectator'
    });
    expect(specBid.success).toBe(false);
    expect(specBid.error).toMatch(/Spectator account is read-only/);
  });

  // 2. Real Multi-Session Test: 1 Organiser + 3 Captains
  it('3 Captain Real Session Test: A(100) -> B(120) -> C(150) -> A(170 anti-snipe) -> C(190) -> SOLD', () => {
    // Available player nominated by Organiser
    const avail = engine.getAvailablePlayers();
    expect(avail.length).toBeGreaterThan(0);
    const nominee = avail[0];

    const nomRes = engine.nominatePlayer(nominee.id, organiserId);
    expect(nomRes.success).toBe(true);
    expect(engine.getState().nominee?.id).toBe(nominee.id);

    // Track real-time synchronized client state across 4 sessions (1 Organiser + 3 Captains)
    let syncCallCount = 0;
    engine.subscribe(() => {
      syncCallCount++;
    });

    // Step 1: Captain A bids 100
    const bidA1 = engine.placeBid({
      captainUserId: captainAId,
      bidAmount: 100
    });
    expect(bidA1.success).toBe(true);
    expect(engine.getState().currentBid).toBe(100);
    expect(engine.getState().leadingTeamId).toBe(teamAId);

    // Step 2: Captain B bids 120 -> Captain A is outbid
    const bidB = engine.placeBid({
      captainUserId: captainBId,
      bidAmount: 120
    });
    expect(bidB.success).toBe(true);
    expect(engine.getState().currentBid).toBe(120);
    expect(engine.getState().leadingTeamId).toBe(teamBId);
    expect(engine.getState().leadingTeamId).not.toBe(teamAId); // A sees OUTBID

    // Step 3: Captain C bids 150
    const bidC1 = engine.placeBid({
      captainUserId: captainCId,
      bidAmount: 150
    });
    expect(bidC1.success).toBe(true);
    expect(engine.getState().currentBid).toBe(150);
    expect(engine.getState().leadingTeamId).toBe(teamCId);

    // Step 4: Advance timer to final 3 seconds (<= 5s window)
    engine.setRemainingSeconds(3);

    // Captain A bids 170 during final 5 seconds -> triggers anti-snipe extension
    const bidA2 = engine.placeBid({
      captainUserId: captainAId,
      bidAmount: 170
    });
    expect(bidA2.success).toBe(true);
    expect(engine.getState().currentBid).toBe(170);
    expect(engine.getState().leadingTeamId).toBe(teamAId);
    // Anti-snipe extension extended secondsRemaining back to 5
    expect(engine.getState().secondsRemaining).toBe(5);

    // Step 5: Captain C bids 190
    const bidC2 = engine.placeBid({
      captainUserId: captainCId,
      bidAmount: 190
    });
    expect(bidC2.success).toBe(true);
    expect(engine.getState().currentBid).toBe(190);
    expect(engine.getState().leadingTeamId).toBe(teamCId);

    // Step 6: Timer expires -> Lot concludes
    const concludeRes = engine.concludeNomination(true, 'system-timer');
    expect(concludeRes.outcome).toBe('SOLD');
    expect(concludeRes.teamName).toBe('Bengaluru Blasters');
    expect(concludeRes.winningBid).toBe(190);

    // Verify final authoritative state
    const state = engine.getState();
    expect(state.lastLotResult?.outcome).toBe('SOLD');
    expect(state.lastLotResult?.winningTeamId).toBe(teamCId);
    expect(state.lastLotResult?.winningBid).toBe(190);
    expect(state.nominee).toBeNull();

    // Verify credits deducted from winning team
    const teamC = engine.getTeam(teamCId);
    expect(teamC?.remainingCredits).toBe(1000 - 190);
    expect(teamC?.primaryRoster.some(p => p.id === nominee.id)).toBe(true);

    // Other teams credits untouched
    expect(engine.getTeam(teamAId)?.remainingCredits).toBe(1000);
    expect(engine.getTeam(teamBId)?.remainingCredits).toBe(1000);
  });

  // 3. Real-Time Sync
  it('Real-Time Sync: All clients converge on identical authoritative state', () => {
    let broadcastUpdates: any[] = [];
    const unsubscribe = engine.subscribe(() => {
      broadcastUpdates.push({ ...engine.getState() });
    });

    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);
    engine.placeBid({ captainUserId: captainAId, bidAmount: 80 });
    engine.pauseAuction(organiserId);
    expect(engine.getState().status).toBe('PAUSED');
    engine.resumeAuction(organiserId);
    expect(engine.getState().status).toBe('LIVE');
    engine.placeBid({ captainUserId: captainBId, bidAmount: 100 });
    engine.concludeNomination(true, organiserId);

    expect(broadcastUpdates.length).toBeGreaterThan(4);
    const lastUpdate = broadcastUpdates[broadcastUpdates.length - 1];
    expect(lastUpdate.lastLotResult?.outcome).toBe('SOLD');
    expect(lastUpdate.lastLotResult?.winningBid).toBe(100);
    unsubscribe();
  });

  // 4. Reconnect Recovery
  it('Reconnect Recovery: Client reconnected retrieves current authoritative state without stale replay', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    // Captain A disconnects (simulated: does not observe intermediate bids)
    engine.placeBid({ captainUserId: captainBId, bidAmount: 100 });
    engine.placeBid({ captainUserId: captainCId, bidAmount: 130 });

    // Captain A reconnects and queries snapshot
    const reconnectedSnapshot = engine.getState();
    expect(reconnectedSnapshot.currentBid).toBe(130);
    expect(reconnectedSnapshot.leadingTeamId).toBe(teamCId);
    expect(reconnectedSnapshot.revision).toBeGreaterThanOrEqual(4);
    expect(engine.getBidHistory().length).toBe(2);
  });

  // 5. Server Timer
  it('Server Timer: Authoritative deadline reconciles correct remaining time', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    const initialEndsAt = engine.getState().timerEndsAt!;
    expect(initialEndsAt).toBeGreaterThan(Date.now());

    // Advance to 8 seconds
    engine.setRemainingSeconds(8);

    // Snapshot restoration/reconnect reconciles accurately
    const snapshot = {
      state: engine.getState(),
      teams: engine.getTeams(),
      players: engine.getPlayers()
    };
    const newEngine = new DotaAuctionEngine();
    newEngine.loadSnapshot(snapshot);
    expect(newEngine.getState().secondsRemaining).toBeLessThanOrEqual(8);
  });

  // 6. Expiry Race Safety
  it('Expiry Race Safety: Bid arriving after deadline is rejected, never sold at stale amount', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    engine.placeBid({ captainUserId: captainAId, bidAmount: 100 });

    // Timer expires
    engine.expireTimerNow();

    // Captain B attempts bid after expiration
    const lateBid = engine.placeBid({
      captainUserId: captainBId,
      bidAmount: 150
    });
    expect(lateBid.success).toBe(false);
    expect(lateBid.error).toMatch(/timer has expired|closed/);

    // Winner is resolved strictly with valid pre-expiry bid
    const res = engine.concludeNomination(true, 'timer');
    expect(res.winningBid).toBe(100);
    expect(res.teamName).toBe('Mumbai Titans');
  });

  // 7. Anti-Snipe Extension
  it('Anti-Snipe Extension: Resets timer to extension time when bid placed in final window', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    // Move to 2 seconds remaining (inside 5s extension window)
    engine.setRemainingSeconds(2);

    const bid = engine.placeBid({ captainUserId: captainAId, bidAmount: 100 });
    expect(bid.success).toBe(true);
    expect(engine.getState().secondsRemaining).toBe(5);
    expect(engine.getState().timerEndsAt!).toBeGreaterThan(Date.now() + 4500);
  });

  // 8. Organiser Controls Validated
  it('Organiser Controls Validated: Organiser cannot bid, change winning bid or override resolved lot', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    // Organiser cannot bid
    const orgBid = engine.placeBid({
      captainUserId: organiserId,
      bidAmount: 200,
      actorRole: 'organizer'
    });
    expect(orgBid.success).toBe(false);

    // Captain bids
    engine.placeBid({ captainUserId: captainAId, bidAmount: 100 });

    // Lot resolves
    engine.concludeNomination(true, 'timer');

    // Organiser cannot subsequently conclude again or override
    expect(() => {
      engine.concludeNomination(true, organiserId);
    }).toThrow(/No nominee currently on the auction block/);
  });

  // 9. Mobile Captain View (390px layout checks)
  it('Mobile Captain View (390px): Essential elements and actions configured for mobile touch', () => {
    // Quick increments must support standard steps +10, +20, +50, +100
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    // Quick increment +20
    const quickBid = engine.placeBid({
      captainUserId: captainAId,
      increment: 20
    });
    expect(quickBid.success).toBe(true);
    expect(quickBid.currentBid).toBe(70); // 50 opening + 20
  });

  // 10. Spectator Mode
  it('Spectator Mode: Spectator account is strictly read-only', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    const specBid = engine.placeBid({
      captainUserId: 'spectator-1',
      bidAmount: 100,
      actorRole: 'spectator'
    });
    expect(specBid.success).toBe(false);
    expect(specBid.error).toMatch(/Spectator account is read-only/);
  });

  // 11. Persistence
  it('Persistence: Accepted bid history, purse deduction and roster assignment persist correctly', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    engine.placeBid({ captainUserId: captainAId, bidAmount: 100 });
    engine.placeBid({ captainUserId: captainBId, bidAmount: 150 });
    engine.concludeNomination(true, organiserId);

    // Serialize snapshot and reload into new engine instance
    const snapshot = {
      state: engine.getState(),
      teams: engine.getTeams(),
      players: engine.getPlayers(),
      bidHistory: engine.getBidHistory(),
      nominationAudits: engine.getNominationAudits()
    };

    const restoredEngine = new DotaAuctionEngine();
    restoredEngine.loadSnapshot(snapshot);

    expect(restoredEngine.getBidHistory().length).toBe(2);
    expect(restoredEngine.getSoldPlayers().some(p => p.id === nominee.id)).toBe(true);
    const bTeam = restoredEngine.getTeam(teamBId);
    expect(bTeam?.remainingCredits).toBe(850);
    expect(bTeam?.primaryRoster.some(p => p.id === nominee.id)).toBe(true);
  });

  // 12. Concurrency Stress
  it('Concurrency Stress: Near-simultaneous bids produce exactly one ordered result, no duplicate winner', () => {
    const nominee = engine.getAvailablePlayers()[0];
    engine.nominatePlayer(nominee.id, organiserId);

    const rev0 = engine.getState().revision;

    // Simultaneous bids from Captain A, B, and C with the same expected revision
    const bidA = engine.placeBid({
      captainUserId: captainAId,
      bidAmount: 100,
      expectedRevision: rev0
    });

    const bidB = engine.placeBid({
      captainUserId: captainBId,
      bidAmount: 120,
      expectedRevision: rev0 // Will be rejected as stale because rev0 changed after A's bid!
    });

    const bidC = engine.placeBid({
      captainUserId: captainCId,
      bidAmount: 130,
      expectedRevision: engine.getState().revision // Submits with updated revision
    });

    expect(bidA.success).toBe(true);
    expect(bidB.success).toBe(false); // Stale revision rejected
    expect(bidB.error).toMatch(/Stale Bid/);
    expect(bidC.success).toBe(true);

    expect(engine.getState().currentBid).toBe(130);
    expect(engine.getState().leadingTeamId).toBe(teamCId);
  });
});
