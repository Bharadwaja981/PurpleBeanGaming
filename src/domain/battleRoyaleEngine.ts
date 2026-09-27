/**
 * Purple Bean Gaming — Battle Royale Competition Engine (BGMI & PUBG)
 * 
 * Supports multi-team lobbies, cumulative match leaderboards,
 * standard Indian esports scoring table (placement + finish points),
 * and Winner Winner Chicken Dinner (WWCD) tiebreaks.
 */

export interface BRTeamMatchResult {
  teamId: string;
  teamName: string;
  tag: string;
  placement: number; // 1 to 16
  finishes: number; // Kills
}

export interface BRLeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  tag: string;
  matchesPlayed: number;
  wwcdCount: number; // Chicken Dinners
  placementPoints: number;
  finishPoints: number;
  totalPoints: number;
}

export const OFFICIAL_BR_PLACEMENT_POINTS: Record<number, number> = {
  1: 10, // WWCD
  2: 6,
  3: 5,
  4: 4,
  5: 3,
  6: 2,
  7: 1,
  8: 1,
  9: 0,
  10: 0,
  11: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0,
  16: 0
};

export function calculateMatchPoints(placement: number, finishes: number): { placementPts: number; finishPts: number; total: number } {
  const placementPts = OFFICIAL_BR_PLACEMENT_POINTS[placement] ?? 0;
  const finishPts = Math.max(0, finishes);
  return {
    placementPts,
    finishPts,
    total: placementPts + finishPts
  };
}

export function compileBRLeaderboard(allMatches: Array<{ matchId: string; results: BRTeamMatchResult[] }>): BRLeaderboardEntry[] {
  const map = new Map<string, BRLeaderboardEntry>();

  for (const match of allMatches) {
    for (const res of match.results) {
      const existing = map.get(res.teamId) || {
        rank: 0,
        teamId: res.teamId,
        teamName: res.teamName,
        tag: res.tag,
        matchesPlayed: 0,
        wwcdCount: 0,
        placementPoints: 0,
        finishPoints: 0,
        totalPoints: 0
      };

      const pts = calculateMatchPoints(res.placement, res.finishes);
      existing.matchesPlayed += 1;
      if (res.placement === 1) {
        existing.wwcdCount += 1;
      }
      existing.placementPoints += pts.placementPts;
      existing.finishPoints += pts.finishPts;
      existing.totalPoints += pts.total;

      map.set(res.teamId, existing);
    }
  }

  // Sort by official tiebreak: 1) Total Points, 2) WWCDs, 3) Placement Points, 4) Finish Points
  const list = Array.from(map.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wwcdCount !== a.wwcdCount) return b.wwcdCount - a.wwcdCount;
    if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
    return b.finishPoints - a.finishPoints;
  });

  return list.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
}
