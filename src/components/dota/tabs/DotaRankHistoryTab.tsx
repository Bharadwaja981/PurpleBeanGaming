import React from 'react';
import { TrophyIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { OpenDotaRatingTimelineItem, getRankTierName } from '../../../services/openDotaService';
import { DotaRankMedal } from '../DotaRankMedal';

interface DotaRankHistoryTabProps {
  ratings: OpenDotaRatingTimelineItem[];
  currentRankTier?: number | null;
  leaderboardRank?: number | null;
  isLoading?: boolean;
}

export function DotaRankHistoryTab({
  ratings,
  currentRankTier,
  leaderboardRank,
  isLoading
}: DotaRankHistoryTabProps) {
  const currentRankName = getRankTierName(currentRankTier);

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            VALVE RANK TIER TIMELINE (GET /players/&#123;account_id&#125;/ratings)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Medal &amp; Rank Progression
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black font-black text-xs uppercase">
          Official Medals
        </span>
      </div>

      {/* Current Medal Showcase */}
      <div className="bg-[#FFF9E6] border-2 border-black p-5 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[3px_3px_0px_0px_#000]">
        <div className="flex items-center gap-5">
          <DotaRankMedal
            rankTier={currentRankTier || null}
            leaderboardRank={leaderboardRank}
            size="lg"
            showLabel={false}
          />
          <div>
            <span className="text-[10px] uppercase font-bold text-stone-500 block">CURRENT COMPETITIVE STANDING</span>
            <h4 className="text-xl sm:text-2xl font-black uppercase text-black font-sans">
              {currentRankName}
            </h4>
            {leaderboardRank ? (
              <span className="text-xs text-amber-700 font-bold block mt-0.5">
                Leaderboard Rank #{leaderboardRank.toLocaleString()}
              </span>
            ) : (
              <span className="text-xs text-stone-600 block mt-0.5">
                Valve Matchmaking Official Calibration
              </span>
            )}
          </div>
        </div>

        <div className="text-right sm:border-l-2 sm:border-black/20 sm:pl-6 space-y-1">
          <span className="text-[10px] uppercase font-bold text-stone-500 block">SEASON STATUS</span>
          <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black text-xs font-black uppercase inline-block">
            CALIBRATED
          </span>
        </div>
      </div>

      {/* Historical progression timeline */}
      <div className="space-y-4">
        <h4 className="text-sm font-black uppercase text-black border-b-2 border-black pb-2">
          Historical Rating Snapshots
        </h4>

        {isLoading ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-stone-600">Loading rating timeline from OpenDota...</p>
          </div>
        ) : ratings.length === 0 ? (
          <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-600 space-y-1">
            <p className="font-bold text-black">No historical rating timeline entries recorded by OpenDota.</p>
            <p className="text-stone-500 text-[11px]">
              Valve rank progression history is only recorded when OpenDota captures competitive rating checkpoints.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map((r, idx) => {
              const mmr = r.solo_competitive_rank || r.competitive_rank;
              const dateStr = r.time ? new Date(r.time).toLocaleDateString() : '—';

              return (
                <div
                  key={idx}
                  className="p-3 bg-stone-50 border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_#000]"
                >
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="w-4 h-4 text-stone-500" />
                    <div>
                      <strong className="text-black text-xs font-black block">
                        Rating Checkpoint {r.match_id ? `(Match #${r.match_id})` : ''}
                      </strong>
                      <span className="text-[10px] text-stone-500 block">{dateStr}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-purple-700 text-sm font-mono block">
                      {mmr ? `${mmr.toLocaleString()} MMR` : 'Calibrated'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
