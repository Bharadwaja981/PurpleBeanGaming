/**
 * Purple Bean Gaming — Dynamic Organiser Workspace
 * 
 * Dynamically renders the appropriate organiser workspace according to
 * the active tournament's TournamentConfig:
 * - Premade Team Tournaments: Team applications, review, seeding, brackets.
 * - Auction Tournaments: Full auction console, captain nomination, and bidding.
 */

import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Users, 
  Shield, 
  Coins, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Play, 
  Sparkles, 
  Layers, 
  BarChart3,
  Award,
  ArrowRight,
  Plus,
  UserPlus,
  Bot,
  Crown
} from 'lucide-react';
import { TournamentConfig, formatINR } from '../domain/tournamentConfig';
import { GenericTournamentEngine } from '../domain/genericTournamentEngine';
import { PremadeTeamApplication } from '../domain/premadeTeamEngine';
import { CompetitionMatch } from '../domain/genericCompetitionEngine';
import { ratingLedger, RatingAdjustmentRecord } from '../domain/competitiveRatingEngine';
import { TestCupLifecycleConsole } from './TestCupLifecycleConsole';
import { OrganiserRegistrationReview } from './OrganiserRegistrationReview';
import { AuctionDraft } from './AuctionDraft';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';
import { tournamentService } from '../services/firebaseService';
import { AdminTournamentPlayerManagerModal } from './AdminTournamentPlayerManagerModal';
import { DotaTournamentRegistration } from '../domain/dotaPlayerEngine';
import { AlertModal } from './ui/AlertModal';

interface DynamicOrganiserWorkspaceProps {
  config: TournamentConfig;
  engine: GenericTournamentEngine;
  onNavigate?: (view: any, entityId?: string) => void;
}

export const DynamicOrganiserWorkspace: React.FC<DynamicOrganiserWorkspaceProps> = ({
  config,
  engine,
  onNavigate
}) => {
  // If this is the specific Purple Bean Test Cup regression fixture, render its dedicated lifecycle console
  if (config.identity.tournamentId === 'purple-bean-test-cup') {
    return <TestCupLifecycleConsole onNavigate={onNavigate} />;
  }

  // Dynamic Workspace for generic / newly created tournaments
  const isPremade = config.registration.registrationMode === 'PREMADE_TEAM';
  const isAuction = config.teamFormation.mode === 'AUCTION';

  const [activeTab, setActiveTab] = useState<string>(isPremade ? 'teams' : 'overview');
  const [teams, setTeams] = useState(engine.getTeams());
  const [premadeApps, setPremadeApps] = useState<PremadeTeamApplication[]>(engine.getPremadeApplications());
  const [matches, setMatches] = useState<CompetitionMatch[]>(engine.getMatches());
  const [auditLogs, setAuditLogs] = useState(engine.getAuditTrail());
  const [currentStage, setCurrentStage] = useState(engine.getCurrentStage());

  // Score Entry state
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(1);

  // New Premade Team Form Modal
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTag, setNewTeamTag] = useState('');
  const [newTeamCity, setNewTeamCity] = useState('Mumbai');
  const [newCaptainName, setNewCaptainName] = useState('');

  // Player Manager Modal State
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [playerModalInitialTab, setPlayerModalInitialTab] = useState<'manual' | 'upload' | 'dummy'>('manual');
  const [alertModalState, setAlertModalState] = useState<{ isOpen: boolean; title: string; message: string; variant?: 'error' | 'success' | 'info' } | null>(null);
  const [tournamentRegs, setTournamentRegs] = useState(() => 
    tournamentService.getTournamentRegistrations(config.identity.tournamentId)
  );

  // Captain Appointment Modal & Auction Setup State
  const [appointModalContender, setAppointModalContender] = useState<DotaTournamentRegistration | null>(null);
  const [appointTeamName, setAppointTeamName] = useState('');
  const [appointTeamTag, setAppointTeamTag] = useState('');
  const [appointTeamColor, setAppointTeamColor] = useState('#7C3AED');
  const [appointTeamLogo, setAppointTeamLogo] = useState('🛡️');
  const [appointError, setAppointError] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [playerFilter, setPlayerFilter] = useState<'all' | 'applicants' | 'captains' | 'pool' | 'unsold' | 'sold'>('all');
  const [targetTeamCount, setTargetTeamCount] = useState<number>(() => config.teamFormation?.numberOfTeams || 4);

  const handleOpenAppointModal = (reg: DotaTournamentRegistration) => {
    setAppointModalContender(reg);
    setAppointTeamName(`${reg.ign}'s Squad`);
    const defaultTag = (reg.ign.replace(/[^a-zA-Z]/g, '').slice(0, 3) || 'TM').toUpperCase();
    setAppointTeamTag(defaultTag);
    setAppointTeamColor('#7C3AED');
    setAppointTeamLogo('🛡️');
    setAppointError(null);
  };

  const handleConfirmAppointCaptain = () => {
    if (!appointModalContender) return;
    if (!appointTeamName.trim()) {
      setAppointError('Team name is required.');
      return;
    }
    const cleanTag = (appointTeamTag.trim() || 'TM').slice(0, 4).toUpperCase();
    const res = tournamentService.appointDotaCaptain(
      appointModalContender.userId,
      {
        teamName: appointTeamName.trim(),
        tag: cleanTag,
        color: appointTeamColor,
        logo: appointTeamLogo
      },
      config.identity.tournamentId
    );

    if (res.success) {
      setActionSuccessNotice(`✓ Successfully appointed ${appointModalContender.ign} as Captain of ${appointTeamName.trim()}! Notification with Auction Room call-to-action sent.`);
      setTimeout(() => setActionSuccessNotice(null), 5000);
      setAppointModalContender(null);
      setAppointError(null);
      refreshState();
    } else {
      setAppointError(res.error || 'Failed to appoint captain.');
    }
  };

  const handleUnassignCaptain = (reg: DotaTournamentRegistration) => {
    const res = tournamentService.resetDotaCaptain(reg.userId, config.identity.tournamentId);
    if (res.success) {
      setActionSuccessNotice(`✓ Unassigned captain status for ${reg.ign}. Team dissolved and player returned to auction pool.`);
      setTimeout(() => setActionSuccessNotice(null), 4000);
      refreshState();
    } else {
      setActionSuccessNotice(`⚠️ ${res.error || 'Failed to unassign captain.'}`);
      setTimeout(() => setActionSuccessNotice(null), 4000);
    }
  };

  useEffect(() => {
    setTournamentRegs(tournamentService.getTournamentRegistrations(config.identity.tournamentId));
    const unsub = tournamentService.subscribe(() => {
      setTournamentRegs(tournamentService.getTournamentRegistrations(config.identity.tournamentId));
    });
    return unsub;
  }, [config.identity.tournamentId]);

  const refreshState = () => {
    setTeams(engine.getTeams());
    setPremadeApps(engine.getPremadeApplications());
    setMatches(engine.getMatches());
    setAuditLogs(engine.getAuditTrail());
    setCurrentStage(engine.getCurrentStage());
    setTournamentRegs(tournamentService.getTournamentRegistrations(config.identity.tournamentId));
  };

  // Premade review actions
  const handleApprove = (appId: string) => {
    engine.reviewPremadeTeam(appId, 'APPROVED');
    refreshState();
  };

  const handleReject = (appId: string) => {
    engine.reviewPremadeTeam(appId, 'REJECTED', 'Roster does not meet MMR or verification requirements.');
    refreshState();
  };

  const handleGenerateBracket = () => {
    try {
      engine.generateCompetition();
      refreshState();
      setActiveTab('competition');
    } catch (e: any) {
      setAlertModalState({
        isOpen: true,
        title: 'Bracket Generation Failed',
        message: e.message || 'Failed to generate competition bracket.',
        variant: 'error'
      });
    }
  };

  const handleExecuteScore = (matchId: string) => {
    const res = engine.executeMatchResult(matchId, scoreA, scoreB);
    if (!res.success) {
      setAlertModalState({
        isOpen: true,
        title: 'Match Result Submission Failed',
        message: res.error || 'Failed to submit match score.',
        variant: 'error'
      });
      return;
    }
    setSelectedMatchId(null);
    refreshState();
  };

  const handleCompleteTournament = () => {
    if (teams.length < 2) return;
    engine.completeTournament(teams[0].id, teams[1].id, teams[2]?.id);
    refreshState();
  };

  const handleAddSamplePremadeTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const gameRoles = ['Position 1 — Carry', 'Position 2 — Mid', 'Position 3 — Offlane', 'Position 4 — Soft Support', 'Position 5 — Hard Support'];
    const capName = newCaptainName.trim() || 'Captain';

    const roster = [
      { id: `p-${Date.now()}-1`, inGameName: capName, displayName: capName, role: gameRoles[1], ratingOrMmr: 5600, isCaptain: true, isSubstitute: false },
      { id: `p-${Date.now()}-2`, inGameName: `${newTeamTag || 'TM'}-Fragger`, displayName: 'Fragger', role: gameRoles[0], ratingOrMmr: 5400, isCaptain: false, isSubstitute: false },
      { id: `p-${Date.now()}-3`, inGameName: `${newTeamTag || 'TM'}-Anchor`, displayName: 'Anchor', role: gameRoles[2], ratingOrMmr: 5200, isCaptain: false, isSubstitute: false },
      { id: `p-${Date.now()}-4`, inGameName: `${newTeamTag || 'TM'}-Supp1`, displayName: 'Supp1', role: gameRoles[3], ratingOrMmr: 5000, isCaptain: false, isSubstitute: false },
      { id: `p-${Date.now()}-5`, inGameName: `${newTeamTag || 'TM'}-Supp2`, displayName: 'Supp2', role: gameRoles[4], ratingOrMmr: 4900, isCaptain: false, isSubstitute: false }
    ];

    const subs = config.roster.substituteSlots > 0 ? [
      { id: `p-${Date.now()}-sub`, inGameName: `${newTeamTag || 'TM'}-Sub`, displayName: 'Sub', role: gameRoles[0], ratingOrMmr: 4800, isCaptain: false, isSubstitute: true }
    ] : [];

    const res = engine.submitPremadeTeam(
      newTeamName,
      newTeamTag || 'TAG',
      '🛡️',
      newTeamCity,
      `cap-${Date.now()}`,
      `cap@${newTeamName.toLowerCase().replace(/ /g, '')}.in`,
      roster,
      subs
    );

    if (res.success && res.application) {
      // Auto-approve for demo convenience
      engine.reviewPremadeTeam(res.application.id, 'APPROVED');
    }

    setShowAddTeamModal(false);
    setNewTeamName('');
    setNewTeamTag('');
    setNewCaptainName('');
    refreshState();
  };

  return (
    <div className="space-y-6">
      {/* Tournament Identity Banner */}
      <div className="bg-[#FFE600] border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-black text-[#FFE600] px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                ACTIVE TOURNAMENT
              </span>
              <span className="bg-[#7C3AED] text-white px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                {config.identity.gameName}
              </span>
              <span className="border-2 border-black bg-white text-black px-2 py-0.5 font-mono text-[10px] font-black uppercase">
                {config.registration.registrationMode}
              </span>
            </div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-black">
              {config.identity.name}
            </h1>
            <p className="font-mono text-xs text-stone-900 mt-1 max-w-2xl">
              {config.identity.description} · Region: {config.identity.region} · Prize: {formatINR(config.prizes.totalPrizePoolINR)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase bg-black text-white px-3 py-1.5 border-2 border-black">
              STAGE: {currentStage}
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b-4 border-black pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
            activeTab === 'overview'
              ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Overview & Config
        </button>

        {isPremade ? (
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
              activeTab === 'teams'
                ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
                : 'bg-white hover:bg-stone-100 text-black'
            }`}
          >
            Team Applications ({premadeApps.length})
          </button>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('players')}
              className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
                activeTab === 'players'
                  ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
                  : 'bg-white hover:bg-stone-100 text-black'
              }`}
            >
              Registered Players
            </button>
            {isAuction && (
              <button
                onClick={() => setActiveTab('auction')}
                className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
                  activeTab === 'auction'
                    ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
                    : 'bg-white hover:bg-stone-100 text-black'
                }`}
              >
                Auction Draft
              </button>
            )}
          </>
        )}

        <button
          onClick={() => setActiveTab('registrations')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
            activeTab === 'registrations'
              ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Registration &amp; MMR Review
        </button>

        <button
          onClick={() => setActiveTab('competition')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
            activeTab === 'competition'
              ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Competition & Brackets ({matches.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all ${
            activeTab === 'audit'
              ? 'bg-black text-white shadow-[3px_3px_0px_0px_#FFE600]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Audit Ledger ({auditLogs.length})
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border-4 border-black p-5 shadow-[4px_4px_0px_0px_#000] md:col-span-2 space-y-4">
            <h3 className="font-mono text-sm font-black uppercase border-b-2 border-stone-200 pb-2">
              Tournament Specifications
            </h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <span className="text-stone-500 uppercase">Game Title</span>
                <p className="font-bold text-sm">{config.identity.gameName}</p>
              </div>
              <div>
                <span className="text-stone-500 uppercase">Competition Format</span>
                <p className="font-bold text-sm">{config.competition.format} ({config.competition.defaultSeriesFormat})</p>
              </div>
              <div>
                <span className="text-stone-500 uppercase">Registration Model</span>
                <p className="font-bold text-sm">{config.registration.registrationMode}</p>
              </div>
              <div>
                <span className="text-stone-500 uppercase">Team Formation</span>
                <p className="font-bold text-sm">{config.teamFormation.mode}</p>
              </div>
              <div>
                <span className="text-stone-500 uppercase">Total Teams Target</span>
                <p className="font-bold text-sm">{config.teamFormation.numberOfTeams} Teams</p>
              </div>
              <div>
                <span className="text-stone-500 uppercase">Roster Composition</span>
                <p className="font-bold text-sm">{config.roster.primaryRosterSize} Primary + {config.roster.substituteSlots} Sub</p>
              </div>
            </div>

            <div className="pt-4 border-t-2 border-stone-200 flex flex-wrap gap-3">
              <button
                onClick={handleGenerateBracket}
                disabled={teams.length < 2}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" /> Generate {config.competition.format} Structure
              </button>

              <button
                onClick={handleCompleteTournament}
                disabled={matches.length === 0}
                className="bg-black hover:bg-stone-800 text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Award className="w-3.5 h-3.5 text-[#FFE600]" /> Finalize & Crown Champion
              </button>
            </div>
          </div>

          <div className="bg-stone-50 border-4 border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
            <h3 className="font-mono text-sm font-black uppercase border-b-2 border-stone-200 pb-2">
              Guaranteed Prizes
            </h3>
            <div className="text-2xl font-black text-[#7C3AED] font-mono">
              {formatINR(config.prizes.totalPrizePoolINR)}
            </div>
            <div className="space-y-2 font-mono text-xs">
              {config.prizes.placementDistribution.map((p, idx) => (
                <div key={idx} className="flex justify-between border-b border-stone-200 py-1">
                  <span className="font-bold">{p.placement}</span>
                  <span className="font-black text-emerald-700">{formatINR(p.amountINR)} ({p.percentage}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PREMADE TEAMS TAB */}
      {isPremade && activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <div>
              <h3 className="font-mono text-sm font-black uppercase">
                Premade Team Applications ({premadeApps.length} Registered · {teams.length} Approved)
              </h3>
              <p className="text-xs font-mono text-stone-600">
                Organizers review submitted rosters, role assignments, and substitutes.
              </p>
            </div>
            <button
              onClick={() => setShowAddTeamModal(true)}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add Premade Team
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {premadeApps.map((app) => (
              <div key={app.id} className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] font-mono space-y-3">
                <div className="flex items-center justify-between border-b-2 border-stone-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{app.logo || '🛡️'}</span>
                    <div>
                      <h4 className="font-black text-base">{app.teamName} [{app.tag}]</h4>
                      <p className="text-[10px] text-stone-500 uppercase">{app.homeCity} · Mgr: {app.managerEmail}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-black uppercase border ${
                    app.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-900 border-emerald-400' :
                    app.status === 'REJECTED' ? 'bg-red-100 text-red-900 border-red-400' :
                    'bg-amber-100 text-amber-900 border-amber-400'
                  }`}>
                    {app.status}
                  </span>
                </div>

                {/* Roster list */}
                <div>
                  <div className="text-[10px] font-black uppercase text-stone-500 mb-1">
                    PRIMARY ROSTER ({app.roster.length}/{config.roster.primaryRosterSize})
                  </div>
                  <div className="space-y-1">
                    {app.roster.map((p) => (
                      <div key={p.id} className="flex justify-between items-center text-xs bg-stone-50 px-2 py-1 border border-stone-200">
                        <span className="font-bold">
                          {p.inGameName} {p.isCaptain && <span className="bg-[#FFE600] px-1 text-[9px] border border-black font-black">CAPTAIN</span>}
                        </span>
                        <span className="text-stone-500 text-[11px]">{p.role} · {p.ratingOrMmr} MMR</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Substitutes */}
                {app.substitutes.length > 0 && (
                  <div>
                    <div className="text-[10px] font-black uppercase text-stone-500 mb-1">
                      SUBSTITUTES ({app.substitutes.length})
                    </div>
                    {app.substitutes.map((s) => (
                      <div key={s.id} className="text-xs bg-amber-50 px-2 py-1 border border-amber-200 flex justify-between">
                        <span>{s.inGameName} (Stand-in)</span>
                        <span className="text-stone-500">{s.role}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Review Controls */}
                {((app.status as any) === 'SUBMITTED' || (app.status as any) === 'PENDING_REVIEW') && (
                  <div className="pt-2 border-t-2 border-stone-200 flex gap-2">
                    <button
                      onClick={() => handleApprove(app.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 font-mono text-xs font-black uppercase flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Team
                    </button>
                    <button
                      onClick={() => handleReject(app.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 font-mono text-xs font-black uppercase flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGISTERED CONTENDERS / PLAYERS TAB */}
      {!isPremade && activeTab === 'players' && (() => {
        const auctionEngine = tournamentService.getDotaAuctionEngine(config.identity.tournamentId);
        const auctionTeams = auctionEngine.getTeams();
        const auctionPlayers = auctionEngine.getPlayers();
        const unsoldPlayers = auctionEngine.getUnsoldPlayers();
        const soldPlayers = auctionEngine.getSoldPlayers();
        const assignedCaptainCount = auctionTeams.length;
        const captainApplicantsCount = tournamentRegs.filter(r => r.interestedInCaptaincy || r.applyingAsCaptain).length;
        const auctionPoolCount = tournamentRegs.filter(r => {
          const isCap = auctionTeams.some(t => t.captainId === r.userId || (r.teamId && t.id === r.teamId));
          return !isCap && !r.isCaptainApproved;
        }).length;

        const filteredRegs = tournamentRegs.filter(reg => {
          const isCap = Boolean(reg.isCaptainApproved || auctionTeams.some(t => t.captainId === reg.userId));
          const isApplicant = Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
          const pObj = auctionPlayers.find(p => p.id === reg.userId || p.userId === reg.userId);
          const isUnsold = pObj?.status === 'UNSOLD';
          const isSold = pObj?.status === 'SOLD' || isCap;
          if (playerFilter === 'applicants') return isApplicant && !isCap;
          if (playerFilter === 'captains') return isCap;
          if (playerFilter === 'pool') return !isCap;
          if (playerFilter === 'unsold') return isUnsold;
          if (playerFilter === 'sold') return isSold;
          return true;
        });

        return (
          <div className="space-y-4">
            {/* Action Success Toast Notice */}
            {actionSuccessNotice && (
              <div className="bg-[#70FFAF] text-black border-[3px] border-black p-3.5 shadow-[4px_4px_0px_0px_#000] font-mono text-xs font-black flex items-center justify-between gap-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 fill-black" />
                  <span>{actionSuccessNotice}</span>
                </div>
                <button
                  onClick={() => setActionSuccessNotice(null)}
                  className="px-1.5 py-0.5 border border-black hover:bg-black hover:text-white cursor-pointer text-[10px]"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Unsold Contenders Alert Banner */}
            {isAuction && unsoldPlayers.length > 0 && (
              <div className="bg-[#FFF4E5] border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <strong className="text-sm font-black uppercase text-black block">
                      {unsoldPlayers.length} Contender(s) Passed as UNSOLD in Auction
                    </strong>
                    <p className="text-xs text-stone-600 mt-0.5">
                      These players had no winning bids. You can re-auction them individually or return all unsold players to the pool so teams can draft them.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setPlayerFilter('unsold')}
                    className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    Filter Unsold ({unsoldPlayers.length})
                  </button>
                  <button
                    onClick={() => {
                      const res = tournamentService.startDotaUnsoldSecondPass(config.identity.tournamentId);
                      if (res.success) {
                        setActionSuccessNotice(`✓ Re-auction started! ${res.reauctionCount} unsold contenders returned to pool.`);
                      }
                    }}
                    className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    ⚡ Re-Auction All to Pool
                  </button>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('auction', config.identity.tournamentId)}
                      className="bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Enter Auction Room ↗
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Auction Setup & Team Slots Summary Card */}
            {isAuction && (
              <div className="bg-[#FFF9E6] border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] font-mono text-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#7C3AED] block">
                      AUCTION ROSTER DRAFT SETUP · ORGANISER CONTROLS
                    </span>
                    <h4 className="font-sans font-black text-base sm:text-lg uppercase text-black">
                      Franchise Captains &amp; Auction Pool Management
                    </h4>
                    <p className="text-[11px] text-stone-600 mt-0.5">
                      Select captains from contenders who applied for captaincy. Unchosen players remain in the live auction pool for captains to bid on.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-stone-700 shrink-0">Target Teams:</span>
                    <SelectDropdown
                      value={targetTeamCount}
                      onChange={(val) => setTargetTeamCount(Number(val))}
                      options={[
                        { value: 2, label: '2 Teams (10 Players)' },
                        { value: 3, label: '3 Teams (15 Players)' },
                        { value: 4, label: '4 Teams (20 Players)' },
                        { value: 6, label: '6 Teams (30 Players)' },
                        { value: 8, label: '8 Teams (40 Players)' },
                        { value: 10, label: '10 Teams (50 Players)' },
                        { value: 12, label: '12 Teams (60 Players)' },
                        { value: 16, label: '16 Teams (80 Players)' }
                      ]}
                      size="sm"
                      mobileTitle="Select Target Teams"
                      className="min-w-[170px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Appointed Captains</span>
                    <span className="font-black text-lg text-[#7C3AED]">
                      {assignedCaptainCount} / {targetTeamCount} Slots
                    </span>
                  </div>
                  <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Captain Applicants</span>
                    <span className="font-black text-lg text-black">
                      {captainApplicantsCount} Interested
                    </span>
                  </div>
                  <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] font-bold text-stone-500 uppercase block">Auction Pool Size</span>
                    <span className="font-black text-lg text-emerald-700">
                      {auctionPoolCount} Contenders
                    </span>
                  </div>
                  <div className="bg-white border-2 border-black p-3 shadow-[2px_2px_0px_0px_#000] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-stone-500 uppercase block">Live Auction Room</span>
                      <span className="text-xs font-black text-stone-800">
                        {assignedCaptainCount >= 2 ? 'Lobby Ready' : 'Needs 2+ Captains'}
                      </span>
                    </div>
                    {onNavigate && (
                      <button
                        onClick={() => onNavigate('auction', config.identity.tournamentId)}
                        className="bg-[#7C3AED] hover:bg-purple-700 text-white border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer"
                      >
                        Enter ↗
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contender Actions & Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000]">
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                <button
                  onClick={() => setPlayerFilter('all')}
                  className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer ${
                    playerFilter === 'all'
                      ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  All ({tournamentRegs.length})
                </button>
                <button
                  onClick={() => setPlayerFilter('applicants')}
                  className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    playerFilter === 'applicants'
                      ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  <span>👑 Applicants ({captainApplicantsCount})</span>
                </button>
                <button
                  onClick={() => setPlayerFilter('captains')}
                  className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer flex items-center gap-1 ${
                    playerFilter === 'captains'
                      ? 'bg-[#70FFAF] text-black shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  <span>⭐ Captains ({assignedCaptainCount})</span>
                </button>
                <button
                  onClick={() => setPlayerFilter('pool')}
                  className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer ${
                    playerFilter === 'pool'
                      ? 'bg-[#BAE6FD] text-black shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                  }`}
                >
                  Auction Pool ({auctionPoolCount})
                </button>
                {isAuction && (
                  <>
                    <button
                      onClick={() => setPlayerFilter('unsold')}
                      className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer flex items-center gap-1 ${
                        playerFilter === 'unsold'
                          ? 'bg-[#FF70A6] text-black shadow-[2px_2px_0px_0px_#000]'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
                      }`}
                    >
                      <span>⚠️ Unsold ({unsoldPlayers.length})</span>
                    </button>
                    <button
                      onClick={() => setPlayerFilter('sold')}
                      className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs transition-all cursor-pointer flex items-center gap-1 ${
                        playerFilter === 'sold'
                          ? 'bg-[#70FFAF] text-black shadow-[2px_2px_0px_0px_#000]'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      <span>✅ Sold ({soldPlayers.length})</span>
                    </button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap font-mono text-xs">
                <button
                  onClick={() => {
                    setPlayerModalInitialTab('manual');
                    setShowPlayerModal(true);
                  }}
                  className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-1.5 font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  + Enter Player / Upload File
                </button>
                <button
                  onClick={() => {
                    setPlayerModalInitialTab('dummy');
                    setShowPlayerModal(true);
                  }}
                  className="bg-[#70FFAF] hover:bg-[#52e896] text-black border-2 border-black px-3 py-1.5 font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  <Bot className="w-4 h-4" />
                  ⚡ Add Dummy Players
                </button>
              </div>
            </div>

            <div className="bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Player IGN</th>
                      <th className="p-3">Primary Role</th>
                      <th className="p-3">Secondary Role</th>
                      <th className="p-3 text-right">MMR</th>
                      <th className="p-3">Hometown</th>
                      <th className="p-3 text-center">Captaincy</th>
                      <th className="p-3 text-center">Auction / Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-stone-200">
                    {filteredRegs.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center bg-stone-50 font-mono">
                          <div className="max-w-md mx-auto space-y-2">
                            <p className="font-black text-sm text-black uppercase">No contenders match this filter</p>
                            <p className="text-xs text-stone-600">
                              {playerFilter === 'applicants'
                                ? 'No contenders currently have active captain applications for this tournament.'
                                : playerFilter === 'unsold'
                                ? 'No contenders are currently marked unsold.'
                                : 'Try switching the filter tab above or adding new players.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRegs.map((reg, idx) => {
                        const assignedTeam = auctionTeams.find(t => t.captainId === reg.userId || (reg.teamId && t.id === reg.teamId));
                        const isAssignedCaptain = Boolean(reg.isCaptainApproved || assignedTeam);
                        const isCaptainApplicant = Boolean(reg.interestedInCaptaincy || reg.applyingAsCaptain);
                        const pObj = auctionPlayers.find(p => p.id === reg.userId || p.userId === reg.userId);
                        const isVerified = reg.status === 'VERIFIED';
                        const mmrVal = reg.tournamentMmr || reg.declaredMmr || 0;

                        return (
                          <tr key={reg.id} className="hover:bg-[#FFFDE8] transition-colors">
                            <td className="p-3 font-bold text-stone-500">{idx + 1}</td>
                            <td className="p-3 font-black text-black">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{reg.ign}</span>
                                {isAssignedCaptain ? (
                                  <span className="bg-[#70FFAF] border border-black text-[9px] px-1 font-bold uppercase inline-flex items-center gap-0.5">
                                    <Crown className="w-2.5 h-2.5" /> Captain
                                  </span>
                                ) : isCaptainApplicant ? (
                                  <span className="bg-[#FFE600] border border-black text-[9px] px-1 font-bold uppercase">
                                    Applicant
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="p-3 font-bold text-stone-800">{reg.primaryRole}</td>
                            <td className="p-3 text-stone-500">{reg.secondaryRole || '—'}</td>
                            <td className="p-3 text-right font-black text-black">
                              <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black inline-block">
                                {mmrVal.toLocaleString()}
                              </span>
                            </td>
                            <td className="p-3 text-stone-600">{reg.city || 'India'}</td>
                            <td className="p-3 text-center">
                              {isAssignedCaptain ? (
                                <span className="text-[10px] font-black uppercase bg-[#70FFAF] text-black px-1.5 py-0.5 border border-black inline-flex items-center gap-1">
                                  <Crown className="w-3 h-3 text-black shrink-0" />
                                  <span>{assignedTeam ? assignedTeam.name : 'Captain'}</span>
                                </span>
                              ) : isCaptainApplicant ? (
                                <span className="text-[10px] font-black uppercase bg-[#FFE600] text-black px-1.5 py-0.5 border border-black">
                                  ★ Applicant
                                </span>
                              ) : (
                                <span className="text-stone-400 text-[10px]">No</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {isAuction && (
                                  <span className={`px-2 py-0.5 text-[9px] font-black border border-black uppercase ${
                                    isAssignedCaptain ? 'bg-[#70FFAF] text-black' :
                                    pObj?.status === 'SOLD' ? 'bg-[#70FFAF] text-black' :
                                    pObj?.status === 'UNSOLD' ? 'bg-[#FF70A6] text-black animate-pulse' :
                                    pObj?.status === 'UNSELECTED' ? 'bg-stone-200 text-stone-700' :
                                    'bg-[#BAE6FD] text-black'
                                  }`}>
                                    {isAssignedCaptain 
                                      ? `👑 ${assignedTeam?.name || 'Captain'}` 
                                      : pObj?.status === 'SOLD' 
                                      ? `Sold (${pObj.teamName || 'Team'})` 
                                      : pObj?.status === 'UNSOLD' 
                                      ? '⚠️ UNSOLD' 
                                      : pObj?.status || 'AVAILABLE'}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold border border-black uppercase ${
                                  isVerified ? 'bg-emerald-50 text-emerald-800' :
                                  reg.status === 'UNDER_REVIEW' ? 'bg-blue-50 text-blue-800' :
                                  'bg-amber-50 text-amber-800'
                                }`}>
                                  {reg.status}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                {isAuction && pObj?.status === 'UNSOLD' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        const res = tournamentService.reauctionDotaPlayer(reg.userId, config.identity.tournamentId);
                                        if (res.success) {
                                          setActionSuccessNotice(`✓ ${reg.ign} returned to available pool for re-auction!`);
                                          refreshState();
                                        }
                                      }}
                                      title="Return unsold contender to available pool"
                                      className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    >
                                      ⚡ Re-Auction
                                    </button>
                                    <button
                                      onClick={() => {
                                        const res = tournamentService.reauctionAndNominateDotaPlayer(reg.userId, config.identity.tournamentId);
                                        if (res.success) {
                                          if (onNavigate) {
                                            onNavigate('auction', config.identity.tournamentId);
                                          } else {
                                            setActionSuccessNotice(`✓ ${reg.ign} re-auctioned and nominated live!`);
                                          }
                                        }
                                      }}
                                      title="Re-nominate directly onto auction floor"
                                      className="bg-[#7C3AED] hover:bg-purple-700 text-white border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    >
                                      ⚡ Nominate
                                    </button>
                                  </>
                                )}
                                {isAuction && !isAssignedCaptain && pObj?.status !== 'SOLD' && (
                                  <button
                                    onClick={() => handleOpenAppointModal(reg)}
                                    title="Appoint as Franchise Captain"
                                    className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000] flex items-center gap-1"
                                  >
                                    <Crown className="w-3 h-3" /> Appoint
                                  </button>
                                )}
                                {isAuction && isAssignedCaptain && (
                                  <button
                                    onClick={() => handleUnassignCaptain(reg)}
                                    title="Unassign Captain"
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-black px-1.5 py-1 text-[10px] font-black uppercase cursor-pointer"
                                  >
                                    Unassign
                                  </button>
                                )}
                                {!isVerified && (
                                  <button
                                    onClick={async () => {
                                      await tournamentService.verifyRegistration(config.identity.tournamentId, reg.userId, mmrVal);
                                      refreshState();
                                    }}
                                    className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                  >
                                    Verify
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    await tournamentService.removeTournamentRegistration(config.identity.tournamentId, reg.userId);
                                    refreshState();
                                  }}
                                  title="Remove contender"
                                  className="bg-red-50 hover:bg-red-200 text-red-700 border border-black px-1.5 py-1 text-[10px] font-black uppercase cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* COMPETITION & MATCHES TAB */}
      {activeTab === 'competition' && (
        <div className="space-y-4">
          <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex justify-between items-center">
            <div>
              <h3 className="font-mono text-sm font-black uppercase">
                {config.competition.format} Bracket & Schedule ({matches.length} Matches)
              </h3>
              <p className="text-xs font-mono text-stone-600">
                Click "Enter Score" on any match to record official results and apply rating updates.
              </p>
            </div>
            <button
              onClick={handleGenerateBracket}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]"
            >
              Re-Seed & Generate Bracket
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {matches.map((m) => (
              <div key={m.id} className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] font-mono space-y-3">
                <div className="flex justify-between items-center border-b-2 border-stone-200 pb-2">
                  <span className="font-black text-xs uppercase bg-[#FFE600] px-2 py-0.5 border border-black">
                    {m.round} ({m.seriesFormat})
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 border ${
                    m.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-900 border-emerald-400' :
                    m.status === 'BYE' ? 'bg-purple-100 text-purple-900 border-purple-400' :
                    'bg-stone-100 text-stone-700 border-stone-300'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className={`p-2 border-2 flex justify-between items-center ${
                    m.winnerId && m.teamA && m.winnerId === m.teamA.id ? 'bg-emerald-50 border-emerald-500 font-black' : 'border-stone-200'
                  }`}>
                    <span>{m.teamA?.name || 'TBD'}</span>
                    <span className="text-base font-black">{m.scoreA}</span>
                  </div>

                  <div className={`p-2 border-2 flex justify-between items-center ${
                    m.winnerId && m.teamB && m.winnerId === m.teamB.id ? 'bg-emerald-50 border-emerald-500 font-black' : 'border-stone-200'
                  }`}>
                    <span>{m.teamB?.name || (m.status === 'BYE' ? 'BYE (Automatic Advance)' : 'TBD')}</span>
                    <span className="text-base font-black">{m.scoreB}</span>
                  </div>
                </div>

                {m.status !== 'BYE' && (
                  <div className="pt-2 border-t-2 border-stone-200">
                    {selectedMatchId === m.id ? (
                      <div className="bg-stone-100 p-2 border border-black space-y-2">
                        <div className="text-[11px] font-bold">Enter Series Score:</div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={scoreA}
                            onChange={(e) => setScoreA(Number(e.target.value))}
                            className="w-16 border-2 border-black p-1 text-center font-bold"
                          />
                          <span>—</span>
                          <input
                            type="number"
                            min={0}
                            max={5}
                            value={scoreB}
                            onChange={(e) => setScoreB(Number(e.target.value))}
                            className="w-16 border-2 border-black p-1 text-center font-bold"
                          />
                          <button
                            onClick={() => handleExecuteScore(m.id)}
                            className="bg-emerald-600 text-white px-3 py-1 font-bold text-xs hover:bg-emerald-700"
                          >
                            Commit Score
                          </button>
                          <button
                            onClick={() => setSelectedMatchId(null)}
                            className="text-xs text-stone-600 underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          setScoreA(m.scoreA || 2);
                          setScoreB(m.scoreB || 0);
                        }}
                        className="bg-black hover:bg-stone-800 text-white px-3 py-1 font-mono text-xs font-bold uppercase w-full text-center"
                      >
                        {m.status === 'COMPLETED' ? 'Update Score' : 'Record Result →'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGISTRATIONS & MMR REVIEW TAB */}
      {activeTab === 'registrations' && (
        <OrganiserRegistrationReview
          tournamentId={config.identity.tournamentId}
          tournamentName={config.identity.name}
        />
      )}

      {/* AUCTION DRAFT TAB */}
      {activeTab === 'auction' && isAuction && (
        <div className="space-y-4 font-mono">
          <div className="bg-[#FFE600] border-2 border-black p-3 text-xs font-black uppercase flex items-center justify-between">
            <span>Tournament Auction Block · {config.identity.name}</span>
            <button
              onClick={() => onNavigate && onNavigate('auction', config.identity.tournamentId)}
              className="bg-black text-white px-3 py-1 text-[11px] font-black uppercase hover:bg-stone-800 cursor-pointer shadow-[2px_2px_0px_0px_#fff]"
            >
              Open Dedicated Auction Room ↗
            </button>
          </div>
          <AuctionDraft onNavigate={onNavigate} tournamentId={config.identity.tournamentId} />
        </div>
      )}

      {/* AUDIT TAB */}
      {activeTab === 'audit' && (
        <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_#000] font-mono">
          <h3 className="text-sm font-black uppercase mb-3">Audit Trail & Event Ledger</h3>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {auditLogs.map((log, i) => (
              <div key={i} className="text-xs bg-stone-50 p-2 border border-stone-200 flex justify-between">
                <div>
                  <span className="font-bold text-[#7C3AED] uppercase">[{log.action}]</span> {log.details}
                </div>
                <span className="text-[10px] text-stone-400">{log.timestamp.slice(11, 19)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ADD PREMADE TEAM */}
      {showAddTeamModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_#000] max-w-md w-full font-mono">
            <h3 className="text-lg font-black uppercase mb-4">Register Premade Squad</h3>
            <form onSubmit={handleAddSamplePremadeTeam} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase mb-1">Team Name</label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Pune Phantoms"
                  className="w-full border-2 border-black p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Tag (3-4 chars)</label>
                  <input
                    type="text"
                    required
                    value={newTeamTag}
                    onChange={(e) => setNewTeamTag(e.target.value.toUpperCase())}
                    placeholder="PUN"
                    maxLength={4}
                    className="w-full border-2 border-black p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <SelectDropdown
                    label="Home City"
                    value={newTeamCity}
                    onChange={(val) => setNewTeamCity(val)}
                    options={[
                      { value: 'Mumbai', label: 'Mumbai' },
                      { value: 'Delhi', label: 'Delhi' },
                      { value: 'Bengaluru', label: 'Bengaluru' },
                      { value: 'Hyderabad', label: 'Hyderabad' },
                      { value: 'Chennai', label: 'Chennai' },
                      { value: 'Pune', label: 'Pune' },
                      { value: 'Kolkata', label: 'Kolkata' }
                    ]}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">Captain IGN</label>
                <input
                  type="text"
                  required
                  value={newCaptainName}
                  onChange={(e) => setNewCaptainName(e.target.value)}
                  placeholder="e.g. Spectre"
                  className="w-full border-2 border-black p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="border-2 border-black px-3 py-1.5 text-xs font-bold hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#FFE600] border-2 border-black px-4 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]"
                >
                  Register & Approve
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appoint Captain Modal */}
      {appointModalContender && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#FFE600] fill-black" />
                <h3 className="font-sans font-black text-lg uppercase text-black">
                  Appoint Franchise Captain
                </h3>
              </div>
              <button
                onClick={() => {
                  setAppointModalContender(null);
                  setAppointError(null);
                }}
                className="p-1 hover:bg-black hover:text-white border border-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFF9E6] border-2 border-black p-3 space-y-1 text-xs">
              <div className="font-black text-black text-sm">{appointModalContender.ign}</div>
              <div className="text-stone-600">
                Role: <strong className="text-black">{appointModalContender.primaryRole}</strong> · MMR: <strong className="text-black">{appointModalContender.tournamentMmr || appointModalContender.declaredMmr}</strong>
              </div>
              {appointModalContender.captainNotes && (
                <div className="text-[11px] text-stone-500 italic pt-1 border-t border-black/10">
                  "{appointModalContender.captainNotes}"
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-black uppercase text-[10px] text-stone-600 mb-1">
                  Team / Franchise Name *
                </label>
                <input
                  type="text"
                  value={appointTeamName}
                  onChange={(e) => setAppointTeamName(e.target.value)}
                  placeholder="e.g. Mumbai Cobras"
                  className="w-full bg-white border-2 border-black px-3 py-2 font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black uppercase text-[10px] text-stone-600 mb-1">
                    Team Tag (3-4 Letters) *
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={appointTeamTag}
                    onChange={(e) => setAppointTeamTag(e.target.value.toUpperCase())}
                    placeholder="e.g. COB"
                    className="w-full bg-white border-2 border-black px-3 py-2 font-bold text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block font-black uppercase text-[10px] text-stone-600 mb-1">
                    Team Logo Emoji
                  </label>
                  <div className="flex gap-1 flex-wrap">
                    {['🛡️', '⚔️', '⚡', '🐉', '🦅', '🔥', '👑'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAppointTeamLogo(emoji)}
                        className={`p-1 border border-black text-xs cursor-pointer ${
                          appointTeamLogo === emoji ? 'bg-[#FFE600]' : 'bg-white hover:bg-stone-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-black uppercase text-[10px] text-stone-600 mb-1">
                  Franchise Primary Color
                </label>
                <div className="flex items-center gap-2">
                  {['#7C3AED', '#FF5757', '#FFE600', '#70FFAF', '#3B82F6', '#EC4899'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAppointTeamColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 border-2 border-black cursor-pointer ${
                        appointTeamColor === c ? 'ring-2 ring-black scale-110' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>

              {appointError && (
                <div className="p-2.5 bg-red-100 border-2 border-red-600 text-red-900 text-xs font-bold">
                  {appointError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t-2 border-black">
              <button
                type="button"
                onClick={() => {
                  setAppointModalContender(null);
                  setAppointError(null);
                }}
                className="flex-1 py-2 bg-white hover:bg-stone-100 border-2 border-black font-black uppercase text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAppointCaptain}
                className="flex-1 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Appoint &amp; Dispatch CTA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin / Organiser Contender Studio Modal */}
      {showPlayerModal && (
        <AdminTournamentPlayerManagerModal
          isOpen={showPlayerModal}
          onClose={() => setShowPlayerModal(false)}
          tournamentId={config.identity.tournamentId}
          tournamentName={config.identity.name}
          initialTab={playerModalInitialTab}
          onPlayersUpdated={refreshState}
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
    </div>
  );
};
