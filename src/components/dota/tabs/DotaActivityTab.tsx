import React, { useMemo } from 'react';
import { CalendarDaysIcon, FireIcon } from '@heroicons/react/24/outline';
import { OpenDotaPlayerSummary } from '../../../services/openDotaService';

interface DotaActivityTabProps {
  matches?: OpenDotaPlayerSummary['recentMatches'];
  isLoading?: boolean;
}

export function DotaActivityTab({ matches = [], isLoading }: DotaActivityTabProps) {
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Calculate real activity grid from actual match timestamps
  const { dayCounts, hourCounts, maxDayCount, maxHourCount } = useMemo(() => {
    const days = [0, 0, 0, 0, 0, 0, 0]; // Mon=0 .. Sun=6
    const hours = Array(24).fill(0);

    for (const m of matches) {
      if (!m.startTime) continue;
      const d = new Date(m.startTime);
      if (isNaN(d.getTime())) continue;

      // getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
      const jsDay = d.getDay();
      const monDayIdx = jsDay === 0 ? 6 : jsDay - 1;
      days[monDayIdx] = (days[monDayIdx] || 0) + 1;

      const hour = d.getHours();
      hours[hour] = (hours[hour] || 0) + 1;
    }

    const maxDay = Math.max(...days, 1);
    const maxHour = Math.max(...hours, 1);

    return {
      dayCounts: days,
      hourCounts: hours,
      maxDayCount: maxDay,
      maxHourCount: maxHour
    };
  }, [matches]);

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            TEMPORAL ACTIVITY PUNCHCARD (DERIVED FROM PARSED MATCH TIMESTAMPS)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Match Activity &amp; Schedule Analysis
          </h3>
        </div>
        <span className="px-2 py-0.5 bg-[#FFE600] text-black border border-black font-black text-xs uppercase">
          {matches.length} Matches Sampled
        </span>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading temporal activity...</p>
        </div>
      ) : matches.length === 0 ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <CalendarDaysIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No match activity data available.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota returned no indexed matches with start timestamps to compute schedule activity.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Day of week breakdown */}
          <div className="p-4 bg-stone-50 border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <span className="font-sans font-black text-xs uppercase text-black block border-b border-black/10 pb-1.5">
              Activity by Day of Week
            </span>
            <div className="space-y-2 text-xs">
              {daysOfWeek.map((day, idx) => {
                const count = dayCounts[idx] || 0;
                const pct = Math.round((count / maxDayCount) * 100);

                return (
                  <div key={day} className="flex items-center gap-3">
                    <span className="w-10 font-bold text-stone-700">{day}</span>
                    <div className="flex-1 bg-stone-200 h-3 border border-black overflow-hidden">
                      <div
                        className="bg-[#7C3AED] h-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 font-black text-black text-right">
                      {count} {count === 1 ? 'match' : 'matches'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time of day breakdown */}
          <div className="p-4 bg-stone-50 border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <span className="font-sans font-black text-xs uppercase text-black block border-b border-black/10 pb-1.5">
              Activity by Time of Day (24h)
            </span>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 text-center">
              {hourCounts.map((count, hour) => {
                const isPeak = count > 0 && count === maxHourCount;
                return (
                  <div
                    key={hour}
                    className={`p-1.5 border border-black text-[10px] space-y-0.5 ${
                      isPeak 
                        ? 'bg-[#FFE600] font-black shadow-[1px_1px_0px_0px_#000]' 
                        : count > 0 
                        ? 'bg-purple-100 text-purple-900 font-bold' 
                        : 'bg-white text-stone-400'
                    }`}
                    title={`${hour}:00 - ${hour}:59 : ${count} matches`}
                  >
                    <span className="block text-[8px] text-stone-500">{hour}h</span>
                    <strong className="block text-xs">{count}</strong>
                  </div>
                );
              })}
            </div>

            <p className="text-[10px] text-stone-500 pt-2 border-t border-black/10">
              Aggregated in local browser time zone based on match start time.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
