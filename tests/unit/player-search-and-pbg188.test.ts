import { describe, it, expect } from 'vitest';
import { matchesPlayerSearch } from '../../src/utils/playerSearch';
import { normalizePlayerRecord } from '../../src/domain/tournamentDiscovery';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';
import { tournamentService } from '../../src/services/firebaseService';

describe('Player Search and PBG-000188 Database Verification', () => {
  it('correctly associates Santhosh Myana with canonical PBG-000188', () => {
    const acc = pbgAccountRegistry.getAccountByPbgId('PBG-000188');
    expect(acc).toBeDefined();
    expect(acc?.displayName).toBe('Santhosh Myana');
    expect(acc?.pbgId).toBe('PBG-000188');
    expect(acc?.email).toBe('myana.santhosh@gmail.com');
  });

  it('guarantees PBG-000188 is present in tournamentService.getPlayers()', () => {
    const players = tournamentService.getPlayers();
    const p188 = players.find(p => p.pbgId === 'PBG-000188' || p.id === 'PBG-000188');
    expect(p188).toBeDefined();
    expect(p188?.pbgId).toBe('PBG-000188');
    expect(p188?.displayName).toBe('Santhosh Myana');
    expect(p188?.city).toBe('Siddipet');
  });

  it('matches all search variations for PBG-000188', () => {
    const players = tournamentService.getPlayers();
    const p188 = players.find(p => p.pbgId === 'PBG-000188');
    expect(p188).toBeDefined();

    const validQueries = [
      'PBG-000188',
      'PGB-000188',
      'pbg-000188',
      'pgb-000188',
      'PBG 188',
      'PGB 188',
      'pbg-188',
      'pgb-188',
      '188',
      '000188',
      'pbg',
      'pgb',
      'Santhosh',
      'santhosh',
      'Santhosh Myana',
      'myana',
      'myana.santhosh@gmail.com',
      'siddipet',
      '336333581',
      '76561198296599309',
      'carry',
      'pos 1',
      '3000'
    ];

    for (const q of validQueries) {
      expect(matchesPlayerSearch(p188!, q)).toBe(true);
    }
  });

  it('matches foundational roster players like SkRossi', () => {
    const players = tournamentService.getPlayers();
    const skrossi = players.find(p => p.username === 'SkRossi');
    expect(skrossi).toBeDefined();
    expect(matchesPlayerSearch(skrossi!, 'SkRossi')).toBe(true);
    expect(matchesPlayerSearch(skrossi!, 'Ganesh')).toBe(true);
    expect(matchesPlayerSearch(skrossi!, 'Bengaluru')).toBe(true);
    expect(matchesPlayerSearch(skrossi!, '8980')).toBe(true);
    expect(matchesPlayerSearch(skrossi!, 'Morphling')).toBe(true);
  });
});
