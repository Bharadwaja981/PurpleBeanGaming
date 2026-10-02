import crypto from 'node:crypto';

export interface SteamStatePayload {
  uid: string;
  email?: string;
  returnUrl?: string;
  timestamp: number;
  nonce: string;
}

const DEFAULT_SECRET = 'pbg_steam_state_super_secure_secret_production_seed_2026';
const STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function getStateSecret(): string {
  return process.env.STEAM_OPENID_STATE_SECRET || DEFAULT_SECRET;
}

/**
 * Generates an HMAC-SHA256 signed state token encapsulating the user identity.
 * Format: base64url(payload).hex(hmac)
 */
export function generateSignedSteamState(
  uid: string,
  options?: { email?: string; returnUrl?: string }
): string {
  if (!uid || typeof uid !== 'string') {
    throw new Error('UID is required to generate Steam state token');
  }

  const payload: SteamStatePayload = {
    uid,
    email: options?.email,
    returnUrl: options?.returnUrl,
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

export type StateVerificationResult = 
  | { success: true; payload: SteamStatePayload }
  | { success: false; error: 'LINK_SESSION_EXPIRED' | 'STEAM_VALIDATION_FAILED'; details: string };

/**
 * Validates a signed state token against HMAC-SHA256 and expiration.
 */
export function verifySignedSteamState(
  stateToken: string,
  customMaxAgeMs: number = STATE_MAX_AGE_MS
): StateVerificationResult {
  if (!stateToken || typeof stateToken !== 'string') {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'Missing state token'
    };
  }

  const parts = stateToken.split('.');
  if (parts.length !== 2) {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'Malformed state token format'
    };
  }

  const [encodedPayload, receivedSignature] = parts;

  // Verify HMAC signature using timing-safe comparison
  const expectedSignature = crypto
    .createHmac('sha256', getStateSecret())
    .update(encodedPayload)
    .digest('hex');

  const receivedBuf = Buffer.from(receivedSignature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'State token signature mismatch or tampering detected'
    };
  }

  // Parse payload
  let payload: SteamStatePayload;
  try {
    const json = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    payload = JSON.parse(json);
  } catch {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'Malformed state token JSON'
    };
  }

  if (!payload.uid || !payload.timestamp || !payload.nonce) {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'State payload is missing required fields'
    };
  }

  // Verify expiration
  const now = Date.now();
  if (now - payload.timestamp >= customMaxAgeMs) {
    return {
      success: false,
      error: 'LINK_SESSION_EXPIRED',
      details: 'Steam verification session has expired. Please initiate verification again.'
    };
  }

  // Prevent tokens from the future (> 60 seconds clock skew)
  if (payload.timestamp > now + 60000) {
    return {
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      details: 'State token issued timestamp is invalid'
    };
  }

  return { success: true, payload };
}
