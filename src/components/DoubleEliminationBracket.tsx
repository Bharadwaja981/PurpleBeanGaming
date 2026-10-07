import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Swords, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2, 
  Shield, 
  CheckCircle2,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { dotaCompetitionEngine, CompetitionMatchNode, TournamentStageConfig } from '../domain/dotaCompetitionEngine';

interface DoubleEliminationBracketProps {
  tournamentId: string;
  stageConfig?: TournamentStageConfig;
  onSelectMatch?: (matchId: string) => void;
}

export const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({
  tournamentId,
  stageConfig,
  onSelectMatch
}) => {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [searchFilter, setSearchFilter] = useState('');

  // Fetch or derive matches for this tournament/stage
  const stage = useMemo(() => {
    if (stageConfig) return stageConfig;
    const structure = dotaCompetitionEngine.getStructure(tournamentId);
    return structure?.stages.find(s => s.type === 'DOUBLE_ELIMINATION' || s.type === 'SINGLE_ELIMINATION') || structure?.stages[0];
  }, [stageConfig, tournamentId]);

  const matches: CompetitionMatchNode[] = useMemo(() => {
    if (stage?.matches && stage.matches.length > 0) return stage.matches;
    return tournamentService.getMatches().filter(m => m.tournamentId === tournamentId);
  }, [stage, tournamentId]);

  // Upper Bracket matches grouped by round
  const upperQuarterfinals = useMemo(() => {
    return matches.filter(m => m.roundKey === 'UB_QF' || m.round?.toLowerCase().includes('quarterfinal'));
  }, [matches]);

  const upperSemifinals = useMemo(() => {
    return matches.filter(m => m.roundKey?.includes('UB_SF') || (m.round?.toLowerCase().includes('semifinal') && m.bracketType === 'upper'));
  }, [matches]);

  const upperFinal = useMemo(() => {
    return matches.find(m => m.roundKey === 'UB_FINAL' || (m.round?.toLowerCase().includes('upper final')));
  }, [matches]);

  // Lower Bracket matches grouped by round
  const lowerRound1 = useMemo(() => {
    return matches.filter(m => m.roundKey?.includes('LB_R1') || m.round?.toLowerCase().includes('lower round 1'));
  }, [matches]);

  const lowerRound2 = useMemo(() => {
    return matches.filter(m => m.roundKey?.includes('LB_R2') || m.round?.toLowerCase().includes('lower round 2'));
  }, [matches]);

  const lowerSemifinal = useMemo(() => {
    return matches.find(m => m.roundKey === 'LB_SF' || m.round?.toLowerCase().includes('lower semifinal'));
  }, [matches]);

  const lowerFinal = useMemo(() => {
    return matches.find(m => m.roundKey === 'LB_FINAL' || m.round?.toLowerCase().includes('lower final'));
  }, [matches]);

  // Grand Final
  const grandFinal = useMemo(() => {
    return matches.find(m => m.roundKey === 'GRAND_FINAL' || m.round?.toLowerCase().includes('grand final'));
  }, [matches]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(140, prev + 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(70, prev - 10));
  const handleResetZoom = () => setZoomLevel(100);

  // Match Card Component
  const renderMatchCard = (m: CompetitionMatchNode, roundTitle: string, isUpper = true) => {
    if (!m) return null;
    const isSearchMatch = searchFilter && (
      m.teamA?.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      m.teamB?.name?.toLowerCase().includes(searchFilter.toLowerCase())
    );

    return (
      <div
        key={m.id}
        onClick={() => onSelectMatch?.(m.id)}
        className={`w-64 border-2 border-black p-3 bg-white hover:bg-stone-50 cursor-pointer shadow-[3px_3px_0px_0px_#000] space-y-2 transition-all relative ${
          isSearchMatch ? 'ring-2 ring-[#FFE600]' : ''
        }`}
      >
        <div className="flex items-center justify-between text-[10px] font-bold border-b border-black/10 pb-1">
          <span className="text-[#7C3AED] uppercase">{roundTitle}</span>
          <span className="bg-stone-100 border border-black px-1.5 py-0.2 uppercase text-stone-700 font-bold">
            {m.status || 'UPCOMING'}
          </span>
        </div>

        {/* Team A */}
        <div className="flex items-center justify-between text-xs font-bold py-0.5">
          <div className="flex items-center gap-1.5 truncate">
            {m.teamA?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black">
                #{m.teamA.seed}
              </span>
            ) : null}
            <span className="text-sm">{m.teamA?.logo || '🛡️'}</span>
            <span className="truncate">{m.teamA?.name || 'TBD'}</span>
          </div>
          <span className="bg-stone-100 border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center">
            {m.scores?.teamA ?? 0}
          </span>
        </div>

        {/* Team B */}
        <div className="flex items-center justify-between text-xs font-bold py-0.5">
          <div className="flex items-center gap-1.5 truncate">
            {m.teamB?.seed ? (
              <span className="bg-[#7C3AED] text-white text-[9px] px-1 py-0.2 border border-black font-black">
                #{m.teamB.seed}
              </span>
            ) : null}
            <span className="text-sm">{m.teamB?.logo || '🛡️'}</span>
            <span className="truncate">{m.teamB?.name || 'TBD'}</span>
          </div>
          <span className="bg-stone-100 border border-black px-1.5 py-0.2 font-black text-xs min-w-[20px] text-center">
            {m.scores?.teamB ?? 0}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* 1. BRACKET HEADER & VIEW CONTROLS (Matching Reference Image 5) */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Trophy className="w-6 h-6 text-[#7C3AED]" />
          </div>
          <div>
            <h3 className="font-sans font-black text-lg uppercase text-black">
              TOURNAMENT BRACKET
            </h3>
            <p className="text-[11px] text-stone-600 font-bold">
              {stage?.type?.replace('_', ' ') || 'Double Elimination'} • {stage?.teamCount || 8} Teams • All Matches Best of {stage?.defaultSeriesFormat?.replace('BO', '') || '3'} (Grand Final {stage?.grandFinalSeriesFormat || 'BO5'})
            </p>
          </div>
        </div>

        {/* Legend & Zoom Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 text-[10px] font-black uppercase text-stone-600 border-r-2 border-black pr-4">
            <span className="flex items-center gap-1 text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Winner / Advances
            </span>
            <span className="flex items-center gap-1 text-rose-800">
              <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
              Loser / Drops to LB
            </span>
            <span className="flex items-center gap-1 text-[#7C3AED]">
              <span className="w-3 h-0.5 bg-[#7C3AED] inline-block" />
              Upper Progression
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-3 h-0.5 border-t border-dashed border-amber-600 inline-block" />
              Lower Progression
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

      {/* 2. BRACKET CANVAS CONTAINER */}
      <div 
        className="bg-[#FAFAF9] border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] overflow-x-auto space-y-12"
        style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top left' }}
      >
        {/* UPPER BRACKET SECTION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-black pb-2">
            <span className="bg-[#7C3AED] text-white p-1 border border-black font-black text-[10px]">UB</span>
            <h4 className="font-sans font-black text-base uppercase text-[#7C3AED]">
              UPPER BRACKET (WINNERS)
            </h4>
          </div>

          <div className="flex items-start gap-12 pt-2">
            {/* Column 1: Upper Quarterfinals */}
            {upperQuarterfinals.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Upper Quarterfinals (BO3)
                </span>
                <div className="space-y-4">
                  {upperQuarterfinals.map((m, idx) => renderMatchCard(m, `UB QF ${idx + 1}`))}
                </div>
              </div>
            )}

            {/* Column 2: Upper Semifinals */}
            {upperSemifinals.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Upper Semifinals (BO3)
                </span>
                <div className="space-y-8 pt-4">
                  {upperSemifinals.map((m, idx) => renderMatchCard(m, `UB SF ${idx + 1}`))}
                </div>
              </div>
            )}

            {/* Column 3: Upper Final */}
            {upperFinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Upper Final (BO3)
                </span>
                <div className="pt-12">
                  {renderMatchCard(upperFinal, 'UB FINAL')}
                </div>
              </div>
            )}

            {/* Column 4: Championship Grand Final */}
            {grandFinal && (
              <div className="space-y-6 pl-4 border-l-2 border-dashed border-stone-300">
                <span className="font-black uppercase text-[10px] text-amber-700 block">
                  Grand Final (BO5)
                </span>
                <div className="pt-12">
                  {renderMatchCard(grandFinal, 'CHAMPIONSHIP FINAL')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LOWER BRACKET SECTION */}
        <div className="space-y-4 pt-6 border-t-2 border-black">
          <div className="flex items-center gap-2 border-b-2 border-black pb-2">
            <span className="bg-amber-600 text-white p-1 border border-black font-black text-[10px]">LB</span>
            <h4 className="font-sans font-black text-base uppercase text-amber-800">
              LOWER BRACKET (ELIMINATION)
            </h4>
          </div>

          <div className="flex items-start gap-12 pt-2">
            {/* Column 1: Lower Round 1 */}
            {lowerRound1.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Lower Round 1 (BO3)
                </span>
                <div className="space-y-4">
                  {lowerRound1.map((m, idx) => renderMatchCard(m, `LB R1 - M${idx + 1}`, false))}
                </div>
              </div>
            )}

            {/* Column 2: Lower Round 2 */}
            {lowerRound2.length > 0 && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Lower Round 2 (BO3)
                </span>
                <div className="space-y-4 pt-2">
                  {lowerRound2.map((m, idx) => renderMatchCard(m, `LB R2 - M${idx + 1}`, false))}
                </div>
              </div>
            )}

            {/* Column 3: Lower Semifinal */}
            {lowerSemifinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Lower Semifinal (BO3)
                </span>
                <div className="pt-6">
                  {renderMatchCard(lowerSemifinal, 'LB SEMIFINAL', false)}
                </div>
              </div>
            )}

            {/* Column 4: Lower Final */}
            {lowerFinal && (
              <div className="space-y-6">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Lower Final (BO3)
                </span>
                <div className="pt-6">
                  {renderMatchCard(lowerFinal, 'LB FINAL', false)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
