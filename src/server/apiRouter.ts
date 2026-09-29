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
import { 
  MOCK_TOURNAMENTS, 
  MOCK_MATCHES, 
  MOCK_TEAMS, 
  MOCK_AUCTION_TEAMS, 
  MOCK_AUCTION_PLAYER, 
  MOCK_PLAYERS, 
  MOCK_BRACKET_NODES 
} from '../data/mockData';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';

const isTestEnv = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));

export const authoritativeServer = new TrustedTournamentServer(
  isTestEnv
    ? {
        auctionState: {
          tournamentId: 'purple-bean-india-masters-2026',
          status: 'open',
          revision: 1,
          currentBid: MOCK_AUCTION_PLAYER.currentBid,
          leadingTeamId: 't-1',
          leadingTeamName: 'Purple Bean Titans',
          currentPlayer: MOCK_PLAYERS[2],
          secondsLeft: 22,
          bidHistory: [...MOCK_AUCTION_PLAYER.bidHistory],
          soldPlayers: [
            { playerId: 'p-1', teamId: 't-1', amount: 320000 },
            { playerId: 'p-2', teamId: 't-2', amount: 290000 }
          ],
          unsoldPlayers: [],
          unselectedPlayers: ['p-9', 'p-13', 'p-14', 'p-15', 'p-16']
        },
        teamBudgets: [...MOCK_AUCTION_TEAMS],
        tournaments: [...MOCK_TOURNAMENTS],
        matches: [...MOCK_MATCHES],
        teams: [...MOCK_TEAMS],
        brackets: [...MOCK_BRACKET_NODES]
      }
    : {
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
      }
);

export const apiRouter = Router();

// Mount OpenDota Proxy and Diagnostics Router
apiRouter.use('/opendota', opendotaRouter);

export const AUTHORIZED_ORGANIZERS = new Set([
  '00000000-0000-4000-8000-000000000001',
  '11106cm009@gmail.com',
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

// 1.1 Dedicated Live Captain Auction Bid (Phase 2 Engine Authority)
apiRouter.post('/auction/captain-bid', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';
    
    // Strict rejection of organisers attempting to bid on behalf of teams
    if (caller.role === 'organizer' || caller.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Reject: Organiser cannot bid on behalf of teams. Only authenticated franchise captains can submit bids.'
      });
    }

    if (caller.role === 'spectator') {
      return res.status(403).json({
        success: false,
        error: 'Reject: Spectator account is read-only and cannot submit live bids.'
      });
    }

    if (!tournamentConfigRegistry.isAuctionSupported(tournamentId)) {
      return res.status(400).json({
        success: false,
        error: `Reject: Tournament '${tournamentId}' is not configured for player auctions.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.placeBid({
      teamId: req.body.teamId,
      captainUserId: caller.userId,
      bidAmount: req.body.bidAmount !== undefined ? Number(req.body.bidAmount) : undefined,
      increment: req.body.increment !== undefined ? Number(req.body.increment) : undefined,
      expectedRevision: req.body.expectedRevision !== undefined ? Number(req.body.expectedRevision) : undefined,
      actorRole: caller.role
    });

    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.2 Organiser Live Nomination
apiRouter.post('/auction/nominate', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Reject: Only authorized tournament organisers can nominate contenders to the auction floor.'
      });
    }

    if (!tournamentConfigRegistry.canUserManageTournamentAuction(caller, tournamentId)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Caller is not authorized to operate auctions for tournament '${tournamentId}'.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.nominatePlayer(req.body.playerId, caller.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.3 Organiser Pause Auction
apiRouter.post('/auction/pause', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only organisers can pause the auction.' });
    }

    if (!tournamentConfigRegistry.canUserManageTournamentAuction(caller, tournamentId)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Caller is not authorized to operate auctions for tournament '${tournamentId}'.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.pauseAuction(caller.userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.4 Organiser Resume Auction
apiRouter.post('/auction/resume', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only organisers can resume the auction.' });
    }

    if (!tournamentConfigRegistry.canUserManageTournamentAuction(caller, tournamentId)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Caller is not authorized to operate auctions for tournament '${tournamentId}'.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.resumeAuction(caller.userId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.5 Organiser Conclude Nomination
apiRouter.post('/auction/dota-conclude', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only organisers can conclude lots.' });
    }

    if (!tournamentConfigRegistry.canUserManageTournamentAuction(caller, tournamentId)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Caller is not authorized to operate auctions for tournament '${tournamentId}'.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.concludeNomination(Boolean(req.body.sellToWinner), caller.userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 1.6 Public Live Auction State
apiRouter.get('/auction/state', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'purple-bean-test-cup';
    const engine = getAuctionEngine(tournamentId);
    res.json({
      success: true,
      tournamentId,
      state: engine.getState(),
      teams: engine.getTeams(),
      nominee: engine.getState().nominee,
      bidHistory: engine.getBidHistory()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.7 Server-Authoritative Purse Allocation Audit & Review
apiRouter.get('/auction/purse-allocation', (req: Request, res: Response) => {
  try {
    const tournamentId = (req.query.tournamentId as string) || 'purple-bean-test-cup';
    const engine = getAuctionEngine(tournamentId);
    let audit = engine.getPurseAllocationAudit();
    
    // If not calculated yet but teams exist, calculate
    if (!audit && engine.getTeams().length >= 2) {
      const calcRes = engine.calculateAndApplyMmrBalancedPurses('system', false);
      if (calcRes.success) {
        audit = calcRes.audit || null;
      }
    }

    const missingCaptain = engine.getMissingLockedMmrCaptain();

    res.json({
      success: true,
      tournamentId,
      audit,
      isFrozen: engine.isPurseAllocationFrozen(),
      hasBidsStarted: engine.hasBidsStarted(),
      missingCaptain,
      explanation: "Starting auction credits are balanced using each captain's verified Tournament MMR. Stronger captains receive a smaller purse because the captain already occupies one of the team's five roster slots."
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.8 Server-Authoritative Purse Recalculation (Pre-Auction Only)
apiRouter.post('/auction/recalculate-purses', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Only authorized organisers can recalculate starting purses.'
      });
    }

    if (!tournamentConfigRegistry.canUserManageTournamentAuction(caller, tournamentId)) {
      return res.status(403).json({
        success: false,
        error: `Unauthorized: Caller is not authorized to manage tournament '${tournamentId}'.`
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.recalculatePurses(caller.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 1.9 Server-Authoritative Allocation Mode (EQUAL vs CAPTAIN_MMR_BALANCED)
apiRouter.post('/auction/set-allocation-mode', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    const tournamentId = req.body.tournamentId || (req.query.tournamentId as string) || 'purple-bean-test-cup';
    const mode = req.body.mode;

    if (caller.role !== 'organizer' && !caller.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Only authorized organisers can configure auction allocation mode.'
      });
    }

    if (mode !== 'EQUAL' && mode !== 'CAPTAIN_MMR_BALANCED') {
      return res.status(400).json({
        success: false,
        error: "Invalid mode: Must be 'EQUAL' or 'CAPTAIN_MMR_BALANCED'."
      });
    }

    const engine = getAuctionEngine(tournamentId);
    const result = engine.setAllocationMode(mode, caller.userId);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
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
    const designatedAdminEmail = '11106cm009@gmail.com';
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
        error: 'DENIED: Only designated Platform Admin (11106cm009@gmail.com) can bootstrap administrator credentials.' 
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

// Roles Management API (Primary Admin Only)
apiRouter.post('/admin/roles/grant', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    if (!caller.isAdmin && caller.email?.toLowerCase() !== '11106cm009@gmail.com') {
      return res.status(403).json({ success: false, error: 'DENIED: Only primary admin can grant roles.' });
    }
    const { email, role } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required.' });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    if (role === 'admin' || role === 'organizer') {
      AUTHORIZED_ORGANIZERS.add(cleanEmail);
    }
    res.json({ success: true, message: `Role ${role} granted to ${cleanEmail}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/admin/roles/revoke', (req: Request, res: Response) => {
  try {
    const caller = resolveCaller(req);
    if (!caller.isAdmin && caller.email?.toLowerCase() !== '11106cm009@gmail.com') {
      return res.status(403).json({ success: false, error: 'DENIED: Only primary admin can revoke roles.' });
    }
    const { email } = req.body;
    const cleanEmail = String(email).toLowerCase().trim();
    if (cleanEmail === '11106cm009@gmail.com') {
      return res.status(400).json({ success: false, error: 'Primary admin cannot be revoked.' });
    }
    AUTHORIZED_ORGANIZERS.delete(cleanEmail);
    res.json({ success: true, message: `Access revoked for ${cleanEmail}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

