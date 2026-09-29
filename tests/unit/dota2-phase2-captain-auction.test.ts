/**
 * Purple Bean Gaming — Dota 2 Phase 2 Unit & Integration Tests
 * Captain Selection + Complete Player Auction
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaAuctionEngine, 
  DotaAuctionEngine,
  DotaAuctionPlayer, 
  DotaAuctionTeam 
} from '../../src/domain/dotaAuctionEngine';
import { 
  dotaPlayerRegistry, 
  DotaRolePosition 
} from '../../src/domain/dotaPlayerEngine';
import { 
  trustedTournamentOps, 
  ServerCallerContext 
} from '../../src/server/trustedTournamentOperations';
import { testCupEngine } from '../../src/domain/testCupEngine';

describe('Dota 2 Phase 2 — Captain Selection + Complete Player Auction', () => {
  const TOURNAMENT_ID = 'phase2-dota-championship';
  const ORGANISER_ID = 'organiser-staff-1';
  const CAPTAIN_1_ID = 'p-cap-alpha';
  const CAPTAIN_2_ID = 'p-cap-bravo';
  const CAPTAIN_3_ID = 'p-cap-charlie';
  const UNVERIFIED_PLAYER_ID = 'p-unverified-rogue';

  let engine: DotaAuctionEngine;

  const orgCaller: ServerCallerContext = {
    userId: ORGANISER_ID,
    email: 'organiser@purplebean.gg',
    role: 'organizer',
    isAdmin: true
  };

  const cap1Caller: ServerCallerContext = {
    userId: CAPTAIN_1_ID,
    email: 'alpha@team.in',
    role: 'captain',
    teamId: 'team-alpha',
    isAdmin: false
  };

  const cap2Caller: ServerCallerContext = {
    userId: CAPTAIN_2_ID,
    email: 'bravo@team.in',
    role: 'captain',
    teamId: 'team-bravo',
    isAdmin: false
  };

  const normalPlayerCaller: ServerCallerContext = {
    userId: 'p-normal-user',
    email: 'normal@player.in',
    role: 'player',
    isAdmin: false
  };

  beforeEach(() => {
    // Reset registries
    dotaPlayerRegistry.seedInitialPlayers();

    // Create custom test tournament engine instance
    engine = new DotaAuctionEngine({
      tournamentId: TOURNAMENT_ID,
      tournamentName: 'Phase 2 Dota Championship',
      startingCredits: 1000,
      creditAllocationMode: 'EQUAL',
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      primaryRosterSize: 5,
      optionalStandInLimit: 1,
      nominationTimerSeconds: 30,
      bidTimerSeconds: 25
    });

    // Register & Verify test contenders in dotaPlayerRegistry
    const contenders = [
      { id: CAPTAIN_1_ID, ign: 'AlphaLead', role: 'Position 1 — Carry', sRole: 'Position 2 — Mid', mmr: 7800 },
      { id: CAPTAIN_2_ID, ign: 'BravoLead', role: 'Position 2 — Mid', sRole: 'Position 1 — Carry', mmr: 7600 },
      { id: CAPTAIN_3_ID, ign: 'CharlieLead', role: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', mmr: 7500 },
      { id: 'p-pool-1', ign: 'Striker', role: 'Position 1 — Carry', sRole: 'Position 2 — Mid', mmr: 7400 },
      { id: 'p-pool-2', ign: 'Mage', role: 'Position 2 — Mid', sRole: 'Position 1 — Carry', mmr: 7350 },
      { id: 'p-pool-3', ign: 'Tanker', role: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', mmr: 7200 },
      { id: 'p-pool-4', ign: 'SupportPro', role: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', mmr: 7150 },
      { id: 'p-pool-5', ign: 'Warder', role: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', mmr: 7100 },
      { id: 'p-pool-6', ign: 'Ganker', role: 'Position 2 — Mid', sRole: 'Position 3 — Offlane', mmr: 7300 },
      { id: 'p-pool-7', ign: 'CarryGod', role: 'Position 1 — Carry', sRole: 'Position 2 — Mid', mmr: 7450 },
      { id: 'p-pool-8', ign: 'IronOfflane', role: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', mmr: 7250 },
      { id: 'p-pool-9', ign: 'Disabler', role: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', mmr: 7050 },
      { id: 'p-pool-10', ign: 'Healer', role: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', mmr: 7000 },
      { id: 'p-pool-11', ign: 'FlexMid', role: 'Position 2 — Mid', sRole: 'Position 1 — Carry', mmr: 7200 },
      { id: 'p-pool-12', ign: 'Pusher', role: 'Position 3 — Offlane', sRole: 'Position 1 — Carry', mmr: 7150 },
      { id: 'p-pool-13', ign: 'Roamer', role: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', mmr: 7100 },
      { id: 'p-pool-14', ign: 'Protector', role: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', mmr: 6950 },
      { id: 'p-pool-15', ign: 'SniperAce', role: 'Position 1 — Carry', sRole: 'Position 2 — Mid', mmr: 7350 },
      { id: 'p-pool-16', ign: 'StormLord', role: 'Position 2 — Mid', sRole: 'Position 3 — Offlane', mmr: 7250 },
      { id: 'p-pool-17', ign: 'TideHunter', role: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', mmr: 7100 },
      { id: 'p-pool-18', ign: 'SkyMage', role: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', mmr: 7050 }
    ];

    for (const c of contenders) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: c.id,
        ign: c.ign,
        primaryRole: c.role as DotaRolePosition,
        secondaryRole: c.sRole as DotaRolePosition,
        declaredMmr: c.mmr,
        rulesAccepted: true
      });
      dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, c.id, ORGANISER_ID, c.mmr);
    }

    // Register one UNVERIFIED contender
    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: TOURNAMENT_ID,
      userId: UNVERIFIED_PLAYER_ID,
      ign: 'RogueOne',
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMmr: 7500,
      rulesAccepted: true
    });
    // Deliberately NOT verified (status = REGISTERED)

    engine.initializeFromRegistrations();
  });

  // =========================================================================
  // 1. Captain Selection & Team Creation
  // =========================================================================
  describe('1. Captain Selection & Team Creation', () => {
    it('allows organiser to appoint captain from VERIFIED contenders and creates team with 1/5 primary roster', () => {
      const res = engine.appointCaptain(CAPTAIN_1_ID, {
        teamName: 'Team Alpha',
        tag: 'ALP',
        color: '#7C3AED',
        logo: '⚡'
      }, ORGANISER_ID);

      expect(res.success).toBe(true);
      expect(res.team).toBeDefined();
      expect(res.team?.captainId).toBe(CAPTAIN_1_ID);
      expect(res.team?.captainIgn).toBe('AlphaLead');
      expect(res.team?.startingCredits).toBe(1000);
      expect(res.team?.remainingCredits).toBe(1000);

      // Invariant: Captain counts toward 5-player primary roster
      expect(res.team?.primaryRoster.length).toBe(1);
      expect(res.team?.primaryRoster[0].id).toBe(CAPTAIN_1_ID);
      expect(res.team?.primaryRoster[0].isCaptain).toBe(true);
      expect(res.team?.primaryRoster[0].status).toBe('SOLD');
    });

    it('rejects captain appointment from UNVERIFIED contenders', () => {
      const res = engine.appointCaptain(UNVERIFIED_PLAYER_ID, {
        teamName: 'Rogue Squad',
        tag: 'RS'
      }, ORGANISER_ID);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only VERIFIED contenders are eligible/i);
    });

    it('denies normal player from appointing themselves as captain via authoritative server', () => {
      expect(() => {
        trustedTournamentOps.executeAppointCaptain(normalPlayerCaller, {
          tournamentId: TOURNAMENT_ID,
          candidateUserId: normalPlayerCaller.userId,
          teamName: 'Self Appointed',
          tag: 'SA'
        });
      }).toThrow(/Unauthorized.*Only.*organizers/i);
    });
  });

  // =========================================================================
  // 2. Authoritative Auction Bidding & Validation
  // =========================================================================
  describe('2. Authoritative Auction Bidding & Validation', () => {
    let team1: DotaAuctionTeam;
    let team2: DotaAuctionTeam;

    beforeEach(() => {
      team1 = engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Team Alpha', tag: 'ALP' }, ORGANISER_ID).team!;
      team2 = engine.appointCaptain(CAPTAIN_2_ID, { teamName: 'Team Bravo', tag: 'BRV' }, ORGANISER_ID).team!;
      engine.startAuction(ORGANISER_ID);
    });

    it('processes valid captain bids and updates auction state', () => {
      // Nominate player
      const nomRes = engine.nominatePlayer('p-pool-1', ORGANISER_ID);
      expect(nomRes.success).toBe(true);
      expect(engine.getState().nominee?.username).toBe('Striker');
      expect(engine.getState().currentBid).toBe(10);

      // Captain 1 bids 20
      const bid1 = engine.placeBid({
        teamId: team1.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 20
      });
      expect(bid1.success).toBe(true);
      expect(bid1.currentBid).toBe(20);
      expect(bid1.leadingTeamName).toBe('Team Alpha');

      // Captain 2 bids 30
      const bid2 = engine.placeBid({
        teamId: team2.id,
        captainUserId: CAPTAIN_2_ID,
        bidAmount: 30
      });
      expect(bid2.success).toBe(true);
      expect(bid2.currentBid).toBe(30);
      expect(bid2.leadingTeamName).toBe('Team Bravo');
    });

    it('denies captain from bidding on behalf of a rival team', () => {
      engine.nominatePlayer('p-pool-1', ORGANISER_ID);

      const rivalBid = engine.placeBid({
        teamId: team2.id, // Team Bravo
        captainUserId: CAPTAIN_1_ID, // Captain of Team Alpha
        bidAmount: 50
      });

      expect(rivalBid.success).toBe(false);
      expect(rivalBid.error).toMatch(/not the authorized captain/i);
    });

    it('rejects stale bids when expected revision does not match current state', () => {
      engine.nominatePlayer('p-pool-1', ORGANISER_ID);
      const currentRev = engine.getState().revision;

      // Bid 1 advances revision
      engine.placeBid({
        teamId: team1.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 20,
        expectedRevision: currentRev
      });

      // Competing captain attempts to submit bid with old revision
      const staleBid = engine.placeBid({
        teamId: team2.id,
        captainUserId: CAPTAIN_2_ID,
        bidAmount: 30,
        expectedRevision: currentRev // STALE
      });

      expect(staleBid.success).toBe(false);
      expect(staleBid.error).toMatch(/Stale Bid.*revision changed/i);
    });

    it('rejects bids that exceed available team credits (overspend)', () => {
      engine.nominatePlayer('p-pool-1', ORGANISER_ID);

      const overspendBid = engine.placeBid({
        teamId: team1.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 1500 // Exceeds 1000 credits
      });

      expect(overspendBid.success).toBe(false);
      expect(overspendBid.error).toMatch(/Insufficient credits/i);
    });
  });

  // =========================================================================
  // 3. Mandatory Reserve Rule Invariant
  // =========================================================================
  describe('3. Mandatory Reserve Rule Invariant', () => {
    it('enforces mandatory reserve for remaining unfilled primary slots without including stand-ins', () => {
      const team = engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Reserve Team', tag: 'RES' }, ORGANISER_ID).team!;
      engine.appointCaptain(CAPTAIN_2_ID, { teamName: 'Other Team', tag: 'OTH' }, ORGANISER_ID);
      engine.startAuction(ORGANISER_ID);

      // Team has 1 player (captain). Needs 4 more players for 5/5 mandatory roster.
      // If bidding for player 2: remaining unfilled slots AFTER this lot = 3.
      // Mandatory reserve needed = 3 slots * 10 credits/slot = 30 credits.
      // Total credits = 1000.
      // Maximum allowable bid = 1000 - 30 = 970 credits.
      engine.nominatePlayer('p-pool-1', ORGANISER_ID);

      // Attempting to bid 980 leaves only 20 credits, violating 30 credit reserve -> MUST BE REJECTED
      const invalidBid = engine.placeBid({
        teamId: team.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 980
      });
      expect(invalidBid.success).toBe(false);
      expect(invalidBid.error).toMatch(/Reserve Rule Violation.*Must retain at least 30 credits/i);

      // Bidding 970 leaves exactly 30 credits -> MUST SUCCEED
      const validBid = engine.placeBid({
        teamId: team.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 970
      });
      expect(validBid.success).toBe(true);
      expect(validBid.currentBid).toBe(970);
    });
  });

  // =========================================================================
  // 4. Player States & Strict UNSOLD vs UNSELECTED Separation
  // =========================================================================
  describe('4. Strict Player States (AVAILABLE, NOMINATED, SOLD, UNSOLD, UNSELECTED)', () => {
    let teamA: DotaAuctionTeam;
    let teamB: DotaAuctionTeam;

    beforeEach(() => {
      teamA = engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Team A', tag: 'TA' }, ORGANISER_ID).team!;
      teamB = engine.appointCaptain(CAPTAIN_2_ID, { teamName: 'Team B', tag: 'TB' }, ORGANISER_ID).team!;
      engine.startAuction(ORGANISER_ID);
    });

    it('correctly transitions and maintains distinct SOLD and UNSOLD states', () => {
      // Lot 1: Sold to Team A
      engine.nominatePlayer('p-pool-1', ORGANISER_ID);
      engine.placeBid({ teamId: teamA.id, captainUserId: CAPTAIN_1_ID, bidAmount: 50 });
      const saleResult = engine.concludeNomination(true, ORGANISER_ID);

      expect(saleResult.outcome).toBe('SOLD');
      expect(saleResult.player.status).toBe('SOLD');
      expect(saleResult.player.teamId).toBe(teamA.id);
      expect(teamA.remainingCredits).toBe(950);
      expect(teamA.primaryRoster.length).toBe(2); // Captain + 1 drafted

      // Lot 2: Unsold (Nominated, but closed without winner)
      engine.nominatePlayer('p-pool-2', ORGANISER_ID);
      const unsoldResult = engine.concludeNomination(false, ORGANISER_ID);

      expect(unsoldResult.outcome).toBe('UNSOLD');
      expect(unsoldResult.player.status).toBe('UNSOLD');
      expect(engine.getUnsoldPlayers().some(p => p.id === 'p-pool-2')).toBe(true);
    });

    it('marks remaining untouched AVAILABLE players as UNSELECTED upon auction completion without merging with UNSOLD', () => {
      // Nominate and pass one as UNSOLD
      engine.nominatePlayer('p-pool-2', ORGANISER_ID);
      engine.concludeNomination(false, ORGANISER_ID);
      expect(engine.getUnsoldPlayers().length).toBe(1);

      // Finalize auction
      const finalizeRes = engine.finalizeAuction(ORGANISER_ID);
      expect(finalizeRes.success).toBe(true);
      expect(finalizeRes.unselectedCount).toBeGreaterThan(0);

      // Verify strict separation: UNSOLD list is distinct from UNSELECTED list
      const unsolds = engine.getUnsoldPlayers();
      const unselecteds = engine.getUnselectedPlayers();

      expect(unsolds.some(p => p.id === 'p-pool-2')).toBe(true);
      expect(unselecteds.some(p => p.id === 'p-pool-2')).toBe(false); // Unsold is NOT marked unselected

      // Untouched players in pool become UNSELECTED
      expect(unselecteds.some(p => p.id === 'p-pool-3')).toBe(true);
      expect(engine.getState().status).toBe('COMPLETED');
    });

    it('rejects nominations or bids after auction completion', () => {
      engine.finalizeAuction(ORGANISER_ID);

      const nom = engine.nominatePlayer('p-pool-4', ORGANISER_ID);
      expect(nom.success).toBe(false);
      expect(nom.error).toMatch(/Auction is completed/i);

      const bid = engine.placeBid({
        teamId: teamA.id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 20
      });
      expect(bid.success).toBe(false);
      expect(bid.error).toMatch(/Auction is currently COMPLETED/i);
    });
  });

  // =========================================================================
  // 5. Optional Stand-in Support (0/1)
  // =========================================================================
  describe('5. Optional Stand-in Support', () => {
    it('supports assigning 1 optional stand-in without blocking tournament progression', () => {
      const team = engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Standin Squad', tag: 'SS' }, ORGANISER_ID).team!;

      // Assign stand-in
      const standinRes = engine.assignOptionalStandIn(team.id, 'p-pool-5', ORGANISER_ID);
      expect(standinRes.success).toBe(true);
      expect(standinRes.team?.standIns.length).toBe(1);
      expect(standinRes.team?.standIns[0].username).toBe('Warder');
      expect(standinRes.team?.standIns[0].isStandIn).toBe(true);

      // Primary roster remains captain-only (1/5)
      expect(standinRes.team?.primaryRoster.length).toBe(1);

      // Second stand-in exceeds limit of 1 -> DENIED
      const secondStandin = engine.assignOptionalStandIn(team.id, 'p-pool-6', ORGANISER_ID);
      expect(secondStandin.success).toBe(false);
      expect(secondStandin.error).toMatch(/maximum allowed stand-ins/i);
    });
  });

  // =========================================================================
  // 6. Purple Bean Test Cup Regression Fixture E2E
  // =========================================================================
  describe('6. Purple Bean Test Cup Regression Fixture E2E', () => {
    it('executes full Test Cup lifecycle: 3 captains -> competing bids -> SOLD -> UNSOLD -> mandatory 5/5 -> UNSELECTED -> optional stand-in -> finalized', () => {
      // Step 1: Confirm 3 captains and teams in Test Cup
      const capRes = testCupEngine.confirmCaptainsAndTeams();
      expect(capRes.success).toBe(true);
      expect(capRes.captains.length).toBe(3);
      expect(capRes.teams.length).toBe(3);

      const teamA = capRes.teams[0];
      const teamB = capRes.teams[1];
      const teamC = capRes.teams[2];

      expect(teamA.credits).toBe(1000);
      expect(teamB.credits).toBe(1000);
      expect(teamC.credits).toBe(1000);

      // Step 2: Nominate player 1 and place competing bids
      const p1 = testCupEngine.getPlayers().find(p => !p.isCaptain && p.auctionStatus === 'AVAILABLE')!;
      testCupEngine.nominatePlayer(p1.id);

      testCupEngine.placeAuctionBid({
        teamId: teamA.id,
        captainUserId: teamA.captainId,
        bidAmount: 30
      });
      testCupEngine.placeAuctionBid({
        teamId: teamB.id,
        captainUserId: teamB.captainId,
        bidAmount: 50
      });

      // Conclude nomination: SOLD to Team B
      const sale1 = testCupEngine.concludeNomination(true);
      expect(sale1.outcome).toBe('SOLD');
      expect(teamB.credits).toBe(950);
      expect(teamB.primaryRoster.length).toBe(2);

      // Step 3: Nominate player 2 and conclude as UNSOLD
      const p2 = testCupEngine.getPlayers().find(p => !p.isCaptain && p.auctionStatus === 'AVAILABLE')!;
      testCupEngine.nominatePlayer(p2.id);
      const unsoldSale = testCupEngine.concludeNomination(false);
      expect(unsoldSale.outcome).toBe('UNSOLD');
      expect(p2.auctionStatus).toBe('UNSOLD');

      // Step 4: Draft until all 3 teams have filled 5-player mandatory primary rosters
      // Each team started with 1 captain. Team B currently has 2. Team A has 1. Team C has 1.
      // Draft 3 more for Team B, 4 for Team A, 4 for Team C (total 11 more slots)
      const draftList = [
        { team: teamA, count: 4 },
        { team: teamB, count: 3 },
        { team: teamC, count: 4 }
      ];

      for (const draftTarget of draftList) {
        for (let i = 0; i < draftTarget.count; i++) {
          const avail = testCupEngine.getPlayers().find(p => !p.isCaptain && p.auctionStatus === 'AVAILABLE');
          if (!avail) break;
          testCupEngine.nominatePlayer(avail.id);
          testCupEngine.placeAuctionBid({
            teamId: draftTarget.team.id,
            captainUserId: draftTarget.team.captainId,
            bidAmount: 20
          });
          testCupEngine.concludeNomination(true);
        }
      }

      // Step 5: Verify all 3 teams have reached mandatory 5/5 primary rosters
      const allFilled = testCupEngine.getTeams().every(t => t.primaryRoster.length === 5);
      expect(allFilled).toBe(true);

      // Step 6: Verify remaining untouched available players became UNSELECTED
      expect(testCupEngine.getAuctionState().isCompleted).toBe(true);
      expect(testCupEngine.getAuctionState().unselectedCount).toBeGreaterThan(0);
      expect(testCupEngine.getPlayers().some(p => p.auctionStatus === 'UNSELECTED')).toBe(true);

      // Step 7: Verify UNSOLD player was NOT overwritten to UNSELECTED
      expect(p2.auctionStatus).toBe('UNSOLD');

      // Step 8: Optional stand-in assignment
      const unselectedPlayer = testCupEngine.getPlayers().find(p => p.auctionStatus === 'UNSELECTED')!;
      testCupEngine.assignOptionalStandIn(teamA.id, unselectedPlayer.id);
      expect(teamA.standIn).toBeDefined();
      expect(teamA.standIn?.id).toBe(unselectedPlayer.id);

      // Step 9: Refresh / state inspection persists
      const recheckedTeams = testCupEngine.getTeams();
      expect(recheckedTeams[0].primaryRoster.length).toBe(5);
      expect(recheckedTeams[0].standIn).toBeDefined();
      expect(testCupEngine.getStatus()).toBe('Rosters Locked');
    });
  });

  // =========================================================================
  // 7. Comprehensive Negative Invariant Assertions
  // =========================================================================
  describe('7. Negative Invariant Enforcement', () => {
    it('rejects client direct purse or roster mutation attempts without server transaction', () => {
      const team = engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Negative Team', tag: 'NEG' }, ORGANISER_ID).team!;
      
      // Attempting to directly mutate local team budget object does not alter authoritative state
      const snapshot = engine.getTeam(team.id)!;
      snapshot.remainingCredits = 999999;
      snapshot.primaryRoster.push({} as any);

      // Re-fetching from engine shows original unmodified values
      const trueTeam = engine.getTeam(team.id)!;
      expect(trueTeam.remainingCredits).toBe(1000);
      expect(trueTeam.primaryRoster.length).toBe(1);
    });

    it('rejects invalid bid increment not aligning with configured increment', () => {
      engine.appointCaptain(CAPTAIN_1_ID, { teamName: 'Team Inc', tag: 'INC' }, ORGANISER_ID);
      engine.appointCaptain(CAPTAIN_2_ID, { teamName: 'Team Inc 2', tag: 'IN2' }, ORGANISER_ID);
      engine.startAuction(ORGANISER_ID);
      engine.nominatePlayer('p-pool-1', ORGANISER_ID); // currentBid = 10, inc = 10

      // Proposing 17 (diff = 7, not multiple of 10)
      const invalidIncBid = engine.placeBid({
        teamId: engine.getTeams()[0].id,
        captainUserId: CAPTAIN_1_ID,
        bidAmount: 17
      });

      expect(invalidIncBid.success).toBe(false);
      expect(invalidIncBid.error).toMatch(/multiple of 10/i);
    });
  });
});
