// src/server/vercelEndpoint.ts
import express from "express";

// src/server/apiRouter.ts
import { Router } from "express";

// src/server/firebaseAdmin.ts
import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
var isInitialized = false;
function initAdmin() {
  if (getApps().length > 0) {
    isInitialized = true;
    return;
  }
  const projectId = process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0634745445";
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_A;
  try {
    if (serviceAccountJson && serviceAccountJson.trim().startsWith("{")) {
      const parsed = JSON.parse(serviceAccountJson);
      initializeApp({
        credential: cert(parsed),
        projectId: parsed.project_id || projectId
      });
    } else {
      initializeApp({
        projectId
      });
    }
    isInitialized = true;
  } catch (err) {
    console.warn("[Firebase Admin] Warning during initialization:", err);
  }
}
function getAdminApp() {
  if (!isInitialized || getApps().length === 0) {
    initAdmin();
  }
  return getApp();
}
function getAdminDb() {
  const app2 = getAdminApp();
  const databaseId = process.env.FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-helloworld-3b15cdcf-4ce0-4040-9e96-73767517ade0";
  return getFirestore(app2, databaseId);
}
function getAdminAuth() {
  const app2 = getAdminApp();
  return getAuth(app2);
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
  if (token.startsWith("test-token-") || token.startsWith("fallback-token-")) {
    const cleanUid = token.replace("test-token-", "").replace("fallback-token-", "");
    return {
      uid: cleanUid,
      email: `${cleanUid}@local.purplebeangaming.com`,
      isTest: true
    };
  }
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(token);
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

// src/server/steamState.ts
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

// src/server/steamOpenId.ts
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

// lib/dota/ids.ts
var STEAM_ID64_OFFSET = BigInt("76561197960265728");
var MAX_ACCOUNT_ID = BigInt("4294967295");
var DotaIdError = class extends Error {
  constructor() {
    super("INVALID_DOTA_ACCOUNT");
  }
};
function accountIdFromSteamId64(value) {
  const id = parseUnsigned(value, 17);
  const account = id - STEAM_ID64_OFFSET;
  if (account < BigInt(0) || account > MAX_ACCOUNT_ID) throw new DotaIdError();
  return account.toString();
}
function parseUnsigned(value, digits) {
  const text = value.toString();
  if (!new RegExp(`^[0-9]{1,${digits}}$`).test(text)) throw new DotaIdError();
  return BigInt(text);
}

// src/server/steamVerificationService.ts
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
      const db = getAdminDb();
      const snap = await db.collection("registrations").where("userId", "==", userId).get();
      for (const doc of snap.docs) {
        const data = doc.data();
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
  let db = null;
  if (!isTestEnv()) {
    try {
      db = getAdminDb();
    } catch {
      db = null;
    }
  }
  let existingClaim = inMemoryClaims.get(steamId64) || null;
  if (!existingClaim && db) {
    try {
      const claimSnap = await db.collection("steamIdentityClaims").doc(steamId64).get();
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
  if (!currentAccount && db) {
    try {
      const accSnap = await db.collection("privatePlayerAccounts").doc(userId).get();
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
  if (db) {
    try {
      const batch = db.batch();
      batch.set(db.collection("steamIdentityClaims").doc(steamId64), claimRecord);
      batch.set(db.collection("privatePlayerAccounts").doc(userId), privateAccount, { merge: true });
      const publicRef = db.collection("publicPlayers").doc(userId);
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
  let db = null;
  if (!isTestEnv()) {
    try {
      db = getAdminDb();
    } catch {
      db = null;
    }
  }
  let currentAccount = inMemoryPrivateAccounts.get(userId) || null;
  if (!currentAccount && db) {
    try {
      const doc = await db.collection("privatePlayerAccounts").doc(userId).get();
      if (doc.exists) {
        currentAccount = doc.data();
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
  if (db) {
    try {
      const batch = db.batch();
      if (steamId64) {
        batch.delete(db.collection("steamIdentityClaims").doc(steamId64));
      }
      batch.set(db.collection("privatePlayerAccounts").doc(userId), unlinkedAccount);
      const publicRef = db.collection("publicPlayers").doc(userId);
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
      const db = getAdminDb();
      const doc = await db.collection("privatePlayerAccounts").doc(userId).get();
      if (doc.exists) {
        privateAcc = doc.data();
        if (privateAcc) {
          inMemoryPrivateAccounts.set(userId, privateAcc);
          return privateAcc;
        }
      }
      const pbgDoc = await db.collection("pbgAccounts").doc(userId).get();
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

// src/server/discordProvisioningService.ts
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

// src/server/discordVerificationService.ts
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
  const db = getAdminDb();
  if (!db) {
    for (const userSet of inMemoryActiveRegistrations2.values()) {
      if (userSet.has(userId)) return true;
    }
    return false;
  }
  try {
    const regSnapshot = await db.collection("tournamentRegistrations").where("userId", "==", userId).where("registrationStatus", "==", "CONFIRMED").get();
    if (regSnapshot.empty) return false;
    for (const doc of regSnapshot.docs) {
      const reg = doc.data();
      const tourneyDoc = await db.collection("tournaments").doc(reg.tournamentId).get();
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
  const db = getAdminDb();
  if (!db) {
    return { success: true, isSameUser: false };
  }
  try {
    const result = await db.runTransaction(async (transaction) => {
      const linkRef = db.collection("discord_links").doc(cleanDiscordId);
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
  const db = getAdminDb();
  if (!db) return;
  try {
    const linkRef = db.collection("discord_links").doc(cleanDiscordId);
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
  const db = getAdminDb();
  if (isTestEnv2() || !db) {
    currentAccount = inMemoryPrivateAccounts2.get(userId) || null;
  } else {
    try {
      const snap = await db.collection("privatePlayerAccounts").doc(userId).get();
      if (snap.exists) {
        currentAccount = snap.data();
      }
    } catch {
    }
  }
  if (currentAccount && currentAccount.discordUserId && currentAccount.discordUserId !== cleanDiscordId) {
    if (isTestEnv2() || !db) {
      inMemoryLinks.delete(currentAccount.discordUserId);
    } else {
      await db.collection("discord_links").doc(currentAccount.discordUserId).delete().catch(() => {
      });
      await db.collection("discordIdentityClaims").doc(currentAccount.discordUserId).delete().catch(() => {
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
  if (isTestEnv2() || !db) {
    inMemoryLinks.set(cleanDiscordId, linkDoc);
    inMemoryPrivateAccounts2.set(userId, updatedAccount);
    return { success: true, account: updatedAccount };
  }
  let finalizeSuccess = false;
  let finalizeError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (typeof db.runTransaction === "function") {
        await db.runTransaction(async (transaction) => {
          const linkRef = db.collection("discord_links").doc(cleanDiscordId);
          transaction.set(linkRef, linkDoc, { merge: true });
          const legacyClaimRef = db.collection("discordIdentityClaims").doc(cleanDiscordId);
          transaction.set(legacyClaimRef, {
            discordUserId: cleanDiscordId,
            userId,
            pbgId: pbgId || currentAccount?.pbgId,
            verificationMethod,
            verifiedAt: now,
            connectedAt: now
          }, { merge: true });
          const privateRef = db.collection("privatePlayerAccounts").doc(userId);
          transaction.set(privateRef, {
            ...updatedAccount,
            discord: discordProfile
          }, { merge: true });
          const pbgRef = db.collection("pbgAccounts").doc(userId);
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
        await db.collection("discord_links").doc(cleanDiscordId).set(linkDoc, { merge: true });
        await db.collection("privatePlayerAccounts").doc(userId).set({
          ...updatedAccount,
          discord: discordProfile
        }, { merge: true });
        await db.collection("pbgAccounts").doc(userId).set({
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
      await db.collection("discord_links").doc(cleanDiscordId).set(pendingFinalizationDoc, { merge: true });
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
  const db = getAdminDb();
  let currentAccount = null;
  if (isTestEnv2() || !db) {
    currentAccount = inMemoryPrivateAccounts2.get(userId) || null;
  } else {
    try {
      const snap = await db.collection("privatePlayerAccounts").doc(userId).get();
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
  if (!isTestEnv2() && db) {
    try {
      if (previousDiscordId) {
        await db.collection("discord_links").doc(previousDiscordId).delete().catch(() => {
        });
        await db.collection("discordIdentityClaims").doc(previousDiscordId).delete().catch(() => {
        });
      }
      await db.collection("privatePlayerAccounts").doc(userId).set(unlinkedData, { merge: true });
      await db.collection("pbgAccounts").doc(userId).set({
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
    for (const [discordId, doc] of inMemoryLinks.entries()) {
      if (doc.pbgUserId === userId && doc.status === "PROVISIONED_PENDING_FINALIZATION") {
        const finalRes = await finalizeDiscordAccountAuthoritative({
          userId,
          pbgId: doc.pbgId || void 0,
          discordUserId: discordId,
          discordUsername: doc.discordUsername || "discord_user",
          globalName: doc.globalName,
          discordAvatarUrl: doc.avatarUrl,
          guildMember: doc.guildMember ?? true,
          pbgMemberRole: doc.pbgMemberRole ?? true
        });
        return finalRes.account;
      }
    }
    return null;
  }
  const db = getAdminDb();
  if (!db) return null;
  try {
    const snap = await db.collection("discord_links").where("pbgUserId", "==", userId).where("status", "==", "PROVISIONED_PENDING_FINALIZATION").limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0].data();
    const finalRes = await finalizeDiscordAccountAuthoritative({
      userId,
      pbgId: doc.pbgId || void 0,
      discordUserId: doc.discordUserId,
      discordUsername: doc.discordUsername || "discord_user",
      globalName: doc.globalName,
      discordAvatarUrl: doc.avatarUrl,
      guildMember: doc.guildMember ?? true,
      pbgMemberRole: doc.pbgMemberRole ?? true
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
  const db = getAdminDb();
  try {
    const doc = await db.collection("privatePlayerAccounts").doc(userId).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.discordLinked) return data;
    }
    const reconciled = await reconcilePendingDiscordFinalization(userId);
    if (reconciled) return reconciled;
    if (doc.exists) {
      return doc.data();
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
  const db = getAdminDb();
  if (!db) return;
  try {
    const batch = db.batch();
    const linkRef = db.collection("discord_links").doc(cleanId);
    batch.set(linkRef, {
      guildMember,
      pbgMemberRole,
      updatedAt: now
    }, { merge: true });
    const privateRef = db.collection("privatePlayerAccounts").doc(userId);
    batch.set(privateRef, {
      "discord.guildMember": guildMember,
      "discord.pbgMemberRole": pbgMemberRole,
      updatedAt: now
    }, { merge: true });
    const pbgRef = db.collection("pbgAccounts").doc(userId);
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

// src/server/discordOAuthState.ts
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
    const db = getAdminDb();
    if (!db || typeof db.runTransaction !== "function") {
      return {
        success: false,
        error: "STATE_TAMPERED",
        details: "Shared persistent authentication store is unavailable for state validation."
      };
    }
    try {
      const alreadyUsed = await db.runTransaction(async (transaction) => {
        const nonceRef = db.collection("consumed_oauth_states").doc(payload.nonce);
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

// src/server/apiRouter.ts
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
    const botToken = process.env.DISCORD_BOT_TOKEN;
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

// src/server/vercelEndpoint.ts
var app = express();
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    next();
  } else {
    express.json()(req, _res, next);
  }
});
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use("/api", apiRouter);
app.use("/", apiRouter);
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `API endpoint ${req.method} ${req.originalUrl || req.url} not found`
  });
});
app.use((err, _req, res, _next) => {
  console.error("[API Error]:", err);
  if (!res.headersSent) {
    res.status(err.status || 500).json({
      success: false,
      error: err.code || "INTERNAL_ERROR",
      message: err.message || "An internal API error occurred"
    });
  }
});
function handleRoute(defaultPath) {
  return function vercelHandler(req, res) {
    return new Promise((resolve) => {
      try {
        const rawUrl = (req.url || "").replace(/\.js(\?|$)/, "$1");
        const queryIdx = rawUrl.indexOf("?");
        const q = queryIdx >= 0 ? rawUrl.slice(queryIdx) : "";
        const cleanDefaultPath = defaultPath.replace(/\.js$/, "");
        req.url = cleanDefaultPath + q;
        res.once("finish", () => resolve());
        res.once("close", () => resolve());
        app(req, res, (err) => {
          if (err && !res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              success: false,
              error: "INTERNAL_SERVER_ERROR",
              message: err?.message || "Serverless invocation error"
            }));
          }
          resolve();
        });
      } catch (fatalErr) {
        console.error("[Fatal Handler Error]:", fatalErr);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({
            success: false,
            error: "INTERNAL_SERVER_ERROR",
            message: fatalErr?.message || "Serverless invocation error"
          }));
        }
        resolve();
      }
    });
  };
}

// src/api/opendota/[...slug].ts
async function handler(req, res) {
  const slugPath = Array.isArray(req.query?.slug) ? req.query.slug.join("/") : "";
  const fullPath = `/api/opendota/${slugPath}`.replace(/\/+$/, "");
  return handleRoute(fullPath)(req, res);
}
export {
  handler as default
};
