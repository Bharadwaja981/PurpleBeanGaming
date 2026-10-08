import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trophy, 
  Swords, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Shield, 
  CheckCircle, 
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Crown
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { 
  dotaCompetitionEngine, 
  CompetitionMatchNode, 
  TournamentStageConfig 
} from '../domain/dotaCompetitionEngine';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';

interface SingleEliminationBracketProps {
  tournamentId: string;
  stageConfig?: TournamentStageConfig;
  onSelectMatch?: (matchId: string) => void;
  onStructureUpdated?: () => void;
}

export const SingleEliminationBracket: React.FC<SingleEliminationBracketProps> = ({
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
  const [, setTick] = useState(0);

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

  const stage = useMemo(() => {
    if (stageConfig) return stageConfig;
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return structure?.stages.find(s => s.type === 'SINGLE_ELIMINATION') || structure?.stages[0];
  }, [stageConfig, tournamentId]);

  const matches: CompetitionMatchNode[] = useMemo(() => {
    if (stage?.matches && stage.matches.length > 0) return stage.matches;
    const struct = dotaCompetitionEngine.getStructure(tournamentId);
    if (struct?.matches && struct.matches.length > 0) return struct.matches;
    return tournamentService.getMatches().filter(m => m.tournamentId === tournamentId) as unknown as CompetitionMatchNode[];
  }, [stage, tournamentId]);

  // Group matches by round key / title
  const quarterfinals = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'se-qf' || 
      m.roundKey?.includes('qf') || 
      m.round?.toLowerCase().includes('quarterfinal')
    );
  }, [matches]);

  const semifinals = useMemo(() => {
    return matches.filter(m => 
      m.roundKey === 'se-sf' || 
      m.roundKey === 'sf' || 
      m.roundKey?.includes('sf') || 
      m.round?.toLowerCase().includes('semifinal')
    );
  }, [matches]);

  const grandFinal = useMemo(() => {
    return matches.find(m => 
      m.roundKey === 'gf' || 
      m.roundKey === 'GRAND_FINAL' || 
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

  const handleZoomIn = () => setZoomLevel(prev => Math.min(140, prev + 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(70, prev - 10));
  const handleResetZoom = () => setZoomLevel(100);

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

  const renderMatchCard = (m: CompetitionMatchNode, roundTitle: string) => {
    if (!m) return null;
    const teamAName = m.teamA?.name || m.teamA?.teamName || m.teamA?.sourceLabel || 'TBD';
    const teamBName = m.teamB?.name || m.teamB?.teamName || m.teamB?.sourceLabel || 'TBD';

    const isWinnerA = m.status === 'COMPLETED' && (m.scores?.teamA ?? 0) > (m.scores?.teamB ?? 0);
    const isWinnerB = m.status === 'COMPLETED' && (m.scores?.teamB ?? 0) > (m.scores?.teamA ?? 0);

    return (
      <div
        key={m.id}
        className="w-64 border-2 border-black p-3 bg-white hover:bg-stone-50 shadow-[3px_3px_0px_0px_#000] space-y-2 relative transition-all"
      >
        <div className="flex items-center justify-between text-[10px] font-bold border-b border-black/10 pb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[#7C3AED] uppercase font-black">{roundTitle}</span>
            {m.seriesFormat && (
              <span className="bg-stone-200 border border-black/30 px-1 py-0.2 text-[9px] font-mono">
                {m.seriesFormat}
              </span>
            )}
          </div>
          <span className={`border border-black px-1.5 py-0.2 uppercase text-[9px] font-black ${
            m.status === 'LIVE' ? 'bg-[#FF3366] text-white animate-pulse' :
            m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black' :
            'bg-stone-100 text-stone-700'
          }`}>
            {m.status || 'UPCOMING'}
          </span>
        </div>

        {/* Team A */}
        <div className={`flex items-center justify-between text-xs font-bold py-0.5 ${isWinnerA ? 'text-black font-black' : isWinnerB ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-1.5 truncate">
            {m.teamA?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black">
                #{m.teamA.seed}
              </span>
            ) : m.teamA?.sourceLabel ? (
              <span className="bg-stone-200 text-stone-800 text-[9px] px-1 py-0.2 border border-black font-mono">
                {m.teamA.sourceLabel}
              </span>
            ) : null}
            <span className="text-sm">{m.teamA?.logo || '🛡️'}</span>
            <span className="truncate">{teamAName}</span>
          </div>
          <span className={`border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center ${
            isWinnerA ? 'bg-[#70FFAF]' : 'bg-stone-100'
          }`}>
            {m.scores?.teamA ?? 0}
          </span>
        </div>

        {/* Team B */}
        <div className={`flex items-center justify-between text-xs font-bold py-0.5 ${isWinnerB ? 'text-black font-black' : isWinnerA ? 'opacity-60' : ''}`}>
          <div className="flex items-center gap-1.5 truncate">
            {m.teamB?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black">
                #{m.teamB.seed}
              </span>
            ) : m.teamB?.sourceLabel ? (
              <span className="bg-stone-200 text-stone-800 text-[9px] px-1 py-0.2 border border-black font-mono">
                {m.teamB.sourceLabel}
              </span>
            ) : null}
            <span className="text-sm">{m.teamB?.logo || '🛡️'}</span>
            <span className="truncate">{teamBName}</span>
          </div>
          <span className={`border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center ${
            isWinnerB ? 'bg-[#70FFAF]' : 'bg-stone-100'
          }`}>
            {m.scores?.teamB ?? 0}
          </span>
        </div>

        {/* Action Controls */}
        <div className="pt-1 border-t border-black/10 flex items-center justify-between gap-2">
          <button
            onClick={() => onSelectMatch?.(m.id)}
            className="text-[10px] text-stone-600 hover:text-black font-bold uppercase underline cursor-pointer"
          >
            Match Details
          </button>

          {isOrganizer && (
            <button
              onClick={() => handleOpenScoreModal(m)}
              className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
                m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black hover:bg-[#58e094]' : 'bg-[#FFE600] text-black hover:bg-yellow-400'
              }`}
            >
              {m.status === 'COMPLETED' ? 'Edit Score' : 'Record Score'}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* 1. BRACKET HEADER & VIEW CONTROLS */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Trophy className="w-6 h-6 text-[#7C3AED]" />
          </div>
          <div>
            <h3 className="font-sans font-black text-lg uppercase text-black">
              SINGLE ELIMINATION KNOCKOUT
            </h3>
            <p className="text-[11px] text-stone-600 font-bold">
              {stage?.name || 'Playoffs'} • Knockout Bracket • Series {stage?.defaultSeriesFormat || 'BO3'} (Finals {stage?.grandFinalSeriesFormat || 'BO5'})
            </p>
          </div>
        </div>

        {/* Legend & Zoom */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase text-stone-600 border-r-2 border-black pr-4">
            <span className="flex items-center gap-1 text-emerald-800">
              <span className="w-2.5 h-2.5 bg-emerald-500 inline-block border border-black" />
              Winner / Advances
            </span>
            <span className="flex items-center gap-1 text-rose-800">
              <span className="w-2.5 h-2.5 bg-rose-500 inline-block border border-black" />
              Eliminated
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-black font-black text-[10px] cursor-pointer"
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
            VICTORIOUS
          </span>
        </div>
      )}

      {/* 2. BRACKET CANVAS WITH STEPPED CONNECTOR LINES */}
      <div 
        className="bg-[#FAFAF9] border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] overflow-x-auto"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
      >
        <div className="flex items-center gap-6 min-w-max py-4">
          {/* Quarterfinals */}
          {quarterfinals.length > 0 && (
            <div className="space-y-6">
              <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                Quarterfinals ({stage?.defaultSeriesFormat || 'BO3'})
              </span>
              <div className="space-y-6">
                {quarterfinals.map((m, idx) => (
                  <div key={m.id}>
                    {renderMatchCard(m, `Quarterfinal ${idx + 1}`)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SVG Connectors: Quarterfinals -> Semifinals */}
          {quarterfinals.length > 0 && semifinals.length > 0 && (
            <div className="flex flex-col justify-around h-full py-8 w-10">
              <svg className="w-10 h-72" viewBox="0 0 40 288" fill="none">
                {/* Upper pair connector */}
                <path d="M 0 36 H 20 V 72 H 40" stroke="#000" strokeWidth="2.5" />
                <path d="M 0 108 H 20 V 72 H 40" stroke="#000" strokeWidth="2.5" />
                {/* Lower pair connector */}
                <path d="M 0 180 H 20 V 216 H 40" stroke="#000" strokeWidth="2.5" />
                <path d="M 0 252 H 20 V 216 H 40" stroke="#000" strokeWidth="2.5" />
              </svg>
            </div>
          )}

          {/* Semifinals */}
          {semifinals.length > 0 && (
            <div className="space-y-6">
              <span className="font-black uppercase text-[10px] text-stone-500 block border-b border-black pb-1">
                Semifinals ({stage?.defaultSeriesFormat || 'BO3'})
              </span>
              <div className="space-y-12 pt-4">
                {semifinals.map((m, idx) => (
                  <div key={m.id}>
                    {renderMatchCard(m, `Semifinal ${idx + 1}`)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SVG Connector: Semifinals -> Grand Final */}
          {semifinals.length > 0 && grandFinal && (
            <div className="flex flex-col justify-center h-full w-10">
              <svg className="w-10 h-64" viewBox="0 0 40 256" fill="none">
                <path d="M 0 64 H 20 V 128 H 40" stroke="#000" strokeWidth="2.5" />
                <path d="M 0 192 H 20 V 128 H 40" stroke="#000" strokeWidth="2.5" />
              </svg>
            </div>
          )}

          {/* Grand Final */}
          {grandFinal && (
            <div className="space-y-6 pl-2">
              <span className="font-black uppercase text-[10px] text-amber-700 block border-b border-black pb-1">
                Championship Grand Final ({stage?.grandFinalSeriesFormat || 'BO5'})
              </span>
              <div className="pt-8">
                {renderMatchCard(grandFinal, 'GRAND FINAL')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. AUTHORITATIVE SCORING MODAL */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div>
                <h3 className="font-sans font-black text-base uppercase text-black">
                  Record Match Score
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
                    <span className="text-[10px] font-bold text-stone-500">Wins:</span>
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={scoreA}
                      onChange={e => setScoreA(Number(e.target.value))}
                      className="w-16 border-2 border-black p-1 text-center font-black text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-stone-200 pt-2">
                  <span className="font-black text-black text-sm truncate max-w-[180px]">
                    {scoringMatch.teamB?.name || 'Team B'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-500">Wins:</span>
                    <input
                      type="number"
                      min="0"
                      max="4"
                      value={scoreB}
                      onChange={e => setScoreB(Number(e.target.value))}
                      className="w-16 border-2 border-black p-1 text-center font-black text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {mutationStatus === 'pending' && (
                <div className="p-2 bg-[#FFFBEB] border-2 border-amber-900 text-amber-900 font-bold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting score to authoritative server...</span>
                </div>
              )}

              {mutationStatus === 'confirmed' && (
                <div className="p-2 bg-[#E6FFFA] border-2 border-emerald-900 text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>✓ Score confirmed &amp; bracket advanced!</span>
                </div>
              )}

              {mutationStatus === 'failed' && (
                <div className="p-2 bg-rose-50 border-2 border-rose-900 text-rose-900 font-bold space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    <span>Submission Rejected</span>
                  </div>
                  <div className="text-[10px] leading-tight">
                    {mutationError || 'Server rejected match result confirmation.'}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t-2 border-black flex items-center justify-between gap-2">
              <span className="text-[9px] text-stone-500 uppercase">
                Authoritative Submission
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={mutationStatus === 'pending'}
                  onClick={() => setScoringMatch(null)}
                  className="px-3 py-1.5 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={mutationStatus === 'pending'}
                  onClick={handleSubmitScore}
                  className="px-4 py-1.5 bg-[#FFE600] hover:bg-yellow-400 disabled:opacity-50 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Confirm Official Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
