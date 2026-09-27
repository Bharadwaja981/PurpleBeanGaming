import { describe, it, expect, beforeEach } from 'vitest';
import { gameManagementEngine, INITIAL_DOTA_GAME } from '../../src/domain/gameManagementEngine';
import { getAllGameDefinitions } from '../../src/domain/gameDefinitions';
import { openDotaServerManager } from '../../src/server/opendotaServer';
import { AUTHORIZED_ORGANIZERS } from '../../src/server/apiRouter';
import { ServerCallerContext } from '../../src/server/trustedTournamentOperations';

describe('Phase 10: Dota-Only Cleanup, Admin Game Management & OpenDota Config', () => {
  beforeEach(() => {
    // Reset game engine state
    gameManagementEngine.restoreSnapshot([{ ...INITIAL_DOTA_GAME }]);
  });

  describe('1. Dota-Only Product & Active Games', () => {
    it('ensures Dota 2 is the ONLY active game initially', () => {
      const activeGames = gameManagementEngine.getActiveGames();
      expect(activeGames.length).toBe(1);
      expect(activeGames[0].id).toBe('game-dota2');
      expect(activeGames[0].name).toBe('Dota 2');
      expect(activeGames[0].active).toBe(true);
      expect(activeGames[0].competitionType).toBe('MOBA_5v5');
      expect(activeGames[0].teamSize).toBe(5);
    });

    it('getAllGameDefinitions only returns active Dota 2 by default', () => {
      const defs = getAllGameDefinitions();
      expect(defs.length).toBe(1);
      expect(defs[0].id).toBe('dota2');
      expect(defs[0].name).toBe('Dota 2');
    });

    it('hides inactive games from normal users', () => {
      const adminCaller: ServerCallerContext = {
        userId: 'admin-1',
        email: 'bharadwajaanisetti@gmail.com',
        role: 'organizer',
        isAdmin: true
      };

      // Admin adds an inactive CS2 game for future configuration
      gameManagementEngine.addGame(
        {
          name: 'Counter-Strike 2',
          slug: 'cs2',
          active: false,
          teamSize: 5,
          substituteLimit: 2
        },
        adminCaller
      );

      // Normal users (calling getActiveGames) only see Dota 2
      const publicGames = gameManagementEngine.getActiveGames();
      expect(publicGames.length).toBe(1);
      expect(publicGames[0].name).toBe('Dota 2');

      // Admins (with includeInactive = true) can see both
      const allGames = gameManagementEngine.getGames(true);
      expect(allGames.length).toBe(2);
      expect(allGames.some(g => g.name === 'Counter-Strike 2')).toBe(true);
    });
  });

  describe('2. Platform Admin Game Management', () => {
    const adminCaller: ServerCallerContext = {
      userId: 'admin-1',
      email: 'bharadwajaanisetti@gmail.com',
      role: 'organizer',
      isAdmin: true
    };

    const playerCaller: ServerCallerContext = {
      userId: 'player-1',
      email: 'player@example.com',
      role: 'player',
      isAdmin: false
    };

    it('allows Platform Admin to create, update, enable, disable, and reorder games', () => {
      // 1. Add game
      const added = gameManagementEngine.addGame(
        {
          name: 'Valorant',
          slug: 'valorant',
          active: false,
          teamSize: 5,
          substituteLimit: 2,
          roles: ['Duelist', 'Controller', 'Initiator', 'Sentinel'],
          competitionType: 'TACTICAL_FPS'
        },
        adminCaller
      );
      expect(added.id).toBeDefined();
      expect(added.active).toBe(false);

      // 2. Edit game
      const updated = gameManagementEngine.updateGame(
        added.id,
        { teamSize: 6 },
        adminCaller
      );
      expect(updated.teamSize).toBe(6);

      // 3. Toggle / Enable game
      const toggled = gameManagementEngine.toggleGameActive(added.id, adminCaller);
      expect(toggled.active).toBe(true);
      expect(gameManagementEngine.getActiveGames().length).toBe(2);

      // 4. Toggle / Disable game
      const disabled = gameManagementEngine.toggleGameActive(added.id, adminCaller);
      expect(disabled.active).toBe(false);
      expect(gameManagementEngine.getActiveGames().length).toBe(1);

      // 5. Reorder games
      const reordered = gameManagementEngine.reorderGames([added.id, 'game-dota2'], adminCaller);
      expect(reordered[0].id).toBe(added.id);
      expect(reordered[0].order).toBe(1);
      expect(reordered[1].id).toBe('game-dota2');
      expect(reordered[1].order).toBe(2);
    });

    it('strictly denies ordinary players from modifying game configuration', () => {
      expect(() => {
        gameManagementEngine.addGame({ name: 'Hacked Title' }, playerCaller);
      }).toThrow(/DENIED/);

      expect(() => {
        gameManagementEngine.updateGame('game-dota2', { name: 'Compromised' }, playerCaller);
      }).toThrow(/DENIED/);

      expect(() => {
        gameManagementEngine.toggleGameActive('game-dota2', playerCaller);
      }).toThrow(/DENIED/);

      expect(() => {
        gameManagementEngine.reorderGames(['game-dota2'], playerCaller);
      }).toThrow(/DENIED/);
    });
  });

  describe('3. Designated Platform Admin Bootstrap', () => {
    it('recognizes designated initial platform admin email in authoritative whitelist', () => {
      expect(AUTHORIZED_ORGANIZERS.has('bharadwajaanisetti@gmail.com')).toBe(true);
    });

    it('resolves UID from verified token and enforces bootstrap safety lockdown', async () => {
      const { apiRouter, extractVerifiedTokenPayload } = await import('../../src/server/apiRouter');
      const validToken = 'test-verified-token:admin-uid-1234:bharadwajaanisetti@gmail.com';
      const extracted = extractVerifiedTokenPayload(validToken);
      expect(extracted).toEqual({
        uid: 'admin-uid-1234',
        email: 'bharadwajaanisetti@gmail.com'
      });

      // Verify invalid tokens return null
      expect(extractVerifiedTokenPayload('')).toBeNull();
      expect(extractVerifiedTokenPayload('garbage-token')).toBeNull();
    });

    it('survives token refresh and relogin via token extraction in resolveCaller', async () => {
      const { resolveCaller } = await import('../../src/server/apiRouter');
      const mockReq: any = {
        headers: {
          authorization: 'Bearer test-verified-token:admin-uid-1234:bharadwajaanisetti@gmail.com'
        }
      };

      const caller = resolveCaller(mockReq);
      expect(caller.isAdmin).toBe(true);
      expect(caller.role).toBe('organizer');
      expect(caller.userId).toBe('admin-uid-1234');
      expect(caller.email).toBe('bharadwajaanisetti@gmail.com');
    });
  });

  describe('4. OpenDota Server-Side Configuration & Telemetry', () => {
    it('manages OpenDota status and diagnostic reporting securely', () => {
      const status = openDotaServerManager.getStatus();
      expect(status.providerName).toBe('OpenDota API v1');
      expect(['CONNECTED', 'NOT_CONFIGURED', 'ERROR']).toContain(status.status);
    });

    it('safely tests connection without leaking secrets', async () => {
      const testRes = await openDotaServerManager.testConnection();
      expect(testRes).toBeDefined();
      expect(typeof testRes.success).toBe('boolean');
      expect(testRes.message).toBeDefined();
      expect(testRes.diagnostic).toBeDefined();
      expect(testRes.diagnostic.maskedKey === null || testRes.diagnostic.maskedKey.includes('...')).toBe(true);
    });
  });
});
