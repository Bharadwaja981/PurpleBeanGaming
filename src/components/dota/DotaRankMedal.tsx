import React from 'react';
import { getRankTierDetails } from '../../services/dotaConstants';

interface DotaRankMedalProps {
  rankTier?: number | null;
  leaderboardRank?: number | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
}

export function DotaRankMedal({
  rankTier,
  leaderboardRank,
  size = 'md',
  showLabel = true
}: DotaRankMedalProps) {
  const details = getRankTierDetails(rankTier, leaderboardRank);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  }[size];

  const starSizes = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
    xl: 'w-6 h-6'
  }[size];

  return (
    <div className="flex flex-col items-center justify-center font-mono">
      <div className="relative flex items-center justify-center">
        {/* Official OpenDota / Valve Rank Medal Asset */}
        <img
          src={details.iconUrl}
          alt={details.label}
          className={`${sizeClasses} object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]`}
          onError={(e) => {
            // High quality fallback if external asset fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Stars Overlay */}
        {details.stars > 0 && details.tierNumber < 8 && (
          <div className="absolute -top-1 flex items-center justify-center gap-0.5 pointer-events-none">
            {Array.from({ length: details.stars }).map((_, i) => (
              <span
                key={i}
                className={`${starSizes} text-[#FFE600] font-black drop-shadow-[0_1px_2px_#000] text-xs leading-none select-none`}
              >
                ★
              </span>
            ))}
          </div>
        )}

        {/* Immortal Leaderboard Rank Badge */}
        {details.tierNumber === 8 && leaderboardRank && (
          <div className="absolute -bottom-2 px-1.5 py-0.2 bg-black text-[#FFE600] border border-[#FFE600] text-[9px] font-black tracking-widest font-mono shadow-[1px_1px_0px_0px_#000]">
            #{leaderboardRank}
          </div>
        )}
      </div>

      {showLabel && (
        <div className="mt-1 text-center">
          <span className={`px-2 py-0.5 text-[9px] font-black font-mono uppercase border border-black ${details.badgeBg} ${details.badgeText} shadow-[1px_1px_0px_0px_#000]`}>
            {details.label}
          </span>
          <span className="block text-[8px] text-stone-500 font-mono mt-0.5">
            ~{details.estimatedMmr} MMR
          </span>
        </div>
      )}
    </div>
  );
}
