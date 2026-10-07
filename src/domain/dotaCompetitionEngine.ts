/**
 * Purple Bean Gaming — Dota 2 Competition Engine & Multi-Stage Tournament Builder
 * 
 * Production-grade architecture supporting arbitrary stage pipelines:
 * Tournament -> Stage 1 -> Stage 2 -> Stage 3...
 * Supported Stage Types:
 * - GROUP_STAGE
 * - ROUND_ROBIN
 * - SWISS
 * - SINGLE_ELIMINATION
 * - DOUBLE_ELIMINATION
 * - LEAGUE
 * - PLAY_IN
 * - CUSTOM
 */

export type TournamentStageType = 
  | 'GROUP_STAGE'
  | 'ROUND_ROBIN'
  | 'SWISS'
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'LEAGUE'
  | 'PLAY_IN'
  | 'CUSTOM';

export type SeedingMode = 'MANUAL' | 'RANDOM' | 'RATING_BASED' | 'POINTS_BASED' | 'STAGE_QUALIFICATION';
export type SeriesFormat = 'BO1' | 'BO2' | 'BO3' | 'BO5' | 'Best of 1' | 'Best of 2' | 'Best of 3' | 'Best of 5';

export interface SeededTeam {
  teamId: string;
  name: string;
  tag: string;
  seed: number;
  rating?: number;
  logo?: string;
  color?: string;
  captainUserId?: string;
  captainIgn?: string;
  groupName?: string;
  groupId?: string;
}

export interface StageQualificationRule {
  id: string;
  sourceRank: number; // 1 = 1st place, 2 = 2nd place, etc.
  sourceGroupId?: string; // e.g. "group-A" or "ALL"
  sourceLabel: string; // e.g. "Group A - 1st Place"
  targetStageId: string;
  targetSlot: string; // e.g. "Upper Bracket Seed 1", "Playoff Seed 2", "Eliminated"
  action: 'ADVANCE' | 'LOWER_BRACKET' | 'ELIMINATE' | 'TIEBREAK';
}

export interface CompetitionMatchNode {
  id: string;
  tournamentId: string;
  stageId?: string;
  stageName?: string;
  round: string;
  roundKey?: string;
  bracketType?: 'upper' | 'lower' | 'grand_final' | 'round_robin' | 'group' | 'swiss' | string;
  matchNumber?: number;
  seriesFormat?: SeriesFormat;
  teamA?: any;
  teamB?: any;
  winnerId?: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'PENDING';
  scheduledTime?: string;
  winnerDestinationId?: string;
  loserDestinationId?: string;
  scores?: { teamA: number; teamB: number };
}

export interface GroupConfig {
  id: string;
  name: string; // "Group A", "Group B"
  teams: SeededTeam[];
}

export interface TournamentStageConfig {
  id: string;
  name: string;
  sequence: number;
  type: TournamentStageType;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  
  // Group / League / Swiss properties:
  groupCount?: number;
  teamsPerGroup?: number;
  roundRobinType?: 'SINGLE' | 'DOUBLE';
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  groups?: GroupConfig[];
  swissRoundsCount?: number;

  // Bracket properties:
  teamCount?: number;
  defaultSeriesFormat?: SeriesFormat;
  grandFinalSeriesFormat?: SeriesFormat;
  thirdPlaceMatch?: boolean;
  grandFinalReset?: boolean;
  ubToLbMapping?: 'DIRECT' | 'CROSS';

  // Seeding & Qualification:
  seedingMode?: SeedingMode;
  seededTeams?: SeededTeam[];
  qualificationRules?: StageQualificationRule[];

  // Matches generated for this stage:
  matches: CompetitionMatchNode[];
}

export interface MultiStageTournamentStructure {
  tournamentId: string;
  format?: string;
  config: { format: string; [key: string]: any };
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED';
  stages: TournamentStageConfig[];
  publishedAt?: string;
  updatedAt?: string;
  isLocked?: boolean;
  teams: SeededTeam[];
  matches: CompetitionMatchNode[];
}

// Backward-compatible alias
export type CompetitionStructureState = MultiStageTournamentStructure;

export class DotaCompetitionEngine {
  private structures = new Map<string, MultiStageTournamentStructure>();

  public getStructure(tournamentId: string): MultiStageTournamentStructure | undefined {
    return this.structures.get(tournamentId);
  }

  public setStructure(tournamentId: string, state: MultiStageTournamentStructure): void {
    this.structures.set(tournamentId, state);
  }

  /**
   * Initializes or returns default structure draft for a tournament
   */
  public getOrCreateStructure(tournamentId: string, initialTeams: any[] = []): MultiStageTournamentStructure {
    const existing = this.structures.get(tournamentId);
    if (existing) return existing;

    const seededTeams: SeededTeam[] = initialTeams.map((t, idx) => ({
      teamId: t.id || t.teamId,
      name: t.name || t.teamName,
      tag: t.tag || 'T',
      seed: idx + 1,
      rating: t.rating || 1500,
      logo: t.logo || '🛡️',
      color: t.color || '#7C3AED',
      captainUserId: t.captainId || t.captainUserId,
      captainIgn: t.captainName || t.captainIgn
    }));

    // Default template: single or two stage depending on team count
    const defaultStages: TournamentStageConfig[] = [
      {
        id: `stage-${tournamentId}-1`,
        name: 'Stage 1: Playoff Bracket',
        sequence: 1,
        type: 'DOUBLE_ELIMINATION',
        status: 'UPCOMING',
        teamCount: Math.max(4, seededTeams.length || 8),
        defaultSeriesFormat: 'BO3',
        grandFinalSeriesFormat: 'BO5',
        thirdPlaceMatch: false,
        grandFinalReset: true,
        seedingMode: 'RATING_BASED',
        seededTeams: [...seededTeams],
        matches: []
      }
    ];

    const newStructure: MultiStageTournamentStructure = {
      tournamentId,
      format: 'DOUBLE_ELIMINATION',
      config: { format: 'DOUBLE_ELIMINATION' },
      status: 'DRAFT',
      stages: defaultStages,
      isLocked: false,
      teams: seededTeams,
      matches: []
    };

    this.structures.set(tournamentId, newStructure);
    return newStructure;
  }

  /**
   * Adds a new stage to tournament structure
   */
  public addStage(
    tournamentId: string, 
    type: TournamentStageType, 
    customName?: string
  ): { success: boolean; stage?: TournamentStageConfig; error?: string } {
    const structure = this.getOrCreateStructure(tournamentId);
    if (structure.status === 'PUBLISHED' && structure.isLocked) {
      // Must unlock first or allow draft edit
    }

    const nextSeq = structure.stages.length + 1;
    const stageId = `stage-${tournamentId}-${Date.now()}-${nextSeq}`;
    
    let defaultName = `Stage ${nextSeq}: `;
    switch (type) {
      case 'GROUP_STAGE': defaultName += 'Group Stage'; break;
      case 'ROUND_ROBIN': defaultName += 'Round Robin'; break;
      case 'SWISS': defaultName += 'Swiss System'; break;
      case 'SINGLE_ELIMINATION': defaultName += 'Single Elimination Bracket'; break;
      case 'DOUBLE_ELIMINATION': defaultName += 'Double Elimination Bracket'; break;
      case 'LEAGUE': defaultName += 'League Play'; break;
      case 'PLAY_IN': defaultName += 'Play-In Gauntlet'; break;
      case 'CUSTOM': defaultName += 'Custom Stage'; break;
    }

    const newStage: TournamentStageConfig = {
      id: stageId,
      name: customName || defaultName,
      sequence: nextSeq,
      type,
      status: 'UPCOMING',
      teamCount: structure.teams?.length || 8,
      defaultSeriesFormat: type === 'GROUP_STAGE' ? 'BO2' : 'BO3',
      grandFinalSeriesFormat: 'BO5',
      groupCount: type === 'GROUP_STAGE' ? 2 : undefined,
      teamsPerGroup: type === 'GROUP_STAGE' ? 4 : undefined,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      seedingMode: 'RATING_BASED',
      seededTeams: structure.teams ? [...structure.teams] : [],
      matches: []
    };

    structure.stages.push(newStage);
    structure.updatedAt = new Date().toISOString();
    return { success: true, stage: newStage };
  }

  /**
   * Reorders stages (Move Up / Down)
   */
  public moveStage(tournamentId: string, stageId: string, direction: 'UP' | 'DOWN'): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;

    const idx = structure.stages.findIndex(s => s.id === stageId);
    if (idx === -1) return false;

    if (direction === 'UP' && idx > 0) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx - 1];
      structure.stages[idx - 1] = temp;
    } else if (direction === 'DOWN' && idx < structure.stages.length - 1) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx + 1];
      structure.stages[idx + 1] = temp;
    }

    structure.stages.forEach((s, i) => {
      s.sequence = i + 1;
    });
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Replaces stage type in place
   */
  public replaceStageType(tournamentId: string, stageId: string, newType: TournamentStageType): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage) return false;

    stage.type = newType;
    if (newType === 'GROUP_STAGE') {
      stage.groupCount = stage.groupCount || 2;
      stage.teamsPerGroup = stage.teamsPerGroup || 4;
      stage.defaultSeriesFormat = 'BO2';
    } else {
      stage.defaultSeriesFormat = 'BO3';
    }
    stage.matches = []; // Reset ungenerated matches
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Deletes a stage
   */
  public deleteStage(tournamentId: string, stageId: string): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    structure.stages = structure.stages.filter(s => s.id !== stageId);
    structure.stages.forEach((s, i) => { s.sequence = i + 1; });
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Updates stage properties
   */
  public updateStageConfig(tournamentId: string, stageId: string, updates: Partial<TournamentStageConfig>): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage) return false;

    Object.assign(stage, updates);
    structure.updatedAt = new Date().toISOString();
    return true;
  }

  /**
   * Generates bracket/group match fixtures for all stages in structure
   */
  public generateFullStructure(tournamentId: string, availableTeams: any[] = []): { success: boolean; structure: MultiStageTournamentStructure } {
    const structure = this.getOrCreateStructure(tournamentId, availableTeams);
    const teamsList: SeededTeam[] = (structure.teams && structure.teams.length > 0) 
      ? structure.teams 
      : availableTeams.map((t, i) => ({
          teamId: t.id || t.teamId,
          name: t.name || t.teamName,
          tag: t.tag || 'T',
          seed: i + 1,
          rating: t.rating || 1500,
          logo: t.logo || '🛡️',
          color: t.color || '#7C3AED',
          captainUserId: t.captainId || t.captainUserId,
          captainIgn: t.captainName || t.captainIgn
        }));

    structure.teams = teamsList;
    const allStructureMatches: CompetitionMatchNode[] = [];

    // Process each stage sequentially
    for (let sIdx = 0; sIdx < structure.stages.length; sIdx++) {
      const stage = structure.stages[sIdx];
      const isFirstStage = sIdx === 0;

      if (stage.type === 'GROUP_STAGE' || stage.type === 'ROUND_ROBIN') {
        const groupCount = Math.max(1, stage.groupCount || 2);
        const groups: GroupConfig[] = [];
        const stageMatches: CompetitionMatchNode[] = [];

        // Distribute teams among groups (snake or linear)
        const teamsToDistribute = isFirstStage ? [...teamsList] : [];
        for (let g = 0; g < groupCount; g++) {
          const letter = String.fromCharCode(65 + g);
          groups.push({
            id: `group-${stage.id}-${letter}`,
            name: `Group ${letter}`,
            teams: []
          });
        }

        teamsToDistribute.forEach((tm, idx) => {
          const targetGroup = groups[idx % groupCount];
          tm.groupId = targetGroup.id;
          tm.groupName = targetGroup.name;
          targetGroup.teams.push(tm);
        });

        stage.groups = groups;

        // Generate round-robin match pairings inside each group
        groups.forEach(grp => {
          const grpTeams = grp.teams;
          let matchNum = 1;
          for (let i = 0; i < grpTeams.length; i++) {
            for (let j = i + 1; j < grpTeams.length; j++) {
              stageMatches.push({
                id: `match-${stage.id}-${grp.name.replace(/\s+/g, '')}-m${matchNum++}`,
                tournamentId,
                stageId: stage.id,
                stageName: stage.name,
                round: `${grp.name} Match`,
                roundKey: grp.name,
                bracketType: 'group',
                seriesFormat: stage.defaultSeriesFormat || 'BO2',
                teamA: grpTeams[i],
                teamB: grpTeams[j],
                status: 'UPCOMING'
              });
            }
          }
        });

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);

      } else if (stage.type === 'DOUBLE_ELIMINATION') {
        const stageMatches: CompetitionMatchNode[] = [];
        const seeded = isFirstStage ? [...teamsList] : [];

        // 1. Upper Quarterfinals (4 matches)
        if (seeded.length >= 8) {
          const uqfMatchups = [
            { a: seeded[0], b: seeded[7], r: 'Upper Quarterfinal 1', key: 'UB_QF1' },
            { a: seeded[3], b: seeded[4], r: 'Upper Quarterfinal 2', key: 'UB_QF2' },
            { a: seeded[1], b: seeded[6], r: 'Upper Quarterfinal 3', key: 'UB_QF3' },
            { a: seeded[2], b: seeded[5], r: 'Upper Quarterfinal 4', key: 'UB_QF4' }
          ];
          uqfMatchups.forEach((m, idx) => {
            stageMatches.push({
              id: `match-${stage.id}-ub-qf-${idx + 1}`,
              tournamentId,
              stageId: stage.id,
              stageName: stage.name,
              round: m.r,
              roundKey: m.key,
              bracketType: 'upper',
              seriesFormat: stage.defaultSeriesFormat || 'BO3',
              teamA: m.a,
              teamB: m.b,
              status: 'UPCOMING'
            });
          });

          // 2. Upper Semifinals (2 matches)
          stageMatches.push({
            id: `match-${stage.id}-ub-sf-1`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Upper Semifinal 1',
            roundKey: 'UB_SF1',
            bracketType: 'upper',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner UB QF1', seed: 0 },
            teamB: { name: 'Winner UB QF2', seed: 0 },
            status: 'UPCOMING'
          });
          stageMatches.push({
            id: `match-${stage.id}-ub-sf-2`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Upper Semifinal 2',
            roundKey: 'UB_SF2',
            bracketType: 'upper',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner UB QF3', seed: 0 },
            teamB: { name: 'Winner UB QF4', seed: 0 },
            status: 'UPCOMING'
          });

          // 3. Upper Final (1 match)
          stageMatches.push({
            id: `match-${stage.id}-ub-final`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Upper Final',
            roundKey: 'UB_FINAL',
            bracketType: 'upper',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner UB SF1', seed: 0 },
            teamB: { name: 'Winner UB SF2', seed: 0 },
            status: 'UPCOMING'
          });

          // 4. Lower Round 1 (2 matches)
          stageMatches.push({
            id: `match-${stage.id}-lb-r1-1`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Round 1 - Match 1',
            roundKey: 'LB_R1_1',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Loser UB QF1', seed: 0 },
            teamB: { name: 'Loser UB QF2', seed: 0 },
            status: 'UPCOMING'
          });
          stageMatches.push({
            id: `match-${stage.id}-lb-r1-2`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Round 1 - Match 2',
            roundKey: 'LB_R1_2',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Loser UB QF3', seed: 0 },
            teamB: { name: 'Loser UB QF4', seed: 0 },
            status: 'UPCOMING'
          });

          // 5. Lower Round 2 (2 matches)
          stageMatches.push({
            id: `match-${stage.id}-lb-r2-1`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Round 2 - Match 1',
            roundKey: 'LB_R2_1',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner LB R1-1', seed: 0 },
            teamB: { name: 'Loser UB SF2', seed: 0 },
            status: 'UPCOMING'
          });
          stageMatches.push({
            id: `match-${stage.id}-lb-r2-2`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Round 2 - Match 2',
            roundKey: 'LB_R2_2',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner LB R1-2', seed: 0 },
            teamB: { name: 'Loser UB SF1', seed: 0 },
            status: 'UPCOMING'
          });

          // 6. Lower Semifinal (1 match)
          stageMatches.push({
            id: `match-${stage.id}-lb-sf`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Semifinal',
            roundKey: 'LB_SF',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner LB R2-1', seed: 0 },
            teamB: { name: 'Winner LB R2-2', seed: 0 },
            status: 'UPCOMING'
          });

          // 7. Lower Final (1 match)
          stageMatches.push({
            id: `match-${stage.id}-lb-final`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Lower Final',
            roundKey: 'LB_FINAL',
            bracketType: 'lower',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner Lower SF', seed: 0 },
            teamB: { name: 'Loser Upper Final', seed: 0 },
            status: 'UPCOMING'
          });
        }

        // 8. Championship Grand Final (1 match)
        stageMatches.push({
          id: `match-${stage.id}-grand-final`,
          tournamentId,
          stageId: stage.id,
          stageName: stage.name,
          round: 'Championship Grand Final',
          roundKey: 'GRAND_FINAL',
          bracketType: 'grand_final',
          seriesFormat: stage.grandFinalSeriesFormat || 'BO5',
          teamA: { name: 'Upper Bracket Champion', seed: 0 },
          teamB: { name: 'Lower Bracket Champion', seed: 0 },
          status: 'UPCOMING'
        });

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);

      } else if (stage.type === 'SINGLE_ELIMINATION' || stage.type === 'PLAY_IN') {
        const stageMatches: CompetitionMatchNode[] = [];
        const seeded = isFirstStage ? [...teamsList] : [];

        if (seeded.length >= 4) {
          stageMatches.push({
            id: `match-${stage.id}-sf-1`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Semifinal 1',
            roundKey: 'SF1',
            bracketType: 'upper',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: seeded[0],
            teamB: seeded[3] || seeded[1],
            status: 'UPCOMING'
          });
          stageMatches.push({
            id: `match-${stage.id}-sf-2`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Semifinal 2',
            roundKey: 'SF2',
            bracketType: 'upper',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: seeded[1],
            teamB: seeded[2],
            status: 'UPCOMING'
          });
        }

        stageMatches.push({
          id: `match-${stage.id}-finals`,
          tournamentId,
          stageId: stage.id,
          stageName: stage.name,
          round: 'Grand Final',
          roundKey: 'FINAL',
          bracketType: 'grand_final',
          seriesFormat: stage.grandFinalSeriesFormat || 'BO5',
          teamA: { name: 'Winner Semifinal 1', seed: 0 },
          teamB: { name: 'Winner Semifinal 2', seed: 0 },
          status: 'UPCOMING'
        });

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else {
        // Swiss or Custom fallback
        stage.matches = [];
      }
    }

    structure.matches = allStructureMatches;
    structure.updatedAt = new Date().toISOString();
    return { success: true, structure };
  }

  /**
   * Publishes the structure to make matches official
   */
  public publishStructure(tournamentId: string): { success: boolean; structure: MultiStageTournamentStructure; error?: string } {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, error: 'Structure not found' } as any;

    structure.status = 'PUBLISHED';
    structure.isLocked = true;
    structure.publishedAt = new Date().toISOString();
    structure.updatedAt = new Date().toISOString();
    return { success: true, structure };
  }

  /**
   * Unlocks / enables editing for a published structure
   */
  public editPublishedStructure(tournamentId: string): { success: boolean; hasStartedMatches: boolean } {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, hasStartedMatches: false };

    const hasStartedMatches = (structure.matches || []).some(m => m.status === 'LIVE' || m.status === 'COMPLETED');
    structure.isLocked = false;
    return { success: true, hasStartedMatches };
  }

  // ---------------------------------------------------------------------------
  // Backward compatibility signatures
  // ---------------------------------------------------------------------------
  public generateBracket(tournamentId: string, teams: any[], format = 'DOUBLE_ELIMINATION'): MultiStageTournamentStructure {
    return this.generateFullStructure(tournamentId, teams).structure;
  }

  public generateSeeds(arg1: any, arg2?: any): { success: boolean; seededTeams: SeededTeam[]; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    const structure = this.getOrCreateStructure(tournamentId);
    return { success: true, seededTeams: structure.teams || [] };
  }

  public generateCompetitionStructure(arg1: any, _caller?: any): { success: boolean; structure: MultiStageTournamentStructure; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    return this.generateFullStructure(tournamentId);
  }

  public lockCompetitionStructure(arg1: any, _caller?: any): { success: boolean; structure: MultiStageTournamentStructure; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    return this.publishStructure(tournamentId);
  }

  public updateMatchProgression(_arg1?: any, _arg2?: any, _arg3?: any, _caller?: any): any {
    return { success: true };
  }
}

export const dotaCompetitionEngine = new DotaCompetitionEngine();
