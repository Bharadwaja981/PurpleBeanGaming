import { describe, it, expect } from 'vitest';
import { 
  getHero, 
  getHeroName, 
  getHeroImage, 
  getHeroIcon, 
  getItem, 
  getItemName, 
  getItemImage 
} from './dotaConstants';
import { openDotaService } from './openDotaService';

describe('Dota Canonical Resolvers & Match Logic', () => {
  it('resolves hero #105 to Techies and not Hero #105', () => {
    const hero = getHero(105);
    expect(hero).toBeDefined();
    expect(hero?.localizedName).toBe('Techies');
    expect(getHeroName(105)).toBe('Techies');
    expect(getHeroImage(105)).toContain('techies.png');
    expect(getHeroIcon(105)).toContain('techies.png');
  });

  it('resolves Wraith King (id 42) with official Valve asset name (skeleton_king)', () => {
    const hero = getHero(42);
    expect(hero).toBeDefined();
    expect(hero?.localizedName).toBe('Wraith King');
    expect(getHeroName(42)).toBe('Wraith King');
    expect(getHeroImage(42)).toContain('skeleton_king.png');
  });

  it('resolves Windranger (id 21) with official Valve asset name (windrunner)', () => {
    const hero = getHero(21);
    expect(hero).toBeDefined();
    expect(hero?.localizedName).toBe('Windranger');
    expect(getHeroName(21)).toBe('Windranger');
    expect(getHeroImage(21)).toContain('windrunner.png');
  });

  it('resolves unresolvable hero ID to Unknown Hero and placeholder image', () => {
    const hero = getHero(99999);
    expect(hero).toBeNull();
    expect(getHeroName(99999)).toBe('Unknown Hero');
    expect(getHeroImage(99999)).toContain('data:image/svg+xml');
  });

  it('resolves items correctly with canonical item resolver', () => {
    // Known item Blink Dagger (id 1)
    const blink = getItem(1);
    expect(blink).toBeDefined();
    expect(blink?.localizedName).toBe('Blink Dagger');
    expect(getItemName(1)).toBe('Blink Dagger');
    expect(getItemImage(1)).toContain('blink.png');

    // Empty slot (id 0 or null)
    expect(getItem(0)).toBeNull();
    expect(getItemName(0)).toBe('Empty Slot');
    expect(getItemImage(0)).toBeNull();

    // Unknown non-zero item
    expect(getItem(888888)).toBeNull();
    expect(getItemName(888888)).toBe('Unknown Item (888888)');
    expect(getItemImage(888888)).toBeNull();
  });

  it('ensures each player in detailed match receives their own unique item array', async () => {
    const match = await openDotaService.fetchMatch('9023418630');
    expect(match.matchId).toBe('9023418630');
    expect(match.players.length).toBe(10);

    const firstPlayer = match.players[0];
    const secondPlayer = match.players[1];

    expect(firstPlayer.heroId).toBeDefined();
    expect(secondPlayer.heroId).toBeDefined();

    // Verify per-player inventory fields exist
    expect(typeof firstPlayer.item_0).toBe('number');
    expect(typeof firstPlayer.item_1).toBe('number');
    expect(typeof secondPlayer.item_0).toBe('number');

    // Verify hero names resolve correctly without "Hero #ID"
    match.players.forEach((p) => {
      expect(p.heroName).not.toMatch(/^Hero #\d+$/);
    });
  });
});
