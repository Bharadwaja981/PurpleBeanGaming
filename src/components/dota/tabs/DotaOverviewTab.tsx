import React, { useMemo } from 'react';
import { 
  TrophyIcon, 
  FireIcon, 
  ArrowRightIcon, 
  ClockIcon, 
  SparklesIcon,
  ShieldCheckIcon,
  UsersIcon,
  BoltIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary, OpenDotaCounts, OpenDotaPeer } from '../../../services/openDotaService';
import { getHeroImage, getHeroName } from '../../../services/dotaConstants';
import { DotaItemIcon } from '../DotaItemIcon';

interface DotaOverviewTabProps {
  playerData: OpenDotaPlayerSummary | null;
  counts?: OpenDotaCounts | null;
  peers?: OpenDotaPeer[];
  onOpenMatch: (matchId: string) => void;
  onOpenHero: (heroId: number) => void;
  onSelectTab: (tab: any) => void;
  onSelectPlayer?: (accountId: string) => void;
}

export function DotaOverviewTab({
  playerData,
  counts,
  peers = [],
  onOpenMatch,
  onOpenHero,
  onSelectTab,
  onSelectPlayer
}: DotaOverviewTabProps) {
  const matches = playerData?.recentMatches || [];
  const heroes = playerData?.topHeroes || [];
  const resolvedPeers = peers.length > 0 ? peers : (playerData?.peers || []);

  // Averages and Maximums calculations (Section B) - Derived solely from real matches
  const statsOverview = useMemo(() => {
    if (matches.length === 0) {
      return null;
    }

    const n = matches.length;
    let sumK = 0, sumD = 0, sumA = 0, sumGpm = 0, sumXpm = 0, sumLh = 0, sumHd = 0, sumTd = 0, sumHl = 0, sumDur = 0;
    let gpmCount = 0, xpmCount = 0, lhCount = 0, hdCount = 0, tdCount = 0, hlCount = 0;
    let maxK = matches[0], minD = matches[0], maxA = matches[0];
    let maxG: typeof matches[0] | null = null;
    let maxX: typeof matches[0] | null = null;
    let maxLh: typeof matches[0] | null = null;
    let maxHd: typeof matches[0] | null = null;
    let maxTd: typeof matches[0] | null = null;
    let maxHl: typeof matches[0] | null = null;
    let maxDur = matches[0];

    for (const m of matches) {
      sumK += m.kills;
      sumD += m.deaths;
      sumA += m.assists;
      sumDur += m.durationMinutes;

      if (m.kills > maxK.kills) maxK = m;
      if (m.deaths < minD.deaths) minD = m;
      if (m.assists > maxA.assists) maxA = m;
      if (m.durationMinutes > maxDur.durationMinutes) maxDur = m;

      if (typeof m.gpm === 'number') {
        sumGpm += m.gpm;
        gpmCount++;
        if (!maxG || m.gpm > (maxG.gpm || 0)) maxG = m;
      }
      if (typeof m.xpm === 'number') {
        sumXpm += m.xpm;
        xpmCount++;
        if (!maxX || m.xpm > (maxX.xpm || 0)) maxX = m;
      }
      if (typeof m.lastHits === 'number') {
        sumLh += m.lastHits;
        lhCount++;
        if (!maxLh || m.lastHits > (maxLh.lastHits || 0)) maxLh = m;
      }
      if (typeof m.heroDamage === 'number') {
        sumHd += m.heroDamage;
        hdCount++;
        if (!maxHd || m.heroDamage > (maxHd.heroDamage || 0)) maxHd = m;
      }
      if (typeof m.towerDamage === 'number') {
        sumTd += m.towerDamage;
        tdCount++;
        if (!maxTd || m.towerDamage > (maxTd.towerDamage || 0)) maxTd = m;
      }
      if (typeof m.heroHealing === 'number') {
        sumHl += m.heroHealing;
        hlCount++;
        if (!maxHl || m.heroHealing > (maxHl.heroHealing || 0)) maxHl = m;
      }
    }

    return {
      avgKills: Math.round((sumK / n) * 10) / 10,
      maxKills: { val: maxK.kills, hero: maxK.heroName, matchId: maxK.matchId },
      avgDeaths: Math.round((sumD / n) * 10) / 10,
      minDeaths: { val: minD.deaths, hero: minD.heroName, matchId: minD.matchId },
      avgAssists: Math.round((sumA / n) * 10) / 10,
      maxAssists: { val: maxA.assists, hero: maxA.heroName, matchId: maxA.matchId },
      avgGpm: gpmCount > 0 ? Math.round(sumGpm / gpmCount) : null,
      maxGpm: maxG?.gpm != null ? { val: maxG.gpm, hero: maxG.heroName, matchId: maxG.matchId } : null,
      avgXpm: xpmCount > 0 ? Math.round(sumXpm / xpmCount) : null,
      maxXpm: maxX?.xpm != null ? { val: maxX.xpm, hero: maxX.heroName, matchId: maxX.matchId } : null,
      avgLastHits: lhCount > 0 ? Math.round(sumLh / lhCount) : null,
      maxLastHits: maxLh?.lastHits != null ? { val: maxLh.lastHits, hero: maxLh.heroName, matchId: maxLh.matchId } : null,
      avgHeroDamage: hdCount > 0 ? Math.round(sumHd / hdCount) : null,
      maxHeroDamage: maxHd?.heroDamage != null ? { val: maxHd.heroDamage, hero: maxHd.heroName, matchId: maxHd.matchId } : null,
      avgTowerDamage: tdCount > 0 ? Math.round(sumTd / tdCount) : null,
      maxTowerDamage: maxTd?.towerDamage != null ? { val: maxTd.towerDamage, hero: maxTd.heroName, matchId: maxTd.matchId } : null,
      avgHealing: hlCount > 0 ? Math.round(sumHl / hlCount) : null,
      maxHealing: maxHl?.heroHealing != null ? { val: maxHl.heroHealing, hero: maxHl.heroName, matchId: maxHl.matchId } : null,
      avgDuration: Math.round(sumDur / n),
      maxDuration: { val: maxDur.durationMinutes, hero: maxDur.heroName, matchId: maxDur.matchId }
    };
  }, [matches]);

  // Recent 20 Form calculations (Section G)
  const formStats = useMemo(() => {
    if (matches.length === 0) return null;
    const list = matches.slice(0, 20);
    const wins = list.filter((m) => m.playerWon).length;
    const winRate = list.length > 0 ? Math.round((wins / list.length) * 100) : 0;
    const tenList = matches.slice(0, 10);
    const tenWins = tenList.filter((m) => m.playerWon).length;
    const tenWinRate = tenList.length > 0 ? Math.round((tenWins / tenList.length) * 100) : 0;

    let streak = 0;
    if (list.length > 0) {
      const first = list[0].playerWon;
      for (const m of list) {
        if (m.playerWon === first) streak++;
        else break;
      }
      streak = first ? streak : -streak;
    }

    return { list, wins, winRate, tenWinRate, streak };
  }, [matches]);

  // Side (Faction) distribution from OpenDota counts
  const sideDistribution = useMemo(() => {
    if (!counts?.is_radiant) return null;
    const rad = counts.is_radiant['1'] || { games: 0, win: 0 };
    const dir = counts.is_radiant['0'] || { games: 0, win: 0 };
    const radWR = rad.games > 0 ? Math.round((rad.win / rad.games) * 100) : 0;
    const dirWR = dir.games > 0 ? Math.round((dir.win / dir.games) * 100) : 0;
    return { rad, dir, radWR, dirWR };
  }, [counts]);

  return (
    <div className="space-y-6 font-mono">
      
      {/* ------------------------------------------------------------- */}
      {/* SECTION A: COMPACT QUICK STAT SUMMARY RIBBON                  */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-2 border-black p-3.5 shadow-[4px_4px_0px_0px_#000]">
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 text-center text-xs divide-x-0 sm:divide-x divide-stone-200">
          <div className="p-1 space-y-0.5" title="Total matches logged in career">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Matches</span>
            <span className="font-mono text-base font-black text-black">
              {playerData?.totalMatches != null ? playerData.totalMatches.toLocaleString() : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Matches won">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Wins</span>
            <span className="font-mono text-base font-black text-emerald-700">
              {playerData?.wins != null ? playerData.wins.toLocaleString() : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Matches lost">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Losses</span>
            <span className="font-mono text-base font-black text-red-600">
              {playerData?.losses != null ? playerData.losses.toLocaleString() : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Career winrate percentage">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Win Rate</span>
            {playerData?.winRate != null ? (
              <span className="font-mono text-base font-black text-black bg-[#FFE600] px-1 border border-black inline-block">
                {playerData.winRate}%
              </span>
            ) : (
              <span className="font-mono text-base font-black text-stone-400">—</span>
            )}
          </div>

          <div className="p-1 space-y-0.5" title="Current Valve Rank Tier">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Current Rank</span>
            <span className="font-mono text-xs font-black text-purple-700 truncate block">
              {playerData?.rankName || 'Uncalibrated'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Kills + Assists divided by Deaths">
            <span className="text-[9px] text-stone-500 uppercase font-black block">KDA Ratio</span>
            <span className="font-mono text-base font-black text-black">
              {statsOverview
                ? ((statsOverview.avgKills + statsOverview.avgAssists) / Math.max(1, statsOverview.avgDeaths)).toFixed(2)
                : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Average Gold Per Minute">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Avg GPM</span>
            <span className="font-mono text-base font-black text-amber-600">
              {statsOverview?.avgGpm != null ? statsOverview.avgGpm : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Average XP Per Minute">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Avg XPM</span>
            <span className="font-mono text-base font-black text-blue-600">
              {statsOverview?.avgXpm != null ? statsOverview.avgXpm : '—'}
            </span>
          </div>

          <div className="p-1 space-y-0.5" title="Estimated Tournament MMR">
            <span className="text-[9px] text-stone-500 uppercase font-black block">Est. MMR</span>
            <span className="font-mono text-base font-black text-black">
              {playerData?.estimatedMmr != null ? playerData.estimatedMmr.toLocaleString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION B: AVERAGES & MAXIMUMS                                */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-sans text-lg font-black uppercase text-black">
              Recent Performance Averages &amp; Maximums
            </h3>
          </div>
          <span className="text-xs font-bold text-stone-600">
            Based on {matches.length} recent parsed matches
          </span>
        </div>

        {statsOverview ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
            {/* Kills */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Kills</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgKills}</strong></span>
                <span className="text-purple-700 font-black">MAX: {statsOverview.maxKills.val}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxKills.hero}
              </span>
            </div>

            {/* Deaths */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Deaths</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgDeaths}</strong></span>
                <span className="text-emerald-700 font-black">MIN: {statsOverview.minDeaths.val}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.minDeaths.hero}
              </span>
            </div>

            {/* Assists */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Assists</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgAssists}</strong></span>
                <span className="text-purple-700 font-black">MAX: {statsOverview.maxAssists.val}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxAssists.hero}
              </span>
            </div>

            {/* GPM */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Gold / Min</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgGpm ?? '—'}</strong></span>
                <span className="text-amber-700 font-black">MAX: {statsOverview.maxGpm ? statsOverview.maxGpm.val : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxGpm?.hero || '—'}
              </span>
            </div>

            {/* XPM */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">XP / Min</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgXpm ?? '—'}</strong></span>
                <span className="text-blue-700 font-black">MAX: {statsOverview.maxXpm ? statsOverview.maxXpm.val : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxXpm?.hero || '—'}
              </span>
            </div>

            {/* Last Hits */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Last Hits</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgLastHits ?? '—'}</strong></span>
                <span className="text-purple-700 font-black">MAX: {statsOverview.maxLastHits ? statsOverview.maxLastHits.val : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxLastHits?.hero || '—'}
              </span>
            </div>

            {/* Hero Damage */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Hero Damage</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgHeroDamage ? `${(statsOverview.avgHeroDamage / 1000).toFixed(1)}k` : '—'}</strong></span>
                <span className="text-red-700 font-black">MAX: {statsOverview.maxHeroDamage ? `${(statsOverview.maxHeroDamage.val / 1000).toFixed(1)}k` : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxHeroDamage?.hero || '—'}
              </span>
            </div>

            {/* Tower Damage */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Tower Damage</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgTowerDamage ? `${(statsOverview.avgTowerDamage / 1000).toFixed(1)}k` : '—'}</strong></span>
                <span className="text-amber-700 font-black">MAX: {statsOverview.maxTowerDamage ? `${(statsOverview.maxTowerDamage.val / 1000).toFixed(1)}k` : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxTowerDamage?.hero || '—'}
              </span>
            </div>

            {/* Hero Healing */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Hero Healing</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgHealing != null ? statsOverview.avgHealing : '—'}</strong></span>
                <span className="text-emerald-700 font-black">MAX: {statsOverview.maxHealing ? statsOverview.maxHealing.val : '—'}</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxHealing?.hero || '—'}
              </span>
            </div>

            {/* Duration */}
            <div className="p-3 bg-stone-50 border border-black space-y-1">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Duration</span>
              <div className="flex items-baseline justify-between">
                <span className="text-stone-600 font-bold">AVG: <strong className="text-black text-sm">{statsOverview.avgDuration}m</strong></span>
                <span className="text-purple-700 font-black">MAX: {statsOverview.maxDuration.val}m</span>
              </div>
              <span className="text-[9px] text-stone-500 truncate block">
                {statsOverview.maxDuration.hero}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-stone-50 border border-black text-center text-xs text-stone-500">
            No recent match data available to compute averages.
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION C: FACTION & LANE TELEMETRY (REAL DATA ONLY)          */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Faction Favourability (Side) */}
        <div className="bg-white border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
            <span className="font-sans font-black text-xs uppercase text-black block">Faction Favourability</span>
            <span className="text-[10px] text-stone-500 uppercase">OpenDota Counts</span>
          </div>

          {sideDistribution ? (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-emerald-700 font-bold">The Radiant</span>
                  <span className="font-bold">{sideDistribution.radWR}% ({sideDistribution.rad.win}W - {sideDistribution.rad.games - sideDistribution.rad.win}L)</span>
                </div>
                <div className="w-full bg-stone-100 h-2 border border-black overflow-hidden">
                  <div className="bg-[#38EF7D] h-full" style={{ width: `${sideDistribution.radWR}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between pb-0.5">
                  <span className="text-red-700 font-bold">The Dire</span>
                  <span className="font-bold">{sideDistribution.dirWR}% ({sideDistribution.dir.win}W - {sideDistribution.dir.games - sideDistribution.dir.win}L)</span>
                </div>
                <div className="w-full bg-stone-100 h-2 border border-black overflow-hidden">
                  <div className="bg-[#FF5757] h-full" style={{ width: `${sideDistribution.dirWR}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-stone-500">
              Faction telemetry pending OpenDota counts. Check the Counts tab.
            </div>
          )}
        </div>

        {/* Card 2: Lane Preference from counts */}
        <div className="bg-white border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
            <span className="font-sans font-black text-xs uppercase text-black block">Lane Preference</span>
            <button
              onClick={() => onSelectTab('counts')}
              className="text-[10px] font-bold text-purple-700 hover:underline cursor-pointer"
            >
              All Counts →
            </button>
          </div>

          {counts?.lane_role && Object.keys(counts.lane_role).length > 0 ? (
            <div className="space-y-2 text-xs">
              {Object.entries(counts.lane_role).slice(0, 3).map(([lane, stat]) => {
                const wr = stat.games > 0 ? Math.round((stat.win / stat.games) * 100) : 0;
                return (
                  <div key={lane}>
                    <div className="flex items-center justify-between pb-0.5">
                      <span>{lane}</span>
                      <span className="font-bold text-purple-700">{wr}% WR · {stat.games} Games</span>
                    </div>
                    <div className="w-full bg-stone-100 h-1.5 border border-black overflow-hidden">
                      <div className="bg-purple-600 h-full" style={{ width: `${wr}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-stone-500">
              Lane distribution pending OpenDota counts. Check the Counts tab.
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION G: RECENT FORM SPARKLINE                              */}
      {/* ------------------------------------------------------------- */}
      {formStats && (
        <div className="bg-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <FireIcon className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-black uppercase">Recent Form (Last {formStats.list.length}):</span>
            <div className="flex items-center gap-1 overflow-x-auto">
              {formStats.list.map((m, idx) => (
                <div
                  key={idx}
                  onClick={() => onOpenMatch(m.matchId)}
                  className={`w-4 h-4 border border-black flex items-center justify-center font-black text-[9px] cursor-pointer hover:scale-110 transition-transform ${
                    m.playerWon ? 'bg-[#38EF7D] text-black' : 'bg-[#FF5757] text-white'
                  }`}
                  title={`Match #${m.matchId} (${m.heroName}) - ${m.playerWon ? 'Win' : 'Loss'}`}
                >
                  {m.playerWon ? 'W' : 'L'}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-bold">
            <span>Streak: <strong className={formStats.streak >= 0 ? 'text-emerald-700' : 'text-red-600'}>
              {formStats.streak >= 0 ? `${formStats.streak} Win` : `${Math.abs(formStats.streak)} Loss`}
            </strong></span>
            <span>·</span>
            <span>10-Match: <strong>{formStats.tenWinRate}% WR</strong></span>
            <span>·</span>
            <span>20-Match: <strong>{formStats.winRate}% WR</strong></span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECTION D & E: RECENT MATCHES + TEAMMATES (GRID)              */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SECTION D: RECENT MATCHES TABLE (2 Columns) */}
        <div className="lg:col-span-2 bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-black" />
              <h3 className="font-sans text-base font-black uppercase text-black">
                Recent Matches
              </h3>
            </div>
            <button
              onClick={() => onSelectTab('matches')}
              className="text-xs font-black text-purple-700 hover:underline cursor-pointer"
            >
              View All ({playerData?.totalMatches ?? matches.length}) →
            </button>
          </div>

          {matches.length === 0 ? (
            <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
              No recent matches logged for this account.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-stone-100 border-b-2 border-black text-stone-600 uppercase text-[9px]">
                    <th className="p-2">Hero</th>
                    <th className="p-2">Result</th>
                    <th className="p-2">Mode</th>
                    <th className="p-2 text-center">K / D / A</th>
                    <th className="p-2 text-right">GPM/XPM</th>
                    <th className="p-2">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {matches.slice(0, 8).map((m) => (
                    <tr
                      key={m.matchId}
                      onClick={() => onOpenMatch(m.matchId)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors"
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={getHeroImage(m.heroId)}
                            alt={getHeroName(m.heroId)}
                            className="w-7 h-7 object-cover border border-black bg-stone-900 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getHeroImage(null);
                            }}
                          />
                          <div>
                            <strong className="text-black text-xs block truncate max-w-[100px]">{getHeroName(m.heroId)}</strong>
                            <span className="text-[9px] text-stone-500">{m.durationMinutes}m</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <span className={`px-1.5 py-0.2 border border-black text-[9px] font-black uppercase ${
                          m.playerWon ? 'bg-[#70FFAF] text-black' : 'bg-[#FF5757] text-white'
                        }`}>
                          {m.playerWon ? 'WON' : 'LOST'}
                        </span>
                      </td>
                      <td className="p-2 text-[10px] text-stone-600 truncate max-w-[90px]">
                        {m.gameMode || 'Match'}
                      </td>
                      <td className="p-2 text-center font-bold text-xs">
                        <span className="text-emerald-700">{m.kills}</span>/
                        <span className="text-red-600">{m.deaths}</span>/
                        <span className="text-stone-600">{m.assists}</span>
                      </td>
                      <td className="p-2 text-right font-bold text-[11px]">
                        {m.gpm != null ? m.gpm : '—'} / {m.xpm != null ? m.xpm : '—'}
                      </td>
                      <td className="p-2">
                        {m.items && m.items.length > 0 ? (
                          <div className="flex items-center gap-0.5">
                            {m.items.slice(0, 4).map((itemId, idx) => (
                              <DotaItemIcon key={idx} itemIdOrName={itemId} size="sm" />
                            ))}
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[10px]" title="Item data not parsed for this match">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION E: PLAYERS PLAYED WITH / TEAMMATES (1 Column) */}
        <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-[#7C3AED]" />
              <h3 className="font-sans text-base font-black uppercase text-black">
                Teammates
              </h3>
            </div>
            <button
              onClick={() => onSelectTab('teammates')}
              className="text-xs font-black text-purple-700 hover:underline cursor-pointer"
            >
              All →
            </button>
          </div>

          <div className="space-y-2">
            {resolvedPeers.length === 0 ? (
              <div className="p-6 bg-stone-50 border border-black text-center text-xs text-stone-500">
                No teammate data available.
              </div>
            ) : (
              resolvedPeers.slice(0, 5).map((p) => {
                const wr = p.with_games > 0 ? Math.round((p.with_win / p.with_games) * 100) : 0;
                const avatar = p.avatarfull || p.avatar;

                return (
                  <div
                    key={p.account_id}
                    onClick={() => onSelectPlayer?.(String(p.account_id))}
                    className="p-2.5 bg-stone-50 hover:bg-[#FFF9E6] border border-black flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={p.personaname || 'Teammate'}
                          className="w-7 h-7 object-cover border border-black bg-black shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-7 h-7 bg-black text-[#FFE600] border border-black flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(p.personaname || p.name || 'P').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate">
                        <strong className="text-black block truncate">{p.personaname || `Contender (${p.account_id})`}</strong>
                        <span className="text-[10px] text-stone-500">{p.with_games} with ({p.with_win}W)</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-emerald-700 block">{wr}% WR</span>
                      <span className="text-[9px] text-stone-400">ID: {p.account_id}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION F: MOST PLAYED HEROES                                 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-5 h-5 text-amber-500" />
            <h3 className="font-sans text-base font-black uppercase text-black">
              Signature &amp; Most Played Heroes
            </h3>
          </div>
          <button
            onClick={() => onSelectTab('heroes')}
            className="text-xs font-black text-purple-700 hover:underline cursor-pointer"
          >
            All Heroes ({heroes.length}) →
          </button>
        </div>

        {heroes.length === 0 ? (
          <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
            No hero statistics available from OpenDota.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {heroes.slice(0, 8).map((h) => (
              <div
                key={h.heroId}
                onClick={() => onOpenHero(h.heroId)}
                className="p-3 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black flex items-center justify-between gap-3 shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={getHeroImage(h.heroId)}
                    alt={getHeroName(h.heroId)}
                    className="w-10 h-10 object-cover border-2 border-black bg-stone-900 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getHeroImage(null);
                    }}
                  />
                  <div className="min-w-0">
                    <strong className="text-black text-xs font-black block truncate">{getHeroName(h.heroId)}</strong>
                    <span className="text-[10px] text-stone-600 block">{h.games} Games ({h.wins}W)</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-700 block">{h.winRate}%</span>
                  <div className="w-10 bg-stone-200 h-1 border border-black overflow-hidden mt-0.5">
                    <div className="bg-[#38EF7D] h-full" style={{ width: `${h.winRate}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
