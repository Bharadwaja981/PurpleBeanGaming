/**
 * Purple Bean Gaming — Server-Side Discord OAuth State Engine
 * 
 * Provides:
 * - Cryptographically random nonces (16 bytes)
 * - HMAC-SHA256 signature tied to the authenticated PBG user UID
 * - Short-lived expiration (10 minutes)
 * - Shared, persistent single-use consumption in Firestore (Strict Cross-Instance Replay Protection)
 * - Strict server-side trusted origin allowlist
 */

import crypto from 'node:crypto';
import { getAdminDb } from './firebaseAdmin';

export interface DiscordOAuthStatePayload {
  uid: string; // Authenticated PBG User UID
  pbgId?: string;
  email?: string;
  returnUrl?: string;
  origin: string; // Server-validated trusted PBG origin
  timestamp: number;
  nonce: string;
}

const DEFAULT_DISCORD_STATE_SECRET = 'pbg_discord_oauth_state_secret_seed_authoritative_2026';
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export const ALLOWED_PBG_ORIGINS: readonly string[] = Object.freeze([
  'https://purplebeangaming.com',
  'https://www.purplebeangaming.com',
  'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app',
  'https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

/**
 * Validates candidate client origin against server allowlist.
 * Never accepts arbitrary client origins into OAuth state.
 */
export function sanitizeTrustedOrigin(candidateOrigin?: string): string {
  const defaultOrigin = process.env.APP_URL 
    ? process.env.APP_URL.trim().replace(/\/+$/, '') 
    : 'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app';

  if (!candidateOrigin || typeof candidateOrigin !== 'string') {
    return defaultOrigin;
  }

  const clean = candidateOrigin.trim().replace(/\/+$/, '');
  if (ALLOWED_PBG_ORIGINS.includes(clean) || (process.env.APP_URL && clean === defaultOrigin)) {
    return clean;
  }

  return defaultOrigin;
}

function getStateSecret(): string {
  return process.env.DISCORD_STATE_SECRET || process.env.STEAM_OPENID_STATE_SECRET || DEFAULT_DISCORD_STATE_SECRET;
}

// In-memory store for unit test suites and offline environments
const inMemoryConsumedNonces = new Map<string, number>();

export const isTestEnv = (): boolean => process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

export function _resetDiscordOAuthStateStore(): void {
  inMemoryConsumedNonces.clear();
}

/**
 * Periodically purge in-memory nonces older than 15 minutes
 */
function pruneExpiredNonces(): void {
  const cutoff = Date.now() - (15 * 60 * 1000);
  for (const [nonce, consumedAt] of inMemoryConsumedNonces.entries()) {
    if (consumedAt < cutoff) {
      inMemoryConsumedNonces.delete(nonce);
    }
  }
}

/**
 * TTL / Expiry cleanup utility for persistent Firestore consumed_oauth_states
 */
export async function cleanExpiredConsumedNonces(): Promise<number> {
  if (isTestEnv()) {
    pruneExpiredNonces();
    return 0;
  }

  const db = getAdminDb();
  if (!db) return 0;

  try {
    const now = Date.now();
    const expiredSnap = await db
      .collection('consumed_oauth_states')
      .where('expiresAt', '<', now)
      .limit(100)
      .get();

    if (expiredSnap.empty) return 0;

    const batch = db.batch();
    for (const doc of expiredSnap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    return expiredSnap.size;
  } catch (err: any) {
    console.warn('[cleanExpiredConsumedNonces] Cleanup note:', err.message);
    return 0;
  }
}

/**
 * Generates an HMAC-SHA256 signed OAuth state token encapsulating the user identity and a random nonce.
 * Enforces server-side trusted origin allowlist.
 * Format: base64url(payload).hex(hmac)
 */
export function generateSignedDiscordOAuthState(
  uid: string,
  options?: { email?: string; pbgId?: string; returnUrl?: string; origin?: string }
): string {
  if (!uid || typeof uid !== 'string') {
    throw new Error('UID is required to generate Discord OAuth state token');
  }

  const validatedOrigin = sanitizeTrustedOrigin(options?.origin);

  const payload: DiscordOAuthStatePayload = {
    uid,
    email: options?.email,
    pbgId: options?.pbgId,
    returnUrl: options?.returnUrl,
    origin: validatedOrigin,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };

  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, 'utf8').toString('base64url');

  const hmac = crypto
    .createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('hex');

  return `${encodedPayload}.${hmac}`;
}

export type DiscordStateVerificationResult =
  | { success: true; payload: DiscordOAuthStatePayload }
  | { success: false; error: 'STATE_EXPIRED' | 'STATE_TAMPERED' | 'STATE_REPLAYED' | 'INVALID_FORMAT' | 'USER_MISMATCH'; details: string };

/**
 * Validates a signed Discord state token and atomically consumes its nonce in a shared persistent store.
 * 
 * PERSISTENT STORAGE:
 * - Uses Firestore transaction on `consumed_oauth_states/{nonce}` so replays across different
 *   Cloud Run / server instances are atomically detected and rejected.
 * - Records TTL for audit and cleanup.
 */
export async function verifyAndConsumeDiscordOAuthState(
  stateToken: string,
  options?: { expectedUid?: string; customMaxAgeMs?: number }
): Promise<DiscordStateVerificationResult> {
  if (!stateToken || typeof stateToken !== 'string') {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      details: 'Missing state token'
    };
  }

  const parts = stateToken.split('.');
  if (parts.length !== 2) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      details: 'Malformed state token format'
    };
  }

  const [encodedPayload, receivedSignature] = parts;

  // 1. Verify HMAC signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('hex');

  const receivedBuf = Buffer.from(receivedSignature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return {
      success: false,
      error: 'STATE_TAMPERED',
      details: 'State token signature mismatch or tampering detected'
    };
  }

  // 2. Parse payload
  let payload: DiscordOAuthStatePayload;
  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      details: 'Malformed state payload JSON'
    };
  }

  if (!payload.uid || !payload.timestamp || !payload.nonce) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      details: 'State payload is missing required security fields'
    };
  }

  // 3. User binding check
  if (options?.expectedUid && payload.uid !== options.expectedUid) {
    return {
      success: false,
      error: 'USER_MISMATCH',
      details: `State token belongs to user ${payload.uid}, but caller is ${options.expectedUid}`
    };
  }

  // 4. Verify expiration & clock skew
  const maxAge = options?.customMaxAgeMs ?? STATE_MAX_AGE_MS;
  const now = Date.now();
  if (now - payload.timestamp >= maxAge) {
    return {
      success: false,
      error: 'STATE_EXPIRED',
      details: 'Discord OAuth verification session has expired. Please initiate connection again.'
    };
  }

  if (payload.timestamp > now + 60000) {
    return {
      success: false,
      error: 'STATE_TAMPERED',
      details: 'State token issued timestamp is in the future'
    };
  }

  // 5. Shared persistent single-use replay protection
  // In production / multi-instance Cloud Run, Firestore transaction guarantees cross-instance atomicity
  if (!isTestEnv()) {
    const db = getAdminDb();
    if (!db || typeof db.runTransaction !== 'function') {
      return {
        success: false,
        error: 'STATE_TAMPERED',
        details: 'Shared persistent authentication store is unavailable for state validation.'
      };
    }

    try {
      const alreadyUsed = await db.runTransaction(async (transaction: any) => {
        const nonceRef = db.collection('consumed_oauth_states').doc(payload.nonce);
        const nonceDoc = await transaction.get(nonceRef);

        if (nonceDoc.exists) {
          return true; // Replayed across any server instance
        }

        transaction.set(nonceRef, {
          uid: payload.uid,
          nonce: payload.nonce,
          consumedAt: now,
          expiresAt: payload.timestamp + maxAge
        });

        return false;
      });

      if (alreadyUsed) {
        return {
          success: false,
          error: 'STATE_REPLAYED',
          details: 'This OAuth authorization state has already been consumed. Replay rejected across instances.'
        };
      }
    } catch (err: any) {
      console.error('[verifyAndConsumeDiscordOAuthState] Firestore transaction error:', err.message);
      // Strictly fail-closed: never fall back to local process memory across Cloud Run instances
      return {
        success: false,
        error: 'STATE_REPLAYED',
        details: 'Failed to atomically verify state nonce against persistent store.'
      };
    }
  } else {
    // Offline / unit-test fallback
    pruneExpiredNonces();
    if (inMemoryConsumedNonces.has(payload.nonce)) {
      return {
        success: false,
        error: 'STATE_REPLAYED',
        details: 'This OAuth authorization state has already been consumed. Replay rejected.'
      };
    }
  }

  // Record in inMemory cache for test execution and tracking
  inMemoryConsumedNonces.set(payload.nonce, now);

  return { success: true, payload };
}
