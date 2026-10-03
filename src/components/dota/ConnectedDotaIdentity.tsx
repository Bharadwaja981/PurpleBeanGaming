import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Unlink, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  Lock,
  Gamepad2
} from 'lucide-react';
import { 
  startSteamVerificationFlow, 
  fetchSteamLinkStatus, 
  disconnectSteamAccount,
  PrivateAccountStatus,
  PublicProfileStatus,
  SteamVerificationError,
  getFriendlyErrorMessage,
  maskSteamId64
} from '../../services/steamVerificationClient';
import { auth } from '../../services/firebaseConfig';
import { pbgAccountRegistry } from '../../domain/pbgAccountRegistry';
import { PBGPlayerAccount } from '../../types/pbgAccount';

interface ConnectedDotaIdentityProps {
  targetUserId?: string;
  isOwner: boolean;
  account?: PBGPlayerAccount;
  onIdentityUpdated?: (dotaAccountId: string | null) => void;
  onOpenGameProfile?: (dotaAccountId: string) => void;
}

export function ConnectedDotaIdentity({
  targetUserId,
  isOwner,
  account,
  onIdentityUpdated,
  onOpenGameProfile
}: ConnectedDotaIdentityProps) {
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const [privateAccount, setPrivateAccount] = useState<PrivateAccountStatus | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfileStatus | null>(null);

  // Authoritative local player account from prop or client PBG registry
  const getResolvedAccount = (): PBGPlayerAccount | undefined => {
    if (account) return account;
    if (targetUserId) {
      const byUid = pbgAccountRegistry.getAccountByUid(targetUserId);
      if (byUid) return byUid;
      const byPbg = pbgAccountRegistry.getAccountByPbgId(targetUserId);
      if (byPbg) return byPbg;
      const byEmail = pbgAccountRegistry.getAccountByEmail(targetUserId);
      if (byEmail) return byEmail;
    }
    const currentAuth = auth.currentUser;
    if (isOwner && currentAuth) {
      const byAuthUid = pbgAccountRegistry.getAccountByUid(currentAuth.uid);
      if (byAuthUid) return byAuthUid;
      if (currentAuth.email) {
        const byAuthEmail = pbgAccountRegistry.getAccountByEmail(currentAuth.email);
        if (byAuthEmail) return byAuthEmail;
      }
    }
    return undefined;
  };

  const resolvedAccount = getResolvedAccount();

  // Helper to obtain current user's Firebase token
  const getIdToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('SIGN_IN_REQUIRED');
    return await user.getIdToken(true);
  };

  const loadStatus = async () => {
    setLoading(true);
    setErrorMessage(null);
    const currentResolved = getResolvedAccount();

    try {
      const data = await fetchSteamLinkStatus(
        auth.currentUser ? getIdToken : undefined,
        targetUserId || currentResolved?.googleUid
      );

      if (data.isOwner && data.account) {
        if (data.account.steamOwnershipVerified && data.account.dotaAccountId) {
          setPrivateAccount(data.account);
          const user = auth.currentUser;
          if (user && data.account.steamId64) {
            pbgAccountRegistry.verifyAndLinkDotaAccount(user.uid, {
              steamId64: data.account.steamId64,
              dotaAccountId: data.account.dotaAccountId,
              steamPersonaName: data.account.steamPersonaName,
              steamAvatar: data.account.steamAvatarUrl,
              steamProfileUrl: data.account.steamProfileUrl,
              publicMatchDataStatus: data.account.publicMatchData || 'PUBLIC',
              rankTier: data.account.rankTier,
              leaderboardRank: data.account.leaderboardRank
            });
            if (onIdentityUpdated) {
              onIdentityUpdated(data.account.dotaAccountId);
            }
          }
        } else if (currentResolved && (currentResolved.dotaAccountVerified || currentResolved.dotaOwnershipVerified) && currentResolved.dotaAccountId) {
          // If server returns empty unlinked default (e.g. cold Vercel serverless function or unauthenticated probe),
          // preserve authoritative verified identity from local PBG registry to match top card
          setPrivateAccount({
            userId: targetUserId || currentResolved.googleUid,
            steamId64: currentResolved.steamId || null,
            steamId32: currentResolved.dotaAccountId,
            dotaAccountId: currentResolved.dotaAccountId,
            verificationStatus: 'VERIFIED',
            steamOwnershipVerified: true,
            steamPersonaName: currentResolved.steamPersonaName || currentResolved.dotaDisplayName,
            steamAvatarUrl: currentResolved.dotaAvatar || currentResolved.avatarUrl,
            steamProfileUrl: currentResolved.steamProfileUrl,
            openDotaUrl: currentResolved.openDotaProfile,
            publicMatchData: currentResolved.publicMatchDataStatus === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            rankTier: currentResolved.dotaRankTier,
            leaderboardRank: currentResolved.dotaLeaderboardRank,
            updatedAt: Date.now()
          });
        } else {
          setPrivateAccount(data.account);
        }
      } else if (data.profile) {
        if (data.profile.steamOwnershipVerified && data.profile.dotaAccountId) {
          setPublicProfile(data.profile);
        } else if (currentResolved && (currentResolved.dotaAccountVerified || currentResolved.dotaOwnershipVerified) && currentResolved.dotaAccountId) {
          setPublicProfile({
            userId: targetUserId || currentResolved.googleUid,
            steamAccountLinked: true,
            steamOwnershipVerified: true,
            dotaAccountId: currentResolved.dotaAccountId,
            steamId64Masked: currentResolved.steamId ? maskSteamId64(currentResolved.steamId) : null,
            openDotaUrl: currentResolved.openDotaProfile || null,
            profileUrl: currentResolved.steamProfileUrl || null,
            publicMatchData: currentResolved.publicMatchDataStatus === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            steamPersonaName: currentResolved.steamPersonaName || currentResolved.dotaDisplayName,
            steamAvatarUrl: currentResolved.dotaAvatar || currentResolved.avatarUrl,
            rankTier: currentResolved.dotaRankTier
          });
        } else {
          setPublicProfile(data.profile);
        }
      }
    } catch (err: any) {
      console.warn('[ConnectedDotaIdentity] Status fetch note:', err);
      // Fallback directly to resolvedAccount so the card is never unlinked if registry has verified data
      if (currentResolved && (currentResolved.dotaAccountVerified || currentResolved.dotaOwnershipVerified) && currentResolved.dotaAccountId) {
        if (isOwner) {
          setPrivateAccount({
            userId: targetUserId || currentResolved.googleUid,
            steamId64: currentResolved.steamId || null,
            steamId32: currentResolved.dotaAccountId,
            dotaAccountId: currentResolved.dotaAccountId,
            verificationStatus: 'VERIFIED',
            steamOwnershipVerified: true,
            steamPersonaName: currentResolved.steamPersonaName || currentResolved.dotaDisplayName,
            steamAvatarUrl: currentResolved.dotaAvatar || currentResolved.avatarUrl,
            steamProfileUrl: currentResolved.steamProfileUrl,
            openDotaUrl: currentResolved.openDotaProfile,
            publicMatchData: currentResolved.publicMatchDataStatus === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            rankTier: currentResolved.dotaRankTier,
            leaderboardRank: currentResolved.dotaLeaderboardRank,
            updatedAt: Date.now()
          });
        } else {
          setPublicProfile({
            userId: targetUserId || currentResolved.googleUid,
            steamAccountLinked: true,
            steamOwnershipVerified: true,
            dotaAccountId: currentResolved.dotaAccountId,
            steamId64Masked: currentResolved.steamId ? maskSteamId64(currentResolved.steamId) : null,
            openDotaUrl: currentResolved.openDotaProfile || null,
            profileUrl: currentResolved.steamProfileUrl || null,
            publicMatchData: currentResolved.publicMatchDataStatus === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
            steamPersonaName: currentResolved.steamPersonaName || currentResolved.dotaDisplayName,
            steamAvatarUrl: currentResolved.dotaAvatar || currentResolved.avatarUrl,
            rankTier: currentResolved.dotaRankTier
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const unsub = pbgAccountRegistry.subscribe(() => {
      loadStatus();
    });
    return unsub;
  }, [targetUserId, isOwner, account?.dotaAccountId, account?.dotaAccountVerified]);

  const handleVerifyWithSteam = async () => {
    if (!auth.currentUser) {
      setErrorMessage('Please sign in with Google/PBG first to link your Steam account.');
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);
    setActionInProgress(true);

    try {
      const result = await startSteamVerificationFlow(getIdToken);
      setSuccessNotice(`Steam verified! Connected Dota Account: ${result.dotaAccountId}`);
      await loadStatus();
      if (onIdentityUpdated) {
        onIdentityUpdated(result.dotaAccountId);
      }
    } catch (err: any) {
      if (err instanceof SteamVerificationError) {
        setErrorMessage(getFriendlyErrorMessage(err.code, err.message));
      } else {
        setErrorMessage(err.message || 'Steam verification was interrupted.');
      }
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Steam and Dota 2 identity from PurpleBeanGaming?')) {
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);
    setActionInProgress(true);

    try {
      await disconnectSteamAccount(getIdToken);
      const user = auth.currentUser;
      if (user) {
        pbgAccountRegistry.disconnectSteamDotaAccount(user.uid);
      }
      setSuccessNotice('Steam account disconnected successfully.');
      await loadStatus();
      if (onIdentityUpdated) {
        onIdentityUpdated(null);
      }
    } catch (err: any) {
      if (err instanceof SteamVerificationError) {
        setErrorMessage(getFriendlyErrorMessage(err.code, err.message));
      } else {
        setErrorMessage(err.message || 'Failed to disconnect Steam account.');
      }
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRefreshData = async () => {
    setErrorMessage(null);
    setSuccessNotice(null);
    setActionInProgress(true);

    try {
      const accId = privateAccount?.dotaAccountId || publicProfile?.dotaAccountId;
      if (accId) {
        // Ping OpenDota refresh endpoint
        await fetch(`/api/opendota/players/${accId}/refresh`, { method: 'POST' }).catch(() => {});
      }
      await loadStatus();
      setSuccessNotice('Account telemetry refreshed from OpenDota.');
    } catch {
      setErrorMessage('Failed to refresh match telemetry.');
    } finally {
      setActionInProgress(false);
    }
  };

  const isVerified = isOwner 
    ? Boolean(
        (privateAccount?.steamOwnershipVerified && privateAccount?.dotaAccountId) ||
        (resolvedAccount?.dotaAccountVerified && resolvedAccount?.dotaAccountId) ||
        (resolvedAccount?.dotaOwnershipVerified && resolvedAccount?.dotaAccountId)
      )
    : Boolean(
        (publicProfile?.steamOwnershipVerified && publicProfile?.dotaAccountId) ||
        (resolvedAccount?.dotaAccountVerified && resolvedAccount?.dotaAccountId) ||
        (resolvedAccount?.dotaOwnershipVerified && resolvedAccount?.dotaAccountId)
      );

  const steamId64Display = isOwner
    ? (privateAccount?.steamId64 
        ? maskSteamId64(privateAccount.steamId64) 
        : (resolvedAccount?.steamId ? maskSteamId64(resolvedAccount.steamId) : '•••••••••••••••••'))
    : (publicProfile?.steamId64Masked || (resolvedAccount?.steamId ? maskSteamId64(resolvedAccount.steamId) : '•••••••••••••••••'));

  const dotaAccountId = isOwner 
    ? (privateAccount?.dotaAccountId || resolvedAccount?.dotaAccountId) 
    : (publicProfile?.dotaAccountId || resolvedAccount?.dotaAccountId);

  const personaName = isOwner 
    ? (privateAccount?.steamPersonaName || resolvedAccount?.steamPersonaName || resolvedAccount?.dotaDisplayName) 
    : (publicProfile?.steamPersonaName || resolvedAccount?.steamPersonaName || resolvedAccount?.dotaDisplayName);

  const avatarUrl = isOwner 
    ? (privateAccount?.steamAvatarUrl || resolvedAccount?.dotaAvatar || resolvedAccount?.avatarUrl) 
    : (publicProfile?.steamAvatarUrl || resolvedAccount?.dotaAvatar || resolvedAccount?.avatarUrl);

  const publicMatchData = isOwner 
    ? (privateAccount?.publicMatchData || resolvedAccount?.publicMatchDataStatus || 'PUBLIC')
    : (publicProfile?.publicMatchData || resolvedAccount?.publicMatchDataStatus || 'PUBLIC');

  return (
    <div className="border-[3.5px] border-black bg-white shadow-[6px_6px_0px_0px_#000] overflow-hidden">
      {/* Header Banner */}
      <div className="bg-[#7C3AED] text-white p-5 border-b-[3.5px] border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider bg-[#FFE600] text-black px-2 py-0.5 border border-black">
              VALVE CORPORATION
            </span>
            <span className="text-[10px] font-bold text-purple-200 uppercase tracking-widest font-mono">
              OPENID 2.0 PROTOCOL
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase font-sans tracking-wide">
            CONNECTED GAME IDENTITY — DOTA 2
          </h3>
        </div>

        <div>
          {isVerified ? (
            <span className="bg-[#70FFAF] text-black text-xs font-black uppercase px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-900" />
              <span>STEAM & DOTA VERIFIED</span>
            </span>
          ) : (
            <span className="bg-[#FF6B6B] text-white text-xs font-black uppercase px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              STATUS: NOT LINKED
            </span>
          )}
        </div>
      </div>

      {/* Notification and Error Messages */}
      {errorMessage && (
        <div className="bg-[#FF6B6B]/20 border-b-2 border-black p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-red-900 leading-snug">
            {errorMessage}
          </div>
        </div>
      )}

      {successNotice && (
        <div className="bg-[#70FFAF]/30 border-b-2 border-black p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-800 shrink-0 mt-0.5" />
          <div className="text-xs font-bold text-emerald-950 leading-snug">
            {successNotice}
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="p-6">
        {loading ? (
          <div className="py-8 text-center font-mono text-xs font-bold text-stone-600 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-700" />
            <div>CHECKING STEAM VERIFICATION STATUS...</div>
          </div>
        ) : !isVerified ? (
          /* STATE: NOT LINKED */
          <div className="space-y-6">
            <div className="p-5 bg-stone-50 border-2 border-black space-y-3">
              <div className="flex items-center gap-2 text-stone-900">
                <ShieldCheck className="w-5 h-5 text-purple-700" />
                <h4 className="font-sans font-black text-sm uppercase tracking-wide">
                  Cryptographic Steam Ownership Handshake
                </h4>
              </div>
              <p className="text-xs text-stone-700 leading-relaxed font-sans">
                Verify ownership of your Dota 2 account through Steam. PurpleBeanGaming never receives your Steam password.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] font-mono text-stone-600">
                <div className="p-2 bg-white border border-black">✓ Official Steam OpenID 2.0</div>
                <div className="p-2 bg-white border border-black">✓ 1:1 Identity Claim Protection</div>
                <div className="p-2 bg-white border border-black">✓ Instant OpenDota Sync</div>
              </div>
            </div>

            {isOwner ? (
              <div className="space-y-3">
                <button
                  onClick={handleVerifyWithSteam}
                  disabled={actionInProgress}
                  className="w-full sm:w-auto px-8 py-3.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-sm font-black uppercase shadow-[4px_4px_0px_0px_#000] flex items-center justify-center gap-3 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                >
                  <Gamepad2 className="w-5 h-5" />
                  <span>{actionInProgress ? 'CONNECTING TO STEAM...' : 'VERIFY WITH STEAM'}</span>
                </button>
                <p className="text-[11px] text-stone-500 font-mono">
                  Opens official Valve Steam portal in a secure authentication window.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-stone-100 border border-black text-xs font-mono text-stone-600">
                This player has not yet connected and verified their Steam account.
              </div>
            )}
          </div>
        ) : (
          /* STATE: VERIFIED ACCOUNT CARD */
          <div className="space-y-6">
            <div className="border-2 border-black bg-stone-50 p-5 space-y-5">
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-4">
                <div className="flex items-center gap-4">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt="Steam Avatar" 
                      className="w-14 h-14 border-2 border-black shadow-[3px_3px_0px_0px_#000] object-cover bg-black"
                    />
                  ) : (
                    <div className="w-14 h-14 bg-purple-700 text-white border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center font-mono font-black text-xl">
                      D2
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="font-sans font-black text-lg uppercase text-black leading-tight">
                      {personaName || `Dota Player ${dotaAccountId}`}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#70FFAF] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-900" />
                        STEAM VERIFIED
                      </span>
                      <span className="bg-[#70FFAF] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-900" />
                        DOTA VERIFIED
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-[10px] font-mono text-stone-500 block uppercase font-bold">
                    VERIFICATION METHOD
                  </span>
                  <span className="font-mono text-xs font-black text-black">
                    STEAM OPENID 2.0
                  </span>
                </div>
              </div>

              {/* Identity Telemetry Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-[10px] font-mono text-stone-500 uppercase font-bold block">
                    STEAM64 IDENTIFIER
                  </span>
                  <strong className="font-mono text-xs text-black block tracking-wider mt-0.5">
                    {steamId64Display}
                  </strong>
                </div>

                <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-[10px] font-mono text-stone-500 uppercase font-bold block">
                    DOTA FRIEND ID (32-BIT)
                  </span>
                  <strong className="font-mono text-sm text-purple-700 block tracking-wider mt-0.5">
                    {dotaAccountId || 'Not Set'}
                  </strong>
                </div>

                <div className="p-3 bg-white border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-[10px] font-mono text-stone-500 uppercase font-bold block">
                    MATCH DATA VISIBILITY
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {publicMatchData === 'PUBLIC' ? (
                      <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 text-xs font-black font-mono border border-emerald-900">
                        PUBLIC
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 text-xs font-black font-mono border border-amber-900">
                        PRIVATE / UNAVAILABLE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Private Match Data Notice */}
              {publicMatchData !== 'PUBLIC' && (
                <div className="p-4 bg-[#FFF9E6] border-2 border-black text-xs font-sans text-stone-800 space-y-1">
                  <div className="font-black flex items-center gap-1.5 text-amber-900 uppercase">
                    <HelpCircle className="w-4 h-4 text-amber-800 shrink-0" />
                    <span>How to expose public match data</span>
                  </div>
                  <p className="leading-relaxed">
                    Open Dota 2 → Settings → Social → Enable <strong>"Expose Public Match Data"</strong>, then return here and refresh.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {dotaAccountId && (
                <button
                  onClick={() => onOpenGameProfile ? onOpenGameProfile(dotaAccountId) : window.open(`/game/dota2/players/${dotaAccountId}`, '_self')}
                  className="px-4 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                >
                  VIEW GAME PROFILE →
                </button>
              )}

              {privateAccount?.steamProfileUrl && (
                <a
                  href={privateAccount.steamProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>VIEW STEAM</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {dotaAccountId && (
                <a
                  href={`https://www.opendota.com/players/${dotaAccountId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <span>VIEW OPENDOTA</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              {isOwner && (
                <>
                  <button
                    onClick={handleRefreshData}
                    disabled={actionInProgress}
                    className="px-4 py-2.5 bg-white hover:bg-stone-100 text-stone-800 border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionInProgress ? 'animate-spin' : ''}`} />
                    <span>REFRESH DATA</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={actionInProgress}
                    className="px-4 py-2.5 bg-[#FF6B6B] hover:bg-red-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ml-auto"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>DISCONNECT</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
