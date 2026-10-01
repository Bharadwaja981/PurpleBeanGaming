import { useState, useMemo, useEffect } from 'react';
import { Trophy, Search, Filter, Calendar, Users, ArrowRight, Radio, MapPin, Gamepad2 } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { Tournament, ViewType } from '../types/tournament';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { SelectDropdown } from '../components/ui/Dropdown';
import {
  isPubliclyDiscoverable,
  matchesStatusCategory,
  matchesGameFilter,
  matchesRegionFilter,
  normalizeTournamentRecord,
  normalizeStatus
} from '../domain/tournamentDiscovery';

interface TournamentsViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister: (tournamentId?: string) => void;
}

export function TournamentsView({ onNavigate, onOpenRegister }: TournamentsViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [gameFilter, setGameFilter] = useState<string>('All');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());

  useEffect(() => {
    const sync = () => {
      setTournaments(tournamentService.getTournaments());
    };
    const unsubService = tournamentService.subscribe(sync);
    const unsubRegistry = tournamentConfigRegistry.subscribe(sync);
    return () => {
      unsubService();
      unsubRegistry();
    };
  }, []);

  useEffect(() => {
    const unsubGames = gameManagementEngine.subscribe(() => {
      setActiveGames(gameManagementEngine.getActiveGames());
    });
    return unsubGames;
  }, []);

  const hasMultipleGames = activeGames.length > 1;

  const filteredTournaments = useMemo(() => {
    return tournaments
      .map(normalizeTournamentRecord)
      .filter((t) => {
        // 1. Authoritative public discovery rule:
        // Tournament must be visibility == PUBLIC and lifecycle is discoverable
        if (!isPubliclyDiscoverable(t)) {
          return false;
        }

        // 2. Status Category Filter
        if (!matchesStatusCategory(t.status || t.lifecycle, statusFilter)) {
          return false;
        }

        // 3. Game Filter (supports Dota 2 vs dota2 and all titles)
        if (!matchesGameFilter(t.game, t.gameId, gameFilter)) {
          return false;
        }

        // 4. Region Filter (All India Regions includes Pan India)
        if (!matchesRegionFilter(t.region, regionFilter)) {
          return false;
        }

        // 5. Search query matching
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = t.name.toLowerCase().includes(q);
          const matchDesc = (t.description || '').toLowerCase().includes(q);
          const matchCity = (t.city || '').toLowerCase().includes(q);
          const matchRegion = (t.region || '').toLowerCase().includes(q);
          if (!matchName && !matchDesc && !matchCity && !matchRegion) {
            return false;
          }
        }

        return true;
      });
  }, [tournaments, statusFilter, gameFilter, regionFilter, searchQuery]);

  const statuses = ['All', 'Live', 'Upcoming', 'Registration Open', 'Drafting', 'Completed'];
  const statusOptions = statuses.map((s) => ({ value: s, label: s === 'All' ? 'All Statuses' : s }));
  const gameOptions = [
    { value: 'All', label: 'All Esports Titles' },
    ...activeGames.map((g) => ({ value: g.name, label: g.name }))
  ];
  const regions = ['All', 'Pan India', 'South India', 'West India', 'North India', 'East India'];
  const regionOptions = regions.map((r) => ({ value: r, label: r === 'All' ? 'All India Regions' : r }));

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Trophy className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · INDIA CIRCUIT</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          ESPORTS TOURNAMENTS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          Browse active Indian championships, open registration brackets, live captain drafts, and regional LAN tournaments across India with verified ₹ INR prize pools.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 space-y-4">
        {/* Top search & dropdown row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className={hasMultipleGames ? "md:col-span-5 relative" : "md:col-span-7 relative"}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tournament, Indian city (Mumbai, Bengaluru, Delhi...)"
              className="w-full bg-white border-2 border-black px-3.5 py-2 font-mono text-xs font-bold text-black placeholder:text-stone-400 focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
            />
          </div>

          {hasMultipleGames && (
            <div className="md:col-span-3">
              <SelectDropdown
                value={gameFilter}
                onChange={setGameFilter}
                options={gameOptions}
                icon={Gamepad2}
                placeholder="All Games"
                className="w-full"
              />
            </div>
          )}

          <div className={hasMultipleGames ? "md:col-span-2" : "md:col-span-3"}>
            <SelectDropdown
              value={regionFilter}
              onChange={setRegionFilter}
              options={regionOptions}
              icon={MapPin}
              placeholder="All Regions"
              className="w-full"
            />
          </div>

          <div className="md:col-span-2">
            <button
              onClick={() => onOpenRegister('auction-basic-test-1')}
              className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black py-2 px-3 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              + Register
            </button>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-black/20">
          <span className="font-mono text-xs font-black uppercase text-stone-500 mr-2">Status:</span>
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-stone-700 hover:bg-stone-100 shadow-[1px_1px_0px_0px_#000]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Tournament Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tourney) => {
          const normSt = normalizeStatus(tourney.status || tourney.lifecycle);
          const isLive = normSt === 'ACTIVE' || normSt === 'LIVE' || normSt === 'AUCTION_ACTIVE';
          const isOpen = normSt === 'REGISTRATION_OPEN';
          const isDrafting = normSt === 'CAPTAIN_SELECTION' || normSt === 'AUCTION_READY' || normSt === 'AUCTION_COMPLETED';
          const isCompleted = normSt === 'COMPLETED';

          const displayStatusLabel = 
            normSt === 'REGISTRATION_OPEN' ? 'Registration Open' :
            normSt === 'ACTIVE' ? 'Live' :
            normSt === 'AUCTION_ACTIVE' ? 'Live Auction' :
            normSt === 'CAPTAIN_SELECTION' ? 'Captain Draft' :
            normSt === 'AUCTION_READY' ? 'Auction Ready' :
            normSt === 'AUCTION_COMPLETED' ? 'Draft Completed' :
            normSt === 'REGISTRATION_CLOSED' ? 'Registration Closed' :
            normSt === 'SEEDING' ? 'Seeding Brackets' :
            normSt === 'STRUCTURE_GENERATED' ? 'Brackets Drawn' :
            normSt === 'COMPLETED' ? 'Completed' :
            normSt === 'CANCELLED' ? 'Cancelled' :
            tourney.status;

          return (
            <div
              key={tourney.id}
              className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-black uppercase bg-[#FFE600] px-2.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] flex items-center gap-1">
                      <Gamepad2 className="w-3 h-3" />
                      {tourney.game}
                    </span>
                    {Boolean(tourney.isDevelopment || tourney.visibility === 'DEVELOPMENT' || tourney.id === 'auction-test') && (
                      <span className="font-mono text-[10px] font-black uppercase bg-[#F3E8FF] text-[#7C3AED] px-2 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000]">
                        DEVELOPMENT / TEST
                      </span>
                    )}
                  </div>

                  <span className={`font-mono text-xs font-black uppercase px-2.5 py-0.5 border border-black shadow-[1px_1px_0px_0px_#000] ${
                    isLive 
                      ? 'bg-[#FF5757] text-white animate-pulse' 
                      : isOpen 
                      ? 'bg-[#70FFAF] text-black' 
                      : isDrafting
                      ? 'bg-[#FF70A6] text-black'
                      : isCompleted
                      ? 'bg-stone-200 text-stone-800'
                      : 'bg-stone-100 text-stone-700'
                  }`}>
                    {displayStatusLabel}
                  </span>
                </div>

                <div>
                  <h2 className="font-sans font-black text-2xl text-black uppercase leading-tight">
                    {tourney.name}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1 font-mono text-xs text-stone-600 font-bold">
                    <MapPin className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>{tourney.region} {tourney.city ? `· ${tourney.city}` : ''}</span>
                  </div>
                </div>

                <p className="font-mono text-xs text-stone-600 line-clamp-3 leading-relaxed">
                  {tourney.description}
                </p>

                <div className="grid grid-cols-2 gap-2 pt-2 font-mono text-xs">
                  <div className="bg-[#FFF9E6] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] text-stone-500 uppercase block font-black">Prize Pool</span>
                    <span className="font-black text-black text-base text-[#7C3AED]">
                      {tourney.prizePoolINR || tourney.prizePool}
                    </span>
                  </div>
                  <div className="bg-[#FFF9E6] border-2 border-black p-2.5 shadow-[2px_2px_0px_0px_#000]">
                    <span className="text-[10px] text-stone-500 uppercase block font-black">Format</span>
                    <span className="font-black text-black text-xs line-clamp-2">
                      {tourney.format}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-black flex items-center justify-between">
                <div className="font-mono text-xs text-stone-600 font-bold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{tourney.dates}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isOpen && (
                    <button
                      onClick={() => onOpenRegister(tourney.id)}
                      className="bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black px-2.5 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Join
                    </button>
                  )}
                  <button
                    onClick={() => onNavigate('tournament_detail', tourney.id)}
                    className="bg-black hover:bg-stone-800 text-white border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] cursor-pointer flex items-center gap-1"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredTournaments.length === 0 && (
        <div className="bg-white border-[3.5px] border-black p-10 text-center space-y-3 shadow-[6px_6px_0px_0px_#000]">
          <h3 className="font-sans font-black text-xl uppercase">No Tournaments Match Your Filter</h3>
          <p className="font-mono text-xs text-stone-600">Try selecting another game title or clear your search query.</p>
          <button
            onClick={() => {
              setStatusFilter('All');
              setGameFilter('All');
              setRegionFilter('All');
              setSearchQuery('');
            }}
            className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000]"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
