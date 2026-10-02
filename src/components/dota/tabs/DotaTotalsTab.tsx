import React from 'react';
import { 
  ChartBarIcon, 
  FireIcon, 
  ShieldCheckIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';

interface DotaTotalsTabProps {
  totals: OpenDotaPlayerSummary['totals'] | null;
  totalMatches?: number | null;
  isLoading?: boolean;
}

interface TotalRowItem {
  label: string;
  stat?: { sum: number; n: number; avg: number };
  isLargeNumber?: boolean;
  isRate?: boolean;
}

interface TotalCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: TotalRowItem[];
}

export function DotaTotalsTab({ totals, totalMatches, isLoading }: DotaTotalsTabProps) {
  const hasTotals = Boolean(
    totals && (
      totals.kills ||
      totals.deaths ||
      totals.assists ||
      totals.heroDamage ||
      totals.lastHits ||
      totals.gpm ||
      totals.xpm ||
      totals.towerDamage ||
      totals.heroHealing
    )
  );

  const categories: TotalCategory[] = [
    {
      name: 'Combat & Engagement',
      icon: FireIcon,
      rows: [
        { label: 'Total Kills', stat: totals?.kills },
        { label: 'Total Deaths', stat: totals?.deaths },
        { label: 'Total Assists', stat: totals?.assists },
        { label: 'Hero Damage', stat: totals?.heroDamage, isLargeNumber: true }
      ]
    },
    {
      name: 'Farm & Economy',
      icon: ChartBarIcon,
      rows: [
        { label: 'Cumulative Last Hits', stat: totals?.lastHits },
        { label: 'Average Gold / Min (GPM)', stat: totals?.gpm, isRate: true },
        { label: 'Average XP / Min (XPM)', stat: totals?.xpm, isRate: true }
      ]
    },
    {
      name: 'Objectives & Support',
      icon: ShieldCheckIcon,
      rows: [
        { label: 'Tower Damage', stat: totals?.towerDamage, isLargeNumber: true },
        { label: 'Hero Healing', stat: totals?.heroHealing, isLargeNumber: true }
      ]
    }
  ];

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            OPENDOTA AGGREGATES ENGINE (GET /players/&#123;account_id&#125;/totals)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Cumulative Career Totals &amp; Averages
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#FFE600] text-black border border-black font-black text-xs uppercase">
          {totalMatches ? `${totalMatches.toLocaleString()} Matches Logged` : 'Indexed Matches'}
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading career totals from OpenDota...</p>
        </div>
      ) : !hasTotals ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <ChartBarIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            Cumulative totals unavailable.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota has not indexed aggregate totals for this account ID.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, idx) => (
            <div key={idx} className="p-4 bg-stone-50 border-2 border-black space-y-4 shadow-[3px_3px_0px_0px_#000]">
              <div className="flex items-center gap-2 border-b border-black/10 pb-2">
                <cat.icon className="w-5 h-5 text-[#7C3AED]" />
                <h4 className="font-sans text-sm font-black uppercase text-black">
                  {cat.name}
                </h4>
              </div>

              <div className="space-y-3">
                {cat.rows.map((row, rIdx) => {
                  const stat = row.stat;
                  if (!stat) {
                    return (
                      <div key={rIdx} className="text-xs flex items-center justify-between opacity-50">
                        <span className="text-stone-500">{row.label}</span>
                        <span className="font-bold text-stone-400">—</span>
                      </div>
                    );
                  }

                  let totalDisplay = stat.sum.toLocaleString();
                  if (row.isLargeNumber) {
                    totalDisplay = stat.sum >= 1000000 
                      ? `${(stat.sum / 1000000).toFixed(2)}M` 
                      : `${(stat.sum / 1000).toFixed(1)}k`;
                  } else if (row.isRate) {
                    totalDisplay = '—';
                  }

                  let avgDisplay = String(stat.avg);
                  if (row.isLargeNumber) {
                    avgDisplay = stat.avg >= 1000 
                      ? `${(stat.avg / 1000).toFixed(1)}k` 
                      : String(stat.avg);
                  }

                  return (
                    <div key={rIdx} className="text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-black">{row.label}</span>
                        <span className="font-black text-purple-700 text-sm">{totalDisplay}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-stone-500">
                        <span>Avg / Match: <strong className="text-stone-700">{avgDisplay}</strong></span>
                        <span>Sample: {stat.n} Matches</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
