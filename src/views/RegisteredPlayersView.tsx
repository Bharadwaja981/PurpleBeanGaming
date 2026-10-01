import { useState, useMemo, useEffect } from 'react';
import { Users, Filter, CheckCircle, Clock, AlertTriangle, ArrowLeft, MapPin } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { ViewType, Player } from '../types/tournament';

interface RegisteredPlayersViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function RegisteredPlayersView({ onNavigate }: RegisteredPlayersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'All' | 'Verified' | 'Pending Review' | 'Flagged'>('All');
  const [roleFilter, setRoleFilter] = useState('All');
  const [players, setPlayers] = useState<Player[]>(() => tournamentService.getPlayers());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setPlayers(tournamentService.getPlayers());
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchesRole = roleFilter === 'All' || p.primaryRole.includes(roleFilter);
      return matchesStatus && matchesRole;
    });
  }, [players, statusFilter, roleFilter]);

  return (
    <div className="space-y-8 pb-16">
      {/* Back button */}
      <div>
        <button
          onClick={() => onNavigate('organiser_dashboard')}
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organiser Dashboard</span>
        </button>
      </div>

      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Users className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · REGISTRATION &amp; KYC AUDIT</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          REGISTERED PLAYERS DIRECTORY
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          Verified Indian tournament competitor pool under referee calibration, Aadhaar/Govt ID verification, and anti-smurf integrity review.
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex flex-wrap items-center gap-2">
          {(['All', 'Verified', 'Pending Review', 'Flagged'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                  : 'bg-white text-stone-700 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#000]'
              }`}
            >
              {s} ({s === 'All' ? players.length : players.filter(p => p.status === s).length})
            </button>
          ))}
        </div>

        <span className="font-mono text-xs font-bold text-stone-700">
          Showing {filtered.length} of {players.length} Applicants
        </span>
      </div>

      {/* Table of Players */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left font-mono text-xs min-w-[620px]">
            <thead className="bg-[#E2E8F0] border-b-2 border-black uppercase text-[10px] font-black text-black">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">Player</th>
                <th className="p-3.5">City / Origin</th>
                <th className="p-3.5 text-right">MMR</th>
                <th className="p-3.5">Primary Role</th>
                <th className="p-3.5">Franchise</th>
                <th className="p-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y border-stone-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-500 font-mono text-xs font-bold">
                    No registered applicants found in the player database.
                  </td>
                </tr>
              ) : (
                filtered.map((player, idx) => (
                <tr
                  key={player.id}
                  onClick={() => onNavigate('player_profile', player.id)}
                  className="hover:bg-[#FFFDE8] transition-colors cursor-pointer group"
                >
                  <td className="p-3.5 font-black text-stone-500">{idx + 1}</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{player.avatar}</span>
                      <div>
                        <span className="font-black text-black text-sm group-hover:underline block">
                          {player.username}
                        </span>
                        <span className="text-[10px] text-stone-500 font-normal">
                          {player.realName}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-stone-700">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#7C3AED]" />
                      <span>{player.city || 'India'}</span>
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-black text-black">
                    <span className="bg-[#FFE600] px-2 py-0.5 border border-black inline-block">
                      {(player.mmr ?? player.tournamentMmr ?? 6000).toLocaleString()}
                    </span>
                  </td>
                  <td className="p-3.5 font-bold text-stone-800">
                    {player.primaryRole}
                  </td>
                  <td className="p-3.5 font-bold text-stone-600">
                    {player.teamName || 'Free Agent'}
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
