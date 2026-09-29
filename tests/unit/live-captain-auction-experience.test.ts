import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DotaAuctionEngine } from '../../src/domain/dotaAuctionEngine';
import { dotaPlayerRegistry } from '../../src/domain/dotaPlayerEngine';

describe('Live Captain Auction Experience & Concurrency Rules', () => {
  let engine: DotaAuctionEngine;
  const TOURNAMENT_ID = 'test-live-auction-tourn';
  const ORGANISER_ID = 'org-user-1';
  const CAPTAIN_A_ID = 'cap-user-a';
  const CAPTAIN_B_ID = 'cap-user-b';
  const SPECTATOR_ID = 'spec-user-1';

  beforeEach(() => {
    vi.useFakeTimers();
    dotaPlayerRegistry.clearAll();
    dotaPlayerRegistry.seedInitialPlayers();

    engine = new DotaAuctionEngine({
      tournamentId: TOURNAMENT_ID,
      startingCredits: 1000,
      creditAllocationMode: 'EQUAL',
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      nominationTimerSeconds: 30,
      bidExtensionEnabled: true,
      extensionWindowSeconds: 5,
      extensionTimeSeconds: 5
    });

    // Register test players
    const players = [
      { id: CAPTAIN_A_ID, ign: 'AlphaLead', mmr: 6000, role: 'Position 1 — Carry', sRole: 'Position 2 — Mid' },
      { id: CAPTAIN_B_ID, ign: 'BravoLead', mmr: 5800, role: 'Position 2 — Mid', sRole: 'Position 1 — Carry' },
      { id: 'p-nominee-1', ign: 'ViperX', mmr: 5500, role: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support' },
      { id: 'p-nominee-2', ign: 'StormZ', mmr: 5400, role: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support' },
      { id: 'p-nominee-3', ign: 'SupportGod', mmr: 5200, role: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support' },
      { id: 'p-nominee-4', ign: 'MidKing', mmr: 6200, role: 'Position 2 — Mid', sRole: 'Position 3 — Offlane' },
      { id: 'p-nominee-5', ign: 'CarryLord', mmr: 6100, role: 'Position 1 — Carry', sRole: 'Position 2 — Mid' }
    ];

    for (const p of players) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: p.id,
        ign: p.ign,
        primaryRole: p.role as any,
        secondaryRole: p.sRole as any,
        declaredMmr: p.mmr,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, p.id, ORGANISER_ID, p.mmr);
    }

    engine.initializeFromRegistrations();

    // Appoint 2 captains
    engine.appointCaptain(CAPTAIN_A_ID, { teamName: 'Alpha Wolves', tag: 'ALF' }, ORGANISER_ID);
    engine.appointCaptain(CAPTAIN_B_ID, { teamName: 'Bravo Tigers', tag: 'BRV' }, ORGANISER_ID);
    engine.startAuction(ORGANISER_ID);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Organiser nominates player and server timer immediately starts', () => {
    const res = engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    expect(res.success).toBe(true);
    expect(res.nominee?.username).toBe('ViperX');
    expect(engine.getState().status).toBe('LIVE');
    expect(engine.getState().secondsRemaining).toBe(30);

    // Timer ticks forward by 10 seconds
    engine.tickTimer(10);
    expect(engine.getState().secondsRemaining).toBe(20);
  });

  it('2. Organiser is strictly prohibited from submitting team bids', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    const orgBid = engine.placeBid({
      captainUserId: ORGANISER_ID,
      bidAmount: 20,
      actorRole: 'organizer'
    });

    expect(orgBid.success).toBe(false);
    expect(orgBid.error).toMatch(/Organiser cannot bid on behalf of teams/i);
  });

  it('3. Spectators are strictly prohibited from placing bids', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    const specBid = engine.placeBid({
      captainUserId: SPECTATOR_ID,
      bidAmount: 20,
      actorRole: 'spectator'
    });

    expect(specBid.success).toBe(false);
    expect(specBid.error).toMatch(/Spectator account is read-only/i);
  });

  it('4. Server independently derives captain team and prevents bidding for another team', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    const teams = engine.getTeams();
    const teamB = teams.find(t => t.captainId === CAPTAIN_B_ID)!;

    // Captain A tries to bid specifying Team B's ID
    const rivalBid = engine.placeBid({
      teamId: teamB.id,
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 20
    });

    expect(rivalBid.success).toBe(false);
    expect(rivalBid.error).toMatch(/not the authorized captain/i);
  });

  it('5. Simultaneous/Ordered Captain Bidding: only valid increment and latest revision accepted', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    const initialRev = engine.getState().revision;

    // Captain A bids 20
    const bidA = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 20,
      expectedRevision: initialRev
    });
    expect(bidA.success).toBe(true);
    expect(bidA.currentBid).toBe(20);
    expect(bidA.leadingTeamName).toBe('Alpha Wolves');

    // Captain B attempts stale bid with old initialRev
    const staleBidB = engine.placeBid({
      captainUserId: CAPTAIN_B_ID,
      bidAmount: 30,
      expectedRevision: initialRev // Stale
    });
    expect(staleBidB.success).toBe(false);
    expect(staleBidB.error).toMatch(/Stale Bid.*revision changed/i);

    // Captain B bids with updated revision -> succeeds and takes lead
    const validBidB = engine.placeBid({
      captainUserId: CAPTAIN_B_ID,
      bidAmount: 30,
      expectedRevision: bidA.revision
    });
    expect(validBidB.success).toBe(true);
    expect(validBidB.currentBid).toBe(30);
    expect(validBidB.leadingTeamName).toBe('Bravo Tigers');

    // Exactly one current leader exists
    expect(engine.getState().leadingTeamName).toBe('Bravo Tigers');
    expect(engine.getState().currentBid).toBe(30);
  });

  it('6. Rejects bid below minimum or invalid increment', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);

    // Bid below minimum
    const belowMin = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 5
    });
    expect(belowMin.success).toBe(false);

    // Invalid increment (e.g. 15 when current is 10 and increment is 10)
    const invalidInc = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 15
    });
    expect(invalidInc.success).toBe(false);
    expect(invalidInc.error).toMatch(/multiple of 10 credits/i);
  });

  it('7. Rejects insufficient purse and enforces mandatory reserve rule', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    // Team starts with 1000 credits, 1/5 primary roster (captain).
    // Remaining unfilled primary slots after lot = 3.
    // Reserve needed = 3 * 10 = 30 credits. Max allowable bid = 970.

    // 1500 exceeds 1000 credits
    const overspend = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 1500
    });
    expect(overspend.success).toBe(false);
    expect(overspend.error).toMatch(/Insufficient credits/i);

    // 980 leaves only 20 credits, violating 30 reserve
    const reserveViolation = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 980
    });
    expect(reserveViolation.success).toBe(false);
    expect(reserveViolation.error).toMatch(/Reserve Rule Violation/i);
  });

  it('8. Anti-sniping extension: bids placed in final 5 seconds reset timer back to 5 seconds', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);
    expect(engine.getState().secondsRemaining).toBe(30);

    // Countdown advances to 3 seconds remaining (inside 5s window)
    engine.tickTimer(27);
    expect(engine.getState().secondsRemaining).toBe(3);

    // Captain A places valid bid
    const res = engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 50
    });

    expect(res.success).toBe(true);
    // Anti-sniping resets timer back to 5 seconds!
    expect(engine.getState().secondsRemaining).toBe(5);
  });

  it('9. Timer expiry with valid bid -> player SOLD, credits deducted, roster updated', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);

    engine.placeBid({
      captainUserId: CAPTAIN_A_ID,
      bidAmount: 100
    });

    // Advance timer to 0
    engine.tickTimer(30);

    // Nomination automatically concluded by timer authority
    expect(engine.getState().nominee).toBeNull();
    const soldPlayer = engine.getPlayer('p-nominee-1');
    expect(soldPlayer?.status).toBe('SOLD');
    expect(soldPlayer?.soldAmount).toBe(100);

    const teamA = engine.getTeam(soldPlayer!.teamId!)!;
    expect(teamA.remainingCredits).toBe(900); // 1000 - 100
    expect(teamA.primaryRoster.length).toBe(2); // Captain + 1 drafted
  });

  it('10. Timer expiry with NO bids -> player marked as UNSOLD', () => {
    engine.nominatePlayer('p-nominee-1', ORGANISER_ID);

    // Nobody bids, countdown expires
    engine.tickTimer(30);

    expect(engine.getState().nominee).toBeNull();
    const unsoldPlayer = engine.getPlayer('p-nominee-1');
    expect(unsoldPlayer?.status).toBe('UNSOLD');
    expect(engine.getUnsoldPlayers().some(p => p.id === 'p-nominee-1')).toBe(true);
  });
});
