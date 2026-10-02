import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unlink,
  AlertTriangle,
} from 'lucide-react';
import {
  getSteamVerificationStatus,
  SteamVerificationStatus,
  unlinkSteamVerification,
  verifyWithSteamPopup,
} from '../services/steamVerificationService';

interface SteamVerificationCardProps {
  compact?: boolean;
}

function maskSteamId(value?: string) {
  if (!value) return '—';
  return `•••••••••••${value.slice(-6)}`;
}

function statusMessage(error: string) {
  const messages: Record<string, string> = {
    SIGN_IN_REQUIRED: 'Sign in with Google before verifying your Steam account.',
    POPUP_BLOCKED: 'Steam verification popup was blocked. Allow popups for PurpleBeanGaming and try again.',
    STEAM_ALREADY_LINKED: 'This Steam account is already linked to another PurpleBeanGaming account.',
    PBG_ACCOUNT_ALREADY_HAS_STEAM: 'This PurpleBeanGaming account already has a different verified Steam account.',
    LINK_SESSION_EXPIRED: 'The Steam verification session expired. Start verification again.',
    STEAM_VALIDATION_FAILED: 'Steam could not verify the login response. Please try again.',
    ACTIVE_TOURNAMENT_LOCK: 'Steam cannot be disconnected while you have an active tournament registration.',
  };
  return messages[error] || error.replaceAll('_', ' ');
}

export function SteamVerificationCard({ compact = false }: SteamVerificationCardProps) {
  const [status, setStatus] = useState<SteamVerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<'verify' | 'unlink' | 'refresh' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setError(null);
    try {
      const next = await getSteamVerificationStatus();
      setStatus(next);
    } catch (e: any) {
      if (e?.message === 'SIGN_IN_REQUIRED') {
        setStatus({ success: true, linked: false, verificationStatus: 'NOT_LINKED' });
      } else {
        setError(e?.message || 'STEAM_STATUS_FAILED');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const verify = async () => {
    setAction('verify');
    setError(null);
    try {
      const next = await verifyWithSteamPopup();
      setStatus(next);
    } catch (e: any) {
      setError(e?.message || 'STEAM_VERIFICATION_FAILED');
    } finally {
      setAction(null);
    }
  };

  const unlink = async () => {
    if (!window.confirm('Disconnect this verified Steam / Dota 2 account from PurpleBeanGaming? Historical tournament identity snapshots will remain unchanged.')) return;
    setAction('unlink');
    setError(null);
    try {
      const result = await unlinkSteamVerification();
      if (!result.success) throw new Error(result.error || 'STEAM_UNLINK_FAILED');
      await loadStatus();
    } catch (e: any) {
      setError(e?.message || 'STEAM_UNLINK_FAILED');
    } finally {
      setAction(null);
    }
  };

  const refresh = async () => {
    setAction('refresh');
    setLoading(true);
    await loadStatus();
    setAction(null);
  };

  if (loading) {
    return (
      <div className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="font-mono text-xs font-black uppercase">Checking Steam verification…</span>
      </div>
    );
  }

  if (!status?.linked) {
    return (
      <section className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-black uppercase text-base">Verify Dota 2 Ownership</h3>
            </div>
            <p className="font-mono text-xs text-stone-600 mt-2 max-w-2xl">
              Sign in on Steam's own website. PurpleBeanGaming never receives your Steam password. Steam returns your verified Steam64 ID, which PBG converts to your Dota account ID and connects to OpenDota.
            </p>
          </div>
          <span className="bg-stone-100 border-2 border-black px-2.5 py-1 font-mono text-[10px] font-black uppercase">
            Not linked
          </span>
        </div>

        {error && (
          <div className="bg-[#FFF2F2] border-2 border-black p-3 flex items-start gap-2 font-mono text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{statusMessage(error)}</span>
          </div>
        )}

        <button
          onClick={verify}
          disabled={action !== null}
          className="bg-[#FFE600] hover:bg-yellow-300 disabled:opacity-60 border-2 border-black px-4 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-2"
        >
          {action === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Verify with Steam
        </button>
      </section>
    );
  }

  return (
    <section className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          {status.avatarUrl ? (
            <img src={status.avatarUrl} alt="" className="w-12 h-12 border-2 border-black object-cover" />
          ) : (
            <div className="w-12 h-12 border-2 border-black bg-stone-100 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black uppercase">{status.personaName || 'Verified Steam Account'}</h3>
              <span className="bg-[#70FFAF] border border-black px-2 py-0.5 font-mono text-[9px] font-black uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Steam Verified
              </span>
              <span className="bg-[#F3E8FF] border border-black px-2 py-0.5 font-mono text-[9px] font-black uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Dota Verified
              </span>
            </div>
            <p className="font-mono text-[11px] text-stone-600 mt-1">
              Ownership verified through Steam OpenID
            </p>
          </div>
        </div>

        <span className={`${status.publicMatchData ? 'bg-[#70FFAF]' : 'bg-[#FFE600]'} border-2 border-black px-2.5 py-1 font-mono text-[10px] font-black uppercase`}>
          Match Data: {status.publicMatchData ? 'Public' : 'Private / unavailable'}
        </span>
      </div>

      <div className={`grid ${compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'} gap-3 font-mono text-xs`}>
        <div className="border-2 border-black p-3 bg-stone-50">
          <span className="block text-[9px] uppercase text-stone-500 font-black">Steam64</span>
          <span className="font-black">{maskSteamId(status.steamId64)}</span>
        </div>
        <div className="border-2 border-black p-3 bg-stone-50">
          <span className="block text-[9px] uppercase text-stone-500 font-black">Dota Friend ID</span>
          <span className="font-black">{status.dotaAccountId || '—'}</span>
        </div>
        {!compact && (
          <div className="border-2 border-black p-3 bg-stone-50">
            <span className="block text-[9px] uppercase text-stone-500 font-black">Verified</span>
            <span className="font-black">{status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : 'Verified'}</span>
          </div>
        )}
      </div>

      {!status.publicMatchData && (
        <div className="bg-[#FFFDEB] border-2 border-black p-3">
          <p className="font-black text-xs uppercase">Enable Dota public match data</p>
          <p className="font-mono text-[11px] mt-1 text-stone-700">
            Open Dota 2 → Settings → Social → enable “Expose Public Match Data”, then refresh your Dota data.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-[#FFF2F2] border-2 border-black p-3 flex items-start gap-2 font-mono text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{statusMessage(error)}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {status.profileUrl && (
          <a href={status.profileUrl} target="_blank" rel="noreferrer" className="border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black uppercase flex items-center gap-1.5">
            View Steam <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        {status.openDotaUrl && (
          <a href={status.openDotaUrl} target="_blank" rel="noreferrer" className="border-2 border-black bg-white px-3 py-2 font-mono text-[10px] font-black uppercase flex items-center gap-1.5">
            View OpenDota <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
        <button onClick={refresh} disabled={action !== null} className="border-2 border-black bg-[#FFE600] px-3 py-2 font-mono text-[10px] font-black uppercase flex items-center gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${action === 'refresh' ? 'animate-spin' : ''}`} /> Refresh Status
        </button>
        <button onClick={unlink} disabled={action !== null} className="border-2 border-black bg-black text-white px-3 py-2 font-mono text-[10px] font-black uppercase flex items-center gap-1.5">
          {action === 'unlink' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />} Disconnect
        </button>
      </div>
    </section>
  );
}
