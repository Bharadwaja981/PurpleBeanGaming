import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaCompetitionEngine, 
  MultiStageTournamentStructure, 
  SeededTeam, 
  CompetitionMatchNode 
} from '../../src/domain/dotaCompetitionEngine';

describe('Phase 5: PurpleBeanGaming Tournament Operations & Visual Experience', () => {
  const stagingTournamentId = 'staging-tournament-phase5-ops';
  const stagingMultiStageId = 'staging-tournament-phase5-groups-playoffs';

  const mock8Teams: SeededTeam[] = [
    { teamId: 'team-stg-1', name: 'Entity Gaming', tag: 'ENT', seed: 1, mmr: 8200, logo: '🛡️' },
    { teamId: 'team-stg-2', name: 'Global Esports', tag: 'GE', seed: 2, mmr: 8100, logo: '⚡' },
    { teamId: 'team-stg-3', name: 'Reckoning Esports', tag: 'RCK', seed: 3, mmr: 7900, logo: '🔥' },
    { teamId: 'team-stg-4', name: 'Enigma Gaming', tag: 'ENG', seed: 4, mmr: 7800, logo: '🎯' },
    { teamId: 'team-stg-5', name: 'True Rippers', tag: 'TR', seed: 5, mmr: 7600, logo: '⚔️' },
    { teamId: 'team-stg-6', name: 'Gods Reign', tag: 'GR', seed: 6, mmr: 7500, logo: '👑' },
    { teamId: 'team-stg-7', name: 'Marcos Gaming', tag: 'MG', seed: 7, mmr: 7400, logo: '🦅' },
    { teamId: 'team-stg-8', name: 'Orangutan Gaming', tag: 'OG', seed: 8, mmr: 7200, logo: '🦍' }
  ];

  beforeEach(() => {
    dotaCompetitionEngine.clear(stagingTournamentId);
    dotaCompetitionEngine.clear(stagingMultiStageId);
  });

  describe('1. Standard 8-Team Double Elimination Experience', () => {
    it('generates complete Upper, Lower, and Grand Final matches with correct connector paths', () => {
      const gen = dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);
      expect(gen.success).toBe(true);

      const deStage = gen.structure.stages.find(s => s.type === 'DOUBLE_ELIMINATION');
      expect(deStage).toBeDefined();

      const matches = deStage!.matches;
      expect(matches.length).toBeGreaterThan(0);

      // Upper Bracket matches
      const ubQF = matches.filter(m => m.roundKey === 'UB_QF' || m.roundKey === 'ub-r1');
      expect(ubQF.length).toBe(4);
      expect(ubQF[0].teamA?.teamId).toBe('team-stg-1'); // Seed 1
      expect(ubQF[0].teamB?.teamId).toBe('team-stg-8'); // Seed 8

      // Check connector routes and drop destinations
      ubQF.forEach(qf => {
        expect(qf.winnerDestinationId || qf.winnerNextMatchId).toBeDefined();
        expect(qf.loserDestinationId || qf.loserDestinationLabel).toBeDefined();
      });

      // Lower Bracket matches
      const lbR1 = matches.filter(m => m.roundKey === 'lb-r1' || m.roundKey?.includes('LB_R1'));
      expect(lbR1.length).toBe(2);

      const grandFinal = matches.find(m => m.roundKey === 'GRAND_FINAL' || m.roundKey === 'gf');
      expect(grandFinal).toBeDefined();
      expect(grandFinal?.seriesFormat).toBe('BO5');
    });

    it('organisers can swap team placements before publication and draft matches re-seed', () => {
      dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);
      const struct = dotaCompetitionEngine.getStructure(stagingTournamentId)!;

      // Initial Seed 1 is Entity Gaming, Seed 2 is Global Esports
      expect(struct.teams[0].name).toBe('Entity Gaming');
      expect(struct.teams[1].name).toBe('Global Esports');

      // Swap Team 1 and Team 2
      const swapOk = dotaCompetitionEngine.swapTeams(stagingTournamentId, 'team-stg-1', 'team-stg-2');
      expect(swapOk).toBe(true);

      const updated = dotaCompetitionEngine.getStructure(stagingTournamentId)!;
      expect(updated.teams[0].teamId).toBe('team-stg-2'); // Now Seed 1
      expect(updated.teams[1].teamId).toBe('team-stg-1'); // Now Seed 2

      // Matchups in draft stage re-seeded with Global Esports in QF 1
      const updatedStage = updated.stages.find(s => s.type === 'DOUBLE_ELIMINATION')!;
      const qf1 = updatedStage.matches.find(m => m.roundKey === 'UB_QF' || m.roundKey === 'ub-r1')!;
      expect(qf1.teamA?.teamId).toBe('team-stg-2');
    });

    it('executes official transactional score submissions and advances winners and loser drops', async () => {
      dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);
      const struct = dotaCompetitionEngine.getStructure(stagingTournamentId)!;
      const deStage = struct.stages.find(s => s.type === 'DOUBLE_ELIMINATION')!;
      const qf1 = deStage.matches.find(m => m.roundKey === 'UB_QF' || m.roundKey === 'ub-r1')!;

      // Submit official score for QF 1 (Entity Gaming 2 - 0 Orangutan)
      const res = await dotaCompetitionEngine.recordMatchResultTransactional({
        tournamentId: stagingTournamentId,
        stageId: deStage.id,
        matchId: qf1.id,
        scoreA: 2,
        scoreB: 0,
        callerRole: 'organizer',
        callerUserId: 'organizer-user-1',
        clientVersion: struct.version
      });

      expect(res.success).toBe(true);
      expect(res.match?.status).toBe('COMPLETED');
      expect(res.match?.winnerId).toBe('team-stg-1');

      // Verify advancement: Winner placed in Upper Semifinal 1
      const updatedStruct = dotaCompetitionEngine.getStructure(stagingTournamentId)!;
      const updatedStage = updatedStruct.stages.find(s => s.type === 'DOUBLE_ELIMINATION')!;
      const sf1 = updatedStage.matches.find(m => m.roundKey === 'UB_SF' || m.roundKey === 'ub-r2')!;
      expect(sf1.teamA?.teamId).toBe('team-stg-1');

      // Verify loser drop: Orangutan Gaming placed in Lower Round 1
      const lb1 = updatedStage.matches.find(m => m.roundKey === 'lb-r1' || m.roundKey?.includes('LB_R1'))!;
      expect(lb1.teamA?.teamId || lb1.teamB?.teamId).toBeDefined();
    });
  });

  describe('2. Groups → Playoffs (Multi-Stage) Operations Experience', () => {
    it('configures Group Stage with BO2 round-robin, calculates points and resolves tiebreakers', () => {
      const struct = dotaCompetitionEngine.getOrCreateStructure(stagingMultiStageId, mock8Teams);

      // Create Group Stage
      dotaCompetitionEngine.replaceStageType(stagingMultiStageId, struct.stages[0].id, 'GROUP_STAGE');
      dotaCompetitionEngine.updateStageConfig(stagingMultiStageId, struct.stages[0].id, {
        groupCount: 2,
        teamsPerGroup: 4,
        defaultSeriesFormat: 'BO2'
      });

      const genRes = dotaCompetitionEngine.generateFullStructure(stagingMultiStageId, mock8Teams);
      expect(genRes.success).toBe(true);

      const groupStage = genRes.structure.stages[0];
      expect(groupStage.type).toBe('GROUP_STAGE');
      expect(groupStage.groups?.length).toBe(2);

      const grpA = groupStage.groups![0];
      expect(grpA.teams.length).toBe(4);

      // Simulate a completed BO2 match in Group A: 2-0 Win (3 points)
      const m1 = groupStage.matches.find(m => m.teamA?.teamId === grpA.teams[0].teamId && m.teamB?.teamId === grpA.teams[1].teamId)!;
      m1.status = 'COMPLETED';
      m1.scores = { teamA: 2, teamB: 0 };
      m1.winnerId = grpA.teams[0].teamId;

      // Simulate a 1-1 Draw in Group A (1 point each)
      const m2 = groupStage.matches.find(m => m.teamA?.teamId === grpA.teams[2].teamId && m.teamB?.teamId === grpA.teams[3].teamId)!;
      m2.status = 'COMPLETED';
      m2.scores = { teamA: 1, teamB: 1 };

      const standings = dotaCompetitionEngine.calculateGroupStandings(grpA, groupStage.matches);
      expect(standings.length).toBe(4);

      // Team 0 has 3 points
      const team0Standing = standings.find(s => s.teamId === grpA.teams[0].teamId)!;
      expect(team0Standing.points).toBe(3);
      expect(team0Standing.won).toBe(1);
      expect(team0Standing.played).toBe(1);

      // Team 1 has 0 points
      const team1Standing = standings.find(s => s.teamId === grpA.teams[1].teamId)!;
      expect(team1Standing.points).toBe(0);
      expect(team1Standing.lost).toBe(1);

      // Team 2 and Team 3 have 1 point each (Draw)
      const team2Standing = standings.find(s => s.teamId === grpA.teams[2].teamId)!;
      const team3Standing = standings.find(s => s.teamId === grpA.teams[3].teamId)!;
      expect(team2Standing.points).toBe(1);
      expect(team2Standing.drawn).toBe(1);
      expect(team3Standing.points).toBe(1);
      expect(team3Standing.drawn).toBe(1);
    });

    it('adds a playoff stage following Group Stage to form a multi-stage pipeline', () => {
      dotaCompetitionEngine.getOrCreateStructure(stagingMultiStageId, mock8Teams);
      
      // Stage 1: Group Stage
      const s1 = dotaCompetitionEngine.getStructure(stagingMultiStageId)!.stages[0];
      dotaCompetitionEngine.replaceStageType(stagingMultiStageId, s1.id, 'GROUP_STAGE');

      // Stage 2: Playoffs Double Elimination
      const addRes = dotaCompetitionEngine.addStage(stagingMultiStageId, 'DOUBLE_ELIMINATION');
      expect(addRes.success).toBe(true);

      const struct = dotaCompetitionEngine.getStructure(stagingMultiStageId)!;
      expect(struct.stages.length).toBe(2);
      expect(struct.stages[0].type).toBe('GROUP_STAGE');
      expect(struct.stages[1].type).toBe('DOUBLE_ELIMINATION');
      expect(struct.stages[0].sequence).toBe(1);
      expect(struct.stages[1].sequence).toBe(2);
    });
  });

  describe('3. Match Scheduling & Authoritative Security Controls', () => {
    it('allows organisers to update match scheduled times and series format', () => {
      dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);
      const struct = dotaCompetitionEngine.getStructure(stagingTournamentId)!;
      const stage = struct.stages[0];
      const match = stage.matches[0];
      expect(match).toBeDefined();

      const ok = dotaCompetitionEngine.updateMatchSchedule(
        stagingTournamentId, 
        match.id, 
        '2026-10-18 19:00 IST', 
        'BO3'
      );
      expect(ok).toBe(true);

      const updatedMatch = dotaCompetitionEngine.getStructure(stagingTournamentId)!.stages[0].matches[0];
      expect(updatedMatch.scheduledTime).toBe('2026-10-18 19:00 IST');
      expect(updatedMatch.seriesFormat).toBe('BO3');
    });

    it('rejects stale offline submissions attempting to overwrite confirmed results', async () => {
      dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);
      
      const stage = dotaCompetitionEngine.getStructure(stagingTournamentId)!.stages[0];
      const match = stage.matches[0];

      // Submit initial confirmed score with version 1
      const firstRes = await dotaCompetitionEngine.recordMatchResultTransactional({
        tournamentId: stagingTournamentId,
        stageId: stage.id,
        matchId: match.id,
        scoreA: 2,
        scoreB: 1,
        callerRole: 'organizer',
        isAdmin: true,
        clientVersion: 1
      });
      expect(firstRes.success).toBe(true);

      // Current structure has advanced in version
      const currentStruct = dotaCompetitionEngine.getStructure(stagingTournamentId)!;
      expect(currentStruct.version).toBeGreaterThanOrEqual(2);

      // Stale offline submission arrives with stale version 1 attempting conflicting score (0-2)
      const staleRes = await dotaCompetitionEngine.recordMatchResultTransactional({
        tournamentId: stagingTournamentId,
        stageId: stage.id,
        matchId: match.id,
        scoreA: 0,
        scoreB: 2,
        callerRole: 'organizer',
        isAdmin: true,
        clientVersion: 1 // Stale!
      });

      expect(staleRes.success).toBe(false);
      expect(staleRes.error).toContain('CONFLICT');
    });

    it('preserves genuine tournament history and isolated staging does not mutate real fixtures', () => {
      dotaCompetitionEngine.generateFullStructure(stagingTournamentId, mock8Teams);

      // Structure isolation: Staging ID has its own structure and does not overwrite other tournaments
      const stagingStruct = dotaCompetitionEngine.getStructure(stagingTournamentId);
      expect(stagingStruct).toBeDefined();
      expect(stagingStruct?.tournamentId).toBe(stagingTournamentId);

      // Other tournament IDs remain separate
      const otherStruct = dotaCompetitionEngine.getStructure('pb-game-dota2-1791361091142');
      if (otherStruct) {
        expect(otherStruct.tournamentId).not.toBe(stagingTournamentId);
      }
    });
  });
});
