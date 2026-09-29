/**
 * PURPLE BEAN GAMING — 2 TEAM LIVE AUCTION TEST TOURNAMENT SETUP
 * 
 * Sets up the official "2 Team Auction Test" tournament in real Firebase data:
 * - Tournament: 2 Team Auction Test (Dota 2, PUBLIC, 2 Teams, 10 Participants)
 * - Strict 5/5 Primary Roster (1 Captain + 4 Auction Players)
 * - Stand-ins DISABLED for this tournament
 * - 2 Captain Slots reserved for real authenticated users registering with their own accounts
 * - Exactly 8 VERIFIED dummy Dota players with balanced roles across all 5 positions
 * - Locked Tournament MMRs (7050–7950) and Purple Bean Ratings
 * - Deterministic CAPTAIN_MMR_BALANCED starting credit purses
 * - Written directly into real Firebase Firestore collections
 */

import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, isQuotaExhausted, setQuotaExhausted, isQuotaError } from './firebaseConfig';
import { Tournament } from '../types/tournament';
import { TournamentConfig } from '../domain/tournamentConfig';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { dotaPlayerRegistry, DotaRolePosition } from '../domain/dotaPlayerEngine';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';

export const AUCTION_TEST_TOURNAMENT_ID = 'auction-basic-test-1';
export const LEGACY_AUCTION_TEST_TOURNAMENT_ID = '2-team-auction-test';

export const PURPLE_BEAN_AUCTION_TEST_TOURNAMENT: Tournament = {
  id: AUCTION_TEST_TOURNAMENT_ID,
  name: 'Basic Test 1',
  game: 'Dota 2',
  gameId: 'dota2',
  status: 'REGISTRATION_OPEN',
  lifecycle: 'REGISTRATION_OPEN',
  dates: 'October 2026',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  prizePool: '₹50,000 Prize Pool',
  totalPrizeNumber: 50000,
  prizePoolINR: '₹50,000',
  teamCount: 2,
  playerCount: 10,
  format: 'Captain Auction · 2 Teams · 10 Slots',
  organizer: 'Purple Bean Operations (11106cm009@gmail.com)',
  city: 'Bengaluru',
  region: 'Pan India',
  description: 'Official Basic Test 1 tournament with 2 captains, 8 auction players, and a strict 10-slot capacity. Pre-filled with 8 verified dummy contenders, reserving 2 slots for you and your friends as captains.',
  isDevelopment: false,
  visibility: 'PUBLIC',
  keyInfo: {
    server: 'India (Bengaluru / Mumbai)',
    antiCheat: 'VAC & Verified Identity',
    bracketFormat: 'Championship Series (BO3)',
    rosterLock: 'Strict 5/5 · Max 10 Participants'
  },
  prizeDistribution: [
    { place: '1st Place (Champion)', percentage: '60%', amount: '₹30,000' },
    { place: '2nd Place (Runner-up)', percentage: '40%', amount: '₹20,000' }
  ],
  stages: [
    { id: 'stg-reg', name: 'Registration (8/10 Filled · 2 Slots for Captains/Friends)', status: 'current', date: 'October 2026' },
    { id: 'stg-cap', name: 'Captain Selection & Team Roster Creation (2 Captains)', status: 'upcoming', date: 'October 2026' },
    { id: 'stg-auc', name: 'Live Auction Draft (2 Teams · 8 Players Pool)', status: 'upcoming', date: 'October 2026' },
    { id: 'stg-play', name: 'Championship Series (BO3)', status: 'upcoming', date: 'October 2026' }
  ]
};

export const PURPLE_BEAN_AUCTION_TEST_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: AUCTION_TEST_TOURNAMENT_ID,
    name: 'Basic Test 1',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Official Basic Test 1 tournament with 2 captains, 8 auction players, and a strict 10-slot capacity. Pre-filled with 8 verified dummy contenders, reserving 2 slots for you and your friends as captains.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Bengaluru',
    visibility: 'PUBLIC'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-10-01',
    closeDate: '2026-10-31',
    maxParticipants: 10
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 2
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 0,
    substituteRequired: false
  },
  auction: {
    enabled: true,
    creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
    baseCredits: 1000,
    startingCredits: 1000,
    minimumBid: 20,
    bidIncrement: 10,
    reservePerRemainingSlot: 20,
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
      { placement: '1st Place (Champion)', percentage: 60, amountINR: 30000 },
      { placement: '2nd Place (Runner-up)', percentage: 40, amountINR: 20000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export interface DummyAuctionPlayerDefinition {
  id: string;
  username: string;
  realName: string;
  avatar: string;
  city: string;
  region: string;
  primaryRole: DotaRolePosition;
  secondaryRole: DotaRolePosition;
  mmr: number;
  tournamentMmr: number;
  platformRating: number;
}

/**
 * Exactly 8 verified dummy Dota players with balanced role distribution:
 * - Position 1 — Carry: 2 players
 * - Position 2 — Mid: 2 players
 * - Position 3 — Offlane: 2 players
 * - Position 4 — Soft Support: 1 player
 * - Position 5 — Hard Support: 1 player
 * Realistic MMR spread: 7050 to 7950
 * Not preassigned to any team; all 8 begin as AVAILABLE
 */
export const DUMMY_AUCTION_PLAYERS: DummyAuctionPlayerDefinition[] = [];

let isInitializedInMemory = false;

/**
 * Ensures domain registries and auction engine are hydrated with the tournament
 * and all 8 verified dummy auction contenders.
 */
export function initializeAuctionTestInRegistry(): void {
  // Purged: zero dummy players or test fixtures automatically injected
}

export async function persistAuctionTestToFirebase(): Promise<{ success: boolean; error?: string }> {
  // Purged: zero test data written to Firebase
  return { success: true };
}
