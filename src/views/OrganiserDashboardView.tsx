import { useState, useEffect } from 'react';
import { 
  Settings, 
  Users, 
  Shield, 
  Swords, 
  Trophy, 
  AlertTriangle, 
  Gavel, 
  CheckCircle, 
  Clock, 
  FileText,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Layers,
  ArrowRight,
  MapPin,
  Flame,
  Radio,
  Gamepad2,
  Sparkles,
  Key,
  Plus,
  Trash2,
  Lock,
  Mail
} from 'lucide-react';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { TestCupLifecycleConsole } from '../components/TestCupLifecycleConsole';
import { ReportItem, ViewType, Player, Team, Match, Tournament } from '../types/tournament';
import { tournamentService, PRIMARY_PROJECT_ADMIN_EMAIL, tournamentToConfig } from '../services/firebaseService';
import { TournamentConfig } from '../domain/tournamentConfig';
import { GenericTournamentEngine } from '../domain/genericTournamentEngine';
import { TournamentCreationWizard } from '../components/TournamentCreationWizard';
import { DynamicOrganiserWorkspace } from '../components/DynamicOrganiserWorkspace';
import { TEST_CUP_GENERIC_CONFIG } from '../domain/testCupEngine';
import { 
  INDIA_DOTA_OPEN_CONFIG, 
  PURPLE_BEAN_CHALLENGER_CONFIG, 
  INITIAL_PREMADE_TEAMS 
} from '../data/seedTournaments';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { RulesManager } from '../components/RulesManager';
import { AnnouncementsManager } from '../components/AnnouncementsManager';
import { ReportsAuditor } from '../components/ReportsAuditor';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { DisqualificationDesk } from '../components/DisqualificationDesk';
import { GameManager } from '../components/GameManager';
import { OpenDotaIntegrationsManager } from '../components/OpenDotaIntegrationsManager';
import { dotaTournamentOperations } from '../domain/dotaTournamentOperationsEngine';

// Global engine registry so tournament instances preserve progress across tab changes
const globalEngines = new Map<string, GenericTournamentEngine>();

function getOrCreateEngine(config: TournamentConfig): GenericTournamentEngine {
  if (!globalEngines.has(config.identity.tournamentId)) {
    const engine = new GenericTournamentEngine(config);
    if (config.identity.tournamentId === 'india-dota-open-2026' || config.identity.tournamentId === 'pb-challenger-2026') {
      INITIAL_PREMADE_TEAMS.forEach(app => {
        engine.submitPremadeTeam(
          app.teamName,
          app.tag,
          app.logo,
          app.homeCity,
          app.managerOrCaptainId,
          app.managerEmail,
          app.roster,
          app.substitutes
        );
        engine.reviewPremadeTeam(app.id, 'APPROVED');
      });
    }
    globalEngines.set(config.identity.tournamentId, engine);
  }
  return globalEngines.get(config.identity.tournamentId)!;
}

interface OrganiserDashboardViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister: () => void;
}

export function OrganiserDashboardView({ onNavigate, onOpenRegister }: OrganiserDashboardViewProps) {
  const [currentUser, setCurrentUser] = useState(() => tournamentService.getCurrentUser());
  const [tournaments, setTournaments] = useState<TournamentConfig[]>(() => {
    const curUser = tournamentService.getCurrentUser();
    const orgTourneys = tournamentService.getOrganiserTournaments(curUser.id);
    orgTourneys.forEach(t => {
      const cfg = (t as any).config || tournamentToConfig(t);
      tournamentConfigRegistry.registerConfig(cfg);
    });
    return tournamentConfigRegistry.getAllConfigs();
  });
  const [activeTournamentId, setActiveTournamentId] = useState<string>(() => {
    const configs = tournamentConfigRegistry.getAllConfigs();
    return configs[0]?.identity.tournamentId || '';
  });
  const [showWizard, setShowWizard] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'registration' | 'captains' | 'draft' | 'matches' | 'reports' | 'rules' | 'announcements' | 'sanctions' | 'audit' | 'settings'
  >('overview');

  const [reports, setReports] = useState<ReportItem[]>(() => tournamentService.getReports());
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<'games' | 'integrations' | 'lifecycle'>('games');
  const [playersList, setPlayersList] = useState<Player[]>(() => tournamentService.getPlayers());
  const [teamsList, setTeamsList] = useState<Team[]>(() => tournamentService.getTeams());
  const [matchesList, setMatchesList] = useState<Match[]>(() => tournamentService.getMatches());

  useEffect(() => {
    const syncTournaments = () => {
      const curUser = tournamentService.getCurrentUser();
      setCurrentUser(curUser);
      setPlayersList(tournamentService.getPlayers());
      setTeamsList(tournamentService.getTeams());
      setMatchesList(tournamentService.getMatches());
      setReports(tournamentService.getReports());

      const orgTourneys = tournamentService.getOrganiserTournaments(curUser.id);
      orgTourneys.forEach(t => {
        const cfg = (t as any).config || tournamentToConfig(t);
        tournamentConfigRegistry.registerConfig(cfg);
      });
      const allConfigs = tournamentConfigRegistry.getAllConfigs();
      setTournaments(allConfigs);
      setActiveTournamentId((prev) => {
        if (prev && allConfigs.some(c => c.identity.tournamentId === prev)) return prev;
        return allConfigs[0]?.identity.tournamentId || '';
      });
    };

    syncTournaments();
    const unsubService = tournamentService.subscribe(syncTournaments);
    const unsubRegistry = tournamentConfigRegistry.subscribe(syncTournaments);
    return () => {
      unsubService();
      unsubRegistry();
    };
  }, []);

  const isAuthorized = currentUser.role === 'organizer' || currentUser.isAdmin || (currentUser.email?.toLowerCase().trim() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase());

  if (!isAuthorized) {
    return (
      <div className="space-y-8 pb-16">
        <div className="bg-[#FFF1F2] border-[3.5px] border-black p-8 sm:p-12 text-center space-y-4 shadow-[8px_8px_0px_0px_#000]">
          <div className="w-16 h-16 mx-auto bg-white border-2 border-black flex items-center justify-center text-red-600 shadow-[3px_3px_0px_0px_#000]">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-xl mx-auto">
            <span className="bg-red-600 text-white px-3 py-1 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">
              ACCESS RESTRICTED
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans">
              ORGANIZER ACCESS REQUIRED
            </h1>
            <p className="font-mono text-xs sm:text-sm text-stone-600">
              The Tournament Operations Desk is reserved exclusively for authorized organizers and platform administrators. Access must be granted by the Primary Project Administrator ({PRIMARY_PROJECT_ADMIN_EMAIL}).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={() => onNavigate('home')}
              className="bg-black text-white hover:bg-stone-800 border-2 border-black px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#FFE600] cursor-pointer"
            >
              Back to Public Home
            </button>
            <button
              onClick={() => onNavigate('tournaments')}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              Browse Tournaments
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectivePlayers = playersList;
  const effectiveTeams = teamsList;
  const effectiveMatches = matchesList;

  const handleTournamentCreated = (newConfig: TournamentConfig, savedTournament?: Tournament) => {
    tournamentConfigRegistry.registerConfig(newConfig);
    getOrCreateEngine(newConfig);
    const allConfigs = tournamentConfigRegistry.getAllConfigs();
    setTournaments(allConfigs);
    setActiveTournamentId(newConfig.identity.tournamentId);
    setShowWizard(false);
  };

  const pendingReportsCount = reports.filter((r) => r.status === 'Pending' || r.status === 'Reviewing').length;

  const handleUpdateStatus = (id: string, newStatus: ReportItem['status']) => {
    setReports((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  };

  const tabs: Array<{ id: typeof activeTab; label: string; icon: typeof Trophy; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'rules', label: 'Rules & Versioning', icon: FileText },
    { id: 'announcements', label: 'Announcements', icon: Radio },
    { id: 'registration', label: 'Registrations (32)', icon: Users },
    { id: 'captains', label: 'Captains (8)', icon: Shield },
    { id: 'draft', label: 'Auction Desk', icon: Gavel },
    { id: 'matches', label: 'Matches (32)', icon: Swords },
    { id: 'reports', label: 'Disputes & Anti-Cheat', icon: AlertTriangle, badge: pendingReportsCount },
    { id: 'sanctions', label: 'Disqualifications', icon: Gavel },
    { id: 'audit', label: 'Audit Ledger', icon: Clock },
    { id: 'settings', label: 'Server & State', icon: Settings },
  ];

  const activeCustomConfig = tournaments.find((t) => t.identity.tournamentId === activeTournamentId);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Shield className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · TOURNAMENT HEADQUARTERS</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
              ORGANISER CONSOLE
            </h1>
            <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl mt-1">
              Select and manage active competition operations across real Firebase databases, live auction desks, and referee match certification.
            </p>
          </div>

          {/* Tournament Selector Controls & Creator Button */}
          <div className="flex flex-wrap items-center gap-2 bg-[#FFFBEB] p-2 border-2 border-black font-mono text-xs font-black shadow-[3px_3px_0px_0px_#000]">
            {tournaments.map((t) => (
              <button
                key={t.identity.tournamentId}
                onClick={() => setActiveTournamentId(t.identity.tournamentId)}
                className={`px-3 py-2 uppercase border-2 border-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTournamentId === t.identity.tournamentId
                    ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                    : 'bg-white text-stone-700 hover:bg-stone-100'
                }`}
              >
                {t.identity.tournamentId === 'purple-bean-test-cup' ? (
                  <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                ) : (
                  <Trophy className="w-3.5 h-3.5 text-stone-700" />
                )}
                <span>{t.identity.name} ({t.identity.gameName})</span>
                {(t.identity.visibility === 'DRAFT' || t.identity.visibility === 'UNLISTED') && (
                  <span className="bg-amber-100 text-amber-900 border border-amber-500 px-1 py-0.5 text-[9px] font-mono font-black">
                    DRAFT
                  </span>
                )}
              </button>
            ))}

            <button
              onClick={() => setShowWizard(true)}
              className="bg-[#7C3AED] hover:bg-purple-700 text-white px-3.5 py-2 uppercase border-2 border-black transition-all cursor-pointer flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000]"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FFE600]" />
              <span>+ Create Tournament</span>
            </button>
          </div>
        </div>
      </div>

      {/* TOURNAMENT CREATION WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-auto">
            <TournamentCreationWizard
              onTournamentCreated={handleTournamentCreated}
              onCancel={() => setShowWizard(false)}
            />
          </div>
        </div>
      )}

      {/* RENDER ACTIVE TOURNAMENT WORKSPACE OR EMPTY STATE */}
      {tournaments.length === 0 ? (
        <div className="bg-white border-[3.5px] border-black p-10 text-center space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <Trophy className="w-12 h-12 text-[#7C3AED] mx-auto" />
          <h2 className="font-sans font-black text-2xl uppercase">No Active Tournaments Configured</h2>
          <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
            You currently have zero tournament fixtures. Launch an official tournament using the Creation Wizard, or open the Admin Simulation Suite to test.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => setShowWizard(true)}
              className="bg-[#FFE600] text-black border-2 border-black px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              + Launch Tournament Creation Wizard
            </button>
          </div>
        </div>
      ) : activeTournamentId === 'purple-bean-test-cup' ? (
        <TestCupLifecycleConsole onNavigate={onNavigate} />
      ) : activeCustomConfig ? (
        <DynamicOrganiserWorkspace
          config={activeCustomConfig}
          engine={getOrCreateEngine(activeCustomConfig)}
          onNavigate={onNavigate}
        />
      ) : (
        <>
          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Registered Squads
              </span>
              <div className="text-2xl font-black font-mono text-black">32 Teams</div>
              <span className="text-[10px] font-mono text-emerald-700 font-bold">● Capacity Filled</span>
            </div>

            <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Franchise Captains
              </span>
              <div className="text-2xl font-black font-mono text-black">8 Finalists</div>
              <span className="text-[10px] font-mono text-stone-600 font-bold">All Rosters Locked</span>
            </div>

            <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Tournament Games
              </span>
              <div className="text-2xl font-black font-mono text-black">28 Series</div>
              <span className="text-[10px] font-mono text-blue-700 font-bold">18 UB / 10 LB</span>
            </div>

            <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Escrow Prize Pool
              </span>
              <div className="text-2xl font-black font-mono text-[#7C3AED]">₹5,00,000</div>
              <span className="text-[10px] font-mono text-emerald-600 font-bold">✓ UPI / IMPS Ready</span>
            </div>

            <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-1 col-span-2 sm:col-span-1">
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Pending Disputes
              </span>
              <div className="text-2xl font-black font-mono text-[#FF5757]">
                {pendingReportsCount} Audits
              </div>
              <span className="text-[10px] font-mono text-red-600 font-bold">Action Required</span>
            </div>
          </div>

          {/* Tabs Row */}
          <div className="flex overflow-x-auto gap-2 p-1.5 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-mono text-xs font-black uppercase whitespace-nowrap border-2 border-black transition-all cursor-pointer flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                    : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100 hover:border-black'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="w-4 h-4 bg-[#FF5757] text-white text-[10px] flex items-center justify-center rounded-full border border-black">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

      {/* ============================================================ */}
      {/* 1. OVERVIEW TAB */}
      {/* ============================================================ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions Matrix */}
            <div className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4">
              <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
                ADMIN QUICK ACTIONS
              </h2>
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                {tournamentConfigRegistry.isAuctionSupported(activeTournamentId) ? (
                  <button
                    onClick={() => onNavigate('auction', activeTournamentId)}
                    className="p-3 bg-[#FFE600] hover:bg-yellow-400 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] text-left cursor-pointer"
                  >
                    <span className="block font-sans text-sm">Launch Live Auction</span>
                    <span className="text-[10px] text-stone-700 font-normal">Active Tournament Room ↗</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate('tournament_detail', activeTournamentId)}
                    className="p-3 bg-stone-100 hover:bg-stone-200 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] text-left cursor-pointer"
                  >
                    <span className="block font-sans text-sm">Squad Management</span>
                    <span className="text-[10px] text-stone-700 font-normal">Premade Squad Rosters</span>
                  </button>
                )}

                <button
                  onClick={() => onNavigate('bracket')}
                  className="p-3 bg-[#70FFAF] hover:bg-emerald-300 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] text-left cursor-pointer"
                >
                  <span className="block font-sans text-sm">Update Bracket</span>
                  <span className="text-[10px] text-stone-700 font-normal">Advance Upper/Lower seeds</span>
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className="p-3 bg-[#FF70A6] hover:bg-pink-300 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] text-left cursor-pointer"
                >
                  <span className="block font-sans text-sm">Smurf / Ping Audits</span>
                  <span className="text-[10px] text-stone-700 font-normal">{pendingReportsCount} investigations open</span>
                </button>

                <button
                  onClick={() => onNavigate('registered_players')}
                  className="p-3 bg-stone-100 hover:bg-stone-200 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] text-left cursor-pointer"
                >
                  <span className="block font-sans text-sm">Aadhaar / KYC Desk</span>
                  <span className="text-[10px] text-stone-700 font-normal">Review Indian IDs</span>
                </button>
              </div>
            </div>

            {/* Server Health Status */}
            <div className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
              <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
                INDIAN SERVERS &amp; MATCH INTEGRITY
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-black">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="font-bold text-black">AWS Mumbai (ap-south-1) Primary</span>
                  </div>
                  <span className="font-black text-emerald-700">12ms · ONLINE</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-black">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span className="font-bold text-black">Azure Bengaluru Edge Relay</span>
                  </div>
                  <span className="font-black text-emerald-700">16ms · ONLINE</span>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-stone-50 border border-black">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    <span className="font-bold text-black">Riot Vanguard / Valve Anti-Cheat Engine</span>
                  </div>
                  <span className="font-black text-emerald-700">ACTIVE SYNC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. REGISTRATION & VERIFICATION TAB */}
      {/* ============================================================ */}
      {activeTab === 'registration' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden space-y-4 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
            <div>
              <h2 className="text-xl font-black uppercase text-black font-sans">
                PLAYER REGISTRATION &amp; VERIFICATION DESK
              </h2>
              <p className="font-mono text-xs text-stone-600">
                Verify declared vs tournament baseline MMR, Aadhaar/KYC identity checks, and player eligibility.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] px-2.5 py-1 border-2 border-black font-mono text-xs font-black">
                Capacity: 32 / 32 Slots Locked
              </span>
            </div>
          </div>

          <div className="overflow-x-auto table-scroll-container">
            <table className="w-full text-left font-mono text-xs min-w-[700px]">
              <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                <tr>
                  <th className="p-3">Player IGN</th>
                  <th className="p-3">Real Name &amp; City</th>
                  <th className="p-3">Primary Role</th>
                  <th className="p-3 text-center">Declared MMR</th>
                  <th className="p-3 text-center">Verified Tournament MMR</th>
                  <th className="p-3 text-center">Eligibility</th>
                  <th className="p-3 text-right">Organizer Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-stone-200">
                {effectivePlayers.slice(0, 10).map((player) => (
                  <tr key={player.id} className="hover:bg-stone-50">
                    <td className="p-3 font-bold text-black flex items-center gap-2">
                      <span>{player.avatar}</span>
                      <span className="font-black">{player.username}</span>
                    </td>
                    <td className="p-3 text-stone-700">
                      {player.realName} · {player.city || 'India'}
                    </td>
                    <td className="p-3 text-stone-600">{player.primaryRole}</td>
                    <td className="p-3 text-center font-bold text-stone-600">{player.mmr}</td>
                    <td className="p-3 text-center font-black text-black">
                      <span className="bg-stone-100 px-2 py-0.5 border border-black font-mono">
                        {player.tournamentMmr || player.mmr}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                        player.status === 'Verified' ? 'bg-[#70FFAF] text-black' : 'bg-[#FFE600] text-black'
                      }`}>
                        {player.status === 'Verified' ? 'VERIFIED ✓' : 'UNDER REVIEW'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={async () => {
                          await tournamentService.updatePlayerStatus(player.id, 'Verified');
                        }}
                        className="px-2.5 py-1 bg-black text-white text-[10px] font-mono font-black uppercase hover:bg-stone-800 cursor-pointer"
                      >
                        Approve KYC
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 3. CAPTAINS TAB */}
      {/* ============================================================ */}
      {activeTab === 'captains' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
            <div>
              <h2 className="text-xl font-black uppercase text-black font-sans">
                FRANCHISE CAPTAIN SELECTION &amp; CONFIRMATION
              </h2>
              <p className="font-mono text-xs text-stone-600">
                Rule: Captains are primary roster members (Captain + 4 drafted players = 5 squad total).
              </p>
            </div>
            <span className="bg-[#7C3AED] text-white px-2.5 py-1 border-2 border-black font-mono text-xs font-black">
              8 Franchise Captains Confirmed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {effectiveTeams.map((team) => (
              <div key={team.id} className="p-4 bg-stone-50 border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-3">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{team.logo}</span>
                    <span className="font-sans font-black text-sm text-black">{team.tag}</span>
                  </div>
                  <span className="bg-[#70FFAF] text-black px-1.5 py-0.5 text-[9px] font-mono font-black border border-black uppercase">
                    CONFIRMED
                  </span>
                </div>
                <div className="font-mono text-xs space-y-1">
                  <div className="font-black text-sm text-black">{team.captainName}</div>
                  <div className="text-stone-500 text-[11px]">{team.city} · {team.primaryGame}</div>
                  <div className="text-stone-700 font-bold pt-1">
                    Purse Budget: <span className="text-[#7C3AED] font-black">₹10,00,000</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate('captain_selection')}
                  className="w-full py-1.5 bg-white hover:bg-stone-200 border border-black font-mono text-[11px] font-black uppercase cursor-pointer"
                >
                  Manage Roster Slots →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. AUCTION DESK TAB */}
      {/* ============================================================ */}
      {activeTab === 'draft' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
            <div>
              <h2 className="text-xl font-black uppercase text-black font-sans">
                AUCTION DESK &amp; LOT MANAGEMENT
              </h2>
              <p className="font-mono text-xs text-stone-600">
                Real-time bidding controller: launch sessions, enforce ₹10L purse caps, and manage sold/unsold queues.
              </p>
            </div>
            <button
              onClick={() => onNavigate('draft')}
              className="px-4 py-2 bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all cursor-pointer"
            >
              Open Live Auction Stage →
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
              <span className="font-black uppercase text-stone-600 block">Lot Feasibility Status</span>
              <div className="text-lg font-black text-emerald-700">✓ DRAFT FEASIBLE</div>
              <p className="text-[11px] text-stone-500">
                All 8 franchises possess adequate purse balances to fill remaining 4 primary roster slots.
              </p>
            </div>
            <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
              <span className="font-black uppercase text-stone-600 block">Anti-Snipe Parameters</span>
              <div className="text-lg font-black text-black">10s Extension / 25s Reset</div>
              <p className="text-[11px] text-stone-500">
                Prevents last-second network latency exploitation.
              </p>
            </div>
            <div className="p-4 bg-stone-50 border-2 border-black space-y-2">
              <span className="font-black uppercase text-stone-600 block">Unsold Queue Protocol</span>
              <div className="text-lg font-black text-[#7C3AED]">Stage 2 Accelerated Pass</div>
              <p className="text-[11px] text-stone-500">
                Unsold players cycle into second round at base ₹10,000 opening lot.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 5. MATCHES TAB */}
      {/* ============================================================ */}
      {activeTab === 'matches' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
            <div>
              <h2 className="text-xl font-black uppercase text-black font-sans">
                MATCH SCHEDULING &amp; RESULT ARBITRATION
              </h2>
              <p className="font-mono text-xs text-stone-600">
                Schedule tournament fixtures, verify anti-cheat server telemetry, and record authoritative match scores.
              </p>
            </div>
            <button
              onClick={() => onNavigate('matches')}
              className="px-3.5 py-1.5 bg-[#70FFAF] text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              Public Match Hub →
            </button>
          </div>

          <div className="space-y-3">
            {effectiveMatches.map((m) => (
              <div key={m.id} className="p-3 bg-stone-50 border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-black text-white px-1.5 py-0.2 text-[10px] font-black">{m.seriesFormat}</span>
                    <span className="font-bold text-stone-700">{m.round}</span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-500">{m.scheduledTime}</span>
                  </div>
                  <div className="font-sans font-black text-base text-black flex items-center gap-2">
                    <span>{m.teamA.name} ({m.teamA.score})</span>
                    <span className="text-stone-400 text-xs">VS</span>
                    <span>{m.teamB.name} ({m.teamB.score})</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 border border-black font-bold uppercase text-[10px] ${
                    m.status === 'LIVE' ? 'bg-[#FF5757] text-white animate-pulse' :
                    m.status === 'COMPLETED' ? 'bg-stone-200' : 'bg-[#5CE1E6] text-black'
                  }`}>
                    {m.status}
                  </span>
                  <button
                    onClick={() => onNavigate('match_detail', m.id)}
                    className="px-2.5 py-1 bg-white hover:bg-stone-200 border border-black font-bold uppercase text-[11px] cursor-pointer"
                  >
                    Edit Result →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. SETTINGS & TOURNAMENT STATE MACHINE TAB */}
      {/* ============================================================ */}
      {activeTab === 'settings' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          {/* Settings Sub-Navigation */}
          <div className="flex flex-wrap items-center gap-2 border-b-2 border-black pb-3">
            <button
              onClick={() => setSettingsSubTab('games')}
              className={`px-3 py-1.5 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                settingsSubTab === 'games'
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              🎮 Game Management
            </button>
            <button
              onClick={() => setSettingsSubTab('integrations')}
              className={`px-3 py-1.5 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                settingsSubTab === 'integrations'
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              📡 Integrations → OpenDota
            </button>
            <button
              onClick={() => setSettingsSubTab('lifecycle')}
              className={`px-3 py-1.5 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                settingsSubTab === 'lifecycle'
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000]'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
              }`}
            >
              ⚙️ State Machine &amp; Lifecycle
            </button>
          </div>

          {settingsSubTab === 'games' && (
            <GameManager />
          )}

          {settingsSubTab === 'integrations' && (
            <OpenDotaIntegrationsManager />
          )}

          {settingsSubTab === 'lifecycle' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div>
                  <h2 className="text-xl font-black uppercase text-black font-sans">
                    TOURNAMENT STATE MACHINE &amp; PROTOCOL RULES
                  </h2>
                  <p className="font-mono text-xs text-stone-600">
                    Deterministic lifecycle management following the canonical state machine: draft → registration → verification → rating_review → player_pool_locked → auction_ready → auction_live → rosters_locked → competition → completed.
                  </p>
                </div>
                <span className="bg-[#70FFAF] text-black px-2.5 py-1 border-2 border-black font-mono text-xs font-black uppercase">
                  Current: COMPETITION (LIVE)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
                <div className="p-4 bg-stone-50 border-2 border-black space-y-3">
                  <span className="font-black text-sm text-black uppercase block">Tournament Lifecycle Controller:</span>
                  <div className="space-y-1.5">
                    {[
                      { key: 'registration', label: '1. Registration Stage', done: true },
                      { key: 'verification', label: '2. KYC & Identity Verification', done: true },
                      { key: 'rating_review', label: '3. Tournament MMR Rating Review', done: true },
                      { key: 'player_pool_locked', label: '4. Player Pool Locked', done: true },
                      { key: 'auction_ready', label: '5. Auction Desk Ready', done: true },
                      { key: 'auction_live', label: '6. Live Captain Auction', done: true },
                      { key: 'rosters_locked', label: '7. Final Rosters Locked', done: true },
                      { key: 'competition', label: '8. National Competition (LIVE NOW)', active: true },
                      { key: 'completed', label: '9. Completed & INR Escrow Disbursed' }
                    ].map((stg) => (
                      <div key={stg.key} className={`p-2 border flex items-center justify-between ${
                        stg.active ? 'bg-[#FFE600] font-black border-black shadow-[2px_2px_0px_0px_#000]' :
                        stg.done ? 'bg-white border-stone-300 text-stone-700' : 'bg-stone-100 text-stone-400 border-stone-200'
                      }`}>
                        <span>{stg.label}</span>
                        {stg.done && <span className="text-emerald-600 font-black">✓ DONE</span>}
                        {stg.active && <span className="bg-black text-white px-1.5 py-0.2 text-[9px] uppercase">ACTIVE</span>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-stone-50 border-2 border-black space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="font-black text-sm text-black uppercase block mb-2">Advance Stage Action:</span>
                    <p className="text-stone-600 text-xs leading-relaxed">
                      Only authorized organizers can transition states. Validated by PostgreSQL security definer function <code className="bg-stone-200 px-1 font-bold">canTransitionTournament()</code>.
                    </p>
                    <div className="mt-3 p-3 bg-white border border-black space-y-1 text-[11px]">
                      <div>• Indian Escrow Payout: <strong className="text-emerald-700">₹5,00,000 Verified</strong></div>
                      <div>• Server Reliability: <strong className="text-black">100% Uptime (AWS Mumbai)</strong></div>
                      <div>• Roster Rule Compliance: <strong className="text-black">5 Players / Squad Enforced</strong></div>
                    </div>
                  </div>

                  <button
                    onClick={() => alert('Tournament state synchronized with canonical database!')}
                    className="w-full py-2.5 bg-black hover:bg-stone-800 text-white font-mono text-xs font-black uppercase cursor-pointer"
                  >
                    Synchronize Platform Engine
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. DISPUTES & REPORTS TAB */}
      {/* ============================================================ */}
      {activeTab === 'reports' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
          <div className="p-4 bg-[#FF5757] text-white border-b-2 border-black font-mono text-xs font-black uppercase flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-white" />
              <span>INDIAN ESPORTS INTEGRITY &amp; DISPUTE DESK</span>
            </span>
            <span className="bg-black text-white px-2 py-0.5 border border-white">
              {pendingReportsCount} Actionable Cases
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                <tr>
                  <th className="p-3">Case ID</th>
                  <th className="p-3">Target Entity</th>
                  <th className="p-3">Report Reason</th>
                  <th className="p-3">Filed By</th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-right">Referee Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-stone-200">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-stone-50">
                    <td className="p-3 font-black text-black">{rep.id}</td>
                    <td className="p-3 font-bold text-black">{rep.reportedEntity}</td>
                    <td className="p-3">
                      <span className="bg-red-100 text-red-700 border border-red-300 px-2 py-0.5 text-[10px] font-bold">
                        {rep.reason}
                      </span>
                    </td>
                    <td className="p-3 text-stone-600">{rep.reporter}</td>
                    <td className="p-3 text-stone-500">{rep.submittedTime}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                        rep.status === 'Resolved' ? 'bg-[#70FFAF] text-black' :
                        rep.status === 'Reviewing' ? 'bg-[#FFE600] text-black' :
                        rep.status === 'Pending' ? 'bg-[#FF5757] text-white animate-pulse' : 'bg-stone-200'
                      }`}>
                        {rep.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedReport(rep)}
                        className="bg-black hover:bg-stone-800 text-white px-2.5 py-1 text-[11px] font-bold uppercase cursor-pointer"
                      >
                        Inspect Dossier →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. RULES & VERSIONING TAB */}
      {/* ============================================================ */}
      {activeTab === 'rules' && (
        <RulesManager tournamentId={activeTournamentId} />
      )}

      {/* ============================================================ */}
      {/* 9. ANNOUNCEMENTS TAB */}
      {/* ============================================================ */}
      {activeTab === 'announcements' && (
        <AnnouncementsManager tournamentId={activeTournamentId} />
      )}

      {/* ============================================================ */}
      {/* 10. DISQUALIFICATIONS & SANCTIONS TAB */}
      {/* ============================================================ */}
      {activeTab === 'sanctions' && (
        <DisqualificationDesk tournamentId={activeTournamentId} />
      )}

      {/* ============================================================ */}
      {/* 11. AUDIT TIMELINE LEDGER TAB */}
      {/* ============================================================ */}
      {activeTab === 'audit' && (
        <AuditLogViewer tournamentId={activeTournamentId} />
      )}
      </>
      )}

      {/* Dispute Dossier Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          isOpen={!!selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
