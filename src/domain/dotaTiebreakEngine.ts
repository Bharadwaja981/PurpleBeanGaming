/**
 * Purple Bean Gaming — Deterministic Dota 2 Tiebreak Engine
 * 
 * Computes deterministic standings order using standard competitive tiebreak hierarchy:
 * 1. Points / Match Wins
 * 2. Head-to-Head record between tied teams
 * 3. Series Win Differential
 * 4. Game / Map Differential (Games Won - Games Lost)
 * 5. Total Game Wins
 * 6. Lower seed number (tiebreak fallback)
 */

export interface TiebreakTeamStats {
  teamId: string;
  teamName: string;
  seed: number;
  matchWins: number;
  matchLosses: number;
  seriesWins: number;
  seriesLosses: number;
  gamesWon: number;
  gamesLost: number;
  points: number;
}

export interface HeadToHeadRecord {
  teamAId: string;
  teamBId: string;
  winnerTeamId: string;
}

export class DotaTiebreakEngine {
  public static sortStandings(
    teams: TiebreakTeamStats[],
    headToHeadResults: HeadToHeadRecord[] = []
  ): Array<TiebreakTeamStats & { rank: number; tiebreakNote?: string }> {
    const list = [...teams];

    list.sort((a, b) => {
      // 1. Points
      if (b.points !== a.points) {
        return b.points - a.points;
      }

      // 2. Match Wins
      if (b.matchWins !== a.matchWins) {
        return b.matchWins - a.matchWins;
      }

      // 3. Head-to-Head (if exactly two teams tied)
      const h2h = headToHeadResults.find(
        h => (h.teamAId === a.teamId && h.teamBId === b.teamId) ||
             (h.teamAId === b.teamId && h.teamBId === a.teamId)
      );
      if (h2h) {
        if (h2h.winnerTeamId === a.teamId) return -1;
        if (h2h.winnerTeamId === b.teamId) return 1;
      }

      // 4. Game Differential
      const diffA = a.gamesWon - a.gamesLost;
      const diffB = b.gamesWon - b.gamesLost;
      if (diffB !== diffA) {
        return diffB - diffA;
      }

      // 5. Total Games Won
      if (b.gamesWon !== a.gamesWon) {
        return b.gamesWon - a.gamesWon;
      }

      // 6. Seed Fallback
      return a.seed - b.seed;
    });

    return list.map((team, idx) => ({
      ...team,
      rank: idx + 1
    }));
  }
}
