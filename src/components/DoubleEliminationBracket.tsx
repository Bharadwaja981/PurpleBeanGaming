import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Trophy, 
  Swords, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2,
  Shield, 
  CheckCircle, 
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Crown,
  CornerDownRight,
  ArrowRight,
  Clock,
  Tv,
  Radio
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { 
  dotaCompetitionEngine, 
  CompetitionMatchNode, 
  TournamentStageConfig 
} from '../domain/dotaCompetitionEngine';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';
import { BracketConnectorLayer } from './bracket/BracketConnectorLayer';

interface DoubleEliminationBracketProps {
  tournamentId: string;
  stageConfig?: TournamentStageConfig;
  onSelectMatch?: (matchId: string) => void;
  onStructureUpdated?: () => void;
}

export const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({
  tournamentId,
  stageConfig,
  onSelectMatch,
  onStructureUpdated
}) => {
  const currentUser = tournamentService.getCurrentUser();
  const tourney = tournamentService.getTournamentById(tournamentId);
  const isOrganizer = currentUser.isAdmin || 
    currentUser.role === 'organizer' || 
    currentUser.id === tourney?.organizer || 
    currentUser.id === tourney?.organizerId ||
    currentUser.id === (tourney as any)?.organiserId ||
    currentUser.email?.toLowerCase().trim() === '11106cm009@gmail.com';

  const [zoomLevel, setZoomLevel] = useState(100);
  const [highlightTeamId, setHighlightTeamId] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const bracketContainerRef = useRef<HTMLDivElement>(null);

  // Authoritative scoring modal
  const [scoringMatch, setScoringMatch] = useState<CompetitionMatchNode | null>(null);
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(0);
  const [isForfeit, setIsForfeit] = useState(false);
  const [forfeitWinnerId, setForfeitWinnerId] = useState<string>('');
  const [mutationStatus, setMutationStatus] = useState<SubmissionStatus>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = dotaCompetitionEngine.subscribe(tournamentId, () => {
      setTick(t => t + 1);
    });
    return () => unsub();
  }, [tournamentId]);

  // Fetch or derive matches for this tournament/stage
  const stage = useMemo(() => {
    if (stageConfig) return stageConfig;
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return structure?.stages.find(s => s.type === 'DOUBLE_ELIMINATION') || structure?.stages[0];
  }, [stageConfig, tournamentId]);

  const matches: CompetitionMatchNode[] = useMemo(() => {
    if (stage?.matches && stage.matches.length > 0) return stage.matches;
    const struct = dotaCompetitionEngine.getStructure(tournamentId);
    if (struct?.matches && struct.matches.length > 0) return struct.matches;
    return tournamentService.getMatches().filter(m => m.tournamentId === tournamentId) as unknown as CompetitionMatchNode[];
  }, [stage, tournamentId]);

  // Upper Bracket matches grouped by round
  const upperQuarterfinals = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'UB_QF' || 
      m.roundKey === 'ub-r1' || 
      m.roundKey?.includes('UB_QF') || 
      m.round?.toLowerCase().includes('quarterfinal')
    );
  }, [matches]);

  const upperSemifinals = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'ub-r2' || 
      m.roundKey?.includes('UB_SF') || 
      (m.round?.toLowerCase().includes('semifinal') && (m.bracketType === 'upper' || m.stage === 'upper'))
    );
  }, [matches]);

  const upperFinal = useMemo(() => {
    return matches.find(m => 
      m.roundKey === 'UB_FINAL' || 
      m.roundKey === 'ub-final' || 
      (m.round?.toLowerCase().includes('upper final'))
    );
  }, [matches]);

  // Lower Bracket matches grouped by round
  const lowerRound1 = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'lb-r1' || 
      m.roundKey?.includes('LB_R1') || 
      m.round?.toLowerCase().includes('lower round 1')
    );
  }, [matches]);

  const lowerRound2 = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'lb-r2' || 
      m.roundKey?.includes('LB_R2') || 
      m.round?.toLowerCase().includes('lower round 2')
    );
  }, [matches]);

  const lowerSemifinal = useMemo(() => {
    return matches.find(m => 
      m.roundKey === 'lb-sf' || 
      m.roundKey === 'LB_SF' || 
      m.round?.toLowerCase().includes('lower semifinal')
    );
  }, [matches]);

  const lowerFinal = useMemo(() => {
    return matches.find(m => 
      m.roundKey === 'lb-final' || 
      m.roundKey === 'LB_FINAL' || 
      m.round?.toLowerCase().includes('lower final')
    );
  }, [matches]);

  // Grand Final
  const grandFinal = useMemo(() => {
    return matches.find(m => 
      m.roundKey === 'GRAND_FINAL' || 
      m.roundKey === 'gf' || 
      m.round?.toLowerCase().includes('grand final') ||
      m.stage === 'grand_final'
    );
  }, [matches]);

  const championTeam = useMemo(() => {
    if (grandFinal && grandFinal.status === 'COMPLETED' && grandFinal.winnerId) {
      if (grandFinal.teamA?.teamId === grandFinal.winnerId || (grandFinal.teamA as any)?.id === grandFinal.winnerId) {
        return grandFinal.teamA;
      }
      if (grandFinal.teamB?.teamId === grandFinal.winnerId || (grandFinal.teamB as any)?.id === grandFinal.winnerId) {
        return grandFinal.teamB;
      }
    }
    return null;
  }, [grandFinal]);

  // Zoom and pan controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(140, prev + 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(60, prev - 10));
  const handleResetZoom = () => setZoomLevel(100);
  const handleFitToScreen = () => {
    if (bracketContainerRef.current) {
      const containerWidth = bracketContainerRef.current.clientWidth;
      const targetScale = Math.max(50, Math.min(100, Math.floor((containerWidth / 1350) * 100)));
      setZoomLevel(targetScale);
    }
  };

  const handleOpenScoreModal = (m: CompetitionMatchNode) => {
    setScoringMatch(m);
    setScoreA(m.scores?.teamA ?? 2);
    setScoreB(m.scores?.teamB ?? 0);
    setIsForfeit(m.status === 'FORFEIT');
    setForfeitWinnerId(m.forfeitWinnerId || '');
    setMutationStatus('idle');
    setMutationError(null);
  };

  const handleSubmitScore = async () => {
    if (!scoringMatch) return;
    setMutationStatus('pending');
    setMutationError(null);

    const struct = dotaCompetitionEngine.getStructure(tournamentId);
    const res = await competitionClientService.recordMatchResult({
      tournamentId,
      stageId: scoringMatch.stageId || stage?.id || '',
      matchId: scoringMatch.id,
      scoreA,
      scoreB,
      isForfeit,
      forfeitWinnerId: isForfeit ? forfeitWinnerId : undefined,
      clientVersion: struct?.version
    });

    if (res.success) {
      setMutationStatus('confirmed');
      if (onStructureUpdated) onStructureUpdated();
      setTimeout(() => {
        setScoringMatch(null);
        setMutationStatus('idle');
      }, 1000);
    } else {
      setMutationStatus('failed');
      setMutationError(res.error || 'Server rejected match result confirmation.');
    }
  };

  // Match Card Component with exact measured data-match-id
  const renderMatchCard = (m: CompetitionMatchNode, roundTitle: string, isUpper = true, dropLabel?: string, sourceLabel?: string) => {
    if (!m) return null;
    const teamAName = m.teamA?.name || m.teamA?.teamName || m.teamA?.sourceLabel || 'TBD';
    const teamBName = m.teamB?.name || m.teamB?.teamName || m.teamB?.sourceLabel || 'TBD';
    const teamAId = m.teamA?.teamId || m.teamA?.id;
    const teamBId = m.teamB?.teamId || m.teamB?.id;

    const isWinnerA = m.status === 'COMPLETED' && (m.scores?.teamA ?? 0) > (m.scores?.teamB ?? 0);
    const isWinnerB = m.status === 'COMPLETED' && (m.scores?.teamB ?? 0) > (m.scores?.teamA ?? 0);

    const isTeamAHighlighted = Boolean(highlightTeamId && teamAId === highlightTeamId);
    const isTeamBHighlighted = Boolean(highlightTeamId && teamBId === highlightTeamId);
    const isMatchCardHighlighted = isTeamAHighlighted || isTeamBHighlighted;

    return (
      <div
        key={m.id}
        data-match-id={m.id}
        className={`w-64 border-2 border-black p-3 bg-white shadow-[3px_3px_0px_0px_#000] space-y-2 relative transition-all duration-150 select-none ${
          isMatchCardHighlighted ? 'ring-2 ring-[#7C3AED] bg-purple-50/40' : 'hover:bg-stone-50'
        }`}
      >
        {/* Card Header Bar */}
        <div className="flex items-center justify-between text-[10px] text-stone-500 font-bold border-b border-black/10 pb-1">
          <span className="truncate max-w-[120px]">{roundTitle}</span>
          <div className="flex items-center gap-1">
            {m.status === 'LIVE' ? (
              <span className="bg-[#FF5757] text-white px-1.5 py-0.2 border border-black font-black uppercase text-[9px] animate-pulse flex items-center gap-1">
                <Radio className="w-2.5 h-2.5" />
                LIVE
              </span>
            ) : m.status === 'COMPLETED' ? (
              <span className="bg-[#70FFAF] text-black px-1.5 py-0.2 border border-black font-black uppercase text-[9px]">
                FINAL
              </span>
            ) : (
              <span className="text-stone-400 font-mono text-[9px]">
                {m.seriesFormat || 'BO3'}
              </span>
            )}
          </div>
        </div>

        {sourceLabel && (
          <div className="text-[9px] text-stone-400 font-mono truncate">
            {sourceLabel}
          </div>
        )}

        {/* Team A Slot */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (teamAId) setHighlightTeamId(prev => prev === teamAId ? null : teamAId);
          }}
          className={`flex items-center justify-between text-xs font-bold py-1 px-1 rounded-xs cursor-pointer transition-colors ${
            isTeamAHighlighted ? 'bg-[#7C3AED]/15 text-black font-black' : isWinnerA ? 'text-black font-black' : isWinnerB ? 'opacity-60' : 'hover:bg-stone-100'
          }`}
          title="Click to highlight team path across bracket"
        >
          <div className="flex items-center gap-1.5 truncate">
            {m.teamA?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black shrink-0">
                #{m.teamA.seed}
              </span>
            ) : m.teamA?.sourceLabel ? (
              <span className="bg-stone-200 text-stone-800 text-[9px] px-1 py-0.2 border border-black font-mono shrink-0">
                {m.teamA.sourceLabel}
              </span>
            ) : null}
            <span className="text-sm shrink-0">{m.teamA?.logo || '🛡️'}</span>
            <span className="truncate">{teamAName}</span>
          </div>
          <span className={`border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center shrink-0 ${
            isWinnerA ? 'bg-[#70FFAF]' : 'bg-stone-100'
          }`}>
            {m.scores?.teamA ?? 0}
          </span>
        </div>

        {/* Team B Slot */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (teamBId) setHighlightTeamId(prev => prev === teamBId ? null : teamBId);
          }}
          className={`flex items-center justify-between text-xs font-bold py-1 px-1 rounded-xs cursor-pointer transition-colors ${
            isTeamBHighlighted ? 'bg-[#7C3AED]/15 text-black font-black' : isWinnerB ? 'text-black font-black' : isWinnerA ? 'opacity-60' : 'hover:bg-stone-100'
          }`}
          title="Click to highlight team path across bracket"
        >
          <div className="flex items-center gap-1.5 truncate">
            {m.teamB?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black shrink-0">
                #{m.teamB.seed}
              </span>
            ) : m.teamB?.sourceLabel ? (
              <span className="bg-stone-200 text-stone-800 text-[9px] px-1 py-0.2 border border-black font-mono shrink-0">
                {m.teamB.sourceLabel}
              </span>
            ) : null}
            <span className="text-sm shrink-0">{m.teamB?.logo || '🛡️'}</span>
            <span className="truncate">{teamBName}</span>
          </div>
          <span className={`border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center shrink-0 ${
            isWinnerB ? 'bg-[#70FFAF]' : 'bg-stone-100'
          }`}>
            {m.scores?.teamB ?? 0}
          </span>
        </div>

        {/* Loser Drop Indicator */}
        {dropLabel && (
          <div className="pt-1 border-t border-black/10 flex items-center gap-1 text-[9px] font-bold text-rose-700">
            <CornerDownRight className="w-3 h-3 text-rose-600 shrink-0" />
            <span className="truncate">Drop: {dropLabel}</span>
          </div>
        )}

        {/* Action Controls & Navigation */}
        <div className="pt-1 border-t border-black/10 flex items-center justify-between gap-2">
          <button
            onClick={() => onSelectMatch?.(m.id)}
            className="text-[10px] text-stone-600 hover:text-black font-bold uppercase underline cursor-pointer flex items-center gap-1"
          >
            <span>Match Center</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>

          {isOrganizer && (
            <button
              onClick={() => handleOpenScoreModal(m)}
              className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
                m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black hover:bg-[#58e094]' : 'bg-[#FFE600] text-black hover:bg-yellow-400'
              }`}
            >
              {m.status === 'COMPLETED' ? 'Edit Score' : 'Score'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* 1. BRACKET HEADER & VIEW CONTROLS */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Trophy className="w-6 h-6 text-[#7C3AED]" />
          </div>
          <div>
            <h3 className="font-sans font-black text-lg uppercase text-black">
              DOUBLE ELIMINATION TOURNAMENT BRACKET
            </h3>
            <p className="text-[11px] text-stone-600 font-bold">
              {stage?.name || 'Tournament'} • Upper &amp; Lower Brackets • Best of {stage?.defaultSeriesFormat?.replace('BO', '') || '3'} (Grand Final {stage?.grandFinalSeriesFormat || 'BO5'})
            </p>
          </div>
        </div>

        {/* Legend & Zoom / Pan Controls */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Path Legend */}
          <div className="flex items-center gap-3 text-[10px] font-black uppercase text-stone-600 border-r-2 border-black pr-4">
            <span className="flex items-center gap-1 text-[#7C3AED]">
              <span className="w-3.5 h-1 bg-[#7C3AED] inline-block border border-black" />
              Winner Advancement
            </span>
            <span className="flex items-center gap-1 text-[#F43F5E]">
              <span className="w-3.5 h-1 border-t-2 border-dashed border-[#F43F5E] inline-block" />
              Loser Drop to LB
            </span>
            {highlightTeamId && (
              <button
                onClick={() => setHighlightTeamId(null)}
                className="px-2 py-0.5 bg-[#FFE600] text-black border border-black text-[9px] font-black uppercase cursor-pointer hover:bg-yellow-300 ml-1"
              >
                Clear Highlight ✕
              </button>
            )}
          </div>

          {/* Pan & Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleFitToScreen}
              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-black font-black text-[10px] cursor-pointer flex items-center gap-1"
              title="Fit Bracket to Screen"
            >
              <Maximize2 className="w-3 h-3" />
              <span className="hidden sm:inline">Fit</span>
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-black font-black text-[10px] cursor-pointer"
              title="Reset Zoom to 100%"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              className="p-1 bg-stone-100 hover:bg-stone-200 border border-black cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 bg-stone-100 hover:bg-stone-200 border border-black cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Champion Banner if finalized */}
      {championTeam && (
        <div className="bg-[#FFE600] border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-8 h-8 text-black animate-bounce" />
            <div>
              <span className="text-[10px] font-black uppercase text-black tracking-wider block">
                OFFICIAL TOURNAMENT CHAMPION
              </span>
              <h2 className="font-sans font-black text-2xl uppercase text-black">
                {championTeam.name}
              </h2>
            </div>
          </div>
          <span className="px-3 py-1 bg-black text-[#FFE600] font-black uppercase text-xs border border-black">
            GRAND FINAL WINNER
          </span>
        </div>
      )}

      {/* 2. BRACKET CANVAS CONTAINER WITH DYNAMIC SVG CONNECTOR LAYER */}
      <div 
        ref={bracketContainerRef}
        className="relative bg-[#FAFAF9] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] overflow-x-auto space-y-12 min-h-[600px]"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
      >
        {/* Dynamic Architectural SVG Connector Layer */}
        <BracketConnectorLayer
          containerRef={bracketContainerRef}
          matches={matches}
          highlightTeamId={highlightTeamId}
          zoomLevel={zoomLevel}
        />

        {/* UPPER BRACKET SECTION */}
        <div className="space-y-4 relative z-0">
          <div className="flex items-center gap-2 border-b-2 border-black pb-2">
            <span className="bg-[#7C3AED] text-white p-1 border border-black font-black text-[10px]">UB</span>
            <h4 className="font-sans font-black text-base uppercase text-[#7C3AED]">
              UPPER BRACKET (WINNERS ADVANCEMENT)
            </h4>
          </div>

          <div className="flex items-start gap-16 pt-2 min-w-max">
            {/* Column 1: Upper Quarterfinals */}
            {upperQuarterfinals.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Upper Quarterfinals (BO3)
                </span>
                <div className="space-y-6">
                  {upperQuarterfinals.map((m, idx) => (
                    <div key={m.id}>
                      {renderMatchCard(m, `UB QF ${idx + 1}`, true, `LB R1 - M${Math.floor(idx / 2) + 1}`)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column 2: Upper Semifinals */}
            {upperSemifinals.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Upper Semifinals (BO3)
                </span>
                <div className="space-y-24 pt-8">
                  {upperSemifinals.map((m, idx) => (
                    <div key={m.id}>
                      {renderMatchCard(m, `UB SF ${idx + 1}`, true, `LB R2 - M${idx + 1}`)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column 3: Upper Final */}
            {upperFinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Upper Final (BO3)
                </span>
                <div className="pt-24">
                  {renderMatchCard(upperFinal, 'UB FINAL', true, 'LB Final')}
                </div>
              </div>
            )}

            {/* Column 4: Championship Grand Final */}
            {grandFinal && (
              <div className="space-y-6 pl-2">
                <span className="font-black uppercase text-[10px] text-amber-700 block border-b border-black pb-1">
                  Championship Grand Final (BO5)
                </span>
                <div className="pt-24">
                  {renderMatchCard(grandFinal, 'GRAND FINAL', true)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LOWER BRACKET SECTION */}
        <div className="space-y-4 pt-8 border-t-2 border-black relative z-0">
          <div className="flex items-center gap-2 border-b-2 border-black pb-2">
            <span className="bg-amber-600 text-white p-1 border border-black font-black text-[10px]">LB</span>
            <h4 className="font-sans font-black text-base uppercase text-amber-800">
              LOWER BRACKET (ELIMINATION SURVIVAL)
            </h4>
          </div>

          <div className="flex items-start gap-16 pt-2 min-w-max">
            {/* Column 1: Lower Round 1 */}
            {lowerRound1.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Lower Round 1 (BO3)
                </span>
                <div className="space-y-6">
                  {lowerRound1.map((m, idx) => (
                    <div key={m.id}>
                      {renderMatchCard(m, `LB R1 - M${idx + 1}`, false, undefined, 'From: UB QF Drops')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column 2: Lower Round 2 */}
            {lowerRound2.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Lower Round 2 (BO3)
                </span>
                <div className="space-y-8 pt-4">
                  {lowerRound2.map((m, idx) => (
                    <div key={m.id}>
                      {renderMatchCard(m, `LB R2 - M${idx + 1}`, false, undefined, 'From: UB SF Drops')}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column 3: Lower Semifinal */}
            {lowerSemifinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Lower Semifinal (BO3)
                </span>
                <div className="pt-12">
                  {renderMatchCard(lowerSemifinal, 'LB SEMIFINAL', false)}
                </div>
              </div>
            )}

            {/* Column 4: Lower Final */}
            {lowerFinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                  Lower Final (BO3)
                </span>
                <div className="pt-12">
                  {renderMatchCard(lowerFinal, 'LB FINAL', false, undefined, 'From: UB Final Drop')}
                </div>
              </div>
            )}

            {/* Grand Final Qualifier Banner indicator */}
            {lowerFinal && grandFinal && (
              <div className="flex items-center gap-2 pl-4 pt-16 border-l-2 border-dashed border-amber-600">
                <div className="p-3 bg-amber-50 border border-amber-700 text-amber-900 font-bold text-[10px] flex items-center gap-1 shadow-[2px_2px_0px_0px_#000]">
                  <span>Winner Advances to Grand Final</span>
                  <ArrowRight className="w-4 h-4 text-amber-800" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. AUTHORITATIVE MATCH SCORING MODAL */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div>
                <h3 className="font-sans font-black text-base uppercase text-black">
                  Record Bracket Score
                </h3>
                <span className="text-[10px] text-stone-500 font-bold uppercase">
                  {scoringMatch.round} · {scoringMatch.seriesFormat || 'BO3'}
                </span>
              </div>
              <button onClick={() => setScoringMatch(null)} className="font-black text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="border-2 border-black p-3 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-black text-sm truncate max-w-[180px]">
                    {scoringMatch.teamA?.name || 'Team A'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                      className="w-7 h-7 bg-white border border-black font-black text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-black text-base w-6 text-center">{scoreA}</span>
                    <button
                      onClick={() => setScoreA(scoreA + 1)}
                      className="w-7 h-7 bg-white border border-black font-black text-sm cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-black/10 pt-2">
                  <span className="font-black text-black text-sm truncate max-w-[180px]">
                    {scoringMatch.teamB?.name || 'Team B'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                      className="w-7 h-7 bg-white border border-black font-black text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-black text-base w-6 text-center">{scoreB}</span>
                    <button
                      onClick={() => setScoreB(scoreB + 1)}
                      className="w-7 h-7 bg-white border border-black font-black text-sm cursor-pointer"
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
                  onClick={() => setScoringMatch(null)}
                  className="px-4 py-2 bg-stone-100 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitScore}
                  disabled={mutationStatus === 'pending'}
                  className="px-5 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  {mutationStatus === 'pending' ? 'Saving...' : mutationStatus === 'confirmed' ? 'Saved ✓' : 'Confirm & Advance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
