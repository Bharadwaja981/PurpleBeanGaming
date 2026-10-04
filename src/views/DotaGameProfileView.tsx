import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  ShieldCheckIcon,
  LinkIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  UsersIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { tournamentService } from '../services/firebaseService';
import { PBGPlayerAccount } from '../types/pbgAccount';
import { 
  openDotaService, 
  OpenDotaPlayerSummary, 
  OpenDotaMatchSnapshot,
  OpenDotaProEncounter,
  OpenDotaCounts,
  OpenDotaHistogramItem,
  OpenDotaWardmap,
  OpenDotaWordcloud,
  OpenDotaRatingTimelineItem,
  OpenDotaHeroRanking,
  OpenDotaPeer,
  getRankTierName
} from '../services/openDotaService';
import { DotaRankMedal } from '../components/dota/DotaRankMedal';
import { DotaGlobalFilters, DotaFilterState, INITIAL_DOTA_FILTERS } from '../components/dota/DotaGlobalFilters';
import { DotaHeroDetailModal } from '../components/dota/DotaHeroDetailModal';
import { DotaLinkingModal } from '../components/dota/DotaLinkingModal';
import { auth } from '../services/firebaseConfig';
import { fetchSteamLinkStatus } from '../services/steamVerificationClient';
import { resolvePlayerAccount } from './PlayerProfileView';

// Sub-tabs
import { DotaOverviewTab } from '../components/dota/tabs/DotaOverviewTab';
import { DotaMatchesTab } from '../components/dota/tabs/DotaMatchesTab';
import { DotaHeroesTab } from '../components/dota/tabs/DotaHeroesTab';
import { DotaTeammatesTab } from '../components/dota/tabs/DotaTeammatesTab';
import { DotaProsTab } from '../components/dota/tabs/DotaProsTab';
import { DotaRecordsTab } from '../components/dota/tabs/DotaRecordsTab';
import { DotaTotalsTab } from '../components/dota/tabs/DotaTotalsTab';
import { DotaCountsTab } from '../components/dota/tabs/DotaCountsTab';
import { DotaHistogramsTab } from '../components/dota/tabs/DotaHistogramsTab';
import { DotaTrendsTab } from '../components/dota/tabs/DotaTrendsTab';
import { DotaWardmapTab } from '../components/dota/tabs/DotaWardmapTab';
import { DotaWordcloudTab } from '../components/dota/tabs/DotaWordcloudTab';
import { DotaRankHistoryTab } from '../components/dota/tabs/DotaRankHistoryTab';
import { DotaHeroRankingsTab } from '../components/dota/tabs/DotaHeroRankingsTab';
import { DotaActivityTab } from '../components/dota/tabs/DotaActivityTab';

interface DotaGameProfileViewProps {
  pbgId?: string; // can be PBG ID, Google UID, or generic Dota Account ID
  onNavigateBack: () => void;
  onNavigateToTournament?: (tournamentId: string) => void;
  onSelectPlayer?: (accountId: string) => void;
  onNavigateToPbgProfile?: (pbgId: string) => void;
  onOpenMatchDetail?: (matchId: string) => void;
}

export type DotaSubTab = 
  | 'overview' 
  | 'matches' 
  | 'heroes' 
  | 'teammates' 
  | 'pros' 
  | 'records' 
  | 'totals' 
  | 'counts' 
  | 'histograms' 
  | 'trends' 
  | 'vision' 
  | 'wordcloud' 
  | 'rank_history' 
  | 'hero_rankings' 
  | 'activity';

const SUB_TABS: { id: DotaSubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'matches', label: 'Matches' },
  { id: 'heroes', label: 'Heroes' },
  { id: 'teammates', label: 'Teammates' },
  { id: 'pros', label: 'Pro Encounters' },
  { id: 'records', label: 'Records' },
  { id: 'totals', label: 'Totals' },
  { id: 'counts', label: 'Counts' },
  { id: 'histograms', label: 'Histograms' },
  { id: 'trends', label: 'Trends' },
  { id: 'vision', label: 'Vision / Wardmap' },
  { id: 'wordcloud', label: 'Word Cloud' },
  { id: 'rank_history', label: 'Rank History' },
  { id: 'hero_rankings', label: 'Hero Rankings' },
  { id: 'activity', label: 'Activity' }
];

export function DotaGameProfileView({
  pbgId,
  onNavigateBack,
  onSelectPlayer,
  onNavigateToPbgProfile,
  onOpenMatchDetail
}: DotaGameProfileViewProps) {
  // Target resolver supporting both PBG Accounts, synthesized contender profiles, and generic OpenDota IDs
  const resolveTarget = (targetId?: string): { dotaId: string; pbgAccount: PBGPlayerAccount | null } => {
    if (targetId && targetId.trim()) {
      const clean = targetId.trim();

      // 1. Direct check in PBG Account registry by PBG ID, UID, or Dota ID
      const byPbg = pbgAccountRegistry.getAccountByPbgId(clean);
      if (byPbg) return { dotaId: byPbg.dotaAccountId || '', pbgAccount: byPbg };

      const byUid = pbgAccountRegistry.getAccountByUid(clean);
      if (byUid) return { dotaId: byUid.dotaAccountId || '', pbgAccount: byUid };

      const byDota = pbgAccountRegistry.getAccountByDotaId(clean);
      if (byDota) return { dotaId: clean, pbgAccount: byDota };

      // 2. Check if clean is a pure numeric string (32-bit Dota friend ID, e.g. 100003031)
      if (/^\d{5,10}$/.test(clean)) {
        const resolvedByDota = resolvePlayerAccount(clean);
        return { 
          dotaId: clean, 
          pbgAccount: (resolvedByDota && (resolvedByDota.dotaAccountId === clean || resolvedByDota.pbgId === clean)) ? resolvedByDota : null 
        };
      }

      // 3. Resolve via multi-tier player resolver (handles registrations, mock players, synthesized PBG accounts)
      const resolved = resolvePlayerAccount(clean);
      if (resolved) {
        return {
          dotaId: resolved.dotaAccountId || clean,
          pbgAccount: resolved
        };
      }

      return { dotaId: clean, pbgAccount: null };
    }

    // 4. ONLY if NO targetId was passed (viewing own profile via navbar):
    const current = tournamentService.getCurrentPBGAccount();
    if (current && current.dotaAccountId) {
      return { dotaId: current.dotaAccountId, pbgAccount: current };
    }
    return { dotaId: current?.dotaAccountId || '', pbgAccount: current || null };
  };

  const initial = resolveTarget(pbgId);
  const [activeDotaId, setActiveDotaId] = useState<string>(initial.dotaId);
  const [activePbgAccount, setActivePbgAccount] = useState<PBGPlayerAccount | null>(initial.pbgAccount);
  const [searchTargetId, setSearchTargetId] = useState('');

  useEffect(() => {
    const res = resolveTarget(pbgId);
    setActiveDotaId(res.dotaId);
    setActivePbgAccount(res.pbgAccount);

    // CRITICAL FIX: Only run background server Steam sync if viewing YOUR OWN profile with NO pbgId!
    // Never run checkSteamSync when inspecting another player's Dota profile!
    const user = auth.currentUser;
    if (!pbgId && !res.dotaId && user) {
      fetchSteamLinkStatus(async () => await user.getIdToken().catch(() => ''))
        .then((status) => {
          if (
            status.isOwner &&
            status.account &&
            status.account.steamOwnershipVerified &&
            status.account.dotaAccountId &&
            status.account.steamId64
          ) {
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
            setActiveDotaId(status.account.dotaAccountId);
            if (synced) setActivePbgAccount(synced);
          }
        })
        .catch(() => {});
    }
  }, [pbgId]);

  const [activeTab, setActiveTab] = useState<DotaSubTab>('overview');
  const [filters, setFilters] = useState<DotaFilterState>(INITIAL_DOTA_FILTERS);

  // Primary Data states
  const [playerData, setPlayerData] = useState<OpenDotaPlayerSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCooldown, setRefreshCooldown] = useState(0);

  // Lazy loaded states
  const [peers, setPeers] = useState<OpenDotaPeer[]>([]);
  const [isPeersLoading, setIsPeersLoading] = useState(false);
  const [pros, setPros] = useState<OpenDotaProEncounter[]>([]);
  const [counts, setCounts] = useState<OpenDotaCounts | null>(null);
  const [histograms, setHistograms] = useState<OpenDotaHistogramItem[]>([]);
  const [histogramField, setHistogramField] = useState('kills');
  const [wardmap, setWardmap] = useState<OpenDotaWardmap | null>(null);
  const [wordcloud, setWordcloud] = useState<OpenDotaWordcloud | null>(null);
  const [ratings, setRatings] = useState<OpenDotaRatingTimelineItem[]>([]);
  const [rankings, setRankings] = useState<OpenDotaHeroRanking[]>([]);

  // Modals state
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);

  // Navigation scroll ref
  const navScrollRef = useRef<HTMLDivElement>(null);

  const currentUser = tournamentService.getCurrentPBGAccount();
  const sessionUser = tournamentService.getCurrentUser();
  const authUser = auth.currentUser;

  const isOwner = !pbgId 
    ? true 
    : Boolean(
        activePbgAccount && (
          (authUser && activePbgAccount.googleUid === authUser.uid) ||
          (authUser?.email && activePbgAccount.email && activePbgAccount.email.toLowerCase() === authUser.email.toLowerCase()) ||
          (currentUser && activePbgAccount.pbgId === currentUser.pbgId) ||
          (sessionUser?.email && activePbgAccount.email && activePbgAccount.email.toLowerCase() === sessionUser.email.toLowerCase())
        )
      );

  // Handle generic player navigation
  const handleSelectPlayer = (targetId: string) => {
    const clean = targetId.trim();
    if (!clean) return;
    const res = resolveTarget(clean);
    setActiveDotaId(res.dotaId);
    setActivePbgAccount(res.pbgAccount);

    // Reset lazy-loaded tabs
    setPeers([]);
    setPros([]);
    setCounts(null);
    setHistograms([]);
    setWardmap(null);
    setWordcloud(null);
    setRatings([]);
    setRankings([]);

    try {
      window.history.pushState(
        { view: 'dota_game_profile', entityId: res.dotaId },
        '',
        `/game/dota2/players/${res.dotaId}`
      );
    } catch {
      // Ignore iframe pushState restrictions
    }

    onSelectPlayer?.(res.dotaId);
  };

  // Load Primary Data
  const loadPrimaryData = async (force = false) => {
    if (!activeDotaId) {
      setIsLoading(false);
      setPlayerData(null);
      return;
    }
    setIsLoading(true);
    try {
      const summary = await openDotaService.fetchPlayer(activeDotaId, { forceRefresh: force });
      setPlayerData(summary);
      setIsLoading(false);
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrimaryData();
  }, [activeDotaId]);

  // Refresh cooldown timer
  useEffect(() => {
    if (refreshCooldown <= 0) return;
    const timer = setInterval(() => {
      setRefreshCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [refreshCooldown]);

  // Lazy tab data loaders
  useEffect(() => {
    if (!activeDotaId) return;

    if (activeTab === 'teammates' && peers.length === 0) {
      setIsPeersLoading(true);
      openDotaService.fetchPeers(activeDotaId).then((p) => {
        setPeers(p);
        setIsPeersLoading(false);
      });
    } else if (activeTab === 'pros' && pros.length === 0) {
      openDotaService.fetchPros(activeDotaId).then((pr) => setPros(pr));
    } else if (activeTab === 'counts' && !counts) {
      openDotaService.fetchCounts(activeDotaId).then((c) => setCounts(c));
    } else if (activeTab === 'histograms') {
      openDotaService.fetchHistograms(activeDotaId, histogramField).then((h) => setHistograms(h));
    } else if (activeTab === 'vision' && !wardmap) {
      openDotaService.fetchWardmap(activeDotaId).then((w) => setWardmap(w));
    } else if (activeTab === 'wordcloud' && !wordcloud) {
      openDotaService.fetchWordcloud(activeDotaId).then((wc) => setWordcloud(wc));
    } else if (activeTab === 'rank_history' && ratings.length === 0) {
      openDotaService.fetchRatings(activeDotaId).then((r) => setRatings(r));
    } else if (activeTab === 'hero_rankings' && rankings.length === 0) {
      openDotaService.fetchRankings(activeDotaId).then((rk) => setRankings(rk));
    }
  }, [activeTab, activeDotaId, histogramField]);

  // Also pre-fetch peers and counts for Overview tab if missing
  useEffect(() => {
    if (activeTab === 'overview' && activeDotaId) {
      if (peers.length === 0) {
        openDotaService.fetchPeers(activeDotaId).then((p) => setPeers(p));
      }
      if (!counts) {
        openDotaService.fetchCounts(activeDotaId).then((c) => setCounts(c));
      }
    }
  }, [activeTab, activeDotaId]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isRefreshing || refreshCooldown > 0) return;
    setIsRefreshing(true);
    setRefreshCooldown(30);
    await openDotaService.refreshPlayer(activeDotaId);
    await loadPrimaryData(true);
    setIsRefreshing(false);
  };

  // Open match detail handler — navigates directly to dedicated match page
  const handleOpenMatch = (matchId: string) => {
    if (onOpenMatchDetail) {
      onOpenMatchDetail(matchId);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({ view: 'dota_match_detail', entityId: matchId }, '', `/game/dota2/matches/${matchId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Scroll navigation helper
  const scrollNav = (direction: 'left' | 'right') => {
    if (navScrollRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      navScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  const displayName = playerData?.personaName || activePbgAccount?.displayName || `Contender #${activeDotaId}`;
  const avatarUrl = playerData?.avatarUrl || activePbgAccount?.dotaAvatar || activePbgAccount?.avatarUrl || '';
  const isPbgLinked = Boolean(activePbgAccount);

  if (!activeDotaId && !isLoading) {
    return (
      <div className="space-y-5 font-mono animate-in fade-in duration-200 pb-20">
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateBack}
            className="px-3.5 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>

        <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-8 text-center space-y-4 max-w-xl mx-auto my-8">
          <div className="w-16 h-16 bg-[#171a21] border-2 border-black text-white text-2xl flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#000]">
            🎮
          </div>
          <h2 className="text-xl font-black uppercase">NO DOTA 2 ACCOUNT LINKED</h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {isOwner
              ? "Your PurpleBeanGaming account has not connected a Dota 2 & Steam identity yet. Verify ownership with Steam OpenID to unlock competitive MMR calibration, OpenDota telemetry, and tournament eligibility."
              : `${activePbgAccount?.displayName || 'This player'} has not linked their Steam or Dota 2 identity to PurpleBeanGaming.`
            }
          </p>
          {isOwner && (
            <div className="pt-2">
              <button
                onClick={() => setIsLinkingModalOpen(true)}
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
              >
                CONNECT DOTA 2 &amp; STEAM ACCOUNT
              </button>
            </div>
          )}
        </div>

        {isLinkingModalOpen && activePbgAccount && (
          <DotaLinkingModal
            isOpen={isLinkingModalOpen}
            account={activePbgAccount}
            onClose={() => setIsLinkingModalOpen(false)}
            onLinked={(updated) => {
              setActivePbgAccount(updated);
              if (updated.dotaAccountId) {
                setActiveDotaId(updated.dotaAccountId);
              }
              setIsLinkingModalOpen(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 font-mono animate-in fade-in duration-200 pb-20">
      
      {/* ------------------------------------------------------------- */}
      {/* TOP BREADCRUMB & BACK NAVIGATION BAR                          */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateBack}
            className="px-3.5 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>Back</span>
          </button>

          {isPbgLinked && activePbgAccount && onNavigateToPbgProfile && (
            <button
              onClick={() => onNavigateToPbgProfile(activePbgAccount.pbgId)}
              className="px-3 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <span>View PBG Profile ({activePbgAccount.pbgId})</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-stone-600 bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span className="text-[#7C3AED] font-black">PurpleBeanGaming</span>
          <span>/</span>
          <span>Dota 2 Explorer</span>
          <span>/</span>
          <span className="font-bold text-black uppercase">{displayName}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* REBUILT PLAYER HEADER (Compact, Rich Esports Identity)         */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* LEFT: Large Steam/Dota avatar + Identity Information */}
          <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Large Steam/Dota Avatar */}
            <div className="relative shrink-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-24 h-24 sm:w-28 sm:h-28 bg-[#171a21] border-[3.5px] border-black object-cover shadow-[4px_4px_0px_0px_#000]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-28 sm:h-28 bg-black text-[#FFE600] border-[3.5px] border-black flex items-center justify-center font-bold text-3xl shadow-[4px_4px_0px_0px_#000]">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className={`absolute -bottom-2 -right-2 px-2 py-0.5 text-black border-2 border-black text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000] ${
                isPbgLinked ? 'bg-[#70FFAF]' : 'bg-stone-200'
              }`}>
                {isPbgLinked ? 'PBG LINKED' : 'PUBLIC DOTA'}
              </span>
            </div>

            {/* Beside Avatar: Name, IDs, Country flag, Badges, Last Sync */}
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black uppercase text-black font-sans leading-none tracking-tight truncate max-w-full">
                  {displayName}
                </h1>
                
                {/* PBG Identifier if linked */}
                {isPbgLinked && activePbgAccount ? (
                  <span className="bg-[#FFE600] px-2 py-0.5 text-black font-mono font-black text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                    {activePbgAccount.pbgId}
                  </span>
                ) : (
                  <span className="bg-stone-100 text-stone-700 px-2 py-0.5 font-mono font-bold text-[11px] border border-black">
                    Unlinked Contender
                  </span>
                )}
              </div>

              {/* Sub-identity row: Dota Friend ID, Steam64, Country */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-700 font-mono">
                <span className="flex items-center gap-1">
                  <span className="text-stone-500 font-bold">Dota Friend ID:</span>
                  <strong className="text-black font-black">{activeDotaId}</strong>
                </span>
                <span className="text-stone-400">·</span>
                <span className="flex items-center gap-1">
                  <span className="text-stone-500 font-bold">Steam64:</span>
                  <strong className="text-stone-800">{playerData?.steamId64 || activePbgAccount?.steamId || '—'}</strong>
                </span>
                <span className="text-stone-400">·</span>
                <span className="flex items-center gap-1 font-bold text-stone-800">
                  <span>{playerData?.locCountryCode ? `🏳️ ${playerData.locCountryCode}` : (activePbgAccount?.country ? `🇮🇳 ${activePbgAccount.country}` : 'Global')}</span>
                </span>
              </div>

              {/* Badges: Steam Verified, OpenDota Connected, Public Match Data */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#171a21] text-white border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                  <ShieldCheckIcon className="w-3.5 h-3.5 text-[#66c0f4]" />
                  <span>Steam Indexed</span>
                </span>

                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00F0FF]/15 text-cyan-950 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                  <LinkIcon className="w-3.5 h-3.5 text-cyan-800" />
                  <span>OpenDota Connected</span>
                </span>

                {playerData?.isPrivate ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFE600] text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-900" />
                    <span>Private Match Data</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#70FFAF] text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000]">
                    <CheckBadgeIcon className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Public Match Data</span>
                  </span>
                )}
              </div>

              {/* Last OpenDota Sync */}
              <div className="text-[10px] text-stone-500 font-mono flex items-center gap-1.5 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                <span>Last OpenDota Sync:</span>
                <span className="text-stone-700 font-bold">
                  {playerData?.fetchedAt ? new Date(playerData.fetchedAt).toLocaleTimeString() : 'Live'}
                </span>
              </div>
            </div>
          </div>

          {/* CENTER / RIGHT: Rank Medal, Declared MMR, Tournament MMR, Rating, Roles */}
          <div className="lg:col-span-5 bg-stone-50 border-2 border-black p-3.5 shadow-[4px_4px_0px_0px_#000] space-y-3">
            <div className="flex items-center gap-4">
              {/* Proper Dota Rank Medal Artwork */}
              <div className="shrink-0">
                <DotaRankMedal
                  rankTier={playerData?.rankTier || activePbgAccount?.dotaRankTier || null}
                  leaderboardRank={playerData?.leaderboardRank || activePbgAccount?.dotaLeaderboardRank}
                  size="md"
                  showLabel={false}
                />
              </div>

              {/* Rank Name & Leaderboard */}
              <div className="space-y-0.5 flex-1 min-w-0">
                <span className="text-[9px] font-black uppercase text-stone-500 tracking-wider block">
                  VALVE OFFICIAL RANK
                </span>
                <strong className="text-lg sm:text-xl font-black text-black font-sans uppercase leading-none block">
                  {playerData?.rankName || (playerData?.rankTier ? getRankTierName(playerData.rankTier) : (activePbgAccount?.dotaRankTier ? getRankTierName(activePbgAccount.dotaRankTier) : 'Uncalibrated'))}
                </strong>
                {playerData?.leaderboardRank ? (
                  <span className="text-[11px] font-mono font-black text-amber-700 block">
                    Leaderboard #{playerData.leaderboardRank.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-stone-500 block">
                    Official Competitive Standing
                  </span>
                )}
              </div>
            </div>

            {/* Declared MMR, Current Tournament MMR, Purple Bean Rating */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/15 text-xs font-mono text-center">
              <div className="p-1.5 bg-white border border-black/30 space-y-0.5">
                <span className="text-[9px] text-stone-500 uppercase font-black block">Declared MMR</span>
                <strong className="text-black text-xs font-black block">
                  {activePbgAccount?.declaredMmr ? activePbgAccount.declaredMmr.toLocaleString() : (playerData?.estimatedMmr ? `${playerData.estimatedMmr.toLocaleString()} (Est)` : '—')}
                </strong>
              </div>

              <div className="p-1.5 bg-white border border-black/30 space-y-0.5">
                <span className="text-[9px] text-stone-500 uppercase font-black block">Tourney MMR</span>
                <strong className="text-purple-700 text-xs font-black block">
                  {activePbgAccount?.tournamentMmr ? activePbgAccount.tournamentMmr.toLocaleString() : (activePbgAccount?.declaredMmr ? activePbgAccount.declaredMmr.toLocaleString() : '—')}
                </strong>
              </div>

              <div className="p-1.5 bg-[#FFF9E6] border border-black/30 space-y-0.5">
                <span className="text-[9px] text-stone-500 uppercase font-black block">PB Rating</span>
                <strong className="text-[#7C3AED] text-xs font-black block">
                  {activePbgAccount?.purpleBeanRating || '—'}
                </strong>
              </div>
            </div>

            {/* Primary Role & Secondary Role */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono bg-white p-2 border border-black/20">
              <div>
                <span className="text-stone-500 text-[9px] uppercase font-black block">Primary Role</span>
                <strong className="text-black font-bold">
                  {activePbgAccount?.primaryRole || 'Flexible / Core'}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-stone-500 text-[9px] uppercase font-black block">Secondary Role</span>
                <strong className="text-stone-700 font-bold">
                  {activePbgAccount?.secondaryRole || 'Flexible / Support'}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons Strip & Player Explorer Jump Bar */}
        <div className="pt-3 border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. VIEW STEAM */}
            <a
              href={`https://steamcommunity.com/profiles/${playerData?.steamId64 || activePbgAccount?.steamId || ''}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>View Steam</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>

            {/* 2. VIEW OPENDOTA */}
            <a
              href={`https://www.opendota.com/players/${activeDotaId}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-blue-900 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
            >
              <span>View OpenDota</span>
              <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
            </a>

            {/* 3. REFRESH DATA */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || refreshCooldown > 0}
              className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all active:translate-x-0.5 active:translate-y-0.5"
              title="Force refresh OpenDota snapshot"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>
                {isRefreshing 
                  ? 'Refreshing...' 
                  : refreshCooldown > 0 
                  ? `Refresh (${refreshCooldown}s)` 
                  : 'Refresh Data'}
              </span>
            </button>

            {/* 4. MANAGE CONNECTION (if owner or linked) */}
            {activePbgAccount && isOwner && (
              <button
                onClick={() => setIsLinkingModalOpen(true)}
                className="px-3 py-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] flex items-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <AdjustmentsHorizontalIcon className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Manage Connection</span>
              </button>
            )}
          </div>

          {/* Quick Jump / Player Explorer by Account ID */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Jump to Dota ID..."
                value={searchTargetId}
                onChange={(e) => setSearchTargetId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchTargetId.trim()) {
                    handleSelectPlayer(searchTargetId.trim());
                    setSearchTargetId('');
                  }
                }}
                className="bg-stone-50 border-2 border-black pl-8 pr-2.5 py-1 text-xs font-mono font-bold w-full"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (searchTargetId.trim()) {
                  handleSelectPlayer(searchTargetId.trim());
                  setSearchTargetId('');
                }
              }}
              className="px-3 py-1 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              Explore
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PLAYER DOTA NAVIGATION (Unclipped Scrollable Bar)               */}
      {/* ------------------------------------------------------------- */}
      <div className="relative bg-white border-[3px] border-black p-2 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-1">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => scrollNav('left')}
            className="p-1.5 bg-stone-100 hover:bg-[#FFE600] border-2 border-black cursor-pointer shrink-0"
            title="Scroll navigation left"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          {/* Scrollable container */}
          <div
            ref={navScrollRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1"
          >
            {SUB_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                    isActive
                      ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
                      : 'bg-white hover:bg-stone-100 text-stone-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => scrollNav('right')}
            className="p-1.5 bg-stone-100 hover:bg-[#FFE600] border-2 border-black cursor-pointer shrink-0"
            title="Scroll navigation right"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* GLOBAL STATS FILTER BAR                                       */}
      {/* ------------------------------------------------------------- */}
      <DotaGlobalFilters
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* ------------------------------------------------------------- */}
      {/* TAB CONTENT AREA                                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <DotaOverviewTab
          playerData={playerData}
          counts={counts}
          peers={peers}
          onOpenMatch={handleOpenMatch}
          onOpenHero={setSelectedHeroId}
          onSelectTab={setActiveTab}
          onSelectPlayer={handleSelectPlayer}
        />
      )}

      {activeTab === 'matches' && (
        <DotaMatchesTab
          matches={playerData?.recentMatches || []}
          isLoading={isLoading}
          filters={filters}
          onOpenMatch={handleOpenMatch}
        />
      )}

      {activeTab === 'heroes' && (
        <DotaHeroesTab
          heroes={playerData?.topHeroes || []}
          onOpenHero={setSelectedHeroId}
        />
      )}

      {activeTab === 'teammates' && (
        <DotaTeammatesTab
          peers={peers}
          isLoading={isPeersLoading}
          onSelectPlayer={handleSelectPlayer}
        />
      )}

      {activeTab === 'pros' && (
        <DotaProsTab
          pros={pros}
          onSelectPlayer={handleSelectPlayer}
        />
      )}

      {activeTab === 'records' && (
        <DotaRecordsTab
          playerData={playerData}
          onOpenMatch={handleOpenMatch}
        />
      )}

      {activeTab === 'totals' && (
        <DotaTotalsTab
          totals={playerData?.totals || null}
          totalMatches={playerData?.totalMatches}
        />
      )}

      {activeTab === 'counts' && (
        <DotaCountsTab
          counts={counts}
        />
      )}

      {activeTab === 'histograms' && (
        <DotaHistogramsTab
          histograms={histograms}
          currentField={histogramField}
          onFieldChange={setHistogramField}
        />
      )}

      {activeTab === 'trends' && (
        <DotaTrendsTab
          timeframe={filters.timeframe === 'all' ? '90d' : filters.timeframe}
          onTimeframeChange={(tf) => setFilters({ ...filters, timeframe: tf })}
          matches={playerData?.recentMatches || []}
        />
      )}

      {activeTab === 'vision' && (
        <DotaWardmapTab
          wardmap={wardmap}
        />
      )}

      {activeTab === 'wordcloud' && (
        <DotaWordcloudTab
          wordcloud={wordcloud}
        />
      )}

      {activeTab === 'rank_history' && (
        <DotaRankHistoryTab
          ratings={ratings}
          currentRankTier={playerData?.rankTier}
          leaderboardRank={playerData?.leaderboardRank}
        />
      )}

      {activeTab === 'hero_rankings' && (
        <DotaHeroRankingsTab
          rankings={rankings}
          onOpenHero={setSelectedHeroId}
        />
      )}

      {activeTab === 'activity' && (
        <DotaActivityTab 
          matches={playerData?.recentMatches || []}
        />
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODALS                                                        */}
      {/* ------------------------------------------------------------- */}
      <DotaHeroDetailModal
        heroId={selectedHeroId}
        isOpen={Boolean(selectedHeroId)}
        onClose={() => setSelectedHeroId(null)}
        playerSummary={playerData}
        onOpenMatch={handleOpenMatch}
      />

      {isLinkingModalOpen && activePbgAccount && (
        <DotaLinkingModal
          isOpen={isLinkingModalOpen}
          onClose={() => setIsLinkingModalOpen(false)}
          account={activePbgAccount}
          onLinked={(updated) => {
            setActivePbgAccount(updated);
            setIsLinkingModalOpen(false);
          }}
        />
      )}

    </div>
  );
}
