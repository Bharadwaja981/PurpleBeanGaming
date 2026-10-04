import { useState, useEffect } from 'react';
import { 
  Trophy, 
  Swords, 
  Flame, 
  ArrowRight, 
  Users, 
  Radio, 
  Shield, 
  Calendar, 
  Coins, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  Gamepad2,
  MapPin,
  Sparkles,
  Zap,
  Play
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { Tournament, Match, Player, Team, ViewType, CompetitiveGame } from '../types/tournament';
import { PurpleBeanLogo } from '../components/PurpleBeanLogo';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import {
  isPubliclyDiscoverable,
  normalizeTournamentRecord,
  normalizeTeamRecord,
  normalizePlayerRecord,
  isTestPlayer,
  isTestTeam,
  normalizeStatus,
  matchesGameFilter
} from '../domain/tournamentDiscovery';

interface HomeViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister: () => void;
  onOpenBrandKit?: () => void;
}

export function HomeView({ onNavigate, onOpenRegister, onOpenBrandKit }: HomeViewProps) {
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [selectedGame, setSelectedGame] = useState<string>('All Games');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());
  const [matches, setMatches] = useState<Match[]>(() => tournamentService.getMatches());
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());
  const [teams, setTeams] = useState<Team[]>(() => tournamentService.getTeams());

  useEffect(() => {
    const unsubGames = gameManagementEngine.subscribe(() => {
      setActiveGames(gameManagementEngine.getActiveGames());
    });
    return unsubGames;
  }, []);

  useEffect(() => {
    const sync = () => {
      setTournaments(tournamentService.getTournaments());
      setMatches(tournamentService.getMatches());
      setPlayers(tournamentService.getPlayers());
      setTeams(tournamentService.getTeams());
    };
    const unsubService = tournamentService.subscribe(sync);
    const unsubRegistry = tournamentConfigRegistry.subscribe(sync);
    return () => {
      unsubService();
      unsubRegistry();
    };
  }, []);

  const hasMultipleGames = activeGames.length > 1;

  const filteredTournaments = tournaments
    .map(normalizeTournamentRecord)
    .filter((t) => {
      const idLower = (t.id || '').toLowerCase();
      const LEGACY_MOCK_TOURNAMENT_IDS = new Set([
        'purple-bean-test-cup',
        '2-team-auction-test',
        'auction-test'
      ]);
      if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) return false;
      if (idLower === 'purple-bean-auction-test') {
        return matchesGameFilter(t.game, t.gameId, selectedGame);
      }
      if (!isPubliclyDiscoverable(t)) return false;
      return matchesGameFilter(t.game, t.gameId, selectedGame);
    });

  // Featured tournament: live tournament first, or registration open, or first available tournament
  const featuredTournament = filteredTournaments.find((t) => {
    const s = normalizeStatus(t.status || t.lifecycle);
    return s === 'ACTIVE' || s === 'LIVE' || s === 'AUCTION_ACTIVE';
  })
    || filteredTournaments.find((t) => normalizeStatus(t.status || t.lifecycle) === 'REGISTRATION_OPEN')
    || filteredTournaments[0];

  const liveMatches = matches.filter((m) => 
    m.status === 'LIVE' && (selectedGame === 'All Games' || m.game === selectedGame)
  );

  const upcomingMatches = matches.filter((m) => 
    m.status === 'UPCOMING' && (selectedGame === 'All Games' || m.game === selectedGame)
  );

  const topPlayers = players
    .map(normalizePlayerRecord)
    .filter((p) => 
      !isTestPlayer(p) && (selectedGame === 'All Games' || p.primaryGame === selectedGame)
    ).slice(0, 8);

  const topTeams = teams
    .map(normalizeTeamRecord)
    .filter((t) => 
      !isTestTeam(t) && (selectedGame === 'All Games' || t.primaryGame === selectedGame)
    ).slice(0, 8);

  return (
    <div className="space-y-12 pb-16">
      {/* ============================================================ */}
      {/* 0. GAME CATEGORIES BAR / SWITCHER (Dynamic when > 1 active game) */}
      {/* ============================================================ */}
      {hasMultipleGames && (
        <section className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-[#7C3AED]" />
              <h2 className="font-sans font-black text-lg uppercase tracking-tight text-black">
                COMPETITIVE GAME TITLES · INDIA
              </h2>
            </div>
            <div className="font-mono text-xs font-bold text-stone-600 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>LOW LATENCY NODES IN MUMBAI & BENGALURU</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedGame('All Games')}
              className={`px-3.5 py-1.5 font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all ${
                selectedGame === 'All Games'
                  ? 'bg-black text-white -translate-y-0.5 shadow-[3px_3px_0px_0px_#FFE600]'
                  : 'bg-stone-100 hover:bg-[#FFE600] text-black'
              }`}
            >
              ★ ALL GAMES
            </button>

            {activeGames.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGame(g.name)}
                className={`px-3.5 py-1.5 font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all flex items-center gap-1.5 ${
                  selectedGame === g.name
                    ? 'bg-[#7C3AED] text-white -translate-y-0.5 shadow-[3px_3px_0px_0px_#000]'
                    : 'bg-white hover:bg-[#E9D5FF] text-black'
                }`}
              >
                <span>{g.name}</span>
                <span className="text-[9px] px-1 py-0.2 border border-black font-mono font-bold bg-[#7C3AED] text-white">
                  {g.competitionType || '5v5'}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 1. HERO / FEATURED TOURNAMENT */}
      {/* ============================================================ */}
      {featuredTournament ? (
        <section 
          id="hero-featured-tournament"
          className="w-full bg-white border-[3.5px] border-black shadow-[5px_5px_0px_0px_#000] sm:shadow-[10px_10px_0px_0px_#000] p-4 sm:p-8 lg:p-10 relative overflow-hidden"
        >
          {/* Background diagonal decorative accent */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#FFE600] border-[3.5px] border-black rotate-12 -z-0 opacity-80 pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-[#8B5CF6] border-[3.5px] border-black -rotate-12 -z-0 opacity-20 pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Status & Game Pills */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <span className={`flex items-center gap-1.5 px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] ${
                featuredTournament.status === 'Live' ? 'bg-[#FF5757] text-white animate-pulse' : 'bg-[#70FFAF] text-black'
              }`}>
                <Radio className="w-3.5 h-3.5" />
                {featuredTournament.status === 'Live' ? 'TOURNAMENT LIVE' : featuredTournament.status.toUpperCase()}
              </span>

              <span className="bg-[#FFE600] text-black px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
                <Gamepad2 className="w-3.5 h-3.5" />
                {featuredTournament.game}
              </span>

              <span className="bg-[#8B5CF6] text-white px-3 py-1 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {featuredTournament.region} {featuredTournament.city ? `· ${featuredTournament.city}` : ''}
              </span>

              <span className="bg-stone-100 text-stone-700 px-3 py-1 border-2 border-black font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                {featuredTournament.status}
              </span>
            </div>

            {/* Title & Dates with Mascot Feature */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-mono font-black text-[#7C3AED] uppercase tracking-wider mb-1">
                  <span>OFFICIAL TOURNAMENT CIRCUIT</span>
                  <span>·</span>
                  <span>DEDICATED SERVERS & REFEREES</span>
                </div>
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-black uppercase font-sans tracking-tight leading-none">
                  {featuredTournament.name}
                </h1>
                <p className="mt-3 font-mono text-sm sm:text-base font-bold text-stone-700 max-w-2xl">
                  {featuredTournament.dates} · Verified ₹ INR Payouts · Single Elimination &amp; Double Elimination Brackets.
                </p>
              </div>
            </div>

            {/* Key Metric Highlights Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 py-2">
              <div className="bg-[#FFFBEB] border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000]">
                <span className="text-[10px] font-mono font-black uppercase text-stone-500 block">
                  Total Prize Pool
                </span>
                <span className="text-xl sm:text-3xl font-black font-mono text-black text-[#7C3AED]">
                  {featuredTournament.prizePoolINR || featuredTournament.prizePool}
                </span>
              </div>

              <div className="bg-[#FFFBEB] border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000]">
                <span className="text-[10px] font-mono font-black uppercase text-stone-500 block">
                  Qualified Teams
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-black">
                  {featuredTournament.teamCount} Teams
                </span>
              </div>

              <div className="bg-[#FFFBEB] border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000]">
                <span className="text-[10px] font-mono font-black uppercase text-stone-500 block">
                  Drafted Players
                </span>
                <span className="text-xl sm:text-2xl font-black font-mono text-black">
                  {featuredTournament.playerCount} Players
                </span>
              </div>

              <div className="bg-[#FFFBEB] border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000]">
                <span className="text-[10px] font-mono font-black uppercase text-stone-500 block">
                  Format
                </span>
                <span className="text-xs sm:text-sm font-black font-mono text-stone-800 line-clamp-2">
                  {featuredTournament.format}
                </span>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-2">
              <button
                onClick={() => onNavigate('tournament_detail', featuredTournament.id)}
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 sm:px-6 py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-black uppercase tracking-tight shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>View Tournament</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('matches')}
                className="bg-black hover:bg-stone-800 text-white border-2 border-black px-4 sm:px-6 py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-black uppercase tracking-tight shadow-[3px_3px_0px_0px_#FFE600] sm:shadow-[4px_4px_0px_0px_#FFE600] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#FFE600] fill-current" />
                <span>Watch Matches</span>
              </button>

              <button
                onClick={() => onNavigate('bracket')}
                className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3.5 sm:px-5 py-2.5 sm:py-3 font-mono text-xs sm:text-sm font-black uppercase tracking-tight shadow-[3px_3px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 cursor-pointer"
              >
                <Swords className="w-4 h-4 text-[#7C3AED]" />
                <span>Interactive Bracket</span>
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section
          id="hero-empty-state"
          className="w-full bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 sm:p-12 text-center space-y-4"
        >
          <div className="w-16 h-16 mx-auto bg-[#F3E8FF] border-2 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]">
            🏆
          </div>
          <div className="space-y-2 max-w-xl mx-auto">
            <span className="bg-[#FFE600] text-black px-2.5 py-0.5 border border-black font-mono text-xs font-black uppercase shadow-[1px_1px_0px_0px_#000]">
              CIRCUIT STATUS
            </span>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
              NO ACTIVE TOURNAMENTS
            </h1>
            <p className="font-mono text-xs sm:text-sm text-stone-600">
              There are currently no active tournaments scheduled for {selectedGame}. Official Pan-India Dota 2 tournaments and registrations will appear here once announced by certified organizers.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              onClick={() => onNavigate('tournaments')}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              Browse Tournament Archive
            </button>
            <button
              onClick={onOpenRegister}
              className="bg-black hover:bg-stone-800 text-white border-2 border-black px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#FFE600] cursor-pointer"
            >
              Register Player Profile
            </button>
          </div>
        </section>
      )}

      {/* ============================================================ */}
      {/* 2. LIVE & UPCOMING MATCHES SECTION */}
      {/* ============================================================ */}
      <section id="live-matches-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#FF5757] border border-black rounded-full animate-ping" />
            <h2 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-tight text-black">
              LIVE & UPCOMING MATCHES
            </h2>
          </div>
          <button
            onClick={() => onNavigate('matches')}
            className="font-mono text-xs font-bold text-black hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>View All Matches ({matches.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {liveMatches.length === 0 && upcomingMatches.length === 0 ? (
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-8 text-center space-y-2">
            <div className="font-sans font-black text-lg uppercase text-black">NO LIVE OR UPCOMING MATCHES</div>
            <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
              Live match rooms and scheduled fixtures will appear here once registered teams begin bracket competition.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Live Match Cards */}
          {liveMatches.map((match) => (
            <div
              key={match.id}
              className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4 hover:-translate-y-1 transition-transform relative"
            >
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#FF5757] rounded-full animate-pulse border border-black" />
                  <span className="font-mono text-xs font-black text-[#FF5757] uppercase tracking-wide">
                    LIVE NOW · GAME {match.currentGame || 1}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-black uppercase bg-[#FFE600] px-2 py-0.5 border border-black">
                  {match.game || 'Dota 2'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-mono text-stone-500 font-bold block truncate">
                  {match.tournamentName} · {match.round}
                </span>
                <span className="text-[10px] font-mono text-stone-700 bg-stone-100 px-1.5 py-0.5 inline-block border border-stone-300">
                  {match.mapName || 'Map Decider'}
                </span>
              </div>

              {/* Teams & Scoreboard */}
              <div className="space-y-3 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{match.teamA.logo}</span>
                    <div>
                      <span className="font-sans font-black text-sm uppercase text-black block leading-none">
                        {match.teamA.name}
                      </span>
                      <span className="font-mono text-[10px] text-stone-500">{match.teamA.city || 'India'}</span>
                    </div>
                  </div>
                  <span className="font-mono text-2xl font-black text-black">
                    {match.teamA.score}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{match.teamB.logo}</span>
                    <div>
                      <span className="font-sans font-black text-sm uppercase text-black block leading-none">
                        {match.teamB.name}
                      </span>
                      <span className="font-mono text-[10px] text-stone-500">{match.teamB.city || 'India'}</span>
                    </div>
                  </div>
                  <span className="font-mono text-2xl font-black text-black">
                    {match.teamB.score}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-black flex items-center justify-between">
                <span className="font-mono text-xs text-stone-600 font-bold">
                  {match.seriesFormat} Series
                </span>
                <button
                  onClick={() => onNavigate('match_detail', match.id)}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Match Center →
                </button>
              </div>
            </div>
          ))}

          {/* Upcoming Match Cards */}
          {upcomingMatches.map((match) => (
            <div
              key={match.id}
              className="bg-[#FFFDF5] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4 hover:-translate-y-1 transition-transform"
            >
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <span className="font-mono text-xs font-bold text-stone-700 uppercase flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-stone-500" />
                  <span>{match.scheduledTime}</span>
                </span>
                <span className="font-mono text-[10px] font-black uppercase bg-stone-200 px-2 py-0.5 border border-black">
                  {match.game || 'Dota 2'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-mono text-stone-500 font-bold block truncate">
                  {match.tournamentName} · {match.round}
                </span>
                <span className="text-[10px] font-mono text-stone-600">
                  {match.mapName || 'Best of 3 Series'}
                </span>
              </div>

              <div className="space-y-2 py-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{match.teamA.logo}</span>
                    <span className="font-sans font-black text-sm uppercase text-black">
                      {match.teamA.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-stone-400">vs</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{match.teamB.logo}</span>
                    <span className="font-sans font-black text-sm uppercase text-black">
                      {match.teamB.name}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-black flex items-center justify-between">
                <span className="font-mono text-xs text-stone-500 font-bold">
                  {match.seriesFormat}
                </span>
                <button
                  onClick={() => onNavigate('match_detail', match.id)}
                  className="bg-stone-100 hover:bg-stone-200 text-black border-2 border-black px-3 py-1 font-mono text-xs font-bold shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Preview →
                </button>
              </div>
            </div>
          ))}
        </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* 3. UPCOMING & ACTIVE TOURNAMENTS */}
      {/* ============================================================ */}
      <section id="tournaments-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#7C3AED]" />
            <h2 className="text-2xl sm:text-3xl font-black uppercase font-sans tracking-tight text-black">
              INDIAN TOURNAMENT CIRCUIT
            </h2>
          </div>
          <button
            onClick={() => onNavigate('tournaments')}
            className="font-mono text-xs font-bold text-black hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Browse All Tournaments ({tournaments.length})</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {filteredTournaments.length === 0 ? (
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-8 text-center space-y-2">
            <div className="font-sans font-black text-lg uppercase text-black">NO TOURNAMENTS AVAILABLE</div>
            <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
              There are no tournaments currently matching the selected filter. Check back soon for announcements.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.slice(0, 6).map((tourney) => {
              const isLive = tourney.status === 'Live';
              const isOpen = tourney.status === 'Registration Open';

              return (
                <div
                  key={tourney.id}
                  className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] font-black uppercase bg-[#FFE600] px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
                        {tourney.game}
                      </span>
                      <span className={`font-mono text-[10px] font-black uppercase px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] ${
                        isLive 
                          ? 'bg-[#FF5757] text-white animate-pulse' 
                          : isOpen 
                          ? 'bg-[#70FFAF] text-black' 
                          : 'bg-stone-100 text-stone-700'
                      }`}>
                        {tourney.status}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-sans font-black text-xl text-black uppercase leading-tight">
                        {tourney.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs font-mono text-stone-600">
                        <MapPin className="w-3 h-3 text-[#7C3AED]" />
                        <span>{tourney.region} {tourney.city ? `· ${tourney.city}` : ''}</span>
                      </div>
                    </div>

                    <p className="font-mono text-xs text-stone-600 line-clamp-2">
                      {tourney.description}
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                      <div className="bg-[#FFF9E6] border border-black p-2">
                        <span className="text-[10px] text-stone-500 uppercase block font-black">Prize Purse</span>
                        <span className="font-black text-black text-sm">{tourney.prizePoolINR || tourney.prizePool}</span>
                      </div>
                      <div className="bg-[#FFF9E6] border border-black p-2">
                        <span className="text-[10px] text-stone-500 uppercase block font-black">Cap</span>
                        <span className="font-black text-black text-sm">{tourney.teamCount} Teams</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t-2 border-black flex items-center justify-between">
                    <div className="font-mono text-[11px] text-stone-600 font-bold flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{tourney.dates}</span>
                    </div>
                    <button
                      onClick={() => onNavigate('tournament_detail', tourney.id)}
                      className="bg-black hover:bg-stone-800 text-white border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] cursor-pointer"
                    >
                      Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================================ */}
      {/* 4. TOP INDIAN PLAYERS & TEAMS */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Top Players Column */}
        <section className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#7C3AED]" />
              <h2 className="font-sans font-black text-xl uppercase tracking-tight text-black">
                TOP INDIAN PLAYERS
              </h2>
            </div>
            <button
              onClick={() => onNavigate('players')}
              className="font-mono text-xs font-bold text-black hover:underline cursor-pointer"
            >
              All Players ({players.length}) →
            </button>
          </div>

          <div className="space-y-2">
            {topPlayers.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-stone-500 bg-stone-50 border border-stone-200">
                No calibrated players found for this category.
              </div>
            ) : (
              topPlayers.map((player, idx) => (
                <div
                  key={player.id}
                  onClick={() => onNavigate('player_profile', player.id)}
                  className="flex items-center justify-between p-2.5 bg-stone-50 hover:bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm w-5 text-stone-400">
                      #{idx + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-white border border-black flex items-center justify-center text-base shadow-[1px_1px_0px_0px_#000]">
                      {player.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 leading-none">
                        <span className="font-sans font-black text-sm uppercase text-black">
                          {player.username}
                        </span>
                        <span className="font-mono text-[10px] text-stone-500">
                          ({(player.realName || player.username || '').split(' ')[0]})
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-stone-600 block mt-0.5">
                        {player.primaryRole} · {player.city || 'India'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono font-black text-sm text-black block">
                      {player.mmr?.toLocaleString() ?? 5000} MMR
                    </span>
                    <span className="font-mono text-[10px] font-bold text-stone-500">
                      Rating {player.platformRating ?? 1500}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Top Teams Column */}
        <section className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#FFE600]" />
              <h2 className="font-sans font-black text-xl uppercase tracking-tight text-black">
                TOP INDIAN TEAMS
              </h2>
            </div>
            <button
              onClick={() => onNavigate('teams')}
              className="font-mono text-xs font-bold text-black hover:underline cursor-pointer"
            >
              All Teams ({teams.length}) →
            </button>
          </div>

          <div className="space-y-2">
            {topTeams.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-stone-500 bg-stone-50 border border-stone-200">
                No registered teams found for this category.
              </div>
            ) : (
              topTeams.map((team, idx) => (
              <div
                key={team.id}
                onClick={() => onNavigate('team_profile', team.id)}
                className="flex items-center justify-between p-2.5 bg-stone-50 hover:bg-[#E9D5FF] border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-sm w-5 text-stone-400">
                    #{idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded bg-white border border-black flex items-center justify-center text-lg shadow-[1px_1px_0px_0px_#000]">
                    {team.logo}
                  </div>
                  <div>
                    <span className="font-sans font-black text-sm uppercase text-black block leading-none">
                      {team.name}
                    </span>
                    <span className="font-mono text-[10px] text-stone-600 block mt-0.5">
                      {team.city || 'India'} · {team.tournamentWins ?? 0} Tourneys Won
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-black text-sm text-[#7C3AED] block">
                    {team.rating ?? 1500} PTS
                  </span>
                  <span className="font-mono text-[10px] font-bold text-stone-600">
                    {(team.record?.wins ?? 0)}W - {(team.record?.losses ?? 0)}L
                  </span>
                </div>
              </div>
            )))}
          </div>
        </section>
      </div>

      {/* ============================================================ */}
      {/* 5. INDIAN ESPORTS PLATFORM PILLARS BANNER */}
      {/* ============================================================ */}
      <section className="bg-black text-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#FFE600] p-6 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="bg-[#FFE600] text-black font-mono font-black text-[10px] px-2 py-0.5 border border-white">
                PURPLE BEAN GAMING TRUST
              </span>
              <span className="text-xs font-mono text-emerald-400">UPI / IMPS READY</span>
            </div>
            <h3 className="font-sans font-black text-2xl sm:text-3xl uppercase tracking-tight text-white">
              BUILT SPECIFICALLY FOR THE INDIAN COMPETITIVE SCENE
            </h3>
            <p className="font-mono text-xs text-stone-300">
              Direct INR prize distribution, Indian dedicated server verification, real-time live captain auction drafting, and referee anti-cheat auditing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenRegister}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-white px-5 py-2.5 font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#fff] cursor-pointer"
            >
              Register Team Now
            </button>
            <button
              onClick={() => onNavigate('tournaments')}
              className="bg-transparent hover:bg-white/10 text-white border-2 border-white px-5 py-2.5 font-mono text-xs font-black uppercase cursor-pointer"
            >
              Explore Tournaments
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
