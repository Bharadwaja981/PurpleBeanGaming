import React from 'react';
import { ArrowLeft, Loader2, Trophy, Users, Swords } from 'lucide-react';

interface BracketDetailSkeletonProps {
  progress?: number;
}

export function BracketDetailSkeleton({ progress = 75 }: BracketDetailSkeletonProps) {
  return (
    <div className="w-full space-y-6 select-none" aria-busy="true" aria-label="Loading tournament bracket">
      {/* 1. Header with Back Arrow and Rotating Status Pill */}
      <div className="bg-white border-[3.5px] border-black p-4 sm:p-6 shadow-[5px_5px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-stone-100 border-2 border-black flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-stone-600" />
          </div>
          <div className="space-y-1.5">
            <div className="h-6 w-56 sm:w-80 bg-stone-300 border border-black" />
            <div className="h-3 w-36 bg-stone-200" />
          </div>
        </div>

        {/* Rotating Status Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#F3E8FF] text-[#7C3AED] border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 self-start sm:self-auto">
          <Loader2 className="w-4 h-4 animate-spin text-[#7C3AED]" />
          <span>Loading Bracket...</span>
        </div>
      </div>

      {/* 2. Bracket Tree Skeleton Diagram (Matches Reference Image Screen 4) */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-10 overflow-x-auto">
        <div className="min-w-[760px] flex items-center justify-between gap-6 py-8 relative">
          {/* Left Bracket Column (Round 1 & 2) */}
          <div className="flex-1 space-y-8">
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-black uppercase text-stone-400">Quarterfinal 1</span>
              <div className="w-56 p-3 bg-stone-50 border-2 border-black space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-20 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] font-black uppercase text-stone-400">Quarterfinal 2</span>
              <div className="w-56 p-3 bg-stone-50 border-2 border-black space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
              </div>
            </div>
          </div>

          {/* Connecting SVG lines Left -> Center */}
          <div className="w-16 h-48 border-r-2 border-t-2 border-b-2 border-stone-300 hidden md:block" />

          {/* Center Grand Finals Box Skeleton */}
          <div className="flex flex-col items-center justify-center p-4 bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] w-64 space-y-3 z-10">
            <div className="w-10 h-10 rounded-full bg-[#FFE600] border-2 border-black flex items-center justify-center">
              <Trophy className="w-5 h-5 text-black" />
            </div>
            <div className="text-center space-y-1 w-full">
              <div className="h-4 w-32 bg-stone-400 border border-black mx-auto" />
              <div className="h-3 w-20 bg-stone-300 mx-auto" />
            </div>
            <div className="w-full p-2 bg-white border border-black space-y-2">
              <div className="h-3 w-3/4 bg-stone-300" />
              <div className="h-3 w-2/3 bg-stone-200" />
            </div>
          </div>

          {/* Connecting SVG lines Center -> Right */}
          <div className="w-16 h-48 border-l-2 border-t-2 border-b-2 border-stone-300 hidden md:block" />

          {/* Right Bracket Column */}
          <div className="flex-1 space-y-8">
            <div className="space-y-2">
              <span className="font-mono text-[10px] font-black uppercase text-stone-400">Quarterfinal 3</span>
              <div className="w-56 p-3 bg-stone-50 border-2 border-black space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-20 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] font-black uppercase text-stone-400">Quarterfinal 4</span>
              <div className="w-56 p-3 bg-stone-50 border-2 border-black space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-28 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="h-3.5 w-24 bg-stone-300" />
                  <div className="h-3.5 w-4 bg-stone-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Status Bar with Striped Progress & Step Indicators */}
      <div className="bg-white border-[3.5px] border-black p-4 sm:p-5 shadow-[5px_5px_0px_0px_#000] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
          <span className="font-black uppercase text-black">Preparing tournament data...</span>
          <span className="font-black text-[#7C3AED]">{progress}%</span>
        </div>

        {/* Striped Progress Bar */}
        <div className="w-full h-4 bg-stone-100 border-2 border-black p-0.5 overflow-hidden">
          <div
            className="h-full border-r border-black transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: '#7C3AED',
              backgroundImage: 'repeating-linear-gradient(45deg, #7C3AED, #7C3AED 8px, #6D28D9 8px, #6D28D9 16px)'
            }}
          />
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
          <div className="flex items-center gap-2 p-2 bg-stone-50 border border-black">
            <Users className="w-4 h-4 text-[#7C3AED]" />
            <div>
              <span className="font-black uppercase block text-[10px] text-stone-500">Teams</span>
              <span className="text-black font-bold">Loading rosters...</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-stone-50 border border-black">
            <Swords className="w-4 h-4 text-[#7C3AED]" />
            <div>
              <span className="font-black uppercase block text-[10px] text-stone-500">Matches</span>
              <span className="text-black font-bold">Mapping series...</span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 bg-[#FFFBEB] border border-black">
            <Trophy className="w-4 h-4 text-black" />
            <div>
              <span className="font-black uppercase block text-[10px] text-stone-500">Bracket</span>
              <span className="text-black font-black">Almost ready...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
