import React from 'react';
import { TrophyIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { OpenDotaHeroRanking } from '../../../services/openDotaService';
import { getHeroImage, getHeroName } from '../../../services/dotaConstants';

interface DotaHeroRankingsTabProps {
  rankings: OpenDotaHeroRanking[];
  onOpenHero: (heroId: number) => void;
  isLoading?: boolean;
}

export function DotaHeroRankingsTab({ rankings, onOpenHero, isLoading }: DotaHeroRankingsTabProps) {
  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            GLOBAL COMMUNITY CALIBRATION (GET /players/&#123;account_id&#125;/rankings)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Hero Rankings &amp; Competitive Percentiles
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#FFE600] text-black border border-black font-black text-xs uppercase">
          {rankings.length} Ranked Heroes
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading hero rankings from OpenDota...</p>
        </div>
      ) : rankings.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <TrophyIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No hero rankings indexed.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota computes hero rankings for players with sufficient competitive matches on specific heroes. No rankings were returned for this ID.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {rankings.map((r, idx) => (
            <div
              key={r.hero_id}
              onClick={() => onOpenHero(r.hero_id)}
              className="p-4 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all space-y-3 group"
            >
              <div className="flex items-center justify-between">
                <span className="bg-black text-[#FFE600] px-2 py-0.5 text-xs font-black font-mono border border-black">
                  #{idx + 1}
                </span>
                <span className="text-[10px] text-purple-700 font-black">
                  {r.percent_rank != null ? `${r.percent_rank}th Percentile` : 'Calibrated'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <img
                  src={getHeroImage(r.hero_id)}
                  alt={getHeroName(r.hero_id)}
                  className="w-12 h-12 object-cover border-2 border-black bg-stone-900 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getHeroImage(null);
                  }}
                />
                <div className="min-w-0">
                  <strong className="text-black font-sans uppercase block text-sm font-black truncate leading-tight">
                    {getHeroName(r.hero_id)}
                  </strong>
                  <span className="text-xs text-stone-600 font-mono font-bold block mt-0.5">
                    Score: {typeof r.score === 'number' ? Math.round(r.score) : r.score}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[10px] text-stone-500">
                <span>Valve Community Rating</span>
                <span className="font-bold text-[#7C3AED] group-hover:underline">View Hero →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
