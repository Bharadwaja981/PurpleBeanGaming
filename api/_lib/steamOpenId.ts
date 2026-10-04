/**
 * Steam OpenID 2.0 Protocol Handler
 * 
 * Generates authoritative checkid_setup authentication requests and
 * performs check_authentication server-to-server validation against Valve.
 */

export const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
export const OPENID_NS = 'http://specs.openid.net/auth/2.0';
export const OPENID_IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

export interface SteamOpenIdConfig {
  realm: string;
  returnToUrl: string;
}

/**
 * Constructs the official Steam OpenID 2.0 redirect URL.
 */
export function buildSteamOpenIdLoginUrl(config: SteamOpenIdConfig): string {
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    'openid.return_to': config.returnToUrl,
    'openid.realm': config.realm,
    'openid.identity': OPENID_IDENTIFIER_SELECT,
    'openid.claimed_id': OPENID_IDENTIFIER_SELECT
  });

  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export interface SteamCallbackValidationResult {
  isValid: boolean;
  steamId64?: string;
  claimedId?: string;
  error?: string;
}

/**
 * Validates the Steam OpenID 2.0 callback against Valve's check_authentication endpoint.
 * Never trusts client-supplied claimed_id without server-to-server confirmation.
 */
export async function validateSteamOpenIdCallback(
  queryParams: Record<string, any>
): Promise<SteamCallbackValidationResult> {
  const mode = queryParams['openid.mode'];

  if (mode === 'cancel') {
    return {
      isValid: false,
      error: 'STEAM_CANCELLED: User cancelled Steam OpenID login.'
    };
  }

  if (mode !== 'id_res') {
    return {
      isValid: false,
      error: 'STEAM_VALIDATION_FAILED: Invalid openid.mode in callback.'
    };
  }

  // Extract openid.* parameters to verify with Steam
  const postParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (key.startsWith('openid.')) {
      postParams.set(key, String(value));
    }
  }

  // Crucial: change mode to check_authentication
  postParams.set('openid.mode', 'check_authentication');

  try {
    const response = await fetch(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'PurpleBeanGaming/1.0 (Steam-OpenID-2.0)'
      },
      body: postParams.toString()
    });

    if (!response.ok) {
      return {
        isValid: false,
        error: `STEAM_PROVIDER_UNAVAILABLE: Valve OpenID server returned HTTP ${response.status}`
      };
    }

    const text = await response.text();
    // Valve response format: key:value separated by newlines
    // Must contain: is_valid:true
    const lines = text.split('\n');
    const keyValueMap: Record<string, string> = {};

    for (const line of lines) {
      const idx = line.indexOf(':');
      if (idx !== -1) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        keyValueMap[k] = v;
      }
    }

    if (keyValueMap['is_valid'] !== 'true') {
      return {
        isValid: false,
        error: 'STEAM_VALIDATION_FAILED: Steam check_authentication responded is_valid:false'
      };
    }

    // Extract claimed_id from query params
    const claimedId = queryParams['openid.claimed_id'] || queryParams['openid.identity'];
    if (!claimedId || typeof claimedId !== 'string') {
      return {
        isValid: false,
        error: 'STEAM_ID_MISSING: Missing claimed_id in OpenID callback'
      };
    }

    // Official Steam claimed_id pattern: https://steamcommunity.com/openid/id/76561198...
    const match = /^https:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17})\/?$/.exec(claimedId);
    if (!match || !match[1]) {
      return {
        isValid: false,
        claimedId,
        error: 'STEAM_ID_MISSING: Malformed Steam64 ID in claimed_id'
      };
    }

    const steamId64 = match[1];

    // Validate 17-digit numeric identifier
    if (!/^[0-9]{17}$/.test(steamId64)) {
      return {
        isValid: false,
        error: 'STEAM_ID_MISSING: Invalid 17-digit Steam64 identifier'
      };
    }

    return {
      isValid: true,
      steamId64,
      claimedId
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: `STEAM_PROVIDER_UNAVAILABLE: Failed to reach Valve OpenID verification endpoint (${err?.message || 'network error'})`
    };
  }
}
