import { auth } from './firebaseConfig';

export interface SteamVerificationStatus {
  success: boolean;
  linked: boolean;
  verificationStatus: 'NOT_LINKED' | 'VERIFIED' | 'INVALID_CLAIM' | string;
  steamId64?: string;
  dotaAccountId?: string;
  personaName?: string | null;
  avatarUrl?: string | null;
  profileUrl?: string | null;
  openDotaUrl?: string | null;
  publicMatchData?: boolean;
  openDotaAvailable?: boolean;
  verifiedAt?: string | null;
  error?: string;
}

async function authHeaders(json = false) {
  const user = auth.currentUser;
  if (!user) throw new Error('SIGN_IN_REQUIRED');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.message || (data as any)?.error || 'STEAM_REQUEST_FAILED');
  }
  return data as T;
}

export async function getSteamVerificationStatus(): Promise<SteamVerificationStatus> {
  const response = await fetch('/api/steam/link/status', {
    headers: await authHeaders(),
    credentials: 'same-origin',
  });
  return parseJson<SteamVerificationStatus>(response);
}

export async function startSteamVerification(returnTo?: string) {
  const effectiveReturnTo =
    returnTo ||
    (typeof window !== 'undefined'
      ? window.location.pathname + window.location.search
      : '/');

  const response = await fetch('/api/steam/link/start', {
    method: 'POST',
    headers: await authHeaders(true),
    credentials: 'same-origin',
    body: JSON.stringify({ returnTo: effectiveReturnTo }),
  });

  const data = await parseJson<{ success: true; authorizeUrl: string }>(response);
  return data.authorizeUrl;
}

export async function verifyWithSteamPopup(
  returnTo?: string,
): Promise<SteamVerificationStatus> {
  if (typeof window === 'undefined') throw new Error('BROWSER_REQUIRED');

  const authorizeUrl = await startSteamVerification(returnTo);
  const width = 760;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

  const popup = window.open(
    authorizeUrl,
    'pbg-steam-verification',
    `popup=yes,width=${width},height=${height},left=${Math.floor(left)},top=${Math.floor(top)}`,
  );

  if (!popup) throw new Error('POPUP_BLOCKED');

  return new Promise<SteamVerificationStatus>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearInterval(closedPoll);
      window.clearTimeout(timeout);
    };

    const finish = async () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        resolve(await getSteamVerificationStatus());
      } catch (error) {
        reject(error);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'PBG_STEAM_LINK_RESULT') return;
      if (!event.data?.success) {
        settled = true;
        cleanup();
        reject(new Error(event.data?.error || 'STEAM_VERIFICATION_FAILED'));
        return;
      }
      void finish();
    };

    window.addEventListener('message', onMessage);

    const closedPoll = window.setInterval(() => {
      if (popup.closed && !settled) void finish();
    }, 500);

    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        try { popup.close(); } catch {}
        reject(new Error('STEAM_VERIFICATION_TIMEOUT'));
      }
    }, 10 * 60 * 1000);
  });
}

export async function unlinkSteamVerification() {
  const response = await fetch('/api/steam/link/unlink', {
    method: 'POST',
    headers: await authHeaders(),
    credentials: 'same-origin',
  });
  return parseJson<{ success: boolean; unlinked?: boolean; error?: string; message?: string }>(response);
}
