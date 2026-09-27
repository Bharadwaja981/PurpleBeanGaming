/**
 * Purple Bean Gaming — Generic Tournament Configuration Model
 * 
 * Provides an extensible, validated data contract for all tournaments.
 * Eliminates hardcoded rules from application views.
 */

import { getGameDefinition, GameDefinition } from './gameDefinitions';

export type RegistrationMode = 'INDIVIDUAL' | 'PREMADE_TEAM';
export type TeamFormationMode = 'AUCTION' | 'DRAFT' | 'ORGANIZER_ASSIGNMENT' | 'PREMADE';
export type CompetitionFormat = 
  | 'SINGLE_ELIMINATION' 
  | 'DOUBLE_ELIMINATION' 
  | 'ROUND_ROBIN' 
  | 'GROUPS_KNOCKOUT' 
  | 'BATTLE_ROYALE_LOBBY';

export type SeriesFormatType = 'BO1' | 'BO3' | 'BO5' | 'Best of 1' | 'Best of 3' | 'Best of 5';
export type SeedingMethod = 'MANUAL' | 'RANDOM' | 'RATING_BASED';

export interface TournamentConfig {
  identity: {
    tournamentId: string;
    name: string;
    gameId: string;
    gameName: string;
    description: string;
    region: string; // e.g. "Pan India", "South India", etc.
    locationType: 'ONLINE' | 'LAN';
    city?: string;
    bannerUrl?: string;
  };
  registration: {
    registrationMode: RegistrationMode;
    openDate: string;
    closeDate: string;
    maxParticipants: number;
    eligibilityRules?: {
      minMmrOrRank?: number;
      regionLocked?: boolean;
      requireKyc?: boolean;
    };
  };
  teamFormation: {
    mode: TeamFormationMode;
    numberOfTeams: number;
  };
  roster: {
    primaryRosterSize: number;
    captainCountsTowardRoster: boolean;
    substituteSlots: number;
    substituteRequired: boolean;
  };
  auction?: {
    enabled: boolean;
    startingCredits: number;
    minimumBid: number;
    bidIncrement: number;
    reservePerRemainingSlot: number;
    nominationTimerSeconds?: number;
    bidTimerSeconds?: number;
  };
  competition: {
    format: CompetitionFormat;
    defaultSeriesFormat: SeriesFormatType;
    roundOverrides?: Record<string, SeriesFormatType>;
    seedingMethod: SeedingMethod;
    groupsConfig?: {
      groupCount: number;
      advancePerGroup: number;
    };
  };
  prizes: {
    totalPrizePoolINR: number;
    placementDistribution: Array<{
      placement: string;
      percentage: number;
      amountINR: number;
    }>;
  };
  integrity: {
    verificationRequired: boolean;
    organizerApprovalRequired: boolean;
  };
}

export function createDefaultTournamentConfig(gameIdentifier = 'dota2'): TournamentConfig {
  const gameDef: GameDefinition = getGameDefinition(gameIdentifier);
  const now = new Date();
  const closing = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    identity: {
      tournamentId: `pb-tournament-${Date.now()}`,
      name: `${gameDef.name} Championship 2026`,
      gameId: gameDef.id,
      gameName: gameDef.name,
      description: `Official Purple Bean Gaming ${gameDef.name} tournament.`,
      region: 'Pan India',
      locationType: 'ONLINE',
      city: 'Bengaluru',
      bannerUrl: gameDef.bannerImage
    },
    registration: {
      registrationMode: 'INDIVIDUAL',
      openDate: now.toISOString().split('T')[0],
      closeDate: closing.toISOString().split('T')[0],
      maxParticipants: gameDef.defaultRosterSize * 8 + 8,
      eligibilityRules: {
        minMmrOrRank: 0,
        regionLocked: false,
        requireKyc: false
      }
    },
    teamFormation: {
      mode: 'AUCTION',
      numberOfTeams: 8
    },
    roster: {
      primaryRosterSize: gameDef.defaultRosterSize,
      captainCountsTowardRoster: true,
      substituteSlots: 1,
      substituteRequired: false
    },
    auction: {
      enabled: true,
      startingCredits: 1000,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerRemainingSlot: 10,
      nominationTimerSeconds: 30,
      bidTimerSeconds: 15
    },
    competition: {
      format: 'SINGLE_ELIMINATION',
      defaultSeriesFormat: 'BO3',
      roundOverrides: {
        'Grand Final': 'BO5'
      },
      seedingMethod: 'RATING_BASED'
    },
    prizes: {
      totalPrizePoolINR: 50000,
      placementDistribution: [
        { placement: '1st Place (Champion)', percentage: 60, amountINR: 30000 },
        { placement: '2nd Place (Runner-up)', percentage: 25, amountINR: 12500 },
        { placement: '3rd Place', percentage: 15, amountINR: 7500 }
      ]
    },
    integrity: {
      verificationRequired: true,
      organizerApprovalRequired: true
    }
  };
}

export function validateTournamentConfig(config: TournamentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.identity?.name?.trim()) {
    errors.push('Tournament name is required.');
  }

  if (!config.identity?.gameId) {
    errors.push('Game selection is required.');
  }

  if (config.teamFormation.numberOfTeams < 2) {
    errors.push('A tournament must feature at least 2 teams.');
  }

  if (config.roster.primaryRosterSize < 1) {
    errors.push('Primary roster size must be at least 1.');
  }

  if (config.registration.registrationMode === 'INDIVIDUAL') {
    if (config.teamFormation.mode === 'PREMADE') {
      errors.push('Individual registration cannot use Premade team formation mode.');
    }
  }

  if (config.registration.registrationMode === 'PREMADE_TEAM') {
    if (config.teamFormation.mode === 'AUCTION') {
      errors.push('Premade team registration does not support Captain Auction.');
    }
  }

  if (config.teamFormation.mode === 'AUCTION') {
    if (!config.auction || !config.auction.enabled) {
      errors.push('Auction mode requires valid auction configuration.');
    } else {
      if (config.auction.startingCredits <= 0) {
        errors.push('Starting auction credits must be greater than zero.');
      }
      if (config.auction.minimumBid <= 0) {
        errors.push('Minimum bid must be greater than zero.');
      }
      if (config.auction.bidIncrement <= 0) {
        errors.push('Bid increment must be greater than zero.');
      }
      const slotsToDraft = config.roster.captainCountsTowardRoster 
        ? config.roster.primaryRosterSize - 1 
        : config.roster.primaryRosterSize;
      const minRequiredCredits = slotsToDraft * config.auction.minimumBid;
      if (config.auction.startingCredits < minRequiredCredits) {
        errors.push(`Starting credits (${config.auction.startingCredits}) must at least cover mandatory roster slots (${minRequiredCredits}).`);
      }
    }
  }

  if (config.competition.format === 'GROUPS_KNOCKOUT') {
    if (!config.competition.groupsConfig || config.competition.groupsConfig.groupCount < 2) {
      errors.push('Groups + Knockout requires at least 2 groups configured.');
    }
  }

  if (config.prizes.totalPrizePoolINR < 0) {
    errors.push('Prize pool cannot be negative.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}
