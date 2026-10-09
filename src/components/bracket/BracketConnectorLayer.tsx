import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { CompetitionMatchNode } from '../../domain/dotaCompetitionEngine';

export interface BracketPathDefinition {
  id: string;
  fromMatchId: string;
  toMatchId: string;
  type: 'winner' | 'loser';
  isHighlighted?: boolean;
  isActive?: boolean;
  pathString: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

interface BracketConnectorLayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  matches: CompetitionMatchNode[];
  highlightTeamId?: string | null;
  zoomLevel: number;
  width?: number;
  height?: number;
}

export const BracketConnectorLayer: React.FC<BracketConnectorLayerProps> = ({
  containerRef,
  matches,
  highlightTeamId,
  zoomLevel,
  width,
  height
}) => {
  const [paths, setPaths] = useState<BracketPathDefinition[]>([]);
  const [svgDimensions, setSvgDimensions] = useState<{ w: number; h: number }>({ w: 1000, h: 800 });

  const calculateConnectors = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    // Use full scroll dimensions of the container so lines cover zoomed / scrolled canvas
    const fullWidth = Math.max(container.scrollWidth, containerRect.width, 1200);
    const fullHeight = Math.max(container.scrollHeight, containerRect.height, 800);
    setSvgDimensions({ w: fullWidth, h: fullHeight });

    // Build index of match cards by data-match-id
    const cardElements = container.querySelectorAll<HTMLElement>('[data-match-id]');
    const cardMap = new Map<string, { rect: DOMRect; el: HTMLElement }>();

    cardElements.forEach(el => {
      const matchId = el.getAttribute('data-match-id');
      if (matchId) {
        cardMap.set(matchId, { rect: el.getBoundingClientRect(), el });
      }
    });

    const newPaths: BracketPathDefinition[] = [];

    matches.forEach(m => {
      const sourceCard = cardMap.get(m.id);
      if (!sourceCard) return;

      const sourceRect = sourceCard.rect;
      // Output anchor is the middle-right edge of the source card
      const fromX = sourceRect.right - containerRect.left + scrollLeft;
      const fromY = sourceRect.top + sourceRect.height / 2 - containerRect.top + scrollTop;

      // 1. Winner advancement path
      const winnerTargetId = m.winnerNextMatchId || m.winnerDestinationId;
      if (winnerTargetId && cardMap.has(winnerTargetId)) {
        const targetCard = cardMap.get(winnerTargetId)!;
        const targetRect = targetCard.rect;

        // Input anchor: determine whether this match feeds teamA (top slot) or teamB (bottom slot)
        const isSlotA = m.winnerNextSlot === 'teamA' || m.winnerDestinationSlot === 'teamA';
        const isSlotB = m.winnerNextSlot === 'teamB' || m.winnerDestinationSlot === 'teamB';

        const toX = targetRect.left - containerRect.left + scrollLeft;
        const toY = targetRect.top + 
          (isSlotA ? targetRect.height * 0.32 : isSlotB ? targetRect.height * 0.68 : targetRect.height * 0.5) 
          - containerRect.top + scrollTop;

        // Routing: orthogonal step
        let pathString = '';
        if (toX > fromX) {
          const midX = fromX + Math.max(16, (toX - fromX) * 0.45);
          pathString = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
        } else {
          // Backward / looped routing (e.g. from UB to Grand Final or wrapped layout)
          const stepX = fromX + 16;
          const midY = (fromY + toY) / 2;
          pathString = `M ${fromX} ${fromY} H ${stepX} V ${midY} H ${toX - 16} V ${toY} H ${toX}`;
        }

        const isWinnerPathActive = Boolean(
          highlightTeamId && (
            m.teamA?.teamId === highlightTeamId || 
            m.teamB?.teamId === highlightTeamId ||
            m.winnerId === highlightTeamId
          )
        );

        newPaths.push({
          id: `w-${m.id}-${winnerTargetId}`,
          fromMatchId: m.id,
          toMatchId: winnerTargetId,
          type: 'winner',
          isHighlighted: isWinnerPathActive,
          isActive: m.status === 'COMPLETED' && Boolean(m.winnerId),
          pathString,
          startPoint: { x: fromX, y: fromY },
          endPoint: { x: toX, y: toY }
        });
      }

      // 2. Loser drop path (Upper bracket to Lower bracket)
      const loserTargetId = m.loserNextMatchId || m.loserDestinationId;
      if (loserTargetId && cardMap.has(loserTargetId)) {
        const targetCard = cardMap.get(loserTargetId)!;
        const targetRect = targetCard.rect;

        const isSlotA = m.loserNextSlot === 'teamA' || m.loserDestinationSlot === 'teamA';
        const isSlotB = m.loserNextSlot === 'teamB' || m.loserDestinationSlot === 'teamB';

        const toX = targetRect.left - containerRect.left + scrollLeft;
        const toY = targetRect.top + 
          (isSlotA ? targetRect.height * 0.32 : isSlotB ? targetRect.height * 0.68 : targetRect.height * 0.5) 
          - containerRect.top + scrollTop;

        // Orthogonal drop routing
        let pathString = '';
        if (toX > fromX) {
          const midX = fromX + (toX - fromX) * 0.35;
          pathString = `M ${fromX} ${fromY} H ${midX} V ${toY} H ${toX}`;
        } else {
          // Loser drop descending down vertically
          const dropX = fromX + 20;
          pathString = `M ${fromX} ${fromY} H ${dropX} V ${toY} H ${toX}`;
        }

        const isLoserPathActive = Boolean(
          highlightTeamId && (
            m.loserId === highlightTeamId ||
            (m.teamA?.teamId === highlightTeamId && m.winnerId && m.winnerId !== highlightTeamId) ||
            (m.teamB?.teamId === highlightTeamId && m.winnerId && m.winnerId !== highlightTeamId)
          )
        );

        newPaths.push({
          id: `l-${m.id}-${loserTargetId}`,
          fromMatchId: m.id,
          toMatchId: loserTargetId,
          type: 'loser',
          isHighlighted: isLoserPathActive,
          isActive: m.status === 'COMPLETED' && Boolean(m.loserId),
          pathString,
          startPoint: { x: fromX, y: fromY },
          endPoint: { x: toX, y: toY }
        });
      }
    });

    setPaths(newPaths);
  }, [containerRef, matches, highlightTeamId]);

  // Recalculate on mount, update, resize observer, and animation frame
  useLayoutEffect(() => {
    calculateConnectors();
    const handleResize = () => calculateConnectors();
    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (containerRef.current && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        calculateConnectors();
      });
      observer.observe(containerRef.current);
    }

    const t = setTimeout(calculateConnectors, 100);
    const t2 = setTimeout(calculateConnectors, 400);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) observer.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [calculateConnectors, zoomLevel, matches]);

  return (
    <svg 
      className="absolute inset-0 pointer-events-none z-10 overflow-visible"
      style={{
        width: `${svgDimensions.w}px`,
        height: `${svgDimensions.h}px`,
        minWidth: '100%',
        minHeight: '100%'
      }}
    >
      <defs>
        {/* Winner Arrow Marker (Solid Purple #7C3AED) */}
        <marker
          id="winner-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#7C3AED" />
        </marker>

        {/* Winner Highlighted Marker (Emerald Green #10B981) */}
        <marker
          id="winner-arrow-highlight"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#10B981" />
        </marker>

        {/* Loser Drop Arrow Marker (Rose #F43F5E) */}
        <marker
          id="loser-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#F43F5E" />
        </marker>

        {/* Shadow filter for brutalist punchy lines */}
        <filter id="brutalist-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="1" stdDeviation="0" floodColor="#000" floodOpacity="0.8" />
        </filter>
      </defs>

      {paths.map(p => {
        const isWinner = p.type === 'winner';
        const isHighlighted = p.isHighlighted;
        const hasHighlightActive = Boolean(highlightTeamId);

        let strokeColor = isWinner ? '#7C3AED' : '#F43F5E';
        let strokeWidth = 2.5;
        let opacity = 0.85;

        if (hasHighlightActive) {
          if (isHighlighted) {
            strokeColor = isWinner ? '#10B981' : '#F43F5E';
            strokeWidth = 4;
            opacity = 1;
          } else {
            opacity = 0.2;
            strokeWidth = 1.5;
          }
        } else if (p.isActive) {
          strokeWidth = 2.8;
          opacity = 0.95;
        }

        return (
          <g key={p.id} className="transition-opacity duration-200">
            {/* Outline black shadow path */}
            <path
              d={p.pathString}
              fill="none"
              stroke="#000"
              strokeWidth={strokeWidth + 1.5}
              strokeDasharray={!isWinner ? '5,4' : undefined}
              opacity={opacity * 0.9}
            />

            {/* Foreground path */}
            <path
              d={p.pathString}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeDasharray={!isWinner ? '5,4' : undefined}
              opacity={opacity}
              markerEnd={
                isWinner 
                  ? (isHighlighted ? 'url(#winner-arrow-highlight)' : 'url(#winner-arrow)') 
                  : 'url(#loser-arrow)'
              }
            />

            {/* Anchor origin dot */}
            <circle
              cx={p.startPoint.x}
              cy={p.startPoint.y}
              r={strokeWidth}
              fill={strokeColor}
              stroke="#000"
              strokeWidth="1"
              opacity={opacity}
            />
          </g>
        );
      })}
    </svg>
  );
};
