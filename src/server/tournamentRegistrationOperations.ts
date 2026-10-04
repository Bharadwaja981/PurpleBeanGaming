/**
 * Purple Bean Gaming — Server-Authoritative Tournament Registration Operations
 * 
 * Handles all authoritative registration, eligibility review, participant creation,
 * captain slot selection, and auction readiness verification.
 */

import { getAdminDb } from './firebaseAdmin';
import {
  TournamentRegistrationRecord,
  TournamentParticipantRecord,
  CaptainSlotRecord,
  TournamentTeamRecord,
  TournamentRegistrationLifecycle,
  TournamentRegistrationStatus,
  evaluateRegistrationEligibility,
  createRegistrationSnapshot,
  createParticipantFromApprovedRegistration,
  assignParticipantAsCaptain,
  removeParticipantFromCaptain,
  validateAuctionReadiness,
  AuctionReadinessReport,
  TournamentRegistrationData
} from '../domain/tournamentRegistrationEngine';
import {
  syncDiscordTournamentRoles,
  createDiscordTeamRoleAuthoritative,
  cleanupEliminatedTeamDiscordRoles,
  cleanupTournamentCompletionDiscordRoles,
  inMemoryParticipants,
  inMemoryTournamentTeams
} from './discordTournamentSyncService';
import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import { removeUndefinedDeep } from '../utils/sanitizeFirestore';

// In-memory registrations cache: tournamentId -> Map<userId, TournamentRegistrationRecord>
export const inMemoryRegistrations = new Map<string, Map<string, TournamentRegistrationRecord>>();
// Re-export inMemoryParticipants from discordTournamentSyncService for backward compatibility
export { inMemoryParticipants };
// In-memory captains cache: tournamentId -> Map<captainSlotId, CaptainSlotRecord>
export const inMemoryCaptains = new Map<string, Map<string, CaptainSlotRecord>>();
// In-memory lifecycles: tournamentId -> TournamentRegistrationLifecycle
export const inMemoryLifecycles = new Map<string, TournamentRegistrationLifecycle>();

// Concurrency mutex per tournament to serialize concurrent registration submissions
export const tournamentRegistrationLocks = new Map<string, Promise<any>>();

export function clearRegistrationLocks(): void {
  tournamentRegistrationLocks.clear();
}

async function withTournamentLock<T>(tournamentId: string, fn: () => Promise<T>): Promise<T> {
  const current = tournamentRegistrationLocks.get(tournamentId) || Promise.resolve();
  let release: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  tournamentRegistrationLocks.set(tournamentId, next);
  await current.catch(() => {});
  try {
    return await fn();
  } finally {
    release!();
  }
}

/**
 * Helper to get in-memory registration store
 */
function getTournamentRegMap(tournamentId: string): Map<string, TournamentRegistrationRecord> {
  let map = inMemoryRegistrations.get(tournamentId);
  if (!map) {
    map = new Map<string, TournamentRegistrationRecord>();
    inMemoryRegistrations.set(tournamentId, map);
  }
  return map;
}

function getTournamentParticipantMap(tournamentId: string): Map<string, TournamentParticipantRecord> {
  let map = inMemoryParticipants.get(tournamentId);
  if (!map) {
    map = new Map<string, TournamentParticipantRecord>();
    inMemoryParticipants.set(tournamentId, map);
  }
  return map;
}

function getTournamentCaptainMap(tournamentId: string): Map<string, CaptainSlotRecord> {
  let map = inMemoryCaptains.get(tournamentId);
  if (!map) {
    map = new Map<string, CaptainSlotRecord>();
    inMemoryCaptains.set(tournamentId, map);
  }
  return map;
}

function getTournamentTeamMap(tournamentId: string): Map<string, TournamentTeamRecord> {
  let map = inMemoryTournamentTeams.get(tournamentId);
  if (!map) {
    map = new Map<string, TournamentTeamRecord>();
    inMemoryTournamentTeams.set(tournamentId, map);
  }
  return map;
}

/**
 * Submits player registration for a tournament authoritatively.
 */
export async function submitTournamentRegistrationAuthoritative(params: {
  userId: string;
  tournamentId: string;
  formData: TournamentRegistrationData;
}): Promise<TournamentRegistrationRecord> {
  const { userId, tournamentId, formData } = params;

  if (!userId) {
    throw new Error('SIGN_IN_REQUIRED: Authentication required to register.');
  }

  return await withTournamentLock(tournamentId, async () => {
    // 1. Check lifecycle: must be open
    const lifecycle = inMemoryLifecycles.get(tournamentId) || 'REGISTRATION_OPEN';
    if (lifecycle !== 'REGISTRATION_OPEN') {
      throw new Error('REGISTRATION_CLOSED: Tournament registration is currently closed.');
    }

    // 2. Check PBG Account & Links
    const pbgAccount = pbgAccountRegistry.getAccountByUid(userId) || 
      pbgAccountRegistry.getAllAccounts().find(a => a.googleUid === userId || a.pbgId === userId);

    if (!pbgAccount || !pbgAccount.pbgId) {
      throw new Error('PBG_PROFILE_REQUIRED: Please complete your PBG profile before tournament registration.');
    }

    // Discord linkage requirement for PBG auction tournaments
    if (!pbgAccount.discordLinked || !pbgAccount.discordUserId) {
      throw new Error('DISCORD_REQUIRED: Connect Discord to register for this tournament.');
    }

    // 3. Check for existing registration
    const regMap = getTournamentRegMap(tournamentId);
    const existingReg = regMap.get(userId);
    if (existingReg && existingReg.status !== 'WITHDRAWN' && existingReg.status !== 'REJECTED') {
      throw new Error('ALREADY_REGISTERED: You have already submitted a registration for this tournament.');
    }

    // Fetch all existing registrations to test duplicate checks & capacity
    const allExistingRegs = Array.from(regMap.values());

    // 4. Run Deterministic Eligibility Checks
    const eligibility = evaluateRegistrationEligibility({
      userId,
      tournamentId,
      pbgAccount: {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName,
        email: pbgAccount.email,
        accountStatus: pbgAccount.accountStatus,
        dotaAccountLinked: pbgAccount.dotaAccountLinked,
        dotaAccountVerified: pbgAccount.dotaAccountVerified,
        dotaAccountId: pbgAccount.dotaAccountId,
        steamId: pbgAccount.steamId,
        discordLinked: pbgAccount.discordLinked,
        discordUserId: pbgAccount.discordUserId,
        discordUsername: pbgAccount.discordUsername,
        pbgMemberRoleActive: pbgAccount.discordMemberVerified !== false,
        isBanned: pbgAccount.accountStatus === 'BANNED'
      },
      tournament: {
        id: tournamentId,
        status: 'OPEN',
        registrationLifecycle: lifecycle,
        discordRequired: true,
        dotaRequired: true
      },
      formData,
      existingRegistrations: allExistingRegs
    });

    // If there are ANY hard fails that block submission, reject immediately
    const hardFail = eligibility.checks.find(c => c.severity === 'FAIL');
    if (hardFail) {
      throw new Error(`ELIGIBILITY_FAILED: ${hardFail.message}`);
    }

    // 5. Create Immutable Identity Snapshot
    const registrationRecord = createRegistrationSnapshot({
      userId,
      tournamentId,
      pbgAccount: {
        pbgId: pbgAccount.pbgId,
        displayName: pbgAccount.displayName || pbgAccount.pbgId,
        email: pbgAccount.email,
        dotaAccountId: pbgAccount.dotaAccountId,
        steamId: pbgAccount.steamId,
        discordUserId: pbgAccount.discordUserId,
        discordUsername: pbgAccount.discordUsername
      },
      formData,
      eligibilityChecks: eligibility.checks,
      eligibilityStatus: eligibility.overallStatus
    });

    // Store in memory
    regMap.set(userId, registrationRecord);

    // Persist to Firestore
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection(`tournaments/${tournamentId}/registrations`).doc(userId).set(removeUndefinedDeep(registrationRecord));
        if (formData.captainApplicant) {
          await db.collection(`tournaments/${tournamentId}/captainApplications`).doc(userId).set(removeUndefinedDeep({
            userId,
            pbgId: pbgAccount.pbgId,
            displayName: pbgAccount.displayName,
            appliedAt: registrationRecord.submittedAt,
            tournamentMMR: registrationRecord.tournamentMMR
          }));
        }
      }
    } catch (err: any) {
      console.warn('[submitTournamentRegistration] Firestore persistence note:', err.message);
    }

    return registrationRecord;
  });
}

/**
 * Player-initiated withdrawal prior to team formation.
 */
export async function withdrawTournamentRegistrationAuthoritative(params: {
  userId: string;
  tournamentId: string;
}): Promise<TournamentRegistrationRecord> {
  const { userId, tournamentId } = params;

  const regMap = getTournamentRegMap(tournamentId);
  const reg = regMap.get(userId);
  if (!reg) {
    throw new Error('NOT_FOUND: No registration found to withdraw.');
  }

  const lifecycle = inMemoryLifecycles.get(tournamentId) || 'REGISTRATION_OPEN';
  if (lifecycle !== 'REGISTRATION_OPEN') {
    throw new Error('WITHDRAWAL_LOCKED: Registrations are closed. Please contact tournament organisers.');
  }

  reg.status = 'WITHDRAWN';
  reg.updatedAt = new Date().toISOString();
  regMap.set(userId, reg);

  // If a participant record existed, mark inactive
  const pMap = getTournamentParticipantMap(tournamentId);
  if (pMap.has(userId)) {
    const p = pMap.get(userId)!;
    p.participantStatus = 'INACTIVE';
    p.auctionStatus = 'NOT_IN_POOL';
    p.updatedAt = reg.updatedAt;
  }

  try {
    const db = getAdminDb();
    if (db) {
      await db.collection(`tournaments/${tournamentId}/registrations`).doc(userId).set(reg, { merge: true });
    }
  } catch {}

  return reg;
}

/**
 * Organiser Review Action on a Registration.
 * Actions: APPROVE, REJECT, MARK_UNDER_REVIEW, WAITLIST, SET_TOURNAMENT_MMR, DISQUALIFY
 */
export async function reviewTournamentRegistrationAuthoritative(params: {
  organizerUserId: string;
  tournamentId: string;
  targetUserId: string;
  action: 'APPROVE' | 'REJECT' | 'MARK_UNDER_REVIEW' | 'WAITLIST' | 'SET_TOURNAMENT_MMR' | 'DISQUALIFY';
  tournamentMMR?: number;
  notes?: string;
  rejectionReason?: string;
}): Promise<{
  registration: TournamentRegistrationRecord;
  participant?: TournamentParticipantRecord;
}> {
  const { organizerUserId, tournamentId, targetUserId, action, tournamentMMR, notes, rejectionReason } = params;

  return await withTournamentLock(tournamentId, async () => {
    const regMap = getTournamentRegMap(tournamentId);
    const reg = regMap.get(targetUserId);
    if (!reg) {
      throw new Error(`NOT_FOUND: Registration for user ${targetUserId} was not found.`);
    }

    const now = new Date().toISOString();
    reg.reviewedBy = organizerUserId;
    reg.reviewedAt = now;
    reg.updatedAt = now;
    if (notes) reg.reviewNotes = notes;
    if (rejectionReason) reg.rejectionReason = rejectionReason;

    const pMap = getTournamentParticipantMap(tournamentId);
    let participant: TournamentParticipantRecord | undefined;

    switch (action) {
      case 'APPROVE': {
        reg.status = 'APPROVED';
        // Create or update authoritative participant record idempotently
        const existingParticipant = pMap.get(targetUserId);
        participant = createParticipantFromApprovedRegistration(reg, existingParticipant);
        pMap.set(targetUserId, participant);

        // Trigger Discord Tournament Player Role Synchronization asynchronously
        syncDiscordTournamentRoles({
          userId: targetUserId,
          tournamentId
        }).catch(err => console.warn('[reviewRegistration] Discord sync note:', err));
        break;
      }
      case 'REJECT': {
        reg.status = 'REJECTED';
        if (pMap.has(targetUserId)) {
          pMap.delete(targetUserId);
        }
        break;
      }
      case 'MARK_UNDER_REVIEW': {
        reg.status = 'UNDER_REVIEW';
        break;
      }
      case 'WAITLIST': {
        reg.status = 'WAITLISTED';
        break;
      }
      case 'DISQUALIFY': {
        reg.status = 'DISQUALIFIED';
        if (pMap.has(targetUserId)) {
          const p = pMap.get(targetUserId)!;
          p.participantStatus = 'INACTIVE';
          p.auctionStatus = 'NOT_IN_POOL';
          p.eliminated = true;
        }
        break;
      }
      case 'SET_TOURNAMENT_MMR': {
        if (typeof tournamentMMR === 'number' && tournamentMMR > 0) {
          reg.tournamentMMR = tournamentMMR;
          if (pMap.has(targetUserId)) {
            pMap.get(targetUserId)!.updatedAt = now;
          }
        }
        break;
      }
    }

    regMap.set(targetUserId, reg);

    // Persist to Firestore atomically
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection(`tournaments/${tournamentId}/registrations`).doc(targetUserId).set(reg, { merge: true });
        if (participant) {
          await db.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        }
      }
    } catch {}

    return { registration: reg, participant };
  });
}

/**
 * Organiser Selects an Approved Player as Captain for a designated Slot.
 * Atomic Rules:
 * - Checks & replaces any previous occupant of captainSlotId (restores them to PLAYER + AVAILABLE)
 * - Updates participant: tournamentRole = CAPTAIN, captainSlotId, auctionStatus = NOT_IN_POOL, teamId = null
 * - Triggers Discord sync for both new and replaced captains
 */
export async function selectTournamentCaptainAuthoritative(params: {
  organizerUserId: string;
  tournamentId: string;
  targetUserId: string;
  captainSlotId: string;
}): Promise<{
  participant: TournamentParticipantRecord;
  slot: CaptainSlotRecord;
  replacedParticipant?: TournamentParticipantRecord;
}> {
  const { organizerUserId, tournamentId, targetUserId, captainSlotId } = params;

  return await withTournamentLock(tournamentId, async () => {
    const pMap = getTournamentParticipantMap(tournamentId);
    let participant = pMap.get(targetUserId);

    if (!participant) {
      // Check if approved registration exists and synthesize participant
      const regMap = getTournamentRegMap(tournamentId);
      const reg = regMap.get(targetUserId);
      if (!reg || reg.status !== 'APPROVED') {
        throw new Error(`ELIGIBILITY_ERROR: Only approved participants can be designated as captains.`);
      }
      participant = createParticipantFromApprovedRegistration(reg);
      pMap.set(targetUserId, participant);
    }

    const slotMap = getTournamentCaptainMap(tournamentId);
    let replacedParticipant: TournamentParticipantRecord | undefined;

    // 1. Check if another participant is currently occupying this captain slot
    const existingSlot = slotMap.get(captainSlotId);
    if (existingSlot && existingSlot.userId !== targetUserId) {
      const oldCaptain = pMap.get(existingSlot.userId);
      if (oldCaptain) {
        oldCaptain.captainSlotId = null;
        oldCaptain.tournamentRole = 'PLAYER';
        oldCaptain.auctionStatus = 'AVAILABLE';
        oldCaptain.teamId = null;
        oldCaptain.updatedAt = new Date().toISOString();
        pMap.set(oldCaptain.userId, oldCaptain);
        replacedParticipant = oldCaptain;

        // Sync Discord to revoke Captain role for replaced captain
        syncDiscordTournamentRoles({
          userId: oldCaptain.userId,
          tournamentId
        }).catch(err => console.warn('[selectCaptain] Discord sync for replaced captain:', err));

        try {
          const db = getAdminDb();
          if (db) {
            await db.collection(`tournaments/${tournamentId}/participants`).doc(oldCaptain.userId).set(oldCaptain, { merge: true });
          }
        } catch {}
      }
    }

    // 2. Check if targetUserId was already occupying another slot (e.g. slot-2)
    for (const [sId, sRec] of slotMap.entries()) {
      if (sRec.userId === targetUserId && sId !== captainSlotId) {
        slotMap.delete(sId);
        try {
          const db = getAdminDb();
          if (db) {
            await db.collection(`tournaments/${tournamentId}/captains`).doc(sId).delete();
          }
        } catch {}
      }
    }

    // 3. Update participant to CAPTAIN & exclude from auction pool (teamId remains null)
    participant = assignParticipantAsCaptain(participant, captainSlotId);
    participant.teamId = null;
    pMap.set(targetUserId, participant);

    const now = new Date().toISOString();
    const slotRecord: CaptainSlotRecord = {
      captainSlotId,
      tournamentId,
      userId: targetUserId,
      pbgId: participant.pbgId,
      displayName: participant.displayName,
      teamId: null,
      selectedAt: now,
      selectedBy: organizerUserId
    };
    slotMap.set(captainSlotId, slotRecord);

    // 4. Trigger Discord Captain Role Synchronization
    syncDiscordTournamentRoles({
      userId: targetUserId,
      tournamentId
    }).catch(err => console.warn('[selectCaptain] Discord sync note:', err));

    // 5. Persist to Firestore
    try {
      const db = getAdminDb();
      if (db) {
        await db.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        await db.collection(`tournaments/${tournamentId}/captains`).doc(captainSlotId).set(slotRecord, { merge: true });
      }
    } catch {}

    return { participant, slot: slotRecord, replacedParticipant };
  });
}

/**
 * Organiser Removes Captain designation from a player.
 * Restores tournamentRole = PLAYER, captainSlotId = null, auctionStatus = AVAILABLE, teamId = null.
 */
export async function removeTournamentCaptainAuthoritative(params: {
  organizerUserId: string;
  tournamentId: string;
  targetUserId: string;
  captainSlotId: string;
}): Promise<TournamentParticipantRecord> {
  const { tournamentId, targetUserId, captainSlotId } = params;

  return await withTournamentLock(tournamentId, async () => {
    const pMap = getTournamentParticipantMap(tournamentId);
    let participant = pMap.get(targetUserId);
    if (!participant) {
      throw new Error(`NOT_FOUND: Participant ${targetUserId} not found.`);
    }

    participant = removeParticipantFromCaptain(participant);
    participant.teamId = null;
    pMap.set(targetUserId, participant);

    const slotMap = getTournamentCaptainMap(tournamentId);
    slotMap.delete(captainSlotId);

    // Sync Discord: removes Captain role, keeps Tournament Player & PBG Member
    syncDiscordTournamentRoles({
      userId: targetUserId,
      tournamentId
    }).catch(err => console.warn('[removeCaptain] Discord sync note:', err));

    try {
      const db = getAdminDb();
      if (db) {
        await db.collection(`tournaments/${tournamentId}/participants`).doc(targetUserId).set(participant, { merge: true });
        await db.collection(`tournaments/${tournamentId}/captains`).doc(captainSlotId).delete();
      }
    } catch {}

    return participant;
  });
}

/**
 * Restores an eliminated team back to ACTIVE after match result correction.
 * Idempotently resets participant eliminated flags and synchronizes Discord roles from PBG state.
 */
export async function restoreTeamFromEliminationAuthoritative(params: {
  tournamentId: string;
  teamId: string;
  fetchFn?: typeof fetch;
}): Promise<{ team: TournamentTeamRecord; restoredParticipants: TournamentParticipantRecord[] }> {
  const { tournamentId, teamId, fetchFn } = params;

  return await withTournamentLock(tournamentId, async () => {
    const teamMap = getTournamentTeamMap(tournamentId);
    const team = teamMap.get(teamId);
    if (!team) {
      throw new Error(`NOT_FOUND: Team ${teamId} not found in tournament ${tournamentId}.`);
    }

    team.status = 'ACTIVE';
    team.eliminatedAt = undefined;
    team.updatedAt = new Date().toISOString();
    teamMap.set(teamId, team);

    const pMap = getTournamentParticipantMap(tournamentId);
    const restoredParticipants: TournamentParticipantRecord[] = [];

    for (const memberId of team.roster) {
      const p = pMap.get(memberId);
      if (p) {
        p.eliminated = false;
        p.updatedAt = new Date().toISOString();
        pMap.set(memberId, p);
        restoredParticipants.push(p);

        // Sync Discord roles to restore temporary tournament roles based on current PBG state
        await syncDiscordTournamentRoles({
          userId: memberId,
          tournamentId,
          overrideContext: {
            team,
            participant: p
          },
          fetchFn
        }).catch(err => console.warn('[restoreTeamFromElimination] Discord sync note:', err));
      }
    }

    try {
      const db = getAdminDb();
      if (db) {
        await db.collection(`tournaments/${tournamentId}/teams`).doc(teamId).set(team, { merge: true });
        for (const p of restoredParticipants) {
          await db.collection(`tournaments/${tournamentId}/participants`).doc(p.userId).set(p, { merge: true });
        }
      }
    } catch {}

    return { team, restoredParticipants };
  });
}

/**
 * Advances tournament registration lifecycle state.
 */
export function setTournamentLifecycleAuthoritative(params: {
  tournamentId: string;
  newLifecycle: TournamentRegistrationLifecycle;
}): { lifecycle: TournamentRegistrationLifecycle; readiness?: AuctionReadinessReport } {
  const { tournamentId, newLifecycle } = params;

  inMemoryLifecycles.set(tournamentId, newLifecycle);

  const regMap = getTournamentRegMap(tournamentId);
  const pMap = getTournamentParticipantMap(tournamentId);

  const readiness = validateAuctionReadiness({
    lifecycle: newLifecycle,
    registrations: Array.from(regMap.values()),
    participants: Array.from(pMap.values())
  });

  return { lifecycle: newLifecycle, readiness };
}

/**
 * Validates auction readiness contract for auction bridge.
 */
export function checkAuctionReadinessContract(tournamentId: string): AuctionReadinessReport {
  const lifecycle = inMemoryLifecycles.get(tournamentId) || 'REGISTRATION_OPEN';
  const regMap = getTournamentRegMap(tournamentId);
  const pMap = getTournamentParticipantMap(tournamentId);

  return validateAuctionReadiness({
    lifecycle,
    registrations: Array.from(regMap.values()),
    participants: Array.from(pMap.values())
  });
}
