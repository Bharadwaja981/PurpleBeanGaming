import React, { useState, useEffect } from 'react';
import { Sparkles, Trophy, Users, Shield, Zap } from 'lucide-react';
import { PurpleBeanLogo } from '../PurpleBeanLogo';

interface AppLaunchSplashScreenProps {
  progress?: number;
  message?: string;
  onFinished?: () => void;
  isDismissible?: boolean;
}

const GAMING_MESSAGES = [
  'Loading the arena...',
  'Calibrating referee radar...',
  'Summoning creeps...',
  'Checking ping to Mumbai servers...',
  'Warming up Dota engines...',
  'Syncing OpenDota MMR telemetry...',
  'Securing anti-cheat audit ledger...'
];

export function AppLaunchSplashScreen({
  progress: externalProgress,
  message: externalMessage,
  onFinished,
  isDismissible = true
}: AppLaunchSplashScreenProps) {
  const [internalProgress, setInternalProgress] = useState(externalProgress ?? 15);
  const [msgIdx, setMsgIdx] = useState(0);

  // Smoothly increment progress if no static external progress provided
  useEffect(() => {
    if (externalProgress !== undefined) {
      setInternalProgress(externalProgress);
      return;
    }

    const interval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          if (onFinished) {
            setTimeout(onFinished, 400);
          }
          return 100;
        }
        const delta = Math.floor(Math.random() * 12) + 6;
        return Math.min(100, prev + delta);
      });
    }, 180);

    return () => clearInterval(interval);
  }, [externalProgress, onFinished]);

  // Rotate gaming messages
  useEffect(() => {
    if (externalMessage) return;
    const msgInterval = setInterval(() => {
      setMsgIdx((prev) => (prev + 1) % GAMING_MESSAGES.length);
    }, 900);
    return () => clearInterval(msgInterval);
  }, [externalMessage]);

  const activeMessage = externalMessage || GAMING_MESSAGES[msgIdx];
  const displayProgress = Math.min(100, Math.max(0, Math.round(internalProgress)));

  return (
    <div className="fixed inset-0 z-[100] bg-[#FDFBF7] flex flex-col items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Neo-brutalist Background Geometry Accents */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#FFE600] border-[3.5px] border-black rotate-12 -z-10 shadow-[6px_6px_0px_0px_#000]" />
      <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-[#F3E8FF] border-[3.5px] border-black -rotate-6 -z-10 shadow-[6px_6px_0px_0px_#000]" />
      <div className="absolute top-1/4 -right-8 w-24 h-24 bg-[#5CE1E6] border-[3px] border-black rotate-45 -z-10 opacity-70" />
      <div className="absolute bottom-1/4 -left-6 w-20 h-20 bg-[#FF90E8] border-[3px] border-black -rotate-12 -z-10 opacity-70" />

      {/* Main Centered Branded Launch Container (Matches Reference Image Screen 1) */}
      <div className="relative w-full max-w-lg bg-white border-[4px] border-black shadow-[10px_10px_0px_0px_#000] p-8 sm:p-12 text-center space-y-8 animate-in zoom-in-95 duration-200">
        {/* Top Mini Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFE600] text-black border-2 border-black font-mono text-[11px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_#000]">
          <Zap className="w-3 h-3 fill-black" />
          <span>PURPLE BEAN LOADING SCREEN SYSTEM</span>
        </div>

        {/* Branded Mascot Logo with Sparks and Doodles */}
        <div className="relative inline-block mx-auto py-2">
          {/* Spark Doodles Left & Right */}
          <div className="absolute -left-10 top-2 flex flex-col gap-1 text-black font-black text-lg select-none opacity-80 animate-pulse">
            <span className="rotate-[-20deg]">⚡</span>
            <span className="text-xs font-mono font-black">//</span>
          </div>
          <div className="absolute -right-10 top-2 flex flex-col gap-1 text-black font-black text-lg select-none opacity-80 animate-pulse">
            <span className="rotate-[20deg]">⚡</span>
            <span className="text-xs font-mono font-black">\\</span>
          </div>

          {/* Centered Mascot Badge */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto bg-[#F3E8FF] border-[3.5px] border-black rounded-full flex items-center justify-center shadow-[6px_6px_0px_0px_#000] group">
            {/* Mascot Headphone Bean Icon */}
            <PurpleBeanLogo size="lg" showText={false} animated={true} />

            {/* Floating Yellow Accent Orb */}
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-[#FFE600] border-2 border-black rounded-full shadow-[2px_2px_0px_0px_#000]" />
          </div>
        </div>

        {/* Title & Badge */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-black font-sans">
              PURPLE BEAN
            </h1>
            <span className="px-2.5 py-0.5 bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black shadow-[2px_2px_0px_0px_#000]">
              INDIA
            </span>
          </div>
          <p className="font-mono text-xs font-bold text-stone-500 uppercase tracking-widest">
            COMPETITIVE DOTA 2 CIRCUIT
          </p>
        </div>

        {/* Neo-brutalist Striped Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {/* The Bar Track */}
            <div className="flex-1 h-9 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] overflow-hidden p-0.5 relative">
              <div
                className="h-full border-r-2 border-black transition-all duration-200 ease-out"
                style={{
                  width: `${displayProgress}%`,
                  backgroundColor: '#7C3AED',
                  backgroundImage: 'repeating-linear-gradient(45deg, #7C3AED, #7C3AED 12px, #6D28D9 12px, #6D28D9 24px)'
                }}
              />
            </div>

            {/* Percentage Badge */}
            <div className="min-w-[64px] h-9 px-2 bg-black text-[#FFE600] border-[3px] border-black flex items-center justify-center font-mono text-sm font-black shadow-[3px_3px_0px_0px_#000]">
              {displayProgress}%
            </div>
          </div>

          {/* Dynamic Fun Messaging */}
          <div className="h-6 flex items-center justify-center">
            <p className="font-mono text-xs sm:text-sm font-black text-black tracking-tight animate-in fade-in duration-150">
              {activeMessage}
            </p>
          </div>
        </div>

        {/* Bottom Tagline with Centered Dots */}
        <div className="pt-4 border-t-2 border-black flex items-center justify-center gap-3 font-mono text-[11px] sm:text-xs font-black uppercase text-stone-700 tracking-wider">
          <span>PLAYERS</span>
          <span className="text-[#7C3AED]">•</span>
          <span>TOURNAMENTS</span>
          <span className="text-[#7C3AED]">•</span>
          <span>COMMUNITIES</span>
        </div>

        {/* Optional Skip button if stuck */}
        {isDismissible && onFinished && (
          <div className="pt-2">
            <button
              onClick={onFinished}
              className="text-[10px] font-mono font-bold text-stone-500 hover:text-black underline cursor-pointer"
            >
              Skip Loading →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
