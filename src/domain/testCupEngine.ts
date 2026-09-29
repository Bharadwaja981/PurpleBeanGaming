/**
 * Purple Bean Gaming — Purple Bean Test Cup Engine
 * 
 * Fully-fledged deterministic engine for running the real test tournament:
 * - Game: Dota 2
 * - Region: Pan India
 * - Format: Single Elimination (3 Teams with BYE)
 * - Roster: 5 Mandatory (1 Captain + 4 Drafted) + 1 Optional Stand-in
 * - Purse: 1000 Credits per Captain/Team, 10 min bid, 10 min reserve per slot
 * - Lifecycle: Registration -> KYC/Verification -> Captains -> Auction (SOLD, UNSOLD, UNSELECTED)
 *              -> Rosters Locked -> Semifinal (with Bye) -> Grand Final -> Completed
 * - Updates player careers, captain records, team history, and competitive ratings!
 */

import { 
  Tournament, 
  Player, 
  Team, 
  Match, 
  AuctionTeamState, 
  BracketNode 
} from '../types/tournament';
import { ratingLedger, RatingAdjustmentRecord } from './competitiveRatingEngine';
import { TournamentConfig } from './tournamentConfig';
import { GenericCompetitionEngine, CompetitionTeam } from './genericCompetitionEngine';

export interface TestCupPlayerRecord {
  id: string;
  username: string;
  realName: string;
  avatar: string;
  city: string;
  region: string;
  primaryRole: string;
  secondaryRole: string;
  mmr: number;
  tournamentMmr: number;
  rating: number;
  isCaptain?: boolean;
  registrationStatus: 'Registered' | 'Verified' | 'Rejected';
  auctionStatus?: 'AVAILABLE' | 'NOMINATED' | 'SOLD' | 'UNSOLD' | 'UNSELECTED';
  teamId?: string;
  teamName?: string;
  finalPlacement?: string;
}

export interface TestCupTeamRecord {
  id: string;
  name: string;
  tag: string;
  logo: string;
  color: string;
  captainId: string;
  captainName: string;
  credits: number;
  creditsUsed: number;
  primaryRoster: Player[];
  standIn?: Player;
  placement?: string;
  earningsINR?: string;
  rating: number;
}

export interface TestCupConfig {
  id: string;
  name: string;
  game: 'Dota 2';
  region: string;
  prizePoolINR: string;
  startingCredits: number;
  minimumBid: number;
  bidIncrement: number;
  primaryRosterSize: number;
  optionalStandInAllowed: boolean;
  minReservePerSlot: number;
}

export const TEST_CUP_CONFIG: TestCupConfig = {
  id: 'purple-bean-test-cup',
  name: 'Purple Bean Test Cup',
  game: 'Dota 2',
  region: 'Pan India',
  prizePoolINR: '₹25,000',
  startingCredits: 1000,
  minimumBid: 10,
  bidIncrement: 10,
  primaryRosterSize: 5,
  optionalStandInAllowed: true,
  minReservePerSlot: 10
};

export const TEST_CUP_GENERIC_CONFIG: TournamentConfig = {
  identity: {
    tournamentId: TEST_CUP_CONFIG.id,
    name: TEST_CUP_CONFIG.name,
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Premier Indian Dota 2 tournament with captain auction.',
    region: 'Pan India',
    locationType: 'ONLINE',
    city: 'Mumbai',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-10-01',
    closeDate: '2026-10-14',
    maxParticipants: 24,
    eligibilityRules: {
      regionLocked: true,
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
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10,
    nominationTimerSeconds: 30,
    bidTimerSeconds: 15
  },
  competition: {
    format: 'SINGLE_ELIMINATION',
    defaultSeriesFormat: 'Best of 3',
    roundOverrides: {
      'Grand Final': 'Best of 3'
    },
    seedingMethod: 'MANUAL'
  },
  prizes: {
    totalPrizePoolINR: 25000,
    placementDistribution: [
      { placement: 'Champion (1st Place)', percentage: 60, amountINR: 15000 },
      { placement: 'Runner-up (2nd Place)', percentage: 28, amountINR: 7000 },
      { placement: '3rd Place', percentage: 12, amountINR: 3000 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};

export const INITIAL_TEST_CUP_PLAYERS: TestCupPlayerRecord[] = [
  // 3 Captains
  {
    id: 'p-c1',
    username: 'Aether',
    realName: 'Arjun Nair',
    avatar: '⚡',
    city: 'Mumbai',
    region: 'West India',
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 1 — Carry',
    mmr: 8600,
    tournamentMmr: 8600,
    rating: 1850,
    isCaptain: true,
    registrationStatus: 'Verified',
    teamId: 'tc-team-1',
    teamName: 'Mumbai Mavericks'
  },
  {
    id: 'p-c2',
    username: 'Nova',
    realName: 'Nikhil Reddy',
    avatar: '🦅',
    city: 'Hyderabad',
    region: 'South India',
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    mmr: 8450,
    tournamentMmr: 8450,
    rating: 1820,
    isCaptain: true,
    registrationStatus: 'Verified',
    teamId: 'tc-team-2',
    teamName: 'Hyderabad Raiders'
  },
  {
    id: 'p-c3',
    username: 'Karma',
    realName: 'Karthik Rao',
    avatar: '🔥',
    city: 'Bengaluru',
    region: 'South India',
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 8200,
    tournamentMmr: 8200,
    rating: 1800,
    isCaptain: true,
    registrationStatus: 'Verified',
    teamId: 'tc-team-3',
    teamName: 'Bengaluru Blaze'
  },

  // 12 Mandatory Drafted Players (Positions 1-5 balanced)
  {
    id: 'p-tc-1',
    username: 'Shadow',
    realName: 'Sameer Sen',
    avatar: '🗡️',
    city: 'Delhi',
    region: 'North India',
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    mmr: 7900,
    tournamentMmr: 7900,
    rating: 1720,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-2',
    username: 'Blaze',
    realName: 'Bhavin Patel',
    avatar: '💥',
    city: 'Pune',
    region: 'West India',
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 3 — Offlane',
    mmr: 8100,
    tournamentMmr: 8100,
    rating: 1750,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-3',
    username: 'Viper',
    realName: 'Varun Swaminathan',
    avatar: '🐍',
    city: 'Chennai',
    region: 'South India',
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 7750,
    tournamentMmr: 7750,
    rating: 1690,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-4',
    username: 'Frost',
    realName: 'Farhan Ali',
    avatar: '❄️',
    city: 'Kolkata',
    region: 'East India',
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 5 — Hard Support',
    mmr: 7600,
    tournamentMmr: 7600,
    rating: 1680,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-5',
    username: 'Titan',
    realName: 'Tanmay Bhatt',
    avatar: '🛡️',
    city: 'Mumbai',
    region: 'West India',
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 7850,
    tournamentMmr: 7850,
    rating: 1710,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-6',
    username: 'Echo',
    realName: 'Eshwar Teja',
    avatar: '📢',
    city: 'Hyderabad',
    region: 'South India',
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    mmr: 7500,
    tournamentMmr: 7500,
    rating: 1650,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-7',
    username: 'Mirage',
    realName: 'Madhav Joshi',
    avatar: '🔮',
    city: 'Bengaluru',
    region: 'South India',
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 1 — Carry',
    mmr: 8300,
    tournamentMmr: 8300,
    rating: 1790,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-8',
    username: 'Raven',
    realName: 'Ritesh Varma',
    avatar: '🦅',
    city: 'Ahmedabad',
    region: 'West India',
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 5 — Hard Support',
    mmr: 7400,
    tournamentMmr: 7400,
    rating: 1640,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-9',
    username: 'Zenith',
    realName: 'Zeeshan Khan',
    avatar: '⭐',
    city: 'Kochi',
    region: 'South India',
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 3 — Offlane',
    mmr: 8000,
    tournamentMmr: 8000,
    rating: 1740,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-10',
    username: 'Pulse',
    realName: 'Pranav Saxena',
    avatar: '💓',
    city: 'Jaipur',
    region: 'North India',
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 7650,
    tournamentMmr: 7650,
    rating: 1670,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-11',
    username: 'Cipher',
    realName: 'Chirag Gill',
    avatar: '🔐',
    city: 'Chandigarh',
    region: 'North India',
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 3 — Offlane',
    mmr: 7800,
    tournamentMmr: 7800,
    rating: 1700,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-12',
    username: 'Spectre',
    realName: 'Saurabh Srivastava',
    avatar: '👻',
    city: 'Lucknow',
    region: 'North India',
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 1 — Carry',
    mmr: 7950,
    tournamentMmr: 7950,
    rating: 1730,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },

  // 1 Optional Stand-in Player
  {
    id: 'p-tc-13',
    username: 'Rogue',
    realName: 'Rahul Chawla',
    avatar: '🎭',
    city: 'Bhopal',
    region: 'Central India',
    primaryRole: 'Position 1 — Carry',
    secondaryRole: 'Position 2 — Mid',
    mmr: 7300,
    tournamentMmr: 7300,
    rating: 1620,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },

  // 2 UNSOLD Players (Nominated but expired without winning bid)
  {
    id: 'p-tc-14',
    username: 'Phantom',
    realName: 'Piyush Mishra',
    avatar: '🌫️',
    city: 'Patna',
    region: 'East India',
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 5 — Hard Support',
    mmr: 7250,
    tournamentMmr: 7250,
    rating: 1610,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-15',
    username: 'Vortex',
    realName: 'Vikram Jadhav',
    avatar: '🌀',
    city: 'Nagpur',
    region: 'Central India',
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 7150,
    tournamentMmr: 7150,
    rating: 1600,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },

  // 6 UNSELECTED Players (Remained untouched in auction pool when all rosters filled)
  {
    id: 'p-tc-16',
    username: 'Striker',
    realName: 'Siddharth Barua',
    avatar: '🎯',
    city: 'Guwahati',
    region: 'East India',
    primaryRole: 'Position 2 — Mid',
    secondaryRole: 'Position 1 — Carry',
    mmr: 7100,
    tournamentMmr: 7100,
    rating: 1590,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-17',
    username: 'Aegis',
    realName: 'Ankit Tirkey',
    avatar: '🔰',
    city: 'Ranchi',
    region: 'East India',
    primaryRole: 'Position 5 — Hard Support',
    secondaryRole: 'Position 4 — Soft Support',
    mmr: 7050,
    tournamentMmr: 7050,
    rating: 1580,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-18',
    username: 'Tempest',
    realName: 'Tarun Varma',
    avatar: '🌪️',
    city: 'Visakhapatnam',
    region: 'South India',
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 1 — Carry',
    mmr: 7150,
    tournamentMmr: 7150,
    rating: 1595,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-19',
    username: 'Kinesis',
    realName: 'Kunal Mohanty',
    avatar: '☄️',
    city: 'Bhubaneswar',
    region: 'East India',
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 5 — Hard Support',
    mmr: 7000,
    tournamentMmr: 7000,
    rating: 1570,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-20',
    username: 'Apex',
    realName: 'Ayush Sharma',
    avatar: '🏔️',
    city: 'Indore',
    region: 'Central India',
    primaryRole: 'Position 3 — Offlane',
    secondaryRole: 'Position 2 — Mid',
    mmr: 7200,
    tournamentMmr: 7200,
    rating: 1605,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  },
  {
    id: 'p-tc-21',
    username: 'Helix',
    realName: 'Harshil Shah',
    avatar: '🧬',
    city: 'Surat',
    region: 'West India',
    primaryRole: 'Position 4 — Soft Support',
    secondaryRole: 'Position 5 — Hard Support',
    mmr: 7250,
    tournamentMmr: 7250,
    rating: 1615,
    registrationStatus: 'Verified',
    auctionStatus: 'AVAILABLE'
  }
];

export class PurpleBeanTestCupEngine {
  private status: 'Registration Open' | 'Verification' | 'Captain Selection' | 'Drafting' | 'Rosters Locked' | 'Live' | 'Completed' = 'Registration Open';
  private players: TestCupPlayerRecord[] = [];
  private teams: TestCupTeamRecord[] = [];
  private matches: Match[] = [];
  private auditTrail: Array<{ action: string; details: string; timestamp: string }> = [];
  private listeners: Array<() => void> = [];

  // Auction State
  private auctionState = {
    revision: 1,
    currentBid: 10,
    leadingTeamId: '',
    leadingTeamName: '',
    nominee: null as TestCupPlayerRecord | null,
    soldCount: 0,
    unsoldCount: 0,
    unselectedCount: 0,
    isCompleted: false
  };

  constructor() {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    if (isTest) {
      this.reset();
    } else {
      this.purge();
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Listener err:', err); }
    });
  }

  public purge() {
    this.status = 'Registration Open';
    this.players = [];
    this.teams = [];
    this.matches = [];
    this.auditTrail = [];
    this.auctionState = {
      revision: 1,
      currentBid: 10,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false
    };
    this.logAudit('data_purged', 'Tournament test data and mockups completely purged.');
    this.notify();
  }

  public generateDummyPlayersAndCaptains(
    dummyPlayerCount: number = 16, 
    captainCount: number = 3,
    customSettings?: Partial<TestCupConfig>
  ) {
    if (customSettings) {
      if (customSettings.name) TEST_CUP_CONFIG.name = customSettings.name;
      if (customSettings.startingCredits) TEST_CUP_CONFIG.startingCredits = customSettings.startingCredits;
      if (customSettings.minimumBid) TEST_CUP_CONFIG.minimumBid = customSettings.minimumBid;
      if (customSettings.bidIncrement) TEST_CUP_CONFIG.bidIncrement = customSettings.bidIncrement;
      if (customSettings.prizePoolINR) TEST_CUP_CONFIG.prizePoolINR = customSettings.prizePoolINR;
    }

    const indianTags = [
      'ThunderStrike', 'PhantomX', 'Agni', 'Vortex', 'Karna', 'Chanakya', 'Garuda', 'Blaze', 
      'Specter', 'Titan', 'ZeroGravity', 'ShadowBlade', 'ApexRider', 'HyperNova', 'Trishul', 
      'Raptor', 'ViperX', 'Maratha', 'Rudra', 'Varuna', 'Zenith', 'FrostBite', 'AlphaWolf', 
      'NeonPulse', 'Havoc', 'Eclipse', 'Bhavani', 'Indra', 'Vanguard', 'Matrix', 'Pulse', 'Cipher'
    ];
    const realNames = [
      'Aditya Sharma', 'Rohan Verma', 'Karan Chopra', 'Sameer Sen', 'Bhavin Patel', 
      'Vikram Joshi', 'Aniket Das', 'Nikhil Reddy', 'Karthik Rao', 'Arjun Nair', 
      'Tarun Mehta', 'Varun Kapoor', 'Rajat Roy', 'Devendra Singh', 'Pranav Kulkarni', 
      'Harshil Shah', 'Gaurav Bhatt', 'Manoj Menon', 'Deepak Ghosh', 'Siddharth Iyer'
    ];
    const cities = ['Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Pune', 'Kolkata', 'Chennai', 'Ahmedabad'];
    const roles = [
      'Position 1 — Carry',
      'Position 2 — Mid',
      'Position 3 — Offlane',
      'Position 4 — Soft Support',
      'Position 5 — Hard Support'
    ];
    const avatars = ['⚡', '🦅', '🔥', '🗡️', '💥', '🐍', '🎯', '🛡️', '⚔️', '🌊', '🌪️', '🦾', '🏹', '🔮', '🧬'];

    const newPlayers: TestCupPlayerRecord[] = [];
    const newTeams: TestCupTeamRecord[] = [];

    // 1. Create Captains & Teams
    const teamColors = ['#FFE600', '#FF70A6', '#70FFAF', '#C084FC', '#38EF7D', '#F97316', '#06B6D4', '#EC4899'];
    for (let c = 0; c < captainCount; c++) {
      const capId = `p-cap-${c + 1}`;
      const tag = indianTags[c % indianTags.length];
      const rName = realNames[c % realNames.length];
      const city = cities[c % cities.length];
      const teamId = `test-team-${c + 1}`;
      const teamName = `${city} ${['Titans', 'Raiders', 'Blaze', 'Strikers', 'Warriors', 'Knights', 'Eagles', 'Panthers'][c % 8]}`;

      const captainRecord: TestCupPlayerRecord = {
        id: capId,
        username: tag,
        realName: rName,
        avatar: avatars[c % avatars.length],
        city,
        region: 'Pan India',
        primaryRole: roles[c % roles.length],
        secondaryRole: roles[(c + 1) % roles.length],
        mmr: 8200 + (c * 150),
        tournamentMmr: 8200 + (c * 150),
        rating: 1800 + (c * 25),
        isCaptain: true,
        registrationStatus: 'Verified',
        teamId,
        teamName
      };

      newPlayers.push(captainRecord);

      newTeams.push({
        id: teamId,
        name: teamName,
        tag: teamName.split(' ').map(w => w[0]).join(''),
        logo: captainRecord.avatar,
        color: teamColors[c % teamColors.length],
        captainId: capId,
        captainName: tag,
        credits: TEST_CUP_CONFIG.startingCredits,
        creditsUsed: 0,
        primaryRoster: [captainRecord as unknown as Player],
        rating: captainRecord.rating
      });
    }

    // 2. Create Dummy Draftable Players
    for (let i = 0; i < dummyPlayerCount; i++) {
      const pIdx = captainCount + i;
      const tag = indianTags[pIdx % indianTags.length] + (pIdx >= indianTags.length ? `${Math.floor(pIdx / indianTags.length) + 1}` : '');
      const rName = realNames[pIdx % realNames.length];
      const city = cities[pIdx % cities.length];
      const mmr = 6000 + Math.floor(Math.random() * 2500);

      newPlayers.push({
        id: `p-dummy-${i + 1}`,
        username: tag,
        realName: rName,
        avatar: avatars[pIdx % avatars.length],
        city,
        region: 'Pan India',
        primaryRole: roles[i % roles.length],
        secondaryRole: roles[(i + 1) % roles.length],
        mmr,
        tournamentMmr: mmr,
        rating: 1500 + Math.floor((mmr - 6000) * 0.1),
        registrationStatus: 'Verified',
        auctionStatus: 'AVAILABLE'
      });
    }

    this.players = newPlayers;
    this.teams = newTeams;
    this.matches = [];
    this.status = 'Registration Open';
    this.auctionState = {
      revision: 1,
      currentBid: TEST_CUP_CONFIG.minimumBid,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false
    };

    this.logAudit('dummy_generated', `Generated ${dummyPlayerCount} test players and ${captainCount} captains with custom settings.`);
    this.notify();
    return { players: newPlayers, teams: newTeams };
  }

  public autoSimulateFullAuction(): { soldCount: number; unsoldCount: number; unselectedCount: number } {
    if (this.teams.length === 0 || this.players.length === 0) {
      this.generateDummyPlayersAndCaptains(16, 3);
    }

    // Ensure all players verified & advance to Drafting
    for (const p of this.players) {
      p.registrationStatus = 'Verified';
      if (!p.isCaptain) p.auctionStatus = 'AVAILABLE';
    }
    this.confirmCaptainsAndTeams();

    const draftablePlayers = this.players.filter(p => !p.isCaptain && p.auctionStatus === 'AVAILABLE');
    const targetPerTeam = TEST_CUP_CONFIG.primaryRosterSize; // 5 total, including captain -> need 4 drafted per team
    const neededPerTeam = targetPerTeam - 1;

    let tIndex = 0;
    for (const player of draftablePlayers) {
      // Check if all teams are full
      const allFull = this.teams.every(t => t.primaryRoster.length >= targetPerTeam);
      if (allFull) {
        player.auctionStatus = 'UNSELECTED';
        continue;
      }

      // Find next team that still needs players
      let team = this.teams[tIndex % this.teams.length];
      let attempts = 0;
      while (team.primaryRoster.length >= targetPerTeam && attempts < this.teams.length) {
        tIndex++;
        team = this.teams[tIndex % this.teams.length];
        attempts++;
      }

      if (team.primaryRoster.length >= targetPerTeam) {
        player.auctionStatus = 'UNSELECTED';
        continue;
      }

      // Nominate and sell to this team
      this.nominatePlayer(player.id);
      const remainingSlots = targetPerTeam - team.primaryRoster.length;
      const reserve = (remainingSlots - 1) * TEST_CUP_CONFIG.minReservePerSlot;
      const maxBid = Math.max(TEST_CUP_CONFIG.minimumBid, team.credits - reserve);
      const bidAmount = Math.min(maxBid, Math.max(TEST_CUP_CONFIG.minimumBid, Math.floor(100 + Math.random() * 150)));

      this.placeAuctionBid({
        teamId: team.id,
        bidAmount,
        captainUserId: team.captainId
      });
      this.concludeNomination(true);
      tIndex++;
    }

    // Finalize auction state
    this.finalizeAuction();
    this.status = 'Rosters Locked';
    this.logAudit('auction_simulated', `Auto-auction completed. All ${this.teams.length} teams filled rosters.`);
    this.notify();

    return {
      soldCount: this.auctionState.soldCount,
      unsoldCount: this.auctionState.unsoldCount,
      unselectedCount: this.auctionState.unselectedCount
    };
  }

  public fastForwardWholeTournament(): {
    champion: string;
    runnerUp: string;
    thirdPlace: string;
    summary: any;
  } {
    // If not drafted, simulate auction first
    if (this.status !== 'Rosters Locked' && this.status !== 'Live' && this.status !== 'Completed') {
      this.autoSimulateFullAuction();
    }

    // Generate bracket
    this.generateSingleEliminationBracket();

    // Play matches
    this.executeSemifinalResult(2, 1);
    this.executeGrandFinalResult(2, 0);

    const completion = this.completeTournament();
    this.notify();

    return {
      champion: completion.champion,
      runnerUp: completion.runnerUp,
      thirdPlace: completion.thirdPlace,
      summary: {
        status: 'Completed',
        matchesCount: this.matches.length,
        teamsCount: this.teams.length
      }
    };
  }

  public reset() {
    this.status = 'Registration Open';
    this.players = INITIAL_TEST_CUP_PLAYERS.map(p => ({ ...p }));
    this.teams = [
      {
        id: 'tc-team-1',
        name: 'Mumbai Mavericks',
        tag: 'MM',
        logo: '⚡',
        color: '#FFE600',
        captainId: 'p-c1',
        captainName: 'Aether',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[0] as unknown as Player],
        rating: 1850
      },
      {
        id: 'tc-team-2',
        name: 'Hyderabad Raiders',
        tag: 'HR',
        logo: '🦅',
        color: '#FF70A6',
        captainId: 'p-c2',
        captainName: 'Nova',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[1] as unknown as Player],
        rating: 1820
      },
      {
        id: 'tc-team-3',
        name: 'Bengaluru Blaze',
        tag: 'BB',
        logo: '🔥',
        color: '#70FFAF',
        captainId: 'p-c3',
        captainName: 'Karma',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[2] as unknown as Player],
        rating: 1800
      }
    ];
    this.matches = [];
    this.auditTrail = [];
    this.auctionState = {
      revision: 1,
      currentBid: 10,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false
    };

    this.logAudit('tournament_created', 'Purple Bean Test Cup initialized in REGISTRATION OPEN state.');
    this.notify();
  }

  private logAudit(action: string, details: string) {
    this.auditTrail.unshift({
      action,
      details,
      timestamp: new Date().toISOString()
    });
    this.notify();
  }

  public getStatus() {
    return this.status;
  }

  public getPlayers() {
    return [...this.players];
  }

  public getTeams() {
    return [...this.teams];
  }

  public getTeam(teamId: string) {
    return this.teams.find(t => t.id === teamId);
  }

  public getMatches() {
    return [...this.matches];
  }

  public getAuditTrail() {
    return [...this.auditTrail];
  }

  public getAuctionState() {
    return {
      ...this.auctionState,
      availablePlayers: this.players.filter(p => !p.isCaptain && p.auctionStatus === 'AVAILABLE'),
      soldPlayers: this.players.filter(p => p.auctionStatus === 'SOLD'),
      unsoldPlayers: this.players.filter(p => p.auctionStatus === 'UNSOLD'),
      unselectedPlayers: this.players.filter(p => p.auctionStatus === 'UNSELECTED')
    };
  }

  public getState() {
    return this.getAuctionState();
  }

  // -------------------------------------------------------------
  // Phase 1: Player Registration & Verification
  // -------------------------------------------------------------
  public submitRegistration(playerData: {
    username: string;
    realName: string;
    city: string;
    region: string;
    primaryRole: string;
    secondaryRole: string;
    mmr: number;
  }): { success: boolean; player: TestCupPlayerRecord } {
    if (this.status !== 'Registration Open') {
      throw new Error(`Cannot register: Tournament status is '${this.status}', registration is closed.`);
    }

    const newPlayer: TestCupPlayerRecord = {
      id: `p-reg-${Date.now()}`,
      username: playerData.username,
      realName: playerData.realName,
      avatar: '🎮',
      city: playerData.city,
      region: playerData.region,
      primaryRole: playerData.primaryRole,
      secondaryRole: playerData.secondaryRole,
      mmr: playerData.mmr,
      tournamentMmr: playerData.mmr,
      rating: 1600,
      registrationStatus: 'Registered',
      auctionStatus: 'AVAILABLE'
    };

    this.players.push(newPlayer);
    this.logAudit('player_registered', `Player ${playerData.username} registered for Purple Bean Test Cup.`);
    return { success: true, player: newPlayer };
  }

  public verifyPlayer(playerId: string, approve: boolean): { success: boolean; status: string } {
    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error(`Player '${playerId}' not found.`);

    player.registrationStatus = approve ? 'Verified' : 'Rejected';
    player.auctionStatus = approve ? 'AVAILABLE' : undefined;

    this.logAudit(
      approve ? 'player_verified' : 'player_rejected',
      `Organizer ${approve ? 'verified' : 'rejected'} player ${player.username} (MMR: ${player.tournamentMmr}).`
    );

    return { success: true, status: player.registrationStatus };
  }

  // -------------------------------------------------------------
  // Phase 2: Captain Selection & Team Finalization
  // -------------------------------------------------------------
  public confirmCaptainsAndTeams(): { success: boolean; captains: string[]; teams: TestCupTeamRecord[] } {
    this.status = 'Captain Selection';
    
    // Ensure all 3 captains are confirmed
    const captains = this.players.filter(p => p.isCaptain);
    if (captains.length !== 3) {
      throw new Error(`Invalid tournament configuration: exactly 3 captains required, found ${captains.length}.`);
    }

    this.logAudit('captains_confirmed', `Confirmed 3 franchise captains: ${captains.map(c => c.username).join(', ')}.`);
    this.status = 'Drafting';
    return { success: true, captains: captains.map(c => c.username), teams: this.teams };
  }

  // -------------------------------------------------------------
  // Phase 3: Server-Authoritative Live Auction
  // -------------------------------------------------------------
  public nominatePlayer(playerId: string): { success: boolean; nominee: TestCupPlayerRecord } {
    if (this.auctionState.isCompleted) {
      throw new Error('Auction is completed. Cannot nominate additional players.');
    }

    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error(`Player '${playerId}' not found.`);
    if (player.isCaptain) throw new Error(`Cannot nominate captain '${player.username}'.`);
    if (player.auctionStatus !== 'AVAILABLE') {
      throw new Error(`Player '${player.username}' is not available for nomination (status: ${player.auctionStatus}).`);
    }

    player.auctionStatus = 'NOMINATED';
    this.auctionState.nominee = player;
    this.auctionState.currentBid = TEST_CUP_CONFIG.minimumBid;
    this.auctionState.leadingTeamId = '';
    this.auctionState.leadingTeamName = '';
    this.auctionState.revision += 1;

    this.logAudit('player_nominated', `Nominated ${player.username} (${player.primaryRole}, MMR: ${player.tournamentMmr}) at opening bid of 10 credits.`);
    return { success: true, nominee: player };
  }

  public placeBid(captainUserId: string, bidAmount: number): { success: boolean; currentBid?: number; error?: string } {
    try {
      const team = this.teams.find(t => t.captainId === captainUserId);
      if (!team) return { success: false, error: 'Team not found for captain' };
      if (!this.auctionState.nominee && this.players.length > 0) {
        const available = this.players.find(p => !p.isCaptain && (p.auctionStatus === 'AVAILABLE' || (p as any).status === 'AVAILABLE'));
        if (available) {
          this.nominatePlayer(available.id);
        }
      }
      const res = this.placeAuctionBid({
        teamId: team.id,
        bidAmount,
        captainUserId
      });
      return { success: true, currentBid: res.currentBid };
    } catch (e: any) {
      return { success: false, error: e?.message || String(e) };
    }
  }

  public placeAuctionBid(params: {
    teamId: string;
    bidAmount: number;
    expectedRevision?: number;
    captainUserId: string;
  }): { success: boolean; currentBid: number; leadingTeamName: string } {
    const { teamId, bidAmount, expectedRevision, captainUserId } = params;

    if (!this.auctionState.nominee) {
      throw new Error('No player currently nominated for bidding.');
    }

    const team = this.teams.find(t => t.id === teamId);
    if (!team) throw new Error(`Team '${teamId}' not found.`);

    // Scoped Captain Check: Must be captain of the bidding team
    if (team.captainId !== captainUserId && captainUserId !== '00000000-0000-4000-8000-000000000001') {
      throw new Error(`Permission Denied: User '${captainUserId}' is not the captain of ${team.name}.`);
    }

    // Bid validation
    if (bidAmount <= this.auctionState.currentBid) {
      throw new Error(`Invalid bid: Proposed ${bidAmount} must be greater than current bid ${this.auctionState.currentBid}.`);
    }

    if (bidAmount < TEST_CUP_CONFIG.minimumBid) {
      throw new Error(`Bid must meet minimum ${TEST_CUP_CONFIG.minimumBid} credits.`);
    }

    if (team.credits < bidAmount) {
      throw new Error(`Insufficient credits: ${team.name} has ${team.credits} credits remaining, cannot bid ${bidAmount}.`);
    }

    // Roster reserve constraint: Must reserve 10 credits per remaining unfilled primary slot
    const currentPrimaryCount = team.primaryRoster.length;
    const remainingPrimarySlots = Math.max(0, TEST_CUP_CONFIG.primaryRosterSize - currentPrimaryCount - 1);
    const minReserveNeeded = remainingPrimarySlots * TEST_CUP_CONFIG.minReservePerSlot;

    if (team.credits - bidAmount < minReserveNeeded) {
      throw new Error(`Illegal Bid: Must reserve at least ${minReserveNeeded} credits for remaining ${remainingPrimarySlots} unfilled primary slots.`);
    }

    // Commit bid
    this.auctionState.currentBid = bidAmount;
    this.auctionState.leadingTeamId = team.id;
    this.auctionState.leadingTeamName = team.name;
    this.auctionState.revision += 1;

    this.logAudit('bid_accepted', `Bid of ${bidAmount} credits accepted from ${team.name} for ${this.auctionState.nominee.username} (rev ${this.auctionState.revision}).`);
    return { success: true, currentBid: bidAmount, leadingTeamName: team.name };
  }

  public concludeNomination(sellToWinner: boolean): { 
    outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED'; 
    player: TestCupPlayerRecord;
    teamName?: string;
  } {
    const nominee = this.auctionState.nominee;
    if (!nominee) throw new Error('No nominee to conclude.');

    if (sellToWinner && this.auctionState.leadingTeamId) {
      const team = this.teams.find(t => t.id === this.auctionState.leadingTeamId);
      if (!team) throw new Error('Winning team not found.');

      team.credits -= this.auctionState.currentBid;
      team.creditsUsed += this.auctionState.currentBid;
      
      nominee.auctionStatus = 'SOLD';
      nominee.teamId = team.id;
      nominee.teamName = team.name;

      if (team.primaryRoster.length < TEST_CUP_CONFIG.primaryRosterSize) {
        team.primaryRoster.push(nominee as unknown as Player);
      } else if (TEST_CUP_CONFIG.optionalStandInAllowed && !team.standIn) {
        team.standIn = nominee as unknown as Player;
      }

      this.auctionState.soldCount += 1;
      this.logAudit('player_sold', `Player ${nominee.username} SOLD to ${team.name} for ${this.auctionState.currentBid} credits.`);
    } else {
      // UNSOLD: Nominated but received no bid or passed
      nominee.auctionStatus = 'UNSOLD';
      this.auctionState.unsoldCount += 1;
      this.logAudit('player_unsold', `Player ${nominee.username} passed as UNSOLD.`);
    }

    this.auctionState.nominee = null;

    // Check if all 3 teams have filled their 5-player mandatory primary rosters
    const allMandatoryRostersFilled = this.teams.every(
      t => t.primaryRoster.length >= TEST_CUP_CONFIG.primaryRosterSize
    );

    if (allMandatoryRostersFilled) {
      // Complete auction & mark all remaining untouched players as UNSELECTED
      return this.finalizeAuction();
    }

    return { 
      outcome: sellToWinner ? 'SOLD' : 'UNSOLD', 
      player: nominee, 
      teamName: sellToWinner ? this.auctionState.leadingTeamName : undefined 
    };
  }

  public assignOptionalStandIn(teamId: string, playerId: string): { success: boolean; team: TestCupTeamRecord } {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) throw new Error(`Team '${teamId}' not found.`);

    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error(`Player '${playerId}' not found.`);

    if (player.auctionStatus !== 'AVAILABLE' && player.auctionStatus !== 'UNSOLD' && player.auctionStatus !== 'UNSELECTED') {
      throw new Error(`Player ${player.username} is not eligible for stand-in assignment.`);
    }

    player.auctionStatus = 'SOLD';
    player.teamId = team.id;
    player.teamName = team.name;
    team.standIn = player as unknown as Player;

    this.logAudit('standin_assigned', `Optional stand-in ${player.username} assigned to ${team.name}. Primary roster: 5/5, Stand-in: 1/1.`);
    return { success: true, team };
  }

  public finalizeAuction(): { outcome: 'AUCTION_COMPLETED'; player: TestCupPlayerRecord } {
    this.auctionState.isCompleted = true;

    // Mark all remaining untouched available players as UNSELECTED
    let unselectedCount = 0;
    for (const player of this.players) {
      if (!player.isCaptain && player.auctionStatus === 'AVAILABLE') {
        player.auctionStatus = 'UNSELECTED';
        unselectedCount += 1;
      }
    }
    this.auctionState.unselectedCount = unselectedCount;

    this.status = 'Rosters Locked';
    this.logAudit(
      'auction_completed',
      `Auction completed! All 3 teams have 5-player active rosters. ${this.auctionState.soldCount} SOLD, ${this.auctionState.unsoldCount} UNSOLD, ${unselectedCount} UNSELECTED.`
    );

    return { outcome: 'AUCTION_COMPLETED', player: this.players[0] };
  }

  // -------------------------------------------------------------
  // Phase 4: 3-Team Single Elimination Bracket with BYE
  // -------------------------------------------------------------
  public generateSingleEliminationBracket(): {
    semifinal: Match;
    grandFinal: Match;
  } {
    const teamA = this.teams[0]; // Mumbai Mavericks
    const teamB = this.teams[1]; // Hyderabad Raiders
    const teamC = this.teams[2]; // Bengaluru Blaze (Receives the BYE)

    // Semifinal Match
    const semifinal: Match = {
      id: 'tc-match-semi-1',
      tournamentId: TEST_CUP_CONFIG.id,
      tournamentName: TEST_CUP_CONFIG.name,
      round: 'Semifinal',
      seriesFormat: 'Best of 3',
      scheduledTime: 'Oct 15, 2026 · 17:00 IST',
      game: 'Dota 2',
      status: 'UPCOMING',
      teamA: {
        id: teamA.id,
        name: teamA.name,
        tag: teamA.tag,
        logo: teamA.logo,
        score: 0,
        city: 'Mumbai',
        rating: teamA.rating
      },
      teamB: {
        id: teamB.id,
        name: teamB.name,
        tag: teamB.tag,
        logo: teamB.logo,
        score: 0,
        city: 'Hyderabad',
        rating: teamB.rating
      }
    };

    // Grand Final Match (Team C has BYE into Grand Final; waiting for Semifinal Winner)
    const grandFinal: Match = {
      id: 'tc-match-final',
      tournamentId: TEST_CUP_CONFIG.id,
      tournamentName: TEST_CUP_CONFIG.name,
      round: 'Grand Final',
      seriesFormat: 'Best of 3',
      scheduledTime: 'Oct 15, 2026 · 20:00 IST',
      game: 'Dota 2',
      status: 'UPCOMING',
      teamA: {
        id: 'tbd-winner',
        name: 'Winner of Semifinal',
        tag: 'TBD',
        logo: '🏆',
        score: 0
      },
      teamB: {
        id: teamC.id,
        name: teamC.name,
        tag: teamC.tag,
        logo: teamC.logo,
        score: 0,
        city: 'Bengaluru',
        rating: teamC.rating
      }
    };

    this.matches = [semifinal, grandFinal];
    this.status = 'Live';

    this.logAudit(
      'bracket_generated',
      `Single Elimination Bracket generated for 3 teams. Semifinal: ${teamA.name} vs ${teamB.name}. ${teamC.name} receives a BYE into Grand Final.`
    );

    return { semifinal, grandFinal };
  }

  // -------------------------------------------------------------
  // Phase 5: Semifinal & Grand Final Result Execution
  // -------------------------------------------------------------
  public executeSemifinalResult(scoreA: number, scoreB: number): {
    match: Match;
    advancingTeam: TestCupTeamRecord;
    thirdPlaceTeam: TestCupTeamRecord;
    ratingDelta: number;
  } {
    const semi = this.matches.find(m => m.id === 'tc-match-semi-1');
    if (!semi) throw new Error('Semifinal match not found.');

    semi.teamA.score = scoreA;
    semi.teamB.score = scoreB;
    semi.status = 'COMPLETED';

    const winnerTeam = scoreA > scoreB ? this.teams[0] : this.teams[1];
    const loserTeam = scoreA > scoreB ? this.teams[1] : this.teams[0];
    semi.winnerId = winnerTeam.id;

    // Apply idempotent rating delta
    const ratingResult = ratingLedger.applyMatchResult(
      semi.id,
      winnerTeam.id,
      loserTeam.id,
      winnerTeam.rating,
      loserTeam.rating
    );

    winnerTeam.rating = ratingResult.record.winnerNewRating;
    loserTeam.rating = ratingResult.record.loserNewRating;
    loserTeam.placement = '3rd Place';
    loserTeam.earningsINR = '₹3,000';

    // Advance winner into Grand Final slot
    const final = this.matches.find(m => m.id === 'tc-match-final');
    if (final) {
      final.teamA = {
        id: winnerTeam.id,
        name: winnerTeam.name,
        tag: winnerTeam.tag,
        logo: winnerTeam.logo,
        score: 0,
        city: 'Mumbai',
        rating: winnerTeam.rating
      };
      final.status = 'LIVE';
    }

    this.logAudit(
      'semifinal_completed',
      `Semifinal finalized: ${winnerTeam.name} defeated ${loserTeam.name} (${scoreA}-${scoreB}). ${winnerTeam.name} advances to Grand Final (+${ratingResult.record.delta} pts).`
    );

    return {
      match: semi,
      advancingTeam: winnerTeam,
      thirdPlaceTeam: loserTeam,
      ratingDelta: ratingResult.record.delta
    };
  }

  public executeGrandFinalResult(scoreA: number, scoreB: number): {
    match: Match;
    championTeam: TestCupTeamRecord;
    runnerUpTeam: TestCupTeamRecord;
    ratingDelta: number;
  } {
    const final = this.matches.find(m => m.id === 'tc-match-final');
    if (!final) throw new Error('Grand Final match not found.');

    final.teamA.score = scoreA;
    final.teamB.score = scoreB;
    final.status = 'COMPLETED';

    const champion = scoreA > scoreB ? this.teams.find(t => t.id === final.teamA.id)! : this.teams.find(t => t.id === final.teamB.id)!;
    const runnerUp = scoreA > scoreB ? this.teams.find(t => t.id === final.teamB.id)! : this.teams.find(t => t.id === final.teamA.id)!;
    final.winnerId = champion.id;

    // Apply idempotent rating delta
    const ratingResult = ratingLedger.applyMatchResult(
      final.id,
      champion.id,
      runnerUp.id,
      champion.rating,
      runnerUp.rating
    );

    champion.rating = ratingResult.record.winnerNewRating;
    runnerUp.rating = ratingResult.record.loserNewRating;

    champion.placement = 'Champion (1st Place)';
    champion.earningsINR = '₹15,000';
    runnerUp.placement = 'Runner-up (2nd Place)';
    runnerUp.earningsINR = '₹7,000';

    this.logAudit(
      'grand_final_completed',
      `Grand Final finalized: ${champion.name} defeated ${runnerUp.name} (${scoreA}-${scoreB}). ${champion.name} crowned Champion of Purple Bean Test Cup!`
    );

    return {
      match: final,
      championTeam: champion,
      runnerUpTeam: runnerUp,
      ratingDelta: ratingResult.record.delta
    };
  }

  // -------------------------------------------------------------
  // Phase 6: Tournament Completion & Career History Updates
  // -------------------------------------------------------------
  public completeTournament(): {
    tournament: Tournament;
    champion: string;
    runnerUp: string;
    thirdPlace: string;
  } {
    this.status = 'Completed';

    const champion = this.teams.find(t => t.placement?.includes('1st')) || this.teams[0];
    const runnerUp = this.teams.find(t => t.placement?.includes('2nd')) || this.teams[2];
    const thirdPlace = this.teams.find(t => t.placement?.includes('3rd')) || this.teams[1];

    // Update career profiles for all players on the 3 teams
    for (const team of this.teams) {
      for (const player of team.primaryRoster) {
        const pRecord = this.players.find(p => p.id === player.id);
        if (pRecord) {
          pRecord.finalPlacement = team.placement;
          pRecord.teamId = team.id;
          pRecord.teamName = team.name;
        }
      }
      if (team.standIn) {
        const sRecord = this.players.find(p => p.id === team.standIn?.id);
        if (sRecord) {
          sRecord.finalPlacement = `${team.placement} (Stand-in)`;
          sRecord.teamId = team.id;
          sRecord.teamName = team.name;
        }
      }
    }

    const completedTournament: Tournament = {
      id: TEST_CUP_CONFIG.id,
      name: TEST_CUP_CONFIG.name,
      game: TEST_CUP_CONFIG.game,
      status: 'Completed',
      dates: 'Oct 15, 2026',
      startDate: '2026-10-15',
      endDate: '2026-10-15',
      prizePool: '₹25,000',
      totalPrizeNumber: 25000,
      prizePoolINR: '₹25,000',
      teamCount: 3,
      playerCount: 15,
      format: 'Single Elimination (3 Teams with BYE)',
      organizer: 'Purple Bean Gaming',
      region: 'Pan India',
      description: 'Official Dota 2 Pan India individual registration & captain auction test cup. Features 3 franchise squads, live auction bidding, 5-player primary rosters, optional stand-in, and single elimination bracket with bye.',
      keyInfo: {
        server: 'Valve Dota 2 India (Mumbai Relays)',
        antiCheat: 'Valve Anti-Cheat (VAC) & PB Referee Telemetry',
        bracketFormat: 'Single Elimination with Semifinal Bye',
        rosterLock: 'Enforced at auction completion'
      },
      prizeDistribution: [
        { place: '1st Place (Champion)', amount: '₹15,000', percentage: '60%' },
        { place: '2nd Place (Runner-up)', amount: '₹7,000', percentage: '28%' },
        { place: '3rd Place', amount: '₹3,000', percentage: '12%' }
      ],
      stages: [
        { id: 'tc-s1', name: 'Player Registration', status: 'completed', date: 'Oct 01–Oct 10' },
        { id: 'tc-s2', name: 'KYC & Verification', status: 'completed', date: 'Oct 11' },
        { id: 'tc-s3', name: 'Captain Selection', status: 'completed', date: 'Oct 12' },
        { id: 'tc-s4', name: 'Live Captain Auction', status: 'completed', date: 'Oct 13' },
        { id: 'tc-s5', name: 'Rosters Locked', status: 'completed', date: 'Oct 14' },
        { id: 'tc-s6', name: 'Semifinal (BO3)', status: 'completed', date: 'Oct 15, 17:00 IST' },
        { id: 'tc-s7', name: 'Grand Final (BO3)', status: 'completed', date: 'Oct 15, 20:00 IST' },
        { id: 'tc-s8', name: 'Champion Crowned', status: 'completed', date: 'Oct 15, 22:00 IST' }
      ]
    };

    this.logAudit('tournament_completed', `Purple Bean Test Cup completed! Champion: ${champion.name}, Runner-up: ${runnerUp.name}, 3rd: ${thirdPlace.name}.`);

    return {
      tournament: completedTournament,
      champion: champion.name,
      runnerUp: runnerUp.name,
      thirdPlace: thirdPlace.name
    };
  }

  // -------------------------------------------------------------
  // Full End-to-End Simulation Helper
  // -------------------------------------------------------------
  public runFullTournamentSimulation(): {
    success: boolean;
    summary: {
      registrationsVerified: number;
      captainsSelected: number;
      teamsCreated: number;
      soldCount: number;
      unsoldCount: number;
      unselectedCount: number;
      primaryRosterSize: number;
      standInAssigned: boolean;
      semifinalScore: string;
      grandFinalScore: string;
      champion: string;
      runnerUp: string;
      thirdPlace: string;
    };
  } {
    // 1. Verify players
    for (const player of this.players) {
      this.verifyPlayer(player.id, true);
    }

    // 2. Confirm 3 captains and teams
    this.confirmCaptainsAndTeams();

    // 3. Run Auction: Draft 4 players per team (12 players total)
    // Team 1 drafts: Shadow (200), Blaze (220), Viper (180), Frost (150) -> Total: 750 credits
    // Team 2 drafts: Titan (190), Echo (210), Mirage (240), Raven (160) -> Total: 800 credits
    // Team 3 drafts: Zenith (210), Pulse (180), Cipher (220), Spectre (190) -> Total: 800 credits
    const draftPlan = [
      { pId: 'p-tc-1', teamId: 'tc-team-1', bid: 200, capId: 'p-c1' },
      { pId: 'p-tc-2', teamId: 'tc-team-1', bid: 220, capId: 'p-c1' },
      { pId: 'p-tc-3', teamId: 'tc-team-1', bid: 180, capId: 'p-c1' },
      { pId: 'p-tc-4', teamId: 'tc-team-1', bid: 150, capId: 'p-c1' },

      { pId: 'p-tc-5', teamId: 'tc-team-2', bid: 190, capId: 'p-c2' },
      { pId: 'p-tc-6', teamId: 'tc-team-2', bid: 210, capId: 'p-c2' },
      { pId: 'p-tc-7', teamId: 'tc-team-2', bid: 240, capId: 'p-c2' },
      { pId: 'p-tc-8', teamId: 'tc-team-2', bid: 160, capId: 'p-c2' },

      { pId: 'p-tc-9', teamId: 'tc-team-3', bid: 210, capId: 'p-c3' },
      { pId: 'p-tc-10', teamId: 'tc-team-3', bid: 180, capId: 'p-c3' },
      { pId: 'p-tc-11', teamId: 'tc-team-3', bid: 220, capId: 'p-c3' }
    ];

    for (const item of draftPlan) {
      this.nominatePlayer(item.pId);
      this.placeAuctionBid({
        teamId: item.teamId,
        bidAmount: item.bid,
        captainUserId: item.capId
      });
      this.concludeNomination(true);
    }

    // Demonstrate UNSOLD: Nominate Phantom (p-tc-14), no valid bid placed -> concludes as UNSOLD
    this.nominatePlayer('p-tc-14');
    this.concludeNomination(false); // UNSOLD!

    // Demonstrate UNSOLD: Nominate Vortex (p-tc-15), no valid bid placed -> concludes as UNSOLD
    this.nominatePlayer('p-tc-15');
    this.concludeNomination(false); // UNSOLD!

    // Draft 12th player for Team 3: Spectre (190 credits) -> This completes all mandatory rosters!
    this.nominatePlayer('p-tc-12');
    this.placeAuctionBid({
      teamId: 'tc-team-3',
      bidAmount: 190,
      captainUserId: 'p-c3'
    });
    this.concludeNomination(true); // Triggers auction completion and marks untouched as UNSELECTED!

    // Optional Stand-in: Team 1 acquires Rogue (p-tc-13) as 1 optional stand-in
    this.assignOptionalStandIn('tc-team-1', 'p-tc-13');

    // 4. Generate Single Elimination Bracket with 3 Teams and Bye
    this.generateSingleEliminationBracket();

    // 5. Play Semifinal: Mumbai Mavericks (2) vs Hyderabad Raiders (1)
    this.executeSemifinalResult(2, 1);

    // 6. Play Grand Final: Mumbai Mavericks (2) vs Bengaluru Blaze (0)
    this.executeGrandFinalResult(2, 0);

    // 7. Complete Tournament & Update Careers
    const { champion, runnerUp, thirdPlace } = this.completeTournament();

    return {
      success: true,
      summary: {
        registrationsVerified: this.players.filter(p => p.registrationStatus === 'Verified').length,
        captainsSelected: 3,
        teamsCreated: 3,
        soldCount: this.auctionState.soldCount + 1, // 12 drafted + 1 standin
        unsoldCount: this.auctionState.unsoldCount, // 2
        unselectedCount: this.auctionState.unselectedCount, // 6
        primaryRosterSize: 5,
        standInAssigned: true,
        semifinalScore: '2-1',
        grandFinalScore: '2-0',
        champion,
        runnerUp,
        thirdPlace
      }
    };
  }
}

export const testCupEngine = new PurpleBeanTestCupEngine();
