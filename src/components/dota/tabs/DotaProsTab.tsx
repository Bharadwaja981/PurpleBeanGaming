import React, { useState } from 'react';
import { 
  TrophyIcon, 
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { OpenDotaProEncounter } from '../../../services/openDotaService';

interface DotaProsTabProps {
  pros: OpenDotaProEncounter[];
  isLoading?: boolean;
  onSelectPlayer?: (accountId: string) => void;
}

export function DotaProsTab({ pros, isLoading, onSelectPlayer }: DotaProsTabProps) {
  const [search, setSearch] = useState('');

  const filtered = pros.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.team_name || '').toLowerCase().includes(q) ||
      (p.team_tag || '').toLowerCase().includes(q) ||
      p.account_id.includes(q)
    );
  });

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-5 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            TI &amp; MAJOR TIER COMPETITION (GET /players/&#123;account_id&#125;/pros)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Professional Player Encounters
          </h3>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="px-2.5 py-1 bg-[#FFE600] text-black border-2 border-black font-black text-xs shrink-0 shadow-[2px_2px_0px_0px_#000]">
            {pros.length} Verified Pros Encountered
          </span>

          {pros.length > 0 && (
            <div className="relative flex-1 sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Search pro or team..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-stone-50 border-2 border-black pl-8 pr-3 py-1.5 text-xs font-mono font-bold"
              />
            </div>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading verified pro encounters from OpenDota...</p>
        </div>
      ) : pros.length === 0 ? (
        /* Empty state: No made-up pros */
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <TrophyIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No verified professional player encounters recorded.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            This account has no logged public matches with or against Valve-indexed professional esports players.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-600">
          No pro encounters match "{search}".
        </div>
      ) : (
        /* Real Pros Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((pro) => (
            <div
              key={pro.account_id}
              onClick={() => onSelectPlayer?.(pro.account_id)}
              className="p-4 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000] cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  {pro.avatar ? (
                    <img
                      src={pro.avatar}
                      alt={pro.name}
                      className="w-12 h-12 object-cover border-2 border-black bg-black shrink-0 shadow-[1.5px_1.5px_0px_0px_#000]"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-black text-[#FFE600] border-2 border-black flex items-center justify-center font-bold text-base shrink-0 shadow-[1.5px_1.5px_0px_0px_#000]">
                      {pro.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <strong className="text-black font-sans uppercase block text-base leading-tight truncate">
                        {pro.name}
                      </strong>
                      <ShieldCheckIcon className="w-4 h-4 text-blue-600 shrink-0" title="Valve Verified Professional" />
                    </div>
                    {pro.team_name && (
                      <span className="text-[10px] font-black text-purple-700 block truncate">
                        {pro.team_name} {pro.team_tag ? `[${pro.team_tag}]` : ''}
                      </span>
                    )}
                    <span className="text-[9px] text-stone-500 font-mono block">
                      ID: {pro.account_id}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-black block">
                    {pro.games} {pro.games === 1 ? 'Match' : 'Matches'}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-bold block">
                    {pro.win}W / {pro.games - pro.win}L
                  </span>
                </div>
              </div>

              {/* Stats Split: With vs Against */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/15 text-[11px]">
                <div className="p-2 bg-white border border-black/20 space-y-0.5">
                  <span className="text-[9px] text-stone-500 uppercase font-black block">Played Together</span>
                  <strong className="text-black block font-bold">
                    {pro.with_games} Matches ({pro.with_win}W)
                  </strong>
                  <span className="text-[10px] font-bold text-emerald-700 block">
                    {pro.with_games > 0 ? `${Math.round((pro.with_win / pro.with_games) * 100)}% WR` : '—'}
                  </span>
                </div>

                <div className="p-2 bg-white border border-black/20 space-y-0.5">
                  <span className="text-[9px] text-stone-500 uppercase font-black block">Played Against</span>
                  <strong className="text-black block font-bold">
                    {pro.against_games} Matches ({pro.against_win}W)
                  </strong>
                  <span className="text-[10px] font-bold text-purple-700 block">
                    {pro.against_games > 0 ? `${Math.round((pro.against_win / pro.against_games) * 100)}% WR` : '—'}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1">
                <span>Last match: {pro.last_played ? new Date(pro.last_played).toLocaleDateString() : '—'}</span>
                <span className="font-bold text-[#7C3AED] group-hover:underline flex items-center gap-1">
                  <span>View Dota Profile</span>
                  <ArrowRightIcon className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
