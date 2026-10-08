/**
 * Purple Bean Gaming — Dota 2 Tiebreak Engine
 */

export interface HeadToHeadRecord {
  teamAId: string;
  teamBId: string;
  winnerTeamId?: string;
  winsA?: number;
  winsB?: number;
}

export interface TiebreakTeamStats {
  teamId: string;
  teamName?: string;
  seed?: number;
  matchWins?: number;
  matchLosses?: number;
  seriesWins?: number;
  seriesLosses?: number;
  gamesWon?: number;
  gamesLost?: number;
  points: number;
  mapsWon?: number;
  mapsLost?: number;
  headToHeadWins?: number;
  rank?: number;
}

export class DotaTiebreakEngine {
  public static resolveTiebreak(teams: TiebreakTeamStats[]): TiebreakTeamStats[] {
    return [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const h2hA = a.headToHeadWins || 0;
      const h2hB = b.headToHeadWins || 0;
      if (h2hB !== h2hA) return h2hB - h2hA;
      const diffB = (b.mapsWon || b.gamesWon || 0) - (b.mapsLost || b.gamesLost || 0);
      const diffA = (a.mapsWon || a.gamesWon || 0) - (a.mapsLost || a.gamesLost || 0);
      return diffB - diffA;
    });
  }

  public static sortStandings(teamsStats: TiebreakTeamStats[], h2h: HeadToHeadRecord[] = []): (TiebreakTeamStats & { rank: number })[] {
    const sorted = [...teamsStats].sort((a, b) => {
      // 1. Points descending
      if (b.points !== a.points) return b.points - a.points;

      // 2. Head-to-Head between tied teams
      const directH2h = h2h.find(
        r => (r.teamAId === a.teamId && r.teamBId === b.teamId) ||
             (r.teamAId === b.teamId && r.teamBId === a.teamId)
      );
      if (directH2h) {
        if (directH2h.winnerTeamId === a.teamId) return -1;
        if (directH2h.winnerTeamId === b.teamId) return 1;
        if ((directH2h.winsA ?? 0) !== (directH2h.winsB ?? 0)) {
          const aWins = directH2h.teamAId === a.teamId ? (directH2h.winsA ?? 0) : (directH2h.winsB ?? 0);
          const bWins = directH2h.teamAId === b.teamId ? (directH2h.winsA ?? 0) : (directH2h.winsB ?? 0);
          if (bWins !== aWins) return bWins - aWins;
        }
      }

      // 3. Game / Map Differential descending
      const aDiff = ((a.gamesWon ?? a.mapsWon ?? 0) - (a.gamesLost ?? a.mapsLost ?? 0));
      const bDiff = ((b.gamesWon ?? b.mapsWon ?? 0) - (b.gamesLost ?? b.mapsLost ?? 0));
      if (bDiff !== aDiff) return bDiff - aDiff;

      // 4. Total Games Won descending
      const aWon = a.gamesWon ?? a.mapsWon ?? 0;
      const bWon = b.gamesWon ?? b.mapsWon ?? 0;
      if (bWon !== aWon) return bWon - aWon;

      // 5. Seed ascending (lower seed number = higher rank)
      const aSeed = a.seed ?? 999;
      const bSeed = b.seed ?? 999;
      return aSeed - bSeed;
    });

    return sorted.map((team, idx) => ({
      ...team,
      rank: idx + 1
    }));
  }
}
