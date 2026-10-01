/**
 * Purple Bean Gaming — Battle Royale Points Engine (BGMI & PUBG)
 */

export interface BRTeamMatchResult {
  teamId: string;
  teamName: string;
  tag: string;
  placement: number;
  finishes: number;
}

export interface BRLeaderboardEntry {
  teamId: string;
  teamName: string;
  tag: string;
  totalPoints: number;
  rank: number;
  wwcdCount: number;
  placementPoints: number;
  finishPoints: number;
  matchesPlayed: number;
}

export function getPlacementPoints(placement: number): number {
  switch (placement) {
    case 1: return 10;
    case 2: return 6;
    case 3: return 5;
    case 4: return 4;
    case 5: return 3;
    case 6: return 2;
    case 7: return 1;
    case 8: return 1;
    default: return 0;
  }
}

export function calculateMatchPoints(placement: number, finishes: number): { placementPts: number; finishPts: number; total: number } {
  const placementPts = getPlacementPoints(placement);
  const finishPts = Math.max(0, finishes);
  return {
    placementPts,
    finishPts,
    total: placementPts + finishPts
  };
}

export function compileBRLeaderboard(matches: Array<{ matchId: string; results: BRTeamMatchResult[] }>): BRLeaderboardEntry[] {
  const map = new Map<string, {
    teamId: string;
    teamName: string;
    tag: string;
    totalPoints: number;
    wwcdCount: number;
    placementPoints: number;
    finishPoints: number;
    matchesPlayed: number;
  }>();

  for (const m of matches) {
    for (const r of m.results) {
      const existing = map.get(r.teamId) || {
        teamId: r.teamId,
        teamName: r.teamName,
        tag: r.tag,
        totalPoints: 0,
        wwcdCount: 0,
        placementPoints: 0,
        finishPoints: 0,
        matchesPlayed: 0
      };

      const pts = calculateMatchPoints(r.placement, r.finishes);
      existing.totalPoints += pts.total;
      existing.placementPoints += pts.placementPts;
      existing.finishPoints += pts.finishPts;
      existing.matchesPlayed += 1;
      if (r.placement === 1) {
        existing.wwcdCount += 1;
      }
      map.set(r.teamId, existing);
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wwcdCount !== a.wwcdCount) return b.wwcdCount - a.wwcdCount;
    return b.finishPoints - a.finishPoints;
  });

  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}
