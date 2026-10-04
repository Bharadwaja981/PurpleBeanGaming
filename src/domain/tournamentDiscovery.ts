/**
 * Purple Bean Gaming — Public Tournament Discovery & Canonical Mapping
 *
 * Provides authoritative query filters, normalization, and visibility rules:
 * - Subscribes to real Firestore records (never seeds/mocks in production)
 * - Exposes public tournaments in valid lifecycles (REGISTRATION_OPEN, ACTIVE, COMPLETED, etc.)
 * - Keeps DRAFT tournaments strictly organizer-only
 * - Normalizes status representations ('registration_open' -> 'REGISTRATION_OPEN')
 * - Normalizes visibility ('public', 'PUBLIC_CIRCUIT', isPublic -> 'PUBLIC')
 * - Normalizes game IDs ('Dota 2', 'dota2' -> 'dota2')
 * - Flexible region matching (Pan India tournaments appear across all Indian regions)
 * - ALL status filter shows every publicly discoverable tournament
 */

import { Tournament, Team, Player } from '../types/tournament';

export const CANONICAL_PUBLIC_STATUSES = new Set([
  'REGISTRATION_OPEN',
  'REGISTRATION_CLOSED',
  'CAPTAIN_SELECTION',
  'AUCTION_READY',
  'AUCTION_ACTIVE',
  'AUCTION_COMPLETED',
  'SEEDING',
  'STRUCTURE_GENERATED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
]);

export const LEGACY_MOCK_TOURNAMENT_IDS = new Set([
  '2-team-auction-test',
  'purple-bean-test-cup',
  'auction-basic-test-1',
  'basic-test-1',
  'tourney-mumnc5ax',
  'pb-tourney-1790757456408'
]);

export function isTestTournament(tournament: any): boolean {
  if (!tournament) return false;
  const rawId = typeof tournament === 'string' ? tournament : (tournament.id || tournament.tournamentId || '');
  const idLower = rawId.toLowerCase();

  if (
    (typeof tournament === 'object' && tournament.testMode === true) ||
    idLower === 'purple-bean-auction-test' ||
    (typeof tournament === 'object' && (tournament.isDevelopment === true || tournament.isSynthetic === true || tournament.isDummy === true)) ||
    (typeof tournament === 'object' && (tournament.deleted === true || tournament.status === 'DELETED' || tournament.status === 'deleted' || tournament.lifecycle === 'CANCELLED_DELETED'))
  ) {
    return true;
  }

  if (LEGACY_MOCK_TOURNAMENT_IDS.has(idLower)) {
    return true;
  }

  return false;
}

export function isTestPlayer(player: any): boolean {
  if (!player) return false;
  const idLower = (player.id || player.userId || player.pbgId || '').toLowerCase();

  return (
    (player as any).isTestAccount === true ||
    (player as any).source === 'TEST_SEED' ||
    idLower.startsWith('pbg-test-') ||
    idLower.startsWith('dummy-') ||
    idLower.startsWith('p-tc-') ||
    idLower.startsWith('tc-') ||
    (player as any).isDummy === true ||
    (player as any).isSynthetic === true
  );
}

export function isTestTeam(team: any): boolean {
  if (!team) return false;
  const idLower = (team.id || '').toLowerCase();
  const tourneyIdLower = (team.tournamentId || '').toLowerCase();

  return (
    idLower.startsWith('tc-team') ||
    LEGACY_MOCK_TOURNAMENT_IDS.has(tourneyIdLower) ||
    idLower === 'team-9s8uyzbbgxz5tfgyukaoangqjpo2-2177' ||
    idLower === 'team-s1syelw0xhwkgjenyaobvh7btjt2-197' ||
    (team as any).isDummy === true ||
    (team as any).isSynthetic === true
  );
}

export function normalizeStatus(rawStatus?: string | null): string {
  if (!rawStatus) return 'DRAFT';
  const clean = rawStatus.trim().toUpperCase().replace(/[\s-]+/g, '_');

  if (clean === 'REGISTRATION_OPEN' || clean === 'REGISTRATION' || clean === 'OPEN') {
    return 'REGISTRATION_OPEN';
  }
  if (clean === 'REGISTRATION_CLOSED' || clean === 'CLOSED') {
    return 'REGISTRATION_CLOSED';
  }
  if (clean === 'CAPTAIN_SELECTION' || clean === 'CAPTAINS') {
    return 'CAPTAIN_SELECTION';
  }
  if (clean === 'AUCTION_READY') {
    return 'AUCTION_READY';
  }
  if (clean === 'AUCTION_ACTIVE' || clean === 'AUCTION' || clean === 'DRAFTING') {
    return 'AUCTION_ACTIVE';
  }
  if (clean === 'AUCTION_COMPLETED') {
    return 'AUCTION_COMPLETED';
  }
  if (clean === 'SEEDING') {
    return 'SEEDING';
  }
  if (clean === 'STRUCTURE_GENERATED') {
    return 'STRUCTURE_GENERATED';
  }
  if (clean === 'ACTIVE' || clean === 'LIVE' || clean === 'IN_PROGRESS') {
    return 'ACTIVE';
  }
  if (clean === 'COMPLETED' || clean === 'FINISHED') {
    return 'COMPLETED';
  }
  if (clean === 'CANCELLED' || clean === 'CANCELED') {
    return 'CANCELLED';
  }
  if (clean === 'DRAFT') {
    return 'DRAFT';
  }
  return clean;
}

export function normalizeVisibility(t: any): 'PUBLIC' | 'DRAFT' | 'PRIVATE' | 'UNLISTED' {
  if (!t) return 'DRAFT';

  // Direct visibility or config.identity.visibility
  const raw = t.visibility || t.config?.identity?.visibility;
  if (typeof raw === 'string') {
    const vUpper = raw.trim().toUpperCase();
    if (vUpper === 'PUBLIC' || vUpper === 'PUBLIC_CIRCUIT') {
      return 'PUBLIC';
    }
    if (vUpper === 'DRAFT') {
      return 'DRAFT';
    }
    if (vUpper === 'PRIVATE') {
      return 'PRIVATE';
    }
    if (vUpper === 'UNLISTED') {
      return 'UNLISTED';
    }
  }

  // Boolean flags compatibility
  if (
    t.isPublic === true || 
    t.published === true || 
    t.config?.identity?.isPublic === true || 
    t.config?.identity?.published === true
  ) {
    return 'PUBLIC';
  }
  if (
    t.isPrivate === true || 
    t.config?.identity?.isPrivate === true
  ) {
    return 'PRIVATE';
  }

  return 'PUBLIC';
}

export function normalizeGameId(gameOrId?: string | null): string {
  if (!gameOrId) return 'dota2';
  const clean = gameOrId.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (clean === 'dota2' || clean === 'dota') return 'dota2';
  if (clean === 'cs2' || clean === 'counterstrike2') return 'cs2';
  if (clean === 'valorant') return 'valorant';
  if (clean === 'bgmi') return 'bgmi';
  if (clean === 'pubg') return 'pubg';
  return clean;
}

export function isPubliclyDiscoverable(tournament: Tournament): boolean {
  if (!tournament) return false;
  if ((tournament as any).deleted === true || (tournament.status as any) === 'DELETED') {
    return false;
  }
  const rawId = (tournament.id || (tournament as any).tournamentId || '').toLowerCase();
  if (rawId === 'purple-bean-auction-test' || rawId === 'auction-test') {
    return true;
  }
  if (isTestTournament(tournament)) {
    return false;
  }

  const visibility = normalizeVisibility(tournament);
  if (visibility === 'PRIVATE' || visibility === 'UNLISTED' || visibility === 'DRAFT') {
    return false;
  }
  const normStatus = (tournament.status || tournament.lifecycle || '').toUpperCase();
  if (normStatus === 'DRAFT') {
    return false;
  }

  return true;
}

export function matchesStatusCategory(rawStatus: string | undefined | null, filterCategory: string): boolean {
  if (!filterCategory) return true;
  const f = filterCategory.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (f === 'ALL' || f === 'ALL_STATUSES') return true;

  const canonical = normalizeStatus(rawStatus);

  if (f === 'REGISTRATION_OPEN') {
    return canonical === 'REGISTRATION_OPEN';
  }
  if (f === 'LIVE') {
    return canonical === 'ACTIVE' || canonical === 'AUCTION_ACTIVE';
  }
  if (f === 'COMPLETED') {
    return canonical === 'COMPLETED';
  }
  if (f === 'UPCOMING') {
    return (
      canonical === 'REGISTRATION_CLOSED' ||
      canonical === 'SEEDING' ||
      canonical === 'STRUCTURE_GENERATED' ||
      canonical === 'UPCOMING'
    );
  }
  if (f === 'DRAFTING') {
    return (
      canonical === 'CAPTAIN_SELECTION' ||
      canonical === 'AUCTION_READY' ||
      canonical === 'AUCTION_ACTIVE' ||
      canonical === 'AUCTION_COMPLETED'
    );
  }

  return canonical === f;
}

export function matchesGameFilter(tournamentGame?: string, tournamentGameId?: string, filter?: string): boolean {
  if (!filter || filter === 'All' || filter === 'All Games' || filter === 'All Esports Titles') {
    return true;
  }
  const normFilter = normalizeGameId(filter);
  const normTourney = normalizeGameId(tournamentGameId || tournamentGame);
  return normTourney === normFilter;
}

export function matchesRegionFilter(tournamentRegion?: string | null, filter?: string | null): boolean {
  if (!filter) return true;
  const fLower = filter.trim().toLowerCase();
  if (fLower === 'all' || fLower.includes('all')) {
    return true; // All India Regions: show Pan India and all other tournaments
  }

  if (!tournamentRegion) return true;
  const tLower = tournamentRegion.trim().toLowerCase();
  if (tLower === 'pan india' || tLower === 'all india') {
    return true;
  }
  return tLower === fLower;
}

export function normalizeTournamentRecord(t: any): Tournament {
  const normVisibility = normalizeVisibility(t);
  const rawStatus = t.status || t.lifecycle || (t.config?.identity?.status) || 'DRAFT';
  const normStatus = normalizeStatus(rawStatus);
  const normGameId = normalizeGameId(t.gameId || t.game || t.config?.identity?.gameId);

  const finalStatus = normStatus;
  const finalVisibility = normVisibility;

  const prizePoolText = t.prizePoolINR || t.prizePool || '₹50,000 INR';
  const totalPrizeNumber = typeof t.totalPrizeNumber === 'number' 
    ? t.totalPrizeNumber 
    : (typeof t.prizes?.totalPrizePoolINR === 'number' ? t.prizes.totalPrizePoolINR : 50000);

  const keyInfo = t.keyInfo ? {
    server: t.keyInfo.server || 'Mumbai / Chennai Low-Latency Node',
    antiCheat: t.keyInfo.antiCheat || 'Valve VAC & PBG Integrity Audit',
    bracketFormat: t.keyInfo.bracketFormat || (t.format || 'Double Elimination (BO3 / BO5 Finals)'),
    rosterLock: t.keyInfo.rosterLock || 'Enforced at Bracket Seeding'
  } : {
    server: 'Mumbai / Chennai Low-Latency Node',
    antiCheat: 'Valve VAC & PBG Integrity Audit',
    bracketFormat: t.format || 'Double Elimination (BO3 / BO5 Finals)',
    rosterLock: 'Enforced at Bracket Seeding'
  };

  const prizeDistribution = Array.isArray(t.prizeDistribution) && t.prizeDistribution.length > 0
    ? t.prizeDistribution
    : [
        { place: '1st Place (Champion)', amount: '₹30,000', percentage: '60%' },
        { place: '2nd Place (Runner-up)', amount: '₹12,500', percentage: '25%' },
        { place: '3rd Place', amount: '₹7,500', percentage: '15%' }
      ];

  const stages = Array.isArray(t.stages) && t.stages.length > 0
    ? t.stages
    : [
        { id: 'reg', name: 'Open Player & Team Registration', status: 'completed', date: 'Phase 1' },
        { id: 'auction', name: 'Live Captain Credit Auction', status: 'current', date: 'Phase 2' },
        { id: 'bracket', name: 'Double Elimination Championship', status: 'upcoming', date: 'Phase 3' }
      ];

  return {
    ...t,
    id: t.id || t.config?.identity?.tournamentId || `pb-tourney-${Date.now()}`,
    name: t.name || t.config?.identity?.name || 'Tournament',
    game: t.game || t.config?.identity?.gameName || 'Dota 2',
    gameId: normGameId,
    visibility: finalVisibility,
    status: finalStatus,
    lifecycle: finalStatus,
    region: t.region || t.config?.identity?.region || 'Pan India',
    city: t.city || t.config?.identity?.city || null,
    dates: t.dates || (t.startDate ? `${t.startDate} - ${t.endDate || ''}` : 'Upcoming 2026 Circuit'),
    startDate: t.startDate || new Date().toISOString().split('T')[0],
    endDate: t.endDate || new Date().toISOString().split('T')[0],
    prizePool: prizePoolText,
    prizePoolINR: prizePoolText,
    totalPrizeNumber,
    teamCount: typeof t.teamCount === 'number' ? t.teamCount : (Array.isArray(t.teams) ? t.teams.length : 8),
    playerCount: typeof t.playerCount === 'number' ? t.playerCount : 40,
    format: t.format || 'Double Elimination',
    organizer: t.organizer || t.organizerName || 'Purple Bean Esports India',
    description: t.description || 'Official Pan-India esports tournament featuring verified Indian server nodes, referee anti-cheat monitoring, and direct INR payouts.',
    keyInfo,
    prizeDistribution,
    stages
  };
}

export function normalizeTeamRecord(raw: any): Team {
  if (!raw) {
    return {
      id: `team-${Date.now()}`,
      name: 'Unknown Team',
      tag: 'TEAM',
      logo: '🛡️',
      color: '#7C3AED',
      bgHex: '#7C3AED',
      country: 'India',
      flag: '🇮🇳',
      city: 'India',
      region: 'Pan India',
      primaryGame: 'Dota 2',
      rating: 1500,
      record: { wins: 0, losses: 0 },
      tournamentWins: 0,
      captainId: '',
      captainName: 'Captain',
      players: [],
      standIn: '',
      groupPoints: 0,
      mapsRecord: { won: 0, lost: 0 },
      form: [],
      description: ''
    };
  }

  const wins = typeof raw.record?.wins === 'number' 
    ? raw.record.wins 
    : (typeof raw.wins === 'number' ? raw.wins : 0);
  const losses = typeof raw.record?.losses === 'number' 
    ? raw.record.losses 
    : (typeof raw.losses === 'number' ? raw.losses : 0);
  const mapsWon = typeof raw.mapsRecord?.won === 'number' ? raw.mapsRecord.won : 0;
  const mapsLost = typeof raw.mapsRecord?.lost === 'number' ? raw.mapsRecord.lost : 0;

  return {
    ...raw,
    id: raw.id || `team-${Date.now()}`,
    name: raw.name || 'Unnamed Team',
    tag: raw.tag || raw.name?.slice(0, 4)?.toUpperCase() || 'TEAM',
    logo: raw.logo || '🛡️',
    color: raw.color || '#7C3AED',
    bgHex: raw.bgHex || raw.color || '#7C3AED',
    country: raw.country || 'India',
    flag: raw.flag || '🇮🇳',
    city: raw.city || 'India',
    region: raw.region || 'Pan India',
    primaryGame: raw.primaryGame || 'Dota 2',
    rating: typeof raw.rating === 'number' ? raw.rating : 1500,
    record: { wins, losses },
    tournamentWins: typeof raw.tournamentWins === 'number' ? raw.tournamentWins : 0,
    captainId: raw.captainId || '',
    captainName: raw.captainName || raw.captainIgn || 'Captain',
    players: Array.isArray(raw.players) 
      ? raw.players 
      : (Array.isArray(raw.primaryRoster) ? raw.primaryRoster.map((p: any) => p.userId || p.id) : []),
    standIn: raw.standIn || '',
    groupPoints: typeof raw.groupPoints === 'number' ? raw.groupPoints : 0,
    mapsRecord: { won: mapsWon, lost: mapsLost },
    form: Array.isArray(raw.form) ? raw.form : [],
    description: raw.description || `Official team ${raw.name || ''}`,
    earningsINR: raw.earningsINR || '₹0',
    tournamentId: raw.tournamentId
  };
}

export function normalizePlayerRecord(raw: any): Player {
  if (!raw) {
    return {
      id: `p-${Date.now()}`,
      username: 'Player',
      realName: 'Player',
      avatar: '🎮',
      country: 'India',
      flag: '🇮🇳',
      city: 'India',
      region: 'Pan India',
      primaryGame: 'Dota 2',
      mmr: 5000,
      tournamentMmr: 5000,
      platformRating: 1500,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      status: 'Verified',
      matches: 0,
      wins: 0,
      losses: 0,
      winRate: 50,
      tournamentWins: 0,
      mvps: 0,
      experienceYears: 3,
      previousCaptainRecord: '0-0',
      bio: '',
      heroPool: []
    };
  }

  const wins = typeof raw.wins === 'number' 
    ? raw.wins 
    : (typeof raw.winsCount === 'number' ? raw.winsCount : 0);
  const losses = typeof raw.losses === 'number' 
    ? raw.losses 
    : (typeof raw.lossesCount === 'number' ? raw.lossesCount : 0);
  const matches = typeof raw.matches === 'number' 
    ? raw.matches 
    : (typeof raw.matchesCount === 'number' ? raw.matchesCount : wins + losses);
  const mmr = typeof raw.mmr === 'number' 
    ? raw.mmr 
    : (typeof raw.tournamentMmr === 'number' ? raw.tournamentMmr : (typeof raw.declaredMmr === 'number' ? raw.declaredMmr : 5000));

  const rawId = String(raw.id || raw.userId || '');
  let pbgId = raw.pbgId;
  if (!pbgId) {
    if (rawId === 'dCZd7IjKpxYDBjTQe5FUhccuX583' || raw.email?.toLowerCase() === 'myana.santhosh@gmail.com') {
      pbgId = 'PBG-000188';
    } else if (rawId === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3' || raw.email?.toLowerCase() === '11106cm009@gmail.com') {
      pbgId = 'PBG-000186';
    } else if (rawId.startsWith('PBG-')) {
      pbgId = rawId;
    } else if (rawId.startsWith('p-')) {
      const matchNum = rawId.match(/\d+/)?.[0];
      if (matchNum) {
        pbgId = `PBG-${matchNum.padStart(6, '0')}`;
      }
    }
  }

  // Name normalization
  let username = raw.username || raw.ign || raw.steamPersonaName || raw.displayName;
  let displayName = raw.displayName || raw.username || raw.ign || raw.steamPersonaName;
  let realName = raw.realName || raw.displayName || raw.username || raw.ign;

  if (pbgId === 'PBG-000188' || rawId === 'dCZd7IjKpxYDBjTQe5FUhccuX583' || raw.email?.toLowerCase() === 'myana.santhosh@gmail.com') {
    pbgId = 'PBG-000188';
    username = (!username || username === 'Player') ? 'Santhosh Myana' : username;
    displayName = (!displayName || displayName === 'Player') ? 'Santhosh Myana' : displayName;
    realName = (!realName || realName === 'Player') ? 'Santhosh Myana' : realName;
  } else if (pbgId === 'PBG-000186' || rawId === 'wUyRsN0f40bYdyCpLp6UNeIJjpD3' || raw.email?.toLowerCase() === '11106cm009@gmail.com') {
    pbgId = 'PBG-000186';
    username = (!username || username === 'Player') ? 'Bharadwaja Anisetti' : username;
    displayName = (!displayName || displayName === 'Player') ? 'Bharadwaja Anisetti' : displayName;
    realName = (!realName || realName === 'Player') ? 'Bharadwaja Anisetti' : realName;
  }

  return {
    ...raw,
    id: raw.id || raw.userId || pbgId || `p-${Date.now()}`,
    pbgId,
    username: username || 'Player',
    displayName: displayName || username || 'Player',
    realName: realName || displayName || username || 'Player',
    avatar: raw.avatar || '🎮',
    country: raw.country || 'India',
    flag: raw.flag || '🇮🇳',
    city: raw.city || 'India',
    region: raw.region || 'Pan India',
    primaryGame: raw.primaryGame || 'Dota 2',
    mmr,
    tournamentMmr: typeof raw.tournamentMmr === 'number' ? raw.tournamentMmr : mmr,
    platformRating: typeof raw.platformRating === 'number' 
      ? raw.platformRating 
      : (typeof raw.competitiveRating === 'number' ? raw.competitiveRating : 1500),
    primaryRole: raw.primaryRole || 'Position 1 — Carry',
    secondaryRole: raw.secondaryRole || 'Position 2 — Mid',
    teamId: raw.teamId || raw.currentTeamId,
    teamName: raw.teamName || raw.currentTeamName,
    status: raw.status === 'Pending Review' || raw.status === 'Flagged' ? raw.status : 'Verified',
    matches,
    wins,
    losses,
    winRate: typeof raw.winRate === 'number' 
      ? raw.winRate 
      : (matches > 0 ? Math.round((wins / matches) * 100) : 50),
    tournamentWins: typeof raw.tournamentWins === 'number' 
      ? raw.tournamentWins 
      : (typeof raw.tournamentCount === 'number' ? raw.tournamentCount : 0),
    mvps: typeof raw.mvps === 'number' ? raw.mvps : 0,
    experienceYears: typeof raw.experienceYears === 'number' ? raw.experienceYears : 3,
    previousCaptainRecord: raw.previousCaptainRecord || `${wins}-${losses}`,
    bio: raw.bio || '',
    heroPool: Array.isArray(raw.heroPool) ? raw.heroPool : []
  };
}
