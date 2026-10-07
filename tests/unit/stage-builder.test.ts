import { describe, it, expect } from 'vitest';
import { dotaCompetitionEngine } from '../../src/domain/dotaCompetitionEngine';

describe('Tournament Multi-Stage Architecture & Stage Builder', () => {
  const tournamentId = 'test-stage-builder-tourney';
  const dummyTeams = [
    { id: 'team-1', name: 'Team Alpha', tag: 'ALP', rating: 1900 },
    { id: 'team-2', name: 'Team Beta', tag: 'BET', rating: 1850 },
    { id: 'team-3', name: 'Team Gamma', tag: 'GAM', rating: 1800 },
    { id: 'team-4', name: 'Team Delta', tag: 'DEL', rating: 1750 },
    { id: 'team-5', name: 'Team Epsilon', tag: 'EPS', rating: 1700 },
    { id: 'team-6', name: 'Team Zeta', tag: 'ZET', rating: 1650 },
    { id: 'team-7', name: 'Team Eta', tag: 'ETA', rating: 1600 },
    { id: 'team-8', name: 'Team Theta', tag: 'THE', rating: 1550 }
  ];

  it('initializes a customizable draft structure without forcing official matches', () => {
    const structure = dotaCompetitionEngine.getOrCreateStructure(tournamentId, dummyTeams);
    expect(structure.status).toBe('DRAFT');
    expect(structure.stages.length).toBeGreaterThan(0);
    expect(structure.isLocked).toBe(false);
  });

  it('supports adding multiple varied stage types in arbitrary pipelines', () => {
    // Add a Group Stage as Stage 2
    const addRes = dotaCompetitionEngine.addStage(tournamentId, 'GROUP_STAGE', 'Stage 1: Preliminary Groups');
    expect(addRes.success).toBe(true);
    expect(addRes.stage?.type).toBe('GROUP_STAGE');

    // Add a Swiss Stage
    const swissRes = dotaCompetitionEngine.addStage(tournamentId, 'SWISS', 'Stage 2: Swiss Gauntlet');
    expect(swissRes.success).toBe(true);
    expect(swissRes.stage?.type).toBe('SWISS');

    const struct = dotaCompetitionEngine.getStructure(tournamentId)!;
    expect(struct.stages.length).toBe(3);
  });

  it('allows moving stages up and down', () => {
    const struct = dotaCompetitionEngine.getStructure(tournamentId)!;
    const stage2Id = struct.stages[1].id;

    const moveUp = dotaCompetitionEngine.moveStage(tournamentId, stage2Id, 'UP');
    expect(moveUp).toBe(true);

    const reordered = dotaCompetitionEngine.getStructure(tournamentId)!;
    expect(reordered.stages[0].id).toBe(stage2Id);
    expect(reordered.stages[0].sequence).toBe(1);
    expect(reordered.stages[1].sequence).toBe(2);
  });

  it('allows replacing stage type in-place', () => {
    const struct = dotaCompetitionEngine.getStructure(tournamentId)!;
    const targetStage = struct.stages[0];

    const replaced = dotaCompetitionEngine.replaceStageType(tournamentId, targetStage.id, 'ROUND_ROBIN');
    expect(replaced).toBe(true);
    expect(targetStage.type).toBe('ROUND_ROBIN');
  });

  it('generates structure fixtures for preview before publishing', () => {
    const res = dotaCompetitionEngine.generateFullStructure(tournamentId, dummyTeams);
    expect(res.success).toBe(true);
    expect(res.structure.status).toBe('DRAFT'); // still draft
    expect(res.structure.matches).toBeDefined();
  });

  it('publishes and locks structure, and supports safe reopening', () => {
    const pubRes = dotaCompetitionEngine.publishStructure(tournamentId);
    expect(pubRes.success).toBe(true);
    expect(pubRes.structure.status).toBe('PUBLISHED');
    expect(pubRes.structure.isLocked).toBe(true);

    const unlockRes = dotaCompetitionEngine.editPublishedStructure(tournamentId);
    expect(unlockRes.success).toBe(true);
    expect(unlockRes.hasStartedMatches).toBe(false);

    const unlocked = dotaCompetitionEngine.getStructure(tournamentId)!;
    expect(unlocked.isLocked).toBe(false);
  });
});
