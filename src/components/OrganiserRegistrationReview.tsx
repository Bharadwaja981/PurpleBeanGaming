import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Shield, 
  TrendingUp, 
  FileText, 
  Sparkles, 
  HelpCircle, 
  ExternalLink, 
  ChevronRight, 
  Lock, 
  Unlock, 
  Eye, 
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Flame,
  Gamepad2
} from 'lucide-react';
import { 
  tournamentService 
} from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';
import { 
  DotaTournamentRegistration, 
  DotaRegistrationState, 
  MmrIntegrityCaseType,
  MmrIntegrityCase,
  DOTA_ROLES,
  RegistrationEvidenceItem,
  dotaPlayerRegistry
} from '../domain/dotaPlayerEngine';
import { fetchOpenDotaPlayer, OpenDotaPlayerSummary, getRankTierName } from '../services/openDotaService';

interface OrganiserRegistrationReviewProps {
  tournamentId: string;
  tournamentName?: string;
  onRefresh?: () => void;
}

export const OrganiserRegistrationReview: React.FC<OrganiserRegistrationReviewProps> = ({
  tournamentId,
  tournamentName = 'Tournament'
}) => {
  const [registrations, setRegistrations] = useState<DotaTournamentRegistration[]>(() => 
    tournamentService.getTournamentRegistrations(tournamentId)
  );
  const [integrityCases, setIntegrityCases] = useState<MmrIntegrityCase[]>(() => 
    tournamentService.getIntegrityCases().filter(c => !c.tournamentId || c.tournamentId === tournamentId)
  );

  // Filters & Search
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | DotaRegistrationState>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'mmr' | 'ign'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selected registration for review drawer
  const [activeReg, setActiveReg] = useState<DotaTournamentRegistration | null>(null);
  const [openDotaSummary, setOpenDotaSummary] = useState<OpenDotaPlayerSummary | null>(null);
  const [isLoadingOpenDota, setIsLoadingOpenDota] = useState(false);

  // Action Form States
  const [actionType, setActionType] = useState<
    'NONE' | 'CORRECT_MMR' | 'REQUEST_EVIDENCE' | 'REJECT' | 'INTEGRITY_CASE' | 'CORRECT_LOCKED'
  >('NONE');
  const [correctedMmrInput, setCorrectedMmrInput] = useState<number>(6000);
  const [actionReason, setActionReason] = useState<string>('');
  const [evidencePromptInput, setEvidencePromptInput] = useState<string>('');
  const [integrityCaseType, setIntegrityCaseType] = useState<MmrIntegrityCaseType>('MMR Mismatch');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const refreshData = () => {
    const list = tournamentService.getTournamentRegistrations(tournamentId);
    setRegistrations(list);
    setIntegrityCases(
      tournamentService.getIntegrityCases().filter(c => !c.tournamentId || c.tournamentId === tournamentId)
    );
    if (activeReg) {
      const updated = list.find(r => r.id === activeReg.id);
      if (updated) setActiveReg(updated);
    }
  };

  useEffect(() => {
    const unsub = tournamentService.subscribe(refreshData);
    return unsub;
  }, [tournamentId]);

  // Load OpenDota data when opening active registration
  useEffect(() => {
    if (activeReg && (activeReg.steamId64 || activeReg.steamId32)) {
      setIsLoadingOpenDota(true);
      fetchOpenDotaPlayer(activeReg.steamId32 || activeReg.steamId64!)
        .then((res) => {
          setOpenDotaSummary(res);
        })
        .catch(() => {
          setOpenDotaSummary(null);
        })
        .finally(() => {
          setIsLoadingOpenDota(false);
        });
    } else {
      setOpenDotaSummary(null);
    }
  }, [activeReg?.id]);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Actions
  const handleStartReview = async (userId: string) => {
    const res = await tournamentService.startRegistrationReview(tournamentId, userId);
    if (res.success) {
      showFeedback('Player registration marked as Under Review.');
      refreshData();
    } else {
      showFeedback(res.error || 'Failed to update review status.', 'error');
    }
  };

  const handleConfirmDeclaredMmr = async (userId: string) => {
    const res = await tournamentService.confirmDeclaredMmr(tournamentId, userId);
    if (res.success) {
      showFeedback('Declared MMR confirmed as Tournament MMR.');
      refreshData();
    } else {
      showFeedback(res.error || 'Failed to confirm MMR.', 'error');
    }
  };

  const handleSetCorrectedMmr = async () => {
    if (!activeReg) return;
    if (correctedMmrInput < 1 || correctedMmrInput > 15000) {
      showFeedback('MMR must be between 1 and 15,000.', 'error');
      return;
    }
    if (!actionReason.trim()) {
      showFeedback('A justification reason is required.', 'error');
      return;
    }

    const res = activeReg.isMmrLocked
      ? await tournamentService.correctLockedTournamentMmr(tournamentId, activeReg.userId, correctedMmrInput, actionReason)
      : await tournamentService.setCorrectedTournamentMmr(tournamentId, activeReg.userId, correctedMmrInput, actionReason);

    if (res.success) {
      showFeedback(`Tournament MMR updated to ${correctedMmrInput.toLocaleString()}.`);
      setActionType('NONE');
      setActionReason('');
      refreshData();
    } else {
      showFeedback(res.error || 'Failed to set Tournament MMR.', 'error');
    }
  };

  const handleRequestEvidence = async () => {
    if (!activeReg) return;
    if (!evidencePromptInput.trim()) {
      showFeedback('Please provide specific evidence requirements for the player.', 'error');
      return;
    }

    const res = await tournamentService.requestRegistrationEvidence(
      tournamentId, 
      activeReg.userId, 
      evidencePromptInput
    );
    if (res.success) {
      showFeedback('Evidence request dispatched to player.');
      setActionType('NONE');
      setEvidencePromptInput('');
      refreshData();
    } else {
      showFeedback(res.error || 'Failed to request evidence.', 'error');
    }
  };

  const handleVerifyPlayer = async (userId: string, confirmedMmr?: number) => {
    const res = await tournamentService.verifyRegistration(tournamentId, userId, confirmedMmr);
    if (res.success) {
      showFeedback('Contender VERIFIED & locked! Player is now eligible for franchise draft & rosters.');
      refreshData();
    } else {
      showFeedback(res.error || 'Verification failed.', 'error');
    }
  };

  const handleRejectPlayer = async () => {
    if (!activeReg) return;
    if (!actionReason.trim()) {
      showFeedback('A rejection reason must be specified.', 'error');
      return;
    }

    const res = await tournamentService.rejectRegistration(tournamentId, activeReg.userId, actionReason);
    if (res.success) {
      showFeedback('Registration rejected and player notified.');
      setActionType('NONE');
      setActionReason('');
      refreshData();
    } else {
      showFeedback(res.error || 'Failed to reject registration.', 'error');
    }
  };

  const handleCreateIntegrityCase = () => {
    if (!activeReg) return;
    if (!actionReason.trim()) {
      showFeedback('Please provide notes or evidence for opening this integrity case.', 'error');
      return;
    }

    tournamentService.createIntegrityCase(
      activeReg.userId,
      integrityCaseType,
      activeReg.declaredMmr,
      actionReason,
      tournamentId
    );
    showFeedback(`Integrity Case (${integrityCaseType}) opened. This does not automatically disqualify the player.`);
    setActionType('NONE');
    setActionReason('');
    refreshData();
  };

  const handleResolveCase = (
    caseId: string, 
    action: 'APPROVE' | 'CORRECT_MMR' | 'REQUEST_EVIDENCE' | 'WARN' | 'DISQUALIFY' | 'REJECT' | 'ESCALATE',
    correctedMmr?: number
  ) => {
    const note = prompt(`Enter resolution audit note for action ${action}:`, 'Organiser verified via official records.');
    if (!note) return;

    tournamentService.resolveIntegrityCase(caseId, action, note, correctedMmr);
    showFeedback(`Integrity case action ${action} executed.`);
    refreshData();
  };

  // Filtered & Sorted items
  const filteredRegistrations = registrations
    .filter((r) => {
      if (selectedFilter !== 'ALL' && r.status !== selectedFilter) return false;
      if (selectedRole !== 'ALL' && r.primaryRole !== selectedRole && r.secondaryRole !== selectedRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.ign.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q) ||
          (r.city && r.city.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'mmr') {
        const mmrA = a.tournamentMmr || a.declaredMmr;
        const mmrB = b.tournamentMmr || b.declaredMmr;
        return sortOrder === 'desc' ? mmrB - mmrA : mmrA - mmrB;
      }
      if (sortBy === 'ign') {
        return sortOrder === 'desc' ? b.ign.localeCompare(a.ign) : a.ign.localeCompare(b.ign);
      }
      return sortOrder === 'desc' 
        ? new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime()
        : new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime();
    });

  // Metric counts
  const counts = {
    all: registrations.length,
    registered: registrations.filter(r => r.status === 'REGISTERED').length,
    underReview: registrations.filter(r => r.status === 'UNDER_REVIEW').length,
    evidenceRequested: registrations.filter(r => r.status === 'EVIDENCE_REQUESTED').length,
    verified: registrations.filter(r => r.status === 'VERIFIED').length,
    rejected: registrations.filter(r => r.status === 'REJECTED').length,
    withdrawn: registrations.filter(r => r.status === 'WITHDRAWN').length,
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#FFFBEB] border-2 border-black p-4 sm:p-6 shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-stone-600 font-mono text-xs font-black uppercase">
            <Shield className="w-4 h-4 text-[#7C3AED]" />
            <span>ORGANISER VERIFICATION &amp; TOURNAMENT MMR DESK</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans">
            CONTENDER ELIGIBILITY AUDIT · {tournamentName}
          </h2>
          <p className="font-mono text-xs text-stone-700 max-w-3xl">
            Only <strong>VERIFIED</strong> players enter captain selection and live franchise auctions. OpenDota data acts as supporting evidence only; organisers calibrate and lock canonical Tournament MMR.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-2 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {statusMessage && (
        <div className={`p-3 border-2 border-black font-mono text-xs font-black flex items-center justify-between shadow-[2px_2px_0px_0px_#000] ${
          statusMessage.type === 'error' ? 'bg-[#FF5757] text-white' : 'bg-[#70FFAF] text-black'
        }`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          onClick={() => setSelectedFilter('ALL')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'ALL'
              ? 'bg-black text-white shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          All ({counts.all})
        </button>
        <button
          onClick={() => setSelectedFilter('REGISTERED')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'REGISTERED'
              ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Registered ({counts.registered})
        </button>
        <button
          onClick={() => setSelectedFilter('UNDER_REVIEW')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'UNDER_REVIEW'
              ? 'bg-[#8B5CF6] text-white shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Under Review ({counts.underReview})
        </button>
        <button
          onClick={() => setSelectedFilter('EVIDENCE_REQUESTED')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'EVIDENCE_REQUESTED'
              ? 'bg-[#FF70A6] text-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Evidence Requested ({counts.evidenceRequested})
        </button>
        <button
          onClick={() => setSelectedFilter('VERIFIED')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'VERIFIED'
              ? 'bg-[#70FFAF] text-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          ✓ Verified &amp; Eligible ({counts.verified})
        </button>
        <button
          onClick={() => setSelectedFilter('REJECTED')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'REJECTED'
              ? 'bg-[#FF5757] text-white shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-black'
          }`}
        >
          Rejected ({counts.rejected})
        </button>
        <button
          onClick={() => setSelectedFilter('WITHDRAWN')}
          className={`px-3 py-1.5 border-2 border-black font-black uppercase cursor-pointer transition-all ${
            selectedFilter === 'WITHDRAWN'
              ? 'bg-stone-300 text-black shadow-[2px_2px_0px_0px_#000]'
              : 'bg-white hover:bg-stone-100 text-stone-600'
          }`}
        >
          Withdrawn ({counts.withdrawn})
        </button>
      </div>

      {/* Search & Sort Controls */}
      <div className="bg-white border-2 border-black p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-500 shrink-0" />
          <input
            type="text"
            placeholder="Search by IGN, User ID, or City..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-black p-1.5 font-bold outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <SelectDropdown
            value={selectedRole}
            onChange={(val) => setSelectedRole(val)}
            options={[
              { value: 'ALL', label: 'All Roles' },
              ...DOTA_ROLES.map(r => ({ value: r, label: r }))
            ]}
            size="sm"
            placeholder="Role"
          />

          <SelectDropdown
            value={sortBy}
            onChange={(val) => setSortBy(val as any)}
            options={[
              { value: 'date', label: 'Date Registered' },
              { value: 'mmr', label: 'MMR' },
              { value: 'ign', label: 'IGN' }
            ]}
            size="sm"
            placeholder="Sort by"
          />

          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="bg-stone-100 hover:bg-stone-200 border-2 border-black px-2 py-1.5 font-mono text-xs font-bold cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            {sortOrder === 'desc' ? '↓ DESC' : '↑ ASC'}
          </button>
        </div>
      </div>

      {/* Main Registrations Table */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black">
              <tr>
                <th className="p-3">Contender / IGN</th>
                <th className="p-3">Declared MMR</th>
                <th className="p-3">Calibrated Tourney MMR</th>
                <th className="p-3">PB Rating</th>
                <th className="p-3">Roles (Primary / Alt)</th>
                <th className="p-3">Steam &amp; OpenDota</th>
                <th className="p-3">Origin</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Review Action</th>
              </tr>
            </thead>
            <tbody className="divide-y border-stone-200">
              {filteredRegistrations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-stone-500 font-bold">
                    No registrations found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((reg) => {
                  const player = dotaPlayerRegistry.getPlayer(reg.userId);
                  const prevVerifiedMmr = player?.historicalTournamentMmrs?.length 
                    ? player.historicalTournamentMmrs[player.historicalTournamentMmrs.length - 1].tournamentMmr
                    : null;

                  return (
                    <tr 
                      key={reg.id} 
                      className={`hover:bg-[#FFFBEB]/50 transition-colors ${
                        activeReg?.id === reg.id ? 'bg-[#FFFBEB]' : ''
                      }`}
                    >
                      {/* IGN & User */}
                      <td className="p-3 font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{player?.avatar || '🎮'}</span>
                          <span className="text-black font-black">{reg.ign}</span>
                        </div>
                        <div className="text-[10px] text-stone-500 font-normal mt-0.5">
                          UID: {reg.userId} · {new Date(reg.registeredAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Declared MMR */}
                      <td className="p-3 font-black text-stone-800">
                        {reg.declaredMmr?.toLocaleString()}
                        <span className="text-[9px] block text-stone-500 font-normal">Player Declared</span>
                      </td>

                      {/* Tournament MMR */}
                      <td className="p-3">
                        {reg.tournamentMmr ? (
                          <div className="flex items-center gap-1">
                            <span className="font-black text-[#7C3AED] text-sm">
                              {reg.tournamentMmr.toLocaleString()}
                            </span>
                            {reg.isMmrLocked ? (
                              <span title="Locked by referee"><Lock className="w-3.5 h-3.5 text-emerald-600" /></span>
                            ) : (
                              <span title="Unlocked"><Unlock className="w-3.5 h-3.5 text-stone-400" /></span>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400 font-bold italic">Pending Review</span>
                        )}
                        {prevVerifiedMmr && (
                          <div className="text-[10px] text-stone-500">
                            Prev Cup: {prevVerifiedMmr.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* PB Rating */}
                      <td className="p-3 font-bold">
                        <div className="flex items-center gap-1 text-emerald-800">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>{player?.competitiveRating || 1500}</span>
                        </div>
                        <span className="text-[9px] text-stone-500 block uppercase">
                          {player?.ratingStatus || 'PROVISIONAL'}
                        </span>
                      </td>

                      {/* Roles */}
                      <td className="p-3">
                        <div className="font-bold text-black">{reg.primaryRole}</div>
                        <div className="text-[10px] text-stone-500">{reg.secondaryRole}</div>
                      </td>

                      {/* Steam & OpenDota */}
                      <td className="p-3">
                        {reg.steamId64 ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-[11px] font-bold text-blue-800">
                              <span>Steam: {reg.steamId64.slice(0, 4)}...{reg.steamId64.slice(-4)}</span>
                            </div>
                            <a
                              href={`https://www.opendota.com/players/${reg.steamId32 || ''}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[10px] text-purple-700 underline flex items-center gap-0.5 hover:text-purple-900"
                            >
                              <span>OpenDota</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] font-bold">
                            Steam Not Linked
                          </span>
                        )}
                      </td>

                      {/* Origin */}
                      <td className="p-3 text-stone-700">
                        {reg.city ? `${reg.city}, ${reg.region || 'India'}` : 'Pan India'}
                      </td>

                      {/* Status */}
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 border border-black font-black text-[10px] uppercase shadow-[1px_1px_0px_0px_#000] inline-flex items-center gap-1 ${
                          reg.status === 'VERIFIED' ? 'bg-[#70FFAF] text-black' :
                          reg.status === 'UNDER_REVIEW' ? 'bg-[#8B5CF6] text-white' :
                          reg.status === 'EVIDENCE_REQUESTED' ? 'bg-[#FF70A6] text-black animate-pulse' :
                          reg.status === 'REJECTED' ? 'bg-[#FF5757] text-white' :
                          reg.status === 'WITHDRAWN' ? 'bg-stone-300 text-stone-700' :
                          'bg-[#FFE600] text-black'
                        }`}>
                          {reg.status === 'VERIFIED' && <CheckCircle className="w-3 h-3" />}
                          {reg.status === 'REJECTED' && <XCircle className="w-3 h-3" />}
                          <span>{reg.status.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Review Action Drawer Button */}
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setActiveReg(reg);
                            setCorrectedMmrInput(reg.tournamentMmr || reg.declaredMmr);
                            setActionType('NONE');
                          }}
                          className="bg-black hover:bg-stone-900 text-white border border-black px-3 py-1 font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000] inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Review</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL / AUDIT DRAWER MODAL */}
      {activeReg && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] w-full max-w-4xl p-6 sm:p-8 space-y-6 my-auto max-h-[92vh] overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl bg-stone-100 border-2 border-black p-2">
                  {dotaPlayerRegistry.getPlayer(activeReg.userId)?.avatar || '🎮'}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black uppercase text-black font-sans">
                      {activeReg.ign}
                    </h3>
                    <span className={`px-2 py-0.5 border border-black text-[10px] font-black uppercase ${
                      activeReg.status === 'VERIFIED' ? 'bg-[#70FFAF] text-black' :
                      activeReg.status === 'REJECTED' ? 'bg-[#FF5757] text-white' :
                      'bg-[#FFE600] text-black'
                    }`}>
                      {activeReg.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-stone-600">
                    Registration ID: {activeReg.id} · User: {activeReg.userId} · Date: {new Date(activeReg.registeredAt).toLocaleString()}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveReg(null);
                  setActionType('NONE');
                }}
                className="bg-white hover:bg-stone-100 border-2 border-black px-3 py-1 font-mono text-xs font-black uppercase self-start sm:self-auto cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Key Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
              <div className="bg-[#FFFBEB] border-2 border-black p-3 space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block uppercase">Player Declared MMR</span>
                <span className="text-xl font-black text-black">{activeReg.declaredMmr?.toLocaleString()}</span>
                <span className="text-[10px] text-stone-500 block">Self-reported by player</span>
              </div>

              <div className="bg-[#EDE9FE] border-2 border-black p-3 space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block uppercase">Calibrated Tourney MMR</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-[#7C3AED]">
                    {activeReg.tournamentMmr ? activeReg.tournamentMmr.toLocaleString() : 'Uncalibrated'}
                  </span>
                  {activeReg.isMmrLocked && (
                    <span title="Locked"><Lock className="w-4 h-4 text-emerald-700" /></span>
                  )}
                </div>
                <span className="text-[10px] text-stone-500 block">
                  {activeReg.isMmrLocked ? `Locked by ${activeReg.mmrLockedBy || 'staff'}` : 'Subject to referee calibration'}
                </span>
              </div>

              <div className="bg-[#ECFDF5] border-2 border-black p-3 space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block uppercase">Purple Bean Rating</span>
                <span className="text-xl font-black text-emerald-800">
                  {dotaPlayerRegistry.getPlayer(activeReg.userId)?.competitiveRating || 1500}
                </span>
                <span className="text-[10px] text-stone-500 block">
                  Confidence: {dotaPlayerRegistry.getPlayer(activeReg.userId)?.ratingConfidence || 50}%
                </span>
              </div>

              <div className="bg-stone-50 border-2 border-black p-3 space-y-1">
                <span className="text-[10px] font-bold text-stone-600 block uppercase">Eligibility Status</span>
                <span className={`text-sm font-black uppercase block ${
                  activeReg.status === 'VERIFIED' ? 'text-emerald-700' : 'text-amber-800'
                }`}>
                  {activeReg.status === 'VERIFIED' ? '✓ Eligible for Auction' : '✕ Ineligible (Unverified)'}
                </span>
                <span className="text-[10px] text-stone-500 block">
                  Roster &amp; draft eligibility
                </span>
              </div>
            </div>

            {/* OpenDota Supporting Evidence Telemetry */}
            <div className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black pb-2">
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-[#7C3AED]" />
                  <span className="font-black uppercase text-black">
                    OpenDota Supporting Telemetry
                  </span>
                </div>
                <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                  Supporting Evidence Only · Never Auto-Applied
                </span>
              </div>

              {isLoadingOpenDota ? (
                <div className="text-stone-500 py-3 italic">Fetching live telemetry from OpenDota network...</div>
              ) : openDotaSummary ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-stone-500 block font-bold">Rank Tier Badge:</span>
                    <span className="font-black text-sm text-black">{openDotaSummary.rankName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block font-bold">Estimated MMR Bracket:</span>
                    <span className="font-black text-sm text-purple-800">
                      {openDotaSummary.estimatedMmr ? `~${openDotaSummary.estimatedMmr.toLocaleString()}` : 'Unranked'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block font-bold">Competitive Win Rate:</span>
                    <span className="font-black text-sm text-black">
                      {openDotaSummary.winRate}% ({openDotaSummary.wins}W - {openDotaSummary.losses}L)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-stone-500 block font-bold">Recent Matches Logged:</span>
                    <span className="font-black text-sm text-black">
                      {openDotaSummary.recentMatches.length} games recorded
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-stone-500 text-xs italic">
                  No public OpenDota telemetry available or profile is private. You can request screenshot verification.
                </div>
              )}
            </div>

            {/* Submitted Private Evidence Items */}
            <div className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-black pb-2">
                <span className="font-black uppercase text-black flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  Submitted Player Evidence ({activeReg.evidence?.length || 0})
                </span>
                <span className="text-[10px] text-stone-500">
                  Strictly Confidential · Organisers &amp; Player Only
                </span>
              </div>

              {activeReg.evidence && activeReg.evidence.length > 0 ? (
                <div className="space-y-2">
                  {activeReg.evidence.map((ev, idx) => (
                    <div key={ev.id || idx} className="bg-white border border-black p-3 space-y-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-[#7C3AED] uppercase text-[11px] font-black">
                          Type: {ev.type.replace('_', ' ')}
                        </span>
                        <span className="text-stone-500 text-[10px]">
                          {new Date(ev.submittedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-stone-800">{ev.description}</p>
                      {ev.fileUrl && (
                        <div className="pt-1">
                          <a 
                            href={ev.fileUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-blue-700 underline text-[11px] font-bold flex items-center gap-1"
                          >
                            <span>View Attached Evidence Asset / Link</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-stone-500 italic py-2">
                  No evidence uploaded yet. If skill or identity is in doubt, click "Request Evidence" below.
                </div>
              )}
            </div>

            {/* Historical MMR Changes Audit Trail */}
            {activeReg.historicalMmrChanges && activeReg.historicalMmrChanges.length > 0 && (
              <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-2 font-mono text-xs">
                <span className="font-black uppercase text-stone-800 block">
                  Tournament MMR Revision History (Immutable Audit Log)
                </span>
                <div className="divide-y border-t border-black/20 pt-1">
                  {activeReg.historicalMmrChanges.map((change, idx) => (
                    <div key={idx} className="py-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          Calibration: <strong className="text-red-700">{change.oldValue}</strong> → <strong className="text-emerald-700">{change.newValue}</strong>
                        </span>
                        <span className="text-stone-500 text-[10px]">
                          {new Date(change.timestamp).toLocaleString()} by {change.actor}
                        </span>
                      </div>
                      <div className="text-stone-700 italic">"{change.reason}"</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="bg-stone-100 border-2 border-black p-4 space-y-3 font-mono text-xs">
              <span className="font-black uppercase text-black block">
                Referee &amp; Organiser Actions
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {activeReg.status === 'REGISTERED' && (
                  <button
                    onClick={() => handleStartReview(activeReg.userId)}
                    className="bg-[#8B5CF6] hover:bg-purple-700 text-white border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    Start Review (Under Review)
                  </button>
                )}

                <button
                  onClick={() => handleConfirmDeclaredMmr(activeReg.userId)}
                  className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Confirm Declared MMR ({activeReg.declaredMmr.toLocaleString()})
                </button>

                <button
                  onClick={() => {
                    setActionType('CORRECT_MMR');
                    setCorrectedMmrInput(activeReg.tournamentMmr || activeReg.declaredMmr);
                  }}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Set Corrected Tournament MMR
                </button>

                <button
                  onClick={() => setActionType('REQUEST_EVIDENCE')}
                  className="bg-[#FF70A6] hover:bg-pink-400 text-black border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Request Evidence
                </button>

                <button
                  onClick={() => handleVerifyPlayer(activeReg.userId, activeReg.tournamentMmr || activeReg.declaredMmr)}
                  className="bg-[#70FFAF] hover:bg-emerald-400 text-black border-2 border-black px-4 py-2 font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4 text-black" />
                  <span>Verify Contender &amp; Lock MMR</span>
                </button>

                <button
                  onClick={() => setActionType('INTEGRITY_CASE')}
                  className="bg-white hover:bg-red-50 text-red-700 border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Flag Integrity Case</span>
                </button>

                <button
                  onClick={() => setActionType('REJECT')}
                  className="bg-[#FF5757] hover:bg-red-600 text-white border-2 border-black px-3 py-2 font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Reject Entry
                </button>
              </div>

              {/* Sub-Action Form Panels */}
              {actionType === 'CORRECT_MMR' && (
                <div className="bg-white border-2 border-black p-4 space-y-3 mt-3">
                  <span className="font-black uppercase text-stone-900 block">
                    Adjust Tournament MMR for {activeReg.ign}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Calibrated Tournament MMR:</label>
                      <input
                        type="number"
                        min={1}
                        max={15000}
                        value={correctedMmrInput}
                        onChange={(e) => setCorrectedMmrInput(parseInt(e.target.value) || 0)}
                        className="w-full bg-stone-50 border border-black p-2 font-black text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Justification Reason (Mandatory Audit):</label>
                      <input
                        type="text"
                        placeholder="e.g. Verified divine 3 rank badge via in-game screenshot"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="w-full bg-stone-50 border border-black p-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setActionType('NONE')}
                      className="bg-white hover:bg-stone-100 border border-black px-3 py-1 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSetCorrectedMmr}
                      className="bg-[#7C3AED] hover:bg-purple-700 text-white border border-black px-4 py-1.5 font-black uppercase"
                    >
                      Commit MMR Adjustment
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'REQUEST_EVIDENCE' && (
                <div className="bg-white border-2 border-black p-4 space-y-3 mt-3">
                  <span className="font-black uppercase text-stone-900 block">
                    Dispatch Evidence Request to {activeReg.ign}
                  </span>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Prompt / Instructions for Player:</label>
                    <textarea
                      rows={3}
                      placeholder="e.g. Please provide a clear screenshot of your in-game Dota 2 profile showing your current medal and MMR tab, or a link to your Dotabuff/OpenDota profile."
                      value={evidencePromptInput}
                      onChange={(e) => setEvidencePromptInput(e.target.value)}
                      className="w-full bg-stone-50 border border-black p-2 font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setActionType('NONE')}
                      className="bg-white hover:bg-stone-100 border border-black px-3 py-1 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRequestEvidence}
                      className="bg-[#FF70A6] hover:bg-pink-400 text-black border border-black px-4 py-1.5 font-black uppercase"
                    >
                      Send Evidence Request
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'INTEGRITY_CASE' && (
                <div className="bg-white border-2 border-black p-4 space-y-3 mt-3">
                  <span className="font-black uppercase text-stone-900 block flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    Open Skill / Account Integrity Case
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <SelectDropdown
                        label="Integrity Case Category:"
                        value={integrityCaseType}
                        onChange={(val) => setIntegrityCaseType(val as any)}
                        options={[
                          { value: 'Possible Smurf', label: 'Possible Smurf' },
                          { value: 'MMR Mismatch', label: 'MMR Mismatch' },
                          { value: 'Account Mismatch', label: 'Account Mismatch' },
                          { value: 'Duplicate Account', label: 'Duplicate Account' },
                          { value: 'Insufficient Evidence', label: 'Insufficient Evidence' },
                          { value: 'Suspicious Historical MMR', label: 'Suspicious Historical MMR' },
                          { value: 'Other', label: 'Other' }
                        ]}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold block mb-1">Case Notes / Telemetry Anomaly:</label>
                      <input
                        type="text"
                        placeholder="e.g. Declared 5200 but previous tournament history records 7400"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="w-full bg-stone-50 border border-black p-2 font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-[11px] text-stone-500 italic">
                    Note: Opening an integrity case flags the player for investigation but does not automatically disqualify or reject them.
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setActionType('NONE')}
                      className="bg-white hover:bg-stone-100 border border-black px-3 py-1 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateIntegrityCase}
                      className="bg-[#FF5757] hover:bg-red-600 text-white border border-black px-4 py-1.5 font-black uppercase"
                    >
                      Open Case
                    </button>
                  </div>
                </div>
              )}

              {actionType === 'REJECT' && (
                <div className="bg-white border-2 border-black p-4 space-y-3 mt-3">
                  <span className="font-black uppercase text-red-600 block">
                    Reject Tournament Registration for {activeReg.ign}
                  </span>
                  <div>
                    <label className="text-[10px] font-bold block mb-1">Rejection Reason (Dispatched to Player):</label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Account does not meet minimum tournament requirements or failed MMR verification."
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full bg-stone-50 border border-black p-2 font-bold"
                    />
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => setActionType('NONE')}
                      className="bg-white hover:bg-stone-100 border border-black px-3 py-1 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectPlayer}
                      className="bg-[#FF5757] hover:bg-red-600 text-white border border-black px-4 py-1.5 font-black uppercase"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE INTEGRITY CASES PANEL */}
      {integrityCases.length > 0 && (
        <div className="bg-white border-2 border-black p-5 space-y-4 shadow-[4px_4px_0px_0px_#000]">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h3 className="text-lg font-black uppercase text-black font-sans">
                Active Integrity &amp; Smurf Cases ({integrityCases.length})
              </h3>
            </div>
            <span className="text-stone-500 font-mono text-xs">
              Review cases opened during registration
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrityCases.map((c) => (
              <div key={c.id} className="bg-stone-50 border-2 border-black p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-black pb-1.5">
                  <span className="font-black text-black text-sm">{c.playerIgn}</span>
                  <span className="bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 font-black text-[10px] uppercase">
                    {c.caseType}
                  </span>
                </div>

                <div className="space-y-1 text-stone-700">
                  <div><strong>Declared MMR:</strong> {c.declaredMmr?.toLocaleString()}</div>
                  <div><strong>Evidence Notes:</strong> {c.evidenceNotes}</div>
                  <div><strong>Status:</strong> <span className="font-bold uppercase text-[#7C3AED]">{c.status}</span></div>
                  <div><strong>Opened:</strong> {new Date(c.openedAt).toLocaleString()}</div>
                </div>

                {c.status === 'OPEN' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-dashed border-stone-300">
                    <button
                      onClick={() => handleResolveCase(c.id, 'APPROVE')}
                      className="bg-[#70FFAF] hover:bg-emerald-300 text-black border border-black px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => {
                        const val = prompt('Enter corrected Tournament MMR for player:', c.declaredMmr.toString());
                        if (val) handleResolveCase(c.id, 'CORRECT_MMR', parseInt(val));
                      }}
                      className="bg-[#FFE600] hover:bg-yellow-300 text-black border border-black px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Correct MMR
                    </button>
                    <button
                      onClick={() => handleResolveCase(c.id, 'REQUEST_EVIDENCE')}
                      className="bg-[#FF70A6] hover:bg-pink-300 text-black border border-black px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Request Evidence
                    </button>
                    <button
                      onClick={() => handleResolveCase(c.id, 'ESCALATE')}
                      className="bg-white hover:bg-stone-100 text-black border border-black px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Escalate
                    </button>
                    <button
                      onClick={() => handleResolveCase(c.id, 'REJECT')}
                      className="bg-[#FF5757] hover:bg-red-600 text-white border border-black px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
