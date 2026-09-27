import { useState, useEffect } from 'react';
import { X, CheckCircle, ShieldCheck, Flame, Trophy, MapPin, Gamepad2, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { IndianCity } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';
import { testCupEngine } from '../domain/testCupEngine';
import { 
  DOTA_ROLES, 
  DotaRolePosition, 
  validateDotaRoles,
  DotaTournamentRegistration,
  dotaPlayerRegistry,
  EvidenceType
} from '../domain/dotaPlayerEngine';

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId?: string;
  tournamentName?: string;
  onNavigateToProfile?: () => void;
}

const INDIAN_CITIES: IndianCity[] = [
  'Bengaluru',
  'Mumbai',
  'Delhi',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad'
];

export function RegistrationModal({
  isOpen,
  onClose,
  tournamentId = 'purple-bean-test-cup',
  tournamentName = 'Purple Bean Test Cup',
  onNavigateToProfile
}: RegistrationModalProps) {
  const currentUser = tournamentService.getCurrentUser();
  const playerProfile = tournamentService.getDotaPlayer(currentUser.id);

  const [inGameId, setInGameId] = useState(playerProfile?.username || 'PhantomLancer#IN');
  const [declaredMmr, setDeclaredMmr] = useState(String(playerProfile?.declaredMmr || 7550));
  const [primaryRole, setPrimaryRole] = useState<DotaRolePosition>(playerProfile?.primaryRole || 'Position 1 — Carry');
  const [secondaryRole, setSecondaryRole] = useState<DotaRolePosition>(playerProfile?.secondaryRole || 'Position 2 — Mid');
  const [city, setCity] = useState<IndianCity>((playerProfile?.city as IndianCity) || 'Bengaluru');
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingReg, setExistingReg] = useState<DotaTournamentRegistration | undefined>(undefined);

  // Evidence submission state
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('MMR_SCREENSHOT');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [evidenceFeedback, setEvidenceFeedback] = useState<string | null>(null);

  // Sync state when opened or user switches
  useEffect(() => {
    if (isOpen) {
      const reg = tournamentService.getUserRegistration(tournamentId, currentUser.id);
      setExistingReg(reg);
      const player = tournamentService.getDotaPlayer(currentUser.id);
      if (player) {
        setInGameId(player.username);
        setDeclaredMmr(String(player.declaredMmr || 7550));
        setPrimaryRole(player.primaryRole || 'Position 1 — Carry');
        setSecondaryRole(player.secondaryRole || 'Position 2 — Mid');
        if (player.city && INDIAN_CITIES.includes(player.city as IndianCity)) {
          setCity(player.city as IndianCity);
        }
      }
      setValidationError(null);
      setSubmitted(false);
    }
  }, [isOpen, tournamentId, currentUser.id]);

  if (!isOpen) return null;

  const steam = playerProfile?.steam;
  const isSteamLinked = Boolean(steam);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    // Validate distinct roles
    const roleValidation = validateDotaRoles(primaryRole, secondaryRole);
    if (!roleValidation.valid) {
      setValidationError(roleValidation.error || 'Invalid roles selected.');
      return;
    }

    // Validate declared MMR
    const parsedMmr = parseInt(declaredMmr, 10);
    if (isNaN(parsedMmr) || parsedMmr < 1 || parsedMmr > 15000) {
      setValidationError('Declared MMR must be a realistic number between 1 and 15,000.');
      return;
    }

    if (!acceptedRules) {
      setValidationError('You must acknowledge and accept the tournament rules to proceed.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Submit authoritative registration
      const region = city === 'Bengaluru' || city === 'Chennai' || city === 'Hyderabad'
        ? 'South India'
        : city === 'Mumbai' || city === 'Pune' || city === 'Ahmedabad'
        ? 'West India'
        : 'North India';

      const res = await tournamentService.submitTournamentRegistration({
        tournamentId,
        userId: currentUser.id,
        ign: inGameId.trim(),
        primaryRole,
        secondaryRole,
        declaredMmr: parsedMmr,
        rulesAccepted: true,
        city,
        region
      });

      if (!res.success) {
        setValidationError(res.error || 'Failed to submit registration.');
        setIsSubmitting(false);
        return;
      }

      // 2. Backward compatibility with Test Cup engine if applicable
      if (tournamentId.includes('test-cup') || tournamentName.includes('Test Cup')) {
        try {
          testCupEngine.submitRegistration({
            username: inGameId.trim(),
            realName: inGameId.trim(),
            city,
            region,
            primaryRole,
            secondaryRole,
            mmr: parsedMmr
          });
        } catch (tcErr) {
          console.warn('Test cup bridge note:', tcErr);
        }
      }

      setExistingReg(res.registration);
      setSubmitted(true);
    } catch (err: any) {
      setValidationError(err.message || 'An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!confirm('Are you sure you want to withdraw your registration from this tournament?')) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await tournamentService.withdrawTournamentRegistration(tournamentId, currentUser.id);
      if (res.success && res.registration) {
        setExistingReg(res.registration);
      } else {
        alert(res.error || 'Failed to withdraw registration.');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to withdraw.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEvidenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceDescription.trim()) {
      setEvidenceFeedback('Please provide a brief description of your evidence.');
      return;
    }

    setIsSubmittingEvidence(true);
    setEvidenceFeedback(null);
    try {
      const res = await tournamentService.submitRegistrationEvidence(tournamentId, currentUser.id, {
        type: evidenceType,
        fileUrl: evidenceUrl.trim() || undefined,
        description: evidenceDescription.trim()
      });

      if (res.success && res.registration) {
        setExistingReg(res.registration);
        setEvidenceUrl('');
        setEvidenceDescription('');
        setEvidenceFeedback('✓ Evidence submitted successfully. Organisers have been notified.');
      } else {
        setEvidenceFeedback(res.error || 'Failed to submit evidence.');
      }
    } catch (err: any) {
      setEvidenceFeedback(err.message || 'Failed to submit evidence.');
    } finally {
      setIsSubmittingEvidence(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="bg-[#FFE600] border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between font-mono text-xs font-black shrink-0">
          <div className="flex items-center gap-2 text-black truncate">
            <Trophy className="w-4 h-4 text-[#7C3AED] shrink-0" />
            <span className="truncate">PURPLE BEAN · DOTA 2 TOURNAMENT ENTRY</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black hover:text-white border border-black transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Active Registration Display */}
        {existingReg && existingReg.status !== 'WITHDRAWN' && !submitted ? (
          <div className="p-6 sm:p-8 space-y-6 font-mono overflow-y-auto flex-1">
            <div className="bg-[#FFF9E6] border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-4">
              <div className="flex items-center justify-between gap-2 border-b-2 border-black pb-3">
                <div>
                  <span className="text-[10px] uppercase font-black text-stone-500 block">Registration Status</span>
                  <span className="text-base sm:text-lg font-black text-black uppercase">
                    {existingReg.status.replace('_', ' ')}
                  </span>
                </div>
                <span className={`px-2.5 py-1 text-xs font-black border-2 border-black uppercase ${
                  existingReg.status === 'VERIFIED' ? 'bg-[#70FFAF] text-black' :
                  existingReg.status === 'UNDER_REVIEW' ? 'bg-[#5CE1E6] text-black' :
                  existingReg.status === 'EVIDENCE_REQUESTED' ? 'bg-[#FFDE59] text-black' :
                  existingReg.status === 'REJECTED' ? 'bg-[#FF5757] text-white' :
                  'bg-[#FFE600] text-black'
                }`}>
                  {existingReg.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Applicant IGN:</span>
                  <span className="font-black text-black">{existingReg.ign}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Declared MMR:</span>
                  <span className="font-black text-black">{existingReg.declaredMmr.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Primary Role:</span>
                  <span className="font-bold text-[#7C3AED]">{existingReg.primaryRole}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Secondary Role:</span>
                  <span className="font-bold text-stone-700">{existingReg.secondaryRole}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Registered At:</span>
                  <span className="font-mono text-stone-600">
                    {new Date(existingReg.registeredAt).toLocaleDateString()} {new Date(existingReg.registeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] uppercase font-bold">Tournament:</span>
                  <span className="font-bold text-black truncate block">{tournamentName}</span>
                </div>
              </div>

              {existingReg.tournamentMmr && (
                <div className="bg-[#70FFAF]/30 border-2 border-black p-3 text-xs flex items-center justify-between">
                  <span className="font-bold">Calibrated Tournament MMR:</span>
                  <span className="font-black text-base text-black">{existingReg.tournamentMmr.toLocaleString()}</span>
                </div>
              )}

              {/* Evidence Requested Notice & Submission Form */}
              {existingReg.status === 'EVIDENCE_REQUESTED' && (
                <div className="bg-[#FFE5EC] border-2 border-[#FF70A6] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[#D90429] font-black uppercase text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>ORGANISER ACTION REQUIRED: EVIDENCE REQUESTED</span>
                  </div>
                  {existingReg.evidenceRequestPrompt && (
                    <div className="bg-white border border-black p-2.5 text-xs text-stone-800">
                      <strong className="block text-[10px] uppercase text-stone-500 mb-0.5">Referee Prompt:</strong>
                      "{existingReg.evidenceRequestPrompt}"
                    </div>
                  )}

                  <form onSubmit={handleEvidenceSubmit} className="space-y-3 pt-1">
                    <div>
                      <SelectDropdown
                        label="Evidence Category:"
                        value={evidenceType}
                        onChange={(val) => setEvidenceType(val as EvidenceType)}
                        options={[
                          { value: 'MMR_SCREENSHOT', label: 'In-Game MMR / Medal Screenshot' },
                          { value: 'STEAM_PROFILE', label: 'Steam Profile / Community Link' },
                          { value: 'TOURNAMENT_HISTORY', label: 'Prior Tournament / Match Records' },
                          { value: 'OTHER', label: 'Other Clarification' }
                        ]}
                        className="w-full"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-700 mb-1">
                        Screenshot or Resource Link (Optional):
                      </label>
                      <input
                        type="url"
                        placeholder="https://imgur.com/... or Steam profile link"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        className="w-full bg-white border border-black p-1.5 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase font-bold text-stone-700 mb-1">
                        Description / Notes (Required):
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Provide details or explain current medal calibration..."
                        value={evidenceDescription}
                        onChange={(e) => setEvidenceDescription(e.target.value)}
                        className="w-full bg-white border border-black p-1.5 text-xs"
                      />
                    </div>

                    {evidenceFeedback && (
                      <div className="p-2 border border-black bg-stone-100 text-xs font-bold">
                        {evidenceFeedback}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-stone-500 leading-tight">
                        🔒 Confidential: Visible only to you and referee team.
                      </span>
                      <button
                        type="submit"
                        disabled={isSubmittingEvidence}
                        className="bg-[#7C3AED] hover:bg-purple-700 text-white border border-black px-4 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-50"
                      >
                        {isSubmittingEvidence ? 'Submitting...' : 'Upload Evidence'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Previously Submitted Evidence History */}
              {existingReg.evidence && existingReg.evidence.length > 0 && (
                <div className="border border-black p-3 bg-stone-50 space-y-2">
                  <span className="text-[10px] font-black uppercase text-stone-600 block">
                    Submitted Evidence ({existingReg.evidence.length})
                  </span>
                  <div className="space-y-1.5">
                    {existingReg.evidence.map((ev, i) => (
                      <div key={ev.id || i} className="bg-white border border-stone-300 p-2 text-[11px]">
                        <div className="flex justify-between font-bold">
                          <span className="text-purple-700">{ev.type.replace('_', ' ')}</span>
                          <span className="text-stone-400">{new Date(ev.submittedAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-stone-700 mt-0.5">{ev.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-stone-600 leading-relaxed">
                This registration record is snapshot and locked. Organisers review your declared MMR and Steam identity against OpenDota telemetry prior to bracket drafting.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-white hover:bg-stone-100 text-[#FF5757] border-2 border-[#FF5757] font-mono text-xs font-black uppercase tracking-tight shadow-[2px_2px_0px_0px_#FF5757] cursor-pointer text-center"
              >
                Withdraw Registration
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-black text-white hover:bg-stone-800 border-2 border-black font-mono text-xs font-black uppercase tracking-tight shadow-[2px_2px_0px_0px_#000] cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        ) : submitted ? (
          /* Submission Confirmation Screen */
          <div className="p-6 sm:p-8 text-center space-y-5 font-mono overflow-y-auto flex-1">
            <div className="w-16 h-16 bg-[#70FFAF] border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] mx-auto flex items-center justify-center text-3xl font-black">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-black text-black uppercase font-sans">
                REGISTRATION SUBMITTED
              </h2>
              <p className="mt-2 text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
                Your entry for <span className="font-black text-black">{tournamentName}</span> is now recorded in Purple Bean's authoritative database.
              </p>
            </div>

            <div className="p-4 bg-[#FFF9E6] border-2 border-black text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-black/10 pb-1">
                <span className="text-stone-500">Applicant:</span>
                <span className="font-bold text-black">{inGameId}</span>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-1">
                <span className="text-stone-500">Declared MMR:</span>
                <span className="font-bold text-black">{parseInt(declaredMmr, 10).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-1">
                <span className="text-stone-500">Primary Role:</span>
                <span className="font-bold text-[#7C3AED]">{primaryRole}</span>
              </div>
              <div className="flex justify-between border-b border-black/10 pb-1">
                <span className="text-stone-500">Secondary Role:</span>
                <span className="font-bold text-stone-800">{secondaryRole}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Initial State:</span>
                <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black font-black uppercase text-[10px]">
                  REGISTERED (Awaiting Review)
                </span>
              </div>
            </div>

            <div className="text-[11px] text-stone-500 bg-stone-100 border border-black p-3 text-left space-y-1">
              <span className="font-bold text-black block">What happens next?</span>
              <span>1. Tournament referee reviews your declared MMR and Dota/OpenDota matches.</span>
              <span>2. If required, evidence (e.g. medal screenshot) will be requested.</span>
              <span>3. A locked Tournament MMR is calibrated, qualifying you for the live auction draft.</span>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-[#FFE600] hover:bg-[#FFE600]/90 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              Done & Return to Tournament
            </button>
          </div>
        ) : (
          /* Main Registration Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 font-mono text-xs">
            {/* Header info */}
            <div className="bg-[#FFF9E6] border-2 border-black p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black text-[#7C3AED]">OFFICIAL REGISTRATION</span>
                <span className="text-[10px] font-bold text-stone-600 bg-white border border-black px-1.5 py-0.5">DOTA 2 5v5</span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-black uppercase font-sans leading-tight">
                {tournamentName}
              </h2>
              <p className="text-[11px] text-stone-600">
                Double Elimination format with dedicated Indian low-latency relay servers. No KYC or payment details required to register.
              </p>
            </div>

            {/* Error banner */}
            {validationError && (
              <div className="bg-[#FF5757]/15 border-2 border-[#FF5757] p-3 text-[#FF5757] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-bold text-xs">{validationError}</span>
              </div>
            )}

            {/* In-Game Name & Steam Account */}
            <div className="space-y-4">
              <div>
                <label className="block font-black text-black uppercase text-[11px] mb-1">
                  Dota 2 In-Game Name (IGN) *
                </label>
                <input
                  type="text"
                  required
                  value={inGameId}
                  onChange={(e) => setInGameId(e.target.value)}
                  placeholder="e.g. PhantomLancer#IN"
                  className="w-full bg-white border-2 border-black px-3 py-2 font-mono text-xs text-black focus:outline-hidden focus:bg-[#FFF9E6]"
                />
              </div>

              {/* Steam Account Status Card */}
              <div className="bg-stone-50 border-2 border-black p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-black text-black uppercase text-[11px] flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#7C3AED]" />
                    Linked Steam Identity
                  </span>
                  {isSteamLinked ? (
                    <span className="bg-[#70FFAF] text-black border border-black px-1.5 py-0.2 text-[9px] font-black uppercase">
                      Connected
                    </span>
                  ) : (
                    <span className="bg-[#FFDE59] text-black border border-black px-1.5 py-0.2 text-[9px] font-black uppercase">
                      Optional for Initial Entry
                    </span>
                  )}
                </div>
                {isSteamLinked ? (
                  <div className="text-[11px] text-stone-600 flex flex-wrap items-center gap-x-3">
                    <span>Steam64: <strong className="text-black">{steam?.steamId64}</strong></span>
                    <span>Dota32: <strong className="text-black">{steam?.steamId32}</strong></span>
                    {steam?.openDotaUrl && (
                      <a 
                        href={steam.openDotaUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[#7C3AED] hover:underline flex items-center gap-0.5"
                      >
                        OpenDota <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-stone-600 flex items-center justify-between">
                    <span>No Steam account linked yet.</span>
                    {onNavigateToProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToProfile();
                        }}
                        className="text-[#7C3AED] underline font-bold cursor-pointer hover:text-black"
                      >
                        Connect in Profile →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Declared MMR */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-black text-black uppercase text-[11px]">
                  Declared MMR *
                </label>
                <span className="text-[10px] text-stone-500 font-bold">Current Solo/Party Rating</span>
              </div>
              <input
                type="number"
                required
                min={1}
                max={15000}
                value={declaredMmr}
                onChange={(e) => setDeclaredMmr(e.target.value)}
                placeholder="e.g. 7550"
                className="w-full bg-white border-2 border-black px-3 py-2 font-mono text-xs text-black focus:outline-hidden focus:bg-[#FFF9E6]"
              />
              <div className="mt-1.5 p-2 bg-stone-100 border border-stone-300 text-[10px] text-stone-600 flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#7C3AED] shrink-0 mt-0.5" />
                <span>
                  <strong>Notice:</strong> Declared MMR is player-reported. Organisers calibrate this into an audited, locked <strong>Tournament MMR</strong> during verification review.
                </span>
              </div>
            </div>

            {/* Dota Roles Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <SelectDropdown
                  label="Primary Role *"
                  value={primaryRole}
                  onChange={(val) => setPrimaryRole(val as DotaRolePosition)}
                  options={DOTA_ROLES.map((role) => ({
                    value: role,
                    label: role
                  }))}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Secondary Role *"
                  value={secondaryRole}
                  onChange={(val) => setSecondaryRole(val as DotaRolePosition)}
                  options={DOTA_ROLES.map((role) => ({
                    value: role,
                    label: role
                  }))}
                  className="w-full"
                />
              </div>
            </div>

            {primaryRole === secondaryRole && (
              <p className="text-[10px] text-[#FF5757] font-bold">
                ⚠️ Primary and Secondary roles cannot be identical. Please select different roles.
              </p>
            )}

            {/* Location */}
            <div>
              <SelectDropdown
                label="Indian City / Origin *"
                value={city}
                onChange={(val) => setCity(val as IndianCity)}
                options={INDIAN_CITIES.map((c) => ({
                  value: c,
                  label: `${c}, India`
                }))}
                className="w-full"
              />
            </div>

            {/* Rules Acknowledgement */}
            <div className="bg-stone-50 border-2 border-black p-3 space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  required
                  checked={acceptedRules}
                  onChange={(e) => setAcceptedRules(e.target.checked)}
                  className="mt-0.5 accent-black w-4 h-4 cursor-pointer"
                />
                <span className="text-stone-700 leading-snug">
                  I agree to the tournament regulations, verify my availability for the scheduled fixtures on Indian relay nodes, and acknowledge that my submitted roles and declared MMR will be snapshotted upon submission.
                </span>
              </label>
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={isSubmitting || !acceptedRules || primaryRole === secondaryRole}
              className={`w-full py-3 border-[3px] border-black font-mono text-xs font-black uppercase tracking-tight shadow-[4px_4px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer ${
                isSubmitting || !acceptedRules || primaryRole === secondaryRole
                  ? 'bg-stone-300 text-stone-500 cursor-not-allowed border-stone-400 shadow-none'
                  : 'bg-[#FFE600] hover:bg-[#FFE600]/90 text-black'
              }`}
            >
              <Flame className="w-4 h-4 text-[#7C3AED]" />
              <span>{isSubmitting ? 'Recording Registration...' : 'Register for Tournament'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
