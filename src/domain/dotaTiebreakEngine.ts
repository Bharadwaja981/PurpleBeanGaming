/**
 * Purple Bean Gaming — Dota 2 Tiebreak Engine
 */

export interface HeadToHeadRecord {
  teamAId: string;
  teamBId: string;
  winsA: number;
  winsB: number;
}

export interface TiebreakTeamStats {
  teamId: string;
  points: number;
  mapsWon: number;
  mapsLost: number;
  headToHeadWins: number;
}

export class DotaTiebreakEngine {
  public static resolveTiebreak(teams: TiebreakTeamStats[]): TiebreakTeamStats[] {
    return [...teams].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.headToHeadWins !== a.headToHeadWins) return b.headToHeadWins - a.headToHeadWins;
      const diffB = b.mapsWon - b.mapsLost;
      const diffA = a.mapsWon - a.mapsLost;
      return diffB - diffA;
    });
  }
}
