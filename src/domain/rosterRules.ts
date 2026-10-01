/**
 * Purple Bean Gaming — Game-Aware Roster Rules & Stand-In Constraints
 */

export interface GameRosterConfig {
  game: string;
  primaryRosterSize: number;
  optionalStandInAllowed: boolean;
  maxStandIns: number;
  minReservePerSlot: number;
  startingCreditsINR?: number;
  minimumBidINR?: number;
  bidIncrementINR?: number;
  minReservePerSlotINR?: number;
}

export const GAME_ROSTER_CONFIGS: Record<string, GameRosterConfig> = {
  'Dota 2': {
    game: 'Dota 2',
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  },
  'Valorant': {
    game: 'Valorant',
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  },
  'Counter-Strike 2': {
    game: 'Counter-Strike 2',
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  },
  'BGMI': {
    game: 'BGMI',
    primaryRosterSize: 4,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  },
  'PUBG': {
    game: 'PUBG',
    primaryRosterSize: 4,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  }
};

export function getRosterConfigForGame(game: string): GameRosterConfig {
  const norm = Object.keys(GAME_ROSTER_CONFIGS).find(k => k.toLowerCase() === game.toLowerCase());
  if (norm && GAME_ROSTER_CONFIGS[norm]) {
    return GAME_ROSTER_CONFIGS[norm];
  }
  return {
    game,
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 10000
  };
}

export function validateBidRosterConstraint(
  purseBalance: number,
  bidAmount: number,
  currentDraftedSlots: number,
  config: GameRosterConfig
): { valid: boolean; reason?: string } {
  if (bidAmount > purseBalance) {
    return {
      valid: false,
      reason: `Insufficient purse balance: Bid amount ₹${bidAmount.toLocaleString()} exceeds available credits ₹${purseBalance.toLocaleString()}.`
    };
  }

  const unfilledSlots = Math.max(0, (config.primaryRosterSize - 1) - currentDraftedSlots);
  const minReserve = config.minReservePerSlot || 10;
  const reserveNeeded = unfilledSlots * minReserve;
  const remaining = purseBalance - bidAmount;

  if (remaining < reserveNeeded) {
    return {
      valid: false,
      reason: `Illegal bid! Team must reserve ₹${reserveNeeded.toLocaleString()} for remaining unfilled slots. Remaining credits: ₹${remaining.toLocaleString()}.`
    };
  }

  return { valid: true };
}

/**
 * Validates stand-in bidding rules:
 * 1. If total players in tournament <= (numberOfTeams * primaryRosterSize) (e.g. 10 players for 2 teams),
 *    stand-ins are strictly disallowed.
 * 2. If a team already has a full primary roster, they CANNOT bid for a stand-in until
 *    ALL other teams have their primary rosters filled.
 */
export function validateStandInConstraints(params: {
  totalPlayersInTournament: number;
  numberOfTeams: number;
  primaryRosterSize: number;
  biddingTeamName: string;
  biddingTeamPrimaryCount: number;
  biddingTeamStandInCount: number;
  maxStandInsAllowed: number;
  rivalTeams: Array<{ id: string; name: string; primaryCount: number }>;
}): { valid: boolean; reason?: string } {
  const {
    totalPlayersInTournament,
    numberOfTeams,
    primaryRosterSize,
    biddingTeamName,
    biddingTeamPrimaryCount,
    biddingTeamStandInCount,
    maxStandInsAllowed,
    rivalTeams
  } = params;

  const totalPrimarySlotsNeeded = numberOfTeams * primaryRosterSize;

  // Rule: If total contenders in tournament equals or is less than total primary slots needed
  // (e.g., exactly 10 players for 2 teams of 5), stand-ins are NOT allowed at all!
  if (totalPlayersInTournament <= totalPrimarySlotsNeeded && biddingTeamPrimaryCount >= primaryRosterSize) {
    return {
      valid: false,
      reason: `Stand-ins are not permitted in this tournament: total registered contenders (${totalPlayersInTournament}) exactly equals the primary roster requirements (${totalPrimarySlotsNeeded} slots for ${numberOfTeams} teams). No surplus players are available for stand-ins.`
    };
  }

  // If bidding team already has a full primary roster:
  if (biddingTeamPrimaryCount >= primaryRosterSize) {
    if (biddingTeamStandInCount >= maxStandInsAllowed) {
      return {
        valid: false,
        reason: `Roster Full: ${biddingTeamName} already has the maximum allowed roster (${primaryRosterSize} primary + ${maxStandInsAllowed} stand-in).`
      };
    }

    // Must check if ANY rival team still has unfilled primary slots!
    const unfilledRival = rivalTeams.find(r => r.primaryCount < primaryRosterSize);
    if (unfilledRival) {
      return {
        valid: false,
        reason: `Stand-in Bidding Locked: ${biddingTeamName} has a complete primary roster (${biddingTeamPrimaryCount}/${primaryRosterSize}), but ${unfilledRival.name} only has ${unfilledRival.primaryCount}/${primaryRosterSize} players. You cannot bid for a stand-in until all teams have filled their primary rosters.`
      };
    }
  }

  return { valid: true };
}

export interface TargetMmrConfig {
  targetTeamMmr: number;
  minTeamMmr: number; // target * 0.95
  maxTeamMmr: number; // target * 1.05
  tolerancePercent: number; // 5%
}

/**
 * Calculates Target MMR per team: total average sum of all players' MMR with +/- 5%.
 */
export function calculateTournamentTargetMmr(
  allPlayers: Array<{ tournamentMmr?: number; mmr?: number }>,
  numberOfTeams: number,
  primaryRosterSize: number = 5,
  tolerancePercent: number = 5
): TargetMmrConfig {
  const mmrs = allPlayers
    .map(p => Number(p.tournamentMmr || p.mmr || 0))
    .filter(m => m > 0);

  if (mmrs.length === 0 || numberOfTeams <= 0) {
    return {
      targetTeamMmr: 40000,
      minTeamMmr: 38000,
      maxTeamMmr: 42000,
      tolerancePercent
    };
  }

  const totalMmr = mmrs.reduce((sum, val) => sum + val, 0);
  const avgPlayerMmr = totalMmr / mmrs.length;
  const targetTeamMmr = Math.round(avgPlayerMmr * primaryRosterSize);

  const margin = (targetTeamMmr * tolerancePercent) / 100;
  const minTeamMmr = Math.floor(targetTeamMmr - margin);
  const maxTeamMmr = Math.ceil(targetTeamMmr + margin);

  return {
    targetTeamMmr,
    minTeamMmr,
    maxTeamMmr,
    tolerancePercent
  };
}

export interface MmrFairnessValidationResult {
  valid: boolean;
  reason?: string;
  targetMmr?: number;
  minMmr?: number;
  maxMmr?: number;
  projectedBiddingTeamMmr?: number;
  rivalTeamIssue?: {
    rivalTeamName: string;
    issue: string;
    maxAchievableMmr?: number;
    minAchievableMmr?: number;
  };
}

/**
 * Validates that drafting a player allows the bidding team and ALL rival teams
 * to reach the required target MMR range (+/- 5%).
 */
export function validateBidMmrFairnessConstraint(params: {
  biddingTeam: {
    id: string;
    name: string;
    currentPrimaryMmr: number;
    currentPrimaryCount: number;
  };
  nomineeMmr: number;
  nomineeName: string;
  nomineeId: string;
  rivalTeams: Array<{
    id: string;
    name: string;
    currentPrimaryMmr: number;
    currentPrimaryCount: number;
  }>;
  availablePoolMmrs: number[]; // remaining pool players excluding nominee and already drafted players
  primaryRosterSize?: number;
  targetConfig: TargetMmrConfig;
}): MmrFairnessValidationResult {
  const {
    biddingTeam,
    nomineeMmr,
    nomineeName,
    rivalTeams,
    availablePoolMmrs,
    primaryRosterSize = 5,
    targetConfig
  } = params;

  const { targetTeamMmr, minTeamMmr, maxTeamMmr, tolerancePercent } = targetConfig;

  // Only validate MMR fairness for primary roster additions
  if (biddingTeam.currentPrimaryCount >= primaryRosterSize) {
    return { valid: true };
  }

  const sortedPool = [...availablePoolMmrs].filter(m => m > 0).sort((a, b) => a - b);
  const biddingTeamUnfilledAfter = primaryRosterSize - (biddingTeam.currentPrimaryCount + 1);
  const totalRivalUnfilled = rivalTeams.reduce(
    (sum, r) => sum + Math.max(0, primaryRosterSize - r.currentPrimaryCount),
    0
  );
  const totalSlotsNeeded = biddingTeamUnfilledAfter + totalRivalUnfilled;

  // If pool does not contain enough players to fill all remaining primary slots across teams,
  // we cannot strictly enforce full-roster MMR fairness without blocking incomplete-roster tournament pools.
  if (sortedPool.length < totalSlotsNeeded) {
    return { valid: true };
  }

  const projectedBiddingMmr = biddingTeam.currentPrimaryMmr + nomineeMmr;

  // 1. Check if bidding team itself can satisfy the target range [minTeamMmr, maxTeamMmr]
  if (biddingTeamUnfilledAfter === 0) {
    // This is the final primary player for bidding team
    if (projectedBiddingMmr < minTeamMmr) {
      return {
        valid: false,
        reason: `MMR Fairness Constraint: Drafting ${nomineeName} (${nomineeMmr} MMR) results in a final team MMR of ${projectedBiddingMmr.toLocaleString()}, which falls below the mandatory minimum floor of ${minTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%).`,
        targetMmr: targetTeamMmr,
        minMmr: minTeamMmr,
        maxMmr: maxTeamMmr,
        projectedBiddingTeamMmr: projectedBiddingMmr
      };
    }
    if (projectedBiddingMmr > maxTeamMmr) {
      return {
        valid: false,
        reason: `MMR Fairness Constraint: Drafting ${nomineeName} (${nomineeMmr} MMR) results in a final team MMR of ${projectedBiddingMmr.toLocaleString()}, which exceeds the maximum team MMR ceiling of ${maxTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%).`,
        targetMmr: targetTeamMmr,
        minMmr: minTeamMmr,
        maxMmr: maxTeamMmr,
        projectedBiddingTeamMmr: projectedBiddingMmr
      };
    }
  } else if (biddingTeamUnfilledAfter > 0) {
    if (sortedPool.length >= biddingTeamUnfilledAfter) {
      // Lowest possible final MMR for bidding team
      const minAdd = sortedPool.slice(0, biddingTeamUnfilledAfter).reduce((a, b) => a + b, 0);
      const minPossibleFinal = projectedBiddingMmr + minAdd;
      if (minPossibleFinal > maxTeamMmr) {
        return {
          valid: false,
          reason: `MMR Fairness Constraint: Bidding on ${nomineeName} (${nomineeMmr} MMR) would inevitably cause ${biddingTeam.name} to exceed the maximum team MMR ceiling of ${maxTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%, minimum achievable: ${minPossibleFinal.toLocaleString()}).`,
          targetMmr: targetTeamMmr,
          minMmr: minTeamMmr,
          maxMmr: maxTeamMmr,
          projectedBiddingTeamMmr: projectedBiddingMmr
        };
      }

      // Highest possible final MMR for bidding team
      const maxAdd = sortedPool.slice(sortedPool.length - biddingTeamUnfilledAfter).reduce((a, b) => a + b, 0);
      const maxPossibleFinal = projectedBiddingMmr + maxAdd;
      if (maxPossibleFinal < minTeamMmr) {
        return {
          valid: false,
          reason: `MMR Fairness Constraint: Bidding on ${nomineeName} (${nomineeMmr} MMR) would leave ${biddingTeam.name} unable to reach the minimum team MMR floor of ${minTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%, maximum achievable: ${maxPossibleFinal.toLocaleString()}).`,
          targetMmr: targetTeamMmr,
          minMmr: minTeamMmr,
          maxMmr: maxTeamMmr,
          projectedBiddingTeamMmr: projectedBiddingMmr
        };
      }
    }
  }

  // 2. Check if ANY rival team is prevented from reaching [minTeamMmr, maxTeamMmr]
  for (const rival of rivalTeams) {
    const rivalUnfilled = primaryRosterSize - rival.currentPrimaryCount;
    if (rivalUnfilled <= 0) continue;

    if (sortedPool.length >= rivalUnfilled) {
      // Max possible MMR rival could get from the remaining pool
      const maxRivalAdd = sortedPool.slice(sortedPool.length - rivalUnfilled).reduce((a, b) => a + b, 0);
      const maxAchievableRivalMmr = rival.currentPrimaryMmr + maxRivalAdd;

      if (maxAchievableRivalMmr < minTeamMmr) {
        return {
          valid: false,
          reason: `Competitive Integrity Constraint: If ${biddingTeam.name} acquires ${nomineeName} (${nomineeMmr} MMR), rival team ${rival.name} will be mathematically unable to reach the mandatory minimum team MMR of ${minTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%, max achievable: ${maxAchievableRivalMmr.toLocaleString()}). Bid blocked to preserve game fairness.`,
          targetMmr: targetTeamMmr,
          minMmr: minTeamMmr,
          maxMmr: maxTeamMmr,
          rivalTeamIssue: {
            rivalTeamName: rival.name,
            issue: 'UNDER_FLOOR',
            maxAchievableMmr: maxAchievableRivalMmr
          }
        };
      }

      // Min possible MMR rival could get from the remaining pool
      const minRivalAdd = sortedPool.slice(0, rivalUnfilled).reduce((a, b) => a + b, 0);
      const minAchievableRivalMmr = rival.currentPrimaryMmr + minRivalAdd;

      if (minAchievableRivalMmr > maxTeamMmr) {
        return {
          valid: false,
          reason: `Competitive Integrity Constraint: If ${biddingTeam.name} acquires ${nomineeName}, rival team ${rival.name} will be forced to exceed the maximum team MMR ceiling of ${maxTeamMmr.toLocaleString()} (Target: ${targetTeamMmr.toLocaleString()} ± ${tolerancePercent}%, min achievable: ${minAchievableRivalMmr.toLocaleString()}). Bid blocked to preserve game fairness.`,
          targetMmr: targetTeamMmr,
          minMmr: minTeamMmr,
          maxMmr: maxTeamMmr,
          rivalTeamIssue: {
            rivalTeamName: rival.name,
            issue: 'OVER_CEILING',
            minAchievableMmr: minAchievableRivalMmr
          }
        };
      }
    }
  }

  return { valid: true, targetMmr: targetTeamMmr, minMmr: minTeamMmr, maxMmr: maxTeamMmr };
}
