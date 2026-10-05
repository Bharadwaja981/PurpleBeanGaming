/**
 * Purple Bean Gaming — Client-Side Discord OAuth 2.0 Verification Client
 * 
 * Provides robust popup-based Discord OAuth2 Authorization Code flow (scope: identify),
 * server status polling, and automatic localStorage/BroadcastChannel synchronization.
 */

export interface DiscordIdentityData {
  userId: string; // Permanent Discord Snowflake ID
  username: string;
  globalName: string | null;
  avatarUrl: string | null;
  guildMember?: boolean;
  pbgMemberRole?: boolean;
  connectedAt: number;
  verified: true;
}

export interface PrivateDiscordAccountStatus {
  userId: string;
  pbgId?: string;
  discord?: DiscordIdentityData | null;
  tournamentRoles?: {
    pbgMemberRoleActive: boolean;
    pbgPlayerRoleActive: boolean;
    pbgCaptainRoleActive: boolean;
    teamRoleActive: boolean;
    teamName: string | null;
    expectedRoles: string[];
    actualRoleNames: string[];
    syncRequired: boolean;
  };
  discordLinked: boolean;
  discordVerified: boolean;
  discordUserId: string | null;
  discordUsername: string | null;
  discordDisplayName: string | null;
  discordAvatarUrl: string | null;
  discordVerificationMethod?: string;
  discordLinkedAt?: number;
  discordVerifiedAt?: number;
  updatedAt: number;
}

export interface DiscordAuthStartResponse {
  success: boolean;
  isConfigured: boolean;
  clientId?: string;
  authUrl?: string;
  redirectUri: string;
  developmentCallbackUrl: string;
  sharedCallbackUrl: string;
  stateToken: string;
}

export interface DiscordVerificationResult {
  discordUserId: string;
  discordUsername: string;
  discordDisplayName?: string;
  discord?: DiscordIdentityData;
}

export class DiscordVerificationError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'DiscordVerificationError';
  }
}

/**
 * Validates 17-20 digit Discord Snowflake ID
 */
export function validateDiscordSnowflake(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^\d{17,20}$/.test(id.trim());
}

/**
 * Initiates the Discord OAuth 2.0 authorization flow in a popup.
 * Opens official Discord OAuth authorize URL directly with scope: identify.
 * Listens via postMessage, BroadcastChannel, localStorage, and active server status polling.
 */
export async function startDiscordOAuthFlow(
  getIdToken: () => Promise<string>,
  pbgId?: string
): Promise<DiscordVerificationResult> {
  const token = await getIdToken();
  if (!token) {
    throw new DiscordVerificationError('SIGN_IN_REQUIRED', 'Please sign in to verify Discord.');
  }

  // Request OAuth start details from server
  const res = await fetch('/api/auth/discord/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      returnUrl: window.location.pathname,
      pbgId: pbgId || undefined
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new DiscordVerificationError(err.error || 'DISCORD_START_FAILED', err.message || 'Failed to initialize Discord authorization.');
  }

  const startData: DiscordAuthStartResponse = await res.json();

  if (!startData.isConfigured || !startData.authUrl) {
    throw new DiscordVerificationError(
      'OAUTH_NOT_CONFIGURED',
      `Discord OAuth2 application is not yet configured. Please set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in environment variables. Callback URL: ${startData.developmentCallbackUrl}`
    );
  }

  // Open popup directly to Discord authorize URL
  const width = 500;
  const height = 750;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2.5;

  const popup = window.open(
    startData.authUrl,
    'pbg_discord_oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,resizable=yes`
  );

  if (!popup || popup.closed) {
    throw new DiscordVerificationError(
      'POPUP_BLOCKED',
      'Popup was blocked by your browser. Please allow popups for Purple Bean Gaming to connect Discord.'
    );
  }

  try {
    localStorage.removeItem('pbg_discord_link_result');
  } catch {}

  const flowStartTime = Date.now() - 500;

  return new Promise<DiscordVerificationResult>((resolve, reject) => {
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
      try { localStorage.removeItem('pbg_discord_link_result'); } catch {}
      try {
        if (popup && !popup.closed) popup.close();
      } catch {}
    };

    const processResultData = (data: any) => {
      if (handled || !data || typeof data !== 'object') return;

      if (data.type === 'DISCORD_AUTH_SUCCESS' || data.type === 'DISCORD_LINK_SUCCESS') {
        cleanup();
        resolve({
          discordUserId: data.discordUserId || data.discord?.userId,
          discordUsername: data.discordUsername || data.discord?.username,
          discordDisplayName: data.discordDisplayName || data.discord?.globalName,
          discord: data.discord
        });
      } else if (data.type === 'DISCORD_AUTH_ERROR' || data.type === 'DISCORD_LINK_ERROR') {
        cleanup();
        reject(new DiscordVerificationError(data.error || 'DISCORD_LINK_FAILED', data.message || 'Discord authentication was cancelled or failed.'));
      }
    };

    const checkServerVerification = async (): Promise<boolean> => {
      if (handled || isPollingServer) return false;
      isPollingServer = true;
      try {
        const status = await fetchDiscordLinkStatus(getIdToken);
        if (status.isOwner && status.account && status.account.discordLinked && status.account.discordUserId) {
          if (status.account.updatedAt >= flowStartTime) {
            processResultData({
              type: 'DISCORD_AUTH_SUCCESS',
              discord: status.account.discord,
              discordUserId: status.account.discordUserId,
              discordUsername: status.account.discordUsername,
              discordDisplayName: status.account.discordDisplayName
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
      // Validate trusted origin
      const trustedOrigins = [
        window.location.origin,
        'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app',
        'https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app'
      ];
      if (!event.origin || !trustedOrigins.includes(event.origin)) {
        return;
      }
      // Validate expected message shape
      if (!event.data || typeof event.data !== 'object') return;
      if (typeof event.data.type !== 'string' || !event.data.type.startsWith('DISCORD_')) return;

      processResultData(event.data);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'pbg_discord_link_result' && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          processResultData(parsed);
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel('pbg_discord_auth');
        channel.onmessage = (event) => {
          processResultData(event.data);
        };
      }
    } catch {}

    let pollCount = 0;
    checkInterval = setInterval(async () => {
      if (handled) return;
      pollCount++;

      // A. Check localStorage
      try {
        const stored = localStorage.getItem('pbg_discord_link_result');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && (parsed.timestamp || 0) >= flowStartTime) {
            processResultData(parsed);
            return;
          }
        }
      } catch {}

      // B. Authoritative server check every 1.2s
      if (pollCount % 3 === 0) {
        const verified = await checkServerVerification();
        if (verified) return;
      }

      // C. Window closed
      if (popup && popup.closed) {
        setTimeout(async () => {
          if (handled) return;
          const verified = await checkServerVerification();
          if (verified) return;

          cleanup();
          reject(new DiscordVerificationError('WINDOW_CLOSED', 'Discord authorization window was closed.'));
        }, 350);
      }
    }, 400);
  });
}

/**
 * Fetches Discord link status for current user or target user.
 */
export async function fetchDiscordLinkStatus(
  getIdToken?: () => Promise<string>,
  targetUserId?: string
): Promise<{ success: boolean; isOwner: boolean; account?: PrivateDiscordAccountStatus }> {
  let headers: Record<string, string> = {};
  if (getIdToken) {
    try {
      const token = await getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {}
  }

  const query = targetUserId ? `?userId=${encodeURIComponent(targetUserId)}` : '';
  const res = await fetch(`/api/auth/discord/status${query}`, { headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new DiscordVerificationError(err.error || 'FETCH_FAILED', err.message || 'Failed to fetch Discord status.');
  }

  return await res.json();
}

/**
 * Disconnects Discord account.
 */
export async function disconnectDiscordAccount(getIdToken: () => Promise<string>): Promise<void> {
  const token = await getIdToken();
  if (!token) {
    throw new DiscordVerificationError('SIGN_IN_REQUIRED', 'Please sign in to disconnect Discord.');
  }

  const res = await fetch('/api/auth/discord/unlink', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new DiscordVerificationError(err.error || 'DISCONNECT_FAILED', err.message || 'Failed to disconnect Discord.');
  }
}
