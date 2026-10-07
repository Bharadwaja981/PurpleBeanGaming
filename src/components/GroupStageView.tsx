import React, { useState, useMemo } from 'react';
import { Trophy, Swords, Shield, AlertTriangle, CheckCircle2, ChevronRight, Filter } from 'lucide-react';
import { TournamentStageConfig } from '../domain/dotaCompetitionEngine';

interface GroupStageViewProps {
  stage: TournamentStageConfig;
  tournamentId: string;
  onSelectMatch?: (matchId: string) => void;
}

export const GroupStageView: React.FC<GroupStageViewProps> = ({
  stage,
  tournamentId,
  onSelectMatch
}) => {
  const [filterGroup, setFilterGroup] = useState<'ALL' | string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'UPCOMING'>('ALL');

  const groups = stage.groups || [];
  const matches = stage.matches || [];

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (filterGroup !== 'ALL' && m.roundKey !== filterGroup) return false;
      if (filterStatus === 'COMPLETED' && m.status !== 'COMPLETED') return false;
      if (filterStatus === 'UPCOMING' && m.status !== 'UPCOMING') return false;
      return true;
    });
  }, [matches, filterGroup, filterStatus]);

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* 1. GROUPS STANDINGS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map((grp, gIdx) => (
          <div key={grp.id || gIdx} className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2.5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#7C3AED]" />
                <h4 className="font-sans font-black text-base uppercase text-black">
                  {grp.name} STANDINGS
                </h4>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-black uppercase text-stone-600">
                <span className="flex items-center gap-1 text-[#7C3AED]">
                  <span className="w-2 h-2 rounded-full bg-[#7C3AED] inline-block" />
                  1-2 UPPER BRACKET
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-indigo-800">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                  3-4 LOWER BRACKET
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121020] text-white uppercase text-[10px] border-b-2 border-black font-black">
                  <tr>
                    <th className="p-2 w-10 text-center">POS</th>
                    <th className="p-2">TEAM</th>
                    <th className="p-2 text-center">P</th>
                    <th className="p-2 text-center">W</th>
                    <th className="p-2 text-center">D</th>
                    <th className="p-2 text-center">L</th>
                    <th className="p-2 text-center">GW-GL</th>
                    <th className="p-2 text-center">DIFF</th>
                    <th className="p-2 text-center">PTS</th>
                    <th className="p-2 text-center">DESTINATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                  {grp.teams.map((tm, idx) => {
                    const isUpper = idx < 2;
                    return (
                      <tr key={tm.teamId || idx} className="hover:bg-yellow-50/50">
                        <td className="p-2 text-center font-black">
                          <span className={`w-5 h-5 inline-flex items-center justify-center border border-black font-black text-[11px] ${
                            isUpper ? 'bg-[#7C3AED] text-white' : 'bg-black text-white'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="p-2 font-black text-black">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{tm.logo || '🛡️'}</span>
                            <div>
                              <div className="text-xs">{tm.name}</div>
                              <span className="text-[10px] text-stone-500 font-bold uppercase">#{tm.seed || idx + 1} Seed</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-2 text-center font-bold text-stone-600">0</td>
                        <td className="p-2 text-center font-bold text-emerald-700">0</td>
                        <td className="p-2 text-center font-bold text-stone-500">0</td>
                        <td className="p-2 text-center font-bold text-rose-700">0</td>
                        <td className="p-2 text-center font-bold text-stone-600">0-0</td>
                        <td className="p-2 text-center font-bold text-stone-600">0</td>
                        <td className="p-2 text-center font-black text-sm text-purple-700">0</td>
                        <td className="p-2 text-center">
                          <span className={`px-2 py-0.5 border text-[10px] font-black uppercase tracking-wider ${
                            isUpper 
                              ? 'bg-purple-100 text-purple-900 border-purple-400' 
                              : 'bg-indigo-100 text-indigo-900 border-indigo-400'
                          }`}>
                            {isUpper ? 'UPPER BRACKET' : 'LOWER BRACKET'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* 2. OFFICIAL TIEBREAK RULES */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center gap-2 border-b-2 border-black pb-2">
          <Shield className="w-4 h-4 text-[#7C3AED]" />
          <h4 className="font-sans font-black text-sm uppercase text-black">
            OFFICIAL TIEBREAK RULES (COMPETITIVE PROTOCOL)
          </h4>
        </div>
        <p className="text-[11px] text-stone-600">
          Tied standings positions are decided strictly in order through the following sequence:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">1. Total Points</span>
            <p className="text-[10px] text-stone-600">3 for 2-0 win, 1 for 1-1 draw</p>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">2. Head-to-Head</span>
            <p className="text-[10px] text-stone-600">Matches between tied teams</p>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">3. Game Diff</span>
            <p className="text-[10px] text-stone-600">Games won minus games lost</p>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">4. Games Won</span>
            <p className="text-[10px] text-stone-600">Total individual game victories</p>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">5. Tiebreaker</span>
            <p className="text-[10px] text-stone-600">Decisive series for qualifying spot</p>
          </div>
        </div>
      </div>

      {/* 3. GROUP STAGE MATCHES & RESULTS */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#7C3AED]" />
              <h4 className="font-sans font-black text-base uppercase text-black">
                GROUP STAGE MATCHES &amp; RESULTS ({matches.length} SERIES)
              </h4>
            </div>
            <p className="text-[11px] text-stone-600 mt-0.5">
              {stage.defaultSeriesFormat || 'BO2'} Series · Win 2-0 = 3 pts • Draw 1-1 = 1 pt each • Loss 0-2 = 0 pts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-stone-100 p-1 border-2 border-black">
              {['ALL', ...groups.map(g => g.name)].map(opt => (
                <button
                  key={opt}
                  onClick={() => setFilterGroup(opt)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer ${
                    filterGroup === opt ? 'bg-[#7C3AED] text-white border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:text-black'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Matches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredMatches.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelectMatch?.(m.id)}
              className="border-2 border-black p-3 bg-white hover:bg-stone-50 cursor-pointer shadow-[3px_3px_0px_0px_#000] space-y-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
            >
              <div className="flex items-center justify-between text-[10px] border-b border-black/10 pb-1.5 font-bold">
                <span className="text-purple-700 uppercase">{m.round} · {m.seriesFormat}</span>
                <span className="bg-stone-100 border border-black px-1.5 py-0.2 uppercase text-stone-700 font-bold">
                  {m.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-black">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{m.teamA?.logo || '🛡️'}</span>
                    <span className="truncate">{m.teamA?.name || 'TBD'}</span>
                  </div>
                  <span className="bg-stone-100 border border-black px-2 py-0.5 font-black text-sm">
                    {m.scores?.teamA ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>{m.teamB?.logo || '🛡️'}</span>
                    <span className="truncate">{m.teamB?.name || 'TBD'}</span>
                  </div>
                  <span className="bg-stone-100 border border-black px-2 py-0.5 font-black text-sm">
                    {m.scores?.teamB ?? 0}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
