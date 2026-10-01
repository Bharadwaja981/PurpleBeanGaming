import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trophy, 
  Users, 
  ArrowLeft, 
  Swords, 
  Award, 
  Calendar, 
  CheckCircle,
  TrendingUp,
  MapPin,
  Gamepad2
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { ViewType, Team, Player, Match, Tournament } from '../types/tournament';
import { dotaCareerHistoryEngine } from '../domain/dotaCareerHistoryEngine';
import { testCupEngine } from '../domain/testCupEngine';

interface TeamProfileViewProps {
  teamId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function TeamProfileView({ teamId, onNavigate }: TeamProfileViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'players' | 'tournaments' | 'stats'>('overview');
  const [teams, setTeams] = useState<Team[]>(() => tournamentService.getTeams());
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());
  const [matches, setMatches] = useState<Match[]>(() => tournamentService.getMatches());
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setTeams(tournamentService.getTeams());
      setPlayers(tournamentService.getPlayers());
      setMatches(tournamentService.getMatches());
      setTournaments(tournamentService.getTournaments());
    });
    return unsub;
  }, []);

  const effectiveTeams = teams;
  const effectivePlayers = players;
  const effectiveMatches = matches;
  const effectiveTournaments = tournaments;

  const team = effectiveTeams.find((t) => t.id === teamId) || effectiveTeams[0];
  const teamRoster = effectivePlayers.filter((p) => team ? team.players.includes(p.id) : false);
  const teamMatches = effectiveMatches.filter((m) => team && (m.teamA.id === team.id || m.teamB.id === team.id));

  const tabs: Array<{ id: typeof activeTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'matches', label: 'Recent Matches' },
    { id: 'players', label: 'Current Roster' },
    { id: 'tournaments', label: 'Tournament History' },
    { id: 'stats', label: 'Team Statistics' },
  ];

  if (!team) {
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8">
        <Shield className="w-12 h-12 text-[#7C3AED] mx-auto" />
        <h2 className="font-sans font-black text-2xl uppercase">Team Not Found</h2>
        <p className="font-mono text-sm text-stone-600 max-w-md mx-auto">
          No team records are currently available or published.
        </p>
        <button
          onClick={() => onNavigate('teams')}
          className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          View Teams Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('teams')}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Teams Directory</span>
        </button>
      </div>

      {/* Header Showcase */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 min-w-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#FFE600] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex items-center justify-center text-3xl sm:text-4xl shrink-0">
              {team.logo}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase text-black font-sans truncate">
                  {team.name}
                </h1>
                <span className="text-lg sm:text-xl">🇮🇳</span>
              </div>
              <p className="font-mono text-xs sm:text-sm text-stone-600 flex items-center gap-1.5 flex-wrap">
                <MapPin className="w-3.5 h-3.5 text-[#7C3AED] shrink-0" />
                <span>{team.city}, {team.region} · Captain: <strong className="text-black">{team.captainName}</strong></span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto">
            <div className="bg-[#FFF9E6] border-2 border-black p-2.5 sm:p-3 text-center font-mono shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Rating</span>
              <span className="text-lg sm:text-2xl font-black text-black">{team.rating}</span>
            </div>
            <div className="bg-[#FFF9E6] border-2 border-black p-2.5 sm:p-3 text-center font-mono shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Series</span>
              <span className="text-lg sm:text-2xl font-black text-black">{(team.record?.wins ?? 0)}W - {(team.record?.losses ?? 0)}L</span>
            </div>
            <div className="bg-[#FFF9E6] border-2 border-black p-2.5 sm:p-3 text-center font-mono shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 uppercase font-black block">Earnings</span>
              <span className="text-base sm:text-xl font-black text-[#7C3AED]">{team.earningsINR || '₹5,00,000'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 p-1.5 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-mono text-xs font-black uppercase whitespace-nowrap border-2 border-black transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-transparent text-stone-700 border-transparent hover:bg-stone-100 hover:border-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4">
            <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
              FRANCHISE OVERVIEW
            </h2>
            <p className="font-mono text-xs text-stone-700 leading-relaxed bg-[#FFFBEB] p-4 border-2 border-black">
              {team.description}
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2 font-mono text-xs">
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block">Home City:</span>
                <span className="font-black text-black">{team.city}, India</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block">Regional Circuit:</span>
                <span className="font-black text-black">{team.region}</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block">Tournament Titles:</span>
                <span className="font-black text-emerald-700">{team.tournamentWins} Championships</span>
              </div>
              <div className="p-3 bg-stone-50 border border-black">
                <span className="text-stone-500 block">Stand-in:</span>
                <span className="font-black text-black">{team.standIn}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
            <h2 className="text-xl font-black uppercase text-black font-sans border-b-2 border-black pb-2">
              ACTIVE ROSTER
            </h2>
            <div className="space-y-2">
              {teamRoster.map((player) => (
                <div
                  key={player.id}
                  onClick={() => onNavigate('player_profile', player.id)}
                  className="p-2.5 bg-stone-50 hover:bg-[#FFE600] border border-black flex items-center justify-between cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{player.avatar}</span>
                    <div>
                      <span className="font-black text-black block">{player.username}</span>
                      <span className="text-[10px] text-stone-500">{player.primaryRole}</span>
                    </div>
                  </div>
                  <span className="font-black text-black text-xs">{player.mmr.toLocaleString()} MMR</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Roster Tab */}
      {activeTab === 'players' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamRoster.map((player) => (
            <div
              key={player.id}
              onClick={() => onNavigate('player_profile', player.id)}
              className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-5 space-y-3 cursor-pointer hover:-translate-y-1 transition-transform"
            >
              <div className="flex items-center justify-between border-b border-black pb-2">
                <span className="text-2xl">{player.avatar}</span>
                <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-mono font-black uppercase">
                  {player.status}
                </span>
              </div>
              <div>
                <h3 className="font-sans font-black text-lg text-black uppercase leading-none">
                  {player.username}
                </h3>
                <p className="font-mono text-[11px] text-stone-500">{player.realName} · {player.city || 'India'}</p>
              </div>
              <div className="font-mono text-xs space-y-1 pt-1 border-t border-stone-200">
                <div className="flex justify-between">
                  <span className="text-stone-500">Role:</span>
                  <span className="font-bold">{player.primaryRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">MMR:</span>
                  <span className="font-black">{player.mmr.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamMatches.map((m) => (
            <div
              key={m.id}
              onClick={() => onNavigate('match_detail', m.id)}
              className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 space-y-3 font-mono text-xs cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div className="flex items-center justify-between border-b border-black pb-2">
                <span className="font-black text-black">{m.tournamentName}</span>
                <span className={`px-2 py-0.5 border border-black font-black uppercase text-[10px] ${
                  m.status === 'LIVE' ? 'bg-[#FF5757] text-white animate-pulse' : 'bg-stone-100 text-stone-800'
                }`}>
                  {m.status}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="font-bold">{m.teamA.name}</span>
                <span className="font-black text-sm">{m.teamA.score} : {m.teamB.score}</span>
                <span className="font-bold">{m.teamB.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tournaments History Tab */}
      {activeTab === 'tournaments' && (
        <div className="space-y-4">
          <div className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 space-y-4 font-mono text-xs">
            <h2 className="text-lg font-black uppercase text-black font-sans border-b-2 border-black pb-2">
              COMPETITIVE TOURNAMENT RUNS &amp; IMMUTABLE ROSTER ARCHIVES
            </h2>
            <div className="space-y-4">
              {effectiveTournaments.filter(t => t.id === 'purple-bean-test-cup' || t.id === 'purple-bean-india-masters-2026' || effectiveTournaments.length <= 2).map(t => (
                <div key={t.id} className="p-4 bg-stone-50 border-2 border-black space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
                    <div>
                      <span className="font-black text-sm uppercase text-black">{t.name}</span>
                      <span className="text-[10px] text-stone-500 block">{t.region} · {t.format}</span>
                    </div>
                    <span className="bg-[#FFE600] px-2 py-0.5 border border-black font-black uppercase text-[10px]">
                      {t.status}
                    </span>
                  </div>

                  <div className="pt-1">
                    <span className="font-bold text-stone-500 uppercase text-[10px] block mb-1">
                      Locked Tournament Roster Snapshot:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {teamRoster.map(p => (
                        <span key={p.id} className="bg-white border border-black px-2 py-0.5 text-[11px] font-bold">
                          {p.username} ({p.primaryRole})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="bg-white border-[3px] border-black shadow-[5px_5px_0px_0px_#000] p-6 font-mono text-xs space-y-4">
          <h2 className="text-lg font-black uppercase text-black font-sans border-b-2 border-black pb-2">
            DETAILED METRICS FOR {team.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block">Win Rate</span>
              <span className="text-2xl font-black text-emerald-700">
                {((((team.record?.wins ?? 0) / Math.max(1, (team.record?.wins ?? 0) + (team.record?.losses ?? 0)))) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block">Maps Won / Lost</span>
              <span className="text-2xl font-black text-black">
                {team.mapsRecord?.won ?? 0} - {team.mapsRecord?.lost ?? 0}
              </span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block">Tournament Titles</span>
              <span className="text-2xl font-black text-amber-600">{team.tournamentWins ?? 0}</span>
            </div>
            <div className="p-3 bg-stone-50 border border-black">
              <span className="text-stone-500 block">Total INR Won</span>
              <span className="text-2xl font-black text-[#7C3AED]">{team.earningsINR || '₹5,00,000'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
