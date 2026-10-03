import React, { useState } from 'react';
import { 
  X, 
  Key, 
  ShieldCheck, 
  Lock, 
  User, 
  Layers, 
  Palette, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  RotateCcw
} from 'lucide-react';
import { tournamentService, PRIMARY_PROJECT_ADMIN_EMAIL } from '../services/firebaseService';
import { ViewType } from '../types/tournament';

export interface AdminCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBrandKit?: () => void;
  onNavigate?: (view: ViewType, entityId?: string) => void;
}

export function AdminCredentialsModal({
  isOpen,
  onClose,
  onOpenBrandKit,
  onNavigate
}: AdminCredentialsModalProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isPrimary = currentUser.email?.toLowerCase() === PRIMARY_PROJECT_ADMIN_EMAIL.toLowerCase();
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  if (!isOpen) return null;

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
              <Key className="w-5 h-5 text-[#FFE600]" />
            </div>
            <div>
              <span className="font-mono text-[10px] font-black uppercase text-black/70 tracking-wider block">
                Security & Role Access
              </span>
              <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-none">
                Admin Console & Credentials
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 font-mono text-xs">
          {/* Current Auth Session Card */}
          <div className="bg-stone-50 border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <span className="font-black uppercase text-black flex items-center gap-1.5">
                <User className="w-4 h-4 text-[#7C3AED]" />
                <span>Active Operator Session</span>
              </span>
              <span className={`px-2 py-0.5 border border-black font-black uppercase text-[10px] ${
                currentUser.role === 'organizer' || currentUser.isAdmin ? 'bg-[#FFE600] text-black' :
                currentUser.role === 'captain' ? 'bg-[#70FFAF] text-black' :
                'bg-stone-200 text-stone-700'
              }`}>
                Role: {currentUser.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-stone-700">
              <div>
                <span className="text-[10px] text-stone-500 uppercase block">Display Name</span>
                <span className="font-bold text-black">{currentUser.displayName || 'Guest Spectator'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase block">Auth Email</span>
                <span className="font-bold text-black">{currentUser.email || 'None (Public Guest)'}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase block">Session ID</span>
                <code className="text-[10px] text-stone-600 block truncate">{currentUser.id}</code>
              </div>
              <div>
                <span className="text-[10px] text-stone-500 uppercase block">Admin Authorization</span>
                <span className={`font-black ${isPrimary || currentUser.isAdmin ? 'text-emerald-700' : 'text-stone-500'}`}>
                  {isPrimary ? '✓ Primary Lead Organizer' : currentUser.isAdmin ? '✓ Admin Scoped' : 'Standard Access'}
                </span>
              </div>
            </div>
          </div>

          {/* Primary Lead Organiser Security Card */}
          <div className="border-2 border-black p-4 bg-[#70FFAF]/20 space-y-2.5 shadow-[3px_3px_0px_0px_#000]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-black">
                <ShieldCheck className="w-4 h-4 text-emerald-800" />
                <span className="uppercase">Canonical Lead Organiser</span>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigate('admin_dashboard');
                  }}
                  className="px-2.5 py-1 bg-[#FFE600] hover:bg-yellow-400 text-black border border-black font-black uppercase text-[10px] shadow-[1px_1px_0px_0px_#000] cursor-pointer flex items-center gap-1"
                >
                  <Key className="w-3 h-3 text-black" />
                  <span>Open Role Console →</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-stone-700 leading-relaxed">
              The primary project administrator is canonically anchored to <strong className="text-black">{PRIMARY_PROJECT_ADMIN_EMAIL}</strong>. Signing in with this Google account unlocks authoritative tournament lifecycle transitions, captain appointment approvals, and referee moderation.
            </p>
          </div>

          {/* Quick Tools & Shortcuts */}
          <div className="space-y-3">
            <span className="font-black uppercase text-black block">
              Operator Quick Tools
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {onOpenBrandKit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBrandKit();
                  }}
                  className="p-3 bg-white hover:bg-stone-50 border-2 border-black text-left flex items-center justify-between shadow-[3px_3px_0px_0px_#000] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-[#7C3AED]" />
                    <span className="font-black uppercase text-black">Brand System</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-stone-400" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  tournamentService.switchUser('00000000-0000-4000-8000-000000000001');
                  setResetNotice('Switched active session to simulated Organizer mode.');
                  setTimeout(() => setResetNotice(null), 3000);
                }}
                className="p-3 bg-white hover:bg-stone-50 border-2 border-black text-left flex items-center justify-between shadow-[3px_3px_0px_0px_#000] cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-black uppercase text-black">Organizer Simulation</span>
                </div>
                <span className="text-[10px] font-black bg-[#FFE600] px-1.5 py-0.5 border border-black">DEV</span>
              </button>
            </div>

            {resetNotice && (
              <div className="p-2 bg-[#70FFAF] text-black border border-black font-black text-center animate-in fade-in">
                {resetNotice}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-stone-50 border-t-2 border-black p-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
          >
            Close Console
          </button>
        </div>
      </div>
    </div>
  );
}
