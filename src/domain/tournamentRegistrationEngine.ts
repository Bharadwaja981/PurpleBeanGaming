/**
 * Purple Bean Gaming — Tournament Registration, Eligibility & Captain Selection Engine
 * 
 * Authoritative business logic for:
 * - Tournament registration lifecycle (REGISTRATION_OPEN -> REGISTRATION_CLOSED -> ELIGIBILITY_REVIEW -> CAPTAIN_SELECTION -> AUCTION_READY)
 * - Strict Eligibility Checks (PASS / REVIEW / FAIL)
 * - Immutable Identity & Tournament Data Snapshots
 * - Authoritative Participant Creation & Auction Separation
 * - Captain Application & Slot Assignment
 * - Auction Readiness Verification Contract
 */

import { pbgAccountRegistry } from './pbgAccountRegistry';

export type TournamentRegistrationStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'WAITLISTED'
  | 'WITHDRAWN'
  | 'DISQUALIFIED';

export type EligibilityStatus = 
  | 'ELIGIBLE'
  | 'REVIEW_REQUIRED'
  | 'INELIGIBLE';

export type EligibilityCheckSeverity = 'PASS' | 'REVIEW' | 'FAIL';

export interface EligibilityCheckResult {
  code: string;
  passed: boolean;
  severity: EligibilityCheckSeverity;
  message: string;
}

export type DotaCompetitiveRole = 
  | 'Position 1 — Carry'
  | 'Position 2 — Mid'
  | 'Position 3 — Offlane'
  | 'Position 4 — Soft Support'
  | 'Position 5 — Hard Support';

export const DOTA_COMPETITIVE_ROLES: DotaCompetitiveRole[] = [
  'Position 1 — Carry',
  'Position 2 — Mid',
  'Position 3 — Offlane',
  'Position 4 — Soft Support',
  'Position 5 — Hard Support'
];

export interface IdentitySnapshot {
  pbgId: string;
  displayName: string;
  discordUserId?: string;
  discordUsername?: string;
  dotaAccountId?: string;
  steamId?: string;
  email?: string;
}

export interface TournamentRegistrationData {
  declaredMMR: number;
  tournamentMMR: number;
  primaryRole: DotaCompetitiveRole | string;
  secondaryRole: DotaCompetitiveRole | string;
  captainApplicant: boolean;
  availabilityConfirmed: boolean;
  rulesAccepted: boolean;
  customFields?: Record<string, any>;
}

export type TournamentParticipantRole = 'PLAYER' | 'CAPTAIN';
export type TournamentParticipantAuctionStatus = 'AVAILABLE' | 'NOT_IN_POOL' | 'SOLD' | 'UNSOLD';

export interface TournamentRegistrationRecord {
  id: string; // userId
  tournamentId: string;
  userId: string;
  pbgId: string;
  status: TournamentRegistrationStatus;
  eligibilityStatus: EligibilityStatus;
  captainApplicant?: boolean;
  interestedInCaptaincy?: boolean;
  applyingAsCaptain?: boolean;
  ign?: string;
  primaryRole: string;
  secondaryRole: string;
  declaredMMR: number;
  tournamentMMR: number;
  submittedAt?: string;
  createdAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  identitySnapshot: IdentitySnapshot;
  tournamentData?: TournamentRegistrationData;
  eligibilityChecks: EligibilityCheckResult[];
  isTestAccount?: boolean;
  source?: string;
  updatedAt: string;
}

export interface TournamentParticipantRecord {
  userId: string;
  tournamentId: string;
  registrationId: string;
  pbgId: string;
  displayName: string;
  participantStatus: 'ACTIVE' | 'INACTIVE';
  tournamentRole: TournamentParticipantRole;
  auctionStatus: TournamentParticipantAuctionStatus;
  captainSlotId: string | null;
  teamId: string | null;
  eliminated: boolean;
  isTestAccount?: boolean;
  source?: string;
  joinedAt: string;
  updatedAt: string;
}

export interface CaptainSlotRecord {
  captainSlotId: string; // e.g. "slot-1", "slot-2"
  tournamentId: string;
  userId: string;
  pbgId: string;
  displayName: string;
  teamId: string | null;
  selectedAt: string;
  selectedBy: string;
}

export interface TournamentTeamDiscordMapping {
  roleId: string;
  roleName: string;
  createdAt: string;
}

export interface TournamentTeamRecord {
  id: string;
  tournamentId: string;
  name: string;
  tag: string;
  captainUserId: string;
  roster: string[]; // userIds
  discord?: TournamentTeamDiscordMapping;
  status: 'ACTIVE' | 'ELIMINATED';
  eliminatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentDiscordConfig {
  enabled: boolean;
  guildId: string;
  roles: {
    tournamentPlayerRoleId: string;
    captainRoleId: string;
  };
  teamRolesEnabled: boolean;
  cleanupPolicy: {
    onElimination: boolean;
    onTournamentCompletion: boolean;
  };
}

export interface DiscordSyncJobRecord {
  id: string;
  type: 
    | 'SYNC_TOURNAMENT_ROLES' 
    | 'CLEANUP_ELIMINATED_TEAM' 
    | 'CLEANUP_TOURNAMENT_COMPLETION'
    | 'SYNC_USER_GLOBAL_ROLES'
    | 'CLEANUP_TOURNAMENT_DISCORD'
    | 'DELETE_TOURNAMENT_TEAM_ROLES';
  tournamentId: string;
  userId?: string;
  teamId?: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

export type TournamentRegistrationLifecycle = 
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'ELIGIBILITY_REVIEW'
  | 'CAPTAIN_SELECTION'
  | 'AUCTION_READY';

export interface RegistrationValidationInput {
  userId: string;
  tournamentId: string;
  pbgAccount: {
    pbgId?: string;
    displayName?: string;
    email?: string;
    accountStatus?: string;
    dotaAccountLinked?: boolean;
    dotaAccountVerified?: boolean;
    dotaAccountId?: string;
    steamId?: string;
    discordLinked?: boolean;
    discordUserId?: string;
    discordUsername?: string;
    discordMemberVerified?: boolean;
    pbgMemberRoleActive?: boolean;
    isBanned?: boolean;
    isTestAccount?: boolean;
    source?: string;
  } | null;
  tournament: {
    id: string;
    status: string;
    testMode?: boolean;
    registrationLifecycle?: TournamentRegistrationLifecycle;
    minMmr?: number;
    maxMmr?: number;
    maxParticipants?: number;
    discordRequired?: boolean;
    dotaRequired?: boolean;
  };
  formData: {
    declaredMMR: number;
    primaryRole: string;
    secondaryRole: string;
    captainApplicant: boolean;
    availabilityConfirmed: boolean;
    rulesAccepted: boolean;
  };
  existingRegistrations?: TournamentRegistrationRecord[];
}

export interface AuctionReadinessBlocker {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface AuctionReadinessReport {
  isReady: boolean;
  ready: boolean;
  lifecycle: TournamentRegistrationLifecycle;
  blockers: AuctionReadinessBlocker[];
  blockingIssues: string[]; // human readable list for UI display
  captains: TournamentParticipantRecord[];
  auctionPool: TournamentParticipantRecord[];
  totalApproved: number;
  totalCaptains: number;
  totalAuctionPool: number;
  targetCaptainCount: number;
  checks: {
    registrationsClosed: boolean;
    eligibilityComplete: boolean;
    requiredCaptainsSelected: boolean;
    uniqueCaptainSlots: boolean;
    captainsExcludedFromPool: boolean;
    playersAvailable: boolean;
    discordLinkageValidForAll: boolean;
    pbgMemberRoleRetained: boolean;
    allApprovedRepresented: boolean;
    noDuplicateIdentities: boolean;
    noConflictingTeams: boolean;
    tournamentConfigValid: boolean;
    noUnresolvedReviewItems: boolean;
  };
}

/**
 * -------------------------------------------------------------
 * DETERMINISTIC ELIGIBILITY ENGINE
 * -------------------------------------------------------------
 */
export function evaluateRegistrationEligibility(
  input: RegistrationValidationInput
): {
  overallStatus: EligibilityStatus;
  checks: EligibilityCheckResult[];
} {
  const checks: EligibilityCheckResult[] = [];
  const { pbgAccount, tournament, formData, existingRegistrations = [] } = input;

  // 1. PBG Profile Complete
  if (!pbgAccount || !pbgAccount.pbgId) {
    checks.push({
      code: 'PBG_PROFILE_COMPLETE',
      passed: false,
      severity: 'FAIL',
      message: 'Active PBG account and permanent PBG ID required.'
    });
  } else if (pbgAccount.isBanned || pbgAccount.accountStatus === 'BANNED' || pbgAccount.accountStatus === 'SUSPENDED') {
    checks.push({
      code: 'PLAYER_BANNED',
      passed: false,
      severity: 'FAIL',
      message: 'Account is currently suspended or disqualified from tournament play.'
    });
  } else {
    checks.push({
      code: 'PBG_PROFILE_COMPLETE',
      passed: true,
      severity: 'PASS',
      message: `PBG Profile verified: ${pbgAccount.pbgId} (${pbgAccount.displayName || 'Player'}).`
    });
  }

  // 2. Dota 2 / Steam Linking
  const isTestBypass = Boolean(
    tournament.testMode && (pbgAccount?.isTestAccount || (pbgAccount as any)?.source === 'TEST_SEED')
  );

  if (isTestBypass) {
    checks.push({
      code: 'TEST_IDENTITY_BYPASS',
      passed: true,
      severity: 'PASS',
      message: 'TEST IDENTITY: External identity checks bypassed.'
    });
    checks.push({
      code: 'DOTA_LINK_REQUIRED',
      passed: true,
      severity: 'PASS',
      message: 'TEST IDENTITY: External Dota 2 link bypassed.'
    });
    checks.push({
      code: 'DISCORD_LINK_REQUIRED',
      passed: true,
      severity: 'PASS',
      message: 'TEST IDENTITY: External Discord link bypassed.'
    });
    checks.push({
      code: 'PBG_MEMBER_ROLE_REQUIRED',
      passed: true,
      severity: 'PASS',
      message: 'TEST IDENTITY: PBG Member role bypassed.'
    });
  } else {
    const dotaRequired = tournament.dotaRequired !== false;
    if (dotaRequired) {
      if (!pbgAccount?.dotaAccountLinked || !pbgAccount?.dotaAccountId) {
        checks.push({
          code: 'DOTA_LINK_REQUIRED',
          passed: false,
          severity: 'FAIL',
          message: 'Dota 2 Friend ID & Steam verification required for tournament entry.'
        });
      } else if (!pbgAccount.dotaAccountVerified) {
        checks.push({
          code: 'DOTA_LINK_REQUIRED',
          passed: false,
          severity: 'REVIEW',
          message: 'Dota 2 account is linked but pending OpenDota ownership verification.'
        });
      } else {
        checks.push({
          code: 'DOTA_LINK_REQUIRED',
          passed: true,
          severity: 'PASS',
          message: `Dota 2 account verified: Friend ID ${pbgAccount.dotaAccountId}.`
        });
      }
    }

    // 3. Discord Linking (Mandatory for PBG Auction Tournaments)
    const discordRequired = tournament.discordRequired !== false;
    if (discordRequired) {
      if (!pbgAccount?.discordLinked || !pbgAccount?.discordUserId) {
        checks.push({
          code: 'DISCORD_LINK_REQUIRED',
          passed: false,
          severity: 'FAIL',
          message: 'Discord account linking is required. Connect Discord to register.'
        });
      } else {
        checks.push({
          code: 'DISCORD_LINK_REQUIRED',
          passed: true,
          severity: 'PASS',
          message: `Discord linked: ${pbgAccount.discordUsername || pbgAccount.discordUserId}.`
        });

        // 4. PBG Member Role in Discord Server
        if (pbgAccount.pbgMemberRoleActive === false) {
          checks.push({
            code: 'PBG_MEMBER_ROLE_REQUIRED',
            passed: false,
            severity: 'REVIEW',
            message: 'Discord linked but PBG Member role verification needs reconciliation.'
          });
        } else {
          checks.push({
            code: 'PBG_MEMBER_ROLE_REQUIRED',
            passed: true,
            severity: 'PASS',
            message: 'Official PBG Discord Member status confirmed.'
          });
        }
      }
    }
  }

  // 5. Competitive Role Selection: primary != secondary
  const primaryRole = formData.primaryRole?.trim();
  const secondaryRole = formData.secondaryRole?.trim();

  if (!primaryRole || !secondaryRole) {
    checks.push({
      code: 'ROLE_SELECTION_INVALID',
      passed: false,
      severity: 'FAIL',
      message: 'Both primary and secondary competitive positions must be selected.'
    });
  } else if (primaryRole.toLowerCase() === secondaryRole.toLowerCase()) {
    checks.push({
      code: 'ROLE_SELECTION_INVALID',
      passed: false,
      severity: 'FAIL',
      message: 'Primary and secondary roles cannot be the same position.'
    });
  } else {
    checks.push({
      code: 'ROLE_SELECTION_INVALID',
      passed: true,
      severity: 'PASS',
      message: `Roles validated: ${primaryRole} (Main) / ${secondaryRole} (Secondary).`
    });
  }

  // 6. MMR Constraints
  const mmr = Number(formData.declaredMMR) || 0;
  if (mmr <= 0 || mmr > 16000) {
    checks.push({
      code: 'MMR_OUT_OF_RANGE',
      passed: false,
      severity: 'FAIL',
      message: 'Declared MMR must be a realistic competitive rating between 1 and 16,000.'
    });
  } else if (tournament.minMmr && mmr < tournament.minMmr) {
    checks.push({
      code: 'MMR_OUT_OF_RANGE',
      passed: false,
      severity: 'FAIL',
      message: `MMR (${mmr}) is below tournament minimum entry requirement of ${tournament.minMmr}.`
    });
  } else if (tournament.maxMmr && mmr > tournament.maxMmr) {
    checks.push({
      code: 'MMR_OUT_OF_RANGE',
      passed: false,
      severity: 'REVIEW',
      message: `MMR (${mmr}) exceeds standard tournament bracket cap of ${tournament.maxMmr}. Organiser review required.`
    });
  } else {
    checks.push({
      code: 'MMR_OUT_OF_RANGE',
      passed: true,
      severity: 'PASS',
      message: `MMR calibrated: ${mmr.toLocaleString()} MMR.`
    });
  }

  // 7. Duplicate Identity Detection
  if (pbgAccount) {
    const otherRegistrations = existingRegistrations.filter(r => r.userId !== input.userId);
    
    // Check if current user is already registered in active state
    const existingSelf = existingRegistrations.find(
      r => r.userId === input.userId && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN'
    );
    if (existingSelf) {
      checks.push({
        code: 'ALREADY_REGISTERED',
        passed: false,
        severity: 'FAIL',
        message: `User ${input.userId} already has an active registration for this tournament (${existingSelf.status}).`
      });
    }

    // Duplicate PBG ID check
    if (pbgAccount.pbgId) {
      const duplicatePbg = otherRegistrations.find(
        r => r.pbgId === pbgAccount.pbgId && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN'
      );
      if (duplicatePbg) {
        checks.push({
          code: 'DUPLICATE_PBG_ID',
          passed: false,
          severity: 'FAIL',
          message: `PBG Account ${pbgAccount.pbgId} is already registered under participant ${duplicatePbg.userId}.`
        });
      }
    }

    // Duplicate Dota Account ID check
    if (pbgAccount.dotaAccountId) {
      const duplicateDota = otherRegistrations.find(
        r => r.identitySnapshot?.dotaAccountId === pbgAccount.dotaAccountId && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN'
      );
      if (duplicateDota) {
        checks.push({
          code: 'DUPLICATE_DOTA_ID',
          passed: false,
          severity: 'FAIL',
          message: `Dota Friend ID ${pbgAccount.dotaAccountId} is already registered under participant ${duplicateDota.pbgId}.`
        });
      }
    }

    // Duplicate Steam ID check
    if (pbgAccount.steamId) {
      const duplicateSteam = otherRegistrations.find(
        r => r.identitySnapshot?.steamId === pbgAccount.steamId && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN'
      );
      if (duplicateSteam) {
        checks.push({
          code: 'DUPLICATE_STEAM_ID',
          passed: false,
          severity: 'FAIL',
          message: `Steam ID ${pbgAccount.steamId} is already registered under participant ${duplicateSteam.pbgId}.`
        });
      }
    }

    // Duplicate Discord User ID check
    if (pbgAccount.discordUserId) {
      const duplicateDiscord = otherRegistrations.find(
        r => r.identitySnapshot?.discordUserId === pbgAccount.discordUserId && r.status !== 'REJECTED' && r.status !== 'WITHDRAWN'
      );
      if (duplicateDiscord) {
        checks.push({
          code: 'DUPLICATE_DISCORD_ID',
          passed: false,
          severity: 'FAIL',
          message: `Discord account is already registered under participant ${duplicateDiscord.pbgId}.`
        });
      }
    }
  }

  // 8. Tournament Capacity Check
  if (tournament.maxParticipants && tournament.maxParticipants > 0) {
    const approvedOrSubmitted = existingRegistrations.filter(
      r => (r.status === 'APPROVED' || r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW') && r.userId !== input.userId
    );
    if (approvedOrSubmitted.length >= tournament.maxParticipants) {
      checks.push({
        code: 'TOURNAMENT_FULL',
        passed: false,
        severity: 'REVIEW',
        message: `Tournament capacity of ${tournament.maxParticipants} reached. New registrations will be placed on WAITLIST.`
      });
    }
  }

  // Compute Overall Status:
  // all PASS -> ELIGIBLE
  // at least one REVIEW and no FAIL -> REVIEW_REQUIRED
  // at least one FAIL -> INELIGIBLE
  const hasFail = checks.some(c => c.severity === 'FAIL' || !c.passed && c.severity !== 'REVIEW');
  const hasReview = checks.some(c => c.severity === 'REVIEW');

  let overallStatus: EligibilityStatus = 'ELIGIBLE';
  if (hasFail) {
    overallStatus = 'INELIGIBLE';
  } else if (hasReview) {
    overallStatus = 'REVIEW_REQUIRED';
  }

  return {
    overallStatus,
    checks
  };
}

/**
 * -------------------------------------------------------------
 * REGISTRATION SNAPSHOT GENERATOR
 * -------------------------------------------------------------
 * Creates immutable snapshot preventing subsequent profile edits from silently altering historical tournament data.
 */
export function createRegistrationSnapshot(params: {
  userId: string;
  tournamentId: string;
  pbgAccount: {
    pbgId: string;
    displayName: string;
    email?: string;
    dotaAccountId?: string;
    steamId?: string;
    discordUserId?: string;
    discordUsername?: string;
  };
  formData: TournamentRegistrationData;
  eligibilityChecks: EligibilityCheckResult[];
  eligibilityStatus: EligibilityStatus;
  initialStatus?: TournamentRegistrationStatus;
}): TournamentRegistrationRecord {
  const {
    userId,
    tournamentId,
    pbgAccount,
    formData,
    eligibilityChecks,
    eligibilityStatus,
    initialStatus
  } = params;

  const now = new Date().toISOString();

  // If tournament capacity is full or checks require waitlist, assign WAITLISTED
  let assignedStatus: TournamentRegistrationStatus = initialStatus || 'SUBMITTED';
  const isCapacityFull = eligibilityChecks.some(c => c.code === 'TOURNAMENT_FULL');
  if (isCapacityFull && assignedStatus === 'SUBMITTED') {
    assignedStatus = 'WAITLISTED';
  } else if (eligibilityStatus === 'REVIEW_REQUIRED' && assignedStatus === 'SUBMITTED') {
    assignedStatus = 'UNDER_REVIEW';
  }

  return {
    id: userId,
    tournamentId,
    userId,
    pbgId: pbgAccount.pbgId,
    status: assignedStatus,
    eligibilityStatus,
    captainApplicant: Boolean(formData.captainApplicant),
    primaryRole: formData.primaryRole,
    secondaryRole: formData.secondaryRole,
    declaredMMR: formData.declaredMMR,
    tournamentMMR: formData.tournamentMMR || formData.declaredMMR,
    submittedAt: now,
    updatedAt: now,
    identitySnapshot: {
      pbgId: pbgAccount.pbgId,
      displayName: pbgAccount.displayName || pbgAccount.pbgId,
      email: pbgAccount.email,
      dotaAccountId: pbgAccount.dotaAccountId,
      steamId: pbgAccount.steamId,
      discordUserId: pbgAccount.discordUserId,
      discordUsername: pbgAccount.discordUsername
    },
    tournamentData: {
      declaredMMR: formData.declaredMMR,
      tournamentMMR: formData.tournamentMMR || formData.declaredMMR,
      primaryRole: formData.primaryRole,
      secondaryRole: formData.secondaryRole,
      captainApplicant: Boolean(formData.captainApplicant),
      availabilityConfirmed: Boolean(formData.availabilityConfirmed),
      rulesAccepted: Boolean(formData.rulesAccepted),
      customFields: formData.customFields || {}
    },
    eligibilityChecks
  };
}

/**
 * -------------------------------------------------------------
 * PARTICIPANT CREATION & SEPARATION RULES
 * -------------------------------------------------------------
 */

export function createParticipantFromApprovedRegistration(
  regOrOptions:
    | TournamentRegistrationRecord
    | {
        registration: TournamentRegistrationRecord;
        tournamentRole?: TournamentParticipantRole;
        captainSlotId?: string | null;
        isTestAccount?: boolean;
        source?: string;
        existingParticipant?: TournamentParticipantRecord | null;
      },
  maybeExistingParticipant?: TournamentParticipantRecord | null
): TournamentParticipantRecord {
  const isOptions = typeof regOrOptions === 'object' && regOrOptions !== null && 'registration' in regOrOptions;
  const reg: TournamentRegistrationRecord = isOptions
    ? (regOrOptions as { registration: TournamentRegistrationRecord }).registration
    : (regOrOptions as TournamentRegistrationRecord);
  const options = isOptions ? (regOrOptions as {
    registration: TournamentRegistrationRecord;
    tournamentRole?: TournamentParticipantRole;
    captainSlotId?: string | null;
    isTestAccount?: boolean;
    source?: string;
    existingParticipant?: TournamentParticipantRecord | null;
  }) : null;

  const existingParticipant = options?.existingParticipant ?? maybeExistingParticipant ?? null;
  const now = new Date().toISOString();

  const isCap = options?.tournamentRole === 'CAPTAIN' ||
    Boolean(options?.captainSlotId) ||
    existingParticipant?.tournamentRole === 'CAPTAIN';

  const capSlot = options?.captainSlotId !== undefined
    ? options.captainSlotId
    : (existingParticipant?.captainSlotId || null);

  const effectiveRole: TournamentParticipantRole = isCap ? 'CAPTAIN' : (options?.tournamentRole || existingParticipant?.tournamentRole || 'PLAYER');
  const effectiveAuctionStatus: TournamentParticipantAuctionStatus = isCap
    ? 'NOT_IN_POOL'
    : (existingParticipant?.auctionStatus === 'NOT_IN_POOL' ? 'AVAILABLE' : (existingParticipant?.auctionStatus || 'AVAILABLE'));

  if (existingParticipant) {
    return {
      ...existingParticipant,
      participantStatus: 'ACTIVE',
      pbgId: reg.pbgId,
      displayName: reg.identitySnapshot?.displayName || existingParticipant.displayName || reg.pbgId || reg.userId,
      registrationId: reg.id,
      tournamentRole: effectiveRole,
      captainSlotId: capSlot,
      auctionStatus: effectiveAuctionStatus,
      eliminated: false,
      isTestAccount: options?.isTestAccount ?? reg.isTestAccount,
      source: options?.source ?? reg.source,
      updatedAt: now
    };
  }

  return {
    userId: reg.userId,
    tournamentId: reg.tournamentId,
    registrationId: reg.id,
    pbgId: reg.pbgId,
    displayName: reg.identitySnapshot?.displayName || reg.pbgId || reg.userId,
    participantStatus: 'ACTIVE',
    tournamentRole: effectiveRole,
    auctionStatus: effectiveAuctionStatus,
    captainSlotId: capSlot,
    teamId: null,
    eliminated: false,
    isTestAccount: options?.isTestAccount ?? reg.isTestAccount,
    source: options?.source ?? reg.source,
    joinedAt: now,
    updatedAt: now
  };
}

/**
 * Assigns a participant to an authoritative Captain Slot.
 * Crucial Invariant: Selected captains are immediately marked NOT_IN_POOL
 * and MUST NEVER appear in the auction bidding pool.
 */
export function assignParticipantAsCaptain(
  participant: TournamentParticipantRecord,
  captainSlotId: string
): TournamentParticipantRecord {
  return {
    ...participant,
    tournamentRole: 'CAPTAIN',
    auctionStatus: 'NOT_IN_POOL',
    captainSlotId,
    teamId: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Removes captain role from participant, returning them to the regular available player pool.
 */
export function removeParticipantFromCaptain(
  participant: TournamentParticipantRecord
): TournamentParticipantRecord {
  return {
    ...participant,
    tournamentRole: 'PLAYER',
    auctionStatus: 'AVAILABLE',
    captainSlotId: null,
    updatedAt: new Date().toISOString()
  };
}

/**
 * -------------------------------------------------------------
 * AUCTION READINESS CONTRACT VALIDATOR
 * -------------------------------------------------------------
 * Authoritative validator checking all 12 prerequisites before tournament auction can commence.
 * Returns structured blockers with machine-readable codes.
 */
export function validateAuctionReadiness(params: {
  lifecycle: TournamentRegistrationLifecycle;
  participants: TournamentParticipantRecord[];
  registrations: TournamentRegistrationRecord[];
  targetCaptainCount?: number;
  testMode?: boolean;
}): AuctionReadinessReport {
  const { lifecycle, participants, registrations, targetCaptainCount = 4, testMode = false } = params;
  const blockers: AuctionReadinessBlocker[] = [];
  const blockingIssues: string[] = [];

  const addBlocker = (code: string, message: string, details?: Record<string, any>) => {
    blockers.push({ code, message, details });
    blockingIssues.push(`[${code}] ${message}`);
  };

  const activeParticipants = participants.filter(p => p.participantStatus === 'ACTIVE');
  const captains = activeParticipants.filter(p => p.tournamentRole === 'CAPTAIN' || p.captainSlotId !== null);
  const auctionPool = activeParticipants.filter(
    p => p.tournamentRole === 'PLAYER' && p.auctionStatus === 'AVAILABLE' && p.captainSlotId === null && p.teamId === null
  );

  // Check 1: Registration closed
  const registrationsClosed = lifecycle !== 'REGISTRATION_OPEN';
  if (!registrationsClosed) {
    addBlocker(
      'REGISTRATION_NOT_CLOSED',
      'Tournament registration is still open. Registrations must be closed prior to auction.',
      { currentLifecycle: lifecycle }
    );
  }

  // Check 2: No unresolved blocking eligibility reviews
  const unresolvedRegistrations = registrations.filter(
    r => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW' || r.eligibilityStatus === 'REVIEW_REQUIRED'
  );
  const ineligibleApproved = registrations.filter(
    r => {
      // In testMode, dummy test accounts (isTestAccount === true) bypass external checks
      if (testMode && (r.isTestAccount || r.source === 'TEST_SEED')) return false;
      return r.status === 'APPROVED' && (r.eligibilityStatus === 'INELIGIBLE' || r.eligibilityChecks?.some(c => c.severity === 'FAIL'));
    }
  );
  const eligibilityComplete = unresolvedRegistrations.length === 0 && ineligibleApproved.length === 0;
  if (unresolvedRegistrations.length > 0) {
    addBlocker(
      'UNRESOLVED_ELIGIBILITY_REVIEWS',
      `${unresolvedRegistrations.length} registration(s) possess unresolved eligibility reviews or pending statuses.`,
      { count: unresolvedRegistrations.length, userIds: unresolvedRegistrations.map(r => r.userId) }
    );
  }
  if (ineligibleApproved.length > 0) {
    addBlocker(
      'APPROVED_INELIGIBLE_REGISTRATION',
      `${ineligibleApproved.length} approved registration(s) possess failed eligibility checks.`,
      { count: ineligibleApproved.length, userIds: ineligibleApproved.map(r => r.userId) }
    );
  }

  // Check 3: Tournament configuration validity
  const tournamentConfigValid = targetCaptainCount >= 2;
  if (!tournamentConfigValid) {
    addBlocker(
      'INVALID_TOURNAMENT_CONFIG',
      `Tournament configuration invalid: requires at least 2 teams and captains (configured: ${targetCaptainCount}).`,
      { targetCaptainCount }
    );
  }

  // Check 4: Exact required captain count
  const requiredCaptainsSelected = captains.length === targetCaptainCount;
  if (!requiredCaptainsSelected) {
    addBlocker(
      'CAPTAIN_COUNT_MISMATCH',
      `Exact captain count mismatch: expected exactly ${targetCaptainCount} captains, but ${captains.length} are selected.`,
      { selected: captains.length, required: targetCaptainCount }
    );
  }

  // Check 5: Unique captain slots
  const seenSlots = new Set<string>();
  let hasSlotConflict = false;
  for (const c of captains) {
    if (!c.captainSlotId) {
      hasSlotConflict = true;
      addBlocker(
        'CAPTAIN_SLOT_CONFLICT',
        `Captain ${c.displayName || c.userId} has no assigned captainSlotId.`,
        { userId: c.userId }
      );
      break;
    }
    if (seenSlots.has(c.captainSlotId)) {
      hasSlotConflict = true;
      addBlocker(
        'CAPTAIN_SLOT_CONFLICT',
        `Duplicate captainSlotId conflict detected for slot ${c.captainSlotId}.`,
        { captainSlotId: c.captainSlotId }
      );
      break;
    }
    seenSlots.add(c.captainSlotId);
  }
  const uniqueCaptainSlots = !hasSlotConflict;

  // Check 6: Captains excluded from auction pool
  const contaminatedCaptains = captains.filter(
    c => c.auctionStatus !== 'NOT_IN_POOL' || auctionPool.some(p => p.userId === c.userId)
  );
  const captainsExcludedFromPool = contaminatedCaptains.length === 0;
  if (!captainsExcludedFromPool) {
    addBlocker(
      'CAPTAINS_IN_AUCTION_POOL',
      `${contaminatedCaptains.length} selected captain(s) are present in the auction bidding pool or possess an auction status other than NOT_IN_POOL.`,
      { captainUserIds: contaminatedCaptains.map(c => c.userId) }
    );
  }

  // Check 7: Regular active players correctly AVAILABLE
  const regularActivePlayers = activeParticipants.filter(p => p.tournamentRole === 'PLAYER' && p.teamId === null);
  const unavailablePlayers = regularActivePlayers.filter(p => p.auctionStatus !== 'AVAILABLE');
  const playersAvailable = unavailablePlayers.length === 0;
  if (!playersAvailable) {
    addBlocker(
      'PLAYERS_NOT_AVAILABLE',
      `${unavailablePlayers.length} regular active player(s) do not possess AVAILABLE auction status.`,
      { userIds: unavailablePlayers.map(p => p.userId) }
    );
  }

  // Check 8: All approved registrations represented in participant list
  const approvedRegs = registrations.filter(r => r.status === 'APPROVED');
  const unrepresented = approvedRegs.filter(r => !activeParticipants.some(p => p.userId === r.userId));
  const allApprovedRepresented = unrepresented.length === 0;
  if (!allApprovedRepresented) {
    addBlocker(
      'APPROVED_REGISTRATIONS_UNREPRESENTED',
      `${unrepresented.length} approved registration(s) do not have an active participant record.`,
      { unrepresentedUserIds: unrepresented.map(r => r.userId) }
    );
  }

  // Check 9: Duplicate identity protection across active participants
  const seenDiscord = new Map<string, string>();
  const seenDota = new Map<string, string>();
  const seenSteam = new Map<string, string>();
  const seenPbg = new Map<string, string>();
  let hasDuplicateIdentities = false;

  for (const p of activeParticipants) {
    const reg = registrations.find(r => r.userId === p.userId);
    const discordId = reg?.identitySnapshot?.discordUserId;
    const dotaId = reg?.identitySnapshot?.dotaAccountId;
    const steamId = reg?.identitySnapshot?.steamId;
    const pbgId = p.pbgId || reg?.pbgId;

    if (pbgId) {
      if (seenPbg.has(pbgId)) {
        hasDuplicateIdentities = true;
        addBlocker('DUPLICATE_PBG_IDENTITY', `Duplicate PBG account ${pbgId} detected across participants ${p.userId} and ${seenPbg.get(pbgId)}.`, { pbgId });
      } else {
        seenPbg.set(pbgId, p.userId);
      }
    }

    if (discordId) {
      if (seenDiscord.has(discordId)) {
        hasDuplicateIdentities = true;
        addBlocker('DUPLICATE_DISCORD_IDENTITY', `Duplicate Discord ID ${discordId} shared by participants ${p.userId} and ${seenDiscord.get(discordId)}.`, { discordId });
      } else {
        seenDiscord.set(discordId, p.userId);
      }
    }

    if (dotaId) {
      if (seenDota.has(dotaId)) {
        hasDuplicateIdentities = true;
        addBlocker('DUPLICATE_DOTA_IDENTITY', `Duplicate Dota Friend ID ${dotaId} shared by participants ${p.userId} and ${seenDota.get(dotaId)}.`, { dotaId });
      } else {
        seenDota.set(dotaId, p.userId);
      }
    }

    if (steamId) {
      if (seenSteam.has(steamId)) {
        hasDuplicateIdentities = true;
        addBlocker('DUPLICATE_STEAM_IDENTITY', `Duplicate Steam ID ${steamId} shared by participants ${p.userId} and ${seenSteam.get(steamId)}.`, { steamId });
      } else {
        seenSteam.set(steamId, p.userId);
      }
    }
  }
  const noDuplicateIdentities = !hasDuplicateIdentities;

  // Check 10: Discord linkage valid for all active participants
  const missingDiscord = activeParticipants.filter(p => {
    if (testMode && (p.isTestAccount || p.source === 'TEST_SEED')) return false;
    const reg = registrations.find(r => r.userId === p.userId);
    if (testMode && (reg?.isTestAccount || reg?.source === 'TEST_SEED')) return false;
    return !reg?.identitySnapshot?.discordUserId;
  });
  const discordLinkageValidForAll = missingDiscord.length === 0;
  if (!discordLinkageValidForAll) {
    addBlocker(
      'DISCORD_LINKAGE_MISSING',
      `${missingDiscord.length} active participant(s) are missing verified Discord account linkages.`,
      { missingUserIds: missingDiscord.map(p => p.userId) }
    );
  }

  // Check 11: All active participants retain PBG Member
  const missingPbgMember = activeParticipants.filter(p => {
    if (testMode && (p.isTestAccount || p.source === 'TEST_SEED')) return false;
    const reg = registrations.find(r => r.userId === p.userId);
    if (testMode && (reg?.isTestAccount || reg?.source === 'TEST_SEED')) return false;
    const checks = reg?.eligibilityChecks || [];
    const memberCheck = checks.find(c => c.code === 'PBG_MEMBER_ROLE_REQUIRED');
    if (memberCheck && memberCheck.passed === false) return true;

    // Check live account registry if present
    const liveAccount = pbgAccountRegistry.getAccountByUid(p.userId) || 
      (p.pbgId ? pbgAccountRegistry.getAccountByPbgId(p.pbgId) : undefined);
    if (liveAccount) {
      if (liveAccount.discordLinked === false) return true;
      if (liveAccount.discordMemberVerified === false) return true;
    }
    return false;
  });
  const pbgMemberRoleRetained = missingPbgMember.length === 0;
  if (!pbgMemberRoleRetained) {
    addBlocker(
      'PBG_MEMBER_ROLE_MISSING',
      `${missingPbgMember.length} participant(s) have unverified or inactive PBG Member status.`,
      { userIds: missingPbgMember.map(p => p.userId) }
    );
  }

  // Check 12: No conflicting team assignments before auction
  const prematureTeamed = activeParticipants.filter(p => p.teamId !== null);
  const noConflictingTeams = prematureTeamed.length === 0;
  if (!noConflictingTeams) {
    addBlocker(
      'CONFLICTING_TEAM_ASSIGNMENTS',
      `${prematureTeamed.length} participant(s) already possess premature teamId assignments prior to auction draft.`,
      { prematureUserIds: prematureTeamed.map(p => p.userId) }
    );
  }

  const noUnresolvedReviewItems = eligibilityComplete;
  const isReady = blockers.length === 0;

  return {
    isReady,
    ready: isReady,
    lifecycle,
    blockers,
    blockingIssues,
    captains,
    auctionPool,
    totalApproved: approvedRegs.length,
    totalCaptains: captains.length,
    totalAuctionPool: auctionPool.length,
    targetCaptainCount,
    checks: {
      registrationsClosed,
      eligibilityComplete,
      requiredCaptainsSelected,
      uniqueCaptainSlots,
      captainsExcludedFromPool,
      playersAvailable,
      discordLinkageValidForAll,
      pbgMemberRoleRetained,
      allApprovedRepresented,
      noDuplicateIdentities,
      noConflictingTeams,
      tournamentConfigValid,
      noUnresolvedReviewItems
    }
  };
}
