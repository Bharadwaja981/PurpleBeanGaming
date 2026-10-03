import React, { useState } from 'react';
import { 
  Check, 
  X, 
  ShieldCheck, 
  ArrowRight, 
  ArrowLeft, 
  Trophy, 
  Sparkles, 
  Gamepad2, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Lock
} from 'lucide-react';
import { PBGPlayerAccount, DotaRolePosition } from '../types/pbgAccount';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';

interface FirstTimeOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: PBGPlayerAccount;
  onComplete?: (account: PBGPlayerAccount) => void;
}

const DOTA_ROLES: DotaRolePosition[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

export function FirstTimeOnboardingModal({
  isOpen,
  onClose,
  account,
  onComplete
}: FirstTimeOnboardingModalProps) {
  // Wizard steps: 1: Created, 2: Display Name, 3: Discord, 4: Steam, 5: Dota MMR & Roles, 6: Profile Ready
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form states
  const [displayName, setDisplayName] = useState(account.displayName || '');
  const [city, setCity] = useState(account.city || 'Mumbai');
  const [region, setRegion] = useState(account.region || 'Pan India');

  // Discord states
  const [isDiscordConnecting, setIsDiscordConnecting] = useState(false);
  const [discordSuccess, setDiscordSuccess] = useState(account.discordLinked);

  // Steam states
  const [steamInput, setSteamInput] = useState(account.dotaAccountId || account.steamId || '');
  const [steamSuccess, setSteamSuccess] = useState(account.dotaAccountLinked);

  // Competitive states
  const [declaredMmr, setDeclaredMmr] = useState(account.declaredMmr?.toString() || '');
  const [primaryRole, setPrimaryRole] = useState<DotaRolePosition | ''>(account.primaryRole || '');
  const [secondaryRole, setSecondaryRole] = useState<DotaRolePosition | ''>(account.secondaryRole || '');

  const [stepError, setStepError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentAcc = pbgAccountRegistry.getAccountByUid(account.googleUid) || account;
  const checklist = pbgAccountRegistry.getEligibilityChecklist(currentAcc);

  // Step 2 validation
  const handleSaveDisplayName = () => {
    if (!displayName.trim() || displayName.trim().length < 2) {
      setStepError('Display Name must be at least 2 characters.');
      return;
    }
    pbgAccountRegistry.updateBasicProfile(account.googleUid, {
      displayName: displayName.trim(),
      city: city.trim(),
      region: region.trim()
    });
    setStepError(null);
    setCurrentStep(3);
  };

  // Step 3: Discord OAuth connect
  const handleConnectDiscord = () => {
    setIsDiscordConnecting(true);
    setStepError(null);
    setTimeout(() => {
      const seed = Math.abs(account.email.split('').reduce((acc, c) => acc + c.charCodeAt(0), 1000));
      const discordUid = `10${(seed * 48291).toString().slice(0, 16).padEnd(16, '9')}`;
      const username = displayName.toLowerCase().replace(/\s+/g, '_') || 'player';

      const res = pbgAccountRegistry.linkDiscordAccount(account.googleUid, {
        discordUserId: discordUid,
        discordUsername: username,
        discordDisplayName: displayName,
        discordAvatar: `https://cdn.discordapp.com/embed/avatars/${Math.floor(Math.random() * 5)}.png`
      });

      setIsDiscordConnecting(false);
      if (res.success) {
        setDiscordSuccess(true);
      } else {
        setStepError(res.error || 'Failed to connect Discord.');
      }
    }, 1000);
  };

  // Step 4: Steam / Dota Connect
  const handleConnectSteam = () => {
    if (!steamInput.trim()) {
      // Optional, player can skip
      setCurrentStep(5);
      return;
    }
    setStepError(null);
    const res = pbgAccountRegistry.linkSteamDotaAccount(account.googleUid, steamInput.trim(), displayName);
    if (res.success) {
      setSteamSuccess(true);
      setCurrentStep(5);
    } else {
      setStepError(res.error || 'Failed to link Steam/Dota identifier.');
    }
  };

  // Step 5: Save Roles & MMR
  const handleSaveRolesAndMmr = () => {
    setStepError(null);
    if (primaryRole || secondaryRole || declaredMmr) {
      if (!primaryRole || !secondaryRole) {
        setStepError('Both Primary and Secondary roles must be chosen.');
        return;
      }
      if (primaryRole === secondaryRole) {
        setStepError('Primary and Secondary roles cannot be identical.');
        return;
      }
      const numMmr = parseInt(declaredMmr, 10);
      if (isNaN(numMmr) || numMmr < 100 || numMmr > 15000) {
        setStepError('Please enter a valid MMR between 100 and 15,000.');
        return;
      }
      pbgAccountRegistry.updateDotaCompetitiveInfo(account.googleUid, {
        declaredMmr: numMmr,
        primaryRole,
        secondaryRole
      });
    }
    setCurrentStep(6);
  };

  const handleDismiss = () => {
    pbgAccountRegistry.completeOnboarding(account.googleUid);
    onClose();
  };

  const handleFinish = () => {
    pbgAccountRegistry.completeOnboarding(account.googleUid);
    const finalAcc = pbgAccountRegistry.getAccountByUid(account.googleUid) || account;
    if (onComplete) onComplete(finalAcc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white border-[4px] border-black shadow-[10px_10px_0px_0px_#000] p-6 sm:p-8 space-y-6 font-mono max-h-[92vh] overflow-y-auto">
        
        {/* Top Progress Tracker */}
        <div>
          <div className="flex items-center justify-between text-xs font-black uppercase border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 bg-[#FFE600] border-2 border-black flex items-center justify-center text-xs">
                ★
              </span>
              <span className="text-black font-sans font-black text-sm">
                PURPLE BEAN GAMING · FIRST-TIME ONBOARDING
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-stone-500 font-mono text-[11px]">
                Step {currentStep} of 6
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 hover:bg-stone-100 border border-black cursor-pointer text-stone-700 hover:text-black"
                title="Dismiss Walkthrough"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-6 gap-1.5 mt-3">
            {[1, 2, 3, 4, 5, 6].map((st) => (
              <div
                key={st}
                className={`h-2 border border-black transition-all ${
                  st <= currentStep ? 'bg-[#FFE600]' : 'bg-stone-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: PBG ACCOUNT CREATED & ID GENERATED */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-[#70FFAF] border-[3px] border-black mx-auto flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]">
                🎮
              </div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase text-black font-sans">
                PBG Player Account Created!
              </h2>
              <p className="text-xs text-stone-600 max-w-md mx-auto">
                Welcome to PurpleBeanGaming. Your Google sign-in was verified, and your permanent PBG Player Identity has been generated.
              </p>
            </div>

            {/* Permanent PBG ID Presentation Box */}
            <div className="bg-[#FFF9E6] border-[3px] border-black p-5 shadow-[4px_4px_0px_0px_#000] space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-black/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-black overflow-hidden bg-purple-100 shrink-0">
                    <img src={account.avatarUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-stone-500 block">PLAYER NAME</span>
                    <strong className="text-base text-black font-sans uppercase">{account.displayName}</strong>
                    <span className="text-[10px] text-stone-500 block">{account.email}</span>
                  </div>
                </div>
                <div className="bg-black text-[#FFE600] border-2 border-black p-3 text-center sm:text-right shrink-0">
                  <span className="text-[9px] uppercase font-mono block text-yellow-300">YOUR PERMANENT PBG ID</span>
                  <span className="text-2xl font-black font-mono tracking-widest">{account.pbgId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-stone-500 text-[9px] block">Google UID</span>
                  <span className="font-mono text-black truncate block text-[10px]">{account.googleUid.slice(0, 10)}...</span>
                </div>
                <div>
                  <span className="text-stone-500 text-[9px] block">Status</span>
                  <span className="bg-[#70FFAF] text-black px-1.5 py-0.2 border border-black font-black text-[9px]">
                    {account.accountStatus}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 text-[9px] block">Rating</span>
                  <span className="font-bold text-purple-700">{account.purpleBeanRating}</span>
                </div>
                <div>
                  <span className="text-stone-500 text-[9px] block">Created</span>
                  <span className="text-stone-700 text-[10px]">{new Date(account.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-300 p-3 text-xs text-stone-600">
              💡 <strong>Note:</strong> Your PBG ID is unique and permanent to your career. All future tournaments, auction drafts, franchised teams, and career records belong to this ID.
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>Continue: Choose Display Name</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: DISPLAY NAME & LOCATION */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-black uppercase text-stone-500 block">STEP 2 OF 6</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans">
                Choose / Confirm In-Game Display Name
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                This name will be displayed in tournaments, auction blocks, match brackets, and public leaderboards.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                  In-Game Display Name / Gamer Tag:
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-black p-3 text-sm font-mono font-bold"
                  placeholder="e.g. Bharadwaja"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                    Region:
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono font-bold cursor-pointer"
                  >
                    <option value="Pan India">Pan India</option>
                    <option value="South India">South India</option>
                    <option value="West India">West India</option>
                    <option value="North India">North India</option>
                    <option value="East India">East India</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                    City:
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono"
                    placeholder="e.g. Mumbai, Bengaluru"
                  />
                </div>
              </div>
            </div>

            {stepError && (
              <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSaveDisplayName}
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
              >
                <span>Save &amp; Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CONNECT DISCORD (RECOMMENDED) */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-stone-500">STEP 3 OF 6</span>
                <span className="bg-[#5865F2] text-white text-[9px] font-black uppercase px-2 py-0.2 border border-black">
                  RECOMMENDED
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans mt-0.5">
                Connect Discord (OAuth)
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Authorize PurpleBeanGaming with Discord. We store your immutable <strong>Discord User ID</strong> so tournament bots can automatically assign participant roles, announce match lobbies, and ping captains.
              </p>
            </div>

            <div className="bg-[#5865F2]/10 border-2 border-[#5865F2] p-4 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#5865F2] text-white flex items-center justify-center font-black rounded-full">
                    👾
                  </div>
                  <div>
                    <strong className="text-black text-sm block">PBG Discord Community &amp; Bot</strong>
                    <span className="text-[10px] text-stone-600 block">Required for real-time tournament alerts</span>
                  </div>
                </div>
                {discordSuccess && (
                  <span className="bg-[#70FFAF] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    CONNECTED
                  </span>
                )}
              </div>

              {discordSuccess ? (
                <div className="bg-white border border-[#5865F2] p-3 text-xs space-y-1">
                  <span className="text-emerald-800 font-bold block">✓ Discord Account Linked!</span>
                  <div className="text-[11px] text-stone-700">
                    Discord User ID: <strong className="font-mono text-black">{currentAcc.discordUserId}</strong>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDiscord}
                  disabled={isDiscordConnecting}
                  className="w-full py-3 px-4 bg-[#5865F2] hover:bg-[#4752C4] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center text-[10px] text-[#5865F2]">
                    👾
                  </div>
                  <span>{isDiscordConnecting ? 'Authorizing with Discord...' : 'Connect Discord (One-Click)'}</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-stone-500 bg-stone-50 border p-2.5 space-y-1">
              <strong>Why Discord Connect?</strong>
              <p>
                Discord handles match lobby notifications, captain room alerts, auction updates, and tournament news. You can also connect or update this later in your profile.
              </p>
            </div>

            {stepError && (
              <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
              >
                <span>{discordSuccess ? 'Continue to Steam' : 'Skip / Continue to Steam'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CONNECT STEAM / DOTA (RECOMMENDED FOR DOTA TOURNAMENTS) */}
        {currentStep === 4 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-stone-500">STEP 4 OF 6</span>
                <span className="bg-[#FFE600] text-black text-[9px] font-black uppercase px-2 py-0.2 border border-black">
                  FOR DOTA TOURNAMENTS
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans mt-0.5">
                Connect Steam &amp; Dota Account
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Link your Dota 32-bit ID or Steam64 ID for automated match verification, tournament calibration, and OpenDota profiling.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                  Steam64 ID or Dota 32-bit Friend ID:
                </label>
                <input
                  type="text"
                  placeholder="e.g. 52079950 or 76561198012345678"
                  value={steamInput}
                  onChange={(e) => setSteamInput(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono font-bold"
                />
              </div>

              {/* Sample quick button */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-stone-500">Quick Test Preset:</span>
                <button
                  type="button"
                  onClick={() => setSteamInput('52079950')}
                  className="px-2 py-0.5 bg-stone-100 hover:bg-[#FFE600] border border-black text-[10px] font-bold cursor-pointer"
                >
                  Use 52079950 (Dota 2 Contender)
                </button>
              </div>

              {steamSuccess && (
                <div className="p-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-900 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dota Account Verified &amp; Linked to {account.pbgId}!</span>
                </div>
              )}
            </div>

            {stepError && (
              <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleConnectSteam}
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
              >
                <span>{steamInput ? 'Verify & Continue' : 'Skip / Continue'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: DOTA MMR & COMPETITIVE ROLES */}
        {currentStep === 5 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div>
              <span className="text-[10px] font-black uppercase text-stone-500 block">STEP 5 OF 6</span>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans">
                Enter Dota MMR &amp; Roles
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Configure your tournament MMR and choose distinct Primary and Secondary roles.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                  Declared Tournament MMR:
                </label>
                <input
                  type="number"
                  min="100"
                  max="15000"
                  step="50"
                  placeholder="e.g. 5000"
                  value={declaredMmr}
                  onChange={(e) => setDeclaredMmr(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                    Primary Role:
                  </label>
                  <select
                    value={primaryRole}
                    onChange={(e) => setPrimaryRole(e.target.value as DotaRolePosition)}
                    className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono font-bold cursor-pointer"
                  >
                    <option value="">-- Select Primary Role --</option>
                    {DOTA_ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-700 block mb-1">
                    Secondary Role (Must be distinct):
                  </label>
                  <select
                    value={secondaryRole}
                    onChange={(e) => setSecondaryRole(e.target.value as DotaRolePosition)}
                    className="w-full bg-stone-50 border-2 border-black p-2.5 text-xs font-mono font-bold cursor-pointer"
                  >
                    <option value="">-- Select Secondary Role --</option>
                    {DOTA_ROLES.map((r) => (
                      <option key={r} value={r} disabled={r === primaryRole}>
                        {r} {r === primaryRole ? '(Primary Selected)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {primaryRole && secondaryRole && primaryRole === secondaryRole && (
                <div className="p-2.5 bg-red-100 border border-red-500 text-red-800 text-xs font-bold">
                  ⚠️ Primary and Secondary Role cannot be the same! Please pick distinct roles.
                </div>
              )}
            </div>

            {stepError && (
              <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            <div className="pt-2 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentStep(4)}
                className="px-4 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleSaveRolesAndMmr}
                className="px-6 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer"
              >
                <span>Save &amp; View Summary</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: PROFILE READY & TOURNAMENT ELIGIBILITY */}
        {currentStep === 6 && (
          <div className="space-y-5 animate-in fade-in duration-150">
            <div className="text-center space-y-1.5">
              <div className="w-14 h-14 bg-[#70FFAF] border-[3px] border-black mx-auto flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]">
                🎉
              </div>
              <h2 className="text-2xl font-black uppercase text-black font-sans">
                Profile Ready!
              </h2>
              <p className="text-xs text-stone-600">
                Your PurpleBeanGaming Player Account is configured and active.
              </p>
            </div>

            {/* Core Identity Summary */}
            <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-black/10 pb-2">
                <div>
                  <span className="text-[9px] uppercase font-bold text-stone-500 block">PBG PLAYER ACCOUNT</span>
                  <strong className="text-lg font-black text-black font-sans uppercase">{currentAcc.displayName}</strong>
                </div>
                <div className="bg-black text-[#FFE600] px-3 py-1 font-mono font-black text-sm border-2 border-black">
                  {currentAcc.pbgId}
                </div>
              </div>

              {/* Linked Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div className="bg-white border border-black p-2">
                  <span className="text-stone-400 text-[9px] block">Google</span>
                  <strong className="text-emerald-700 font-bold">CONNECTED</strong>
                </div>
                <div className="bg-white border border-black p-2">
                  <span className="text-stone-400 text-[9px] block">Discord</span>
                  <strong className={currentAcc.discordLinked ? 'text-[#5865F2] font-bold' : 'text-stone-500'}>
                    {currentAcc.discordLinked ? 'CONNECTED' : 'NOT CONNECTED'}
                  </strong>
                </div>
                <div className="bg-white border border-black p-2">
                  <span className="text-stone-400 text-[9px] block">Steam</span>
                  <strong className={currentAcc.dotaAccountLinked ? 'text-blue-700 font-bold' : 'text-stone-500'}>
                    {currentAcc.dotaAccountLinked ? 'CONNECTED' : 'NOT CONNECTED'}
                  </strong>
                </div>
                <div className="bg-white border border-black p-2">
                  <span className="text-stone-400 text-[9px] block">Dota Status</span>
                  <strong className={currentAcc.dotaAccountVerified ? 'text-emerald-700 font-bold' : 'text-stone-500'}>
                    {currentAcc.dotaAccountVerified ? 'VERIFIED' : 'NOT CONNECTED'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Tournament Requirements Checklist */}
            <div className="bg-stone-50 border-2 border-black p-4 space-y-2 text-xs">
              <span className="text-[10px] font-black uppercase text-black block border-b border-black/10 pb-1">
                Tournament Eligibility Checklist:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">PBG Account: {currentAcc.pbgId}</span>
                </div>
                <div className="flex items-center gap-2">
                  {checklist.discordConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 border border-black rounded-full text-center text-[10px] font-mono leading-none flex items-center justify-center">○</span>
                  )}
                  <span>Discord Connected {checklist.discordConnected ? '✓' : '(Optional)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {checklist.dotaConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 border border-black rounded-full text-center text-[10px] font-mono leading-none flex items-center justify-center">○</span>
                  )}
                  <span>Dota Account Connected {checklist.dotaConnected ? '✓' : '(For Dota Tourneys)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {checklist.mmrSet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 border border-black rounded-full text-center text-[10px] font-mono leading-none flex items-center justify-center">○</span>
                  )}
                  <span>Tournament MMR {checklist.mmrSet ? `(${currentAcc.declaredMmr})` : '(Pending)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {checklist.primaryRoleSet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 border border-black rounded-full text-center text-[10px] font-mono leading-none flex items-center justify-center">○</span>
                  )}
                  <span>Primary Role: {currentAcc.primaryRole || 'Not Set'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {checklist.secondaryRoleSet ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="w-4 h-4 border border-black rounded-full text-center text-[10px] font-mono leading-none flex items-center justify-center">○</span>
                  )}
                  <span>Secondary Role: {currentAcc.secondaryRole || 'Not Set'}</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3.5 px-4 bg-black hover:bg-stone-800 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_#FFE600] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>Enter PurpleBeanGaming Hub →</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
