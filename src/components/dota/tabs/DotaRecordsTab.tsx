import React, { useMemo } from 'react';
import { 
  TrophyIcon, 
  BoltIcon, 
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';
import { getHeroImage, getHeroName } from '../../../services/dotaConstants';

interface DotaRecordsTabProps {
  playerData: OpenDotaPlayerSummary | null;
  onOpenMatch: (matchId: string) => void;
}

export function DotaRecordsTab({ playerData, onOpenMatch }: DotaRecordsTabProps) {
  const matches = playerData?.recentMatches || [];

  const derivedRecords = useMemo(() => {
    if (matches.length === 0) return [];

    let mostKills = matches[0];
    let leastDeaths = matches[0];
    let mostAssists = matches[0];
    let longestMatch = matches[0];
    let shortestMatch = matches[0];
    let bestKdaMatch = matches[0];
    let bestKdaVal = (matches[0].kills + matches[0].assists) / Math.max(1, matches[0].deaths);

    let highestGpm: typeof matches[0] | null = null;
    let highestXpm: typeof matches[0] | null = null;
    let mostLastHits: typeof matches[0] | null = null;
    let mostHeroDamage: typeof matches[0] | null = null;
    let mostTowerDamage: typeof matches[0] | null = null;
    let mostHealing: typeof matches[0] | null = null;

    for (const m of matches) {
      if (m.kills > mostKills.kills) mostKills = m;
      if (m.deaths < leastDeaths.deaths) leastDeaths = m;
      if (m.assists > mostAssists.assists) mostAssists = m;
      if (m.durationMinutes > longestMatch.durationMinutes) longestMatch = m;
      if (m.durationMinutes < shortestMatch.durationMinutes) shortestMatch = m;

      const kda = (m.kills + m.assists) / Math.max(1, m.deaths);
      if (kda > bestKdaVal) {
        bestKdaVal = kda;
        bestKdaMatch = m;
      }

      if (typeof m.gpm === 'number' && (!highestGpm || m.gpm > (highestGpm.gpm || 0))) highestGpm = m;
      if (typeof m.xpm === 'number' && (!highestXpm || m.xpm > (highestXpm.xpm || 0))) highestXpm = m;
      if (typeof m.lastHits === 'number' && (!mostLastHits || m.lastHits > (mostLastHits.lastHits || 0))) mostLastHits = m;
      if (typeof m.heroDamage === 'number' && (!mostHeroDamage || m.heroDamage > (mostHeroDamage.heroDamage || 0))) mostHeroDamage = m;
      if (typeof m.towerDamage === 'number' && (!mostTowerDamage || m.towerDamage > (mostTowerDamage.towerDamage || 0))) mostTowerDamage = m;
      if (typeof m.heroHealing === 'number' && (!mostHealing || m.heroHealing > (mostHealing.heroHealing || 0))) mostHealing = m;
    }

    const recs = [
      {
        label: 'Most Kills',
        value: `${mostKills.kills} Kills`,
        match: mostKills
      },
      {
        label: 'Lowest Deaths',
        value: `${leastDeaths.deaths} Deaths`,
        match: leastDeaths
      },
      {
        label: 'Most Assists',
        value: `${mostAssists.assists} Assists`,
        match: mostAssists
      },
      {
        label: 'Best KDA Ratio',
        value: `${bestKdaVal.toFixed(1)} KDA`,
        match: bestKdaMatch
      },
      {
        label: 'Longest Match',
        value: `${longestMatch.durationMinutes} Min`,
        match: longestMatch
      },
      {
        label: 'Shortest Match',
        value: `${shortestMatch.durationMinutes} Min`,
        match: shortestMatch
      }
    ];

    if (highestGpm && highestGpm.gpm) {
      recs.push({
        label: 'Highest GPM',
        value: `${highestGpm.gpm} GPM`,
        match: highestGpm
      });
    }
    if (highestXpm && highestXpm.xpm) {
      recs.push({
        label: 'Highest XPM',
        value: `${highestXpm.xpm} XPM`,
        match: highestXpm
      });
    }
    if (mostLastHits && mostLastHits.lastHits) {
      recs.push({
        label: 'Most Last Hits',
        value: `${mostLastHits.lastHits} LH`,
        match: mostLastHits
      });
    }
    if (mostHeroDamage && mostHeroDamage.heroDamage) {
      recs.push({
        label: 'Most Hero Damage',
        value: `${(mostHeroDamage.heroDamage / 1000).toFixed(1)}k DMG`,
        match: mostHeroDamage
      });
    }
    if (mostTowerDamage && mostTowerDamage.towerDamage) {
      recs.push({
        label: 'Most Tower Damage',
        value: `${(mostTowerDamage.towerDamage / 1000).toFixed(1)}k TD`,
        match: mostTowerDamage
      });
    }
    if (mostHealing && mostHealing.heroHealing) {
      recs.push({
        label: 'Most Healing',
        value: `${(mostHealing.heroHealing / 1000).toFixed(1)}k Heal`,
        match: mostHealing
      });
    }

    return recs;
  }, [matches]);

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-5 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            HISTORICAL PEAK ACHIEVEMENTS (DERIVED FROM VERIFIED MATCHES)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Personal Records &amp; Milestones
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#FFE600] text-black border border-black font-black text-xs uppercase">
          {derivedRecords.length} Career Bests Indexed
        </span>
      </div>

      {derivedRecords.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <TrophyIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No match records available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota returned no parsed matches to compute milestone records for this account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {derivedRecords.map((rec, idx) => (
            <div
              key={idx}
              onClick={() => onOpenMatch(rec.match.matchId)}
              className="p-4 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-stone-500 tracking-wider">
                  {rec.label}
                </span>
                <span className={`px-1.5 py-0.2 border border-black text-[9px] font-black uppercase ${
                  rec.match.playerWon ? 'bg-[#70FFAF] text-black' : 'bg-[#FF5757] text-white'
                }`}>
                  {rec.match.playerWon ? 'VICTORY' : 'DEFEAT'}
                </span>
              </div>

              <div className="text-2xl sm:text-3xl font-black font-mono text-purple-700">
                {rec.value}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-black/10">
                <img
                  src={getHeroImage(rec.match.heroId)}
                  alt={getHeroName(rec.match.heroId)}
                  className="w-8 h-8 object-cover border border-black bg-stone-900 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getHeroImage(null);
                  }}
                />
                <div className="min-w-0 flex-1">
                  <strong className="text-black text-xs font-black block truncate">{getHeroName(rec.match.heroId)}</strong>
                  <span className="text-[10px] text-stone-500 block truncate">
                    Match #{rec.match.matchId}
                  </span>
                </div>
                <ArrowRightIcon className="w-4 h-4 text-stone-400 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
