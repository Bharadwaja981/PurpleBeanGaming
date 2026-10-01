/**
 * Purple Bean Gaming — Game Definitions
 */

export interface GameDefinition {
  id: string;
  name: string;
  genre: 'MOBA' | 'FPS' | 'BATTLE_ROYALE' | string;
  teamSize: number;
  defaultRosterSize: number;
  substituteSlots: number;
  competitionType: 'HEAD_TO_HEAD' | 'BATTLE_ROYALE' | string;
  isBattleRoyale: boolean;
  roles: string[];
}

export const GAME_DEFINITIONS: Record<string, GameDefinition> = {
  dota2: {
    id: 'dota2',
    name: 'Dota 2',
    genre: 'MOBA',
    teamSize: 5,
    defaultRosterSize: 5,
    substituteSlots: 1,
    competitionType: 'HEAD_TO_HEAD',
    isBattleRoyale: false,
    roles: [
      'Position 1 — Carry',
      'Position 2 — Mid',
      'Position 3 — Offlane',
      'Position 4 — Soft Support',
      'Position 5 — Hard Support'
    ]
  },
  cs2: {
    id: 'cs2',
    name: 'Counter-Strike 2',
    genre: 'FPS',
    teamSize: 5,
    defaultRosterSize: 5,
    substituteSlots: 1,
    competitionType: 'HEAD_TO_HEAD',
    isBattleRoyale: false,
    roles: ['Entry', 'AWP', 'Rifler', 'Support', 'IGL']
  },
  valorant: {
    id: 'valorant',
    name: 'Valorant',
    genre: 'FPS',
    teamSize: 5,
    defaultRosterSize: 5,
    substituteSlots: 1,
    competitionType: 'HEAD_TO_HEAD',
    isBattleRoyale: false,
    roles: ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'Flex']
  },
  bgmi: {
    id: 'bgmi',
    name: 'BGMI',
    genre: 'BATTLE_ROYALE',
    teamSize: 4,
    defaultRosterSize: 4,
    substituteSlots: 1,
    competitionType: 'BATTLE_ROYALE',
    isBattleRoyale: true,
    roles: ['Assaulter', 'Sniper', 'Support', 'IGL']
  },
  pubg: {
    id: 'pubg',
    name: 'PUBG',
    genre: 'BATTLE_ROYALE',
    teamSize: 4,
    defaultRosterSize: 4,
    substituteSlots: 1,
    competitionType: 'BATTLE_ROYALE',
    isBattleRoyale: true,
    roles: ['Assaulter', 'Sniper', 'Support', 'IGL']
  }
};

export function getGameDefinition(gameId: string): GameDefinition {
  const norm = (gameId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return GAME_DEFINITIONS[norm] || GAME_DEFINITIONS['dota2'];
}

export function getAllGameDefinitions(): GameDefinition[] {
  return [GAME_DEFINITIONS.dota2];
}

export function isBattleRoyaleGame(gameId: string): boolean {
  const def = getGameDefinition(gameId);
  return Boolean(def?.isBattleRoyale);
}
