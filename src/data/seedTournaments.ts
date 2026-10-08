/**
 * Purple Bean Gaming — Seed Tournaments & Premade Teams Registry
 * 
 * Provides predefined tournament fixtures for platform demonstration:
 * 1. Purple Bean Test Cup (Dota 2 · Individual · Auction · 3 Teams · Single Elim)
 * 2. India Dota Open (Dota 2 · Premade Team · 8 Teams · Double Elim)
 */

import { TournamentConfig } from '../domain/tournamentConfig';
import { TEST_CUP_GENERIC_CONFIG } from '../domain/testCupEngine';
import { PremadeTeamApplication } from '../domain/premadeTeamEngine';

export const INDIA_DOTA_OPEN_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'india-dota-open-2026',
    name: 'India Dota Open',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Premier national double-elimination championship for premade Indian squads.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'PREMADE_TEAM',
    openDate: '2026-10-15',
    closeDate: '2026-10-30',
    maxParticipants: 8,
    eligibilityRules: {
      minMmrOrRank: 4000,
      regionLocked: true,
      requireKyc: true
    }
  },
  teamFormation: {
    mode: 'PREMADE',
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: 'DOUBLE_ELIMINATION',
    defaultSeriesFormat: 'BO3',
    roundOverrides: {
      'Grand Final': 'BO5'
    },
    seedingMethod: 'RATING_BASED'
  },
  prizes: {
    totalPrizePoolINR: 100000,
    placementDistribution: [
      { placement: '1st Place (Champion)', percentage: 50, amountINR: 50000 },
      { placement: '2nd Place (Runner-up)', percentage: 25, amountINR: 25000 },
      { placement: '3rd Place', percentage: 15, amountINR: 15000 },
      { placement: '4th Place', percentage: 10, amountINR: 10000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const INITIAL_PREMADE_TEAMS: PremadeTeamApplication[] = [
  {
    id: 'pm-team-1',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Mumbai Warriors',
    tag: 'MUM',
    logo: '⚔️',
    homeCity: 'Mumbai',
    managerOrCaptainId: 'p-mum-cap',
    managerEmail: 'captain@mumbaiwarriors.gg',
    status: 'APPROVED',
    submittedAt: '2026-10-16T10:00:00Z',
    reviewedAt: '2026-10-16T12:00:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'm1', inGameName: 'Raptor', displayName: 'Raptor', role: 'Position 1 — Carry', ratingOrMmr: 5600, isCaptain: false, isSubstitute: false },
      { id: 'm2', inGameName: 'Slayer', displayName: 'Slayer', role: 'Position 2 — Mid', ratingOrMmr: 5900, isCaptain: true, isSubstitute: false },
      { id: 'm3', inGameName: 'Titan', displayName: 'Titan', role: 'Position 3 — Offlane', ratingOrMmr: 5400, isCaptain: false, isSubstitute: false },
      { id: 'm4', inGameName: 'Spike', displayName: 'Spike', role: 'Position 4 — Soft Support', ratingOrMmr: 5200, isCaptain: false, isSubstitute: false },
      { id: 'm5', inGameName: 'Echo', displayName: 'Echo', role: 'Position 5 — Hard Support', ratingOrMmr: 5100, isCaptain: false, isSubstitute: false }
    ],
    substitutes: [
      { id: 'm6', inGameName: 'Ghost', displayName: 'Ghost', role: 'Position 1 — Carry', ratingOrMmr: 4800, isCaptain: false, isSubstitute: true }
    ]
  },
  {
    id: 'pm-team-2',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Delhi Dragons',
    tag: 'DEL',
    logo: '🐉',
    homeCity: 'Delhi',
    managerOrCaptainId: 'p-del-cap',
    managerEmail: 'manager@delhidragons.in',
    status: 'APPROVED',
    submittedAt: '2026-10-16T10:30:00Z',
    reviewedAt: '2026-10-16T12:05:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'd1', inGameName: 'Blaze', displayName: 'Blaze', role: 'Position 1 — Carry', ratingOrMmr: 5700, isCaptain: true, isSubstitute: false },
      { id: 'd2', inGameName: 'Frost', displayName: 'Frost', role: 'Position 2 — Mid', ratingOrMmr: 5800, isCaptain: false, isSubstitute: false },
      { id: 'd3', inGameName: 'Rock', displayName: 'Rock', role: 'Position 3 — Offlane', ratingOrMmr: 5350, isCaptain: false, isSubstitute: false },
      { id: 'd4', inGameName: 'Volt', displayName: 'Volt', role: 'Position 4 — Soft Support', ratingOrMmr: 5150, isCaptain: false, isSubstitute: false },
      { id: 'd5', inGameName: 'Gale', displayName: 'Gale', role: 'Position 5 — Hard Support', ratingOrMmr: 5050, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-3',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Bengaluru Titans',
    tag: 'BLR',
    logo: '⚡',
    homeCity: 'Bengaluru',
    managerOrCaptainId: 'p-blr-cap',
    managerEmail: 'contact@titans.in',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:00:00Z',
    reviewedAt: '2026-10-16T12:10:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'b1', inGameName: 'Apex', displayName: 'Apex', role: 'Position 1 — Carry', ratingOrMmr: 5550, isCaptain: false, isSubstitute: false },
      { id: 'b2', inGameName: 'Pulse', displayName: 'Pulse', role: 'Position 2 — Mid', ratingOrMmr: 5750, isCaptain: true, isSubstitute: false },
      { id: 'b3', inGameName: 'Shield', displayName: 'Shield', role: 'Position 3 — Offlane', ratingOrMmr: 5300, isCaptain: false, isSubstitute: false },
      { id: 'b4', inGameName: 'Spark', displayName: 'Spark', role: 'Position 4 — Soft Support', ratingOrMmr: 5100, isCaptain: false, isSubstitute: false },
      { id: 'b5', inGameName: 'Mist', displayName: 'Mist', role: 'Position 5 — Hard Support', ratingOrMmr: 4950, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-4',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Hyderabad Hawks',
    tag: 'HYD',
    logo: '🦅',
    homeCity: 'Hyderabad',
    managerOrCaptainId: 'p-hyd-cap',
    managerEmail: 'hawks@esports.in',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:15:00Z',
    reviewedAt: '2026-10-16T12:15:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'h1', inGameName: 'HawkEye', displayName: 'HawkEye', role: 'Position 1 — Carry', ratingOrMmr: 5500, isCaptain: true, isSubstitute: false },
      { id: 'h2', inGameName: 'Phantom', displayName: 'Phantom', role: 'Position 2 — Mid', ratingOrMmr: 5650, isCaptain: false, isSubstitute: false },
      { id: 'h3', inGameName: 'Grizzly', displayName: 'Grizzly', role: 'Position 3 — Offlane', ratingOrMmr: 5200, isCaptain: false, isSubstitute: false },
      { id: 'h4', inGameName: 'Raven', displayName: 'Raven', role: 'Position 4 — Soft Support', ratingOrMmr: 5000, isCaptain: false, isSubstitute: false },
      { id: 'h5', inGameName: 'Owl', displayName: 'Owl', role: 'Position 5 — Hard Support', ratingOrMmr: 4900, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-5',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Chennai Champions',
    tag: 'CHE',
    logo: '👑',
    homeCity: 'Chennai',
    managerOrCaptainId: 'p-che-cap',
    managerEmail: 'chennai@pb.gg',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:20:00Z',
    reviewedAt: '2026-10-16T12:20:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'c1', inGameName: 'Vortex', displayName: 'Vortex', role: 'Position 1 — Carry', ratingOrMmr: 5450, isCaptain: true, isSubstitute: false },
      { id: 'c2', inGameName: 'Riptide', displayName: 'Riptide', role: 'Position 2 — Mid', ratingOrMmr: 5600, isCaptain: false, isSubstitute: false },
      { id: 'c3', inGameName: 'Anchor', displayName: 'Anchor', role: 'Position 3 — Offlane', ratingOrMmr: 5250, isCaptain: false, isSubstitute: false },
      { id: 'c4', inGameName: 'Surge', displayName: 'Surge', role: 'Position 4 — Soft Support', ratingOrMmr: 5050, isCaptain: false, isSubstitute: false },
      { id: 'c5', inGameName: 'Tide', displayName: 'Tide', role: 'Position 5 — Hard Support', ratingOrMmr: 4850, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-6',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Pune Phantoms',
    tag: 'PUN',
    logo: '👻',
    homeCity: 'Pune',
    managerOrCaptainId: 'p-pun-cap',
    managerEmail: 'pune@pb.gg',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:25:00Z',
    reviewedAt: '2026-10-16T12:25:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'u1', inGameName: 'Spectre', displayName: 'Spectre', role: 'Position 1 — Carry', ratingOrMmr: 5400, isCaptain: false, isSubstitute: false },
      { id: 'u2', inGameName: 'Mirage', displayName: 'Mirage', role: 'Position 2 — Mid', ratingOrMmr: 5550, isCaptain: true, isSubstitute: false },
      { id: 'u3', inGameName: 'Wraith', displayName: 'Wraith', role: 'Position 3 — Offlane', ratingOrMmr: 5150, isCaptain: false, isSubstitute: false },
      { id: 'u4', inGameName: 'Spook', displayName: 'Spook', role: 'Position 4 — Soft Support', ratingOrMmr: 4950, isCaptain: false, isSubstitute: false },
      { id: 'u5', inGameName: 'Shade', displayName: 'Shade', role: 'Position 5 — Hard Support', ratingOrMmr: 4800, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-7',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Kolkata Knights',
    tag: 'KOL',
    logo: '🛡️',
    homeCity: 'Kolkata',
    managerOrCaptainId: 'p-kol-cap',
    managerEmail: 'kolkata@pb.gg',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:30:00Z',
    reviewedAt: '2026-10-16T12:30:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'k1', inGameName: 'BengalTiger', displayName: 'BengalTiger', role: 'Position 1 — Carry', ratingOrMmr: 5350, isCaptain: true, isSubstitute: false },
      { id: 'k2', inGameName: 'Storm', displayName: 'Storm', role: 'Position 2 — Mid', ratingOrMmr: 5500, isCaptain: false, isSubstitute: false },
      { id: 'k3', inGameName: 'Ironclad', displayName: 'Ironclad', role: 'Position 3 — Offlane', ratingOrMmr: 5100, isCaptain: false, isSubstitute: false },
      { id: 'k4', inGameName: 'Beacon', displayName: 'Beacon', role: 'Position 4 — Soft Support', ratingOrMmr: 4900, isCaptain: false, isSubstitute: false },
      { id: 'k5', inGameName: 'Aegis', displayName: 'Aegis', role: 'Position 5 — Hard Support', ratingOrMmr: 4750, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  },
  {
    id: 'pm-team-8',
    tournamentId: 'india-dota-open-2026',
    teamName: 'Ahmedabad Aces',
    tag: 'AHM',
    logo: '🃏',
    homeCity: 'Ahmedabad',
    managerOrCaptainId: 'p-ahm-cap',
    managerEmail: 'ahmedabad@pb.gg',
    status: 'APPROVED',
    submittedAt: '2026-10-16T11:35:00Z',
    reviewedAt: '2026-10-16T12:35:00Z',
    reviewedBy: 'organiser-admin',
    roster: [
      { id: 'a1', inGameName: 'Joker', displayName: 'Joker', role: 'Position 1 — Carry', ratingOrMmr: 5300, isCaptain: false, isSubstitute: false },
      { id: 'a2', inGameName: 'Royal', displayName: 'Royal', role: 'Position 2 — Mid', ratingOrMmr: 5450, isCaptain: true, isSubstitute: false },
      { id: 'a3', inGameName: 'Diamond', displayName: 'Diamond', role: 'Position 3 — Offlane', ratingOrMmr: 5050, isCaptain: false, isSubstitute: false },
      { id: 'a4', inGameName: 'Club', displayName: 'Club', role: 'Position 4 — Soft Support', ratingOrMmr: 4850, isCaptain: false, isSubstitute: false },
      { id: 'a5', inGameName: 'Spade', displayName: 'Spade', role: 'Position 5 — Hard Support', ratingOrMmr: 4700, isCaptain: false, isSubstitute: false }
    ],
    substitutes: []
  }
];

export const PURPLE_BEAN_CHALLENGER_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'pb-challenger-2026',
    name: 'Purple Bean Challenger',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: '8-team premier Dota 2 league with 2 groups of 4 round-robin and single-elimination playoffs.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Mumbai',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'PREMADE_TEAM',
    openDate: '2026-11-01',
    closeDate: '2026-11-15',
    maxParticipants: 8,
    eligibilityRules: {
      minMmrOrRank: 3500,
      regionLocked: true,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: 'PREMADE',
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: 'GROUPS_KNOCKOUT',
    defaultSeriesFormat: 'BO1',
    roundOverrides: {
      'Playoffs': 'BO3',
      'Grand Final': 'BO5'
    },
    seedingMethod: 'RATING_BASED',
    groupsConfig: {
      groupCount: 2,
      advancePerGroup: 2
    }
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

export const INDIA_MASTERS_AUCTION_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'purple-bean-india-masters-2026',
    name: 'Purple Bean India Masters 2026',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Flagship Pan-India championship tournament with live captain auction team formation.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-10-01',
    closeDate: '2026-10-10',
    maxParticipants: 40,
    eligibilityRules: {
      minMmrOrRank: 3500,
      regionLocked: true,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 4
  },
  auction: {
    enabled: true,
    creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
    baseCredits: 1000,
    adjustmentRate: 0.25,
    minimumCredits: 800,
    maximumCredits: 1200,
    creditRounding: 10,
    startingCredits: 1000,
    bidTimerSeconds: 25,
    nominationTimerSeconds: 30,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: 'DOUBLE_ELIMINATION',
    defaultSeriesFormat: 'BO3',
    roundOverrides: {
      'Grand Final': 'BO5'
    },
    seedingMethod: 'RATING_BASED'
  },
  prizes: {
    totalPrizePoolINR: 250000,
    placementDistribution: [
      { placement: '1st Place (Champion)', percentage: 50, amountINR: 125000 },
      { placement: '2nd Place (Runner-up)', percentage: 26, amountINR: 65000 },
      { placement: '3rd Place', percentage: 14, amountINR: 35000 },
      { placement: '4th Place', percentage: 10, amountINR: 25000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const AUCTION_TEST_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'auction-test',
    name: 'Auction Test',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Development test tournament for manual 3-captain auction testing with MMR-balanced purses.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    isDevelopment: true,
    visibility: 'DEVELOPMENT'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-09-01',
    closeDate: '2026-10-31',
    maxParticipants: 30,
    eligibilityRules: {
      minMmrOrRank: 4000,
      regionLocked: false,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 3
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  auction: {
    enabled: true,
    creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
    baseCredits: 1000,
    adjustmentRate: 0.25,
    minimumCredits: 800,
    maximumCredits: 1200,
    creditRounding: 10,
    startingCredits: 1000,
    bidTimerSeconds: 25,
    nominationTimerSeconds: 30,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10
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
      { placement: '2nd Place (Runner-up)', percentage: 40, amountINR: 20000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const PURPLE_BEAN_AUCTION_TEST_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'purple-bean-auction-test',
    name: 'Purple Bean Auction Test',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Production-safe test tournament for validating the full PBG registration → captain → auction → Discord role flow.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    testMode: true,
    environment: 'TEST TOURNAMENT',
    isDevelopment: true,
    visibility: 'PUBLIC',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-10-01',
    closeDate: '2026-10-31',
    maxParticipants: 30,
    captainApplicationsEnabled: true,
    eligibilityRules: {
      minMmrOrRank: 3000,
      regionLocked: false,
      requireKyc: false,
      discordRequired: true,
      dotaRequired: true
    }
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 3
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  auction: {
    enabled: true,
    creditAllocationMode: 'EQUAL',
    baseCredits: 1000,
    startingCredits: 1000,
    startingCreditsPerTeam: 1000,
    minimumCredits: 1000,
    maximumCredits: 1000,
    creditRounding: 10,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10,
    bidTimerSeconds: 25,
    nominationTimerSeconds: 30
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
    totalPrizePoolINR: 0,
    placementDistribution: []
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const AFTER_AUCTION_TEST_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: 'after-auction-test',
    name: 'After auction test',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Post-auction tournament fixture with 8 formed teams ready for bracket or group stage play.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    testMode: true,
    environment: 'TEST TOURNAMENT',
    visibility: 'PUBLIC',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-09-01',
    closeDate: '2026-09-30',
    maxParticipants: 40,
    eligibilityRules: {
      minMmrOrRank: 3000,
      regionLocked: false,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: 'DOUBLE_ELIMINATION',
    defaultSeriesFormat: 'BO3',
    roundOverrides: {
      'Grand Final': 'BO5'
    },
    seedingMethod: 'RATING_BASED'
  },
  prizes: {
    totalPrizePoolINR: 100000,
    placementDistribution: [
      { placement: '1st Place (Champion)', percentage: 50, amountINR: 50000 },
      { placement: '2nd Place (Runner-up)', percentage: 30, amountINR: 30000 },
      { placement: '3rd Place', percentage: 20, amountINR: 20000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const INITIAL_SEED_TOURNAMENTS: TournamentConfig[] = [
  PURPLE_BEAN_AUCTION_TEST_CONFIG,
  AFTER_AUCTION_TEST_CONFIG,
  INDIA_MASTERS_AUCTION_CONFIG,
  INDIA_DOTA_OPEN_CONFIG,
  PURPLE_BEAN_CHALLENGER_CONFIG
];
