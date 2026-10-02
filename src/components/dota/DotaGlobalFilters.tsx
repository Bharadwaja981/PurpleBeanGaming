import React from 'react';
import { 
  FunnelIcon, 
  XMarkIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { DOTA_HEROES_REGISTRY, DOTA_PATCHES } from '../../services/dotaConstants';

export interface DotaFilterState {
  heroId: number | 'all';
  side: 'all' | 'radiant' | 'dire';
  result: 'all' | 'win' | 'loss';
  lane: 'all' | 'safe' | 'mid' | 'off' | 'jungle';
  patch: string;
  gameMode: string;
  lobbyType: string;
  timeframe: 'all' | '30d' | '90d' | '6m' | '1y';
  partySize: 'all' | 'solo' | 'party';
  significantOnly: boolean;
}

export const INITIAL_DOTA_FILTERS: DotaFilterState = {
  heroId: 'all',
  side: 'all',
  result: 'all',
  lane: 'all',
  patch: 'all',
  gameMode: 'all',
  lobbyType: 'all',
  timeframe: 'all',
  partySize: 'all',
  significantOnly: true
};

interface DotaGlobalFiltersProps {
  filters: DotaFilterState;
  onFilterChange: (filters: DotaFilterState) => void;
  filteredCount?: number;
  totalCount?: number;
}

export function DotaGlobalFilters({
  filters,
  onFilterChange,
  filteredCount,
  totalCount
}: DotaGlobalFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const activeCount = Object.entries(filters).filter(([k, v]) => {
    if (k === 'significantOnly') return !v; // default is true
    return v !== 'all';
  }).length;

  const handleReset = () => {
    onFilterChange(INITIAL_DOTA_FILTERS);
  };

  const update = <K extends keyof DotaFilterState>(key: K, val: DotaFilterState[K]) => {
    onFilterChange({ ...filters, [key]: val });
  };

  const heroList = Object.values(DOTA_HEROES_REGISTRY).sort((a, b) => 
    a.localizedName.localeCompare(b.localizedName)
  );

  return (
    <div className="bg-white border-2 border-black p-3.5 space-y-3 font-mono shadow-[3px_3px_0px_0px_#000]">
      {/* Top Filter Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase flex items-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            <FunnelIcon className="w-3.5 h-3.5" />
            <span>Telemetry Filters</span>
            {activeCount > 0 && (
              <span className="w-4 h-4 bg-black text-[#FFE600] rounded-full text-[9px] flex items-center justify-center font-bold">
                {activeCount}
              </span>
            )}
            <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="text-[10px] text-red-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>

        <div className="text-[11px] text-stone-600 font-bold">
          {filteredCount !== undefined && totalCount !== undefined ? (
            <span>Showing <strong className="text-black font-mono">{filteredCount}</strong> of <strong className="text-stone-800 font-mono">{totalCount}</strong> matches</span>
          ) : (
            <span>OpenDota Global Filter Active</span>
          )}
        </div>
      </div>

      {/* Expandable Filter Grid */}
      {isOpen && (
        <div className="pt-3 border-t-2 border-black/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 text-xs animate-in fade-in">
          {/* 1. Hero */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Hero</label>
            <select
              value={filters.heroId}
              onChange={(e) => update('heroId', e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Heroes</option>
              {heroList.map((h) => (
                <option key={h.id} value={h.id}>{h.localizedName}</option>
              ))}
            </select>
          </div>

          {/* 2. Side */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Side</label>
            <select
              value={filters.side}
              onChange={(e) => update('side', e.target.value as any)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">Both Sides</option>
              <option value="radiant">The Radiant</option>
              <option value="dire">The Dire</option>
            </select>
          </div>

          {/* 3. Result */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Result</label>
            <select
              value={filters.result}
              onChange={(e) => update('result', e.target.value as any)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">Wins &amp; Losses</option>
              <option value="win">Victories (Win)</option>
              <option value="loss">Defeats (Loss)</option>
            </select>
          </div>

          {/* 4. Lane */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Lane Role</label>
            <select
              value={filters.lane}
              onChange={(e) => update('lane', e.target.value as any)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Lanes</option>
              <option value="safe">Safe Lane</option>
              <option value="mid">Mid Lane</option>
              <option value="off">Offlane</option>
              <option value="jungle">Jungle / Roam</option>
            </select>
          </div>

          {/* 5. Game Mode */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Game Mode</label>
            <select
              value={filters.gameMode}
              onChange={(e) => update('gameMode', e.target.value)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Modes</option>
              <option value="Ranked All Pick">Ranked All Pick</option>
              <option value="All Pick">Normal All Pick</option>
              <option value="Captains Mode">Captains Mode</option>
              <option value="Turbo">Turbo</option>
            </select>
          </div>

          {/* 6. Patch */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Patch</label>
            <select
              value={filters.patch}
              onChange={(e) => update('patch', e.target.value)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Patches</option>
              {DOTA_PATCHES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* 7. Lobby */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Lobby</label>
            <select
              value={filters.lobbyType}
              onChange={(e) => update('lobbyType', e.target.value)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Lobbies</option>
              <option value="Ranked">Ranked Matchmaking</option>
              <option value="Unranked">Unranked Practice</option>
              <option value="Tournament">Tournament Official</option>
            </select>
          </div>

          {/* 8. Timeframe */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Timeframe</label>
            <select
              value={filters.timeframe}
              onChange={(e) => update('timeframe', e.target.value as any)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="6m">Last 6 Months</option>
              <option value="1y">Last Year</option>
            </select>
          </div>

          {/* 9. Party Size */}
          <div>
            <label className="text-[9px] font-black uppercase text-stone-500 block mb-0.5">Party</label>
            <select
              value={filters.partySize}
              onChange={(e) => update('partySize', e.target.value as any)}
              className="w-full bg-stone-50 border border-black p-1 text-[11px] font-bold"
            >
              <option value="all">Solo &amp; Party</option>
              <option value="solo">Solo Queue Only</option>
              <option value="party">Party / Stack Only</option>
            </select>
          </div>

          {/* 10. Significant Matches */}
          <div className="flex items-center gap-2 pt-4">
            <input
              type="checkbox"
              id="sigCheck"
              checked={filters.significantOnly}
              onChange={(e) => update('significantOnly', e.target.checked)}
              className="w-4 h-4 border border-black accent-black"
            />
            <label htmlFor="sigCheck" className="text-[10px] font-black uppercase cursor-pointer">
              Significant Only
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
