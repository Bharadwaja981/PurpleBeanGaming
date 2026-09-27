/**
 * Purple Bean Gaming — Dota 2 Phase 4 Unit & Integration Tests
 * Competition Structure + Seeding + Single/Double Elimination Brackets + Round Robin + Groups
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaCompetitionEngine, 
  DotaCompetitionEngine,
  CompetitionStructureState,
  SeededTeam,
  CompetitionMatchNode,
  SeriesFormat
} from '../../src/domain/dotaCompetitionEngine';
import { 
  dotaPremadeTeamEngine, 
  PremadeTeamRegistration 
} from '../../src/domain/dotaPremadeTeamEngine';
import { dotaPlayerRegistry, DotaRolePosition } from '../../src/domain/dotaPlayerEngine';
import { testCupEngine } from '../../src/domain/testCupEngine';
import { tournamentService } from '../../src/services/firebaseService';
import { trustedTournamentOps, ServerCallerContext } from '../../src/server/trustedTournamentOperations';
import { DotaTiebreakEngine, TiebreakTeamStats, HeadToHeadRecord } from '../../src/domain/dotaTiebreakEngine';

describe('Phase 4: Dota 2 Competition Structure, Seeding & Brackets', () => {
  let engine: DotaCompetitionEngine;

  const ORGANIZER_CALLER: ServerCallerContext = {
    userId: 'u-org-championship-admin',
    email: 'organizer@purplebean.in',
    role: 'organizer',
    isAdmin: true
  };

  const CLIENT_PLAYER_CALLER: ServerCallerContext = {
    userId: 'u-player-rogue',
    email: 'player@pbg.in',
    role: 'player'
  };

  // Helper to create verified finalized premade teams for testing
  function createFinalizedTeam(params: {
    tournamentId: string;
    teamId: string;
    teamName: string;
    tag: string;
    avgMmr: number;
    status?: 'APPROVED' | 'LOCKED' | 'DRAFT' | 'SUBMITTED';
  }): PremadeTeamRegistration {
    const { tournamentId, teamId, teamName, tag, avgMmr, status = 'APPROVED' } = params;
    return {
      id: `reg-${teamId}`,
      tournamentId,
      tournamentName: 'Test Championship',
      teamId,
      teamName,
      tag,
      logo: '🛡️',
      color: '#FFE600',
      captainId: `p-${teamId}-cap`,
      captainIgn: `${tag}_Captain`,
      status,
      primaryRoster: [
        {
          userId: `p-${teamId}-1`,
          ign: `${tag}_Carry`,
          avatar: '🎮',
          tournamentMmr: avgMmr + 200,
          declaredMmr: avgMmr + 200,
          primaryRole: 'Position 1 — Hard Carry',
          pbRating: 1800,
          isCaptain: false,
          isStandIn: false,
          consentStatus: 'ACCEPTED',
          invitedAt: new Date().toISOString()
        },
        {
          userId: `p-${teamId}-cap`,
          ign: `${tag}_Captain`,
          avatar: '👑',
          tournamentMmr: avgMmr + 100,
          declaredMmr: avgMmr + 100,
          primaryRole: 'Position 2 — Midlane',
          pbRating: 1850,
          isCaptain: true,
          isStandIn: false,
          consentStatus: 'ACCEPTED',
          invitedAt: new Date().toISOString()
        },
        {
          userId: `p-${teamId}-3`,
          ign: `${tag}_Off`,
          avatar: '🛡️',
          tournamentMmr: avgMmr,
          declaredMmr: avgMmr,
          primaryRole: 'Position 3 — Offlane',
          pbRating: 1750,
          isCaptain: false,
          isStandIn: false,
          consentStatus: 'ACCEPTED',
          invitedAt: new Date().toISOString()
        },
        {
          userId: `p-${teamId}-4`,
          ign: `${tag}_Soft`,
          avatar: '⚡',
          tournamentMmr: avgMmr - 100,
          declaredMmr: avgMmr - 100,
          primaryRole: 'Position 4 — Soft Support',
          pbRating: 1700,
          isCaptain: false,
          isStandIn: false,
          consentStatus: 'ACCEPTED',
          invitedAt: new Date().toISOString()
        },
        {
          userId: `p-${teamId}-5`,
          ign: `${tag}_Hard`,
          avatar: '🩹',
          tournamentMmr: avgMmr - 200,
          declaredMmr: avgMmr - 200,
          primaryRole: 'Position 5 — Hard Support',
          pbRating: 1650,
          isCaptain: false,
          isStandIn: false,
          consentStatus: 'ACCEPTED',
          invitedAt: new Date().toISOString()
        }
      ],
      standIns: [],
      registeredAt: new Date().toISOString(),
      snapshotVersion: 1,
      auditTrail: []
    };
  }

  beforeEach(() => {
    engine = new DotaCompetitionEngine();
  });

  // ---------------------------------------------------------------------------
  // 1. SEEDING TESTS
  // ---------------------------------------------------------------------------
  describe('1. Seeding Modes (Manual, Random, Rating-Based)', () => {
    const tid = 'seed-test-tourney';

    beforeEach(() => {
      engine.initStructure({
        tournamentId: tid,
        tournamentName: 'Seed Test Tournament',
        format: 'double_elimination',
        teamCount: 4,
        seedingMode: 'rating',
        defaultSeriesFormat: 'BO3'
      });
    });

    it('Rating-Based Seeding: sorts teams descending by roster MMR strength', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-bronze', teamName: 'Bronze squad', tag: 'BRZ', avgMmr: 5000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-diamond', teamName: 'Diamond squad', tag: 'DMD', avgMmr: 8500 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-gold', teamName: 'Gold squad', tag: 'GLD', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-silver', teamName: 'Silver squad', tag: 'SLV', avgMmr: 6000 })
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(true);
      expect(res.seededTeams).toBeDefined();
      expect(res.seededTeams!.length).toBe(4);

      // Seed 1 should be the highest MMR team
      expect(res.seededTeams![0].teamId).toBe('t-diamond');
      expect(res.seededTeams![0].seed).toBe(1);
      expect(res.seededTeams![1].teamId).toBe('t-gold');
      expect(res.seededTeams![1].seed).toBe(2);
      expect(res.seededTeams![2].teamId).toBe('t-silver');
      expect(res.seededTeams![2].seed).toBe(3);
      expect(res.seededTeams![3].teamId).toBe('t-bronze');
      expect(res.seededTeams![3].seed).toBe(4);
    });

    it('Manual Seeding: respects exact organizer seed assignments', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-alpha', teamName: 'Alpha', tag: 'ALP', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-beta', teamName: 'Beta', tag: 'BET', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-gamma', teamName: 'Gamma', tag: 'GAM', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-delta', teamName: 'Delta', tag: 'DEL', avgMmr: 7000 })
      ];

      const manualSeeds = [
        { teamId: 't-gamma', seed: 1 },
        { teamId: 't-alpha', seed: 2 },
        { teamId: 't-delta', seed: 3 },
        { teamId: 't-beta', seed: 4 }
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'manual',
        manualSeeds,
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(true);
      expect(res.seededTeams![0].teamId).toBe('t-gamma');
      expect(res.seededTeams![0].seed).toBe(1);
      expect(res.seededTeams![1].teamId).toBe('t-alpha');
      expect(res.seededTeams![1].seed).toBe(2);
      expect(res.seededTeams![2].teamId).toBe('t-delta');
      expect(res.seededTeams![2].seed).toBe(3);
      expect(res.seededTeams![3].teamId).toBe('t-beta');
      expect(res.seededTeams![3].seed).toBe(4);
    });

    it('Random Seeding: assigns unique seeds 1..N to all participants', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-1', teamName: 'Team 1', tag: 'T1', avgMmr: 6000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-2', teamName: 'Team 2', tag: 'T2', avgMmr: 6100 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-3', teamName: 'Team 3', tag: 'T3', avgMmr: 6200 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-4', teamName: 'Team 4', tag: 'T4', avgMmr: 6300 })
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'random',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(true);
      const seeds = res.seededTeams!.map(t => t.seed).sort((a, b) => a - b);
      expect(seeds).toEqual([1, 2, 3, 4]);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. SINGLE ELIMINATION BRACKET GENERATION (2, 3, 4, 5, 6, 7, 8, 16 TEAMS + BYES)
  // ---------------------------------------------------------------------------
  describe('2. Single Elimination Brackets & Pure BYEs', () => {
    function testSingleElim(teamCount: number) {
      const tid = `se-${teamCount}-teams`;
      engine.initStructure({
        tournamentId: tid,
        tournamentName: `SE ${teamCount} Teams`,
        format: 'single_elimination',
        teamCount,
        seedingMode: 'rating',
        defaultSeriesFormat: 'BO3',
        roundSeriesOverrides: {
          'gf': 'BO5'
        }
      });

      const teams = Array.from({ length: teamCount }, (_, i) => 
        createFinalizedTeam({
          tournamentId: tid,
          teamId: `t-${i + 1}`,
          teamName: `Team ${i + 1}`,
          tag: `T${i + 1}`,
          avgMmr: 8000 - i * 100
        })
      );

      const seedRes = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });
      expect(seedRes.success).toBe(true);

      const genRes = engine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: ORGANIZER_CALLER.userId
      });
      expect(genRes.success).toBe(true);
      expect(genRes.structure).toBeDefined();

      const matches = genRes.structure!.matches;

      // In Single Elimination without 3rd place, total matches must equal teamCount - 1
      expect(matches.length).toBe(teamCount - 1);

      // Verify no fake TBD matches purely for BYEs
      for (const m of matches) {
        expect(m.isBye).toBeFalsy();
      }

      // Grand Final must exist
      const gf = matches.find(m => m.roundKey === 'gf' || m.stage === 'grand_final');
      expect(gf).toBeDefined();
      expect(gf!.seriesFormat).toBe('BO5');

      return matches;
    }

    it('supports 2 teams (Grand Final only)', () => {
      const matches = testSingleElim(2);
      expect(matches.length).toBe(1);
      expect(matches[0].teamA.seed).toBe(1);
      expect(matches[0].teamB.seed).toBe(2);
    });

    it('supports 3 teams (Test Cup format: 1 Semifinal + Seed 1 BYE to Grand Final)', () => {
      const matches = testSingleElim(3);
      expect(matches.length).toBe(2);

      const semi = matches.find(m => m.stage === 'semifinal');
      const gf = matches.find(m => m.stage === 'grand_final');

      expect(semi).toBeDefined();
      expect(gf).toBeDefined();

      // Seed 2 and Seed 3 play Semifinal
      expect(semi!.teamA.seed).toBe(2);
      expect(semi!.teamB.seed).toBe(3);
      expect(semi!.winnerNextMatchId).toBe(gf!.id);

      // Seed 1 receives direct BYE into Grand Final
      expect(gf!.teamA.seed).toBe(1);
      expect(gf!.teamA.sourceLabel).toContain('BYE');
    });

    it('supports 4 teams (2 Semifinals + Grand Final)', () => {
      const matches = testSingleElim(4);
      expect(matches.length).toBe(3);
    });

    it('supports 5 teams (1 Round 1 match + 3 BYEs to Semifinals + Grand Final)', () => {
      const matches = testSingleElim(5);
      expect(matches.length).toBe(4);
    });

    it('supports 6 teams (2 Round 1 matches + 2 BYEs to Semifinals + Grand Final)', () => {
      const matches = testSingleElim(6);
      expect(matches.length).toBe(5);
    });

    it('supports 7 teams (3 Round 1 matches + 1 BYE to Semifinals + Grand Final)', () => {
      const matches = testSingleElim(7);
      expect(matches.length).toBe(6);
    });

    it('supports 8 teams (4 Quarterfinals + 2 Semifinals + Grand Final)', () => {
      const matches = testSingleElim(8);
      expect(matches.length).toBe(7);
    });

    it('supports 16 teams (8 Round of 16 + 4 QF + 2 SF + Grand Final)', () => {
      const matches = testSingleElim(16);
      expect(matches.length).toBe(15);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. DOUBLE ELIMINATION & LOSER DROP DESTINATIONS (INDIA DOTA OPEN E2E)
  // ---------------------------------------------------------------------------
  describe('3. Double Elimination Bracket & Explicit Loser Drop Routing', () => {
    const tid = 'india-dota-open-2026';

    it('generates complete double elimination structure for 8 teams with explicit paths', () => {
      const teams = Array.from({ length: 8 }, (_, i) =>
        createFinalizedTeam({
          tournamentId: tid,
          teamId: `team-ido-${i + 1}`,
          teamName: `India Team ${i + 1}`,
          tag: `IT${i + 1}`,
          avgMmr: 8500 - i * 150
        })
      );

      const seedRes = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });
      expect(seedRes.success).toBe(true);

      const genRes = engine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: ORGANIZER_CALLER.userId
      });
      expect(genRes.success).toBe(true);
      const matches = genRes.structure!.matches;

      // 8-team Double Elimination has exactly 14 matches (4 UB QF + 2 UB SF + 1 UB F + 2 LB R1 + 2 LB R2 + 1 LB SF + 1 LB F + 1 GF)
      expect(matches.length).toBe(14);

      // Verify Upper Bracket Quarterfinals (4 matches)
      const ubQF = matches.filter(m => m.roundKey === 'ub-r1');
      expect(ubQF.length).toBe(4);

      // Check explicit winner and loser destinations for UB QF 1
      const ub1 = ubQF.find(m => m.id === `${tid}-ub-r1-m1`)!;
      expect(ub1).toBeDefined();
      expect(ub1.teamA.seed).toBe(1);
      expect(ub1.teamB.seed).toBe(8);
      expect(ub1.winnerNextMatchId).toBe(`${tid}-ub-sf-1`);
      expect(ub1.winnerNextSlot).toBe('teamA');
      expect(ub1.loserNextMatchId).toBe(`${tid}-lb-r1-m1`);
      expect(ub1.loserNextSlot).toBe('teamA');
      expect(ub1.loserDestinationLabel).toBeDefined();

      // Check UB QF 2
      const ub2 = ubQF.find(m => m.id === `${tid}-ub-r1-m2`)!;
      expect(ub2.winnerNextMatchId).toBe(`${tid}-ub-sf-1`);
      expect(ub2.winnerNextSlot).toBe('teamB');
      expect(ub2.loserNextMatchId).toBe(`${tid}-lb-r1-m1`);
      expect(ub2.loserNextSlot).toBe('teamB');

      // Check UB Semifinals (2 matches)
      const ubSF = matches.filter(m => m.roundKey === 'ub-r2');
      expect(ubSF.length).toBe(2);
      const ubSF1 = ubSF.find(m => m.id === `${tid}-ub-sf-1`)!;
      expect(ubSF1.winnerNextMatchId).toBe(`${tid}-ub-final`);
      expect(ubSF1.winnerNextSlot).toBe('teamA');
      expect(ubSF1.loserNextMatchId).toBe(`${tid}-lb-r2-m1`);
      expect(ubSF1.loserNextSlot).toBe('teamA');

      // Check Upper Final
      const ubFinal = matches.find(m => m.roundKey === 'ub-final')!;
      expect(ubFinal).toBeDefined();
      expect(ubFinal.winnerNextMatchId).toBe(`${tid}-gf`);
      expect(ubFinal.winnerNextSlot).toBe('teamA');
      expect(ubFinal.loserNextMatchId).toBe(`${tid}-lb-final`);
      expect(ubFinal.loserNextSlot).toBe('teamA');

      // Check Lower Final
      const lbFinal = matches.find(m => m.roundKey === 'lb-final')!;
      expect(lbFinal).toBeDefined();
      expect(lbFinal.winnerNextMatchId).toBe(`${tid}-gf`);
      expect(lbFinal.winnerNextSlot).toBe('teamB');

      // Check Grand Final
      const gf = matches.find(m => m.roundKey === 'gf')!;
      expect(gf).toBeDefined();
      expect(gf.seriesFormat).toBe('BO5');

      // Validate full graph progression integrity
      const graphVal = engine.validateProgressionGraph(matches);
      expect(graphVal.valid).toBe(true);

      // Lock structure
      const lockRes = engine.lockCompetitionStructure(tid, ORGANIZER_CALLER.userId);
      expect(lockRes.success).toBe(true);
      expect(lockRes.structure!.status).toBe('LOCKED');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. ROUND ROBIN & DETERMINISTIC TIEBREAKS
  // ---------------------------------------------------------------------------
  describe('4. Round Robin & Deterministic Tiebreak Hierarchy', () => {
    it('generates unique round robin pairings once with zero duplicates', () => {
      const teams: SeededTeam[] = [
        { teamId: 't-a', teamName: 'Alpha', tag: 'A', logo: '🛡️', seed: 1, rosterStrengthRating: 7500 },
        { teamId: 't-b', teamName: 'Beta', tag: 'B', logo: '🛡️', seed: 2, rosterStrengthRating: 7200 },
        { teamId: 't-c', teamName: 'Gamma', tag: 'C', logo: '🛡️', seed: 3, rosterStrengthRating: 7000 },
        { teamId: 't-d', teamName: 'Delta', tag: 'D', logo: '🛡️', seed: 4, rosterStrengthRating: 6800 }
      ];

      const matches = engine.buildRoundRobinMatches('rr-tourney', teams, 'BO1', 'grp-a');
      // 4 teams in single round-robin = (4 * 3) / 2 = 6 unique pairings
      expect(matches.length).toBe(6);

      // Verify no duplicate pairings
      const seenPairings = new Set<string>();
      for (const m of matches) {
        const pKey = [m.teamA.teamId, m.teamB.teamId].sort().join(' vs ');
        expect(seenPairings.has(pKey)).toBe(false);
        seenPairings.add(pKey);
      }
    });

    it('Deterministic Tiebreaks: resolves ties by Head-to-Head -> Game Diff -> Game Wins -> Seed', () => {
      const teamsStats: TiebreakTeamStats[] = [
        {
          teamId: 'team-tied-1',
          teamName: 'Tied Team 1',
          seed: 1,
          matchWins: 2,
          matchLosses: 1,
          seriesWins: 2,
          seriesLosses: 1,
          gamesWon: 4,
          gamesLost: 2,
          points: 6
        },
        {
          teamId: 'team-tied-2',
          teamName: 'Tied Team 2',
          seed: 2,
          matchWins: 2,
          matchLosses: 1,
          seriesWins: 2,
          seriesLosses: 1,
          gamesWon: 4,
          gamesLost: 2,
          points: 6
        }
      ];

      // Case 1: Head-to-Head winner takes higher rank
      const h2h: HeadToHeadRecord[] = [
        {
          teamAId: 'team-tied-1',
          teamBId: 'team-tied-2',
          winnerTeamId: 'team-tied-2'
        }
      ];

      const sorted = DotaTiebreakEngine.sortStandings(teamsStats, h2h);
      expect(sorted[0].teamId).toBe('team-tied-2');
      expect(sorted[0].rank).toBe(1);
      expect(sorted[1].teamId).toBe('team-tied-1');
      expect(sorted[1].rank).toBe(2);

      // Case 2: Without head-to-head, game diff or seed breaks the tie deterministically
      const sortedBySeed = DotaTiebreakEngine.sortStandings(teamsStats, []);
      expect(sortedBySeed[0].teamId).toBe('team-tied-1'); // Lower seed number = higher rank
      expect(sortedBySeed[0].rank).toBe(1);
    });

    it('publicly displays official tournament tiebreak rules', () => {
      const rules = engine.getTiebreakRulesDescription();
      expect(rules.length).toBeGreaterThanOrEqual(4);
      expect(rules[0]).toContain('Points');
      expect(rules[1]).toContain('Head-to-Head');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. GROUPS -> PLAYOFFS (PURPLE BEAN CHALLENGER FIXTURE)
  // ---------------------------------------------------------------------------
  describe('5. Groups -> Playoffs (Purple Bean Challenger)', () => {
    const tid = 'pb-challenger-2026';

    it('configures 8 teams into 2 groups of 4 with round robin and playoff bracket', () => {
      const teams = Array.from({ length: 8 }, (_, i) =>
        createFinalizedTeam({
          tournamentId: tid,
          teamId: `t-chal-${i + 1}`,
          teamName: `Challenger Squad ${i + 1}`,
          tag: `CS${i + 1}`,
          avgMmr: 7800 - i * 120
        })
      );

      const seedRes = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });
      expect(seedRes.success).toBe(true);

      const genRes = engine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: ORGANIZER_CALLER.userId
      });
      expect(genRes.success).toBe(true);
      const structure = genRes.structure!;

      expect(structure.groups).toBeDefined();
      expect(structure.groups!['group-a']).toBeDefined();
      expect(structure.groups!['group-b']).toBeDefined();

      const grpA = structure.groups!['group-a'];
      const grpB = structure.groups!['group-b'];

      // Each group has 4 teams
      expect(grpA.teams.length).toBe(4);
      expect(grpB.teams.length).toBe(4);

      // Group A has 6 matches (BO1)
      expect(grpA.matches.length).toBe(6);
      expect(grpA.matches[0].seriesFormat).toBe('BO1');

      // Group standings structure
      expect(grpA.standings.length).toBe(4);
      expect(grpA.standings[0].rank).toBe(1);

      // Playoff matches: Semifinals (BO3) and Grand Final (BO5)
      const sf1 = structure.matches.find(m => m.id === `${tid}-po-sf-1`)!;
      const sf2 = structure.matches.find(m => m.id === `${tid}-po-sf-2`)!;
      const poFinal = structure.matches.find(m => m.id === `${tid}-po-final`)!;

      expect(sf1).toBeDefined();
      expect(sf1.seriesFormat).toBe('BO3');
      expect(sf1.teamA.sourceLabel).toBe('A1');
      expect(sf1.teamB.sourceLabel).toBe('B2');
      expect(sf1.winnerNextMatchId).toBe(poFinal.id);

      expect(sf2).toBeDefined();
      expect(sf2.seriesFormat).toBe('BO3');
      expect(sf2.teamA.sourceLabel).toBe('B1');
      expect(sf2.teamB.sourceLabel).toBe('A2');
      expect(sf2.winnerNextMatchId).toBe(poFinal.id);

      expect(poFinal).toBeDefined();
      expect(poFinal.seriesFormat).toBe('BO5');
    });
  });

  // ---------------------------------------------------------------------------
  // 6. NEGATIVE INVARIANTS & SECURITY CHECKS
  // ---------------------------------------------------------------------------
  describe('6. Negative Tests & Progression Integrity Invariants', () => {
    const tid = 'neg-test-tourney';

    beforeEach(() => {
      engine.initStructure({
        tournamentId: tid,
        tournamentName: 'Negative Test Cup',
        format: 'single_elimination',
        teamCount: 4,
        seedingMode: 'rating',
        defaultSeriesFormat: 'BO3'
      });
    });

    it('DENIED: unfinalized team included in seeding', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-1', teamName: 'T1', tag: 'T1', avgMmr: 7000, status: 'APPROVED' }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-2', teamName: 'T2', tag: 'T2', avgMmr: 7000, status: 'APPROVED' }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-3', teamName: 'T3', tag: 'T3', avgMmr: 7000, status: 'APPROVED' }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-unverified', teamName: 'Unverified Team', tag: 'UNV', avgMmr: 7000, status: 'DRAFT' })
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('DENIED');
      expect(res.error).toContain('unfinalized');
    });

    it('DENIED: duplicate seed in manual seeding', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-1', teamName: 'T1', tag: 'T1', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-2', teamName: 'T2', tag: 'T2', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-3', teamName: 'T3', tag: 'T3', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-4', teamName: 'T4', tag: 'T4', avgMmr: 7000 })
      ];

      const manualSeedsWithDuplicate = [
        { teamId: 't-1', seed: 1 },
        { teamId: 't-2', seed: 1 }, // Duplicate Seed 1!
        { teamId: 't-3', seed: 3 },
        { teamId: 't-4', seed: 4 }
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'manual',
        manualSeeds: manualSeedsWithDuplicate,
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('DENIED');
      expect(res.error).toContain('Duplicate seed');
    });

    it('DENIED: missing seed gap in manual seeding', () => {
      const teams = [
        createFinalizedTeam({ tournamentId: tid, teamId: 't-1', teamName: 'T1', tag: 'T1', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-2', teamName: 'T2', tag: 'T2', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-3', teamName: 'T3', tag: 'T3', avgMmr: 7000 }),
        createFinalizedTeam({ tournamentId: tid, teamId: 't-4', teamName: 'T4', tag: 'T4', avgMmr: 7000 })
      ];

      const manualSeedsWithGap = [
        { teamId: 't-1', seed: 1 },
        { teamId: 't-2', seed: 2 },
        { teamId: 't-3', seed: 4 }, // Missing seed 3!
        { teamId: 't-4', seed: 5 }
      ];

      const res = engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'manual',
        manualSeeds: manualSeedsWithGap,
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('DENIED');
      expect(res.error).toContain('Missing seed');
    });

    it('DENIED: regenerate competition structure after structure lock', () => {
      const teams = Array.from({ length: 4 }, (_, i) =>
        createFinalizedTeam({ tournamentId: tid, teamId: `t-${i + 1}`, teamName: `T${i + 1}`, tag: `T${i + 1}`, avgMmr: 7000 })
      );

      engine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: ORGANIZER_CALLER.userId,
        candidateTeams: teams
      });

      engine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: ORGANIZER_CALLER.userId
      });

      // Lock structure
      const lockRes = engine.lockCompetitionStructure(tid, ORGANIZER_CALLER.userId);
      expect(lockRes.success).toBe(true);

      // Attempt regeneration
      const regenRes = engine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: ORGANIZER_CALLER.userId
      });
      expect(regenRes.success).toBe(false);
      expect(regenRes.error).toContain('DENIED');
      expect(regenRes.error).toContain('LOCKED');
    });

    it('DENIED: non-organizer client direct modification of bracket progression', () => {
      const res = engine.updateMatchProgression({
        tournamentId: tid,
        matchId: 'some-match',
        updates: { seriesFormat: 'BO5' },
        staffActorId: CLIENT_PLAYER_CALLER.userId,
        userRole: CLIENT_PLAYER_CALLER.role
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('DENIED');
      expect(res.error).toContain('Organizer authorization required');
    });

    it('DENIED: invalid loser destination (cannot drop into Upper Bracket)', () => {
      const fakeMatches: CompetitionMatchNode[] = [
        {
          id: 'm1',
          tournamentId: 'fake',
          stage: 'upper',
          roundKey: 'ub-r1',
          roundTitle: 'UB QF',
          matchNumber: 1,
          seriesFormat: 'BO3',
          teamA: { name: 'A', score: 0 },
          teamB: { name: 'B', score: 0 },
          status: 'UPCOMING',
          loserNextMatchId: 'm2', // Points to another UPPER bracket match!
          column: 1,
          row: 1
        },
        {
          id: 'm2',
          tournamentId: 'fake',
          stage: 'upper',
          roundKey: 'ub-r2',
          roundTitle: 'UB SF',
          matchNumber: 2,
          seriesFormat: 'BO3',
          teamA: { name: 'C', score: 0 },
          teamB: { name: 'D', score: 0 },
          status: 'UPCOMING',
          column: 2,
          row: 1
        }
      ];

      const val = engine.validateProgressionGraph(fakeMatches);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('DENIED');
      expect(val.error).toContain('Upper Bracket');
    });

    it('DENIED: invalid BO format configuration (only BO1, BO3, BO5 allowed)', () => {
      const val1 = engine.validateSeriesFormat('BO2');
      expect(val1.valid).toBe(false);
      expect(val1.error).toContain('DENIED');

      const val2 = engine.validateSeriesFormat('BO7');
      expect(val2.valid).toBe(false);

      const val3 = engine.validateSeriesFormat('BO3');
      expect(val3.valid).toBe(true);
    });

    it('DENIED: same team scheduled against itself', () => {
      const val = engine.validateMatchPairing('team-phoenix', 'team-phoenix');
      expect(val.valid).toBe(false);
      expect(val.error).toContain('DENIED');
      expect(val.error).toContain('scheduled against itself');
    });
  });

  // ---------------------------------------------------------------------------
  // 7. TEST CUP REGRESSION
  // ---------------------------------------------------------------------------
  describe('7. Test Cup Regression', () => {
    it('Purple Bean Test Cup single elimination regression preserves 1 semifinal, 1 bye, 1 grand final', () => {
      const tcRes = testCupEngine.generateSingleEliminationBracket();
      expect(tcRes.semifinal).toBeDefined();
      expect(tcRes.grandFinal).toBeDefined();

      const matches = testCupEngine.getMatches();
      expect(matches.length).toBe(2);

      const semi = tcRes.semifinal;
      const gf = tcRes.grandFinal;

      // Semifinal has 2 teams
      expect(semi.teamA).toBeDefined();
      expect(semi.teamB).toBeDefined();

      // Grand final has Seed 1 with direct BYE
      expect(gf.teamB.name).toBe('Bengaluru Blaze'); // Seed 1 BYE
    });
  });
});
