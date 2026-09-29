import React, { useState } from 'react';
import { X, Layers, Sparkles, Smartphone, Monitor, Eye, Play } from 'lucide-react';
import { AppLaunchSplashScreen } from './AppLaunchSplashScreen';
import { HomepageSkeleton } from './HomepageSkeleton';
import { TournamentListingSkeleton } from './TournamentListingSkeleton';
import { BracketDetailSkeleton } from './BracketDetailSkeleton';
import { LiveMatchSkeleton } from './LiveMatchSkeleton';
import { MobileLoadingSheet } from './MobileLoadingSheet';

interface LoadingScreenSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ScreenType = 'all' | 'splash' | 'homepage' | 'tournaments' | 'bracket' | 'match' | 'mobile';

export function LoadingScreenSystemModal({ isOpen, onClose }: LoadingScreenSystemModalProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('all');
  const [testProgress, setTestProgress] = useState(68);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-7xl bg-[#FDFBF7] border-[4px] border-black shadow-[10px_10px_0px_0px_#000] my-8 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#FFE600] border-b-[3.5px] border-black p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-black text-[#FFE600] font-mono text-[11px] font-black uppercase">
                DESIGN SYSTEM
              </span>
              <h2 className="font-sans font-black text-xl sm:text-2xl text-black uppercase tracking-tight">
                PURPLE BEAN LOADING SCREEN SYSTEM
              </h2>
            </div>
            <p className="font-mono text-xs text-black font-bold">
              Responsive loading states for web &amp; mobile · Fast loads · Smooth experiences · Always Purple Bean.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 bg-white hover:bg-black hover:text-white text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Screen Selector Tabs */}
        <div className="bg-white border-b-2 border-black p-3 flex items-center justify-between gap-2 overflow-x-auto shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveScreen('all')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'all' ? 'bg-black text-[#FFE600]' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              All 6 Screens Overview
            </button>
            <button
              onClick={() => setActiveScreen('splash')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'splash' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              1. Splash Launch
            </button>
            <button
              onClick={() => setActiveScreen('homepage')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'homepage' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              2. Homepage Skeleton
            </button>
            <button
              onClick={() => setActiveScreen('tournaments')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'tournaments' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              3. Tournaments Skeleton
            </button>
            <button
              onClick={() => setActiveScreen('bracket')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'bracket' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              4. Bracket Skeleton
            </button>
            <button
              onClick={() => setActiveScreen('match')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'match' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              5. Live Match Skeleton
            </button>
            <button
              onClick={() => setActiveScreen('mobile')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer shrink-0 ${
                activeScreen === 'mobile' ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 hover:bg-stone-100 text-black'
              }`}
            >
              6. Mobile Bottom Sheet
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-stone-500 font-bold uppercase">Simulate Progress:</span>
            <input
              type="range"
              min="0"
              max="100"
              value={testProgress}
              onChange={(e) => setTestProgress(Number(e.target.value))}
              className="w-24 accent-[#7C3AED] cursor-pointer"
            />
            <span className="font-mono font-black text-xs">{testProgress}%</span>
          </div>
        </div>

        {/* Modal Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#FAF8F5]">
          {activeScreen === 'all' && (
            <div className="space-y-8">
              {/* Header Banner */}
              <div className="bg-[#FFE600] border-[3px] border-black p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[4px_4px_0px_0px_#000]">
                <div className="flex items-center gap-2 font-mono text-xs font-black uppercase">
                  <span>⚡ 6 RESPONSIVE LOADING SCREENS EMBEDDED DIRECTLY IN PURPLE BEAN</span>
                </div>
                <span className="font-mono text-xs font-bold text-stone-700">
                  Built to match reference sheet with zero-pill neo-brutalist styling
                </span>
              </div>

              {/* Grid of All 6 Screens */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 1. Splash Screen Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      1. SPLASH / APP LAUNCH LOADING
                    </span>
                    <button
                      onClick={() => setActiveScreen('splash')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-[#FDFBF7] flex items-center justify-center p-4">
                    <div className="transform scale-[0.68] origin-center w-full">
                      <div className="w-full max-w-sm mx-auto bg-white border-[3px] border-black p-6 text-center space-y-4 shadow-[6px_6px_0px_0px_#000]">
                        <div className="w-16 h-16 rounded-full bg-[#F3E8FF] border-2 border-black mx-auto flex items-center justify-center">
                          <span className="text-2xl">🎧</span>
                        </div>
                        <h4 className="font-black text-xl uppercase">PURPLE BEAN</h4>
                        <div className="h-6 bg-stone-100 border-2 border-black p-0.5">
                          <div className="h-full bg-[#7C3AED] w-[68%]" />
                        </div>
                        <p className="font-mono text-[11px] font-bold">Loading the arena...</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Homepage Skeleton Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      2. HOMEPAGE SKELETON LOADING
                    </span>
                    <button
                      onClick={() => setActiveScreen('homepage')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-white p-3">
                    <div className="transform scale-[0.72] origin-top-left w-[138%]">
                      <HomepageSkeleton />
                    </div>
                  </div>
                </div>

                {/* 3. Tournament Listing Skeleton Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      3. TOURNAMENT LISTING LOADING
                    </span>
                    <button
                      onClick={() => setActiveScreen('tournaments')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-white p-3">
                    <div className="transform scale-[0.72] origin-top-left w-[138%]">
                      <TournamentListingSkeleton />
                    </div>
                  </div>
                </div>

                {/* 4. Bracket Detail Skeleton Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      4. BRACKET / DETAIL LOADING
                    </span>
                    <button
                      onClick={() => setActiveScreen('bracket')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-white p-3">
                    <div className="transform scale-[0.68] origin-top-left w-[147%]">
                      <BracketDetailSkeleton progress={testProgress} />
                    </div>
                  </div>
                </div>

                {/* 5. Live Match Skeleton Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      5. LIVE MATCH PAGE LOADING
                    </span>
                    <button
                      onClick={() => setActiveScreen('match')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-white p-3">
                    <div className="transform scale-[0.68] origin-top-left w-[147%]">
                      <LiveMatchSkeleton />
                    </div>
                  </div>
                </div>

                {/* 6. Mobile Loading Sheet Box */}
                <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b-2 border-black">
                    <span className="px-2 py-0.5 bg-[#7C3AED] text-white font-mono text-xs font-black">
                      6. MOBILE LOADING SCREEN (BOTTOM SHEET)
                    </span>
                    <button
                      onClick={() => setActiveScreen('mobile')}
                      className="text-xs font-mono font-bold text-[#7C3AED] hover:underline cursor-pointer"
                    >
                      Full View →
                    </button>
                  </div>
                  <div className="h-[380px] overflow-hidden relative border-2 border-black bg-stone-100 flex items-center justify-center p-4">
                    <div className="transform scale-[0.8] origin-center w-full max-w-sm">
                      <div className="w-full bg-white border-[3.5px] border-black p-5 space-y-4 shadow-[6px_6px_0px_0px_#000]">
                        <div className="w-14 h-14 rounded-full bg-[#F3E8FF] border-2 border-black mx-auto flex items-center justify-center text-xl">
                          🎧
                        </div>
                        <h4 className="font-black text-center text-lg uppercase">PURPLE BEAN</h4>
                        <div className="h-6 bg-stone-100 border-2 border-black p-0.5">
                          <div className="h-full bg-[#7C3AED] w-[72%]" />
                        </div>
                        <div className="space-y-1 font-mono text-[11px] font-bold">
                          <p>✓ Fetching tournaments...</p>
                          <p>✓ Preparing your dashboard...</p>
                          <p>○ Almost there!</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeScreen === 'splash' && (
            <div className="h-[550px] relative border-[3.5px] border-black overflow-hidden bg-[#FDFBF7]">
              <AppLaunchSplashScreen
                progress={testProgress}
                isDismissible={false}
              />
            </div>
          )}

          {activeScreen === 'homepage' && (
            <div className="p-4 bg-white border-[3.5px] border-black">
              <HomepageSkeleton />
            </div>
          )}

          {activeScreen === 'tournaments' && (
            <div className="p-4 bg-white border-[3.5px] border-black">
              <TournamentListingSkeleton />
            </div>
          )}

          {activeScreen === 'bracket' && (
            <div className="p-4 bg-white border-[3.5px] border-black">
              <BracketDetailSkeleton progress={testProgress} />
            </div>
          )}

          {activeScreen === 'match' && (
            <div className="p-4 bg-white border-[3.5px] border-black">
              <LiveMatchSkeleton />
            </div>
          )}

          {activeScreen === 'mobile' && (
            <div className="min-h-[500px] flex items-center justify-center bg-stone-200 border-[3.5px] border-black p-4">
              <div className="w-full max-w-sm bg-white border-[4px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#F3E8FF] border-2 border-black mx-auto flex items-center justify-center text-2xl shadow-[3px_3px_0px_0px_#000]">
                  🎧
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-2xl font-black uppercase">PURPLE BEAN</h3>
                  <p className="font-mono text-xs text-stone-600 font-bold">Loading your gaming world...</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-7 bg-stone-100 border-2 border-black p-0.5">
                    <div className="h-full bg-[#7C3AED] w-[72%]" />
                  </div>
                  <span className="font-mono text-xs font-black">{testProgress}%</span>
                </div>
                <div className="space-y-2 font-mono text-xs font-bold pt-2 border-t-2 border-black">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px]">✓</span>
                    <span>Fetching tournaments...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#7C3AED] text-white flex items-center justify-center text-[10px]">✓</span>
                    <span>Preparing your dashboard...</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-white border border-black flex items-center justify-center text-[10px]">○</span>
                    <span className="font-black">Almost there!</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-white border-t-2 border-black p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 font-mono text-xs">
          <div className="flex items-center gap-2 text-stone-600">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-pulse" />
            <span>ALL SKELETONS ARE EMBEDDED ACROSS ROUTES &amp; DATA QUERIES</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-black text-white hover:bg-stone-800 font-mono text-xs font-black uppercase cursor-pointer shadow-[2px_2px_0px_0px_#000]"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
