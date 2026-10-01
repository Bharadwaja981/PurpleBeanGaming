/**
 * Purple Bean Gaming — Dota 2 Competition Engine
 */

export type SeedingMode = 'MANUAL' | 'RANDOM' | 'RATING_BASED' | 'POINTS_BASED';
export type SeriesFormat = 'BO1' | 'BO3' | 'BO5' | 'Best of 1' | 'Best of 3' | 'Best of 5';

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
}

export interface CompetitionMatchNode {
  id: string;
  tournamentId: string;
  round: string;
  roundKey?: string;
  bracketType?: 'upper' | 'lower' | 'grand_final' | 'round_robin' | string;
  matchNumber?: number;
  seriesFormat?: SeriesFormat;
  teamA?: any;
  teamB?: any;
  winnerId?: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'PENDING';
  scheduledTime?: string;
  winnerDestinationId?: string;
  loserDestinationId?: string;
}

export interface CompetitionStructureState {
  tournamentId: string;
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUPS_KNOCKOUT' | string;
  config: { format: string; [key: string]: any };
  seedingMode: SeedingMode;
  teams: SeededTeam[];
  matches: CompetitionMatchNode[];
  isLocked?: boolean;
}

export class DotaCompetitionEngine {
  private structures = new Map<string, CompetitionStructureState>();

  public getStructure(tournamentId: string): CompetitionStructureState | undefined {
    return this.structures.get(tournamentId);
  }

  public setStructure(tournamentId: string, state: CompetitionStructureState): void {
    this.structures.set(tournamentId, state);
  }

  public generateBracket(
    tournamentId: string,
    teams: any[],
    format: string = 'SINGLE_ELIMINATION',
    seedingMode: SeedingMode = 'RATING_BASED'
  ): CompetitionStructureState {
    const seededTeams: SeededTeam[] = teams.map((t, idx) => ({
      teamId: t.id || t.teamId,
      name: t.name || t.teamName,
      tag: t.tag || 'T',
      seed: idx + 1,
      rating: t.rating || 1500,
      logo: t.logo,
      color: t.color,
      captainUserId: t.captainId || t.captainUserId,
      captainIgn: t.captainName || t.captainIgn
    }));

    const matches: CompetitionMatchNode[] = [];
    if (seededTeams.length >= 2) {
      matches.push({
        id: `match-${tournamentId}-1`,
        tournamentId,
        round: 'Semifinal 1',
        bracketType: 'upper',
        seriesFormat: 'BO3',
        teamA: seededTeams[0],
        teamB: seededTeams[seededTeams.length - 1],
        status: 'UPCOMING'
      });
      matches.push({
        id: `match-${tournamentId}-finals`,
        tournamentId,
        round: 'Grand Final',
        bracketType: 'grand_final',
        seriesFormat: 'BO3',
        teamA: { name: 'Winner SF1', seed: 0 },
        teamB: seededTeams[1] || { name: 'Winner SF2', seed: 0 },
        status: 'UPCOMING'
      });
    }

    const state: CompetitionStructureState = {
      tournamentId,
      format,
      config: { format },
      seedingMode,
      teams: seededTeams,
      matches,
      isLocked: false
    };

    this.structures.set(tournamentId, state);
    return state;
  }

  public generateSeeds(arg1: any, arg2?: any, _arg3?: any, _caller?: any): { success: boolean; seededTeams: SeededTeam[]; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    const mode = typeof arg1 === 'object' ? arg1.seedingMode : arg2;
    const existing = this.structures.get(tournamentId);
    const seededTeams: SeededTeam[] = (existing?.teams || []).map((t, i) => ({ ...t, seed: i + 1 }));
    return { success: true, seededTeams };
  }

  public generateCompetitionStructure(arg1: any, _arg2?: any): { success: boolean; structure: CompetitionStructureState; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    let s = this.structures.get(tournamentId);
    if (!s) {
      s = this.generateBracket(tournamentId, []);
    }
    return { success: true, structure: s };
  }

  public lockCompetitionStructure(arg1: any, _caller?: any): { success: boolean; structure: CompetitionStructureState; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    let s = this.structures.get(tournamentId);
    if (!s) {
      s = this.generateBracket(tournamentId, []);
    }
    s.isLocked = true;
    return { success: true, structure: s };
  }

  public updateMatchProgression(arg1: any, _arg2?: any, _arg3?: any, _caller?: any): any {
    return { success: true };
  }
}

export const dotaCompetitionEngine = new DotaCompetitionEngine();
