import React, { useState } from 'react';
import { getItem, getItemName, getItemImage } from '../../services/dotaConstants';

interface DotaItemIconProps {
  itemIdOrName?: number | string | null;
  size?: 'sm' | 'md' | 'lg';
  isNeutral?: boolean;
}

export function DotaItemIcon({
  itemIdOrName,
  size = 'md',
  isNeutral = false
}: DotaItemIconProps) {
  const [hasError, setHasError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Empty slot
  if (!itemIdOrName || itemIdOrName === 0 || itemIdOrName === '0') {
    return (
      <div
        className={`${
          size === 'sm' ? 'w-6 h-4.5' : size === 'lg' ? 'w-10 h-7.5' : 'w-8 h-6'
        } bg-stone-900/60 border border-stone-800 rounded-none shrink-0 opacity-40`}
      />
    );
  }

  const name = getItemName(itemIdOrName);
  const url = getItemImage(itemIdOrName);

  const sizeClass = {
    sm: 'w-6 h-4.5',
    md: 'w-8 h-6',
    lg: 'w-10 h-7.5'
  }[size];

  return (
    <div
      className="relative shrink-0 inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={`${sizeClass} ${
          isNeutral ? 'rounded-full border-amber-500' : 'rounded-none border-black'
        } border bg-black overflow-hidden flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(0,0,0,0.5)]`}
      >
        {url && !hasError ? (
          <img
            src={url}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
            loading="lazy"
          />
        ) : (
          <span className="text-[8px] font-mono font-bold text-amber-400 text-center truncate px-0.5 select-none" title={name}>
            ?
          </span>
        )}
      </div>

      {/* Hover Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black text-white text-[9px] font-mono font-bold whitespace-nowrap border border-black shadow-[2px_2px_0px_0px_#FFE600] pointer-events-none">
          {name}
          {isNeutral && <span className="text-[#FFE600] ml-1">(Neutral)</span>}
        </div>
      )}
    </div>
  );
}
