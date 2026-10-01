export type CompetitiveGame = 
  | 'All Games'
  | 'Valorant'
  | 'Counter-Strike 2'
  | 'Dota 2'
  | 'BGMI'
  | 'PUBG';

export type IndianRegion = 
  | 'Pan India'
  | 'South India'
  | 'West India'
  | 'North India'
  | 'East India';

export type IndianCity = 
  | 'Bengaluru'
  | 'Mumbai'
  | 'Delhi'
  | 'Hyderabad'
  | 'Chennai'
  | 'Pune'
  | 'Kolkata'
  | 'Ahmedabad';

export type EsportsRole = 
  | 'Position 1 — Carry'
  | 'Position 2 — Mid'
  | 'Position 3 — Offlane'
  | 'Position 4 — Soft Support'
  | 'Position 5 — Hard Support'
  | 'Duelist / Entry'
  | 'Initiator / Flash'
  | 'Controller / Smokes'
  | 'Sentinel / Anchor'
  | 'Primary AWPer'
  | 'In-Game Leader (IGL)'
  | 'Assaulter / Fragger'
  | 'DMR / Sniper Support';

export type DotaRole = EsportsRole;

export type TournamentRole = 'organizer' | 'captain' | 'team_captain' | 'player' | 'tournament_player' | 'spectator';

export interface UserSession {
  id: string;
  email: string;
  displayName: string;
  role: TournamentRole;
  isAdmin?: boolean;
  isPrimaryAdmin?: boolean;
  isModerator?: boolean;
  teamId?: string;
  teamName?: string;
  avatarUrl?: string;
  ign?: string;
  gamerTag?: string;
}

export interface Player {
  id: string;
  username: string;
  displayName?: string;
  realName: string;
  avatar: string;
  country: string;
  flag: string;
  city?: IndianCity | string;
  region?: IndianRegion | string;
  primaryGame?: CompetitiveGame | string;
  mmr: number;
  tournamentMmr: number;
  platformRating: number;
  primaryRole: EsportsRole | string;
  secondaryRole: EsportsRole | string;
  teamId?: string;
  teamName?: string;
  status: 'Verified' | 'Pending Review' | 'Flagged';
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  tournamentWins: number;
  mvps: number;
  experienceYears: number;
  previousCaptainRecord?: string;
  bio: string;
  heroPool: Array<{ hero: string; games: number; winRate: number }>;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  logo: string;
  color: string;
  bgHex: string;
  country: string;
  flag: string;
  city?: IndianCity | string;
  region?: IndianRegion | string;
  primaryGame?: CompetitiveGame | string;
  rating: number;
  record?: { wins: number; losses: number };
  tournamentWins: number;
  captainId: string;
  captainName: string;
  players: string[]; // player IDs
  standIn: string;
  groupPoints: number;
  mapsRecord: { won: number; lost: number };
  form: ('W' | 'L')[];
  description: string;
  earningsINR?: string;
  tournamentId?: string;
}

export interface TournamentStage {
  id: string;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
  date: string;
}

export interface Tournament {
  id: string;
  name: string;
  game: CompetitiveGame | string;
  gameId?: string;
  status: 'Live' | 'Upcoming' | 'Registration Open' | 'Registration Closed' | 'Drafting' | 'Completed' | 'Draft' | 'DRAFT' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ACTIVE' | string;
  lifecycle?: string;
  dates: string;
  startDate: string;
  endDate: string;
  prizePool: string;
  totalPrizeNumber: number;
  prizePoolINR?: string;
  teamCount: number;
  playerCount: number;
  format: string;
  organizer: string;
  organiserId?: string;
  organizerId?: string;
  organizerEmail?: string;
  organizerName?: string;
  tournamentType?: TournamentType;
  bracketFormat?: BracketFormat | string;
  startingCredits?: number;
  bidTimerSeconds?: number;
  city?: IndianCity | string;
  region: IndianRegion | string;
  description: string;
  keyInfo: {
    server: string;
    antiCheat: string;
    bracketFormat: string;
    rosterLock: string;
  };
  prizeDistribution: Array<{ place: string; amount: string; percentage: string }>;
  stages: TournamentStage[];
  isDevelopment?: boolean;
  visibility?: 'PUBLIC' | 'DEVELOPMENT' | 'UNLISTED' | 'DRAFT' | 'PRIVATE' | string;
  config?: any;
  deleted?: boolean;
  registrationSettings?: any;
  teamFormation?: any;
  roster?: any;
  auction?: any;
  competition?: any;
  prizes?: any;
  integrity?: any;
  teams?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export type TournamentType = 'auction' | 'pre_made';
export type BracketFormat = 'single_elimination' | 'double_elimination' | 'round_robin';
export type TournamentStatus =
  | 'DRAFT'
  | 'REGISTRATION'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'CAPTAINS'
  | 'AUCTION'
  | 'MATCHES'
  | 'COMPLETED'
  | 'CANCELLED'
  | string;

export type DotaRolePosition =
  | 'Position 1 — Carry'
  | 'Position 2 — Mid'
  | 'Position 3 — Offlane'
  | 'Position 4 — Soft Support'
  | 'Position 5 — Hard Support';

export interface PreMadeSquadMember {
  userId: string;
  ign: string;
  email?: string;
  role: DotaRolePosition | string;
  mmr: number;
  isCaptain?: boolean;
}

export interface PreMadeSquad {
  id: string;
  name: string;
  tag: string;
  logo: string;
  color: string;
  captainUserId: string;
  captainIgn: string;
  captainRole: DotaRolePosition | string;
  roster: PreMadeSquadMember[];
  registeredTournamentId?: string;
  registeredTournamentName?: string;
  inviteCode?: string;
  status: 'FORMING' | 'READY' | 'REGISTERED' | string;
  averageMmr?: number;
  createdAt: string;
}

export interface FranchiseTeam {
  id: string;
  tournamentId?: string;
  name: string;
  tag: string;
  color?: string;
  logo?: string;
  captainId?: string;
  captainUserId?: string;
  captainIgn?: string;
  startingCredits?: number;
  remainingCredits?: number;
  creditsRemaining?: number;
  bannerUrl?: string;
  roster: any[];
}

export interface TournamentRegistration {
  userId: string;
  tournamentId?: string;
  ign: string;
  primaryRole?: string;
  secondaryRole?: string;
  declaredMmr?: number;
  tournamentMmr?: number;
  mmr?: number;
  isCaptainAppointed?: boolean;
  status?: string;
}

export interface AuctionState {
  currentBid: number;
  highBidderTeamId?: string;
  status?: string;
  currentNominee?: any;
  bidHistory?: any[];
  unsoldPlayers?: any[];
  unselectedPlayers?: any[];
  soldPlayerIds?: string[];
  unsoldPlayerIds?: string[];
  leadingTeamId?: string;
  leadingTeamName?: string;
  leadingCaptainIgn?: string;
  timerDeadline?: number;
  secondsRemaining?: number;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: string;
  bracketType?: 'upper' | 'lower' | 'grand_finals' | 'finals' | string;
  teamA?: { id: string; name: string; tag?: string; score?: number; logo?: string };
  teamB?: { id: string; name: string; tag?: string; score?: number; logo?: string };
  status: 'PENDING' | 'LIVE' | 'COMPLETED' | 'UPCOMING';
  winnerTeamId?: string;
  scheduledTime?: string;
  scoreA?: number;
  scoreB?: number;
}

export interface MatchScoreTeam {
  id: string;
  name: string;
  tag: string;
  logo: string;
  score: number;
  city?: string;
  rating?: number;
}

export interface Match {
  id: string;
  tournamentId: string;
  tournamentName: string;
  game?: CompetitiveGame | string;
  round: string;
  teamA: MatchScoreTeam;
  teamB: MatchScoreTeam;
  seriesFormat: 'BO1' | 'BO3' | 'BO5' | 'Best of 1' | 'Best of 3' | 'Best of 5';
  status: 'LIVE' | 'COMPLETED' | 'UPCOMING';
  scheduledTime: string;
  winnerId?: string;
  isLive?: boolean;
  currentGame?: number;
  totalGames?: number;
  streamUrl?: string;
  mapName?: string;
}

export interface PlayerGameScore {
  name: string;
  hero: string;
  k: number;
  d: number;
  a: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  denies: number;
  netWorth: string;
}

export interface GameDetail {
  gameNumber: number;
  duration: string;
  winnerId: string;
  killsA: number;
  killsB: number;
  towersA: number;
  towersB: number;
  roshanA: number;
  roshanB: number;
  goldAdvantageTeam: string;
  goldAdvantageAmount: number;
  drafts: {
    bansA: string[];
    picksA: string[];
    bansB: string[];
    picksB: string[];
  };
  playersA: PlayerGameScore[];
  playersB: PlayerGameScore[];
  timelineEvents: Array<{
    time: string;
    event: string;
    team: string;
    type: 'roshan' | 'firstblood' | 'tower' | 'teamfight';
  }>;
}

export interface BracketParticipant {
  id: string;
  name: string;
  logo: string;
  seed: number;
  score: number;
  isWinner?: boolean;
  city?: string;
}

export interface BracketNode {
  id: string;
  roundKey: string;
  roundTitle: string;
  bracketType: 'upper' | 'lower' | 'grand_final';
  matchNumber: number;
  teamA: BracketParticipant;
  teamB: BracketParticipant;
  status: 'completed' | 'live' | 'upcoming';
  winnerDestinationId?: string;
  loserDestinationId?: string; // Dotted line connecting drop to LB
  loserDestinationLabel?: string;
  gameScoreText?: string;
  scheduledTime?: string;
}

export interface ReportItem {
  id: string;
  reportedEntity: string;
  entityType: 'player' | 'team';
  reporter: string;
  reason: 'MMR discrepancy' | 'Possible smurf' | 'Incorrect match result' | 'Player no-show' | 'Behaviour report';
  submittedTime: string;
  evidenceText: string;
  status: 'Pending' | 'Reviewing' | 'Resolved' | 'Dismissed';
  matchId?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  unread: boolean;
  type: 'registration' | 'captain' | 'auction' | 'match' | 'bracket' | 'system' | 'CAPTAIN_SELECTED' | 'MATCH_SCHEDULED' | 'EVIDENCE_REQUESTED' | 'AUCTION_STARTING' | 'RESULT_CONFIRMATION_REQUIRED' | 'TOURNAMENT_ANNOUNCEMENT';
  tournamentId?: string;
  actionType?: string;
  actionUrl?: string;
  actionTarget?: {
    view: ViewType;
    entityId?: string;
  };
  linkText?: string;
}

export interface AuctionPlayer {
  player: Player;
  currentBid: number;
  highBidderTeamId?: string;
  highBidderTeamName?: string;
  status: 'drafting' | 'sold' | 'unsold';
  bidHistory: Array<{
    teamId: string;
    teamName: string;
    amount: number;
    time: string;
  }>;
}

export interface AuctionTeamState {
  id?: string;
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  color: string;
  initialCredits: number;
  remainingCredits: number;
  maxPlayers: number;
  draftedPlayers: Player[];
}

export type ViewType = 
  | 'home'
  | 'tournaments'
  | 'tournament_detail'
  | 'matches'
  | 'match_detail'
  | 'bracket'
  | 'bracket_matches'
  | 'standings'
  | 'teams'
  | 'teams_hub'
  | 'team_profile'
  | 'players'
  | 'player_profile'
  | 'rankings'
  | 'register'
  | 'registered_players'
  | 'captain_selection'
  | 'auction'
  | 'live_auction'
  | 'draft'
  | 'draft_results'
  | 'organiser_dashboard'
  | 'not_found';
