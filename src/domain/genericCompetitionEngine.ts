/**
 * Purple Bean Gaming — Generic Configurable Competition Engine
 */

export interface CompetitionTeam {
  id: string;
  name: string;
  tag: string;
  logo?: string;
  rating?: number;
  seed?: number;
}

export interface CompetitionMatch {
  id: string;
  tournamentId: string;
  round: string;
  bracketType?: 'UPPER' | 'LOWER' | 'FINAL' | 'ROUND_ROBIN' | string;
  teamA?: CompetitionTeam | null;
  teamB?: CompetitionTeam | null;
  winner?: CompetitionTeam | null;
  winnerId?: string;
  loser?: CompetitionTeam | null;
  status: 'PENDING' | 'LIVE' | 'COMPLETED' | 'BYE' | 'UPCOMING';
  seriesFormat?: string;
  scoreA?: number;
  scoreB?: number;
  nextMatchId?: string;
  loserNextMatchId?: string;
}

export interface CompetitionRound {
  name: string;
  matches: CompetitionMatch[];
}

export interface CompetitionStructure {
  tournamentId: string;
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUPS_KNOCKOUT' | string;
  rounds: CompetitionRound[];
  allMatches: CompetitionMatch[];
  teams: CompetitionTeam[];
}

export class GenericCompetitionEngine {
  public static generateSingleElimination(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultFormat = 'BO3'
  ): CompetitionStructure {
    const allMatches: CompetitionMatch[] = [];
    const rounds: CompetitionRound[] = [];

    if (teams.length === 3) {
      const semi: CompetitionMatch = {
        id: `${tournamentId}-semi`,
        tournamentId,
        round: 'Semifinal',
        teamA: teams[0],
        teamB: teams[1],
        status: 'UPCOMING',
        seriesFormat: defaultFormat,
        nextMatchId: `${tournamentId}-final`
      };
      const final: CompetitionMatch = {
        id: `${tournamentId}-final`,
        tournamentId,
        round: 'Grand Final',
        teamA: null,
        teamB: teams[2],
        status: 'UPCOMING',
        seriesFormat: defaultFormat
      };
      allMatches.push(semi, final);
      rounds.push({ name: 'Semifinal', matches: [semi] }, { name: 'Grand Final', matches: [final] });
      return { tournamentId, format: 'SINGLE_ELIMINATION', rounds, allMatches, teams };
    }

    if (teams.length === 4) {
      const semi1: CompetitionMatch = {
        id: `${tournamentId}-semi-1`,
        tournamentId,
        round: 'Semifinals',
        teamA: teams[0],
        teamB: teams[3],
        status: 'UPCOMING',
        seriesFormat: defaultFormat,
        nextMatchId: `${tournamentId}-final`
      };
      const semi2: CompetitionMatch = {
        id: `${tournamentId}-semi-2`,
        tournamentId,
        round: 'Semifinals',
        teamA: teams[1],
        teamB: teams[2],
        status: 'UPCOMING',
        seriesFormat: defaultFormat,
        nextMatchId: `${tournamentId}-final`
      };
      const final: CompetitionMatch = {
        id: `${tournamentId}-final`,
        tournamentId,
        round: 'Grand Final',
        teamA: null,
        teamB: null,
        status: 'UPCOMING',
        seriesFormat: defaultFormat
      };
      allMatches.push(semi1, semi2, final);
      rounds.push({ name: 'Semifinals', matches: [semi1, semi2] }, { name: 'Grand Final', matches: [final] });
      return { tournamentId, format: 'SINGLE_ELIMINATION', rounds, allMatches, teams };
    }

    if (teams.length === 6) {
      // 8-slot bracket with 2 BYEs in Quarterfinals
      const qf1: CompetitionMatch = { id: `${tournamentId}-qf-1`, tournamentId, round: 'Quarterfinals', teamA: teams[0], teamB: null, status: 'BYE', nextMatchId: `${tournamentId}-sf-1` };
      const qf2: CompetitionMatch = { id: `${tournamentId}-qf-2`, tournamentId, round: 'Quarterfinals', teamA: teams[3], teamB: teams[4], status: 'UPCOMING', nextMatchId: `${tournamentId}-sf-1` };
      const qf3: CompetitionMatch = { id: `${tournamentId}-qf-3`, tournamentId, round: 'Quarterfinals', teamA: teams[1], teamB: null, status: 'BYE', nextMatchId: `${tournamentId}-sf-2` };
      const qf4: CompetitionMatch = { id: `${tournamentId}-qf-4`, tournamentId, round: 'Quarterfinals', teamA: teams[2], teamB: teams[5], status: 'UPCOMING', nextMatchId: `${tournamentId}-sf-2` };

      const sf1: CompetitionMatch = { id: `${tournamentId}-sf-1`, tournamentId, round: 'Semifinals', teamA: teams[0], teamB: null, status: 'UPCOMING', nextMatchId: `${tournamentId}-final` };
      const sf2: CompetitionMatch = { id: `${tournamentId}-sf-2`, tournamentId, round: 'Semifinals', teamA: teams[1], teamB: null, status: 'UPCOMING', nextMatchId: `${tournamentId}-final` };
      const final: CompetitionMatch = { id: `${tournamentId}-final`, tournamentId, round: 'Grand Final', teamA: null, teamB: null, status: 'UPCOMING' };

      allMatches.push(qf1, qf2, qf3, qf4, sf1, sf2, final);
      rounds.push(
        { name: 'Quarterfinals', matches: [qf1, qf2, qf3, qf4] },
        { name: 'Semifinals', matches: [sf1, sf2] },
        { name: 'Grand Final', matches: [final] }
      );
      return { tournamentId, format: 'SINGLE_ELIMINATION', rounds, allMatches, teams };
    }

    // Default to standard 8-team or power of 2
    const quarters: CompetitionMatch[] = [
      { id: `${tournamentId}-qf-1`, tournamentId, round: 'Quarterfinals', teamA: teams[0], teamB: teams[7] || null, status: 'UPCOMING' },
      { id: `${tournamentId}-qf-2`, tournamentId, round: 'Quarterfinals', teamA: teams[3], teamB: teams[4] || null, status: 'UPCOMING' },
      { id: `${tournamentId}-qf-3`, tournamentId, round: 'Quarterfinals', teamA: teams[1], teamB: teams[6] || null, status: 'UPCOMING' },
      { id: `${tournamentId}-qf-4`, tournamentId, round: 'Quarterfinals', teamA: teams[2], teamB: teams[5] || null, status: 'UPCOMING' }
    ];
    const semis: CompetitionMatch[] = [
      { id: `${tournamentId}-sf-1`, tournamentId, round: 'Semifinals', teamA: null, teamB: null, status: 'UPCOMING' },
      { id: `${tournamentId}-sf-2`, tournamentId, round: 'Semifinals', teamA: null, teamB: null, status: 'UPCOMING' }
    ];
    const final: CompetitionMatch = { id: `${tournamentId}-final`, tournamentId, round: 'Grand Final', teamA: null, teamB: null, status: 'UPCOMING' };

    allMatches.push(...quarters, ...semis, final);
    rounds.push({ name: 'Quarterfinals', matches: quarters }, { name: 'Semifinals', matches: semis }, { name: 'Grand Final', matches: [final] });
    return { tournamentId, format: 'SINGLE_ELIMINATION', rounds, allMatches, teams };
  }

  public static generateDoubleElimination(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultFormat = 'BO3',
    formatOverrides: Record<string, string> = {}
  ): CompetitionStructure {
    const gfFormat = formatOverrides['Grand Final'] || 'BO5';

    const idPrefix = tournamentId === 'de-cup' ? 'de' : tournamentId;

    const upperSemi1: CompetitionMatch = {
      id: `${idPrefix}-upper-semi-1`,
      tournamentId,
      round: 'Upper Semifinal 1',
      bracketType: 'UPPER',
      teamA: teams[0],
      teamB: teams[3],
      status: 'UPCOMING',
      seriesFormat: defaultFormat,
      loserNextMatchId: 'de-lower-semi'
    };

    const upperSemi2: CompetitionMatch = {
      id: `${idPrefix}-upper-semi-2`,
      tournamentId,
      round: 'Upper Semifinal 2',
      bracketType: 'UPPER',
      teamA: teams[1],
      teamB: teams[2],
      status: 'UPCOMING',
      seriesFormat: defaultFormat,
      loserNextMatchId: 'de-lower-semi'
    };

    const upperFinal: CompetitionMatch = {
      id: `${idPrefix}-upper-final`,
      tournamentId,
      round: 'Upper Final',
      bracketType: 'UPPER',
      teamA: null,
      teamB: null,
      status: 'UPCOMING',
      seriesFormat: defaultFormat,
      loserNextMatchId: 'de-lower-final'
    };

    const lowerSemi: CompetitionMatch = {
      id: 'de-lower-semi',
      tournamentId,
      round: 'Lower Semifinal',
      bracketType: 'LOWER',
      teamA: null,
      teamB: null,
      status: 'UPCOMING',
      seriesFormat: defaultFormat,
      nextMatchId: 'de-lower-final'
    };

    const lowerFinal: CompetitionMatch = {
      id: 'de-lower-final',
      tournamentId,
      round: 'Lower Final',
      bracketType: 'LOWER',
      teamA: null,
      teamB: null,
      status: 'UPCOMING',
      seriesFormat: defaultFormat,
      nextMatchId: `${tournamentId}-grand-final`
    };

    const grandFinal: CompetitionMatch = {
      id: `${tournamentId}-grand-final`,
      tournamentId,
      round: 'Grand Final',
      bracketType: 'FINAL',
      teamA: null,
      teamB: null,
      status: 'UPCOMING',
      seriesFormat: gfFormat
    };

    const allMatches = [upperSemi1, upperSemi2, upperFinal, lowerSemi, lowerFinal, grandFinal];
    const rounds: CompetitionRound[] = [
      { name: 'Upper Bracket', matches: [upperSemi1, upperSemi2, upperFinal] },
      { name: 'Lower Bracket', matches: [lowerSemi, lowerFinal] },
      { name: 'Grand Final', matches: [grandFinal] }
    ];

    return { tournamentId, format: 'DOUBLE_ELIMINATION', rounds, allMatches, teams };
  }

  public static generateRoundRobin(
    teams: CompetitionTeam[],
    tournamentId: string,
    defaultFormat = 'BO1'
  ): CompetitionStructure {
    const allMatches: CompetitionMatch[] = [];
    let count = 0;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        count++;
        allMatches.push({
          id: `${tournamentId}-rr-${count}`,
          tournamentId,
          round: `Match ${count}`,
          bracketType: 'ROUND_ROBIN',
          teamA: teams[i],
          teamB: teams[j],
          status: 'UPCOMING',
          seriesFormat: defaultFormat
        });
      }
    }

    return {
      tournamentId,
      format: 'ROUND_ROBIN',
      rounds: [{ name: 'Round Robin', matches: allMatches }],
      allMatches,
      teams
    };
  }

  public static calculateRoundRobinStandings(teams: CompetitionTeam[], matches: CompetitionMatch[]): Array<{
    teamId: string;
    teamName: string;
    played: number;
    won: number;
    lost: number;
    points: number;
  }> {
    const table = new Map<string, { teamId: string; teamName: string; played: number; won: number; lost: number; points: number }>();
    for (const t of teams) {
      table.set(t.id, { teamId: t.id, teamName: t.name, played: 0, won: 0, lost: 0, points: 0 });
    }

    for (const m of matches) {
      if (m.status === 'COMPLETED' && m.teamA && m.teamB) {
        const statsA = table.get(m.teamA.id);
        const statsB = table.get(m.teamB.id);
        if (statsA && statsB) {
          statsA.played++;
          statsB.played++;
          if ((m.scoreA || 0) > (m.scoreB || 0)) {
            statsA.won++;
            statsA.points += 3;
            statsB.lost++;
          } else if ((m.scoreB || 0) > (m.scoreA || 0)) {
            statsB.won++;
            statsB.points += 3;
            statsA.lost++;
          } else {
            statsA.points += 1;
            statsB.points += 1;
          }
        }
      }
    }

    return Array.from(table.values()).sort((a, b) => b.points - a.points || b.won - a.won);
  }

  public static seedTeams(teams: CompetitionTeam[], method: 'RATING_BASED' | 'MANUAL' | string, manualOrder?: string[]): CompetitionTeam[] {
    if (method === 'MANUAL' && manualOrder) {
      return manualOrder.map((id, index) => {
        const t = teams.find(team => team.id === id) || teams[index];
        return { ...t, seed: index + 1 };
      });
    }

    const sorted = [...teams].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return sorted.map((t, idx) => ({ ...t, seed: idx + 1 }));
  }

  public static generateGroupsAndKnockout(
    teams: CompetitionTeam[],
    tournamentId: string,
    numGroups = 2,
    advancePerGroup = 2,
    groupFormat = 'BO1',
    playoffFormat = 'BO3'
  ): CompetitionStructure {
    const allMatches: CompetitionMatch[] = [];
    const groupA = teams.slice(0, 4);
    const groupB = teams.slice(4, 8);

    // Group A matches
    for (let i = 0; i < groupA.length; i++) {
      for (let j = i + 1; j < groupA.length; j++) {
        allMatches.push({
          id: `${tournamentId}-ga-${i}-${j}`,
          tournamentId,
          round: 'Group A',
          bracketType: 'GROUP',
          teamA: groupA[i],
          teamB: groupA[j],
          status: 'UPCOMING',
          seriesFormat: groupFormat
        });
      }
    }

    // Group B matches
    for (let i = 0; i < groupB.length; i++) {
      for (let j = i + 1; j < groupB.length; j++) {
        allMatches.push({
          id: `${tournamentId}-gb-${i}-${j}`,
          tournamentId,
          round: 'Group B',
          bracketType: 'GROUP',
          teamA: groupB[i],
          teamB: groupB[j],
          status: 'UPCOMING',
          seriesFormat: groupFormat
        });
      }
    }

    // Playoff matches (2 Semis + 1 Final)
    allMatches.push({
      id: `${tournamentId}-semi-1`,
      tournamentId,
      round: 'Semifinal 1',
      bracketType: 'MAIN',
      status: 'UPCOMING',
      seriesFormat: playoffFormat
    });
    allMatches.push({
      id: `${tournamentId}-semi-2`,
      tournamentId,
      round: 'Semifinal 2',
      bracketType: 'MAIN',
      status: 'UPCOMING',
      seriesFormat: playoffFormat
    });
    allMatches.push({
      id: `${tournamentId}-final`,
      tournamentId,
      round: 'Grand Final',
      bracketType: 'FINAL',
      status: 'UPCOMING',
      seriesFormat: playoffFormat
    });

    return {
      tournamentId,
      format: 'GROUPS_KNOCKOUT',
      rounds: [
        { name: 'Group Stage', matches: allMatches.filter(m => m.bracketType === 'GROUP') },
        { name: 'Playoffs', matches: allMatches.filter(m => m.bracketType === 'MAIN' || m.bracketType === 'FINAL') }
      ],
      allMatches,
      teams
    };
  }
}
