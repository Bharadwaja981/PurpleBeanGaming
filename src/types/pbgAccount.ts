/**
 * Purple Bean Gaming — Player Account & Unified Identity Model
 * 
 * Central PBG ID linking:
 * PBG ACCOUNT
 * │
 * ├── PBG ID (e.g. PBG-000184 - permanent, unique)
 * ├── Google Identity (UID, Email, Avatar)
 * ├── Discord Identity (Immutable Discord User ID, Username, Display Name, Avatar)
 * ├── Steam Identity (Steam64, Steam32)
 * └── Dota Identity (Dota Account ID, OpenDota, MMR, Primary/Secondary Roles)
 */

export type PBGAccountStatus = 'ACTIVE' | 'SUSPENDED' | 'BANNED';

export type DotaRolePosition = 
  | 'Position 1 — Carry'
  | 'Position 2 — Mid'
  | 'Position 3 — Offlane'
  | 'Position 4 — Soft Support'
  | 'Position 5 — Hard Support';

export interface AchievementItem {
  id: string;
  title: string;
  tournamentName: string;
  placement: string;
  date: string;
  badge: string;
}

export interface PBGPlayerAccount {
  // Core PBG Identity
  pbgId: string; // Permanent unique identifier (e.g., "PBG-000184")
  googleUid: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  createdAt: string; // ISO timestamp
  updatedAt: string;
  accountStatus: PBGAccountStatus;
  country: string;
  region: string;
  city?: string;
  hasCompletedOnboarding?: boolean;
  onboardingCompletedAt?: string;

  // Discord Account Identity (OAuth Authorized)
  discord?: {
    userId: string;
    username: string;
    globalName: string | null;
    avatarUrl: string | null;
    connectedAt: number | string;
    verified: true;
  } | null;
  discordUserId?: string; // Immutable 17-19 digit Discord Snowflake ID (e.g., "123456789012345678")
  discordUsername?: string; // Current handle (e.g., "bharadwaja")
  discordDisplayName?: string; // Server display name (e.g., "Bharadwaja | PBG")
  discordAvatar?: string;
  discordLinked: boolean;
  discordLinkedAt?: string;

  // Steam & Dota Account Identity (Section 10 & 11)
  steamId?: string; // 17-digit Steam64 ID (e.g., "76561198012345678")
  dotaAccountId?: string; // 32-bit Dota ID / Friend Code (e.g., "52079950")
  dotaDisplayName?: string;
  dotaAvatar?: string;
  steamPersonaName?: string;
  steamProfileUrl?: string;
  openDotaProfile?: string; // e.g., "https://www.opendota.com/players/52079950"
  dotaAccountLinked: boolean;
  dotaAccountVerified: boolean;
  dotaOwnershipVerified: boolean;
  dotaOwnershipVerifiedAt?: string;
  dotaLinkedAt?: string;
  publicMatchDataStatus: 'PUBLIC' | 'PRIVATE' | 'CHECKING' | 'UNKNOWN';
  dotaConnectionStatus: 'NOT_LINKED' | 'FOUND' | 'STEAM_VERIFIED' | 'PRIVATE_DATA' | 'CONNECTED' | 'CONNECTED_SYNCING' | 'CONNECTED_DATA_AVAILABLE' | 'SYNC_ERROR';
  lastOpenDotaSync?: string;
  lastSuccessfulDataSync?: string;
  dotaRankTier?: number | null;
  dotaLeaderboardRank?: number | null;
  dotaCountryCode?: string;

  // Dota Competitive Stats
  declaredMmr?: number | null;
  tournamentMmr?: number | null;
  primaryRole?: DotaRolePosition | null;
  secondaryRole?: DotaRolePosition | null;
  purpleBeanRating: string; // "UNRATED" or numeric rating

  // Career Histories (initially empty for new players)
  tournamentCount: number;
  matchesCount: number;
  winsCount: number;
  lossesCount: number;
  teamsCount: number;
  captainCount: number;
  tournamentHistory: Array<{
    id: string;
    name: string;
    date: string;
    teamName: string;
    placement?: string;
    role: string;
  }>;
  teamHistory: Array<{
    id: string;
    name: string;
    tag: string;
    period: string;
    role: string;
  }>;
  matchHistory: Array<{
    id: string;
    tournamentName: string;
    opponentTeam: string;
    result: 'WIN' | 'LOSS';
    score: string;
    date: string;
  }>;
  captainHistory: Array<{
    tournamentId: string;
    tournamentName: string;
    teamName: string;
    record: string;
  }>;
  achievements: AchievementItem[];
}
