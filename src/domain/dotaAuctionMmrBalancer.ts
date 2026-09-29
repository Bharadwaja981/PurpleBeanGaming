/**
 * Purple Bean Gaming — MMR-Balanced Auction Purse Engine
 * 
 * Rules:
 * - Higher Tournament MMR captain → fewer starting credits
 * - Lower Tournament MMR captain → more starting credits
 * - Strictly uses ONLY each captain's LOCKED TOURNAMENT MMR.
 * - Does NOT use: Declared MMR, OpenDota estimate, or Purple Bean Rating.
 * 
 * Config:
 * - Credit Allocation: CAPTAIN_MMR_BALANCED (default) or EQUAL
 * - Base Credits: 1000
 * - Adjustment Rate: 0.25 credits per MMR (100 credits per 400 MMR diff)
 * - Clamp: 800–1200
 * - Increment / Rounding: 10
 * - Deterministic normalization so total credits === 1000 * number of teams.
 */

export type CreditAllocationMode = 'EQUAL' | 'CAPTAIN_MMR_BALANCED';

export interface CaptainMmrInput {
  captainId: string;
  captainIgn: string;
  teamId: string;
  teamName: string;
  tournamentMmr: number | undefined;
  isMmrLocked?: boolean;
}

export interface CaptainMmrAllocationEntry {
  captainId: string;
  captainIgn: string;
  teamId: string;
  teamName: string;
  tournamentMmr: number;
  mmrDiffFromAvg: number; // e.g. +183 or -217
  rawCredits: number;
  clampedCredits: number;
  finalStartingCredits: number;
}

export interface AuctionPurseAllocationAudit {
  tournamentId: string;
  allocationVersion: number;
  allocationMode: CreditAllocationMode;
  baseCredits: number;
  adjustmentRate: number;
  minimumCredits: number;
  maximumCredits: number;
  creditRounding: number;
  captainCount: number;
  averageCaptainMmr: number;
  totalCredits: number;
  targetTotalCredits: number;
  timestamp: string;
  calculatedBy: string;
  entries: CaptainMmrAllocationEntry[];
  isFrozen: boolean;
  frozenAt?: string;
  hasBidsStarted: boolean;
}

export interface MmrBalanceResult {
  success: boolean;
  error?: string;
  blockingCaptain?: { id: string; name: string };
  audit?: AuctionPurseAllocationAudit;
}

export const EXPLANATION_TEXT = 
  "Starting auction credits are balanced using each captain's verified Tournament MMR. Stronger captains receive a smaller purse because the captain already occupies one of the team's five roster slots.";

/**
 * Calculates MMR-balanced starting purses for auction tournament teams.
 */
export function calculateMmrBalancedPurses(params: {
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
}): MmrBalanceResult {
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
  } = params;

  if (!captains || captains.length === 0) {
    return {
      success: false,
      error: 'Cannot calculate purses: No captain teams registered.'
    };
  }

  // 1. Strict Validation: Every captain must possess a verified, locked Tournament MMR
  for (const cap of captains) {
    const hasValidMmr = typeof cap.tournamentMmr === 'number' && cap.tournamentMmr > 0;
    const isLocked = Boolean(cap.isMmrLocked);

    if (!hasValidMmr || !isLocked) {
      return {
        success: false,
        error: `Captain '${cap.captainIgn}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`,
        blockingCaptain: {
          id: cap.captainId,
          name: cap.captainIgn
        }
      };
    }
  }

  const numTeams = captains.length;
  const targetTotalCredits = baseCredits * numTeams;

  // 2. EQUAL Mode calculation
  if (mode === 'EQUAL') {
    const sumMmr = captains.reduce((acc, c) => acc + (c.tournamentMmr || 0), 0);
    const avgMmr = Math.round(sumMmr / numTeams);

    const entries: CaptainMmrAllocationEntry[] = captains.map(cap => {
      const mmr = cap.tournamentMmr!;
      return {
        captainId: cap.captainId,
        captainIgn: cap.captainIgn,
        teamId: cap.teamId,
        teamName: cap.teamName,
        tournamentMmr: mmr,
        mmrDiffFromAvg: mmr - avgMmr,
        rawCredits: baseCredits,
        clampedCredits: baseCredits,
        finalStartingCredits: baseCredits
      };
    });

    const audit: AuctionPurseAllocationAudit = {
      tournamentId,
      allocationVersion,
      allocationMode: 'EQUAL',
      baseCredits,
      adjustmentRate,
      minimumCredits,
      maximumCredits,
      creditRounding,
      captainCount: numTeams,
      averageCaptainMmr: avgMmr,
      totalCredits: targetTotalCredits,
      targetTotalCredits,
      timestamp: new Date().toISOString(),
      calculatedBy,
      entries,
      isFrozen: false,
      hasBidsStarted: false
    };

    return { success: true, audit };
  }

  // 3. CAPTAIN_MMR_BALANCED Mode calculation
  const totalMmr = captains.reduce((acc, c) => acc + (c.tournamentMmr || 0), 0);
  const averageCaptainMmrFloat = totalMmr / numTeams;
  const averageCaptainMmr = Math.round(averageCaptainMmrFloat * 100) / 100;

  // Step 3a: Calculate raw credits and clamp/round
  interface IntermediateEntry {
    captainId: string;
    captainIgn: string;
    teamId: string;
    teamName: string;
    tournamentMmr: number;
    mmrDiffFromAvg: number; // captainMmr - averageCaptainMmr
    rawCredits: number;
    clampedCredits: number;
    roundedCredits: number;
    remainder: number; // clampedCredits - roundedCredits
  }

  const intermediate: IntermediateEntry[] = captains.map(cap => {
    const mmr = cap.tournamentMmr!;
    // mmrDiffFromAvg: positive when captain MMR is higher than average
    const diff = Math.round(mmr - averageCaptainMmrFloat);
    
    // Higher Tournament MMR captain → fewer starting credits
    // Lower Tournament MMR captain → more starting credits
    // rawCredits = 1000 + ((averageCaptainMmr - captainMmr) * 0.25)
    const rawCredits = baseCredits + ((averageCaptainMmrFloat - mmr) * adjustmentRate);
    
    // 1. Clamp to minimumCredits - maximumCredits (800-1200)
    const clampedCredits = Math.min(maximumCredits, Math.max(minimumCredits, rawCredits));
    
    // 2. Round to nearest creditRounding (10)
    const roundedCredits = Math.round(clampedCredits / creditRounding) * creditRounding;
    
    // Remainder: positive means rounded DOWN (under-allocated); negative means rounded UP (over-allocated)
    const remainder = clampedCredits - roundedCredits;

    return {
      captainId: cap.captainId,
      captainIgn: cap.captainIgn,
      teamId: cap.teamId,
      teamName: cap.teamName,
      tournamentMmr: mmr,
      mmrDiffFromAvg: diff,
      rawCredits: Math.round(rawCredits * 100) / 100,
      clampedCredits: Math.round(clampedCredits * 100) / 100,
      roundedCredits,
      remainder
    };
  });

  // Step 3b: Deterministic normalization so total starting credits exactly equal targetTotalCredits
  let currentSum = intermediate.reduce((acc, e) => acc + e.roundedCredits, 0);
  let discrepancy = targetTotalCredits - currentSum; // Multiple of creditRounding (10)

  // Copy rounded credits to final working map
  const finalMap = new Map<string, number>();
  intermediate.forEach(e => finalMap.set(e.captainId, e.roundedCredits));

  if (discrepancy > 0) {
    // We need to add credits in increments of creditRounding
    // Priority order:
    // 1) Largest positive remainder (lost the most in rounding down)
    // 2) Lower tournament MMR (lower MMR needs more credits in balanced system)
    // 3) Deterministic tie-breaker by captainId
    const candidates = [...intermediate].filter(e => {
      const cur = finalMap.get(e.captainId)!;
      return cur + creditRounding <= maximumCredits;
    });

    candidates.sort((a, b) => {
      if (Math.abs(b.remainder - a.remainder) > 0.001) {
        return b.remainder - a.remainder; // Highest positive remainder first
      }
      if (a.tournamentMmr !== b.tournamentMmr) {
        return a.tournamentMmr - b.tournamentMmr; // Lower MMR gets priority
      }
      return a.captainId.localeCompare(b.captainId);
    });

    let idx = 0;
    while (discrepancy > 0 && candidates.length > 0) {
      const targetCandidate = candidates[idx % candidates.length];
      const curVal = finalMap.get(targetCandidate.captainId)!;
      if (curVal + creditRounding <= maximumCredits) {
        finalMap.set(targetCandidate.captainId, curVal + creditRounding);
        discrepancy -= creditRounding;
      }
      idx++;
      if (idx > candidates.length * 20) break; // Safeguard
    }
  } else if (discrepancy < 0) {
    // We need to subtract credits in increments of creditRounding
    // Priority order:
    // 1) Most negative remainder (gained the most in rounding up)
    // 2) Higher tournament MMR (higher MMR gets less credits in balanced system)
    // 3) Deterministic tie-breaker by captainId
    const candidates = [...intermediate].filter(e => {
      const cur = finalMap.get(e.captainId)!;
      return cur - creditRounding >= minimumCredits;
    });

    candidates.sort((a, b) => {
      if (Math.abs(a.remainder - b.remainder) > 0.001) {
        return a.remainder - b.remainder; // Most negative remainder first
      }
      if (a.tournamentMmr !== b.tournamentMmr) {
        return b.tournamentMmr - a.tournamentMmr; // Higher MMR gets deducted first
      }
      return a.captainId.localeCompare(b.captainId);
    });

    let idx = 0;
    while (discrepancy < 0 && candidates.length > 0) {
      const targetCandidate = candidates[idx % candidates.length];
      const curVal = finalMap.get(targetCandidate.captainId)!;
      if (curVal - creditRounding >= minimumCredits) {
        finalMap.set(targetCandidate.captainId, curVal - creditRounding);
        discrepancy += creditRounding;
      }
      idx++;
      if (idx > candidates.length * 20) break; // Safeguard
    }
  }

  // Build final entries
  const entries: CaptainMmrAllocationEntry[] = intermediate.map(e => ({
    captainId: e.captainId,
    captainIgn: e.captainIgn,
    teamId: e.teamId,
    teamName: e.teamName,
    tournamentMmr: e.tournamentMmr,
    mmrDiffFromAvg: e.mmrDiffFromAvg,
    rawCredits: e.rawCredits,
    clampedCredits: e.clampedCredits,
    finalStartingCredits: finalMap.get(e.captainId) || e.roundedCredits
  }));

  const finalTotal = entries.reduce((acc, e) => acc + e.finalStartingCredits, 0);

  const audit: AuctionPurseAllocationAudit = {
    tournamentId,
    allocationVersion,
    allocationMode: 'CAPTAIN_MMR_BALANCED',
    baseCredits,
    adjustmentRate,
    minimumCredits,
    maximumCredits,
    creditRounding,
    captainCount: numTeams,
    averageCaptainMmr: Math.round(averageCaptainMmrFloat),
    totalCredits: finalTotal,
    targetTotalCredits,
    timestamp: new Date().toISOString(),
    calculatedBy,
    entries,
    isFrozen: false,
    hasBidsStarted: false
  };

  return { success: true, audit };
}
