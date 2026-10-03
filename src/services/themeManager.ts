/**
 * Purple Bean Gaming — Theme & Color Mode Manager
 * Handles Light and Dark Mode toggle, system preference detection,
 * and Neo-Brutalist palette persistence across all sessions.
 */

export type ColorMode = 'light' | 'dark';

export interface ThemePalette {
  name: string;
  lightBg: string;
  darkBg: string;
  accent: string;
  tag: string;
  cardLight: string;
  cardDark: string;
}

export const PBG_PALETTES: ThemePalette[] = [
  {
    name: 'Purple Bean',
    lightBg: 'bg-[#F3E8FF]',
    darkBg: 'bg-[#0F0E17]',
    accent: 'bg-[#7C3AED]',
    tag: 'bg-[#FFE600]',
    cardLight: 'bg-white',
    cardDark: 'bg-[#181628]'
  },
  {
    name: 'Canary Punch',
    lightBg: 'bg-[#FFDE59]',
    darkBg: 'bg-[#141208]',
    accent: 'bg-[#FF5757]',
    tag: 'bg-[#5CE1E6]',
    cardLight: 'bg-white',
    cardDark: 'bg-[#1D1A10]'
  },
  {
    name: 'Cyber Mint',
    lightBg: 'bg-[#70FFAF]',
    darkBg: 'bg-[#081510]',
    accent: 'bg-[#FFDE59]',
    tag: 'bg-[#FF70A6]',
    cardLight: 'bg-white',
    cardDark: 'bg-[#102018]'
  },
  {
    name: 'Bubblegum',
    lightBg: 'bg-[#FF90E8]',
    darkBg: 'bg-[#170A14]',
    accent: 'bg-[#38EF7D]',
    tag: 'bg-[#FFDE59]',
    cardLight: 'bg-white',
    cardDark: 'bg-[#22101E]'
  },
  {
    name: 'Electric Sky',
    lightBg: 'bg-[#5CE1E6]',
    darkBg: 'bg-[#08131A]',
    accent: 'bg-[#FF90E8]',
    tag: 'bg-[#FFDE59]',
    cardLight: 'bg-white',
    cardDark: 'bg-[#101D26]'
  }
];

const THEME_MODE_KEY = 'pbg_color_mode_v1';
const PALETTE_INDEX_KEY = 'pbg_palette_index_v1';

class ThemeManager {
  private mode: ColorMode = 'light';
  private paletteIndex: number = 0;
  private listeners: Set<(mode: ColorMode, palette: ThemePalette) => void> = new Set();

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === 'undefined') return;

    // 1. Determine Initial Color Mode: Light mode is default
    const savedMode = localStorage.getItem(THEME_MODE_KEY) as ColorMode | null;
    if (savedMode === 'dark' || savedMode === 'light') {
      this.mode = savedMode;
    } else {
      this.mode = 'light';
    }

    // 2. Determine Palette Index
    const savedPalette = localStorage.getItem(PALETTE_INDEX_KEY);
    if (savedPalette) {
      const idx = parseInt(savedPalette, 10);
      if (!isNaN(idx) && idx >= 0 && idx < PBG_PALETTES.length) {
        this.paletteIndex = idx;
      }
    }

    // Apply to DOM immediately
    this.applyToDOM();
  }

  public getMode(): ColorMode {
    return this.mode;
  }

  public isDark(): boolean {
    return this.mode === 'dark';
  }

  public getPalette(): ThemePalette {
    return PBG_PALETTES[this.paletteIndex] || PBG_PALETTES[0];
  }

  public getPaletteIndex(): number {
    return this.paletteIndex;
  }

  public setMode(mode: ColorMode) {
    this.mode = mode;
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_MODE_KEY, mode);
    }
    this.applyToDOM();
    this.notify();
  }

  public toggleMode(): ColorMode {
    const nextMode = this.mode === 'dark' ? 'light' : 'dark';
    this.setMode(nextMode);
    return nextMode;
  }

  public cyclePalette(): ThemePalette {
    this.paletteIndex = (this.paletteIndex + 1) % PBG_PALETTES.length;
    if (typeof window !== 'undefined') {
      localStorage.setItem(PALETTE_INDEX_KEY, this.paletteIndex.toString());
    }
    this.applyToDOM();
    this.notify();
    return this.getPalette();
  }

  public setPaletteIndex(index: number) {
    if (index >= 0 && index < PBG_PALETTES.length) {
      this.paletteIndex = index;
      if (typeof window !== 'undefined') {
        localStorage.setItem(PALETTE_INDEX_KEY, index.toString());
      }
      this.applyToDOM();
      this.notify();
    }
  }

  private applyToDOM() {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const body = document.body;

    if (this.mode === 'dark') {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      body.classList.add('dark');
      body.setAttribute('data-theme', 'dark');
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
    }
  }

  public subscribe(listener: (mode: ColorMode, palette: ThemePalette) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.mode, this.getPalette());
      } catch (err) {
        console.error('ThemeManager listener error:', err);
      }
    });
  }
}

export const themeManager = new ThemeManager();
