import { useState, useMemo, useEffect } from 'react';
import { Users, Search, Filter, Shield, Trophy, MapPin, Gamepad2, Award } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { Player, ViewType } from '../types/tournament';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';
import { matchesPlayerSearch } from '../utils/playerSearch';

interface PlayersViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function PlayersView({ onNavigate }: PlayersViewProps) {
  const [search, setSearch] = useState('');
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [gameFilter, setGameFilter] = useState('All');
  const [minMmr, setMinMmr] = useState('0');
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setPlayers(tournamentService.getPlayers());
    });
    const unsubPbg = pbgAccountRegistry.subscribe(() => {
      setPlayers(tournamentService.getPlayers());
    });
    return () => {
      unsub();
      unsubPbg();
    };
  }, []);

  useEffect(() => {
    const unsubGames = gameManagementEngine.subscribe(() => {
      setActiveGames(gameManagementEngine.getActiveGames());
    });
    return unsubGames;
  }, []);

  const hasMultipleGames = activeGames.length > 1;

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      const matchesSearch = matchesPlayerSearch(p, search);
      const matchesGame = !hasMultipleGames || gameFilter === 'All' || p.primaryGame === gameFilter;
      const matchesMmr = p.mmr >= parseInt(minMmr || '0', 10);

      return matchesSearch && matchesGame && matchesMmr;
    });
  }, [players, search, gameFilter, minMmr, hasMultipleGames]);

  const gameOptions: DropdownOption[] = useMemo(() => {
    const opts: DropdownOption[] = [{ value: 'All', label: 'All Esports Titles' }];
    activeGames.forEach((g) => {
      opts.push({ value: g.name, label: g.name, icon: Gamepad2 });
    });
    return opts;
  }, [activeGames]);

  const mmrOptions: DropdownOption[] = [
    { value: '0', label: 'All MMR / Rating Tiers', icon: Award },
    { value: '7500', label: '7,500+ MMR (Elite Tier)', icon: Award },
    { value: '8200', label: '8,200+ MMR (National Finals)', icon: Award },
    { value: '8700', label: '8,700+ MMR (Pro Champions)', icon: Award }
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Users className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · PLAYER DATABASE</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          REGISTERED INDIAN PLAYERS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          Search calibrated Indian tournament participants, inspect agent masteries, MMR ratings, and city origins.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className={hasMultipleGames ? 'md:col-span-6' : 'md:col-span-8'}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PBG ID (e.g. PBG-000188), player handle, name, city (Mumbai, Siddipet...), role, or franchise..."
              className="w-full bg-white border-2 border-black px-3.5 py-2 font-mono text-xs font-bold text-black placeholder:text-stone-400 focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
            />
          </div>

          {hasMultipleGames && (
            <div className="md:col-span-3">
              <SelectDropdown
                value={gameFilter}
                onChange={(val) => setGameFilter(val)}
                options={gameOptions}
                className="w-full"
                placeholder="Game Title"
              />
            </div>
          )}

          <div className={hasMultipleGames ? 'md:col-span-3' : 'md:col-span-4'}>
            <SelectDropdown
              value={minMmr}
              onChange={(val) => setMinMmr(val)}
              options={mmrOptions}
              className="w-full"
              placeholder="Filter by MMR"
            />
          </div>
        </div>

        <div className="font-mono text-xs text-stone-600 flex justify-between items-center pt-1 border-t border-black/20">
          <span>Displaying <strong>{filteredPlayers.length}</strong> of {players.length} Players</span>
          <button
            onClick={() => onNavigate('captain_selection')}
            className="text-black font-black uppercase underline hover:text-[#7C3AED] cursor-pointer"
          >
            View Selected Indian Captains Showcase →
          </button>
        </div>
      </div>

      {/* Players Table */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left font-mono text-xs min-w-[620px]">
            <thead className="bg-[#E2E8F0] border-b-2 border-black uppercase text-[10px] font-black text-black">
              <tr>
                <th className="p-3.5">Player</th>
                <th className="p-3.5">Game</th>
                <th className="p-3.5">City / Region</th>
                <th className="p-3.5">Primary Role</th>
                <th className="p-3.5">Franchise</th>
                <th className="p-3.5 text-right">MMR</th>
                <th className="p-3.5 text-right">PBG Rating</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y border-stone-200">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-500 font-mono text-xs font-bold">
                    No registered players found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => (
                <tr
                  key={player.id || player.pbgId}
                  onClick={() => onNavigate('player_profile', player.pbgId || player.id)}
                  className="hover:bg-[#FFFDE8] transition-colors cursor-pointer group"
                >
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      {player.avatar && player.avatar.startsWith('http') ? (
                        <img 
                          src={player.avatar} 
                          alt={player.username} 
                          className="w-8 h-8 rounded-full border border-black object-cover shrink-0" 
                        />
                      ) : (
                        <span className="text-xl shrink-0">{player.avatar}</span>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-black text-sm group-hover:underline">
                            {player.displayName || player.username}
                          </span>
                          {player.pbgId && (
                            <span className="bg-[#5CE1E6] border border-black px-1.5 py-0.2 text-[9px] font-mono font-black text-black shadow-[1px_1px_0px_0px_#000]">
                              {player.pbgId}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-stone-500 font-normal block">
                          {player.realName && player.realName !== (player.displayName || player.username) 
                            ? player.realName 
                            : (player.pbgId ? `${player.pbgId} · Indian Contender` : 'Indian Contender')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black text-[10px] font-black uppercase">
                      {player.primaryGame || 'Dota 2'}
                    </span>
                  </td>
                  <td className="p-3.5 text-stone-700">
                    <span className="flex items-center gap-1 font-bold">
                      <MapPin className="w-3 h-3 text-[#7C3AED]" />
                      <span>{player.city || 'India'}</span>
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-stone-900">
                    <span className="bg-stone-100 border border-black px-2 py-0.5 inline-block text-[11px]">
                      {player.primaryRole?.split(' — ')[1] || player.primaryRole || 'Flex'}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-stone-800">
                    {player.teamName || 'Free Agent'}
                  </td>
                  <td className="p-3.5 text-right font-black text-black">
                    <span className="bg-[#FFE600] px-2 py-0.5 border border-black inline-block shadow-[1px_1px_0px_0px_#000]">
                      {(player.mmr ?? player.tournamentMmr ?? 6000).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-bold text-[#7C3AED]">
                    {player.platformRating}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${
                      player.status === 'Verified' ? 'bg-[#70FFAF] text-black' :
                      player.status === 'Pending Review' ? 'bg-[#FFE600] text-black' : 'bg-[#FF5757] text-white'
                    }`}>
                      {player.status}
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
