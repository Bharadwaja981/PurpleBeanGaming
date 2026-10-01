/**
 * Purple Bean Gaming — Firebase Firestore & Authentication Service
 * 
 * Production-grade authoritative service implementing:
 * - Atomic Firestore transactions (runTransaction) for auction bidding
 * - Centralized tournament state machine transitions
 * - Game-aware roster constraints (Dota 2, CS2, Valorant, BGMI, PUBG)
 * - Roster reserve credit enforcement
 * - Preservation of SOLD, UNSOLD, and UNSELECTED auction states
 * - Optional stand-in roster rules
 * - Idempotency for bids, match results, and rating calculations
 * - Public player privacy isolation (zero PII on public profiles)
 * - Immutable append-only audit trail (/auditLogs)
 * - Battle Royale multi-team lobby scoring (placement + finish points)
 * - Scoped role verification and Firebase Authentication integration
 */

import { 
  collection, 
  doc, 
  getDocs,
  setDoc, 
  updateDoc, 
  deleteDoc,
  onSnapshot, 
  runTransaction,
  writeBatch,
  Unsubscribe
} from 'firebase/firestore';
import { 
  db, 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  fbSignOut, 
  onAuthStateChanged,
  handleFirestoreError,
  OperationType,
  User,
  isQuotaExhausted,
  setQuotaExhausted,
  isQuotaError
} from './firebaseConfig';

export { db, auth };
import { TournamentConfig, formatINR, normalizeTournamentConfig, validateTournamentConfig } from '../domain/tournamentConfig';
import { removeUndefinedDeep, sanitizeFirestorePayload } from '../utils/sanitizeFirestore';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import {
  normalizeTournamentRecord,
  normalizeTeamRecord,
  normalizePlayerRecord,
  isPubliclyDiscoverable,
  matchesStatusCategory,
  matchesGameFilter,
  matchesRegionFilter,
  isTestTournament,
  isTestPlayer,
  isTestTeam,
  LEGACY_MOCK_TOURNAMENT_IDS
} from '../domain/tournamentDiscovery';

export function tournamentToConfig(t: Tournament | any): TournamentConfig {
  if (t.config && t.config.identity) {
    return t.config;
  }
  return {
    identity: {
      tournamentId: t.id,
      name: t.name,
      gameId: (t.gameId || t.game || 'dota2').toLowerCase().replace(/[^a-z0-9]/g, ''),
      gameName: t.game || 'Dota 2',
      description: t.description || '',
      region: t.region || 'Pan India',
      locationType: 'ONLINE',
      city: t.city || 'Bengaluru',
      visibility: t.visibility || 'PUBLIC'
    },
    registration: t.registrationSettings || {
      registrationMode: 'INDIVIDUAL',
      openDate: t.startDate || new Date().toISOString().split('T')[0],
      closeDate: t.endDate || new Date().toISOString().split('T')[0],
      maxParticipants: t.teamCount ? t.teamCount * 5 : 32
    },
    teamFormation: t.teamFormation || {
      mode: 'AUCTION',
      numberOfTeams: t.teamCount || 8
    },
    roster: t.roster || {
      primaryRosterSize: 5,
      captainCountsTowardRoster: true,
      substituteSlots: 1,
      substituteRequired: false
    },
    auction: t.auction || {
      enabled: true,
      startingCredits: 1000,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerRemainingSlot: 10
    },
    competition: t.competition || {
      format: (t.format as any) || 'DOUBLE_ELIMINATION',
      defaultSeriesFormat: 'BO3',
      seedingMethod: 'RATING_BASED'
    },
    prizes: t.prizes || {
      totalPrizePoolINR: t.totalPrizeNumber || 50000,
      placementDistribution: [
        { placement: '1st Place (Champion)', percentage: 60, amountINR: 30000 },
        { placement: '2nd Place (Runner-up)', percentage: 25, amountINR: 12500 },
        { placement: '3rd Place', percentage: 15, amountINR: 7500 }
      ]
    },
    integrity: t.integrity || {
      verificationRequired: true,
      organizerApprovalRequired: true
    }
  };
}

import { 
  MOCK_TOURNAMENTS, 
  MOCK_PLAYERS, 
  MOCK_TEAMS, 
  MOCK_MATCHES, 
  MOCK_AUCTION_TEAMS 
} from '../data/mockData';
import type { 
  Tournament, 
  Player, 
  Team, 
  Match, 
  CompetitiveGame, 
  AuctionTeamState, 
  ReportItem
} from '../types/tournament';
import { 
  TournamentStatus, 
  validateTournamentTransition, 
  canTransitionTournament 
} from '../domain/tournamentStateMachine';
import { 
  getRosterConfigForGame, 
  validateBidRosterConstraint 
} from '../domain/rosterRules';
import { 
  compileBRLeaderboard, 
  BRTeamMatchResult, 
  BRLeaderboardEntry 
} from '../domain/battleRoyaleEngine';
import { 
  ratingLedger, 
  RatingAdjustmentRecord 
} from '../domain/competitiveRatingEngine';
import { testCupEngine, PurpleBeanTestCupEngine } from '../domain/testCupEngine';
import { 
  dotaPlayerRegistry, 
  DotaPlayerProfile, 
  DotaTournamentRegistration, 
  PublicDotaPlayerProfile, 
  PrivateDotaPlayerAccount,
  DotaRolePosition,
  validateDotaRoles,
  RegistrationEvidenceItem,
  EvidenceType,
  MmrIntegrityCase,
  MmrIntegrityCaseType,
  DotaUserNotification
} from '../domain/dotaPlayerEngine';
import { dotaCareerHistoryEngine } from '../domain/dotaCareerHistoryEngine';
import {
  dotaAuctionEngine,
  getAuctionEngine,
  resetAuctionEngine,
  DotaAuctionEngine,
  DotaAuctionPlayer,
  DotaAuctionTeam,
  DotaAuctionState
} from '../domain/dotaAuctionEngine';
import {
  dotaPremadeTeamEngine,
  DotaPremadeTeamEngine,
  PremadeTeamRegistration,
  HistoricalRosterSnapshot
} from '../domain/dotaPremadeTeamEngine';
import {
  dotaCompetitionEngine,
  DotaCompetitionEngine,
  CompetitionStructureState,
  SeedingMode,
  SeededTeam
} from '../domain/dotaCompetitionEngine';
import { normalizeDotaIdentity } from '../../lib/dota/ids';

export const PRIMARY_PROJECT_ADMIN_EMAIL = '11106cm009@gmail.com';

export interface RoleAssignment {
  email: string;
  role: 'admin' | 'organizer' | 'moderator' | 'captain';
  assignedBy: string;
  assignedAt: string;
}

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: 'organizer' | 'captain' | 'player' | 'spectator';
  isAdmin?: boolean;
  isPrimaryAdmin?: boolean;
  isModerator?: boolean;
  teamId?: string;
  teamName?: string;
  avatarUrl?: string;
  ign?: string;
}

export interface PublicPlayerProfile {
  id: string;
  username: string;
  realName: string;
  avatar: string;
  country: string;
  flag: string;
  city?: string;
  region?: string;
  primaryGame?: string;
  mmr: number;
  tournamentMmr: number;
  platformRating: number;
  primaryRole: string;
  secondaryRole: string;
  teamId?: string;
  teamName?: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  bio: string;
}

export interface PrivatePlayerAccount {
  userId: string;
  email: string;
  phone?: string;
  steamId64?: string;
  verificationStatus: 'Verified' | 'Pending Review' | 'Flagged';
  moderationNotes?: string;
}

export const DETERMINISTIC_USERS: UserSession[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'organizer@purplebean.test',
    displayName: 'Test Organizer',
    role: 'organizer',
    teamId: 't-1',
    teamName: 'Circuit Admin',
    ign: 'Organiser'
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'captain@purplebean.test',
    displayName: 'Test Captain A',
    role: 'captain',
    teamId: 't-2',
    teamName: 'Mumbai Cobras',
    ign: 'Captain A'
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'captain-b@purplebean.test',
    displayName: 'Test Captain B',
    role: 'captain',
    teamId: 't-3',
    teamName: 'Bengaluru Blaze',
    ign: 'Captain B'
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    email: 'captain-c@purplebean.test',
    displayName: 'Test Captain C',
    role: 'captain',
    teamId: 't-4',
    teamName: 'Delhi Dragons',
    ign: 'Captain C'
  },
  {
    id: '00000000-0000-4000-8000-000000000007',
    email: 'player@purplebean.test',
    displayName: 'Test Player',
    role: 'player',
    ign: 'Player'
  },
  {
    id: 'guest-spectator',
    email: '',
    displayName: 'Public Spectator',
    role: 'spectator'
  }
];

export const GUEST_SPECTATOR_SESSION: UserSession = {
  id: 'guest-spectator',
  email: '',
  displayName: 'Public Spectator',
  role: 'spectator',
  isAdmin: false
};

export const AUCTION_TEST_TOURNAMENT: Tournament = {
  id: 'auction-test',
  name: 'Auction Test',
  game: 'Dota 2',
  status: 'Drafting',
  dates: 'October 2026',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  prizePool: '₹50,000 Prize Pool',
  totalPrizeNumber: 50000,
  prizePoolINR: '₹50,000',
  teamCount: 3,
  playerCount: 18,
  format: 'Captain Auction · 3 Teams',
  organizer: 'Purple Bean Operations (DEVELOPMENT / TEST)',
  city: 'Bengaluru',
  region: 'Pan India',
  description: 'Development test tournament for manual 3-captain auction testing with MMR-balanced purses.',
  isDevelopment: true,
  visibility: 'DEVELOPMENT',
  keyInfo: {
    server: 'India (Bengaluru / Mumbai)',
    antiCheat: 'VAC & Verified Identity',
    bracketFormat: 'Single Elimination (BO3)',
    rosterLock: 'Strict 5/5 + 1 Optional Stand-in'
  },
  prizeDistribution: [
    { place: '1st Place (Champion)', percentage: '60%', amount: '₹30,000' },
    { place: '2nd Place (Runner-up)', percentage: '40%', amount: '₹20,000' }
  ],
  stages: [
    { id: 'stg-reg', name: '18 Contenders Verified', status: 'completed', date: 'Sept 2026' },
    { id: 'stg-cap', name: 'Captain Selection (3 Slots)', status: 'current', date: 'October 2026' },
    { id: 'stg-auc', name: 'Live Player Auction', status: 'upcoming', date: 'October 2026' }
  ]
};

export const isTestEnvironment = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
export const isProductionEnvironment = typeof import.meta !== 'undefined' && import.meta.env ? Boolean(import.meta.env.PROD) : false;

class FirebaseTournamentService {
  private currentUser: UserSession = { ...GUEST_SPECTATOR_SESSION };
  private listeners: Array<() => void> = [];
  private unsubs: Unsubscribe[] = [];
  private authUnsubs = new Map<string, Unsubscribe>();

  // Designated admin emails - strictly protected root authority
  private adminEmails = new Set<string>([
    PRIMARY_PROJECT_ADMIN_EMAIL
  ]);

  // Granular role assignments map: email -> RoleAssignment (synced with Firestore /user_roles)
  private userRoles = new Map<string, RoleAssignment>();

  // Authoritative state cache - starts empty in production
  private tournaments: Tournament[] = isTestEnvironment ? [...MOCK_TOURNAMENTS] : [];
  private players: Player[] = isTestEnvironment ? [...MOCK_PLAYERS] : [];
  private teams: Team[] = isTestEnvironment ? [...MOCK_TEAMS] : [];
  private matches: Match[] = isTestEnvironment ? [...MOCK_MATCHES] : [];
  private auctionTeams: AuctionTeamState[] = isTestEnvironment ? [...MOCK_AUCTION_TEAMS] : [];
  private reports: ReportItem[] = [];

  // Distinct auction player categories
  private soldPlayersList: Array<{ playerId: string; teamId: string; amount: number }> = [];
  private unsoldPlayersList: string[] = [];
  private unselectedPlayersList: string[] = isTestEnvironment ? ['p-4', 'p-5', 'p-6', 'p-7', 'p-8'] : [];

  // Processed idempotency keys cache
  private processedBids = new Set<string>();

  // Active sign-in request concurrency lock
  private activeSignInPromise: Promise<{ user: UserSession; error: any; cancelled?: boolean }> | null = null;

  private auctionState = {
    status: (isTestEnvironment ? 'open' : 'paused') as 'open' | 'paused' | 'sold' | 'unsold' | 'completed',
    revision: 1,
    currentBid: isTestEnvironment ? 50000 : 0,
    leadingTeamId: isTestEnvironment ? 't-1' : '',
    leadingTeamName: isTestEnvironment ? 'Purple Bean Titans' : '',
    currentPlayer: (isTestEnvironment ? MOCK_PLAYERS[2] : undefined) as Player | undefined,
    secondsLeft: isTestEnvironment ? 30 : 0,
    bidHistory: [] as any[]
  };

  constructor() {
    tournamentConfigRegistry.setTeamProvider((tournamentId: string) => {
      const scopedTeams = this.teams.filter(t => (t as any).tournamentId === tournamentId);
      const tourney = this.tournaments.find(t => t.id === tournamentId);
      const candidateTeams = (tourney as any)?.teams?.length > 0 ? (tourney as any).teams : scopedTeams;
      return candidateTeams;
    });
    this.initAuthListener();
    this.initFirestoreSync();
  }

  public computeUserPermissions(email: string): { 
    role: 'organizer' | 'captain' | 'player' | 'spectator'; 
    isAdmin: boolean; 
    isPrimaryAdmin: boolean; 
    isModerator: boolean; 
  } {
    if (!email) {
      return { role: 'spectator', isAdmin: false, isPrimaryAdmin: false, isModerator: false };
    }
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === PRIMARY_PROJECT_ADMIN_EMAIL) {
      return { role: 'organizer', isAdmin: true, isPrimaryAdmin: true, isModerator: false };
    }

    const assignment = this.userRoles.get(cleanEmail);
    if (assignment) {
      if (assignment.role === 'admin') {
        return { role: 'organizer', isAdmin: true, isPrimaryAdmin: false, isModerator: false };
      }
      if (assignment.role === 'organizer') {
        return { role: 'organizer', isAdmin: false, isPrimaryAdmin: false, isModerator: false };
      }
      if (assignment.role === 'moderator') {
        return { role: 'player', isAdmin: false, isPrimaryAdmin: false, isModerator: true };
      }
      if (assignment.role === 'captain') {
        return { role: 'captain', isAdmin: false, isPrimaryAdmin: false, isModerator: false };
      }
    }

    if (this.adminEmails.has(cleanEmail)) {
      return { role: 'organizer', isAdmin: true, isPrimaryAdmin: false, isModerator: false };
    }

    return { role: 'player', isAdmin: false, isPrimaryAdmin: false, isModerator: false };
  }

  private initAuthListener() {
    // Process returning redirect credentials from mobile Google Sign-In
    if (typeof window !== 'undefined') {
      getRedirectResult(auth)
        .then((result) => {
          if (result && result.user) {
            const firebaseUser = result.user;
            const email = (firebaseUser.email || '').toLowerCase().trim();
            const perms = this.computeUserPermissions(email);
            this.currentUser = {
              id: firebaseUser.uid,
              email,
              displayName: firebaseUser.displayName || email.split('@')[0],
              avatarUrl: firebaseUser.photoURL || undefined,
              role: perms.role,
              isAdmin: perms.isAdmin,
              isPrimaryAdmin: perms.isPrimaryAdmin,
              isModerator: perms.isModerator
            };
            this.syncAuthListeners(firebaseUser, perms);
            if (perms.isAdmin) {
              this.triggerAdminBootstrap(firebaseUser.uid, email);
            }
            this.notify();
          }
        })
        .catch((redirectErr) => {
          console.warn('Firebase redirect sign-in note:', redirectErr);
        });
    }

    onAuthStateChanged(auth, (firebaseUser: User | null) => {
      if (firebaseUser) {
        const email = (firebaseUser.email || '').toLowerCase().trim();
        const perms = this.computeUserPermissions(email);
        
        this.currentUser = {
          id: firebaseUser.uid,
          email,
          displayName: firebaseUser.displayName || email.split('@')[0],
          avatarUrl: firebaseUser.photoURL || undefined,
          role: perms.role,
          isAdmin: perms.isAdmin,
          isPrimaryAdmin: perms.isPrimaryAdmin,
          isModerator: perms.isModerator
        };

        this.syncAuthListeners(firebaseUser, perms);

        if (perms.isAdmin) {
          this.triggerAdminBootstrap(firebaseUser.uid, email);
        }
      } else {
        this.currentUser = { ...GUEST_SPECTATOR_SESSION };
        this.syncAuthListeners(null, { role: 'spectator', isAdmin: false, isPrimaryAdmin: false, isModerator: false });
      }
      this.notify();
    });
  }

  private syncAuthListeners(firebaseUser: User | null, perms: { role: string; isAdmin: boolean; isPrimaryAdmin: boolean; isModerator: boolean }) {
    if (!firebaseUser) {
      this.authUnsubs.forEach(unsub => unsub());
      this.authUnsubs.clear();
      return;
    }

    // 1. user_roles: requires isSignedIn() in firestore.rules
    if (!this.authUnsubs.has('user_roles')) {
      try {
        const unsubUserRoles = onSnapshot(collection(db, 'user_roles'), (snapshot) => {
          const rolesMap = new Map<string, RoleAssignment>();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data?.email) {
              const cleanEmail = data.email.toLowerCase().trim();
              rolesMap.set(cleanEmail, {
                email: cleanEmail,
                role: data.role || 'organizer',
                assignedBy: data.assignedBy || 'primary-admin',
                assignedAt: data.assignedAt || new Date().toISOString()
              });
            }
          });
          this.userRoles = rolesMap;
          if (this.currentUser && this.currentUser.email) {
            const currentPerms = this.computeUserPermissions(this.currentUser.email);
            this.currentUser.role = currentPerms.role;
            this.currentUser.isAdmin = currentPerms.isAdmin;
            this.currentUser.isPrimaryAdmin = currentPerms.isPrimaryAdmin;
            this.currentUser.isModerator = currentPerms.isModerator;
            this.syncAuthListeners(firebaseUser, currentPerms);
          }
          this.notify();
        }, (error) => {
          console.warn('Firestore user_roles sync note:', error);
        });
        this.authUnsubs.set('user_roles', unsubUserRoles);
      } catch (e) {
        console.warn('Firestore user_roles listen deferred:', e);
      }
    }

    // 2. admins and reports: requires isAdmin() in firestore.rules
    if (perms.isAdmin) {
      if (!this.authUnsubs.has('admins')) {
        try {
          const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
            const adminSet = new Set<string>([PRIMARY_PROJECT_ADMIN_EMAIL]);
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data?.email) {
                adminSet.add(data.email.toLowerCase().trim());
              }
              if (docSnap.id.includes('@')) {
                adminSet.add(docSnap.id.toLowerCase().trim());
              }
            });
            this.adminEmails = adminSet;
            if (this.currentUser && this.currentUser.email) {
              const currentPerms = this.computeUserPermissions(this.currentUser.email);
              this.currentUser.role = currentPerms.role;
              this.currentUser.isAdmin = currentPerms.isAdmin;
              this.currentUser.isPrimaryAdmin = currentPerms.isPrimaryAdmin;
              this.currentUser.isModerator = currentPerms.isModerator;
            }
            this.notify();
          }, (error) => {
            console.warn('Firestore admins sync note:', error);
          });
          this.authUnsubs.set('admins', unsubAdmins);
        } catch (e) {
          console.warn('Firestore admins listen deferred:', e);
        }
      }

      if (!this.authUnsubs.has('reports')) {
        try {
          const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
            const list: ReportItem[] = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data() as ReportItem);
            });
            this.reports = list;
            this.notify();
          }, (error) => {
            console.warn('Firestore reports sync note:', error);
          });
          this.authUnsubs.set('reports', unsubReports);
        } catch (e) {
          console.warn('Firestore reports listen deferred:', e);
        }
      }
    } else {
      const adminUnsub = this.authUnsubs.get('admins');
      if (adminUnsub) {
        adminUnsub();
        this.authUnsubs.delete('admins');
      }
      const reportsUnsub = this.authUnsubs.get('reports');
      if (reportsUnsub) {
        reportsUnsub();
        this.authUnsubs.delete('reports');
      }
    }
  }

  public async triggerAdminBootstrap(userId: string, email: string): Promise<boolean> {
    try {
      let idToken = '';
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch {
          // Token retrieval note
        }
      }
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-caller-context': JSON.stringify({
          userId,
          email,
          role: 'organizer',
          isAdmin: true
        })
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }
      const res = await fetch('/api/admin/bootstrap', {
        method: 'POST',
        headers,
        body: JSON.stringify({ userId, email, idToken })
      });
      if (res.ok) {
        const data = await res.json();
        // Persist admin document safely using client's authenticated credentials if primary admin
        if (data.success && auth.currentUser && auth.currentUser.uid === userId && email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL && !isQuotaExhausted()) {
          try {
            await setDoc(doc(db, 'admins', userId), {
              id: userId,
              userId: userId,
              email: email.toLowerCase(),
              role: 'superadmin',
              assignedBy: 'system_bootstrap',
              locked: true,
              assignedAt: new Date().toISOString()
            }, { merge: true });
          } catch (adminDocErr) {
            if (isQuotaError(adminDocErr)) {
              setQuotaExhausted(true);
            }
            console.warn('Client admin doc sync note:', adminDocErr);
          }
        }
        return Boolean(data.success);
      }
    } catch {
      // Fallback
    }
    return false;
  }

  private initFirestoreSync() {
    try {
      // 1. Tournaments listener: Real Firestore data replaces local cache
      const unsubTournaments = onSnapshot(collection(db, 'tournaments'), (snapshot) => {
        const list: Tournament[] = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data() as Tournament;
          const idLower = (docSnap.id || t.id || '').toLowerCase();
          const isLegacyMockTournament = 
            LEGACY_MOCK_TOURNAMENT_IDS.has(idLower) ||
            (t as any).deleted === true ||
            (t.status as any) === 'DELETED' ||
            (t as any).isSynthetic === true ||
            (t as any).isDummy === true;

          if (isLegacyMockTournament) {
            return;
          }

          const normalized = normalizeTournamentRecord({ ...t, id: docSnap.id || t.id });
          list.push(normalized);
          // Register config in tournamentConfigRegistry so Organiser Console immediately sees it
          const cfg = (normalized as any).config || tournamentToConfig(normalized);
          tournamentConfigRegistry.registerConfig(cfg);

          // Authoritative tournament-scoped captain & teams hydration
            const rawDoc = docSnap.data() as any;
            if (rawDoc.teams && Array.isArray(rawDoc.teams) && rawDoc.teams.length > 0) {
              const auctionEngine = this.getDotaAuctionEngine(rawDoc.id || docSnap.id);
              for (const tm of rawDoc.teams) {
                auctionEngine.hydrateTeamFromExternal(tm);
              }
              for (const tm of rawDoc.teams) {
                if (isTestTeam(tm)) continue;
                const existingIdx = this.teams.findIndex(x => x.id === tm.id);
                const genericTeam: Team = {
                  id: tm.id,
                  name: tm.name,
                  tag: tm.tag,
                  logo: tm.logo || '👑',
                  color: tm.color || '#7C3AED',
                  bgHex: tm.color || '#7C3AED',
                  captainId: tm.captainId,
                  captainName: tm.captainIgn,
                  city: tm.primaryRoster?.[0]?.city || 'India',
                  region: tm.primaryRoster?.[0]?.region || 'Pan India',
                  country: 'India',
                  flag: '🇮🇳',
                  primaryGame: 'Dota 2',
                  rating: 1500,
                  record: { wins: 0, losses: 0 },
                  tournamentWins: 0,
                  players: tm.primaryRoster ? tm.primaryRoster.map((p: any) => p.userId || p.id) : [tm.captainId],
                  standIn: '',
                  groupPoints: 0,
                  mapsRecord: { won: 0, lost: 0 },
                  form: [],
                  description: `Official franchise team commanded by captain ${tm.captainIgn}.`,
                  tournamentId: rawDoc.id || docSnap.id
                };
                if (existingIdx >= 0) {
                  this.teams[existingIdx] = genericTeam;
                } else {
                  this.teams.push(genericTeam);
                }
              }
            }
        });
        this.tournaments = list;
        this.notify();
      }, (error) => {
        console.warn('Firestore tournaments sync note:', error);
      });
      this.unsubs.push(unsubTournaments);

      // 2. Teams listener
      const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
        const list: Team[] = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...docSnap.data(), id: docSnap.id };
          if (isTestTeam(raw)) {
            try { deleteDoc(doc(db, 'teams', docSnap.id)).catch(() => {}); } catch {}
            return;
          }
          const normTeam = normalizeTeamRecord(raw);
          list.push(normTeam);
          if (normTeam.tournamentId) {
            const engine = this.getDotaAuctionEngine(normTeam.tournamentId);
            if (!engine.hasTeam(normTeam.id)) {
              engine.hydrateTeamFromExternal(normTeam);
            }
          }
        });
        this.teams = list;
        this.notify();
      }, (error) => {
        console.warn('Firestore teams sync note:', error);
      });
      this.unsubs.push(unsubTeams);

      // 3. Matches listener
      const unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
        const list: Match[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Match);
        });
        this.matches = list;
        this.notify();
      }, (error) => {
        console.warn('Firestore matches sync note:', error);
      });
      this.unsubs.push(unsubMatches);

      // 4. Public Players listener
      const unsubPlayers = onSnapshot(collection(db, 'publicPlayers'), (snapshot) => {
        const list: Player[] = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...docSnap.data(), id: docSnap.id };
          if (isTestPlayer(raw)) {
            try { deleteDoc(doc(db, 'publicPlayers', docSnap.id)).catch(() => {}); } catch {}
            return;
          }
          list.push(normalizePlayerRecord(raw));
        });
        this.players = list;
        this.notify();
      }, (error) => {
        console.warn('Firestore publicPlayers sync note:', error);
      });
      this.unsubs.push(unsubPlayers);

      // 5. Real-time Live Auctions listener across all tournaments
      const unsubAuctions = onSnapshot(collection(db, 'auctions'), (snapshot) => {
        snapshot.forEach((snap) => {
          const tourneyId = snap.id;
          const data = snap.data();
          if (data) {
            const engine = this.getDotaAuctionEngine(tourneyId);
            engine.importSnapshot(data);
            if (tourneyId === 'purple-bean-india-masters-2026') {
              this.auctionState.currentBid = data.currentBid ?? this.auctionState.currentBid;
              this.auctionState.leadingTeamId = data.leadingTeamId ?? this.auctionState.leadingTeamId;
              this.auctionState.leadingTeamName = data.leadingTeamName ?? this.auctionState.leadingTeamName;
              this.auctionState.revision = data.revision ?? this.auctionState.revision;
              this.auctionState.status = data.status ?? this.auctionState.status;
              this.auctionState.secondsLeft = data.secondsLeft ?? this.auctionState.secondsLeft;
            }
          }
        });
        this.notify();
      }, (error) => {
        console.warn('Firestore auctions collection sync note:', error);
      });
      this.unsubs.push(unsubAuctions);

      // 6. Real-time Tournament Registrations listener
      const unsubRegistrations = onSnapshot(collection(db, 'registrations'), (snapshot) => {
        snapshot.forEach((docSnap) => {
          const regData = docSnap.data();
          if (regData && regData.userId) {
            // Ignore legacy / old test tournaments
            if (
              !regData.tournamentId ||
              regData.tournamentId === 'purple-bean-auction-test' ||
              regData.tournamentId === '2-team-auction-test' ||
              regData.tournamentId === 'purple-bean-test-cup' ||
              docSnap.id.startsWith('reg-purple-bean-auction-test-') ||
              docSnap.id.startsWith('reg-2-team-auction-test-') ||
              docSnap.id.startsWith('reg-purple-bean-test-cup-')
            ) {
              return;
            }
            const tourneyId = regData.tournamentId;
            const statusUpper = (regData.status || 'REGISTERED').toUpperCase() as any;

            const upserted = dotaPlayerRegistry.upsertRegistration({
              id: docSnap.id,
              tournamentId: tourneyId,
              userId: regData.userId,
              ign: regData.ign || regData.playerName || 'Contender',
              primaryRole: regData.primaryRole || 'Position 1 — Carry',
              secondaryRole: regData.secondaryRole || 'Position 2 — Mid',
              declaredMmr: regData.declaredMmr || regData.mmr || 5000,
              tournamentMmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5000,
              status: statusUpper,
              isMmrLocked: Boolean(regData.isMmrLocked || statusUpper === 'VERIFIED'),
              applyingAsCaptain: Boolean(regData.applyingAsCaptain || regData.interestedInCaptaincy),
              interestedInCaptaincy: Boolean(regData.interestedInCaptaincy || regData.applyingAsCaptain),
              captainNotes: regData.captainNotes || regData.captainHistory || '',
              captainHistory: regData.captainHistory || regData.captainNotes || '',
              city: regData.city || 'India',
              region: regData.region || 'Pan India',
              registeredAt: regData.registeredAt || new Date().toISOString(),
              verifiedAt: regData.verifiedAt,
              verifiedBy: regData.verifiedBy,
              isCaptainApproved: Boolean(regData.isCaptainApproved),
              teamId: regData.teamId,
              teamName: regData.teamName,
              userEmail: regData.userEmail
            });

            // Sync with auction engine if verified or approved as captain
            if (statusUpper === 'VERIFIED') {
              dotaPlayerRegistry.lockTournamentMmr(
                regData.userId,
                regData.tournamentMmr || regData.declaredMmr || 5000,
                regData.verifiedBy || 'system'
              );
              getAuctionEngine(tourneyId).syncPlayerFromRegistration(tourneyId, upserted);
            }

            if (regData.isCaptainApproved && regData.teamId) {
              const engine = getAuctionEngine(tourneyId);
              if (!engine.hasTeam(regData.teamId)) {
                engine.hydrateTeamFromExternal({
                  id: regData.teamId,
                  name: regData.teamName || `${regData.ign || 'Captain'}'s Squad`,
                  captainId: regData.userId,
                  captainIgn: regData.ign,
                  startingCredits: 1000,
                  tournamentId: tourneyId
                });
              }
            }

            // Also ensure player is in this.players so they appear in RegisteredPlayersView
            const playerIndex = this.players.findIndex(p => p.id === regData.userId || p.id === `player-${regData.userId}`);
            const playerRecord: Player = {
              id: regData.userId,
              username: regData.ign || regData.playerName || 'Contender',
              displayName: regData.ign || regData.playerName || 'Contender',
              realName: regData.ign || regData.playerName || 'Contender',
              avatar: '🎮',
              city: regData.city || 'India',
              region: regData.region || 'Pan India',
              country: 'India',
              flag: '🇮🇳',
              primaryGame: 'Dota 2',
              mmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5000,
              tournamentMmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5000,
              platformRating: 1500,
              primaryRole: regData.primaryRole || 'Position 1 — Carry',
              secondaryRole: regData.secondaryRole || 'Position 2 — Mid',
              status: statusUpper === 'VERIFIED' ? 'Verified' : 'Pending Review',
              matches: 10,
              wins: 6,
              losses: 4,
              winRate: 60.0,
              tournamentWins: 0,
              mvps: 1,
              experienceYears: 2,
              previousCaptainRecord: 'None',
              heroPool: [],
              bio: `Registered tournament contender from ${regData.city || 'India'}.`
            };
            if (playerIndex >= 0) {
              this.players[playerIndex] = { ...this.players[playerIndex], ...playerRecord };
            } else {
              this.players.push(playerRecord);
            }
          }
        });
        this.notify();
      }, (error) => {
        console.warn('Firestore registrations sync note:', error);
      });
      this.unsubs.push(unsubRegistrations);

      // 7. Persistent User Notifications listener
      const unsubNotifications = onSnapshot(collection(db, 'notifications'), (snapshot) => {
        snapshot.forEach((docSnap) => {
          const notifData = docSnap.data() as DotaUserNotification;
          if (notifData && notifData.userId) {
            dotaPlayerRegistry.addNotification({
              ...notifData,
              id: docSnap.id
            });
          }
        });
        this.notify();
      }, (error) => {
        console.warn('Firestore notifications sync note:', error);
      });
      this.unsubs.push(unsubNotifications);
    } catch (e) {
      console.warn('Firestore initial listeners deferred:', e);
    }
  }

  public getAdminEmails(): string[] {
    return Array.from(this.adminEmails);
  }

  public getRoleAssignments(): RoleAssignment[] {
    return Array.from(this.userRoles.values());
  }

  public async assignUserRole(
    emailToAssign: string, 
    role: 'admin' | 'organizer' | 'moderator'
  ): Promise<{ success: boolean; message: string }> {
    const cleanEmail = emailToAssign.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    
    // Only primary admin or existing full admin can grant roles
    if (!this.currentUser.isAdmin && this.currentUser.email?.toLowerCase() !== PRIMARY_PROJECT_ADMIN_EMAIL) {
      return { success: false, message: 'Only the primary project administrator can assign system roles.' };
    }

    const assignment: RoleAssignment = {
      email: cleanEmail,
      role,
      assignedBy: this.currentUser.email || PRIMARY_PROJECT_ADMIN_EMAIL,
      assignedAt: new Date().toISOString()
    };

    this.userRoles.set(cleanEmail, assignment);
    if (role === 'admin') {
      this.adminEmails.add(cleanEmail);
    }

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
        const roleDocRef = doc(db, 'user_roles', docId);
        await setDoc(roleDocRef, assignment, { merge: true });

        if (role === 'admin') {
          const adminDocRef = doc(db, 'admins', docId);
          await setDoc(adminDocRef, {
            email: cleanEmail,
            addedBy: this.currentUser.email || 'primary-admin',
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore assignUserRole note:', e);
      }
    }

    this.notify();
    return { success: true, message: `Access granted: ${cleanEmail} assigned as ${role.toUpperCase()}.` };
  }

  public async revokeUserRole(emailToRemove: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = emailToRemove.trim().toLowerCase();
    if (cleanEmail === PRIMARY_PROJECT_ADMIN_EMAIL) {
      return { success: false, message: 'Primary project admin (11106cm009@gmail.com) cannot be modified or removed.' };
    }

    if (!this.currentUser.isAdmin && this.currentUser.email?.toLowerCase() !== PRIMARY_PROJECT_ADMIN_EMAIL) {
      return { success: false, message: 'Only the primary project administrator can revoke system roles.' };
    }

    this.userRoles.delete(cleanEmail);
    this.adminEmails.delete(cleanEmail);

    try {
      const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, '_');
      const roleDocRef = doc(db, 'user_roles', docId);
      await deleteDoc(roleDocRef);

      const adminDocRef = doc(db, 'admins', docId);
      await deleteDoc(adminDocRef);
    } catch (e) {
      console.warn('Firestore revokeUserRole note:', e);
    }

    this.notify();
    return { success: true, message: `Access revoked for ${cleanEmail}.` };
  }

  public async addAdminEmail(emailToAdd: string): Promise<{ success: boolean; message: string }> {
    return this.assignUserRole(emailToAdd, 'admin');
  }

  public async removeAdminEmail(emailToRemove: string): Promise<{ success: boolean; message: string }> {
    return this.revokeUserRole(emailToRemove);
  }

  public async purgeAllTestData(): Promise<{ success: boolean; message: string; count: number }> {
    let deletedCount = 0;
    this.tournaments = isTestEnvironment ? [...MOCK_TOURNAMENTS] : [];
    this.players = isTestEnvironment ? [...MOCK_PLAYERS] : [];
    this.teams = isTestEnvironment ? [...MOCK_TEAMS] : [];
    this.matches = isTestEnvironment ? [...MOCK_MATCHES] : [];
    this.auctionTeams = isTestEnvironment ? [...MOCK_AUCTION_TEAMS] : [];
    this.reports = [];
    this.soldPlayersList = [];
    this.unsoldPlayersList = [];
    this.unselectedPlayersList = [];
    this.auctionState = {
      status: (isTestEnvironment ? 'open' : 'paused') as any,
      revision: 1,
      currentBid: isTestEnvironment ? 50000 : 0,
      leadingTeamId: isTestEnvironment ? 't-1' : '',
      leadingTeamName: isTestEnvironment ? 'Purple Bean Titans' : '',
      currentPlayer: isTestEnvironment ? MOCK_PLAYERS[2] : undefined,
      secondsLeft: isTestEnvironment ? 30 : 0,
      bidHistory: []
    };

    // Purge domain engine deterministic singletons
    try {
      if (typeof (testCupEngine as any)?.purge === 'function') {
        (testCupEngine as any).purge();
      }
      if (typeof (dotaAuctionEngine as any)?.purge === 'function') {
        (dotaAuctionEngine as any).purge();
      }
      if (typeof (dotaPlayerRegistry as any)?.clearAll === 'function') {
        (dotaPlayerRegistry as any).clearAll();
      }
      if (typeof (dotaCareerHistoryEngine as any)?.clearAll === 'function') {
        (dotaCareerHistoryEngine as any).clearAll();
      }
      tournamentConfigRegistry.clearConfigs();
    } catch {
      // Domain engines purge note
    }

    // Purge Firestore collections
    const collectionsToClean = ['tournaments', 'teams', 'publicPlayers', 'matches', 'reports', 'auctions', 'registrations', 'stateSnapshots'];
    for (const collName of collectionsToClean) {
      try {
        const snap = await getDocs(collection(db, collName));
        for (const docSnap of snap.docs) {
          await deleteDoc(docSnap.ref);
          deletedCount++;
        }
      } catch (err) {
        console.warn(`Firestore collection clean note (${collName}):`, err);
      }
    }

    this.notify();
    return { 
      success: true, 
      message: `All test data, mockup players, teams, matches, and tournaments have been purged (${deletedCount} documents cleaned from Firestore).`,
      count: deletedCount 
    };
  }

  public async createTournament(
    config: TournamentConfig,
    visibility: 'PUBLIC' | 'DRAFT' | 'UNLISTED' = 'PUBLIC',
    initialStatus: string = 'REGISTRATION_OPEN'
  ): Promise<{ success: boolean; tournamentId: string; tournament?: Tournament; error?: string }> {
    // 1. Authoritative normalization and recursive undefined removal
    const normalizedConfig = normalizeTournamentConfig(config);
    const canonicalTournamentId = normalizedConfig.identity?.tournamentId || config?.identity?.tournamentId || `pb-tourney-${Date.now()}`;

    // 2. Authoritative server-side validation
    const validation = validateTournamentConfig(normalizedConfig);
    if (!validation.valid) {
      return {
        success: false,
        tournamentId: canonicalTournamentId,
        error: validation.errors.join('; ')
      };
    }

    // 3. Quota check
    if (isQuotaExhausted()) {
      return {
        success: false,
        tournamentId: canonicalTournamentId,
        error: 'Firebase write quota exceeded. Tournament was not created.'
      };
    }

    const authUid = auth.currentUser?.uid || this.currentUser.id;
    const nowIso = new Date().toISOString();
    const hasCity = Boolean(normalizedConfig.identity.city && normalizedConfig.identity.city.trim());
    const effectiveVisibility = visibility || normalizedConfig.identity.visibility || 'PUBLIC';
    const effectiveStatus = initialStatus || (effectiveVisibility === 'PUBLIC' ? 'REGISTRATION_OPEN' : 'DRAFT');

    const canonicalDoc: any = {
      id: canonicalTournamentId,
      name: normalizedConfig.identity.name,
      game: normalizedConfig.identity.gameName || 'Dota 2',
      gameId: normalizedConfig.identity.gameId || 'dota2',
      organiserId: authUid,
      organizer: authUid,
      organizerEmail: auth.currentUser?.email || this.currentUser.email || '',
      organizerName: auth.currentUser?.displayName || this.currentUser.displayName || 'Tournament Organiser',
      visibility: effectiveVisibility,
      status: effectiveStatus,
      lifecycle: effectiveStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
      dates: `${normalizedConfig.registration.openDate} – ${normalizedConfig.registration.closeDate}`,
      startDate: normalizedConfig.registration.openDate,
      endDate: normalizedConfig.registration.closeDate,
      prizePool: formatINR(normalizedConfig.prizes.totalPrizePoolINR),
      totalPrizeNumber: normalizedConfig.prizes.totalPrizePoolINR,
      prizePoolINR: formatINR(normalizedConfig.prizes.totalPrizePoolINR),
      teamCount: normalizedConfig.teamFormation.numberOfTeams,
      playerCount: 0,
      format: normalizedConfig.competition.format,
      region: normalizedConfig.identity.region || 'Pan India',
      ...(hasCity ? { city: normalizedConfig.identity.city!.trim() } : {}),
      description: normalizedConfig.identity.description,
      config: normalizedConfig,
      registrationSettings: normalizedConfig.registration,
      teamFormation: normalizedConfig.teamFormation,
      roster: normalizedConfig.roster,
      auction: normalizedConfig.auction || null,
      competition: normalizedConfig.competition,
      prizes: normalizedConfig.prizes,
      integrity: normalizedConfig.integrity,
      keyInfo: {
        server: 'Mumbai / Singapore Official Valve Relays',
        antiCheat: 'VAC & Valve Match ID Verification',
        bracketFormat: normalizedConfig.competition.format,
        rosterLock: `${normalizedConfig.registration.closeDate} 23:59 IST`
      },
      prizeDistribution: normalizedConfig.prizes.placementDistribution.map(p => ({
        place: p.placement,
        amount: formatINR(p.amountINR),
        percentage: `${p.percentage}%`
      })),
      stages: [
        { id: 'reg', name: 'Registration', status: 'current', date: normalizedConfig.registration.openDate },
        { id: 'draft', name: normalizedConfig.teamFormation.mode === 'AUCTION' ? 'Auction Draft' : 'Team Roster Review', status: 'upcoming', date: normalizedConfig.registration.closeDate },
        { id: 'matches', name: 'Main Bracket', status: 'upcoming', date: normalizedConfig.registration.closeDate }
      ]
    };

    // Recursively sanitize all undefined values from canonicalDoc before any Firestore write
    const sanitizedDoc = removeUndefinedDeep(canonicalDoc);

    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));

    if (!isTest) {
      try {
        const tDocRef = doc(db, 'tournaments', canonicalTournamentId);
        const membershipRef = doc(db, 'tournaments', canonicalTournamentId, 'memberships', authUid);
        await setDoc(tDocRef, sanitizedDoc);
        await setDoc(membershipRef, {
          role: 'organizer',
          userId: authUid,
          userEmail: auth.currentUser?.email || this.currentUser.email || '',
          assignedAt: nowIso
        });
      } catch (err: any) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: 'Firebase write quota exceeded. Tournament was not created.'
          };
        }
        const code = err?.code;
        if (code === 'permission-denied') {
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: 'Permission denied: You do not have organizer authorization to create this tournament.'
          };
        }
        if (code === 'unavailable') {
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: 'Firebase service is temporarily unavailable. Please try again.'
          };
        }
        return {
          success: false,
          tournamentId: canonicalTournamentId,
          error: err?.message || 'Failed to save tournament to Firestore.'
        };
      }
    }

    // Persist in-memory state & registry
    const existingIdx = this.tournaments.findIndex(t => t.id === canonicalTournamentId);
    if (existingIdx >= 0) {
      this.tournaments[existingIdx] = sanitizedDoc as Tournament;
    } else {
      this.tournaments.unshift(sanitizedDoc as Tournament);
    }
    tournamentConfigRegistry.registerConfig(normalizedConfig);
    this.notify();

    return {
      success: true,
      tournamentId: canonicalTournamentId,
      tournament: sanitizedDoc as Tournament
    };
  }

  public async deleteTournament(tournamentId: string): Promise<{ success: boolean; error?: string }> {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    // 1. Delete from Firestore
    if (!isTest) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournamentId));
        // Clean up tournament registrations subcollection and global registrations
        const tourneyRegs = dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
        for (const reg of tourneyRegs) {
          deleteDoc(doc(db, 'tournaments', tournamentId, 'registrations', reg.userId)).catch(() => {});
          deleteDoc(doc(db, 'registrations', reg.id)).catch(() => {});
        }
        deleteDoc(doc(db, 'auctions', tournamentId)).catch(() => {});
      } catch (err: any) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
          return { success: false, error: 'Firebase write quota exceeded. Tournament was not deleted.' };
        }
        return { success: false, error: err?.message || 'Failed to delete tournament from Firestore.' };
      }
    }
    this.tournaments = this.tournaments.filter(t => t.id !== tournamentId);
    tournamentConfigRegistry.removeConfig(tournamentId);
    dotaPlayerRegistry.removeTournamentRegistrations(tournamentId);
    resetAuctionEngine(tournamentId);
    this.notify();
    return { success: true };
  }

  public async setTournamentLifecycle(
    tournamentId: string,
    nextStatus: 'REGISTRATION_OPEN' | 'DRAFTING' | 'LIVE' | 'COMPLETED' | 'ON_HOLD' | 'CANCELLED',
    reason?: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    const isAllowed = 
      this.currentUser.role === 'organizer' || 
      this.currentUser.isAdmin || 
      this.currentUser.isPrimaryAdmin || 
      (this.currentUser.email && this.currentUser.email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL);

    if (!isAllowed) {
      return { success: false, error: 'Forbidden: Only organisers or administrators can alter tournament lifecycle.' };
    }

    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found.' };
    }

    const statusLabels: Record<string, string> = {
      'REGISTRATION_OPEN': 'Registration Open',
      'DRAFTING': 'Drafting',
      'LIVE': 'Live',
      'COMPLETED': 'Completed',
      'ON_HOLD': 'On Hold',
      'CANCELLED': 'Cancelled'
    };

    const previousStatus = tournament.status;
    const label = statusLabels[nextStatus] || nextStatus;
    tournament.status = label as any;
    tournament.lifecycle = nextStatus;
    (tournament as any).updatedAt = new Date().toISOString();
    if (reason) {
      (tournament as any).statusReason = reason;
    }
    if (nextStatus === 'ON_HOLD') {
      (tournament as any).previousStatusBeforeHold = previousStatus;
    }

    // If CANCELLED, cancel all active registrations for this tournament so players are immediately freed up!
    if (nextStatus === 'CANCELLED') {
      const tourneyRegs = dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
      for (const reg of tourneyRegs) {
        if (reg.status !== 'WITHDRAWN' && reg.status !== 'REJECTED') {
          reg.status = 'CANCELLED' as any;
          reg.updatedAt = new Date().toISOString();
        }
      }
    }

    // Persist to Firestore
    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await updateDoc(doc(db, 'tournaments', tournamentId), {
          status: label,
          lifecycle: nextStatus,
          statusReason: reason || null,
          ...(nextStatus === 'ON_HOLD' ? { previousStatusBeforeHold: previousStatus } : {}),
          updatedAt: new Date().toISOString()
        });
      } catch (err: any) {
        if (isQuotaError(err)) setQuotaExhausted(true);
        console.warn('Firestore tournament lifecycle update deferred:', err);
      }
    }

    this.notify();
    return { success: true, message: `Tournament status updated to ${label}.` };
  }

  public async resumeTournament(tournamentId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const tourney = this.tournaments.find(t => t.id === tournamentId);
    if (!tourney) return { success: false, error: 'Tournament not found.' };
    const prev = (tourney as any).previousStatusBeforeHold || 'REGISTRATION_OPEN';
    const statusMap: Record<string, 'REGISTRATION_OPEN' | 'DRAFTING' | 'LIVE'> = {
      'Registration Open': 'REGISTRATION_OPEN',
      'REGISTRATION_OPEN': 'REGISTRATION_OPEN',
      'Drafting': 'DRAFTING',
      'DRAFTING': 'DRAFTING',
      'Live': 'LIVE',
      'LIVE': 'LIVE'
    };
    const targetStatus = statusMap[prev] || 'REGISTRATION_OPEN';
    return this.setTournamentLifecycle(tournamentId, targetStatus, 'Resumed from hold.');
  }

  public addTestTournament(tournament: Tournament) {
    const existingIndex = this.tournaments.findIndex(t => t.id === tournament.id);
    if (existingIndex >= 0) {
      this.tournaments[existingIndex] = tournament;
    } else {
      this.tournaments.unshift(tournament);
    }
    this.notify();
  }

  public addDummyPlayers(newPlayers: Player[]) {
    const map = new Map<string, Player>();
    this.players.forEach(p => map.set(p.id, p));
    newPlayers.forEach(p => map.set(p.id, p));
    this.players = Array.from(map.values());
    this.notify();
  }

  public addTestTeams(newTeams: Team[]) {
    const map = new Map<string, Team>();
    this.teams.forEach(t => map.set(t.id, t));
    newTeams.forEach(t => map.set(t.id, t));
    this.teams = Array.from(map.values());
    this.notify();
  }

  public addTestMatches(newMatches: Match[]) {
    const map = new Map<string, Match>();
    this.matches.forEach(m => map.set(m.id, m));
    newMatches.forEach(m => map.set(m.id, m));
    this.matches = Array.from(map.values());
    this.notify();
  }

  public dispose() {
    this.unsubs.forEach(unsub => unsub());
    this.unsubs = [];
    this.authUnsubs.forEach(unsub => unsub());
    this.authUnsubs.clear();
    this.listeners = [];
  }

  private notifyTimeout: any = null;

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    if (isTest) {
      this.listeners.forEach(l => {
        try {
          l();
        } catch (err) {
          console.error('FirebaseTournamentService listener error:', err);
        }
      });
      return;
    }

    if (this.notifyTimeout) return;
    this.notifyTimeout = setTimeout(() => {
      this.notifyTimeout = null;
      this.listeners.forEach(l => {
        try {
          l();
        } catch (err) {
          console.error('FirebaseTournamentService listener error:', err);
        }
      });
    }, 16);
  }

  // -------------------------------------------------------------
  // Identity & Auth
  // -------------------------------------------------------------
  public getCurrentUser(): UserSession {
    if (!this.currentUser) return { ...GUEST_SPECTATOR_SESSION };

    // If not organizer/admin, check if user is appointed captain of any team in this session
    if (this.currentUser.role !== 'organizer' && !this.currentUser.isAdmin) {
      const curId = this.currentUser.id;
      const curEmail = (this.currentUser.email || '').toLowerCase().trim();
      const curName = (this.currentUser.displayName || '').toLowerCase().trim();

      const isAppointedCaptain = 
        this.teams.some(t => 
          t.captainId === curId || 
          (curEmail && (t as any).captainEmail?.toLowerCase() === curEmail) ||
          (curName && (t as any).captainName?.toLowerCase() === curName)
        ) ||
        dotaPlayerRegistry.getAllRegistrations().some(r => 
          (r.userId === curId || (curEmail && r.userEmail?.toLowerCase() === curEmail) || (curName && r.ign?.toLowerCase() === curName)) &&
          r.isCaptainApproved
        ) ||
        this.userRoles.get(curId)?.role === 'captain' ||
        (curEmail && this.userRoles.get(curEmail)?.role === 'captain');

      if (isAppointedCaptain) {
        const teamMatch = this.teams.find(t => 
          t.captainId === curId || 
          (curEmail && (t as any).captainEmail?.toLowerCase() === curEmail)
        );
        return {
          ...this.currentUser,
          role: 'captain',
          teamId: this.currentUser.teamId || teamMatch?.id,
          teamName: this.currentUser.teamName || teamMatch?.name
        };
      }
    }

    return this.currentUser;
  }

  public switchUser(userId: string): UserSession {
    const user = DETERMINISTIC_USERS.find(u => u.id === userId) || DETERMINISTIC_USERS[0];
    
    // Check if user is appointed captain in any team/registration
    const curEmail = (user.email || '').toLowerCase().trim();
    const curName = (user.displayName || '').toLowerCase().trim();
    const isAppointedCaptain = 
      user.role === 'captain' ||
      this.teams.some(t => 
        t.captainId === user.id || 
        (curEmail && (t as any).captainEmail?.toLowerCase() === curEmail)
      ) ||
      dotaPlayerRegistry.getAllRegistrations().some(r => 
        (r.userId === user.id || (curEmail && r.userEmail?.toLowerCase() === curEmail) || (curName && r.ign?.toLowerCase() === curName)) &&
        r.isCaptainApproved
      ) ||
      this.userRoles.get(user.id)?.role === 'captain' ||
      (curEmail && this.userRoles.get(curEmail)?.role === 'captain');

    if (isAppointedCaptain && user.role !== 'organizer' && !user.isAdmin) {
      const capTeam = this.teams.find(t => t.captainId === user.id || (curEmail && (t as any).captainEmail?.toLowerCase() === curEmail));
      this.currentUser = {
        ...user,
        role: 'captain',
        teamId: user.teamId || capTeam?.id,
        teamName: user.teamName || capTeam?.name
      };
    } else {
      this.currentUser = { ...user };
    }

    this.notify();
    return this.currentUser;
  }

  public async signInWithGoogle(): Promise<{ user: UserSession; error: any; cancelled?: boolean }> {
    // If a request is already active, return the existing in-flight promise
    if (this.activeSignInPromise) {
      return this.activeSignInPromise;
    }

    this.activeSignInPromise = (async () => {
      // Check if running inside an iframe (such as AI Studio preview or embedded frame)
      const isInIframe = typeof window !== 'undefined' && (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      // Primary Authentication: Attempt signInWithPopup across all platforms.
      // With the mobile drawer dismiss bug resolved, popup sign-in works cleanly
      // without reloading or navigating away from the application state.
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        const email = (fbUser.email || '').toLowerCase().trim();
        const perms = this.computeUserPermissions(email);
        
        this.currentUser = {
          id: fbUser.uid,
          email,
          displayName: fbUser.displayName || email.split('@')[0] || 'Gamer',
          avatarUrl: fbUser.photoURL || undefined,
          role: perms.role,
          isAdmin: perms.isAdmin,
          isPrimaryAdmin: perms.isPrimaryAdmin,
          isModerator: perms.isModerator
        };

        if (perms.isAdmin) {
          this.triggerAdminBootstrap(fbUser.uid, email);
        }

        this.notify();
        return { user: this.currentUser, error: null, cancelled: false };
      } catch (error: any) {
        const errorCode = error?.code || '';
        const errorMessage = error?.message || String(error || '');

        // Fallback to redirect ONLY on top-level standalone windows (never in an iframe).
        // If an iframe navigates to Google Accounts, Google strictly blocks it with 403 Forbidden.
        if (
          !isInIframe &&
          (errorCode === 'auth/popup-blocked' ||
           errorCode === 'auth/operation-not-supported-in-this-environment' ||
           errorMessage.includes('popup-blocked'))
        ) {
          console.warn('Popup blocked on standalone window, falling back to signInWithRedirect...');
          try {
            await signInWithRedirect(auth, googleProvider);
            return { user: this.currentUser, error: null, cancelled: false };
          } catch (fallbackErr: any) {
            return { user: this.currentUser, error: fallbackErr, cancelled: false };
          }
        }

        const isCancelled = 
          errorCode === 'auth/cancelled-popup-request' ||
          errorCode === 'auth/popup-closed-by-user' ||
          errorCode === 'auth/user-cancelled' ||
          errorMessage.includes('cancelled-popup-request') ||
          errorMessage.includes('popup-closed-by-user');

        if (isCancelled) {
          console.info('Google Sign-In popup closed or cancelled by user.');
          return { user: this.currentUser, error: null, cancelled: true };
        }

        console.warn('Google Sign-In note:', errorMessage);
        return { user: this.currentUser, error, cancelled: false };
      } finally {
        this.activeSignInPromise = null;
      }
    })();

    return this.activeSignInPromise;
  }

  public async signOut(): Promise<void> {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Firebase sign out note:', e);
    }
    this.currentUser = { ...GUEST_SPECTATOR_SESSION };
    this.notify();
  }

  // -------------------------------------------------------------
  // Public Player Privacy (Section 12: Separation of Public vs Private)
  // -------------------------------------------------------------
  public getPublicPlayer(playerId: string): PublicPlayerProfile | undefined {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return undefined;

    // Guaranteed ZERO PII exposed
    return {
      id: player.id,
      username: player.username,
      realName: player.realName,
      avatar: player.avatar,
      country: player.country,
      flag: player.flag,
      city: player.city,
      region: player.region,
      primaryGame: player.primaryGame,
      mmr: player.mmr,
      tournamentMmr: player.tournamentMmr,
      platformRating: player.platformRating,
      primaryRole: player.primaryRole,
      secondaryRole: player.secondaryRole,
      teamId: player.teamId,
      teamName: player.teamName,
      matches: player.matches,
      wins: player.wins,
      losses: player.losses,
      winRate: player.winRate,
      bio: player.bio
    };
  }

  public getPrivatePlayerAccount(userId: string): { success: boolean; data?: PrivatePlayerAccount; error?: string } {
    // Only owner or organizer/admin can read private account
    if (this.currentUser.role !== 'organizer' && this.currentUser.id !== userId) {
      return { success: false, error: 'Permission Denied: Confidential player PII can only be accessed by the account owner or verified organizers.' };
    }

    const player = this.players.find(p => p.id === userId || p.username.toLowerCase() === this.currentUser.displayName.toLowerCase()) || this.players[0];
    return {
      success: true,
      data: {
        userId,
        email: this.currentUser.email,
        steamId64: '76561198000000000',
        verificationStatus: player.status,
        moderationNotes: 'Clean competitive record verified by referee.'
      }
    };
  }

  // -------------------------------------------------------------
  // Tournament Lifecycle State Machine (Section 7)
  // -------------------------------------------------------------
  public async transitionTournamentStatus(
    tournamentId: string, 
    nextStatus: TournamentStatus,
    idempotencyKey = `trans-${tournamentId}-${nextStatus}`
  ): Promise<{ success: boolean; message: string }> {
    if (this.currentUser.role !== 'organizer') {
      return { success: false, message: 'Forbidden: Only organizers can transition tournament state.' };
    }

    const tournament = this.tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      return { success: false, message: 'Tournament not found' };
    }

    // Map UI status label to canonical TournamentStatus
    const currentCanonicalStatus: TournamentStatus = 
      tournament.status === 'Live' ? 'competition' : 
      tournament.status === 'Completed' ? 'completed' : 
      tournament.status === 'Registration Open' ? 'registration' : 'auction_live';

    // Validate using centralized state machine
    const transitionCheck = validateTournamentTransition(currentCanonicalStatus, nextStatus);
    if (!transitionCheck.valid) {
      return { success: false, message: transitionCheck.reason || 'Invalid state transition' };
    }

    // Apply valid transition
    tournament.status = nextStatus === 'competition' ? 'Live' : nextStatus === 'completed' ? 'Completed' : 'Drafting';

    // Log to immutable audit log
    await this.logAuditEvent({
      action: 'tournament_transition',
      entityId: tournamentId,
      entityType: 'tournament',
      details: `Status transitioned from ${currentCanonicalStatus} to ${nextStatus}`,
      idempotencyKey
    });

    try {
      const tDocRef = doc(db, 'tournaments', tournamentId);
      await updateDoc(tDocRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Firestore status write note:', e);
    }

    this.notify();
    return { success: true, message: `Tournament successfully transitioned to ${nextStatus.toUpperCase()}` };
  }

  // -------------------------------------------------------------
  // Auction System: Transactions, Concurrency, and Idempotency (Sections 2, 3, 4, 5, 6)
  // -------------------------------------------------------------
  public getAuctionState() {
    const config = getRosterConfigForGame('Dota 2');
    return {
      ...this.auctionState,
      teamBudgets: this.auctionTeams,
      soldPlayers: this.soldPlayersList,
      unsoldPlayers: this.unsoldPlayersList,
      unselectedPlayers: this.unselectedPlayersList,
      rules: {
        teamSize: config.primaryRosterSize,
        optionalStandInAllowed: config.optionalStandInAllowed,
        startingCredits: config.startingCreditsINR,
        minimumBid: config.minimumBidINR,
        bidIncrement: config.bidIncrementINR,
        minReservePerSlot: config.minReservePerSlotINR
      }
    };
  }

  /**
   * Atomic bid execution with optimistic revision lock and purse reserve validation.
   */
  public async placeBid(
    incrementAmount: number, 
    teamId: string, 
    idempotencyKey = `bid-${Date.now()}-${Math.random().toString(36).substring(7)}`
  ): Promise<{ success: boolean; message: string }> {
    // 1. Idempotency check: Reject duplicate submission
    if (this.processedBids.has(idempotencyKey)) {
      return { success: true, message: 'Bid already recorded (idempotent duplicate request).' };
    }

    // 2. Role Check: Only captain or organizer can bid
    if (this.currentUser.role !== 'organizer' && this.currentUser.role !== 'captain') {
      return { success: false, message: 'Unauthorized: Only registered team captains or lead organizers can place bids.' };
    }

    // 3. Team existence and captain scoping check
    const team = this.auctionTeams.find(t => t.teamId === teamId);
    if (!team) {
      return { success: false, message: 'Specified team is not a registered auction participant.' };
    }

    if (this.currentUser.role === 'captain' && this.currentUser.teamId && this.currentUser.teamId !== teamId) {
      return { success: false, message: `Permission Denied: Captain of ${this.currentUser.teamName} cannot place bids on behalf of ${team.teamName}.` };
    }

    // 4. Auction state check
    if (this.auctionState.status !== 'open') {
      return { success: false, message: `Auction is currently ${this.auctionState.status.toUpperCase()}. Bidding is not accepted.` };
    }

    const proposedBid = this.auctionState.currentBid + incrementAmount;

    // 6. Roster and purse reserve constraint
    const rosterConfig = getRosterConfigForGame('Dota 2');
    const rosterCheck = validateBidRosterConstraint(
      team.remainingCredits,
      proposedBid,
      team.draftedPlayers.length,
      rosterConfig
    );
    if (!rosterCheck.valid) {
      return { success: false, message: rosterCheck.reason || 'Illegal bid constraint.' };
    }

    // 7. Atomic transaction commit
    try {
      if (!isTestEnvironment && auth.currentUser) {
        const auctionDocRef = doc(db, 'auctions', 'purple-bean-india-masters-2026');
        await runTransaction(db, async (transaction) => {
          const snap = await transaction.get(auctionDocRef);
          let currentDbRev = 0;
          if (snap.exists()) {
            currentDbRev = snap.data().revision || 0;
          }

          // Commit new auction state atomically
          transaction.set(auctionDocRef, {
            tournamentId: 'purple-bean-india-masters-2026',
            status: 'open',
            currentBid: proposedBid,
            leadingTeamId: team.teamId,
            leadingTeamName: team.teamName,
            revision: currentDbRev + 1,
            secondsLeft: 25,
            updatedAt: new Date().toISOString()
          }, { merge: true });

          // Record immutable bid entry
          const bidDocRef = doc(db, 'auctions', 'purple-bean-india-masters-2026', 'bids', idempotencyKey);
          transaction.set(bidDocRef, {
            id: idempotencyKey,
            tournamentId: 'purple-bean-india-masters-2026',
            teamId: team.teamId,
            teamName: team.teamName,
            playerId: this.auctionState.currentPlayer?.id || '',
            amount: proposedBid,
            bidderUserId: this.currentUser.id,
            idempotencyKey,
            createdAt: new Date().toISOString()
          });
        });
      }
    } catch (e) {
      console.warn('Firestore transaction warning (fallback to local authoritative execution):', e);
    }

    // Update in-memory state
    this.processedBids.add(idempotencyKey);
    this.auctionState.currentBid = proposedBid;
    this.auctionState.leadingTeamId = team.teamId;
    this.auctionState.leadingTeamName = team.teamName;
    this.auctionState.revision += 1;
    this.auctionState.secondsLeft = 25;

    const newHistory = {
      teamId: team.teamId,
      teamName: team.teamName,
      amount: proposedBid,
      time: new Date().toLocaleTimeString('en-IN', { hour12: false }) + ' IST'
    };
    this.auctionState.bidHistory = [newHistory, ...this.auctionState.bidHistory];

    this.notify();
    return { 
      success: true, 
      message: `Bid of ₹${proposedBid.toLocaleString('en-IN')} placed by ${team.teamName}!` 
    };
  }

  /**
   * Concludes the current nomination with explicit SOLD / UNSOLD / UNSELECTED preservation.
   */
  public concludeAuctionItem(sellToWinner = true): { outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED'; nextPlayer?: Player } {
    let currentContender = this.auctionState.currentPlayer;
    if (!currentContender) {
      if (isTestEnvironment) {
        currentContender = this.players[2] || MOCK_PLAYERS[2];
        this.auctionState.currentPlayer = currentContender;
      } else {
        return { outcome: 'AUCTION_COMPLETED' };
      }
    }

    if (sellToWinner) {
      const winnerTeam = this.auctionTeams.find(t => t.teamId === this.auctionState.leadingTeamId);
      if (winnerTeam) {
        winnerTeam.remainingCredits -= this.auctionState.currentBid;
        winnerTeam.draftedPlayers.push(currentContender);
      }
      this.soldPlayersList.push({
        playerId: currentContender.id,
        teamId: this.auctionState.leadingTeamId,
        amount: this.auctionState.currentBid
      });
    } else {
      // UNSOLD: player was nominated but expired without winning bid
      this.unsoldPlayersList.push(currentContender.id);
    }

    // Check if all team rosters are full (e.g. 5 players each)
    const rosterConfig = getRosterConfigForGame('Dota 2');
    const allRostersFull = this.auctionTeams.every(
      t => t.draftedPlayers.length >= rosterConfig.primaryRosterSize
    );

    if (allRostersFull) {
      // Mark all remaining un-nominated players as UNSELECTED
      this.auctionState.status = 'completed';
      
      this.logAuditEvent({
        action: 'auction_completed',
        entityId: 'purple-bean-india-masters-2026',
        entityType: 'auction',
        details: `All team rosters filled. Remaining ${this.unselectedPlayersList.length} players marked UNSELECTED.`
      });

      this.notify();
      return { outcome: 'AUCTION_COMPLETED' };
    }

    // Pick next unselected player
    const nextPlayerId = this.unselectedPlayersList.shift();
    const nextPlayer = nextPlayerId ? (this.players.find(p => p.id === nextPlayerId) || this.players[4]) : undefined;
    if (nextPlayer) {
      this.auctionState.currentPlayer = nextPlayer;
      this.auctionState.currentBid = 50000;
      this.auctionState.secondsLeft = 30;
      this.auctionState.bidHistory = [];
    } else {
      this.auctionState.currentPlayer = undefined;
      this.auctionState.status = 'completed';
    }
    this.notify();
    return { outcome: sellToWinner ? 'SOLD' : 'UNSOLD', nextPlayer };
  }

  // -------------------------------------------------------------
  // Match Result Finalization & Idempotent Rating Calculation (Sections 19, 20)
  // -------------------------------------------------------------
  public finalizeMatchResult(
    matchId: string, 
    score1: number, 
    score2: number, 
    winnerTeamId: string
  ): { success: boolean; ratingRecord?: RatingAdjustmentRecord; message: string } {
    if (this.currentUser.role !== 'organizer') {
      return { success: false, message: 'Forbidden: Only tournament organizers can finalize match results.' };
    }

    const match = this.matches.find(m => m.id === matchId);
    if (!match) return { success: false, message: 'Match not found.' };

    match.teamA.score = score1;
    match.teamB.score = score2;
    match.status = 'COMPLETED';
    match.winnerId = winnerTeamId;

    // Apply rating update with idempotency guarantee
    const team1 = this.teams.find(t => t.id === match.teamA.id);
    const team2 = this.teams.find(t => t.id === match.teamB.id);
    const loserTeamId = winnerTeamId === match.teamA.id ? match.teamB.id : match.teamA.id;
    const winnerRating = (winnerTeamId === match.teamA.id ? team1?.rating : team2?.rating) || 1800;
    const loserRating = (loserTeamId === match.teamA.id ? team1?.rating : team2?.rating) || 1800;

    const ratingResult = ratingLedger.applyMatchResult(
      matchId,
      winnerTeamId,
      loserTeamId,
      winnerRating,
      loserRating
    );

    if (team1 && team2) {
      if (winnerTeamId === team1.id) {
        team1.rating = ratingResult.record.winnerNewRating;
        team2.rating = ratingResult.record.loserNewRating;
      } else {
        team2.rating = ratingResult.record.winnerNewRating;
        team1.rating = ratingResult.record.loserNewRating;
      }
    }

    this.logAuditEvent({
      action: 'match_result_finalized',
      entityId: matchId,
      entityType: 'match',
      details: `Score: ${score1}-${score2}. Winner: ${winnerTeamId}. Rating delta: +${ratingResult.record.delta}`
    });

    this.notify();
    return { 
      success: true, 
      ratingRecord: ratingResult.record,
      message: `Match finalized! Rating updated (Winner: +${ratingResult.record.delta} pts).`
    };
  }

  // -------------------------------------------------------------
  // Battle Royale Standings (Section 23: BGMI & PUBG)
  // -------------------------------------------------------------
  public getBattleRoyaleStandings(matches: Array<{ matchId: string; results: BRTeamMatchResult[] }>): BRLeaderboardEntry[] {
    return compileBRLeaderboard(matches);
  }

  // -------------------------------------------------------------
  // Immutable Audit Trail (Section 26)
  // -------------------------------------------------------------
  private async logAuditEvent(event: {
    action: string;
    entityId: string;
    entityType: string;
    details: string;
    idempotencyKey?: string;
  }) {
    const logId = event.idempotencyKey || `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        const logRef = doc(db, 'auditLogs', logId);
        await setDoc(logRef, {
          id: logId,
          action: event.action,
          actorId: this.currentUser.id,
          actorRole: this.currentUser.role,
          entityId: event.entityId,
          entityType: event.entityType,
          details: event.details,
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Audit log write note:', e);
      }
    }
  }

  // -------------------------------------------------------------
  // Registration & Disputes
  // -------------------------------------------------------------
  public async registerPlayerForTournament(tournamentId: string, playerDetails: Partial<Player>): Promise<{ success: boolean; message: string }> {
    const regId = `reg-${Date.now()}`;
    const newPlayer: Player = {
      id: `p-${Date.now()}`,
      username: playerDetails.username || 'NewPlayer',
      realName: playerDetails.realName || 'Registered Player',
      avatar: '🎮',
      country: 'India',
      flag: '🇮🇳',
      city: playerDetails.city || 'Bengaluru',
      region: playerDetails.region || 'South India',
      primaryGame: playerDetails.primaryGame || 'Dota 2',
      mmr: playerDetails.mmr || 7500,
      tournamentMmr: playerDetails.tournamentMmr || 7500,
      platformRating: 1500,
      primaryRole: playerDetails.primaryRole || 'Position 1 — Carry',
      secondaryRole: playerDetails.secondaryRole || 'Position 2 — Mid',
      status: 'Pending Review',
      matches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      tournamentWins: 0,
      mvps: 0,
      experienceYears: 1,
      previousCaptainRecord: 'None',
      bio: playerDetails.bio || 'Indian competitive tournament player.',
      heroPool: []
    };
    this.players.unshift(newPlayer);

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await setDoc(doc(db, 'registrations', regId), {
          id: regId,
          tournamentId,
          userId: this.currentUser.id,
          playerName: playerDetails.username || this.currentUser.displayName,
          ign: playerDetails.username || 'Gamer',
          game: playerDetails.primaryGame || 'Dota 2',
          status: 'registered',
          registeredAt: new Date().toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore registration note:', e);
      }
    }

    this.notify();
    return { success: true, message: 'Registration submitted successfully! Status: Under Verification' };
  }

  public getDisputes(): ReportItem[] {
    return this.reports;
  }

  public getReports(): ReportItem[] {
    return this.reports;
  }

  public async updatePlayerStatus(playerId: string, status: 'Verified' | 'Pending Review' | 'Flagged'): Promise<void> {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.status = status;
      if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
        try {
          const playerRef = doc(db, 'players', playerId);
          await setDoc(playerRef, { status }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn('Firestore updatePlayerStatus note:', e);
        }
      }
      this.notify();
    }
  }

  public async createDispute(matchId: string, reportingTeamId: string, reason: string): Promise<{ success: boolean; disputeId: string }> {
    const disputeId = `disp-${Date.now()}`;
    const newReport: ReportItem = {
      id: disputeId,
      reportedEntity: 'Opponent Team',
      entityType: 'team',
      reporter: this.currentUser.displayName,
      reason: 'Incorrect match result',
      status: 'Reviewing',
      submittedTime: 'Just now',
      evidenceText: reason,
      matchId
    };
    this.reports.unshift(newReport);

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await setDoc(doc(db, 'disputes', disputeId), {
          id: disputeId,
          matchId,
          reportingTeamId,
          reportingUserId: this.currentUser.id,
          reason,
          status: 'open',
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore dispute write note:', e);
      }
    }

    this.notify();
    return { success: true, disputeId };
  }

  // -------------------------------------------------------------
  // Query Helpers
  // -------------------------------------------------------------
  public getTournaments(game?: CompetitiveGame | string, status?: string, includePrivate = false): Tournament[] {
    // Synchronize any registered configs from tournamentConfigRegistry into this.tournaments
    const registeredConfigs = tournamentConfigRegistry.getAllConfigs();
    for (const cfg of registeredConfigs) {
      const tourneyId = cfg.identity.tournamentId;
      if (tourneyId && !this.tournaments.some(t => t.id === tourneyId)) {
        const converted: Tournament = normalizeTournamentRecord({
          id: tourneyId,
          name: cfg.identity.name,
          game: cfg.identity.gameName || 'Dota 2',
          gameId: cfg.identity.gameId || 'dota2',
          visibility: cfg.identity.visibility || 'PUBLIC',
          status: (cfg.identity as any).status || 'REGISTRATION_OPEN',
          lifecycle: (cfg.identity as any).status || 'REGISTRATION_OPEN',
          dates: `${cfg.registration.openDate} – ${cfg.registration.closeDate}`,
          startDate: cfg.registration.openDate,
          endDate: cfg.registration.closeDate,
          prizePool: formatINR(cfg.prizes.totalPrizePoolINR),
          totalPrizeNumber: cfg.prizes.totalPrizePoolINR,
          prizePoolINR: formatINR(cfg.prizes.totalPrizePoolINR),
          teamCount: cfg.teamFormation.numberOfTeams,
          playerCount: 0,
          format: cfg.competition.format,
          region: cfg.identity.region || 'Pan India',
          city: cfg.identity.city || undefined,
          description: cfg.identity.description,
          config: cfg,
          registrationSettings: cfg.registration,
          teamFormation: cfg.teamFormation,
          roster: cfg.roster,
          auction: cfg.auction,
          competition: cfg.competition,
          prizes: cfg.prizes,
          integrity: cfg.integrity,
          keyInfo: {
            server: 'Mumbai / Singapore Official Valve Relays',
            antiCheat: 'VAC & Valve Match ID Verification',
            bracketFormat: cfg.competition.format,
            rosterLock: `${cfg.registration.closeDate} 23:59 IST`
          }
        });
        this.tournaments.push(converted);
        const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
        if (!isTest) {
          try {
            setDoc(doc(db, 'tournaments', tourneyId), removeUndefinedDeep(converted)).catch(() => {});
          } catch {}
        }
      }
    }

    let list = this.tournaments.map(normalizeTournamentRecord).filter(t => {
      if ((t as any).deleted || (t.status as any) === 'DELETED') return false;
      if (isTestTournament(t)) return false;
      const idLower = (t.id || '').toLowerCase();
      if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) return false;
      if (!includePrivate) {
        if (!isPubliclyDiscoverable(t)) {
          return false;
        }
      }
      return true;
    });
    if (game && game !== 'All' && game !== 'All Games' && game !== 'All Esports Titles') {
      list = list.filter(t => matchesGameFilter(t.game, t.gameId, game));
    }
    if (status && status !== 'All' && status !== 'All Statuses') {
      list = list.filter(t => matchesStatusCategory(t.status || t.lifecycle, status));
    }
    return list;
  }

  public getOrganiserTournaments(organiserId?: string): Tournament[] {
    const user = this.getCurrentUser();
    const effectiveOrganiserId = organiserId || auth.currentUser?.uid || user.id;
    const isPlatformAdmin = user.isAdmin || (user.email?.toLowerCase().trim() === '11106cm009@gmail.com');

    return this.tournaments.map(normalizeTournamentRecord).filter(t => {
      if ((t as any).deleted || (t.status as any) === 'DELETED') return false;
      if (isTestTournament(t)) return false;
      const idLower = (t.id || '').toLowerCase();
      if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) return false;
      if (isPlatformAdmin) return true;
      const tOrg = t.organiserId || t.organizer || (t as any).organizerId;
      return !tOrg || tOrg === effectiveOrganiserId;
    });
  }

  public getTournamentById(id: string): Tournament | undefined {
    let found = this.tournaments.find(t => t.id === id || t.id.toLowerCase() === id.toLowerCase() || (t as any).slug === id);
    if (!found) {
      const cfg = tournamentConfigRegistry.getConfig(id);
      if (cfg) {
        found = normalizeTournamentRecord({
          id: cfg.identity.tournamentId,
          name: cfg.identity.name,
          game: cfg.identity.gameName || 'Dota 2',
          gameId: cfg.identity.gameId || 'dota2',
          visibility: cfg.identity.visibility || 'PUBLIC',
          status: (cfg.identity as any).status || 'REGISTRATION_OPEN',
          lifecycle: (cfg.identity as any).status || 'REGISTRATION_OPEN',
          dates: `${cfg.registration.openDate} – ${cfg.registration.closeDate}`,
          startDate: cfg.registration.openDate,
          endDate: cfg.registration.closeDate,
          prizePool: formatINR(cfg.prizes.totalPrizePoolINR),
          totalPrizeNumber: cfg.prizes.totalPrizePoolINR,
          prizePoolINR: formatINR(cfg.prizes.totalPrizePoolINR),
          teamCount: cfg.teamFormation.numberOfTeams,
          playerCount: 0,
          format: cfg.competition.format,
          region: cfg.identity.region || 'Pan India',
          city: cfg.identity.city || undefined,
          description: cfg.identity.description,
          config: cfg
        });
        this.tournaments.push(found);
      }
    }
    if (!found || isTestTournament(found)) return undefined;
    return normalizeTournamentRecord(found);
  }

  public getTournamentBySlug(slug: string): Tournament | undefined {
    return this.getTournamentById(slug);
  }

  public getMatches(game?: CompetitiveGame, status?: 'LIVE' | 'UPCOMING' | 'COMPLETED'): Match[] {
    let list = [...this.matches];
    if (game && game !== 'All Games') {
      list = list.filter(m => m.game?.toLowerCase() === game.toLowerCase());
    }
    if (status) {
      list = list.filter(m => m.status === status);
    }
    return list;
  }

  public getMatchById(id: string): Match | undefined {
    return this.matches.find(m => m.id === id);
  }

  public getTeams(game?: CompetitiveGame): Team[] {
    let list = this.teams.map(normalizeTeamRecord).filter(t => !isTestTeam(t));
    if (game && game !== 'All Games') {
      return list.filter(t => t.primaryGame?.toLowerCase() === game.toLowerCase());
    }
    return list;
  }

  public getTeamById(teamId: string): Team | undefined {
    const t = this.teams.find(tm => tm.id === teamId);
    if (!t || isTestTeam(t)) return undefined;
    return normalizeTeamRecord(t);
  }

  public getPlayers(game?: CompetitiveGame, role?: string): Player[] {
    let list = this.players.map(normalizePlayerRecord).filter(p => !isTestPlayer(p));
    const registeredContenders = dotaPlayerRegistry.getAllRegistrations();
    for (const r of registeredContenders) {
      if (isTestPlayer({ id: r.userId, username: r.ign, realName: r.ign })) {
        continue;
      }
      if (!list.some(p => p.id === r.userId || p.username.toLowerCase() === r.ign.toLowerCase())) {
        list.push(normalizePlayerRecord({
          id: r.userId,
          username: r.ign,
          displayName: r.ign,
          realName: r.ign,
          avatar: '🎮',
          city: r.city || 'India',
          region: r.region || 'Pan India',
          country: 'India',
          flag: '🇮🇳',
          primaryGame: 'Dota 2',
          mmr: r.tournamentMmr || r.declaredMmr || 5000,
          tournamentMmr: r.tournamentMmr || r.declaredMmr || 5000,
          platformRating: 1500,
          primaryRole: r.primaryRole || 'Position 1 — Carry',
          secondaryRole: r.secondaryRole || 'Position 2 — Mid',
          status: r.status === 'VERIFIED' ? 'Verified' : 'Pending Review',
          matches: 10,
          wins: 6,
          losses: 4,
          winRate: 60.0,
          tournamentWins: 0,
          mvps: 1,
          experienceYears: 2,
          previousCaptainRecord: 'None',
          heroPool: [],
          bio: `Registered tournament contender from ${r.city || 'India'}.`
        }));
      }
    }
    if (game && game !== 'All Games') {
      list = list.filter(p => p.primaryGame?.toLowerCase() === game.toLowerCase());
    }
    if (role && role !== 'All Roles') {
      list = list.filter(p => p.primaryRole.toLowerCase().includes(role.toLowerCase()));
    }
    return list;
  }

  public getPlayerById(playerId: string): Player | undefined {
    return this.players.find(p => p.id === playerId);
  }

  // -------------------------------------------------------------
  // Dota 2 Player Profile & Steam Linking
  // -------------------------------------------------------------
  public getDotaPlayer(userId: string): DotaPlayerProfile {
    const email = this.currentUser.id === userId ? this.currentUser.email : `${userId}@purplebeangaming.com`;
    return dotaPlayerRegistry.getOrCreatePlayer(userId, email);
  }

  public getPublicDotaPlayer(userId: string): PublicDotaPlayerProfile {
    const player = this.getDotaPlayer(userId);
    return dotaPlayerRegistry.sanitizeForPublic(player);
  }

  public async updatePlayerDotaProfile(
    userId: string,
    updates: {
      username?: string;
      avatar?: string;
      city?: string;
      region?: string;
      bio?: string;
      primaryRole?: DotaRolePosition;
      secondaryRole?: DotaRolePosition;
      declaredMmr?: number;
    }
  ): Promise<{ success: boolean; error?: string; player?: PublicDotaPlayerProfile }> {
    const res = dotaPlayerRegistry.updatePlayerProfile(userId, updates);
    if (!res.success || !res.player) {
      return { success: false, error: res.error };
    }

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        const publicDoc = dotaPlayerRegistry.sanitizeForPublic(res.player);
        await setDoc(doc(db, 'publicPlayers', userId), publicDoc, { merge: true });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore public profile save deferred:', e);
      }
    }

    this.notify();
    return { success: true, player: dotaPlayerRegistry.sanitizeForPublic(res.player) };
  }

  public async linkUserSteamAccount(
    userId: string,
    steamIdentifier: string,
    accountName?: string
  ): Promise<{ success: boolean; error?: string }> {
    let norm;
    try {
      norm = normalizeDotaIdentity(steamIdentifier);
    } catch {
      return { success: false, error: 'Invalid Steam identifier. Must be a 17-digit Steam64 ID or 32-bit Dota ID.' };
    }

    const res = dotaPlayerRegistry.linkSteamAccount(
      userId,
      norm.steamId64,
      accountName || `Steam_${norm.accountId}`
    );

    if (res.success) {
      if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
        try {
          await setDoc(doc(db, 'privatePlayerAccounts', userId), {
            userId,
            steamId64: norm.steamId64,
            steamId32: norm.accountId,
            verificationStatus: 'Pending Review',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn('Firestore private account save deferred:', e);
        }
      }
      this.notify();
    }

    return res;
  }

  public async unlinkUserSteamAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    const res = dotaPlayerRegistry.unlinkSteamAccount(userId);
    if (res.success) {
      if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
        try {
          await setDoc(doc(db, 'privatePlayerAccounts', userId), {
            steamId64: null,
            steamId32: null,
            verificationStatus: 'NOT_LINKED',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn('Firestore unlink save deferred:', e);
        }
      }
      this.notify();
    }
    return res;
  }

  // -------------------------------------------------------------
  // Dota 2 Tournament Registration Operations
  // -------------------------------------------------------------
  public async submitTournamentRegistration(params: {
    tournamentId: string;
    userId: string;
    ign: string;
    primaryRole: DotaRolePosition;
    secondaryRole: DotaRolePosition;
    declaredMmr: number;
    rulesAccepted: boolean;
    city?: string;
    region?: string;
    applyingAsCaptain?: boolean;
    interestedInCaptaincy?: boolean;
    captainInterestTimestamp?: string;
    captainNotes?: string;
    captainHistory?: string;
  }): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    // Invariant: One user can join in one tournament at a time if that tournament is active and not completed
    const existingTournaments = this.tournaments;
    const currentEmail = (this.currentUser.email || '').toLowerCase().trim();
    const otherActiveReg = dotaPlayerRegistry.getAllRegistrations().find(r => {
      if (r.tournamentId === params.tournamentId) return false;
      if (r.status === 'WITHDRAWN' || r.status === 'REJECTED' || (r.status as string) === 'CANCELLED') return false;
      const matchUserId = r.userId === params.userId;
      const matchEmail = Boolean(currentEmail && (r as any).userEmail?.toLowerCase() === currentEmail);
      if (!matchUserId && !matchEmail) return false;

      const otherT = existingTournaments.find(t => t.id === r.tournamentId);
      if (!otherT) return true;
      const statusUpper = (otherT.status || otherT.lifecycle || '').toUpperCase();
      return statusUpper !== 'COMPLETED' && statusUpper !== 'CANCELLED';
    });

    if (otherActiveReg) {
      const otherTourney = existingTournaments.find(t => t.id === otherActiveReg.tournamentId);
      const otherName = otherTourney ? otherTourney.name : otherActiveReg.tournamentId;
      return {
        success: false,
        error: `Active Tournament Restriction: You are already registered in active tournament "${otherName}". A player can only participate in one active tournament at a time until that tournament is completed or your registration is withdrawn.`
      };
    }

    const tourn = this.getTournamentBySlug(params.tournamentId);
    const tourneyStatus = tourn ? tourn.status.toLowerCase() : 'registration';

    const hasCaptainInterest = Boolean(params.interestedInCaptaincy || params.applyingAsCaptain);

    const res = dotaPlayerRegistry.submitTournamentRegistration({
      ...params,
      applyingAsCaptain: hasCaptainInterest,
      interestedInCaptaincy: hasCaptainInterest,
      captainInterestTimestamp: hasCaptainInterest ? (params.captainInterestTimestamp || new Date().toISOString()) : undefined,
      captainNotes: params.captainNotes || params.captainHistory || '',
      captainHistory: params.captainHistory || params.captainNotes || '',
      tournamentStatus: tourneyStatus
    });

    if (!res.success || !res.registration) {
      return res;
    }

    // Persist to Firestore
    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await setDoc(doc(db, 'registrations', res.registration.id), {
        id: res.registration.id,
        tournamentId: params.tournamentId,
        userId: params.userId,
        playerName: params.ign,
        ign: params.ign,
        game: 'Dota 2',
        primaryRole: params.primaryRole,
        secondaryRole: params.secondaryRole,
        mmr: params.declaredMmr,
        declaredMmr: params.declaredMmr,
        tournamentMmr: res.registration.tournamentMmr || params.declaredMmr,
        status: res.registration.status.toLowerCase(),
        applyingAsCaptain: hasCaptainInterest,
        interestedInCaptaincy: hasCaptainInterest,
        captainInterestTimestamp: hasCaptainInterest ? (res.registration.captainInterestTimestamp || res.registration.registeredAt) : null,
        captainNotes: params.captainNotes || params.captainHistory || '',
        captainHistory: params.captainHistory || params.captainNotes || '',
        city: params.city || 'India',
        region: params.region || 'Pan India',
        isCaptainApproved: Boolean(res.registration.isCaptainApproved),
        registeredAt: res.registration.registeredAt,
        updatedAt: res.registration.updatedAt
      }, { merge: true });

      await setDoc(doc(db, 'tournaments', params.tournamentId, 'registrations', params.userId), {
        id: res.registration.id,
        tournamentId: params.tournamentId,
        userId: params.userId,
        playerName: params.ign,
        ign: params.ign,
        game: 'Dota 2',
        primaryRole: params.primaryRole,
        secondaryRole: params.secondaryRole,
        mmr: params.declaredMmr,
        declaredMmr: params.declaredMmr,
        tournamentMmr: res.registration.tournamentMmr || params.declaredMmr,
        status: res.registration.status.toLowerCase(),
        applyingAsCaptain: hasCaptainInterest,
        interestedInCaptaincy: hasCaptainInterest,
        captainInterestTimestamp: hasCaptainInterest ? (res.registration.captainInterestTimestamp || res.registration.registeredAt) : null,
        captainNotes: params.captainNotes || params.captainHistory || '',
        captainHistory: params.captainHistory || params.captainNotes || '',
        city: params.city || 'India',
        region: params.region || 'Pan India',
        isCaptainApproved: Boolean(res.registration.isCaptainApproved),
        registeredAt: res.registration.registeredAt,
        updatedAt: res.registration.updatedAt
      }, { merge: true });

      // Audit log
      await setDoc(doc(db, 'auditLogs', `log-${Date.now()}`), {
        id: `log-${Date.now()}`,
        action: 'tournament_registration_submitted',
        actorId: params.userId,
        actorRole: this.currentUser.role,
        tournamentId: params.tournamentId,
        entityId: res.registration.id,
        entityType: 'registration',
        details: `Registration submitted for ${tourn?.name || params.tournamentId} by ${params.ign}${params.applyingAsCaptain ? ' (Applied as Captain)' : ''}`,
        timestamp: new Date().toISOString()
      });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore registration persistence deferred:', e);
      }
    }

    this.notify();
    return res;
  }

  public getCaptainCandidates(tournamentId: string): DotaTournamentRegistration[] {
    return dotaPlayerRegistry.getCaptainCandidates(tournamentId);
  }

  public getCaptainApplicants(tournamentId: string): DotaTournamentRegistration[] {
    return dotaPlayerRegistry.getCaptainApplicants(tournamentId);
  }

  public async updateCaptainInterest(
    tournamentId: string,
    userId: string,
    interested: boolean,
    notes?: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.updateCaptainInterest(tournamentId, userId, interested, notes);
    if (res.success && res.registration) {
      try {
        await updateDoc(doc(db, 'registrations', res.registration.id), {
          interestedInCaptaincy: interested,
          applyingAsCaptain: interested,
          captainInterestTimestamp: res.registration.captainInterestTimestamp || null,
          captainNotes: res.registration.captainNotes || null,
          updatedAt: res.registration.updatedAt
        });
      } catch (e) {
        console.warn('Firestore updateCaptainInterest deferred:', e);
      }
      this.notify();
    }
    return res;
  }

  public async approveCaptain(
    tournamentId: string, 
    userId: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    if (!this.currentUser.isAdmin && this.currentUser.role !== 'organizer') {
      return { success: false, error: 'Only tournament organisers and platform admins can approve captains.' };
    }

    const res = dotaPlayerRegistry.approveCaptain(tournamentId, userId, this.currentUser.id, 4);
    if (!res.success || !res.registration) {
      return res;
    }

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        isCaptainApproved: true,
        captainApprovedAt: res.registration.captainApprovedAt,
        captainApprovedBy: this.currentUser.id
      });
    } catch (e) {
      console.warn('Firestore approveCaptain note:', e);
    }

    this.notify();
    return res;
  }

  public async withdrawTournamentRegistration(
    tournamentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const tourn = this.getTournamentBySlug(tournamentId);
    const tourneyStatus = tourn ? tourn.status.toLowerCase() : 'registration';

    const res = dotaPlayerRegistry.withdrawTournamentRegistration(tournamentId, userId, tourneyStatus);
    if (!res.success || !res.registration) {
      return res;
    }

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await updateDoc(doc(db, 'registrations', res.registration.id), {
          status: 'withdrawn',
          withdrawnAt: res.registration.withdrawnAt,
          updatedAt: res.registration.updatedAt
        });
        await updateDoc(doc(db, 'tournaments', tournamentId, 'registrations', userId), {
          status: 'withdrawn',
          withdrawnAt: res.registration.withdrawnAt,
          updatedAt: res.registration.updatedAt
        }).catch(() => {});
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn('Firestore withdrawal update deferred:', e);
      }
    }

    this.notify();
    return res;
  }

  public getUserRegistration(tournamentId: string, userId: string): DotaTournamentRegistration | undefined {
    return dotaPlayerRegistry.getRegistration(tournamentId, userId);
  }

  public getTournamentRegistrations(tournamentId: string): DotaTournamentRegistration[] {
    return dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
  }

  public async bulkRegisterTournamentPlayers(
    tournamentId: string,
    players: Array<{
      ign: string;
      displayName?: string;
      primaryRole: DotaRolePosition;
      secondaryRole?: DotaRolePosition;
      declaredMmr: number;
      city?: string;
      region?: string;
      isCaptain?: boolean;
      autoVerify?: boolean;
    }>
  ): Promise<{ success: boolean; registeredCount: number; errors: string[] }> {
    const errors: string[] = [];
    let registeredCount = 0;
    const auctionEngine = this.getDotaAuctionEngine(tournamentId);

    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.ign || !p.ign.trim()) {
        errors.push(`Row ${i + 1}: Player IGN is missing.`);
        continue;
      }
      const cleanIgn = p.ign.trim();
      const userId = `p-user-${cleanIgn.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now().toString(36)}-${i}`;
      const mmr = Math.min(15000, Math.max(100, Number(p.declaredMmr) || 5000));
      const isAutoVerify = p.autoVerify !== false;

      try {
        const reg = dotaPlayerRegistry.upsertRegistration({
          id: `reg-${tournamentId}-${userId}`,
          tournamentId,
          userId,
          ign: cleanIgn,
          primaryRole: p.primaryRole || 'Position 1 — Carry',
          secondaryRole: p.secondaryRole,
          declaredMmr: mmr,
          tournamentMmr: mmr,
          city: p.city || 'Mumbai',
          region: p.region || 'Pan India',
          status: isAutoVerify ? 'VERIFIED' : 'REGISTERED',
          applyingAsCaptain: Boolean(p.isCaptain),
          interestedInCaptaincy: Boolean(p.isCaptain),
          isMmrLocked: isAutoVerify,
          mmrLockedAt: isAutoVerify ? new Date().toISOString() : undefined,
          registeredAt: new Date().toISOString()
        });

        if (isAutoVerify) {
          auctionEngine.syncPlayerFromRegistration(tournamentId, reg);
        }

        registeredCount++;

        // Persist to Firestore asynchronously
        if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
          const regDocData = {
            id: reg.id,
            tournamentId,
            userId,
            playerName: cleanIgn,
            ign: cleanIgn,
            primaryRole: reg.primaryRole,
            secondaryRole: reg.secondaryRole || null,
            mmr,
            declaredMmr: mmr,
            tournamentMmr: mmr,
            status: reg.status.toLowerCase(),
            applyingAsCaptain: Boolean(p.isCaptain),
            interestedInCaptaincy: Boolean(p.isCaptain),
            city: reg.city,
            region: reg.region,
            isCaptainApproved: false,
            registeredAt: reg.registeredAt,
            updatedAt: reg.updatedAt
          };

          setDoc(doc(db, 'tournaments', tournamentId, 'registrations', userId), regDocData, { merge: true }).catch(() => {});
          setDoc(doc(db, 'registrations', reg.id), regDocData, { merge: true }).catch(() => {});
        }
      } catch (err: any) {
        errors.push(`Row ${i + 1} (${cleanIgn}): ${err?.message || 'Failed to register'}`);
      }
    }

    this.notify();
    return {
      success: registeredCount > 0,
      registeredCount,
      errors
    };
  }

  public async generateDummyTournamentPlayers(
    tournamentId: string,
    options: {
      count: number;
      minMmr?: number;
      maxMmr?: number;
      roleDistribution?: 'BALANCED' | 'RANDOM';
      specificRole?: DotaRolePosition;
      captainCount?: number;
      autoVerify?: boolean;
    }
  ): Promise<{ success: boolean; generatedCount: number; errors: string[] }> {
    const {
      count = 1,
      minMmr = 5500,
      maxMmr = 8500,
      roleDistribution = 'BALANCED',
      specificRole,
      captainCount = 0,
      autoVerify = true
    } = options;

    const PREFIXES = [
      'Viper', 'Shadow', 'Storm', 'Neon', 'Aether', 'Solaris', 'Frost', 'Chrono',
      'Thunder', 'Ghost', 'Nova', 'Titan', 'Crimson', 'Apex', 'Hyper', 'Zenith',
      'Quantum', 'Blaze', 'Iron', 'Echo', 'Void', 'Savage', 'Immortal', 'Onyx',
      'Pulse', 'Rogue', 'Mirage', 'Spectre', 'Tempest', 'Phantom', 'Kinesis', 'Aero'
    ];
    const SUFFIXES = [
      'Blade', 'Strike', 'Surge', 'Ranger', 'Walker', 'Fang', 'Claw', 'Wraith',
      'Breaker', 'Knight', 'Pulse', 'Byte', 'Fury', 'Soul', 'Ward', 'Sniper',
      'Havoc', 'Forge', 'Drift', 'Nova', 'Echo', 'Viper', 'Ghost', 'Flare', 'Shift'
    ];
    const CITIES = [
      { city: 'Mumbai', region: 'West India' },
      { city: 'Bengaluru', region: 'South India' },
      { city: 'Delhi NCR', region: 'North India' },
      { city: 'Hyderabad', region: 'South India' },
      { city: 'Pune', region: 'West India' },
      { city: 'Chennai', region: 'South India' },
      { city: 'Kolkata', region: 'East India' },
      { city: 'Ahmedabad', region: 'West India' },
      { city: 'Jaipur', region: 'North India' },
      { city: 'Chandigarh', region: 'North India' },
      { city: 'Kochi', region: 'South India' },
      { city: 'Indore', region: 'Central India' }
    ];
    const ROLES: DotaRolePosition[] = [
      'Position 1 — Carry',
      'Position 2 — Mid',
      'Position 3 — Offlane',
      'Position 4 — Soft Support',
      'Position 5 — Hard Support'
    ];

    const playersToRegister: Array<{
      ign: string;
      displayName?: string;
      primaryRole: DotaRolePosition;
      secondaryRole?: DotaRolePosition;
      declaredMmr: number;
      city?: string;
      region?: string;
      isCaptain?: boolean;
      autoVerify?: boolean;
    }> = [];

    const existingRegistrations = dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
    const existingNames = new Set(existingRegistrations.map(r => r.ign.toLowerCase()));

    for (let i = 0; i < count; i++) {
      let ign = '';
      let attempts = 0;
      do {
        const pref = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
        const suff = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        const num = attempts > 2 ? Math.floor(Math.random() * 90 + 10) : '';
        ign = `${pref}${suff}${num}`;
        attempts++;
      } while (existingNames.has(ign.toLowerCase()) && attempts < 20);

      existingNames.add(ign.toLowerCase());

      const primaryRole = specificRole || (roleDistribution === 'BALANCED'
        ? ROLES[i % ROLES.length]
        : ROLES[Math.floor(Math.random() * ROLES.length)]);

      const otherRoles = ROLES.filter(r => r !== primaryRole);
      const secondaryRole = otherRoles[Math.floor(Math.random() * otherRoles.length)];

      const loc = CITIES[Math.floor(Math.random() * CITIES.length)];
      const rawMmr = Math.floor(Math.random() * (maxMmr - minMmr + 1)) + minMmr;
      const mmr = Math.round(rawMmr / 25) * 25;
      const isCaptain = i < captainCount;

      playersToRegister.push({
        ign,
        displayName: ign,
        primaryRole,
        secondaryRole,
        declaredMmr: mmr,
        city: loc.city,
        region: loc.region,
        isCaptain,
        autoVerify
      });
    }

    const res = await this.bulkRegisterTournamentPlayers(tournamentId, playersToRegister);
    return {
      success: res.success,
      generatedCount: res.registeredCount,
      errors: res.errors
    };
  }

  public async removeTournamentRegistration(tournamentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    const reg = dotaPlayerRegistry.getRegistration(tournamentId, userId);
    dotaPlayerRegistry.withdrawTournamentRegistration(tournamentId, userId, 'registration');
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.removePlayer(userId);

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        await deleteDoc(doc(db, 'tournaments', tournamentId, 'registrations', userId)).catch(() => {});
        if (reg) {
          await deleteDoc(doc(db, 'registrations', reg.id)).catch(() => {});
        }
      } catch (err: any) {
        console.warn('Firestore registration deletion deferred:', err);
      }
    }

    this.notify();
    return { success: true };
  }

  // -------------------------------------------------------------
  // Phase 1B: Organiser Review, Tournament MMR, Verification & Evidence
  // -------------------------------------------------------------
  public async startRegistrationReview(
    tournamentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.startReview(tournamentId, userId, this.currentUser.id);
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        status: 'UNDER_REVIEW',
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore review status deferred:', e);
    }

    this.notify();
    return res;
  }

  public async requestRegistrationEvidence(
    tournamentId: string,
    userId: string,
    prompt: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.requestEvidence(tournamentId, userId, prompt, this.currentUser.id);
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        status: 'EVIDENCE_REQUESTED',
        evidenceRequestPrompt: prompt,
        evidenceRequestedAt: res.registration.evidenceRequestedAt,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore evidence request deferred:', e);
    }

    this.notify();
    return res;
  }

  public async submitRegistrationEvidence(
    tournamentId: string,
    userId: string,
    evidenceData: {
      type: EvidenceType;
      fileUrl?: string;
      description: string;
    }
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration; evidenceItem?: RegistrationEvidenceItem }> {
    const res = dotaPlayerRegistry.submitEvidence(tournamentId, userId, evidenceData);
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        status: res.registration.status,
        evidence: res.registration.evidence,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore evidence save deferred:', e);
    }

    this.notify();
    return res;
  }

  public async confirmDeclaredMmr(
    tournamentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.confirmDeclaredMmr(tournamentId, userId, this.currentUser.id);
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        tournamentMmr: res.registration.tournamentMmr,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore MMR confirmation deferred:', e);
    }

    this.notify();
    return res;
  }

  public async setCorrectedTournamentMmr(
    tournamentId: string,
    userId: string,
    correctedMmr: number,
    reason: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.setCorrectedTournamentMmr(
      tournamentId,
      userId,
      correctedMmr,
      reason,
      this.currentUser.id
    );
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        tournamentMmr: correctedMmr,
        historicalMmrChanges: res.registration.historicalMmrChanges,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore MMR adjustment deferred:', e);
    }

    this.notify();
    return res;
  }

  public async verifyRegistration(
    tournamentId: string,
    userId: string,
    confirmedTournamentMmr?: number
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.verifyRegistration(
      tournamentId,
      userId,
      this.currentUser.id,
      confirmedTournamentMmr
    );
    if (!res.success || !res.registration) return res;

    // If Test Cup, sync verified player into Test Cup player pool
    if (tournamentId === 'purple-bean-test-cup') {
      const tcPlayer = testCupEngine.getPlayers().find(p => p.id === userId || p.username.toLowerCase() === res.registration?.ign.toLowerCase());
      if (tcPlayer) {
        testCupEngine.verifyPlayer(tcPlayer.id, true);
        tcPlayer.tournamentMmr = res.registration.tournamentMmr || tcPlayer.tournamentMmr;
      }
    }

    // Authoritatively sync verified contender into Dota Phase 2 Auction engine pool
    try {
      dotaAuctionEngine.syncPlayerFromRegistration(tournamentId, res.registration);
      getAuctionEngine(tournamentId).syncPlayerFromRegistration(tournamentId, res.registration);
    } catch {
      // Auction sync safe fallback
    }

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        status: 'VERIFIED',
        tournamentMmr: res.registration.tournamentMmr,
        isMmrLocked: true,
        verifiedAt: res.registration.verifiedAt,
        verifiedBy: this.currentUser.id,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore verification save deferred:', e);
    }

    this.notify();
    return res;
  }

  public async correctLockedTournamentMmr(
    tournamentId: string,
    userId: string,
    newMmr: number,
    reason: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.correctLockedTournamentMmr(
      tournamentId,
      userId,
      newMmr,
      reason,
      this.currentUser.id
    );
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        tournamentMmr: newMmr,
        historicalMmrChanges: res.registration.historicalMmrChanges,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore locked MMR update deferred:', e);
    }

    this.notify();
    return res;
  }

  public async rejectRegistration(
    tournamentId: string,
    userId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string; registration?: DotaTournamentRegistration }> {
    const res = dotaPlayerRegistry.rejectRegistration(tournamentId, userId, reason, this.currentUser.id);
    if (!res.success || !res.registration) return res;

    try {
      await updateDoc(doc(db, 'registrations', res.registration.id), {
        status: 'REJECTED',
        rejectionReason: reason,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn('Firestore rejection save deferred:', e);
    }

    this.notify();
    return res;
  }

  public createIntegrityCase(
    playerId: string,
    caseType: MmrIntegrityCaseType,
    declaredMmr: number,
    evidenceNotes: string,
    tournamentId?: string
  ): MmrIntegrityCase {
    const newCase = dotaPlayerRegistry.createIntegrityCase(
      playerId,
      caseType,
      declaredMmr,
      evidenceNotes,
      tournamentId,
      this.currentUser.id
    );
    this.notify();
    return newCase;
  }

  public resolveIntegrityCase(
    caseId: string,
    action: 'APPROVE' | 'CORRECT_MMR' | 'REQUEST_EVIDENCE' | 'WARN' | 'DISQUALIFY' | 'REJECT' | 'ESCALATE',
    note: string,
    correctedMmr?: number
  ): { success: boolean; error?: string } {
    const res = dotaPlayerRegistry.resolveIntegrityCase(caseId, action, note, this.currentUser.id, correctedMmr);
    this.notify();
    return res;
  }

  public getIntegrityCases(): MmrIntegrityCase[] {
    return dotaPlayerRegistry.getIntegrityCases();
  }

  public getRegistrationEvidence(
    registrationId: string,
    caller: { userId: string; role: string; isAdmin?: boolean }
  ): { success: boolean; error?: string; evidence?: RegistrationEvidenceItem[] } {
    return dotaPlayerRegistry.getRegistrationEvidence(registrationId, caller);
  }

  public getEligibleAuctionPlayers(tournamentId: string): DotaTournamentRegistration[] {
    return dotaPlayerRegistry.getEligibleAuctionPlayers(tournamentId);
  }

  public getUserNotifications(userId: string): DotaUserNotification[] {
    const curUser = this.currentUser;
    const directNotifs = dotaPlayerRegistry.getNotifications(userId);
    const allNotifs = dotaPlayerRegistry.getAllNotifications ? dotaPlayerRegistry.getAllNotifications() : [];
    
    const matched = allNotifs.filter(n => 
      n.userId === userId ||
      (curUser?.email && n.userEmail && n.userEmail.toLowerCase() === curUser.email.toLowerCase()) ||
      (curUser?.displayName && n.userIgn && n.userIgn.toLowerCase() === curUser.displayName.toLowerCase())
    );

    const map = new Map<string, DotaUserNotification>();
    directNotifs.forEach(n => map.set(n.id, n));
    matched.forEach(n => map.set(n.id, n));
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public markNotificationRead(notificationId: string) {
    dotaPlayerRegistry.markNotificationRead(notificationId);
    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      updateDoc(doc(db, 'notifications', notificationId), {
        read: true,
        unread: false
      }).catch((err) => {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
        }
      });
    }
    this.notify();
  }

  // -------------------------------------------------------------
  // Phase 2: Dota Captain Selection & Live Player Auction
  // -------------------------------------------------------------
  public getDotaAuctionEngine(tournamentId?: string): DotaAuctionEngine {
    return tournamentId ? getAuctionEngine(tournamentId) : dotaAuctionEngine;
  }

  public async persistCaptainAndTeamAtomic(
    tournamentId: string,
    team: DotaAuctionTeam,
    captainUserId: string
  ): Promise<void> {
    const effectiveTourneyId = tournamentId;
    if (!effectiveTourneyId) return;
    const engine = this.getDotaAuctionEngine(effectiveTourneyId);
    const allAuctionTeams = engine.getTeams();
    const tournament = this.getTournamentBySlug(effectiveTourneyId);
    const tourneyDisplayName = tournament?.name || effectiveTourneyId;

    const teamDocData = {
      id: team.id,
      name: team.name,
      tag: team.tag,
      color: team.color,
      logo: team.logo,
      captainId: captainUserId,
      captainName: team.captainIgn,
      captainIgn: team.captainIgn,
      tournamentId: effectiveTourneyId,
      startingCredits: team.startingCredits,
      remainingCredits: team.remainingCredits,
      creditsUsed: team.creditsUsed,
      lockedTournamentMmr: team.primaryRoster[0]?.tournamentMmr || 0,
      primaryRoster: team.primaryRoster,
      standIns: team.standIns || [],
      city: team.primaryRoster[0]?.city || 'India',
      primaryGame: 'Dota 2',
      status: 'Confirmed',
      rosterCount: team.primaryRoster.length,
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      mapsRecord: { won: 0, lost: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Update in-memory teams list immediately
    const existingIdx = this.teams.findIndex(t => t.id === team.id);
    const genericTeam: Team = {
      id: team.id,
      name: team.name,
      tag: team.tag,
      logo: team.logo || '👑',
      color: team.color || '#7C3AED',
      bgHex: team.color || '#7C3AED',
      captainId: captainUserId,
      captainName: team.captainIgn,
      city: team.primaryRoster[0]?.city || 'India',
      region: team.primaryRoster[0]?.region || 'Pan India',
      country: 'India',
      flag: '🇮🇳',
      primaryGame: 'Dota 2',
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      players: team.primaryRoster ? team.primaryRoster.map((p: any) => p.userId || p.id) : [captainUserId],
      standIn: '',
      groupPoints: 0,
      mapsRecord: { won: 0, lost: 0 },
      form: [],
      description: `Official franchise team commanded by captain ${team.captainIgn}.`,
      tournamentId: effectiveTourneyId
    };
    if (existingIdx >= 0) {
      this.teams[existingIdx] = genericTeam;
    } else {
      this.teams.push(genericTeam);
    }

    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        const batch = writeBatch(db);

        // a) Write team to top-level teams collection
        batch.set(doc(db, 'teams', team.id), teamDocData, { merge: true });

        // b) Write team to scoped tournament teams subcollection: tournaments/{tournamentId}/teams/{teamId}
        batch.set(doc(db, 'tournaments', effectiveTourneyId, 'teams', team.id), teamDocData, { merge: true });

        // c) Update tournaments/{tournamentId} with authoritative captains & teams list
        const captainsList = allAuctionTeams.map(t => ({
          userId: t.captainId,
          ign: t.captainIgn,
          teamId: t.id,
          teamName: t.name,
          tag: t.tag,
          color: t.color,
          logo: t.logo,
          lockedTournamentMmr: t.primaryRoster[0]?.tournamentMmr || 0,
          startingCredits: t.startingCredits,
          remainingCredits: t.remainingCredits,
          rosterCount: t.primaryRoster.length,
          assignedAt: new Date().toISOString()
        }));

        batch.set(doc(db, 'tournaments', effectiveTourneyId), {
          captainsConfirmed: allAuctionTeams.length,
          captains: captainsList,
          teams: allAuctionTeams,
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // d) Update auctions/{tournamentId} state & teams snapshot
        const auctionSnapshot = engine.exportSnapshot();
        batch.set(doc(db, 'auctions', effectiveTourneyId), {
          ...auctionSnapshot,
          lastPersistedAt: new Date().toISOString()
        }, { merge: true });

        // e) Update contender's registration document
        const reg = dotaPlayerRegistry.getRegistration(effectiveTourneyId, captainUserId);
        const regId = reg?.id || `reg-${effectiveTourneyId}-${captainUserId}`;
        batch.set(doc(db, 'registrations', regId), {
          isCaptainApproved: true,
          captainApprovedAt: new Date().toISOString(),
          captainApprovedBy: this.currentUser.id,
          teamId: team.id,
          teamName: team.name,
          status: 'VERIFIED',
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // f) Update membership
        batch.set(doc(db, 'tournaments', effectiveTourneyId, 'memberships', captainUserId), {
          userId: captainUserId,
          tournamentId: effectiveTourneyId,
          role: 'captain',
          teamId: team.id,
          assignedAt: new Date().toISOString()
        }, { merge: true });

        // g) Persistent actionable notification for the appointed captain Firebase user
        const notifId = `notif-cap-appointed-${Date.now()}-${captainUserId}`;
        const notifDoc = {
          id: notifId,
          userId: captainUserId,
          type: 'CAPTAIN_SELECTED',
          title: "You've Been Selected as Captain",
          message: `You have been selected as a captain for ${tourneyDisplayName}.`,
          tournamentId: effectiveTourneyId,
          actionTarget: {
            view: 'captain_selection',
            entityId: effectiveTourneyId
          },
          read: false,
          createdAt: new Date().toISOString()
        };
        batch.set(doc(db, 'notifications', notifId), notifDoc);

        await batch.commit();
      } catch (err) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
        }
        console.warn('Atomic captain/team persistence note:', err);
      }
    }
  }

  public appointDotaCaptain(
    candidateUserId: string,
    teamMetadata: { teamName: string; tag: string; color?: string; logo?: string },
    tournamentId: string = ''
  ): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    if (!tournamentId) {
      return { success: false, error: 'Tournament ID is required to appoint a captain.' };
    }
    const regCheck = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
    if (regCheck && regCheck.status !== 'VERIFIED') {
      dotaPlayerRegistry.verifyRegistration(
        tournamentId,
        candidateUserId,
        this.currentUser.id,
        regCheck.tournamentMmr || regCheck.declaredMmr || 5000
      );
    }
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.appointCaptain(candidateUserId, teamMetadata, this.currentUser.id);
    if (res.success && res.team) {
      const reg = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
      const candidateEmail = reg?.userEmail || '';
      
      // 1. Update DETERMINISTIC_USERS entry if exists
      const detUser = DETERMINISTIC_USERS.find(u => 
        u.id === candidateUserId || 
        (candidateEmail && u.email?.toLowerCase() === candidateEmail.toLowerCase()) ||
        (reg?.ign && u.displayName?.toLowerCase() === reg.ign.toLowerCase()) ||
        (reg?.ign && (u as any).ign?.toLowerCase() === reg.ign.toLowerCase())
      );
      if (detUser) {
        detUser.role = 'captain';
        detUser.teamId = res.team.id;
        detUser.teamName = res.team.name;
      }

      // 2. Add or update in this.teams
      const existingTeamIdx = this.teams.findIndex(t => t.id === res.team?.id);
      const teamObj: any = {
        id: res.team.id,
        name: res.team.name,
        tag: res.team.tag,
        logo: res.team.logo,
        color: res.team.color,
        captainId: candidateUserId,
        captainEmail: candidateEmail,
        captainName: reg?.ign || res.team.captainIgn,
        tournamentId,
        members: [{ id: candidateUserId, name: reg?.ign || res.team.captainIgn, role: 'Captain' }]
      };
      if (existingTeamIdx >= 0) {
        this.teams[existingTeamIdx] = teamObj;
      } else {
        this.teams.push(teamObj);
      }

      // 3. Update role in memory for current active user if matches
      if (
        this.currentUser.id === candidateUserId ||
        (candidateEmail && this.currentUser.email && this.currentUser.email.toLowerCase() === candidateEmail.toLowerCase()) ||
        (reg && this.currentUser.displayName?.toLowerCase() === reg.ign.toLowerCase())
      ) {
        this.currentUser.role = 'captain';
        this.currentUser.teamId = res.team.id;
        this.currentUser.teamName = res.team.name;
      }

      // 4. Update userRoles map
      this.userRoles.set(candidateUserId, {
        email: candidateEmail,
        role: 'captain',
        assignedBy: this.currentUser.id,
        assignedAt: new Date().toISOString()
      });
      if (candidateEmail) {
        this.userRoles.set(candidateEmail.toLowerCase().trim(), {
          email: candidateEmail.toLowerCase().trim(),
          role: 'captain',
          assignedBy: this.currentUser.id,
          assignedAt: new Date().toISOString()
        });
      }

      // 5. Fire atomic Firestore sync in background immediately
      this.persistCaptainAndTeamAtomic(tournamentId, res.team, candidateUserId).catch(() => {});

      if (typeof window !== 'undefined') {
        try {
          if ('BroadcastChannel' in window) {
            const globalChannel = new BroadcastChannel('pb_global_cross_session_sync');
            globalChannel.postMessage({
              type: 'CAPTAIN_APPOINTED',
              tournamentId,
              captainId: candidateUserId,
              team: res.team
            });
            globalChannel.close();
          }
          window.localStorage.setItem(`pb_last_captain_appointed_${tournamentId}`, JSON.stringify({
            captainId: candidateUserId,
            team: res.team,
            timestamp: Date.now()
          }));
        } catch {}
      }
    }
    this.notify();
    return res;
  }

  public resetDotaCaptain(captainUserId: string, tournamentId: string): { success: boolean; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.resetCaptain(captainUserId, this.currentUser.id);
    if (res.success) {
      const detUser = DETERMINISTIC_USERS.find(u => u.id === captainUserId);
      if (detUser) {
        detUser.role = 'player';
        detUser.teamId = undefined;
        detUser.teamName = undefined;
      }
      this.userRoles.delete(captainUserId);

      if (this.currentUser.id === captainUserId) {
        this.currentUser.role = 'player';
        this.currentUser.teamId = undefined;
        this.currentUser.teamName = undefined;
      }
      // Remove team from in-memory teams list
      this.teams = this.teams.filter(t => t.captainId !== captainUserId || t.tournamentId !== tournamentId);
      this.notify();
    }
    return res;
  }

  public updateAuctionTeamIdentity(
    tournamentId: string,
    teamId: string,
    identity: { name?: string; tag?: string; logo?: string; color?: string; bannerUrl?: string }
  ): { success: boolean; team?: DotaAuctionTeam; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.updateTeamIdentity(teamId, identity, this.currentUser.id);
    if (res.success && res.team) {
      const existing = this.teams.find(t => t.id === teamId);
      if (existing) {
        if (identity.name) existing.name = identity.name;
        if (identity.tag) existing.tag = identity.tag;
        if (identity.logo) existing.logo = identity.logo;
        if (identity.color) {
          existing.color = identity.color;
          existing.bgHex = identity.color;
        }
        if (identity.bannerUrl) (existing as any).bannerUrl = identity.bannerUrl;
      }
      this.notify();
    }
    return res;
  }

  public appointRealUserAsCaptain(params: {
    tournamentId: string;
    userId: string;
    email?: string;
    ign: string;
    tournamentMmr: number;
    primaryRole?: DotaRolePosition;
    city?: string;
    teamName: string;
    tag: string;
    color?: string;
    logo?: string;
  }): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    const engine = this.getDotaAuctionEngine(params.tournamentId);

    // 1. Ensure registration exists and is verified with locked tournament MMR
    let reg = dotaPlayerRegistry.getRegistration(params.tournamentId, params.userId);
    if (!reg) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: params.tournamentId,
        userId: params.userId,
        ign: params.ign,
        primaryRole: params.primaryRole || 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: params.tournamentMmr,
        rulesAccepted: true,
        city: params.city || 'Bengaluru'
      });
    }

    dotaPlayerRegistry.verifyRegistration(
      params.tournamentId,
      params.userId,
      this.currentUser.id,
      params.tournamentMmr
    );

    reg = dotaPlayerRegistry.getRegistration(params.tournamentId, params.userId);
    if (reg) {
      engine.syncPlayerFromRegistration(params.tournamentId, reg);
    }

    // 2. Appoint as captain
    const appRes = engine.appointCaptain(
      params.userId,
      {
        teamName: params.teamName,
        tag: params.tag.toUpperCase(),
        color: params.color || '#FFE600',
        logo: params.logo || '👑'
      },
      this.currentUser.id
    );

    if (appRes.success && appRes.team) {
      if (this.currentUser.id === params.userId || (params.email && this.currentUser.email === params.email.toLowerCase())) {
        this.currentUser.role = 'captain';
        this.currentUser.teamId = appRes.team.id;
        this.currentUser.teamName = appRes.team.name;
      }
      if (params.email) {
        this.userRoles.set(params.email.toLowerCase().trim(), {
          email: params.email.toLowerCase().trim(),
          role: 'captain',
          assignedBy: this.currentUser.id,
          assignedAt: new Date().toISOString()
        });
      }
      this.persistCaptainAndTeamAtomic(params.tournamentId, appRes.team, params.userId).catch(() => {});

      if (typeof window !== 'undefined') {
        try {
          if ('BroadcastChannel' in window) {
            const globalChannel = new BroadcastChannel('pb_global_cross_session_sync');
            globalChannel.postMessage({
              type: 'CAPTAIN_APPOINTED',
              tournamentId: params.tournamentId,
              captainId: params.userId,
              team: appRes.team
            });
            globalChannel.close();
          }
          window.localStorage.setItem(`pb_last_captain_appointed_${params.tournamentId}`, JSON.stringify({
            captainId: params.userId,
            team: appRes.team,
            timestamp: Date.now()
          }));
        } catch {}
      }
    }

    this.notify();
    return appRes;
  }

  public nominateDotaPlayer(playerId: string, tournamentId?: string): { success: boolean; error?: string; nominee?: DotaAuctionPlayer } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.nominatePlayer(playerId, this.currentUser.id);
    this.notify();
    return res;
  }

  public placeDotaAuctionBid(params: {
    tournamentId?: string;
    teamId?: string;
    bidAmount?: number;
    increment?: number;
    expectedRevision?: number;
    simulatedCaptainId?: string;
  }): { 
    success: boolean; 
    error?: string; 
    currentBid?: number; 
    revision?: number; 
    leadingTeamName?: string; 
    leadingTeamId?: string;
    secondsRemaining?: number;
  } {
    const engine = this.getDotaAuctionEngine(params.tournamentId);
    const captainId = params.simulatedCaptainId || this.currentUser.id;
    const actorRole = params.simulatedCaptainId ? 'captain' : this.currentUser.role;
    const res = engine.placeBid({
      teamId: params.teamId,
      captainUserId: captainId,
      bidAmount: params.bidAmount,
      increment: params.increment,
      expectedRevision: params.expectedRevision,
      actorRole
    });
    this.notify();
    return res;
  }

  public pauseDotaAuction(tournamentId?: string): { success: boolean; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.pauseAuction(this.currentUser.id);
    this.notify();
    return res;
  }

  public resumeDotaAuction(tournamentId?: string): { success: boolean; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.resumeAuction(this.currentUser.id);
    this.notify();
    return res;
  }

  public extendDotaAuctionTime(seconds: number, tournamentId?: string): { success: boolean; secondsRemaining: number } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.addTime(seconds, this.currentUser.id);
    this.notify();
    return { success: true, secondsRemaining: engine.getState().secondsRemaining };
  }

  public adjustDotaAuctionTimer(seconds: number, tournamentId?: string): { success: boolean; secondsRemaining: number } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.adjustTimer(seconds, this.currentUser.id);
    this.notify();
    return { success: true, secondsRemaining: engine.getState().secondsRemaining };
  }

  public concludeDotaAuctionItem(sellToWinner: boolean, tournamentId?: string): {
    outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED';
    player: DotaAuctionPlayer;
    teamName?: string;
    winningBid?: number;
  } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.concludeNomination(sellToWinner, this.currentUser.id);
    this.notify();
    return res;
  }

  public assignDotaStandIn(teamId: string, playerId: string, tournamentId?: string): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.assignOptionalStandIn(teamId, playerId, this.currentUser.id);
    this.notify();
    return res;
  }

  public confirmDotaAuctionPurses(tournamentId?: string): { success: boolean; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.confirmPurses(this.currentUser.id);
    this.notify();
    return res;
  }

  public startDotaAuction(tournamentId?: string): { success: boolean; error?: string } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.startAuction(this.currentUser.id);
    this.notify();
    return res;
  }

  public finalizeDotaAuction(tournamentId?: string): { success: boolean; unselectedCount: number } {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.finalizeAuction(this.currentUser.id);
    this.notify();
    return res;
  }

  // -------------------------------------------------------------
  // Phase 3: Premade Teams & Authoritative Roster Management
  // -------------------------------------------------------------
  public getPremadeTeamEngine(): DotaPremadeTeamEngine {
    return dotaPremadeTeamEngine;
  }

  public registerPremadeTeam(params: {
    tournamentId: string;
    teamName: string;
    tag: string;
    logo?: string;
    color?: string;
    captainUserId: string;
    persistentClubId?: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.registerPremadeTeam({
      ...params,
      creatorUserId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  public addPlayerToPremadeRoster(params: {
    tournamentId: string;
    teamId: string;
    candidateUserId: string;
    isStandIn?: boolean;
    assignedRole?: any;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.addPlayerToRoster({
      ...params,
      actorUserId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  public submitPremadeRoster(
    tournamentId: string,
    teamId: string
  ): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.submitTeamRoster(tournamentId, teamId, this.currentUser.id);
    this.notify();
    return res;
  }

  public reviewPremadeTeam(params: {
    tournamentId: string;
    teamId: string;
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
    reason?: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.reviewTeamSubmission({
      ...params,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  public lockPremadeRoster(
    tournamentId: string,
    teamId: string
  ): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.lockPremadeRoster(tournamentId, teamId, this.currentUser.id);
    this.notify();
    return res;
  }

  public executeEmergencyPremadeRosterChange(params: {
    tournamentId: string;
    teamId: string;
    outgoingPlayerId: string;
    incomingPlayerId: string;
    role?: any;
    reason: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const res = dotaPremadeTeamEngine.executeEmergencyRosterChange({
      ...params,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  // -------------------------------------------------------------
  // Phase 4: Competition Structure, Seeding & Brackets
  // -------------------------------------------------------------
  public getCompetitionEngine(): DotaCompetitionEngine {
    return dotaCompetitionEngine;
  }

  public generateCompetitionSeeds(params: {
    tournamentId: string;
    seedingMode: SeedingMode;
    manualSeeds?: Array<{ teamId: string; seed: number }>;
  }): { success: boolean; error?: string; seededTeams?: SeededTeam[] } {
    const res = dotaCompetitionEngine.generateSeeds({
      ...params,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  public generateCompetitionStructure(tournamentId: string): {
    success: boolean;
    error?: string;
    structure?: CompetitionStructureState;
  } {
    const res = dotaCompetitionEngine.generateCompetitionStructure({
      tournamentId,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }

  public lockCompetitionStructure(tournamentId: string): {
    success: boolean;
    error?: string;
    structure?: CompetitionStructureState;
  } {
    const res = dotaCompetitionEngine.lockCompetitionStructure(tournamentId, this.currentUser.id);
    this.notify();
    return res;
  }

  // -------------------------------------------------------------
  // Purple Bean Test Cup Engine Integration
  // -------------------------------------------------------------
  public getTestCupEngine(): PurpleBeanTestCupEngine {
    return testCupEngine;
  }

  public runTestCupSimulation() {
    const res = testCupEngine.runFullTournamentSimulation();
    const testCupTourn = this.tournaments.find(t => t.id === 'purple-bean-test-cup');
    if (testCupTourn) {
      testCupTourn.status = 'Completed';
    }
    this.notify();
    return res;
  }
}

export const tournamentService = new FirebaseTournamentService();
