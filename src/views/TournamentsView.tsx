import { useState, useMemo, useEffect } from 'react';
import { Trophy, Search, Filter, Calendar, Users, ArrowRight, Radio, MapPin, Gamepad2, Plus, Shield, Play, Pause, StopCircle, Trash2, Gavel } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { Tournament, ViewType } from '../types/tournament';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { SelectDropdown } from '../components/ui/Dropdown';
import { PromptModal } from '../components/ui/PromptModal';
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
  onOpenCreateTournament?: () => void;
}

export function TournamentsView({ onNavigate, onOpenRegister, onOpenCreateTournament }: TournamentsViewProps) {
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [gameFilter, setGameFilter] = useState<string>('All');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [lifecycleBusyId, setLifecycleBusyId] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [holdModalTournament, setHoldModalTournament] = useState<Tournament | null>(null);

  const currentUser = tournamentService.getCurrentUser();
  const isSpectator = currentUser.role === 'spectator' || currentUser.id === 'guest-spectator' || !currentUser.email;
  const isOrganiserOrAdmin = 
    !isSpectator && (
      currentUser.role === 'organizer' || 
      currentUser.isAdmin || 
      currentUser.isPrimaryAdmin || 
      (currentUser.email?.toLowerCase().trim() === '11106cm009@gmail.com')
    );

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackNotice({ message, type });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleCardAdvance = async (t: Tournament) => {
    setLifecycleBusyId(t.id);
    let nextStage: 'DRAFTING' | 'LIVE' | 'COMPLETED' = 'DRAFTING';
    const s = t.status;
    if (s === 'Registration Open' || t.lifecycle === 'REGISTRATION_OPEN') nextStage = 'DRAFTING';
    else if (s === 'Drafting' || t.lifecycle === 'DRAFTING') nextStage = 'LIVE';
    else if (s === 'Live' || t.lifecycle === 'LIVE') nextStage = 'COMPLETED';

    const res = await tournamentService.setTournamentLifecycle(t.id, nextStage);
    setLifecycleBusyId(null);
    if (res.success) showFeedback(res.message || `Advanced to ${nextStage}!`);
    else showFeedback(res.error || 'Failed to advance', 'error');
  };

  const handleCardHoldResume = async (t: Tournament) => {
    const isOnHold = t.status === 'On Hold' || t.lifecycle === 'ON_HOLD';
    if (isOnHold) {
      setLifecycleBusyId(t.id);
      const res = await tournamentService.resumeTournament(t.id);
      setLifecycleBusyId(null);
      if (res.success) showFeedback(res.message || 'Tournament resumed.');
      else showFeedback(res.error || 'Failed to resume.', 'error');
    } else {
      setHoldModalTournament(t);
    }
  };

  const handleCardCancel = async (t: Tournament) => {
    setLifecycleBusyId(t.id);
    const res = await tournamentService.setTournamentLifecycle(t.id, 'CANCELLED');
    setLifecycleBusyId(null);
    if (res.success) {
      setTournaments(prev => prev.map(item => item.id === t.id ? { ...item, status: 'Cancelled' as any, lifecycle: 'CANCELLED' } : item));
      showFeedback(res.message || 'Tournament cancelled.');
    } else {
      showFeedback(res.error || 'Failed to cancel.', 'error');
    }
  };

  const handleCardDelete = async (t: Tournament) => {
    setLifecycleBusyId(t.id);
    const res = await tournamentService.deleteTournament(t.id);
    setLifecycleBusyId(null);
    if (res.success) {
      setTournaments(prev => prev.filter(item => item.id !== t.id));
      showFeedback(`Tournament '${t.name}' deleted.`);
    } else {
      showFeedback(res.error || 'Failed to delete.', 'error');
    }
  };

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
        // (unless current user is an organiser/admin, or created the tournament)
        const isMine = Boolean(
          currentUser.id && (
            (t as any).organiserId === currentUser.id ||
            (t as any).organizer === currentUser.id ||
            (t as any).createdBy === currentUser.id ||
            (currentUser.email && (t as any).organizerEmail && (t as any).organizerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
          )
        );
        if (!isPubliclyDiscoverable(t) && !isOrganiserOrAdmin && !isMine) {
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
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
              <Trophy className="w-4 h-4 text-[#7C3AED]" />
              <span>PURPLE BEAN GAMING · INDIA CIRCUIT</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
              ESPORTS TOURNAMENTS
            </h1>
          </div>

          {isOrganiserOrAdmin && onOpenCreateTournament && (
            <button
              type="button"
              onClick={onOpenCreateTournament}
              className="px-4 py-2.5 bg-[#FFE600] hover:bg-[#FFDE59] active:translate-x-0.5 active:translate-y-0.5 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all self-start sm:self-center shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Create Tournament</span>
            </button>
          )}
        </div>
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

      {/* Action Feedback Notice */}
      {feedbackNotice && (
        <div className={`p-4 border-[3px] border-black font-mono text-xs font-black flex items-center justify-between shadow-[4px_4px_0px_0px_#000] animate-in fade-in ${
          feedbackNotice.type === 'error' ? 'bg-red-50 text-red-900 border-red-950' : 'bg-[#70FFAF] text-black'
        }`}>
          <span>{feedbackNotice.message}</span>
          <button 
            onClick={() => setFeedbackNotice(null)}
            className="px-1.5 py-0.5 border border-black hover:bg-black hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tournament Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTournaments.map((tourney) => {
          const normSt = normalizeStatus(tourney.status || tourney.lifecycle);
          const isLive = normSt === 'ACTIVE' || normSt === 'LIVE' || normSt === 'AUCTION_ACTIVE';
          const isOpen = normSt === 'REGISTRATION_OPEN';
          const isDrafting = normSt === 'CAPTAIN_SELECTION' || normSt === 'AUCTION_READY' || normSt === 'AUCTION_COMPLETED';
          const isCompleted = normSt === 'COMPLETED';
          const isCreator = Boolean(
            (tourney as any).organiserId === currentUser.id ||
            (tourney as any).organizer === currentUser.id ||
            (tourney as any).organizerId === currentUser.id ||
            (tourney as any).createdBy === currentUser.id ||
            ((tourney as any).organizerEmail && currentUser.email && (tourney as any).organizerEmail.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
          );
          const canManage = !isSpectator && (isOrganiserOrAdmin || isCreator);

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

              {/* Organiser Lifecycle Quick Actions */}
              {canManage && (
                <div className="pt-3 border-t-2 border-dashed border-stone-300 space-y-2 bg-[#FFFDE8] -mx-5 -mb-2 p-3">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-stone-600">
                    <span className="flex items-center gap-1 text-black font-bold">
                      <Shield className="w-3 h-3 text-[#7C3AED]" />
                      <span>Organiser Controls:</span>
                    </span>
                    <span className="font-bold text-stone-500">
                      ID: {tourney.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Advance */}
                    {(tourney.status === 'Registration Open' || tourney.lifecycle === 'REGISTRATION_OPEN') && (
                      <button
                        type="button"
                        disabled={lifecycleBusyId === tourney.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardAdvance(tourney);
                        }}
                        className="px-2 py-1 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Gavel className="w-3 h-3 text-[#FFE600]" />
                        <span>Advance to Draft</span>
                      </button>
                    )}

                    {(tourney.status === 'Drafting' || tourney.lifecycle === 'DRAFTING') && (
                      <button
                        type="button"
                        disabled={lifecycleBusyId === tourney.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardAdvance(tourney);
                        }}
                        className="px-2 py-1 bg-[#38EF7D] hover:bg-emerald-400 text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-black" />
                        <span>Start Matches</span>
                      </button>
                    )}

                    {(tourney.status === 'Live' || tourney.lifecycle === 'LIVE') && (
                      <button
                        type="button"
                        disabled={lifecycleBusyId === tourney.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardAdvance(tourney);
                        }}
                        className="px-2 py-1 bg-black hover:bg-stone-800 text-white border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trophy className="w-3 h-3 text-[#FFE600]" />
                        <span>Conclude</span>
                      </button>
                    )}

                    {/* Hold / Resume */}
                    {(tourney.status === 'On Hold' || tourney.lifecycle === 'ON_HOLD') ? (
                      <button
                        type="button"
                        disabled={lifecycleBusyId === tourney.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardHoldResume(tourney);
                        }}
                        className="px-2 py-1 bg-[#38EF7D] hover:bg-emerald-400 text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Play className="w-3 h-3 text-black" />
                        <span>Resume</span>
                      </button>
                    ) : (
                      tourney.status !== 'Completed' && tourney.status !== 'Cancelled' && (
                        <button
                          type="button"
                          disabled={lifecycleBusyId === tourney.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardHoldResume(tourney);
                          }}
                          className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Pause className="w-3 h-3" />
                          <span>Hold</span>
                        </button>
                      )
                    )}

                    {/* Cancel */}
                    {tourney.status !== 'Cancelled' && tourney.status !== 'Completed' && (
                      <button
                        type="button"
                        disabled={lifecycleBusyId === tourney.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardCancel(tourney);
                        }}
                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <StopCircle className="w-3 h-3 text-rose-700" />
                        <span>Cancel</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      disabled={lifecycleBusyId === tourney.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardDelete(tourney);
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Permanently delete tournament"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

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
          <h3 className="font-sans font-black text-xl uppercase">
            {tournaments.length === 0 ? 'No Active Tournaments' : 'No Tournaments Match Your Filter'}
          </h3>
          <p className="font-mono text-xs text-stone-600">
            {tournaments.length === 0 
              ? 'There are currently no active tournaments. New championships will appear here once announced.' 
              : 'Try selecting another game title or clearing your search query.'}
          </p>
          {tournaments.length > 0 && (
            <button
              onClick={() => {
                setStatusFilter('All');
                setGameFilter('All');
                setRegionFilter('All');
                setSearchQuery('');
              }}
              className="bg-[#FFE600] border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* Neo-brutalist Tournament Hold Reason Modal */}
      {holdModalTournament && (
        <PromptModal
          isOpen={Boolean(holdModalTournament)}
          onClose={() => setHoldModalTournament(null)}
          onSubmit={async (reason) => {
            const t = holdModalTournament;
            setHoldModalTournament(null);
            setLifecycleBusyId(t.id);
            const res = await tournamentService.setTournamentLifecycle(t.id, 'ON_HOLD', reason.trim() || 'Operational hold');
            setLifecycleBusyId(null);
            if (res.success) showFeedback(res.message || 'Tournament put on hold.');
            else showFeedback(res.error || 'Failed to hold.', 'error');
          }}
          title="Hold Tournament"
          subtitle="Operational Adjustment"
          message={`Please specify the administrative reason for placing '${holdModalTournament.name}' on hold:`}
          defaultValue="Operational delay / Schedule adjustment"
          placeholder="e.g. Server outage, roster review, emergency maintenance"
          submitLabel="APPLY HOLD"
        />
      )}
    </div>
  );
}
