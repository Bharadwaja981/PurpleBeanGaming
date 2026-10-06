/**
 * Purple Bean Gaming — Esports Game Title Management Engine
 */

export interface GameDefinitionRecord {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  competitionType: string;
  teamSize: number;
  substituteLimit?: number;
  roles?: string[];
  order?: number;
}

export const INITIAL_DOTA_GAME: GameDefinitionRecord = {
  id: 'game-dota2',
  name: 'Dota 2',
  slug: 'dota2',
  active: true,
  competitionType: 'MOBA_5v5',
  teamSize: 5,
  substituteLimit: 1,
  order: 1
};

export class GameManagementEngine {
  private games: GameDefinitionRecord[] = [{ ...INITIAL_DOTA_GAME }];

  private assertAdminPermission(caller?: any): void {
    if (caller) {
      if (!caller.isAdmin && caller.role !== 'organizer') {
        throw new Error('PERMISSION_DENIED: Platform Admin permission required to manage games.');
      }
    }
  }

  public getActiveGames(): GameDefinitionRecord[] {
    return this.games.filter(g => g.active);
  }

  public getGames(includeInactive = false): GameDefinitionRecord[] {
    if (includeInactive) return [...this.games];
    return this.getActiveGames();
  }

  public addGame(game: Partial<GameDefinitionRecord> & { name: string; slug?: string }, caller?: any): GameDefinitionRecord {
    this.assertAdminPermission(caller);

    const slug = game.slug || game.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newGame: GameDefinitionRecord = {
      id: `game-${slug}`,
      name: game.name,
      slug,
      active: game.active ?? false,
      competitionType: game.competitionType || 'ESPORTS',
      teamSize: game.teamSize || 5,
      substituteLimit: game.substituteLimit || 1,
      roles: game.roles || [],
      order: (game.order !== undefined) ? game.order : this.games.length + 1
    };
    this.games.push(newGame);
    return newGame;
  }

  public updateGame(gameId: string, updates: Partial<GameDefinitionRecord>, caller?: any): GameDefinitionRecord {
    this.assertAdminPermission(caller);

    const idx = this.games.findIndex(g => g.id === gameId);
    if (idx === -1) {
      throw new Error(`GAME_NOT_FOUND: Game with ID ${gameId} not found.`);
    }

    this.games[idx] = {
      ...this.games[idx],
      ...updates
    };

    return this.games[idx];
  }

  public toggleGameActive(gameId: string, caller?: any): GameDefinitionRecord {
    this.assertAdminPermission(caller);

    const idx = this.games.findIndex(g => g.id === gameId);
    if (idx === -1) {
      throw new Error(`GAME_NOT_FOUND: Game with ID ${gameId} not found.`);
    }

    this.games[idx].active = !this.games[idx].active;
    return this.games[idx];
  }

  public reorderGames(orderedIds: string[], caller?: any): GameDefinitionRecord[] {
    this.assertAdminPermission(caller);

    const reordered: GameDefinitionRecord[] = [];
    orderedIds.forEach((id, index) => {
      const g = this.games.find(item => item.id === id);
      if (g) {
        g.order = index + 1;
        reordered.push(g);
      }
    });

    // Append any unmentioned games
    for (const g of this.games) {
      if (!orderedIds.includes(g.id)) {
        g.order = reordered.length + 1;
        reordered.push(g);
      }
    }

    this.games = reordered;
    return [...this.games];
  }

  public restoreSnapshot(games: GameDefinitionRecord[]): void {
    this.games = games.map(g => ({ ...g }));
  }

  public subscribe(fn: () => void): () => void {
    return () => {};
  }
}

export const gameManagementEngine = new GameManagementEngine();
