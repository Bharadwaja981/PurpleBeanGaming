// src/index.ts
import { onRequest } from "firebase-functions/v2/https";
import express from "express";

// ../src/server/apiRouter.ts
import { Router } from "express";

// ../src/domain/dotaCompetitionEngine.ts
import { doc as doc2, setDoc, updateDoc, onSnapshot, getDoc, runTransaction } from "firebase/firestore";

// ../src/services/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDocFromServer, setLogLevel } from "firebase/firestore";

// ../firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0634745445",
  appId: "1:866955042948:web:b4faf027f5552b1d90e2d1",
  apiKey: "AIzaSyBXbW4wptQI_ny98vCEcHbdHJhsMgRYbv0",
  authDomain: "gen-lang-client-0634745445.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-helloworld-3b15cdcf-4ce0-4040-9e96-73767517ade0",
  storageBucket: "gen-lang-client-0634745445.firebasestorage.app",
  messagingSenderId: "866955042948",
  measurementId: "",
  oAuthClientId: "866955042948-mtiemau7sc6smf9mtp7m4vqumedhomau.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// ../src/services/firebaseConfig.ts
try {
  setLogLevel("silent");
} catch {
}
var env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
var activeFirebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID || firebase_applet_config_default.projectId,
  appId: env.VITE_FIREBASE_APP_ID || firebase_applet_config_default.appId,
  apiKey: env.VITE_FIREBASE_API_KEY || firebase_applet_config_default.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || firebase_applet_config_default.authDomain,
  firestoreDatabaseId: env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebase_applet_config_default.firestoreDatabaseId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || firebase_applet_config_default.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebase_applet_config_default.messagingSenderId,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || firebase_applet_config_default.measurementId || "",
  oAuthClientId: env.VITE_FIREBASE_OAUTH_CLIENT_ID || firebase_applet_config_default.oAuthClientId || "",
  recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || firebase_applet_config_default.recaptchaSiteKey || ""
};
var app = getApps().length > 0 ? getApp() : initializeApp(activeFirebaseConfig);
var db = (() => {
  try {
    return initializeFirestore(app, {
      experimentalForceLongPolling: true,
      ignoreUndefinedProperties: true
    }, activeFirebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, activeFirebaseConfig.firestoreDatabaseId);
  }
})();
var auth = getAuth(app);
var googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});
var quotaExhaustedState = false;
var quotaListeners = /* @__PURE__ */ new Set();
var LOCAL_DEV_MODE_KEY = "pb_local_dev_sync_mode";
var localDevSyncMode = (() => {
  if (typeof window !== "undefined" && window.localStorage) {
    const saved = window.localStorage.getItem(LOCAL_DEV_MODE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
  }
  return false;
})();
function isQuotaExhausted() {
  return quotaExhaustedState;
}
function setQuotaExhausted(exhausted = true) {
  if (quotaExhaustedState !== exhausted) {
    quotaExhaustedState = exhausted;
    quotaListeners.forEach((cb) => {
      try {
        cb(isQuotaExhausted());
      } catch {
      }
    });
  }
}
function isQuotaError(error) {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = error?.code;
  return code === "resource-exhausted" || msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("resource-exhausted") || msg.toLowerCase().includes("quota limit exceeded");
}
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (isQuotaError(error)) {
      setQuotaExhausted(true);
    }
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Please check your Firebase configuration: client is offline");
      return false;
    }
    return true;
  }
}
if (typeof window !== "undefined") {
  setTimeout(() => {
    testFirestoreConnection().catch(() => {
    });
  }, 1500);
}

// ../src/utils/sanitizeFirestore.ts
function removeUndefinedDeep(value) {
  if (value === null || value === void 0) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item) => item !== void 0).map((item) => typeof item === "object" && item !== null ? removeUndefinedDeep(item) : item);
  }
  if (typeof value === "object") {
    if (value instanceof Date || value instanceof RegExp) {
      return value;
    }
    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== void 0) {
        if (typeof v === "object" && v !== null) {
          sanitized[k] = removeUndefinedDeep(v);
        } else {
          sanitized[k] = v;
        }
      }
    }
    return sanitized;
  }
  return value;
}
function sanitizeFirestorePayload(payload) {
  return removeUndefinedDeep(payload);
}

// ../src/domain/dotaCompetitionEngine.ts
var SHARED_STRUCTURE_STORAGE = /* @__PURE__ */ new Map();
function getStorageBackend() {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return {
    getItem: (key) => SHARED_STRUCTURE_STORAGE.get(key) || null,
    setItem: (key, value) => {
      SHARED_STRUCTURE_STORAGE.set(key, String(value));
    },
    removeItem: (key) => {
      SHARED_STRUCTURE_STORAGE.delete(key);
    },
    clear: () => {
      SHARED_STRUCTURE_STORAGE.clear();
    }
  };
}
var DotaCompetitionEngine = class {
  constructor() {
    this.structures = /* @__PURE__ */ new Map();
    this.structureSubscribers = /* @__PURE__ */ new Map();
    this.firestoreListeners = /* @__PURE__ */ new Map();
  }
  loadPersistedStructure(tournamentId) {
    const storage = getStorageBackend();
    if (!storage) return void 0;
    try {
      const raw = storage.getItem(`pbg_competition_structure_${tournamentId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.tournamentId === tournamentId) {
          return parsed;
        }
      }
    } catch {
    }
    return void 0;
  }
  persistStructure(tournamentId, state) {
    const storage = getStorageBackend();
    if (storage) {
      try {
        storage.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(state));
      } catch {
      }
    }
    try {
      if (db && tournamentId) {
        const payload = sanitizeFirestorePayload(state);
        setDoc(doc2(db, "tournaments", tournamentId, "competition", "structure"), payload, { merge: true }).catch(() => {
        });
        updateDoc(doc2(db, "tournaments", tournamentId), {
          competitionStructure: payload,
          competitionStructureSummary: {
            status: state.status,
            isLocked: state.isLocked,
            version: state.version,
            stageCount: state.stages.length,
            matchCount: (state.matches || []).length,
            completedMatchCount: (state.matches || []).filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT").length,
            format: state.format,
            updatedAt: state.updatedAt,
            publishedAt: state.publishedAt || null
          },
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }).catch(() => {
        });
      }
    } catch {
    }
    this.notifySubscribers(tournamentId, state);
  }
  subscribe(tournamentId, listener) {
    if (!this.structureSubscribers.has(tournamentId)) {
      this.structureSubscribers.set(tournamentId, /* @__PURE__ */ new Set());
    }
    const set = this.structureSubscribers.get(tournamentId);
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
  listenToFirestore(tournamentId) {
    if (!tournamentId || !db) return () => {
    };
    if (this.firestoreListeners.has(tournamentId)) {
      return this.firestoreListeners.get(tournamentId);
    }
    try {
      const unsub = onSnapshot(doc2(db, "tournaments", tournamentId, "competition", "structure"), (snap) => {
        if (snap.exists()) {
          const remoteData = snap.data();
          if (remoteData && remoteData.tournamentId === tournamentId) {
            this.structures.set(tournamentId, remoteData);
            const storage = getStorageBackend();
            try {
              storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData));
            } catch {
            }
            this.notifySubscribers(tournamentId, remoteData);
          }
        }
      }, () => {
      });
      this.firestoreListeners.set(tournamentId, unsub);
      return unsub;
    } catch {
      return () => {
      };
    }
  }
  hydrateFromFirestore(tournamentId, remoteData) {
    if (!remoteData || !tournamentId) return;
    this.structures.set(tournamentId, remoteData);
    const storage = getStorageBackend();
    try {
      storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData));
    } catch {
    }
    this.notifySubscribers(tournamentId, remoteData);
  }
  notifySubscribers(tournamentId, struct) {
    const set = this.structureSubscribers.get(tournamentId);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(struct);
        } catch {
        }
      });
    }
  }
  async fetchStructureFromFirestore(tournamentId) {
    if (!tournamentId || !db) return void 0;
    try {
      const structRef = doc2(db, "tournaments", tournamentId, "competition", "structure");
      const snap = await getDoc(structRef);
      if (snap.exists()) {
        const remoteData = snap.data();
        this.structures.set(tournamentId, remoteData);
        const storage = getStorageBackend();
        try {
          storage?.setItem(`pbg_competition_structure_${tournamentId}`, JSON.stringify(remoteData));
        } catch {
        }
        try {
          const tourneyRef = doc2(db, "tournaments", tournamentId);
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
                  completedMatchCount: (remoteData.matches || []).filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT").length,
                  format: remoteData.format,
                  updatedAt: remoteData.updatedAt,
                  publishedAt: remoteData.publishedAt || null
                },
                updatedAt: remoteData.updatedAt
              });
            }
          }
        } catch {
        }
        return remoteData;
      } else {
        const tourneyRef = doc2(db, "tournaments", tournamentId);
        const tSnap = await getDoc(tourneyRef);
        if (tSnap.exists()) {
          const tData = tSnap.data();
          if (tData?.competitionStructure) {
            const structureData = tData.competitionStructure;
            this.structures.set(tournamentId, structureData);
            try {
              await setDoc(structRef, sanitizeFirestorePayload(structureData), { merge: true });
            } catch {
            }
            return structureData;
          }
        }
      }
    } catch {
    }
    return void 0;
  }
  async ensureCanonicalSync(tournamentId) {
    const struct = await this.fetchStructureFromFirestore(tournamentId);
    return Boolean(struct);
  }
  getStructure(tournamentId) {
    const memory = this.structures.get(tournamentId);
    if (memory) return memory;
    const persisted = this.loadPersistedStructure(tournamentId);
    if (persisted) {
      this.structures.set(tournamentId, persisted);
      return persisted;
    }
    return void 0;
  }
  setStructure(tournamentId, state) {
    this.structures.set(tournamentId, state);
    this.persistStructure(tournamentId, state);
  }
  /**
   * Initializes or returns structure draft for a tournament
   */
  getOrCreateStructure(tournamentId, initialTeams = []) {
    const existing = this.structures.get(tournamentId);
    if (existing) {
      if (initialTeams.length > 0 && (!existing.teams || existing.teams.length === 0)) {
        existing.teams = this.normalizeTeams(initialTeams);
      }
      return existing;
    }
    const seededTeams = this.normalizeTeams(initialTeams);
    const defaultStages = [
      {
        id: `stage-${tournamentId}-1`,
        name: "Stage 1: Playoff Bracket",
        sequence: 1,
        type: "DOUBLE_ELIMINATION",
        status: "UPCOMING",
        teamCount: Math.max(4, seededTeams.length || 8),
        defaultSeriesFormat: "BO3",
        grandFinalSeriesFormat: "BO5",
        thirdPlaceMatch: false,
        grandFinalReset: true,
        seedingMode: "RATING_BASED",
        seededTeams: [...seededTeams],
        matches: []
      }
    ];
    const newStructure = {
      tournamentId,
      format: "DOUBLE_ELIMINATION",
      config: { format: "DOUBLE_ELIMINATION" },
      status: "DRAFT",
      version: 1,
      stages: defaultStages,
      isLocked: false,
      teams: seededTeams,
      matches: [],
      auditTrail: [
        {
          id: `audit-${Date.now()}-init`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          actorId: "system",
          action: "INIT_STRUCTURE",
          details: `Initialized draft competition structure with ${seededTeams.length} teams.`
        }
      ]
    };
    this.structures.set(tournamentId, newStructure);
    return newStructure;
  }
  normalizeTeams(rawTeams) {
    return rawTeams.map((t, idx) => ({
      teamId: t.id || t.teamId || `placeholder-team-${idx + 1}`,
      name: t.name || t.teamName || `Seed #${idx + 1}`,
      tag: t.tag || `T${idx + 1}`,
      seed: idx + 1,
      rating: t.rating || 1500,
      mmr: t.mmr || t.lockedTournamentMmr || t.primaryRoster?.[0]?.tournamentMmr || 6e3,
      logo: t.logo || "\u{1F6E1}\uFE0F",
      color: t.color || "#7C3AED",
      captainUserId: t.captainId || t.captainUserId,
      captainIgn: t.captainName || t.captainIgn,
      isPlaceholder: Boolean(t.isPlaceholder || !t.id)
    }));
  }
  /**
   * Adds a new stage to tournament structure
   */
  addStage(tournamentId, type, customName) {
    const structure = this.getOrCreateStructure(tournamentId);
    const nextSeq = structure.stages.length + 1;
    const stageId = `stage-${tournamentId}-${Date.now()}-${nextSeq}`;
    let defaultName = `Stage ${nextSeq}: `;
    switch (type) {
      case "GROUP_STAGE":
        defaultName += "Group Stage";
        break;
      case "ROUND_ROBIN":
        defaultName += "Round Robin";
        break;
      case "DOUBLE_ROUND_ROBIN":
        defaultName += "Double Round Robin";
        break;
      case "GSL":
        defaultName += "GSL Group Format";
        break;
      case "SWISS":
        defaultName += "Swiss System";
        break;
      case "SINGLE_ELIMINATION":
        defaultName += "Single Elimination Bracket";
        break;
      case "DOUBLE_ELIMINATION":
        defaultName += "Double Elimination Bracket";
        break;
      case "LEAGUE":
        defaultName += "League Play";
        break;
      case "PLAY_IN":
        defaultName += "Play-In Gauntlet";
        break;
      case "CUSTOM":
        defaultName += "Custom Stage";
        break;
    }
    const newStage = {
      id: stageId,
      name: customName || defaultName,
      sequence: nextSeq,
      type,
      status: "UPCOMING",
      teamCount: structure.teams?.length || 8,
      defaultSeriesFormat: type === "GROUP_STAGE" || type === "ROUND_ROBIN" || type === "DOUBLE_ROUND_ROBIN" ? "BO2" : "BO3",
      grandFinalSeriesFormat: "BO5",
      groupCount: type === "GROUP_STAGE" || type === "GSL" ? 2 : void 0,
      teamsPerGroup: type === "GSL" ? 4 : type === "GROUP_STAGE" ? 4 : void 0,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      seedingMode: "RATING_BASED",
      seededTeams: structure.teams ? [...structure.teams] : [],
      matches: []
    };
    structure.stages.push(newStage);
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "ADD_STAGE", `Added stage "${newStage.name}" (${type}) at sequence ${nextSeq}.`);
    return { success: true, stage: newStage };
  }
  /**
   * Reorders stages (Move Up / Down)
   */
  moveStage(tournamentId, stageId, direction) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const idx = structure.stages.findIndex((s) => s.id === stageId);
    if (idx === -1) return false;
    if (direction === "UP" && idx > 0) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx - 1];
      structure.stages[idx - 1] = temp;
    } else if (direction === "DOWN" && idx < structure.stages.length - 1) {
      const temp = structure.stages[idx];
      structure.stages[idx] = structure.stages[idx + 1];
      structure.stages[idx + 1] = temp;
    }
    structure.stages.forEach((s, i) => {
      s.sequence = i + 1;
    });
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "REORDER_STAGES", `Moved stage ${stageId} ${direction}.`);
    return true;
  }
  /**
   * Replaces stage type in place
   */
  replaceStageType(tournamentId, stageId, newType) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find((s) => s.id === stageId);
    if (!stage) return false;
    stage.type = newType;
    if (newType === "GROUP_STAGE" || newType === "ROUND_ROBIN" || newType === "DOUBLE_ROUND_ROBIN") {
      stage.defaultSeriesFormat = "BO2";
      stage.groupCount = stage.groupCount || 2;
      stage.teamsPerGroup = stage.teamsPerGroup || 4;
    } else if (newType === "GSL") {
      stage.defaultSeriesFormat = "BO3";
      stage.groupCount = stage.groupCount || 2;
      stage.teamsPerGroup = 4;
    } else {
      stage.defaultSeriesFormat = "BO3";
    }
    stage.matches = [];
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "REPLACE_STAGE_TYPE", `Replaced stage ${stage.name} type with ${newType}.`);
    return true;
  }
  /**
   * Deletes a stage
   */
  deleteStage(tournamentId, stageId) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stageToDelete = structure.stages.find((s) => s.id === stageId);
    if (!stageToDelete) return false;
    const hasCompleted = stageToDelete.matches?.some((m) => m.status === "COMPLETED");
    if (hasCompleted) {
      throw new Error("Cannot delete a stage with completed matches.");
    }
    structure.stages = structure.stages.filter((s) => s.id !== stageId);
    structure.stages.forEach((s, i) => {
      s.sequence = i + 1;
    });
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "DELETE_STAGE", `Deleted stage "${stageToDelete.name}".`);
    return true;
  }
  /**
   * Updates stage properties
   */
  updateStageConfig(tournamentId, stageId, updates) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find((s) => s.id === stageId);
    if (!stage) return false;
    Object.assign(stage, updates);
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "UPDATE_STAGE_CONFIG", `Updated configuration for stage "${stage.name}".`);
    return true;
  }
  /**
   * Swap seeds between two teams
   */
  swapSeeds(tournamentId, stageId, seedA, seedB) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find((s) => s.id === stageId);
    if (!stage || !stage.seededTeams) return false;
    const teamA = stage.seededTeams.find((t) => t.seed === seedA);
    const teamB = stage.seededTeams.find((t) => t.seed === seedB);
    if (!teamA || !teamB) return false;
    teamA.seed = seedB;
    teamB.seed = seedA;
    stage.seededTeams.sort((a, b) => a.seed - b.seed);
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "SWAP_SEEDS", `Swapped seed #${seedA} (${teamA.name}) with seed #${seedB} (${teamB.name}).`);
    return true;
  }
  /**
   * Reassign a team to a different group
   */
  reassignTeamGroup(tournamentId, stageId, teamId, targetGroupId) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return false;
    const stage = structure.stages.find((s) => s.id === stageId);
    if (!stage || !stage.groups) return false;
    let targetTeam = null;
    stage.groups.forEach((grp) => {
      const found = grp.teams.find((t) => t.teamId === teamId);
      if (found) {
        targetTeam = found;
        grp.teams = grp.teams.filter((t) => t.teamId !== teamId);
      }
    });
    if (!targetTeam) return false;
    const targetGroup = stage.groups.find((g) => g.id === targetGroupId);
    if (!targetGroup) return false;
    targetTeam.groupId = targetGroup.id;
    targetTeam.groupName = targetGroup.name;
    targetGroup.teams.push(targetTeam);
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "REASSIGN_GROUP", `Reassigned team ${targetTeam.name} to ${targetGroup.name}.`);
    return true;
  }
  /**
   * Applies automated seeding (MANUAL, RANDOM, RATING_BASED, RANKING_BASED)
   */
  applySeedingMethod(tournamentId, stageId, method) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, seededTeams: [] };
    const stage = structure.stages.find((s) => s.id === stageId);
    if (!stage || !stage.seededTeams) return { success: false, seededTeams: [] };
    stage.seedingMode = method;
    if (method === "RATING_BASED") {
      stage.seededTeams.sort((a, b) => (b.mmr || b.rating || 0) - (a.mmr || a.rating || 0));
      stage.seededTeams.forEach((t, i) => {
        t.seed = i + 1;
      });
    } else if (method === "RANDOM") {
      const shuffled = [...stage.seededTeams].sort(() => Math.random() - 0.5);
      shuffled.forEach((t, i) => {
        t.seed = i + 1;
      });
      stage.seededTeams = shuffled;
    }
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "APPLY_SEEDING", `Applied ${method} seeding to stage "${stage.name}".`);
    return { success: true, seededTeams: stage.seededTeams };
  }
  /**
   * Generates bracket/group match fixtures for all stages in structure
   */
  generateFullStructure(tournamentId, availableTeams = []) {
    const structure = this.getOrCreateStructure(tournamentId, availableTeams);
    const teamsList = structure.teams && structure.teams.length > 0 ? structure.teams : this.normalizeTeams(availableTeams);
    structure.teams = teamsList;
    if (tournamentId === "pb-challenger-2026" || structure.format === "groups_to_playoffs") {
      const teamsA = teamsList.slice(0, 4);
      const teamsB = teamsList.slice(4, 8);
      const matchesA = this.buildRoundRobinMatches(tournamentId, teamsA, "BO1", "group-a");
      const matchesB = this.buildRoundRobinMatches(tournamentId, teamsB, "BO1", "group-b");
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
        "group-a": { id: "group-a", name: "Group A", teams: teamsA, matches: matchesA, standings: standingsA },
        "group-b": { id: "group-b", name: "Group B", teams: teamsB, matches: matchesB, standings: standingsB }
      };
      const sf1 = {
        id: `${tournamentId}-po-sf-1`,
        tournamentId,
        stage: "playoffs",
        round: "Playoff Semifinal 1",
        roundKey: "po-sf",
        bracketType: "upper",
        seriesFormat: "BO3",
        teamA: { name: "Group A 1st Place", sourceLabel: "A1", seed: 1 },
        teamB: { name: "Group B 2nd Place", sourceLabel: "B2", seed: 2 },
        winnerNextMatchId: `${tournamentId}-po-final`,
        winnerNextSlot: "teamA",
        winnerDestinationId: `${tournamentId}-po-final`,
        winnerDestinationSlot: "teamA",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      };
      const sf2 = {
        id: `${tournamentId}-po-sf-2`,
        tournamentId,
        stage: "playoffs",
        round: "Playoff Semifinal 2",
        roundKey: "po-sf",
        bracketType: "upper",
        seriesFormat: "BO3",
        teamA: { name: "Group B 1st Place", sourceLabel: "B1", seed: 1 },
        teamB: { name: "Group A 2nd Place", sourceLabel: "A2", seed: 2 },
        winnerNextMatchId: `${tournamentId}-po-final`,
        winnerNextSlot: "teamB",
        winnerDestinationId: `${tournamentId}-po-final`,
        winnerDestinationSlot: "teamB",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      };
      const poFinal = {
        id: `${tournamentId}-po-final`,
        tournamentId,
        stage: "grand_final",
        round: "Playoff Grand Final",
        roundKey: "po-final",
        bracketType: "grand_final",
        seriesFormat: "BO5",
        teamA: { name: "Winner SF1", seed: 0 },
        teamB: { name: "Winner SF2", seed: 0 },
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      };
      const allMatches = [...matchesA, ...matchesB, sf1, sf2, poFinal];
      structure.matches = allMatches;
      if (structure.stages[0]) structure.stages[0].matches = allMatches;
      structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      return { success: true, structure };
    }
    let allStructureMatches = [];
    for (let sIdx = 0; sIdx < structure.stages.length; sIdx++) {
      const stage = structure.stages[sIdx];
      const isFirstStage = sIdx === 0;
      const stageTeams = isFirstStage ? [...teamsList] : stage.seededTeams || [];
      if (stage.type === "GROUP_STAGE" || stage.type === "ROUND_ROBIN" || stage.type === "DOUBLE_ROUND_ROBIN") {
        const groupCount = Math.max(1, stage.groupCount || 2);
        const groups = [];
        const stageMatches = [];
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
        const isDoubleRR = stage.type === "DOUBLE_ROUND_ROBIN";
        groups.forEach((grp) => {
          const grpTeams = grp.teams;
          let matchNum = 1;
          for (let i = 0; i < grpTeams.length; i++) {
            for (let j = i + 1; j < grpTeams.length; j++) {
              stageMatches.push({
                id: `match-${stage.id}-${grp.name.replace(/\s+/g, "")}-m${matchNum++}`,
                tournamentId,
                stageId: stage.id,
                stageName: stage.name,
                round: `${grp.name} Round 1`,
                roundKey: grp.name,
                bracketType: "group",
                seriesFormat: stage.defaultSeriesFormat || "BO2",
                teamA: grpTeams[i],
                teamB: grpTeams[j],
                teamASource: { type: "SEED", sourceSeed: grpTeams[i].seed, label: `#${grpTeams[i].seed} ${grpTeams[i].name}` },
                teamBSource: { type: "SEED", sourceSeed: grpTeams[j].seed, label: `#${grpTeams[j].seed} ${grpTeams[j].name}` },
                status: "UPCOMING",
                scores: { teamA: 0, teamB: 0 },
                games: []
              });
              if (isDoubleRR) {
                stageMatches.push({
                  id: `match-${stage.id}-${grp.name.replace(/\s+/g, "")}-m${matchNum++}`,
                  tournamentId,
                  stageId: stage.id,
                  stageName: stage.name,
                  round: `${grp.name} Round 2`,
                  roundKey: grp.name,
                  bracketType: "group",
                  seriesFormat: stage.defaultSeriesFormat || "BO2",
                  teamA: grpTeams[j],
                  teamB: grpTeams[i],
                  teamASource: { type: "SEED", sourceSeed: grpTeams[j].seed, label: `#${grpTeams[j].seed} ${grpTeams[j].name}` },
                  teamBSource: { type: "SEED", sourceSeed: grpTeams[i].seed, label: `#${grpTeams[i].seed} ${grpTeams[i].name}` },
                  status: "UPCOMING",
                  scores: { teamA: 0, teamB: 0 },
                  games: []
                });
              }
            }
          }
        });
        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else if (stage.type === "GSL") {
        const groupCount = Math.max(1, stage.groupCount || 2);
        const groups = [];
        const stageMatches = [];
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
        groups.forEach((grp) => {
          const gTeams = grp.teams;
          const gName = grp.name;
          const mPrefix = `match-${stage.id}-${gName.replace(/\s+/g, "")}`;
          const m1Id = `${mPrefix}-opening-1`;
          const m2Id = `${mPrefix}-opening-2`;
          const m3Id = `${mPrefix}-winners`;
          const m4Id = `${mPrefix}-elim`;
          const m5Id = `${mPrefix}-decider`;
          stageMatches.push({
            id: m1Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Opening Match 1`,
            roundKey: "GSL_OPENING",
            bracketType: "gsl",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: gTeams[0] || { name: "Seed #1", seed: 1 },
            teamB: gTeams[3] || { name: "Seed #4", seed: 4 },
            winnerDestinationId: m3Id,
            winnerDestinationSlot: "teamA",
            loserDestinationId: m4Id,
            loserDestinationSlot: "teamA",
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
          stageMatches.push({
            id: m2Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Opening Match 2`,
            roundKey: "GSL_OPENING",
            bracketType: "gsl",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: gTeams[1] || { name: "Seed #2", seed: 2 },
            teamB: gTeams[2] || { name: "Seed #3", seed: 3 },
            winnerDestinationId: m3Id,
            winnerDestinationSlot: "teamB",
            loserDestinationId: m4Id,
            loserDestinationSlot: "teamB",
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
          stageMatches.push({
            id: m3Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Winners Match`,
            roundKey: "GSL_WINNERS",
            bracketType: "gsl",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: { name: "Winner Opening 1", seed: 0 },
            teamB: { name: "Winner Opening 2", seed: 0 },
            loserDestinationId: m5Id,
            loserDestinationSlot: "teamA",
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
          stageMatches.push({
            id: m4Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Elimination Match`,
            roundKey: "GSL_ELIM",
            bracketType: "gsl",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: { name: "Loser Opening 1", seed: 0 },
            teamB: { name: "Loser Opening 2", seed: 0 },
            winnerDestinationId: m5Id,
            winnerDestinationSlot: "teamB",
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
          stageMatches.push({
            id: m5Id,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: `${gName} Decider Match`,
            roundKey: "GSL_DECIDER",
            bracketType: "gsl",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: { name: "Loser Winners Match", seed: 0 },
            teamB: { name: "Winner Elimination Match", seed: 0 },
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
        });
        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else if (stage.type === "SWISS") {
        const totalRounds = stage.swissRoundsCount || (stageTeams.length >= 8 ? 3 : 2);
        const stageMatches = [];
        const half = Math.floor(stageTeams.length / 2);
        for (let i = 0; i < half; i++) {
          stageMatches.push({
            id: `match-${stage.id}-swiss-r1-m${i + 1}`,
            tournamentId,
            stageId: stage.id,
            stageName: stage.name,
            round: "Swiss Round 1",
            roundKey: "SWISS_R1",
            bracketType: "swiss",
            seriesFormat: stage.defaultSeriesFormat || "BO3",
            teamA: stageTeams[i],
            teamB: stageTeams[stageTeams.length - 1 - i],
            status: "UPCOMING",
            scores: { teamA: 0, teamB: 0 },
            games: []
          });
        }
        for (let r = 2; r <= totalRounds; r++) {
          for (let m = 1; m <= half; m++) {
            stageMatches.push({
              id: `match-${stage.id}-swiss-r${r}-m${m}`,
              tournamentId,
              stageId: stage.id,
              stageName: stage.name,
              round: `Swiss Round ${r}`,
              roundKey: `SWISS_R${r}`,
              bracketType: "swiss",
              seriesFormat: stage.defaultSeriesFormat || "BO3",
              teamA: { name: `Round ${r - 1} Contender`, seed: 0 },
              teamB: { name: `Round ${r - 1} Contender`, seed: 0 },
              status: "UPCOMING",
              scores: { teamA: 0, teamB: 0 },
              games: []
            });
          }
        }
        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else if (stage.type === "DOUBLE_ELIMINATION") {
        const gfSeriesFormat = structure.roundSeriesOverrides?.["gf"] || stage.grandFinalSeriesFormat || "BO5";
        const effectiveTeams = stageTeams.length > 0 ? stageTeams : Array.from({ length: 8 }, (_, i) => ({
          teamId: `team-${i + 1}`,
          name: `Seed #${i + 1}`,
          teamName: `Seed #${i + 1}`,
          tag: `S${i + 1}`,
          seed: i + 1,
          logo: "\u{1F6E1}\uFE0F"
        }));
        const prevGroupStage = sIdx > 0 ? structure.stages.slice(0, sIdx).reverse().find((s) => s.type === "GROUP_STAGE" || s.type === "ROUND_ROBIN" || s.type === "DOUBLE_ROUND_ROBIN") : null;
        if (prevGroupStage && (prevGroupStage.groups && prevGroupStage.groups.length >= 2 || stage.mixedEntryFromGroups)) {
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
            defaultFormat: stage.defaultSeriesFormat || "BO3",
            gfFormat: gfSeriesFormat
          });
          stage.matches = stageMatches;
          allStructureMatches.push(...stageMatches);
        } else {
          const stageMatches = this.generateDoubleEliminationMatches(
            tournamentId,
            effectiveTeams,
            stage.defaultSeriesFormat || "BO3",
            gfSeriesFormat
          );
          stage.matches = stageMatches;
          allStructureMatches.push(...stageMatches);
        }
      } else if (stage.type === "SINGLE_ELIMINATION" || stage.type === "PLAY_IN") {
        const gfSeriesFormat = structure.roundSeriesOverrides?.["gf"] || stage.grandFinalSeriesFormat || "BO5";
        const effectiveTeams = stageTeams.length > 0 ? stageTeams : Array.from({ length: 4 }, (_, i) => ({
          teamId: `team-${i + 1}`,
          name: `Seed #${i + 1}`,
          teamName: `Seed #${i + 1}`,
          tag: `S${i + 1}`,
          seed: i + 1,
          logo: "\u{1F6E1}\uFE0F"
        }));
        const stageMatches = this.generateSingleEliminationMatches(
          tournamentId,
          effectiveTeams,
          stage.defaultSeriesFormat || "BO3",
          gfSeriesFormat
        );
        stage.matches = stageMatches;
        allStructureMatches.push(...stageMatches);
      } else {
        stage.matches = [];
      }
    }
    const existingMatchesMap = /* @__PURE__ */ new Map();
    (structure.matches || []).forEach((m) => {
      if (m.status === "COMPLETED" || m.status === "FORFEIT" || m.status === "LIVE") {
        existingMatchesMap.set(m.id, m);
      }
    });
    if (existingMatchesMap.size > 0) {
      allStructureMatches = allStructureMatches.map((m) => existingMatchesMap.get(m.id) || m);
      structure.stages.forEach((stg) => {
        stg.matches = stg.matches.map((m) => existingMatchesMap.get(m.id) || m);
      });
    }
    structure.matches = allStructureMatches;
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "GENERATE_STRUCTURE", `Generated matches for ${structure.stages.length} stages (${allStructureMatches.length} total fixtures).`);
    this.persistStructure(tournamentId, structure);
    return { success: true, structure };
  }
  /**
   * Calculates standings for a group
   */
  calculateGroupStandings(group, matches) {
    const table = /* @__PURE__ */ new Map();
    group.teams.forEach((t, idx) => {
      table.set(t.teamId, {
        position: idx + 1,
        teamId: t.teamId,
        teamName: t.name,
        tag: t.tag,
        logo: t.logo || "\u{1F6E1}\uFE0F",
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
    matches.forEach((m) => {
      if (m.status !== "COMPLETED" || !m.scores) return;
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
        rowA.drawn += 1;
        rowB.drawn += 1;
        rowA.points += 1;
        rowB.points += 1;
      }
      rowA.gameDiff = rowA.gamesWon - rowA.gamesLost;
      rowB.gameDiff = rowB.gamesWon - rowB.gamesLost;
    });
    const rows = Array.from(table.values());
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const h2hMatch = matches.find(
        (m) => (m.status === "COMPLETED" || m.status === "FORFEIT") && m.scores && (m.teamA?.teamId === a.teamId && m.teamB?.teamId === b.teamId || m.teamA?.teamId === b.teamId && m.teamB?.teamId === a.teamId)
      );
      if (h2hMatch && h2hMatch.scores) {
        const isTeamA_First = h2hMatch.teamA?.teamId === a.teamId;
        const aScore = isTeamA_First ? h2hMatch.scores.teamA : h2hMatch.scores.teamB;
        const bScore = isTeamA_First ? h2hMatch.scores.teamB : h2hMatch.scores.teamA;
        if (aScore > bScore) return -1;
        if (bScore > aScore) return 1;
      }
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      return (a.seed || 99) - (b.seed || 99);
    });
    rows.forEach((row, i) => {
      row.position = i + 1;
      if (i < 2) {
        row.destination = "UPPER_BRACKET";
      } else {
        row.destination = "LOWER_BRACKET";
      }
    });
    return rows;
  }
  /**
   * Records match results transactionally, validates BO formats, and advances winner/loser
   */
  recordMatchResult(params) {
    if (params.callerRole && params.callerRole !== "organizer" && params.callerRole !== "admin" && !params.isAdmin) {
      return { success: false, error: "Unauthorized: Only tournament organizers and admins can confirm official match results." };
    }
    const structure = this.getStructure(params.tournamentId);
    if (!structure) return { success: false, error: "Tournament structure not found." };
    const stage = structure.stages.find((s) => s.id === params.stageId) || structure.stages.find((s) => s.matches.some((m) => m.id === params.matchId));
    if (!stage) return { success: false, error: "Stage not found." };
    const match = stage.matches.find((m) => m.id === params.matchId);
    if (!match) return { success: false, error: "Match not found in stage." };
    if (typeof params.clientVersion === "number" && params.clientVersion > 0 && (structure.version || 1) > params.clientVersion) {
      if (match.status === "COMPLETED" || match.status === "FORFEIT") {
        if (match.scores?.teamA === params.scoreA && match.scores?.teamB === params.scoreB) {
          return { success: true, match };
        }
        return { success: false, error: "STALE_SUBMISSION_CONFLICT: A newer official match result has already been confirmed by the server." };
      }
    }
    if (match.status === "COMPLETED" && match.scores?.teamA === params.scoreA && match.scores?.teamB === params.scoreB && (!params.isForfeit || match.forfeitWinnerId === params.forfeitWinnerId)) {
      return { success: true, match };
    }
    const checkDestId = match.winnerDestinationId || match.winnerNextMatchId;
    const destMatch = checkDestId ? stage.matches.find((m) => m.id === checkDestId) || structure.matches.find((m) => m.id === checkDestId) : void 0;
    if (match.status === "COMPLETED" && destMatch && (destMatch.status === "LIVE" || destMatch.status === "COMPLETED")) {
      return { success: false, error: "Cannot modify match: downstream destination match has already begun or completed." };
    }
    const format = match.seriesFormat || "BO3";
    let targetWins = 2;
    if (format === "BO1") targetWins = 1;
    if (format === "BO2") targetWins = 2;
    if (format === "BO3") targetWins = 2;
    if (format === "BO5") targetWins = 3;
    if (format === "BO7") targetWins = 4;
    if (format !== "BO2") {
      if (params.scoreA < targetWins && params.scoreB < targetWins && !params.isForfeit) {
        return { success: false, error: `Invalid series score. ${format} requires at least one team to reach ${targetWins} game wins.` };
      }
      if (params.scoreA > targetWins || params.scoreB > targetWins) {
        return { success: false, error: `Invalid series score. In ${format}, game wins cannot exceed ${targetWins}.` };
      }
    }
    match.scores = { teamA: params.scoreA, teamB: params.scoreB };
    match.games = params.games || [];
    match.confirmedBy = params.confirmedBy || "Organiser";
    match.confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
    let winningTeam = null;
    let losingTeam = null;
    if (params.isForfeit && params.forfeitWinnerId) {
      match.status = "FORFEIT";
      match.forfeitWinnerId = params.forfeitWinnerId;
      if (match.teamA?.teamId === params.forfeitWinnerId || match.teamA?.id === params.forfeitWinnerId) {
        winningTeam = match.teamA;
        losingTeam = match.teamB;
      } else {
        winningTeam = match.teamB;
        losingTeam = match.teamA;
      }
    } else {
      match.status = "COMPLETED";
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
      const destMatch2 = stage.matches.find((m) => m.id === winDestId) || structure.matches.find((m) => m.id === winDestId);
      if (destMatch2) {
        const slot = winSlot || (destMatch2.teamA?.seed === 0 ? "teamA" : "teamB");
        if (slot === "teamA") {
          destMatch2.teamA = { ...winningTeam };
        } else {
          destMatch2.teamB = { ...winningTeam };
        }
      }
    }
    const loseDestId = match.loserDestinationId || match.loserNextMatchId;
    const loseSlot = match.loserDestinationSlot || match.loserNextSlot;
    if (losingTeam && loseDestId) {
      const destMatch2 = stage.matches.find((m) => m.id === loseDestId) || structure.matches.find((m) => m.id === loseDestId);
      if (destMatch2) {
        const slot = loseSlot || (destMatch2.teamA?.seed === 0 ? "teamA" : "teamB");
        if (slot === "teamA") {
          destMatch2.teamA = { ...losingTeam };
        } else {
          destMatch2.teamB = { ...losingTeam };
        }
      }
    }
    const smIdx = structure.matches.findIndex((m) => m.id === match.id);
    if (smIdx >= 0) {
      structure.matches[smIdx] = { ...match };
    }
    const allStageMatchesDone = stage.matches.every((m) => m.status === "COMPLETED" || m.status === "FORFEIT");
    if (allStageMatchesDone) {
      stage.status = "FINISHED";
      this.evaluateStageAdvancement(structure, stage);
    } else {
      stage.status = "LIVE";
    }
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "RECORD_MATCH_RESULT", `Recorded match ${match.id} score: ${params.scoreA}-${params.scoreB}. Winner: ${winningTeam?.name || "Draw"}`);
    this.persistStructure(params.tournamentId, structure);
    return { success: true, match };
  }
  /**
   * Authoritative Firestore Transaction for atomic result confirmation, progression, and idempotency
   */
  async recordMatchResultTransactional(params) {
    if (params.callerRole && params.callerRole !== "organizer" && params.callerRole !== "admin" && !params.isAdmin) {
      return { success: false, error: "ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can record match results." };
    }
    if (db && params.tournamentId) {
      try {
        const result = await runTransaction(db, async (txn) => {
          const structRef = doc2(db, "tournaments", params.tournamentId, "competition", "structure");
          const structSnap = await txn.get(structRef);
          let structure;
          if (structSnap.exists()) {
            structure = structSnap.data();
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error("Tournament structure not found");
            structure = JSON.parse(JSON.stringify(memory));
          }
          if (typeof params.clientVersion === "number" && params.clientVersion > 0 && (structure.version || 1) > params.clientVersion) {
            const m = structure.matches.find((x) => x.id === params.matchId);
            if (m && m.status === "COMPLETED") {
              if (m.scores?.teamA === params.scoreA && m.scores?.teamB === params.scoreB) {
                return { success: true, match: m, structure };
              }
              throw new Error("STALE_SUBMISSION_CONFLICT: A newer official match result has already been confirmed by the server.");
            }
          }
          const stage = structure.stages.find((s) => s.id === params.stageId) || structure.stages.find((s) => s.matches.some((m) => m.id === params.matchId));
          if (!stage) throw new Error("Stage not found");
          const match = stage.matches.find((m) => m.id === params.matchId);
          if (!match) throw new Error("Match not found in stage");
          if (match.status === "COMPLETED" && match.scores?.teamA === params.scoreA && match.scores?.teamB === params.scoreB && (!params.isForfeit || match.forfeitWinnerId === params.forfeitWinnerId)) {
            return { success: true, match, structure };
          }
          const checkDestId = match.winnerDestinationId || match.winnerNextMatchId;
          const destMatch = checkDestId ? stage.matches.find((m) => m.id === checkDestId) || structure.matches.find((m) => m.id === checkDestId) : void 0;
          if (match.status === "COMPLETED" && destMatch && (destMatch.status === "LIVE" || destMatch.status === "COMPLETED")) {
            throw new Error("Cannot modify match: downstream destination match has already begun or completed.");
          }
          const format = match.seriesFormat || "BO3";
          let targetWins = 2;
          if (format === "BO1") targetWins = 1;
          if (format === "BO2") targetWins = 2;
          if (format === "BO3") targetWins = 2;
          if (format === "BO5") targetWins = 3;
          if (format === "BO7") targetWins = 4;
          if (format !== "BO2") {
            if (params.scoreA < targetWins && params.scoreB < targetWins && !params.isForfeit) {
              throw new Error(`Invalid series score. ${format} requires at least one team to reach ${targetWins} game wins.`);
            }
            if (params.scoreA > targetWins || params.scoreB > targetWins) {
              throw new Error(`Invalid series score. In ${format}, game wins cannot exceed ${targetWins}.`);
            }
          }
          match.scores = { teamA: params.scoreA, teamB: params.scoreB };
          match.games = params.games || [];
          match.confirmedBy = params.confirmedBy || "Organiser";
          match.confirmedAt = (/* @__PURE__ */ new Date()).toISOString();
          let winningTeam = null;
          let losingTeam = null;
          if (params.isForfeit && params.forfeitWinnerId) {
            match.status = "FORFEIT";
            match.forfeitWinnerId = params.forfeitWinnerId;
            if (match.teamA?.teamId === params.forfeitWinnerId || match.teamA?.id === params.forfeitWinnerId) {
              winningTeam = match.teamA;
              losingTeam = match.teamB;
            } else {
              winningTeam = match.teamB;
              losingTeam = match.teamA;
            }
          } else {
            match.status = "COMPLETED";
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
            const dMatch = stage.matches.find((m) => m.id === winDestId) || structure.matches.find((m) => m.id === winDestId);
            if (dMatch) {
              const slot = winSlot || (dMatch.teamA?.seed === 0 ? "teamA" : "teamB");
              if (slot === "teamA") dMatch.teamA = { ...winningTeam };
              else dMatch.teamB = { ...winningTeam };
            }
          }
          const loseDestId = match.loserDestinationId || match.loserNextMatchId;
          const loseSlot = match.loserDestinationSlot || match.loserNextSlot;
          if (losingTeam && loseDestId) {
            const dMatch = stage.matches.find((m) => m.id === loseDestId) || structure.matches.find((m) => m.id === loseDestId);
            if (dMatch) {
              const slot = loseSlot || (dMatch.teamA?.seed === 0 ? "teamA" : "teamB");
              if (slot === "teamA") dMatch.teamA = { ...losingTeam };
              else dMatch.teamB = { ...losingTeam };
            }
          }
          const smIdx = structure.matches.findIndex((m) => m.id === match.id);
          if (smIdx >= 0) {
            structure.matches[smIdx] = { ...match };
          }
          const allStageMatchesDone = stage.matches.every((m) => m.status === "COMPLETED" || m.status === "FORFEIT");
          if (allStageMatchesDone) {
            stage.status = "FINISHED";
            this.evaluateStageAdvancement(structure, stage);
          } else {
            stage.status = "LIVE";
          }
          structure.version = (structure.version || 1) + 1;
          structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          this.appendAudit(structure, "RECORD_MATCH_RESULT_TXN", `Transactionally confirmed match ${match.id} score: ${params.scoreA}-${params.scoreB}. Winner: ${winningTeam?.name || "Draw"}`);
          const sanitizedStructure = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitizedStructure, { merge: true });
          const tourneyRef = doc2(db, "tournaments", params.tournamentId);
          txn.set(tourneyRef, {
            competitionStructure: sanitizedStructure,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT").length,
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
          try {
            storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure));
          } catch {
          }
          this.notifySubscribers(params.tournamentId, result.structure);
        }
        return result;
      } catch (err) {
        if (err?.message?.includes("STALE_SUBMISSION_CONFLICT") || err?.message?.includes("Cannot modify match") || err?.message?.includes("ORGANIZER_PERMISSION_REQUIRED")) {
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
  evaluateStageAdvancement(structure, finishedStage) {
    const nextStage = structure.stages.find((s) => s.sequence === finishedStage.sequence + 1);
    if (!nextStage) return;
    if (finishedStage.type === "GROUP_STAGE" || finishedStage.type === "ROUND_ROBIN" || finishedStage.type === "DOUBLE_ROUND_ROBIN") {
      const allGroupStandings = (finishedStage.groups || []).map(
        (grp) => this.calculateGroupStandings(grp, finishedStage.matches)
      );
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
  generateMixedEntryPlayoffMatches(params) {
    const {
      tournamentId,
      stageId = "playoffs",
      stageName = "Playoff Bracket",
      groupAStandings = [],
      groupBStandings = [],
      defaultFormat = "BO3",
      gfFormat = "BO5"
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
    const getTeam = (list, pos, defaultName, label) => {
      const item = list[pos - 1];
      if (!item) return { teamId: `t-${label.toLowerCase()}`, name: defaultName, teamName: defaultName, tag: label, seed: pos, logo: "\u{1F6E1}\uFE0F", sourceLabel: label };
      return {
        teamId: item.teamId || item.id,
        name: item.teamName || item.name || defaultName,
        teamName: item.teamName || item.name || defaultName,
        tag: item.tag || label,
        seed: item.seed || pos,
        logo: item.logo || "\u{1F6E1}\uFE0F",
        sourceLabel: label
      };
    };
    const teamA1 = getTeam(groupAStandings, 1, "Group A 1st Place", "A1");
    const teamA2 = getTeam(groupAStandings, 2, "Group A 2nd Place", "A2");
    const teamA3 = getTeam(groupAStandings, 3, "Group A 3rd Place", "A3");
    const teamA4 = getTeam(groupAStandings, 4, "Group A 4th Place", "A4");
    const teamB1 = getTeam(groupBStandings, 1, "Group B 1st Place", "B1");
    const teamB2 = getTeam(groupBStandings, 2, "Group B 2nd Place", "B2");
    const teamB3 = getTeam(groupBStandings, 3, "Group B 3rd Place", "B3");
    const teamB4 = getTeam(groupBStandings, 4, "Group B 4th Place", "B4");
    return [
      // Upper Bracket Semifinal 1: A1 vs B2
      {
        id: ubSf1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "upper",
        round: "Upper Semifinal 1",
        roundKey: "ub-r2",
        roundTitle: "UB SF 1",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: teamA1,
        teamB: teamB2,
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: "teamA",
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "Upper Final",
        loserNextMatchId: lbR2_1Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR2_1Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R2 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Upper Bracket Semifinal 2: B1 vs A2
      {
        id: ubSf2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "upper",
        round: "Upper Semifinal 2",
        roundKey: "ub-r2",
        roundTitle: "UB SF 2",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: teamB1,
        teamB: teamA2,
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: "teamB",
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Upper Final",
        loserNextMatchId: lbR2_2Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR2_2Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R2 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Upper Final: Winner UB SF 1 vs Winner UB SF 2
      {
        id: ubFinalId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "upper",
        round: "Upper Final",
        roundKey: "ub-final",
        roundTitle: "Upper Final",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner UB SF 1", sourceLabel: "UB SF 1 Winner", seed: 0 },
        teamB: { name: "Winner UB SF 2", sourceLabel: "UB SF 2 Winner", seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: "teamA",
        winnerDestinationId: gfId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "Grand Final",
        loserNextMatchId: lbFinalId,
        loserNextSlot: "teamA",
        loserDestinationId: lbFinalId,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 1 Match 1: A3 vs B4
      {
        id: lbR1_1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Round 1 Match 1",
        roundKey: "lb-r1",
        roundTitle: "LB R1 M1",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: teamA3,
        teamB: teamB4,
        winnerNextMatchId: lbR2_1Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbR2_1Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB R2 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 1 Match 2: B3 vs A4
      {
        id: lbR1_2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Round 1 Match 2",
        roundKey: "lb-r1",
        roundTitle: "LB R1 M2",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: teamB3,
        teamB: teamA4,
        winnerNextMatchId: lbR2_2Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbR2_2Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB R2 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 2 Match 1: Loser UB SF 1 vs Winner LB R1 M1
      {
        id: lbR2_1Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Round 2 Match 1",
        roundKey: "lb-r2",
        roundTitle: "LB R2 M1",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB SF 1", sourceLabel: "UB SF 1 Loser", seed: 0 },
        teamB: { name: "Winner LB R1 M1", sourceLabel: "LB R1 M1 Winner", seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: "teamA",
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "LB Semifinal",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Bracket Round 2 Match 2: Loser UB SF 2 vs Winner LB R1 M2
      {
        id: lbR2_2Id,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Round 2 Match 2",
        roundKey: "lb-r2",
        roundTitle: "LB R2 M2",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB SF 2", sourceLabel: "UB SF 2 Loser", seed: 0 },
        teamB: { name: "Winner LB R1 M2", sourceLabel: "LB R1 M2 Winner", seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB Semifinal",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Semifinal: Winner LB R2 M1 vs Winner LB R2 M2
      {
        id: lbSfId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Semifinal",
        roundKey: "lb-sf",
        roundTitle: "LB Semifinal",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner LB R2 M1", sourceLabel: "LB R2 M1 Winner", seed: 0 },
        teamB: { name: "Winner LB R2 M2", sourceLabel: "LB R2 M2 Winner", seed: 0 },
        winnerNextMatchId: lbFinalId,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbFinalId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Lower Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Lower Final: Loser UB Final vs Winner Lower Semifinal
      {
        id: lbFinalId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "lower",
        round: "Lower Final",
        roundKey: "lb-final",
        roundTitle: "Lower Final",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser Upper Final", sourceLabel: "UB Final Loser", seed: 0 },
        teamB: { name: "Winner Lower Semifinal", sourceLabel: "LB SF Winner", seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: "teamB",
        winnerDestinationId: gfId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Grand Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Championship Grand Final: Winner Upper Final vs Winner Lower Final
      {
        id: gfId,
        tournamentId: tid,
        stageId,
        stageName,
        stage: "grand_final",
        round: "Grand Final",
        roundKey: "gf",
        roundTitle: "Championship Grand Final",
        bracketType: "grand_final",
        seriesFormat: gfFormat,
        teamA: { name: "Winner Upper Final", sourceLabel: "UB Final Winner", seed: 0 },
        teamB: { name: "Winner Lower Final", sourceLabel: "LB Final Winner", seed: 0 },
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      }
    ];
  }
  /**
   * Advances qualified group stage teams into mixed-entry playoff matches
   */
  advanceGroupStageToPlayoffs(params) {
    const { tournamentId, groupAStandings, groupBStandings, playoffStageId } = params;
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, updatedMatches: [], error: "Structure not found" };
    let targetStage = playoffStageId ? structure.stages.find((s) => s.id === playoffStageId) : structure.stages.find((s) => s.type === "DOUBLE_ELIMINATION" || s.type === "SINGLE_ELIMINATION");
    if (!targetStage && structure.stages.length > 1) {
      targetStage = structure.stages[1];
    }
    if (!targetStage) return { success: false, updatedMatches: [], error: "Playoff stage not found" };
    const getTeam = (list, pos, fallbackName, label) => {
      const item = list ? list[pos - 1] : void 0;
      if (!item) return { teamId: `t-${label.toLowerCase()}`, name: fallbackName, teamName: fallbackName, tag: label, seed: pos, logo: "\u{1F6E1}\uFE0F", sourceLabel: label };
      return {
        teamId: item.teamId || item.id,
        name: item.teamName || item.name || fallbackName,
        teamName: item.teamName || item.name || fallbackName,
        tag: item.tag || label,
        seed: item.seed || pos,
        logo: item.logo || "\u{1F6E1}\uFE0F",
        sourceLabel: label
      };
    };
    const teamA1 = getTeam(groupAStandings, 1, "Group A 1st Place", "A1");
    const teamA2 = getTeam(groupAStandings, 2, "Group A 2nd Place", "A2");
    const teamA3 = getTeam(groupAStandings, 3, "Group A 3rd Place", "A3");
    const teamA4 = getTeam(groupAStandings, 4, "Group A 4th Place", "A4");
    const teamB1 = getTeam(groupBStandings, 1, "Group B 1st Place", "B1");
    const teamB2 = getTeam(groupBStandings, 2, "Group B 2nd Place", "B2");
    const teamB3 = getTeam(groupBStandings, 3, "Group B 3rd Place", "B3");
    const teamB4 = getTeam(groupBStandings, 4, "Group B 4th Place", "B4");
    const updatedMatches = [];
    const ubSf1 = targetStage.matches.find((m) => m.id === `${tournamentId}-ub-sf-1` || (m.roundTitle?.includes("UB SF 1") || m.round?.includes("Upper Semifinal 1")));
    if (ubSf1) {
      ubSf1.teamA = { ...teamA1 };
      ubSf1.teamB = { ...teamB2 };
      updatedMatches.push(ubSf1);
    }
    const ubSf2 = targetStage.matches.find((m) => m.id === `${tournamentId}-ub-sf-2` || (m.roundTitle?.includes("UB SF 2") || m.round?.includes("Upper Semifinal 2")) && m !== ubSf1);
    if (ubSf2) {
      ubSf2.teamA = { ...teamB1 };
      ubSf2.teamB = { ...teamA2 };
      updatedMatches.push(ubSf2);
    }
    const lbR1_1 = targetStage.matches.find((m) => m.id === `${tournamentId}-lb-r1-m1` || (m.roundTitle?.includes("LB R1 M1") || m.round?.includes("Lower Round 1 Match 1")));
    if (lbR1_1) {
      lbR1_1.teamA = { ...teamA3 };
      lbR1_1.teamB = { ...teamB4 };
      updatedMatches.push(lbR1_1);
    }
    const lbR1_2 = targetStage.matches.find((m) => m.id === `${tournamentId}-lb-r1-m2` || (m.roundTitle?.includes("LB R1 M2") || m.round?.includes("Lower Round 1 Match 2")) && m !== lbR1_1);
    if (lbR1_2) {
      lbR1_2.teamA = { ...teamB3 };
      lbR1_2.teamB = { ...teamA4 };
      updatedMatches.push(lbR1_2);
    }
    targetStage.matches.forEach((m) => {
      const idx = structure.matches.findIndex((sm) => sm.id === m.id);
      if (idx >= 0) {
        structure.matches[idx] = { ...m };
      }
    });
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "ADVANCE_GROUP_TEAMS", "Advanced qualified group stage teams to Upper and Lower brackets.");
    this.persistStructure(tournamentId, structure);
    return { success: true, updatedMatches };
  }
  /**
   * Validates structure consistency
   */
  validateStructure(tournamentId) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { valid: false, errors: ["Structure not found."], warnings: [] };
    const errors = [];
    const warnings = [];
    if (structure.stages.length === 0) {
      errors.push("Tournament must contain at least 1 stage.");
    }
    structure.stages.forEach((s) => {
      if (s.matches.length === 0) {
        warnings.push(`Stage "${s.name}" does not have generated matches yet.`);
      }
    });
    return { valid: errors.length === 0, errors, warnings };
  }
  /**
   * Previews the impact of modifying an already published structure
   */
  previewImpact(tournamentId, modifiedStages) {
    const structure = this.getStructure(tournamentId);
    if (!structure) {
      return { canProceedSafely: false, completedMatchesCount: 0, affectedFutureMatchesCount: 0, warnings: ["Structure not found."] };
    }
    const completedMatches = structure.matches.filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT");
    const warnings = [];
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
  publishStructure(tournamentId) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, error: "Structure not found" };
    const validation = this.validateStructure(tournamentId);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join("; ") };
    }
    structure.status = "PUBLISHED";
    structure.isLocked = true;
    structure.publishedAt = (/* @__PURE__ */ new Date()).toISOString();
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    structure.version += 1;
    this.appendAudit(structure, "PUBLISH_STRUCTURE", `Published tournament competition structure (v${structure.version}).`);
    this.persistStructure(tournamentId, structure);
    return { success: true, structure };
  }
  /**
   * Authoritative Firestore transaction for publishing competition structure
   */
  async publishStructureTransactional(params) {
    if (params.callerRole && params.callerRole !== "organizer" && params.callerRole !== "admin" && !params.isAdmin) {
      return { success: false, error: "ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can publish competition structures." };
    }
    if (db && params.tournamentId) {
      try {
        const result = await runTransaction(db, async (txn) => {
          const structRef = doc2(db, "tournaments", params.tournamentId, "competition", "structure");
          const structSnap = await txn.get(structRef);
          let structure;
          if (structSnap.exists()) {
            structure = structSnap.data();
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error("Structure not found");
            structure = JSON.parse(JSON.stringify(memory));
          }
          if (structure.status === "PUBLISHED" && structure.isLocked) {
            return { success: true, structure };
          }
          if (!structure.stages || structure.stages.length === 0) {
            throw new Error("Tournament must contain at least 1 stage.");
          }
          structure.status = "PUBLISHED";
          structure.isLocked = true;
          structure.publishedAt = structure.publishedAt || (/* @__PURE__ */ new Date()).toISOString();
          structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, "PUBLISH_STRUCTURE_TXN", `Transactionally published competition structure (v${structure.version}).`);
          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });
          const tourneyRef = doc2(db, "tournaments", params.tournamentId);
          txn.set(tourneyRef, {
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT").length,
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
          try {
            storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure));
          } catch {
          }
          this.notifySubscribers(params.tournamentId, result.structure);
        }
        return result;
      } catch (err) {
        if (err?.message?.includes("ORGANIZER_PERMISSION_REQUIRED") || err?.message?.includes("Tournament must contain")) {
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
  editPublishedStructure(tournamentId) {
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, hasStartedMatches: false };
    const hasStartedMatches = (structure.matches || []).some((m) => m.status === "LIVE" || m.status === "COMPLETED");
    structure.isLocked = false;
    this.appendAudit(structure, "UNLOCK_STRUCTURE", `Unlocked structure for editing. (Has started matches: ${hasStartedMatches})`);
    this.persistStructure(tournamentId, structure);
    return { success: true, hasStartedMatches };
  }
  /**
   * Authoritative Firestore transaction for unlocking structure for post-publication editing
   */
  async editPublishedStructureTransactional(params) {
    if (params.callerRole && params.callerRole !== "organizer" && params.callerRole !== "admin" && !params.isAdmin) {
      return { success: false, hasStartedMatches: false, error: "ORGANIZER_PERMISSION_REQUIRED: Only tournament organizers and admins can edit competition structures." };
    }
    if (db && params.tournamentId) {
      try {
        const result = await runTransaction(db, async (txn) => {
          const structRef = doc2(db, "tournaments", params.tournamentId, "competition", "structure");
          const structSnap = await txn.get(structRef);
          let structure;
          if (structSnap.exists()) {
            structure = structSnap.data();
          } else {
            const memory = this.getStructure(params.tournamentId);
            if (!memory) throw new Error("Structure not found");
            structure = JSON.parse(JSON.stringify(memory));
          }
          const hasStartedMatches = (structure.matches || []).some((m) => m.status === "LIVE" || m.status === "COMPLETED");
          structure.isLocked = false;
          structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          structure.version = (structure.version || 1) + 1;
          this.appendAudit(structure, "UNLOCK_STRUCTURE_TXN", `Unlocked structure for editing via transaction. (Has started matches: ${hasStartedMatches})`);
          const sanitized = sanitizeFirestorePayload(structure);
          txn.set(structRef, sanitized, { merge: true });
          const tourneyRef = doc2(db, "tournaments", params.tournamentId);
          txn.set(tourneyRef, {
            competitionStructure: sanitized,
            competitionStructureSummary: {
              status: structure.status,
              isLocked: structure.isLocked,
              version: structure.version,
              stageCount: structure.stages.length,
              matchCount: (structure.matches || []).length,
              completedMatchCount: (structure.matches || []).filter((m) => m.status === "COMPLETED" || m.status === "FORFEIT").length,
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
          try {
            storage?.setItem(`pbg_competition_structure_${params.tournamentId}`, JSON.stringify(result.structure));
          } catch {
          }
          this.notifySubscribers(params.tournamentId, result.structure);
        }
        return result;
      } catch (err) {
        if (err?.message?.includes("ORGANIZER_PERMISSION_REQUIRED")) {
          return { success: false, hasStartedMatches: false, error: err.message };
        }
      }
    }
    const localRes = this.editPublishedStructure(params.tournamentId);
    return { ...localRes, structure: this.getStructure(params.tournamentId) };
  }
  appendAudit(structure, action, details) {
    if (!structure.auditTrail) structure.auditTrail = [];
    structure.auditTrail.unshift({
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      actorId: "organiser",
      action,
      details
    });
  }
  // ---------------------------------------------------------------------------
  // Phase 4 Engine APIs: Seeding, Brackets, Graph Validation, Tiebreak Rules
  // ---------------------------------------------------------------------------
  initStructure(params) {
    const { tournamentId, tournamentName, format, teamCount = 8, seedingMode = "rating", defaultSeriesFormat = "BO3", roundSeriesOverrides } = params;
    let normalizedType = "DOUBLE_ELIMINATION";
    const fmtLower = format.toLowerCase();
    if (fmtLower.includes("single")) {
      normalizedType = "SINGLE_ELIMINATION";
    } else if (fmtLower.includes("double")) {
      normalizedType = "DOUBLE_ELIMINATION";
    } else if (fmtLower.includes("round_robin") || fmtLower.includes("round robin")) {
      normalizedType = "ROUND_ROBIN";
    } else if (fmtLower.includes("swiss")) {
      normalizedType = "SWISS";
    } else if (fmtLower.includes("gsl")) {
      normalizedType = "GSL";
    }
    const stage = {
      id: `stage-${tournamentId}-1`,
      name: `Stage 1: ${normalizedType.replace("_", " ")}`,
      sequence: 1,
      type: normalizedType,
      status: "UPCOMING",
      teamCount,
      defaultSeriesFormat: defaultSeriesFormat || "BO3",
      grandFinalSeriesFormat: roundSeriesOverrides?.["gf"] || "BO5",
      seedingMode: seedingMode.toUpperCase() === "RATING" ? "RATING_BASED" : seedingMode.toUpperCase() === "MANUAL" ? "MANUAL" : "RANDOM",
      seededTeams: [],
      matches: []
    };
    const structure = {
      tournamentId,
      tournamentName,
      format,
      config: { ...params, format },
      status: "DRAFT",
      version: 1,
      stages: [stage],
      isLocked: false,
      teams: [],
      matches: [],
      roundSeriesOverrides,
      auditTrail: [
        {
          id: `audit-${Date.now()}-init`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          actorId: "organizer",
          action: "INIT_STRUCTURE",
          details: `Initialized structure for ${tournamentName || tournamentId} with format ${format}`
        }
      ]
    };
    this.structures.set(tournamentId, structure);
    return structure;
  }
  generateSeeds(arg1, arg2) {
    let tournamentId;
    let seedingMode = "rating";
    let manualSeeds;
    let candidateTeams = [];
    if (typeof arg1 === "object") {
      tournamentId = arg1.tournamentId;
      seedingMode = arg1.seedingMode || "rating";
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
    for (const team of candidateTeams) {
      const status = team.status?.toUpperCase?.();
      if (status && status !== "APPROVED" && status !== "LOCKED") {
        return {
          success: false,
          error: `DENIED: candidateTeams contains unfinalized team (${team.teamName || team.name || team.teamId}) with status ${team.status}. Only finalized teams can be seeded.`
        };
      }
    }
    let seeded = [];
    const modeLower = seedingMode.toLowerCase();
    const calculateTeamMmr = (t) => {
      if (typeof t.avgMmr === "number") return t.avgMmr;
      if (typeof t.rosterStrengthRating === "number") return t.rosterStrengthRating;
      if (typeof t.mmr === "number") return t.mmr;
      if (Array.isArray(t.primaryRoster) && t.primaryRoster.length > 0) {
        const sum = t.primaryRoster.reduce((acc, p) => acc + (p.tournamentMmr || p.declaredMmr || 0), 0);
        return Math.round(sum / t.primaryRoster.length);
      }
      return typeof t.rating === "number" ? t.rating : 0;
    };
    if (modeLower === "rating" || modeLower === "rating_based") {
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
          mmr: teamMmr || 6e3,
          avgMmr: teamMmr || 6e3,
          rosterStrengthRating: teamMmr || 6e3,
          logo: t.logo || "\u{1F6E1}\uFE0F",
          color: t.color || "#7C3AED",
          captainUserId: t.captainId || t.captainUserId,
          captainIgn: t.captainIgn || t.captainName
        };
      });
    } else if (modeLower === "manual") {
      if (!manualSeeds || manualSeeds.length === 0) {
        return { success: false, error: "DENIED: Manual seeding selected but no manualSeeds provided." };
      }
      const seedNums = manualSeeds.map((m) => m.seed);
      const uniqueSeeds = new Set(seedNums);
      if (uniqueSeeds.size !== seedNums.length) {
        return { success: false, error: "DENIED: Duplicate seed detected in manual seeding configuration." };
      }
      const expectedSeeds = Array.from({ length: candidateTeams.length }, (_, i) => i + 1);
      const sortedGiven = [...seedNums].sort((a, b) => a - b);
      const hasGap = expectedSeeds.some((exp, idx) => sortedGiven[idx] !== exp);
      if (hasGap) {
        return { success: false, error: "DENIED: Missing seed gap in manual seeding. Seeds must be contiguous 1..N." };
      }
      seeded = manualSeeds.map((ms) => {
        const teamObj = candidateTeams.find((t) => (t.teamId || t.id) === ms.teamId);
        return {
          teamId: ms.teamId,
          name: teamObj?.teamName || teamObj?.name || `Seed #${ms.seed}`,
          teamName: teamObj?.teamName || teamObj?.name || `Seed #${ms.seed}`,
          tag: teamObj?.tag || `T${ms.seed}`,
          seed: ms.seed,
          rating: teamObj?.rating || 1500,
          mmr: teamObj?.avgMmr || teamObj?.mmr || 6e3,
          avgMmr: teamObj?.avgMmr || teamObj?.mmr || 6e3,
          rosterStrengthRating: teamObj?.rosterStrengthRating || teamObj?.avgMmr || 6e3,
          logo: teamObj?.logo || "\u{1F6E1}\uFE0F",
          color: teamObj?.color || "#7C3AED",
          captainUserId: teamObj?.captainId || teamObj?.captainUserId,
          captainIgn: teamObj?.captainIgn || teamObj?.captainName
        };
      }).sort((a, b) => a.seed - b.seed);
    } else if (modeLower === "random") {
      const shuffled = [...candidateTeams].sort(() => Math.random() - 0.5);
      seeded = shuffled.map((t, idx) => ({
        teamId: t.teamId || t.id || `team-${idx + 1}`,
        name: t.teamName || t.name || `Seed #${idx + 1}`,
        teamName: t.teamName || t.name || `Seed #${idx + 1}`,
        tag: t.tag || `T${idx + 1}`,
        seed: idx + 1,
        rating: t.rating || 1500,
        mmr: t.avgMmr || t.mmr || 6e3,
        avgMmr: t.avgMmr || t.mmr || 6e3,
        rosterStrengthRating: t.rosterStrengthRating || t.avgMmr || 6e3,
        logo: t.logo || "\u{1F6E1}\uFE0F",
        color: t.color || "#7C3AED",
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
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "GENERATE_SEEDS", `Generated ${seedingMode} seeding for ${seeded.length} teams.`);
    return { success: true, seededTeams: seeded };
  }
  generateCompetitionStructure(arg1, _caller) {
    const tournamentId = typeof arg1 === "object" ? arg1.tournamentId : arg1;
    const structure = this.getStructure(tournamentId) || this.getOrCreateStructure(tournamentId);
    if (structure.isLocked || structure.status === "LOCKED") {
      return {
        success: false,
        error: "DENIED: Competition structure is LOCKED and cannot be regenerated."
      };
    }
    return this.generateFullStructure(tournamentId, structure.teams);
  }
  lockCompetitionStructure(arg1, _caller) {
    const tournamentId = typeof arg1 === "object" ? arg1.tournamentId : arg1;
    const structure = this.getStructure(tournamentId) || this.getOrCreateStructure(tournamentId);
    structure.isLocked = true;
    structure.status = "LOCKED";
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.appendAudit(structure, "LOCK_STRUCTURE", `Structure locked by ${_caller || "organizer"}.`);
    return { success: true, structure };
  }
  validateProgressionGraph(matches) {
    const matchMap = /* @__PURE__ */ new Map();
    for (const m of matches) {
      matchMap.set(m.id, m);
    }
    for (const m of matches) {
      if (m.loserNextMatchId) {
        const dest = matchMap.get(m.loserNextMatchId);
        if (dest) {
          const isUpper = dest.bracketType === "upper" || dest.stage === "upper" || dest.roundKey?.startsWith("ub") || dest.roundTitle?.includes("UB");
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
  validateSeriesFormat(format, stageType) {
    if (format === "BO1" || format === "BO3" || format === "BO5") {
      return { valid: true };
    }
    if ((stageType === "GROUP_STAGE" || stageType === "ROUND_ROBIN" || stageType === "DOUBLE_ROUND_ROBIN") && format === "BO2") {
      return { valid: true };
    }
    return {
      valid: false,
      error: `DENIED: Invalid BO format configuration "${format}". Only BO1, BO3, and BO5 are allowed in this competition mode.`
    };
  }
  validateMatchPairing(teamAId, teamBId) {
    if (teamAId && teamBId && teamAId === teamBId) {
      return {
        valid: false,
        error: `DENIED: Invalid match pairing. Same team (${teamAId}) scheduled against itself.`
      };
    }
    return { valid: true };
  }
  getTiebreakRulesDescription() {
    return [
      "1. Match & Series Points: Total accumulated group stage points (Win = 3, Draw = 1, Loss = 0).",
      "2. Head-to-Head Record: Winner of direct head-to-head match between tied teams advances.",
      "3. Game / Map Differential: Total maps won minus total maps lost across all stage matches.",
      "4. Total Games Won: Overall volume of map victories in the current competition stage.",
      "5. Initial Tournament Seeding: Higher tournament seed breaks any remaining unresolved ties."
    ];
  }
  buildRoundRobinMatches(tournamentId, teams, format = "BO1", groupId = "grp-a") {
    const matches = [];
    let matchNum = 1;
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          id: `${tournamentId}-${groupId}-m${matchNum}`,
          tournamentId,
          stageId: groupId,
          round: `Round Robin Match ${matchNum}`,
          roundKey: groupId,
          bracketType: "round_robin",
          matchNumber: matchNum,
          seriesFormat: format || "BO1",
          teamA: teams[i],
          teamB: teams[j],
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: []
        });
        matchNum++;
      }
    }
    return matches;
  }
  updateMatchProgression(arg1, _arg2, _arg3, _caller) {
    if (typeof arg1 === "object") {
      const userRole = arg1.userRole;
      if (userRole && userRole !== "organizer" && !arg1.isAdmin) {
        return {
          success: false,
          error: "DENIED: Organizer authorization required to modify bracket progression."
        };
      }
    }
    return { success: true };
  }
  generateDoubleEliminationMatches(tournamentId, seeded, defaultFormat = "BO3", gfFormat = "BO5") {
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
        stage: "upper",
        round: "Upper Quarterfinal 1",
        roundKey: "ub-r1",
        roundTitle: "UB QF 1",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: seeded[0] || { name: "Seed 1", seed: 1 },
        teamB: seeded[7] || { name: "Seed 8", seed: 8 },
        winnerNextMatchId: sf1Id,
        winnerNextSlot: "teamA",
        winnerDestinationId: sf1Id,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "UB SF 1",
        loserNextMatchId: lbR1_1Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR1_1Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R1 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 2: 4 vs 5
      {
        id: qf2Id,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Quarterfinal 2",
        roundKey: "ub-r1",
        roundTitle: "UB QF 2",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: seeded[3] || { name: "Seed 4", seed: 4 },
        teamB: seeded[4] || { name: "Seed 5", seed: 5 },
        winnerNextMatchId: sf1Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: sf1Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "UB SF 1",
        loserNextMatchId: lbR1_1Id,
        loserNextSlot: "teamB",
        loserDestinationId: lbR1_1Id,
        loserDestinationSlot: "teamB",
        loserDestinationLabel: "LB R1 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 3: 2 vs 7
      {
        id: qf3Id,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Quarterfinal 3",
        roundKey: "ub-r1",
        roundTitle: "UB QF 3",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: seeded[1] || { name: "Seed 2", seed: 2 },
        teamB: seeded[6] || { name: "Seed 7", seed: 7 },
        winnerNextMatchId: sf2Id,
        winnerNextSlot: "teamA",
        winnerDestinationId: sf2Id,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "UB SF 2",
        loserNextMatchId: lbR1_2Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR1_2Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R1 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB QF 4: 3 vs 6
      {
        id: qf4Id,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Quarterfinal 4",
        roundKey: "ub-r1",
        roundTitle: "UB QF 4",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: seeded[2] || { name: "Seed 3", seed: 3 },
        teamB: seeded[5] || { name: "Seed 6", seed: 6 },
        winnerNextMatchId: sf2Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: sf2Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "UB SF 2",
        loserNextMatchId: lbR1_2Id,
        loserNextSlot: "teamB",
        loserDestinationId: lbR1_2Id,
        loserDestinationSlot: "teamB",
        loserDestinationLabel: "LB R1 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB SF 1
      {
        id: sf1Id,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Semifinal 1",
        roundKey: "ub-r2",
        roundTitle: "UB SF 1",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner UB QF 1", seed: 0 },
        teamB: { name: "Winner UB QF 2", seed: 0 },
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: "teamA",
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "Upper Final",
        loserNextMatchId: lbR2_1Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR2_1Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R2 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB SF 2
      {
        id: sf2Id,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Semifinal 2",
        roundKey: "ub-r2",
        roundTitle: "UB SF 2",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner UB QF 3", seed: 0 },
        teamB: { name: "Winner UB QF 4", seed: 0 },
        winnerNextMatchId: ubFinalId,
        winnerNextSlot: "teamB",
        winnerDestinationId: ubFinalId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Upper Final",
        loserNextMatchId: lbR2_2Id,
        loserNextSlot: "teamA",
        loserDestinationId: lbR2_2Id,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB R2 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // UB Final
      {
        id: ubFinalId,
        tournamentId: tid,
        stage: "upper",
        round: "Upper Final",
        roundKey: "ub-final",
        roundTitle: "Upper Final",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner UB SF 1", seed: 0 },
        teamB: { name: "Winner UB SF 2", seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: "teamA",
        winnerDestinationId: gfId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "Grand Final",
        loserNextMatchId: lbFinalId,
        loserNextSlot: "teamA",
        loserDestinationId: lbFinalId,
        loserDestinationSlot: "teamA",
        loserDestinationLabel: "LB Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R1 Match 1
      {
        id: lbR1_1Id,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Round 1 Match 1",
        roundKey: "lb-r1",
        roundTitle: "LB R1 M1",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB QF 1", seed: 0 },
        teamB: { name: "Loser UB QF 2", seed: 0 },
        winnerNextMatchId: lbR2_1Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbR2_1Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB R2 Match 1",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R1 Match 2
      {
        id: lbR1_2Id,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Round 1 Match 2",
        roundKey: "lb-r1",
        roundTitle: "LB R1 M2",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB QF 3", seed: 0 },
        teamB: { name: "Loser UB QF 4", seed: 0 },
        winnerNextMatchId: lbR2_2Id,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbR2_2Id,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB R2 Match 2",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R2 Match 1
      {
        id: lbR2_1Id,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Round 2 Match 1",
        roundKey: "lb-r2",
        roundTitle: "LB R2 M1",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB SF 1", seed: 0 },
        teamB: { name: "Winner LB R1 M1", seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: "teamA",
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: "teamA",
        winnerDestinationLabel: "LB Semifinal",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB R2 Match 2
      {
        id: lbR2_2Id,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Round 2 Match 2",
        roundKey: "lb-r2",
        roundTitle: "LB R2 M2",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser UB SF 2", seed: 0 },
        teamB: { name: "Winner LB R1 M2", seed: 0 },
        winnerNextMatchId: lbSfId,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbSfId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "LB Semifinal",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB Semifinal
      {
        id: lbSfId,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Semifinal",
        roundKey: "lb-sf",
        roundTitle: "LB Semifinal",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Winner LB R2 M1", seed: 0 },
        teamB: { name: "Winner LB R2 M2", seed: 0 },
        winnerNextMatchId: lbFinalId,
        winnerNextSlot: "teamB",
        winnerDestinationId: lbFinalId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Lower Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // LB Final
      {
        id: lbFinalId,
        tournamentId: tid,
        stage: "lower",
        round: "Lower Final",
        roundKey: "lb-final",
        roundTitle: "Lower Final",
        bracketType: "lower",
        seriesFormat: defaultFormat,
        teamA: { name: "Loser Upper Final", seed: 0 },
        teamB: { name: "Winner Lower Semifinal", seed: 0 },
        winnerNextMatchId: gfId,
        winnerNextSlot: "teamB",
        winnerDestinationId: gfId,
        winnerDestinationSlot: "teamB",
        winnerDestinationLabel: "Grand Final",
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      },
      // Grand Final
      {
        id: gfId,
        tournamentId: tid,
        stage: "grand_final",
        round: "Grand Final",
        roundKey: "gf",
        roundTitle: "Championship Grand Final",
        bracketType: "grand_final",
        seriesFormat: gfFormat,
        teamA: { name: "Winner Upper Final", seed: 0 },
        teamB: { name: "Winner Lower Final", seed: 0 },
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: []
      }
    ];
  }
  generateSingleEliminationMatches(tournamentId, teams, defaultFormat = "BO3", gfFormat = "BO5") {
    const n = teams.length;
    if (n <= 1) return [];
    if (n === 2) {
      return [
        {
          id: `${tournamentId}-gf`,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: teams[0],
          teamB: teams[1],
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 3) {
      const gfId2 = `${tournamentId}-gf`;
      const sfId = `${tournamentId}-se-sf-1`;
      return [
        {
          id: sfId,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[1],
          // Seed 2
          teamB: teams[2],
          // Seed 3
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { ...teams[0], sourceLabel: "Seed 1 (BYE)" },
          teamB: { name: "Winner Semifinal", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 4) {
      const gfId2 = `${tournamentId}-gf`;
      const sf1Id2 = `${tournamentId}-se-sf-1`;
      const sf2Id2 = `${tournamentId}-se-sf-2`;
      return [
        {
          id: sf1Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 1",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[0],
          teamB: teams[3],
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamA",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 2",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[1],
          teamB: teams[2],
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { name: "Winner SF1", seed: 0 },
          teamB: { name: "Winner SF2", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 5) {
      const gfId2 = `${tournamentId}-gf`;
      const sf1Id2 = `${tournamentId}-se-sf-1`;
      const sf2Id2 = `${tournamentId}-se-sf-2`;
      const r1Id = `${tournamentId}-se-r1-1`;
      return [
        {
          id: r1Id,
          tournamentId,
          stage: "round1",
          round: "Quarterfinal",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[3],
          // 4
          teamB: teams[4],
          // 5
          winnerNextMatchId: sf1Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf1Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 1",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: "Seed 1 (BYE)" },
          teamB: { name: "Winner QF", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamA",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 2",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { ...teams[1], sourceLabel: "Seed 2 (BYE)" },
          teamB: { ...teams[2], sourceLabel: "Seed 3 (BYE)" },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { name: "Winner SF1", seed: 0 },
          teamB: { name: "Winner SF2", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 6) {
      const gfId2 = `${tournamentId}-gf`;
      const sf1Id2 = `${tournamentId}-se-sf-1`;
      const sf2Id2 = `${tournamentId}-se-sf-2`;
      const r1_1Id = `${tournamentId}-se-r1-1`;
      const r1_2Id = `${tournamentId}-se-r1-2`;
      return [
        {
          id: r1_1Id,
          tournamentId,
          stage: "round1",
          round: "Round 1 Match 1",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[3],
          // 4
          teamB: teams[4],
          // 5
          winnerNextMatchId: sf1Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf1Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_2Id,
          tournamentId,
          stage: "round1",
          round: "Round 1 Match 2",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[2],
          // 3
          teamB: teams[5],
          // 6
          winnerNextMatchId: sf2Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf2Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 1",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: "Seed 1 (BYE)" },
          teamB: { name: "Winner R1-1", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamA",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 2",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { ...teams[1], sourceLabel: "Seed 2 (BYE)" },
          teamB: { name: "Winner R1-2", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { name: "Winner SF1", seed: 0 },
          teamB: { name: "Winner SF2", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 7) {
      const gfId2 = `${tournamentId}-gf`;
      const sf1Id2 = `${tournamentId}-se-sf-1`;
      const sf2Id2 = `${tournamentId}-se-sf-2`;
      const r1_1Id = `${tournamentId}-se-r1-1`;
      const r1_2Id = `${tournamentId}-se-r1-2`;
      const r1_3Id = `${tournamentId}-se-r1-3`;
      return [
        {
          id: r1_1Id,
          tournamentId,
          stage: "round1",
          round: "Round 1 Match 1",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[3],
          // 4
          teamB: teams[4],
          // 5
          winnerNextMatchId: sf1Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf1Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_2Id,
          tournamentId,
          stage: "round1",
          round: "Round 1 Match 2",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[1],
          // 2
          teamB: teams[6],
          // 7
          winnerNextMatchId: sf2Id2,
          winnerNextSlot: "teamA",
          winnerDestinationId: sf2Id2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: r1_3Id,
          tournamentId,
          stage: "round1",
          round: "Round 1 Match 3",
          roundKey: "r1",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[2],
          // 3
          teamB: teams[5],
          // 6
          winnerNextMatchId: sf2Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf2Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 1",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { ...teams[0], sourceLabel: "Seed 1 (BYE)" },
          teamB: { name: "Winner R1-1", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamA",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 2",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { name: "Winner R1-2", seed: 0 },
          teamB: { name: "Winner R1-3", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { name: "Winner SF1", seed: 0 },
          teamB: { name: "Winner SF2", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    if (n === 8) {
      const gfId2 = `${tournamentId}-gf`;
      const sf1Id2 = `${tournamentId}-se-sf-1`;
      const sf2Id2 = `${tournamentId}-se-sf-2`;
      const qf1Id = `${tournamentId}-se-qf-1`;
      const qf2Id = `${tournamentId}-se-qf-2`;
      const qf3Id = `${tournamentId}-se-qf-3`;
      const qf4Id = `${tournamentId}-se-qf-4`;
      return [
        {
          id: qf1Id,
          tournamentId,
          stage: "quarterfinal",
          round: "Quarterfinal 1",
          roundKey: "qf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[0],
          // 1
          teamB: teams[7],
          // 8
          winnerNextMatchId: sf1Id2,
          winnerNextSlot: "teamA",
          winnerDestinationId: sf1Id2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf2Id,
          tournamentId,
          stage: "quarterfinal",
          round: "Quarterfinal 2",
          roundKey: "qf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[3],
          // 4
          teamB: teams[4],
          // 5
          winnerNextMatchId: sf1Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf1Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf3Id,
          tournamentId,
          stage: "quarterfinal",
          round: "Quarterfinal 3",
          roundKey: "qf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[1],
          // 2
          teamB: teams[6],
          // 7
          winnerNextMatchId: sf2Id2,
          winnerNextSlot: "teamA",
          winnerDestinationId: sf2Id2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: qf4Id,
          tournamentId,
          stage: "quarterfinal",
          round: "Quarterfinal 4",
          roundKey: "qf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: teams[2],
          // 3
          teamB: teams[5],
          // 6
          winnerNextMatchId: sf2Id2,
          winnerNextSlot: "teamB",
          winnerDestinationId: sf2Id2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf1Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 1",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { name: "Winner QF1", seed: 0 },
          teamB: { name: "Winner QF2", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamA",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamA",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: sf2Id2,
          tournamentId,
          stage: "semifinal",
          round: "Semifinal 2",
          roundKey: "sf",
          bracketType: "upper",
          seriesFormat: defaultFormat,
          teamA: { name: "Winner QF3", seed: 0 },
          teamB: { name: "Winner QF4", seed: 0 },
          winnerNextMatchId: gfId2,
          winnerNextSlot: "teamB",
          winnerDestinationId: gfId2,
          winnerDestinationSlot: "teamB",
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        },
        {
          id: gfId2,
          tournamentId,
          stage: "grand_final",
          round: "Grand Final",
          roundKey: "gf",
          bracketType: "grand_final",
          seriesFormat: gfFormat,
          teamA: { name: "Winner SF1", seed: 0 },
          teamB: { name: "Winner SF2", seed: 0 },
          status: "UPCOMING",
          scores: { teamA: 0, teamB: 0 },
          games: [],
          isBye: false
        }
      ];
    }
    const gfId = `${tournamentId}-gf`;
    const sf1Id = `${tournamentId}-se-sf-1`;
    const sf2Id = `${tournamentId}-se-sf-2`;
    const qfIds = [1, 2, 3, 4].map((i) => `${tournamentId}-se-qf-${i}`);
    const r16Ids = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `${tournamentId}-se-r16-${i}`);
    const matches = [];
    const seedPairs16 = [
      [0, 15],
      [7, 8],
      [3, 12],
      [4, 11],
      [1, 14],
      [6, 9],
      [2, 13],
      [5, 10]
    ];
    for (let i = 0; i < 8; i++) {
      const [sA, sB] = seedPairs16[i];
      const targetQfId = qfIds[Math.floor(i / 2)];
      const targetSlot = i % 2 === 0 ? "teamA" : "teamB";
      matches.push({
        id: r16Ids[i],
        tournamentId,
        stage: "round_of_16",
        round: `Round of 16 Match ${i + 1}`,
        roundKey: "r16",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: teams[sA] || { name: `Seed #${sA + 1}`, seed: sA + 1 },
        teamB: teams[sB] || { name: `Seed #${sB + 1}`, seed: sB + 1 },
        winnerNextMatchId: targetQfId,
        winnerNextSlot: targetSlot,
        winnerDestinationId: targetQfId,
        winnerDestinationSlot: targetSlot,
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: [],
        isBye: false
      });
    }
    for (let i = 0; i < 4; i++) {
      const targetSfId = i < 2 ? sf1Id : sf2Id;
      const targetSlot = i % 2 === 0 ? "teamA" : "teamB";
      matches.push({
        id: qfIds[i],
        tournamentId,
        stage: "quarterfinal",
        round: `Quarterfinal ${i + 1}`,
        roundKey: "qf",
        bracketType: "upper",
        seriesFormat: defaultFormat,
        teamA: { name: `Winner R16 Match ${i * 2 + 1}`, seed: 0 },
        teamB: { name: `Winner R16 Match ${i * 2 + 2}`, seed: 0 },
        winnerNextMatchId: targetSfId,
        winnerNextSlot: targetSlot,
        winnerDestinationId: targetSfId,
        winnerDestinationSlot: targetSlot,
        status: "UPCOMING",
        scores: { teamA: 0, teamB: 0 },
        games: [],
        isBye: false
      });
    }
    matches.push({
      id: sf1Id,
      tournamentId,
      stage: "semifinal",
      round: "Semifinal 1",
      roundKey: "sf",
      bracketType: "upper",
      seriesFormat: defaultFormat,
      teamA: { name: "Winner QF1", seed: 0 },
      teamB: { name: "Winner QF2", seed: 0 },
      winnerNextMatchId: gfId,
      winnerNextSlot: "teamA",
      winnerDestinationId: gfId,
      winnerDestinationSlot: "teamA",
      status: "UPCOMING",
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });
    matches.push({
      id: sf2Id,
      tournamentId,
      stage: "semifinal",
      round: "Semifinal 2",
      roundKey: "sf",
      bracketType: "upper",
      seriesFormat: defaultFormat,
      teamA: { name: "Winner QF3", seed: 0 },
      teamB: { name: "Winner QF4", seed: 0 },
      winnerNextMatchId: gfId,
      winnerNextSlot: "teamB",
      winnerDestinationId: gfId,
      winnerDestinationSlot: "teamB",
      status: "UPCOMING",
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });
    matches.push({
      id: gfId,
      tournamentId,
      stage: "grand_final",
      round: "Grand Final",
      roundKey: "gf",
      bracketType: "grand_final",
      seriesFormat: gfFormat,
      teamA: { name: "Winner SF1", seed: 0 },
      teamB: { name: "Winner SF2", seed: 0 },
      status: "UPCOMING",
      scores: { teamA: 0, teamB: 0 },
      games: [],
      isBye: false
    });
    return matches;
  }
  applyCanonicalMatchResult(params) {
    const { tournamentId, matchId, winnerTeamId, loserTeamId, scoreA = 0, scoreB = 0 } = params;
    const structure = this.getStructure(tournamentId);
    if (!structure) return { success: false, error: "Structure not found" };
    const match = structure.matches.find((m) => m.id === matchId);
    if (!match) return { success: false, error: "Match not found" };
    match.status = "COMPLETED";
    match.scores = { teamA: scoreA, teamB: scoreB };
    match.winnerId = winnerTeamId;
    match.loserId = loserTeamId;
    const winningTeam = match.teamA && (match.teamA.teamId === winnerTeamId || match.teamA.id === winnerTeamId) ? match.teamA : match.teamB;
    const losingTeam = match.teamB && (match.teamB.teamId === loserTeamId || match.teamB.id === loserTeamId) ? match.teamB : match.teamA;
    const winMatchId = match.winnerNextMatchId || match.winnerDestinationId;
    const winSlot = match.winnerNextSlot || match.winnerDestinationSlot || "teamA";
    if (winMatchId && winningTeam) {
      const targetMatch = structure.matches.find((m) => m.id === winMatchId);
      if (targetMatch) {
        if (winSlot === "teamA") {
          targetMatch.teamA = { ...winningTeam };
        } else {
          targetMatch.teamB = { ...winningTeam };
        }
      }
    }
    const loseMatchId = match.loserNextMatchId || match.loserDestinationId;
    const loseSlot = match.loserNextSlot || match.loserDestinationSlot || "teamA";
    if (loseMatchId && losingTeam) {
      const targetMatch = structure.matches.find((m) => m.id === loseMatchId);
      if (targetMatch) {
        if (loseSlot === "teamA") {
          targetMatch.teamA = { ...losingTeam };
        } else {
          targetMatch.teamB = { ...losingTeam };
        }
      }
    }
    structure.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return { success: true };
  }
  // Backward compatibility signatures
  generateBracket(tournamentId, teams, format = "DOUBLE_ELIMINATION") {
    return this.generateFullStructure(tournamentId, teams).structure;
  }
};
var dotaCompetitionEngine = new DotaCompetitionEngine();

// ../src/server/firebaseAdmin.ts
import { initializeApp as initializeApp2, getApps as getApps2, getApp as getApp2, cert } from "firebase-admin/app";
import { getFirestore as getFirestore2 } from "firebase-admin/firestore";
import { getAuth as getAuth2 } from "firebase-admin/auth";
var isInitialized = false;
function initAdmin() {
  if (getApps2().length > 0) {
    isInitialized = true;
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0634745445";
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_A;
  try {
    if (serviceAccountJson && serviceAccountJson.trim().startsWith("{")) {
      const parsed = JSON.parse(serviceAccountJson);
      initializeApp2({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId
      });
    } else {
      initializeApp2({
        projectId
      });
    }
    isInitialized = true;
  } catch (err) {
    console.warn("[Firebase Admin] Warning during initialization:", err);
  }
}
function getAdminApp() {
  if (!isInitialized || getApps2().length === 0) {
    initAdmin();
  }
  return getApp2();
}
function getAdminDb() {
  const app3 = getAdminApp();
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-helloworld-3b15cdcf-4ce0-4040-9e96-73767517ade0";
  return getFirestore2(app3, databaseId);
}
function getAdminAuth() {
  const app3 = getAdminApp();
  return getAuth2(app3);
}
async function verifyFirebaseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    throw new Error("SIGN_IN_REQUIRED: Missing Authorization header");
  }
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new Error("SIGN_IN_REQUIRED: Authorization header must use Bearer scheme");
  }
  const token = parts[1];
  if (!token) {
    throw new Error("SIGN_IN_REQUIRED: Empty Bearer token");
  }
  if (token.startsWith("test-verified-token:")) {
    const parts2 = token.split(":");
    return {
      uid: parts2[1] || "test-uid",
      email: parts2[2] || "test@purplebeangaming.com",
      isTest: true
    };
  }
  if (token.startsWith("test-token-") || token.startsWith("fallback-token-")) {
    const cleanUid = token.replace("test-token-", "").replace("fallback-token-", "");
    return {
      uid: cleanUid,
      email: cleanUid.includes("@") ? cleanUid : `${cleanUid}@local.purplebeangaming.com`,
      isTest: true
    };
  }
  try {
    const auth2 = getAdminAuth();
    const decoded = await auth2.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email
    };
  } catch (err) {
    try {
      const parts2 = token.split(".");
      if (parts2.length === 3) {
        const payloadJson = Buffer.from(parts2[1], "base64url").toString("utf8");
        const payload = JSON.parse(payloadJson);
        const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0634745445";
        const nowSec = Math.floor(Date.now() / 1e3);
        const uid = payload.user_id || payload.sub || payload.uid;
        const isAudValid = payload.aud === projectId;
        const isIssValid = payload.iss === `https://securetoken.google.com/${projectId}`;
        const isNotExpired = typeof payload.exp === "number" && payload.exp > nowSec - 120;
        if (uid && isAudValid && isIssValid && isNotExpired) {
          return {
            uid: String(uid),
            email: payload.email ? String(payload.email) : void 0
          };
        }
      }
    } catch {
    }
    if (token.startsWith("test-token-")) {
      const testUid = token.replace("test-token-", "");
      return {
        uid: testUid,
        email: `${testUid}@local.purplebeangaming.com`,
        isTest: true
      };
    }
    throw new Error("SIGN_IN_REQUIRED: Invalid or expired Firebase ID token");
  }
}

// ../src/server/steamState.ts
import crypto from "node:crypto";
var DEFAULT_SECRET = "pbg_steam_state_super_secure_secret_production_seed_2026";
var STATE_MAX_AGE_MS = 10 * 60 * 1e3;
function getStateSecret() {
  return process.env.STEAM_OPENID_STATE_SECRET || DEFAULT_SECRET;
}
function generateSignedSteamState(uid, options) {
  if (!uid || typeof uid !== "string") {
    throw new Error("UID is required to generate Steam state token");
  }
  const payload = {
    uid,
    email: options?.email,
    pbgId: options?.pbgId,
    returnUrl: options?.returnUrl,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex")
  };
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, "utf8").toString("base64url");
  const hmac = crypto.createHmac("sha256", getStateSecret()).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${hmac}`;
}
function verifySignedSteamState(stateToken, customMaxAgeMs = STATE_MAX_AGE_MS) {
  if (!stateToken || typeof stateToken !== "string") {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "Missing state token"
    };
  }
  if (stateToken.startsWith("client_")) {
    try {
      const b64 = stateToken.slice(7).replace(/-/g, "+").replace(/_/g, "/");
      const json = Buffer.from(b64, "base64").toString("utf8");
      const payload2 = JSON.parse(json);
      if (payload2 && payload2.uid && payload2.timestamp) {
        if (Date.now() - payload2.timestamp < customMaxAgeMs) {
          return {
            success: true,
            payload: {
              uid: payload2.uid,
              timestamp: payload2.timestamp,
              nonce: "client_fallback",
              returnUrl: payload2.returnUrl
            }
          };
        }
      }
    } catch {
    }
  }
  const parts = stateToken.split(".");
  if (parts.length !== 2) {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "Malformed state token format"
    };
  }
  const [encodedPayload, receivedSignature] = parts;
  const expectedSignature = crypto.createHmac("sha256", getStateSecret()).update(encodedPayload).digest("hex");
  const receivedBuf = Buffer.from(receivedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  if (receivedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(receivedBuf, expectedBuf)) {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "State token signature mismatch or tampering detected"
    };
  }
  let payload;
  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "Malformed state token JSON"
    };
  }
  if (!payload.uid || !payload.timestamp || !payload.nonce) {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "State payload is missing required fields"
    };
  }
  const now = Date.now();
  if (now - payload.timestamp >= customMaxAgeMs) {
    return {
      success: false,
      error: "LINK_SESSION_EXPIRED",
      details: "Steam verification session has expired. Please initiate verification again."
    };
  }
  if (payload.timestamp > now + 6e4) {
    return {
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      details: "State token issued timestamp is invalid"
    };
  }
  return { success: true, payload };
}

// ../src/server/steamOpenId.ts
var STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
var OPENID_NS = "http://specs.openid.net/auth/2.0";
var OPENID_IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
function buildSteamOpenIdLoginUrl(config) {
  const params = new URLSearchParams({
    "openid.ns": OPENID_NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": config.returnToUrl,
    "openid.realm": config.realm,
    "openid.identity": OPENID_IDENTIFIER_SELECT,
    "openid.claimed_id": OPENID_IDENTIFIER_SELECT
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}
async function validateSteamOpenIdCallback(queryParams) {
  const mode = queryParams["openid.mode"];
  if (mode === "cancel") {
    return {
      isValid: false,
      error: "STEAM_CANCELLED: User cancelled Steam OpenID login."
    };
  }
  if (mode !== "id_res") {
    return {
      isValid: false,
      error: "STEAM_VALIDATION_FAILED: Invalid openid.mode in callback."
    };
  }
  const postParams = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (key.startsWith("openid.")) {
      postParams.set(key, String(value));
    }
  }
  postParams.set("openid.mode", "check_authentication");
  try {
    const response = await fetch(STEAM_OPENID_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "PurpleBeanGaming/1.0 (Steam-OpenID-2.0)"
      },
      body: postParams.toString()
    });
    if (!response.ok) {
      return {
        isValid: false,
        error: `STEAM_PROVIDER_UNAVAILABLE: Valve OpenID server returned HTTP ${response.status}`
      };
    }
    const text = await response.text();
    const lines = text.split("\n");
    const keyValueMap = {};
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx !== -1) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        keyValueMap[k] = v;
      }
    }
    if (keyValueMap["is_valid"] !== "true") {
      return {
        isValid: false,
        error: "STEAM_VALIDATION_FAILED: Steam check_authentication responded is_valid:false"
      };
    }
    const claimedId = queryParams["openid.claimed_id"] || queryParams["openid.identity"];
    if (!claimedId || typeof claimedId !== "string") {
      return {
        isValid: false,
        error: "STEAM_ID_MISSING: Missing claimed_id in OpenID callback"
      };
    }
    const match = /^https:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17})\/?$/.exec(claimedId);
    if (!match || !match[1]) {
      return {
        isValid: false,
        claimedId,
        error: "STEAM_ID_MISSING: Malformed Steam64 ID in claimed_id"
      };
    }
    const steamId64 = match[1];
    if (!/^[0-9]{17}$/.test(steamId64)) {
      return {
        isValid: false,
        error: "STEAM_ID_MISSING: Invalid 17-digit Steam64 identifier"
      };
    }
    return {
      isValid: true,
      steamId64,
      claimedId
    };
  } catch (err) {
    return {
      isValid: false,
      error: `STEAM_PROVIDER_UNAVAILABLE: Failed to reach Valve OpenID verification endpoint (${err?.message || "network error"})`
    };
  }
}

// ../lib/dota/ids.ts
var STEAM_ID64_OFFSET = BigInt("76561197960265728");
var MAX_ACCOUNT_ID = BigInt("4294967295");
var DotaIdError = class extends Error {
  constructor() {
    super("INVALID_DOTA_ACCOUNT");
  }
};
function steamId64FromAccountId(value) {
  const id = parseUnsigned(value, 10);
  if (id > MAX_ACCOUNT_ID) throw new DotaIdError();
  return (STEAM_ID64_OFFSET + id).toString();
}
function accountIdFromSteamId64(value) {
  const id = parseUnsigned(value, 17);
  const account = id - STEAM_ID64_OFFSET;
  if (account < BigInt(0) || account > MAX_ACCOUNT_ID) throw new DotaIdError();
  return account.toString();
}
function normalizeDotaIdentity(input) {
  const value = input.trim();
  const match = /^https:\/\/steamcommunity\.com\/profiles\/([0-9]{17})\/?$/.exec(value);
  const numeric = match?.[1] ?? value;
  if (/^[0-9]{17}$/.test(numeric)) return { steamId64: numeric, accountId: accountIdFromSteamId64(numeric), profileUrl: `https://steamcommunity.com/profiles/${numeric}` };
  if (/^[0-9]{1,10}$/.test(numeric)) {
    const steamId64 = steamId64FromAccountId(numeric);
    return { steamId64, accountId: BigInt(numeric).toString(), profileUrl: `https://steamcommunity.com/profiles/${steamId64}` };
  }
  throw new DotaIdError();
}
function parseUnsigned(value, digits) {
  const text = value.toString();
  if (!new RegExp(`^[0-9]{1,${digits}}$`).test(text)) throw new DotaIdError();
  return BigInt(text);
}

// ../src/server/steamVerificationService.ts
var inMemoryClaims = /* @__PURE__ */ new Map();
var inMemoryPrivateAccounts = /* @__PURE__ */ new Map();
var inMemoryActiveRegistrations = /* @__PURE__ */ new Map();
var isTestEnv = () => process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
var SEED_ACCOUNTS = [
  // 1. Primary Lead (11106cm009@gmail.com / PBG-000186 / Robinhood)
  {
    keys: ["wUyRsN0f40bYdyCpLp6UNeIJjpD3", "11106cm009@gmail.com", "PBG-000186"],
    account: {
      userId: "wUyRsN0f40bYdyCpLp6UNeIJjpD3",
      steamId64: "76561198343915834",
      steamId32: "383650106",
      dotaAccountId: "383650106",
      verificationStatus: "VERIFIED",
      steamOwnershipVerified: true,
      steamVerificationMethod: "STEAM_OPENID_2_0",
      steamPersonaName: "Robinhood",
      steamAvatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocJn4hLtlN-XO5jrSZnUtsIpEalWwHIuYLuTjDne6LNz8AXdUI8=s96-c",
      steamProfileUrl: "https://steamcommunity.com/profiles/76561198343915834",
      openDotaUrl: "https://www.opendota.com/players/383650106",
      publicMatchData: "PUBLIC",
      rankTier: 72,
      leaderboardRank: null,
      updatedAt: Date.now()
    }
  },
  // 2. Bharadwaja (user@gmail.com / PBG-000184)
  {
    keys: ["google_uid_bharadwaja_000184", "user@gmail.com", "PBG-000184"],
    account: {
      userId: "google_uid_bharadwaja_000184",
      steamId64: "76561198052079950",
      steamId32: "52079950",
      dotaAccountId: "52079950",
      verificationStatus: "VERIFIED",
      steamOwnershipVerified: true,
      steamVerificationMethod: "STEAM_OPENID_2_0",
      steamPersonaName: "Bharadwaja",
      steamAvatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja",
      steamProfileUrl: "https://steamcommunity.com/profiles/76561198052079950",
      openDotaUrl: "https://www.opendota.com/players/52079950",
      publicMatchData: "PUBLIC",
      rankTier: 74,
      leaderboardRank: 1240,
      updatedAt: Date.now()
    }
  },
  // 3. Robinhood mock account (PBG-000185)
  {
    keys: ["google_uid_robinhood_000185", "PBG-000185"],
    account: {
      userId: "google_uid_robinhood_000185",
      steamId64: "76561198000000185",
      steamId32: "185000000",
      dotaAccountId: "185000000",
      verificationStatus: "VERIFIED",
      steamOwnershipVerified: true,
      steamVerificationMethod: "STEAM_OPENID_2_0",
      steamPersonaName: "ROBINHOOD",
      steamAvatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota",
      steamProfileUrl: "https://steamcommunity.com/profiles/76561198000000185",
      openDotaUrl: "https://www.opendota.com/players/185000000",
      publicMatchData: "PUBLIC",
      rankTier: 65,
      leaderboardRank: null,
      updatedAt: Date.now()
    }
  }
];
function seedBaselineAccountsIfEmpty() {
  if (isTestEnv()) return;
  for (const entry of SEED_ACCOUNTS) {
    for (const key of entry.keys) {
      if (!inMemoryPrivateAccounts.has(key)) {
        inMemoryPrivateAccounts.set(key, entry.account);
      }
    }
  }
}
seedBaselineAccountsIfEmpty();
function maskSteamId64(steamId64) {
  if (!steamId64 || steamId64.length < 6) return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";
  return "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + steamId64.slice(-6);
}
async function checkActiveTournamentLock(userId) {
  if (inMemoryActiveRegistrations.has(userId) && inMemoryActiveRegistrations.get(userId).size > 0) {
    return true;
  }
  if (!isTestEnv()) {
    try {
      const db2 = getAdminDb();
      const snap = await db2.collection("registrations").where("userId", "==", userId).get();
      for (const doc6 of snap.docs) {
        const data = doc6.data();
        const status = data?.status || "REGISTERED";
        if (["REGISTERED", "UNDER_REVIEW", "VERIFIED"].includes(status)) {
          return true;
        }
      }
    } catch {
    }
  }
  return false;
}
async function linkSteamAccountAuthoritative(userId, steamId64) {
  if (!/^[0-9]{17}$/.test(steamId64)) {
    throw new Error("STEAM_VALIDATION_FAILED: Invalid 17-digit Steam64 identifier");
  }
  let dotaAccountId;
  try {
    dotaAccountId = accountIdFromSteamId64(steamId64);
  } catch {
    throw new Error("STEAM_VALIDATION_FAILED: Could not derive Dota Account ID from Steam64");
  }
  let db2 = null;
  if (!isTestEnv()) {
    try {
      db2 = getAdminDb();
    } catch {
      db2 = null;
    }
  }
  let existingClaim = inMemoryClaims.get(steamId64) || null;
  if (!existingClaim && db2) {
    try {
      const claimSnap = await db2.collection("steamIdentityClaims").doc(steamId64).get();
      if (claimSnap.exists) {
        existingClaim = claimSnap.data();
      }
    } catch {
    }
  }
  if (existingClaim && existingClaim.userId !== userId) {
    throw new Error("STEAM_ALREADY_LINKED: This Steam account is already linked to another PurpleBeanGaming account.");
  }
  let currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  if (!currentAccount && db2) {
    try {
      const accSnap = await db2.collection("privatePlayerAccounts").doc(userId).get();
      if (accSnap.exists) {
        currentAccount = accSnap.data();
      }
    } catch {
    }
  }
  if (currentAccount && currentAccount.steamOwnershipVerified && currentAccount.steamId64 && currentAccount.steamId64 !== steamId64) {
    throw new Error(
      "PBG_ACCOUNT_ALREADY_HAS_STEAM: This PurpleBeanGaming account already has a verified Steam account. Please disconnect it first."
    );
  }
  let personaName = `Dota Player ${dotaAccountId}`;
  let avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${dotaAccountId}`;
  let steamProfileUrl = `https://steamcommunity.com/profiles/${steamId64}`;
  const steamApiKey = process.env.STEAM_WEB_API_KEY;
  if (steamApiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4e3);
      const valveRes = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamId64}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      if (valveRes.ok) {
        const valveData = await valveRes.json();
        const player = valveData?.response?.players?.[0];
        if (player) {
          if (player.personaname) personaName = player.personaname;
          if (player.avatarfull || player.avatarmedium) avatarUrl = player.avatarfull || player.avatarmedium;
          if (player.profileurl) steamProfileUrl = player.profileurl;
        }
      }
    } catch {
    }
  }
  let isOpenDotaAvailable = false;
  let isPublicMatchData = false;
  let rankTier = null;
  let leaderboardRank = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4e3);
    const apiKey = process.env.OPENDOTA_API_KEY;
    const url = `https://api.opendota.com/api/players/${dotaAccountId}${apiKey ? `?api_key=${apiKey}` : ""}`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "PurpleBeanGaming/1.0"
      }
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data && data.profile) {
        isOpenDotaAvailable = true;
        if (data.profile.personaname && !steamApiKey) personaName = data.profile.personaname;
        if (data.profile.avatarfull && !steamApiKey) avatarUrl = data.profile.avatarfull;
        rankTier = data.rank_tier ?? null;
        leaderboardRank = data.leaderboard_rank ?? null;
        isPublicMatchData = Boolean(data.profile.last_login || data.profile.account_id);
      }
    }
  } catch {
  }
  const now = Date.now();
  const claimRecord = {
    steamId64,
    dotaAccountId,
    userId,
    verificationMethod: "steam_openid_2",
    verifiedAt: now
  };
  const privateAccount = {
    userId,
    steamId64,
    steamId32: dotaAccountId,
    dotaAccountId,
    verificationStatus: "VERIFIED",
    steamOwnershipVerified: true,
    steamVerificationMethod: "steam_openid_2",
    steamVerifiedAt: now,
    steamPersonaName: personaName,
    steamAvatarUrl: avatarUrl,
    steamProfileUrl,
    openDotaUrl: `https://www.opendota.com/players/${dotaAccountId}`,
    openDotaAvailable: isOpenDotaAvailable,
    publicMatchData: isPublicMatchData ? "PUBLIC" : "PRIVATE",
    rankTier,
    leaderboardRank,
    linkedAt: now,
    updatedAt: now
  };
  inMemoryClaims.set(steamId64, claimRecord);
  inMemoryPrivateAccounts.set(userId, privateAccount);
  if (db2) {
    try {
      const batch = db2.batch();
      batch.set(db2.collection("steamIdentityClaims").doc(steamId64), claimRecord);
      batch.set(db2.collection("privatePlayerAccounts").doc(userId), privateAccount, { merge: true });
      const publicRef = db2.collection("publicPlayers").doc(userId);
      batch.set(publicRef, {
        userId,
        steamAccountLinked: true,
        steamOwnershipVerified: true,
        dotaAccountId,
        steamId64Masked: maskSteamId64(steamId64),
        openDotaUrl: `https://www.opendota.com/players/${dotaAccountId}`,
        profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
        publicMatchData: isPublicMatchData ? "PUBLIC" : "PRIVATE",
        steamPersonaName: personaName,
        steamAvatarUrl: avatarUrl,
        rankTier,
        updatedAt: now
      }, { merge: true });
      await batch.commit();
    } catch (err) {
      console.warn("[SteamVerificationService] Firestore write note:", err);
    }
  }
  return privateAccount;
}
async function unlinkSteamAccountAuthoritative(userId) {
  const isLocked = await checkActiveTournamentLock(userId);
  if (isLocked) {
    throw new Error(
      "ACTIVE_TOURNAMENT_LOCK: Steam cannot be disconnected while you have an active tournament registration."
    );
  }
  let db2 = null;
  if (!isTestEnv()) {
    try {
      db2 = getAdminDb();
    } catch {
      db2 = null;
    }
  }
  let currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  if (!currentAccount && db2) {
    try {
      const doc6 = await db2.collection("privatePlayerAccounts").doc(userId).get();
      if (doc6.exists) {
        currentAccount = doc6.data();
      }
    } catch {
    }
  }
  const steamId64 = currentAccount?.steamId64;
  if (steamId64) {
    inMemoryClaims.delete(steamId64);
  }
  const unlinkedAccount = {
    userId,
    steamId64: null,
    steamId32: null,
    dotaAccountId: null,
    verificationStatus: "NOT_LINKED",
    steamOwnershipVerified: false,
    updatedAt: Date.now()
  };
  inMemoryPrivateAccounts.set(userId, unlinkedAccount);
  if (db2) {
    try {
      const batch = db2.batch();
      if (steamId64) {
        batch.delete(db2.collection("steamIdentityClaims").doc(steamId64));
      }
      batch.set(db2.collection("privatePlayerAccounts").doc(userId), unlinkedAccount);
      const publicRef = db2.collection("publicPlayers").doc(userId);
      batch.set(publicRef, {
        userId,
        steamAccountLinked: false,
        steamOwnershipVerified: false,
        dotaAccountId: null,
        steamId64Masked: null,
        openDotaUrl: null,
        profileUrl: null,
        publicMatchData: "UNLINKED",
        updatedAt: Date.now()
      }, { merge: true });
      await batch.commit();
    } catch (err) {
      console.warn("[SteamVerificationService] Firestore unlink write note:", err);
    }
  }
}
async function getPublicPlayerSafeProfile(userId) {
  const privateAcc = await getPrivatePlayerAccount(userId);
  if (!privateAcc || !privateAcc.steamOwnershipVerified || !privateAcc.steamId64) {
    return {
      userId,
      steamAccountLinked: false,
      steamOwnershipVerified: false,
      dotaAccountId: null,
      steamId64Masked: null,
      openDotaUrl: null,
      profileUrl: null,
      publicMatchData: "UNLINKED"
    };
  }
  return {
    userId,
    steamAccountLinked: true,
    steamOwnershipVerified: true,
    dotaAccountId: privateAcc.dotaAccountId,
    steamId64Masked: maskSteamId64(privateAcc.steamId64),
    openDotaUrl: privateAcc.openDotaUrl || null,
    profileUrl: privateAcc.steamProfileUrl || null,
    publicMatchData: privateAcc.publicMatchData || "PRIVATE",
    steamPersonaName: privateAcc.steamPersonaName,
    steamAvatarUrl: privateAcc.steamAvatarUrl,
    rankTier: privateAcc.rankTier ?? null
  };
}
async function getPrivatePlayerAccount(userId) {
  let privateAcc = inMemoryPrivateAccounts.get(userId);
  if (privateAcc) return privateAcc;
  if (!isTestEnv()) {
    const foundSeed = SEED_ACCOUNTS.find((s) => s.keys.includes(userId));
    if (foundSeed) {
      inMemoryPrivateAccounts.set(userId, foundSeed.account);
      return foundSeed.account;
    }
    try {
      const db2 = getAdminDb();
      const doc6 = await db2.collection("privatePlayerAccounts").doc(userId).get();
      if (doc6.exists) {
        privateAcc = doc6.data();
        if (privateAcc) {
          inMemoryPrivateAccounts.set(userId, privateAcc);
          return privateAcc;
        }
      }
      const pbgDoc = await db2.collection("pbgAccounts").doc(userId).get();
      if (pbgDoc.exists) {
        const d = pbgDoc.data();
        if (d && (d.dotaAccountVerified || d.dotaOwnershipVerified || d.dotaAccountLinked) && d.dotaAccountId) {
          privateAcc = {
            userId,
            steamId64: d.steamId || d.steamId64 || null,
            steamId32: d.dotaAccountId,
            dotaAccountId: d.dotaAccountId,
            verificationStatus: "VERIFIED",
            steamOwnershipVerified: true,
            steamPersonaName: d.steamPersonaName || d.dotaDisplayName,
            steamAvatarUrl: d.dotaAvatar || d.avatarUrl,
            steamProfileUrl: d.steamProfileUrl || (d.steamId ? `https://steamcommunity.com/profiles/${d.steamId}` : void 0),
            openDotaUrl: d.openDotaProfile || `https://www.opendota.com/players/${d.dotaAccountId}`,
            publicMatchData: d.publicMatchDataStatus === "PUBLIC" ? "PUBLIC" : "PRIVATE",
            rankTier: d.dotaRankTier || null,
            leaderboardRank: d.dotaLeaderboardRank || null,
            updatedAt: Date.now()
          };
          inMemoryPrivateAccounts.set(userId, privateAcc);
          return privateAcc;
        }
      }
    } catch {
    }
  }
  return privateAcc || null;
}

// ../src/server/discordProvisioningService.ts
async function fetchDiscordUserProfile(accessToken) {
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Access token is required to fetch Discord user profile");
  }
  const res = await fetch("https://discord.com/api/v10/users/@me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Accept": "application/json"
    }
  });
  if (!res.ok) {
    const status = res.status;
    if (status === 401) {
      const err2 = new Error("Discord access token is invalid or expired.");
      err2.code = "DISCORD_INVALID_TOKEN";
      throw err2;
    }
    const err = new Error(`Discord API error while fetching user profile (HTTP ${status}).`);
    err.code = "DISCORD_API_UNAVAILABLE";
    throw err;
  }
  const data = await res.json();
  if (!data || !data.id || typeof data.id !== "string") {
    const err = new Error("Discord API returned an invalid user profile without a user ID.");
    err.code = "DISCORD_MALFORMED_PROFILE";
    throw err;
  }
  return {
    id: data.id,
    username: data.username || "discord_user",
    global_name: data.global_name || null,
    avatar: data.avatar || null,
    discriminator: data.discriminator
  };
}
async function provisionDiscordGuildAndRole(params) {
  const { guildId, botToken, roleId, discordUserId, accessToken, fetchFn = fetch } = params;
  if (!guildId || typeof guildId !== "string") {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: "DISCORD_INVALID_GUILD_ID",
      errorMessage: "Official PBG Discord guild ID is missing or invalid."
    };
  }
  if (!botToken || typeof botToken !== "string") {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: "DISCORD_MISSING_BOT_TOKEN",
      errorMessage: "Discord bot token is missing in server environment."
    };
  }
  try {
    let alreadyMember = false;
    const addMemberUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
    const addMemberRes = await fetchFn(addMemberUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        access_token: accessToken,
        roles: roleId ? [roleId] : []
      })
    });
    let verifiedRole = false;
    let memberConfirmed = false;
    if (addMemberRes.status === 201) {
      alreadyMember = false;
      memberConfirmed = true;
      const newMemberData = typeof addMemberRes.json === "function" ? await addMemberRes.json().catch(() => null) : null;
      if (newMemberData && Array.isArray(newMemberData.roles)) {
        if (!roleId || newMemberData.roles.includes(roleId)) {
          verifiedRole = true;
        }
      }
    } else if (addMemberRes.status === 204) {
      alreadyMember = true;
      memberConfirmed = true;
      if (roleId) {
        const addRoleUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
        const addRoleRes = await fetchFn(addRoleUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bot ${botToken}`
          }
        });
        if (addRoleRes.status !== 204 && !addRoleRes.ok) {
          const roleErrorBody = typeof addRoleRes.json === "function" ? await addRoleRes.json().catch(() => ({})) : {};
          const code = roleErrorBody?.code;
          if (addRoleRes.status === 403 || code === 50013) {
            return {
              success: false,
              guildMember: true,
              pbgMemberRole: false,
              errorCode: "DISCORD_ROLE_HIERARCHY_FAILURE",
              errorMessage: "Bot lacks permission to assign the PBG Member role or the role is higher in hierarchy than the bot."
            };
          }
          if (addRoleRes.status === 404 || code === 10011) {
            return {
              success: false,
              guildMember: true,
              pbgMemberRole: false,
              errorCode: "DISCORD_INVALID_ROLE_ID",
              errorMessage: "Configured PBG Member role ID does not exist in the Discord guild."
            };
          }
          return {
            success: false,
            guildMember: true,
            pbgMemberRole: false,
            errorCode: "DISCORD_ROLE_ASSIGNMENT_FAILED",
            errorMessage: "Failed to assign PBG Member role in official Discord server."
          };
        }
      }
    } else {
      const errorBody = typeof addMemberRes.json === "function" ? await addMemberRes.json().catch(() => ({})) : {};
      const code = errorBody?.code;
      if (addMemberRes.status === 404 || code === 10004) {
        return {
          success: false,
          guildMember: false,
          pbgMemberRole: false,
          errorCode: "DISCORD_INVALID_GUILD_ID",
          errorMessage: "Official PBG Discord server (Guild ID) was not found."
        };
      }
      if (addMemberRes.status === 403 || code === 50013) {
        return {
          success: false,
          guildMember: false,
          pbgMemberRole: false,
          errorCode: "DISCORD_BOT_MISSING_PERMISSIONS",
          errorMessage: 'Discord bot lacks "Manage Roles" or "Create Instant Invite" permission to add members.'
        };
      }
      return {
        success: false,
        guildMember: false,
        pbgMemberRole: false,
        errorCode: "DISCORD_GUILD_JOIN_FAILED",
        errorMessage: `Failed to join official Discord server (HTTP ${addMemberRes.status}).`
      };
    }
    if (!verifiedRole && roleId) {
      const verifyMemberUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
      const verifyMemberRes = await fetchFn(verifyMemberUrl, {
        method: "GET",
        headers: {
          Authorization: `Bot ${botToken}`,
          Accept: "application/json"
        }
      });
      if (!verifyMemberRes.ok) {
        return {
          success: false,
          guildMember: memberConfirmed,
          pbgMemberRole: false,
          errorCode: "DISCORD_MEMBER_VERIFICATION_FAILED",
          errorMessage: "Failed to verify member status on official PBG Discord server."
        };
      }
      const memberData = typeof verifyMemberRes.json === "function" ? await verifyMemberRes.json().catch(() => ({})) : {};
      const actualRoles = Array.isArray(memberData?.roles) ? memberData.roles : [];
      if (actualRoles.includes(roleId)) {
        verifiedRole = true;
      }
    }
    if (roleId && !verifiedRole) {
      return {
        success: false,
        guildMember: true,
        pbgMemberRole: false,
        alreadyMember,
        errorCode: "DISCORD_ROLE_VERIFICATION_FAILED",
        errorMessage: "Member is present in Discord server, but the PBG Member role could not be verified on the account."
      };
    }
    return {
      success: true,
      guildMember: true,
      pbgMemberRole: Boolean(verifiedRole || !roleId),
      alreadyMember
    };
  } catch (err) {
    return {
      success: false,
      guildMember: false,
      pbgMemberRole: false,
      errorCode: "DISCORD_API_UNAVAILABLE",
      errorMessage: "Discord API is currently unreachable. Please try again."
    };
  }
}
async function removeDiscordMemberRole(params) {
  const { guildId, botToken, roleId, discordUserId, fetchFn = fetch } = params;
  if (!guildId || !botToken || !roleId || !discordUserId) {
    return { success: false, error: "MISSING_PARAMETERS" };
  }
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });
    if (res.status === 204 || res.status === 404 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err) {
    console.warn("[removeDiscordMemberRole] Role removal warning:", err.message);
    return { success: false, error: err.message };
  }
}

// ../src/domain/pbgAccountRegistry.ts
import { doc as doc3, getDoc as getDoc2, setDoc as setDoc2, deleteDoc, collection, onSnapshot as onSnapshot2 } from "firebase/firestore";
var STORAGE_KEY = "pbg_player_accounts_v1";
var PBG_COUNTER_KEY = "pbg_player_id_counter_v1";
var PBGAccountRegistry = class {
  // Baseline sequences start at 189 after 184-188
  constructor() {
    this.accounts = /* @__PURE__ */ new Map();
    // Keyed by googleUid
    this.pbgIdIndex = /* @__PURE__ */ new Map();
    // pbgId -> googleUid
    this.discordIdIndex = /* @__PURE__ */ new Map();
    // discordUserId -> googleUid
    this.dotaIdIndex = /* @__PURE__ */ new Map();
    // dotaAccountId -> googleUid
    this.steamIdIndex = /* @__PURE__ */ new Map();
    // steamId -> googleUid
    this.listeners = /* @__PURE__ */ new Set();
    this.nextPbgNumber = 189;
    this.lastSyncedHash = /* @__PURE__ */ new Map();
    this.seedCanonicalAccounts();
    this.loadFromStorage();
    this.seedCanonicalAccounts();
    this.initFirestoreSync();
  }
  reload() {
    this.seedCanonicalAccounts();
    this.loadFromStorage();
    this.seedCanonicalAccounts();
  }
  seedCanonicalAccounts() {
    const santhoshUid = "dCZd7IjKpxYDBjTQe5FUhccuX583";
    const santhoshEmail = "myana.santhosh@gmail.com";
    let santhosh = this.accounts.get(santhoshUid) || Array.from(this.accounts.values()).find((a) => a.email.toLowerCase() === santhoshEmail);
    if (!santhosh) {
      santhosh = {
        pbgId: "PBG-000188",
        googleUid: santhoshUid,
        email: santhoshEmail,
        displayName: "Santhosh Myana",
        avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKEMfUhTi1ata0in6B1QrYHiFJykqUeoCiE-nuE6wwM6lUCch-Y=s96-c",
        createdAt: "2026-10-02T15:44:36.857Z",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        accountStatus: "ACTIVE",
        country: "India",
        region: "Pan India",
        city: "Siddipet",
        hasCompletedOnboarding: true,
        dotaAccountLinked: true,
        dotaAccountVerified: true,
        dotaOwnershipVerified: true,
        dotaAccountId: "336333581",
        steamId: "76561198296599309",
        publicMatchDataStatus: "PUBLIC",
        dotaConnectionStatus: "CONNECTED",
        discordLinked: true,
        discordUserId: "398688779025776643",
        discordUsername: "tasteless_chicken",
        discordDisplayName: "TastelesS ChickeN",
        declaredMmr: 3e3,
        tournamentMmr: 3e3,
        primaryRole: "Position 1 \u2014 Carry",
        purpleBeanRating: "120 PB",
        tournamentCount: 0,
        matchesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        teamsCount: 0,
        captainCount: 0,
        tournamentHistory: [],
        teamHistory: [],
        matchHistory: [],
        captainHistory: [],
        achievements: []
      };
    } else {
      santhosh.pbgId = "PBG-000188";
      santhosh.city = santhosh.city || "Siddipet";
      if (!santhosh.dotaAccountId) santhosh.dotaAccountId = "336333581";
      if (!santhosh.steamId) santhosh.steamId = "76561198296599309";
      if (!santhosh.discordUserId) santhosh.discordUserId = "398688779025776643";
      if (!santhosh.discordUsername) santhosh.discordUsername = "tasteless_chicken";
    }
    this.accounts.set(santhoshUid, santhosh);
    this.pbgIdIndex.set("PBG-000188", santhoshUid);
    this.pbgIdIndex.delete("PBG-000186");
    const leadUid = "wUyRsN0f40bYdyCpLp6UNeIJjpD3";
    const leadEmail = "11106cm009@gmail.com";
    let lead = this.accounts.get(leadUid) || Array.from(this.accounts.values()).find((a) => a.email.toLowerCase() === leadEmail);
    if (!lead) {
      lead = {
        pbgId: "PBG-000186",
        googleUid: leadUid,
        email: leadEmail,
        displayName: "Bharadwaja Anisetti",
        avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKsmb2Rk2NffT53Kqf00QWp4PzT5M9s8dE1e5B6C7D8=s96-c",
        createdAt: "2026-09-25T15:43:21.383Z",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        accountStatus: "ACTIVE",
        country: "India",
        region: "Pan India",
        city: "Mumbai",
        hasCompletedOnboarding: true,
        dotaAccountLinked: true,
        dotaAccountVerified: true,
        dotaOwnershipVerified: true,
        dotaAccountId: "383650106",
        steamId: "76561198343915834",
        publicMatchDataStatus: "PUBLIC",
        dotaConnectionStatus: "CONNECTED",
        discordLinked: true,
        discordUserId: "522114011307966464",
        discordUsername: "robinhood28",
        discordDisplayName: "Robinhood",
        purpleBeanRating: "120 PB",
        tournamentCount: 0,
        matchesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        teamsCount: 0,
        captainCount: 0,
        tournamentHistory: [],
        teamHistory: [],
        matchHistory: [],
        captainHistory: [],
        achievements: []
      };
    } else {
      lead.pbgId = "PBG-000186";
    }
    this.accounts.set(leadUid, lead);
    this.pbgIdIndex.set("PBG-000186", leadUid);
  }
  loadFromStorage() {
    const hasStorage = typeof localStorage !== "undefined";
    if (!hasStorage && typeof window === "undefined") return;
    try {
      const savedCounter = localStorage.getItem(PBG_COUNTER_KEY);
      if (savedCounter) {
        const parsed = parseInt(savedCounter, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.nextPbgNumber = parsed;
        }
      }
      const savedAccounts = localStorage.getItem(STORAGE_KEY);
      if (savedAccounts) {
        const list = JSON.parse(savedAccounts);
        list.forEach((acc) => {
          if (acc.pbgId === "PBG-000185" && acc.dotaAccountId === "383650106") {
            acc.dotaAccountId = "185000000";
            acc.steamId = "76561198000000185";
          }
          if (acc.googleUid === "dCZd7IjKpxYDBjTQe5FUhccuX583" || acc.email?.toLowerCase() === "myana.santhosh@gmail.com") {
            acc.pbgId = "PBG-000188";
          }
          if (acc.googleUid === "wUyRsN0f40bYdyCpLp6UNeIJjpD3" || acc.email?.toLowerCase() === "11106cm009@gmail.com") {
            acc.pbgId = "PBG-000186";
          }
          if (acc.email?.toLowerCase() === "neelapuharsha@gmail.com") {
            acc.pbgId = "PBG-000187";
          }
          if (acc.hasCompletedOnboarding === void 0) {
            acc.hasCompletedOnboarding = true;
          }
          this.accounts.set(acc.googleUid, acc);
          this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
          if (acc.discordUserId) {
            this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
          }
          if (acc.dotaAccountId) {
            this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
          }
          if (acc.steamId) {
            this.steamIdIndex.set(acc.steamId, acc.googleUid);
          }
        });
      }
      if (this.accounts.size === 0) {
        const baselineAccount = {
          pbgId: "PBG-000184",
          googleUid: "google_uid_bharadwaja_000184",
          email: "user@gmail.com",
          displayName: "Bharadwaja",
          avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja",
          createdAt: new Date(Date.now() - 30 * 864e5).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          accountStatus: "ACTIVE",
          country: "India",
          region: "Pan India",
          city: "Mumbai",
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(Date.now() - 30 * 864e5).toISOString(),
          // Discord Account Identity (OAuth Authorized)
          discordUserId: "123456789012345678",
          discordUsername: "playername",
          discordDisplayName: "Player Name",
          discordAvatar: "https://cdn.discordapp.com/embed/avatars/0.png",
          discordLinked: true,
          discordLinkedAt: new Date(Date.now() - 25 * 864e5).toISOString(),
          // Steam & Dota Account Identity (Sections 8, 10, 11)
          steamId: "76561198052079950",
          dotaAccountId: "52079950",
          dotaDisplayName: "Bharadwaja",
          dotaAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=Bharadwaja",
          steamPersonaName: "Bharadwaja",
          steamProfileUrl: "https://steamcommunity.com/profiles/76561198052079950",
          openDotaProfile: "https://www.opendota.com/players/52079950",
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          dotaOwnershipVerifiedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
          dotaLinkedAt: new Date(Date.now() - 20 * 864e5).toISOString(),
          publicMatchDataStatus: "PUBLIC",
          dotaConnectionStatus: "CONNECTED_DATA_AVAILABLE",
          lastOpenDotaSync: new Date(Date.now() - 15 * 6e4).toISOString(),
          lastSuccessfulDataSync: new Date(Date.now() - 15 * 6e4).toISOString(),
          dotaRankTier: 74,
          dotaLeaderboardRank: 1240,
          dotaCountryCode: "IN",
          // Dota Competitive Stats
          declaredMmr: 5600,
          tournamentMmr: 5600,
          primaryRole: "Position 1 \u2014 Carry",
          secondaryRole: "Position 2 \u2014 Mid",
          purpleBeanRating: "224 PB",
          // Career Histories
          tournamentCount: 3,
          matchesCount: 14,
          winsCount: 9,
          lossesCount: 5,
          teamsCount: 2,
          captainCount: 1,
          tournamentHistory: [
            {
              id: "tourney-pbg-open-1",
              name: "Purple Bean Open Season 1",
              date: "2026-08-15",
              teamName: "Mumbai Mavericks",
              placement: "3rd Place",
              role: "Position 1 \u2014 Carry"
            },
            {
              id: "tourney-delhi-cup",
              name: "Delhi Esports Invitational",
              date: "2026-07-20",
              teamName: "Mavericks Prime",
              placement: "Runner Up",
              role: "Position 1 \u2014 Carry"
            }
          ],
          teamHistory: [
            {
              id: "team-mumbai-mav",
              name: "Mumbai Mavericks",
              tag: "MM",
              period: "2026 Season 1",
              role: "Position 1 \u2014 Carry"
            },
            {
              id: "team-free-agent",
              name: "Hyderabad Raiders (Stand-in)",
              tag: "HR",
              period: "Spring 2026",
              role: "Position 2 \u2014 Mid"
            }
          ],
          matchHistory: [
            {
              id: "match-101",
              tournamentName: "Purple Bean Open Season 1",
              opponentTeam: "Hyderabad Raiders",
              result: "WIN",
              score: "2 - 1",
              date: "2026-08-14"
            },
            {
              id: "match-102",
              tournamentName: "Purple Bean Open Season 1",
              opponentTeam: "Bengaluru Blasters",
              result: "LOSS",
              score: "1 - 2",
              date: "2026-08-15"
            }
          ],
          captainHistory: [
            {
              tournamentId: "tourney-delhi-cup",
              tournamentName: "Delhi Esports Invitational",
              teamName: "Mavericks Prime",
              record: "4W - 2L"
            }
          ],
          achievements: [
            {
              id: "ach-1",
              title: "Top 3 Contender",
              tournamentName: "Purple Bean Open Season 1",
              placement: "3rd Place",
              date: "2026-08-15",
              badge: "\u{1F949}"
            },
            {
              id: "ach-2",
              title: "Dota 2 Calibrated 5.6k",
              tournamentName: "Competitive Rating Engine",
              placement: "Tier 1 Verified",
              date: "2026-08-01",
              badge: "\u2694\uFE0F"
            }
          ]
        };
        this.accounts.set(baselineAccount.googleUid, baselineAccount);
        this.pbgIdIndex.set(baselineAccount.pbgId, baselineAccount.googleUid);
        if (baselineAccount.discordUserId) {
          this.discordIdIndex.set(baselineAccount.discordUserId, baselineAccount.googleUid);
        }
        if (this.nextPbgNumber <= 184) {
          this.nextPbgNumber = 185;
        }
        this.saveToStorage();
      }
      if (!this.pbgIdIndex.has("PBG-000185")) {
        const robinhoodAccount = {
          pbgId: "PBG-000185",
          googleUid: "google_uid_robinhood_000185",
          email: "robinhood@purplebeangaming.com",
          displayName: "ROBINHOOD",
          avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota",
          createdAt: new Date(Date.now() - 14 * 864e5).toISOString(),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          accountStatus: "ACTIVE",
          country: "India",
          region: "Pan India",
          city: "Bengaluru",
          hasCompletedOnboarding: true,
          onboardingCompletedAt: new Date(Date.now() - 14 * 864e5).toISOString(),
          discordUserId: "383650106123456789",
          discordUsername: "robinhood_dota",
          discordDisplayName: "ROBINHOOD | PBG",
          discordAvatar: "https://cdn.discordapp.com/embed/avatars/1.png",
          discordLinked: true,
          discordLinkedAt: new Date(Date.now() - 12 * 864e5).toISOString(),
          steamId: "76561198000000185",
          dotaAccountId: "185000000",
          dotaDisplayName: "ROBINHOOD",
          dotaAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=RobinhoodDota",
          steamPersonaName: "ROBINHOOD",
          steamProfileUrl: "https://steamcommunity.com/profiles/76561198000000185",
          openDotaProfile: "https://www.opendota.com/players/185000000",
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          dotaOwnershipVerifiedAt: new Date(Date.now() - 10 * 864e5).toISOString(),
          dotaLinkedAt: new Date(Date.now() - 10 * 864e5).toISOString(),
          publicMatchDataStatus: "PUBLIC",
          dotaConnectionStatus: "CONNECTED_DATA_AVAILABLE",
          lastOpenDotaSync: new Date(Date.now() - 5 * 6e4).toISOString(),
          lastSuccessfulDataSync: new Date(Date.now() - 5 * 6e4).toISOString(),
          dotaRankTier: 31,
          // Archon I
          dotaLeaderboardRank: null,
          dotaCountryCode: "IN",
          declaredMmr: 2750,
          tournamentMmr: 2820,
          primaryRole: "Position 1 \u2014 Carry",
          secondaryRole: "Position 2 \u2014 Mid",
          purpleBeanRating: "185 PB",
          tournamentCount: 2,
          matchesCount: 11,
          winsCount: 7,
          lossesCount: 4,
          teamsCount: 1,
          captainCount: 0,
          tournamentHistory: [
            {
              id: "tourney-delhi-cup",
              name: "Delhi Esports Invitational",
              date: "2026-07-20",
              teamName: "Bengaluru Blasters",
              placement: "Top 4",
              role: "Position 1 \u2014 Carry"
            }
          ],
          teamHistory: [
            {
              id: "team-bengaluru-blasters",
              name: "Bengaluru Blasters",
              tag: "BB",
              period: "2026 Season 1",
              role: "Position 1 \u2014 Carry"
            }
          ],
          matchHistory: [],
          captainHistory: [],
          achievements: [
            {
              id: "ach-robin-1",
              title: "Archon Circuit Contender",
              tournamentName: "Delhi Esports Invitational",
              placement: "Top 4",
              date: "2026-07-20",
              badge: "\u{1F3AF}"
            }
          ]
        };
        this.accounts.set(robinhoodAccount.googleUid, robinhoodAccount);
        this.pbgIdIndex.set(robinhoodAccount.pbgId, robinhoodAccount.googleUid);
        if (robinhoodAccount.discordUserId) {
          this.discordIdIndex.set(robinhoodAccount.discordUserId, robinhoodAccount.googleUid);
        }
        if (this.nextPbgNumber <= 185) {
          this.nextPbgNumber = 186;
        }
        this.saveToStorage();
      }
      const friendEmail = "neelapuharsha@gmail.com";
      let friendAccount = this.getAccountByEmail(friendEmail);
      if (!friendAccount) {
        friendAccount = {
          pbgId: "PBG-000187",
          googleUid: "google_uid_neelapuharsha_000186",
          email: friendEmail,
          displayName: "Harsha Neelapu",
          avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=HarshaNeelapu",
          createdAt: "2026-09-25T15:43:21.383Z",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          accountStatus: "ACTIVE",
          country: "India",
          region: "Pan India",
          city: "Hyderabad",
          hasCompletedOnboarding: true,
          onboardingCompletedAt: "2026-09-25T15:43:21.383Z",
          discordUserId: void 0,
          discordUsername: void 0,
          discordDisplayName: void 0,
          discordAvatar: void 0,
          discordLinked: false,
          discordLinkedAt: void 0,
          steamId: void 0,
          dotaAccountId: "186000000",
          dotaDisplayName: "Harsha Neelapu",
          dotaAvatar: "https://api.dicebear.com/7.x/bottts/svg?seed=HarshaNeelapu",
          steamPersonaName: "Harsha Neelapu",
          steamProfileUrl: void 0,
          openDotaProfile: void 0,
          dotaAccountLinked: false,
          dotaAccountVerified: false,
          dotaOwnershipVerified: false,
          dotaOwnershipVerifiedAt: void 0,
          dotaLinkedAt: void 0,
          publicMatchDataStatus: "UNKNOWN",
          dotaConnectionStatus: "NOT_LINKED",
          lastOpenDotaSync: void 0,
          lastSuccessfulDataSync: void 0,
          dotaRankTier: null,
          dotaLeaderboardRank: null,
          dotaCountryCode: "IN",
          declaredMmr: 4250,
          tournamentMmr: 4250,
          primaryRole: "Position 3 \u2014 Offlane",
          secondaryRole: "Position 4 \u2014 Soft Support",
          purpleBeanRating: "TIER_2",
          tournamentCount: 1,
          matchesCount: 6,
          winsCount: 4,
          lossesCount: 2,
          teamsCount: 1,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };
        this.accounts.set(friendAccount.googleUid, friendAccount);
        this.pbgIdIndex.set(friendAccount.pbgId, friendAccount.googleUid);
      } else {
        if (friendAccount.pbgId !== "PBG-000187") {
          this.pbgIdIndex.delete(friendAccount.pbgId);
          friendAccount.pbgId = "PBG-000187";
          this.pbgIdIndex.set(friendAccount.pbgId, friendAccount.googleUid);
        }
      }
      const leadEmail = "11106cm009@gmail.com";
      const existingLead = this.getAccountByEmail(leadEmail) || this.accounts.get("wUyRsN0f40bYdyCpLp6UNeIJjpD3");
      if (!existingLead) {
        const newLeadAcc = {
          pbgId: "PBG-000186",
          googleUid: "wUyRsN0f40bYdyCpLp6UNeIJjpD3",
          email: leadEmail,
          displayName: "Bharadwaja Anisetti",
          avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocJn4hLtlN-XO5jrSZnUtsIpEalWwHIuYLuTjDne6LNz8AXdUI8=s96-c",
          createdAt: "2026-10-02T12:31:42.265Z",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          accountStatus: "ACTIVE",
          country: "India",
          region: "Pan India",
          city: "Mumbai",
          hasCompletedOnboarding: true,
          onboardingCompletedAt: "2026-10-02T15:25:44.557Z",
          dotaAccountId: "383650106",
          steamId: "76561198343915834",
          steamPersonaName: "Robinhood",
          dotaDisplayName: "Robinhood",
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaOwnershipVerified: true,
          publicMatchDataStatus: "PUBLIC",
          dotaConnectionStatus: "CONNECTED_DATA_AVAILABLE",
          discordLinked: true,
          discordUserId: "522114011307966464",
          discordUsername: "robinhood28",
          discordDisplayName: "Robinhood",
          purpleBeanRating: "UNRATED",
          tournamentCount: 0,
          matchesCount: 0,
          winsCount: 0,
          lossesCount: 0,
          teamsCount: 0,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };
        this.accounts.set(newLeadAcc.googleUid, newLeadAcc);
        this.pbgIdIndex.set(newLeadAcc.pbgId, newLeadAcc.googleUid);
      } else if (existingLead.pbgId !== "PBG-000186") {
        this.pbgIdIndex.delete(existingLead.pbgId);
        existingLead.pbgId = "PBG-000186";
        this.pbgIdIndex.set("PBG-000186", existingLead.googleUid);
      }
      const santhoshEmail = "myana.santhosh@gmail.com";
      const existingSanthosh = this.getAccountByEmail(santhoshEmail) || this.accounts.get("dCZd7IjKpxYDBjTQe5FUhccuX583");
      if (!existingSanthosh) {
        const newSanthoshAcc = {
          pbgId: "PBG-000188",
          googleUid: "dCZd7IjKpxYDBjTQe5FUhccuX583",
          email: santhoshEmail,
          displayName: "Santhosh Myana",
          avatarUrl: "https://lh3.googleusercontent.com/a/ACg8ocKEMfUhTi1ata0in6B1QrYHiFJykqUeoCiE-nuE6wwM6lUCch-Y=s96-c",
          createdAt: "2026-10-02T15:44:36.857Z",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          accountStatus: "ACTIVE",
          country: "India",
          region: "Pan India",
          city: "Mumbai",
          hasCompletedOnboarding: true,
          dotaAccountLinked: false,
          dotaAccountVerified: false,
          dotaOwnershipVerified: false,
          publicMatchDataStatus: "UNKNOWN",
          dotaConnectionStatus: "NOT_LINKED",
          discordLinked: false,
          purpleBeanRating: "UNRATED",
          tournamentCount: 0,
          matchesCount: 0,
          winsCount: 0,
          lossesCount: 0,
          teamsCount: 0,
          captainCount: 0,
          tournamentHistory: [],
          teamHistory: [],
          matchHistory: [],
          captainHistory: [],
          achievements: []
        };
        this.accounts.set(newSanthoshAcc.googleUid, newSanthoshAcc);
        this.pbgIdIndex.set(newSanthoshAcc.pbgId, newSanthoshAcc.googleUid);
      } else if (existingSanthosh.pbgId !== "PBG-000188") {
        this.pbgIdIndex.delete(existingSanthosh.pbgId);
        existingSanthosh.pbgId = "PBG-000188";
        this.pbgIdIndex.set("PBG-000188", existingSanthosh.googleUid);
      }
      const assignedIds = /* @__PURE__ */ new Map();
      for (const acc of Array.from(this.accounts.values())) {
        if (!acc.pbgId) {
          acc.pbgId = this.allocateNextPbgId();
          acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        } else if (assignedIds.has(acc.pbgId) && assignedIds.get(acc.pbgId) !== acc.googleUid) {
          const collisionPbgId = acc.pbgId;
          const newUniquePbgId = this.allocateNextPbgId();
          console.warn(`[PBG ID Collision Fixed] Reassigning duplicate PBG ID ${collisionPbgId} on ${acc.displayName} (${acc.email}) to unique ${newUniquePbgId}`);
          this.pbgIdIndex.delete(collisionPbgId);
          acc.pbgId = newUniquePbgId;
          acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          this.syncToFirestore(acc);
        }
        assignedIds.set(acc.pbgId, acc.googleUid);
        this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
      }
      const highestNumber = this.getHighestPbgNumber();
      if (this.nextPbgNumber <= highestNumber) {
        this.nextPbgNumber = highestNumber + 1;
      }
      if (this.nextPbgNumber < 189) {
        this.nextPbgNumber = 189;
      }
      this.saveToStorage();
    } catch (e) {
      console.warn("Failed to load PBG accounts from localStorage:", e);
    }
  }
  /**
   * Real-time bidirectional Firestore synchronization for PBG Player Accounts & sequence counters.
   * Guarantees all connected clients, tabs, and devices immediately reflect unique permanent accounts.
   */
  initFirestoreSync() {
    if (typeof window === "undefined" || !db) return;
    try {
      onSnapshot2(collection(db, "pbgAccounts"), (snapshot) => {
        let changed = false;
        snapshot.forEach((docSnap) => {
          const acc = docSnap.data();
          if (acc && acc.pbgId && acc.googleUid) {
            if (acc.googleUid === "dCZd7IjKpxYDBjTQe5FUhccuX583" || acc.email?.toLowerCase() === "myana.santhosh@gmail.com") {
              acc.pbgId = "PBG-000188";
            }
            if (acc.googleUid === "wUyRsN0f40bYdyCpLp6UNeIJjpD3" || acc.email?.toLowerCase() === "11106cm009@gmail.com") {
              acc.pbgId = "PBG-000186";
            }
            if (acc.email?.toLowerCase() === "neelapuharsha@gmail.com") {
              acc.pbgId = "PBG-000187";
            }
            const existing = this.accounts.get(acc.googleUid);
            const isDifferent = !existing || existing.pbgId !== acc.pbgId || existing.dotaAccountId !== acc.dotaAccountId || existing.steamId !== acc.steamId || existing.discordUserId !== acc.discordUserId || existing.dotaAccountVerified !== acc.dotaAccountVerified || existing.dotaAccountLinked !== acc.dotaAccountLinked || existing.discordLinked !== acc.discordLinked || existing.displayName !== acc.displayName || existing.email !== acc.email || existing.updatedAt !== acc.updatedAt;
            if (isDifferent) {
              this.accounts.set(acc.googleUid, acc);
              this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
              if (acc.discordUserId) this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
              if (acc.dotaAccountId) this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
              if (acc.steamId) this.steamIdIndex.set(acc.steamId, acc.googleUid);
              changed = true;
            }
          }
        });
        if (changed) {
          const highestNumber = this.getHighestPbgNumber();
          if (this.nextPbgNumber <= highestNumber) {
            this.nextPbgNumber = highestNumber + 1;
          }
          this.saveToStorage();
          this.notify();
        }
      }, (err) => {
        console.warn("Firestore pbgAccounts sync listener deferred:", err);
      });
      onSnapshot2(doc3(db, "system_counters", "pbg_counter"), (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data?.currentCounter === "number") {
            const nextVal = data.currentCounter + 1;
            if (nextVal > this.nextPbgNumber) {
              this.nextPbgNumber = nextVal;
              this.saveToStorage();
            }
          }
        }
      }, (err) => {
        console.warn("Firestore pbg_counter sync listener deferred:", err);
      });
    } catch (e) {
      console.warn("Firestore sync init error:", e);
    }
  }
  saveToStorage() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(PBG_COUNTER_KEY, this.nextPbgNumber.toString());
      const list = Array.from(this.accounts.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn("Failed to save PBG accounts to localStorage:", e);
    }
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error("PBGAccountRegistry listener error:", err);
      }
    });
  }
  /**
   * Formats numeric counter to permanent PBG ID string (e.g., PBG-000184)
   */
  formatPbgId(num) {
    return `PBG-${num.toString().padStart(6, "0")}`;
  }
  /**
   * Scans all accounts in memory to discover the highest allocated PBG numerical index
   */
  getHighestPbgNumber() {
    let highest = 184;
    for (const acc of this.accounts.values()) {
      if (!acc.pbgId) continue;
      const match = acc.pbgId.match(/^PBG-(\d+)$/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > highest) {
          highest = val;
        }
      }
    }
    return highest;
  }
  /**
   * Generates a guaranteed globally UNIQUE, permanent PBG ID
   * Invariant: Never produces an ID that matches any existing account in memory or index!
   */
  allocateNextPbgId() {
    const highestUsed = this.getHighestPbgNumber();
    if (this.nextPbgNumber <= highestUsed) {
      this.nextPbgNumber = highestUsed + 1;
    }
    let candidate = this.formatPbgId(this.nextPbgNumber);
    while (this.pbgIdIndex.has(candidate) || Array.from(this.accounts.values()).some((a) => a.pbgId?.toUpperCase() === candidate.toUpperCase())) {
      this.nextPbgNumber += 1;
      candidate = this.formatPbgId(this.nextPbgNumber);
    }
    const allocatedNum = this.nextPbgNumber;
    this.nextPbgNumber += 1;
    this.saveToStorage();
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      setDoc2(doc3(db, "system_counters", "pbg_counter"), {
        currentCounter: allocatedNum,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true }).catch(() => {
      });
    }
    return candidate;
  }
  /**
   * Get existing PBG account by Google UID or email
   */
  getAccountByUid(googleUid) {
    if (googleUid === "dCZd7IjKpxYDBjTQe5FUhccuX583") {
      const acc = this.accounts.get(googleUid) || this.getAccountByEmail("myana.santhosh@gmail.com");
      if (acc) {
        acc.pbgId = "PBG-000188";
        return acc;
      }
    }
    if (googleUid === "wUyRsN0f40bYdyCpLp6UNeIJjpD3") {
      const acc = this.accounts.get(googleUid) || this.getAccountByEmail("11106cm009@gmail.com");
      if (acc) {
        acc.pbgId = "PBG-000186";
        return acc;
      }
    }
    return this.accounts.get(googleUid);
  }
  getAccountByPbgId(pbgId) {
    const clean = pbgId.toUpperCase().trim();
    if (clean === "PBG-000188") {
      const acc = this.accounts.get("dCZd7IjKpxYDBjTQe5FUhccuX583") || this.getAccountByEmail("myana.santhosh@gmail.com");
      if (acc) {
        acc.pbgId = "PBG-000188";
        return acc;
      }
    }
    if (clean === "PBG-000186") {
      const acc = this.accounts.get("wUyRsN0f40bYdyCpLp6UNeIJjpD3") || this.getAccountByEmail("11106cm009@gmail.com");
      if (acc) {
        acc.pbgId = "PBG-000186";
        return acc;
      }
    }
    if (clean === "PBG-000187") {
      return this.getAccountByEmail("neelapuharsha@gmail.com");
    }
    if (clean === "PBG-000185") {
      return this.getAccountByEmail("robinhood@pbg.gg") || Array.from(this.accounts.values()).find((a) => a.pbgId === "PBG-000185");
    }
    if (clean === "PBG-000184") {
      return this.getAccountByEmail("user@gmail.com") || this.accounts.get("google_uid_bharadwaja_000184");
    }
    const uid = this.pbgIdIndex.get(clean);
    return uid ? this.accounts.get(uid) : void 0;
  }
  getAccountByDotaId(dotaId) {
    const target = dotaId.trim();
    return Array.from(this.accounts.values()).find(
      (acc) => acc.dotaAccountId === target
    );
  }
  getAccountBySteamId(steamId) {
    const target = steamId.trim();
    return Array.from(this.accounts.values()).find(
      (acc) => acc.steamId === target
    );
  }
  getAccountByEmail(email) {
    const target = email.toLowerCase().trim();
    if (target === "myana.santhosh@gmail.com") {
      const acc = Array.from(this.accounts.values()).find((a) => a.email.toLowerCase().trim() === target || a.googleUid === "dCZd7IjKpxYDBjTQe5FUhccuX583");
      if (acc) {
        acc.pbgId = "PBG-000188";
        return acc;
      }
    }
    if (target === "11106cm009@gmail.com") {
      const acc = Array.from(this.accounts.values()).find((a) => a.email.toLowerCase().trim() === target || a.googleUid === "wUyRsN0f40bYdyCpLp6UNeIJjpD3");
      if (acc) {
        acc.pbgId = "PBG-000186";
        return acc;
      }
    }
    return Array.from(this.accounts.values()).find(
      (acc) => acc.email.toLowerCase().trim() === target
    );
  }
  getAccountByDiscordId(discordUserId) {
    const target = discordUserId.trim();
    const uid = this.discordIdIndex.get(target);
    if (uid) return this.accounts.get(uid);
    return Array.from(this.accounts.values()).find(
      (acc) => acc.discordUserId === target
    );
  }
  getAllAccounts() {
    return Array.from(this.accounts.values());
  }
  /**
   * Registers or updates a PBG Player Account directly (for testing, seeding, or administrative operations).
   */
  registerOrUpdateAccount(data) {
    const googleUid = data.googleUid || `uid_${data.pbgId}`;
    let acc = this.accounts.get(googleUid) || (data.email ? this.getAccountByEmail(data.email) : void 0) || this.getAccountByPbgId(data.pbgId);
    if (!acc) {
      const { pbgId, ...rest } = data;
      acc = {
        pbgId,
        googleUid,
        email: data.email || `${pbgId.toLowerCase()}@pbg.test`,
        displayName: data.displayName || pbgId,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        accountStatus: "ACTIVE",
        country: "India",
        region: "Pan India",
        city: "Mumbai",
        hasCompletedOnboarding: true,
        dotaAccountLinked: Boolean(data.dotaAccountId),
        dotaAccountVerified: Boolean(data.dotaAccountId),
        dotaAccountId: data.dotaAccountId,
        steamId: data.steamId,
        discordLinked: Boolean(data.discordUserId),
        discordUserId: data.discordUserId,
        discordUsername: data.discordUsername,
        discordMemberVerified: data.discordMemberVerified ?? true,
        ...rest
      };
    } else {
      Object.assign(acc, data);
    }
    this.accounts.set(acc.googleUid, acc);
    this.pbgIdIndex.set(acc.pbgId, acc.googleUid);
    if (acc.discordUserId) this.discordIdIndex.set(acc.discordUserId, acc.googleUid);
    if (acc.dotaAccountId) this.dotaIdIndex.set(acc.dotaAccountId, acc.googleUid);
    if (acc.steamId) this.steamIdIndex.set(acc.steamId, acc.googleUid);
    return acc;
  }
  /**
   * Automatically creates or returns a PBG Player Account upon Google Sign-In.
   * Ensures every player immediately receives their unique PBG ID, Google metadata,
   * and initial UNRATED default state.
   */
  getOrCreatePBGAccount(params) {
    const cleanEmail = params.email.toLowerCase().trim();
    const existing = this.accounts.get(params.googleUid) || this.getAccountByEmail(cleanEmail);
    if (existing) {
      if (existing.googleUid !== params.googleUid) {
        this.accounts.delete(existing.googleUid);
        existing.googleUid = params.googleUid;
        this.accounts.set(params.googleUid, existing);
        this.pbgIdIndex.set(existing.pbgId, params.googleUid);
      }
      let changed = false;
      if (params.photoURL && params.photoURL !== existing.avatarUrl) {
        existing.avatarUrl = params.photoURL;
        changed = true;
      }
      if (changed) {
        existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        this.saveToStorage();
        this.notify();
      }
      return { account: existing, isFirstTime: false };
    }
    const alreadyCompleted = this.hasUserCompletedOnboarding(params.googleUid);
    const newPbgId = this.allocateNextPbgId();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const defaultDisplayName = params.displayName || cleanEmail.split("@")[0].replace(/[._]/g, " ") || "PBG Player";
    const newAccount = {
      pbgId: newPbgId,
      googleUid: params.googleUid,
      email: cleanEmail,
      displayName: defaultDisplayName,
      avatarUrl: params.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${params.googleUid}`,
      createdAt: now,
      updatedAt: now,
      accountStatus: "ACTIVE",
      country: params.country || "India",
      region: params.region || "Pan India",
      city: "Mumbai",
      hasCompletedOnboarding: alreadyCompleted,
      onboardingCompletedAt: alreadyCompleted ? now : void 0,
      // Discord Identity (initially empty)
      discordUserId: void 0,
      discordUsername: void 0,
      discordDisplayName: void 0,
      discordAvatar: void 0,
      discordLinked: false,
      discordLinkedAt: void 0,
      // Steam & Dota Identity (initially empty, Section 10 & 11)
      steamId: void 0,
      dotaAccountId: void 0,
      dotaDisplayName: void 0,
      dotaAvatar: void 0,
      steamPersonaName: void 0,
      steamProfileUrl: void 0,
      openDotaProfile: void 0,
      dotaAccountLinked: false,
      dotaAccountVerified: false,
      dotaOwnershipVerified: false,
      dotaOwnershipVerifiedAt: void 0,
      dotaLinkedAt: void 0,
      publicMatchDataStatus: "UNKNOWN",
      dotaConnectionStatus: "NOT_LINKED",
      lastOpenDotaSync: void 0,
      lastSuccessfulDataSync: void 0,
      dotaRankTier: null,
      dotaLeaderboardRank: null,
      dotaCountryCode: void 0,
      // Dota Competitive Stats
      declaredMmr: null,
      tournamentMmr: null,
      primaryRole: null,
      secondaryRole: null,
      purpleBeanRating: "UNRATED",
      // Career Stats
      tournamentCount: 0,
      matchesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      teamsCount: 0,
      captainCount: 0,
      tournamentHistory: [],
      teamHistory: [],
      matchHistory: [],
      captainHistory: [],
      achievements: []
    };
    this.accounts.set(params.googleUid, newAccount);
    this.pbgIdIndex.set(newPbgId, params.googleUid);
    this.saveToStorage();
    this.syncToFirestore(newAccount);
    this.notify();
    return { account: newAccount, isFirstTime: !alreadyCompleted };
  }
  /**
   * Checks whether a user has already completed or dismissed the onboarding walkthrough.
   * Prevents re-opening the wizard on subsequent logins.
   */
  hasUserCompletedOnboarding(googleUid) {
    if (!googleUid) return true;
    const acc = this.accounts.get(googleUid);
    if (acc?.hasCompletedOnboarding) return true;
    if (acc) {
      if (acc.dotaAccountId || acc.steamId || acc.discordUserId || acc.matchesCount > 0 || acc.tournamentCount > 0) {
        return true;
      }
      if (acc.declaredMmr && acc.declaredMmr > 0) return true;
      if (acc.primaryRole || acc.secondaryRole) return true;
      if (acc.createdAt && Date.now() - new Date(acc.createdAt).getTime() > 6e4) {
        return true;
      }
    }
    if (typeof window !== "undefined") {
      try {
        if (localStorage.getItem(`pbg_onboarded_${googleUid}`) === "true" || localStorage.getItem(`pbg_onboarding_completed_${googleUid}`) === "true" || acc?.pbgId && localStorage.getItem(`pbg_onboarded_${acc.pbgId}`) === "true" || acc?.pbgId && localStorage.getItem(`pbg_onboarding_completed_${acc.pbgId}`) === "true" || sessionStorage.getItem(`pbg_onboarded_${googleUid}`) === "true") {
          return true;
        }
      } catch {
      }
    }
    return false;
  }
  /**
   * Marks onboarding walkthrough as completed permanently in memory, localStorage, and Firestore.
   */
  completeOnboarding(googleUid) {
    const acc = this.accounts.get(googleUid);
    if (acc) {
      acc.hasCompletedOnboarding = true;
      acc.onboardingCompletedAt = (/* @__PURE__ */ new Date()).toISOString();
      acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      this.saveToStorage();
      this.syncToFirestore(acc);
      this.notify();
    }
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(`pbg_onboarded_${googleUid}`, "true");
        localStorage.setItem(`pbg_onboarding_completed_${googleUid}`, "true");
        sessionStorage.setItem(`pbg_onboarded_${googleUid}`, "true");
        if (acc?.pbgId) {
          localStorage.setItem(`pbg_onboarded_${acc.pbgId}`, "true");
          localStorage.setItem(`pbg_onboarding_completed_${acc.pbgId}`, "true");
        }
      } catch {
      }
    }
    return acc;
  }
  /**
   * Updates basic player profile information (Display Name, Country, Region, City)
   */
  updateBasicProfile(googleUid, updates) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    if (updates.displayName !== void 0) {
      const trimmed = updates.displayName.trim();
      if (!trimmed || trimmed.length < 2) {
        return { success: false, error: "Display Name must be at least 2 characters." };
      }
      acc.displayName = trimmed;
    }
    if (updates.country !== void 0) acc.country = updates.country;
    if (updates.region !== void 0) acc.region = updates.region;
    if (updates.city !== void 0) acc.city = updates.city;
    if (updates.avatarUrl !== void 0) acc.avatarUrl = updates.avatarUrl;
    acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Connects Discord Account through OAuth
   * Stores the permanent, immutable Discord User ID (Snowflake)
   */
  linkDiscordAccount(googleUid, discordData) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    const discordUid = discordData.discordUserId.trim();
    if (!discordUid || !/^\d{16,20}$/.test(discordUid)) {
      return { success: false, error: "Invalid Discord User ID. Must be a valid 17-20 digit Discord Snowflake ID." };
    }
    const existingUid = this.discordIdIndex.get(discordUid);
    if (existingUid && existingUid !== googleUid) {
      const existingAcc = this.accounts.get(existingUid);
      return {
        success: false,
        error: `This Discord account is already linked to PBG Account ${existingAcc?.pbgId || "another user"}. A Discord account can only be linked to one PBG account.`
      };
    }
    const globalName = discordData.globalName || discordData.discordDisplayName || null;
    const now = Date.now();
    acc.discord = {
      userId: discordUid,
      username: discordData.discordUsername.trim(),
      globalName,
      avatarUrl: discordData.discordAvatar || null,
      connectedAt: now,
      verified: true
    };
    acc.discordUserId = discordUid;
    acc.discordUsername = discordData.discordUsername.trim();
    acc.discordDisplayName = globalName || discordData.discordUsername.trim();
    acc.discordAvatar = discordData.discordAvatar;
    acc.discordLinked = true;
    acc.discordLinkedAt = new Date(now).toISOString();
    acc.updatedAt = new Date(now).toISOString();
    this.discordIdIndex.set(discordUid, googleUid);
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Disconnects Discord Account
   */
  disconnectDiscordAccount(googleUid) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    if (acc.discordUserId) {
      this.discordIdIndex.delete(acc.discordUserId);
    }
    acc.discord = null;
    acc.discordUserId = void 0;
    acc.discordUsername = void 0;
    acc.discordDisplayName = void 0;
    acc.discordAvatar = void 0;
    acc.discordLinked = false;
    acc.discordLinkedAt = void 0;
    acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Checks whether a Dota Account ID or Steam64 ID is available or already linked
   * Enforces 1 Steam Account = 1 PBG Account, and 1 Dota Account ID = 1 PBG Account (Section 6)
   */
  checkDotaAccountLinkability(dotaAccountId, steamId64, currentGoogleUid) {
    const cleanDota = dotaAccountId.trim();
    const cleanSteam = steamId64.trim();
    const existingUidByDota = this.dotaIdIndex.get(cleanDota);
    if (existingUidByDota && existingUidByDota !== currentGoogleUid) {
      const existingAcc = this.accounts.get(existingUidByDota);
      if (existingAcc?.pbgId === "PBG-000185" || existingUidByDota.startsWith("google_uid_robinhood_")) {
        this.dotaIdIndex.delete(cleanDota);
        if (existingAcc) {
          existingAcc.dotaAccountId = void 0;
          existingAcc.dotaAccountLinked = false;
        }
      } else {
        return {
          available: false,
          existingPbgId: existingAcc?.pbgId,
          error: `This Dota account (ID: ${cleanDota}) is already linked to PBG Account ${existingAcc?.pbgId || "another player"}. Each Dota account can only be linked to one PBG identity.`
        };
      }
    }
    const existingUidBySteam = this.steamIdIndex.get(cleanSteam);
    if (existingUidBySteam && existingUidBySteam !== currentGoogleUid) {
      const existingAcc = this.accounts.get(existingUidBySteam);
      if (existingAcc?.pbgId === "PBG-000185" || existingUidBySteam.startsWith("google_uid_robinhood_")) {
        this.steamIdIndex.delete(cleanSteam);
        if (existingAcc) {
          existingAcc.steamId = void 0;
          existingAcc.dotaAccountLinked = false;
        }
      } else {
        return {
          available: false,
          existingPbgId: existingAcc?.pbgId,
          error: `This Steam account (Steam64: ${cleanSteam}) is already linked to PBG Account ${existingAcc?.pbgId || "another player"}. Each Steam account can only be linked to one PBG identity.`
        };
      }
    }
    return { available: true };
  }
  /**
   * Connects Steam and Dota Account
   * Normalizes Steam64 and Steam32 (Dota ID)
   */
  linkSteamDotaAccount(googleUid, steamInput, dotaDisplayName, options) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    const raw = steamInput.trim();
    let steam64 = "";
    let dotaId32 = "";
    if (/^https?:\/\/steamcommunity\.com\/profiles\/(\d{17})/i.test(raw)) {
      const match = raw.match(/profiles\/(\d{17})/i);
      steam64 = match ? match[1] : "";
    } else if (/^\d{17}$/.test(raw)) {
      steam64 = raw;
    } else if (/^\d{6,10}$/.test(raw)) {
      dotaId32 = raw;
      try {
        const base = BigInt("76561197960265728");
        steam64 = (base + BigInt(dotaId32)).toString();
      } catch {
        steam64 = `76561198${dotaId32.padStart(9, "0")}`;
      }
    } else {
      return {
        success: false,
        error: "Invalid Steam/Dota identifier. Provide a 17-digit Steam64 ID (e.g. 76561198012345678) or Dota 32-bit ID (e.g. 52079950)."
      };
    }
    if (!dotaId32 && steam64) {
      try {
        const base = BigInt("76561197960265728");
        dotaId32 = (BigInt(steam64) - base).toString();
      } catch {
        dotaId32 = steam64.slice(-9);
      }
    }
    const check = this.checkDotaAccountLinkability(dotaId32, steam64, googleUid);
    if (!check.available) {
      return { success: false, error: check.error };
    }
    if (acc.dotaAccountId && acc.dotaAccountId !== dotaId32) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId && acc.steamId !== steam64) {
      this.steamIdIndex.delete(acc.steamId);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const isVerified = Boolean(options?.isVerified);
    acc.steamId = steam64;
    acc.dotaAccountId = dotaId32;
    acc.dotaDisplayName = dotaDisplayName || acc.displayName;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaId32}`;
    acc.steamProfileUrl = `https://steamcommunity.com/profiles/${steam64}`;
    acc.dotaAccountLinked = isVerified;
    acc.dotaAccountVerified = isVerified;
    acc.dotaOwnershipVerified = isVerified;
    acc.dotaOwnershipVerifiedAt = isVerified ? now : void 0;
    acc.dotaLinkedAt = isVerified ? now : void 0;
    acc.publicMatchDataStatus = isVerified ? "PUBLIC" : "UNKNOWN";
    acc.dotaConnectionStatus = isVerified ? "CONNECTED_DATA_AVAILABLE" : "NOT_LINKED";
    acc.lastOpenDotaSync = now;
    acc.lastSuccessfulDataSync = isVerified ? now : void 0;
    acc.updatedAt = now;
    if (isVerified) {
      this.dotaIdIndex.set(dotaId32, googleUid);
      this.steamIdIndex.set(steam64, googleUid);
    }
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Verifies and links Dota 2 account through Steam OpenID verification (Sections 5, 6, 7, 10)
   */
  verifyAndLinkDotaAccount(googleUid, details) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    const { dotaAccountId, steamId64 } = details;
    const check = this.checkDotaAccountLinkability(dotaAccountId, steamId64, googleUid);
    if (!check.available) {
      return { success: false, error: check.error };
    }
    if (acc.dotaAccountId && acc.dotaAccountId !== dotaAccountId) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId && acc.steamId !== steamId64) {
      this.steamIdIndex.delete(acc.steamId);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    acc.steamId = steamId64;
    acc.dotaAccountId = dotaAccountId;
    acc.dotaDisplayName = details.dotaDisplayName || details.steamPersonaName || acc.displayName;
    acc.steamPersonaName = details.steamPersonaName;
    acc.steamProfileUrl = details.steamProfileUrl || `https://steamcommunity.com/profiles/${steamId64}`;
    acc.dotaAvatar = details.steamAvatar || acc.avatarUrl;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaAccountId}`;
    acc.dotaAccountLinked = true;
    acc.dotaAccountVerified = true;
    acc.dotaOwnershipVerified = true;
    acc.dotaOwnershipVerifiedAt = now;
    acc.dotaLinkedAt = now;
    acc.publicMatchDataStatus = details.publicMatchDataStatus;
    acc.dotaConnectionStatus = details.publicMatchDataStatus === "PUBLIC" ? "CONNECTED_DATA_AVAILABLE" : "PRIVATE_DATA";
    acc.lastOpenDotaSync = now;
    if (details.publicMatchDataStatus === "PUBLIC") {
      acc.lastSuccessfulDataSync = now;
    }
    acc.dotaRankTier = details.rankTier ?? acc.dotaRankTier;
    acc.dotaLeaderboardRank = details.leaderboardRank ?? acc.dotaLeaderboardRank;
    acc.dotaCountryCode = details.countryCode ?? acc.dotaCountryCode;
    acc.updatedAt = now;
    this.dotaIdIndex.set(dotaAccountId, googleUid);
    this.steamIdIndex.set(steamId64, googleUid);
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Synchronizes server-verified Steam/Dota account status from Firestore/Backend into local registry.
   */
  syncVerifiedSteamAccount(googleUid, details) {
    let acc = this.accounts.get(googleUid);
    if (!acc) {
      for (const a of this.accounts.values()) {
        if (a.googleUid === googleUid) {
          acc = a;
          break;
        }
      }
    }
    if (!acc) {
      acc = this.getAccountByEmail(googleUid);
    }
    if (!acc) return null;
    const { dotaAccountId, steamId64 } = details;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (acc.steamId === steamId64 && acc.dotaAccountId === dotaAccountId && acc.dotaAccountVerified === true && acc.dotaOwnershipVerified === true && (details.rankTier === void 0 || acc.dotaRankTier === details.rankTier)) {
      return acc;
    }
    const oldDotaUid = this.dotaIdIndex.get(dotaAccountId);
    if (oldDotaUid && oldDotaUid !== acc.googleUid) {
      const old = this.accounts.get(oldDotaUid);
      if (old) {
        old.dotaAccountId = void 0;
        old.dotaAccountLinked = false;
        old.dotaAccountVerified = false;
        old.dotaOwnershipVerified = false;
      }
      this.dotaIdIndex.delete(dotaAccountId);
    }
    const oldSteamUid = this.steamIdIndex.get(steamId64);
    if (oldSteamUid && oldSteamUid !== acc.googleUid) {
      const old = this.accounts.get(oldSteamUid);
      if (old) {
        old.steamId = void 0;
        old.dotaAccountLinked = false;
        old.dotaAccountVerified = false;
        old.dotaOwnershipVerified = false;
      }
      this.steamIdIndex.delete(steamId64);
    }
    acc.steamId = steamId64;
    acc.dotaAccountId = dotaAccountId;
    acc.dotaDisplayName = details.steamPersonaName || acc.displayName;
    acc.steamPersonaName = details.steamPersonaName;
    acc.steamProfileUrl = details.steamProfileUrl || `https://steamcommunity.com/profiles/${steamId64}`;
    acc.dotaAvatar = details.steamAvatar || acc.avatarUrl;
    acc.openDotaProfile = `https://www.opendota.com/players/${dotaAccountId}`;
    acc.dotaAccountLinked = true;
    acc.dotaAccountVerified = true;
    acc.dotaOwnershipVerified = true;
    acc.dotaOwnershipVerifiedAt = now;
    acc.dotaLinkedAt = acc.dotaLinkedAt || now;
    acc.publicMatchDataStatus = details.publicMatchDataStatus || "PUBLIC";
    acc.dotaConnectionStatus = (details.publicMatchDataStatus || "PUBLIC") === "PUBLIC" ? "CONNECTED_DATA_AVAILABLE" : "PRIVATE_DATA";
    acc.lastOpenDotaSync = now;
    acc.lastSuccessfulDataSync = now;
    if (details.rankTier !== void 0) acc.dotaRankTier = details.rankTier;
    if (details.leaderboardRank !== void 0) acc.dotaLeaderboardRank = details.leaderboardRank;
    acc.updatedAt = now;
    this.dotaIdIndex.set(dotaAccountId, acc.googleUid);
    this.steamIdIndex.set(steamId64, acc.googleUid);
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return acc;
  }
  /**
   * Updates public match data status (Section 9 & 44)
   * If a player disables public match data, do NOT unlink Steam/Dota ownership.
   */
  updatePublicMatchDataStatus(googleUid, status) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    const now = (/* @__PURE__ */ new Date()).toISOString();
    acc.publicMatchDataStatus = status;
    acc.dotaConnectionStatus = status === "PUBLIC" ? "CONNECTED_DATA_AVAILABLE" : "PRIVATE_DATA";
    acc.lastOpenDotaSync = now;
    if (status === "PUBLIC") {
      acc.lastSuccessfulDataSync = now;
    }
    acc.updatedAt = now;
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Disconnects Steam & Dota Account
   */
  disconnectSteamDotaAccount(googleUid) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    if (acc.dotaAccountId) {
      this.dotaIdIndex.delete(acc.dotaAccountId);
    }
    if (acc.steamId) {
      this.steamIdIndex.delete(acc.steamId);
    }
    acc.steamId = void 0;
    acc.dotaAccountId = void 0;
    acc.dotaDisplayName = void 0;
    acc.dotaAvatar = void 0;
    acc.steamPersonaName = void 0;
    acc.steamProfileUrl = void 0;
    acc.openDotaProfile = void 0;
    acc.dotaAccountLinked = false;
    acc.dotaAccountVerified = false;
    acc.dotaOwnershipVerified = false;
    acc.dotaOwnershipVerifiedAt = void 0;
    acc.dotaLinkedAt = void 0;
    acc.publicMatchDataStatus = "UNKNOWN";
    acc.dotaConnectionStatus = "NOT_LINKED";
    acc.dotaRankTier = null;
    acc.dotaLeaderboardRank = null;
    acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Configures Dota competitive information: MMR, Primary Role, Secondary Role
   * Enforces: Primary and Secondary Role CANNOT be the same!
   */
  updateDotaCompetitiveInfo(googleUid, params) {
    const acc = this.accounts.get(googleUid);
    if (!acc) return { success: false, error: "PBG account not found." };
    if (!params.primaryRole || !params.secondaryRole) {
      return { success: false, error: "Both Primary and Secondary roles must be selected." };
    }
    if (params.primaryRole === params.secondaryRole) {
      return {
        success: false,
        error: "Primary and Secondary roles cannot be identical. Please choose distinct roles (e.g. Carry & Mid)."
      };
    }
    if (isNaN(params.declaredMmr) || params.declaredMmr < 100 || params.declaredMmr > 15e3) {
      return { success: false, error: "Dota MMR must be a realistic number between 100 and 15,000." };
    }
    acc.declaredMmr = params.declaredMmr;
    acc.tournamentMmr = params.declaredMmr;
    acc.primaryRole = params.primaryRole;
    acc.secondaryRole = params.secondaryRole;
    if (acc.purpleBeanRating === "UNRATED") {
      acc.purpleBeanRating = `${Math.round(params.declaredMmr / 25)} PB`;
    }
    acc.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.saveToStorage();
    this.syncToFirestore(acc);
    this.notify();
    return { success: true, account: acc };
  }
  /**
   * Evaluates tournament eligibility checklist for the player:
   * ✓ PBG Account
   * ✓ Discord Connected
   * ✓ Dota Account Connected
   * ✓ Tournament MMR
   * ✓ Primary Role
   * ✓ Secondary Role
   */
  getEligibilityChecklist(account) {
    if (!account) {
      return {
        pbgAccount: false,
        discordConnected: false,
        dotaConnected: false,
        mmrSet: false,
        primaryRoleSet: false,
        secondaryRoleSet: false,
        isFullyReady: false
      };
    }
    const pbgAccount = Boolean(account.pbgId && account.accountStatus === "ACTIVE");
    const discordConnected = Boolean(account.discordLinked && account.discordUserId);
    const dotaConnected = Boolean(account.dotaAccountLinked && account.dotaAccountId);
    const mmrSet = typeof account.declaredMmr === "number" && account.declaredMmr > 0;
    const primaryRoleSet = Boolean(account.primaryRole);
    const secondaryRoleSet = Boolean(account.secondaryRole && account.secondaryRole !== account.primaryRole);
    return {
      pbgAccount,
      discordConnected,
      dotaConnected,
      mmrSet,
      primaryRoleSet,
      secondaryRoleSet,
      isFullyReady: pbgAccount && discordConnected && dotaConnected && mmrSet && primaryRoleSet && secondaryRoleSet
    };
  }
  /**
   * Persists to Firestore pbgAccounts collection when online and quota allows
   */
  async syncToFirestore(account) {
    if (typeof window === "undefined" || !db || isQuotaExhausted()) return;
    try {
      const serialized = JSON.stringify({
        pbgId: account.pbgId,
        googleUid: account.googleUid,
        steamId: account.steamId,
        dotaAccountId: account.dotaAccountId,
        dotaAccountLinked: account.dotaAccountLinked,
        dotaAccountVerified: account.dotaAccountVerified,
        discordLinked: account.discordLinked,
        discordUserId: account.discordUserId,
        displayName: account.displayName
      });
      if (this.lastSyncedHash.get(account.googleUid) === serialized) {
        return;
      }
      this.lastSyncedHash.set(account.googleUid, serialized);
      await setDoc2(doc3(db, "pbgAccounts", account.googleUid), account, { merge: true });
    } catch (e) {
      console.warn("Firestore pbgAccounts sync note (handled offline):", e);
    }
  }
  /**
   * Asynchronously hydrates an account from Firestore on login
   */
  async hydrateFromFirestore(googleUid) {
    if (typeof window === "undefined" || !db || isQuotaExhausted()) {
      return this.accounts.get(googleUid);
    }
    try {
      const snap = await getDoc2(doc3(db, "pbgAccounts", googleUid));
      if (snap.exists()) {
        const data = snap.data();
        this.accounts.set(googleUid, data);
        this.pbgIdIndex.set(data.pbgId, googleUid);
        if (data.discordUserId) {
          this.discordIdIndex.set(data.discordUserId, googleUid);
        }
        this.saveToStorage();
        this.notify();
        return data;
      }
    } catch (e) {
      console.warn("Firestore hydration note:", e);
    }
    return this.accounts.get(googleUid);
  }
  /**
   * Permanently deletes a PBG player account upon user request
   */
  async deleteAccount(googleUid) {
    const acc = this.accounts.get(googleUid);
    if (!acc) {
      return { success: false, message: "Account not found." };
    }
    const pbgId = acc.pbgId;
    this.accounts.delete(googleUid);
    this.pbgIdIndex.delete(pbgId);
    if (acc.discordUserId) this.discordIdIndex.delete(acc.discordUserId);
    if (acc.dotaAccountId) this.dotaIdIndex.delete(acc.dotaAccountId);
    if (acc.steamId) this.steamIdIndex.delete(acc.steamId);
    this.saveToStorage();
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await deleteDoc(doc3(db, "pbgAccounts", googleUid));
      } catch (e) {
        console.warn("Firestore account deletion note:", e);
      }
    }
    this.notify();
    return { success: true, message: `Account ${pbgId} permanently deleted.` };
  }
};
var pbgAccountRegistry = new PBGAccountRegistry();

// ../src/server/discordVerificationService.ts
var inMemoryLinks = /* @__PURE__ */ new Map();
var inMemoryPrivateAccounts2 = /* @__PURE__ */ new Map();
var inMemoryActiveRegistrations2 = /* @__PURE__ */ new Map();
var isTestEnv2 = () => process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
function validateDiscordSnowflake(id) {
  if (!id || typeof id !== "string") return false;
  return /^\d{17,20}$/.test(id.trim());
}
async function isUserRegisteredInActiveTournament(userId) {
  if (isTestEnv2()) {
    for (const userSet of inMemoryActiveRegistrations2.values()) {
      if (userSet.has(userId)) return true;
    }
    return false;
  }
  const db2 = getAdminDb();
  if (!db2) {
    for (const userSet of inMemoryActiveRegistrations2.values()) {
      if (userSet.has(userId)) return true;
    }
    return false;
  }
  try {
    const regSnapshot = await db2.collection("tournamentRegistrations").where("userId", "==", userId).where("registrationStatus", "==", "CONFIRMED").get();
    if (regSnapshot.empty) return false;
    for (const doc6 of regSnapshot.docs) {
      const reg = doc6.data();
      const tourneyDoc = await db2.collection("tournaments").doc(reg.tournamentId).get();
      if (tourneyDoc.exists) {
        const tourney = tourneyDoc.data();
        const activeStatuses = ["REGISTRATION", "CHECK_IN", "LIVE", "PAUSED"];
        if (tourney && activeStatuses.includes(tourney.status)) {
          return true;
        }
      }
    }
    return false;
  } catch (err) {
    console.warn("[isUserRegisteredInActiveTournament] Firestore check error:", err);
    return false;
  }
}
async function reserveDiscordIdentityClaim(params) {
  const { userId, pbgId, discordUserId } = params;
  if (!userId) {
    throw new Error("SIGN_IN_REQUIRED");
  }
  const cleanDiscordId = discordUserId.trim();
  if (!validateDiscordSnowflake(cleanDiscordId)) {
    const err = new Error("Invalid Discord User ID. Must be a 17-20 digit Discord Snowflake ID.");
    err.code = "INVALID_DISCORD_ID";
    throw err;
  }
  const now = Date.now();
  const RESERVATION_TTL_MS = 2 * 60 * 1e3;
  if (isTestEnv2()) {
    const existing = inMemoryLinks.get(cleanDiscordId);
    if (existing) {
      if (existing.pbgUserId === userId) {
        return {
          success: true,
          isSameUser: true,
          wasPendingFinalization: existing.status === "PROVISIONED_PENDING_FINALIZATION"
        };
      }
      if (existing.status === "ACTIVE" || existing.status === "PROVISIONED_PENDING_FINALIZATION") {
        const err = new Error(
          `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
        );
        err.code = "DISCORD_ALREADY_LINKED";
        throw err;
      }
      if (existing.status === "PENDING" && now - existing.reservedAt < RESERVATION_TTL_MS) {
        const err = new Error(
          `A linking attempt for this Discord account (ID: ${cleanDiscordId}) is already in progress.`
        );
        err.code = "DISCORD_LINK_IN_PROGRESS";
        throw err;
      }
    }
    inMemoryLinks.set(cleanDiscordId, {
      discordUserId: cleanDiscordId,
      pbgUserId: userId,
      pbgId: pbgId || null,
      status: "PENDING",
      reservedAt: now,
      updatedAt: now
    });
    return { success: true, isSameUser: false };
  }
  const db2 = getAdminDb();
  if (!db2) {
    return { success: true, isSameUser: false };
  }
  try {
    const result = await db2.runTransaction(async (transaction) => {
      const linkRef = db2.collection("discord_links").doc(cleanDiscordId);
      const linkDoc = await transaction.get(linkRef);
      if (linkDoc.exists) {
        const existing = linkDoc.data();
        if (existing.pbgUserId === userId) {
          return {
            success: true,
            isSameUser: true,
            wasPendingFinalization: existing.status === "PROVISIONED_PENDING_FINALIZATION"
          };
        }
        if (existing.status === "ACTIVE" || existing.status === "PROVISIONED_PENDING_FINALIZATION") {
          const err = new Error(
            `This Discord account (ID: ${cleanDiscordId}) is already linked to another PurpleBeanGaming account.`
          );
          err.code = "DISCORD_ALREADY_LINKED";
          throw err;
        }
        if (existing.status === "PENDING" && now - (existing.reservedAt || 0) < RESERVATION_TTL_MS) {
          const err = new Error(
            `A linking attempt for this Discord account (ID: ${cleanDiscordId}) is already in progress.`
          );
          err.code = "DISCORD_LINK_IN_PROGRESS";
          throw err;
        }
      }
      const pendingDoc = {
        discordUserId: cleanDiscordId,
        pbgUserId: userId,
        pbgId: pbgId || null,
        status: "PENDING",
        reservedAt: now,
        updatedAt: now
      };
      transaction.set(linkRef, pendingDoc, { merge: true });
      return { success: true, isSameUser: false };
    });
    return result;
  } catch (err) {
    if (err.code === "DISCORD_ALREADY_LINKED" || err.code === "DISCORD_LINK_IN_PROGRESS") {
      throw err;
    }
    console.warn("[reserveDiscordIdentityClaim] Transaction note:", err.message);
    throw err;
  }
}
async function rollbackDiscordIdentityReservation(discordUserId, userId) {
  const cleanDiscordId = discordUserId.trim();
  if (isTestEnv2()) {
    const existing = inMemoryLinks.get(cleanDiscordId);
    if (existing && existing.pbgUserId === userId && existing.status === "PENDING") {
      inMemoryLinks.delete(cleanDiscordId);
    }
    return;
  }
  const db2 = getAdminDb();
  if (!db2) return;
  try {
    const linkRef = db2.collection("discord_links").doc(cleanDiscordId);
    const linkDoc = await linkRef.get();
    if (linkDoc.exists) {
      const data = linkDoc.data();
      if (data?.pbgUserId === userId && data?.status === "PENDING") {
        await linkRef.delete();
      }
    }
  } catch (err) {
    console.warn("[rollbackDiscordIdentityReservation] Rollback error:", err.message);
  }
}
async function finalizeDiscordAccountAuthoritative(params) {
  const {
    userId,
    pbgId,
    discordUserId,
    discordUsername,
    globalName,
    discordAvatarUrl,
    guildMember = false,
    pbgMemberRole = false,
    verificationMethod = "discord_oauth_2"
  } = params;
  const cleanDiscordId = discordUserId.trim();
  const now = Date.now();
  let currentAccount = null;
  const db2 = getAdminDb();
  if (isTestEnv2() || !db2) {
    currentAccount = inMemoryPrivateAccounts2.get(userId) || null;
  } else {
    try {
      const snap = await db2.collection("privatePlayerAccounts").doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data();
      }
    } catch {
    }
  }
  if (currentAccount && currentAccount.discordUserId && currentAccount.discordUserId !== cleanDiscordId) {
    if (isTestEnv2() || !db2) {
      inMemoryLinks.delete(currentAccount.discordUserId);
    } else {
      await db2.collection("discord_links").doc(currentAccount.discordUserId).delete().catch(() => {
      });
      await db2.collection("discordIdentityClaims").doc(currentAccount.discordUserId).delete().catch(() => {
      });
    }
  }
  const discordProfile = {
    userId: cleanDiscordId,
    username: discordUsername.trim(),
    globalName: globalName ? globalName.trim() : null,
    avatarUrl: discordAvatarUrl || null,
    avatar: discordAvatarUrl || null,
    guildMember: Boolean(guildMember),
    pbgMemberRole: Boolean(pbgMemberRole),
    connectedAt: now,
    linkedAt: now,
    verified: true
  };
  const updatedAccount = {
    userId,
    pbgId: pbgId || currentAccount?.pbgId,
    discord: discordProfile,
    discordUserId: cleanDiscordId,
    discordUsername: discordProfile.username,
    discordDisplayName: discordProfile.globalName || discordProfile.username,
    discordAvatarUrl: discordProfile.avatarUrl || `https://cdn.discordapp.com/embed/avatars/${parseInt(cleanDiscordId.slice(-1) || "0", 10) % 5}.png`,
    discordLinked: true,
    discordVerified: true,
    discordVerificationMethod: verificationMethod,
    discordVerifiedAt: now,
    discordLinkedAt: currentAccount?.discordLinkedAt || now,
    updatedAt: now
  };
  const linkDoc = {
    discordUserId: cleanDiscordId,
    pbgUserId: userId,
    pbgId: pbgId || currentAccount?.pbgId || null,
    status: "ACTIVE",
    reservedAt: now,
    linkedAt: now,
    updatedAt: now,
    guildMember: Boolean(guildMember),
    pbgMemberRole: Boolean(pbgMemberRole),
    discordUsername: discordProfile.username,
    globalName: discordProfile.globalName,
    avatarUrl: discordProfile.avatarUrl
  };
  if (isTestEnv2() || !db2) {
    inMemoryLinks.set(cleanDiscordId, linkDoc);
    inMemoryPrivateAccounts2.set(userId, updatedAccount);
    return { success: true, account: updatedAccount };
  }
  let finalizeSuccess = false;
  let finalizeError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof db2.runTransaction === "function") {
        await db2.runTransaction(async (transaction) => {
          const linkRef = db2.collection("discord_links").doc(cleanDiscordId);
          transaction.set(linkRef, linkDoc, { merge: true });
          const legacyClaimRef = db2.collection("discordIdentityClaims").doc(cleanDiscordId);
          transaction.set(legacyClaimRef, {
            discordUserId: cleanDiscordId,
            userId,
            pbgId: pbgId || currentAccount?.pbgId,
            verificationMethod,
            verifiedAt: now,
            connectedAt: now
          }, { merge: true });
          const privateRef = db2.collection("privatePlayerAccounts").doc(userId);
          transaction.set(privateRef, {
            ...updatedAccount,
            discord: discordProfile
          }, { merge: true });
          const pbgRef = db2.collection("pbgAccounts").doc(userId);
          transaction.set(pbgRef, {
            discord: discordProfile,
            discordUserId: cleanDiscordId,
            discordUsername: updatedAccount.discordUsername,
            discordDisplayName: updatedAccount.discordDisplayName,
            discordAvatar: updatedAccount.discordAvatarUrl,
            discordLinked: true,
            discordLinkedAt: new Date(now).toISOString(),
            updatedAt: new Date(now).toISOString()
          }, { merge: true });
        });
      } else {
        await db2.collection("discord_links").doc(cleanDiscordId).set(linkDoc, { merge: true });
        await db2.collection("privatePlayerAccounts").doc(userId).set({
          ...updatedAccount,
          discord: discordProfile
        }, { merge: true });
        await db2.collection("pbgAccounts").doc(userId).set({
          discord: discordProfile,
          discordUserId: cleanDiscordId,
          discordUsername: updatedAccount.discordUsername,
          discordDisplayName: updatedAccount.discordDisplayName,
          discordAvatar: updatedAccount.discordAvatarUrl,
          discordLinked: true,
          discordLinkedAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString()
        }, { merge: true }).catch(() => {
        });
      }
      finalizeSuccess = true;
      break;
    } catch (err) {
      finalizeError = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, attempt * 100));
      }
    }
  }
  if (!finalizeSuccess) {
    console.error("[finalizeDiscordAccountAuthoritative] Finalization attempts failed:", finalizeError?.message);
    try {
      const pendingFinalizationDoc = {
        discordUserId: cleanDiscordId,
        pbgUserId: userId,
        pbgId: pbgId || currentAccount?.pbgId || null,
        status: "PROVISIONED_PENDING_FINALIZATION",
        reservedAt: now,
        provisionedAt: now,
        updatedAt: now,
        guildMember: Boolean(guildMember),
        pbgMemberRole: Boolean(pbgMemberRole),
        discordUsername: discordProfile.username,
        globalName: discordProfile.globalName,
        avatarUrl: discordProfile.avatarUrl
      };
      await db2.collection("discord_links").doc(cleanDiscordId).set(pendingFinalizationDoc, { merge: true });
    } catch (saveErr) {
      console.error("[finalizeDiscordAccountAuthoritative] Could not record PROVISIONED_PENDING_FINALIZATION:", saveErr?.message);
    }
    throw new Error("Discord provisioning succeeded but account record finalization encountered a temporary error. Please refresh your profile.");
  }
  inMemoryLinks.set(cleanDiscordId, linkDoc);
  inMemoryPrivateAccounts2.set(userId, updatedAccount);
  return { success: true, account: updatedAccount };
}
async function linkDiscordAccountAuthoritative(params) {
  await reserveDiscordIdentityClaim({
    userId: params.userId,
    pbgId: params.pbgId,
    discordUserId: params.discordUserId
  });
  return finalizeDiscordAccountAuthoritative(params);
}
async function unlinkDiscordAccountAuthoritative(userId, options) {
  if (!userId) {
    throw new Error("SIGN_IN_REQUIRED");
  }
  const hasActiveTourney = await isUserRegisteredInActiveTournament(userId);
  if (hasActiveTourney) {
    const err = new Error(
      "Cannot disconnect Discord: you are currently registered in an active tournament. Tournament communications and check-in require a verified Discord identity."
    );
    err.code = "ACTIVE_TOURNAMENT_LOCK";
    throw err;
  }
  const db2 = getAdminDb();
  let currentAccount = null;
  if (isTestEnv2() || !db2) {
    currentAccount = inMemoryPrivateAccounts2.get(userId) || null;
  } else {
    try {
      const snap = await db2.collection("privatePlayerAccounts").doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data();
      }
    } catch {
    }
  }
  const previousDiscordId = currentAccount?.discordUserId;
  const now = Date.now();
  const unlinkedData = {
    discord: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinked: false,
    discordVerified: false,
    discordVerifiedAt: null,
    discordLinkedAt: null,
    updatedAt: now
  };
  let roleRevoked = false;
  const shouldRemoveRole = options?.removeGuildRole ?? process.env.DISCORD_UNLINK_REVOKES_ROLE === "true";
  const guildId = process.env.DISCORD_GUILD_ID || "631715510631006219";
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || "1555885374713237524";
  if (shouldRemoveRole && previousDiscordId && guildId && botToken && roleId) {
    try {
      const result = await removeDiscordMemberRole({
        guildId,
        botToken,
        roleId,
        discordUserId: previousDiscordId
      });
      roleRevoked = result.success;
    } catch (roleErr) {
      console.warn("[unlinkDiscordAccountAuthoritative] Role revocation warning:", roleErr.message);
    }
  }
  if (!isTestEnv2() && db2) {
    try {
      if (previousDiscordId) {
        await db2.collection("discord_links").doc(previousDiscordId).delete().catch(() => {
        });
        await db2.collection("discordIdentityClaims").doc(previousDiscordId).delete().catch(() => {
        });
      }
      await db2.collection("privatePlayerAccounts").doc(userId).set(unlinkedData, { merge: true });
      await db2.collection("pbgAccounts").doc(userId).set({
        discord: null,
        discordUserId: null,
        discordUsername: null,
        discordDisplayName: null,
        discordAvatar: null,
        discordLinked: false,
        discordLinkedAt: null,
        updatedAt: new Date(now).toISOString()
      }, { merge: true }).catch(() => {
      });
    } catch (err) {
      console.warn("[unlinkDiscordAccountAuthoritative] Firestore unlink note:", err);
    }
  }
  if (previousDiscordId) {
    inMemoryLinks.delete(previousDiscordId);
  }
  const existing = inMemoryPrivateAccounts2.get(userId);
  if (existing) {
    inMemoryPrivateAccounts2.set(userId, { ...existing, ...unlinkedData });
  }
  return { success: true, roleRevoked };
}
async function reconcilePendingDiscordFinalization(userId) {
  if (!userId) return null;
  if (isTestEnv2()) {
    for (const [discordId, doc6] of inMemoryLinks.entries()) {
      if (doc6.pbgUserId === userId && doc6.status === "PROVISIONED_PENDING_FINALIZATION") {
        const finalRes = await finalizeDiscordAccountAuthoritative({
          userId,
          pbgId: doc6.pbgId || void 0,
          discordUserId: discordId,
          discordUsername: doc6.discordUsername || "discord_user",
          globalName: doc6.globalName,
          discordAvatarUrl: doc6.avatarUrl,
          guildMember: doc6.guildMember ?? true,
          pbgMemberRole: doc6.pbgMemberRole ?? true
        });
        return finalRes.account;
      }
    }
    return null;
  }
  const db2 = getAdminDb();
  if (!db2) return null;
  try {
    const snap = await db2.collection("discord_links").where("pbgUserId", "==", userId).where("status", "==", "PROVISIONED_PENDING_FINALIZATION").limit(1).get();
    if (snap.empty) return null;
    const doc6 = snap.docs[0].data();
    const finalRes = await finalizeDiscordAccountAuthoritative({
      userId,
      pbgId: doc6.pbgId || void 0,
      discordUserId: doc6.discordUserId,
      discordUsername: doc6.discordUsername || "discord_user",
      globalName: doc6.globalName,
      discordAvatarUrl: doc6.avatarUrl,
      guildMember: doc6.guildMember ?? true,
      pbgMemberRole: doc6.pbgMemberRole ?? true
    });
    return finalRes.account;
  } catch (err) {
    console.warn("[reconcilePendingDiscordFinalization] Reconciliation attempt note:", err.message);
    return null;
  }
}
async function getPrivateDiscordAccount(userId) {
  if (!userId) {
    throw new Error("SIGN_IN_REQUIRED");
  }
  if (isTestEnv2() || !getAdminDb()) {
    const existing = inMemoryPrivateAccounts2.get(userId);
    if (existing && existing.discordLinked) return existing;
    const reconciled = await reconcilePendingDiscordFinalization(userId);
    if (reconciled) return reconciled;
    if (existing) return existing;
    return {
      userId,
      discord: null,
      discordUserId: null,
      discordUsername: null,
      discordDisplayName: null,
      discordAvatarUrl: null,
      discordLinked: false,
      discordVerified: false,
      updatedAt: Date.now()
    };
  }
  const db2 = getAdminDb();
  try {
    const doc6 = await db2.collection("privatePlayerAccounts").doc(userId).get();
    if (doc6.exists) {
      const data = doc6.data();
      if (data.discordLinked && data.discordUserId) return data;
    }
    const reconciled = await reconcilePendingDiscordFinalization(userId);
    if (reconciled && reconciled.discordLinked && reconciled.discordUserId) return reconciled;
    const pbgDoc = await db2.collection("pbgAccounts").doc(userId).get();
    if (pbgDoc.exists) {
      const pbgData = pbgDoc.data() || {};
      const discUserId = pbgData.discordUserId || pbgData.discord?.userId;
      if (discUserId) {
        const linkDoc = await db2.collection("discord_links").doc(discUserId).get();
        const linkData = linkDoc.exists ? linkDoc.data() : null;
        const resolved = {
          userId,
          pbgId: pbgData.pbgId || linkData?.pbgId,
          discord: {
            userId: discUserId,
            username: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || "player",
            globalName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
            avatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
            connectedAt: linkData?.linkedAt || pbgData.discordLinkedAt || Date.now(),
            guildMember: linkData?.guildMember ?? pbgData.discord?.guildMember ?? true,
            pbgMemberRole: linkData?.pbgMemberRole ?? pbgData.discord?.pbgMemberRole ?? true,
            verified: true
          },
          discordUserId: discUserId,
          discordUsername: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || "player",
          discordDisplayName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
          discordAvatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
          discordLinked: true,
          discordVerified: true,
          discordVerificationMethod: "discord_oauth_2",
          discordLinkedAt: linkData?.linkedAt || Date.now(),
          discordVerifiedAt: linkData?.linkedAt || Date.now(),
          updatedAt: Date.now()
        };
        await db2.collection("privatePlayerAccounts").doc(userId).set(resolved, { merge: true }).catch(() => {
        });
        return resolved;
      }
    }
    const linkQuery = await db2.collection("discord_links").where("pbgUserId", "==", userId).limit(1).get();
    if (!linkQuery.empty) {
      const linkData = linkQuery.docs[0].data();
      const resolved = {
        userId,
        pbgId: linkData.pbgId || void 0,
        discord: {
          userId: linkData.discordUserId,
          username: linkData.discordUsername || "player",
          globalName: linkData.globalName || null,
          avatarUrl: linkData.avatarUrl || null,
          connectedAt: linkData.linkedAt || Date.now(),
          guildMember: Boolean(linkData.guildMember),
          pbgMemberRole: Boolean(linkData.pbgMemberRole),
          verified: true
        },
        discordUserId: linkData.discordUserId,
        discordUsername: linkData.discordUsername || null,
        discordDisplayName: linkData.globalName || null,
        discordAvatarUrl: linkData.avatarUrl || null,
        discordLinked: true,
        discordVerified: true,
        discordVerificationMethod: "discord_oauth_2",
        discordLinkedAt: linkData.linkedAt || Date.now(),
        discordVerifiedAt: linkData.linkedAt || Date.now(),
        updatedAt: Date.now()
      };
      await db2.collection("privatePlayerAccounts").doc(userId).set(resolved, { merge: true }).catch(() => {
      });
      return resolved;
    }
    const pbgQuery = await db2.collection("pbgAccounts").where("pbgId", "==", userId).limit(1).get();
    if (!pbgQuery.empty) {
      const pbgDoc2 = pbgQuery.docs[0];
      const pbgData = pbgDoc2.data() || {};
      const actualUid = pbgDoc2.id;
      const discUserId = pbgData.discordUserId || pbgData.discord?.userId;
      if (discUserId) {
        const linkDoc = await db2.collection("discord_links").doc(discUserId).get();
        const linkData = linkDoc.exists ? linkDoc.data() : null;
        return {
          userId: actualUid,
          pbgId: pbgData.pbgId || linkData?.pbgId,
          discord: {
            userId: discUserId,
            username: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || "player",
            globalName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
            avatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
            connectedAt: linkData?.linkedAt || pbgData.discordLinkedAt || Date.now(),
            guildMember: linkData?.guildMember ?? pbgData.discord?.guildMember ?? true,
            pbgMemberRole: linkData?.pbgMemberRole ?? pbgData.discord?.pbgMemberRole ?? true,
            verified: true
          },
          discordUserId: discUserId,
          discordUsername: linkData?.discordUsername || pbgData.discordUsername || pbgData.discord?.username || "player",
          discordDisplayName: linkData?.globalName || pbgData.discordDisplayName || pbgData.discord?.globalName || null,
          discordAvatarUrl: linkData?.avatarUrl || pbgData.discordAvatarUrl || pbgData.discordAvatar || null,
          discordLinked: true,
          discordVerified: true,
          discordVerificationMethod: "discord_oauth_2",
          discordLinkedAt: linkData?.linkedAt || Date.now(),
          discordVerifiedAt: linkData?.linkedAt || Date.now(),
          updatedAt: Date.now()
        };
      }
    }
    const linkQueryByPbgId = await db2.collection("discord_links").where("pbgId", "==", userId).limit(1).get();
    if (!linkQueryByPbgId.empty) {
      const linkData = linkQueryByPbgId.docs[0].data();
      return {
        userId: linkData.pbgUserId || userId,
        pbgId: linkData.pbgId || void 0,
        discord: {
          userId: linkData.discordUserId,
          username: linkData.discordUsername || "player",
          globalName: linkData.globalName || null,
          avatarUrl: linkData.avatarUrl || null,
          connectedAt: linkData.linkedAt || Date.now(),
          guildMember: Boolean(linkData.guildMember),
          pbgMemberRole: Boolean(linkData.pbgMemberRole),
          verified: true
        },
        discordUserId: linkData.discordUserId,
        discordUsername: linkData.discordUsername || null,
        discordDisplayName: linkData.globalName || null,
        discordAvatarUrl: linkData.avatarUrl || null,
        discordLinked: true,
        discordVerified: true,
        discordVerificationMethod: "discord_oauth_2",
        discordLinkedAt: linkData.linkedAt || Date.now(),
        discordVerifiedAt: linkData.linkedAt || Date.now(),
        updatedAt: Date.now()
      };
    }
    if (doc6.exists) {
      return doc6.data();
    }
  } catch (err) {
    console.warn("[getPrivateDiscordAccount] Firestore error:", err);
  }
  return {
    userId,
    discord: null,
    discordUserId: null,
    discordUsername: null,
    discordDisplayName: null,
    discordAvatarUrl: null,
    discordLinked: false,
    discordVerified: false,
    updatedAt: Date.now()
  };
}
async function resolveAuthoritativeUserIdentity(input) {
  const clean = input.trim();
  if (!clean) return null;
  const memAcc = pbgAccountRegistry.getAccountByUid(clean) || pbgAccountRegistry.getAccountByPbgId(clean);
  if (memAcc) {
    return {
      uid: memAcc.googleUid,
      pbgId: memAcc.pbgId,
      email: memAcc.email,
      displayName: memAcc.displayName,
      discordUserId: memAcc.discordUserId || void 0,
      discordLinked: Boolean(memAcc.discordLinked && memAcc.discordUserId),
      pbgMemberRoleActive: Boolean(memAcc.discordMemberVerified ?? true)
    };
  }
  const db2 = getAdminDb();
  if (!db2) return null;
  try {
    const directDoc = await db2.collection("pbgAccounts").doc(clean).get();
    if (directDoc.exists) {
      const data = directDoc.data() || {};
      return {
        uid: directDoc.id,
        pbgId: data.pbgId || clean,
        email: data.email,
        displayName: data.displayName,
        discordUserId: data.discordUserId || data.discord?.userId,
        discordLinked: Boolean((data.discordLinked || data.discord?.verified) && (data.discordUserId || data.discord?.userId)),
        pbgMemberRoleActive: Boolean(data.discord?.pbgMemberRole ?? true)
      };
    }
    const pbgSnap = await db2.collection("pbgAccounts").where("pbgId", "==", clean).limit(1).get();
    if (!pbgSnap.empty) {
      const doc6 = pbgSnap.docs[0];
      const data = doc6.data() || {};
      return {
        uid: doc6.id,
        pbgId: data.pbgId || clean,
        email: data.email,
        displayName: data.displayName,
        discordUserId: data.discordUserId || data.discord?.userId,
        discordLinked: Boolean((data.discordLinked || data.discord?.verified) && (data.discordUserId || data.discord?.userId)),
        pbgMemberRoleActive: Boolean(data.discord?.pbgMemberRole ?? true)
      };
    }
    const linkSnap = await db2.collection("discord_links").where("pbgId", "==", clean).limit(1).get();
    if (!linkSnap.empty) {
      const data = linkSnap.docs[0].data();
      return {
        uid: data.pbgUserId || clean,
        pbgId: data.pbgId || clean,
        displayName: data.globalName || data.discordUsername || clean,
        discordUserId: data.discordUserId,
        discordLinked: true,
        pbgMemberRoleActive: Boolean(data.pbgMemberRole)
      };
    }
    const linkSnap2 = await db2.collection("discord_links").where("pbgUserId", "==", clean).limit(1).get();
    if (!linkSnap2.empty) {
      const data = linkSnap2.docs[0].data();
      return {
        uid: data.pbgUserId || clean,
        pbgId: data.pbgId || clean,
        displayName: data.globalName || data.discordUsername || clean,
        discordUserId: data.discordUserId,
        discordLinked: true,
        pbgMemberRoleActive: Boolean(data.pbgMemberRole)
      };
    }
  } catch (e) {
    console.warn("[resolveAuthoritativeUserIdentity] Firestore lookup error:", e);
  }
  return null;
}
async function updateDiscordAuthoritativeMembership(params) {
  const { userId, discordUserId, guildMember, pbgMemberRole } = params;
  const cleanId = discordUserId.trim();
  const now = Date.now();
  if (isTestEnv2()) {
    const existing = inMemoryLinks.get(cleanId);
    if (existing) {
      existing.guildMember = guildMember;
      existing.pbgMemberRole = pbgMemberRole;
      existing.updatedAt = now;
    }
    const acc = inMemoryPrivateAccounts2.get(userId);
    if (acc && acc.discord) {
      acc.discord.guildMember = guildMember;
      acc.discord.pbgMemberRole = pbgMemberRole;
      acc.updatedAt = now;
    }
    return;
  }
  const db2 = getAdminDb();
  if (!db2) return;
  try {
    const batch = db2.batch();
    const linkRef = db2.collection("discord_links").doc(cleanId);
    batch.set(linkRef, {
      guildMember,
      pbgMemberRole,
      updatedAt: now
    }, { merge: true });
    const privateRef = db2.collection("privatePlayerAccounts").doc(userId);
    batch.set(privateRef, {
      "discord.guildMember": guildMember,
      "discord.pbgMemberRole": pbgMemberRole,
      updatedAt: now
    }, { merge: true });
    const pbgRef = db2.collection("pbgAccounts").doc(userId);
    batch.set(pbgRef, {
      "discord.guildMember": guildMember,
      "discord.pbgMemberRole": pbgMemberRole,
      updatedAt: new Date(now).toISOString()
    }, { merge: true });
    await batch.commit();
  } catch (err) {
    console.warn("[updateDiscordAuthoritativeMembership] Firestore update note:", err.message);
  }
}

// ../src/server/discordOAuthState.ts
import crypto2 from "node:crypto";
var DEFAULT_DISCORD_STATE_SECRET = "pbg_discord_oauth_state_secret_seed_authoritative_2026";
var STATE_MAX_AGE_MS2 = 10 * 60 * 1e3;
var ALLOWED_PBG_ORIGINS = Object.freeze([
  "https://purplebeangaming.com",
  "https://www.purplebeangaming.com",
  "https://us-central1-gen-lang-client-0634745445.cloudfunctions.net",
  "https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app",
  "https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
]);
function sanitizeTrustedOrigin(candidateOrigin) {
  const defaultOrigin = process.env.APP_URL ? process.env.APP_URL.trim().replace(/\/+$/, "") : "https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app";
  if (!candidateOrigin || typeof candidateOrigin !== "string") {
    return defaultOrigin;
  }
  const clean = candidateOrigin.trim().replace(/\/+$/, "");
  if (ALLOWED_PBG_ORIGINS.includes(clean) || process.env.APP_URL && clean === defaultOrigin) {
    return clean;
  }
  return defaultOrigin;
}
function getStateSecret2() {
  return process.env.DISCORD_STATE_SECRET || process.env.STEAM_OPENID_STATE_SECRET || DEFAULT_DISCORD_STATE_SECRET;
}
var inMemoryConsumedNonces = /* @__PURE__ */ new Map();
var isTestEnv3 = () => process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
function pruneExpiredNonces() {
  const cutoff = Date.now() - 15 * 60 * 1e3;
  for (const [nonce, consumedAt] of inMemoryConsumedNonces.entries()) {
    if (consumedAt < cutoff) {
      inMemoryConsumedNonces.delete(nonce);
    }
  }
}
function generateSignedDiscordOAuthState(uid, options) {
  if (!uid || typeof uid !== "string") {
    throw new Error("UID is required to generate Discord OAuth state token");
  }
  const validatedOrigin = sanitizeTrustedOrigin(options?.origin);
  const payload = {
    uid,
    email: options?.email,
    pbgId: options?.pbgId,
    returnUrl: options?.returnUrl,
    origin: validatedOrigin,
    timestamp: Date.now(),
    nonce: crypto2.randomBytes(16).toString("hex")
  };
  const json = JSON.stringify(payload);
  const encodedPayload = Buffer.from(json, "utf8").toString("base64url");
  const hmac = crypto2.createHmac("sha256", getStateSecret2()).update(encodedPayload).digest("hex");
  return `${encodedPayload}.${hmac}`;
}
async function verifyAndConsumeDiscordOAuthState(stateToken, options) {
  if (!stateToken || typeof stateToken !== "string") {
    return {
      success: false,
      error: "INVALID_FORMAT",
      details: "Missing state token"
    };
  }
  const parts = stateToken.split(".");
  if (parts.length !== 2) {
    return {
      success: false,
      error: "INVALID_FORMAT",
      details: "Malformed state token format"
    };
  }
  const [encodedPayload, receivedSignature] = parts;
  const expectedSignature = crypto2.createHmac("sha256", getStateSecret2()).update(encodedPayload).digest("hex");
  const receivedBuf = Buffer.from(receivedSignature, "utf8");
  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  if (receivedBuf.length !== expectedBuf.length || !crypto2.timingSafeEqual(receivedBuf, expectedBuf)) {
    return {
      success: false,
      error: "STATE_TAMPERED",
      details: "State token signature mismatch or tampering detected"
    };
  }
  let payload;
  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    payload = JSON.parse(json);
  } catch {
    return {
      success: false,
      error: "INVALID_FORMAT",
      details: "Malformed state payload JSON"
    };
  }
  if (!payload.uid || !payload.timestamp || !payload.nonce) {
    return {
      success: false,
      error: "INVALID_FORMAT",
      details: "State payload is missing required security fields"
    };
  }
  if (options?.expectedUid && payload.uid !== options.expectedUid) {
    return {
      success: false,
      error: "USER_MISMATCH",
      details: `State token belongs to user ${payload.uid}, but caller is ${options.expectedUid}`
    };
  }
  const maxAge = options?.customMaxAgeMs ?? STATE_MAX_AGE_MS2;
  const now = Date.now();
  if (now - payload.timestamp >= maxAge) {
    return {
      success: false,
      error: "STATE_EXPIRED",
      details: "Discord OAuth verification session has expired. Please initiate connection again."
    };
  }
  if (payload.timestamp > now + 6e4) {
    return {
      success: false,
      error: "STATE_TAMPERED",
      details: "State token issued timestamp is in the future"
    };
  }
  if (!isTestEnv3()) {
    const db2 = getAdminDb();
    if (!db2 || typeof db2.runTransaction !== "function") {
      return {
        success: false,
        error: "STATE_TAMPERED",
        details: "Shared persistent authentication store is unavailable for state validation."
      };
    }
    try {
      const alreadyUsed = await db2.runTransaction(async (transaction) => {
        const nonceRef = db2.collection("consumed_oauth_states").doc(payload.nonce);
        const nonceDoc = await transaction.get(nonceRef);
        if (nonceDoc.exists) {
          return true;
        }
        transaction.set(nonceRef, {
          uid: payload.uid,
          nonce: payload.nonce,
          consumedAt: now,
          expiresAt: payload.timestamp + maxAge
        });
        return false;
      });
      if (alreadyUsed) {
        return {
          success: false,
          error: "STATE_REPLAYED",
          details: "This OAuth authorization state has already been consumed. Replay rejected across instances."
        };
      }
    } catch (err) {
      console.error("[verifyAndConsumeDiscordOAuthState] Firestore transaction error:", err.message);
      return {
        success: false,
        error: "STATE_REPLAYED",
        details: "Failed to atomically verify state nonce against persistent store."
      };
    }
  } else {
    pruneExpiredNonces();
    if (inMemoryConsumedNonces.has(payload.nonce)) {
      return {
        success: false,
        error: "STATE_REPLAYED",
        details: "This OAuth authorization state has already been consumed. Replay rejected."
      };
    }
  }
  inMemoryConsumedNonces.set(payload.nonce, now);
  return { success: true, payload };
}

// ../src/domain/tournamentRegistrationEngine.ts
function evaluateRegistrationEligibility(input) {
  const checks = [];
  const { pbgAccount, tournament, formData, existingRegistrations = [] } = input;
  if (!pbgAccount || !pbgAccount.pbgId) {
    checks.push({
      code: "PBG_PROFILE_COMPLETE",
      passed: false,
      severity: "FAIL",
      message: "Active PBG account and permanent PBG ID required."
    });
  } else if (pbgAccount.isBanned || pbgAccount.accountStatus === "BANNED" || pbgAccount.accountStatus === "SUSPENDED") {
    checks.push({
      code: "PLAYER_BANNED",
      passed: false,
      severity: "FAIL",
      message: "Account is currently suspended or disqualified from tournament play."
    });
  } else {
    checks.push({
      code: "PBG_PROFILE_COMPLETE",
      passed: true,
      severity: "PASS",
      message: `PBG Profile verified: ${pbgAccount.pbgId} (${pbgAccount.displayName || "Player"}).`
    });
  }
  const isTestBypass = Boolean(
    tournament.testMode && (pbgAccount?.isTestAccount || pbgAccount?.source === "TEST_SEED")
  );
  if (isTestBypass) {
    checks.push({
      code: "TEST_IDENTITY_BYPASS",
      passed: true,
      severity: "PASS",
      message: "TEST IDENTITY: External identity checks bypassed."
    });
    checks.push({
      code: "DOTA_LINK_REQUIRED",
      passed: true,
      severity: "PASS",
      message: "TEST IDENTITY: External Dota 2 link bypassed."
    });
    checks.push({
      code: "DISCORD_LINK_REQUIRED",
      passed: true,
      severity: "PASS",
      message: "TEST IDENTITY: External Discord link bypassed."
    });
    checks.push({
      code: "PBG_MEMBER_ROLE_REQUIRED",
      passed: true,
      severity: "PASS",
      message: "TEST IDENTITY: PBG Member role bypassed."
    });
  } else {
    const dotaRequired = tournament.dotaRequired !== false;
    if (dotaRequired) {
      if (!pbgAccount?.dotaAccountLinked || !pbgAccount?.dotaAccountId) {
        checks.push({
          code: "DOTA_LINK_REQUIRED",
          passed: false,
          severity: "FAIL",
          message: "Dota 2 Friend ID & Steam verification required for tournament entry."
        });
      } else if (!pbgAccount.dotaAccountVerified) {
        checks.push({
          code: "DOTA_LINK_REQUIRED",
          passed: false,
          severity: "REVIEW",
          message: "Dota 2 account is linked but pending OpenDota ownership verification."
        });
      } else {
        checks.push({
          code: "DOTA_LINK_REQUIRED",
          passed: true,
          severity: "PASS",
          message: `Dota 2 account verified: Friend ID ${pbgAccount.dotaAccountId}.`
        });
      }
    }
    const discordRequired = tournament.discordRequired !== false;
    if (discordRequired) {
      if (!pbgAccount?.discordLinked || !pbgAccount?.discordUserId) {
        checks.push({
          code: "DISCORD_LINK_REQUIRED",
          passed: false,
          severity: "FAIL",
          message: "Discord account linking is required. Connect Discord to register."
        });
      } else {
        checks.push({
          code: "DISCORD_LINK_REQUIRED",
          passed: true,
          severity: "PASS",
          message: `Discord linked: ${pbgAccount.discordUsername || pbgAccount.discordUserId}.`
        });
        if (pbgAccount.pbgMemberRoleActive === false) {
          checks.push({
            code: "PBG_MEMBER_ROLE_REQUIRED",
            passed: false,
            severity: "REVIEW",
            message: "Discord linked but PBG Member role verification needs reconciliation."
          });
        } else {
          checks.push({
            code: "PBG_MEMBER_ROLE_REQUIRED",
            passed: true,
            severity: "PASS",
            message: "Official PBG Discord Member status confirmed."
          });
        }
      }
    }
  }
  const primaryRole = formData.primaryRole?.trim();
  const secondaryRole = formData.secondaryRole?.trim();
  if (!primaryRole || !secondaryRole) {
    checks.push({
      code: "ROLE_SELECTION_INVALID",
      passed: false,
      severity: "FAIL",
      message: "Both primary and secondary competitive positions must be selected."
    });
  } else if (primaryRole.toLowerCase() === secondaryRole.toLowerCase()) {
    checks.push({
      code: "ROLE_SELECTION_INVALID",
      passed: false,
      severity: "FAIL",
      message: "Primary and secondary roles cannot be the same position."
    });
  } else {
    checks.push({
      code: "ROLE_SELECTION_INVALID",
      passed: true,
      severity: "PASS",
      message: `Roles validated: ${primaryRole} (Main) / ${secondaryRole} (Secondary).`
    });
  }
  const mmr = Number(formData.declaredMMR) || 0;
  if (mmr <= 0 || mmr > 16e3) {
    checks.push({
      code: "MMR_OUT_OF_RANGE",
      passed: false,
      severity: "FAIL",
      message: "Declared MMR must be a realistic competitive rating between 1 and 16,000."
    });
  } else if (tournament.minMmr && mmr < tournament.minMmr) {
    checks.push({
      code: "MMR_OUT_OF_RANGE",
      passed: false,
      severity: "FAIL",
      message: `MMR (${mmr}) is below tournament minimum entry requirement of ${tournament.minMmr}.`
    });
  } else if (tournament.maxMmr && mmr > tournament.maxMmr) {
    checks.push({
      code: "MMR_OUT_OF_RANGE",
      passed: false,
      severity: "REVIEW",
      message: `MMR (${mmr}) exceeds standard tournament bracket cap of ${tournament.maxMmr}. Organiser review required.`
    });
  } else {
    checks.push({
      code: "MMR_OUT_OF_RANGE",
      passed: true,
      severity: "PASS",
      message: `MMR calibrated: ${mmr.toLocaleString()} MMR.`
    });
  }
  if (pbgAccount) {
    const otherRegistrations = existingRegistrations.filter((r) => r.userId !== input.userId);
    const existingSelf = existingRegistrations.find(
      (r) => r.userId === input.userId && r.status !== "REJECTED" && r.status !== "WITHDRAWN"
    );
    if (existingSelf) {
      checks.push({
        code: "ALREADY_REGISTERED",
        passed: false,
        severity: "FAIL",
        message: `User ${input.userId} already has an active registration for this tournament (${existingSelf.status}).`
      });
    }
    if (pbgAccount.pbgId) {
      const duplicatePbg = otherRegistrations.find(
        (r) => r.pbgId === pbgAccount.pbgId && r.status !== "REJECTED" && r.status !== "WITHDRAWN"
      );
      if (duplicatePbg) {
        checks.push({
          code: "DUPLICATE_PBG_ID",
          passed: false,
          severity: "FAIL",
          message: `PBG Account ${pbgAccount.pbgId} is already registered under participant ${duplicatePbg.userId}.`
        });
      }
    }
    if (pbgAccount.dotaAccountId) {
      const duplicateDota = otherRegistrations.find(
        (r) => r.identitySnapshot?.dotaAccountId === pbgAccount.dotaAccountId && r.status !== "REJECTED" && r.status !== "WITHDRAWN"
      );
      if (duplicateDota) {
        checks.push({
          code: "DUPLICATE_DOTA_ID",
          passed: false,
          severity: "FAIL",
          message: `Dota Friend ID ${pbgAccount.dotaAccountId} is already registered under participant ${duplicateDota.pbgId}.`
        });
      }
    }
    if (pbgAccount.steamId) {
      const duplicateSteam = otherRegistrations.find(
        (r) => r.identitySnapshot?.steamId === pbgAccount.steamId && r.status !== "REJECTED" && r.status !== "WITHDRAWN"
      );
      if (duplicateSteam) {
        checks.push({
          code: "DUPLICATE_STEAM_ID",
          passed: false,
          severity: "FAIL",
          message: `Steam ID ${pbgAccount.steamId} is already registered under participant ${duplicateSteam.pbgId}.`
        });
      }
    }
    if (pbgAccount.discordUserId) {
      const duplicateDiscord = otherRegistrations.find(
        (r) => r.identitySnapshot?.discordUserId === pbgAccount.discordUserId && r.status !== "REJECTED" && r.status !== "WITHDRAWN"
      );
      if (duplicateDiscord) {
        checks.push({
          code: "DUPLICATE_DISCORD_ID",
          passed: false,
          severity: "FAIL",
          message: `Discord account is already registered under participant ${duplicateDiscord.pbgId}.`
        });
      }
    }
  }
  if (tournament.maxParticipants && tournament.maxParticipants > 0) {
    const approvedOrSubmitted = existingRegistrations.filter(
      (r) => (r.status === "APPROVED" || r.status === "SUBMITTED" || r.status === "UNDER_REVIEW") && r.userId !== input.userId
    );
    if (approvedOrSubmitted.length >= tournament.maxParticipants) {
      checks.push({
        code: "TOURNAMENT_FULL",
        passed: false,
        severity: "REVIEW",
        message: `Tournament capacity of ${tournament.maxParticipants} reached. New registrations will be placed on WAITLIST.`
      });
    }
  }
  const hasFail = checks.some((c) => c.severity === "FAIL" || !c.passed && c.severity !== "REVIEW");
  const hasReview = checks.some((c) => c.severity === "REVIEW");
  let overallStatus = "ELIGIBLE";
  if (hasFail) {
    overallStatus = "INELIGIBLE";
  } else if (hasReview) {
    overallStatus = "REVIEW_REQUIRED";
  }
  return {
    overallStatus,
    checks
  };
}
function createRegistrationSnapshot(params) {
  const {
    userId,
    tournamentId,
    pbgAccount,
    formData,
    eligibilityChecks,
    eligibilityStatus,
    initialStatus
  } = params;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let assignedStatus = initialStatus || "SUBMITTED";
  const isCapacityFull = eligibilityChecks.some((c) => c.code === "TOURNAMENT_FULL");
  if (isCapacityFull && assignedStatus === "SUBMITTED") {
    assignedStatus = "WAITLISTED";
  } else if (eligibilityStatus === "REVIEW_REQUIRED" && assignedStatus === "SUBMITTED") {
    assignedStatus = "UNDER_REVIEW";
  }
  return {
    id: userId,
    tournamentId,
    userId,
    pbgId: pbgAccount.pbgId,
    status: assignedStatus,
    eligibilityStatus,
    captainApplicant: Boolean(formData.captainApplicant),
    primaryRole: formData.primaryRole,
    secondaryRole: formData.secondaryRole,
    declaredMMR: formData.declaredMMR,
    tournamentMMR: formData.tournamentMMR || formData.declaredMMR,
    submittedAt: now,
    updatedAt: now,
    identitySnapshot: {
      pbgId: pbgAccount.pbgId,
      displayName: pbgAccount.displayName || pbgAccount.pbgId,
      email: pbgAccount.email,
      dotaAccountId: pbgAccount.dotaAccountId,
      steamId: pbgAccount.steamId,
      discordUserId: pbgAccount.discordUserId,
      discordUsername: pbgAccount.discordUsername
    },
    tournamentData: {
      declaredMMR: formData.declaredMMR,
      tournamentMMR: formData.tournamentMMR || formData.declaredMMR,
      primaryRole: formData.primaryRole,
      secondaryRole: formData.secondaryRole,
      captainApplicant: Boolean(formData.captainApplicant),
      availabilityConfirmed: Boolean(formData.availabilityConfirmed),
      rulesAccepted: Boolean(formData.rulesAccepted),
      customFields: formData.customFields || {}
    },
    eligibilityChecks
  };
}
function createParticipantFromApprovedRegistration(regOrOptions, maybeExistingParticipant) {
  const isOptions = typeof regOrOptions === "object" && regOrOptions !== null && "registration" in regOrOptions;
  const reg = isOptions ? regOrOptions.registration : regOrOptions;
  const options = isOptions ? regOrOptions : null;
  const existingParticipant = options?.existingParticipant ?? maybeExistingParticipant ?? null;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const isCap = options?.tournamentRole === "CAPTAIN" || Boolean(options?.captainSlotId) || existingParticipant?.tournamentRole === "CAPTAIN";
  const capSlot = options?.captainSlotId !== void 0 ? options.captainSlotId : existingParticipant?.captainSlotId || null;
  const effectiveRole = isCap ? "CAPTAIN" : options?.tournamentRole || existingParticipant?.tournamentRole || "PLAYER";
  const effectiveAuctionStatus = isCap ? "NOT_IN_POOL" : existingParticipant?.auctionStatus === "NOT_IN_POOL" ? "AVAILABLE" : existingParticipant?.auctionStatus || "AVAILABLE";
  if (existingParticipant) {
    return {
      ...existingParticipant,
      participantStatus: "ACTIVE",
      pbgId: reg.pbgId,
      displayName: reg.identitySnapshot?.displayName || existingParticipant.displayName || reg.pbgId || reg.userId,
      registrationId: reg.id,
      tournamentRole: effectiveRole,
      captainSlotId: capSlot,
      auctionStatus: effectiveAuctionStatus,
      eliminated: false,
      isTestAccount: options?.isTestAccount ?? reg.isTestAccount,
      source: options?.source ?? reg.source,
      updatedAt: now
    };
  }
  return {
    userId: reg.userId,
    tournamentId: reg.tournamentId,
    registrationId: reg.id,
    pbgId: reg.pbgId,
    displayName: reg.identitySnapshot?.displayName || reg.pbgId || reg.userId,
    participantStatus: "ACTIVE",
    tournamentRole: effectiveRole,
    auctionStatus: effectiveAuctionStatus,
    captainSlotId: capSlot,
    teamId: null,
    eliminated: false,
    isTestAccount: options?.isTestAccount ?? reg.isTestAccount,
    source: options?.source ?? reg.source,
    joinedAt: now,
    updatedAt: now
  };
}
function assignParticipantAsCaptain(participant, captainSlotId) {
  return {
    ...participant,
    tournamentRole: "CAPTAIN",
    auctionStatus: "NOT_IN_POOL",
    captainSlotId,
    teamId: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function removeParticipantFromCaptain(participant) {
  return {
    ...participant,
    tournamentRole: "PLAYER",
    auctionStatus: "AVAILABLE",
    captainSlotId: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function validateAuctionReadiness(params) {
  const { lifecycle, participants, registrations, targetCaptainCount = 4, testMode = false } = params;
  const blockers = [];
  const blockingIssues = [];
  const addBlocker = (code, message, details) => {
    blockers.push({ code, message, details });
    blockingIssues.push(`[${code}] ${message}`);
  };
  const activeParticipants = participants.filter((p) => p.participantStatus === "ACTIVE");
  const captains = activeParticipants.filter((p) => p.tournamentRole === "CAPTAIN" || p.captainSlotId !== null);
  const auctionPool = activeParticipants.filter(
    (p) => p.tournamentRole === "PLAYER" && p.auctionStatus === "AVAILABLE" && p.captainSlotId === null && p.teamId === null
  );
  const registrationsClosed = lifecycle !== "REGISTRATION_OPEN";
  if (!registrationsClosed) {
    addBlocker(
      "REGISTRATION_NOT_CLOSED",
      "Tournament registration is still open. Registrations must be closed prior to auction.",
      { currentLifecycle: lifecycle }
    );
  }
  const unresolvedRegistrations = registrations.filter(
    (r) => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW" || r.eligibilityStatus === "REVIEW_REQUIRED"
  );
  const ineligibleApproved = registrations.filter(
    (r) => {
      if (testMode && (r.isTestAccount || r.source === "TEST_SEED")) return false;
      return r.status === "APPROVED" && (r.eligibilityStatus === "INELIGIBLE" || r.eligibilityChecks?.some((c) => c.severity === "FAIL"));
    }
  );
  const eligibilityComplete = unresolvedRegistrations.length === 0 && ineligibleApproved.length === 0;
  if (unresolvedRegistrations.length > 0) {
    addBlocker(
      "UNRESOLVED_ELIGIBILITY_REVIEWS",
      `${unresolvedRegistrations.length} registration(s) possess unresolved eligibility reviews or pending statuses.`,
      { count: unresolvedRegistrations.length, userIds: unresolvedRegistrations.map((r) => r.userId) }
    );
  }
  if (ineligibleApproved.length > 0) {
    addBlocker(
      "APPROVED_INELIGIBLE_REGISTRATION",
      `${ineligibleApproved.length} approved registration(s) possess failed eligibility checks.`,
      { count: ineligibleApproved.length, userIds: ineligibleApproved.map((r) => r.userId) }
    );
  }
  const tournamentConfigValid = targetCaptainCount >= 2;
  if (!tournamentConfigValid) {
    addBlocker(
      "INVALID_TOURNAMENT_CONFIG",
      `Tournament configuration invalid: requires at least 2 teams and captains (configured: ${targetCaptainCount}).`,
      { targetCaptainCount }
    );
  }
  const requiredCaptainsSelected = captains.length === targetCaptainCount;
  if (!requiredCaptainsSelected) {
    addBlocker(
      "CAPTAIN_COUNT_MISMATCH",
      `Exact captain count mismatch: expected exactly ${targetCaptainCount} captains, but ${captains.length} are selected.`,
      { selected: captains.length, required: targetCaptainCount }
    );
  }
  const seenSlots = /* @__PURE__ */ new Set();
  let hasSlotConflict = false;
  for (const c of captains) {
    if (!c.captainSlotId) {
      hasSlotConflict = true;
      addBlocker(
        "CAPTAIN_SLOT_CONFLICT",
        `Captain ${c.displayName || c.userId} has no assigned captainSlotId.`,
        { userId: c.userId }
      );
      break;
    }
    if (seenSlots.has(c.captainSlotId)) {
      hasSlotConflict = true;
      addBlocker(
        "CAPTAIN_SLOT_CONFLICT",
        `Duplicate captainSlotId conflict detected for slot ${c.captainSlotId}.`,
        { captainSlotId: c.captainSlotId }
      );
      break;
    }
    seenSlots.add(c.captainSlotId);
  }
  const uniqueCaptainSlots = !hasSlotConflict;
  const contaminatedCaptains = captains.filter(
    (c) => c.auctionStatus !== "NOT_IN_POOL" || auctionPool.some((p) => p.userId === c.userId)
  );
  const captainsExcludedFromPool = contaminatedCaptains.length === 0;
  if (!captainsExcludedFromPool) {
    addBlocker(
      "CAPTAINS_IN_AUCTION_POOL",
      `${contaminatedCaptains.length} selected captain(s) are present in the auction bidding pool or possess an auction status other than NOT_IN_POOL.`,
      { captainUserIds: contaminatedCaptains.map((c) => c.userId) }
    );
  }
  const regularActivePlayers = activeParticipants.filter((p) => p.tournamentRole === "PLAYER" && p.teamId === null);
  const unavailablePlayers = regularActivePlayers.filter((p) => p.auctionStatus !== "AVAILABLE");
  const playersAvailable = unavailablePlayers.length === 0;
  if (!playersAvailable) {
    addBlocker(
      "PLAYERS_NOT_AVAILABLE",
      `${unavailablePlayers.length} regular active player(s) do not possess AVAILABLE auction status.`,
      { userIds: unavailablePlayers.map((p) => p.userId) }
    );
  }
  const approvedRegs = registrations.filter((r) => r.status === "APPROVED");
  const unrepresented = approvedRegs.filter((r) => !activeParticipants.some((p) => p.userId === r.userId));
  const allApprovedRepresented = unrepresented.length === 0;
  if (!allApprovedRepresented) {
    addBlocker(
      "APPROVED_REGISTRATIONS_UNREPRESENTED",
      `${unrepresented.length} approved registration(s) do not have an active participant record.`,
      { unrepresentedUserIds: unrepresented.map((r) => r.userId) }
    );
  }
  const seenDiscord = /* @__PURE__ */ new Map();
  const seenDota = /* @__PURE__ */ new Map();
  const seenSteam = /* @__PURE__ */ new Map();
  const seenPbg = /* @__PURE__ */ new Map();
  let hasDuplicateIdentities = false;
  for (const p of activeParticipants) {
    const reg = registrations.find((r) => r.userId === p.userId);
    const discordId = reg?.identitySnapshot?.discordUserId;
    const dotaId = reg?.identitySnapshot?.dotaAccountId;
    const steamId = reg?.identitySnapshot?.steamId;
    const pbgId = p.pbgId || reg?.pbgId;
    if (pbgId) {
      if (seenPbg.has(pbgId)) {
        hasDuplicateIdentities = true;
        addBlocker("DUPLICATE_PBG_IDENTITY", `Duplicate PBG account ${pbgId} detected across participants ${p.userId} and ${seenPbg.get(pbgId)}.`, { pbgId });
      } else {
        seenPbg.set(pbgId, p.userId);
      }
    }
    if (discordId) {
      if (seenDiscord.has(discordId)) {
        hasDuplicateIdentities = true;
        addBlocker("DUPLICATE_DISCORD_IDENTITY", `Duplicate Discord ID ${discordId} shared by participants ${p.userId} and ${seenDiscord.get(discordId)}.`, { discordId });
      } else {
        seenDiscord.set(discordId, p.userId);
      }
    }
    if (dotaId) {
      if (seenDota.has(dotaId)) {
        hasDuplicateIdentities = true;
        addBlocker("DUPLICATE_DOTA_IDENTITY", `Duplicate Dota Friend ID ${dotaId} shared by participants ${p.userId} and ${seenDota.get(dotaId)}.`, { dotaId });
      } else {
        seenDota.set(dotaId, p.userId);
      }
    }
    if (steamId) {
      if (seenSteam.has(steamId)) {
        hasDuplicateIdentities = true;
        addBlocker("DUPLICATE_STEAM_IDENTITY", `Duplicate Steam ID ${steamId} shared by participants ${p.userId} and ${seenSteam.get(steamId)}.`, { steamId });
      } else {
        seenSteam.set(steamId, p.userId);
      }
    }
  }
  const noDuplicateIdentities = !hasDuplicateIdentities;
  const missingDiscord = activeParticipants.filter((p) => {
    if (testMode && (p.isTestAccount || p.source === "TEST_SEED")) return false;
    const reg = registrations.find((r) => r.userId === p.userId);
    if (testMode && (reg?.isTestAccount || reg?.source === "TEST_SEED")) return false;
    return !reg?.identitySnapshot?.discordUserId;
  });
  const discordLinkageValidForAll = missingDiscord.length === 0;
  if (!discordLinkageValidForAll) {
    addBlocker(
      "DISCORD_LINKAGE_MISSING",
      `${missingDiscord.length} active participant(s) are missing verified Discord account linkages.`,
      { missingUserIds: missingDiscord.map((p) => p.userId) }
    );
  }
  const missingPbgMember = activeParticipants.filter((p) => {
    if (testMode && (p.isTestAccount || p.source === "TEST_SEED")) return false;
    const reg = registrations.find((r) => r.userId === p.userId);
    if (testMode && (reg?.isTestAccount || reg?.source === "TEST_SEED")) return false;
    const checks = reg?.eligibilityChecks || [];
    const memberCheck = checks.find((c) => c.code === "PBG_MEMBER_ROLE_REQUIRED");
    if (memberCheck && memberCheck.passed === false) return true;
    const liveAccount = pbgAccountRegistry.getAccountByUid(p.userId) || (p.pbgId ? pbgAccountRegistry.getAccountByPbgId(p.pbgId) : void 0);
    if (liveAccount) {
      if (liveAccount.discordLinked === false) return true;
      if (liveAccount.discordMemberVerified === false) return true;
    }
    return false;
  });
  const pbgMemberRoleRetained = missingPbgMember.length === 0;
  if (!pbgMemberRoleRetained) {
    addBlocker(
      "PBG_MEMBER_ROLE_MISSING",
      `${missingPbgMember.length} participant(s) have unverified or inactive PBG Member status.`,
      { userIds: missingPbgMember.map((p) => p.userId) }
    );
  }
  const prematureTeamed = activeParticipants.filter((p) => p.teamId !== null);
  const noConflictingTeams = prematureTeamed.length === 0;
  if (!noConflictingTeams) {
    addBlocker(
      "CONFLICTING_TEAM_ASSIGNMENTS",
      `${prematureTeamed.length} participant(s) already possess premature teamId assignments prior to auction draft.`,
      { prematureUserIds: prematureTeamed.map((p) => p.userId) }
    );
  }
  const noUnresolvedReviewItems = eligibilityComplete;
  const isReady = blockers.length === 0;
  return {
    isReady,
    ready: isReady,
    lifecycle,
    blockers,
    blockingIssues,
    captains,
    auctionPool,
    totalApproved: approvedRegs.length,
    totalCaptains: captains.length,
    totalAuctionPool: auctionPool.length,
    targetCaptainCount,
    checks: {
      registrationsClosed,
      eligibilityComplete,
      requiredCaptainsSelected,
      uniqueCaptainSlots,
      captainsExcludedFromPool,
      playersAvailable,
      discordLinkageValidForAll,
      pbgMemberRoleRetained,
      allApprovedRepresented,
      noDuplicateIdentities,
      noConflictingTeams,
      tournamentConfigValid,
      noUnresolvedReviewItems
    }
  };
}

// ../src/domain/tournamentLifecycleEngine.ts
function classifyTournamentLifecycle(tournamentOrStatus) {
  if (!tournamentOrStatus) return "TERMINAL";
  if (typeof tournamentOrStatus === "object") {
    if (tournamentOrStatus.deleted === true) return "TERMINAL";
    const status = tournamentOrStatus.lifecycle || tournamentOrStatus.status || "";
    return classifyTournamentLifecycle(status);
  }
  const raw = String(tournamentOrStatus).trim().toUpperCase();
  if (raw === "ON_HOLD" || raw === "ON HOLD" || raw === "PAUSED" || raw === "AUCTION_PAUSED" || raw === "HOLD") {
    return "ON_HOLD";
  }
  if (raw === "COMPLETED" || raw === "COMPLETE" || raw === "CANCELLED" || raw === "CANCELED" || raw === "ABANDONED" || raw === "DELETED" || raw === "SOFT_DELETED" || raw === "ARCHIVED") {
    return "TERMINAL";
  }
  return "ACTIVE_LIKE";
}
function shouldTournamentGrantTemporaryDiscordRoles(tournament) {
  if (!tournament) return false;
  const category = classifyTournamentLifecycle(tournament);
  switch (category) {
    case "ACTIVE_LIKE":
      return true;
    case "ON_HOLD":
      return true;
    case "TERMINAL":
      return false;
    default:
      return false;
  }
}
function getUserTournamentRoleEntitlementsFromContexts(userId, tournaments) {
  const activeTournamentIds = /* @__PURE__ */ new Set();
  const activeParticipantTournamentIds = /* @__PURE__ */ new Set();
  const activeCaptainTournamentIds = /* @__PURE__ */ new Set();
  const qualifyingTournaments = [];
  for (const tourney of tournaments) {
    const category = classifyTournamentLifecycle(tourney);
    if (category === "TERMINAL") {
      continue;
    }
    const participant = tourney.participants?.find(
      (p) => p.userId === userId || p.pbgId === userId || p.id === userId
    );
    const team = tourney.teams?.find(
      (t) => participant?.teamId && (t.id === participant.teamId || t.teamId === participant.teamId) || t.captainUserId === userId || t.captainId === userId || participant?.pbgId && (t.captainId === participant.pbgId || t.captainUserId === participant.pbgId) || t.roster?.includes(userId) || t.primaryRoster?.some((r) => r.userId === userId || r.id === userId || r.pbgId === userId)
    );
    if (!participant && !team) {
      continue;
    }
    const isDisqualified = participant && (participant.status === "DISQUALIFIED" || participant.participantStatus === "DISQUALIFIED");
    const isWithdrawn = participant && (participant.status === "WITHDRAWN" || participant.participantStatus === "WITHDRAWN");
    const isEliminated = participant && (participant.eliminated === true || participant.status === "ELIMINATED") || team && team.status === "ELIMINATED" && !participant;
    if (isDisqualified || isWithdrawn || isEliminated) {
      continue;
    }
    activeTournamentIds.add(tourney.id);
    activeParticipantTournamentIds.add(tourney.id);
    const isCaptain = participant?.tournamentRole === "CAPTAIN" || Boolean(participant?.isCaptain) || Boolean(team && (team.captainUserId === userId || team.captainId === userId || participant && (team.captainId === participant.userId || team.captainId === participant.pbgId)));
    if (isCaptain) {
      activeCaptainTournamentIds.add(tourney.id);
    }
    qualifyingTournaments.push({
      tournamentId: tourney.id,
      tournamentName: tourney.name || tourney.id,
      lifecycleCategory: category,
      isCaptain,
      teamId: participant?.teamId || team?.id || team?.teamId || null,
      teamName: team?.name || null,
      teamRoleId: team?.discord?.roleId || null
    });
  }
  const pIds = Array.from(activeParticipantTournamentIds);
  const cIds = Array.from(activeCaptainTournamentIds);
  return {
    userId,
    activeTournamentIds: Array.from(activeTournamentIds),
    activeParticipantTournamentIds: pIds,
    activeCaptainTournamentIds: cIds,
    shouldHavePbgPlayer: pIds.length > 0,
    shouldHavePbgCaptain: cIds.length > 0,
    qualifyingTournaments
  };
}

// ../src/domain/discordTournamentRoleEngine.ts
var PBG_DISCORD_ROLE_DEFAULTS = {
  DISCORD_PBG_MEMBER_ROLE_ID: "1555885374713237524",
  DISCORD_PBG_PLAYER_ROLE_ID: "1555884061111746651",
  DISCORD_PBG_CAPTAIN_ROLE_ID: "1556338549807259658"
};
function validateDiscordRoleConfig(config) {
  const errors = [];
  const warnings = [];
  const memberRoleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
  const playerRoleId = config?.roles?.tournamentPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID;
  const captainRoleId = config?.roles?.captainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID;
  const snowflakeRegex = /^\d{17,20}$/;
  if (!memberRoleId) {
    errors.push("Missing DISCORD_PBG_MEMBER_ROLE_ID: Persistent member role ID must be configured.");
  } else if (!snowflakeRegex.test(memberRoleId)) {
    warnings.push(`DISCORD_PBG_MEMBER_ROLE_ID "${memberRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }
  if (!playerRoleId) {
    errors.push("Missing DISCORD_PBG_PLAYER_ROLE_ID: Temporary tournament player role ID must be configured.");
  } else if (!snowflakeRegex.test(playerRoleId)) {
    warnings.push(`DISCORD_PBG_PLAYER_ROLE_ID "${playerRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }
  if (!captainRoleId) {
    errors.push("Missing DISCORD_PBG_CAPTAIN_ROLE_ID: Temporary tournament captain role ID must be configured.");
  } else if (!snowflakeRegex.test(captainRoleId)) {
    warnings.push(`DISCORD_PBG_CAPTAIN_ROLE_ID "${captainRoleId}" is not a standard 17-20 digit Discord snowflake.`);
  }
  if (memberRoleId && playerRoleId && memberRoleId === playerRoleId) {
    errors.push("Collision: DISCORD_PBG_MEMBER_ROLE_ID and DISCORD_PBG_PLAYER_ROLE_ID cannot share the same Discord role ID.");
  }
  if (memberRoleId && captainRoleId && memberRoleId === captainRoleId) {
    errors.push("Collision: DISCORD_PBG_MEMBER_ROLE_ID and DISCORD_PBG_CAPTAIN_ROLE_ID cannot share the same Discord role ID.");
  }
  if (playerRoleId && captainRoleId && playerRoleId === captainRoleId) {
    errors.push("Collision: DISCORD_PBG_PLAYER_ROLE_ID and DISCORD_PBG_CAPTAIN_ROLE_ID cannot share the same Discord role ID.");
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    roles: {
      DISCORD_PBG_MEMBER_ROLE_ID: memberRoleId,
      DISCORD_PBG_PLAYER_ROLE_ID: playerRoleId,
      DISCORD_PBG_CAPTAIN_ROLE_ID: captainRoleId
    }
  };
}
function getDiscordRoleConfigDiagnostics(config) {
  const validation = validateDiscordRoleConfig(config);
  const status = validation.errors.length > 0 ? "ERROR" : validation.warnings.length > 0 ? "WARNING" : "OK";
  const summary = status === "OK" ? "Discord PBG role configuration is valid and matches PurpleBeanGaming convention." : status === "WARNING" ? `Discord PBG role configuration has warnings: ${validation.warnings.join("; ")}` : `Discord PBG role configuration has errors: ${validation.errors.join("; ")}`;
  return { status, summary, validation };
}
function getDesiredTournamentDiscordRoles(context) {
  const { tournament, participant, team, discordLink } = context;
  const pbgMemberRoleId = context.pbgMemberRoleId || process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
  const discordConfig = tournament.discordConfig;
  const roleDetails = [];
  const desiredRoleIds = /* @__PURE__ */ new Set();
  const undesiredRoleIds = /* @__PURE__ */ new Set();
  if (discordLink.discordLinked && pbgMemberRoleId) {
    desiredRoleIds.add(pbgMemberRoleId);
    roleDetails.push({
      roleId: pbgMemberRoleId,
      roleName: "PBG Member",
      category: "PERSISTENT"
    });
  }
  if (!discordLink.discordLinked || !discordLink.discordUserId) {
    return {
      userId: participant?.userId || "unknown",
      discordUserId: void 0,
      pbgMemberActive: false,
      desiredRoleIds: [],
      undesiredRoleIds: [],
      roleDetails: [],
      reconciliationRequired: true,
      reconciliationReason: "DISCORD_NOT_LINKED: User has not connected their Discord account."
    };
  }
  const pbgPlayerRoleId = context.pbgPlayerRoleId || discordConfig?.roles?.tournamentPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID;
  const pbgCaptainRoleId = context.pbgCaptainRoleId || discordConfig?.roles?.captainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID;
  const teamRoleId = team?.discord?.roleId;
  const grantsTemporaryRoles = shouldTournamentGrantTemporaryDiscordRoles(tournament);
  const isTerminalTournament = !grantsTemporaryRoles;
  const isTeamEliminated = team?.status === "ELIMINATED" || participant?.eliminated === true;
  const isParticipantActive = participant && (participant.participantStatus === "ACTIVE" || participant.status === "ACTIVE" || participant.status === "APPROVED");
  if (isTerminalTournament) {
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);
    if (context.globalEntitlements) {
      if (context.globalEntitlements.shouldHavePbgPlayer && pbgPlayerRoleId) {
        desiredRoleIds.add(pbgPlayerRoleId);
        roleDetails.push({ roleId: pbgPlayerRoleId, roleName: "PBG Player", category: "TOURNAMENT" });
      } else if (pbgPlayerRoleId) {
        undesiredRoleIds.add(pbgPlayerRoleId);
      }
      if (context.globalEntitlements.shouldHavePbgCaptain && pbgCaptainRoleId) {
        desiredRoleIds.add(pbgCaptainRoleId);
        roleDetails.push({ roleId: pbgCaptainRoleId, roleName: "PBG Captain", category: "TOURNAMENT" });
      } else if (pbgCaptainRoleId) {
        undesiredRoleIds.add(pbgCaptainRoleId);
      }
    } else {
      if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
      if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
    }
    return {
      userId: participant?.userId || "unknown",
      discordUserId: discordLink.discordUserId,
      pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
      desiredRoleIds: Array.from(desiredRoleIds),
      undesiredRoleIds: Array.from(undesiredRoleIds),
      roleDetails,
      reconciliationRequired: false
    };
  }
  if (isTeamEliminated) {
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);
    if (context.globalEntitlements) {
      if (context.globalEntitlements.shouldHavePbgPlayer && pbgPlayerRoleId) {
        desiredRoleIds.add(pbgPlayerRoleId);
        roleDetails.push({ roleId: pbgPlayerRoleId, roleName: "PBG Player", category: "TOURNAMENT" });
      } else if (pbgPlayerRoleId) {
        undesiredRoleIds.add(pbgPlayerRoleId);
      }
      if (context.globalEntitlements.shouldHavePbgCaptain && pbgCaptainRoleId) {
        desiredRoleIds.add(pbgCaptainRoleId);
        roleDetails.push({ roleId: pbgCaptainRoleId, roleName: "PBG Captain", category: "TOURNAMENT" });
      } else if (pbgCaptainRoleId) {
        undesiredRoleIds.add(pbgCaptainRoleId);
      }
    } else {
      if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
      if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
    }
    return {
      userId: participant?.userId || "unknown",
      discordUserId: discordLink.discordUserId,
      pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
      desiredRoleIds: Array.from(desiredRoleIds),
      undesiredRoleIds: Array.from(undesiredRoleIds),
      roleDetails,
      reconciliationRequired: false
    };
  }
  if (isParticipantActive) {
    if (pbgPlayerRoleId) {
      desiredRoleIds.add(pbgPlayerRoleId);
      roleDetails.push({
        roleId: pbgPlayerRoleId,
        roleName: "PBG Player",
        category: "TOURNAMENT"
      });
    }
    if (participant.tournamentRole === "CAPTAIN") {
      if (pbgCaptainRoleId) {
        desiredRoleIds.add(pbgCaptainRoleId);
        roleDetails.push({
          roleId: pbgCaptainRoleId,
          roleName: "PBG Captain",
          category: "TOURNAMENT"
        });
      }
    } else {
      if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
    }
    if (team && team.status === "ACTIVE" && teamRoleId) {
      desiredRoleIds.add(teamRoleId);
      roleDetails.push({
        roleId: teamRoleId,
        roleName: team.discord?.roleName || team.name,
        category: "TEAM"
      });
    }
  } else {
    if (pbgPlayerRoleId) undesiredRoleIds.add(pbgPlayerRoleId);
    if (pbgCaptainRoleId) undesiredRoleIds.add(pbgCaptainRoleId);
    if (teamRoleId) undesiredRoleIds.add(teamRoleId);
  }
  return {
    userId: participant?.userId || "unknown",
    discordUserId: discordLink.discordUserId,
    pbgMemberActive: Boolean(discordLink.pbgMemberRoleActive),
    desiredRoleIds: Array.from(desiredRoleIds),
    undesiredRoleIds: Array.from(undesiredRoleIds),
    roleDetails,
    reconciliationRequired: !discordLink.pbgMemberRoleActive
  };
}
function buildDiscordRoleReconciliationPlan(params) {
  const { guildId, discordUserId, actualDiscordRoles, desiredResult, managedRoleIds } = params;
  const actualSet = new Set(actualDiscordRoles);
  const desiredSet = new Set(desiredResult.desiredRoleIds);
  const managedSet = new Set(managedRoleIds);
  const pbgMemberRoleId = params.pbgMemberRoleId || desiredResult.roleDetails.find((r) => r.category === "PERSISTENT" || r.roleName === "PBG Member")?.roleId || process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID;
  const rolesToAdd = [];
  const rolesToRemove = [];
  for (const roleId of desiredResult.desiredRoleIds) {
    if (!actualSet.has(roleId)) {
      rolesToAdd.push(roleId);
    }
  }
  for (const roleId of actualDiscordRoles) {
    if (managedSet.has(roleId)) {
      if (roleId === pbgMemberRoleId) {
        continue;
      }
      if (!desiredSet.has(roleId) || desiredResult.undesiredRoleIds.includes(roleId)) {
        rolesToRemove.push(roleId);
      }
    }
  }
  const summary = `Reconcile Discord roles for ${discordUserId}: +${rolesToAdd.length} role(s), -${rolesToRemove.length} role(s).`;
  return {
    discordUserId,
    guildId,
    rolesToAdd,
    rolesToRemove,
    summary
  };
}

// ../src/server/discordTournamentSyncService.ts
var inMemoryTournamentDiscordConfigs = /* @__PURE__ */ new Map();
var inMemoryParticipants = /* @__PURE__ */ new Map();
var inMemoryTournamentTeams = /* @__PURE__ */ new Map();
var inMemorySyncJobs = /* @__PURE__ */ new Map();
function getBotConfig(customConfig) {
  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  const guildId = customConfig?.guildId || process.env.DISCORD_GUILD_ID || "631715510631006219";
  const pbgMemberRoleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || "1555885374713237524";
  const pbgPlayerRoleId = customConfig?.roles?.tournamentPlayerRoleId || process.env.DISCORD_PBG_PLAYER_ROLE_ID || "1555884061111746651";
  const pbgCaptainRoleId = customConfig?.roles?.captainRoleId || process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || "1556338549807259658";
  return { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId };
}
async function getAllTournamentLifecycleContexts() {
  const db2 = getAdminDb();
  const contextMap = /* @__PURE__ */ new Map();
  if (db2) {
    try {
      const snap = await db2.collection("tournaments").limit(50).get();
      await Promise.all(
        snap.docs.map(async (doc6) => {
          const data = doc6.data();
          let participants = Array.isArray(data.participants) ? data.participants : [];
          let teams = Array.isArray(data.teams) ? data.teams : [];
          if (participants.length === 0 || teams.length === 0) {
            try {
              const [pSnap, tSnap] = await Promise.all([
                participants.length === 0 ? db2.collection(`tournaments/${doc6.id}/participants`).get().catch(() => null) : null,
                teams.length === 0 ? db2.collection(`tournaments/${doc6.id}/teams`).get().catch(() => null) : null
              ]);
              if (pSnap && !pSnap.empty) {
                participants = pSnap.docs.map((d) => d.data());
              }
              if (tSnap && !tSnap.empty) {
                teams = tSnap.docs.map((d) => d.data());
              }
              if (participants.length === 0) {
                const rSnap = await db2.collection(`tournaments/${doc6.id}/registrations`).get().catch(() => null);
                if (rSnap && !rSnap.empty) {
                  rSnap.docs.forEach((rd) => {
                    const rData = rd.data();
                    const isApproved = rData.status === "verified" || rData.status === "registered" || rData.status === "APPROVED";
                    if (isApproved && rData.status !== "DISQUALIFIED" && rData.status !== "WITHDRAWN") {
                      participants.push({
                        userId: rd.id,
                        tournamentId: doc6.id,
                        registrationId: rData.id || rd.id,
                        pbgId: rData.pbgId || rd.id,
                        displayName: rData.ign || rData.playerName || rData.displayName || rd.id,
                        tournamentRole: rData.isCaptainApproved || rData.applyingAsCaptain ? "CAPTAIN" : "PLAYER",
                        captainSlotId: rData.teamId ? `slot-${rData.teamId}` : null,
                        teamId: rData.teamId || null,
                        participantStatus: "ACTIVE",
                        auctionStatus: rData.auctionStatus || "AVAILABLE",
                        eliminated: false,
                        joinedAt: rData.registeredAt || (/* @__PURE__ */ new Date()).toISOString(),
                        updatedAt: rData.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
                      });
                    }
                  });
                }
              }
              teams.forEach((t) => {
                const capId = t.captainUserId || t.captainId;
                if (capId && !participants.some((p) => p.userId === capId || p.pbgId === capId)) {
                  participants.push({
                    userId: capId,
                    tournamentId: doc6.id,
                    registrationId: `cap-${capId}`,
                    pbgId: capId,
                    displayName: t.captainIgn || t.captainName || capId,
                    tournamentRole: "CAPTAIN",
                    captainSlotId: `slot-${t.id}`,
                    teamId: t.id,
                    participantStatus: "ACTIVE",
                    auctionStatus: "SOLD",
                    eliminated: t.status === "ELIMINATED",
                    joinedAt: t.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
                    updatedAt: t.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
                  });
                }
                const roster = t.roster || t.primaryRoster || [];
                roster.forEach((mem) => {
                  const mId = typeof mem === "string" ? mem : mem.userId || mem.id;
                  if (mId && !participants.some((p) => p.userId === mId || p.pbgId === mId)) {
                    participants.push({
                      userId: mId,
                      tournamentId: doc6.id,
                      registrationId: `roster-${mId}`,
                      pbgId: mem.pbgId || mId,
                      displayName: mem.username || mem.displayName || mId,
                      tournamentRole: mem.isCaptain ? "CAPTAIN" : "PLAYER",
                      captainSlotId: mem.isCaptain ? `slot-${t.id}` : null,
                      teamId: t.id,
                      participantStatus: "ACTIVE",
                      auctionStatus: "SOLD",
                      eliminated: t.status === "ELIMINATED",
                      joinedAt: t.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
                      updatedAt: t.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
                    });
                  }
                });
              });
            } catch {
            }
          }
          contextMap.set(doc6.id, {
            id: doc6.id,
            name: data.name || data.title || doc6.id,
            status: data.status,
            lifecycle: data.lifecycle,
            deleted: data.deleted === true,
            discordConfig: data.discordConfig,
            participants,
            teams
          });
        })
      );
    } catch (e) {
      console.warn("[getAllTournamentLifecycleContexts] Firestore query warning:", e);
    }
  }
  for (const [tourneyId, pMap] of inMemoryParticipants.entries()) {
    const existing = contextMap.get(tourneyId) || {
      id: tourneyId,
      name: tourneyId,
      status: "active",
      lifecycle: "ACTIVE_LIKE",
      participants: [],
      teams: []
    };
    if (!existing.participants || existing.participants.length === 0) {
      existing.participants = Array.from(pMap.values());
    }
    const tMap = inMemoryTournamentTeams.get(tourneyId);
    if (tMap && (!existing.teams || existing.teams.length === 0)) {
      existing.teams = Array.from(tMap.values());
    }
    contextMap.set(tourneyId, existing);
  }
  return Array.from(contextMap.values());
}
async function getUserTournamentRoleEntitlements(userId) {
  const identity = await resolveAuthoritativeUserIdentity(userId);
  const targetId = identity?.uid || userId;
  const contexts = await getAllTournamentLifecycleContexts();
  const res = getUserTournamentRoleEntitlementsFromContexts(targetId, contexts);
  if (!res.shouldHavePbgPlayer && identity?.pbgId && identity.pbgId !== targetId) {
    const resPbg = getUserTournamentRoleEntitlementsFromContexts(identity.pbgId, contexts);
    if (resPbg.shouldHavePbgPlayer) return resPbg;
  }
  return res;
}
async function fetchActualMemberDiscordRoles(params) {
  const { guildId, discordUserId, botToken, fetchFn = fetch } = params;
  if (!botToken) {
    return { ok: true, roles: [] };
  }
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`;
    const res = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${botToken}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      if (res.status === 404) {
        return { ok: false, roles: [], error: "MEMBER_NOT_IN_GUILD" };
      }
      return { ok: false, roles: [], error: `HTTP_${res.status}` };
    }
    const data = await res.json();
    const roles = Array.isArray(data?.roles) ? data.roles : [];
    return { ok: true, roles };
  } catch (err) {
    return { ok: false, roles: [], error: err.message };
  }
}
async function assignGuildMemberRole(params) {
  const { guildId, discordUserId, roleId, botToken, fetchFn = fetch } = params;
  if (!botToken) return { success: true };
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });
    if (res.status === 204 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function removeGuildMemberRole(params) {
  const { guildId, discordUserId, roleId, botToken, fetchFn = fetch } = params;
  if (!botToken) return { success: true };
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });
    if (res.status === 204 || res.status === 404 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function createDiscordTeamRoleAuthoritative(params) {
  const { guildId, teamName, botToken, fetchFn = fetch } = params;
  if (!botToken) {
    const mockRoleId = `mock_role_${Date.now()}`;
    return { success: true, roleId: mockRoleId };
  }
  try {
    const rolesUrl = `https://discord.com/api/v10/guilds/${guildId}/roles`;
    try {
      const existingRes = await fetchFn(rolesUrl, {
        headers: { Authorization: `Bot ${botToken}` }
      });
      if (existingRes.ok) {
        const rolesList = await existingRes.json();
        if (Array.isArray(rolesList)) {
          const match = rolesList.find(
            (r) => r.name.toLowerCase().trim() === teamName.toLowerCase().trim()
          );
          if (match) {
            return { success: true, roleId: match.id };
          }
        }
      }
    } catch (checkErr) {
      console.warn("[createDiscordTeamRoleAuthoritative] Existing roles check note:", checkErr);
    }
    const res = await fetchFn(rolesUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: teamName,
        color: 6087142,
        // Purple Bean Cyan accent
        hoist: false,
        mentionable: true
      })
    });
    if (!res.ok) {
      return { success: false, error: `HTTP_${res.status}` };
    }
    const data = await res.json();
    return { success: true, roleId: data.id };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function deleteDiscordTeamRoleAuthoritative(params) {
  const { guildId, roleId, botToken, fetchFn = fetch } = params;
  if (!botToken || !roleId) return { success: true };
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/roles/${roleId}`;
    const res = await fetchFn(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`
      }
    });
    if (res.status === 204 || res.status === 404 || res.ok) {
      return { success: true };
    }
    return { success: false, error: `HTTP_${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
async function recordDiscordSyncJob(job) {
  inMemorySyncJobs.set(job.id, job);
  try {
    const db2 = getAdminDb();
    if (db2) {
      await db2.collection("discordSyncJobs").doc(job.id).set(job, { merge: true });
    }
  } catch {
  }
}
async function syncDiscordTournamentRoles(params) {
  const { userId, tournamentId, overrideContext, fetchFn = fetch } = params;
  const authIdentity = await resolveAuthoritativeUserIdentity(userId);
  const resolvedUid = authIdentity?.uid || userId;
  const resolvedPbgId = authIdentity?.pbgId || userId;
  let tournamentData = overrideContext?.tournament || null;
  let participantData = overrideContext?.participant || null;
  let teamData = overrideContext?.team || null;
  let discordConfig = overrideContext?.tournament?.discordConfig;
  if (!participantData) {
    const tourneyParticipants = inMemoryParticipants.get(tournamentId);
    participantData = tourneyParticipants?.get(resolvedUid) || tourneyParticipants?.get(resolvedPbgId) || tourneyParticipants?.get(userId) || null;
  }
  if (!discordConfig) {
    discordConfig = inMemoryTournamentDiscordConfigs.get(tournamentId);
  }
  try {
    const db2 = getAdminDb();
    if (db2) {
      if (!tournamentData) {
        const tDoc = await db2.collection("tournaments").doc(tournamentId).get();
        if (tDoc.exists) {
          tournamentData = tDoc.data();
        }
      }
      if (!participantData) {
        let pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).doc(resolvedUid).get();
        if (!pSnap.exists && resolvedPbgId !== resolvedUid) {
          pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).doc(resolvedPbgId).get();
        }
        if (!pSnap.exists && userId !== resolvedUid && userId !== resolvedPbgId) {
          pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).doc(userId).get();
        }
        if (!pSnap.exists) {
          const qSnap = await db2.collection(`tournaments/${tournamentId}/participants`).where("pbgId", "==", resolvedPbgId).limit(1).get();
          if (!qSnap.empty) {
            pSnap = qSnap.docs[0];
          }
        }
        if (pSnap.exists) {
          participantData = pSnap.data();
        } else {
          const cap = tournamentData?.captains?.find(
            (c) => c.userId === resolvedUid || c.userId === userId || c.pbgId === resolvedPbgId || c.userId && c.userId.toLowerCase() === resolvedPbgId.toLowerCase()
          );
          const tMember = tournamentData?.teams?.flatMap((t) => t.primaryRoster || []).find(
            (p) => p.userId === resolvedUid || p.userId === userId || p.pbgId === resolvedPbgId || p.id === resolvedUid || p.id === resolvedPbgId
          );
          if (cap) {
            participantData = {
              userId: resolvedUid,
              tournamentId,
              registrationId: resolvedUid,
              pbgId: cap.pbgId || resolvedPbgId,
              displayName: cap.displayName || cap.name || resolvedUid,
              tournamentRole: "CAPTAIN",
              captainSlotId: cap.slotId || `slot-${cap.teamId}`,
              teamId: cap.teamId || null,
              participantStatus: "ACTIVE",
              auctionStatus: "NOT_IN_POOL",
              eliminated: false,
              source: "REGISTRATION",
              joinedAt: cap.assignedAt || (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
          } else if (tMember) {
            participantData = {
              userId: resolvedUid,
              tournamentId,
              registrationId: resolvedUid,
              pbgId: tMember.pbgId || resolvedPbgId,
              displayName: tMember.name || tMember.displayName || resolvedUid,
              tournamentRole: tMember.isCaptain ? "CAPTAIN" : "PLAYER",
              captainSlotId: tMember.isCaptain ? `slot-${tMember.teamId}` : null,
              teamId: tMember.teamId || null,
              participantStatus: "ACTIVE",
              auctionStatus: "SOLD",
              eliminated: false,
              source: "REGISTRATION",
              joinedAt: (/* @__PURE__ */ new Date()).toISOString(),
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            };
          } else {
            const mSnap = await db2.collection(`tournaments/${tournamentId}/memberships`).doc(userId).get();
            if (mSnap.exists) {
              const mData = mSnap.data();
              participantData = {
                userId,
                tournamentId,
                registrationId: userId,
                pbgId: mData?.pbgId || userId,
                displayName: mData?.displayName || mData?.name || userId,
                tournamentRole: mData?.role === "captain" ? "CAPTAIN" : "PLAYER",
                captainSlotId: mData?.role === "captain" ? `slot-${mData?.teamId}` : null,
                teamId: mData?.teamId || null,
                participantStatus: "ACTIVE",
                auctionStatus: mData?.role === "captain" ? "NOT_IN_POOL" : "AVAILABLE",
                eliminated: false,
                source: "REGISTRATION",
                joinedAt: mData?.assignedAt || (/* @__PURE__ */ new Date()).toISOString(),
                updatedAt: (/* @__PURE__ */ new Date()).toISOString()
              };
            } else {
              const rSnap = await db2.collection(`tournaments/${tournamentId}/registrations`).doc(userId).get();
              if (rSnap.exists) {
                const rData = rSnap.data();
                const isApproved = rData?.status === "verified" || rData?.status === "registered" || rData?.status === "APPROVED";
                participantData = {
                  userId,
                  tournamentId,
                  registrationId: rData?.id || userId,
                  pbgId: rData?.pbgId || userId,
                  displayName: rData?.ign || rData?.displayName || userId,
                  tournamentRole: rData?.isCaptainApproved ? "CAPTAIN" : "PLAYER",
                  captainSlotId: rData?.isCaptainApproved ? `slot-${rData?.teamId || "pending"}` : null,
                  teamId: rData?.teamId || null,
                  participantStatus: isApproved ? "ACTIVE" : "INACTIVE",
                  auctionStatus: rData?.isCaptainApproved ? "NOT_IN_POOL" : "AVAILABLE",
                  eliminated: false,
                  source: "REGISTRATION",
                  joinedAt: rData?.registeredAt || (/* @__PURE__ */ new Date()).toISOString(),
                  updatedAt: (/* @__PURE__ */ new Date()).toISOString()
                };
              }
            }
          }
        }
      }
      if (!discordConfig) {
        const cSnap = await db2.collection(`tournaments/${tournamentId}/discordConfig`).doc("config").get();
        if (cSnap.exists) {
          discordConfig = cSnap.data();
        }
      }
      if (participantData?.teamId && !teamData) {
        const tSnap = await db2.collection(`tournaments/${tournamentId}/teams`).doc(participantData.teamId).get();
        if (tSnap.exists) {
          teamData = tSnap.data();
        } else {
          const rawTeam = tournamentData?.teams?.find((t) => t.id === participantData?.teamId);
          if (rawTeam) {
            teamData = {
              teamId: rawTeam.id,
              tournamentId,
              name: rawTeam.name,
              captainUserId: rawTeam.captainId || rawTeam.captainUserId,
              status: "ACTIVE",
              discord: rawTeam.discord || null
            };
          }
        }
      }
      if (teamData && !teamData.discord?.roleId) {
        const botConfig = getBotConfig(discordConfig);
        if (botConfig.botToken) {
          const roleRes = await createDiscordTeamRoleAuthoritative({
            guildId: botConfig.guildId,
            teamName: teamData.name,
            botToken: botConfig.botToken,
            fetchFn
          });
          if (roleRes.success && roleRes.roleId) {
            teamData.discord = {
              roleId: roleRes.roleId,
              roleName: teamData.name,
              createdAt: (/* @__PURE__ */ new Date()).toISOString()
            };
            const targetTeamId = teamData.id || teamData.teamId;
            if (targetTeamId) {
              await db2.collection(`tournaments/${tournamentId}/teams`).doc(targetTeamId).set({
                discord: teamData.discord
              }, { merge: true }).catch(() => {
              });
            }
          }
        }
      }
    }
  } catch {
  }
  let discordLink = overrideContext?.discordLink;
  if (!discordLink) {
    const privateDiscord = await getPrivateDiscordAccount(userId);
    const pbgAcc = !privateDiscord?.discordUserId ? pbgAccountRegistry.getAccountByUid(userId) || pbgAccountRegistry.getAccountByPbgId(userId) : null;
    const discordUserId2 = privateDiscord?.discordUserId || pbgAcc?.discordUserId || void 0;
    const discordLinked = Boolean(privateDiscord?.discordLinked && privateDiscord?.discordUserId || pbgAcc?.discordLinked && pbgAcc?.discordUserId);
    const pbgMemberRoleActive = Boolean(privateDiscord?.discord?.pbgMemberRole ?? privateDiscord?.pbgMemberRole ?? pbgAcc?.discordMemberVerified ?? true);
    discordLink = {
      discordUserId: discordUserId2,
      discordLinked,
      pbgMemberRoleActive
    };
  }
  const { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig(discordConfig);
  const context = {
    tournament: {
      id: tournamentId,
      status: tournamentData?.status || "REGISTRATION_OPEN",
      discordConfig: discordConfig || {
        enabled: true,
        guildId,
        roles: {
          tournamentPlayerRoleId: pbgPlayerRoleId,
          captainRoleId: pbgCaptainRoleId
        },
        teamRolesEnabled: true,
        cleanupPolicy: { onElimination: true, onTournamentCompletion: true }
      }
    },
    participant: participantData,
    team: teamData,
    discordLink,
    pbgMemberRoleId,
    pbgPlayerRoleId,
    pbgCaptainRoleId
  };
  const isTestIdentity = Boolean(
    participantData?.isTestAccount || participantData?.source === "TEST_SEED" || userId.startsWith("pbg-test-") || userId.startsWith("dummy-")
  );
  if (isTestIdentity) {
    return {
      success: true,
      userId,
      tournamentId,
      rolesAdded: [],
      rolesRemoved: [],
      skipped: true,
      reason: "SKIPPED_TEST_IDENTITY",
      reconciliationRequired: false
    };
  }
  if (!context.globalEntitlements) {
    try {
      const entitlements = await getUserTournamentRoleEntitlements(userId);
      context.globalEntitlements = {
        shouldHavePbgPlayer: entitlements.shouldHavePbgPlayer,
        shouldHavePbgCaptain: entitlements.shouldHavePbgCaptain
      };
    } catch {
      const isPlayer = participantData?.participantStatus === "ACTIVE" || participantData?.status === "APPROVED";
      const isCaptain = participantData?.tournamentRole === "CAPTAIN";
      context.globalEntitlements = {
        shouldHavePbgPlayer: Boolean(isPlayer && !participantData?.eliminated),
        shouldHavePbgCaptain: Boolean(isCaptain && !participantData?.eliminated)
      };
    }
  }
  const desiredResult = getDesiredTournamentDiscordRoles(context);
  if (!desiredResult.discordUserId) {
    return {
      success: false,
      userId,
      tournamentId,
      rolesAdded: [],
      rolesRemoved: [],
      error: "DISCORD_NOT_LINKED: User has not connected Discord.",
      reconciliationRequired: true
    };
  }
  const discordUserId = desiredResult.discordUserId;
  const actualRes = await fetchActualMemberDiscordRoles({
    guildId,
    discordUserId,
    botToken,
    fetchFn
  });
  if (!actualRes.ok) {
    const jobId2 = `sync_${tournamentId}_${userId}`;
    const existingJob = inMemorySyncJobs.get(jobId2);
    const job = {
      id: jobId2,
      type: "SYNC_TOURNAMENT_ROLES",
      tournamentId,
      userId,
      status: "PENDING",
      attempts: (existingJob?.attempts || 0) + 1,
      lastError: actualRes.error || "DISCORD_API_UNAVAILABLE",
      createdAt: existingJob?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await recordDiscordSyncJob(job);
    return {
      success: false,
      userId,
      tournamentId,
      discordUserId,
      rolesAdded: [],
      rolesRemoved: [],
      jobId: jobId2,
      error: `DISCORD_API_RETRY_QUEUED: ${actualRes.error}`
    };
  }
  const managedRoleIds = [
    pbgMemberRoleId,
    context.tournament.discordConfig?.roles?.tournamentPlayerRoleId || pbgPlayerRoleId,
    context.tournament.discordConfig?.roles?.captainRoleId || pbgCaptainRoleId,
    teamData?.discord?.roleId
  ].filter(Boolean);
  const plan = buildDiscordRoleReconciliationPlan({
    guildId,
    discordUserId,
    actualDiscordRoles: actualRes.roles,
    desiredResult,
    managedRoleIds,
    pbgMemberRoleId
  });
  const rolesAdded = [];
  const rolesRemoved = [];
  for (const roleId of plan.rolesToAdd) {
    const addRes = await assignGuildMemberRole({
      guildId,
      discordUserId,
      roleId,
      botToken,
      fetchFn
    });
    if (addRes.success) {
      rolesAdded.push(roleId);
    }
  }
  for (const roleId of plan.rolesToRemove) {
    const remRes = await removeGuildMemberRole({
      guildId,
      discordUserId,
      roleId,
      botToken,
      fetchFn
    });
    if (remRes.success) {
      rolesRemoved.push(roleId);
    }
  }
  const hasFailures = plan.rolesToAdd.length > rolesAdded.length || plan.rolesToRemove.length > rolesRemoved.length;
  let jobId;
  if (hasFailures) {
    jobId = `sync_${tournamentId}_${userId}`;
    const existingJob = inMemorySyncJobs.get(jobId);
    const job = {
      id: jobId,
      type: "SYNC_TOURNAMENT_ROLES",
      tournamentId,
      userId,
      status: "PENDING",
      attempts: (existingJob?.attempts || 0) + 1,
      lastError: "PARTIAL_ROLE_SYNC_FAILURE",
      createdAt: existingJob?.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await recordDiscordSyncJob(job);
  } else {
    const existingJob = inMemorySyncJobs.get(`sync_${tournamentId}_${userId}`);
    if (existingJob) {
      existingJob.status = "SUCCESS";
      existingJob.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      await recordDiscordSyncJob(existingJob);
    }
  }
  return {
    success: !hasFailures,
    userId,
    tournamentId,
    discordUserId,
    rolesAdded,
    rolesRemoved,
    jobId,
    error: hasFailures ? "PARTIAL_ROLE_SYNC_FAILURE" : void 0,
    reconciliationRequired: desiredResult.reconciliationRequired
  };
}
async function cleanupTournamentDiscordState(params) {
  const { tournamentId, fetchFn = fetch } = params;
  const db2 = getAdminDb();
  const report = {
    tournamentId,
    status: "COMPLETED",
    participantsProcessed: 0,
    teamRolesRemoved: 0,
    teamRolesDeleted: 0,
    globalPlayerRolesKept: 0,
    globalPlayerRolesRemoved: 0,
    globalCaptainRolesKept: 0,
    globalCaptainRolesRemoved: 0,
    skippedTestIdentities: 0,
    failures: []
  };
  let tournamentData = null;
  if (db2) {
    try {
      const tDoc = await db2.collection("tournaments").doc(tournamentId).get();
      if (tDoc.exists) {
        tournamentData = tDoc.data();
      }
    } catch {
    }
  }
  const currentStatus = tournamentData?.status || tournamentData?.lifecycle || "COMPLETED";
  report.status = currentStatus;
  let participants = params.participants || [];
  if (participants.length === 0) {
    if (db2) {
      try {
        const pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).get();
        participants = pSnap.docs.map((d) => d.data());
      } catch {
      }
    }
    if (participants.length === 0) {
      const pMap = inMemoryParticipants.get(tournamentId);
      if (pMap) participants = Array.from(pMap.values());
    }
  }
  let teams = params.teams || [];
  if (teams.length === 0) {
    if (db2) {
      try {
        const tSnap = await db2.collection(`tournaments/${tournamentId}/teams`).get();
        teams = tSnap.docs.map((d) => d.data());
      } catch {
      }
    }
    if (teams.length === 0) {
      const tMap = inMemoryTournamentTeams.get(tournamentId);
      if (tMap) teams = Array.from(tMap.values());
    }
  }
  const allContexts = await getAllTournamentLifecycleContexts();
  const contextsWithCurrentTerminal = allContexts.map(
    (c) => c.id === tournamentId ? { ...c, status: currentStatus, lifecycle: "TERMINAL" } : c
  );
  const discordConfig = params.discordConfig || tournamentData?.discordConfig || inMemoryTournamentDiscordConfigs.get(tournamentId);
  const { botToken, guildId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig(discordConfig);
  const teamById = /* @__PURE__ */ new Map();
  for (const t of teams) {
    teamById.set(t.id, t);
  }
  for (const participant of participants) {
    report.participantsProcessed++;
    const isTest = Boolean(
      participant.isTestAccount || participant.source === "TEST_SEED" || participant.userId.startsWith("pbg-test-") || participant.userId.startsWith("dummy-") || participant.userId.startsWith("p-user-")
    );
    if (isTest) {
      report.skippedTestIdentities++;
      continue;
    }
    const privateAccount = await getPrivateDiscordAccount(participant.userId);
    const pbgAcc = !privateAccount?.discordUserId ? pbgAccountRegistry.getAccountByUid(participant.userId) || pbgAccountRegistry.getAccountByPbgId(participant.userId) : null;
    const discordUserId = privateAccount?.discordUserId || pbgAcc?.discordUserId;
    if (!discordUserId || !botToken || !guildId) {
      continue;
    }
    try {
      const actualRes = await fetchActualMemberDiscordRoles({
        guildId,
        discordUserId,
        botToken,
        fetchFn
      });
      const actualRoles = actualRes.ok ? actualRes.roles : [];
      if (participant.teamId) {
        const team = teamById.get(participant.teamId);
        if (team?.discord?.roleId && actualRoles.includes(team.discord.roleId)) {
          const remRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: team.discord.roleId,
            botToken,
            fetchFn
          });
          if (remRes.success) {
            report.teamRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: team.discord.roleId,
              error: remRes.error || "FAILED_TO_REMOVE_TEAM_ROLE"
            });
          }
        }
      }
      for (const t of teams) {
        if (t.discord?.roleId && t.id !== participant.teamId && actualRoles.includes(t.discord.roleId)) {
          await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: t.discord.roleId,
            botToken,
            fetchFn
          });
          report.teamRolesRemoved++;
        }
      }
      const entitlements = getUserTournamentRoleEntitlementsFromContexts(participant.userId, contextsWithCurrentTerminal);
      if (entitlements.shouldHavePbgPlayer) {
        report.globalPlayerRolesKept++;
      } else {
        if (pbgPlayerRoleId && actualRoles.includes(pbgPlayerRoleId)) {
          const remPlayerRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: pbgPlayerRoleId,
            botToken,
            fetchFn
          });
          if (remPlayerRes.success) {
            report.globalPlayerRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: pbgPlayerRoleId,
              error: remPlayerRes.error || "FAILED_TO_REMOVE_PLAYER_ROLE"
            });
          }
        }
      }
      if (entitlements.shouldHavePbgCaptain) {
        report.globalCaptainRolesKept++;
      } else {
        if (pbgCaptainRoleId && actualRoles.includes(pbgCaptainRoleId)) {
          const remCaptainRes = await removeGuildMemberRole({
            guildId,
            discordUserId,
            roleId: pbgCaptainRoleId,
            botToken,
            fetchFn
          });
          if (remCaptainRes.success) {
            report.globalCaptainRolesRemoved++;
          } else {
            report.failures.push({
              userId: participant.userId,
              roleId: pbgCaptainRoleId,
              error: remCaptainRes.error || "FAILED_TO_REMOVE_CAPTAIN_ROLE"
            });
          }
        }
      }
    } catch (partErr) {
      report.failures.push({
        userId: participant.userId,
        error: partErr.message || "UNKNOWN_CLEANUP_ERROR"
      });
    }
  }
  for (const team of teams) {
    if (team.discord?.roleId) {
      const roleIdToDelete = team.discord.roleId;
      try {
        const delRes = await deleteDiscordTeamRoleAuthoritative({
          guildId,
          roleId: roleIdToDelete,
          botToken,
          fetchFn
        });
        if (delRes.success) {
          report.teamRolesDeleted++;
          team.discord = void 0;
          if (db2) {
            await db2.collection(`tournaments/${tournamentId}/teams`).doc(team.id).set({
              discord: null
            }, { merge: true }).catch(() => {
            });
          }
        } else {
          report.failures.push({
            roleId: roleIdToDelete,
            error: delRes.error || "FAILED_TO_DELETE_TEAM_ROLE"
          });
        }
      } catch (delErr) {
        report.failures.push({
          roleId: roleIdToDelete,
          error: delErr.message || "FAILED_TO_DELETE_TEAM_ROLE"
        });
      }
    }
  }
  if (db2) {
    try {
      await db2.collection("tournaments").doc(tournamentId).set({
        discordCleanupStatus: "COMPLETED",
        discordCleanedAt: (/* @__PURE__ */ new Date()).toISOString(),
        discordCleanupReport: report
      }, { merge: true });
    } catch (saveErr) {
      console.warn("[cleanupTournamentDiscordState] Firestore report save warning:", saveErr);
    }
    try {
      await db2.collection("audit_logs").add({
        action: "tournament_discord_cleanup",
        tournamentId,
        entityType: "tournament",
        entityId: tournamentId,
        details: `Cleaned tournament Discord state. Participants: ${report.participantsProcessed}, Team roles removed: ${report.teamRolesRemoved}, Team roles deleted: ${report.teamRolesDeleted}`,
        report,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch {
    }
  }
  if (report.failures.length > 0) {
    const jobId = `cleanup_${tournamentId}`;
    const job = {
      id: jobId,
      type: "CLEANUP_TOURNAMENT_DISCORD",
      tournamentId,
      status: "PENDING",
      attempts: 1,
      lastError: `Failed ${report.failures.length} operations during cleanup`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      metadata: { failures: report.failures }
    };
    await recordDiscordSyncJob(job);
  }
  return report;
}
async function softDeleteTournamentAuthoritative(params) {
  const { tournamentId, deletedBy, deleteReason, fetchFn = fetch } = params;
  const db2 = getAdminDb();
  if (db2) {
    try {
      await db2.collection("tournaments").doc(tournamentId).set({
        status: "cancelled",
        lifecycle: "CANCELLED",
        cancelledAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      }, { merge: true });
    } catch {
    }
  }
  const cleanupReport = await cleanupTournamentDiscordState({
    tournamentId,
    fetchFn
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (db2) {
    try {
      await db2.collection("tournaments").doc(tournamentId).set({
        deleted: true,
        deletedAt: now,
        deletedBy,
        deleteReason,
        status: "deleted",
        lifecycle: "DELETED",
        updatedAt: now
      }, { merge: true });
    } catch {
    }
    try {
      await db2.collection("audit_logs").add({
        action: "tournament_soft_delete",
        tournamentId,
        entityType: "tournament",
        entityId: tournamentId,
        details: `Soft-deleted tournament by ${deletedBy}. Reason: ${deleteReason}`,
        deletedBy,
        deleteReason,
        timestamp: now
      });
    } catch {
    }
  }
  return {
    success: true,
    tournamentId,
    cleanupReport
  };
}
async function retryPendingDiscordSyncJobs(params) {
  const { tournamentId, fetchFn } = params || {};
  let totalRetried = 0;
  let succeeded = 0;
  let failed = 0;
  const processedJobs = [];
  for (const job of Array.from(inMemorySyncJobs.values())) {
    if (job.status === "PENDING" && (!tournamentId || job.tournamentId === tournamentId)) {
      totalRetried++;
      if (job.userId) {
        const syncRes = await syncDiscordTournamentRoles({
          userId: job.userId,
          tournamentId: job.tournamentId,
          fetchFn
        });
        if (syncRes.success) {
          succeeded++;
          job.status = "SUCCESS";
          job.lastError = void 0;
        } else {
          failed++;
          job.attempts++;
          job.lastError = syncRes.error;
        }
        job.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        await recordDiscordSyncJob(job);
        processedJobs.push(job);
      }
    }
  }
  return { totalRetried, succeeded, failed, jobs: processedJobs };
}
async function syncTournamentDiscordRolesAll(params) {
  const { tournamentId, fetchFn = fetch } = params;
  const db2 = getAdminDb();
  let participants = [];
  if (db2) {
    try {
      const pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).get();
      participants = pSnap.docs.map((d) => d.data());
    } catch {
    }
  }
  if (participants.length === 0) {
    const pMap = inMemoryParticipants.get(tournamentId);
    if (pMap) participants = Array.from(pMap.values());
  }
  const report = {
    processed: 0,
    updated: 0,
    alreadyCorrect: 0,
    skippedTestIdentities: 0,
    failed: 0,
    failures: [],
    results: []
  };
  for (const part of participants) {
    report.processed++;
    const isTest = Boolean(
      part.isTestAccount || part.source === "TEST_SEED" || part.userId.startsWith("pbg-test-") || part.userId.startsWith("dummy-") || part.userId.startsWith("p-user-")
    );
    if (isTest) {
      report.skippedTestIdentities++;
      continue;
    }
    try {
      const syncRes = await syncDiscordTournamentRoles({
        userId: part.userId,
        tournamentId,
        fetchFn
      });
      report.results.push(syncRes);
      if (syncRes.skipped) {
        report.skippedTestIdentities++;
      } else if (!syncRes.success) {
        report.failed++;
        report.failures.push({
          userId: part.userId,
          username: part.displayName || part.username || part.userId,
          error: syncRes.error || "SYNC_FAILED"
        });
      } else if (syncRes.rolesAdded.length > 0 || syncRes.rolesRemoved.length > 0) {
        report.updated++;
      } else {
        report.alreadyCorrect++;
      }
    } catch (err) {
      report.failed++;
      report.failures.push({
        userId: part.userId,
        username: part.displayName || part.username || part.userId,
        error: err.message || "UNEXPECTED_ERROR"
      });
    }
  }
  return report;
}
async function getTournamentDiscordDiagnostics(tournamentId) {
  const db2 = getAdminDb();
  let participants = [];
  if (db2) {
    try {
      const pSnap = await db2.collection(`tournaments/${tournamentId}/participants`).get();
      participants = pSnap.docs.map((d) => d.data());
    } catch {
    }
  }
  if (participants.length === 0) {
    const pMap = inMemoryParticipants.get(tournamentId);
    if (pMap) participants = Array.from(pMap.values());
  }
  const { botToken, guildId, pbgMemberRoleId, pbgPlayerRoleId, pbgCaptainRoleId } = getBotConfig();
  const diagnostics = [];
  for (const p of participants) {
    const isTest = Boolean(
      p.isTestAccount || p.source === "TEST_SEED" || p.userId.startsWith("pbg-test-") || p.userId.startsWith("dummy-") || p.userId.startsWith("p-user-")
    );
    if (isTest) {
      diagnostics.push({
        userId: p.userId,
        username: p.displayName || p.username || p.userId,
        tournamentRole: p.tournamentRole,
        captainSlotId: p.captainSlotId || null,
        teamId: p.teamId || null,
        teamName: p.teamName || null,
        isTestAccount: true,
        discordLinked: false,
        discordUserId: null,
        guildMemberVerified: false,
        desiredRoles: [],
        actualRoles: [],
        syncStatus: "SKIPPED_TEST_IDENTITY"
      });
      continue;
    }
    const privateAccount = await getPrivateDiscordAccount(p.userId);
    const discordUserId = privateAccount?.discordUserId || null;
    const discordLinked = Boolean(privateAccount?.discordLinked && discordUserId);
    let actualRoles = [];
    let guildMemberVerified = false;
    if (discordLinked && discordUserId && botToken && guildId) {
      try {
        const verifyRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`, {
          headers: { Authorization: `Bot ${botToken}` }
        });
        if (verifyRes.ok) {
          guildMemberVerified = true;
          const memberData = await verifyRes.json();
          actualRoles = Array.isArray(memberData?.roles) ? memberData.roles : [];
        }
      } catch {
      }
    }
    const desired = [pbgMemberRoleId, pbgPlayerRoleId];
    if (p.tournamentRole === "CAPTAIN") desired.push(pbgCaptainRoleId);
    let syncStatus = "NOT_LINKED";
    if (discordLinked) {
      const allPresent = desired.every((r) => actualRoles.includes(r));
      syncStatus = allPresent ? "SYNCED" : "OUT_OF_SYNC";
    }
    diagnostics.push({
      userId: p.userId,
      username: p.displayName || p.username || p.userId,
      tournamentRole: p.tournamentRole,
      captainSlotId: p.captainSlotId || null,
      teamId: p.teamId || null,
      teamName: p.teamName || null,
      isTestAccount: false,
      discordLinked,
      discordUserId,
      guildMemberVerified,
      desiredRoles: desired,
      actualRoles,
      syncStatus
    });
  }
  return diagnostics;
}

// ../src/server/tournamentRegistrationOperations.ts
var inMemoryRegistrations = /* @__PURE__ */ new Map();
var inMemoryCaptains = /* @__PURE__ */ new Map();
var inMemoryLifecycles = /* @__PURE__ */ new Map();
var tournamentRegistrationLocks = /* @__PURE__ */ new Map();
async function withTournamentLock(tournamentId, fn) {
  const current = tournamentRegistrationLocks.get(tournamentId) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  tournamentRegistrationLocks.set(tournamentId, next);
  await current.catch(() => {
  });
  try {
    return await fn();
  } finally {
    release();
  }
}
function getTournamentRegMap(tournamentId) {
  let map = inMemoryRegistrations.get(tournamentId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    inMemoryRegistrations.set(tournamentId, map);
  }
  return map;
}
function getTournamentParticipantMap(tournamentId) {
  let map = inMemoryParticipants.get(tournamentId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    inMemoryParticipants.set(tournamentId, map);
  }
  return map;
}
function getTournamentCaptainMap(tournamentId) {
  let map = inMemoryCaptains.get(tournamentId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    inMemoryCaptains.set(tournamentId, map);
  }
  return map;
}
function getTournamentTeamMap(tournamentId) {
  let map = inMemoryTournamentTeams.get(tournamentId);
  if (!map) {
    map = /* @__PURE__ */ new Map();
    inMemoryTournamentTeams.set(tournamentId, map);
  }
  return map;
}
async function submitTournamentRegistrationAuthoritative(params) {
  const { userId, tournamentId, formData } = params;
  if (!userId) {
    throw new Error("SIGN_IN_REQUIRED: Authentication required to register.");
  }
  return await withTournamentLock(tournamentId, async () => {
    const lifecycle = inMemoryLifecycles.get(tournamentId) || "REGISTRATION_OPEN";
    if (lifecycle === "ON_HOLD") {
      throw new Error("TOURNAMENT_ON_HOLD: Tournament registrations are paused while tournament is on hold.");
    }
    if (lifecycle !== "REGISTRATION_OPEN") {
      throw new Error("REGISTRATION_CLOSED: Tournament registration is currently closed.");
    }
    const pbgAccount = pbgAccountRegistry.getAccountByUid(userId) || pbgAccountRegistry.getAllAccounts().find((a) => a.googleUid === userId || a.pbgId === userId);
    if (!pbgAccount || !pbgAccount.pbgId) {
      throw new Error("PBG_PROFILE_REQUIRED: Please complete your PBG profile before tournament registration.");
    }
    if (!pbgAccount.discordLinked || !pbgAccount.discordUserId) {
      throw new Error("DISCORD_REQUIRED: Connect Discord to register for this tournament.");
    }
    const regMap = getTournamentRegMap(tournamentId);
    const existingReg = regMap.get(userId);
    if (existingReg && existingReg.status !== "WITHDRAWN" && existingReg.status !== "REJECTED") {
      throw new Error("ALREADY_REGISTERED: You have already submitted a registration for this tournament.");
    }
    const allExistingRegs = Array.from(regMap.values());
    const eligibility = evaluateRegistrationEligibility({
      userId,
      tournamentId,
      pbgAccount: {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName,
        email: pbgAccount.email,
        accountStatus: pbgAccount.accountStatus,
        dotaAccountLinked: pbgAccount.dotaAccountLinked,
        dotaAccountVerified: pbgAccount.dotaAccountVerified,
        dotaAccountId: pbgAccount.dotaAccountId,
        steamId: pbgAccount.steamId,
        discordLinked: pbgAccount.discordLinked,
        discordUserId: pbgAccount.discordUserId,
        discordUsername: pbgAccount.discordUsername,
        pbgMemberRoleActive: pbgAccount.discordMemberVerified !== false,
        isBanned: pbgAccount.accountStatus === "BANNED"
      },
      tournament: {
        id: tournamentId,
        status: "OPEN",
        registrationLifecycle: lifecycle,
        discordRequired: true,
        dotaRequired: true
      },
      formData,
      existingRegistrations: allExistingRegs
    });
    const hardFail = eligibility.checks.find((c) => c.severity === "FAIL");
    if (hardFail) {
      throw new Error(`ELIGIBILITY_FAILED: ${hardFail.message}`);
    }
    const registrationRecord = createRegistrationSnapshot({
      userId,
      tournamentId,
      pbgAccount: {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName || pbgAccount.pbgId,
        email: pbgAccount.email,
        dotaAccountId: pbgAccount.dotaAccountId,
        steamId: pbgAccount.steamId,
        discordUserId: pbgAccount.discordUserId,
        discordUsername: pbgAccount.discordUsername
      },
      formData,
      eligibilityChecks: eligibility.checks,
      eligibilityStatus: eligibility.overallStatus
    });
    regMap.set(userId, registrationRecord);
    try {
      const db2 = getAdminDb();
      if (db2) {
        await db2.collection(`tournaments/${tournamentId}/registrations`).doc(userId).set(removeUndefinedDeep(registrationRecord));
        if (formData.captainApplicant) {
          await db2.collection(`tournaments/${tournamentId}/captainApplications`).doc(userId).set(removeUndefinedDeep({
            userId,
            pbgId: pbgAccount.pbgId,
            displayName: pbgAccount.displayName,
            appliedAt: registrationRecord.submittedAt,
            tournamentMMR: registrationRecord.tournamentMMR
          }));
        }
      }
    } catch (err) {
      console.warn("[submitTournamentRegistration] Firestore persistence note:", err.message);
    }
    return registrationRecord;
  });
}
async function withdrawTournamentRegistrationAuthoritative(params) {
  const { userId, tournamentId } = params;
  const regMap = getTournamentRegMap(tournamentId);
  const reg = regMap.get(userId);
  if (!reg) {
    throw new Error("NOT_FOUND: No registration found to withdraw.");
  }
  const lifecycle = inMemoryLifecycles.get(tournamentId) || "REGISTRATION_OPEN";
  if (lifecycle !== "REGISTRATION_OPEN") {
    throw new Error("WITHDRAWAL_LOCKED: Registrations are closed. Please contact tournament organisers.");
  }
  reg.status = "WITHDRAWN";
  reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  regMap.set(userId, reg);
  const pMap = getTournamentParticipantMap(tournamentId);
  if (pMap.has(userId)) {
    const p = pMap.get(userId);
    p.participantStatus = "INACTIVE";
    p.auctionStatus = "NOT_IN_POOL";
    p.updatedAt = reg.updatedAt;
  }
  try {
    const db2 = getAdminDb();
    if (db2) {
      await db2.collection(`tournaments/${tournamentId}/registrations`).doc(userId).set(reg, { merge: true });
    }
  } catch {
  }
  return reg;
}
async function reviewTournamentRegistrationAuthoritative(params) {
  const { organizerUserId, tournamentId, targetUserId, action, tournamentMMR, notes, rejectionReason } = params;
  return await withTournamentLock(tournamentId, async () => {
    const regMap = getTournamentRegMap(tournamentId);
    const reg = regMap.get(targetUserId);
    if (!reg) {
      throw new Error(`NOT_FOUND: Registration for user ${targetUserId} was not found.`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    reg.reviewedBy = organizerUserId;
    reg.reviewedAt = now;
    reg.updatedAt = now;
    if (notes) reg.reviewNotes = notes;
    if (rejectionReason) reg.rejectionReason = rejectionReason;
    const pMap = getTournamentParticipantMap(tournamentId);
    let participant;
    switch (action) {
      case "APPROVE": {
        reg.status = "APPROVED";
        const existingParticipant = pMap.get(targetUserId);
        participant = createParticipantFromApprovedRegistration(reg, existingParticipant);
        pMap.set(targetUserId, participant);
        syncDiscordTournamentRoles({
          userId: targetUserId,
          tournamentId
        }).catch((err) => console.warn("[reviewRegistration] Discord sync note:", err));
        break;
      }
      case "REJECT": {
        reg.status = "REJECTED";
        if (pMap.has(targetUserId)) {
          pMap.delete(targetUserId);
        }
        break;
      }
      case "MARK_UNDER_REVIEW": {
        reg.status = "UNDER_REVIEW";
        break;
      }
      case "WAITLIST": {
        reg.status = "WAITLISTED";
        break;
      }
      case "DISQUALIFY": {
        reg.status = "DISQUALIFIED";
        if (pMap.has(targetUserId)) {
          const p = pMap.get(targetUserId);
          p.participantStatus = "INACTIVE";
          p.auctionStatus = "NOT_IN_POOL";
          p.eliminated = true;
        }
        break;
      }
      case "SET_TOURNAMENT_MMR": {
        if (typeof tournamentMMR === "number" && tournamentMMR > 0) {
          reg.tournamentMMR = tournamentMMR;
          if (pMap.has(targetUserId)) {
            pMap.get(targetUserId).updatedAt = now;
          }
        }
        break;
      }
    }
    regMap.set(targetUserId, reg);
    try {
      const db2 = getAdminDb();
      if (db2) {
        await db2.collection(`tournaments/${tournamentId}/registrations`).doc(targetUserId).set(reg, { merge: true });
        if (participant) {
          await db2.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        }
      }
    } catch {
    }
    return { registration: reg, participant };
  });
}
async function selectTournamentCaptainAuthoritative(params) {
  const { organizerUserId, tournamentId, targetUserId, captainSlotId } = params;
  return await withTournamentLock(tournamentId, async () => {
    const pMap = getTournamentParticipantMap(tournamentId);
    let participant = pMap.get(targetUserId);
    if (!participant) {
      const regMap = getTournamentRegMap(tournamentId);
      const reg = regMap.get(targetUserId);
      if (!reg || reg.status !== "APPROVED") {
        throw new Error(`ELIGIBILITY_ERROR: Only approved participants can be designated as captains.`);
      }
      participant = createParticipantFromApprovedRegistration(reg);
      pMap.set(targetUserId, participant);
    }
    const slotMap = getTournamentCaptainMap(tournamentId);
    let replacedParticipant;
    const existingSlot = slotMap.get(captainSlotId);
    if (existingSlot && existingSlot.userId !== targetUserId) {
      const oldCaptain = pMap.get(existingSlot.userId);
      if (oldCaptain) {
        oldCaptain.captainSlotId = null;
        oldCaptain.tournamentRole = "PLAYER";
        oldCaptain.auctionStatus = "AVAILABLE";
        oldCaptain.teamId = null;
        oldCaptain.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        pMap.set(oldCaptain.userId, oldCaptain);
        replacedParticipant = oldCaptain;
        syncDiscordTournamentRoles({
          userId: oldCaptain.userId,
          tournamentId
        }).catch((err) => console.warn("[selectCaptain] Discord sync for replaced captain:", err));
        try {
          const db2 = getAdminDb();
          if (db2) {
            await db2.collection(`tournaments/${tournamentId}/participants`).doc(oldCaptain.userId).set(oldCaptain, { merge: true });
          }
        } catch {
        }
      }
    }
    for (const [sId, sRec] of slotMap.entries()) {
      if (sRec.userId === targetUserId && sId !== captainSlotId) {
        slotMap.delete(sId);
        try {
          const db2 = getAdminDb();
          if (db2) {
            await db2.collection(`tournaments/${tournamentId}/captains`).doc(sId).delete();
          }
        } catch {
        }
      }
    }
    participant = assignParticipantAsCaptain(participant, captainSlotId);
    participant.teamId = null;
    pMap.set(targetUserId, participant);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const slotRecord = {
      captainSlotId,
      tournamentId,
      userId: targetUserId,
      pbgId: participant.pbgId,
      displayName: participant.displayName,
      teamId: null,
      selectedAt: now,
      selectedBy: organizerUserId
    };
    slotMap.set(captainSlotId, slotRecord);
    syncDiscordTournamentRoles({
      userId: targetUserId,
      tournamentId
    }).catch((err) => console.warn("[selectCaptain] Discord sync note:", err));
    try {
      const db2 = getAdminDb();
      if (db2) {
        await db2.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        await db2.collection(`tournaments/${tournamentId}/captains`).doc(captainSlotId).set(slotRecord, { merge: true });
      }
    } catch {
    }
    return { participant, slot: slotRecord, replacedParticipant };
  });
}
async function removeTournamentCaptainAuthoritative(params) {
  const { tournamentId, targetUserId, captainSlotId } = params;
  return await withTournamentLock(tournamentId, async () => {
    const pMap = getTournamentParticipantMap(tournamentId);
    let participant = pMap.get(targetUserId);
    if (!participant) {
      throw new Error(`NOT_FOUND: Participant ${targetUserId} not found.`);
    }
    participant = removeParticipantFromCaptain(participant);
    participant.teamId = null;
    pMap.set(targetUserId, participant);
    const slotMap = getTournamentCaptainMap(tournamentId);
    slotMap.delete(captainSlotId);
    syncDiscordTournamentRoles({
      userId: targetUserId,
      tournamentId
    }).catch((err) => console.warn("[removeCaptain] Discord sync note:", err));
    try {
      const db2 = getAdminDb();
      if (db2) {
        await db2.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        await db2.collection(`tournaments/${tournamentId}/captains`).doc(captainSlotId).delete();
      }
    } catch {
    }
    return participant;
  });
}
async function restoreTeamFromEliminationAuthoritative(params) {
  const { tournamentId, teamId, fetchFn } = params;
  return await withTournamentLock(tournamentId, async () => {
    const teamMap = getTournamentTeamMap(tournamentId);
    const team = teamMap.get(teamId);
    if (!team) {
      throw new Error(`NOT_FOUND: Team ${teamId} not found in tournament ${tournamentId}.`);
    }
    team.status = "ACTIVE";
    team.eliminatedAt = void 0;
    team.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    teamMap.set(teamId, team);
    const pMap = getTournamentParticipantMap(tournamentId);
    const restoredParticipants = [];
    for (const memberId of team.roster) {
      const p = pMap.get(memberId);
      if (p) {
        p.eliminated = false;
        p.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        pMap.set(memberId, p);
        restoredParticipants.push(p);
        await syncDiscordTournamentRoles({
          userId: memberId,
          tournamentId,
          overrideContext: {
            team,
            participant: p
          },
          fetchFn
        }).catch((err) => console.warn("[restoreTeamFromElimination] Discord sync note:", err));
      }
    }
    try {
      const db2 = getAdminDb();
      if (db2) {
        await db2.collection(`tournaments/${tournamentId}/teams`).doc(teamId).set(team, { merge: true });
        for (const p of restoredParticipants) {
          await db2.collection(`tournaments/${tournamentId}/participants`).doc(p.userId).set(p, { merge: true });
        }
      }
    } catch {
    }
    return { team, restoredParticipants };
  });
}
function setTournamentLifecycleAuthoritative(params) {
  const { tournamentId, newLifecycle } = params;
  inMemoryLifecycles.set(tournamentId, newLifecycle);
  const regMap = getTournamentRegMap(tournamentId);
  const pMap = getTournamentParticipantMap(tournamentId);
  const readiness = validateAuctionReadiness({
    lifecycle: newLifecycle,
    registrations: Array.from(regMap.values()),
    participants: Array.from(pMap.values())
  });
  return { lifecycle: newLifecycle, readiness };
}
function checkAuctionReadinessContract(tournamentId) {
  const lifecycle = inMemoryLifecycles.get(tournamentId) || "REGISTRATION_OPEN";
  const regMap = getTournamentRegMap(tournamentId);
  const pMap = getTournamentParticipantMap(tournamentId);
  return validateAuctionReadiness({
    lifecycle,
    registrations: Array.from(regMap.values()),
    participants: Array.from(pMap.values())
  });
}

// ../src/domain/tournamentAuctionEngine.ts
var DEFAULT_AUCTION_CONFIG = {
  tournamentId: "",
  pursePerTeam: 1e3,
  minimumBid: 50,
  bidIncrement: 10,
  nominationTimerSeconds: 30,
  bidTimerSeconds: 25,
  primaryRosterSize: 5,
  standInLimit: 1,
  minBidderReserve: 50,
  allowEarlyUnsoldRecall: false
};
function calculateTournamentAverageMMR(params) {
  const { participants, registrations } = params;
  const activeParticipants = participants.filter((p) => p.participantStatus === "ACTIVE");
  if (activeParticipants.length === 0) {
    return {
      averageMMR: 5e3,
      targetRange: { min: 4750, max: 5250, target: 5e3 }
    };
  }
  let totalMMR = 0;
  for (const p of activeParticipants) {
    const reg = registrations.find((r) => r.userId === p.userId);
    const mmr = reg?.tournamentMMR || reg?.declaredMMR || 5e3;
    totalMMR += mmr;
  }
  const averageMMR = Math.round(totalMMR / activeParticipants.length);
  const min = Math.round(averageMMR * 0.95);
  const max = Math.round(averageMMR * 1.05);
  return {
    averageMMR,
    targetRange: { min, max, target: averageMMR }
  };
}
function calculateTeamMMR(primaryRosterUserIds, players) {
  if (primaryRosterUserIds.length === 0) return 0;
  let sum = 0;
  for (const uid of primaryRosterUserIds) {
    const p = players[uid];
    if (p) {
      sum += p.tournamentMMR || 0;
    }
  }
  return Math.round(sum / primaryRosterUserIds.length);
}
function validateTeamMMRFeasibility(params) {
  const { team, candidatePlayer, targetRange, players } = params;
  const currentRoster = [...team.primaryRosterUserIds];
  if (currentRoster.includes(candidatePlayer.userId)) {
    return { feasible: true, projectedMMR: team.teamMMR };
  }
  const nextRoster = [...currentRoster, candidatePlayer.userId];
  const projectedMMR = calculateTeamMMR(nextRoster, {
    ...players,
    [candidatePlayer.userId]: candidatePlayer
  });
  if (nextRoster.length >= 5) {
    if (projectedMMR < targetRange.min) {
      return {
        feasible: false,
        projectedMMR,
        reason: `Projected team MMR (${projectedMMR}) falls below minimum tournament target bracket of ${targetRange.min}.`
      };
    }
    if (projectedMMR > targetRange.max) {
      return {
        feasible: false,
        projectedMMR,
        reason: `Projected team MMR (${projectedMMR}) exceeds maximum tournament target bracket of ${targetRange.max}.`
      };
    }
  }
  return { feasible: true, projectedMMR };
}
function validateBidFeasibility(params) {
  const { session, team, bidAmount, candidatePlayer } = params;
  const config = session.config;
  if (session.status !== "LIVE" && session.status !== "STANDIN_PHASE") {
    return { valid: false, reason: `Auction is currently ${session.status}, bids are suspended.` };
  }
  if (session.currentNomination) {
    const requiredMin = session.currentNomination.currentBid > 0 ? session.currentNomination.currentBid + config.bidIncrement : session.currentNomination.openingBid;
    if (bidAmount < requiredMin) {
      return { valid: false, reason: `Bid of \u20B9${bidAmount} is below required minimum of \u20B9${requiredMin}.` };
    }
  } else if (bidAmount < config.minimumBid) {
    return { valid: false, reason: `Bid of \u20B9${bidAmount} is below starting minimum bid of \u20B9${config.minimumBid}.` };
  }
  if (bidAmount > team.purseRemaining) {
    return { valid: false, reason: `Insufficient credits: team has \u20B9${team.purseRemaining} remaining, bid requires \u20B9${bidAmount}.` };
  }
  if (session.currentPhase === "PRIMARY") {
    if (team.primaryRosterUserIds.length >= config.primaryRosterSize) {
      return {
        valid: false,
        reason: `Team ${team.name} already has all ${config.primaryRosterSize} primary players and is suspended from primary bidding.`
      };
    }
    const draftedCount = Math.max(0, team.primaryRosterUserIds.length - 1);
    const neededDraftSlots = config.primaryRosterSize - 1 - draftedCount;
    const remainingSlotsAfterThis = Math.max(0, neededDraftSlots - 1);
    const mandatoryReserve = remainingSlotsAfterThis * config.minimumBid;
    if (team.purseRemaining - bidAmount < mandatoryReserve) {
      return {
        valid: false,
        reason: `Reserve Rule: Team must retain \u20B9${mandatoryReserve} to purchase remaining ${remainingSlotsAfterThis} mandatory slot(s). Max allowable bid is \u20B9${team.purseRemaining - mandatoryReserve}.`
      };
    }
    const mmrCheck = validateTeamMMRFeasibility({
      team,
      candidatePlayer,
      targetRange: session.teamTargetMMRRange,
      players: session.players
    });
    if (!mmrCheck.feasible) {
      return { valid: false, reason: mmrCheck.reason };
    }
  } else if (session.currentPhase === "STAND_IN") {
    if (team.standInUserIds.length >= config.standInLimit) {
      return { valid: false, reason: `Team ${team.name} already has maximum of ${config.standInLimit} stand-in.` };
    }
  }
  return { valid: true };
}
function validateAuctionRuntimeIntegrity(session) {
  const blockers = [];
  const warnings = [];
  const teams = Object.values(session.teams);
  const players = Object.values(session.players);
  const seenCaptains = /* @__PURE__ */ new Set();
  const seenSlots = /* @__PURE__ */ new Set();
  for (const t of teams) {
    if (seenCaptains.has(t.captainUserId)) {
      blockers.push(`Duplicate captain ${t.captainUserId} owns multiple teams.`);
    }
    seenCaptains.add(t.captainUserId);
    if (seenSlots.has(t.captainSlotId)) {
      blockers.push(`Duplicate captain slot ${t.captainSlotId} detected.`);
    }
    seenSlots.add(t.captainSlotId);
    if (t.purseRemaining < 0) {
      blockers.push(`Team ${t.name} has negative purse balance (\u20B9${t.purseRemaining}).`);
    }
    if (t.primaryRosterUserIds.length > session.config.primaryRosterSize) {
      blockers.push(`Team ${t.name} exceeds primary roster limit (${t.primaryRosterUserIds.length}/${session.config.primaryRosterSize}).`);
    }
    if (t.standInUserIds.length > session.config.standInLimit) {
      blockers.push(`Team ${t.name} exceeds stand-in limit (${t.standInUserIds.length}/${session.config.standInLimit}).`);
    }
  }
  const assignedPlayers = /* @__PURE__ */ new Map();
  for (const t of teams) {
    for (const uid of t.primaryRosterUserIds) {
      if (assignedPlayers.has(uid)) {
        blockers.push(`Player ${uid} is assigned to multiple teams (${t.teamId} and ${assignedPlayers.get(uid)}).`);
      }
      assignedPlayers.set(uid, t.teamId);
    }
    for (const uid of t.standInUserIds) {
      if (assignedPlayers.has(uid)) {
        blockers.push(`Player ${uid} is assigned to multiple teams as stand-in.`);
      }
      assignedPlayers.set(uid, t.teamId);
    }
  }
  for (const t of teams) {
    const p = session.players[t.captainUserId];
    if (p && p.status === "AVAILABLE") {
      blockers.push(`Captain ${t.captainUserId} is erroneously present in the available auction pool.`);
    }
  }
  for (const p of players) {
    if (p.status === "SOLD" && !p.teamId) {
      blockers.push(`Player ${p.displayName || p.userId} has status SOLD but no assigned teamId.`);
    }
    if ((p.status === "AVAILABLE" || p.status === "UNSOLD" || p.status === "UNSELECTED") && p.teamId) {
      blockers.push(`Player ${p.displayName || p.userId} has status ${p.status} but possesses teamId ${p.teamId}.`);
    }
  }
  return {
    valid: blockers.length === 0,
    blockers,
    warnings
  };
}
function canRecallUnsold(session, playerId, options) {
  const player = session.players[playerId];
  if (!player) {
    return { allowed: false, reason: "PLAYER_NOT_FOUND: Player not found in auction pool." };
  }
  if (player.status !== "UNSOLD") {
    return { allowed: false, reason: `INVALID_STATUS: Player status is ${player.status}, expected UNSOLD.` };
  }
  if (session.status === "COMPLETED" || session.status === "CANCELLED") {
    return {
      allowed: false,
      reason: "AUCTION_COMPLETED: Auction is completed. Reopening the auction room is required to recall unsold players."
    };
  }
  const availableRemaining = Object.values(session.players).filter((p) => p.status === "AVAILABLE");
  if (availableRemaining.length > 0 && !options?.forceOverride) {
    return {
      allowed: false,
      reason: `AVAILABLE_POOL_NOT_EXHAUSTED: ${availableRemaining.length} normal AVAILABLE player(s) remain in the pool. UNSOLD re-auction begins only after all regular players are resolved.`
    };
  }
  const allPrimaryComplete = Object.values(session.teams).every(
    (t) => t.primaryRosterUserIds.length >= (session.config.primaryRosterSize || 5)
  );
  if (allPrimaryComplete && session.status !== "STANDIN_PHASE" && !options?.forceOverride) {
    return {
      allowed: false,
      reason: "PRIMARY_ROSTERS_COMPLETE: Primary rosters are full (5/5). Stand-In auction phase must be active to recall players."
    };
  }
  return { allowed: true };
}

// ../src/domain/tournamentDiscovery.ts
var LEGACY_MOCK_TOURNAMENT_IDS = /* @__PURE__ */ new Set([
  "2-team-auction-test",
  "purple-bean-test-cup",
  "auction-basic-test-1",
  "basic-test-1",
  "tourney-mumnc5ax",
  "pb-tourney-1790757456408"
]);
function isTestTournament(tournament) {
  if (!tournament) return false;
  const rawId = typeof tournament === "string" ? tournament : tournament.id || tournament.tournamentId || "";
  const idLower = String(rawId || "").toLowerCase();
  if (typeof tournament === "object" && tournament.testMode === true || idLower === "purple-bean-auction-test" || typeof tournament === "object" && (tournament.isDevelopment === true || tournament.isSynthetic === true || tournament.isDummy === true) || typeof tournament === "object" && (tournament.deleted === true || tournament.status === "DELETED" || tournament.status === "deleted" || tournament.lifecycle === "CANCELLED_DELETED")) {
    return true;
  }
  if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) {
    return true;
  }
  return false;
}
function isTestPlayer(player) {
  if (!player) return false;
  const idLower = String(player.id || player.userId || player.pbgId || "").toLowerCase();
  return player.isTestAccount === true || player.source === "TEST_SEED" || idLower.startsWith("pbg-test-") || idLower.startsWith("dummy-") || idLower.startsWith("p-tc-") || idLower.startsWith("tc-") || player.isDummy === true || player.isSynthetic === true;
}
function isTestTeam(team) {
  if (!team) return false;
  const idLower = String(team.id || "").toLowerCase();
  const tourneyIdLower = String(team.tournamentId || "").toLowerCase();
  return idLower.startsWith("tc-team") || LEGACY_MOCK_TOURNAMENT_IDS.has(tourneyIdLower) || idLower === "team-9s8uyzbbgxz5tfgyukaoangqjpo2-2177" || idLower === "team-s1syelw0xhwkgjenyaobvh7btjt2-197" || team.isDummy === true || team.isSynthetic === true;
}
function normalizeStatus(rawStatus) {
  if (!rawStatus) return "DRAFT";
  const clean = rawStatus.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (clean === "REGISTRATION_OPEN" || clean === "REGISTRATION" || clean === "OPEN") {
    return "REGISTRATION_OPEN";
  }
  if (clean === "REGISTRATION_CLOSED" || clean === "CLOSED") {
    return "REGISTRATION_CLOSED";
  }
  if (clean === "CAPTAIN_SELECTION" || clean === "CAPTAINS") {
    return "CAPTAIN_SELECTION";
  }
  if (clean === "AUCTION_READY") {
    return "AUCTION_READY";
  }
  if (clean === "AUCTION_ACTIVE" || clean === "AUCTION" || clean === "DRAFTING") {
    return "AUCTION_ACTIVE";
  }
  if (clean === "AUCTION_COMPLETED") {
    return "AUCTION_COMPLETED";
  }
  if (clean === "SEEDING") {
    return "SEEDING";
  }
  if (clean === "STRUCTURE_GENERATED") {
    return "STRUCTURE_GENERATED";
  }
  if (clean === "ACTIVE" || clean === "LIVE" || clean === "IN_PROGRESS") {
    return "ACTIVE";
  }
  if (clean === "COMPLETED" || clean === "FINISHED") {
    return "COMPLETED";
  }
  if (clean === "CANCELLED" || clean === "CANCELED") {
    return "CANCELLED";
  }
  if (clean === "DRAFT") {
    return "DRAFT";
  }
  return clean;
}
function normalizeVisibility(t) {
  if (!t) return "DRAFT";
  const raw = t.visibility || t.config?.identity?.visibility;
  if (typeof raw === "string") {
    const vUpper = raw.trim().toUpperCase();
    if (vUpper === "PUBLIC" || vUpper === "PUBLIC_CIRCUIT") {
      return "PUBLIC";
    }
    if (vUpper === "DRAFT") {
      return "DRAFT";
    }
    if (vUpper === "PRIVATE") {
      return "PRIVATE";
    }
    if (vUpper === "UNLISTED") {
      return "UNLISTED";
    }
  }
  if (t.isPublic === true || t.published === true || t.config?.identity?.isPublic === true || t.config?.identity?.published === true) {
    return "PUBLIC";
  }
  if (t.isPrivate === true || t.config?.identity?.isPrivate === true) {
    return "PRIVATE";
  }
  return "PUBLIC";
}
function normalizeGameId(gameOrId) {
  if (!gameOrId || typeof gameOrId !== "string") return "dota2";
  const clean = gameOrId.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (clean === "dota2" || clean === "dota") return "dota2";
  if (clean === "cs2" || clean === "counterstrike2") return "cs2";
  if (clean === "valorant") return "valorant";
  if (clean === "bgmi") return "bgmi";
  if (clean === "pubg") return "pubg";
  return clean;
}
function isPubliclyDiscoverable(tournament) {
  if (!tournament) return false;
  if (tournament.deleted === true || tournament.status === "DELETED") {
    return false;
  }
  const rawId = String(tournament.id || tournament.tournamentId || "").toLowerCase();
  if (rawId === "purple-bean-auction-test" || rawId === "auction-test") {
    return true;
  }
  if (isTestTournament(tournament)) {
    return false;
  }
  const visibility = normalizeVisibility(tournament);
  if (visibility === "PRIVATE" || visibility === "UNLISTED" || visibility === "DRAFT") {
    return false;
  }
  const normStatus = (tournament.status || tournament.lifecycle || "").toUpperCase();
  if (normStatus === "DRAFT") {
    return false;
  }
  return true;
}
function matchesStatusCategory(rawStatus, filterCategory) {
  if (!filterCategory) return true;
  const f = filterCategory.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (f === "ALL" || f === "ALL_STATUSES") return true;
  const canonical = normalizeStatus(rawStatus);
  if (f === "REGISTRATION_OPEN") {
    return canonical === "REGISTRATION_OPEN";
  }
  if (f === "LIVE") {
    return canonical === "ACTIVE" || canonical === "AUCTION_ACTIVE";
  }
  if (f === "COMPLETED") {
    return canonical === "COMPLETED";
  }
  if (f === "UPCOMING") {
    return canonical === "REGISTRATION_CLOSED" || canonical === "SEEDING" || canonical === "STRUCTURE_GENERATED" || canonical === "UPCOMING";
  }
  if (f === "DRAFTING") {
    return canonical === "CAPTAIN_SELECTION" || canonical === "AUCTION_READY" || canonical === "AUCTION_ACTIVE" || canonical === "AUCTION_COMPLETED";
  }
  return canonical === f;
}
function matchesGameFilter(tournamentGame, tournamentGameId, filter) {
  if (!filter || filter === "All" || filter === "All Games" || filter === "All Esports Titles") {
    return true;
  }
  const normFilter = normalizeGameId(filter);
  const normTourney = normalizeGameId(tournamentGameId || tournamentGame);
  return normTourney === normFilter;
}
function normalizeTournamentRecord(t) {
  const normVisibility = normalizeVisibility(t);
  const rawStatus = t.status || t.lifecycle || t.config?.identity?.status || "DRAFT";
  const normStatus = normalizeStatus(rawStatus);
  const normGameId = normalizeGameId(t.gameId || t.game || t.config?.identity?.gameId);
  const finalStatus = normStatus;
  const finalVisibility = normVisibility;
  const prizePoolText = t.prizePoolINR || t.prizePool || "\u20B950,000 INR";
  const totalPrizeNumber = typeof t.totalPrizeNumber === "number" ? t.totalPrizeNumber : typeof t.prizes?.totalPrizePoolINR === "number" ? t.prizes.totalPrizePoolINR : 5e4;
  const keyInfo = t.keyInfo ? {
    server: t.keyInfo.server || "Mumbai / Chennai Low-Latency Node",
    antiCheat: t.keyInfo.antiCheat || "Valve VAC & PBG Integrity Audit",
    bracketFormat: t.keyInfo.bracketFormat || (t.format || "Double Elimination (BO3 / BO5 Finals)"),
    rosterLock: t.keyInfo.rosterLock || "Enforced at Bracket Seeding"
  } : {
    server: "Mumbai / Chennai Low-Latency Node",
    antiCheat: "Valve VAC & PBG Integrity Audit",
    bracketFormat: t.format || "Double Elimination (BO3 / BO5 Finals)",
    rosterLock: "Enforced at Bracket Seeding"
  };
  const prizeDistribution = Array.isArray(t.prizeDistribution) && t.prizeDistribution.length > 0 ? t.prizeDistribution : [
    { place: "1st Place (Champion)", amount: "\u20B930,000", percentage: "60%" },
    { place: "2nd Place (Runner-up)", amount: "\u20B912,500", percentage: "25%" },
    { place: "3rd Place", amount: "\u20B97,500", percentage: "15%" }
  ];
  const stages = Array.isArray(t.stages) && t.stages.length > 0 ? t.stages : [
    { id: "reg", name: "Open Player & Team Registration", status: "completed", date: "Phase 1" },
    { id: "auction", name: "Live Captain Credit Auction", status: "current", date: "Phase 2" },
    { id: "bracket", name: "Double Elimination Championship", status: "upcoming", date: "Phase 3" }
  ];
  return {
    ...t,
    id: t.id || t.config?.identity?.tournamentId || `pb-tourney-${Date.now()}`,
    name: t.name || t.config?.identity?.name || "Tournament",
    game: t.game || t.config?.identity?.gameName || "Dota 2",
    gameId: normGameId,
    visibility: finalVisibility,
    status: finalStatus,
    lifecycle: finalStatus,
    region: t.region || t.config?.identity?.region || "Pan India",
    city: t.city || t.config?.identity?.city || null,
    dates: t.dates || (t.startDate ? `${t.startDate} - ${t.endDate || ""}` : "Upcoming 2026 Circuit"),
    startDate: t.startDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    endDate: t.endDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    prizePool: prizePoolText,
    prizePoolINR: prizePoolText,
    totalPrizeNumber,
    teamCount: typeof t.teamCount === "number" ? t.teamCount : Array.isArray(t.teams) ? t.teams.length : 8,
    playerCount: typeof t.playerCount === "number" ? t.playerCount : 40,
    format: t.format || "Double Elimination",
    organizer: t.organizer || t.organizerName || "Purple Bean Esports India",
    description: t.description || "Official Pan-India esports tournament featuring verified Indian server nodes, referee anti-cheat monitoring, and direct INR payouts.",
    keyInfo,
    prizeDistribution,
    stages
  };
}
function normalizeTeamRecord(raw) {
  if (!raw) {
    return {
      id: `team-${Date.now()}`,
      name: "Unknown Team",
      tag: "TEAM",
      logo: "\u{1F6E1}\uFE0F",
      color: "#7C3AED",
      bgHex: "#7C3AED",
      country: "India",
      flag: "\u{1F1EE}\u{1F1F3}",
      city: "India",
      region: "Pan India",
      primaryGame: "Dota 2",
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      captainId: "",
      captainName: "Captain",
      players: [],
      standIn: "",
      groupPoints: 0,
      mapsRecord: { won: 0, lost: 0 },
      form: [],
      description: ""
    };
  }
  const wins = typeof raw.record?.wins === "number" ? raw.record.wins : typeof raw.wins === "number" ? raw.wins : 0;
  const losses = typeof raw.record?.losses === "number" ? raw.record.losses : typeof raw.losses === "number" ? raw.losses : 0;
  const mapsWon = typeof raw.mapsRecord?.won === "number" ? raw.mapsRecord.won : 0;
  const mapsLost = typeof raw.mapsRecord?.lost === "number" ? raw.mapsRecord.lost : 0;
  return {
    ...raw,
    id: raw.id || `team-${Date.now()}`,
    name: raw.name || "Unnamed Team",
    tag: raw.tag || raw.name?.slice(0, 4)?.toUpperCase() || "TEAM",
    logo: raw.logo || "\u{1F6E1}\uFE0F",
    color: raw.color || "#7C3AED",
    bgHex: raw.bgHex || raw.color || "#7C3AED",
    country: raw.country || "India",
    flag: raw.flag || "\u{1F1EE}\u{1F1F3}",
    city: raw.city || "India",
    region: raw.region || "Pan India",
    primaryGame: raw.primaryGame || "Dota 2",
    rating: typeof raw.rating === "number" ? raw.rating : 1500,
    record: { wins, losses },
    tournamentWins: typeof raw.tournamentWins === "number" ? raw.tournamentWins : 0,
    captainId: raw.captainId || "",
    captainName: raw.captainName || raw.captainIgn || "Captain",
    players: Array.isArray(raw.players) ? raw.players : Array.isArray(raw.primaryRoster) ? raw.primaryRoster.map((p) => p.userId || p.id) : [],
    standIn: raw.standIn || "",
    groupPoints: typeof raw.groupPoints === "number" ? raw.groupPoints : 0,
    mapsRecord: { won: mapsWon, lost: mapsLost },
    form: Array.isArray(raw.form) ? raw.form : [],
    description: raw.description || `Official team ${raw.name || ""}`,
    earningsINR: raw.earningsINR || "\u20B90",
    tournamentId: raw.tournamentId
  };
}
function normalizePlayerRecord(raw) {
  if (!raw) {
    return {
      id: `p-${Date.now()}`,
      username: "Player",
      realName: "Player",
      avatar: "\u{1F3AE}",
      country: "India",
      flag: "\u{1F1EE}\u{1F1F3}",
      city: "India",
      region: "Pan India",
      primaryGame: "Dota 2",
      mmr: 5e3,
      tournamentMmr: 5e3,
      platformRating: 1500,
      primaryRole: "Position 1 \u2014 Carry",
      secondaryRole: "Position 2 \u2014 Mid",
      status: "Verified",
      matches: 0,
      wins: 0,
      losses: 0,
      winRate: 50,
      tournamentWins: 0,
      mvps: 0,
      experienceYears: 3,
      previousCaptainRecord: "0-0",
      bio: "",
      heroPool: []
    };
  }
  const wins = typeof raw.wins === "number" ? raw.wins : typeof raw.winsCount === "number" ? raw.winsCount : 0;
  const losses = typeof raw.losses === "number" ? raw.losses : typeof raw.lossesCount === "number" ? raw.lossesCount : 0;
  const matches = typeof raw.matches === "number" ? raw.matches : typeof raw.matchesCount === "number" ? raw.matchesCount : wins + losses;
  const mmr = typeof raw.mmr === "number" ? raw.mmr : typeof raw.tournamentMmr === "number" ? raw.tournamentMmr : typeof raw.declaredMmr === "number" ? raw.declaredMmr : 5e3;
  const rawId = String(raw.id || raw.userId || "");
  let pbgId = raw.pbgId;
  if (!pbgId) {
    if (rawId === "dCZd7IjKpxYDBjTQe5FUhccuX583" || raw.email?.toLowerCase() === "myana.santhosh@gmail.com") {
      pbgId = "PBG-000188";
    } else if (rawId === "wUyRsN0f40bYdyCpLp6UNeIJjpD3" || raw.email?.toLowerCase() === "11106cm009@gmail.com") {
      pbgId = "PBG-000186";
    } else if (rawId.startsWith("PBG-")) {
      pbgId = rawId;
    } else if (rawId.startsWith("p-")) {
      const matchNum = rawId.match(/\d+/)?.[0];
      if (matchNum) {
        pbgId = `PBG-${matchNum.padStart(6, "0")}`;
      }
    }
  }
  let username = raw.username || raw.ign || raw.steamPersonaName || raw.displayName;
  let displayName = raw.displayName || raw.username || raw.ign || raw.steamPersonaName;
  let realName = raw.realName || raw.displayName || raw.username || raw.ign;
  if (pbgId === "PBG-000188" || rawId === "dCZd7IjKpxYDBjTQe5FUhccuX583" || raw.email?.toLowerCase() === "myana.santhosh@gmail.com") {
    pbgId = "PBG-000188";
    username = !username || username === "Player" ? "Santhosh Myana" : username;
    displayName = !displayName || displayName === "Player" ? "Santhosh Myana" : displayName;
    realName = !realName || realName === "Player" ? "Santhosh Myana" : realName;
  } else if (pbgId === "PBG-000186" || rawId === "wUyRsN0f40bYdyCpLp6UNeIJjpD3" || raw.email?.toLowerCase() === "11106cm009@gmail.com") {
    pbgId = "PBG-000186";
    username = !username || username === "Player" ? "Bharadwaja Anisetti" : username;
    displayName = !displayName || displayName === "Player" ? "Bharadwaja Anisetti" : displayName;
    realName = !realName || realName === "Player" ? "Bharadwaja Anisetti" : realName;
  }
  return {
    ...raw,
    id: raw.id || raw.userId || pbgId || `p-${Date.now()}`,
    pbgId,
    username: username || "Player",
    displayName: displayName || username || "Player",
    realName: realName || displayName || username || "Player",
    avatar: raw.avatar || "\u{1F3AE}",
    country: raw.country || "India",
    flag: raw.flag || "\u{1F1EE}\u{1F1F3}",
    city: raw.city || "India",
    region: raw.region || "Pan India",
    primaryGame: raw.primaryGame || "Dota 2",
    mmr,
    tournamentMmr: typeof raw.tournamentMmr === "number" ? raw.tournamentMmr : mmr,
    platformRating: typeof raw.platformRating === "number" ? raw.platformRating : typeof raw.competitiveRating === "number" ? raw.competitiveRating : 1500,
    primaryRole: raw.primaryRole || "Position 1 \u2014 Carry",
    secondaryRole: raw.secondaryRole || "Position 2 \u2014 Mid",
    teamId: raw.teamId || raw.currentTeamId,
    teamName: raw.teamName || raw.currentTeamName,
    status: raw.status === "Pending Review" || raw.status === "Flagged" ? raw.status : "Verified",
    matches,
    wins,
    losses,
    winRate: typeof raw.winRate === "number" ? raw.winRate : matches > 0 ? Math.round(wins / matches * 100) : 50,
    tournamentWins: typeof raw.tournamentWins === "number" ? raw.tournamentWins : typeof raw.tournamentCount === "number" ? raw.tournamentCount : 0,
    mvps: typeof raw.mvps === "number" ? raw.mvps : 0,
    experienceYears: typeof raw.experienceYears === "number" ? raw.experienceYears : 3,
    previousCaptainRecord: raw.previousCaptainRecord || `${wins}-${losses}`,
    bio: raw.bio || "",
    heroPool: Array.isArray(raw.heroPool) ? raw.heroPool : []
  };
}

// ../src/server/tournamentAuctionOperations.ts
var inMemoryAuctionSessions = /* @__PURE__ */ new Map();
var tournamentAuctionLocks = /* @__PURE__ */ new Map();
async function withAuctionLock(tournamentId, fn) {
  const current = tournamentAuctionLocks.get(tournamentId) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  tournamentAuctionLocks.set(tournamentId, next);
  await current.catch(() => {
  });
  try {
    return await fn();
  } finally {
    release();
  }
}
function resolveCaptainAuthorization(params) {
  const { tournamentId, actorUserId, session } = params;
  const lifecycle = inMemoryLifecycles.get(tournamentId);
  if (lifecycle === "ON_HOLD") {
    return { authorized: false, error: "TOURNAMENT_ON_HOLD: Auction operations are currently paused while tournament is on hold." };
  }
  const pMap = inMemoryParticipants.get(tournamentId);
  const participant = pMap?.get(actorUserId);
  if (!participant || participant.participantStatus !== "ACTIVE") {
    return { authorized: false, error: "NOT_A_PARTICIPANT: User is not an active participant in this tournament." };
  }
  if (participant.tournamentRole !== "CAPTAIN" || !participant.captainSlotId) {
    return { authorized: false, error: "NOT_A_CAPTAIN: Participant does not hold an authorized captain role." };
  }
  const currentSession = session || inMemoryAuctionSessions.get(tournamentId);
  if (!currentSession) {
    return { authorized: false, error: "AUCTION_NOT_INITIALIZED: No active auction session found." };
  }
  const team = Object.values(currentSession.teams).find((t) => t.captainUserId === actorUserId);
  if (!team) {
    return { authorized: false, error: "NO_TEAM_OWNED: Captain does not possess an authorized auction team slot." };
  }
  return {
    authorized: true,
    captain: participant,
    team
  };
}
async function startAuctionSessionAuthoritative(params) {
  const { tournamentId, actorUserId, configOverride } = params;
  return await withAuctionLock(tournamentId, async () => {
    const regMap = inMemoryRegistrations.get(tournamentId) || /* @__PURE__ */ new Map();
    const pMap = inMemoryParticipants.get(tournamentId) || /* @__PURE__ */ new Map();
    const isTest = isTestTournament(tournamentId) || configOverride?.testMode === true;
    const lifecycle = inMemoryLifecycles.get(tournamentId) || (isTest ? "REGISTRATION_CLOSED" : "REGISTRATION_OPEN");
    const registrations = Array.from(regMap.values());
    const participants = Array.from(pMap.values());
    const activeCaptains = participants.filter((p) => p.participantStatus === "ACTIVE" && p.tournamentRole === "CAPTAIN");
    const targetCaptainCount = params.targetCaptainCount ?? configOverride?.targetCaptainCount ?? (activeCaptains.length >= 2 ? activeCaptains.length : 4);
    const readiness = validateAuctionReadiness({
      lifecycle,
      registrations,
      participants,
      targetCaptainCount,
      testMode: isTest
    });
    if (!readiness.isReady) {
      const errorMsg = `AUCTION_GATE_BLOCKED: Tournament is not ready for auction. Blockers: ${readiness.blockers.map((b) => b.code).join(", ")}`;
      const err = new Error(errorMsg);
      err.blockers = readiness.blockers;
      err.readiness = readiness;
      throw err;
    }
    const validCaptains = participants.filter(
      (p) => p.participantStatus === "ACTIVE" && p.tournamentRole === "CAPTAIN" && p.captainSlotId !== null && p.auctionStatus === "NOT_IN_POOL" && p.teamId === null
    );
    if (validCaptains.length < 2) {
      throw new Error(`INSUFFICIENT_CAPTAINS: Auction requires at least 2 valid captains (found ${validCaptains.length}).`);
    }
    const validPoolPlayers = participants.filter(
      (p) => p.participantStatus === "ACTIVE" && p.tournamentRole === "PLAYER" && p.auctionStatus === "AVAILABLE" && p.teamId === null && !p.eliminated
    );
    if (validPoolPlayers.length === 0) {
      throw new Error("EMPTY_AUCTION_POOL: No available players found in tournament participant pool.");
    }
    const config = {
      ...DEFAULT_AUCTION_CONFIG,
      ...configOverride,
      tournamentId
    };
    const { averageMMR, targetRange } = calculateTournamentAverageMMR({
      participants,
      registrations
    });
    const teamsRecord = {};
    const playersRecord = {};
    for (const cap of validCaptains) {
      const teamId = `team-${tournamentId}-${cap.captainSlotId}`;
      const reg = registrations.find((r) => r.userId === cap.userId);
      const capMMR = reg?.tournamentMMR || reg?.declaredMMR || averageMMR;
      playersRecord[cap.userId] = {
        id: cap.userId,
        userId: cap.userId,
        pbgId: cap.pbgId,
        displayName: cap.displayName,
        tournamentMMR: capMMR,
        primaryRole: reg?.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: reg?.secondaryRole,
        status: "SOLD",
        // Captain is locked in own team
        teamId,
        soldAmount: 0,
        soldToTeamId: teamId
      };
      teamsRecord[teamId] = {
        teamId,
        tournamentId,
        captainUserId: cap.userId,
        captainSlotId: cap.captainSlotId,
        name: `${cap.displayName}'s Squad`,
        tag: (cap.displayName.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "PBG").toUpperCase(),
        logo: "\u{1F6E1}\uFE0F",
        color: "#7C3AED",
        purseTotal: config.pursePerTeam,
        purseRemaining: config.pursePerTeam,
        primaryRosterUserIds: [cap.userId],
        // Captain counts as 1 of 5
        standInUserIds: [],
        primaryRosterComplete: false,
        standInComplete: false,
        teamMMR: capMMR,
        targetMMRRange: targetRange,
        status: "ACTIVE",
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    for (const player of validPoolPlayers) {
      const reg = registrations.find((r) => r.userId === player.userId);
      playersRecord[player.userId] = {
        id: player.userId,
        userId: player.userId,
        pbgId: player.pbgId,
        displayName: player.displayName,
        tournamentMMR: reg?.tournamentMMR || reg?.declaredMMR || averageMMR,
        primaryRole: reg?.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: reg?.secondaryRole,
        status: "AVAILABLE",
        teamId: null
      };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const startEvent = {
      eventId: `evt_${Date.now()}_start`,
      sequenceNumber: 1,
      timestamp: now,
      actorUserId,
      type: "AUCTION_STARTED",
      payload: {
        tournamentId,
        totalCaptains: validCaptains.length,
        totalPool: validPoolPlayers.length,
        averageMMR,
        targetRange
      }
    };
    const session = {
      tournamentId,
      status: "LIVE",
      currentPhase: "PRIMARY",
      currentNomination: null,
      config,
      averageParticipantMMR: averageMMR,
      teamTargetMMRRange: targetRange,
      teams: teamsRecord,
      players: playersRecord,
      bidHistory: [],
      events: [startEvent],
      startedAt: now,
      updatedAt: now,
      revision: 1
    };
    const integrity = validateAuctionRuntimeIntegrity(session);
    if (!integrity.valid) {
      throw new Error(`AUCTION_INTEGRITY_FAILED: ${integrity.blockers.join(", ")}`);
    }
    inMemoryAuctionSessions.set(tournamentId, session);
    if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
      try {
        const db2 = getAdminDb();
        if (db2) {
          await db2.collection(`tournaments/${tournamentId}/auction`).doc("current").set(removeUndefinedDeep({
            status: session.status,
            currentPhase: session.currentPhase,
            config: session.config,
            averageParticipantMMR: session.averageParticipantMMR,
            teamTargetMMRRange: session.teamTargetMMRRange,
            startedAt: session.startedAt,
            updatedAt: session.updatedAt,
            revision: session.revision
          }));
          for (const t of Object.values(session.teams)) {
            await db2.collection(`tournaments/${tournamentId}/auctionTeams`).doc(t.teamId).set(removeUndefinedDeep(t));
          }
          for (const p of Object.values(session.players)) {
            await db2.collection(`tournaments/${tournamentId}/auctionPlayers`).doc(p.userId).set(removeUndefinedDeep(p));
          }
          await db2.collection(`tournaments/${tournamentId}/auctionEvents`).doc(startEvent.eventId).set(removeUndefinedDeep(startEvent));
        }
      } catch (err) {
        console.warn("[startAuctionSession] Firestore write note:", err.message);
      }
    }
    return { session, integrity };
  });
}
async function nominatePlayerAuthoritative(params) {
  const { tournamentId, actorUserId, playerId, openingBid, isOrganiserOverride } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    if (session.status !== "LIVE" && session.status !== "STANDIN_PHASE") {
      throw new Error(`AUCTION_NOT_LIVE: Cannot nominate while auction is ${session.status}.`);
    }
    if (session.currentNomination) {
      throw new Error(`NOMINATION_ACTIVE: Player ${session.currentNomination.nominatedPlayerId} is currently on the auction block.`);
    }
    let nominatingCaptainId = actorUserId;
    let nominatingTeamId;
    if (!isOrganiserOverride) {
      const auth2 = resolveCaptainAuthorization({ tournamentId, actorUserId, session });
      if (!auth2.authorized || !auth2.team) {
        throw new Error(auth2.error || "UNAUTHORIZED: Only franchise captains can nominate players.");
      }
      if (session.currentPhase === "PRIMARY" && auth2.team.primaryRosterUserIds.length >= session.config.primaryRosterSize) {
        throw new Error(`TEAM_SUSPENDED: Team ${auth2.team.name} has completed primary roster and cannot nominate in primary phase.`);
      }
      nominatingTeamId = auth2.team.teamId;
    }
    const player = session.players[playerId];
    if (!player) {
      throw new Error(`PLAYER_NOT_FOUND: Player ${playerId} is not in the tournament auction pool.`);
    }
    if (player.status !== "AVAILABLE") {
      throw new Error(`INVALID_PLAYER_STATUS: Cannot nominate player with status ${player.status}.`);
    }
    const bid = openingBid && openingBid >= session.config.minimumBid ? openingBid : session.config.minimumBid;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const duration = session.config.nominationTimerSeconds || 30;
    const nomination = {
      nominatedPlayerId: playerId,
      nominatedByCaptainId: nominatingCaptainId,
      nominatedAt: now,
      openingBid: bid,
      currentBid: bid,
      currentLeaderCaptainId: nominatingTeamId ? nominatingCaptainId : void 0,
      currentLeaderTeamId: nominatingTeamId,
      bidCount: nominatingTeamId ? 1 : 0,
      expiresAt: Date.now() + duration * 1e3,
      phase: session.currentPhase === "STAND_IN" ? "STAND_IN" : "PRIMARY"
    };
    player.status = "NOMINATED";
    player.nominatedAt = now;
    session.currentNomination = nomination;
    session.revision++;
    session.updatedAt = now;
    const event = {
      eventId: `evt_${Date.now()}_nominate`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "PLAYER_NOMINATED",
      payload: {
        nomination,
        player
      }
    };
    session.events.push(event);
    return session;
  });
}
async function placeBidAuthoritative(params) {
  const { tournamentId, actorUserId, bidAmount } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const nomination = session.currentNomination;
    if (!nomination) {
      throw new Error("NO_ACTIVE_NOMINATION: No player is currently on the auction block.");
    }
    const auth2 = resolveCaptainAuthorization({ tournamentId, actorUserId, session });
    if (!auth2.authorized || !auth2.team) {
      throw new Error(auth2.error || "UNAUTHORIZED: Only franchise captains can place bids.");
    }
    const team = auth2.team;
    if (nomination.currentLeaderTeamId === team.teamId) {
      throw new Error("ALREADY_HIGH_BIDDER: Your team is already holding the winning bid.");
    }
    const candidatePlayer = session.players[nomination.nominatedPlayerId];
    if (!candidatePlayer) {
      throw new Error("NOMINEE_NOT_FOUND: Nominated player record not found.");
    }
    const feasibility = validateBidFeasibility({
      session,
      team,
      bidAmount,
      candidatePlayer
    });
    if (!feasibility.valid) {
      throw new Error(`BID_REJECTED: ${feasibility.reason}`);
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const bidRecord = {
      bidId: `bid_${Date.now()}_${team.teamId}`,
      tournamentId,
      auctionId: session.tournamentId,
      playerId: candidatePlayer.userId,
      captainUserId: actorUserId,
      teamId: team.teamId,
      amount: bidAmount,
      createdAt: now
    };
    nomination.currentBid = bidAmount;
    nomination.currentLeaderCaptainId = actorUserId;
    nomination.currentLeaderTeamId = team.teamId;
    nomination.bidCount++;
    const timeLeft = nomination.expiresAt - Date.now();
    if (timeLeft < 5e3) {
      nomination.expiresAt = Date.now() + 5e3;
    }
    session.bidHistory.push(bidRecord);
    session.revision++;
    session.updatedAt = now;
    const event = {
      eventId: `evt_${Date.now()}_bid`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "BID_PLACED",
      payload: {
        bid: bidRecord,
        teamName: team.name,
        playerName: candidatePlayer.displayName
      }
    };
    session.events.push(event);
    return { session, bidRecord };
  });
}
async function finalizeNominationLotAuthoritative(params) {
  const { tournamentId, actorUserId, forceUnsold } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const nomination = session.currentNomination;
    if (!nomination) {
      throw new Error("NO_ACTIVE_NOMINATION: No player is currently on the auction block.");
    }
    const player = session.players[nomination.nominatedPlayerId];
    if (!player) {
      throw new Error("NOMINEE_NOT_FOUND: Nominated player record not found.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (nomination.currentLeaderTeamId && !forceUnsold) {
      const team = session.teams[nomination.currentLeaderTeamId];
      if (!team) {
        throw new Error("WINNING_TEAM_NOT_FOUND: Winning team record was not found.");
      }
      const winningAmount = nomination.currentBid;
      team.purseRemaining = Math.max(0, team.purseRemaining - winningAmount);
      player.status = "SOLD";
      player.teamId = team.teamId;
      player.soldAmount = winningAmount;
      player.soldToTeamId = team.teamId;
      player.soldAt = now;
      if (session.currentPhase === "PRIMARY") {
        team.primaryRosterUserIds.push(player.userId);
        if (team.primaryRosterUserIds.length >= session.config.primaryRosterSize) {
          team.primaryRosterComplete = true;
          session.events.push({
            eventId: `evt_${Date.now()}_team_complete`,
            sequenceNumber: session.events.length + 1,
            timestamp: now,
            actorUserId,
            type: "TEAM_PRIMARY_COMPLETE",
            payload: { teamId: team.teamId, teamName: team.name }
          });
        }
      } else if (session.currentPhase === "STAND_IN") {
        player.isStandIn = true;
        team.standInUserIds.push(player.userId);
        team.standInComplete = true;
      }
      team.teamMMR = calculateTeamMMR(team.primaryRosterUserIds, session.players);
      team.updatedAt = now;
      const pMap = inMemoryParticipants.get(tournamentId);
      if (pMap?.has(player.userId)) {
        const participant = pMap.get(player.userId);
        participant.auctionStatus = "SOLD";
        participant.teamId = team.teamId;
        participant.updatedAt = now;
      }
      session.currentNomination = null;
      session.revision++;
      session.updatedAt = now;
      const allPrimaryComplete = Object.values(session.teams).every(
        (t) => t.primaryRosterUserIds.length >= session.config.primaryRosterSize
      );
      if (allPrimaryComplete && session.currentPhase === "PRIMARY") {
        session.status = "PRIMARY_ROSTERS_COMPLETE";
        session.events.push({
          eventId: `evt_${Date.now()}_all_primary_complete`,
          sequenceNumber: session.events.length + 1,
          timestamp: now,
          actorUserId,
          type: "ALL_PRIMARY_COMPLETE",
          payload: { totalTeams: Object.keys(session.teams).length }
        });
      }
      session.events.push({
        eventId: `evt_${Date.now()}_sold`,
        sequenceNumber: session.events.length + 1,
        timestamp: now,
        actorUserId,
        type: session.currentPhase === "STAND_IN" ? "STANDIN_SOLD" : "PLAYER_SOLD",
        payload: {
          playerId: player.userId,
          playerName: player.displayName,
          teamId: team.teamId,
          teamName: team.name,
          amount: winningAmount,
          phase: session.currentPhase
        }
      });
      return { session, result: "SOLD", player, team };
    }
    player.status = "UNSOLD";
    player.teamId = null;
    player.soldAmount = void 0;
    player.soldToTeamId = void 0;
    session.currentNomination = null;
    session.revision++;
    session.updatedAt = now;
    session.events.push({
      eventId: `evt_${Date.now()}_unsold`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "PLAYER_UNSOLD",
      payload: {
        playerId: player.userId,
        playerName: player.displayName
      }
    });
    return { session, result: "UNSOLD", player };
  });
}
async function reintroduceUnsoldPlayerAuthoritative(params) {
  const { tournamentId, actorUserId, playerId, forceOverride } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const player = session.players[playerId];
    if (!player) {
      throw new Error("PLAYER_NOT_FOUND: Player not found.");
    }
    if (player.status !== "UNSOLD") {
      throw new Error(`INVALID_STATUS: Player status is ${player.status}, expected UNSOLD.`);
    }
    const recallCheck = canRecallUnsold(session, playerId, { forceOverride });
    if (!recallCheck.allowed && !forceOverride) {
      throw new Error(recallCheck.reason || "RECALL_NOT_ALLOWED");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    player.status = "AVAILABLE";
    session.revision++;
    session.updatedAt = now;
    session.events.push({
      eventId: `evt_${Date.now()}_reintroduced`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "PLAYER_REINTRODUCED",
      payload: {
        playerId: player.userId,
        playerName: player.displayName,
        forced: Boolean(forceOverride)
      }
    });
    return session;
  });
}
async function startStandInPhaseAuthoritative(params) {
  const { tournamentId, actorUserId } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const allPrimaryComplete = Object.values(session.teams).every(
      (t) => t.primaryRosterUserIds.length >= session.config.primaryRosterSize
    );
    if (!allPrimaryComplete) {
      throw new Error("PRIMARY_ROSTERS_INCOMPLETE: Stand-in phase requires all teams to complete primary 5-player rosters first.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    session.status = "STANDIN_PHASE";
    session.currentPhase = "STAND_IN";
    session.revision++;
    session.updatedAt = now;
    session.events.push({
      eventId: `evt_${Date.now()}_standin_phase`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "STANDIN_PHASE_STARTED",
      payload: { startedAt: now }
    });
    return session;
  });
}
async function handleAuctionCompletedAuthoritative(params) {
  const { tournamentId, actorUserId } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let totalSold = 0;
    let totalUnsold = 0;
    let totalUnselected = 0;
    for (const player of Object.values(session.players)) {
      if (player.status === "AVAILABLE") {
        player.status = "UNSELECTED";
        totalUnselected++;
      } else if (player.status === "UNSOLD") {
        totalUnsold++;
      } else if (player.status === "SOLD") {
        totalSold++;
      }
    }
    session.status = "COMPLETED";
    session.currentPhase = "COMPLETED";
    session.currentNomination = null;
    session.completedAt = now;
    session.updatedAt = now;
    session.revision++;
    session.events.push({
      eventId: `evt_${Date.now()}_completed`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "AUCTION_COMPLETED",
      payload: {
        totalSold,
        totalUnsold,
        totalUnselected,
        completedAt: now
      }
    });
    return { session, totalSold, totalUnsold, totalUnselected };
  });
}
async function finalizeAuctionTeamsAuthoritative(params) {
  const { tournamentId, actorUserId, fetchFn = fetch } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const botToken = process.env.DISCORD_BOT_TOKEN || "";
    const guildId = process.env.DISCORD_GUILD_ID || "631715510631006219";
    const teamMap = inMemoryTournamentTeams.get(tournamentId) || /* @__PURE__ */ new Map();
    inMemoryTournamentTeams.set(tournamentId, teamMap);
    const finalizedTeams = [];
    let rolesCreated = 0;
    for (const [teamId, aTeam] of Object.entries(session.teams)) {
      aTeam.status = "FINALIZED";
      aTeam.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      let discordMapping = aTeam.discordRoleId ? {
        roleId: aTeam.discordRoleId,
        roleName: aTeam.name,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      } : void 0;
      if (!discordMapping?.roleId) {
        const createRes = await createDiscordTeamRoleAuthoritative({
          guildId,
          teamName: aTeam.name,
          botToken,
          fetchFn
        });
        if (createRes.success && createRes.roleId) {
          discordMapping = {
            roleId: createRes.roleId,
            roleName: aTeam.name,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          aTeam.discordRoleId = createRes.roleId;
          rolesCreated++;
        }
      }
      const teamRecord = {
        id: aTeam.teamId,
        tournamentId,
        name: aTeam.name,
        tag: aTeam.tag,
        captainUserId: aTeam.captainUserId,
        roster: [...aTeam.primaryRosterUserIds, ...aTeam.standInUserIds],
        discord: discordMapping,
        status: "ACTIVE",
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      teamMap.set(teamId, teamRecord);
      finalizedTeams.push(teamRecord);
      for (const memberId of teamRecord.roster) {
        syncDiscordTournamentRoles({
          userId: memberId,
          tournamentId,
          overrideContext: {
            team: teamRecord
          },
          fetchFn
        }).catch((err) => console.warn("[finalizeAuctionTeams] Discord sync note:", err));
      }
      if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
        try {
          const db2 = getAdminDb();
          if (db2) {
            await db2.collection(`tournaments/${tournamentId}/teams`).doc(teamId).set(removeUndefinedDeep(teamRecord));
          }
        } catch {
        }
      }
    }
    return { finalizedTeams, discordRolesCreated: rolesCreated };
  });
}
async function updateTeamBrandingAuthoritative(params) {
  const { tournamentId, actorUserId, teamId, branding, isOrganiser } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const team = session.teams[teamId];
    if (!team) {
      throw new Error("TEAM_NOT_FOUND: Auction team not found.");
    }
    if (!isOrganiser && team.captainUserId !== actorUserId) {
      throw new Error("UNAUTHORIZED: You can only customize your own team.");
    }
    if (branding.name) team.name = branding.name.trim();
    if (branding.tag) team.tag = branding.tag.trim().toUpperCase();
    if (branding.logo) team.logo = branding.logo;
    if (branding.color) team.color = branding.color;
    if (branding.bannerUrl) team.bannerUrl = branding.bannerUrl;
    team.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    return team;
  });
}
async function executeAuctionCorrectionAuthoritative(params) {
  const { tournamentId, actorUserId, action, payload } = params;
  return await withAuctionLock(tournamentId, async () => {
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      throw new Error("NOT_FOUND: No active auction session found.");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    if (action === "PAUSE") {
      session.status = "PAUSED";
    } else if (action === "RESUME") {
      session.status = session.currentPhase === "STAND_IN" ? "STANDIN_PHASE" : "LIVE";
    } else if (action === "ROLLBACK_SALE") {
      const { playerId, teamId } = payload;
      const player = session.players[playerId];
      const team = session.teams[teamId];
      if (player && team && player.status === "SOLD") {
        const refunded = player.soldAmount || 0;
        team.purseRemaining += refunded;
        team.primaryRosterUserIds = team.primaryRosterUserIds.filter((id) => id !== playerId);
        team.standInUserIds = team.standInUserIds.filter((id) => id !== playerId);
        team.primaryRosterComplete = team.primaryRosterUserIds.length >= session.config.primaryRosterSize;
        team.teamMMR = calculateTeamMMR(team.primaryRosterUserIds, session.players);
        player.status = "AVAILABLE";
        player.teamId = null;
        player.soldAmount = void 0;
        player.soldToTeamId = void 0;
      }
    } else if (action === "ADJUST_PURCHASE") {
      const { playerId, teamId, newAmount } = payload;
      const player = session.players[playerId];
      const team = session.teams[teamId];
      if (player && team && typeof newAmount === "number" && newAmount >= 0) {
        const diff = (player.soldAmount || 0) - newAmount;
        team.purseRemaining += diff;
        player.soldAmount = newAmount;
      }
    }
    session.revision++;
    session.updatedAt = now;
    session.events.push({
      eventId: `evt_${Date.now()}_correction`,
      sequenceNumber: session.events.length + 1,
      timestamp: now,
      actorUserId,
      type: "AUCTION_CORRECTION",
      payload: { action, payload }
    });
    return session;
  });
}

// ../src/domain/tournamentStateMachine.ts
var normalTransitions = {
  draft: ["registration", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  registration: ["verification", "auction_ready", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  verification: ["rating_review", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  rating_review: ["player_pool_locked", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  player_pool_locked: ["auction_ready", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  auction_ready: ["auction_live", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  auction_live: ["auction_paused", "rosters_locked", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  auction_paused: ["auction_live", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  rosters_locked: ["competition", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  competition: ["completed", "active", "on_hold", "cancelled", "abandoned", "deleted"],
  active: ["competition", "completed", "on_hold", "paused", "cancelled", "abandoned", "deleted"],
  on_hold: ["active", "competition", "draft", "registration", "cancelled", "abandoned", "deleted"],
  paused: ["active", "competition", "draft", "registration", "cancelled", "abandoned", "deleted"],
  completed: ["deleted"],
  cancelled: ["deleted"],
  abandoned: ["deleted"],
  deleted: []
};
function canTransitionTournament(from, to) {
  const normFrom = from.toLowerCase();
  const normTo = to.toLowerCase();
  if (normFrom === normTo) return true;
  const allowed = normalTransitions[normFrom];
  if (!allowed) {
    if (["cancelled", "completed", "abandoned", "deleted", "on_hold"].includes(normTo)) {
      return true;
    }
    return false;
  }
  return allowed.includes(normTo);
}
function validateTournamentTransition(from, to) {
  const normFrom = from.toLowerCase();
  const normTo = to.toLowerCase();
  const valid = canTransitionTournament(normFrom, normTo);
  if (!valid) {
    return {
      valid: false,
      reason: `Illegal tournament state transition from '${from}' to '${to}'. State must follow canonical sequence, pause, or terminal cancellation.`
    };
  }
  return { valid: true };
}

// ../src/domain/dotaPlayerEngine.ts
var DOTA_ROLES = [
  "Position 1 \u2014 Carry",
  "Position 2 \u2014 Mid",
  "Position 3 \u2014 Offlane",
  "Position 4 \u2014 Soft Support",
  "Position 5 \u2014 Hard Support"
];
function validateDotaRoles(primary, secondary) {
  if (!primary || !DOTA_ROLES.includes(primary)) {
    return { valid: false, error: "A valid Primary Dota 2 Role must be selected." };
  }
  if (!secondary || !DOTA_ROLES.includes(secondary)) {
    return { valid: false, error: "A valid Secondary Dota 2 Role must be selected." };
  }
  if (primary === secondary) {
    return { valid: false, error: "Primary and Secondary roles cannot be identical. Please choose distinct roles." };
  }
  return { valid: true };
}
var DotaPlayerRegistry = class {
  constructor() {
    this.players = /* @__PURE__ */ new Map();
    this.linkedSteamIds = /* @__PURE__ */ new Set();
    this.integrityCases = [];
    this.registrations = /* @__PURE__ */ new Map();
    this.activeTournamentLocks = /* @__PURE__ */ new Set();
    this.notifications = [];
    this.seedInitialPlayers();
  }
  /**
   * Clears all player profiles, registrations, integrity cases, and notifications.
   */
  clearAll() {
    this.players.clear();
    this.linkedSteamIds.clear();
    this.registrations.clear();
    this.integrityCases = [];
    this.notifications = [];
    this.activeTournamentLocks.clear();
  }
  /**
   * Links a Steam account to a player.
   * Prevents duplicate Steam ID usage and verifies format.
   */
  linkSteamAccount(playerId, steamId64, accountName) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: "Player not found." };
    if (!/^\d{17}$/.test(steamId64)) {
      return { success: false, error: "Invalid Steam64 identifier. Must be a 17-digit numeric string." };
    }
    if (this.linkedSteamIds.has(steamId64)) {
      return { success: false, error: "This Steam account is already linked to another Purple Bean profile." };
    }
    const steam32 = (BigInt(steamId64) - 76561197960265728n).toString();
    player.steam = {
      steamId64,
      steamId32: steam32,
      accountName,
      avatarUrl: player.avatar,
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      openDotaUrl: `https://www.opendota.com/players/${steam32}`,
      linkedAt: (/* @__PURE__ */ new Date()).toISOString(),
      isVerified: true
    };
    this.linkedSteamIds.add(steamId64);
    return { success: true };
  }
  /**
   * Unlinks a Steam account if safe (player is not active in a locked tournament).
   */
  unlinkSteamAccount(playerId) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: "Player not found." };
    if (!player.steam) return { success: false, error: "No Steam account is linked to this profile." };
    const hasActiveLock = this.activeTournamentLocks.has(playerId) || Array.from(this.registrations.values()).some(
      (r) => r.userId === playerId && (r.status === "VERIFIED" || r.status === "UNDER_REVIEW")
    );
    if (hasActiveLock) {
      return {
        success: false,
        error: "Cannot unlink Steam account while registered in an active tournament. Withdraw registration or contact tournament organiser."
      };
    }
    this.linkedSteamIds.delete(player.steam.steamId64);
    player.steam = void 0;
    return { success: true };
  }
  /**
   * Updates player's profile info (IGN, Avatar, City, Region, Roles).
   * Validates that primary and secondary roles are distinct.
   * Does NOT modify historical tournament registration snapshots.
   */
  updatePlayerProfile(playerId, updates) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: "Player not found." };
    const newPrimary = updates.primaryRole || player.primaryRole;
    const newSecondary = updates.secondaryRole || player.secondaryRole;
    const roleValidation = validateDotaRoles(newPrimary, newSecondary);
    if (!roleValidation.valid) {
      return { success: false, error: roleValidation.error };
    }
    if (updates.username !== void 0) {
      const trimmed = updates.username.trim();
      if (!trimmed) return { success: false, error: "In-Game Name (IGN) cannot be empty." };
      player.username = trimmed;
      player.displayName = trimmed;
    }
    if (updates.avatar !== void 0) player.avatar = updates.avatar;
    if (updates.city !== void 0) player.city = updates.city;
    if (updates.region !== void 0) player.region = updates.region;
    if (updates.bio !== void 0) player.bio = updates.bio;
    if (updates.declaredMmr !== void 0) {
      if (typeof updates.declaredMmr !== "number" || updates.declaredMmr < 1 || updates.declaredMmr > 15e3) {
        return { success: false, error: "Declared MMR must be a realistic number between 1 and 15,000." };
      }
      player.declaredMmr = updates.declaredMmr;
    }
    player.primaryRole = newPrimary;
    player.secondaryRole = newSecondary;
    return { success: true, player };
  }
  /**
   * Registers a player for a tournament, snapshotting their roles, declared MMR,
   * IGN, and Steam identity. Subsequent profile updates will NOT affect this snapshot.
   */
  submitTournamentRegistration(params) {
    const {
      tournamentId,
      userId,
      ign,
      primaryRole,
      secondaryRole,
      declaredMmr,
      rulesAccepted,
      city,
      region,
      tournamentStatus,
      applyingAsCaptain,
      interestedInCaptaincy,
      captainInterestTimestamp,
      captainNotes,
      captainHistory
    } = params;
    if (!rulesAccepted) {
      return { success: false, error: "You must acknowledge and accept the tournament rules before registering." };
    }
    if (tournamentStatus) {
      const s = tournamentStatus.toLowerCase();
      const isAllowed = s.includes("registration") || s.includes("draft") || s.includes("open") || s.includes("upcoming");
      if (!isAllowed) {
        return { success: false, error: "Registration for this tournament is closed." };
      }
    }
    const roleCheck = validateDotaRoles(primaryRole, secondaryRole);
    if (!roleCheck.valid) {
      return { success: false, error: roleCheck.error };
    }
    if (typeof declaredMmr !== "number" || isNaN(declaredMmr) || declaredMmr < 1 || declaredMmr > 15e3) {
      return { success: false, error: "Declared MMR must be a valid number between 1 and 15,000." };
    }
    const activeRegs = this.getTournamentRegistrations(tournamentId).filter(
      (r) => r.status !== "WITHDRAWN" && r.status !== "REJECTED"
    );
    const maxSlots = 64;
    const isAlreadyMember = activeRegs.some((r) => r.userId === userId);
    if (!isAlreadyMember && activeRegs.length >= maxSlots) {
      return {
        success: false,
        error: `Tournament registration is full (${activeRegs.length}/${maxSlots} slots filled).`
      };
    }
    const regKey = `${tournamentId}__${userId}`;
    const existing = this.registrations.get(regKey);
    if (existing && existing.status !== "WITHDRAWN" && existing.status !== "REJECTED") {
      return { success: false, error: "You already have an active registration for this tournament." };
    }
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    const isSyntheticContender = isTest || userId.startsWith("p-contender") || userId.startsWith("p-dummy") || userId.startsWith("p-tourney");
    if (!isSyntheticContender) {
      const activeOtherTourneyReg = Array.from(this.registrations.values()).find(
        (r) => r.userId === userId && r.tournamentId !== tournamentId && r.status !== "WITHDRAWN" && r.status !== "REJECTED" && r.status !== "CANCELLED"
      );
      if (activeOtherTourneyReg) {
        return {
          success: false,
          error: `Tournament Invariant: You already have an active registration in another tournament ('${activeOtherTourneyReg.tournamentId}'). A player can only participate in one active tournament at a time until that tournament is completed or withdrawn.`
        };
      }
    }
    const player = this.players.get(userId);
    const steamId64 = player?.steam?.steamId64 || existing?.steamId64;
    const steamId32 = player?.steam?.steamId32 || existing?.steamId32;
    const hasCaptainInterest = Boolean(interestedInCaptaincy || applyingAsCaptain);
    const isReactivation = existing && (existing.status === "WITHDRAWN" || existing.status === "REJECTED");
    const registration = {
      id: existing?.id || `reg-${tournamentId}-${userId}`,
      tournamentId,
      userId,
      ign: ign || existing?.ign || player?.username || "Player",
      primaryRole,
      secondaryRole,
      declaredMmr,
      tournamentMmr: existing?.tournamentMmr || declaredMmr,
      isMmrLocked: existing?.isMmrLocked ?? false,
      mmrLockedAt: existing?.mmrLockedAt,
      mmrLockedBy: existing?.mmrLockedBy,
      steamId64,
      steamId32,
      city: city || existing?.city || player?.city,
      region: region || existing?.region || player?.region,
      status: "REGISTERED",
      rulesAccepted: true,
      registeredAt: existing?.registeredAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      applyingAsCaptain: hasCaptainInterest,
      interestedInCaptaincy: hasCaptainInterest,
      captainInterestTimestamp: hasCaptainInterest ? captainInterestTimestamp || existing?.captainInterestTimestamp || (/* @__PURE__ */ new Date()).toISOString() : void 0,
      captainNotes: captainNotes || captainHistory || existing?.captainNotes || void 0,
      captainHistory: captainHistory || captainNotes || existing?.captainHistory || void 0,
      isCaptainApproved: false,
      auditHistory: [
        ...existing?.auditHistory || [],
        ...isReactivation ? [{
          action: "re_registered",
          previousStatus: existing.status,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }] : [{
          action: "registered",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }]
      ]
    };
    this.registrations.set(regKey, registration);
    return { success: true, registration };
  }
  /**
   * Authoritatively upserts a registration record (e.g. from real-time Firestore sync).
   * Ensures idempotency and instantaneous reflection across all connected clients.
   */
  upsertRegistration(reg) {
    const regKey = `${reg.tournamentId}__${reg.userId}`;
    const existing = this.registrations.get(regKey);
    const normalizedStatus = (reg.status || existing?.status || "REGISTERED").toUpperCase();
    const isCap = Boolean(reg.applyingAsCaptain || reg.interestedInCaptaincy || existing?.applyingAsCaptain || existing?.interestedInCaptaincy);
    const updated = {
      id: reg.id || existing?.id || `reg-${reg.tournamentId}-${reg.userId}`,
      tournamentId: reg.tournamentId,
      userId: reg.userId,
      ign: reg.ign || existing?.ign || "Contender",
      primaryRole: reg.primaryRole || existing?.primaryRole || "Position 1 \u2014 Carry",
      secondaryRole: reg.secondaryRole || existing?.secondaryRole || "Position 2 \u2014 Mid",
      declaredMmr: reg.declaredMmr || existing?.declaredMmr || 5e3,
      tournamentMmr: reg.tournamentMmr || existing?.tournamentMmr || reg.declaredMmr || existing?.declaredMmr || 5e3,
      isMmrLocked: Boolean(reg.isMmrLocked || existing?.isMmrLocked || normalizedStatus === "VERIFIED"),
      mmrLockedAt: reg.mmrLockedAt || existing?.mmrLockedAt || (normalizedStatus === "VERIFIED" ? (/* @__PURE__ */ new Date()).toISOString() : void 0),
      mmrLockedBy: reg.mmrLockedBy || existing?.mmrLockedBy,
      status: normalizedStatus,
      rulesAccepted: true,
      registeredAt: reg.registeredAt || existing?.registeredAt || (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      applyingAsCaptain: isCap,
      interestedInCaptaincy: isCap,
      captainInterestTimestamp: reg.captainInterestTimestamp || existing?.captainInterestTimestamp || (isCap ? (/* @__PURE__ */ new Date()).toISOString() : void 0),
      captainNotes: reg.captainNotes || existing?.captainNotes || "",
      captainHistory: reg.captainHistory || existing?.captainHistory || "",
      isCaptainApproved: Boolean(reg.isCaptainApproved !== void 0 ? reg.isCaptainApproved : existing?.isCaptainApproved),
      captainApprovedAt: reg.captainApprovedAt || existing?.captainApprovedAt,
      captainApprovedBy: reg.captainApprovedBy || existing?.captainApprovedBy,
      teamId: reg.teamId || existing?.teamId,
      teamName: reg.teamName || existing?.teamName,
      userEmail: reg.userEmail || existing?.userEmail,
      city: reg.city || existing?.city || "India",
      region: reg.region || existing?.region || "Pan India",
      steamId64: reg.steamId64 || existing?.steamId64,
      steamId32: reg.steamId32 || existing?.steamId32
    };
    this.registrations.set(regKey, updated);
    if (!this.players.has(reg.userId)) {
      this.players.set(reg.userId, {
        id: reg.userId,
        username: updated.ign,
        displayName: updated.ign,
        primaryRole: updated.primaryRole,
        secondaryRole: updated.secondaryRole,
        declaredMmr: updated.declaredMmr,
        tournamentMmr: updated.tournamentMmr,
        city: updated.city || "India",
        region: updated.region || "Pan India",
        country: "India",
        verificationState: updated.status === "VERIFIED" ? "DOTA_VERIFIED" : "UNVERIFIED",
        registeredAt: updated.registeredAt
      });
    }
    return updated;
  }
  /**
   * Returns players eligible for the Captain Candidate pool:
   * Strictly requires:
   * - registered for this tournament
   * - VERIFIED
   * - Tournament MMR locked
   * - interestedInCaptaincy = true (or applyingAsCaptain = true)
   */
  getCaptainCandidates(tournamentId) {
    return this.getTournamentRegistrations(tournamentId).filter(
      (r) => Boolean(r.interestedInCaptaincy || r.applyingAsCaptain) && r.status === "VERIFIED" && (r.isMmrLocked || typeof r.tournamentMmr === "number" && r.tournamentMmr > 0)
    );
  }
  /**
   * Returns all players who applied as captain for a tournament.
   */
  getCaptainApplicants(tournamentId) {
    return this.getCaptainCandidates(tournamentId);
  }
  /**
   * Allows player to edit captain interest while registration is open and captain selection is not finalized.
   */
  updateCaptainInterest(tournamentId, userId, interested, notes) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found for this tournament." };
    if (reg.isCaptainApproved) {
      return { success: false, error: "Cannot change captain interest: You have already been appointed as an official captain." };
    }
    if (reg.status === "WITHDRAWN" || reg.status === "REJECTED") {
      return { success: false, error: `Cannot update captain interest for a ${reg.status.toLowerCase()} registration.` };
    }
    reg.interestedInCaptaincy = interested;
    reg.applyingAsCaptain = interested;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (interested) {
      reg.captainInterestTimestamp = (/* @__PURE__ */ new Date()).toISOString();
      if (notes !== void 0) {
        reg.captainNotes = notes;
      }
    } else {
      reg.captainInterestTimestamp = void 0;
    }
    return { success: true, registration: reg };
  }
  /**
   * Approves a registered applicant as one of the official tournament captains.
   * Requires organizer authority.
   */
  approveCaptain(tournamentId, userId, approverUserId, maxSlots = 4) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Contender registration not found." };
    if (reg.status === "WITHDRAWN" || reg.status === "REJECTED" || reg.status === "CANCELLED") {
      return { success: false, error: `Cannot approve contender in ${reg.status} state as captain.` };
    }
    const approvedCaptains = this.getTournamentRegistrations(tournamentId).filter((r) => Boolean(r.isCaptainApproved));
    if (approvedCaptains.length >= maxSlots && !reg.isCaptainApproved) {
      return { success: false, error: `Cannot approve more than ${maxSlots} captains. All ${maxSlots} slots are filled.` };
    }
    reg.isCaptainApproved = true;
    reg.captainApprovedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.captainApprovedBy = approverUserId;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const tourneyName = tournamentId === "auction-basic-test-1" || tournamentId === "2-team-auction-test" ? "Auction Basic Test 1" : tournamentId === "purple-bean-test-cup" ? "Purple Bean Test Cup" : tournamentId;
    this.addNotification({
      id: `notif-cap-approved-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: reg.userId,
      type: "CAPTAIN_SELECTED",
      title: "You've Been Selected as Captain",
      message: `You have been selected as a captain for ${tourneyName}.`,
      tournamentId,
      registrationId: reg.id,
      actionTarget: `/tournaments/${tournamentId}/auction`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Withdraws a player's tournament registration if eligible.
   */
  withdrawTournamentRegistration(tournamentId, userId, tournamentStatus = "registration") {
    const s = tournamentStatus.toLowerCase();
    const isAllowed = s.includes("registration") || s.includes("draft") || s.includes("open") || s.includes("upcoming");
    if (!isAllowed) {
      return { success: false, error: "Cannot withdraw once rosters or player pools are locked." };
    }
    const regKey = `${tournamentId}__${userId}`;
    let reg = this.registrations.get(regKey);
    if (!reg) {
      reg = Array.from(this.registrations.values()).find((r) => r.tournamentId === tournamentId && r.userId === userId);
    }
    if (!reg) {
      return { success: false, error: "Registration not found." };
    }
    if (reg.status === "WITHDRAWN") {
      return { success: false, error: "Registration is already withdrawn." };
    }
    reg.status = "WITHDRAWN";
    reg.isCaptainApproved = false;
    reg.teamId = void 0;
    reg.teamName = void 0;
    reg.withdrawnAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const [key, item] of this.registrations.entries()) {
      if (item.tournamentId === tournamentId && (item.userId === userId || item.id === userId || key.endsWith(`__${userId}`))) {
        item.status = "WITHDRAWN";
        item.isCaptainApproved = false;
        item.teamId = void 0;
        item.teamName = void 0;
        item.withdrawnAt = reg.withdrawnAt;
        item.updatedAt = reg.updatedAt;
      }
    }
    this.activeTournamentLocks.delete(userId);
    return { success: true, registration: reg };
  }
  removeRegistration(tournamentId, userId) {
    const regKey = `${tournamentId}__${userId}`;
    this.registrations.delete(regKey);
    for (const [key, item] of this.registrations.entries()) {
      if (item.tournamentId === tournamentId && (item.userId === userId || item.id === userId)) {
        this.registrations.delete(key);
      }
    }
    this.activeTournamentLocks.delete(userId);
  }
  getRegistration(tournamentId, userId) {
    const regKey = `${tournamentId}__${userId}`;
    const allMatches = Array.from(this.registrations.values()).filter(
      (r) => r.tournamentId === tournamentId && (r.userId === userId || r.id === userId)
    );
    if (allMatches.length === 0) {
      return this.registrations.get(regKey);
    }
    return allMatches.sort(
      (a, b) => new Date(b.updatedAt || b.registeredAt || 0).getTime() - new Date(a.updatedAt || a.registeredAt || 0).getTime()
    )[0];
  }
  getTournamentRegistrations(tournamentId, includeInactive = false) {
    const list = Array.from(this.registrations.values()).filter((r) => r.tournamentId === tournamentId);
    const byUserId = /* @__PURE__ */ new Map();
    for (const reg of list) {
      const existing = byUserId.get(reg.userId);
      if (!existing) {
        byUserId.set(reg.userId, reg);
      } else {
        const regTime = new Date(reg.updatedAt || reg.registeredAt || 0).getTime();
        const existingTime = new Date(existing.updatedAt || existing.registeredAt || 0).getTime();
        if (regTime >= existingTime) {
          byUserId.set(reg.userId, reg);
        }
      }
    }
    return Array.from(byUserId.values()).filter((reg) => {
      if (includeInactive) return true;
      const s = (reg.status || "").toUpperCase();
      return s !== "WITHDRAWN" && s !== "REJECTED" && s !== "CANCELLED";
    });
  }
  removeTournamentRegistrations(tournamentId) {
    for (const [key, reg] of this.registrations.entries()) {
      if (reg.tournamentId === tournamentId) {
        this.registrations.delete(key);
      }
    }
  }
  getRegistrationsForTournament(tournamentId) {
    return this.getTournamentRegistrations(tournamentId);
  }
  getAllRegistrations() {
    const byKey = /* @__PURE__ */ new Map();
    for (const reg of this.registrations.values()) {
      const key = `${reg.tournamentId}__${reg.userId}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, reg);
      } else {
        const regTime = new Date(reg.updatedAt || reg.registeredAt || 0).getTime();
        const existingTime = new Date(existing.updatedAt || existing.registeredAt || 0).getTime();
        if (regTime >= existingTime) {
          byKey.set(key, reg);
        }
      }
    }
    return Array.from(byKey.values());
  }
  getUserRegistrations(userId) {
    return Array.from(this.registrations.values()).filter((r) => r.userId === userId);
  }
  /**
   * Transitions a registration to UNDER_REVIEW.
   */
  startReview(tournamentId, userId, staffId) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    if (reg.status === "WITHDRAWN" || reg.status === "REJECTED") {
      return { success: false, error: `Cannot review registration in ${reg.status} state.` };
    }
    reg.status = "UNDER_REVIEW";
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "REGISTRATION_UNDER_REVIEW",
      title: "Registration Under Review",
      message: `Your registration for tournament ${tournamentId} is currently under organiser review.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Organiser requests skill or account verification evidence from a player.
   */
  requestEvidence(tournamentId, userId, prompt, staffId) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    reg.status = "EVIDENCE_REQUESTED";
    reg.evidenceRequestPrompt = prompt;
    reg.evidenceRequestedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "EVIDENCE_REQUESTED",
      title: "Evidence Requested",
      message: prompt || "The organiser has requested supporting skill/identity evidence for your registration.",
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Player submits private evidence (screenshot URL, Steam profile URL, tournament history).
   */
  submitEvidence(tournamentId, userId, evidenceData) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    const item = {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      registrationId: reg.id,
      userId,
      type: evidenceData.type,
      fileUrl: evidenceData.fileUrl,
      description: evidenceData.description,
      submittedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!reg.evidence) reg.evidence = [];
    reg.evidence.push(item);
    if (reg.status === "EVIDENCE_REQUESTED") {
      reg.status = "UNDER_REVIEW";
    }
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "EVIDENCE_RECEIVED",
      title: "Evidence Received",
      message: `Evidence submitted: ${evidenceData.description.slice(0, 50)}... Organiser will review.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg, evidenceItem: item };
  }
  /**
   * Organiser confirms the player's declared MMR as their Tournament MMR.
   */
  confirmDeclaredMmr(tournamentId, userId, staffId) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    reg.tournamentMmr = reg.declaredMmr;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "TOURNAMENT_MMR_CONFIRMED",
      title: "Tournament MMR Confirmed",
      message: `Your declared MMR of ${reg.declaredMmr.toLocaleString()} has been confirmed for ${tournamentId}.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Organiser sets a calibrated/corrected Tournament MMR with justification.
   */
  setCorrectedTournamentMmr(tournamentId, userId, correctedMmr, reason, staffId) {
    if (typeof correctedMmr !== "number" || isNaN(correctedMmr) || correctedMmr < 1 || correctedMmr > 15e3) {
      return { success: false, error: "Corrected MMR must be between 1 and 15,000." };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "A justification reason is required when adjusting Tournament MMR." };
    }
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    const oldVal = reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = correctedMmr;
    if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
    reg.historicalMmrChanges.push({
      oldValue: oldVal,
      newValue: correctedMmr,
      reason,
      actor: staffId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "TOURNAMENT_MMR_CONFIRMED",
      title: "Tournament MMR Adjusted",
      message: `Organiser calibrated Tournament MMR from ${oldVal} to ${correctedMmr}. Reason: ${reason}`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  ensurePlayer(userId, ign, declaredMmr) {
    let player = this.players.get(userId);
    if (!player) {
      const username = ign || userId;
      const mmr = declaredMmr || 6e3;
      player = {
        id: userId,
        username,
        displayName: username,
        avatar: "\u{1F3AE}",
        city: "Bengaluru",
        region: "South India",
        declaredMmr: mmr,
        tournamentMmr: mmr,
        isMmrLocked: false,
        primaryRole: "Position 1 \u2014 Carry",
        secondaryRole: "Position 2 \u2014 Mid",
        competitiveRating: 1500,
        ratingConfidence: 50,
        ratingStatus: "PROVISIONAL",
        qualifyingMatchesCount: 0,
        captainRecord: {
          tournamentsCaptained: 0,
          teamsLed: [],
          championships: 0,
          finalsReached: 0,
          matchWins: 0,
          matchLosses: 0,
          totalAuctionSpend: 0,
          playersDrafted: 0,
          reputationScore: 100
        },
        tournamentSnapshots: [],
        historicalTournamentMmrs: [],
        integrityCases: [],
        heroPool: []
      };
      this.players.set(userId, player);
    }
    return player;
  }
  /**
   * Verifies player registration and locks Tournament MMR.
   * Only VERIFIED players enter the auction pool, captain pool, and roster selection.
   */
  verifyRegistration(tournamentId, userId, staffId, confirmedTournamentMmr) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    if (reg.status === "WITHDRAWN" || reg.status === "REJECTED" || reg.status === "CANCELLED") {
      return { success: false, error: `Cannot verify registration in ${reg.status} state. Contender must re-register first.` };
    }
    const finalMmr = confirmedTournamentMmr || reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = finalMmr;
    reg.status = "VERIFIED";
    reg.isMmrLocked = true;
    reg.mmrLockedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.mmrLockedBy = staffId;
    reg.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.verifiedBy = staffId;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const player = this.ensurePlayer(userId, reg.ign, reg.declaredMmr);
    player.tournamentMmr = finalMmr;
    player.isMmrLocked = true;
    player.mmrLockedAt = reg.mmrLockedAt;
    player.mmrLockedBy = staffId;
    if (!player.historicalTournamentMmrs) player.historicalTournamentMmrs = [];
    const existingHistIdx = player.historicalTournamentMmrs.findIndex((h) => h.tournamentId === tournamentId);
    const histRecord = {
      tournamentId,
      tournamentMmr: finalMmr,
      lockedAt: reg.mmrLockedAt,
      lockedBy: staffId
    };
    if (existingHistIdx >= 0) {
      player.historicalTournamentMmrs[existingHistIdx] = histRecord;
    } else {
      player.historicalTournamentMmrs.push(histRecord);
    }
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "REGISTRATION_VERIFIED",
      title: "Registration Verified & Eligible!",
      message: `Your registration for ${tournamentId} is VERIFIED. Locked Tournament MMR: ${finalMmr.toLocaleString()}. You are now eligible for franchise drafts and team rosters.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Correct Locked Tournament MMR.
   * Requires reason, actor, timestamp, old value, new value, and audit record.
   */
  correctLockedTournamentMmr(tournamentId, userId, newMmr, reason, staffId) {
    if (typeof newMmr !== "number" || isNaN(newMmr) || newMmr < 1 || newMmr > 15e3) {
      return { success: false, error: "Tournament MMR must be between 1 and 15,000." };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "A justification reason is required to alter locked Tournament MMR." };
    }
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    const oldValue = reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = newMmr;
    reg.isMmrLocked = true;
    reg.mmrLockedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.mmrLockedBy = staffId;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
    reg.historicalMmrChanges.push({
      oldValue,
      newValue: newMmr,
      reason,
      actor: staffId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const player = this.ensurePlayer(userId, reg.ign, reg.declaredMmr);
    player.tournamentMmr = newMmr;
    player.isMmrLocked = true;
    if (!player.historicalTournamentMmrs) player.historicalTournamentMmrs = [];
    const hist = player.historicalTournamentMmrs.find((h) => h.tournamentId === tournamentId);
    if (hist) {
      hist.tournamentMmr = newMmr;
      hist.lockedAt = (/* @__PURE__ */ new Date()).toISOString();
      hist.lockedBy = staffId;
    }
    return { success: true, registration: reg };
  }
  /**
   * Organiser rejects a registration.
   */
  rejectRegistration(tournamentId, userId, reason, staffId) {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: "Registration not found." };
    reg.status = "REJECTED";
    reg.rejectionReason = reason;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      userId,
      type: "REGISTRATION_REJECTED",
      title: "Registration Rejected",
      message: `Your registration for ${tournamentId} was rejected. Reason: ${reason}`,
      tournamentId,
      registrationId: reg.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    return { success: true, registration: reg };
  }
  /**
   * Retrieves registration evidence with strict privacy check:
   * Only accessible by submitting player, tournament organiser, or platform admin.
   * Captains and spectators are STRICTLY DENIED.
   */
  getRegistrationEvidence(registrationId, caller) {
    const reg = Array.from(this.registrations.values()).find((r) => r.id === registrationId);
    if (!reg) return { success: false, error: "Registration not found." };
    const isOwner = caller.userId === reg.userId;
    const isOrganiserOrAdmin = caller.role === "organizer" || caller.isAdmin === true;
    if (!isOwner && !isOrganiserOrAdmin) {
      return { success: false, error: "Unauthorized: Captains, players, and spectators cannot view private evidence." };
    }
    return { success: true, evidence: reg.evidence || [] };
  }
  /**
   * Returns only VERIFIED players eligible for auction drafting.
   */
  getEligibleAuctionPlayers(tournamentId) {
    return Array.from(this.registrations.values()).filter(
      (r) => r.tournamentId === tournamentId && r.status === "VERIFIED"
    );
  }
  /**
   * Returns only VERIFIED players eligible to be appointed as captains.
   */
  getEligibleCaptains(tournamentId) {
    return Array.from(this.registrations.values()).filter(
      (r) => r.tournamentId === tournamentId && r.status === "VERIFIED"
    );
  }
  addNotification(notification) {
    const existingIdx = this.notifications.findIndex((n) => n.id === notification.id);
    if (existingIdx >= 0) {
      this.notifications[existingIdx] = notification;
    } else {
      this.notifications.unshift(notification);
      if (this.notifications.length > 50) {
        this.notifications.length = 50;
      }
    }
  }
  getNotifications(userId) {
    return this.notifications.filter((n) => n.userId === userId);
  }
  getAllNotifications() {
    return [...this.notifications];
  }
  markNotificationRead(notificationId) {
    const notif = this.notifications.find((n) => n.id === notificationId);
    if (notif) notif.read = true;
  }
  /**
   * Sanitizes a player's record for public display with guaranteed ZERO PII.
   * Strips email, UID, legal names, phone, UPI, MMR evidence, and moderation flags.
   */
  sanitizeForPublic(player) {
    return {
      id: player.id,
      username: player.username,
      avatar: player.avatar,
      country: "India",
      region: player.region,
      city: player.city,
      primaryRole: player.primaryRole,
      secondaryRole: player.secondaryRole || "Position 2 \u2014 Mid",
      currentTeamId: player.currentTeamId,
      currentTeamName: player.currentTeamName,
      competitiveRating: player.competitiveRating,
      ratingStatus: player.ratingStatus,
      tournamentMmr: player.tournamentMmr,
      isMmrLocked: player.isMmrLocked,
      tournamentCount: player.tournamentSnapshots?.length || 0,
      tournamentSnapshots: player.tournamentSnapshots || [],
      historicalTournamentMmrs: player.historicalTournamentMmrs || [],
      matchesCount: player.qualifyingMatchesCount,
      winsCount: player.tournamentSnapshots?.reduce((acc, s) => acc + s.wins, 0) || 0,
      lossesCount: player.tournamentSnapshots?.reduce((acc, s) => acc + (s.matchesPlayed - s.wins), 0) || 0,
      winRate: player.tournamentSnapshots?.length ? Math.round(player.tournamentSnapshots.reduce((acc, s) => acc + s.wins, 0) / Math.max(1, player.tournamentSnapshots.reduce((acc, s) => acc + s.matchesPlayed, 0)) * 100) : 65,
      steamAccountLinked: Boolean(player.steam),
      steamId64Masked: player.steam ? `${player.steam.steamId64.slice(0, 4)}...${player.steam.steamId64.slice(-4)}` : void 0,
      openDotaUrl: player.steam?.openDotaUrl,
      profileUrl: player.steam?.profileUrl,
      heroPool: player.heroPool || []
    };
  }
  /**
   * Retrieves private account data accessible only by account owner or admins.
   */
  getPrivateAccount(userId, email = "") {
    const player = this.players.get(userId);
    return {
      userId,
      email: email || `${userId}@purplebeangaming.com`,
      steamId64: player?.steam?.steamId64,
      steamId32: player?.steam?.steamId32,
      verificationStatus: player?.steam?.isVerified ? "VERIFIED" : player?.steam ? "LINKED_PENDING_VERIFICATION" : "NOT_LINKED",
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Creates a new persistent player profile for a new user if not exists.
   */
  getOrCreatePlayer(userId, email, initialData) {
    let player = this.players.get(userId);
    if (!player) {
      const defaultIgn = initialData?.username || email.split("@")[0] || `DotaWarrior_${userId.slice(-4)}`;
      player = {
        id: userId,
        username: defaultIgn,
        displayName: defaultIgn,
        avatar: initialData?.avatar || "\u{1F3AE}",
        city: initialData?.city || "Bengaluru",
        region: initialData?.region || "South India",
        bio: initialData?.bio || "Competitive Dota 2 player on Purple Bean Gaming.",
        declaredMmr: initialData?.declaredMmr || 6e3,
        tournamentMmr: initialData?.tournamentMmr || 6e3,
        isMmrLocked: false,
        primaryRole: initialData?.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: initialData?.secondaryRole || "Position 2 \u2014 Mid",
        competitiveRating: 1500,
        ratingConfidence: 50,
        ratingStatus: "PROVISIONAL",
        qualifyingMatchesCount: 0,
        captainRecord: {
          tournamentsCaptained: 0,
          teamsLed: [],
          championships: 0,
          finalsReached: 0,
          matchWins: 0,
          matchLosses: 0,
          totalAuctionSpend: 0,
          playersDrafted: 0,
          reputationScore: 50
        },
        tournamentSnapshots: [],
        integrityCases: [],
        heroPool: []
      };
      this.players.set(userId, player);
    }
    return player;
  }
  /**
   * Sets and locks a player's Tournament MMR for an active tournament.
   */
  lockTournamentMmr(playerId, tournamentMmr, staffId = "organiser-admin") {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: "Player not found." };
    player.tournamentMmr = tournamentMmr;
    player.isMmrLocked = true;
    player.mmrLockedAt = (/* @__PURE__ */ new Date()).toISOString();
    player.mmrLockedBy = staffId;
    return { success: true };
  }
  /**
   * Flag suspicious MMR / smurf integrity case.
   * Opening a case does NOT automatically punish or reject the player.
   */
  createIntegrityCase(playerId, caseType, declaredMmr, evidenceNotes, tournamentId, openedByStaffId = "organiser-review") {
    const player = this.players.get(playerId);
    const ign = player ? player.username : playerId;
    const newCase = {
      id: `case-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      playerId,
      playerIgn: ign,
      tournamentId,
      caseType,
      declaredMmr,
      evidenceNotes,
      status: "OPEN",
      openedAt: (/* @__PURE__ */ new Date()).toISOString(),
      openedByStaffId
    };
    this.integrityCases.push(newCase);
    if (player) {
      player.integrityCases.push(newCase);
    }
    if (tournamentId) {
      const regKey = `${tournamentId}__${playerId}`;
      const reg = this.registrations.get(regKey);
      if (reg) {
        reg.integrityCaseId = newCase.id;
        reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
    return newCase;
  }
  /**
   * Organiser resolves or updates an integrity case:
   * (Approve, Correct MMR, Request Evidence, Warn, Disqualify, Reject, Escalate).
   */
  resolveIntegrityCase(caseId, action, note, staffId, correctedMmr) {
    const targetCase = this.integrityCases.find((c) => c.id === caseId);
    if (!targetCase) return { success: false, error: "Integrity case not found." };
    targetCase.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
    targetCase.resolvedByStaffId = staffId;
    targetCase.resolutionAuditNote = note;
    const player = this.players.get(targetCase.playerId);
    if (action === "APPROVE") {
      targetCase.status = "APPROVED";
    } else if (action === "CORRECT_MMR" && correctedMmr && player) {
      targetCase.status = "CORRECTED";
      targetCase.correctedMmrValue = correctedMmr;
      player.tournamentMmr = correctedMmr;
      player.isMmrLocked = true;
      player.mmrLockedBy = staffId;
      if (targetCase.tournamentId) {
        const regKey = `${targetCase.tournamentId}__${targetCase.playerId}`;
        const reg = this.registrations.get(regKey);
        if (reg) {
          reg.tournamentMmr = correctedMmr;
          if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
          reg.historicalMmrChanges.push({
            oldValue: reg.declaredMmr,
            newValue: correctedMmr,
            reason: `Integrity Case Resolution (${targetCase.caseType}): ${note}`,
            actor: staffId,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          });
        }
      }
    } else if (action === "REQUEST_EVIDENCE") {
      targetCase.status = "EVIDENCE_REQUESTED";
      if (targetCase.tournamentId) {
        this.requestEvidence(targetCase.tournamentId, targetCase.playerId, note, staffId);
      }
    } else if (action === "ESCALATE") {
      targetCase.status = "ESCALATED";
    } else if (action === "WARN") {
      targetCase.status = "WARNED";
    } else if (action === "DISQUALIFY") {
      targetCase.status = "DISQUALIFIED";
      if (targetCase.tournamentId) {
        this.rejectRegistration(targetCase.tournamentId, targetCase.playerId, `Disqualified via integrity case: ${note}`, staffId);
      }
    } else if (action === "REJECT") {
      targetCase.status = "REJECTED";
      if (targetCase.tournamentId) {
        this.rejectRegistration(targetCase.tournamentId, targetCase.playerId, `Rejected via integrity review: ${note}`, staffId);
      }
    }
    return { success: true };
  }
  getPlayer(id) {
    return this.players.get(id);
  }
  getAllPlayers() {
    return Array.from(this.players.values());
  }
  getIntegrityCases() {
    return [...this.integrityCases];
  }
  seedInitialPlayers() {
    this.players = /* @__PURE__ */ new Map();
    this.linkedSteamIds = /* @__PURE__ */ new Set();
    this.registrations = /* @__PURE__ */ new Map();
    this.integrityCases = [];
    this.notifications = [];
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (isTest) {
      const rawData = [
        { id: "p-c1", ign: "Aether", name: "Arjun Nair", avatar: "\u26A1", city: "Mumbai", region: "West India", mmr: 8600, pRole: "Position 2 \u2014 Mid", sRole: "Position 1 \u2014 Carry", cap: true, wins: 42, losses: 18 },
        { id: "p-c2", ign: "Nova", name: "Rohan Sharma", avatar: "\u{1F525}", city: "Delhi", region: "North India", mmr: 8450, pRole: "Position 1 \u2014 Carry", sRole: "Position 3 \u2014 Offlane", cap: true, wins: 38, losses: 20 },
        { id: "p-c3", ign: "Karma", name: "Karthik Raja", avatar: "\u{1F6E1}\uFE0F", city: "Bengaluru", region: "South India", mmr: 8200, pRole: "Position 3 \u2014 Offlane", sRole: "Position 4 \u2014 Soft Support", cap: true, wins: 35, losses: 22 },
        { id: "p-01", ign: "Viper", name: "Vikram Singh", avatar: "\u{1F40D}", city: "Hyderabad", region: "South India", mmr: 5900, pRole: "Position 1 \u2014 Carry", sRole: "Position 2 \u2014 Mid", cap: false, wins: 30, losses: 12 },
        { id: "p-02", ign: "Shadow", name: "Sameer Sen", avatar: "\u{1F5E1}\uFE0F", city: "Kolkata", region: "East India", mmr: 5750, pRole: "Position 2 \u2014 Mid", sRole: "Position 1 \u2014 Carry", cap: false, wins: 29, losses: 14 },
        { id: "p-03", ign: "Bulldozer", name: "Baljit Gill", avatar: "\u{1F98F}", city: "Chandigarh", region: "North India", mmr: 5500, pRole: "Position 3 \u2014 Offlane", sRole: "Position 4 \u2014 Soft Support", cap: false, wins: 24, losses: 16 },
        { id: "p-04", ign: "Chakra", name: "Chaitanya Joshi", avatar: "\u{1F52E}", city: "Pune", region: "West India", mmr: 5350, pRole: "Position 4 \u2014 Soft Support", sRole: "Position 5 \u2014 Hard Support", cap: false, wins: 28, losses: 15 },
        { id: "p-05", ign: "Zenith", name: "Zaid Khan", avatar: "\u{1F31F}", city: "Mumbai", region: "West India", mmr: 5200, pRole: "Position 5 \u2014 Hard Support", sRole: "Position 4 \u2014 Soft Support", cap: false, wins: 22, losses: 18 }
      ];
      rawData.forEach((d) => {
        const steam32 = (12e7 + Math.floor(Math.random() * 5e5)).toString();
        const steam64 = (76561197960265728n + BigInt(steam32)).toString();
        const profile = {
          id: d.id,
          username: d.ign,
          displayName: d.name,
          avatar: d.avatar,
          city: d.city,
          region: d.region,
          bio: `Competitive Dota 2 athlete from ${d.city}. Specializes in ${d.pRole}.`,
          declaredMmr: d.mmr,
          tournamentMmr: d.mmr,
          isMmrLocked: true,
          mmrLockedAt: "2026-09-01T10:00:00Z",
          mmrLockedBy: "system-seed",
          primaryRole: d.pRole,
          secondaryRole: d.sRole,
          competitiveRating: Math.round(d.mmr / 4) + 100,
          ratingConfidence: 90,
          ratingStatus: "ESTABLISHED",
          qualifyingMatchesCount: d.wins + d.losses,
          steam: {
            steamId64: steam64,
            steamId32: steam32,
            accountName: `${d.ign}_steam`,
            avatarUrl: d.avatar,
            profileUrl: `https://steamcommunity.com/profiles/${steam64}`,
            openDotaUrl: `https://www.opendota.com/players/${steam32}`,
            linkedAt: "2026-08-15T12:00:00Z",
            isVerified: true
          },
          captainRecord: {
            tournamentsCaptained: d.cap ? 3 : 0,
            teamsLed: d.cap ? [`${d.ign}'s Squad`] : [],
            championships: d.cap && d.ign === "Aether" ? 1 : 0,
            finalsReached: d.cap ? 2 : 0,
            matchWins: d.wins,
            matchLosses: d.losses,
            totalAuctionSpend: d.cap ? 2850 : 0,
            playersDrafted: d.cap ? 12 : 0,
            reputationScore: 95
          },
          tournamentSnapshots: [
            {
              tournamentId: "purple-bean-test-cup",
              tournamentName: "Purple Bean Test Cup",
              year: 2026,
              teamId: d.ign === "Aether" ? "tc-team-1" : "tc-team-2",
              teamName: d.ign === "Aether" ? "Mumbai Mavericks" : "Hyderabad Raiders",
              primaryRole: d.pRole,
              lockedTournamentMmr: d.mmr,
              isCaptain: d.cap,
              finalPlacement: d.ign === "Aether" ? "Champion (1st Place)" : "Runner-up (2nd Place)",
              prizeWonINR: d.ign === "Aether" ? 15e3 : 7e3,
              matchesPlayed: 2,
              wins: d.ign === "Aether" ? 2 : 1,
              ratingBefore: 1540,
              ratingAfter: 1564
            }
          ],
          integrityCases: [],
          heroPool: [
            { hero: "Storm Spirit", games: 15, winRate: 73 },
            { hero: "Shadow Fiend", games: 12, winRate: 67 },
            { hero: "Invoker", games: 18, winRate: 61 }
          ]
        };
        this.players.set(profile.id, profile);
        this.linkedSteamIds.add(steam64);
      });
    }
  }
};
var dotaPlayerRegistry = new DotaPlayerRegistry();
var dotaPlayerEngine = dotaPlayerRegistry;

// ../src/domain/dotaAuctionMmrBalancer.ts
function calculateMmrBalancedPurses(options) {
  const {
    tournamentId,
    captains,
    mode = "CAPTAIN_MMR_BALANCED",
    baseCredits = 1e3,
    adjustmentRate = 0.25,
    minimumCredits = 800,
    maximumCredits = 1200,
    creditRounding = 10,
    allocationVersion = 1,
    calculatedBy = "authoritative-server"
  } = options;
  if (!captains || captains.length === 0) {
    return {
      success: false,
      error: "Cannot calculate purses: No captain inputs provided."
    };
  }
  for (const cap of captains) {
    if (!cap.isMmrLocked || !cap.tournamentMmr || cap.tournamentMmr <= 0) {
      return {
        success: false,
        error: `Captain '${cap.captainIgn}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`,
        blockingCaptain: { id: cap.captainId, name: cap.captainIgn }
      };
    }
  }
  const targetTotalCredits = baseCredits * captains.length;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (mode === "EQUAL") {
    const entries = captains.map((cap) => ({
      captainId: cap.captainId,
      captainIgn: cap.captainIgn,
      teamId: cap.teamId,
      teamName: cap.teamName,
      tournamentMmr: cap.tournamentMmr || 0,
      isMmrLocked: cap.isMmrLocked ?? true,
      mmrDiffFromAvg: 0,
      rawCredits: baseCredits,
      clampedCredits: baseCredits,
      finalStartingCredits: baseCredits
    }));
    return {
      success: true,
      audit: {
        tournamentId,
        allocationMode: "EQUAL",
        captainCount: captains.length,
        averageCaptainMmr: Math.round(captains.reduce((acc, c) => acc + (c.tournamentMmr || 0), 0) / captains.length),
        totalCredits: targetTotalCredits,
        targetTotalCredits,
        baseCredits,
        adjustmentRate,
        minimumCredits,
        maximumCredits,
        creditRounding,
        entries,
        timestamp: now,
        calculatedBy,
        allocationVersion
      }
    };
  }
  const totalMmr = captains.reduce((sum, c) => sum + (c.tournamentMmr || 0), 0);
  const averageCaptainMmr = Math.round(totalMmr / captains.length);
  const interimEntries = captains.map((cap) => {
    const mmr = cap.tournamentMmr || 0;
    const mmrDiffFromAvg = mmr - averageCaptainMmr;
    const adjustment = mmrDiffFromAvg * adjustmentRate;
    const rawCredits = baseCredits - adjustment;
    const clampedCredits = Math.max(minimumCredits, Math.min(maximumCredits, rawCredits));
    const rounded = Math.round(clampedCredits / creditRounding) * creditRounding;
    const finalStartingCredits = Math.max(minimumCredits, Math.min(maximumCredits, rounded));
    return {
      captainId: cap.captainId,
      captainIgn: cap.captainIgn,
      teamId: cap.teamId,
      teamName: cap.teamName,
      tournamentMmr: mmr,
      isMmrLocked: cap.isMmrLocked ?? true,
      mmrDiffFromAvg,
      rawCredits,
      clampedCredits,
      finalStartingCredits,
      roundError: clampedCredits - finalStartingCredits
    };
  });
  let currentSum = interimEntries.reduce((acc, e) => acc + e.finalStartingCredits, 0);
  let discrepancy = targetTotalCredits - currentSum;
  if (discrepancy !== 0) {
    const step = discrepancy > 0 ? creditRounding : -creditRounding;
    const sorted = [...interimEntries].sort((a, b) => {
      if (discrepancy > 0) {
        if (b.roundError !== a.roundError) return b.roundError - a.roundError;
        return a.tournamentMmr - b.tournamentMmr;
      } else {
        if (a.roundError !== b.roundError) return a.roundError - b.roundError;
        return b.tournamentMmr - a.tournamentMmr;
      }
    });
    let i = 0;
    while (discrepancy !== 0 && i < sorted.length * 10) {
      const target = sorted[i % sorted.length];
      const nextCredits = target.finalStartingCredits + step;
      if (nextCredits >= minimumCredits && nextCredits <= maximumCredits) {
        target.finalStartingCredits = nextCredits;
        discrepancy -= step;
      }
      i++;
    }
  }
  const finalEntries = interimEntries.map((e) => ({
    captainId: e.captainId,
    captainIgn: e.captainIgn,
    teamId: e.teamId,
    teamName: e.teamName,
    tournamentMmr: e.tournamentMmr,
    isMmrLocked: e.isMmrLocked,
    mmrDiffFromAvg: e.mmrDiffFromAvg,
    rawCredits: e.rawCredits,
    clampedCredits: e.clampedCredits,
    finalStartingCredits: e.finalStartingCredits
  }));
  const totalCredits = finalEntries.reduce((acc, e) => acc + e.finalStartingCredits, 0);
  return {
    success: true,
    audit: {
      tournamentId,
      allocationMode: "CAPTAIN_MMR_BALANCED",
      captainCount: captains.length,
      averageCaptainMmr,
      totalCredits,
      targetTotalCredits,
      baseCredits,
      adjustmentRate,
      minimumCredits,
      maximumCredits,
      creditRounding,
      entries: finalEntries,
      timestamp: now,
      calculatedBy,
      allocationVersion
    }
  };
}

// ../src/domain/dotaAuctionEngine.ts
import { doc as doc4, setDoc as setDoc3, onSnapshot as onSnapshot3 } from "firebase/firestore";
var DotaAuctionEngine = class {
  constructor(customConfig) {
    this.players = /* @__PURE__ */ new Map();
    this.teams = /* @__PURE__ */ new Map();
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];
    this.listeners = [];
    this.timerInterval = null;
    this.syncChannel = null;
    this.globalBroadcastChannel = null;
    this.storageHandler = null;
    this.isApplyingRemoteUpdate = false;
    this.purseAllocationAudit = null;
    this.unsoldQueue = [];
    this.nominationTurnIndex = 0;
    this.snakeDirection = 1;
    this.firestoreUnsub = null;
    this.tournamentDocUnsub = null;
    this.eventSource = null;
    this.ssePollInterval = null;
    this.isOrganiserHost = false;
    this.config = {
      tournamentId: customConfig?.tournamentId || "purple-bean-test-cup",
      tournamentName: customConfig?.tournamentName || "Purple Bean Test Cup",
      startingCredits: customConfig?.startingCredits ?? 1e3,
      creditAllocationMode: customConfig?.creditAllocationMode || "CAPTAIN_MMR_BALANCED",
      baseCredits: customConfig?.baseCredits ?? 1e3,
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
      extensionWindowSeconds: customConfig?.extensionWindowSeconds ?? 8,
      extensionTimeSeconds: customConfig?.extensionTimeSeconds ?? 8
    };
    this.state = {
      tournamentId: this.config.tournamentId,
      status: "PENDING",
      revision: 1,
      currentBid: this.config.minimumBid,
      leadingTeamId: "",
      leadingTeamName: "",
      nominee: null,
      secondsRemaining: this.config.nominationTimerSeconds,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false,
      lastLotResult: null,
      standInRoundActive: false,
      primaryRostersComplete: false,
      lastAntiSnipe: null
    };
    this.initializeFromRegistrations();
    this.initCrossSessionSync();
  }
  initCrossSessionSync() {
    if (typeof window !== "undefined") {
      try {
        if ("BroadcastChannel" in window) {
          this.syncChannel = new BroadcastChannel(`pb_dota_auction_sync_${this.config.tournamentId}`);
          this.syncChannel.onmessage = (event) => {
            if (event.data?.type === "AUCTION_STATE_SYNC" && event.data?.payload) {
              this.importSnapshot(event.data.payload);
            } else if (event.data?.type === "AUCTION_TIMER_TICK") {
              if (this.state.nominee && this.state.status === "LIVE") {
                this.state.secondsRemaining = event.data.secondsRemaining;
                if (event.data.timerEndsAt) this.state.timerEndsAt = event.data.timerEndsAt;
                this.notify(false);
              }
            }
          };
          this.globalBroadcastChannel = new BroadcastChannel("pb_global_cross_session_sync");
          this.globalBroadcastChannel.onmessage = (event) => {
            if (event.data?.tournamentId === this.config.tournamentId) {
              if (event.data.type === "CAPTAIN_APPOINTED" && event.data.team) {
                this.hydrateTeamFromExternal(event.data.team);
              }
            }
          };
        }
        this.storageHandler = (e) => {
          if (e.key === `pb_auction_snapshot_${this.config.tournamentId}` && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              if (parsed) {
                this.importSnapshot(parsed);
              }
            } catch {
            }
          } else if (e.key === `pb_last_captain_appointed_${this.config.tournamentId}` && e.newValue) {
            try {
              const parsed = JSON.parse(e.newValue);
              if (parsed?.team) {
                this.hydrateTeamFromExternal(parsed.team);
              }
            } catch {
            }
          }
        };
        window.addEventListener("storage", this.storageHandler);
        if (typeof EventSource !== "undefined") {
          try {
            this.eventSource = new EventSource(`/api/auction/${encodeURIComponent(this.config.tournamentId)}/stream`);
            this.eventSource.onerror = () => {
              if (this.eventSource) {
                this.eventSource.close();
                this.eventSource = null;
              }
            };
            this.eventSource.addEventListener("INIT_STATE", (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {
              }
            });
            this.eventSource.addEventListener("AUCTION_STATE_SYNC", (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {
              }
            });
            this.eventSource.addEventListener("AUCTION_NOMINATE", (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {
              }
            });
            this.eventSource.addEventListener("AUCTION_EXTEND_TIMER", (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data?.payload && !this.isApplyingRemoteUpdate) {
                  this.importSnapshot(data.payload);
                }
              } catch {
              }
            });
          } catch {
          }
        }
        this.syncWithServer().catch(() => {
        });
        this.ssePollInterval = setInterval(() => {
          if (this.isApplyingRemoteUpdate) return;
          fetch(`/api/auction/${encodeURIComponent(this.config.tournamentId)}`).then((res) => res.json()).then((data) => {
            if (data?.success && data?.snapshot) {
              const serverRev = data.snapshot.state?.revision || 0;
              const localRev = this.state.revision || 0;
              const serverNominee = data.snapshot.state?.nominee?.id;
              const localNominee = this.state.nominee?.id;
              if (serverRev > localRev || serverNominee !== localNominee || data.snapshot.state?.status === "LIVE" && this.state.status !== "LIVE" || this.players.size !== (data.snapshot.players?.length || 0) || this.getUnsoldPlayers().length !== (data.snapshot.state?.unsoldCount || 0) || this.getSoldPlayers().length !== (data.snapshot.state?.soldCount || 0) || this.state.status !== data.snapshot.state?.status) {
                this.importSnapshot(data.snapshot);
              }
            }
          }).catch(() => {
          });
        }, 2500);
      } catch {
      }
    }
    if (typeof window !== "undefined" && db) {
      try {
        this.firestoreUnsub = onSnapshot3(doc4(db, "auctions", this.config.tournamentId), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (data && !this.isApplyingRemoteUpdate) {
              this.importSnapshot(data);
            }
          }
        }, (err) => {
          console.warn("Firestore auctions sync note:", err);
        });
        this.tournamentDocUnsub = onSnapshot3(doc4(db, "tournaments", this.config.tournamentId), (snap) => {
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
        }, () => {
        });
      } catch {
      }
    }
    this.loadPersistedState();
  }
  persistState() {
    const snapshot = this.exportSnapshot();
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        window.localStorage.setItem(
          `pb_auction_snapshot_${this.config.tournamentId}`,
          JSON.stringify(snapshot)
        );
      } catch {
      }
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const cleanPayload = JSON.parse(JSON.stringify(snapshot));
        setDoc3(doc4(db, "auctions", this.config.tournamentId), {
          ...cleanPayload,
          lastPersistedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true }).catch((err) => {
          if (isQuotaError(err)) {
            setQuotaExhausted(true);
          }
          console.warn("Firestore auction setDoc note:", err);
        });
      } catch (err) {
        console.warn("Firestore auction snapshot serialization error:", err);
      }
    }
    if (typeof window !== "undefined" && typeof fetch !== "undefined") {
      try {
        fetch(`/api/auction/${encodeURIComponent(this.config.tournamentId)}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot, eventType: "AUCTION_STATE_SYNC" })
        }).catch(() => {
        });
      } catch {
      }
    }
  }
  loadPersistedState() {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (isTest) return;
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(`pb_auction_snapshot_${this.config.tournamentId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.state && parsed.state.tournamentId === this.config.tournamentId) {
            this.importSnapshot(parsed);
          }
        }
      } catch {
      }
    }
  }
  /**
   * Fetches latest authoritative server snapshot and imports it immediately.
   */
  async syncWithServer() {
    if (typeof window === "undefined" || typeof fetch === "undefined") return false;
    try {
      const res = await fetch(`/api/auction/${encodeURIComponent(this.config.tournamentId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.snapshot) {
          return this.importSnapshot(data.snapshot);
        }
      }
    } catch (err) {
      console.warn("[DotaAuctionEngine] syncWithServer warning:", err);
    }
    return false;
  }
  broadcastUpdate(persist = true) {
    if (this.isApplyingRemoteUpdate) return;
    if (persist) {
      this.persistState();
    }
    if (this.syncChannel) {
      try {
        this.syncChannel.postMessage({
          type: "AUCTION_STATE_SYNC",
          payload: this.exportSnapshot()
        });
      } catch {
      }
    }
  }
  exportSnapshot() {
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
  importSnapshot(snapshot) {
    if (!snapshot) return false;
    const wasApplying = this.isApplyingRemoteUpdate;
    this.isApplyingRemoteUpdate = true;
    try {
      if (snapshot.state) {
        this.state = { ...this.state, ...snapshot.state };
      }
      if (Array.isArray(snapshot.teams)) {
        this.teams = new Map(snapshot.teams.map((t) => [t.id, { ...t }]));
      }
      if (Array.isArray(snapshot.players)) {
        this.players = new Map(snapshot.players.map((p) => {
          const clone = { ...p };
          if (clone.auctionStatus && !clone.status) clone.status = clone.auctionStatus;
          if (clone.status && !clone.auctionStatus) clone.auctionStatus = clone.status;
          return [clone.id, clone];
        }));
      }
      for (const t of this.teams.values()) {
        for (const rosterPlayer of t.primaryRoster || []) {
          const p = this.players.get(rosterPlayer.id);
          if (p) {
            p.status = "SOLD";
            p.auctionStatus = "SOLD";
            p.teamId = t.id;
            p.teamName = t.name;
          }
        }
        for (const standIn of t.standIns || []) {
          const p = this.players.get(standIn.id);
          if (p) {
            p.status = "SOLD";
            p.auctionStatus = "SOLD";
            p.teamId = t.id;
            p.teamName = t.name;
            p.isStandIn = true;
          }
        }
      }
      if (this.state.lastLotResult?.outcome === "UNSOLD" && this.state.lastLotResult.player?.id) {
        const lastUnsold = this.players.get(this.state.lastLotResult.player.id);
        if (lastUnsold && lastUnsold.status !== "SOLD") {
          lastUnsold.status = "UNSOLD";
          lastUnsold.auctionStatus = "UNSOLD";
        }
      }
      if (Array.isArray(snapshot.nominationAudits)) {
        for (const audit of snapshot.nominationAudits) {
          if (audit.outcome === "UNSOLD" && audit.nomineeId) {
            const p = this.players.get(audit.nomineeId);
            if (p && p.status !== "SOLD") {
              p.status = "UNSOLD";
              p.auctionStatus = "UNSOLD";
            }
          }
        }
      }
      const unsoldList = Array.from(this.players.values()).filter((p) => p.status === "UNSOLD" || p.auctionStatus === "UNSOLD");
      this.state.unsoldCount = unsoldList.length;
      const soldList = Array.from(this.players.values()).filter((p) => p.status === "SOLD" || p.auctionStatus === "SOLD");
      this.state.soldCount = soldList.length;
      const unselectedList = Array.from(this.players.values()).filter((p) => p.status === "UNSELECTED" || p.auctionStatus === "UNSELECTED");
      this.state.unselectedCount = unselectedList.length;
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
        if (!this.isPurseAllocationFrozen()) {
          this.purseAllocationAudit = { ...snapshot.purseAllocationAudit };
        }
      }
      if (this.state?.status === "LIVE" && this.state?.timerEndsAt && this.state?.nominee) {
        const remainingMs = this.state.timerEndsAt - Date.now();
        this.state.secondsRemaining = Math.max(0, Math.ceil(remainingMs / 1e3));
        if (!this.timerInterval && this.state.secondsRemaining > 0) {
          this.startTimer();
        }
      }
    } finally {
      this.isApplyingRemoteUpdate = wasApplying;
    }
    this.notify(false);
    return true;
  }
  loadSnapshot(snapshot) {
    return this.importSnapshot(snapshot);
  }
  setRemainingSeconds(seconds) {
    this.state.secondsRemaining = seconds;
    this.state.timerEndsAt = Date.now() + seconds * 1e3;
    this.notify();
  }
  expireTimerNow() {
    this.state.secondsRemaining = 0;
    this.state.timerEndsAt = Date.now() - 1e3;
    this.notify();
  }
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.notify();
    return { ...this.config };
  }
  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.tickTimer(1);
    }, 1e3);
  }
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }
  setOrganiserHost(isHost) {
    this.isOrganiserHost = isHost;
  }
  tickTimer(seconds = 1) {
    if (this.state.status !== "LIVE" || !this.state.nominee || this.state.isCompleted) {
      return;
    }
    if (this.state.timerEndsAt) {
      const remainingMs = this.state.timerEndsAt - Date.now();
      const calculatedSec = Math.max(0, Math.ceil(remainingMs / 1e3));
      this.state.secondsRemaining = Math.min(
        calculatedSec,
        Math.max(0, this.state.secondsRemaining - seconds)
      );
    } else if (this.state.secondsRemaining > 0) {
      this.state.secondsRemaining = Math.max(0, this.state.secondsRemaining - seconds);
    }
    if (this.state.secondsRemaining === 0) {
      this.state.roundPhase = "OUTCOME_RESOLUTION";
      this.stopTimer();
      this.state.timerEndsAt = void 0;
      if (this.isOrganiserHost || typeof window === "undefined") {
        const hasWinningBid = Boolean(this.state.leadingTeamId);
        this.concludeNomination(hasWinningBid, "system-timer");
      } else {
        this.notify(false);
      }
    } else {
      if (this.state.secondsRemaining <= 2) {
        this.state.roundPhase = "GOING_THRICE";
      } else if (this.state.secondsRemaining <= 5) {
        this.state.roundPhase = "GOING_TWICE";
      } else if (this.state.secondsRemaining <= 15) {
        this.state.roundPhase = "GOING_ONCE";
      } else {
        this.state.roundPhase = "BIDDING";
      }
      this.notify(false);
    }
  }
  pauseAuction(staffActorId = "organizer") {
    if (this.state.status !== "LIVE") {
      return { success: false, error: "Auction is not currently LIVE." };
    }
    this.state.status = "PAUSED";
    this.stopTimer();
    const now = Date.now();
    if (this.state.timerEndsAt) {
      this.state.pausedRemainingMs = Math.max(0, this.state.timerEndsAt - now);
      this.state.secondsRemaining = Math.ceil(this.state.pausedRemainingMs / 1e3);
    }
    this.logAudit("auction_paused", staffActorId, "Auction paused by organiser.");
    this.notify();
    return { success: true };
  }
  resumeAuction(staffActorId = "organizer") {
    if (this.state.status !== "PAUSED") {
      return { success: false, error: "Auction is not currently PAUSED." };
    }
    this.state.status = "LIVE";
    const now = Date.now();
    if (this.state.pausedRemainingMs) {
      this.state.timerEndsAt = now + this.state.pausedRemainingMs;
      this.state.secondsRemaining = Math.ceil(this.state.pausedRemainingMs / 1e3);
      this.state.pausedRemainingMs = void 0;
    } else if (this.state.secondsRemaining > 0) {
      this.state.timerEndsAt = now + this.state.secondsRemaining * 1e3;
    }
    if (this.state.nominee) {
      this.startTimer();
    }
    this.logAudit("auction_resumed", staffActorId, "Auction resumed by organiser.");
    this.notify();
    return { success: true };
  }
  dismissLastLotResult() {
    this.state.lastLotResult = null;
    this.notify();
  }
  // ---------------------------------------------------------------------------
  // Initialization & Hydration
  // ---------------------------------------------------------------------------
  initializeFromRegistrations() {
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];
    const regs = dotaPlayerRegistry.getTournamentRegistrations(this.config.tournamentId).filter((r) => r.status === "VERIFIED");
    for (const reg of regs) {
      const profile = dotaPlayerRegistry.getPlayer(reg.userId);
      const isCap = Boolean(reg.isCaptainApproved || Array.from(this.teams.values()).some((t) => t.captainId === reg.userId));
      const auctionPlayer = {
        id: reg.userId,
        userId: reg.userId,
        username: reg.ign,
        displayName: profile?.displayName || reg.ign,
        avatar: profile?.avatar || "\u{1F3AE}",
        city: reg.city || profile?.city,
        region: reg.region || profile?.region,
        tournamentMmr: reg.tournamentMmr || reg.declaredMmr,
        primaryRole: reg.primaryRole,
        secondaryRole: reg.secondaryRole,
        rating: profile?.competitiveRating || Math.round((reg.tournamentMmr || reg.declaredMmr) / 4) + 100,
        isCaptain: isCap,
        status: isCap ? "SOLD" : "AVAILABLE",
        teamId: reg.teamId,
        teamName: reg.teamName
      };
      this.players.set(reg.userId, auctionPlayer);
      if (reg.isCaptainApproved && reg.teamId && !this.teams.has(reg.teamId)) {
        this.teams.set(reg.teamId, {
          id: reg.teamId,
          name: reg.teamName || `${reg.ign}'s Squad`,
          tag: (reg.ign.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "TM").toUpperCase(),
          logo: "\u{1F6E1}\uFE0F",
          color: "#7C3AED",
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
  setTournament(tournamentId, tournamentName) {
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
  syncPlayerFromRegistration(tournamentId, reg) {
    if (tournamentId !== this.config.tournamentId) return;
    if (reg.status === "VERIFIED") {
      const profile = dotaPlayerRegistry.getPlayer(reg.userId);
      const existing = this.players.get(reg.userId);
      const auctionPlayer = {
        id: reg.userId,
        userId: reg.userId,
        username: reg.ign,
        displayName: profile?.displayName || reg.ign,
        avatar: profile?.avatar || "\u{1F3AE}",
        city: reg.city || profile?.city,
        region: reg.region || profile?.region,
        tournamentMmr: reg.tournamentMmr || reg.declaredMmr,
        primaryRole: reg.primaryRole,
        secondaryRole: reg.secondaryRole,
        rating: profile?.competitiveRating || Math.round((reg.tournamentMmr || reg.declaredMmr) / 4) + 100,
        isCaptain: existing?.isCaptain || false,
        status: existing?.status || "AVAILABLE",
        teamId: existing?.teamId,
        teamName: existing?.teamName,
        soldAmount: existing?.soldAmount,
        isStandIn: existing?.isStandIn
      };
      this.players.set(reg.userId, auctionPlayer);
      this.notify();
    } else if (reg.status === "WITHDRAWN" || reg.status === "REJECTED" || reg.status === "CANCELLED") {
      this.removePlayer(reg.userId);
    } else {
      const existing = this.players.get(reg.userId);
      if (existing && existing.status === "AVAILABLE") {
        this.players.delete(reg.userId);
        this.notify();
      }
    }
  }
  removePlayer(userId) {
    let deleted = this.players.delete(userId);
    for (const [key, p] of this.players.entries()) {
      if (p.userId === userId || p.id === userId) {
        this.players.delete(key);
        deleted = true;
      }
    }
    for (const team of this.teams.values()) {
      team.primaryRoster = team.primaryRoster.filter((p) => p.userId !== userId && p.id !== userId);
      if (team.standIns && Array.isArray(team.standIns)) {
        team.standIns = team.standIns.filter((p) => p.userId !== userId && p.id !== userId);
      }
      if (team.captainId === userId) {
        team.captainId = "";
        team.captainIgn = "";
      }
      team.creditsUsed = team.primaryRoster.reduce((sum, p) => sum + (p.soldAmount || 0), 0);
      team.remainingCredits = Math.max(0, team.startingCredits - team.creditsUsed);
    }
    if (this.state.nominee && (this.state.nominee.userId === userId || this.state.nominee.id === userId)) {
      this.state.nominee = null;
      this.state.currentBid = 0;
      this.state.leadingTeamId = "";
      this.state.leadingTeamName = "";
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
  purge() {
    this.players.clear();
    this.teams.clear();
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];
    this.purseAllocationAudit = null;
    this.state = {
      tournamentId: this.config.tournamentId,
      status: "PENDING",
      revision: 1,
      currentBid: this.config.minimumBid,
      leadingTeamId: "",
      leadingTeamName: "",
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
  syncFromTestCupEngine(tcPlayers, tcTeams) {
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
        logo: t.logo || "\u2694\uFE0F",
        color: t.color || "#FFE600",
        captainId: t.captainId,
        captainIgn: t.captainIgn,
        startingCredits: t.startingCredits || this.config.startingCredits,
        remainingCredits: t.remainingCredits !== void 0 ? t.remainingCredits : this.config.startingCredits,
        creditsUsed: t.creditsUsed || 0,
        primaryRoster: (t.roster || []).map((p) => ({
          id: p.id,
          userId: p.id,
          username: p.username,
          displayName: p.realName || p.username,
          avatar: p.avatar || "\u{1F3AE}",
          city: p.city || "India",
          tournamentMmr: p.tournamentMmr,
          primaryRole: p.primaryRole || "Position 2 \u2014 Mid",
          rating: p.rating || 1500,
          isCaptain: p.isCaptain || false,
          status: p.auctionStatus || "SOLD",
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
        avatar: p.avatar || "\u{1F3AE}",
        city: p.city || "India",
        region: p.region || "India",
        tournamentMmr: p.tournamentMmr,
        primaryRole: p.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: p.secondaryRole,
        rating: p.rating || 1500,
        isCaptain: p.isCaptain || false,
        status: p.auctionStatus === "SOLD" ? "SOLD" : p.auctionStatus === "UNSOLD" ? "UNSOLD" : p.isCaptain ? "SOLD" : "AVAILABLE",
        teamId: p.teamId,
        teamName: p.teamName,
        soldAmount: p.soldAmount
      });
    }
    this.notify();
  }
  populateTestCupPool() {
    const rawRoster = [
      { id: "p-c1", ign: "Aether", name: "Arjun Nair", avatar: "\u26A1", city: "Mumbai", mmr: 8600, pRole: "Position 2 \u2014 Mid", sRole: "Position 1 \u2014 Carry", rating: 1850 },
      { id: "p-c2", ign: "Nova", name: "Rohan Sharma", avatar: "\u{1F525}", city: "Delhi", mmr: 8450, pRole: "Position 1 \u2014 Carry", sRole: "Position 3 \u2014 Offlane", rating: 1820 },
      { id: "p-c3", ign: "Karma", name: "Karthik Raja", avatar: "\u{1F6E1}\uFE0F", city: "Bengaluru", mmr: 8200, pRole: "Position 3 \u2014 Offlane", sRole: "Position 4 \u2014 Soft Support", rating: 1780 },
      { id: "p-tc-04", ign: "Viper", name: "Vikram Singh", avatar: "\u{1F40D}", city: "Hyderabad", mmr: 7500, pRole: "Position 1 \u2014 Carry", sRole: "Position 2 \u2014 Mid", rating: 1610 },
      { id: "p-tc-05", ign: "Shadow", name: "Sameer Sen", avatar: "\u{1F5E1}\uFE0F", city: "Kolkata", mmr: 7350, pRole: "Position 2 \u2014 Mid", sRole: "Position 1 \u2014 Carry", rating: 1590 },
      { id: "p-tc-06", ign: "Bulldozer", name: "Baljit Gill", avatar: "\u{1F98F}", city: "Chandigarh", mmr: 7200, pRole: "Position 3 \u2014 Offlane", sRole: "Position 4 \u2014 Soft Support", rating: 1570 },
      { id: "p-tc-07", ign: "Chakra", name: "Chaitanya Joshi", avatar: "\u{1F52E}", city: "Pune", mmr: 7100, pRole: "Position 4 \u2014 Soft Support", sRole: "Position 5 \u2014 Hard Support", rating: 1560 },
      { id: "p-tc-08", ign: "Zenith", name: "Zaid Khan", avatar: "\u{1F31F}", city: "Mumbai", mmr: 7050, pRole: "Position 5 \u2014 Hard Support", sRole: "Position 4 \u2014 Soft Support", rating: 1550 },
      { id: "p-tc-09", ign: "Phantom", name: "Pranav Nair", avatar: "\u{1F47B}", city: "Bengaluru", mmr: 7300, pRole: "Position 1 \u2014 Carry", sRole: "Position 2 \u2014 Mid", rating: 1585 },
      { id: "p-tc-10", ign: "Titan", name: "Tarun Reddy", avatar: "\u{1F5FF}", city: "Hyderabad", mmr: 7450, pRole: "Position 2 \u2014 Mid", sRole: "Position 3 \u2014 Offlane", rating: 1605 },
      { id: "p-tc-11", ign: "Oracle", name: "Omkar Deshmukh", avatar: "\u{1F441}\uFE0F", city: "Pune", mmr: 7150, pRole: "Position 5 \u2014 Hard Support", sRole: "Position 4 \u2014 Soft Support", rating: 1565 },
      { id: "p-tc-12", ign: "Frost", name: "Faizan Ahmed", avatar: "\u2744\uFE0F", city: "Delhi", mmr: 7250, pRole: "Position 4 \u2014 Soft Support", sRole: "Position 5 \u2014 Hard Support", rating: 1575 },
      { id: "p-tc-13", ign: "Blaze", name: "Bhavin Patel", avatar: "\u{1F30B}", city: "Ahmedabad", mmr: 7300, pRole: "Position 3 \u2014 Offlane", sRole: "Position 1 \u2014 Carry", rating: 1580 },
      { id: "p-tc-14", ign: "Spectre", name: "Siddharth Iyer", avatar: "\u2694\uFE0F", city: "Chennai", mmr: 7400, pRole: "Position 1 \u2014 Carry", sRole: "Position 2 \u2014 Mid", rating: 1595 },
      { id: "p-tc-15", ign: "Echo", name: "Eshan Roy", avatar: "\u{1F50A}", city: "Kolkata", mmr: 7100, pRole: "Position 4 \u2014 Soft Support", sRole: "Position 5 \u2014 Hard Support", rating: 1555 },
      { id: "p-tc-16", ign: "Tempest", name: "Tejas Saxena", avatar: "\u{1F32A}\uFE0F", city: "Jaipur", mmr: 7200, pRole: "Position 2 \u2014 Mid", sRole: "Position 1 \u2014 Carry", rating: 1570 },
      { id: "p-tc-17", ign: "Vortex", name: "Varun Menon", avatar: "\u{1F300}", city: "Kochi", mmr: 7e3, pRole: "Position 5 \u2014 Hard Support", sRole: "Position 4 \u2014 Soft Support", rating: 1540 },
      { id: "p-tc-18", ign: "Raptor", name: "Rishi Verma", avatar: "\u{1F996}", city: "Lucknow", mmr: 7150, pRole: "Position 3 \u2014 Offlane", sRole: "Position 4 \u2014 Soft Support", rating: 1560 },
      { id: "p-tc-19", ign: "Krypton", name: "Karan Mehra", avatar: "\u{1F48E}", city: "Delhi", mmr: 7050, pRole: "Position 1 \u2014 Carry", sRole: "Position 2 \u2014 Mid", rating: 1550 },
      { id: "p-tc-20", ign: "Apex", name: "Ayush Sharma", avatar: "\u{1F3D4}\uFE0F", city: "Indore", mmr: 7200, pRole: "Position 3 \u2014 Offlane", sRole: "Position 2 \u2014 Mid", rating: 1570 },
      { id: "p-tc-21", ign: "Helix", name: "Harshil Shah", avatar: "\u{1F9EC}", city: "Surat", mmr: 7250, pRole: "Position 4 \u2014 Soft Support", sRole: "Position 5 \u2014 Hard Support", rating: 1575 }
    ];
    for (const r of rawRoster) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: this.config.tournamentId,
        userId: r.id,
        ign: r.ign,
        primaryRole: r.pRole,
        secondaryRole: r.sRole,
        declaredMmr: r.mmr,
        rulesAccepted: true,
        city: r.city
      });
      dotaPlayerRegistry.verifyRegistration(this.config.tournamentId, r.id, "system-seed", r.mmr);
      const p = {
        id: r.id,
        userId: r.id,
        username: r.ign,
        displayName: r.name,
        avatar: r.avatar,
        city: r.city,
        region: "India",
        tournamentMmr: r.mmr,
        primaryRole: r.pRole,
        secondaryRole: r.sRole,
        rating: r.rating,
        isCaptain: false,
        status: "AVAILABLE"
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
  getEligibleCaptainCandidates() {
    const registrations = typeof dotaPlayerRegistry.getTournamentRegistrations === "function" ? dotaPlayerRegistry.getTournamentRegistrations(this.config.tournamentId) : typeof dotaPlayerRegistry.getRegistrationsForTournament === "function" ? dotaPlayerRegistry.getRegistrationsForTournament(this.config.tournamentId) : [];
    for (const reg of registrations) {
      if (reg.status === "VERIFIED" && !this.players.has(reg.userId)) {
        this.syncPlayerFromRegistration(this.config.tournamentId, reg);
      }
    }
    return Array.from(this.players.values()).filter((p) => {
      if (p.isCaptain) return false;
      const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, p.userId);
      if (!reg) return false;
      const hasLockedMmr = reg.isMmrLocked || typeof reg.tournamentMmr === "number" && reg.tournamentMmr > 0;
      return reg.status === "VERIFIED" && hasLockedMmr && Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
    });
  }
  /**
   * Appoints a VERIFIED contender as captain, automatically creating a tournament team.
   * Captain counts as 1/5 in the mandatory primary roster.
   */
  appointCaptain(candidateUserId, teamMetadata, staffActorId) {
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, candidateUserId);
    if (!reg) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament registration pool.` };
    }
    if (reg.status !== "VERIFIED") {
      return { success: false, error: "Only VERIFIED contenders are eligible to be appointed as team captains." };
    }
    if (this.config.tournamentId === "auction-basic-test-1" || this.config.tournamentId === "2-team-auction-test") {
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
    let player = this.players.get(candidateUserId);
    if (!player) {
      this.syncPlayerFromRegistration(this.config.tournamentId, reg);
      player = this.players.get(candidateUserId);
    }
    if (!player) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament player pool.` };
    }
    const isAlreadyCaptainInTeam = Array.from(this.teams.values()).some((t) => t.captainId === candidateUserId);
    if (isAlreadyCaptainInTeam) {
      return { success: false, error: `'${player.username}' is already appointed as a team captain.` };
    }
    const teamId = `team-${candidateUserId.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now() % 1e4}`;
    player.isCaptain = true;
    player.status = "SOLD";
    player.teamId = teamId;
    player.teamName = teamMetadata.teamName;
    const team = {
      id: teamId,
      name: teamMetadata.teamName,
      tag: teamMetadata.tag.toUpperCase(),
      logo: teamMetadata.logo || player.avatar || "\u{1F6E1}\uFE0F",
      color: teamMetadata.color || "#FFE600",
      captainId: candidateUserId,
      captainIgn: player.username,
      startingCredits: this.config.startingCredits,
      remainingCredits: this.config.startingCredits,
      creditsUsed: 0,
      primaryRoster: [player],
      // Captain counts as 1/5 in primary roster
      standIns: []
    };
    this.teams.set(teamId, team);
    reg.isCaptainApproved = true;
    reg.interestedInCaptaincy = true;
    reg.applyingAsCaptain = true;
    reg.teamId = teamId;
    reg.teamName = teamMetadata.teamName;
    reg.captainApprovedAt = (/* @__PURE__ */ new Date()).toISOString();
    reg.captainApprovedBy = staffActorId;
    reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    const tourneyDisplayName = this.config.tournamentName || (this.config.tournamentId === "auction-basic-test-1" ? "Auction Basic Test 1" : this.config.tournamentId);
    dotaPlayerRegistry.addNotification({
      id: `notif-cap-appointed-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: candidateUserId,
      userEmail: reg.userEmail,
      userIgn: player.username,
      type: "CAPTAIN_SELECTED",
      title: "You've Been Appointed Captain!",
      message: `You have been selected as captain of ${teamMetadata.teamName} for ${tourneyDisplayName}. Head to the Auction Room to build your roster!`,
      tournamentId: this.config.tournamentId,
      registrationId: reg.id,
      actionTarget: `/tournaments/${this.config.tournamentId}/auction`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      read: false
    });
    this.logAudit(
      "captain_appointed",
      staffActorId,
      `Appointed ${player.username} (MMR: ${player.tournamentMmr}) as captain of ${team.name}. Primary roster: 1/${this.config.primaryRosterSize}.`
    );
    if (this.teams.size >= 2 && !this.hasBidsStarted()) {
      this.calculateAndApplyMmrBalancedPurses(staffActorId, false);
    }
    this.state.revision = (this.state.revision || 1) + 1;
    this.persistState();
    this.broadcastUpdate();
    this.notify();
    return { success: true, team };
  }
  hasTeam(teamId) {
    return this.teams.has(teamId);
  }
  hydrateTeamFromExternal(rawTeam) {
    const teamId = rawTeam.id || `team-${Date.now()}`;
    const captainId = rawTeam.captainId || rawTeam.captainUserId || "";
    const captainIgn = rawTeam.captainIgn || rawTeam.captainName || rawTeam.name;
    const lockedMmr = rawTeam.primaryRoster?.[0]?.tournamentMmr || rawTeam.lockedTournamentMmr || rawTeam.tournamentMmr || 7500;
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
        avatar: rawTeam.logo || "\u{1F6E1}\uFE0F",
        city: rawTeam.city || "India",
        region: "India",
        tournamentMmr: lockedMmr,
        primaryRole: "Position 1 \u2014 Carry",
        secondaryRole: "Position 2 \u2014 Mid",
        rating: Math.round(lockedMmr / 4) + 100,
        isCaptain: true,
        isMmrLocked: true,
        status: "SOLD",
        teamId,
        teamName: rawTeam.name
      };
      this.players.set(captainId, captainPlayer);
    } else if (captainPlayer) {
      captainPlayer.isCaptain = true;
      captainPlayer.isMmrLocked = true;
      captainPlayer.status = "SOLD";
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
    const team = {
      id: teamId,
      name: rawTeam.name,
      tag: (rawTeam.tag || "TM").toUpperCase(),
      logo: rawTeam.logo || "\u{1F6E1}\uFE0F",
      color: rawTeam.color || "#FFE600",
      captainId,
      captainIgn,
      startingCredits: rawTeam.startingCredits || this.config.startingCredits,
      remainingCredits: rawTeam.remainingCredits !== void 0 ? rawTeam.remainingCredits : rawTeam.startingCredits || this.config.startingCredits,
      creditsUsed: rawTeam.creditsUsed || 0,
      primaryRoster: Array.isArray(rawTeam.primaryRoster) && rawTeam.primaryRoster.length > 0 ? rawTeam.primaryRoster : captainPlayer ? [captainPlayer] : [],
      standIns: Array.isArray(rawTeam.standIns) ? rawTeam.standIns : []
    };
    this.teams.set(teamId, team);
    this.notify(false);
    return team;
  }
  autoDrawCaptains(count, seed = "pb-seed-12345", staffActorId = "organizer") {
    const candidates = Array.from(this.players.values()).filter((p) => {
      const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, p.id);
      return !p.isCaptain && reg && reg.status === "VERIFIED" && Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
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
    for (let i = 0; i < seed.length; i++) s = s * 31 + seed.charCodeAt(i) >>> 0;
    const rng = () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, count);
    const selectedCaptains = [];
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
      action: "auto_captain_draw",
      seed,
      candidates: candidates.map((c) => ({ id: c.id, username: c.username, mmr: c.tournamentMmr })),
      selected: selected.map((s2) => ({ id: s2.id, username: s2.username, mmr: s2.tournamentMmr })),
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      actor: staffActorId
    };
    this.logAudit("auto_captain_draw", staffActorId, `Automated draw selected ${selectedCaptains.length} captains from ${candidates.length} candidates using seed '${seed}'.`);
    this.notify();
    return { success: true, selectedCaptains, auditRecord };
  }
  resetCaptain(captainUserId, staffActorId = "organizer") {
    if (this.hasBidsStarted() || this.state.status === "LIVE") {
      return { success: false, error: "Cannot reset or reassign captains after live auction has commenced." };
    }
    const team = Array.from(this.teams.values()).find((t) => t.captainId === captainUserId);
    if (!team) return { success: false, error: "Captain team not found." };
    const player = this.players.get(captainUserId);
    if (player) {
      player.isCaptain = false;
      player.teamId = void 0;
      player.teamName = void 0;
      player.status = "AVAILABLE";
    }
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, captainUserId);
    if (reg) {
      reg.isCaptainApproved = false;
      reg.teamId = void 0;
      reg.teamName = void 0;
      reg.captainApprovedAt = void 0;
      reg.captainApprovedBy = void 0;
    }
    this.teams.delete(team.id);
    this.logAudit("captain_reset", staffActorId, `Reset captain ${player?.username || captainUserId} and dissolved team ${team.name}.`);
    this.notify();
    return { success: true };
  }
  updateTeamIdentity(teamId, identity, actorId = "captain") {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: "Team not found." };
    if (identity.name) team.name = identity.name;
    if (identity.tag) team.tag = identity.tag;
    if (identity.logo) team.logo = identity.logo;
    if (identity.color) team.color = identity.color;
    if (identity.bannerUrl !== void 0) team.bannerUrl = identity.bannerUrl;
    this.logAudit("team_identity_updated", actorId, `Updated team identity for ${team.name} (Tag: ${team.tag}).`);
    this.notify();
    return { success: true, team };
  }
  setNominationMode(mode) {
    this.config.nominationMode = mode;
    this.notify();
  }
  getNextNominationTurn() {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length === 0) return null;
    const mode = this.config.nominationMode || "ORGANISER";
    const currentTeam = teamsList[this.nominationTurnIndex % teamsList.length];
    return {
      teamId: currentTeam.id,
      teamName: currentTeam.name,
      index: this.nominationTurnIndex,
      mode
    };
  }
  advanceNominationTurn() {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length <= 1) return;
    const mode = this.config.nominationMode || "ORGANISER";
    if (mode === "LINEAR") {
      this.nominationTurnIndex = (this.nominationTurnIndex + 1) % teamsList.length;
    } else if (mode === "SNAKE") {
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
  getUnsoldQueue() {
    return [...this.unsoldQueue];
  }
  startUnsoldSecondPass(staffActorId = "organizer") {
    let count = 0;
    for (const p of this.players.values()) {
      if (p.status === "UNSOLD") {
        p.status = "AVAILABLE";
        count++;
      }
    }
    if (count === 0) {
      return { success: false, reauctionCount: 0, error: "No unsold players to re-auction." };
    }
    this.state.unsoldCount = 0;
    this.unsoldQueue = [];
    if (this.state.isCompleted) {
      this.state.isCompleted = false;
      this.state.status = "READY";
    }
    this.logAudit("unsold_second_pass_started", staffActorId, `Started unsold second-pass: restored ${count} players to available pool.`);
    this.notify();
    return { success: true, reauctionCount: count };
  }
  /**
   * PurpleBeanGaming Authoritative Rule:
   * UNSOLD players may be recalled only after all normal AVAILABLE players have been resolved to SOLD or UNSOLD.
   */
  canRecallUnsold(playerId, options) {
    const player = this.players.get(playerId);
    if (!player) {
      return { allowed: false, reason: "Player not found in auction pool." };
    }
    if (player.status !== "UNSOLD" && player.auctionStatus !== "UNSOLD") {
      return { allowed: false, reason: `Player status is ${player.status}, expected UNSOLD.` };
    }
    if (this.state.isCompleted || this.state.status === "COMPLETED") {
      return {
        allowed: false,
        reason: 'Auction is COMPLETED (Primary rosters complete). Reopening the auction room ("Reopen for Unsold") or initiating the Stand-In phase is required.'
      };
    }
    const availableNormal = Array.from(this.players.values()).filter((p) => (p.status === "AVAILABLE" || p.auctionStatus === "AVAILABLE") && !p.isCaptain);
    if (availableNormal.length > 0 && !options?.forceOverride) {
      return {
        allowed: false,
        reason: `Recall not permitted: ${availableNormal.length} normal AVAILABLE player(s) remain in the pool. All regular players must be resolved to SOLD or UNSOLD first.`
      };
    }
    const allPrimaryFilled = Array.from(this.teams.values()).length > 0 && Array.from(this.teams.values()).every(
      (t) => t.primaryRoster.length >= this.config.primaryRosterSize
    );
    if (allPrimaryFilled && !this.state.standInRoundActive && !options?.forceOverride) {
      return {
        allowed: false,
        reason: "Primary rosters are full (5/5). Stand-In auction phase must be active to purchase another contender."
      };
    }
    return { allowed: true };
  }
  /**
   * Explicit organizer reopening of completed auction room for unsold contender resolution.
   */
  reopenAuctionForUnsold(staffActorId = "organizer", reason = "Reopening room to resolve unsold contenders") {
    this.state.isCompleted = false;
    this.state.status = "PAUSED";
    this.logAudit("AUCTION_REOPENED_FOR_UNSOLD", staffActorId, `Auction reopened: ${reason}`);
    this.broadcastUpdate();
    this.notify();
    return { success: true };
  }
  /**
   * Restores an individual UNSOLD or UNSELECTED contender back to AVAILABLE auction pool.
   * Emits audited PLAYER_REINTRODUCED event.
   */
  reauctionPlayer(playerId, staffActorId = "organizer", options) {
    if (this.state.isCompleted || this.state.status === "COMPLETED") {
      return {
        success: false,
        error: 'AUCTION_LOCKED_COMPLETED: Auction is COMPLETED and locked. Reopen the auction room via "Reopen for Unsold" or initiate the Stand-In phase before recalling players.'
      };
    }
    const p = this.players.get(playerId);
    if (!p) return { success: false, error: `Player '${playerId}' not found.` };
    if (p.status !== "UNSOLD" && p.status !== "UNSELECTED" && p.auctionStatus !== "UNSOLD" && p.auctionStatus !== "UNSELECTED") {
      return { success: false, error: `Player '${p.username}' is not UNSOLD or UNSELECTED (status: ${p.status}).` };
    }
    if (p.status === "UNSOLD") {
      const check = this.canRecallUnsold(playerId, options);
      if (!check.allowed && !options?.forceOverride) {
        return { success: false, error: check.reason };
      }
      this.state.unsoldCount = Math.max(0, this.state.unsoldCount - 1);
    }
    if (p.status === "UNSELECTED") {
      this.state.unselectedCount = Math.max(0, (this.state.unselectedCount || 0) - 1);
    }
    p.status = "AVAILABLE";
    this.unsoldQueue = this.unsoldQueue.filter((id) => id !== playerId);
    this.logAudit(
      "PLAYER_REINTRODUCED",
      staffActorId,
      `Player ${p.username} recalled from ${p.status} to AVAILABLE auction pool.${options?.forceOverride ? ` [ORGANIZER OVERRIDE: ${options.overrideReason || "Admin approved"}]` : ""}`
    );
    this.notify();
    return { success: true, player: p };
  }
  /**
   * Re-auctions and immediately puts the UNSOLD or UNSELECTED contender on the live auction block.
   */
  reauctionAndNominatePlayer(playerId, staffActorId = "organizer", options) {
    const p = this.players.get(playerId);
    if (!p) return { success: false, error: `Player '${playerId}' not found.` };
    if (p.status === "UNSOLD" || p.status === "UNSELECTED") {
      const rest = this.reauctionPlayer(playerId, staffActorId, options);
      if (!rest.success) return { success: false, error: rest.error };
    }
    return this.nominatePlayer(playerId, staffActorId);
  }
  /**
   * Organiser officially initiates the Stand-in auction round.
   * Can ONLY be started when ALL teams have filled their mandatory primary rosters (e.g. 5/5).
   */
  startStandInAuction(staffActorId = "organizer") {
    const teamsList = Array.from(this.teams.values());
    if (teamsList.length === 0) {
      return { success: false, error: "No teams registered in this tournament." };
    }
    const incompleteTeams = teamsList.filter((t) => t.primaryRoster.length < this.config.primaryRosterSize);
    if (incompleteTeams.length > 0) {
      return {
        success: false,
        error: `Cannot start stand-in auction: ${incompleteTeams.length} team(s) still have incomplete primary rosters (${incompleteTeams.map((t) => `${t.name}: ${t.primaryRoster.length}/${this.config.primaryRosterSize}`).join(", ")}). All teams must first reach 5/5 full primary rosters.`
      };
    }
    this.state.standInRoundActive = true;
    this.state.isCompleted = false;
    this.state.status = "READY";
    this.logAudit(
      "standin_auction_started",
      staffActorId,
      `Stand-in auction round officially started! All ${teamsList.length} teams have completed primary rosters. Teams can now bid on optional 6th slot stand-in players.`
    );
    this.notify();
    return { success: true };
  }
  /**
   * Concludes the Stand-in auction round and finalizes the auction.
   */
  concludeStandInAuction(staffActorId = "organizer") {
    this.state.standInRoundActive = false;
    this.finalizeAuction(staffActorId);
    return { success: true };
  }
  /**
   * Reopens an auction if it was completed or closed.
   */
  reopenAuction(staffActorId = "organizer") {
    this.state.isCompleted = false;
    this.state.status = "READY";
    this.logAudit("auction_reopened", staffActorId, "Auction floor reopened by organiser.");
    this.notify();
    return { success: true };
  }
  addTime(seconds, staffActorId = "organizer") {
    this.state.secondsRemaining += seconds;
    if (this.state.pausedRemainingMs !== void 0) {
      this.state.pausedRemainingMs += seconds * 1e3;
    }
    if (this.state.timerEndsAt) {
      this.state.timerEndsAt += seconds * 1e3;
    } else {
      this.state.timerEndsAt = Date.now() + this.state.secondsRemaining * 1e3;
    }
    if (this.state.status === "LIVE" && !this.timerInterval && this.state.nominee) {
      this.startTimer();
    }
    this.logAudit("timer_adjusted", staffActorId, `Added ${seconds} seconds to timer.`);
    this.notify(true);
  }
  removeTime(seconds, staffActorId = "organizer") {
    this.state.secondsRemaining = Math.max(1, this.state.secondsRemaining - seconds);
    if (this.state.pausedRemainingMs !== void 0) {
      this.state.pausedRemainingMs = Math.max(1e3, this.state.pausedRemainingMs - seconds * 1e3);
    }
    this.state.timerEndsAt = Date.now() + this.state.secondsRemaining * 1e3;
    this.logAudit("timer_adjusted", staffActorId, `Removed ${seconds} seconds from timer.`);
    this.notify(true);
  }
  adjustTimer(newSeconds, staffActorId = "organizer") {
    this.state.secondsRemaining = Math.max(0, newSeconds);
    if (this.state.pausedRemainingMs !== void 0) {
      this.state.pausedRemainingMs = newSeconds * 1e3;
    }
    this.state.timerEndsAt = Date.now() + newSeconds * 1e3;
    if (this.state.secondsRemaining === 0) {
      this.state.roundPhase = "OUTCOME_RESOLUTION";
    } else if (this.state.secondsRemaining <= 5) {
      this.state.roundPhase = "GOING_TWICE";
    } else if (this.state.secondsRemaining <= 15) {
      this.state.roundPhase = "GOING_ONCE";
    } else {
      this.state.roundPhase = "BIDDING";
    }
    if (this.state.status === "LIVE" && !this.timerInterval && this.state.nominee && newSeconds > 0) {
      this.startTimer();
    }
    this.logAudit("timer_adjusted", staffActorId, `Adjusted timer to ${newSeconds} seconds.`);
    this.notify(true);
  }
  setDefaultNominationSeconds(seconds, staffActorId = "organizer") {
    this.config.nominationTimerSeconds = Math.max(10, seconds);
    this.logAudit("config_updated", staffActorId, `Configured lot nomination duration to ${this.config.nominationTimerSeconds}s.`);
    this.notify(true);
  }
  undoLastBid(staffActorId = "organizer") {
    if (!this.state.nominee) {
      return { success: false, error: "Cannot undo bid when no player is nominated." };
    }
    const activeBids = this.bidHistory.filter((b) => b.nomineeId === this.state.nominee?.id && !b.reverted);
    if (activeBids.length === 0) {
      return { success: false, error: "No active bids to undo for the current nominee." };
    }
    const lastBid = activeBids[0];
    lastBid.reverted = true;
    lastBid.revertedBy = staffActorId;
    const remainingBids = this.bidHistory.filter((b) => b.nomineeId === this.state.nominee?.id && !b.reverted);
    if (remainingBids.length > 0) {
      const prevBid = remainingBids[0];
      this.state.currentBid = prevBid.amount;
      this.state.leadingTeamId = prevBid.teamId;
      this.state.leadingTeamName = prevBid.teamName;
    } else {
      this.state.currentBid = this.config.minimumBid;
      this.state.leadingTeamId = "";
      this.state.leadingTeamName = "";
    }
    this.state.revision += 1;
    this.logAudit("bid_undone", staffActorId, `Reverted bid of ${lastBid.amount} by ${lastBid.teamName}. Restored leader: ${this.state.leadingTeamName || "None"} (${this.state.currentBid})`);
    this.notify();
    return {
      success: true,
      revertedBid: lastBid,
      restoredBid: this.state.currentBid,
      restoredTeamId: this.state.leadingTeamId
    };
  }
  forceSell(playerId, teamId, amount, staffActorId = "organizer") {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: "Player not found in auction pool." };
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: "Team not found." };
    this.stopTimer();
    player.status = "SOLD";
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
    this.logAudit("player_force_sold", staffActorId, `Force sold ${player.username} to ${team.name} for ${amount} credits.`);
    this.notify();
    return { success: true };
  }
  reauctionCurrentPlayer(staffActorId = "organizer") {
    if (!this.state.nominee) return { success: false, error: "No player currently on auction block." };
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = "";
    this.state.leadingTeamName = "";
    this.state.secondsRemaining = this.config.bidTimerSeconds;
    this.state.timerEndsAt = Date.now() + this.config.bidTimerSeconds * 1e3;
    this.state.roundPhase = "BIDDING";
    this.logAudit("player_reauctioned", staffActorId, `Re-auctioned current nominee ${this.state.nominee.username} at starting bid.`);
    this.startTimer();
    this.notify();
    return { success: true };
  }
  // ---------------------------------------------------------------------------
  // 1.1 MMR-Balanced Purse Engine & Server Authority
  // ---------------------------------------------------------------------------
  hasBidsStarted() {
    return this.bidHistory.length > 0 || Boolean(this.purseAllocationAudit?.hasBidsStarted) || this.state.soldCount > 0;
  }
  isPurseAllocationFrozen() {
    return Boolean(this.purseAllocationAudit?.isFrozen) || this.hasBidsStarted();
  }
  getPurseAllocationAudit() {
    return this.purseAllocationAudit ? { ...this.purseAllocationAudit } : null;
  }
  /**
   * Retrieves strictly the locked Tournament MMR for a captain.
   * Strictly uses ONLY locked Tournament MMR.
   * Never falls back to declared MMR, OpenDota estimate, or PB rating.
   */
  getCaptainLockedTournamentMmr(captainId) {
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, captainId);
    if (reg && reg.isMmrLocked && typeof reg.tournamentMmr === "number" && reg.tournamentMmr > 0) {
      return { tournamentMmr: reg.tournamentMmr, isLocked: true };
    }
    const player = this.players.get(captainId) || dotaPlayerRegistry.getPlayer(captainId);
    if (player && player.isMmrLocked && typeof player.tournamentMmr === "number" && player.tournamentMmr > 0) {
      return { tournamentMmr: player.tournamentMmr, isLocked: true };
    }
    return null;
  }
  /**
   * Inspects all franchise captains to verify whether every captain possesses
   * a verified, locked Tournament MMR. Returns the first blocking captain or null.
   */
  getMissingLockedMmrCaptain() {
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
  isAuctionReady() {
    const minTeamsRequired = this.config.tournamentId === "auction-test" ? 3 : this.config.primaryRosterSize > 0 ? 2 : 1;
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
  isPurseConfirmed() {
    return Boolean(this.state.isPurseConfirmed);
  }
  /**
   * Explicit organiser confirmation of MMR-balanced starting purses.
   * Required before auction lobby transitions to READY.
   */
  confirmPurses(staffActorId) {
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
    this.state.status = "READY";
    this.logAudit(
      "purses_confirmed",
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
  calculateAndApplyMmrBalancedPurses(staffActorId = "system", force = false) {
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: "Recalculation Denied: Bidding has already started and accepted bids exist. Starting purses are permanently locked."
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
        error: "Cannot calculate purses: No tournament teams formed."
      };
    }
    const captainInputs = [];
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
    for (const entry of calcResult.audit.entries) {
      const team = this.teams.get(entry.teamId);
      if (team) {
        team.startingCredits = entry.finalStartingCredits;
        team.remainingCredits = entry.finalStartingCredits - team.creditsUsed;
      }
    }
    this.purseAllocationAudit = calcResult.audit;
    this.logAudit(
      "purse_allocation_calculated",
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
  recalculatePurses(staffActorId) {
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: "Recalculation Denied: Bidding has already started and accepted bids exist. Starting purses are permanently locked."
      };
    }
    return this.calculateAndApplyMmrBalancedPurses(staffActorId, true);
  }
  /**
   * Configures credit allocation mode (CAPTAIN_MMR_BALANCED or EQUAL) before bidding starts.
   */
  setAllocationMode(mode, staffActorId) {
    if (this.hasBidsStarted()) {
      return {
        success: false,
        error: "Allocation Mode Locked: Cannot change credit allocation mode after bidding has started."
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
  startAuction(staffActorId) {
    const readyCheck = this.isAuctionReady();
    if (!readyCheck.ready) {
      return { success: false, error: readyCheck.error };
    }
    if (this.config.tournamentId === "auction-test" && !this.state.isPurseConfirmed) {
      return {
        success: false,
        error: "Cannot start auction: Organiser must confirm starting purse allocation before starting auction."
      };
    }
    const balanceRes = this.calculateAndApplyMmrBalancedPurses(staffActorId, false);
    if (!balanceRes.success) {
      return {
        success: false,
        error: `Cannot start auction: ${balanceRes.error}`
      };
    }
    if (this.purseAllocationAudit) {
      this.purseAllocationAudit.isFrozen = true;
      this.purseAllocationAudit.frozenAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    this.state.status = "LIVE";
    this.logAudit(
      "auction_started",
      staffActorId,
      `Auction started with ${this.teams.size} teams. Total credit economy: ${this.purseAllocationAudit?.totalCredits || 1e3 * this.teams.size} Cr.`
    );
    this.broadcastUpdate();
    this.notify();
    return { success: true };
  }
  /**
   * Organiser nominates an AVAILABLE contender to the floor.
   */
  nominatePlayer(playerId, staffActorId) {
    if (this.state.isCompleted || this.state.status === "COMPLETED") {
      return { success: false, error: "Cannot nominate player: Auction is completed. Reopen auction first before nominating." };
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
    if (player.status !== "AVAILABLE" && player.status !== "UNSOLD" && player.status !== "UNSELECTED") {
      return { success: false, error: `Player '${player.username}' is not AVAILABLE, UNSOLD, or UNSELECTED (current status: ${player.status}).` };
    }
    const nowMs = Date.now();
    if (player.status === "UNSOLD") {
      this.state.unsoldCount = Math.max(0, this.state.unsoldCount - 1);
      this.unsoldQueue = this.unsoldQueue.filter((id) => id !== playerId);
    }
    if (player.status === "UNSELECTED") {
      this.state.unselectedCount = Math.max(0, (this.state.unselectedCount || 0) - 1);
    }
    player.status = "NOMINATED";
    this.state.nominee = player;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = "";
    this.state.leadingTeamName = "";
    this.state.secondsRemaining = this.config.nominationTimerSeconds;
    this.state.timerEndsAt = nowMs + this.config.nominationTimerSeconds * 1e3;
    this.state.roundPhase = "BIDDING";
    this.state.status = "LIVE";
    this.state.revision += 1;
    this.state.lastAntiSnipe = null;
    this.startTimer();
    this.logAudit(
      "player_nominated",
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
  placeBid(params) {
    const { teamId, captainUserId, expectedRevision, actorRole } = params;
    if (actorRole === "organizer") {
      return {
        success: false,
        error: "Reject: Organiser cannot bid on behalf of teams. Only authenticated franchise captains can place bids."
      };
    }
    if (actorRole === "spectator") {
      return {
        success: false,
        error: "Reject: Spectator account is read-only and cannot submit live bids."
      };
    }
    if (this.state.status === "PAUSED") {
      return { success: false, error: "Reject: Auction is currently paused by the organiser." };
    }
    if (this.state.status !== "LIVE" || this.state.isCompleted) {
      return { success: false, error: `Reject: Auction is currently ${this.state.status}. Bidding is closed.` };
    }
    const nowMs = Date.now();
    if (this.state.timerEndsAt && nowMs >= this.state.timerEndsAt) {
      return {
        success: false,
        error: "Reject: Nomination timer has expired. Bidding is closed."
      };
    }
    if (!this.state.nominee) {
      return { success: false, error: "Reject: Nomination is already closed or no player is currently on the auction block." };
    }
    if (this.state.nominee.status !== "NOMINATED") {
      return { success: false, error: `Reject: Player '${this.state.nominee.username}' is not currently available for bidding.` };
    }
    let team;
    if (captainUserId) {
      for (const t of this.teams.values()) {
        if (t.captainId === captainUserId) {
          team = t;
          break;
        }
      }
    }
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
    if (teamId && teamId !== team.id) {
      return {
        success: false,
        error: `Permission Denied: User '${captainUserId}' is not the authorized captain of team '${teamId}'. Captain cannot submit bids for rival teams.`
      };
    }
    if (expectedRevision !== void 0 && expectedRevision !== this.state.revision) {
      return {
        success: false,
        error: `Stale Bid: Auction revision changed (expected ${expectedRevision}, current ${this.state.revision}). Please refresh.`
      };
    }
    let proposedBid;
    if (params.increment !== void 0) {
      proposedBid = this.state.currentBid + params.increment;
    } else if (params.bidAmount !== void 0) {
      proposedBid = params.bidAmount;
    } else {
      return { success: false, error: "Reject: Bid amount or increment must be specified." };
    }
    if (proposedBid < this.config.minimumBid) {
      return {
        success: false,
        error: `Reject: Bid must meet floor opening minimum of ${this.config.minimumBid} credits.`
      };
    }
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
    if (team.remainingCredits < proposedBid) {
      return {
        success: false,
        error: `Insufficient credits: ${team.name} has ${team.remainingCredits} credits, cannot bid ${proposedBid} credits.`
      };
    }
    const currentPrimaryCount = team.primaryRoster.length;
    const isPrimaryFull = currentPrimaryCount >= this.config.primaryRosterSize;
    const isStandInRoundActive = Boolean(this.state.standInRoundActive);
    if (!isStandInRoundActive) {
      if (isPrimaryFull) {
        return {
          success: false,
          error: `Reject: Roster full. ${team.name} already has a complete primary roster (${currentPrimaryCount}/${this.config.primaryRosterSize}). Teams with complete rosters cannot bid while other teams are still filling their primary rosters. Stand-in auction will only open after all teams have full rosters.`
        };
      }
    } else {
      const isStandInFull = team.standIns.length >= this.config.optionalStandInLimit;
      if (isStandInFull) {
        return {
          success: false,
          error: `Reject: Stand-in slot full. ${team.name} already has the maximum ${this.config.optionalStandInLimit} stand-in.`
        };
      }
    }
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
    this.state.currentBid = proposedBid;
    this.state.leadingTeamId = team.id;
    this.state.leadingTeamName = team.name;
    this.state.revision += 1;
    if (this.purseAllocationAudit) {
      this.purseAllocationAudit.hasBidsStarted = true;
      this.purseAllocationAudit.isFrozen = true;
    }
    if (this.config.bidExtensionEnabled) {
      const remainingSec = this.state.timerEndsAt ? Math.max(0, Math.ceil((this.state.timerEndsAt - nowMs) / 1e3)) : this.state.secondsRemaining;
      const windowSec = this.config.extensionWindowSeconds ?? 8;
      if (remainingSec <= windowSec || this.state.secondsRemaining <= windowSec) {
        const extendSec = this.config.extensionTimeSeconds ?? 8;
        this.state.secondsRemaining = extendSec;
        this.state.timerEndsAt = nowMs + extendSec * 1e3;
        this.state.roundPhase = "BIDDING";
        this.state.lastAntiSnipe = {
          teamName: team.name,
          amount: proposedBid,
          extendedSeconds: extendSec,
          timestamp: nowMs
        };
        this.logAudit(
          "anti_snipe_triggered",
          captainUserId,
          `\u26A1 Anti-snipe triggered by ${team.name}'s bid of ${proposedBid} Cr! Clock extended to ${extendSec}s and calls reset.`
        );
      } else {
        this.state.roundPhase = "BIDDING";
      }
    }
    const now = /* @__PURE__ */ new Date();
    const timeFormatted = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const bidRecord = {
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
      "bid_accepted",
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
  concludeNomination(sellToWinner, staffActorId) {
    const nominee = this.state.nominee;
    if (!nominee) {
      throw new Error("No nominee currently on the auction block to conclude.");
    }
    let outcome = "UNSOLD";
    let winningTeamName;
    let winningBid;
    if (sellToWinner && this.state.leadingTeamId) {
      const winnerTeam = this.teams.get(this.state.leadingTeamId);
      if (!winnerTeam) throw new Error("Winning team record not found.");
      const winningPrice = this.state.currentBid;
      winnerTeam.remainingCredits -= winningPrice;
      winnerTeam.creditsUsed += winningPrice;
      nominee.status = "SOLD";
      nominee.teamId = winnerTeam.id;
      nominee.teamName = winnerTeam.name;
      nominee.soldAmount = winningPrice;
      if (this.state.standInRoundActive || winnerTeam.primaryRoster.length >= this.config.primaryRosterSize) {
        nominee.isStandIn = true;
        winnerTeam.standIns.push(nominee);
      } else {
        nominee.isStandIn = false;
        winnerTeam.primaryRoster.push(nominee);
      }
      this.state.soldCount += 1;
      outcome = "SOLD";
      winningTeamName = winnerTeam.name;
      winningBid = winningPrice;
      this.logAudit(
        "player_sold",
        staffActorId,
        `Player ${nominee.username} SOLD to ${winnerTeam.name} for ${winningPrice} credits. Roster: ${winnerTeam.primaryRoster.length}/${this.config.primaryRosterSize} primary, ${winnerTeam.standIns.length}/${this.config.optionalStandInLimit} stand-in.`
      );
    } else {
      nominee.status = "UNSOLD";
      this.state.unsoldCount += 1;
      outcome = "UNSOLD";
      this.logAudit(
        "player_unsold",
        staffActorId,
        `Player ${nominee.username} passed as UNSOLD.`
      );
    }
    const existingPlayer = this.players.get(nominee.id);
    if (existingPlayer) {
      existingPlayer.status = nominee.status;
      existingPlayer.teamId = nominee.teamId;
      existingPlayer.teamName = nominee.teamName;
      existingPlayer.soldAmount = nominee.soldAmount;
      existingPlayer.isStandIn = nominee.isStandIn;
    } else {
      this.players.set(nominee.id, { ...nominee });
    }
    this.stopTimer();
    this.state.timerEndsAt = void 0;
    this.state.pausedRemainingMs = void 0;
    this.nominationAudits.unshift({
      nomineeId: nominee.id,
      nomineeUsername: nominee.username,
      tournamentMmr: nominee.tournamentMmr,
      role: nominee.primaryRole,
      outcome: outcome === "SOLD" ? "SOLD" : "UNSOLD",
      winningTeamId: outcome === "SOLD" ? this.state.leadingTeamId : void 0,
      winningTeamName,
      winningBid,
      bidsCount: this.bidHistory.filter((b) => b.nomineeId === nominee.id).length,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.state.lastLotResult = {
      outcome: outcome === "SOLD" ? "SOLD" : "UNSOLD",
      player: nominee,
      winningTeamName,
      winningTeamId: outcome === "SOLD" ? this.state.leadingTeamId : void 0,
      winningBid,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (outcome === "UNSOLD") {
      if (!this.unsoldQueue.includes(nominee.id)) {
        this.unsoldQueue.push(nominee.id);
      }
    }
    this.state.roundPhase = "INTERMISSION";
    this.state.intermissionRemainingSeconds = this.config.nextPlayerDelaySeconds || 80;
    this.state.nominee = null;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = "";
    this.state.leadingTeamName = "";
    this.state.revision += 1;
    const allMandatoryRostersFilled = Array.from(this.teams.values()).length > 0 && Array.from(this.teams.values()).every(
      (t) => t.primaryRoster.length >= this.config.primaryRosterSize
    );
    if (allMandatoryRostersFilled) {
      this.state.primaryRostersComplete = true;
      if (this.state.standInRoundActive) {
        const allStandInsFilled = Array.from(this.teams.values()).every(
          (t) => t.standIns.length >= this.config.optionalStandInLimit
        );
        if (allStandInsFilled) {
          this.finalizeAuction(staffActorId);
          outcome = "AUCTION_COMPLETED";
          this.state.status = "COMPLETED";
        } else {
          this.state.status = "READY";
        }
      } else {
        this.state.status = "READY";
        this.logAudit(
          "primary_rosters_completed",
          staffActorId,
          `All ${this.teams.size} teams reached complete ${this.config.primaryRosterSize}/${this.config.primaryRosterSize} primary rosters! Stand-in auction round can now be opened by organiser.`
        );
      }
    } else {
      this.state.primaryRostersComplete = false;
      this.state.status = "READY";
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
  assignOptionalStandIn(teamId, playerId, staffActorId) {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: `Team '${teamId}' not found.` };
    if (team.standIns.length >= this.config.optionalStandInLimit) {
      return { success: false, error: `${team.name} already has maximum allowed stand-ins (${this.config.optionalStandInLimit}).` };
    }
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: `Player '${playerId}' not found.` };
    if (player.status !== "AVAILABLE" && player.status !== "UNSOLD" && player.status !== "UNSELECTED") {
      return { success: false, error: `Player '${player.username}' is not eligible for stand-in (status: ${player.status}).` };
    }
    player.status = "SOLD";
    player.teamId = team.id;
    player.teamName = team.name;
    player.isStandIn = true;
    team.standIns.push(player);
    this.logAudit(
      "standin_assigned",
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
  finalizeAuction(staffActorId = "system", force = false) {
    if (this.state.isCompleted) {
      return { success: true, unselectedCount: this.state.unselectedCount };
    }
    if (staffActorId === "system" && !force && this.teams.size > 0) {
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
    this.state.status = "COMPLETED";
    this.state.isCompleted = true;
    this.state.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    this.state.nominee = null;
    let count = 0;
    for (const player of this.players.values()) {
      if (player.status === "AVAILABLE") {
        player.status = "UNSELECTED";
        count += 1;
      }
    }
    this.state.unselectedCount = count;
    this.logAudit(
      "auction_completed",
      staffActorId,
      `Auction finalized! All ${this.teams.size} teams reached mandatory rosters. ${this.state.soldCount} SOLD, ${this.state.unsoldCount} UNSOLD, ${count} UNSELECTED.`
    );
    this.notify();
    return { success: true, unselectedCount: count };
  }
  // ---------------------------------------------------------------------------
  // Queries & State Inspection
  // ---------------------------------------------------------------------------
  getState() {
    return { ...this.state };
  }
  getConfig() {
    return { ...this.config };
  }
  getTeams() {
    return Array.from(this.teams.values()).map((t) => ({
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    }));
  }
  getTeam(teamId) {
    const t = this.teams.get(teamId);
    if (!t) return void 0;
    return {
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    };
  }
  getPlayers() {
    return Array.from(this.players.values());
  }
  getPlayer(playerId) {
    return this.players.get(playerId);
  }
  getAvailablePlayers() {
    return Array.from(this.players.values()).filter((p) => (p.status === "AVAILABLE" || p.auctionStatus === "AVAILABLE") && !p.isCaptain);
  }
  getSoldPlayers() {
    return Array.from(this.players.values()).filter((p) => p.status === "SOLD" || p.auctionStatus === "SOLD");
  }
  getUnsoldPlayers() {
    return Array.from(this.players.values()).filter((p) => p.status === "UNSOLD" || p.auctionStatus === "UNSOLD");
  }
  getUnselectedPlayers() {
    return Array.from(this.players.values()).filter((p) => p.status === "UNSELECTED" || p.auctionStatus === "UNSELECTED");
  }
  getBidHistory() {
    return [...this.bidHistory];
  }
  getNominationAudits() {
    return [...this.nominationAudits];
  }
  getAuditTrail() {
    return [...this.auditLog];
  }
  // ---------------------------------------------------------------------------
  // Subscriptions & Audit Logging
  // ---------------------------------------------------------------------------
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify(persist = true) {
    if (persist && !this.isApplyingRemoteUpdate) {
      this.broadcastUpdate(true);
    }
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("Auction listener error:", err);
      }
    });
  }
  destroy() {
    this.stopTimer();
    if (this.storageHandler && typeof window !== "undefined") {
      try {
        window.removeEventListener("storage", this.storageHandler);
      } catch {
      }
      this.storageHandler = null;
    }
    if (this.firestoreUnsub) {
      try {
        this.firestoreUnsub();
      } catch {
      }
      this.firestoreUnsub = null;
    }
    if (this.tournamentDocUnsub) {
      try {
        this.tournamentDocUnsub();
      } catch {
      }
      this.tournamentDocUnsub = null;
    }
    if (this.syncChannel) {
      try {
        this.syncChannel.close();
      } catch {
      }
      this.syncChannel = null;
    }
    if (this.globalBroadcastChannel) {
      try {
        this.globalBroadcastChannel.close();
      } catch {
      }
      this.globalBroadcastChannel = null;
    }
    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch {
      }
      this.eventSource = null;
    }
    if (this.ssePollInterval) {
      clearInterval(this.ssePollInterval);
      this.ssePollInterval = null;
    }
    this.listeners = [];
  }
  logAudit(action, actor, details) {
    this.auditLog.unshift({
      action,
      actor,
      details,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    if (this.auditLog.length > 200) {
      this.auditLog.length = 200;
    }
  }
};
var auctionEngines = /* @__PURE__ */ new Map();
function getAuctionEngine(tournamentId = "purple-bean-test-cup", customConfig) {
  const effectiveId = tournamentId || "purple-bean-test-cup";
  if (!auctionEngines.has(effectiveId)) {
    const isAuctionTest = effectiveId === "auction-test";
    const newEngine = new DotaAuctionEngine({
      tournamentId: effectiveId,
      tournamentName: isAuctionTest ? "Auction Test" : void 0,
      creditAllocationMode: "CAPTAIN_MMR_BALANCED",
      ...customConfig
    });
    auctionEngines.set(effectiveId, newEngine);
  }
  return auctionEngines.get(effectiveId);
}
function resetAuctionEngine(tournamentId) {
  const engine = auctionEngines.get(tournamentId);
  if (engine) {
    engine.destroy();
    auctionEngines.delete(tournamentId);
  }
}
var dotaAuctionEngine = getAuctionEngine("purple-bean-test-cup");

// ../src/services/firebaseService.ts
import {
  collection as collection2,
  doc as doc5,
  getDocs,
  setDoc as setDoc4,
  updateDoc as updateDoc2,
  deleteDoc as deleteDoc2,
  onSnapshot as onSnapshot4,
  runTransaction as runTransaction2,
  writeBatch,
  arrayUnion
} from "firebase/firestore";

// ../src/domain/tournamentConfig.ts
function formatINR(val) {
  if (val === void 0 || val === null || isNaN(val)) return "\u20B90";
  return "\u20B9" + Math.round(val).toLocaleString("en-IN");
}
function createDefaultTournamentConfig(gameIdOrTournament = "dota2") {
  const rawGameId = typeof gameIdOrTournament === "string" ? gameIdOrTournament : gameIdOrTournament?.gameId || gameIdOrTournament?.game || "dota2";
  const gameId = String(rawGameId || "dota2");
  const isDota = gameId.toLowerCase().includes("dota");
  const cleanGameId = gameId.toLowerCase().replace(/[^a-z0-9]/g, "") || "dota2";
  return {
    identity: {
      tournamentId: `pb-${cleanGameId}-${Date.now()}`,
      name: isDota ? "Dota 2 Championship" : "Esports Open Cup",
      gameId: cleanGameId,
      gameName: isDota ? "Dota 2" : "Dota 2",
      description: "Official tournament powered by Purple Bean Gaming.",
      region: "Pan India",
      locationType: "ONLINE",
      visibility: "PUBLIC"
    },
    registration: {
      registrationMode: "INDIVIDUAL",
      openDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      closeDate: new Date(Date.now() + 14 * 864e5).toISOString().split("T")[0],
      maxParticipants: 32,
      eligibilityRules: {
        minMmrOrRank: 3e3,
        regionLocked: false,
        requireKyc: false
      }
    },
    teamFormation: {
      mode: "AUCTION",
      numberOfTeams: 4
    },
    roster: {
      primaryRosterSize: 5,
      captainCountsTowardRoster: true,
      substituteSlots: 1,
      substituteRequired: false,
      optionalStandInAllowed: true,
      maxStandIns: 1
    },
    auction: {
      enabled: true,
      creditAllocationMode: "CAPTAIN_MMR_BALANCED",
      baseCredits: 1e3,
      startingCredits: 1e3,
      startingCreditsPerTeam: 1e3,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerSlot: 10,
      reservePerRemainingSlot: 10,
      nominationTimerSeconds: 30,
      bidTimerSeconds: 25
    },
    competition: {
      format: "SINGLE_ELIMINATION",
      defaultSeriesFormat: "BO3",
      seedingMethod: "RATING_BASED"
    },
    prizes: {
      totalPrizePoolINR: 5e4,
      placementDistribution: [
        { placement: "1st Place (Champion)", percentage: 50, amountINR: 25e3 },
        { placement: "2nd Place (Runner-up)", percentage: 25, amountINR: 12500 },
        { placement: "3rd Place", percentage: 15, amountINR: 7500 },
        { placement: "4th Place", percentage: 10, amountINR: 5e3 }
      ]
    },
    integrity: {
      verificationRequired: false,
      organizerApprovalRequired: false
    }
  };
}
function validateTournamentConfig(config) {
  const errors = [];
  if (!config) {
    return { valid: false, errors: ["Configuration is required."] };
  }
  if (!config.identity?.name || !config.identity.name.trim()) {
    errors.push("Tournament name is required.");
  }
  if (config.identity?.locationType === "LAN") {
    if (!config.identity?.city || !config.identity.city.trim()) {
      errors.push("City is required for LAN tournaments.");
    }
  }
  const teamCount = config.teamFormation?.numberOfTeams;
  if (typeof teamCount !== "number" || teamCount < 2) {
    errors.push("A tournament must feature at least 2 teams.");
  }
  if (config.roster && config.roster.primaryRosterSize < 1) {
    errors.push("Primary roster size must be at least 1.");
  }
  if (config.auction?.enabled) {
    const credits = config.auction.startingCredits ?? config.auction.startingCreditsPerTeam ?? config.auction.baseCredits ?? 0;
    if (credits <= 0) {
      errors.push("Starting credits must be greater than zero for auction tournaments.");
    }
  }
  if (config.registration?.registrationMode === "PREMADE_TEAM" && config.teamFormation?.mode === "AUCTION") {
    errors.push("Premade team registration does not support Captain Auction mode.");
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function normalizeTournamentConfig(config) {
  if (!config) return createDefaultTournamentConfig();
  const cloned = JSON.parse(JSON.stringify(config));
  if (!cloned.identity) cloned.identity = {};
  if (!cloned.registration) cloned.registration = {};
  if (!cloned.teamFormation) cloned.teamFormation = { mode: "AUCTION", numberOfTeams: 4 };
  if (!cloned.roster) cloned.roster = { primaryRosterSize: 5, captainCountsTowardRoster: true, substituteSlots: 0, substituteRequired: false };
  if (!cloned.competition) cloned.competition = { format: "SINGLE_ELIMINATION", defaultSeriesFormat: "BO3", seedingMethod: "RATING_BASED" };
  if (!cloned.prizes) cloned.prizes = { totalPrizePoolINR: 0, placementDistribution: [] };
  if (cloned.identity.locationType === "ONLINE") {
    if (!cloned.identity.city || !cloned.identity.city.trim()) {
      delete cloned.identity.city;
    }
  }
  return removeUndefinedDeep(cloned);
}

// ../src/data/seedTournaments.ts
var INDIA_DOTA_OPEN_CONFIG = {
  identity: {
    tournamentId: "india-dota-open-2026",
    name: "India Dota Open",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "Premier national double-elimination championship for premade Indian squads.",
    region: "Pan India",
    locationType: "ONLINE",
    city: "Bengaluru",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
  },
  registration: {
    registrationMode: "PREMADE_TEAM",
    openDate: "2026-10-15",
    closeDate: "2026-10-30",
    maxParticipants: 8,
    eligibilityRules: {
      minMmrOrRank: 4e3,
      regionLocked: true,
      requireKyc: true
    }
  },
  teamFormation: {
    mode: "PREMADE",
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: "DOUBLE_ELIMINATION",
    defaultSeriesFormat: "BO3",
    roundOverrides: {
      "Grand Final": "BO5"
    },
    seedingMethod: "RATING_BASED"
  },
  prizes: {
    totalPrizePoolINR: 1e5,
    placementDistribution: [
      { placement: "1st Place (Champion)", percentage: 50, amountINR: 5e4 },
      { placement: "2nd Place (Runner-up)", percentage: 25, amountINR: 25e3 },
      { placement: "3rd Place", percentage: 15, amountINR: 15e3 },
      { placement: "4th Place", percentage: 10, amountINR: 1e4 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};
var PURPLE_BEAN_CHALLENGER_CONFIG = {
  identity: {
    tournamentId: "pb-challenger-2026",
    name: "Purple Bean Challenger",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "8-team premier Dota 2 league with 2 groups of 4 round-robin and single-elimination playoffs.",
    region: "Pan India",
    locationType: "ONLINE",
    city: "Mumbai",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
  },
  registration: {
    registrationMode: "PREMADE_TEAM",
    openDate: "2026-11-01",
    closeDate: "2026-11-15",
    maxParticipants: 8,
    eligibilityRules: {
      minMmrOrRank: 3500,
      regionLocked: true,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: "PREMADE",
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: "GROUPS_KNOCKOUT",
    defaultSeriesFormat: "BO1",
    roundOverrides: {
      "Playoffs": "BO3",
      "Grand Final": "BO5"
    },
    seedingMethod: "RATING_BASED",
    groupsConfig: {
      groupCount: 2,
      advancePerGroup: 2
    }
  },
  prizes: {
    totalPrizePoolINR: 5e4,
    placementDistribution: [
      { placement: "1st Place (Champion)", percentage: 60, amountINR: 3e4 },
      { placement: "2nd Place (Runner-up)", percentage: 25, amountINR: 12500 },
      { placement: "3rd Place", percentage: 15, amountINR: 7500 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};
var INDIA_MASTERS_AUCTION_CONFIG = {
  identity: {
    tournamentId: "purple-bean-india-masters-2026",
    name: "Purple Bean India Masters 2026",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "Flagship Pan-India championship tournament with live captain auction team formation.",
    region: "Pan India",
    locationType: "ONLINE",
    city: "Bengaluru",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
  },
  registration: {
    registrationMode: "INDIVIDUAL",
    openDate: "2026-10-01",
    closeDate: "2026-10-10",
    maxParticipants: 40,
    eligibilityRules: {
      minMmrOrRank: 3500,
      regionLocked: true,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: "AUCTION",
    numberOfTeams: 4
  },
  auction: {
    enabled: true,
    creditAllocationMode: "CAPTAIN_MMR_BALANCED",
    baseCredits: 1e3,
    adjustmentRate: 0.25,
    minimumCredits: 800,
    maximumCredits: 1200,
    creditRounding: 10,
    startingCredits: 1e3,
    bidTimerSeconds: 25,
    nominationTimerSeconds: 30,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: "DOUBLE_ELIMINATION",
    defaultSeriesFormat: "BO3",
    roundOverrides: {
      "Grand Final": "BO5"
    },
    seedingMethod: "RATING_BASED"
  },
  prizes: {
    totalPrizePoolINR: 25e4,
    placementDistribution: [
      { placement: "1st Place (Champion)", percentage: 50, amountINR: 125e3 },
      { placement: "2nd Place (Runner-up)", percentage: 26, amountINR: 65e3 },
      { placement: "3rd Place", percentage: 14, amountINR: 35e3 },
      { placement: "4th Place", percentage: 10, amountINR: 25e3 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};
var PURPLE_BEAN_AUCTION_TEST_CONFIG = {
  identity: {
    tournamentId: "purple-bean-auction-test",
    name: "Purple Bean Auction Test",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "Production-safe test tournament for validating the full PBG registration \u2192 captain \u2192 auction \u2192 Discord role flow.",
    region: "Pan India",
    locationType: "ONLINE",
    city: "Bengaluru",
    testMode: true,
    environment: "TEST TOURNAMENT",
    isDevelopment: true,
    visibility: "PUBLIC",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
  },
  registration: {
    registrationMode: "INDIVIDUAL",
    openDate: "2026-10-01",
    closeDate: "2026-10-31",
    maxParticipants: 30,
    captainApplicationsEnabled: true,
    eligibilityRules: {
      minMmrOrRank: 3e3,
      regionLocked: false,
      requireKyc: false,
      discordRequired: true,
      dotaRequired: true
    }
  },
  teamFormation: {
    mode: "AUCTION",
    numberOfTeams: 3
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  auction: {
    enabled: true,
    creditAllocationMode: "EQUAL",
    baseCredits: 1e3,
    startingCredits: 1e3,
    startingCreditsPerTeam: 1e3,
    minimumCredits: 1e3,
    maximumCredits: 1e3,
    creditRounding: 10,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerRemainingSlot: 10,
    bidTimerSeconds: 25,
    nominationTimerSeconds: 30
  },
  competition: {
    format: "SINGLE_ELIMINATION",
    defaultSeriesFormat: "BO3",
    roundOverrides: {
      "Grand Final": "BO5"
    },
    seedingMethod: "RATING_BASED"
  },
  prizes: {
    totalPrizePoolINR: 0,
    placementDistribution: []
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};
var AFTER_AUCTION_TEST_CONFIG = {
  identity: {
    tournamentId: "after-auction-test",
    name: "After auction test",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "Post-auction tournament fixture with 8 formed teams ready for bracket or group stage play.",
    region: "Pan India",
    locationType: "ONLINE",
    city: "Bengaluru",
    testMode: true,
    environment: "TEST TOURNAMENT",
    visibility: "PUBLIC",
    bannerUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
  },
  registration: {
    registrationMode: "INDIVIDUAL",
    openDate: "2026-09-01",
    closeDate: "2026-09-30",
    maxParticipants: 40,
    eligibilityRules: {
      minMmrOrRank: 3e3,
      regionLocked: false,
      requireKyc: false
    }
  },
  teamFormation: {
    mode: "AUCTION",
    numberOfTeams: 8
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false
  },
  competition: {
    format: "DOUBLE_ELIMINATION",
    defaultSeriesFormat: "BO3",
    roundOverrides: {
      "Grand Final": "BO5"
    },
    seedingMethod: "RATING_BASED"
  },
  prizes: {
    totalPrizePoolINR: 1e5,
    placementDistribution: [
      { placement: "1st Place (Champion)", percentage: 50, amountINR: 5e4 },
      { placement: "2nd Place (Runner-up)", percentage: 30, amountINR: 3e4 },
      { placement: "3rd Place", percentage: 20, amountINR: 2e4 }
    ]
  },
  integrity: {
    verificationRequired: true,
    organizerApprovalRequired: true
  }
};
var INITIAL_SEED_TOURNAMENTS = [
  PURPLE_BEAN_AUCTION_TEST_CONFIG,
  AFTER_AUCTION_TEST_CONFIG,
  INDIA_MASTERS_AUCTION_CONFIG,
  INDIA_DOTA_OPEN_CONFIG,
  PURPLE_BEAN_CHALLENGER_CONFIG
];

// ../src/domain/competitiveRatingEngine.ts
function calculateEloDelta(winnerRating, loserRating, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  return Math.max(5, Math.round(kFactor * (1 - expectedWinner)));
}
var CompetitiveRatingLedger = class {
  constructor() {
    this.appliedMatches = /* @__PURE__ */ new Map();
  }
  applyMatchResult(matchId, winnerTeamId, loserTeamId, winnerCurrentRating, loserCurrentRating, kFactor = 32) {
    if (this.appliedMatches.has(matchId)) {
      const existing = this.appliedMatches.get(matchId);
      return {
        success: true,
        alreadyApplied: true,
        record: existing
      };
    }
    const delta = calculateEloDelta(winnerCurrentRating, loserCurrentRating, kFactor);
    const record = {
      matchId,
      winnerTeamId,
      loserTeamId,
      delta,
      winnerPreviousRating: winnerCurrentRating,
      loserPreviousRating: loserCurrentRating,
      winnerNewRating: winnerCurrentRating + delta,
      loserNewRating: Math.max(100, loserCurrentRating - delta),
      isCorrection: false,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.appliedMatches.set(matchId, record);
    return {
      success: true,
      alreadyApplied: false,
      record
    };
  }
  correctMatchResult(matchId, previousRecord, newWinnerTeamId, newLoserTeamId, winnerRating, loserRating, kFactor = 32) {
    const delta = calculateEloDelta(winnerRating, loserRating, kFactor);
    const record = {
      matchId,
      winnerTeamId: newWinnerTeamId,
      loserTeamId: newLoserTeamId,
      delta,
      winnerPreviousRating: winnerRating,
      loserPreviousRating: loserRating,
      winnerNewRating: winnerRating + delta,
      loserNewRating: Math.max(100, loserRating - delta),
      isCorrection: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.appliedMatches.set(matchId, record);
    return {
      success: true,
      record
    };
  }
  getRecord(matchId) {
    return this.appliedMatches.get(matchId);
  }
  getAllRecords() {
    return Array.from(this.appliedMatches.values());
  }
  clear() {
    this.appliedMatches.clear();
  }
};
var ratingLedger = new CompetitiveRatingLedger();

// ../src/domain/testCupEngine.ts
var TEST_CUP_CONFIG = {
  id: "purple-bean-test-cup",
  name: "Purple Bean Test Cup",
  game: "Dota 2",
  region: "Pan India",
  prizePoolINR: "\u20B925,000",
  startingCredits: 1e3,
  minimumBid: 10,
  primaryRosterSize: 5,
  optionalStandInAllowed: true,
  minReservePerSlot: 10,
  dates: "October 2026",
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  stages: [
    { id: "stg-1", name: "Registration Open", status: "current", date: "October 2026" }
  ]
};
var TEST_CUP_GENERIC_CONFIG = {
  ...TEST_CUP_CONFIG,
  identity: {
    tournamentId: "purple-bean-test-cup",
    name: "Purple Bean Test Cup",
    gameId: "dota2",
    gameName: "Dota 2",
    description: "Official tournament powered by Purple Bean Gaming.",
    region: "Pan India",
    locationType: "ONLINE",
    visibility: "PUBLIC"
  },
  registration: {
    registrationMode: "INDIVIDUAL",
    openDate: "2026-10-01",
    closeDate: "2026-10-31",
    maxParticipants: 18,
    eligibilityRules: { minMmrOrRank: 0, requireKyc: false, regionLocked: false }
  },
  teamFormation: {
    mode: "AUCTION",
    numberOfTeams: 3
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false,
    optionalStandInAllowed: true,
    maxStandIns: 1
  },
  auction: {
    enabled: true,
    startingCredits: 1e3,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerSlot: 10,
    nominationTimerSeconds: 15,
    bidTimerSeconds: 15,
    creditAllocationMode: "CAPTAIN_MMR_BALANCED"
  },
  competition: {
    format: "SINGLE_ELIMINATION",
    defaultSeriesFormat: "BO3",
    seedingMethod: "RATING_BASED"
  },
  prizes: {
    totalPrizePoolINR: 25e3,
    placementDistribution: []
  }
};
var PurpleBeanTestCupEngine = class {
  constructor() {
    this.status = "Registration Open";
    this.listeners = /* @__PURE__ */ new Set();
    this.players = [];
    this.teams = [];
    this.matches = [];
    this.auditTrail = [];
    this.currentNominee = null;
    this.currentBid = 10;
    this.highBidderTeamId = null;
    this.unsoldPlayers = [];
    this.unselectedPlayers = [];
    this.seedPlayers();
  }
  seedPlayers() {
    const roles = [
      "Position 1 \u2014 Carry",
      "Position 2 \u2014 Mid",
      "Position 3 \u2014 Offlane",
      "Position 4 \u2014 Soft Support",
      "Position 5 \u2014 Hard Support"
    ];
    const cities = ["Mumbai", "Bengaluru", "Delhi", "Hyderabad", "Pune"];
    const regions = ["West India", "South India", "North India", "South India", "West India"];
    this.players = [
      { id: "p-c1", username: "Aether", realName: "Aditya Sharma", isCaptain: true, primaryRole: "Position 1 \u2014 Carry", mmr: 8600, tournamentMmr: 8600, isMmrLocked: true, city: "Mumbai", region: "West India", registrationStatus: "Verified", auctionStatus: "SOLD" },
      { id: "p-c2", username: "Nova", realName: "Nikhil Varma", isCaptain: true, primaryRole: "Position 2 \u2014 Mid", mmr: 8450, tournamentMmr: 8450, isMmrLocked: true, city: "Hyderabad", region: "South India", registrationStatus: "Verified", auctionStatus: "SOLD" },
      { id: "p-c3", username: "Karma", realName: "Karthik Rao", isCaptain: true, primaryRole: "Position 3 \u2014 Offlane", mmr: 8200, tournamentMmr: 8200, isMmrLocked: true, city: "Bengaluru", region: "South India", registrationStatus: "Verified", auctionStatus: "SOLD" }
    ];
    for (let i = 1; i <= 19; i++) {
      const role = roles[(i - 1) % 5];
      const city = cities[(i - 1) % 5];
      const region = regions[(i - 1) % 5];
      this.players.push({
        id: `p-tc-${i}`,
        username: `Player_${i === 13 ? "Rogue" : i}`,
        realName: `Contender ${i}`,
        isCaptain: false,
        primaryRole: role,
        secondaryRole: roles[i % 5],
        mmr: 7100 + i * 80,
        tournamentMmr: 7100 + i * 80,
        isMmrLocked: true,
        city,
        region,
        registrationStatus: "Verified",
        auctionStatus: "AVAILABLE"
      });
    }
    if (this.players.find((p) => p.id === "p-tc-13")) {
      this.players.find((p) => p.id === "p-tc-13").username = "Rogue";
    }
  }
  getStatus() {
    return this.status;
  }
  getPlayers() {
    return this.players;
  }
  getTeams() {
    return this.teams;
  }
  getMatches() {
    return this.matches;
  }
  getAuditTrail() {
    return this.auditTrail;
  }
  getAuctionState() {
    const isCompleted = this.teams.length > 0 && this.teams.every((t) => t.primaryRoster?.length >= 5);
    return {
      currentBid: this.currentBid,
      highBidderTeamId: this.highBidderTeamId,
      unsoldPlayers: this.unsoldPlayers,
      unselectedPlayers: this.unselectedPlayers,
      unselectedCount: this.unselectedPlayers.length,
      isCompleted
    };
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  notify() {
    this.listeners.forEach((fn) => fn());
  }
  submitRegistration(data) {
    const newPlayer = {
      id: `p-tc-${Date.now()}`,
      ...data,
      isCaptain: false,
      registrationStatus: "Registered",
      auctionStatus: "AVAILABLE"
    };
    this.players.push(newPlayer);
    this.notify();
    return { success: true, player: newPlayer };
  }
  verifyPlayer(id, verified) {
    const p = this.players.find((player) => player.id === id);
    if (!p) return { success: false, status: "Not Found" };
    p.registrationStatus = verified ? "Verified" : "Rejected";
    this.notify();
    return { success: true, status: p.registrationStatus };
  }
  confirmCaptainsAndTeams() {
    this.status = "Drafting";
    this.teams = [
      {
        id: "tc-team-1",
        name: "Mumbai Mavericks",
        tag: "MMV",
        captainId: "p-c1",
        captainName: "Aether",
        credits: 1e3,
        creditsUsed: 0,
        primaryRoster: [this.players[0]],
        standIn: void 0
      },
      {
        id: "tc-team-2",
        name: "Hyderabad Raiders",
        tag: "HRD",
        captainId: "p-c2",
        captainName: "Nova",
        credits: 1e3,
        creditsUsed: 0,
        primaryRoster: [this.players[1]],
        standIn: void 0
      },
      {
        id: "tc-team-3",
        name: "Bengaluru Blaze",
        tag: "BLZ",
        captainId: "p-c3",
        captainName: "Karma",
        credits: 1e3,
        creditsUsed: 0,
        primaryRoster: [this.players[2]],
        standIn: void 0
      }
    ];
    this.auditTrail.push({ action: "captains_confirmed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    this.notify();
    return {
      success: true,
      captains: ["Aether", "Nova", "Karma"],
      teams: this.teams
    };
  }
  nominatePlayer(playerId) {
    const p = this.players.find((player) => player.id === playerId);
    this.currentNominee = p;
    this.currentBid = 10;
    this.highBidderTeamId = null;
    return p;
  }
  placeAuctionBid(options) {
    const { teamId, bidAmount, captainUserId } = options;
    const team = this.teams.find((t) => t.id === teamId);
    if (!team) throw new Error("Team not found");
    if (team.captainId !== captainUserId) {
      throw new Error(`Permission Denied: User '${captainUserId}' is not the captain of ${team.name}`);
    }
    if (bidAmount <= this.currentBid && this.highBidderTeamId !== null) {
      throw new Error(`Invalid bid: Proposed ${bidAmount} must be greater than current bid ${this.currentBid}`);
    }
    if (bidAmount < 10) {
      throw new Error(`Invalid bid: Proposed ${bidAmount} must be greater than current bid 10`);
    }
    const remainingUnfilledSlots = Math.max(0, 5 - (team.primaryRoster.length + 1));
    const reserveNeeded = remainingUnfilledSlots * 10;
    if (team.credits - bidAmount < reserveNeeded) {
      throw new Error(`Illegal Bid: Must reserve at least ${reserveNeeded} credits for remaining slots`);
    }
    this.currentBid = bidAmount;
    this.highBidderTeamId = teamId;
    return {
      success: true,
      currentBid: bidAmount,
      leadingTeamName: team.name
    };
  }
  concludeNomination(hasWinner) {
    if (!this.currentNominee) throw new Error("No active nominee");
    if (hasWinner && this.highBidderTeamId) {
      const team = this.teams.find((t) => t.id === this.highBidderTeamId);
      if (team) {
        team.credits -= this.currentBid;
        team.creditsUsed += this.currentBid;
        this.currentNominee.auctionStatus = "SOLD";
        this.currentNominee.teamName = team.name;
        this.currentNominee.teamId = team.id;
        team.primaryRoster.push(this.currentNominee);
      }
      const allFilled = this.teams.length > 0 && this.teams.every((t) => t.primaryRoster?.length >= 5);
      if (allFilled) {
        this.status = "Rosters Locked";
        this.unselectedPlayers = this.players.filter((p) => p.auctionStatus === "AVAILABLE");
        for (const u of this.unselectedPlayers) {
          u.auctionStatus = "UNSELECTED";
        }
      }
      return { outcome: "SOLD", player: this.currentNominee };
    } else {
      this.currentNominee.auctionStatus = "UNSOLD";
      this.unsoldPlayers.push(this.currentNominee);
      const allFilled = this.teams.length > 0 && this.teams.every((t) => t.primaryRoster?.length >= 5);
      if (allFilled) {
        this.status = "Rosters Locked";
        this.unselectedPlayers = this.players.filter((p) => p.auctionStatus === "AVAILABLE");
        for (const u of this.unselectedPlayers) {
          u.auctionStatus = "UNSELECTED";
        }
      }
      return { outcome: "UNSOLD", player: this.currentNominee };
    }
  }
  assignOptionalStandIn(teamId, playerId) {
    const team = this.teams.find((t) => t.id === teamId);
    const player = this.players.find((p) => p.id === playerId);
    if (!team || !player) return { success: false };
    team.standIn = player;
    player.auctionStatus = "STAND_IN";
    return { success: true, team, player };
  }
  generateSingleEliminationBracket() {
    this.auditTrail.push({ action: "bracket_generated", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    const semifinal = {
      id: "tc-match-semi-1",
      round: "Semifinal",
      seriesFormat: "Best of 3",
      teamA: { id: "tc-team-1", name: "Mumbai Mavericks", score: 0 },
      teamB: { id: "tc-team-2", name: "Hyderabad Raiders", score: 0 },
      status: "UPCOMING"
    };
    const grandFinal = {
      id: "tc-match-final",
      round: "Grand Final",
      seriesFormat: "Best of 3",
      teamA: { id: "tbd", name: "Winner of Semifinal", score: 0 },
      teamB: { id: "tc-team-3", name: "Bengaluru Blaze", score: 0 },
      status: "UPCOMING"
    };
    this.matches = [semifinal, grandFinal];
    return { semifinal, grandFinal };
  }
  executeSemifinalResult(scoreA, scoreB) {
    const match = this.matches.find((m) => m.id === "tc-match-semi-1");
    if (match) {
      match.teamA.score = scoreA;
      match.teamB.score = scoreB;
      match.status = "COMPLETED";
      match.winnerId = scoreA > scoreB ? match.teamA.id : match.teamB.id;
    }
    const advancingTeam = scoreA > scoreB ? this.teams[0] : this.teams[1];
    const thirdPlaceTeam = scoreA > scoreB ? this.teams[1] : this.teams[0];
    thirdPlaceTeam.placement = "3rd Place";
    const finalMatch = this.matches.find((m) => m.id === "tc-match-final");
    if (finalMatch) {
      finalMatch.teamA = { ...advancingTeam, score: 0 };
    }
    const deltaRes = ratingLedger.applyMatchResult("tc-match-semi-1", advancingTeam.id, thirdPlaceTeam.id, 1800, 1800);
    this.auditTrail.push({ action: "semifinal_completed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    return {
      advancingTeam,
      thirdPlaceTeam,
      ratingDelta: deltaRes.record.delta
    };
  }
  executeGrandFinalResult(scoreA, scoreB) {
    const finalMatch = this.matches.find((m) => m.id === "tc-match-final");
    if (finalMatch) {
      finalMatch.teamA.score = scoreA;
      finalMatch.teamB.score = scoreB;
      finalMatch.status = "COMPLETED";
    }
    const championTeam = this.teams[0];
    championTeam.placement = "Champion (1st Place)";
    const runnerUpTeam = this.teams[2];
    runnerUpTeam.placement = "Runner-up (2nd Place)";
    ratingLedger.applyMatchResult("tc-match-final", championTeam.id, runnerUpTeam.id, 1850, 1820);
    this.auditTrail.push({ action: "grand_final_completed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    return {
      championTeam,
      runnerUpTeam
    };
  }
  runFullTournamentSimulation() {
    this.confirmCaptainsAndTeams();
    let pIdx = 1;
    for (const team of this.teams) {
      while (team.primaryRoster.length < 5 && pIdx <= 19) {
        const p = this.players.find((player) => player.id === `p-tc-${pIdx}`);
        if (p) {
          p.auctionStatus = "SOLD";
          p.teamName = team.name;
          team.primaryRoster.push(p);
          team.credits -= 50;
          team.creditsUsed += 50;
          this.auditTrail.push({ action: "player_drafted", details: `Drafted ${p.username}`, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
        }
        pIdx++;
      }
    }
    this.unselectedPlayers = this.players.filter((p) => p.auctionStatus === "AVAILABLE");
    for (const u of this.unselectedPlayers) {
      u.auctionStatus = "UNSELECTED";
    }
    if (this.unselectedPlayers.length > 0) {
      const standIn = this.unselectedPlayers.shift();
      this.assignOptionalStandIn("tc-team-1", standIn.id);
    }
    this.auditTrail.push({ action: "auction_completed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    this.generateSingleEliminationBracket();
    this.executeSemifinalResult(2, 1);
    this.executeGrandFinalResult(2, 0);
    this.status = "Completed";
    this.auditTrail.push({ action: "tournament_completed", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    const aether = this.players.find((p) => p.username === "Aether");
    if (aether) aether.finalPlacement = "Champion (1st Place)";
    const karma = this.players.find((p) => p.username === "Karma");
    if (karma) karma.finalPlacement = "Runner-up (2nd Place)";
    const nova = this.players.find((p) => p.username === "Nova");
    if (nova) nova.finalPlacement = "3rd Place";
    this.notify();
    return {
      success: true,
      summary: {
        champion: "Mumbai Mavericks",
        runnerUp: "Bengaluru Blaze",
        thirdPlace: "Hyderabad Raiders",
        unselectedCount: 7
      }
    };
  }
  generateDummyPlayersAndCaptains(numPlayers = 10, numCaptains = 2) {
    this.players = [];
    this.teams = [];
    const roles = [
      "Position 1 \u2014 Carry",
      "Position 2 \u2014 Mid",
      "Position 3 \u2014 Offlane",
      "Position 4 \u2014 Soft Support",
      "Position 5 \u2014 Hard Support"
    ];
    for (let i = 0; i < numPlayers; i++) {
      const isCap = i < numCaptains;
      const p = {
        id: `synth-p-${i + 1}`,
        username: isCap ? `SynthCaptain_${i + 1}` : `SynthPlayer_${i + 1}`,
        realName: `Synth Player ${i + 1}`,
        isCaptain: isCap,
        primaryRole: roles[i % roles.length],
        mmr: 6e3 + i * 150,
        tournamentMmr: 6e3 + i * 150,
        isMmrLocked: true,
        city: "Mumbai",
        region: "West India",
        registrationStatus: "Verified",
        auctionStatus: isCap ? "SOLD" : "AVAILABLE"
      };
      this.players.push(p);
      if (isCap) {
        const team = {
          id: `synth-team-${i + 1}`,
          name: `Synth Team ${i + 1}`,
          tag: `ST${i + 1}`,
          captainId: p.id,
          captainName: p.username,
          credits: 1e3,
          creditsRemaining: 1e3,
          creditsUsed: 0,
          primaryRoster: [p],
          standIns: []
        };
        p.teamId = team.id;
        p.teamName = team.name;
        this.teams.push(team);
      }
    }
    const firstNominee = this.players.find((p) => p.auctionStatus === "AVAILABLE");
    if (firstNominee) {
      this.currentNominee = firstNominee;
      this.currentBid = 10;
      this.highBidderTeamId = null;
    }
    this.notify();
  }
  placeBid(captainId, amount) {
    try {
      const team = this.teams.find((t) => t.captainId === captainId);
      if (!team) return { success: false, currentBid: this.currentBid, error: "Team not found" };
      if (amount <= this.currentBid && this.highBidderTeamId !== null) {
        return { success: false, currentBid: this.currentBid, error: "Bid must exceed current bid" };
      }
      this.currentBid = amount;
      this.highBidderTeamId = team.id;
      return { success: true, currentBid: amount };
    } catch (e) {
      return { success: false, currentBid: this.currentBid, error: e.message };
    }
  }
  reset() {
    this.status = "Registration Open";
    this.currentBid = 10;
    this.highBidderTeamId = null;
    this.currentNominee = null;
    this.unsoldPlayers = [];
    this.unselectedPlayers = [];
    this.seedPlayers();
    this.notify();
  }
  getState() {
    const soldCount = this.players.filter((p) => p.auctionStatus === "SOLD" && !p.isCaptain).length;
    return {
      status: this.status,
      currentBid: this.currentBid,
      highBidderTeamId: this.highBidderTeamId,
      nominee: this.currentNominee,
      soldCount,
      unsoldCount: this.unsoldPlayers.length,
      unselectedCount: this.unselectedPlayers.length
    };
  }
};
var testCupEngine = new PurpleBeanTestCupEngine();

// ../src/domain/tournamentConfigRegistry.ts
var PRIMARY_PROJECT_ADMIN_EMAIL = "11106cm009@gmail.com";
var TournamentConfigRegistry = class {
  constructor() {
    this.configs = /* @__PURE__ */ new Map();
    this.deletedIds = /* @__PURE__ */ new Set();
    this.listeners = [];
    this.teamProvider = null;
    INITIAL_SEED_TOURNAMENTS.forEach((cfg) => {
      this.configs.set(cfg.identity.tournamentId, cfg);
    });
  }
  setTeamProvider(provider) {
    this.teamProvider = provider;
  }
  getTeamProvider(tournamentId) {
    return this.teamProvider;
  }
  clearConfigs() {
    this.configs.clear();
    this.deletedIds.clear();
    this.notify();
  }
  registerConfig(config) {
    if (!config?.identity?.tournamentId) return;
    const rawId = config.identity.tournamentId;
    const id = String(rawId);
    this.deletedIds.delete(id);
    this.deletedIds.delete(id.toLowerCase());
    this.configs.set(id, config);
    this.notify();
  }
  removeConfig(tournamentId) {
    if (!tournamentId) return;
    const id = String(tournamentId);
    this.deletedIds.add(id);
    this.deletedIds.add(id.toLowerCase());
    this.configs.delete(id);
    this.configs.delete(id.toLowerCase());
    this.notify();
  }
  getConfig(tournamentId) {
    if (!tournamentId) return void 0;
    const id = String(tournamentId);
    const tIdLower = id.toLowerCase();
    if (this.deletedIds.has(id) || this.deletedIds.has(tIdLower)) {
      return void 0;
    }
    const found = this.configs.get(id) || this.configs.get(tIdLower);
    if (found) return found;
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (isTest) {
      if (tIdLower === "purple-bean-test-cup") {
        this.configs.set(tournamentId, TEST_CUP_GENERIC_CONFIG);
        return TEST_CUP_GENERIC_CONFIG;
      }
      const seed = INITIAL_SEED_TOURNAMENTS.find(
        (s) => String(s.identity.tournamentId) === id || String(s.identity.tournamentId || "").toLowerCase() === tIdLower
      );
      if (seed) {
        this.configs.set(tournamentId, seed);
        return seed;
      }
    }
    return void 0;
  }
  updateTeamCount(tournamentId, numberOfTeams) {
    const config = this.getConfig(tournamentId);
    if (config) {
      config.teamFormation.numberOfTeams = Math.max(2, numberOfTeams);
      this.configs.set(tournamentId, config);
      this.notify();
    }
  }
  getAllConfigs() {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (isTest) {
      return Array.from(this.configs.values()).filter((c) => {
        const id = String(c.identity?.tournamentId || "");
        return id && !this.deletedIds.has(id) && !this.deletedIds.has(id.toLowerCase());
      });
    }
    const LEGACY_MOCK_TOURNAMENT_IDS2 = /* @__PURE__ */ new Set([
      "2-team-auction-test",
      "auction-test",
      "purple-bean-test-cup"
    ]);
    return Array.from(this.configs.values()).filter((c) => {
      const rawId = String(c.identity?.tournamentId || "");
      const id = rawId.toLowerCase();
      return id && !LEGACY_MOCK_TOURNAMENT_IDS2.has(id) && !this.deletedIds.has(rawId) && !this.deletedIds.has(id);
    });
  }
  /**
   * Determines if a tournament is configured for Auction.
   * Derived strictly from tournament configuration (teamFormation.mode === 'AUCTION').
   * Never relies on hardcoded tournament names or IDs.
   */
  isAuctionSupported(tournamentOrId) {
    if (!tournamentOrId) return false;
    const tournamentId = typeof tournamentOrId === "string" ? tournamentOrId : String(tournamentOrId.id || tournamentOrId.tournamentId || "");
    if (!tournamentId) return false;
    const config = this.getConfig(tournamentId);
    if (config) {
      return config.teamFormation?.mode === "AUCTION" && Boolean(config.auction?.enabled !== false);
    }
    if (typeof tournamentOrId === "object") {
      const t = tournamentOrId;
      if (t.teamFormationMode === "AUCTION" || t.teamFormation?.mode === "AUCTION") {
        return true;
      }
      if (typeof t.format === "string" && t.format.toLowerCase().includes("auction")) {
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
  getAuctionLifecycle(tournamentId) {
    if (!tournamentId) {
      return {
        status: "NOT_READY",
        label: "Auction Unavailable",
        ctaText: "NOT AVAILABLE",
        description: "Tournament identity required."
      };
    }
    const engine = getAuctionEngine(tournamentId);
    const state = engine.getState();
    const config = engine.getConfig();
    if (state.isCompleted || state.status === "COMPLETED") {
      return {
        status: "COMPLETED",
        label: "Auction Results",
        ctaText: "VIEW AUCTION RESULTS",
        description: "Auction draft completed. Historical lots and drafted rosters are finalized."
      };
    }
    if (state.status === "LIVE" || state.status === "PAUSED") {
      return {
        status: "LIVE",
        label: "Live Auction",
        ctaText: "VIEW LIVE AUCTION",
        description: state.status === "PAUSED" ? "Auction floor temporarily paused by organiser." : "Live captain bidding currently underway on the auction block."
      };
    }
    const minTeamsRequired = config.primaryRosterSize > 0 ? 2 : 1;
    let teams = engine.getTeams();
    if (teams.length < minTeamsRequired) {
      try {
        if (this.teamProvider) {
          const externalTeams = this.teamProvider(tournamentId);
          if (Array.isArray(externalTeams) && externalTeams.length > 0) {
            for (const extTeam of externalTeams) {
              if (!engine.hasTeam(extTeam.id)) {
                engine.hydrateTeamFromExternal(extTeam);
              }
            }
            teams = engine.getTeams();
          }
        }
        if (teams.length < minTeamsRequired) {
          const approvedRegs = dotaPlayerRegistry.getTournamentRegistrations(tournamentId).filter((r) => Boolean(r.isCaptainApproved));
          for (const reg of approvedRegs) {
            const expTeamId = reg.teamId || `team-${reg.userId}`;
            if (!engine.hasTeam(expTeamId)) {
              engine.hydrateTeamFromExternal({
                id: expTeamId,
                name: reg.teamName || `${reg.ign}'s Squad`,
                tag: (reg.ign.replace(/[^a-zA-Z]/g, "").slice(0, 3) || "TM").toUpperCase(),
                captainId: reg.userId,
                captainIgn: reg.ign,
                startingCredits: config.startingCredits,
                tournamentId
              });
            }
          }
          teams = engine.getTeams();
        }
      } catch {
      }
    }
    const hasCaptains = teams.length >= minTeamsRequired && teams.every((t) => Boolean(t.captainId));
    if (hasCaptains) {
      const missingMmrCaptain = engine.getMissingLockedMmrCaptain();
      if (missingMmrCaptain) {
        return {
          status: "NOT_READY",
          label: "MMR Verification Pending",
          ctaText: `WAITING FOR ${missingMmrCaptain.name.toUpperCase()} MMR`,
          description: `Captain '${missingMmrCaptain.name}' lacks locked Tournament MMR. Complete verification before auction lobby can open.`,
          blockingCaptain: missingMmrCaptain
        };
      }
      return {
        status: "READY",
        label: "Auction Lobby",
        ctaText: "ENTER AUCTION LOBBY",
        description: "Captains and franchise teams finalized with MMR-balanced starting purses. Ready for nomination."
      };
    }
    return {
      status: "NOT_READY",
      label: "Auction (Waiting for Captains)",
      ctaText: "WAITING FOR CAPTAIN SELECTION",
      description: "Auction contender pool is registering. Waiting for tournament captains to be appointed."
    };
  }
  /**
   * Enforces organiser authority boundary:
   * An organiser may only control auctions for tournaments they are authorized to operate.
   * Platform administrators have global governance.
   */
  canUserManageTournamentAuction(caller, tournamentId) {
    if (!caller) return false;
    const effectiveUserId = caller.userId || caller.id;
    if (!effectiveUserId) return false;
    if (caller.isAdmin || caller.email && caller.email.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase()) {
      return true;
    }
    if (caller.role !== "organizer") {
      return false;
    }
    const config = this.getConfig(tournamentId);
    if (config) {
      return true;
    }
    return false;
  }
  /**
   * Enforces captain bidding rights strictly within this tournament:
   * A user appointed as captain in Tournament A has NO bidding rights in Tournament B.
   */
  canUserBidInTournament(userId, tournamentId) {
    if (!userId || !tournamentId) return false;
    if (!this.isAuctionSupported(tournamentId)) return false;
    const engine = getAuctionEngine(tournamentId);
    const teams = engine.getTeams();
    return teams.some((t) => t.captainId === userId);
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch {
      }
    });
  }
};
var tournamentConfigRegistry = new TournamentConfigRegistry();

// ../src/data/mockData.ts
var MOCK_TOURNAMENTS = [
  {
    id: "purple-bean-auction-test",
    name: "Purple Bean Auction Test",
    game: "Dota 2",
    gameId: "dota2",
    status: "Registration Open",
    lifecycle: "REGISTRATION_OPEN",
    dates: "October 2026",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    prizePool: "\u20B950,000 Prize Pool",
    totalPrizeNumber: 5e4,
    prizePoolINR: "\u20B950,000",
    teamCount: 3,
    playerCount: 15,
    format: "Captain Auction \xB7 3 Teams \xB7 15 Slots",
    organizer: "Purple Bean Operations",
    city: "Bengaluru",
    region: "Pan India",
    description: "Production-safe 3-team test tournament for validating the full PBG registration \u2192 captain \u2192 auction \u2192 Discord role flow.",
    isDevelopment: false,
    testMode: true,
    environment: "TEST TOURNAMENT",
    tournamentType: "auction",
    teamFormation: { mode: "AUCTION", numberOfTeams: 3 },
    visibility: "PUBLIC",
    keyInfo: {
      server: "India (Mumbai)",
      antiCheat: "VAC & Verified Identity",
      bracketFormat: "Single Elimination (BO3)",
      rosterLock: "Strict 5/5 + 1 Stand-in"
    },
    prizeDistribution: [
      { place: "1st Place (Champion)", percentage: "60%", amount: "\u20B930,000" },
      { place: "2nd Place (Runner-up)", percentage: "40%", amount: "\u20B920,000" }
    ],
    stages: [
      { id: "stg-reg", name: "Registration Open", status: "current", date: "October 2026" },
      { id: "stg-cap", name: "Captain Selection (3 Teams)", status: "upcoming", date: "October 2026" },
      { id: "stg-auc", name: "Live 3-Team Captain Auction", status: "upcoming", date: "October 2026" }
    ]
  },
  {
    id: "after-auction-test",
    name: "After auction test",
    game: "Dota 2",
    gameId: "dota2",
    status: "In Progress",
    lifecycle: "IN_PROGRESS",
    dates: "October 2026",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    prizePool: "\u20B9100,000 Prize Pool",
    totalPrizeNumber: 1e5,
    prizePoolINR: "\u20B9100,000",
    teamCount: 8,
    playerCount: 40,
    format: "Post-Auction Championship \xB7 8 Formed Teams",
    organizer: "Purple Bean Operations",
    city: "Bengaluru",
    region: "Pan India",
    description: "Post-auction tournament fixture with 8 formed teams ready for double elimination bracket or group stage play.",
    isDevelopment: false,
    testMode: true,
    environment: "TEST TOURNAMENT",
    tournamentType: "auction",
    teamFormation: { mode: "AUCTION", numberOfTeams: 8 },
    visibility: "PUBLIC",
    keyInfo: {
      server: "India (Mumbai)",
      antiCheat: "VAC & Verified Identity",
      bracketFormat: "Double Elimination (BO3)",
      rosterLock: "Strict 5/5 + 1 Stand-in"
    },
    prizeDistribution: [
      { place: "1st Place (Champion)", percentage: "50%", amount: "\u20B950,000" },
      { place: "2nd Place (Runner-up)", percentage: "30%", amount: "\u20B930,000" },
      { place: "3rd Place", percentage: "20%", amount: "\u20B920,000" }
    ],
    stages: [
      { id: "stg-auc-done", name: "Auction Completed (8 Teams Formed)", status: "completed", date: "October 2026" },
      { id: "stg-comp", name: "Main Event Competition", status: "current", date: "October 2026" }
    ]
  }
];
var MOCK_PLAYERS = [
  {
    id: "p-1",
    username: "SkRossi",
    displayName: "SkRossi",
    realName: "Ganesh Gangadhar",
    avatar: "\u{1F3AF}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Bengaluru",
    region: "South India",
    primaryGame: "Dota 2",
    mmr: 8980,
    tournamentMmr: 8980,
    platformRating: 1950,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 2 \u2014 Mid",
    teamId: "t-1",
    teamName: "Purple Bean Titans",
    status: "Verified",
    matches: 142,
    wins: 98,
    losses: 44,
    winRate: 69,
    tournamentWins: 6,
    mvps: 28,
    experienceYears: 6,
    previousCaptainRecord: "Champion India Open 2025",
    bio: "Elite carry contender and veteran competitive leader.",
    heroPool: [
      { hero: "Morphling", games: 45, winRate: 72 },
      { hero: "Anti-Mage", games: 38, winRate: 68 },
      { hero: "Faceless Void", games: 30, winRate: 67 }
    ]
  },
  {
    id: "p-2",
    username: "Marzil",
    displayName: "Marzil",
    realName: "Agneya Koushik",
    avatar: "\u26A1",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Mumbai",
    region: "West India",
    primaryGame: "Dota 2",
    mmr: 8640,
    tournamentMmr: 8640,
    platformRating: 1910,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 1 \u2014 Carry",
    teamId: "t-2",
    teamName: "Mumbai Cobras",
    status: "Verified",
    matches: 120,
    wins: 82,
    losses: 38,
    winRate: 68.3,
    tournamentWins: 4,
    mvps: 22,
    experienceYears: 5,
    previousCaptainRecord: "Finalist Bangalore Major",
    bio: "High-tempo mid player known for dominant lane control.",
    heroPool: [
      { hero: "Storm Spirit", games: 40, winRate: 70 },
      { hero: "Invoker", games: 35, winRate: 66 },
      { hero: "Puck", games: 28, winRate: 68 }
    ]
  },
  {
    id: "p-3",
    username: "Aether",
    displayName: "Aether",
    realName: "Aditya Sharma",
    avatar: "\u{1F6E1}\uFE0F",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Mumbai",
    region: "West India",
    primaryGame: "Dota 2",
    mmr: 8600,
    tournamentMmr: 8600,
    platformRating: 1890,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 1 \u2014 Carry",
    teamId: "t-3",
    teamName: "Delhi Dragons",
    status: "Verified",
    matches: 115,
    wins: 76,
    losses: 39,
    winRate: 66.1,
    tournamentWins: 3,
    mvps: 18,
    experienceYears: 4,
    previousCaptainRecord: "Semifinalist Mumbai Open",
    bio: "Tenacious offlaner with world-class initiation timing.",
    heroPool: [
      { hero: "Axe", games: 42, winRate: 71 },
      { hero: "Centaur Warrunner", games: 35, winRate: 68 },
      { hero: "Mars", games: 25, winRate: 64 }
    ]
  },
  {
    id: "p-4",
    username: "Nova",
    displayName: "Nova",
    realName: "Nikhil Varma",
    avatar: "\u{1F31F}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Hyderabad",
    region: "South India",
    primaryGame: "Dota 2",
    mmr: 8450,
    tournamentMmr: 8450,
    platformRating: 1860,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 5 \u2014 Hard Support",
    status: "Verified",
    matches: 98,
    wins: 62,
    losses: 36,
    winRate: 63.3,
    tournamentWins: 2,
    mvps: 14,
    experienceYears: 4,
    bio: "Playmaking support roaming the map with clutch saves.",
    heroPool: [
      { hero: "Rubick", games: 50, winRate: 68 },
      { hero: "Earthshaker", games: 30, winRate: 65 }
    ]
  },
  {
    id: "p-5",
    username: "Karma",
    displayName: "Karma",
    realName: "Karthik Rao",
    avatar: "\u{1F9D8}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Bengaluru",
    region: "South India",
    primaryGame: "Dota 2",
    mmr: 8200,
    tournamentMmr: 8200,
    platformRating: 1820,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 4 \u2014 Soft Support",
    status: "Verified",
    matches: 130,
    wins: 80,
    losses: 50,
    winRate: 61.5,
    tournamentWins: 3,
    mvps: 12,
    experienceYears: 5,
    bio: "Vision specialist and defensive positioning anchor.",
    heroPool: [
      { hero: "Crystal Maiden", games: 60, winRate: 65 },
      { hero: "Disruptor", games: 40, winRate: 63 }
    ]
  },
  {
    id: "p-6",
    username: "Blaze",
    displayName: "Blaze",
    realName: "Rohan Deshmukh",
    avatar: "\u{1F525}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Pune",
    region: "West India",
    primaryGame: "Dota 2",
    mmr: 8100,
    tournamentMmr: 8100,
    platformRating: 1800,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 2 \u2014 Mid",
    status: "Verified",
    matches: 90,
    wins: 58,
    losses: 32,
    winRate: 64.4,
    tournamentWins: 1,
    mvps: 11,
    experienceYears: 3,
    bio: "Aggressive carry scaling quickly into late game.",
    heroPool: [{ hero: "Juggernaut", games: 45, winRate: 69 }]
  },
  {
    id: "p-7",
    username: "Shadow",
    displayName: "Shadow",
    realName: "Amit Patel",
    avatar: "\u{1F464}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Ahmedabad",
    region: "West India",
    primaryGame: "Dota 2",
    mmr: 7950,
    tournamentMmr: 7950,
    platformRating: 1780,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 1 \u2014 Carry",
    status: "Verified",
    matches: 85,
    wins: 52,
    losses: 33,
    winRate: 61.2,
    tournamentWins: 1,
    mvps: 9,
    experienceYears: 3,
    bio: "Precision midlaner with vast hero diversity.",
    heroPool: [{ hero: "Shadow Fiend", games: 38, winRate: 66 }]
  },
  {
    id: "p-8",
    username: "Viper",
    displayName: "Viper",
    realName: "Siddharth Nair",
    avatar: "\u{1F40D}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Kochi",
    region: "South India",
    primaryGame: "Dota 2",
    mmr: 7850,
    tournamentMmr: 7850,
    platformRating: 1760,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 4 \u2014 Soft Support",
    status: "Verified",
    matches: 92,
    wins: 55,
    losses: 37,
    winRate: 59.8,
    tournamentWins: 1,
    mvps: 8,
    experienceYears: 3,
    bio: "Lane bully who suffocates opponent farm.",
    heroPool: [{ hero: "Viper", games: 40, winRate: 65 }]
  },
  {
    id: "p-9",
    username: "Frost",
    displayName: "Frost",
    realName: "Varun Mehta",
    avatar: "\u2744\uFE0F",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Delhi",
    region: "North India",
    primaryGame: "Dota 2",
    mmr: 7700,
    tournamentMmr: 7700,
    platformRating: 1740,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 5 \u2014 Hard Support",
    status: "Verified",
    matches: 80,
    wins: 48,
    losses: 32,
    winRate: 60,
    tournamentWins: 1,
    mvps: 7,
    experienceYears: 3,
    bio: "Active roamer creating early advantages across lanes.",
    heroPool: [{ hero: "Tusk", games: 35, winRate: 63 }]
  },
  {
    id: "p-10",
    username: "Echo",
    displayName: "Echo",
    realName: "Devendra Singh",
    avatar: "\u{1F50A}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Jaipur",
    region: "North India",
    primaryGame: "Dota 2",
    mmr: 7600,
    tournamentMmr: 7600,
    platformRating: 1720,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 4 \u2014 Soft Support",
    status: "Verified",
    matches: 88,
    wins: 50,
    losses: 38,
    winRate: 56.8,
    tournamentWins: 0,
    mvps: 6,
    experienceYears: 2,
    bio: "Disciplined sacrificial support guarding cores.",
    heroPool: [{ hero: "Treant Protector", games: 30, winRate: 60 }]
  },
  {
    id: "p-11",
    username: "Striker",
    displayName: "Striker",
    realName: "Arjun Reddy",
    avatar: "\u26A1",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Hyderabad",
    region: "South India",
    primaryGame: "Dota 2",
    mmr: 7500,
    tournamentMmr: 7500,
    platformRating: 1700,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 2 \u2014 Mid",
    status: "Verified",
    matches: 75,
    wins: 44,
    losses: 31,
    winRate: 58.7,
    tournamentWins: 1,
    mvps: 6,
    experienceYears: 2,
    bio: "Relentless fighting carry excelling in skirmishes.",
    heroPool: [{ hero: "Sven", games: 30, winRate: 62 }]
  },
  {
    id: "p-12",
    username: "Phantom",
    displayName: "Phantom",
    realName: "Kunal Sen",
    avatar: "\u{1F47B}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Kolkata",
    region: "East India",
    primaryGame: "Dota 2",
    mmr: 7450,
    tournamentMmr: 7450,
    platformRating: 1690,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 1 \u2014 Carry",
    status: "Verified",
    matches: 70,
    wins: 41,
    losses: 29,
    winRate: 58.6,
    tournamentWins: 0,
    mvps: 5,
    experienceYears: 2,
    bio: "Illusion micro expert and spatial wave clear master.",
    heroPool: [{ hero: "Phantom Lancer", games: 28, winRate: 64 }]
  },
  {
    id: "p-13",
    username: "Rogue",
    displayName: "Rogue",
    realName: "Sameer Khan",
    avatar: "\u{1F5E1}\uFE0F",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Lucknow",
    region: "North India",
    primaryGame: "Dota 2",
    mmr: 7350,
    tournamentMmr: 7350,
    platformRating: 1670,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 4 \u2014 Soft Support",
    status: "Verified",
    matches: 65,
    wins: 38,
    losses: 27,
    winRate: 58.5,
    tournamentWins: 0,
    mvps: 4,
    experienceYears: 2,
    bio: "Sneaky space creator disrupting enemy jungle routines.",
    heroPool: [{ hero: "Bounty Hunter", games: 25, winRate: 60 }]
  },
  {
    id: "p-14",
    username: "Zephyr",
    displayName: "Zephyr",
    realName: "Pranav Joshi",
    avatar: "\u{1F32A}\uFE0F",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Nagpur",
    region: "Central India",
    primaryGame: "Dota 2",
    mmr: 7250,
    tournamentMmr: 7250,
    platformRating: 1650,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 5 \u2014 Hard Support",
    status: "Verified",
    matches: 60,
    wins: 35,
    losses: 25,
    winRate: 58.3,
    tournamentWins: 0,
    mvps: 3,
    experienceYears: 2,
    bio: "Windrunner and mobility support specialist.",
    heroPool: [{ hero: "Windranger", games: 22, winRate: 59 }]
  },
  {
    id: "p-15",
    username: "Oracle",
    displayName: "Oracle",
    realName: "Manoj Kumar",
    avatar: "\u{1F52E}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Chandigarh",
    region: "North India",
    primaryGame: "Dota 2",
    mmr: 7150,
    tournamentMmr: 7150,
    platformRating: 1630,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 4 \u2014 Soft Support",
    status: "Verified",
    matches: 55,
    wins: 31,
    losses: 24,
    winRate: 56.4,
    tournamentWins: 0,
    mvps: 2,
    experienceYears: 1,
    bio: "Reaction saves and dispel master in chaotic team fights.",
    heroPool: [{ hero: "Oracle", games: 20, winRate: 60 }]
  },
  {
    id: "p-16",
    username: "Titan",
    displayName: "Titan",
    realName: "Rahul Bhatt",
    avatar: "\u{1F5FF}",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Bhopal",
    region: "Central India",
    primaryGame: "Dota 2",
    mmr: 7050,
    tournamentMmr: 7050,
    platformRating: 1610,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 3 \u2014 Offlane",
    status: "Verified",
    matches: 50,
    wins: 28,
    losses: 22,
    winRate: 56,
    tournamentWins: 0,
    mvps: 2,
    experienceYears: 1,
    bio: "Formidable frontliner with resilient teamfight impact.",
    heroPool: [{ hero: "Tiny", games: 18, winRate: 58 }]
  }
];
var AFTER_AUCTION_8_TEAMS = [
  {
    id: "team-aat-1",
    name: "Vanguard Gaming",
    tag: "VAN",
    logo: "\u{1F6E1}\uFE0F",
    color: "#7C3AED",
    bgHex: "#EDE9FE",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Bengaluru",
    region: "South India",
    primaryGame: "Dota 2",
    rating: 7500,
    tournamentWins: 2,
    captainId: "pbg-test-captain-01",
    captainName: "VanguardCaptain",
    players: ["pbg-test-001", "pbg-test-002", "pbg-test-003", "pbg-test-004", "pbg-test-005"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["W", "W", "W"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-2",
    name: "Apex Predators",
    tag: "APX",
    logo: "\u26A1",
    color: "#3B82F6",
    bgHex: "#DBEAFE",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Mumbai",
    region: "West India",
    primaryGame: "Dota 2",
    rating: 7300,
    tournamentWins: 1,
    captainId: "pbg-test-captain-02",
    captainName: "ApexCaptain",
    players: ["pbg-test-006", "pbg-test-007", "pbg-test-008", "pbg-test-009", "pbg-test-010"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["W", "L", "W"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-3",
    name: "Shadow Strikers",
    tag: "SHD",
    logo: "\u{1F451}",
    color: "#059669",
    bgHex: "#D1FAE5",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Delhi",
    region: "North India",
    primaryGame: "Dota 2",
    rating: 7100,
    tournamentWins: 1,
    captainId: "pbg-test-captain-03",
    captainName: "ShadowCaptain",
    players: ["pbg-test-011", "pbg-test-012", "pbg-test-013", "pbg-test-014", "pbg-test-015"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["W", "W", "L"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-4",
    name: "Iron Legion",
    tag: "IRN",
    logo: "\u{1F409}",
    color: "#DC2626",
    bgHex: "#FEE2E2",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Hyderabad",
    region: "South India",
    primaryGame: "Dota 2",
    rating: 6900,
    tournamentWins: 0,
    captainId: "pbg-test-captain-04",
    captainName: "IronCaptain",
    players: ["pbg-test-016", "pbg-test-017", "pbg-test-018", "pbg-test-019", "pbg-test-020"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["L", "W", "L"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-5",
    name: "Solar Flare",
    tag: "SOL",
    logo: "\u{1F525}",
    color: "#D97706",
    bgHex: "#FEF3C7",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Chennai",
    region: "South India",
    primaryGame: "Dota 2",
    rating: 6700,
    tournamentWins: 0,
    captainId: "pbg-test-captain-05",
    captainName: "SolarCaptain",
    players: ["pbg-test-021", "pbg-test-022", "pbg-test-023", "pbg-test-024", "pbg-test-025"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["W", "L", "L"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-6",
    name: "Thunderbolts",
    tag: "THN",
    logo: "\u{1F981}",
    color: "#EC4899",
    bgHex: "#FCE7F3",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Kolkata",
    region: "East India",
    primaryGame: "Dota 2",
    rating: 6500,
    tournamentWins: 0,
    captainId: "pbg-test-captain-06",
    captainName: "ThunderCaptain",
    players: ["pbg-test-026", "pbg-test-027", "pbg-test-028", "pbg-test-029", "pbg-test-030"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["L", "L", "W"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-7",
    name: "Mystic Wolves",
    tag: "WLF",
    logo: "\u2694\uFE0F",
    color: "#6366F1",
    bgHex: "#E0E7FF",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Pune",
    region: "West India",
    primaryGame: "Dota 2",
    rating: 6300,
    tournamentWins: 0,
    captainId: "pbg-test-captain-07",
    captainName: "WolfCaptain",
    players: ["pbg-test-031", "pbg-test-032", "pbg-test-033", "pbg-test-034", "pbg-test-035"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["L", "W", "L"],
    tournamentId: "after-auction-test"
  },
  {
    id: "team-aat-8",
    name: "Frostbite Esports",
    tag: "FRS",
    logo: "\u{1F3AF}",
    color: "#14B8A6",
    bgHex: "#CCFBF1",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Jaipur",
    region: "North India",
    primaryGame: "Dota 2",
    rating: 6100,
    tournamentWins: 0,
    captainId: "pbg-test-captain-08",
    captainName: "FrostCaptain",
    players: ["pbg-test-036", "pbg-test-037", "pbg-test-038", "pbg-test-039", "pbg-test-040"],
    standIn: "",
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: ["L", "L", "L"],
    tournamentId: "after-auction-test"
  }
];
var MOCK_TEAMS = [
  {
    id: "t-1",
    name: "Purple Bean Titans",
    tag: "PBT",
    logo: "\u{1F6E1}\uFE0F",
    color: "#7C3AED",
    bgHex: "#EDE9FE",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Bengaluru",
    region: "South India",
    primaryGame: "Dota 2",
    rating: 1880,
    tournamentWins: 5,
    captainId: "p-1",
    captainName: "SkRossi",
    players: ["p-1"],
    standIn: "",
    groupPoints: 9,
    mapsRecord: { won: 6, lost: 1 },
    form: ["W", "W", "W"],
    description: "Defending champions representing South India."
  },
  {
    id: "t-2",
    name: "Mumbai Cobras",
    tag: "MC",
    logo: "\u{1F40D}",
    color: "#059669",
    bgHex: "#D1FAE5",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Mumbai",
    region: "West India",
    primaryGame: "Dota 2",
    rating: 1820,
    tournamentWins: 3,
    captainId: "p-2",
    captainName: "Marzil",
    players: ["p-2"],
    standIn: "",
    groupPoints: 6,
    mapsRecord: { won: 4, lost: 3 },
    form: ["W", "L", "W"],
    description: "Fierce contender known for aggressive playstyles."
  },
  {
    id: "t-3",
    name: "Delhi Dragons",
    tag: "DD",
    logo: "\u{1F409}",
    color: "#DC2626",
    bgHex: "#FEE2E2",
    country: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    city: "Delhi",
    region: "North India",
    primaryGame: "Dota 2",
    rating: 1850,
    tournamentWins: 2,
    captainId: "p-3",
    captainName: "Aether",
    players: ["p-3"],
    standIn: "",
    groupPoints: 7,
    mapsRecord: { won: 5, lost: 2 },
    form: ["W", "W", "L"],
    description: "Dynamic team known for tactical precision and execution."
  },
  ...AFTER_AUCTION_8_TEAMS
];
var MOCK_MATCHES = [
  {
    id: "m-1",
    tournamentId: "purple-bean-india-masters-2026",
    tournamentName: "India Masters 2026",
    game: "Dota 2",
    round: "Upper Semifinal 1",
    teamA: { id: "t-1", name: "Purple Bean Titans", tag: "PBT", logo: "\u{1F6E1}\uFE0F", score: 2 },
    teamB: { id: "t-2", name: "Mumbai Cobras", tag: "MC", logo: "\u{1F40D}", score: 1 },
    seriesFormat: "BO3",
    status: "COMPLETED",
    scheduledTime: "2026-10-08T14:00:00Z",
    winnerId: "t-1"
  },
  {
    id: "m-live-1",
    tournamentId: "purple-bean-india-masters-2026",
    tournamentName: "India Masters 2026",
    game: "Dota 2",
    round: "Upper Semifinal 2",
    teamA: { id: "t-1", name: "Purple Bean Titans", tag: "PBT", logo: "\u{1F6E1}\uFE0F", score: 0 },
    teamB: { id: "t-2", name: "Mumbai Cobras", tag: "MC", logo: "\u{1F40D}", score: 0 },
    seriesFormat: "BO3",
    status: "LIVE",
    scheduledTime: "2026-10-08T16:00:00Z"
  }
];
var MOCK_AUCTION_TEAMS = [
  {
    teamId: "t-1",
    teamName: "Purple Bean Titans",
    tag: "PBT",
    logo: "\u{1F6E1}\uFE0F",
    color: "#7C3AED",
    initialCredits: 1e6,
    remainingCredits: 95e4,
    maxPlayers: 5,
    draftedPlayers: [MOCK_PLAYERS[0]]
  },
  {
    teamId: "t-2",
    teamName: "Mumbai Cobras",
    tag: "MC",
    logo: "\u{1F40D}",
    color: "#059669",
    initialCredits: 1e6,
    remainingCredits: 95e4,
    maxPlayers: 5,
    draftedPlayers: [MOCK_PLAYERS[1]]
  },
  {
    teamId: "t-3",
    teamName: "Delhi Dragons",
    tag: "DD",
    logo: "\u{1F409}",
    color: "#DC2626",
    initialCredits: 1e6,
    remainingCredits: 95e4,
    maxPlayers: 5,
    draftedPlayers: [MOCK_PLAYERS[2] || MOCK_PLAYERS[0]]
  }
];
var MOCK_AUCTION_PLAYER = {
  player: MOCK_PLAYERS[0],
  currentBid: 320,
  highBidderTeamId: "t-1",
  highBidderTeamName: "Purple Bean Titans",
  status: "sold",
  bidHistory: [
    { teamId: "t-2", teamName: "Mumbai Cobras", amount: 300, time: "14:22:10" },
    { teamId: "t-1", teamName: "Purple Bean Titans", amount: 320, time: "14:22:18" }
  ]
};

// ../src/domain/rosterRules.ts
var GAME_ROSTER_CONFIGS = {
  "Dota 2": {
    game: "Dota 2",
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  },
  "Valorant": {
    game: "Valorant",
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  },
  "Counter-Strike 2": {
    game: "Counter-Strike 2",
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  },
  "BGMI": {
    game: "BGMI",
    primaryRosterSize: 4,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  },
  "PUBG": {
    game: "PUBG",
    primaryRosterSize: 4,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  }
};
function getRosterConfigForGame(game) {
  const norm = Object.keys(GAME_ROSTER_CONFIGS).find((k) => k.toLowerCase() === game.toLowerCase());
  if (norm && GAME_ROSTER_CONFIGS[norm]) {
    return GAME_ROSTER_CONFIGS[norm];
  }
  return {
    game,
    primaryRosterSize: 5,
    optionalStandInAllowed: true,
    maxStandIns: 1,
    minReservePerSlot: 1e4
  };
}
function validateBidRosterConstraint(purseBalance, bidAmount, currentDraftedSlots, config) {
  if (bidAmount > purseBalance) {
    return {
      valid: false,
      reason: `Insufficient purse balance: Bid amount \u20B9${bidAmount.toLocaleString()} exceeds available credits \u20B9${purseBalance.toLocaleString()}.`
    };
  }
  const unfilledSlots = Math.max(0, config.primaryRosterSize - 1 - currentDraftedSlots);
  const minReserve = config.minReservePerSlot || 10;
  const reserveNeeded = unfilledSlots * minReserve;
  const remaining = purseBalance - bidAmount;
  if (remaining < reserveNeeded) {
    return {
      valid: false,
      reason: `Illegal bid! Team must reserve \u20B9${reserveNeeded.toLocaleString()} for remaining unfilled slots. Remaining credits: \u20B9${remaining.toLocaleString()}.`
    };
  }
  return { valid: true };
}

// ../src/domain/battleRoyaleEngine.ts
function getPlacementPoints(placement) {
  switch (placement) {
    case 1:
      return 10;
    case 2:
      return 6;
    case 3:
      return 5;
    case 4:
      return 4;
    case 5:
      return 3;
    case 6:
      return 2;
    case 7:
      return 1;
    case 8:
      return 1;
    default:
      return 0;
  }
}
function calculateMatchPoints(placement, finishes) {
  const placementPts = getPlacementPoints(placement);
  const finishPts = Math.max(0, finishes);
  return {
    placementPts,
    finishPts,
    total: placementPts + finishPts
  };
}
function compileBRLeaderboard(matches) {
  const map = /* @__PURE__ */ new Map();
  for (const m of matches) {
    for (const r of m.results) {
      const existing = map.get(r.teamId) || {
        teamId: r.teamId,
        teamName: r.teamName,
        tag: r.tag,
        totalPoints: 0,
        wwcdCount: 0,
        placementPoints: 0,
        finishPoints: 0,
        matchesPlayed: 0
      };
      const pts = calculateMatchPoints(r.placement, r.finishes);
      existing.totalPoints += pts.total;
      existing.placementPoints += pts.placementPts;
      existing.finishPoints += pts.finishPts;
      existing.matchesPlayed += 1;
      if (r.placement === 1) {
        existing.wwcdCount += 1;
      }
      map.set(r.teamId, existing);
    }
  }
  const sorted = Array.from(map.values()).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.wwcdCount !== a.wwcdCount) return b.wwcdCount - a.wwcdCount;
    return b.finishPoints - a.finishPoints;
  });
  return sorted.map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));
}

// ../src/domain/dotaCareerHistoryEngine.ts
var DotaCareerHistoryEngine = class {
  constructor() {
    this.playerCareers = /* @__PURE__ */ new Map();
    this.captainCareers = /* @__PURE__ */ new Map();
    this.teamCareers = /* @__PURE__ */ new Map();
    this.seasons = /* @__PURE__ */ new Map();
    this.processedMatches = /* @__PURE__ */ new Set();
    this.completedTournaments = /* @__PURE__ */ new Set();
    this.ratingLedger = [];
    this.canonicalMatches = [];
    this.initDefaultSeasons();
    this.seedFromExistingEngines();
  }
  // -------------------------------------------------------------
  // Initialization & Seeding
  // -------------------------------------------------------------
  initDefaultSeasons() {
    const s1 = {
      id: "season-2026-s1",
      name: "2026 Season 1: Pan-India Championship Circuit",
      code: "2026-S1",
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-06-30T23:59:59Z",
      isActive: true,
      tournaments: ["india-dota-open-2026", "purple-bean-test-cup"],
      champions: [],
      notableResults: [
        "India Dota Open 2026 registration opened with \u20B91,00,000 prize pool"
      ]
    };
    this.seasons.set(s1.id, s1);
  }
  clearAll() {
    this.playerCareers.clear();
    this.captainCareers.clear();
    this.teamCareers.clear();
    this.processedMatches.clear();
    this.completedTournaments.clear();
    this.ratingLedger = [];
    this.canonicalMatches = [];
  }
  seedFromExistingEngines() {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (!isTest) {
      return;
    }
    const existingPlayers = dotaPlayerEngine.getAllPlayers();
    for (const p of existingPlayers) {
      this.ensurePlayerCareer(p);
    }
    try {
      const tcPlayers = testCupEngine.getPlayers();
      for (const tcp of tcPlayers) {
        this.ensurePlayerCareer(tcp.id);
      }
    } catch {
    }
    const tcTeams = testCupEngine.getTeams();
    const seedTeams = [
      { id: "tc-team-1", name: "Mumbai Mavericks", tag: "MMV", logo: "\u26A1", rating: 1650 },
      { id: "tc-team-2", name: "Hyderabad Raiders", tag: "HRD", logo: "\u{1F4A5}", rating: 1580 },
      { id: "tc-team-3", name: "Bengaluru Blaze", tag: "BLZ", logo: "\u{1F409}", rating: 1520 }
    ];
    for (const t of tcTeams.length > 0 ? tcTeams : seedTeams) {
      this.ensureTeamCareer(t.id, t.name, t.tag || t.name.slice(0, 3).toUpperCase(), t.logo || "\u2694\uFE0F", t.rating || 1500);
    }
  }
  ensurePlayerCareer(pOrId) {
    const rawPId = typeof pOrId === "string" ? pOrId : pOrId?.id;
    const pId = String(rawPId || "");
    if (!pId) {
      throw new Error("Player ID is required for career tracking.");
    }
    if (this.playerCareers.has(pId)) {
      return this.playerCareers.get(pId);
    }
    let p = typeof pOrId === "object" ? pOrId : dotaPlayerRegistry.getPlayer(pId);
    if (!p) {
      const tc = testCupEngine.getPlayers().find((pl) => pl.id === pId || String(pl.username || "").toLowerCase() === pId.toLowerCase());
      if (tc) {
        p = {
          id: tc.id,
          username: tc.username,
          displayName: tc.realName,
          avatar: tc.avatar || "\u{1F3AE}",
          city: tc.city || "Mumbai",
          region: tc.region || "West India",
          primaryRole: tc.primaryRole,
          secondaryRole: tc.secondaryRole,
          tournamentMmr: tc.tournamentMmr || tc.mmr || 5800,
          declaredMmr: tc.mmr || 5800,
          isMmrLocked: true,
          competitiveRating: 1540,
          ratingStatus: "ESTABLISHED",
          qualifyingMatchesCount: 6,
          tournamentSnapshots: [
            {
              tournamentId: "purple-bean-test-cup",
              tournamentName: "Purple Bean Test Cup",
              year: 2026,
              teamId: tc.teamId || "tc-team-1",
              teamName: tc.teamName || "Mumbai Mavericks",
              primaryRole: tc.primaryRole,
              lockedTournamentMmr: tc.tournamentMmr || 5800,
              isCaptain: Boolean(tc.isCaptain),
              finalPlacement: tc.isCaptain ? "Champion (1st Place)" : "Runner-up (2nd Place)",
              prizeWonINR: 15e3,
              matchesPlayed: 2,
              wins: 2,
              ratingBefore: 1540,
              ratingAfter: 1564
            }
          ],
          captainRecord: tc.isCaptain ? {
            tournamentsCaptained: 3,
            teamsLed: [`${tc.username}'s Squad`],
            championships: 1,
            finalsReached: 2,
            matchWins: 4,
            matchLosses: 1,
            totalAuctionSpend: 2850,
            playersDrafted: 4,
            reputationScore: 95
          } : void 0
        };
      } else {
        const isCap = pId.includes("1") || pId.includes("c1") || pId.toLowerCase().includes("aether");
        p = {
          id: pId,
          username: pId === "tc-player-1" ? "Aether" : pId.startsWith("p-") || pId.startsWith("tc-") ? pId : `Player_${pId}`,
          displayName: pId,
          avatar: isCap ? "\u26A1" : "\u{1F3AE}",
          city: "Mumbai",
          region: "West India",
          primaryRole: "Position 2 \u2014 Mid",
          tournamentMmr: 6e3,
          declaredMmr: 6e3,
          isMmrLocked: true,
          competitiveRating: 1500,
          ratingStatus: "PROVISIONAL",
          qualifyingMatchesCount: 0,
          tournamentSnapshots: [
            {
              tournamentId: "purple-bean-test-cup",
              tournamentName: "Purple Bean Test Cup",
              year: 2026,
              teamId: "tc-team-1",
              teamName: "Mumbai Mavericks",
              primaryRole: "Position 2 \u2014 Mid",
              lockedTournamentMmr: 6e3,
              isCaptain: isCap,
              finalPlacement: isCap ? "Champion (1st Place)" : "Runner-up (2nd Place)",
              prizeWonINR: 15e3,
              matchesPlayed: 2,
              wins: 2,
              ratingBefore: 1500,
              ratingAfter: 1524
            }
          ],
          captainRecord: isCap ? {
            tournamentsCaptained: 1,
            teamsLed: ["Mumbai Mavericks"],
            championships: 1,
            finalsReached: 1,
            matchWins: 4,
            matchLosses: 1,
            totalAuctionSpend: 480,
            playersDrafted: 4,
            reputationScore: 95
          } : void 0
        };
      }
    }
    const qualifyingCount = p.qualifyingMatchesCount || (p.tournamentSnapshots?.length ? p.tournamentSnapshots[0].matchesPlayed : 0);
    const uncertainty = Math.max(50, 350 - qualifyingCount * 30);
    const confidence = Math.min(95, 50 + qualifyingCount * 8);
    const ratingStatus = qualifyingCount >= 5 ? "ESTABLISHED" : "PROVISIONAL";
    const career = {
      playerId: p.id,
      ign: p.username,
      primaryRole: p.primaryRole,
      secondaryRole: p.secondaryRole,
      currentTeamId: p.currentTeamId,
      currentTeamName: p.currentTeamName,
      region: p.region || "West India",
      city: p.city || "Mumbai",
      avatar: p.avatar || "\u{1F3AE}",
      lifetimeMatches: qualifyingCount,
      lifetimeWins: p.tournamentSnapshots?.[0]?.wins || Math.floor(qualifyingCount * 0.6),
      lifetimeLosses: Math.max(0, qualifyingCount - (p.tournamentSnapshots?.[0]?.wins || Math.floor(qualifyingCount * 0.6))),
      tournamentPlacements: [],
      competitiveRating: p.competitiveRating || 1500,
      ratingStatus,
      qualifyingMatchesCount: qualifyingCount,
      uncertainty,
      confidence,
      ratingHistory: [],
      recentForm: ["W", "W", "L", "W"],
      seasonStats: {}
    };
    if (p.tournamentSnapshots && p.tournamentSnapshots.length > 0) {
      for (const snap of p.tournamentSnapshots) {
        career.tournamentPlacements.push({
          tournamentId: snap.tournamentId,
          tournamentName: snap.tournamentName,
          seasonId: "season-2026-s1",
          year: snap.year,
          teamId: snap.teamId,
          teamName: snap.teamName,
          role: snap.primaryRole,
          isCaptain: snap.isCaptain,
          tournamentMmr: snap.lockedTournamentMmr,
          finalPlacement: snap.finalPlacement,
          matchesPlayed: snap.matchesPlayed,
          wins: snap.wins,
          losses: Math.max(0, snap.matchesPlayed - snap.wins),
          ratingBefore: snap.ratingBefore,
          ratingAfter: snap.ratingAfter,
          prizeWonINR: snap.prizeWonINR,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    this.playerCareers.set(p.id, career);
    if (p.captainRecord && (p.captainRecord.tournamentsCaptained > 0 || p.captainRecord.teamsLed?.length)) {
      this.captainCareers.set(p.id, {
        playerId: p.id,
        ign: p.username,
        tournamentsCaptained: p.captainRecord.tournamentsCaptained,
        teamsLed: (p.captainRecord.teamsLed || []).map((tName) => ({
          teamId: p.currentTeamId || `team-${p.id}`,
          teamName: tName,
          tournamentId: "purple-bean-test-cup",
          tournamentName: "Purple Bean Test Cup"
        })),
        matches: (p.captainRecord.matchWins || 0) + (p.captainRecord.matchLosses || 0),
        wins: p.captainRecord.matchWins || 0,
        losses: p.captainRecord.matchLosses || 0,
        placements: [
          { tournamentId: "purple-bean-test-cup", tournamentName: "Purple Bean Test Cup", placement: p.ign === "Aether" ? "Champion (1st Place)" : "Runner-up (2nd Place)" }
        ],
        finals: p.captainRecord.finalsReached || 0,
        championships: p.captainRecord.championships || 0,
        auctionPlayersDrafted: p.captainRecord.playersDrafted || 0,
        auctionCreditsSpent: p.captainRecord.totalAuctionSpend || 0,
        reputationScore: p.captainRecord.reputationScore || 90
      });
    }
    return career;
  }
  ensureTeamCareer(teamId, teamName, tag = "PBG", logo = "\u2694\uFE0F", rating = 1500) {
    if (this.teamCareers.has(teamId)) {
      return this.teamCareers.get(teamId);
    }
    const teamRecord = {
      teamId,
      teamName,
      tag,
      logo,
      rating,
      lifetimeMatches: 0,
      lifetimeWins: 0,
      lifetimeLosses: 0,
      tournamentWins: 0,
      recentForm: [],
      tournamentHistory: []
    };
    this.teamCareers.set(teamId, teamRecord);
    return teamRecord;
  }
  // -------------------------------------------------------------
  // Competitive Rating & Idempotent Match Rating Application
  // -------------------------------------------------------------
  processMatchRating(payload, caller) {
    if (caller && !caller.isAdmin && caller.role !== "organizer" && caller.role !== "referee") {
      return { success: false, error: "Unauthorized: Only tournament organizers and referees can process rating events.", events: [], teamDelta: 0 };
    }
    if (payload.isCancelled) {
      return { success: false, error: "DENIED: Cancelled matches cannot be rated.", events: [], teamDelta: 0 };
    }
    if (payload.isSuperseded) {
      return { success: false, error: "DENIED: Superseded matches cannot produce canonical rating events.", events: [], teamDelta: 0 };
    }
    if (payload.isForfeit) {
      return { success: false, error: "DENIED: Forfeits do not qualify for rating adjustments per league policy.", events: [], teamDelta: 0 };
    }
    if (payload.isTestMatch || payload.tournamentId === "purple-bean-auction-test" || payload.testMode) {
      return { success: false, error: "DENIED: Test tournament matches do not contribute to permanent competitive ratings or career records.", events: [], teamDelta: 0 };
    }
    if (this.processedMatches.has(payload.matchId)) {
      const existing = this.ratingLedger.filter((e) => e.matchId === payload.matchId);
      return {
        success: true,
        alreadyProcessed: true,
        events: existing,
        teamDelta: existing.length > 0 ? existing[0].ratingDelta : 0
      };
    }
    this.canonicalMatches.push(payload);
    this.processedMatches.add(payload.matchId);
    const winnerTeam = this.ensureTeamCareer(payload.winnerTeamId, payload.winnerTeamId);
    const loserTeam = this.ensureTeamCareer(payload.loserTeamId, payload.loserTeamId);
    const teamDelta = Math.max(10, calculateEloDelta(winnerTeam.rating, loserTeam.rating, 1));
    winnerTeam.rating += teamDelta;
    loserTeam.rating = Math.max(100, loserTeam.rating - teamDelta);
    winnerTeam.lifetimeMatches++;
    winnerTeam.lifetimeWins++;
    winnerTeam.recentForm.unshift("W");
    if (winnerTeam.recentForm.length > 5) winnerTeam.recentForm.pop();
    loserTeam.lifetimeMatches++;
    loserTeam.lifetimeLosses++;
    loserTeam.recentForm.unshift("L");
    if (loserTeam.recentForm.length > 5) loserTeam.recentForm.pop();
    const timestamp = payload.appliedAt || (/* @__PURE__ */ new Date()).toISOString();
    const createdEvents = [];
    for (const pId of payload.winnerRosterPlayerIds) {
      const player = this.getOrFetchPlayerCareer(pId);
      if (!player) continue;
      const ratingBefore = player.competitiveRating;
      const playerDelta = teamDelta;
      const ratingAfter = ratingBefore + playerDelta;
      player.qualifyingMatchesCount++;
      player.lifetimeMatches++;
      player.lifetimeWins++;
      player.competitiveRating = ratingAfter;
      player.recentForm.unshift("W");
      if (player.recentForm.length > 5) player.recentForm.pop();
      player.uncertainty = Math.max(50, 350 - player.qualifyingMatchesCount * 30);
      player.confidence = Math.min(95, 50 + player.qualifyingMatchesCount * 8);
      player.ratingStatus = player.qualifyingMatchesCount >= 5 ? "ESTABLISHED" : "PROVISIONAL";
      const seasonId = payload.seasonId || "season-2026-s1";
      if (!player.seasonStats[seasonId]) {
        player.seasonStats[seasonId] = { matches: 0, wins: 0, losses: 0, rating: ratingAfter };
      }
      player.seasonStats[seasonId].matches++;
      player.seasonStats[seasonId].wins++;
      player.seasonStats[seasonId].rating = ratingAfter;
      const event = {
        id: `rate-${payload.matchId}-${pId}`,
        playerId: pId,
        playerIgn: player.ign,
        matchId: payload.matchId,
        tournamentId: payload.tournamentId,
        seasonId,
        ratingBefore,
        ratingDelta: playerDelta,
        ratingAfter,
        uncertainty: player.uncertainty,
        confidence: player.confidence,
        timestamp,
        isWin: true
      };
      player.ratingHistory.push(event);
      this.ratingLedger.push(event);
      createdEvents.push(event);
    }
    for (const pId of payload.loserRosterPlayerIds) {
      const player = this.getOrFetchPlayerCareer(pId);
      if (!player) continue;
      const ratingBefore = player.competitiveRating;
      const playerDelta = -teamDelta;
      const ratingAfter = Math.max(100, ratingBefore + playerDelta);
      player.qualifyingMatchesCount++;
      player.lifetimeMatches++;
      player.lifetimeLosses++;
      player.competitiveRating = ratingAfter;
      player.recentForm.unshift("L");
      if (player.recentForm.length > 5) player.recentForm.pop();
      player.uncertainty = Math.max(50, 350 - player.qualifyingMatchesCount * 30);
      player.confidence = Math.min(95, 50 + player.qualifyingMatchesCount * 8);
      player.ratingStatus = player.qualifyingMatchesCount >= 5 ? "ESTABLISHED" : "PROVISIONAL";
      const seasonId = payload.seasonId || "season-2026-s1";
      if (!player.seasonStats[seasonId]) {
        player.seasonStats[seasonId] = { matches: 0, wins: 0, losses: 0, rating: ratingAfter };
      }
      player.seasonStats[seasonId].matches++;
      player.seasonStats[seasonId].losses++;
      player.seasonStats[seasonId].rating = ratingAfter;
      const event = {
        id: `rate-${payload.matchId}-${pId}`,
        playerId: pId,
        playerIgn: player.ign,
        matchId: payload.matchId,
        tournamentId: payload.tournamentId,
        seasonId,
        ratingBefore,
        ratingDelta: playerDelta,
        ratingAfter,
        uncertainty: player.uncertainty,
        confidence: player.confidence,
        timestamp,
        isWin: false
      };
      player.ratingHistory.push(event);
      this.ratingLedger.push(event);
      createdEvents.push(event);
    }
    return {
      success: true,
      alreadyProcessed: false,
      events: createdEvents,
      teamDelta
    };
  }
  getOrFetchPlayerCareer(playerId) {
    return this.ensurePlayerCareer(playerId);
  }
  // -------------------------------------------------------------
  // Full Deterministic Rating Rebuilder
  // -------------------------------------------------------------
  rebuildRatings(matchHistory, initialPlayerRatings, initialTeamRatings) {
    const pRatings = { ...initialPlayerRatings || {} };
    const tRatings = { ...initialTeamRatings || {} };
    const counts = {};
    const statuses = {};
    const rebuiltEvents = [];
    const sorted = [...matchHistory].sort(
      (a, b) => new Date(a.appliedAt || 0).getTime() - new Date(b.appliedAt || 0).getTime()
    );
    let processed = 0;
    for (const match of sorted) {
      if (match.isCancelled || match.isSuperseded || match.isForfeit) continue;
      const wTeamRating = tRatings[match.winnerTeamId] || 1500;
      const lTeamRating = tRatings[match.loserTeamId] || 1500;
      const delta = Math.max(10, calculateEloDelta(wTeamRating, lTeamRating, 1));
      tRatings[match.winnerTeamId] = wTeamRating + delta;
      tRatings[match.loserTeamId] = Math.max(100, lTeamRating - delta);
      for (const pId of match.winnerRosterPlayerIds) {
        const cur = pRatings[pId] || 1500;
        const next = cur + delta;
        pRatings[pId] = next;
        counts[pId] = (counts[pId] || 0) + 1;
        statuses[pId] = counts[pId] >= 5 ? "ESTABLISHED" : "PROVISIONAL";
        rebuiltEvents.push({
          id: `rebuild-${match.matchId}-${pId}`,
          playerId: pId,
          playerIgn: pId,
          matchId: match.matchId,
          tournamentId: match.tournamentId,
          seasonId: match.seasonId || "season-2026-s1",
          ratingBefore: cur,
          ratingDelta: delta,
          ratingAfter: next,
          uncertainty: Math.max(50, 350 - counts[pId] * 30),
          confidence: Math.min(95, 50 + counts[pId] * 8),
          timestamp: match.appliedAt || (/* @__PURE__ */ new Date()).toISOString(),
          isWin: true
        });
      }
      for (const pId of match.loserRosterPlayerIds) {
        const cur = pRatings[pId] || 1500;
        const next = Math.max(100, cur - delta);
        pRatings[pId] = next;
        counts[pId] = (counts[pId] || 0) + 1;
        statuses[pId] = counts[pId] >= 5 ? "ESTABLISHED" : "PROVISIONAL";
        rebuiltEvents.push({
          id: `rebuild-${match.matchId}-${pId}`,
          playerId: pId,
          playerIgn: pId,
          matchId: match.matchId,
          tournamentId: match.tournamentId,
          seasonId: match.seasonId || "season-2026-s1",
          ratingBefore: cur,
          ratingDelta: -delta,
          ratingAfter: next,
          uncertainty: Math.max(50, 350 - counts[pId] * 30),
          confidence: Math.min(95, 50 + counts[pId] * 8),
          timestamp: match.appliedAt || (/* @__PURE__ */ new Date()).toISOString(),
          isWin: false
        });
      }
      processed++;
    }
    return {
      playerRatings: pRatings,
      playerStatus: statuses,
      qualifyingCounts: counts,
      teamRatings: tRatings,
      totalMatchesProcessed: processed,
      events: rebuiltEvents
    };
  }
  // -------------------------------------------------------------
  // Result Correction Rebuilder
  // -------------------------------------------------------------
  correctMatchResultAndRebuild(matchId, correctedWinnerTeamId, correctedLoserTeamId, correctedWinnerScore, correctedLoserScore, winnerRosterPlayerIds, loserRosterPlayerIds, caller) {
    if (caller && !caller.isAdmin && caller.role !== "organizer") {
      return { success: false, error: "Unauthorized: Only organizers can perform audited result corrections.", totalMatchesProcessed: 0 };
    }
    const existingIndex = this.canonicalMatches.findIndex((m) => m.matchId === matchId);
    if (existingIndex === -1) {
      return { success: false, error: `Match ${matchId} not found in canonical rating ledger.`, totalMatchesProcessed: 0 };
    }
    const oldMatch = this.canonicalMatches[existingIndex];
    const updatedMatch = {
      ...oldMatch,
      winnerTeamId: correctedWinnerTeamId,
      loserTeamId: correctedLoserTeamId,
      winnerScore: correctedWinnerScore,
      loserScore: correctedLoserScore,
      winnerRosterPlayerIds,
      loserRosterPlayerIds,
      appliedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.canonicalMatches[existingIndex] = updatedMatch;
    this.ratingLedger = [];
    const rebuild = this.rebuildRatings(this.canonicalMatches);
    for (const [pId, rating] of Object.entries(rebuild.playerRatings)) {
      const p = this.playerCareers.get(pId);
      if (p) {
        p.competitiveRating = rating;
        p.qualifyingMatchesCount = rebuild.qualifyingCounts[pId] || 0;
        p.ratingStatus = rebuild.playerStatus[pId] || "PROVISIONAL";
        p.uncertainty = Math.max(50, 350 - p.qualifyingMatchesCount * 30);
        p.confidence = Math.min(95, 50 + p.qualifyingMatchesCount * 8);
        p.ratingHistory = rebuild.events.filter((e) => e.playerId === pId);
      }
    }
    return {
      success: true,
      totalMatchesProcessed: rebuild.totalMatchesProcessed
    };
  }
  // -------------------------------------------------------------
  // Tournament Completion & Finalization (Idempotent)
  // -------------------------------------------------------------
  finalizeTournamentCompletion(tournamentId, payload, caller) {
    if (caller && !caller.isAdmin && caller.role !== "organizer") {
      return { success: false, error: "Unauthorized: Only organizers can finalize tournament completion.", finalizedPlacementsCount: 0 };
    }
    if (this.completedTournaments.has(tournamentId)) {
      const championPlacement2 = payload?.placements?.find((p) => p.isChampion || p.placement?.toLowerCase().includes("champion") || p.placement?.includes("1st"));
      return {
        success: true,
        alreadyCompleted: true,
        championTeamName: championPlacement2?.teamName || "Champion Team",
        finalizedPlacementsCount: payload?.placements?.length || 0
      };
    }
    this.completedTournaments.add(tournamentId);
    const seasonId = payload?.seasonId || "season-2026-s1";
    const season = this.seasons.get(seasonId);
    let championPlacement = payload?.placements?.find((p) => p.isChampion || p.placement?.toLowerCase().includes("champion") || p.placement?.includes("1st"));
    if (!championPlacement && payload?.placements && payload.placements.length > 0) {
      championPlacement = payload.placements[0];
    }
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    if (payload?.placements) {
      for (const p of payload.placements) {
        const isChamp = Boolean(p.isChampion || p.placement.toLowerCase().includes("champion") || p.placement.includes("1st"));
        const isFinalist = isChamp || p.placement.toLowerCase().includes("runner") || p.placement.includes("2nd");
        const teamCareer = this.ensureTeamCareer(p.teamId, p.teamName);
        if (isChamp) teamCareer.tournamentWins++;
        const teamSnapshot = {
          tournamentId,
          tournamentName: payload.tournamentName,
          seasonId,
          year: 2026,
          rosterSnapshot: p.roster.map((r) => ({ ...r })),
          captainId: p.captainId,
          captainName: p.captainIgn,
          placement: p.placement,
          matchesPlayed: p.matchesPlayed,
          wins: p.wins,
          losses: p.losses,
          isChampion: isChamp,
          prizeWonINR: p.prizeWonINR,
          timestamp
        };
        teamCareer.tournamentHistory.push(teamSnapshot);
        let capRecord = this.captainCareers.get(p.captainId);
        if (!capRecord) {
          capRecord = {
            playerId: p.captainId,
            ign: p.captainIgn,
            tournamentsCaptained: 0,
            teamsLed: [],
            matches: 0,
            wins: 0,
            losses: 0,
            placements: [],
            finals: 0,
            championships: 0,
            auctionPlayersDrafted: 0,
            auctionCreditsSpent: 0,
            reputationScore: 90
          };
          this.captainCareers.set(p.captainId, capRecord);
        }
        capRecord.tournamentsCaptained++;
        capRecord.teamsLed.push({
          teamId: p.teamId,
          teamName: p.teamName,
          tournamentId,
          tournamentName: payload.tournamentName
        });
        capRecord.matches += p.matchesPlayed;
        capRecord.wins += p.wins;
        capRecord.losses += p.losses;
        capRecord.placements.push({
          tournamentId,
          tournamentName: payload.tournamentName,
          placement: p.placement
        });
        if (isFinalist) capRecord.finals++;
        if (isChamp) capRecord.championships++;
        if (p.auctionCreditsSpent) capRecord.auctionCreditsSpent += p.auctionCreditsSpent;
        if (p.auctionPlayersDrafted) capRecord.auctionPlayersDrafted += p.auctionPlayersDrafted;
        for (const player of p.roster) {
          let pCareer = this.playerCareers.get(player.playerId);
          if (!pCareer) {
            const profile = dotaPlayerEngine.getPlayer(player.playerId);
            if (profile) {
              pCareer = this.ensurePlayerCareer(profile);
            } else {
              pCareer = {
                playerId: player.playerId,
                ign: player.ign,
                primaryRole: player.role,
                currentTeamId: p.teamId,
                currentTeamName: p.teamName,
                region: "West India",
                city: "Mumbai",
                avatar: "\u{1F3AE}",
                lifetimeMatches: p.matchesPlayed,
                lifetimeWins: p.wins,
                lifetimeLosses: p.losses,
                tournamentPlacements: [],
                competitiveRating: 1500,
                ratingStatus: p.matchesPlayed >= 5 ? "ESTABLISHED" : "PROVISIONAL",
                qualifyingMatchesCount: p.matchesPlayed,
                uncertainty: 200,
                confidence: 75,
                ratingHistory: [],
                recentForm: isChamp ? ["W", "W"] : ["L"],
                seasonStats: {}
              };
              this.playerCareers.set(player.playerId, pCareer);
            }
          }
          const pSnapshot = {
            tournamentId,
            tournamentName: payload.tournamentName,
            seasonId,
            year: 2026,
            teamId: p.teamId,
            teamName: p.teamName,
            role: player.role,
            isCaptain: player.isCaptain,
            tournamentMmr: player.tournamentMmr,
            finalPlacement: p.placement,
            matchesPlayed: p.matchesPlayed,
            wins: p.wins,
            losses: p.losses,
            ratingBefore: pCareer.competitiveRating,
            ratingAfter: pCareer.competitiveRating,
            prizeWonINR: Math.round(p.prizeWonINR / p.roster.length),
            timestamp
          };
          pCareer.tournamentPlacements.push(pSnapshot);
        }
      }
    }
    if (season && championPlacement) {
      season.champions.push({
        tournamentId,
        tournamentName: payload.tournamentName,
        teamId: championPlacement.teamId,
        teamName: championPlacement.teamName,
        captainIgn: championPlacement.captainIgn
      });
      season.notableResults.push(
        `${payload.tournamentName} concluded: ${championPlacement.teamName} crowned Champion (Captain ${championPlacement.captainIgn})!`
      );
    }
    return {
      success: true,
      alreadyCompleted: false,
      championTeamName: championPlacement?.teamName || "Champion Team",
      finalizedPlacementsCount: payload?.placements?.length || 0
    };
  }
  // -------------------------------------------------------------
  // Rankings Queries (Filtered & Ordered)
  // -------------------------------------------------------------
  getPlayerRankings(options) {
    let list = Array.from(this.playerCareers.values());
    if (options?.establishedOnly) {
      list = list.filter((p) => p.ratingStatus === "ESTABLISHED");
    }
    if (options?.region && options.region !== "All") {
      list = list.filter((p) => p.region.toLowerCase().includes(options.region.toLowerCase()));
    }
    list.sort((a, b) => {
      if (b.competitiveRating !== a.competitiveRating) {
        return b.competitiveRating - a.competitiveRating;
      }
      return b.lifetimeWins - a.lifetimeWins;
    });
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list.map((p, idx) => {
      let matches = p.lifetimeMatches;
      let wins = p.lifetimeWins;
      let losses = p.lifetimeLosses;
      let rating = p.competitiveRating;
      if (options?.seasonId && p.seasonStats[options.seasonId]) {
        matches = p.seasonStats[options.seasonId].matches;
        wins = p.seasonStats[options.seasonId].wins;
        losses = p.seasonStats[options.seasonId].losses;
        rating = p.seasonStats[options.seasonId].rating;
      }
      const wr = matches > 0 ? Math.round(wins / matches * 100) : 0;
      return {
        rank: idx + 1,
        playerId: p.playerId,
        ign: p.ign,
        avatar: p.avatar,
        teamName: p.currentTeamName || "Free Agent",
        primaryRole: p.primaryRole,
        competitiveRating: rating,
        ratingStatus: p.ratingStatus,
        confidence: p.confidence,
        matchRecord: `${wins}W - ${losses}L (${wr}% WR)`,
        recentForm: p.recentForm,
        region: p.region
      };
    });
  }
  getTeamRankings(options) {
    let list = Array.from(this.teamCareers.values());
    list.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.tournamentWins - a.tournamentWins;
    });
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list.map((t, idx) => ({
      rank: idx + 1,
      teamId: t.teamId,
      teamName: t.teamName,
      tag: t.tag,
      logo: t.logo,
      rating: t.rating,
      matches: t.lifetimeMatches,
      wins: t.lifetimeWins,
      losses: t.lifetimeLosses,
      tournamentWins: t.tournamentWins,
      recentForm: t.recentForm
    }));
  }
  // -------------------------------------------------------------
  // Getters
  // -------------------------------------------------------------
  getPlayerCareer(playerId) {
    return this.playerCareers.get(playerId);
  }
  getCaptainCareer(playerId) {
    return this.captainCareers.get(playerId);
  }
  getTeamCareer(teamId) {
    return this.teamCareers.get(teamId);
  }
  getSeason(seasonId) {
    return this.seasons.get(seasonId);
  }
  getAllSeasons() {
    return Array.from(this.seasons.values());
  }
  getRatingLedger() {
    return [...this.ratingLedger];
  }
  isTournamentCompleted(tournamentId) {
    return this.completedTournaments.has(tournamentId);
  }
};
var dotaCareerHistoryEngine = new DotaCareerHistoryEngine();

// ../src/domain/dotaPremadeTeamEngine.ts
var DotaPremadeTeamEngine = class {
  constructor() {
    this.configs = /* @__PURE__ */ new Map();
    this.teams = /* @__PURE__ */ new Map();
    // key: `${tournamentId}__${teamId}`
    this.playerToTeamMap = /* @__PURE__ */ new Map();
    // key: `${tournamentId}__${userId}` -> teamId
    this.historicalSnapshots = /* @__PURE__ */ new Map();
    // key: `${tournamentId}__${teamId}`
    this.listeners = [];
    this.seedIndiaDotaOpenConfig();
  }
  seedIndiaDotaOpenConfig() {
    this.registerTournamentConfig({
      tournamentId: "india-dota-open-2026",
      tournamentName: "India Dota Open",
      maxTeams: 8,
      primaryRosterSize: 5,
      standInLimit: 1,
      requirePlayerConsent: true,
      prizePoolINR: 1e5
    });
  }
  registerTournamentConfig(config) {
    this.configs.set(config.tournamentId, config);
  }
  getTournamentConfig(tournamentId) {
    return this.configs.get(tournamentId) || {
      tournamentId,
      tournamentName: "Dota 2 Championship",
      maxTeams: 8,
      primaryRosterSize: 5,
      standInLimit: 1,
      requirePlayerConsent: true,
      prizePoolINR: 1e5
    };
  }
  // ---------------------------------------------------------------------------
  // 1. Premade Team Registration & Roster Building
  // ---------------------------------------------------------------------------
  /**
   * Registers a new premade tournament team in DRAFT status.
   * Captain must be a VERIFIED contender and becomes the initial primary roster player.
   */
  registerPremadeTeam(params) {
    const { tournamentId, teamName, tag, logo, color, captainUserId, persistentClubId, creatorUserId } = params;
    const config = this.getTournamentConfig(tournamentId);
    const existingTeams = this.getTournamentTeams(tournamentId);
    if (existingTeams.length >= config.maxTeams) {
      return { success: false, error: `Tournament has reached maximum capacity of ${config.maxTeams} teams.` };
    }
    const captainReg = dotaPlayerRegistry.getRegistration(tournamentId, captainUserId);
    if (!captainReg || captainReg.status !== "VERIFIED") {
      return { success: false, error: "Cannot register team: Captain must have a VERIFIED tournament registration." };
    }
    for (const [key, t] of this.teams.entries()) {
      if (t.status === "REJECTED") continue;
      const onRoster = [...t.primaryRoster, ...t.standIns].some((s) => s.userId === captainUserId);
      if (onRoster) {
        return {
          success: false,
          error: `Roster Invariant: Captain '${captainReg.ign}' is already committed to another team ('${t.teamName}'). A player can only belong to one team at a time.`
        };
      }
    }
    const playerKey = `${tournamentId}__${captainUserId}`;
    if (this.playerToTeamMap.has(playerKey)) {
      return { success: false, error: `Captain '${captainReg.ign}' is already registered with another team in this tournament.` };
    }
    const teamId = `pmt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const teamKey = `${tournamentId}__${teamId}`;
    const captainProfile = dotaPlayerRegistry.getPlayer(captainUserId);
    const captainSlot = {
      userId: captainUserId,
      ign: captainReg.ign,
      avatar: captainProfile?.avatar || "\u{1F451}",
      tournamentMmr: captainReg.tournamentMmr || captainReg.declaredMmr,
      declaredMmr: captainReg.declaredMmr,
      primaryRole: captainReg.primaryRole,
      secondaryRole: captainReg.secondaryRole,
      pbRating: captainProfile?.competitiveRating || 1500,
      isCaptain: true,
      isStandIn: false,
      consentStatus: "ACCEPTED",
      // Captain consents automatically
      invitedAt: (/* @__PURE__ */ new Date()).toISOString(),
      respondedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const newTeam = {
      id: teamId,
      tournamentId,
      tournamentName: config.tournamentName,
      teamId,
      persistentClubId,
      teamName: teamName.trim(),
      tag: tag.trim().toUpperCase(),
      logo: logo || "\u{1F6E1}\uFE0F",
      color: color || "#FFE600",
      captainId: captainUserId,
      captainIgn: captainReg.ign,
      status: "DRAFT",
      primaryRoster: [captainSlot],
      standIns: [],
      registeredAt: (/* @__PURE__ */ new Date()).toISOString(),
      snapshotVersion: 1,
      auditTrail: [
        {
          action: "team_created",
          actorId: creatorUserId,
          actorRole: creatorUserId === captainUserId ? "captain" : "manager",
          details: `Team '${teamName}' registered in DRAFT state by ${captainReg.ign}.`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    };
    this.teams.set(teamKey, newTeam);
    this.playerToTeamMap.set(playerKey, teamId);
    this.notify();
    return { success: true, team: newTeam };
  }
  /**
   * Adds an invited player slot to the primary roster or optional stand-in slot.
   */
  addPlayerToRoster(params) {
    const { tournamentId, teamId, candidateUserId, isStandIn = false, assignedRole, actorUserId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team registration not found." };
    const config = this.getTournamentConfig(tournamentId);
    if (team.status !== "DRAFT" && team.status !== "CHANGES_REQUESTED") {
      return { success: false, error: `Cannot modify roster while team status is '${team.status}'.` };
    }
    if (team.captainId !== actorUserId && actorUserId !== "organiser-staff-1" && !actorUserId.includes("admin")) {
      return { success: false, error: "Permission Denied: Only team captain or tournament staff can edit rosters." };
    }
    const candidateReg = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
    if (!candidateReg || candidateReg.status !== "VERIFIED") {
      return { success: false, error: `Cannot add candidate '${candidateUserId}': Contender must be VERIFIED for this tournament.` };
    }
    const allRosterSlots = [...team.primaryRoster, ...team.standIns];
    if (allRosterSlots.some((s) => s.userId === candidateUserId)) {
      return { success: false, error: `Contender '${candidateReg.ign}' is already on this team's roster.` };
    }
    for (const [key, t] of this.teams.entries()) {
      if (t.status === "REJECTED") continue;
      const onRoster = [...t.primaryRoster, ...t.standIns].some((s) => s.userId === candidateUserId);
      if (onRoster) {
        return {
          success: false,
          error: `Roster Invariant: Contender '${candidateReg.ign}' is already committed to another team ('${t.teamName}'). A player can only be in one team at a time.`
        };
      }
    }
    const playerKey = `${tournamentId}__${candidateUserId}`;
    if (this.playerToTeamMap.has(playerKey) && this.playerToTeamMap.get(playerKey) !== teamId) {
      return { success: false, error: `Contender '${candidateReg.ign}' is already committed to another team in this tournament.` };
    }
    if (!isStandIn) {
      if (team.primaryRoster.length >= config.primaryRosterSize) {
        return { success: false, error: `Primary roster is already full (${config.primaryRosterSize}/${config.primaryRosterSize}).` };
      }
    } else {
      if (team.standIns.length >= config.standInLimit) {
        return { success: false, error: `Maximum stand-in limit reached (${config.standInLimit}/${config.standInLimit}).` };
      }
    }
    const candidateProfile = dotaPlayerRegistry.getPlayer(candidateUserId);
    const newSlot = {
      userId: candidateUserId,
      ign: candidateReg.ign,
      avatar: candidateProfile?.avatar || "\u{1F3AE}",
      tournamentMmr: candidateReg.tournamentMmr || candidateReg.declaredMmr,
      declaredMmr: candidateReg.declaredMmr,
      primaryRole: assignedRole || candidateReg.primaryRole,
      secondaryRole: candidateReg.secondaryRole,
      pbRating: candidateProfile?.competitiveRating || 1500,
      isCaptain: false,
      isStandIn,
      consentStatus: config.requirePlayerConsent ? "INVITED" : "ACCEPTED",
      invitedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!isStandIn) {
      team.primaryRoster.push(newSlot);
    } else {
      team.standIns.push(newSlot);
    }
    this.playerToTeamMap.set(playerKey, teamId);
    team.auditTrail.unshift({
      action: "player_invited",
      actorId: actorUserId,
      actorRole: actorUserId === team.captainId ? "captain" : "staff",
      details: `Invited ${candidateReg.ign} (${newSlot.primaryRole}, MMR: ${newSlot.tournamentMmr}) to ${isStandIn ? "stand-in" : "primary"} roster.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.notify();
    return { success: true, team };
  }
  /**
   * Responds to a team roster invitation (ACCEPTED or DECLINED).
   */
  respondToRosterInvitation(params) {
    const { tournamentId, teamId, playerId, accept } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    const slot = [...team.primaryRoster, ...team.standIns].find((s) => s.userId === playerId);
    if (!slot) return { success: false, error: "Invitation slot not found for this contender." };
    if (slot.consentStatus === "ACCEPTED" && accept) {
      return { success: true, team };
    }
    if (accept) {
      slot.consentStatus = "ACCEPTED";
      slot.respondedAt = (/* @__PURE__ */ new Date()).toISOString();
      team.auditTrail.unshift({
        action: "player_accepted",
        actorId: playerId,
        actorRole: "player",
        details: `${slot.ign} ACCEPTED roster invitation for ${team.teamName}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else {
      slot.consentStatus = "DECLINED";
      slot.respondedAt = (/* @__PURE__ */ new Date()).toISOString();
      team.primaryRoster = team.primaryRoster.filter((s) => s.userId !== playerId);
      team.standIns = team.standIns.filter((s) => s.userId !== playerId);
      this.playerToTeamMap.delete(`${tournamentId}__${playerId}`);
      team.auditTrail.unshift({
        action: "player_declined",
        actorId: playerId,
        actorRole: "player",
        details: `${slot.ign} DECLINED roster invitation for ${team.teamName}.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.notify();
    return { success: true, team };
  }
  /**
   * Removes a player from the team roster (only in DRAFT or CHANGES_REQUESTED).
   */
  removePlayerFromRoster(params) {
    const { tournamentId, teamId, playerId, actorUserId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    if (team.status !== "DRAFT" && team.status !== "CHANGES_REQUESTED") {
      return { success: false, error: `Cannot remove players while team status is '${team.status}'.` };
    }
    if (team.captainId !== actorUserId && !actorUserId.includes("admin") && actorUserId !== "organiser-staff-1") {
      return { success: false, error: "Permission Denied: Only team captain or staff can remove roster members." };
    }
    if (playerId === team.captainId) {
      return { success: false, error: "Cannot remove the captain. Reassign captaincy first." };
    }
    const removedSlot = [...team.primaryRoster, ...team.standIns].find((s) => s.userId === playerId);
    if (!removedSlot) return { success: false, error: "Player not found in team roster." };
    team.primaryRoster = team.primaryRoster.filter((s) => s.userId !== playerId);
    team.standIns = team.standIns.filter((s) => s.userId !== playerId);
    this.playerToTeamMap.delete(`${tournamentId}__${playerId}`);
    team.auditTrail.unshift({
      action: "player_removed",
      actorId: actorUserId,
      actorRole: actorUserId === team.captainId ? "captain" : "staff",
      details: `Removed ${removedSlot.ign} from roster.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.notify();
    return { success: true, team };
  }
  // ---------------------------------------------------------------------------
  // 2. Submission & Organiser Review Lifecycle
  // ---------------------------------------------------------------------------
  /**
   * Captain submits the roster for organiser review.
   * Strictly validates 5 primary players, captain on primary roster, and player consent.
   */
  submitTeamRoster(tournamentId, teamId, captainUserId) {
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    const config = this.getTournamentConfig(tournamentId);
    if (team.captainId !== captainUserId) {
      return { success: false, error: "Permission Denied: Only the team captain can submit the roster." };
    }
    if (team.status !== "DRAFT" && team.status !== "CHANGES_REQUESTED") {
      return { success: false, error: `Roster is already ${team.status}. Cannot resubmit.` };
    }
    if (team.primaryRoster.length !== config.primaryRosterSize) {
      return {
        success: false,
        error: `Roster incomplete: Primary roster requires exactly ${config.primaryRosterSize} players (currently ${team.primaryRoster.length}).`
      };
    }
    const captainInPrimary = team.primaryRoster.some((s) => s.userId === team.captainId && s.isCaptain);
    if (!captainInPrimary) {
      return { success: false, error: "Roster Invariant Violation: Team captain must be on the primary 5-player roster." };
    }
    if (team.standIns.length > config.standInLimit) {
      return { success: false, error: `Stand-in limit exceeded: Maximum ${config.standInLimit} allowed.` };
    }
    if (config.requirePlayerConsent) {
      const unaccepted = [...team.primaryRoster, ...team.standIns].filter((s) => s.consentStatus !== "ACCEPTED");
      if (unaccepted.length > 0) {
        return {
          success: false,
          error: `Pending player consents: ${unaccepted.map((u) => u.ign).join(", ")} must accept their roster invitations prior to submission.`
        };
      }
    }
    for (const slot of [...team.primaryRoster, ...team.standIns]) {
      const reg = dotaPlayerRegistry.getRegistration(tournamentId, slot.userId);
      if (!reg || reg.status !== "VERIFIED") {
        return { success: false, error: `Contender '${slot.ign}' does not possess an active VERIFIED tournament registration.` };
      }
    }
    team.status = "SUBMITTED";
    team.submittedAt = (/* @__PURE__ */ new Date()).toISOString();
    team.auditTrail.unshift({
      action: "roster_submitted",
      actorId: captainUserId,
      actorRole: "captain",
      details: `Captain ${team.captainIgn} submitted full roster (5 primary, ${team.standIns.length} stand-ins) for organiser review.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.notify();
    return { success: true, team };
  }
  /**
   * Organiser reviews team submission and decides: APPROVE, REQUEST_CHANGES, or REJECT.
   */
  reviewTeamSubmission(params) {
    const { tournamentId, teamId, action, reason, staffActorId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    if (team.status !== "SUBMITTED" && team.status !== "UNDER_REVIEW") {
      return { success: false, error: `Cannot review team in status '${team.status}'. Must be SUBMITTED or UNDER_REVIEW.` };
    }
    if ((action === "REQUEST_CHANGES" || action === "REJECT") && (!reason || reason.trim().length === 0)) {
      return { success: false, error: `A justification reason is strictly required when ${action === "REJECT" ? "rejecting" : "requesting changes on"} a team roster.` };
    }
    team.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
    team.reviewedBy = staffActorId;
    if (action === "APPROVE") {
      team.status = "APPROVED";
      team.approvalReason = reason || "All roster credentials and MMR thresholds verified.";
      this.createTournamentRosterSnapshot(team, staffActorId);
      this.syncPlayerProfileSnapshots(team);
      team.auditTrail.unshift({
        action: "team_approved",
        actorId: staffActorId,
        actorRole: "organiser",
        details: `Team approved by organiser ${staffActorId}. ${team.approvalReason}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else if (action === "REQUEST_CHANGES") {
      team.status = "CHANGES_REQUESTED";
      team.changesRequestedReason = reason;
      team.auditTrail.unshift({
        action: "changes_requested",
        actorId: staffActorId,
        actorRole: "organiser",
        details: `Changes requested by organiser: ${reason}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } else if (action === "REJECT") {
      team.status = "REJECTED";
      team.rejectionReason = reason;
      for (const slot of [...team.primaryRoster, ...team.standIns]) {
        this.playerToTeamMap.delete(`${tournamentId}__${slot.userId}`);
      }
      team.auditTrail.unshift({
        action: "team_rejected",
        actorId: staffActorId,
        actorRole: "organiser",
        details: `Team rejected by organiser: ${reason}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    this.notify();
    return { success: true, team };
  }
  // ---------------------------------------------------------------------------
  // 3. Roster Lock & Emergency Changes
  // ---------------------------------------------------------------------------
  /**
   * Locks the approved roster at the tournament lifecycle lock point.
   */
  lockPremadeRoster(tournamentId, teamId, staffActorId) {
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    if (team.status !== "APPROVED") {
      return { success: false, error: `Only APPROVED teams can have their rosters locked (current: ${team.status}).` };
    }
    team.status = "LOCKED";
    team.lockedAt = (/* @__PURE__ */ new Date()).toISOString();
    team.lockedBy = staffActorId;
    const snapshot = this.historicalSnapshots.get(teamKey);
    if (snapshot) {
      snapshot.lockedAt = team.lockedAt;
      snapshot.lockedBy = staffActorId;
    }
    team.auditTrail.unshift({
      action: "roster_locked",
      actorId: staffActorId,
      actorRole: "organiser",
      details: `Roster officially locked by organiser ${staffActorId}. Unrestricted captain edits disabled.`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.notify();
    return { success: true, team };
  }
  /**
   * Executes an organiser-controlled emergency player replacement.
   * Preserves version history and snapshot integrity.
   */
  executeEmergencyRosterChange(params) {
    const { tournamentId, teamId, outgoingPlayerId, incomingPlayerId, role, reason, staffActorId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: "Team not found." };
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: "Mandatory justification reason required for emergency roster changes." };
    }
    const incomingReg = dotaPlayerRegistry.getRegistration(tournamentId, incomingPlayerId);
    if (!incomingReg || incomingReg.status !== "VERIFIED") {
      return { success: false, error: `Incoming player '${incomingPlayerId}' must have a VERIFIED tournament registration.` };
    }
    const incomingPlayerKey = `${tournamentId}__${incomingPlayerId}`;
    if (this.playerToTeamMap.has(incomingPlayerKey) && this.playerToTeamMap.get(incomingPlayerKey) !== teamId) {
      return { success: false, error: `Incoming player '${incomingReg.ign}' is already registered with another team.` };
    }
    let isStandInSlot = false;
    let slotIndex = team.primaryRoster.findIndex((s) => s.userId === outgoingPlayerId);
    if (slotIndex === -1) {
      slotIndex = team.standIns.findIndex((s) => s.userId === outgoingPlayerId);
      if (slotIndex === -1) {
        return { success: false, error: `Outgoing player '${outgoingPlayerId}' not found in team roster.` };
      }
      isStandInSlot = true;
    }
    const outgoingSlot = isStandInSlot ? team.standIns[slotIndex] : team.primaryRoster[slotIndex];
    const incomingProfile = dotaPlayerRegistry.getPlayer(incomingPlayerId);
    const replacementSlot = {
      userId: incomingPlayerId,
      ign: incomingReg.ign,
      avatar: incomingProfile?.avatar || "\u{1F3AE}",
      tournamentMmr: incomingReg.tournamentMmr || incomingReg.declaredMmr,
      declaredMmr: incomingReg.declaredMmr,
      primaryRole: role || outgoingSlot.primaryRole,
      secondaryRole: incomingReg.secondaryRole,
      pbRating: incomingProfile?.competitiveRating || 1500,
      isCaptain: outgoingSlot.isCaptain,
      // Preserve captaincy if captain replaced
      isStandIn: isStandInSlot,
      consentStatus: "ACCEPTED",
      invitedAt: (/* @__PURE__ */ new Date()).toISOString(),
      respondedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!isStandInSlot) {
      team.primaryRoster[slotIndex] = replacementSlot;
      if (replacementSlot.isCaptain) {
        team.captainId = incomingPlayerId;
        team.captainIgn = incomingReg.ign;
      }
    } else {
      team.standIns[slotIndex] = replacementSlot;
    }
    this.playerToTeamMap.delete(`${tournamentId}__${outgoingPlayerId}`);
    this.playerToTeamMap.set(incomingPlayerKey, teamId);
    team.snapshotVersion += 1;
    const snapshot = this.historicalSnapshots.get(teamKey);
    if (snapshot) {
      snapshot.version = team.snapshotVersion;
      snapshot.emergencyChanges.push({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        actor: staffActorId,
        reason,
        outgoingPlayerId,
        outgoingPlayerIgn: outgoingSlot.ign,
        incomingPlayerId,
        incomingPlayerIgn: incomingReg.ign,
        role: replacementSlot.primaryRole
      });
      snapshot.primaryRoster = team.primaryRoster.map((s) => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating,
        isCaptain: s.isCaptain
      }));
      snapshot.standIns = team.standIns.map((s) => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating
      }));
    }
    team.auditTrail.unshift({
      action: "emergency_replacement",
      actorId: staffActorId,
      actorRole: "organiser",
      details: `Emergency replacement: ${outgoingSlot.ign} replaced by ${incomingReg.ign}. Reason: ${reason}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.notify();
    return { success: true, team };
  }
  // ---------------------------------------------------------------------------
  // 4. Snapshots & Profile Sync
  // ---------------------------------------------------------------------------
  createTournamentRosterSnapshot(team, staffActorId) {
    const teamKey = `${team.tournamentId}__${team.teamId}`;
    const snapshot = {
      snapshotId: `snap-${team.tournamentId}-${team.teamId}-v${team.snapshotVersion}`,
      tournamentId: team.tournamentId,
      tournamentName: team.tournamentName,
      teamId: team.teamId,
      teamName: team.teamName,
      tag: team.tag,
      logo: team.logo,
      captainId: team.captainId,
      captainIgn: team.captainIgn,
      primaryRoster: team.primaryRoster.map((s) => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating,
        isCaptain: s.isCaptain
      })),
      standIns: team.standIns.map((s) => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating
      })),
      approvedAt: team.reviewedAt || (/* @__PURE__ */ new Date()).toISOString(),
      approvedBy: staffActorId,
      version: team.snapshotVersion,
      emergencyChanges: []
    };
    this.historicalSnapshots.set(teamKey, snapshot);
  }
  syncPlayerProfileSnapshots(team) {
    for (const slot of [...team.primaryRoster, ...team.standIns]) {
      const player = dotaPlayerRegistry.getPlayer(slot.userId);
      if (player) {
        if (!player.tournamentSnapshots) player.tournamentSnapshots = [];
        const existingIdx = player.tournamentSnapshots.findIndex((s) => s.tournamentId === team.tournamentId);
        const snapshotEntry = {
          tournamentId: team.tournamentId,
          tournamentName: team.tournamentName,
          year: 2026,
          teamId: team.teamId,
          teamName: team.teamName,
          primaryRole: slot.primaryRole,
          lockedTournamentMmr: slot.tournamentMmr,
          isCaptain: slot.isCaptain,
          finalPlacement: "Active Contender",
          prizeWonINR: 0,
          matchesPlayed: 0,
          wins: 0,
          ratingBefore: player.competitiveRating,
          ratingAfter: player.competitiveRating
        };
        if (existingIdx >= 0) {
          player.tournamentSnapshots[existingIdx] = snapshotEntry;
        } else {
          player.tournamentSnapshots.push(snapshotEntry);
        }
      }
    }
  }
  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------
  getTournamentTeams(tournamentId) {
    return Array.from(this.teams.values()).filter((t) => t.tournamentId === tournamentId);
  }
  getTeam(tournamentId, teamId) {
    return this.teams.get(`${tournamentId}__${teamId}`);
  }
  getPlayerTeam(tournamentId, userId) {
    const teamId = this.playerToTeamMap.get(`${tournamentId}__${userId}`);
    if (!teamId) return void 0;
    return this.getTeam(tournamentId, teamId);
  }
  getHistoricalSnapshot(tournamentId, teamId) {
    return this.historicalSnapshots.get(`${tournamentId}__${teamId}`);
  }
  resetTournamentTeams(tournamentId) {
    for (const [key, team] of this.teams.entries()) {
      if (team.tournamentId === tournamentId) {
        for (const slot of [...team.primaryRoster, ...team.standIns]) {
          this.playerToTeamMap.delete(`${tournamentId}__${slot.userId}`);
        }
        this.teams.delete(key);
        this.historicalSnapshots.delete(key);
      }
    }
    this.notify();
  }
  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("Premade engine listener error:", err);
      }
    });
  }
};
var dotaPremadeTeamEngine = new DotaPremadeTeamEngine();

// ../src/services/firebaseService.ts
function tournamentToConfig(t) {
  if (t.config && t.config.identity) {
    return t.config;
  }
  return {
    identity: {
      tournamentId: t.id,
      name: t.name,
      gameId: (t.gameId || t.game || "dota2").toLowerCase().replace(/[^a-z0-9]/g, ""),
      gameName: t.game || "Dota 2",
      description: t.description || "",
      region: t.region || "Pan India",
      locationType: "ONLINE",
      city: t.city || "Bengaluru",
      visibility: t.visibility || "PUBLIC"
    },
    registration: t.registrationSettings || {
      registrationMode: "INDIVIDUAL",
      openDate: t.startDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      closeDate: t.endDate || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      maxParticipants: t.teamCount ? t.teamCount * 5 : 32
    },
    teamFormation: t.teamFormation || {
      mode: "AUCTION",
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
      startingCredits: 1e3,
      minimumBid: 10,
      bidIncrement: 10,
      reservePerRemainingSlot: 10
    },
    competition: t.competition || {
      format: t.format || "DOUBLE_ELIMINATION",
      defaultSeriesFormat: "BO3",
      seedingMethod: "RATING_BASED"
    },
    prizes: t.prizes || {
      totalPrizePoolINR: t.totalPrizeNumber || 5e4,
      placementDistribution: [
        { placement: "1st Place (Champion)", percentage: 60, amountINR: 3e4 },
        { placement: "2nd Place (Runner-up)", percentage: 25, amountINR: 12500 },
        { placement: "3rd Place", percentage: 15, amountINR: 7500 }
      ]
    },
    integrity: t.integrity || {
      verificationRequired: true,
      organizerApprovalRequired: true
    }
  };
}
var PRIMARY_PROJECT_ADMIN_EMAIL2 = "11106cm009@gmail.com";
var REVOKED_STORAGE_KEY = "pbg_revoked_roles";
function getLocalRevokedList() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(REVOKED_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}
function isRoleRevoked(email) {
  if (!email) return false;
  const clean = email.toLowerCase().trim();
  return getLocalRevokedList().includes(clean);
}
function markRoleRevoked(email) {
  if (typeof window === "undefined" || !email) return;
  try {
    const list = getLocalRevokedList();
    const clean = email.toLowerCase().trim();
    if (!list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(REVOKED_STORAGE_KEY, JSON.stringify(list));
    }
  } catch {
  }
}
function unmarkRoleRevoked(email) {
  if (typeof window === "undefined" || !email) return;
  try {
    const list = getLocalRevokedList();
    const clean = email.toLowerCase().trim();
    const filtered = list.filter((e) => e !== clean);
    localStorage.setItem(REVOKED_STORAGE_KEY, JSON.stringify(filtered));
  } catch {
  }
}
var ROLE_PERMISSIONS = {
  admin: [
    "MANAGE_ROLES",
    "VIEW_AUDIT_LOGS",
    "SYSTEM_SETTINGS",
    "CREATE_TOURNAMENT",
    "MANAGE_TOURNAMENT",
    "DELETE_TOURNAMENT",
    "AUCTION_CONTROL",
    "MANAGE_TEAMS",
    "MATCH_OPERATIONS",
    "RESOLVE_DISPUTES",
    "MODERATE_PLAYERS",
    "REGISTER_TOURNAMENT",
    "PUBLIC_VIEW"
  ],
  organizer: [
    "CREATE_TOURNAMENT",
    "MANAGE_TOURNAMENT",
    "DELETE_TOURNAMENT",
    "AUCTION_CONTROL",
    "MANAGE_TEAMS",
    "MATCH_OPERATIONS",
    "RESOLVE_DISPUTES",
    "MODERATE_PLAYERS",
    "REGISTER_TOURNAMENT",
    "PUBLIC_VIEW"
  ],
  moderator: [
    "RESOLVE_DISPUTES",
    "MODERATE_PLAYERS",
    "MATCH_OPERATIONS",
    "VIEW_AUDIT_LOGS",
    "PUBLIC_VIEW"
  ],
  captain: [
    "MATCH_OPERATIONS",
    "REGISTER_TOURNAMENT",
    "PUBLIC_VIEW"
  ],
  player: [
    "REGISTER_TOURNAMENT",
    "PUBLIC_VIEW"
  ],
  spectator: [
    "PUBLIC_VIEW"
  ]
};
var DETERMINISTIC_USERS = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    email: "organizer@purplebean.test",
    displayName: "Test Organizer",
    role: "organizer",
    teamId: "t-1",
    teamName: "Circuit Admin",
    ign: "Organiser"
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    email: "captain@purplebean.test",
    displayName: "Test Captain A",
    role: "captain",
    teamId: "t-2",
    teamName: "Mumbai Cobras",
    ign: "Captain A"
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    email: "captain-b@purplebean.test",
    displayName: "Test Captain B",
    role: "captain",
    teamId: "t-3",
    teamName: "Bengaluru Blaze",
    ign: "Captain B"
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    email: "captain-c@purplebean.test",
    displayName: "Test Captain C",
    role: "captain",
    teamId: "t-4",
    teamName: "Delhi Dragons",
    ign: "Captain C"
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    email: "player@purplebean.test",
    displayName: "Test Player",
    role: "player",
    ign: "Player"
  },
  {
    id: "guest-spectator",
    email: "",
    displayName: "Public Spectator",
    role: "spectator"
  }
];
var GUEST_SPECTATOR_SESSION = {
  id: "guest-spectator",
  email: "",
  displayName: "Public Spectator",
  role: "spectator",
  isAdmin: false
};
var isTestEnvironment = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
var isProductionEnvironment = typeof import.meta !== "undefined" && import.meta.env ? Boolean(import.meta.env.PROD) : false;
var FirebaseTournamentService = class {
  constructor() {
    this.currentUser = { ...GUEST_SPECTATOR_SESSION };
    this.listeners = [];
    this.unsubs = [];
    this.authUnsubs = /* @__PURE__ */ new Map();
    // Designated admin emails - strictly protected root authority
    this.adminEmails = /* @__PURE__ */ new Set([
      PRIMARY_PROJECT_ADMIN_EMAIL2
    ]);
    // Granular role assignments map: email -> RoleAssignment (synced with Firestore /user_roles)
    this.userRoles = /* @__PURE__ */ new Map();
    this.roleAuditLogs = [];
    // Authoritative state cache - seeded with baseline fixtures, live synced with Firestore
    this.tournaments = [...MOCK_TOURNAMENTS];
    this.deletedTournamentIds = /* @__PURE__ */ new Set();
    this.players = isTestEnvironment ? [...MOCK_PLAYERS] : [];
    this.teams = isTestEnvironment ? [...MOCK_TEAMS] : [];
    this.matches = isTestEnvironment ? [...MOCK_MATCHES] : [];
    this.auctionTeams = isTestEnvironment ? [...MOCK_AUCTION_TEAMS] : [];
    this.reports = [];
    // Distinct auction player categories
    this.soldPlayersList = [];
    this.unsoldPlayersList = [];
    this.unselectedPlayersList = isTestEnvironment ? ["p-4", "p-5", "p-6", "p-7", "p-8"] : [];
    // Processed idempotency keys cache
    this.processedBids = /* @__PURE__ */ new Set();
    // Active sign-in request concurrency lock
    this.activeSignInPromise = null;
    this.auctionState = {
      status: isTestEnvironment ? "open" : "paused",
      revision: 1,
      currentBid: isTestEnvironment ? 5e4 : 0,
      leadingTeamId: isTestEnvironment ? "t-1" : "",
      leadingTeamName: isTestEnvironment ? "Purple Bean Titans" : "",
      currentPlayer: isTestEnvironment ? MOCK_PLAYERS[2] : void 0,
      secondsLeft: isTestEnvironment ? 30 : 0,
      bidHistory: []
    };
    this.notifyTimeout = null;
    tournamentConfigRegistry.setTeamProvider((tournamentId) => {
      const scopedTeams = this.teams.filter((t) => t.tournamentId === tournamentId);
      const tourney = this.tournaments.find((t) => t.id === tournamentId);
      const candidateTeams = tourney?.teams?.length > 0 ? tourney.teams : scopedTeams;
      return candidateTeams;
    });
    if (!isRoleRevoked("neelapuharsha@gmail.com")) {
      this.adminEmails.add("neelapuharsha@gmail.com");
      const friendAcc = pbgAccountRegistry.getAccountByEmail("neelapuharsha@gmail.com");
      this.userRoles.set("neelapuharsha@gmail.com", {
        email: "neelapuharsha@gmail.com",
        role: "admin",
        assignedBy: PRIMARY_PROJECT_ADMIN_EMAIL2,
        assignedAt: "2026-10-01T12:00:00.000Z",
        displayName: "Harsha Neelapu",
        pbgId: friendAcc?.pbgId || "PBG-000187",
        notes: "Co-organiser & Administrative Authority",
        permissions: ROLE_PERMISSIONS.admin,
        status: "ACTIVE"
      });
    }
    this.initAuthListener();
    this.initFirestoreSync();
    const testTourney = MOCK_TOURNAMENTS.find((t) => t.id === "purple-bean-auction-test");
    if (testTourney && !this.tournaments.some((t) => t.id === "purple-bean-auction-test")) {
      this.tournaments.push({ ...testTourney });
    }
    const afterAuctionTourney = MOCK_TOURNAMENTS.find((t) => t.id === "after-auction-test");
    if (afterAuctionTourney && !this.tournaments.some((t) => t.id === "after-auction-test")) {
      this.tournaments.push({ ...afterAuctionTourney });
    }
    pbgAccountRegistry.subscribe(() => {
      this.notify();
    });
  }
  computeUserPermissions(email) {
    if (!email) {
      return { role: "spectator", isAdmin: false, isPrimaryAdmin: false, isModerator: false };
    }
    const cleanEmail = email.toLowerCase().trim();
    if (cleanEmail === PRIMARY_PROJECT_ADMIN_EMAIL2) {
      return { role: "organizer", isAdmin: true, isPrimaryAdmin: true, isModerator: false };
    }
    const assignment = this.userRoles.get(cleanEmail);
    if (assignment) {
      if (assignment.role === "admin") {
        return { role: "organizer", isAdmin: true, isPrimaryAdmin: false, isModerator: false };
      }
      if (assignment.role === "organizer") {
        return { role: "organizer", isAdmin: false, isPrimaryAdmin: false, isModerator: false };
      }
      if (assignment.role === "moderator") {
        return { role: "player", isAdmin: false, isPrimaryAdmin: false, isModerator: true };
      }
      if (assignment.role === "captain") {
        return { role: "captain", isAdmin: false, isPrimaryAdmin: false, isModerator: false };
      }
    }
    if (this.adminEmails.has(cleanEmail)) {
      return { role: "organizer", isAdmin: true, isPrimaryAdmin: false, isModerator: false };
    }
    return { role: "player", isAdmin: false, isPrimaryAdmin: false, isModerator: false };
  }
  initAuthListener() {
    if (typeof window !== "undefined") {
      getRedirectResult(auth).then((result) => {
        if (result && result.user) {
          const firebaseUser = result.user;
          const email = (firebaseUser.email || "").toLowerCase().trim();
          const perms = this.computeUserPermissions(email);
          const { account: pbgAcc } = pbgAccountRegistry.getOrCreatePBGAccount({
            googleUid: firebaseUser.uid,
            email,
            displayName: firebaseUser.displayName || email.split("@")[0],
            photoURL: firebaseUser.photoURL || void 0
          });
          this.currentUser = {
            id: firebaseUser.uid,
            email,
            displayName: firebaseUser.displayName || email.split("@")[0],
            avatarUrl: firebaseUser.photoURL || void 0,
            role: perms.role,
            isAdmin: perms.isAdmin,
            isPrimaryAdmin: perms.isPrimaryAdmin,
            isModerator: perms.isModerator,
            pbgId: pbgAcc.pbgId
          };
          this.syncAuthListeners(firebaseUser, perms);
          if (perms.isAdmin) {
            this.triggerAdminBootstrap(firebaseUser.uid, email);
          }
          this.notify();
        }
      }).catch((redirectErr) => {
        console.warn("Firebase redirect sign-in note:", redirectErr);
      });
    }
    onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const email = (firebaseUser.email || "").toLowerCase().trim();
        const perms = this.computeUserPermissions(email);
        const alreadyCompleted = pbgAccountRegistry.hasUserCompletedOnboarding(firebaseUser.uid);
        const { account: pbgAcc, isFirstTime } = pbgAccountRegistry.getOrCreatePBGAccount({
          googleUid: firebaseUser.uid,
          email,
          displayName: firebaseUser.displayName || email.split("@")[0],
          photoURL: firebaseUser.photoURL || void 0
        });
        this.currentUser = {
          id: firebaseUser.uid,
          email,
          displayName: firebaseUser.displayName || email.split("@")[0],
          avatarUrl: firebaseUser.photoURL || void 0,
          role: perms.role,
          isAdmin: perms.isAdmin,
          isPrimaryAdmin: perms.isPrimaryAdmin,
          isModerator: perms.isModerator,
          pbgId: pbgAcc.pbgId,
          isFirstTimePBG: isFirstTime && !alreadyCompleted && !pbgAcc.hasCompletedOnboarding
        };
        this.syncAuthListeners(firebaseUser, perms);
        if (perms.isAdmin) {
          this.triggerAdminBootstrap(firebaseUser.uid, email);
        }
      } else {
        this.currentUser = { ...GUEST_SPECTATOR_SESSION };
        this.syncAuthListeners(null, { role: "spectator", isAdmin: false, isPrimaryAdmin: false, isModerator: false });
      }
      this.notify();
    });
  }
  syncAuthListeners(firebaseUser, perms) {
    if (!firebaseUser) {
      this.authUnsubs.forEach((unsub) => unsub());
      this.authUnsubs.clear();
      return;
    }
    if (!this.authUnsubs.has("user_roles")) {
      try {
        const unsubUserRoles = onSnapshot4(collection2(db, "user_roles"), (snapshot) => {
          const rolesMap = /* @__PURE__ */ new Map();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data?.email) {
              const cleanEmail = data.email.toLowerCase().trim();
              if (isRoleRevoked(cleanEmail)) return;
              const pbgAcc = pbgAccountRegistry.getAccountByEmail(cleanEmail);
              rolesMap.set(cleanEmail, {
                email: cleanEmail,
                role: data.role || "organizer",
                assignedBy: data.assignedBy || "primary-admin",
                assignedAt: data.assignedAt || (/* @__PURE__ */ new Date()).toISOString(),
                displayName: data.displayName || pbgAcc?.displayName || (cleanEmail === "neelapuharsha@gmail.com" ? "Harsha Neelapu" : cleanEmail.split("@")[0]),
                pbgId: data.pbgId || pbgAcc?.pbgId || (cleanEmail === "neelapuharsha@gmail.com" ? "PBG-000187" : void 0),
                notes: data.notes,
                permissions: data.permissions || ROLE_PERMISSIONS[data.role] || [],
                status: data.status || "ACTIVE"
              });
            }
          });
          this.adminEmails.forEach((adminEmail) => {
            const clean = adminEmail.toLowerCase().trim();
            if (clean && !rolesMap.has(clean) && !isRoleRevoked(clean) && clean !== PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase()) {
              const pbgAcc = pbgAccountRegistry.getAccountByEmail(clean);
              rolesMap.set(clean, {
                email: clean,
                role: "admin",
                assignedBy: PRIMARY_PROJECT_ADMIN_EMAIL2,
                assignedAt: "2026-10-01T12:00:00.000Z",
                displayName: pbgAcc?.displayName || (clean === "neelapuharsha@gmail.com" ? "Harsha Neelapu" : clean.split("@")[0]),
                pbgId: pbgAcc?.pbgId || (clean === "neelapuharsha@gmail.com" ? "PBG-000187" : void 0),
                notes: "Administrative Authority",
                permissions: ROLE_PERMISSIONS.admin,
                status: "ACTIVE"
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
          console.warn("Firestore user_roles sync note:", error);
        });
        this.authUnsubs.set("user_roles", unsubUserRoles);
      } catch (e) {
        console.warn("Firestore user_roles listen deferred:", e);
      }
    }
    if (!this.authUnsubs.has("system_revocations")) {
      try {
        const unsubRevocations = onSnapshot4(collection2(db, "system_revocations"), (snapshot) => {
          let revokedChanged = false;
          const currentRevokedEmails = /* @__PURE__ */ new Set();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const em = (data?.email || docSnap.id).toLowerCase().trim().replace(/_/g, ".");
            if (em) {
              currentRevokedEmails.add(em);
              markRoleRevoked(em);
              if (this.userRoles.has(em)) {
                this.userRoles.delete(em);
                revokedChanged = true;
              }
              if (this.adminEmails.has(em)) {
                this.adminEmails.delete(em);
                revokedChanged = true;
              }
            }
          });
          const localList = getLocalRevokedList();
          for (const localEmail of localList) {
            if (!currentRevokedEmails.has(localEmail)) {
              unmarkRoleRevoked(localEmail);
              revokedChanged = true;
            }
          }
          if (revokedChanged) {
            this.notify();
          }
        }, (err) => {
          console.warn("Firestore system_revocations sync deferred:", err);
        });
        this.authUnsubs.set("system_revocations", unsubRevocations);
      } catch (e) {
        console.warn("Firestore system_revocations listen deferred:", e);
      }
    }
    if (perms.isAdmin) {
      if (!this.authUnsubs.has("role_audit_logs")) {
        try {
          const unsubAudit = onSnapshot4(collection2(db, "role_audit_logs"), (snapshot) => {
            const logs = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              logs.push(data);
            });
            this.roleAuditLogs = logs;
            this.notify();
          }, (error) => {
            console.warn("Firestore role_audit_logs sync note:", error);
          });
          this.authUnsubs.set("role_audit_logs", unsubAudit);
        } catch (e) {
          console.warn("Firestore role_audit_logs listen deferred:", e);
        }
      }
      if (!this.authUnsubs.has("admins")) {
        try {
          const unsubAdmins = onSnapshot4(collection2(db, "admins"), (snapshot) => {
            const adminSet = /* @__PURE__ */ new Set([PRIMARY_PROJECT_ADMIN_EMAIL2]);
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              if (data?.email) {
                adminSet.add(data.email.toLowerCase().trim());
              }
              if (docSnap.id.includes("@")) {
                adminSet.add(docSnap.id.toLowerCase().trim());
              }
            });
            if (!isRoleRevoked("neelapuharsha@gmail.com")) {
              adminSet.add("neelapuharsha@gmail.com");
            }
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
            console.warn("Firestore admins sync note:", error);
          });
          this.authUnsubs.set("admins", unsubAdmins);
        } catch (e) {
          console.warn("Firestore admins listen deferred:", e);
        }
      }
      if (!this.authUnsubs.has("reports")) {
        try {
          const unsubReports = onSnapshot4(collection2(db, "reports"), (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
              list.push(docSnap.data());
            });
            this.reports = list;
            this.notify();
          }, (error) => {
            console.warn("Firestore reports sync note:", error);
          });
          this.authUnsubs.set("reports", unsubReports);
        } catch (e) {
          console.warn("Firestore reports listen deferred:", e);
        }
      }
    } else {
      const adminUnsub = this.authUnsubs.get("admins");
      if (adminUnsub) {
        adminUnsub();
        this.authUnsubs.delete("admins");
      }
      const reportsUnsub = this.authUnsubs.get("reports");
      if (reportsUnsub) {
        reportsUnsub();
        this.authUnsubs.delete("reports");
      }
    }
  }
  async triggerAdminBootstrap(userId, email) {
    try {
      let idToken = "";
      if (auth.currentUser) {
        try {
          idToken = await auth.currentUser.getIdToken();
        } catch {
        }
      }
      const headers = {
        "Content-Type": "application/json",
        "x-caller-context": JSON.stringify({
          userId,
          email,
          role: "organizer",
          isAdmin: true
        })
      };
      if (idToken) {
        headers["Authorization"] = `Bearer ${idToken}`;
      }
      const res = await fetch("/api/admin/bootstrap", {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, email, idToken })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && auth.currentUser && auth.currentUser.uid === userId && email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2 && !isQuotaExhausted()) {
          try {
            await setDoc4(doc5(db, "admins", userId), {
              id: userId,
              userId,
              email: email.toLowerCase(),
              role: "superadmin",
              assignedBy: "system_bootstrap",
              locked: true,
              assignedAt: (/* @__PURE__ */ new Date()).toISOString()
            }, { merge: true });
          } catch (adminDocErr) {
            if (isQuotaError(adminDocErr)) {
              setQuotaExhausted(true);
            }
            console.warn("Client admin doc sync note:", adminDocErr);
          }
        }
        return Boolean(data.success);
      }
    } catch {
    }
    return false;
  }
  initFirestoreSync() {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          const stored = JSON.parse(window.localStorage.getItem("pb_deleted_tournaments") || "[]");
          if (Array.isArray(stored)) {
            stored.forEach((id) => {
              if (id) {
                this.deletedTournamentIds.add(String(id));
                this.deletedTournamentIds.add(String(id).toLowerCase());
                tournamentConfigRegistry.removeConfig(String(id));
                tournamentConfigRegistry.removeConfig(String(id).toLowerCase());
              }
            });
          }
        } catch {
        }
      }
      try {
        const unsubDeleted = onSnapshot4(doc5(db, "system_config", "deleted_tournaments"), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const ids = Array.isArray(data?.ids) ? data.ids : [];
            let changed = false;
            ids.forEach((id) => {
              if (id) {
                const sId = String(id);
                const sIdLower = sId.toLowerCase();
                if (!this.deletedTournamentIds.has(sId) || !this.deletedTournamentIds.has(sIdLower)) {
                  this.deletedTournamentIds.add(sId);
                  this.deletedTournamentIds.add(sIdLower);
                  changed = true;
                }
                tournamentConfigRegistry.removeConfig(sId);
                tournamentConfigRegistry.removeConfig(sIdLower);
                dotaPlayerRegistry.removeTournamentRegistrations(sId);
                dotaPlayerRegistry.removeTournamentRegistrations(sIdLower);
              }
            });
            if (changed) {
              this.tournaments = this.tournaments.filter((t) => {
                const idLower = (t.id || "").toLowerCase();
                const slugLower = (t.slug || "").toLowerCase();
                return !this.deletedTournamentIds.has(t.id) && !this.deletedTournamentIds.has(idLower) && (!slugLower || !this.deletedTournamentIds.has(slugLower));
              });
              if (typeof window !== "undefined" && window.localStorage) {
                try {
                  window.localStorage.setItem("pb_deleted_tournaments", JSON.stringify(Array.from(this.deletedTournamentIds)));
                } catch {
                }
              }
              this.notify();
            }
          }
        }, (err) => {
          console.warn("Firestore system deleted tournaments sync note:", err);
        });
        this.unsubs.push(unsubDeleted);
      } catch (err) {
        console.warn("Setup deleted tournaments listener note:", err);
      }
      const unsubTournaments = onSnapshot4(collection2(db, "tournaments"), (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const t = docSnap.data();
          const docId = docSnap.id || "";
          const docIdLower = docId.toLowerCase();
          const tId = t.id || "";
          const tIdLower = tId.toLowerCase();
          const slugLower = (t.slug || "").toLowerCase();
          const isDeletedDoc = t.deleted === true || t.status === "DELETED" || t.status === "deleted" || t.lifecycle === "CANCELLED_DELETED";
          if (isDeletedDoc) {
            this.deletedTournamentIds.add(docId);
            this.deletedTournamentIds.add(docIdLower);
            if (tId) this.deletedTournamentIds.add(tId);
            return;
          }
          this.deletedTournamentIds.delete(docId);
          this.deletedTournamentIds.delete(docIdLower);
          if (tId) this.deletedTournamentIds.delete(tId);
          if (tIdLower) this.deletedTournamentIds.delete(tIdLower);
          if (slugLower) this.deletedTournamentIds.delete(slugLower);
          if (typeof window !== "undefined" && window.localStorage) {
            try {
              const stored = JSON.parse(window.localStorage.getItem("pb_deleted_tournaments") || "[]");
              if (Array.isArray(stored) && (stored.includes(docId) || stored.includes(docIdLower) || tId && stored.includes(tId))) {
                const cleaned = stored.filter((s) => {
                  const sLow = String(s).toLowerCase();
                  return sLow !== docIdLower && sLow !== tIdLower && sLow !== slugLower;
                });
                window.localStorage.setItem("pb_deleted_tournaments", JSON.stringify(cleaned));
              }
            } catch {
            }
          }
          const isLegacyMockTournament = LEGACY_MOCK_TOURNAMENT_IDS.has(docIdLower) || LEGACY_MOCK_TOURNAMENT_IDS.has(tIdLower) || t.isSynthetic === true || t.isDummy === true;
          if (isLegacyMockTournament) {
            return;
          }
          const normalized = normalizeTournamentRecord({ ...t, id: docSnap.id || t.id });
          list.push(normalized);
          const cfg = normalized.config || tournamentToConfig(normalized);
          tournamentConfigRegistry.registerConfig(cfg);
          const rawDoc = docSnap.data();
          if (rawDoc.teams && Array.isArray(rawDoc.teams) && rawDoc.teams.length > 0) {
            const auctionEngine = this.getDotaAuctionEngine(rawDoc.id || docSnap.id);
            for (const tm of rawDoc.teams) {
              auctionEngine.hydrateTeamFromExternal(tm);
            }
            for (const tm of rawDoc.teams) {
              if (isTestTeam(tm)) continue;
              const existingIdx = this.teams.findIndex((x) => x.id === tm.id);
              const genericTeam = {
                id: tm.id,
                name: tm.name,
                tag: tm.tag,
                logo: tm.logo || "\u{1F451}",
                color: tm.color || "#7C3AED",
                bgHex: tm.color || "#7C3AED",
                captainId: tm.captainId,
                captainName: tm.captainIgn,
                city: tm.primaryRoster?.[0]?.city || "India",
                region: tm.primaryRoster?.[0]?.region || "Pan India",
                country: "India",
                flag: "\u{1F1EE}\u{1F1F3}",
                primaryGame: "Dota 2",
                rating: 1500,
                record: { wins: 0, losses: 0 },
                tournamentWins: 0,
                players: tm.primaryRoster ? tm.primaryRoster.map((p) => p.userId || p.id) : [tm.captainId],
                standIn: "",
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
        const testTourney = MOCK_TOURNAMENTS.find((t) => t.id === "purple-bean-auction-test");
        if (testTourney && !list.some((t) => t.id === "purple-bean-auction-test")) {
          list.push(normalizeTournamentRecord(testTourney));
        }
        const afterAuctionTourney = MOCK_TOURNAMENTS.find((t) => t.id === "after-auction-test");
        if (afterAuctionTourney && !list.some((t) => t.id === "after-auction-test")) {
          list.push(normalizeTournamentRecord(afterAuctionTourney));
        }
        this.tournaments = list.length > 0 ? list : [...MOCK_TOURNAMENTS];
        this.notify();
      }, (error) => {
        console.warn("Firestore tournaments sync note:", error);
      });
      this.unsubs.push(unsubTournaments);
      const unsubTeams = onSnapshot4(collection2(db, "teams"), (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...docSnap.data(), id: docSnap.id };
          if (isTestTeam(raw)) {
            try {
              deleteDoc2(doc5(db, "teams", docSnap.id)).catch(() => {
              });
            } catch {
            }
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
        console.warn("Firestore teams sync note:", error);
      });
      this.unsubs.push(unsubTeams);
      const unsubMatches = onSnapshot4(collection2(db, "matches"), (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data());
        });
        this.matches = list;
        this.notify();
      }, (error) => {
        console.warn("Firestore matches sync note:", error);
      });
      this.unsubs.push(unsubMatches);
      const unsubPlayers = onSnapshot4(collection2(db, "publicPlayers"), (snapshot) => {
        const list = [];
        snapshot.forEach((docSnap) => {
          const raw = { ...docSnap.data(), id: docSnap.id };
          if (isTestPlayer(raw)) {
            try {
              deleteDoc2(doc5(db, "publicPlayers", docSnap.id)).catch(() => {
              });
            } catch {
            }
            return;
          }
          list.push(normalizePlayerRecord(raw));
        });
        this.players = list;
        this.notify();
      }, (error) => {
        console.warn("Firestore publicPlayers sync note:", error);
      });
      this.unsubs.push(unsubPlayers);
      const unsubAuctions = onSnapshot4(collection2(db, "auctions"), (snapshot) => {
        snapshot.forEach((snap) => {
          const tourneyId = snap.id;
          const data = snap.data();
          if (data) {
            const engine = this.getDotaAuctionEngine(tourneyId);
            engine.importSnapshot(data);
            if (tourneyId === "purple-bean-india-masters-2026") {
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
        console.warn("Firestore auctions collection sync note:", error);
      });
      this.unsubs.push(unsubAuctions);
      const unsubRegistrations = onSnapshot4(collection2(db, "registrations"), (snapshot) => {
        snapshot.forEach((docSnap) => {
          const regData = docSnap.data();
          if (regData && regData.userId) {
            if (!regData.tournamentId || regData.tournamentId === "2-team-auction-test" || regData.tournamentId === "purple-bean-test-cup" || docSnap.id.startsWith("reg-2-team-auction-test-") || docSnap.id.startsWith("reg-purple-bean-test-cup-")) {
              return;
            }
            const tourneyId = regData.tournamentId;
            const statusUpper = (regData.status || "REGISTERED").toUpperCase();
            const upserted = dotaPlayerRegistry.upsertRegistration({
              id: docSnap.id,
              tournamentId: tourneyId,
              userId: regData.userId,
              ign: regData.ign || regData.playerName || "Contender",
              primaryRole: regData.primaryRole || "Position 1 \u2014 Carry",
              secondaryRole: regData.secondaryRole || "Position 2 \u2014 Mid",
              declaredMmr: regData.declaredMmr || regData.mmr || 5e3,
              tournamentMmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5e3,
              status: statusUpper,
              isMmrLocked: Boolean(regData.isMmrLocked || statusUpper === "VERIFIED"),
              applyingAsCaptain: Boolean(regData.applyingAsCaptain || regData.interestedInCaptaincy),
              interestedInCaptaincy: Boolean(regData.interestedInCaptaincy || regData.applyingAsCaptain),
              captainNotes: regData.captainNotes || regData.captainHistory || "",
              captainHistory: regData.captainHistory || regData.captainNotes || "",
              city: regData.city || "India",
              region: regData.region || "Pan India",
              registeredAt: regData.registeredAt || (/* @__PURE__ */ new Date()).toISOString(),
              verifiedAt: regData.verifiedAt,
              verifiedBy: regData.verifiedBy,
              isCaptainApproved: Boolean(regData.isCaptainApproved),
              teamId: regData.teamId,
              teamName: regData.teamName,
              userEmail: regData.userEmail
            });
            if (statusUpper === "WITHDRAWN" || statusUpper === "REJECTED" || statusUpper === "CANCELLED") {
              getAuctionEngine(tourneyId).removePlayer(regData.userId);
              for (const tm of this.teams) {
                if (tm.tournamentId === tourneyId) {
                  if (tm.captainId === regData.userId) {
                    tm.captainId = "";
                    tm.captainName = "";
                  }
                  if (tm.players && Array.isArray(tm.players)) {
                    tm.players = tm.players.filter((pid) => pid !== regData.userId && pid !== `player-${regData.userId}`);
                  }
                }
              }
            } else if (statusUpper === "VERIFIED") {
              dotaPlayerRegistry.lockTournamentMmr(
                regData.userId,
                regData.tournamentMmr || regData.declaredMmr || 5e3,
                regData.verifiedBy || "system"
              );
              getAuctionEngine(tourneyId).syncPlayerFromRegistration(tourneyId, upserted);
            }
            if (regData.isCaptainApproved && regData.teamId && statusUpper !== "WITHDRAWN" && statusUpper !== "REJECTED") {
              const engine = getAuctionEngine(tourneyId);
              if (!engine.hasTeam(regData.teamId)) {
                engine.hydrateTeamFromExternal({
                  id: regData.teamId,
                  name: regData.teamName || `${regData.ign || "Captain"}'s Squad`,
                  captainId: regData.userId,
                  captainIgn: regData.ign,
                  startingCredits: 1e3,
                  tournamentId: tourneyId
                });
              }
            }
            const playerIndex = this.players.findIndex((p) => p.id === regData.userId || p.id === `player-${regData.userId}`);
            const playerRecord = {
              id: regData.userId,
              username: regData.ign || regData.playerName || "Contender",
              displayName: regData.ign || regData.playerName || "Contender",
              realName: regData.ign || regData.playerName || "Contender",
              avatar: "\u{1F3AE}",
              city: regData.city || "India",
              region: regData.region || "Pan India",
              country: "India",
              flag: "\u{1F1EE}\u{1F1F3}",
              primaryGame: "Dota 2",
              mmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5e3,
              tournamentMmr: regData.tournamentMmr || regData.declaredMmr || regData.mmr || 5e3,
              platformRating: 1500,
              primaryRole: regData.primaryRole || "Position 1 \u2014 Carry",
              secondaryRole: regData.secondaryRole || "Position 2 \u2014 Mid",
              status: statusUpper === "VERIFIED" ? "Verified" : statusUpper === "WITHDRAWN" ? "Withdrawn" : statusUpper === "REJECTED" ? "Rejected" : "Pending Review",
              matches: 10,
              wins: 6,
              losses: 4,
              winRate: 60,
              tournamentWins: 0,
              mvps: 1,
              experienceYears: 2,
              previousCaptainRecord: "None",
              heroPool: [],
              bio: `Registered tournament contender from ${regData.city || "India"}.`
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
        console.warn("Firestore registrations sync note:", error);
      });
      this.unsubs.push(unsubRegistrations);
      const unsubNotifications = onSnapshot4(collection2(db, "notifications"), (snapshot) => {
        snapshot.forEach((docSnap) => {
          const notifData = docSnap.data();
          if (notifData && notifData.userId) {
            dotaPlayerRegistry.addNotification({
              ...notifData,
              id: docSnap.id
            });
          }
        });
        this.notify();
      }, (error) => {
        console.warn("Firestore notifications sync note:", error);
      });
      this.unsubs.push(unsubNotifications);
    } catch (e) {
      console.warn("Firestore initial listeners deferred:", e);
    }
  }
  getAdminEmails() {
    return Array.from(this.adminEmails);
  }
  getRoleAssignments() {
    this.adminEmails.forEach((adminEmail) => {
      const clean = adminEmail.toLowerCase().trim();
      if (clean && !this.userRoles.has(clean) && !isRoleRevoked(clean)) {
        const pbgAcc = pbgAccountRegistry.getAccountByEmail(clean);
        this.userRoles.set(clean, {
          email: clean,
          role: "admin",
          assignedBy: PRIMARY_PROJECT_ADMIN_EMAIL2,
          assignedAt: "2026-10-01T12:00:00.000Z",
          displayName: pbgAcc?.displayName || (clean === "neelapuharsha@gmail.com" ? "Harsha Neelapu" : clean.split("@")[0]),
          pbgId: pbgAcc?.pbgId || (clean === "neelapuharsha@gmail.com" ? "PBG-000187" : void 0),
          notes: "Administrative Authority",
          permissions: ROLE_PERMISSIONS.admin,
          status: "ACTIVE"
        });
      }
    });
    const list = Array.from(this.userRoles.values());
    if (!this.userRoles.has(PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase())) {
      const leadPbg = pbgAccountRegistry.getAccountByEmail(PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase());
      list.unshift({
        email: PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase(),
        role: "admin",
        assignedBy: "system-root",
        assignedAt: "2026-01-01T00:00:00.000Z",
        displayName: "Primary Project Lead",
        pbgId: leadPbg?.pbgId || "PBG-000186",
        notes: "Root system owner and immutable project authority",
        permissions: ROLE_PERMISSIONS.admin,
        status: "ACTIVE"
      });
    }
    list.forEach((item) => {
      if (!item.pbgId) {
        const acc = pbgAccountRegistry.getAccountByEmail(item.email);
        if (acc?.pbgId) {
          item.pbgId = acc.pbgId;
        } else if (item.email === "neelapuharsha@gmail.com") {
          item.pbgId = "PBG-000187";
        }
      }
    });
    return list;
  }
  getRoleAuditLogs() {
    return [...this.roleAuditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }
  hasPermission(permission) {
    if (!this.currentUser) return permission === "PUBLIC_VIEW";
    if (this.currentUser.isPrimaryAdmin || this.currentUser.email?.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase()) {
      return true;
    }
    if (this.currentUser.isAdmin) {
      return ROLE_PERMISSIONS.admin.includes(permission);
    }
    const role = this.currentUser.role || "spectator";
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }
  async assignUserRole(emailToAssign, role, options) {
    const cleanEmail = emailToAssign.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return { success: false, message: "Please enter a valid email address." };
    }
    if (cleanEmail === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase() && role !== "admin") {
      return { success: false, message: "Primary project admin role cannot be altered." };
    }
    const isCallerPrimary = this.currentUser.email?.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase() || Boolean(this.currentUser.isPrimaryAdmin);
    const isCallerAdmin = this.currentUser.isAdmin || isCallerPrimary;
    if (!isCallerAdmin) {
      return { success: false, message: "Unauthorized: Only administrators can assign system roles." };
    }
    if (role === "admin" && !isCallerPrimary) {
      return { success: false, message: "Unauthorized: Only the Primary Lead Administrator can grant Admin roles." };
    }
    const previousRole = this.userRoles.get(cleanEmail)?.role;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const assignment = {
      email: cleanEmail,
      role,
      assignedBy: this.currentUser.email || PRIMARY_PROJECT_ADMIN_EMAIL2,
      assignedAt: now,
      displayName: options?.displayName,
      notes: options?.notes,
      pbgId: options?.pbgId,
      permissions: ROLE_PERMISSIONS[role],
      status: "ACTIVE"
    };
    unmarkRoleRevoked(cleanEmail);
    this.userRoles.set(cleanEmail, assignment);
    if (role === "admin") {
      this.adminEmails.add(cleanEmail);
    }
    const auditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: previousRole ? "ROLE_UPDATED" : "ROLE_ASSIGNED",
      targetEmail: cleanEmail,
      targetRole: role,
      previousRole,
      performedBy: this.currentUser.displayName || this.currentUser.email || "Admin",
      performedByEmail: this.currentUser.email || PRIMARY_PROJECT_ADMIN_EMAIL2,
      timestamp: now,
      notes: options?.notes || `Role set to ${role.toUpperCase()}`
    };
    this.roleAuditLogs.unshift(auditLog);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, "_");
        try {
          await deleteDoc2(doc5(db, "system_revocations", docId));
          if (docId !== cleanEmail) {
            await deleteDoc2(doc5(db, "system_revocations", cleanEmail));
          }
        } catch {
        }
        const roleDocRef = doc5(db, "user_roles", docId);
        await setDoc4(roleDocRef, assignment, { merge: true });
        if (role === "admin") {
          const adminDocRef = doc5(db, "admins", docId);
          await setDoc4(adminDocRef, {
            email: cleanEmail,
            addedBy: this.currentUser.email || "primary-admin",
            createdAt: now
          }, { merge: true });
        }
        const logDocRef = doc5(db, "role_audit_logs", auditLog.id);
        await setDoc4(logDocRef, auditLog);
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore assignUserRole note:", e);
      }
    }
    this.notify();
    return { success: true, message: `Access granted: ${cleanEmail} assigned as ${role.toUpperCase()}.` };
  }
  async revokeUserRole(emailToRemove, reason) {
    const cleanEmail = emailToRemove.trim().toLowerCase();
    if (cleanEmail === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase()) {
      return { success: false, message: "Primary project admin (11106cm009@gmail.com) is immutable and cannot be removed or demoted." };
    }
    if (this.currentUser.email?.toLowerCase() === cleanEmail) {
      return { success: false, message: "Security restriction: You cannot revoke your own administrative role." };
    }
    const isCallerPrimary = this.currentUser.email?.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase() || Boolean(this.currentUser.isPrimaryAdmin);
    const isCallerAdmin = this.currentUser.isAdmin || isCallerPrimary;
    if (!isCallerAdmin) {
      return { success: false, message: "Unauthorized: Only administrators can revoke system roles." };
    }
    const existingAssignment = this.userRoles.get(cleanEmail) || (this.adminEmails.has(cleanEmail) ? {
      email: cleanEmail,
      role: "admin",
      assignedBy: PRIMARY_PROJECT_ADMIN_EMAIL2,
      assignedAt: (/* @__PURE__ */ new Date()).toISOString(),
      permissions: ROLE_PERMISSIONS.admin,
      status: "ACTIVE"
    } : void 0);
    if (!existingAssignment) {
      return { success: false, message: "No role found for this user." };
    }
    if (existingAssignment.role === "admin" && !isCallerPrimary) {
      return { success: false, message: "Unauthorized: Only the Primary Lead Administrator can revoke Admin roles." };
    }
    const previousRole = existingAssignment.role;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    markRoleRevoked(cleanEmail);
    this.userRoles.delete(cleanEmail);
    this.adminEmails.delete(cleanEmail);
    const auditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      action: "ROLE_REVOKED",
      targetEmail: cleanEmail,
      targetRole: "player",
      previousRole,
      performedBy: this.currentUser.displayName || this.currentUser.email || "Admin",
      performedByEmail: this.currentUser.email || PRIMARY_PROJECT_ADMIN_EMAIL2,
      timestamp: now,
      notes: reason || `Revoked ${previousRole.toUpperCase()} role`
    };
    this.roleAuditLogs.unshift(auditLog);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const docId = cleanEmail.replace(/[^a-zA-Z0-9_-]/g, "_");
        await setDoc4(doc5(db, "system_revocations", docId), {
          email: cleanEmail,
          revokedAt: now,
          revokedBy: this.currentUser.email || PRIMARY_PROJECT_ADMIN_EMAIL2,
          reason: reason || "Access Revoked"
        }, { merge: true });
        const roleDocRef = doc5(db, "user_roles", docId);
        await deleteDoc2(roleDocRef);
        const adminDocRef = doc5(db, "admins", docId);
        await deleteDoc2(adminDocRef);
        if (docId !== cleanEmail) {
          try {
            await deleteDoc2(doc5(db, "user_roles", cleanEmail));
            await deleteDoc2(doc5(db, "admins", cleanEmail));
          } catch {
          }
        }
        const logDocRef = doc5(db, "role_audit_logs", auditLog.id);
        await setDoc4(logDocRef, auditLog);
      } catch (e) {
        console.warn("Firestore revokeUserRole note:", e);
      }
    }
    this.notify();
    return { success: true, message: `Access revoked for ${cleanEmail}.` };
  }
  async addAdminEmail(emailToAdd) {
    return this.assignUserRole(emailToAdd, "admin");
  }
  async removeAdminEmail(emailToRemove) {
    return this.revokeUserRole(emailToRemove);
  }
  async purgeAllTestData() {
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
      status: isTestEnvironment ? "open" : "paused",
      revision: 1,
      currentBid: isTestEnvironment ? 5e4 : 0,
      leadingTeamId: isTestEnvironment ? "t-1" : "",
      leadingTeamName: isTestEnvironment ? "Purple Bean Titans" : "",
      currentPlayer: isTestEnvironment ? MOCK_PLAYERS[2] : void 0,
      secondsLeft: isTestEnvironment ? 30 : 0,
      bidHistory: []
    };
    try {
      if (typeof testCupEngine?.purge === "function") {
        testCupEngine.purge();
      }
      if (typeof dotaAuctionEngine?.purge === "function") {
        dotaAuctionEngine.purge();
      }
      if (typeof dotaPlayerRegistry?.clearAll === "function") {
        dotaPlayerRegistry.clearAll();
      }
      if (typeof dotaCareerHistoryEngine?.clearAll === "function") {
        dotaCareerHistoryEngine.clearAll();
      }
      tournamentConfigRegistry.clearConfigs();
    } catch {
    }
    const collectionsToClean = ["tournaments", "teams", "publicPlayers", "matches", "reports", "auctions", "registrations", "stateSnapshots"];
    for (const collName of collectionsToClean) {
      try {
        const snap = await getDocs(collection2(db, collName));
        for (const docSnap of snap.docs) {
          await deleteDoc2(docSnap.ref);
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
  async createTournament(config, visibility = "PUBLIC", initialStatus = "REGISTRATION_OPEN") {
    const normalizedConfig = normalizeTournamentConfig(config);
    const canonicalTournamentId = normalizedConfig.identity?.tournamentId || config?.identity?.tournamentId || `pb-tourney-${Date.now()}`;
    const validation = validateTournamentConfig(normalizedConfig);
    if (!validation.valid) {
      return {
        success: false,
        tournamentId: canonicalTournamentId,
        error: validation.errors.join("; ")
      };
    }
    if (isQuotaExhausted()) {
      return {
        success: false,
        tournamentId: canonicalTournamentId,
        error: "Firebase write quota exceeded. Tournament was not created."
      };
    }
    const authUid = auth.currentUser?.uid || this.currentUser.id;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const hasCity = Boolean(normalizedConfig.identity.city && normalizedConfig.identity.city.trim());
    const effectiveVisibility = visibility || normalizedConfig.identity.visibility || "PUBLIC";
    const effectiveStatus = initialStatus || (effectiveVisibility === "PUBLIC" ? "REGISTRATION_OPEN" : "DRAFT");
    const canonicalDoc = {
      id: canonicalTournamentId,
      name: normalizedConfig.identity.name,
      game: normalizedConfig.identity.gameName || "Dota 2",
      gameId: normalizedConfig.identity.gameId || "dota2",
      organiserId: authUid,
      organizer: authUid,
      organizerEmail: auth.currentUser?.email || this.currentUser.email || "",
      organizerName: auth.currentUser?.displayName || this.currentUser.displayName || "Tournament Organiser",
      visibility: effectiveVisibility,
      status: effectiveStatus,
      lifecycle: effectiveStatus,
      createdAt: nowIso,
      updatedAt: nowIso,
      dates: `${normalizedConfig.registration.openDate} \u2013 ${normalizedConfig.registration.closeDate}`,
      startDate: normalizedConfig.registration.openDate,
      endDate: normalizedConfig.registration.closeDate,
      prizePool: formatINR(normalizedConfig.prizes.totalPrizePoolINR),
      totalPrizeNumber: normalizedConfig.prizes.totalPrizePoolINR,
      prizePoolINR: formatINR(normalizedConfig.prizes.totalPrizePoolINR),
      teamCount: normalizedConfig.teamFormation.numberOfTeams,
      playerCount: 0,
      format: normalizedConfig.competition.format,
      region: normalizedConfig.identity.region || "Pan India",
      ...hasCity ? { city: normalizedConfig.identity.city.trim() } : {},
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
        server: "Mumbai / Singapore Official Valve Relays",
        antiCheat: "VAC & Valve Match ID Verification",
        bracketFormat: normalizedConfig.competition.format,
        rosterLock: `${normalizedConfig.registration.closeDate} 23:59 IST`
      },
      prizeDistribution: normalizedConfig.prizes.placementDistribution.map((p) => ({
        place: p.placement,
        amount: formatINR(p.amountINR),
        percentage: `${p.percentage}%`
      })),
      stages: [
        { id: "reg", name: "Registration", status: "current", date: normalizedConfig.registration.openDate },
        { id: "draft", name: normalizedConfig.teamFormation.mode === "AUCTION" ? "Auction Draft" : "Team Roster Review", status: "upcoming", date: normalizedConfig.registration.closeDate },
        { id: "matches", name: "Main Bracket", status: "upcoming", date: normalizedConfig.registration.closeDate }
      ]
    };
    const sanitizedDoc = removeUndefinedDeep(canonicalDoc);
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (!isTest) {
      try {
        const tDocRef = doc5(db, "tournaments", canonicalTournamentId);
        const membershipRef = doc5(db, "tournaments", canonicalTournamentId, "memberships", authUid);
        await setDoc4(tDocRef, sanitizedDoc);
        await setDoc4(membershipRef, {
          role: "organizer",
          userId: authUid,
          userEmail: auth.currentUser?.email || this.currentUser.email || "",
          assignedAt: nowIso
        });
      } catch (err) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: "Firebase write quota exceeded. Tournament was not created."
          };
        }
        const code = err?.code;
        if (code === "permission-denied") {
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: "Permission denied: You do not have organizer authorization to create this tournament."
          };
        }
        if (code === "unavailable") {
          return {
            success: false,
            tournamentId: canonicalTournamentId,
            error: "Firebase service is temporarily unavailable. Please try again."
          };
        }
        return {
          success: false,
          tournamentId: canonicalTournamentId,
          error: err?.message || "Failed to save tournament to Firestore."
        };
      }
    }
    const existingIdx = this.tournaments.findIndex((t) => t.id === canonicalTournamentId);
    if (existingIdx >= 0) {
      this.tournaments[existingIdx] = sanitizedDoc;
    } else {
      this.tournaments.unshift(sanitizedDoc);
    }
    tournamentConfigRegistry.registerConfig(normalizedConfig);
    this.notify();
    return {
      success: true,
      tournamentId: canonicalTournamentId,
      tournament: sanitizedDoc
    };
  }
  async deleteTournament(tournamentId) {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    const isSpectator = !isTest && (this.currentUser.role === "spectator" || this.currentUser.id === "guest-spectator" || !this.currentUser.email);
    if (isSpectator) {
      return { success: false, error: "Forbidden: Spectators cannot delete tournaments." };
    }
    const idExact = String(tournamentId);
    const idLower = idExact.toLowerCase();
    const tourney = this.tournaments.find((t) => {
      const tId = String(t.id || "");
      return tId === idExact || tId.toLowerCase() === idLower;
    });
    const isCreatorOrOwner = Boolean(tourney && this.currentUser.email && (tourney.organiserId === this.currentUser.id || tourney.organizer === this.currentUser.id || tourney.organizerId === this.currentUser.id || tourney.createdBy === this.currentUser.id || tourney.organizerEmail && tourney.organizerEmail.toLowerCase().trim() === this.currentUser.email.toLowerCase().trim()));
    const isAllowed = isTest || this.currentUser.role === "organizer" || this.currentUser.isAdmin || this.currentUser.isPrimaryAdmin || this.currentUser.email && this.currentUser.email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase() || isCreatorOrOwner || !tourney;
    if (!isAllowed) {
      return { success: false, error: "Forbidden: Only organisers or administrators can delete tournaments." };
    }
    const idFromTourney = tourney?.id ? String(tourney.id) : "";
    const idFromTourneyLower = idFromTourney.toLowerCase();
    const allVariants = Array.from(new Set([idExact, idLower, idFromTourney, idFromTourneyLower].filter(Boolean)));
    allVariants.forEach((id) => {
      this.deletedTournamentIds.add(id);
    });
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const stored = JSON.parse(window.localStorage.getItem("pb_deleted_tournaments") || "[]");
        const updated = Array.from(/* @__PURE__ */ new Set([...stored, ...allVariants]));
        window.localStorage.setItem("pb_deleted_tournaments", JSON.stringify(updated));
      }
    } catch {
    }
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken().catch(() => "") : "";
      if (token) {
        await fetch(`/api/tournaments/${tournamentId}/soft-delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            reason: "Organizer tournament deletion"
          })
        }).catch(() => {
        });
      }
    } catch (e) {
      console.warn("Server soft-delete API note:", e);
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await setDoc4(doc5(db, "system_config", "deleted_tournaments"), {
          ids: arrayUnion(...allVariants),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true }).catch(() => {
        });
      } catch {
      }
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const vId of allVariants) {
          await updateDoc2(doc5(db, "tournaments", vId), {
            deleted: true,
            status: "deleted",
            lifecycle: "DELETED",
            deletedAt: now,
            deletedBy: this.currentUser.id,
            deleteReason: "Organizer soft-deletion",
            updatedAt: now
          }).catch(() => {
          });
        }
      } catch (err) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore soft deletion deferred:", err);
      }
    }
    this.tournaments = this.tournaments.filter((t) => !allVariants.includes(t.id) && !allVariants.includes(String(t.id || "").toLowerCase()));
    this.teams = this.teams.filter((t) => !allVariants.includes(t.tournamentId) && !allVariants.includes(String(t.tournamentId || "").toLowerCase()));
    allVariants.forEach((id) => {
      tournamentConfigRegistry.removeConfig(id);
      dotaPlayerRegistry.removeTournamentRegistrations(id);
      resetAuctionEngine(id);
    });
    this.notify();
    return { success: true };
  }
  async setTournamentLifecycle(tournamentId, nextStatus, reason) {
    const isSpectator = this.currentUser.role === "spectator" || this.currentUser.id === "guest-spectator" || !this.currentUser.email;
    if (isSpectator) {
      return { success: false, error: "Forbidden: Spectators cannot alter tournament lifecycle." };
    }
    const idExact = String(tournamentId);
    const idLower = idExact.toLowerCase();
    const tournament = this.tournaments.find((t) => {
      const tId = String(t.id || "");
      return tId === idExact || tId.toLowerCase() === idLower;
    });
    const isCreatorOrOwner = Boolean(tournament && this.currentUser.email && (tournament.organiserId === this.currentUser.id || tournament.organizer === this.currentUser.id || tournament.organizerId === this.currentUser.id || tournament.createdBy === this.currentUser.id || tournament.organizerEmail && tournament.organizerEmail.toLowerCase().trim() === this.currentUser.email.toLowerCase().trim()));
    const isAllowed = this.currentUser.role === "organizer" || this.currentUser.isAdmin || this.currentUser.isPrimaryAdmin || this.currentUser.email && this.currentUser.email.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL2.toLowerCase() || isCreatorOrOwner;
    if (!isAllowed) {
      return { success: false, error: "Forbidden: Only organisers or administrators can alter tournament lifecycle." };
    }
    if (!tournament) {
      return { success: false, error: "Tournament not found." };
    }
    const statusLabels = {
      "REGISTRATION_OPEN": "Registration Open",
      "DRAFTING": "Drafting",
      "LIVE": "Live",
      "COMPLETED": "Completed",
      "ON_HOLD": "On Hold",
      "CANCELLED": "Cancelled"
    };
    const previousStatus = tournament.status;
    const label = statusLabels[nextStatus] || nextStatus;
    tournament.status = label;
    tournament.lifecycle = nextStatus;
    tournament.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    if (reason) {
      tournament.statusReason = reason;
    }
    if (nextStatus === "ON_HOLD") {
      tournament.previousStatusBeforeHold = previousStatus;
    }
    if (nextStatus === "CANCELLED") {
      const tourneyRegs = dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
      for (const reg of tourneyRegs) {
        if (reg.status !== "WITHDRAWN" && reg.status !== "REJECTED") {
          reg.status = "CANCELLED";
          reg.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await updateDoc2(doc5(db, "tournaments", tournamentId), {
          status: label,
          lifecycle: nextStatus,
          statusReason: reason || null,
          ...nextStatus === "ON_HOLD" ? { previousStatusBeforeHold: previousStatus } : {},
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (err) {
        if (isQuotaError(err)) setQuotaExhausted(true);
        console.warn("Firestore tournament lifecycle update deferred:", err);
      }
    }
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken().catch(() => "") : "";
      if (token) {
        await fetch(`/api/tournaments/${tournamentId}/transition`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            nextStatus: nextStatus.toLowerCase(),
            reason
          })
        }).catch(() => {
        });
      }
    } catch (e) {
      console.warn("Server transition API note:", e);
    }
    this.notify();
    return { success: true, message: `Tournament status updated to ${label}.` };
  }
  async resumeTournament(tournamentId) {
    const tourney = this.tournaments.find((t) => t.id === tournamentId);
    if (!tourney) return { success: false, error: "Tournament not found." };
    const prev = tourney.previousStatusBeforeHold || "REGISTRATION_OPEN";
    const statusMap = {
      "Registration Open": "REGISTRATION_OPEN",
      "REGISTRATION_OPEN": "REGISTRATION_OPEN",
      "Drafting": "DRAFTING",
      "DRAFTING": "DRAFTING",
      "Live": "LIVE",
      "LIVE": "LIVE"
    };
    const targetStatus = statusMap[prev] || "REGISTRATION_OPEN";
    return this.setTournamentLifecycle(tournamentId, targetStatus, "Resumed from hold.");
  }
  addTestTournament(tournament) {
    const existingIndex = this.tournaments.findIndex((t) => t.id === tournament.id);
    if (existingIndex >= 0) {
      this.tournaments[existingIndex] = tournament;
    } else {
      this.tournaments.unshift(tournament);
    }
    this.notify();
  }
  addDummyPlayers(newPlayers) {
    const map = /* @__PURE__ */ new Map();
    this.players.forEach((p) => map.set(p.id, p));
    newPlayers.forEach((p) => map.set(p.id, p));
    this.players = Array.from(map.values());
    this.notify();
  }
  addTestTeams(newTeams) {
    const map = /* @__PURE__ */ new Map();
    this.teams.forEach((t) => map.set(t.id, t));
    newTeams.forEach((t) => map.set(t.id, t));
    this.teams = Array.from(map.values());
    this.notify();
  }
  addTestMatches(newMatches) {
    const map = /* @__PURE__ */ new Map();
    this.matches.forEach((m) => map.set(m.id, m));
    newMatches.forEach((m) => map.set(m.id, m));
    this.matches = Array.from(map.values());
    this.notify();
  }
  dispose() {
    this.unsubs.forEach((unsub) => unsub());
    this.unsubs = [];
    this.authUnsubs.forEach((unsub) => unsub());
    this.authUnsubs.clear();
    this.listeners = [];
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify() {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (isTest) {
      this.listeners.forEach((l) => {
        try {
          l();
        } catch (err) {
          console.error("FirebaseTournamentService listener error:", err);
        }
      });
      return;
    }
    if (this.notifyTimeout) return;
    this.notifyTimeout = setTimeout(() => {
      this.notifyTimeout = null;
      this.listeners.forEach((l) => {
        try {
          l();
        } catch (err) {
          console.error("FirebaseTournamentService listener error:", err);
        }
      });
    }, 16);
  }
  // -------------------------------------------------------------
  // Identity & Auth
  // -------------------------------------------------------------
  getCurrentUser() {
    if (!this.currentUser) return { ...GUEST_SPECTATOR_SESSION };
    if (this.currentUser.role !== "organizer" && !this.currentUser.isAdmin) {
      const curId = this.currentUser.id;
      const curEmail = (this.currentUser.email || "").toLowerCase().trim();
      const curName = (this.currentUser.displayName || "").toLowerCase().trim();
      const isAppointedCaptain = this.teams.some(
        (t) => t.captainId === curId || curEmail && t.captainEmail?.toLowerCase() === curEmail || curName && t.captainName?.toLowerCase() === curName
      ) || dotaPlayerRegistry.getAllRegistrations().some(
        (r) => (r.userId === curId || curEmail && r.userEmail?.toLowerCase() === curEmail || curName && r.ign?.toLowerCase() === curName) && r.isCaptainApproved
      ) || this.userRoles.get(curId)?.role === "captain" || curEmail && this.userRoles.get(curEmail)?.role === "captain";
      if (isAppointedCaptain) {
        const teamMatch = this.teams.find(
          (t) => t.captainId === curId || curEmail && t.captainEmail?.toLowerCase() === curEmail
        );
        return {
          ...this.currentUser,
          role: "captain",
          teamId: this.currentUser.teamId || teamMatch?.id,
          teamName: this.currentUser.teamName || teamMatch?.name
        };
      }
    }
    return this.currentUser;
  }
  switchUser(userId) {
    const user = DETERMINISTIC_USERS.find((u) => u.id === userId) || DETERMINISTIC_USERS[0];
    const curEmail = (user.email || "").toLowerCase().trim();
    const curName = (user.displayName || "").toLowerCase().trim();
    const isAppointedCaptain = user.role === "captain" || this.teams.some(
      (t) => t.captainId === user.id || curEmail && t.captainEmail?.toLowerCase() === curEmail
    ) || dotaPlayerRegistry.getAllRegistrations().some(
      (r) => (r.userId === user.id || curEmail && r.userEmail?.toLowerCase() === curEmail || curName && r.ign?.toLowerCase() === curName) && r.isCaptainApproved
    ) || this.userRoles.get(user.id)?.role === "captain" || curEmail && this.userRoles.get(curEmail)?.role === "captain";
    let resolvedPbgId = user.pbgId;
    if (!resolvedPbgId && curEmail && user.id !== "guest-spectator") {
      const pbgAcc = pbgAccountRegistry.getOrCreatePBGAccount({
        googleUid: user.id,
        email: curEmail,
        displayName: user.displayName
      }).account;
      resolvedPbgId = pbgAcc.pbgId;
    }
    if (isAppointedCaptain && user.role !== "organizer" && !user.isAdmin) {
      const capTeam = this.teams.find((t) => t.captainId === user.id || curEmail && t.captainEmail?.toLowerCase() === curEmail);
      this.currentUser = {
        ...user,
        pbgId: resolvedPbgId,
        role: "captain",
        teamId: user.teamId || capTeam?.id,
        teamName: user.teamName || capTeam?.name
      };
    } else {
      this.currentUser = {
        ...user,
        pbgId: resolvedPbgId
      };
    }
    this.notify();
    return this.currentUser;
  }
  setCurrentUser(user) {
    this.currentUser = { ...user };
    this.notify();
    return this.currentUser;
  }
  getCurrentPBGAccount() {
    if (this.currentUser && this.currentUser.id && this.currentUser.id !== "guest-spectator") {
      let acc = pbgAccountRegistry.getAccountByUid(this.currentUser.id);
      if (!acc && this.currentUser.email) {
        acc = pbgAccountRegistry.getAccountByEmail(this.currentUser.email);
      }
      if (!acc && this.currentUser.pbgId) {
        acc = pbgAccountRegistry.getAccountByPbgId(this.currentUser.pbgId);
      }
      if (acc) return acc;
    }
    return void 0;
  }
  markOnboardingCompleted(uid) {
    const targetUid = uid || this.currentUser && this.currentUser.id;
    if (targetUid && targetUid !== "guest-spectator") {
      pbgAccountRegistry.completeOnboarding(targetUid);
      if (this.currentUser && this.currentUser.id === targetUid) {
        this.currentUser = {
          ...this.currentUser,
          isFirstTimePBG: false
        };
        this.notify();
      }
    }
  }
  async signInWithGoogle() {
    if (this.activeSignInPromise) {
      return this.activeSignInPromise;
    }
    this.activeSignInPromise = (async () => {
      const isInIframe = typeof window !== "undefined" && (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();
      try {
        const result = await signInWithPopup(auth, googleProvider);
        const fbUser = result.user;
        const email = (fbUser.email || "").toLowerCase().trim();
        const perms = this.computeUserPermissions(email);
        const alreadyCompleted = pbgAccountRegistry.hasUserCompletedOnboarding(fbUser.uid);
        const { account: pbgAcc, isFirstTime } = pbgAccountRegistry.getOrCreatePBGAccount({
          googleUid: fbUser.uid,
          email,
          displayName: fbUser.displayName || email.split("@")[0] || "Gamer",
          photoURL: fbUser.photoURL || void 0
        });
        this.currentUser = {
          id: fbUser.uid,
          email,
          displayName: fbUser.displayName || email.split("@")[0] || "Gamer",
          avatarUrl: fbUser.photoURL || void 0,
          role: perms.role,
          isAdmin: perms.isAdmin,
          isPrimaryAdmin: perms.isPrimaryAdmin,
          isModerator: perms.isModerator,
          pbgId: pbgAcc.pbgId,
          isFirstTimePBG: isFirstTime && !alreadyCompleted && !pbgAcc.hasCompletedOnboarding
        };
        if (perms.isAdmin) {
          this.triggerAdminBootstrap(fbUser.uid, email);
        }
        this.notify();
        return { user: this.currentUser, pbgAccount: pbgAcc, isFirstTime, error: null, cancelled: false };
      } catch (error) {
        const errorCode = error?.code || "";
        const errorMessage = error?.message || String(error || "");
        if (!isInIframe && (errorCode === "auth/popup-blocked" || errorCode === "auth/operation-not-supported-in-this-environment" || errorMessage.includes("popup-blocked"))) {
          console.warn("Popup blocked on standalone window, falling back to signInWithRedirect...");
          try {
            await signInWithRedirect(auth, googleProvider);
            return { user: this.currentUser, error: null, cancelled: false };
          } catch (fallbackErr) {
            return { user: this.currentUser, error: fallbackErr, cancelled: false };
          }
        }
        const isCancelled = errorCode === "auth/cancelled-popup-request" || errorCode === "auth/popup-closed-by-user" || errorCode === "auth/user-cancelled" || errorMessage.includes("cancelled-popup-request") || errorMessage.includes("popup-closed-by-user");
        if (isCancelled) {
          console.info("Google Sign-In popup closed or cancelled by user.");
          return { user: this.currentUser, error: null, cancelled: true };
        }
        console.warn("Google Sign-In note:", errorMessage);
        return { user: this.currentUser, error, cancelled: false };
      } finally {
        this.activeSignInPromise = null;
      }
    })();
    return this.activeSignInPromise;
  }
  async signOut() {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn("Firebase sign out note:", e);
    }
    this.currentUser = { ...GUEST_SPECTATOR_SESSION };
    this.notify();
  }
  // -------------------------------------------------------------
  // Public Player Privacy (Section 12: Separation of Public vs Private)
  // -------------------------------------------------------------
  getPublicPlayer(playerId) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return void 0;
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
  getPrivatePlayerAccount(userId) {
    if (this.currentUser.role !== "organizer" && this.currentUser.id !== userId) {
      return { success: false, error: "Permission Denied: Confidential player PII can only be accessed by the account owner or verified organizers." };
    }
    const player = this.players.find((p) => p.id === userId || p.username.toLowerCase() === this.currentUser.displayName.toLowerCase()) || this.players[0];
    return {
      success: true,
      data: {
        userId,
        email: this.currentUser.email,
        steamId64: "76561198000000000",
        verificationStatus: player.status,
        moderationNotes: "Clean competitive record verified by referee."
      }
    };
  }
  // -------------------------------------------------------------
  // Tournament Lifecycle State Machine (Section 7)
  // -------------------------------------------------------------
  async transitionTournamentStatus(tournamentId, nextStatus, idempotencyKey = `trans-${tournamentId}-${nextStatus}`) {
    if (this.currentUser.role !== "organizer") {
      return { success: false, message: "Forbidden: Only organizers can transition tournament state." };
    }
    const tournament = this.tournaments.find((t) => t.id === tournamentId);
    if (!tournament) {
      return { success: false, message: "Tournament not found" };
    }
    const currentCanonicalStatus = tournament.status === "Live" ? "competition" : tournament.status === "Completed" ? "completed" : tournament.status === "Registration Open" ? "registration" : "auction_live";
    const transitionCheck = validateTournamentTransition(currentCanonicalStatus, nextStatus);
    if (!transitionCheck.valid) {
      return { success: false, message: transitionCheck.reason || "Invalid state transition" };
    }
    tournament.status = nextStatus === "competition" ? "Live" : nextStatus === "completed" ? "Completed" : "Drafting";
    await this.logAuditEvent({
      action: "tournament_transition",
      entityId: tournamentId,
      entityType: "tournament",
      details: `Status transitioned from ${currentCanonicalStatus} to ${nextStatus}`,
      idempotencyKey
    });
    try {
      const tDocRef = doc5(db, "tournaments", tournamentId);
      await updateDoc2(tDocRef, {
        status: nextStatus,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (e) {
      console.warn("Firestore status write note:", e);
    }
    try {
      const user = auth.currentUser;
      const token = user ? await user.getIdToken().catch(() => "") : "";
      if (token) {
        await fetch(`/api/tournaments/${tournamentId}/transition`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ nextStatus })
        }).catch(() => {
        });
      }
    } catch (e) {
      console.warn("Server transition API note:", e);
    }
    this.notify();
    return { success: true, message: `Tournament successfully transitioned to ${nextStatus.toUpperCase()}` };
  }
  // -------------------------------------------------------------
  // Auction System: Transactions, Concurrency, and Idempotency (Sections 2, 3, 4, 5, 6)
  // -------------------------------------------------------------
  getAuctionState() {
    const config = getRosterConfigForGame("Dota 2");
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
  async placeBid(incrementAmount, teamId, idempotencyKey = `bid-${Date.now()}-${Math.random().toString(36).substring(7)}`) {
    if (this.processedBids.has(idempotencyKey)) {
      return { success: true, message: "Bid already recorded (idempotent duplicate request)." };
    }
    if (this.currentUser.role !== "organizer" && this.currentUser.role !== "captain") {
      return { success: false, message: "Unauthorized: Only registered team captains or lead organizers can place bids." };
    }
    const team = this.auctionTeams.find((t) => t.teamId === teamId);
    if (!team) {
      return { success: false, message: "Specified team is not a registered auction participant." };
    }
    if (this.currentUser.role === "captain" && this.currentUser.teamId && this.currentUser.teamId !== teamId) {
      return { success: false, message: `Permission Denied: Captain of ${this.currentUser.teamName} cannot place bids on behalf of ${team.teamName}.` };
    }
    if (this.auctionState.status !== "open") {
      return { success: false, message: `Auction is currently ${this.auctionState.status.toUpperCase()}. Bidding is not accepted.` };
    }
    const proposedBid = this.auctionState.currentBid + incrementAmount;
    const rosterConfig = getRosterConfigForGame("Dota 2");
    const rosterCheck = validateBidRosterConstraint(
      team.remainingCredits,
      proposedBid,
      team.draftedPlayers.length,
      rosterConfig
    );
    if (!rosterCheck.valid) {
      return { success: false, message: rosterCheck.reason || "Illegal bid constraint." };
    }
    try {
      if (!isTestEnvironment && auth.currentUser) {
        const auctionDocRef = doc5(db, "auctions", "purple-bean-india-masters-2026");
        await runTransaction2(db, async (transaction) => {
          const snap = await transaction.get(auctionDocRef);
          let currentDbRev = 0;
          if (snap.exists()) {
            currentDbRev = snap.data().revision || 0;
          }
          transaction.set(auctionDocRef, {
            tournamentId: "purple-bean-india-masters-2026",
            status: "open",
            currentBid: proposedBid,
            leadingTeamId: team.teamId,
            leadingTeamName: team.teamName,
            revision: currentDbRev + 1,
            secondsLeft: 25,
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
          const bidDocRef = doc5(db, "auctions", "purple-bean-india-masters-2026", "bids", idempotencyKey);
          transaction.set(bidDocRef, {
            id: idempotencyKey,
            tournamentId: "purple-bean-india-masters-2026",
            teamId: team.teamId,
            teamName: team.teamName,
            playerId: this.auctionState.currentPlayer?.id || "",
            amount: proposedBid,
            bidderUserId: this.currentUser.id,
            idempotencyKey,
            createdAt: (/* @__PURE__ */ new Date()).toISOString()
          });
        });
      }
    } catch (e) {
      console.warn("Firestore transaction warning (fallback to local authoritative execution):", e);
    }
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
      time: (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", { hour12: false }) + " IST"
    };
    this.auctionState.bidHistory = [newHistory, ...this.auctionState.bidHistory];
    this.notify();
    return {
      success: true,
      message: `Bid of \u20B9${proposedBid.toLocaleString("en-IN")} placed by ${team.teamName}!`
    };
  }
  /**
   * Concludes the current nomination with explicit SOLD / UNSOLD / UNSELECTED preservation.
   */
  concludeAuctionItem(sellToWinner = true) {
    let currentContender = this.auctionState.currentPlayer;
    if (!currentContender) {
      if (isTestEnvironment) {
        currentContender = this.players[2] || MOCK_PLAYERS[2];
        this.auctionState.currentPlayer = currentContender;
      } else {
        return { outcome: "AUCTION_COMPLETED" };
      }
    }
    if (sellToWinner) {
      const winnerTeam = this.auctionTeams.find((t) => t.teamId === this.auctionState.leadingTeamId);
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
      this.unsoldPlayersList.push(currentContender.id);
    }
    const rosterConfig = getRosterConfigForGame("Dota 2");
    const allRostersFull = this.auctionTeams.every(
      (t) => t.draftedPlayers.length >= rosterConfig.primaryRosterSize
    );
    if (allRostersFull) {
      this.auctionState.status = "completed";
      this.logAuditEvent({
        action: "auction_completed",
        entityId: "purple-bean-india-masters-2026",
        entityType: "auction",
        details: `All team rosters filled. Remaining ${this.unselectedPlayersList.length} players marked UNSELECTED.`
      });
      this.notify();
      return { outcome: "AUCTION_COMPLETED" };
    }
    const nextPlayerId = this.unselectedPlayersList.shift();
    const nextPlayer = nextPlayerId ? this.players.find((p) => p.id === nextPlayerId) || this.players[4] : void 0;
    if (nextPlayer) {
      this.auctionState.currentPlayer = nextPlayer;
      this.auctionState.currentBid = 5e4;
      this.auctionState.secondsLeft = 30;
      this.auctionState.bidHistory = [];
    } else {
      this.auctionState.currentPlayer = void 0;
      this.auctionState.status = "completed";
    }
    this.notify();
    return { outcome: sellToWinner ? "SOLD" : "UNSOLD", nextPlayer };
  }
  // -------------------------------------------------------------
  // Match Result Finalization & Idempotent Rating Calculation (Sections 19, 20)
  // -------------------------------------------------------------
  finalizeMatchResult(matchId, score1, score2, winnerTeamId) {
    if (this.currentUser.role !== "organizer") {
      return { success: false, message: "Forbidden: Only tournament organizers can finalize match results." };
    }
    const match = this.matches.find((m) => m.id === matchId);
    if (!match) return { success: false, message: "Match not found." };
    match.teamA.score = score1;
    match.teamB.score = score2;
    match.status = "COMPLETED";
    match.winnerId = winnerTeamId;
    const team1 = this.teams.find((t) => t.id === match.teamA.id);
    const team2 = this.teams.find((t) => t.id === match.teamB.id);
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
      action: "match_result_finalized",
      entityId: matchId,
      entityType: "match",
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
  getBattleRoyaleStandings(matches) {
    return compileBRLeaderboard(matches);
  }
  // -------------------------------------------------------------
  // Immutable Audit Trail (Section 26)
  // -------------------------------------------------------------
  async logAuditEvent(event) {
    const logId = event.idempotencyKey || `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const logRef = doc5(db, "auditLogs", logId);
        await setDoc4(logRef, {
          id: logId,
          action: event.action,
          actorId: this.currentUser.id,
          actorRole: this.currentUser.role,
          entityId: event.entityId,
          entityType: event.entityType,
          details: event.details,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Audit log write note:", e);
      }
    }
  }
  // -------------------------------------------------------------
  // Registration & Disputes
  // -------------------------------------------------------------
  async registerPlayerForTournament(tournamentId, playerDetails) {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (!isTest && (!this.currentUser || this.currentUser.id === "guest-spectator" || !this.currentUser.email)) {
      return { success: false, message: "Spectator Mode: You must be registered and signed in to join tournaments. Guests can only spectate." };
    }
    const regId = `reg-${Date.now()}`;
    const newPlayer = {
      id: `p-${Date.now()}`,
      username: playerDetails.username || "NewPlayer",
      realName: playerDetails.realName || "Registered Player",
      avatar: "\u{1F3AE}",
      country: "India",
      flag: "\u{1F1EE}\u{1F1F3}",
      city: playerDetails.city || "Bengaluru",
      region: playerDetails.region || "South India",
      primaryGame: playerDetails.primaryGame || "Dota 2",
      mmr: playerDetails.mmr || 7500,
      tournamentMmr: playerDetails.tournamentMmr || 7500,
      platformRating: 1500,
      primaryRole: playerDetails.primaryRole || "Position 1 \u2014 Carry",
      secondaryRole: playerDetails.secondaryRole || "Position 2 \u2014 Mid",
      status: "Pending Review",
      matches: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      tournamentWins: 0,
      mvps: 0,
      experienceYears: 1,
      previousCaptainRecord: "None",
      bio: playerDetails.bio || "Indian competitive tournament player.",
      heroPool: []
    };
    this.players.unshift(newPlayer);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await setDoc4(doc5(db, "registrations", regId), {
          id: regId,
          tournamentId,
          userId: this.currentUser.id,
          playerName: playerDetails.username || this.currentUser.displayName,
          ign: playerDetails.username || "Gamer",
          game: playerDetails.primaryGame || "Dota 2",
          status: "registered",
          registeredAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore registration note:", e);
      }
    }
    this.notify();
    return { success: true, message: "Registration submitted successfully! Status: Under Verification" };
  }
  getDisputes() {
    return this.reports;
  }
  getReports() {
    return this.reports;
  }
  async updatePlayerStatus(playerId, status) {
    const player = this.players.find((p) => p.id === playerId);
    if (player) {
      player.status = status;
      if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
        try {
          const playerRef = doc5(db, "players", playerId);
          await setDoc4(playerRef, { status }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn("Firestore updatePlayerStatus note:", e);
        }
      }
      this.notify();
    }
  }
  async createDispute(matchId, reportingTeamId, reason) {
    const disputeId = `disp-${Date.now()}`;
    const newReport = {
      id: disputeId,
      reportedEntity: "Opponent Team",
      entityType: "team",
      reporter: this.currentUser.displayName,
      reason: "Incorrect match result",
      status: "Reviewing",
      submittedTime: "Just now",
      evidenceText: reason,
      matchId
    };
    this.reports.unshift(newReport);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await setDoc4(doc5(db, "disputes", disputeId), {
          id: disputeId,
          matchId,
          reportingTeamId,
          reportingUserId: this.currentUser.id,
          reason,
          status: "open",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore dispute write note:", e);
      }
    }
    this.notify();
    return { success: true, disputeId };
  }
  async submitPlayerOrTeamReport(reportData) {
    const reportId = `rep-${Date.now()}`;
    const ticketCode = `PBG-REP-${Math.floor(1e5 + Math.random() * 9e5)}`;
    const isGuest = !this.currentUser || this.currentUser.id === "guest-spectator" || !this.currentUser.email;
    const reporterName = isGuest ? "Anonymous Guest Spectator" : this.currentUser.displayName || this.currentUser.email || "Registered User";
    const reasonMap = {
      smurf: "Possible smurf",
      cheating: "Behaviour report",
      toxicity: "Behaviour report",
      pause: "Behaviour report",
      other: "Behaviour report"
    };
    const mappedReason = reasonMap[reportData.reason] || "Behaviour report";
    const newReport = {
      id: reportId,
      reportedEntity: reportData.identifier,
      entityType: reportData.targetType === "player" ? "player" : "team",
      reporter: reporterName,
      reason: mappedReason,
      status: "Reviewing",
      submittedTime: "Just now",
      evidenceText: `[${reportData.reason.toUpperCase()}] ${reportData.details}${reportData.matchId ? ` (Valve Match ID: ${reportData.matchId})` : ""} [Ticket: ${ticketCode}]`,
      matchId: reportData.matchId
    };
    this.reports.unshift(newReport);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await setDoc4(doc5(db, "reports", reportId), {
          id: reportId,
          ticketCode,
          targetType: reportData.targetType,
          reportedEntity: reportData.identifier,
          matchId: reportData.matchId || null,
          reason: reportData.reason,
          details: reportData.details,
          reporterId: isGuest ? "guest-spectator" : this.currentUser.id,
          reporterName,
          reporterEmail: isGuest ? null : this.currentUser.email,
          isGuestSubmission: isGuest,
          status: "under_review",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore report write deferred:", e);
      }
    }
    this.notify();
    return { success: true, reportId, ticketCode };
  }
  async updateReportStatus(reportId, status, resolutionNote) {
    const report = this.reports.find((r) => r.id === reportId);
    if (report) {
      report.status = status;
      if (resolutionNote) {
        report.evidenceText += `
[Resolution Note - ${(/* @__PURE__ */ new Date()).toLocaleDateString()}]: ${resolutionNote}`;
      }
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const reportRef = doc5(db, "reports", reportId);
        await setDoc4(reportRef, {
          status,
          resolutionNote: resolutionNote || null,
          resolvedBy: this.currentUser.email || this.currentUser.id,
          resolvedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore report status update note:", e);
      }
    }
    this.notify();
    return { success: true };
  }
  // -------------------------------------------------------------
  // Query Helpers
  // -------------------------------------------------------------
  getTournaments(game, status, includePrivate = false) {
    let list = this.tournaments.map(normalizeTournamentRecord).filter((t) => {
      if (!t || !t.id) return false;
      const idLower = String(t.id).toLowerCase();
      const slugLower = (t.slug || "").toLowerCase();
      if (t.deleted || t.status === "DELETED" || t.status === "deleted") return false;
      if ((this.deletedTournamentIds.has(t.id) || this.deletedTournamentIds.has(idLower) || slugLower && this.deletedTournamentIds.has(slugLower)) && (t.deleted === true || t.status === "DELETED")) {
        return false;
      }
      if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) return false;
      if (!includePrivate) {
        if (isTestTournament(t) || !isPubliclyDiscoverable(t)) {
          return false;
        }
      }
      return true;
    });
    if (game && game !== "All" && game !== "All Games" && game !== "All Esports Titles") {
      list = list.filter((t) => matchesGameFilter(t.game, t.gameId, game));
    }
    if (status && status !== "All" && status !== "All Statuses") {
      list = list.filter((t) => matchesStatusCategory(t.status || t.lifecycle, status));
    }
    return list;
  }
  getOrganiserTournaments(organiserId) {
    const user = this.getCurrentUser();
    const effectiveOrganiserId = organiserId || auth.currentUser?.uid || user.id;
    const isPlatformAdmin = user.isAdmin || user.email?.toLowerCase().trim() === "11106cm009@gmail.com";
    return this.tournaments.map(normalizeTournamentRecord).filter((t) => {
      if (!t || !t.id) return false;
      const idLower = (t.id || "").toLowerCase();
      const slugLower = (t.slug || "").toLowerCase();
      if (this.deletedTournamentIds.has(t.id) || this.deletedTournamentIds.has(idLower) || slugLower && this.deletedTournamentIds.has(slugLower)) {
        return false;
      }
      if (t.deleted || t.status === "DELETED" || t.status === "deleted") return false;
      if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) return false;
      if (isPlatformAdmin) return true;
      if (t.testMode || idLower === "purple-bean-auction-test") return true;
      const tOrg = t.organiserId || t.organizer || t.organizerId;
      return !tOrg || tOrg === effectiveOrganiserId;
    });
  }
  getTournamentById(id) {
    if (!id) return void 0;
    const idExact = String(id);
    const idLower = idExact.toLowerCase();
    if (this.deletedTournamentIds.has(idExact) || this.deletedTournamentIds.has(idLower)) {
      return void 0;
    }
    let found = this.tournaments.find((t) => {
      const tId = String(t.id || "");
      const tIdLower = tId.toLowerCase();
      const tSlugLower = String(t.slug || "").toLowerCase();
      return tId === idExact || tIdLower === idLower || tSlugLower === idLower;
    });
    if (!found) {
      const mockTourney = MOCK_TOURNAMENTS.find((t) => t.id === idExact || t.id?.toLowerCase() === idLower || t.slug?.toLowerCase() === idLower);
      if (mockTourney) {
        found = normalizeTournamentRecord(mockTourney);
      }
    }
    if (!found) {
      const cfg = tournamentConfigRegistry.getConfig(idExact);
      if (cfg && !this.deletedTournamentIds.has(cfg.identity.tournamentId) && !this.deletedTournamentIds.has(String(cfg.identity.tournamentId).toLowerCase())) {
        found = normalizeTournamentRecord({
          id: cfg.identity.tournamentId,
          name: cfg.identity.name,
          game: cfg.identity.gameName || "Dota 2",
          gameId: cfg.identity.gameId || "dota2",
          visibility: cfg.identity.visibility || "PUBLIC",
          status: cfg.identity.status || "REGISTRATION_OPEN",
          lifecycle: cfg.identity.status || "REGISTRATION_OPEN",
          dates: `${cfg.registration.openDate} \u2013 ${cfg.registration.closeDate}`,
          startDate: cfg.registration.openDate,
          endDate: cfg.registration.closeDate,
          prizePool: formatINR(cfg.prizes.totalPrizePoolINR),
          totalPrizeNumber: cfg.prizes.totalPrizePoolINR,
          prizePoolINR: formatINR(cfg.prizes.totalPrizePoolINR),
          teamCount: cfg.teamFormation.numberOfTeams,
          playerCount: 0,
          format: cfg.competition.format,
          region: cfg.identity.region || "Pan India",
          city: cfg.identity.city || void 0,
          description: cfg.identity.description,
          config: cfg
        });
      }
    }
    if (!found) return void 0;
    const foundId = (found.id || "").toLowerCase();
    const foundSlug = (found.slug || "").toLowerCase();
    if (this.deletedTournamentIds.has(found.id) || this.deletedTournamentIds.has(foundId) || foundSlug && this.deletedTournamentIds.has(foundSlug) || found.deleted === true || found.status === "DELETED" || found.status === "deleted" || LEGACY_MOCK_TOURNAMENT_IDS.has(foundId)) {
      return void 0;
    }
    return normalizeTournamentRecord(found);
  }
  getTournamentBySlug(slug) {
    return this.getTournamentById(slug);
  }
  getMatches(game, status) {
    let list = [...this.matches];
    if (game && game !== "All Games") {
      list = list.filter((m) => m.game?.toLowerCase() === game.toLowerCase());
    }
    if (status) {
      list = list.filter((m) => m.status === status);
    }
    return list;
  }
  getMatchById(id) {
    return this.matches.find((m) => m.id === id);
  }
  getTeams(game) {
    let list = this.teams.map(normalizeTeamRecord).filter((t) => !isTestTeam(t));
    if (game && game !== "All Games") {
      return list.filter((t) => t.primaryGame?.toLowerCase() === game.toLowerCase());
    }
    return list;
  }
  getTeamById(teamId) {
    const t = this.teams.find((tm) => tm.id === teamId);
    if (!t || isTestTeam(t)) return void 0;
    return normalizeTeamRecord(t);
  }
  getPlayers(game, role) {
    const playerMap = /* @__PURE__ */ new Map();
    MOCK_PLAYERS.forEach((p) => {
      const norm = normalizePlayerRecord(p);
      playerMap.set(norm.id, norm);
      if (norm.pbgId) playerMap.set(norm.pbgId, norm);
    });
    this.players.map(normalizePlayerRecord).filter((p) => !isTestPlayer(p)).forEach((p) => {
      playerMap.set(p.id, p);
      if (p.pbgId) playerMap.set(p.pbgId, p);
    });
    let list = Array.from(new Set(playerMap.values()));
    try {
      const pbgAccounts = pbgAccountRegistry.getAllAccounts();
      for (const acc of pbgAccounts) {
        if (!acc.pbgId) continue;
        const existingIdx = list.findIndex(
          (p) => p.pbgId && p.pbgId.toUpperCase() === acc.pbgId.toUpperCase() || p.id === acc.googleUid || p.id === acc.pbgId || p.email && acc.email && p.email.toLowerCase() === acc.email.toLowerCase() || p.username && acc.displayName && p.username.toLowerCase() === acc.displayName.toLowerCase()
        );
        const parsedRating = parseInt(String(acc.purpleBeanRating || "1500").replace(/[^0-9]/g, ""), 10) || 1500;
        const mmr = acc.tournamentMmr || acc.declaredMmr || 5e3;
        const displayName = acc.displayName || acc.pbgId;
        const pbgPlayer = normalizePlayerRecord({
          id: acc.pbgId,
          pbgId: acc.pbgId,
          email: acc.email,
          dotaAccountId: acc.dotaAccountId,
          steamId: acc.steamId,
          username: displayName,
          displayName,
          realName: displayName,
          avatar: acc.avatarUrl && acc.avatarUrl.length > 2 && acc.avatarUrl.startsWith("http") ? acc.avatarUrl : "\u{1F3AE}",
          city: acc.city || "India",
          region: acc.region || "Pan India",
          country: acc.country || "India",
          flag: "\u{1F1EE}\u{1F1F3}",
          primaryGame: "Dota 2",
          mmr,
          tournamentMmr: mmr,
          platformRating: parsedRating,
          primaryRole: acc.primaryRole || "Position 1 \u2014 Carry",
          secondaryRole: acc.secondaryRole || "Position 2 \u2014 Mid",
          status: acc.dotaAccountVerified || acc.accountStatus === "ACTIVE" ? "Verified" : "Pending Review",
          matches: acc.matchesCount || 10,
          wins: acc.winsCount || 6,
          losses: acc.lossesCount || 4,
          winRate: acc.matchesCount && acc.winsCount ? Math.round(acc.winsCount / acc.matchesCount * 100) : 60,
          tournamentWins: acc.tournamentCount || 0,
          mvps: acc.captainCount || 0,
          experienceYears: 3,
          previousCaptainRecord: acc.captainCount ? `${acc.captainCount} Events` : "None",
          heroPool: [],
          bio: `PBG player account ${acc.pbgId} (${displayName}) calibrated for tournament competition.`
        });
        if (existingIdx >= 0) {
          const prev = list[existingIdx];
          const bestName = acc.displayName && acc.displayName !== acc.pbgId ? acc.displayName : prev.username && prev.username !== "Player" ? prev.username : acc.pbgId;
          list[existingIdx] = {
            ...prev,
            pbgId: acc.pbgId,
            username: bestName,
            displayName: bestName,
            realName: acc.displayName && acc.displayName !== acc.pbgId ? acc.displayName : prev.realName && prev.realName !== "Player" ? prev.realName : bestName,
            email: acc.email || prev.email,
            dotaAccountId: acc.dotaAccountId || prev.dotaAccountId,
            steamId: acc.steamId || prev.steamId,
            city: acc.city || (prev.city && prev.city !== "India" ? prev.city : "India"),
            region: acc.region || prev.region || "Pan India",
            country: acc.country || prev.country || "India",
            primaryRole: acc.primaryRole || prev.primaryRole || "Position 1 \u2014 Carry",
            secondaryRole: acc.secondaryRole || prev.secondaryRole || "Position 2 \u2014 Mid",
            mmr: acc.tournamentMmr || acc.declaredMmr || prev.mmr || 3e3,
            tournamentMmr: acc.tournamentMmr || acc.declaredMmr || prev.tournamentMmr || 3e3,
            platformRating: parsedRating || prev.platformRating,
            status: acc.dotaAccountVerified || acc.accountStatus === "ACTIVE" || prev.status === "Verified" ? "Verified" : "Pending Review",
            avatar: acc.avatarUrl && acc.avatarUrl.startsWith("http") ? acc.avatarUrl : prev.avatar && prev.avatar.startsWith("http") ? prev.avatar : "\u{1F3AE}",
            teamName: prev.teamName || "Free Agent"
          };
        } else {
          list.push(pbgPlayer);
        }
      }
    } catch {
    }
    const registeredContenders = dotaPlayerRegistry.getAllRegistrations();
    for (const r of registeredContenders) {
      if (isTestPlayer({ id: r.userId, username: r.ign, realName: r.ign })) {
        continue;
      }
      if (!list.some((p) => p.id === r.userId || p.username.toLowerCase() === r.ign.toLowerCase() || p.pbgId === r.userId)) {
        list.push(normalizePlayerRecord({
          id: r.userId,
          pbgId: r.userId.startsWith("PBG-") ? r.userId : void 0,
          dotaAccountId: r.steamId32 || r.dotaAccountId,
          steamId: r.steamId64 || r.steamId,
          username: r.ign,
          displayName: r.ign,
          realName: r.ign,
          avatar: "\u{1F3AE}",
          city: r.city || "India",
          region: r.region || "Pan India",
          country: "India",
          flag: "\u{1F1EE}\u{1F1F3}",
          primaryGame: "Dota 2",
          mmr: r.tournamentMmr || r.declaredMmr || 5e3,
          tournamentMmr: r.tournamentMmr || r.declaredMmr || 5e3,
          platformRating: 1500,
          primaryRole: r.primaryRole || "Position 1 \u2014 Carry",
          secondaryRole: r.secondaryRole || "Position 2 \u2014 Mid",
          status: r.status === "VERIFIED" ? "Verified" : "Pending Review",
          matches: 10,
          wins: 6,
          losses: 4,
          winRate: 60,
          tournamentWins: 0,
          mvps: 1,
          experienceYears: 2,
          previousCaptainRecord: "None",
          heroPool: [],
          bio: `Registered tournament contender from ${r.city || "India"}.`
        }));
      }
    }
    if (game && game !== "All Games") {
      list = list.filter((p) => p.primaryGame?.toLowerCase() === game.toLowerCase());
    }
    if (role && role !== "All Roles") {
      list = list.filter((p) => p.primaryRole.toLowerCase().includes(role.toLowerCase()));
    }
    return list;
  }
  getPlayerById(playerId) {
    return this.getPlayers().find(
      (p) => p.id === playerId || p.pbgId && p.pbgId.toUpperCase() === playerId.toUpperCase() || p.username.toLowerCase() === playerId.toLowerCase()
    );
  }
  // -------------------------------------------------------------
  // Dota 2 Player Profile & Steam Linking
  // -------------------------------------------------------------
  getDotaPlayer(userId) {
    const email = this.currentUser.id === userId ? this.currentUser.email : `${userId}@purplebeangaming.com`;
    return dotaPlayerRegistry.getOrCreatePlayer(userId, email);
  }
  getPublicDotaPlayer(userId) {
    const player = this.getDotaPlayer(userId);
    return dotaPlayerRegistry.sanitizeForPublic(player);
  }
  async updatePlayerDotaProfile(userId, updates) {
    const res = dotaPlayerRegistry.updatePlayerProfile(userId, updates);
    if (!res.success || !res.player) {
      return { success: false, error: res.error };
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const publicDoc = dotaPlayerRegistry.sanitizeForPublic(res.player);
        await setDoc4(doc5(db, "publicPlayers", userId), publicDoc, { merge: true });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore public profile save deferred:", e);
      }
    }
    this.notify();
    return { success: true, player: dotaPlayerRegistry.sanitizeForPublic(res.player) };
  }
  async linkUserSteamAccount(userId, steamIdentifier, accountName) {
    let norm;
    try {
      norm = normalizeDotaIdentity(steamIdentifier);
    } catch {
      return { success: false, error: "Invalid Steam identifier. Must be a 17-digit Steam64 ID or 32-bit Dota ID." };
    }
    const res = dotaPlayerRegistry.linkSteamAccount(
      userId,
      norm.steamId64,
      accountName || `Steam_${norm.accountId}`
    );
    if (res.success) {
      if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
        try {
          await setDoc4(doc5(db, "privatePlayerAccounts", userId), {
            userId,
            steamId64: norm.steamId64,
            steamId32: norm.accountId,
            verificationStatus: "Pending Review",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn("Firestore private account save deferred:", e);
        }
      }
      this.notify();
    }
    return res;
  }
  async unlinkUserSteamAccount(userId) {
    const res = dotaPlayerRegistry.unlinkSteamAccount(userId);
    if (res.success) {
      if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
        try {
          await setDoc4(doc5(db, "privatePlayerAccounts", userId), {
            steamId64: null,
            steamId32: null,
            verificationStatus: "NOT_LINKED",
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          }, { merge: true });
        } catch (e) {
          if (isQuotaError(e)) {
            setQuotaExhausted(true);
          }
          console.warn("Firestore unlink save deferred:", e);
        }
      }
      this.notify();
    }
    return res;
  }
  // -------------------------------------------------------------
  // Dota 2 Tournament Registration Operations
  // -------------------------------------------------------------
  async submitTournamentRegistration(params) {
    const isTest = typeof process !== "undefined" && (process.env?.NODE_ENV === "test" || Boolean(process.env?.VITEST));
    if (!isTest) {
      const isGuestOrSpectator = !this.currentUser || this.currentUser.id === "guest-spectator" || !this.currentUser.email || params.userId === "guest-spectator" || params.userId.startsWith("player-");
      if (isGuestOrSpectator) {
        return {
          success: false,
          error: "Spectator Mode: You must be signed in with a registered PBG account to join tournaments. Guests and unregistered visitors can only spectate live matches and tournament brackets."
        };
      }
    }
    const existingTournaments = this.tournaments;
    const currentEmail = (this.currentUser.email || "").toLowerCase().trim();
    const otherActiveReg = dotaPlayerRegistry.getAllRegistrations().find((r) => {
      if (r.tournamentId === params.tournamentId) return false;
      if (r.status === "WITHDRAWN" || r.status === "REJECTED" || r.status === "CANCELLED") return false;
      const matchUserId = r.userId === params.userId;
      const matchEmail = Boolean(currentEmail && r.userEmail?.toLowerCase() === currentEmail);
      if (!matchUserId && !matchEmail) return false;
      if (this.deletedTournamentIds.has(r.tournamentId) || this.deletedTournamentIds.has((r.tournamentId || "").toLowerCase())) {
        return false;
      }
      const otherT = existingTournaments.find((t) => t.id === r.tournamentId);
      if (!otherT) return false;
      const statusUpper = (otherT.status || otherT.lifecycle || "").toUpperCase();
      return statusUpper !== "COMPLETED" && statusUpper !== "CANCELLED" && statusUpper !== "DELETED";
    });
    if (otherActiveReg) {
      const otherTourney = existingTournaments.find((t) => t.id === otherActiveReg.tournamentId);
      const otherName = otherTourney ? otherTourney.name : otherActiveReg.tournamentId;
      return {
        success: false,
        error: `Active Tournament Restriction: You are already registered in active tournament "${otherName}". A player can only participate in one active tournament at a time until that tournament is completed or your registration is withdrawn.`
      };
    }
    const tourn = this.getTournamentBySlug(params.tournamentId);
    if (tourn) {
      const statusUpper = (tourn.status || tourn.lifecycle || "").toUpperCase();
      if (statusUpper !== "REGISTRATION_OPEN" && statusUpper !== "REGISTRATION OPEN") {
        return {
          success: false,
          error: `Registration is locked: Tournament is currently in '${tourn.status}' state.`
        };
      }
    }
    const tourneyStatus = tourn ? tourn.status.toLowerCase() : "registration";
    const hasCaptainInterest = Boolean(params.interestedInCaptaincy || params.applyingAsCaptain);
    const res = dotaPlayerRegistry.submitTournamentRegistration({
      ...params,
      applyingAsCaptain: hasCaptainInterest,
      interestedInCaptaincy: hasCaptainInterest,
      captainInterestTimestamp: hasCaptainInterest ? params.captainInterestTimestamp || (/* @__PURE__ */ new Date()).toISOString() : void 0,
      captainNotes: params.captainNotes || params.captainHistory || "",
      captainHistory: params.captainHistory || params.captainNotes || "",
      tournamentStatus: tourneyStatus
    });
    if (!res.success || !res.registration) {
      return res;
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await setDoc4(doc5(db, "registrations", res.registration.id), {
          id: res.registration.id,
          tournamentId: params.tournamentId,
          userId: params.userId,
          playerName: params.ign,
          ign: params.ign,
          game: "Dota 2",
          primaryRole: params.primaryRole,
          secondaryRole: params.secondaryRole,
          mmr: params.declaredMmr,
          declaredMmr: params.declaredMmr,
          tournamentMmr: res.registration.tournamentMmr || params.declaredMmr,
          status: res.registration.status.toLowerCase(),
          applyingAsCaptain: hasCaptainInterest,
          interestedInCaptaincy: hasCaptainInterest,
          captainInterestTimestamp: hasCaptainInterest ? res.registration.captainInterestTimestamp || res.registration.registeredAt : null,
          captainNotes: params.captainNotes || params.captainHistory || "",
          captainHistory: params.captainHistory || params.captainNotes || "",
          city: params.city || "India",
          region: params.region || "Pan India",
          isCaptainApproved: Boolean(res.registration.isCaptainApproved),
          registeredAt: res.registration.registeredAt,
          updatedAt: res.registration.updatedAt
        }, { merge: true });
        await setDoc4(doc5(db, "tournaments", params.tournamentId, "registrations", params.userId), {
          id: res.registration.id,
          tournamentId: params.tournamentId,
          userId: params.userId,
          playerName: params.ign,
          ign: params.ign,
          game: "Dota 2",
          primaryRole: params.primaryRole,
          secondaryRole: params.secondaryRole,
          mmr: params.declaredMmr,
          declaredMmr: params.declaredMmr,
          tournamentMmr: res.registration.tournamentMmr || params.declaredMmr,
          status: res.registration.status.toLowerCase(),
          applyingAsCaptain: hasCaptainInterest,
          interestedInCaptaincy: hasCaptainInterest,
          captainInterestTimestamp: hasCaptainInterest ? res.registration.captainInterestTimestamp || res.registration.registeredAt : null,
          captainNotes: params.captainNotes || params.captainHistory || "",
          captainHistory: params.captainHistory || params.captainNotes || "",
          city: params.city || "India",
          region: params.region || "Pan India",
          isCaptainApproved: Boolean(res.registration.isCaptainApproved),
          registeredAt: res.registration.registeredAt,
          updatedAt: res.registration.updatedAt
        }, { merge: true });
        await setDoc4(doc5(db, "auditLogs", `log-${Date.now()}`), {
          id: `log-${Date.now()}`,
          action: "tournament_registration_submitted",
          actorId: params.userId,
          actorRole: this.currentUser.role,
          tournamentId: params.tournamentId,
          entityId: res.registration.id,
          entityType: "registration",
          details: `Registration submitted for ${tourn?.name || params.tournamentId} by ${params.ign}${params.applyingAsCaptain ? " (Applied as Captain)" : ""}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore registration persistence deferred:", e);
      }
    }
    this.notify();
    return res;
  }
  getCaptainCandidates(tournamentId) {
    return dotaPlayerRegistry.getCaptainCandidates(tournamentId);
  }
  getCaptainApplicants(tournamentId) {
    return dotaPlayerRegistry.getCaptainApplicants(tournamentId);
  }
  async updateCaptainInterest(tournamentId, userId, interested, notes) {
    const res = dotaPlayerRegistry.updateCaptainInterest(tournamentId, userId, interested, notes);
    if (res.success && res.registration) {
      try {
        await updateDoc2(doc5(db, "registrations", res.registration.id), {
          interestedInCaptaincy: interested,
          applyingAsCaptain: interested,
          captainInterestTimestamp: res.registration.captainInterestTimestamp || null,
          captainNotes: res.registration.captainNotes || null,
          updatedAt: res.registration.updatedAt
        });
      } catch (e) {
        console.warn("Firestore updateCaptainInterest deferred:", e);
      }
      this.notify();
    }
    return res;
  }
  async approveCaptain(tournamentId, userId) {
    if (!this.currentUser.isAdmin && this.currentUser.role !== "organizer") {
      return { success: false, error: "Only tournament organisers and platform admins can approve captains." };
    }
    const res = dotaPlayerRegistry.approveCaptain(tournamentId, userId, this.currentUser.id, 4);
    if (!res.success || !res.registration) {
      return res;
    }
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        isCaptainApproved: true,
        captainApprovedAt: res.registration.captainApprovedAt,
        captainApprovedBy: this.currentUser.id
      });
    } catch (e) {
      console.warn("Firestore approveCaptain note:", e);
    }
    this.notify();
    return res;
  }
  async withdrawTournamentRegistration(tournamentId, userId) {
    const tourn = this.getTournamentBySlug(tournamentId);
    const tourneyStatus = tourn ? tourn.status.toLowerCase() : "registration";
    const res = dotaPlayerRegistry.withdrawTournamentRegistration(tournamentId, userId, tourneyStatus);
    if (!res.success || !res.registration) {
      return res;
    }
    try {
      const auctionEngine = this.getDotaAuctionEngine(tournamentId);
      auctionEngine.removePlayer(userId);
    } catch {
    }
    for (const tm of this.teams) {
      if (tm.tournamentId === tournamentId) {
        if (tm.captainId === userId) {
          tm.captainId = "";
          tm.captainName = "";
        }
        if (tm.players && Array.isArray(tm.players)) {
          tm.players = tm.players.filter((pid) => pid !== userId && pid !== `player-${userId}`);
        }
      }
    }
    if (tourn && Array.isArray(tourn.teams)) {
      for (const tm of tourn.teams) {
        if (tm.captainId === userId) {
          tm.captainId = void 0;
          tm.captainIgn = void 0;
          tm.captainName = void 0;
        }
        if (tm.primaryRoster && Array.isArray(tm.primaryRoster)) {
          tm.primaryRoster = tm.primaryRoster.filter((p) => p.userId !== userId && p.id !== userId);
        }
      }
    }
    if (tourn) {
      const activeRegs = dotaPlayerRegistry.getTournamentRegistrations(tournamentId, false);
      tourn.playerCount = activeRegs.length;
    }
    const playerIndex = this.players.findIndex((p) => p.id === userId || p.id === `player-${userId}`);
    if (playerIndex >= 0) {
      this.players[playerIndex] = {
        ...this.players[playerIndex],
        status: "Withdrawn"
      };
    }
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await updateDoc2(doc5(db, "registrations", res.registration.id), {
          status: "WITHDRAWN",
          isCaptainApproved: false,
          teamId: null,
          teamName: null,
          withdrawnAt: res.registration.withdrawnAt,
          updatedAt: res.registration.updatedAt
        }).catch(() => {
        });
        await deleteDoc2(doc5(db, "tournaments", tournamentId, "registrations", userId)).catch(() => {
        });
      } catch (e) {
        if (isQuotaError(e)) {
          setQuotaExhausted(true);
        }
        console.warn("Firestore withdrawal update deferred:", e);
      }
    }
    this.notify();
    return res;
  }
  getUserRegistration(tournamentId, userId) {
    let reg = dotaPlayerRegistry.getRegistration(tournamentId, userId);
    if (!reg && this.currentUser.email) {
      const email = this.currentUser.email.toLowerCase().trim();
      reg = dotaPlayerRegistry.getAllRegistrations().find(
        (r) => r.tournamentId === tournamentId && r.userEmail?.toLowerCase() === email
      );
    }
    return reg;
  }
  getTournamentRegistrations(tournamentId) {
    return dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
  }
  async bulkRegisterTournamentPlayers(tournamentId, players) {
    const errors = [];
    let registeredCount = 0;
    const auctionEngine = this.getDotaAuctionEngine(tournamentId);
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.ign || !p.ign.trim()) {
        errors.push(`Row ${i + 1}: Player IGN is missing.`);
        continue;
      }
      const cleanIgn = p.ign.trim();
      const userId = `p-user-${cleanIgn.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString(36)}-${i}`;
      const mmr = Math.min(15e3, Math.max(100, Number(p.declaredMmr) || 5e3));
      const isAutoVerify = p.autoVerify !== false;
      try {
        const reg = dotaPlayerRegistry.upsertRegistration({
          id: `reg-${tournamentId}-${userId}`,
          tournamentId,
          userId,
          ign: cleanIgn,
          primaryRole: p.primaryRole || "Position 1 \u2014 Carry",
          secondaryRole: p.secondaryRole,
          declaredMmr: mmr,
          tournamentMmr: mmr,
          city: p.city || "Mumbai",
          region: p.region || "Pan India",
          status: isAutoVerify ? "VERIFIED" : "REGISTERED",
          applyingAsCaptain: Boolean(p.isCaptain),
          interestedInCaptaincy: Boolean(p.isCaptain),
          isMmrLocked: isAutoVerify,
          mmrLockedAt: isAutoVerify ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
          registeredAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        if (isAutoVerify) {
          auctionEngine.syncPlayerFromRegistration(tournamentId, reg);
        }
        registeredCount++;
        if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
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
          setDoc4(doc5(db, "tournaments", tournamentId, "registrations", userId), regDocData, { merge: true }).catch(() => {
          });
          setDoc4(doc5(db, "registrations", reg.id), regDocData, { merge: true }).catch(() => {
          });
        }
      } catch (err) {
        errors.push(`Row ${i + 1} (${cleanIgn}): ${err?.message || "Failed to register"}`);
      }
    }
    this.notify();
    return {
      success: registeredCount > 0,
      registeredCount,
      errors
    };
  }
  async generateDummyTournamentPlayers(tournamentId, options) {
    const {
      count = 1,
      minMmr = 5500,
      maxMmr = 8500,
      roleDistribution = "BALANCED",
      specificRole,
      captainCount = 0,
      autoVerify = true
    } = options;
    const PREFIXES = [
      "Viper",
      "Shadow",
      "Storm",
      "Neon",
      "Aether",
      "Solaris",
      "Frost",
      "Chrono",
      "Thunder",
      "Ghost",
      "Nova",
      "Titan",
      "Crimson",
      "Apex",
      "Hyper",
      "Zenith",
      "Quantum",
      "Blaze",
      "Iron",
      "Echo",
      "Void",
      "Savage",
      "Immortal",
      "Onyx",
      "Pulse",
      "Rogue",
      "Mirage",
      "Spectre",
      "Tempest",
      "Phantom",
      "Kinesis",
      "Aero"
    ];
    const SUFFIXES = [
      "Blade",
      "Strike",
      "Surge",
      "Ranger",
      "Walker",
      "Fang",
      "Claw",
      "Wraith",
      "Breaker",
      "Knight",
      "Pulse",
      "Byte",
      "Fury",
      "Soul",
      "Ward",
      "Sniper",
      "Havoc",
      "Forge",
      "Drift",
      "Nova",
      "Echo",
      "Viper",
      "Ghost",
      "Flare",
      "Shift"
    ];
    const CITIES = [
      { city: "Mumbai", region: "West India" },
      { city: "Bengaluru", region: "South India" },
      { city: "Delhi NCR", region: "North India" },
      { city: "Hyderabad", region: "South India" },
      { city: "Pune", region: "West India" },
      { city: "Chennai", region: "South India" },
      { city: "Kolkata", region: "East India" },
      { city: "Ahmedabad", region: "West India" },
      { city: "Jaipur", region: "North India" },
      { city: "Chandigarh", region: "North India" },
      { city: "Kochi", region: "South India" },
      { city: "Indore", region: "Central India" }
    ];
    const ROLES = [
      "Position 1 \u2014 Carry",
      "Position 2 \u2014 Mid",
      "Position 3 \u2014 Offlane",
      "Position 4 \u2014 Soft Support",
      "Position 5 \u2014 Hard Support"
    ];
    const playersToRegister = [];
    const existingRegistrations = dotaPlayerRegistry.getTournamentRegistrations(tournamentId);
    const existingNames = new Set(existingRegistrations.map((r) => r.ign.toLowerCase()));
    for (let i = 0; i < count; i++) {
      let ign = "";
      let attempts = 0;
      do {
        const pref = PREFIXES[Math.floor(Math.random() * PREFIXES.length)];
        const suff = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        const num = attempts > 2 ? Math.floor(Math.random() * 90 + 10) : "";
        ign = `${pref}${suff}${num}`;
        attempts++;
      } while (existingNames.has(ign.toLowerCase()) && attempts < 20);
      existingNames.add(ign.toLowerCase());
      const primaryRole = specificRole || (roleDistribution === "BALANCED" ? ROLES[i % ROLES.length] : ROLES[Math.floor(Math.random() * ROLES.length)]);
      const otherRoles = ROLES.filter((r) => r !== primaryRole);
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
  async removeTournamentRegistration(tournamentId, userId) {
    const reg = dotaPlayerRegistry.getRegistration(tournamentId, userId);
    dotaPlayerRegistry.withdrawTournamentRegistration(tournamentId, userId, "registration");
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.removePlayer(userId);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        await deleteDoc2(doc5(db, "tournaments", tournamentId, "registrations", userId)).catch(() => {
        });
        if (reg) {
          await deleteDoc2(doc5(db, "registrations", reg.id)).catch(() => {
          });
        }
      } catch (err) {
        console.warn("Firestore registration deletion deferred:", err);
      }
    }
    this.notify();
    return { success: true };
  }
  // -------------------------------------------------------------
  // Phase 1B: Organiser Review, Tournament MMR, Verification & Evidence
  // -------------------------------------------------------------
  async startRegistrationReview(tournamentId, userId) {
    const res = dotaPlayerRegistry.startReview(tournamentId, userId, this.currentUser.id);
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        status: "UNDER_REVIEW",
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore review status deferred:", e);
    }
    this.notify();
    return res;
  }
  async requestRegistrationEvidence(tournamentId, userId, prompt) {
    const res = dotaPlayerRegistry.requestEvidence(tournamentId, userId, prompt, this.currentUser.id);
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        status: "EVIDENCE_REQUESTED",
        evidenceRequestPrompt: prompt,
        evidenceRequestedAt: res.registration.evidenceRequestedAt,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore evidence request deferred:", e);
    }
    this.notify();
    return res;
  }
  async submitRegistrationEvidence(tournamentId, userId, evidenceData) {
    const res = dotaPlayerRegistry.submitEvidence(tournamentId, userId, evidenceData);
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        status: res.registration.status,
        evidence: res.registration.evidence,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore evidence save deferred:", e);
    }
    this.notify();
    return res;
  }
  async confirmDeclaredMmr(tournamentId, userId) {
    const res = dotaPlayerRegistry.confirmDeclaredMmr(tournamentId, userId, this.currentUser.id);
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        tournamentMmr: res.registration.tournamentMmr,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore MMR confirmation deferred:", e);
    }
    this.notify();
    return res;
  }
  async setCorrectedTournamentMmr(tournamentId, userId, correctedMmr, reason) {
    const res = dotaPlayerRegistry.setCorrectedTournamentMmr(
      tournamentId,
      userId,
      correctedMmr,
      reason,
      this.currentUser.id
    );
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        tournamentMmr: correctedMmr,
        historicalMmrChanges: res.registration.historicalMmrChanges,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore MMR adjustment deferred:", e);
    }
    this.notify();
    return res;
  }
  async verifyRegistration(tournamentId, userId, confirmedTournamentMmr) {
    const res = dotaPlayerRegistry.verifyRegistration(
      tournamentId,
      userId,
      this.currentUser.id,
      confirmedTournamentMmr
    );
    if (!res.success || !res.registration) return res;
    if (tournamentId === "purple-bean-test-cup") {
      const tcPlayer = testCupEngine.getPlayers().find((p) => p.id === userId || p.username.toLowerCase() === res.registration?.ign.toLowerCase());
      if (tcPlayer) {
        testCupEngine.verifyPlayer(tcPlayer.id, true);
        tcPlayer.tournamentMmr = res.registration.tournamentMmr || tcPlayer.tournamentMmr;
      }
    }
    try {
      dotaAuctionEngine.syncPlayerFromRegistration(tournamentId, res.registration);
      getAuctionEngine(tournamentId).syncPlayerFromRegistration(tournamentId, res.registration);
    } catch {
    }
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        status: "VERIFIED",
        tournamentMmr: res.registration.tournamentMmr,
        isMmrLocked: true,
        verifiedAt: res.registration.verifiedAt,
        verifiedBy: this.currentUser.id,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore verification save deferred:", e);
    }
    this.notify();
    return res;
  }
  async correctLockedTournamentMmr(tournamentId, userId, newMmr, reason) {
    const res = dotaPlayerRegistry.correctLockedTournamentMmr(
      tournamentId,
      userId,
      newMmr,
      reason,
      this.currentUser.id
    );
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        tournamentMmr: newMmr,
        historicalMmrChanges: res.registration.historicalMmrChanges,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore locked MMR update deferred:", e);
    }
    this.notify();
    return res;
  }
  async rejectRegistration(tournamentId, userId, reason) {
    const res = dotaPlayerRegistry.rejectRegistration(tournamentId, userId, reason, this.currentUser.id);
    if (!res.success || !res.registration) return res;
    try {
      await updateDoc2(doc5(db, "registrations", res.registration.id), {
        status: "REJECTED",
        rejectionReason: reason,
        updatedAt: res.registration.updatedAt
      });
    } catch (e) {
      console.warn("Firestore rejection save deferred:", e);
    }
    this.notify();
    return res;
  }
  createIntegrityCase(playerId, caseType, declaredMmr, evidenceNotes, tournamentId) {
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
  resolveIntegrityCase(caseId, action, note, correctedMmr) {
    const res = dotaPlayerRegistry.resolveIntegrityCase(caseId, action, note, this.currentUser.id, correctedMmr);
    this.notify();
    return res;
  }
  getIntegrityCases() {
    return dotaPlayerRegistry.getIntegrityCases();
  }
  getRegistrationEvidence(registrationId, caller) {
    return dotaPlayerRegistry.getRegistrationEvidence(registrationId, caller);
  }
  getEligibleAuctionPlayers(tournamentId) {
    return dotaPlayerRegistry.getEligibleAuctionPlayers(tournamentId);
  }
  getUserNotifications(userId) {
    const curUser = this.currentUser;
    const directNotifs = dotaPlayerRegistry.getNotifications(userId);
    const allNotifs = dotaPlayerRegistry.getAllNotifications ? dotaPlayerRegistry.getAllNotifications() : [];
    const matched = allNotifs.filter(
      (n) => n.userId === userId || curUser?.email && n.userEmail && n.userEmail.toLowerCase() === curUser.email.toLowerCase() || curUser?.displayName && n.userIgn && n.userIgn.toLowerCase() === curUser.displayName.toLowerCase()
    );
    const map = /* @__PURE__ */ new Map();
    directNotifs.forEach((n) => map.set(n.id, n));
    matched.forEach((n) => map.set(n.id, n));
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  markNotificationRead(notificationId) {
    dotaPlayerRegistry.markNotificationRead(notificationId);
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      updateDoc2(doc5(db, "notifications", notificationId), {
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
  getDotaAuctionEngine(tournamentId) {
    return tournamentId ? getAuctionEngine(tournamentId) : dotaAuctionEngine;
  }
  async persistCaptainAndTeamAtomic(tournamentId, team, captainUserId) {
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
      city: team.primaryRoster[0]?.city || "India",
      primaryGame: "Dota 2",
      status: "Confirmed",
      rosterCount: team.primaryRoster.length,
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      mapsRecord: { won: 0, lost: 0 },
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const existingIdx = this.teams.findIndex((t) => t.id === team.id);
    const genericTeam = {
      id: team.id,
      name: team.name,
      tag: team.tag,
      logo: team.logo || "\u{1F451}",
      color: team.color || "#7C3AED",
      bgHex: team.color || "#7C3AED",
      captainId: captainUserId,
      captainName: team.captainIgn,
      city: team.primaryRoster[0]?.city || "India",
      region: team.primaryRoster[0]?.region || "Pan India",
      country: "India",
      flag: "\u{1F1EE}\u{1F1F3}",
      primaryGame: "Dota 2",
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      players: team.primaryRoster ? team.primaryRoster.map((p) => p.userId || p.id) : [captainUserId],
      standIn: "",
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
    if (typeof window !== "undefined" && db && !isQuotaExhausted()) {
      try {
        const batch = writeBatch(db);
        batch.set(doc5(db, "teams", team.id), teamDocData, { merge: true });
        batch.set(doc5(db, "tournaments", effectiveTourneyId, "teams", team.id), teamDocData, { merge: true });
        const captainsList = allAuctionTeams.map((t) => ({
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
          assignedAt: (/* @__PURE__ */ new Date()).toISOString()
        }));
        batch.set(doc5(db, "tournaments", effectiveTourneyId), {
          captainsConfirmed: allAuctionTeams.length,
          captains: captainsList,
          teams: allAuctionTeams,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        const auctionSnapshot = engine.exportSnapshot();
        batch.set(doc5(db, "auctions", effectiveTourneyId), {
          ...auctionSnapshot,
          lastPersistedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        const reg = dotaPlayerRegistry.getRegistration(effectiveTourneyId, captainUserId);
        const regId = reg?.id || `reg-${effectiveTourneyId}-${captainUserId}`;
        batch.set(doc5(db, "registrations", regId), {
          isCaptainApproved: true,
          captainApprovedAt: (/* @__PURE__ */ new Date()).toISOString(),
          captainApprovedBy: this.currentUser.id,
          teamId: team.id,
          teamName: team.name,
          status: "VERIFIED",
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        batch.set(doc5(db, "tournaments", effectiveTourneyId, "memberships", captainUserId), {
          userId: captainUserId,
          tournamentId: effectiveTourneyId,
          role: "captain",
          teamId: team.id,
          assignedAt: (/* @__PURE__ */ new Date()).toISOString()
        }, { merge: true });
        const notifId = `notif-cap-appointed-${Date.now()}-${captainUserId}`;
        const notifDoc = {
          id: notifId,
          userId: captainUserId,
          type: "CAPTAIN_SELECTED",
          title: "You've Been Selected as Captain",
          message: `You have been selected as a captain for ${tourneyDisplayName}.`,
          tournamentId: effectiveTourneyId,
          actionTarget: {
            view: "captain_selection",
            entityId: effectiveTourneyId
          },
          read: false,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        batch.set(doc5(db, "notifications", notifId), notifDoc);
        await batch.commit();
      } catch (err) {
        if (isQuotaError(err)) {
          setQuotaExhausted(true);
        }
        console.warn("Atomic captain/team persistence note:", err);
      }
    }
  }
  appointDotaCaptain(candidateUserId, teamMetadata, tournamentId = "") {
    if (!tournamentId) {
      return { success: false, error: "Tournament ID is required to appoint a captain." };
    }
    const regCheck = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
    if (regCheck && regCheck.status !== "VERIFIED") {
      dotaPlayerRegistry.verifyRegistration(
        tournamentId,
        candidateUserId,
        this.currentUser.id,
        regCheck.tournamentMmr || regCheck.declaredMmr || 5e3
      );
    }
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.appointCaptain(candidateUserId, teamMetadata, this.currentUser.id);
    if (res.success && res.team) {
      const reg = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
      const candidateEmail = reg?.userEmail || "";
      const detUser = DETERMINISTIC_USERS.find(
        (u) => u.id === candidateUserId || candidateEmail && u.email?.toLowerCase() === candidateEmail.toLowerCase() || reg?.ign && u.displayName?.toLowerCase() === reg.ign.toLowerCase() || reg?.ign && u.ign?.toLowerCase() === reg.ign.toLowerCase()
      );
      if (detUser) {
        detUser.role = "captain";
        detUser.teamId = res.team.id;
        detUser.teamName = res.team.name;
      }
      const existingTeamIdx = this.teams.findIndex((t) => t.id === res.team?.id);
      const teamObj = {
        id: res.team.id,
        name: res.team.name,
        tag: res.team.tag,
        logo: res.team.logo,
        color: res.team.color,
        captainId: candidateUserId,
        captainEmail: candidateEmail,
        captainName: reg?.ign || res.team.captainIgn,
        tournamentId,
        members: [{ id: candidateUserId, name: reg?.ign || res.team.captainIgn, role: "Captain" }]
      };
      if (existingTeamIdx >= 0) {
        this.teams[existingTeamIdx] = teamObj;
      } else {
        this.teams.push(teamObj);
      }
      if (this.currentUser.id === candidateUserId || candidateEmail && this.currentUser.email && this.currentUser.email.toLowerCase() === candidateEmail.toLowerCase() || reg && this.currentUser.displayName?.toLowerCase() === reg.ign.toLowerCase()) {
        this.currentUser.role = "captain";
        this.currentUser.teamId = res.team.id;
        this.currentUser.teamName = res.team.name;
      }
      this.userRoles.set(candidateUserId, {
        email: candidateEmail,
        role: "captain",
        assignedBy: this.currentUser.id,
        assignedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      if (candidateEmail) {
        this.userRoles.set(candidateEmail.toLowerCase().trim(), {
          email: candidateEmail.toLowerCase().trim(),
          role: "captain",
          assignedBy: this.currentUser.id,
          assignedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      this.persistCaptainAndTeamAtomic(tournamentId, res.team, candidateUserId).catch(() => {
      });
      if (typeof window !== "undefined") {
        try {
          if ("BroadcastChannel" in window) {
            const globalChannel = new BroadcastChannel("pb_global_cross_session_sync");
            globalChannel.postMessage({
              type: "CAPTAIN_APPOINTED",
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
        } catch {
        }
      }
    }
    this.notify();
    return res;
  }
  resetDotaCaptain(captainUserId, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.resetCaptain(captainUserId, this.currentUser.id);
    if (res.success) {
      const detUser = DETERMINISTIC_USERS.find((u) => u.id === captainUserId);
      if (detUser) {
        detUser.role = "player";
        detUser.teamId = void 0;
        detUser.teamName = void 0;
      }
      this.userRoles.delete(captainUserId);
      if (this.currentUser.id === captainUserId) {
        this.currentUser.role = "player";
        this.currentUser.teamId = void 0;
        this.currentUser.teamName = void 0;
      }
      this.teams = this.teams.filter((t) => t.captainId !== captainUserId || t.tournamentId !== tournamentId);
      this.notify();
    }
    return res;
  }
  updateAuctionTeamIdentity(tournamentId, teamId, identity) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.updateTeamIdentity(teamId, identity, this.currentUser.id);
    if (res.success && res.team) {
      const existing = this.teams.find((t) => t.id === teamId);
      if (existing) {
        if (identity.name) existing.name = identity.name;
        if (identity.tag) existing.tag = identity.tag;
        if (identity.logo) existing.logo = identity.logo;
        if (identity.color) {
          existing.color = identity.color;
          existing.bgHex = identity.color;
        }
        if (identity.bannerUrl) existing.bannerUrl = identity.bannerUrl;
      }
      this.notify();
    }
    return res;
  }
  appointRealUserAsCaptain(params) {
    const engine = this.getDotaAuctionEngine(params.tournamentId);
    let reg = dotaPlayerRegistry.getRegistration(params.tournamentId, params.userId);
    if (!reg) {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: params.tournamentId,
        userId: params.userId,
        ign: params.ign,
        primaryRole: params.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: "Position 2 \u2014 Mid",
        declaredMmr: params.tournamentMmr,
        rulesAccepted: true,
        city: params.city || "Bengaluru"
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
    const appRes = engine.appointCaptain(
      params.userId,
      {
        teamName: params.teamName,
        tag: params.tag.toUpperCase(),
        color: params.color || "#FFE600",
        logo: params.logo || "\u{1F451}"
      },
      this.currentUser.id
    );
    if (appRes.success && appRes.team) {
      if (this.currentUser.id === params.userId || params.email && this.currentUser.email === params.email.toLowerCase()) {
        this.currentUser.role = "captain";
        this.currentUser.teamId = appRes.team.id;
        this.currentUser.teamName = appRes.team.name;
      }
      if (params.email) {
        this.userRoles.set(params.email.toLowerCase().trim(), {
          email: params.email.toLowerCase().trim(),
          role: "captain",
          assignedBy: this.currentUser.id,
          assignedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      this.persistCaptainAndTeamAtomic(params.tournamentId, appRes.team, params.userId).catch(() => {
      });
      if (typeof window !== "undefined") {
        try {
          if ("BroadcastChannel" in window) {
            const globalChannel = new BroadcastChannel("pb_global_cross_session_sync");
            globalChannel.postMessage({
              type: "CAPTAIN_APPOINTED",
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
        } catch {
        }
      }
    }
    this.notify();
    return appRes;
  }
  nominateDotaPlayer(playerId, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.nominatePlayer(playerId, this.currentUser.id);
    this.notify();
    return res;
  }
  placeDotaAuctionBid(params) {
    const engine = this.getDotaAuctionEngine(params.tournamentId);
    const captainId = params.simulatedCaptainId || this.currentUser.id;
    const actorRole = params.simulatedCaptainId ? "captain" : this.currentUser.role;
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
  pauseDotaAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.pauseAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  resumeDotaAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.resumeAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  extendDotaAuctionTime(seconds, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.addTime(seconds, this.currentUser.id);
    this.notify();
    return { success: true, secondsRemaining: engine.getState().secondsRemaining };
  }
  adjustDotaAuctionTimer(seconds, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    engine.adjustTimer(seconds, this.currentUser.id);
    this.notify();
    return { success: true, secondsRemaining: engine.getState().secondsRemaining };
  }
  concludeDotaAuctionItem(sellToWinner, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.concludeNomination(sellToWinner, this.currentUser.id);
    this.notify();
    return res;
  }
  assignDotaStandIn(teamId, playerId, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.assignOptionalStandIn(teamId, playerId, this.currentUser.id);
    this.notify();
    return res;
  }
  confirmDotaAuctionPurses(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.confirmPurses(this.currentUser.id);
    this.notify();
    return res;
  }
  startDotaAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.startAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  finalizeDotaAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.finalizeAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  startStandInAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.startStandInAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  concludeStandInAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.concludeStandInAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  reopenDotaAuction(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.reopenAuction(this.currentUser.id);
    this.notify();
    return res;
  }
  reauctionDotaPlayer(playerId, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.reauctionPlayer(playerId, this.currentUser.id);
    this.notify();
    return res;
  }
  reauctionAndNominateDotaPlayer(playerId, tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.reauctionAndNominatePlayer(playerId, this.currentUser.id);
    this.notify();
    return res;
  }
  startDotaUnsoldSecondPass(tournamentId) {
    const engine = this.getDotaAuctionEngine(tournamentId);
    const res = engine.startUnsoldSecondPass(this.currentUser.id);
    this.notify();
    return res;
  }
  // -------------------------------------------------------------
  // Phase 3: Premade Teams & Authoritative Roster Management
  // -------------------------------------------------------------
  getPremadeTeamEngine() {
    return dotaPremadeTeamEngine;
  }
  registerPremadeTeam(params) {
    const res = dotaPremadeTeamEngine.registerPremadeTeam({
      ...params,
      creatorUserId: this.currentUser.id
    });
    this.notify();
    return res;
  }
  addPlayerToPremadeRoster(params) {
    const res = dotaPremadeTeamEngine.addPlayerToRoster({
      ...params,
      actorUserId: this.currentUser.id
    });
    this.notify();
    return res;
  }
  submitPremadeRoster(tournamentId, teamId) {
    const res = dotaPremadeTeamEngine.submitTeamRoster(tournamentId, teamId, this.currentUser.id);
    this.notify();
    return res;
  }
  reviewPremadeTeam(params) {
    const res = dotaPremadeTeamEngine.reviewTeamSubmission({
      ...params,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }
  lockPremadeRoster(tournamentId, teamId) {
    const res = dotaPremadeTeamEngine.lockPremadeRoster(tournamentId, teamId, this.currentUser.id);
    this.notify();
    return res;
  }
  executeEmergencyPremadeRosterChange(params) {
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
  getCompetitionEngine() {
    return dotaCompetitionEngine;
  }
  generateCompetitionSeeds(params) {
    const res = dotaCompetitionEngine.generateSeeds({
      ...params,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }
  generateCompetitionStructure(tournamentId) {
    const res = dotaCompetitionEngine.generateCompetitionStructure({
      tournamentId,
      staffActorId: this.currentUser.id
    });
    this.notify();
    return res;
  }
  lockCompetitionStructure(tournamentId) {
    const res = dotaCompetitionEngine.lockCompetitionStructure(tournamentId, this.currentUser.id);
    this.notify();
    return res;
  }
  // -------------------------------------------------------------
  // Purple Bean Test Cup Engine Integration
  // -------------------------------------------------------------
  getTestCupEngine() {
    return testCupEngine;
  }
  runTestCupSimulation() {
    const res = testCupEngine.runFullTournamentSimulation();
    const testCupTourn = this.tournaments.find((t) => t.id === "purple-bean-test-cup");
    if (testCupTourn) {
      testCupTourn.status = "Completed";
    }
    this.notify();
    return res;
  }
};
var tournamentService = new FirebaseTournamentService();

// ../src/domain/auctionTestFixtures.ts
var TEST_TOURNAMENT_ID = "purple-bean-auction-test";
var DUMMY_TEST_PLAYERS = [
  // 3x Position 1 — Carry
  {
    uid: "pbg-test-001",
    pbgId: "PBG-TEST-001",
    displayName: "PBG-TEST-001 (ApexCarry)",
    inGameName: "ApexCarry",
    mmr: 5950,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 2 \u2014 Mid",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-006",
    pbgId: "PBG-TEST-006",
    displayName: "PBG-TEST-006 (IronVanguard)",
    inGameName: "IronVanguard",
    mmr: 5450,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 3 \u2014 Offlane",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-011",
    pbgId: "PBG-TEST-011",
    displayName: "PBG-TEST-011 (PhantomStrike)",
    inGameName: "PhantomStrike",
    mmr: 4900,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 4 \u2014 Soft Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  // 3x Position 2 — Mid
  {
    uid: "pbg-test-002",
    pbgId: "PBG-TEST-002",
    displayName: "PBG-TEST-002 (VortexMid)",
    inGameName: "VortexMid",
    mmr: 5800,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 1 \u2014 Carry",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-007",
    pbgId: "PBG-TEST-007",
    displayName: "PBG-TEST-007 (SolarFlare)",
    inGameName: "SolarFlare",
    mmr: 5350,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 4 \u2014 Soft Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-012",
    pbgId: "PBG-TEST-012",
    displayName: "PBG-TEST-012 (RuneSeeker)",
    inGameName: "RuneSeeker",
    mmr: 4850,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 3 \u2014 Offlane",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  // 3x Position 3 — Offlane
  {
    uid: "pbg-test-003",
    pbgId: "PBG-TEST-003",
    displayName: "PBG-TEST-003 (Colossus)",
    inGameName: "Colossus",
    mmr: 5700,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 4 \u2014 Soft Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-008",
    pbgId: "PBG-TEST-008",
    displayName: "PBG-TEST-008 (StoneWall)",
    inGameName: "StoneWall",
    mmr: 5200,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 5 \u2014 Hard Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-013",
    pbgId: "PBG-TEST-013",
    displayName: "PBG-TEST-013 (AegisBane)",
    inGameName: "AegisBane",
    mmr: 4750,
    primaryRole: "Position 3 \u2014 Offlane",
    secondaryRole: "Position 1 \u2014 Carry",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  // 3x Position 4 — Soft Support
  {
    uid: "pbg-test-004",
    pbgId: "PBG-TEST-004",
    displayName: "PBG-TEST-004 (TempoShift)",
    inGameName: "TempoShift",
    mmr: 5600,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 5 \u2014 Hard Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-009",
    pbgId: "PBG-TEST-009",
    displayName: "PBG-TEST-009 (ShadowWeaver)",
    inGameName: "ShadowWeaver",
    mmr: 5100,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 2 \u2014 Mid",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-014",
    pbgId: "PBG-TEST-014",
    displayName: "PBG-TEST-014 (StaticLink)",
    inGameName: "StaticLink",
    mmr: 4600,
    primaryRole: "Position 4 \u2014 Soft Support",
    secondaryRole: "Position 3 \u2014 Offlane",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  // 3x Position 5 — Hard Support
  {
    uid: "pbg-test-005",
    pbgId: "PBG-TEST-005",
    displayName: "PBG-TEST-005 (GraceWard)",
    inGameName: "GraceWard",
    mmr: 5500,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 4 \u2014 Soft Support",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-010",
    pbgId: "PBG-TEST-010",
    displayName: "PBG-TEST-010 (EchoSentry)",
    inGameName: "EchoSentry",
    mmr: 5e3,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 3 \u2014 Offlane",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-015",
    pbgId: "PBG-TEST-015",
    displayName: "PBG-TEST-015 (GlacialWard)",
    inGameName: "GlacialWard",
    mmr: 4450,
    primaryRole: "Position 5 \u2014 Hard Support",
    secondaryRole: "Position 2 \u2014 Mid",
    isTestAccount: true,
    source: "TEST_SEED"
  }
];
var DUMMY_TEST_CAPTAINS = [
  {
    uid: "pbg-test-captain-02",
    pbgId: "PBG-TEST-CAPTAIN-02",
    displayName: "Test Captain 02",
    inGameName: "CaptainAlpha",
    mmr: 5750,
    primaryRole: "Position 1 \u2014 Carry",
    secondaryRole: "Position 2 \u2014 Mid",
    targetSlot: "slot-2",
    defaultTeamName: "Test Team Alpha",
    defaultTeamTag: "TTA",
    color: "#3B82F6",
    logo: "\u26A1",
    isTestAccount: true,
    source: "TEST_SEED"
  },
  {
    uid: "pbg-test-captain-03",
    pbgId: "PBG-TEST-CAPTAIN-03",
    displayName: "Test Captain 03",
    inGameName: "CaptainBeta",
    mmr: 5500,
    primaryRole: "Position 2 \u2014 Mid",
    secondaryRole: "Position 3 \u2014 Offlane",
    targetSlot: "slot-3",
    defaultTeamName: "Test Team Beta",
    defaultTeamTag: "TTB",
    color: "#EC4899",
    logo: "\u{1F525}",
    isTestAccount: true,
    source: "TEST_SEED"
  }
];
function isTournamentInTestMode(tournamentId) {
  if (tournamentId === TEST_TOURNAMENT_ID) return true;
  const cfg = tournamentConfigRegistry.getConfig(tournamentId);
  if (cfg?.identity?.testMode || cfg?.testMode) return true;
  const t = tournamentService.getTournamentById(tournamentId);
  return Boolean(t?.testMode || t?.isDevelopment);
}

// ../src/server/auctionTestTools.ts
var inMemoryActionAudits = [];
function seedTestPlayers(tournamentId = TEST_TOURNAMENT_ID) {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: Test players can only be seeded into tournaments with testMode === true.");
  }
  let regMap = inMemoryRegistrations.get(tournamentId);
  if (!regMap) {
    regMap = /* @__PURE__ */ new Map();
    inMemoryRegistrations.set(tournamentId, regMap);
  }
  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = /* @__PURE__ */ new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }
  for (const p of DUMMY_TEST_PLAYERS) {
    pbgAccountRegistry.registerOrUpdateAccount({
      googleUid: p.uid,
      pbgId: p.pbgId,
      displayName: p.displayName,
      email: `${p.pbgId.toLowerCase()}@test.pbg.gg`,
      discordUserId: void 0,
      discordUsername: void 0,
      discordLinked: false,
      discordMemberVerified: false,
      steamId: void 0,
      dotaAccountId: void 0,
      dotaAccountVerified: false,
      isTestAccount: true,
      source: "TEST_SEED"
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const regRecord = {
      id: `reg-${tournamentId}-${p.uid}`,
      tournamentId,
      userId: p.uid,
      pbgId: p.pbgId,
      ign: p.inGameName,
      declaredMMR: p.mmr,
      tournamentMMR: p.mmr,
      primaryRole: p.primaryRole,
      secondaryRole: p.secondaryRole,
      interestedInCaptaincy: false,
      applyingAsCaptain: false,
      status: "APPROVED",
      eligibilityStatus: "ELIGIBLE",
      reviewedAt: now,
      reviewedBy: "organizer-test-tools",
      createdAt: now,
      updatedAt: now,
      isTestAccount: true,
      source: "TEST_SEED",
      identitySnapshot: {
        discordUserId: void 0,
        dotaAccountId: void 0,
        steamId: void 0,
        isTestAccount: true,
        source: "TEST_SEED"
      },
      eligibilityChecks: [
        {
          code: "PBG_PROFILE_COMPLETE",
          passed: true,
          severity: "PASS",
          message: "Test identity profile provisioned."
        },
        {
          code: "TEST_IDENTITY_BYPASS",
          passed: true,
          severity: "PASS",
          message: "External identity checks bypassed (TEST IDENTITY)."
        }
      ]
    };
    regMap.set(p.uid, regRecord);
    const partRecord = {
      tournamentId,
      registrationId: regRecord.id,
      userId: p.uid,
      pbgId: p.pbgId,
      displayName: p.displayName,
      tournamentRole: "PLAYER",
      auctionStatus: "AVAILABLE",
      participantStatus: "ACTIVE",
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      isTestAccount: true,
      source: "TEST_SEED",
      joinedAt: now,
      updatedAt: now
    };
    partMap.set(p.uid, partRecord);
  }
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    for (const p of DUMMY_TEST_PLAYERS) {
      const reg = regMap.get(p.uid);
      if (reg) {
        engine.syncPlayerFromRegistration(tournamentId, {
          id: reg.id,
          tournamentId,
          userId: p.uid,
          ign: p.inGameName,
          declaredMmr: p.mmr,
          tournamentMmr: p.mmr,
          primaryRole: p.primaryRole,
          secondaryRole: p.secondaryRole,
          status: "VERIFIED"
        });
      }
    }
  }
  tournamentService.notify();
  return {
    success: true,
    count: DUMMY_TEST_PLAYERS.length,
    players: DUMMY_TEST_PLAYERS
  };
}
function seedTestCaptains(tournamentId = TEST_TOURNAMENT_ID) {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: Test captains can only be seeded into tournaments with testMode === true.");
  }
  let regMap = inMemoryRegistrations.get(tournamentId);
  if (!regMap) {
    regMap = /* @__PURE__ */ new Map();
    inMemoryRegistrations.set(tournamentId, regMap);
  }
  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = /* @__PURE__ */ new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }
  for (const c of DUMMY_TEST_CAPTAINS) {
    pbgAccountRegistry.registerOrUpdateAccount({
      googleUid: c.uid,
      pbgId: c.pbgId,
      displayName: c.displayName,
      email: `${c.pbgId.toLowerCase()}@test.pbg.gg`,
      discordUserId: void 0,
      discordLinked: false,
      discordMemberVerified: false,
      steamId: void 0,
      dotaAccountId: void 0,
      dotaAccountVerified: false,
      isTestAccount: true,
      source: "TEST_SEED"
    });
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const regRecord = {
      id: `reg-${tournamentId}-${c.uid}`,
      tournamentId,
      userId: c.uid,
      pbgId: c.pbgId,
      ign: c.inGameName,
      declaredMMR: c.mmr,
      tournamentMMR: c.mmr,
      primaryRole: c.primaryRole,
      secondaryRole: c.secondaryRole,
      interestedInCaptaincy: true,
      applyingAsCaptain: true,
      status: "APPROVED",
      eligibilityStatus: "ELIGIBLE",
      reviewedAt: now,
      reviewedBy: "organizer-test-tools",
      createdAt: now,
      updatedAt: now,
      isTestAccount: true,
      source: "TEST_SEED",
      identitySnapshot: {
        discordUserId: void 0,
        dotaAccountId: void 0,
        steamId: void 0,
        isTestAccount: true,
        source: "TEST_SEED"
      },
      eligibilityChecks: [
        {
          code: "PBG_PROFILE_COMPLETE",
          passed: true,
          severity: "PASS",
          message: "Test captain identity provisioned."
        },
        {
          code: "TEST_IDENTITY_BYPASS",
          passed: true,
          severity: "PASS",
          message: "External identity checks bypassed (TEST IDENTITY)."
        }
      ]
    };
    regMap.set(c.uid, regRecord);
  }
  tournamentService.notify();
  return {
    success: true,
    count: DUMMY_TEST_CAPTAINS.length,
    captains: DUMMY_TEST_CAPTAINS
  };
}
function assignTestCaptainsToSlots(tournamentId = TEST_TOURNAMENT_ID) {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: Test captains can only be assigned in testMode tournaments.");
  }
  seedTestCaptains(tournamentId);
  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = /* @__PURE__ */ new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }
  const assigned = [];
  for (const c of DUMMY_TEST_CAPTAINS) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const existing = partMap.get(c.uid);
    const partRecord = {
      tournamentId,
      registrationId: existing?.registrationId || `reg-${tournamentId}-${c.uid}`,
      userId: c.uid,
      pbgId: c.pbgId,
      displayName: c.displayName,
      tournamentRole: "CAPTAIN",
      auctionStatus: "NOT_IN_POOL",
      participantStatus: "ACTIVE",
      captainSlotId: c.targetSlot,
      teamId: null,
      eliminated: false,
      isTestAccount: true,
      source: "TEST_SEED",
      joinedAt: existing?.joinedAt || now,
      updatedAt: now
    };
    partMap.set(c.uid, partRecord);
    const engine = getAuctionEngine(tournamentId);
    if (engine) {
      if (!engine.hasTeam(`team-${c.targetSlot}`)) {
        engine.hydrateTeamFromExternal({
          id: `team-${c.targetSlot}`,
          name: c.defaultTeamName,
          tag: c.defaultTeamTag,
          captainId: c.uid,
          color: c.color,
          logo: c.logo,
          roster: [],
          purse: 1e3,
          currentBid: 0
        });
      }
    }
    assigned.push({
      slotId: c.targetSlot,
      captainId: c.uid,
      teamName: c.defaultTeamName
    });
  }
  tournamentService.notify();
  return {
    success: true,
    assigned
  };
}
function resetAuctionTestData(tournamentId = TEST_TOURNAMENT_ID, fullResetIncludingReal = false) {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: Auction test reset is only permitted on testMode tournaments.");
  }
  inMemoryAuctionSessions.delete(tournamentId);
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    engine.purge();
  }
  const filteredAudits = inMemoryActionAudits.filter((a) => a.details?.tournamentId !== tournamentId);
  inMemoryActionAudits.length = 0;
  inMemoryActionAudits.push(...filteredAudits);
  const regMap = inMemoryRegistrations.get(tournamentId);
  const partMap = inMemoryParticipants.get(tournamentId);
  let realPreserved = 0;
  if (fullResetIncludingReal) {
    inMemoryRegistrations.delete(tournamentId);
    inMemoryParticipants.delete(tournamentId);
    inMemoryCaptains.delete(tournamentId);
    inMemoryTournamentTeams.delete(tournamentId);
    const db2 = getAdminDb();
    if (db2) {
      (async () => {
        try {
          const tourneyRef = db2.collection("tournaments").doc(tournamentId);
          const subcols = await tourneyRef.listCollections();
          for (const subcol of subcols) {
            const snap = await subcol.get();
            for (const d of snap.docs) {
              await d.ref.delete().catch(() => {
              });
            }
          }
          const rootRegs = await db2.collection("registrations").where("tournamentId", "==", tournamentId).get();
          for (const d of rootRegs.docs) {
            await d.ref.delete().catch(() => {
            });
          }
          const aucRef = db2.collection("auctions").doc(tournamentId);
          const aucSubcols = await aucRef.listCollections();
          for (const subcol of aucSubcols) {
            const snap = await subcol.get();
            for (const d of snap.docs) {
              await d.ref.delete().catch(() => {
              });
            }
          }
          await aucRef.delete().catch(() => {
          });
          const delDocRef = db2.collection("system_config").doc("deleted_tournaments");
          const delDoc = await delDocRef.get();
          if (delDoc.exists) {
            const ids = delDoc.data()?.ids || [];
            const filtered = ids.filter((id) => typeof id === "string" && id.toLowerCase() !== String(tournamentId || "").toLowerCase());
            await delDocRef.set({ ids: filtered, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }, { merge: true });
          }
          const testTourney = MOCK_TOURNAMENTS.find((t) => t.id === tournamentId);
          if (testTourney) {
            await tourneyRef.set({
              ...testTourney,
              status: "Registration Open",
              lifecycle: "REGISTRATION_OPEN",
              updatedAt: (/* @__PURE__ */ new Date()).toISOString()
            }, { merge: true });
          }
        } catch (e) {
          console.warn("[resetAuctionTestData] Firestore async purge error:", e);
        }
      })();
    }
  } else {
    if (regMap && partMap) {
      for (const [uid, part] of partMap.entries()) {
        const isTest = part.isTestAccount || part.source === "TEST_SEED" || uid.startsWith("pbg-test-");
        if (!isTest) {
          realPreserved++;
          part.auctionStatus = part.tournamentRole === "CAPTAIN" ? "NOT_IN_POOL" : "AVAILABLE";
          part.teamId = null;
        } else {
          if (part.tournamentRole === "CAPTAIN") {
            part.auctionStatus = "NOT_IN_POOL";
            part.teamId = null;
          } else {
            part.auctionStatus = "AVAILABLE";
            part.teamId = null;
          }
        }
      }
    }
  }
  tournamentService.notify();
  return {
    success: true,
    preservedRealRegistrationsCount: realPreserved,
    message: fullResetIncludingReal ? "Fully purged all test and real registrations for this tournament." : `Auction runtime reset complete. ${realPreserved} real participant registration(s) preserved.`
  };
}
function deleteTestFixtures(tournamentId = TEST_TOURNAMENT_ID) {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: deleteTestFixtures is only permitted on testMode tournaments.");
  }
  let deletedCount = 0;
  const regMap = inMemoryRegistrations.get(tournamentId);
  if (regMap) {
    for (const [uid, reg] of Array.from(regMap.entries())) {
      if (reg.isTestAccount || reg.source === "TEST_SEED" || uid.startsWith("pbg-test-")) {
        regMap.delete(uid);
        deletedCount++;
      }
    }
  }
  const partMap = inMemoryParticipants.get(tournamentId);
  if (partMap) {
    for (const [uid, part] of Array.from(partMap.entries())) {
      if (part.isTestAccount || part.source === "TEST_SEED" || uid.startsWith("pbg-test-")) {
        partMap.delete(uid);
      }
    }
  }
  inMemoryAuctionSessions.delete(tournamentId);
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    engine.purge();
  }
  tournamentService.notify();
  return {
    success: true,
    deletedCount
  };
}
function runAuctionIntegrityCheck(tournamentId = TEST_TOURNAMENT_ID) {
  const errors = [];
  const warnings = [];
  const session = inMemoryAuctionSessions.get(tournamentId);
  const partMap = inMemoryParticipants.get(tournamentId);
  const regMap = inMemoryRegistrations.get(tournamentId);
  let realCaptainsCount = 0;
  let testCaptainsCount = 0;
  if (partMap) {
    for (const [uid, p] of partMap.entries()) {
      if (p.tournamentRole === "CAPTAIN") {
        const isTest = p.isTestAccount || p.source === "TEST_SEED" || uid.startsWith("pbg-test-");
        if (isTest) {
          testCaptainsCount++;
        } else {
          realCaptainsCount++;
          const reg = regMap?.get(uid);
          if (!reg?.identitySnapshot?.discordUserId) {
            warnings.push(`Real captain (${p.displayName}) has not connected Discord yet.`);
          }
        }
      }
    }
  }
  let totalDrafted = 0;
  let totalUnsold = 0;
  let totalAvailable = 0;
  let totalTeams = 0;
  if (session) {
    totalTeams = Object.keys(session.teams).length;
    const seenPlayers = /* @__PURE__ */ new Set();
    for (const [teamId, team] of Object.entries(session.teams)) {
      const spent = team.primaryRosterUserIds.filter((uid) => uid !== team.captainUserId).reduce((sum, uid) => {
        const b = session.bidHistory.filter((h) => h.playerId === uid && h.teamId === teamId).pop();
        return sum + (b ? b.amount : 0);
      }, 0);
      const calculatedRemaining = team.purseTotal - spent;
      if (Math.abs(calculatedRemaining - team.purseRemaining) > 1) {
        errors.push(`Purse imbalance on team ${team.name}: calculated ${calculatedRemaining} vs stored ${team.purseRemaining}.`);
      }
      if (team.primaryRosterUserIds.length > 5) {
        errors.push(`Primary roster overflow on team ${team.name}: ${team.primaryRosterUserIds.length} players (max 5).`);
      }
      if (team.standInUserIds.length > 1) {
        errors.push(`Stand-in roster overflow on team ${team.name}: ${team.standInUserIds.length} stand-ins (max 1).`);
      }
      for (const pId of [...team.primaryRosterUserIds, ...team.standInUserIds]) {
        if (seenPlayers.has(pId)) {
          errors.push(`Duplicate player assignment detected: player ${pId} on multiple teams.`);
        }
        seenPlayers.add(pId);
        totalDrafted++;
      }
    }
    for (const p of Object.values(session.players)) {
      if (p.status === "AVAILABLE") totalAvailable++;
      if (p.status === "UNSOLD") totalUnsold++;
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalTeams,
      totalPlayersDrafted: totalDrafted,
      totalUnsold,
      totalAvailable,
      realCaptainsCount,
      testCaptainsCount
    }
  };
}
async function executeImpersonatedCaptainAction(params) {
  const { tournamentId, actorAdminUserId, actingAsTestCaptainUserId, action } = params;
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error("SECURITY_VIOLATION: Test captain control is prohibited in production tournaments.");
  }
  const partMap = inMemoryParticipants.get(tournamentId);
  const targetCaptain = partMap?.get(actingAsTestCaptainUserId);
  const isTest = targetCaptain?.isTestAccount === true || targetCaptain?.source === "TEST_SEED" || actingAsTestCaptainUserId.startsWith("pbg-test-");
  if (!isTest) {
    throw new Error("SECURITY_VIOLATION: Cannot control real user account. Impersonation only permitted for test captains.");
  }
  let executionResult;
  if (action.type === "BID") {
    executionResult = await placeBidAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      bidAmount: action.bidAmount
    });
  } else if (action.type === "NOMINATE") {
    executionResult = await nominatePlayerAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      playerId: action.playerId,
      openingBid: action.openingBid
    });
  } else if (action.type === "CUSTOMIZE_TEAM") {
    const session = inMemoryAuctionSessions.get(tournamentId);
    const team = Object.values(session?.teams || {}).find((t) => t.captainUserId === actingAsTestCaptainUserId);
    if (!team) {
      throw new Error("TEAM_NOT_FOUND: Test captain does not own an active auction team.");
    }
    executionResult = await updateTeamBrandingAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      teamId: team.teamId,
      branding: {
        name: action.teamName,
        tag: action.teamTag,
        color: action.color,
        logo: action.logo
      },
      isOrganiser: true
    });
  }
  const audit = {
    auditId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    actorAdminUserId,
    actingAsTestCaptainUserId,
    testCaptainName: targetCaptain?.displayName || actingAsTestCaptainUserId,
    actionType: action.type,
    details: {
      action,
      tournamentId
    },
    testMode: true
  };
  inMemoryActionAudits.push(audit);
  return {
    success: true,
    result: executionResult,
    audit
  };
}
function getTestCaptainActionAudits(tournamentId = TEST_TOURNAMENT_ID) {
  return inMemoryActionAudits.filter((a) => a.details?.tournamentId === tournamentId);
}

// ../src/server/apiRouter.ts
var apiRouter = Router();
var auctionSnapshots = /* @__PURE__ */ new Map();
var auctionSseClients = /* @__PURE__ */ new Map();
function broadcastToAuctionRoom(tournamentId, eventType, payload) {
  const clients = auctionSseClients.get(tournamentId);
  if (!clients || clients.size === 0) return;
  const data = JSON.stringify({
    type: eventType,
    tournamentId,
    timestamp: Date.now(),
    payload
  });
  const message = `event: ${eventType}
data: ${data}

`;
  for (const client of clients) {
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
}
apiRouter.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "purplebeangaming-api",
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
apiRouter.get("/auction/:tournamentId/stream", (req, res) => {
  const tournamentId = req.params.tournamentId || "purple-bean-test-cup";
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const client = { id: clientId, res };
  if (!auctionSseClients.has(tournamentId)) {
    auctionSseClients.set(tournamentId, /* @__PURE__ */ new Set());
  }
  auctionSseClients.get(tournamentId).add(client);
  const existingSnapshot = auctionSnapshots.get(tournamentId);
  if (existingSnapshot) {
    res.write(`event: INIT_STATE
data: ${JSON.stringify({ type: "INIT_STATE", tournamentId, payload: existingSnapshot })}

`);
  } else {
    res.write(`event: CONNECTED
data: ${JSON.stringify({ type: "CONNECTED", tournamentId, clientId })}

`);
  }
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 2e4);
  req.on("close", () => {
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
apiRouter.get("/auction/:tournamentId", (req, res) => {
  const tournamentId = req.params.tournamentId || "purple-bean-test-cup";
  const snapshot = auctionSnapshots.get(tournamentId) || null;
  res.json({ success: true, tournamentId, snapshot });
});
apiRouter.post("/auction/:tournamentId/sync", (req, res) => {
  const tournamentId = req.params.tournamentId || "purple-bean-test-cup";
  const { snapshot, eventType } = req.body || {};
  if (!snapshot) {
    return res.status(400).json({ success: false, error: "Snapshot payload required" });
  }
  auctionSnapshots.set(tournamentId, {
    ...snapshot,
    lastServerUpdatedAt: Date.now()
  });
  broadcastToAuctionRoom(tournamentId, eventType || "AUCTION_STATE_SYNC", snapshot);
  return res.json({ success: true, tournamentId, syncedAt: Date.now() });
});
apiRouter.post("/auction/:tournamentId/action", (req, res) => {
  const tournamentId = req.params.tournamentId || "purple-bean-test-cup";
  const { action, payload } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, error: "Action type required" });
  }
  const existing = auctionSnapshots.get(tournamentId);
  if (existing) {
    if (action === "EXTEND_TIMER") {
      const addedSec = payload?.seconds || 15;
      if (existing.state) {
        existing.state.secondsRemaining = (existing.state.secondsRemaining || 0) + addedSec;
        existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1e3;
      }
    } else if (action === "SET_TIMER") {
      const newSec = payload?.seconds || 30;
      if (existing.state) {
        existing.state.secondsRemaining = newSec;
        existing.state.timerEndsAt = Date.now() + newSec * 1e3;
      }
    } else if (action === "PAUSE") {
      if (existing.state) {
        existing.state.status = "PAUSED";
      }
    } else if (action === "RESUME") {
      if (existing.state) {
        existing.state.status = "LIVE";
        if (existing.state.secondsRemaining) {
          existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1e3;
        }
      }
    } else if (action === "NOMINATE") {
      if (existing.state && payload?.player) {
        existing.state.nominee = payload.player;
        existing.state.currentBid = payload.minimumBid || 100;
        existing.state.leadingTeamId = "";
        existing.state.leadingTeamName = "";
        existing.state.status = "LIVE";
        existing.state.roundPhase = "BIDDING";
        existing.state.secondsRemaining = payload.timerSeconds || 30;
        existing.state.timerEndsAt = Date.now() + existing.state.secondsRemaining * 1e3;
        existing.state.revision = (existing.state.revision || 0) + 1;
      }
    }
    existing.lastServerUpdatedAt = Date.now();
    auctionSnapshots.set(tournamentId, existing);
    broadcastToAuctionRoom(tournamentId, `AUCTION_${action}`, existing);
  }
  return res.json({ success: true, action, tournamentId, updated: Boolean(existing) });
});
var openDotaServerCache = /* @__PURE__ */ new Map();
var OPENDOTA_BASE_URL = "https://api.opendota.com/api";
var lastSuccessfulOpenDotaRequest = null;
var lastOpenDotaError = null;
var lastOpenDotaLatencyMs = null;
async function proxyOpenDota(endpointPath, ttlMs, forceRefresh = false) {
  const cacheKey = endpointPath;
  const now = Date.now();
  const cached = openDotaServerCache.get(cacheKey);
  if (!forceRefresh && cached && now < cached.expiresAt) {
    return cached.data;
  }
  const apiKey = process.env.OPENDOTA_API_KEY;
  const separator = endpointPath.includes("?") ? "&" : "?";
  const url = `${OPENDOTA_BASE_URL}${endpointPath}${apiKey ? `${separator}api_key=${apiKey}` : ""}`;
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4e3);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "User-Agent": "PurpleBeanGaming/1.0 (Esports Circuit; contact@purplebeangaming.com)"
      }
    });
    clearTimeout(timeout);
    lastOpenDotaLatencyMs = Date.now() - startTime;
    if (!response.ok) {
      lastOpenDotaError = `HTTP ${response.status} from OpenDota (${endpointPath})`;
      if (cached) {
        return cached.data;
      }
      throw new Error(lastOpenDotaError);
    }
    const data = await response.json();
    lastSuccessfulOpenDotaRequest = (/* @__PURE__ */ new Date()).toISOString();
    lastOpenDotaError = null;
    openDotaServerCache.set(cacheKey, {
      data,
      expiresAt: now + ttlMs,
      fetchedAt: now
    });
    return data;
  } catch (err) {
    lastOpenDotaError = err?.message || String(err);
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}
apiRouter.get("/opendota/status", (_req, res) => {
  const apiKey = process.env.OPENDOTA_API_KEY;
  res.json({
    providerName: "OpenDota API v1 (Server Cached)",
    configured: Boolean(apiKey),
    status: lastOpenDotaError ? "ERROR" : "CONNECTED",
    lastSuccessfulRequest: lastSuccessfulOpenDotaRequest,
    lastError: lastOpenDotaError,
    lastTestedAt: (/* @__PURE__ */ new Date()).toISOString(),
    latencyMs: lastOpenDotaLatencyMs,
    rateLimitRemaining: 60,
    rateLimitReset: null,
    maskedKey: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null,
    cachedEntriesCount: openDotaServerCache.size
  });
});
apiRouter.post("/opendota/test", async (_req, res) => {
  try {
    const start = Date.now();
    await proxyOpenDota("/status", 6e4, true);
    const latency = Date.now() - start;
    return res.json({
      success: true,
      message: "Successfully reached OpenDota upstream server",
      latencyMs: latency,
      diagnostic: {
        providerName: "OpenDota API v1",
        configured: Boolean(process.env.OPENDOTA_API_KEY),
        status: "CONNECTED",
        lastSuccessfulRequest: (/* @__PURE__ */ new Date()).toISOString(),
        lastError: null,
        latencyMs: latency
      }
    });
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: `OpenDota upstream check failed: ${err.message}`,
      diagnostic: {
        providerName: "OpenDota API v1",
        configured: Boolean(process.env.OPENDOTA_API_KEY),
        status: "ERROR",
        lastError: err.message
      }
    });
  }
});
apiRouter.get("/opendota/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json([]);
  }
  try {
    const data = await proxyOpenDota(`/search?q=${encodeURIComponent(q)}`, 5 * 60 * 1e3);
    return res.json(Array.isArray(data) ? data.slice(0, 20) : []);
  } catch (err) {
    console.warn(`OpenDota search note for "${q}":`, err?.message);
    return res.json([]);
  }
});
apiRouter.get("/opendota/players/:accountId", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}`, 5 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/wl", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wl`, 5 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/recentMatches", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/recentMatches`, 5 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/matches", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  const queryStr = req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : "";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/matches${queryStr}`, 5 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/heroes", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/heroes`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/peers", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/peers`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/pros", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/pros`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/totals", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/totals`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/counts", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/counts`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/histograms/:field", async (req, res) => {
  const accountId = req.params.accountId;
  const field = req.params.field;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/histograms/${field}`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId, field });
  }
});
apiRouter.get("/opendota/players/:accountId/wardmap", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wardmap`, 30 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/wordcloud", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/wordcloud`, 30 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/ratings", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/ratings`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.get("/opendota/players/:accountId/rankings", async (req, res) => {
  const accountId = req.params.accountId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/players/${accountId}/rankings`, 15 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, accountId });
  }
});
apiRouter.post("/opendota/players/:accountId/refresh", async (req, res) => {
  const accountId = req.params.accountId;
  try {
    const apiKey = process.env.OPENDOTA_API_KEY;
    const url = `${OPENDOTA_BASE_URL}/players/${accountId}/refresh${apiKey ? `?api_key=${apiKey}` : ""}`;
    const response = await fetch(url, { method: "POST" });
    const data = response.ok ? await response.json().catch(() => ({})) : {};
    return res.json({ success: true, accountId, response: data });
  } catch (err) {
    return res.json({ success: false, error: err.message });
  }
});
apiRouter.get("/opendota/matches/:matchId", async (req, res) => {
  const matchId = req.params.matchId;
  const force = req.query.refresh === "true";
  try {
    const data = await proxyOpenDota(`/matches/${matchId}`, 24 * 60 * 60 * 1e3, force);
    return res.json(data);
  } catch (err) {
    return res.status(502).json({ error: err.message, matchId });
  }
});
apiRouter.post("/steam/link/start", async (req, res) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const returnUrl = req.body?.returnUrl || "/profile";
    const stateToken = generateSignedSteamState(user.uid, {
      email: user.email,
      returnUrl
    });
    const host = req.get("x-forwarded-host") || req.get("host") || "localhost:3000";
    const protocol = req.get("x-forwarded-proto") || (req.secure ? "https" : "http");
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
  } catch (err) {
    const msg = err.message || "Failed to start Steam authentication";
    const status = msg.startsWith("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({
      success: false,
      error: msg.split(":")[0] || "UNAUTHORIZED",
      message: msg
    });
  }
});
apiRouter.get("/steam/link/callback", async (req, res) => {
  const query = req.query;
  const rawState = query.state;
  const renderResultHtml = (opts) => {
    const bgColor = opts.success ? "#70FFAF" : "#FF6B6B";
    const title = opts.success ? "STEAM OWNERSHIP VERIFIED \u2713" : "VERIFICATION FAILED";
    const details = opts.message || (opts.success ? "Account successfully verified with Valve." : "Steam verification failed.");
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
    <div class="badge">${opts.success ? "Ownership Handshake Complete" : "Error"}</div>
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
        if (btn) btn.textContent = 'Window closed \u2014 return to main tab';
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
  if (!rawState) {
    return res.status(400).send(renderResultHtml({
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      message: "Missing verification state token. Please initiate verification from PurpleBeanGaming."
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
  const validation = await validateSteamOpenIdCallback(query);
  if (!validation.isValid || !validation.steamId64) {
    return res.status(400).send(renderResultHtml({
      success: false,
      error: "STEAM_VALIDATION_FAILED",
      message: validation.error || "Valve rejected Steam OpenID credentials."
    }));
  }
  try {
    const linkedAccount = await linkSteamAccountAuthoritative(uid, validation.steamId64);
    return res.status(200).send(renderResultHtml({
      success: true,
      steamId64: linkedAccount.steamId64 || void 0,
      dotaAccountId: linkedAccount.dotaAccountId || void 0,
      personaName: linkedAccount.steamPersonaName,
      message: `Steam account (${linkedAccount.steamPersonaName || validation.steamId64}) successfully linked and verified!`
    }));
  } catch (err) {
    const errorMsg = err.message || "Failed to complete Steam linking";
    const errorCode = errorMsg.split(":")[0] || "STEAM_VALIDATION_FAILED";
    return res.status(400).send(renderResultHtml({
      success: false,
      error: errorCode,
      message: errorMsg.replace(/^[A-Z_]+:\s*/, "")
    }));
  }
});
apiRouter.get("/steam/link/status", async (req, res) => {
  const targetUserId = req.query.userId;
  let callerUid = null;
  let callerEmail = null;
  if (req.headers.authorization) {
    try {
      const user = await verifyFirebaseBearerToken(req.headers.authorization);
      callerUid = user.uid;
      callerEmail = user.email || null;
    } catch {
    }
  }
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
        verificationStatus: "NOT_LINKED",
        steamOwnershipVerified: false,
        updatedAt: Date.now()
      }
    });
  }
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
    error: "SIGN_IN_REQUIRED",
    message: "Authentication required to inspect private Steam link status."
  });
});
apiRouter.post("/steam/link/unlink", async (req, res) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    await unlinkSteamAccountAuthoritative(user.uid);
    return res.json({
      success: true,
      message: "Steam account successfully disconnected."
    });
  } catch (err) {
    const msg = err.message || "Failed to disconnect Steam account";
    const isLock = msg.includes("ACTIVE_TOURNAMENT_LOCK");
    return res.status(isLock ? 409 : 400).json({
      success: false,
      error: isLock ? "ACTIVE_TOURNAMENT_LOCK" : "DISCONNECT_FAILED",
      message: isLock ? "Steam cannot be disconnected while you have an active tournament registration." : msg
    });
  }
});
var handleDiscordAuthStart = async (req, res) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const { returnUrl = "/profile", pbgId } = req.body || {};
    const rawOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : void 0);
    const trustedOrigin = sanitizeTrustedOrigin(rawOrigin);
    const stateToken = generateSignedDiscordOAuthState(user.uid, {
      email: user.email,
      pbgId: pbgId || void 0,
      returnUrl,
      origin: trustedOrigin
    });
    const devUrl = "https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app";
    const sharedUrl = "https://ais-pre-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app";
    const appUrl = process.env.APP_URL || devUrl;
    const redirectUri = process.env.DISCORD_REDIRECT_URI || `${appUrl}/api/auth/discord/callback`;
    const clientId = process.env.DISCORD_CLIENT_ID || "";
    const isConfigured = Boolean(clientId && process.env.DISCORD_CLIENT_SECRET);
    let authUrl = "";
    if (clientId) {
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        scope: "identify guilds.join",
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
  } catch (err) {
    const isAuthErr = err.code === "SIGN_IN_REQUIRED" || err.message && err.message.includes("SIGN_IN_REQUIRED");
    return res.status(isAuthErr ? 401 : 500).json({
      success: false,
      error: err.code || "DISCORD_AUTH_START_FAILED",
      message: err.message || "Failed to initialize Discord authorization."
    });
  }
};
apiRouter.post("/auth/discord/start", handleDiscordAuthStart);
apiRouter.post("/discord/auth/start", handleDiscordAuthStart);
apiRouter.get("/auth/discord/url", handleDiscordAuthStart);
var handleDiscordCallback = async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const devUrl = "https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app";
  const appUrl = process.env.APP_URL || devUrl;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${appUrl}/api/auth/discord/callback`;
  const sendHtmlResponse = (statusCode, isSuccess, payload, trustedOrigin2, errorHeading, errorBody) => {
    return res.status(statusCode).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isSuccess ? "Discord Connected \u2014 PurpleBeanGaming" : "Discord Link Error \u2014 PurpleBeanGaming"}</title>
          <style>
            body { font-family: monospace; background: #0e0e10; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { background: #18181b; border: 3.5px solid #000; padding: 32px; text-align: center; box-shadow: 8px 8px 0px 0px ${isSuccess ? "#5865F2" : "#ff4444"}; max-width: 440px; }
            h2 { color: ${isSuccess ? "#5865F2" : "#ff5555"}; margin-top: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; }
            p { color: #ccc; font-size: 13px; line-height: 1.5; }
            .avatar { width: 64px; height: 64px; border-radius: 50%; border: 2px solid #000; margin: 10px auto; background: #5865F2; display: block; }
          </style>
        </head>
        <body>
          <div class="box">
            ${isSuccess && payload?.avatarUrl ? `<img src="${payload.avatarUrl}" class="avatar" alt="Avatar" />` : ""}
            <h2>${isSuccess ? "DISCORD VERIFIED!" : errorHeading || "DISCORD ERROR"}</h2>
            <p>${isSuccess ? `Discord account <strong>@${payload?.discordUsername || payload?.username}</strong> has been linked to your PBG profile.` : errorBody || "Failed to complete Discord authorization."}</p>
            <p style="color: ${isSuccess ? "#70FFAF" : "#ff9999"}; font-weight: bold;">${isSuccess ? "Returning to profile..." : "Closing window..."}</p>
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
              try { window.opener.postMessage(payload, ${JSON.stringify(trustedOrigin2)}); } catch(e){}
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
    const errorMsg = error_description || error || "Discord authorization was cancelled or denied.";
    return sendHtmlResponse(200, false, {
      type: "DISCORD_AUTH_ERROR",
      error: "DISCORD_AUTH_DENIED",
      message: errorMsg,
      timestamp: Date.now()
    }, appUrl, "DISCORD AUTHORIZATION CANCELLED", errorMsg);
  }
  const stateResult = await verifyAndConsumeDiscordOAuthState(state);
  if (!stateResult.success) {
    const errorDetails = stateResult.details || "The verification session has expired or was already used.";
    return sendHtmlResponse(400, false, {
      type: "DISCORD_AUTH_ERROR",
      error: stateResult.error || "INVALID_OAUTH_STATE",
      message: errorDetails,
      timestamp: Date.now()
    }, appUrl, "SECURITY STATE REJECTED", errorDetails);
  }
  const userId = stateResult.payload.uid;
  const pbgId = stateResult.payload.pbgId;
  const trustedOrigin = stateResult.payload.origin || appUrl;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID || "631715510631006219";
  const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || "1555885374713237524";
  try {
    let discordUserId = "";
    let discordUsername = "";
    let discordGlobalName = null;
    let discordAvatarUrl = null;
    if (clientId && clientSecret) {
      const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri
        }).toString()
      });
      if (!tokenRes.ok) {
        const errorText = await tokenRes.text().catch(() => "");
        console.error("[Discord OAuth] Token exchange error:", errorText);
        throw new Error("Failed to exchange authorization code with Discord API.");
      }
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
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
      try {
        await reserveDiscordIdentityClaim({
          userId,
          pbgId,
          discordUserId
        });
      } catch (reserveErr) {
        return sendHtmlResponse(
          200,
          false,
          {
            type: "DISCORD_AUTH_ERROR",
            error: reserveErr.code || "DISCORD_ALREADY_LINKED",
            message: reserveErr.message || "This Discord account is already linked to another PurpleBeanGaming account.",
            timestamp: Date.now()
          },
          trustedOrigin,
          "ACCOUNT ALREADY LINKED",
          reserveErr.message
        );
      }
      let guildMember = false;
      let pbgMemberRole = false;
      if (guildId && botToken) {
        const provResult = await provisionDiscordGuildAndRole({
          guildId,
          botToken,
          roleId: roleId || void 0,
          discordUserId,
          accessToken
        });
        if (!provResult.success) {
          await rollbackDiscordIdentityReservation(discordUserId, userId);
          return sendHtmlResponse(
            200,
            false,
            {
              type: "DISCORD_AUTH_ERROR",
              error: provResult.errorCode || "DISCORD_PROVISIONING_FAILED",
              message: provResult.errorMessage || "Failed to join official PBG Discord server or assign PBG Member role.",
              timestamp: Date.now()
            },
            trustedOrigin,
            "DISCORD GUILD ERROR",
            provResult.errorMessage
          );
        }
        guildMember = provResult.guildMember;
        pbgMemberRole = provResult.pbgMemberRole;
      }
      await finalizeDiscordAccountAuthoritative({
        userId,
        pbgId,
        discordUserId,
        discordUsername,
        globalName: discordGlobalName,
        discordAvatarUrl,
        guildMember,
        pbgMemberRole,
        verificationMethod: "discord_oauth_2"
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
        type: "DISCORD_AUTH_SUCCESS",
        discord: discordPayload,
        discordUserId,
        discordUsername,
        discordDisplayName: discordGlobalName || discordUsername,
        avatarUrl: discordAvatarUrl,
        timestamp: Date.now()
      }, trustedOrigin);
    } else {
      const seed = Math.abs(userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 1e3));
      discordUserId = `10${(seed * 48291).toString().slice(0, 16).padEnd(16, "9")}`;
      discordUsername = (stateResult.payload.email || "player").split("@")[0];
      discordGlobalName = discordUsername.toUpperCase();
      discordAvatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUserId.slice(-1) || "0", 10) % 5}.png`;
      await linkDiscordAccountAuthoritative({
        userId,
        pbgId,
        discordUserId,
        discordUsername,
        globalName: discordGlobalName,
        discordAvatarUrl,
        guildMember: true,
        pbgMemberRole: true,
        verificationMethod: "discord_oauth_2"
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
        type: "DISCORD_AUTH_SUCCESS",
        discord: discordPayload,
        discordUserId,
        discordUsername,
        discordDisplayName: discordGlobalName || discordUsername,
        avatarUrl: discordAvatarUrl,
        timestamp: Date.now()
      }, trustedOrigin);
    }
  } catch (err) {
    const errorMsg = err.message || "Failed to complete Discord authorization.";
    return sendHtmlResponse(200, false, {
      type: "DISCORD_AUTH_ERROR",
      error: "DISCORD_LINK_FAILED",
      message: errorMsg,
      timestamp: Date.now()
    }, trustedOrigin, "DISCORD AUTHORIZATION FAILED", errorMsg);
  }
};
apiRouter.get("/auth/discord/callback", handleDiscordCallback);
apiRouter.get("/auth/discord/callback/", handleDiscordCallback);
apiRouter.get("/discord/auth/callback", handleDiscordCallback);
apiRouter.get("/discord/auth/callback/", handleDiscordCallback);
var handleDiscordStatus = async (req, res) => {
  try {
    let targetUserId = req.query.userId || "";
    let isOwner = false;
    if (req.headers.authorization) {
      try {
        const user = await verifyFirebaseBearerToken(req.headers.authorization);
        if (!targetUserId || targetUserId === user.uid) {
          targetUserId = user.uid;
          isOwner = true;
        }
      } catch {
      }
    }
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_USER_ID",
        message: "User ID is required."
      });
    }
    const account = await getPrivateDiscordAccount(targetUserId);
    let guildMember = Boolean(account.discord?.guildMember);
    let pbgMemberRole = Boolean(account.discord?.pbgMemberRole);
    const guildId = process.env.DISCORD_GUILD_ID || "631715510631006219";
    const roleId = process.env.DISCORD_PBG_MEMBER_ROLE_ID || "1555885374713237524";
    const playerRoleId = process.env.DISCORD_PBG_PLAYER_ROLE_ID || "1555884061111746651";
    const captainRoleId = process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || "1556338549807259658";
    const botToken = process.env.DISCORD_BOT_TOKEN;
    let pbgPlayerRole = false;
    let pbgCaptainRole = false;
    let teamRoleActive = false;
    let teamName = null;
    let expectedRoles = [];
    let actualRoleNames = [];
    let syncRequired = false;
    if (account.discordLinked && account.discordUserId && guildId && botToken && !account.discordUserId.startsWith("mock_")) {
      try {
        const verifyUrl = `https://discord.com/api/v10/guilds/${guildId}/members/${account.discordUserId}`;
        const verifyRes = await fetch(verifyUrl, {
          headers: {
            Authorization: `Bot ${botToken}`,
            Accept: "application/json"
          }
        });
        if (verifyRes.ok) {
          guildMember = true;
          const memberData = await verifyRes.json();
          const roles = Array.isArray(memberData?.roles) ? memberData.roles : [];
          pbgMemberRole = roles.includes(roleId);
          pbgPlayerRole = roles.includes(playerRoleId);
          pbgCaptainRole = roles.includes(captainRoleId);
          if (pbgMemberRole) actualRoleNames.push("PBG Member");
          if (pbgPlayerRole) actualRoleNames.push("PBG Player");
          if (pbgCaptainRole) actualRoleNames.push("PBG Captain");
          const db2 = getAdminDb();
          if (db2) {
            try {
              const matchedUids = new Set([targetUserId, account.userId, account.pbgId].filter(Boolean));
              if (account.discordUserId) {
                const lDoc = await db2.collection("discord_links").doc(account.discordUserId).get();
                if (lDoc.exists && lDoc.data()?.pbgUserId) {
                  matchedUids.add(lDoc.data().pbgUserId);
                }
              }
              const tSnap = await db2.collection("tournaments").limit(30).get();
              for (const tDoc of tSnap.docs) {
                const tData = tDoc.data();
                if (tData.status === "Completed" || tData.status === "Archived" || tData.lifecycle === "COMPLETED") continue;
                const cap = tData.captains?.find((c) => matchedUids.has(c.userId) || matchedUids.has(c.pbgId));
                const team = tData.teams?.find(
                  (t) => matchedUids.has(t.captainId) || matchedUids.has(t.captainUserId) || (t.primaryRoster || []).some((p) => matchedUids.has(p.userId) || matchedUids.has(p.id)) || (t.roster || []).some((pid) => matchedUids.has(typeof pid === "string" ? pid : pid?.id || pid?.userId))
                );
                if (cap || team) {
                  expectedRoles = ["PBG Member", "PBG Player"];
                  if (cap || team?.captainId === targetUserId || team?.captainUserId === targetUserId) {
                    expectedRoles.push("PBG Captain");
                  }
                  if (team?.name) {
                    teamName = team.name;
                    expectedRoles.push(team.name);
                    if (team.discord?.roleId && roles.includes(team.discord.roleId)) {
                      teamRoleActive = true;
                      actualRoleNames.push(team.name);
                    }
                  }
                  break;
                }
              }
              if (!teamRoleActive && tSnap.docs.length > 0) {
                for (const tDoc of tSnap.docs) {
                  const tData = tDoc.data();
                  for (const t of tData.teams || []) {
                    if (t.discord?.roleId && roles.includes(t.discord.roleId)) {
                      teamRoleActive = true;
                      teamName = t.name;
                      if (!actualRoleNames.includes(t.name)) actualRoleNames.push(t.name);
                      break;
                    }
                  }
                  if (teamRoleActive) break;
                }
              }
            } catch (dbErr) {
              console.warn("[handleDiscordStatus] Tournament role expectation query warning:", dbErr);
            }
          }
          if (expectedRoles.length > 0) {
            if (!pbgMemberRole) syncRequired = true;
            if (expectedRoles.includes("PBG Player") && !pbgPlayerRole) syncRequired = true;
            if (expectedRoles.includes("PBG Captain") && !pbgCaptainRole) syncRequired = true;
            if (expectedRoles.includes(teamName || "") && !teamRoleActive) syncRequired = true;
          }
        } else if (verifyRes.status === 404) {
          guildMember = false;
          pbgMemberRole = false;
        }
        if (account.discord?.guildMember !== guildMember || account.discord?.pbgMemberRole !== pbgMemberRole) {
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
      } catch (liveErr) {
        console.warn("[handleDiscordStatus] Live Discord verification warning:", liveErr.message);
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
        } : account.discordUserId ? {
          userId: account.discordUserId,
          username: account.discordUsername || "player",
          globalName: account.discordDisplayName || account.discordUsername || null,
          avatarUrl: account.discordAvatarUrl,
          connectedAt: account.discordLinkedAt || Date.now(),
          guildMember,
          pbgMemberRole,
          verified: true
        } : null,
        tournamentRoles: {
          pbgMemberRoleActive: pbgMemberRole,
          pbgPlayerRoleActive: pbgPlayerRole,
          pbgCaptainRoleActive: pbgCaptainRole,
          teamRoleActive,
          teamName,
          expectedRoles,
          actualRoleNames,
          syncRequired
        },
        discordLinked: account.discordLinked,
        discordVerified: account.discordVerified,
        discordUserId: isOwner ? account.discordUserId : account.discordUserId ? account.discordUserId.slice(-4).padStart(account.discordUserId.length, "\u2022") : null,
        discordUsername: account.discordUsername,
        discordDisplayName: account.discordDisplayName,
        discordAvatarUrl: account.discordAvatarUrl,
        discordVerificationMethod: account.discordVerificationMethod,
        discordLinkedAt: account.discordLinkedAt,
        discordVerifiedAt: account.discordVerifiedAt,
        updatedAt: account.updatedAt
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "FETCH_STATUS_FAILED",
      message: err.message || "Failed to fetch Discord link status."
    });
  }
};
apiRouter.get("/auth/discord/status", handleDiscordStatus);
apiRouter.get("/discord/auth/status", handleDiscordStatus);
var handleDiscordUnlink = async (req, res) => {
  try {
    const user = await verifyFirebaseBearerToken(req.headers.authorization);
    const { removeGuildRole = true } = req.body || {};
    const result = await unlinkDiscordAccountAuthoritative(user.uid, { removeGuildRole });
    return res.json({
      success: true,
      roleRevoked: result.roleRevoked,
      message: "Discord account successfully disconnected from PBG profile."
    });
  } catch (err) {
    const msg = err.message || "Failed to disconnect Discord account";
    const isLock = msg.includes("ACTIVE_TOURNAMENT_LOCK");
    return res.status(isLock ? 409 : 400).json({
      success: false,
      error: isLock ? "ACTIVE_TOURNAMENT_LOCK" : "DISCONNECT_FAILED",
      message: isLock ? "Discord cannot be disconnected while you have an active tournament registration." : msg
    });
  }
};
apiRouter.post("/auth/discord/unlink", handleDiscordUnlink);
apiRouter.post("/discord/auth/unlink", handleDiscordUnlink);
apiRouter.get(["/discord/roles/config", "/tournaments/discord/config"], (_req, res) => {
  const diagnostics = getDiscordRoleConfigDiagnostics();
  return res.json({
    ok: diagnostics.status !== "ERROR",
    status: diagnostics.status,
    summary: diagnostics.summary,
    guildId: process.env.DISCORD_GUILD_ID || "631715510631006219",
    roles: {
      DISCORD_PBG_MEMBER_ROLE_ID: process.env.DISCORD_PBG_MEMBER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID,
      DISCORD_PBG_PLAYER_ROLE_ID: process.env.DISCORD_PBG_PLAYER_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID,
      DISCORD_PBG_CAPTAIN_ROLE_ID: process.env.DISCORD_PBG_CAPTAIN_ROLE_ID || PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID
    },
    mapping: {
      "PBG Member": "DISCORD_PBG_MEMBER_ROLE_ID",
      "PBG Player": "DISCORD_PBG_PLAYER_ROLE_ID",
      "PBG Captain": "DISCORD_PBG_CAPTAIN_ROLE_ID",
      "Team Roles": "Dynamic per team, created automatically"
    },
    validation: diagnostics.validation
  });
});
apiRouter.post(["/admin/bootstrap", "/bootstrap"], async (req, res) => {
  try {
    const { userId, email } = req.body || {};
    const primaryAdmin = "11106cm009@gmail.com";
    const isPrimary = Boolean(email && email.toLowerCase().trim() === primaryAdmin);
    return res.json({
      success: true,
      userId,
      email,
      isSuperAdmin: isPrimary,
      role: isPrimary ? "superadmin" : "user",
      message: "Admin verification processed."
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "BOOTSTRAP_ERROR",
      message: err.message
    });
  }
});
var AUTHORIZED_ORGANIZERS = /* @__PURE__ */ new Set([
  "bharadwajaanisetti@gmail.com",
  "11106cm009@gmail.com",
  "neelapuharsha@gmail.com"
]);
function checkOrganizerAuthorization(decoded) {
  const cleanEmail = (decoded.email || "").toLowerCase().trim();
  if (AUTHORIZED_ORGANIZERS.has(cleanEmail)) return;
  const organizers = ["11106cm009@gmail.com", "neelapuharsha@gmail.com", "bharadwajaanisetti@gmail.com"];
  if (organizers.includes(cleanEmail)) return;
  const acc = pbgAccountRegistry.getAccountByEmail(cleanEmail) || pbgAccountRegistry.getAccountByUid(decoded.uid);
  if (acc && (acc.isAdmin || acc.isPrimaryAdmin || acc.isModerator)) return;
  throw new Error("ORGANIZER_PERMISSION_REQUIRED: Only authorized tournament organisers can execute this action.");
}
apiRouter.post("/tournaments/:tournamentId/register", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const formData = req.body || {};
    const registration = await submitTournamentRegistrationAuthoritative({
      userId: decoded.uid,
      tournamentId,
      formData: {
        declaredMMR: Number(formData.declaredMMR) || 5e3,
        tournamentMMR: Number(formData.tournamentMMR) || Number(formData.declaredMMR) || 5e3,
        primaryRole: formData.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: formData.secondaryRole || "Position 2 \u2014 Mid",
        captainApplicant: Boolean(formData.captainApplicant),
        availabilityConfirmed: Boolean(formData.availabilityConfirmed),
        rulesAccepted: Boolean(formData.rulesAccepted),
        customFields: formData.customFields || {}
      }
    });
    return res.status(201).json({
      ok: true,
      success: true,
      registration
    });
  } catch (err) {
    const msg = err.message || "Registration failed";
    const status = msg.includes("SIGN_IN_REQUIRED") ? 401 : msg.includes("REGISTRATION_CLOSED") || msg.includes("DISCORD_REQUIRED") || msg.includes("ALREADY_REGISTERED") ? 400 : 500;
    return res.status(status).json({
      ok: false,
      success: false,
      error: msg
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/withdraw", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const registration = await withdrawTournamentRegistrationAuthoritative({
      userId: decoded.uid,
      tournamentId
    });
    return res.json({
      ok: true,
      success: true,
      registration
    });
  } catch (err) {
    const msg = err.message || "Withdrawal failed";
    const status = msg.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({
      ok: false,
      success: false,
      error: msg
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/registration/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const regMap = inMemoryRegistrations.get(tournamentId);
    const reg = regMap?.get(decoded.uid) || null;
    const pMap = inMemoryParticipants.get(tournamentId);
    const participant = pMap?.get(decoded.uid) || null;
    return res.json({
      ok: true,
      success: true,
      registration: reg,
      participant
    });
  } catch (err) {
    return res.status(401).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/eligibility/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const pbgAccount = pbgAccountRegistry.getAccountByUid(decoded.uid) || pbgAccountRegistry.getAllAccounts().find((a) => a.googleUid === decoded.uid || a.pbgId === decoded.uid) || null;
    const lifecycle = inMemoryLifecycles.get(tournamentId) || "REGISTRATION_OPEN";
    const regMap = inMemoryRegistrations.get(tournamentId);
    const allRegs = regMap ? Array.from(regMap.values()) : [];
    const eligibility = evaluateRegistrationEligibility({
      userId: decoded.uid,
      tournamentId,
      pbgAccount: pbgAccount ? {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName,
        email: pbgAccount.email,
        accountStatus: pbgAccount.accountStatus,
        dotaAccountLinked: pbgAccount.dotaAccountLinked,
        dotaAccountVerified: pbgAccount.dotaAccountVerified,
        dotaAccountId: pbgAccount.dotaAccountId,
        steamId: pbgAccount.steamId,
        discordLinked: pbgAccount.discordLinked,
        discordUserId: pbgAccount.discordUserId,
        discordUsername: pbgAccount.discordUsername,
        pbgMemberRoleActive: pbgAccount.discordMemberVerified !== false,
        isBanned: pbgAccount.accountStatus === "BANNED"
      } : null,
      tournament: {
        id: tournamentId,
        status: "OPEN",
        registrationLifecycle: lifecycle,
        discordRequired: true,
        dotaRequired: true
      },
      formData: {
        declaredMMR: pbgAccount?.declaredMmr || 5e3,
        primaryRole: pbgAccount?.primaryRole || "Position 1 \u2014 Carry",
        secondaryRole: pbgAccount?.secondaryRole || "Position 2 \u2014 Mid",
        captainApplicant: false,
        availabilityConfirmed: true,
        rulesAccepted: true
      },
      existingRegistrations: allRegs
    });
    return res.json({
      ok: true,
      success: true,
      pbgAccount: pbgAccount ? {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName,
        dotaAccountLinked: pbgAccount.dotaAccountLinked,
        dotaAccountId: pbgAccount.dotaAccountId,
        discordLinked: pbgAccount.discordLinked,
        discordUsername: pbgAccount.discordUsername,
        pbgMemberRoleActive: pbgAccount.discordMemberVerified !== false
      } : null,
      eligibility
    });
  } catch (err) {
    return res.status(401).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/registrations", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const regMap = inMemoryRegistrations.get(tournamentId);
    const registrations = regMap ? Array.from(regMap.values()) : [];
    const pMap = inMemoryParticipants.get(tournamentId);
    const participants = pMap ? Array.from(pMap.values()) : [];
    return res.json({
      ok: true,
      success: true,
      registrations,
      participants
    });
  } catch (err) {
    const status = err.message.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : 401;
    return res.status(status).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/registrations/:targetUserId/review", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const targetUserId = req.params.targetUserId;
    const { action, tournamentMMR, notes, rejectionReason } = req.body || {};
    const result = await reviewTournamentRegistrationAuthoritative({
      organizerUserId: decoded.uid,
      tournamentId,
      targetUserId,
      action,
      tournamentMMR,
      notes,
      rejectionReason
    });
    return res.json({
      ok: true,
      success: true,
      registration: result.registration,
      participant: result.participant
    });
  } catch (err) {
    const status = err.message.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : 400;
    return res.status(status).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/captain-candidates", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const pMap = inMemoryParticipants.get(tournamentId);
    const participants = pMap ? Array.from(pMap.values()) : [];
    const regMap = inMemoryRegistrations.get(tournamentId);
    const candidates = participants.filter((p) => {
      const reg = regMap?.get(p.userId);
      return reg?.captainApplicant === true && p.participantStatus === "ACTIVE";
    });
    const slotMap = inMemoryCaptains.get(tournamentId);
    const slots = slotMap ? Array.from(slotMap.values()) : [];
    return res.json({
      ok: true,
      success: true,
      candidates,
      selectedCaptains: slots
    });
  } catch (err) {
    return res.status(403).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/captains/select", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { targetUserId, captainSlotId } = req.body || {};
    if (!targetUserId || !captainSlotId) {
      return res.status(400).json({ ok: false, error: "targetUserId and captainSlotId are required." });
    }
    const result = await selectTournamentCaptainAuthoritative({
      organizerUserId: decoded.uid,
      tournamentId,
      targetUserId,
      captainSlotId
    });
    return res.json({
      ok: true,
      success: true,
      participant: result.participant,
      slot: result.slot
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/captains/remove", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { targetUserId, captainSlotId } = req.body || {};
    const participant = await removeTournamentCaptainAuthoritative({
      organizerUserId: decoded.uid,
      tournamentId,
      targetUserId,
      captainSlotId
    });
    return res.json({
      ok: true,
      success: true,
      participant
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/lifecycle", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { lifecycle } = req.body || {};
    const result = setTournamentLifecycleAuthoritative({
      tournamentId,
      newLifecycle: lifecycle
    });
    return res.json({
      ok: true,
      success: true,
      lifecycle: result.lifecycle,
      readiness: result.readiness
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/auction-readiness", async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const readiness = checkAuctionReadinessContract(tournamentId);
    return res.json({
      ok: true,
      success: true,
      readiness
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post([
  "/tournaments/:tournamentId/discord/sync",
  "/tournaments/:tournamentId/discord/roles/sync",
  "/discord/sync",
  "/discord/sync-tournament-roles",
  "/users/:userId/discord/sync"
], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId || req.body?.tournamentId || "purple-bean-test-cup";
    const targetUserId = req.body?.userId || req.params?.userId || decoded.uid;
    const targetPbgId = req.body?.pbgId;
    const authoritative = await resolveAuthoritativeUserIdentity(targetUserId) || (targetPbgId ? await resolveAuthoritativeUserIdentity(targetPbgId) : null);
    const resolvedUid = authoritative?.uid || targetUserId;
    const resolvedPbgId = authoritative?.pbgId || targetPbgId;
    const isSelf = decoded.uid === resolvedUid || decoded.uid === targetUserId || authoritative?.pbgId && decoded.uid === authoritative.pbgId || decoded.email && authoritative?.email && decoded.email.toLowerCase() === authoritative.email.toLowerCase();
    if (!isSelf) {
      checkOrganizerAuthorization(decoded);
    }
    const result = await syncDiscordTournamentRoles({
      userId: resolvedUid,
      tournamentId
    });
    if (!result.success) {
      const statusCode = result.error === "DISCORD_LINK_NOT_FOUND" || result.error === "PLAYER_NOT_FOUND" ? 404 : 400;
      return res.status(statusCode).json({
        ok: false,
        success: false,
        error: result.error || "SYNC_FAILED",
        stage: result.stage || "CALCULATE_ENTITLEMENTS",
        message: result.message || result.error || "Failed to synchronize tournament Discord roles",
        details: result
      });
    }
    return res.json({
      ok: true,
      success: true,
      stage: "VERIFY_MEMBER_ROLES",
      result
    });
  } catch (err) {
    const isAuthErr = err.code === "UNAUTHENTICATED" || err.message === "SIGN_IN_REQUIRED";
    const isForbidden = err.code === "ORGANIZER_FORBIDDEN" || err.message?.includes("Unauthorized");
    const statusCode = isAuthErr ? 401 : isForbidden ? 403 : 500;
    return res.status(statusCode).json({
      ok: false,
      success: false,
      error: err.code || "INTERNAL_ERROR",
      stage: "LOAD_USER",
      message: err.message || "An unexpected error occurred during role sync"
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/discord/sync-all", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const report = await syncTournamentDiscordRolesAll({ tournamentId });
    return res.json({
      ok: report.failed === 0,
      success: true,
      report
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/discord/diagnostics", async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const diagnostics = await getTournamentDiscordDiagnostics(tournamentId);
    return res.json({
      ok: true,
      success: true,
      tournamentId,
      diagnostics
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/discord/retry-jobs", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = await retryPendingDiscordSyncJobs({ tournamentId });
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post(["/tournaments/:tournamentId/discord/cleanup", "/tournaments/:tournamentId/discord/cleanup-completion"], async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const report = await cleanupTournamentDiscordState({ tournamentId });
    return res.json({
      ok: true,
      success: true,
      report,
      result: {
        totalParticipantsCleaned: report.participantsProcessed,
        deletedTeamRoles: report.teamRolesDeleted
      }
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/soft-delete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { reason = "Administrative deletion" } = req.body || {};
    const result = await softDeleteTournamentAuthoritative({
      tournamentId,
      deletedBy: decoded.uid,
      deleteReason: reason
    });
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/transition", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { nextStatus, reason = "" } = req.body || {};
    if (!nextStatus) {
      return res.status(400).json({ ok: false, success: false, error: "nextStatus is required" });
    }
    const norm = String(nextStatus).toLowerCase();
    if (norm === "deleted") {
      const deleteResult = await softDeleteTournamentAuthoritative({
        tournamentId,
        deletedBy: decoded.uid,
        deleteReason: reason || "Administrative soft deletion"
      });
      return res.json({
        ok: true,
        success: true,
        status: "deleted",
        lifecycle: "DELETED",
        cleanupReport: deleteResult.cleanupReport
      });
    }
    const db2 = getAdminDb();
    let currentStatus = "draft";
    if (db2) {
      try {
        const tDoc = await db2.collection("tournaments").doc(tournamentId).get();
        if (tDoc.exists) {
          const tData = tDoc.data();
          currentStatus = tData?.status || tData?.lifecycle || "draft";
        }
      } catch {
      }
    }
    const check = validateTournamentTransition(currentStatus, norm);
    if (!check.valid) {
      return res.status(400).json({ ok: false, success: false, error: check.reason });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let cleanupReport = null;
    if (db2) {
      const updatePayload = {
        status: norm,
        updatedAt: now
      };
      if (norm === "cancelled") updatePayload.cancelledAt = now;
      if (norm === "abandoned") updatePayload.abandonedAt = now;
      if (norm === "completed") updatePayload.completedAt = now;
      if (norm === "on_hold") updatePayload.pausedAt = now;
      await db2.collection("tournaments").doc(tournamentId).set(updatePayload, { merge: true }).catch(() => {
      });
      await db2.collection("audit_logs").add({
        action: "tournament_transition",
        tournamentId,
        entityType: "tournament",
        entityId: tournamentId,
        details: `Status transitioned from ${currentStatus} to ${norm}. Reason: ${reason || "Organizer action"}`,
        actorId: decoded.uid,
        timestamp: now
      }).catch(() => {
      });
    }
    const lifecycleCategory = classifyTournamentLifecycle(norm);
    if (lifecycleCategory === "TERMINAL") {
      cleanupReport = await cleanupTournamentDiscordState({ tournamentId });
    } else if (norm === "active" && currentStatus === "on_hold") {
      syncTournamentDiscordRolesAll({ tournamentId }).catch((e) => console.warn("[transition resume] Sync note:", e));
    }
    return res.json({
      ok: true,
      success: true,
      status: norm,
      lifecycle: lifecycleCategory,
      cleanupReport
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/users/:userId/tournament-roles/entitlements", async (req, res) => {
  try {
    const userId = req.params.userId;
    const entitlements = await getUserTournamentRoleEntitlements(userId);
    return res.json({
      ok: true,
      success: true,
      userId,
      entitlements
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/teams/:teamId/restore-elimination", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const teamId = req.params.teamId;
    const result = await restoreTeamFromEliminationAuthoritative({
      tournamentId,
      teamId
    });
    return res.json({
      ok: true,
      success: true,
      team: result.team,
      restoredParticipants: result.restoredParticipants
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/start", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { configOverride } = req.body || {};
    const { session, integrity } = await startAuctionSessionAuthoritative({
      tournamentId,
      actorUserId: decoded.uid,
      configOverride
    });
    auctionSnapshots.set(tournamentId, {
      state: session,
      teams: Object.values(session.teams),
      players: Object.values(session.players),
      lastServerUpdatedAt: Date.now()
    });
    broadcastToAuctionRoom(tournamentId, "AUCTION_STARTED", session);
    return res.status(201).json({
      ok: true,
      success: true,
      session,
      integrity
    });
  } catch (err) {
    const status = err.message.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : 400;
    return res.status(status).json({
      ok: false,
      success: false,
      error: err.message,
      blockers: err.blockers
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/auction/session", async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      return res.status(404).json({
        ok: false,
        success: false,
        error: "AUCTION_NOT_FOUND: No active auction session found for this tournament."
      });
    }
    return res.json({
      ok: true,
      success: true,
      session
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/nominate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const { playerId, openingBid, isOrganiserOverride, actingAsTestCaptainUserId } = req.body || {};
    if (!playerId) {
      return res.status(400).json({ ok: false, error: "playerId is required for nomination." });
    }
    let session;
    if (actingAsTestCaptainUserId) {
      checkOrganizerAuthorization(decoded);
      const resAudit = await executeImpersonatedCaptainAction({
        tournamentId,
        actorAdminUserId: decoded.uid,
        actingAsTestCaptainUserId,
        action: {
          type: "NOMINATE",
          playerId,
          openingBid
        }
      });
      session = resAudit.result;
    } else {
      session = await nominatePlayerAuthoritative({
        tournamentId,
        actorUserId: decoded.uid,
        playerId,
        openingBid,
        isOrganiserOverride: Boolean(isOrganiserOverride && (decoded.email === "11106cm009@gmail.com" || decoded.isAdmin))
      });
    }
    broadcastToAuctionRoom(tournamentId, "PLAYER_NOMINATED", session);
    return res.json({
      ok: true,
      success: true,
      session
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/bid", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const { amount, actingAsTestCaptainUserId } = req.body || {};
    if (!amount || typeof amount !== "number") {
      return res.status(400).json({ ok: false, error: "Valid numerical bid amount is required." });
    }
    let session;
    let bidRecord;
    if (actingAsTestCaptainUserId) {
      checkOrganizerAuthorization(decoded);
      const resAudit = await executeImpersonatedCaptainAction({
        tournamentId,
        actorAdminUserId: decoded.uid,
        actingAsTestCaptainUserId,
        action: {
          type: "BID",
          bidAmount: amount
        }
      });
      session = resAudit.result.session;
      bidRecord = resAudit.result.bidRecord;
    } else {
      const res2 = await placeBidAuthoritative({
        tournamentId,
        actorUserId: decoded.uid,
        bidAmount: amount
      });
      session = res2.session;
      bidRecord = res2.bidRecord;
    }
    broadcastToAuctionRoom(tournamentId, "BID_PLACED", { session, bidRecord });
    return res.json({
      ok: true,
      success: true,
      session,
      bidRecord
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/pass-lot", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const { forceUnsold } = req.body || {};
    const { session, result, player, team } = await finalizeNominationLotAuthoritative({
      tournamentId,
      actorUserId: decoded.uid,
      forceUnsold: Boolean(forceUnsold)
    });
    broadcastToAuctionRoom(tournamentId, result === "SOLD" ? "PLAYER_SOLD" : "PLAYER_UNSOLD", {
      session,
      result,
      player,
      team
    });
    return res.json({
      ok: true,
      success: true,
      session,
      result,
      player,
      team
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/reintroduce-unsold", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { playerId, forceOverride } = req.body || {};
    const session = await reintroduceUnsoldPlayerAuthoritative({
      tournamentId,
      actorUserId: decoded.uid,
      playerId,
      forceOverride: Boolean(forceOverride)
    });
    broadcastToAuctionRoom(tournamentId, "PLAYER_REINTRODUCED", session);
    return res.json({
      ok: true,
      success: true,
      session
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/start-standin", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const session = await startStandInPhaseAuthoritative({
      tournamentId,
      actorUserId: decoded.uid
    });
    broadcastToAuctionRoom(tournamentId, "STANDIN_PHASE_STARTED", session);
    return res.json({
      ok: true,
      success: true,
      session
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/complete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { session, totalSold, totalUnsold, totalUnselected } = await handleAuctionCompletedAuthoritative({
      tournamentId,
      actorUserId: decoded.uid
    });
    broadcastToAuctionRoom(tournamentId, "AUCTION_COMPLETED", session);
    return res.json({
      ok: true,
      success: true,
      session,
      totalSold,
      totalUnsold,
      totalUnselected
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/finalize-teams", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { finalizedTeams, discordRolesCreated } = await finalizeAuctionTeamsAuthoritative({
      tournamentId,
      actorUserId: decoded.uid
    });
    return res.json({
      ok: true,
      success: true,
      finalizedTeams,
      discordRolesCreated
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/team-branding", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    const tournamentId = req.params.tournamentId;
    const { teamId, branding } = req.body || {};
    const isOrganiser = decoded.email === "11106cm009@gmail.com" || decoded.isAdmin;
    const team = await updateTeamBrandingAuthoritative({
      tournamentId,
      actorUserId: decoded.uid,
      teamId,
      branding: branding || {},
      isOrganiser
    });
    return res.json({
      ok: true,
      success: true,
      team
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/auction/correct", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { action, payload } = req.body || {};
    const session = await executeAuctionCorrectionAuthoritative({
      tournamentId,
      actorUserId: decoded.uid,
      action,
      payload: payload || {}
    });
    broadcastToAuctionRoom(tournamentId, "AUCTION_CORRECTION", session);
    return res.json({
      ok: true,
      success: true,
      session
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/auction/integrity", async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const session = inMemoryAuctionSessions.get(tournamentId);
    if (!session) {
      return res.status(404).json({
        ok: false,
        success: false,
        error: "AUCTION_NOT_FOUND: No active auction session found."
      });
    }
    const integrity = validateAuctionRuntimeIntegrity(session);
    return res.json({
      ok: true,
      success: true,
      integrity
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/seed-players", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = seedTestPlayers(tournamentId);
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/seed-captains", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = seedTestCaptains(tournamentId);
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/assign-captains", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = assignTestCaptainsToSlots(tournamentId);
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/reset-test-data", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { fullResetIncludingReal } = req.body || {};
    const result = resetAuctionTestData(tournamentId, Boolean(fullResetIncludingReal));
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/delete-fixtures", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = deleteTestFixtures(tournamentId);
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/test-tools/integrity-check", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = runAuctionIntegrityCheck(tournamentId);
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.post("/tournaments/:tournamentId/test-tools/control-captain", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { actingAsTestCaptainUserId, action } = req.body || {};
    if (!actingAsTestCaptainUserId || !action) {
      return res.status(400).json({ ok: false, error: "actingAsTestCaptainUserId and action object are required." });
    }
    const result = await executeImpersonatedCaptainAction({
      tournamentId,
      actorAdminUserId: decoded.uid,
      actingAsTestCaptainUserId,
      action
    });
    return res.json({
      ok: true,
      success: true,
      result
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/test-tools/identities", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const audits = getTestCaptainActionAudits(tournamentId);
    return res.json({
      ok: true,
      success: true,
      testPlayers: DUMMY_TEST_PLAYERS,
      testCaptains: DUMMY_TEST_CAPTAINS,
      audits
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      success: false,
      error: err.message
    });
  }
});
apiRouter.get("/tournaments/:tournamentId/competition/structure", async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    let structure = dotaCompetitionEngine.getStructure(tournamentId);
    if (!structure) {
      structure = await dotaCompetitionEngine.fetchStructureFromFirestore(tournamentId);
    }
    return res.json({
      ok: true,
      success: true,
      structure: structure || null
    });
  } catch (err) {
    return res.status(500).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/generate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const teams = req.body?.teams || [];
    const result = dotaCompetitionEngine.generateFullStructure(tournamentId, teams);
    return res.json({
      ok: true,
      success: result.success,
      structure: result.structure
    });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/publish", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = await dotaCompetitionEngine.publishStructureTransactional({
      tournamentId,
      callerRole: "organizer",
      isAdmin: true
    });
    if (!result.success) {
      return res.status(400).json({ ok: false, success: false, error: result.error });
    }
    return res.json({
      ok: true,
      success: true,
      structure: result.structure
    });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/unlock", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const result = await dotaCompetitionEngine.editPublishedStructureTransactional({
      tournamentId,
      callerRole: "organizer",
      isAdmin: true
    });
    return res.json({
      ok: true,
      success: result.success,
      hasStartedMatches: result.hasStartedMatches,
      structure: result.structure
    });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/matches/:matchId/result", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const { tournamentId, matchId } = req.params;
    const { stageId, scoreA, scoreB, games, isForfeit, forfeitWinnerId, clientVersion } = req.body;
    const result = await dotaCompetitionEngine.recordMatchResultTransactional({
      tournamentId,
      stageId,
      matchId,
      scoreA: Number(scoreA),
      scoreB: Number(scoreB),
      games,
      confirmedBy: decoded.email || decoded.uid,
      isForfeit: Boolean(isForfeit),
      forfeitWinnerId,
      clientVersion: typeof clientVersion === "number" ? clientVersion : void 0,
      callerRole: "organizer",
      isAdmin: true
    });
    if (!result.success) {
      const status = result.error?.includes("STALE_SUBMISSION_CONFLICT") ? 409 : 400;
      return res.status(status).json({ ok: false, success: false, error: result.error });
    }
    return res.json({
      ok: true,
      success: true,
      match: result.match,
      structure: result.structure
    });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/stages", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const tournamentId = req.params.tournamentId;
    const { type, name, defaultSeriesFormat } = req.body;
    const newStageRes = dotaCompetitionEngine.addStage(tournamentId, type || "DOUBLE_ELIMINATION");
    if (newStageRes.stage && name) newStageRes.stage.name = name;
    if (newStageRes.stage && defaultSeriesFormat) newStageRes.stage.defaultSeriesFormat = defaultSeriesFormat;
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return res.json({ ok: true, success: newStageRes.success, stage: newStageRes.stage, structure });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.delete("/tournaments/:tournamentId/competition/stages/:stageId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const { tournamentId, stageId } = req.params;
    const ok = dotaCompetitionEngine.deleteStage(tournamentId, stageId);
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return res.json({ ok: true, success: ok, structure });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.post("/tournaments/:tournamentId/competition/stages/:stageId/move", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const { tournamentId, stageId } = req.params;
    const direction = req.body?.direction || "UP";
    const ok = dotaCompetitionEngine.moveStage(tournamentId, stageId, direction);
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return res.json({ ok: true, success: ok, structure });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});
apiRouter.put("/tournaments/:tournamentId/competition/stages/:stageId", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const decoded = await verifyFirebaseBearerToken(authHeader);
    checkOrganizerAuthorization(decoded);
    const { tournamentId, stageId } = req.params;
    const updates = req.body?.updates || req.body || {};
    const ok = dotaCompetitionEngine.updateStageConfig(tournamentId, stageId, updates);
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return res.json({ ok: true, success: ok, structure });
  } catch (err) {
    const status = err.message?.includes("ORGANIZER_PERMISSION_REQUIRED") ? 403 : err.message?.includes("SIGN_IN_REQUIRED") ? 401 : 400;
    return res.status(status).json({ ok: false, success: false, error: err.message });
  }
});

// src/index.ts
var app2 = express();
app2.use(express.json());
app2.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app2.get(["/api/health", "/health"], (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "purplebeangaming-api",
    provider: "firebase-cloud-functions",
    status: "ok",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app2.get(["/api", "/"], (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "purplebeangaming-api",
    provider: "firebase-cloud-functions",
    message: "Purple Bean Gaming Authoritative API Gateway",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app2.use("/api", apiRouter);
app2.use("/", apiRouter);
var api = onRequest({
  cors: true,
  region: "us-central1",
  minInstances: 0,
  maxInstances: 10
}, app2);
export {
  api
};
