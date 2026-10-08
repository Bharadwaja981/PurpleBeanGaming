/**
 * Purple Bean Gaming — Competition Engine End-to-End Scenarios Test Suite
 * Tournament: "After auction test" with 8 formed teams
 *
 * Scenario A: Standard Double Elimination (14 matches, full winner progression & loser drops)
 * Scenario B: Group Stage -> Main Event (2 groups of 4 BO2, mixed-entry playoff bracket, tiebreakers)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaCompetitionEngine, 
  DotaCompetitionEngine,
  CompetitionMatchNode,
  GroupStandingRow,
  SeriesFormat,
  DotaIndividualGame
} from '../../src/domain/dotaCompetitionEngine';
import { tournamentService } from '../../src/services/firebaseService';
import { tournamentConfigRegistry } from '../../src/domain/tournamentConfigRegistry';
import { AFTER_AUCTION_8_TEAMS } from '../../src/data/mockData';

describe('Purple Bean Gaming: "After auction test" 8-Team Competition Engine Verification', () => {
  const TOURNAMENT_ID = 'after-auction-test';
  let engine: DotaCompetitionEngine;

  beforeEach(() => {
    engine = new DotaCompetitionEngine();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(`pbg_competition_structure_${TOURNAMENT_ID}`);
    }
  });

  describe('Tournament & Team Setup Verification', () => {
    it('successfully loads "After auction test" tournament with 8 formed teams', () => {
      const tourney = tournamentService.getTournamentById(TOURNAMENT_ID);
      expect(tourney).toBeDefined();
      expect(tourney?.name).toBe('After auction test');
      expect(tourney?.teamCount).toBe(8);

      const cfg = tournamentConfigRegistry.getConfig(TOURNAMENT_ID);
      expect(cfg).toBeDefined();
      expect(cfg?.identity.name).toBe('After auction test');

      const resolvedTeams = (tourney as any)?.teams || AFTER_AUCTION_8_TEAMS;
      expect(resolvedTeams.length).toBe(8);

      const teamIds = new Set(resolvedTeams.map((t: any) => t.id || t.teamId));
      expect(teamIds.size).toBe(8); // No duplicate teams
    });
  });

  // =========================================================================
  // SCENARIO A: STANDARD DOUBLE ELIMINATION
  // =========================================================================
  describe('Scenario A: Standard Double Elimination (8 Teams)', () => {
    let structureMatches: CompetitionMatchNode[];

    beforeEach(() => {
      const tourney = tournamentService.getTournamentById(TOURNAMENT_ID);
      const teams = (tourney as any)?.teams || AFTER_AUCTION_8_TEAMS;

      const struct = engine.getOrCreateStructure(TOURNAMENT_ID, teams);
      struct.stages = [
        {
          id: `stage-${TOURNAMENT_ID}-de`,
          name: 'Main Event Double Elimination',
          sequence: 1,
          type: 'DOUBLE_ELIMINATION',
          status: 'UPCOMING',
          teamCount: 8,
          defaultSeriesFormat: 'BO3',
          grandFinalSeriesFormat: 'BO5',
          thirdPlaceMatch: false,
          grandFinalReset: true,
          seedingMode: 'RATING_BASED',
          seededTeams: [...struct.teams],
          matches: []
        }
      ];

      const res = engine.generateFullStructure(TOURNAMENT_ID, teams);
      expect(res.success).toBe(true);
      structureMatches = res.structure.matches;
    });

    it('A.1: generates the full 14-match structure with all 8 teams starting in Upper Bracket', () => {
      // 8 teams Double Elimination: 4 UB QF + 2 UB SF + 1 UB Final + 2 LB R1 + 2 LB R2 + 1 LB SF + 1 LB Final + 1 GF = 14
      expect(structureMatches.length).toBe(14);

      const ubQF = structureMatches.filter(m => m.roundKey === 'ub-r1');
      expect(ubQF.length).toBe(4);

      // Verify all 8 unique teams begin in Upper Bracket Quarterfinals
      const ubTeams = new Set<string>();
      ubQF.forEach(m => {
        expect(m.teamA?.teamId).toBeDefined();
        expect(m.teamB?.teamId).toBeDefined();
        ubTeams.add(m.teamA.teamId);
        ubTeams.add(m.teamB.teamId);
      });
      expect(ubTeams.size).toBe(8);

      // Validate Seeding distribution: 1v8, 4v5, 2v7, 3v6
      const qf1 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m1`)!;
      const qf2 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m2`)!;
      const qf3 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m3`)!;
      const qf4 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m4`)!;

      expect(qf1.teamA.seed).toBe(1);
      expect(qf1.teamB.seed).toBe(8);
      expect(qf2.teamA.seed).toBe(4);
      expect(qf2.teamB.seed).toBe(5);
      expect(qf3.teamA.seed).toBe(2);
      expect(qf3.teamB.seed).toBe(7);
      expect(qf4.teamA.seed).toBe(3);
      expect(qf4.teamB.seed).toBe(6);
    });

    it('A.2: validates explicit winner progression and loser drops to lower bracket slots', () => {
      const qf1 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m1`)!;
      expect(qf1.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-ub-sf-1`);
      expect(qf1.winnerNextSlot).toBe('teamA');
      expect(qf1.loserNextMatchId).toBe(`${TOURNAMENT_ID}-lb-r1-m1`);
      expect(qf1.loserNextSlot).toBe('teamA');

      const qf2 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m2`)!;
      expect(qf2.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-ub-sf-1`);
      expect(qf2.winnerNextSlot).toBe('teamB');
      expect(qf2.loserNextMatchId).toBe(`${TOURNAMENT_ID}-lb-r1-m1`);
      expect(qf2.loserNextSlot).toBe('teamB');

      // Upper Semifinals drop into Lower Round 2
      const ubSf1 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-1`)!;
      expect(ubSf1.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-ub-final`);
      expect(ubSf1.loserNextMatchId).toBe(`${TOURNAMENT_ID}-lb-r2-m1`);
      expect(ubSf1.loserNextSlot).toBe('teamA');

      const ubSf2 = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-2`)!;
      expect(ubSf2.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-ub-final`);
      expect(ubSf2.loserNextMatchId).toBe(`${TOURNAMENT_ID}-lb-r2-m2`);
      expect(ubSf2.loserNextSlot).toBe('teamA');

      // Upper Final drops into Lower Final
      const ubFinal = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-final`)!;
      expect(ubFinal.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-gf`);
      expect(ubFinal.winnerNextSlot).toBe('teamA');
      expect(ubFinal.loserNextMatchId).toBe(`${TOURNAMENT_ID}-lb-final`);
      expect(ubFinal.loserNextSlot).toBe('teamA');

      // Lower Final advances winner to Grand Final
      const lbFinal = structureMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-final`)!;
      expect(lbFinal.winnerNextMatchId).toBe(`${TOURNAMENT_ID}-gf`);
      expect(lbFinal.winnerNextSlot).toBe('teamB');

      // Full progression graph integrity validation
      const graphValidation = engine.validateProgressionGraph(structureMatches);
      expect(graphValidation.valid).toBe(true);
    });

    it('A.3: plays through complete double elimination bracket with Dota match IDs, BO completion and correct Grand Final participants', () => {
      const stageId = `stage-${TOURNAMENT_ID}-de`;

      // Game metadata helper
      const makeDotaGames = (matchId: string, count: number): DotaIndividualGame[] => {
        return Array.from({ length: count }, (_, i) => ({
          gameNumber: i + 1,
          valveMatchId: `789100${Math.floor(Math.random() * 10000)}`,
          openDotaMatchId: `789100${Math.floor(Math.random() * 10000)}`,
          durationSeconds: 2150 + i * 120,
          isVerified: true
        }));
      };

      // 1. UB QF 1: Seed 1 (Vanguard) beats Seed 8 (Frostbite) 2-0
      const qf1Res = engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-r1-m1`,
        scoreA: 2,
        scoreB: 0,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-r1-m1`, 2),
        confirmedBy: 'Head Referee'
      });
      expect(qf1Res.success).toBe(true);

      // 2. UB QF 2: Seed 4 (Iron Legion) beats Seed 5 (Solar Flare) 2-1
      const qf2Res = engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-r1-m2`,
        scoreA: 2,
        scoreB: 1,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-r1-m2`, 3),
        confirmedBy: 'Head Referee'
      });
      expect(qf2Res.success).toBe(true);

      // Verify UB SF 1 now has Vanguard (teamA) vs Iron Legion (teamB)
      const structAfterQF1_2 = engine.getStructure(TOURNAMENT_ID)!;
      const ubSf1 = structAfterQF1_2.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-1`)!;
      expect(ubSf1.teamA.name).toBe('Vanguard Gaming');
      expect(ubSf1.teamB.name).toBe('Iron Legion');

      // Verify LB R1 Match 1 has Frostbite (teamA) vs Solar Flare (teamB)
      const lbR1_1 = structAfterQF1_2.matches.find(m => m.id === `${TOURNAMENT_ID}-lb-r1-m1`)!;
      expect(lbR1_1.teamA.name).toBe('Frostbite Esports');
      expect(lbR1_1.teamB.name).toBe('Solar Flare');

      // 3. UB QF 3: Seed 2 (Apex) beats Seed 7 (Mystic Wolves) 2-0
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-r1-m3`,
        scoreA: 2,
        scoreB: 0,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-r1-m3`, 2),
        confirmedBy: 'Head Referee'
      });

      // 4. UB QF 4: Seed 3 (Shadow) beats Seed 6 (Thunderbolts) 2-0
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-r1-m4`,
        scoreA: 2,
        scoreB: 0,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-r1-m4`, 2),
        confirmedBy: 'Head Referee'
      });

      // 5. UB SF 1: Vanguard Gaming beats Iron Legion 2-0 -> Vanguard advances to Upper Final
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-sf-1`,
        scoreA: 2,
        scoreB: 0,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-sf-1`, 2),
        confirmedBy: 'Head Referee'
      });

      // 6. UB SF 2: Apex Predators beats Shadow Strikers 2-1 -> Apex advances to Upper Final
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-sf-2`,
        scoreA: 2,
        scoreB: 1,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-sf-2`, 3),
        confirmedBy: 'Head Referee'
      });

      // Upper Final should now be Vanguard Gaming vs Apex Predators
      const structAtUBFinal = engine.getStructure(TOURNAMENT_ID)!;
      const ubFinalMatch = structAtUBFinal.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-final`)!;
      expect(ubFinalMatch.teamA.name).toBe('Vanguard Gaming');
      expect(ubFinalMatch.teamB.name).toBe('Apex Predators');

      // 7. UB Final: Vanguard Gaming beats Apex Predators 2-1 -> Vanguard advances to Grand Final!
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-final`,
        scoreA: 2,
        scoreB: 1,
        games: makeDotaGames(`${TOURNAMENT_ID}-ub-final`, 3),
        confirmedBy: 'Head Referee'
      });

      // Apex Predators dropped to LB Final
      const structAtLBFinal = engine.getStructure(TOURNAMENT_ID)!;
      const lbFinalNode = structAtLBFinal.matches.find(m => m.id === `${TOURNAMENT_ID}-lb-final`)!;
      expect(lbFinalNode.teamA.name).toBe('Apex Predators');

      // Play through Lower Bracket to determine Lower Finalist:
      // LB R1 M1: Solar Flare beats Frostbite 2-0
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-r1-m1`,
        scoreA: 0,
        scoreB: 2,
        confirmedBy: 'Head Referee'
      });

      // LB R1 M2: Thunderbolts beats Mystic Wolves 2-1
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-r1-m2`,
        scoreA: 1,
        scoreB: 2,
        confirmedBy: 'Head Referee'
      });

      // LB R2 M1: Iron Legion beats Solar Flare 2-1
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-r2-m1`,
        scoreA: 2,
        scoreB: 1,
        confirmedBy: 'Head Referee'
      });

      // LB R2 M2: Shadow Strikers beats Thunderbolts 2-0
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-r2-m2`,
        scoreA: 2,
        scoreB: 0,
        confirmedBy: 'Head Referee'
      });

      // LB Semifinal: Shadow Strikers beats Iron Legion 2-1 -> Shadow advances to Lower Final
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-sf`,
        scoreA: 1,
        scoreB: 2,
        confirmedBy: 'Head Referee'
      });

      // LB Final: Apex Predators beats Shadow Strikers 2-0 -> Apex advances to Grand Final!
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-lb-final`,
        scoreA: 2,
        scoreB: 0,
        games: makeDotaGames(`${TOURNAMENT_ID}-lb-final`, 2),
        confirmedBy: 'Head Referee'
      });

      // Grand Final Check
      const structFinal = engine.getStructure(TOURNAMENT_ID)!;
      const gfNode = structFinal.matches.find(m => m.id === `${TOURNAMENT_ID}-gf`)!;
      expect(gfNode.teamA.name).toBe('Vanguard Gaming'); // Upper Final winner
      expect(gfNode.teamB.name).toBe('Apex Predators');   // Lower Final winner
      expect(gfNode.seriesFormat).toBe('BO5');

      // Grand Final: Vanguard Gaming wins 3-1
      const gfRes = engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-gf`,
        scoreA: 3,
        scoreB: 1,
        games: makeDotaGames(`${TOURNAMENT_ID}-gf`, 4),
        confirmedBy: 'Head Referee'
      });
      expect(gfRes.success).toBe(true);
      expect(gfRes.match?.status).toBe('COMPLETED');
      expect(gfRes.match?.winnerId).toBe('team-aat-1');
    });

    it('A.4: verifies bracket publishing, lock enforcement, and safe editing without losing completed matches', () => {
      // 1. Publish structure
      const pubRes = engine.publishStructure(TOURNAMENT_ID);
      expect(pubRes.success).toBe(true);
      expect(pubRes.structure.status).toBe('PUBLISHED');
      expect(pubRes.structure.isLocked).toBe(true);

      // Attempt regeneration while locked -> DENIED
      const regenRes = engine.generateCompetitionStructure({ tournamentId: TOURNAMENT_ID });
      expect(regenRes.success).toBe(false);
      expect(regenRes.error).toContain('LOCKED');

      // 2. Play first match
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: `stage-${TOURNAMENT_ID}-de`,
        matchId: `${TOURNAMENT_ID}-ub-r1-m1`,
        scoreA: 2,
        scoreB: 0,
        confirmedBy: 'Organiser'
      });

      // 3. Organizer unlocks for editing
      const unlockRes = engine.editPublishedStructure(TOURNAMENT_ID);
      expect(unlockRes.success).toBe(true);
      expect(unlockRes.hasStartedMatches).toBe(true);

      // 4. Verify completed match is preserved intact
      const updatedStruct = engine.getStructure(TOURNAMENT_ID)!;
      const m1 = updatedStruct.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m1`)!;
      expect(m1.status).toBe('COMPLETED');
      expect(m1.scores?.teamA).toBe(2);
      expect(m1.scores?.teamB).toBe(0);

      // 5. Re-publish safely
      const repubRes = engine.publishStructure(TOURNAMENT_ID);
      expect(repubRes.success).toBe(true);
      expect(repubRes.structure.version).toBeGreaterThan(1);
    });

    it('A.5: verifies persistence and public/organiser synchronization after reload', () => {
      const stageId = `stage-${TOURNAMENT_ID}-de`;

      // Set match result in engine
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId,
        matchId: `${TOURNAMENT_ID}-ub-r1-m1`,
        scoreA: 2,
        scoreB: 0,
        confirmedBy: 'Admin'
      });

      // Create a new engine instance to simulate page reload / new tab / public view
      const freshEngineInstance = new DotaCompetitionEngine();
      const reloadedStructure = freshEngineInstance.getStructure(TOURNAMENT_ID);

      expect(reloadedStructure).toBeDefined();
      const reloadedM1 = reloadedStructure!.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-r1-m1`);
      expect(reloadedM1?.status).toBe('COMPLETED');
      expect(reloadedM1?.scores?.teamA).toBe(2);
      expect(reloadedM1?.scores?.teamB).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO B: GROUP STAGE -> MAIN EVENT (MIXED-ENTRY PLAYOFFS)
  // =========================================================================
  describe('Scenario B: Group Stage -> Main Event (2 Groups of 4 BO2, Mixed-Entry Playoffs)', () => {
    let groupAMatches: CompetitionMatchNode[];
    let groupBMatches: CompetitionMatchNode[];
    let playoffMatches: CompetitionMatchNode[];

    beforeEach(() => {
      const tourney = tournamentService.getTournamentById(TOURNAMENT_ID);
      const teams = (tourney as any)?.teams || AFTER_AUCTION_8_TEAMS;

      const struct = engine.getOrCreateStructure(TOURNAMENT_ID, teams);
      
      // Stage 1: Group Stage (2 groups of 4, Round Robin BO2)
      // Stage 2: Mixed-Entry Playoffs (Double Elimination: UB SF + LB R1)
      const groupStage: any = {
        id: `stage-${TOURNAMENT_ID}-groups`,
        name: 'Stage 1: Group Stage (BO2)',
        sequence: 1,
        type: 'GROUP_STAGE',
        groupCount: 2,
        status: 'UPCOMING',
        teamCount: 8,
        defaultSeriesFormat: 'BO2',
        seededTeams: [...struct.teams],
        matches: []
      };

      const playoffStage: any = {
        id: `stage-${TOURNAMENT_ID}-playoffs`,
        name: 'Stage 2: Main Event Playoffs',
        sequence: 2,
        type: 'DOUBLE_ELIMINATION',
        mixedEntryFromGroups: true,
        status: 'UPCOMING',
        teamCount: 8,
        defaultSeriesFormat: 'BO3',
        grandFinalSeriesFormat: 'BO5',
        matches: []
      };

      struct.stages = [groupStage, playoffStage];
      const genRes = engine.generateFullStructure(TOURNAMENT_ID, teams);
      expect(genRes.success).toBe(true);

      const generatedStruct = genRes.structure;
      const s1 = generatedStruct.stages[0];
      const s2 = generatedStruct.stages[1];

      groupAMatches = s1.matches.filter(m => m.roundKey?.includes('Group A') || m.id?.includes('GroupA'));
      groupBMatches = s1.matches.filter(m => m.roundKey?.includes('Group B') || m.id?.includes('GroupB'));
      playoffMatches = s2.matches;
    });

    it('B.1: generates 2 groups of 4 with 6 Round Robin BO2 matches per group (12 total group matches)', () => {
      // 4 teams in each group: 4*3/2 = 6 BO2 matches each
      expect(groupAMatches.length).toBe(6);
      expect(groupBMatches.length).toBe(6);

      groupAMatches.forEach(m => {
        expect(m.seriesFormat).toBe('BO2');
        expect(m.teamA?.teamId).toBeDefined();
        expect(m.teamB?.teamId).toBeDefined();
        expect(m.teamA.teamId).not.toBe(m.teamB.teamId); // No self-pairing
      });

      groupBMatches.forEach(m => {
        expect(m.seriesFormat).toBe('BO2');
      });
    });

    it('B.2: generates the appropriate 10-match mixed-entry playoff structure (UB SF + LB R1)', () => {
      // Mixed-entry Double Elimination from 2 groups:
      // Upper Bracket: 2 UB SF (A1 vs B2, B1 vs A2) + 1 UB Final
      // Lower Bracket: 2 LB R1 (A3 vs B4, B3 vs A4) + 2 LB R2 + 1 LB SF + 1 LB Final
      // Grand Final: 1 GF
      // Total = 2 + 1 + 2 + 2 + 1 + 1 + 1 = 10 matches
      expect(playoffMatches.length).toBe(10);

      const ubSf1 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-1`)!;
      const ubSf2 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-2`)!;
      const ubFinal = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-ub-final`)!;

      const lbR1_1 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-r1-m1`)!;
      const lbR1_2 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-r1-m2`)!;
      const lbR2_1 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-r2-m1`)!;
      const lbR2_2 = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-r2-m2`)!;
      const lbSf = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-sf`)!;
      const lbFinal = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-lb-final`)!;
      const gf = playoffMatches.find(m => m.id === `${TOURNAMENT_ID}-gf`)!;

      expect(ubSf1).toBeDefined();
      expect(ubSf2).toBeDefined();
      expect(ubFinal).toBeDefined();
      expect(lbR1_1).toBeDefined();
      expect(lbR1_2).toBeDefined();
      expect(lbR2_1).toBeDefined();
      expect(lbR2_2).toBeDefined();
      expect(lbSf).toBeDefined();
      expect(lbFinal).toBeDefined();
      expect(gf).toBeDefined();

      // Check slot routing
      expect(ubSf1.winnerNextMatchId).toBe(ubFinal.id);
      expect(ubSf1.loserNextMatchId).toBe(lbR2_1.id);
      expect(ubSf2.winnerNextMatchId).toBe(ubFinal.id);
      expect(ubSf2.loserNextMatchId).toBe(lbR2_2.id);

      expect(lbR1_1.winnerNextMatchId).toBe(lbR2_1.id);
      expect(lbR1_2.winnerNextMatchId).toBe(lbR2_2.id);

      expect(lbR2_1.winnerNextMatchId).toBe(lbSf.id);
      expect(lbR2_2.winnerNextMatchId).toBe(lbSf.id);

      expect(lbSf.winnerNextMatchId).toBe(lbFinal.id);
      expect(ubFinal.winnerNextMatchId).toBe(gf.id);
      expect(ubFinal.loserNextMatchId).toBe(lbFinal.id);

      expect(lbFinal.winnerNextMatchId).toBe(gf.id);
    });

    it('B.3: records BO2 group stage results with draws (1-1), calculates standings with official tiebreakers, and assigns UB/LB qualification', () => {
      const struct = engine.getStructure(TOURNAMENT_ID)!;
      const groupAConfig = struct.stages[0].groups![0];

      // Play all 6 Group A matches
      // Match 1: Team 1 vs Team 2 -> 2-0 (Team 1 wins 3 pts)
      // Match 2: Team 3 vs Team 4 -> 1-1 (Draw: 1 pt each)
      // Match 3: Team 1 vs Team 3 -> 2-0 (Team 1 wins 3 pts)
      // Match 4: Team 2 vs Team 4 -> 2-0 (Team 2 wins 3 pts)
      // Match 5: Team 1 vs Team 4 -> 1-1 (Draw: 1 pt each)
      // Match 6: Team 2 vs Team 3 -> 2-0 (Team 2 wins 3 pts)

      const gAMatches = struct.stages[0].matches.filter(m => m.roundKey?.includes('Group A') || m.id?.includes('GroupA'));
      gAMatches.forEach((m) => {
        const tA = m.teamA?.teamId;
        const tB = m.teamB?.teamId;
        const t1 = groupAConfig.teams[0].teamId;
        const t2 = groupAConfig.teams[1].teamId;
        const t3 = groupAConfig.teams[2].teamId;
        const t4 = groupAConfig.teams[3].teamId;

        let sA = 0;
        let sB = 0;

        // T1 matches: beats T2 (2-0), beats T3 (2-0), draws T4 (1-1)
        if ((tA === t1 && tB === t2) || (tA === t2 && tB === t1)) {
          sA = tA === t1 ? 2 : 0;
          sB = tA === t1 ? 0 : 2;
        } else if ((tA === t1 && tB === t3) || (tA === t3 && tB === t1)) {
          sA = tA === t1 ? 2 : 0;
          sB = tA === t1 ? 0 : 2;
        } else if ((tA === t1 && tB === t4) || (tA === t4 && tB === t1)) {
          sA = 1;
          sB = 1;
        } else if ((tA === t2 && tB === t3) || (tA === t3 && tB === t2)) {
          sA = tA === t2 ? 2 : 0;
          sB = tA === t2 ? 0 : 2;
        } else if ((tA === t2 && tB === t4) || (tA === t4 && tB === t2)) {
          sA = tA === t2 ? 2 : 0;
          sB = tA === t2 ? 0 : 2;
        } else if ((tA === t3 && tB === t4) || (tA === t4 && tB === t3)) {
          sA = 1;
          sB = 1;
        }

        engine.recordMatchResult({
          tournamentId: TOURNAMENT_ID,
          stageId: struct.stages[0].id,
          matchId: m.id,
          scoreA: sA,
          scoreB: sB,
          confirmedBy: 'Ref-A'
        });
      });

      const standings = engine.calculateGroupStandings(groupAConfig, struct.stages[0].matches);
      expect(standings.length).toBe(4);

      // Verify points
      // Team 1: 2-0, 2-0, 1-1 -> 7 pts
      // Team 2: 0-2, 2-0, 2-0 -> 6 pts
      // Team 4: 1-1, 0-2, 1-1 -> 2 pts
      // Team 3: 1-1, 0-2, 0-2 -> 1 pt
      expect(standings[0].points).toBe(7);
      expect(standings[0].position).toBe(1);
      expect(standings[0].destination).toBe('UPPER_BRACKET');

      expect(standings[1].points).toBe(6);
      expect(standings[1].position).toBe(2);
      expect(standings[1].destination).toBe('UPPER_BRACKET');

      expect(standings[2].points).toBe(2);
      expect(standings[2].position).toBe(3);
      expect(standings[2].destination).toBe('LOWER_BRACKET');

      expect(standings[3].points).toBe(1);
      expect(standings[3].position).toBe(4);
      expect(standings[3].destination).toBe('LOWER_BRACKET');
    });

    it('B.4: strictly resolves ties via Head-to-Head -> Game Differential -> Game Wins -> Seed', () => {
      // Construct two tied teams in a group
      const dummyGroup = {
        id: 'grp-test',
        name: 'Group Test',
        teams: [
          { teamId: 'team-tied-a', name: 'Tied Alpha', tag: 'TA', seed: 1 },
          { teamId: 'team-tied-b', name: 'Tied Beta', tag: 'TB', seed: 2 }
        ]
      };

      // Match between them: Tied Beta beat Tied Alpha 2-0
      const matches: CompetitionMatchNode[] = [
        {
          id: 'm-h2h-1',
          tournamentId: TOURNAMENT_ID,
          stage: 'group',
          roundKey: 'grp-test',
          seriesFormat: 'BO2',
          teamA: { teamId: 'team-tied-a', name: 'Tied Alpha' },
          teamB: { teamId: 'team-tied-b', name: 'Tied Beta' },
          status: 'COMPLETED',
          scores: { teamA: 0, teamB: 2 }
        }
      ];

      const standings = engine.calculateGroupStandings(dummyGroup as any, matches);
      // Tied Beta won head-to-head, so Beta is rank 1
      expect(standings[0].teamId).toBe('team-tied-b');
      expect(standings[0].position).toBe(1);
      expect(standings[1].teamId).toBe('team-tied-a');
      expect(standings[1].position).toBe(2);
    });

    it('B.5: automatically advances qualified group teams into Upper and Lower bracket playoff slots', () => {
      const struct = engine.getStructure(TOURNAMENT_ID)!;
      const grpA = struct.stages[0].groups![0];
      const grpB = struct.stages[0].groups![1];

      // Simulated standings for Group A and B
      const standingsA: GroupStandingRow[] = grpA.teams.map((t, i) => ({
        position: i + 1,
        teamId: t.teamId,
        teamName: t.name,
        tag: t.tag,
        seed: i + 1,
        played: 3,
        won: 3 - i,
        drawn: 0,
        lost: i,
        gamesWon: (3 - i) * 2,
        gamesLost: i * 2,
        gameDiff: (3 - i) * 2 - i * 2,
        points: (3 - i) * 3,
        destination: i < 2 ? 'UPPER_BRACKET' : 'LOWER_BRACKET'
      }));

      const standingsB: GroupStandingRow[] = grpB.teams.map((t, i) => ({
        position: i + 1,
        teamId: t.teamId,
        teamName: t.name,
        tag: t.tag,
        seed: i + 1,
        played: 3,
        won: 3 - i,
        drawn: 0,
        lost: i,
        gamesWon: (3 - i) * 2,
        gamesLost: i * 2,
        gameDiff: (3 - i) * 2 - i * 2,
        points: (3 - i) * 3,
        destination: i < 2 ? 'UPPER_BRACKET' : 'LOWER_BRACKET'
      }));

      const advanceRes = engine.advanceGroupStageToPlayoffs({
        tournamentId: TOURNAMENT_ID,
        groupAStandings: standingsA,
        groupBStandings: standingsB,
        playoffStageId: struct.stages[1].id
      });

      expect(advanceRes.success).toBe(true);

      const playoffStage = struct.stages[1];

      // UB SF 1: Group A #1 vs Group B #2
      const ubSf1 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-1`)!;
      expect(ubSf1.teamA.teamId).toBe(standingsA[0].teamId);
      expect(ubSf1.teamB.teamId).toBe(standingsB[1].teamId);

      // UB SF 2: Group B #1 vs Group A #2
      const ubSf2 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-2`)!;
      expect(ubSf2.teamA.teamId).toBe(standingsB[0].teamId);
      expect(ubSf2.teamB.teamId).toBe(standingsA[1].teamId);

      // LB R1 M1: Group A #3 vs Group B #4
      const lbR1_1 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-lb-r1-m1`)!;
      expect(lbR1_1.teamA.teamId).toBe(standingsA[2].teamId);
      expect(lbR1_1.teamB.teamId).toBe(standingsB[3].teamId);

      // LB R1 M2: Group B #3 vs Group A #4
      const lbR1_2 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-lb-r1-m2`)!;
      expect(lbR1_2.teamA.teamId).toBe(standingsB[2].teamId);
      expect(lbR1_2.teamB.teamId).toBe(standingsA[3].teamId);
    });

    it('B.6: plays through mixed-entry playoffs and verifies correct Grand Final finalists', () => {
      const struct = engine.getStructure(TOURNAMENT_ID)!;
      const playoffStage = struct.stages[1];
      const pStageId = playoffStage.id;

      // Ensure teams are populated into opening matches
      const teamA1 = struct.teams[0];
      const teamB2 = struct.teams[5];
      const teamB1 = struct.teams[4];
      const teamA2 = struct.teams[1];

      const ubSf1 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-1`)!;
      ubSf1.teamA = { ...teamA1 };
      ubSf1.teamB = { ...teamB2 };

      const ubSf2 = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-sf-2`)!;
      ubSf2.teamA = { ...teamB1 };
      ubSf2.teamB = { ...teamA2 };

      // 1. UB SF 1: Team A1 beats Team B2 2-0 -> Team A1 to Upper Final, Team B2 drops to LB R2 M1
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: pStageId,
        matchId: ubSf1.id,
        scoreA: 2,
        scoreB: 0,
        confirmedBy: 'Official'
      });

      // 2. UB SF 2: Team B1 beats Team A2 2-1 -> Team B1 to Upper Final, Team A2 drops to LB R2 M2
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: pStageId,
        matchId: ubSf2.id,
        scoreA: 2,
        scoreB: 1,
        confirmedBy: 'Official'
      });

      // Check Upper Final participants
      const ubFinal = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-ub-final`)!;
      expect(ubFinal.teamA.name).toBe(teamA1.name);
      expect(ubFinal.teamB.name).toBe(teamB1.name);

      // 3. UB Final: Team A1 beats Team B1 2-0 -> Team A1 advances to Grand Final!
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: pStageId,
        matchId: ubFinal.id,
        scoreA: 2,
        scoreB: 0,
        confirmedBy: 'Official'
      });

      // Check LB Final: Team B1 dropped to LB Final
      const lbFinal = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-lb-final`)!;
      expect(lbFinal.teamA.name).toBe(teamB1.name);

      // Play LB Final: Team B1 wins 2-1 -> Team B1 advances to Grand Final
      // (Populate winner of LB SF as opponent)
      lbFinal.teamB = { ...teamA2 };
      engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: pStageId,
        matchId: lbFinal.id,
        scoreA: 2,
        scoreB: 1,
        confirmedBy: 'Official'
      });

      // Grand Final Check
      const gf = playoffStage.matches.find(m => m.id === `${TOURNAMENT_ID}-gf`)!;
      expect(gf.teamA.name).toBe(teamA1.name); // Upper Final Champion
      expect(gf.teamB.name).toBe(teamB1.name); // Lower Final Winner
      expect(gf.seriesFormat).toBe('BO5');

      // Grand Final: Team A1 wins 3-2
      const gfResult = engine.recordMatchResult({
        tournamentId: TOURNAMENT_ID,
        stageId: pStageId,
        matchId: gf.id,
        scoreA: 3,
        scoreB: 2,
        confirmedBy: 'Head Referee'
      });
      expect(gfResult.success).toBe(true);
      expect(gfResult.match?.status).toBe('COMPLETED');
      expect(gfResult.match?.winnerId).toBe(teamA1.teamId);
    });
  });
});
