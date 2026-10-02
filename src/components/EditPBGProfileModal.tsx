import React, { useState } from 'react';
import { 
  X, 
  Check, 
  AlertCircle, 
  User, 
  MapPin, 
  Swords, 
  ShieldCheck, 
  Lock,
  ChevronRight
} from 'lucide-react';
import { PBGPlayerAccount, DotaRolePosition } from '../types/pbgAccount';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';

interface EditPBGProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: PBGPlayerAccount;
  onSaved?: (account: PBGPlayerAccount) => void;
  onOpenDiscordModal?: () => void;
  onOpenSteamModal?: () => void;
}

const DOTA_ROLES: DotaRolePosition[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

export function EditPBGProfileModal({
  isOpen,
  onClose,
  account,
  onSaved,
  onOpenDiscordModal,
  onOpenSteamModal
}: EditPBGProfileModalProps) {
  const [displayName, setDisplayName] = useState(account.displayName || '');
  const [country, setCountry] = useState(account.country || 'India');
  const [region, setRegion] = useState(account.region || 'Pan India');
  const [city, setCity] = useState(account.city || 'Mumbai');
  const [declaredMmr, setDeclaredMmr] = useState(account.declaredMmr?.toString() || '');
  const [primaryRole, setPrimaryRole] = useState<DotaRolePosition | ''>(account.primaryRole || '');
  const [secondaryRole, setSecondaryRole] = useState<DotaRolePosition | ''>(account.secondaryRole || '');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Basic profile updates
    const basicRes = pbgAccountRegistry.updateBasicProfile(account.googleUid, {
      displayName: displayName.trim(),
      country: country.trim(),
      region: region.trim(),
      city: city.trim()
    });

    if (!basicRes.success) {
      setErrorMessage(basicRes.error || 'Failed to update basic profile.');
      return;
    }

    // 2. Competitive Dota updates if provided
    if (primaryRole || secondaryRole || declaredMmr) {
      if (!primaryRole || !secondaryRole) {
        setErrorMessage('Both Primary and Secondary roles must be selected.');
        return;
      }

      if (primaryRole === secondaryRole) {
        setErrorMessage('Primary and Secondary roles cannot be the same. Please choose distinct roles.');
        return;
      }

      const parsedMmr = parseInt(declaredMmr, 10);
      if (isNaN(parsedMmr) || parsedMmr < 100 || parsedMmr > 15000) {
        setErrorMessage('Declared MMR must be a valid number between 100 and 15,000.');
        return;
      }

      const dotaRes = pbgAccountRegistry.updateDotaCompetitiveInfo(account.googleUid, {
        declaredMmr: parsedMmr,
        primaryRole,
        secondaryRole
      });

      if (!dotaRes.success) {
        setErrorMessage(dotaRes.error || 'Failed to update competitive Dota info.');
        return;
      }
    }

    const updated = pbgAccountRegistry.getAccountByUid(account.googleUid);
    setSuccessMessage('PBG Profile successfully updated!');
    if (onSaved && updated) {
      onSaved(updated);
    }

    setTimeout(() => {
      onClose();
      setSuccessMessage(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5 font-mono max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#FFE600] border-2 border-black flex items-center justify-center text-black text-lg font-black shadow-[2px_2px_0px_0px_#000]">
              ✏️
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 block">
                PLAYER PROFILE SETTINGS
              </span>
              <h2 className="text-xl font-black uppercase text-black font-sans leading-none">
                Edit PBG Player Profile
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 border-2 border-black text-black cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Permanent PBG Identifier */}
        <div className="bg-black text-white p-3 flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase font-bold text-yellow-300 block">PERMANENT IDENTITY</span>
            <span className="text-sm font-black tracking-wider text-[#70FFAF] font-mono">{account.pbgId}</span>
          </div>
          <div className="text-right text-[10px] text-stone-300">
            <span>Status: </span>
            <strong className="text-[#70FFAF] uppercase font-mono">{account.accountStatus}</strong>
          </div>
        </div>

        {/* Basic Info */}
        <div className="space-y-3 text-xs">
          <strong className="text-xs font-black uppercase text-black block border-b border-black/10 pb-1">
            1. Basic Player Identity
          </strong>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">
              Display Name / Gamer Tag:
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono font-bold"
              placeholder="e.g. Bharadwaja"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">Country:</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">Region:</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">City:</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono"
              />
            </div>
          </div>
        </div>

        {/* Competitive Dota 2 Roles & MMR */}
        <div className="space-y-3 text-xs pt-2">
          <strong className="text-xs font-black uppercase text-black block border-b border-black/10 pb-1">
            2. Competitive Dota 2 Information
          </strong>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">
              Declared Tournament MMR:
            </label>
            <input
              type="number"
              min="100"
              max="15000"
              step="50"
              placeholder="e.g. 5500"
              value={declaredMmr}
              onChange={(e) => setDeclaredMmr(e.target.value)}
              className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono font-bold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">
                Primary Role:
              </label>
              <select
                value={primaryRole}
                onChange={(e) => setPrimaryRole(e.target.value as DotaRolePosition)}
                className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono font-bold cursor-pointer"
              >
                <option value="">-- Select Primary Role --</option>
                {DOTA_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-stone-600 block mb-1">
                Secondary Role (Must be distinct):
              </label>
              <select
                value={secondaryRole}
                onChange={(e) => setSecondaryRole(e.target.value as DotaRolePosition)}
                className="w-full bg-stone-50 border-2 border-black p-2 text-xs font-mono font-bold cursor-pointer"
              >
                <option value="">-- Select Secondary Role --</option>
                {DOTA_ROLES.map((role) => (
                  <option 
                    key={role} 
                    value={role}
                    disabled={role === primaryRole}
                  >
                    {role} {role === primaryRole ? '(Already selected as Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {primaryRole && secondaryRole && primaryRole === secondaryRole && (
            <p className="text-[#D90429] text-[11px] font-bold">
              ⚠️ Primary and Secondary Role cannot be the same!
            </p>
          )}
        </div>

        {/* Linked Accounts Quick Links */}
        <div className="space-y-2 text-xs pt-2">
          <strong className="text-xs font-black uppercase text-black block border-b border-black/10 pb-1">
            3. Connected Accounts
          </strong>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenDiscordModal) onOpenDiscordModal();
              }}
              className="p-3 bg-stone-50 hover:bg-stone-100 border-2 border-black text-left flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Discord Identity</span>
                <span className="text-xs font-black text-black">
                  {account.discordLinked ? `@${account.discordUsername}` : 'Not Connected'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenSteamModal) onOpenSteamModal();
              }}
              className="p-3 bg-stone-50 hover:bg-stone-100 border-2 border-black text-left flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-500 block">Steam / Dota</span>
                <span className="text-xs font-black text-black">
                  {account.dotaAccountLinked ? `Dota ID: ${account.dotaAccountId}` : 'Not Connected'}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successMessage && (
          <div className="p-3 bg-[#70FFAF] border-2 border-black text-black text-xs font-black flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white hover:bg-stone-100 border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Save PBG Profile
          </button>
        </div>

      </div>
    </div>
  );
}
