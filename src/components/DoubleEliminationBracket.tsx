import React, { useState, useEffect } from 'react';
import { Trophy, Swords, Info, Eye, MapPin, ArrowRight, CornerDownRight, CheckCircle2 } from 'lucide-react';
import { dotaCompetitionEngine, CompetitionMatchNode, CompetitionStructureState } from '../domain/dotaCompetitionEngine';
import { BracketNode } from '../types/tournament';

interface DoubleEliminationBracketProps {
  tournamentId?: string;
  onSelectMatch?: (matchId: string) => void;
}

export function DoubleEliminationBracket({ 
  tournamentId = 'india-dota-open-2026', 
  onSelectMatch 
}: DoubleEliminationBracketProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'upper' | 'lower'>('all');
  const [highlightedMatchId, setHighlightedMatchId] = useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [connectors, setConnectors] = useState<Array<{
    id: string;
    fromMatchId: string;
    toMatchId: string;
    toSlot?: string;
    isDotted: boolean;
    pathD: string;
  }>>([]);

  // Sync with dotaCompetitionEngine
  const [structure, setStructure] = useState<CompetitionStructureState | undefined>(() => 
    dotaCompetitionEngine.getStructure(tournamentId)
  );

  useEffect(() => {
    const handleSync = () => {
      setStructure(dotaCompetitionEngine.getStructure(tournamentId));
    };
    handleSync();
    return dotaCompetitionEngine.subscribe(handleSync);
  }, [tournamentId]);

  // Recalculate SVG connectors dynamically
  useEffect(() => {
    const computePaths = () => {
      if (!containerRef.current || !structure || structure.matches.length === 0) return;
      const container = containerRef.current;
      const cRect = container.getBoundingClientRect();
      const newConnectors: Array<{
        id: string;
        fromMatchId: string;
        toMatchId: string;
        toSlot?: string;
        isDotted: boolean;
        pathD: string;
      }> = [];

      for (const match of structure.matches) {
        const fromElem = document.getElementById(`bracket-node-${match.id}`);
        if (!fromElem) continue;
        const fRect = fromElem.getBoundingClientRect();

        // 1. Winner progression connector (SOLID)
        if (match.winnerNextMatchId) {
          const toElem = document.getElementById(`bracket-node-${match.winnerNextMatchId}`);
          if (toElem) {
            const tRect = toElem.getBoundingClientRect();
            const startX = fRect.right - cRect.left + container.scrollLeft;
            const startY = fRect.top + fRect.height / 2 - cRect.top + container.scrollTop;
            const targetYOffset = match.winnerNextSlot === 'teamB' ? tRect.height * 0.75 : tRect.height * 0.25;
            const endX = tRect.left - cRect.left + container.scrollLeft;
            const endY = tRect.top + targetYOffset - cRect.top + container.scrollTop;

            const midX = (startX + endX) / 2;
            const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
            newConnectors.push({
              id: `${match.id}-win-${match.winnerNextMatchId}`,
              fromMatchId: match.id,
              toMatchId: match.winnerNextMatchId,
              toSlot: match.winnerNextSlot,
              isDotted: false,
              pathD
            });
          }
        }

        // 2. Upper Bracket Loser Drop Path (DOTTED directly to Lower Bracket slot)
        if (match.loserNextMatchId) {
          const toElem = document.getElementById(`bracket-node-${match.loserNextMatchId}`);
          if (toElem) {
            const tRect = toElem.getBoundingClientRect();
            const startX = fRect.right - cRect.left + container.scrollLeft;
            const startY = fRect.top + fRect.height * 0.75 - cRect.top + container.scrollTop;
            const targetYOffset = match.loserNextSlot === 'teamB' ? tRect.height * 0.75 : tRect.height * 0.25;
            const endX = tRect.left - cRect.left + container.scrollLeft;
            const endY = tRect.top + targetYOffset - cRect.top + container.scrollTop;

            // Direct curved path routing down to lower bracket slot
            const ctrlX1 = startX + 50;
            const ctrlY1 = startY;
            const ctrlX2 = endX - 50;
            const ctrlY2 = endY;
            const pathD = `M ${startX} ${startY} C ${ctrlX1} ${ctrlY1}, ${ctrlX2} ${ctrlY2}, ${endX} ${endY}`;

            newConnectors.push({
              id: `${match.id}-drop-${match.loserNextMatchId}`,
              fromMatchId: match.id,
              toMatchId: match.loserNextMatchId,
              toSlot: match.loserNextSlot,
              isDotted: true,
              pathD
            });
          }
        }
      }

      setConnectors(newConnectors);
    };

    const timer = setTimeout(computePaths, 80);
    window.addEventListener('resize', computePaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computePaths);
    };
  }, [structure, activeTab]);

  const hasEngineMatches = structure && structure.matches.length > 0;

  // Upper Bracket matches from engine or mock
  const ubQuarterfinals = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'ub-r1')
    : [];
  const ubSemifinals = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'ub-r2')
    : [];
  const ubFinal = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'ub-final')
    : [];

  // Lower Bracket matches from engine or mock
  const lbR1 = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'lb-r1')
    : [];
  const lbR2 = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'lb-r2')
    : [];
  const lbSF = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'lb-sf')
    : [];
  const lbFinal = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'lb-final')
    : [];

  // Grand Final
  const grandFinal = hasEngineMatches
    ? structure.matches.filter(m => m.roundKey === 'gf')
    : [];

  // Render a match card from real CompetitionMatchNode
  const renderCompetitionCard = (node: CompetitionMatchNode, isLower = false) => {
    const isHighlighted = highlightedMatchId === node.id;
    const isWinnerA = node.winnerId ? node.winnerId === node.teamA.teamId : (node.status === 'COMPLETED' && node.teamA.score > node.teamB.score);
    const isWinnerB = node.winnerId ? node.winnerId === node.teamB.teamId : (node.status === 'COMPLETED' && node.teamB.score > node.teamA.score);

    return (
      <div
        key={node.id}
        id={`bracket-node-${node.id}`}
        onMouseEnter={() => setHighlightedMatchId(node.id)}
        onMouseLeave={() => setHighlightedMatchId(null)}
        onClick={() => onSelectMatch && onSelectMatch(node.id)}
        className={`w-64 bg-white border-[2.5px] border-black transition-all cursor-pointer select-none relative ${
          isHighlighted
            ? 'shadow-[6px_6px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5 bg-[#FFFDE8] ring-2 ring-black'
            : 'shadow-[3px_3px_0px_0px_#000] hover:shadow-[5px_5px_0px_0px_#000]'
        }`}
      >
        {/* Match Header Tag */}
        <div className="bg-[#E2E8F0] border-b-2 border-black px-2.5 py-1 flex items-center justify-between font-mono text-[10px] font-black text-black">
          <span className="truncate">{node.roundTitle}</span>
          <div className="flex items-center gap-1.5">
            <span className="bg-black text-[#FFE600] px-1 py-0.2 text-[9px] font-bold">
              {node.seriesFormat}
            </span>
            {node.status === 'LIVE' ? (
              <span className="bg-[#FF5757] text-white px-1.5 py-0.2 animate-pulse text-[9px]">LIVE</span>
            ) : node.status === 'COMPLETED' ? (
              <span className="text-stone-700 text-[9px]">FINAL</span>
            ) : (
              <span className="text-stone-500 text-[9px]">UPCOMING</span>
            )}
          </div>
        </div>

        {/* Team A Row */}
        <div className={`flex items-center justify-between px-2.5 py-2 border-b border-black font-mono text-xs ${
          isWinnerA ? 'bg-[#FFE600]/25 font-black text-black' : 'text-stone-700'
        }`}>
          <div className="flex items-center gap-1.5 truncate">
            {node.teamA.seed !== undefined && (
              <span className="text-[10px] text-stone-500 font-bold">[{node.teamA.seed}]</span>
            )}
            <span className="text-base">{node.teamA.logo || '🛡️'}</span>
            <div className="truncate">
              <span className="truncate block leading-tight font-bold">{node.teamA.name}</span>
              {node.teamA.sourceLabel && !node.teamA.teamId && (
                <span className="text-[9px] text-stone-400 font-normal">{node.teamA.sourceLabel}</span>
              )}
            </div>
          </div>
          <span className={`w-5 h-5 flex items-center justify-center border border-black font-mono text-xs font-black ${
            isWinnerA ? 'bg-black text-white' : 'bg-stone-100 text-stone-800'
          }`}>
            {node.teamA.score}
          </span>
        </div>

        {/* Team B Row */}
        <div className={`flex items-center justify-between px-2.5 py-2 font-mono text-xs ${
          isWinnerB ? 'bg-[#FFE600]/25 font-black text-black' : 'text-stone-700'
        }`}>
          <div className="flex items-center gap-1.5 truncate">
            {node.teamB.seed !== undefined && (
              <span className="text-[10px] text-stone-500 font-bold">[{node.teamB.seed}]</span>
            )}
            <span className="text-base">{node.teamB.logo || '🛡️'}</span>
            <div className="truncate">
              <span className="truncate block leading-tight font-bold">{node.teamB.name}</span>
              {node.teamB.sourceLabel && !node.teamB.teamId && (
                <span className="text-[9px] text-stone-400 font-normal">{node.teamB.sourceLabel}</span>
              )}
            </div>
          </div>
          <span className={`w-5 h-5 flex items-center justify-center border border-black font-mono text-xs font-black ${
            isWinnerB ? 'bg-black text-white' : 'bg-stone-100 text-stone-800'
          }`}>
            {node.teamB.score}
          </span>
        </div>

        {/* Winner / Loser Drop Routing Footer */}
        {node.loserDestinationLabel && (
          <div className="bg-[#FFF4E5] border-t border-dashed border-stone-400 px-2 py-0.5 text-[9px] font-mono font-bold text-red-700 flex items-center justify-between">
            <span className="truncate">⤓ Drop to: {node.loserDestinationLabel}</span>
            <span className="text-[8px] bg-red-100 border border-red-600 text-red-800 px-1 font-black">
              DOTTED
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6 font-mono">
      {/* Visual Progression Legend */}
      <div className="bg-white border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FFE600] border-2 border-black">
            <Swords className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase text-black font-sans">
              DOUBLE ELIMINATION PROGRESSION GRAPH
            </h3>
            <p className="text-[11px] text-stone-600">
              Horizontal scroll enabled. Explicit routing connectors between Upper Bracket drops and Lower Bracket survival slots.
            </p>
          </div>
        </div>

        {/* Connector Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-2 bg-stone-50 border-2 border-black px-2.5 py-1">
            <span className="w-6 h-0.5 bg-black inline-block" />
            <span className="font-bold text-black text-[10px] uppercase">Solid Line: Winner Progression</span>
          </div>
          <div className="flex items-center gap-2 bg-red-50 border-2 border-red-500 px-2.5 py-1 text-red-700">
            <span className="w-6 border-t-2 border-dashed border-red-600 inline-block" />
            <span className="font-black text-[10px] uppercase">Dotted Line: Upper Loser Drop Path</span>
          </div>
          <div className="flex gap-1 border-2 border-black p-0.5 bg-stone-100">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2 py-0.5 text-[10px] font-black uppercase cursor-pointer ${
                activeTab === 'all' ? 'bg-[#FFE600] text-black border border-black' : 'text-stone-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('upper')}
              className={`px-2 py-0.5 text-[10px] font-black uppercase cursor-pointer ${
                activeTab === 'upper' ? 'bg-[#FFE600] text-black border border-black' : 'text-stone-600'
              }`}
            >
              Upper
            </button>
            <button
              onClick={() => setActiveTab('lower')}
              className={`px-2 py-0.5 text-[10px] font-black uppercase cursor-pointer ${
                activeTab === 'lower' ? 'bg-[#FFE600] text-black border border-black' : 'text-stone-600'
              }`}
            >
              Lower
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrolling Bracket Canvas */}
      <div 
        ref={containerRef}
        className="overflow-x-auto pb-6 border-[3px] border-black bg-stone-100 p-6 shadow-[6px_6px_0px_0px_#000] relative"
      >
        <div className="min-w-[1100px] space-y-12 relative">
          {/* Dynamic Progression SVG Connector Layer */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10 overflow-visible">
            <defs>
              <marker id="arrow-solid" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#000" />
              </marker>
              <marker id="arrow-dotted" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 1 L 8 5 L 0 9 z" fill="#DC2626" />
              </marker>
            </defs>
            {connectors.map((c) => {
              const isRelevant = !highlightedMatchId || highlightedMatchId === c.fromMatchId || highlightedMatchId === c.toMatchId;
              const isHovered = highlightedMatchId && (highlightedMatchId === c.fromMatchId || highlightedMatchId === c.toMatchId);

              return (
                <path
                  key={c.id}
                  d={c.pathD}
                  stroke={c.isDotted ? '#DC2626' : '#000000'}
                  strokeWidth={isHovered ? 4 : (c.isDotted ? 2.5 : 2.5)}
                  strokeDasharray={c.isDotted ? '5 5' : undefined}
                  fill="none"
                  markerEnd={c.isDotted ? 'url(#arrow-dotted)' : 'url(#arrow-solid)'}
                  opacity={highlightedMatchId ? (isRelevant ? 1 : 0.2) : 0.85}
                  className="transition-all duration-150"
                />
              );
            })}
          </svg>
          {/* ============================================================ */}
          {/* UPPER BRACKET SECTION */}
          {/* ============================================================ */}
          {(activeTab === 'all' || activeTab === 'upper') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-[#FFE600] border-[2.5px] border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] max-w-xs">
                <Trophy className="w-4 h-4 text-black" />
                <span>UPPER BRACKET (CHAMPIONSHIP PATH)</span>
              </div>

              <div className="grid grid-cols-3 gap-12 items-start relative">
                {/* UB Round 1 (Quarterfinals) */}
                <div className="space-y-6">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>Upper Quarterfinals (BO3)</span>
                    <span className="text-stone-400">4 Matches</span>
                  </div>
                  <div className="space-y-6">
                    {ubQuarterfinals.map((node) => (
                      <div key={node.id} className="relative">
                        {renderCompetitionCard(node)}
                        {/* Winner Connector Out */}
                        <div className="hidden lg:block absolute right-0 top-1/2 w-8 border-t-2 border-black translate-x-full" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* UB Round 2 (Semifinals) */}
                <div className="space-y-6 pt-12">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>Upper Semifinals (BO3)</span>
                    <span className="text-stone-400">2 Matches</span>
                  </div>
                  <div className="space-y-24">
                    {ubSemifinals.map((node) => (
                      <div key={node.id} className="relative">
                        {renderCompetitionCard(node)}
                        {/* Winner Connector Out */}
                        <div className="hidden lg:block absolute right-0 top-1/2 w-8 border-t-2 border-black translate-x-full" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* UB Round 3 (Upper Final) */}
                <div className="space-y-6 pt-36">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>Upper Bracket Final (BO3)</span>
                    <span className="text-stone-400">1 Match</span>
                  </div>
                  <div>
                    {ubFinal.map((node) => (
                      <div key={node.id} className="relative">
                        {renderCompetitionCard(node)}
                        {/* Winner Connector to GF */}
                        <div className="hidden lg:block absolute right-0 top-1/2 w-8 border-t-2 border-black translate-x-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* LOWER BRACKET SECTION (WITH DOTTED DROP CONNECTORS) */}
          {/* ============================================================ */}
          {(activeTab === 'all' || activeTab === 'lower') && (
            <div className="space-y-4 pt-6 border-t-4 border-black">
              <div className="flex items-center gap-2 bg-[#5CE1E6] border-[2.5px] border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] max-w-xs">
                <Swords className="w-4 h-4 text-black" />
                <span>LOWER BRACKET (SURVIVAL PATH)</span>
              </div>

              <div className="grid grid-cols-4 gap-8 items-start">
                {/* LB Round 1 */}
                <div className="space-y-6">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>LB Round 1 (BO3)</span>
                    <span className="text-red-700 font-bold">2 Matches</span>
                  </div>
                  <div className="space-y-8">
                    {lbR1.map((node, idx) => (
                      <div key={node.id} className="relative">
                        {/* Dotted indicator card showing connection from UB QF */}
                        <div className="mb-1 text-[9px] font-mono font-bold text-red-700 bg-red-50 border border-dashed border-red-500 px-2 py-0.5 flex items-center gap-1.5">
                          <span className="w-3 border-t-2 border-dashed border-red-600 inline-block" />
                          <span>Dotted drop from UB QF {idx === 0 ? '1 & 2' : '3 & 4'}</span>
                        </div>
                        {renderCompetitionCard(node, true)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* LB Round 2 */}
                <div className="space-y-6">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>LB Round 2 (BO3)</span>
                    <span className="text-red-700 font-bold">2 Matches</span>
                  </div>
                  <div className="space-y-8">
                    {lbR2.map((node, idx) => (
                      <div key={node.id} className="relative">
                        <div className="mb-1 text-[9px] font-mono font-bold text-red-700 bg-red-50 border border-dashed border-red-500 px-2 py-0.5 flex items-center gap-1.5">
                          <span className="w-3 border-t-2 border-dashed border-red-600 inline-block" />
                          <span>Dotted drop from UB Semifinal {idx + 1}</span>
                        </div>
                        {renderCompetitionCard(node, true)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* LB Round 3 (Lower Semifinal) */}
                <div className="space-y-6">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>Lower Semifinal (BO3)</span>
                    <span className="text-stone-500">1 Match</span>
                  </div>
                  <div className="pt-8">
                    {lbSF.map((node) => (
                      <div key={node.id} className="relative">
                        {renderCompetitionCard(node, true)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* LB Round 4 (Lower Final) */}
                <div className="space-y-6">
                  <div className="font-mono text-[11px] font-black uppercase text-stone-600 border-b-2 border-black pb-1 flex justify-between">
                    <span>Lower Final (BO3)</span>
                    <span className="text-stone-500">1 Match</span>
                  </div>
                  <div className="pt-8">
                    {lbFinal.map((node) => (
                      <div key={node.id} className="relative">
                        <div className="mb-1 text-[9px] font-mono font-bold text-red-700 bg-red-50 border border-dashed border-red-500 px-2 py-0.5 flex items-center gap-1.5">
                          <span className="w-3 border-t-2 border-dashed border-red-600 inline-block" />
                          <span>Dotted drop from Upper Bracket Final</span>
                        </div>
                        {renderCompetitionCard(node, true)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* GRAND FINAL SHOWCASE */}
          {/* ============================================================ */}
          <div className="pt-8 border-t-4 border-black">
            <div className="max-w-xl mx-auto bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 text-center space-y-4">
              <div className="inline-flex items-center gap-2 bg-[#FFE600] border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase">
                <Trophy className="w-4 h-4 text-black" />
                <span>CHAMPIONSHIP DECIDER</span>
              </div>
              <h3 className="text-2xl font-black uppercase text-black font-sans">
                GRAND FINAL (BEST OF 5)
              </h3>
              <p className="text-xs font-mono text-stone-600">
                Upper Final Champion vs Lower Final Champion · Winner takes Championship Title + Prize Pool
              </p>

              {grandFinal.map((node) => (
                <div key={node.id} className="max-w-md mx-auto">
                  {renderCompetitionCard(node)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
