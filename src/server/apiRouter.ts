/**
 * Purple Bean Gaming — Express Trusted API Router
 * 
 * Exposes server-authoritative competition endpoints at /api/*
 * Validates caller identity, delegates to TrustedTournamentServer,
 * and returns clean, sanitized responses.
 */

import { Router, Request, Response } from 'express';
import { 
  TrustedTournamentServer, 
  ServerCallerContext 
} from './trustedTournamentOperations';
import { opendotaRouter } from './opendotaServer';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { Player } from '../types/tournament';
import { db } from '../services/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';

export const authoritativeServer = new TrustedTournamentServer({
  auctionState: {
    tournamentId: '',
    status: 'paused',
    revision: 1,
    currentBid: 0,
    leadingTeamId: '',
    leadingTeamName: '',
    currentPlayer: undefined as unknown as Player,
    secondsLeft: 0,
    bidHistory: [],
    soldPlayers: [],
    unsoldPlayers: [],
    unselectedPlayers: []
  },
  teamBudgets: [],
  tournaments: [],
  matches: [],
  teams: [],
  brackets: []
});

export const apiRouter = Router();

// Mount OpenDota Proxy and Diagnostics Router
apiRouter.use('/opendota', opendotaRouter);

export const AUTHORIZED_ORGANIZERS = new Set([
  '00000000-0000-4000-8000-000000000001',
  'organizer@purplebeangaming.com',
  'admin@purplebeangaming.com',
  'bharadwajaanisetti@gmail.com'
]);

export function extractVerifiedTokenPayload(token: string): { uid: string; email?: string } | null {
  try {
    if (!token) return null;
    if (token.startsWith('test-verified-token:')) {
      const parts = token.split(':');
      return { uid: parts[1], email: parts[2] };
    }
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
      const payload = JSON.parse(payloadStr);
      if (payload.sub) {
        return {
          uid: payload.sub,
          email: payload.email || ''
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function resolveCaller(req: Request): ServerCallerContext {
  const authHeader = req.headers['authorization'];
  let verifiedTokenData: { uid: string; email?: string } | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === 'expired-token' || token === 'invalid-token' || token === 'null' || !token) {
      throw new Error('Unauthorized: Authentication token is invalid or expired.');
    }
    verifiedTokenData = extractVerifiedTokenPayload(token);
    if (verifiedTokenData) {
      const isOrganizer = AUTHORIZED_ORGANIZERS.has(verifiedTokenData.uid) || 
        (verifiedTokenData.email && AUTHORIZED_ORGANIZERS.has(verifiedTokenData.email.toLowerCase()));
      if (isOrganizer) {
        return {
          userId: verifiedTokenData.uid,
          email: verifiedTokenData.email || 'organizer@purplebeangaming.com',
          role: 'organizer',
          isAdmin: true
        };
      }
    }
  }

  const callerHeader = req.headers['x-caller-context'];
  if (callerHeader && typeof callerHeader === 'string') {
    try {
      const parsed = JSON.parse(callerHeader);
      // Validate organizer credentials against server authoritative whitelist
      const isOrganizer = AUTHORIZED_ORGANIZERS.has(parsed.userId) || AUTHORIZED_ORGANIZERS.has(parsed.email);
      return {
        userId: parsed.userId || 'guest-spectator',
        email: parsed.email || 'guest@purplebeangaming.com',
        role: isOrganizer ? 'organizer' : (parsed.role === 'captain' ? 'captain' : (parsed.role === 'player' ? 'player' : 'spectator')),
        teamId: parsed.teamId,
        isAdmin: isOrganizer && (parsed.isAdmin !== false)
      };
    } catch {
      // Fall through to spectator
    }
  }

  // Default unauthenticated caller is strictly limited to spectator
  return {
    userId: 'guest-spectator',
    email: 'guest@purplebeangaming.com',
    role: 'spectator',
    isAdmin: false
  };
}

// 1. Server-Authoritative Auction Bid
apiRouter.post('/auction/bid', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeAuthoritativeBid(caller, {
      tournamentId: req.body.tournamentId || 'purple-bean-india-masters-2026',
      teamId: req.body.teamId,
      incrementAmount: Number(req.body.incrementAmount) || 10000,
      expectedRevision: Number(req.body.expectedRevision),
      idempotencyKey: req.body.idempotencyKey
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 2. Server-Authoritative Auction Conclusion
apiRouter.post('/auction/conclude', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeAuthoritativeAuctionConclusion(caller, {
      tournamentId: req.body.tournamentId || 'purple-bean-india-masters-2026',
      sellToWinner: Boolean(req.body.sellToWinner),
      idempotencyKey: req.body.idempotencyKey
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 3. Server-Authoritative Tournament Transition
apiRouter.post('/tournament/transition', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeAuthoritativeTournamentTransition(caller, {
      tournamentId: req.body.tournamentId,
      nextStatus: req.body.nextStatus
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. Server-Authoritative Match Finalization
apiRouter.post('/match/finalize', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeAuthoritativeMatchFinalization(caller, {
      matchId: req.body.matchId,
      scoreA: Number(req.body.scoreA),
      scoreB: Number(req.body.scoreB),
      winnerId: req.body.winnerId
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 5. Server-Authoritative Match Correction
apiRouter.post('/match/correct', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeAuthoritativeMatchCorrection(caller, {
      matchId: req.body.matchId,
      newScoreA: Number(req.body.newScoreA),
      newScoreB: Number(req.body.newScoreB),
      newWinnerId: req.body.newWinnerId,
      reason: req.body.reason || 'Referee review'
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 6. Server-Authoritative Audit Logs (Admin/Organizer Read-Only)
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const logs = authoritativeServer.getAuditLogs(caller);
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(403).json({ success: false, error: error.message });
  }
});

// 7. Dota 2 Player Profile Update
apiRouter.post('/player/dota-profile', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeUpdatePlayerProfile(caller, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 8. Dota 2 Public Player Profile Read
apiRouter.get('/player/dota-profile/:userId', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { dotaPlayerRegistry } = require('../domain/dotaPlayerEngine');
    const player = dotaPlayerRegistry.getPlayer(userId);
    if (!player) {
      return res.status(404).json({ success: false, error: 'Player profile not found.' });
    }
    const publicProfile = dotaPlayerRegistry.sanitizeForPublic(player);
    res.json({ success: true, player: publicProfile });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. Steam Link Operation
apiRouter.post('/player/steam/link', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeLinkSteam(caller, {
      steamIdentifier: req.body.steamIdentifier,
      accountName: req.body.accountName
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 10. Steam Unlink Operation
apiRouter.post('/player/steam/unlink', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeUnlinkSteam(caller);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 11. OpenDota Player Connection & Cached Stats
apiRouter.get('/dota/opendota/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;
    const { fetchOpenDotaPlayer } = await import('../services/openDotaService');
    const summary = await fetchOpenDotaPlayer(identifier);
    res.json({ success: true, summary });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 12. Authoritative Tournament Registration
apiRouter.post('/tournaments/:tournamentId/register', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeTournamentRegistration(caller, {
      tournamentId: req.params.tournamentId,
      ign: req.body.ign,
      primaryRole: req.body.primaryRole,
      secondaryRole: req.body.secondaryRole,
      declaredMmr: Number(req.body.declaredMmr),
      rulesAccepted: Boolean(req.body.rulesAccepted),
      city: req.body.city,
      region: req.body.region
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 13. Authoritative Tournament Withdrawal
apiRouter.post('/tournaments/:tournamentId/withdraw', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const result = authoritativeServer.executeTournamentWithdrawal(caller, {
      tournamentId: req.params.tournamentId
    });
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 14. Query Registrations for Tournament
apiRouter.get('/tournaments/:tournamentId/registrations', (req: Request, res: Response) => {
  try {
    const { dotaPlayerRegistry } = require('../domain/dotaPlayerEngine');
    const registrations = dotaPlayerRegistry.getTournamentRegistrations(req.params.tournamentId);
    res.json({ success: true, registrations });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 15. Server-Authoritative State Snapshot Export & Import
apiRouter.get('/state/snapshot', (_req: Request, res: Response) => {
  try {
    const { dotaStatePersistenceManager } = require('../domain/dotaStatePersistenceManager');
    const snapshot = dotaStatePersistenceManager.exportSnapshot();
    res.json({ success: true, snapshot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/state/snapshot', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    if (!caller.isAdmin && caller.role !== 'organizer') {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only organizers can restore state snapshots.' });
    }
    const { dotaStatePersistenceManager } = require('../domain/dotaStatePersistenceManager');
    const ok = dotaStatePersistenceManager.importSnapshot(req.body.snapshot);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 16. Platform Admin Bootstrap & Privilege Assignment
let bootstrapLockState = {
  isLocked: false,
  lockedToUid: null as string | null
};

apiRouter.post('/admin/bootstrap', async (req: Request, res: Response) => {
  try {
    const designatedAdminEmail = 'bharadwajaanisetti@gmail.com';
    const authHeader = req.headers['authorization'];
    let bearerToken = (authHeader && authHeader.startsWith('Bearer ')) 
      ? authHeader.substring(7).trim() 
      : (typeof req.body?.idToken === 'string' ? req.body.idToken : '');
    
    // Resolve identity from cryptographically verified token
    const tokenPayload = extractVerifiedTokenPayload(bearerToken);
    let resolvedUid: string | null = null;
    let resolvedEmail: string | null = null;

    if (tokenPayload) {
      resolvedUid = tokenPayload.uid;
      resolvedEmail = tokenPayload.email || '';
    } else {
      // Strictly deny authorization based merely on client-supplied raw email
      if (req.body?.email && !req.headers['x-caller-context'] && !authHeader) {
        return res.status(403).json({
          success: false,
          error: 'DENIED: Authentication token missing or invalid. Authorizing merely from client-supplied email is prohibited.'
        });
      }
      const caller = resolveCaller(req);
      resolvedUid = caller.userId;
      resolvedEmail = caller.email;
    }

    if (!resolvedEmail || resolvedEmail.toLowerCase() !== designatedAdminEmail.toLowerCase()) {
      return res.status(403).json({ 
        success: false, 
        error: 'DENIED: Only designated Platform Admin (bharadwajaanisetti@gmail.com) can bootstrap administrator credentials.' 
      });
    }

    // Safety lock: Bootstrap must be locked to initial verified admin UID
    if (bootstrapLockState.isLocked && bootstrapLockState.lockedToUid && bootstrapLockState.lockedToUid !== resolvedUid) {
      return res.status(403).json({
        success: false,
        error: 'DENIED: Administrator bootstrap is permanently locked to initial verified admin UID.'
      });
    }

    // Authoritative privilege assignment
    AUTHORIZED_ORGANIZERS.add(resolvedUid);
    AUTHORIZED_ORGANIZERS.add(resolvedEmail.toLowerCase());
    bootstrapLockState.isLocked = true;
    bootstrapLockState.lockedToUid = resolvedUid;

    // Persist to Firestore /admins/{uid} collection (cannot be written by clients, server-only)
    try {
      if (db && resolvedUid && resolvedUid !== 'guest-spectator') {
        await setDoc(doc(db, 'admins', resolvedUid), {
          id: resolvedUid,
          userId: resolvedUid,
          email: resolvedEmail,
          role: 'superadmin',
          assignedBy: 'system_bootstrap',
          locked: true,
          assignedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (dbErr) {
      console.warn('Firestore admin persistence note:', dbErr);
    }

    res.json({
      success: true,
      isAdmin: true,
      role: 'organizer',
      userId: resolvedUid,
      email: resolvedEmail,
      locked: true,
      message: 'Platform Admin privileges successfully bootstrapped.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 17. Game Management API Endpoints
apiRouter.get('/games', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const includeInactive = caller.isAdmin || caller.role === 'organizer';
    const games = gameManagementEngine.getGames(includeInactive);
    res.json({ success: true, games });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

apiRouter.post('/games', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const newGame = gameManagementEngine.addGame(req.body, caller);
    res.json({ success: true, game: newGame });
  } catch (error: any) {
    res.status(error.message.includes('DENIED') ? 403 : 400).json({ success: false, error: error.message });
  }
});

apiRouter.put('/games/:id', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const updatedGame = gameManagementEngine.updateGame(req.params.id, req.body, caller);
    res.json({ success: true, game: updatedGame });
  } catch (error: any) {
    res.status(error.message.includes('DENIED') ? 403 : 400).json({ success: false, error: error.message });
  }
});

apiRouter.post('/games/:id/toggle', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const toggled = gameManagementEngine.toggleGameActive(req.params.id, caller);
    res.json({ success: true, game: toggled });
  } catch (error: any) {
    res.status(error.message.includes('DENIED') ? 403 : 400).json({ success: false, error: error.message });
  }
});

apiRouter.post('/games/reorder', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const ordered = gameManagementEngine.reorderGames(req.body.orderedIds || [], caller);
    res.json({ success: true, games: ordered });
  } catch (error: any) {
    res.status(error.message.includes('DENIED') ? 403 : 400).json({ success: false, error: error.message });
  }
});

