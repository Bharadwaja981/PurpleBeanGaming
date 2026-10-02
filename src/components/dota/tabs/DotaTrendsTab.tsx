import React, { useState, useMemo } from 'react';
import { ArrowTrendingUpIcon } from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';

interface DotaTrendsTabProps {
  timeframe: '30d' | '90d' | '6m' | '1y' | 'all';
  onTimeframeChange: (tf: '30d' | '90d' | '6m' | '1y' | 'all') => void;
  matches?: OpenDotaPlayerSummary['recentMatches'];
}

type TrendMetric = 'winrate' | 'kda' | 'gpm' | 'xpm' | 'lasthits' | 'damage';

export function DotaTrendsTab({
  timeframe,
  onTimeframeChange,
  matches = []
}: DotaTrendsTabProps) {
  const [metric, setMetric] = useState<TrendMetric>('kda');

  // Compute real historical trajectory from chronologically ordered matches
  const trendData = useMemo(() => {
    if (matches.length === 0) return [];

    // Chronological order (oldest to newest)
    const sorted = [...matches].reverse();

    let rollingWins = 0;
    const points: Array<{ index: number; heroName: string; matchId: string; value: number }> = [];

    sorted.forEach((m, idx) => {
      let val = 0;
      if (metric === 'winrate') {
        if (m.playerWon) rollingWins++;
        val = Math.round((rollingWins / (idx + 1)) * 100);
      } else if (metric === 'kda') {
        val = Math.round(((m.kills + m.assists) / Math.max(1, m.deaths)) * 10) / 10;
      } else if (metric === 'gpm') {
        val = m.gpm || 0;
      } else if (metric === 'xpm') {
        val = m.xpm || 0;
      } else if (metric === 'lasthits') {
        val = m.lastHits || 0;
      } else if (metric === 'damage') {
        val = m.heroDamage || 0;
      }

      points.push({
        index: idx + 1,
        heroName: m.heroName,
        matchId: m.matchId,
        value: val
      });
    });

    return points;
  }, [matches, metric]);

  const minVal = trendData.length > 0 ? Math.min(...trendData.map((p) => p.value)) : 0;
  const maxVal = trendData.length > 0 ? Math.max(...trendData.map((p) => p.value)) : 100;
  const range = maxVal - minVal || 1;

  // Build SVG path
  const svgWidth = 800;
  const svgHeight = 220;
  const padding = 20;

  const pathD = useMemo(() => {
    if (trendData.length < 2) return '';
    return trendData.reduce((acc, p, i) => {
      const x = padding + (i / (trendData.length - 1)) * (svgWidth - padding * 2);
      const y = svgHeight - padding - ((p.value - minVal) / range) * (svgHeight - padding * 2);
      return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }, '');
  }, [trendData, minVal, range]);

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            HISTORICAL TRAJECTORY ENGINE (DERIVED FROM MATCH SEQUENCE)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Performance Trends &amp; Momentum
          </h3>
        </div>

        {/* Timeframe Buttons */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 border-2 border-black">
          {(['30d', '90d', '6m', '1y', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 text-xs font-black uppercase cursor-pointer transition-all ${
                timeframe === tf ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'hover:bg-white text-stone-700'
              }`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'kda', label: 'KDA Ratio' },
            { id: 'winrate', label: 'Rolling Win Rate' },
            { id: 'gpm', label: 'Gold / Min (GPM)' },
            { id: 'xpm', label: 'XP / Min (XPM)' },
            { id: 'lasthits', label: 'Last Hits' },
            { id: 'damage', label: 'Hero Damage' }
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setMetric(m.id)}
            className={`px-3 py-1.5 text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
              metric === m.id
                ? 'bg-black text-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600] -translate-y-0.5'
                : 'bg-white text-stone-800 hover:bg-stone-100 shadow-[2px_2px_0px_0px_#000]'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {trendData.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <ArrowTrendingUpIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No match history available to plot trends.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota returned no historical matches for this account to compute trend momentum.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* SVG Trend Line */}
          <div className="bg-stone-50 border-2 border-black p-4 shadow-[3px_3px_0px_0px_#000] relative">
            <div className="flex items-center justify-between text-xs font-bold text-stone-600 mb-2">
              <span>{metric.toUpperCase()} Momentum ({trendData.length} Matches Sampled)</span>
              <span>
                Range: <strong className="text-black">{minVal}</strong> to <strong className="text-purple-700">{maxVal}</strong>
              </span>
            </div>

            <div className="w-full overflow-x-auto">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-48 bg-white border border-black/30">
                {/* Horizontal reference grid lines */}
                <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#e5e7eb" strokeDasharray="4" />
                <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="#e5e7eb" strokeDasharray="4" />
                <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#e5e7eb" strokeDasharray="4" />

                {/* Trend Polyline */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#7C3AED"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data points */}
                {trendData.map((pt, i) => {
                  const x = padding + (i / Math.max(1, trendData.length - 1)) * (svgWidth - padding * 2);
                  const y = svgHeight - padding - ((pt.value - minVal) / range) * (svgHeight - padding * 2);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#FFE600"
                      stroke="#000"
                      strokeWidth="2"
                      className="cursor-pointer hover:r-6 transition-all"
                    >
                      <title>{`Match #${pt.matchId} (${pt.heroName}): ${pt.value}`}</title>
                    </circle>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] text-stone-500 pt-2">
              <span>Chronological sequence (Earliest → Latest)</span>
              <span>Hover over markers for individual match values</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
