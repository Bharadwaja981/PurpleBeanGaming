import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trophy, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  User, 
  Crown, 
  Sparkles, 
  MapPin, 
  Gamepad2, 
  Loader2, 
  ArrowRight,
  HelpCircle
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { DotaRolePosition } from '../domain/dotaPlayerEngine';
import { SelectDropdown } from './ui/Dropdown';

export interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName?: string;
}

const DOTA_ROLES: DotaRolePosition[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

const MAJOR_INDIAN_CITIES = [
  'Mumbai',
  'Bengaluru',
  'Delhi NCR',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Chandigarh',
  'Pan India / Online'
];

export function RegistrationModal({
  isOpen,
  onClose,
  tournamentId,
  tournamentName
}: RegistrationModalProps) {
  const currentUser = tournamentService.getCurrentUser();
  const [ign, setIgn] = useState('');
  const [primaryRole, setPrimaryRole] = useState<DotaRolePosition>('Position 1 — Carry');
  const [secondaryRole, setSecondaryRole] = useState<DotaRolePosition>('Position 2 — Mid');
  const [declaredMmr, setDeclaredMmr] = useState<number>(5500);
  const [city, setCity] = useState('Mumbai');
  const [steamId, setSteamId] = useState('');
  const [interestedInCaptaincy, setInterestedInCaptaincy] = useState(false);
  const [captainNotes, setCaptainNotes] = useState('');
  const [rulesAccepted, setRulesAccepted] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ id: string; ign: string } | null>(null);

  // Autofill user profile if available
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessData(null);
      if (currentUser && currentUser.id !== 'guest-spectator') {
        setIgn(currentUser.ign || currentUser.displayName || '');
      } else {
        setIgn('');
      }
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!ign.trim()) {
      setErrorMessage('Please provide an In-Game Name (IGN).');
      return;
    }
    if (declaredMmr < 1 || declaredMmr > 16000) {
      setErrorMessage('Tournament MMR must be between 1 and 16,000.');
      return;
    }
    if (primaryRole === secondaryRole) {
      setErrorMessage('Primary and secondary roles must be distinct.');
      return;
    }
    if (!rulesAccepted) {
      setErrorMessage('You must accept the Tournament Integrity & Anti-Smurfing Rules.');
      return;
    }

    setIsSubmitting(true);
    try {
      const targetTourneyId = tournamentId || 'purple-bean-test-cup';
      const userId = (currentUser && currentUser.id !== 'guest-spectator') 
        ? currentUser.id 
        : `player-${Date.now().toString(36)}`;

      const res = await tournamentService.submitTournamentRegistration({
        tournamentId: targetTourneyId,
        userId,
        ign: ign.trim(),
        primaryRole,
        secondaryRole,
        declaredMmr: Number(declaredMmr),
        rulesAccepted: true,
        city,
        region: 'Pan India',
        applyingAsCaptain: interestedInCaptaincy,
        interestedInCaptaincy,
        captainNotes: interestedInCaptaincy ? captainNotes : undefined,
        captainHistory: interestedInCaptaincy ? captainNotes : undefined
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to submit tournament registration.');
      } else if (res.registration) {
        setSuccessData({
          id: res.registration.id,
          ign: res.registration.ign
        });
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'An unexpected error occurred while registering.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FFE600] border-b-[3.5px] border-black p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black text-[#FFE600] flex items-center justify-center font-black text-xl border-2 border-black">
              ⚔️
            </div>
            <div>
              <span className="font-mono text-[10px] font-black uppercase text-black/70 tracking-wider block">
                Official Tournament Entry
              </span>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-none">
                Register for {tournamentName || 'Tournament'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white hover:bg-stone-100 text-black border-2 border-black flex items-center justify-center font-black cursor-pointer shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {successData ? (
            <div className="space-y-5 text-center py-6">
              <div className="w-16 h-16 bg-[#70FFAF] border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] mx-auto flex items-center justify-center">
                <CheckCircle className="w-9 h-9 text-black" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase text-black font-sans">
                  Registration Confirmed!
                </h3>
                <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
                  Contender <span className="font-bold text-black">{successData.ign}</span> has been entered into the tournament contender pool. Reference ID: <code className="bg-stone-100 px-1 py-0.5 border border-black text-xs font-black">{successData.id}</code>
                </p>
              </div>

              {interestedInCaptaincy ? (
                <div className="bg-[#F3E8FF] border-2 border-black p-4 text-left font-mono text-xs text-stone-800 space-y-1 shadow-[3px_3px_0px_0px_#000]">
                  <div className="flex items-center gap-2 font-black text-[#7C3AED]">
                    <Crown className="w-4 h-4" />
                    <span>CAPTAINCY APPLICATION LOGGED</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    The tournament organiser will review your MMR and competitive credentials during the Captain Selection phase prior to the live purse auction draft.
                  </p>
                </div>
              ) : (
                <div className="bg-stone-50 border-2 border-black p-4 text-left font-mono text-xs text-stone-800 space-y-1 shadow-[3px_3px_0px_0px_#000]">
                  <div className="flex items-center gap-2 font-black text-black">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>READY FOR LIVE AUCTION LOT</span>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Your profile will be nominated during the live auction draft. Ensure your Steam ID is linked for automatic lobby invitation.
                  </p>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="w-full bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase py-3 shadow-[4px_4px_0px_0px_#000] cursor-pointer"
                >
                  Return to Tournament Details →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {errorMessage && (
                <div className="bg-[#FF5757] text-white border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000] font-mono text-xs font-black flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Contender Credentials Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>In-Game Name (IGN) *</span>
                  </label>
                  <input
                    type="text"
                    value={ign}
                    onChange={(e) => setIgn(e.target.value)}
                    placeholder="e.g. Miracle-, Topson, Ana"
                    className="w-full bg-stone-50 border-2 border-black px-3 py-2 font-mono text-xs font-bold text-black focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#7C3AED]"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    <span>Competitive MMR *</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="16000"
                    value={declaredMmr}
                    onChange={(e) => setDeclaredMmr(Number(e.target.value))}
                    placeholder="e.g. 6500"
                    className="w-full bg-stone-50 border-2 border-black px-3 py-2 font-mono text-xs font-bold text-black focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#7C3AED]"
                    required
                  />
                </div>
              </div>

              {/* Roles Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Primary Role *</span>
                  </label>
                  <SelectDropdown
                    value={primaryRole}
                    onChange={(val) => setPrimaryRole(val as DotaRolePosition)}
                    options={DOTA_ROLES.map((role) => ({
                      value: role,
                      label: role
                    }))}
                    className="w-full"
                    size="md"
                    mobileTitle="Select Primary Role"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <Gamepad2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Secondary Role *</span>
                  </label>
                  <SelectDropdown
                    value={secondaryRole}
                    onChange={(val) => setSecondaryRole(val as DotaRolePosition)}
                    options={DOTA_ROLES.map((role) => ({
                      value: role,
                      label: role
                    }))}
                    className="w-full"
                    size="md"
                    mobileTitle="Select Secondary Role"
                  />
                </div>
              </div>

              {/* City and Steam ID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>City / Indian Metro</span>
                  </label>
                  <SelectDropdown
                    value={city}
                    onChange={(val) => setCity(val)}
                    options={MAJOR_INDIAN_CITIES.map((c) => ({
                      value: c,
                      label: c
                    }))}
                    className="w-full"
                    size="md"
                    mobileTitle="Select City / Indian Metro"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-mono text-xs font-black uppercase text-black flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Steam ID / Friend Code</span>
                    </span>
                    <span className="text-[10px] text-stone-500 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={steamId}
                    onChange={(e) => setSteamId(e.target.value)}
                    placeholder="e.g. 112233445 or 76561198..."
                    className="w-full bg-stone-50 border-2 border-black px-3 py-2 font-mono text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Captaincy Application Option */}
              <div className="border-2 border-black p-4 bg-[#F3E8FF] space-y-3 shadow-[3px_3px_0px_0px_#000]">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={interestedInCaptaincy}
                    onChange={(e) => setInterestedInCaptaincy(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded-none border-2 border-black accent-[#7C3AED] cursor-pointer"
                  />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black">
                      <Crown className="w-4 h-4 text-[#7C3AED]" />
                      <span>Apply as Franchise Team Captain</span>
                    </div>
                    <p className="font-mono text-[11px] text-stone-700 leading-tight">
                      Captains lead team rosters, participate directly in the live purse auction draft, and manage starting credits.
                    </p>
                  </div>
                </label>

                {interestedInCaptaincy && (
                  <div className="pt-2 space-y-1.5 border-t border-black/20">
                    <label className="font-mono text-[11px] font-black uppercase text-black block">
                      Leadership Experience / Preferred Franchise Name
                    </label>
                    <textarea
                      rows={2}
                      value={captainNotes}
                      onChange={(e) => setCaptainNotes(e.target.value)}
                      placeholder="Share tournament history, scrim leadership, or draft preferences..."
                      className="w-full bg-white border-2 border-black p-2 font-mono text-xs text-black focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Rules acceptance */}
              <label className="flex items-start gap-3 cursor-pointer p-1">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(e) => setRulesAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded-none border-2 border-black accent-[#7C3AED] cursor-pointer"
                  required
                />
                <span className="font-mono text-[11px] text-stone-700 leading-snug">
                  I accept the <strong className="text-black">Purple Bean Tournament Rules</strong>, anti-smurf audit verification, and agree to participate in the live auction draft.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
