import React, { useState, useMemo } from 'react';
import { 
  UsersIcon, 
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';
import { OpenDotaPeer } from '../../../services/openDotaService';
import { pbgAccountRegistry } from '../../../domain/pbgAccountRegistry';

interface DotaTeammatesTabProps {
  peers: OpenDotaPeer[];
  isLoading?: boolean;
  onSelectPlayer: (accountId: string) => void;
}

type SortField = 'with_games' | 'with_winrate' | 'against_games' | 'against_winrate' | 'last_played';

export function DotaTeammatesTab({ peers, isLoading, onSelectPlayer }: DotaTeammatesTabProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('with_games');
  const [sortAsc, setSortAsc] = useState(false);

  const filteredAndSorted = useMemo(() => {
    let list = peers;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((p) => {
        const name = (p.personaname || '').toLowerCase();
        const proName = (p.name || '').toLowerCase();
        const id = String(p.account_id);
        return name.includes(q) || proName.includes(q) || id.includes(q);
      });
    }

    return [...list].sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (sortBy === 'with_games') {
        valA = a.with_games;
        valB = b.with_games;
      } else if (sortBy === 'with_winrate') {
        valA = a.with_games > 0 ? (a.with_win / a.with_games) * 100 : 0;
        valB = b.with_games > 0 ? (b.with_win / b.with_games) * 100 : 0;
      } else if (sortBy === 'against_games') {
        valA = a.against_games;
        valB = b.against_games;
      } else if (sortBy === 'against_winrate') {
        valA = a.against_games > 0 ? (a.against_win / a.against_games) * 100 : 0;
        valB = b.against_games > 0 ? (b.against_win / b.against_games) * 100 : 0;
      } else if (sortBy === 'last_played') {
        valA = a.last_played || 0;
        valB = b.last_played || 0;
      }

      return sortAsc ? valA - valB : valB - valA;
    });
  }, [peers, search, sortBy, sortAsc]);

  const handleToggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-5 font-mono">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            OPENDOTA PEERS TELEMETRY (GET /players/&#123;account_id&#125;/peers)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Teammates &amp; Opponents
          </h3>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="px-2.5 py-1 bg-[#FFE600] text-black border-2 border-black font-black text-xs shrink-0 shadow-[2px_2px_0px_0px_#000]">
            {peers.length} Peers Indexed
          </span>

          <div className="relative flex-1 sm:w-64">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-stone-50 border-2 border-black pl-8 pr-3 py-1.5 text-xs font-mono font-bold"
            />
          </div>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading teammate telemetry from OpenDota...</p>
        </div>
      ) : peers.length === 0 ? (
        /* Empty state: No mock fallback */
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <UsersIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No teammate data available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota has not indexed frequent teammates or opponent encounters for this Dota account ID yet.
          </p>
        </div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-8 bg-stone-50 border-2 border-black text-center text-xs text-stone-600">
          No peers match "{search}".
        </div>
      ) : (
        /* Real Teammate Rows Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b-2 border-black text-stone-700 uppercase text-[9px]">
                <th className="p-3">Player</th>
                <th className="p-3">Dota Account ID</th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-stone-200 transition-colors"
                  onClick={() => handleToggleSort('with_games')}
                  title="Click to sort by matches together"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Matches Together</span>
                    <ArrowsUpDownIcon className="w-3 h-3 text-stone-500" />
                  </div>
                </th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-stone-200 transition-colors"
                  onClick={() => handleToggleSort('with_winrate')}
                  title="Click to sort by winrate together"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>With (W / WR)</span>
                    <ArrowsUpDownIcon className="w-3 h-3 text-stone-500" />
                  </div>
                </th>
                <th 
                  className="p-3 text-center cursor-pointer hover:bg-stone-200 transition-colors"
                  onClick={() => handleToggleSort('against_games')}
                  title="Click to sort by matches against"
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Against (W / WR)</span>
                    <ArrowsUpDownIcon className="w-3 h-3 text-stone-500" />
                  </div>
                </th>
                <th className="p-3 text-right">Avg GPM / XPM (With)</th>
                <th 
                  className="p-3 text-right cursor-pointer hover:bg-stone-200 transition-colors"
                  onClick={() => handleToggleSort('last_played')}
                >
                  <div className="inline-flex items-center gap-1">
                    <span>Last Played</span>
                    <ArrowsUpDownIcon className="w-3 h-3 text-stone-500" />
                  </div>
                </th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {filteredAndSorted.map((peer) => {
                const pbgAcc = pbgAccountRegistry.getAccountByDotaId(String(peer.account_id));
                const withWinRate = peer.with_games > 0 ? Math.round((peer.with_win / peer.with_games) * 100) : 0;
                const againstWinRate = peer.against_games > 0 ? Math.round((peer.against_win / peer.against_games) * 100) : 0;
                const avgGpm = peer.with_games > 0 && typeof peer.with_gpm_sum === 'number' 
                  ? Math.round(peer.with_gpm_sum / peer.with_games) 
                  : null;
                const avgXpm = peer.with_games > 0 && typeof peer.with_xpm_sum === 'number' 
                  ? Math.round(peer.with_xpm_sum / peer.with_games) 
                  : null;
                const avatar = peer.avatarfull || peer.avatar;

                return (
                  <tr 
                    key={peer.account_id}
                    className="hover:bg-[#FFF9E6] transition-colors group cursor-pointer"
                    onClick={() => onSelectPlayer(String(peer.account_id))}
                  >
                    {/* Steam / OpenDota Avatar & Name */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt={peer.personaname || 'Player Avatar'}
                            className="w-9 h-9 object-cover border-2 border-black bg-black shrink-0 shadow-[1.5px_1.5px_0px_0px_#000]"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-9 h-9 bg-black text-[#FFE600] border-2 border-black flex items-center justify-center font-bold text-xs shrink-0 shadow-[1.5px_1.5px_0px_0px_#000]">
                            {(peer.personaname || peer.name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-black font-black block truncate max-w-[160px] text-xs">
                              {peer.personaname || `Anonymous Contender`}
                            </strong>
                            {peer.name && (
                              <span className="px-1 py-0.2 bg-blue-100 text-blue-900 border border-black text-[9px] font-bold">
                                {peer.name}
                              </span>
                            )}
                          </div>

                          {/* PBG Link Badge - Only shown if real PBG account exists */}
                          {pbgAcc ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 font-black">
                              <ShieldCheckIcon className="w-3 h-3 text-[#7C3AED]" />
                              <span>PBG LINKED · {pbgAcc.pbgId}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 block">
                              Public Dota Player
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Dota Account ID */}
                    <td className="p-3 text-stone-700 font-mono font-bold">
                      {peer.account_id}
                    </td>

                    {/* Matches Together */}
                    <td className="p-3 text-center">
                      <span className="font-mono font-black text-sm text-black">
                        {peer.with_games}
                      </span>
                    </td>

                    {/* With Games (Wins & Win Rate) */}
                    <td className="p-3 text-center">
                      {peer.with_games > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-emerald-700">
                            {peer.with_win}W / {peer.with_games - peer.with_win}L
                          </span>
                          <div className="text-[10px] font-black text-black">
                            {withWinRate}% WR
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Against Games (Wins & Win Rate) */}
                    <td className="p-3 text-center">
                      {peer.against_games > 0 ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-stone-800">
                            {peer.against_win}W / {peer.against_games - peer.against_win}L
                          </span>
                          <div className="text-[10px] font-black text-purple-700">
                            {againstWinRate}% WR
                          </div>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Avg GPM & XPM Together where derivable */}
                    <td className="p-3 text-right">
                      {avgGpm !== null || avgXpm !== null ? (
                        <div className="space-y-0.5">
                          <span className="font-bold text-amber-600 block">
                            {avgGpm !== null ? `${avgGpm} GPM` : '—'}
                          </span>
                          <span className="text-[10px] text-blue-600 font-bold block">
                            {avgXpm !== null ? `${avgXpm} XPM` : '—'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Last Played */}
                    <td className="p-3 text-right text-stone-600 text-[11px]">
                      {peer.last_played ? new Date(peer.last_played * 1000).toLocaleDateString() : '—'}
                    </td>

                    {/* Action Button: View Profile */}
                    <td className="p-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlayer(String(peer.account_id));
                        }}
                        className="px-2.5 py-1 bg-white group-hover:bg-[#FFE600] text-black border-2 border-black font-mono text-[10px] font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000] inline-flex items-center gap-1 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                      >
                        <span>Profile</span>
                        <ArrowRightIcon className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
