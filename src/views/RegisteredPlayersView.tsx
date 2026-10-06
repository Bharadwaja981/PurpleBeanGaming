import { useState, useMemo, useEffect } from 'react';
import { Users, Filter, CheckCircle, Clock, AlertTriangle, ArrowLeft, MapPin, Trophy, Shield, Crown } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { dotaPlayerRegistry, DotaTournamentRegistration } from '../domain/dotaPlayerEngine';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { ViewType, Player, Tournament } from '../types/tournament';
import { SelectDropdown } from '../components/ui/Dropdown';

interface RegisteredPlayersViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  tournamentId?: string;
}

export function RegisteredPlayersView({ onNavigate, tournamentId }: RegisteredPlayersViewProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>(() => tournamentService.getTournaments());
  const [selectedTourneyId, setSelectedTourneyId] = useState<string>(() => tournamentId || 'ALL');
  const [statusFilter, setStatusFilter] = useState<'All Active' | 'All' | 'VERIFIED' | 'REGISTERED' | 'UNDER_REVIEW' | 'EVIDENCE_REQUESTED' | 'WITHDRAWN' | 'REJECTED'>('All Active');
  const [roleFilter, setRoleFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Real registrations & platform players
  const [registrations, setRegistrations] = useState<DotaTournamentRegistration[]>(() => 
    dotaPlayerRegistry.getAllRegistrations()
  );
  const [platformPlayers, setPlatformPlayers] = useState<Player[]>(() => tournamentService.getPlayers());

  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer' || currentUser.isAdmin;

  useEffect(() => {
    if (tournamentId) {
      setSelectedTourneyId(tournamentId);
    }
  }, [tournamentId]);

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setTournaments(tournamentService.getTournaments());
      setRegistrations(dotaPlayerRegistry.getAllRegistrations());
      setPlatformPlayers(tournamentService.getPlayers());
    });
    return unsub;
  }, []);

  // Filter registrations based on selected tournament
  const effectiveRegistrations = useMemo(() => {
    if (selectedTourneyId === 'ALL') {
      return registrations;
    }
    return registrations.filter(r => r.tournamentId === selectedTourneyId);
  }, [registrations, selectedTourneyId]);

  const filteredRegistrations = useMemo(() => {
    return effectiveRegistrations.filter((r) => {
      const matchesStatus = 
        (statusFilter === 'All Active' && r.status !== 'WITHDRAWN' && r.status !== 'REJECTED' && (r.status as string) !== 'CANCELLED') ||
        statusFilter === 'All' || 
        (statusFilter === 'VERIFIED' && r.status === 'VERIFIED') ||
        (statusFilter === 'REGISTERED' && (r.status === 'REGISTERED' || (r.status as string) === 'Pending Review')) ||
        (statusFilter === 'UNDER_REVIEW' && r.status === 'UNDER_REVIEW') ||
        (statusFilter === 'EVIDENCE_REQUESTED' && r.status === 'EVIDENCE_REQUESTED') ||
        (statusFilter === 'WITHDRAWN' && r.status === 'WITHDRAWN') ||
        (statusFilter === 'REJECTED' && r.status === 'REJECTED');

      const matchesRole = roleFilter === 'All' || r.primaryRole.toLowerCase().includes(roleFilter.toLowerCase());

      const pbgAcc = pbgAccountRegistry.getAccountByUid(r.userId) || 
                     pbgAccountRegistry.getAccountByPbgId(r.userId) ||
                     (r.userEmail ? pbgAccountRegistry.getAccountByEmail(r.userEmail) : undefined);
      const pbgId = pbgAcc?.pbgId || (r.userId.startsWith('PBG-') ? r.userId : '');
      const realName = pbgAcc?.displayName || pbgAcc?.realName || '';

      const qRaw = searchQuery.trim().toLowerCase();
      const q = qRaw.replace(/\bpgb\b/g, 'pbg').replace(/pgb-/g, 'pbg-').replace(/pgb\s+/g, 'pbg ');
      const qNum = q.replace(/[^0-9]/g, '');

      let matchesSearch = !q;
      if (q) {
        matchesSearch = Boolean(
          String(r.ign || '').toLowerCase().includes(q) ||
          String(r.userId || '').toLowerCase().includes(q) ||
          (r.city && String(r.city).toLowerCase().includes(q)) ||
          String(realName || '').toLowerCase().includes(q) ||
          String(realName || '').toLowerCase().includes(qRaw) ||
          (pbgId ? (
            String(pbgId).toLowerCase().includes(q) ||
            (qNum && String(pbgId).replace(/[^0-9]/g, '').includes(qNum)) ||
            (qNum && parseInt(String(pbgId).replace(/[^0-9]/g, ''), 10) === parseInt(qNum, 10))
          ) : false)
        );
      }

      return matchesStatus && matchesRole && Boolean(matchesSearch);
    });
  }, [effectiveRegistrations, statusFilter, roleFilter, searchQuery]);

  const activeTourneyObj = useMemo(() => {
    if (selectedTourneyId === 'ALL') return null;
    return tournaments.find(t => t.id === selectedTourneyId) || null;
  }, [tournaments, selectedTourneyId]);

  const handleVerifyPlayer = async (reg: DotaTournamentRegistration) => {
    const targetMmr = reg.tournamentMmr || reg.declaredMmr || 5000;
    const res = await tournamentService.verifyRegistration(reg.tournamentId, reg.userId, targetMmr);
    if (res.success) {
      setRegistrations(dotaPlayerRegistry.getAllRegistrations());
    }
  };

  return (
    <div className="space-y-8 pb-16 font-mono">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => onNavigate('organiser_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organiser Dashboard</span>
        </button>

        {selectedTourneyId !== 'ALL' && (
          <button
            onClick={() => onNavigate('tournament_detail', selectedTourneyId)}
            className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-black bg-[#FFE600] hover:bg-yellow-400 px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>View Tournament Details →</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 text-stone-600 text-xs uppercase font-black">
          <Users className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · REGISTRATION &amp; CONTENDER ROSTER AUDIT</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans leading-none">
              REGISTERED PLAYERS DIRECTORY
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mt-2 leading-relaxed">
              Official player registration pool per tournament. Every contender is strictly bound to a single active tournament under anti-tamper and MMR validation rules.
            </p>
          </div>
          <div className="bg-[#FFF9E6] border-2 border-black p-3 text-xs space-y-1 shrink-0">
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Active Scope:</span>
              <span className="font-black text-black">{activeTourneyObj ? activeTourneyObj.name : 'All Tournaments'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Contenders in Scope:</span>
              <span className="font-black text-[#7C3AED]">{effectiveRegistrations.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Verified Ready:</span>
              <span className="font-black text-emerald-700">
                {effectiveRegistrations.filter(r => r.status === 'VERIFIED').length}
              </span>
            </div>
          </div>
        </div>

        {/* Tournament Scope Selector Bar */}
        <div className="pt-3 border-t-2 border-dashed border-stone-300 flex flex-wrap items-center gap-3">
          <span className="text-xs font-black uppercase text-stone-700 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span>Filter by Tournament:</span>
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedTourneyId('ALL')}
              className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                selectedTourneyId === 'ALL'
                  ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                  : 'bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              All Tournaments ({registrations.length})
            </button>
            {tournaments.map(t => {
              const count = registrations.filter(r => r.tournamentId === t.id).length;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTourneyId(t.id)}
                  className={`px-2.5 py-1 text-xs font-black uppercase border-2 border-black cursor-pointer transition-all ${
                    selectedTourneyId === t.id
                      ? 'bg-[#7C3AED] text-white shadow-[2px_2px_0px_0px_#000]'
                      : 'bg-white text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {t.name} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {(['All Active', 'All', 'VERIFIED', 'REGISTERED', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED', 'WITHDRAWN', 'REJECTED'] as const).map((s) => {
            const count = 
              s === 'All Active' 
                ? effectiveRegistrations.filter(r => r.status !== 'WITHDRAWN' && r.status !== 'REJECTED' && (r.status as string) !== 'CANCELLED').length
                : s === 'All'
                ? effectiveRegistrations.length
                : effectiveRegistrations.filter(r => r.status === s || (s === 'REGISTERED' && (r.status as string) === 'Pending Review')).length;

            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 font-black uppercase border-2 border-black transition-all cursor-pointer ${
                  statusFilter === s
                    ? 'bg-[#FFE600] text-black shadow-[3px_3px_0px_0px_#000] -translate-x-0.5 -translate-y-0.5'
                    : s === 'WITHDRAWN'
                    ? 'bg-stone-200 text-stone-700 hover:bg-stone-300 shadow-[1px_1px_0px_0px_#000]'
                    : 'bg-white text-stone-700 hover:bg-stone-50 shadow-[1px_1px_0px_0px_#000]'
                }`}
              >
                {s === 'All Active' ? 'Active Contenders' : s === 'All' ? 'All (inc. Inactive)' : s} ({count})
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by PBG ID, IGN, name, or city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 bg-white border-2 border-black font-mono text-xs text-black placeholder:text-stone-400 outline-none w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table of Contenders */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="overflow-x-auto table-scroll-container">
          <table className="w-full text-left font-mono text-xs min-w-[700px]">
            <thead className="bg-[#E2E8F0] border-b-2 border-black uppercase text-[10px] font-black text-black">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">Player / IGN</th>
                {selectedTourneyId === 'ALL' && <th className="p-3.5">Tournament</th>}
                <th className="p-3.5">Primary Role</th>
                <th className="p-3.5 text-right">MMR</th>
                <th className="p-3.5 text-center">Captaincy</th>
                <th className="p-3.5 text-center">Status</th>
                {isOrganiser && <th className="p-3.5 text-right">Admin Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y border-stone-200">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={isOrganiser ? 8 : 7} className="p-12 text-center text-stone-500 font-mono text-xs">
                    <div className="space-y-3 max-w-sm mx-auto">
                      <Users className="w-8 h-8 mx-auto text-stone-400" />
                      <h4 className="font-sans font-black text-sm uppercase text-black">
                        No Contenders Found
                      </h4>
                      <p className="text-stone-600">
                        {selectedTourneyId === 'ALL'
                          ? 'No players are currently registered in any active tournament.'
                          : `No registered contenders match the selected filters for ${activeTourneyObj?.name || 'this tournament'}.`}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg, idx) => {
                  const tourneyObj = tournaments.find(t => t.id === reg.tournamentId);
                  const isVerified = reg.status === 'VERIFIED';
                  const effectiveMmr = reg.tournamentMmr || reg.declaredMmr || 5000;
                  const pbgAcc = pbgAccountRegistry.getAccountByUid(reg.userId) || 
                                 pbgAccountRegistry.getAccountByPbgId(reg.userId) ||
                                 (reg.userEmail ? pbgAccountRegistry.getAccountByEmail(reg.userEmail) : undefined);
                  const pbgId = pbgAcc?.pbgId || (reg.userId.startsWith('PBG-') ? reg.userId : undefined);
                  const displayName = pbgAcc?.displayName || reg.ign;

                  return (
                    <tr
                      key={reg.id || `${reg.tournamentId}-${reg.userId}`}
                      className="hover:bg-[#FFFDE8] transition-colors"
                    >
                      <td className="p-3.5 font-black text-stone-500">{idx + 1}</td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-stone-100 border border-black flex items-center justify-center font-bold text-sm shrink-0">
                            🎮
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span 
                                onClick={() => onNavigate('player_profile', pbgId || reg.userId)}
                                className="font-black text-black text-sm hover:underline cursor-pointer"
                              >
                                {displayName}
                              </span>
                              {pbgId && (
                                <span className="bg-[#5CE1E6] border border-black px-1.5 py-0.2 text-[9px] font-mono font-black text-black shadow-[1px_1px_0px_0px_#000]">
                                  {pbgId}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-500 block">
                              {reg.ign !== displayName ? `${reg.ign} · ` : ''}{reg.city || 'India'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {selectedTourneyId === 'ALL' && (
                        <td className="p-3.5">
                          <span className="bg-stone-100 border border-black px-2 py-0.5 text-[10px] font-black uppercase text-black block truncate max-w-[160px]">
                            {tourneyObj ? tourneyObj.name : reg.tournamentId}
                          </span>
                        </td>
                      )}

                      <td className="p-3.5 font-bold text-stone-800">
                        <span>{reg.primaryRole}</span>
                        {reg.secondaryRole && (
                          <span className="text-[10px] text-stone-500 block">
                            Alt: {reg.secondaryRole}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-black text-black">
                        <span className="bg-[#FFE600] px-2 py-0.5 border border-black inline-block">
                          {effectiveMmr.toLocaleString()}
                        </span>
                        {reg.isMmrLocked && (
                          <span className="text-[9px] text-[#7C3AED] block font-black">
                            LOCKED
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {reg.interestedInCaptaincy || reg.applyingAsCaptain ? (
                          <span className="bg-purple-100 text-[#7C3AED] border border-black px-2 py-0.5 text-[10px] font-black uppercase inline-flex items-center gap-1">
                            <Crown className="w-3 h-3 text-[#FFE600]" />
                            <span>Captain Candidate</span>
                          </span>
                        ) : (
                          <span className="text-stone-400 text-[10px] font-bold">Player Pool</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-black border border-black uppercase ${
                          isVerified ? 'bg-[#70FFAF] text-black' :
                          reg.status === 'WITHDRAWN' ? 'bg-stone-200 text-stone-600 line-through border-stone-400' :
                          reg.status === 'UNDER_REVIEW' ? 'bg-[#FFDE59] text-black' :
                          reg.status === 'EVIDENCE_REQUESTED' ? 'bg-amber-400 text-black' :
                          reg.status === 'REJECTED' ? 'bg-[#FF5757] text-white' :
                          'bg-[#FFE600] text-black'
                        }`}>
                          {reg.status}
                        </span>
                      </td>

                      {isOrganiser && (
                        <td className="p-3.5 text-right">
                          {reg.status === 'WITHDRAWN' ? (
                            <span className="text-[10px] text-stone-500 font-bold italic">Withdrawn</span>
                          ) : reg.status === 'REJECTED' ? (
                            <span className="text-[10px] text-red-600 font-bold italic">Rejected</span>
                          ) : !isVerified ? (
                            <button
                              type="button"
                              onClick={() => handleVerifyPlayer(reg)}
                              className="px-2 py-1 bg-[#70FFAF] hover:bg-emerald-400 text-black border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                            >
                              ✓ Verify
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-black">✓ Approved</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
