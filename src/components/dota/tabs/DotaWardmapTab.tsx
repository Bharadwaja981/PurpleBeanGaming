import React, { useState, useMemo } from 'react';
import { EyeIcon } from '@heroicons/react/24/outline';
import { OpenDotaWardmap } from '../../../services/openDotaService';

interface DotaWardmapTabProps {
  wardmap: OpenDotaWardmap | null;
  isLoading?: boolean;
}

export function DotaWardmapTab({ wardmap, isLoading }: DotaWardmapTabProps) {
  const [wardType, setWardType] = useState<'obs' | 'sen' | 'both'>('both');

  // Parse real OpenDota ward coordinate points from API
  const { observerPoints, sentryPoints, totalObs, totalSen } = useMemo(() => {
    const obsList: Array<{ x: number; y: number; count: number }> = [];
    const senList: Array<{ x: number; y: number; count: number }> = [];
    let obsCount = 0;
    let senCount = 0;

    if (wardmap?.obs) {
      for (const [xStr, yObj] of Object.entries(wardmap.obs)) {
        const x = Number(xStr);
        if (typeof yObj === 'object' && yObj !== null) {
          for (const [yStr, cnt] of Object.entries(yObj)) {
            const y = Number(yStr);
            const count = Number(cnt || 0);
            if (count > 0 && !isNaN(x) && !isNaN(y)) {
              obsList.push({ x, y, count });
              obsCount += count;
            }
          }
        }
      }
    }

    if (wardmap?.sen) {
      for (const [xStr, yObj] of Object.entries(wardmap.sen)) {
        const x = Number(xStr);
        if (typeof yObj === 'object' && yObj !== null) {
          for (const [yStr, cnt] of Object.entries(yObj)) {
            const y = Number(yStr);
            const count = Number(cnt || 0);
            if (count > 0 && !isNaN(x) && !isNaN(y)) {
              senList.push({ x, y, count });
              senCount += count;
            }
          }
        }
      }
    }

    return {
      observerPoints: obsList,
      sentryPoints: senList,
      totalObs: obsCount,
      totalSen: senCount
    };
  }, [wardmap]);

  const hasAnyWards = observerPoints.length > 0 || sentryPoints.length > 0;

  return (
    <div className="bg-white border-[3.5px] border-black p-5 sm:p-6 shadow-[6px_6px_0px_0px_#000] space-y-6 font-mono">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <span className="text-[10px] text-stone-500 font-black uppercase tracking-wider block">
            VISION TELEMETRY &amp; HEATMAP (GET /players/&#123;account_id&#125;/wardmap)
          </span>
          <h3 className="font-sans text-xl font-black uppercase text-black">
            Wardmap &amp; Vision Density (127x127 Grid)
          </h3>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 border-2 border-black text-xs font-black uppercase">
          <button
            onClick={() => setWardType('both')}
            className={`px-3 py-1 cursor-pointer transition-all ${
              wardType === 'both' ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:bg-white'
            }`}
          >
            All Wards ({totalObs + totalSen})
          </button>
          <button
            onClick={() => setWardType('obs')}
            className={`px-3 py-1 cursor-pointer transition-all ${
              wardType === 'obs' ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:bg-white'
            }`}
          >
            Observers ({totalObs})
          </button>
          <button
            onClick={() => setWardType('sen')}
            className={`px-3 py-1 cursor-pointer transition-all ${
              wardType === 'sen' ? 'bg-[#FFE600] text-black border border-black shadow-[1px_1px_0px_0px_#000]' : 'text-stone-700 hover:bg-white'
            }`}
          >
            Sentries ({totalSen})
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-stone-600">Loading vision wardmap from OpenDota...</p>
        </div>
      ) : !hasAnyWards ? (
        <div className="p-12 bg-stone-50 border-2 border-black text-center space-y-2">
          <EyeIcon className="w-10 h-10 text-stone-400 mx-auto" />
          <h4 className="text-base font-black uppercase text-black font-sans">
            No ward placement data recorded.
          </h4>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            OpenDota requires parsed match replays to extract in-game ward coordinates (x, y). Unparsed matches do not contain vision telemetry.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Dota 2 Map Canvas Container */}
          <div className="lg:col-span-8 bg-[#11161d] border-4 border-black p-2 shadow-[6px_6px_0px_0px_#000] relative aspect-square max-w-[600px] mx-auto overflow-hidden">
            {/* Authentic Dota Minimap Background */}
            <div 
              className="w-full h-full relative bg-cover bg-center border border-black/40"
              style={{
                backgroundImage: 'url(https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/minimap/minimap.png)',
                backgroundColor: '#1b2228'
              }}
            >
              {/* Observer Wards Overlay */}
              {(wardType === 'both' || wardType === 'obs') &&
                observerPoints.map((pt, idx) => {
                  const left = Math.min(98, Math.max(2, (pt.x / 127) * 100));
                  const top = Math.min(98, Math.max(2, (1 - pt.y / 127) * 100));
                  return (
                    <div
                      key={`obs-${idx}`}
                      style={{ left: `${left}%`, top: `${top}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#FFE600] rounded-full border border-black flex items-center justify-center shadow-[0_0_8px_#FFE600] cursor-pointer hover:scale-150 transition-transform z-10"
                      title={`Observer Ward: Grid (${pt.x}, ${pt.y}) - Placed ${pt.count} times`}
                    >
                      <span className="text-[8px] font-black text-black leading-none">{pt.count}</span>
                    </div>
                  );
                })}

              {/* Sentry Wards Overlay */}
              {(wardType === 'both' || wardType === 'sen') &&
                sentryPoints.map((pt, idx) => {
                  const left = Math.min(98, Math.max(2, (pt.x / 127) * 100));
                  const top = Math.min(98, Math.max(2, (1 - pt.y / 127) * 100));
                  return (
                    <div
                      key={`sen-${idx}`}
                      style={{ left: `${left}%`, top: `${top}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-[#5CE1E6] rounded-full border border-black flex items-center justify-center shadow-[0_0_8px_#5CE1E6] cursor-pointer hover:scale-150 transition-transform z-10"
                      title={`Sentry Ward: Grid (${pt.x}, ${pt.y}) - Placed ${pt.count} times`}
                    >
                      <span className="text-[8px] font-black text-black leading-none">{pt.count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Vision Telemetry Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 bg-stone-50 border-2 border-black space-y-3 shadow-[3px_3px_0px_0px_#000]">
              <span className="font-sans font-black text-xs uppercase text-black block border-b border-black/10 pb-1.5">
                Vision Statistics Summary
              </span>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-white border border-black/20">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#FFE600] border border-black inline-block rounded-full" />
                    <strong>Observer Wards</strong>
                  </span>
                  <span className="font-black text-black">{totalObs} Placed</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white border border-black/20">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 bg-[#5CE1E6] border border-black inline-block rounded-full" />
                    <strong>Sentry Wards</strong>
                  </span>
                  <span className="font-black text-black">{totalSen} Placed</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white border border-black/20">
                  <span>Unique Coordinates</span>
                  <span className="font-black text-purple-700">{observerPoints.length + sentryPoints.length} Spots</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#FFF9E6] border-2 border-black space-y-2 shadow-[3px_3px_0px_0px_#000] text-xs">
              <span className="font-black uppercase text-black block">Coordinate System Note</span>
              <p className="text-stone-600 text-[11px] leading-relaxed">
                OpenDota normalizes in-game ward placements to Valve's 127x127 integer coordinate grid, projected onto the 7.37 competitive map.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
