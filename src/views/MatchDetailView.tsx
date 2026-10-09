import React, { useState, useEffect, useMemo } from 'react';
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
  Radio, 
  Settings, 
  Tv, 
  Share2, 
  BarChart2, 
  FileText, 
  Layers, 
  Calendar,
  Grid
} from 'lucide-react';
import { Match, ViewType, SeriesGameRecord } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { 
  dotaCompetitionEngine, 
  CompetitionMatchNode, 
  MultiStageTournamentStructure 
} from '../domain/dotaCompetitionEngine';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';
import { EsportsBroadcastPlayer } from '../components/broadcast/EsportsBroadcastPlayer';
import { EsportsMatchStats } from '../components/match/EsportsMatchStats';
import { OrganiserBroadcastControlsModal } from '../components/broadcast/OrganiserBroadcastControlsModal';

interface MatchDetailViewProps {
  matchId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export type MatchStatsTab = 'OVERVIEW' | 'SCOREBOARD' | 'GRAPHS' | 'TIMELINE' | 'DRAFT';

export function MatchDetailView({ matchId, onNavigate }: MatchDetailViewProps) {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [compNode, setCompNode] = useState<CompetitionMatchNode | null>(null);
  const [structure, setStructure] = useState<MultiStageTournamentStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStatsTab, setActiveStatsTab] = useState<MatchStatsTab>('OVERVIEW');
  const [selectedGameNumber, setSelectedGameNumber] = useState<number>(1);
  const [theaterMode, setTheaterMode] = useState<boolean>(false);

  // Broadcast & Video settings modal
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

      if (foundComp && !isCancelled) {
        setCompNode(foundComp.match);
        setStructure(foundComp.structure);
      }

      if (foundMatch && !isCancelled) {
        setMatch(foundMatch);
        setIsLoading(false);
      }

      // 2. Query Firestore asynchronously for latest authoritative match data
      try {
        const remoteMatch = await tournamentService.fetchMatchById(cleanId);
        if (remoteMatch && !isCancelled) {
          setMatch(prev => ({
            ...(prev || foundMatch || {}),
            ...remoteMatch,
            teamA: {
              ...(prev?.teamA || foundMatch?.teamA || {}),
              ...(remoteMatch.teamA || {})
            },
            teamB: {
              ...(prev?.teamB || foundMatch?.teamB || {}),
              ...(remoteMatch.teamB || {})
            }
          } as Match));
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
                games: data.games || prev.games,
                valveMatchId: data.valveMatchId || prev.valveMatchId,
                replayAvailable: data.replayAvailable !== undefined ? data.replayAvailable : prev.replayAvailable,
                replayFileUrl: data.replayFileUrl || prev.replayFileUrl,
                teamA: {
                  ...prev.teamA,
                  ...(data.teamA || {}),
                  score: data.scores?.teamA ?? data.teamA?.score ?? prev.teamA.score
                },
                teamB: {
                  ...prev.teamB,
                  ...(data.teamB || {}),
                  score: data.scores?.teamB ?? data.teamB?.score ?? prev.teamB.score
                }
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
        if (updated) {
          setMatch(prev => ({ ...(prev || {}), ...updated }));
        }
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

  // Dynamic series game calculation:
  // Support BO1, BO2, BO3, BO5.
  // Do not hardcode game count. Display completed games and necessary upcoming slots.
  // For a finished BO3, if series ended 2-0, do not create a third game!
  const seriesGames: SeriesGameRecord[] = useMemo(() => {
    if (!match) return [];
    const format = (match.seriesFormat || 'BO3').toUpperCase();
    const maxPossibleGames = format.includes('BO1') ? 1 : format.includes('BO2') ? 2 : format.includes('BO5') ? 5 : 3;
    const winsNeeded = Math.ceil(maxPossibleGames / 2);

    const scoreAVal = match.teamA?.score ?? 0;
    const scoreBVal = match.teamB?.score ?? 0;
    const isSeriesCompleted = match.status === 'COMPLETED' || scoreAVal >= winsNeeded || scoreBVal >= winsNeeded;

    // Actual games played
    const totalPlayed = scoreAVal + scoreBVal;

    let totalGameSlots = 0;
    if (isSeriesCompleted) {
      // Completed series: display exactly the completed games that determined the match
      totalGameSlots = Math.max(1, totalPlayed);
    } else {
      // In progress / upcoming: show played games + the current active game
      totalGameSlots = Math.min(maxPossibleGames, Math.max(1, totalPlayed + 1));
    }

    const existingGames = match.games || [];
    const list: SeriesGameRecord[] = [];

    for (let i = 1; i <= totalGameSlots; i++) {
      const existing = existingGames.find(g => g.gameNumber === i);
      const isCompleted = i <= totalPlayed && (isSeriesCompleted || i < totalGameSlots);
      const isCurrentLive = !isSeriesCompleted && i === totalPlayed + 1 && match.status === 'LIVE';

      list.push(existing || {
        gameNumber: i,
        status: isCompleted ? 'COMPLETED' : isCurrentLive ? 'LIVE' : 'UPCOMING',
        valveMatchId: i === 1 ? match.valveMatchId : undefined,
        streamUrl: match.streamUrl,
        streamType: match.streamType,
        vodUrl: isCompleted ? match.streamUrl : undefined,
        replayAvailable: match.replayAvailable,
        replayFileUrl: match.replayFileUrl,
        parseStatus: 'UNPARSED'
      });
    }

    return list;
  }, [match]);

  const activeSelectedGame = useMemo(() => {
    return seriesGames.find(g => g.gameNumber === selectedGameNumber) || seriesGames[0] || null;
  }, [seriesGames, selectedGameNumber]);

  if (isLoading) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
        <div className="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
        <h3 className="text-xl font-black uppercase text-black font-sans">
          Loading Esports Match Center...
        </h3>
        <p className="text-xs text-stone-600">
          Hydrating authoritative stream data and player rosters.
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
          The requested competitive fixture (#{matchId}) was not found in active tournaments.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 font-mono text-xs">
          <button
            onClick={() => onNavigate('matches')}
            className="px-5 py-2.5 bg-[#FFE600] text-black border-2 border-black font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            All Matches
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

  const isLive = Boolean(match.isLive || match.status === 'LIVE');
  const isCompleted = match.status === 'COMPLETED';

  // Authoritative scoring handler
  const handleConfirmScore = async () => {
    if (!match.tournamentId || !match.id) return;
    setMutationStatus('pending');
    setMutationError(null);

    const stageId = compNode?.stageId || structure?.stages?.[0]?.id || `stage-${match.tournamentId}-1`;
    const res = await competitionClientService.recordMatchResult({
      tournamentId: match.tournamentId,
      stageId,
      matchId: match.id,
      scoreA,
      scoreB,
      isForfeit,
      forfeitWinnerId: isForfeit ? forfeitWinnerId : undefined,
      clientVersion: structure?.version
    });

    if (res.success) {
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
      }, 800);
    } else {
      setMutationStatus('failed');
      setMutationError(res.error || 'Failed to record match scores.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 font-mono pb-16">
      
      {/* 1. Top Breadcrumb & Organizer Broadcast Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
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
            <span>{match.tournamentId ? 'Tournament Bracket' : 'Matches'}</span>
          </button>

          {match.tournamentId && (
            <button
              onClick={() => onNavigate('bracket', match.tournamentId)}
              className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black text-xs font-bold uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
            >
              <Grid className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Full Bracket Viewer</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Organizer Broadcast Setup & Scoring Buttons */}
          {isOrganizer && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBroadcastModalOpen(true)}
                className="px-3.5 py-2 bg-[#FFE600] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                title="Configure Twitch, YouTube, or OBS Studio Broadcast"
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

      {/* 2. Compact Team-Versus-Team Scoreboard & Match Status Bar */}
      <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000]">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-4 sm:gap-6 items-center">
          
          {/* Team A */}
          <div 
            onClick={() => match.teamA?.id && onNavigate('team_profile', match.teamA.id)}
            className="md:col-span-4 flex items-center gap-3.5 justify-start md:justify-end text-left md:text-right cursor-pointer group"
          >
            <div className="space-y-0.5 order-2 md:order-1 min-w-0">
              <div className="flex items-center gap-2 justify-start md:justify-end">
                <span className="font-sans font-black text-xl sm:text-2xl text-black group-hover:text-[#7C3AED] transition-colors uppercase truncate">
                  {match.teamA?.name}
                </span>
                {isCompleted && (match.teamA?.score || 0) > (match.teamB?.score || 0) && (
                  <span className="px-1.5 py-0.2 bg-[#70FFAF] text-black border border-black text-[9px] font-black uppercase shrink-0">
                    WINNER
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-500 font-bold truncate">
                {match.teamA?.city || 'India'} · Rating {match.teamA?.rating || 1200}
              </div>
            </div>

            <div className="w-14 h-14 rounded-full bg-stone-100 border-[3px] border-black shrink-0 flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#000] order-1 md:order-2 group-hover:scale-105 transition-transform">
              {match.teamA?.logo || '🛡️'}
            </div>
          </div>

          {/* Center VS Score & Status */}
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
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#FF5757] text-white border-2 border-black font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000] animate-pulse">
                <Radio className="w-3 h-3" />
                <span>SERIES LIVE</span>
              </div>
            ) : isCompleted ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#70FFAF] text-black border-2 border-black font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
                <CheckCircle2 className="w-3 h-3" />
                <span>FINAL RESULT</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-stone-100 text-stone-800 border-2 border-black font-mono text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
                <Clock className="w-3 h-3 text-stone-500" />
                <span>SCHEDULED</span>
              </div>
            )}

            <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
              {match.round} · {match.seriesFormat || 'BO3'}
            </span>
          </div>

          {/* Team B */}
          <div 
            onClick={() => match.teamB?.id && onNavigate('team_profile', match.teamB.id)}
            className="md:col-span-4 flex items-center gap-3.5 justify-start text-left cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-full bg-stone-100 border-[3px] border-black shrink-0 flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#000] group-hover:scale-105 transition-transform">
              {match.teamB?.logo || '⚔️'}
            </div>

            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2 justify-start">
                <span className="font-sans font-black text-xl sm:text-2xl text-black group-hover:text-[#7C3AED] transition-colors uppercase truncate">
                  {match.teamB?.name}
                </span>
                {isCompleted && (match.teamB?.score || 0) > (match.teamA?.score || 0) && (
                  <span className="px-1.5 py-0.2 bg-[#70FFAF] text-black border border-black text-[9px] font-black uppercase shrink-0">
                    WINNER
                  </span>
                )}
              </div>
              <div className="text-[11px] text-stone-500 font-bold truncate">
                {match.teamB?.city || 'India'} · Rating {match.teamB?.rating || 1200}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 3. Large Responsive 16:9 Broadcast & Replay Player */}
      <div className={theaterMode ? 'w-full' : 'max-w-6xl mx-auto'}>
        <EsportsBroadcastPlayer
          match={match}
          selectedGame={activeSelectedGame}
          isOrganizer={isOrganizer}
          onOpenBroadcastControls={() => setIsBroadcastModalOpen(true)}
          theaterMode={theaterMode}
          onToggleTheaterMode={() => setTheaterMode(!theaterMode)}
        />
      </div>

      {/* 4. Dynamic Individual Game Selector (Game 1, Game 2, Game 3...) */}
      <div className="bg-white border-[3.5px] border-black p-4 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#7C3AED]" />
            <h4 className="font-sans font-black text-sm uppercase text-black">
              Series Games ({match.seriesFormat || 'BO3'})
            </h4>
          </div>
          <span className="text-[10px] text-stone-500 font-bold uppercase">
            Select Game for Individual Replay &amp; Statistics
          </span>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          {seriesGames.map((game) => {
            const isSelected = game.gameNumber === selectedGameNumber;
            return (
              <button
                key={game.gameNumber}
                onClick={() => setSelectedGameNumber(game.gameNumber)}
                className={`px-4 py-2 border-2 border-black font-mono font-black text-xs uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 cursor-pointer transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'bg-[#FFE600] text-black ring-2 ring-black'
                    : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span>Game {game.gameNumber}</span>
                <span className={`px-1.5 py-0.2 border border-black text-[9px] font-bold ${
                  game.status === 'LIVE'
                    ? 'bg-[#FF5757] text-white animate-pulse'
                    : game.status === 'COMPLETED'
                    ? 'bg-[#70FFAF] text-black'
                    : 'bg-stone-200 text-stone-700'
                }`}>
                  {game.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Match Statistics Tabs: Overview, Scoreboard, Graphs, Timeline, Draft */}
      <div className="space-y-4">
        <EsportsMatchStats
          match={match}
          selectedGame={activeSelectedGame}
          activeTab={activeStatsTab}
          onTabChange={setActiveStatsTab}
          isOrganizer={isOrganizer}
        />
      </div>

      {/* 6. Organiser Match Controls Modal */}
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

      {/* 7. Organiser Score Entry Modal */}
      {isScoringOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-sans font-black text-base uppercase text-black">
                Confirm Series Result
              </h3>
              <button onClick={() => setIsScoringOpen(false)} className="font-black text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="border-2 border-black p-3 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-black text-sm">{match.teamA.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                      className="w-7 h-7 bg-white border border-black font-black"
                    >
                      -
                    </button>
                    <span className="font-black text-base w-6 text-center">{scoreA}</span>
                    <button
                      onClick={() => setScoreA(scoreA + 1)}
                      className="w-7 h-7 bg-white border border-black font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-black/10 pt-2">
                  <span className="font-black text-black text-sm">{match.teamB.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                      className="w-7 h-7 bg-white border border-black font-black"
                    >
                      -
                    </button>
                    <span className="font-black text-base w-6 text-center">{scoreB}</span>
                    <button
                      onClick={() => setScoreB(scoreB + 1)}
                      className="w-7 h-7 bg-white border border-black font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {mutationError && (
                <div className="p-2.5 bg-rose-100 border border-rose-600 text-rose-900 text-[11px] font-bold">
                  {mutationError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-black/10">
                <button
                  onClick={() => setIsScoringOpen(false)}
                  className="px-4 py-2 bg-stone-100 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmScore}
                  disabled={mutationStatus === 'pending'}
                  className="px-5 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  {mutationStatus === 'pending' ? 'Saving...' : mutationStatus === 'confirmed' ? 'Saved ✓' : 'Save & Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
