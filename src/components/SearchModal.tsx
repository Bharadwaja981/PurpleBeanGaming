import { useState, useMemo, useEffect } from 'react';
import { Search, X, Trophy, Shield, Users, ArrowRight, Calendar } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { dotaCareerHistoryEngine } from '../domain/dotaCareerHistoryEngine';
import { ViewType, Tournament, Team, Player } from '../types/tournament';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function SearchModal({ isOpen, onClose, onNavigate }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());
  const [teams, setTeams] = useState<Team[]>(() => tournamentService.getTeams());
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setTournaments(tournamentService.getTournaments());
      setTeams(tournamentService.getTeams());
      setPlayers(tournamentService.getPlayers());
    });
    return unsub;
  }, []);

  const effectiveTournaments = tournaments;
  const effectiveTeams = teams;
  const effectivePlayers = players;

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const allSeasons = useMemo(() => dotaCareerHistoryEngine.getAllSeasons(), []);

  const filteredTournaments = useMemo(() => {
    if (!query.trim()) return effectiveTournaments.slice(0, 3);
    return effectiveTournaments.filter((t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.game.toLowerCase().includes(query.toLowerCase())
    );
  }, [effectiveTournaments, query]);

  const filteredTeams = useMemo(() => {
    if (!query.trim()) return effectiveTeams.slice(0, 3);
    return effectiveTeams.filter((t) =>
      t.name.toLowerCase().includes(query.toLowerCase()) ||
      t.tag.toLowerCase().includes(query.toLowerCase())
    );
  }, [effectiveTeams, query]);

  const filteredPlayers = useMemo(() => {
    if (!query.trim()) return effectivePlayers.slice(0, 4);
    return effectivePlayers.filter((p) =>
      p.username.toLowerCase().includes(query.toLowerCase()) ||
      p.realName.toLowerCase().includes(query.toLowerCase()) ||
      p.primaryRole.toLowerCase().includes(query.toLowerCase())
    );
  }, [effectivePlayers, query]);

  const filteredSeasons = useMemo(() => {
    if (!query.trim()) return allSeasons.slice(0, 2);
    return allSeasons.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.id.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, allSeasons]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="bg-[#E2E8F0] border-b-[3px] border-black px-4 py-2 flex items-center justify-between font-mono text-xs font-black shrink-0">
          <div className="flex items-center gap-2 text-black">
            <Search className="w-3.5 h-3.5" />
            <span>GLOBAL PLATFORM SEARCH</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black hover:text-white border border-black transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Bar */}
        <div className="p-4 border-b-2 border-black bg-[#FFFBEB]">
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tournaments, teams, players (e.g. India Masters, Titans, SkRossi, Mumbai)..."
              className="w-full bg-white border-[2.5px] border-black px-4 py-3 font-mono text-sm font-bold text-black placeholder:text-stone-400 focus:outline-hidden shadow-[3px_3px_0px_0px_#000]"
            />
          </div>
        </div>

        {/* Results Container */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-5 font-mono text-xs">
          {/* Tournaments */}
          <div>
            <div className="text-[11px] font-black uppercase text-stone-500 mb-2 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#FF5757]" />
              <span>Tournaments ({filteredTournaments.length})</span>
            </div>
            {filteredTournaments.length === 0 ? (
              <div className="text-stone-500 italic p-2 border border-dashed border-stone-300">
                No tournaments found matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredTournaments.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onNavigate('tournament_detail', t.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 bg-stone-50 hover:bg-[#FFDE59] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-black" />
                      <span className="font-black text-black">{t.name}</span>
                      <span className="text-stone-600">· {t.game}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-700">{t.prizePool}</span>
                      <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Teams */}
          <div>
            <div className="text-[11px] font-black uppercase text-stone-500 mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#5CE1E6]" />
              <span>Teams ({filteredTeams.length})</span>
            </div>
            {filteredTeams.length === 0 ? (
              <div className="text-stone-500 italic p-2 border border-dashed border-stone-300">
                No teams found matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => {
                      onNavigate('team_profile', team.id);
                      onClose();
                    }}
                    className="flex items-center justify-between p-2 bg-stone-50 hover:bg-[#5CE1E6] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-left transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{team.logo}</span>
                      <div>
                        <div className="font-black text-black">{team.name}</div>
                        <div className="text-[10px] text-stone-600">Rating: {team.rating}</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-black text-white px-1.5 py-0.5">
                      {team.record.wins}W-{team.record.losses}L
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Players */}
          <div>
            <div className="text-[11px] font-black uppercase text-stone-500 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#FF70A6]" />
              <span>Players ({filteredPlayers.length})</span>
            </div>
            {filteredPlayers.length === 0 ? (
              <div className="text-stone-500 italic p-2 border border-dashed border-stone-300">
                No players found matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredPlayers.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => {
                      onNavigate('player_profile', player.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 bg-stone-50 hover:bg-[#FF70A6] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-left transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{player.avatar}</span>
                      <div>
                        <span className="font-black text-black text-xs mr-2">{player.username}</span>
                        <span className="text-[10px] text-stone-600">{player.realName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[10px] text-stone-600">{player.teamName}</span>
                      <span className="font-black text-black bg-[#FFDE59] border border-black px-1.5 py-0.5">
                        {player.mmr.toLocaleString()} MMR
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seasons */}
          <div>
            <div className="text-[11px] font-black uppercase text-stone-500 mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Competitive Seasons ({filteredSeasons.length})</span>
            </div>
            {filteredSeasons.length === 0 ? (
              <div className="text-stone-500 italic p-2 border border-dashed border-stone-300">
                No competitive seasons matching &quot;{query}&quot;
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredSeasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => {
                      onNavigate('rankings');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2 bg-stone-50 hover:bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_#000] text-left transition-colors cursor-pointer group"
                  >
                    <div>
                      <div className="font-black text-black text-xs">{season.name}</div>
                      <div className="text-[10px] text-stone-600">{season.tournaments.length} Official Tournaments</div>
                    </div>
                    <span className="text-[10px] font-black bg-black text-[#FFE600] px-1.5 py-0.5 uppercase">
                      {season.isActive ? 'Active' : 'Completed'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-stone-100 border-t-2 border-black px-4 py-2 flex items-center justify-between font-mono text-[11px] text-stone-600">
          <span>Click any item to view details</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
