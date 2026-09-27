import { useState, useMemo, useEffect } from 'react';
import { Award, Trophy, Users, Shield, ArrowUpRight, Gamepad2, MapPin, Calendar, CheckCircle2, Star, Filter } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { ViewType, Player, Team } from '../types/tournament';
import { dotaCareerHistoryEngine } from '../domain/dotaCareerHistoryEngine';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface RankingsViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function RankingsView({ onNavigate }: RankingsViewProps) {
  const [rankingTab, setRankingTab] = useState<'players' | 'teams' | 'seasons'>('players');
  const [activeGames, setActiveGames] = useState(() => gameManagementEngine.getActiveGames());
  const [gameFilter, setGameFilter] = useState<string>('Dota 2');
  const [seasonFilter, setSeasonFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [establishedOnly, setEstablishedOnly] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());
  const [teams, setTeams] = useState<Team[]>(() => tournamentService.getTeams());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setPlayers(tournamentService.getPlayers());
      setTeams(tournamentService.getTeams());
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

  const gameOptions: DropdownOption[] = useMemo(() => {
    return activeGames.map(g => ({ value: g.name, label: g.name, icon: Gamepad2 }));
  }, [activeGames]);

  const allSeasons = useMemo(() => dotaCareerHistoryEngine.getAllSeasons(), []);

  const seasonOptions: DropdownOption[] = useMemo(() => {
    const opts: DropdownOption[] = [{ value: 'all', label: 'Lifetime / Overall', icon: Calendar }];
    allSeasons.forEach(s => {
      opts.push({ value: s.id, label: s.name.split(':')[0], icon: Calendar });
    });
    return opts;
  }, [allSeasons]);

  const regionOptions: DropdownOption[] = [
    { value: 'All', label: 'All Regions', icon: MapPin },
    { value: 'West India', label: 'West India', icon: MapPin },
    { value: 'South India', label: 'South India', icon: MapPin },
    { value: 'North India', label: 'North India', icon: MapPin }
  ];

  // Dota 2 Authoritative Rankings from dotaCareerHistoryEngine
  const dotaPlayerRankings = useMemo(() => {
    return dotaCareerHistoryEngine.getPlayerRankings({
      seasonId: seasonFilter === 'all' ? undefined : seasonFilter,
      region: regionFilter,
      establishedOnly
    });
  }, [seasonFilter, regionFilter, establishedOnly]);

  const dotaTeamRankings = useMemo(() => {
    return dotaCareerHistoryEngine.getTeamRankings({
      seasonId: seasonFilter === 'all' ? undefined : seasonFilter
    });
  }, [seasonFilter]);

  // Non-Dota games sorted players and teams
  const genericSortedPlayers = useMemo(() => {
    return [...players]
      .filter((p) => gameFilter === 'All' || p.primaryGame === gameFilter)
      .sort((a, b) => b.mmr - a.mmr);
  }, [players, gameFilter]);

  const genericSortedTeams = useMemo(() => {
    return [...teams]
      .filter((t) => gameFilter === 'All' || t.primaryGame === gameFilter)
      .sort((a, b) => b.rating - a.rating);
  }, [teams, gameFilter]);

  const isDota = gameFilter === 'Dota 2';

  const topThreeDotaPlayers = dotaPlayerRankings.slice(0, 3);
  const topThreeDotaTeams = dotaTeamRankings.slice(0, 3);

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Award className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · NATIONAL LEADERBOARDS</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          OFFICIAL INDIAN RANKINGS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          National Indian esports leaderboard updated following every sanctioned tournament series. 
          Competitive Elo rating reflects verified tournament results, separate from Valve client MMR.
        </p>
      </div>

      {/* Tabs and Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000]">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRankingTab('players')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              rankingTab === 'players'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            Player Leaderboard
          </button>

          <button
            onClick={() => setRankingTab('teams')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              rankingTab === 'teams'
                ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                : 'bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            Franchise Standings
          </button>

          {isDota && (
            <button
              onClick={() => setRankingTab('seasons')}
              className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                rankingTab === 'seasons'
                  ? 'bg-[#7C3AED] text-white shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              Seasons &amp; Circuits
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {hasMultipleGames && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-black uppercase text-stone-600">Game:</span>
              <SelectDropdown
                value={gameFilter}
                onChange={(val) => setGameFilter(val)}
                options={gameOptions}
                size="sm"
              />
            </div>
          )}

          {isDota && rankingTab !== 'seasons' && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-black uppercase text-stone-600">Season:</span>
                <SelectDropdown
                  value={seasonFilter}
                  onChange={(val) => setSeasonFilter(val)}
                  options={seasonOptions}
                  size="sm"
                />
              </div>

              {rankingTab === 'players' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-black uppercase text-stone-600">Region:</span>
                    <SelectDropdown
                      value={regionFilter}
                      onChange={(val) => setRegionFilter(val)}
                      options={regionOptions}
                      size="sm"
                    />
                  </div>

                  <label className="flex items-center gap-1.5 bg-white border-2 border-black px-2.5 py-1 font-mono text-xs font-bold cursor-pointer shadow-[2px_2px_0px_0px_#000]">
                    <input
                      type="checkbox"
                      checked={establishedOnly}
                      onChange={(e) => setEstablishedOnly(e.target.checked)}
                      className="accent-[#7C3AED]"
                    />
                    <span>Established Only</span>
                  </label>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* SEASONS TAB VIEW */}
      {isDota && rankingTab === 'seasons' && (
        <div className="space-y-6">
          {allSeasons.map((season) => (
            <div key={season.id} className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6 font-mono text-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                      ACTIVE CIRCUIT
                    </span>
                    <span className="text-stone-500 font-bold">{season.code}</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase font-sans text-black mt-1">
                    {season.name}
                  </h2>
                  <p className="text-stone-600 text-xs">
                    Sanctioned circuit running from {new Date(season.startDate).toLocaleDateString()} to {new Date(season.endDate).toLocaleDateString()}.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-stone-500 block">Sanctioned Cups</span>
                  <span className="text-xl font-black text-[#7C3AED]">{season.tournaments.length} Tournaments</span>
                </div>
              </div>

              {/* Champions Podium in Season */}
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase text-black font-sans border-b border-black pb-1">
                  SEASON CHAMPIONS &amp; TROPHY WINNERS
                </h3>
                {season.champions.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {season.champions.map((c, idx) => (
                      <div key={idx} className="p-4 bg-[#FFF9E6] border-2 border-black flex items-center justify-between shadow-[2px_2px_0px_0px_#000]">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">🏆</span>
                          <div>
                            <span className="font-black text-black text-sm block">{c.teamName}</span>
                            <span className="text-stone-500 text-[11px]">Led by Captain {c.captainIgn}</span>
                          </div>
                        </div>
                        <span className="bg-[#70FFAF] text-black px-2 py-1 border border-black font-black uppercase text-[10px]">
                          {c.tournamentName}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-stone-50 border border-black text-center text-stone-500">
                    <p className="font-bold">No crowned champions yet this season. Grand finals pending!</p>
                  </div>
                )}
              </div>

              {/* Notable Results */}
              <div className="space-y-3">
                <h3 className="text-sm font-black uppercase text-black font-sans border-b border-black pb-1">
                  NOTABLE CIRCUIT RESULTS &amp; KEY AUDITS
                </h3>
                <div className="space-y-2">
                  {season.notableResults.map((nr, idx) => (
                    <div key={idx} className="p-2.5 bg-stone-50 border border-black flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-stone-800 font-bold">{nr}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Top 3 Podium Highlights */}
      {rankingTab !== 'seasons' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {rankingTab === 'players' ? (
            isDota ? (
              topThreeDotaPlayers.map((p, idx) => (
                <div
                  key={p.playerId}
                  onClick={() => onNavigate('player_profile', p.playerId)}
                  className={`p-5 border-[3.5px] border-black transition-all cursor-pointer ${
                    idx === 0
                      ? 'bg-[#FFFBEB] shadow-[8px_8px_0px_0px_#000] -translate-y-1'
                      : 'bg-white shadow-[5px_5px_0px_0px_#000]'
                  }`}
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <span className={`w-7 h-7 flex items-center justify-center font-mono font-black text-sm border-2 border-black ${
                      idx === 0 ? 'bg-[#FFE600] text-black' : idx === 1 ? 'bg-stone-200' : 'bg-[#FFDE59]/50'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-[10px] font-black uppercase text-stone-600">
                      {idx === 0 ? '🏆 NATIONAL #1 SEED' : idx === 1 ? 'RUNNER UP' : 'PODIUM SEED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{p.avatar}</span>
                    <div>
                      <h3 className="font-black text-lg text-black uppercase font-sans">
                        {p.ign}
                      </h3>
                      <p className="font-mono text-[11px] text-stone-500">{p.region} · {p.primaryRole}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border-2 border-black font-mono text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Purple Bean Rating:</span>
                      <span className="font-black text-[#7C3AED]">{p.competitiveRating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Status:</span>
                      <span className={`font-black text-[10px] px-1 border border-black ${p.ratingStatus === 'ESTABLISHED' ? 'bg-[#70FFAF]' : 'bg-[#FFDE59]'}`}>
                        {p.ratingStatus}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Squad:</span>
                      <span className="font-bold">{p.teamName}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              genericSortedPlayers.slice(0, 3).map((p, idx) => (
                <div key={p.id} onClick={() => onNavigate('player_profile', p.id)} className="p-5 border-[3.5px] border-black bg-white shadow-[5px_5px_0px_0px_#000] cursor-pointer">
                  <span className="font-mono font-black">#{idx + 1} - {p.username}</span>
                </div>
              ))
            )
          ) : (
            isDota ? (
              topThreeDotaTeams.map((t, idx) => (
                <div
                  key={t.teamId}
                  onClick={() => onNavigate('team_profile', t.teamId)}
                  className={`p-5 border-[3.5px] border-black transition-all cursor-pointer ${
                    idx === 0
                      ? 'bg-[#FFFBEB] shadow-[8px_8px_0px_0px_#000] -translate-y-1'
                      : 'bg-white shadow-[5px_5px_0px_0px_#000]'
                  }`}
                >
                  <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-3">
                    <span className={`w-7 h-7 flex items-center justify-center font-mono font-black text-sm border-2 border-black ${
                      idx === 0 ? 'bg-[#FFE600] text-black' : idx === 1 ? 'bg-stone-200' : 'bg-[#FFDE59]/50'
                    }`}>
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-[10px] font-black uppercase text-stone-600">
                      {idx === 0 ? '👑 CHAMPION SEED' : 'TIER 1 SEED'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{t.logo}</span>
                    <div>
                      <h3 className="font-black text-lg text-black uppercase font-sans">
                        {t.teamName}
                      </h3>
                      <p className="font-mono text-[11px] text-stone-500">Official Tag: {t.tag}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white border-2 border-black font-mono text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Team ELO:</span>
                      <span className="font-black text-black">{t.rating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Championships:</span>
                      <span className="font-black text-[#7C3AED]">{t.tournamentWins} 🏆</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500">Record:</span>
                      <span className="font-bold">{t.wins}W - {t.losses}L</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              genericSortedTeams.slice(0, 3).map((t, idx) => (
                <div key={t.id} onClick={() => onNavigate('team_profile', t.id)} className="p-5 border-[3.5px] border-black bg-white shadow-[5px_5px_0px_0px_#000] cursor-pointer">
                  <span className="font-mono font-black">#{idx + 1} - {t.name}</span>
                </div>
              ))
            )
          )}
        </div>
      )}

      {/* Main Leaderboard Table */}
      {rankingTab !== 'seasons' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
          {/* Rating Framework Notice */}
          <div className="p-3 bg-[#F3E8FF] border-b-2 border-black font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-[#7C3AED] uppercase">RATINGS ARCHITECTURE:</span>
              <span className="text-stone-700">Official Purple Bean Competitive Elo is separate from Valve client MMR.</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="bg-[#70FFAF] text-black px-2 py-0.5 border border-black font-bold">ESTABLISHED (≥5 matches)</span>
              <span className="bg-[#FFDE59] text-black px-2 py-0.5 border border-black font-bold">PROVISIONAL (&lt;5 matches)</span>
            </div>
          </div>

          <div className="overflow-x-auto table-scroll-container">
            {rankingTab === 'players' ? (
              <table className="w-full text-left font-mono text-xs min-w-[760px]">
                <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">IGN</th>
                    <th className="p-3">Team</th>
                    <th className="p-3">Primary Role</th>
                    <th className="p-3 text-right">Purple Bean Rating</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Match Record</th>
                    <th className="p-3 text-center">Recent Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-stone-200">
                  {dotaPlayerRankings.map((p) => (
                    <tr
                      key={p.playerId}
                      onClick={() => onNavigate('player_profile', p.playerId)}
                      className="hover:bg-stone-50 cursor-pointer"
                    >
                      <td className="p-3 font-black text-black">#{p.rank}</td>
                      <td className="p-3 font-bold">
                        <div className="flex items-center gap-2">
                          <span>{p.avatar}</span>
                          <span className="font-black">{p.ign}</span>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-stone-800">{p.teamName}</td>
                      <td className="p-3 text-stone-700 font-bold">{p.primaryRole}</td>
                      <td className="p-3 text-right font-black text-[#7C3AED] text-sm">
                        <span className="bg-[#F3E8FF] px-2 py-0.5 border border-[#7C3AED] rounded font-mono">
                          {p.competitiveRating}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 border border-black font-black text-[10px] uppercase ${
                          p.ratingStatus === 'ESTABLISHED' ? 'bg-[#70FFAF] text-black' : 'bg-[#FFDE59] text-black'
                        }`}>
                          {p.ratingStatus}
                        </span>
                      </td>
                      <td className="p-3 text-center font-bold text-stone-700">
                        {p.matchRecord}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {p.recentForm.map((f, i) => (
                            <span
                              key={i}
                              className={`w-4 h-4 flex items-center justify-center text-[9px] font-black border border-black ${
                                f === 'W' ? 'bg-emerald-400 text-black' : 'bg-red-400 text-white'
                              }`}
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left font-mono text-xs min-w-[620px]">
                <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
                  <tr>
                    <th className="p-3">Rank</th>
                    <th className="p-3">Team</th>
                    <th className="p-3 text-right">Rating</th>
                    <th className="p-3 text-center">Matches</th>
                    <th className="p-3 text-center">Wins</th>
                    <th className="p-3 text-center">Losses</th>
                    <th className="p-3 text-center">Tournament Wins</th>
                    <th className="p-3 text-center">Recent Form</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-stone-200">
                  {dotaTeamRankings.map((t) => (
                    <tr
                      key={t.teamId}
                      onClick={() => onNavigate('team_profile', t.teamId)}
                      className="hover:bg-stone-50 cursor-pointer"
                    >
                      <td className="p-3 font-black text-black">#{t.rank}</td>
                      <td className="p-3 font-bold">
                        <div className="flex items-center gap-2">
                          <span>{t.logo}</span>
                          <span className="font-black">{t.teamName}</span>
                          <span className="text-stone-400 text-[10px]">({t.tag})</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-black text-[#7C3AED] text-sm">{t.rating}</td>
                      <td className="p-3 text-center font-bold text-stone-700">{t.matches}</td>
                      <td className="p-3 text-center font-bold text-emerald-700">{t.wins}</td>
                      <td className="p-3 text-center font-bold text-red-600">{t.losses}</td>
                      <td className="p-3 text-center font-black text-amber-600">
                        {t.tournamentWins > 0 ? `${t.tournamentWins} 🏆` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {t.recentForm.length > 0 ? (
                            t.recentForm.map((f, i) => (
                              <span
                                key={i}
                                className={`w-4 h-4 flex items-center justify-center text-[9px] font-black border border-black ${
                                  f === 'W' ? 'bg-emerald-400 text-black' : 'bg-red-400 text-white'
                                }`}
                              >
                                {f}
                              </span>
                            ))
                          ) : (
                            <span className="text-stone-400 text-[10px]">Pending</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
