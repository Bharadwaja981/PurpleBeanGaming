import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Shield, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  RefreshCw, 
  FileText, 
  Send, 
  Crown, 
  Trophy, 
  Sparkles, 
  Info, 
  Check, 
  X, 
  ArrowRight,
  UserCheck,
  AlertTriangle
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';
import { 
  dotaPremadeTeamEngine, 
  PremadeTeamRegistration, 
  PremadeRosterSlot, 
  HistoricalRosterSnapshot 
} from '../domain/dotaPremadeTeamEngine';
import { dotaPlayerRegistry, DotaRolePosition } from '../domain/dotaPlayerEngine';

interface PremadeTeamManagementProps {
  tournamentId?: string;
  onNavigateTeamProfile?: (teamId: string) => void;
}

export function PremadeTeamManagement({ 
  tournamentId = 'india-dota-open-2026',
  onNavigateTeamProfile
}: PremadeTeamManagementProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer';
  const isCaptain = currentUser.role === 'captain';

  const config = dotaPremadeTeamEngine.getTournamentConfig(tournamentId);

  // Synchronized state
  const [teams, setTeams] = useState<PremadeTeamRegistration[]>(() => 
    dotaPremadeTeamEngine.getTournamentTeams(tournamentId)
  );

  // Active view tab: 'squads' | 'register' | 'review' | 'snapshots'
  const [activeTab, setActiveTab] = useState<'squads' | 'register' | 'review' | 'snapshots'>('squads');

  // Form state for creating a new premade team
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamTag, setNewTeamTag] = useState('');
  const [newTeamLogo, setNewTeamLogo] = useState('🛡️');
  const [newTeamColor, setNewTeamColor] = useState('#7C3AED');
  const [selectedCaptainId, setSelectedCaptainId] = useState('');

  // Selected team for management / detail drawer
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');

  // Add player to roster state
  const [addCandidateId, setAddCandidateId] = useState('');
  const [addIsStandIn, setAddIsStandIn] = useState(false);
  const [addRole, setAddRole] = useState<DotaRolePosition>('Position 1 — Carry');

  // Review modal state (Organiser)
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REQUEST_CHANGES' | 'REJECT' | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [reviewTargetTeamId, setReviewTargetTeamId] = useState('');

  // Emergency replacement modal state
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [emergencyTeamId, setEmergencyTeamId] = useState('');
  const [emergencyOutgoingId, setEmergencyOutgoingId] = useState('');
  const [emergencyIncomingId, setEmergencyIncomingId] = useState('');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyRole, setEmergencyRole] = useState<DotaRolePosition>('Position 1 — Carry');

  // Notifications
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

  // Subscribe to engine
  useEffect(() => {
    const handleSync = () => {
      setTeams(dotaPremadeTeamEngine.getTournamentTeams(tournamentId));
    };
    handleSync();
    return dotaPremadeTeamEngine.subscribe(handleSync);
  }, [tournamentId]);

  // Set initial selected team if empty
  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].teamId);
    }
  }, [teams, selectedTeamId]);

  const activeTeam = teams.find(t => t.teamId === selectedTeamId) || teams[0];

  // Candidates who are VERIFIED for this tournament
  const verifiedRegistrations = dotaPlayerRegistry.getTournamentRegistrations(tournamentId)
    .filter(r => r.status === 'VERIFIED');

  // Filter candidates not already in an active team
  const availableCandidates = verifiedRegistrations.filter(r => {
    const team = dotaPremadeTeamEngine.getPlayerTeam(tournamentId, r.userId);
    return !team || (activeTeam && team.teamId === activeTeam.teamId);
  });

  const clearFeedback = () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
  };

  // ---------------------------------------------------------------------------
  // Action Handlers
  // ---------------------------------------------------------------------------

  const handleRegisterTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!newTeamName.trim() || !newTeamTag.trim()) {
      setFeedbackError('Team Name and Tag (2-4 chars) are required.');
      return;
    }

    const captainId = selectedCaptainId || currentUser.id;
    const res = tournamentService.registerPremadeTeam({
      tournamentId,
      teamName: newTeamName.trim(),
      tag: newTeamTag.trim().toUpperCase(),
      logo: newTeamLogo,
      color: newTeamColor,
      captainUserId: captainId
    });

    if (res.success && res.team) {
      setFeedbackSuccess(`✓ Premade team '${res.team.teamName}' registered in DRAFT state! You can now invite roster contenders.`);
      setSelectedTeamId(res.team.teamId);
      setActiveTab('squads');
      setNewTeamName('');
      setNewTeamTag('');
      setSelectedCaptainId('');
    } else {
      setFeedbackError(res.error || 'Failed to register team.');
    }
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!activeTeam || !addCandidateId) {
      setFeedbackError('Please select a contender to add.');
      return;
    }

    const res = tournamentService.addPlayerToPremadeRoster({
      tournamentId,
      teamId: activeTeam.teamId,
      candidateUserId: addCandidateId,
      isStandIn: addIsStandIn,
      assignedRole: addRole
    });

    if (res.success) {
      setFeedbackSuccess('✓ Player invited to squad roster!');
      setAddCandidateId('');
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } else {
      setFeedbackError(res.error || 'Failed to add player.');
    }
  };

  const handleAcceptInvite = (playerId: string) => {
    clearFeedback();
    if (!activeTeam) return;
    const res = dotaPremadeTeamEngine.respondToRosterInvitation({
      tournamentId,
      teamId: activeTeam.teamId,
      playerId,
      accept: true
    });
    if (res.success) {
      setFeedbackSuccess('✓ Roster invitation confirmed!');
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } else {
      setFeedbackError(res.error || 'Failed to accept invitation.');
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    clearFeedback();
    if (!activeTeam) return;
    const res = dotaPremadeTeamEngine.removePlayerFromRoster({
      tournamentId,
      teamId: activeTeam.teamId,
      playerId,
      actorUserId: currentUser.id
    });
    if (res.success) {
      setFeedbackSuccess('✓ Player removed from roster.');
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } else {
      setFeedbackError(res.error || 'Failed to remove player.');
    }
  };

  const handleSubmitRoster = () => {
    clearFeedback();
    if (!activeTeam) return;

    const res = tournamentService.submitPremadeRoster(tournamentId, activeTeam.teamId);
    if (res.success) {
      setFeedbackSuccess(`✓ Roster for '${activeTeam.teamName}' submitted for organiser verification!`);
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } else {
      setFeedbackError(res.error || 'Roster submission failed.');
    }
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!reviewAction || !reviewTargetTeamId) return;

    if ((reviewAction === 'REQUEST_CHANGES' || reviewAction === 'REJECT') && !reviewReason.trim()) {
      setFeedbackError('A justification reason is required when rejecting or requesting changes.');
      return;
    }

    const res = tournamentService.reviewPremadeTeam({
      tournamentId,
      teamId: reviewTargetTeamId,
      action: reviewAction,
      reason: reviewReason.trim()
    });

    if (res.success) {
      setFeedbackSuccess(`✓ Team review recorded: ${reviewAction}!`);
      setReviewAction(null);
      setReviewReason('');
      setReviewTargetTeamId('');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } else {
      setFeedbackError(res.error || 'Review submission failed.');
    }
  };

  const handleLockRoster = (teamId: string) => {
    clearFeedback();
    const res = tournamentService.lockPremadeRoster(tournamentId, teamId);
    if (res.success) {
      setFeedbackSuccess('✓ Team roster officially locked! Captain edits disabled.');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } else {
      setFeedbackError(res.error || 'Failed to lock roster.');
    }
  };

  const handleEmergencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!emergencyTeamId || !emergencyOutgoingId || !emergencyIncomingId || !emergencyReason.trim()) {
      setFeedbackError('All fields including incoming player and reason are required.');
      return;
    }

    const res = tournamentService.executeEmergencyPremadeRosterChange({
      tournamentId,
      teamId: emergencyTeamId,
      outgoingPlayerId: emergencyOutgoingId,
      incomingPlayerId: emergencyIncomingId,
      role: emergencyRole,
      reason: emergencyReason.trim()
    });

    if (res.success) {
      setFeedbackSuccess('✓ Emergency roster replacement executed and historical snapshot updated!');
      setEmergencyModalOpen(false);
      setEmergencyReason('');
      setEmergencyOutgoingId('');
      setEmergencyIncomingId('');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } else {
      setFeedbackError(res.error || 'Emergency replacement failed.');
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="bg-white border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFE600] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Users className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-[#70FFAF] px-1.5 py-0.5 border border-black">
                DOTA 2 PHASE 3 · PREMADE TEAMS
              </span>
              <span className="text-[10px] font-black uppercase text-stone-500">
                {config.tournamentName}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-tight">
              SQUAD REGISTRATION &amp; ROSTER MANAGEMENT
            </h2>
            <p className="text-xs text-stone-600">
              Capacity: {teams.length}/{config.maxTeams} Teams • Primary Roster: {config.primaryRosterSize}/5 • Stand-ins: 0–{config.standInLimit}
            </p>
          </div>
        </div>

        {/* Action Tabs */}
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
          <button
            onClick={() => setActiveTab('squads')}
            className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
              activeTab === 'squads' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
            }`}
          >
            Registered Squads ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
              activeTab === 'register' ? 'bg-[#7C3AED] text-white shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
            }`}
          >
            + Register Team
          </button>
          {isOrganiser && (
            <button
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
                activeTab === 'review' ? 'bg-[#FFDE59] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
              }`}
            >
              Organiser Review Desk
            </button>
          )}
          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
              activeTab === 'snapshots' ? 'bg-stone-200 text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
            }`}
          >
            Historical Snapshots
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {feedbackError && (
        <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackError}</span>
        </div>
      )}
      {feedbackSuccess && (
        <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: SQUADS & ACTIVE ROSTER MANAGEMENT */}
      {/* =================================================================== */}
      {activeTab === 'squads' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Team selector list (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <span className="text-xs font-black uppercase text-black">Tournament Squads</span>
              <span className="text-[10px] text-stone-500 font-bold">{teams.length} Registered</span>
            </div>

            {teams.length === 0 ? (
              <div className="p-6 bg-white border-2 border-black text-center text-stone-400 text-xs">
                No premade teams registered yet. Click &ldquo;+ Register Team&rdquo; to create a squad.
              </div>
            ) : (
              <div className="space-y-2">
                {teams.map(t => {
                  const isSelected = activeTeam?.teamId === t.teamId;
                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-stone-200 text-stone-800',
                    SUBMITTED: 'bg-[#FFDE59] text-black',
                    UNDER_REVIEW: 'bg-blue-100 text-blue-900',
                    CHANGES_REQUESTED: 'bg-amber-200 text-amber-900',
                    APPROVED: 'bg-[#70FFAF] text-black',
                    REJECTED: 'bg-[#FF5757] text-white',
                    LOCKED: 'bg-[#7C3AED] text-white'
                  };

                  return (
                    <div
                      key={t.teamId}
                      onClick={() => setSelectedTeamId(t.teamId)}
                      className={`p-3 border-2 border-black cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-[#FFFBEB] shadow-[4px_4px_0px_0px_#000] -translate-x-0.5' 
                          : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{t.logo}</span>
                          <div>
                            <strong className="text-black text-xs block">{t.teamName}</strong>
                            <span className="text-[10px] text-stone-500">Cap: {t.captainIgn}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 border border-black text-[9px] font-black uppercase ${statusColors[t.status] || 'bg-stone-100'}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-stone-600 mt-2 pt-2 border-t border-black/10">
                        <span>Primary: <strong>{t.primaryRoster.length}/5</strong></span>
                        <span>Stand-ins: <strong>{t.standIns.length}/1</strong></span>
                        <span className="font-bold text-[#7C3AED]">[{t.tag}]</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Detailed Active Team Roster Desk (8 cols) */}
          <div className="lg:col-span-8">
            {activeTeam ? (
              <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
                {/* Team Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-[#FFF9E6] border-2 border-black flex items-center justify-center text-3xl shadow-[2px_2px_0px_0px_#000]">
                      {activeTeam.logo}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl font-black uppercase text-black font-sans">{activeTeam.teamName}</h3>
                        <span className="px-2 py-0.5 bg-[#FFE600] border border-black text-[10px] font-black">[{activeTeam.tag}]</span>
                      </div>
                      <span className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                        <Crown className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Captain: <strong>{activeTeam.captainIgn}</strong></span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-stone-100 border-2 border-black text-xs font-black uppercase">
                      Status: {activeTeam.status}
                    </span>
                    {isOrganiser && activeTeam.status === 'APPROVED' && (
                      <button
                        onClick={() => handleLockRoster(activeTeam.teamId)}
                        className="px-3 py-1 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Lock Roster</span>
                      </button>
                    )}
                    {isOrganiser && (activeTeam.status === 'LOCKED' || activeTeam.status === 'APPROVED') && (
                      <button
                        onClick={() => {
                          setEmergencyTeamId(activeTeam.teamId);
                          setEmergencyModalOpen(true);
                        }}
                        className="px-3 py-1 bg-[#FFDE59] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-800" />
                        <span>Emergency Replacement</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Notice if Changes Requested */}
                {activeTeam.status === 'CHANGES_REQUESTED' && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-500 text-amber-900 text-xs space-y-1">
                    <strong className="block font-black uppercase flex items-center gap-1">
                      <AlertCircle className="w-4 h-4 text-amber-700" />
                      Changes Requested by Organiser:
                    </strong>
                    <p className="text-[11px] leading-relaxed">{activeTeam.changesRequestedReason}</p>
                  </div>
                )}

                {/* PRIMARY ROSTER (5/5) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-black/15 pb-1">
                    <span className="text-xs font-black uppercase text-black flex items-center gap-1">
                      <Shield className="w-4 h-4 text-[#7C3AED]" />
                      <span>Primary Roster ({activeTeam.primaryRoster.length}/5 Mandatory)</span>
                    </span>
                    <span className="text-[10px] text-stone-500 font-bold">Includes Captain</span>
                  </div>

                  <div className="space-y-2">
                    {activeTeam.primaryRoster.map((slot, idx) => (
                      <div key={slot.userId} className="p-3 bg-stone-50 border-2 border-black flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{slot.avatar}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-black text-sm">{slot.ign}</strong>
                              {slot.isCaptain && (
                                <span className="bg-[#FFE600] border border-black px-1.5 py-0.2 text-[9px] font-black uppercase flex items-center gap-1">
                                  <Crown className="w-3 h-3" /> CAPTAIN
                                </span>
                              )}
                              <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase border border-black ${
                                slot.consentStatus === 'ACCEPTED' ? 'bg-[#70FFAF] text-black' :
                                slot.consentStatus === 'INVITED' ? 'bg-[#FFDE59] text-black' :
                                'bg-[#FF5757] text-white'
                              }`}>
                                {slot.consentStatus}
                              </span>
                            </div>
                            <span className="text-[10px] text-stone-500 block">
                              {slot.primaryRole} {slot.secondaryRole ? `• Sec: ${slot.secondaryRole}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="font-bold text-[#7C3AED] block">MMR: {slot.tournamentMmr.toLocaleString()}</span>
                            <span className="text-[10px] text-stone-400">Rating: {slot.pbRating}</span>
                          </div>

                          {/* Player consent action for invited user */}
                          {slot.consentStatus === 'INVITED' && (
                            <button
                              onClick={() => handleAcceptInvite(slot.userId)}
                              className="px-2 py-1 bg-[#70FFAF] hover:bg-emerald-400 border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                              title="Accept roster slot"
                            >
                              Confirm Consent
                            </button>
                          )}

                          {/* Remove button for captain / organiser during DRAFT */}
                          {(activeTeam.status === 'DRAFT' || activeTeam.status === 'CHANGES_REQUESTED') && !slot.isCaptain && (
                            <button
                              onClick={() => handleRemovePlayer(slot.userId)}
                              className="p-1 hover:bg-red-100 text-red-600 border border-red-300 cursor-pointer"
                              title="Remove player"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Unfilled slots indicator */}
                    {Array.from({ length: Math.max(0, 5 - activeTeam.primaryRoster.length) }).map((_, i) => (
                      <div key={i} className="p-3 border-2 border-dashed border-stone-300 bg-stone-50/50 text-stone-400 text-xs flex justify-between items-center italic">
                        <span>Slot {activeTeam.primaryRoster.length + i + 1}: Unfilled</span>
                        <span className="text-[10px]">Invite from verified pool below</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* OPTIONAL STAND-IN (0/1) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-black/15 pb-1">
                    <span className="text-xs font-black uppercase text-black">Optional Stand-in (0–1 Limit)</span>
                    <span className="text-[10px] text-stone-500 font-bold">Non-mandatory</span>
                  </div>

                  {activeTeam.standIns.length === 0 ? (
                    <div className="p-3 border border-stone-300 text-stone-400 text-xs italic">
                      No optional stand-in registered. (Teams can compete with standard 5/5 primary roster).
                    </div>
                  ) : (
                    activeTeam.standIns.map(slot => (
                      <div key={slot.userId} className="p-3 bg-stone-50 border-2 border-black flex justify-between items-center text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{slot.avatar}</span>
                          <div>
                            <strong className="text-black">{slot.ign}</strong>
                            <span className="text-[10px] text-stone-500 block">{slot.primaryRole} • Stand-in</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-[#7C3AED]">MMR: {slot.tournamentMmr}</span>
                          {(activeTeam.status === 'DRAFT' || activeTeam.status === 'CHANGES_REQUESTED') && (
                            <button
                              onClick={() => handleRemovePlayer(slot.userId)}
                              className="p-1 hover:bg-red-100 text-red-600 border border-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ADD CONTENDER CONTROL (DRAFT / CHANGES_REQUESTED ONLY) */}
                {(activeTeam.status === 'DRAFT' || activeTeam.status === 'CHANGES_REQUESTED') && (
                  <form onSubmit={handleAddPlayer} className="p-4 bg-stone-50 border-2 border-black space-y-3">
                    <span className="text-xs font-black uppercase text-black block">
                      Invite Contender to Squad Roster
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <SelectDropdown
                          label="Select Verified Contender:"
                          value={addCandidateId}
                          onChange={(val) => setAddCandidateId(val)}
                          options={[
                            { value: '', label: `-- Choose verified player (${availableCandidates.length} eligible) --` },
                            ...availableCandidates.map(c => ({
                              value: c.userId,
                              label: `${c.ign} · MMR: ${c.tournamentMmr} · ${c.primaryRole}`
                            }))
                          ]}
                          className="w-full"
                          placeholder="-- Choose verified player --"
                        />
                      </div>

                      <div>
                        <SelectDropdown
                          label="Roster Slot:"
                          value={addIsStandIn ? 'standin' : 'primary'}
                          onChange={(val) => setAddIsStandIn(val === 'standin')}
                          options={[
                            { value: 'primary', label: `Primary Roster (${activeTeam.primaryRoster.length}/5)` },
                            { value: 'standin', label: `Stand-in (${activeTeam.standIns.length}/1)` }
                          ]}
                          className="w-full"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        disabled={!addCandidateId}
                        className="px-4 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-40"
                      >
                        + Add Contender to Roster
                      </button>
                    </div>
                  </form>
                )}

                {/* SUBMIT ROSTER BUTTON */}
                {(activeTeam.status === 'DRAFT' || activeTeam.status === 'CHANGES_REQUESTED') && (
                  <div className="pt-2 border-t-2 border-black flex justify-between items-center">
                    <span className="text-xs text-stone-500">
                      Requirement: Exactly 5 primary players with confirmed consent.
                    </span>
                    <button
                      onClick={handleSubmitRoster}
                      disabled={activeTeam.primaryRoster.length !== 5}
                      className="px-6 py-2.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Submit Squad Roster for Review</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 bg-white border-[3.5px] border-black text-center text-stone-400 text-xs">
                Select a team on the left or create a new team to manage rosters.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: REGISTER PREMADE TEAM FORM */}
      {/* =================================================================== */}
      {activeTab === 'register' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 max-w-2xl mx-auto space-y-6">
          <div className="border-b-2 border-black pb-3">
            <h3 className="text-xl font-black uppercase text-black font-sans">
              Register New Premade Tournament Squad
            </h3>
            <p className="text-xs text-stone-600 mt-1">
              Premade format: Create or link your team, designate the captain, and assemble your 5-player primary roster.
            </p>
          </div>

          <form onSubmit={handleRegisterTeamSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">Squad Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Mumbai Mavericks, Bengaluru Blaze"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="w-full bg-white border-2 border-black p-2 font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">Tag (2–4 Characters) *</label>
                <input
                  type="text"
                  required
                  maxLength={4}
                  placeholder="MM"
                  value={newTeamTag}
                  onChange={(e) => setNewTeamTag(e.target.value.toUpperCase())}
                  className="w-full bg-white border-2 border-black p-2 font-black uppercase"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Logo Badge"
                  value={newTeamLogo}
                  onChange={(val) => setNewTeamLogo(val)}
                  options={[
                    { value: '🛡️', label: '🛡️ Shield' },
                    { value: '⚡', label: '⚡ Lightning' },
                    { value: '🔥', label: '🔥 Fire' },
                    { value: '👑', label: '👑 Crown' },
                    { value: '🐯', label: '🐯 Tiger' },
                    { value: '🦅', label: '🦅 Eagle' },
                    { value: '⚔️', label: '⚔️ Swords' }
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <SelectDropdown
                label="Designate Team Captain *"
                value={selectedCaptainId}
                onChange={(val) => setSelectedCaptainId(val)}
                options={[
                  { value: '', label: `-- Choose verified captain (${verifiedRegistrations.length} eligible) --` },
                  ...verifiedRegistrations.map(c => ({
                    value: c.userId,
                    label: `${c.ign} · MMR: ${c.tournamentMmr} · ${c.primaryRole}`
                  }))
                ]}
                className="w-full"
                placeholder="-- Choose verified captain --"
              />
              <span className="text-[10px] text-stone-500 mt-1 block">
                Rule: Captain occupies slot 1 in the mandatory 5-player primary roster.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-black/15">
              <button
                type="button"
                onClick={() => setActiveTab('squads')}
                className="px-4 py-2 bg-stone-100 border border-black font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
              >
                Create Squad &amp; Open Roster
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ORGANISER REVIEW DESK */}
      {/* =================================================================== */}
      {activeTab === 'review' && isOrganiser && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div>
              <h3 className="text-xl font-black uppercase text-black font-sans">
                Organiser Roster Verification Desk
              </h3>
              <p className="text-xs text-stone-600">
                Review submitted rosters, credentials, MMR locks, and integrity cases before approving into tournament draw.
              </p>
            </div>
            <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              Authoritative Referee Mode
            </span>
          </div>

          <div className="space-y-4">
            {teams.map(team => (
              <div key={team.teamId} className="border-2 border-black p-4 space-y-4 bg-stone-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{team.logo}</span>
                    <div>
                      <h4 className="font-black text-base uppercase text-black">{team.teamName} [{team.tag}]</h4>
                      <span className="text-[10px] text-stone-500">Captain: {team.captainIgn} • Registered: {new Date(team.registeredAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase ${
                      team.status === 'APPROVED' ? 'bg-[#70FFAF] text-black' :
                      team.status === 'SUBMITTED' ? 'bg-[#FFDE59] text-black' :
                      team.status === 'LOCKED' ? 'bg-[#7C3AED] text-white' :
                      'bg-stone-200'
                    }`}>
                      {team.status}
                    </span>

                    {team.status === 'SUBMITTED' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setReviewTargetTeamId(team.teamId);
                            setReviewAction('APPROVE');
                          }}
                          className="px-3 py-1 bg-[#70FFAF] hover:bg-emerald-400 border border-black text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setReviewTargetTeamId(team.teamId);
                            setReviewAction('REQUEST_CHANGES');
                          }}
                          className="px-3 py-1 bg-[#FFDE59] hover:bg-yellow-400 border border-black text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                        >
                          Request Changes
                        </button>
                        <button
                          onClick={() => {
                            setReviewTargetTeamId(team.teamId);
                            setReviewAction('REJECT');
                          }}
                          className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-500 text-[11px] font-black uppercase shadow-[1px_1px_0px_0px_#EF4444] cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contender Credentials Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 text-[11px]">
                  {team.primaryRoster.map((s, idx) => (
                    <div key={s.userId} className="p-2 bg-white border border-stone-300 space-y-1">
                      <div className="flex justify-between items-center font-bold">
                        <span className="truncate">{idx + 1}. {s.ign}</span>
                        {s.isCaptain && <Crown className="w-3 h-3 text-[#7C3AED]" />}
                      </div>
                      <span className="text-[10px] text-stone-500 block truncate">{s.primaryRole}</span>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-purple-700 font-bold">{s.tournamentMmr} MMR</span>
                        <span className="text-emerald-700 font-bold">VERIFIED</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: HISTORICAL ROSTER SNAPSHOTS */}
      {/* =================================================================== */}
      {activeTab === 'snapshots' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          <div className="border-b-2 border-black pb-3">
            <h3 className="text-xl font-black uppercase text-black font-sans">
              Immutable Historical Tournament Snapshots
            </h3>
            <p className="text-xs text-stone-600">
              Approved tournament rosters snapshot MMR, roles, and emergency changes independently of persistent club profile updates.
            </p>
          </div>

          <div className="space-y-4">
            {teams.filter(t => t.status === 'APPROVED' || t.status === 'LOCKED').length === 0 ? (
              <div className="p-8 text-center text-stone-400 text-xs">
                No rosters have reached APPROVED or LOCKED status yet.
              </div>
            ) : (
              teams.filter(t => t.status === 'APPROVED' || t.status === 'LOCKED').map(team => {
                const snapshot = dotaPremadeTeamEngine.getHistoricalSnapshot(tournamentId, team.teamId);
                return (
                  <div key={team.teamId} className="border-2 border-black p-4 bg-stone-50 space-y-3">
                    <div className="flex justify-between items-center border-b border-black/15 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{team.logo}</span>
                        <strong className="text-sm uppercase text-black">{team.teamName}</strong>
                        <span className="bg-[#70FFAF] border border-black px-1.5 text-[9px] font-black">
                          v{snapshot?.version || 1} SNAPSHOT
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-500">
                        Locked: {snapshot?.lockedAt ? new Date(snapshot.lockedAt).toLocaleDateString() : 'Active Approval'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                      {snapshot?.primaryRoster.map((p, i) => (
                        <div key={p.userId} className="p-2 bg-white border border-black text-[11px]">
                          <strong>{i + 1}. {p.ign}</strong>
                          <span className="text-[10px] text-stone-500 block">{p.primaryRole}</span>
                          <span className="font-mono text-purple-700 font-bold block">{p.tournamentMmr} MMR</span>
                        </div>
                      ))}
                    </div>

                    {snapshot?.emergencyChanges && snapshot.emergencyChanges.length > 0 && (
                      <div className="pt-2 border-t border-black/10 text-[11px] text-stone-600">
                        <strong>Emergency Adjustments:</strong>
                        {snapshot.emergencyChanges.map((ec, idx) => (
                          <div key={idx} className="text-[10px] text-amber-800">
                            • {ec.outgoingPlayerIgn} replaced by {ec.incomingPlayerIgn} (Reason: {ec.reason})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* REVIEW ACTION MODAL */}
      {reviewAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h4 className="font-black text-base uppercase text-black font-sans">
                Organiser Action: {reviewAction}
              </h4>
              <button
                onClick={() => setReviewAction(null)}
                className="font-black text-sm p-1 border border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">
                  Justification Reason {reviewAction !== 'APPROVE' && '*'}
                </label>
                <textarea
                  rows={3}
                  required={reviewAction !== 'APPROVE'}
                  placeholder={
                    reviewAction === 'APPROVE'
                      ? 'e.g. All player MMRs verified and no roster conflicts found.'
                      : 'e.g. Player X has an unresolved MMR dispute; please substitute.'
                  }
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  className="w-full bg-white border-2 border-black p-2 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/15">
                <button
                  type="button"
                  onClick={() => setReviewAction(null)}
                  className="px-3 py-2 bg-stone-100 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Confirm {reviewAction}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMERGENCY REPLACEMENT MODAL */}
      {emergencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h4 className="font-black text-base uppercase text-black font-sans flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>Emergency Player Replacement</span>
              </h4>
              <button
                onClick={() => setEmergencyModalOpen(false)}
                className="font-black text-sm p-1 border border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmergencySubmit} className="space-y-4 text-xs">
              <div>
                <SelectDropdown
                  label="Outgoing Player:"
                  value={emergencyOutgoingId}
                  onChange={(val) => setEmergencyOutgoingId(val)}
                  options={[
                    { value: '', label: '-- Choose Outgoing Player --' },
                    ...(activeTeam?.primaryRoster || []).map(s => ({ value: s.userId, label: `${s.ign} (${s.primaryRole})` })),
                    ...(activeTeam?.standIns || []).map(s => ({ value: s.userId, label: `${s.ign} (Stand-in)` }))
                  ]}
                  className="w-full"
                  placeholder="-- Choose Outgoing Player --"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Incoming VERIFIED Player:"
                  value={emergencyIncomingId}
                  onChange={(val) => setEmergencyIncomingId(val)}
                  options={[
                    { value: '', label: '-- Choose Eligible Contender --' },
                    ...availableCandidates.map(c => ({
                      value: c.userId,
                      label: `${c.ign} · MMR: ${c.tournamentMmr} · ${c.primaryRole}`
                    }))
                  ]}
                  className="w-full"
                  placeholder="-- Choose Eligible Contender --"
                />
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-stone-600 mb-1">Mandatory Justification Reason *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Medical emergency verified by referee committee."
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full bg-white border-2 border-black p-2 font-bold"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-black/15">
                <button
                  type="button"
                  onClick={() => setEmergencyModalOpen(false)}
                  className="px-3 py-2 bg-stone-100 border border-black font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#70FFAF] text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Execute Replacement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
