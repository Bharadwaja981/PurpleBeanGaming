import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Key, 
  UserCheck, 
  Plus, 
  Trash2, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Mail, 
  HelpCircle, 
  Copy, 
  Check, 
  Loader2,
  Trophy,
  Sliders,
  Users,
  Gavel,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Globe,
  Trash
} from 'lucide-react';
import { 
  tournamentService, 
  UserSession, 
  PRIMARY_PROJECT_ADMIN_EMAIL,
  RoleAssignment 
} from '../services/firebaseService';
import { 
  testCupEngine, 
  TEST_CUP_CONFIG, 
  TestCupPlayerRecord, 
  TestCupTeamRecord 
} from '../domain/testCupEngine';
import { dotaAuctionEngine } from '../domain/dotaAuctionEngine';
import { PurpleBeanLogo } from './PurpleBeanLogo';
import { Tournament, Team, Player, Match } from '../types/tournament';

interface AdminCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBrandKit?: () => void;
}

export function AdminCredentialsModal({ isOpen, onClose, onOpenBrandKit }: AdminCredentialsModalProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'simulation' | 'purge' | 'brand'>('roles');
  const [currentUser, setCurrentUser] = useState<UserSession>(() => tournamentService.getCurrentUser());
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(() => tournamentService.getRoleAssignments());
  
  // Role assignment state
  const [newEmail, setNewEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<'organizer' | 'moderator' | 'admin'>('organizer');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Simulation Studio State
  const [simTournamentName, setSimTournamentName] = useState('Purple Bean Invitational 2026');
  const [simGame, setSimGame] = useState('Dota 2');
  const [simPrize, setSimPrize] = useState('₹50,000');
  const [simStartingCredits, setSimStartingCredits] = useState(1000);
  const [simDummyCount, setSimDummyCount] = useState(16);
  const [simCaptainsCount, setSimCaptainsCount] = useState(3);
  const [simState, setSimState] = useState(() => ({
    status: testCupEngine.getStatus(),
    players: testCupEngine.getPlayers(),
    teams: testCupEngine.getTeams(),
    matches: testCupEngine.getMatches(),
    auction: testCupEngine.getAuctionState()
  }));

  // Purge confirmation state
  const [isPurging, setIsPurging] = useState(false);

  useEffect(() => {
    const unsubService = tournamentService.subscribe(() => {
      setCurrentUser(tournamentService.getCurrentUser());
      setRoleAssignments(tournamentService.getRoleAssignments());
    });

    const unsubEngine = testCupEngine.subscribe(() => {
      setSimState({
        status: testCupEngine.getStatus(),
        players: testCupEngine.getPlayers(),
        teams: testCupEngine.getTeams(),
        matches: testCupEngine.getMatches(),
        auction: testCupEngine.getAuctionState()
      });
    });

    return () => {
      unsubService();
      unsubEngine();
    };
  }, []);

  if (!isOpen) return null;

  const userEmail = (currentUser.email || '').toLowerCase().trim();
  const isPrimaryAdmin = userEmail === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase();
  const isAuthorizedAdmin = isPrimaryAdmin || currentUser.isAdmin;

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleGrantRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    const res = await tournamentService.assignUserRole(newEmail.trim(), selectedRole);
    if (res.success) {
      showFeedback(res.message, 'success');
      setNewEmail('');
    } else {
      showFeedback(res.message, 'error');
    }
  };

  const handleRevokeRole = async (emailToRevoke: string) => {
    const res = await tournamentService.revokeUserRole(emailToRevoke);
    if (res.success) {
      showFeedback(res.message, 'success');
    } else {
      showFeedback(res.message, 'error');
    }
  };

  const handleCopyCurrentEmail = () => {
    if (currentUser.email) {
      navigator.clipboard.writeText(currentUser.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Simulation Studio Handlers
  const handleGenerateDummies = () => {
    try {
      testCupEngine.generateDummyPlayersAndCaptains(simDummyCount, simCaptainsCount, {
        name: simTournamentName,
        startingCredits: simStartingCredits,
        prizePoolINR: simPrize
      });
      dotaAuctionEngine.syncFromTestCupEngine(testCupEngine.getPlayers(), testCupEngine.getTeams());
      showFeedback(`Generated ${simDummyCount} dummy players & ${simCaptainsCount} team captains across Test Cup & Live Auction draft!`, 'success');
    } catch (err: any) {
      showFeedback(`Failed to generate dummy players: ${err.message}`, 'error');
    }
  };

  const handleAutoSimulateAuction = () => {
    try {
      const res = testCupEngine.autoSimulateFullAuction();
      dotaAuctionEngine.syncFromTestCupEngine(testCupEngine.getPlayers(), testCupEngine.getTeams());
      showFeedback(`Auction simulated! ${res.soldCount} players drafted onto squads.`, 'success');
    } catch (err: any) {
      showFeedback(`Auction simulation failed: ${err.message}`, 'error');
    }
  };

  const handleFastForwardTournament = () => {
    try {
      const res = testCupEngine.fastForwardWholeTournament();
      showFeedback(`Tournament completed! 🏆 Champion: ${res.champion}`, 'success');
    } catch (err: any) {
      showFeedback(`Tournament lifecycle error: ${err.message}`, 'error');
    }
  };

  const handlePublishToLiveApp = () => {
    try {
      const enginePlayers = testCupEngine.getPlayers();
      const engineTeams = testCupEngine.getTeams();
      const engineMatches = testCupEngine.getMatches();

      if (engineTeams.length === 0) {
        showFeedback('Please generate teams first before publishing.', 'error');
        return;
      }

      const tourneyId = `test-tourney-${Date.now()}`;
      const publishedTourney: Tournament = {
        id: tourneyId,
        name: simTournamentName,
        game: simGame,
        status: testCupEngine.getStatus() === 'Completed' ? 'Completed' : 'Live',
        format: 'Single Elimination',
        prizePool: simPrize,
        totalPrizeNumber: 50000,
        prizePoolINR: simPrize,
        teamCount: engineTeams.length,
        playerCount: enginePlayers.length,
        dates: 'Live Test Cup',
        startDate: '2026-10-01',
        endDate: '2026-10-05',
        region: 'Pan India',
        city: 'Mumbai',
        organizer: 'Purple Bean Admin',
        description: `Authoritative test tournament for ${simGame} configured by Administrator.`,
        keyInfo: {
          server: 'Mumbai Relays',
          antiCheat: 'Server-Authoritative Referee Engine',
          bracketFormat: 'Single Elimination',
          rosterLock: 'Enforced'
        },
        prizeDistribution: [
          { place: '1st Place (Champion)', amount: '₹30,000', percentage: '60%' },
          { place: '2nd Place (Runner-up)', amount: '₹14,000', percentage: '28%' },
          { place: '3rd Place', amount: '₹6,000', percentage: '12%' }
        ],
        stages: [
          { id: 'stage-1', name: 'Draft Auction', status: 'completed', date: 'Day 1' },
          { id: 'stage-2', name: 'Bracket Competition', status: 'current', date: 'Day 2' }
        ]
      };

      tournamentService.addTestTournament(publishedTourney);

      const mappedPlayers: Player[] = enginePlayers.map(p => ({
        id: p.id,
        username: p.username,
        realName: p.realName,
        avatar: p.avatar,
        country: 'India',
        flag: '🇮🇳',
        city: p.city,
        region: p.region,
        primaryGame: simGame,
        mmr: p.mmr,
        tournamentMmr: p.tournamentMmr,
        platformRating: p.rating,
        primaryRole: p.primaryRole,
        secondaryRole: p.secondaryRole,
        teamId: p.teamId,
        teamName: p.teamName,
        status: 'Verified',
        matches: 12,
        wins: 8,
        losses: 4,
        winRate: 66.7,
        tournamentWins: 1,
        mvps: 2,
        experienceYears: 4,
        previousCaptainRecord: p.isCaptain ? '12-2 (86% WR)' : 'N/A',
        bio: `${p.username} — Competitive ${simGame} tournament participant.`,
        heroPool: []
      }));
      tournamentService.addDummyPlayers(mappedPlayers);

      const mappedTeams: Team[] = engineTeams.map(t => ({
        id: t.id,
        name: t.name,
        tag: t.tag,
        logo: t.logo,
        color: t.color,
        bgHex: '#FAF8F5',
        country: 'India',
        flag: '🇮🇳',
        city: 'Mumbai',
        region: 'Pan India',
        primaryGame: simGame,
        rating: t.rating,
        record: { wins: 1, losses: 1 },
        tournamentWins: 0,
        captainId: t.captainId,
        captainName: t.captainName,
        players: t.primaryRoster.map(player => player.id),
        standIn: t.standIn ? t.standIn.id : '',
        groupPoints: 3,
        mapsRecord: { won: 2, lost: 1 },
        form: ['W', 'L'],
        description: `Official competitive squad for ${simTournamentName}.`,
        earningsINR: '₹0'
      }));
      tournamentService.addTestTeams(mappedTeams);

      if (engineMatches.length > 0) {
        tournamentService.addTestMatches(engineMatches);
      }

      showFeedback(`Test tournament "${simTournamentName}" published to live app!`, 'success');
    } catch (err: any) {
      showFeedback(`Failed to publish: ${err.message}`, 'error');
    }
  };

  const handlePurgeAllData = async () => {
    if (!window.confirm('Are you sure you want to permanently delete ALL test data, mockup players, test teams, and mock tournaments?')) {
      return;
    }

    setIsPurging(true);
    try {
      const res = await tournamentService.purgeAllTestData();
      testCupEngine.purge();
      dotaAuctionEngine.purge();
      showFeedback(res.message, 'success');
    } catch (err: any) {
      showFeedback(`Purge failed: ${err.message}`, 'error');
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white border-[4px] border-black shadow-[12px_12px_0px_0px_#000] my-8 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#7C3AED] text-white p-5 border-b-[3.5px] border-black flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFE600] text-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_#000]">
              <Key className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-sans font-black text-xl uppercase tracking-tight">
                  ADMIN CONTROL &amp; GOVERNANCE SUITE
                </h2>
                <span className="px-2 py-0.5 bg-black text-[#FFE600] border border-black text-[10px] font-mono font-black uppercase">
                  Root Admin
                </span>
              </div>
              <p className="font-mono text-xs text-[#F3E8FF] font-medium">
                Purple Bean Esports Authority · Role-Based Access Control · Test Tournament Studio
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-white text-black hover:bg-black hover:text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-stone-100 border-b-2 border-black px-5 flex flex-wrap gap-2 pt-2">
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-t-2 border-x-2 border-black -mb-[2px] cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'roles'
                ? 'bg-white text-black border-b-2 border-b-white z-10 shadow-[2px_-2px_0px_0px_#000]'
                : 'bg-stone-200 text-stone-600 hover:bg-stone-300 border-b-2 border-b-black'
            }`}
          >
            <Shield className="w-4 h-4 text-[#7C3AED]" />
            <span>1. Access &amp; Roles Governance</span>
          </button>

          <button
            onClick={() => setActiveTab('simulation')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-t-2 border-x-2 border-black -mb-[2px] cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'simulation'
                ? 'bg-white text-black border-b-2 border-b-white z-10 shadow-[2px_-2px_0px_0px_#000]'
                : 'bg-stone-200 text-stone-600 hover:bg-stone-300 border-b-2 border-b-black'
            }`}
          >
            <Sliders className="w-4 h-4 text-[#E11D48]" />
            <span>2. Test Tournament &amp; Simulation Studio</span>
          </button>

          <button
            onClick={() => setActiveTab('purge')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-t-2 border-x-2 border-black -mb-[2px] cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'purge'
                ? 'bg-white text-black border-b-2 border-b-white z-10 shadow-[2px_-2px_0px_0px_#000]'
                : 'bg-stone-200 text-stone-600 hover:bg-stone-300 border-b-2 border-b-black'
            }`}
          >
            <Trash className="w-4 h-4 text-red-600" />
            <span>3. Database Purge &amp; Reset</span>
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-t-2 border-x-2 border-black -mb-[2px] cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'brand'
                ? 'bg-white text-black border-b-2 border-b-white z-10 shadow-[2px_-2px_0px_0px_#000]'
                : 'bg-stone-200 text-stone-600 hover:bg-stone-300 border-b-2 border-b-black'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#F59E0B]" />
            <span>4. Brand &amp; Mascot Assets</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 font-mono text-xs max-h-[72vh] overflow-y-auto">
          
          {/* Feedback Toast */}
          {feedback && (
            <div
              className={`p-3 border-2 border-black font-mono text-xs font-bold flex items-center gap-2 shadow-[3px_3px_0px_0px_#000] ${
                feedback.type === 'success' ? 'bg-[#38EF7D] text-black' : 'bg-[#FF5757] text-white'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Access Warning if user is not authorized */}
          {!isAuthorizedAdmin && (
            <div className="bg-[#FFF1F2] border-[3px] border-red-500 p-5 space-y-3 shadow-[4px_4px_0px_0px_#000]">
              <div className="flex items-center gap-2 text-red-600 font-sans font-black text-sm uppercase">
                <Lock className="w-5 h-5 shrink-0" />
                <span>RESTRICTED ACCESS: PRIMARY ADMIN AUTHENTICATION REQUIRED</span>
              </div>
              <p className="font-mono text-xs text-stone-700 leading-relaxed">
                Role management, simulation controls, and database maintenance are strictly restricted to the Primary Project Administrator (<code className="bg-white px-1.5 py-0.5 border border-black font-bold font-mono">11106cm009@gmail.com</code>).
              </p>
              {!currentUser.email && (
                <button
                  disabled={isSigningIn}
                  onClick={async () => {
                    if (isSigningIn) return;
                    setIsSigningIn(true);
                    try {
                      await tournamentService.signInWithGoogle();
                    } catch (e) {
                      console.warn('Sign in note:', e);
                    } finally {
                      setIsSigningIn(false);
                    }
                  }}
                  className="w-full py-2.5 bg-black text-white hover:bg-stone-800 font-mono text-xs font-black uppercase flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                >
                  {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Mail className="w-4 h-4" />}
                  <span>Sign In as Primary Admin (11106cm009@gmail.com)</span>
                </button>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: ACCESS & ROLE GOVERNANCE */}
          {/* ======================================================== */}
          {activeTab === 'roles' && (
            <div className="space-y-6">
              {/* Active Admin Session Status */}
              <div className="bg-[#FAF8F5] border-[3px] border-black p-4 space-y-3 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black font-black uppercase text-black text-xs">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#7C3AED]" />
                    ACTIVE SIGNED-IN ACCOUNT
                  </span>
                  <span
                    className={`px-2 py-0.5 border border-black text-[10px] font-black ${
                      isPrimaryAdmin ? 'bg-[#FFE600] text-black' : isAuthorizedAdmin ? 'bg-[#38EF7D] text-black' : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    {isPrimaryAdmin ? 'PRIMARY OWNER ★' : isAuthorizedAdmin ? 'VERIFIED ADMIN ✓' : 'PUBLIC USER'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 font-bold block text-[10px] uppercase">Google Account:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-black text-black truncate max-w-[240px]">
                        {currentUser.email || 'Unauthenticated (Public Spectator)'}
                      </span>
                      {currentUser.email && (
                        <button
                          onClick={handleCopyCurrentEmail}
                          className="text-stone-500 hover:text-black cursor-pointer"
                          title="Copy email"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-stone-500 font-bold block text-[10px] uppercase">Effective System Role:</span>
                    <span className="font-black text-[#7C3AED] uppercase mt-0.5 block">
                      {isPrimaryAdmin ? 'Root Project Admin' : currentUser.role} {currentUser.isAdmin && !isPrimaryAdmin ? '(Admin Rights)' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explanatory Guide */}
              <div className="bg-[#FFFBEB] border-[3px] border-black p-4 space-y-2 shadow-[3px_3px_0px_0px_#000]">
                <div className="flex items-center gap-1.5 font-black uppercase text-black text-xs">
                  <Shield className="w-4 h-4 text-[#7C3AED]" />
                  <span>HOW ROLE PERMISSIONS &amp; DELEGATION WORK:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-stone-700">
                  <div className="bg-white p-2.5 border-2 border-black space-y-1">
                    <span className="font-black text-black block uppercase text-[10px]">👑 ORGANIZER</span>
                    <p className="text-stone-600">Can create tournaments, manage captain draft auctions, edit matches, and score brackets.</p>
                  </div>
                  <div className="bg-white p-2.5 border-2 border-black space-y-1">
                    <span className="font-black text-black block uppercase text-[10px]">🛡️ MODERATOR</span>
                    <p className="text-stone-600">Can review player reports, anti-cheat allegations, referee audits, and handle disputes.</p>
                  </div>
                  <div className="bg-white p-2.5 border-2 border-black space-y-1">
                    <span className="font-black text-black block uppercase text-[10px]">⚡ CO-ADMIN</span>
                    <p className="text-stone-600">Full administrative rights alongside the primary admin to configure system settings.</p>
                  </div>
                </div>
              </div>

              {/* Grant Role Form (Primary Admin Only) */}
              <div className="bg-white border-[3px] border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
                <span className="font-black uppercase text-black text-xs block">
                  ASSIGN ROLE TO NEW USER EMAIL
                </span>
                <form onSubmit={handleGrantRole} className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="e.g. colleague@gmail.com"
                      required
                      className="w-full bg-stone-50 border-2 border-black p-2.5 font-mono text-xs focus:bg-white focus:outline-hidden"
                    />
                  </div>
                  <select
                    value={selectedRole}
                    onChange={(e: any) => setSelectedRole(e.target.value)}
                    className="bg-stone-50 border-2 border-black p-2.5 font-mono text-xs font-bold uppercase focus:outline-hidden cursor-pointer shrink-0"
                  >
                    <option value="organizer">👑 Organizer</option>
                    <option value="moderator">🛡️ Moderator</option>
                    <option value="admin">⚡ Co-Admin</option>
                  </select>
                  <button
                    type="submit"
                    disabled={!isAuthorizedAdmin}
                    className={`px-4 py-2.5 bg-[#FFE600] text-black hover:bg-[#FFDE59] border-2 border-black font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] shrink-0 ${
                      !isAuthorizedAdmin ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Grant Access</span>
                  </button>
                </form>
              </div>

              {/* Active Role Assignments List */}
              <div className="bg-white border-[3px] border-black p-4 space-y-3 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                  <span className="font-black uppercase text-black text-xs">
                    ACTIVE AUTHORIZED USERS &amp; ROLES ({roleAssignments.length + 1})
                  </span>
                  <span className="text-[10px] text-stone-500 font-bold uppercase">
                    Real-Time Firestore Sync
                  </span>
                </div>

                <div className="divide-y divide-stone-200">
                  {/* Primary Owner Record */}
                  <div className="py-2.5 flex items-center justify-between gap-3 bg-[#FFFDF5] px-2 border-l-4 border-[#FFE600]">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="font-mono text-xs font-black text-black truncate">11106cm009@gmail.com</span>
                      <span className="px-2 py-0.5 bg-[#FFE600] border border-black text-[9px] font-black uppercase shrink-0">
                        Primary Project Admin (Root)
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500 font-mono font-bold shrink-0">Protected</span>
                  </div>

                  {/* Dynamic Roles */}
                  {roleAssignments.map((assignment) => {
                    const isCurrent = currentUser.email?.toLowerCase() === assignment.email.toLowerCase();
                    return (
                      <div key={assignment.email} className="py-2.5 flex items-center justify-between gap-3 px-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="font-mono text-xs font-bold text-black truncate">{assignment.email}</span>
                          <span className={`px-1.5 py-0.5 border border-black text-[9px] font-black uppercase shrink-0 ${
                            assignment.role === 'admin' ? 'bg-[#38EF7D] text-black' :
                            assignment.role === 'organizer' ? 'bg-[#7C3AED] text-white' :
                            'bg-[#F59E0B] text-black'
                          }`}>
                            {assignment.role}
                          </span>
                          {isCurrent && (
                            <span className="px-1 py-0.2 bg-black text-white text-[8px] font-mono uppercase shrink-0">
                              You
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleRevokeRole(assignment.email)}
                          disabled={!isAuthorizedAdmin}
                          className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-stone-100 border border-transparent hover:border-black cursor-pointer shrink-0 transition-colors"
                          title={`Revoke role for ${assignment.email}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: TEST TOURNAMENT & SIMULATION STUDIO */}
          {/* ======================================================== */}
          {activeTab === 'simulation' && (
            <div className="space-y-6">
              {/* Studio Overview */}
              <div className="bg-[#FAF8F5] border-[3px] border-black p-4 space-y-2 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-[#E11D48]" />
                    <h3 className="font-sans font-black text-base uppercase text-black">
                      ADMIN TEST TOURNAMENT &amp; LIFECYCLE SIMULATOR
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 bg-[#FFE600] border border-black font-black text-[10px] uppercase">
                    Stage: {simState.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-stone-600">
                  Configure custom tournament parameters, generate N dummy players and team captains, simulate live auction bidding, and fast-forward bracket matches.
                </p>
              </div>

              {/* 1. Custom Settings Form */}
              <div className="bg-white border-[3px] border-black p-4 space-y-4 shadow-[4px_4px_0px_0px_#000]">
                <span className="font-black uppercase text-black text-xs block border-b-2 border-black pb-1.5">
                  1. TOURNAMENT SETTINGS &amp; PURSE RULES
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Tournament Name:</label>
                    <input
                      type="text"
                      value={simTournamentName}
                      onChange={(e) => setSimTournamentName(e.target.value)}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Esports Title:</label>
                    <select
                      value={simGame}
                      onChange={(e) => setSimGame(e.target.value)}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold cursor-pointer"
                    >
                      <option value="Dota 2">Dota 2 (5v5)</option>
                      <option value="Counter-Strike 2">Counter-Strike 2 (5v5)</option>
                      <option value="Valorant">Valorant (5v5)</option>
                      <option value="BGMI">BGMI (Squad)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Prize Pool (INR):</label>
                    <input
                      type="text"
                      value={simPrize}
                      onChange={(e) => setSimPrize(e.target.value)}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Starting Credits / Team:</label>
                    <input
                      type="number"
                      value={simStartingCredits}
                      onChange={(e) => setSimStartingCredits(Number(e.target.value))}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Dummy Players to Generate:</label>
                    <input
                      type="number"
                      min={6}
                      max={48}
                      value={simDummyCount}
                      onChange={(e) => setSimDummyCount(Number(e.target.value))}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Number of Captains / Teams:</label>
                    <input
                      type="number"
                      min={2}
                      max={8}
                      value={simCaptainsCount}
                      onChange={(e) => setSimCaptainsCount(Number(e.target.value))}
                      className="w-full bg-stone-50 border-2 border-black p-2 font-mono text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    onClick={handleGenerateDummies}
                    className="px-4 py-2.5 bg-[#FFE600] hover:bg-[#FFDE59] text-black border-2 border-black font-mono text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    <Users className="w-4 h-4" />
                    <span>Generate Test Players &amp; Captains</span>
                  </button>
                </div>
              </div>

              {/* 2. Simulation Action Desk */}
              <div className="bg-white border-[3px] border-black p-4 space-y-4 shadow-[4px_4px_0px_0px_#000]">
                <span className="font-black uppercase text-black text-xs block border-b-2 border-black pb-1.5">
                  2. LIFECYCLE SIMULATION &amp; TEST CONTROLS
                </span>

                {/* State metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-stone-50 border-2 border-black">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Registered Players</span>
                    <span className="font-sans font-black text-xl text-black">{simState.players.length}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Captains / Teams</span>
                    <span className="font-sans font-black text-xl text-black">{simState.teams.length}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Sold in Auction</span>
                    <span className="font-sans font-black text-xl text-emerald-600">{simState.auction.soldCount}</span>
                  </div>
                  <div className="p-3 bg-stone-50 border-2 border-black">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Matches Played</span>
                    <span className="font-sans font-black text-xl text-[#7C3AED]">{simState.matches.length}</span>
                  </div>
                </div>

                {/* Simulation Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <button
                    onClick={handleAutoSimulateAuction}
                    className="p-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black font-mono text-xs font-black uppercase flex flex-col items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    <Gavel className="w-5 h-5 text-[#FFE600]" />
                    <span>⚡ Auto-Simulate Auction</span>
                    <span className="text-[9px] text-[#E9D5FF] font-normal">Bot bidding &amp; roster fill</span>
                  </button>

                  <button
                    onClick={handleFastForwardTournament}
                    className="p-3 bg-[#06B6D4] hover:bg-[#0891B2] text-black border-2 border-black font-mono text-xs font-black uppercase flex flex-col items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    <Play className="w-5 h-5 text-black" />
                    <span>🏆 Fast-Forward All Matches</span>
                    <span className="text-[9px] text-stone-800 font-normal">Play bracket &amp; crown champion</span>
                  </button>

                  <button
                    onClick={handlePublishToLiveApp}
                    className="p-3 bg-[#38EF7D] hover:bg-[#22C55E] text-black border-2 border-black font-mono text-xs font-black uppercase flex flex-col items-center justify-center gap-1.5 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    <Globe className="w-5 h-5 text-black" />
                    <span>🚀 Publish to Live App</span>
                    <span className="text-[9px] text-stone-800 font-normal">Make visible to public viewers</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 3: DATABASE PURGE & RESET */}
          {/* ======================================================== */}
          {activeTab === 'purge' && (
            <div className="space-y-6">
              <div className="bg-[#FFF1F2] border-[3.5px] border-red-500 p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
                <div className="flex items-center gap-2.5 text-red-600">
                  <Trash2 className="w-6 h-6 shrink-0" />
                  <h3 className="font-sans font-black text-lg uppercase tracking-tight text-black">
                    PURGE ALL TEST &amp; MOCKUP DATA
                  </h3>
                </div>

                <p className="font-mono text-xs text-stone-700 leading-relaxed">
                  As requested, this action permanently deletes all mock tournaments, test players, dummy teams, simulated matches, and mock reports from local application memory and your live Firestore database collections.
                </p>

                <div className="bg-white border-2 border-black p-4 space-y-2 text-[11px]">
                  <span className="font-black text-black uppercase block">WHAT WILL BE PURGED:</span>
                  <ul className="list-disc list-inside space-y-1 text-stone-600">
                    <li>All mock tournament fixtures (India Dota Open, PB Test Cup, Challenger Cup)</li>
                    <li>All mockup players (SkRossi, Hydra, Aether, Sameer Sen, etc.)</li>
                    <li>All mockup team rosters &amp; match scoreboards</li>
                    <li>All mock auction states and bid trails</li>
                  </ul>
                  <span className="text-emerald-700 font-bold block pt-1">
                    ✓ Your Primary Admin authorization (11106cm009@gmail.com) and assigned user roles will be safely preserved.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handlePurgeAllData}
                    disabled={isPurging || !isAuthorizedAdmin}
                    className={`w-full py-3 bg-red-600 hover:bg-red-700 text-white border-2 border-black font-mono text-xs font-black uppercase flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_#000] ${
                      isPurging || !isAuthorizedAdmin ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    }`}
                  >
                    {isPurging ? (
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    <span>{isPurging ? 'Purging Firestore & State...' : 'Delete & Purge All Test Data Now'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BRAND & MASCOT ASSETS (ADMIN EXCLUSIVE) */}
          {activeTab === 'brand' && (
            <div className="space-y-6">
              <div className="bg-[#FFFBEB] border-2 border-black p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#F59E0B]" />
                  <h3 className="font-sans font-black text-sm uppercase text-black">
                    Official Mascot &amp; Brand Asset Repository (Admin Restricted)
                  </h3>
                </div>
                <p className="text-stone-700 text-xs">
                  This brand repository is strictly restricted to project administrators. All public mascot buttons, brand kit exports, and asset downloads have been removed from spectator and normal player interfaces for a streamlined, production-ready competition experience.
                </p>
              </div>

              {/* Mascot Showcase Card */}
              <div className="bg-white border-2 border-black p-6 space-y-6 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="p-4 bg-[#F3E8FF] border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-2xl flex items-center justify-center shrink-0">
                    <PurpleBeanLogo size="hero" variant="badge" animated={true} />
                  </div>
                  <div className="space-y-2 text-center sm:text-left">
                    <div className="inline-block bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                      OFFICIAL VECTOR MASCOT
                    </div>
                    <h4 className="font-sans font-black text-2xl uppercase text-black">
                      Purple Bean Gaming Mascot
                    </h4>
                    <p className="text-xs text-stone-600 max-w-md">
                      Official esports mascot featuring gaming headset, neo-brutalist border, specular 3D gloss, and multi-layer SVG gradients.
                    </p>
                    {onOpenBrandKit && (
                      <div className="pt-2">
                        <button
                          onClick={onOpenBrandKit}
                          className="px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-2 inline-flex"
                        >
                          <Sparkles className="w-4 h-4 text-[#FFE600]" />
                          <span>Launch Full Brand &amp; Mascot Kit (SVG)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t-2 border-black/10 text-xs">
                  <div className="p-3 bg-stone-50 border border-black">
                    <span className="text-[10px] uppercase text-stone-500 block font-bold">Primary Mascot Hex</span>
                    <strong className="text-[#7C3AED] text-sm">#7C3AED (Electric Purple)</strong>
                  </div>
                  <div className="p-3 bg-stone-50 border border-black">
                    <span className="text-[10px] uppercase text-stone-500 block font-bold">Secondary Accent</span>
                    <strong className="text-[#FFE600] text-sm">#FFE600 (Cyber Gold)</strong>
                  </div>
                  <div className="p-3 bg-stone-50 border border-black">
                    <span className="text-[10px] uppercase text-stone-500 block font-bold">Access Policy</span>
                    <strong className="text-emerald-700 text-sm">Admin Only (Hidden from Spectators)</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="bg-stone-100 border-t-2 border-black p-4 flex items-center justify-between font-mono text-xs">
          <span className="text-stone-500 text-[11px]">
            Primary Admin Authority: <strong>11106cm009@gmail.com</strong>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-black text-white hover:bg-stone-800 font-mono text-xs font-black uppercase cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Close Console
          </button>
        </div>

      </div>
    </div>
  );
}
