/**
 * Purple Bean Gaming — Competitive Elo Rating Engine & Ledger
 */

export interface RatingAdjustmentRecord {
  matchId: string;
  winnerTeamId: string;
  loserTeamId: string;
  delta: number;
  winnerPreviousRating?: number;
  loserPreviousRating?: number;
  winnerNewRating: number;
  loserNewRating: number;
  isCorrection?: boolean;
  timestamp: string;
}

export function calculateEloDelta(winnerRating: number, loserRating: number, kFactor = 32): number {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(5, Math.round(kFactor * (1 - expectedWinner)));
}

export class CompetitiveRatingLedger {
  private appliedMatches = new Map<string, RatingAdjustmentRecord>();

  public applyMatchResult(
    matchId: string,
    winnerTeamId: string,
    loserTeamId: string,
    winnerCurrentRating: number,
    loserCurrentRating: number,
    kFactor = 32
  ): { success: boolean; alreadyApplied: boolean; record: RatingAdjustmentRecord } {
    if (this.appliedMatches.has(matchId)) {
      const existing = this.appliedMatches.get(matchId)!;
      return {
        success: true,
        alreadyApplied: true,
        record: existing
      };
    }

    const delta = calculateEloDelta(winnerCurrentRating, loserCurrentRating, kFactor);
    const record: RatingAdjustmentRecord = {
      matchId,
      winnerTeamId,
      loserTeamId,
      delta,
      winnerPreviousRating: winnerCurrentRating,
      loserPreviousRating: loserCurrentRating,
      winnerNewRating: winnerCurrentRating + delta,
      loserNewRating: Math.max(100, loserCurrentRating - delta),
      isCorrection: false,
      timestamp: new Date().toISOString()
    };

    this.appliedMatches.set(matchId, record);
    return {
      success: true,
      alreadyApplied: false,
      record
    };
  }

  public correctMatchResult(
    matchId: string,
    previousRecord: RatingAdjustmentRecord,
    newWinnerTeamId: string,
    newLoserTeamId: string,
    winnerRating: number,
    loserRating: number,
    kFactor = 32
  ): { success: boolean; record: RatingAdjustmentRecord } {
    const delta = calculateEloDelta(winnerRating, loserRating, kFactor);
    const record: RatingAdjustmentRecord = {
      matchId,
      winnerTeamId: newWinnerTeamId,
      loserTeamId: newLoserTeamId,
      delta,
      winnerPreviousRating: winnerRating,
      loserPreviousRating: loserRating,
      winnerNewRating: winnerRating + delta,
      loserNewRating: Math.max(100, loserRating - delta),
      isCorrection: true,
      timestamp: new Date().toISOString()
    };

    this.appliedMatches.set(matchId, record);
    return {
      success: true,
      record
    };
  }

  public getRecord(matchId: string): RatingAdjustmentRecord | undefined {
    return this.appliedMatches.get(matchId);
  }

  public getAllRecords(): RatingAdjustmentRecord[] {
    return Array.from(this.appliedMatches.values());
  }

  public clear(): void {
    this.appliedMatches.clear();
  }
}

export const ratingLedger = new CompetitiveRatingLedger();
