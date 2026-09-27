/**
 * Purple Bean Gaming — Dota 2 Player Identity, Steam Linking & MMR Integrity Engine
 * 
 * Manages persistent Dota 2 player profiles, Steam32/64 account linking,
 * locked Tournament MMR, suspicious smurf/account integrity cases,
 * and captain career records.
 */

import { EsportsRole } from '../types/tournament';

export type DotaRolePosition = 
  | 'Position 1 — Carry'
  | 'Position 2 — Mid'
  | 'Position 3 — Offlane'
  | 'Position 4 — Soft Support'
  | 'Position 5 — Hard Support';

export const DOTA_ROLES: DotaRolePosition[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

export function validateDotaRoles(
  primary?: string,
  secondary?: string
): { valid: boolean; error?: string } {
  if (!primary || !DOTA_ROLES.includes(primary as DotaRolePosition)) {
    return { valid: false, error: 'A valid Primary Dota 2 Role must be selected.' };
  }
  if (!secondary || !DOTA_ROLES.includes(secondary as DotaRolePosition)) {
    return { valid: false, error: 'A valid Secondary Dota 2 Role must be selected.' };
  }
  if (primary === secondary) {
    return { valid: false, error: 'Primary and Secondary roles cannot be identical. Please choose distinct roles.' };
  }
  return { valid: true };
}

export type DotaRegistrationState = 
  | 'REGISTERED'
  | 'UNDER_REVIEW'
  | 'EVIDENCE_REQUESTED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type EvidenceType = 
  | 'MMR_SCREENSHOT' 
  | 'STEAM_PROFILE' 
  | 'TOURNAMENT_HISTORY' 
  | 'OTHER';

export interface RegistrationEvidenceItem {
  id: string;
  registrationId: string;
  userId: string;
  type: EvidenceType;
  fileUrl?: string;
  description: string;
  submittedAt: string;
}

export interface HistoricalMmrChangeEntry {
  oldValue: number;
  newValue: number;
  reason: string;
  actor: string;
  timestamp: string;
}

export interface HistoricalTournamentMmrRecord {
  tournamentId: string;
  tournamentName?: string;
  tournamentMmr: number;
  lockedAt: string;
  lockedBy: string;
  finalRank?: string;
}

export interface DotaUserNotification {
  id: string;
  userId: string;
  type: 
    | 'REGISTRATION_UNDER_REVIEW'
    | 'EVIDENCE_REQUESTED'
    | 'EVIDENCE_RECEIVED'
    | 'TOURNAMENT_MMR_CONFIRMED'
    | 'REGISTRATION_VERIFIED'
    | 'REGISTRATION_REJECTED'
    | 'MATCH_SCHEDULED'
    | 'CHECK_IN_OPEN'
    | 'OPPONENT_READY'
    | 'RESULT_SUBMITTED'
    | 'CONFIRMATION_REQUIRED'
    | 'RESULT_CONFIRMED'
    | 'DISPUTE_OPENED'
    | 'DISPUTE_RESOLVED'
    | 'REMATCH_ORDERED'
    | 'FORFEIT_AWARDED'
    | 'MATCH_RESCHEDULED';
  title: string;
  message: string;
  tournamentId: string;
  registrationId?: string;
  matchId?: string;
  createdAt: string;
  read: boolean;
}

export interface DotaTournamentRegistration {
  id: string;
  tournamentId: string;
  userId: string;
  ign: string;
  primaryRole: DotaRolePosition;
  secondaryRole: DotaRolePosition;
  declaredMmr: number;
  tournamentMmr?: number;
  isMmrLocked?: boolean;
  mmrLockedAt?: string;
  mmrLockedBy?: string;
  steamId64?: string;
  steamId32?: string;
  city?: string;
  region?: string;
  status: DotaRegistrationState;
  rulesAccepted: boolean;
  registeredAt: string;
  updatedAt: string;
  reviewNotes?: string;
  rejectionReason?: string;
  evidenceRequestPrompt?: string;
  evidenceRequestedAt?: string;
  evidence?: RegistrationEvidenceItem[];
  withdrawnAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  integrityCaseId?: string;
  historicalMmrChanges?: HistoricalMmrChangeEntry[];
}

export interface PublicDotaPlayerProfile {
  id: string;
  username: string; // IGN
  avatar: string;
  country: string;
  region: string;
  city: string;
  primaryRole: DotaRolePosition;
  secondaryRole: DotaRolePosition;
  currentTeamId?: string;
  currentTeamName?: string;
  competitiveRating: number;
  ratingStatus: 'PROVISIONAL' | 'ESTABLISHED';
  tournamentMmr: number;
  isMmrLocked?: boolean;
  tournamentCount: number;
  tournamentSnapshots: DotaPlayerTournamentSnapshot[];
  historicalTournamentMmrs?: HistoricalTournamentMmrRecord[];
  matchesCount: number;
  winsCount: number;
  lossesCount: number;
  winRate: number;
  steamAccountLinked: boolean;
  steamId64Masked?: string;
  openDotaUrl?: string;
  profileUrl?: string;
  heroPool: Array<{ hero: string; games: number; winRate: number }>;
}

export interface PrivateDotaPlayerAccount {
  userId: string;
  email: string;
  steamId64?: string;
  steamId32?: string;
  verificationStatus: 'NOT_LINKED' | 'LINKED_PENDING_VERIFICATION' | 'VERIFIED' | 'FLAGGED';
  moderationNotes?: string;
  evidenceDocuments?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SteamAccountLink {
  steamId64: string;
  steamId32: string;
  accountName: string;
  avatarUrl: string;
  profileUrl: string;
  openDotaUrl: string;
  linkedAt: string;
  isVerified: boolean;
}

export type MmrIntegrityCaseType = 
  | 'Possible Smurf'
  | 'MMR Mismatch'
  | 'Account Mismatch'
  | 'Duplicate Account'
  | 'Insufficient Evidence'
  | 'Suspicious Historical MMR'
  | 'Other'
  | 'POSSIBLE_SMURF'
  | 'DECLARED_MMR_MISMATCH'
  | 'ACCOUNT_MISMATCH'
  | 'INSUFFICIENT_EVIDENCE'
  | 'SUSPICIOUS_RECENT_RANK_CHANGES';

export interface MmrIntegrityCase {
  id: string;
  playerId: string;
  playerIgn: string;
  tournamentId?: string;
  caseType: MmrIntegrityCaseType;
  declaredMmr: number;
  openDotaMmrEstimate?: number;
  evidenceNotes: string;
  status: 'OPEN' | 'EVIDENCE_REQUESTED' | 'APPROVED' | 'CORRECTED' | 'WARNED' | 'REJECTED' | 'DISQUALIFIED' | 'ESCALATED';
  openedAt: string;
  openedByStaffId?: string;
  resolvedAt?: string;
  resolvedByStaffId?: string;
  resolutionAuditNote?: string;
  correctedMmrValue?: number;
}

export interface CaptainCareerRecord {
  tournamentsCaptained: number;
  teamsLed: string[];
  championships: number;
  finalsReached: number;
  matchWins: number;
  matchLosses: number;
  totalAuctionSpend: number;
  playersDrafted: number;
  reputationScore: number;
}

export interface DotaPlayerTournamentSnapshot {
  tournamentId: string;
  tournamentName: string;
  year: number;
  teamId: string;
  teamName: string;
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;
  lockedTournamentMmr: number;
  isCaptain: boolean;
  finalPlacement: string;
  prizeWonINR: number;
  matchesPlayed: number;
  wins: number;
  ratingBefore: number;
  ratingAfter: number;
}

export interface DotaPlayerProfile {
  id: string;
  username: string; // IGN
  displayName: string;
  avatar: string;
  city: string;
  region: string;
  bio?: string;
  steam?: SteamAccountLink;
  
  // MMR distinction
  declaredMmr: number;
  tournamentMmr: number; // Audited locked MMR
  isMmrLocked: boolean;
  mmrLockedAt?: string;
  mmrLockedBy?: string;

  // Roles
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;

  // Competitive Rating
  competitiveRating: number;
  ratingConfidence: number; // e.g. 85%
  ratingStatus: 'PROVISIONAL' | 'ESTABLISHED';
  qualifyingMatchesCount: number;

  // Careers & Snapshots
  currentTeamId?: string;
  currentTeamName?: string;
  captainRecord: CaptainCareerRecord;
  tournamentSnapshots: DotaPlayerTournamentSnapshot[];
  historicalTournamentMmrs?: HistoricalTournamentMmrRecord[];
  integrityCases: MmrIntegrityCase[];

  // Hero specialties
  heroPool: Array<{ hero: string; games: number; winRate: number }>;
}

export class DotaPlayerRegistry {
  private players = new Map<string, DotaPlayerProfile>();
  private linkedSteamIds = new Set<string>();
  private integrityCases: MmrIntegrityCase[] = [];
  private registrations = new Map<string, DotaTournamentRegistration>();
  private activeTournamentLocks = new Set<string>();
  private notifications: DotaUserNotification[] = [];

  constructor() {
    this.seedInitialPlayers();
  }

  /**
   * Links a Steam account to a player.
   * Prevents duplicate Steam ID usage and verifies format.
   */
  public linkSteamAccount(
    playerId: string,
    steamId64: string,
    accountName: string
  ): { success: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found.' };

    if (!/^\d{17}$/.test(steamId64)) {
      return { success: false, error: 'Invalid Steam64 identifier. Must be a 17-digit numeric string.' };
    }

    if (this.linkedSteamIds.has(steamId64)) {
      return { success: false, error: 'This Steam account is already linked to another Purple Bean profile.' };
    }

    // Convert Steam64 to Steam32
    const steam32 = (BigInt(steamId64) - 76561197960265728n).toString();

    player.steam = {
      steamId64,
      steamId32: steam32,
      accountName,
      avatarUrl: player.avatar,
      profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
      openDotaUrl: `https://www.opendota.com/players/${steam32}`,
      linkedAt: new Date().toISOString(),
      isVerified: true
    };

    this.linkedSteamIds.add(steamId64);
    return { success: true };
  }

  /**
   * Unlinks a Steam account if safe (player is not active in a locked tournament).
   */
  public unlinkSteamAccount(playerId: string): { success: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found.' };
    if (!player.steam) return { success: false, error: 'No Steam account is linked to this profile.' };

    // Check if player has active tournament lock
    const hasActiveLock = this.activeTournamentLocks.has(playerId) || 
      Array.from(this.registrations.values()).some(
        r => r.userId === playerId && (r.status === 'VERIFIED' || r.status === 'UNDER_REVIEW')
      );

    if (hasActiveLock) {
      return { 
        success: false, 
        error: 'Cannot unlink Steam account while registered in an active tournament. Withdraw registration or contact tournament organiser.' 
      };
    }

    this.linkedSteamIds.delete(player.steam.steamId64);
    player.steam = undefined;
    return { success: true };
  }

  /**
   * Updates player's profile info (IGN, Avatar, City, Region, Roles).
   * Validates that primary and secondary roles are distinct.
   * Does NOT modify historical tournament registration snapshots.
   */
  public updatePlayerProfile(
    playerId: string,
    updates: {
      username?: string;
      avatar?: string;
      city?: string;
      region?: string;
      bio?: string;
      primaryRole?: DotaRolePosition;
      secondaryRole?: DotaRolePosition;
      declaredMmr?: number;
    }
  ): { success: boolean; error?: string; player?: DotaPlayerProfile } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found.' };

    const newPrimary = updates.primaryRole || player.primaryRole;
    const newSecondary = updates.secondaryRole || player.secondaryRole;

    const roleValidation = validateDotaRoles(newPrimary, newSecondary);
    if (!roleValidation.valid) {
      return { success: false, error: roleValidation.error };
    }

    if (updates.username !== undefined) {
      const trimmed = updates.username.trim();
      if (!trimmed) return { success: false, error: 'In-Game Name (IGN) cannot be empty.' };
      player.username = trimmed;
      player.displayName = trimmed;
    }
    if (updates.avatar !== undefined) player.avatar = updates.avatar;
    if (updates.city !== undefined) player.city = updates.city;
    if (updates.region !== undefined) player.region = updates.region;
    if (updates.bio !== undefined) player.bio = updates.bio;
    if (updates.declaredMmr !== undefined) {
      if (typeof updates.declaredMmr !== 'number' || updates.declaredMmr < 1 || updates.declaredMmr > 15000) {
        return { success: false, error: 'Declared MMR must be a realistic number between 1 and 15,000.' };
      }
      player.declaredMmr = updates.declaredMmr;
    }
    player.primaryRole = newPrimary;
    player.secondaryRole = newSecondary;

    return { success: true, player };
  }

  /**
   * Registers a player for a tournament, snapshotting their roles, declared MMR,
   * IGN, and Steam identity. Subsequent profile updates will NOT affect this snapshot.
   */
  public submitTournamentRegistration(params: {
    tournamentId: string;
    userId: string;
    ign: string;
    primaryRole: DotaRolePosition;
    secondaryRole: DotaRolePosition;
    declaredMmr: number;
    rulesAccepted: boolean;
    city?: string;
    region?: string;
    tournamentStatus?: string;
  }): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const { tournamentId, userId, ign, primaryRole, secondaryRole, declaredMmr, rulesAccepted, city, region, tournamentStatus } = params;

    if (!rulesAccepted) {
      return { success: false, error: 'You must acknowledge and accept the tournament rules before registering.' };
    }

    if (tournamentStatus) {
      const s = tournamentStatus.toLowerCase();
      const isAllowed = s.includes('registration') || s.includes('draft') || s.includes('open') || s.includes('upcoming');
      if (!isAllowed) {
        return { success: false, error: 'Registration for this tournament is closed.' };
      }
    }

    const roleCheck = validateDotaRoles(primaryRole, secondaryRole);
    if (!roleCheck.valid) {
      return { success: false, error: roleCheck.error };
    }

    if (typeof declaredMmr !== 'number' || isNaN(declaredMmr) || declaredMmr < 1 || declaredMmr > 15000) {
      return { success: false, error: 'Declared MMR must be a valid number between 1 and 15,000.' };
    }

    // Check duplicate registration
    const regKey = `${tournamentId}__${userId}`;
    const existing = this.registrations.get(regKey);
    if (existing && existing.status !== 'WITHDRAWN' && existing.status !== 'REJECTED') {
      return { success: false, error: 'You already have an active registration for this tournament.' };
    }

    const player = this.players.get(userId);
    const steamId64 = player?.steam?.steamId64;
    const steamId32 = player?.steam?.steamId32;

    const registration: DotaTournamentRegistration = {
      id: `reg-${tournamentId}-${userId}`,
      tournamentId,
      userId,
      ign: ign || player?.username || 'Player',
      primaryRole,
      secondaryRole,
      declaredMmr,
      steamId64,
      steamId32,
      city: city || player?.city,
      region: region || player?.region,
      status: 'REGISTERED',
      rulesAccepted: true,
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.registrations.set(regKey, registration);
    return { success: true, registration };
  }

  /**
   * Withdraws a player's tournament registration if eligible.
   */
  public withdrawTournamentRegistration(
    tournamentId: string,
    userId: string,
    tournamentStatus = 'registration'
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const s = tournamentStatus.toLowerCase();
    const isAllowed = s.includes('registration') || s.includes('draft') || s.includes('open') || s.includes('upcoming');
    if (!isAllowed) {
      return { success: false, error: 'Cannot withdraw once rosters or player pools are locked.' };
    }

    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) {
      return { success: false, error: 'Registration not found.' };
    }

    if (reg.status === 'WITHDRAWN') {
      return { success: false, error: 'Registration is already withdrawn.' };
    }

    reg.status = 'WITHDRAWN';
    reg.withdrawnAt = new Date().toISOString();
    reg.updatedAt = new Date().toISOString();

    return { success: true, registration: reg };
  }

  public getRegistration(tournamentId: string, userId: string): DotaTournamentRegistration | undefined {
    return this.registrations.get(`${tournamentId}__${userId}`);
  }

  public getTournamentRegistrations(tournamentId: string): DotaTournamentRegistration[] {
    return Array.from(this.registrations.values()).filter(r => r.tournamentId === tournamentId);
  }

  /**
   * Transitions a registration to UNDER_REVIEW.
   */
  public startReview(
    tournamentId: string,
    userId: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };
    if (reg.status === 'WITHDRAWN' || reg.status === 'REJECTED') {
      return { success: false, error: `Cannot review registration in ${reg.status} state.` };
    }

    reg.status = 'UNDER_REVIEW';
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'REGISTRATION_UNDER_REVIEW',
      title: 'Registration Under Review',
      message: `Your registration for tournament ${tournamentId} is currently under organiser review.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  /**
   * Organiser requests skill or account verification evidence from a player.
   */
  public requestEvidence(
    tournamentId: string,
    userId: string,
    prompt: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    reg.status = 'EVIDENCE_REQUESTED';
    reg.evidenceRequestPrompt = prompt;
    reg.evidenceRequestedAt = new Date().toISOString();
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'EVIDENCE_REQUESTED',
      title: 'Evidence Requested',
      message: prompt || 'The organiser has requested supporting skill/identity evidence for your registration.',
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  /**
   * Player submits private evidence (screenshot URL, Steam profile URL, tournament history).
   */
  public submitEvidence(
    tournamentId: string,
    userId: string,
    evidenceData: {
      type: EvidenceType;
      fileUrl?: string;
      description: string;
    }
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration; evidenceItem?: RegistrationEvidenceItem } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    const item: RegistrationEvidenceItem = {
      id: `ev-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      registrationId: reg.id,
      userId,
      type: evidenceData.type,
      fileUrl: evidenceData.fileUrl,
      description: evidenceData.description,
      submittedAt: new Date().toISOString()
    };

    if (!reg.evidence) reg.evidence = [];
    reg.evidence.push(item);

    // If was in EVIDENCE_REQUESTED, transition back to UNDER_REVIEW
    if (reg.status === 'EVIDENCE_REQUESTED') {
      reg.status = 'UNDER_REVIEW';
    }
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'EVIDENCE_RECEIVED',
      title: 'Evidence Received',
      message: `Evidence submitted: ${evidenceData.description.slice(0, 50)}... Organiser will review.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg, evidenceItem: item };
  }

  /**
   * Organiser confirms the player's declared MMR as their Tournament MMR.
   */
  public confirmDeclaredMmr(
    tournamentId: string,
    userId: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    reg.tournamentMmr = reg.declaredMmr;
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'TOURNAMENT_MMR_CONFIRMED',
      title: 'Tournament MMR Confirmed',
      message: `Your declared MMR of ${reg.declaredMmr.toLocaleString()} has been confirmed for ${tournamentId}.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  /**
   * Organiser sets a calibrated/corrected Tournament MMR with justification.
   */
  public setCorrectedTournamentMmr(
    tournamentId: string,
    userId: string,
    correctedMmr: number,
    reason: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    if (typeof correctedMmr !== 'number' || isNaN(correctedMmr) || correctedMmr < 1 || correctedMmr > 15000) {
      return { success: false, error: 'Corrected MMR must be between 1 and 15,000.' };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'A justification reason is required when adjusting Tournament MMR.' };
    }

    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    const oldVal = reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = correctedMmr;
    if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
    reg.historicalMmrChanges.push({
      oldValue: oldVal,
      newValue: correctedMmr,
      reason,
      actor: staffId,
      timestamp: new Date().toISOString()
    });
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'TOURNAMENT_MMR_CONFIRMED',
      title: 'Tournament MMR Adjusted',
      message: `Organiser calibrated Tournament MMR from ${oldVal} to ${correctedMmr}. Reason: ${reason}`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  public ensurePlayer(userId: string, ign?: string, declaredMmr?: number): DotaPlayerProfile {
    let player = this.players.get(userId);
    if (!player) {
      const username = ign || userId;
      const mmr = declaredMmr || 6000;
      player = {
        id: userId,
        username,
        displayName: username,
        avatar: '🎮',
        city: 'Bengaluru',
        region: 'South India',
        declaredMmr: mmr,
        tournamentMmr: mmr,
        isMmrLocked: false,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        competitiveRating: 1500,
        ratingConfidence: 50,
        ratingStatus: 'PROVISIONAL',
        qualifyingMatchesCount: 0,
        captainRecord: {
          tournamentsCaptained: 0,
          teamsLed: [],
          championships: 0,
          finalsReached: 0,
          matchWins: 0,
          matchLosses: 0,
          totalAuctionSpend: 0,
          playersDrafted: 0,
          reputationScore: 100
        },
        tournamentSnapshots: [],
        historicalTournamentMmrs: [],
        integrityCases: [],
        heroPool: []
      };
      this.players.set(userId, player);
    }
    return player;
  }

  /**
   * Verifies player registration and locks Tournament MMR.
   * Only VERIFIED players enter the auction pool, captain pool, and roster selection.
   */
  public verifyRegistration(
    tournamentId: string,
    userId: string,
    staffId: string,
    confirmedTournamentMmr?: number
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    const finalMmr = confirmedTournamentMmr || reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = finalMmr;
    reg.status = 'VERIFIED';
    reg.isMmrLocked = true;
    reg.mmrLockedAt = new Date().toISOString();
    reg.mmrLockedBy = staffId;
    reg.verifiedAt = new Date().toISOString();
    reg.verifiedBy = staffId;
    reg.updatedAt = new Date().toISOString();

    // Lock player's profile Tournament MMR
    const player = this.ensurePlayer(userId, reg.ign, reg.declaredMmr);
    player.tournamentMmr = finalMmr;
    player.isMmrLocked = true;
    player.mmrLockedAt = reg.mmrLockedAt;
    player.mmrLockedBy = staffId;

    if (!player.historicalTournamentMmrs) player.historicalTournamentMmrs = [];
    const existingHistIdx = player.historicalTournamentMmrs.findIndex(h => h.tournamentId === tournamentId);
    const histRecord: HistoricalTournamentMmrRecord = {
      tournamentId,
      tournamentMmr: finalMmr,
      lockedAt: reg.mmrLockedAt,
      lockedBy: staffId
    };
    if (existingHistIdx >= 0) {
      player.historicalTournamentMmrs[existingHistIdx] = histRecord;
    } else {
      player.historicalTournamentMmrs.push(histRecord);
    }

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'REGISTRATION_VERIFIED',
      title: 'Registration Verified & Eligible!',
      message: `Your registration for ${tournamentId} is VERIFIED. Locked Tournament MMR: ${finalMmr.toLocaleString()}. You are now eligible for franchise drafts and team rosters.`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  /**
   * Correct Locked Tournament MMR.
   * Requires reason, actor, timestamp, old value, new value, and audit record.
   */
  public correctLockedTournamentMmr(
    tournamentId: string,
    userId: string,
    newMmr: number,
    reason: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    if (typeof newMmr !== 'number' || isNaN(newMmr) || newMmr < 1 || newMmr > 15000) {
      return { success: false, error: 'Tournament MMR must be between 1 and 15,000.' };
    }
    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'A justification reason is required to alter locked Tournament MMR.' };
    }

    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    const oldValue = reg.tournamentMmr || reg.declaredMmr;
    reg.tournamentMmr = newMmr;
    reg.isMmrLocked = true;
    reg.mmrLockedAt = new Date().toISOString();
    reg.mmrLockedBy = staffId;
    reg.updatedAt = new Date().toISOString();

    if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
    reg.historicalMmrChanges.push({
      oldValue,
      newValue: newMmr,
      reason,
      actor: staffId,
      timestamp: new Date().toISOString()
    });

    const player = this.ensurePlayer(userId, reg.ign, reg.declaredMmr);
    player.tournamentMmr = newMmr;
    player.isMmrLocked = true;
    if (!player.historicalTournamentMmrs) player.historicalTournamentMmrs = [];
    const hist = player.historicalTournamentMmrs.find(h => h.tournamentId === tournamentId);
    if (hist) {
      hist.tournamentMmr = newMmr;
      hist.lockedAt = new Date().toISOString();
      hist.lockedBy = staffId;
    }

    return { success: true, registration: reg };
  }

  /**
   * Organiser rejects a registration.
   */
  public rejectRegistration(
    tournamentId: string,
    userId: string,
    reason: string,
    staffId: string
  ): { success: boolean; error?: string; registration?: DotaTournamentRegistration } {
    const regKey = `${tournamentId}__${userId}`;
    const reg = this.registrations.get(regKey);
    if (!reg) return { success: false, error: 'Registration not found.' };

    reg.status = 'REJECTED';
    reg.rejectionReason = reason;
    reg.updatedAt = new Date().toISOString();

    this.addNotification({
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      type: 'REGISTRATION_REJECTED',
      title: 'Registration Rejected',
      message: `Your registration for ${tournamentId} was rejected. Reason: ${reason}`,
      tournamentId,
      registrationId: reg.id,
      createdAt: new Date().toISOString(),
      read: false
    });

    return { success: true, registration: reg };
  }

  /**
   * Retrieves registration evidence with strict privacy check:
   * Only accessible by submitting player, tournament organiser, or platform admin.
   * Captains and spectators are STRICTLY DENIED.
   */
  public getRegistrationEvidence(
    registrationId: string,
    caller: { userId: string; role: string; isAdmin?: boolean }
  ): { success: boolean; error?: string; evidence?: RegistrationEvidenceItem[] } {
    const reg = Array.from(this.registrations.values()).find(r => r.id === registrationId);
    if (!reg) return { success: false, error: 'Registration not found.' };

    const isOwner = caller.userId === reg.userId;
    const isOrganiserOrAdmin = caller.role === 'organizer' || caller.isAdmin === true;

    if (!isOwner && !isOrganiserOrAdmin) {
      return { success: false, error: 'Unauthorized: Captains, players, and spectators cannot view private evidence.' };
    }

    return { success: true, evidence: reg.evidence || [] };
  }

  /**
   * Returns only VERIFIED players eligible for auction drafting.
   */
  public getEligibleAuctionPlayers(tournamentId: string): DotaTournamentRegistration[] {
    return Array.from(this.registrations.values()).filter(
      r => r.tournamentId === tournamentId && r.status === 'VERIFIED'
    );
  }

  /**
   * Returns only VERIFIED players eligible to be appointed as captains.
   */
  public getEligibleCaptains(tournamentId: string): DotaTournamentRegistration[] {
    return Array.from(this.registrations.values()).filter(
      r => r.tournamentId === tournamentId && r.status === 'VERIFIED'
    );
  }

  public addNotification(notification: DotaUserNotification) {
    this.notifications.unshift(notification);
  }

  public getNotifications(userId: string): DotaUserNotification[] {
    return this.notifications.filter(n => n.userId === userId);
  }

  public markNotificationRead(notificationId: string) {
    const notif = this.notifications.find(n => n.id === notificationId);
    if (notif) notif.read = true;
  }

  /**
   * Sanitizes a player's record for public display with guaranteed ZERO PII.
   * Strips email, UID, legal names, phone, UPI, MMR evidence, and moderation flags.
   */
  public sanitizeForPublic(player: DotaPlayerProfile): PublicDotaPlayerProfile {
    return {
      id: player.id,
      username: player.username,
      avatar: player.avatar,
      country: 'India',
      region: player.region,
      city: player.city,
      primaryRole: player.primaryRole,
      secondaryRole: player.secondaryRole || 'Position 2 — Mid',
      currentTeamId: player.currentTeamId,
      currentTeamName: player.currentTeamName,
      competitiveRating: player.competitiveRating,
      ratingStatus: player.ratingStatus,
      tournamentMmr: player.tournamentMmr,
      isMmrLocked: player.isMmrLocked,
      tournamentCount: player.tournamentSnapshots?.length || 0,
      tournamentSnapshots: player.tournamentSnapshots || [],
      historicalTournamentMmrs: player.historicalTournamentMmrs || [],
      matchesCount: player.qualifyingMatchesCount,
      winsCount: player.tournamentSnapshots?.reduce((acc, s) => acc + s.wins, 0) || 0,
      lossesCount: player.tournamentSnapshots?.reduce((acc, s) => acc + (s.matchesPlayed - s.wins), 0) || 0,
      winRate: player.tournamentSnapshots?.length 
        ? Math.round((player.tournamentSnapshots.reduce((acc, s) => acc + s.wins, 0) / Math.max(1, player.tournamentSnapshots.reduce((acc, s) => acc + s.matchesPlayed, 0))) * 100)
        : 65,
      steamAccountLinked: Boolean(player.steam),
      steamId64Masked: player.steam ? `${player.steam.steamId64.slice(0, 4)}...${player.steam.steamId64.slice(-4)}` : undefined,
      openDotaUrl: player.steam?.openDotaUrl,
      profileUrl: player.steam?.profileUrl,
      heroPool: player.heroPool || []
    };
  }

  /**
   * Retrieves private account data accessible only by account owner or admins.
   */
  public getPrivateAccount(userId: string, email = ''): PrivateDotaPlayerAccount {
    const player = this.players.get(userId);
    return {
      userId,
      email: email || `${userId}@purplebeangaming.com`,
      steamId64: player?.steam?.steamId64,
      steamId32: player?.steam?.steamId32,
      verificationStatus: player?.steam?.isVerified ? 'VERIFIED' : player?.steam ? 'LINKED_PENDING_VERIFICATION' : 'NOT_LINKED',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Creates a new persistent player profile for a new user if not exists.
   */
  public getOrCreatePlayer(
    userId: string,
    email: string,
    initialData?: Partial<DotaPlayerProfile>
  ): DotaPlayerProfile {
    let player = this.players.get(userId);
    if (!player) {
      const defaultIgn = initialData?.username || email.split('@')[0] || `DotaWarrior_${userId.slice(-4)}`;
      player = {
        id: userId,
        username: defaultIgn,
        displayName: defaultIgn,
        avatar: initialData?.avatar || '🎮',
        city: initialData?.city || 'Bengaluru',
        region: initialData?.region || 'South India',
        bio: initialData?.bio || 'Competitive Dota 2 player on Purple Bean Gaming.',
        declaredMmr: initialData?.declaredMmr || 6000,
        tournamentMmr: initialData?.tournamentMmr || 6000,
        isMmrLocked: false,
        primaryRole: initialData?.primaryRole || 'Position 1 — Carry',
        secondaryRole: initialData?.secondaryRole || 'Position 2 — Mid',
        competitiveRating: 1500,
        ratingConfidence: 50,
        ratingStatus: 'PROVISIONAL',
        qualifyingMatchesCount: 0,
        captainRecord: {
          tournamentsCaptained: 0,
          teamsLed: [],
          championships: 0,
          finalsReached: 0,
          matchWins: 0,
          matchLosses: 0,
          totalAuctionSpend: 0,
          playersDrafted: 0,
          reputationScore: 50
        },
        tournamentSnapshots: [],
        integrityCases: [],
        heroPool: []
      };
      this.players.set(userId, player);
    }
    return player;
  }

  /**
   * Sets and locks a player's Tournament MMR for an active tournament.
   */
  public lockTournamentMmr(
    playerId: string,
    tournamentMmr: number,
    staffId = 'organiser-admin'
  ): { success: boolean; error?: string } {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found.' };

    player.tournamentMmr = tournamentMmr;
    player.isMmrLocked = true;
    player.mmrLockedAt = new Date().toISOString();
    player.mmrLockedBy = staffId;

    return { success: true };
  }

  /**
   * Flag suspicious MMR / smurf integrity case.
   * Opening a case does NOT automatically punish or reject the player.
   */
  public createIntegrityCase(
    playerId: string,
    caseType: MmrIntegrityCaseType,
    declaredMmr: number,
    evidenceNotes: string,
    tournamentId?: string,
    openedByStaffId = 'organiser-review'
  ): MmrIntegrityCase {
    const player = this.players.get(playerId);
    const ign = player ? player.username : playerId;

    const newCase: MmrIntegrityCase = {
      id: `case-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      playerId,
      playerIgn: ign,
      tournamentId,
      caseType,
      declaredMmr,
      evidenceNotes,
      status: 'OPEN',
      openedAt: new Date().toISOString(),
      openedByStaffId
    };

    this.integrityCases.push(newCase);
    if (player) {
      player.integrityCases.push(newCase);
    }

    if (tournamentId) {
      const regKey = `${tournamentId}__${playerId}`;
      const reg = this.registrations.get(regKey);
      if (reg) {
        reg.integrityCaseId = newCase.id;
        reg.updatedAt = new Date().toISOString();
      }
    }

    return newCase;
  }

  /**
   * Organiser resolves or updates an integrity case:
   * (Approve, Correct MMR, Request Evidence, Warn, Disqualify, Reject, Escalate).
   */
  public resolveIntegrityCase(
    caseId: string,
    action: 'APPROVE' | 'CORRECT_MMR' | 'REQUEST_EVIDENCE' | 'WARN' | 'DISQUALIFY' | 'REJECT' | 'ESCALATE',
    note: string,
    staffId: string,
    correctedMmr?: number
  ): { success: boolean; error?: string } {
    const targetCase = this.integrityCases.find(c => c.id === caseId);
    if (!targetCase) return { success: false, error: 'Integrity case not found.' };

    targetCase.resolvedAt = new Date().toISOString();
    targetCase.resolvedByStaffId = staffId;
    targetCase.resolutionAuditNote = note;

    const player = this.players.get(targetCase.playerId);

    if (action === 'APPROVE') {
      targetCase.status = 'APPROVED';
    } else if (action === 'CORRECT_MMR' && correctedMmr && player) {
      targetCase.status = 'CORRECTED';
      targetCase.correctedMmrValue = correctedMmr;
      player.tournamentMmr = correctedMmr;
      player.isMmrLocked = true;
      player.mmrLockedBy = staffId;

      if (targetCase.tournamentId) {
        const regKey = `${targetCase.tournamentId}__${targetCase.playerId}`;
        const reg = this.registrations.get(regKey);
        if (reg) {
          reg.tournamentMmr = correctedMmr;
          if (!reg.historicalMmrChanges) reg.historicalMmrChanges = [];
          reg.historicalMmrChanges.push({
            oldValue: reg.declaredMmr,
            newValue: correctedMmr,
            reason: `Integrity Case Resolution (${targetCase.caseType}): ${note}`,
            actor: staffId,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else if (action === 'REQUEST_EVIDENCE') {
      targetCase.status = 'EVIDENCE_REQUESTED';
      if (targetCase.tournamentId) {
        this.requestEvidence(targetCase.tournamentId, targetCase.playerId, note, staffId);
      }
    } else if (action === 'ESCALATE') {
      targetCase.status = 'ESCALATED';
    } else if (action === 'WARN') {
      targetCase.status = 'WARNED';
    } else if (action === 'DISQUALIFY') {
      targetCase.status = 'DISQUALIFIED';
      if (targetCase.tournamentId) {
        this.rejectRegistration(targetCase.tournamentId, targetCase.playerId, `Disqualified via integrity case: ${note}`, staffId);
      }
    } else if (action === 'REJECT') {
      targetCase.status = 'REJECTED';
      if (targetCase.tournamentId) {
        this.rejectRegistration(targetCase.tournamentId, targetCase.playerId, `Rejected via integrity review: ${note}`, staffId);
      }
    }

    return { success: true };
  }

  public getPlayer(id: string): DotaPlayerProfile | undefined {
    return this.players.get(id);
  }

  public getAllPlayers(): DotaPlayerProfile[] {
    return Array.from(this.players.values());
  }

  public getIntegrityCases(): MmrIntegrityCase[] {
    return [...this.integrityCases];
  }

  public seedInitialPlayers() {
    this.players = new Map();
    this.linkedSteamIds = new Set<string>();
    this.registrations = new Map();
    this.integrityCases = [];
    this.notifications = [];

    const rawData = [
      { id: 'p-c1', ign: 'Aether', name: 'Arjun Nair', avatar: '⚡', city: 'Mumbai', region: 'West India', mmr: 5850, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', cap: true, wins: 42, losses: 18 },
      { id: 'p-c2', ign: 'Nova', name: 'Rohan Sharma', avatar: '🔥', city: 'Delhi', region: 'North India', mmr: 5600, pRole: 'Position 1 — Carry', sRole: 'Position 3 — Offlane', cap: true, wins: 38, losses: 20 },
      { id: 'p-c3', ign: 'Karma', name: 'Karthik Raja', avatar: '🛡️', city: 'Bengaluru', region: 'South India', mmr: 5400, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', cap: true, wins: 35, losses: 22 },
      { id: 'p-01', ign: 'Viper', name: 'Vikram Singh', avatar: '🐍', city: 'Hyderabad', region: 'South India', mmr: 5900, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', cap: false, wins: 30, losses: 12 },
      { id: 'p-02', ign: 'Shadow', name: 'Sameer Sen', avatar: '🗡️', city: 'Kolkata', region: 'East India', mmr: 5750, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', cap: false, wins: 29, losses: 14 },
      { id: 'p-03', ign: 'Bulldozer', name: 'Baljit Gill', avatar: '🦏', city: 'Chandigarh', region: 'North India', mmr: 5500, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', cap: false, wins: 24, losses: 16 },
      { id: 'p-04', ign: 'Chakra', name: 'Chaitanya Joshi', avatar: '🔮', city: 'Pune', region: 'West India', mmr: 5350, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', cap: false, wins: 28, losses: 15 },
      { id: 'p-05', ign: 'Zenith', name: 'Zaid Khan', avatar: '🌟', city: 'Mumbai', region: 'West India', mmr: 5200, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', cap: false, wins: 22, losses: 18 }
    ];

    rawData.forEach(d => {
      const steam32 = (120000000 + Math.floor(Math.random() * 500000)).toString();
      const steam64 = (76561197960265728n + BigInt(steam32)).toString();

      const profile: DotaPlayerProfile = {
        id: d.id,
        username: d.ign,
        displayName: d.name,
        avatar: d.avatar,
        city: d.city,
        region: d.region,
        bio: `Competitive Dota 2 athlete from ${d.city}. Specializes in ${d.pRole}.`,
        declaredMmr: d.mmr,
        tournamentMmr: d.mmr,
        isMmrLocked: true,
        mmrLockedAt: '2026-09-01T10:00:00Z',
        mmrLockedBy: 'system-seed',
        primaryRole: d.pRole as DotaRolePosition,
        secondaryRole: d.sRole as DotaRolePosition,
        competitiveRating: Math.round(d.mmr / 4) + 100,
        ratingConfidence: 90,
        ratingStatus: 'ESTABLISHED',
        qualifyingMatchesCount: d.wins + d.losses,
        steam: {
          steamId64: steam64,
          steamId32: steam32,
          accountName: `${d.ign}_steam`,
          avatarUrl: d.avatar,
          profileUrl: `https://steamcommunity.com/profiles/${steam64}`,
          openDotaUrl: `https://www.opendota.com/players/${steam32}`,
          linkedAt: '2026-08-15T12:00:00Z',
          isVerified: true
        },
        captainRecord: {
          tournamentsCaptained: d.cap ? 3 : 0,
          teamsLed: d.cap ? [`${d.ign}'s Squad`] : [],
          championships: d.cap && d.ign === 'Aether' ? 1 : 0,
          finalsReached: d.cap ? 2 : 0,
          matchWins: d.wins,
          matchLosses: d.losses,
          totalAuctionSpend: d.cap ? 2850 : 0,
          playersDrafted: d.cap ? 12 : 0,
          reputationScore: 95
        },
        tournamentSnapshots: [
          {
            tournamentId: 'purple-bean-test-cup',
            tournamentName: 'Purple Bean Test Cup',
            year: 2026,
            teamId: d.ign === 'Aether' ? 'tc-team-1' : 'tc-team-2',
            teamName: d.ign === 'Aether' ? 'Mumbai Mavericks' : 'Hyderabad Raiders',
            primaryRole: d.pRole as DotaRolePosition,
            lockedTournamentMmr: d.mmr,
            isCaptain: d.cap,
            finalPlacement: d.ign === 'Aether' ? 'Champion (1st Place)' : 'Runner-up (2nd Place)',
            prizeWonINR: d.ign === 'Aether' ? 15000 : 7000,
            matchesPlayed: 2,
            wins: d.ign === 'Aether' ? 2 : 1,
            ratingBefore: 1540,
            ratingAfter: 1564
          }
        ],
        integrityCases: [],
        heroPool: [
          { hero: 'Storm Spirit', games: 15, winRate: 73 },
          { hero: 'Shadow Fiend', games: 12, winRate: 67 },
          { hero: 'Invoker', games: 18, winRate: 61 }
        ]
      };

      this.players.set(profile.id, profile);
      this.linkedSteamIds.add(steam64);
    });
  }
}

export const dotaPlayerRegistry = new DotaPlayerRegistry();
export const dotaPlayerEngine = dotaPlayerRegistry;
