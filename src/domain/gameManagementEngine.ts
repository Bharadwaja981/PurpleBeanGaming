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
}

export const INITIAL_DOTA_GAME: GameDefinitionRecord = {
  id: 'game-dota2',
  name: 'Dota 2',
  slug: 'dota2',
  active: true,
  competitionType: 'MOBA_5v5',
  teamSize: 5,
  substituteLimit: 1
};

export class GameManagementEngine {
  private games: GameDefinitionRecord[] = [{ ...INITIAL_DOTA_GAME }];

  public getActiveGames(): GameDefinitionRecord[] {
    return this.games.filter(g => g.active);
  }

  public getGames(includeInactive = false): GameDefinitionRecord[] {
    if (includeInactive) return this.games;
    return this.getActiveGames();
  }

  public addGame(game: Partial<GameDefinitionRecord> & { name: string; slug: string }, _caller?: any): GameDefinitionRecord {
    const newGame: GameDefinitionRecord = {
      id: `game-${game.slug}`,
      name: game.name,
      slug: game.slug,
      active: game.active ?? true,
      competitionType: game.competitionType || 'ESPORTS',
      teamSize: game.teamSize || 5,
      substituteLimit: game.substituteLimit || 1
    };
    this.games.push(newGame);
    return newGame;
  }

  public restoreSnapshot(games: GameDefinitionRecord[]): void {
    this.games = games.map(g => ({ ...g }));
  }

  public subscribe(fn: () => void): () => void {
    return () => {};
  }
}

export const gameManagementEngine = new GameManagementEngine();
