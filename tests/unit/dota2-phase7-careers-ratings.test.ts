import { describe, it, expect, beforeEach } from 'vitest';
import {
  dotaCareerHistoryEngine,
  DotaCareerHistoryEngine,
  CanonicalMatchRatingPayload
} from '../../src/domain/dotaCareerHistoryEngine';
import {
  trustedTournamentOps,
  ServerCallerContext
} from '../../src/server/trustedTournamentOperations';
import { testCupEngine } from '../../src/domain/testCupEngine';
import { dotaPlayerEngine } from '../../src/domain/dotaPlayerEngine';

describe('Phase 7: Careers, Ratings, Rankings & Seasons Engine', () => {
  let engine: DotaCareerHistoryEngine;
  const organizerCaller: ServerCallerContext = {
    userId: 'staff-admin-1',
    email: 'admin@purplebeangaming.com',
    role: 'organizer',
    isAdmin: true
  };
  const spectatorCaller: ServerCallerContext = {
    userId: 'spectator-99',
    email: 'fan@purplebeangaming.com',
    role: 'spectator'
  };

  beforeEach(() => {
    engine = new DotaCareerHistoryEngine();
  });

  // -------------------------------------------------------------
  // 1. Player Career
  // -------------------------------------------------------------
  describe('1. Player Career', () => {
    it('maintains persistent player career snapshots across tournaments', () => {
      const p = dotaPlayerEngine.getPlayer('p-c1')!;
      expect(p).toBeDefined();
      const career = engine.ensurePlayerCareer(p);

      expect(career.playerId).toBe('p-c1');
      expect(career.ign).toBe(p.username);
      expect(career.tournamentPlacements).toBeDefined();
      expect(career.tournamentPlacements.length).toBeGreaterThan(0);

      const snap = career.tournamentPlacements[0];
      expect(snap.tournamentId).toBe('purple-bean-test-cup');
      expect(snap.role).toBe(p.primaryRole);
      expect(snap.tournamentMmr).toBe(p.tournamentMmr);
      expect(snap.finalPlacement).toBeDefined();
    });

    it('guarantees historical snapshots do not change when current profile or team changes', () => {
      const p = dotaPlayerEngine.getPlayer('p-c1')!;
      const career = engine.ensurePlayerCareer(p);
      const originalTeamName = career.tournamentPlacements[0].teamName;

      // Simulate player later transferring to a different team
      p.currentTeamName = 'New Delhi Superstars';
      p.currentTeamId = 'team-del-super';

      // Historical snapshot must remain unchanged
      expect(career.tournamentPlacements[0].teamName).toBe(originalTeamName);
    });
  });

  // -------------------------------------------------------------
  // 2. Captain Career
  // -------------------------------------------------------------
  describe('2. Captain Career', () => {
    it('tracks tournaments, teams led, finals, championships, and auction metrics separately', () => {
      const cap = engine.getCaptainCareer('p-c1');
      expect(cap).toBeDefined();
      expect(cap?.tournamentsCaptained).toBeGreaterThan(0);
      expect(cap?.teamsLed).toBeDefined();
      expect(cap?.championships).toBeGreaterThanOrEqual(1);
      expect(cap?.finals).toBeGreaterThanOrEqual(1);
      expect(cap?.auctionCreditsSpent).toBeGreaterThanOrEqual(0);
      expect(cap?.auctionPlayersDrafted).toBeGreaterThanOrEqual(0);
    });

    it('does not create captain career records for non-captains', () => {
      // player p-01 is a recruit, not a captain
      const nonCap = engine.getCaptainCareer('p-01');
      expect(nonCap).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // 3. Team History
  // -------------------------------------------------------------
  describe('3. Team History', () => {
    it('persists tournament roster snapshots, captain, placement, and result history', () => {
      const completionRes = engine.finalizeTournamentCompletion(
        'tournament-sample-1',
        {
          tournamentName: 'Sample Dota Cup',
          placements: [
            {
              placement: 'Champion (1st Place)',
              teamId: 'team-mum',
              teamName: 'Mumbai Mavericks',
              prizeWonINR: 20000,
              isChampion: true,
              captainId: 'tc-player-1',
              captainIgn: 'Aether',
              roster: [
                { playerId: 'tc-player-1', ign: 'Aether', role: 'Midlaner', tournamentMmr: 6850, isCaptain: true },
                { playerId: 'tc-player-4', ign: 'Viper', role: 'Carry', tournamentMmr: 6200, isCaptain: false }
              ],
              matchesPlayed: 4,
              wins: 4,
              losses: 0
            }
          ]
        },
        organizerCaller
      );

      expect(completionRes.success).toBe(true);

      const teamCareer = engine.getTeamCareer('team-mum');
      expect(teamCareer).toBeDefined();
      expect(teamCareer?.tournamentHistory).toHaveLength(1);

      const history = teamCareer?.tournamentHistory[0];
      expect(history?.tournamentName).toBe('Sample Dota Cup');
      expect(history?.placement).toBe('Champion (1st Place)');
      expect(history?.rosterSnapshot).toHaveLength(2);
      expect(history?.isChampion).toBe(true);

      // Mutate external roster array to verify deep cloning
      history?.rosterSnapshot.push({ playerId: 'fake', ign: 'fake', role: 'Support', isCaptain: false });
      expect(teamCareer?.tournamentHistory[0].rosterSnapshot.length).toBe(3);
    });
  });

  // -------------------------------------------------------------
  // 4. Dota Competitive Rating & Idempotency
  // -------------------------------------------------------------
  describe('4. Dota Competitive Rating & Idempotency', () => {
    const sampleMatch: CanonicalMatchRatingPayload = {
      matchId: 'canon-match-101',
      tournamentId: 'purple-bean-test-cup',
      seasonId: 'season-2026-s1',
      winnerTeamId: 'tc-team-1',
      loserTeamId: 'tc-team-2',
      winnerScore: 2,
      loserScore: 1,
      winnerRosterPlayerIds: ['tc-player-1', 'tc-player-4'],
      loserRosterPlayerIds: ['tc-player-2', 'tc-player-3'],
      appliedAt: '2026-10-15T18:00:00Z'
    };

    it('creates exactly one rating event per player per qualifying match', () => {
      const res = engine.processMatchRating(sampleMatch, organizerCaller);
      expect(res.success).toBe(true);
      expect(res.alreadyProcessed).toBe(false);
      expect(res.events).toHaveLength(4); // 2 winners + 2 losers

      const winnerEvent = res.events.find(e => e.playerId === 'tc-player-1');
      expect(winnerEvent).toBeDefined();
      expect(winnerEvent?.isWin).toBe(true);
      expect(winnerEvent?.ratingDelta).toBeGreaterThan(0);
      expect(winnerEvent?.ratingAfter).toBe(winnerEvent!.ratingBefore + winnerEvent!.ratingDelta);
      expect(winnerEvent?.uncertainty).toBeDefined();
      expect(winnerEvent?.confidence).toBeDefined();
      expect(winnerEvent?.timestamp).toBe('2026-10-15T18:00:00Z');
    });

    it('guarantees idempotency: same match processed twice causes NO second rating change', () => {
      // First application
      const first = engine.processMatchRating(sampleMatch, organizerCaller);
      expect(first.success).toBe(true);
      expect(first.alreadyProcessed).toBe(false);

      const p1Before = engine.getPlayerCareer('tc-player-1')?.competitiveRating;

      // Second application (duplicate)
      const second = engine.processMatchRating(sampleMatch, organizerCaller);
      expect(second.success).toBe(true);
      expect(second.alreadyProcessed).toBe(true);
      expect(second.events).toHaveLength(first.events.length);

      const p1After = engine.getPlayerCareer('tc-player-1')?.competitiveRating;
      expect(p1After).toBe(p1Before); // Rating did not change
    });
  });

  // -------------------------------------------------------------
  // 5. Rating Safety Rules
  // -------------------------------------------------------------
  describe('5. Rating Safety Rules', () => {
    it('denies rating cancelled matches', () => {
      const res = engine.processMatchRating({
        matchId: 'cancelled-match-1',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-2',
        winnerScore: 0,
        loserScore: 0,
        winnerRosterPlayerIds: ['tc-player-1'],
        loserRosterPlayerIds: ['tc-player-2'],
        isCancelled: true
      }, organizerCaller);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cancelled/i);
    });

    it('denies rating superseded matches', () => {
      const res = engine.processMatchRating({
        matchId: 'superseded-match-1',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-2',
        winnerScore: 2,
        loserScore: 0,
        winnerRosterPlayerIds: ['tc-player-1'],
        loserRosterPlayerIds: ['tc-player-2'],
        isSuperseded: true
      }, organizerCaller);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/superseded/i);
    });

    it('denies rating forfeits per league policy', () => {
      const res = engine.processMatchRating({
        matchId: 'forfeit-match-1',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-2',
        winnerScore: 1,
        loserScore: 0,
        winnerRosterPlayerIds: ['tc-player-1'],
        loserRosterPlayerIds: ['tc-player-2'],
        isForfeit: true
      }, organizerCaller);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/forfeit/i);
    });
  });

  // -------------------------------------------------------------
  // 6. Deterministic Rating Rebuilder
  // -------------------------------------------------------------
  describe('6. Deterministic Rating Rebuilder', () => {
    it('rebuilds identical ratings, uncertainties, and statuses given identical match history', () => {
      const history: CanonicalMatchRatingPayload[] = [
        {
          matchId: 'm1',
          tournamentId: 't1',
          winnerTeamId: 'teamA',
          loserTeamId: 'teamB',
          winnerScore: 2,
          loserScore: 0,
          winnerRosterPlayerIds: ['p1', 'p2'],
          loserRosterPlayerIds: ['p3', 'p4'],
          appliedAt: '2026-10-01T10:00:00Z'
        },
        {
          matchId: 'm2',
          tournamentId: 't1',
          winnerTeamId: 'teamA',
          loserTeamId: 'teamC',
          winnerScore: 2,
          loserScore: 1,
          winnerRosterPlayerIds: ['p1', 'p2'],
          loserRosterPlayerIds: ['p5', 'p6'],
          appliedAt: '2026-10-02T10:00:00Z'
        },
        {
          matchId: 'm3',
          tournamentId: 't1',
          winnerTeamId: 'teamC',
          loserTeamId: 'teamB',
          winnerScore: 2,
          loserScore: 0,
          winnerRosterPlayerIds: ['p5', 'p6'],
          loserRosterPlayerIds: ['p3', 'p4'],
          appliedAt: '2026-10-03T10:00:00Z'
        }
      ];

      const initialPlayerRatings = { p1: 1500, p2: 1500, p3: 1500, p4: 1500, p5: 1500, p6: 1500 };
      const initialTeamRatings = { teamA: 1500, teamB: 1500, teamC: 1500 };

      const run1 = engine.rebuildRatings(history, initialPlayerRatings, initialTeamRatings);
      const run2 = engine.rebuildRatings(history, initialPlayerRatings, initialTeamRatings);

      // Exact deterministic equality
      expect(run1.playerRatings).toEqual(run2.playerRatings);
      expect(run1.teamRatings).toEqual(run2.teamRatings);
      expect(run1.qualifyingCounts).toEqual(run2.qualifyingCounts);
      expect(run1.playerStatus).toEqual(run2.playerStatus);
      expect(run1.events.length).toBe(run2.events.length);
      expect(run1.totalMatchesProcessed).toBe(3);
    });
  });

  // -------------------------------------------------------------
  // 7. Provisional vs Established Threshold
  // -------------------------------------------------------------
  describe('7. Provisional vs Established Threshold', () => {
    it('sets status to PROVISIONAL when qualifying matches < 5 and ESTABLISHED when >= 5', () => {
      const p = engine.ensurePlayerCareer(dotaPlayerEngine.getPlayer('p-c1')!);
      p.qualifyingMatchesCount = 4;
      p.ratingStatus = p.qualifyingMatchesCount >= 5 ? 'ESTABLISHED' : 'PROVISIONAL';
      expect(p.ratingStatus).toBe('PROVISIONAL');

      p.qualifyingMatchesCount = 5;
      p.ratingStatus = p.qualifyingMatchesCount >= 5 ? 'ESTABLISHED' : 'PROVISIONAL';
      expect(p.ratingStatus).toBe('ESTABLISHED');
    });
  });

  // -------------------------------------------------------------
  // 8. Player Rankings
  // -------------------------------------------------------------
  describe('8. Player Rankings', () => {
    it('ranks players by Purple Bean competitive rating (not Valve MMR) and supports filters', () => {
      const allRankings = engine.getPlayerRankings();
      expect(allRankings.length).toBeGreaterThan(0);
      expect(allRankings[0].rank).toBe(1);
      expect(allRankings[0].competitiveRating).toBeGreaterThanOrEqual(allRankings[1].competitiveRating);

      // Verify columns
      const first = allRankings[0];
      expect(first.ign).toBeDefined();
      expect(first.primaryRole).toBeDefined();
      expect(first.competitiveRating).toBeDefined();
      expect(first.ratingStatus).toBeDefined();
      expect(first.matchRecord).toMatch(/\d+W - \d+L/);
      expect(first.recentForm).toBeInstanceOf(Array);

      // Test establishedOnly filter
      const established = engine.getPlayerRankings({ establishedOnly: true });
      expect(established.every(p => p.ratingStatus === 'ESTABLISHED')).toBe(true);

      // Test region filter
      const west = engine.getPlayerRankings({ region: 'West' });
      expect(west.every(p => p.region.toLowerCase().includes('west'))).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 9. Team Rankings
  // -------------------------------------------------------------
  describe('9. Team Rankings', () => {
    it('generates team standings sorted by rating and tournament wins', () => {
      const teams = engine.getTeamRankings();
      expect(teams.length).toBeGreaterThan(0);
      expect(teams[0].rank).toBe(1);
      expect(teams[0].rating).toBeGreaterThanOrEqual(teams[teams.length - 1].rating);

      const t = teams[0];
      expect(t.teamName).toBeDefined();
      expect(t.rating).toBeDefined();
      expect(t.matches).toBeDefined();
      expect(t.wins).toBeDefined();
      expect(t.losses).toBeDefined();
      expect(t.tournamentWins).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 10. Seasons
  // -------------------------------------------------------------
  describe('10. Seasons', () => {
    it('supports seasonal circuit with tournaments, champions, and scoped stats', () => {
      const s = engine.getSeason('season-2026-s1');
      expect(s).toBeDefined();
      expect(s?.code).toBe('2026-S1');
      expect(s?.tournaments).toContain('purple-bean-test-cup');
      expect(s?.notableResults).toBeInstanceOf(Array);
    });
  });

  // -------------------------------------------------------------
  // 11. Tournament Completion
  // -------------------------------------------------------------
  describe('11. Tournament Completion', () => {
    it('server-authoritatively finalizes tournament completion and is idempotent', () => {
      const payload = {
        tournamentName: 'Test Cup Finalization',
        placements: [
          {
            placement: 'Champion (1st Place)',
            teamId: 'tc-team-1',
            teamName: 'Mumbai Mavericks',
            prizeWonINR: 15000,
            isChampion: true,
            captainId: 'tc-player-1',
            captainIgn: 'Aether',
            roster: [
              { playerId: 'tc-player-1', ign: 'Aether', role: 'Midlaner' as any, tournamentMmr: 6850, isCaptain: true },
              { playerId: 'tc-player-4', ign: 'Viper', role: 'Carry' as any, tournamentMmr: 6200, isCaptain: false }
            ],
            matchesPlayed: 2,
            wins: 2,
            losses: 0
          },
          {
            placement: 'Runner-up (2nd Place)',
            teamId: 'tc-team-3',
            teamName: 'Bengaluru Titans',
            prizeWonINR: 7000,
            captainId: 'tc-player-3',
            captainIgn: 'Thunder',
            roster: [
              { playerId: 'tc-player-3', ign: 'Thunder', role: 'Offlaner' as any, tournamentMmr: 6300, isCaptain: true }
            ],
            matchesPlayed: 1,
            wins: 0,
            losses: 1
          }
        ]
      };

      // First run
      const first = engine.finalizeTournamentCompletion('comp-tourney-1', payload, organizerCaller);
      expect(first.success).toBe(true);
      expect(first.alreadyCompleted).toBe(false);
      expect(first.championTeamName).toBe('Mumbai Mavericks');

      // Verify captain championships incremented
      const capAether = engine.getCaptainCareer('tc-player-1');
      const champsBefore = capAether?.championships;

      // Second run (duplicate)
      const second = engine.finalizeTournamentCompletion('comp-tourney-1', payload, organizerCaller);
      expect(second.success).toBe(true);
      expect(second.alreadyCompleted).toBe(true);

      // Verify no duplication occurred
      expect(capAether?.championships).toBe(champsBefore);
    });
  });

  // -------------------------------------------------------------
  // 12. Profiles History
  // -------------------------------------------------------------
  describe('12. Profiles History', () => {
    it('populates persistent career history on player and team profiles', () => {
      const pCareer = engine.getPlayerCareer('p-c1');
      expect(pCareer).toBeDefined();
      expect(pCareer?.tournamentPlacements.length).toBeGreaterThan(0);

      const tCareer = engine.getTeamCareer('tc-team-1');
      expect(tCareer).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 13. Result Correction Rebuild
  // -------------------------------------------------------------
  describe('13. Result Correction Rebuild', () => {
    it('executes audited result correction and rebuilds affected ratings cleanly', () => {
      // 1. Process initial match: Team 1 beats Team 2
      const match1: CanonicalMatchRatingPayload = {
        matchId: 'match-to-correct',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-2',
        winnerScore: 2,
        loserScore: 1,
        winnerRosterPlayerIds: ['tc-player-1'],
        loserRosterPlayerIds: ['tc-player-2']
      };
      engine.processMatchRating(match1, organizerCaller);

      // 2. Perform result correction: Referee overturns: Team 2 actually won!
      const correctionRes = engine.correctMatchResultAndRebuild(
        'match-to-correct',
        'tc-team-2',
        'tc-team-1',
        2,
        1,
        ['tc-player-2'],
        ['tc-player-1'],
        organizerCaller
      );

      expect(correctionRes.success).toBe(true);
      expect(correctionRes.totalMatchesProcessed).toBe(1);

      // tc-player-2 should now have the win event and rating increase
      const p2Career = engine.getPlayerCareer('tc-player-2');
      const latestP2Event = p2Career?.ratingHistory[p2Career.ratingHistory.length - 1];
      expect(latestP2Event?.isWin).toBe(true);
      expect(latestP2Event?.ratingDelta).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------
  // 14. Purple Bean Test Cup End-to-End
  // -------------------------------------------------------------
  describe('14. Purple Bean Test Cup End-to-End', () => {
    it('executes full Test Cup lifecycle: Semifinal 2-1 -> Grand Final 2-0 -> Tournament Completed', () => {
      // 1. Semifinal: Mumbai Mavericks beats Hyderabad Raiders 2-1
      const semiResult = engine.processMatchRating({
        matchId: 'tc-semi-1',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-2',
        winnerScore: 2,
        loserScore: 1,
        winnerRosterPlayerIds: ['tc-player-1', 'tc-player-4'],
        loserRosterPlayerIds: ['tc-player-2']
      }, organizerCaller);
      expect(semiResult.success).toBe(true);

      // 2. Grand Final: Mumbai Mavericks beats Bengaluru Titans 2-0
      const finalResult = engine.processMatchRating({
        matchId: 'tc-final-1',
        tournamentId: 'purple-bean-test-cup',
        winnerTeamId: 'tc-team-1',
        loserTeamId: 'tc-team-3',
        winnerScore: 2,
        loserScore: 0,
        winnerRosterPlayerIds: ['tc-player-1', 'tc-player-4'],
        loserRosterPlayerIds: ['tc-player-3']
      }, organizerCaller);
      expect(finalResult.success).toBe(true);

      // 3. Complete Tournament
      const completion = engine.finalizeTournamentCompletion(
        'purple-bean-test-cup-2026',
        {
          tournamentName: 'Purple Bean Test Cup',
          seasonId: 'season-2026-s1',
          placements: [
            {
              placement: 'Champion (1st Place)',
              teamId: 'tc-team-1',
              teamName: 'Mumbai Mavericks',
              prizeWonINR: 15000,
              isChampion: true,
              captainId: 'tc-player-1',
              captainIgn: 'Aether',
              roster: [
                { playerId: 'tc-player-1', ign: 'Aether', role: 'Midlaner' as any, tournamentMmr: 6850, isCaptain: true },
                { playerId: 'tc-player-4', ign: 'Viper', role: 'Carry' as any, tournamentMmr: 6200, isCaptain: false }
              ],
              matchesPlayed: 2,
              wins: 2,
              losses: 0,
              auctionCreditsSpent: 480,
              auctionPlayersDrafted: 4
            },
            {
              placement: 'Runner-up (2nd Place)',
              teamId: 'tc-team-3',
              teamName: 'Bengaluru Titans',
              prizeWonINR: 7000,
              captainId: 'tc-player-3',
              captainIgn: 'Thunder',
              roster: [
                { playerId: 'tc-player-3', ign: 'Thunder', role: 'Offlaner' as any, tournamentMmr: 6300, isCaptain: true }
              ],
              matchesPlayed: 1,
              wins: 0,
              losses: 1,
              auctionCreditsSpent: 450,
              auctionPlayersDrafted: 4
            },
            {
              placement: '3rd Place',
              teamId: 'tc-team-2',
              teamName: 'Hyderabad Raiders',
              prizeWonINR: 3000,
              captainId: 'tc-player-2',
              captainIgn: 'Shadow',
              roster: [
                { playerId: 'tc-player-2', ign: 'Shadow', role: 'Carry' as any, tournamentMmr: 6600, isCaptain: true }
              ],
              matchesPlayed: 1,
              wins: 0,
              losses: 1,
              auctionCreditsSpent: 460,
              auctionPlayersDrafted: 4
            }
          ]
        },
        organizerCaller
      );

      expect(completion.success).toBe(true);
      expect(completion.championTeamName).toBe('Mumbai Mavericks');

      // Verify season champion added
      const season = engine.getSeason('season-2026-s1');
      expect(season?.champions.some(c => c.teamName === 'Mumbai Mavericks')).toBe(true);

      // Verify repeated completion does not duplicate
      const repeat = engine.finalizeTournamentCompletion(
        'purple-bean-test-cup-2026',
        {} as any,
        organizerCaller
      );
      expect(repeat.alreadyCompleted).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 15. Negative Security & Boundary Tests
  // -------------------------------------------------------------
  describe('15. Negative Security & Boundary Tests', () => {
    it('blocks spectators or unauthorized third parties from processing ratings', async () => {
      await expect(
        trustedTournamentOps.executeProcessMatchRating(spectatorCaller, {
          matchId: 'unauth-match-1',
          tournamentId: 't1',
          winnerTeamId: 'tc-team-1',
          loserTeamId: 'tc-team-2',
          winnerScore: 2,
          loserScore: 0,
          winnerRosterPlayerIds: ['tc-player-1'],
          loserRosterPlayerIds: ['tc-player-2']
        })
      ).rejects.toThrow(/DENIED|unauthorized/i);
    });

    it('blocks non-organizers from finalizing tournament completion', async () => {
      await expect(
        trustedTournamentOps.executeFinalizeTournamentCompletion(
          spectatorCaller,
          'unauth-tourney-1',
          {} as any
        )
      ).rejects.toThrow(/DENIED|unauthorized/i);
    });

    it('blocks non-organizers from executing audited result corrections', async () => {
      await expect(
        trustedTournamentOps.executeResultCorrectionRebuild(spectatorCaller, {
          matchId: 'm1',
          correctedWinnerTeamId: 'tc-team-1',
          correctedLoserTeamId: 'tc-team-2',
          correctedWinnerScore: 2,
          correctedLoserScore: 0,
          winnerRosterPlayerIds: ['tc-player-1'],
          loserRosterPlayerIds: ['tc-player-2']
        })
      ).rejects.toThrow(/DENIED|unauthorized/i);
    });
  });
});
