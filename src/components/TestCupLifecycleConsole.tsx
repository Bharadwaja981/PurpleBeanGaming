import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Shield, 
  Gavel, 
  Swords, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Play, 
  RotateCcw, 
  Sparkles, 
  DollarSign, 
  Award, 
  Flame, 
  ChevronRight,
  TrendingUp,
  FileText,
  UserCheck,
  UserX,
  Plus
} from 'lucide-react';
import { 
  testCupEngine, 
  TEST_CUP_CONFIG, 
  TestCupPlayerRecord, 
  TestCupTeamRecord 
} from '../domain/testCupEngine';
import { ratingLedger, RatingAdjustmentRecord } from '../domain/competitiveRatingEngine';
import { Match, ViewType } from '../types/tournament';
import { OrganiserRegistrationReview } from './OrganiserRegistrationReview';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface TestCupLifecycleConsoleProps {
  onNavigate?: (view: ViewType, entityId?: string) => void;
}

export function TestCupLifecycleConsole({ onNavigate }: TestCupLifecycleConsoleProps) {
  // Sync state with testCupEngine
  const [engineState, setEngineState] = useState(() => ({
    status: testCupEngine.getStatus(),
    players: testCupEngine.getPlayers(),
    teams: testCupEngine.getTeams(),
    matches: testCupEngine.getMatches(),
    auction: testCupEngine.getAuctionState(),
    audit: testCupEngine.getAuditTrail()
  }));

  const [activeStageTab, setActiveStageTab] = useState<number>(1);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Registration Form State
  const [newUsername, setNewUsername] = useState('ApexHunter');
  const [newRealName, setNewRealName] = useState('Karan Chopra');
  const [newCity, setNewCity] = useState('Bengaluru');
  const [newPrimaryRole, setNewPrimaryRole] = useState('Position 1 — Carry');
  const [newSecondaryRole, setNewSecondaryRole] = useState('Position 2 — Mid');
  const [newMmr, setNewMmr] = useState(7850);

  // Auction State Selection
  const [selectedNomineeId, setSelectedNomineeId] = useState<string>('');
  const [customBidAmount, setCustomBidAmount] = useState<number>(20);
  const [selectedBiddingTeamId, setSelectedBiddingTeamId] = useState<string>('tc-team-1');

  useEffect(() => {
    return testCupEngine.subscribe(() => {
      setEngineState({
        status: testCupEngine.getStatus(),
        players: testCupEngine.getPlayers(),
        teams: testCupEngine.getTeams(),
        matches: testCupEngine.getMatches(),
        auction: testCupEngine.getAuctionState(),
        audit: testCupEngine.getAuditTrail()
      });
    });
  }, []);

  const showFeedback = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Helper Stage Mapping
  const stages = [
    { num: 1, name: 'Registration', status: engineState.status === 'Registration Open' ? 'current' : 'completed', icon: Users },
    { num: 2, name: 'Verification', status: engineState.status === 'Registration Open' ? 'upcoming' : engineState.status === 'Verification' ? 'current' : 'completed', icon: UserCheck },
    { num: 3, name: 'Captains', status: engineState.status === 'Captain Selection' ? 'current' : ['Drafting', 'Rosters Locked', 'Live', 'Completed'].includes(engineState.status) ? 'completed' : 'upcoming', icon: Shield },
    { num: 4, name: 'Auction Setup', status: engineState.status === 'Drafting' && engineState.auction.soldCount === 0 ? 'current' : ['Drafting', 'Rosters Locked', 'Live', 'Completed'].includes(engineState.status) ? 'completed' : 'upcoming', icon: DollarSign },
    { num: 5, name: 'Live Auction', status: engineState.status === 'Drafting' ? 'current' : ['Rosters Locked', 'Live', 'Completed'].includes(engineState.status) ? 'completed' : 'upcoming', icon: Gavel },
    { num: 6, name: 'Competition', status: engineState.status === 'Live' ? 'current' : engineState.status === 'Completed' ? 'completed' : 'upcoming', icon: Swords },
    { num: 7, name: 'Results & Ratings', status: engineState.status === 'Completed' ? 'completed' : engineState.matches.some(m => m.status === 'COMPLETED') ? 'current' : 'upcoming', icon: TrendingUp },
    { num: 8, name: 'Completion', status: engineState.status === 'Completed' ? 'completed' : 'upcoming', icon: Trophy },
  ];

  // Actions
  const handleRegisterPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = testCupEngine.submitRegistration({
        username: newUsername,
        realName: newRealName,
        city: newCity,
        region: 'Pan India',
        primaryRole: newPrimaryRole,
        secondaryRole: newSecondaryRole,
        mmr: Number(newMmr) || 7500
      });
      showFeedback(`Successfully registered ${res.player.username} (MMR: ${res.player.tournamentMmr})!`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleVerifyPlayer = (id: string, approve: boolean) => {
    try {
      const res = testCupEngine.verifyPlayer(id, approve);
      showFeedback(`Player status set to: ${res.status}`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleVerifyAll = () => {
    try {
      const unverified = engineState.players.filter(p => p.registrationStatus === 'Registered');
      for (const p of unverified) {
        testCupEngine.verifyPlayer(p.id, true);
      }
      showFeedback(`Verified all ${unverified.length} registered candidate players!`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleConfirmCaptains = () => {
    try {
      const res = testCupEngine.confirmCaptainsAndTeams();
      showFeedback(`Confirmed 3 captains: ${res.captains.join(', ')} and initialized 3 franchise squads!`);
      setActiveStageTab(5); // Advance to Auction
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleNominate = (playerId: string) => {
    try {
      const res = testCupEngine.nominatePlayer(playerId);
      showFeedback(`Nominated ${res.nominee.username} (${res.nominee.primaryRole})! Current Bid: 10 Credits.`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleBid = (teamId: string, amount: number) => {
    try {
      const team = engineState.teams.find(t => t.id === teamId);
      if (!team) return;
      const res = testCupEngine.placeAuctionBid({
        teamId,
        bidAmount: amount,
        captainUserId: team.captainId
      });
      showFeedback(`Accepted ${team.name} bid of ${res.currentBid} credits!`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleConcludeNomination = (sold: boolean) => {
    try {
      const res = testCupEngine.concludeNomination(sold);
      if (res.outcome === 'AUCTION_COMPLETED') {
        showFeedback(`All 3 teams have 5-player mandatory rosters! Auction complete. Untouched players set to UNSELECTED.`);
        setActiveStageTab(6);
      } else {
        showFeedback(`Player ${res.player.username} marked as ${res.outcome}!`);
      }
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleGenerateBracket = () => {
    try {
      testCupEngine.generateSingleEliminationBracket();
      showFeedback(`Generated Single Elimination Bracket: Semifinal (Mumbai vs Hyderabad), Bengaluru Blaze receives BYE into Grand Final!`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleExecuteSemifinal = (scoreA: number, scoreB: number) => {
    try {
      const res = testCupEngine.executeSemifinalResult(scoreA, scoreB);
      showFeedback(`Semifinal Finalized: ${res.advancingTeam.name} advances to Grand Final (+${res.ratingDelta} Elo)! ${res.thirdPlaceTeam.name} takes 3rd Place (₹3,000).`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleExecuteGrandFinal = (scoreA: number, scoreB: number) => {
    try {
      const res = testCupEngine.executeGrandFinalResult(scoreA, scoreB);
      showFeedback(`Grand Final Finalized: ${res.championTeam.name} crowned Champion (+${res.ratingDelta} Elo)! ${res.runnerUpTeam.name} is Runner-up.`);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleCompleteTournament = () => {
    try {
      const res = testCupEngine.completeTournament();
      showFeedback(`Purple Bean Test Cup Completed! Champion: ${res.champion} (₹15,000), Runner-up: ${res.runnerUp} (₹7,000), 3rd: ${res.thirdPlace} (₹3,000).`);
      setActiveStageTab(8);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleRunFullSimulation = () => {
    try {
      const res = testCupEngine.runFullTournamentSimulation();
      showFeedback(`Full test cup simulated cleanly! Champion: ${res.summary.champion}, All 3 rosters 5/5, ${res.summary.unselectedCount} UNSELECTED.`);
      setActiveStageTab(8);
    } catch (err: any) {
      showFeedback(err.message, 'error');
    }
  };

  const handleResetTournament = () => {
    testCupEngine.reset();
    setActiveStageTab(1);
    showFeedback('Tournament state reset to Registration Open.', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Deck */}
      <div className="bg-[#FFE600] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-xs font-black uppercase text-black">
              <span className="bg-black text-[#FFE600] px-2 py-0.5 border border-black">REAL TEST TOURNAMENT ENGINE</span>
              <span>·</span>
              <span>DOTA 2 PAN INDIA</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans">
              PURPLE BEAN TEST CUP CONSOLE
            </h2>
            <p className="font-mono text-xs text-stone-900 max-w-2xl font-bold">
              Full lifecycle operations: Registration → KYC Verification → 3 Franchise Captains → 1000 Credits Auction Desk → Single Elimination with BYE → Elo Rating Finalization → Prize Escrow.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleRunFullSimulation}
              className="bg-black text-[#70FFAF] hover:bg-stone-900 border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#70FFAF]" />
              <span>Run Complete Tournament</span>
            </button>

            <button
              onClick={handleResetTournament}
              className="bg-white text-black hover:bg-stone-100 border-2 border-black px-3 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 cursor-pointer"
              title="Reset Test Cup to Registration Open"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Live Feedback Message */}
        {feedbackMsg && (
          <div className={`p-3 border-2 border-black font-mono text-xs font-black flex items-center justify-between shadow-[2px_2px_0px_0px_#000] ${
            feedbackMsg.type === 'error' ? 'bg-[#FF5757] text-white' :
            feedbackMsg.type === 'info' ? 'bg-white text-black' :
            'bg-[#70FFAF] text-black'
          }`}>
            <span>{feedbackMsg.text}</span>
            <button onClick={() => setFeedbackMsg(null)} className="font-bold underline ml-2 cursor-pointer">Dismiss</button>
          </div>
        )}

        {/* Status Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 font-mono text-xs pt-2 border-t-2 border-black">
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Lifecycle State</span>
            <span className="font-black text-black text-xs uppercase">{engineState.status}</span>
          </div>
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Player Pool</span>
            <span className="font-black text-black">{engineState.players.length} Registered</span>
          </div>
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Franchises</span>
            <span className="font-black text-black">{engineState.teams.length} Teams (3/3)</span>
          </div>
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Auction Draft</span>
            <span className="font-black text-black">{engineState.auction.soldCount} Sold / {engineState.auction.unselectedCount} Unselected</span>
          </div>
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Matches</span>
            <span className="font-black text-black">{engineState.matches.filter(m => m.status === 'COMPLETED').length} / {engineState.matches.length || 2} Done</span>
          </div>
          <div className="bg-white border-2 border-black p-2">
            <span className="text-[10px] text-stone-500 uppercase block font-bold">Prize Escrow</span>
            <span className="font-black text-[#7C3AED]">₹25,000 INR</span>
          </div>
        </div>
      </div>

      {/* 8-Stage Lifecycle Navigation Stepper */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {stages.map((st) => (
          <button
            key={st.num}
            onClick={() => setActiveStageTab(st.num)}
            className={`p-2.5 border-2 border-black font-mono text-xs font-black uppercase text-left transition-all cursor-pointer flex flex-col justify-between ${
              activeStageTab === st.num
                ? 'bg-[#7C3AED] text-white shadow-[3px_3px_0px_0px_#000] -translate-y-0.5'
                : st.status === 'completed'
                ? 'bg-[#70FFAF]/50 text-black hover:bg-[#70FFAF]'
                : st.status === 'current'
                ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                : 'bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center justify-between text-[10px]">
              <span>Stage 0{st.num}</span>
              {st.status === 'completed' ? (
                <CheckCircle className="w-3 h-3 text-emerald-800" />
              ) : st.status === 'current' ? (
                <span className="w-2 h-2 rounded-full bg-[#FF5757] animate-pulse" />
              ) : (
                <Clock className="w-3 h-3 text-stone-400" />
              )}
            </div>
            <div className="font-sans font-black text-xs truncate mt-1">
              {st.name}
            </div>
          </button>
        ))}
      </div>

      {/* Stage Panel Workspaces */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
        {/* ======================================================== */}
        {/* STAGE 1: REGISTRATION */}
        {/* ======================================================== */}
        {activeStageTab === 1 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 1: INDIVIDUAL PLAYER REGISTRATION
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Total {engineState.players.length} registered candidates. Minimum requirement: 15 drafted slots + 6 extras for UNSOLD/UNSELECTED states.
                </p>
              </div>
              <button
                onClick={() => setActiveStageTab(2)}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 cursor-pointer self-start sm:self-auto"
              >
                <span>Advance to Verification →</span>
              </button>
            </div>

            {/* Quick Registration Form */}
            <form onSubmit={handleRegisterPlayer} className="bg-[#FFFBEB] border-2 border-black p-4 space-y-3 font-mono text-xs">
              <span className="font-black uppercase text-stone-800 block flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#7C3AED]" />
                Register New Test Entrant (Dota 2 · Pan India)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-[10px] font-bold block mb-0.5">IGN / Handle:</label>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-white border border-black p-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block mb-0.5">Real Legal Name:</label>
                  <input
                    type="text"
                    required
                    value={newRealName}
                    onChange={(e) => setNewRealName(e.target.value)}
                    className="w-full bg-white border border-black p-1.5 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold block mb-0.5">City:</label>
                  <input
                    type="text"
                    required
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full bg-white border border-black p-1.5 font-bold"
                  />
                </div>
                <div>
                  <SelectDropdown
                    label="Primary Role:"
                    value={newPrimaryRole}
                    onChange={(val) => setNewPrimaryRole(val)}
                    options={[
                      { value: 'Position 1 — Carry', label: 'Position 1 — Carry' },
                      { value: 'Position 2 — Mid', label: 'Position 2 — Mid' },
                      { value: 'Position 3 — Offlane', label: 'Position 3 — Offlane' },
                      { value: 'Position 4 — Soft Support', label: 'Position 4 — Soft Support' },
                      { value: 'Position 5 — Hard Support', label: 'Position 5 — Hard Support' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div>
                  <SelectDropdown
                    label="Secondary Role:"
                    value={newSecondaryRole}
                    onChange={(val) => setNewSecondaryRole(val)}
                    options={[
                      { value: 'Position 2 — Mid', label: 'Position 2 — Mid' },
                      { value: 'Position 1 — Carry', label: 'Position 1 — Carry' },
                      { value: 'Position 3 — Offlane', label: 'Position 3 — Offlane' },
                      { value: 'Position 4 — Soft Support', label: 'Position 4 — Soft Support' },
                      { value: 'Position 5 — Hard Support', label: 'Position 5 — Hard Support' }
                    ]}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <button
                    type="submit"
                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black p-1.5 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    Submit Entry
                  </button>
                </div>
              </div>
            </form>

            {/* Players Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs border border-black">
                <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black">
                  <tr>
                    <th className="p-2.5">Player / IGN</th>
                    <th className="p-2.5">Role</th>
                    <th className="p-2.5">Origin</th>
                    <th className="p-2.5 text-right">MMR</th>
                    <th className="p-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-stone-200">
                  {engineState.players.slice(0, 10).map((p) => (
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="p-2.5 font-bold">
                        <span className="mr-1.5">{p.avatar}</span>
                        <span>{p.username}</span>
                        <span className="text-stone-500 text-[10px] ml-1">({p.realName})</span>
                        {p.isCaptain && (
                          <span className="ml-2 bg-[#FFE600] border border-black text-[9px] px-1.5 py-0.2 font-black uppercase">
                            Captain
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">{p.primaryRole}</td>
                      <td className="p-2.5">{p.city}, {p.region}</td>
                      <td className="p-2.5 text-right font-black">{p.tournamentMmr}</td>
                      <td className="p-2.5 text-center">
                        <span className={`px-2 py-0.5 border border-black font-black text-[10px] uppercase ${
                          p.registrationStatus === 'Verified' ? 'bg-[#70FFAF] text-black' :
                          p.registrationStatus === 'Rejected' ? 'bg-[#FF5757] text-white' :
                          'bg-[#FFE600] text-black'
                        }`}>
                          {p.registrationStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-[11px] font-mono text-stone-500 pt-2 text-right">
                Showing top 10 of {engineState.players.length} registered Dota 2 contenders
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 2: VERIFICATION & KYC */}
        {/* ======================================================== */}
        {activeStageTab === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 2: PLAYER VERIFICATION &amp; TOURNAMENT MMR AUDIT
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Calibrate Tournament MMR, audit anti-cheat/OpenDota evidence, resolve integrity cases, and lock verified status. Only verified contenders become eligible for the auction pool.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleVerifyAll}
                  className="bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Verify All Candidates
                </button>
                <button
                  onClick={() => setActiveStageTab(3)}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Proceed to Captains →
                </button>
              </div>
            </div>

            {/* Authoritative Registration Review Component */}
            <OrganiserRegistrationReview 
              tournamentId="purple-bean-test-cup" 
              tournamentName="Purple Bean Test Cup"
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 3: CAPTAIN SELECTION */}
        {/* ======================================================== */}
        {activeStageTab === 3 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 3: FRANCHISE CAPTAIN SELECTION
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Tournament-scoped captain permissions for 3 captains: Aether, Nova, Karma.
                </p>
              </div>
              <button
                onClick={handleConfirmCaptains}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
              >
                <Shield className="w-4 h-4 text-[#7C3AED]" />
                <span>Confirm 3 Captains &amp; Initialize Teams →</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {engineState.teams.map((team, idx) => {
                const captain = engineState.players.find(p => p.id === team.captainId);
                return (
                  <div key={team.id} className="bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-black pb-2">
                      <span className="text-3xl">{team.logo}</span>
                      <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-mono text-xs font-black uppercase">
                        Captain 0{idx + 1}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-sans font-black text-lg uppercase text-black">
                        {team.name}
                      </h4>
                      <div className="font-mono text-xs text-stone-600 font-bold">
                        Tag: {team.tag} · Starting Purse: 1000 Credits
                      </div>
                    </div>

                    <div className="bg-white border-2 border-black p-3 font-mono text-xs space-y-1">
                      <div className="font-black text-black text-sm flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Captain: {team.captainName}</span>
                      </div>
                      <div className="text-stone-600 text-[11px]">
                        Role: {captain?.primaryRole || 'Position 2 — Mid'}
                      </div>
                      <div className="text-stone-600 text-[11px]">
                        Baseline Rating: {team.rating} Elo · {captain?.tournamentMmr} MMR
                      </div>
                    </div>

                    <div className="text-[11px] font-mono bg-[#70FFAF] border border-black p-2 font-bold text-center">
                      ✓ Tournament Scoped Captain Tools Active
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 4: TEAMS & AUCTION SETUP */}
        {/* ======================================================== */}
        {activeStageTab === 4 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 4: AUCTION &amp; ROSTER RULES SPECIFICATION
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Authoritative tournament parameters document applied to the Purple Bean Test Cup.
                </p>
              </div>
              <button
                onClick={() => setActiveStageTab(5)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Launch Live Auction Desk →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              <div className="bg-stone-50 border-2 border-black p-5 space-y-3">
                <h4 className="font-sans font-black text-base uppercase text-black border-b border-black pb-1">
                  OFFICIAL AUCTION PARAMETERS
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Starting Purse:</span>
                    <span className="font-black text-black">1000 Credits per Captain</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Opening Bid:</span>
                    <span className="font-black text-black">10 Credits</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Minimum Increment:</span>
                    <span className="font-black text-black">10 Credits</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Mandatory Primary Roster:</span>
                    <span className="font-black text-black">5 Players (1 Captain + 4 Drafted)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Optional Stand-in:</span>
                    <span className="font-black text-emerald-700">1 Player (Optional)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-stone-200">
                    <span className="text-stone-600">Reserve Rule:</span>
                    <span className="font-black text-red-600">10 credits reserved per unfilled slot</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFFBEB] border-2 border-black p-5 space-y-3">
                <h4 className="font-sans font-black text-base uppercase text-black border-b border-black pb-1">
                  INITIAL TEAM FORMATION STATUS
                </h4>
                <div className="space-y-3">
                  {engineState.teams.map((t) => (
                    <div key={t.id} className="p-2.5 bg-white border border-black flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{t.logo}</span>
                        <div>
                          <span className="font-bold block">{t.name}</span>
                          <span className="text-[10px] text-stone-500">Captain: {t.captainName}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-[#7C3AED] block">{t.credits} Credits</span>
                        <span className="text-[10px] text-stone-600">Roster: 1/5 Filled</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 5: LIVE AUCTION DESK */}
        {/* ======================================================== */}
        {activeStageTab === 5 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 5: LIVE CAPTAIN AUCTION DESK
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Interactive bidding desk. When all 3 teams fill 5 primary slots (1 captain + 4 drafted), remaining players become UNSELECTED.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => testCupEngine.finalizeAuction()}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Force Complete &amp; Lock Rosters
                </button>
                <button
                  onClick={() => setActiveStageTab(6)}
                  className="bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Proceed to Bracket →
                </button>
              </div>
            </div>

            {/* Current Nominee Podium */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-[#FFF9E6] border-[3px] border-black p-5 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="font-mono text-xs font-black uppercase text-stone-600">CURRENT PLAYER ON BLOCK</span>
                  <span className="bg-[#FF5757] text-white border border-black px-2 py-0.5 text-[10px] font-black uppercase animate-pulse">
                    Live Auction Room
                  </span>
                </div>

                {engineState.auction.nominee ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{engineState.auction.nominee.avatar}</span>
                        <div>
                          <h4 className="text-2xl font-black text-black font-sans">
                            {engineState.auction.nominee.username}
                          </h4>
                          <span className="font-mono text-xs text-stone-600 font-bold">
                            {engineState.auction.nominee.realName} · {engineState.auction.nominee.primaryRole} · {engineState.auction.nominee.tournamentMmr} MMR
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-stone-500 font-mono text-[10px] uppercase block">Current Bid</span>
                        <span className="text-3xl font-black font-mono text-[#7C3AED]">
                          {engineState.auction.currentBid} <span className="text-xs">Credits</span>
                        </span>
                        {engineState.auction.leadingTeamName && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 block">
                            Leading: {engineState.auction.leadingTeamName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bidding Buttons */}
                    <div className="p-3 bg-white border-2 border-black space-y-3 font-mono text-xs">
                      <span className="font-black uppercase text-stone-600 block text-[10px]">
                        PLACE AUTHORITATIVE BID AS CAPTAIN:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {engineState.teams.map((team) => {
                          const nextBid = engineState.auction.currentBid + 20;
                          return (
                            <button
                              key={team.id}
                              onClick={() => handleBid(team.id, nextBid)}
                              className="p-2 bg-stone-100 hover:bg-[#FFE600] border-2 border-black font-bold uppercase text-[11px] text-left transition-all shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                            >
                              <div className="truncate font-black">{team.captainName}</div>
                              <div className="text-[10px] text-stone-600">{team.name}</div>
                              <div className="text-xs font-black text-[#7C3AED] mt-1">Bid {nextBid} Cr</div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-black">
                        <button
                          onClick={() => handleConcludeNomination(true)}
                          className="flex-1 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black py-2 font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                        >
                          Hammer Down: SELL (SOLD)
                        </button>
                        <button
                          onClick={() => handleConcludeNomination(false)}
                          className="flex-1 bg-[#FF70A6] hover:bg-pink-300 text-black border-2 border-black py-2 font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                        >
                          No Bid: PASS (UNSOLD)
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3 font-mono text-xs">
                    <Gavel className="w-10 h-10 text-stone-400 mx-auto" />
                    <p className="font-bold text-stone-600">No player currently on the auction block.</p>
                    <p className="text-stone-500 text-[11px]">Select a candidate from the Available Pool below to start bidding.</p>
                  </div>
                )}
              </div>

              {/* Teams Purse & Roster Tracker */}
              <div className="lg:col-span-5 space-y-3 font-mono text-xs">
                <span className="font-black uppercase text-stone-600 block text-xs">
                  FRANCHISE ROSTERS &amp; PURSE (5 PLAYERS MANDATORY):
                </span>
                {engineState.teams.map((t) => (
                  <div key={t.id} className="p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{t.logo}</span>
                        <span className="font-black text-black">{t.name}</span>
                      </div>
                      <span className="font-black bg-[#FFE600] px-2 py-0.5 border border-black">
                        {t.credits} Credits Left
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-600">
                      Roster: <strong>{t.primaryRoster.length} / 5</strong>
                      {t.standIn && <span className="text-emerald-700 ml-1">(+1 Stand-in)</span>}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {t.primaryRoster.map((p, idx) => (
                        <span key={p.id || idx} className="bg-stone-100 border border-black px-1.5 py-0.5 text-[10px] font-bold">
                          {p.username}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Available Candidates Pool to Nominate */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-black uppercase text-stone-600 block">
                AVAILABLE PLAYER POOL ({engineState.auction.availablePlayers?.length || 0} CONTENDERS):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {(engineState.auction.availablePlayers || []).slice(0, 12).map((p) => (
                  <div key={p.id} className="p-2.5 bg-stone-50 border border-black flex flex-col justify-between space-y-2">
                    <div>
                      <div className="font-bold flex items-center gap-1 truncate">
                        <span>{p.avatar}</span>
                        <span className="truncate">{p.username}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 truncate">{p.primaryRole}</div>
                      <div className="text-[10px] font-black text-black">{p.tournamentMmr} MMR</div>
                    </div>
                    <button
                      onClick={() => handleNominate(p.id)}
                      className="w-full bg-[#FFE600] hover:bg-yellow-400 border border-black py-1 font-bold text-[10px] uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                    >
                      Nominate (10 Cr)
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 6: BRACKET & COMPETITION */}
        {/* ======================================================== */}
        {activeStageTab === 6 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 6: 3-TEAM SINGLE ELIMINATION BRACKET (WITH BYE)
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Mumbai Mavericks vs Hyderabad Raiders in Semifinal. Bengaluru Blaze seeded with BYE into Grand Final.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateBracket}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Generate Initial Bracket
                </button>
                <button
                  onClick={() => setActiveStageTab(7)}
                  className="bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  View Elo Ratings →
                </button>
              </div>
            </div>

            {/* Bracket Visual Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Match 1: Semifinal */}
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-5 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="font-black uppercase text-stone-600">MATCH 01: SEMIFINAL (BO3)</span>
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 font-black uppercase text-[10px]">
                    Oct 15 · 17:00 IST
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-stone-50 border border-black">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">⚡</span>
                      <div>
                        <span className="font-black text-black text-sm block">Mumbai Mavericks</span>
                        <span className="text-[10px] text-stone-500">Captain Aether · 1850 Elo</span>
                      </div>
                    </div>
                    <span className="text-2xl font-black bg-white border-2 border-black px-3 py-1">
                      {engineState.matches.find(m => m.id === 'tc-match-semi-1')?.teamA.score || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-stone-50 border border-black">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🦅</span>
                      <div>
                        <span className="font-black text-black text-sm block">Hyderabad Raiders</span>
                        <span className="text-[10px] text-stone-500">Captain Nova · 1820 Elo</span>
                      </div>
                    </div>
                    <span className="text-2xl font-black bg-white border-2 border-black px-3 py-1">
                      {engineState.matches.find(m => m.id === 'tc-match-semi-1')?.teamB.score || 0}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#FFFBEB] border border-black space-y-2">
                  <span className="font-black uppercase text-stone-600 block text-[10px]">
                    RECORD OFFICIAL REFEREE SCORE:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExecuteSemifinal(2, 1)}
                      className="flex-1 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black py-1.5 font-bold uppercase text-[11px] shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Mumbai 2 - 1 Hyderabad
                    </button>
                    <button
                      onClick={() => handleExecuteSemifinal(1, 2)}
                      className="flex-1 bg-white hover:bg-stone-100 text-black border-2 border-black py-1.5 font-bold uppercase text-[11px] shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Hyderabad 2 - 1 Mumbai
                    </button>
                  </div>
                </div>
              </div>

              {/* Match 2: Grand Final */}
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-5 space-y-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <span className="font-black uppercase text-stone-600">MATCH 02: GRAND FINAL (BO3)</span>
                  <span className="bg-[#7C3AED] text-white border border-black px-2 py-0.5 font-black uppercase text-[10px]">
                    Oct 15 · 20:00 IST
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-stone-50 border border-black">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {engineState.matches.find(m => m.id === 'tc-match-final')?.teamA.logo || '🏆'}
                      </span>
                      <div>
                        <span className="font-black text-black text-sm block">
                          {engineState.matches.find(m => m.id === 'tc-match-final')?.teamA.name || 'Winner of Semifinal'}
                        </span>
                        <span className="text-[10px] text-stone-500">Semifinal Qualifier</span>
                      </div>
                    </div>
                    <span className="text-2xl font-black bg-white border-2 border-black px-3 py-1">
                      {engineState.matches.find(m => m.id === 'tc-match-final')?.teamA.score || 0}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-[#FFF9E6] border border-black">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🔥</span>
                      <div>
                        <span className="font-black text-black text-sm block">Bengaluru Blaze</span>
                        <span className="text-[10px] text-emerald-700 font-bold">BYE Advanced Seed · Captain Karma</span>
                      </div>
                    </div>
                    <span className="text-2xl font-black bg-white border-2 border-black px-3 py-1">
                      {engineState.matches.find(m => m.id === 'tc-match-final')?.teamB.score || 0}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#FFFBEB] border border-black space-y-2">
                  <span className="font-black uppercase text-stone-600 block text-[10px]">
                    DECIDE CHAMPIONSHIP WINNER:
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExecuteGrandFinal(2, 0)}
                      className="flex-1 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black py-1.5 font-bold uppercase text-[11px] shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Team A 2 - 0 Bengaluru
                    </button>
                    <button
                      onClick={() => handleExecuteGrandFinal(1, 2)}
                      className="flex-1 bg-white hover:bg-stone-100 text-black border-2 border-black py-1.5 font-bold uppercase text-[11px] shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Bengaluru 2 - 1 Team A
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 7: RESULTS & ELO RATINGS */}
        {/* ======================================================== */}
        {activeStageTab === 7 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-3">
              <div>
                <h3 className="text-xl font-black uppercase text-black font-sans">
                  STAGE 7: ELO RATINGS &amp; PRIZE POOL DISPERSAL
                </h3>
                <p className="font-mono text-xs text-stone-600">
                  Authoritative Elo Ledger updates and prize payment status tracking: ₹15,000 (1st), ₹7,000 (2nd), ₹3,000 (3rd).
                </p>
              </div>
              <button
                onClick={handleCompleteTournament}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Finalize &amp; Crown Champion →
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono text-xs">
              {/* Placements Cards */}
              {engineState.teams.map((team, idx) => (
                <div key={team.id} className="p-4 border-[3px] border-black bg-stone-50 space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <span className="text-3xl">{team.logo}</span>
                    <span className="font-black bg-[#FFE600] border border-black px-2 py-0.5 text-xs">
                      {team.placement || `Contender #${idx + 1}`}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-sans font-black text-base uppercase text-black">{team.name}</h4>
                    <span className="text-stone-600">Captain: {team.captainName}</span>
                  </div>

                  <div className="bg-white border-2 border-black p-3 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Prize Winnings:</span>
                      <span className="font-black text-[#7C3AED] text-sm">{team.earningsINR || '₹0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Competitive Rating:</span>
                      <span className="font-black text-black">{team.rating} Elo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Authoritative Rating Ledger Table */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-black uppercase text-stone-600 block">
                IMMUTABLE ELO RATING AUDIT LEDGER:
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs border border-black">
                  <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black">
                    <tr>
                      <th className="p-2.5">Match Ref</th>
                      <th className="p-2.5">Winning Team</th>
                      <th className="p-2.5">Losing Team</th>
                      <th className="p-2.5 text-right">Winner Rating</th>
                      <th className="p-2.5 text-right">Delta</th>
                      <th className="p-2.5 text-center">Idempotency Key</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-stone-200">
                    {ratingLedger.getAllRecords().map((rec: RatingAdjustmentRecord) => (
                      <tr key={rec.idempotencyKey} className="hover:bg-stone-50">
                        <td className="p-2.5 font-bold">{rec.matchId}</td>
                        <td className="p-2.5 text-emerald-700 font-bold">{rec.winnerTeamId}</td>
                        <td className="p-2.5 text-red-600 font-bold">{rec.loserTeamId}</td>
                        <td className="p-2.5 text-right font-black">{rec.winnerNewRating}</td>
                        <td className="p-2.5 text-right font-black text-emerald-600">+{rec.delta}</td>
                        <td className="p-2.5 text-center text-[10px] text-stone-500">IDEMPOTENT_COMMITTED</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STAGE 8: TOURNAMENT COMPLETION & AUDIT */}
        {/* ======================================================== */}
        {activeStageTab === 8 && (
          <div className="space-y-6">
            <div className="p-6 bg-[#70FFAF] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] text-center space-y-3">
              <div className="w-16 h-16 bg-[#FFE600] border-2 border-black shadow-[3px_3px_0px_0px_#000] mx-auto flex items-center justify-center text-3xl">
                🏆
              </div>
              <h3 className="text-3xl font-black uppercase text-black font-sans">
                PURPLE BEAN TEST CUP COMPLETED
              </h3>
              <p className="font-mono text-xs text-stone-800 max-w-xl mx-auto font-bold">
                Championship concluded successfully. Real Firebase database transactions committed, Elo points credited to player profiles, and prize payment distribution logged.
              </p>
            </div>

            {/* Audit Trail Log */}
            <div className="space-y-3 font-mono text-xs">
              <span className="font-black uppercase text-stone-600 block flex items-center justify-between">
                <span>AUTHORITATIVE AUDIT LOG ({engineState.audit.length} EVENTS)</span>
                <span className="text-[10px] text-emerald-700 font-bold">IMMUTABLE TIME STAMPED</span>
              </span>
              <div className="max-h-64 overflow-y-auto border-2 border-black bg-stone-50 divide-y divide-stone-200 p-2">
                {engineState.audit.map((entry, idx) => (
                  <div key={idx} className="p-2 flex items-start justify-between gap-3 text-[11px]">
                    <div className="space-y-0.5">
                      <span className="font-black uppercase text-black block">[{entry.action}]</span>
                      <span className="text-stone-700">{entry.details}</span>
                    </div>
                    <span className="text-[10px] text-stone-500 shrink-0">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
