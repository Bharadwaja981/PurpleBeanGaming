/**
 * Purple Bean Gaming — Client-Side Steam Ownership Verification Client
 * 
 * Manages the Steam OpenID 2.0 popup lifecycle, message handshake,
 * status synchronization, and unlinking requests.
 */

export interface PrivateAccountStatus {
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

export interface PublicProfileStatus {
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

export type SteamVerificationErrorCode =
  | 'SIGN_IN_REQUIRED'
  | 'POPUP_BLOCKED'
  | 'STEAM_ALREADY_LINKED'
  | 'PBG_ACCOUNT_ALREADY_HAS_STEAM'
  | 'LINK_SESSION_EXPIRED'
  | 'STEAM_VALIDATION_FAILED'
  | 'STEAM_ID_MISSING'
  | 'STEAM_PROVIDER_UNAVAILABLE'
  | 'OPENDOTA_UNAVAILABLE'
  | 'ACTIVE_TOURNAMENT_LOCK'
  | 'UNKNOWN_ERROR';

export class SteamVerificationError extends Error {
  code: SteamVerificationErrorCode;
  constructor(code: SteamVerificationErrorCode, message: string) {
    super(message);
    this.name = 'SteamVerificationError';
    this.code = code;
  }
}

export function getFriendlyErrorMessage(code: string | SteamVerificationErrorCode, rawMessage?: string): string {
  switch (code) {
    case 'SIGN_IN_REQUIRED':
      return 'Please sign in to your PurpleBeanGaming account to verify your Steam identity.';
    case 'POPUP_BLOCKED':
      return 'Steam verification popup was blocked. Allow popups for PurpleBeanGaming and try again.';
    case 'STEAM_ALREADY_LINKED':
      return 'This Steam account is already linked to another PurpleBeanGaming account.';
    case 'PBG_ACCOUNT_ALREADY_HAS_STEAM':
      return 'This account already has a verified Steam account. Please disconnect it first.';
    case 'LINK_SESSION_EXPIRED':
      return 'Your Steam verification session has expired. Please initiate verification again.';
    case 'STEAM_VALIDATION_FAILED':
      return 'Failed to verify Steam ownership with Valve. Please try again.';
    case 'STEAM_ID_MISSING':
      return 'Steam ID could not be identified from the authentication response.';
    case 'STEAM_PROVIDER_UNAVAILABLE':
      return 'Valve Steam OpenID servers are currently unreachable. Please try again later.';
    case 'OPENDOTA_UNAVAILABLE':
      return 'OpenDota API is currently unavailable. Your Steam ownership remains verified.';
    case 'ACTIVE_TOURNAMENT_LOCK':
      return 'Steam cannot be disconnected while you have an active tournament registration.';
    default:
      return rawMessage || 'An unexpected error occurred during Steam verification.';
  }
}

export interface SteamVerificationResult {
  steamId64: string;
  dotaAccountId: string;
  personaName?: string;
}

/**
 * Initiates the Steam OpenID verification popup flow.
 */
export async function startSteamVerificationFlow(
  getIdToken: () => Promise<string>,
  options?: { fallbackToRedirect?: boolean }
): Promise<SteamVerificationResult> {
  let token: string;
  try {
    token = await getIdToken();
    if (!token) throw new Error('SIGN_IN_REQUIRED');
  } catch {
    throw new SteamVerificationError(
      'SIGN_IN_REQUIRED',
      'Please sign in to your PurpleBeanGaming account to verify Steam ownership.'
    );
  }

  // Pre-open window immediately to satisfy browser user gesture requirements
  const width = 800;
  const height = 650;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  let popup: Window | null = null;
  try {
    popup = window.open(
      'about:blank',
      'SteamOpenIdLogin',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,status=no`
    );
  } catch {
    popup = null;
  }

  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    if (options?.fallbackToRedirect) {
      // Fetch start URL and redirect current window
      const res = await fetch('/api/steam/link/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ returnUrl: window.location.pathname })
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return new Promise(() => {}); // Halts until redirect completes
      }
    }
    throw new SteamVerificationError(
      'POPUP_BLOCKED',
      'Steam verification popup was blocked. Allow popups for PurpleBeanGaming and try again.'
    );
  }

  // Render temporary neo-brutalist loading state inside popup
  try {
    popup.document.write(`
      <html>
        <head><title>Connecting to Steam | PurpleBeanGaming</title></head>
        <body style="font-family: monospace; background: #FFE600; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
          <div style="background:white; border:4px solid black; box-shadow:6px 6px 0 #000; padding:20px; text-align:center;">
            <h3 style="margin:0 0 8px 0; font-size:16px;">CONNECTING TO STEAM...</h3>
            <p style="margin:0; font-size:12px;">Opening official Valve login portal</p>
          </div>
        </body>
      </html>
    `);
  } catch {
    // Cross-origin write note
  }

  // Request Steam start URL from backend with client-side fallback
  let redirectUrl = '';
  try {
    const res = await fetch('/api/steam/link/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ returnUrl: window.location.pathname })
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.redirectUrl) {
        redirectUrl = data.redirectUrl;
      }
    }
  } catch (err) {
    console.warn('[SteamVerification] /api/steam/link/start unreachable, using client fallback:', err);
  }

  // Resilient fallback: Construct official Valve Steam OpenID 2.0 URL directly
  if (!redirectUrl) {
    try {
      const origin = window.location.origin;
      let uid = 'user';
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          uid = payload.user_id || payload.sub || payload.uid || 'user';
        }
      } catch {}

      const rawPayload = JSON.stringify({
        uid,
        timestamp: Date.now(),
        returnUrl: window.location.pathname,
        origin
      });
      const encodedPayload = btoa(rawPayload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const stateToken = `client_${encodedPayload}`;

      const returnToUrl = `${origin}/api/steam/link/callback?state=${encodeURIComponent(stateToken)}`;
      const params = new URLSearchParams({
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': returnToUrl,
        'openid.realm': origin,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
      });
      redirectUrl = `https://steamcommunity.com/openid/login?${params.toString()}`;
    } catch (fallbackErr) {
      if (popup && !popup.closed) popup.close();
      throw new SteamVerificationError(
        'STEAM_PROVIDER_UNAVAILABLE',
        'Failed to construct Steam verification portal link.'
      );
    }
  }

  // Clear any existing stored result
  try {
    localStorage.removeItem('pbg_steam_link_result');
  } catch {}

  const flowStartTime = Date.now() - 500;

  // Check initial state to differentiate prior links
  let initialUpdatedAt = 0;
  try {
    const initStatus = await fetchSteamLinkStatus(getIdToken);
    if (initStatus.isOwner && initStatus.account?.steamOwnershipVerified) {
      initialUpdatedAt = initStatus.account.updatedAt || 0;
    }
  } catch {}

  // Navigate popup to Steam
  popup.location.href = redirectUrl;

  // Await result via BroadcastChannel, storage event, postMessage, or polling
  return new Promise<SteamVerificationResult>((resolve, reject) => {
    let checkInterval: any = null;
    let channel: BroadcastChannel | null = null;
    let handled = false;
    let isPollingServer = false;

    const cleanup = () => {
      handled = true;
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
      if (channel) {
        try { channel.close(); } catch {}
      }
      if (checkInterval) clearInterval(checkInterval);
      try {
        localStorage.removeItem('pbg_steam_link_result');
      } catch {}
      try {
        if (popup && !popup.closed) {
          popup.close();
        }
      } catch {}
    };

    const processResultData = (data: any) => {
      if (handled || !data || typeof data !== 'object') return;

      if (data.type === 'STEAM_LINK_SUCCESS') {
        cleanup();
        resolve({
          steamId64: data.steamId64,
          dotaAccountId: data.dotaAccountId,
          personaName: data.personaName
        });
      } else if (data.type === 'STEAM_LINK_ERROR') {
        cleanup();
        const code = (data.error || 'STEAM_VALIDATION_FAILED') as SteamVerificationErrorCode;
        reject(new SteamVerificationError(code, getFriendlyErrorMessage(code, data.message)));
      }
    };

    const checkServerVerification = async (): Promise<boolean> => {
      if (handled || isPollingServer) return false;
      isPollingServer = true;
      try {
        const status = await fetchSteamLinkStatus(getIdToken);
        if (status.isOwner && status.account && status.account.steamOwnershipVerified) {
          const acc = status.account;
          if (acc.steamId64 && (acc.updatedAt > initialUpdatedAt || acc.updatedAt >= flowStartTime)) {
            processResultData({
              type: 'STEAM_LINK_SUCCESS',
              steamId64: acc.steamId64,
              dotaAccountId: acc.dotaAccountId,
              personaName: acc.steamPersonaName
            });
            return true;
          }
        }
      } catch {
        // Continue polling
      } finally {
        isPollingServer = false;
      }
      return false;
    };

    const handleMessage = (event: MessageEvent) => {
      processResultData(event.data);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'pbg_steam_link_result' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          processResultData(parsed);
        } catch {}
      }
    };

    // 1. Listen via postMessage
    window.addEventListener('message', handleMessage);

    // 2. Listen via Storage event
    window.addEventListener('storage', handleStorage);

    // 3. Listen via BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('pbg_steam_auth');
        channel.onmessage = (event) => {
          processResultData(event.data);
        };
      }
    } catch {}

    // 4. Poll for storage, server state, and window closure
    let pollCount = 0;
    checkInterval = setInterval(async () => {
      if (handled) return;
      pollCount++;

      // A. Check localStorage for result
      try {
        const stored = localStorage.getItem('pbg_steam_link_result');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.timestamp || 0) >= flowStartTime) {
            processResultData(parsed);
            return;
          }
        }
      } catch {}

      // B. Authoritatively poll server status every 1.2s (survives cross-origin iframe / severed opener)
      if (pollCount % 3 === 0) {
        const verified = await checkServerVerification();
        if (verified) return;
      }

      // C. Check if popup was closed
      if (popup && popup.closed) {
        // When popup closes, perform a final server check after a tiny tick
        setTimeout(async () => {
          if (handled) return;

          // Final server verification check
          const verified = await checkServerVerification();
          if (verified) return;

          // Final localStorage check
          try {
            const stored = localStorage.getItem('pbg_steam_link_result');
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed && (parsed.timestamp || 0) >= flowStartTime) {
                processResultData(parsed);
                return;
              }
            }
          } catch {}

          cleanup();
          reject(new SteamVerificationError('UNKNOWN_ERROR', 'Steam verification window was closed.'));
        }, 350);
      }
    }, 400);
  });
}

/**
 * Fetches status for current user (private account) or another user (safe public profile).
 */
export async function fetchSteamLinkStatus(
  getIdToken?: () => Promise<string>,
  targetUserId?: string
): Promise<{ isOwner: boolean; account?: PrivateAccountStatus; profile?: PublicProfileStatus }> {
  let headers: Record<string, string> = {};
  if (getIdToken) {
    try {
      const token = await getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // Unauthenticated
    }
  }

  const query = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : '';
  const res = await fetch(`/api/steam/link/status${query}`, { headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new SteamVerificationError(
      (err.error || 'UNKNOWN_ERROR') as SteamVerificationErrorCode,
      getFriendlyErrorMessage(err.error, err.message)
    );
  }

  return await res.json();
}

/**
 * Disconnects the user's Steam account with active tournament registration lock check.
 */
export async function disconnectSteamAccount(getIdToken: () => Promise<string>): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new SteamVerificationError('SIGN_IN_REQUIRED', 'Please sign in to disconnect Steam.');
  }

  const res = await fetch('/api/steam/link/unlink', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const code = (err.error || 'DISCONNECT_FAILED') as SteamVerificationErrorCode;
    throw new SteamVerificationError(code, getFriendlyErrorMessage(code, err.message));
  }
}

export { maskSteamId64 } from '../../lib/dota/ids';
