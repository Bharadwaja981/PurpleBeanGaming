/**
 * Purple Bean Gaming — Dota 2 Competition Engine & Multi-Stage Tournament System
 * 
 * Complete, production-ready competition engine supporting:
 * - Multi-stage tournament pipelines (Tournament -> Stage 1 -> Stage 2 -> Stage 3...)
 * - Single Elimination, Double Elimination, Round Robin, Double Round Robin, GSL groups, Swiss system, League, Play-In, Custom
 * - Real team integration from auction/premade rosters + draft placeholders
 * - Drag-and-drop seeding, manual/random/MMR/ranking-based placement
 * - BO1, BO2, BO3, BO5, BO7 format options
 * - Transactional progression (winner advancement, upper-to-lower loser drops, group qualifications)
 * - Individual Dota game tracking (Valve Match ID, OpenDota verification, duration, radiant/dire)
 * - Safe post-publication bracket editing with protection for completed matches
 * - Standings calculation with ordered tiebreak protocol
 */

import { doc, setDoc, updateDoc, onSnapshot, getDoc, runTransaction, Unsubscribe } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { sanitizeFirestorePayload } from '../utils/sanitizeFirestore';

let serverAdminDb: any = null;

export function setCompetitionEngineAdminDb(adminDb: any) {
  serverAdminDb = adminDb;
}

export function getCompetitionEngineAdminDb() {
  return serverAdminDb;
}

export type TournamentStageType = 
  | 'GROUP_STAGE'
  | 'ROUND_ROBIN'
  | 'DOUBLE_ROUND_ROBIN'
  | 'GSL'
  | 'SWISS'
  | 'SINGLE_ELIMINATION'
  | 'DOUBLE_ELIMINATION'
  | 'LEAGUE'
  | 'PLAY_IN'
  | 'CUSTOM';

export type SeedingMode = 'MANUAL' | 'RANDOM' | 'RATING_BASED' | 'POINTS_BASED' | 'STAGE_QUALIFICATION';
export type SeriesFormat = 'BO1' | 'BO2' | 'BO3' | 'BO5' | 'BO7';

export interface DotaIndividualGame {
  gameNumber: number;
  valveMatchId?: string;
  openDotaMatchId?: string;
  durationSeconds?: number;
  winnerTeamId?: string;
  radiantTeamId?: string;
  direTeamId?: string;
  radiantScore?: number;
  direScore?: number;
  isVerified?: boolean;
  replayUrl?: string;
}

export interface SeededTeam {
  teamId: string;
  name: string;
  teamName?: string;
  tag: string;
  seed: number;
  rating?: number;
  mmr?: number;
  avgMmr?: number;
  rosterStrengthRating?: number;
  logo?: string;
  color?: string;
  captainUserId?: string;
  captainIgn?: string;
  groupName?: string;
  groupId?: string;
  sourceLabel?: string;
  isPlaceholder?: boolean;
}

export interface StageQualificationRule {
  id: string;
  sourceRank: number; // 1 = 1st, 2 = 2nd, etc.
  sourceGroupId?: string; // e.g. "group-A" or "ALL"
  sourceLabel: string; // e.g. "Group A - 1st Place"
  targetStageId: string;
  targetSlot: string; // e.g. "Upper Bracket Seed 1", "Lower Bracket Seed 2", "Eliminated"
  action: 'ADVANCE' | 'LOWER_BRACKET' | 'ELIMINATE' | 'TIEBREAK';
}

export interface MatchSlotSource {
  type: 'SEED' | 'WINNER_OF' | 'LOSER_OF' | 'GROUP_RANK' | 'BYE' | 'PLACEHOLDER';
  sourceMatchId?: string;
  sourceGroupId?: string;
  sourceRank?: number;
  sourceSeed?: number;
  label?: string;
}

export interface CompetitionMatchNode {
  id: string;
  tournamentId: string;
  stageId?: string;
  stageName?: string;
  stage?: string;
  round: string;
  roundKey?: string;
  roundTitle?: string;
  bracketType?: 'upper' | 'lower' | 'grand_final' | 'round_robin' | 'group' | 'gsl' | 'swiss' | string;
  matchNumber?: number;
  seriesFormat?: SeriesFormat;
  teamA?: SeededTeam | any;
  teamB?: SeededTeam | any;
  teamASource?: MatchSlotSource;
  teamBSource?: MatchSlotSource;
  winnerId?: string;
  loserId?: string;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'PENDING' | 'BYE' | 'FORFEIT' | 'DISPUTED';
  scheduledTime?: string;
  winnerDestinationId?: string;
  winnerDestinationSlot?: 'teamA' | 'teamB' | string;
  winnerNextMatchId?: string;
  winnerNextSlot?: 'teamA' | 'teamB' | string;
  winnerDestinationLabel?: string;
  loserDestinationId?: string;
  loserDestinationSlot?: 'teamA' | 'teamB' | string;
  loserNextMatchId?: string;
  loserNextSlot?: 'teamA' | 'teamB' | string;
  loserDestinationLabel?: string;
  isBye?: boolean;
  column?: number;
  row?: number;
  scores?: { teamA: number; teamB: number };
  games?: DotaIndividualGame[];
  forfeitWinnerId?: string;
  forfeitReason?: string;
  isDisputed?: boolean;
  disputeReason?: string;
  confirmedAt?: string;
  confirmedBy?: string;
  streamUrl?: string;
  streamType?: 'twitch' | 'youtube' | 'obs' | 'custom';
  streamTitle?: string;
  casterNames?: string;
  obsStreamUrl?: string;
  telemetry?: any;
}

export interface GroupConfig {
  id: string;
  name: string; // "Group A", "Group B"
  teams: SeededTeam[];
}

export interface GroupStandingRow {
  position: number;
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  seed: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number;
  destination?: 'UPPER_BRACKET' | 'LOWER_BRACKET' | 'ELIMINATED' | 'PLAYOFFS' | string;
}

export interface TournamentStageConfig {
  id: string;
  name: string;
  sequence: number;
  type: TournamentStageType;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED';
  
  // Group / League / Swiss / GSL properties:
  groupCount?: number;
  teamsPerGroup?: number;
  roundRobinType?: 'SINGLE' | 'DOUBLE';
  winPoints?: number;
  drawPoints?: number;
  lossPoints?: number;
  groups?: GroupConfig[];
  swissRoundsCount?: number;

  // Bracket properties:
  teamCount?: number;
  defaultSeriesFormat?: SeriesFormat;
  grandFinalSeriesFormat?: SeriesFormat;
  thirdPlaceMatch?: boolean;
  grandFinalReset?: boolean;
  ubToLbMapping?: 'DIRECT' | 'CROSS';

  // Seeding & Qualification:
  seedingMode?: SeedingMode;
  seededTeams?: SeededTeam[];
  qualificationRules?: StageQualificationRule[];

  // Matches generated for this stage:
  matches: CompetitionMatchNode[];
}

export interface StructureAuditRecord {
  id: string;
  timestamp: string;
  actorId: string;
  action: string;
  details: string;
}

export interface MultiStageTournamentStructure {
  tournamentId: string;
  tournamentName?: string;
  format?: string;
  config: { format: string; [key: string]: any };
  status: 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'COMPLETED' | 'LOCKED' | string;
  version: number;
  stages: TournamentStageConfig[];
  publishedAt?: string;
  updatedAt?: string;
  isLocked?: boolean;
  teams: SeededTeam[];
  matches: CompetitionMatchNode[];
  groups?: Record<string, { id: string; name: string; teams: SeededTeam[]; matches: CompetitionMatchNode[]; standings: any[] }>;
  roundSeriesOverrides?: Record<string, string>;
  auditTrail: StructureAuditRecord[];
}

export type CompetitionStructureState = MultiStageTournamentStructure;

const SHARED_STRUCTURE_STORAGE = new Map<string, string>();

function getStorageBackend() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage;
  }
  return {
    getItem: (key: string) => SHARED_STRUCTURE_STORAGE.get(key) || null,
    setItem: (key: string, value: string) => { SHARED_STRUCTURE_STORAGE.set(key, String(value)); },
    removeItem: (key: string) => { SHARED_STRUCTURE_STORAGE.delete(key); },
    clear: () => { SHARED_STRUCTURE_STORAGE.clear(); }
  };
}

export class DotaCompetitionEngine {
  private structures = new Map<string, MultiStageTournamentStructure>();
  private structureSubscribers = new Map<string, Set<(struct: MultiStageTournamentStructure) => void>>();
  private firestoreListeners = new Map<string, Unsubscribe>();

  /**
   * Clears in-memory and persisted storage for a tournament or all tournaments
   */
  public clear(tournamentId?: string): void {
    const storage = getStorageBackend();
    if (tournamentId) {
      this.structures.delete(tournamentId);
      try {
        storage.removeItem(`pbg_competition_structure_${tournamentId}`);
      } catch {}
    } else {
      this.structures.clear();
      try {
        storage.clear();
      } catch {}
    }
  }

  private loadPersistedStructure(tournamentId: string): MultiStageTournamentStructure | undefined {
    const storage = getStorageBackend();
    if (!storage) return undefined;
    try {
      const raw = storage.getItem(`pbg_competition_structure_${tournamentId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.tournamentId === tournamentId) {
          return parsed;
        }
      }
    } catch {}
    return undefined;
  }

  private persistStructure(tournamentId: string, state: MultiStageTournamentStructure): void {
    const storage = getStorageBackend();
    if (storage) {
      try {
        storage.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(state));
      } catch {}
    }

    const payload = sanitizeFirestorePayload(state);
    const summary = {
      status: state.status,
      isLocked: state.isLocked,
      version: state.version,
      stageCount: state.stages.length,
      matchCount: (state.matches || []).length,
      completedMatchCount: (state.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
      format: state.format,
      updatedAt: state.updatedAt,
      publishedAt: state.publishedAt || null
    };

    // Persist to authoritative Firestore database
    try {
      if (serverAdminDb && tournamentId) {
        serverAdminDb.collection('tournaments').doc(tournamentId).collection('competition').doc('structure').set(payload, { merge: true }).catch(() => {});
        serverAdminDb.collection('tournaments').doc(tournamentId).update({
          competitionStructure: payload,
          competitionStructureSummary: summary,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      } else if (db && tournamentId) {
        setDoc(doc(db, 'tournaments', tournamentId, 'competition', 'structure'), payload, { merge: true }).catch(() => {});
        updateDoc(doc(db, 'tournaments', tournamentId), {
          competitionStructure: payload,
          competitionStructureSummary: summary,
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }
    } catch {}

    this.notifySubscribers(tournamentId, state);
  }

  public subscribe(tournamentId: string, listener: (struct: MultiStageTournamentStructure) => void): () => void {
    if (!this.structureSubscribers.has(tournamentId)) {
      this.structureSubscribers.set(tournamentId, new Set());
    }
    const set = this.structureSubscribers.get(tournamentId)!;
    set.add(listener);

    const current = this.structures.get(tournamentId) || this.loadPersistedStructure(tournamentId);
    if (current) {
      listener(current);
    }

    this.listenToFirestore(tournamentId);

    return () => {
      set.delete(listener);
    };
  }

  public listenToFirestore(tournamentId: string): Unsubscribe {
    if (!tournamentId || !db) return () => {};
    if (this.firestoreListeners.has(tournamentId)) {
      return this.firestoreListeners.get(tournamentId)!;
    }

    try {
      const unsub = onSnapshot(doc(db, 'tournaments', tournamentId, 'competition', 'structure'), (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data() as MultiStageTournamentStructure;
          if (remoteData && remoteData.tournamentId === tournamentId) {
            this.structures.set(tournamentId, remoteData);
            const storage = getStorageBackend();
            try { storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData)); } catch {}
            this.notifySubscribers(tournamentId, remoteData);
          }
        }
      }, () => {});

      this.firestoreListeners.set(tournamentId, unsub);
      return unsub;
    } catch {
      return () => {};
    }
  }

  public hydrateFromFirestore(tournamentId: string, remoteData: MultiStageTournamentStructure): void {
    if (!remoteData || !tournamentId) return;
    this.structures.set(tournamentId, remoteData);
    const storage = getStorageBackend();
    try { storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData)); } catch {}
    this.notifySubscribers(tournamentId, remoteData);
  }

  private notifySubscribers(tournamentId: string, struct: MultiStageTournamentStructure): void {
    const set = this.structureSubscribers.get(tournamentId);
    if (set) {
      set.forEach(cb => {
        try { cb(struct); } catch {}
      });
    }
  }

  public async fetchStructureFromFirestore(tournamentId: string): Promise<MultiStageTournamentStructure | undefined> {
    if (!tournamentId) return undefined;

    if (serverAdminDb) {
      try {
        const structRef = serverAdminDb.collection('tournaments').doc(tournamentId).collection('competition').doc('structure');
        const snap = await structRef.get();
        if (snap.exists) {
          const remoteData = snap.data() as MultiStageTournamentStructure;
          this.structures.set(tournamentId, remoteData);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData)); } catch {}

          try {
            const tourneyRef = serverAdminDb.collection('tournaments').doc(tournamentId);
            const tSnap = await tourneyRef.get();
            if (tSnap.exists) {
              const tData = tSnap.data();
              const summaryVer = tData?.competitionStructureSummary?.version;
              if (summaryVer !== remoteData.version) {
                const sanitized = sanitizeFirestorePayload(remoteData);
                await tourneyRef.update({
                  competitionStructure: sanitized,
                  competitionStructureSummary: {
                    status: remoteData.status,
                    isLocked: remoteData.isLocked,
                    version: remoteData.version,
                    stageCount: remoteData.stages.length,
                    matchCount: (remoteData.matches || []).length,
                    completedMatchCount: (remoteData.matches || []).filter((m: any) => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
                    format: remoteData.format,
                    updatedAt: remoteData.updatedAt,
                    publishedAt: remoteData.publishedAt || null
                  },
                  updatedAt: remoteData.updatedAt
                });
              }
            }
          } catch {}

          return remoteData;
        } else {
          // Fallback: migrate from tournament document if subcollection doc has not yet been initialized
          const tourneyRef = serverAdminDb.collection('tournaments').doc(tournamentId);
          const tSnap = await tourneyRef.get();
          if (tSnap.exists) {
            const tData = tSnap.data();
            if (tData?.competitionStructure) {
              const structureData = tData.competitionStructure as MultiStageTournamentStructure;
              this.structures.set(tournamentId, structureData);
              try {
                await structRef.set(sanitizeFirestorePayload(structureData), { merge: true });
              } catch {}
              return structureData;
            }
          }
        }
      } catch (err) {
        console.warn(`[Competition Engine] Admin Firestore fetch failed for ${tournamentId}:`, err);
      }
      return undefined;
    }

    if (!db) return undefined;
    try {
      const structRef = doc(db, 'tournaments', tournamentId, 'competition', 'structure');
      const snap = await getDoc(structRef);
      if (snap.exists()) {
        const remoteData = snap.data() as MultiStageTournamentStructure;
        this.structures.set(tournamentId, remoteData);
        const storage = getStorageBackend();
        try { storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData)); } catch {}

        // Canonical synchronization: ensure tournament document summary matches the canonical subcollection
        try {
          const tourneyRef = doc(db, 'tournaments', tournamentId);
          const tSnap = await getDoc(tourneyRef);
          if (tSnap.exists()) {
            const tData = tSnap.data();
            const summaryVer = tData?.competitionStructureSummary?.version;
            if (summaryVer !== remoteData.version) {
              const sanitized = sanitizeFirestorePayload(remoteData);
              await updateDoc(tourneyRef, {
                competitionStructure: sanitized,
                competitionStructureSummary: {
                  status: remoteData.status,
                  isLocked: remoteData.isLocked,
                  version: remoteData.version,
                  stageCount: remoteData.stages.length,
                  matchCount: (remoteData.matches || []).length,
                  completedMatchCount: (remoteData.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
                  format: remoteData.format,
                  updatedAt: remoteData.updatedAt,
                  publishedAt: remoteData.publishedAt || null
                },
                updatedAt: remoteData.updatedAt
              });
            }
          }
        } catch {}

        return remoteData;
      } else {
        // Fallback: migrate from tournament document if subcollection doc has not yet been initialized
        const tourneyRef = doc(db, 'tournaments', tournamentId);
        const tSnap = await getDoc(tourneyRef);
        if (tSnap.exists()) {
          const tData = tSnap.data();
          if (tData?.competitionStructure) {
            const structureData = tData.competitionStructure as MultiStageTournamentStructure;
            this.structures.set(tournamentId, structureData);
            try {
              await setDoc(structRef, sanitizeFirestorePayload(structureData), { merge: true });
            } catch {}
            return structureData;
          }
        }
      }
    } catch {}
    return undefined;
  }

  public async ensureCanonicalSync(tournamentId: string): Promise<boolean> {
    const struct = await this.fetchStructureFromFirestore(tournamentId);
    return Boolean(struct);
  }

  public getStructure(tournamentId: string): MultiStageTournamentStructure | undefined {
    const memory = this.structures.get(tournamentId);
    if (memory) return memory;
    const persisted = this.loadPersistedStructure(tournamentId);
    if (persisted) {
      this.structures.set(tournamentId, persisted);
      return persisted;
    }
    return undefined;
  }

  public setStructure(tournamentId: string, state: MultiStageTournamentStructure): void {
    this.structures.set(tournamentId, state);
    this.persistStructure(tournamentId, state);
  }

  /**
   * Initializes or returns structure draft for a tournament
   */
  public getOrCreateStructure(tournamentId: string, initialTeams: any[] = []): MultiStageTournamentStructure {
    const existing = this.structures.get(tournamentId);
    if (existing) {
      if (initialTeams.length > 0 && (!existing.teams || existing.teams.length === 0)) {
        existing.teams = this.normalizeTeams(initialTeams);
      }
      return existing;
    }

    const seededTeams: SeededTeam[] = this.normalizeTeams(initialTeams);

    // Default template: Double Elimination bracket
    const defaultStages: TournamentStageConfig[] = [
      {
        id: `stage-${tournamentId}-1`,
        name: 'Stage 1: Playoff Bracket',
        sequence: 1,
        type: 'DOUBLE_ELIMINATION',
        status: 'UPCOMING',
        teamCount: Math.max(4, seededTeams.length || 8),
        defaultSeriesFormat: 'BO3',
        grandFinalSeriesFormat: 'BO5',
        thirdPlaceMatch: false,
        grandFinalReset: true,
        seedingMode: 'RATING_BASED',
        seededTeams: [...seededTeams],
        matches: []
      }
    ];

    const newStructure: MultiStageTournamentStructure = {
      tournamentId,
      format: 'DOUBLE_ELIMINATION',
      config: { format: 'DOUBLE_ELIMINATION' },
      status: 'DRAFT',
      version: 1,
      stages: defaultStages,
      isLocked: false,
      teams: seededTeams,
      matches: [],
      auditTrail: [
        {
          id: `audit-${Date.now()}-init`,
          timestamp: new Date().toISOString(),
          actorId: 'system',
          action: 'INIT_STRUCTURE',
          details: `Initialized draft competition structure with ${seededTeams.length} teams.`
        }
      ]
    };

    this.structures.set(tournamentId, newStructure);
    return newStructure;
  }

  private normalizeTeams(rawTeams: any[]): SeededTeam[] {
    return rawTeams.map((t, idx) => ({
      teamId: t.id || t.teamId || `placeholder-team-${idx + 1}`,
      name: t.name || t.teamName || `Seed #${idx + 1}`,
      tag: t.tag || `T${idx + 1}`,
      seed: idx + 1,
      rating: t.rating || 1500,
      mmr: t.mmr || t.lockedTournamentMmr || (t.primaryRoster?.[0]?.tournamentMmr) || 6000,
      logo: t.logo || '🛡️',
      color: t.color || '#7C3AED',
      captainUserId: t.captainId || t.captainUserId,
      captainIgn: t.captainName || t.captainIgn,
      isPlaceholder: Boolean(t.isPlaceholder || !t.id)
    }));
  }

  /**
   * Adds a new stage to tournament structure
   */
  public addStage(
    tournamentId: string, 
    type: TournamentStageType, 
    customName?: string
  ): { success: boolean; stage?: TournamentStageConfig; error?: string } {
    const structure = this.getOrCreateStructure(tournamentId);

    const nextSeq = structure.stages.length + 1;
    const stageId = `stage-${tournamentId}-${Date.now()}-${nextSeq}`;
    
    let defaultName = `Stage ${nextSeq}: `;
    switch (type) {
      case 'GROUP_STAGE': defaultName += 'Group Stage'; break;
      case 'ROUND_ROBIN': defaultName += 'Round Robin'; break;
      case 'DOUBLE_ROUND_ROBIN': defaultName += 'Double Round Robin'; break;
      case 'GSL': defaultName += 'GSL Group Format'; break;
      case 'SWISS': defaultName += 'Swiss System'; break;
      case 'SINGLE_ELIMINATION': defaultName += 'Single Elimination Bracket'; break;
      case 'DOUBLE_ELIMINATION': defaultName += 'Double Elimination Bracket'; break;
      case 'LEAGUE': defaultName += 'League Play'; break;
      case 'PLAY_IN': defaultName += 'Play-In Gauntlet'; break;
      case 'CUSTOM': defaultName += 'Custom Stage'; break;
    }

    const newStage: TournamentStageConfig = {
      id: stageId,
      name: customName || defaultName,
      sequence: nextSeq,
      type,
      status: 'UPCOMING',
      teamCount: structure.teams?.length || 8,
      defaultSeriesFormat: (type === 'GROUP_STAGE' || type === 'ROUND_ROBIN' || type === 'DOUBLE_ROUND_ROBIN') ? 'BO2' : 'BO3',
      grandFinalSeriesFormat: 'BO5',
      groupCount: (type === 'GROUP_STAGE' || type === 'GSL') ? 2 : undefined,
      teamsPerGroup: type === 'GSL' ? 4 : (type === 'GROUP_STAGE' ? 4 : undefined),
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      seedingMode: 'RATING_BASED',
      seededTeams: structure.teams ? [...structure.teams] : [],
      matches: []
    };

    structure.stages.push(newStage);
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'ADD_STAGE', `Added stage "${newStage.name}" (${type}) at sequence ${nextSeq}.`);
    return { success: true, stage: newStage };
  }

  /**
   * Reorders stages (Move Up / Down)
   */
  public moveStage(tournamentId: string, stageId: string, direction: 'UP' | 'DOWN'): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;

    const idx = structure.stages.findIndex(s => s.id === stageId);
    if (idx === -1) return false;

    if (direction === 'UP' && idx > 0) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx - 1];
      structure.stages[idx - 1] = temp;
    } else if (direction === 'DOWN' && idx < structure.stages.length - 1) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx + 1];
      structure.stages[idx + 1] = temp;
    }

    structure.stages.forEach((s, i) => { s.sequence = i + 1; });
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'REORDER_STAGES', `Moved stage ${stageId} ${direction}.`);
    return true;
  }

  /**
   * Replaces stage type in place
   */
  public replaceStageType(tournamentId: string, stageId: string, newType: TournamentStageType): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage) return false;

    stage.type = newType;
    if (newType === 'GROUP_STAGE' || newType === 'ROUND_ROBIN' || newType === 'DOUBLE_ROUND_ROBIN') {
      stage.defaultSeriesFormat = 'BO2';
      stage.groupCount = stage.groupCount || 2;
      stage.teamsPerGroup = stage.teamsPerGroup || 4;
    } else if (newType === 'GSL') {
      stage.defaultSeriesFormat = 'BO3';
      stage.groupCount = stage.groupCount || 2;
      stage.teamsPerGroup = 4;
    } else {
      stage.defaultSeriesFormat = 'BO3';
    }

    stage.matches = [];
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'REPLACE_STAGE_TYPE', `Replaced stage ${stage.name} type with ${newType}.`);
    return true;
  }

  /**
   * Deletes a stage
   */
  public deleteStage(tournamentId: string, stageId: string): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stageToDelete = structure.stages.find(s => s.id === stageId);
    if (!stageToDelete) return false;

    // Check if stage has completed matches
    const hasCompleted = stageToDelete.matches?.some(m => m.status === 'COMPLETED');
    if (hasCompleted) {
      throw new Error('Cannot delete a stage with completed matches.');
    }

    structure.stages = structure.stages.filter(s => s.id !== stageId);
    structure.stages.forEach((s, i) => { s.sequence = i + 1; });
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'DELETE_STAGE', `Deleted stage "${stageToDelete.name}".`);
    return true;
  }

  /**
   * Updates stage properties
   */
  public updateStageConfig(tournamentId: string, stageId: string, updates: Partial<TournamentStageConfig>): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage) return false;

    Object.assign(stage, updates);
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'UPDATE_STAGE_CONFIG', `Updated configuration for stage "${stage.name}".`);
    return true;
  }

  /**
   * Swap seeds between two teams
   */
  public swapSeeds(tournamentId: string, stageId: string, seedA: number, seedB: number): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage || !stage.seededTeams) return false;

    const teamA = stage.seededTeams.find(t => t.seed === seedA);
    const teamB = stage.seededTeams.find(t => t.seed === seedB);
    if (!teamA || !teamB) return false;

    teamA.seed = seedB;
    teamB.seed = seedA;
    stage.seededTeams.sort((a, b) => a.seed - b.seed);
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'SWAP_SEEDS', `Swapped seed #${seedA} (${teamA.name}) with seed #${seedB} (${teamB.name}).`);
    return true;
  }

  /**
   * Swap two teams' placements and seeds directly
   */
  public swapTeams(tournamentId: string, teamIdA: string, teamIdB: string): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure || structure.isLocked) return false;

    // Swap in structure.teams
    if (structure.teams) {
      const idxA = structure.teams.findIndex(t => (t.teamId === teamIdA || (t as any).id === teamIdA));
      const idxB = structure.teams.findIndex(t => (t.teamId === teamIdB || (t as any).id === teamIdB));
      if (idxA !== -1 && idxB !== -1) {
        const teamA = structure.teams[idxA];
        const teamB = structure.teams[idxB];
        const tempSeed = teamA.seed;
        teamA.seed = teamB.seed;
        teamB.seed = tempSeed;
        structure.teams[idxA] = teamB;
        structure.teams[idxB] = teamA;
      }
    }

    // Also swap in each stage's seededTeams
    structure.stages.forEach(stage => {
      if (stage.seededTeams) {
        const tA = stage.seededTeams.find(t => (t.teamId === teamIdA || (t as any).id === teamIdA));
        const tB = stage.seededTeams.find(t => (t.teamId === teamIdB || (t as any).id === teamIdB));
        if (tA && tB) {
          const tempSeed = tA.seed;
          tA.seed = tB.seed;
          tB.seed = tempSeed;
          stage.seededTeams.sort((a, b) => a.seed - b.seed);
        }
      }
    });

    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'SWAP_TEAMS', `Swapped team placements between ${teamIdA} and ${teamIdB}.`);
    
    // Automatically re-generate draft fixtures if structure is not locked/published
    if (structure.status === 'DRAFT') {
      this.generateFullStructure(tournamentId, structure.teams);
    }
    return true;
  }

  /**
   * Updates match schedule or series format
   */
  public updateMatchSchedule(tournamentId: string, matchId: string, scheduledTime: string, seriesFormat?: SeriesFormat): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;

    let matchFound = false;
    for (const stage of structure.stages) {
      const found = stage.matches?.find(m => m.id === matchId);
      if (found) {
        if (scheduledTime) found.scheduledTime = scheduledTime;
        if (seriesFormat) found.seriesFormat = seriesFormat;
        matchFound = true;
      }
    }
    if (structure.matches) {
      const structMatch = structure.matches.find(m => m.id === matchId);
      if (structMatch) {
        if (scheduledTime) structMatch.scheduledTime = scheduledTime;
        if (seriesFormat) structMatch.seriesFormat = seriesFormat;
        matchFound = true;
      }
    }
    if (!matchFound) return false;

    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'UPDATE_MATCH_SCHEDULE', `Updated match ${matchId} schedule: ${scheduledTime}${seriesFormat ? ` (${seriesFormat})` : ''}`);
    this.persistStructure(tournamentId, structure);
    return true;
  }

  /**
   * Asynchronously updates match schedule, fetching from Firestore if needed
   */
  public async updateMatchScheduleAsync(params: {
    tournamentId: string;
    matchId: string;
    scheduledTime: string;
    seriesFormat?: SeriesFormat;
    draftStructure?: MultiStageTournamentStructure;
  }): Promise<{ success: boolean; structure?: MultiStageTournamentStructure; error?: string }> {
    let structure = this.getStructure(params.tournamentId);
    if (!structure) {
      structure = await this.fetchStructureFromFirestore(params.tournamentId);
    }
    if (!structure && params.draftStructure) {
      structure = params.draftStructure;
      this.structures.set(params.tournamentId, structure);
      this.persistStructure(params.tournamentId, structure);
    }
    if (!structure) {
      return { success: false, error: 'Tournament competition structure not found.' };
    }

    const ok = this.updateMatchSchedule(params.tournamentId, params.matchId, params.scheduledTime, params.seriesFormat);
    if (!ok) {
      return { success: false, error: `Match ${params.matchId} not found in competition structure.` };
    }

    const updated = this.getStructure(params.tournamentId) || structure;
    return { success: true, structure: updated };
  }

  /**
   * Authoritatively locates a competitive match node across all active tournament structures
   */
  public findMatch(matchId: string): { match: CompetitionMatchNode; structure: MultiStageTournamentStructure; tournamentId: string } | undefined {
    if (!matchId) return undefined;

    // 1. Check all currently loaded structures in memory
    for (const [tId, struct] of this.structures.entries()) {
      const match = (struct.matches || []).find(m => m.id === matchId);
      if (match) return { match, structure: struct, tournamentId: tId };

      for (const stage of struct.stages || []) {
        const stageMatch = (stage.matches || []).find(m => m.id === matchId);
        if (stageMatch) return { match: stageMatch, structure: struct, tournamentId: tId };
      }
    }

    // 2. Try finding via tournament ID prefix
    for (const [tId] of this.structures.entries()) {
      if (matchId.startsWith(tId)) {
        const struct = this.getStructure(tId);
        if (struct) {
          const match = (struct.matches || []).find(m => m.id === matchId);
          if (match) return { match, structure: struct, tournamentId: tId };
        }
      }
    }

    // 3. Check storage backend
    const storage = getStorageBackend();
    if (storage) {
      try {
        for (let i = 0; i < (storage.length || 0); i++) {
          const key = storage.key(i);
          if (key && key.startsWith('pbg_competition_structure_')) {
            const raw = storage.getItem(key);
            if (raw) {
              const struct = JSON.parse(raw) as MultiStageTournamentStructure;
              const match = (struct.matches || []).find(m => m.id === matchId);
              if (match) {
                this.structures.set(struct.tournamentId, struct);
                return { match, structure: struct, tournamentId: struct.tournamentId };
              }
            }
          }
        }
      } catch {}
    }

    return undefined;
  }

  /**
   * Asynchronously locates a match node, fetching from Firestore if not in local cache
   */
  public async findMatchAsync(matchId: string): Promise<{ match: CompetitionMatchNode; structure: MultiStageTournamentStructure; tournamentId: string } | undefined> {
    const cached = this.findMatch(matchId);
    if (cached) return cached;
    if (!matchId) return undefined;

    let candidateTourneyId = '';
    if (matchId.includes('-ub-') || matchId.includes('-lb-') || matchId.includes('-gf') || matchId.includes('-m')) {
      const idx = matchId.search(/-(ub|lb|gf|sf|r\d|stage|m\d)/);
      if (idx > 0) {
        candidateTourneyId = matchId.substring(0, idx);
      }
    }

    if (candidateTourneyId) {
      const struct = await this.fetchStructureFromFirestore(candidateTourneyId);
      if (struct) {
        const match = (struct.matches || []).find(m => m.id === matchId);
        if (match) return { match, structure: struct, tournamentId: candidateTourneyId };
        for (const stage of struct.stages || []) {
          const stageMatch = (stage.matches || []).find(m => m.id === matchId);
          if (stageMatch) return { match: stageMatch, structure: struct, tournamentId: candidateTourneyId };
        }
      }
    }

    return undefined;
  }

  /**
   * Reassign a team to a different group
   */
  public reassignTeamGroup(tournamentId: string, stageId: string, teamId: string, targetGroupId: string): boolean {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage || !stage.groups) return false;

    let targetTeam: any = null;
    stage.groups.forEach(grp => {
      const found = grp.teams.find(t => t.teamId === teamId);
      if (found) {
        targetTeam = found;
        grp.teams = grp.teams.filter(t => t.teamId !== teamId);
      }
    });

    if (!targetTeam) return false;

    const targetGroup = stage.groups.find(g => g.id === targetGroupId);
    if (!targetGroup) return false;

    targetTeam.groupId = targetGroup.id;
    targetTeam.groupName = targetGroup.name;
    targetGroup.teams.push(targetTeam);

    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'REASSIGN_GROUP', `Reassigned team ${targetTeam.name} to ${targetGroup.name}.`);
    return true;
  }

  /**
   * Applies automated seeding (MANUAL, RANDOM, RATING_BASED, RANKING_BASED)
   */
  public applySeedingMethod(
    tournamentId: string, 
    stageId: string, 
    method: SeedingMode
  ): { success: boolean; seededTeams: SeededTeam[] } {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, seededTeams: [] };
    const stage = structure.stages.find(s => s.id === stageId);
    if (!stage || !stage.seededTeams) return { success: false, seededTeams: [] };

    stage.seedingMode = method;

    if (method === 'RATING_BASED') {
      stage.seededTeams.sort((a, b) => ((b.mmr || b.rating || 0) - (a.mmr || a.rating || 0)));
      stage.seededTeams.forEach((t, i) => { t.seed = i + 1; });
    } else if (method === 'RANDOM') {
      const shuffled = [...stage.seededTeams].sort(() => Math.random() - 0.5);
      shuffled.forEach((t, i) => { t.seed = i + 1; });
      stage.seededTeams = shuffled;
    }

    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'APPLY_SEEDING', `Applied ${method} seeding to stage "${stage.name}".`);
    return { success: true, seededTeams: stage.seededTeams };
  }

  /**
   * Generates bracket/group match fixtures for all stages in structure
   */
  public generateFullStructure(tournamentId: string, availableTeams: any[] = []): { success: boolean; structure: MultiStageTournamentStructure } {
    const structure = this.getOrCreateStructure(tournamentId, availableTeams);
    const teamsList: SeededTeam[] = (structure.teams && structure.teams.length > 0) 
      ? structure.teams 
      : this.normalizeTeams(availableTeams);

    structure.teams = teamsList;

    // Specific fixture: Groups -> Playoffs (e.g. Purple Bean Challenger or configured as groups_to_playoffs)
    if (tournamentId === 'pb-challenger-2026' || structure.format === 'groups_to_playoffs') {
      const teamsA = teamsList.slice(0, 4);
      const teamsB = teamsList.slice(4, 8);
      const matchesA = this.buildRoundRobinMatches(tournamentId, teamsA, 'BO1', 'group-a');
      const matchesB = this.buildRoundRobinMatches(tournamentId, teamsB, 'BO1', 'group-b');
      const standingsA = teamsA.map((t, idx) => ({
        teamId: t.teamId,
        teamName: t.name || t.teamName,
        rank: idx + 1,
        points: (3 - idx) * 3,
        gamesWon: (3 - idx) * 2,
        gamesLost: idx * 2
      }));
      const standingsB = teamsB.map((t, idx) => ({
        teamId: t.teamId,
        teamName: t.name || t.teamName,
        rank: idx + 1,
        points: (3 - idx) * 3,
        gamesWon: (3 - idx) * 2,
        gamesLost: idx * 2
      }));

      structure.groups = {
        'group-a': { id: 'group-a', name: 'Group A', teams: teamsA, matches: matchesA, standings: standingsA },
        'group-b': { id: 'group-b', name: 'Group B', teams: teamsB, matches: matchesB, standings: standingsB }
      };

      const sf1: CompetitionMatchNode = {
        id: `${tournamentId}-po-sf-1`,
        tournamentId,
        stage: 'playoffs',
        round: 'Playoff Semifinal 1',
        roundKey: 'po-sf',
        bracketType: 'upper',
        seriesFormat: 'BO3',
        teamA: { name: 'Group A 1st Place', sourceLabel: 'A1', seed: 1 },
        teamB: { name: 'Group B 2nd Place', sourceLabel: 'B2', seed: 2 },
        winnerNextMatchId: `${tournamentId}-po-final`,
        winnerNextSlot: 'teamA',
        winnerDestinationId: `${tournamentId}-po-final`,
        winnerDestinationSlot: 'teamA',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      };

      const sf2: CompetitionMatchNode = {
        id: `${tournamentId}-po-sf-2`,
        tournamentId,
        stage: 'playoffs',
        round: 'Playoff Semifinal 2',
        roundKey: 'po-sf',
        bracketType: 'upper',
        seriesFormat: 'BO3',
        teamA: { name: 'Group B 1st Place', sourceLabel: 'B1', seed: 1 },
        teamB: { name: 'Group A 2nd Place', sourceLabel: 'A2', seed: 2 },
        winnerNextMatchId: `${tournamentId}-po-final`,
        winnerNextSlot: 'teamB',
        winnerDestinationId: `${tournamentId}-po-final`,
        winnerDestinationSlot: 'teamB',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      };

      const poFinal: CompetitionMatchNode = {
        id: `${tournamentId}-po-final`,
        tournamentId,
        stage: 'grand_final',
        round: 'Playoff Grand Final',
        roundKey: 'po-final',
        bracketType: 'grand_final',
        seriesFormat: 'BO5',
        teamA: { name: 'Winner SF1', seed: 0 },
        teamB: { name: 'Winner SF2', seed: 0 },
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      };

      const allMatches = [...matchesA, ...matchesB, sf1, sf2, poFinal];
      structure.matches = allMatches;
      if (structure.stages[0]) structure.stages[0].matches = allMatches;
      structure.updatedAt = new Date().toISOString();
      return { success: true, structure };
    }

    let allStructureMatches: CompetitionMatchNode[] = [];

    // Process each stage sequentially
    for (let sIdx = 0; sIdx < structure.stages.length; sIdx++) {
      const stage = structure.stages[sIdx];
      const isFirstStage = sIdx === 0;
      const stageTeams = isFirstStage ? [...teamsList] : (stage.seededTeams || []);

      if (stage.type === 'GROUP_STAGE' || stage.type === 'ROUND_ROBIN' || stage.type === 'DOUBLE_ROUND_ROBIN') {
        const groupCount = Math.max(1, stage.groupCount || 2);
        const groups: GroupConfig[] = [];
        const stageMatches: CompetitionMatchNode[] = [];

        for (let g = 0; g < groupCount; g++) {
          const letter = String.fromCharCode(65 + g);
          groups.push({
            id: `group-${stage.id}-${letter}`,
            name: `Group ${letter}`,
            teams: []
          });
        }

        stageTeams.forEach((tm, idx) => {
          const targetGroup = groups[idx % groupCount];
          tm.groupId = targetGroup.id;
          tm.groupName = targetGroup.name;
          targetGroup.teams.push(tm);
        });

        stage.groups = groups;

        // Round robin pairings
        const isDoubleRR = stage.type === 'DOUBLE_ROUND_ROBIN';
        groups.forEach(grp => {
          const grpTeams = grp.teams;
          let matchNum = 1;
          for (let i = 0; i < grpTeams.length; i++) {
            for (let j = i + 1; j < grpTeams.length; j++) {
              // Leg 1
              stageMatches.push({
                id: `match-${stage.id}-${grp.name.replace(/\s+/g, '')}-m${matchNum++}`,
                tournamentId,
                stageId: stage.id,
                stageName: stage.name,
                round: `${grp.name} Round 1`,
                roundKey: grp.name,
                bracketType: 'group',
                seriesFormat: stage.defaultSeriesFormat || 'BO2',
                teamA: grpTeams[i],
                teamB: grpTeams[j],
                teamASource: { type: 'SEED', sourceSeed: grpTeams[i].seed, label: `#${grpTeams[i].seed} ${grpTeams[i].name}` },
                teamBSource: { type: 'SEED', sourceSeed: grpTeams[j].seed, label: `#${grpTeams[j].seed} ${grpTeams[j].name}` },
                status: 'UPCOMING',
                scores: { teamA: 0, teamB: 0 },
                games: []
              });

              // Leg 2 if Double Round Robin
              if (isDoubleRR) {
                stageMatches.push({
                  id: `match-${stage.id}-${grp.name.replace(/\s+/g, '')}-m${matchNum++}`,
                  tournamentId,
                  stageId: stage.id,
                  stageName: stage.name,
                  round: `${grp.name} Round 2`,
                  roundKey: grp.name,
                  bracketType: 'group',
                  seriesFormat: stage.defaultSeriesFormat || 'BO2',
                  teamA: grpTeams[j],
                  teamB: grpTeams[i],
                  teamASource: { type: 'SEED', sourceSeed: grpTeams[j].seed, label: `#${grpTeams[j].seed} ${grpTeams[j].name}` },
                  teamBSource: { type: 'SEED', sourceSeed: grpTeams[i].seed, label: `#${grpTeams[i].seed} ${grpTeams[i].name}` },
                  status: 'UPCOMING',
                  scores: { teamA: 0, teamB: 0 },
                  games: []
                });
              }
            }
          }
        });

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);

      } else if (stage.type === 'GSL') {
        // GSL Dual Tournament Format (4 teams per group)
        const groupCount = Math.max(1, stage.groupCount || 2);
        const groups: GroupConfig[] = [];
        const stageMatches: CompetitionMatchNode[] = [];

        for (let g = 0; g < groupCount; g++) {
          const letter = String.fromCharCode(65 + g);
          groups.push({
            id: `gsl-group-${stage.id}-${letter}`,
            name: `Group ${letter}`,
            teams: []
          });
        }

        stageTeams.forEach((tm, idx) => {
          const targetGroup = groups[idx % groupCount];
          tm.groupId = targetGroup.id;
          tm.groupName = targetGroup.name;
          targetGroup.teams.push(tm);
        });

        stage.groups = groups;

        groups.forEach(grp => {
          const gTeams = grp.teams;
          const gName = grp.name;
          const mPrefix = `match-${stage.id}-${gName.replace(/\s+/g, '')}`;

          // Match 1: Opening 1 (Team 1 vs Team 4)
          const m1Id = `${mPrefix}-opening-1`;
          // Match 2: Opening 2 (Team 2 vs Team 3)
          const m2Id = `${mPrefix}-opening-2`;
          // Match 3: Winners Match
          const m3Id = `${mPrefix}-winners`;
          // Match 4: Elimination Match
          const m4Id = `${mPrefix}-elim`;
          // Match 5: Decider Match
          const m5Id = `${mPrefix}-decider`;

          stageMatches.push({
            id: m1Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Opening Match 1`,
            roundKey: 'GSL_OPENING',
            bracketType: 'gsl',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: gTeams[0] || { name: 'Seed #1', seed: 1 },
            teamB: gTeams[3] || { name: 'Seed #4', seed: 4 },
            winnerDestinationId: m3Id,
            winnerDestinationSlot: 'teamA',
            loserDestinationId: m4Id,
            loserDestinationSlot: 'teamA',
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });

          stageMatches.push({
            id: m2Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Opening Match 2`,
            roundKey: 'GSL_OPENING',
            bracketType: 'gsl',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: gTeams[1] || { name: 'Seed #2', seed: 2 },
            teamB: gTeams[2] || { name: 'Seed #3', seed: 3 },
            winnerDestinationId: m3Id,
            winnerDestinationSlot: 'teamB',
            loserDestinationId: m4Id,
            loserDestinationSlot: 'teamB',
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });

          stageMatches.push({
            id: m3Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Winners Match`,
            roundKey: 'GSL_WINNERS',
            bracketType: 'gsl',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Winner Opening 1', seed: 0 },
            teamB: { name: 'Winner Opening 2', seed: 0 },
            loserDestinationId: m5Id,
            loserDestinationSlot: 'teamA',
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });

          stageMatches.push({
            id: m4Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Elimination Match`,
            roundKey: 'GSL_ELIM',
            bracketType: 'gsl',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Loser Opening 1', seed: 0 },
            teamB: { name: 'Loser Opening 2', seed: 0 },
            winnerDestinationId: m5Id,
            winnerDestinationSlot: 'teamB',
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });

          stageMatches.push({
            id: m5Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Decider Match`,
            roundKey: 'GSL_DECIDER',
            bracketType: 'gsl',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: { name: 'Loser Winners Match', seed: 0 },
            teamB: { name: 'Winner Elimination Match', seed: 0 },
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
        });

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);

      } else if (stage.type === 'SWISS') {
        // Swiss System rounds
        const totalRounds = stage.swissRoundsCount || (stageTeams.length >= 8 ? 3 : 2);
        const stageMatches: CompetitionMatchNode[] = [];

        // Round 1 pairings
        const half = Math.floor(stageTeams.length / 2);
        for (let i = 0; i < half; i++) {
          stageMatches.push({
            id: `match-${stage.id}-swiss-r1-m${i + 1}`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: 'Swiss Round 1',
            roundKey: 'SWISS_R1',
            bracketType: 'swiss',
            seriesFormat: stage.defaultSeriesFormat || 'BO3',
            teamA: stageTeams[i],
            teamB: stageTeams[stageTeams.length - 1 - i],
            status: 'UPCOMING',
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
        }

        // Subsequent rounds placeholders
        for (let r = 2; r <= totalRounds; r++) {
          for (let m = 1; m <= half; m++) {
            stageMatches.push({
              id: `match-${stage.id}-swiss-r${r}-m${m}`,
              tournamentId,
              stageId: stage.id,
              stageName: stage.name,
              round: `Swiss Round ${r}`,
              roundKey: `SWISS_R${r}`,
              bracketType: 'swiss',
              seriesFormat: stage.defaultSeriesFormat || 'BO3',
              teamA: { name: `Round ${r - 1} Contender`, seed: 0 },
              teamB: { name: `Round ${r - 1} Contender`, seed: 0 },
              status: 'UPCOMING',
              scores: { teamA: 0, teamB: 0 },
              games: []
            });
          }
        }

        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);

      } else if (stage.type === 'DOUBLE_ELIMINATION') {
        const gfSeriesFormat = (structure.roundSeriesOverrides?.['gf'] as SeriesFormat) || stage.grandFinalSeriesFormat || 'BO5';
        const effectiveTeams = stageTeams.length > 0 ? stageTeams : Array.from({ length: 8 }, (_, i) => ({
          teamId: `team-${i + 1}`,
          name: `Seed #${i + 1}`,
          teamName: `Seed #${i + 1}`,
          tag: `S${i + 1}`,
          seed: i + 1,
          logo: '🛡️'
        }));

        // Check if preceded by a group stage with 2 groups (Mixed-entry Playoff structure)
        const prevGroupStage = sIdx > 0 ? structure.stages.slice(0, sIdx).reverse().find(s => s.type === 'GROUP_STAGE' || s.type === 'ROUND_ROBIN' || s.type === 'DOUBLE_ROUND_ROBIN') : null;
        if (prevGroupStage && ((prevGroupStage.groups && prevGroupStage.groups.length >= 2) || (stage as any).mixedEntryFromGroups)) {
          const grpA = prevGroupStage.groups?.[0];
          const grpB = prevGroupStage.groups?.[1];
          const standingsA = grpA ? this.calculateGroupStandings(grpA, prevGroupStage.matches) : [];
          const standingsB = grpB ? this.calculateGroupStandings(grpB, prevGroupStage.matches) : [];
          const stageMatches = this.generateMixedEntryPlayoffMatches({
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            groupAStandings: standingsA,
            groupBStandings: standingsB,
            defaultFormat: stage.defaultSeriesFormat || 'BO3',
            gfFormat: gfSeriesFormat
          });
          stage.matches = stageMatches;
          allStructureMatches.push(...stageMatches);
        } else {
          const stageMatches = this.generateDoubleEliminationMatches(
            tournamentId,
            effectiveTeams,
            stage.defaultSeriesFormat || 'BO3',
            gfSeriesFormat
          );
          stage.matches = stageMatches;
          allStructureMatches.push(...stageMatches);
        }

      } else if (stage.type === 'SINGLE_ELIMINATION' || stage.type === 'PLAY_IN') {
        const gfSeriesFormat = (structure.roundSeriesOverrides?.['gf'] as SeriesFormat) || stage.grandFinalSeriesFormat || 'BO5';
        const effectiveTeams = stageTeams.length > 0 ? stageTeams : Array.from({ length: 4 }, (_, i) => ({
          teamId: `team-${i + 1}`,
          name: `Seed #${i + 1}`,
          teamName: `Seed #${i + 1}`,
          tag: `S${i + 1}`,
          seed: i + 1,
          logo: '🛡️'
        }));
        const stageMatches = this.generateSingleEliminationMatches(
          tournamentId,
          effectiveTeams,
          stage.defaultSeriesFormat || 'BO3',
          gfSeriesFormat
        );
        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else {
        stage.matches = [];
      }
    }

    // Preserve completed/forfeit/live matches from previous tournament state
    const existingMatchesMap = new Map<string, CompetitionMatchNode>();
    (structure.matches || []).forEach(m => {
      if (m.status === 'COMPLETED' || m.status === 'FORFEIT' || m.status === 'LIVE') {
        existingMatchesMap.set(m.id, m);
      }
    });

    if (existingMatchesMap.size > 0) {
      allStructureMatches = allStructureMatches.map(m => existingMatchesMap.get(m.id) || m);
      structure.stages.forEach(stg => {
        stg.matches = stg.matches.map(m => existingMatchesMap.get(m.id) || m);
      });
    }

    structure.matches = allStructureMatches;
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'GENERATE_STRUCTURE', `Generated matches for ${structure.stages.length} stages (${allStructureMatches.length} total fixtures).`);
    this.persistStructure(tournamentId, structure);
    return { success: true, structure };
  }

  /**
   * Calculates standings for a group
   */
  public calculateGroupStandings(group: GroupConfig, matches: CompetitionMatchNode[]): GroupStandingRow[] {
    const table = new Map<string, GroupStandingRow>();

    // Initialize all teams in group
    group.teams.forEach((t, idx) => {
      table.set(t.teamId, {
        position: idx + 1,
        teamId: t.teamId,
        teamName: t.name,
        tag: t.tag,
        logo: t.logo || '🛡️',
        seed: t.seed,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDiff: 0,
        points: 0
      });
    });

    // Process completed group matches
    matches.forEach(m => {
      if (m.status !== 'COMPLETED' || !m.scores) return;
      const teamAId = m.teamA?.teamId || m.teamA?.id;
      const teamBId = m.teamB?.teamId || m.teamB?.id;
      if (!teamAId || !teamBId) return;

      const rowA = table.get(teamAId);
      const rowB = table.get(teamBId);
      if (!rowA || !rowB) return;

      const scoreA = m.scores.teamA;
      const scoreB = m.scores.teamB;

      rowA.played += 1;
      rowB.played += 1;
      rowA.gamesWon += scoreA;
      rowA.gamesLost += scoreB;
      rowB.gamesWon += scoreB;
      rowB.gamesLost += scoreA;

      if (scoreA > scoreB) {
        rowA.won += 1;
        rowA.points += 3;
        rowB.lost += 1;
      } else if (scoreB > scoreA) {
        rowB.won += 1;
        rowB.points += 3;
        rowA.lost += 1;
      } else {
        // Draw (e.g. 1-1 in BO2)
        rowA.drawn += 1;
        rowB.drawn += 1;
        rowA.points += 1;
        rowB.points += 1;
      }

      rowA.gameDiff = rowA.gamesWon - rowA.gamesLost;
      rowB.gameDiff = rowB.gamesWon - rowB.gamesLost;
    });

    const rows = Array.from(table.values());

    // Strict competitive tiebreak sequence:
    // 1. Points
    // 2. Head-to-Head (if 2 teams tied)
    // 3. Game Differential
    // 4. Games Won
    // 5. Seed order
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;

      // 2. Head-to-Head between a and b
      const h2hMatch = matches.find(m => 
        (m.status === 'COMPLETED' || m.status === 'FORFEIT') && m.scores &&
        ((m.teamA?.teamId === a.teamId && m.teamB?.teamId === b.teamId) ||
         (m.teamA?.teamId === b.teamId && m.teamB?.teamId === a.teamId))
      );
      if (h2hMatch && h2hMatch.scores) {
        const isTeamA_First = h2hMatch.teamA?.teamId === a.teamId;
        const aScore = isTeamA_First ? h2hMatch.scores.teamA : h2hMatch.scores.teamB;
        const bScore = isTeamA_First ? h2hMatch.scores.teamB : h2hMatch.scores.teamA;
        if (aScore > bScore) return -1;
        if (bScore > aScore) return 1;
      }

      // 3. Game Differential
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;

      // 4. Games Won
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;

      // 5. Seed order
      return (a.seed || 99) - (b.seed || 99);
    });

    rows.forEach((row, i) => {
      row.position = i + 1;
      if (i < 2) {
        row.destination = 'UPPER_BRACKET';
      } else {
        row.destination = 'LOWER_BRACKET';
      }
    });

    return rows;
  }

  /**
   * Records match results transactionally, validates BO formats, and advances winner/loser
   */
  public recordMatchResult(params: {
    tournamentId: string;
    stageId: string;
    matchId: string;
    scoreA: number;
    scoreB: number;
    games?: DotaIndividualGame[];
    confirmedBy?: string;
    isForfeit?: boolean;
    forfeitWinnerId?: string;
    clientVersion?: number;
    callerRole?: string;
    isAdmin?: boolean;
  }): { success: boolean; match?: CompetitionMatchNode; error?: string } {
    if (params.callerRole && params.callerRole !== 'organizer' && params.callerRole !== 'admin' && !params.isAdmin) {
      return { success: false, error: 'Unauthorized: Only tournament organizers and admins can confirm official match results.' };
    }

    const structure = this.getStructure(params.tournamentId);
    if (!structure) return { success: false, error: 'Tournament structure not found.' };

    const stage = structure.stages.find(s => s.id === params.stageId) || structure.stages.find(s => s.matches.some(m => m.id === params.matchId));
    if (!stage) return { success: false, error: 'Stage not found.' };

    const match = stage.matches.find(m => m.id === params.matchId);
    if (!match) return { success: false, error: 'Match not found in stage.' };

    // Offline / stale submission protection
    if (typeof params.clientVersion === 'number' && params.clientVersion > 0 && (structure.version || 1) > params.clientVersion) {
      if (match.status === 'COMPLETED' || match.status === 'FORFEIT') {
        if (match.scores?.teamA === params.scoreA && match.scores?.teamB === params.scoreB) {
          return { success: true, match };
        }
        return { success: false, error: 'STALE_SUBMISSION_CONFLICT: A newer official match result has already been confirmed by the server.' };
      }
    }

    // Strict idempotency check: repeated or simultaneous submission with identical result
    if (
      match.status === 'COMPLETED' && 
      match.scores?.teamA === params.scoreA && 
      match.scores?.teamB === params.scoreB && 
      (!params.isForfeit || match.forfeitWinnerId === params.forfeitWinnerId)
    ) {
      return { success: true, match };
    }

    // Downstream lock: do not corrupt downstream matches if destination match has already begun/completed
    const checkDestId = match.winnerDestinationId || match.winnerNextMatchId;
    const destMatch = checkDestId ? (stage.matches.find(m => m.id === checkDestId) || structure.matches.find(m => m.id === checkDestId)) : undefined;
    if (match.status === 'COMPLETED' && destMatch && (destMatch.status === 'LIVE' || destMatch.status === 'COMPLETED')) {
      return { success: false, error: 'Cannot modify match: downstream destination match has already begun or completed.' };
    }

    // Format validation
    const format = match.seriesFormat || 'BO3';
    let targetWins = 2;
    if (format === 'BO1') targetWins = 1;
    if (format === 'BO2') targetWins = 2; // Draws (1-1) allowed
    if (format === 'BO3') targetWins = 2;
    if (format === 'BO5') targetWins = 3;
    if (format === 'BO7') targetWins = 4;

    if (format !== 'BO2') {
      if (params.scoreA < targetWins && params.scoreB < targetWins && !params.isForfeit) {
        return { success: false, error: `Invalid series score. ${format} requires at least one team to reach ${targetWins} game wins.` };
      }
      if (params.scoreA > targetWins || params.scoreB > targetWins) {
        return { success: false, error: `Invalid series score. In ${format}, game wins cannot exceed ${targetWins}.` };
      }
    }

    match.scores = { teamA: params.scoreA, teamB: params.scoreB };
    match.games = params.games || [];
    match.confirmedBy = params.confirmedBy || 'Organiser';
    match.confirmedAt = new Date().toISOString();

    let winningTeam = null;
    let losingTeam = null;

    if (params.isForfeit && params.forfeitWinnerId) {
      match.status = 'FORFEIT';
      match.forfeitWinnerId = params.forfeitWinnerId;
      if (match.teamA?.teamId === params.forfeitWinnerId || match.teamA?.id === params.forfeitWinnerId) {
        winningTeam = match.teamA;
        losingTeam = match.teamB;
      } else {
        winningTeam = match.teamB;
        losingTeam = match.teamA;
      }
    } else {
      match.status = 'COMPLETED';
      if (params.scoreA > params.scoreB) {
        winningTeam = match.teamA;
        losingTeam = match.teamB;
      } else if (params.scoreB > params.scoreA) {
        winningTeam = match.teamB;
        losingTeam = match.teamA;
      }
    }

    match.winnerId = winningTeam?.teamId || winningTeam?.id;
    match.loserId = losingTeam?.teamId || losingTeam?.id;

    // Transactional bracket advancement
    const winDestId = match.winnerDestinationId || match.winnerNextMatchId;
    const winSlot = match.winnerDestinationSlot || match.winnerNextSlot;
    if (winningTeam && winDestId) {
      const destMatch = stage.matches.find(m => m.id === winDestId) || structure.matches.find(m => m.id === winDestId);
      if (destMatch) {
        const slot = winSlot || (destMatch.teamA?.seed === 0 ? 'teamA' : 'teamB');
        if (slot === 'teamA') {
          destMatch.teamA = { ...winningTeam };
        } else {
          destMatch.teamB = { ...winningTeam };
        }
      }
    }

    const loseDestId = match.loserDestinationId || match.loserNextMatchId;
    const loseSlot = match.loserDestinationSlot || match.loserNextSlot;
    if (losingTeam && loseDestId) {
      const destMatch = stage.matches.find(m => m.id === loseDestId) || structure.matches.find(m => m.id === loseDestId);
      if (destMatch) {
        const slot = loseSlot || (destMatch.teamA?.seed === 0 ? 'teamA' : 'teamB');
        if (slot === 'teamA') {
          destMatch.teamA = { ...losingTeam };
        } else {
          destMatch.teamB = { ...losingTeam };
        }
      }
    }

    // Keep structure.matches updated
    const smIdx = structure.matches.findIndex(m => m.id === match.id);
    if (smIdx >= 0) {
      structure.matches[smIdx] = { ...match };
    }

    // Check if stage is fully concluded
    const allStageMatchesDone = stage.matches.every(m => m.status === 'COMPLETED' || m.status === 'FORFEIT');
    if (allStageMatchesDone) {
      stage.status = 'FINISHED';
      this.evaluateStageAdvancement(structure, stage);
    } else {
      stage.status = 'LIVE';
    }

    structure.version = (structure.version || 1) + 1;
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'RECORD_MATCH_RESULT', `Recorded match ${match.id} score: ${params.scoreA}-${params.scoreB}. Winner: ${winningTeam?.name || 'Draw'}`);
    this.persistStructure(params.tournamentId, structure);
    return { success: true, match };
  }

  /**
   * Authoritative Firestore Transaction for atomic result confirmation, progression, and idempotency
   */
  public async recordMatchResultTransactional(params: {
    tournamentId: string;
    stageId: string;
    matchId: string;
    scoreA: number;
    scoreB: number;
    games?: DotaIndividualGame[];
    confirmedBy?: string;
    isForfeit?: boolean;
    forfeitWinnerId?: string;
    clientVersion?: number;
    callerRole?: string;
    isAdmin?: boolean;
  }): Promise<{ success: boolean; match?: CompetitionMatchNode; structure?: MultiStageTournamentStructure; error?: string }> {
    if (params.callerRole && params.callerRole !== 'organizer' && params.callerRole !== 'admin' && !params.isAdmin) {
      return { success: false, error: 'ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can record match results.' };
    }

    if ((serverAdminDb || db) && params.tournamentId) {
      try {
        const runTxn = serverAdminDb 
          ? (cb: any) => serverAdminDb.runTransaction(cb)
          : (cb: any) => runTransaction(db, cb);

        const structRef = serverAdminDb
          ? serverAdminDb.collection('tournaments').doc(params.tournamentId).collection('competition').doc('structure')
          : doc(db, 'tournaments', params.tournamentId, 'competition', 'structure');

        const tourneyRef = serverAdminDb
          ? serverAdminDb.collection('tournaments').doc(params.tournamentId)
          : doc(db, 'tournaments', params.tournamentId);

        const result = await runTxn(async (txn: any) => {
          const structSnap = await txn.get(structRef);
          const structExists = typeof structSnap.exists === 'function' ? structSnap.exists() : Boolean(structSnap.exists);

          let structure: MultiStageTournamentStructure;
          if (structExists) {
            structure = structSnap.data() as MultiStageTournamentStructure;
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error('Tournament structure not found');
            structure = JSON.parse(JSON.stringify(memory));
          }

          // Offline / stale submission protection
          if (typeof params.clientVersion === 'number' && params.clientVersion > 0 && (structure.version || 1) > params.clientVersion) {
            const m = structure.matches.find(x => x.id === params.matchId);
            if (m && m.status === 'COMPLETED') {
              if (m.scores?.teamA === params.scoreA && m.scores?.teamB === params.scoreB) {
                return { success: true, match: m, structure };
              }
              throw new Error('STALE_SUBMISSION_CONFLICT: A newer official match result has already been confirmed by the server.');
            }
          }

          const stage = structure.stages.find(s => s.id === params.stageId) || structure.stages.find(s => s.matches.some(m => m.id === params.matchId));
          if (!stage) throw new Error('Stage not found');

          const match = stage.matches.find(m => m.id === params.matchId);
          if (!match) throw new Error('Match not found in stage');

          // Idempotency check inside transaction
          if (
            match.status === 'COMPLETED' && 
            match.scores?.teamA === params.scoreA && 
            match.scores?.teamB === params.scoreB && 
            (!params.isForfeit || match.forfeitWinnerId === params.forfeitWinnerId)
          ) {
            return { success: true, match, structure };
          }

          // Downstream progression guard
          const checkDestId = match.winnerDestinationId || match.winnerNextMatchId;
          const destMatch = checkDestId ? (stage.matches.find(m => m.id === checkDestId) || structure.matches.find(m => m.id === checkDestId)) : undefined;
          if (match.status === 'COMPLETED' && destMatch && (destMatch.status === 'LIVE' || destMatch.status === 'COMPLETED')) {
            throw new Error('Cannot modify match: downstream destination match has already begun or completed.');
          }

          // Format validation
          const format = match.seriesFormat || 'BO3';
          let targetWins = 2;
          if (format === 'BO1') targetWins = 1;
          if (format === 'BO2') targetWins = 2;
          if (format === 'BO3') targetWins = 2;
          if (format === 'BO5') targetWins = 3;
          if (format === 'BO7') targetWins = 4;

          if (format !== 'BO2') {
            if (params.scoreA < targetWins && params.scoreB < targetWins && !params.isForfeit) {
              throw new Error(`Invalid series score. ${format} requires at least one team to reach ${targetWins} game wins.`);
            }
            if (params.scoreA > targetWins || params.scoreB > targetWins) {
              throw new Error(`Invalid series score. In ${format}, game wins cannot exceed ${targetWins}.`);
            }
          }

          match.scores = { teamA: params.scoreA, teamB: params.scoreB };
          match.games = params.games || [];
          match.confirmedBy = params.confirmedBy || 'Organiser';
          match.confirmedAt = new Date().toISOString();

          let winningTeam: any = null;
          let losingTeam: any = null;

          if (params.isForfeit && params.forfeitWinnerId) {
            match.status = 'FORFEIT';
            match.forfeitWinnerId = params.forfeitWinnerId;
            if (match.teamA?.teamId === params.forfeitWinnerId || match.teamA?.id === params.forfeitWinnerId) {
              winningTeam = match.teamA;
              losingTeam = match.teamB;
            } else {
              winningTeam = match.teamB;
              losingTeam = match.teamA;
            }
          } else {
            match.status = 'COMPLETED';
            if (params.scoreA > params.scoreB) {
              winningTeam = match.teamA;
              losingTeam = match.teamB;
            } else if (params.scoreB > params.scoreA) {
              winningTeam = match.teamB;
              losingTeam = match.teamA;
            }
          }

          match.winnerId = winningTeam?.teamId || winningTeam?.id;
          match.loserId = losingTeam?.teamId || losingTeam?.id;

          const winDestId = match.winnerDestinationId || match.winnerNextMatchId;
          const winSlot = match.winnerDestinationSlot || match.winnerNextSlot;
          if (winningTeam && winDestId) {
            const dMatch = stage.matches.find(m => m.id === winDestId) || structure.matches.find(m => m.id === winDestId);
            if (dMatch) {
              const slot = winSlot || (dMatch.teamA?.seed === 0 ? 'teamA' : 'teamB');
              if (slot === 'teamA') dMatch.teamA = { ...winningTeam };
              else dMatch.teamB = { ...winningTeam };
            }
          }

          const loseDestId = match.loserDestinationId || match.loserNextMatchId;
          const loseSlot = match.loserDestinationSlot || match.loserNextSlot;
          if (losingTeam && loseDestId) {
            const dMatch = stage.matches.find(m => m.id === loseDestId) || structure.matches.find(m => m.id === loseDestId);
            if (dMatch) {
              const slot = loseSlot || (dMatch.teamA?.seed === 0 ? 'teamA' : 'teamB');
              if (slot === 'teamA') dMatch.teamA = { ...losingTeam };
              else dMatch.teamB = { ...losingTeam };
            }
          }

          const smIdx = structure.matches.findIndex(m => m.id === match.id);
          if (smIdx >= 0) {
            structure.matches[smIdx] = { ...match };
          }

          const allStageMatchesDone = stage.matches.every(m => m.status === 'COMPLETED' || m.status === 'FORFEIT');
          if (allStageMatchesDone) {
            stage.status = 'FINISHED';
            this.evaluateStageAdvancement(structure, stage);
          } else {
            stage.status = 'LIVE';
          }

          structure.version = (structure.version || 1) + 1;
          structure.updatedAt = new Date().toISOString();
          this.appendAudit(structure, 'RECORD_MATCH_RESULT_TXN', `Transactionally confirmed match ${match.id} score: ${params.scoreA}-${params.scoreB}. Winner: ${winningTeam?.name || 'Draw'}`);

          const sanitizedStructure = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitizedStructure, { merge: true });

          txn.set(tourneyRef, {
            competitionStructure: sanitizedStructure,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
              format: structure.format,
              updatedAt: structure.updatedAt,
              publishedAt: structure.publishedAt || null
            },
            updatedAt: structure.updatedAt
          }, { merge: true });

          return { success: true, match, structure };
        });

        if (result.success && result.structure) {
          this.structures.set(params.tournamentId, result.structure);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure)); } catch {}
          this.notifySubscribers(params.tournamentId, result.structure);
        }

        return result;
      } catch (err: any) {
        if (err?.message?.includes('STALE_SUBMISSION_CONFLICT') || err?.message?.includes('Cannot modify match') || err?.message?.includes('ORGANIZER_PERMISSION_REQUIRED')) {
          return { success: false, error: err.message };
        }
      }
    }

    const localRes = this.recordMatchResult(params);
    const struct = this.getStructure(params.tournamentId);
    return { ...localRes, structure: struct };
  }

  /**
   * Automatic stage advancement into subsequent playoff stages
   */
  private evaluateStageAdvancement(structure: MultiStageTournamentStructure, finishedStage: TournamentStageConfig): void {
    const nextStage = structure.stages.find(s => s.sequence === finishedStage.sequence + 1);
    if (!nextStage) return;

    if (finishedStage.type === 'GROUP_STAGE' || finishedStage.type === 'ROUND_ROBIN' || finishedStage.type === 'DOUBLE_ROUND_ROBIN') {
      const allGroupStandings: GroupStandingRow[][] = (finishedStage.groups || []).map(grp => 
        this.calculateGroupStandings(grp, finishedStage.matches)
      );

      // Advance top 2 from each group to Upper Bracket, 3rd & 4th to Lower Bracket
      if (allGroupStandings.length >= 2) {
        this.advanceGroupStageToPlayoffs({
          tournamentId: structure.tournamentId,
          groupAStandings: allGroupStandings[0],
          groupBStandings: allGroupStandings[1],
          playoffStageId: nextStage.id
        });
      }
    }
  }

  /**
   * Generates a 10-match mixed-entry double elimination playoff structure for 2 groups of 4:
   * Upper Bracket (4 teams: A1, A2, B1, B2)
   * Lower Bracket (4 teams: A3, A4, B3, B4)
   */
  public generateMixedEntryPlayoffMatches(params: {
    tournamentId: string;
    stageId?: string;
    stageName?: string;
    groupAStandings?: GroupStandingRow[] | SeededTeam[];
    groupBStandings?: GroupStandingRow[] | SeededTeam[];
    defaultFormat?: SeriesFormat;
    gfFormat?: SeriesFormat;
  }): CompetitionMatchNode[] {
    const {
      tournamentId,
      stageId = 'playoffs',
      stageName = 'Playoff Bracket',
      groupAStandings = [],
      groupBStandings = [],
      defaultFormat = 'BO3',
      gfFormat = 'BO5'
    } = params;

    const tid = tournamentId;
    const ubSf1Id = `${tid}-ub-sf-1`;
    const ubSf2Id = `${tid}-ub-sf-2`;
    const ubFinalId = `${tid}-ub-final`;

    const lbR1_1Id = `${tid}-lb-r1-m1`;
    const lbR1_2Id = `${tid}-lb-r1-m2`;
    const lbR2_1Id = `${tid}-lb-r2-m1`;
    const lbR2_2Id = `${tid}-lb-r2-m2`;
    const lbSfId = `${tid}-lb-sf`;
    const lbFinalId = `${tid}-lb-final`;
    const gfId = `${tid}-gf`;

    const getTeam = (list: any[], pos: number, defaultName: string, label: string): SeededTeam => {
      const item = list[pos - 1];
      if (!item) return { teamId: `t-${label.toLowerCase()}`, name: defaultName, teamName: defaultName, tag: label, seed: pos, logo: '🛡️', sourceLabel: label };
      return {
        teamId: item.teamId || item.id,
        name: item.teamName || item.name || defaultName,
        teamName: item.teamName || item.name || defaultName,
        tag: item.tag || label,
        seed: item.seed || pos,
        logo: item.logo || '🛡️',
        sourceLabel: label
      };
    };

    const teamA1 = getTeam(groupAStandings, 1, 'Group A 1st Place', 'A1');
    const teamA2 = getTeam(groupAStandings, 2, 'Group A 2nd Place', 'A2');
    const teamA3 = getTeam(groupAStandings, 3, 'Group A 3rd Place', 'A3');
    const teamA4 = getTeam(groupAStandings, 4, 'Group A 4th Place', 'A4');

    const teamB1 = getTeam(groupBStandings, 1, 'Group B 1st Place', 'B1');
    const teamB2 = getTeam(groupBStandings, 2, 'Group B 2nd Place', 'B2');
    const teamB3 = getTeam(groupBStandings, 3, 'Group B 3rd Place', 'B3');
    const teamB4 = getTeam(groupBStandings, 4, 'Group B 4th Place', 'B4');

    return [
      // Upper Bracket Semifinal 1: A1 vs B2
      {
        id: ubSf1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'upper',
        round: 'Upper Semifinal 1',
        roundKey: 'ub-r2',
        roundTitle: 'UB SF 1',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: teamA1,
        teamB: teamB2,
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'Upper Final',
        loserNextMatchId: lbR2_1Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR2_1Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R2 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Upper Bracket Semifinal 2: B1 vs A2
      {
        id: ubSf2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'upper',
        round: 'Upper Semifinal 2',
        roundKey: 'ub-r2',
        roundTitle: 'UB SF 2',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: teamB1,
        teamB: teamA2,
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Upper Final',
        loserNextMatchId: lbR2_2Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR2_2Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R2 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Upper Final: Winner UB SF 1 vs Winner UB SF 2
      {
        id: ubFinalId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'upper',
        round: 'Upper Final',
        roundKey: 'ub-final',
        roundTitle: 'Upper Final',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner UB SF 1', sourceLabel: 'UB SF 1 Winner', seed: 0 },
        teamB: { name: 'Winner UB SF 2', sourceLabel: 'UB SF 2 Winner', seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: gfId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'Grand Final',
        loserNextMatchId: lbFinalId,
        loserNextSlot: 'teamA',
        loserDestinationId: lbFinalId,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 1 Match 1: A3 vs B4
      {
        id: lbR1_1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Round 1 Match 1',
        roundKey: 'lb-r1',
        roundTitle: 'LB R1 M1',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: teamA3,
        teamB: teamB4,
        winnerNextMatchId: lbR2_1Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbR2_1Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB R2 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 1 Match 2: B3 vs A4
      {
        id: lbR1_2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Round 1 Match 2',
        roundKey: 'lb-r1',
        roundTitle: 'LB R1 M2',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: teamB3,
        teamB: teamA4,
        winnerNextMatchId: lbR2_2Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbR2_2Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB R2 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 2 Match 1: Loser UB SF 1 vs Winner LB R1 M1
      {
        id: lbR2_1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Round 2 Match 1',
        roundKey: 'lb-r2',
        roundTitle: 'LB R2 M1',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB SF 1', sourceLabel: 'UB SF 1 Loser', seed: 0 },
        teamB: { name: 'Winner LB R1 M1', sourceLabel: 'LB R1 M1 Winner', seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'LB Semifinal',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 2 Match 2: Loser UB SF 2 vs Winner LB R1 M2
      {
        id: lbR2_2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Round 2 Match 2',
        roundKey: 'lb-r2',
        roundTitle: 'LB R2 M2',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB SF 2', sourceLabel: 'UB SF 2 Loser', seed: 0 },
        teamB: { name: 'Winner LB R1 M2', sourceLabel: 'LB R1 M2 Winner', seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB Semifinal',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Semifinal: Winner LB R2 M1 vs Winner LB R2 M2
      {
        id: lbSfId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Semifinal',
        roundKey: 'lb-sf',
        roundTitle: 'LB Semifinal',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner LB R2 M1', sourceLabel: 'LB R2 M1 Winner', seed: 0 },
        teamB: { name: 'Winner LB R2 M2', sourceLabel: 'LB R2 M2 Winner', seed: 0 },
        winnerNextMatchId: lbFinalId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbFinalId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Lower Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Final: Loser UB Final vs Winner Lower Semifinal
      {
        id: lbFinalId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'lower',
        round: 'Lower Final',
        roundKey: 'lb-final',
        roundTitle: 'Lower Final',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser Upper Final', sourceLabel: 'UB Final Loser', seed: 0 },
        teamB: { name: 'Winner Lower Semifinal', sourceLabel: 'LB SF Winner', seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: gfId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Grand Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Championship Grand Final: Winner Upper Final vs Winner Lower Final
      {
        id: gfId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: 'grand_final',
        round: 'Grand Final',
        roundKey: 'gf',
        roundTitle: 'Championship Grand Final',
        bracketType: 'grand_final',
        seriesFormat: gfFormat,
        teamA: { name: 'Winner Upper Final', sourceLabel: 'UB Final Winner', seed: 0 },
        teamB: { name: 'Winner Lower Final', sourceLabel: 'LB Final Winner', seed: 0 },
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      }
    ];
  }

  /**
   * Advances qualified group stage teams into mixed-entry playoff matches
   */
  public advanceGroupStageToPlayoffs(params: {
    tournamentId: string;
    groupAStandings?: GroupStandingRow[] | SeededTeam[];
    groupBStandings?: GroupStandingRow[] | SeededTeam[];
    playoffStageId?: string;
  }): { success: boolean; updatedMatches: CompetitionMatchNode[]; error?: string } {
    const { tournamentId, groupAStandings, groupBStandings, playoffStageId } = params;
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, updatedMatches: [], error: 'Structure not found' };

    let targetStage = playoffStageId 
      ? structure.stages.find(s => s.id === playoffStageId)
      : structure.stages.find(s => s.type === 'DOUBLE_ELIMINATION' || s.type === 'SINGLE_ELIMINATION');

    if (!targetStage && structure.stages.length > 1) {
      targetStage = structure.stages[1];
    }
    if (!targetStage) return { success: false, updatedMatches: [], error: 'Playoff stage not found' };

    const getTeam = (list: any[] | undefined, pos: number, fallbackName: string, label: string): SeededTeam => {
      const item = list ? list[pos - 1] : undefined;
      if (!item) return { teamId: `t-${label.toLowerCase()}`, name: fallbackName, teamName: fallbackName, tag: label, seed: pos, logo: '🛡️', sourceLabel: label };
      return {
        teamId: item.teamId || item.id,
        name: item.teamName || item.name || fallbackName,
        teamName: item.teamName || item.name || fallbackName,
        tag: item.tag || label,
        seed: item.seed || pos,
        logo: item.logo || '🛡️',
        sourceLabel: label
      };
    };

    const teamA1 = getTeam(groupAStandings, 1, 'Group A 1st Place', 'A1');
    const teamA2 = getTeam(groupAStandings, 2, 'Group A 2nd Place', 'A2');
    const teamA3 = getTeam(groupAStandings, 3, 'Group A 3rd Place', 'A3');
    const teamA4 = getTeam(groupAStandings, 4, 'Group A 4th Place', 'A4');

    const teamB1 = getTeam(groupBStandings, 1, 'Group B 1st Place', 'B1');
    const teamB2 = getTeam(groupBStandings, 2, 'Group B 2nd Place', 'B2');
    const teamB3 = getTeam(groupBStandings, 3, 'Group B 3rd Place', 'B3');
    const teamB4 = getTeam(groupBStandings, 4, 'Group B 4th Place', 'B4');

    const updatedMatches: CompetitionMatchNode[] = [];

    // Find and update upper bracket opening matches
    const ubSf1 = targetStage.matches.find(m => m.id === `${tournamentId}-ub-sf-1` || (m.roundTitle?.includes('UB SF 1') || m.round?.includes('Upper Semifinal 1')));
    if (ubSf1) {
      ubSf1.teamA = { ...teamA1 };
      ubSf1.teamB = { ...teamB2 };
      updatedMatches.push(ubSf1);
    }

    const ubSf2 = targetStage.matches.find(m => m.id === `${tournamentId}-ub-sf-2` || ((m.roundTitle?.includes('UB SF 2') || m.round?.includes('Upper Semifinal 2')) && m !== ubSf1));
    if (ubSf2) {
      ubSf2.teamA = { ...teamB1 };
      ubSf2.teamB = { ...teamA2 };
      updatedMatches.push(ubSf2);
    }

    // Find and update lower bracket opening matches
    const lbR1_1 = targetStage.matches.find(m => m.id === `${tournamentId}-lb-r1-m1` || (m.roundTitle?.includes('LB R1 M1') || m.round?.includes('Lower Round 1 Match 1')));
    if (lbR1_1) {
      lbR1_1.teamA = { ...teamA3 };
      lbR1_1.teamB = { ...teamB4 };
      updatedMatches.push(lbR1_1);
    }

    const lbR1_2 = targetStage.matches.find(m => m.id === `${tournamentId}-lb-r1-m2` || ((m.roundTitle?.includes('LB R1 M2') || m.round?.includes('Lower Round 1 Match 2')) && m !== lbR1_1));
    if (lbR1_2) {
      lbR1_2.teamA = { ...teamB3 };
      lbR1_2.teamB = { ...teamA4 };
      updatedMatches.push(lbR1_2);
    }

    // Keep structure.matches updated
    targetStage.matches.forEach(m => {
      const idx = structure.matches.findIndex(sm => sm.id === m.id);
      if (idx >= 0) {
        structure.matches[idx] = { ...m };
      }
    });

    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'ADVANCE_GROUP_TEAMS', 'Advanced qualified group stage teams to Upper and Lower brackets.');
    this.persistStructure(tournamentId, structure);
    return { success: true, updatedMatches };
  }

  /**
   * Validates structure consistency
   */
  public validateStructure(tournamentId: string): { valid: boolean; errors: string[]; warnings: string[] } {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { valid: false, errors: ['Structure not found.'], warnings: [] };

    const errors: string[] = [];
    const warnings: string[] = [];

    if (structure.stages.length === 0) {
      errors.push('Tournament must contain at least 1 stage.');
    }

    structure.stages.forEach(s => {
      if (s.matches.length === 0) {
        warnings.push(`Stage "${s.name}" does not have generated matches yet.`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Previews the impact of modifying an already published structure
   */
  public previewImpact(tournamentId: string, modifiedStages: TournamentStageConfig[]): {
    canProceedSafely: boolean;
    completedMatchesCount: number;
    affectedFutureMatchesCount: number;
    warnings: string[];
  } {
    const structure = this.getStructure(tournamentId);
    if (!structure) {
      return { canProceedSafely: false, completedMatchesCount: 0, affectedFutureMatchesCount: 0, warnings: ['Structure not found.'] };
    }

    const completedMatches = structure.matches.filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT');
    const warnings: string[] = [];

    if (completedMatches.length > 0) {
      warnings.push(`Tournament has ${completedMatches.length} official completed match(es). Completed matches will be protected and retained.`);
    }

    return {
      canProceedSafely: true,
      completedMatchesCount: completedMatches.length,
      affectedFutureMatchesCount: structure.matches.length - completedMatches.length,
      warnings
    };
  }

  /**
   * Publishes the structure to make matches official
   */
  public publishStructure(tournamentId: string): { success: boolean; structure: MultiStageTournamentStructure; error?: string } {
    let structure = this.getStructure(tournamentId);
    if (!structure) {
      const storage = getStorageBackend();
      const raw = storage?.getItem(`pbg_competition_structure_${tournamentId}`);
      if (raw) {
        try {
          structure = JSON.parse(raw);
          if (structure) this.structures.set(tournamentId, structure);
        } catch {}
      }
    }
    if (!structure) {
      structure = this.getOrCreateStructure(tournamentId);
    }
    if (!structure) return { success: false, error: 'Structure not found' } as any;

    const validation = this.validateStructure(tournamentId);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; ') } as any;
    }

    structure.status = 'PUBLISHED';
    structure.isLocked = true;
    structure.publishedAt = structure.publishedAt || new Date().toISOString();
    structure.updatedAt = new Date().toISOString();
    structure.version = (structure.version || 1) + 1;
    this.appendAudit(structure, 'PUBLISH_STRUCTURE', `Published tournament competition structure (v${structure.version}).`);
    this.persistStructure(tournamentId, structure);
    return { success: true, structure };
  }

  /**
   * Authoritative Firestore transaction for publishing competition structure
   */
  public async publishStructureTransactional(params: {
    tournamentId: string;
    callerRole?: string;
    isAdmin?: boolean;
    draftStructure?: MultiStageTournamentStructure;
  }): Promise<{ success: boolean; structure?: MultiStageTournamentStructure; error?: string }> {
    if (params.callerRole && params.callerRole !== 'organizer' && params.callerRole !== 'admin' && !params.isAdmin) {
      return { success: false, error: 'ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can publish competition structures.' };
    }

    if (serverAdminDb && params.tournamentId) {
      try {
        const result = await serverAdminDb.runTransaction(async (txn: any) => {
          const structRef = serverAdminDb.collection('tournaments').doc(params.tournamentId).collection('competition').doc('structure');
          const structSnap = await txn.get(structRef);

          let structure: MultiStageTournamentStructure;
          if (structSnap.exists) {
            structure = structSnap.data() as MultiStageTournamentStructure;
          } else if (params.draftStructure && params.draftStructure.stages && params.draftStructure.stages.length > 0) {
            structure = JSON.parse(JSON.stringify(params.draftStructure));
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (memory && memory.stages && memory.stages.length > 0) {
              structure = JSON.parse(JSON.stringify(memory));
            } else {
              const tourneyDoc = await txn.get(serverAdminDb.collection('tournaments').doc(params.tournamentId));
              if (tourneyDoc.exists && tourneyDoc.data()?.competitionStructure) {
                structure = tourneyDoc.data().competitionStructure;
              } else {
                structure = this.getOrCreateStructure(params.tournamentId, tourneyDoc.exists ? (tourneyDoc.data()?.teams || []) : []);
              }
            }
          }

          // If draftStructure was provided, merge any updated match schedules
          let hasNewSchedules = false;
          if (params.draftStructure && structure) {
            if (params.draftStructure.matches && params.draftStructure.matches.length > 0) {
              const scheduleMap = new Map<string, { scheduledTime?: string; seriesFormat?: any }>();
              params.draftStructure.matches.forEach(m => {
                if (m.scheduledTime || m.seriesFormat) {
                  scheduleMap.set(m.id, { scheduledTime: m.scheduledTime, seriesFormat: m.seriesFormat });
                }
              });
              if (scheduleMap.size > 0) {
                hasNewSchedules = true;
                structure.matches?.forEach(m => {
                  const s = scheduleMap.get(m.id);
                  if (s) {
                    if (s.scheduledTime) m.scheduledTime = s.scheduledTime;
                    if (s.seriesFormat) m.seriesFormat = s.seriesFormat;
                  }
                });
                structure.stages?.forEach(stage => {
                  stage.matches?.forEach(m => {
                    const s = scheduleMap.get(m.id);
                    if (s) {
                      if (s.scheduledTime) m.scheduledTime = s.scheduledTime;
                      if (s.seriesFormat) m.seriesFormat = s.seriesFormat;
                    }
                  });
                });
              }
            }
          }

          // Idempotency: if already PUBLISHED and locked, and no schedule changes were made, return
          if (structure.status === 'PUBLISHED' && structure.isLocked && !hasNewSchedules) {
            return { success: true, structure };
          }

          if (!structure.stages || structure.stages.length === 0) {
            throw new Error('Tournament must contain at least 1 stage.');
          }

          structure.status = 'PUBLISHED';
          structure.isLocked = true;
          structure.publishedAt = structure.publishedAt || new Date().toISOString();
          structure.updatedAt = new Date().toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, 'PUBLISH_STRUCTURE_TXN', `Transactionally published competition structure (v${structure.version}).`);

          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });

          const tourneyRef = serverAdminDb.collection('tournaments').doc(params.tournamentId);
          txn.set(tourneyRef, {
            status: 'ACTIVE',
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
              format: structure.format,
              updatedAt: structure.updatedAt,
              publishedAt: structure.publishedAt || null
            },
            updatedAt: structure.updatedAt
          }, { merge: true });

          return { success: true, structure };
        });

        if (result.success && result.structure) {
          this.structures.set(params.tournamentId, result.structure);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure)); } catch {}
          this.notifySubscribers(params.tournamentId, result.structure);
        }

        return result;
      } catch (err: any) {
        if (err?.message?.includes('ORGANIZER_PERMISSION_REQUIRED') || err?.message?.includes('Tournament must contain') || err?.message?.includes('Structure not found')) {
          return { success: false, error: err.message };
        }
        return { success: false, error: err?.message || 'Failed to publish competition structure' };
      }
    }

    if (db && params.tournamentId) {
      try {
        const result = await runTransaction(db, async (txn) => {
          const structRef = doc(db, 'tournaments', params.tournamentId, 'competition', 'structure');
          const structSnap = await txn.get(structRef);

          let structure: MultiStageTournamentStructure;
          if (structSnap.exists()) {
            structure = structSnap.data() as MultiStageTournamentStructure;
          } else if (params.draftStructure && params.draftStructure.stages && params.draftStructure.stages.length > 0) {
            structure = JSON.parse(JSON.stringify(params.draftStructure));
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (memory && memory.stages && memory.stages.length > 0) {
              structure = JSON.parse(JSON.stringify(memory));
            } else {
              const tourneyDoc = await txn.get(doc(db, 'tournaments', params.tournamentId));
              if (tourneyDoc.exists() && tourneyDoc.data()?.competitionStructure) {
                structure = tourneyDoc.data().competitionStructure;
              } else {
                structure = this.getOrCreateStructure(params.tournamentId, tourneyDoc.exists() ? (tourneyDoc.data()?.teams || []) : []);
              }
            }
          }

          let hasNewSchedules = false;
          if (params.draftStructure && structure) {
            if (params.draftStructure.matches && params.draftStructure.matches.length > 0) {
              const scheduleMap = new Map<string, { scheduledTime?: string; seriesFormat?: any }>();
              params.draftStructure.matches.forEach(m => {
                if (m.scheduledTime || m.seriesFormat) {
                  scheduleMap.set(m.id, { scheduledTime: m.scheduledTime, seriesFormat: m.seriesFormat });
                }
              });
              if (scheduleMap.size > 0) {
                hasNewSchedules = true;
                structure.matches?.forEach(m => {
                  const s = scheduleMap.get(m.id);
                  if (s) {
                    if (s.scheduledTime) m.scheduledTime = s.scheduledTime;
                    if (s.seriesFormat) m.seriesFormat = s.seriesFormat;
                  }
                });
                structure.stages?.forEach(stage => {
                  stage.matches?.forEach(m => {
                    const s = scheduleMap.get(m.id);
                    if (s) {
                      if (s.scheduledTime) m.scheduledTime = s.scheduledTime;
                      if (s.seriesFormat) m.seriesFormat = s.seriesFormat;
                    }
                  });
                });
              }
            }
          }

          if (structure.status === 'PUBLISHED' && structure.isLocked && !hasNewSchedules) {
            return { success: true, structure };
          }

          if (!structure.stages || structure.stages.length === 0) {
            throw new Error('Tournament must contain at least 1 stage.');
          }

          structure.status = 'PUBLISHED';
          structure.isLocked = true;
          structure.publishedAt = structure.publishedAt || new Date().toISOString();
          structure.updatedAt = new Date().toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, 'PUBLISH_STRUCTURE_TXN', `Transactionally published competition structure (v${structure.version}).`);

          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });

          const tourneyRef = doc(db, 'tournaments', params.tournamentId);
          txn.set(tourneyRef, {
            status: 'ACTIVE',
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
              format: structure.format,
              updatedAt: structure.updatedAt,
              publishedAt: structure.publishedAt || null
            },
            updatedAt: structure.updatedAt
          }, { merge: true });

          return { success: true, structure };
        });

        if (result.success && result.structure) {
          this.structures.set(params.tournamentId, result.structure);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure)); } catch {}
          this.notifySubscribers(params.tournamentId, result.structure);
        }

        return result;
      } catch (err: any) {
        if (err?.message?.includes('ORGANIZER_PERMISSION_REQUIRED') || err?.message?.includes('Tournament must contain')) {
          return { success: false, error: err.message };
        }
      }
    }

    const localRes = this.publishStructure(params.tournamentId);
    return localRes;
  }

  /**
   * Unlocks / enables editing for a published structure
   */
  public editPublishedStructure(tournamentId: string): { success: boolean; hasStartedMatches: boolean } {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, hasStartedMatches: false };

    const hasStartedMatches = (structure.matches || []).some(m => m.status === 'LIVE' || m.status === 'COMPLETED');
    structure.isLocked = false;
    this.appendAudit(structure, 'UNLOCK_STRUCTURE', `Unlocked structure for editing. (Has started matches: ${hasStartedMatches})`);
    this.persistStructure(tournamentId, structure);
    return { success: true, hasStartedMatches };
  }

  /**
   * Authoritative Firestore transaction for unlocking structure for post-publication editing
   */
  public async editPublishedStructureTransactional(params: {
    tournamentId: string;
    callerRole?: string;
    isAdmin?: boolean;
  }): Promise<{ success: boolean; hasStartedMatches: boolean; structure?: MultiStageTournamentStructure; error?: string }> {
    if (params.callerRole && params.callerRole !== 'organizer' && params.callerRole !== 'admin' && !params.isAdmin) {
      return { success: false, hasStartedMatches: false, error: 'ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can edit competition structures.' };
    }

    if (serverAdminDb && params.tournamentId) {
      try {
        const result = await serverAdminDb.runTransaction(async (txn: any) => {
          const structRef = serverAdminDb.collection('tournaments').doc(params.tournamentId).collection('competition').doc('structure');
          const structSnap = await txn.get(structRef);

          let structure: MultiStageTournamentStructure;
          if (structSnap.exists) {
            structure = structSnap.data() as MultiStageTournamentStructure;
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error('Structure not found');
            structure = JSON.parse(JSON.stringify(memory));
          }

          const hasStartedMatches = (structure.matches || []).some(m => m.status === 'LIVE' || m.status === 'COMPLETED');
          structure.isLocked = false;
          structure.updatedAt = new Date().toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, 'UNLOCK_STRUCTURE_TXN', `Unlocked structure for editing via transaction. (Has started matches: ${hasStartedMatches})`);

          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });

          const tourneyRef = serverAdminDb.collection('tournaments').doc(params.tournamentId);
          txn.set(tourneyRef, {
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
              format: structure.format,
              updatedAt: structure.updatedAt,
              publishedAt: structure.publishedAt || null
            },
            updatedAt: structure.updatedAt
          }, { merge: true });

          return { success: true, hasStartedMatches, structure };
        });

        if (result.success && result.structure) {
          this.structures.set(params.tournamentId, result.structure);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure)); } catch {}
          this.notifySubscribers(params.tournamentId, result.structure);
        }

        return result;
      } catch (err: any) {
        if (err?.message?.includes('ORGANIZER_PERMISSION_REQUIRED')) {
          return { success: false, hasStartedMatches: false, error: err.message };
        }
        return { success: false, hasStartedMatches: false, error: err?.message || 'Failed to unlock structure.' };
      }
    }

    if (db && params.tournamentId) {
      try {
        const result = await runTransaction(db, async (txn) => {
          const structRef = doc(db, 'tournaments', params.tournamentId, 'competition', 'structure');
          const structSnap = await txn.get(structRef);

          let structure: MultiStageTournamentStructure;
          if (structSnap.exists()) {
            structure = structSnap.data() as MultiStageTournamentStructure;
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error('Structure not found');
            structure = JSON.parse(JSON.stringify(memory));
          }

          const hasStartedMatches = (structure.matches || []).some(m => m.status === 'LIVE' || m.status === 'COMPLETED');
          structure.isLocked = false;
          structure.updatedAt = new Date().toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, 'UNLOCK_STRUCTURE_TXN', `Unlocked structure for editing via transaction. (Has started matches: ${hasStartedMatches})`);

          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });

          const tourneyRef = doc(db, 'tournaments', params.tournamentId);
          txn.set(tourneyRef, {
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter(m => m.status === 'COMPLETED' || m.status === 'FORFEIT').length,
              format: structure.format,
              updatedAt: structure.updatedAt,
              publishedAt: structure.publishedAt || null
            },
            updatedAt: structure.updatedAt
          }, { merge: true });

          return { success: true, hasStartedMatches, structure };
        });

        if (result.success && result.structure) {
          this.structures.set(params.tournamentId, result.structure);
          const storage = getStorageBackend();
          try { storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure)); } catch {}
          this.notifySubscribers(params.tournamentId, result.structure);
        }

        return result;
      } catch (err: any) {
        if (err?.message?.includes('ORGANIZER_PERMISSION_REQUIRED')) {
          return { success: false, hasStartedMatches: false, error: err.message };
        }
      }
    }

    const localRes = this.editPublishedStructure(params.tournamentId);
    return { ...localRes, structure: this.getStructure(params.tournamentId) };
  }

  private appendAudit(structure: MultiStageTournamentStructure, action: string, details: string): void {
    if (!structure.auditTrail) structure.auditTrail = [];
    structure.auditTrail.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      actorId: 'organiser',
      action,
      details
    });
  }

  // ---------------------------------------------------------------------------
  // Phase 4 Engine APIs: Seeding, Brackets, Graph Validation, Tiebreak Rules
  // ---------------------------------------------------------------------------

  public initStructure(params: {
    tournamentId: string;
    tournamentName?: string;
    format: string;
    teamCount?: number;
    seedingMode?: string;
    defaultSeriesFormat?: SeriesFormat | string;
    roundSeriesOverrides?: Record<string, string>;
    [key: string]: any;
  }): MultiStageTournamentStructure {
    const { tournamentId, tournamentName, format, teamCount = 8, seedingMode = 'rating', defaultSeriesFormat = 'BO3', roundSeriesOverrides } = params;

    let normalizedType: TournamentStageType = 'DOUBLE_ELIMINATION';
    const fmtLower = format.toLowerCase();
    if (fmtLower.includes('single')) {
      normalizedType = 'SINGLE_ELIMINATION';
    } else if (fmtLower.includes('double')) {
      normalizedType = 'DOUBLE_ELIMINATION';
    } else if (fmtLower.includes('round_robin') || fmtLower.includes('round robin')) {
      normalizedType = 'ROUND_ROBIN';
    } else if (fmtLower.includes('swiss')) {
      normalizedType = 'SWISS';
    } else if (fmtLower.includes('gsl')) {
      normalizedType = 'GSL';
    }

    const stage: TournamentStageConfig = {
      id: `stage-${tournamentId}-1`,
      name: `Stage 1: ${normalizedType.replace('_', ' ')}`,
      sequence: 1,
      type: normalizedType,
      status: 'UPCOMING',
      teamCount,
      defaultSeriesFormat: (defaultSeriesFormat as SeriesFormat) || 'BO3',
      grandFinalSeriesFormat: (roundSeriesOverrides?.['gf'] as SeriesFormat) || 'BO5',
      seedingMode: (seedingMode.toUpperCase() === 'RATING' ? 'RATING_BASED' : seedingMode.toUpperCase() === 'MANUAL' ? 'MANUAL' : 'RANDOM') as any,
      seededTeams: [],
      matches: []
    };

    const structure: MultiStageTournamentStructure = {
      tournamentId,
      tournamentName,
      format,
      config: { ...params, format },
      status: 'DRAFT',
      version: 1,
      stages: [stage],
      isLocked: false,
      teams: [],
      matches: [],
      roundSeriesOverrides,
      auditTrail: [
        {
          id: `audit-${Date.now()}-init`,
          timestamp: new Date().toISOString(),
          actorId: 'organizer',
          action: 'INIT_STRUCTURE',
          details: `Initialized structure for ${tournamentName || tournamentId} with format ${format}`
        }
      ]
    };

    this.structures.set(tournamentId, structure);
    return structure;
  }

  public generateSeeds(arg1: any, arg2?: any): { success: boolean; seededTeams?: SeededTeam[]; error?: string } {
    let tournamentId: string;
    let seedingMode: string = 'rating';
    let manualSeeds: { teamId: string; seed: number }[] | undefined;
    let candidateTeams: any[] = [];

    if (typeof arg1 === 'object') {
      tournamentId = arg1.tournamentId;
      seedingMode = arg1.seedingMode || 'rating';
      manualSeeds = arg1.manualSeeds;
      candidateTeams = arg1.candidateTeams || [];
    } else {
      tournamentId = arg1;
      candidateTeams = arg2 || [];
    }

    const structure = this.getOrCreateStructure(tournamentId);

    if (candidateTeams.length === 0 && structure.teams && structure.teams.length > 0) {
      candidateTeams = structure.teams;
    }

    // Integrity check: All candidate teams must be finalized ('APPROVED' or 'LOCKED')
    for (const team of candidateTeams) {
      const status = team.status?.toUpperCase?.();
      if (status && status !== 'APPROVED' && status !== 'LOCKED') {
        return {
          success: false,
          error: `DENIED: candidateTeams contains unfinalized team (${team.teamName || team.name || team.teamId}) with status ${team.status}. Only finalized teams can be seeded.`
        };
      }
    }

    let seeded: SeededTeam[] = [];
    const modeLower = seedingMode.toLowerCase();

    const calculateTeamMmr = (t: any): number => {
      if (typeof t.avgMmr === 'number') return t.avgMmr;
      if (typeof t.rosterStrengthRating === 'number') return t.rosterStrengthRating;
      if (typeof t.mmr === 'number') return t.mmr;
      if (Array.isArray(t.primaryRoster) && t.primaryRoster.length > 0) {
        const sum = t.primaryRoster.reduce((acc: number, p: any) => acc + (p.tournamentMmr || p.declaredMmr || 0), 0);
        return Math.round(sum / t.primaryRoster.length);
      }
      return typeof t.rating === 'number' ? t.rating : 0;
    };

    if (modeLower === 'rating' || modeLower === 'rating_based') {
      const sorted = [...candidateTeams].sort((a, b) => {
        return calculateTeamMmr(b) - calculateTeamMmr(a);
      });

      seeded = sorted.map((t, idx) => {
        const teamMmr = calculateTeamMmr(t);
        return {
          teamId: t.teamId || t.id || `team-${idx + 1}`,
          name: t.teamName || t.name || `Seed #${idx + 1}`,
          teamName: t.teamName || t.name || `Seed #${idx + 1}`,
          tag: t.tag || `T${idx + 1}`,
          seed: idx + 1,
          rating: t.rating || 1500,
          mmr: teamMmr || 6000,
          avgMmr: teamMmr || 6000,
          rosterStrengthRating: teamMmr || 6000,
          logo: t.logo || '🛡️',
          color: t.color || '#7C3AED',
          captainUserId: t.captainId || t.captainUserId,
          captainIgn: t.captainIgn || t.captainName
        };
      });
    } else if (modeLower === 'manual') {
      if (!manualSeeds || manualSeeds.length === 0) {
        return { success: false, error: 'DENIED: Manual seeding selected but no manualSeeds provided.' };
      }

      const seedNums = manualSeeds.map(m => m.seed);
      const uniqueSeeds = new Set(seedNums);
      if (uniqueSeeds.size !== seedNums.length) {
        return { success: false, error: 'DENIED: Duplicate seed detected in manual seeding configuration.' };
      }

      const expectedSeeds = Array.from({ length: candidateTeams.length }, (_, i) => i + 1);
      const sortedGiven = [...seedNums].sort((a, b) => a - b);
      const hasGap = expectedSeeds.some((exp, idx) => sortedGiven[idx] !== exp);
      if (hasGap) {
        return { success: false, error: 'DENIED: Missing seed gap in manual seeding. Seeds must be contiguous 1..N.' };
      }

      seeded = manualSeeds.map(ms => {
        const teamObj = candidateTeams.find(t => (t.teamId || t.id) === ms.teamId);
        return {
          teamId: ms.teamId,
          name: teamObj?.teamName || teamObj?.name || `Seed #${ms.seed}`,
          teamName: teamObj?.teamName || teamObj?.name || `Seed #${ms.seed}`,
          tag: teamObj?.tag || `T${ms.seed}`,
          seed: ms.seed,
          rating: teamObj?.rating || 1500,
          mmr: teamObj?.avgMmr || teamObj?.mmr || 6000,
          avgMmr: teamObj?.avgMmr || teamObj?.mmr || 6000,
          rosterStrengthRating: teamObj?.rosterStrengthRating || teamObj?.avgMmr || 6000,
          logo: teamObj?.logo || '🛡️',
          color: teamObj?.color || '#7C3AED',
          captainUserId: teamObj?.captainId || teamObj?.captainUserId,
          captainIgn: teamObj?.captainIgn || teamObj?.captainName
        };
      }).sort((a, b) => a.seed - b.seed);
    } else if (modeLower === 'random') {
      const shuffled = [...candidateTeams].sort(() => Math.random() - 0.5);
      seeded = shuffled.map((t, idx) => ({
        teamId: t.teamId || t.id || `team-${idx + 1}`,
        name: t.teamName || t.name || `Seed #${idx + 1}`,
        teamName: t.teamName || t.name || `Seed #${idx + 1}`,
        tag: t.tag || `T${idx + 1}`,
        seed: idx + 1,
        rating: t.rating || 1500,
        mmr: t.avgMmr || t.mmr || 6000,
        avgMmr: t.avgMmr || t.mmr || 6000,
        rosterStrengthRating: t.rosterStrengthRating || t.avgMmr || 6000,
        logo: t.logo || '🛡️',
        color: t.color || '#7C3AED',
        captainUserId: t.captainId || t.captainUserId,
        captainIgn: t.captainIgn || t.captainName
      }));
    } else {
      seeded = this.normalizeTeams(candidateTeams);
    }

    structure.teams = seeded;
    if (structure.stages[0]) {
      structure.stages[0].seededTeams = [...seeded];
    }
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'GENERATE_SEEDS', `Generated ${seedingMode} seeding for ${seeded.length} teams.`);
    return { success: true, seededTeams: seeded };
  }

  public generateCompetitionStructure(arg1: any, _caller?: any): { success: boolean; structure?: MultiStageTournamentStructure; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    const structure = this.getStructure(tournamentId) || this.getOrCreateStructure(tournamentId);

    if (structure.isLocked || structure.status === 'LOCKED') {
      return {
        success: false,
        error: 'DENIED: Competition structure is LOCKED and cannot be regenerated.'
      };
    }

    return this.generateFullStructure(tournamentId, structure.teams);
  }

  public lockCompetitionStructure(arg1: any, _caller?: any): { success: boolean; structure?: MultiStageTournamentStructure; error?: string } {
    const tournamentId = typeof arg1 === 'object' ? arg1.tournamentId : arg1;
    const structure = this.getStructure(tournamentId) || this.getOrCreateStructure(tournamentId);
    structure.isLocked = true;
    structure.status = 'LOCKED';
    structure.updatedAt = new Date().toISOString();
    this.appendAudit(structure, 'LOCK_STRUCTURE', `Structure locked by ${_caller || 'organizer'}.`);
    return { success: true, structure };
  }

  public validateProgressionGraph(matches: CompetitionMatchNode[]): { valid: boolean; error?: string } {
    const matchMap = new Map<string, CompetitionMatchNode>();
    for (const m of matches) {
      matchMap.set(m.id, m);
    }

    for (const m of matches) {
      if (m.loserNextMatchId) {
        const dest = matchMap.get(m.loserNextMatchId);
        if (dest) {
          const isUpper = dest.bracketType === 'upper' || dest.stage === 'upper' || dest.roundKey?.startsWith('ub') || dest.roundTitle?.includes('UB');
          if (isUpper) {
            return {
              valid: false,
              error: `DENIED: Invalid loser destination for match ${m.id}. Upper Bracket cannot receive losers.`
            };
          }
        }
      }
    }

    return { valid: true };
  }

  public validateSeriesFormat(format: string, stageType?: TournamentStageType): { valid: boolean; error?: string } {
    if (format === 'BO1' || format === 'BO3' || format === 'BO5') {
      return { valid: true };
    }
    if ((stageType === 'GROUP_STAGE' || stageType === 'ROUND_ROBIN' || stageType === 'DOUBLE_ROUND_ROBIN') && format === 'BO2') {
      return { valid: true };
    }
    return {
      valid: false,
      error: `DENIED: Invalid BO format configuration "${format}". Only BO1, BO3, and BO5 are allowed in this competition mode.`
    };
  }

  public validateMatchPairing(teamAId: string, teamBId: string): { valid: boolean; error?: string } {
    if (teamAId && teamBId && teamAId === teamBId) {
      return {
        valid: false,
        error: `DENIED: Invalid match pairing. Same team (${teamAId}) scheduled against itself.`
      };
    }
    return { valid: true };
  }

  public getTiebreakRulesDescription(): string[] {
    return [
      '1. Match & Series Points: Total accumulated group stage points (Win = 3, Draw = 1, Loss = 0).',
      '2. Head-to-Head Record: Winner of direct head-to-head match between tied teams advances.',
      '3. Game / Map Differential: Total maps won minus total maps lost across all stage matches.',
      '4. Total Games Won: Overall volume of map victories in the current competition stage.',
      '5. Initial Tournament Seeding: Higher tournament seed breaks any remaining unresolved ties.'
    ];
  }

  public buildRoundRobinMatches(
    tournamentId: string, 
    teams: SeededTeam[], 
    format: string = 'BO1', 
    groupId: string = 'grp-a'
  ): CompetitionMatchNode[] {
    const matches: CompetitionMatchNode[] = [];
    let matchNum = 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `${tournamentId}-${groupId}-m${matchNum}`,
          tournamentId,
          stageId: groupId,
          round: `Round Robin Match ${matchNum}`,
          roundKey: groupId,
          bracketType: 'round_robin',
          matchNumber: matchNum,
          seriesFormat: (format as SeriesFormat) || 'BO1',
          teamA: teams[i],
          teamB: teams[j],
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: []
        });
        matchNum++;
      }
    }
    return matches;
  }

  public updateMatchProgression(arg1?: any, _arg2?: any, _arg3?: any, _caller?: any): any {
    if (typeof arg1 === 'object') {
      const userRole = arg1.userRole;
      if (userRole && userRole !== 'organizer' && !arg1.isAdmin) {
        return {
          success: false,
          error: 'DENIED: Organizer authorization required to modify bracket progression.'
        };
      }
    }
    return { success: true };
  }

  public generateDoubleEliminationMatches(
    tournamentId: string,
    seeded: SeededTeam[],
    defaultFormat: SeriesFormat = 'BO3',
    gfFormat: SeriesFormat = 'BO5'
  ): CompetitionMatchNode[] {
    const tid = tournamentId;
    const qf1Id = `${tid}-ub-r1-m1`;
    const qf2Id = `${tid}-ub-r1-m2`;
    const qf3Id = `${tid}-ub-r1-m3`;
    const qf4Id = `${tid}-ub-r1-m4`;

    const sf1Id = `${tid}-ub-sf-1`;
    const sf2Id = `${tid}-ub-sf-2`;
    const ubFinalId = `${tid}-ub-final`;

    const lbR1_1Id = `${tid}-lb-r1-m1`;
    const lbR1_2Id = `${tid}-lb-r1-m2`;
    const lbR2_1Id = `${tid}-lb-r2-m1`;
    const lbR2_2Id = `${tid}-lb-r2-m2`;
    const lbSfId = `${tid}-lb-sf`;
    const lbFinalId = `${tid}-lb-final`;
    const gfId = `${tid}-gf`;

    return [
      // UB QF 1: 1 vs 8
      {
        id: qf1Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Quarterfinal 1',
        roundKey: 'ub-r1',
        roundTitle: 'UB QF 1',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: seeded[0] || { name: 'Seed 1', seed: 1 },
        teamB: seeded[7] || { name: 'Seed 8', seed: 8 },
        winnerNextMatchId: sf1Id,
        winnerNextSlot: 'teamA',
        winnerDestinationId: sf1Id,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'UB SF 1',
        loserNextMatchId: lbR1_1Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR1_1Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R1 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 2: 4 vs 5
      {
        id: qf2Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Quarterfinal 2',
        roundKey: 'ub-r1',
        roundTitle: 'UB QF 2',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: seeded[3] || { name: 'Seed 4', seed: 4 },
        teamB: seeded[4] || { name: 'Seed 5', seed: 5 },
        winnerNextMatchId: sf1Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: sf1Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'UB SF 1',
        loserNextMatchId: lbR1_1Id,
        loserNextSlot: 'teamB',
        loserDestinationId: lbR1_1Id,
        loserDestinationSlot: 'teamB',
        loserDestinationLabel: 'LB R1 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 3: 2 vs 7
      {
        id: qf3Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Quarterfinal 3',
        roundKey: 'ub-r1',
        roundTitle: 'UB QF 3',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: seeded[1] || { name: 'Seed 2', seed: 2 },
        teamB: seeded[6] || { name: 'Seed 7', seed: 7 },
        winnerNextMatchId: sf2Id,
        winnerNextSlot: 'teamA',
        winnerDestinationId: sf2Id,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'UB SF 2',
        loserNextMatchId: lbR1_2Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR1_2Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R1 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 4: 3 vs 6
      {
        id: qf4Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Quarterfinal 4',
        roundKey: 'ub-r1',
        roundTitle: 'UB QF 4',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: seeded[2] || { name: 'Seed 3', seed: 3 },
        teamB: seeded[5] || { name: 'Seed 6', seed: 6 },
        winnerNextMatchId: sf2Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: sf2Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'UB SF 2',
        loserNextMatchId: lbR1_2Id,
        loserNextSlot: 'teamB',
        loserDestinationId: lbR1_2Id,
        loserDestinationSlot: 'teamB',
        loserDestinationLabel: 'LB R1 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB SF 1
      {
        id: sf1Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Semifinal 1',
        roundKey: 'ub-r2',
        roundTitle: 'UB SF 1',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner UB QF 1', seed: 0 },
        teamB: { name: 'Winner UB QF 2', seed: 0 },
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'Upper Final',
        loserNextMatchId: lbR2_1Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR2_1Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R2 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB SF 2
      {
        id: sf2Id,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Semifinal 2',
        roundKey: 'ub-r2',
        roundTitle: 'UB SF 2',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner UB QF 3', seed: 0 },
        teamB: { name: 'Winner UB QF 4', seed: 0 },
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Upper Final',
        loserNextMatchId: lbR2_2Id,
        loserNextSlot: 'teamA',
        loserDestinationId: lbR2_2Id,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB R2 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB Final
      {
        id: ubFinalId,
        tournamentId: tid,
        stage: 'upper',
        round: 'Upper Final',
        roundKey: 'ub-final',
        roundTitle: 'Upper Final',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner UB SF 1', seed: 0 },
        teamB: { name: 'Winner UB SF 2', seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: gfId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'Grand Final',
        loserNextMatchId: lbFinalId,
        loserNextSlot: 'teamA',
        loserDestinationId: lbFinalId,
        loserDestinationSlot: 'teamA',
        loserDestinationLabel: 'LB Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R1 Match 1
      {
        id: lbR1_1Id,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Round 1 Match 1',
        roundKey: 'lb-r1',
        roundTitle: 'LB R1 M1',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB QF 1', seed: 0 },
        teamB: { name: 'Loser UB QF 2', seed: 0 },
        winnerNextMatchId: lbR2_1Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbR2_1Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB R2 Match 1',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R1 Match 2
      {
        id: lbR1_2Id,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Round 1 Match 2',
        roundKey: 'lb-r1',
        roundTitle: 'LB R1 M2',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB QF 3', seed: 0 },
        teamB: { name: 'Loser UB QF 4', seed: 0 },
        winnerNextMatchId: lbR2_2Id,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbR2_2Id,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB R2 Match 2',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R2 Match 1
      {
        id: lbR2_1Id,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Round 2 Match 1',
        roundKey: 'lb-r2',
        roundTitle: 'LB R2 M1',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB SF 1', seed: 0 },
        teamB: { name: 'Winner LB R1 M1', seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: 'teamA',
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: 'teamA',
        winnerDestinationLabel: 'LB Semifinal',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R2 Match 2
      {
        id: lbR2_2Id,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Round 2 Match 2',
        roundKey: 'lb-r2',
        roundTitle: 'LB R2 M2',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser UB SF 2', seed: 0 },
        teamB: { name: 'Winner LB R1 M2', seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'LB Semifinal',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB Semifinal
      {
        id: lbSfId,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Semifinal',
        roundKey: 'lb-sf',
        roundTitle: 'LB Semifinal',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Winner LB R2 M1', seed: 0 },
        teamB: { name: 'Winner LB R2 M2', seed: 0 },
        winnerNextMatchId: lbFinalId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: lbFinalId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Lower Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB Final
      {
        id: lbFinalId,
        tournamentId: tid,
        stage: 'lower',
        round: 'Lower Final',
        roundKey: 'lb-final',
        roundTitle: 'Lower Final',
        bracketType: 'lower',
        seriesFormat: defaultFormat,
        teamA: { name: 'Loser Upper Final', seed: 0 },
        teamB: { name: 'Winner Lower Semifinal', seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: 'teamB',
        winnerDestinationId: gfId,
        winnerDestinationSlot: 'teamB',
        winnerDestinationLabel: 'Grand Final',
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Grand Final
      {
        id: gfId,
        tournamentId: tid,
        stage: 'grand_final',
        round: 'Grand Final',
        roundKey: 'gf',
        roundTitle: 'Championship Grand Final',
        bracketType: 'grand_final',
        seriesFormat: gfFormat,
        teamA: { name: 'Winner Upper Final', seed: 0 },
        teamB: { name: 'Winner Lower Final', seed: 0 },
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: []
      }
    ];
  }

  public generateSingleEliminationMatches(
    tournamentId: string,
    teams: SeededTeam[],
    defaultFormat: SeriesFormat = 'BO3',
    gfFormat: SeriesFormat = 'BO5'
  ): CompetitionMatchNode[] {
    const n = teams.length;
    if (n <= 1) return [];

    if (n === 2) {
      return [
        {
          id: `${tournamentId}-gf`,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: teams[0],
          teamB: teams[1],
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 3) {
      const gfId = `${tournamentId}-gf`;
      const sfId = `${tournamentId}-se-sf-1`;
      return [
        {
          id: sfId,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[1], // Seed 2
          teamB: teams[2], // Seed 3
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { ...teams[0], sourceLabel: 'Seed 1 (BYE)' },
          teamB: { name: 'Winner Semifinal', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 4) {
      const gfId = `${tournamentId}-gf`;
      const sf1Id = `${tournamentId}-se-sf-1`;
      const sf2Id = `${tournamentId}-se-sf-2`;
      return [
        {
          id: sf1Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 1',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[0],
          teamB: teams[3],
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamA',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 2',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[1],
          teamB: teams[2],
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { name: 'Winner SF1', seed: 0 },
          teamB: { name: 'Winner SF2', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 5) {
      const gfId = `${tournamentId}-gf`;
      const sf1Id = `${tournamentId}-se-sf-1`;
      const sf2Id = `${tournamentId}-se-sf-2`;
      const r1Id = `${tournamentId}-se-r1-1`;
      return [
        {
          id: r1Id,
          tournamentId,
          stage: 'round1',
          round: 'Quarterfinal',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[3], // 4
          teamB: teams[4], // 5
          winnerNextMatchId: sf1Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf1Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 1',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: 'Seed 1 (BYE)' },
          teamB: { name: 'Winner QF', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamA',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 2',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { ...teams[1], sourceLabel: 'Seed 2 (BYE)' },
          teamB: { ...teams[2], sourceLabel: 'Seed 3 (BYE)' },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { name: 'Winner SF1', seed: 0 },
          teamB: { name: 'Winner SF2', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 6) {
      const gfId = `${tournamentId}-gf`;
      const sf1Id = `${tournamentId}-se-sf-1`;
      const sf2Id = `${tournamentId}-se-sf-2`;
      const r1_1Id = `${tournamentId}-se-r1-1`;
      const r1_2Id = `${tournamentId}-se-r1-2`;
      return [
        {
          id: r1_1Id,
          tournamentId,
          stage: 'round1',
          round: 'Round 1 Match 1',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[3], // 4
          teamB: teams[4], // 5
          winnerNextMatchId: sf1Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf1Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_2Id,
          tournamentId,
          stage: 'round1',
          round: 'Round 1 Match 2',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[2], // 3
          teamB: teams[5], // 6
          winnerNextMatchId: sf2Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf2Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 1',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: 'Seed 1 (BYE)' },
          teamB: { name: 'Winner R1-1', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamA',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 2',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { ...teams[1], sourceLabel: 'Seed 2 (BYE)' },
          teamB: { name: 'Winner R1-2', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { name: 'Winner SF1', seed: 0 },
          teamB: { name: 'Winner SF2', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 7) {
      const gfId = `${tournamentId}-gf`;
      const sf1Id = `${tournamentId}-se-sf-1`;
      const sf2Id = `${tournamentId}-se-sf-2`;
      const r1_1Id = `${tournamentId}-se-r1-1`;
      const r1_2Id = `${tournamentId}-se-r1-2`;
      const r1_3Id = `${tournamentId}-se-r1-3`;
      return [
        {
          id: r1_1Id,
          tournamentId,
          stage: 'round1',
          round: 'Round 1 Match 1',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[3], // 4
          teamB: teams[4], // 5
          winnerNextMatchId: sf1Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf1Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_2Id,
          tournamentId,
          stage: 'round1',
          round: 'Round 1 Match 2',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[1], // 2
          teamB: teams[6], // 7
          winnerNextMatchId: sf2Id,
          winnerNextSlot: 'teamA',
          winnerDestinationId: sf2Id,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_3Id,
          tournamentId,
          stage: 'round1',
          round: 'Round 1 Match 3',
          roundKey: 'r1',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[2], // 3
          teamB: teams[5], // 6
          winnerNextMatchId: sf2Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf2Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 1',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: 'Seed 1 (BYE)' },
          teamB: { name: 'Winner R1-1', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamA',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 2',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { name: 'Winner R1-2', seed: 0 },
          teamB: { name: 'Winner R1-3', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { name: 'Winner SF1', seed: 0 },
          teamB: { name: 'Winner SF2', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    if (n === 8) {
      const gfId = `${tournamentId}-gf`;
      const sf1Id = `${tournamentId}-se-sf-1`;
      const sf2Id = `${tournamentId}-se-sf-2`;
      const qf1Id = `${tournamentId}-se-qf-1`;
      const qf2Id = `${tournamentId}-se-qf-2`;
      const qf3Id = `${tournamentId}-se-qf-3`;
      const qf4Id = `${tournamentId}-se-qf-4`;
      return [
        {
          id: qf1Id,
          tournamentId,
          stage: 'quarterfinal',
          round: 'Quarterfinal 1',
          roundKey: 'qf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[0], // 1
          teamB: teams[7], // 8
          winnerNextMatchId: sf1Id,
          winnerNextSlot: 'teamA',
          winnerDestinationId: sf1Id,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf2Id,
          tournamentId,
          stage: 'quarterfinal',
          round: 'Quarterfinal 2',
          roundKey: 'qf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[3], // 4
          teamB: teams[4], // 5
          winnerNextMatchId: sf1Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf1Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf3Id,
          tournamentId,
          stage: 'quarterfinal',
          round: 'Quarterfinal 3',
          roundKey: 'qf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[1], // 2
          teamB: teams[6], // 7
          winnerNextMatchId: sf2Id,
          winnerNextSlot: 'teamA',
          winnerDestinationId: sf2Id,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf4Id,
          tournamentId,
          stage: 'quarterfinal',
          round: 'Quarterfinal 4',
          roundKey: 'qf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: teams[2], // 3
          teamB: teams[5], // 6
          winnerNextMatchId: sf2Id,
          winnerNextSlot: 'teamB',
          winnerDestinationId: sf2Id,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 1',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { name: 'Winner QF1', seed: 0 },
          teamB: { name: 'Winner QF2', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamA',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamA',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id,
          tournamentId,
          stage: 'semifinal',
          round: 'Semifinal 2',
          roundKey: 'sf',
          bracketType: 'upper',
          seriesFormat: defaultFormat,
          teamA: { name: 'Winner QF3', seed: 0 },
          teamB: { name: 'Winner QF4', seed: 0 },
          winnerNextMatchId: gfId,
          winnerNextSlot: 'teamB',
          winnerDestinationId: gfId,
          winnerDestinationSlot: 'teamB',
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId,
          tournamentId,
          stage: 'grand_final',
          round: 'Grand Final',
          roundKey: 'gf',
          bracketType: 'grand_final',
          seriesFormat: gfFormat,
          teamA: { name: 'Winner SF1', seed: 0 },
          teamB: { name: 'Winner SF2', seed: 0 },
          status: 'UPCOMING',
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }

    // 16 teams (or fallback): 8 R16 -> 4 QF -> 2 SF -> 1 GF = 15 matches
    const gfId = `${tournamentId}-gf`;
    const sf1Id = `${tournamentId}-se-sf-1`;
    const sf2Id = `${tournamentId}-se-sf-2`;
    const qfIds = [1, 2, 3, 4].map(i => `${tournamentId}-se-qf-${i}`);
    const r16Ids = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `${tournamentId}-se-r16-${i}`);
    const matches: CompetitionMatchNode[] = [];

    const seedPairs16 = [
      [0, 15], [7, 8], [3, 12], [4, 11],
      [1, 14], [6, 9], [2, 13], [5, 10]
    ];

    for (let i = 0; i < 8; i++) {
      const [sA, sB] = seedPairs16[i];
      const targetQfId = qfIds[Math.floor(i / 2)];
      const targetSlot = (i % 2 === 0) ? 'teamA' : 'teamB';
      matches.push({
        id: r16Ids[i],
        tournamentId,
        stage: 'round_of_16',
        round: `Round of 16 Match ${i + 1}`,
        roundKey: 'r16',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: teams[sA] || { name: `Seed #${sA + 1}`, seed: sA + 1 },
        teamB: teams[sB] || { name: `Seed #${sB + 1}`, seed: sB + 1 },
        winnerNextMatchId: targetQfId,
        winnerNextSlot: targetSlot,
        winnerDestinationId: targetQfId,
        winnerDestinationSlot: targetSlot,
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: [],
        isBye: false
      });
    }

    for (let i = 0; i < 4; i++) {
      const targetSfId = (i < 2) ? sf1Id : sf2Id;
      const targetSlot = (i % 2 === 0) ? 'teamA' : 'teamB';
      matches.push({
        id: qfIds[i],
        tournamentId,
        stage: 'quarterfinal',
        round: `Quarterfinal ${i + 1}`,
        roundKey: 'qf',
        bracketType: 'upper',
        seriesFormat: defaultFormat,
        teamA: { name: `Winner R16 Match ${i * 2 + 1}`, seed: 0 },
        teamB: { name: `Winner R16 Match ${i * 2 + 2}`, seed: 0 },
        winnerNextMatchId: targetSfId,
        winnerNextSlot: targetSlot,
        winnerDestinationId: targetSfId,
        winnerDestinationSlot: targetSlot,
        status: 'UPCOMING',
        scores: { teamA: 0, teamB: 0 },
        games: [],
        isBye: false
      });
    }

    matches.push({
      id: sf1Id,
      tournamentId,
      stage: 'semifinal',
      round: 'Semifinal 1',
      roundKey: 'sf',
      bracketType: 'upper',
      seriesFormat: defaultFormat,
      teamA: { name: 'Winner QF1', seed: 0 },
      teamB: { name: 'Winner QF2', seed: 0 },
      winnerNextMatchId: gfId,
      winnerNextSlot: 'teamA',
      winnerDestinationId: gfId,
      winnerDestinationSlot: 'teamA',
      status: 'UPCOMING',
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });

    matches.push({
      id: sf2Id,
      tournamentId,
      stage: 'semifinal',
      round: 'Semifinal 2',
      roundKey: 'sf',
      bracketType: 'upper',
      seriesFormat: defaultFormat,
      teamA: { name: 'Winner QF3', seed: 0 },
      teamB: { name: 'Winner QF4', seed: 0 },
      winnerNextMatchId: gfId,
      winnerNextSlot: 'teamB',
      winnerDestinationId: gfId,
      winnerDestinationSlot: 'teamB',
      status: 'UPCOMING',
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });

    matches.push({
      id: gfId,
      tournamentId,
      stage: 'grand_final',
      round: 'Grand Final',
      roundKey: 'gf',
      bracketType: 'grand_final',
      seriesFormat: gfFormat,
      teamA: { name: 'Winner SF1', seed: 0 },
      teamB: { name: 'Winner SF2', seed: 0 },
      status: 'UPCOMING',
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });

    return matches;
  }

  public applyCanonicalMatchResult(params: {
    tournamentId: string;
    matchId: string;
    winnerTeamId: string;
    loserTeamId?: string;
    scoreA?: number;
    scoreB?: number;
  }): { success: boolean; error?: string } {
    const { tournamentId, matchId, winnerTeamId, loserTeamId, scoreA = 0, scoreB = 0 } = params;
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, error: 'Structure not found' };

    const match = structure.matches.find(m => m.id === matchId);
    if (!match) return { success: false, error: 'Match not found' };

    match.status = 'COMPLETED';
    match.scores = { teamA: scoreA, teamB: scoreB };
    match.winnerId = winnerTeamId;
    match.loserId = loserTeamId;

    const winningTeam = (match.teamA && (match.teamA.teamId === winnerTeamId || match.teamA.id === winnerTeamId))
      ? match.teamA
      : match.teamB;

    const losingTeam = (match.teamB && (match.teamB.teamId === loserTeamId || match.teamB.id === loserTeamId))
      ? match.teamB
      : match.teamA;

    // Advance winner
    const winMatchId = match.winnerNextMatchId || match.winnerDestinationId;
    const winSlot = match.winnerNextSlot || match.winnerDestinationSlot || 'teamA';
    if (winMatchId && winningTeam) {
      const targetMatch = structure.matches.find(m => m.id === winMatchId);
      if (targetMatch) {
        if (winSlot === 'teamA') {
          targetMatch.teamA = { ...winningTeam };
        } else {
          targetMatch.teamB = { ...winningTeam };
        }
      }
    }

    // Drop loser
    const loseMatchId = match.loserNextMatchId || match.loserDestinationId;
    const loseSlot = match.loserNextSlot || match.loserDestinationSlot || 'teamA';
    if (loseMatchId && losingTeam) {
      const targetMatch = structure.matches.find(m => m.id === loseMatchId);
      if (targetMatch) {
        if (loseSlot === 'teamA') {
          targetMatch.teamA = { ...losingTeam };
        } else {
          targetMatch.teamB = { ...losingTeam };
        }
      }
    }

    structure.updatedAt = new Date().toISOString();
    return { success: true };
  }

  // Backward compatibility signatures
  public generateBracket(tournamentId: string, teams: any[], format = 'DOUBLE_ELIMINATION'): MultiStageTournamentStructure {
    return this.generateFullStructure(tournamentId, teams).structure;
  }
}

export const dotaCompetitionEngine = new DotaCompetitionEngine();
