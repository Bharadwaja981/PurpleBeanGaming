/**
 * Purple Bean Gaming — Dota 2 Phase 6 Test Suite
 * Valve Match ID Linking, OpenDota Statistics & Roster Reconciliation Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaMatchOperations, 
  DotaMatchRecord,
  OpenDotaReconciliationStatus
} from '../../src/domain/dotaMatchOperationsEngine';
import { dotaCompetitionEngine } from '../../src/domain/dotaCompetitionEngine';
import { dotaPlayerRegistry } from '../../src/domain/dotaPlayerEngine';
import { 
  trustedTournamentOps, 
  ServerCallerContext 
} from '../../src/server/trustedTournamentOperations';
import { 
  openDotaService, 
  OpenDotaMatchSnapshot 
} from '../../src/services/openDotaService';

describe('Phase 6: Dota 2 Match ID Linking & OpenDota Reconciliation', () => {
  const organiserCaller: ServerCallerContext = {
    userId: 'staff-admin-1',
    email: 'admin@purplebeangaming.com',
    role: 'organizer',
    isAdmin: true
  };

  const captainACaller: ServerCallerContext = {
    userId: 'tc-p-1', // Aether - captain of tc-team-1 (Mumbai Mavericks)
    email: 'aether@mumbai.com',
    role: 'captain',
    teamId: 'tc-team-1'
  };

  const captainBCaller: ServerCallerContext = {
    userId: 'tc-p-6', // Shadow - captain of tc-team-2 (Hyderabad Raiders)
    email: 'shadow@hyderabad.com',
    role: 'captain',
    teamId: 'tc-team-2'
  };

  const spectatorCaller: ServerCallerContext = {
    userId: 'spectator-99',
    email: 'fan@dota.com',
    role: 'spectator'
  };

  const matchId = 'purple-bean-test-cup-m-semi-1';

  beforeEach(() => {
    // Reset engines
    dotaMatchOperations.reset();
    openDotaService.clearCache();
    openDotaService.resetMockFailures();

    // Setup standard tournament match
    dotaCompetitionEngine.generateSeeds({
      tournamentId: 'purple-bean-test-cup',
      seedingMode: 'rating',
      staffActorId: 'staff-admin-1'
    });
    dotaCompetitionEngine.generateCompetitionStructure({
      tournamentId: 'purple-bean-test-cup',
      format: 'SINGLE_ELIMINATION',
      seriesFormat: 'BO3',
      staffActorId: 'staff-admin-1'
    });
    dotaMatchOperations.syncTournamentMatches('purple-bean-test-cup');
  });

  // -------------------------------------------------------------------------
  // 1. Valve Match ID Linking & Validation
  // -------------------------------------------------------------------------
  describe('1. Match ID Validation & Permissions', () => {
    it('accepts valid numeric Valve match IDs from authorized captains', async () => {
      const res = await trustedTournamentOps.executeLinkDotaMatchId(captainACaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981234567'
      });

      expect(res.success).toBe(true);
      expect(res.game).toBeDefined();
      expect(res.game?.dotaMatchId).toBe('7981234567');
      expect(res.game?.gameNumber).toBe(1);
    });

    it('accepts linking from the opponent team captain', async () => {
      const res = await trustedTournamentOps.executeLinkDotaMatchId(captainBCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981234568'
      });

      expect(res.success).toBe(true);
      expect(res.game?.dotaMatchId).toBe('7981234568');
    });

    it('accepts linking from tournament organizers / referees', async () => {
      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981234569'
      });

      expect(res.success).toBe(true);
      expect(res.game?.dotaMatchId).toBe('7981234569');
    });

    it('rejects linking from unauthorized spectators or third parties', async () => {
      await expect(
        trustedTournamentOps.executeLinkDotaMatchId(spectatorCaller, {
          matchId,
          gameNumber: 1,
          dotaMatchId: '7981234567'
        })
      ).rejects.toThrow(/unauthorized|denied/i);
    });

    it('rejects non-numeric or negative or malformed match IDs', async () => {
      await expect(
        trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
          matchId,
          gameNumber: 1,
          dotaMatchId: 'not-a-number'
        })
      ).rejects.toThrow(/invalid.*numeric/i);

      await expect(
        trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
          matchId,
          gameNumber: 1,
          dotaMatchId: '-7981234'
        })
      ).rejects.toThrow(/invalid.*numeric/i);
    });

    it('prevents linking the same Dota Match ID across two different canonical tournament matches', async () => {
      // First link to game 1 of match 1
      await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981239999'
      });

      // Attempt to link same Dota Match ID to game 2 of match 1 or another match
      await expect(
        trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
          matchId,
          gameNumber: 2,
          dotaMatchId: '7981239999'
        })
      ).rejects.toThrow(/already linked/i);
    });

    it('blocks client attempts to directly tamper with reconciliation status', async () => {
      await expect(
        trustedTournamentOps.executeLinkDotaMatchId(captainACaller, {
          matchId,
          gameNumber: 1,
          dotaMatchId: '7981234567',
          manualStatusAttempt: 'MATCHED'
        })
      ).rejects.toThrow(/DENIED.*reconciliation status/i);
    });
  });

  // -------------------------------------------------------------------------
  // 2. OpenDota Match Data Fetching & Caching
  // -------------------------------------------------------------------------
  describe('2. OpenDota Fetching, Structure & Caching', () => {
    it('returns rich snapshot containing players, draft, duration, and score', async () => {
      openDotaService.registerMockMatch('7980001111', {
        matchId: '7980001111',
        durationSeconds: 2200,
        radiantWin: true,
        radiantScore: 32,
        direScore: 24
      });

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7980001111'
      });

      expect(res.success).toBe(true);
      const snapshot = res.game?.openDotaSnapshot;
      expect(snapshot).toBeDefined();
      expect(snapshot?.matchId).toBe('7980001111');
      expect(snapshot?.durationSeconds).toBeGreaterThan(0);
      expect(snapshot?.radiantScore).toBeDefined();
      expect(snapshot?.direScore).toBeDefined();
      expect(snapshot?.players).toHaveLength(10);
      expect(snapshot?.picksBans).toBeDefined();
      expect(snapshot?.picksBans.length).toBeGreaterThan(0);
    });

    it('uses cached OpenDota data when refreshed within the cache window', async () => {
      await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7980002222'
      });

      const refreshRes = await trustedTournamentOps.executeRefreshOpenDotaMatchData(organiserCaller, {
        matchId,
        gameNumber: 1
      });

      expect(refreshRes.success).toBe(true);
      expect(refreshRes.cached).toBe(true);
    });

    it('gracefully handles provider downtime with PROVIDER_UNAVAILABLE status without crashing', async () => {
      openDotaService.simulateProviderFailure('UNAVAILABLE');

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7980003333'
      });

      expect(res.success).toBe(true);
      expect(res.reconciliationStatus).toBe('PROVIDER_UNAVAILABLE');
      expect(res.game?.openDotaSnapshot?.status).toBe('PROVIDER_UNAVAILABLE');
    });

    it('gracefully handles OpenDota rate limiting (HTTP 429)', async () => {
      openDotaService.simulateProviderFailure('RATE_LIMITED');

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7980004444'
      });

      expect(res.success).toBe(true);
      expect(res.reconciliationStatus).toBe('PROVIDER_UNAVAILABLE');
      expect(res.game?.openDotaSnapshot?.status).toBe('RATE_LIMITED');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Roster Reconciliation Logic & Statuses
  // -------------------------------------------------------------------------
  describe('3. Roster Reconciliation & Statuses', () => {
    it('sets status to MATCHED when all 10 players match expected rosters', async () => {
      // Build snapshot where Radiant has Team 1 accounts (100000001-5) and Dire has Team 2 (100000006-10)
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7981110001',
        durationSeconds: 2100,
        radiantWin: true,
        radiantScore: 35,
        direScore: 22,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3, 4, 5].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 5,
            deaths: 2,
            assists: 8,
            lastHits: 150,
            denies: 10,
            goldPerMin: 550,
            xpPerMin: 600,
            heroDamage: 18000,
            netWorth: 16000
          })),
          ...[6, 7, 8, 9, 10].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 2,
            deaths: 5,
            assists: 4,
            lastHits: 120,
            denies: 5,
            goldPerMin: 420,
            xpPerMin: 480,
            heroDamage: 12000,
            netWorth: 11000
          }))
        ]
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981110001',
        snapshotOverride: mockSnapshot
      });

      expect(res.reconciliationStatus).toBe('MATCHED');
      expect(res.reviewFlags).toHaveLength(0);
    });

    it('sets status to PARTIAL when some player profiles are anonymous/private', async () => {
      // 3 verified, 2 anonymous on radiant; 4 verified, 1 anonymous on dire
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7981110002',
        durationSeconds: 2400,
        radiantWin: false,
        radiantScore: 20,
        direScore: 32,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 3, deaths: 3, assists: 5, lastHits: 100, denies: 5, goldPerMin: 400, xpPerMin: 450, heroDamage: 10000, netWorth: 10000
          })),
          // 2 anonymous
          ...[4, 5].map((_, i) => ({
            accountId: null,
            playerSlot: 3 + i,
            isRadiant: true,
            heroId: 13 + i,
            heroName: `Hero ${13 + i}`,
            kills: 1, deaths: 4, assists: 3, lastHits: 80, denies: 2, goldPerMin: 320, xpPerMin: 380, heroDamage: 8000, netWorth: 7000
          })),
          ...[6, 7, 8, 9].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 6, deaths: 2, assists: 8, lastHits: 180, denies: 12, goldPerMin: 580, xpPerMin: 620, heroDamage: 22000, netWorth: 18000
          })),
          // 1 anonymous on Dire
          {
            accountId: null,
            playerSlot: 132,
            isRadiant: false,
            heroId: 24,
            heroName: 'Hero 24',
            kills: 2, deaths: 1, assists: 14, lastHits: 40, denies: 3, goldPerMin: 350, xpPerMin: 400, heroDamage: 9000, netWorth: 9000
          }
        ]
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981110002',
        snapshotOverride: mockSnapshot
      });

      expect(res.reconciliationStatus).toBe('PARTIAL');
      expect(res.reviewFlags).toHaveLength(0); // Anonymous players alone do not raise cheater/mismatch flags
    });

    it('sets status to PARTICIPANT_MISMATCH when an unregistered account is detected', async () => {
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7981110003',
        durationSeconds: 1800,
        radiantWin: true,
        radiantScore: 40,
        direScore: 15,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3, 4].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 5, deaths: 2, assists: 8, lastHits: 150, denies: 10, goldPerMin: 550, xpPerMin: 600, heroDamage: 18000, netWorth: 16000
          })),
          // Unknown ringer in Radiant slot 4!
          {
            accountId: '999888777',
            playerSlot: 4,
            isRadiant: true,
            heroId: 15,
            heroName: 'Hero 15',
            kills: 15, deaths: 0, assists: 10, lastHits: 300, denies: 25, goldPerMin: 850, xpPerMin: 900, heroDamage: 40000, netWorth: 28000
          },
          ...[6, 7, 8, 9, 10].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 2, deaths: 7, assists: 4, lastHits: 100, denies: 2, goldPerMin: 350, xpPerMin: 400, heroDamage: 11000, netWorth: 9500
          }))
        ]
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981110003',
        snapshotOverride: mockSnapshot
      });

      expect(res.reconciliationStatus).toBe('PARTICIPANT_MISMATCH');
      expect(res.reviewFlags).toBeDefined();
      expect(res.reviewFlags!.length).toBeGreaterThan(0);
      expect(res.reviewFlags!.some(f => f.type === 'UNREGISTERED_PARTICIPANT')).toBe(true);
    });

    it('flags OPPONENT_ROSTER_PLAYER when a player plays for the opposing team', async () => {
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7981110004',
        durationSeconds: 1950,
        radiantWin: true,
        radiantScore: 25,
        direScore: 20,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3, 4].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 4, deaths: 2, assists: 6, lastHits: 130, denies: 8, goldPerMin: 500, xpPerMin: 550, heroDamage: 14000, netWorth: 13000
          })),
          // Player 6 (from Team 2 / Dire!) playing on Radiant!
          {
            accountId: '100000006',
            playerSlot: 4,
            isRadiant: true,
            heroId: 15,
            heroName: 'Hero 15',
            kills: 4, deaths: 2, assists: 6, lastHits: 130, denies: 8, goldPerMin: 500, xpPerMin: 550, heroDamage: 14000, netWorth: 13000
          },
          ...[7, 8, 9, 10].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 2, deaths: 4, assists: 3, lastHits: 110, denies: 4, goldPerMin: 390, xpPerMin: 420, heroDamage: 10000, netWorth: 9800
          })),
          // Fill 5th Dire slot with anonymous
          {
            accountId: null,
            playerSlot: 132,
            isRadiant: false,
            heroId: 25,
            heroName: 'Hero 25',
            kills: 1, deaths: 5, assists: 2, lastHits: 70, denies: 1, goldPerMin: 280, xpPerMin: 320, heroDamage: 6000, netWorth: 6000
          }
        ]
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981110004',
        snapshotOverride: mockSnapshot
      });

      expect(res.reconciliationStatus).toBe('PARTICIPANT_MISMATCH');
      expect(res.reviewFlags!.some(f => f.type === 'OPPONENT_ROSTER_PLAYER')).toBe(true);
    });

    it('sets UNKNOWN_PARTICIPANTS when all 10 participants are anonymous', async () => {
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7981110005',
        durationSeconds: 1500,
        radiantWin: true,
        radiantScore: 10,
        direScore: 5,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: Array.from({ length: 10 }, (_, i) => ({
          accountId: null,
          playerSlot: i < 5 ? i : 128 + (i - 5),
          isRadiant: i < 5,
          heroId: 1 + i,
          heroName: `Hero ${1 + i}`,
          kills: 1, deaths: 1, assists: 1, lastHits: 50, denies: 2, goldPerMin: 300, xpPerMin: 350, heroDamage: 5000, netWorth: 5000
        }))
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7981110005',
        snapshotOverride: mockSnapshot
      });

      expect(res.reconciliationStatus).toBe('UNKNOWN_PARTICIPANTS');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Non-Destructive Supporting Evidence & Result Conflict Handling
  // -------------------------------------------------------------------------
  describe('4. Result Conflict Safety (Supporting Evidence Only)', () => {
    it('flags RESULT_CONFLICT without silently overwriting the canonical series score', async () => {
      // 1. Report canonical result where Team 1 won 2 - 0
      dotaMatchOperations.submitResult(matchId, 'tc-team-1', 2, 0, captainACaller.userId, 'captain');
      dotaMatchOperations.confirmResult(matchId, 'tc-team-2', captainBCaller.userId, 'captain');

      const canonicalMatch = dotaMatchOperations.getMatch(matchId);
      expect(canonicalMatch?.status).toBe('FINALIZED');
      expect(canonicalMatch?.seriesScoreA).toBe(2);
      expect(canonicalMatch?.seriesScoreB).toBe(0);
      expect(canonicalMatch?.winnerTeamId).toBe('tc-team-1');

      // 2. Now link an OpenDota match where Team 2 won (Dire win when Team 2 is Dire)
      const conflictSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7982220001',
        durationSeconds: 2200,
        radiantWin: false, // Team 2 won!
        radiantScore: 15,
        direScore: 35,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3, 4, 5].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 2, deaths: 7, assists: 3, lastHits: 120, denies: 4, goldPerMin: 380, xpPerMin: 410, heroDamage: 11000, netWorth: 10500
          })),
          ...[6, 7, 8, 9, 10].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 6, deaths: 2, assists: 8, lastHits: 190, denies: 15, goldPerMin: 600, xpPerMin: 640, heroDamage: 24000, netWorth: 19000
          }))
        ]
      };

      const linkRes = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7982220001',
        snapshotOverride: conflictSnapshot
      });

      expect(linkRes.reconciliationStatus).toBe('RESULT_CONFLICT');
      expect(linkRes.reviewFlags!.some(f => f.type === 'RESULT_CONFLICT')).toBe(true);

      // Verify canonical match scores were NOT modified or corrupted
      const updatedMatch = dotaMatchOperations.getMatch(matchId);
      expect(updatedMatch?.seriesScoreA).toBe(2);
      expect(updatedMatch?.seriesScoreB).toBe(0);
      expect(updatedMatch?.winnerTeamId).toBe('tc-team-1');
      expect(updatedMatch?.status).toBe('FINALIZED');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Review Flag Lifecycle (Acknowledge, Resolve, Dismiss)
  // -------------------------------------------------------------------------
  describe('5. Review Flag Workflow', () => {
    it('allows organizers to acknowledge, resolve, or dismiss flags', async () => {
      const mockSnapshot: OpenDotaMatchSnapshot = {
        matchId: '7983330001',
        durationSeconds: 1800,
        radiantWin: true,
        radiantScore: 30,
        direScore: 10,
        status: 'FETCHED',
        fetchedAt: new Date().toISOString(),
        picksBans: [],
        players: [
          ...[1, 2, 3, 4].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: i,
            isRadiant: true,
            heroId: 10 + i,
            heroName: `Hero ${10 + i}`,
            kills: 5, deaths: 2, assists: 8, lastHits: 150, denies: 10, goldPerMin: 550, xpPerMin: 600, heroDamage: 18000, netWorth: 16000
          })),
          {
            accountId: '888777666',
            playerSlot: 4,
            isRadiant: true,
            heroId: 15,
            heroName: 'Hero 15',
            kills: 10, deaths: 0, assists: 5, lastHits: 200, denies: 12, goldPerMin: 650, xpPerMin: 700, heroDamage: 25000, netWorth: 20000
          },
          ...[6, 7, 8, 9, 10].map((num, i) => ({
            accountId: (100000000 + num).toString(),
            playerSlot: 128 + i,
            isRadiant: false,
            heroId: 20 + i,
            heroName: `Hero ${20 + i}`,
            kills: 2, deaths: 5, assists: 3, lastHits: 100, denies: 3, goldPerMin: 350, xpPerMin: 400, heroDamage: 10000, netWorth: 9500
          }))
        ]
      };

      const linkRes = await trustedTournamentOps.executeLinkDotaMatchId(organiserCaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7983330001',
        snapshotOverride: mockSnapshot
      });

      expect(linkRes.reviewFlags).toBeDefined();
      const flagId = linkRes.reviewFlags![0].id;

      // 1. Organiser acknowledges flag
      const ackRes = trustedTournamentOps.executeReviewMismatchFlag(organiserCaller, {
        matchId,
        gameNumber: 1,
        flagId,
        action: 'ACKNOWLEDGE',
        notes: 'Confirmed substitute player was registered offline with referee.'
      });
      expect(ackRes.success).toBe(true);

      const gameAfterAck = dotaMatchOperations.getMatch(matchId)?.games?.find(g => g.gameNumber === 1);
      const flagAfterAck = gameAfterAck?.reviewFlags?.find(f => f.id === flagId);
      expect(flagAfterAck?.status).toBe('ACKNOWLEDGED');

      // 2. Organiser resolves flag
      const resolveRes = trustedTournamentOps.executeReviewMismatchFlag(organiserCaller, {
        matchId,
        gameNumber: 1,
        flagId,
        action: 'RESOLVE',
        notes: 'Approved by head referee.'
      });
      expect(resolveRes.success).toBe(true);

      const gameAfterResolve = dotaMatchOperations.getMatch(matchId)?.games?.find(g => g.gameNumber === 1);
      const flagAfterResolve = gameAfterResolve?.reviewFlags?.find(f => f.id === flagId);
      expect(flagAfterResolve?.status).toBe('RESOLVED');
    });

    it('rejects flag review attempts from non-organizers', () => {
      expect(() => {
        trustedTournamentOps.executeReviewMismatchFlag(captainACaller, {
          matchId,
          gameNumber: 1,
          flagId: 'flag-1',
          action: 'RESOLVE'
        });
      }).toThrow(/organizer/i);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Multi-Game BO3 Series Independence
  // -------------------------------------------------------------------------
  describe('6. Multi-Game BO3 Series Independence', () => {
    it('manages distinct OpenDota links and stats for Game 1 and Game 2', async () => {
      // Link Game 1
      await trustedTournamentOps.executeLinkDotaMatchId(captainACaller, {
        matchId,
        gameNumber: 1,
        dotaMatchId: '7984440001'
      });

      // Link Game 2 with different Valve match ID
      await trustedTournamentOps.executeLinkDotaMatchId(captainBCaller, {
        matchId,
        gameNumber: 2,
        dotaMatchId: '7984440002'
      });

      const match = dotaMatchOperations.getMatch(matchId);
      expect(match?.games).toBeDefined();
      expect(match?.games?.length).toBe(2);

      const g1 = match?.games?.find(g => g.gameNumber === 1);
      const g2 = match?.games?.find(g => g.gameNumber === 2);

      expect(g1?.dotaMatchId).toBe('7984440001');
      expect(g2?.dotaMatchId).toBe('7984440002');
      expect(g1?.openDotaSnapshot?.matchId).toBe('7984440001');
      expect(g2?.openDotaSnapshot?.matchId).toBe('7984440002');
    });
  });
});
