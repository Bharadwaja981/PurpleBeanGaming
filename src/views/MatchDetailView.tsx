import { useState, useEffect } from 'react';
import { 
  Swords, 
  Clock, 
  Trophy, 
  Shield, 
  ArrowLeft, 
  Flame, 
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Calendar,
  UserCheck,
  Send,
  Flag,
  FileText,
  Settings,
  HelpCircle,
  Check,
  Link2,
  RefreshCw,
  ExternalLink,
  Activity,
  Info
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { 
  dotaMatchOperations, 
  DotaMatchRecord, 
  MatchResultStatus,
  MatchDisputeRecord 
} from '../domain/dotaMatchOperationsEngine';
import { trustedTournamentOps } from '../server/trustedTournamentOperations';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface MatchDetailViewProps {
  matchId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function MatchDetailView({ matchId = 'ub-r1-m1', onNavigate }: MatchDetailViewProps) {
  // Current user role simulation for testing & demonstration
  const [currentUserRole, setCurrentUserRole] = useState<'organizer' | 'captain_a' | 'captain_b' | 'spectator'>('organizer');
  
  // Real match state
  const [matchRecord, setMatchRecord] = useState<DotaMatchRecord | undefined>(() => dotaMatchOperations.getMatch(matchId));
  const [selectedGameKey, setSelectedGameKey] = useState<number>(1);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals & form state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [scoreAInput, setScoreAInput] = useState(2);
  const [scoreBInput, setScoreBInput] = useState(1);
  
  const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState<string>('INCORRECT_SCORE');
  const [disputeNotes, setDisputeNotes] = useState('');

  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [selectedDisputeId, setSelectedDisputeId] = useState<string>('');
  const [resolveAction, setResolveAction] = useState<'CONFIRM_ORIGINAL' | 'CORRECT_RESULT' | 'ORDER_REMATCH' | 'AWARD_FORFEIT'>('CONFIRM_ORIGINAL');
  const [resolveSummary, setResolveSummary] = useState('');
  const [resolveCorrectedScoreA, setResolveCorrectedScoreA] = useState(2);
  const [resolveCorrectedScoreB, setResolveCorrectedScoreB] = useState(0);
  const [resolveForfeitTeamId, setResolveForfeitTeamId] = useState<string>('');

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedDate, setSchedDate] = useState('2026-10-15');
  const [schedTime, setSchedTime] = useState('18:00 IST');
  const [schedRegion, setSchedRegion] = useState('India (Mumbai)');
  const [schedNotes, setSchedNotes] = useState('Official Match Lobby · Server Mumbai Relay');

  const [isForfeitModalOpen, setIsForfeitModalOpen] = useState(false);
  const [forfeitWinnerTeamId, setForfeitWinnerTeamId] = useState<string>('');
  const [forfeitReasonInput, setForfeitReasonInput] = useState('No Show after 15m check-in window');

  // Phase 6 Dota match linking & stats state
  const [linkMatchIdInput, setLinkMatchIdInput] = useState('');
  const [isLinkingMatch, setIsLinkingMatch] = useState(false);
  const [isRefreshingMatch, setIsRefreshingMatch] = useState(false);

  // Synchronize on mount and updates
  useEffect(() => {
    const refresh = () => {
      const rec = dotaMatchOperations.getMatch(matchId);
      if (rec) setMatchRecord({ ...rec });
    };
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [matchId]);

  // Real matches lookup
  const fallbackReal = tournamentService.getMatches().find((m) => m.id === matchId) 
    || tournamentService.getMatches()[0];

  if (!matchRecord && !fallbackReal) {
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8">
        <Swords className="w-12 h-12 text-[#7C3AED] mx-auto" />
        <h2 className="font-sans font-black text-2xl uppercase">Match Not Found</h2>
        <p className="font-mono text-sm text-stone-600 max-w-md mx-auto">
          The requested match record could not be found or has not been scheduled yet.
        </p>
        <button
          onClick={() => onNavigate('matches')}
          className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          View Match Schedule
        </button>
      </div>
    );
  }

  const record: DotaMatchRecord = matchRecord || {
    id: matchId,
    tournamentId: fallbackReal?.tournamentName || 'Tournament',
    round: fallbackReal?.round || 'Round 1',
    seriesFormat: (fallbackReal?.seriesFormat as any) || 'BO3',
    scheduledTime: fallbackReal?.scheduledTime || new Date().toISOString(),
    scheduledDate: fallbackReal?.scheduledTime ? fallbackReal.scheduledTime.split('T')[0] : new Date().toISOString().split('T')[0],
    serverRegion: 'India (Mumbai)',
    teamA: {
      id: fallbackReal?.teamA.id || 'team-1',
      name: fallbackReal?.teamA.name || 'Team A',
      tag: fallbackReal?.teamA.tag || fallbackReal?.teamA.name.slice(0, 3).toUpperCase() || 'TMA',
      logo: '🛡️',
      rating: 1500,
      seed: 1
    },
    teamB: {
      id: fallbackReal?.teamB.id || 'team-2',
      name: fallbackReal?.teamB.name || 'Team B',
      tag: fallbackReal?.teamB.tag || fallbackReal?.teamB.name.slice(0, 3).toUpperCase() || 'TMB',
      logo: '⚡',
      rating: 1500,
      seed: 2
    },
    checkInStatus: 'WAITING',
    seriesScoreA: fallbackReal?.teamA.score || 0,
    seriesScoreB: fallbackReal?.teamB.score || 0,
    status: (fallbackReal?.status as any) || 'SCHEDULED',
    games: [],
    disputes: [],
    auditHistory: []
  };

  const isLive = record.status === 'LIVE';
  const isFinalized = record.status === 'FINALIZED';
  const isDisputed = record.status === 'DISPUTED';
  const isAwaitingConfirmation = record.status === 'AWAITING_CONFIRMATION' || record.status === 'RESULT_SUBMITTED';

  // Determine authorized flags
  const isOrganiser = currentUserRole === 'organizer';
  const isCaptainA = currentUserRole === 'captain_a';
  const isCaptainB = currentUserRole === 'captain_b';
  const activeTeamId = isCaptainA ? record.teamA.id : isCaptainB ? record.teamB.id : undefined;

  // Handlers
  const handleCheckIn = (teamId: string) => {
    setStatusMessage(null);
    const callerId = isOrganiser ? 'staff-admin' : teamId === record.teamA.id ? 'captain-a' : 'captain-b';
    const role = isOrganiser ? 'organizer' : 'captain';
    const res = dotaMatchOperations.checkInCaptain({
      matchId: record.id,
      teamId,
      callerUserId: callerId,
      callerRole: role
    });
    if (res.success) {
      setStatusMessage({ text: `Check-in confirmed for ${teamId}! Status: ${res.status}`, type: 'success' });
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Check-in failed.', type: 'error' });
    }
  };

  const handleSubmitScore = () => {
    setStatusMessage(null);
    const submittingTeamId = isCaptainB ? record.teamB.id : record.teamA.id;
    const callerId = isOrganiser ? 'staff-referee' : isCaptainB ? 'captain-b' : 'captain-a';
    const role = isOrganiser ? 'organizer' : 'captain';

    const res = dotaMatchOperations.submitResult(
      record.id,
      submittingTeamId,
      Number(scoreAInput),
      Number(scoreBInput),
      callerId,
      role
    );

    if (res.success) {
      setStatusMessage({ text: `Score ${scoreAInput}-${scoreBInput} submitted! Awaiting opponent confirmation.`, type: 'success' });
      setIsSubmitModalOpen(false);
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Score submission failed.', type: 'error' });
    }
  };

  const handleConfirmResult = () => {
    setStatusMessage(null);
    const confirmingTeamId = isCaptainA ? record.teamA.id : record.teamB.id;
    const callerId = isOrganiser ? 'staff-referee' : isCaptainA ? 'captain-a' : 'captain-b';
    const role = isOrganiser ? 'organizer' : 'captain';

    const res = dotaMatchOperations.confirmResult(
      record.id,
      confirmingTeamId,
      callerId,
      role
    );

    if (res.success) {
      setStatusMessage({ text: 'Match result confirmed & canonical progression finalized!', type: 'success' });
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Confirmation failed.', type: 'error' });
    }
  };

  const handleOpenDispute = () => {
    setStatusMessage(null);
    const disputingTeamId = isCaptainB ? record.teamB.id : record.teamA.id;
    const ign = isCaptainB ? `${record.teamB.name} Captain` : `${record.teamA.name} Captain`;
    const callerId = isCaptainB ? 'captain-b' : 'captain-a';

    const res = dotaMatchOperations.openDispute(
      record.id,
      disputingTeamId,
      ign,
      disputeReason,
      disputeNotes,
      [],
      callerId,
      'captain'
    );

    if (res.success) {
      setStatusMessage({ text: `Dispute opened (${disputeReason}). Match is frozen under review.`, type: 'success' });
      setIsDisputeModalOpen(false);
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Failed to open dispute.', type: 'error' });
    }
  };

  const handleResolveDispute = () => {
    setStatusMessage(null);
    if (!selectedDisputeId) return;

    const res = dotaMatchOperations.resolveDispute(
      record.id,
      selectedDisputeId,
      resolveAction,
      'staff-head-referee',
      resolveSummary || `Staff resolution via ${resolveAction}`,
      resolveAction === 'CORRECT_RESULT' ? { scoreA: Number(resolveCorrectedScoreA), scoreB: Number(resolveCorrectedScoreB) } : undefined,
      resolveAction === 'AWARD_FORFEIT' ? resolveForfeitTeamId : undefined,
      'organizer'
    );

    if (res.success) {
      setStatusMessage({ text: `Dispute resolved via ${resolveAction}!`, type: 'success' });
      setIsResolveModalOpen(false);
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Failed to resolve dispute.', type: 'error' });
    }
  };

  const handleScheduleSubmit = () => {
    setStatusMessage(null);
    const res = dotaMatchOperations.scheduleMatch({
      matchId: record.id,
      date: schedDate,
      time: schedTime,
      serverRegion: schedRegion,
      lobbyNotes: schedNotes,
      staffId: 'staff-admin',
      callerRole: 'organizer'
    });

    if (res.success) {
      setStatusMessage({ text: 'Match scheduling updated and notifications dispatched!', type: 'success' });
      setIsScheduleModalOpen(false);
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Scheduling failed.', type: 'error' });
    }
  };

  const handleForfeitSubmit = () => {
    setStatusMessage(null);
    const winnerId = forfeitWinnerTeamId || record.teamA.id;
    const res = dotaMatchOperations.awardForfeit({
      matchId: record.id,
      winningTeamId: winnerId,
      reason: forfeitReasonInput,
      staffId: 'staff-admin',
      callerRole: 'organizer'
    });

    if (res.success) {
      setStatusMessage({ text: `Forfeit awarded to team ${winnerId}!`, type: 'success' });
      setIsForfeitModalOpen(false);
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Failed to award forfeit.', type: 'error' });
    }
  };

  const handleOrderRematchDirect = () => {
    setStatusMessage(null);
    const res = dotaMatchOperations.orderRematch({
      matchId: record.id,
      reason: 'Organizer requested rematch due to network disruption',
      staffId: 'staff-admin',
      callerRole: 'organizer'
    });

    if (res.success) {
      setStatusMessage({ text: `Rematch created: ${res.rematchId}. Original match superseded.`, type: 'success' });
      setMatchRecord({ ...dotaMatchOperations.getMatch(record.id)! });
    } else {
      setStatusMessage({ text: res.error || 'Failed to order rematch.', type: 'error' });
    }
  };

  const handleLinkMatchIdSubmit = async () => {
    if (!linkMatchIdInput.trim()) {
      setStatusMessage({ text: 'Please enter a valid numeric Dota 2 Match ID.', type: 'error' });
      return;
    }
    setIsLinkingMatch(true);
    setStatusMessage(null);
    try {
      const caller = {
        userId: isOrganiser ? 'staff-admin' : isCaptainA ? 'captain-a' : isCaptainB ? 'captain-b' : 'spectator-1',
        role: isOrganiser ? 'organizer' : (isCaptainA || isCaptainB) ? 'captain' : 'spectator',
        isAdmin: isOrganiser,
        email: 'caller@purplebean.gg'
      };

      const res = await trustedTournamentOps.executeLinkDotaMatchId(caller as any, {
        matchId: record.id,
        gameNumber: selectedGameKey,
        dotaMatchId: linkMatchIdInput.trim()
      });

      setStatusMessage({
        text: `Dota Match ID ${linkMatchIdInput} linked to Game ${selectedGameKey}! Status: ${res.reconciliationStatus}`,
        type: 'success'
      });
      setLinkMatchIdInput('');
      const updated = dotaMatchOperations.getMatch(record.id);
      if (updated) setMatchRecord({ ...updated });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to link Dota Match ID.', type: 'error' });
    } finally {
      setIsLinkingMatch(false);
    }
  };

  const handleRefreshOpenDota = async () => {
    setIsRefreshingMatch(true);
    setStatusMessage(null);
    try {
      const caller = {
        userId: isOrganiser ? 'staff-admin' : isCaptainA ? 'captain-a' : isCaptainB ? 'captain-b' : 'spectator-1',
        role: isOrganiser ? 'organizer' : (isCaptainA || isCaptainB) ? 'captain' : 'spectator',
        isAdmin: isOrganiser,
        email: 'caller@purplebean.gg'
      };

      const res = await trustedTournamentOps.executeRefreshOpenDotaMatchData(caller as any, {
        matchId: record.id,
        gameNumber: selectedGameKey
      });

      if (res.cached) {
        setStatusMessage({ text: 'OpenDota data is up to date (rate limit cooldown active).', type: 'success' });
      } else {
        setStatusMessage({ text: `OpenDota data refreshed for Game ${selectedGameKey}! Status: ${res.reconciliationStatus}`, type: 'success' });
      }
      const updated = dotaMatchOperations.getMatch(record.id);
      if (updated) setMatchRecord({ ...updated });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to refresh OpenDota data.', type: 'error' });
    } finally {
      setIsRefreshingMatch(false);
    }
  };

  const handleReviewFlagSubmit = (flagId: string, action: 'ACKNOWLEDGE' | 'DISMISS' | 'RESOLVE') => {
    try {
      const caller = {
        userId: 'staff-admin',
        role: 'organizer',
        isAdmin: true,
        email: 'admin@purplebean.gg'
      };

      trustedTournamentOps.executeReviewMismatchFlag(caller as any, {
        matchId: record.id,
        gameNumber: selectedGameKey,
        flagId,
        action,
        notes: `Reviewed by ${currentUserRole}`
      });

      setStatusMessage({ text: `Flag marked as ${action}!`, type: 'success' });
      const updated = dotaMatchOperations.getMatch(record.id);
      if (updated) setMatchRecord({ ...updated });
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to update review flag.', type: 'error' });
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Bar with Navigation and Role Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => onNavigate('matches')}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Matches</span>
        </button>

        {/* Role Switcher for Phase 5 Testing & Authoritative Controls */}
        <div className="flex items-center gap-2 bg-stone-100 p-1 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
          <span className="font-mono text-[10px] font-black uppercase text-stone-600 px-2">Role:</span>
          {(['organizer', 'captain_a', 'captain_b', 'spectator'] as const).map(role => (
            <button
              key={role}
              onClick={() => setCurrentUserRole(role)}
              className={`px-2.5 py-1 font-mono text-xs font-black uppercase border border-black cursor-pointer transition-colors ${
                currentUserRole === role
                  ? 'bg-[#7C3AED] text-white shadow-[1.5px_1.5px_0px_0px_#000]'
                  : 'bg-white text-stone-700 hover:bg-stone-200'
              }`}
            >
              {role === 'organizer' ? 'Organizer / Referee' :
               role === 'captain_a' ? `Capt. ${record.teamA.name.slice(0, 10)}` :
               role === 'captain_b' ? `Capt. ${record.teamB.name.slice(0, 10)}` : 'Spectator'}
            </button>
          ))}
        </div>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div className={`p-4 border-2 border-black font-mono text-xs font-bold shadow-[4px_4px_0px_0px_#000] flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-100 text-emerald-950 border-emerald-950' : 'bg-red-100 text-red-950 border-red-950'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="font-mono font-black text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* ============================================================ */}
      {/* 1. MATCH HEADER SHOWCASE */}
      {/* ============================================================ */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-10 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-[#FFE600] border-2 border-black px-2.5 py-0.5 font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000]">
              {record.tournamentId}
            </span>
            <span className="text-stone-500 font-bold">· {record.round}</span>
            {record.isRematch && (
              <span className="bg-amber-300 text-amber-950 border border-black px-2 py-0.5 font-black text-[10px] uppercase">
                REMATCH OF {record.rematchOfMatchId}
              </span>
            )}
            {record.supersededByMatchId && (
              <span className="bg-stone-300 text-stone-800 border border-black px-2 py-0.5 font-black text-[10px] uppercase">
                SUPERSEDED BY {record.supersededByMatchId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="bg-[#7C3AED] text-white px-2.5 py-0.5 font-black uppercase border border-black">
              Dota 2
            </span>
            <span className="bg-black text-white px-2.5 py-0.5 font-black uppercase">
              {record.seriesFormat}
            </span>
            <span className={`px-2.5 py-0.5 border border-black font-black uppercase ${
              isLive ? 'bg-[#FF5757] text-white animate-pulse' :
              isFinalized ? 'bg-emerald-400 text-black' :
              isDisputed ? 'bg-red-500 text-white animate-bounce' :
              isAwaitingConfirmation ? 'bg-[#FFE600] text-black' :
              record.status === 'FORFEIT' ? 'bg-stone-400 text-black' :
              'bg-[#5CE1E6] text-black'
            }`}>
              {isLive ? '● LIVE' : record.status}
            </span>
          </div>
        </div>

        {/* Head-to-Head Scoreboard */}
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 sm:gap-6 items-center">
          {/* Team A */}
          <div className="md:col-span-4 flex items-center md:flex-row-reverse gap-3 sm:gap-4 text-left md:text-right">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#FFE600] border-[3px] border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              {record.teamA.logo}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 md:justify-end">
                <span className="text-[10px] font-mono font-black bg-[#7C3AED] text-white px-1.5">
                  SEED #{record.teamA.seed || 1}
                </span>
                {record.winnerTeamId === record.teamA.id && (
                  <span className="text-[10px] font-mono font-black bg-emerald-400 text-black px-1.5">WINNER</span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-black uppercase font-sans truncate">
                {record.teamA.name}
              </h2>
              <p className="font-mono text-xs text-stone-500">Rating: {record.teamA.rating} · Tag: {record.teamA.tag}</p>
            </div>
          </div>

          {/* Scores Decider (3 Cols) */}
          <div className="md:col-span-3 flex flex-col items-center justify-center py-2 md:py-0 border-y-2 md:border-y-0 md:border-x-2 border-stone-200">
            <div className="flex items-center gap-4">
              <span className={`text-4xl sm:text-5xl font-black font-mono ${
                record.winnerTeamId === record.teamA.id ? 'text-black' : 'text-stone-400'
              }`}>
                {record.seriesScoreA}
              </span>
              <span className="text-xl font-mono font-black text-stone-400">:</span>
              <span className={`text-4xl sm:text-5xl font-black font-mono ${
                record.winnerTeamId === record.teamB.id ? 'text-black' : 'text-stone-400'
              }`}>
                {record.seriesScoreB}
              </span>
            </div>

            <span className="font-mono text-[10px] font-black uppercase text-stone-500 mt-1">
              {record.status === 'FINALIZED' ? 'FINAL CANONICAL RESULT' :
               record.status === 'AWAITING_CONFIRMATION' ? 'AWAITING OPPONENT CONFIRMATION' :
               record.status === 'DISPUTED' ? 'DISPUTED · UNDER REVIEW' :
               record.status === 'FORFEIT' ? `FORFEIT VICTORY (${record.forfeitWinnerId})` :
               `${record.seriesFormat} Knocout Series`}
            </span>
          </div>

          {/* Team B */}
          <div className="md:col-span-4 flex items-center gap-3 sm:gap-4 text-left">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-[#5CE1E6] border-[3px] border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-center text-2xl sm:text-3xl shrink-0">
              {record.teamB.logo}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-mono font-black bg-[#7C3AED] text-white px-1.5">
                  SEED #{record.teamB.seed || 2}
                </span>
                {record.winnerTeamId === record.teamB.id && (
                  <span className="text-[10px] font-mono font-black bg-emerald-400 text-black px-1.5">WINNER</span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-black uppercase font-sans truncate">
                {record.teamB.name}
              </h2>
              <p className="font-mono text-xs text-stone-500">Rating: {record.teamB.rating} · Tag: {record.teamB.tag}</p>
            </div>
          </div>
        </div>

        {/* Schedule & Server Details */}
        <div className="pt-4 border-t-2 border-black flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1 text-stone-600">
              <Calendar className="w-3.5 h-3.5 text-black" />
              <span>{record.scheduledDate || '2026-10-15'} · {record.scheduledTime}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-stone-600">
              <Clock className="w-3.5 h-3.5 text-black" />
              <span>Server: {record.serverRegion}</span>
            </span>
            {record.lobbyNotes && (
              <span className="inline-flex items-center gap-1 text-stone-500">
                <span>{record.lobbyNotes}</span>
              </span>
            )}
          </div>

          {/* Organizer Quick Actions */}
          {isOrganiser && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="bg-white border-2 border-black px-2.5 py-1 text-[11px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000] hover:bg-stone-100 cursor-pointer flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                <span>Reschedule</span>
              </button>
              <button
                onClick={() => setIsForfeitModalOpen(true)}
                className="bg-amber-300 border-2 border-black px-2.5 py-1 text-[11px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000] hover:bg-amber-400 cursor-pointer"
              >
                Award Forfeit
              </button>
              <button
                onClick={handleOrderRematchDirect}
                className="bg-red-200 border-2 border-black px-2.5 py-1 text-[11px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000] hover:bg-red-300 cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Order Rematch</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. CHECK-IN SECTION (Requirement 3) */}
      {/* ============================================================ */}
      <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-mono text-sm font-black uppercase text-black">Captain Match Check-In</h3>
          </div>
          <span className="font-mono text-xs font-bold text-stone-500">
            Window: 15m prior to scheduled start
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Team A Status */}
          <div className={`p-4 border-2 border-black ${
            record.teamACheckedIn ? 'bg-emerald-50 border-emerald-950' : 'bg-stone-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-sm uppercase">{record.teamA.name}</span>
              <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase border border-black ${
                record.teamACheckedIn ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-stone-700'
              }`}>
                {record.teamACheckedIn ? 'READY' : 'WAITING'}
              </span>
            </div>
            <p className="font-mono text-xs text-stone-500 mb-3">
              {record.teamACheckedIn
                ? `Checked in at ${new Date(record.teamACheckedInAt || Date.now()).toLocaleTimeString()}`
                : 'Awaiting captain check-in.'}
            </p>

            {(isCaptainA || isOrganiser) && !record.teamACheckedIn && (
              <button
                onClick={() => handleCheckIn(record.teamA.id)}
                className="w-full bg-[#FFE600] border-2 border-black py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-400 cursor-pointer"
              >
                {isOrganiser ? 'Force Check-In (Organizer Override)' : `Check In (${record.teamA.name})`}
              </button>
            )}
          </div>

          {/* Team B Status */}
          <div className={`p-4 border-2 border-black ${
            record.teamBCheckedIn ? 'bg-emerald-50 border-emerald-950' : 'bg-stone-50'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-black text-sm uppercase">{record.teamB.name}</span>
              <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase border border-black ${
                record.teamBCheckedIn ? 'bg-emerald-400 text-black' : 'bg-stone-200 text-stone-700'
              }`}>
                {record.teamBCheckedIn ? 'READY' : 'WAITING'}
              </span>
            </div>
            <p className="font-mono text-xs text-stone-500 mb-3">
              {record.teamBCheckedIn
                ? `Checked in at ${new Date(record.teamBCheckedInAt || Date.now()).toLocaleTimeString()}`
                : 'Awaiting captain check-in.'}
            </p>

            {(isCaptainB || isOrganiser) && !record.teamBCheckedIn && (
              <button
                onClick={() => handleCheckIn(record.teamB.id)}
                className="w-full bg-[#5CE1E6] border-2 border-black py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-cyan-400 cursor-pointer"
              >
                {isOrganiser ? 'Force Check-In (Organizer Override)' : `Check In (${record.teamB.name})`}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2.5 DOTA 2 MATCH LINKING & OPENDOTA GAME STATS (PHASE 6)     */}
      {/* ============================================================ */}
      {(() => {
        const formatStr = (record.seriesFormat || 'BO3').toUpperCase();
        const maxGames = formatStr.includes('1') || formatStr === 'BO1' ? 1 : formatStr.includes('5') || formatStr === 'BO5' ? 5 : 3;
        const gameSlots = Array.from({ length: maxGames }, (_, i) => i + 1);
        const activeGame = record.games?.find(g => g.gameNumber === selectedGameKey);

        const radiantTeamName = activeGame?.radiantTeamId === record.teamA.id ? record.teamA.name : record.teamB.name;
        const direTeamName = activeGame?.direTeamId === record.teamB.id ? record.teamB.name : record.teamA.name;
        const radiantTeamTag = activeGame?.radiantTeamId === record.teamA.id ? record.teamA.tag : record.teamB.tag;
        const direTeamTag = activeGame?.direTeamId === record.teamB.id ? record.teamB.tag : record.teamA.tag;

        const radiantPlayers = activeGame?.openDotaSnapshot?.players?.filter(p => p.isRadiant) || [];
        const direPlayers = activeGame?.openDotaSnapshot?.players?.filter(p => !p.isRadiant) || [];

        const picksBans = activeGame?.openDotaSnapshot?.picksBans || [];
        const radiantPicks = picksBans.filter(pb => pb.isPick && pb.team === 'radiant');
        const direPicks = picksBans.filter(pb => pb.isPick && pb.team === 'dire');
        const radiantBans = picksBans.filter(pb => !pb.isPick && pb.team === 'radiant');
        const direBans = picksBans.filter(pb => !pb.isPick && pb.team === 'dire');

        const getStatusBadge = (status?: string) => {
          switch (status) {
            case 'MATCHED':
              return <span className="bg-emerald-400 text-black px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">✓ MATCHED</span>;
            case 'PARTIAL':
              return <span className="bg-amber-300 text-amber-950 px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">● PARTIAL (ANONYMOUS IDENTITIES)</span>;
            case 'PARTICIPANT_MISMATCH':
              return <span className="bg-[#FF5757] text-white px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000] animate-pulse">⚠ PARTICIPANT MISMATCH</span>;
            case 'UNKNOWN_PARTICIPANTS':
              return <span className="bg-stone-300 text-stone-900 px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">? UNKNOWN PARTICIPANTS</span>;
            case 'RESULT_CONFLICT':
              return <span className="bg-purple-600 text-white px-2 py-0.5 font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] animate-bounce">⚡ RESULT CONFLICT</span>;
            case 'PROVIDER_UNAVAILABLE':
              return <span className="bg-stone-200 text-stone-800 px-2 py-0.5 font-mono text-xs font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">PROVIDER UNAVAILABLE</span>;
            default:
              return <span className="bg-stone-100 text-stone-600 px-2 py-0.5 font-mono text-xs font-bold uppercase border border-stone-300">PENDING LINK</span>;
          }
        };

        return (
          <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black pb-4 gap-2">
              <div className="flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="font-mono text-base font-black uppercase text-black">
                  Valve Match ID Linking & OpenDota Stats
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-stone-500">
                Supporting Evidence Engine · Series: {record.seriesFormat}
              </span>
            </div>

            {/* Series Game Slots Selector */}
            <div className="flex flex-wrap items-center gap-2 border-b-2 border-stone-200 pb-3">
              <span className="font-mono text-xs font-black uppercase text-stone-500 mr-2">Select Game:</span>
              {gameSlots.map(slotNum => {
                const gData = record.games?.find(g => g.gameNumber === slotNum);
                const isSelected = selectedGameKey === slotNum;
                return (
                  <button
                    key={slotNum}
                    onClick={() => setSelectedGameKey(slotNum)}
                    className={`px-3 py-1.5 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-[#FFE600] shadow-[3px_3px_0px_0px_#000] text-black -translate-y-0.5'
                        : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                    }`}
                  >
                    <span>Game {slotNum}</span>
                    {gData?.dotaMatchId ? (
                      <span className={`text-[10px] px-1 py-0.2 border border-black ${
                        gData.reconciliationStatus === 'MATCHED' ? 'bg-emerald-400 text-black' :
                        gData.reconciliationStatus === 'PARTICIPANT_MISMATCH' ? 'bg-red-500 text-white' :
                        gData.reconciliationStatus === 'RESULT_CONFLICT' ? 'bg-purple-600 text-white' :
                        'bg-amber-300 text-black'
                      }`}>
                        {gData.reconciliationStatus}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-normal">Unlinked</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current Game Details or Link Form */}
            {activeGame && activeGame.dotaMatchId ? (
              <div className="space-y-6">
                {/* Active Game Metadata Card */}
                <div className="bg-stone-50 border-2 border-black p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black bg-black text-white px-2 py-0.5">
                        GAME {activeGame.gameNumber}
                      </span>
                      <span className="font-mono text-sm font-black text-black">
                        Valve Match ID: <span className="text-[#7C3AED] select-all font-mono">{activeGame.dotaMatchId}</span>
                      </span>
                      {getStatusBadge(activeGame.reconciliationStatus)}
                    </div>
                    <p className="font-mono text-xs text-stone-600">
                      Duration: <strong>{Math.floor(activeGame.durationSeconds / 60)}m {activeGame.durationSeconds % 60}s</strong> · 
                      Score: <strong className="text-emerald-700">{activeGame.radiantKills}</strong> - <strong className="text-red-700">{activeGame.direKills}</strong> · 
                      Winner: <strong>{activeGame.winnerTeamId === record.teamA.id ? record.teamA.name : record.teamB.name}</strong> · 
                      Snapshot status: <span className="font-bold">{activeGame.openDotaSnapshot?.status || 'CACHED'}</span>
                    </p>
                    {activeGame.reconciliationNotes && (
                      <p className="font-mono text-xs text-stone-500 italic">
                        {activeGame.reconciliationNotes}
                      </p>
                    )}
                  </div>

                  {/* Actions: Refresh */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefreshOpenDota}
                      disabled={isRefreshingMatch}
                      className="bg-white hover:bg-stone-100 border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingMatch ? 'animate-spin' : ''}`} />
                      <span>{isRefreshingMatch ? 'Refreshing...' : 'Refresh OpenDota'}</span>
                    </button>
                  </div>
                </div>

                {/* Review Flags Panel (Requirement 4 & 5) */}
                {activeGame.reviewFlags && activeGame.reviewFlags.length > 0 && (
                  <div className="bg-red-50 border-2 border-red-900 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-mono text-xs font-black uppercase text-red-950">
                          Reconciliation Review Flags ({activeGame.reviewFlags.length} active)
                        </h4>
                        <p className="font-mono text-xs text-red-800">
                          Notice: These are non-destructive review flags for organizer/referee inspection. 
                          OpenDota is supporting evidence only and does NOT automatically overwrite canonical tournament results.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {activeGame.reviewFlags.map(flag => (
                        <div key={flag.id} className="bg-white border border-red-300 p-3 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="bg-red-600 text-white font-black px-1.5 py-0.5 text-[10px] uppercase">
                                {flag.type}
                              </span>
                              <span className="font-bold text-stone-800">Severity: {flag.severity}</span>
                              <span className="text-[10px] text-stone-500">Status: {flag.status}</span>
                            </div>
                            <p className="text-stone-700">{flag.message}</p>
                          </div>

                          {isOrganiser && flag.status === 'OPEN' && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleReviewFlagSubmit(flag.id, 'ACKNOWLEDGE')}
                                className="bg-amber-300 hover:bg-yellow-400 border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer"
                              >
                                Acknowledge
                              </button>
                              <button
                                onClick={() => handleReviewFlagSubmit(flag.id, 'RESOLVE')}
                                className="bg-emerald-400 hover:bg-emerald-500 border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer"
                              >
                                Resolve
                              </button>
                              <button
                                onClick={() => handleReviewFlagSubmit(flag.id, 'DISMISS')}
                                className="bg-stone-200 hover:bg-stone-300 border border-black px-2 py-1 text-[10px] font-black uppercase cursor-pointer"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Picks & Bans / Draft Section (Requirement 8) */}
                {picksBans.length > 0 && (
                  <div className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
                    <h4 className="font-black uppercase flex items-center gap-2">
                      <span>Draft / Picks & Bans</span>
                      <span className="text-stone-400 font-normal text-[11px]">(Hero Select Sequence)</span>
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Radiant Draft */}
                      <div className="bg-white p-3 border border-stone-300 space-y-2">
                        <span className="font-black text-emerald-800 uppercase block">Radiant ({radiantTeamTag})</span>
                        <div>
                          <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Picks:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {radiantPicks.map((pb, idx) => (
                              <span key={idx} className="bg-emerald-50 border border-emerald-300 px-2 py-0.5 text-xs font-bold text-emerald-950">
                                {pb.heroName}
                              </span>
                            ))}
                          </div>
                        </div>
                        {radiantBans.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Bans:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {radiantBans.map((pb, idx) => (
                                <span key={idx} className="bg-stone-100 border border-stone-300 line-through px-1.5 py-0.5 text-[11px] text-stone-600">
                                  {pb.heroName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Dire Draft */}
                      <div className="bg-white p-3 border border-stone-300 space-y-2">
                        <span className="font-black text-red-800 uppercase block">Dire ({direTeamTag})</span>
                        <div>
                          <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Picks:</span>
                          <div className="flex flex-wrap gap-1.5">
                            {direPicks.map((pb, idx) => (
                              <span key={idx} className="bg-red-50 border border-red-300 px-2 py-0.5 text-xs font-bold text-red-950">
                                {pb.heroName}
                              </span>
                            ))}
                          </div>
                        </div>
                        {direBans.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-stone-500 uppercase block mb-1">Bans:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {direBans.map((pb, idx) => (
                                <span key={idx} className="bg-stone-100 border border-stone-300 line-through px-1.5 py-0.5 text-[11px] text-stone-600">
                                  {pb.heroName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Player Game Statistics Table (Requirement 7 & 9) */}
                <div className="space-y-4">
                  {/* Radiant Team Stats */}
                  <div className="border-2 border-black overflow-hidden shadow-[3px_3px_0px_0px_#000]">
                    <div className="bg-emerald-500 text-black px-4 py-2 flex items-center justify-between font-mono text-xs font-black uppercase">
                      <span>Radiant · {radiantTeamName} ({radiantTeamTag})</span>
                      <span>{activeGame.radiantKills} Kills</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-stone-100 border-b border-black text-stone-600 uppercase text-[10px] font-black">
                          <tr>
                            <th className="p-2.5">Hero</th>
                            <th className="p-2.5">Player (IGN)</th>
                            <th className="p-2.5 text-center">K / D / A</th>
                            <th className="p-2.5 text-right">GPM</th>
                            <th className="p-2.5 text-right">XPM</th>
                            <th className="p-2.5 text-right">Last Hits</th>
                            <th className="p-2.5 text-right">Net Worth</th>
                            <th className="p-2.5 text-right">Hero Dmg</th>
                            <th className="p-2.5 text-right">Tower Dmg</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 bg-white">
                          {radiantPlayers.map((p, idx) => (
                            <tr key={idx} className="hover:bg-emerald-50/40">
                              <td className="p-2.5 font-bold text-black flex items-center gap-1.5">
                                <span>{p.heroName}</span>
                              </td>
                              <td className="p-2.5">
                                <button
                                  onClick={() => onNavigate('player_profile', p.personaName || p.accountId || 'player-contender')}
                                  className="font-black text-black hover:text-[#7C3AED] hover:underline cursor-pointer inline-flex items-center gap-1"
                                >
                                  <span>{p.personaName || (p.accountId ? `Player_${p.accountId.slice(-4)}` : 'Anonymous')}</span>
                                  <ExternalLink className="w-3 h-3 text-stone-400" />
                                </button>
                              </td>
                              <td className="p-2.5 text-center font-bold text-stone-900">
                                {p.kills} / {p.deaths} / {p.assists}
                              </td>
                              <td className="p-2.5 text-right font-mono">{p.gpm}</td>
                              <td className="p-2.5 text-right font-mono">{p.xpm}</td>
                              <td className="p-2.5 text-right font-mono">{p.lastHits}</td>
                              <td className="p-2.5 text-right font-bold text-amber-600">
                                {p.netWorth ? `${Math.round(p.netWorth / 100) / 10}k` : '—'}
                              </td>
                              <td className="p-2.5 text-right font-mono">{p.heroDamage.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-mono">{p.towerDamage.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Dire Team Stats */}
                  <div className="border-2 border-black overflow-hidden shadow-[3px_3px_0px_0px_#000]">
                    <div className="bg-red-500 text-white px-4 py-2 flex items-center justify-between font-mono text-xs font-black uppercase">
                      <span>Dire · {direTeamName} ({direTeamTag})</span>
                      <span>{activeGame.direKills} Kills</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-xs">
                        <thead className="bg-stone-100 border-b border-black text-stone-600 uppercase text-[10px] font-black">
                          <tr>
                            <th className="p-2.5">Hero</th>
                            <th className="p-2.5">Player (IGN)</th>
                            <th className="p-2.5 text-center">K / D / A</th>
                            <th className="p-2.5 text-right">GPM</th>
                            <th className="p-2.5 text-right">XPM</th>
                            <th className="p-2.5 text-right">Last Hits</th>
                            <th className="p-2.5 text-right">Net Worth</th>
                            <th className="p-2.5 text-right">Hero Dmg</th>
                            <th className="p-2.5 text-right">Tower Dmg</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200 bg-white">
                          {direPlayers.map((p, idx) => (
                            <tr key={idx} className="hover:bg-red-50/40">
                              <td className="p-2.5 font-bold text-black flex items-center gap-1.5">
                                <span>{p.heroName}</span>
                              </td>
                              <td className="p-2.5">
                                <button
                                  onClick={() => onNavigate('player_profile', p.personaName || p.accountId || 'player-contender')}
                                  className="font-black text-black hover:text-[#7C3AED] hover:underline cursor-pointer inline-flex items-center gap-1"
                                >
                                  <span>{p.personaName || (p.accountId ? `Player_${p.accountId.slice(-4)}` : 'Anonymous')}</span>
                                  <ExternalLink className="w-3 h-3 text-stone-400" />
                                </button>
                              </td>
                              <td className="p-2.5 text-center font-bold text-stone-900">
                                {p.kills} / {p.deaths} / {p.assists}
                              </td>
                              <td className="p-2.5 text-right font-mono">{p.gpm}</td>
                              <td className="p-2.5 text-right font-mono">{p.xpm}</td>
                              <td className="p-2.5 text-right font-mono">{p.lastHits}</td>
                              <td className="p-2.5 text-right font-bold text-amber-600">
                                {p.netWorth ? `${Math.round(p.netWorth / 100) / 10}k` : '—'}
                              </td>
                              <td className="p-2.5 text-right font-mono">{p.heroDamage.toLocaleString()}</td>
                              <td className="p-2.5 text-right font-mono">{p.towerDamage.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Unlinked State & Attach Form */
              <div className="bg-stone-50 border-2 border-black p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-[#7C3AED] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-mono text-sm font-black uppercase text-black">
                      No Dota 2 Match ID Linked to Game {selectedGameKey}
                    </h4>
                    <p className="font-mono text-xs text-stone-600 mt-1">
                      Authorized captains, referees, or tournament organizers can link a Valve Dota 2 Match ID. 
                      Once linked, OpenDota data will be retrieved and reconciled against the locked tournament roster.
                    </p>
                  </div>
                </div>

                {(isOrganiser || isCaptainA || isCaptainB) ? (
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <input
                      type="text"
                      placeholder="e.g. 79841201"
                      value={linkMatchIdInput}
                      onChange={(e) => setLinkMatchIdInput(e.target.value)}
                      className="border-2 border-black p-2 font-mono text-xs font-bold w-full sm:w-64 bg-white"
                    />
                    <button
                      onClick={handleLinkMatchIdSubmit}
                      disabled={isLinkingMatch}
                      className="bg-[#FFE600] hover:bg-yellow-400 border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Link2 className="w-4 h-4" />
                      <span>{isLinkingMatch ? 'Linking...' : `Attach Match ID to Game ${selectedGameKey}`}</span>
                    </button>
                  </div>
                ) : (
                  <p className="font-mono text-xs text-stone-500 italic pt-1">
                    Viewing as spectator. Only authorized captains, referees, or tournament organizers can attach Match IDs.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* 3. CAPTAIN OPERATIONS: RESULT SUBMISSION & CONFIRMATION */}
      {/* ============================================================ */}
      <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-mono text-sm font-black uppercase text-black">Match Operations & Results</h3>
          </div>
          <span className="font-mono text-xs font-bold text-stone-500">
            Series Format: {record.seriesFormat}
          </span>
        </div>

        {/* State Alerts & Action Buttons */}
        {record.status === 'AWAITING_CONFIRMATION' && (
          <div className="bg-[#FFE600] border-2 border-black p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-black shrink-0 mt-0.5" />
              <div>
                <h4 className="font-mono text-xs font-black uppercase">Result Submitted · Awaiting Confirmation</h4>
                <p className="font-mono text-xs text-stone-800">
                  Team {record.submittedByTeamId} submitted score: {record.seriesScoreA} - {record.seriesScoreB}.
                  The opponent captain must confirm or dispute within the confirmation window.
                </p>
              </div>
            </div>

            {/* Confirmation actions */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {/* Opponent Captain or Organizer Can Confirm */}
              {((isCaptainA && record.submittedByTeamId === record.teamB.id) ||
                (isCaptainB && record.submittedByTeamId === record.teamA.id) ||
                isOrganiser) && (
                <>
                  <button
                    onClick={handleConfirmResult}
                    className="bg-emerald-500 text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>CONFIRM RESULT</span>
                  </button>

                  <button
                    onClick={() => setIsDisputeModalOpen(true)}
                    className="bg-[#FF5757] text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-red-600 cursor-pointer flex items-center gap-1.5"
                  >
                    <Flag className="w-4 h-4" />
                    <span>DISPUTE RESULT</span>
                  </button>
                </>
              )}

              {/* Submitting captain view */}
              {((isCaptainA && record.submittedByTeamId === record.teamA.id) ||
                (isCaptainB && record.submittedByTeamId === record.teamB.id)) && !isOrganiser && (
                <span className="font-mono text-xs font-bold text-stone-700 italic">
                  Waiting for opponent captain confirmation...
                </span>
              )}
            </div>
          </div>
        )}

        {/* Dispute active banner */}
        {record.status === 'DISPUTED' && (
          <div className="bg-red-100 border-2 border-red-950 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-mono text-xs font-black uppercase text-red-950">Match Disputed · Bracket Frozen</h4>
                <p className="font-mono text-xs text-red-900">
                  A dispute is actively open for this match. Progression into downstream matches is strictly halted until resolved.
                </p>
              </div>
            </div>

            {record.disputes && record.disputes.length > 0 && (
              <div className="bg-white p-3 border border-red-300 font-mono text-xs space-y-1">
                <p className="font-bold">Status: Dispute Under Active Referee Investigation</p>
                {(isCaptainA || isCaptainB || isOrganiser) ? (
                  <>
                    <p className="text-stone-600">Filed by: {record.disputes[record.disputes.length - 1].disputedByCaptainIgn}</p>
                    <p className="text-stone-600">Reason: {record.disputes[record.disputes.length - 1].disputeReason}</p>
                    <p className="text-stone-800 italic">&quot;{record.disputes[record.disputes.length - 1].disputeNotes}&quot;</p>
                  </>
                ) : (
                  <p className="text-stone-600 italic">Dispute notes and evidence are confidential to participating captains and tournament referees.</p>
                )}
              </div>
            )}

            {isOrganiser && (
              <button
                onClick={() => {
                  setSelectedDisputeId(record.disputes[record.disputes.length - 1]?.id || '');
                  setIsResolveModalOpen(true);
                }}
                className="bg-black text-white px-4 py-2 font-mono text-xs font-black uppercase border border-black hover:bg-stone-800 cursor-pointer"
              >
                Resolve Dispute as Organizer
              </button>
            )}
          </div>
        )}

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {(isCaptainA || isCaptainB || isOrganiser) && record.status !== 'FINALIZED' && record.status !== 'FORFEIT' && (
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="bg-[#7C3AED] text-white border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:bg-purple-700 cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Submit Series Score</span>
            </button>
          )}

          {isFinalized && (
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 border border-emerald-500">
              <Check className="w-4 h-4" />
              <span>Canonical result finalized and progressed into competition structure.</span>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. AUDIT HISTORY & LIFECYCLE (Requirement 1 & 9) */}
      {/* ============================================================ */}
      <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-mono text-sm font-black uppercase text-black">Authoritative Audit Trail</h3>
          </div>
          <span className="font-mono text-xs text-stone-500">
            {record.auditHistory?.length || 0} events recorded
          </span>
        </div>

        {(!record.auditHistory || record.auditHistory.length === 0) ? (
          <p className="font-mono text-xs text-stone-500 italic">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {record.auditHistory.slice().reverse().map((audit, idx) => (
              <div key={idx} className="p-2.5 bg-stone-50 border border-stone-200 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div>
                  <span className="font-black text-black uppercase bg-[#FFE600] px-1.5 py-0.5 border border-black mr-2 text-[10px]">
                    {audit.action}
                  </span>
                  <span className="text-stone-700">{audit.note}</span>
                </div>
                <span className="text-[10px] text-stone-400 shrink-0">
                  {new Date(audit.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* SUBMIT SCORE MODAL */}
      {/* ============================================================ */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-md w-full space-y-4">
            <h3 className="font-mono text-base font-black uppercase">Submit Series Score</h3>
            <p className="font-mono text-xs text-stone-600">
              Format: <strong>{record.seriesFormat}</strong>. Valid scores are validated according to competitive rules.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs font-bold block mb-1">{record.teamA.name}</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={scoreAInput}
                  onChange={(e) => setScoreAInput(parseInt(e.target.value) || 0)}
                  className="w-full border-2 border-black p-2 font-mono text-lg font-black"
                />
              </div>

              <div>
                <label className="font-mono text-xs font-bold block mb-1">{record.teamB.name}</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={scoreBInput}
                  onChange={(e) => setScoreBInput(parseInt(e.target.value) || 0)}
                  className="w-full border-2 border-black p-2 font-mono text-lg font-black"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-3 py-1.5 border border-black font-mono text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScore}
                className="bg-[#FFE600] border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Submit Score
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* DISPUTE MODAL */}
      {/* ============================================================ */}
      {isDisputeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-md w-full space-y-4">
            <h3 className="font-mono text-base font-black uppercase text-red-600">Open Match Dispute</h3>
            <p className="font-mono text-xs text-stone-600">
              Provide justification. Bracket progression will freeze until tournament organizer resolves this dispute.
            </p>

            <div className="space-y-3">
              <div>
                <SelectDropdown
                  label="Reason"
                  value={disputeReason}
                  onChange={(val) => setDisputeReason(val)}
                  options={[
                    { value: 'INCORRECT_SCORE', label: 'Incorrect Score' },
                    { value: 'WRONG_MATCH', label: 'Wrong Match' },
                    { value: 'WRONG_PLAYERS', label: 'Wrong Players / Ringers' },
                    { value: 'TECHNICAL_ISSUE', label: 'Technical Issue / Server Disconnect' },
                    { value: 'RULE_VIOLATION', label: 'Rule Violation' },
                    { value: 'NO_SHOW', label: 'No Show' },
                    { value: 'OTHER', label: 'Other' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-mono text-xs font-bold block mb-1">Evidence & Notes</label>
                <textarea
                  rows={3}
                  value={disputeNotes}
                  onChange={(e) => setDisputeNotes(e.target.value)}
                  placeholder="Detail what occurred..."
                  className="w-full border-2 border-black p-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsDisputeModalOpen(false)}
                className="px-3 py-1.5 border border-black font-mono text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenDispute}
                className="bg-red-500 text-white border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Submit Dispute
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* RESOLVE DISPUTE MODAL (Organizer Only) */}
      {/* ============================================================ */}
      {isResolveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-md w-full space-y-4">
            <h3 className="font-mono text-base font-black uppercase">Resolve Match Dispute</h3>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <SelectDropdown
                  label="Resolution Action"
                  value={resolveAction}
                  onChange={(val: any) => setResolveAction(val)}
                  options={[
                    { value: 'CONFIRM_ORIGINAL', label: 'Confirm Original Result' },
                    { value: 'CORRECT_RESULT', label: 'Correct Result' },
                    { value: 'ORDER_REMATCH', label: 'Order Rematch' },
                    { value: 'AWARD_FORFEIT', label: 'Award Forfeit' }
                  ]}
                  className="w-full"
                />
              </div>

              {resolveAction === 'CORRECT_RESULT' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1">{record.teamA.name} Score</label>
                    <input
                      type="number"
                      value={resolveCorrectedScoreA}
                      onChange={(e) => setResolveCorrectedScoreA(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-black p-1.5 font-bold"
                    />
                  </div>
                  <div>
                    <label className="block mb-1">{record.teamB.name} Score</label>
                    <input
                      type="number"
                      value={resolveCorrectedScoreB}
                      onChange={(e) => setResolveCorrectedScoreB(parseInt(e.target.value) || 0)}
                      className="w-full border-2 border-black p-1.5 font-bold"
                    />
                  </div>
                </div>
              )}

              {resolveAction === 'AWARD_FORFEIT' && (
                <div>
                  <SelectDropdown
                    label="Award Forfeit Victory To"
                    value={resolveForfeitTeamId}
                    onChange={(val) => setResolveForfeitTeamId(val)}
                    options={[
                      { value: '', label: 'Select Team...' },
                      { value: record.teamA.id, label: record.teamA.name },
                      { value: record.teamB.id, label: record.teamB.name }
                    ]}
                    className="w-full"
                  />
                </div>
              )}

              <div>
                <label className="font-bold block mb-1">Resolution Reason / Summary</label>
                <textarea
                  rows={2}
                  value={resolveSummary}
                  onChange={(e) => setResolveSummary(e.target.value)}
                  placeholder="Required justification summary..."
                  className="w-full border-2 border-black p-2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-3 py-1.5 border border-black font-mono text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveDispute}
                className="bg-black text-white border-2 border-black px-4 py-1.5 font-mono text-xs font-black uppercase cursor-pointer"
              >
                Execute Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* SCHEDULE MODAL */}
      {/* ============================================================ */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-md w-full space-y-4 font-mono text-xs">
            <h3 className="text-base font-black uppercase">Schedule Match</h3>

            <div className="space-y-3">
              <div>
                <label className="font-bold block mb-1">Date</label>
                <input
                  type="date"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                  className="w-full border-2 border-black p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Time</label>
                <input
                  type="text"
                  value={schedTime}
                  onChange={(e) => setSchedTime(e.target.value)}
                  className="w-full border-2 border-black p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Server / Region</label>
                <input
                  type="text"
                  value={schedRegion}
                  onChange={(e) => setSchedRegion(e.target.value)}
                  className="w-full border-2 border-black p-2 font-bold"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Lobby Notes / Hint</label>
                <input
                  type="text"
                  value={schedNotes}
                  onChange={(e) => setSchedNotes(e.target.value)}
                  className="w-full border-2 border-black p-2 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-3 py-1.5 border border-black font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleSubmit}
                className="bg-[#FFE600] border-2 border-black px-4 py-1.5 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* FORFEIT MODAL */}
      {/* ============================================================ */}
      {isForfeitModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-md w-full space-y-4 font-mono text-xs">
            <h3 className="text-base font-black uppercase text-amber-900">Award Forfeit Victory</h3>
            <p className="text-stone-600">
              Advances the winner in the tournament structure without applying competitive rating adjustments.
            </p>

            <div className="space-y-3">
              <div>
                <SelectDropdown
                  label="Winning Team"
                  value={forfeitWinnerTeamId}
                  onChange={(val) => setForfeitWinnerTeamId(val)}
                  options={[
                    { value: '', label: 'Select Winning Team...' },
                    { value: record.teamA.id, label: record.teamA.name },
                    { value: record.teamB.id, label: record.teamB.name }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Forfeit Reason</label>
                <input
                  type="text"
                  value={forfeitReasonInput}
                  onChange={(e) => setForfeitReasonInput(e.target.value)}
                  className="w-full border-2 border-black p-2 font-bold"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsForfeitModalOpen(false)}
                className="px-3 py-1.5 border border-black font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleForfeitSubmit}
                className="bg-amber-400 border-2 border-black px-4 py-1.5 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Confirm Forfeit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
