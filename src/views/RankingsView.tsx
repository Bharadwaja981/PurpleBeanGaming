import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Award, 
  Users, 
  User, 
  Shield, 
  Flame, 
  TrendingUp, 
  ChevronRight, 
  Star,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { ViewType, Player, Team } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';

interface RankingsViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function RankingsView({ onNavigate }: RankingsViewProps) {
  const [tab, setTab] = useState<'PLAYERS' | 'TEAMS'>('PLAYERS');
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setPlayers(tournamentService.getPlayers());
    setTeams(tournamentService.getTeams());

    const unsub = tournamentService.subscribe(() => {
      setPlayers(tournamentService.getPlayers());
      setTeams(tournamentService.getTeams());
    });
    return unsub;
  }, []);

  // Sorted players by MMR desc
  const sortedPlayers = [...players].sort((a, b) => {
    const mmrA = a.tournamentMmr || a.mmr || 0;
    const mmrB = b.tournamentMmr || b.mmr || 0;
    return mmrB - mmrA;
  }).filter(p => !searchTerm || p.username.toLowerCase().includes(searchTerm.toLowerCase()));

  // Sorted teams by Rating / Wins desc
  const sortedTeams = [...teams].sort((a, b) => {
    const winsA = (a as any).wins ?? (a as any).record?.wins ?? 0;
    const winsB = (b as any).wins ?? (b as any).record?.wins ?? 0;
    return winsB - winsA;
  }).filter(t => !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.tag.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#FFE600] border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] space-y-3">
        <span className="font-mono text-xs font-black uppercase bg-black text-[#FFE600] px-2.5 py-1 border border-black inline-block">
          Official Leaderboard Matrix
        </span>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans tracking-tight">
          Pan-India Rankings
        </h1>
        <p className="font-mono text-xs text-stone-800 max-w-2xl leading-relaxed">
          National competitive ladder tracking individual Tournament MMR, franchise win rates, and championship points across India’s premier esports circuit.
        </p>
      </div>

      {/* Tabs and Search Bar */}
      <div className="bg-white border-[3.5px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('PLAYERS')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000] ${
              tab === 'PLAYERS' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
            }`}
          >
            Player Leaderboard ({sortedPlayers.length})
          </button>
          <button
            onClick={() => setTab('TEAMS')}
            className={`px-4 py-2 font-mono text-xs font-black uppercase border-2 border-black cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000] ${
              tab === 'TEAMS' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
            }`}
          >
            Franchise Standings ({sortedTeams.length})
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, tag, or IGN..."
            className="w-full bg-stone-50 border-2 border-black px-3 py-1.5 font-mono text-xs font-bold text-black focus:outline-hidden"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-x-auto">
        {tab === 'PLAYERS' ? (
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-black text-white border-b-2 border-black uppercase text-[11px] font-black">
                <th className="p-3.5 w-16 text-center">Rank</th>
                <th className="p-3.5">Contender</th>
                <th className="p-3.5">Primary Role</th>
                <th className="p-3.5">Tournament MMR</th>
                <th className="p-3.5">Rating</th>
                <th className="p-3.5">Win Rate</th>
                <th className="p-3.5 text-right">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {sortedPlayers.map((player, idx) => (
                <tr 
                  key={player.id} 
                  onClick={() => onNavigate('player_profile', player.id)}
                  className="hover:bg-[#F3E8FF] cursor-pointer transition-colors"
                >
                  <td className="p-3.5 text-center font-black text-sm">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{player.avatar || '🎮'}</span>
                      <div>
                        <span className="font-sans font-black text-sm uppercase block text-black">
                          {player.username}
                        </span>
                        <span className="text-[10px] text-stone-500 font-bold block">
                          {player.city || 'India'} {player.flag || '🇮🇳'} {player.teamName ? `· ${player.teamName}` : ''}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-stone-700">
                    {player.primaryRole || 'Position 1 — Carry'}
                  </td>
                  <td className="p-3.5 font-black text-black text-sm">
                    {player.tournamentMmr || player.mmr || 5000}
                  </td>
                  <td className="p-3.5 font-black text-[#7C3AED]">
                    {player.platformRating || 1500}
                  </td>
                  <td className="p-3.5 font-black text-emerald-700">
                    {player.winRate ?? 65}%
                  </td>
                  <td className="p-3.5 text-right font-black text-[#7C3AED]">
                    View →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="bg-black text-white border-b-2 border-black uppercase text-[11px] font-black">
                <th className="p-3.5 w-16 text-center">Rank</th>
                <th className="p-3.5">Franchise Squad</th>
                <th className="p-3.5">Captain</th>
                <th className="p-3.5">Region</th>
                <th className="p-3.5">Record (W-L)</th>
                <th className="p-3.5 text-right">Roster</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10">
              {sortedTeams.map((team, idx) => (
                <tr 
                  key={team.id} 
                  onClick={() => onNavigate('team_profile', team.id)}
                  className="hover:bg-[#F3E8FF] cursor-pointer transition-colors"
                >
                  <td className="p-3.5 text-center font-black text-sm">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{team.logo || '🛡️'}</span>
                      <div>
                        <span className="font-sans font-black text-sm uppercase block text-black">
                          {team.name}
                        </span>
                        <span className="text-[10px] text-stone-500 font-bold block">
                          [{team.tag}]
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 font-bold text-black">
                    {team.captainName || 'Appointed Captain'}
                  </td>
                  <td className="p-3.5 font-bold text-stone-600">
                    {team.city || 'India'}
                  </td>
                  <td className="p-3.5 font-black text-emerald-700">
                    {((team as any).wins ?? (team as any).record?.wins ?? 0)}W - {((team as any).losses ?? (team as any).record?.losses ?? 0)}L
                  </td>
                  <td className="p-3.5 text-right font-black text-[#7C3AED]">
                    View →
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
