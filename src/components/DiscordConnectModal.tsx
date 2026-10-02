/**
 * Purple Bean Gaming — Discord OAuth 2.0 Connection Modal
 * 
 * Clean, redirect/popup-based OAuth2 authorization without manual fields.
 */

import React, { useState } from 'react';
import { 
  X, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  Loader2, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { PBGPlayerAccount } from '../types/pbgAccount';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { 
  startDiscordOAuthFlow, 
  DiscordVerificationError 
} from '../services/discordVerificationClient';
import { auth } from '../services/firebaseConfig';

interface DiscordConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: PBGPlayerAccount;
  onLinked?: (account: PBGPlayerAccount) => void;
}

export function DiscordConnectModal({
  isOpen,
  onClose,
  account,
  onLinked
}: DiscordConnectModalProps) {
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const getIdToken = async (): Promise<string> => {
    const user = auth.currentUser;
    if (!user) throw new Error('SIGN_IN_REQUIRED');
    return await user.getIdToken(true);
  };

  const handleConnect = async () => {
    setIsAuthorizing(true);
    setErrorMessage(null);

    try {
      const result = await startDiscordOAuthFlow(getIdToken, account.pbgId);

      // Synchronize client registry with authoritative Discord identity
      const res = pbgAccountRegistry.linkDiscordAccount(account.googleUid, {
        discordUserId: result.discordUserId,
        discordUsername: result.discordUsername,
        discordDisplayName: result.discordDisplayName || account.displayName,
        globalName: result.discord?.globalName || result.discordDisplayName,
        discordAvatar: result.discord?.avatarUrl || undefined
      });

      setIsSuccess(true);
      setIsAuthorizing(false);

      if (onLinked && res.account) {
        onLinked(res.account);
      }

      setTimeout(() => {
        onClose();
        setIsSuccess(false);
      }, 1200);
    } catch (err: any) {
      setIsAuthorizing(false);
      if (err instanceof DiscordVerificationError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Discord authentication was cancelled or interrupted.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-mono animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block">
              OAUTH 2.0 PROTOCOL · IDENTIFY
            </span>
            <h3 className="font-sans text-xl font-black uppercase text-black">
              CONNECT DISCORD IDENTITY
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-100 border-2 border-red-600 text-red-950 text-xs flex items-start gap-2 shadow-[2px_2px_0px_0px_#000]">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMessage}</span>
          </div>
        )}

        {/* Success confirmation */}
        {isSuccess ? (
          <div className="py-6 px-4 bg-emerald-50 border-2 border-emerald-600 text-center space-y-2 shadow-[3px_3px_0px_0px_#000]">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h4 className="font-sans text-base font-black uppercase text-emerald-950">
              DISCORD ACCOUNT VERIFIED!
            </h4>
            <p className="text-xs text-stone-600">
              Linked to PBG ID <strong>{account.pbgId}</strong>
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Explanatory Text */}
            <p className="text-xs text-stone-700 leading-relaxed">
              Connect your Discord account to your PBG identity. You will be redirected to Discord to verify account ownership.
            </p>

            {/* Action Button */}
            <button
              type="button"
              onClick={handleConnect}
              disabled={isAuthorizing}
              className="w-full py-3.5 px-4 bg-[#5865F2] hover:bg-[#4752C4] text-white border-2 border-black font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
            >
              {isAuthorizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>REDIRECTING TO DISCORD...</span>
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>CONNECT WITH DISCORD</span>
                </>
              )}
            </button>

            {/* Security Assurances */}
            <div className="p-3 bg-stone-50 border-2 border-black space-y-2 shadow-[2px_2px_0px_0px_#000]">
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Discord ID detected automatically</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>No Discord password is shared with PurpleBeanGaming</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-black">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>One Discord account per PBG account</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
