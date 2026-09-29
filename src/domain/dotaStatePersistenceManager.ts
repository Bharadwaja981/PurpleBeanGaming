/**
 * Purple Bean Gaming — Production State Persistence Manager
 * 
 * Reconstructs authoritative tournament state across server restarts,
 * browser reloads, and redeployments using real Firebase persistence.
 * 
 * Manages atomic snapshots of:
 * - Registrations & verification
 * - Captain auctions & purses
 * - Rosters & stand-in assignments
 * - Brackets & match progression
 * - Official ratings, leaderboards & career histories
 * - Announcements, dispute reports & audit trail
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isQuotaExhausted, setQuotaExhausted, isQuotaError } from '../services/firebaseConfig';
import { dotaTournamentOperations, TournamentAnnouncement, PlayerTeamReport, AuditRecord, TournamentSanction, PlatformSanction, PersistentNotification, TournamentRuleVersion } from './dotaTournamentOperationsEngine';
import { dotaCareerHistoryEngine, PlayerCareerRecord, TeamCareerRecord, CaptainCareerRecord, DotaSeason, DotaPlayerRatingEvent } from './dotaCareerHistoryEngine';
import { dotaAuctionEngine, DotaAuctionTeam, DotaAuctionPlayer } from './dotaAuctionEngine';
import { dotaPremadeTeamEngine, PremadeTeamRegistration } from './dotaPremadeTeamEngine';
import { dotaCompetitionEngine, CompetitionStructureState, SeededTeam } from './dotaCompetitionEngine';
import { dotaPlayerRegistry, DotaTournamentRegistration, DotaPlayerProfile, MmrIntegrityCase } from './dotaPlayerEngine';
import { authoritativeServer } from '../server/apiRouter';

export interface AuthoritativeTournamentSnapshot {
  version: number;
  tournamentId: string;
  savedAt: string;
  environment: 'production' | 'development' | 'test';

  // 1. Operations & Admin State
  operations: {
    ruleVersions: Array<[string, TournamentRuleVersion[]]>;
    announcements: Array<[string, TournamentAnnouncement[]]>;
    reports: Array<[string, PlayerTeamReport]>;
    auditLogs: AuditRecord[];
    tournamentSanctions: TournamentSanction[];
    platformSanctions: PlatformSanction[];
    notifications: PersistentNotification[];
  };

  // 2. Career & Ratings State
  careers: {
    seasons: DotaSeason[];
    playerCareers: Array<[string, PlayerCareerRecord]>;
    teamCareers: Array<[string, TeamCareerRecord]>;
    captainCareers: Array<[string, CaptainCareerRecord]>;
    ratingLedger: DotaPlayerRatingEvent[];
  };

  // 3. Auction State
  auction: {
    status: 'draft' | 'ready' | 'open' | 'paused' | 'completed';
    revision: number;
    currentBid: number;
    leadingTeamId: string;
    leadingTeamName: string;
    secondsLeft: number;
    nomineeId: string | null;
    teams: DotaAuctionTeam[];
    players: DotaAuctionPlayer[];
  };

  // 4. Competition & Bracket State
  competition: {
    seededTeams: SeededTeam[];
    structure: CompetitionStructureState | null;
    isLocked: boolean;
  };

  // 5. Premade Teams & Rosters
  premadeTeams: {
    teams: PremadeTeamRegistration[];
  };

  // 6. Players Registry & Verification
  playerRegistry: {
    players: DotaPlayerProfile[];
    registrations: DotaTournamentRegistration[];
    integrityCases: MmrIntegrityCase[];
  };
}

export class DotaStatePersistenceManager {
  private activeTournamentId = 'purple-bean-test-cup';
  private persistenceListeners: Array<(snapshot: AuthoritativeTournamentSnapshot) => void> = [];

  /**
   * Serializes current state from all domain engines into an authoritative snapshot
   */
  public exportSnapshot(tournamentId = this.activeTournamentId): AuthoritativeTournamentSnapshot {
    const ops = dotaTournamentOperations as any;
    const careers = dotaCareerHistoryEngine as any;
    const auction = dotaAuctionEngine as any;
    const comp = dotaCompetitionEngine as any;
    const premade = dotaPremadeTeamEngine as any;
    const registry = dotaPlayerRegistry as any;

    return {
      version: 1,
      tournamentId,
      savedAt: new Date().toISOString(),
      environment: typeof import.meta !== 'undefined' && import.meta.env?.PROD ? 'production' : 'development',
      operations: {
        ruleVersions: Array.from(ops.ruleVersions?.entries?.() || []),
        announcements: Array.from(ops.announcements?.entries?.() || []),
        reports: Array.from(ops.reports?.entries?.() || []),
        auditLogs: [...(ops.auditLogs || [])],
        tournamentSanctions: [...(ops.tournamentSanctions || [])],
        platformSanctions: [...(ops.platformSanctions || [])],
        notifications: [...(ops.notifications || [])]
      },
      careers: {
        seasons: careers.getAllSeasons ? careers.getAllSeasons() : [],
        playerCareers: Array.from(careers.playerCareers?.entries?.() || []),
        teamCareers: Array.from(careers.teamCareers?.entries?.() || []),
        captainCareers: Array.from(careers.captainCareers?.entries?.() || []),
        ratingLedger: careers.getRatingLedger ? careers.getRatingLedger() : []
      },
      auction: {
        status: auction.status || 'open',
        revision: auction.revision || 1,
        currentBid: auction.currentBid || 10,
        leadingTeamId: auction.leadingTeamId || '',
        leadingTeamName: auction.leadingTeamName || '',
        secondsLeft: auction.secondsLeft || 30,
        nomineeId: auction.currentNominee?.id || null,
        teams: auction.getTeams ? auction.getTeams() : [],
        players: auction.getAllPlayers ? auction.getAllPlayers() : []
      },
      competition: {
        seededTeams: comp.getSeededTeams ? comp.getSeededTeams(tournamentId) : [],
        structure: comp.getStructure ? comp.getStructure(tournamentId) : null,
        isLocked: comp.isLocked ? comp.isLocked(tournamentId) : false
      },
      premadeTeams: {
        teams: premade.getAllTeams ? premade.getAllTeams(tournamentId) : []
      },
      playerRegistry: {
        players: registry.getAllPlayers ? registry.getAllPlayers() : [],
        registrations: registry.getAllRegistrations ? registry.getAllRegistrations(tournamentId) : [],
        integrityCases: registry.getIntegrityCases ? registry.getIntegrityCases() : []
      }
    };
  }

  /**
   * Reconstructs all domain engines from a snapshot
   */
  public importSnapshot(snapshot: AuthoritativeTournamentSnapshot): boolean {
    if (!snapshot || !snapshot.tournamentId) {
      return false;
    }

    try {
      const ops = dotaTournamentOperations as any;
      const careers = dotaCareerHistoryEngine as any;
      const auction = dotaAuctionEngine as any;
      const comp = dotaCompetitionEngine as any;
      const premade = dotaPremadeTeamEngine as any;
      const registry = dotaPlayerRegistry as any;

      // 1. Restore Operations
      if (snapshot.operations) {
        if (snapshot.operations.ruleVersions) {
          ops.ruleVersions = new Map(snapshot.operations.ruleVersions);
        }
        if (snapshot.operations.announcements) {
          ops.announcements = new Map(snapshot.operations.announcements);
        }
        if (snapshot.operations.reports) {
          ops.reports = new Map(snapshot.operations.reports);
        }
        if (snapshot.operations.auditLogs) {
          ops.auditLogs = [...snapshot.operations.auditLogs];
        }
        if (snapshot.operations.tournamentSanctions) {
          ops.tournamentSanctions = [...snapshot.operations.tournamentSanctions];
        }
        if (snapshot.operations.platformSanctions) {
          ops.platformSanctions = [...snapshot.operations.platformSanctions];
        }
        if (snapshot.operations.notifications) {
          ops.notifications = [...snapshot.operations.notifications];
        }
      }

      // 2. Restore Careers & Ratings
      if (snapshot.careers) {
        if (snapshot.careers.playerCareers) {
          careers.playerCareers = new Map(snapshot.careers.playerCareers);
        }
        if (snapshot.careers.teamCareers) {
          careers.teamCareers = new Map(snapshot.careers.teamCareers);
        }
        if (snapshot.careers.captainCareers) {
          careers.captainCareers = new Map(snapshot.careers.captainCareers);
        }
        if (snapshot.careers.ratingLedger) {
          careers.ratingLedger = [...snapshot.careers.ratingLedger];
        }
      }

      // 3. Restore Auction
      if (snapshot.auction) {
        auction.status = snapshot.auction.status;
        auction.revision = snapshot.auction.revision;
        auction.currentBid = snapshot.auction.currentBid;
        auction.leadingTeamId = snapshot.auction.leadingTeamId;
        auction.leadingTeamName = snapshot.auction.leadingTeamName;
        auction.secondsLeft = snapshot.auction.secondsLeft;
        if (snapshot.auction.teams && auction.teams) {
          auction.teams = new Map(snapshot.auction.teams.map(t => [t.id || (t as any).teamId, { ...t }]));
        }
        if (snapshot.auction.players && auction.auctionPlayers) {
          auction.auctionPlayers = new Map(snapshot.auction.players.map(p => [p.id || (p as any).playerId, { ...p }]));
        }
      }

      // 4. Restore Competition Structure
      if (snapshot.competition) {
        if (snapshot.competition.structure && comp.structures) {
          comp.structures.set(snapshot.tournamentId, snapshot.competition.structure);
        }
        if (snapshot.competition.seededTeams && comp.seededTeams) {
          comp.seededTeams.set(snapshot.tournamentId, snapshot.competition.seededTeams);
        }
        if (snapshot.competition.isLocked !== undefined && comp.lockedTournaments) {
          if (snapshot.competition.isLocked) {
            comp.lockedTournaments.add(snapshot.tournamentId);
          } else {
            comp.lockedTournaments.delete(snapshot.tournamentId);
          }
        }
      }

      // 5. Restore Premade Teams
      if (snapshot.premadeTeams?.teams && premade.teams) {
        premade.teams = new Map(snapshot.premadeTeams.teams.map(t => [t.teamId, { ...t }]));
      }

      // 6. Restore Player Registry
      if (snapshot.playerRegistry) {
        if (snapshot.playerRegistry.players && registry.players) {
          registry.players = new Map(snapshot.playerRegistry.players.map(p => [p.id, { ...p }]));
        }
        if (snapshot.playerRegistry.registrations && registry.registrations) {
          registry.registrations = new Map(snapshot.playerRegistry.registrations.map(r => [r.id, { ...r }]));
        }
        if (snapshot.playerRegistry.integrityCases && registry.integrityCases) {
          registry.integrityCases = new Map(snapshot.playerRegistry.integrityCases.map(c => [c.id, { ...c }]));
        }
      }

      // Sync authoritative server if available
      try {
        if (authoritativeServer && (authoritativeServer as any).restoreSnapshot) {
          (authoritativeServer as any).restoreSnapshot(snapshot);
        }
      } catch {
        // Ignored in non-server context
      }

      this.persistenceListeners.forEach(l => {
        try { l(snapshot); } catch (e) { console.error('Persistence listener error:', e); }
      });

      return true;
    } catch (err) {
      console.error('Failed to import authoritative snapshot:', err);
      return false;
    }
  }

  /**
   * Persists the snapshot to Firebase Firestore
   */
  public async persistToFirestore(tournamentId = this.activeTournamentId): Promise<boolean> {
    try {
      if (isQuotaExhausted()) return true;
      const snapshot = this.exportSnapshot(tournamentId);
      const docRef = doc(db, 'stateSnapshots', `state-${tournamentId}`);
      await setDoc(docRef, {
        ...snapshot,
        lastSyncedAt: new Date().toISOString()
      }, { merge: true });
      return true;
    } catch (err) {
      if (isQuotaError(err)) {
        setQuotaExhausted(true);
      }
      console.warn('Firestore snapshot persistence note (local authoritative mode active):', err);
      return false;
    }
  }

  /**
   * Loads and hydrates the latest snapshot from Firebase Firestore
   */
  public async loadFromFirestore(tournamentId = this.activeTournamentId): Promise<boolean> {
    try {
      const docRef = doc(db, 'stateSnapshots', `state-${tournamentId}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as AuthoritativeTournamentSnapshot;
        return this.importSnapshot(data);
      }
      return false;
    } catch (err) {
      console.warn('Firestore snapshot fetch note:', err);
      return false;
    }
  }

  public subscribe(listener: (snapshot: AuthoritativeTournamentSnapshot) => void) {
    this.persistenceListeners.push(listener);
    return () => {
      this.persistenceListeners = this.persistenceListeners.filter(l => l !== listener);
    };
  }
}

export const dotaStatePersistenceManager = new DotaStatePersistenceManager();
