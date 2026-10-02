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
  res.json({
    status: 'ok',
    service: 'Purple Bean Gaming API',
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
    function handleClose() {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: opts.success ? 'STEAM_LINK_SUCCESS' : 'STEAM_LINK_ERROR', ...payload }, '*');
        setTimeout(() => window.close(), 600);
      } else {
        window.location.href = '/profile';
      }
    }
    // Auto-notify opener immediately
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: opts.success ? 'STEAM_LINK_SUCCESS' : 'STEAM_LINK_ERROR', ...payload }, '*');
      setTimeout(() => window.close(), 1200);
    }
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
  if (req.headers.authorization) {
    try {
      const user = await verifyFirebaseBearerToken(req.headers.authorization);
      callerUid = user.uid;
    } catch {
      // Unauthenticated caller
    }
  }

  // If caller is owner requesting their own status
  if (callerUid && (!targetUserId || targetUserId === callerUid)) {
    const privateAcc = await getPrivatePlayerAccount(callerUid);
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

