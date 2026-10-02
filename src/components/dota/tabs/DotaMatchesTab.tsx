import React, { useState, useMemo } from 'react';
import { 
  ArrowRightIcon, 
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';
import { getHeroImage, getHeroName } from '../../../services/dotaConstants';
import { DotaItemIcon } from '../DotaItemIcon';
import { DotaFilterState } from '../DotaGlobalFilters';

interface DotaMatchesTabProps {
  matches: OpenDotaPlayerSummary['recentMatches'];
  isLoading?: boolean;
  filters: DotaFilterState;
  onOpenMatch: (matchId: string) => void;
}

export function DotaMatchesTab({
  matches,
  isLoading = false,
  filters,
  onOpenMatch
}: DotaMatchesTabProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter matches based on global filter controls
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filters.heroId !== 'all' && m.heroId !== filters.heroId) return false;
      if (filters.side === 'radiant' && !m.isRadiant) return false;
      if (filters.side === 'dire' && m.isRadiant) return false;
      if (filters.result === 'win' && !m.playerWon) return false;
      if (filters.result === 'loss' && m.playerWon) return false;
      if (filters.gameMode !== 'all' && m.gameMode !== filters.gameMode) return false;
      if (filters.lobbyType !== 'all' && m.lobbyType !== filters.lobbyType) return false;
      return true;
    });
  }, [matches, filters]);

  const totalPages = Math.ceil(filteredMatches.length / pageSize) || 1;
  const paginatedMatches = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMatches.slice(start, start + pageSize);
  }, [filteredMatches, currentPage, pageSize]);

  return (
    <div className="bg-white border-[3px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            HISTORICAL MATCH RECORD (GET /players/&#123;account_id&#125;/matches)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Competitive Matches Browser
          </h3>
        </div>

        <div className="text-xs font-bold text-stone-600">
          Page {currentPage} of {totalPages} ({filteredMatches.length} Matches)
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading verified match telemetry...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="p-10 bg-stone-50 border-2 border-black text-center text-xs text-stone-600 space-y-2">
          <p>No matches found matching current filters.</p>
          <span className="text-[10px] text-stone-500 block">Try clearing filters in the top filter bar.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead>
              <tr className="bg-stone-100 border-b-2 border-black text-stone-600 uppercase text-[9px]">
                <th className="p-2.5">Hero</th>
                <th className="p-2.5">Result</th>
                <th className="p-2.5">Match ID</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Duration</th>
                <th className="p-2.5 text-center">K / D / A</th>
                <th className="p-2.5 text-right">GPM / XPM</th>
                <th className="p-2.5 text-right">Last Hits</th>
                <th className="p-2.5 text-right">Hero DMG</th>
                <th className="p-2.5">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {paginatedMatches.map((m) => (
                <tr
                  key={m.matchId}
                  onClick={() => onOpenMatch(m.matchId)}
                  className="hover:bg-[#FFF9E6] cursor-pointer transition-colors group"
                >
                  <td className="p-2.5">
                    <div className="flex items-center gap-2">
                      <img
                        src={getHeroImage(m.heroId)}
                        alt={getHeroName(m.heroId)}
                        className="w-8 h-8 object-cover border border-black bg-stone-900 shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getHeroImage(null);
                        }}
                      />
                      <div>
                        <strong className="text-black text-xs block truncate max-w-[110px]">{getHeroName(m.heroId)}</strong>
                        <span className="text-[9px] text-stone-500">{m.isRadiant ? 'The Radiant' : 'The Dire'}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-2.5">
                    <span className={`px-2 py-0.5 border border-black text-[9px] font-black uppercase ${
                      m.playerWon ? 'bg-[#70FFAF] text-black' : 'bg-[#FF5757] text-white'
                    }`}>
                      {m.playerWon ? 'WON' : 'LOST'}
                    </span>
                  </td>
                  <td className="p-2.5 text-stone-700 font-mono text-[11px]">
                    #{m.matchId}
                  </td>
                  <td className="p-2.5 text-stone-600 text-[11px] truncate max-w-[100px]">
                    {m.gameMode || 'Match'}
                  </td>
                  <td className="p-2.5 text-stone-800 font-bold">
                    {m.durationMinutes}m
                  </td>
                  <td className="p-2.5 text-center font-bold text-xs">
                    <span className="text-emerald-700">{m.kills}</span> /{' '}
                    <span className="text-red-600">{m.deaths}</span> /{' '}
                    <span className="text-stone-600">{m.assists}</span>
                  </td>
                  <td className="p-2.5 text-right font-bold text-[11px]">
                    {m.gpm != null ? m.gpm : '—'} / {m.xpm != null ? m.xpm : '—'}
                  </td>
                  <td className="p-2.5 text-right text-stone-700 font-bold text-[11px]">
                    {m.lastHits != null ? m.lastHits : '—'}
                  </td>
                  <td className="p-2.5 text-right font-bold text-red-700 text-[11px]">
                    {m.heroDamage != null ? `${(m.heroDamage / 1000).toFixed(1)}k` : '—'}
                  </td>
                  <td className="p-2.5">
                    {m.items && m.items.length > 0 ? (
                      <div className="flex items-center gap-1">
                        {m.items.slice(0, 6).map((itemId, idx) => (
                          <DotaItemIcon key={idx} itemIdOrName={itemId} size="sm" />
                        ))}
                        {m.itemNeutral ? (
                          <div className="ml-0.5 pl-0.5 border-l border-stone-300">
                            <DotaItemIcon itemIdOrName={m.itemNeutral} size="sm" isNeutral />
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-stone-400 font-mono text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black font-black text-xs uppercase disabled:opacity-40 cursor-pointer flex items-center gap-1"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Previous</span>
          </button>
          <span className="text-xs font-bold">
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black font-black text-xs uppercase disabled:opacity-40 cursor-pointer flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
