/**
 * Purple Bean Gaming — PBG Player Account Registry & Identity Engine
 * 
 * Automatically provisions permanent PBG IDs (e.g. PBG-000184) upon first Google sign-in.
 * Handles Discord OAuth linking (storing immutable Discord User ID), Steam/Dota linking,
 * role validation, and competitive player profile persistence.
 */

import { PBGPlayerAccount, DotaRolePosition } from '../types/pbgAccount';
import { db, isQuotaExhausted } from '../services/firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const STORAGE_KEY = 'pbg_player_accounts_v1';
const PBG_COUNTER_KEY = 'pbg_player_id_counter_v1';

export class PBGAccountRegistry {
  private accounts: Map<string, PBGPlayerAccount> = new Map(); // Keyed by googleUid
  private pbgIdIndex: Map<string, string> = new Map(); // pbgId -> googleUid
  private discordIdIndex: Map<string, string> = new Map(); // discordUserId -> googleUid
  private dotaIdIndex: Map<string, string> = new Map(); // dotaAccountId -> googleUid
  private steamIdIndex: Map<string, string> = new Map(); // steamId -> googleUid
  private listeners: Set<() => void> = new Set();
  private nextPbgNumber: number = 184; // Matches example baseline seed (PBG-000184)

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

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

          discordUserId: '383650106123456789',
          discordUsername: 'robinhood_dota',
          discordDisplayName: 'ROBINHOOD | PBG',
          discordAvatar: 'https://cdn.discordapp.com/embed/avatars/1.png',
          discordLinked: true,
          discordLinkedAt: new Date(Date.now() - 12 * 86400000).toISOString(),

          steamId: '76561198343915834',
          dotaAccountId: '383650106',
          dotaDisplayName: 'ROBINHOOD',
          dotaAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota',
          steamPersonaName: 'ROBINHOOD',
          steamProfileUrl: 'https://steamcommunity.com/profiles/76561198343915834',
          openDotaProfile: 'https://www.opendota.com/players/383650106',
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
    } catch (e) {
      console.warn('Failed to load PBG accounts from localStorage:', e);
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
   * Generates a new unique, permanent PBG ID
   */
  private allocateNextPbgId(): string {
    let candidate = this.formatPbgId(this.nextPbgNumber);
    while (this.pbgIdIndex.has(candidate)) {
      this.nextPbgNumber += 1;
      candidate = this.formatPbgId(this.nextPbgNumber);
    }
    this.nextPbgNumber += 1;
    this.saveToStorage();
    return candidate;
  }

  /**
   * Get existing PBG account by Google UID or email
   */
  public getAccountByUid(googleUid: string): PBGPlayerAccount | undefined {
    return this.accounts.get(googleUid);
  }

  public getAccountByPbgId(pbgId: string): PBGPlayerAccount | undefined {
    const uid = this.pbgIdIndex.get(pbgId.toUpperCase().trim());
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
    return Array.from(this.accounts.values()).find(
      (acc) => acc.email.toLowerCase().trim() === target
    );
  }

  public getAllAccounts(): PBGPlayerAccount[] {
    return Array.from(this.accounts.values());
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
    const existing = this.accounts.get(params.googleUid);
    if (existing) {
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

    // Allocate permanent unique PBG ID (e.g. PBG-000184)
    const newPbgId = this.allocateNextPbgId();
    const now = new Date().toISOString();
    const defaultDisplayName = 
      params.displayName || 
      params.email.split('@')[0].replace(/[._]/g, ' ') || 
      'PBG Player';

    const newAccount: PBGPlayerAccount = {
      pbgId: newPbgId,
      googleUid: params.googleUid,
      email: params.email.toLowerCase().trim(),
      displayName: defaultDisplayName,
      avatarUrl: params.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${params.googleUid}`,
      createdAt: now,
      updatedAt: now,
      accountStatus: 'ACTIVE',
      country: params.country || 'India',
      region: params.region || 'Pan India',
      city: 'Mumbai',

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
    return { account: newAccount, isFirstTime: true };
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
      discordUserId: string; // 17-19 digit Discord Snowflake ID
      discordUsername: string;
      discordDisplayName?: string;
      discordAvatar?: string;
    }
  ): { success: boolean; account?: PBGPlayerAccount; error?: string } {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: 'PBG account not found.' };

    const discordUid = discordData.discordUserId.trim();
    if (!discordUid || !/^\d{16,20}$/.test(discordUid)) {
      return { success: false, error: 'Invalid Discord User ID. Must be a valid 17-19 digit Discord Snowflake ID.' };
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

    acc.discordUserId = discordUid;
    acc.discordUsername = discordData.discordUsername.trim();
    acc.discordDisplayName = discordData.discordDisplayName?.trim() || discordData.discordUsername.trim();
    acc.discordAvatar = discordData.discordAvatar;
    acc.discordLinked = true;
    acc.discordLinkedAt = new Date().toISOString();
    acc.updatedAt = new Date().toISOString();

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
      return {
        available: false,
        existingPbgId: existingAcc?.pbgId,
        error: `This Dota account (ID: ${cleanDota}) is already linked to PBG Account ${existingAcc?.pbgId || 'another player'}. Each Dota account can only be linked to one PBG identity.`
      };
    }

    const existingUidBySteam = this.steamIdIndex.get(cleanSteam);
    if (existingUidBySteam && existingUidBySteam !== currentGoogleUid) {
      const existingAcc = this.accounts.get(existingUidBySteam);
      return {
        available: false,
        existingPbgId: existingAcc?.pbgId,
        error: `This Steam account (Steam64: ${cleanSteam}) is already linked to PBG Account ${existingAcc?.pbgId || 'another player'}. Each Steam account can only be linked to one PBG identity.`
      };
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

  /**
   * Persists to Firestore pbgAccounts collection when online and quota allows
   */
  private async syncToFirestore(account: PBGPlayerAccount): Promise<void> {
    if (typeof window === 'undefined' || !db || isQuotaExhausted()) return;

    try {
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
}

export const pbgAccountRegistry = new PBGAccountRegistry();
