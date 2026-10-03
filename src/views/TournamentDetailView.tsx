import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Calendar, 
  MapPin, 
  Users, 
  Shield, 
  Swords, 
  Radio, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  FileText,
  Flame,
  ArrowRight,
  TrendingUp,
  Gavel,
  Gamepad2,
  Sparkles,
  UserPlus,
  Bot,
  Play,
  Pause,
  Trash2,
  StopCircle,
  RefreshCw,
  Check
} from 'lucide-react';
import { AdminTournamentPlayerManagerModal } from '../components/AdminTournamentPlayerManagerModal';
import { DoubleEliminationBracket } from '../components/DoubleEliminationBracket';
import { DraftReplayViewer } from '../components/DraftReplayViewer';
import { PremadeTeamManagement } from '../components/PremadeTeamManagement';
import { CompetitionStructureManager } from '../components/CompetitionStructureManager';
import { AuctionDraft } from '../components/AuctionDraft';
import { dotaCompetitionEngine } from '../domain/dotaCompetitionEngine';
import { testCupEngine } from '../domain/testCupEngine';
import { tournamentService } from '../services/firebaseService';
import { dotaTournamentOperations } from '../domain/dotaTournamentOperationsEngine';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';
import { DotaTournamentRegistration } from '../domain/dotaPlayerEngine';
import { Team, ViewType } from '../types/tournament';
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { AlertModal } from '../components/ui/AlertModal';
import { PromptModal } from '../components/ui/PromptModal';

interface TournamentDetailViewProps {
  tournamentId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister: (tournamentId?: string) => void;
}

export function TournamentDetailView({
  tournamentId = '',
  onNavigate,
  onOpenRegister
}: TournamentDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'matches' | 'bracket' | 'standings' | 'teams' | 'players' | 'stats' | 'rules' | 'announcements' | 'auction' | 'auction_replay' | 'structure'
  >('overview');

  const [allTournaments, setAllTournaments] = useState(() => tournamentService.getTournaments('All Games', 'All', true));
  const [allTeams, setAllTeams] = useState(() => tournamentService.getTeams());
  const [allPlayers, setAllPlayers] = useState(() => tournamentService.getPlayers());
  const [allMatches, setAllMatches] = useState(() => tournamentService.getMatches());

  const tournament = (tournamentId ? (tournamentService.getTournamentById(tournamentId) || allTournaments.find((t) => t.id === tournamentId)) : undefined) || allTournaments[0];
  const isTestCup = tournament?.id === 'purple-bean-test-cup';
  const isAuctionSupported = tournamentConfigRegistry.isAuctionSupported(tournament?.id);
  const [auctionLifecycle, setAuctionLifecycle] = useState(() => 
    tournamentConfigRegistry.getAuctionLifecycle(tournament?.id || '')
  );

  const [currentUser, setCurrentUser] = useState(() => tournamentService.getCurrentUser());
  const isSpectator = currentUser.role === 'spectator' || currentUser.id === 'guest-spectator' || !currentUser.email;
  const isOrganiser = !isSpectator && (
    currentUser.role === 'organizer' || 
    currentUser.isAdmin || 
    currentUser.isPrimaryAdmin || 
    (currentUser.email?.toLowerCase().trim() === '11106cm009@gmail.com') || 
    Boolean(tournament && (
      tournament.organiserId === currentUser.id || 
      tournament.organizer === currentUser.id || 
      (tournament.organizerEmail && currentUser.email && tournament.organizerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
    ))
  );
  const [showPlayerManagerModal, setShowPlayerManagerModal] = useState(false);
  const [playerManagerInitialTab, setPlayerManagerInitialTab] = useState<'manual' | 'upload' | 'dummy'>('manual');
  const [userRegistration, setUserRegistration] = useState(() => 
    tournament ? tournamentService.getUserRegistration(tournament.id, tournamentService.getCurrentUser().id) : undefined
  );
  const [tournamentRegistrations, setTournamentRegistrations] = useState<DotaTournamentRegistration[]>(() =>
    tournament ? tournamentService.getTournamentRegistrations(tournament.id) : []
  );
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleMessage, setLifecycleMessage] = useState<string | null>(null);
  const [isConcludeConfirmOpen, setIsConcludeConfirmOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [alertModalState, setAlertModalState] = useState<{ isOpen: boolean; title: string; message: string; variant?: 'error' | 'success' | 'info' } | null>(null);
  const [holdPromptOpen, setHoldPromptOpen] = useState(false);
  const [appointCaptainData, setAppointCaptainData] = useState<{ reg: DotaTournamentRegistration; defaultName: string; defaultTag: string } | null>(null);

  const [testCupState, setTestCupState] = useState(() => ({
    status: testCupEngine.getStatus(),
    teams: testCupEngine.getTeams(),
    players: testCupEngine.getPlayers(),
    matches: testCupEngine.getMatches()
  }));

  // Immediately re-sync when tournamentId or tournament changes
  useEffect(() => {
    if (tournament?.id) {
      const curId = tournament.id;
      setTournamentRegistrations(tournamentService.getTournamentRegistrations(curId));
      setUserRegistration(tournamentService.getUserRegistration(curId, tournamentService.getCurrentUser().id));
      setAuctionLifecycle(tournamentConfigRegistry.getAuctionLifecycle(curId));
    }
  }, [tournament?.id, tournamentId]);

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      const user = tournamentService.getCurrentUser();
      setCurrentUser(user);
      setAllTournaments(tournamentService.getTournaments('All Games', 'All', true));
      setAllTeams(tournamentService.getTeams());
      setAllPlayers(tournamentService.getPlayers());
      setAllMatches(tournamentService.getMatches());
      if (tournament) {
        setUserRegistration(tournamentService.getUserRegistration(tournament.id, user.id));
        setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
        setAuctionLifecycle(tournamentConfigRegistry.getAuctionLifecycle(tournament.id));
      }
    });
    return unsub;
  }, [tournament?.id]);

  useEffect(() => {
    if (tournament?.id) {
      setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
      setAuctionLifecycle(tournamentConfigRegistry.getAuctionLifecycle(tournament.id));
      const engine = getAuctionEngine(tournament.id);
      const unsubAuction = engine.subscribe(() => {
        setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
        setAllTeams(tournamentService.getTeams());
        setAuctionLifecycle(tournamentConfigRegistry.getAuctionLifecycle(tournament.id));
      });
      return unsubAuction;
    }
  }, [tournament?.id]);

  useEffect(() => {
    if (isTestCup) {
      return testCupEngine.subscribe(() => {
        setTestCupState({
          status: testCupEngine.getStatus(),
          teams: testCupEngine.getTeams(),
          players: testCupEngine.getPlayers(),
          matches: testCupEngine.getMatches()
        });
      });
    }
  }, [isTestCup]);

  const effectiveMatches = allMatches;
  const tournamentMatches = isTestCup && testCupState.matches.length > 0 
    ? testCupState.matches 
    : effectiveMatches.filter((m) => m.tournamentId === tournament?.id);

  const auctionEngineTeams = tournament?.id ? getAuctionEngine(tournament.id).getTeams() : [];
  const mappedAuctionTeams: Team[] = auctionEngineTeams.map(at => ({
    id: at.id,
    name: at.name,
    tag: at.tag,
    logo: at.logo || '👑',
    color: at.color || '#7C3AED',
    bgHex: at.color || '#7C3AED',
    captainId: at.captainId,
    captainName: at.captainIgn,
    city: at.primaryRoster[0]?.city || 'India',
    region: at.primaryRoster[0]?.region || 'Pan India',
    country: 'India',
    flag: '🇮🇳',
    primaryGame: 'Dota 2',
    rating: 1500,
    record: { wins: 0, losses: 0 },
    tournamentWins: 0,
    players: at.primaryRoster.map(p => p.userId || p.id),
    standIn: '',
    groupPoints: 0,
    mapsRecord: { won: 0, lost: 0 },
    form: [],
    description: `Official franchise squad commanded by captain ${at.captainIgn}. Starting purse: ${at.startingCredits} Credits. Squad: ${at.primaryRoster.length}/5.`,
    tournamentId: tournament?.id
  }));

  const effectiveTeams = mappedAuctionTeams.length > 0 
    ? mappedAuctionTeams 
    : (isTestCup 
        ? (testCupState.teams.length > 0 ? testCupState.teams : allTeams.filter(t => (t as any).tournamentId === tournament?.id))
        : allTeams.filter(t => (t as any).tournamentId === tournament?.id)
      );
  const effectivePlayers = allPlayers;

  const isPremade = tournament?.id === 'india-dota-open-2026';

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Matches' },
    { id: 'bracket', label: 'Bracket' },
    { id: 'standings', label: 'Standings' },
    { id: 'teams', label: isPremade ? 'Squads & Rosters' : 'Teams' },
    { id: 'players', label: 'Players' },
    ...(isAuctionSupported ? [{ id: 'auction' as const, label: auctionLifecycle.label }] : []),
    ...(isOrganiser ? [{ id: 'structure' as const, label: 'Structure & Seeding' }] : []),
    { id: 'stats', label: 'Stats' },
    { id: 'rules', label: 'Rules' },
    { id: 'announcements', label: 'Announcements' }
  ];

  if (!tournament) {
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8">
        <Trophy className="w-12 h-12 text-[#7C3AED] mx-auto" />
        <h2 className="font-sans font-black text-2xl uppercase">Tournament Not Found</h2>
        <p className="font-mono text-sm text-stone-600 max-w-md mx-auto">
          The requested tournament record could not be found or has not been published yet.
        </p>
        <button
          onClick={() => onNavigate('tournaments')}
          className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          View All Tournaments
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Tournament Header Banner */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-10 space-y-6 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs font-black">
            <span className="bg-[#FFE600] border-2 border-black px-3 py-1 uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5" />
              {tournament.game}
            </span>
            <span className="flex items-center gap-1.5 bg-[#FF5757] text-white border-2 border-black px-3 py-1 uppercase shadow-[2px_2px_0px_0px_#000] animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              {tournament.status}
            </span>
            <span className="bg-[#8B5CF6] text-white border-2 border-black px-3 py-1 uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {tournament.region} {tournament.city ? `· ${tournament.city}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isOrganiser && (
              <button
                onClick={() => onNavigate('organiser_dashboard')}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                <span>Organiser Console</span>
              </button>
            )}

            {isPremade && (
              <button
                onClick={() => setActiveTab('teams')}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Register Squad / Rosters</span>
              </button>
            )}

            {isAuctionSupported && (
              <button
                onClick={() => onNavigate('auction', tournament.id)}
                className="bg-[#FF70A6] hover:bg-[#fa5fa2] text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Gavel className="w-3.5 h-3.5" />
                <span>{auctionLifecycle.label}</span>
              </button>
            )}

            {userRegistration && userRegistration.status !== 'WITHDRAWN' ? (
              <button
                onClick={() => onOpenRegister(tournament.id)}
                className="bg-[#70FFAF] hover:bg-[#5ceba0] text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Entry: {userRegistration.status.replace('_', ' ')}</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenRegister(tournament.id)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-[#FFE600] fill-current" />
                <span>Register for Tournament</span>
              </button>
            )}
          </div>
        </div>

        {/* User Active Registration Banner */}
        {userRegistration && userRegistration.status !== 'WITHDRAWN' && (
          <div className="bg-[#FFF9E6] border-2 border-black p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-[2px_2px_0px_0px_#000]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>
                <strong>YOUR ENTRY STATUS:</strong>{' '}
                <span className="uppercase text-[#7C3AED] font-black">{userRegistration.status.replace('_', ' ')}</span>
              </span>
              <span className="text-stone-400 hidden sm:inline">·</span>
              <span className="text-stone-700">Roles: <strong className="text-black">{userRegistration.primaryRole}</strong> / {userRegistration.secondaryRole}</span>
              <span className="text-stone-400 hidden sm:inline">·</span>
              <span className="text-stone-700">Declared MMR: <strong className="text-black">{userRegistration.declaredMmr?.toLocaleString()}</strong></span>
              {userRegistration.tournamentMmr && (
                <>
                  <span className="text-stone-400 hidden sm:inline">·</span>
                  <span className="text-emerald-800">Calibrated Tourney MMR: <strong>{userRegistration.tournamentMmr.toLocaleString()}</strong></span>
                </>
              )}
            </div>
            <button
              onClick={() => onOpenRegister(tournament.id)}
              className="bg-white hover:bg-stone-100 border border-black px-2.5 py-1 text-[11px] font-black uppercase cursor-pointer shrink-0 shadow-[1px_1px_0px_0px_#000]"
            >
              View / Manage Entry →
            </button>
          </div>
        )}

        {/* User Appointed Captain Notification Card */}
        {userRegistration?.status !== 'WITHDRAWN' && userRegistration?.status !== 'REJECTED' && Boolean(
          userRegistration?.isCaptainApproved || 
          currentUser.role === 'captain' ||
          effectiveTeams.some(t => 
            t.captainId === currentUser.id || 
            (currentUser.email && (t as any).captainEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
            (t.captainName && currentUser.displayName && t.captainName.toLowerCase() === currentUser.displayName.toLowerCase())
          ) ||
          auctionEngineTeams.some(t => 
            t.captainId === currentUser.id || 
            (currentUser.email && (t as any).captainEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
            (t.captainIgn && currentUser.displayName && t.captainIgn.toLowerCase() === currentUser.displayName.toLowerCase())
          )
        ) && (
          <div className="bg-[#70FFAF] text-black border-2 border-black p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs shadow-[3px_3px_0px_0px_#000] animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FFE600] border-2 border-black flex items-center justify-center text-xl shrink-0 shadow-[2px_2px_0px_0px_#000]">
                👑
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-sans font-black text-sm uppercase text-black">
                    You Are Appointed Franchise Captain
                  </span>
                  <span className="bg-[#FFE600] border border-black text-[9px] px-1.5 py-0.2 font-black uppercase">
                    Captain Slot Confirmed
                  </span>
                </div>
                <p className="text-[11px] text-stone-800 mt-0.5">
                  You are leading{' '}
                  <strong>
                    {effectiveTeams.find(t => 
                      t.captainId === currentUser.id || 
                      (currentUser.email && (t as any).captainEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
                      (t.captainName && currentUser.displayName && t.captainName.toLowerCase() === currentUser.displayName.toLowerCase())
                    )?.name || 
                    auctionEngineTeams.find(t => 
                      t.captainId === currentUser.id || 
                      (currentUser.email && (t as any).captainEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
                      (t.captainIgn && currentUser.displayName && t.captainIgn.toLowerCase() === currentUser.displayName.toLowerCase())
                    )?.name || 
                    userRegistration?.teamName || currentUser.teamName || 'Your Franchise'}
                  </strong>{' '}
                  in the Live Captain Auction. Head to the Auction Room to bid on contenders and form your roster!
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('auction', tournament.id)}
              className="bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Gavel className="w-3.5 h-3.5 text-[#FFE600]" />
              <span>Enter Captain Auction Room ↗</span>
            </button>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono font-black text-[#7C3AED] uppercase">
            <span>OFFICIAL PURPLE BEAN GAMING TOURNAMENT</span>
            <span>·</span>
            <span>INDIA REGIONAL CIRCUIT</span>
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase text-black font-sans leading-tight">
            {tournament.name}
          </h1>
          <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-3xl leading-relaxed">
            {tournament.description}
          </p>
        </div>

        {/* Quick Metadata Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t-2 border-black font-mono text-xs">
          <div className="p-3 bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[10px] text-stone-500 uppercase font-black block">Total Prize Pool</span>
            <span className="font-black text-black text-lg text-[#7C3AED]">
              {tournament.prizePoolINR || tournament.prizePool}
            </span>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[10px] text-stone-500 uppercase font-black block">Tournament Dates</span>
            <span className="font-black text-black text-sm">{tournament.dates}</span>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[10px] text-stone-500 uppercase font-black block">Teams / Format</span>
            <span className="font-black text-black text-sm">{tournament.teamCount} Teams · Double Elim</span>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[10px] text-stone-500 uppercase font-black block">Organiser</span>
            <span className="font-black text-black text-sm truncate block">{tournament.organizer}</span>
          </div>
        </div>

        {/* Organiser & Admin Lifecycle Governance Bar */}
        {isOrganiser && (
          <div className="mt-4 pt-4 border-t-2 border-black space-y-3 bg-[#FFFDE8] -mx-6 -mb-6 sm:-mx-8 sm:-mb-8 p-4 sm:p-6 border-b-2 border-black">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black bg-[#FFE600] px-2 py-0.5 border border-black">
                  <Shield className="w-3.5 h-3.5 text-black" />
                  <span>Operations &amp; Lifecycle</span>
                </span>
                <span className="font-mono text-xs font-bold text-stone-700">
                  Status:
                </span>
                <span className={`px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000] ${
                  tournament.status === 'Live' || tournament.lifecycle === 'LIVE' ? 'bg-[#38EF7D] text-black animate-pulse' :
                  tournament.status === 'Drafting' || tournament.lifecycle === 'DRAFTING' ? 'bg-[#8B5CF6] text-white' :
                  tournament.status === 'On Hold' || tournament.lifecycle === 'ON_HOLD' ? 'bg-amber-400 text-black' :
                  tournament.status === 'Completed' || tournament.lifecycle === 'COMPLETED' ? 'bg-stone-300 text-stone-800' :
                  tournament.status === 'Cancelled' || tournament.lifecycle === 'CANCELLED' ? 'bg-red-500 text-white' :
                  'bg-[#FFE600] text-black'
                }`}>
                  {tournament.status}
                </span>
                {(tournament as any).statusReason && (
                  <span className="font-mono text-[11px] text-stone-600 italic">
                    ("{(tournament as any).statusReason}")
                  </span>
                )}
              </div>

              {/* Action Buttons: strictly restricted to tournament Organisers & Platform Admins */}
              {isOrganiser && (
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 1. Advance Lifecycle */}
                  {(tournament.status === 'Registration Open' || tournament.lifecycle === 'REGISTRATION_OPEN') && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={async () => {
                        setLifecycleBusy(true);
                        const res = await tournamentService.setTournamentLifecycle(tournament.id, 'DRAFTING');
                        setLifecycleBusy(false);
                        setLifecycleMessage(res.message || res.error || null);
                        setTimeout(() => setLifecycleMessage(null), 4000);
                      }}
                      className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Gavel className="w-3.5 h-3.5 text-[#FFE600]" />
                      <span>Advance to Draft (DRAFTING) →</span>
                    </button>
                  )}

                  {(tournament.status === 'Drafting' || tournament.lifecycle === 'DRAFTING') && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={async () => {
                        setLifecycleBusy(true);
                        const res = await tournamentService.setTournamentLifecycle(tournament.id, 'LIVE');
                        setLifecycleBusy(false);
                        setLifecycleMessage(res.message || res.error || null);
                        setTimeout(() => setLifecycleMessage(null), 4000);
                      }}
                      className="px-3 py-1.5 bg-[#38EF7D] hover:bg-emerald-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 text-black" />
                      <span>Start Matches (LIVE) →</span>
                    </button>
                  )}

                  {(tournament.status === 'Live' || tournament.lifecycle === 'LIVE') && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={() => setIsConcludeConfirmOpen(true)}
                      className="px-3 py-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Trophy className="w-3.5 h-3.5 text-[#FFE600]" />
                      <span>Conclude Tournament (COMPLETED)</span>
                    </button>
                  )}

                  {/* 2. Hold / Continue */}
                  {(tournament.status === 'On Hold' || tournament.lifecycle === 'ON_HOLD') ? (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={async () => {
                        setLifecycleBusy(true);
                        const res = await tournamentService.resumeTournament(tournament.id);
                        setLifecycleBusy(false);
                        setLifecycleMessage(res.message || res.error || null);
                        setTimeout(() => setLifecycleMessage(null), 4000);
                      }}
                      className="px-3 py-1.5 bg-[#38EF7D] hover:bg-emerald-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 text-black" />
                      <span>Resume / Continue Tournament</span>
                    </button>
                  ) : (
                    tournament.status !== 'Completed' && tournament.status !== 'Cancelled' && (
                      <button
                        type="button"
                        disabled={lifecycleBusy}
                        onClick={() => setHoldPromptOpen(true)}
                        className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5 text-amber-950" />
                        <span>Hold Tournament</span>
                      </button>
                    )
                  )}

                  {/* 3. Cancel Tournament */}
                  {tournament.status !== 'Cancelled' && tournament.status !== 'Completed' && (
                    <button
                      type="button"
                      disabled={lifecycleBusy}
                      onClick={async () => {
                        setLifecycleBusy(true);
                        const res = await tournamentService.setTournamentLifecycle(tournament.id, 'CANCELLED');
                        setLifecycleBusy(false);
                        setLifecycleMessage(res.message || res.error || null);
                        setTimeout(() => setLifecycleMessage(null), 4000);
                      }}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <StopCircle className="w-3.5 h-3.5 text-rose-700" />
                      <span>Cancel Tournament</span>
                    </button>
                  )}

                  {/* 4. Delete Tournament */}
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Permanently remove tournament"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span>Delete</span>
                  </button>
                </div>
              )}

              {/* Informational badge for spectators / non-organisers when tournament is on hold */}
              {!isOrganiser && (tournament.status === 'On Hold' || tournament.lifecycle === 'ON_HOLD') && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border-2 border-black text-amber-950 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]">
                  <Pause className="w-3.5 h-3.5 text-amber-900" />
                  <span>Tournament Status: Temporarily Paused by Organisers</span>
                </div>
              )}
            </div>

            {lifecycleMessage && (
              <div className="p-2 bg-white border border-black font-mono text-xs font-bold text-black flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lifecycleMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-mono text-xs font-black uppercase whitespace-nowrap border-2 border-black transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100 hover:border-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB CONTENT */}
      {/* ============================================================ */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Team Formation & Live Auction Guiding Card (Tournament-Scoped) */}
          {isAuctionSupported && (
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 font-mono">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#7C3AED] block">
                    TEAM FORMATION &amp; ROSTER DRAFT
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans">
                    Captain Purse Auction
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-stone-600">Status:</span>
                  <span className={`px-2.5 py-0.5 border-2 border-black text-xs font-black uppercase ${
                    auctionLifecycle.status === 'LIVE' ? 'bg-[#FF5757] text-white animate-pulse' :
                    (auctionLifecycle.status === 'READY' || effectiveTeams.length >= 2 || auctionEngineTeams.length >= 2) ? 'bg-[#FFE600] text-black' :
                    auctionLifecycle.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black' :
                    'bg-stone-200 text-stone-700'
                  }`}>
                    {auctionLifecycle.status === 'LIVE' ? 'Live Auction' :
                     (auctionLifecycle.status === 'READY' || effectiveTeams.length >= 2 || auctionEngineTeams.length >= 2) ? 'Lobby Ready' :
                     auctionLifecycle.status === 'COMPLETED' ? 'Completed' :
                     (auctionLifecycle.label || 'Waiting for Captain Selection')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-stone-700 leading-relaxed">
                {(auctionLifecycle.status === 'READY' || effectiveTeams.length >= 2 || auctionEngineTeams.length >= 2)
                  ? 'Captains and franchise teams finalized. Ready for nomination and live bidding.'
                  : auctionLifecycle.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => onNavigate('auction', tournament.id)}
                  className={`px-5 py-2.5 text-xs font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all ${
                    auctionLifecycle.status === 'LIVE' ? 'bg-[#FF5757] hover:bg-red-600 text-white' :
                    (auctionLifecycle.status === 'READY' || effectiveTeams.length >= 2 || auctionEngineTeams.length >= 2) ? 'bg-[#FFE600] hover:bg-yellow-400 text-black' :
                    auctionLifecycle.status === 'COMPLETED' ? 'bg-[#70FFAF] hover:bg-emerald-300 text-black' :
                    'bg-stone-100 hover:bg-stone-200 text-black'
                  }`}
                >
                  <Gavel className="w-4 h-4" />
                  <span>{(auctionLifecycle.status === 'READY' || effectiveTeams.length >= 2 || auctionEngineTeams.length >= 2) ? 'ENTER AUCTION LOBBY' : auctionLifecycle.ctaText}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Key Information & Prize Distribution Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Tournament Description & Key Info (7 Cols) */}
            <div className="lg:col-span-7 bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
                KEY INFORMATION &amp; LOGISTICS
              </h2>

              <div className="space-y-3 font-mono text-xs">
                <div className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center">
                  <span className="text-stone-600 font-bold">Game &amp; Client Version:</span>
                  <span className="font-black text-black">{tournament.game} (Competitive Esports Patch)</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center">
                  <span className="text-stone-600 font-bold">Indian Dedicated Server:</span>
                  <span className="font-black text-black">{tournament.keyInfo?.server || 'Mumbai / Chennai Low-Latency Node'}</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center">
                  <span className="text-stone-600 font-bold">Anti-Cheat Standard:</span>
                  <span className="font-black text-black">{tournament.keyInfo?.antiCheat || 'Valve VAC & PBG Integrity Audit'}</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center">
                  <span className="text-stone-600 font-bold">Bracket Structure:</span>
                  <span className="font-black text-black">{tournament.keyInfo?.bracketFormat || (tournament.format || 'Double Elimination')}</span>
                </div>
                <div className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center">
                  <span className="text-stone-600 font-bold">Roster Lock Status:</span>
                  <span className="font-black text-red-600">{tournament.keyInfo?.rosterLock || 'Enforced at Bracket Seeding'}</span>
                </div>
              </div>

              <div>
                <h3 className="font-black uppercase text-sm text-black font-sans mb-2">
                  EVENT DESCRIPTION
                </h3>
                <p className="font-mono text-xs text-stone-700 leading-relaxed bg-[#FFFBEB] p-4 border-2 border-black">
                  {tournament.description} All matches are monitored in real time by Purple Bean Gaming certified Indian referees. Upper bracket matches are Best of 3; the National Grand Final is an epic Best of 5 decider with direct prize distribution.
                </p>
              </div>
            </div>

            {/* Right: Prize Distribution (5 Cols) */}
            <div className="lg:col-span-5 bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
              <h2 className="text-2xl font-black uppercase text-black font-sans border-b-2 border-black pb-2 flex items-center justify-between">
                <span>PRIZE DISTRIBUTION</span>
                <span className="text-sm font-mono font-bold bg-[#FFE600] px-2 py-0.5 border border-black">
                  {tournament.prizePoolINR || tournament.prizePool}
                </span>
              </h2>

              <div className="space-y-3 font-mono text-xs">
                {(tournament.prizeDistribution || []).map((p, idx) => (
                  <div
                    key={p.place}
                    className={`p-3 border-2 border-black flex items-center justify-between ${
                      idx === 0 ? 'bg-[#FFE600] font-black shadow-[2px_2px_0px_0px_#000]' :
                      idx === 1 ? 'bg-stone-100 font-bold' :
                      idx === 2 ? 'bg-[#FFFBEB] font-bold' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-black text-white text-[11px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-black">{p.place}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-black">{p.amount}</span>
                      <span className="text-[10px] text-stone-600 block">({p.percentage})</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-[#70FFAF] border-2 border-black font-mono text-xs text-black shadow-[2px_2px_0px_0px_#000]">
                <span className="font-black uppercase block mb-1">Prize Payment Tracking:</span>
                Direct bank transfer via UPI / IMPS verified and processed for team captains upon tournament finalization.
              </div>
            </div>
          </div>

          {/* Tournament Progress Pipeline */}
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h2 className="text-2xl font-black uppercase text-black font-sans">
                TOURNAMENT PROGRESSION PHASES
              </h2>
              <span className="font-mono text-xs font-black bg-stone-100 border border-black px-2 py-1">
                Phase {Array.isArray(tournament.stages) ? tournament.stages.findIndex(s => s.status === 'current') + 1 || 1 : 1} of {Array.isArray(tournament.stages) ? tournament.stages.length : 3} Active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 font-mono text-xs">
              {(tournament.stages || []).map((stage, idx) => (
                <div
                  key={stage.id}
                  className={`p-3 border-2 border-black flex flex-col justify-between space-y-2 ${
                    stage.status === 'current'
                      ? 'bg-[#FF5757] text-white shadow-[3px_3px_0px_0px_#000] -translate-y-1'
                      : stage.status === 'completed'
                      ? 'bg-[#70FFAF]/40 border-black text-black'
                      : 'bg-stone-100 text-stone-500 border-stone-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[10px]">0{idx + 1}</span>
                    {stage.status === 'completed' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-black" />
                    ) : stage.status === 'current' ? (
                      <Radio className="w-3.5 h-3.5 animate-pulse text-white" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-black text-xs uppercase leading-tight">
                      {stage.name}
                    </div>
                    <div className="text-[10px] opacity-80 mt-1">
                      {stage.date}
                    </div>
                  </div>
                  <div className="text-[9px] font-black uppercase pt-1 border-t border-current/20">
                    {stage.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. MATCHES TAB */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border-[3px] border-black p-4 font-mono text-xs">
            <span className="font-black text-black uppercase">Schedule &amp; Results for {tournament.name}</span>
            <span className="bg-[#FFE600] px-2 py-0.5 border border-black font-bold">
              {tournamentMatches.length} Recorded Series
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournamentMatches.map((m) => (
              <div
                key={m.id}
                onClick={() => onNavigate('match_detail', m.id)}
                className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 space-y-3 font-mono text-xs hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_#000] transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-black uppercase text-stone-600">{m.round}</span>
                  <span className={`px-2 py-0.5 border border-black font-black uppercase text-[10px] ${
                    m.status === 'LIVE' ? 'bg-[#FF5757] text-white animate-pulse' :
                    m.status === 'COMPLETED' ? 'bg-stone-200 text-stone-800' : 'bg-[#5CE1E6] text-black'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.teamA.logo}</span>
                    <span className="font-black text-black text-sm">{m.teamA.name}</span>
                  </div>
                  <span className="text-lg font-black bg-stone-100 border border-black px-2 py-0.5">
                    {m.teamA.score}
                  </span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.teamB.logo}</span>
                    <span className="font-black text-black text-sm">{m.teamB.name}</span>
                  </div>
                  <span className="text-lg font-black bg-stone-100 border border-black px-2 py-0.5">
                    {m.teamB.score}
                  </span>
                </div>

                <div className="pt-2 border-t border-dashed border-stone-400 flex items-center justify-between text-[11px] text-stone-600">
                  <span>{m.seriesFormat} · {m.scheduledTime}</span>
                  <span className="font-bold text-black underline">View Match Room →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. BRACKET TAB */}
      {activeTab === 'bracket' && (
        <div className="space-y-4">
          {isTestCup ? (
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div>
                  <h3 className="text-xl font-black uppercase text-black font-sans">
                    SINGLE ELIMINATION BRACKET (3 TEAMS WITH BYE)
                  </h3>
                  <p className="font-mono text-xs text-stone-600">
                    Dota 2 Championship Structure · Best of 3 Semifinal &amp; Grand Final Decider
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('organiser_dashboard')}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Manage in Organiser Console →
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-mono text-xs">
                {/* Round 1: Semifinal */}
                <div className="space-y-3">
                  <span className="font-black uppercase text-stone-600 block text-xs">
                    ROUND 01: SEMIFINAL (OCT 15 · 17:00 IST)
                  </span>
                  <div className="bg-[#FFFBEB] border-[3px] border-black p-4 space-y-3 shadow-[4px_4px_0px_0px_#000]">
                    <div className="flex items-center justify-between p-2.5 bg-white border border-black">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">⚡</span>
                        <span className="font-black text-black">Mumbai Mavericks</span>
                      </div>
                      <span className="text-lg font-black bg-stone-100 border border-black px-2 py-0.5">
                        {testCupState.matches.find(m => m.id === 'tc-match-semi-1')?.teamA.score || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-white border border-black">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🦅</span>
                        <span className="font-black text-black">Hyderabad Raiders</span>
                      </div>
                      <span className="text-lg font-black bg-stone-100 border border-black px-2 py-0.5">
                        {testCupState.matches.find(m => m.id === 'tc-match-semi-1')?.teamB.score || 0}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 pt-1 text-center">
                      Winner advances to Grand Final decider
                    </div>
                  </div>
                </div>

                {/* Round 2: Grand Final */}
                <div className="space-y-3">
                  <span className="font-black uppercase text-stone-600 block text-xs">
                    ROUND 02: GRAND FINAL (OCT 15 · 20:00 IST)
                  </span>
                  <div className="bg-[#FFFBEB] border-[3px] border-black p-4 space-y-3 shadow-[4px_4px_0px_0px_#000]">
                    <div className="flex items-center justify-between p-2.5 bg-white border border-black">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {testCupState.matches.find(m => m.id === 'tc-match-final')?.teamA.logo || '🏆'}
                        </span>
                        <span className="font-black text-black">
                          {testCupState.matches.find(m => m.id === 'tc-match-final')?.teamA.name || 'Winner of Semifinal'}
                        </span>
                      </div>
                      <span className="text-lg font-black bg-stone-100 border border-black px-2 py-0.5">
                        {testCupState.matches.find(m => m.id === 'tc-match-final')?.teamA.score || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 bg-[#FFF9E6] border border-black">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🔥</span>
                        <div>
                          <span className="font-black text-black block">Bengaluru Blaze</span>
                          <span className="text-[10px] text-emerald-700 font-bold">BYE Advanced Seed</span>
                        </div>
                      </div>
                      <span className="text-lg font-black bg-white border border-black px-2 py-0.5">
                        {testCupState.matches.find(m => m.id === 'tc-match-final')?.teamB.score || 0}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-500 pt-1 text-center">
                      Winner crowned Champion of Purple Bean Test Cup (₹15,000)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <DoubleEliminationBracket tournamentId={tournament.id} onSelectMatch={(mId) => onNavigate('match_detail', mId)} />
          )}
        </div>
      )}

      {/* 4. STANDINGS TAB */}
      {activeTab === 'standings' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
          <div className="p-4 bg-[#E2E8F0] border-b-2 border-black font-mono text-xs font-black uppercase flex items-center justify-between">
            <span>GROUP STAGE &amp; PLAYOFF SEEDING TABLE</span>
            <span>TOP 4 ADVANCE TO UPPER BRACKET</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Team</th>
                  <th className="p-3 text-center">Played</th>
                  <th className="p-3 text-center">Won</th>
                  <th className="p-3 text-center">Lost</th>
                  <th className="p-3 text-center">Maps W-L</th>
                  <th className="p-3 text-center">Points</th>
                  <th className="p-3 text-center">Form</th>
                </tr>
              </thead>
              <tbody className="divide-y border-stone-200">
                {effectiveTeams.map((team, idx) => (
                  <tr
                    key={team.id}
                    onClick={() => onNavigate('team_profile', team.id)}
                    className="hover:bg-[#FFFDE8] transition-colors cursor-pointer group"
                  >
                    <td className="p-3 font-black text-stone-500">
                      <span className={`w-5 h-5 flex items-center justify-center border border-black ${
                        idx < 4 ? 'bg-[#FFE600] text-black font-black' : 'bg-stone-100'
                      }`}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{team.logo}</span>
                        <div>
                          <span className="font-black text-black text-sm group-hover:underline block">
                            {team.name}
                          </span>
                          <span className="text-[10px] text-stone-500">{team.city} · Captain {team.captainName}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold">{(team.record?.wins ?? 0) + (team.record?.losses ?? 0)}</td>
                    <td className="p-3 text-center font-black text-emerald-700">{team.record?.wins ?? 0}</td>
                    <td className="p-3 text-center font-bold text-red-600">{team.record?.losses ?? 0}</td>
                    <td className="p-3 text-center font-bold">{team.mapsRecord?.won ?? 0} - {team.mapsRecord?.lost ?? 0}</td>
                    <td className="p-3 text-center font-black text-black text-sm">
                      <span className="bg-black text-white px-2 py-0.5 inline-block">
                        {team.groupPoints ?? 0}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {Array.isArray(team.form) ? team.form.map((res: string, fIdx: number) => (
                          <span
                            key={fIdx}
                            className={`w-4 h-4 text-[9px] font-black flex items-center justify-center border border-black ${
                              res === 'W' ? 'bg-[#70FFAF] text-black' : 'bg-[#FF5757] text-white'
                            }`}
                          >
                            {res}
                          </span>
                        )) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TEAMS TAB */}
      {activeTab === 'teams' && (
        isPremade ? (
          <PremadeTeamManagement 
            tournamentId={tournament.id} 
            onNavigateTeamProfile={(tId) => onNavigate('team_profile', tId)} 
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isTestCup ? (
            testCupState.teams.map((team) => (
              <div
                key={team.id}
                className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <span className="text-3xl">{team.logo}</span>
                    <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                      {team.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-black uppercase font-sans">
                      {team.name}
                    </h3>
                    <p className="font-mono text-[11px] text-stone-500">
                      Captain: <strong className="text-black">{team.captainName}</strong>
                    </p>
                  </div>
                  <div className="font-mono text-xs space-y-1 bg-[#FFFBEB] p-2.5 border border-black">
                    <div className="flex justify-between">
                      <span className="text-stone-600">Remaining Purse:</span>
                      <span className="font-black text-[#7C3AED]">{team.credits} Credits</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-600">Primary Roster:</span>
                      <span className="font-black text-black">{team.primaryRoster.length} / 5 Slots</span>
                    </div>
                    {team.standIn && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Optional Stand-in:</span>
                        <span className="font-bold">{team.standIn.username}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t-2 border-black font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Drafted Players:</span>
                    <span className="font-bold">{team.primaryRoster.map((p: any) => p.username).join(', ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Competitive Rating:</span>
                    <span className="font-black">{team.rating} Elo</span>
                  </div>
                  {team.placement && (
                    <div className="flex justify-between bg-[#70FFAF] p-1 font-bold">
                      <span>Placement:</span>
                      <span>{team.placement} ({team.earningsINR})</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            effectiveTeams.map((team) => (
              <div
                key={team.id}
                onClick={() => onNavigate('team_profile', team.id)}
                className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-5 space-y-4 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#000] transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <span className="text-3xl">{team.logo}</span>
                    <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                      {team.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-black uppercase font-sans">
                      {team.name}
                    </h3>
                    <p className="font-mono text-[11px] text-stone-500">
                      Captain: <strong className="text-black">{team.captainName}</strong> · {team.city}, India
                    </p>
                  </div>
                  <p className="font-mono text-xs text-stone-600 line-clamp-2">
                    {team.description}
                  </p>
                </div>

                <div className="pt-3 border-t-2 border-black font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-stone-500">Rating:</span>
                    <span className="font-black">{team.rating}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-stone-500">Current Record:</span>
                    <span className="font-black">{(team.record?.wins ?? 0)}W - {(team.record?.losses ?? 0)}L</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate('team_profile', team.id);
                    }}
                    className="w-full py-1.5 bg-stone-100 hover:bg-black hover:text-white border border-black font-bold uppercase text-[10px] transition-colors mt-2"
                  >
                    View Team Profile →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        )
      )}

      {/* 6. PLAYERS TAB */}
      {activeTab === 'players' && (() => {
        const rawRegistrations = tournament 
          ? tournamentService.getTournamentRegistrations(tournament.id)
          : [];
        const engine = getAuctionEngine(tournament.id);
        const enginePlayers = isAuctionSupported ? engine.getPlayers() : [];
        const unsoldContenders = isAuctionSupported ? engine.getUnsoldPlayers() : [];

        // Synthesize any auction engine players that may have been created in auction draft
        const activeRegistrations: DotaTournamentRegistration[] = [...rawRegistrations];
        for (const ep of enginePlayers) {
          const exists = activeRegistrations.some(
            r => r.userId === ep.id || r.userId === ep.userId || (r.ign && ep.username && r.ign.toLowerCase() === ep.username.toLowerCase())
          );
          if (!exists) {
            activeRegistrations.push({
              id: ep.id,
              userId: ep.id,
              tournamentId: tournament.id,
              ign: ep.username,
              primaryRole: ep.primaryRole,
              secondaryRole: ep.secondaryRole || ep.primaryRole,
              declaredMmr: ep.tournamentMmr,
              tournamentMmr: ep.tournamentMmr,
              status: 'VERIFIED',
              city: ep.city || 'India',
              rulesAccepted: true,
              registeredAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }

        const totalCount = activeRegistrations.length > 0
          ? activeRegistrations.length
          : (isTestCup ? testCupState.players.length : 0);

        return (
          <div className="space-y-4">
            {/* Unsold Contenders Alert Banner */}
            {isAuctionSupported && unsoldContenders.length > 0 && (
              <div className="bg-[#FFF4E5] border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <strong className="text-sm font-black uppercase text-black block">
                      {unsoldContenders.length} Contender(s) Passed as UNSOLD in Auction
                    </strong>
                    <p className="text-xs text-stone-600 mt-0.5">
                      These players had no winning bids. You can re-auction them individually or return all unsold players to the draft pool so teams can choose them.
                    </p>
                  </div>
                </div>
                {isOrganiser && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        const res = tournamentService.startDotaUnsoldSecondPass(tournament.id);
                        if (res.success) {
                          setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
                        }
                      }}
                      className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      ⚡ Re-Auction All Unsold ({unsoldContenders.length})
                    </button>
                    <button
                      onClick={() => onNavigate('auction', tournament.id)}
                      className="bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Enter Auction Room ↗
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
              <div className="p-4 bg-[#FFE600] border-b-2 border-black font-mono text-xs font-black uppercase flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span>
                    REGISTERED ROSTER POOL ({totalCount} CONTENDERS)
                  </span>
                  {unsoldContenders.length > 0 && (
                    <span className="bg-[#FF70A6] text-black px-2 py-0.5 border border-black text-[10px]">
                      {unsoldContenders.length} Unsold
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isOrganiser && (
                    <>
                      <button
                        onClick={() => {
                          setPlayerManagerInitialTab('manual');
                          setShowPlayerManagerModal(true);
                        }}
                        className="bg-white hover:bg-stone-100 text-black border-2 border-black px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        + Enter Player / Upload File
                      </button>
                      <button
                        onClick={() => {
                          setPlayerManagerInitialTab('dummy');
                          setShowPlayerManagerModal(true);
                        }}
                        className="bg-[#70FFAF] hover:bg-[#52e896] text-black border-2 border-black px-2.5 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer font-bold"
                      >
                        <Bot className="w-3.5 h-3.5" />
                        ⚡ Add Dummy Players
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => onNavigate(isTestCup ? 'organiser_dashboard' : 'registered_players')}
                    className="bg-black text-white px-2 py-1 hover:bg-stone-800 transition-colors cursor-pointer"
                  >
                    {isTestCup ? 'Organiser Console →' : 'Organiser Directory View →'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                    <tr>
                      <th className="p-3">Player</th>
                      <th className="p-3">Primary Role</th>
                      <th className="p-3">Team</th>
                      <th className="p-3 text-right">MMR</th>
                      <th className="p-3 text-center">Auction / Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-stone-200">
                    {activeRegistrations.length > 0 ? (
                      activeRegistrations.map((reg) => {
                        const isCap = Boolean(reg.isCaptainApproved || reg.interestedInCaptaincy || reg.applyingAsCaptain);
                        const auctionPlayer = engine.getPlayers().find(
                          p => p.userId === reg.userId || p.id === reg.userId || (p.username && reg.ign && p.username.toLowerCase() === reg.ign.toLowerCase())
                        );
                        const assignedTeam = engine.getTeams().find(
                          t => t.captainId === reg.userId || t.primaryRoster.some(p => p.userId === reg.userId || p.id === reg.userId) || t.standIns.some(p => p.userId === reg.userId || p.id === reg.userId)
                        );
                        const isVerified = reg.status === 'VERIFIED';
                        const mmrVal = reg.tournamentMmr || reg.declaredMmr || 0;

                        return (
                          <tr key={reg.id} className="hover:bg-[#FFFDE8] transition-colors">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{auctionPlayer?.avatar || (isCap ? '👑' : '🎮')}</span>
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-black">{reg.ign}</span>
                                    {isCap && (
                                      <span className="bg-[#FFE600] border border-black text-[9px] px-1 font-bold uppercase">
                                        {assignedTeam?.captainId === reg.userId ? 'Captain' : 'Captain Applicant'}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-stone-500 font-normal">
                                    {reg.city || 'India'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 font-bold text-stone-800">
                              {reg.primaryRole}
                              {reg.secondaryRole && <span className="text-[10px] text-stone-500 block">Sec: {reg.secondaryRole}</span>}
                            </td>
                            <td className="p-3 font-bold text-stone-700">
                              {assignedTeam ? `${assignedTeam.name} [${assignedTeam.tag}]` : (auctionPlayer?.isCaptain ? 'Franchise Captain' : 'Draft Eligible')}
                            </td>
                            <td className="p-3 text-right font-black text-black">
                              <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black inline-block">
                                {mmrVal.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${
                                  auctionPlayer?.status === 'SOLD' ? 'bg-[#70FFAF] text-black' :
                                  auctionPlayer?.status === 'UNSOLD' ? 'bg-[#FF70A6] text-black animate-pulse' :
                                  isVerified ? 'bg-[#70FFAF] text-black' :
                                  reg.status === 'UNDER_REVIEW' ? 'bg-[#BAE6FD] text-black' :
                                  'bg-[#FFE600] text-black'
                                }`}>
                                  {auctionPlayer?.status === 'UNSOLD' ? '⚠️ UNSOLD' : (auctionPlayer?.status || reg.status)}
                                </span>
                                {isOrganiser && isAuctionSupported && auctionPlayer?.status === 'UNSOLD' && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        const res = tournamentService.reauctionDotaPlayer(auctionPlayer.id, tournament.id);
                                        if (res.success) {
                                          setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
                                        }
                                      }}
                                      title="Return unsold contender to available auction pool"
                                      className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    >
                                      ⚡ Re-Auction
                                    </button>
                                    <button
                                      onClick={() => {
                                        const res = tournamentService.reauctionAndNominateDotaPlayer(auctionPlayer.id, tournament.id);
                                        if (res.success) {
                                          onNavigate('auction', tournament.id);
                                        }
                                      }}
                                      title="Re-auction and put directly on live block"
                                      className="bg-[#7C3AED] hover:bg-purple-700 text-white border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    >
                                      Nominate ⚡
                                    </button>
                                  </div>
                                )}
                              {isOrganiser && isAuctionSupported && assignedTeam?.captainId !== reg.userId && (
                                <button
                                  onClick={() => {
                                    const defaultName = `${reg.ign}'s Squad`;
                                    const defaultTag = (reg.ign.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'TM').toUpperCase();
                                    setAppointCaptainData({ reg, defaultName, defaultTag });
                                  }}
                                  title="Appoint as Franchise Captain"
                                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000] inline-flex items-center gap-0.5"
                                >
                                  👑 Appoint
                                </button>
                              )}
                              {isOrganiser && isAuctionSupported && assignedTeam?.captainId === reg.userId && (
                                <button
                                  onClick={async () => {
                                    const res = tournamentService.resetDotaCaptain(reg.userId, tournament.id);
                                    if (res.success) {
                                      setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
                                    }
                                  }}
                                  title="Unassign Captain"
                                  className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer"
                                >
                                  Unassign
                                </button>
                              )}
                              {isOrganiser && !isVerified && (
                                <button
                                  onClick={async () => {
                                    await tournamentService.verifyRegistration(tournament.id, reg.userId, reg.declaredMmr);
                                    setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
                                  }}
                                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                >
                                  Verify
                                </button>
                              )}
                              {isOrganiser && (
                                <button
                                  onClick={async () => {
                                    await tournamentService.removeTournamentRegistration(tournament.id, reg.userId);
                                    setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
                                  }}
                                  title="Remove contender from tournament"
                                  className="bg-red-50 hover:bg-red-200 text-red-700 border border-black px-1.5 py-0.5 text-[9px] font-black uppercase cursor-pointer"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : isTestCup ? (
                  testCupState.players.map((player) => (
                    <tr key={player.id} className="hover:bg-[#FFFDE8] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{player.avatar}</span>
                          <div>
                            <span className="font-black text-black block">
                              {player.username}
                              {player.isCaptain && (
                                <span className="ml-1.5 bg-[#FFE600] border border-black text-[9px] px-1 font-bold uppercase">
                                  Captain
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-stone-500 font-normal">
                              {player.realName} · {player.city || 'India'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-stone-800">
                        {player.primaryRole}
                      </td>
                      <td className="p-3 font-bold text-stone-700">
                        {player.teamName || (player.isCaptain ? 'Franchise Captain' : 'Draft Eligible')}
                      </td>
                      <td className="p-3 text-right font-black text-black">
                        <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black inline-block">
                          {player.tournamentMmr.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${
                          player.auctionStatus === 'SOLD' ? 'bg-[#70FFAF] text-black' :
                          player.auctionStatus === 'UNSOLD' ? 'bg-[#FF70A6] text-black' :
                          player.auctionStatus === 'UNSELECTED' ? 'bg-stone-300 text-stone-800' :
                          player.isCaptain ? 'bg-[#FFE600] text-black' :
                          'bg-white text-stone-700'
                        }`}>
                          {player.isCaptain ? 'CAPTAIN' : player.auctionStatus || player.registrationStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-10 text-center bg-stone-50">
                      <div className="space-y-3 max-w-sm mx-auto">
                        <Users className="w-8 h-8 mx-auto text-stone-400" />
                        <h4 className="font-mono text-sm font-black uppercase text-black">
                          No Players Registered Yet
                        </h4>
                        <p className="font-mono text-xs text-stone-600">
                          This tournament has 0 contenders registered. Contenders who register for this championship will appear here in this dedicated roster pool.
                        </p>
                        <button
                          type="button"
                          onClick={() => onOpenRegister(tournament.id)}
                          className="px-4 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>Register for This Tournament →</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );})()}

      {/* 7. STATS TAB */}
      {activeTab === 'stats' && (
        tournamentMatches.filter(m => m.status === 'COMPLETED').length === 0 ? (
          <div className="bg-white border-[3.5px] border-black p-8 text-center shadow-[6px_6px_0px_0px_#000] space-y-3 font-mono">
            <div className="w-12 h-12 mx-auto bg-[#FFE600] border-2 border-black flex items-center justify-center text-xl font-black">
              📊
            </div>
            <h3 className="font-sans font-black text-xl uppercase text-black">No Completed Match Telemetry Yet</h3>
            <p className="text-xs text-stone-600 max-w-md mx-auto">
              Match analytics, hero contest rates, and individual performance metrics will automatically be compiled and published here once tournament series conclude.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
            <div className="bg-white border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3">
              <h3 className="font-black uppercase text-black border-b-2 border-black pb-2 text-sm">
                TOURNAMENT SERIES STATS
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="font-bold">Total Series</span>
                  <span className="font-black text-black">{tournamentMatches.length} Matches</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="font-bold">Completed</span>
                  <span className="font-black text-black">{tournamentMatches.filter(m => m.status === 'COMPLETED').length} Matches</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="font-bold">Live Matches</span>
                  <span className="font-black text-emerald-600">{tournamentMatches.filter(m => m.status === 'LIVE').length} Active</span>
                </div>
              </div>
            </div>

            <div className="bg-white border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3">
              <h3 className="font-black uppercase text-black border-b-2 border-black pb-2 text-sm">
                TEAM PARTICIPATION
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-[#FFFBEB] border border-black">
                  <span className="font-bold">Registered Teams</span>
                  <span className="font-black text-black">{tournament?.teamCount || 0}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="font-bold">Drafted Contenders</span>
                  <span className="font-black text-black">{tournament?.playerCount || 0}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="font-bold">Competition Format</span>
                  <span className="font-black text-black">{tournament?.format || 'Double Elimination'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3">
              <h3 className="font-black uppercase text-black border-b-2 border-black pb-2 text-sm">
                CIRCUIT SERVER NODES
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="text-stone-600">Primary Region:</span>
                  <span className="font-black text-black">{tournament?.region || 'Pan India'}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="text-stone-600">Host City:</span>
                  <span className="font-black text-black">{tournament?.city || 'Mumbai / Bengaluru'}</span>
                </div>
                <div className="flex justify-between p-2 bg-stone-50 border border-black">
                  <span className="text-stone-600">Server Latency:</span>
                  <span className="font-black text-emerald-600">Sub-20ms Verified</span>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* AUCTION & DRAFT TAB */}
      {(activeTab === 'auction' || activeTab === 'auction_replay') && isAuctionSupported && (
        <AuctionDraft onNavigate={onNavigate} tournamentId={tournament.id} />
      )}

      {/* 8. RULES TAB */}
      {activeTab === 'rules' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6 font-mono text-xs leading-relaxed">
          <div className="border-b-2 border-black pb-3">
            <h2 className="text-2xl font-black uppercase text-black font-sans">
              {tournament.name} OFFICIAL RULEBOOK
            </h2>
            <p className="text-stone-600 text-xs">Sanctioned by Purple Bean Gaming India · Official Tournament Rulebook</p>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-black uppercase text-sm text-black mb-1">1. LOBBY TIMINGS &amp; FORFEITS</h3>
              <p className="text-stone-700">
                Squads must check in via the Purple Bean Gaming match lobby 15 minutes prior to scheduled start. A 10-minute grace period applies. Failure to produce 5 verified registered players results in a Game 1 forfeit.
              </p>
            </div>

            <div>
              <h3 className="font-black uppercase text-sm text-black mb-1">2. CAPTAIN DRAFT &amp; ROSTER INTEGRITY</h3>
              <p className="text-stone-700">
                Rosters must match the verified PBG database ID. Any stand-in must be cleared through our referee desk with Aadhaar/Govt ID verification prior to match start.
              </p>
            </div>

            <div>
              <h3 className="font-black uppercase text-sm text-black mb-1">3. DISCONNECTIONS &amp; FIBER OUTAGES</h3>
              <p className="text-stone-700">
                Each team is granted up to 10 minutes of technical pause per map. Dedicated Indian server relays allow seamless reconnects without round resets.
              </p>
            </div>

            <div>
              <h3 className="font-black uppercase text-sm text-black mb-1">4. FAIR PLAY &amp; ANTI-CHEAT POLICY</h3>
              <p className="text-stone-700">
                Any verified secondary account, smurf, or memory injection triggers immediate match forfeiture, total prize forfeiture, and a 24-month ban across all Purple Bean Gaming competitions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 9. COMPETITION STRUCTURE & SEEDING TAB */}
      {activeTab === 'structure' && (
        <CompetitionStructureManager tournamentId={tournament.id} />
      )}

      {/* 10. ANNOUNCEMENTS TAB */}
      {activeTab === 'announcements' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6 font-mono text-xs">
          <div className="border-b-2 border-black pb-3">
            <h2 className="text-2xl font-black uppercase text-black font-sans">
              OFFICIAL BROADCASTS &amp; BULLETINS
            </h2>
            <p className="text-stone-600 text-xs">Public match advisories, schedule revisions, and referee decisions.</p>
          </div>

          <div className="space-y-4">
            {dotaTournamentOperations.getAnnouncements(tournament.id).length === 0 ? (
              <div className="p-8 text-center text-stone-500 bg-stone-50 border-2 border-dashed border-stone-300">
                No announcements broadcast for this tournament yet.
              </div>
            ) : (
              dotaTournamentOperations.getAnnouncements(tournament.id).map((ann) => (
                <div key={ann.id} className="p-4 bg-stone-50 border-2 border-black space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                    <span className="font-black text-sm uppercase text-black">{ann.title}</span>
                    <span className="text-[10px] text-stone-500 font-bold">{new Date(ann.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-stone-800 text-xs leading-relaxed whitespace-pre-line">{ann.content}</p>
                  <div className="text-[10px] text-stone-500 pt-1">
                    Posted by: <strong className="text-black">{ann.authorName}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Admin / Organiser Contender Management Modal */}
      {showPlayerManagerModal && tournament && (
        <AdminTournamentPlayerManagerModal
          isOpen={showPlayerManagerModal}
          onClose={() => setShowPlayerManagerModal(false)}
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          initialTab={playerManagerInitialTab}
          onPlayersUpdated={() => {
            setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
            setAllTeams(tournamentService.getTeams());
            setAllTournaments(tournamentService.getTournaments('All Games', 'All', true));
          }}
        />
      )}

      {/* Neo-brutalist Conclude Tournament Confirmation Modal */}
      {tournament && (
        <ConfirmationModal
          isOpen={isConcludeConfirmOpen}
          onClose={() => setIsConcludeConfirmOpen(false)}
          onConfirm={async () => {
            setIsConcludeConfirmOpen(false);
            setLifecycleBusy(true);
            const res = await tournamentService.setTournamentLifecycle(tournament.id, 'COMPLETED');
            setLifecycleBusy(false);
            setLifecycleMessage(res.message || res.error || null);
            setTimeout(() => setLifecycleMessage(null), 4000);
          }}
          title="Conclude Tournament"
          subtitle="Lifecycle Transition · COMPLETED"
          message={`Are you sure you want to conclude and finalize '${tournament.name}'? This will lock all bracket results, finalize tournament standings, and archive active rosters.`}
          confirmLabel="CONCLUDE TOURNAMENT"
          cancelLabel="KEEP ACTIVE"
          variant="warning"
          details={
            <div className="space-y-1">
              <div><span className="font-bold">Tournament:</span> {tournament.name}</div>
              <div><span className="font-bold">Game Title:</span> {tournament.game}</div>
            </div>
          }
        />
      )}

      {/* Neo-brutalist Delete Tournament Confirmation Modal */}
      {tournament && (
        <ConfirmationModal
          isOpen={isDeleteConfirmOpen}
          onClose={() => setIsDeleteConfirmOpen(false)}
          onConfirm={async () => {
            setIsDeleteConfirmOpen(false);
            setLifecycleBusy(true);
            const res = await tournamentService.deleteTournament(tournament.id);
            setLifecycleBusy(false);
            if (res.success) {
              onNavigate('tournaments');
            } else {
              setLifecycleMessage(res.error || 'Failed to delete tournament.');
            }
          }}
          title="Permanently Delete Tournament"
          subtitle="Destructive Admin Action"
          message={`Are you sure you want to permanently delete '${tournament.name}'? This action cannot be undone and will erase tournament configuration, match history, and records.`}
          confirmLabel="YES, DELETE PERMANENTLY"
          cancelLabel="CANCEL"
          variant="danger"
          details={
            <div className="space-y-1 text-red-950 dark:text-red-300">
              <div><span className="font-bold">Tournament ID:</span> {tournament.id}</div>
              <div><span className="font-bold">Registered Contenders:</span> {tournamentRegistrations.length}</div>
            </div>
          }
        />
      )}

      {/* Neo-brutalist Alert Notice Modal */}
      {alertModalState && (
        <AlertModal
          isOpen={alertModalState.isOpen}
          onClose={() => setAlertModalState(null)}
          title={alertModalState.title}
          message={alertModalState.message}
          variant={alertModalState.variant || 'error'}
        />
      )}

      {/* Neo-brutalist Hold Tournament Prompt Modal */}
      {tournament && (
        <PromptModal
          isOpen={holdPromptOpen}
          onClose={() => setHoldPromptOpen(false)}
          onSubmit={async (reason) => {
            setHoldPromptOpen(false);
            if (!reason.trim()) return;
            setLifecycleBusy(true);
            const res = await tournamentService.setTournamentLifecycle(tournament.id, 'ON_HOLD', reason.trim());
            setLifecycleBusy(false);
            setLifecycleMessage(res.message || res.error || null);
            setTimeout(() => setLifecycleMessage(null), 4000);
          }}
          title="Place Tournament On Hold"
          subtitle="Operational Hold"
          message="Enter reason for holding tournament (e.g. Technical delay, server outage, roster adjustment):"
          defaultValue="Temporary operational hold"
          placeholder="Reason for operational hold..."
          submitLabel="HOLD TOURNAMENT"
        />
      )}

      {/* Neo-brutalist Appoint Captain Prompt Modal */}
      {tournament && appointCaptainData && (
        <PromptModal
          isOpen={Boolean(appointCaptainData)}
          onClose={() => setAppointCaptainData(null)}
          onSubmit={(teamName) => {
            const trimmedName = teamName.trim() || appointCaptainData.defaultName;
            const res = tournamentService.appointDotaCaptain(
              appointCaptainData.reg.userId,
              {
                teamName: trimmedName,
                tag: appointCaptainData.defaultTag,
                color: '#7C3AED',
                logo: '🛡️'
              },
              tournament.id
            );
            setAppointCaptainData(null);
            if (res.success) {
              setTournamentRegistrations(tournamentService.getTournamentRegistrations(tournament.id));
            } else {
              setAlertModalState({
                isOpen: true,
                title: 'Captain Appointment Failed',
                message: res.error || 'Failed to appoint captain.',
                variant: 'error'
              });
            }
          }}
          title={`Appoint ${appointCaptainData.reg.ign} as Captain`}
          subtitle="Franchise Captain Appointment"
          message={`Appoint ${appointCaptainData.reg.ign} as Franchise Captain? Enter custom team/squad name:`}
          defaultValue={appointCaptainData.defaultName}
          placeholder="e.g. Team Secret, Miracle's Squad..."
          submitLabel="APPOINT CAPTAIN"
        />
      )}
    </div>
  );
}
