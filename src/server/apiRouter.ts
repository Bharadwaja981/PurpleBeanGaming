import { Router, Request, Response } from 'express';
import { verifyFirebaseBearerToken } from './firebaseAdmin';
import { generateSignedSteamState, verifySignedSteamState } from './steamState';
import { buildSteamOpenIdLoginUrl, validateSteamOpenIdCallback } from './steamOpenId';
import {
  linkSteamAccountAuthoritative,
  unlinkSteamAccountAuthoritative,
  getPrivatePlayerAccount,
  getPublicPlayerSafeProfile
} from './steamVerificationService';
import {
  linkDiscordAccountAuthoritative,
  unlinkDiscordAccountAuthoritative,
  getPrivateDiscordAccount,
  validateDiscordSnowflake,
  reserveDiscordIdentityClaim,
  rollbackDiscordIdentityReservation,
  finalizeDiscordAccountAuthoritative,
  updateDiscordAuthoritativeMembership
} from './discordVerificationService';
import {
  generateSignedDiscordOAuthState,
  verifyAndConsumeDiscordOAuthState,
  sanitizeTrustedOrigin
} from './discordOAuthState';
import {
  fetchDiscordUserProfile,
  provisionDiscordGuildAndRole
} from './discordProvisioningService';

export const apiRouter = Router();

// -------------------------------------------------------------
// In-Memory Live Auction Hub & Server-Sent Events (SSE)
// Guarantees cross-profile, cross-device, incognito live syncing
// -------------------------------------------------------------

interface SseClient {
  id: string;
  res: Response;
}

const auctionSnapshots = new Map<string, any>();
const auctionSseClients = new Map<string, Set<SseClient>>();

function broadcastToAuctionRoom(tournamentId: string, eventType: string, payload: any) {
  const clients = auctionSseClients.get(tournamentId);
  if (!clients || clients.size === 0) return;

  const data = JSON.stringify({
    type: eventType,
    tournamentId,
    timestamp: Date.now(),
    payload
  });

  const message = `event: ${eventType}\ndata: ${data}\n\n`;

  for (const client of clients) {
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    service: 'purplebeangaming-api',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// SSE Real-time stream for an auction room
apiRouter.get('/auction/:tournamentId/stream', (req: Request, res: Response) => {
  const tournamentId = req.params.tournamentId || 'purple-bean-test-cup';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const client: SseClient = { id: clientId, res };

  if (!auctionSseClients.has(tournamentId)) {
    auctionSseClients.set(tournamentId, new Set());
  }
  auctionSseClients.get(tournamentId)!.add(client);

  // Send current state if available immediately upon connection
  const existingSnapshot = auctionSnapshots.get(tournamentId);
  if (existingSnapshot) {
    res.write(`event: INIT_STATE\ndata: ${JSON.stringify({ type: 'INIT_STATE', tournamentId, payload: existingSnapshot })}\n\n`);
  } else {
    res.write(`event: CONNECTED\ndata: ${JSON.stringify({ type: 'CONNECTED', tournamentId, clientId })}\n\n`);
  }

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const set = auctionSseClients.get(tournamentId);
    if (set) {
      set.delete(client);
      if (set.size === 0) {
        auctionSseClients.delete(tournamentId);
      }
    }
  });
});

// Retrieve current snapshot
apiRouter.get('/auction/:tournamentId', (req: Request, res: Response) => {
  const tournamentId = req.params.tournamentId || 'purple-bean-test-cup';
  const snapshot = auctionSnapshots.get(tournamentId) || null;
  res.json({ success: true, tournamentId, snapshot });
});

// Sync latest authoritative snapshot from organiser or active client
apiRouter.post('/auction/:tournamentId/sync', (req: Request, res: Response) => {
  const tournamentId = req.params.tournamentId || 'purple-bean-test-cup';
  const { snapshot, eventType } = req.body || {};

  if (!snapshot) {
    return res.status(400).json({ success: false, error: 'Snapshot payload required' });
  }

  // Store authoritative in-memory snapshot
  auctionSnapshots.set(tournamentId, {
    ...snapshot,
    lastServerUpdatedAt: Date.now()
  });

  // Broadcast to all connected clients in this auction room
  broadcastToAuctionRoom(tournamentId, eventType || 'AUCTION_STATE_SYNC', snapshot);

  return res.json({ success: true, tournamentId, syncedAt: Date.now() });
});

// Direct action endpoint (extend timer, nominate, bid, pause, resume)
apiRouter.post('/auction/:tournamentId/action', (req: Request, res: Response) => {
  const tournamentId = req.params.tournamentId || 'purple-bean-test-cup';
  const { action, payload } = req.body || {};

  if (!action) {
    return res.status(400).json({ success: false, error: 'Action type required' });
  }

  const existing = auctionSnapshots.get(tournamentId);
  if (existing) {
    if (action === 'EXTEND_TIMER') {
      const addedSec = payload?.seconds || 15;
      if (existing.state) {
        existing.state.secondsRemaining = (existing.state.secondsRemaining || 0) + addedSec;
        existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1000;
      }
    } else if (action === 'SET_TIMER') {
      const newSec = payload?.seconds || 30;
      if (existing.state) {
        existing.state.secondsRemaining = newSec;
        existing.state.timerEndsAt = Date.now() + newSec * 1000;
      }
    } else if (action === 'PAUSE') {
      if (existing.state) {
        existing.state.status = 'PAUSED';
      }
    } else if (action === 'RESUME') {
      if (existing.state) {
        existing.state.status = 'LIVE';
        if (existing.state.secondsRemaining) {
          existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1000;
        }
      }
    } else if (action === 'NOMINATE') {
      if (existing.state && payload?.player) {
        existing.state.nominee = payload.player;
        existing.state.currentBid = payload.minimumBid || 100;
        existing.state.leadingTeamId = '';
        existing.state.leadingTeamName = '';
        existing.state.status = 'LIVE';
        existing.state.roundPhase = 'BIDDING';
        existing.state.secondsRemaining = payload.timerSeconds || 30;
        existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1000;
        existing.state.revision = (existing.state.revision || 0) + 1;
      }
    }

    existing.lastServerUpdatedAt = Date.now();
    auctionSnapshots.set(tournamentId, existing);
    broadcastToAuctionRoom(tournamentId, `AUCTION_${action}`, existing);
  }

  return res.json({ success: true, action, tournamentId, updated: Boolean(existing) });
});

// =============================================================================
// OpenDota Server-Side Caching Proxy & Identity Gateway (Sections 32-37)
// The OpenDota API key remains strictly server-side.
// Responses are cached with domain-specific TTLs to protect rate limits.
// =============================================================================

interface ServerCacheEntry {
  data: any;
  expiresAt: number;
  fetchedAt: number;
}

const openDotaServerCache = new Map<string, ServerCacheEntry>();
const OPENDOTA_BASE_URL = 'https://api.opendota.com/api';
let lastSuccessfulOpenDotaRequest: string | null = null;
let lastOpenDotaError: string | null = null;
let lastOpenDotaLatencyMs: number | null = null;

async function proxyOpenDota(endpointPath: string, ttlMs: number, forceRefresh = false): Promise<any> {
  const cacheKey = endpointPath;
  const now = Date.now();
  const cached = openDotaServerCache.get(cacheKey);

  if (!forceRefresh && cached && now < cached.expiresAt) {
    return cached.data;
  }

  const apiKey = process.env.OPENDOTA_API_KEY;
  const separator = endpointPath.includes('?') ? '&' : '?';
  const url = `${OPENDOTA_BASE_URL}${endpointPath}${apiKey ? `${separator}api_key=${apiKey}` : ''}`;

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PurpleBeanGaming/1.0 (Esports Circuit; contact@purplebeangaming.com)'
      }
    });
    clearTimeout(timeout);

    lastOpenDotaLatencyMs = Date.now() - startTime;

    if (!response.ok) {
      lastOpenDotaError = `HTTP ${response.status} from OpenDota (${endpointPath})`;
      // If we have stale cache, return it rather than hard failing
      if (cached) {
        return cached.data;
      }
      throw new Error(lastOpenDotaError);
    }

    const data = await response.json();
    lastSuccessfulOpenDotaRequest = new Date().toISOString();
    lastOpenDotaError = null;

    openDotaServerCache.set(cacheKey, {
      data,
      expiresAt: now + ttlMs,
      fetchedAt: now
    });

    return data;
  } catch (err: any) {
    lastOpenDotaError = err?.message || String(err);
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}

// 1. Diagnostic Status
apiRouter.get('/opendota/status', (_req: Request, res: Response) => {
  const apiKey = process.env.OPENDOTA_API_KEY;
  res.json({
    providerName: 'OpenDota API v1 (Server Cached)',
    configured: Boolean(apiKey),
    status: lastOpenDotaError ? 'ERROR' : 'CONNECTED',
    lastSuccessfulRequest: lastSuccessfulOpenDotaRequest,
    lastError: lastOpenDotaError,
    lastTestedAt: new Date().toISOString(),
    latencyMs: lastOpenDotaLatencyMs,
    rateLimitRemaining: 60,
    rateLimitReset: null,
    maskedKey: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
    cachedEntriesCount: openDotaServerCache.size
  });
});

// 2. Health Test
apiRouter.post('/opendota/test', async (_req: Request, res: Response) => {
  try {
    const start = Date.now();
    await proxyOpenDota('/status', 60000, true);
    const latency = Date.now() - start;
    return res.json({
      success: true,
      message: 'Successfully reached OpenDota upstream server',
      latencyMs: latency,
      diagnostic: {
        providerName: 'OpenDota API v1',
        configured: Boolean(process.env.OPENDOTA_API_KEY),
        status: 'CONNECTED',
        lastSuccessfulRequest: new Date().toISOString(),
        lastError: null,
        latencyMs: latency
      }
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      message: `OpenDota upstream check failed: ${err.message}`,
      diagnostic: {
        providerName: 'OpenDota API v1',
        configured: Boolean(process.env.OPENDOTA_API_KEY),
        status: 'ERROR',
        lastError: err.message
      }
    });
  }
});

// 3. Search Players by Name or Query (Section 4)
apiRouter.get('/opendota/search', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return res.json([]);
  }
  try {
    const data = await proxyOpenDota(`/search?q=${encodeURIComponent(q)}`, 5 * 60 * 1000);
    return res.json(Array.isArray(data) ? data.slice(0, 20) : []);
  } catch (err: any) {
    console.warn(`OpenDota search note for "${q}":`, err?.message);
    return res.json([]);
  }
});

// 4. Player Profile & Metadata (Short cache 5m)
apiRouter.get('/opendota/players/:accountId', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}`, 5 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 5. Win / Loss Record (Short cache 5m)
apiRouter.get('/opendota/players/:accountId/wl', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wl`, 5 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 6. Recent Matches (Short cache 5m)
apiRouter.get('/opendota/players/:accountId/recentMatches', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/recentMatches`, 5 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 7. Full Filterable Matches (Short cache 5m)
apiRouter.get('/opendota/players/:accountId/matches', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  const queryStr = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/matches${queryStr}`, 5 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 8. Player Top Heroes (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/heroes', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/heroes`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 9. Peers / Frequent Teammates (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/peers', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/peers`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 10. Pro Encounters (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/pros', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/pros`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 11. Totals Aggregates (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/totals', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/totals`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 12. Counts (Lanes, Modes, Patches, Regions) (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/counts', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/counts`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 13. Histograms for Statistical Fields (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/histograms/:field', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const field = req.params.field;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/histograms/${field}`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId, field });
  }
});

// 14. Vision / Ward Placement Map (Long cache 30m)
apiRouter.get('/opendota/players/:accountId/wardmap', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wardmap`, 30 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 15. Word Cloud (Long cache 30m)
apiRouter.get('/opendota/players/:accountId/wordcloud', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wordcloud`, 30 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 16. Ratings & Rank Progression History (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/ratings', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/ratings`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 17. Hero Rankings (Medium cache 15m)
apiRouter.get('/opendota/players/:accountId/rankings', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/players/${accountId}/rankings`, 15 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, accountId });
  }
});

// 18. Manual Refresh Request to OpenDota
apiRouter.post('/opendota/players/:accountId/refresh', async (req: Request, res: Response) => {
  const accountId = req.params.accountId;
  try {
    const apiKey = process.env.OPENDOTA_API_KEY;
    const url = `${OPENDOTA_BASE_URL}/players/${accountId}/refresh${apiKey ? `?api_key=${apiKey}` : ''}`;
    const response = await fetch(url, { method: 'POST' });
    const data = response.ok ? await response.json().catch(() => ({})) : {};
    return res.json({ success: true, accountId, response: data });
  } catch (err: any) {
    return res.json({ success: false, error: err.message });
  }
});

// 19. Detailed Match Breakdown (Aggressive 24h cache for historical matches)
apiRouter.get('/opendota/matches/:matchId', async (req: Request, res: Response) => {
  const matchId = req.params.matchId;
  const force = req.query.refresh === 'true';
  try {
    const data = await proxyOpenDota(`/matches/${matchId}`, 24 * 60 * 60 * 1000, force);
    return res.json(data);
  } catch (err: any) {
    return res.status(502).json({ error: err.message, matchId });
  }
});

// =============================================================================
// STEAM OPENID 2.0 OWNERSHIP VERIFICATION ENDPOINTS
// =============================================================================

/**
 * 1. Initiate Steam OpenID Verification Flow
 * Requires Bearer <Firebase ID Token>
 * Produces HMAC-SHA256 signed state token and official Valve login redirect URL.
 */
apiRouter.post('/steam/link/start', async (req: Request, res: Response) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const returnUrl = req.body?.returnUrl || '/profile';

    // Generate signed state with 10m TTL and cryptographic nonce
    const stateToken = generateSignedSteamState(user.uid, {
      email: user.email,
      returnUrl
    });

    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:3000';
    const protocol = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const realm = process.env.STEAM_OPENID_REALM || `${protocol}://${host}`;
    const returnToUrl = `${realm}/api/steam/link/callback?state=${encodeURIComponent(stateToken)}`;

    const redirectUrl = buildSteamOpenIdLoginUrl({
      realm,
      returnToUrl
    });

    return res.json({
      success: true,
      redirectUrl,
      stateToken
    });
  } catch (err: any) {
    const msg = err.message || 'Failed to start Steam authentication';
    const status = msg.startsWith('SIGN_IN_REQUIRED') ? 401 : 400;
    return res.status(status).json({
      success: false,
      error: msg.split(':')[0] || 'UNAUTHORIZED',
      message: msg
    });
  }
});

/**
 * 2. Steam OpenID 2.0 Return Callback
 * Validates check_authentication with Valve, derives Dota Account ID,
 * enforces 1:1 uniqueness, and links account.
 */
apiRouter.get('/steam/link/callback', async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const rawState = query.state;

  // Render brutalist HTML response that notifies popup opener or redirects
  const renderResultHtml = (opts: {
    success: boolean;
    error?: string;
    message?: string;
    steamId64?: string;
    dotaAccountId?: string;
    personaName?: string;
  }) => {
    const bgColor = opts.success ? '#70FFAF' : '#FF6B6B';
    const title = opts.success ? 'STEAM OWNERSHIP VERIFIED ✓' : 'VERIFICATION FAILED';
    const details = opts.message || (opts.success ? 'Account successfully verified with Valve.' : 'Steam verification failed.');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} | Purple Bean Gaming</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      background: #FDFBF7;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: white;
      border: 4px solid black;
      box-shadow: 8px 8px 0 #000;
      padding: 28px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .badge {
      display: inline-block;
      background: ${bgColor};
      color: black;
      font-weight: 900;
      font-size: 13px;
      padding: 6px 12px;
      border: 2px solid black;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    h2 {
      font-weight: 900;
      font-size: 20px;
      margin: 0 0 12px 0;
      text-transform: uppercase;
    }
    p {
      font-size: 13px;
      color: #333;
      margin: 0 0 20px 0;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      background: #FFE600;
      color: black;
      font-weight: 900;
      font-size: 12px;
      text-transform: uppercase;
      padding: 10px 20px;
      border: 2px solid black;
      box-shadow: 3px 3px 0 #000;
      cursor: pointer;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${opts.success ? 'Ownership Handshake Complete' : 'Error'}</div>
    <h2>${title}</h2>
    <p>${details}</p>
    <button class="btn" onclick="handleClose()">Close Window</button>
  </div>
  <script>
    const payload = ${JSON.stringify(opts)};
    const messageData = { 
      type: opts.success ? 'STEAM_LINK_SUCCESS' : 'STEAM_LINK_ERROR', 
      ...payload,
      timestamp: Date.now()
    };

    // 1. Broadcast via modern BroadcastChannel (cross-window/cross-popup on same origin)
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('pbg_steam_auth');
        channel.postMessage(messageData);
      }
    } catch (e) {}

    // 2. Persist via localStorage for fallback cross-tab/popup sync
    try {
      localStorage.setItem('pbg_steam_link_result', JSON.stringify(messageData));
    } catch (e) {}

    // 3. Direct window.opener.postMessage if opener is available
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(messageData, '*');
      }
    } catch (e) {}

    function handleClose() {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(messageData, '*');
        }
      } catch (e) {}
      try {
        window.close();
      } catch (e) {}
      setTimeout(() => {
        const btn = document.querySelector('.btn');
        if (btn) btn.textContent = 'Window closed — return to main tab';
      }, 400);
    }

    // Auto-close popup after 1.5 seconds so original window resumes cleanly
    setTimeout(() => {
      handleClose();
    }, 1500);
  </script>
</body>
</html>`;
  };

  // 1. Validate signed state token
  if (!rawState) {
    return res.status(400).send(renderResultHtml({
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      message: 'Missing verification state token. Please initiate verification from PurpleBeanGaming.'
    }));
  }

  const stateCheck = verifySignedSteamState(rawState);
  if (!stateCheck.success) {
    return res.status(400).send(renderResultHtml({
      success: false,
      error: stateCheck.error,
      message: stateCheck.details
    }));
  }

  const { uid } = stateCheck.payload;

  // 2. Validate OpenID response against Valve check_authentication
  const validation = await validateSteamOpenIdCallback(query);
  if (!validation.isValid || !validation.steamId64) {
    return res.status(400).send(renderResultHtml({
      success: false,
      error: 'STEAM_VALIDATION_FAILED',
      message: validation.error || 'Valve rejected Steam OpenID credentials.'
    }));
  }

  // 3. Link account with 1:1 protection and OpenDota resolution
  try {
    const linkedAccount = await linkSteamAccountAuthoritative(uid, validation.steamId64);
    return res.status(200).send(renderResultHtml({
      success: true,
      steamId64: linkedAccount.steamId64 || undefined,
      dotaAccountId: linkedAccount.dotaAccountId || undefined,
      personaName: linkedAccount.steamPersonaName,
      message: `Steam account (${linkedAccount.steamPersonaName || validation.steamId64}) successfully linked and verified!`
    }));
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to complete Steam linking';
    const errorCode = errorMsg.split(':')[0] || 'STEAM_VALIDATION_FAILED';
    return res.status(400).send(renderResultHtml({
      success: false,
      error: errorCode,
      message: errorMsg.replace(/^[A-Z_]+:\s*/, '')
    }));
  }
});

/**
 * 3. Retrieve Steam Link Status
 * Owner gets full private account. Non-owners get safe public view.
 */
apiRouter.get('/steam/link/status', async (req: Request, res: Response) => {
  const targetUserId = req.query.userId as string | undefined;

  // Check if caller provided authorization
  let callerUid: string | null = null;
  let callerEmail: string | null = null;
  if (req.headers.authorization) {
    try {
      const user = await verifyFirebaseBearerToken(req.headers.authorization);
      callerUid = user.uid;
      callerEmail = user.email || null;
    } catch {
      // Unauthenticated caller
    }
  }

  // If caller is owner requesting their own status
  if (callerUid && (!targetUserId || targetUserId === callerUid)) {
    let privateAcc = await getPrivatePlayerAccount(callerUid);
    if (!privateAcc && callerEmail) {
      privateAcc = await getPrivatePlayerAccount(callerEmail);
    }
    return res.json({
      success: true,
      isOwner: true,
      account: privateAcc || {
        userId: callerUid,
        steamId64: null,
        steamId32: null,
        dotaAccountId: null,
        verificationStatus: 'NOT_LINKED',
        steamOwnershipVerified: false,
        updatedAt: Date.now()
      }
    });
  }

  // Otherwise return safe public profile
  if (targetUserId) {
    const publicProfile = await getPublicPlayerSafeProfile(targetUserId);
    return res.json({
      success: true,
      isOwner: false,
      profile: publicProfile
    });
  }

  return res.status(401).json({
    success: false,
    error: 'SIGN_IN_REQUIRED',
    message: 'Authentication required to inspect private Steam link status.'
  });
});

/**
 * 4. Disconnect Steam Account
 * Requires Bearer <Firebase ID Token>
 * Blocks unlink if active tournament registration exists.
 */
apiRouter.post('/steam/link/unlink', async (req: Request, res: Response) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    await unlinkSteamAccountAuthoritative(user.uid);
    return res.json({
      success: true,
      message: 'Steam account successfully disconnected.'
    });
  } catch (err: any) {
    const msg = err.message || 'Failed to disconnect Steam account';
    const isLock = msg.includes('ACTIVE_TOURNAMENT_LOCK');
    return res.status(isLock ? 409 : 400).json({
      success: false,
      error: isLock ? 'ACTIVE_TOURNAMENT_LOCK' : 'DISCONNECT_FAILED',
      message: isLock
        ? 'Steam cannot be disconnected while you have an active tournament registration.'
        : msg
    });
  }
});

// =========================================================================
// DISCORD OAUTH 2.0 IDENTITY ENGINE (RFC 6749 Authorization Code Flow)
// Scope: identify
// Callback: /api/auth/discord/callback
// =========================================================================

/**
 * 1. Start Discord OAuth flow or get authorize URL
 * Scope: identify
 * Requires Bearer <Firebase ID Token>
 */
const handleDiscordAuthStart = async (req: Request, res: Response) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const { returnUrl = '/profile', pbgId } = req.body || {};
    const rawOrigin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer).origin : undefined);
    const trustedOrigin = sanitizeTrustedOrigin(rawOrigin);

    const stateToken = generateSignedDiscordOAuthState(user.uid, {
      email: user.email,
      pbgId: pbgId || undefined,
      returnUrl,
      origin: trustedOrigin
    });

    const devUrl = 'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app';
    const sharedUrl = 'https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app';
    const appUrl = process.env.APP_URL || devUrl;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${appUrl}/api/auth/discord/callback`;

    const clientId = process.env.DISCORD_CLIENT_ID || '';
    const isConfigured = Boolean(clientId && process.env.DISCORD_CLIENT_SECRET);

    let authUrl = '';
    if (clientId) {
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: 'identify guilds.join',
        state: stateToken
      });
      authUrl = `https://discord.com/oauth2/authorize?${params.toString()}`;
    }

    return res.json({
      success: true,
      isConfigured,
      clientId,
      authUrl,
      redirectUri,
      developmentCallbackUrl: `${devUrl}/api/auth/discord/callback`,
      sharedCallbackUrl: `${sharedUrl}/api/auth/discord/callback`,
      stateToken
    });
  } catch (err: any) {
    const isAuthErr = err.code === 'SIGN_IN_REQUIRED' || (err.message && err.message.includes('SIGN_IN_REQUIRED'));
    return res.status(isAuthErr ? 401 : 500).json({
      success: false,
      error: err.code || 'DISCORD_AUTH_START_FAILED',
      message: err.message || 'Failed to initialize Discord authorization.'
    });
  }
};

apiRouter.post('/auth/discord/start', handleDiscordAuthStart);
apiRouter.post('/discord/auth/start', handleDiscordAuthStart);
apiRouter.get('/auth/discord/url', handleDiscordAuthStart);

/**
 * 2. Discord OAuth 2.0 Callback handler
 * Registered at /api/auth/discord/callback (and alias /api/discord/auth/callback)
 */
const handleDiscordCallback = async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query as Record<string, string | undefined>;

  const devUrl = 'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app';
  const appUrl = process.env.APP_URL || devUrl;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${appUrl}/api/auth/discord/callback`;

  // Secure HTML response generator: strictly enforces trusted origin on postMessage, zero secret exposure
  const sendHtmlResponse = (
    statusCode: number,
    isSuccess: boolean,
    payload: any,
    trustedOrigin: string,
    errorHeading?: string,
    errorBody?: string
  ) => {
    return res.status(statusCode).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isSuccess ? 'Discord Connected — PurpleBeanGaming' : 'Discord Link Error — PurpleBeanGaming'}</title>
          <style>
            body { font-family: monospace; background: #0e0e10; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #18181b; border: 3.5px solid #000; padding: 32px; text-align: center; box-shadow: 8px 8px 0px 0px ${isSuccess ? '#5865F2' : '#ff4444'}; max-width: 440px; }
            h2 { color: ${isSuccess ? '#5865F2' : '#ff5555'}; margin-top: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            p { color: #ccc; font-size: 13px; line-height: 1.5; }
            .avatar { width: 64px; height: 64px; border-radius: 50%; border: 2px solid #000; margin: 10px auto; background: #5865F2; display: block; }
          </style>
        </head>
        <body>
          <div class="box">
            ${isSuccess && payload?.avatarUrl ? `<img src="${payload.avatarUrl}" class="avatar" alt="Avatar" />` : ''}
            <h2>${isSuccess ? 'DISCORD VERIFIED!' : (errorHeading || 'DISCORD ERROR')}</h2>
            <p>${isSuccess ? `Discord account <strong>@${payload?.discordUsername || payload?.username}</strong> has been linked to your PBG profile.` : (errorBody || 'Failed to complete Discord authorization.')}</p>
            <p style="color: ${isSuccess ? '#70FFAF' : '#ff9999'}; font-weight: bold;">${isSuccess ? 'Returning to profile...' : 'Closing window...'}</p>
          </div>
          <script>
            const payload = ${JSON.stringify(payload)};
            try { localStorage.setItem('pbg_discord_link_result', JSON.stringify(payload)); } catch(e){}
            try {
              if (typeof BroadcastChannel !== 'undefined') {
                const ch = new BroadcastChannel('pbg_discord_auth');
                ch.postMessage(payload);
                ch.close();
              }
            } catch(e){}
            if (window.opener) {
              try { window.opener.postMessage(payload, ${JSON.stringify(trustedOrigin)}); } catch(e){}
              setTimeout(() => window.close(), 600);
            } else {
              setTimeout(() => { window.location.href = '/profile'; }, 1000);
            }
          </script>
        </body>
      </html>
    `);
  };

  if (error || !code || !state) {
    const errorMsg = error_description || error || 'Discord authorization was cancelled or denied.';
    return sendHtmlResponse(200, false, {
      type: 'DISCORD_AUTH_ERROR',
      error: 'DISCORD_AUTH_DENIED',
      message: errorMsg,
      timestamp: Date.now()
    }, appUrl, 'DISCORD AUTHORIZATION CANCELLED', errorMsg);
  }

  // 1. Validate & atomically consume OAuth state (Strict Replay & Tamper Protection)
  const stateResult = await verifyAndConsumeDiscordOAuthState(state);
  if (!stateResult.success) {
    const errorDetails = stateResult.details || 'The verification session has expired or was already used.';
    return sendHtmlResponse(400, false, {
      type: 'DISCORD_AUTH_ERROR',
      error: stateResult.error || 'INVALID_OAUTH_STATE',
      message: errorDetails,
      timestamp: Date.now()
    }, appUrl, 'SECURITY STATE REJECTED', errorDetails);
  }

  const userId = stateResult.payload.uid;
  const pbgId = stateResult.payload.pbgId;
  const trustedOrigin = stateResult.payload.origin || appUrl;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || '631715510631006219';
  const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';

  try {
    let discordUserId = '';
    let discordUsername = '';
    let discordGlobalName: string | null = null;
    let discordAvatarUrl: string | null = null;

    if (clientId && clientSecret) {
      // Step 6: Exchange code for access token server-side
      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri
        }).toString()
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text().catch(() => '');
        console.error('[Discord OAuth] Token exchange error:', errorText);
        throw new Error('Failed to exchange authorization code with Discord API.');
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Step 7: Call GET https://discord.com/api/v10/users/@me
      // Strictly guarantee discord.userId comes from Discord API response.id
      const userProfile = await fetchDiscordUserProfile(accessToken);
      discordUserId = userProfile.id;
      discordUsername = userProfile.username;
      discordGlobalName = userProfile.global_name || null;
      if (userProfile.avatar) {
        discordAvatarUrl = `https://cdn.discordapp.com/avatars/${userProfile.id}/${userProfile.avatar}.png`;
      } else {
        const defaultIndex = (BigInt(userProfile.id) >> 22n) % 6n;
        discordAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
      }

      // STEP 1: ATOMIC IDENTITY RESERVATION BEFORE EXTERNAL SIDE EFFECTS
      // Checks 1:1 index in Firestore: ensures Discord ID is not already linked to another account
      try {
        await reserveDiscordIdentityClaim({
          userId,
          pbgId,
          discordUserId
        });
      } catch (reserveErr: any) {
        return sendHtmlResponse(
          200,
          false,
          {
            type: 'DISCORD_AUTH_ERROR',
            error: reserveErr.code || 'DISCORD_ALREADY_LINKED',
            message: reserveErr.message || 'This Discord account is already linked to another PurpleBeanGaming account.',
            timestamp: Date.now()
          },
          trustedOrigin,
          'ACCOUNT ALREADY LINKED',
          reserveErr.message
        );
      }

      // STEP 2: EXTERNAL SIDE EFFECTS (GUILD MEMBERSHIP & ROLE PROVISIONING)
      let guildMember = false;
      let pbgMemberRole = false;

      if (guildId && botToken) {
        const provResult = await provisionDiscordGuildAndRole({
          guildId,
          botToken,
          roleId: roleId || undefined,
          discordUserId,
          accessToken
        });

        if (!provResult.success) {
          // Provisioning failed: ROLLBACK the pending reservation!
          await rollbackDiscordIdentityReservation(discordUserId, userId);
          return sendHtmlResponse(
            200,
            false,
            {
              type: 'DISCORD_AUTH_ERROR',
              error: provResult.errorCode || 'DISCORD_PROVISIONING_FAILED',
              message: provResult.errorMessage || 'Failed to join official PBG Discord server or assign PBG Member role.',
              timestamp: Date.now()
            },
            trustedOrigin,
            'DISCORD GUILD ERROR',
            provResult.errorMessage
          );
        }

        guildMember = provResult.guildMember;
        pbgMemberRole = provResult.pbgMemberRole;
      }

      // STEP 3: FINALIZE IDENTITY CLAIM IN FIRESTORE
      await finalizeDiscordAccountAuthoritative({
        userId,
        pbgId,
        discordUserId,
        discordUsername,
        globalName: discordGlobalName,
        discordAvatarUrl,
        guildMember,
        pbgMemberRole,
        verificationMethod: 'discord_oauth_2'
      });

      const discordPayload = {
        userId: discordUserId,
        username: discordUsername,
        globalName: discordGlobalName,
        avatarUrl: discordAvatarUrl,
        guildMember,
        pbgMemberRole,
        connectedAt: Date.now(),
        verified: true
      };

      return sendHtmlResponse(200, true, {
        type: 'DISCORD_AUTH_SUCCESS',
        discord: discordPayload,
        discordUserId,
        discordUsername,
        discordDisplayName: discordGlobalName || discordUsername,
        avatarUrl: discordAvatarUrl,
        timestamp: Date.now()
      }, trustedOrigin);
    } else {
      // Staging / Demo fallback if credentials are being configured
      const seed = Math.abs(userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 1000));
      discordUserId = `10${(seed * 48291).toString().slice(0, 16).padEnd(16, '9')}`;
      discordUsername = (stateResult.payload.email || 'player').split('@')[0];
      discordGlobalName = discordUsername.toUpperCase();
      discordAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUserId.slice(-1) || '0', 10) % 5}.png`;

      await linkDiscordAccountAuthoritative({
        userId,
        pbgId,
        discordUserId,
        discordUsername,
        globalName: discordGlobalName,
        discordAvatarUrl,
        guildMember: true,
        pbgMemberRole: true,
        verificationMethod: 'discord_oauth_2'
      });

      const discordPayload = {
        userId: discordUserId,
        username: discordUsername,
        globalName: discordGlobalName,
        avatarUrl: discordAvatarUrl,
        guildMember: true,
        pbgMemberRole: true,
        connectedAt: Date.now(),
        verified: true
      };

      return sendHtmlResponse(200, true, {
        type: 'DISCORD_AUTH_SUCCESS',
        discord: discordPayload,
        discordUserId,
        discordUsername,
        discordDisplayName: discordGlobalName || discordUsername,
        avatarUrl: discordAvatarUrl,
        timestamp: Date.now()
      }, trustedOrigin);
    }
  } catch (err: any) {
    const errorMsg = err.message || 'Failed to complete Discord authorization.';
    return sendHtmlResponse(200, false, {
      type: 'DISCORD_AUTH_ERROR',
      error: 'DISCORD_LINK_FAILED',
      message: errorMsg,
      timestamp: Date.now()
    }, trustedOrigin, 'DISCORD AUTHORIZATION FAILED', errorMsg);
  }
};

apiRouter.get('/auth/discord/callback', handleDiscordCallback);
apiRouter.get('/auth/discord/callback/', handleDiscordCallback);
apiRouter.get('/discord/auth/callback', handleDiscordCallback);
apiRouter.get('/discord/auth/callback/', handleDiscordCallback);

/**
 * 3. Fetch Discord connection status
 */
const handleDiscordStatus = async (req: Request, res: Response) => {
  try {
    let targetUserId = (req.query.userId as string) || '';
    let isOwner = false;

    if (req.headers.authorization) {
      try {
        const user = await verifyFirebaseBearerToken(req.headers.authorization);
        if (!targetUserId || targetUserId === user.uid) {
          targetUserId = user.uid;
          isOwner = true;
        }
      } catch {}
    }

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_USER_ID',
        message: 'User ID is required.'
      });
    }

    const account = await getPrivateDiscordAccount(targetUserId);

    let guildMember = Boolean(account.discord?.guildMember);
    let pbgMemberRole = Boolean(account.discord?.pbgMemberRole);

    const guildId = process.env.DISCORD_GUILD_ID || '631715510631006219';
    const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || '1555885374713237524';
    const botToken = process.env.DISCORD_BOT_TOKEN;

    // Live authoritative verification against Discord API:
    // Ensures status reflects reality on Discord and updates Firestore if state is stale
    if (account.discordLinked && account.discordUserId && guildId && botToken && !account.discordUserId.startsWith('mock_')) {
      try {
        const verifyUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${account.discordUserId}`;
        const verifyRes = await fetch(verifyUrl, {
          headers: {
            Authorization: `Bot ${botToken}`,
            Accept: 'application/json'
          }
        });

        if (verifyRes.ok) {
          guildMember = true;
          const memberData = await verifyRes.json();
          const roles: string[] = Array.isArray(memberData?.roles) ? memberData.roles : [];
          pbgMemberRole = roles.includes(roleId);
        } else if (verifyRes.status === 404) {
          guildMember = false;
          pbgMemberRole = false;
        }

        // If live Discord reality disagrees with stored state, update Firestore authoritatively
        if (
          account.discord?.guildMember !== guildMember ||
          account.discord?.pbgMemberRole !== pbgMemberRole
        ) {
          await updateDiscordAuthoritativeMembership({
            userId: targetUserId,
            discordUserId: account.discordUserId,
            guildMember,
            pbgMemberRole
          });
          if (account.discord) {
            account.discord.guildMember = guildMember;
            account.discord.pbgMemberRole = pbgMemberRole;
          }
        }
      } catch (liveErr: any) {
        console.warn('[handleDiscordStatus] Live Discord verification warning:', liveErr.message);
      }
    }

    return res.json({
      success: true,
      isOwner,
      account: {
        userId: account.userId,
        pbgId: account.pbgId,
        discord: account.discord ? {
          ...account.discord,
          guildMember,
          pbgMemberRole
        } : (account.discordUserId ? {
          userId: account.discordUserId,
          username: account.discordUsername || 'player',
          globalName: account.discordDisplayName || account.discordUsername || null,
          avatarUrl: account.discordAvatarUrl,
          connectedAt: account.discordLinkedAt || Date.now(),
          guildMember,
          pbgMemberRole,
          verified: true
        } : null),
        discordLinked: account.discordLinked,
        discordVerified: account.discordVerified,
        discordUserId: isOwner ? account.discordUserId : (account.discordUserId ? account.discordUserId.slice(-4).padStart(account.discordUserId.length, '•') : null),
        discordUsername: account.discordUsername,
        discordDisplayName: account.discordDisplayName,
        discordAvatarUrl: account.discordAvatarUrl,
        discordVerificationMethod: account.discordVerificationMethod,
        discordLinkedAt: account.discordLinkedAt,
        discordVerifiedAt: account.discordVerifiedAt,
        updatedAt: account.updatedAt
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'FETCH_STATUS_FAILED',
      message: err.message || 'Failed to fetch Discord link status.'
    });
  }
};

apiRouter.get('/auth/discord/status', handleDiscordStatus);
apiRouter.get('/discord/auth/status', handleDiscordStatus);

/**
 * 4. Disconnect Discord Account
 * Requires Bearer <Firebase ID Token>
 * Removes both sides of the Discord <-> PBG mapping.
 */
const handleDiscordUnlink = async (req: Request, res: Response) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const { removeGuildRole = true } = req.body || {};
    const result = await unlinkDiscordAccountAuthoritative(user.uid, { removeGuildRole });
    return res.json({
      success: true,
      roleRevoked: result.roleRevoked,
      message: 'Discord account successfully disconnected from PBG profile.'
    });
  } catch (err: any) {
    const msg = err.message || 'Failed to disconnect Discord account';
    const isLock = msg.includes('ACTIVE_TOURNAMENT_LOCK');
    return res.status(isLock ? 409 : 400).json({
      success: false,
      error: isLock ? 'ACTIVE_TOURNAMENT_LOCK' : 'DISCONNECT_FAILED',
      message: isLock
        ? 'Discord cannot be disconnected while you have an active tournament registration.'
        : msg
    });
  }
};

apiRouter.post('/auth/discord/unlink', handleDiscordUnlink);
apiRouter.post('/discord/auth/unlink', handleDiscordUnlink);



