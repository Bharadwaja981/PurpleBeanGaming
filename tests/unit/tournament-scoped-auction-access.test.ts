import { describe, it, expect, beforeEach } from 'vitest';
import { tournamentConfigRegistry } from '../../src/domain/tournamentConfigRegistry';
import { getAuctionEngine, resetAuctionEngine } from '../../src/domain/dotaAuctionEngine';
import { dotaPlayerRegistry, DotaRolePosition } from '../../src/domain/dotaPlayerEngine';

function registerAndVerifyContenders(tournamentId: string, users: Array<{ id: string; ign: string; role?: string; mmr?: number }>) {
  for (const u of users) {
    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId,
      userId: u.id,
      ign: u.ign,
      primaryRole: (u.role || 'Position 1 — Carry') as DotaRolePosition,
      secondaryRole: 'Position 2 — Mid' as DotaRolePosition,
      declaredMmr: u.mmr || 7500,
      rulesAccepted: true
    });
    dotaPlayerRegistry.verifyRegistration(tournamentId, u.id, 'organiser-admin', u.mmr || 7500);
  }
}

describe('Purple Bean Gaming — Tournament-Scoped Auction Access & Isolation', () => {
  beforeEach(() => {
    // Reset registries & engines for clean test states
    dotaPlayerRegistry.seedInitialPlayers();
    resetAuctionEngine('test-tourn-a');
    resetAuctionEngine('test-tourn-b');
    resetAuctionEngine('test-lifecycle-cup');
    resetAuctionEngine('purple-bean-test-cup');
    resetAuctionEngine('purple-bean-india-masters-2026');
  });

  describe('1. Auction Config Gating (Derived strictly from configuration)', () => {
    it('enables auction ONLY when teamFormation.mode === "AUCTION"', () => {
      // Auction-configured tournaments
      expect(tournamentConfigRegistry.isAuctionSupported('purple-bean-test-cup')).toBe(true);
      expect(tournamentConfigRegistry.isAuctionSupported('purple-bean-india-masters-2026')).toBe(true);
      
      // Premade-configured tournaments
      expect(tournamentConfigRegistry.isAuctionSupported('india-dota-open-2026')).toBe(false);
      expect(tournamentConfigRegistry.isAuctionSupported('pb-challenger-2026')).toBe(false);

      // Non-existent or empty tournament
      expect(tournamentConfigRegistry.isAuctionSupported('unknown-cup')).toBe(false);
      expect(tournamentConfigRegistry.isAuctionSupported('')).toBe(false);
      expect(tournamentConfigRegistry.isAuctionSupported(undefined)).toBe(false);
    });

    it('does NOT determine access from tournament name or hardcoded IDs', () => {
      // Custom tournament with arbitrary ID but configured with AUCTION
      const customAuctionTournament = {
        identity: {
          tournamentId: 'mumbai-community-cup-xyz',
          name: 'Mumbai Community Cup',
          gameId: 'dota2',
          gameName: 'Dota 2',
          description: 'Community cup',
          region: 'West India',
          locationType: 'ONLINE' as const
        },
        registration: {
          registrationMode: 'INDIVIDUAL' as const,
          openDate: '2026-10-01',
          closeDate: '2026-10-10',
          maxParticipants: 20,
          eligibilityRules: { minMmrOrRank: 3000, regionLocked: true, requireKyc: false }
        },
        teamFormation: {
          mode: 'AUCTION' as const,
          numberOfTeams: 2
        },
        auction: {
          enabled: true,
          startingCreditsPerTeam: 1000,
          bidTimerSeconds: 25,
          nominationTimerSeconds: 30,
          minimumBid: 10,
          bidIncrement: 10,
          reservePerSlot: 10
        },
        roster: {
          primaryRosterSize: 5,
          captainCountsTowardRoster: true,
          substituteSlots: 1,
          substituteRequired: false
        },
        competition: {
          format: 'SINGLE_ELIMINATION' as const,
          defaultSeriesFormat: 'BO3' as const,
          seedingMethod: 'RATING_BASED' as const
        },
        prizes: { totalPrizePoolINR: 10000, placementDistribution: [] },
        integrity: { verificationRequired: false, organizerApprovalRequired: false }
      };

      tournamentConfigRegistry.registerConfig(customAuctionTournament);
      expect(tournamentConfigRegistry.isAuctionSupported('mumbai-community-cup-xyz')).toBe(true);

      // Arbitrary premade tournament with "auction" in the name must still evaluate false if mode !== 'AUCTION'
      const fakeAuctionNamedPremade = {
        identity: {
          tournamentId: 'fake-auction-named-squads',
          name: 'Auction Masters Invitational',
          gameId: 'dota2',
          gameName: 'Dota 2',
          description: 'Premade squad cup',
          region: 'Pan India',
          locationType: 'ONLINE' as const
        },
        registration: {
          registrationMode: 'PREMADE_TEAM' as const,
          openDate: '2026-10-01',
          closeDate: '2026-10-10',
          maxParticipants: 8,
          eligibilityRules: { minMmrOrRank: 3000, regionLocked: true, requireKyc: false }
        },
        teamFormation: {
          mode: 'PREMADE' as const,
          numberOfTeams: 8
        },
        roster: {
          primaryRosterSize: 5,
          captainCountsTowardRoster: true,
          substituteSlots: 1,
          substituteRequired: false
        },
        competition: {
          format: 'SINGLE_ELIMINATION' as const,
          defaultSeriesFormat: 'BO3' as const,
          seedingMethod: 'RATING_BASED' as const
        },
        prizes: { totalPrizePoolINR: 10000, placementDistribution: [] },
        integrity: { verificationRequired: false, organizerApprovalRequired: false }
      };

      tournamentConfigRegistry.registerConfig(fakeAuctionNamedPremade);
      expect(tournamentConfigRegistry.isAuctionSupported('fake-auction-named-squads')).toBe(false);
    });
  });

  describe('2. Lifecycle-Aware Access & History Preservation', () => {
    it('derives correct lifecycle states: NOT_READY -> READY -> LIVE -> COMPLETED', () => {
      const tourneyId = 'test-lifecycle-cup';
      
      // Register candidates
      registerAndVerifyContenders(tourneyId, [
        { id: 'user-cap-1', ign: 'Cap1' },
        { id: 'user-cap-2', ign: 'Cap2' },
        { id: 'user-player-1', ign: 'Player1' }
      ]);

      const engine = getAuctionEngine(tourneyId);

      // Before captains appointed: NOT_READY
      let lifecycle = tournamentConfigRegistry.getAuctionLifecycle(tourneyId);
      expect(lifecycle.status).toBe('NOT_READY');
      expect(lifecycle.ctaText).toBe('WAITING FOR CAPTAIN SELECTION');

      // Appoint 2 captains
      const app1 = engine.appointCaptain('user-cap-1', { teamName: 'Alpha', tag: 'ALP' }, 'organiser-1');
      const app2 = engine.appointCaptain('user-cap-2', { teamName: 'Beta', tag: 'BET' }, 'organiser-1');
      expect(app1.success).toBe(true);
      expect(app2.success).toBe(true);

      lifecycle = tournamentConfigRegistry.getAuctionLifecycle(tourneyId);
      expect(lifecycle.status).toBe('READY');
      expect(lifecycle.ctaText).toBe('ENTER AUCTION LOBBY');

      // Start auction floor
      engine.startAuction('organiser-1');
      lifecycle = tournamentConfigRegistry.getAuctionLifecycle(tourneyId);
      expect(lifecycle.status).toBe('LIVE');
      expect(lifecycle.ctaText).toBe('VIEW LIVE AUCTION');

      // Finalize auction
      engine.finalizeAuction('organiser-1');
      lifecycle = tournamentConfigRegistry.getAuctionLifecycle(tourneyId);
      expect(lifecycle.status).toBe('COMPLETED');
      expect(lifecycle.ctaText).toBe('VIEW AUCTION RESULTS');

      // History remains preserved and accessible
      expect(engine.getState().isCompleted).toBe(true);
      expect(engine.getTeams().length).toBe(2);
      expect(engine.getBidHistory()).toBeDefined();
    });
  });

  describe('3. Captain Tournament Isolation', () => {
    it('allows a captain in Tournament A to bid in Tournament A', () => {
      registerAndVerifyContenders('test-tourn-a', [
        { id: 'captain-alice', ign: 'Alice' },
        { id: 'captain-bob', ign: 'Bob' },
        { id: 'player-carol', ign: 'Carol' }
      ]);

      const engineA = getAuctionEngine('test-tourn-a');
      const teamA1 = engineA.appointCaptain('captain-alice', { teamName: 'Alice Squad', tag: 'ASQ' }, 'organiser-1');
      const teamA2 = engineA.appointCaptain('captain-bob', { teamName: 'Bob Brigade', tag: 'BBG' }, 'organiser-1');
      expect(teamA1.success).toBe(true);
      expect(teamA2.success).toBe(true);

      const startRes = engineA.startAuction('organiser-1');
      expect(startRes.success).toBe(true);
      const nomRes = engineA.nominatePlayer('player-carol', 'organiser-1');
      expect(nomRes.success).toBe(true);

      // Alice can bid in Tournament A
      const bidRes = engineA.placeBid({
        teamId: teamA1.team!.id,
        captainUserId: 'captain-alice',
        bidAmount: 50
      });
      expect(bidRes.success).toBe(true);
      expect(engineA.getState().leadingTeamId).toBe(teamA1.team!.id);
      expect(engineA.getState().currentBid).toBe(50);
    });

    it('strictly PREVENTS captain in Tournament A from bidding in Tournament B', () => {
      registerAndVerifyContenders('test-tourn-a', [
        { id: 'captain-alice', ign: 'Alice' }
      ]);
      registerAndVerifyContenders('test-tourn-b', [
        { id: 'captain-charlie', ign: 'Charlie' },
        { id: 'captain-david', ign: 'David' },
        { id: 'player-eve', ign: 'Eve' }
      ]);

      const engineA = getAuctionEngine('test-tourn-a');
      const engineB = getAuctionEngine('test-tourn-b');

      // Alice is captain in Tournament A
      const teamA = engineA.appointCaptain('captain-alice', { teamName: 'Alice Squad', tag: 'ASQ' }, 'organiser-1');
      expect(teamA.success).toBe(true);
      
      // Tournament B has Captain Charlie and Captain David
      const teamB1 = engineB.appointCaptain('captain-charlie', { teamName: 'Charlie Force', tag: 'CFC' }, 'organiser-1');
      const teamB2 = engineB.appointCaptain('captain-david', { teamName: 'David Dynamos', tag: 'DDN' }, 'organiser-1');
      expect(teamB1.success).toBe(true);
      expect(teamB2.success).toBe(true);

      engineB.startAuction('organiser-1');
      const nomRes = engineB.nominatePlayer('player-eve', 'organiser-1');
      expect(nomRes.success).toBe(true);

      // Alice attempts to bid in Tournament B without an assigned team in B -> MUST FAIL
      const unauthorizedBid1 = engineB.placeBid({
        captainUserId: 'captain-alice',
        bidAmount: 50
      });
      expect(unauthorizedBid1.success).toBe(false);
      expect(unauthorizedBid1.error).toContain('not an appointed captain of any tournament team');

      // Alice attempts to spoof Charlie's team in Tournament B -> MUST FAIL
      const unauthorizedBid2 = engineB.placeBid({
        teamId: teamB1.team!.id,
        captainUserId: 'captain-alice',
        bidAmount: 50
      });
      expect(unauthorizedBid2.success).toBe(false);
      expect(unauthorizedBid2.error).toContain('not an appointed captain of any tournament team');

      // Alice attempts to use her Tournament A team ID in Tournament B -> MUST FAIL
      const unauthorizedBid3 = engineB.placeBid({
        teamId: teamA.team!.id,
        captainUserId: 'captain-alice',
        bidAmount: 50
      });
      expect(unauthorizedBid3.success).toBe(false);

      // Charlie can bid in Tournament B
      const charlieBid = engineB.placeBid({
        teamId: teamB1.team!.id,
        captainUserId: 'captain-charlie',
        bidAmount: 50
      });
      expect(charlieBid.success).toBe(true);
    });
  });

  describe('4. Organiser Tournament Isolation', () => {
    it('restricts tournament auction operations to authorized organizers', () => {
      const authorizedOrg = { userId: 'org-authorized', role: 'organizer' };
      const unauthorizedUser = { userId: 'random-player', role: 'player' };
      const adminUser = { userId: 'site-admin', isAdmin: true };

      expect(tournamentConfigRegistry.canUserManageTournamentAuction(authorizedOrg, 'purple-bean-test-cup')).toBe(true);
      expect(tournamentConfigRegistry.canUserManageTournamentAuction(adminUser, 'purple-bean-test-cup')).toBe(true);
      expect(tournamentConfigRegistry.canUserManageTournamentAuction(unauthorizedUser, 'purple-bean-test-cup')).toBe(false);
    });
  });

  describe('5. Multiple Simultaneous Auction Tournaments Isolation', () => {
    it('maintains complete isolation between Tournament A and Tournament B with no state leakage', () => {
      registerAndVerifyContenders('test-tourn-a', [
        { id: 'cap-a1', ign: 'CapA1' },
        { id: 'cap-a2', ign: 'CapA2' },
        { id: 'p-a', ign: 'PlayerA' }
      ]);
      registerAndVerifyContenders('test-tourn-b', [
        { id: 'cap-b1', ign: 'CapB1' },
        { id: 'cap-b2', ign: 'CapB2' },
        { id: 'p-b', ign: 'PlayerB' }
      ]);

      const engineA = getAuctionEngine('test-tourn-a');
      const engineB = getAuctionEngine('test-tourn-b');

      // Appoint teams in A
      const teamA1 = engineA.appointCaptain('cap-a1', { teamName: 'Team A1', tag: 'TA1' }, 'org');
      const teamA2 = engineA.appointCaptain('cap-a2', { teamName: 'Team A2', tag: 'TA2' }, 'org');
      expect(teamA1.success).toBe(true);
      expect(teamA2.success).toBe(true);

      // Appoint teams in B with distinct properties
      const teamB1 = engineB.appointCaptain('cap-b1', { teamName: 'Team B1', tag: 'TB1' }, 'org');
      const teamB2 = engineB.appointCaptain('cap-b2', { teamName: 'Team B2', tag: 'TB2' }, 'org');
      expect(teamB1.success).toBe(true);
      expect(teamB2.success).toBe(true);

      // Verify teams are strictly partitioned
      expect(engineA.getTeams().map(t => t.id)).toEqual([teamA1.team!.id, teamA2.team!.id]);
      expect(engineB.getTeams().map(t => t.id)).toEqual([teamB1.team!.id, teamB2.team!.id]);
      expect(engineA.getTeams().map(t => t.name)).not.toContain('Team B1');

      // Start A and nominate PlayerA
      engineA.startAuction('org');
      const nomA = engineA.nominatePlayer('p-a', 'org');
      expect(nomA.success).toBe(true);

      // Verify A is LIVE with PlayerA, while B is still PENDING with NO nominee
      expect(engineA.getState().status).toBe('LIVE');
      expect(engineA.getState().nominee?.username).toBe('PlayerA');
      expect(engineB.getState().status).toBe('PENDING');
      expect(engineB.getState().nominee).toBeNull();

      // Place bid in A
      const bidA = engineA.placeBid({ teamId: teamA1.team!.id, captainUserId: 'cap-a1', bidAmount: 120 });
      expect(bidA.success).toBe(true);
      expect(engineA.getState().currentBid).toBe(120);
      expect(engineA.getState().leadingTeamId).toBe(teamA1.team!.id);
      expect(engineA.getBidHistory().length).toBe(1);

      // Verify Tournament B bid history and credits are completely unaffected
      expect(engineB.getBidHistory().length).toBe(0);
      expect(engineB.getTeams()[0].remainingCredits).toBe(1000);

      // Conclude lot in A as SOLD
      const conclA = engineA.concludeNomination(true, 'org');
      expect(conclA.outcome).toBe('SOLD');
      expect(engineA.getState().soldCount).toBe(1);
      expect(engineA.getSoldPlayers().filter(p => !p.isCaptain).length).toBe(1);
      expect(engineA.getSoldPlayers().filter(p => !p.isCaptain)[0].username).toBe('PlayerA');

      // Verify B sold players is still 0
      expect(engineB.getState().soldCount).toBe(0);
      expect(engineB.getSoldPlayers().filter(p => !p.isCaptain).length).toBe(0);

      // Now start B independently
      engineB.startAuction('org');
      const nomB = engineB.nominatePlayer('p-b', 'org');
      expect(nomB.success).toBe(true);
      const bidB = engineB.placeBid({ teamId: teamB2.team!.id, captainUserId: 'cap-b2', bidAmount: 250 });
      expect(bidB.success).toBe(true);

      // Verify B state
      expect(engineB.getState().status).toBe('LIVE');
      expect(engineB.getState().nominee?.username).toBe('PlayerB');
      expect(engineB.getState().currentBid).toBe(250);
      expect(engineB.getState().leadingTeamId).toBe(teamB2.team!.id);

      // Verify A was NOT mutated by B
      expect(engineA.getState().soldCount).toBe(1);
      expect(engineA.getState().nominee).toBeNull();
      expect(engineA.getTeams().find(t => t.id === teamA1.team!.id)!.remainingCredits).toBe(880); // 1000 - 120
    });
  });
});
