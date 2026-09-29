import { useState, useEffect } from 'react';
import { 
  Users, 
  Trophy, 
  Swords, 
  ArrowLeft, 
  Award, 
  Shield, 
  Sparkles, 
  TrendingUp, 
  CheckCircle, 
  Clock,
  MapPin,
  Gamepad2,
  ExternalLink,
  Edit3,
  Link,
  Unlink,
  AlertCircle,
  X,
  Flame,
  Info,
  RefreshCw
} from 'lucide-react';
import { ViewType, IndianCity } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { 
  dotaPlayerRegistry, 
  DotaPlayerProfile, 
  DotaRolePosition, 
  DOTA_ROLES, 
  validateDotaRoles 
} from '../domain/dotaPlayerEngine';
import { 
  fetchOpenDotaPlayer, 
  fetchOpenDotaPeers, 
  fetchOpenDotaTotals, 
  OpenDotaPlayerSummary 
} from '../services/openDotaService';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface PlayerProfileViewProps {
  playerId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

const INDIAN_CITIES: IndianCity[] = [
  'Bengaluru',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad'
];

export function PlayerProfileView({ playerId, onNavigate }: PlayerProfileViewProps) {
  const currentUser = tournamentService.getCurrentUser();
  const targetId = playerId || currentUser.id;
  const isOwner = currentUser.id === targetId || currentUser.role === 'organizer';

  const [player, setPlayer] = useState<DotaPlayerProfile>(() => tournamentService.getDotaPlayer(targetId));
  const [activeTab, setActiveTab] = useState<
    'overview' | 'dota_stats' | 'tournaments' | 'matches' | 'teams' | 'auction' | 'ratings' | 'captain'
  >('overview');

  // OpenDota stats state
  const [openDotaStats, setOpenDotaStats] = useState<OpenDotaPlayerSummary | null>(null);
  const [loadingOpenDota, setLoadingOpenDota] = useState(false);
  const [openDotaError, setOpenDotaError] = useState<string | null>(null);
  const [refreshingOpenDota, setRefreshingOpenDota] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [dotaSubTab, setDotaSubTab] = useState<'overview' | 'matches' | 'heroes' | 'performance' | 'peers'>('overview');
  const [peersData, setPeersData] = useState<Array<{ accountId: string; personaName: string; avatarUrl: string; games: number; wins: number; winRate: number; lastPlayed?: string | null }> | null>(null);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [totalsData, setTotalsData] = useState<OpenDotaPlayerSummary['totals'] | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);

  // Edit Profile Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editIgn, setEditIgn] = useState('');
  const [editAvatar, setEditAvatar] = useState('⚡');
  const [editCity, setEditCity] = useState<IndianCity>('Bengaluru');
  const [editPrimaryRole, setEditPrimaryRole] = useState<DotaRolePosition>('Position 1 — Carry');
  const [editSecondaryRole, setEditSecondaryRole] = useState<DotaRolePosition>('Position 2 — Mid');
  const [editBio, setEditBio] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Steam Link Modal State
  const [isSteamModalOpen, setIsSteamModalOpen] = useState(false);
  const [steamInput, setSteamInput] = useState('');
  const [steamError, setSteamError] = useState<string | null>(null);
  const [linkingSteam, setLinkingSteam] = useState(false);

  // Reload player data on targetId or auth changes
  useEffect(() => {
    const p = tournamentService.getDotaPlayer(targetId);
    setPlayer(p);
  }, [targetId, currentUser.id]);

  // Load OpenDota data when Steam is linked
  useEffect(() => {
    if (player.steam?.steamId32 || player.steam?.steamId64) {
      const identifier = player.steam.steamId32 || player.steam.steamId64;
      setLoadingOpenDota(true);
      setOpenDotaError(null);
      fetchOpenDotaPlayer(identifier)
        .then((summary) => {
          setOpenDotaStats(summary);
        })
        .catch((err) => {
          setOpenDotaError('Unable to load OpenDota public telemetry.');
        })
        .finally(() => {
          setLoadingOpenDota(false);
        });
    } else {
      setOpenDotaStats(null);
      setPeersData(null);
      setTotalsData(null);
    }
  }, [player.steam?.steamId64, player.steam?.steamId32]);

  // Progressive/lazy loading for secondary tabs (Peers & Career Totals)
  useEffect(() => {
    if (activeTab === 'dota_stats' && (player.steam?.steamId32 || player.steam?.steamId64)) {
      const identifier = player.steam.steamId32 || player.steam.steamId64;
      if (dotaSubTab === 'peers' && peersData === null && !loadingPeers) {
        setLoadingPeers(true);
        fetchOpenDotaPeers(identifier)
          .then((p) => setPeersData(p))
          .catch(() => setPeersData([]))
          .finally(() => setLoadingPeers(false));
      } else if (dotaSubTab === 'performance' && totalsData === null && !loadingTotals) {
        setLoadingTotals(true);
        fetchOpenDotaTotals(identifier)
          .then((t) => setTotalsData(t))
          .catch(() => setTotalsData(null))
          .finally(() => setLoadingTotals(false));
      }
    }
  }, [activeTab, dotaSubTab, player.steam?.steamId32, player.steam?.steamId64]);

  const handleRefreshOpenDota = async () => {
    if (!player.steam?.steamId32 && !player.steam?.steamId64) return;
    const identifier = player.steam.steamId32 || player.steam.steamId64;
    setRefreshingOpenDota(true);
    setRefreshNotice(null);
    try {
      const summary = await fetchOpenDotaPlayer(identifier, { forceRefresh: true });
      setOpenDotaStats(summary);
      if (summary.status === 'PROVIDER_UNAVAILABLE') {
        setRefreshNotice('OpenDota servers are currently unreachable. Retaining last successful real snapshot.');
      } else if (summary.status === 'RATE_LIMITED') {
        setRefreshNotice('OpenDota public rate limit reached (60 req/min). Retaining last cached snapshot.');
      } else if (summary.errorMessage) {
        setRefreshNotice(summary.errorMessage);
      } else {
        setRefreshNotice('✓ Live OpenDota player data successfully refreshed.');
      }

      // Also refresh secondary data if active
      if (dotaSubTab === 'peers') {
        setLoadingPeers(true);
        const peers = await fetchOpenDotaPeers(identifier, { forceRefresh: true });
        setPeersData(peers);
        setLoadingPeers(false);
      } else if (dotaSubTab === 'performance') {
        setLoadingTotals(true);
        const totals = await fetchOpenDotaTotals(identifier, { forceRefresh: true });
        setTotalsData(totals);
        setLoadingTotals(false);
      }
    } catch (err: any) {
      setRefreshNotice('OpenDota refresh failed: ' + (err.message || 'API unreachable. Retaining cached telemetry.'));
    } finally {
      setRefreshingOpenDota(false);
    }
  };

  const handleOpenEdit = () => {
    setEditIgn(player.username);
    setEditAvatar(player.avatar);
    setEditCity((player.city as IndianCity) || 'Bengaluru');
    setEditPrimaryRole(player.primaryRole || 'Position 1 — Carry');
    setEditSecondaryRole(player.secondaryRole || 'Position 2 — Mid');
    setEditBio(player.bio || '');
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const roleValidation = validateDotaRoles(editPrimaryRole, editSecondaryRole);
    if (!roleValidation.valid) {
      setEditError(roleValidation.error || 'Invalid role combination.');
      return;
    }

    if (!editIgn.trim()) {
      setEditError('In-Game Name (IGN) cannot be empty.');
      return;
    }

    setSavingEdit(true);
    try {
      const region = editCity === 'Bengaluru' || editCity === 'Chennai' || editCity === 'Hyderabad'
        ? 'South India'
        : editCity === 'Mumbai' || editCity === 'Pune' || editCity === 'Ahmedabad'
        ? 'West India'
        : 'North India';

      const res = await tournamentService.updatePlayerDotaProfile(targetId, {
        username: editIgn.trim(),
        avatar: editAvatar,
        city: editCity,
        region,
        bio: editBio.trim(),
        primaryRole: editPrimaryRole,
        secondaryRole: editSecondaryRole
      });

      if (!res.success) {
        setEditError(res.error || 'Failed to update profile.');
        setSavingEdit(false);
        return;
      }

      setPlayer(tournamentService.getDotaPlayer(targetId));
      setIsEditOpen(false);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleLinkSteam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSteamError(null);

    if (!steamInput.trim()) {
      setSteamError('Please enter a Steam64 ID, Dota Account ID, or Steam profile link.');
      return;
    }

    setLinkingSteam(true);
    try {
      const res = await tournamentService.linkUserSteamAccount(targetId, steamInput.trim());
      if (!res.success) {
        setSteamError(res.error || 'Failed to link Steam identity.');
        setLinkingSteam(false);
        return;
      }

      setPlayer(tournamentService.getDotaPlayer(targetId));
      setIsSteamModalOpen(false);
      setSteamInput('');
    } catch (err: any) {
      setSteamError(err.message || 'Steam linking failed.');
    } finally {
      setLinkingSteam(false);
    }
  };

  const handleUnlinkSteam = async () => {
    if (!confirm('Are you sure you want to unlink your Steam account? You will need to link it again for verified tournament entries.')) {
      return;
    }

    try {
      const res = await tournamentService.unlinkUserSteamAccount(targetId);
      if (!res.success) {
        alert(res.error || 'Cannot unlink Steam account.');
        return;
      }
      setPlayer(tournamentService.getDotaPlayer(targetId));
      setOpenDotaStats(null);
    } catch (err: any) {
      alert(err.message || 'Failed to unlink Steam account.');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'dota_stats', label: 'Dota Stats' },
    { id: 'tournaments', label: `Tournaments (${player.tournamentSnapshots?.length || 0})` },
    { id: 'matches', label: 'Matches' },
    { id: 'teams', label: 'Teams' },
    { id: 'auction', label: 'Auction History' },
    { id: 'ratings', label: 'Rating History' },
    ...(player.captainRecord?.tournamentsCaptained > 0 ? [{ id: 'captain', label: 'Captain Dossier' }] : [])
  ];

  return (
    <div className="space-y-8 pb-16 font-sans">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('players')}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Players Directory</span>
        </button>
      </div>

      {/* Main Header Showcase */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          {/* Identity & Badges */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 min-w-0">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-[#FF70A6] border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center text-4xl sm:text-5xl shrink-0">
              {player.avatar}
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans leading-none truncate">
                  {player.username}
                </h1>
                <span className="text-lg">🇮🇳</span>
                <span className="bg-[#FFE600] text-black border border-black px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                  DOTA 2
                </span>
                <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase border border-black ${
                  player.ratingStatus === 'ESTABLISHED' ? 'bg-[#70FFAF] text-black' : 'bg-[#FFDE59] text-black'
                }`}>
                  {player.ratingStatus}
                </span>
              </div>

              {/* Roles & Team */}
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                <span className="bg-[#8B5CF6] text-white border border-black px-2.5 py-0.5 font-black uppercase">
                  {player.primaryRole}
                </span>
                <span className="bg-stone-100 border border-black px-2.5 py-0.5 font-bold text-stone-800">
                  Sec: {player.secondaryRole}
                </span>
                <span className="text-stone-500 hidden sm:inline">|</span>
                <span className="text-stone-700 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>{player.city || 'India'}</span>
                </span>
                <span className="text-stone-500 hidden sm:inline">|</span>
                <span className="text-stone-700">
                  Squad: <strong className="text-black">{player.currentTeamName || 'Free Agent'}</strong>
                </span>
              </div>

              {/* Steam Connection Badge */}
              <div className="pt-1">
                {player.steam ? (
                  <div className="inline-flex items-center gap-2 bg-[#FFF9E6] border border-black px-2.5 py-1 text-[11px] font-mono">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Steam64: <strong className="text-black">{player.steam.steamId64}</strong></span>
                    <span className="text-stone-400">·</span>
                    <span className="bg-[#70FFAF] text-black text-[9px] font-black px-1 border border-black uppercase">
                      {player.steam.isVerified ? 'VERIFIED' : 'LINKED · PENDING REVIEW'}
                    </span>
                    {player.steam.openDotaUrl && (
                      <a
                        href={player.steam.openDotaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#7C3AED] hover:underline flex items-center gap-0.5 ml-1 font-bold"
                      >
                        OpenDota <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {isOwner && (
                      <button
                        onClick={handleUnlinkSteam}
                        className="ml-2 text-stone-500 hover:text-[#FF5757] cursor-pointer"
                        title="Unlink Steam Account"
                      >
                        <Unlink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 bg-stone-100 border border-black px-2.5 py-1 text-[11px] font-mono text-stone-600">
                    <Gamepad2 className="w-3.5 h-3.5 text-stone-400" />
                    <span>No Steam account linked</span>
                    {isOwner && (
                      <button
                        onClick={() => setIsSteamModalOpen(true)}
                        className="text-[#7C3AED] hover:underline font-black cursor-pointer ml-1"
                      >
                        Connect Steam →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics & Owner Actions */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-3 shrink-0">
            <div className="grid grid-cols-3 gap-2 font-mono text-center">
              <div className="bg-[#FFF9E6] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[9px] text-stone-500 uppercase font-black block">Declared MMR</span>
                <span className="text-lg sm:text-xl font-black text-black">
                  {player.declaredMmr?.toLocaleString() || '—'}
                </span>
              </div>
              <div className="bg-[#FFF9E6] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[9px] text-stone-500 uppercase font-black block">Tourney MMR</span>
                <span className="text-lg sm:text-xl font-black text-black">
                  {player.tournamentMmr?.toLocaleString() || 'Uncalibrated'}
                </span>
              </div>
              <div className="bg-[#FFF9E6] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
                <span className="text-[9px] text-stone-500 uppercase font-black block">PBG Rating</span>
                <span className="text-lg sm:text-xl font-black text-[#7C3AED]">
                  {player.competitiveRating}
                </span>
              </div>
            </div>

            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={handleOpenEdit}
                  className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 bg-[#FFE600] hover:bg-[#FFE600]/80 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                {!player.steam && (
                  <button
                    onClick={() => setIsSteamModalOpen(true)}
                    className="flex-1 lg:flex-none inline-flex items-center justify-center gap-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    <Link className="w-3.5 h-3.5 text-[#70FFAF]" />
                    <span>Connect Steam</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3 sm:px-4 py-2 font-mono text-xs font-black uppercase whitespace-nowrap border-2 border-black transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100 hover:border-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-mono text-xs">
          <div className="lg:col-span-7 bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-5">
            <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2 flex items-center justify-between">
              <span>PLAYER BIO &amp; SCOUTING DOSSIER</span>
              <span className="text-xs font-mono font-bold text-stone-500">CANONICAL PBG PROFILE</span>
            </h2>

            <p className="p-4 bg-[#FFFBEB] border-2 border-black leading-relaxed text-stone-800 text-sm">
              {player.bio || 'Competitive Dota 2 athlete registered on the Purple Bean Gaming tournament network.'}
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Primary Specialization:</span>
                <span className="font-black text-black text-sm block mt-0.5">{player.primaryRole}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Secondary Role:</span>
                <span className="font-black text-stone-700 text-sm block mt-0.5">{player.secondaryRole}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Tournament Count:</span>
                <span className="font-black text-black text-base">{player.tournamentSnapshots?.length || 0}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block text-[10px] uppercase font-bold">Competitive Rating:</span>
                <span className="font-black text-[#7C3AED] text-base">{player.competitiveRating} ({player.ratingStatus})</span>
              </div>
            </div>

            {/* MMR Integrity Card */}
            <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-black uppercase text-[11px] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Tournament MMR Integrity Status
                </span>
                <span className={`px-2 py-0.5 border border-black text-[9px] font-black uppercase ${
                  player.isMmrLocked ? 'bg-[#70FFAF] text-black' : 'bg-[#FFDE59] text-black'
                }`}>
                  {player.isMmrLocked ? 'LOCKED & VERIFIED' : 'DECLARED · PENDING CALIBRATION'}
                </span>
              </div>
              <p className="text-[11px] text-stone-600 leading-relaxed">
                {player.isMmrLocked 
                  ? `Tournament MMR is calibrated at ${player.tournamentMmr.toLocaleString()} by organiser referee (${player.mmrLockedBy || 'staff'}). This value is locked for competitive balance.`
                  : `Declared MMR is currently ${player.declaredMmr?.toLocaleString() || 6000}. Organisers calibrate this into locked Tournament MMR upon tournament registration verification.`}
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4">
            <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
              HERO POOL SPECIALTIES
            </h2>
            {player.heroPool && player.heroPool.length > 0 ? (
              <div className="space-y-3">
                {player.heroPool.map((h) => (
                  <div key={h.hero} className="p-3 bg-stone-50 border border-black space-y-1">
                    <div className="flex justify-between font-black text-sm text-black">
                      <span>{h.hero}</span>
                      <span className="text-emerald-700">{h.winRate}% WR</span>
                    </div>
                    <div className="w-full bg-stone-200 h-2 border border-black">
                      <div className="bg-[#7C3AED] h-full" style={{ width: `${h.winRate}%` }} />
                    </div>
                    <span className="text-[10px] text-stone-500">{h.games} Competitive Matches Recorded</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-500">
                <Gamepad2 className="w-8 h-8 mx-auto mb-2 text-stone-400" />
                <p className="font-black text-xs uppercase">No Hero Specialty Data</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Connect your Steam account to populate hero stats automatically via OpenDota.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: DOTA STATS (OpenDota Integration) */}
      {activeTab === 'dota_stats' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6 font-mono text-xs">
          {/* Header & Controls Bar */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-black pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-[#7C3AED] block">PUBLIC TELEMETRY</span>
                {openDotaStats?.status && (
                  <span className={`px-2 py-0.2 border border-black text-[9px] font-black uppercase ${
                    openDotaStats.status === 'SUCCESS' ? 'bg-[#70FFAF] text-black' :
                    openDotaStats.status === 'CACHED' ? 'bg-[#FFE600] text-black' :
                    openDotaStats.status === 'PRIVATE_PROFILE' ? 'bg-[#FF70A6] text-black' :
                    openDotaStats.status === 'RATE_LIMITED' ? 'bg-[#FFDE59] text-black' :
                    openDotaStats.status === 'PROVIDER_UNAVAILABLE' ? 'bg-stone-300 text-stone-700' :
                    'bg-stone-100 text-stone-700'
                  }`}>
                    {openDotaStats.status.replace('_', ' ')}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans mt-0.5">
                OPENDOTA STATISTICAL PROFILE
              </h2>
              {player.steam && (
                <p className="text-[11px] text-stone-600 mt-0.5">
                  Linked Steam64: <strong className="text-black font-bold">{player.steam.steamId64}</strong> · Canonical Dota ID: <strong className="text-black font-bold">{player.steam.steamId32 || '—'}</strong>
                </p>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {player.steam && (
                <button
                  onClick={handleRefreshOpenDota}
                  disabled={refreshingOpenDota || loadingOpenDota}
                  className={`inline-flex items-center gap-1.5 bg-[#FFE600] hover:bg-[#FFE600]/80 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                    refreshingOpenDota || loadingOpenDota ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  title="Force refresh player data from OpenDota (respects 30s cooldown)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingOpenDota ? 'animate-spin' : ''}`} />
                  <span>{refreshingOpenDota ? 'Refreshing...' : 'REFRESH DOTA DATA'}</span>
                </button>
              )}

              {player.steam?.openDotaUrl && (
                <a
                  href={player.steam.openDotaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 bg-[#FFF9E6] border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase hover:bg-[#FFE600] shadow-[2px_2px_0px_0px_#000]"
                >
                  <span>View on OpenDota</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Refresh Notice or Failure Banner */}
          {refreshNotice && (
            <div className="p-3 bg-[#FFF9E6] border-2 border-black flex items-center justify-between gap-2 shadow-[2px_2px_0px_0px_#000]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#7C3AED] shrink-0" />
                <span className="text-xs font-bold text-stone-800">{refreshNotice}</span>
              </div>
              <button
                onClick={() => setRefreshNotice(null)}
                className="text-stone-500 hover:text-black font-black text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {!player.steam ? (
            <div className="p-12 text-center bg-stone-50 border-2 border-dashed border-stone-300 space-y-3">
              <Gamepad2 className="w-10 h-10 mx-auto text-stone-400" />
              <h3 className="font-black text-base uppercase text-black font-sans">
                NO STEAM / DOTA ACCOUNT CONNECTED
              </h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Connect your Steam64 ID or Dota Account ID to fetch real-time rank tier, win rate, and recent match telemetry from OpenDota.
              </p>
              {isOwner && (
                <button
                  onClick={() => setIsSteamModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#FFE600] hover:bg-[#FFE600]/80 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span>Connect Steam Account</span>
                </button>
              )}
            </div>
          ) : loadingOpenDota ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-8 h-8 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-stone-600 font-bold">Querying OpenDota servers &amp; cache...</p>
            </div>
          ) : openDotaStats ? (
            <div className="space-y-6">
              {/* Failure / Privacy State Banners */}
              {openDotaStats.status === 'PRIVATE_PROFILE' && (
                <div className="p-4 bg-[#FFE5EC] border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
                  <div className="flex items-center gap-2 text-[#D90429] font-black uppercase text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>DOTA 2 MATCH TELEMETRY IS PRIVATE</span>
                  </div>
                  <p className="text-stone-700 text-xs leading-relaxed">
                    OpenDota cannot access match history or statistics because this player's Dota 2 client has <strong>"Expose Public Match Data"</strong> disabled.
                    To expose telemetry, launch Dota 2, navigate to <strong>Settings → Options → Advanced Options</strong>, and enable <strong>"Expose Public Match Data"</strong>.
                  </p>
                </div>
              )}

              {openDotaStats.status === 'PROVIDER_UNAVAILABLE' && (
                <div className="p-3 bg-stone-100 border-2 border-black text-stone-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-stone-500 shrink-0" />
                  <span>OpenDota API is currently unreachable. Displaying last cached real snapshot if available.</span>
                </div>
              )}

              {openDotaStats.status === 'RATE_LIMITED' && (
                <div className="p-3 bg-[#FFFBEB] border-2 border-black text-stone-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>OpenDota public rate limit reached (60 requests/minute). Displaying last cached snapshot.</span>
                </div>
              )}

              {openDotaStats.status === 'NO_MATCHES' && (
                <div className="p-3 bg-stone-50 border border-black text-stone-600">
                  <span>No recent competitive match records found on OpenDota for this account.</span>
                </div>
              )}

              {/* Sub-Navigation Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b-2 border-black pb-2">
                {[
                  { id: 'overview', label: 'OVERVIEW' },
                  { id: 'matches', label: `RECENT MATCHES (${openDotaStats.recentMatches.length})` },
                  { id: 'heroes', label: `HERO POOL (${openDotaStats.topHeroes.length})` },
                  { id: 'performance', label: 'PERFORMANCE & TOTALS' },
                  { id: 'peers', label: `PEERS ${peersData ? `(${peersData.length})` : ''}` }
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setDotaSubTab(st.id as any)}
                    className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                      dotaSubTab === st.id
                        ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000] -translate-y-0.5'
                        : 'bg-white hover:bg-stone-100 text-stone-600'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* 1. OVERVIEW SECTION */}
              {dotaSubTab === 'overview' && (
                <div className="space-y-6">
                  {/* 5 Large Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                      <span className="text-[10px] text-stone-500 font-bold uppercase block">Rank</span>
                      <span className="text-lg sm:text-xl font-black text-black block mt-0.5 truncate">
                        {openDotaStats.rankName && openDotaStats.rankName !== 'Unranked' ? openDotaStats.rankName : 'Not Available'}
                      </span>
                      <span className="text-[9px] text-stone-500 block mt-1">
                        Leaderboard: {openDotaStats.leaderboardRank ? `#${openDotaStats.leaderboardRank.toLocaleString()}` : '—'}
                      </span>
                    </div>

                    <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                      <span className="text-[10px] text-stone-500 font-bold uppercase block">Wins</span>
                      <span className="text-lg sm:text-xl font-black text-black block mt-0.5">
                        {openDotaStats.wins !== null ? openDotaStats.wins.toLocaleString() : 'Not Available'}
                      </span>
                      <span className="text-[9px] text-stone-500 block mt-1">Recorded Wins</span>
                    </div>

                    <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                      <span className="text-[10px] text-stone-500 font-bold uppercase block">Losses</span>
                      <span className="text-lg sm:text-xl font-black text-black block mt-0.5">
                        {openDotaStats.losses !== null ? openDotaStats.losses.toLocaleString() : 'Not Available'}
                      </span>
                      <span className="text-[9px] text-stone-500 block mt-1">Recorded Losses</span>
                    </div>

                    <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000]">
                      <span className="text-[10px] text-stone-500 font-bold uppercase block">Win Rate</span>
                      <span className="text-lg sm:text-xl font-black text-emerald-700 block mt-0.5">
                        {openDotaStats.winRate !== null ? `${openDotaStats.winRate}%` : 'Not Available'}
                      </span>
                      <span className="text-[9px] text-stone-500 block mt-1">Overall Ratio</span>
                    </div>

                    <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000] col-span-2 sm:col-span-1">
                      <span className="text-[10px] text-stone-500 font-bold uppercase block">Matches</span>
                      <span className="text-lg sm:text-xl font-black text-[#7C3AED] block mt-0.5">
                        {openDotaStats.totalMatches !== null
                          ? openDotaStats.totalMatches.toLocaleString()
                          : openDotaStats.wins !== null && openDotaStats.losses !== null
                          ? (openDotaStats.wins + openDotaStats.losses).toLocaleString()
                          : 'Not Available'}
                      </span>
                      <span className="text-[9px] text-stone-500 block mt-1">Total Recorded</span>
                    </div>
                  </div>

                  {/* Profile & Telemetry Metadata */}
                  <div className="bg-stone-50 border-2 border-black p-4 space-y-3 shadow-[2px_2px_0px_0px_#000]">
                    <div className="flex items-center justify-between border-b border-black/10 pb-2">
                      <span className="text-xs font-black uppercase text-black">PROFILE &amp; ACCOUNT IDENTITY</span>
                      <span className="text-[10px] text-stone-500">
                        Snapshot: {openDotaStats.fetchedAt ? new Date(openDotaStats.fetchedAt).toLocaleString() : 'Not Available'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-stone-500 block text-[10px] uppercase font-bold">Estimated MMR:</span>
                        <span className="font-black text-[#7C3AED]">
                          {openDotaStats.estimatedMmr ? openDotaStats.estimatedMmr.toLocaleString() : 'Not Available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] uppercase font-bold">Steam Persona:</span>
                        <span className="font-black text-black truncate block">
                          {openDotaStats.personaName || 'Not Available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] uppercase font-bold">Country / Origin:</span>
                        <span className="font-bold text-stone-800">
                          {openDotaStats.locCountryCode ? openDotaStats.locCountryCode.toUpperCase() : 'Not Available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[10px] uppercase font-bold">Last Activity:</span>
                        <span className="font-bold text-stone-800">
                          {openDotaStats.lastLogin ? new Date(openDotaStats.lastLogin).toLocaleDateString() : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. RECENT MATCHES SECTION */}
              {dotaSubTab === 'matches' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-black font-sans">
                      RECENT COMPETITIVE MATCHES (OPENDOTA)
                    </h3>
                    <span className="text-[10px] text-stone-500">
                      Showing {openDotaStats.recentMatches.length} recorded fixtures
                    </span>
                  </div>

                  {openDotaStats.recentMatches.length === 0 ? (
                    <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-600">
                      <p className="font-bold">Not Available</p>
                      <p className="text-xs text-stone-500 mt-1">No recent competitive matches returned by OpenDota for this account.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-2 border-black">
                        <thead className="bg-[#FFE600] text-black border-b-2 border-black text-[10px] uppercase font-black">
                          <tr>
                            <th className="p-2.5">Hero</th>
                            <th className="p-2.5">Result</th>
                            <th className="p-2.5">K / D / A</th>
                            <th className="p-2.5">GPM</th>
                            <th className="p-2.5">XPM</th>
                            <th className="p-2.5">Duration</th>
                            <th className="p-2.5">Date</th>
                            <th className="p-2.5">Match ID</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                          {openDotaStats.recentMatches.map((m) => (
                            <tr key={m.matchId} className="hover:bg-stone-50">
                              <td className="p-2.5">
                                <span className="font-black text-black block">{m.heroName}</span>
                                {m.gameMode && (
                                  <span className="text-[9px] text-stone-500 block">{m.gameMode}</span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <span className={`px-2 py-0.5 border text-[9px] font-black uppercase ${
                                  m.playerWon ? 'bg-[#70FFAF] text-black border-black' : 'bg-[#FF5757]/20 text-[#FF5757] border-[#FF5757]'
                                }`}>
                                  {m.playerWon ? 'Victory' : 'Defeat'}
                                </span>
                              </td>
                              <td className="p-2.5 font-bold text-stone-800">
                                {m.kills} / {m.deaths} / {m.assists}
                              </td>
                              <td className="p-2.5 font-bold text-stone-700">
                                {m.gpm !== undefined ? m.gpm : '—'}
                              </td>
                              <td className="p-2.5 font-bold text-stone-700">
                                {m.xpm !== undefined ? m.xpm : '—'}
                              </td>
                              <td className="p-2.5 text-stone-600">
                                {m.durationMinutes} mins
                              </td>
                              <td className="p-2.5 text-stone-500 text-[10px]">
                                {new Date(m.startTime).toLocaleDateString()}
                              </td>
                              <td className="p-2.5 font-mono text-[10px] text-purple-700">
                                #{m.matchId}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. HERO POOL SECTION */}
              {dotaSubTab === 'heroes' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-black font-sans">
                      MOST PLAYED HERO POOL
                    </h3>
                    <span className="text-[10px] text-stone-500">
                      Ranked by competitive games recorded
                    </span>
                  </div>

                  {openDotaStats.topHeroes.length === 0 ? (
                    <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-600">
                      <p className="font-bold">Not Available</p>
                      <p className="text-xs text-stone-500 mt-1">No hero match aggregates returned by OpenDota for this player.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {openDotaStats.topHeroes.map((h) => (
                        <div key={h.heroId} className="p-3.5 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000] space-y-1.5">
                          <div className="flex justify-between font-black text-xs text-black">
                            <span className="text-sm">{h.heroName}</span>
                            <span className="text-emerald-700 font-black">{h.winRate}% WR</span>
                          </div>
                          <div className="w-full bg-stone-200 h-2 border border-black">
                            <div className="bg-[#7C3AED] h-full" style={{ width: `${Math.min(100, Math.max(0, h.winRate))}%` }} />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-stone-600 pt-1">
                            <span>{h.games} matches ({h.wins}W - {h.losses}L)</span>
                            {h.withWinRate !== undefined && (
                              <span className="text-stone-500">With: {h.withWinRate}%</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. PERFORMANCE & TOTALS SECTION */}
              {dotaSubTab === 'performance' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-black font-sans">
                      CAREER PERFORMANCE &amp; TOTAL AGGREGATES
                    </h3>
                    <span className="text-[10px] text-stone-500">
                      Aggregated averages from OpenDota telemetry
                    </span>
                  </div>

                  {loadingTotals ? (
                    <div className="p-8 text-center space-y-2">
                      <div className="w-6 h-6 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-stone-600 font-bold">Loading career aggregate totals...</p>
                    </div>
                  ) : totalsData ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. GPM</span>
                        <span className="text-lg font-black text-black block mt-0.5">
                          {totalsData.gpm ? Math.round(totalsData.gpm.avg) : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. XPM</span>
                        <span className="text-lg font-black text-black block mt-0.5">
                          {totalsData.xpm ? Math.round(totalsData.xpm.avg) : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. KDA</span>
                        <span className="text-lg font-black text-[#7C3AED] block mt-0.5">
                          {totalsData.kda
                            ? totalsData.kda.toFixed(2)
                            : totalsData.kills && totalsData.deaths
                            ? ((totalsData.kills.avg + (totalsData.assists?.avg || 0)) / Math.max(1, totalsData.deaths.avg)).toFixed(2)
                            : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. Last Hits</span>
                        <span className="text-lg font-black text-black block mt-0.5">
                          {totalsData.lastHits ? Math.round(totalsData.lastHits.avg) : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. Hero Damage</span>
                        <span className="text-lg font-black text-stone-800 block mt-0.5">
                          {totalsData.heroDamage ? Math.round(totalsData.heroDamage.avg).toLocaleString() : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. Tower Damage</span>
                        <span className="text-lg font-black text-stone-800 block mt-0.5">
                          {totalsData.towerDamage ? Math.round(totalsData.towerDamage.avg).toLocaleString() : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. Hero Healing</span>
                        <span className="text-lg font-black text-emerald-700 block mt-0.5">
                          {totalsData.heroHealing ? Math.round(totalsData.heroHealing.avg).toLocaleString() : 'Not Available'}
                        </span>
                      </div>
                      <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                        <span className="text-[10px] text-stone-500 uppercase font-bold block">Avg. Kills / Deaths</span>
                        <span className="text-lg font-black text-stone-800 block mt-0.5">
                          {totalsData.kills && totalsData.deaths
                            ? `${totalsData.kills.avg.toFixed(1)} / ${totalsData.deaths.avg.toFixed(1)}`
                            : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-600">
                      <p className="font-bold">Not Available</p>
                      <p className="text-xs text-stone-500 mt-1">No career aggregate metrics returned by OpenDota for this player.</p>
                    </div>
                  )}
                </div>
              )}

              {/* 5. PEERS SECTION */}
              {dotaSubTab === 'peers' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black uppercase text-black font-sans">
                      FREQUENT TEAMMATES &amp; OPPONENTS
                    </h3>
                    <span className="text-[10px] text-stone-500">
                      Co-players recorded by OpenDota
                    </span>
                  </div>

                  {loadingPeers ? (
                    <div className="p-8 text-center space-y-2">
                      <div className="w-6 h-6 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-xs text-stone-600 font-bold">Querying frequent co-players...</p>
                    </div>
                  ) : peersData && peersData.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-2 border-black">
                        <thead className="bg-[#FFE600] text-black border-b-2 border-black text-[10px] uppercase font-black">
                          <tr>
                            <th className="p-2.5">Player</th>
                            <th className="p-2.5">Matches Together</th>
                            <th className="p-2.5">Wins</th>
                            <th className="p-2.5">Win Rate</th>
                            <th className="p-2.5">Last Played</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/10">
                          {peersData.map((p) => (
                            <tr key={p.accountId} className="hover:bg-stone-50">
                              <td className="p-2.5">
                                <div className="flex items-center gap-2">
                                  {p.avatarUrl && p.avatarUrl.startsWith('http') ? (
                                    <img src={p.avatarUrl} alt={p.personaName} className="w-6 h-6 rounded-full border border-black" />
                                  ) : (
                                    <span className="text-sm">🎮</span>
                                  )}
                                  <div>
                                    <span className="font-black text-black block">{p.personaName}</span>
                                    <span className="text-[9px] text-stone-500">ID: {p.accountId}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-2.5 font-bold text-stone-800">{p.games}</td>
                              <td className="p-2.5 font-bold text-stone-800">{p.wins}</td>
                              <td className="p-2.5 font-bold text-emerald-700">{p.winRate}%</td>
                              <td className="p-2.5 text-stone-500 text-[10px]">
                                {p.lastPlayed ? new Date(p.lastPlayed).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-600">
                      <p className="font-bold">Not Available</p>
                      <p className="text-xs text-stone-500 mt-1">No frequent teammates or opponents recorded on OpenDota for this player.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-stone-50 border border-black text-stone-600 space-y-2">
              <p className="font-bold">Not Available</p>
              <p className="text-xs text-stone-500">No OpenDota telemetry available or profile is marked private in the Dota 2 client.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: TOURNAMENTS */}
      {activeTab === 'tournaments' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            TOURNAMENT HISTORY &amp; REGISTRATION SNAPSHOTS
          </h2>

          {player.tournamentSnapshots && player.tournamentSnapshots.length > 0 ? (
            <div className="space-y-3">
              {player.tournamentSnapshots.map((t) => (
                <div key={t.tournamentId} className="p-4 bg-stone-50 border-2 border-black flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#000]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-black text-sm">{t.tournamentName}</span>
                      <span className="bg-[#FFE600] border border-black text-[9px] font-black px-1.5 py-0.2">
                        {t.year}
                      </span>
                    </div>
                    <p className="text-stone-600 text-[11px]">
                      Squad: <strong className="text-black">{t.teamName}</strong> · Role: <strong className="text-[#7C3AED]">{t.primaryRole}</strong> · Tourney MMR: <strong className="text-black">{t.lockedTournamentMmr}</strong>
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="bg-[#70FFAF] text-black px-2 py-0.5 border border-black font-black uppercase text-[10px] block">
                      {t.finalPlacement}
                    </span>
                    {t.prizeWonINR > 0 && (
                      <span className="text-[10px] font-bold text-stone-600 block mt-1">
                        Prize: ₹{t.prizeWonINR.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-stone-50 border-2 border-dashed border-stone-300 text-stone-500 space-y-2">
              <Trophy className="w-8 h-8 mx-auto text-stone-400" />
              <p className="font-black text-xs uppercase">No Tournament History Yet</p>
              <p className="text-[11px] text-stone-400">
                Register for an upcoming Dota 2 tournament like the India Dota Open or Purple Bean Test Cup to build your tournament ledger.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: MATCHES */}
      {activeTab === 'matches' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            COMPETITIVE SERIES RECORD
          </h2>
          <div className="space-y-3">
            <div className="p-3 bg-stone-50 border border-black flex items-center justify-between">
              <div>
                <span className="font-black text-black text-sm block">Purple Bean Test Cup · Grand Final</span>
                <span className="text-stone-500 text-[11px]">Mumbai Mavericks vs Hyderabad Raiders · Series won 2-1</span>
              </div>
              <span className="bg-[#70FFAF] text-black px-2 py-0.5 border border-black font-black uppercase text-[10px]">
                VICTORY (MVP)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: TEAMS */}
      {activeTab === 'teams' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            SQUAD AFFILIATIONS
          </h2>
          <div className="p-4 bg-[#FFF9E6] border-2 border-black flex items-center justify-between">
            <div>
              <span className="font-black text-black text-sm block">{player.currentTeamName || 'Free Agent'}</span>
              <span className="text-stone-600 text-[11px]">Active Roster · Official Competition Tag: PBG</span>
            </div>
            <span className="bg-[#70FFAF] text-black px-2 py-0.5 border border-black font-black uppercase text-[10px]">
              ACTIVE
            </span>
          </div>
        </div>
      )}

      {/* Tab 6: AUCTION HISTORY */}
      {activeTab === 'auction' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            AUCTION DRAFT RECORDS
          </h2>
          <div className="p-4 bg-stone-50 border-2 border-black space-y-1">
            <div className="flex justify-between font-black text-sm">
              <span>Purple Bean Test Cup Live Auction</span>
              <span className="text-[#7C3AED]">320,000 Credits</span>
            </div>
            <p className="text-stone-600 text-[11px]">
              Drafted by Mumbai Mavericks (Captain Aether) as Round 1 Priority Recruit.
            </p>
          </div>
        </div>
      )}

      {/* Tab 7: RATING HISTORY */}
      {activeTab === 'ratings' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            COMPETITIVE RATING LEDGER
          </h2>
          <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
            <div className="flex justify-between items-center border-b border-black/10 pb-2">
              <div>
                <span className="font-bold text-black block">PB Test Cup Semifinals</span>
                <span className="text-stone-500 text-[10px]">Match won 2-0 · Strong performance delta</span>
              </div>
              <span className="font-black text-emerald-700 text-sm">+24 (1540 → 1564)</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: CAPTAIN DOSSIER */}
      {activeTab === 'captain' && player.captainRecord && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
          <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            CAPTAINCY CAREER RECORD
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Tournaments Led:</span>
              <span className="text-xl font-black text-black">{player.captainRecord.tournamentsCaptained}</span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Championships:</span>
              <span className="text-xl font-black text-amber-600">{player.captainRecord.championships}</span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Draft Spend:</span>
              <span className="text-xl font-black text-[#7C3AED]">{player.captainRecord.totalAuctionSpend} CR</span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block text-[10px] uppercase font-bold">Reputation Score:</span>
              <span className="text-xl font-black text-emerald-700">{player.captainRecord.reputationScore}/100</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Profile */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div 
            className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#FFE600] border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between font-mono text-xs font-black">
              <span>EDIT DOTA 2 PLAYER PROFILE</span>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-black hover:text-white border border-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 font-mono text-xs space-y-4 max-h-[85vh] overflow-y-auto">
              {editError && (
                <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#FF5757] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-bold">{editError}</span>
                </div>
              )}

              <div>
                <label className="block font-black text-black uppercase text-[11px] mb-1">
                  In-Game Name (IGN) *
                </label>
                <input
                  type="text"
                  required
                  value={editIgn}
                  onChange={(e) => setEditIgn(e.target.value)}
                  className="w-full bg-white border-2 border-black px-3 py-2 font-mono text-xs text-black focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-black uppercase text-[11px] mb-1">
                  Profile Emoji Avatar *
                </label>
                <div className="flex gap-2">
                  {['⚡', '🔥', '🛡️', '🐍', '🗡️', '🔮', '🌟', '🎮'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditAvatar(emoji)}
                      className={`w-9 h-9 border-2 border-black flex items-center justify-center text-lg cursor-pointer ${
                        editAvatar === emoji ? 'bg-[#FFE600] shadow-[2px_2px_0px_0px_#000]' : 'bg-stone-50 hover:bg-stone-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <SelectDropdown
                    label="Primary Role *"
                    value={editPrimaryRole}
                    onChange={(val) => setEditPrimaryRole(val as DotaRolePosition)}
                    options={DOTA_ROLES.map(r => ({ value: r, label: r, icon: Award }))}
                    className="w-full"
                  />
                </div>
                <div>
                  <SelectDropdown
                    label="Secondary Role *"
                    value={editSecondaryRole}
                    onChange={(val) => setEditSecondaryRole(val as DotaRolePosition)}
                    options={DOTA_ROLES.map(r => ({ value: r, label: r, icon: Award }))}
                    className="w-full"
                  />
                </div>
              </div>

              {editPrimaryRole === editSecondaryRole && (
                <p className="text-[10px] text-[#FF5757] font-bold">
                  ⚠️ Primary and Secondary roles cannot be identical.
                </p>
              )}

              <div>
                <SelectDropdown
                  label="City / Base Region *"
                  value={editCity}
                  onChange={(val) => setEditCity(val as IndianCity)}
                  options={INDIAN_CITIES.map(c => ({ value: c, label: `${c}, India`, icon: MapPin }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block font-black text-black uppercase text-[11px] mb-1">
                  Player Bio
                </label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Competitive Dota 2 aspirations, signature heroes, and history..."
                  className="w-full bg-white border-2 border-black p-2 font-mono text-xs text-black focus:outline-hidden"
                />
              </div>

              <div className="bg-stone-50 border border-stone-300 p-2.5 text-[10px] text-stone-600">
                <Info className="w-3.5 h-3.5 text-[#7C3AED] inline mr-1" />
                Note: Updating your ongoing profile does NOT retroactively alter your snapshots in active or past tournament registrations.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-stone-100 border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || editPrimaryRole === editSecondaryRole}
                  className="flex-1 py-2.5 bg-[#FFE600] hover:bg-[#FFE600]/80 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  {savingEdit ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Connect Steam Account */}
      {isSteamModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div 
            className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#FFE600] border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between font-mono text-xs font-black">
              <span>CONNECT STEAM / DOTA 2 IDENTITY</span>
              <button onClick={() => setIsSteamModalOpen(false)} className="p-1 hover:bg-black hover:text-white border border-black cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLinkSteam} className="p-5 font-mono text-xs space-y-4">
              {steamError && (
                <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#FF5757] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-bold">{steamError}</span>
                </div>
              )}

              <p className="text-[11px] text-stone-600 leading-relaxed">
                Enter your 17-digit <strong>Steam64 ID</strong>, 32-bit <strong>Dota Account ID</strong>, or public Steam community profile link.
              </p>

              <div>
                <label className="block font-black text-black uppercase text-[11px] mb-1">
                  Steam Identifier *
                </label>
                <input
                  type="text"
                  required
                  value={steamInput}
                  onChange={(e) => setSteamInput(e.target.value)}
                  placeholder="e.g. 76561198083722517 or 123456789"
                  className="w-full bg-white border-2 border-black px-3 py-2 font-mono text-xs text-black focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-stone-50 border border-black space-y-1 text-[10px] text-stone-600">
                <span className="font-bold text-black block">Verification Honesty Disclosure:</span>
                <span>
                  Initial account linking records your Dota identity as <strong>Linked · Ownership Verification Pending</strong>. Referees verify ownership and match history before locking Tournament MMR.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsSteamModalOpen(false)}
                  className="flex-1 py-2.5 bg-white hover:bg-stone-100 border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linkingSteam}
                  className="flex-1 py-2.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  {linkingSteam ? 'Linking...' : 'Link Steam ID'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
