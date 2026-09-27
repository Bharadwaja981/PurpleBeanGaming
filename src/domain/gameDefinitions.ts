/**
 * Purple Bean Gaming — Game Definitions
 * 
 * Central registry of supported esports titles.
 * Eliminates ad-hoc "if (game === 'Dota 2')" checks throughout the application.
 */

export type CompetitionType = 'HEAD_TO_HEAD' | 'BATTLE_ROYALE';

export interface GameRoleDefinition {
  id: string;
  name: string;
  shortName: string;
  category: 'core' | 'support' | 'fragger' | 'utility' | 'flex';
  description?: string;
}

export interface GameDefinition {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  competitionType: CompetitionType;
  defaultRosterSize: number;
  minRosterSize: number;
  maxRosterSize: number;
  maxSubstitutes: number;
  allowSubstitutes: boolean;
  ratingType: 'MMR' | 'CS_RATING' | 'RANK_TIER' | 'TIER_POINTS';
  ratingUnit: string;
  roles: GameRoleDefinition[];
  supportedFormats: Array<
    | 'SINGLE_ELIMINATION'
    | 'DOUBLE_ELIMINATION'
    | 'ROUND_ROBIN'
    | 'GROUPS_KNOCKOUT'
    | 'BATTLE_ROYALE_LOBBY'
    | 'POINTS_RACE'
  >;
  supportedSeries: Array<'BO1' | 'BO3' | 'BO5' | 'Best of 1' | 'Best of 3' | 'Best of 5'>;
  bannerImage: string;
  iconImage: string;
}

export const GAME_DEFINITIONS: Record<string, GameDefinition> = {
  dota2: {
    id: 'dota2',
    name: 'Dota 2',
    shortName: 'Dota 2',
    slug: 'dota-2',
    competitionType: 'HEAD_TO_HEAD',
    defaultRosterSize: 5,
    minRosterSize: 5,
    maxRosterSize: 5,
    maxSubstitutes: 2,
    allowSubstitutes: true,
    ratingType: 'MMR',
    ratingUnit: 'MMR',
    roles: [
      { id: 'pos1', name: 'Position 1 — Carry', shortName: 'P1 Carry', category: 'core' },
      { id: 'pos2', name: 'Position 2 — Mid', shortName: 'P2 Mid', category: 'core' },
      { id: 'pos3', name: 'Position 3 — Offlane', shortName: 'P3 Offlane', category: 'core' },
      { id: 'pos4', name: 'Position 4 — Soft Support', shortName: 'P4 Soft Supp', category: 'support' },
      { id: 'pos5', name: 'Position 5 — Hard Support', shortName: 'P5 Hard Supp', category: 'support' }
    ],
    supportedFormats: ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT'],
    supportedSeries: ['BO1', 'BO3', 'BO5', 'Best of 1', 'Best of 3', 'Best of 5'],
    bannerImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    iconImage: '🛡️'
  },
  cs2: {
    id: 'cs2',
    name: 'Counter-Strike 2',
    shortName: 'CS2',
    slug: 'cs2',
    competitionType: 'HEAD_TO_HEAD',
    defaultRosterSize: 5,
    minRosterSize: 5,
    maxRosterSize: 5,
    maxSubstitutes: 2,
    allowSubstitutes: true,
    ratingType: 'CS_RATING',
    ratingUnit: 'CS Rating',
    roles: [
      { id: 'igl', name: 'In-Game Leader (IGL)', shortName: 'IGL', category: 'utility' },
      { id: 'awp', name: 'Primary AWPer', shortName: 'AWP', category: 'core' },
      { id: 'entry', name: 'Entry Fragger', shortName: 'Entry', category: 'fragger' },
      { id: 'support', name: 'Support / Anchor', shortName: 'Support', category: 'support' },
      { id: 'lurker', name: 'Lurker / Flex', shortName: 'Lurker', category: 'flex' }
    ],
    supportedFormats: ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT'],
    supportedSeries: ['BO1', 'BO3', 'BO5', 'Best of 1', 'Best of 3', 'Best of 5'],
    bannerImage: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
    iconImage: '🎯'
  },
  valorant: {
    id: 'valorant',
    name: 'Valorant',
    shortName: 'Valorant',
    slug: 'valorant',
    competitionType: 'HEAD_TO_HEAD',
    defaultRosterSize: 5,
    minRosterSize: 5,
    maxRosterSize: 5,
    maxSubstitutes: 2,
    allowSubstitutes: true,
    ratingType: 'RANK_TIER',
    ratingUnit: 'RR / Rank',
    roles: [
      { id: 'duelist', name: 'Duelist / Entry', shortName: 'Duelist', category: 'fragger' },
      { id: 'initiator', name: 'Initiator / Recon', shortName: 'Initiator', category: 'utility' },
      { id: 'controller', name: 'Controller / Smokes', shortName: 'Controller', category: 'utility' },
      { id: 'sentinel', name: 'Sentinel / Site Anchor', shortName: 'Sentinel', category: 'support' },
      { id: 'flex', name: 'Flex / Second Fragger', shortName: 'Flex', category: 'flex' }
    ],
    supportedFormats: ['SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'ROUND_ROBIN', 'GROUPS_KNOCKOUT'],
    supportedSeries: ['BO1', 'BO3', 'BO5', 'Best of 1', 'Best of 3', 'Best of 5'],
    bannerImage: 'https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&w=1200&q=80',
    iconImage: '⚡'
  },
  bgmi: {
    id: 'bgmi',
    name: 'Battlegrounds Mobile India (BGMI)',
    shortName: 'BGMI',
    slug: 'bgmi',
    competitionType: 'BATTLE_ROYALE',
    defaultRosterSize: 4,
    minRosterSize: 4,
    maxRosterSize: 4,
    maxSubstitutes: 2,
    allowSubstitutes: true,
    ratingType: 'TIER_POINTS',
    ratingUnit: 'Tier Pts',
    roles: [
      { id: 'igl', name: 'IGL / Strategist', shortName: 'IGL', category: 'utility' },
      { id: 'assaulter1', name: 'Primary Assaulter', shortName: 'Assaulter 1', category: 'fragger' },
      { id: 'assaulter2', name: 'Second Fragger', shortName: 'Assaulter 2', category: 'fragger' },
      { id: 'support_sniper', name: 'Filter / Sniper Support', shortName: 'Sniper/Supp', category: 'support' }
    ],
    supportedFormats: ['BATTLE_ROYALE_LOBBY', 'POINTS_RACE'],
    supportedSeries: ['BO1', 'BO3', 'BO5'],
    bannerImage: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80',
    iconImage: '🪖'
  },
  pubg: {
    id: 'pubg',
    name: 'PUBG: Battlegrounds',
    shortName: 'PUBG',
    slug: 'pubg',
    competitionType: 'BATTLE_ROYALE',
    defaultRosterSize: 4,
    minRosterSize: 4,
    maxRosterSize: 4,
    maxSubstitutes: 2,
    allowSubstitutes: true,
    ratingType: 'TIER_POINTS',
    ratingUnit: 'Rank Pts',
    roles: [
      { id: 'igl', name: 'IGL / Shotcaller', shortName: 'IGL', category: 'utility' },
      { id: 'scout', name: 'Scout / Point Man', shortName: 'Scout', category: 'fragger' },
      { id: 'assaulter', name: 'Main Fragger', shortName: 'Assaulter', category: 'fragger' },
      { id: 'sniper', name: 'DMR / Long-range Support', shortName: 'DMR/Sniper', category: 'support' }
    ],
    supportedFormats: ['BATTLE_ROYALE_LOBBY', 'POINTS_RACE'],
    supportedSeries: ['BO1', 'BO3', 'BO5'],
    bannerImage: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
    iconImage: '🍗'
  }
};

export function getGameDefinition(identifier: string): GameDefinition {
  const normalized = identifier.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('dota')) return GAME_DEFINITIONS.dota2;
  if (normalized.includes('cs') || normalized.includes('counter')) return GAME_DEFINITIONS.cs2;
  if (normalized.includes('val')) return GAME_DEFINITIONS.valorant;
  if (normalized.includes('bgmi')) return GAME_DEFINITIONS.bgmi;
  if (normalized.includes('pubg')) return GAME_DEFINITIONS.pubg;
  return GAME_DEFINITIONS.dota2;
}

export function getAllGameDefinitions(includeInactive = false): GameDefinition[] {
  if (includeInactive) return Object.values(GAME_DEFINITIONS);
  // Purple Bean Gaming is currently Dota 2 only; additional games can be managed from Admin Settings
  return [GAME_DEFINITIONS.dota2];
}

export function isBattleRoyaleGame(identifier: string): boolean {
  return getGameDefinition(identifier).competitionType === 'BATTLE_ROYALE';
}
