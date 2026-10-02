/**
 * Purple Bean Gaming — Connected Discord Identity Card
 * 
 * Shows official verified Discord identity:
 * - VERIFIED badge
 * - Discord avatar
 * - Discord display name
 * - @username
 * - Discord ID (Snowflake)
 * - Linked to [current PBG ID]
 * - Manage Connection option (account info, connection date, disconnect)
 */

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Unlink, 
  AlertTriangle, 
  CheckCircle2, 
  Copy, 
  Check,
  Settings,
  Calendar,
  Lock,
  Loader2
} from 'lucide-react';
import { 
  fetchDiscordLinkStatus, 
  disconnectDiscordAccount, 
  PrivateDiscordAccountStatus,
  DiscordVerificationError,
  startDiscordOAuthFlow
} from '../services/discordVerificationClient';
import { auth } from '../services/firebaseConfig';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { PBGPlayerAccount } from '../types/pbgAccount';

interface ConnectedDiscordIdentityProps {
  targetUserId?: string;
  isOwner: boolean;
  account: PBGPlayerAccount;
  onIdentityUpdated?: (discordUserId: string | null) => void;
}

export function ConnectedDiscordIdentity({
  targetUserId,
  isOwner,
  account,
  onIdentityUpdated
}: ConnectedDiscordIdentityProps) {
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const [privateAccount, setPrivateAccount] = useState<PrivateDiscordAccountStatus | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  const getIdToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('SIGN_IN_REQUIRED');
    return await user.getIdToken(true);
  };

  const loadStatus = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await fetchDiscordLinkStatus(
        auth.currentUser ? getIdToken : undefined,
        targetUserId || account.googleUid
      );
      if (data.account) {
        setPrivateAccount(data.account);
        const user = auth.currentUser;
        if (user && data.account.discordLinked && data.account.discordUserId) {
          pbgAccountRegistry.linkDiscordAccount(user.uid, {
            discordUserId: data.account.discordUserId,
            discordUsername: data.account.discordUsername || 'player',
            discordDisplayName: data.account.discordDisplayName || undefined,
            globalName: data.account.discord?.globalName || data.account.discordDisplayName || undefined,
            discordAvatar: data.account.discordAvatarUrl || data.account.discord?.avatarUrl || undefined
          });
          onIdentityUpdated?.(data.account.discordUserId);
        }
      }
    } catch {
      // Offline fallback to account prop
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [targetUserId, account.googleUid, isOwner]);

  // Initiate OAuth flow
  const handleConnectWithDiscord = async () => {
    setIsAuthorizing(true);
    setErrorMessage(null);
    setSuccessNotice(null);

    try {
      const result = await startDiscordOAuthFlow(getIdToken, account.pbgId);

      const user = auth.currentUser;
      if (user) {
        pbgAccountRegistry.linkDiscordAccount(user.uid, {
          discordUserId: result.discordUserId,
          discordUsername: result.discordUsername,
          discordDisplayName: result.discordDisplayName || account.displayName,
          globalName: result.discord?.globalName || result.discordDisplayName,
          discordAvatar: result.discord?.avatarUrl || undefined
        });
      }

      await loadStatus();
      setSuccessNotice('Discord account verified and linked successfully.');
      onIdentityUpdated?.(result.discordUserId);
    } catch (err: any) {
      if (err instanceof DiscordVerificationError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Discord authentication was cancelled or interrupted.');
      }
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Disconnect Discord: removes both sides of the Discord <-> PBG identity mapping
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Discord identity? This will remove the link between your Discord account and PBG identity.')) {
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);
    setActionInProgress(true);

    try {
      await disconnectDiscordAccount(getIdToken);
      const user = auth.currentUser;
      if (user) {
        pbgAccountRegistry.disconnectDiscordAccount(user.uid);
      }
      setPrivateAccount(null);
      setIsManageModalOpen(false);
      setSuccessNotice('Discord account disconnected successfully.');
      onIdentityUpdated?.(null);
    } catch (err: any) {
      if (err instanceof DiscordVerificationError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Failed to disconnect Discord account.');
      }
    } finally {
      setActionInProgress(false);
    }
  };

  const copyId = (id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const isLinked = Boolean(
    account.discordLinked || 
    (privateAccount && privateAccount.discordLinked && privateAccount.discordUserId)
  );

  const rawDiscordId = privateAccount?.discordUserId || account.discordUserId || '';
  const displayUsername = privateAccount?.discordUsername || account.discordUsername || 'discord_user';
  const displayGlobalName = privateAccount?.discord?.globalName || privateAccount?.discordDisplayName || account.discordDisplayName || displayUsername;
  const avatarUrl = privateAccount?.discord?.avatarUrl || privateAccount?.discordAvatarUrl || account.discordAvatar || `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`;
  const connectedAtTimestamp = privateAccount?.discord?.connectedAt || privateAccount?.discordLinkedAt;
  const connectedDateString = connectedAtTimestamp
    ? new Date(connectedAtTimestamp).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Active';

  return (
    <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[#5865F2] text-white p-4 border-b-[3px] border-black flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="bg-[#FFE600] text-black text-[9px] font-black uppercase px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
              DISCORD IDENTITY
            </span>
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider">
              OAUTH 2.0 PROTOCOL · IDENTIFY
            </span>
          </div>
          <h3 className="font-sans text-xl font-black uppercase tracking-wide">
            CONNECTED IDENTITY — DISCORD
          </h3>
        </div>

        {isLinked ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#70FFAF] text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <ShieldCheck className="w-4 h-4 text-emerald-950" />
            <span>VERIFIED</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-200 text-stone-700 text-xs font-black uppercase border-2 border-black">
            <span>NOT CONNECTED</span>
          </span>
        )}
      </div>

      {/* Body Content */}
      <div className="p-6 space-y-5">
        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="p-3 bg-red-100 border-2 border-red-600 text-red-950 text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs font-bold text-red-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {successNotice && (
          <div className="p-3 bg-emerald-100 border-2 border-emerald-600 text-emerald-950 text-xs flex items-center justify-between shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successNotice}</span>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-xs font-bold text-emerald-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isLinked ? (
          /* ============================================================= */
          /* VERIFIED STATE                                               */
          /* ============================================================= */
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 p-5 bg-stone-50 border-2 border-black shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center gap-4">
                {/* Discord Avatar */}
                <img
                  src={avatarUrl}
                  alt={displayUsername}
                  className="w-16 h-16 rounded-full border-2 border-black object-cover bg-[#5865F2] shadow-[2px_2px_0px_0px_#000] shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Discord Display Name */}
                    <h4 className="font-sans text-xl font-black uppercase text-black">
                      {displayGlobalName}
                    </h4>
                    {/* VERIFIED Pill */}
                    <span className="bg-[#70FFAF] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
                      VERIFIED
                    </span>
                  </div>

                  {/* @username */}
                  <div className="text-xs font-mono font-bold text-stone-600 flex items-center gap-1.5">
                    <span>@{displayUsername}</span>
                  </div>

                  {/* Discord ID & Linked to PBG ID */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-xs">
                    <span className="text-stone-700 bg-white px-2 py-0.5 border border-black text-[11px] font-bold flex items-center gap-1.5">
                      <span>Discord ID:</span>
                      <strong className="text-black">{rawDiscordId}</strong>
                      <button
                        onClick={() => copyId(rawDiscordId)}
                        className="hover:text-[#5865F2] cursor-pointer"
                        title="Copy Discord ID"
                      >
                        {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </span>

                    <span className="bg-[#FFE600] text-black px-2 py-0.5 border border-black text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                      Linked to {account.pbgId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Manage Connection Trigger */}
              {isOwner && (
                <div className="shrink-0 pt-2 sm:pt-0">
                  <button
                    onClick={() => setIsManageModalOpen(true)}
                    className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <Settings className="w-4 h-4 text-stone-700" />
                    <span>Manage Connection</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t-2 border-stone-200">
              <a
                href="https://discord.com/app"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5"
              >
                <span>Open Discord</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={loadStatus}
                disabled={loading}
                className="px-3 py-1.5 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================= */
          /* UNLINKED STATE (Strictly per user specification)              */
          /* ============================================================= */
          <div className="bg-stone-50 border-2 border-black p-6 sm:p-8 text-center space-y-5 shadow-[4px_4px_0px_0px_#000] max-w-xl mx-auto">
            <div className="w-14 h-14 bg-[#5865F2] text-white border-2 border-black flex items-center justify-center mx-auto text-2xl shadow-[3px_3px_0px_0px_#000]">
              👾
            </div>

            <div className="space-y-2">
              <h4 className="font-sans text-xl font-black uppercase text-black">
                CONNECT DISCORD IDENTITY
              </h4>
              <p className="text-xs text-stone-600 leading-relaxed max-w-md mx-auto">
                Connect your Discord account to your PBG identity. You will be redirected to Discord to verify account ownership.
              </p>
            </div>

            {isOwner && (
              <div className="pt-1">
                <button
                  onClick={handleConnectWithDiscord}
                  disabled={isAuthorizing}
                  className="px-8 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_#000] cursor-pointer inline-flex items-center gap-2 transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
                >
                  {isAuthorizing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>REDIRECTING TO DISCORD...</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 text-white" />
                      <span>CONNECT WITH DISCORD</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Checklist per user specification */}
            <div className="pt-2 max-w-md mx-auto p-3.5 bg-white border-2 border-black text-left space-y-2 shadow-[2px_2px_0px_0px_#000]">
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <span className="text-emerald-600 font-black">✓</span>
                <span>Discord ID detected automatically</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <span className="text-emerald-600 font-black">✓</span>
                <span>No Discord password is shared with PurpleBeanGaming</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <span className="text-emerald-600 font-black">✓</span>
                <span>One Discord account per PBG account</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* MANAGE CONNECTION MODAL                                        */}
      {/* ============================================================= */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono animate-in fade-in duration-150">
          <div 
            className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">
                  IDENTITY CONFIGURATION
                </span>
                <h3 className="font-sans text-xl font-black uppercase text-black">
                  Manage Discord Connection
                </h3>
              </div>
              <button
                onClick={() => setIsManageModalOpen(false)}
                className="p-1 hover:bg-stone-100 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Account Information */}
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                ACCOUNT INFORMATION
              </span>

              <div className="p-4 bg-stone-50 border-2 border-black space-y-3 shadow-[2px_2px_0px_0px_#000]">
                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs text-stone-600">Discord Display Name:</span>
                  <strong className="text-xs text-black">{displayGlobalName}</strong>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs text-stone-600">Discord Username:</span>
                  <span className="text-xs font-bold text-black font-mono">@{displayUsername}</span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs text-stone-600">Discord Snowflake ID:</span>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                    <span>{rawDiscordId}</span>
                    <button
                      onClick={() => copyId(rawDiscordId)}
                      className="hover:text-[#5865F2] cursor-pointer p-0.5"
                      title="Copy ID"
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs text-stone-600">Linked PBG Identity:</span>
                  <span className="bg-[#FFE600] text-black px-2 py-0.5 border border-black text-xs font-black uppercase">
                    {account.pbgId}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                  <span className="text-xs text-stone-600">Verification Protocol:</span>
                  <span className="text-xs font-bold text-stone-800">
                    Discord OAuth 2.0 (Scope: identify)
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-stone-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>Connection Date:</span>
                  </span>
                  <span className="text-xs font-bold text-stone-800 font-mono">
                    {connectedDateString}
                  </span>
                </div>
              </div>
            </div>

            {/* Disconnect Action */}
            <div className="pt-2 border-t-2 border-stone-200 space-y-3">
              <div className="p-3 bg-red-50 border border-red-300 text-[11px] text-red-900 space-y-1">
                <strong className="block font-bold">Disconnecting Discord:</strong>
                <p>
                  Disconnecting will remove both sides of the Discord↔PBG identity mapping. Tournament check-in and automated Discord bot roles will be paused.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={actionInProgress}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Unlink className="w-4 h-4 text-white" />
                  <span>{actionInProgress ? 'Disconnecting...' : 'Disconnect Discord'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
