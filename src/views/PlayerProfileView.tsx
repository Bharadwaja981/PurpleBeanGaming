import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trophy, 
  Shield, 
  User, 
  MapPin, 
  CheckCircle2, 
  Flame, 
  Star, 
  Award, 
  BarChart3,
  Swords,
  Crown,
  ExternalLink,
  Bot,
  Hash,
  Bell,
  Sparkles,
  Link2,
  Lock,
  Radio,
  Check,
  Edit3,
  RefreshCw,
  Copy,
  ChevronRight,
  Gamepad2,
  Calendar,
  Users,
  ShieldCheck,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { PBGPlayerAccount } from '../types/pbgAccount';
import { tournamentService } from '../services/firebaseService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { DiscordConnectModal } from '../components/DiscordConnectModal';
import { DotaLinkingModal } from '../components/dota/DotaLinkingModal';
import { ConnectedDotaIdentity } from '../components/dota/ConnectedDotaIdentity';
import { ConnectedDiscordIdentity } from '../components/ConnectedDiscordIdentity';
import { EditPBGProfileModal } from '../components/EditPBGProfileModal';
import { FirstTimeOnboardingModal } from '../components/FirstTimeOnboardingModal';
import { auth } from '../services/firebaseConfig';
import { fetchSteamLinkStatus, PrivateAccountStatus } from '../services/steamVerificationClient';
import { fetchDiscordLinkStatus } from '../services/discordVerificationClient';

interface PlayerProfileViewProps {
  playerId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export type ProfileTab = 
  | 'overview' 
  | 'career' 
  | 'tournaments' 
  | 'teams' 
  | 'game_info' 
  | 'identity' 
  | 'discord';

export function PlayerProfileView({ playerId, onNavigate }: PlayerProfileViewProps) {
  const [account, setAccount] = useState<PBGPlayerAccount>(() => {
    if (playerId) {
      const byPbg = pbgAccountRegistry.getAccountByPbgId(playerId);
      if (byPbg) return byPbg;
      const byUid = pbgAccountRegistry.getAccountByUid(playerId);
      if (byUid) return byUid;
      const byEmail = pbgAccountRegistry.getAccountByEmail(playerId);
      if (byEmail) return byEmail;
    }
    const cur = tournamentService.getCurrentPBGAccount();
    if (cur) return cur;
    const session = tournamentService.getCurrentUser();
    if (session.email) {
      const byEmail = pbgAccountRegistry.getAccountByEmail(session.email);
      if (byEmail) return byEmail;
    }
    return pbgAccountRegistry.getAccountByPbgId('PBG-000184')!;
  });

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [copiedPbgId, setCopiedPbgId] = useState(false);
  const [copiedDiscordId, setCopiedDiscordId] = useState(false);

  const currentUser = tournamentService.getCurrentPBGAccount();
  const sessionUser = tournamentService.getCurrentUser();
  const isOwner = !playerId || 
    (currentUser?.googleUid === account.googleUid) || 
    (currentUser?.pbgId === account.pbgId) ||
    (sessionUser.pbgId === account.pbgId) ||
    (sessionUser.email && sessionUser.email.toLowerCase() === account.email.toLowerCase()) ||
    (auth.currentUser?.uid === account.googleUid);

  // Modals state
  const [isDiscordModalOpen, setIsDiscordModalOpen] = useState(false);
  const [isDotaModalOpen, setIsDotaModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [serverAccount, setServerAccount] = useState<PrivateAccountStatus | null>(null);

  const refreshAccount = () => {
    if (playerId) {
      const byPbg = pbgAccountRegistry.getAccountByPbgId(playerId);
      if (byPbg) {
        setAccount(byPbg);
        return;
      }
      const byUid = pbgAccountRegistry.getAccountByUid(playerId);
      if (byUid) {
        setAccount(byUid);
        return;
      }
      const byEmail = pbgAccountRegistry.getAccountByEmail(playerId);
      if (byEmail) {
        setAccount(byEmail);
        return;
      }
    }
    const cur = tournamentService.getCurrentPBGAccount();
    if (cur) {
      setAccount(cur);
    } else {
      const session = tournamentService.getCurrentUser();
      const byEmail = session.email ? pbgAccountRegistry.getAccountByEmail(session.email) : undefined;
      if (byEmail) {
        setAccount(byEmail);
      } else {
        const base = pbgAccountRegistry.getAccountByPbgId('PBG-000184');
        if (base) setAccount(base);
      }
    }
  };

  // Keep synced with PBG registry changes & server-verified Steam identity
  useEffect(() => {
    const unsub = pbgAccountRegistry.subscribe(refreshAccount);
    refreshAccount();

    const checkServerSync = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const status = await fetchSteamLinkStatus(async () => await user.getIdToken(true));
        if (
          status.isOwner &&
          status.account &&
          status.account.steamOwnershipVerified &&
          status.account.dotaAccountId &&
          status.account.steamId64
        ) {
          setServerAccount(status.account);
          const synced = pbgAccountRegistry.syncVerifiedSteamAccount(user.uid, {
            steamId64: status.account.steamId64,
            dotaAccountId: status.account.dotaAccountId,
            steamPersonaName: status.account.steamPersonaName,
            steamAvatar: status.account.steamAvatarUrl,
            steamProfileUrl: status.account.steamProfileUrl,
            publicMatchDataStatus: status.account.publicMatchData || 'PUBLIC',
            rankTier: status.account.rankTier,
            leaderboardRank: status.account.leaderboardRank
          });
          if (synced) {
            setAccount({ ...synced });
          } else {
            refreshAccount();
          }
        }
      } catch {}

      try {
        const discordStatus = await fetchDiscordLinkStatus(async () => await user.getIdToken(true));
        if (discordStatus.account && discordStatus.account.discordLinked && discordStatus.account.discordUserId) {
          pbgAccountRegistry.linkDiscordAccount(user.uid, {
            discordUserId: discordStatus.account.discordUserId,
            discordUsername: discordStatus.account.discordUsername || 'player',
            discordDisplayName: discordStatus.account.discordDisplayName || undefined,
            discordAvatar: discordStatus.account.discordAvatarUrl || undefined
          });
          refreshAccount();
        }
      } catch {}
    };

    checkServerSync();
    return unsub;
  }, [playerId, account.googleUid]);

  const isDotaConnected = Boolean(
    account.dotaAccountLinked ||
    (isOwner && serverAccount?.steamOwnershipVerified)
  );
  const activeDotaId =
    account.dotaAccountId ||
    (isOwner && serverAccount?.dotaAccountId);
  const activeDotaVerified = Boolean(
    account.dotaAccountVerified ||
    (isOwner && serverAccount?.steamOwnershipVerified)
  );
  const activeOpenDotaProfile =
    account.openDotaProfile ||
    (activeDotaId ? `https://www.opendota.com/players/${activeDotaId}` : undefined);

  const handleIdentityUpdated = (newDotaId: string | null) => {
    refreshAccount();
    if (newDotaId && auth.currentUser) {
      fetchSteamLinkStatus(async () => await auth.currentUser!.getIdToken(true))
        .then((s) => s.account && setServerAccount(s.account))
        .catch(() => {});
    } else {
      setServerAccount(null);
    }
  };

  const copyToClipboard = (text: string, type: 'pbg' | 'discord') => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'pbg') {
        setCopiedPbgId(true);
        setTimeout(() => setCopiedPbgId(false), 2000);
      } else {
        setCopiedDiscordId(true);
        setTimeout(() => setCopiedDiscordId(false), 2000);
      }
    }
  };

  const checklist = pbgAccountRegistry.getEligibilityChecklist(account);

  const TABS: { id: ProfileTab; label: string; icon: React.ComponentType<any>; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: Trophy },
    { id: 'career', label: 'Career', icon: BarChart3 },
    { id: 'tournaments', label: 'Tournaments', icon: Award, badge: `${account.tournamentCount || 0} Cups` },
    { id: 'teams', label: 'Teams', icon: Users },
    { 
      id: 'game_info', 
      label: 'Game Info', 
      icon: Gamepad2, 
      badge: account.dotaAccountLinked ? 'Dota 2' : 'Connect' 
    },
    { id: 'identity', label: 'PBG Identity', icon: Lock },
    { 
      id: 'discord', 
      label: 'Discord Automation', 
      icon: Bot, 
      badge: account.discordLinked ? 'Linked' : 'Not Linked' 
    },
  ];

  return (
    <div className="space-y-6 font-mono animate-in fade-in duration-200 pb-16">
      
      {/* Top Breadcrumb & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('players')}
          className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Players</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Re-trigger Onboarding Walkthrough */}
          <button
            onClick={() => setIsOnboardingModalOpen(true)}
            className="px-3 py-1.5 bg-[#FFF9E6] hover:bg-[#FFE600] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
            title="Replay PBG First-Time Onboarding Experience"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden sm:inline">Onboarding Walkthrough</span>
          </button>

          {/* Edit Profile Button */}
          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-3 py-1.5 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-black" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: PERMANENT PLAYER PROFILE HEADER */}
      <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
        
        {/* Top Header Row */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b-2 border-black">
          
          {/* Avatar & Display Name */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <img
                src={account.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=pbg_player'}
                alt={account.displayName}
                className="w-20 h-20 sm:w-24 sm:h-24 bg-black border-[3.5px] border-black object-cover shadow-[4px_4px_0px_0px_#000]"
              />
              <span className={`absolute -bottom-2 -right-2 px-1.5 py-0.2 border-2 border-black text-[9px] font-black uppercase tracking-wider ${
                account.accountStatus === 'ACTIVE' ? 'bg-[#70FFAF] text-black' : 'bg-red-200 text-red-950'
              }`}>
                {account.accountStatus}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans leading-none tracking-tight">
                  {account.displayName}
                </h1>
                {checklist.isFullyReady && (
                  <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black text-[10px] font-black uppercase flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-black" />
                    <span>Tournament Ready</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 font-mono">
                <span className="flex items-center gap-1 font-bold text-stone-800">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  {account.city || 'Mumbai'}, {account.region} ({account.country}) 🇮🇳
                </span>
                <span>·</span>
                <span className="text-stone-500">Member since {new Date(account.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Permanent Unique PBG ID Plaque */}
          <div className="bg-[#FFF9E6] border-2 border-black p-3.5 sm:p-4 shadow-[4px_4px_0px_0px_#000] shrink-0 space-y-1 text-left sm:text-right">
            <span className="text-[10px] font-black uppercase text-stone-500 tracking-wider block">
              PERMANENT UNIQUE IDENTITY
            </span>
            <div className="flex items-center sm:justify-end gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-black bg-[#FFE600] px-2 py-0.5 border-2 border-black">
                {account.pbgId}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(account.pbgId, 'pbg')}
                className="p-1.5 bg-white hover:bg-stone-100 border-2 border-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                title="Copy PBG ID"
              >
                {copiedPbgId ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-black" />}
              </button>
            </div>
            <span className="text-[9px] text-stone-500 block">
              Authoritative PBG Player Identifier
            </span>
          </div>
        </div>

        {/* 4 Identity Pillars Grid (Google, Discord, Steam, Dota) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* 1. Google Identity */}
          <div className="bg-stone-50 border-2 border-black p-3.5 space-y-1.5 shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-stone-500 flex items-center gap-1">
                <span>🔐</span> GOOGLE AUTH
              </span>
              <span className="bg-[#70FFAF] text-black text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                CONNECTED
              </span>
            </div>
            <div className="font-mono text-xs font-bold text-black truncate">
              {account.email}
            </div>
            <div className="text-[10px] text-stone-500 truncate font-mono">
              UID: {account.googleUid.slice(0, 16)}...
            </div>
          </div>

          {/* 2. Discord Identity */}
          <div className={`border-2 border-black p-3.5 space-y-1.5 shadow-[2px_2px_0px_0px_#000] ${
            account.discordLinked ? 'bg-[#5865F2]/10 border-[#5865F2]' : 'bg-stone-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-stone-600 flex items-center gap-1">
                <span>👾</span> DISCORD IDENTITY
              </span>
              {account.discordLinked ? (
                <span className="bg-[#5865F2] text-white text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                  CONNECTED
                </span>
              ) : (
                <span className="bg-stone-200 text-stone-600 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                  NOT CONNECTED
                </span>
              )}
            </div>
            {account.discordLinked ? (
              <>
                <div className="font-mono text-xs font-black text-black flex items-center justify-between">
                  <span className="truncate">@{account.discordUsername || 'discord_user'}</span>
                  <button
                    onClick={() => copyToClipboard(account.discordUserId || '', 'discord')}
                    className="text-[9px] text-[#5865F2] hover:underline cursor-pointer flex items-center gap-1"
                    title="Copy Snowflake ID"
                  >
                    <span>ID: {account.discordUserId?.slice(0, 8)}...</span>
                    {copiedDiscordId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <div className="text-[10px] text-stone-500 truncate">
                  Role: Tournament Participant
                </div>
              </>
            ) : (
              <div className="pt-0.5">
                <button
                  onClick={() => setIsDiscordModalOpen(true)}
                  className="w-full py-1 px-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-[10px] font-black uppercase border border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Connect Discord (OAuth)
                </button>
              </div>
            )}
          </div>

          {/* 3. Steam & Dota Account */}
          <div className={`border-2 border-black p-3.5 space-y-1.5 shadow-[2px_2px_0px_0px_#000] ${
            isDotaConnected ? 'bg-blue-50 border-blue-900' : 'bg-stone-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-stone-600 flex items-center gap-1">
                <span>🎮</span> STEAM / DOTA 2
              </span>
              {activeDotaVerified ? (
                <span className="bg-[#70FFAF] text-black text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                  VERIFIED
                </span>
              ) : (
                <span className="bg-stone-200 text-stone-600 text-[9px] font-black uppercase px-1.5 py-0.2 border border-black">
                  NOT CONNECTED
                </span>
              )}
            </div>
            {isDotaConnected && activeDotaId ? (
              <>
                <div className="font-mono text-xs font-black text-black truncate flex items-center justify-between">
                  <span>Dota ID: {activeDotaId}</span>
                  <button 
                    onClick={() => onNavigate('dota_game_profile', account.pbgId)}
                    className="text-[9px] text-[#7C3AED] hover:underline font-black uppercase"
                  >
                    Stats →
                  </button>
                </div>
                <div className="text-[10px] text-stone-600 truncate flex items-center gap-1">
                  <a 
                    href={activeOpenDotaProfile || `https://www.opendota.com/players/${activeDotaId}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-700 hover:underline flex items-center gap-1"
                  >
                    <span>OpenDota Profile</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </>
            ) : (
              <div className="pt-0.5">
                <button
                  onClick={() => setIsDotaModalOpen(true)}
                  className="w-full py-1 px-2 bg-[#171a21] hover:bg-black text-white text-[10px] font-black uppercase border border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Connect Dota 2
                </button>
              </div>
            )}
          </div>

          {/* 4. Competitive Rating & MMR */}
          <div className="bg-stone-50 border-2 border-black p-3.5 space-y-1.5 shadow-[2px_2px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-stone-500 flex items-center gap-1">
                <span>🏆</span> PB RATING
              </span>
              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 border border-black ${
                account.purpleBeanRating === 'UNRATED' ? 'bg-stone-200 text-stone-700' : 'bg-[#FFE600] text-black'
              }`}>
                {account.purpleBeanRating}
              </span>
            </div>
            <div className="font-mono text-xs font-black text-black">
              {account.declaredMmr ? `${account.declaredMmr} MMR` : 'MMR: NOT SET'}
            </div>
            <div className="text-[10px] text-stone-600 truncate">
              {account.primaryRole ? account.primaryRole.split('—')[1]?.trim() || account.primaryRole : 'Role: Not Configured'}
            </div>
          </div>
        </div>

        {/* Major Profile Tabs Navigation: OVERVIEW, CAREER, TOURNAMENTS, TEAMS, GAME INFO */}
        <div className="flex flex-wrap gap-2 pt-2 border-t-2 border-black">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs font-black uppercase border-2 border-black flex items-center gap-2 cursor-pointer transition-all ${
                  isActive 
                    ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5' 
                    : 'bg-white hover:bg-stone-100 text-stone-800 shadow-[2px_2px_0px_0px_#000]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[9px] px-1.5 py-0.2 border border-black uppercase ${
                    tab.badge.includes('Linked') || tab.badge === 'Dota 2' ? 'bg-[#70FFAF] text-black' : 'bg-stone-100 text-stone-700'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Competitive Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-black p-4 space-y-1 shadow-[4px_4px_0px_0px_#000]">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Declared MMR</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-black">
                {account.declaredMmr || 'Not Set'}
              </span>
            </div>

            <div className="bg-white border-2 border-black p-4 space-y-1 shadow-[4px_4px_0px_0px_#000]">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Purple Bean Rating</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-purple-700">
                {account.purpleBeanRating}
              </span>
            </div>

            <div className="bg-white border-2 border-black p-4 space-y-1 shadow-[4px_4px_0px_0px_#000]">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Tournaments</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-black">
                {account.tournamentCount}
              </span>
            </div>

            <div className="bg-white border-2 border-black p-4 space-y-1 shadow-[4px_4px_0px_0px_#000]">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Matches Record</span>
              <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-700">
                {account.winsCount}W - {account.lossesCount}L
              </span>
            </div>
          </div>

          {/* Tournament Requirements Checklist */}
          <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-black" />
                <h3 className="font-sans text-lg font-black uppercase text-black">
                  Tournament Eligibility Checklist
                </h3>
              </div>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${
                checklist.isFullyReady ? 'bg-[#70FFAF] text-black' : 'bg-[#FFE600] text-black'
              }`}>
                {checklist.isFullyReady ? '✓ READY TO COMPETE' : 'PENDING REQUIREMENTS'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.pbgAccount ? 'bg-emerald-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.pbgAccount ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">PBG Account Active</span>
                </div>
                <strong className="font-mono text-[11px]">{account.pbgId}</strong>
              </div>

              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.discordConnected ? 'bg-emerald-50' : 'bg-[#FFF9E6]'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.discordConnected ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">Discord Connected</span>
                </div>
                {checklist.discordConnected ? (
                  <span className="text-[10px] text-emerald-800 font-mono font-bold">LINKED</span>
                ) : (
                  <button 
                    onClick={() => setIsDiscordModalOpen(true)}
                    className="text-[10px] text-[#5865F2] hover:underline font-black cursor-pointer"
                  >
                    Connect →
                  </button>
                )}
              </div>

              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.dotaConnected ? 'bg-emerald-50' : 'bg-[#FFF9E6]'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.dotaConnected ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">Dota Account Linked</span>
                </div>
                {checklist.dotaConnected ? (
                  <span className="text-[10px] text-emerald-800 font-mono font-bold">{account.dotaAccountId}</span>
                ) : (
                  <button 
                    onClick={() => setIsDotaModalOpen(true)}
                    className="text-[10px] text-blue-800 hover:underline font-black cursor-pointer"
                  >
                    Connect →
                  </button>
                )}
              </div>

              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.mmrSet ? 'bg-emerald-50' : 'bg-[#FFF9E6]'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.mmrSet ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">Tournament MMR</span>
                </div>
                <strong className="font-mono text-[11px]">{account.declaredMmr ? `${account.declaredMmr} MMR` : 'NOT SET'}</strong>
              </div>

              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.primaryRoleSet ? 'bg-emerald-50' : 'bg-[#FFF9E6]'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.primaryRoleSet ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">Primary Role</span>
                </div>
                <strong className="font-mono text-[10px] truncate max-w-[120px]">{account.primaryRole || 'NOT SET'}</strong>
              </div>

              <div className={`p-3 border-2 border-black flex items-center justify-between ${
                checklist.secondaryRoleSet ? 'bg-emerald-50' : 'bg-[#FFF9E6]'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${checklist.secondaryRoleSet ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="font-bold">Secondary Role</span>
                </div>
                <strong className="font-mono text-[10px] truncate max-w-[120px]">{account.secondaryRole || 'NOT SET'}</strong>
              </div>
            </div>
          </div>

          {/* Connected Game Identity Section (Dota 2 & Steam Verification) */}
          <ConnectedDotaIdentity
            targetUserId={account.googleUid}
            isOwner={isOwner}
            account={account}
            onIdentityUpdated={handleIdentityUpdated}
            onOpenGameProfile={() => onNavigate('dota_game_profile', account.pbgId)}
          />

          {/* Connected Discord Identity Section (OAuth 2.0 & Direct Connection) */}
          <ConnectedDiscordIdentity
            targetUserId={account.googleUid}
            isOwner={isOwner}
            account={account}
            onIdentityUpdated={() => refreshAccount()}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CAREER */}
      {/* ========================================================================= */}
      {activeTab === 'career' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            <div className="border-b-2 border-black pb-4">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                COMPETITIVE CALIBRATION & ROLES
              </span>
              <h3 className="font-sans text-2xl font-black uppercase text-black">
                Career Rating & Role Versatility
              </h3>
            </div>

            {/* Declared MMR & Roles Non-duplication rule */}
            <div className="border-2 border-black p-5 space-y-4 bg-white">
              <div className="flex items-center justify-between border-b border-black/10 pb-2">
                <h4 className="font-sans text-base font-black uppercase text-black flex items-center gap-2">
                  <Swords className="w-4 h-4 text-[#7C3AED]" />
                  <span>Declared MMR & Role Calibration</span>
                </h4>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs font-black text-purple-700 hover:underline cursor-pointer"
                >
                  Edit Roles →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Primary Role */}
                <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
                  <span className="text-[10px] font-black uppercase text-stone-500 block">PRIMARY ROLE</span>
                  <div className="text-lg font-black text-black">
                    {account.primaryRole || 'Position 1 — Carry (Default)'}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Primary draft nomination preference in competitive auction pools.
                  </p>
                </div>

                {/* Secondary Role */}
                <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
                  <span className="text-[10px] font-black uppercase text-stone-500 block">SECONDARY ROLE (DISTINCT)</span>
                  <div className="text-lg font-black text-black">
                    {account.secondaryRole || 'Position 2 — Mid (Default)'}
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Enforced constraint: Primary and Secondary Role cannot be the same position.
                  </p>
                </div>
              </div>

              {/* Roles Matrix List */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2 text-[11px]">
                {[
                  { pos: 'P1', role: 'Carry', active: account.primaryRole?.includes('Position 1') || account.secondaryRole?.includes('Position 1') },
                  { pos: 'P2', role: 'Mid', active: account.primaryRole?.includes('Position 2') || account.secondaryRole?.includes('Position 2') },
                  { pos: 'P3', role: 'Offlane', active: account.primaryRole?.includes('Position 3') || account.secondaryRole?.includes('Position 3') },
                  { pos: 'P4', role: 'Soft Support', active: account.primaryRole?.includes('Position 4') || account.secondaryRole?.includes('Position 4') },
                  { pos: 'P5', role: 'Hard Support', active: account.primaryRole?.includes('Position 5') || account.secondaryRole?.includes('Position 5') }
                ].map((r) => (
                  <div key={r.pos} className={`p-2 border-2 border-black text-center ${
                    r.active ? 'bg-[#FFE600] font-black text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-stone-50 text-stone-400'
                  }`}>
                    <strong className="block text-sm">{r.pos}</strong>
                    <span>{r.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Captaincy History */}
            <div className="border-2 border-black p-5 space-y-3 bg-white">
              <h4 className="font-sans text-base font-black uppercase text-black flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-500" />
                <span>Captaincy & Auction History</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-stone-50 border border-black">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Captain Nominations</span>
                  <strong className="text-lg font-black text-black font-mono">1 Cup</strong>
                </div>
                <div className="p-3 bg-stone-50 border border-black">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Auction Purse Used</span>
                  <strong className="text-lg font-black text-purple-700 font-mono">9,200 Credits</strong>
                </div>
                <div className="p-3 bg-stone-50 border border-black">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Captain Win Rate</span>
                  <strong className="text-lg font-black text-emerald-700 font-mono">66.7%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TOURNAMENTS */}
      {/* ========================================================================= */}
      {activeTab === 'tournaments' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            <div className="border-b-2 border-black pb-4">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                COMPETITIVE CIRCUIT PLACEMENTS
              </span>
              <h3 className="font-sans text-2xl font-black uppercase text-black">
                Tournament History
              </h3>
            </div>

            {account.tournamentHistory && account.tournamentHistory.length > 0 ? (
              <div className="space-y-3">
                {account.tournamentHistory.map((th) => (
                  <div key={th.id} className="p-4 bg-stone-50 border-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <strong className="text-black text-sm block font-sans">{th.name}</strong>
                      <span className="text-stone-500 text-[11px]">Team: {th.teamName} · Role: {th.role}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-[#FFE600] border-2 border-black font-black uppercase text-[10px] shadow-[2px_2px_0px_0px_#000]">
                        {th.placement || 'Participant'}
                      </span>
                      <span className="text-stone-500 text-[11px] font-mono">{th.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-500 space-y-2">
                <p>New Player: No competitive tournaments logged yet on {account.pbgId}.</p>
                <button
                  onClick={() => onNavigate('tournaments')}
                  className="px-4 py-2 bg-[#FFE600] text-black font-bold uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Browse Open Tournaments
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEAMS */}
      {/* ========================================================================= */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            <div className="border-b-2 border-black pb-4">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                ROSTER & FRANCHISE HISTORY
              </span>
              <h3 className="font-sans text-2xl font-black uppercase text-black">
                Teams & Franchises
              </h3>
            </div>

            {account.teamHistory && account.teamHistory.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {account.teamHistory.map((tm) => (
                  <div key={tm.id} className="p-4 bg-white border-2 border-black text-xs space-y-2 shadow-[3px_3px_0px_0px_#000]">
                    <div className="flex items-center justify-between">
                      <strong className="text-black block text-base font-sans font-black">{tm.name} [{tm.tag}]</strong>
                      <span className="bg-[#FFE600] px-2 py-0.5 border border-black font-black text-[9px] uppercase">
                        {tm.role}
                      </span>
                    </div>
                    <div className="text-stone-600 text-[11px]">Period: {tm.period}</div>
                    <div className="pt-2 border-t border-black/10 flex items-center justify-between">
                      <span className="text-[10px] text-stone-500">Franchise Status: Active</span>
                      <button 
                        onClick={() => onNavigate('teams')}
                        className="text-[10px] text-[#7C3AED] hover:underline font-bold"
                      >
                        View Team Roster →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
                Free Agent · Not currently signed to any franchised roster.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: GAME INFO (PROMPT SECTION 2) */}
      {/* ========================================================================= */}
      {activeTab === 'game_info' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            
            {/* Header info */}
            <div className="border-b-2 border-black pb-4">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                SECTION 2 · CONNECTED & SUPPORTED GAMES
              </span>
              <h3 className="font-sans text-2xl font-black uppercase text-black">
                Game Info
              </h3>
              <p className="text-xs text-stone-600 mt-1">
                Displaying connected esports titles. PurpleBeanGaming binds your official game IDs and Steam accounts to your permanent PBG ID ({account.pbgId}), enabling OpenDota match analytics, auction valuation, and automated lobby passwords.
              </p>
            </div>

            {/* Grid of Large Game Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CARD 1: DOTA 2 (Connected Game Identity with Authentic Steam OpenID) */}
              <ConnectedDotaIdentity
                targetUserId={account.googleUid}
                isOwner={isOwner}
                account={account}
                onIdentityUpdated={handleIdentityUpdated}
                onOpenGameProfile={() => onNavigate('dota_game_profile', account.pbgId)}
              />

              {/* CARD 2: COUNTER-STRIKE 2 (Extensible Architecture) */}
              <div className="border-[3.5px] border-black bg-white shadow-[6px_6px_0px_0px_#000] flex flex-col justify-between overflow-hidden opacity-90">
                <div className="bg-[#de9b35] text-black p-5 border-b-[3px] border-black space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                      <span>🎯</span> VALVE CORPORATION
                    </span>
                    <span className="bg-black text-[#FFE600] text-[9px] font-black uppercase px-2 py-0.5 border border-black">
                      COMING SOON
                    </span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-wide text-black">
                    COUNTER-STRIKE 2
                  </h4>
                  <p className="text-[11px] text-stone-900 font-bold">
                    CS2 Premier & 5v5 Tactical Matchmaking
                  </p>
                </div>

                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="p-4 bg-stone-50 border-2 border-black font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">Steam:</span>
                        <span className="font-black text-black">
                          {account.dotaAccountLinked ? 'Steam Verified' : 'Not Connected'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">CS2 Rating:</span>
                        <span className="font-black text-stone-500">Unrated</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600 font-bold">Circuit Status:</span>
                        <span className="font-bold text-amber-800 text-[10px]">Phase 2 Integration</span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 font-sans">
                      Competitive CS2 tournament brackets and live captain auctions will automatically link with your verified Steam ID.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      disabled
                      className="w-full py-2.5 px-4 bg-stone-200 text-stone-500 border-2 border-stone-400 font-mono text-xs font-black uppercase cursor-not-allowed text-center"
                    >
                      CIRCUIT IN DEVELOPMENT
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 3: VALORANT */}
              <div className="border-[3.5px] border-black bg-white shadow-[6px_6px_0px_0px_#000] flex flex-col justify-between overflow-hidden opacity-90">
                <div className="bg-[#ff4655] text-white p-5 border-b-[3px] border-black space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/90 flex items-center gap-1.5">
                      <span>⚡</span> RIOT GAMES
                    </span>
                    <span className="bg-white text-[#ff4655] text-[9px] font-black uppercase px-2 py-0.5 border border-black">
                      PHASE 2
                    </span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-wide text-white">
                    VALORANT
                  </h4>
                  <p className="text-[11px] text-white/80">
                    Riot ID & VCT Community Circuits
                  </p>
                </div>

                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="p-4 bg-stone-50 border-2 border-black font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">Riot ID:</span>
                        <span className="font-black text-stone-500">Not Connected</span>
                      </div>
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">Rank Tier:</span>
                        <span className="font-black text-stone-500">Uncalibrated</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600 font-bold">Regional Server:</span>
                        <span className="font-bold text-stone-700 text-[10px]">Mumbai (AP)</span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 font-sans">
                      Connect your Riot account to unlock premier Agent pools, tracker stats, and Indian collegiate cups.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      disabled
                      className="w-full py-2.5 px-4 bg-stone-200 text-stone-500 border-2 border-stone-400 font-mono text-xs font-black uppercase cursor-not-allowed text-center"
                    >
                      RIOT AUTH INTEGRATION
                    </button>
                  </div>
                </div>
              </div>

              {/* CARD 4: BGMI */}
              <div className="border-[3.5px] border-black bg-white shadow-[6px_6px_0px_0px_#000] flex flex-col justify-between overflow-hidden opacity-90">
                <div className="bg-[#2a9d8f] text-white p-5 border-b-[3px] border-black space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/90 flex items-center gap-1.5">
                      <span>📱</span> KRAFTON
                    </span>
                    <span className="bg-black text-[#70FFAF] text-[9px] font-black uppercase px-2 py-0.5 border border-black">
                      PHASE 3
                    </span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-wide text-white">
                    BGMI
                  </h4>
                  <p className="text-[11px] text-white/80">
                    Battlegrounds Mobile India Squad Lobbies
                  </p>
                </div>

                <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="p-4 bg-stone-50 border-2 border-black font-mono text-xs space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">Character ID:</span>
                        <span className="font-black text-stone-500">Not Connected</span>
                      </div>
                      <div className="flex items-center justify-between pb-1 border-b border-black/10">
                        <span className="text-stone-600 font-bold">Tier / Rank:</span>
                        <span className="font-black text-stone-500">Ace / Conqueror</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-stone-600 font-bold">Lobby System:</span>
                        <span className="font-bold text-stone-700 text-[10px]">Custom Room Codes</span>
                      </div>
                    </div>

                    <p className="text-xs text-stone-600 font-sans">
                      Automated 16-team point table aggregation and custom mobile lobby room code notifications.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      disabled
                      className="w-full py-2.5 px-4 bg-stone-200 text-stone-500 border-2 border-stone-400 font-mono text-xs font-black uppercase cursor-not-allowed text-center"
                    >
                      MOBILE CIRCUIT COMING SOON
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Extensible Architecture Explanation Box */}
            <div className="p-5 bg-[#FFF9E6] border-2 border-black font-mono text-xs space-y-2">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                EXTENSIBLE MULTI-GAME ARCHITECTURE
              </span>
              <p className="text-stone-800 leading-relaxed">
                PurpleBeanGaming isolates the player's unified platform identity ({account.pbgId}) from specific game providers (OpenDota, Valve Steamworks, Riot Client, Krafton API). Additional competitive games can be connected and verified without altering tournament brackets, auction algorithms, or player profiles.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: PBG IDENTITY */}
      {/* ========================================================================= */}
      {activeTab === 'identity' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            <div className="border-b-2 border-black pb-4">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                SECTION 12 · UNIFIED ARCHITECTURE
              </span>
              <h3 className="font-sans text-2xl font-black uppercase text-black">
                Core Identity Structure
              </h3>
              <p className="text-xs text-stone-600 mt-1 max-w-2xl">
                The permanent PBG ID is the authoritative anchor of the player's competitive career. Google is used for login; Discord is used for communication and tournament automation; Steam and Dota establish verified competitive match records.
              </p>
            </div>

            {/* Tree Diagram Visual Box */}
            <div className="bg-[#FFF9E6] border-2 border-black p-6 space-y-4 font-mono text-xs">
              <div className="flex items-center gap-3 bg-black text-[#FFE600] p-4 border-2 border-black shadow-[3px_3px_0px_0px_#FFE600]">
                <div className="w-10 h-10 bg-[#FFE600] text-black border border-black flex items-center justify-center font-black text-xl">
                  👑
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider block text-yellow-300">CENTRAL PBG ACCOUNT ROOT</span>
                  <div className="text-lg font-black tracking-widest">{account.pbgId} · {account.displayName}</div>
                </div>
              </div>

              {/* Tree Branches */}
              <div className="pl-4 sm:pl-8 space-y-4 border-l-4 border-black relative">
                {/* Branch 1: Google Identity */}
                <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-black flex items-center gap-2">
                      <span className="text-stone-400">├──</span> Google Identity (Authentication)
                    </span>
                    <span className="bg-[#70FFAF] text-black text-[9px] font-black px-1.5 py-0.2 border border-black">
                      ACTIVE
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 text-stone-700">
                    <div>Email: <strong className="text-black">{account.email}</strong></div>
                    <div>UID: <span className="font-mono">{account.googleUid.slice(0, 16)}...</span></div>
                    <div>Created: <span>{new Date(account.createdAt).toLocaleDateString()}</span></div>
                  </div>
                </div>

                {/* Branch 2: Discord Identity */}
                <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-black flex items-center gap-2">
                      <span className="text-stone-400">├──</span> Discord Identity (Community & Tournament Automation)
                    </span>
                    {account.discordLinked ? (
                      <span className="bg-[#5865F2] text-white text-[9px] font-black px-1.5 py-0.2 border border-black">
                        LINKED (SNOWFLAKE ID)
                      </span>
                    ) : (
                      <button
                        onClick={() => setIsDiscordModalOpen(true)}
                        className="bg-[#5865F2] text-white text-[9px] font-black px-2 py-0.5 border border-black cursor-pointer"
                      >
                        Connect Discord →
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 text-stone-700">
                    <div>
                      Snowflake ID: <strong className="font-mono text-black">{account.discordUserId || 'Not Connected'}</strong>
                    </div>
                    <div>Username: <span>{account.discordUsername ? `@${account.discordUsername}` : 'None'}</span></div>
                    <div>Status: <span className="text-purple-700 font-bold">{account.discordLinked ? 'Role Sync Active' : 'Disconnected'}</span></div>
                  </div>
                </div>

                {/* Branch 3: Steam Identity */}
                <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-black flex items-center gap-2">
                      <span className="text-stone-400">├──</span> Steam Identity (Esports & Match Lobbies)
                    </span>
                    {account.dotaAccountLinked ? (
                      <span className="bg-[#70FFAF] text-black text-[9px] font-black px-1.5 py-0.2 border border-black">
                        STEAM64 VERIFIED
                      </span>
                    ) : (
                      <button
                        onClick={() => setIsDotaModalOpen(true)}
                        className="bg-[#171a21] text-white text-[9px] font-black px-2 py-0.5 border border-black cursor-pointer"
                      >
                        Connect Steam →
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 text-stone-700">
                    <div>Steam64 ID: <strong className="font-mono text-black">{account.steamId || 'Not Linked'}</strong></div>
                    <div>Steam Community: <span>{account.steamId ? `steamcommunity.com/profiles/${account.steamId}` : 'Not Set'}</span></div>
                  </div>
                </div>

                {/* Branch 4: Dota Identity */}
                <div className="bg-white border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-black flex items-center gap-2">
                      <span className="text-stone-400">└──</span> Dota Identity (Competitive Calibration & OpenDota)
                    </span>
                    {account.dotaAccountVerified ? (
                      <span className="bg-[#70FFAF] text-black text-[9px] font-black px-1.5 py-0.2 border border-black">
                        DOTA VERIFIED
                      </span>
                    ) : (
                      <span className="bg-stone-200 text-stone-600 text-[9px] font-black px-1.5 py-0.2 border border-black">
                        PENDING
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] pt-1 text-stone-700">
                    <div>Friend ID: <strong className="font-mono text-black">{account.dotaAccountId || 'Not Set'}</strong></div>
                    <div>MMR: <strong className="text-black">{account.declaredMmr ? `${account.declaredMmr}` : 'Not Calibrated'}</strong></div>
                    <div>
                      Match Data: <span className="font-bold text-emerald-700">{account.publicMatchDataStatus || 'PUBLIC'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6 & 11: 1:1 Unique Account Enforcements */}
            <div className="border-2 border-black p-5 space-y-3 bg-stone-50">
              <span className="text-[10px] font-black uppercase text-stone-500 block">
                SECTION 6 · ENFORCED UNIQUE ACCOUNT INTEGRITY
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white border border-black space-y-1">
                  <strong className="text-black block font-bold">1 Steam Account = 1 PBG Account</strong>
                  <p className="text-stone-600 text-[11px]">
                    Steam accounts cannot be shared between multiple contenders. Prevents dual-team entries in competitive tournaments.
                  </p>
                </div>
                <div className="p-3 bg-white border border-black space-y-1">
                  <strong className="text-black block font-bold">1 Dota Account ID = 1 PBG Account</strong>
                  <p className="text-stone-600 text-[11px]">
                    The same Dota 32-bit Friend ID cannot simultaneously link to more than one PBG profile.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: DISCORD AUTOMATION */}
      {/* ========================================================================= */}
      {activeTab === 'discord' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[8px_8px_0px_0px_#000] space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-stone-500 block">
                  SECTIONS 3, 4, 5, 6, 7 · DISCORD TOURNAMENT AUTOMATION
                </span>
                <h3 className="font-sans text-2xl font-black uppercase text-black">
                  Discord Integration & Bot Engine
                </h3>
              </div>
              <button
                onClick={() => setIsDiscordModalOpen(true)}
                className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
              >
                <span>👾</span>
                <span>{account.discordLinked ? 'Manage Discord Link' : 'Connect Discord (OAuth)'}</span>
              </button>
            </div>

            {/* Connected Discord Identity Card */}
            <ConnectedDiscordIdentity
              targetUserId={account.googleUid}
              isOwner={isOwner}
              account={account}
              onIdentityUpdated={() => refreshAccount()}
            />

            {/* Section 6: Dynamic Discord Roles */}
            <div className="border-2 border-black p-5 space-y-4 bg-white">
              <h4 className="font-sans text-base font-black uppercase text-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#5865F2]" />
                <span>Section 6 · Tournament Discord Roles Auto-Assigned</span>
              </h4>
              <p className="text-xs text-stone-600">
                When a player enters a tournament, the PurpleBeanGaming Discord bot automatically synchronizes permissions and assigns contextual server roles:
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { name: 'Tournament Participant', color: 'bg-emerald-100 text-emerald-950 border-emerald-500' },
                  { name: 'Captain', color: 'bg-amber-100 text-amber-950 border-amber-500' },
                  { name: 'Team Member', color: 'bg-blue-100 text-blue-950 border-blue-500' },
                  { name: 'Stand-In', color: 'bg-stone-200 text-stone-800 border-stone-500' },
                  { name: 'Organizer', color: 'bg-purple-100 text-purple-950 border-purple-500' },
                  { name: 'Referee', color: 'bg-red-100 text-red-950 border-red-500' },
                  { name: 'Purple Bean Open — Participant', color: 'bg-[#FFE600]/30 text-stone-900 border-black' },
                  { name: 'Mumbai Mavericks', color: 'bg-[#5865F2]/20 text-[#5865F2] border-[#5865F2]' },
                  { name: 'Hyderabad Raiders', color: 'bg-[#FF5757]/20 text-red-900 border-red-500' },
                ].map((r) => (
                  <span key={r.name} className={`px-2.5 py-1 text-xs font-bold font-mono border ${r.color} shadow-[2px_2px_0px_0px_#000]`}>
                    @{r.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Section 7: Tournament Discord Channels */}
            <div className="border-2 border-black p-5 space-y-4 bg-white">
              <h4 className="font-sans text-base font-black uppercase text-black flex items-center gap-2">
                <Hash className="w-4 h-4 text-black" />
                <span>Section 7 · Tournament Discord Channels & Bot Dispatch Preview</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {['#tournament-news', '#tournament-brackets', '#match-schedule', '#match-results', '#auction-room', '#team-lobbies'].map((ch) => (
                  <div key={ch} className="p-2.5 bg-white border-2 border-black flex items-center gap-2 font-mono font-bold">
                    <Hash className="w-3.5 h-3.5 text-[#5865F2]" />
                    <span>{ch}</span>
                  </div>
                ))}
              </div>

              {/* Bot Message Preview Box */}
              <div className="bg-[#2B2D31] text-white p-4 border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2 text-xs mt-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 bg-[#5865F2] text-white flex items-center justify-center rounded-full text-[10px]">👾</span>
                  <span className="font-bold text-white">PBG Tournament Bot</span>
                  <span className="bg-[#5865F2] text-[9px] px-1 py-0.2 rounded font-black">BOT</span>
                  <span className="text-[10px] text-stone-400">Today at 7:00 PM</span>
                </div>
                <div className="pl-7 space-y-1.5">
                  <div className="bg-[#1E1F22] border-l-4 border-[#FFE600] p-3 space-y-1">
                    <span className="text-[#FFE600] font-bold text-[11px] uppercase block">UPPER BRACKET — ROUND 1</span>
                    <strong className="text-white text-sm block">Mumbai Mavericks vs Hyderabad Raiders</strong>
                    <div className="text-[11px] text-stone-300">Format: Best of 3 · Saturday 7:00 PM IST</div>
                    <div className="text-[11px] text-[#00F0FF] pt-1">
                      Match Lobby: Dota 2 Lobby password dispatched to captains.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: What Discord Integration Will Be Used For */}
            <div className="border-2 border-black p-5 space-y-3 bg-white">
              <h4 className="font-sans text-base font-black uppercase text-black flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-700" />
                <span>Section 5 · Discord Tournament Automations</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px]">
                {[
                  'Tournament Registration Confirmation',
                  'Tournament Announcements',
                  'Captain Selection Notifications',
                  'Auction Starting Notifications',
                  'Auction Results & Winning Lots',
                  'Team Formation Updates',
                  'Bracket Announcements',
                  'Upcoming Match Notifications',
                  'Match Lobby Information',
                  'Opponent Information',
                  'Match Check-In Alerts',
                  'Match Result Updates',
                  'Bracket Progression & Movement',
                  'Grand Final Notifications'
                ].map((item, idx) => (
                  <div key={item} className="p-2 bg-stone-50 border border-black flex items-center gap-2">
                    <span className="w-4 h-4 bg-black text-[#FFE600] text-[9px] font-black flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-stone-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CONNECT & EDIT MODALS */}
      {/* ========================================================================= */}
      {isDiscordModalOpen && (
        <DiscordConnectModal
          isOpen={isDiscordModalOpen}
          onClose={() => setIsDiscordModalOpen(false)}
          account={account}
          onLinked={(updated) => setAccount(updated)}
        />
      )}

      {/* Dedicated Dota 2 Linking & Ownership Verification Modal */}
      {isDotaModalOpen && (
        <DotaLinkingModal
          isOpen={isDotaModalOpen}
          onClose={() => setIsDotaModalOpen(false)}
          account={account}
          onLinked={(updated) => setAccount(updated)}
        />
      )}

      {isEditModalOpen && (
        <EditPBGProfileModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          account={account}
          onSaved={(updated) => setAccount(updated)}
          onOpenDiscordModal={() => {
            setIsEditModalOpen(false);
            setIsDiscordModalOpen(true);
          }}
          onOpenSteamModal={() => {
            setIsEditModalOpen(false);
            setIsDotaModalOpen(true);
          }}
        />
      )}

      {isOnboardingModalOpen && (
        <FirstTimeOnboardingModal
          isOpen={isOnboardingModalOpen}
          onClose={() => {
            pbgAccountRegistry.completeOnboarding(account.googleUid);
            tournamentService.markOnboardingCompleted(account.googleUid);
            setIsOnboardingModalOpen(false);
          }}
          account={account}
          onComplete={(updated) => {
            pbgAccountRegistry.completeOnboarding(updated.googleUid);
            tournamentService.markOnboardingCompleted(updated.googleUid);
            setAccount(updated);
          }}
        />
      )}
    </div>
  );
}
