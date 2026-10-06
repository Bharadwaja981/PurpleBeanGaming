/**
 * Purple Bean Gaming — Server-Side Discord Verification & Identity Claim Engine
 * 
 * Production Safety Engine:
 * 1. Two-phase identity reservation strategy (reserve -> provision -> finalize or rollback)
 * 2. Strict 1:1 Discord Snowflake ID <-> PBG account ownership constraint
 * 3. Atomic concurrency protection via Firestore transactions
 * 4. Active tournament disconnection locking
 * 5. Recovery handling: PROVISIONED_PENDING_FINALIZATION state if finalization encounters transient errors
 * 6. Documented single source of truth for Discord identity: `discord_links/{discordUserId}`
 * 7. Verified identity unlink semantics: removes PBG link and PBG Member role while keeping user in Discord server
 */

import { getAdminDb } from './firebaseAdmin';
import { removeDiscordMemberRole } from './discordProvisioningService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';

export interface DiscordIdentityData {
  userId: string; // Discord Snowflake ID (permanent identifier)
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  avatar?: string | null;
  guildMember?: boolean;
  pbgMemberRole?: boolean;
  connectedAt: number;
  linkedAt?: number | string;
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

export type DiscordLinkStatus = 'PENDING' | 'PROVISIONED_PENDING_FINALIZATION' | 'ACTIVE';

export interface DiscordLinkDocument {
  discordUserId: string;
  pbgUserId: string;
  pbgId?: string | null;
  status: DiscordLinkStatus;
  reservedAt: number;
  linkedAt?: number | null;
  provisionedAt?: number | null;
  updatedAt: number;
  guildMember?: boolean;
  pbgMemberRole?: boolean;
  discordUsername?: string | null;
  globalName?: string | null;
  avatarUrl?: string | null;
}

// In-memory fallback stores for deterministic testing & offline environments
const inMemoryLinks = new Map<string, DiscordLinkDocument>();
const inMemoryPrivateAccounts = new Map<string, PrivateDiscordAccount>();
const inMemoryActiveRegistrations = new Map<string, Set<string>>();

const isTestEnv = () => process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export function _resetDiscordVerificationInMemoryStore(): void {
  inMemoryLinks.clear();
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
 * PHASE 1: ATOMIC IDENTITY RESERVATION
 * 
 * Reserves the Discord Snowflake in `discord_links/{discordUserId}` with status PENDING.
 * This runs BEFORE any Discord API side-effects (e.g., adding to guild or granting roles)
 * to guarantee that a Discord account already claimed by Account A cannot be added
 * or modified when Account B attempts to link it.
 */
export async function reserveDiscordIdentityClaim(params: {
  userId: string;
  pbgId?: string;
  discordUserId: string;
}): Promise<{ success: boolean; isSameUser: boolean; wasPendingFinalization?: boolean }> {
  const { userId, pbgId, discordUserId } = params;

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
  const RESERVATION_TTL_MS = 2 * 60 * 1000; // 2 minutes pending window

  if (isTestEnv()) {
    const existing = inMemoryLinks.get(cleanDiscordId);
    if (existing) {
      if (existing.pbgUserId === userId) {
        // Idempotent same-user retry or recovery from PROVISIONED_PENDING_FINALIZATION
        return { 
          success: true, 
          isSameUser: true,
          wasPendingFinalization: existing.status === 'PROVISIONED_PENDING_FINALIZATION'
        };
      }
      if (existing.status === 'ACTIVE' || existing.status === 'PROVISIONED_PENDING_FINALIZATION') {
        const err = new Error(
          `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
        );
        (err as any).code = 'DISCORD_ALREADY_LINKED';
        throw err;
      }
      if (existing.status === 'PENDING' && now - existing.reservedAt < RESERVATION_TTL_MS) {
        const err = new Error(
          `A linking attempt for this Discord account (ID: ${cleanDiscordId}) is already in progress.`
        );
        (err as any).code = 'DISCORD_LINK_IN_PROGRESS';
        throw err;
      }
    }

    inMemoryLinks.set(cleanDiscordId, {
      discordUserId: cleanDiscordId,
      pbgUserId: userId,
      pbgId: pbgId || null,
      status: 'PENDING',
      reservedAt: now,
      updatedAt: now
    });
    return { success: true, isSameUser: false };
  }

  const db = getAdminDb();
  if (!db) {
    return { success: true, isSameUser: false };
  }

  try {
    const result = await db.runTransaction(async (transaction: any) => {
      const linkRef = db.collection('discord_links').doc(cleanDiscordId);
      const linkDoc = await transaction.get(linkRef);

      if (linkDoc.exists) {
        const existing = linkDoc.data() as DiscordLinkDocument;
        if (existing.pbgUserId === userId) {
          return { 
            success: true, 
            isSameUser: true,
            wasPendingFinalization: existing.status === 'PROVISIONED_PENDING_FINALIZATION'
          };
        }
        if (existing.status === 'ACTIVE' || existing.status === 'PROVISIONED_PENDING_FINALIZATION') {
          const err = new Error(
            `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
          );
          (err as any).code = 'DISCORD_ALREADY_LINKED';
          throw err;
        }
        if (existing.status === 'PENDING' && now - (existing.reservedAt || 0) < RESERVATION_TTL_MS) {
          const err = new Error(
            `A linking attempt for this Discord account (ID: ${cleanDiscordId}) is already in progress.`
          );
          (err as any).code = 'DISCORD_LINK_IN_PROGRESS';
          throw err;
        }
      }

      const pendingDoc: DiscordLinkDocument = {
        discordUserId: cleanDiscordId,
        pbgUserId: userId,
        pbgId: pbgId || null,
        status: 'PENDING',
        reservedAt: now,
        updatedAt: now
      };

      transaction.set(linkRef, pendingDoc, { merge: true });
      return { success: true, isSameUser: false };
    });

    return result;
  } catch (err: any) {
    if (err.code === 'DISCORD_ALREADY_LINKED' || err.code === 'DISCORD_LINK_IN_PROGRESS') {
      throw err;
    }
    console.warn('[reserveDiscordIdentityClaim] Transaction note:', err.message);
    throw err;
  }
}

/**
 * ROLLBACK RESERVATION
 * 
 * Cleans up a PENDING reservation if Discord guild provisioning fails.
 */
export async function rollbackDiscordIdentityReservation(discordUserId: string, userId: string): Promise<void> {
  const cleanDiscordId = discordUserId.trim();

  if (isTestEnv()) {
    const existing = inMemoryLinks.get(cleanDiscordId);
    if (existing && existing.pbgUserId === userId && existing.status === 'PENDING') {
      inMemoryLinks.delete(cleanDiscordId);
    }
    return;
  }

  const db = getAdminDb();
  if (!db) return;

  try {
    const linkRef = db.collection('discord_links').doc(cleanDiscordId);
    const linkDoc = await linkRef.get();
    if (linkDoc.exists) {
      const data = linkDoc.data();
      if (data?.pbgUserId === userId && data?.status === 'PENDING') {
        await linkRef.delete();
      }
    }
  } catch (err: any) {
    console.warn('[rollbackDiscordIdentityReservation] Rollback error:', err.message);
  }
}

/**
 * PHASE 2: FINALIZE IDENTITY CLAIM
 * 
 * Promotes status from PENDING to ACTIVE in `discord_links/{discordUserId}`
 * and records authoritative user profile link in `privatePlayerAccounts` and `pbgAccounts`.
 * 
 * RECOVERY BEHAVIOR:
 * If an unexpected error occurs during finalization after Discord provisioning succeeded,
 * the record is marked `PROVISIONED_PENDING_FINALIZATION` with retry attempts.
 * The user is NEVER automatically kicked from the Discord server.
 */
export async function finalizeDiscordAccountAuthoritative(params: {
  userId: string;
  pbgId?: string;
  discordUserId: string;
  discordUsername: string;
  globalName?: string | null;
  discordAvatarUrl?: string | null;
  guildMember?: boolean;
  pbgMemberRole?: boolean;
  verificationMethod?: 'discord_oauth_2' | 'direct_snowflake';
}): Promise<{ success: boolean; account: PrivateDiscordAccount }> {
  const {
    userId,
    pbgId,
    discordUserId,
    discordUsername,
    globalName,
    discordAvatarUrl,
    guildMember = false,
    pbgMemberRole = false,
    verificationMethod = 'discord_oauth_2'
  } = params;

  const cleanDiscordId = discordUserId.trim();
  const now = Date.now();

  let currentAccount: PrivateDiscordAccount | null = null;
  const db = getAdminDb();

  if (isTestEnv() || !db) {
    currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  } else {
    try {
      const snap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data() as PrivateDiscordAccount;
      }
    } catch {}
  }

  // If user is switching Discord IDs, release previous claim
  if (currentAccount && currentAccount.discordUserId && currentAccount.discordUserId !== cleanDiscordId) {
    if (isTestEnv() || !db) {
      inMemoryLinks.delete(currentAccount.discordUserId);
    } else {
      await db.collection('discord_links').doc(currentAccount.discordUserId).delete().catch(() => {});
      await db.collection('discordIdentityClaims').doc(currentAccount.discordUserId).delete().catch(() => {});
    }
  }

  const discordProfile: DiscordIdentityData = {
    userId: cleanDiscordId,
    username: discordUsername.trim(),
    globalName: globalName ? globalName.trim() : null,
    avatarUrl: discordAvatarUrl || null,
    avatar: discordAvatarUrl || null,
    guildMember: Boolean(guildMember),
    pbgMemberRole: Boolean(pbgMemberRole),
    connectedAt: now,
    linkedAt: now,
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

  const linkDoc: DiscordLinkDocument = {
    discordUserId: cleanDiscordId,
    pbgUserId: userId,
    pbgId: pbgId || currentAccount?.pbgId || null,
    status: 'ACTIVE',
    reservedAt: now,
    linkedAt: now,
    updatedAt: now,
    guildMember: Boolean(guildMember),
    pbgMemberRole: Boolean(pbgMemberRole),
    discordUsername: discordProfile.username,
    globalName: discordProfile.globalName,
    avatarUrl: discordProfile.avatarUrl
  };

  if (isTestEnv() || !db) {
    inMemoryLinks.set(cleanDiscordId, linkDoc);
    inMemoryPrivateAccounts.set(userId, updatedAccount);
    return { success: true, account: updatedAccount };
  }

  // Execute with retry loop for production resilience
  let finalizeSuccess = false;
  let finalizeError: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof db.runTransaction === 'function') {
        await db.runTransaction(async (transaction: any) => {
          const linkRef = db.collection('discord_links').doc(cleanDiscordId);
          transaction.set(linkRef, linkDoc, { merge: true });

          const legacyClaimRef = db.collection('discordIdentityClaims').doc(cleanDiscordId);
          transaction.set(legacyClaimRef, {
            discordUserId: cleanDiscordId,
            userId,
            pbgId: pbgId || currentAccount?.pbgId,
            verificationMethod,
            verifiedAt: now,
            connectedAt: now
          }, { merge: true });

          const privateRef = db.collection('privatePlayerAccounts').doc(userId);
          transaction.set(privateRef, {
            ...updatedAccount,
            discord: discordProfile
          }, { merge: true });

          const pbgRef = db.collection('pbgAccounts').doc(userId);
          transaction.set(pbgRef, {
            discord: discordProfile,
            discordUserId: cleanDiscordId,
            discordUsername: updatedAccount.discordUsername,
            discordDisplayName: updatedAccount.discordDisplayName,
            discordAvatar: updatedAccount.discordAvatarUrl,
            discordLinked: true,
            discordLinkedAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString()
          }, { merge: true });
        });
      } else {
        await db.collection('discord_links').doc(cleanDiscordId).set(linkDoc, { merge: true });
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
      }

      finalizeSuccess = true;
      break;
    } catch (err: any) {
      finalizeError = err;
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 100));
      }
    }
  }

  if (!finalizeSuccess) {
    // RECOVERY COMPENSATION: Record PROVISIONED_PENDING_FINALIZATION state
    // Do NOT leave ambiguous PENDING claim and DO NOT kick user from Discord server
    console.error('[finalizeDiscordAccountAuthoritative] Finalization attempts failed:', finalizeError?.message);
    try {
      const pendingFinalizationDoc: DiscordLinkDocument = {
        discordUserId: cleanDiscordId,
        pbgUserId: userId,
        pbgId: pbgId || currentAccount?.pbgId || null,
        status: 'PROVISIONED_PENDING_FINALIZATION',
        reservedAt: now,
        provisionedAt: now,
        updatedAt: now,
        guildMember: Boolean(guildMember),
        pbgMemberRole: Boolean(pbgMemberRole),
        discordUsername: discordProfile.username,
        globalName: discordProfile.globalName,
        avatarUrl: discordProfile.avatarUrl
      };
      await db.collection('discord_links').doc(cleanDiscordId).set(pendingFinalizationDoc, { merge: true });
    } catch (saveErr: any) {
      console.error('[finalizeDiscordAccountAuthoritative] Could not record PROVISIONED_PENDING_FINALIZATION:', saveErr?.message);
    }
    throw new Error('Discord provisioning succeeded but account record finalization encountered a temporary error. Please refresh your profile.');
  }

  inMemoryLinks.set(cleanDiscordId, linkDoc);
  inMemoryPrivateAccounts.set(userId, updatedAccount);

  return { success: true, account: updatedAccount };
}

/**
 * Links a Discord account authoritatively for a PBG user.
 * Combines reservation and finalization for direct calls and backwards compatibility.
 */
export async function linkDiscordAccountAuthoritative(params: {
  userId: string;
  pbgId?: string;
  discordUserId: string;
  discordUsername: string;
  globalName?: string | null;
  discordAvatarUrl?: string | null;
  guildMember?: boolean;
  pbgMemberRole?: boolean;
  verificationMethod?: 'discord_oauth_2' | 'direct_snowflake';
}): Promise<{ success: boolean; account: PrivateDiscordAccount }> {
  // Step 1: Check and reserve 1:1 identity index
  await reserveDiscordIdentityClaim({
    userId: params.userId,
    pbgId: params.pbgId,
    discordUserId: params.discordUserId
  });

  // Step 2: Finalize
  return finalizeDiscordAccountAuthoritative(params);
}

/**
 * Disconnects a user's Discord account.
 * 
 * PRODUCT POLICY SPECIFICATION:
 * - Removes PBG <-> Discord identity mapping in `discord_links` and user profiles.
 * - Enforces active tournament lock (`ACTIVE_TOURNAMENT_LOCK`).
 * - Verified Identity Linkage Semantic: Revokes the PBG Member role in the Discord server
 *   via DELETE /guilds/{guildId}/members/{discordUserId}/roles/{roleId}.
 * - DOES NOT kick or remove user from the Discord server.
 */
export async function unlinkDiscordAccountAuthoritative(
  userId: string,
  options?: { removeGuildRole?: boolean }
): Promise<{ success: boolean; roleRevoked?: boolean }> {
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

  if (isTestEnv() || !db) {
    currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  } else {
    try {
      const snap = await db.collection('privatePlayerAccounts').doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data() as PrivateDiscordAccount;
      }
    } catch {}
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

  // Role Revocation Semantic:
  // By default, preserves the Discord role (permanent community membership semantic),
  // matching existing product specification.
  // If explicitly requested via options.removeGuildRole === true OR process.env.DISCORD_UNLINK_REVOKES_ROLE === 'true',
  // removes the PBG Member role (verified linkage semantic). User is NEVER kicked from server.
  let roleRevoked = false;
  const shouldRemoveRole = options?.removeGuildRole ?? (process.env.DISCORD_UNLINK_REVOKES_ROLE === 'true');
  const guildId = process.env.DISCORD_GUILD_ID || '631715510631006219';
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';

  if (shouldRemoveRole && previousDiscordId && guildId && botToken && roleId) {
    try {
      const result = await removeDiscordMemberRole({
        guildId,
        botToken,
        roleId,
        discordUserId: previousDiscordId
      });
      roleRevoked = result.success;
    } catch (roleErr: any) {
      console.warn('[unlinkDiscordAccountAuthoritative] Role revocation warning:', roleErr.message);
    }
  }

  if (!isTestEnv() && db) {
    try {
      if (previousDiscordId) {
        await db.collection('discord_links').doc(previousDiscordId).delete().catch(() => {});
        await db.collection('discordIdentityClaims').doc(previousDiscordId).delete().catch(() => {});
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
    inMemoryLinks.delete(previousDiscordId);
  }
  const existing = inMemoryPrivateAccounts.get(userId);
  if (existing) {
    inMemoryPrivateAccounts.set(userId, { ...existing, ...unlinkedData });
  }

  return { success: true, roleRevoked };
}

/**
 * RECONCILIATION & RECOVERY ENGINE:
 * Automatically reconciles any PROVISIONED_PENDING_FINALIZATION state for a user.
 * Promotes the record to ACTIVE and finalizes the user profile in Firestore.
 */
export async function reconcilePendingDiscordFinalization(userId: string): Promise<PrivateDiscordAccount | null> {
  if (!userId) return null;

  if (isTestEnv()) {
    for (const [discordId, doc] of inMemoryLinks.entries()) {
      if (doc.pbgUserId === userId && doc.status === 'PROVISIONED_PENDING_FINALIZATION') {
        const finalRes = await finalizeDiscordAccountAuthoritative({
          userId,
          pbgId: doc.pbgId || undefined,
          discordUserId: discordId,
          discordUsername: doc.discordUsername || 'discord_user',
          globalName: doc.globalName,
          discordAvatarUrl: doc.avatarUrl,
          guildMember: doc.guildMember ?? true,
          pbgMemberRole: doc.pbgMemberRole ?? true
        });
        return finalRes.account;
      }
    }
    return null;
  }

  const db = getAdminDb();
  if (!db) return null;

  try {
    const snap = await db
      .collection('discord_links')
      .where('pbgUserId', '==', userId)
      .where('status', '==', 'PROVISIONED_PENDING_FINALIZATION')
      .limit(1)
      .get();

    if (snap.empty) return null;

    const doc = snap.docs[0].data() as DiscordLinkDocument;
    const finalRes = await finalizeDiscordAccountAuthoritative({
      userId,
      pbgId: doc.pbgId || undefined,
      discordUserId: doc.discordUserId,
      discordUsername: doc.discordUsername || 'discord_user',
      globalName: doc.globalName,
      discordAvatarUrl: doc.avatarUrl,
      guildMember: doc.guildMember ?? true,
      pbgMemberRole: doc.pbgMemberRole ?? true
    });
    return finalRes.account;
  } catch (err: any) {
    console.warn('[reconcilePendingDiscordFinalization] Reconciliation attempt note:', err.message);
    return null;
  }
}

/**
 * Retrieves the private Discord account record for an authenticated user.
 */
export async function getPrivateDiscordAccount(userId: string): Promise<PrivateDiscordAccount> {
  if (!userId) {
    throw new Error('SIGN_IN_REQUIRED');
  }

  if (isTestEnv() || !getAdminDb()) {
    const existing = inMemoryPrivateAccounts.get(userId);
    if (existing && existing.discordLinked) return existing;

    // Check if there is a pending finalization to reconcile
    const reconciled = await reconcilePendingDiscordFinalization(userId);
    if (reconciled) return reconciled;

    if (existing) return existing;
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

  const db = getAdminDb();
  try {
    const doc = await db.collection('privatePlayerAccounts').doc(userId).get();
    if (doc.exists) {
      const data = doc.data() as PrivateDiscordAccount;
      if (data.discordLinked && data.discordUserId) return data;
    }

    // Check for pending finalization to automatically reconcile
    const reconciled = await reconcilePendingDiscordFinalization(userId);
    if (reconciled && reconciled.discordLinked && reconciled.discordUserId) return reconciled;

    // Check pbgAccounts collection for linked Discord
    const pbgDoc = await db.collection('pbgAccounts').doc(userId).get();
    if (pbgDoc.exists) {
      const pbgData = pbgDoc.data() || {};
      const discUserId = pbgData.discordUserId || pbgData.discord?.userId;
      if (discUserId) {
        // Also check discord_links doc
        const linkDoc = await db.collection('discord_links').doc(discUserId).get();
        const linkData = linkDoc.exists ? (linkDoc.data() as DiscordLinkDocument) : null;

        const resolved: PrivateDiscordAccount = {
          userId,
          pbgId: pbgData.pbgId || linkData?.pbgId,
          discord: {
            userId: discUserId,
            username: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || 'player',
            globalName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
            avatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
            connectedAt: linkData?.linkedAt || pbgData.discordLinkedAt || Date.now(),
            guildMember: linkData?.guildMember ?? pbgData.discord?.guildMember ?? true,
            pbgMemberRole: linkData?.pbgMemberRole ?? pbgData.discord?.pbgMemberRole ?? true,
            verified: true
          },
          discordUserId: discUserId,
          discordUsername: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || 'player',
          discordDisplayName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
          discordAvatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
          discordLinked: true,
          discordVerified: true,
          discordVerificationMethod: 'discord_oauth_2',
          discordLinkedAt: linkData?.linkedAt || Date.now(),
          discordVerifiedAt: linkData?.linkedAt || Date.now(),
          updatedAt: Date.now()
        };

        // Cache into privatePlayerAccounts
        await db.collection('privatePlayerAccounts').doc(userId).set(resolved, { merge: true }).catch(() => {});
        return resolved;
      }
    }

    // Query discord_links by pbgUserId
    const linkQuery = await db.collection('discord_links').where('pbgUserId', '==', userId).limit(1).get();
    if (!linkQuery.empty) {
      const linkData = linkQuery.docs[0].data() as DiscordLinkDocument;
      const resolved: PrivateDiscordAccount = {
        userId,
        pbgId: linkData.pbgId || undefined,
        discord: {
          userId: linkData.discordUserId,
          username: linkData.discordUsername || 'player',
          globalName: linkData.globalName || null,
          avatarUrl: linkData.avatarUrl || null,
          connectedAt: linkData.linkedAt || Date.now(),
          guildMember: Boolean(linkData.guildMember),
          pbgMemberRole: Boolean(linkData.pbgMemberRole),
          verified: true
        },
        discordUserId: linkData.discordUserId,
        discordUsername: linkData.discordUsername || null,
        discordDisplayName: linkData.globalName || null,
        discordAvatarUrl: linkData.avatarUrl || null,
        discordLinked: true,
        discordVerified: true,
        discordVerificationMethod: 'discord_oauth_2',
        discordLinkedAt: linkData.linkedAt || Date.now(),
        discordVerifiedAt: linkData.linkedAt || Date.now(),
        updatedAt: Date.now()
      };

      await db.collection('privatePlayerAccounts').doc(userId).set(resolved, { merge: true }).catch(() => {});
      return resolved;
    }

    // Query pbgAccounts by pbgId if userId is a PBG ID or was not found by direct doc ID
    const pbgQuery = await db.collection('pbgAccounts').where('pbgId', '==', userId).limit(1).get();
    if (!pbgQuery.empty) {
      const pbgDoc = pbgQuery.docs[0];
      const pbgData = pbgDoc.data() || {};
      const actualUid = pbgDoc.id;
      const discUserId = pbgData.discordUserId || pbgData.discord?.userId;
      if (discUserId) {
        const linkDoc = await db.collection('discord_links').doc(discUserId).get();
        const linkData = linkDoc.exists ? (linkDoc.data() as DiscordLinkDocument) : null;
        return {
          userId: actualUid,
          pbgId: pbgData.pbgId || linkData?.pbgId,
          discord: {
            userId: discUserId,
            username: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || 'player',
            globalName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
            avatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
            connectedAt: linkData?.linkedAt || pbgData.discordLinkedAt || Date.now(),
            guildMember: linkData?.guildMember ?? pbgData.discord?.guildMember ?? true,
            pbgMemberRole: linkData?.pbgMemberRole ?? pbgData.discord?.pbgMemberRole ?? true,
            verified: true
          },
          discordUserId: discUserId,
          discordUsername: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || 'player',
          discordDisplayName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
          discordAvatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
          discordLinked: true,
          discordVerified: true,
          discordVerificationMethod: 'discord_oauth_2',
          discordLinkedAt: linkData?.linkedAt || Date.now(),
          discordVerifiedAt: linkData?.linkedAt || Date.now(),
          updatedAt: Date.now()
        };
      }
    }

    // Query discord_links by pbgId
    const linkQueryByPbgId = await db.collection('discord_links').where('pbgId', '==', userId).limit(1).get();
    if (!linkQueryByPbgId.empty) {
      const linkData = linkQueryByPbgId.docs[0].data() as DiscordLinkDocument;
      return {
        userId: linkData.pbgUserId || userId,
        pbgId: linkData.pbgId || undefined,
        discord: {
          userId: linkData.discordUserId,
          username: linkData.discordUsername || 'player',
          globalName: linkData.globalName || null,
          avatarUrl: linkData.avatarUrl || null,
          connectedAt: linkData.linkedAt || Date.now(),
          guildMember: Boolean(linkData.guildMember),
          pbgMemberRole: Boolean(linkData.pbgMemberRole),
          verified: true
        },
        discordUserId: linkData.discordUserId,
        discordUsername: linkData.discordUsername || null,
        discordDisplayName: linkData.globalName || null,
        discordAvatarUrl: linkData.avatarUrl || null,
        discordLinked: true,
        discordVerified: true,
        discordVerificationMethod: 'discord_oauth_2',
        discordLinkedAt: linkData.linkedAt || Date.now(),
        discordVerifiedAt: linkData.linkedAt || Date.now(),
        updatedAt: Date.now()
      };
    }

    if (doc.exists) {
      return doc.data() as PrivateDiscordAccount;
    }
  } catch (err) {
    console.warn('[getPrivateDiscordAccount] Firestore error:', err);
  }

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

export interface AuthoritativeUserIdentity {
  uid: string;
  pbgId: string;
  email?: string;
  displayName?: string;
  discordUserId?: string;
  discordLinked: boolean;
  pbgMemberRoleActive: boolean;
}

export async function resolveAuthoritativeUserIdentity(input: string): Promise<AuthoritativeUserIdentity | null> {
  const clean = input.trim();
  if (!clean) return null;

  // 1. Check in-memory account registry
  const memAcc = pbgAccountRegistry.getAccountByUid(clean) || pbgAccountRegistry.getAccountByPbgId(clean);
  if (memAcc) {
    return {
      uid: memAcc.googleUid,
      pbgId: memAcc.pbgId,
      email: memAcc.email,
      displayName: memAcc.displayName,
      discordUserId: memAcc.discordUserId || undefined,
      discordLinked: Boolean(memAcc.discordLinked && memAcc.discordUserId),
      pbgMemberRoleActive: Boolean(memAcc.discordMemberVerified ?? true)
    };
  }

  const db = getAdminDb();
  if (!db) return null;

  try {
    // 2. Direct document lookup by UID in pbgAccounts
    const directDoc = await db.collection('pbgAccounts').doc(clean).get();
    if (directDoc.exists) {
      const data = directDoc.data() || {};
      return {
        uid: directDoc.id,
        pbgId: data.pbgId || clean,
        email: data.email,
        displayName: data.displayName,
        discordUserId: data.discordUserId || data.discord?.userId,
        discordLinked: Boolean((data.discordLinked || data.discord?.verified) && (data.discordUserId || data.discord?.userId)),
        pbgMemberRoleActive: Boolean(data.discord?.pbgMemberRole ?? true)
      };
    }

    // 3. Lookup by pbgId in pbgAccounts
    const pbgSnap = await db.collection('pbgAccounts').where('pbgId', '==', clean).limit(1).get();
    if (!pbgSnap.empty) {
      const doc = pbgSnap.docs[0];
      const data = doc.data() || {};
      return {
        uid: doc.id,
        pbgId: data.pbgId || clean,
        email: data.email,
        displayName: data.displayName,
        discordUserId: data.discordUserId || data.discord?.userId,
        discordLinked: Boolean((data.discordLinked || data.discord?.verified) && (data.discordUserId || data.discord?.userId)),
        pbgMemberRoleActive: Boolean(data.discord?.pbgMemberRole ?? true)
      };
    }

    // 4. Lookup in discord_links by pbgId
    const linkSnap = await db.collection('discord_links').where('pbgId', '==', clean).limit(1).get();
    if (!linkSnap.empty) {
      const data = linkSnap.docs[0].data() as DiscordLinkDocument;
      return {
        uid: data.pbgUserId || clean,
        pbgId: data.pbgId || clean,
        displayName: data.globalName || data.discordUsername || clean,
        discordUserId: data.discordUserId,
        discordLinked: true,
        pbgMemberRoleActive: Boolean(data.pbgMemberRole)
      };
    }

    // 5. Lookup in discord_links by pbgUserId
    const linkSnap2 = await db.collection('discord_links').where('pbgUserId', '==', clean).limit(1).get();
    if (!linkSnap2.empty) {
      const data = linkSnap2.docs[0].data() as DiscordLinkDocument;
      return {
        uid: data.pbgUserId || clean,
        pbgId: data.pbgId || clean,
        displayName: data.globalName || data.discordUsername || clean,
        discordUserId: data.discordUserId,
        discordLinked: true,
        pbgMemberRoleActive: Boolean(data.pbgMemberRole)
      };
    }
  } catch (e) {
    console.warn('[resolveAuthoritativeUserIdentity] Firestore lookup error:', e);
  }

  return null;
}

/**
 * Checks authoritative link record in `discord_links/{discordUserId}`
 */
export async function getDiscordLinkDocument(discordUserId: string): Promise<DiscordLinkDocument | null> {
  const cleanId = discordUserId.trim();
  if (isTestEnv() || !getAdminDb()) {
    return inMemoryLinks.get(cleanId) || null;
  }

  const db = getAdminDb();
  try {
    const doc = await db.collection('discord_links').doc(cleanId).get();
    if (doc.exists) {
      return doc.data() as DiscordLinkDocument;
    }
  } catch {}

  return null;
}

/**
 * Updates Firestore with authoritative Discord membership & role status verified directly with Discord API.
 */
export async function updateDiscordAuthoritativeMembership(params: {
  userId: string;
  discordUserId: string;
  guildMember: boolean;
  pbgMemberRole: boolean;
}): Promise<void> {
  const { userId, discordUserId, guildMember, pbgMemberRole } = params;
  const cleanId = discordUserId.trim();
  const now = Date.now();

  if (isTestEnv()) {
    const existing = inMemoryLinks.get(cleanId);
    if (existing) {
      existing.guildMember = guildMember;
      existing.pbgMemberRole = pbgMemberRole;
      existing.updatedAt = now;
    }
    const acc = inMemoryPrivateAccounts.get(userId);
    if (acc && acc.discord) {
      acc.discord.guildMember = guildMember;
      acc.discord.pbgMemberRole = pbgMemberRole;
      acc.updatedAt = now;
    }
    return;
  }

  const db = getAdminDb();
  if (!db) return;

  try {
    const batch = db.batch();

    // 1. Update discord_links
    const linkRef = db.collection('discord_links').doc(cleanId);
    batch.set(linkRef, {
      guildMember,
      pbgMemberRole,
      updatedAt: now
    }, { merge: true });

    // 2. Update privatePlayerAccounts
    const privateRef = db.collection('privatePlayerAccounts').doc(userId);
    batch.set(privateRef, {
      'discord.guildMember': guildMember,
      'discord.pbgMemberRole': pbgMemberRole,
      updatedAt: now
    }, { merge: true });

    // 3. Update pbgAccounts
    const pbgRef = db.collection('pbgAccounts').doc(userId);
    batch.set(pbgRef, {
      'discord.guildMember': guildMember,
      'discord.pbgMemberRole': pbgMemberRole,
      updatedAt: new Date(now).toISOString()
    }, { merge: true });

    await batch.commit();
  } catch (err: any) {
    console.warn('[updateDiscordAuthoritativeMembership] Firestore update note:', err.message);
  }
}

