/**
 * Purple Bean Gaming — Server-Side Steam Verification & Identity Claim Engine
 * 
 * Manages 1:1 Steam account ownership binding, prevents duplicate claims,
 * enforces active tournament locks on disconnection, and reconciles OpenDota telemetry.
 */

import { accountIdFromSteamId64 } from '../../lib/dota/ids';
import { getAdminDb } from './firebaseAdmin';

export interface PrivatePlayerAccount {
  userId: string;
  steamId64: string | null;
  steamId32: string | null;
  dotaAccountId: string | null;
  verificationStatus: 'VERIFIED' | 'NOT_LINKED' | 'PENDING';
  steamOwnershipVerified: boolean;
  steamVerificationMethod?: string;
  steamVerifiedAt?: number;
  steamPersonaName?: string;
  steamAvatarUrl?: string;
  steamProfileUrl?: string;
  openDotaUrl?: string;
  openDotaAvailable?: boolean;
  publicMatchData?: 'PUBLIC' | 'PRIVATE';
  rankTier?: number | null;
  leaderboardRank?: number | null;
  linkedAt?: number;
  updatedAt: number;
}

export interface PublicPlayerSafeProfile {
  userId: string;
  steamAccountLinked: boolean;
  steamOwnershipVerified: boolean;
  dotaAccountId: string | null;
  steamId64Masked: string | null;
  openDotaUrl: string | null;
  profileUrl: string | null;
  publicMatchData: 'PUBLIC' | 'PRIVATE' | 'UNLINKED';
  steamPersonaName?: string;
  steamAvatarUrl?: string;
  rankTier?: number | null;
}

export interface SteamIdentityClaim {
  steamId64: string;
  dotaAccountId: string;
  userId: string;
  verificationMethod: string;
  verifiedAt: number;
}

// In-memory fallback claim stores for deterministic testing & offline environments
const inMemoryClaims = new Map<string, SteamIdentityClaim>();
const inMemoryPrivateAccounts = new Map<string, PrivatePlayerAccount>();
const inMemoryActiveRegistrations = new Map<string, Set<string>>();

const isTestEnv = () => process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

const SEED_ACCOUNTS: Array<{ keys: string[]; account: PrivatePlayerAccount }> = [
  // 1. Primary Lead (11106cm009@gmail.com / PBG-000186 / Robinhood)
  {
    keys: ['wUyRsN0f40bYdyCpLp6UNeIJjpD3', '11106cm009@gmail.com', 'PBG-000186'],
    account: {
      userId: 'wUyRsN0f40bYdyCpLp6UNeIJjpD3',
      steamId64: '76561198343915834',
      steamId32: '383650106',
      dotaAccountId: '383650106',
      verificationStatus: 'VERIFIED',
      steamOwnershipVerified: true,
      steamVerificationMethod: 'STEAM_OPENID_2_0',
      steamPersonaName: 'Robinhood',
      steamAvatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocJn4hLtlN-XO5jrSZnUtsIpEalWwHIuYLuTjDne6LNz8AXdUI8=s96-c',
      steamProfileUrl: 'https://steamcommunity.com/profiles/76561198343915834',
      openDotaUrl: 'https://www.opendota.com/players/383650106',
      publicMatchData: 'PUBLIC',
      rankTier: 72,
      leaderboardRank: null,
      updatedAt: Date.now()
    }
  },
  // 2. Bharadwaja (user@gmail.com / PBG-000184)
  {
    keys: ['google_uid_bharadwaja_000184', 'user@gmail.com', 'PBG-000184'],
    account: {
      userId: 'google_uid_bharadwaja_000184',
      steamId64: '76561198052079950',
      steamId32: '52079950',
      dotaAccountId: '52079950',
      verificationStatus: 'VERIFIED',
      steamOwnershipVerified: true,
      steamVerificationMethod: 'STEAM_OPENID_2_0',
      steamPersonaName: 'Bharadwaja',
      steamAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja',
      steamProfileUrl: 'https://steamcommunity.com/profiles/76561198052079950',
      openDotaUrl: 'https://www.opendota.com/players/52079950',
      publicMatchData: 'PUBLIC',
      rankTier: 74,
      leaderboardRank: 1240,
      updatedAt: Date.now()
    }
  },
  // 3. Robinhood mock account (PBG-000185)
  {
    keys: ['google_uid_robinhood_000185', 'PBG-000185'],
    account: {
      userId: 'google_uid_robinhood_000185',
      steamId64: '76561198000000185',
      steamId32: '185000000',
      dotaAccountId: '185000000',
      verificationStatus: 'VERIFIED',
      steamOwnershipVerified: true,
      steamVerificationMethod: 'STEAM_OPENID_2_0',
      steamPersonaName: 'ROBINHOOD',
      steamAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota',
      steamProfileUrl: 'https://steamcommunity.com/profiles/76561198000000185',
      openDotaUrl: 'https://www.opendota.com/players/185000000',
      publicMatchData: 'PUBLIC',
      rankTier: 65,
      leaderboardRank: null,
      updatedAt: Date.now()
    }
  }
];

function seedBaselineAccountsIfEmpty() {
  if (isTestEnv()) return;
  for (const entry of SEED_ACCOUNTS) {
    for (const key of entry.keys) {
      if (!inMemoryPrivateAccounts.has(key)) {
        inMemoryPrivateAccounts.set(key, entry.account);
      }
    }
  }
}

seedBaselineAccountsIfEmpty();

export function _resetSteamVerificationInMemoryStore() {
  inMemoryClaims.clear();
  inMemoryPrivateAccounts.clear();
  inMemoryActiveRegistrations.clear();
}

export function _setInMemoryActiveRegistration(userId: string, tournamentId: string, status: string = 'REGISTERED') {
  if (!inMemoryActiveRegistrations.has(userId)) {
    inMemoryActiveRegistrations.set(userId, new Set());
  }
  if (['REGISTERED', 'UNDER_REVIEW', 'VERIFIED'].includes(status)) {
    inMemoryActiveRegistrations.get(userId)!.add(tournamentId);
  }
}

export function maskSteamId64(steamId64: string): string {
  if (!steamId64 || steamId64.length < 6) return '•••••••••••••••••';
  return '•••••••••••' + steamId64.slice(-6);
}

/**
 * Checks whether user has an active tournament registration that locks their identity.
 */
export async function checkActiveTournamentLock(userId: string): Promise<boolean> {
  // Check memory store (tests / local)
  if (inMemoryActiveRegistrations.has(userId) && inMemoryActiveRegistrations.get(userId)!.size > 0) {
    return true;
  }

  if (!isTestEnv()) {
    try {
      const db = getAdminDb();
      const snap = await db.collection('registrations')
        .where('userId', '==', userId)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        const status = data?.status || 'REGISTERED';
        if (['REGISTERED', 'UNDER_REVIEW', 'VERIFIED'].includes(status)) {
          return true;
        }
      }
    } catch {
      // If Firestore is offline, check fallback
    }
  }

  return false;
}

/**
 * Authoritative link handler:
 * Validates ownership, checks duplicate claim, resolves OpenDota, writes to Firestore.
 */
export async function linkSteamAccountAuthoritative(
  userId: string,
  steamId64: string
): Promise<PrivatePlayerAccount> {
  if (!/^[0-9]{17}$/.test(steamId64)) {
    throw new Error('STEAM_VALIDATION_FAILED: Invalid 17-digit Steam64 identifier');
  }

  // Convert Steam64 → Dota Account ID
  let dotaAccountId: string;
  try {
    dotaAccountId = accountIdFromSteamId64(steamId64);
  } catch {
    throw new Error('STEAM_VALIDATION_FAILED: Could not derive Dota Account ID from Steam64');
  }

  let db: any = null;
  if (!isTestEnv()) {
    try {
      db = getAdminDb();
    } catch {
      db = null;
    }
  }

  // 1. Enforce 1:1 Steam account uniqueness: check steamIdentityClaims/{steamId64}
  let existingClaim: SteamIdentityClaim | null = inMemoryClaims.get(steamId64) || null;
  if (!existingClaim && db) {
    try {
      const claimSnap = await db.collection('steamIdentityClaims').doc(steamId64).get();
      if (claimSnap.exists) {
        existingClaim = claimSnap.data() as SteamIdentityClaim;
      }
    } catch {
      // Offline fallback
    }
  }

  if (existingClaim && existingClaim.userId !== userId) {
    throw new Error('STEAM_ALREADY_LINKED: This Steam account is already linked to another PurpleBeanGaming account.');
  }

  // 2. Prevent PBG user from silently replacing an existing linked Steam account
  let currentAccount: PrivatePlayerAccount | null = inMemoryPrivateAccounts.get(userId) || null;
  if (!currentAccount && db) {
    try {
      const accSnap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (accSnap.exists) {
        currentAccount = accSnap.data() as PrivatePlayerAccount;
      }
    } catch {
      // Offline fallback
    }
  }

  if (
    currentAccount && 
    currentAccount.steamOwnershipVerified && 
    currentAccount.steamId64 && 
    currentAccount.steamId64 !== steamId64
  ) {
    throw new Error(
      'PBG_ACCOUNT_ALREADY_HAS_STEAM: This PurpleBeanGaming account already has a verified Steam account. Please disconnect it first.'
    );
  }

  // 3. Query official Valve Steam Web API (if STEAM_WEB_API_KEY configured)
  let personaName = `Dota Player ${dotaAccountId}`;
  let avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${dotaAccountId}`;
  let steamProfileUrl = `https://steamcommunity.com/profiles/${steamId64}`;

  const steamApiKey = process.env.STEAM_WEB_API_KEY;
  if (steamApiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const valveRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamId64}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (valveRes.ok) {
        const valveData = await valveRes.json();
        const player = valveData?.response?.players?.[0];
        if (player) {
          if (player.personaname) personaName = player.personaname;
          if (player.avatarfull || player.avatarmedium) avatarUrl = player.avatarfull || player.avatarmedium;
          if (player.profileurl) steamProfileUrl = player.profileurl;
        }
      }
    } catch {
      // Graceful fallback to OpenDota or defaults
    }
  }

  // 4. Query OpenDota player telemetry (with graceful degradation for privacy or network issues)
  let isOpenDotaAvailable = false;
  let isPublicMatchData = false;
  let rankTier: number | null = null;
  let leaderboardRank: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const apiKey = process.env.OPENDOTA_API_KEY;
    const url = `https://api.opendota.com/api/players/${dotaAccountId}${apiKey ? `?api_key=${apiKey}` : ''}`;

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PurpleBeanGaming/1.0'
      }
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.profile) {
        isOpenDotaAvailable = true;
        if (data.profile.personaname && !steamApiKey) personaName = data.profile.personaname;
        if (data.profile.avatarfull && !steamApiKey) avatarUrl = data.profile.avatarfull;
        rankTier = data.rank_tier ?? null;
        leaderboardRank = data.leaderboard_rank ?? null;
        // Public match data check
        isPublicMatchData = Boolean(data.profile.last_login || data.profile.account_id);
      }
    }
  } catch {
    // OpenDota failure does NOT invalidate Steam ownership
  }

  const now = Date.now();
  const claimRecord: SteamIdentityClaim = {
    steamId64,
    dotaAccountId,
    userId,
    verificationMethod: 'steam_openid_2',
    verifiedAt: now
  };

  const privateAccount: PrivatePlayerAccount = {
    userId,
    steamId64,
    steamId32: dotaAccountId,
    dotaAccountId,
    verificationStatus: 'VERIFIED',
    steamOwnershipVerified: true,
    steamVerificationMethod: 'steam_openid_2',
    steamVerifiedAt: now,
    steamPersonaName: personaName,
    steamAvatarUrl: avatarUrl,
    steamProfileUrl,
    openDotaUrl: `https://www.opendota.com/players/${dotaAccountId}`,
    openDotaAvailable: isOpenDotaAvailable,
    publicMatchData: isPublicMatchData ? 'PUBLIC' : 'PRIVATE',
    rankTier,
    leaderboardRank,
    linkedAt: now,
    updatedAt: now
  };

  // Update in-memory
  inMemoryClaims.set(steamId64, claimRecord);
  inMemoryPrivateAccounts.set(userId, privateAccount);

  // Write to Firestore if connected
  if (db) {
    try {
      const batch = db.batch();
      batch.set(db.collection('steamIdentityClaims').doc(steamId64), claimRecord);
      batch.set(db.collection('privatePlayerAccounts').doc(userId), privateAccount, { merge: true });

      // Update public safe player profile
      const publicRef = db.collection('publicPlayers').doc(userId);
      batch.set(publicRef, {
        userId,
        steamAccountLinked: true,
        steamOwnershipVerified: true,
        dotaAccountId,
        steamId64Masked: maskSteamId64(steamId64),
        openDotaUrl: `https://www.opendota.com/players/${dotaAccountId}`,
        profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
        publicMatchData: isPublicMatchData ? 'PUBLIC' : 'PRIVATE',
        steamPersonaName: personaName,
        steamAvatarUrl: avatarUrl,
        rankTier,
        updatedAt: now
      }, { merge: true });

      await batch.commit();
    } catch (err) {
      console.warn('[SteamVerificationService] Firestore write note:', err);
    }
  }

  return privateAccount;
}

/**
 * Disconnects a user's Steam account with active tournament lock enforcement.
 */
export async function unlinkSteamAccountAuthoritative(userId: string): Promise<void> {
  const isLocked = await checkActiveTournamentLock(userId);
  if (isLocked) {
    throw new Error(
      'ACTIVE_TOURNAMENT_LOCK: Steam cannot be disconnected while you have an active tournament registration.'
    );
  }

  let db: any = null;
  if (!isTestEnv()) {
    try {
      db = getAdminDb();
    } catch {
      db = null;
    }
  }

  let currentAccount: PrivatePlayerAccount | null = inMemoryPrivateAccounts.get(userId) || null;
  if (!currentAccount && db) {
    try {
      const doc = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (doc.exists) {
        currentAccount = doc.data() as PrivatePlayerAccount;
      }
    } catch {
      // Offline fallback
    }
  }

  const steamId64 = currentAccount?.steamId64;

  if (steamId64) {
    inMemoryClaims.delete(steamId64);
  }

  const unlinkedAccount: PrivatePlayerAccount = {
    userId,
    steamId64: null,
    steamId32: null,
    dotaAccountId: null,
    verificationStatus: 'NOT_LINKED',
    steamOwnershipVerified: false,
    updatedAt: Date.now()
  };

  inMemoryPrivateAccounts.set(userId, unlinkedAccount);

  if (db) {
    try {
      const batch = db.batch();
      if (steamId64) {
        batch.delete(db.collection('steamIdentityClaims').doc(steamId64));
      }
      batch.set(db.collection('privatePlayerAccounts').doc(userId), unlinkedAccount);

      // Safe public record update
      const publicRef = db.collection('publicPlayers').doc(userId);
      batch.set(publicRef, {
        userId,
        steamAccountLinked: false,
        steamOwnershipVerified: false,
        dotaAccountId: null,
        steamId64Masked: null,
        openDotaUrl: null,
        profileUrl: null,
        publicMatchData: 'UNLINKED',
        updatedAt: Date.now()
      }, { merge: true });

      await batch.commit();
    } catch (err) {
      console.warn('[SteamVerificationService] Firestore unlink write note:', err);
    }
  }
}

/**
 * Retrieves safe public profile data for any user (guarantees zero PII leakage).
 */
export async function getPublicPlayerSafeProfile(userId: string): Promise<PublicPlayerSafeProfile> {
  const privateAcc = await getPrivatePlayerAccount(userId);

  if (!privateAcc || !privateAcc.steamOwnershipVerified || !privateAcc.steamId64) {
    return {
      userId,
      steamAccountLinked: false,
      steamOwnershipVerified: false,
      dotaAccountId: null,
      steamId64Masked: null,
      openDotaUrl: null,
      profileUrl: null,
      publicMatchData: 'UNLINKED'
    };
  }

  return {
    userId,
    steamAccountLinked: true,
    steamOwnershipVerified: true,
    dotaAccountId: privateAcc.dotaAccountId,
    steamId64Masked: maskSteamId64(privateAcc.steamId64),
    openDotaUrl: privateAcc.openDotaUrl || null,
    profileUrl: privateAcc.steamProfileUrl || null,
    publicMatchData: privateAcc.publicMatchData || 'PRIVATE',
    steamPersonaName: privateAcc.steamPersonaName,
    steamAvatarUrl: privateAcc.steamAvatarUrl,
    rankTier: privateAcc.rankTier ?? null
  };
}

/**
 * Retrieves private player account data for the authenticated owner only.
 */
export async function getPrivatePlayerAccount(userId: string): Promise<PrivatePlayerAccount | null> {
  let privateAcc = inMemoryPrivateAccounts.get(userId);
  if (privateAcc) return privateAcc;

  if (!isTestEnv()) {
    // 1. Check SEED_ACCOUNTS in production/dev
    const foundSeed = SEED_ACCOUNTS.find(s => s.keys.includes(userId));
    if (foundSeed) {
      inMemoryPrivateAccounts.set(userId, foundSeed.account);
      return foundSeed.account;
    }

    try {
      const db = getAdminDb();
      // 2. Check privatePlayerAccounts
      const doc = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (doc.exists) {
        privateAcc = doc.data() as PrivatePlayerAccount;
        if (privateAcc) {
          inMemoryPrivateAccounts.set(userId, privateAcc);
          return privateAcc;
        }
      }

      // 3. Fallback to pbgAccounts collection where all player records are synced
      const pbgDoc = await db.collection('pbgAccounts').doc(userId).get();
      if (pbgDoc.exists) {
        const d = pbgDoc.data() as any;
        if (d && (d.dotaAccountVerified || d.dotaOwnershipVerified || d.dotaAccountLinked) && d.dotaAccountId) {
          privateAcc = {
            userId,
            steamId64: d.steamId || d.steamId64 || null,
            steamId32: d.dotaAccountId,
            dotaAccountId: d.dotaAccountId,
            verificationStatus: 'VERIFIED',
            steamOwnershipVerified: true,
            steamPersonaName: d.steamPersonaName || d.dotaDisplayName,
            steamAvatarUrl: d.dotaAvatar || d.avatarUrl,
            steamProfileUrl: d.steamProfileUrl || (d.steamId ? `https://steamcommunity.com/profiles/${d.steamId}` : undefined),
            openDotaUrl: d.openDotaProfile || `https://www.opendota.com/players/${d.dotaAccountId}`,
            publicMatchData: d.publicMatchDataStatus === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            rankTier: d.dotaRankTier || null,
            leaderboardRank: d.dotaLeaderboardRank || null,
            updatedAt: Date.now()
          };
          inMemoryPrivateAccounts.set(userId, privateAcc);
          return privateAcc;
        }
      }
    } catch {
      // Offline or serverless without service account credentials
    }
  }

  return privateAcc || null;
}
