/**
 * Purple Bean Gaming — PBG Player Account Registry & Identity Engine
 * 
 * Automatically provisions permanent PBG IDs (e.g. PBG-000184) upon first Google sign-in.
 * Handles Discord OAuth linking (storing immutable Discord User ID), Steam/Dota linking,
 * role validation, and competitive player profile persistence.
 */

import { PBGPlayerAccount, DotaRolePosition } from '../types/pbgAccount';
import { db, isQuotaExhausted } from '../services/firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY = 'pbg_player_accounts_v1';
const PBG_COUNTER_KEY = 'pbg_player_id_counter_v1';

export class PBGAccountRegistry {
  private accounts: Map<string, PBGPlayerAccount> = new Map(); // Keyed by googleUid
  private pbgIdIndex: Map<string, string> = new Map(); // pbgId -> googleUid
  private discordIdIndex: Map<string, string> = new Map(); // discordUserId -> googleUid
  private dotaIdIndex: Map<string, string> = new Map(); // dotaAccountId -> googleUid
  private steamIdIndex: Map<string, string> = new Map(); // steamId -> googleUid
  private listeners: Set<() => void> = new Set();
  private nextPbgNumber: number = 189; // Baseline sequences start at 189 after 184-188

  constructor() {
    this.seedCanonicalAccounts();
    this.loadFromStorage();
    this.seedCanonicalAccounts();
    this.initFirestoreSync();
  }

  public reload(): void {
    this.seedCanonicalAccounts();
    this.loadFromStorage();
    this.seedCanonicalAccounts();
  }

  public seedCanonicalAccounts(): void {
    // 1. Ensure Santhosh Myana (myana.santhosh@gmail.com) holds PBG-000188
    const santhoshUid = 'dCZd7IjKpxYDBjTQe5FUhccuX583';
    const santhoshEmail = 'myana.santhosh@gmail.com';
    let santhosh = this.accounts.get(santhoshUid) || Array.from(this.accounts.values()).find(a => a.email.toLowerCase() === santhoshEmail);
    if (!santhosh) {
      santhosh = {
        pbgId: 'PBG-000188',
        googleUid: santhoshUid,
        email: santhoshEmail,
        displayName: 'Santhosh Myana',
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKEMfUhTi1ata0in6B1QrYHiFJykqUeoCiE-nuE6wwM6lUCch-Y=s96-c',
        createdAt: '2026-10-02T15:44:36.857Z',
        updatedAt: new Date().toISOString(),
        accountStatus: 'ACTIVE',
        country: 'India',
        region: 'Pan India',
        city: 'Siddipet',
        hasCompletedOnboarding: true,
        dotaAccountLinked: true,
        dotaAccountVerified: true,
        dotaOwnershipVerified: true,
        dotaAccountId: '336333581',
        steamId: '76561198296599309',
        publicMatchDataStatus: 'PUBLIC',
        dotaConnectionStatus: 'CONNECTED',
        discordLinked: true,
        discordUserId: '398688779025776643',
        discordUsername: 'tasteless_chicken',
        discordDisplayName: 'TastelesS ChickeN',
        declaredMmr: 3000,
        tournamentMmr: 3000,
        primaryRole: 'Position 1 — Carry',
        purpleBeanRating: '120 PB',
        tournamentCount: 0,
        matchesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        teamsCount: 0,
        captainCount: 0,
        tournamentHistory: [],
        teamHistory: [],
        matchHistory: [],
        captainHistory: [],
        achievements: []
      };
    } else {
      santhosh.pbgId = 'PBG-000188';
      santhosh.city = santhosh.city || 'Siddipet';
      if (!santhosh.dotaAccountId) santhosh.dotaAccountId = '336333581';
      if (!santhosh.steamId) santhosh.steamId = '76561198296599309';
      if (!santhosh.discordUserId) santhosh.discordUserId = '398688779025776643';
      if (!santhosh.discordUsername) santhosh.discordUsername = 'tasteless_chicken';
    }
    this.accounts.set(santhoshUid, santhosh);
    this.pbgIdIndex.set('PBG-000188', santhoshUid);
    this.pbgIdIndex.delete('PBG-000186'); // Ensure Santhosh does not hold 186

    // 2. Ensure Primary Lead (11106cm009@gmail.com) holds PBG-000186
    const leadUid = 'wUyRsN0f40bYdyCpLp6UNeIJjpD3';
    const leadEmail = '11106cm009@gmail.com';
    let lead = this.accounts.get(leadUid) || Array.from(this.accounts.values()).find(a => a.email.toLowerCase() === leadEmail);
    if (!lead) {
      lead = {
        pbgId: 'PBG-000186',
        googleUid: leadUid,
        email: leadEmail,
        displayName: 'Bharadwaja Anisetti',
        avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKsmb2Rk2NffT53Kqf00QWp4PzT5M9s8dE1e5B6C7D8=s96-c',
        createdAt: '2026-09-25T15:43:21.383Z',
        updatedAt: new Date().toISOString(),
        accountStatus: 'ACTIVE',
        country: 'India',
        region: 'Pan India',
        city: 'Mumbai',
        hasCompletedOnboarding: true,
        dotaAccountLinked: true,
        dotaAccountVerified: true,
        dotaOwnershipVerified: true,
        dotaAccountId: '383650106',
        steamId: '76561198343915834',
        publicMatchDataStatus: 'PUBLIC',
        dotaConnectionStatus: 'CONNECTED',
        discordLinked: true,
        discordUserId: '522114011307966464',
        discordUsername: 'robinhood28',
        discordDisplayName: 'Robinhood',
        purpleBeanRating: '120 PB',
        tournamentCount: 0,
        matchesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        teamsCount: 0,
        captainCount: 0,
        tournamentHistory: [],
        teamHistory: [],
        matchHistory: [],
        captainHistory: [],
        achievements: []
      };
    } else {
      lead.pbgId = 'PBG-000186';
    }
    this.accounts.set(leadUid, lead);
    this.pbgIdIndex.set('PBG-000186', leadUid);
  }

  private loadFromStorage(): void {
    const hasStorage = typeof localStorage !== 'undefined';
    if (!hasStorage && typeof window === 'undefined') return;

    try {
      const savedCounter = localStorage.getItem(PBG_COUNTER_KEY);
      if (savedCounter) {
        const parsed = parseInt(savedCounter, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.nextPbgNumber = parsed;
        }
      }

      const savedAccounts = localStorage.getItem(STORAGE_KEY);
      if (savedAccounts) {
        const list: PBGPlayerAccount[] = JSON.parse(savedAccounts);
        list.forEach((acc) => {
          // Release real user Dota ID if previously held by mock seed
          if (acc.pbgId === 'PBG-000185' && acc.dotaAccountId === '383650106') {
            acc.dotaAccountId = '185000000';
            acc.steamId = '76561198000000185';
          }
          // Enforce immutable canonical administrative PBG IDs
          if (acc.googleUid === 'dCZd7IjKpxYDBjTQe5FUhccuX583' || acc.email?.toLowerCase() === 'myana.santhosh@gmail.com') {
            acc.pbgId = 'PBG-000188';
          }
          if (acc.googleUid === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3' || acc.email?.toLowerCase() === '11106cm009@gmail.com') {
            acc.pbgId = 'PBG-000186';
          }
          if (acc.email?.toLowerCase() === 'neelapuharsha@gmail.com') {
            acc.pbgId = 'PBG-000187';
          }
          // Existing accounts loaded from storage have already been established
          if (acc.hasCompletedOnboarding === undefined) {
            acc.hasCompletedOnboarding = true;
          }
          this.accounts.set(acc.googleUid, acc);
          this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
          if (acc.discordUserId) {
            this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
          }
          if (acc.dotaAccountId) {
            this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
          }
          if (acc.steamId) {
            this.steamIdIndex.set(acc.steamId, acc.googleUid);
          }
        });
      }

      // Seed baseline example account PBG-000184 (Bharadwaja) if registry is empty
      if (this.accounts.size === 0) {
        const baselineAccount: PBGPlayerAccount = {
          pbgId: 'PBG-000184',
          googleUid: 'google_uid_bharadwaja_000184',
          email: 'user@gmail.com',
          displayName: 'Bharadwaja',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja',
          createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          accountStatus: 'ACTIVE',
          country: 'India',
          region: 'Pan India',
          city: 'Mumbai',
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(Date.now() - 30 * 86400000).toISOString(),

          // Discord Account Identity (OAuth Authorized)
          discordUserId: '123456789012345678',
          discordUsername: 'playername',
          discordDisplayName: 'Player Name',
          discordAvatar: 'https://cdn.discordapp.com/embed/avatars/0.png',
          discordLinked: true,
          discordLinkedAt: new Date(Date.now() - 25 * 86400000).toISOString(),

          // Steam & Dota Account Identity (Sections 8, 10, 11)
          steamId: '76561198052079950',
          dotaAccountId: '52079950',
          dotaDisplayName: 'Bharadwaja',
          dotaAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja',
          steamPersonaName: 'Bharadwaja',
          steamProfileUrl: 'https://steamcommunity.com/profiles/76561198052079950',
          openDotaProfile: 'https://www.opendota.com/players/52079950',
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          dotaOwnershipVerifiedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
          dotaLinkedAt: new Date(Date.now() - 20 * 86400000).toISOString(),
          publicMatchDataStatus: 'PUBLIC',
          dotaConnectionStatus: 'CONNECTED_DATA_AVAILABLE',
          lastOpenDotaSync: new Date(Date.now() - 15 * 60000).toISOString(),
          lastSuccessfulDataSync: new Date(Date.now() - 15 * 60000).toISOString(),
          dotaRankTier: 74,
          dotaLeaderboardRank: 1240,
          dotaCountryCode: 'IN',

          // Dota Competitive Stats
          declaredMmr: 5600,
          tournamentMmr: 5600,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          purpleBeanRating: '224 PB',

          // Career Histories
          tournamentCount: 3,
          matchesCount: 14,
          winsCount: 9,
          lossesCount: 5,
          teamsCount: 2,
          captainCount: 1,
          tournamentHistory: [
            {
              id: 'tourney-pbg-open-1',
              name: 'Purple Bean Open Season 1',
              date: '2026-08-15',
              teamName: 'Mumbai Mavericks',
              placement: '3rd Place',
              role: 'Position 1 — Carry'
            },
            {
              id: 'tourney-delhi-cup',
              name: 'Delhi Esports Invitational',
              date: '2026-07-20',
              teamName: 'Mavericks Prime',
              placement: 'Runner Up',
              role: 'Position 1 — Carry'
            }
          ],
          teamHistory: [
            {
              id: 'team-mumbai-mav',
              name: 'Mumbai Mavericks',
              tag: 'MM',
              period: '2026 Season 1',
              role: 'Position 1 — Carry'
            },
            {
              id: 'team-free-agent',
              name: 'Hyderabad Raiders (Stand-in)',
              tag: 'HR',
              period: 'Spring 2026',
              role: 'Position 2 — Mid'
            }
          ],
          matchHistory: [
            {
              id: 'match-101',
              tournamentName: 'Purple Bean Open Season 1',
              opponentTeam: 'Hyderabad Raiders',
              result: 'WIN',
              score: '2 - 1',
              date: '2026-08-14'
            },
            {
              id: 'match-102',
              tournamentName: 'Purple Bean Open Season 1',
              opponentTeam: 'Bengaluru Blasters',
              result: 'LOSS',
              score: '1 - 2',
              date: '2026-08-15'
            }
          ],
          captainHistory: [
            {
              tournamentId: 'tourney-delhi-cup',
              tournamentName: 'Delhi Esports Invitational',
              teamName: 'Mavericks Prime',
              record: '4W - 2L'
            }
          ],
          achievements: [
            {
              id: 'ach-1',
              title: 'Top 3 Contender',
              tournamentName: 'Purple Bean Open Season 1',
              placement: '3rd Place',
              date: '2026-08-15',
              badge: '🥉'
            },
            {
              id: 'ach-2',
              title: 'Dota 2 Calibrated 5.6k',
              tournamentName: 'Competitive Rating Engine',
              placement: 'Tier 1 Verified',
              date: '2026-08-01',
              badge: '⚔️'
            }
          ]
        };

        this.accounts.set(baselineAccount.googleUid, baselineAccount);
        this.pbgIdIndex.set(baselineAccount.pbgId, baselineAccount.googleUid);
        if (baselineAccount.discordUserId) {
          this.discordIdIndex.set(baselineAccount.discordUserId, baselineAccount.googleUid);
        }
        if (this.nextPbgNumber <= 184) {
          this.nextPbgNumber = 185;
        }
        this.saveToStorage();
      }

      // Ensure PBG-000185 (ROBINHOOD) is always available as canonical example
      if (!this.pbgIdIndex.has('PBG-000185')) {
        const robinhoodAccount: PBGPlayerAccount = {
          pbgId: 'PBG-000185',
          googleUid: 'google_uid_robinhood_000185',
          email: 'robinhood@purplebeangaming.com',
          displayName: 'ROBINHOOD',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota',
          createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
          updatedAt: new Date().toISOString(),
          accountStatus: 'ACTIVE',
          country: 'India',
          region: 'Pan India',
          city: 'Bengaluru',
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(Date.now() - 14 * 86400000).toISOString(),

          discordUserId: '383650106123456789',
          discordUsername: 'robinhood_dota',
          discordDisplayName: 'ROBINHOOD | PBG',
          discordAvatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
          discordLinked: true,
          discordLinkedAt: new Date(Date.now() - 12 * 86400000).toISOString(),

          steamId: '76561198000000185',
          dotaAccountId: '185000000',
          dotaDisplayName: 'ROBINHOOD',
          dotaAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota',
          steamPersonaName: 'ROBINHOOD',
          steamProfileUrl: 'https://steamcommunity.com/profiles/76561198000000185',
          openDotaProfile: 'https://www.opendota.com/players/185000000',
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          dotaOwnershipVerifiedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          dotaLinkedAt: new Date(Date.now() - 10 * 86400000).toISOString(),
          publicMatchDataStatus: 'PUBLIC',
          dotaConnectionStatus: 'CONNECTED_DATA_AVAILABLE',
          lastOpenDotaSync: new Date(Date.now() - 5 * 60000).toISOString(),
          lastSuccessfulDataSync: new Date(Date.now() - 5 * 60000).toISOString(),
          dotaRankTier: 31, // Archon I
          dotaLeaderboardRank: null,
          dotaCountryCode: 'IN',

          declaredMmr: 2750,
          tournamentMmr: 2820,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          purpleBeanRating: '185 PB',

          tournamentCount: 2,
          matchesCount: 11,
          winsCount: 7,
          lossesCount: 4,
          teamsCount: 1,
          captainCount: 0,
          tournamentHistory: [
            {
              id: 'tourney-delhi-cup',
              name: 'Delhi Esports Invitational',
              date: '2026-07-20',
              teamName: 'Bengaluru Blasters',
              placement: 'Top 4',
              role: 'Position 1 — Carry'
            }
          ],
          teamHistory: [
            {
              id: 'team-bengaluru-blasters',
              name: 'Bengaluru Blasters',
              tag: 'BB',
              period: '2026 Season 1',
              role: 'Position 1 — Carry'
            }
          ],
          matchHistory: [],
          captainHistory: [],
          achievements: [
            {
              id: 'ach-robin-1',
              title: 'Archon Circuit Contender',
              tournamentName: 'Delhi Esports Invitational',
              placement: 'Top 4',
              date: '2026-07-20',
              badge: '🎯'
            }
          ]
        };

        this.accounts.set(robinhoodAccount.googleUid, robinhoodAccount);
        this.pbgIdIndex.set(robinhoodAccount.pbgId, robinhoodAccount.googleUid);
        if (robinhoodAccount.discordUserId) {
          this.discordIdIndex.set(robinhoodAccount.discordUserId, robinhoodAccount.googleUid);
        }
        if (this.nextPbgNumber <= 185) {
          this.nextPbgNumber = 186;
        }
        this.saveToStorage();
      }

      // Ensure Harsha Neelapu is seeded with a strictly unique permanent PBG ID
      const friendEmail = 'neelapuharsha@gmail.com';
      let friendAccount = this.getAccountByEmail(friendEmail);
      if (!friendAccount) {
        friendAccount = {
          pbgId: 'PBG-000187',
          googleUid: 'google_uid_neelapuharsha_000186',
          email: friendEmail,
          displayName: 'Harsha Neelapu',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=HarshaNeelapu',
          createdAt: '2026-09-25T15:43:21.383Z',
          updatedAt: new Date().toISOString(),
          accountStatus: 'ACTIVE',
          country: 'India',
          region: 'Pan India',
          city: 'Hyderabad',
          hasCompletedOnboarding: true,
          onboardingCompletedAt: '2026-09-25T15:43:21.383Z',

          discordUserId: undefined,
          discordUsername: undefined,
          discordDisplayName: undefined,
          discordAvatar: undefined,
          discordLinked: false,
          discordLinkedAt: undefined,

          steamId: undefined,
          dotaAccountId: '186000000',
          dotaDisplayName: 'Harsha Neelapu',
          dotaAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=HarshaNeelapu',
          steamPersonaName: 'Harsha Neelapu',
          steamProfileUrl: undefined,
          openDotaProfile: undefined,
          dotaAccountLinked: false,
          dotaAccountVerified: false,
          dotaOwnershipVerified: false,
          dotaOwnershipVerifiedAt: undefined,
          dotaLinkedAt: undefined,
          publicMatchDataStatus: 'UNKNOWN',
          dotaConnectionStatus: 'NOT_LINKED',
          lastOpenDotaSync: undefined,
          lastSuccessfulDataSync: undefined,
          dotaRankTier: null,
          dotaLeaderboardRank: null,
          dotaCountryCode: 'IN',

          declaredMmr: 4250,
          tournamentMmr: 4250,
          primaryRole: 'Position 3 — Offlane',
          secondaryRole: 'Position 4 — Soft Support',
          purpleBeanRating: 'TIER_2',

          tournamentCount: 1,
          matchesCount: 6,
          winsCount: 4,
          lossesCount: 2,
          teamsCount: 1,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };

        this.accounts.set(friendAccount.googleUid, friendAccount);
        this.pbgIdIndex.set(friendAccount.pbgId, friendAccount.googleUid);
      } else {
        // Enforce canonical PBG-000187 on Harsha Neelapu
        if (friendAccount.pbgId !== 'PBG-000187') {
          this.pbgIdIndex.delete(friendAccount.pbgId);
          friendAccount.pbgId = 'PBG-000187';
          this.pbgIdIndex.set(friendAccount.pbgId, friendAccount.googleUid);
        }
      }

      // Ensure Primary Lead (11106cm009@gmail.com) holds PBG-000186
      const leadEmail = '11106cm009@gmail.com';
      const existingLead = this.getAccountByEmail(leadEmail) || this.accounts.get('wUyRsN0f40bYdyCpLp6UNeIJjpD3');
      if (!existingLead) {
        const newLeadAcc: PBGPlayerAccount = {
          pbgId: 'PBG-000186',
          googleUid: 'wUyRsN0f40bYdyCpLp6UNeIJjpD3',
          email: leadEmail,
          displayName: 'Bharadwaja Anisetti',
          avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocJn4hLtlN-XO5jrSZnUtsIpEalWwHIuYLuTjDne6LNz8AXdUI8=s96-c',
          createdAt: '2026-10-02T12:31:42.265Z',
          updatedAt: new Date().toISOString(),
          accountStatus: 'ACTIVE',
          country: 'India',
          region: 'Pan India',
          city: 'Mumbai',
          hasCompletedOnboarding: true,
          onboardingCompletedAt: '2026-10-02T15:25:44.557Z',
          dotaAccountId: '383650106',
          steamId: '76561198343915834',
          steamPersonaName: 'Robinhood',
          dotaDisplayName: 'Robinhood',
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          publicMatchDataStatus: 'PUBLIC',
          dotaConnectionStatus: 'CONNECTED_DATA_AVAILABLE',
          discordLinked: true,
          discordUserId: '522114011307966464',
          discordUsername: 'robinhood28',
          discordDisplayName: 'Robinhood',
          purpleBeanRating: 'UNRATED',
          tournamentCount: 0,
          matchesCount: 0,
          winsCount: 0,
          lossesCount: 0,
          teamsCount: 0,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };
        this.accounts.set(newLeadAcc.googleUid, newLeadAcc);
        this.pbgIdIndex.set(newLeadAcc.pbgId, newLeadAcc.googleUid);
      } else if (existingLead.pbgId !== 'PBG-000186') {
        this.pbgIdIndex.delete(existingLead.pbgId);
        existingLead.pbgId = 'PBG-000186';
        this.pbgIdIndex.set('PBG-000186', existingLead.googleUid);
      }

      // Ensure Santhosh Myana (myana.santhosh@gmail.com) holds PBG-000188
      const santhoshEmail = 'myana.santhosh@gmail.com';
      const existingSanthosh = this.getAccountByEmail(santhoshEmail) || this.accounts.get('dCZd7IjKpxYDBjTQe5FUhccuX583');
      if (!existingSanthosh) {
        const newSanthoshAcc: PBGPlayerAccount = {
          pbgId: 'PBG-000188',
          googleUid: 'dCZd7IjKpxYDBjTQe5FUhccuX583',
          email: santhoshEmail,
          displayName: 'Santhosh Myana',
          avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocKEMfUhTi1ata0in6B1QrYHiFJykqUeoCiE-nuE6wwM6lUCch-Y=s96-c',
          createdAt: '2026-10-02T15:44:36.857Z',
          updatedAt: new Date().toISOString(),
          accountStatus: 'ACTIVE',
          country: 'India',
          region: 'Pan India',
          city: 'Mumbai',
          hasCompletedOnboarding: true,
          dotaAccountLinked: false,
          dotaAccountVerified: false,
          dotaOwnershipVerified: false,
          publicMatchDataStatus: 'UNKNOWN',
          dotaConnectionStatus: 'NOT_LINKED',
          discordLinked: false,
          purpleBeanRating: 'UNRATED',
          tournamentCount: 0,
          matchesCount: 0,
          winsCount: 0,
          lossesCount: 0,
          teamsCount: 0,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };
        this.accounts.set(newSanthoshAcc.googleUid, newSanthoshAcc);
        this.pbgIdIndex.set(newSanthoshAcc.pbgId, newSanthoshAcc.googleUid);
      } else if (existingSanthosh.pbgId !== 'PBG-000188') {
        this.pbgIdIndex.delete(existingSanthosh.pbgId);
        existingSanthosh.pbgId = 'PBG-000188';
        this.pbgIdIndex.set('PBG-000188', existingSanthosh.googleUid);
      }

      // STRICT UNIQUE PBG ID INVARIANT ENFORCEMENT & SELF-HEALING:
      // If any duplicate PBG ID exists in storage, the authentic owner keeps the ID
      // and duplicate accounts receive a brand-new permanent unique PBG ID!
      const assignedIds = new Map<string, string>(); // pbgId -> googleUid
      for (const acc of Array.from(this.accounts.values())) {
        if (!acc.pbgId) {
          acc.pbgId = this.allocateNextPbgId();
          acc.updatedAt = new Date().toISOString();
        } else if (assignedIds.has(acc.pbgId) && assignedIds.get(acc.pbgId) !== acc.googleUid) {
          // Collision detected! The authentic earlier account keeps the ID, duplicate gets a new unique ID
          const collisionPbgId = acc.pbgId;
          const newUniquePbgId = this.allocateNextPbgId();
          console.warn(`[PBG ID Collision Fixed] Reassigning duplicate PBG ID ${collisionPbgId} on ${acc.displayName} (${acc.email}) to unique ${newUniquePbgId}`);
          this.pbgIdIndex.delete(collisionPbgId);
          acc.pbgId = newUniquePbgId;
          acc.updatedAt = new Date().toISOString();
          this.syncToFirestore(acc);
        }
        assignedIds.set(acc.pbgId, acc.googleUid);
        this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
      }

      const highestNumber = this.getHighestPbgNumber();
      if (this.nextPbgNumber <= highestNumber) {
        this.nextPbgNumber = highestNumber + 1;
      }
      if (this.nextPbgNumber < 189) {
        this.nextPbgNumber = 189;
      }
      this.saveToStorage();
    } catch (e) {
      console.warn('Failed to load PBG accounts from localStorage:', e);
    }
  }

  /**
   * Real-time bidirectional Firestore synchronization for PBG Player Accounts & sequence counters.
   * Guarantees all connected clients, tabs, and devices immediately reflect unique permanent accounts.
   */
  private initFirestoreSync(): void {
    if (typeof window === 'undefined' || !db) return;

    try {
      // 1. Real-time sync of all persistent player accounts in Firestore
      onSnapshot(collection(db, 'pbgAccounts'), (snapshot) => {
        let changed = false;
        snapshot.forEach((docSnap) => {
          const acc = docSnap.data() as PBGPlayerAccount;
          if (acc && acc.pbgId && acc.googleUid) {
            // Enforce immutable canonical administrative PBG IDs
            if (acc.googleUid === 'dCZd7IjKpxYDBjTQe5FUhccuX583' || acc.email?.toLowerCase() === 'myana.santhosh@gmail.com') {
              acc.pbgId = 'PBG-000188';
            }
            if (acc.googleUid === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3' || acc.email?.toLowerCase() === '11106cm009@gmail.com') {
              acc.pbgId = 'PBG-000186';
            }
            if (acc.email?.toLowerCase() === 'neelapuharsha@gmail.com') {
              acc.pbgId = 'PBG-000187';
            }

            const existing = this.accounts.get(acc.googleUid);
            const isDifferent = !existing ||
              existing.pbgId !== acc.pbgId ||
              existing.dotaAccountId !== acc.dotaAccountId ||
              existing.steamId !== acc.steamId ||
              existing.discordUserId !== acc.discordUserId ||
              existing.dotaAccountVerified !== acc.dotaAccountVerified ||
              existing.dotaAccountLinked !== acc.dotaAccountLinked ||
              existing.discordLinked !== acc.discordLinked ||
              existing.displayName !== acc.displayName ||
              existing.email !== acc.email ||
              existing.updatedAt !== acc.updatedAt;

            if (isDifferent) {
              this.accounts.set(acc.googleUid, acc);
              this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
              if (acc.discordUserId) this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
              if (acc.dotaAccountId) this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
              if (acc.steamId) this.steamIdIndex.set(acc.steamId, acc.googleUid);
              changed = true;
            }
          }
        });

        if (changed) {
          const highestNumber = this.getHighestPbgNumber();
          if (this.nextPbgNumber <= highestNumber) {
            this.nextPbgNumber = highestNumber + 1;
          }
          this.saveToStorage();
          this.notify();
        }
      }, (err) => {
        console.warn('Firestore pbgAccounts sync listener deferred:', err);
      });

      // 2. Real-time sync of centralized sequence counter
      onSnapshot(doc(db, 'system_counters', 'pbg_counter'), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data?.currentCounter === 'number') {
            const nextVal = data.currentCounter + 1;
            if (nextVal > this.nextPbgNumber) {
              this.nextPbgNumber = nextVal;
              this.saveToStorage();
            }
          }
        }
      }, (err) => {
        console.warn('Firestore pbg_counter sync listener deferred:', err);
      });
    } catch (e) {
      console.warn('Firestore sync init error:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(PBG_COUNTER_KEY, this.nextPbgNumber.toString());
      const list = Array.from(this.accounts.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save PBG accounts to localStorage:', e);
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('PBGAccountRegistry listener error:', err);
      }
    });
  }

  /**
   * Formats numeric counter to permanent PBG ID string (e.g., PBG-000184)
   */
  public formatPbgId(num: number): string {
    return `PBG-${num.toString().padStart(6, '0')}`;
  }

  /**
   * Scans all accounts in memory to discover the highest allocated PBG numerical index
   */
  public getHighestPbgNumber(): number {
    let highest = 184;
    for (const acc of this.accounts.values()) {
      if (!acc.pbgId) continue;
      const match = acc.pbgId.match(/^PBG-(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > highest) {
          highest = val;
        }
      }
    }
    return highest;
  }

  /**
   * Generates a guaranteed globally UNIQUE, permanent PBG ID
   * Invariant: Never produces an ID that matches any existing account in memory or index!
   */
  public allocateNextPbgId(): string {
    const highestUsed = this.getHighestPbgNumber();
    if (this.nextPbgNumber <= highestUsed) {
      this.nextPbgNumber = highestUsed + 1;
    }
    let candidate = this.formatPbgId(this.nextPbgNumber);
    while (
      this.pbgIdIndex.has(candidate) ||
      Array.from(this.accounts.values()).some((a) => a.pbgId?.toUpperCase() === candidate.toUpperCase())
    ) {
      this.nextPbgNumber += 1;
      candidate = this.formatPbgId(this.nextPbgNumber);
    }
    const allocatedNum = this.nextPbgNumber;
    this.nextPbgNumber += 1;
    this.saveToStorage();

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      setDoc(doc(db, 'system_counters', 'pbg_counter'), {
        currentCounter: allocatedNum,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
    }

    return candidate;
  }

  /**
   * Get existing PBG account by Google UID or email
   */
  public getAccountByUid(googleUid: string): PBGPlayerAccount | undefined {
    if (googleUid === 'dCZd7IjKpxYDBjTQe5FUhccuX583') {
      const acc = this.accounts.get(googleUid) || this.getAccountByEmail('myana.santhosh@gmail.com');
      if (acc) {
        acc.pbgId = 'PBG-000188';
        return acc;
      }
    }
    if (googleUid === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3') {
      const acc = this.accounts.get(googleUid) || this.getAccountByEmail('11106cm009@gmail.com');
      if (acc) {
        acc.pbgId = 'PBG-000186';
        return acc;
      }
    }
    return this.accounts.get(googleUid);
  }

  public getAccountByPbgId(pbgId: string): PBGPlayerAccount | undefined {
    const clean = pbgId.toUpperCase().trim();
    if (clean === 'PBG-000188') {
      const acc = this.accounts.get('dCZd7IjKpxYDBjTQe5FUhccuX583') || this.getAccountByEmail('myana.santhosh@gmail.com');
      if (acc) {
        acc.pbgId = 'PBG-000188';
        return acc;
      }
    }
    if (clean === 'PBG-000186') {
      const acc = this.accounts.get('wUyRsN0f40bYdyCpLp6UNeIJjpD3') || this.getAccountByEmail('11106cm009@gmail.com');
      if (acc) {
        acc.pbgId = 'PBG-000186';
        return acc;
      }
    }
    if (clean === 'PBG-000187') {
      return this.getAccountByEmail('neelapuharsha@gmail.com');
    }
    if (clean === 'PBG-000185') {
      return this.getAccountByEmail('robinhood@pbg.gg') || Array.from(this.accounts.values()).find(a => a.pbgId === 'PBG-000185');
    }
    if (clean === 'PBG-000184') {
      return this.getAccountByEmail('user@gmail.com') || this.accounts.get('google_uid_bharadwaja_000184');
    }
    const uid = this.pbgIdIndex.get(clean);
    return uid ? this.accounts.get(uid) : undefined;
  }

  public getAccountByDotaId(dotaId: string): PBGPlayerAccount | undefined {
    const target = dotaId.trim();
    return Array.from(this.accounts.values()).find(
      (acc) => acc.dotaAccountId === target
    );
  }

  public getAccountBySteamId(steamId: string): PBGPlayerAccount | undefined {
    const target = steamId.trim();
    return Array.from(this.accounts.values()).find(
      (acc) => acc.steamId === target
    );
  }

  public getAccountByEmail(email: string): PBGPlayerAccount | undefined {
    const target = email.toLowerCase().trim();
    if (target === 'myana.santhosh@gmail.com') {
      const acc = Array.from(this.accounts.values()).find(a => a.email.toLowerCase().trim() === target || a.googleUid === 'dCZd7IjKpxYDBjTQe5FUhccuX583');
      if (acc) {
        acc.pbgId = 'PBG-000188';
        return acc;
      }
    }
    if (target === '11106cm009@gmail.com') {
      const acc = Array.from(this.accounts.values()).find(a => a.email.toLowerCase().trim() === target || a.googleUid === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3');
      if (acc) {
        acc.pbgId = 'PBG-000186';
        return acc;
      }
    }
    return Array.from(this.accounts.values()).find(
      (acc) => acc.email.toLowerCase().trim() === target
    );
  }

  public getAccountByDiscordId(discordUserId: string): PBGPlayerAccount | undefined {
    const target = discordUserId.trim();
    const uid = this.discordIdIndex.get(target);
    if (uid) return this.accounts.get(uid);
    return Array.from(this.accounts.values()).find(
      (acc) => acc.discordUserId === target
    );
  }

  public getAllAccounts(): PBGPlayerAccount[] {
    return Array.from(this.accounts.values());
  }

  /**
   * Registers or updates a PBG Player Account directly (for testing, seeding, or administrative operations).
   */
  public registerOrUpdateAccount(data: Partial<PBGPlayerAccount> & { pbgId: string; email?: string }): PBGPlayerAccount {
    const googleUid = data.googleUid || `uid_${data.pbgId}`;
    let acc = this.accounts.get(googleUid) || (data.email ? this.getAccountByEmail(data.email) : undefined) || this.getAccountByPbgId(data.pbgId);
    if (!acc) {
      const { pbgId, ...rest } = data;
      acc = {
        pbgId,
        googleUid,
        email: data.email || `${pbgId.toLowerCase()}@pbg.test`,
        displayName: data.displayName || pbgId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        accountStatus: 'ACTIVE',
        country: 'India',
        region: 'Pan India',
        city: 'Mumbai',
        hasCompletedOnboarding: true,
        dotaAccountLinked: Boolean(data.dotaAccountId),
        dotaAccountVerified: Boolean(data.dotaAccountId),
        dotaAccountId: data.dotaAccountId,
        steamId: data.steamId,
        discordLinked: Boolean(data.discordUserId),
        discordUserId: data.discordUserId,
        discordUsername: data.discordUsername,
        discordMemberVerified: data.discordMemberVerified ?? true,
        ...rest
      } as PBGPlayerAccount;
    } else {
      Object.assign(acc, data);
    }
    this.accounts.set(acc.googleUid, acc);
    this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
    if (acc.discordUserId) this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
    if (acc.dotaAccountId) this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
    if (acc.steamId) this.steamIdIndex.set(acc.steamId, acc.googleUid);
    return acc;
  }

  /**
   * Automatically creates or returns a PBG Player Account upon Google Sign-In.
   * Ensures every player immediately receives their unique PBG ID, Google metadata,
   * and initial UNRATED default state.
   */
  public getOrCreatePBGAccount(params: {
    googleUid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    country?: string;
    region?: string;
  }): { account: PBGPlayerAccount; isFirstTime: boolean } {
    const cleanEmail = params.email.toLowerCase().trim();
    const existing = this.accounts.get(params.googleUid) || this.getAccountByEmail(cleanEmail);
    if (existing) {
      if (existing.googleUid !== params.googleUid) {
        this.accounts.delete(existing.googleUid);
        existing.googleUid = params.googleUid;
        this.accounts.set(params.googleUid, existing);
        this.pbgIdIndex.set(existing.pbgId, params.googleUid);
      }
      // Sync Google profile updates if provided
      let changed = false;
      if (params.photoURL && params.photoURL !== existing.avatarUrl) {
        existing.avatarUrl = params.photoURL;
        changed = true;
      }
      if (changed) {
        existing.updatedAt = new Date().toISOString();
        this.saveToStorage();
        this.notify();
      }
      return { account: existing, isFirstTime: false };
    }

    // Check if user has already completed or dismissed onboarding in local persistence
    const alreadyCompleted = this.hasUserCompletedOnboarding(params.googleUid);

    // Allocate permanent unique PBG ID (e.g. PBG-000184)
    const newPbgId = this.allocateNextPbgId();
    const now = new Date().toISOString();
    const defaultDisplayName = 
      params.displayName || 
      cleanEmail.split('@')[0].replace(/[._]/g, ' ') || 
      'PBG Player';

    const newAccount: PBGPlayerAccount = {
      pbgId: newPbgId,
      googleUid: params.googleUid,
      email: cleanEmail,
      displayName: defaultDisplayName,
      avatarUrl: params.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${params.googleUid}`,
      createdAt: now,
      updatedAt: now,
      accountStatus: 'ACTIVE',
      country: params.country || 'India',
      region: params.region || 'Pan India',
      city: 'Mumbai',
      hasCompletedOnboarding: alreadyCompleted,
      onboardingCompletedAt: alreadyCompleted ? now : undefined,

      // Discord Identity (initially empty)
      discordUserId: undefined,
      discordUsername: undefined,
      discordDisplayName: undefined,
      discordAvatar: undefined,
      discordLinked: false,
      discordLinkedAt: undefined,

      // Steam & Dota Identity (initially empty, Section 10 & 11)
      steamId: undefined,
      dotaAccountId: undefined,
      dotaDisplayName: undefined,
      dotaAvatar: undefined,
      steamPersonaName: undefined,
      steamProfileUrl: undefined,
      openDotaProfile: undefined,
      dotaAccountLinked: false,
      dotaAccountVerified: false,
      dotaOwnershipVerified: false,
      dotaOwnershipVerifiedAt: undefined,
      dotaLinkedAt: undefined,
      publicMatchDataStatus: 'UNKNOWN',
      dotaConnectionStatus: 'NOT_LINKED',
      lastOpenDotaSync: undefined,
      lastSuccessfulDataSync: undefined,
      dotaRankTier: null,
      dotaLeaderboardRank: null,
      dotaCountryCode: undefined,

      // Dota Competitive Stats
      declaredMmr: null,
      tournamentMmr: null,
      primaryRole: null,
      secondaryRole: null,
      purpleBeanRating: 'UNRATED',

      // Career Stats
      tournamentCount: 0,
      matchesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      teamsCount: 0,
      captainCount: 0,
      tournamentHistory: [],
      teamHistory: [],
      matchHistory: [],
      captainHistory: [],
      achievements: []
    };

    this.accounts.set(params.googleUid, newAccount);
    this.pbgIdIndex.set(newPbgId, params.googleUid);
    this.saveToStorage();

    // Asynchronously sync to Firestore pbgAccounts collection
    this.syncToFirestore(newAccount);

    this.notify();
    return { account: newAccount, isFirstTime: !alreadyCompleted };
  }

  /**
   * Checks whether a user has already completed or dismissed the onboarding walkthrough.
   * Prevents re-opening the wizard on subsequent logins.
   */
  public hasUserCompletedOnboarding(googleUid: string): boolean {
    if (!googleUid) return true;
    const acc = this.accounts.get(googleUid);
    if (acc?.hasCompletedOnboarding) return true;
    
    // Check if account has any existing activity (credentials, tournament history, match stats, or custom roles)
    if (acc) {
      if (acc.dotaAccountId || acc.steamId || acc.discordUserId || acc.matchesCount > 0 || acc.tournamentCount > 0) {
        return true;
      }
      if (acc.declaredMmr && acc.declaredMmr > 0) return true;
      if (acc.primaryRole || acc.secondaryRole) return true;
      // If account was created earlier than the current session, it's not a first-time login
      if (acc.createdAt && (Date.now() - new Date(acc.createdAt).getTime() > 60000)) {
        return true;
      }
    }

    if (typeof window !== 'undefined') {
      try {
        if (
          localStorage.getItem(`pbg_onboarded_${googleUid}`) === 'true' ||
          localStorage.getItem(`pbg_onboarding_completed_${googleUid}`) === 'true' ||
          (acc?.pbgId && localStorage.getItem(`pbg_onboarded_${acc.pbgId}`) === 'true') ||
          (acc?.pbgId && localStorage.getItem(`pbg_onboarding_completed_${acc.pbgId}`) === 'true') ||
          sessionStorage.getItem(`pbg_onboarded_${googleUid}`) === 'true'
        ) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  /**
   * Marks onboarding walkthrough as completed permanently in memory, localStorage, and Firestore.
   */
  public completeOnboarding(googleUid: string): PBGPlayerAccount | undefined {
    const acc = this.accounts.get(googleUid);
    if (acc) {
      acc.hasCompletedOnboarding = true;
      acc.onboardingCompletedAt = new Date().toISOString();
      acc.updatedAt = new Date().toISOString();
      this.saveToStorage();
      this.syncToFirestore(acc);
      this.notify();
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`pbg_onboarded_${googleUid}`, 'true');
        localStorage.setItem(`pbg_onboarding_completed_${googleUid}`, 'true');
        sessionStorage.setItem(`pbg_onboarded_${googleUid}`, 'true');
        if (acc?.pbgId) {
          localStorage.setItem(`pbg_onboarded_${acc.pbgId}`, 'true');
          localStorage.setItem(`pbg_onboarding_completed_${acc.pbgId}`, 'true');
        }
      } catch {}
    }
    return acc;
  }

  /**
   * Updates basic player profile information (Display Name, Country, Region, City)
   */
  public updateBasicProfile(
    googleUid: string,
    updates: {
      displayName?: string;
      country?: string;
      region?: string;
      city?: string;
      avatarUrl?: string;
    }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    if (updates.displayName !== undefined) {
      const trimmed = updates.displayName.trim();
      if (!trimmed || trimmed.length < 2) {
        return { success: false, error: 'Display Name must be at least 2 characters.' };
      }
      acc.displayName = trimmed;
    }

    if (updates.country !== undefined) acc.country = updates.country;
    if (updates.region !== undefined) acc.region = updates.region;
    if (updates.city !== undefined) acc.city = updates.city;
    if (updates.avatarUrl !== undefined) acc.avatarUrl = updates.avatarUrl;

    acc.updatedAt = new Date().toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Connects Discord Account through OAuth
   * Stores the permanent, immutable Discord User ID (Snowflake)
   */
  public linkDiscordAccount(
    googleUid: string,
    discordData: {
      discordUserId: string; // 17-20 digit Discord Snowflake ID
      discordUsername: string;
      discordDisplayName?: string;
      globalName?: string | null;
      discordAvatar?: string;
    }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    const discordUid = discordData.discordUserId.trim();
    if (!discordUid || !/^\d{16,20}$/.test(discordUid)) {
      return { success: false, error: 'Invalid Discord User ID. Must be a valid 17-20 digit Discord Snowflake ID.' };
    }

    // Check if another PBG account is already linked to this Discord User ID
    const existingUid = this.discordIdIndex.get(discordUid);
    if (existingUid && existingUid !== googleUid) {
      const existingAcc = this.accounts.get(existingUid);
      return { 
        success: false, 
        error: `This Discord account is already linked to PBG Account ${existingAcc?.pbgId || 'another user'}. A Discord account can only be linked to one PBG account.` 
      };
    }

    const globalName = discordData.globalName || discordData.discordDisplayName || null;
    const now = Date.now();

    acc.discord = {
      userId: discordUid,
      username: discordData.discordUsername.trim(),
      globalName,
      avatarUrl: discordData.discordAvatar || null,
      connectedAt: now,
      verified: true
    };

    acc.discordUserId = discordUid;
    acc.discordUsername = discordData.discordUsername.trim();
    acc.discordDisplayName = globalName || discordData.discordUsername.trim();
    acc.discordAvatar = discordData.discordAvatar;
    acc.discordLinked = true;
    acc.discordLinkedAt = new Date(now).toISOString();
    acc.updatedAt = new Date(now).toISOString();

    this.discordIdIndex.set(discordUid, googleUid);
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Disconnects Discord Account
   */
  public disconnectDiscordAccount(googleUid: string): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    if (acc.discordUserId) {
      this.discordIdIndex.delete(acc.discordUserId);
    }

    acc.discord = null;
    acc.discordUserId = undefined;
    acc.discordUsername = undefined;
    acc.discordDisplayName = undefined;
    acc.discordAvatar = undefined;
    acc.discordLinked = false;
    acc.discordLinkedAt = undefined;
    acc.updatedAt = new Date().toISOString();

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Checks whether a Dota Account ID or Steam64 ID is available or already linked
   * Enforces 1 Steam Account = 1 PBG Account, and 1 Dota Account ID = 1 PBG Account (Section 6)
   */
  public checkDotaAccountLinkability(
    dotaAccountId: string,
    steamId64: string,
    currentGoogleUid: string
  ): { available: boolean; error?: string; existingPbgId?: string } {
    const cleanDota = dotaAccountId.trim();
    const cleanSteam = steamId64.trim();

    const existingUidByDota = this.dotaIdIndex.get(cleanDota);
    if (existingUidByDota && existingUidByDota !== currentGoogleUid) {
      const existingAcc = this.accounts.get(existingUidByDota);
      if (existingAcc?.pbgId === 'PBG-000185' || existingUidByDota.startsWith('google_uid_robinhood_')) {
        this.dotaIdIndex.delete(cleanDota);
        if (existingAcc) {
          existingAcc.dotaAccountId = undefined;
          existingAcc.dotaAccountLinked = false;
        }
      } else {
        return {
          available: false,
          existingPbgId: existingAcc?.pbgId,
          error: `This Dota account (ID: ${cleanDota}) is already linked to PBG Account ${existingAcc?.pbgId || 'another player'}. Each Dota account can only be linked to one PBG identity.`
        };
      }
    }

    const existingUidBySteam = this.steamIdIndex.get(cleanSteam);
    if (existingUidBySteam && existingUidBySteam !== currentGoogleUid) {
      const existingAcc = this.accounts.get(existingUidBySteam);
      if (existingAcc?.pbgId === 'PBG-000185' || existingUidBySteam.startsWith('google_uid_robinhood_')) {
        this.steamIdIndex.delete(cleanSteam);
        if (existingAcc) {
          existingAcc.steamId = undefined;
          existingAcc.dotaAccountLinked = false;
        }
      } else {
        return {
          available: false,
          existingPbgId: existingAcc?.pbgId,
          error: `This Steam account (Steam64: ${cleanSteam}) is already linked to PBG Account ${existingAcc?.pbgId || 'another player'}. Each Steam account can only be linked to one PBG identity.`
        };
      }
    }

    return { available: true };
  }

  /**
   * Connects Steam and Dota Account
   * Normalizes Steam64 and Steam32 (Dota ID)
   */
  public linkSteamDotaAccount(
    googleUid: string,
    steamInput: string,
    dotaDisplayName?: string,
    options?: { isVerified?: boolean }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    const raw = steamInput.trim();
    let steam64 = '';
    let dotaId32 = '';

    // Convert input: whether 17-digit Steam64, 32-bit Dota ID, or URL
    if (/^https?:\/\/steamcommunity\.com\/profiles\/(\d{17})/i.test(raw)) {
      const match = raw.match(/profiles\/(\d{17})/i);
      steam64 = match ? match[1] : '';
    } else if (/^\d{17}$/.test(raw)) {
      steam64 = raw;
    } else if (/^\d{6,10}$/.test(raw)) {
      // Input is 32-bit Dota ID
      dotaId32 = raw;
      try {
        const base = BigInt('76561197960265728');
        steam64 = (base + BigInt(dotaId32)).toString();
      } catch {
        steam64 = `76561198${dotaId32.padStart(9, '0')}`;
      }
    } else {
      return { 
        success: false, 
        error: 'Invalid Steam/Dota identifier. Provide a 17-digit Steam64 ID (e.g. 76561198012345678) or Dota 32-bit ID (e.g. 52079950).' 
      };
    }

    if (!dotaId32 && steam64) {
      try {
        const base = BigInt('76561197960265728');
        dotaId32 = (BigInt(steam64) - base).toString();
      } catch {
        dotaId32 = steam64.slice(-9);
      }
    }

    // Enforce 1:1 uniqueness check
    const check = this.checkDotaAccountLinkability(dotaId32, steam64, googleUid);
    if (!check.available) {
      return { success: false, error: check.error };
    }

    // Clean up old indexes if replacing
    if (acc.dotaAccountId && acc.dotaAccountId !== dotaId32) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId && acc.steamId !== steam64) {
      this.steamIdIndex.delete(acc.steamId);
    }

    const now = new Date().toISOString();
    const isVerified = Boolean(options?.isVerified);
    acc.steamId = steam64;
    acc.dotaAccountId = dotaId32;
    acc.dotaDisplayName = dotaDisplayName || acc.displayName;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaId32}`;
    acc.steamProfileUrl = `https://steamcommunity.com/profiles/${steam64}`;
    acc.dotaAccountLinked = isVerified;
    acc.dotaAccountVerified = isVerified;
    acc.dotaOwnershipVerified = isVerified;
    acc.dotaOwnershipVerifiedAt = isVerified ? now : undefined;
    acc.dotaLinkedAt = isVerified ? now : undefined;
    acc.publicMatchDataStatus = isVerified ? 'PUBLIC' : 'UNKNOWN';
    acc.dotaConnectionStatus = isVerified ? 'CONNECTED_DATA_AVAILABLE' : 'NOT_LINKED';
    acc.lastOpenDotaSync = now;
    acc.lastSuccessfulDataSync = isVerified ? now : undefined;
    acc.updatedAt = now;

    if (isVerified) {
      this.dotaIdIndex.set(dotaId32, googleUid);
      this.steamIdIndex.set(steam64, googleUid);
    }

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Verifies and links Dota 2 account through Steam OpenID verification (Sections 5, 6, 7, 10)
   */
  public verifyAndLinkDotaAccount(
    googleUid: string,
    details: {
      steamId64: string;
      dotaAccountId: string;
      dotaDisplayName?: string;
      steamPersonaName?: string;
      steamAvatar?: string;
      steamProfileUrl?: string;
      rankTier?: number | null;
      leaderboardRank?: number | null;
      countryCode?: string;
      publicMatchDataStatus: 'PUBLIC' | 'PRIVATE';
    }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    const { dotaAccountId, steamId64 } = details;

    // Enforce 1:1 uniqueness check (Section 6)
    const check = this.checkDotaAccountLinkability(dotaAccountId, steamId64, googleUid);
    if (!check.available) {
      return { success: false, error: check.error };
    }

    // Clean up old indexes
    if (acc.dotaAccountId && acc.dotaAccountId !== dotaAccountId) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId && acc.steamId !== steamId64) {
      this.steamIdIndex.delete(acc.steamId);
    }

    const now = new Date().toISOString();
    acc.steamId = steamId64;
    acc.dotaAccountId = dotaAccountId;
    acc.dotaDisplayName = details.dotaDisplayName || details.steamPersonaName || acc.displayName;
    acc.steamPersonaName = details.steamPersonaName;
    acc.steamProfileUrl = details.steamProfileUrl || `https://steamcommunity.com/profiles/${steamId64}`;
    acc.dotaAvatar = details.steamAvatar || acc.avatarUrl;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaAccountId}`;
    acc.dotaAccountLinked = true;
    acc.dotaAccountVerified = true;
    acc.dotaOwnershipVerified = true;
    acc.dotaOwnershipVerifiedAt = now;
    acc.dotaLinkedAt = now;
    acc.publicMatchDataStatus = details.publicMatchDataStatus;
    acc.dotaConnectionStatus = details.publicMatchDataStatus === 'PUBLIC' ? 'CONNECTED_DATA_AVAILABLE' : 'PRIVATE_DATA';
    acc.lastOpenDotaSync = now;
    if (details.publicMatchDataStatus === 'PUBLIC') {
      acc.lastSuccessfulDataSync = now;
    }
    acc.dotaRankTier = details.rankTier ?? acc.dotaRankTier;
    acc.dotaLeaderboardRank = details.leaderboardRank ?? acc.dotaLeaderboardRank;
    acc.dotaCountryCode = details.countryCode ?? acc.dotaCountryCode;
    acc.updatedAt = now;

    this.dotaIdIndex.set(dotaAccountId, googleUid);
    this.steamIdIndex.set(steamId64, googleUid);

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Synchronizes server-verified Steam/Dota account status from Firestore/Backend into local registry.
   */
  public syncVerifiedSteamAccount(
    googleUid: string,
    details: {
      steamId64: string;
      dotaAccountId: string;
      steamPersonaName?: string;
      steamAvatar?: string;
      steamProfileUrl?: string;
      rankTier?: number | null;
      leaderboardRank?: number | null;
      publicMatchDataStatus?: 'PUBLIC' | 'PRIVATE';
    }
  ): PBGPlayerAccount | null {
    let acc = this.accounts.get(googleUid);
    if (!acc) {
      for (const a of this.accounts.values()) {
        if (a.googleUid === googleUid) {
          acc = a;
          break;
        }
      }
    }
    if (!acc) {
      acc = this.getAccountByEmail(googleUid);
    }
    if (!acc) return null;

    const { dotaAccountId, steamId64 } = details;
    const now = new Date().toISOString();

    // Short-circuit if account is already verified with identical data to prevent loops
    if (
      acc.steamId === steamId64 &&
      acc.dotaAccountId === dotaAccountId &&
      acc.dotaAccountVerified === true &&
      acc.dotaOwnershipVerified === true &&
      (details.rankTier === undefined || acc.dotaRankTier === details.rankTier)
    ) {
      return acc;
    }

    // Release any previous account holding this dotaAccountId
    const oldDotaUid = this.dotaIdIndex.get(dotaAccountId);
    if (oldDotaUid && oldDotaUid !== acc.googleUid) {
      const old = this.accounts.get(oldDotaUid);
      if (old) {
        old.dotaAccountId = undefined;
        old.dotaAccountLinked = false;
        old.dotaAccountVerified = false;
        old.dotaOwnershipVerified = false;
      }
      this.dotaIdIndex.delete(dotaAccountId);
    }

    // Release any previous account holding this steamId64
    const oldSteamUid = this.steamIdIndex.get(steamId64);
    if (oldSteamUid && oldSteamUid !== acc.googleUid) {
      const old = this.accounts.get(oldSteamUid);
      if (old) {
        old.steamId = undefined;
        old.dotaAccountLinked = false;
        old.dotaAccountVerified = false;
        old.dotaOwnershipVerified = false;
      }
      this.steamIdIndex.delete(steamId64);
    }

    acc.steamId = steamId64;
    acc.dotaAccountId = dotaAccountId;
    acc.dotaDisplayName = details.steamPersonaName || acc.displayName;
    acc.steamPersonaName = details.steamPersonaName;
    acc.steamProfileUrl = details.steamProfileUrl || `https://steamcommunity.com/profiles/${steamId64}`;
    acc.dotaAvatar = details.steamAvatar || acc.avatarUrl;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaAccountId}`;
    acc.dotaAccountLinked = true;
    acc.dotaAccountVerified = true;
    acc.dotaOwnershipVerified = true;
    acc.dotaOwnershipVerifiedAt = now;
    acc.dotaLinkedAt = acc.dotaLinkedAt || now;
    acc.publicMatchDataStatus = details.publicMatchDataStatus || 'PUBLIC';
    acc.dotaConnectionStatus = (details.publicMatchDataStatus || 'PUBLIC') === 'PUBLIC' ? 'CONNECTED_DATA_AVAILABLE' : 'PRIVATE_DATA';
    acc.lastOpenDotaSync = now;
    acc.lastSuccessfulDataSync = now;
    if (details.rankTier !== undefined) acc.dotaRankTier = details.rankTier;
    if (details.leaderboardRank !== undefined) acc.dotaLeaderboardRank = details.leaderboardRank;
    acc.updatedAt = now;

    this.dotaIdIndex.set(dotaAccountId, acc.googleUid);
    this.steamIdIndex.set(steamId64, acc.googleUid);

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return acc;
  }

  /**
   * Updates public match data status (Section 9 & 44)
   * If a player disables public match data, do NOT unlink Steam/Dota ownership.
   */
  public updatePublicMatchDataStatus(
    googleUid: string,
    status: 'PUBLIC' | 'PRIVATE'
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    const now = new Date().toISOString();
    acc.publicMatchDataStatus = status;
    acc.dotaConnectionStatus = status === 'PUBLIC' ? 'CONNECTED_DATA_AVAILABLE' : 'PRIVATE_DATA';
    acc.lastOpenDotaSync = now;
    if (status === 'PUBLIC') {
      acc.lastSuccessfulDataSync = now;
    }
    acc.updatedAt = now;

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Disconnects Steam & Dota Account
   */
  public disconnectSteamDotaAccount(googleUid: string): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    if (acc.dotaAccountId) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId) {
      this.steamIdIndex.delete(acc.steamId);
    }

    acc.steamId = undefined;
    acc.dotaAccountId = undefined;
    acc.dotaDisplayName = undefined;
    acc.dotaAvatar = undefined;
    acc.steamPersonaName = undefined;
    acc.steamProfileUrl = undefined;
    acc.openDotaProfile = undefined;
    acc.dotaAccountLinked = false;
    acc.dotaAccountVerified = false;
    acc.dotaOwnershipVerified = false;
    acc.dotaOwnershipVerifiedAt = undefined;
    acc.dotaLinkedAt = undefined;
    acc.publicMatchDataStatus = 'UNKNOWN';
    acc.dotaConnectionStatus = 'NOT_LINKED';
    acc.dotaRankTier = null;
    acc.dotaLeaderboardRank = null;
    acc.updatedAt = new Date().toISOString();

    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Configures Dota competitive information: MMR, Primary Role, Secondary Role
   * Enforces: Primary and Secondary Role CANNOT be the same!
   */
  public updateDotaCompetitiveInfo(
    googleUid: string,
    params: {
      declaredMmr: number;
      primaryRole: DotaRolePosition;
      secondaryRole: DotaRolePosition;
    }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    if (!params.primaryRole || !params.secondaryRole) {
      return { success: false, error: 'Both Primary and Secondary roles must be selected.' };
    }

    if (params.primaryRole === params.secondaryRole) {
      return { 
        success: false, 
        error: 'Primary and Secondary roles cannot be identical. Please choose distinct roles (e.g. Carry & Mid).' 
      };
    }

    if (isNaN(params.declaredMmr) || params.declaredMmr < 100 || params.declaredMmr > 15000) {
      return { success: false, error: 'Dota MMR must be a realistic number between 100 and 15,000.' };
    }

    acc.declaredMmr = params.declaredMmr;
    acc.tournamentMmr = params.declaredMmr;
    acc.primaryRole = params.primaryRole;
    acc.secondaryRole = params.secondaryRole;
    
    // Calculate or preserve Purple Bean Rating
    if (acc.purpleBeanRating === 'UNRATED') {
      acc.purpleBeanRating = `${Math.round(params.declaredMmr / 25)} PB`;
    }

    acc.updatedAt = new Date().toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }

  /**
   * Evaluates tournament eligibility checklist for the player:
   * ✓ PBG Account
   * ✓ Discord Connected
   * ✓ Dota Account Connected
   * ✓ Tournament MMR
   * ✓ Primary Role
   * ✓ Secondary Role
   */
  public getEligibilityChecklist(account?: PBGPlayerAccount): {
    pbgAccount: boolean;
    discordConnected: boolean;
    dotaConnected: boolean;
    mmrSet: boolean;
    primaryRoleSet: boolean;
    secondaryRoleSet: boolean;
    isFullyReady: boolean;
  } {
    if (!account) {
      return {
        pbgAccount: false,
        discordConnected: false,
        dotaConnected: false,
        mmrSet: false,
        primaryRoleSet: false,
        secondaryRoleSet: false,
        isFullyReady: false
      };
    }

    const pbgAccount = Boolean(account.pbgId && account.accountStatus === 'ACTIVE');
    const discordConnected = Boolean(account.discordLinked && account.discordUserId);
    const dotaConnected = Boolean(account.dotaAccountLinked && account.dotaAccountId);
    const mmrSet = typeof account.declaredMmr === 'number' && account.declaredMmr > 0;
    const primaryRoleSet = Boolean(account.primaryRole);
    const secondaryRoleSet = Boolean(account.secondaryRole && account.secondaryRole !== account.primaryRole);

    return {
      pbgAccount,
      discordConnected,
      dotaConnected,
      mmrSet,
      primaryRoleSet,
      secondaryRoleSet,
      isFullyReady: pbgAccount && discordConnected && dotaConnected && mmrSet && primaryRoleSet && secondaryRoleSet
    };
  }

  private lastSyncedHash = new Map<string, string>();

  /**
   * Persists to Firestore pbgAccounts collection when online and quota allows
   */
  private async syncToFirestore(account: PBGPlayerAccount): Promise<void> {
    if (typeof window === 'undefined' || !db || isQuotaExhausted()) return;

    try {
      const serialized = JSON.stringify({
        pbgId: account.pbgId,
        googleUid: account.googleUid,
        steamId: account.steamId,
        dotaAccountId: account.dotaAccountId,
        dotaAccountLinked: account.dotaAccountLinked,
        dotaAccountVerified: account.dotaAccountVerified,
        discordLinked: account.discordLinked,
        discordUserId: account.discordUserId,
        displayName: account.displayName
      });
      if (this.lastSyncedHash.get(account.googleUid) === serialized) {
        return;
      }
      this.lastSyncedHash.set(account.googleUid, serialized);
      await setDoc(doc(db, 'pbgAccounts', account.googleUid), account, { merge: true });
    } catch (e) {
      console.warn('Firestore pbgAccounts sync note (handled offline):', e);
    }
  }

  /**
   * Asynchronously hydrates an account from Firestore on login
   */
  public async hydrateFromFirestore(googleUid: string): Promise<PBGPlayerAccount | undefined> {
    if (typeof window === 'undefined' || !db || isQuotaExhausted()) {
      return this.accounts.get(googleUid);
    }

    try {
      const snap = await getDoc(doc(db, 'pbgAccounts', googleUid));
      if (snap.exists()) {
        const data = snap.data() as PBGPlayerAccount;
        this.accounts.set(googleUid, data);
        this.pbgIdIndex.set(data.pbgId, googleUid);
        if (data.discordUserId) {
          this.discordIdIndex.set(data.discordUserId, googleUid);
        }
        this.saveToStorage();
        this.notify();
        return data;
      }
    } catch (e) {
      console.warn('Firestore hydration note:', e);
    }

    return this.accounts.get(googleUid);
  }

  /**
   * Permanently deletes a PBG player account upon user request
   */
  public async deleteAccount(googleUid: string): Promise<{ success: boolean; message: string }> {
    const acc = this.accounts.get(googleUid);
    if (!acc) {
      return { success: false, message: 'Account not found.' };
    }
    const pbgId = acc.pbgId;
    this.accounts.delete(googleUid);
    this.pbgIdIndex.delete(pbgId);
    if (acc.discordUserId) this.discordIdIndex.delete(acc.discordUserId);
    if (acc.dotaAccountId) this.dotaIdIndex.delete(acc.dotaAccountId);
    if (acc.steamId) this.steamIdIndex.delete(acc.steamId);
    this.saveToStorage();

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await deleteDoc(doc(db, 'pbgAccounts', googleUid));
      } catch (e) {
        console.warn('Firestore account deletion note:', e);
      }
    }
    this.notify();
    return { success: true, message: `Account ${pbgId} permanently deleted.` };
  }
}

export const pbgAccountRegistry = new PBGAccountRegistry();
