import React, { useState, useMemo } from 'react';
import { 
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';
import { getHeroImage, getHero, getHeroName } from '../../../services/dotaConstants';

interface DotaHeroesTabProps {
  heroes: OpenDotaPlayerSummary['topHeroes'];
  onOpenHero: (heroId: number) => void;
}

export function DotaHeroesTab({
  heroes,
  onOpenHero
}: DotaHeroesTabProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'games' | 'winrate' | 'wins' | 'name'>('games');

  const filteredAndSorted = useMemo(() => {
    let list = [...heroes];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((h) => h.heroName.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === 'games') return b.games - a.games;
      if (sortBy === 'winrate') return b.winRate - a.winRate;
      if (sortBy === 'wins') return b.wins - a.wins;
      if (sortBy === 'name') return a.heroName.localeCompare(b.heroName);
      return 0;
    });

    return list;
  }, [heroes, search, sortBy]);

  return (
    <div className="bg-white border-[3px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-5 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            HERO POOL TELEMETRY
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Heroes Matrix &amp; Versatility
          </h3>
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search hero..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-2 border-black pl-8 pr-3 py-1.5 text-xs font-mono font-bold"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-stone-50 border-2 border-black py-1.5 px-3 text-xs font-mono font-bold cursor-pointer"
          >
            <option value="games">Most Played</option>
            <option value="winrate">Highest Win Rate</option>
            <option value="wins">Most Wins</option>
            <option value="name">Hero Name (A-Z)</option>
          </select>
        </div>
      </div>

      {heroes.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <h4 className="text-base font-black uppercase text-black font-sans">
            No hero telemetry available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota returned no indexed hero matches for this player ID.
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-600">
          No heroes match "{search}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredAndSorted.map((h) => {
          const meta = getHero(h.heroId);
          const heroName = getHeroName(h.heroId);
          return (
            <div
              key={h.heroId}
              onClick={() => onOpenHero(h.heroId)}
              className="p-3.5 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all space-y-2.5"
            >
              <div className="flex items-center gap-3">
                <img
                  src={getHeroImage(h.heroId)}
                  alt={heroName}
                  className="w-12 h-12 object-cover border-2 border-black bg-stone-900 shrink-0 shadow-[2px_2px_0px_0px_#000]"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getHeroImage(null);
                  }}
                />
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-black font-sans uppercase block text-sm truncate">{heroName}</strong>
                    {meta?.primaryAttr && (
                      <span className="text-[9px] bg-black text-[#FFE600] px-1 py-0.2 uppercase font-black">
                        {meta.primaryAttr}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-500 font-mono">{h.games} Career Matches</span>
                </div>
              </div>

              {/* Win Rate Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700">Win Rate</span>
                  <span className="font-black text-emerald-700">{h.winRate}% ({h.wins}W - {h.losses}L)</span>
                </div>
                <div className="w-full bg-stone-200 h-2 border border-black overflow-hidden">
                  <div
                    className="bg-[#38EF7D] h-full"
                    style={{ width: `${h.winRate}%` }}
                  />
                </div>
              </div>

              {/* With / Against Quick Matrix */}
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-black/10">
                <div className="bg-white p-1.5 border border-black">
                  <span className="text-stone-500 block">With Team:</span>
                  <strong className="text-blue-700 font-mono">
                    {(h as any).withWinRate ? `${(h as any).withWinRate}% WR` : '—'}
                  </strong>
                </div>
                <div className="bg-white p-1.5 border border-black">
                  <span className="text-stone-500 block">Against:</span>
                  <strong className="text-purple-700 font-mono">
                    {(h as any).againstWinRate ? `${(h as any).againstWinRate}% WR` : '—'}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
