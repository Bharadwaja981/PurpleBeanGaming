/**
 * Purple Bean Gaming — Game-Aware Roster & Auction Rules
 * 
 * Supports Dota 2, CS2, Valorant, BGMI, and PUBG with configurable
 * primary roster size, optional stand-in slots, and purse reserve enforcement.
 */

import { CompetitiveGame } from '../types/tournament';

export interface GameRosterConfig {
  game: CompetitiveGame;
  primaryRosterSize: number;
  optionalStandInAllowed: boolean;
  maxStandIns: number;
  startingCreditsINR: number;
  minimumBidINR: number;
  bidIncrementINR: number;
  minReservePerSlotINR: number;
}

export const GAME_ROSTER_CONFIGS: Record<CompetitiveGame, GameRosterConfig> = {
  'All Games': {
    game: 'All Games',
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    startingCreditsINR: 1000000,
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  },
  'Dota 2': {
    game: 'Dota 2',
    primaryRosterSize: 5, // Captain + 4 drafted (Positions 1-5)
    optionalStandInAllowed: true,
    maxStandIns: 1, // 1 optional stand-in
    startingCreditsINR: 1000000, // ₹10,00,000 (10 Lakhs)
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  },
  'Counter-Strike 2': {
    game: 'Counter-Strike 2',
    primaryRosterSize: 5, // AWPer, IGL, Entry, Anchor, Support
    optionalStandInAllowed: true,
    maxStandIns: 1,
    startingCreditsINR: 1000000,
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  },
  'Valorant': {
    game: 'Valorant',
    primaryRosterSize: 5, // Duelist, Initiator, Controller, Sentinel, Flex
    optionalStandInAllowed: true,
    maxStandIns: 1,
    startingCreditsINR: 1000000,
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  },
  'BGMI': {
    game: 'BGMI',
    primaryRosterSize: 4, // 4-man Battle Royale squad
    optionalStandInAllowed: true,
    maxStandIns: 1, // 5th sub
    startingCreditsINR: 800000, // ₹8,00,000
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  },
  'PUBG': {
    game: 'PUBG',
    primaryRosterSize: 4, // 4-man Battle Royale squad
    optionalStandInAllowed: true,
    maxStandIns: 1,
    startingCreditsINR: 800000,
    minimumBidINR: 10000,
    bidIncrementINR: 10000,
    minReservePerSlotINR: 10000
  }
};

export function getRosterConfigForGame(game?: CompetitiveGame): GameRosterConfig {
  if (!game || !GAME_ROSTER_CONFIGS[game]) {
    return GAME_ROSTER_CONFIGS['Dota 2'];
  }
  return GAME_ROSTER_CONFIGS[game];
}

/**
 * Validates whether a team can place a proposed bid given remaining required roster slots.
 */
export function validateBidRosterConstraint(
  teamCurrentCredits: number,
  proposedBid: number,
  currentDraftedCount: number,
  config: GameRosterConfig
): { valid: boolean; reason?: string } {
  const maxPrimary = config.primaryRosterSize;
  const remainingPrimaryNeeded = Math.max(0, maxPrimary - currentDraftedCount - 1);
  const minReserveNeeded = remainingPrimaryNeeded * config.minReservePerSlotINR;

  if (teamCurrentCredits < proposedBid) {
    return {
      valid: false,
      reason: `Insufficient purse balance! Required: ₹${proposedBid.toLocaleString('en-IN')}, Available: ₹${teamCurrentCredits.toLocaleString('en-IN')}.`
    };
  }

  if (teamCurrentCredits - proposedBid < minReserveNeeded) {
    return {
      valid: false,
      reason: `Illegal bid! Team must reserve at least ₹${minReserveNeeded.toLocaleString('en-IN')} (₹${config.minReservePerSlotINR.toLocaleString('en-IN')} x ${remainingPrimaryNeeded} unfilled roster slots).`
    };
  }

  if (currentDraftedCount >= maxPrimary && (!config.optionalStandInAllowed || currentDraftedCount >= maxPrimary + config.maxStandIns)) {
    return {
      valid: false,
      reason: `Roster is already full (${currentDraftedCount}/${maxPrimary} players). Cannot bid on additional players.`
    };
  }

  return { valid: true };
}
