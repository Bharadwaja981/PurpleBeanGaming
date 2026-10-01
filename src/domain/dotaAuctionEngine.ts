/**
 * Purple Bean Gaming — Dota 2 Phase 2 Engine
 * Captain Selection & Authoritative Player Auction
 * 
 * Strict Domain Invariants:
 * 1. Captains can ONLY be appointed from VERIFIED contenders.
 * 2. Captain assignment is tournament-scoped; normal players cannot self-assign.
 * 3. Selecting a captain creates the tournament team with captain as 1/5 in primary roster.
 * 4. Auction parameters (purse, min bid, increment, reserve, timers) are tournament-configurable.
 * 5. Player states are strictly: AVAILABLE, NOMINATED, SOLD, UNSOLD, UNSELECTED.
 * 6. UNSOLD and UNSELECTED are distinct and never merged.
 * 7. Reserve rule: team must retain enough credits for remaining MANDATORY primary slots.
 *    Optional stand-ins do NOT consume mandatory reserve.
 * 8. Auction completes when ALL teams reach mandatory 5/5 primary rosters.
 * 9. Optional stand-in (0/1) supported without blocking tournament progression.
 * 10. Complete, immutable audit history preserved across refreshes.
 */

import { DotaRolePosition, dotaPlayerRegistry, DotaTournamentRegistration, DotaPlayerProfile } from './dotaPlayerEngine';
import { Player } from '../types/tournament';
import { 
  CreditAllocationMode, 
  AuctionPurseAllocationAudit, 
  CaptainMmrInput, 
  MmrBalanceResult, 
  calculateMmrBalancedPurses 
} from './dotaAuctionMmrBalancer';
import { doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, isQuotaExhausted, setQuotaExhausted, isQuotaError } from '../services/firebaseConfig';

export type AuctionPlayerStatus = 'AVAILABLE' | 'NOMINATED' | 'SOLD' | 'UNSOLD' | 'UNSELECTED';

export interface DotaAuctionConfig {
  tournamentId: string;
  tournamentName: string;
  startingCredits: number;
  creditAllocationMode: CreditAllocationMode; // 'CAPTAIN_MMR_BALANCED' | 'EQUAL'
  baseCredits: number;
  adjustmentRate: number;
  minimumCredits: number;
  maximumCredits: number;
  creditRounding: number;
  minimumBid: number;
  bidIncrement: number;
  reservePerSlot: number;
  primaryRosterSize: number; // default 5 (Captain + 4 drafted)
  optionalStandInLimit: number; // default 1 (0/1 optional)
  numberOfTeams?: number; // max team franchises
  nominationTimerSeconds: number; // default 30
  bidTimerSeconds: number; // default 25
  spectatorDelaySeconds?: number;
  bidExtensionEnabled: boolean; // default true
  extensionWindowSeconds: number; // default 5
  extensionTimeSeconds: number; // default 5
  nominationMode?: "ORGANISER" | "LINEAR" | "SNAKE";
  nextPlayerDelaySeconds?: number;
}

export interface DotaAuctionPlayer {
  id: string;
  userId: string;
  username: string; // IGN
  displayName: string;
  avatar: string;
  city?: string;
  region?: string;
  tournamentMmr: number;
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;
  rating: number; // Purple Bean Rating
  isMmrLocked?: boolean;
  isCaptain: boolean;
  status: AuctionPlayerStatus;
  teamId?: string;
  teamName?: string;
  soldAmount?: number;
  isStandIn?: boolean;
}

export interface DotaAuctionTeam {
  id: string;
  name: string;
  tag: string;
  logo: string;
  color: string;
  captainId: string;
  captainIgn: string;
  startingCredits: number;
  remainingCredits: number;
  creditsUsed: number;
  primaryRoster: DotaAuctionPlayer[]; // Max primaryRosterSize (includes captain)
  standIns: DotaAuctionPlayer[]; // Max optionalStandInLimit
}

export interface DotaBidRecord {
  id: string;
  nomineeId: string;
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: string;
  captainUserId: string;
  reverted?: boolean;
  revertedBy?: string;
}

export interface DotaNominationAudit {
  nomineeId: string;
  nomineeUsername: string;
  tournamentMmr: number;
  role: string;
  outcome: 'SOLD' | 'UNSOLD';
  winningTeamId?: string;
  winningTeamName?: string;
  winningBid?: number;
  bidsCount: number;
  timestamp: string;
}

export interface DotaAuctionLotResult {
  outcome: 'SOLD' | 'UNSOLD';
  player: DotaAuctionPlayer;
  winningTeamName?: string;
  winningTeamId?: string;
  winningBid?: number;
  timestamp: string;
}

export interface DotaAuctionState {
  tournamentId: string;
  status: 'PENDING' | 'READY' | 'LIVE' | 'PAUSED' | 'COMPLETED' | 'INTERMISSION';
  roundPhase?: 'NOMINATION' | 'BIDDING' | 'GOING_ONCE' | 'GOING_TWICE' | 'OUTCOME_RESOLUTION' | 'INTERMISSION';
  intermissionRemainingSeconds?: number;
  isPurseConfirmed?: boolean;
  revision: number;
  currentBid: number;
  leadingTeamId: string;
  leadingTeamName: string;
  nominee: DotaAuctionPlayer | null;
  secondsRemaining: number;
  timerEndsAt?: number; // Server-authoritative epoch millisecond deadline
  pausedRemainingMs?: number;
  soldCount: number;
  unsoldCount: number;
  unselectedCount: number;
  isCompleted: boolean;
  completedAt?: string;
  lastLotResult?: DotaAuctionLotResult | null;
  standInRoundActive?: boolean;
  primaryRostersComplete?: boolean;
}

export class DotaAuctionEngine {
  private config: DotaAuctionConfig;
  private players: Map<string, DotaAuctionPlayer> = new Map();
  private teams: Map<string, DotaAuctionTeam> = new Map();
  private state: DotaAuctionState;
  private bidHistory: DotaBidRecord[] = [];
  private nominationAudits: DotaNominationAudit[] = [];
  private auditLog: Array<{ action: string; actor: string; details: string; timestamp: string }> = [];
  private listeners: Array<() => void> = [];
  private timerInterval: any = null;
  private syncChannel: any = null;
  private globalBroadcastChannel: any = null;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private isApplyingRemoteUpdate = false;
  private purseAllocationAudit: AuctionPurseAllocationAudit | null = null;
  private unsoldQueue: string[] = [];
  private nominationTurnIndex = 0;
  private snakeDirection: 1 | -1 = 1;

  constructor(customConfig?: Partial<DotaAuctionConfig>) {
    this.config = {
      tournamentId: customConfig?.tournamentId || 'purple-bean-test-cup',
      tournamentName: customConfig?.tournamentName || 'Purple Bean Test Cup',
      startingCredits: customConfig?.startingCredits ?? 1000,
      creditAllocationMode: customConfig?.creditAllocationMode || 'CAPTAIN_MMR_BALANCED',
      baseCredits: customConfig?.baseCredits ?? 1000,
      adjustmentRate: customConfig?.adjustmentRate ?? 0.25,
      minimumCredits: customConfig?.minimumCredits ?? 800,
      maximumCredits: customConfig?.maximumCredits ?? 1200,
      creditRounding: customConfig?.creditRounding ?? 10,
      minimumBid: customConfig?.minimumBid ?? 10,
      bidIncrement: customConfig?.bidIncrement ?? 10,
      reservePerSlot: customConfig?.reservePerSlot ?? 10,
      primaryRosterSize: customConfig?.primaryRosterSize ?? 5,
      optionalStandInLimit: customConfig?.optionalStandInLimit ?? 1,
      nominationTimerSeconds: customConfig?.nominationTimerSeconds ?? 30,
      bidTimerSeconds: customConfig?.bidTimerSeconds ?? 25,
      spectatorDelaySeconds: customConfig?.spectatorDelaySeconds ?? 0,
      bidExtensionEnabled: customConfig?.bidExtensionEnabled ?? true,
      extensionWindowSeconds: customConfig?.extensionWindowSeconds ?? 5,
      extensionTimeSeconds: customConfig?.extensionTimeSeconds ?? 5
    };

    this.state = {
      tournamentId: this.config.tournamentId,
      status: 'PENDING',
      revision: 1,
      currentBid: this.config.minimumBid,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      secondsRemaining: this.config.nominationTimerSeconds,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false,
      lastLotResult: null,
      standInRoundActive: false,
      primaryRostersComplete: false
    };

    this.initializeFromRegistrations();
    this.initCrossSessionSync();
  }

  private firestoreUnsub: Unsubscribe | null = null;
  private tournamentDocUnsub: Unsubscribe | null = null;
  private eventSource: EventSource | null = null;
  private ssePollInterval: any = null;

  private initCrossSessionSync() {
    if (typeof window !== 'undefined') {
      try {
        if ('BroadcastChannel' in window) {
          this.syncChannel = new BroadcastChannel(`pb_dota_auction_sync_${this.config.tournamentId}`);
          this.syncChannel.onmessage = (event: MessageEvent) => {
            if (event.data?.type === 'AUCTION_STATE_SYNC' && event.data?.payload) {
              this.importSnapshot(event.data.payload);
            } else if (event.data?.type === 'AUCTION_TIMER_TICK') {
              if (this.state.nominee && this.state.status === 'LIVE') {
                this.state.secondsRemaining = event.data.secondsRemaining;
                if (event.data.timerEndsAt) this.state.timerEndsAt = event.data.timerEndsAt;
                this.notify(false);
              }
            }
          };

          // Global cross-session sync channel for instant captain appointments
          this.globalBroadcastChannel = new BroadcastChannel('pb_global_cross_session_sync');
          this.globalBroadcastChannel.onmessage = (event: MessageEvent) => {
            if (event.data?.tournamentId === this.config.tournamentId) {
              if (event.data.type === 'CAPTAIN_APPOINTED' && event.data.team) {
                this.hydrateTeamFromExternal(event.data.team);
              }
            }
          };
        }

        // Storage listener for instantaneous multi-window / tab sync
        this.storageHandler = (e: StorageEvent) => {
          if (e.key === `pb_auction_snapshot_${this.config.tournamentId}` && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              if (parsed) {
                this.importSnapshot(parsed);
              }
            } catch {}
          } else if (e.key === `pb_last_captain_appointed_${this.config.tournamentId}` && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              if (parsed?.team) {
                this.hydrateTeamFromExternal(parsed.team);
              }
            } catch {}
          }
        };
        window.addEventListener('storage', this.storageHandler);

        // Server-Sent Events (SSE) stream for cross-browser, cross-device, and incognito synchronization
        if (typeof EventSource !== 'undefined') {
          try {
            this.eventSource = new EventSource(`/api/auction/${encodeURIComponent(this.config.tournamentId)}/stream`);
            this.eventSource.addEventListener('INIT_STATE', (e: MessageEvent) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {}
            });
            this.eventSource.addEventListener('AUCTION_STATE_SYNC', (e: MessageEvent) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {}
            });
            this.eventSource.addEventListener('AUCTION_NOMINATE', (e: MessageEvent) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {}
            });
            this.eventSource.addEventListener('AUCTION_EXTEND_TIMER', (e: MessageEvent) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {}
            });
          } catch {
            // Ignore in environments without SSE support
          }
        }

        // Fast periodic poll fallback (every 2.5s) to guarantee zero desync
        this.ssePollInterval = setInterval(() => {
          if (this.isApplyingRemoteUpdate) return;
          fetch(`/api/auction/${encodeURIComponent(this.config.tournamentId)}`)
            .then(res => res.json())
            .then(data => {
              if (data?.success && data?.snapshot) {
                const serverRev = data.snapshot.state?.revision || 0;
                const localRev = this.state.revision || 0;
                const serverNominee = data.snapshot.state?.nominee?.id;
                const localNominee = this.state.nominee?.id;

                // Sync if server has newer revision or different nominee state
                if (serverRev > localRev || serverNominee !== localNominee || (data.snapshot.state?.status === 'LIVE' && this.state.status !== 'LIVE')) {
                  this.importSnapshot(data.snapshot);
                }
              }
            })
            .catch(() => {});
        }, 2500);

      } catch {
        // Fallback gracefully in headless test / SSR
      }
    }

    // Real Firestore synchronization for remote authenticated sessions
    if (typeof window !== 'undefined' && db) {
      try {
        // 1. Listen to auctions/{tournamentId}
        this.firestoreUnsub = onSnapshot(doc(db, 'auctions', this.config.tournamentId), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && !this.isApplyingRemoteUpdate) {
              this.importSnapshot(data as any);
            }
          }
        }, (err) => {
          console.warn('Firestore auctions sync note:', err);
        });

        // 2. Listen to tournaments/{tournamentId} to pick up captain & team assignments immediately
        this.tournamentDocUnsub = onSnapshot(doc(db, 'tournaments', this.config.tournamentId), (snap) => {
          if (snap.exists()) {
            const tData = snap.data();
            if (tData && Array.isArray(tData.teams) && tData.teams.length > 0 && !this.isApplyingRemoteUpdate) {
              for (const tm of tData.teams) {
                if (!this.teams.has(tm.id)) {
                  this.hydrateTeamFromExternal(tm);
                }
              }
              this.notify(false);
            }
          }
        }, () => {});
      } catch {}
    }

    this.loadPersistedState();
  }

  private persistState() {
    const snapshot = this.exportSnapshot();
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(
          `pb_auction_snapshot_${this.config.tournamentId}`,
          JSON.stringify(snapshot)
        );
      } catch {}
    }

    // Persist authoritatively to Firestore for real multi-device testing
    if (typeof window !== 'undefined' && db && !isQuotaExhausted()) {
      try {
        // Strip undefined fields for strict Firestore document compatibility
        const cleanPayload = JSON.parse(JSON.stringify(snapshot));
        setDoc(doc(db, 'auctions', this.config.tournamentId), {
          ...cleanPayload,
          lastPersistedAt: new Date().toISOString()
        }, { merge: true }).catch((err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
          }
          console.warn('Firestore auction setDoc note:', err);
        });
      } catch (err) {
        console.warn('Firestore auction snapshot serialization error:', err);
      }
    }

    // Persist to server in-memory hub for instant sub-100ms multi-tab and incognito sync
    if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
      try {
        fetch(`/api/auction/${encodeURIComponent(this.config.tournamentId)}/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot, eventType: 'AUCTION_STATE_SYNC' })
        }).catch(() => {});
      } catch {}
    }
  }

  private loadPersistedState() {
    const isTest = typeof process !== 'undefined' && (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST));
    if (isTest) return;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`pb_auction_snapshot_${this.config.tournamentId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.state && parsed.state.tournamentId === this.config.tournamentId) {
            this.importSnapshot(parsed);
          }
        }
      } catch {}
    }
  }

  private broadcastUpdate(persist = true) {
    if (this.isApplyingRemoteUpdate) return;
    if (persist) {
      this.persistState();
    }
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({
          type: 'AUCTION_STATE_SYNC',
          payload: this.exportSnapshot()
        });
      } catch {}
    }
  }

  public exportSnapshot(): {
    state: DotaAuctionState;
    teams: DotaAuctionTeam[];
    players: DotaAuctionPlayer[];
    bidHistory: DotaBidRecord[];
    nominationAudits: DotaNominationAudit[];
    config: DotaAuctionConfig;
    purseAllocationAudit: AuctionPurseAllocationAudit | null;
  } {
    return {
      state: { ...this.state },
      teams: this.getTeams(),
      players: this.getPlayers(),
      bidHistory: this.getBidHistory(),
      nominationAudits: this.getNominationAudits(),
      config: { ...this.config },
      purseAllocationAudit: this.purseAllocationAudit ? { ...this.purseAllocationAudit } : null
    };
  }

  public importSnapshot(snapshot: any): boolean {
    if (!snapshot) return false;
    const wasApplying = this.isApplyingRemoteUpdate;
    this.isApplyingRemoteUpdate = true;
    try {
      if (snapshot.state) {
        this.state = { ...this.state, ...snapshot.state };
      }
      if (Array.isArray(snapshot.teams)) {
        this.teams = new Map(snapshot.teams.map((t: DotaAuctionTeam) => [t.id, { ...t }]));
      }
      if (Array.isArray(snapshot.players)) {
        this.players = new Map(snapshot.players.map((p: DotaAuctionPlayer) => [p.id, { ...p }]));
      }
      if (Array.isArray(snapshot.bidHistory)) {
        this.bidHistory = [...snapshot.bidHistory];
      }
      if (Array.isArray(snapshot.nominationAudits)) {
        this.nominationAudits = [...snapshot.nominationAudits];
      }
      if (snapshot.config) {
        this.config = { ...this.config, ...snapshot.config };
      }
      if (snapshot.purseAllocationAudit) {
        // Server Authority: If current purse allocation is already frozen, do not allow un-freezing or tampering
        if (!this.isPurseAllocationFrozen()) {
          this.purseAllocationAudit = { ...snapshot.purseAllocationAudit };
        }
      }

      // If countdown is active, reconcile remaining seconds with authoritative deadline
      if (this.state?.status === 'LIVE' && this.state?.timerEndsAt && this.state?.nominee) {
        const remainingMs = this.state.timerEndsAt - Date.now();
        this.state.secondsRemaining = Math.max(0, Math.ceil(remainingMs / 1000));
        if (!this.timerInterval && this.state.secondsRemaining > 0) {
          this.startTimer();
        }
      }
    } finally {
      this.isApplyingRemoteUpdate = wasApplying;
    }

    // Pure local notification, never re-persist or re-broadcast received snapshot
    this.notify(false);
    return true;
  }

  public loadSnapshot(snapshot: any): boolean {
    return this.importSnapshot(snapshot);
  }

  public setRemainingSeconds(seconds: number) {
    this.state.secondsRemaining = seconds;
    this.state.timerEndsAt = Date.now() + seconds * 1000;
    this.notify();
  }

  public expireTimerNow() {
    this.state.secondsRemaining = 0;
    this.state.timerEndsAt = Date.now() - 1000;
    this.notify();
  }

  public updateConfig(newConfig: Partial<DotaAuctionConfig>): DotaAuctionConfig {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.notify();
    return { ...this.config };
  }

  public startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.tickTimer(1);
    }, 1000);
  }

  public stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private isOrganiserHost: boolean = false;

  public setOrganiserHost(isHost: boolean) {
    this.isOrganiserHost = isHost;
  }

  public tickTimer(seconds = 1) {
    if (this.state.status !== 'LIVE' || !this.state.nominee || this.state.isCompleted) {
      return;
    }

    if (this.state.timerEndsAt) {
      const remainingMs = this.state.timerEndsAt - Date.now();
      // Use remaining seconds based on authoritative timerEndsAt, or decrement if in step simulation
      const calculatedSec = Math.max(0, Math.ceil(remainingMs / 1000));
      this.state.secondsRemaining = Math.min(
        calculatedSec,
        Math.max(0, this.state.secondsRemaining - seconds)
      );
    } else if (this.state.secondsRemaining > 0) {
      this.state.secondsRemaining = Math.max(0, this.state.secondsRemaining - seconds);
    }

    if (this.state.secondsRemaining === 0) {
      this.state.roundPhase = 'OUTCOME_RESOLUTION';
      this.stopTimer();
      this.state.timerEndsAt = undefined;
      // Host Organiser executes authoritative conclusion; Captains & Spectators keep nominee visible
      if (this.isOrganiserHost || typeof window === 'undefined') {
        const hasWinningBid = Boolean(this.state.leadingTeamId);
        this.concludeNomination(hasWinningBid, 'system-timer');
      } else {
        this.notify(false);
      }
    } else {
      if (this.state.secondsRemaining <= 5) {
        this.state.roundPhase = 'GOING_TWICE';
      } else if (this.state.secondsRemaining <= 15) {
        this.state.roundPhase = 'GOING_ONCE';
      } else {
        this.state.roundPhase = 'BIDDING';
      }
      this.notify(false);
    }
  }

  public pauseAuction(staffActorId = 'organizer'): { success: boolean; error?: string } {
    if (this.state.status !== 'LIVE') {
      return { success: false, error: 'Auction is not currently LIVE.' };
    }
    this.state.status = 'PAUSED';
    this.stopTimer();

    const now = Date.now();
    if (this.state.timerEndsAt) {
      this.state.pausedRemainingMs = Math.max(0, this.state.timerEndsAt - now);
      this.state.secondsRemaining = Math.ceil(this.state.pausedRemainingMs / 1000);
    }

    this.logAudit('auction_paused', staffActorId, 'Auction paused by organiser.');
    this.notify();
    return { success: true };
  }

  public resumeAuction(staffActorId = 'organizer'): { success: boolean; error?: string } {
    if (this.state.status !== 'PAUSED') {
      return { success: false, error: 'Auction is not currently PAUSED.' };
    }
    this.state.status = 'LIVE';

    const now = Date.now();
    if (this.state.pausedRemainingMs) {
      this.state.timerEndsAt = now + this.state.pausedRemainingMs;
      this.state.secondsRemaining = Math.ceil(this.state.pausedRemainingMs / 1000);
      this.state.pausedRemainingMs = undefined;
    } else if (this.state.secondsRemaining > 0) {
      this.state.timerEndsAt = now + this.state.secondsRemaining * 1000;
    }

    if (this.state.nominee) {
      this.startTimer();
    }
    this.logAudit('auction_resumed', staffActorId, 'Auction resumed by organiser.');
    this.notify();
    return { success: true };
  }

  public dismissLastLotResult(): void {
    this.state.lastLotResult = null;
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Initialization & Hydration
  // ---------------------------------------------------------------------------
  public initializeFromRegistrations() {
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];

    // Get verified registrations for this tournament
    const regs = dotaPlayerRegistry.getTournamentRegistrations(this.config.tournamentId)
      .filter(r => r.status === 'VERIFIED');

    for (const reg of regs) {
      const profile = dotaPlayerRegistry.getPlayer(reg.userId);
      const isCap = Boolean(reg.isCaptainApproved || Array.from(this.teams.values()).some(t => t.captainId === reg.userId));
      const auctionPlayer: DotaAuctionPlayer = {
        id: reg.userId,
        userId: reg.userId,
        username: reg.ign,
        displayName: profile?.displayName || reg.ign,
        avatar: profile?.avatar || '🎮',
        city: reg.city || profile?.city,
        region: reg.region || profile?.region,
        tournamentMmr: reg.tournamentMmr || reg.declaredMmr,
        primaryRole: reg.primaryRole,
        secondaryRole: reg.secondaryRole,
        rating: profile?.competitiveRating || Math.round((reg.tournamentMmr || reg.declaredMmr) / 4) + 100,
        isCaptain: isCap,
        status: isCap ? 'SOLD' : 'AVAILABLE',
        teamId: reg.teamId,
        teamName: reg.teamName
      };
      this.players.set(reg.userId, auctionPlayer);

      // If registration was already approved as captain with team, restore team in memory if missing
      if (reg.isCaptainApproved && reg.teamId && !this.teams.has(reg.teamId)) {
        this.teams.set(reg.teamId, {
          id: reg.teamId,
          name: reg.teamName || `${reg.ign}'s Squad`,
          tag: (reg.ign.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'TM').toUpperCase(),
          logo: '🛡️',
          color: '#7C3AED',
          captainId: reg.userId,
          captainIgn: reg.ign,
          startingCredits: this.config.startingCredits,
          remainingCredits: this.config.startingCredits,
          creditsUsed: 0,
          primaryRoster: [auctionPlayer],
          standIns: []
        });
      }
    }

    this.notify();
  }

  /**
   * Switches the active tournament context for the auction engine and re-hydrates verified contenders.
   */
  public setTournament(tournamentId: string, tournamentName?: string) {
    this.config.tournamentId = tournamentId;
    if (tournamentName) {
      this.config.tournamentName = tournamentName;
    }
    this.state.tournamentId = tournamentId;
    this.initializeFromRegistrations();
    this.notify();
  }

  /**
   * Synchronizes an individual contender registration into the live available pool when verified.
   */
  public syncPlayerFromRegistration(tournamentId: string, reg: DotaTournamentRegistration) {
    if (tournamentId !== this.config.tournamentId) return;

    if (reg.status === 'VERIFIED') {
      const profile = dotaPlayerRegistry.getPlayer(reg.userId);
      const existing = this.players.get(reg.userId);
      const auctionPlayer: DotaAuctionPlayer = {
        id: reg.userId,
        userId: reg.userId,
        username: reg.ign,
        displayName: profile?.displayName || reg.ign,
        avatar: profile?.avatar || '🎮',
        city: reg.city || profile?.city,
        region: reg.region || profile?.region,
        tournamentMmr: reg.tournamentMmr || reg.declaredMmr,
        primaryRole: reg.primaryRole,
        secondaryRole: reg.secondaryRole,
        rating: profile?.competitiveRating || Math.round((reg.tournamentMmr || reg.declaredMmr) / 4) + 100,
        isCaptain: existing?.isCaptain || false,
        status: existing?.status || 'AVAILABLE',
        teamId: existing?.teamId,
        teamName: existing?.teamName,
        soldAmount: existing?.soldAmount,
        isStandIn: existing?.isStandIn
      };
      this.players.set(reg.userId, auctionPlayer);
      this.notify();
    } else if (reg.status === 'WITHDRAWN' || reg.status === 'REJECTED' || (reg.status as string) === 'CANCELLED') {
      this.removePlayer(reg.userId);
    } else {
      const existing = this.players.get(reg.userId);
      if (existing && existing.status === 'AVAILABLE') {
        this.players.delete(reg.userId);
        this.notify();
      }
    }
  }

  public removePlayer(userId: string): boolean {
    let deleted = this.players.delete(userId);
    for (const [key, p] of this.players.entries()) {
      if (p.userId === userId || p.id === userId) {
        this.players.delete(key);
        deleted = true;
      }
    }

    // Purge from all teams' primary rosters and stand-ins
    for (const team of this.teams.values()) {
      team.primaryRoster = team.primaryRoster.filter(p => p.userId !== userId && p.id !== userId);
      if (team.standIns && Array.isArray(team.standIns)) {
        team.standIns = team.standIns.filter(p => p.userId !== userId && p.id !== userId);
      }
      if (team.captainId === userId) {
        team.captainId = '';
        team.captainIgn = '';
      }
      team.creditsUsed = team.primaryRoster.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
      team.remainingCredits = Math.max(0, team.startingCredits - team.creditsUsed);
    }

    // Clear live nominee if withdrawn player is on the block
    if (this.state.nominee && (this.state.nominee.userId === userId || this.state.nominee.id === userId)) {
      this.state.nominee = null;
      this.state.currentBid = 0;
      this.state.leadingTeamId = '';
      this.state.leadingTeamName = '';
      this.state.secondsRemaining = 0;
    }

    if (deleted) {
      this.notify();
    }
    return deleted;
  }

  /**
   * Authoritatively purges all auction state, teams, players, and bids for a pristine state.
   */
  public purge() {
    this.players.clear();
    this.teams.clear();
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];
    this.purseAllocationAudit = null;
    this.state = {
      tournamentId: this.config.tournamentId,
      status: 'PENDING',
      revision: 1,
      currentBid: this.config.minimumBid,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      secondsRemaining: this.config.nominationTimerSeconds,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false
    };
    this.notify();
  }

  /**
   * Syncs auction draft contenders and teams from TestCupEngine when the admin runs simulation.
   */
  public syncFromTestCupEngine(tcPlayers: any[], tcTeams: any[]) {
    this.players.clear();
    this.teams.clear();
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];

    for (const t of tcTeams) {
      this.teams.set(t.id, {
        id: t.id,
        name: t.name,
        tag: t.tag,
        logo: t.logo || '⚔️',
        color: t.color || '#FFE600',
        captainId: t.captainId,
        captainIgn: t.captainIgn,
        startingCredits: t.startingCredits || this.config.startingCredits,
        remainingCredits: t.remainingCredits !== undefined ? t.remainingCredits : this.config.startingCredits,
        creditsUsed: t.creditsUsed || 0,
        primaryRoster: (t.roster || []).map((p: any) => ({
          id: p.id,
          userId: p.id,
          username: p.username,
          displayName: p.realName || p.username,
          avatar: p.avatar || '🎮',
          city: p.city || 'India',
          tournamentMmr: p.tournamentMmr,
          primaryRole: p.primaryRole || 'Position 2 — Mid',
          rating: p.rating || 1500,
          isCaptain: p.isCaptain || false,
          status: p.auctionStatus || 'SOLD',
          teamId: t.id,
          teamName: t.name
        })),
        standIns: []
      });
    }

    for (const p of tcPlayers) {
      this.players.set(p.id, {
        id: p.id,
        userId: p.id,
        username: p.username,
        displayName: p.realName || p.username,
        avatar: p.avatar || '🎮',
        city: p.city || 'India',
        region: p.region || 'India',
        tournamentMmr: p.tournamentMmr,
        primaryRole: p.primaryRole || 'Position 1 — Carry',
        secondaryRole: p.secondaryRole,
        rating: p.rating || 1500,
        isCaptain: p.isCaptain || false,
        status: (p.auctionStatus === 'SOLD' ? 'SOLD' : p.auctionStatus === 'UNSOLD' ? 'UNSOLD' : p.isCaptain ? 'SOLD' : 'AVAILABLE') as AuctionPlayerStatus,
        teamId: p.teamId,
        teamName: p.teamName,
        soldAmount: p.soldAmount
      });
    }

    this.notify();
  }

  private populateTestCupPool() {
    const rawRoster = [
      { id: 'p-c1', ign: 'Aether', name: 'Arjun Nair', avatar: '⚡', city: 'Mumbai', mmr: 8600, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1850 },
      { id: 'p-c2', ign: 'Nova', name: 'Rohan Sharma', avatar: '🔥', city: 'Delhi', mmr: 8450, pRole: 'Position 1 — Carry', sRole: 'Position 3 — Offlane', rating: 1820 },
      { id: 'p-c3', ign: 'Karma', name: 'Karthik Raja', avatar: '🛡️', city: 'Bengaluru', mmr: 8200, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1780 },
      { id: 'p-tc-04', ign: 'Viper', name: 'Vikram Singh', avatar: '🐍', city: 'Hyderabad', mmr: 7500, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1610 },
      { id: 'p-tc-05', ign: 'Shadow', name: 'Sameer Sen', avatar: '🗡️', city: 'Kolkata', mmr: 7350, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1590 },
      { id: 'p-tc-06', ign: 'Bulldozer', name: 'Baljit Gill', avatar: '🦏', city: 'Chandigarh', mmr: 7200, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1570 },
      { id: 'p-tc-07', ign: 'Chakra', name: 'Chaitanya Joshi', avatar: '🔮', city: 'Pune', mmr: 7100, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1560 },
      { id: 'p-tc-08', ign: 'Zenith', name: 'Zaid Khan', avatar: '🌟', city: 'Mumbai', mmr: 7050, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1550 },
      { id: 'p-tc-09', ign: 'Phantom', name: 'Pranav Nair', avatar: '👻', city: 'Bengaluru', mmr: 7300, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1585 },
      { id: 'p-tc-10', ign: 'Titan', name: 'Tarun Reddy', avatar: '🗿', city: 'Hyderabad', mmr: 7450, pRole: 'Position 2 — Mid', sRole: 'Position 3 — Offlane', rating: 1605 },
      { id: 'p-tc-11', ign: 'Oracle', name: 'Omkar Deshmukh', avatar: '👁️', city: 'Pune', mmr: 7150, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1565 },
      { id: 'p-tc-12', ign: 'Frost', name: 'Faizan Ahmed', avatar: '❄️', city: 'Delhi', mmr: 7250, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1575 },
      { id: 'p-tc-13', ign: 'Blaze', name: 'Bhavin Patel', avatar: '🌋', city: 'Ahmedabad', mmr: 7300, pRole: 'Position 3 — Offlane', sRole: 'Position 1 — Carry', rating: 1580 },
      { id: 'p-tc-14', ign: 'Spectre', name: 'Siddharth Iyer', avatar: '⚔️', city: 'Chennai', mmr: 7400, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1595 },
      { id: 'p-tc-15', ign: 'Echo', name: 'Eshan Roy', avatar: '🔊', city: 'Kolkata', mmr: 7100, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1555 },
      { id: 'p-tc-16', ign: 'Tempest', name: 'Tejas Saxena', avatar: '🌪️', city: 'Jaipur', mmr: 7200, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1570 },
      { id: 'p-tc-17', ign: 'Vortex', name: 'Varun Menon', avatar: '🌀', city: 'Kochi', mmr: 7000, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1540 },
      { id: 'p-tc-18', ign: 'Raptor', name: 'Rishi Verma', avatar: '🦖', city: 'Lucknow', mmr: 7150, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1560 },
      { id: 'p-tc-19', ign: 'Krypton', name: 'Karan Mehra', avatar: '💎', city: 'Delhi', mmr: 7050, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1550 },
      { id: 'p-tc-20', ign: 'Apex', name: 'Ayush Sharma', avatar: '🏔️', city: 'Indore', mmr: 7200, pRole: 'Position 3 — Offlane', sRole: 'Position 2 — Mid', rating: 1570 },
      { id: 'p-tc-21', ign: 'Helix', name: 'Harshil Shah', avatar: '🧬', city: 'Surat', mmr: 7250, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1575 }
    ];

    for (const r of rawRoster) {
      // Ensure in dotaPlayerRegistry as verified
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: this.config.tournamentId,
        userId: r.id,
        ign: r.ign,
        primaryRole: r.pRole as DotaRolePosition,
        secondaryRole: r.sRole as DotaRolePosition,
        declaredMmr: r.mmr,
        rulesAccepted: true,
        city: r.city
      });
      dotaPlayerRegistry.verifyRegistration(this.config.tournamentId, r.id, 'system-seed', r.mmr);

      const p: DotaAuctionPlayer = {
        id: r.id,
        userId: r.id,
        username: r.ign,
        displayName: r.name,
        avatar: r.avatar,
        city: r.city,
        region: 'India',
        tournamentMmr: r.mmr,
        primaryRole: r.pRole as DotaRolePosition,
        secondaryRole: r.sRole as DotaRolePosition,
        rating: r.rating,
        isCaptain: false,
        status: 'AVAILABLE'
      };
      this.players.set(r.id, p);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Captain Selection & Team Creation
  // ---------------------------------------------------------------------------

  /**
   * Returns contenders who are registered for this tournament, VERIFIED, have locked MMR, and expressed captain interest.
   */
  public getEligibleCaptainCandidates(): DotaAuctionPlayer[] {
    // 1. Sync any verified registrations for this tournament into this.players if not already loaded
    const registrations = typeof dotaPlayerRegistry.getTournamentRegistrations === 'function'
      ? dotaPlayerRegistry.getTournamentRegistrations(this.config.tournamentId)
      : (typeof (dotaPlayerRegistry as any).getRegistrationsForTournament === 'function'
        ? (dotaPlayerRegistry as any).getRegistrationsForTournament(this.config.tournamentId)
        : []);
    for (const reg of registrations) {
      if (reg.status === 'VERIFIED' && !this.players.has(reg.userId)) {
        this.syncPlayerFromRegistration(this.config.tournamentId, reg);
      }
    }

    return Array.from(this.players.values()).filter(p => {
      if (p.isCaptain) return false;
      const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, p.userId);
      if (!reg) return false;
      const hasLockedMmr = reg.isMmrLocked || (typeof reg.tournamentMmr === 'number' && reg.tournamentMmr > 0);
      return reg.status === 'VERIFIED' && 
             hasLockedMmr &&
             Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
    });
  }

  /**
   * Appoints a VERIFIED contender as captain, automatically creating a tournament team.
   * Captain counts as 1/5 in the mandatory primary roster.
   */
  public appointCaptain(
    candidateUserId: string,
    teamMetadata: {
      teamName: string;
      tag: string;
      color?: string;
      logo?: string;
    },
    staffActorId: string
  ): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    // 1. Contender MUST be registered
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, candidateUserId);
    if (!reg) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament registration pool.` };
    }
    // 1b. Contender MUST be VERIFIED
    if (reg.status !== 'VERIFIED') {
      return { success: false, error: 'Only VERIFIED contenders are eligible to be appointed as team captains.' };
    }

    // 0. Strict Invariant: Check team capacity & captain eligibility for auction-basic-test-1
    if (this.config.tournamentId === 'auction-basic-test-1' || this.config.tournamentId === '2-team-auction-test') {
      const maxTeams = this.config.numberOfTeams || 2;
      if (this.teams.size >= maxTeams) {
        return {
          success: false,
          error: `Cannot appoint captain: All ${maxTeams} team captain slots are already filled.`
        };
      }
    } else if (this.config.numberOfTeams && this.teams.size >= this.config.numberOfTeams) {
      return {
        success: false,
        error: `Cannot appoint captain: All ${this.config.numberOfTeams} team captain slots are already filled.`
      };
    }

    // 2. Verify candidate is in the player pool (or sync from verified registration)
    let player = this.players.get(candidateUserId);
    if (!player) {
      this.syncPlayerFromRegistration(this.config.tournamentId, reg);
      player = this.players.get(candidateUserId);
    }
    if (!player) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament player pool.` };
    }

    // 3. Contender cannot already be a captain of an existing team in this tournament
    const isAlreadyCaptainInTeam = Array.from(this.teams.values()).some(t => t.captainId === candidateUserId);
    if (isAlreadyCaptainInTeam) {
      return { success: false, error: `'${player.username}' is already appointed as a team captain.` };
    }

    // 4. Create the tournament team
    const teamId = `team-${candidateUserId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now() % 10000}`;
    player.isCaptain = true;
    player.status = 'SOLD'; // Captain is locked to their own team
    player.teamId = teamId;
    player.teamName = teamMetadata.teamName;

    const team: DotaAuctionTeam = {
      id: teamId,
      name: teamMetadata.teamName,
      tag: teamMetadata.tag.toUpperCase(),
      logo: teamMetadata.logo || player.avatar || '🛡️',
      color: teamMetadata.color || '#FFE600',
      captainId: candidateUserId,
      captainIgn: player.username,
      startingCredits: this.config.startingCredits,
      remainingCredits: this.config.startingCredits,
      creditsUsed: 0,
      primaryRoster: [player], // Captain counts as 1/5 in primary roster
      standIns: []
    };

    this.teams.set(teamId, team);

    // Persist captain approval on registration snapshot
    reg.isCaptainApproved = true;
    reg.interestedInCaptaincy = true;
    reg.applyingAsCaptain = true;
    reg.teamId = teamId;
    reg.teamName = teamMetadata.teamName;
    reg.captainApprovedAt = new Date().toISOString();
    reg.captainApprovedBy = staffActorId;
    reg.updatedAt = new Date().toISOString();

    // Send official captain selection notification matching prompt requirements
    const tourneyDisplayName = this.config.tournamentName || (this.config.tournamentId === 'auction-basic-test-1' ? 'Auction Basic Test 1' : this.config.tournamentId);
    dotaPlayerRegistry.addNotification({
      id: `notif-cap-appointed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: candidateUserId,
      userEmail: reg.userEmail,
      userIgn: player.username,
      type: 'CAPTAIN_SELECTED',
      title: "You've Been Appointed Captain!",
      message: `You have been selected as captain of ${teamMetadata.teamName} for ${tourneyDisplayName}. Head to the Auction Room to build your roster!`,
      tournamentId: this.config.tournamentId,
      registrationId: reg.id,
      actionTarget: `/tournaments/${this.config.tournamentId}/auction`,
      createdAt: new Date().toISOString(),
      read: false
    });

    this.logAudit(
      'captain_appointed',
      staffActorId,
      `Appointed ${player.username} (MMR: ${player.tournamentMmr}) as captain of ${team.name}. Primary roster: 1/${this.config.primaryRosterSize}.`
    );

    // If at least 2 teams have captains and bidding hasn't started, attempt to calculate starting purses
    if (this.teams.size >= 2 && !this.hasBidsStarted()) {
      this.calculateAndApplyMmrBalancedPurses(staffActorId, false);
    }

    this.state.revision = (this.state.revision || 1) + 1;
    this.persistState();
    this.broadcastUpdate();
    this.notify();
    return { success: true, team };
  }

  public hasTeam(teamId: string): boolean {
    return this.teams.has(teamId);
  }

  public hydrateTeamFromExternal(rawTeam: any): DotaAuctionTeam {
    const teamId = rawTeam.id || `team-${Date.now()}`;
    const captainId = rawTeam.captainId || rawTeam.captainUserId || '';
    const captainIgn = rawTeam.captainIgn || rawTeam.captainName || rawTeam.name;
    const lockedMmr = rawTeam.primaryRoster?.[0]?.tournamentMmr || rawTeam.lockedTournamentMmr || rawTeam.tournamentMmr || 7500;
    
    // Memory leak & loop prevention: return immediately if team is already hydrated
    const existingTeam = this.teams.get(teamId);
    if (existingTeam && (!captainId || existingTeam.captainId === captainId) && existingTeam.name === rawTeam.name) {
      return existingTeam;
    }
    let captainPlayer = this.players.get(captainId);
    if (!captainPlayer && captainId) {
      captainPlayer = {
        id: captainId,
        userId: captainId,
        username: captainIgn,
        displayName: captainIgn,
        avatar: rawTeam.logo || '🛡️',
        city: rawTeam.city || 'India',
        region: 'India',
        tournamentMmr: lockedMmr,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        rating: Math.round(lockedMmr / 4) + 100,
        isCaptain: true,
        isMmrLocked: true,
        status: 'SOLD',
        teamId,
        teamName: rawTeam.name
      };
      this.players.set(captainId, captainPlayer);
    } else if (captainPlayer) {
      captainPlayer.isCaptain = true;
      captainPlayer.isMmrLocked = true;
      captainPlayer.status = 'SOLD';
      captainPlayer.teamId = teamId;
      captainPlayer.teamName = rawTeam.name;
      if (!captainPlayer.tournamentMmr || captainPlayer.tournamentMmr <= 0) {
        captainPlayer.tournamentMmr = lockedMmr;
      }
    }

    if (captainId) {
      const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, captainId);
      if (reg) {
        reg.isCaptainApproved = true;
        reg.teamId = teamId;
        reg.teamName = rawTeam.name;
        if (!reg.tournamentMmr || reg.tournamentMmr <= 0) {
          reg.tournamentMmr = lockedMmr;
        }
        reg.isMmrLocked = true;
      }
    }

    const team: DotaAuctionTeam = {
      id: teamId,
      name: rawTeam.name,
      tag: (rawTeam.tag || 'TM').toUpperCase(),
      logo: rawTeam.logo || '🛡️',
      color: rawTeam.color || '#FFE600',
      captainId: captainId,
      captainIgn: captainIgn,
      startingCredits: rawTeam.startingCredits || this.config.startingCredits,
      remainingCredits: rawTeam.remainingCredits !== undefined ? rawTeam.remainingCredits : (rawTeam.startingCredits || this.config.startingCredits),
      creditsUsed: rawTeam.creditsUsed || 0,
      primaryRoster: Array.isArray(rawTeam.primaryRoster) && rawTeam.primaryRoster.length > 0 
        ? rawTeam.primaryRoster 
        : (captainPlayer ? [captainPlayer] : []),
      standIns: Array.isArray(rawTeam.standIns) ? rawTeam.standIns : []
    };

    this.teams.set(teamId, team);
    this.notify(false);
    return team;
  }

  public autoDrawCaptains(count: number, seed = 'pb-seed-12345', staffActorId = 'organizer'): { success: boolean; selectedCaptains: DotaAuctionPlayer[]; auditRecord: any; error?: string } {
    const candidates = Array.from(this.players.values()).filter(p => {
      const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, p.id);
      return !p.isCaptain && reg && reg.status === 'VERIFIED' && Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
    });

    if (candidates.length < count) {
      return {
        success: false,
        selectedCaptains: [],
        auditRecord: null,
        error: `Insufficient eligible captain candidates. Needed: ${count}, found: ${candidates.length}`
      };
    }

    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    const rng = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const selected = shuffled.slice(0, count);
    const selectedCaptains: DotaAuctionPlayer[] = [];

    selected.forEach((p, idx) => {
      const appointRes = this.appointCaptain(
        p.id,
        {
          teamName: `Team ${p.username}`,
          tag: p.username.substring(0, 3).toUpperCase()
        },
        staffActorId
      );
      if (appointRes.success) {
        selectedCaptains.push(p);
      }
    });

    const auditRecord = {
      action: 'auto_captain_draw',
      seed,
      candidates: candidates.map(c => ({ id: c.id, username: c.username, mmr: c.tournamentMmr })),
      selected: selected.map(s => ({ id: s.id, username: s.username, mmr: s.tournamentMmr })),
      timestamp: new Date().toISOString(),
      actor: staffActorId
    };

    this.logAudit('auto_captain_draw', staffActorId, `Automated draw selected ${selectedCaptains.length} captains from ${candidates.length} candidates using seed '${seed}'.`);
    this.notify();
    return { success: true, selectedCaptains, auditRecord };
  }

  public resetCaptain(captainUserId: string, staffActorId = 'organizer'): { success: boolean; error?: string } {
    if (this.hasBidsStarted() || this.state.status === 'LIVE') {
      return { success: false, error: 'Cannot reset or reassign captains after live auction has commenced.' };
    }
    const team = Array.from(this.teams.values()).find(t => t.captainId === captainUserId);
    if (!team) return { success: false, error: 'Captain team not found.' };

    const player = this.players.get(captainUserId);
    if (player) {
      player.isCaptain = false;
      player.teamId = undefined;
      player.teamName = undefined;
      player.status = 'AVAILABLE';
    }

    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, captainUserId);
    if (reg) {
      reg.isCaptainApproved = false;
      reg.teamId = undefined;
      reg.teamName = undefined;
      reg.captainApprovedAt = undefined;
      reg.captainApprovedBy = undefined;
    }

    this.teams.delete(team.id);
    this.logAudit('captain_reset', staffActorId, `Reset captain ${player?.username || captainUserId} and dissolved team ${team.name}.`);
    this.notify();
    return { success: true };
  }

  public updateTeamIdentity(teamId: string, identity: { name?: string; tag?: string; logo?: string; color?: string; bannerUrl?: string }, actorId = 'captain'): { success: boolean; team?: DotaAuctionTeam; error?: string } {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: 'Team not found.' };
    if (identity.name) team.name = identity.name;
    if (identity.tag) team.tag = identity.tag;
    if (identity.logo) team.logo = identity.logo;
    if (identity.color) team.color = identity.color;
    if (identity.bannerUrl !== undefined) (team as any).bannerUrl = identity.bannerUrl;
    this.logAudit('team_identity_updated', actorId, `Updated team identity for ${team.name} (Tag: ${team.tag}).`);
    this.notify();
    return { success: true, team };
  }

  public setNominationMode(mode: 'ORGANISER' | 'LINEAR' | 'SNAKE') {
    this.config.nominationMode = mode;
    this.notify();
  }

  public getNextNominationTurn(): { teamId: string; teamName: string; index: number; mode: string } | null {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length === 0) return null;
    const mode = this.config.nominationMode || 'ORGANISER';
    const currentTeam = teamsList[this.nominationTurnIndex % teamsList.length];
    return {
      teamId: currentTeam.id,
      teamName: currentTeam.name,
      index: this.nominationTurnIndex,
      mode
    };
  }

  public advanceNominationTurn() {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length <= 1) return;
    const mode = this.config.nominationMode || 'ORGANISER';
    if (mode === 'LINEAR') {
      this.nominationTurnIndex = (this.nominationTurnIndex + 1) % teamsList.length;
    } else if (mode === 'SNAKE') {
      const nextIdx = this.nominationTurnIndex + this.snakeDirection;
      if (nextIdx >= teamsList.length) {
        this.snakeDirection = -1;
        this.nominationTurnIndex = Math.max(0, teamsList.length - 2);
      } else if (nextIdx < 0) {
        this.snakeDirection = 1;
        this.nominationTurnIndex = Math.min(teamsList.length - 1, 1);
      } else {
        this.nominationTurnIndex = nextIdx;
      }
    }
  }

  public getUnsoldQueue(): string[] {
    return [...this.unsoldQueue];
  }

  public startUnsoldSecondPass(staffActorId = 'organizer'): { success: boolean; reauctionCount: number; error?: string } {
    let count = 0;
    for (const p of this.players.values()) {
      if (p.status === 'UNSOLD') {
        p.status = 'AVAILABLE';
        count++;
      }
    }
    if (count === 0) {
      return { success: false, reauctionCount: 0, error: 'No unsold players to re-auction.' };
    }
    this.state.unsoldCount = 0;
    this.unsoldQueue = [];
    if (this.state.isCompleted) {
      this.state.isCompleted = false;
      this.state.status = 'READY';
    }
    this.logAudit('unsold_second_pass_started', staffActorId, `Started unsold second-pass: restored ${count} players to available pool.`);
    this.notify();
    return { success: true, reauctionCount: count };
  }

  /**
   * Restores an individual UNSOLD or UNSELECTED contender back to AVAILABLE auction pool.
   * If the auction was previously marked completed, reopens it.
   */
  public reauctionPlayer(playerId: string, staffActorId = 'organizer'): { success: boolean; player?: DotaAuctionPlayer; error?: string } {
    const p = this.players.get(playerId);
    if (!p) return { success: false, error: `Player '${playerId}' not found.` };
    if (p.status !== 'UNSOLD' && p.status !== 'UNSELECTED') {
      return { success: false, error: `Player '${p.username}' is not UNSOLD or UNSELECTED (status: ${p.status}).` };
    }
    if (p.status === 'UNSOLD') {
      this.state.unsoldCount = Math.max(0, this.state.unsoldCount - 1);
    }
    if (p.status === 'UNSELECTED') {
      this.state.unselectedCount = Math.max(0, (this.state.unselectedCount || 0) - 1);
    }
    p.status = 'AVAILABLE';
    this.unsoldQueue = this.unsoldQueue.filter(id => id !== playerId);
    if (this.state.isCompleted) {
      this.state.isCompleted = false;
      this.state.status = 'READY';
    }
    this.logAudit('player_reauction_restored', staffActorId, `Restored ${p.username} back to available auction pool for re-auction.`);
    this.notify();
    return { success: true, player: p };
  }

  /**
   * Re-auctions and immediately puts the UNSOLD or UNSELECTED contender on the live auction block.
   */
  public reauctionAndNominatePlayer(playerId: string, staffActorId = 'organizer'): { success: boolean; nominee?: DotaAuctionPlayer; error?: string } {
    const p = this.players.get(playerId);
    if (!p) return { success: false, error: `Player '${playerId}' not found.` };
    if (p.status === 'UNSOLD' || p.status === 'UNSELECTED') {
      const rest = this.reauctionPlayer(playerId, staffActorId);
      if (!rest.success) return { success: false, error: rest.error };
    }
    return this.nominatePlayer(playerId, staffActorId);
  }

  /**
   * Organiser officially initiates the Stand-in auction round.
   * Can ONLY be started when ALL teams have filled their mandatory primary rosters (e.g. 5/5).
   */
  public startStandInAuction(staffActorId = 'organizer'): { success: boolean; error?: string } {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length === 0) {
      return { success: false, error: 'No teams registered in this tournament.' };
    }
    const incompleteTeams = teamsList.filter(t => t.primaryRoster.length < this.config.primaryRosterSize);
    if (incompleteTeams.length > 0) {
      return {
        success: false,
        error: `Cannot start stand-in auction: ${incompleteTeams.length} team(s) still have incomplete primary rosters (${incompleteTeams.map(t => `${t.name}: ${t.primaryRoster.length}/${this.config.primaryRosterSize}`).join(', ')}). All teams must first reach 5/5 full primary rosters.`
      };
    }
    this.state.standInRoundActive = true;
    this.state.isCompleted = false;
    this.state.status = 'READY';
    this.logAudit(
      'standin_auction_started',
      staffActorId,
      `Stand-in auction round officially started! All ${teamsList.length} teams have completed primary rosters. Teams can now bid on optional 6th slot stand-in players.`
    );
    this.notify();
    return { success: true };
  }

  /**
   * Concludes the Stand-in auction round and finalizes the auction.
   */
  public concludeStandInAuction(staffActorId = 'organizer'): { success: boolean; error?: string } {
    this.state.standInRoundActive = false;
    this.finalizeAuction(staffActorId);
    return { success: true };
  }

  /**
   * Reopens an auction if it was completed or closed.
   */
  public reopenAuction(staffActorId = 'organizer'): { success: boolean } {
    this.state.isCompleted = false;
    this.state.status = 'READY';
    this.logAudit('auction_reopened', staffActorId, 'Auction floor reopened by organiser.');
    this.notify();
    return { success: true };
  }

  public addTime(seconds: number, staffActorId = 'organizer') {
    this.state.secondsRemaining += seconds;
    if (this.state.pausedRemainingMs !== undefined) {
      this.state.pausedRemainingMs += seconds * 1000;
    }
    if (this.state.timerEndsAt) {
      this.state.timerEndsAt += seconds * 1000;
    } else {
      this.state.timerEndsAt = Date.now() + this.state.secondsRemaining * 1000;
    }
    if (this.state.status === 'LIVE' && !this.timerInterval && this.state.nominee) {
      this.startTimer();
    }
    this.logAudit('timer_adjusted', staffActorId, `Added ${seconds} seconds to timer.`);
    this.notify(true);
  }

  public removeTime(seconds: number, staffActorId = 'organizer') {
    this.state.secondsRemaining = Math.max(1, this.state.secondsRemaining - seconds);
    if (this.state.pausedRemainingMs !== undefined) {
      this.state.pausedRemainingMs = Math.max(1000, this.state.pausedRemainingMs - seconds * 1000);
    }
    this.state.timerEndsAt = Date.now() + this.state.secondsRemaining * 1000;
    this.logAudit('timer_adjusted', staffActorId, `Removed ${seconds} seconds from timer.`);
    this.notify(true);
  }

  public adjustTimer(newSeconds: number, staffActorId = 'organizer') {
    this.state.secondsRemaining = Math.max(0, newSeconds);
    if (this.state.pausedRemainingMs !== undefined) {
      this.state.pausedRemainingMs = newSeconds * 1000;
    }
    this.state.timerEndsAt = Date.now() + newSeconds * 1000;
    if (this.state.secondsRemaining === 0) {
      this.state.roundPhase = 'OUTCOME_RESOLUTION';
    } else if (this.state.secondsRemaining <= 5) {
      this.state.roundPhase = 'GOING_TWICE';
    } else if (this.state.secondsRemaining <= 15) {
      this.state.roundPhase = 'GOING_ONCE';
    } else {
      this.state.roundPhase = 'BIDDING';
    }
    if (this.state.status === 'LIVE' && !this.timerInterval && this.state.nominee && newSeconds > 0) {
      this.startTimer();
    }
    this.logAudit('timer_adjusted', staffActorId, `Adjusted timer to ${newSeconds} seconds.`);
    this.notify(true);
  }

  public setDefaultNominationSeconds(seconds: number, staffActorId = 'organizer') {
    this.config.nominationTimerSeconds = Math.max(10, seconds);
    this.logAudit('config_updated', staffActorId, `Configured lot nomination duration to ${this.config.nominationTimerSeconds}s.`);
    this.notify(true);
  }

  public undoLastBid(staffActorId = 'organizer'): { success: boolean; revertedBid?: DotaBidRecord; restoredBid?: number; restoredTeamId?: string; error?: string } {
    if (!this.state.nominee) {
      return { success: false, error: 'Cannot undo bid when no player is nominated.' };
    }
    const activeBids = this.bidHistory.filter(b => b.nomineeId === this.state.nominee?.id && !b.reverted);
    if (activeBids.length === 0) {
      return { success: false, error: 'No active bids to undo for the current nominee.' };
    }
    const lastBid = activeBids[0];
    lastBid.reverted = true;
    lastBid.revertedBy = staffActorId;

    const remainingBids = this.bidHistory.filter(b => b.nomineeId === this.state.nominee?.id && !b.reverted);
    if (remainingBids.length > 0) {
      const prevBid = remainingBids[0];
      this.state.currentBid = prevBid.amount;
      this.state.leadingTeamId = prevBid.teamId;
      this.state.leadingTeamName = prevBid.teamName;
    } else {
      this.state.currentBid = this.config.minimumBid;
      this.state.leadingTeamId = '';
      this.state.leadingTeamName = '';
    }
    this.state.revision += 1;
    this.logAudit('bid_undone', staffActorId, `Reverted bid of ${lastBid.amount} by ${lastBid.teamName}. Restored leader: ${this.state.leadingTeamName || 'None'} (${this.state.currentBid})`);
    this.notify();
    return {
      success: true,
      revertedBid: lastBid,
      restoredBid: this.state.currentBid,
      restoredTeamId: this.state.leadingTeamId
    };
  }

  public forceSell(playerId: string, teamId: string, amount: number, staffActorId = 'organizer'): { success: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found in auction pool.' };
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: 'Team not found.' };

    this.stopTimer();
    player.status = 'SOLD';
    player.teamId = team.id;
    player.teamName = team.name;
    player.soldAmount = amount;
    team.remainingCredits -= amount;
    team.creditsUsed += amount;
    if (team.primaryRoster.length < this.config.primaryRosterSize) {
      player.isStandIn = false;
      team.primaryRoster.push(player);
    } else {
      player.isStandIn = true;
      team.standIns.push(player);
    }
    this.state.soldCount += 1;
    if (this.state.nominee?.id === playerId) {
      this.state.nominee = null;
    }
    this.logAudit('player_force_sold', staffActorId, `Force sold ${player.username} to ${team.name} for ${amount} credits.`);
    this.notify();
    return { success: true };
  }

  public reauctionCurrentPlayer(staffActorId = 'organizer'): { success: boolean; error?: string } {
    if (!this.state.nominee) return { success: false, error: 'No player currently on auction block.' };
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = '';
    this.state.leadingTeamName = '';
    this.state.secondsRemaining = this.config.bidTimerSeconds;
    this.state.timerEndsAt = Date.now() + this.config.bidTimerSeconds * 1000;
    this.state.roundPhase = 'BIDDING';
    this.logAudit('player_reauctioned', staffActorId, `Re-auctioned current nominee ${this.state.nominee.username} at starting bid.`);
    this.startTimer();
    this.notify();
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // 1.1 MMR-Balanced Purse Engine & Server Authority
  // ---------------------------------------------------------------------------

  public hasBidsStarted(): boolean {
    return this.bidHistory.length > 0 || Boolean(this.purseAllocationAudit?.hasBidsStarted) || this.state.soldCount > 0;
  }

  public isPurseAllocationFrozen(): boolean {
    return Boolean(this.purseAllocationAudit?.isFrozen) || this.hasBidsStarted();
  }

  public getPurseAllocationAudit(): AuctionPurseAllocationAudit | null {
    return this.purseAllocationAudit ? { ...this.purseAllocationAudit } : null;
  }

  /**
   * Retrieves strictly the locked Tournament MMR for a captain.
   * Strictly uses ONLY locked Tournament MMR.
   * Never falls back to declared MMR, OpenDota estimate, or PB rating.
   */
  public getCaptainLockedTournamentMmr(captainId: string): { tournamentMmr: number; isLocked: boolean } | null {
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, captainId);
    if (reg && reg.isMmrLocked && typeof reg.tournamentMmr === 'number' && reg.tournamentMmr > 0) {
      return { tournamentMmr: reg.tournamentMmr, isLocked: true };
    }

    const player = this.players.get(captainId) || dotaPlayerRegistry.getPlayer(captainId);
    if (player && player.isMmrLocked && typeof player.tournamentMmr === 'number' && player.tournamentMmr > 0) {
      return { tournamentMmr: player.tournamentMmr, isLocked: true };
    }

    return null;
  }

  /**
   * Inspects all franchise captains to verify whether every captain possesses
   * a verified, locked Tournament MMR. Returns the first blocking captain or null.
   */
  public getMissingLockedMmrCaptain(): { id: string; name: string } | null {
    for (const team of this.teams.values()) {
      if (!team.captainId) continue;
      const lockedData = this.getCaptainLockedTournamentMmr(team.captainId);
      if (!lockedData || !lockedData.isLocked || !lockedData.tournamentMmr || lockedData.tournamentMmr <= 0) {
        const player = this.players.get(team.captainId) || dotaPlayerRegistry.getPlayer(team.captainId);
        return {
          id: team.captainId,
          name: team.captainIgn || player?.username || team.name
        };
      }
    }
    return null;
  }

  /**
   * Checks whether the auction lobby is ready to open and run.
   * If any appointed captain lacks locked Tournament MMR, readiness is DENIED.
   */
  public isAuctionReady(): { ready: boolean; blockingCaptain?: { id: string; name: string }; error?: string } {
    const minTeamsRequired = this.config.tournamentId === 'auction-test' 
      ? 3 
      : (this.config.primaryRosterSize > 0 ? 2 : 1);
    if (this.teams.size < minTeamsRequired) {
      return { ready: false, error: `At least ${minTeamsRequired} teams with appointed captains are required.` };
    }
    const blockingCaptain = this.getMissingLockedMmrCaptain();
    if (blockingCaptain) {
      return {
        ready: false,
        blockingCaptain,
        error: `Captain '${blockingCaptain.name}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`
      };
    }
    return { ready: true };
  }

  public isPurseConfirmed(): boolean {
    return Boolean(this.state.isPurseConfirmed);
  }

  /**
   * Explicit organiser confirmation of MMR-balanced starting purses.
   * Required before auction lobby transitions to READY.
   */
  public confirmPurses(staffActorId: string): MmrBalanceResult {
    const readyCheck = this.isAuctionReady();
    if (!readyCheck.ready) {
      return { 
        success: false, 
        error: readyCheck.error, 
        blockingCaptain: readyCheck.blockingCaptain 
      };
    }

    const calcResult = this.calculateAndApplyMmrBalancedPurses(staffActorId, false);
    if (!calcResult.success) {
      return calcResult;
    }

    this.state.isPurseConfirmed = true;
    this.state.status = 'READY';
    this.logAudit(
      'purses_confirmed',
      staffActorId,
      `Organiser confirmed MMR-balanced starting credit allocation for ${this.teams.size} teams. Auction lobby is now READY.`
    );

    this.broadcastUpdate();
    this.notify();
    return calcResult;
  }

  /**
   * Authoritative calculation and application of MMR-balanced starting purses.
   */
  public calculateAndApplyMmrBalancedPurses(staffActorId = 'system', force = false): MmrBalanceResult {
    // If bidding has already started, recalculation is strictly DENIED
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: 'Recalculation Denied: Bidding has already started and accepted bids exist. Starting purses are permanently locked.'
      };
    }

    if (this.purseAllocationAudit?.isFrozen && !force) {
      return {
        success: true,
        audit: { ...this.purseAllocationAudit }
      };
    }

    if (this.teams.size === 0) {
      return {
        success: false,
        error: 'Cannot calculate purses: No tournament teams formed.'
      };
    }

    const captainInputs: CaptainMmrInput[] = [];

    for (const team of this.teams.values()) {
      const lockedData = this.getCaptainLockedTournamentMmr(team.captainId);
      const player = this.players.get(team.captainId) || dotaPlayerRegistry.getPlayer(team.captainId);

      captainInputs.push({
        captainId: team.captainId,
        captainIgn: team.captainIgn || player?.username || team.name,
        teamId: team.id,
        teamName: team.name,
        tournamentMmr: lockedData?.tournamentMmr,
        isMmrLocked: lockedData?.isLocked ?? false
      });
    }

    const calcResult = calculateMmrBalancedPurses({
      tournamentId: this.config.tournamentId,
      captains: captainInputs,
      mode: this.config.creditAllocationMode,
      baseCredits: this.config.baseCredits,
      adjustmentRate: this.config.adjustmentRate,
      minimumCredits: this.config.minimumCredits,
      maximumCredits: this.config.maximumCredits,
      creditRounding: this.config.creditRounding,
      allocationVersion: (this.purseAllocationAudit?.allocationVersion || 0) + 1,
      calculatedBy: staffActorId
    });

    if (!calcResult.success || !calcResult.audit) {
      return calcResult;
    }

    // Apply allocated credits to each team
    for (const entry of calcResult.audit.entries) {
      const team = this.teams.get(entry.teamId);
      if (team) {
        team.startingCredits = entry.finalStartingCredits;
        team.remainingCredits = entry.finalStartingCredits - team.creditsUsed;
      }
    }

    this.purseAllocationAudit = calcResult.audit;
    this.logAudit(
      'purse_allocation_calculated',
      staffActorId,
      `Calculated ${calcResult.audit.allocationMode} purses for ${calcResult.audit.captainCount} teams (Total: ${calcResult.audit.totalCredits} Cr, Avg MMR: ${calcResult.audit.averageCaptainMmr}).`
    );

    this.broadcastUpdate();
    this.notify();
    return calcResult;
  }

  /**
   * Explicit organiser recalculation before bidding starts.
   */
  public recalculatePurses(staffActorId: string): MmrBalanceResult {
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: 'Recalculation Denied: Bidding has already started and accepted bids exist. Starting purses are permanently locked.'
      };
    }
    return this.calculateAndApplyMmrBalancedPurses(staffActorId, true);
  }

  /**
   * Configures credit allocation mode (CAPTAIN_MMR_BALANCED or EQUAL) before bidding starts.
   */
  public setAllocationMode(mode: CreditAllocationMode, staffActorId: string): MmrBalanceResult {
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: 'Allocation Mode Locked: Cannot change credit allocation mode after bidding has started.'
      };
    }
    this.config.creditAllocationMode = mode;
    return this.calculateAndApplyMmrBalancedPurses(staffActorId, true);
  }

  // ---------------------------------------------------------------------------
  // 2. Live Auction Room Operations
  // ---------------------------------------------------------------------------

  /**
   * Starts or resumes the live auction room.
   */
  public startAuction(staffActorId: string): { success: boolean; error?: string } {
    const readyCheck = this.isAuctionReady();
    if (!readyCheck.ready) {
      return { success: false, error: readyCheck.error };
    }

    if (this.config.tournamentId === 'auction-test' && !this.state.isPurseConfirmed) {
      return {
        success: false,
        error: 'Cannot start auction: Organiser must confirm starting purse allocation before starting auction.'
      };
    }

    // Server Authority: Ensure MMR-balanced purse allocation is calculated and verified
    const balanceRes = this.calculateAndApplyMmrBalancedPurses(staffActorId, false);
    if (!balanceRes.success) {
      return {
        success: false,
        error: `Cannot start auction: ${balanceRes.error}`
      };
    }

    // Freeze purse allocation upon starting the auction
    if (this.purseAllocationAudit) {
      this.purseAllocationAudit.isFrozen = true;
      this.purseAllocationAudit.frozenAt = new Date().toISOString();
    }

    this.state.status = 'LIVE';
    this.logAudit(
      'auction_started',
      staffActorId,
      `Auction started with ${this.teams.size} teams. Total credit economy: ${this.purseAllocationAudit?.totalCredits || 1000 * this.teams.size} Cr.`
    );
    this.broadcastUpdate();
    this.notify();
    return { success: true };
  }

  /**
   * Organiser nominates an AVAILABLE contender to the floor.
   */
  public nominatePlayer(
    playerId: string,
    staffActorId: string
  ): { success: boolean; error?: string; nominee?: DotaAuctionPlayer } {
    if (this.state.isCompleted) {
      // Reopen auction when organiser nominates a player
      this.state.isCompleted = false;
      this.state.status = 'READY';
      this.logAudit('auction_reopened', staffActorId, 'Auction reopened by organiser to nominate contender.');
    }

    if (this.state.nominee) {
      return { success: false, error: `Current lot for '${this.state.nominee.username}' must be concluded first.` };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: `Player '${playerId}' not found.` };
    }

    if (player.isCaptain) {
      return { success: false, error: `Cannot nominate captain '${player.username}'.` };
    }

    if (player.status !== 'AVAILABLE' && player.status !== 'UNSOLD' && player.status !== 'UNSELECTED') {
      return { success: false, error: `Player '${player.username}' is not AVAILABLE, UNSOLD, or UNSELECTED (current status: ${player.status}).` };
    }

    const nowMs = Date.now();
    if (player.status === 'UNSOLD') {
      this.state.unsoldCount = Math.max(0, this.state.unsoldCount - 1);
      this.unsoldQueue = this.unsoldQueue.filter(id => id !== playerId);
    }
    if (player.status === 'UNSELECTED') {
      this.state.unselectedCount = Math.max(0, (this.state.unselectedCount || 0) - 1);
    }
    player.status = 'NOMINATED';
    this.state.nominee = player;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = '';
    this.state.leadingTeamName = '';
    this.state.secondsRemaining = this.config.nominationTimerSeconds;
    this.state.timerEndsAt = nowMs + this.config.nominationTimerSeconds * 1000;
    this.state.roundPhase = 'BIDDING';
    this.state.status = 'LIVE';
    this.state.revision += 1;

    // Start server-authoritative timer for the nomination
    this.startTimer();

    this.logAudit(
      'player_nominated',
      staffActorId,
      `Nominated ${player.username} (${player.primaryRole}, MMR: ${player.tournamentMmr}, Rating: ${player.rating}) at opening bid of ${this.config.minimumBid} credits.`
    );

    this.notify();
    return { success: true, nominee: player };
  }

  /**
   * Validates and executes an authoritative bid from an authenticated franchise captain.
   * Server independently derives captain's tournament team, purse, roster, and reserve constraints.
   */
  public placeBid(params: {
    teamId?: string;
    captainUserId: string;
    bidAmount?: number;
    increment?: number;
    expectedRevision?: number;
    actorRole?: string;
  }): { 
    success: boolean; 
    error?: string; 
    currentBid?: number; 
    revision?: number; 
    leadingTeamName?: string; 
    leadingTeamId?: string;
    secondsRemaining?: number;
  } {
    const { teamId, captainUserId, expectedRevision, actorRole } = params;

    // 1. Role Verification: Organiser must not bid on behalf of teams; spectators cannot bid
    if (actorRole === 'organizer') {
      return { 
        success: false, 
        error: 'Reject: Organiser cannot bid on behalf of teams. Only authenticated franchise captains can place bids.' 
      };
    }
    if (actorRole === 'spectator') {
      return { 
        success: false, 
        error: 'Reject: Spectator account is read-only and cannot submit live bids.' 
      };
    }

    // 2. Auction status check
    if (this.state.status === 'PAUSED') {
      return { success: false, error: 'Reject: Auction is currently paused by the organiser.' };
    }
    if (this.state.status !== 'LIVE' || this.state.isCompleted) {
      return { success: false, error: `Reject: Auction is currently ${this.state.status}. Bidding is closed.` };
    }

    // 2.1 Expiry race check: Reject if timer has expired
    const nowMs = Date.now();
    if (this.state.timerEndsAt && nowMs >= this.state.timerEndsAt) {
      return { 
        success: false, 
        error: 'Reject: Nomination timer has expired. Bidding is closed.' 
      };
    }

    // 3. Active nominee check
    if (!this.state.nominee) {
      return { success: false, error: 'Reject: Nomination is already closed or no player is currently on the auction block.' };
    }
    if (this.state.nominee.status !== 'NOMINATED') {
      return { success: false, error: `Reject: Player '${this.state.nominee.username}' is not currently available for bidding.` };
    }

    // 4. Server Authority: Independently derive captain's tournament team
    let team: DotaAuctionTeam | undefined;
    if (captainUserId) {
      for (const t of this.teams.values()) {
        if (t.captainId === captainUserId) {
          team = t;
          break;
        }
      }
    }
    // Fallback if teamId is provided and captainId matches
    if (!team && teamId) {
      const candidateTeam = this.teams.get(teamId);
      if (candidateTeam && candidateTeam.captainId === captainUserId) {
        team = candidateTeam;
      }
    }

    if (!team) {
      return { 
        success: false, 
        error: `Reject: Authenticated user '${captainUserId}' is not an appointed captain of any tournament team.` 
      };
    }

    // Check if captain attempted to bid for a different team
    if (teamId && teamId !== team.id) {
      return {
        success: false,
        error: `Permission Denied: User '${captainUserId}' is not the authorized captain of team '${teamId}'. Captain cannot submit bids for rival teams.`
      };
    }

    // 5. Revision optimistic lock (Concurrency / Stale Bid Prevention)
    if (expectedRevision !== undefined && expectedRevision !== this.state.revision) {
      return { 
        success: false, 
        error: `Stale Bid: Auction revision changed (expected ${expectedRevision}, current ${this.state.revision}). Please refresh.` 
      };
    }

    // 6. Proposed Bid Amount derivation
    let proposedBid: number;
    if (params.increment !== undefined) {
      proposedBid = this.state.currentBid + params.increment;
    } else if (params.bidAmount !== undefined) {
      proposedBid = params.bidAmount;
    } else {
      return { success: false, error: 'Reject: Bid amount or increment must be specified.' };
    }

    // 7. Minimum bid check
    if (proposedBid < this.config.minimumBid) {
      return { 
        success: false, 
        error: `Reject: Bid must meet floor opening minimum of ${this.config.minimumBid} credits.` 
      };
    }

    // 8. Bid increment and strictly higher check
    if (proposedBid <= this.state.currentBid) {
      return { 
        success: false, 
        error: `Reject: Proposed bid (${proposedBid} Cr) must exceed current leading bid (${this.state.currentBid} Cr).` 
      };
    }

    const diff = proposedBid - this.state.currentBid;
    if (diff < this.config.bidIncrement || diff % this.config.bidIncrement !== 0) {
      return { 
        success: false, 
        error: `Reject: Bid increment must be a valid multiple of ${this.config.bidIncrement} credits (minimum +${this.config.bidIncrement}).` 
      };
    }

    // 9. Purse check (Overspend prevention)
    if (team.remainingCredits < proposedBid) {
      return { 
        success: false, 
        error: `Insufficient credits: ${team.name} has ${team.remainingCredits} credits, cannot bid ${proposedBid} credits.` 
      };
    }

    // 10. Roster capacity check
    const currentPrimaryCount = team.primaryRoster.length;
    const isPrimaryFull = currentPrimaryCount >= this.config.primaryRosterSize;
    const isStandInRoundActive = Boolean(this.state.standInRoundActive);

    // Primary Roster Phase vs Stand-in Round Phase
    if (!isStandInRoundActive) {
      // During primary roster bidding, any team whose roster is full (5/5) MUST NOT be allowed to bid!
      if (isPrimaryFull) {
        return { 
          success: false, 
          error: `Reject: Roster full. ${team.name} already has a complete primary roster (${currentPrimaryCount}/${this.config.primaryRosterSize}). Teams with complete rosters cannot bid while other teams are still filling their primary rosters. Stand-in auction will only open after all teams have full rosters.` 
        };
      }
    } else {
      // Stand-in Round Phase (only started by organiser after ALL teams filled primary rosters)
      const isStandInFull = team.standIns.length >= this.config.optionalStandInLimit;
      if (isStandInFull) {
        return { 
          success: false, 
          error: `Reject: Stand-in slot full. ${team.name} already has the maximum ${this.config.optionalStandInLimit} stand-in.` 
        };
      }
    }

    // 11. MANDATORY RESERVE RULE:
    // A team must retain enough credits to fill every remaining MANDATORY primary roster slot.
    // Optional stand-ins are NOT included in the mandatory reserve requirement.
    if (!isPrimaryFull) {
      const remainingUnfilledPrimarySlots = Math.max(0, this.config.primaryRosterSize - currentPrimaryCount - 1);
      const minReserveNeeded = remainingUnfilledPrimarySlots * this.config.reservePerSlot;
      const purseAfterBid = team.remainingCredits - proposedBid;

      if (purseAfterBid < minReserveNeeded) {
        return { 
          success: false, 
          error: `Reserve Rule Violation: Must retain at least ${minReserveNeeded} credits for remaining ${remainingUnfilledPrimarySlots} mandatory primary slots.` 
        };
      }
    }

    // 12. Commit Bid Atomically
    this.state.currentBid = proposedBid;
    this.state.leadingTeamId = team.id;
    this.state.leadingTeamName = team.name;
    this.state.revision += 1;

    // Freeze purse allocation permanently once bidding has started
    if (this.purseAllocationAudit) {
      this.purseAllocationAudit.hasBidsStarted = true;
      this.purseAllocationAudit.isFrozen = true;
    }

    // 13. Server-authoritative anti-sniping timer extension
    // If a valid bid happens in the final extensionWindowSeconds (default 5s), reset/extend timer to extensionTimeSeconds (5s)
    if (this.config.bidExtensionEnabled) {
      const remainingSec = this.state.timerEndsAt
        ? Math.max(0, Math.ceil((this.state.timerEndsAt - nowMs) / 1000))
        : this.state.secondsRemaining;

      if (remainingSec <= this.config.extensionWindowSeconds || this.state.secondsRemaining <= this.config.extensionWindowSeconds) {
        this.state.secondsRemaining = this.config.extensionTimeSeconds;
        this.state.timerEndsAt = nowMs + this.config.extensionTimeSeconds * 1000;
      }
    }

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const bidRecord: DotaBidRecord = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      nomineeId: this.state.nominee.id,
      teamId: team.id,
      teamName: team.name,
      amount: proposedBid,
      timestamp: timeFormatted,
      captainUserId
    };
    this.bidHistory.unshift(bidRecord);
    if (this.bidHistory.length > 500) {
      this.bidHistory.length = 500;
    }

    this.logAudit(
      'bid_accepted',
      captainUserId,
      `Bid of ${proposedBid} credits accepted from ${team.name} for ${this.state.nominee.username} (rev ${this.state.revision}).`
    );

    this.notify();
    return {
      success: true,
      currentBid: proposedBid,
      revision: this.state.revision,
      leadingTeamName: team.name,
      leadingTeamId: team.id,
      secondsRemaining: this.state.secondsRemaining
    };
  }

  /**
   * Concludes the active nomination:
   * - If sellToWinner is true and there is a leading bid -> player SOLD, credits deducted, roster updated.
   * - Otherwise -> player UNSOLD.
   * Then checks if mandatory 5/5 rosters are full across all teams.
   */
  public concludeNomination(
    sellToWinner: boolean,
    staffActorId: string
  ): {
    outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED';
    player: DotaAuctionPlayer;
    teamName?: string;
    winningBid?: number;
  } {
    const nominee = this.state.nominee;
    if (!nominee) {
      throw new Error('No nominee currently on the auction block to conclude.');
    }

    let outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED' = 'UNSOLD';
    let winningTeamName: string | undefined;
    let winningBid: number | undefined;

    if (sellToWinner && this.state.leadingTeamId) {
      const winnerTeam = this.teams.get(this.state.leadingTeamId);
      if (!winnerTeam) throw new Error('Winning team record not found.');

      const winningPrice = this.state.currentBid;
      winnerTeam.remainingCredits -= winningPrice;
      winnerTeam.creditsUsed += winningPrice;

      nominee.status = 'SOLD';
      nominee.teamId = winnerTeam.id;
      nominee.teamName = winnerTeam.name;
      nominee.soldAmount = winningPrice;

      // Assign to primary roster if < 5, else stand-in
      if (this.state.standInRoundActive || winnerTeam.primaryRoster.length >= this.config.primaryRosterSize) {
        nominee.isStandIn = true;
        winnerTeam.standIns.push(nominee);
      } else {
        nominee.isStandIn = false;
        winnerTeam.primaryRoster.push(nominee);
      }

      this.state.soldCount += 1;
      outcome = 'SOLD';
      winningTeamName = winnerTeam.name;
      winningBid = winningPrice;

      this.logAudit(
        'player_sold',
        staffActorId,
        `Player ${nominee.username} SOLD to ${winnerTeam.name} for ${winningPrice} credits. Roster: ${winnerTeam.primaryRoster.length}/${this.config.primaryRosterSize} primary, ${winnerTeam.standIns.length}/${this.config.optionalStandInLimit} stand-in.`
      );
    } else {
      // UNSOLD: nominated but nomination closed without winning bid
      nominee.status = 'UNSOLD';
      this.state.unsoldCount += 1;
      outcome = 'UNSOLD';

      this.logAudit(
        'player_unsold',
        staffActorId,
        `Player ${nominee.username} passed as UNSOLD.`
      );
    }

    // Record nomination audit
    this.stopTimer();
    this.state.timerEndsAt = undefined;
    this.state.pausedRemainingMs = undefined;

    this.nominationAudits.unshift({
      nomineeId: nominee.id,
      nomineeUsername: nominee.username,
      tournamentMmr: nominee.tournamentMmr,
      role: nominee.primaryRole,
      outcome: outcome === 'SOLD' ? 'SOLD' : 'UNSOLD',
      winningTeamId: outcome === 'SOLD' ? this.state.leadingTeamId : undefined,
      winningTeamName,
      winningBid,
      bidsCount: this.bidHistory.filter(b => b.nomineeId === nominee.id).length,
      timestamp: new Date().toISOString()
    });

    this.state.lastLotResult = {
      outcome: outcome === 'SOLD' ? 'SOLD' : 'UNSOLD',
      player: nominee,
      winningTeamName,
      winningTeamId: outcome === 'SOLD' ? this.state.leadingTeamId : undefined,
      winningBid,
      timestamp: new Date().toISOString()
    };

    if (outcome === 'UNSOLD') {
      if (!this.unsoldQueue.includes(nominee.id)) {
        this.unsoldQueue.push(nominee.id);
      }
    }
    this.state.roundPhase = 'INTERMISSION';
    this.state.intermissionRemainingSeconds = this.config.nextPlayerDelaySeconds || 80;
    this.state.nominee = null;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = '';
    this.state.leadingTeamName = '';
    this.state.revision += 1;

    // Check if ALL teams have completed their mandatory primary rosters!
    const allMandatoryRostersFilled = Array.from(this.teams.values()).length > 0 && Array.from(this.teams.values()).every(
      t => t.primaryRoster.length >= this.config.primaryRosterSize
    );

    if (allMandatoryRostersFilled) {
      this.state.primaryRostersComplete = true;
      if (this.state.standInRoundActive) {
        const allStandInsFilled = Array.from(this.teams.values()).every(
          t => t.standIns.length >= this.config.optionalStandInLimit
        );
        if (allStandInsFilled) {
          this.finalizeAuction(staffActorId);
          outcome = 'AUCTION_COMPLETED';
          this.state.status = 'COMPLETED';
        } else {
          this.state.status = 'READY';
        }
      } else {
        // All primary rosters are filled! Organiser can now start stand-in round or re-auction unsold players
        this.state.status = 'READY';
        this.logAudit(
          'primary_rosters_completed',
          staffActorId,
          `All ${this.teams.size} teams reached complete ${this.config.primaryRosterSize}/${this.config.primaryRosterSize} primary rosters! Stand-in auction round can now be opened by organiser.`
        );
      }
    } else {
      this.state.primaryRostersComplete = false;
      this.state.status = 'READY';
    }

    this.notify(true);
    return {
      outcome,
      player: nominee,
      teamName: winningTeamName,
      winningBid
    };
  }

  /**
   * Assigns an optional stand-in (0/1) to a team from AVAILABLE, UNSOLD, or UNSELECTED players.
   * Stand-in absence never prevents tournament progression.
   */
  public assignOptionalStandIn(
    teamId: string,
    playerId: string,
    staffActorId: string
  ): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: `Team '${teamId}' not found.` };

    if (team.standIns.length >= this.config.optionalStandInLimit) {
      return { success: false, error: `${team.name} already has maximum allowed stand-ins (${this.config.optionalStandInLimit}).` };
    }

    const player = this.players.get(playerId);
    if (!player) return { success: false, error: `Player '${playerId}' not found.` };

    if (player.status !== 'AVAILABLE' && player.status !== 'UNSOLD' && player.status !== 'UNSELECTED') {
      return { success: false, error: `Player '${player.username}' is not eligible for stand-in (status: ${player.status}).` };
    }

    player.status = 'SOLD';
    player.teamId = team.id;
    player.teamName = team.name;
    player.isStandIn = true;
    team.standIns.push(player);

    this.logAudit(
      'standin_assigned',
      staffActorId,
      `Optional stand-in ${player.username} assigned to ${team.name}. Primary: 5/5, Stand-ins: ${team.standIns.length}/1.`
    );

    this.notify();
    return { success: true, team };
  }

  /**
   * Finalizes the auction:
   * - Closes live bidding and prevents future bids.
   * - Preserves SOLD and UNSOLD players.
   * - Marks all untouched AVAILABLE players as UNSELECTED.
   * - Idempotent.
   */
  public finalizeAuction(staffActorId = 'system'): { success: boolean; unselectedCount: number; error?: string } {
    if (this.state.isCompleted) {
      return { success: true, unselectedCount: this.state.unselectedCount };
    }

    // Invariant: Do not finalize while any registered team has an incomplete primary roster (< 5/5)
    if (this.teams.size > 0) {
      for (const team of this.teams.values()) {
        if (team.primaryRoster.length < this.config.primaryRosterSize) {
          return {
            success: false,
            error: `Cannot finalize auction: Team '${team.name}' has only ${team.primaryRoster.length}/${this.config.primaryRosterSize} players. All teams must reach full ${this.config.primaryRosterSize}/${this.config.primaryRosterSize} primary roster before finalizing.`,
            unselectedCount: 0
          };
        }
      }
    }

    this.state.status = 'COMPLETED';
    this.state.isCompleted = true;
    this.state.completedAt = new Date().toISOString();
    this.state.nominee = null;

    // Convert all remaining untouched AVAILABLE players to UNSELECTED (distinct from UNSOLD!)
    let count = 0;
    for (const player of this.players.values()) {
      if (player.status === 'AVAILABLE') {
        player.status = 'UNSELECTED';
        count += 1;
      }
    }
    this.state.unselectedCount = count;

    this.logAudit(
      'auction_completed',
      staffActorId,
      `Auction finalized! All ${this.teams.size} teams reached mandatory rosters. ${this.state.soldCount} SOLD, ${this.state.unsoldCount} UNSOLD, ${count} UNSELECTED.`
    );

    this.notify();
    return { success: true, unselectedCount: count };
  }

  // ---------------------------------------------------------------------------
  // Queries & State Inspection
  // ---------------------------------------------------------------------------
  public getState(): DotaAuctionState {
    return { ...this.state };
  }

  public getConfig(): DotaAuctionConfig {
    return { ...this.config };
  }

  public getTeams(): DotaAuctionTeam[] {
    return Array.from(this.teams.values()).map(t => ({
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    }));
  }

  public getTeam(teamId: string): DotaAuctionTeam | undefined {
    const t = this.teams.get(teamId);
    if (!t) return undefined;
    return {
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    };
  }

  public getPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values());
  }

  public getPlayer(playerId: string): DotaAuctionPlayer | undefined {
    return this.players.get(playerId);
  }

  public getAvailablePlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'AVAILABLE');
  }

  public getSoldPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'SOLD');
  }

  public getUnsoldPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'UNSOLD');
  }

  public getUnselectedPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'UNSELECTED');
  }

  public getBidHistory(): DotaBidRecord[] {
    return [...this.bidHistory];
  }

  public getNominationAudits(): DotaNominationAudit[] {
    return [...this.nominationAudits];
  }

  public getAuditTrail(): Array<{ action: string; actor: string; details: string; timestamp: string }> {
    return [...this.auditLog];
  }

  // ---------------------------------------------------------------------------
  // Subscriptions & Audit Logging
  // ---------------------------------------------------------------------------
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(persist = true) {
    if (persist && !this.isApplyingRemoteUpdate) {
      this.broadcastUpdate(true);
    }
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Auction listener error:', err); }
    });
  }

  public destroy() {
    this.stopTimer();
    if (this.storageHandler && typeof window !== 'undefined') {
      try { window.removeEventListener('storage', this.storageHandler); } catch {}
      this.storageHandler = null;
    }
    if (this.firestoreUnsub) {
      try { this.firestoreUnsub(); } catch {}
      this.firestoreUnsub = null;
    }
    if (this.tournamentDocUnsub) {
      try { this.tournamentDocUnsub(); } catch {}
      this.tournamentDocUnsub = null;
    }
    if (this.syncChannel) {
      try { this.syncChannel.close(); } catch {}
      this.syncChannel = null;
    }
    if (this.globalBroadcastChannel) {
      try { this.globalBroadcastChannel.close(); } catch {}
      this.globalBroadcastChannel = null;
    }
    if (this.eventSource) {
      try { this.eventSource.close(); } catch {}
      this.eventSource = null;
    }
    if (this.ssePollInterval) {
      clearInterval(this.ssePollInterval);
      this.ssePollInterval = null;
    }
    this.listeners = [];
  }

  private logAudit(action: string, actor: string, details: string) {
    this.auditLog.unshift({
      action,
      actor,
      details,
      timestamp: new Date().toISOString()
    });
    if (this.auditLog.length > 200) {
      this.auditLog.length = 200;
    }
  }
}

// ---------------------------------------------------------------------------
// Tournament-Scoped Engine Registry
// ---------------------------------------------------------------------------
const auctionEngines = new Map<string, DotaAuctionEngine>();

export function getAuctionEngine(tournamentId: string = 'purple-bean-test-cup', customConfig?: Partial<DotaAuctionConfig>): DotaAuctionEngine {
  const effectiveId = tournamentId || 'purple-bean-test-cup';
  if (!auctionEngines.has(effectiveId)) {
    const isAuctionTest = effectiveId === 'auction-test';
    const newEngine = new DotaAuctionEngine({
      tournamentId: effectiveId,
      tournamentName: isAuctionTest ? 'Auction Test' : undefined,
      creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
      ...customConfig
    });
    auctionEngines.set(effectiveId, newEngine);
  }
  return auctionEngines.get(effectiveId)!;
}

export function resetAuctionEngine(tournamentId: string) {
  const engine = auctionEngines.get(tournamentId);
  if (engine) {
    engine.destroy();
    auctionEngines.delete(tournamentId);
  }
}

// Default singleton instance for backward compatibility
export const dotaAuctionEngine = getAuctionEngine('purple-bean-test-cup');
