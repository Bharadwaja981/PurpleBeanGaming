import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Gamepad2, 
  Check, 
  ShieldCheck, 
  Search,
  Sparkles,
  Unlink
} from 'lucide-react';
import { PBGPlayerAccount } from '../types/pbgAccount';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { ConfirmationModal } from './ui/ConfirmationModal';

interface SteamDotaConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: PBGPlayerAccount;
  onLinked?: (account: PBGPlayerAccount) => void;
}

export function SteamDotaConnectModal({
  isOpen,
  onClose,
  account,
  onLinked
}: SteamDotaConnectModalProps) {
  const [steamInput, setSteamInput] = useState(account.dotaAccountId || account.steamId || '');
  const [dotaDisplayName, setDotaDisplayName] = useState(account.dotaDisplayName || account.displayName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [isDisconnectModalOpen, setIsDisconnectModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleLink = () => {
    if (!steamInput.trim()) {
      setErrorMessage('Please enter a 17-digit Steam64 ID, 32-bit Dota Friend ID, or Steam Community URL.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    setTimeout(() => {
      const res = pbgAccountRegistry.linkSteamDotaAccount(
        account.googleUid,
        steamInput.trim(),
        dotaDisplayName.trim() || undefined
      );

      setIsLoading(false);
      if (!res.success || !res.account) {
        setErrorMessage(res.error || 'Failed to link Steam/Dota account.');
        return;
      }

      setSuccessNotice(`Successfully linked to PBG ID: ${account.pbgId}!`);
      if (onLinked && res.account) {
        onLinked(res.account);
      }

      setTimeout(() => {
        onClose();
        setSuccessNotice(null);
      }, 1500);
    }, 700);
  };

  const handleExecuteDisconnect = () => {
    const res = pbgAccountRegistry.disconnectSteamDotaAccount(account.googleUid);
    setIsDisconnectModalOpen(false);
    if (res.success && res.account) {
      if (onLinked) onLinked(res.account);
      onClose();
    }
  };

  const handleSelectSample = (sampleId: string, sampleName: string) => {
    setSteamInput(sampleId);
    setDotaDisplayName(sampleName);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-[#171527] border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] dark:shadow-[8px_8px_0px_0px_#FFE600] p-6 space-y-5 font-mono max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-black dark:border-stone-700 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#171a21] border-2 border-black flex items-center justify-center text-white text-lg font-black shadow-[2px_2px_0px_0px_#000]">
              🎮
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                COMPETITIVE DOTA 2 IDENTITY
              </span>
              <h2 className="text-xl font-black uppercase text-black dark:text-white font-sans leading-none">
                Connect Steam &amp; Dota Account
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 border-2 border-black text-black dark:text-white cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Existing Status */}
        {account.dotaAccountLinked && (
          <div className="p-3.5 bg-emerald-50 dark:bg-[#12241b] border-2 border-emerald-600 text-black dark:text-white text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-black text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Dota Account Verified &amp; Linked
              </span>
              <span className="text-[10px] bg-black text-emerald-400 px-2 py-0.5 font-bold font-mono">
                VERIFIED
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-stone-500 dark:text-stone-400 block text-[9px]">Dota 32-bit ID:</span>
                <strong className="text-black dark:text-white font-mono">{account.dotaAccountId}</strong>
              </div>
              <div>
                <span className="text-stone-500 dark:text-stone-400 block text-[9px]">Steam64 ID:</span>
                <strong className="text-black dark:text-white font-mono truncate block">{account.steamId}</strong>
              </div>
            </div>
            {account.openDotaProfile && (
              <div className="pt-1">
                <a 
                  href={account.openDotaProfile} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-purple-700 dark:text-purple-400 hover:underline flex items-center gap-1 font-bold text-[10px]"
                >
                  <span>View OpenDota Verification Profile</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDisconnectModalOpen(true)}
                className="px-2.5 py-1 bg-white hover:bg-red-50 dark:bg-stone-900 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-600 text-[10px] font-black uppercase cursor-pointer flex items-center gap-1"
              >
                <Unlink className="w-3 h-3" />
                <span>Unlink Account</span>
              </button>
            </div>
          </div>
        )}

        {/* Identity Association Architecture */}
        <div className="bg-[#F3E8FF] dark:bg-[#251D42] border-2 border-black p-3.5 text-xs space-y-1.5 text-black dark:text-white">
          <span className="text-[9px] font-black uppercase text-purple-900 dark:text-purple-300 block">
            Central Player Identity Mapping:
          </span>
          <div className="flex items-center justify-between text-black dark:text-white font-mono font-bold text-[11px] flex-wrap gap-1">
            <span className="bg-white dark:bg-[#1a1730] border border-black px-1.5 py-0.5">{account.pbgId}</span>
            <span>↕</span>
            <span className="bg-white dark:bg-[#1a1730] border border-black px-1.5 py-0.5">Steam ID</span>
            <span>↕</span>
            <span className="bg-white dark:bg-[#1a1730] border border-black px-1.5 py-0.5">Dota 32-bit ID</span>
            <span>↕</span>
            <span className="bg-white dark:bg-[#1a1730] border border-black px-1.5 py-0.5">OpenDota</span>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[10px] font-black uppercase text-stone-700 dark:text-stone-300 block mb-1">
              Steam64 ID, Dota 32-bit ID, or Steam Community Profile URL:
            </label>
            <input
              type="text"
              placeholder="e.g. 52079950 or 76561198012345678"
              value={steamInput}
              onChange={(e) => setSteamInput(e.target.value)}
              className="w-full bg-stone-50 dark:bg-[#121020] text-black dark:text-white border-2 border-black dark:border-stone-700 p-2.5 text-xs font-mono font-bold"
            />
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block mt-1">
              You can find your Dota 32-bit ID in the Dota 2 in-game friend badge or on OpenDota.
            </span>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase text-stone-700 dark:text-stone-300 block mb-1">
              Dota In-Game Handle / Display Name (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Bharadwaja"
              value={dotaDisplayName}
              onChange={(e) => setDotaDisplayName(e.target.value)}
              className="w-full bg-stone-50 dark:bg-[#121020] text-black dark:text-white border-2 border-black dark:border-stone-700 p-2 text-xs font-mono"
            />
          </div>

          {/* Quick presets for testing */}
          <div className="bg-stone-50 dark:bg-[#161328] border border-stone-300 dark:border-stone-700 p-2.5 space-y-1.5">
            <span className="text-[9px] uppercase font-black text-stone-500 dark:text-stone-400 block flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Quick Sample Presets (For simulation &amp; testing):
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectSample('52079950', 'Miracle-')}
                className="px-2 py-0.5 bg-white dark:bg-[#1f1a3a] hover:bg-[#FFE600] dark:hover:bg-[#FFE600] text-black dark:text-white dark:hover:text-black border border-black text-[10px] font-bold cursor-pointer"
              >
                Miracle- (52079950)
              </button>
              <button
                type="button"
                onClick={() => handleSelectSample('86745912', 'Arteezy')}
                className="px-2 py-0.5 bg-white dark:bg-[#1f1a3a] hover:bg-[#FFE600] dark:hover:bg-[#FFE600] text-black dark:text-white dark:hover:text-black border border-black text-[10px] font-bold cursor-pointer"
              >
                Arteezy (86745912)
              </button>
              <button
                type="button"
                onClick={() => handleSelectSample('105248644', 'Topson')}
                className="px-2 py-0.5 bg-white dark:bg-[#1f1a3a] hover:bg-[#FFE600] dark:hover:bg-[#FFE600] text-black dark:text-white dark:hover:text-black border border-black text-[10px] font-bold cursor-pointer"
              >
                Topson (105248644)
              </button>
            </div>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] dark:text-red-300 text-xs font-black flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success Feedback */}
        {successNotice && (
          <div className="p-3 bg-[#70FFAF] border-2 border-black text-black text-xs font-black flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLink}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-black hover:bg-stone-800 text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#FFE600] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
          >
            <Gamepad2 className="w-4 h-4 text-[#FFE600]" />
            <span>{isLoading ? 'Verifying with OpenDota...' : 'Link Steam & Dota Account'}</span>
          </button>
        </div>

      </div>

      {/* Disconnect Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDisconnectModalOpen}
        onClose={() => setIsDisconnectModalOpen(false)}
        onConfirm={handleExecuteDisconnect}
        title="Unlink Steam & Dota Identity"
        subtitle="Identity Unlink · PBG Registry"
        message="Are you sure you want to disconnect this Steam & Dota account? This will remove the link between your Steam ID and PBG player profile."
        confirmLabel="YES, UNLINK"
        cancelLabel="KEEP LINKED"
        variant="danger"
        details={
          <div className="space-y-1">
            <div><span className="font-bold">PBG ID:</span> {account.pbgId}</div>
            <div><span className="font-bold">Dota ID:</span> {account.dotaAccountId || 'Not Set'}</div>
            <div><span className="font-bold">Steam ID:</span> {account.steamId || 'Not Set'}</div>
          </div>
        }
      />
    </div>
  );
}
