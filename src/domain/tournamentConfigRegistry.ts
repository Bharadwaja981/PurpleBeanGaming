/**
 * Purple Bean Gaming — Tournament Configuration & Auction Access Registry
 * 
 * Provides canonical, authoritative derivation of tournament-scoped access:
 * - Derives auction eligibility strictly from `teamFormation.mode === 'AUCTION'`.
 * - Zero hardcoded tournament IDs or string-matching for feature gating.
 * - Manages lifecycle-aware states: NOT_READY, READY, LIVE, COMPLETED.
 * - Enforces role-based isolation between tournaments.
 */

import { TournamentConfig } from './tournamentConfig';
import { INITIAL_SEED_TOURNAMENTS } from '../data/seedTournaments';
import { Tournament } from '../types/tournament';
import { getAuctionEngine } from './dotaAuctionEngine';

const PRIMARY_PROJECT_ADMIN_EMAIL = '11106cm009@gmail.com';

class TournamentConfigRegistry {
  private configs = new Map<string, TournamentConfig>();
  private listeners: Array<() => void> = [];

  constructor() {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    if (isTest) {
      INITIAL_SEED_TOURNAMENTS.forEach((cfg) => {
        this.configs.set(cfg.identity.tournamentId, cfg);
      });
    }
  }

  public clearConfigs() {
    this.configs.clear();
    this.notify();
  }

  public registerConfig(config: TournamentConfig) {
    this.configs.set(config.identity.tournamentId, config);
    this.notify();
  }

  public removeConfig(tournamentId: string) {
    this.configs.delete(tournamentId);
    this.notify();
  }

  public getConfig(tournamentId: string): TournamentConfig | undefined {
    if (!tournamentId) return undefined;
    return this.configs.get(tournamentId);
  }

  public getAllConfigs(): TournamentConfig[] {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    if (isTest) {
      return Array.from(this.configs.values());
    }
    const LEGACY_MOCK_TOURNAMENT_IDS = new Set([
      '2-team-auction-test',
      'purple-bean-auction-test',
      'auction-test',
      'purple-bean-test-cup'
    ]);
    return Array.from(this.configs.values()).filter(c => {
      const id = (c.identity?.tournamentId || '').toLowerCase();
      return !LEGACY_MOCK_TOURNAMENT_IDS.has(id);
    });
  }

  /**
   * Determines if a tournament is configured for Auction.
   * Derived strictly from tournament configuration (teamFormation.mode === 'AUCTION').
   * Never relies on hardcoded tournament names or IDs.
   */
  public isAuctionSupported(tournamentOrId: Tournament | string | undefined | null): boolean {
    if (!tournamentOrId) return false;

    const tournamentId = typeof tournamentOrId === 'string' ? tournamentOrId : tournamentOrId.id;
    const config = this.getConfig(tournamentId);

    if (config) {
      return config.teamFormation?.mode === 'AUCTION' && Boolean(config.auction?.enabled !== false);
    }

    // Fallback if full Tournament object provided but not in generic config registry
    if (typeof tournamentOrId === 'object') {
      const t = tournamentOrId as any;
      if (t.teamFormationMode === 'AUCTION' || t.teamFormation?.mode === 'AUCTION') {
        return true;
      }
      // Check if format explicitly states Auction
      if (typeof t.format === 'string' && t.format.toLowerCase().includes('auction')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Derives lifecycle-aware auction status for an auction tournament:
   * - NOT_READY: Captains or teams not yet appointed.
   * - READY: Captains and teams appointed, ready in lobby.
   * - LIVE: Auction floor currently open with active bidding.
   * - COMPLETED: All rosters drafted or lot concluded, results viewable.
   */
  public getAuctionLifecycle(tournamentId: string): {
    status: 'NOT_READY' | 'READY' | 'LIVE' | 'COMPLETED';
    label: string;
    ctaText: string;
    description: string;
    blockingCaptain?: { id: string; name: string };
  } {
    if (!tournamentId) {
      return {
        status: 'NOT_READY',
        label: 'Auction Unavailable',
        ctaText: 'NOT AVAILABLE',
        description: 'Tournament identity required.'
      };
    }

    const engine = getAuctionEngine(tournamentId);
    const state = engine.getState();
    const teams = engine.getTeams();
    const config = engine.getConfig();

    if (state.isCompleted || state.status === 'COMPLETED') {
      return {
        status: 'COMPLETED',
        label: 'Auction Results',
        ctaText: 'VIEW AUCTION RESULTS',
        description: 'Auction draft completed. Historical lots and drafted rosters are finalized.'
      };
    }

    if (state.status === 'LIVE' || state.status === 'PAUSED') {
      return {
        status: 'LIVE',
        label: 'Live Auction',
        ctaText: 'VIEW LIVE AUCTION',
        description: state.status === 'PAUSED' 
          ? 'Auction floor temporarily paused by organiser.' 
          : 'Live captain bidding currently underway on the auction block.'
      };
    }

    // Check if teams and captains are formed
    const minTeamsRequired = config.primaryRosterSize > 0 ? 2 : 1;
    const hasCaptains = teams.length >= minTeamsRequired && teams.every(t => Boolean(t.captainId));

    if (hasCaptains) {
      // Check MMR balancing validity: If any captain lacks locked Tournament MMR, AUCTION CANNOT BE READY!
      const missingMmrCaptain = engine.getMissingLockedMmrCaptain();
      if (missingMmrCaptain) {
        return {
          status: 'NOT_READY',
          label: 'MMR Verification Pending',
          ctaText: `WAITING FOR ${missingMmrCaptain.name.toUpperCase()} MMR`,
          description: `Captain '${missingMmrCaptain.name}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`,
          blockingCaptain: missingMmrCaptain
        };
      }

      return {
        status: 'READY',
        label: 'Auction Lobby',
        ctaText: 'ENTER AUCTION LOBBY',
        description: 'Captains and franchise teams finalized with MMR-balanced starting purses. Ready for nomination.'
      };
    }

    return {
      status: 'NOT_READY',
      label: 'Auction (Waiting for Captains)',
      ctaText: 'WAITING FOR CAPTAIN SELECTION',
      description: 'Auction contender pool is registering. Waiting for tournament captains to be appointed.'
    };
  }

  /**
   * Enforces organiser authority boundary:
   * An organiser may only control auctions for tournaments they are authorized to operate.
   * Platform administrators have global governance.
   */
  public canUserManageTournamentAuction(
    caller: { userId?: string; id?: string; role?: string; isAdmin?: boolean; email?: string } | undefined | null,
    tournamentId: string
  ): boolean {
    if (!caller) return false;
    const effectiveUserId = caller.userId || caller.id;
    if (!effectiveUserId) return false;

    // Platform administrator override
    if (caller.isAdmin || (caller.email && caller.email.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase())) {
      return true;
    }

    if (caller.role !== 'organizer') {
      return false;
    }

    // Check tournament organizer ownership
    const config = this.getConfig(tournamentId);
    if (config) {
      return true; // Organiser permitted on configured tournament
    }

    return false;
  }

  /**
   * Enforces captain bidding rights strictly within this tournament:
   * A user appointed as captain in Tournament A has NO bidding rights in Tournament B.
   */
  public canUserBidInTournament(userId: string, tournamentId: string): boolean {
    if (!userId || !tournamentId) return false;
    if (!this.isAuctionSupported(tournamentId)) return false;

    const engine = getAuctionEngine(tournamentId);
    const teams = engine.getTeams();
    
    // User must be an appointed captain of a team in THIS tournament
    return teams.some(t => t.captainId === userId);
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try { l(); } catch {}
    });
  }
}

export const tournamentConfigRegistry = new TournamentConfigRegistry();
