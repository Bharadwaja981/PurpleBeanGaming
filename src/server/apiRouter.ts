import { Router, Request, Response } from 'express';
import { startSteamLink, completeSteamLink, getSteamLinkStatus, unlinkSteam } from './steamOpenId';

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

apiRouter.post('/steam/link/start', startSteamLink);
apiRouter.get('/steam/link/callback', completeSteamLink);
apiRouter.get('/steam/link/status', getSteamLinkStatus);
apiRouter.post('/steam/link/unlink', unlinkSteam);

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
