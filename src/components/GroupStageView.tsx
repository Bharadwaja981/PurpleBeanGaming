import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Swords, 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  Users, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { 
  TournamentStageConfig, 
  CompetitionMatchNode, 
  GroupConfig,
  GroupStandingRow,
  dotaCompetitionEngine 
} from '../domain/dotaCompetitionEngine';
import { tournamentService } from '../services/firebaseService';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';

interface GroupStageViewProps {
  stage: TournamentStageConfig;
  tournamentId: string;
  onSelectMatch?: (matchId: string) => void;
  onStructureUpdated?: () => void;
}

export const GroupStageView: React.FC<GroupStageViewProps> = ({
  stage,
  tournamentId,
  onSelectMatch,
  onStructureUpdated
}) => {
  const currentUser = tournamentService.getCurrentUser();
  const tourney = tournamentService.getTournamentById(tournamentId);
  const isOrganizer = currentUser.isAdmin || 
    currentUser.role === 'organizer' || 
    currentUser.id === tourney?.organizer || 
    currentUser.id === tourney?.organizerId ||
    currentUser.id === (tourney as any)?.organiserId ||
    currentUser.email?.toLowerCase().trim() === '11106cm009@gmail.com';

  const [filterGroup, setFilterGroup] = useState<'ALL' | string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'UPCOMING'>('ALL');

  // Scoring modal state
  const [scoringMatch, setScoringMatch] = useState<CompetitionMatchNode | null>(null);
  const [scoreA, setScoreA] = useState(1);
  const [scoreB, setScoreB] = useState(1);
  const [isForfeit, setIsForfeit] = useState(false);
  const [forfeitWinnerId, setForfeitWinnerId] = useState<string>('');
  const [mutationStatus, setMutationStatus] = useState<SubmissionStatus>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  const groups = stage.groups || [];
  const matches = stage.matches || [];

  // Calculate live authoritative standings for each group
  const groupStandingsMap = useMemo(() => {
    const map = new Map<string, GroupStandingRow[]>();
    groups.forEach(grp => {
      const calculated = dotaCompetitionEngine.calculateGroupStandings(grp, matches);
      map.set(grp.id, calculated);
    });
    return map;
  }, [groups, matches]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (filterGroup !== 'ALL') {
        const matchGroup = m.roundKey || (m.round?.includes('Group A') ? 'group-a' : m.round?.includes('Group B') ? 'group-b' : '');
        if (m.roundKey !== filterGroup && matchGroup !== filterGroup) return false;
      }
      if (filterStatus === 'COMPLETED' && m.status !== 'COMPLETED') return false;
      if (filterStatus === 'UPCOMING' && m.status !== 'UPCOMING') return false;
      return true;
    });
  }, [matches, filterGroup, filterStatus]);

  const handleOpenScoreModal = (m: CompetitionMatchNode) => {
    setScoringMatch(m);
    setScoreA(m.scores?.teamA ?? 1);
    setScoreB(m.scores?.teamB ?? 1);
    setIsForfeit(m.status === 'FORFEIT');
    setForfeitWinnerId(m.forfeitWinnerId || '');
    setMutationStatus('idle');
    setMutationError(null);
  };

  const handleSubmitScore = async () => {
    if (!scoringMatch) return;
    setMutationStatus('pending');
    setMutationError(null);

    const struct = dotaCompetitionEngine.getStructure(tournamentId);
    const res = await competitionClientService.recordMatchResult({
      tournamentId,
      stageId: scoringMatch.stageId || stage.id,
      matchId: scoringMatch.id,
      scoreA,
      scoreB,
      isForfeit,
      forfeitWinnerId: isForfeit ? forfeitWinnerId : undefined,
      clientVersion: struct?.version
    });

    if (res.success) {
      setMutationStatus('confirmed');
      if (onStructureUpdated) onStructureUpdated();
      setTimeout(() => {
        setScoringMatch(null);
        setMutationStatus('idle');
      }, 1000);
    } else {
      setMutationStatus('failed');
      setMutationError(res.error || 'Server rejected match result confirmation.');
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* 1. GROUPS STANDINGS CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map((grp, gIdx) => {
          const rows = groupStandingsMap.get(grp.id) || [];

          return (
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
                    Top 2 Upper Bracket
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 text-indigo-800">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block" />
                    3-4 Lower Bracket
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121020] text-white uppercase text-[10px] border-b-2 border-black font-black">
                    <tr>
                      <th className="p-2 w-10 text-center">POS</th>
                      <th className="p-2">TEAM</th>
                      <th className="p-2 text-center" title="Played">P</th>
                      <th className="p-2 text-center" title="Won">W</th>
                      <th className="p-2 text-center" title="Drawn (BO2)">D</th>
                      <th className="p-2 text-center" title="Lost">L</th>
                      <th className="p-2 text-center" title="Games Won - Lost">GW-GL</th>
                      <th className="p-2 text-center" title="Game Differential">DIFF</th>
                      <th className="p-2 text-center" title="Points (3/1/0)">PTS</th>
                      <th className="p-2 text-center">QUALIFICATION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 font-bold">
                    {rows.map((row, idx) => {
                      const isUpper = idx < 2;
                      const isLower = idx >= 2 && idx < 4;

                      return (
                        <tr key={row.teamId || idx} className="hover:bg-yellow-50/50">
                          <td className="p-2 text-center font-black">
                            <span className={`w-5 h-5 inline-flex items-center justify-center border border-black font-black text-[11px] ${
                              isUpper ? 'bg-[#7C3AED] text-white' : isLower ? 'bg-indigo-600 text-white' : 'bg-stone-200 text-black'
                            }`}>
                              {idx + 1}
                            </span>
                          </td>
                          <td className="p-2 font-black text-black">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{row.logo || '🛡️'}</span>
                              <div>
                                <div className="text-xs truncate max-w-[120px]">{row.teamName}</div>
                                <span className="text-[10px] text-stone-500 font-bold uppercase">
                                  #{row.seed || idx + 1} Seed
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-2 text-center font-bold text-stone-600">{row.played}</td>
                          <td className="p-2 text-center font-black text-emerald-700">{row.won}</td>
                          <td className="p-2 text-center font-bold text-amber-700">{row.drawn}</td>
                          <td className="p-2 text-center font-bold text-rose-700">{row.lost}</td>
                          <td className="p-2 text-center font-bold text-stone-600">{row.gamesWon}-{row.gamesLost}</td>
                          <td className="p-2 text-center font-bold text-stone-700">
                            {row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}
                          </td>
                          <td className="p-2 text-center font-black text-sm text-[#7C3AED]">
                            {row.points}
                          </td>
                          <td className="p-2 text-center">
                            <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-wider inline-block ${
                              isUpper 
                                ? 'bg-purple-100 text-purple-900 border-purple-400' 
                                : isLower
                                ? 'bg-indigo-100 text-indigo-900 border-indigo-400'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}>
                              {isUpper ? 'UPPER BRACKET' : isLower ? 'LOWER BRACKET' : 'ELIMINATED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
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
          Standings in Group Stage are calculated via standard esports scoring (3 points for 2-0 Win, 1 point for 1-1 Draw, 0 points for Loss). Ties are resolved strictly in order:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">1. Total Points</span>
            <p className="text-[10px] text-stone-600">3 for 2-0 win, 1 for 1-1 draw</p>
          </div>
          <div className="p-3 bg-stone-50 border-2 border-black space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-700 block">2. Head-to-Head</span>
            <p className="text-[10px] text-stone-600">Direct series between tied teams</p>
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
            <span className="text-[10px] font-black uppercase text-purple-700 block">5. Initial Seed</span>
            <p className="text-[10px] text-stone-600">Lower initial seed number breaks tie</p>
          </div>
        </div>
      </div>

      {/* 3. GROUP STAGE MATCH FIXTURES & BO2 RESULTS */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#7C3AED]" />
              <h4 className="font-sans font-black text-base uppercase text-black">
                GROUP FIXTURES &amp; MATCH RESULTS ({matches.length})
              </h4>
            </div>
            <p className="text-[11px] text-stone-600 font-bold mt-0.5">
              Round-Robin Schedule • Best of 2 Series (Draws Allowed)
            </p>
          </div>

          {/* Group and Status Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setFilterGroup('ALL')}
                className={`px-2.5 py-1 text-[10px] font-black uppercase border border-black cursor-pointer ${
                  filterGroup === 'ALL' ? 'bg-black text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                }`}
              >
                All Groups
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setFilterGroup(g.id)}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase border border-black cursor-pointer ${
                    filterGroup === g.id ? 'bg-[#7C3AED] text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 border-l-2 border-black pl-2">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2 py-1 text-[10px] font-bold uppercase border border-black cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-black text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('COMPLETED')}
                className={`px-2 py-1 text-[10px] font-bold uppercase border border-black cursor-pointer ${
                  filterStatus === 'COMPLETED' ? 'bg-emerald-600 text-white' : 'bg-stone-100 text-black hover:bg-stone-200'
                }`}
              >
                Played
              </button>
              <button
                onClick={() => setFilterStatus('UPCOMING')}
                className={`px-2 py-1 text-[10px] font-bold uppercase border border-black cursor-pointer ${
                  filterStatus === 'UPCOMING' ? 'bg-amber-500 text-black' : 'bg-stone-100 text-black hover:bg-stone-200'
                }`}
              >
                Upcoming
              </button>
            </div>
          </div>
        </div>

        {/* Fixtures Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {filteredMatches.map(m => {
            const isWinnerA = m.status === 'COMPLETED' && (m.scores?.teamA ?? 0) > (m.scores?.teamB ?? 0);
            const isWinnerB = m.status === 'COMPLETED' && (m.scores?.teamB ?? 0) > (m.scores?.teamA ?? 0);
            const isDraw = m.status === 'COMPLETED' && (m.scores?.teamA === m.scores?.teamB);

            return (
              <div 
                key={m.id}
                className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_#000] space-y-2 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] font-bold border-b border-black/10 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#7C3AED] uppercase font-black">{m.round}</span>
                    <span className="bg-stone-200 border border-black/30 px-1 py-0.2 text-[9px] font-mono">
                      {m.seriesFormat || 'BO2'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isDraw && (
                      <span className="bg-amber-100 text-amber-900 border border-amber-300 px-1 py-0.2 text-[9px] font-black uppercase">
                        DRAW (1-1)
                      </span>
                    )}
                    <span className={`border border-black px-1.5 py-0.2 uppercase text-[9px] font-black ${
                      m.status === 'LIVE' ? 'bg-[#FF3366] text-white animate-pulse' :
                      m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black' :
                      'bg-stone-100 text-stone-700'
                    }`}>
                      {m.status || 'UPCOMING'}
                    </span>
                  </div>
                </div>

                {/* Team A */}
                <div className={`flex items-center justify-between text-xs font-bold py-0.5 ${isWinnerA ? 'text-black font-black' : isWinnerB ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm">{m.teamA?.logo || '🛡️'}</span>
                    <span className="truncate">{m.teamA?.name || 'TBD'}</span>
                    {m.teamA?.seed ? (
                      <span className="text-[9px] text-stone-400">#{m.teamA.seed}</span>
                    ) : null}
                  </div>
                  <span className={`border border-black px-2 py-0.5 font-black text-xs ${
                    isWinnerA ? 'bg-[#70FFAF]' : isDraw ? 'bg-amber-100' : 'bg-stone-100'
                  }`}>
                    {m.scores?.teamA ?? 0}
                  </span>
                </div>

                {/* Team B */}
                <div className={`flex items-center justify-between text-xs font-bold py-0.5 ${isWinnerB ? 'text-black font-black' : isWinnerA ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-sm">{m.teamB?.logo || '🛡️'}</span>
                    <span className="truncate">{m.teamB?.name || 'TBD'}</span>
                    {m.teamB?.seed ? (
                      <span className="text-[9px] text-stone-400">#{m.teamB.seed}</span>
                    ) : null}
                  </div>
                  <span className={`border border-black px-2 py-0.5 font-black text-xs ${
                    isWinnerB ? 'bg-[#70FFAF]' : isDraw ? 'bg-amber-100' : 'bg-stone-100'
                  }`}>
                    {m.scores?.teamB ?? 0}
                  </span>
                </div>

                {/* Actions */}
                <div className="pt-1 border-t border-black/10 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onSelectMatch?.(m.id)}
                    className="text-[10px] text-stone-600 hover:text-black font-bold uppercase underline cursor-pointer"
                  >
                    Match Details
                  </button>

                  {isOrganizer && (
                    <button
                      onClick={() => handleOpenScoreModal(m)}
                      className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
                        m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black hover:bg-[#58e094]' : 'bg-[#FFE600] text-black hover:bg-yellow-400'
                      }`}
                    >
                      {m.status === 'COMPLETED' ? 'Edit Score' : 'Record Score'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. SCORING MODAL */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div>
                <h3 className="font-sans font-black text-base uppercase text-black">
                  Record Group Match Score
                </h3>
                <span className="text-[10px] text-stone-500 font-bold uppercase">
                  {scoringMatch.round} · {scoringMatch.seriesFormat || 'BO2'} (Draws Allowed)
                </span>
              </div>
              <button onClick={() => setScoringMatch(null)} className="font-black text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div className="border-2 border-black p-3 bg-stone-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-black text-sm truncate max-w-[180px]">
                    {scoringMatch.teamA?.name || 'Team A'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-500">Wins:</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={scoreA}
                      onChange={e => setScoreA(Number(e.target.value))}
                      className="w-16 border-2 border-black p-1 text-center font-black text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-stone-200 pt-2">
                  <span className="font-black text-black text-sm truncate max-w-[180px]">
                    {scoringMatch.teamB?.name || 'Team B'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-stone-500">Wins:</span>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      value={scoreB}
                      onChange={e => setScoreB(Number(e.target.value))}
                      className="w-16 border-2 border-black p-1 text-center font-black text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* BO2 Quick Selector Buttons */}
              <div className="flex items-center justify-between gap-1 text-[10px] font-black">
                <button
                  type="button"
                  onClick={() => { setScoreA(2); setScoreB(0); }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-black cursor-pointer"
                >
                  2 - 0 Win
                </button>
                <button
                  type="button"
                  onClick={() => { setScoreA(1); setScoreB(1); }}
                  className="px-2 py-1 bg-amber-100 hover:bg-amber-200 border border-black cursor-pointer text-amber-900"
                >
                  1 - 1 Draw
                </button>
                <button
                  type="button"
                  onClick={() => { setScoreA(0); setScoreB(2); }}
                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 border border-black cursor-pointer"
                >
                  0 - 2 Win
                </button>
              </div>

              {mutationStatus === 'pending' && (
                <div className="p-2 bg-[#FFFBEB] border-2 border-amber-900 text-amber-900 font-bold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting score to authoritative server...</span>
                </div>
              )}

              {mutationStatus === 'confirmed' && (
                <div className="p-2 bg-[#E6FFFA] border-2 border-emerald-900 text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>✓ Score confirmed &amp; group standings updated!</span>
                </div>
              )}

              {mutationStatus === 'failed' && (
                <div className="p-2 bg-rose-50 border-2 border-rose-900 text-rose-900 font-bold space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />
                    <span>Submission Rejected</span>
                  </div>
                  <div className="text-[10px] leading-tight">
                    {mutationError || 'Server rejected match result confirmation.'}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t-2 border-black flex items-center justify-between gap-2">
              <span className="text-[9px] text-stone-500 uppercase">
                Authoritative Submission
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={mutationStatus === 'pending'}
                  onClick={() => setScoringMatch(null)}
                  className="px-3 py-1.5 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={mutationStatus === 'pending'}
                  onClick={handleSubmitScore}
                  className="px-4 py-1.5 bg-[#FFE600] hover:bg-yellow-400 disabled:opacity-50 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Confirm Official Result
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
