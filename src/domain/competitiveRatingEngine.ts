/**
 * Purple Bean Gaming — Competitive Rating Engine (Idempotent & Auditable)
 * 
 * Preserves deterministic Elo/MMR adjustments while guaranteeing idempotency.
 * Repeated executions for the same match ID return the committed delta
 * without double-crediting ratings.
 */

export interface RatingAdjustmentRecord {
  idempotencyKey: string;
  matchId: string;
  winnerTeamId: string;
  loserTeamId: string;
  winnerPreviousRating: number;
  loserPreviousRating: number;
  winnerNewRating: number;
  loserNewRating: number;
  delta: number;
  appliedAt: string;
  isCorrection?: boolean;
}

export function calculateEloDelta(ratingA: number, ratingB: number, scoreA: number, kFactor = 32): number {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const actualA = scoreA; // 1 for win, 0 for loss
  return Math.round(kFactor * (actualA - expectedA));
}

export class CompetitiveRatingLedger {
  private appliedLedger = new Map<string, RatingAdjustmentRecord>();

  public applyMatchResult(
    matchId: string,
    winnerTeamId: string,
    loserTeamId: string,
    winnerRating: number,
    loserRating: number,
    idempotencyKey = `rating-${matchId}`
  ): { success: boolean; record: RatingAdjustmentRecord; alreadyApplied: boolean } {
    // Idempotency check: if this match or key was already applied, return existing record
    if (this.appliedLedger.has(idempotencyKey)) {
      return {
        success: true,
        record: this.appliedLedger.get(idempotencyKey)!,
        alreadyApplied: true
      };
    }

    const delta = Math.max(10, calculateEloDelta(winnerRating, loserRating, 1));
    const record: RatingAdjustmentRecord = {
      idempotencyKey,
      matchId,
      winnerTeamId,
      loserTeamId,
      winnerPreviousRating: winnerRating,
      loserPreviousRating: loserRating,
      winnerNewRating: winnerRating + delta,
      loserNewRating: Math.max(100, loserRating - delta),
      delta,
      appliedAt: new Date().toISOString()
    };

    this.appliedLedger.set(idempotencyKey, record);
    return {
      success: true,
      record,
      alreadyApplied: false
    };
  }

  public correctMatchResult(
    matchId: string,
    originalRecord: RatingAdjustmentRecord,
    newWinnerTeamId: string,
    newLoserTeamId: string,
    currentWinnerRating: number,
    currentLoserRating: number
  ): { success: boolean; record: RatingAdjustmentRecord } {
    // Rollback original delta first
    const rolledBackWinnerRating = currentWinnerRating - originalRecord.delta;
    const rolledBackLoserRating = currentLoserRating + originalRecord.delta;

    const correctionKey = `correction-${matchId}-${Date.now()}`;
    const newDelta = Math.max(10, calculateEloDelta(rolledBackWinnerRating, rolledBackLoserRating, 1));

    const correctionRecord: RatingAdjustmentRecord = {
      idempotencyKey: correctionKey,
      matchId,
      winnerTeamId: newWinnerTeamId,
      loserTeamId: newLoserTeamId,
      winnerPreviousRating: rolledBackWinnerRating,
      loserPreviousRating: rolledBackLoserRating,
      winnerNewRating: rolledBackWinnerRating + newDelta,
      loserNewRating: Math.max(100, rolledBackLoserRating - newDelta),
      delta: newDelta,
      appliedAt: new Date().toISOString(),
      isCorrection: true
    };

    this.appliedLedger.set(correctionKey, correctionRecord);
    return {
      success: true,
      record: correctionRecord
    };
  }

  public getRecord(idempotencyKey: string): RatingAdjustmentRecord | undefined {
    return this.appliedLedger.get(idempotencyKey);
  }

  public getAllRecords(): RatingAdjustmentRecord[] {
    return Array.from(this.appliedLedger.values());
  }

  public getAuditHistory(): RatingAdjustmentRecord[] {
    return this.getAllRecords();
  }

  public clear(): void {
    this.appliedLedger.clear();
  }
}

export const ratingLedger = new CompetitiveRatingLedger();
