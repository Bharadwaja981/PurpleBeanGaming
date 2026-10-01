/**
 * Purple Bean Gaming — Dota 2 MMR-Balanced Auction Purse Engine
 * 
 * Production algorithm for balancing captain auction starting credit purses
 * based on verified and locked Tournament MMR.
 */

export type CreditAllocationMode = 'CAPTAIN_MMR_BALANCED' | 'EQUAL';

export interface CaptainMmrInput {
  captainId: string;
  captainIgn: string;
  teamId: string;
  teamName: string;
  tournamentMmr?: number;
  isMmrLocked?: boolean;
}

export interface PurseAllocationEntry {
  captainId: string;
  captainIgn: string;
  teamId: string;
  teamName: string;
  tournamentMmr: number;
  isMmrLocked: boolean;
  mmrDiffFromAvg: number;
  rawCredits: number;
  clampedCredits: number;
  finalStartingCredits: number;
}

export interface AuctionPurseAllocationAudit {
  tournamentId: string;
  allocationMode: CreditAllocationMode;
  captainCount: number;
  averageCaptainMmr: number;
  totalCredits: number;
  targetTotalCredits: number;
  baseCredits: number;
  adjustmentRate: number;
  minimumCredits: number;
  maximumCredits: number;
  creditRounding: number;
  entries: PurseAllocationEntry[];
  timestamp: string;
  calculatedBy: string;
  allocationVersion?: number;
  isFrozen?: boolean;
  frozenAt?: string;
  hasBidsStarted?: boolean;
}

export interface MmrBalanceResult {
  success: boolean;
  audit?: AuctionPurseAllocationAudit;
  error?: string;
  blockingCaptain?: { id: string; name: string };
}

export const EXPLANATION_TEXT = 
  "Starting auction credits are balanced using each captain's verified Tournament MMR. Stronger captains receive a smaller purse because the captain already occupies one of the team's five roster slots.";

export interface CalculateMmrBalancedPursesOptions {
  tournamentId: string;
  captains: CaptainMmrInput[];
  mode?: CreditAllocationMode;
  baseCredits?: number;
  adjustmentRate?: number;
  minimumCredits?: number;
  maximumCredits?: number;
  creditRounding?: number;
  allocationVersion?: number;
  calculatedBy?: string;
}

export function calculateMmrBalancedPurses(options: CalculateMmrBalancedPursesOptions): MmrBalanceResult {
  const {
    tournamentId,
    captains,
    mode = 'CAPTAIN_MMR_BALANCED',
    baseCredits = 1000,
    adjustmentRate = 0.25,
    minimumCredits = 800,
    maximumCredits = 1200,
    creditRounding = 10,
    allocationVersion = 1,
    calculatedBy = 'authoritative-server'
  } = options;

  if (!captains || captains.length === 0) {
    return {
      success: false,
      error: 'Cannot calculate purses: No captain inputs provided.'
    };
  }

  // 1. Strict verification and MMR lock check
  for (const cap of captains) {
    if (!cap.isMmrLocked || !cap.tournamentMmr || cap.tournamentMmr <= 0) {
      return {
        success: false,
        error: `Captain '${cap.captainIgn}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`,
        blockingCaptain: { id: cap.captainId, name: cap.captainIgn }
      };
    }
  }

  const targetTotalCredits = baseCredits * captains.length;
  const now = new Date().toISOString();

  // EQUAL Mode
  if (mode === 'EQUAL') {
    const entries: PurseAllocationEntry[] = captains.map(cap => ({
      captainId: cap.captainId,
      captainIgn: cap.captainIgn,
      teamId: cap.teamId,
      teamName: cap.teamName,
      tournamentMmr: cap.tournamentMmr || 0,
      isMmrLocked: cap.isMmrLocked ?? true,
      mmrDiffFromAvg: 0,
      rawCredits: baseCredits,
      clampedCredits: baseCredits,
      finalStartingCredits: baseCredits
    }));

    return {
      success: true,
      audit: {
        tournamentId,
        allocationMode: 'EQUAL',
        captainCount: captains.length,
        averageCaptainMmr: Math.round(captains.reduce((acc, c) => acc + (c.tournamentMmr || 0), 0) / captains.length),
        totalCredits: targetTotalCredits,
        targetTotalCredits,
        baseCredits,
        adjustmentRate,
        minimumCredits,
        maximumCredits,
        creditRounding,
        entries,
        timestamp: now,
        calculatedBy,
        allocationVersion
      }
    };
  }

  // CAPTAIN_MMR_BALANCED Mode
  const totalMmr = captains.reduce((sum, c) => sum + (c.tournamentMmr || 0), 0);
  const averageCaptainMmr = Math.round(totalMmr / captains.length);

  type InterimEntry = PurseAllocationEntry & {
    roundError: number;
  };

  const interimEntries: InterimEntry[] = captains.map(cap => {
    const mmr = cap.tournamentMmr || 0;
    const mmrDiffFromAvg = mmr - averageCaptainMmr;
    const adjustment = mmrDiffFromAvg * adjustmentRate;
    const rawCredits = baseCredits - adjustment;
    const clampedCredits = Math.max(minimumCredits, Math.min(maximumCredits, rawCredits));
    const rounded = Math.round(clampedCredits / creditRounding) * creditRounding;
    const finalStartingCredits = Math.max(minimumCredits, Math.min(maximumCredits, rounded));

    return {
      captainId: cap.captainId,
      captainIgn: cap.captainIgn,
      teamId: cap.teamId,
      teamName: cap.teamName,
      tournamentMmr: mmr,
      isMmrLocked: cap.isMmrLocked ?? true,
      mmrDiffFromAvg,
      rawCredits,
      clampedCredits,
      finalStartingCredits,
      roundError: clampedCredits - finalStartingCredits
    };
  });

  // Balance total credits to targetTotalCredits
  let currentSum = interimEntries.reduce((acc, e) => acc + e.finalStartingCredits, 0);
  let discrepancy = targetTotalCredits - currentSum;

  if (discrepancy !== 0) {
    const step = discrepancy > 0 ? creditRounding : -creditRounding;
    // Sort by rounding error descending if positive (who was under-rounded most), or ascending if negative
    const sorted = [...interimEntries].sort((a, b) => {
      if (discrepancy > 0) {
        // Prefer lower MMR (more need) or higher roundError
        if (b.roundError !== a.roundError) return b.roundError - a.roundError;
        return a.tournamentMmr - b.tournamentMmr;
      } else {
        if (a.roundError !== b.roundError) return a.roundError - b.roundError;
        return b.tournamentMmr - a.tournamentMmr;
      }
    });

    let i = 0;
    while (discrepancy !== 0 && i < sorted.length * 10) {
      const target = sorted[i % sorted.length];
      const nextCredits = target.finalStartingCredits + step;
      if (nextCredits >= minimumCredits && nextCredits <= maximumCredits) {
        target.finalStartingCredits = nextCredits;
        discrepancy -= step;
      }
      i++;
    }
  }

  const finalEntries: PurseAllocationEntry[] = interimEntries.map(e => ({
    captainId: e.captainId,
    captainIgn: e.captainIgn,
    teamId: e.teamId,
    teamName: e.teamName,
    tournamentMmr: e.tournamentMmr,
    isMmrLocked: e.isMmrLocked,
    mmrDiffFromAvg: e.mmrDiffFromAvg,
    rawCredits: e.rawCredits,
    clampedCredits: e.clampedCredits,
    finalStartingCredits: e.finalStartingCredits
  }));

  const totalCredits = finalEntries.reduce((acc, e) => acc + e.finalStartingCredits, 0);

  return {
    success: true,
    audit: {
      tournamentId,
      allocationMode: 'CAPTAIN_MMR_BALANCED',
      captainCount: captains.length,
      averageCaptainMmr,
      totalCredits,
      targetTotalCredits,
      baseCredits,
      adjustmentRate,
      minimumCredits,
      maximumCredits,
      creditRounding,
      entries: finalEntries,
      timestamp: now,
      calculatedBy,
      allocationVersion
    }
  };
}
