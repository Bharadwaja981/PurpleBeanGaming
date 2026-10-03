import React from 'react';
import { Sun, Moon, Palette } from 'lucide-react';
import { ColorMode, ThemePalette } from '../services/themeManager';

interface SideThemeToggleProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  currentPalette?: ThemePalette;
  onCyclePalette?: () => void;
}

/**
 * Floating Neo-Brutalist Side Dock Theme Toggle
 * Positioned on the viewport side to provide 1-click theme switching
 * with full visual fidelity matching the Purple Bean Gaming design system.
 */
export function SideThemeToggle({
  isDarkMode,
  onToggleDarkMode,
  currentPalette,
  onCyclePalette
}: SideThemeToggleProps) {
  return (
    <aside 
      aria-label="Theme Controls"
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center gap-1.5 select-none print:hidden"
    >
      {/* Quick Palette Cycler */}
      {onCyclePalette && (
        <button
          type="button"
          onClick={onCyclePalette}
          className={`h-9 px-2 sm:px-2.5 border-2 border-black flex items-center gap-1.5 font-mono text-[11px] font-black uppercase transition-all cursor-pointer shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
            isDarkMode 
              ? 'bg-[#1C1830] text-[#E4E4E7] hover:bg-[#282346] border-stone-600' 
              : 'bg-white text-black hover:bg-[#FFF9E6]'
          }`}
          title={`Cycle theme palette (${currentPalette?.name || 'Default'})`}
          aria-label="Cycle Color Palette"
        >
          <Palette className={`w-3.5 h-3.5 ${isDarkMode ? 'text-[#FFE600]' : 'text-[#7C3AED]'}`} />
          <span className="hidden md:inline truncate max-w-[80px]">
            {currentPalette?.name || 'Theme'}
          </span>
        </button>
      )}

      {/* Main Light / Dark Mode Toggle Button */}
      <button
        type="button"
        onClick={onToggleDarkMode}
        className={`h-9 px-2.5 sm:px-3 border-2 flex items-center gap-2 font-mono text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
          isDarkMode
            ? 'bg-[#1C1830] hover:bg-[#2A2449] text-[#FFE600] border-[#FFE600] shadow-[2px_2px_0px_0px_#FFE600]'
            : 'bg-[#FFE600] hover:bg-[#FFDE59] text-black border-black shadow-[2px_2px_0px_0px_#000]'
        }`}
        title={isDarkMode ? 'Currently Dark Mode — Click for Light Mode' : 'Currently Light Mode — Click for Dark Mode'}
        aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {isDarkMode ? (
          <>
            <Sun className="w-4 h-4 text-[#FFE600] fill-[#FFE600] shrink-0 animate-in spin-in-180 duration-200" />
            <span className="font-mono text-[11px] font-black">LIGHT</span>
          </>
        ) : (
          <>
            <Moon className="w-4 h-4 text-black fill-black shrink-0 animate-in spin-in-180 duration-200" />
            <span className="font-mono text-[11px] font-black">DARK</span>
          </>
        )}
      </button>
    </aside>
  );
}
