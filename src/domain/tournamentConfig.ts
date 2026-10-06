/**
 * Purple Bean Gaming — Tournament Configuration Domain
 */

import { removeUndefinedDeep } from '../utils/sanitizeFirestore';

export interface TournamentIdentityConfig {
  tournamentId: string;
  name: string;
  gameId: string;
  gameName: string;
  description: string;
  region: string;
  locationType: 'ONLINE' | 'LAN';
  city?: string;
  bannerUrl?: string;
  isDevelopment?: boolean;
  testMode?: boolean;
  environment?: string;
  visibility?: 'PUBLIC' | 'DEVELOPMENT' | 'UNLISTED' | 'DRAFT' | 'PRIVATE' | string;
}

export interface TournamentRegistrationConfig {
  registrationMode: 'INDIVIDUAL' | 'PREMADE_TEAM';
  openDate: string;
  closeDate: string;
  maxParticipants: number;
  captainApplicationsEnabled?: boolean;
  eligibilityRules?: {
    minMmrOrRank?: number;
    regionLocked?: boolean;
    requireKyc?: boolean;
    [key: string]: any;
  };
}

export interface TournamentTeamFormationConfig {
  mode: 'AUCTION' | 'PREMADE' | 'ORGANIZER_ASSIGNMENT' | string;
  numberOfTeams: number;
  minTeamSize?: number;
  maxTeamSize?: number;
}

export interface TournamentRosterConfig {
  primaryRosterSize: number;
  captainCountsTowardRoster: boolean;
  substituteSlots: number;
  substituteRequired: boolean;
  optionalStandInAllowed?: boolean;
  maxStandIns?: number;
}

export interface TournamentAuctionConfig {
  enabled: boolean;
  creditAllocationMode?: 'CAPTAIN_MMR_BALANCED' | 'EQUAL';
  baseCredits?: number;
  startingCredits?: number;
  startingCreditsPerTeam?: number;
  minimumCredits?: number;
  maximumCredits?: number;
  creditRounding?: number;
  minimumBid?: number;
  bidIncrement?: number;
  reservePerSlot?: number;
  reservePerRemainingSlot?: number;
  nominationTimerSeconds?: number;
  bidTimerSeconds?: number;
  spectatorDelaySeconds?: number;
  adjustmentRate?: number;
}

export interface TournamentCompetitionConfig {
  format: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUPS_KNOCKOUT' | string;
  defaultSeriesFormat: 'BO1' | 'BO3' | 'BO5' | string;
  seedingMethod: 'RATING_BASED' | 'RANDOM' | 'MANUAL' | string;
  grandFinalResetEnabled?: boolean;
  roundOverrides?: Record<string, any>;
  groupsConfig?: any;
}

export interface PrizePlacement {
  placement: string;
  percentage: number;
  amountINR: number;
}

export interface TournamentPrizesConfig {
  totalPrizePoolINR: number;
  placementDistribution: PrizePlacement[];
}

export interface TournamentIntegrityConfig {
  kycRequired?: boolean;
  verificationRequired?: boolean;
  organizerApprovalRequired?: boolean;
  rulesUrl?: string;
}

export interface TournamentConfig {
  identity: TournamentIdentityConfig;
  registration: TournamentRegistrationConfig;
  teamFormation: TournamentTeamFormationConfig;
  roster: TournamentRosterConfig;
  auction?: TournamentAuctionConfig;
  competition: TournamentCompetitionConfig;
  prizes: TournamentPrizesConfig;
  integrity?: TournamentIntegrityConfig;
}

export function formatINR(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return '₹' + Math.round(val).toLocaleString('en-IN');
}

export function createDefaultTournamentConfig(gameIdOrTournament: any = 'dota2'): TournamentConfig {
  const rawGameId = typeof gameIdOrTournament === 'string' 
    ? gameIdOrTournament 
    : (gameIdOrTournament?.gameId || gameIdOrTournament?.game || 'dota2');
  const gameId = String(rawGameId || 'dota2');
  const isDota = gameId.toLowerCase().includes('dota');
  const cleanGameId = gameId.toLowerCase().replace(/[^a-z0-9]/g, '') || 'dota2';
  return {
    identity: {
      tournamentId: `pb-${cleanGameId}-${Date.now()}`,
      name: isDota ? 'Dota 2 Championship' : 'Esports Open Cup',
      gameId: cleanGameId,
      gameName: isDota ? 'Dota 2' : 'Dota 2',
      description: 'Official tournament powered by Purple Bean Gaming.',
      region: 'Pan India',
      locationType: 'ONLINE',
      visibility: 'PUBLIC'
    },
    registration: {
      registrationMode: 'INDIVIDUAL',
      openDate: new Date().toISOString().split('T')[0],
      closeDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      maxParticipants: 32,
      eligibilityRules: {
        minMmrOrRank: 3000,
        regionLocked: false,
        requireKyc: false
      }
    },
    teamFormation: {
      mode: 'AUCTION',
      numberOfTeams: 4
    },
    roster: {
      primaryRosterSize: 5,
      captainCountsTowardRoster: true,
      substituteSlots: 1,
      substituteRequired: false,
      optionalStandInAllowed: true,
      maxStandIns: 1
    },
    auction: {
      enabled: true,
      creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
      baseCredits: 1000,
      startingCredits: 1000,
      startingCreditsPerTeam: 1000,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      reservePerRemainingSlot: 10,
      nominationTimerSeconds: 30,
      bidTimerSeconds: 25
    },
    competition: {
      format: 'SINGLE_ELIMINATION',
      defaultSeriesFormat: 'BO3',
      seedingMethod: 'RATING_BASED'
    },
    prizes: {
      totalPrizePoolINR: 50000,
      placementDistribution: [
        { placement: '1st Place (Champion)', percentage: 50, amountINR: 25000 },
        { placement: '2nd Place (Runner-up)', percentage: 25, amountINR: 12500 },
        { placement: '3rd Place', percentage: 15, amountINR: 7500 },
        { placement: '4th Place', percentage: 10, amountINR: 5000 }
      ]
    },
    integrity: {
      verificationRequired: false,
      organizerApprovalRequired: false
    }
  };
}

export function validateTournamentConfig(config: TournamentConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config) {
    return { valid: false, errors: ['Configuration is required.'] };
  }

  if (!config.identity?.name || !config.identity.name.trim()) {
    errors.push('Tournament name is required.');
  }

  if (config.identity?.locationType === 'LAN') {
    if (!config.identity?.city || !config.identity.city.trim()) {
      errors.push('City is required for LAN tournaments.');
    }
  }

  const teamCount = config.teamFormation?.numberOfTeams;
  if (typeof teamCount !== 'number' || teamCount < 2) {
    errors.push('A tournament must feature at least 2 teams.');
  }

  if (config.roster && config.roster.primaryRosterSize < 1) {
    errors.push('Primary roster size must be at least 1.');
  }

  if (config.auction?.enabled) {
    const credits = config.auction.startingCredits ?? config.auction.startingCreditsPerTeam ?? config.auction.baseCredits ?? 0;
    if (credits <= 0) {
      errors.push('Starting credits must be greater than zero for auction tournaments.');
    }
  }

  if (config.registration?.registrationMode === 'PREMADE_TEAM' && config.teamFormation?.mode === 'AUCTION') {
    errors.push('Premade team registration does not support Captain Auction mode.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function normalizeTournamentConfig(config: any): TournamentConfig {
  if (!config) return createDefaultTournamentConfig();
  const cloned = JSON.parse(JSON.stringify(config));

  if (!cloned.identity) cloned.identity = {};
  if (!cloned.registration) cloned.registration = {};
  if (!cloned.teamFormation) cloned.teamFormation = { mode: 'AUCTION', numberOfTeams: 4 };
  if (!cloned.roster) cloned.roster = { primaryRosterSize: 5, captainCountsTowardRoster: true, substituteSlots: 0, substituteRequired: false };
  if (!cloned.competition) cloned.competition = { format: 'SINGLE_ELIMINATION', defaultSeriesFormat: 'BO3', seedingMethod: 'RATING_BASED' };
  if (!cloned.prizes) cloned.prizes = { totalPrizePoolINR: 0, placementDistribution: [] };

  // Handle location and city sanitization
  if (cloned.identity.locationType === 'ONLINE') {
    if (!cloned.identity.city || !cloned.identity.city.trim()) {
      delete cloned.identity.city;
    }
  }

  return removeUndefinedDeep(cloned) as TournamentConfig;
}
