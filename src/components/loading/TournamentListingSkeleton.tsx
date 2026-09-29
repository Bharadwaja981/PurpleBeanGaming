import React from 'react';
import { Search, ImageIcon } from 'lucide-react';

export function TournamentListingSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse select-none" aria-busy="true" aria-label="Loading tournaments">
      {/* 1. Filter Bar Skeleton (Matches Reference Image Screen 3) */}
      <div className="bg-white border-[3.5px] border-black p-4 sm:p-5 shadow-[5px_5px_0px_0px_#000] space-y-4">
        {/* Top Row: Game Badge + Search Bar Placeholder */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-9 px-4 bg-[#7C3AED]/30 border-2 border-black font-mono text-xs font-black uppercase flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <div className="h-4 w-20 bg-[#7C3AED]/40" />
            </div>
            <div className="h-9 w-28 bg-stone-100 border-2 border-black hidden md:block" />
          </div>

          <div className="flex-1 max-w-md h-10 bg-stone-50 border-2 border-black flex items-center px-3 gap-2">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <div className="h-4 w-44 bg-stone-200" />
          </div>
        </div>

        {/* Bottom Row: 4 Filter Dropdown Placeholders */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-black">
          {[1, 2, 3, 4].map((f) => (
            <div
              key={f}
              className="h-9 bg-stone-100 border-2 border-black flex items-center justify-between px-3"
            >
              <div className="h-3 w-16 bg-stone-300" />
              <div className="h-2 w-2 bg-stone-400 rotate-45" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Tournament Cards 3x2 Grid Skeleton (6 Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div
            key={idx}
            className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col justify-between"
          >
            {/* Image Banner Header */}
            <div className="w-full h-44 bg-stone-100 border-b-2 border-black relative flex items-center justify-center">
              <ImageIcon className="w-9 h-9 text-stone-300" />
              {/* Badge placeholder top-right */}
              <div className="absolute top-2 right-2 h-6 w-20 bg-stone-300 border border-black" />
            </div>

            {/* Content Details */}
            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="h-5 w-4/5 bg-stone-300 border border-black" />
                <div className="h-3 w-3/5 bg-stone-200" />
              </div>

              {/* Format & Prize Pool Bar */}
              <div className="pt-3 border-t border-stone-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 bg-stone-200" />
                  <div className="h-4 w-20 bg-[#FFE600]/40 border border-black" />
                </div>
                <div className="h-9 w-full bg-stone-200 border-2 border-black mt-2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
