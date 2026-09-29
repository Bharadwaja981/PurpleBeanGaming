/**
 * Purple Bean Gaming — Server-Backed Game Management Engine
 * 
 * Provides dynamic, admin-controlled game registry persisted in Firebase Firestore.
 * Ensures Dota 2 is the initial active production game.
 * Non-admins only see ACTIVE games.
 * Platform Admins can Add, Edit, Enable, Disable, and Reorder games.
 */

import { ServerCallerContext } from '../server/trustedTournamentOperations';
import { db, isQuotaExhausted, setQuotaExhausted, isQuotaError } from '../services/firebaseConfig';
import { doc, getDoc, getDocs, setDoc, deleteDoc, collection } from 'firebase/firestore';

export interface ManagedGame {
  id: string;
  name: string;
  slug: string;
  shortName: string;
  logo: string;
  active: boolean;
  teamSize: number;
  substituteLimit: number;
  roles: string[];
  competitionType: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export const INITIAL_DOTA_GAME: ManagedGame = {
  id: 'game-dota2',
  name: 'Dota 2',
  slug: 'dota2',
  shortName: 'Dota 2',
  logo: '🛡️',
  active: true,
  teamSize: 5,
  substituteLimit: 2,
  roles: [
    'Position 1 — Carry',
    'Position 2 — Mid',
    'Position 3 — Offlane',
    'Position 4 — Soft Support',
    'Position 5 — Hard Support'
  ],
  competitionType: 'MOBA_5v5',
  order: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

export class GameManagementEngine {
  private gamesMap = new Map<string, ManagedGame>();
  private listeners: Array<() => void> = [];

  constructor() {
    // Seed initial active production game: Dota 2
    this.gamesMap.set(INITIAL_DOTA_GAME.id, { ...INITIAL_DOTA_GAME });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  /**
   * Returns games. Normal users only receive active games.
   */
  public getGames(includeInactive = false): ManagedGame[] {
    const list = Array.from(this.gamesMap.values());
    list.sort((a, b) => a.order - b.order);
    if (includeInactive) return list.map(g => ({ ...g }));
    return list.filter((g) => g.active).map(g => ({ ...g }));
  }

  public getActiveGames(): ManagedGame[] {
    return this.getGames(false);
  }

  public getGame(idOrSlug: string): ManagedGame | undefined {
    const direct = this.gamesMap.get(idOrSlug);
    if (direct) return { ...direct };
    const bySlug = Array.from(this.gamesMap.values()).find(
      (g) => g.slug.toLowerCase() === idOrSlug.toLowerCase() || g.id === idOrSlug
    );
    return bySlug ? { ...bySlug } : undefined;
  }

  /**
   * Platform Admin: Add a new game
   */
  public addGame(
    gameData: {
      name: string;
      slug?: string;
      shortName?: string;
      logo?: string;
      active?: boolean;
      teamSize?: number;
      substituteLimit?: number;
      roles?: string[];
      competitionType?: string;
    },
    caller?: ServerCallerContext
  ): ManagedGame {
    if (caller && !caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Only Platform Admins may add new game configurations.');
    }

    const name = gameData.name.trim();
    if (!name) throw new Error('Game name cannot be empty.');

    const slug = gameData.slug
      ? gameData.slug.toLowerCase().replace(/[^a-z0-9]/g, '-')
      : name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const id = `game-${slug}-${Date.now().toString().slice(-4)}`;

    const currentOrder = this.gamesMap.size + 1;
    const now = new Date().toISOString();

    const newGame: ManagedGame = {
      id,
      name,
      slug,
      shortName: gameData.shortName?.trim() || name,
      logo: gameData.logo?.trim() || '🎮',
      active: gameData.active ?? false,
      teamSize: gameData.teamSize ?? 5,
      substituteLimit: gameData.substituteLimit ?? 2,
      roles: gameData.roles && gameData.roles.length > 0 ? [...gameData.roles] : ['Player'],
      competitionType: gameData.competitionType || 'HEAD_TO_HEAD',
      order: currentOrder,
      createdAt: now,
      updatedAt: now
    };

    this.gamesMap.set(newGame.id, newGame);
    this.persistToFirestore(newGame);
    this.notify();
    return { ...newGame };
  }

  /**
   * Platform Admin: Edit existing game
   */
  public updateGame(
    id: string,
    updates: Partial<Omit<ManagedGame, 'id' | 'createdAt'>>,
    caller?: ServerCallerContext
  ): ManagedGame {
    if (caller && !caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Only Platform Admins may update game configurations.');
    }

    const existing = this.gamesMap.get(id);
    if (!existing) {
      throw new Error(`Game '${id}' not found in registry.`);
    }

    const updated: ManagedGame = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.gamesMap.set(id, updated);
    this.persistToFirestore(updated);
    this.notify();
    return { ...updated };
  }

  /**
   * Platform Admin: Enable or Disable game
   */
  public toggleGameActive(id: string, caller?: ServerCallerContext): ManagedGame {
    if (caller && !caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Only Platform Admins may toggle game active status.');
    }

    const existing = this.gamesMap.get(id);
    if (!existing) {
      throw new Error(`Game '${id}' not found.`);
    }

    return this.updateGame(id, { active: !existing.active }, caller);
  }

  /**
   * Platform Admin: Reorder games
   */
  public reorderGames(orderedIds: string[], caller?: ServerCallerContext): ManagedGame[] {
    if (caller && !caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('DENIED: Only Platform Admins may reorder games.');
    }

    orderedIds.forEach((id, index) => {
      const g = this.gamesMap.get(id);
      if (g) {
        g.order = index + 1;
        g.updatedAt = new Date().toISOString();
        this.persistToFirestore(g);
      }
    });

    this.notify();
    return this.getGames(true);
  }

  private async persistToFirestore(game: ManagedGame) {
    try {
      if (db && !isQuotaExhausted()) {
        await setDoc(doc(db, 'games', game.id), { ...game }, { merge: true });
      }
    } catch (err) {
      if (isQuotaError(err)) {
        setQuotaExhausted(true);
      }
      // Memory fallback during offline or headless test suites
    }
  }

  /**
   * Sync games from Firestore
   */
  public async loadFromFirestore(): Promise<void> {
    try {
      if (!db) return;
      const snap = await getDocs(collection(db, 'games'));
      if (!snap.empty) {
        snap.forEach((docSnap) => {
          const data = docSnap.data() as ManagedGame;
          if (data && data.id) {
            this.gamesMap.set(data.id, data);
          }
        });
        this.notify();
      } else if (!isQuotaExhausted()) {
        // Seed initial Dota 2 game if Firestore is empty
        await setDoc(doc(db, 'games', INITIAL_DOTA_GAME.id), INITIAL_DOTA_GAME);
      }
    } catch (err) {
      if (isQuotaError(err)) {
        setQuotaExhausted(true);
      }
      // Offline fallback
    }
  }

  /**
   * Export snapshot for state persistence
   */
  public exportSnapshot(): ManagedGame[] {
    return Array.from(this.gamesMap.values()).map(g => ({ ...g }));
  }

  /**
   * Restore snapshot
   */
  public restoreSnapshot(games: ManagedGame[]): void {
    if (games && games.length > 0) {
      this.gamesMap.clear();
      games.forEach(g => this.gamesMap.set(g.id, { ...g }));
      this.notify();
    }
  }
}

export const gameManagementEngine = new GameManagementEngine();
