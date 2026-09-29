import React from 'react';
import { Play, Loader2, Video, BarChart2, MapPin, Activity } from 'lucide-react';

export function LiveMatchSkeleton() {
  return (
    <div className="w-full space-y-6 select-none animate-pulse" aria-busy="true" aria-label="Loading live match">
      {/* 1. Team VS Team Header (Matches Reference Image Screen 5) */}
      <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000]">
        <div className="grid grid-cols-1 md:grid-cols-11 gap-6 items-center">
          {/* Team A */}
          <div className="md:col-span-4 flex items-center gap-4 justify-start md:justify-end text-left md:text-right">
            <div className="space-y-2 order-2 md:order-1">
              <div className="h-6 w-36 sm:w-48 bg-stone-300 border border-black ml-auto" />
              <div className="h-4 w-24 bg-stone-200 ml-auto" />
            </div>
            <div className="w-16 h-16 rounded-full bg-stone-200 border-[3px] border-black shrink-0 order-1 md:order-2" />
          </div>

          {/* Center VS & Loading Match Badge */}
          <div className="md:col-span-3 flex flex-col items-center justify-center space-y-2 py-2">
            <span className="font-sans font-black text-3xl sm:text-4xl text-black">VS</span>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F3E8FF] text-[#7C3AED] border-2 border-black font-mono text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#000]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
              <span>LOADING MATCH...</span>
            </div>
          </div>

          {/* Team B */}
          <div className="md:col-span-4 flex items-center gap-4 justify-start text-left">
            <div className="w-16 h-16 rounded-full bg-stone-200 border-[3px] border-black shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-36 sm:w-48 bg-stone-300 border border-black" />
              <div className="h-4 w-24 bg-stone-200" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Match Control Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {['LIVE', 'STATS', 'LINEUPS', 'COMMENTARY', 'MAPS'].map((tab, idx) => (
          <div
            key={tab}
            className={`px-4 py-2 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] shrink-0 ${
              idx === 0 ? 'bg-[#7C3AED] text-white' : 'bg-white text-stone-600'
            }`}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* 3. Main Stream / Arena Skeleton + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Stream / Video Player Box (16:9) */}
        <div className="lg:col-span-8 bg-black border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col">
          <div className="relative aspect-video bg-stone-900 flex items-center justify-center">
            {/* Play Button Icon Placeholder */}
            <div className="w-16 h-16 rounded-full bg-stone-800 border-2 border-stone-600 flex items-center justify-center text-stone-500">
              <Play className="w-8 h-8 fill-stone-500 text-stone-500 ml-1" />
            </div>

            {/* Bottom Live Stream Status */}
            <div className="absolute bottom-3 left-4 flex items-center gap-2 font-mono text-xs text-stone-300">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5757] animate-ping" />
              <span>Live stream loading...</span>
            </div>
          </div>
        </div>

        {/* Side Panel (Commentary & Live Log) */}
        <div className="lg:col-span-4 bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-1 border-b-2 border-black pb-2">
            <div className="h-4 w-32 bg-stone-300" />
            <div className="h-3 w-48 bg-stone-200" />
          </div>

          <div className="space-y-3 flex-1 py-2">
            {[1, 2, 3, 4, 5].map((item) => (
              <div key={item} className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-stone-200 border border-black shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 w-1/3 bg-stone-300" />
                  <div className="h-3 w-full bg-stone-100" />
                </div>
              </div>
            ))}
          </div>

          <div className="h-9 bg-stone-100 border-2 border-black p-2 flex items-center">
            <div className="h-3 w-28 bg-stone-300" />
          </div>
        </div>
      </div>

      {/* 4. Bottom Data Widgets: MATCH STATS, MAP ROTATION, RECENT EVENTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
        {/* Match Stats */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b-2 border-black font-black uppercase text-black">
            <BarChart2 className="w-4 h-4 text-[#7C3AED]" />
            <span>MATCH STATS</span>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 bg-stone-200 w-full" />
            <div className="h-3.5 bg-stone-200 w-4/5" />
            <div className="h-3.5 bg-stone-200 w-3/4" />
          </div>
        </div>

        {/* Map Rotation */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b-2 border-black font-black uppercase text-black">
            <MapPin className="w-4 h-4 text-[#7C3AED]" />
            <span>MAP ROTATION</span>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 bg-stone-200 w-full" />
            <div className="h-3.5 bg-stone-200 w-4/5" />
            <div className="h-3.5 bg-stone-200 w-2/3" />
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] space-y-3">
          <div className="flex items-center gap-1.5 pb-2 border-b-2 border-black font-black uppercase text-black">
            <Activity className="w-4 h-4 text-[#7C3AED]" />
            <span>RECENT EVENTS</span>
          </div>
          <div className="space-y-2">
            <div className="h-3.5 bg-stone-200 w-full" />
            <div className="h-3.5 bg-stone-200 w-3/4" />
            <div className="h-3.5 bg-stone-200 w-1/2" />
          </div>
        </div>
      </div>
    </div>
  );
}
