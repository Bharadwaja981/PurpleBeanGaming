import React from 'react';
import { ChartBarIcon } from '@heroicons/react/24/outline';
import { OpenDotaCounts } from '../../../services/openDotaService';

interface DotaCountsTabProps {
  counts: OpenDotaCounts | null;
  isLoading?: boolean;
}

export function DotaCountsTab({ counts, isLoading }: DotaCountsTabProps) {
  const sections = [
    { title: 'Game Mode Win Rates', data: counts?.game_mode },
    { title: 'Lobby Type Distribution', data: counts?.lobby_type },
    { title: 'Lane Role Performance', data: counts?.lane_role },
    { title: 'Regional Cluster Performance', data: counts?.region },
    { title: 'Faction Favourability (Side)', data: counts?.is_radiant }
  ].filter((s) => s.data && Object.keys(s.data).length > 0);

  return (
    <div className="bg-white border-[3px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            OPENDOTA STATISTICAL DISTRIBUTIONS (GET /players/&#123;account_id&#125;/counts)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Counts &amp; Contextual Distributions
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#FFE600] text-black border border-black font-black text-xs uppercase">
          Categorical Telemetry
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading distribution counts from OpenDota...</p>
        </div>
      ) : sections.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <ChartBarIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No categorical distribution counts available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota has not indexed categorical counts (game modes, lanes, factions) for this player.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((sec, idx) => (
            <div key={idx} className="p-4 bg-stone-50 border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
              <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
                <span className="font-sans font-black text-xs uppercase text-black block">
                  {sec.title}
                </span>
                <span className="text-[10px] text-stone-500 uppercase">
                  {Object.keys(sec.data || {}).length} Categories
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(sec.data || {}).map(([key, stat]) => {
                  const games = Number(stat.games || 0);
                  const wins = Number(stat.win || 0);
                  const wr = games > 0 ? Math.round((wins / games) * 100) : 0;
                  const displayLabel = key === '1' && sec.title.includes('Faction') ? 'The Radiant' : key === '0' && sec.title.includes('Faction') ? 'The Dire' : key;

                  return (
                    <div key={key} className="text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-black truncate max-w-[200px]">{displayLabel}</span>
                        <div className="text-right">
                          <span className="font-black text-purple-700">{wr}% WR</span>
                          <span className="text-[10px] text-stone-500 ml-1.5">
                            ({wins}W - {games - wins}L · {games} total)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-stone-200 h-2 border border-black overflow-hidden">
                        <div
                          className={`h-full ${wr >= 50 ? 'bg-[#38EF7D]' : 'bg-[#FF5757]'}`}
                          style={{ width: `${wr}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
