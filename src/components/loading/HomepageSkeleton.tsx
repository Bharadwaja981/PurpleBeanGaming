import React from 'react';
import { ImageIcon } from 'lucide-react';

export function HomepageSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse select-none" aria-busy="true" aria-label="Loading homepage">
      {/* 1. Hero Banner Skeleton */}
      <div className="relative bg-white border-[3.5px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        {/* Yellow corner accent wedge */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-[#FFE600] border-2 border-black rotate-12 -z-0" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Text Block */}
          <div className="lg:col-span-7 space-y-4">
            {/* Title Line 1 */}
            <div className="h-10 sm:h-12 w-11/12 bg-stone-300 border-2 border-black" />
            {/* Title Line 2 */}
            <div className="h-10 sm:h-12 w-3/4 bg-stone-300 border-2 border-black" />
            {/* Title Line 3 */}
            <div className="h-6 sm:h-7 w-2/3 bg-stone-200 border-2 border-black" />

            {/* Subtitle Line */}
            <div className="pt-2 space-y-2">
              <div className="h-4 w-full bg-stone-200" />
              <div className="h-4 w-4/5 bg-stone-200" />
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex items-center gap-3">
              <div className="h-11 w-40 bg-[#7C3AED]/40 border-2 border-black shadow-[3px_3px_0px_0px_#000]" />
              <div className="h-11 w-32 bg-stone-200 border-2 border-black shadow-[3px_3px_0px_0px_#000]" />
            </div>
          </div>

          {/* Right Hero Image Box Skeleton */}
          <div className="lg:col-span-5">
            <div className="w-full h-64 sm:h-72 bg-stone-100 border-[3px] border-black shadow-[5px_5px_0px_0px_#000] flex flex-col items-center justify-center relative p-6">
              <div className="w-16 h-16 rounded-full bg-stone-200 border-2 border-black flex items-center justify-center text-stone-400">
                <ImageIcon className="w-8 h-8 text-stone-400" />
              </div>
              <div className="mt-4 h-3 w-28 bg-stone-300" />

              {/* Carousel dots skeleton */}
              <div className="absolute bottom-4 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#7C3AED] border border-black" />
                <span className="w-3 h-3 rounded-full bg-stone-300 border border-black" />
                <span className="w-3 h-3 rounded-full bg-stone-300 border border-black" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stats Matrix Row Skeleton (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex items-center gap-3"
          >
            <div className="w-11 h-11 bg-stone-200 border-2 border-black shrink-0 flex items-center justify-center" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-stone-300" />
              <div className="h-3 w-1/2 bg-stone-200" />
            </div>
          </div>
        ))}
      </div>

      {/* 3. Content Cards Grid Skeleton (3 Columns) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-7 w-48 bg-stone-300 border-2 border-black" />
          <div className="h-5 w-24 bg-stone-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((card) => (
            <div
              key={card}
              className="bg-white border-[3.5px] border-black shadow-[5px_5px_0px_0px_#000] overflow-hidden space-y-4 p-4"
            >
              {/* Card Image Banner */}
              <div className="w-full h-44 bg-stone-100 border-2 border-black flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-stone-300" />
              </div>

              {/* Card Meta & Title */}
              <div className="space-y-2">
                <div className="h-5 w-3/4 bg-stone-300 border border-black" />
                <div className="h-3 w-full bg-stone-200" />
                <div className="h-3 w-2/3 bg-stone-200" />
              </div>

              {/* Card Footer Button */}
              <div className="pt-2 border-t border-black flex items-center justify-between">
                <div className="h-4 w-20 bg-stone-200" />
                <div className="h-8 w-28 bg-[#FFE600]/40 border-2 border-black" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
