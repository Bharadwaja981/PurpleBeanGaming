import { describe, it, expect, beforeEach } from 'vitest';
import { PurpleBeanTestCupEngine, TEST_CUP_CONFIG } from '../../src/domain/testCupEngine';
import { ratingLedger } from '../../src/domain/competitiveRatingEngine';

describe('Purple Bean Test Cup — Real Tournament End-to-End Engine', () => {
  let engine: PurpleBeanTestCupEngine;

  beforeEach(() => {
    engine = new PurpleBeanTestCupEngine();
  });

  describe('1. Tournament Creation & Configuration Document', () => {
    it('initializes Purple Bean Test Cup with exact tournament specifications', () => {
      expect(TEST_CUP_CONFIG.id).toBe('purple-bean-test-cup');
      expect(TEST_CUP_CONFIG.name).toBe('Purple Bean Test Cup');
      expect(TEST_CUP_CONFIG.game).toBe('Dota 2');
      expect(TEST_CUP_CONFIG.region).toBe('Pan India');
      expect(TEST_CUP_CONFIG.prizePoolINR).toBe('₹25,000');
      expect(TEST_CUP_CONFIG.startingCredits).toBe(1000);
      expect(TEST_CUP_CONFIG.minimumBid).toBe(10);
      expect(TEST_CUP_CONFIG.primaryRosterSize).toBe(5);
      expect(TEST_CUP_CONFIG.optionalStandInAllowed).toBe(true);
      expect(TEST_CUP_CONFIG.minReservePerSlot).toBe(10);

      expect(engine.getStatus()).toBe('Registration Open');
    });
  });

  describe('2. Test Users & Realistic Dota 2 Player Pool', () => {
    it('contains realistic Dota 2 players with roles, MMR, cities and regions', () => {
      const players = engine.getPlayers();
      expect(players.length).toBeGreaterThanOrEqual(21);

      // Verify 3 Captains
      const captains = players.filter(p => p.isCaptain);
      expect(captains.length).toBe(3);
      expect(captains.map(c => c.username)).toEqual(['Aether', 'Nova', 'Karma']);

      // Verify Dota roles & MMR realism
      const validRoles = [
        'Position 1 — Carry',
        'Position 2 — Mid',
        'Position 3 — Offlane',
        'Position 4 — Soft Support',
        'Position 5 — Hard Support'
      ];

      for (const p of players) {
        expect(validRoles).toContain(p.primaryRole);
        expect(p.mmr).toBeGreaterThanOrEqual(7000);
        expect(p.mmr).toBeLessThanOrEqual(9000);
        expect(p.city).toBeDefined();
        expect(p.region).toBeDefined();
      }
    });
  });

  describe('3. Registration & Verification Workflows', () => {
    it('allows new players to register during Registration Open stage', () => {
      const reg = engine.submitRegistration({
        username: 'ApexPredator',
        realName: 'Anand Kumar',
        city: 'Bengaluru',
        region: 'South India',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        mmr: 7800
      });

      expect(reg.success).toBe(true);
      expect(reg.player.registrationStatus).toBe('Registered');
    });

    it('organizer verifies players into eligible auction pool', () => {
      const verifyRes = engine.verifyPlayer('p-tc-1', true);
      expect(verifyRes.success).toBe(true);
      expect(verifyRes.status).toBe('Verified');

      const rejectRes = engine.verifyPlayer('p-tc-2', false);
      expect(rejectRes.success).toBe(true);
      expect(rejectRes.status).toBe('Rejected');
    });
  });

  describe('4. Captain Selection & Team Creation', () => {
    it('confirms 3 captains and initializes 3 teams with captain and 1000 credits', () => {
      const res = engine.confirmCaptainsAndTeams();
      expect(res.success).toBe(true);
      expect(res.captains).toEqual(['Aether', 'Nova', 'Karma']);
      expect(res.teams.length).toBe(3);

      const team1 = res.teams[0];
      expect(team1.name).toBe('Mumbai Mavericks');
      expect(team1.captainName).toBe('Aether');
      expect(team1.credits).toBe(1000);
      expect(team1.creditsUsed).toBe(0);
      expect(team1.primaryRoster.length).toBe(1); // Captain only (1/5)
      expect(team1.standIn).toBeUndefined();

      const team2 = res.teams[1];
      expect(team2.name).toBe('Hyderabad Raiders');
      expect(team2.captainName).toBe('Nova');
      expect(team2.credits).toBe(1000);

      const team3 = res.teams[2];
      expect(team3.name).toBe('Bengaluru Blaze');
      expect(team3.captainName).toBe('Karma');
      expect(team3.credits).toBe(1000);
    });
  });

  describe('5. Server-Authoritative Auction Validation', () => {
    beforeEach(() => {
      engine.confirmCaptainsAndTeams();
    });

    it('rejects bids below minimum opening bid', () => {
      engine.nominatePlayer('p-tc-1'); // Opening bid is 10
      expect(() => {
        engine.placeAuctionBid({
          teamId: 'tc-team-1',
          bidAmount: 5, // Below 10
          captainUserId: 'p-c1'
        });
      }).toThrow('Invalid bid: Proposed 5 must be greater than current bid 10');
    });

    it('denies captains from placing bids on behalf of rival teams', () => {
      engine.nominatePlayer('p-tc-1');
      // Captain of Mumbai Mavericks (p-c1) attempts to bid for Hyderabad Raiders (tc-team-2)
      expect(() => {
        engine.placeAuctionBid({
          teamId: 'tc-team-2',
          bidAmount: 20,
          captainUserId: 'p-c1'
        });
      }).toThrow("Permission Denied: User 'p-c1' is not the captain of Hyderabad Raiders");
    });

    it('enforces mandatory roster reserve constraint', () => {
      engine.nominatePlayer('p-tc-1');
      // Team 1 currently has 1 player (captain). Needs 4 more primary players.
      // Unfilled slots needed after this bid = 3. Reserve needed = 3 * 10 = 30 credits.
      // Team has 1000 credits. If team bids 980 credits -> remaining is 20 < 30 -> REJECT!
      expect(() => {
        engine.placeAuctionBid({
          teamId: 'tc-team-1',
          bidAmount: 980,
          captainUserId: 'p-c1'
        });
      }).toThrow('Illegal Bid: Must reserve at least 30 credits');
    });

    it('accepts valid bid and updates leading team', () => {
      engine.nominatePlayer('p-tc-1');
      const bidRes = engine.placeAuctionBid({
        teamId: 'tc-team-1',
        bidAmount: 150,
        captainUserId: 'p-c1'
      });

      expect(bidRes.success).toBe(true);
      expect(bidRes.currentBid).toBe(150);
      expect(bidRes.leadingTeamName).toBe('Mumbai Mavericks');
    });
  });

  describe('6. Player Outcomes: SOLD, UNSOLD, and UNSELECTED', () => {
    beforeEach(() => {
      engine.confirmCaptainsAndTeams();
    });

    it('demonstrates SOLD when a nominated player receives a winning bid', () => {
      engine.nominatePlayer('p-tc-1');
      engine.placeAuctionBid({
        teamId: 'tc-team-1',
        bidAmount: 200,
        captainUserId: 'p-c1'
      });

      const outcome = engine.concludeNomination(true);
      expect(outcome.outcome).toBe('SOLD');
      expect(outcome.player.auctionStatus).toBe('SOLD');
      expect(outcome.player.teamName).toBe('Mumbai Mavericks');

      const team1 = engine.getTeams()[0];
      expect(team1.credits).toBe(800);
      expect(team1.primaryRoster.length).toBe(2); // Captain + 1 drafted
    });

    it('demonstrates UNSOLD when a nominated player expires without winning bids', () => {
      engine.nominatePlayer('p-tc-14');
      const outcome = engine.concludeNomination(false); // Expired with no bids

      expect(outcome.outcome).toBe('UNSOLD');
      expect(outcome.player.auctionStatus).toBe('UNSOLD');
      expect(engine.getAuctionState().unsoldPlayers.length).toBe(1);
    });

    it('demonstrates UNSELECTED for untouched players once all 3 teams fill 5-player rosters', () => {
      const fullRun = engine.runFullTournamentSimulation();
      expect(fullRun.success).toBe(true);
      expect(fullRun.summary.unselectedCount).toBe(7);

      const auctionState = engine.getAuctionState();
      expect(auctionState.unselectedPlayers.length).toBe(6); // 1 became optional stand-in
      for (const unselected of auctionState.unselectedPlayers) {
        expect(unselected.auctionStatus).toBe('UNSELECTED');
      }
    });
  });

  describe('7. Team Roster Completion & Optional Stand-In Phase', () => {
    it('completes mandatory roster at 5 players (1 captain + 4 drafted) and allows 1 optional stand-in', () => {
      engine.confirmCaptainsAndTeams();

      // Draft 4 players for Team 1
      for (let i = 1; i <= 4; i++) {
        engine.nominatePlayer(`p-tc-${i}`);
        engine.placeAuctionBid({
          teamId: 'tc-team-1',
          bidAmount: 50,
          captainUserId: 'p-c1'
        });
        engine.concludeNomination(true);
      }

      const team1 = engine.getTeams()[0];
      expect(team1.primaryRoster.length).toBe(5); // 1 Captain + 4 Drafted = 5/5
      expect(team1.standIn).toBeUndefined(); // 0/1 Stand-in

      // Assign 1 optional stand-in
      const standInRes = engine.assignOptionalStandIn('tc-team-1', 'p-tc-13');
      expect(standInRes.success).toBe(true);
      expect(standInRes.team.standIn?.username).toBe('Rogue');
    });
  });

  describe('8. 3-Team Single Elimination Bracket with Proper BYE', () => {
    it('models Semifinal and assigns Bengaluru Blaze a BYE into Grand Final', () => {
      engine.confirmCaptainsAndTeams();
      const bracket = engine.generateSingleEliminationBracket();

      // Semifinal Match
      expect(bracket.semifinal.round).toBe('Semifinal');
      expect(bracket.semifinal.teamA.name).toBe('Mumbai Mavericks');
      expect(bracket.semifinal.teamB.name).toBe('Hyderabad Raiders');
      expect(bracket.semifinal.seriesFormat).toBe('Best of 3');

      // Grand Final Match: Team B is Bengaluru Blaze (received BYE)
      expect(bracket.grandFinal.round).toBe('Grand Final');
      expect(bracket.grandFinal.teamB.name).toBe('Bengaluru Blaze');
      expect(bracket.grandFinal.teamA.name).toBe('Winner of Semifinal');
    });
  });

  describe('9. Complete Match Results, Winner Progression & Ratings', () => {
    it('executes Semifinal 2-1, advances winner, and executes Grand Final 2-0', () => {
      engine.confirmCaptainsAndTeams();
      engine.generateSingleEliminationBracket();

      // Semifinal: Mumbai Mavericks (2) vs Hyderabad Raiders (1)
      const semiRes = engine.executeSemifinalResult(2, 1);
      expect(semiRes.advancingTeam.name).toBe('Mumbai Mavericks');
      expect(semiRes.thirdPlaceTeam.name).toBe('Hyderabad Raiders');
      expect(semiRes.thirdPlaceTeam.placement).toBe('3rd Place');
      expect(semiRes.ratingDelta).toBeGreaterThan(0);

      // Verify Grand Final Match now has Mumbai Mavericks
      const finalMatch = engine.getMatches().find(m => m.id === 'tc-match-final');
      expect(finalMatch?.teamA.name).toBe('Mumbai Mavericks');

      // Grand Final: Mumbai Mavericks (2) vs Bengaluru Blaze (0)
      const finalRes = engine.executeGrandFinalResult(2, 0);
      expect(finalRes.championTeam.name).toBe('Mumbai Mavericks');
      expect(finalRes.championTeam.placement).toBe('Champion (1st Place)');
      expect(finalRes.runnerUpTeam.name).toBe('Bengaluru Blaze');
      expect(finalRes.runnerUpTeam.placement).toBe('Runner-up (2nd Place)');
    });
  });

  describe('10. Tournament Completion & Career Record Persistence', () => {
    it('completes tournament and updates player careers and team placements', () => {
      const fullRun = engine.runFullTournamentSimulation();
      expect(fullRun.success).toBe(true);
      expect(fullRun.summary.champion).toBe('Mumbai Mavericks');
      expect(fullRun.summary.runnerUp).toBe('Bengaluru Blaze');
      expect(fullRun.summary.thirdPlace).toBe('Hyderabad Raiders');

      expect(engine.getStatus()).toBe('Completed');

      // Verify Player Career Placement Updates
      const players = engine.getPlayers();
      const aether = players.find(p => p.username === 'Aether');
      expect(aether?.finalPlacement).toBe('Champion (1st Place)');

      const karma = players.find(p => p.username === 'Karma');
      expect(karma?.finalPlacement).toBe('Runner-up (2nd Place)');

      const nova = players.find(p => p.username === 'Nova');
      expect(nova?.finalPlacement).toBe('3rd Place');

      // Verify Audit Trail is fully logged
      const audit = engine.getAuditTrail();
      expect(audit.length).toBeGreaterThanOrEqual(10);
      expect(audit.some(a => a.action === 'tournament_completed')).toBe(true);
      expect(audit.some(a => a.action === 'grand_final_completed')).toBe(true);
      expect(audit.some(a => a.action === 'semifinal_completed')).toBe(true);
      expect(audit.some(a => a.action === 'bracket_generated')).toBe(true);
      expect(audit.some(a => a.action === 'auction_completed')).toBe(true);

      // Verify Competitive Rating Ledger records
      const ratingRecords = ratingLedger.getAllRecords();
      expect(Array.isArray(ratingRecords)).toBe(true);
      expect(ratingRecords.length).toBeGreaterThanOrEqual(2);
      const semiRecord = ratingRecords.find(r => r.matchId === 'tc-match-semi-1');
      expect(semiRecord).toBeDefined();
      expect(semiRecord?.winnerTeamId).toBe('tc-team-1');
      expect(semiRecord?.delta).toBeGreaterThan(0);
      const finalRecord = ratingRecords.find(r => r.matchId === 'tc-match-final');
      expect(finalRecord).toBeDefined();
      expect(finalRecord?.winnerTeamId).toBe('tc-team-1');
    });
  });
});
