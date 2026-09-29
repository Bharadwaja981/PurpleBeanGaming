import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trophy, 
  Users, 
  ArrowLeft, 
  Award, 
  Flame, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  Crown, 
  Coins, 
  Gavel, 
  Plus, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { 
  dotaAuctionEngine, 
  getAuctionEngine,
  DotaAuctionPlayer, 
  DotaAuctionTeam 
} from '../domain/dotaAuctionEngine';
import { dotaPlayerRegistry, DotaRolePosition } from '../domain/dotaPlayerEngine';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface CaptainSelectionViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  tournamentId?: string;
}

export function CaptainSelectionView({ 
  onNavigate, 
  tournamentId = 'auction-basic-test-1' 
}: CaptainSelectionViewProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer' || currentUser.isAdmin;
  const activeEngine = getAuctionEngine(tournamentId);
  const tournamentConfig = tournamentConfigRegistry.getConfig(tournamentId);
  const maxSlots = tournamentConfig?.teamFormation?.numberOfTeams ?? 2;

  const [teams, setTeams] = useState<DotaAuctionTeam[]>(() => activeEngine.getTeams());
  const [candidates, setCandidates] = useState<DotaAuctionPlayer[]>(() => activeEngine.getEligibleCaptainCandidates());
  const [captainApplicants, setCaptainApplicants] = useState(() => 
    tournamentService.getTournamentRegistrations(tournamentId).filter(r => Boolean(r.interestedInCaptaincy || r.applyingAsCaptain))
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  
  // Real authenticated captain assignment state
  const [appointmentMode, setAppointmentMode] = useState<'registered' | 'real_user'>('registered');
  const [realUserId, setRealUserId] = useState('');
  const [realUserEmail, setRealUserEmail] = useState('');
  const [realUserIgn, setRealUserIgn] = useState('');
  const [realUserMmr, setRealUserMmr] = useState<number>(7500);
  const [realUserRole, setRealUserRole] = useState<DotaRolePosition>('Position 1 — Carry');
  const [realUserCity, setRealUserCity] = useState('Bengaluru');

  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [teamColor, setTeamColor] = useState('#7C3AED');
  const [teamLogo, setTeamLogo] = useState('⚡');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [purseAudit, setPurseAudit] = useState(() => activeEngine.getPurseAllocationAudit());
  const [isPurseConfirmed, setIsPurseConfirmed] = useState<boolean>(() => activeEngine.isPurseConfirmed());

  useEffect(() => {
    const engine = getAuctionEngine(tournamentId);
    const syncState = () => {
      setTeams(engine.getTeams());
      setCandidates(engine.getEligibleCaptainCandidates());
      setCaptainApplicants(
        tournamentService.getTournamentRegistrations(tournamentId).filter(r => Boolean(r.interestedInCaptaincy || r.applyingAsCaptain))
      );
      setPurseAudit(engine.getPurseAllocationAudit());
      setIsPurseConfirmed(engine.isPurseConfirmed());
    };
    syncState();
    const unsubEngine = engine.subscribe(syncState);
    const unsubService = tournamentService.subscribe(syncState);
    return () => {
      unsubEngine();
      unsubService();
    };
  }, [tournamentId]);

  const handleAppointCaptain = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (teams.length >= maxSlots) {
      setErrorMsg(`All ${maxSlots} captain slots are already filled.`);
      return;
    }

    if (!teamName.trim() || !teamTag.trim()) {
      setErrorMsg('Please provide a team name and 2-4 character team tag.');
      return;
    }

    if (appointmentMode === 'real_user') {
      if (!realUserId.trim() || !realUserIgn.trim()) {
        setErrorMsg('Please provide the Firebase User ID/Email and In-Game Name (IGN) for the real captain.');
        return;
      }
      if (!realUserMmr || realUserMmr <= 0) {
        setErrorMsg('Please specify a positive locked Tournament MMR for this captain.');
        return;
      }

      const res = tournamentService.appointRealUserAsCaptain({
        tournamentId,
        userId: realUserId.trim(),
        email: realUserEmail.trim() || undefined,
        ign: realUserIgn.trim(),
        tournamentMmr: Number(realUserMmr),
        primaryRole: realUserRole,
        city: realUserCity,
        teamName: teamName.trim(),
        tag: teamTag.trim().toUpperCase(),
        color: teamColor,
        logo: teamLogo
      });

      if (res.success && res.team) {
        setSuccessMsg(`✓ Appointed ${res.team.captainIgn} as captain of ${res.team.name}! Team initialized with ${res.team.startingCredits} credits and 1/5 primary roster.`);
        setRealUserId('');
        setRealUserEmail('');
        setRealUserIgn('');
        setTeamName('');
        setTeamTag('');
      } else {
        setErrorMsg(res.error || 'Failed to appoint captain.');
      }
      return;
    }

    if (!selectedCandidateId) {
      setErrorMsg('Please select a verified contender from the candidates list.');
      return;
    }

    const res = tournamentService.appointDotaCaptain(selectedCandidateId, {
      teamName: teamName.trim(),
      tag: teamTag.trim().toUpperCase(),
      color: teamColor,
      logo: teamLogo
    }, tournamentId);

    if (res.success && res.team) {
      setSuccessMsg(`✓ Appointed ${res.team.captainIgn} as captain of ${res.team.name}! Team initialized with ${res.team.startingCredits} credits and 1/5 primary roster.`);
      setSelectedCandidateId('');
      setTeamName('');
      setTeamTag('');
    } else {
      setErrorMsg(res.error || 'Failed to appoint captain.');
    }
  };

  const handleAutoDrawCaptains = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const slotsNeeded = maxSlots - teams.length;
    if (slotsNeeded <= 0) {
      setErrorMsg(`All ${maxSlots} captain slots are already filled.`);
      return;
    }
    const eligible = candidates.filter(c => !teams.some(t => t.captainId === c.id));
    if (eligible.length < slotsNeeded) {
      setErrorMsg(`Cannot auto-draw: need ${slotsNeeded} verified candidates with locked MMR, but only ${eligible.length} available.`);
      return;
    }
    const shuffled = [...eligible].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, slotsNeeded);
    let appointedCount = 0;
    for (let i = 0; i < picked.length; i++) {
      const cand = picked[i];
      const tag = cand.username.slice(0, 3).toUpperCase();
      const res = tournamentService.appointDotaCaptain(cand.id, {
        teamName: `${cand.username}'s Squad`,
        tag,
        color: i === 0 ? '#7C3AED' : '#2563EB',
        logo: i === 0 ? '⚡' : '🛡️'
      }, tournamentId);
      if (res.success) {
        appointedCount++;
      }
    }
    setSuccessMsg(`✓ Auto-draw completed! Selected ${appointedCount} official captains. Instantly synced to Firebase across all sessions.`);
  };

  const handleConfirmPurses = () => {
    const res = tournamentService.confirmDotaAuctionPurses(tournamentId);
    if (res.success) {
      setIsPurseConfirmed(true);
      setSuccessMsg('✓ Organiser confirmed MMR-balanced starting purses! Auction lobby is now READY.');
      if (onNavigate) {
        setTimeout(() => onNavigate('auction', tournamentId), 800);
      }
    } else {
      setErrorMsg(res.error || 'Failed to confirm starting purses.');
    }
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  const candidateProfile = selectedCandidate ? dotaPlayerRegistry.getPlayer(selectedCandidate.id) : undefined;

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

        <button
          onClick={() => onNavigate('auction', tournamentId)}
          className="inline-flex items-center gap-2 text-xs font-black uppercase text-white bg-[#7C3AED] hover:bg-purple-700 px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          <Gavel className="w-4 h-4 text-[#FFE600]" />
          <span>Go to Live Player Auction</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 text-stone-600 text-xs uppercase font-black">
          <Crown className="w-4 h-4 text-[#7C3AED]" />
          <span>DOTA 2 PHASE 2 · CAPTAIN SELECTION & FRANCHISE FORMATION</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans leading-none">
              TEAM CAPTAINS PANEL
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mt-2 leading-relaxed">
              Designated franchise captains selected strictly from verified contenders. Appointing a captain creates the official tournament team with the captain placed directly into the 1/5 mandatory primary roster.
            </p>
          </div>
          <div className="bg-[#FFF9E6] border-2 border-black p-3 text-xs space-y-1 shrink-0">
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Confirmed Teams:</span>
              <span className="font-black text-black">{teams.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Verified Candidates:</span>
              <span className="font-black text-[#7C3AED]">{candidates.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Starting Purse:</span>
              <span className="font-black text-emerald-700">1,000 Credits</span>
            </div>
          </div>
        </div>
      </div>

      {/* REAL CAPTAIN SLOTS OVERVIEW */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-lg font-black uppercase text-black font-sans">
              Tournament Captain Slots ({teams.length}/{maxSlots} Confirmed)
            </h2>
          </div>
          <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
            {maxSlots} Real Captain Slots Required
          </span>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(4, maxSlots)} gap-4`}>
          {Array.from({ length: maxSlots }, (_, i) => i).map((slotIdx) => {
            const team = teams[slotIdx];
            return (
              <div 
                key={slotIdx}
                className={`border-2 border-black p-4 space-y-2 ${
                  team ? 'bg-[#F0FDF4] shadow-[3px_3px_0px_0px_#000]' : 'bg-[#FFFBEB] border-dashed text-stone-500'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black uppercase text-[10px] tracking-wider text-black">
                    Captain Slot {slotIdx + 1}
                  </span>
                  <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase border border-black ${
                    team ? 'bg-[#70FFAF] text-black' : 'bg-stone-200 text-stone-600'
                  }`}>
                    {team ? 'ASSIGNED' : 'VACANT'}
                  </span>
                </div>

                {team ? (
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{team.logo}</span>
                      <div>
                        <h4 className="font-black text-sm uppercase text-black leading-tight">{team.captainIgn}</h4>
                        <span className="text-[10px] text-stone-600">[{team.tag}] {team.name}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] pt-1 border-t border-black/10">
                      <span className="text-stone-500">Locked MMR:</span>
                      <strong className="text-[#7C3AED] font-black">{team.primaryRoster[0]?.tournamentMmr || '—'}</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-stone-500">Starting Credits:</span>
                      <strong className="text-emerald-800 font-black">{team.startingCredits} Cr</strong>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-stone-500">Roster Squad:</span>
                      <strong className="text-black font-black">{team.primaryRoster?.length || 1}/5 Roster</strong>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center space-y-1">
                    <p className="text-xs font-bold text-stone-600">Slot {slotIdx + 1} Available</p>
                    <p className="text-[10px] text-stone-500">Awaiting authenticated captain appointment through organiser desk.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ORGANISER CAPTAIN APPOINTMENT DESK */}
      {isOrganiser ? (
        <div className="bg-[#FFFBEB] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#7C3AED]" />
              <h2 className="text-xl font-black uppercase text-black font-sans">
                {teams.length < maxSlots ? 'Appoint Franchise Captain' : 'Captain Roster Complete'}
              </h2>
            </div>
            <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              Organiser Action Only
            </span>
          </div>

          {teams.length < maxSlots ? (
            <form onSubmit={handleAppointCaptain} className="space-y-6">
              {/* Appointment Mode Toggle */}
              <div className="flex flex-wrap items-center gap-2 border-b border-black pb-3">
                <span className="text-xs font-black uppercase text-stone-700 mr-2">Selection Mode:</span>
                <button
                  type="button"
                  onClick={() => setAppointmentMode('registered')}
                  className={`px-3 py-1 text-xs font-black uppercase border-2 border-black cursor-pointer ${
                    appointmentMode === 'registered' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white text-stone-600'
                  }`}
                >
                  From Verified Contenders ({candidates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAppointmentMode('real_user')}
                  className={`px-3 py-1 text-xs font-black uppercase border-2 border-black cursor-pointer ${
                    appointmentMode === 'real_user' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white text-stone-600'
                  }`}
                >
                  Assign Real Firebase Authenticated Account
                </button>
              </div>

              {/* Captain Applicants & Quick Verification Desk */}
              {captainApplicants.length > 0 && (
                <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-3 shadow-[2px_2px_0px_0px_#000]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👑</span>
                      <strong className="text-xs uppercase font-black tracking-wide text-black">
                        Contender Captain Applicants ({captainApplicants.length})
                      </strong>
                    </div>
                    <span className="text-[10px] text-stone-500 font-bold uppercase">
                      {candidates.length} Verified Ready · {captainApplicants.filter(a => a.status !== 'VERIFIED').length} Pending Verification
                    </span>
                  </div>
                  <div className="divide-y divide-black/15">
                    {captainApplicants.map(applicant => {
                      const isVerified = applicant.status === 'VERIFIED';
                      const isSelected = selectedCandidateId === applicant.userId;
                      const isAlreadyCap = teams.some(t => t.captainId === applicant.userId);

                      return (
                        <div key={applicant.userId} className="py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-black font-sans text-sm">{applicant.ign}</strong>
                              <span className={`px-1.5 py-0.5 border border-black text-[9px] font-black uppercase ${
                                isAlreadyCap ? 'bg-stone-300 text-stone-700' :
                                isVerified ? 'bg-[#70FFAF] text-black' : 'bg-[#FFDE59] text-black'
                              }`}>
                                {isAlreadyCap ? 'ASSIGNED CAPTAIN' : isVerified ? 'VERIFIED' : 'PENDING VERIFICATION'}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-600 block mt-0.5">
                              {applicant.primaryRole} · Declared MMR: <strong>{applicant.declaredMmr?.toLocaleString() || '—'}</strong>
                              {applicant.city ? ` · ${applicant.city}` : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isAlreadyCap ? (
                              <span className="text-[10px] text-stone-500 font-bold">Slot Occupied</span>
                            ) : !isVerified ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await tournamentService.verifyRegistration(tournamentId, applicant.userId, applicant.declaredMmr);
                                  if (res.success) {
                                    setSuccessMsg(`✓ Verified ${applicant.ign}! Locked Tournament MMR: ${applicant.declaredMmr?.toLocaleString()}.`);
                                    const engine = getAuctionEngine(tournamentId);
                                    setCandidates(engine.getEligibleCaptainCandidates());
                                    setSelectedCandidateId(applicant.userId);
                                    setTeamName(`${applicant.ign}'s Squad`);
                                    setTeamTag(applicant.ign.slice(0, 3).toUpperCase());
                                  } else {
                                    setErrorMsg(res.error || 'Failed to verify contender.');
                                  }
                                }}
                                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                              >
                                ✓ Verify &amp; Select as Captain
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCandidateId(applicant.userId);
                                  setTeamName(`${applicant.ign}'s Squad`);
                                  setTeamTag(applicant.ign.slice(0, 3).toUpperCase());
                                }}
                                className={`border-2 border-black px-3 py-1.5 text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                                  isSelected ? 'bg-black text-white' : 'bg-[#FFE600] text-black hover:bg-yellow-400'
                                }`}
                              >
                                {isSelected ? 'Selected ✓' : 'Select as Captain →'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mode 1: Choose from registered candidates */}
                {appointmentMode === 'registered' && (
                  <div className="space-y-4">
                    <SelectDropdown
                      label="1. Select Verified Contender"
                      value={selectedCandidateId}
                      onChange={(val) => {
                        setSelectedCandidateId(val);
                        const app = captainApplicants.find(a => a.userId === val);
                        if (app) {
                          setTeamName(`${app.ign}'s Squad`);
                          setTeamTag(app.ign.slice(0, 3).toUpperCase());
                        }
                      }}
                      options={[
                        { value: '', label: `-- Choose Contender (${candidates.length} Verified Available) --` },
                        ...candidates.map(c => ({
                          value: c.id,
                          label: `[VERIFIED] ${c.username} · MMR ${c.tournamentMmr.toLocaleString()} · ${c.primaryRole.split(' — ')[1] || c.primaryRole}`,
                          badge: `R: ${c.rating}`
                        })),
                        ...captainApplicants.filter(a => a.status !== 'VERIFIED' && !candidates.some(c => c.id === a.userId)).map(a => ({
                          value: a.userId,
                          label: `[AWAITING VERIFY] ${a.ign} · MMR ${a.declaredMmr.toLocaleString()} · ${a.primaryRole.split(' — ')[1] || a.primaryRole}`
                        }))
                      ]}
                      className="w-full"
                      placeholder="-- Choose verified contender --"
                    />

                    {selectedCandidate && (
                      <div className="bg-white border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-[#70FFAF] border-2 border-black flex items-center justify-center text-2xl">
                            {selectedCandidate.avatar}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-base uppercase text-black">{selectedCandidate.username}</h4>
                              <span className="bg-[#70FFAF] border border-black px-1 text-[9px] font-black uppercase">VERIFIED</span>
                            </div>
                            <span className="text-[10px] text-stone-500">{selectedCandidate.city || 'India'} · {selectedCandidate.primaryRole}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-black/10">
                          <div>
                            <span className="text-stone-500 block text-[9px] uppercase">Tournament MMR</span>
                            <span className="font-black text-[#7C3AED] text-sm">{selectedCandidate.tournamentMmr.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[9px] uppercase">Purple Bean Rating</span>
                            <span className="font-black text-black text-sm">{selectedCandidate.rating}</span>
                          </div>
                          <div>
                            <span className="text-stone-500 block text-[9px] uppercase">Secondary Role</span>
                            <span className="font-bold text-stone-700">{selectedCandidate.secondaryRole || 'None'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mode 2: Direct Real Authenticated User Appointment */}
                {appointmentMode === 'real_user' && (
                  <div className="space-y-3">
                    <label className="block text-xs font-black uppercase text-black">
                      1. Real Authenticated User Identity
                    </label>

                    <div className="p-3 bg-white border-2 border-black space-y-3 shadow-[2px_2px_0px_0px_#000]">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">
                          Firebase User ID (UID) or Auth Email *
                        </span>
                        <input
                          type="text"
                          required
                          placeholder="e.g. firebase-uid-xyz or captain@friend.com"
                          value={realUserId}
                          onChange={(e) => setRealUserId(e.target.value)}
                          className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-bold"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">In-Game Name (IGN) *</span>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Miracle, Topson"
                            value={realUserIgn}
                            onChange={(e) => setRealUserIgn(e.target.value)}
                            className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-black uppercase"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Locked Tournament MMR *</span>
                          <input
                            type="number"
                            min={100}
                            max={16000}
                            required
                            value={realUserMmr}
                            onChange={(e) => setRealUserMmr(Number(e.target.value))}
                            className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-black text-[#7C3AED]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Primary Role</span>
                          <select
                            value={realUserRole}
                            onChange={(e) => setRealUserRole(e.target.value as DotaRolePosition)}
                            className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-bold"
                          >
                            <option value="Position 1 — Carry">Position 1 — Carry</option>
                            <option value="Position 2 — Mid">Position 2 — Mid</option>
                            <option value="Position 3 — Offlane">Position 3 — Offlane</option>
                            <option value="Position 4 — Soft Support">Position 4 — Soft Support</option>
                            <option value="Position 5 — Hard Support">Position 5 — Hard Support</option>
                          </select>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">City</span>
                          <input
                            type="text"
                            value={realUserCity}
                            onChange={(e) => setRealUserCity(e.target.value)}
                            className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Franchise Team Metadata */}
                <div className="space-y-4">
                  <label className="block text-xs font-black uppercase text-black">
                    2. Configure Franchise Team
                  </label>

                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Team Name *</span>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai Mavericks, Bengaluru Blaze"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="w-full bg-white border-2 border-black p-2 text-xs font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Tag (2-4 chars) *</span>
                        <input
                          type="text"
                          maxLength={4}
                          required
                          placeholder="MM"
                          value={teamTag}
                          onChange={(e) => setTeamTag(e.target.value.toUpperCase())}
                          className="w-full bg-white border-2 border-black p-2 text-xs font-black uppercase"
                        />
                      </div>
                      <div>
                        <SelectDropdown
                          label="Badge Emoji"
                          value={teamLogo}
                          onChange={(val) => setTeamLogo(val)}
                          options={[
                            { value: '⚡', label: '⚡ Lightning' },
                            { value: '🔥', label: '🔥 Fire' },
                            { value: '🛡️', label: '🛡️ Shield' },
                            { value: '👑', label: '👑 Crown' },
                            { value: '🐯', label: '🐯 Tiger' },
                            { value: '🦅', label: '🦅 Eagle' },
                            { value: '⚔️', label: '⚔️ Swords' }
                          ]}
                          className="w-full"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Color</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={teamColor}
                            onChange={(e) => setTeamColor(e.target.value)}
                            className="w-8 h-8 border-2 border-black cursor-pointer p-0"
                          />
                          <span className="text-[10px] font-mono">{teamColor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-white border border-black text-[11px] text-stone-600 leading-relaxed">
                      <strong>Rule:</strong> The captain occupies slot 1/5 in the mandatory primary roster. The remaining 4 mandatory contenders will be drafted during the live player auction.
                    </div>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-6 py-2.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Appoint Captain & Create Team</span>
                </button>
              </div>
            </form>
          ) : (
            /* ALL 3 SLOTS APPOINTED - ORGANISER PRE-AUCTION PURSE REVIEW */
            <div className="space-y-4">
              <div className="p-4 bg-white border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-[#FFE600]" />
                    <h3 className="font-black text-sm uppercase text-black font-sans">
                      Automatically Calculated MMR-Balanced Starting Purses
                    </h3>
                  </div>
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                    Mode: CAPTAIN_MMR_BALANCED
                  </span>
                </div>

                <div className="overflow-x-auto border-2 border-black">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-black text-white font-black uppercase text-[10px]">
                      <tr>
                        <th className="p-2 text-left">CAPTAIN</th>
                        <th className="p-2 text-center">LOCKED TOURNAMENT MMR</th>
                        <th className="p-2 text-center">DIFFERENCE FROM CAPTAIN AVERAGE</th>
                        <th className="p-2 text-right">STARTING CREDITS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black bg-white text-[11px]">
                      {(purseAudit?.entries || teams.map(t => ({
                        captainId: t.captainId,
                        captainIgn: t.captainIgn,
                        tournamentMmr: t.primaryRoster[0]?.tournamentMmr || 7500,
                        mmrDiffFromAvg: 0,
                        finalStartingCredits: t.startingCredits
                      }))).map((entry, idx) => (
                        <tr key={entry.captainId || idx} className="hover:bg-yellow-50/50">
                          <td className="p-2.5 font-black text-black">
                            {entry.captainIgn}
                          </td>
                          <td className="p-2.5 text-center font-bold text-stone-800">
                            {entry.tournamentMmr}
                          </td>
                          <td className={`p-2.5 text-center font-black ${
                            entry.mmrDiffFromAvg > 0 ? 'text-[#FF5757]' : entry.mmrDiffFromAvg < 0 ? 'text-emerald-700' : 'text-stone-600'
                          }`}>
                            {entry.mmrDiffFromAvg > 0 ? `+${entry.mmrDiffFromAvg}` : entry.mmrDiffFromAvg}
                          </td>
                          <td className="p-2.5 text-right font-black text-[#7C3AED]">
                            {entry.finalStartingCredits} Cr
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-stone-100 font-bold border-t-2 border-black text-[11px]">
                      <tr>
                        <td className="p-2.5 uppercase text-stone-600">Total / Average</td>
                        <td className="p-2.5 text-center text-stone-800">
                          Avg: {purseAudit?.averageCaptainMmr || '—'}
                        </td>
                        <td className="p-2.5 text-center text-stone-500">—</td>
                        <td className="p-2.5 text-right font-black text-black">
                          {purseAudit?.totalCredits || teams.reduce((acc, t) => acc + t.startingCredits, 0)} Cr
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="p-3 bg-[#FFFBEB] border border-amber-300 text-xs text-stone-700">
                  <strong>Organiser Confirmation Required:</strong> Review the starting credit allocations above. Once you confirm, the auction lobby transitions to <strong>READY</strong>.
                </div>

                {errorMsg && (
                  <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-xs font-bold text-stone-500">
                    Status: {isPurseConfirmed ? '✓ CONFIRMED (READY)' : 'AWAITING ORGANISER CONFIRMATION'}
                  </span>
                  <button
                    onClick={handleConfirmPurses}
                    className="bg-[#70FFAF] hover:bg-emerald-400 text-black border-2 border-black px-6 py-2.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm Starting Purses & Open Auction Lobby →</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-white border-2 border-black text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-600">
            <Shield className="w-4 h-4 text-[#7C3AED]" />
            <span>Viewing in Contender / Spectator Mode. Captain appointment is restricted to tournament directors.</span>
          </div>
        </div>
      )}

      {/* APPOINTED TEAMS & CAPTAINS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="text-xl font-black uppercase text-black font-sans">
              Confirmed Franchise Teams ({teams.length})
            </h2>
          </div>
          <span className="text-xs text-stone-500 font-bold">
            Mandatory Primary Roster: 5/5 (Captain + 4 Drafted)
          </span>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white border-[3px] border-black p-8 text-center text-stone-500 text-xs">
            No captains appointed yet. Organisers must select at least 2 captains to initiate the auction.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{team.logo}</span>
                      <h3 className="font-black text-lg text-black uppercase font-sans">
                        {team.name}
                      </h3>
                    </div>
                    <span 
                      className="px-2 py-0.5 border border-black text-[10px] font-black uppercase"
                      style={{ backgroundColor: team.color || '#FFE600' }}
                    >
                      [{team.tag}]
                    </span>
                  </div>

                  {/* Captain Info */}
                  <div className="bg-stone-50 border-2 border-black p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Team Captain</span>
                      </span>
                      <span className="bg-[#70FFAF] border border-black px-1.5 py-0.2 text-[9px] font-black uppercase">
                        1/5 Primary
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-black text-sm">{team.captainIgn}</span>
                      <span className="text-xs font-mono font-bold text-[#7C3AED]">
                        MMR: {team.primaryRoster[0]?.tournamentMmr?.toLocaleString() || '7,400'}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-600">
                      Role: <strong className="text-purple-700">{team.primaryRoster[0]?.primaryRole?.split(' — ')[1] || team.primaryRoster[0]?.primaryRole}</strong>
                    </div>
                  </div>

                  {/* Purse & Roster Tracker */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-[#FFF9E6] border border-black">
                      <span className="text-stone-500 block text-[9px] uppercase font-bold">Purse Remaining</span>
                      <span className="font-black text-emerald-800 text-sm">{team.remainingCredits.toLocaleString()} Cr</span>
                    </div>
                    <div className="p-2.5 bg-[#F3E8FF] border border-black">
                      <span className="text-stone-500 block text-[9px] uppercase font-bold">Roster Filled</span>
                      <span className="font-black text-[#7C3AED] text-sm">{team.primaryRoster.length}/5 Primary</span>
                    </div>
                  </div>

                  {/* Roster list */}
                  <div className="border border-black p-2.5 bg-stone-50 space-y-1.5 text-[11px]">
                    <span className="text-[9px] font-black uppercase text-stone-500 block">Roster Breakdown</span>
                    {team.primaryRoster.map((player, idx) => (
                      <div key={player.id} className="flex justify-between items-center text-xs">
                        <span className="truncate">
                          {idx === 0 ? '👑 ' : `${idx + 1}. `}<strong>{player.username}</strong>
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">
                          {player.tournamentMmr.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - team.primaryRoster.length) }).map((_, i) => (
                      <div key={i} className="text-stone-400 italic text-[10px]">
                        Slot {team.primaryRoster.length + i + 1}: Unfilled (Live Draft)
                      </div>
                    ))}
                    {team.standIns.length > 0 && (
                      <div className="pt-1 border-t border-black/10 text-stone-600 text-[10px]">
                        Stand-in: <strong>{team.standIns[0].username}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-black/10 flex justify-between items-center text-[10px]">
                  <span className="text-stone-500 font-bold">Starting Purse: {team.startingCredits}</span>
                  <span className="text-emerald-700 font-black">Auction Ready</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
