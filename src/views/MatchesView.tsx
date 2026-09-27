import { useState, useMemo, useEffect } from 'react';
import { Swords, Radio, Calendar, CheckCircle2, Clock, ArrowRight, Filter, Gamepad2, MapPin } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { Match, ViewType } from '../types/tournament';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface MatchesViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function MatchesView({ onNavigate }: MatchesViewProps) {
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [gameFilter, setGameFilter] = useState<string>('All');
  const [matches, setMatches] = useState<Match[]>(() => tournamentService.getMatches());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setMatches(tournamentService.getMatches());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubGames = gameManagementEngine.subscribe(() => {
      setActiveGames(gameManagementEngine.getActiveGames());
    });
    return unsubGames;
  }, []);

  const hasMultipleGames = activeGames.length > 1;

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const matchesStatus = filter === 'ALL' || m.status === filter;
      const matchesGame = !hasMultipleGames || gameFilter === 'All' || m.game === gameFilter;
      return matchesStatus && matchesGame;
    });
  }, [matches, filter, gameFilter, hasMultipleGames]);

  const liveMatches = useMemo(() => filteredMatches.filter((m) => m.status === 'LIVE'), [filteredMatches]);
  const upcomingMatches = useMemo(() => filteredMatches.filter((m) => m.status === 'UPCOMING'), [filteredMatches]);
  const completedMatches = useMemo(() => filteredMatches.filter((m) => m.status === 'COMPLETED'), [filteredMatches]);

  const gameDropdownOptions: DropdownOption[] = useMemo(() => {
    const opts: DropdownOption[] = [{ value: 'All', label: 'All Esports Titles' }];
    activeGames.forEach((g) => {
      opts.push({ value: g.name, label: g.name, icon: Gamepad2 });
    });
    return opts;
  }, [activeGames]);

  const renderMatchCard = (m: Match) => {
    const isCompleted = m.status === 'COMPLETED';
    const isLive = m.status === 'LIVE';
    const isWinnerA = isCompleted && m.teamA.score > m.teamB.score;
    const isWinnerB = isCompleted && m.teamB.score > m.teamA.score;

    return (
      <div
        key={m.id}
        onClick={() => onNavigate('match_detail', m.id)}
        className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-4 sm:p-5 space-y-4 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#000] transition-all cursor-pointer group"
      >
        {/* Card Header Bar */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="font-black text-black">{m.tournamentName}</span>
            <span className="text-stone-400">·</span>
            <span className="text-stone-600 font-bold">{m.round}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="bg-[#FFE600] text-black px-2 py-0.5 border border-black font-black uppercase text-[10px]">
              {m.game || 'Dota 2'}
            </span>
            <span className={`px-2.5 py-0.5 border border-black font-black uppercase text-[10px] ${
              isLive ? 'bg-[#FF5757] text-white animate-pulse' :
              isCompleted ? 'bg-stone-200 text-stone-800' : 'bg-[#5CE1E6] text-black'
            }`}>
              {isLive ? '● LIVE' : m.status}
            </span>
          </div>
        </div>

        {/* Team Matchup and Scores */}
        <div className="space-y-3 font-mono">
          {/* Team A */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{m.teamA.logo}</span>
              <div>
                <span className={`text-base sm:text-lg block leading-none ${isWinnerA ? 'font-black text-black' : isWinnerB ? 'text-stone-500 font-medium' : 'font-black text-black'}`}>
                  {m.teamA.name}
                </span>
                <span className="text-[10px] text-stone-500 font-bold">{m.teamA.city || 'India'}</span>
              </div>
            </div>
            <span className={`w-8 h-8 flex items-center justify-center border-2 border-black text-base font-black ${
              isWinnerA ? 'bg-[#FFE600] text-black shadow-[1.5px_1.5px_0px_0px_#000]' : 'bg-stone-100 text-stone-800'
            }`}>
              {m.teamA.score}
            </span>
          </div>

          {/* Team B */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{m.teamB.logo}</span>
              <div>
                <span className={`text-base sm:text-lg block leading-none ${isWinnerB ? 'font-black text-black' : isWinnerA ? 'text-stone-500 font-medium' : 'font-black text-black'}`}>
                  {m.teamB.name}
                </span>
                <span className="text-[10px] text-stone-500 font-bold">{m.teamB.city || 'India'}</span>
              </div>
            </div>
            <span className={`w-8 h-8 flex items-center justify-center border-2 border-black text-base font-black ${
              isWinnerB ? 'bg-[#FFE600] text-black shadow-[1.5px_1.5px_0px_0px_#000]' : 'bg-stone-100 text-stone-800'
            }`}>
              {m.teamB.score}
            </span>
          </div>
        </div>

        {/* Card Footer Bar */}
        <div className="pt-2 border-t-2 border-black flex items-center justify-between font-mono text-xs text-stone-600">
          <span>{m.mapName || `${m.seriesFormat} · ${m.scheduledTime}`}</span>
          <span className="font-bold text-black group-hover:text-[#7C3AED] flex items-center gap-1">
            <span>Match Center</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Swords className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · INDIAN TOURNAMENT MATCHES</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          TOURNAMENT MATCHES
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          Live scoreboards, upcoming series times, and completed VOD match rooms across all Indian competitive circuits.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                filter === st
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              {st} {st === 'LIVE' ? `(${matches.filter(m => m.status === 'LIVE').length})` : ''}
            </button>
          ))}
        </div>

        {hasMultipleGames && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black uppercase text-stone-600">Game:</span>
            <SelectDropdown
              value={gameFilter}
              onChange={(val) => setGameFilter(val)}
              options={gameDropdownOptions}
              size="sm"
            />
          </div>
        )}
      </div>

      {/* Main Matches Display */}
      {filter === 'ALL' ? (
        <div className="space-y-8">
          {liveMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-mono text-sm font-black text-[#FF5757] uppercase">
                <span className="w-2.5 h-2.5 bg-[#FF5757] rounded-full animate-ping" />
                <span>LIVE NOW ({liveMatches.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {liveMatches.map(renderMatchCard)}
              </div>
            </div>
          )}

          {upcomingMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-mono text-sm font-black text-black uppercase">
                <Clock className="w-4 h-4 text-stone-600" />
                <span>UPCOMING SERIES ({upcomingMatches.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingMatches.map(renderMatchCard)}
              </div>
            </div>
          )}

          {completedMatches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-mono text-sm font-black text-black uppercase">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>COMPLETED RESULTS ({completedMatches.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedMatches.map(renderMatchCard)}
              </div>
            </div>
          )}
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredMatches.map(renderMatchCard)}
        </div>
      ) : (
        <div className="bg-white border-[3.5px] border-black p-10 text-center space-y-3 shadow-[6px_6px_0px_0px_#000]">
          <h3 className="font-sans font-black text-xl uppercase">No Matches Scheduled</h3>
          <p className="font-mono text-xs text-stone-600">There are no live or upcoming fixtures matching your filters.</p>
          <button
            onClick={() => {
              setFilter('ALL');
              setGameFilter('All');
            }}
            className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
