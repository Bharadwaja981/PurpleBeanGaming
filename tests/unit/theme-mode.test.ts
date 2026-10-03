import { describe, it, expect, beforeEach } from 'vitest';
import { themeManager, PBG_PALETTES } from '../../src/services/themeManager';

// Mock storage and document for test environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

(globalThis as any).localStorage = storageMock;
(globalThis as any).window = {
  matchMedia: () => ({ matches: false, addEventListener: () => {} })
};

describe('Light and Dark Mode Theme System', () => {
  beforeEach(() => {
    localStorage.clear();
    themeManager.setMode('light');
    themeManager.setPaletteIndex(0);
  });

  it('initializes with light mode by default when no preference saved', () => {
    expect(themeManager.getMode()).toBe('light');
    expect(themeManager.isDark()).toBe(false);
  });

  it('toggles cleanly between light and dark mode', () => {
    const nextMode = themeManager.toggleMode();
    expect(nextMode).toBe('dark');
    expect(themeManager.getMode()).toBe('dark');
    expect(themeManager.isDark()).toBe(true);

    const backToLight = themeManager.toggleMode();
    expect(backToLight).toBe('light');
    expect(themeManager.getMode()).toBe('light');
    expect(themeManager.isDark()).toBe(false);
  });

  it('persists color mode preference to localStorage', () => {
    themeManager.setMode('dark');
    expect(localStorage.getItem('pbg_color_mode_v1')).toBe('dark');

    themeManager.setMode('light');
    expect(localStorage.getItem('pbg_color_mode_v1')).toBe('light');
  });

  it('cycles through esports palettes and persists selection', () => {
    const initialPalette = themeManager.getPalette();
    expect(initialPalette.name).toBe('Purple Bean');

    const nextPalette = themeManager.cyclePalette();
    expect(nextPalette.name).toBe(PBG_PALETTES[1].name);

    expect(localStorage.getItem('pbg_palette_index_v1')).toBe('1');
  });

  it('notifies subscribers upon mode or palette change', () => {
    let notifiedMode = '';
    let notifiedPalette = '';

    const unsub = themeManager.subscribe((mode, palette) => {
      notifiedMode = mode;
      notifiedPalette = palette.name;
    });

    themeManager.setMode('dark');
    expect(notifiedMode).toBe('dark');

    themeManager.cyclePalette();
    expect(notifiedPalette).toBe(PBG_PALETTES[1].name);

    unsub();
  });
});
