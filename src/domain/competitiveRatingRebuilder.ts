/**
 * Purple Bean Gaming — Deterministic Competitive Rating Rebuilder
 * 
 * Rebuilds all team and player ratings deterministically from canonical match history.
 * Ensures that audited result corrections, forfeits, and rematches produce an exact,
 * reproducible state without ghost points or drift.
 */

import { calculateEloDelta, RatingAdjustmentRecord } from './competitiveRatingEngine';

export interface CanonicalMatchResult {
  id: string;
  winnerTeamId: string;
  loserTeamId: string;
  isForfeit?: boolean;
  isCancelled?: boolean;
  appliedAt: string;
}

export interface RebuiltRatingState {
  teamRatings: Record<string, number>;
  totalMatchesProcessed: number;
  ledger: RatingAdjustmentRecord[];
}

export class CompetitiveRatingRebuilder {
  public static rebuildRatings(
    initialTeamRatings: Record<string, number>,
    matchHistory: CanonicalMatchResult[],
    defaultRating = 1000
  ): RebuiltRatingState {
    const currentRatings: Record<string, number> = { ...initialTeamRatings };
    const ledger: RatingAdjustmentRecord[] = [];

    // Sort chronologically
    const sorted = [...matchHistory].sort(
      (a, b) => new Date(a.appliedAt).getTime() - new Date(b.appliedAt).getTime()
    );

    let processedCount = 0;

    for (const match of sorted) {
      if (match.isCancelled) continue;
      // If forfeit and not configured to apply Elo, skip rating mutation
      if (match.isForfeit) continue;

      const winnerRating = currentRatings[match.winnerTeamId] ?? defaultRating;
      const loserRating = currentRatings[match.loserTeamId] ?? defaultRating;

      const delta = Math.max(10, calculateEloDelta(winnerRating, loserRating, 1));

      const newWinnerRating = winnerRating + delta;
      const newLoserRating = Math.max(100, loserRating - delta);

      currentRatings[match.winnerTeamId] = newWinnerRating;
      currentRatings[match.loserTeamId] = newLoserRating;

      ledger.push({
        idempotencyKey: `rebuild-${match.id}`,
        matchId: match.id,
        winnerTeamId: match.winnerTeamId,
        loserTeamId: match.loserTeamId,
        winnerPreviousRating: winnerRating,
        loserPreviousRating: loserRating,
        winnerNewRating: newWinnerRating,
        loserNewRating: newLoserRating,
        delta,
        appliedAt: match.appliedAt
      });

      processedCount++;
    }

    return {
      teamRatings: currentRatings,
      totalMatchesProcessed: processedCount,
      ledger
    };
  }
}
