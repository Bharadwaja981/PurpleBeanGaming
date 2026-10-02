import React from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { OpenDotaHistogramItem } from '../../../services/openDotaService';

interface DotaHistogramsTabProps {
  histograms: OpenDotaHistogramItem[];
  currentField: string;
  onFieldChange: (field: string) => void;
  isLoading?: boolean;
}

export function DotaHistogramsTab({
  histograms,
  currentField,
  onFieldChange,
  isLoading
}: DotaHistogramsTabProps) {
  const fields = [
    { id: 'kills', label: 'Kills' },
    { id: 'deaths', label: 'Deaths' },
    { id: 'assists', label: 'Assists' },
    { id: 'gold_per_min', label: 'Gold / Min (GPM)' },
    { id: 'xp_per_min', label: 'XP / Min (XPM)' },
    { id: 'last_hits', label: 'Last Hits' },
    { id: 'hero_damage', label: 'Hero Damage' },
    { id: 'tower_damage', label: 'Tower Damage' },
    { id: 'duration', label: 'Duration' }
  ];

  const maxGames = histograms.length > 0 ? Math.max(...histograms.map((d) => d.games), 1) : 1;
  const totalHistogramGames = histograms.reduce((acc, d) => acc + d.games, 0);

  return (
    <div className="bg-white border-[3px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            FREQUENCY &amp; CORRELATION DISTRIBUTIONS (GET /players/&#123;account_id&#125;/histograms/&#123;field&#125;)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Histograms &amp; Win Probability
          </h3>
        </div>

        {/* Metric Selector Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-stone-600">Metric:</label>
          <select
            value={currentField}
            onChange={(e) => onFieldChange(e.target.value)}
            className="bg-stone-50 border-2 border-black px-3 py-1.5 text-xs font-mono font-bold cursor-pointer"
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading {currentField} histogram telemetry...</p>
        </div>
      ) : histograms.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <ChartBarIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No histogram data available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota returned no histogram bins for field "{currentField}" for this player.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-stone-600">
            <span>Bucket Value ({currentField.toUpperCase()})</span>
            <span>{totalHistogramGames} Sampled Matches</span>
          </div>

          <div className="space-y-2">
            {histograms.map((item, idx) => {
              const heightPct = Math.round((item.games / maxGames) * 100);
              const winRate = item.games > 0 ? Math.round((item.win / item.games) * 100) : 0;

              return (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <span className="w-12 text-right font-black text-stone-700 shrink-0">
                    {item.x}
                  </span>

                  <div className="flex-1 bg-stone-100 border border-black h-6 relative overflow-hidden flex items-center">
                    <div
                      className="bg-[#7C3AED] h-full transition-all"
                      style={{ width: `${heightPct}%` }}
                    />
                    <div
                      className="bg-[#38EF7D] h-full absolute top-0 left-0 opacity-80"
                      style={{ width: `${(heightPct * winRate) / 100}%` }}
                    />
                    <span className="absolute left-2 text-[10px] font-black text-black z-10">
                      {item.games} Matches ({item.win}W - {item.games - item.win}L)
                    </span>
                  </div>

                  <span className="w-16 font-black text-emerald-700 text-right shrink-0">
                    {winRate}% WR
                  </span>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-stone-50 border border-black flex items-center justify-between text-[11px] text-stone-600">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#7C3AED] border border-black inline-block" />
                <span>Total Matches in Bucket</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-[#38EF7D] border border-black inline-block" />
                <span>Wins in Bucket</span>
              </span>
            </div>
            <span>Bin interval determined by OpenDota core engine</span>
          </div>
        </div>
      )}
    </div>
  );
}
