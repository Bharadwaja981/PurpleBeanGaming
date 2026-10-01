import React, { useState, useEffect } from 'react';
import { 
  Swords, 
  Trophy, 
  Calendar, 
  Clock, 
  Radio, 
  ChevronRight, 
  Filter, 
  Flame, 
  Sparkles,
  MapPin,
  CheckCircle2,
  Tv,
  Gamepad2
} from 'lucide-react';
import { Match, CompetitiveGame, ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown } from '../components/ui/Dropdown';

interface MatchesViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function MatchesView({ onNavigate }: MatchesViewProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'LIVE' | 'UPCOMING' | 'COMPLETED'>('ALL');
  const [selectedGame, setSelectedGame] = useState<string>('All Games');

  useEffect(() => {
    setMatches(tournamentService.getMatches());
    const unsub = tournamentService.subscribe(() => {
      setMatches(tournamentService.getMatches());
    });
    return unsub;
  }, []);

  const filteredMatches = matches.filter(match => {
    const matchesStatus = 
      selectedStatus === 'ALL' || 
      (selectedStatus === 'LIVE' && (match.status === 'LIVE' || match.isLive)) ||
      (selectedStatus === 'UPCOMING' && match.status === 'UPCOMING' && !match.isLive) ||
      (selectedStatus === 'COMPLETED' && match.status === 'COMPLETED');

    const matchesGame = 
      selectedGame === 'All Games' || 
      (match.game && match.game.toLowerCase().includes(selectedGame.toLowerCase()));

    return matchesStatus && matchesGame;
  });

  const liveCount = matches.filter(m => m.status === 'LIVE' || m.isLive).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="bg-[#FFE600] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] relative overflow-hidden">
        <div className="relative z-10 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-black uppercase bg-black text-[#FFE600] px-2.5 py-1 border border-black">
              Official Schedule & Results
            </span>
            {liveCount > 0 && (
              <span className="font-mono text-xs font-black uppercase bg-[#FF5757] text-white px-2.5 py-1 border border-black flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                {liveCount} Live {liveCount === 1 ? 'Match' : 'Matches'}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans tracking-tight">
            Competitive Match Hub
          </h1>
          <p className="font-mono text-xs text-stone-800 max-w-2xl leading-relaxed">
            Live broadcasts, scheduled series, and official tournament results across Dota 2, Valorant, CS2, and BGMI circuit qualifiers.
          </p>
        </div>
      </div>

      {/* Filter Matrix Bar */}
      <div className="bg-white border-[3.5px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {(['ALL', 'LIVE', 'UPCOMING', 'COMPLETED'] as const).map(status => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-3.5 py-1.5 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 ${
                selectedStatus === status 
                  ? 'bg-[#7C3AED] text-white' 
                  : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              {status === 'ALL' ? 'All Matches' : status}
            </button>
          ))}
        </div>

        {/* Game Filter */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-black uppercase text-stone-600 shrink-0">Game:</span>
          <SelectDropdown
            value={selectedGame}
            onChange={(val) => setSelectedGame(val)}
            options={[
              { value: 'All Games', label: 'All Games' },
              { value: 'Dota 2', label: 'Dota 2' },
              { value: 'Valorant', label: 'Valorant' },
              { value: 'Counter-Strike 2', label: 'Counter-Strike 2' },
              { value: 'BGMI', label: 'BGMI' }
            ]}
            size="sm"
            icon={Gamepad2}
            mobileTitle="Filter by Esports Game"
          />
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4">
          <div className="w-16 h-16 bg-[#FFE600] border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] mx-auto flex items-center justify-center">
            <Swords className="w-8 h-8 text-black" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-black uppercase text-black font-sans">
              No Matches Scheduled
            </h3>
            <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
              There are no competitive matches matching the selected filters. Check back once tournament seeding commences.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredMatches.map(match => {
            const isLive = match.status === 'LIVE' || match.isLive;
            const isCompleted = match.status === 'COMPLETED';

            return (
              <div
                key={match.id}
                onClick={() => onNavigate('match_detail', match.id)}
                className="group bg-white border-[3.5px] border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000] hover:-translate-y-1 transition-all cursor-pointer relative"
              >
                {/* Match Metadata Bar */}
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black uppercase text-[#7C3AED]">
                      {match.tournamentName || 'Tournament'}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">·</span>
                    <span className="font-mono text-[11px] font-bold text-stone-600">
                      {match.round}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold bg-stone-100 border border-black px-1.5 py-0.5 uppercase">
                      {match.seriesFormat || 'BO3'}
                    </span>
                    <span className={`px-2 py-0.5 border border-black font-mono text-[10px] font-black uppercase ${
                      isLive ? 'bg-[#FF5757] text-white animate-pulse' :
                      isCompleted ? 'bg-[#70FFAF] text-black' :
                      'bg-stone-200 text-stone-700'
                    }`}>
                      {isLive ? '🔴 LIVE' : isCompleted ? 'FINISHED' : 'SCHEDULED'}
                    </span>
                  </div>
                </div>

                {/* Teams Scoreboard Display */}
                <div className="space-y-3 py-1">
                  {/* Team A */}
                  <div className={`flex items-center justify-between p-2.5 border-2 border-black ${
                    match.winnerId === match.teamA.id ? 'bg-[#70FFAF]/30 font-black' : 'bg-stone-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{match.teamA.logo || '🛡️'}</span>
                      <div>
                        <span className="font-sans font-black text-sm uppercase block text-black">
                          {match.teamA.name}
                        </span>
                        <span className="font-mono text-[10px] text-stone-500 font-bold">
                          [{match.teamA.tag}] {match.teamA.city ? `· ${match.teamA.city}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-2xl font-black text-black">
                      {match.teamA.score ?? 0}
                    </span>
                  </div>

                  {/* Team B */}
                  <div className={`flex items-center justify-between p-2.5 border-2 border-black ${
                    match.winnerId === match.teamB.id ? 'bg-[#70FFAF]/30 font-black' : 'bg-stone-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{match.teamB.logo || '🛡️'}</span>
                      <div>
                        <span className="font-sans font-black text-sm uppercase block text-black">
                          {match.teamB.name}
                        </span>
                        <span className="font-mono text-[10px] text-stone-500 font-bold">
                          [{match.teamB.tag}] {match.teamB.city ? `· ${match.teamB.city}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-2xl font-black text-black">
                      {match.teamB.score ?? 0}
                    </span>
                  </div>
                </div>

                {/* Footer bar */}
                <div className="pt-2 flex items-center justify-between font-mono text-xs border-t-2 border-black/10">
                  <div className="flex items-center gap-2 text-stone-600">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{match.scheduledTime || 'Match Day Schedule'}</span>
                  </div>
                  <div className="flex items-center gap-1 font-black text-[#7C3AED] group-hover:translate-x-1 transition-transform">
                    <span>View Match Sheet</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
