import React from 'react';
import { Check, Circle, Loader2 } from 'lucide-react';
import { PurpleBeanLogo } from '../PurpleBeanLogo';

interface MobileLoadingSheetProps {
  progress?: number;
  isOpen?: boolean;
  onClose?: () => void;
}

export function MobileLoadingSheet({
  progress = 72,
  isOpen = true,
  onClose
}: MobileLoadingSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-in fade-in duration-200">
      {/* Neo-brutalist Bottom Sheet Card (Matches Reference Image Screen 6) */}
      <div className="w-full max-w-sm sm:max-w-md bg-white border-t-[4px] sm:border-[4px] border-black shadow-[0px_-6px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000] p-6 sm:p-8 space-y-6 animate-in slide-in-from-bottom duration-250">
        {/* Grab Handle for Mobile */}
        <div className="w-12 h-1.5 bg-black mx-auto rounded-full sm:hidden" />

        {/* Mascot Avatar */}
        <div className="relative w-20 h-20 mx-auto bg-[#F3E8FF] border-[3px] border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
          <PurpleBeanLogo size="sm" showText={false} animated={true} />
          {/* Yellow Ear Accent */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#FFE600] border-2 border-black rounded-full" />
        </div>

        {/* Header Titles */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-black uppercase text-black font-sans tracking-tight">
            PURPLE BEAN
          </h2>
          <p className="font-mono text-xs font-bold text-stone-600">
            Loading your gaming world...
          </p>
        </div>

        {/* Striped Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-7 bg-stone-100 border-[2.5px] border-black shadow-[3px_3px_0px_0px_#000] overflow-hidden p-0.5">
              <div
                className="h-full border-r border-black transition-all duration-300"
                style={{
                  width: `${progress}%`,
                  backgroundColor: '#7C3AED',
                  backgroundImage: 'repeating-linear-gradient(45deg, #7C3AED, #7C3AED 10px, #6D28D9 10px, #6D28D9 20px)'
                }}
              />
            </div>
            <div className="min-w-[50px] h-7 px-2 bg-black text-[#FFE600] border-2 border-black flex items-center justify-center font-mono text-xs font-black">
              {progress}%
            </div>
          </div>
        </div>

        {/* Status Checklist (Matches Reference Image) */}
        <div className="space-y-3 font-mono text-xs font-bold pt-2 border-t-2 border-black">
          {/* Step 1: Completed */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#7C3AED] text-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_#000]">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="text-black">Fetching tournaments...</span>
          </div>

          {/* Step 2: Completed */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#7C3AED] text-white border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_#000]">
              <Check className="w-3 h-3 stroke-[3]" />
            </div>
            <span className="text-black">Preparing your dashboard...</span>
          </div>

          {/* Step 3: In Progress / Almost there */}
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-white border-2 border-black flex items-center justify-center shrink-0">
              <Loader2 className="w-3 h-3 text-[#7C3AED] animate-spin" />
            </div>
            <span className="text-black font-black">Almost there!</span>
          </div>
        </div>

        {/* Optional close/dismiss button */}
        {onClose && (
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2 bg-stone-100 hover:bg-stone-200 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              Continue to Arena
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
