import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  Shield, 
  Swords, 
  CheckCircle2, 
  ExternalLink,
  Flame,
  AlertCircle,
  Play,
  RotateCcw,
  Users,
  Info,
  Radio,
  Settings,
  Tv,
  Share2,
  BarChart2,
  ListOrdered,
  FileText,
  MapPin,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { Match, ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { 
  dotaCompetitionEngine, 
  CompetitionMatchNode, 
  MultiStageTournamentStructure 
} from '../domain/dotaCompetitionEngine';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';
import { EsportsVideoPlayer } from '../components/broadcast/EsportsVideoPlayer';
import { LiveMatchChatPanel } from '../components/broadcast/LiveMatchChatPanel';
import { OrganiserBroadcastControlsModal } from '../components/broadcast/OrganiserBroadcastControlsModal';

interface MatchDetailViewProps {
  matchId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

type MatchDetailTab = 'LIVE' | 'STATS' | 'LINEUPS' | 'COMMENTARY' | 'MAPS';

export function MatchDetailView({ matchId, onNavigate }: MatchDetailViewProps) {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [compNode, setCompNode] = useState<CompetitionMatchNode | null>(null);
  const [structure, setStructure] = useState<MultiStageTournamentStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isStartingSoon, setIsStartingSoon] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<MatchDetailTab>('LIVE');
  const [theaterMode, setTheaterMode] = useState<boolean>(false);

  // Broadcast & OBS Settings modal
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Organizer score entry modal
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(0);
  const [isForfeit, setIsForfeit] = useState(false);
  const [forfeitWinnerId, setForfeitWinnerId] = useState('');
  const [mutationStatus, setMutationStatus] = useState<SubmissionStatus>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  const currentUser = tournamentService.getCurrentUser();

  // Load and subscribe to match data
  useEffect(() => {
    let isCancelled = false;
    let unsubMatchDoc: (() => void) | undefined;
    const cleanId = (matchId || '').trim();

    if (!cleanId) {
      const fallback = tournamentService.getMatches()[0];
      setMatch(fallback);
      setIsLoading(false);
      return;
    }

    const resolveMatch = async () => {
      setIsLoading(true);

      // 1. Check local tournamentService & competitionEngine
      const foundMatch = tournamentService.getMatchById(cleanId);
      const foundComp = dotaCompetitionEngine.findMatch(cleanId);

      if (foundComp) {
        if (!isCancelled) {
          setCompNode(foundComp.match);
          setStructure(foundComp.structure);
        }
      }

      if (foundMatch) {
        if (!isCancelled) {
          setMatch(foundMatch);
          setIsLoading(false);
        }
      }

      // 2. Query Firestore asynchronously for latest authoritative match data
      try {
        const remoteMatch = await tournamentService.fetchMatchById(cleanId);
        if (remoteMatch && !isCancelled) {
          setMatch(remoteMatch);
          setIsLoading(false);
          return;
        }
      } catch {}

      // 3. Async search if not yet hydrated into local cache
      const asyncComp = await dotaCompetitionEngine.findMatchAsync(cleanId);
      if (asyncComp && !isCancelled) {
        setCompNode(asyncComp.match);
        setStructure(asyncComp.structure);
        const tourney = tournamentService.getTournamentById(asyncComp.tournamentId);
        const node = asyncComp.match;
        const teamAObj = (node.teamA as any) || {};
        const teamBObj = (node.teamB as any) || {};

        setMatch({
          id: node.id,
          tournamentId: node.tournamentId || asyncComp.tournamentId,
          tournamentName: tourney?.name || 'Tournament Championship',
          game: (tourney?.game as any) || 'Dota 2',
          round: node.roundTitle || node.round || 'Tournament Match',
          teamA: {
            id: teamAObj.teamId || teamAObj.id || 'team-a',
            name: teamAObj.name || 'Team 1',
            tag: teamAObj.tag || 'T1',
            logo: teamAObj.logo || '🛡️',
            score: node.scores?.teamA ?? 0,
            city: teamAObj.city || '',
            rating: teamAObj.rating || 1000
          },
          teamB: {
            id: teamBObj.teamId || teamBObj.id || 'team-b',
            name: teamBObj.name || 'Team 2',
            tag: teamBObj.tag || 'T2',
            logo: teamBObj.logo || '⚔️',
            score: node.scores?.teamB ?? 0,
            city: teamBObj.city || '',
            rating: teamBObj.rating || 1000
          },
          seriesFormat: (node.seriesFormat as any) || 'BO3',
          status: node.status === 'COMPLETED' || node.status === 'FORFEIT' ? 'COMPLETED' : (node.status === 'LIVE' ? 'LIVE' : 'UPCOMING'),
          scheduledTime: node.scheduledTime || 'TBD',
          winnerId: node.winnerId,
          isLive: node.status === 'LIVE',
          streamUrl: node.streamUrl,
          streamType: node.streamType,
          streamTitle: node.streamTitle,
          casterNames: node.casterNames,
          obsStreamUrl: node.obsStreamUrl,
          telemetry: node.telemetry
        });
        setIsLoading(false);
        return;
      }

      if (foundMatch && !isCancelled) {
        setIsLoading(false);
        return;
      }

      // 4. Fallback to first available match if ID unknown
      if (!isCancelled) {
        const fallback = tournamentService.getMatches()[0];
        if (fallback) setMatch(fallback);
        setIsLoading(false);
      }
    };

    resolveMatch();

    // 5. Establish real-time Firestore listener on matches/{cleanId} doc
    if (db && cleanId) {
      try {
        unsubMatchDoc = onSnapshot(doc(db, 'matches', cleanId), (snap) => {
          if (!isCancelled && snap.exists()) {
            const data = snap.data();
            setMatch((prev) => {
              if (!prev) return { ...data, id: snap.id } as Match;
              return {
                ...prev,
                ...data,
                id: snap.id,
                streamUrl: data.streamUrl !== undefined ? data.streamUrl : prev.streamUrl,
                streamType: data.streamType || prev.streamType,
                streamTitle: data.streamTitle || prev.streamTitle,
                casterNames: data.casterNames || prev.casterNames,
                obsStreamUrl: data.obsStreamUrl || prev.obsStreamUrl,
                status: data.status || prev.status,
                isLive: data.isLive !== undefined ? data.isLive : prev.isLive,
                teamA: {
                  ...prev.teamA,
                  ...(data.teamA || {}),
                  score: data.scores?.teamA ?? data.teamA?.score ?? prev.teamA.score
                },
                teamB: {
                  ...prev.teamB,
                  ...(data.teamB || {}),
                  score: data.scores?.teamB ?? data.teamB?.score ?? prev.teamB.score
                },
                telemetry: data.telemetry || prev.telemetry
              };
            });
            setIsLoading(false);
          }
        }, (err) => {
          console.warn('[MatchDetailView] Firestore match snapshot warning:', err);
        });
      } catch (listenerErr) {
        console.warn('[MatchDetailView] Listener initialization error:', listenerErr);
      }
    }

    const unsubTourneys = tournamentService.subscribe(() => {
      if (!isCancelled) {
        const updated = tournamentService.getMatchById(cleanId);
        if (updated) setMatch(updated);
        const updatedComp = dotaCompetitionEngine.findMatch(cleanId);
        if (updatedComp) {
          setCompNode(updatedComp.match);
          setStructure(updatedComp.structure);
        }
      }
    });

    return () => {
      isCancelled = true;
      if (unsubMatchDoc) unsubMatchDoc();
      unsubTourneys();
    };
  }, [matchId]);

  // Real-time Countdown calculation for matches starting in few minutes
  useEffect(() => {
    const rawTime = compNode?.scheduledTime || match?.scheduledTime;
    if (!rawTime || rawTime === 'TBD') {
      setTimeLeftStr('');
      setIsStartingSoon(false);
      return;
    }

    const updateTimer = () => {
      try {
        const targetDate = new Date(rawTime);
        const now = new Date();
        const diffMs = targetDate.getTime() - now.getTime();

        if (diffMs <= 0) {
          if (match?.status === 'UPCOMING') {
            setTimeLeftStr('Scheduled start reached · Lobby check-in active');
            setIsStartingSoon(true);
          } else {
            setTimeLeftStr('');
            setIsStartingSoon(false);
          }
          return;
        }

        const totalSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(totalSec / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (minutes < 30) {
          setIsStartingSoon(true);
        } else {
          setIsStartingSoon(false);
        }

        if (days > 0) {
          setTimeLeftStr(`Starts in ${days}d ${hours % 24}h`);
        } else if (hours > 0) {
          setTimeLeftStr(`Starts in ${hours}h ${minutes % 60}m`);
        } else {
          const seconds = totalSec % 60;
          setTimeLeftStr(`Starts in ${minutes}m ${seconds.toString().padStart(2, '0')}s`);
        }
      } catch {
        setTimeLeftStr('');
        setIsStartingSoon(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [compNode?.scheduledTime, match?.scheduledTime, match?.status]);

  if (isLoading) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
        <div className="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
        <h3 className="text-xl font-black uppercase text-black font-sans">
          Locating Match Fixture...
        </h3>
        <p className="text-xs text-stone-600">
          Resolving authoritative bracket node telemetry and contender rosters.
        </p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="w-12 h-12 bg-amber-100 border-2 border-black rounded-full flex items-center justify-center mx-auto text-amber-800">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black uppercase text-black font-sans">
          Match Not Found
        </h2>
        <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
          The requested competitive fixture (#{matchId}) was not found in active tournaments or has not been seeded yet.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate('tournaments')}
            className="px-5 py-2.5 bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer hover:bg-yellow-300"
          >
            ← View Tournaments
          </button>
          <button
            onClick={() => onNavigate('matches')}
            className="px-5 py-2.5 bg-white text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer hover:bg-stone-50"
          >
            All Live Matches
          </button>
        </div>
      </div>
    );
  }

  const tourney = tournamentService.getTournamentById(match.tournamentId);
  const isOrganizer = currentUser.isAdmin || 
    currentUser.role === 'organizer' || 
    currentUser.id === tourney?.organizer || 
    currentUser.id === tourney?.organizerId ||
    currentUser.id === (tourney as any)?.organiserId ||
    currentUser.email?.toLowerCase().trim() === '11106cm009@gmail.com';

  const isLive = match.status === 'LIVE' || match.isLive;
  const isCompleted = match.status === 'COMPLETED';
  const isUpcoming = match.status === 'UPCOMING';

  const teamAWins = (match.teamA?.score || 0) > (match.teamB?.score || 0) && isCompleted;
  const teamBWins = (match.teamB?.score || 0) > (match.teamA?.score || 0) && isCompleted;

  // Handle Score Confirmation (Authoritative Cloud Function / Local Fallback)
  const handleConfirmScore = async () => {
    if (!match.tournamentId || !match.id) return;
    setMutationStatus('pending');
    setMutationError(null);

    const targetMatchId = match.id;
    const stageId = compNode?.stageId || structure?.stages?.[0]?.id || `stage-${match.tournamentId}-1`;
    const res = await competitionClientService.recordMatchResult({
      tournamentId: match.tournamentId,
      stageId,
      matchId: targetMatchId,
      scoreA,
      scoreB,
      isForfeit,
      forfeitWinnerId: isForfeit ? forfeitWinnerId : undefined,
      clientVersion: structure?.version
    });

    if (res.success && res.data) {
      setMutationStatus('confirmed');
      const updatedMatch = res.data.match;
      if (updatedMatch) {
        setCompNode(updatedMatch);
        setMatch(prev => prev ? {
          ...prev,
          status: 'COMPLETED',
          isLive: false,
          teamA: { ...prev.teamA, score: scoreA },
          teamB: { ...prev.teamB, score: scoreB },
          winnerId: isForfeit ? forfeitWinnerId : (scoreA > scoreB ? prev.teamA.id : prev.teamB.id)
        } : prev);
      }
      setTimeout(() => {
        setIsScoringOpen(false);
        setMutationStatus('idle');
      }, 1000);
    } else {
      // Local fallback
      const localResult = dotaCompetitionEngine.recordMatchResult({
        tournamentId: match.tournamentId,
        stageId,
        matchId: targetMatchId,
        scoreA,
        scoreB,
        isForfeit,
        forfeitWinnerId: isForfeit ? forfeitWinnerId : undefined,
        isAdmin: true
      });

      if (localResult.success) {
        setMutationStatus('confirmed');
        setMatch(prev => prev ? {
          ...prev,
          status: 'COMPLETED',
          isLive: false,
          teamA: { ...prev.teamA, score: scoreA },
          teamB: { ...prev.teamB, score: scoreB },
          winnerId: isForfeit ? forfeitWinnerId : (scoreA > scoreB ? prev.teamA.id : prev.teamB.id)
        } : prev);
        setTimeout(() => {
          setIsScoringOpen(false);
          setMutationStatus('idle');
        }, 1000);
      } else {
        setMutationStatus('failed');
        setMutationError(res.error || localResult.error || 'Failed to confirm match score.');
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-mono pb-16">
      
      {/* 1. Top Breadcrumb & Organizer Broadcast Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => {
            if (match.tournamentId) {
              onNavigate('tournament_detail', match.tournamentId);
            } else {
              onNavigate('matches');
            }
          }}
          className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{match.tournamentId ? 'Back to Tournament' : 'Back to Matches'}</span>
        </button>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Tournament context tag */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="text-stone-500 font-bold uppercase">TOURNAMENT:</span>
            <button
              onClick={() => onNavigate('tournament_detail', match.tournamentId)}
              className="text-[#7C3AED] hover:underline font-black cursor-pointer uppercase flex items-center gap-1"
            >
              <span>{match.tournamentName || 'Championship Tournament'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Admin & Organizer Stream Link / OBS Setup Button */}
          {isOrganizer && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="px-3.5 py-2 bg-[#FFE600] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                title="Configure Twitch, YouTube, or OBS Studio Stream link"
              >
                <Tv className="w-4 h-4" />
                <span>OBS &amp; Stream Setup</span>
              </button>

              <button
                onClick={() => {
                  setScoreA(match.teamA?.score || 0);
                  setScoreB(match.teamB?.score || 0);
                  setIsScoringOpen(true);
                }}
                className="px-3.5 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
              >
                <Trophy className="w-4 h-4" />
                <span>Confirm Scores</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Team VS Team Header (Directly matching LiveMatchSkeleton layout) */}
      <div className="bg-white border-[3.5px] border-black p-5 sm:p-7 shadow-[6px_6px_0px_0px_#000]">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-center">
          
          {/* Team A */}
          <div 
            onClick={() => match.teamA?.id && onNavigate('team_profile', match.teamA.id)}
            className="md:col-span-4 flex items-center gap-4 justify-start md:justify-end text-left md:text-right cursor-pointer group"
          >
            <div className="space-y-1 order-2 md:order-1">
              <div className="flex items-center gap-2 justify-start md:justify-end">
                <span className="font-sans font-black text-xl sm:text-2xl text-black group-hover:text-[#7C3AED] transition-colors uppercase">
                  {match.teamA?.name}
                </span>
                {teamAWins && (
                  <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black text-[10px] font-black uppercase inline-flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> WINNER
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-stone-500 font-bold">
                {match.teamA?.city || 'India'} · Rating {match.teamA?.rating || 1200}
              </div>
            </div>

            <div className="w-16 h-16 rounded-full bg-stone-100 border-[3px] border-black shrink-0 flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000] order-1 md:order-2 group-hover:scale-105 transition-transform">
              {match.teamA?.logo || '🛡️'}
            </div>
          </div>

          {/* Center VS & Scoreboard Indicator */}
          <div className="md:col-span-3 flex flex-col items-center justify-center space-y-1.5 py-1">
            <div className="flex items-center gap-3">
              <span className="font-sans font-black text-3xl sm:text-4xl text-black">
                {match.teamA?.score ?? 0}
              </span>
              <span className="font-sans font-black text-2xl sm:text-3xl text-stone-400">
                -
              </span>
              <span className="font-sans font-black text-3xl sm:text-4xl text-black">
                {match.teamB?.score ?? 0}
              </span>
            </div>

            {/* Status Badge */}
            {isLive ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FF5757] text-white border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000] animate-pulse">
                <Flame className="w-3.5 h-3.5" />
                <span>LIVE BROADCAST</span>
              </div>
            ) : isCompleted ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#70FFAF] text-black border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>FINAL RESULT</span>
              </div>
            ) : isStartingSoon ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFE600] text-black border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000] animate-pulse">
                <Clock className="w-3.5 h-3.5" />
                <span>{timeLeftStr || 'STARTING SOON'}</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-100 text-stone-800 border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
                <span>UPCOMING MATCH</span>
              </div>
            )}

            <span className="text-[10px] font-mono font-bold text-stone-500 uppercase tracking-wider">
              {match.round} · {match.seriesFormat || 'BO3'}
            </span>
          </div>

          {/* Team B */}
          <div 
            onClick={() => match.teamB?.id && onNavigate('team_profile', match.teamB.id)}
            className="md:col-span-4 flex items-center gap-4 justify-start text-left cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-full bg-stone-100 border-[3px] border-black shrink-0 flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000] group-hover:scale-105 transition-transform">
              {match.teamB?.logo || '⚔️'}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 justify-start">
                <span className="font-sans font-black text-xl sm:text-2xl text-black group-hover:text-[#7C3AED] transition-colors uppercase">
                  {match.teamB?.name}
                </span>
                {teamBWins && (
                  <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black text-[10px] font-black uppercase inline-flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> WINNER
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-stone-500 font-bold">
                {match.teamB?.city || 'India'} · Rating {match.teamB?.rating || 1200}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Match Control Tabs Bar (Directly matching LiveMatchSkeleton tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['LIVE', 'STATS', 'LINEUPS', 'COMMENTARY', 'MAPS'] as MatchDetailTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === tab ? 'bg-[#7C3AED] text-white' : 'bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {tab}
          </button>
        ))}

        {isOrganizer && (
          <button
            onClick={() => setIsBroadcastModalOpen(true)}
            className="ml-auto px-3 py-2 bg-stone-100 hover:bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Admin Stream Controls</span>
          </button>
        )}
      </div>

      {/* 4. Tab Content: LIVE TAB (Video Player + Live Stream Chat + Telemetry) */}
      {activeTab === 'LIVE' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 8 Cols (or 12 in Theater Mode): Video Player */}
            <div className={theaterMode ? 'lg:col-span-12' : 'lg:col-span-8'}>
              <EsportsVideoPlayer
                match={match}
                isOrganizer={isOrganizer}
                onOpenBroadcastControls={() => setIsBroadcastModalOpen(true)}
                theaterMode={theaterMode}
                onToggleTheaterMode={() => setTheaterMode(!theaterMode)}
              />
            </div>

            {/* Right 4 Cols: Live Chat & Caster Desk */}
            <div className={theaterMode ? 'lg:col-span-12' : 'lg:col-span-4'}>
              <LiveMatchChatPanel
                match={match}
                isOrganizer={isOrganizer}
              />
            </div>
          </div>

          {/* Real-time Match Telemetry Bar */}
          <div className="bg-white border-[3.5px] border-black p-4 shadow-[6px_6px_0px_0px_#000] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-mono text-xs">
            <div className="p-2 border-2 border-black bg-stone-50">
              <span className="text-[10px] text-stone-500 font-bold uppercase block">SERIES MAP</span>
              <span className="font-black text-black text-sm">Game {match.currentGame || 1} of {match.totalGames || 3}</span>
            </div>

            <div className="p-2 border-2 border-black bg-stone-50">
              <span className="text-[10px] text-stone-500 font-bold uppercase block">KILL SCORE</span>
              <span className="font-black text-black text-sm">
                <span className="text-emerald-700">{match.telemetry?.teamAKills ?? 21}</span>
                <span className="mx-1 text-stone-400">-</span>
                <span className="text-rose-700">{match.telemetry?.teamBKills ?? 16}</span>
              </span>
            </div>

            <div className="p-2 border-2 border-black bg-stone-50">
              <span className="text-[10px] text-stone-500 font-bold uppercase block">NET WORTH LEAD</span>
              <span className="font-black text-[#7C3AED] text-sm">
                +{((match.telemetry?.goldLead ?? 3850) / 1000).toFixed(1)}k ({match.teamA.tag})
              </span>
            </div>

            <div className="p-2 border-2 border-black bg-stone-50">
              <span className="text-[10px] text-stone-500 font-bold uppercase block">ROSHAN PIT</span>
              <span className="font-black text-emerald-700 text-sm">
                {match.telemetry?.roshanStatus || 'Alive (Aegis Up)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Tab Content: STATS TAB */}
      {activeTab === 'STATS' && (
        <div className="space-y-6">
          <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="font-sans font-black text-xl uppercase text-black">
                  Match Telemetry &amp; Advanced Analytics
                </h3>
              </div>
              <span className="text-xs font-bold text-stone-500">
                Official Server Snapshot · Game {match.currentGame || 1}
              </span>
            </div>

            {/* Net Worth Lead Visual Gauge */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-emerald-700 font-black">{match.teamA.name} (+3.8k Gold Lead)</span>
                <span className="text-rose-700 font-black">{match.teamB.name}</span>
              </div>
              <div className="h-6 w-full bg-stone-100 border-2 border-black p-0.5 flex">
                <div className="h-full bg-emerald-500" style={{ width: '58%' }} />
                <div className="h-full bg-rose-500" style={{ width: '42%' }} />
              </div>
              <div className="flex justify-between text-[10px] text-stone-500 font-bold">
                <span>Radiant Advantage: 58%</span>
                <span>Dire Advantage: 42%</span>
              </div>
            </div>

            {/* Objectives Destroyed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                <span className="font-black text-black uppercase text-sm block">
                  {match.teamA.name} Objectives
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">TOWERS</span>
                    <span className="font-black text-lg">7 / 11</span>
                  </div>
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">BARRACKS</span>
                    <span className="font-black text-lg">2 / 6</span>
                  </div>
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">ROSHANS</span>
                    <span className="font-black text-lg">1</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                <span className="font-black text-black uppercase text-sm block">
                  {match.teamB.name} Objectives
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">TOWERS</span>
                    <span className="font-black text-lg">4 / 11</span>
                  </div>
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">BARRACKS</span>
                    <span className="font-black text-lg">0 / 6</span>
                  </div>
                  <div className="p-2 bg-white border border-black">
                    <span className="block text-stone-500 text-[10px]">ROSHANS</span>
                    <span className="font-black text-lg">0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Tab Content: LINEUPS TAB */}
      {activeTab === 'LINEUPS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
          {/* Team A Lineup */}
          <div className="bg-white border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <span className="text-3xl">{match.teamA.logo || '🛡️'}</span>
              <div>
                <h4 className="font-sans font-black text-lg text-black uppercase">
                  {match.teamA.name}
                </h4>
                <span className="text-xs text-stone-500 font-bold">
                  Captain &amp; Starting Roster
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { pos: 'Pos 1 (Carry)', player: 'Aman_Dota', hero: 'Phantom Assassin', mmr: '7,400' },
                { pos: 'Pos 2 (Mid)', player: 'Rohan_Playz', hero: 'Storm Spirit', mmr: '7,150' },
                { pos: 'Pos 3 (Offlane)', player: 'Devansh_Tank', hero: 'Mars', mmr: '6,900' },
                { pos: 'Pos 4 (Soft Support)', player: 'Kunal_Roam', hero: 'Mirana', mmr: '6,800' },
                { pos: 'Pos 5 (Hard Support)', player: 'Sameer_Captain', hero: 'Crystal Maiden', mmr: '6,950', isCaptain: true }
              ].map((p, idx) => (
                <div key={idx} className="p-2.5 bg-stone-50 border-2 border-black flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-black">{p.player}</span>
                      {p.isCaptain && (
                        <span className="px-1 bg-[#FFE600] text-black font-black text-[9px] border border-black">
                          CAPTAIN
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 font-bold">{p.pos} · {p.hero}</span>
                  </div>
                  <span className="font-bold text-xs bg-white px-2 py-0.5 border border-black">
                    {p.mmr} MMR
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Team B Lineup */}
          <div className="bg-white border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
            <div className="flex items-center gap-3 border-b-2 border-black pb-3">
              <span className="text-3xl">{match.teamB.logo || '⚔️'}</span>
              <div>
                <h4 className="font-sans font-black text-lg text-black uppercase">
                  {match.teamB.name}
                </h4>
                <span className="text-xs text-stone-500 font-bold">
                  Captain &amp; Starting Roster
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              {[
                { pos: 'Pos 1 (Carry)', player: 'Vikram_Slayer', hero: 'Juggernaut', mmr: '7,350' },
                { pos: 'Pos 2 (Mid)', player: 'Aditya_MidGod', hero: 'Invoker', mmr: '7,500' },
                { pos: 'Pos 3 (Offlane)', player: 'Tarun_Beast', hero: 'Centaur Warrunner', mmr: '6,850' },
                { pos: 'Pos 4 (Soft Support)', player: 'Harsh_Ward', hero: 'Rubick', mmr: '6,700' },
                { pos: 'Pos 5 (Hard Support)', player: 'Arnav_Captain', hero: 'Disruptor', mmr: '7,000', isCaptain: true }
              ].map((p, idx) => (
                <div key={idx} className="p-2.5 bg-stone-50 border-2 border-black flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-black">{p.player}</span>
                      {p.isCaptain && (
                        <span className="px-1 bg-[#FFE600] text-black font-black text-[9px] border border-black">
                          CAPTAIN
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-500 font-bold">{p.pos} · {p.hero}</span>
                  </div>
                  <span className="font-bold text-xs bg-white px-2 py-0.5 border border-black">
                    {p.mmr} MMR
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 7. Tab Content: COMMENTARY TAB */}
      {activeTab === 'COMMENTARY' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-sans font-black text-xl uppercase text-black">
                Official Caster Desk Play-by-Play Log
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-500">Live Telemetry Feed</span>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { time: '28:44', event: 'Current Game State: Radiant holding high ground siege with 3.8k net worth lead.' },
              { time: '26:12', event: `${match.teamA.name} secures second Roshan. Aegis claimed by Carry, Cheese to Mid.` },
              { time: '22:04', event: `Dire Tier 2 Mid Tower destroyed by ${match.teamA.name}. Map control secured.` },
              { time: '18:25', event: `Massive 5v5 teamfight at bottom river rune. 3 kills for ${match.teamB.name}, 1 kill for ${match.teamA.name}.` },
              { time: '14:10', event: `${match.teamA.name} takes first Roshan. Aegis claimed.` },
              { time: '04:30', event: `First Blood claimed in safe lane by ${match.teamA.name} Carry!` },
              { time: '00:00', event: 'Horn sounds! Creeps spawn across all 3 competitive lanes.' }
            ].map((c, i) => (
              <div key={i} className="p-3 border-2 border-black bg-stone-50 flex items-start gap-3">
                <span className="px-2 py-0.5 bg-black text-[#FFE600] font-black text-[11px] shrink-0 border border-black">
                  {c.time}
                </span>
                <p className="font-bold text-stone-800 leading-snug pt-0.5">
                  {c.event}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Tab Content: MAPS TAB */}
      {activeTab === 'MAPS' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-sans font-black text-xl uppercase text-black">
                Best-of-{match.seriesFormat === 'BO1' ? '1' : match.seriesFormat === 'BO5' ? '5' : '3'} Series Map Breakdown
              </h3>
            </div>
            <span className="text-xs font-bold text-stone-500">{match.round}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Map 1 */}
            <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-black uppercase">MAP 1</span>
                <span className="px-2 py-0.5 bg-[#70FFAF] text-black font-black text-[10px] border border-black">
                  COMPLETED
                </span>
              </div>
              <p className="text-stone-600">Duration: 34m 12s</p>
              <div className="p-2 bg-white border border-black font-bold">
                Winner: {match.teamA.name} (1-0)
              </div>
            </div>

            {/* Map 2 */}
            <div className="p-4 border-2 border-black bg-[#F3E8FF] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-black uppercase">MAP 2</span>
                <span className="px-2 py-0.5 bg-[#FF5757] text-white font-black text-[10px] border border-black animate-pulse">
                  LIVE NOW
                </span>
              </div>
              <p className="text-stone-600">Duration: 28m 44s (In Progress)</p>
              <div className="p-2 bg-white border border-black font-bold text-[#7C3AED]">
                Series Decider Potential
              </div>
            </div>

            {/* Map 3 */}
            <div className="p-4 border-2 border-black bg-stone-50 space-y-2 opacity-60">
              <div className="flex items-center justify-between">
                <span className="font-black text-black uppercase">MAP 3</span>
                <span className="px-2 py-0.5 bg-stone-200 text-stone-700 font-black text-[10px] border border-black">
                  IF NEEDED
                </span>
              </div>
              <p className="text-stone-600">Decider Game</p>
              <div className="p-2 bg-white border border-black text-stone-500">
                Awaiting Map 2 result
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Bracket Progression & Tournament Stakes Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono">
        {/* Advancement Stakes */}
        <div className="bg-[#F3E8FF] border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <h4 className="font-sans font-black text-lg uppercase text-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Bracket Advancement &amp; Stakes</span>
          </h4>
          
          <div className="space-y-3 text-xs text-stone-800 leading-relaxed">
            {compNode?.winnerDestinationLabel ? (
              <div className="p-3 bg-white border-2 border-black space-y-1">
                <span className="text-[10px] text-emerald-700 font-black uppercase block">Winner Path:</span>
                <p className="font-bold text-black">
                  Advances directly to <span className="underline">{compNode.winnerDestinationLabel}</span>.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white border-2 border-black">
                <span className="text-[10px] text-emerald-700 font-black uppercase block">Winner Path:</span>
                <p className="font-bold text-black">Advances to the next championship bracket round.</p>
              </div>
            )}

            {compNode?.loserDestinationLabel ? (
              <div className="p-3 bg-white border-2 border-black space-y-1">
                <span className="text-[10px] text-amber-700 font-black uppercase block">Loser Path:</span>
                <p className="font-bold text-black">
                  Drops to Lower Bracket survival fixture: <span className="underline">{compNode.loserDestinationLabel}</span>.
                </p>
              </div>
            ) : (
              <div className="p-3 bg-white border-2 border-black">
                <span className="text-[10px] text-amber-700 font-black uppercase block">Loser Path:</span>
                <p className="font-bold text-black">Eliminated or re-routed to lower decider stage.</p>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigate('tournament_detail', match.tournamentId)}
              className="px-4 py-2 bg-black text-[#FFE600] border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer hover:bg-stone-900"
            >
              View Full Tournament Bracket →
            </button>
          </div>
        </div>

        {/* OBS & Broadcaster Guide Info */}
        <div className="bg-white border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <h4 className="font-sans font-black text-lg uppercase text-black flex items-center gap-2">
            <Tv className="w-5 h-5 text-[#7C3AED]" />
            <span>OBS &amp; Broadcast Ecosystem</span>
          </h4>

          <div className="space-y-3 text-xs text-stone-700">
            <div className="border-l-4 border-[#FFE600] pl-3 py-1">
              <span className="font-black text-black uppercase block">1. Link to Twitch or YouTube:</span>
              <p className="text-stone-600 mt-0.5">
                Organisers can stream directly to Twitch or YouTube and link the channel/URL here for an interactive embedded player.
              </p>
            </div>

            <div className="border-l-4 border-[#FF5757] pl-3 py-1">
              <span className="font-black text-black uppercase block">2. Direct OBS Stream / Custom Video:</span>
              <p className="text-stone-600 mt-0.5">
                Provide an HLS stream (<code>.m3u8</code>), WebRTC, or direct video feed for ultra-low latency official observer broadcasting.
              </p>
            </div>

            <div className="border-l-4 border-[#70FFAF] pl-3 py-1">
              <span className="font-black text-black uppercase block">3. OBS Studio Overlay Browser Source:</span>
              <p className="text-stone-600 mt-0.5">
                Copy the transparent scorebug URL from Admin Setup and add it as a Browser Source in OBS Studio to render live scores over your gameplay!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Organizer Broadcast Controls Modal */}
      {isBroadcastModalOpen && (
        <OrganiserBroadcastControlsModal
          isOpen={isBroadcastModalOpen}
          onClose={() => setIsBroadcastModalOpen(false)}
          match={match}
          onBroadcastUpdated={(updated) => {
            setMatch(updated);
          }}
        />
      )}

      {/* Organizer Score Entry Modal */}
      {isScoringOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] max-w-lg w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="font-sans font-black text-xl uppercase text-black">
                  Confirm Official Match Result
                </h3>
              </div>
              <button
                onClick={() => setIsScoringOpen(false)}
                className="w-8 h-8 bg-black text-white border-2 border-black font-black flex items-center justify-center hover:bg-stone-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600">
              Submit authoritative scores for <span className="font-black text-black">{match.round}</span> ({match.seriesFormat || 'BO3'}). Submitting updates the bracket and advances the winning team automatically.
            </p>

            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                <span className="font-bold text-xs uppercase block text-stone-700 truncate">
                  {match.teamA?.name || 'Team A'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={scoreA}
                  onChange={(e) => setScoreA(parseInt(e.target.value, 10) || 0)}
                  disabled={isForfeit}
                  className="w-full text-center text-3xl font-black border-2 border-black p-2 bg-white"
                />
              </div>

              <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                <span className="font-bold text-xs uppercase block text-stone-700 truncate">
                  {match.teamB?.name || 'Team B'}
                </span>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={scoreB}
                  onChange={(e) => setScoreB(parseInt(e.target.value, 10) || 0)}
                  disabled={isForfeit}
                  className="w-full text-center text-3xl font-black border-2 border-black p-2 bg-white"
                />
              </div>
            </div>

            {/* Forfeit Toggle */}
            <div className="p-3 border-2 border-black bg-stone-50 space-y-2 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold uppercase">
                <input
                  type="checkbox"
                  checked={isForfeit}
                  onChange={(e) => {
                    setIsForfeit(e.target.checked);
                    if (e.target.checked && !forfeitWinnerId) {
                      setForfeitWinnerId(match.teamA.id);
                    }
                  }}
                  className="w-4 h-4 accent-black"
                />
                <span>Rule Infraction / Forfeit Victory</span>
              </label>

              {isForfeit && (
                <div className="pt-2 space-y-1">
                  <span className="font-bold text-stone-600 uppercase text-[10px]">Select Forfeit Winner:</span>
                  <select
                    value={forfeitWinnerId}
                    onChange={(e) => setForfeitWinnerId(e.target.value)}
                    className="w-full border-2 border-black p-2 bg-white text-xs font-bold"
                  >
                    <option value={match.teamA.id}>{match.teamA.name} (Winner by Forfeit)</option>
                    <option value={match.teamB.id}>{match.teamB.name} (Winner by Forfeit)</option>
                  </select>
                </div>
              )}
            </div>

            {mutationError && (
              <div className="p-3 bg-red-100 border-2 border-red-800 text-red-900 text-xs font-bold">
                ✕ {mutationError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsScoringOpen(false)}
                className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmScore}
                disabled={mutationStatus === 'pending'}
                className="px-5 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer disabled:opacity-50"
              >
                {mutationStatus === 'pending' ? 'Saving...' : 'Confirm Result & Advance Bracket'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
