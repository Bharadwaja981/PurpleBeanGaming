import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { accountIdFromSteamId64 } from '../../lib/dota/ids';
import { getFirebaseAdminDb, verifyFirebaseBearer } from './firebaseAdmin';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const OPENID_IDENTIFIER = 'http://specs.openid.net/auth/2.0/identifier_select';
const STATE_TTL_MS = 10 * 60 * 1000;
const CLAIM_COLLECTION = 'steamIdentityClaims';
const PRIVATE_COLLECTION = 'privatePlayerAccounts';
const PUBLIC_COLLECTION = 'publicPlayers';

type LinkState = {
  uid: string;
  email?: string;
  returnTo: string;
  createdAt: number;
  nonce: string;
};

function stateSecret() {
  const secret = process.env.STEAM_OPENID_STATE_SECRET;
  if (!secret || secret.length < 32) throw new Error('STEAM_OPENID_STATE_SECRET_REQUIRED');
  return secret;
}

function encodeState(value: LinkState) {
  const payload = Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function decodeState(token: string): LinkState {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new Error('INVALID_LINK_STATE');
  const expected = crypto.createHmac('sha256', stateSecret()).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error('INVALID_LINK_STATE');
  }
  const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as LinkState;
  if (!value.uid || !value.returnTo || !value.createdAt || Date.now() - value.createdAt > STATE_TTL_MS) {
    throw new Error('LINK_SESSION_EXPIRED');
  }
  return value;
}

function safeReturnTo(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function requestOrigin(req: Request) {
  const configured = process.env.STEAM_OPENID_REALM?.replace(/\/$/, '');
  if (configured) return configured;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  if (!host) throw new Error('STEAM_OPENID_REALM_REQUIRED');
  return `${proto}://${host}`;
}

function buildSteamOpenIdUrl(req: Request, state: string) {
  const origin = requestOrigin(req);
  const callback = `${origin}/api/steam/link/callback?state=${encodeURIComponent(state)}`;
  const url = new URL(STEAM_OPENID_ENDPOINT);
  url.searchParams.set('openid.ns', OPENID_NS);
  url.searchParams.set('openid.mode', 'checkid_setup');
  url.searchParams.set('openid.return_to', callback);
  url.searchParams.set('openid.realm', `${origin}/`);
  url.searchParams.set('openid.identity', OPENID_IDENTIFIER);
  url.searchParams.set('openid.claimed_id', OPENID_IDENTIFIER);
  return url.toString();
}

async function validateSteamCallback(req: Request) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(req.query)) {
    if (!key.startsWith('openid.')) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === 'string') params.set(key, value);
  }
  params.set('openid.mode', 'check_authentication');

  const response = await fetch(STEAM_OPENID_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error('STEAM_VALIDATION_FAILED');
  const body = await response.text();
  if (!/(^|\n)is_valid:true(\n|$)/.test(body)) throw new Error('STEAM_VALIDATION_FAILED');

  const claimedId = String(req.query['openid.claimed_id'] || '');
  const match = /\/openid\/id\/(\d{17})$/.exec(claimedId);
  if (!match) throw new Error('STEAM_ID_MISSING');
  return match[1];
}

async function fetchSteamProfile(steamId64: string) {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return null;
  try {
    const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
    url.searchParams.set('key', key);
    url.searchParams.set('steamids', steamId64);
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return null;
    const data = await response.json() as any;
    return data?.response?.players?.[0] || null;
  } catch {
    return null;
  }
}

async function inspectOpenDota(accountId: string) {
  try {
    const url = new URL(`https://api.opendota.com/api/players/${accountId}`);
    const key = process.env.OPENDOTA_API_KEY;
    if (key) url.searchParams.set('api_key', key);
    const response = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!response.ok) return { available: false, publicMatchData: false };
    const data = await response.json() as any;
    return {
      available: Boolean(data?.profile),
      publicMatchData: Boolean(data?.profile),
      personaName: data?.profile?.personaname || null,
      avatarUrl: data?.profile?.avatarfull || null,
      rankTier: data?.rank_tier ?? null,
      leaderboardRank: data?.leaderboard_rank ?? null,
    };
  } catch {
    return { available: false, publicMatchData: false };
  }
}

function completionHtml(payload: Record<string, unknown>, returnTo: string) {
  const message = JSON.stringify({ type: 'PBG_STEAM_LINK_RESULT', ...payload }).replace(/</g, '\\u003c');
  const redirect = JSON.stringify(returnTo).replace(/</g, '\\u003c');
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Steam Verification</title></head>
<body style="font-family:system-ui;background:#F3E8FF;color:#111;padding:32px">
<script>
  const msg = ${message};
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(msg, window.location.origin);
      window.close();
    } else {
      const target = new URL(${redirect}, window.location.origin);
      target.searchParams.set('steam_link', msg.success ? 'success' : 'error');
      if (msg.error) target.searchParams.set('steam_error', String(msg.error));
      window.location.replace(target.toString());
    }
  } catch {
    window.location.replace(${redirect});
  }
</script>
<p>Steam verification complete. You can return to PurpleBeanGaming.</p>
</body></html>`;
}

export async function startSteamLink(req: Request, res: Response) {
  try {
    const decoded = await verifyFirebaseBearer(req.headers.authorization);
    const returnTo = safeReturnTo(req.body?.returnTo);
    const state = encodeState({
      uid: decoded.uid,
      email: decoded.email,
      returnTo,
      createdAt: Date.now(),
      nonce: crypto.randomBytes(16).toString('base64url'),
    });
    return res.json({ success: true, authorizeUrl: buildSteamOpenIdUrl(req, state) });
  } catch (error: any) {
    const code = error?.message === 'AUTH_REQUIRED' ? 401 : 503;
    return res.status(code).json({ success: false, error: error?.message || 'STEAM_LINK_START_FAILED' });
  }
}

export async function completeSteamLink(req: Request, res: Response) {
  let state: LinkState;
  try {
    const stateKey = typeof req.query.state === 'string' ? req.query.state : '';
    state = decodeState(stateKey);
  } catch (error: any) {
    return res.status(400).send(completionHtml({ success: false, error: error?.message || 'LINK_SESSION_EXPIRED' }, '/'));
  }

  try {
    const steamId64 = await validateSteamCallback(req);
    const accountId = accountIdFromSteamId64(steamId64);
    const db = getFirebaseAdminDb();
    const claimRef = db.collection(CLAIM_COLLECTION).doc(steamId64);
    const privateRef = db.collection(PRIVATE_COLLECTION).doc(state.uid);
    const publicRef = db.collection(PUBLIC_COLLECTION).doc(state.uid);

    const [steamProfile, openDota] = await Promise.all([
      fetchSteamProfile(steamId64),
      inspectOpenDota(accountId),
    ]);

    const verifiedAt = new Date().toISOString();
    await db.runTransaction(async (tx) => {
      const [claimSnap, privateSnap] = await Promise.all([
        tx.get(claimRef),
        tx.get(privateRef),
      ]);

      if (claimSnap.exists && claimSnap.data()?.userId !== state.uid) {
        throw new Error('STEAM_ALREADY_LINKED');
      }

      const previousSteam = privateSnap.data()?.steamId64;
      if (previousSteam && previousSteam !== steamId64) {
        throw new Error('PBG_ACCOUNT_ALREADY_HAS_STEAM');
      }

      tx.set(claimRef, {
        steamId64,
        dotaAccountId: accountId,
        userId: state.uid,
        verifiedAt,
        verificationMethod: 'steam_openid_2',
        nonce: state.nonce,
      }, { merge: true });

      tx.set(privateRef, {
        userId: state.uid,
        email: state.email || null,
        steamId64,
        steamId32: accountId,
        dotaAccountId: accountId,
        verificationStatus: 'VERIFIED',
        steamOwnershipVerified: true,
        steamVerificationMethod: 'steam_openid_2',
        steamVerifiedAt: verifiedAt,
        steamPersonaName: steamProfile?.personaname || openDota.personaName || null,
        steamAvatarUrl: steamProfile?.avatarfull || openDota.avatarUrl || null,
        steamProfileUrl: steamProfile?.profileurl || `https://steamcommunity.com/profiles/${steamId64}`,
        openDotaUrl: `https://www.opendota.com/players/${accountId}`,
        openDotaAvailable: openDota.available,
        publicMatchData: openDota.publicMatchData,
        rankTier: (openDota as any).rankTier ?? null,
        leaderboardRank: (openDota as any).leaderboardRank ?? null,
        linkedAt: privateSnap.data()?.linkedAt || verifiedAt,
        updatedAt: verifiedAt,
      }, { merge: true });

      tx.set(publicRef, {
        steamAccountLinked: true,
        steamOwnershipVerified: true,
        dotaAccountId: accountId,
        steamId64Masked: `•••••••••••${steamId64.slice(-6)}`,
        publicMatchData: openDota.publicMatchData,
        openDotaUrl: `https://www.opendota.com/players/${accountId}`,
        profileUrl: steamProfile?.profileurl || `https://steamcommunity.com/profiles/${steamId64}`,
        updatedAt: verifiedAt,
      }, { merge: true });
    });

    return res.status(200).send(completionHtml({
      success: true,
      steamId64,
      dotaAccountId: accountId,
      publicMatchData: openDota.publicMatchData,
    }, state.returnTo));
  } catch (error: any) {
    return res.status(400).send(completionHtml({
      success: false,
      error: error?.message || 'STEAM_VERIFICATION_FAILED',
    }, state.returnTo));
  }
}

export async function getSteamLinkStatus(req: Request, res: Response) {
  try {
    const decoded = await verifyFirebaseBearer(req.headers.authorization);
    const db = getFirebaseAdminDb();
    const privateSnap = await db.collection(PRIVATE_COLLECTION).doc(decoded.uid).get();
    const data = privateSnap.data();
    if (!privateSnap.exists || !data?.steamId64 || data?.steamOwnershipVerified !== true) {
      return res.json({ success: true, linked: false, verificationStatus: 'NOT_LINKED' });
    }

    const claimSnap = await db.collection(CLAIM_COLLECTION).doc(data.steamId64).get();
    const claim = claimSnap.data();
    const validClaim = claimSnap.exists && claim?.userId === decoded.uid && claim?.steamId64 === data.steamId64;
    if (!validClaim) {
      return res.json({ success: true, linked: false, verificationStatus: 'INVALID_CLAIM' });
    }

    return res.json({
      success: true,
      linked: true,
      verificationStatus: 'VERIFIED',
      steamId64: data.steamId64,
      dotaAccountId: data.dotaAccountId || data.steamId32,
      personaName: data.steamPersonaName || null,
      avatarUrl: data.steamAvatarUrl || null,
      profileUrl: data.steamProfileUrl || `https://steamcommunity.com/profiles/${data.steamId64}`,
      openDotaUrl: data.openDotaUrl || null,
      publicMatchData: Boolean(data.publicMatchData),
      openDotaAvailable: Boolean(data.openDotaAvailable),
      verifiedAt: data.steamVerifiedAt || null,
    });
  } catch (error: any) {
    const code = error?.message === 'AUTH_REQUIRED' ? 401 : 503;
    return res.status(code).json({ success: false, error: error?.message || 'STEAM_STATUS_FAILED' });
  }
}

export async function unlinkSteam(req: Request, res: Response) {
  try {
    const decoded = await verifyFirebaseBearer(req.headers.authorization);
    const db = getFirebaseAdminDb();
    const privateRef = db.collection(PRIVATE_COLLECTION).doc(decoded.uid);
    const privateSnap = await privateRef.get();
    const data = privateSnap.data();
    if (!privateSnap.exists || !data?.steamId64) {
      return res.json({ success: true, unlinked: true });
    }

    const activeRegistration = await db.collection('registrations')
      .where('userId', '==', decoded.uid)
      .where('status', 'in', ['registered', 'under_review', 'verified', 'REGISTERED', 'UNDER_REVIEW', 'VERIFIED'])
      .limit(1)
      .get();

    if (!activeRegistration.empty) {
      return res.status(409).json({
        success: false,
        error: 'ACTIVE_TOURNAMENT_LOCK',
        message: 'Steam cannot be disconnected while you have an active tournament registration.',
      });
    }

    const steamId64 = data.steamId64;
    const claimRef = db.collection(CLAIM_COLLECTION).doc(steamId64);
    const publicRef = db.collection(PUBLIC_COLLECTION).doc(decoded.uid);
    await db.runTransaction(async (tx) => {
      const claimSnap = await tx.get(claimRef);
      if (claimSnap.exists && claimSnap.data()?.userId === decoded.uid) tx.delete(claimRef);
      tx.set(privateRef, {
        steamId64: null,
        steamId32: null,
        dotaAccountId: null,
        verificationStatus: 'NOT_LINKED',
        steamOwnershipVerified: false,
        steamVerificationMethod: null,
        steamVerifiedAt: null,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      tx.set(publicRef, {
        steamAccountLinked: false,
        steamOwnershipVerified: false,
        dotaAccountId: null,
        steamId64Masked: null,
        publicMatchData: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    return res.json({ success: true, unlinked: true });
  } catch (error: any) {
    const code = error?.message === 'AUTH_REQUIRED' ? 401 : 503;
    return res.status(code).json({ success: false, error: error?.message || 'STEAM_UNLINK_FAILED' });
  }
}
