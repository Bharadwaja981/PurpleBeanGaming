/**
 * Purple Bean Gaming — Server-Side Discord Verification & Identity Claim Engine
 * 
 * Manages 1:1 Discord account ownership binding, prevents duplicate claims,
 * enforces active tournament locks on disconnection, and manages authoritative
 * Discord identity claims in Firestore.
 */

import { getAdminDb } from './firebaseAdmin';

export interface DiscordIdentityData {
  userId: string; // Discord Snowflake ID (permanent identifier)
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  connectedAt: number;
  verified: true;
}

export interface PrivateDiscordAccount {
  userId: string; // PBG Google UID
  pbgId?: string; // PBG Player Identifier (e.g. PBG-000186)
  discord?: DiscordIdentityData | null;
  discordUserId: string | null; // 17-20 digit Snowflake ID
  discordUsername: string | null;
  discordDisplayName: string | null;
  discordAvatarUrl: string | null;
  discordLinked: boolean;
  discordVerified: boolean;
  discordVerificationMethod?: 'discord_oauth_2' | 'direct_snowflake';
  discordVerifiedAt?: number | null;
  discordLinkedAt?: number | null;
  updatedAt: number;
}

export interface DiscordIdentityClaim {
  discordUserId: string;
  userId: string;
  pbgId?: string;
  verificationMethod: string;
  verifiedAt: number;
  connectedAt: number;
}

// In-memory fallback stores for deterministic testing & offline environments
const inMemoryClaims = new Map<string, DiscordIdentityClaim>();
const inMemoryPrivateAccounts = new Map<string, PrivateDiscordAccount>();
const inMemoryActiveRegistrations = new Map<string, Set<string>>();

const isTestEnv = () => process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export function _resetDiscordVerificationInMemoryStore(): void {
  inMemoryClaims.clear();
  inMemoryPrivateAccounts.clear();
  inMemoryActiveRegistrations.clear();
}

export function _setInMemoryActiveDiscordRegistration(tournamentId: string, userIds: string[]): void {
  inMemoryActiveRegistrations.set(tournamentId, new Set(userIds));
}

/**
 * Validates Discord 17-20 digit Snowflake format
 */
export function validateDiscordSnowflake(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^\d{17,20}$/.test(id.trim());
}

/**
 * Masks a Discord Snowflake ID for public profiles (e.g. ••••••••••••••4567)
 */
export function maskDiscordUserId(id: string): string {
  if (!id || id.length < 5) return '••••••••';
  const visible = id.slice(-4);
  return '••••••••••••••'.slice(0, Math.max(8, id.length - 4)) + visible;
}

/**
 * Checks whether user has an active, confirmed tournament registration.
 */
export async function isUserRegisteredInActiveTournament(userId: string): Promise<boolean> {
  if (isTestEnv()) {
    for (const userSet of inMemoryActiveRegistrations.values()) {
      if (userSet.has(userId)) return true;
    }
    return false;
  }

  const db = getAdminDb();
  if (!db) {
    for (const userSet of inMemoryActiveRegistrations.values()) {
      if (userSet.has(userId)) return true;
    }
    return false;
  }

  try {
    const regSnapshot = await db
      .collection('tournamentRegistrations')
      .where('userId', '==', userId)
      .where('registrationStatus', '==', 'CONFIRMED')
      .get();

    if (regSnapshot.empty) return false;

    for (const doc of regSnapshot.docs) {
      const reg = doc.data();
      const tourneyDoc = await db.collection('tournaments').doc(reg.tournamentId).get();
      if (tourneyDoc.exists) {
        const tourney = tourneyDoc.data();
        const activeStatuses = ['REGISTRATION', 'CHECK_IN', 'LIVE', 'PAUSED'];
        if (tourney && activeStatuses.includes(tourney.status)) {
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    console.warn('[isUserRegisteredInActiveTournament] Firestore check error:', err);
    return false;
  }
}

/**
 * Links a Discord account authoritatively for a PBG user.
 * Enforces:
 * 1. A Discord ID must only be linked to ONE PBG account.
 * 2. A PBG account must only have ONE active Discord account.
 * 3. Never trust a Discord username as identity; Snowflake ID is the permanent identifier.
 */
export async function linkDiscordAccountAuthoritative(params: {
  userId: string;
  pbgId?: string;
  discordUserId: string;
  discordUsername: string;
  globalName?: string | null;
  discordAvatarUrl?: string | null;
  verificationMethod?: 'discord_oauth_2' | 'direct_snowflake';
}): Promise<{ success: boolean; account: PrivateDiscordAccount }> {
  const {
    userId,
    pbgId,
    discordUserId,
    discordUsername,
    globalName,
    discordAvatarUrl,
    verificationMethod = 'discord_oauth_2'
  } = params;

  if (!userId) {
    throw new Error('SIGN_IN_REQUIRED');
  }

  const cleanDiscordId = discordUserId.trim();
  if (!validateDiscordSnowflake(cleanDiscordId)) {
    const err = new Error('Invalid Discord User ID. Must be a 17-20 digit Discord Snowflake ID.');
    (err as any).code = 'INVALID_DISCORD_ID';
    throw err;
  }

  const now = Date.now();
  const db = getAdminDb();

  // 1. Check if Discord Snowflake is already claimed by another PBG user (1:1 constraint)
  if (!isTestEnv() && db) {
    try {
      const claimDoc = await db.collection('discordIdentityClaims').doc(cleanDiscordId).get();
      if (claimDoc.exists) {
        const claim = claimDoc.data() as DiscordIdentityClaim;
        if (claim.userId !== userId) {
          const err = new Error(
            `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
          );
          (err as any).code = 'DISCORD_ALREADY_LINKED';
          throw err;
        }
      }
    } catch (err: any) {
      if (err.code === 'DISCORD_ALREADY_LINKED') throw err;
      console.warn('[linkDiscordAccountAuthoritative] Firestore claim check note:', err);
    }
  } else {
    const existing = inMemoryClaims.get(cleanDiscordId);
    if (existing && existing.userId !== userId) {
      const err = new Error(
        `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
      );
      (err as any).code = 'DISCORD_ALREADY_LINKED';
      throw err;
    }
  }

  // 2. Fetch current account to verify if user already had a different Discord account linked
  let currentAccount: PrivateDiscordAccount | null = null;
  if (!isTestEnv() && db) {
    try {
      const snap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data() as PrivateDiscordAccount;
      }
    } catch {}
  } else {
    currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  }

  // If user is switching Discord IDs, release previous claim from the database
  if (currentAccount && currentAccount.discordUserId && currentAccount.discordUserId !== cleanDiscordId) {
    if (!isTestEnv() && db) {
      try {
        await db.collection('discordIdentityClaims').doc(currentAccount.discordUserId).delete();
      } catch {}
    } else {
      inMemoryClaims.delete(currentAccount.discordUserId);
    }
  }

  // 3. Assemble authoritative structured Discord identity
  const discordProfile: DiscordIdentityData = {
    userId: cleanDiscordId,
    username: discordUsername.trim(),
    globalName: globalName ? globalName.trim() : null,
    avatarUrl: discordAvatarUrl || null,
    connectedAt: now,
    verified: true
  };

  const updatedAccount: PrivateDiscordAccount = {
    userId,
    pbgId: pbgId || currentAccount?.pbgId,
    discord: discordProfile,
    discordUserId: cleanDiscordId,
    discordUsername: discordProfile.username,
    discordDisplayName: discordProfile.globalName || discordProfile.username,
    discordAvatarUrl: discordProfile.avatarUrl || `https://cdn.discordapp.com/embed/avatars/${parseInt(cleanDiscordId.slice(-1) || '0', 10) % 5}.png`,
    discordLinked: true,
    discordVerified: true,
    discordVerificationMethod: verificationMethod,
    discordVerifiedAt: now,
    discordLinkedAt: currentAccount?.discordLinkedAt || now,
    updatedAt: now
  };

  const claim: DiscordIdentityClaim = {
    discordUserId: cleanDiscordId,
    userId,
    pbgId: pbgId || currentAccount?.pbgId,
    verificationMethod,
    verifiedAt: now,
    connectedAt: now
  };

  // 4. Persist to Firestore: update identity claims mapping and user accounts
  if (!isTestEnv() && db) {
    try {
      await db.collection('discordIdentityClaims').doc(cleanDiscordId).set(claim);
      await db.collection('privatePlayerAccounts').doc(userId).set({
        ...updatedAccount,
        discord: discordProfile
      }, { merge: true });
      await db.collection('pbgAccounts').doc(userId).set({
        discord: discordProfile,
        discordUserId: cleanDiscordId,
        discordUsername: updatedAccount.discordUsername,
        discordDisplayName: updatedAccount.discordDisplayName,
        discordAvatar: updatedAccount.discordAvatarUrl,
        discordLinked: true,
        discordLinkedAt: new Date(now).toISOString(),
        updatedAt: new Date(now).toISOString()
      }, { merge: true }).catch(() => {});
    } catch (err: any) {
      console.warn('[linkDiscordAccountAuthoritative] Firestore write note:', err);
    }
  }

  inMemoryClaims.set(cleanDiscordId, claim);
  inMemoryPrivateAccounts.set(userId, updatedAccount);

  return { success: true, account: updatedAccount };
}

/**
 * Disconnects a user's Discord account.
 * Enforces active tournament lock.
 * Removes both sides of the Discord↔PBG identity mapping.
 */
export async function unlinkDiscordAccountAuthoritative(userId: string): Promise<{ success: boolean }> {
  if (!userId) {
    throw new Error('SIGN_IN_REQUIRED');
  }

  // Check active tournament lock
  const hasActiveTourney = await isUserRegisteredInActiveTournament(userId);
  if (hasActiveTourney) {
    const err = new Error(
      'Cannot disconnect Discord: you are currently registered in an active tournament. Tournament communications and check-in require a verified Discord identity.'
    );
    (err as any).code = 'ACTIVE_TOURNAMENT_LOCK';
    throw err;
  }

  const db = getAdminDb();
  let currentAccount: PrivateDiscordAccount | null = null;

  if (!isTestEnv() && db) {
    try {
      const snap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data() as PrivateDiscordAccount;
      }
    } catch {}
  } else {
    currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  }

  const previousDiscordId = currentAccount?.discordUserId;

  const now = Date.now();
  const unlinkedData = {
    discord: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinked: false,
    discordVerified: false,
    discordVerifiedAt: null,
    discordLinkedAt: null,
    updatedAt: now
  };

  // Remove both sides of the Discord <-> PBG mapping in Firestore
  if (!isTestEnv() && db) {
    try {
      if (previousDiscordId) {
        await db.collection('discordIdentityClaims').doc(previousDiscordId).delete();
      }
      await db.collection('privatePlayerAccounts').doc(userId).set(unlinkedData, { merge: true });
      await db.collection('pbgAccounts').doc(userId).set({
        discord: null,
        discordUserId: null,
        discordUsername: null,
        discordDisplayName: null,
        discordAvatar: null,
        discordLinked: false,
        discordLinkedAt: null,
        updatedAt: new Date(now).toISOString()
      }, { merge: true }).catch(() => {});
    } catch (err: any) {
      console.warn('[unlinkDiscordAccountAuthoritative] Firestore unlink note:', err);
    }
  }

  if (previousDiscordId) {
    inMemoryClaims.delete(previousDiscordId);
  }
  const existing = inMemoryPrivateAccounts.get(userId);
  if (existing) {
    inMemoryPrivateAccounts.set(userId, { ...existing, ...unlinkedData });
  }

  return { success: true };
}

/**
 * Fetches private Discord account status for current user.
 */
export async function getPrivateDiscordAccount(userId: string): Promise<PrivateDiscordAccount> {
  const db = getAdminDb();
  if (!isTestEnv() && db) {
    try {
      const snap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (snap.exists) {
        const data = snap.data() as any;
        return {
          userId,
          pbgId: data.pbgId,
          discord: data.discord || (data.discordUserId ? {
            userId: data.discordUserId,
            username: data.discordUsername || 'player',
            globalName: data.discordDisplayName || data.discordUsername || null,
            avatarUrl: data.discordAvatarUrl || data.discordAvatar || null,
            connectedAt: data.discordLinkedAt || Date.now(),
            verified: true
          } : null),
          discordUserId: data.discordUserId || null,
          discordUsername: data.discordUsername || null,
          discordDisplayName: data.discordDisplayName || data.discordUsername || null,
          discordAvatarUrl: data.discordAvatarUrl || data.discordAvatar || null,
          discordLinked: Boolean(data.discordLinked || data.discordUserId),
          discordVerified: Boolean(data.discordVerified || data.discordUserId),
          discordVerificationMethod: data.discordVerificationMethod || 'discord_oauth_2',
          discordVerifiedAt: data.discordVerifiedAt,
          discordLinkedAt: data.discordLinkedAt,
          updatedAt: data.updatedAt || Date.now()
        };
      }
    } catch {}
  }

  const mem = inMemoryPrivateAccounts.get(userId);
  if (mem) return mem;

  return {
    userId,
    discord: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinked: false,
    discordVerified: false,
    updatedAt: Date.now()
  };
}
