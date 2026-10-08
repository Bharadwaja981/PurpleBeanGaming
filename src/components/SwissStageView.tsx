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
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { 
  TournamentStageConfig, 
  CompetitionMatchNode, 
  SeededTeam,
  dotaCompetitionEngine 
} from '../domain/dotaCompetitionEngine';
import { tournamentService } from '../services/firebaseService';
import { competitionClientService, SubmissionStatus } from '../services/competitionClientService';

interface SwissStageViewProps {
  stage: TournamentStageConfig;
  tournamentId: string;
  onSelectMatch?: (matchId: string) => void;
  onStructureUpdated?: () => void;
}

interface SwissTeamStanding {
  teamId: string;
  name: string;
  tag?: string;
  seed?: number;
  logo?: string;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  points: number;
  status: 'QUALIFIED' | 'CONTENTION' | 'RISK' | 'ELIMINATED';
}

export const SwissStageView: React.FC<SwissStageViewProps> = ({
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

  const [activeRoundFilter, setActiveRoundFilter] = useState<'ALL' | string>('ALL');
  
  // Scoring Modal State
  const [scoringMatch, setScoringMatch] = useState<CompetitionMatchNode | null>(null);
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(0);
  const [isForfeit, setIsForfeit] = useState(false);
  const [forfeitWinnerId, setForfeitWinnerId] = useState<string>('');
  const [mutationStatus, setMutationStatus] = useState<SubmissionStatus>('idle');
  const [mutationError, setMutationError] = useState<string | null>(null);

  const matches = stage.matches || [];

  // Group matches by round
  const roundKeys = useMemo(() => {
    const set = new Set<string>();
    matches.forEach(m => {
      if (m.round) set.add(m.round);
    });
    return Array.from(set);
  }, [matches]);

  // Compute live Swiss standings dynamically from actual completed matches
  const standings = useMemo<SwissTeamStanding[]>(() => {
    const table = new Map<string, SwissTeamStanding>();

    // Seed teams from stage or matches
    const allTeams: SeededTeam[] = stage.seededTeams || [];
    allTeams.forEach(t => {
      const tId = t.teamId || (t as any).id || t.name;
      table.set(tId, {
        teamId: tId,
        name: t.name,
        tag: t.tag,
        seed: t.seed,
        logo: t.logo || '🛡️',
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDiff: 0,
        points: 0,
        status: 'CONTENTION'
      });
    });

    // Also populate teams discovered in matches if not already seeded
    matches.forEach(m => {
      if (m.teamA?.teamId && !table.has(m.teamA.teamId)) {
        table.set(m.teamA.teamId, {
          teamId: m.teamA.teamId,
          name: m.teamA.name,
          tag: m.teamA.tag,
          seed: m.teamA.seed,
          logo: m.teamA.logo || '🛡️',
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          gamesWon: 0,
          gamesLost: 0,
          gameDiff: 0,
          points: 0,
          status: 'CONTENTION'
        });
      }
      if (m.teamB?.teamId && !table.has(m.teamB.teamId)) {
        table.set(m.teamB.teamId, {
          teamId: m.teamB.teamId,
          name: m.teamB.name,
          tag: m.teamB.tag,
          seed: m.teamB.seed,
          logo: m.teamB.logo || '🛡️',
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          gamesWon: 0,
          gamesLost: 0,
          gameDiff: 0,
          points: 0,
          status: 'CONTENTION'
        });
      }
    });

    // Calculate outcomes from completed/forfeited matches
    matches.forEach(m => {
      if ((m.status !== 'COMPLETED' && m.status !== 'FORFEIT') || !m.scores) return;
      const tAId = m.teamA?.teamId || m.teamA?.id;
      const tBId = m.teamB?.teamId || m.teamB?.id;
      if (!tAId || !tBId) return;

      const rowA = table.get(tAId);
      const rowB = table.get(tBId);
      if (!rowA || !rowB) return;

      const sA = m.scores.teamA ?? 0;
      const sB = m.scores.teamB ?? 0;

      rowA.matchesPlayed += 1;
      rowB.matchesPlayed += 1;
      rowA.gamesWon += sA;
      rowA.gamesLost += sB;
      rowB.gamesWon += sB;
      rowB.gamesLost += sA;

      if (sA > sB || (m.status === 'FORFEIT' && m.forfeitWinnerId === tAId)) {
        rowA.matchesWon += 1;
        rowA.points += 3;
        rowB.matchesLost += 1;
      } else if (sB > sA || (m.status === 'FORFEIT' && m.forfeitWinnerId === tBId)) {
        rowB.matchesWon += 1;
        rowB.points += 3;
        rowA.matchesLost += 1;
      } else {
        // Draw
        rowA.points += 1;
        rowB.points += 1;
      }

      rowA.gameDiff = rowA.gamesWon - rowA.gamesLost;
      rowB.gameDiff = rowB.gamesWon - rowB.gamesLost;
    });

    const rows = Array.from(table.values());

    // Total rounds in Swiss
    const totalRounds = stage.swissRoundsCount || 3;
    const qualifyThreshold = Math.ceil(totalRounds * 0.67); // e.g. 2 wins in 3 rounds or 3 in 5

    // Sort by: 1. Matches Won, 2. Points, 3. Game Diff, 4. Games Won, 5. Seed
    rows.sort((a, b) => {
      if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
      if (b.points !== a.points) return b.points - a.points;
      if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      return (a.seed || 99) - (b.seed || 99);
    });

    // Update qualification statuses
    rows.forEach(r => {
      if (r.matchesWon >= qualifyThreshold) {
        r.status = 'QUALIFIED';
      } else if (r.matchesLost >= qualifyThreshold) {
        r.status = 'ELIMINATED';
      } else if (r.matchesLost > r.matchesWon) {
        r.status = 'RISK';
      } else {
        r.status = 'CONTENTION';
      }
    });

    return rows;
  }, [stage, matches]);

  const filteredMatches = useMemo(() => {
    if (activeRoundFilter === 'ALL') return matches;
    return matches.filter(m => m.round === activeRoundFilter);
  }, [matches, activeRoundFilter]);

  const handleOpenScoreModal = (m: CompetitionMatchNode) => {
    setScoringMatch(m);
    setScoreA(m.scores?.teamA ?? 2);
    setScoreB(m.scores?.teamB ?? 0);
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
      {/* 1. STAGE HEADER & SWISS PROTOCOL CARD */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Trophy className="w-6 h-6 text-[#7C3AED]" />
          </div>
          <div>
            <h3 className="font-sans font-black text-lg uppercase text-black">
              SWISS SYSTEM TOURNAMENT
            </h3>
            <p className="text-[11px] text-stone-600 font-bold">
              {stage.name} • {standings.length} Contending Teams • {stage.swissRoundsCount || 3} Swiss Rounds • {stage.defaultSeriesFormat || 'BO3'} Series
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase text-stone-600">
          <span className="flex items-center gap-1 text-emerald-800">
            <span className="w-2.5 h-2.5 bg-emerald-500 inline-block border border-black" />
            Qualified
          </span>
          <span className="flex items-center gap-1 text-amber-700">
            <span className="w-2.5 h-2.5 bg-amber-400 inline-block border border-black" />
            In Contention
          </span>
          <span className="flex items-center gap-1 text-rose-800">
            <span className="w-2.5 h-2.5 bg-rose-500 inline-block border border-black" />
            Eliminated
          </span>
        </div>
      </div>

      {/* 2. SWISS STANDINGS SCOREBOARD */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#7C3AED]" />
            <h4 className="font-sans font-black text-base uppercase text-black">
              SWISS STANDINGS &amp; QUALIFICATION TRACKER
            </h4>
          </div>
          <span className="text-[10px] text-stone-500 font-bold uppercase">
            Updated Authoritatively
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121020] text-white uppercase text-[10px] border-b-2 border-black font-black">
              <tr>
                <th className="p-2 w-10 text-center">POS</th>
                <th className="p-2">FRANCHISE</th>
                <th className="p-2 text-center">MATCH RECORD (W-L)</th>
                <th className="p-2 text-center">GAME DIFF</th>
                <th className="p-2 text-center">GW - GL</th>
                <th className="p-2 text-center">PTS</th>
                <th className="p-2 text-center">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/20 font-bold">
              {standings.map((tm, idx) => (
                <tr key={tm.teamId || idx} className="hover:bg-yellow-50/50">
                  <td className="p-2 text-center font-black">
                    <span className={`w-5 h-5 inline-flex items-center justify-center border border-black font-black text-[11px] ${
                      tm.status === 'QUALIFIED' ? 'bg-[#70FFAF] text-black' :
                      tm.status === 'ELIMINATED' ? 'bg-rose-100 text-rose-900' :
                      'bg-stone-100 text-black'
                    }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-2 font-black text-black">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{tm.logo || '🛡️'}</span>
                      <div>
                        <div className="text-xs">{tm.name}</div>
                        <span className="text-[10px] text-stone-500 font-bold uppercase">
                          Seed #{tm.seed || idx + 1}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-center font-black text-sm">
                    <span className="text-emerald-700">{tm.matchesWon}</span> - <span className="text-rose-700">{tm.matchesLost}</span>
                  </td>
                  <td className="p-2 text-center font-bold text-stone-700">
                    {tm.gameDiff > 0 ? `+${tm.gameDiff}` : tm.gameDiff}
                  </td>
                  <td className="p-2 text-center font-bold text-stone-600">
                    {tm.gamesWon} - {tm.gamesLost}
                  </td>
                  <td className="p-2 text-center font-black text-sm text-[#7C3AED]">
                    {tm.points}
                  </td>
                  <td className="p-2 text-center">
                    <span className={`px-2 py-0.5 border text-[10px] font-black uppercase tracking-wider inline-block ${
                      tm.status === 'QUALIFIED' ? 'bg-[#70FFAF] text-black border-emerald-600' :
                      tm.status === 'ELIMINATED' ? 'bg-rose-100 text-rose-900 border-rose-400' :
                      tm.status === 'RISK' ? 'bg-amber-100 text-amber-900 border-amber-400' :
                      'bg-purple-100 text-purple-900 border-purple-400'
                    }`}>
                      {tm.status === 'QUALIFIED' ? '✓ PLAYOFF QUALIFIED' :
                       tm.status === 'ELIMINATED' ? '✕ ELIMINATED' :
                       tm.status === 'RISK' ? '⚠️ AT RISK' : '● IN CONTENTION'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SWISS ROUND FIXTURES & RESULTS */}
      <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-[#7C3AED]" />
            <h4 className="font-sans font-black text-base uppercase text-black">
              SWISS FIXTURES &amp; MATCH RESULTS
            </h4>
          </div>

          {/* Round Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveRoundFilter('ALL')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase border border-black cursor-pointer ${
                activeRoundFilter === 'ALL' ? 'bg-black text-white' : 'bg-stone-100 hover:bg-stone-200 text-black'
              }`}
            >
              All Rounds
            </button>
            {roundKeys.map(rk => (
              <button
                key={rk}
                onClick={() => setActiveRoundFilter(rk)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase border border-black cursor-pointer ${
                  activeRoundFilter === rk ? 'bg-[#7C3AED] text-white' : 'bg-stone-100 hover:bg-stone-200 text-black'
                }`}
              >
                {rk}
              </button>
            ))}
          </div>
        </div>

        {/* Fixture Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {filteredMatches.map(m => {
            const isWinnerA = m.status === 'COMPLETED' && (m.scores?.teamA ?? 0) > (m.scores?.teamB ?? 0);
            const isWinnerB = m.status === 'COMPLETED' && (m.scores?.teamB ?? 0) > (m.scores?.teamA ?? 0);

            return (
              <div 
                key={m.id}
                className="border-2 border-black p-3 bg-white shadow-[2px_2px_0px_0px_#000] space-y-2 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px] font-bold border-b border-black/10 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#7C3AED] uppercase font-black">{m.round}</span>
                    <span className="bg-stone-200 border border-black/30 px-1 py-0.2 text-[9px] font-mono">
                      {m.seriesFormat || 'BO3'}
                    </span>
                  </div>
                  <span className={`border border-black px-1.5 py-0.2 uppercase text-[9px] font-black ${
                    m.status === 'LIVE' ? 'bg-[#FF3366] text-white animate-pulse' :
                    m.status === 'COMPLETED' ? 'bg-[#70FFAF] text-black' :
                    'bg-stone-100 text-stone-700'
                  }`}>
                    {m.status || 'UPCOMING'}
                  </span>
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
                    isWinnerA ? 'bg-[#70FFAF]' : 'bg-stone-100'
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
                    isWinnerB ? 'bg-[#70FFAF]' : 'bg-stone-100'
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
                      className={`px-2 py-1 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
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

      {/* 4. MATCH SCORING MODAL */}
      {scoringMatch && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <div>
                <h3 className="font-sans font-black text-base uppercase text-black">
                  Record Swiss Match Score
                </h3>
                <span className="text-[10px] text-stone-500 font-bold uppercase">
                  {scoringMatch.round} · {scoringMatch.seriesFormat || 'BO3'}
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
                      max="4"
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
                      max="4"
                      value={scoreB}
                      onChange={e => setScoreB(Number(e.target.value))}
                      className="w-16 border-2 border-black p-1 text-center font-black text-sm bg-white"
                    />
                  </div>
                </div>
              </div>

              {mutationStatus === 'pending' && (
                <div className="p-2 bg-[#FFFBEB] border-2 border-amber-900 text-amber-900 font-bold flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting official score via transaction...</span>
                </div>
              )}

              {mutationStatus === 'confirmed' && (
                <div className="p-2 bg-[#E6FFFA] border-2 border-emerald-900 text-emerald-900 font-bold flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>✓ Score confirmed &amp; Swiss standings updated!</span>
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
