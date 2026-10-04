/**
 * Purple Bean Gaming — Dedicated Auction Test Tools & Fixtures Engine
 * 
 * Provides isolated, production-safe test fixtures for:
 * Tournament: "Purple Bean Auction Test" (testMode = true)
 * 
 * Rules:
 * 1. Test identities bypass external Discord/Dota eligibility ONLY when:
 *    tournament.testMode === true AND participant.isTestAccount === true
 * 2. Real accounts NEVER bypass external verification.
 * 3. Impersonation/test control is strictly Admin-only and restricted to test captains.
 * 4. Audited as: actorAdminUserId, actingAsTestCaptainUserId, testMode = true.
 */

import { pbgAccountRegistry } from '../domain/pbgAccountRegistry';
import {
  TournamentRegistrationRecord,
  TournamentParticipantRecord
} from '../domain/tournamentRegistrationEngine';
import {
  AuthoritativeAuctionSession
} from '../domain/tournamentAuctionEngine';
import {
  inMemoryRegistrations
} from './tournamentRegistrationOperations';
import {
  inMemoryParticipants
} from './discordTournamentSyncService';
import {
  inMemoryAuctionSessions,
  placeBidAuthoritative,
  nominatePlayerAuthoritative,
  updateTeamBrandingAuthoritative
} from './tournamentAuctionOperations';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { tournamentService } from '../services/firebaseService';

export * from '../domain/auctionTestFixtures';
import {
  TEST_TOURNAMENT_ID,
  DUMMY_TEST_PLAYERS,
  DUMMY_TEST_CAPTAINS,
  DummyTestPlayerDefinition,
  DummyTestCaptainDefinition,
  TestCaptainActionAudit,
  isTournamentInTestMode
} from '../domain/auctionTestFixtures';

const inMemoryActionAudits: TestCaptainActionAudit[] = [];

/**
 * Seeds the 15 dummy regular players into PBG accounts and tournament registrations/participants.
 */
export function seedTestPlayers(tournamentId: string = TEST_TOURNAMENT_ID): {
  success: boolean;
  count: number;
  players: DummyTestPlayerDefinition[];
} {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: Test players can only be seeded into tournaments with testMode === true.');
  }

  // Ensure registration maps exist
  let regMap = inMemoryRegistrations.get(tournamentId);
  if (!regMap) {
    regMap = new Map();
    inMemoryRegistrations.set(tournamentId, regMap);
  }

  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }

  for (const p of DUMMY_TEST_PLAYERS) {
    // 1. Register in pbgAccountRegistry
    pbgAccountRegistry.registerOrUpdateAccount({
      googleUid: p.uid,
      pbgId: p.pbgId,
      displayName: p.displayName,
      email: `${p.pbgId.toLowerCase()}@test.pbg.gg`,
      discordUserId: undefined,
      discordUsername: undefined,
      discordLinked: false,
      discordMemberVerified: false,
      steamId: undefined,
      dotaAccountId: undefined,
      dotaAccountVerified: false,
      isTestAccount: true,
      source: 'TEST_SEED'
    });

    const now = new Date().toISOString();

    // 2. Register tournament registration record
    const regRecord: TournamentRegistrationRecord = {
      id: `reg-${tournamentId}-${p.uid}`,
      tournamentId,
      userId: p.uid,
      pbgId: p.pbgId,
      ign: p.inGameName,
      declaredMMR: p.mmr,
      tournamentMMR: p.mmr,
      primaryRole: p.primaryRole,
      secondaryRole: p.secondaryRole,
      interestedInCaptaincy: false,
      applyingAsCaptain: false,
      status: 'APPROVED',
      eligibilityStatus: 'ELIGIBLE',
      reviewedAt: now,
      reviewedBy: 'organizer-test-tools',
      createdAt: now,
      updatedAt: now,
      isTestAccount: true,
      source: 'TEST_SEED',
      identitySnapshot: {
        discordUserId: undefined,
        dotaAccountId: undefined,
        steamId: undefined,
        isTestAccount: true,
        source: 'TEST_SEED'
      } as any,
      eligibilityChecks: [
        {
          code: 'PBG_PROFILE_COMPLETE',
          passed: true,
          severity: 'PASS',
          message: 'Test identity profile provisioned.'
        },
        {
          code: 'TEST_IDENTITY_BYPASS',
          passed: true,
          severity: 'PASS',
          message: 'External identity checks bypassed (TEST IDENTITY).'
        }
      ]
    };
    regMap.set(p.uid, regRecord);

    // 3. Provision participant record
    const partRecord: TournamentParticipantRecord = {
      tournamentId,
      registrationId: regRecord.id,
      userId: p.uid,
      pbgId: p.pbgId,
      displayName: p.displayName,
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      participantStatus: 'ACTIVE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      isTestAccount: true,
      source: 'TEST_SEED',
      joinedAt: now,
      updatedAt: now
    };
    partMap.set(p.uid, partRecord);
  }

  // Also hydrate dotaAuctionEngine if active
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    for (const p of DUMMY_TEST_PLAYERS) {
      const reg = regMap.get(p.uid);
      if (reg) {
        engine.syncPlayerFromRegistration(tournamentId, {
          id: reg.id,
          tournamentId,
          userId: p.uid,
          ign: p.inGameName,
          declaredMmr: p.mmr,
          tournamentMmr: p.mmr,
          primaryRole: p.primaryRole as any,
          secondaryRole: p.secondaryRole as any,
          status: 'VERIFIED' as any
        } as any);
      }
    }
  }

  tournamentService.notify();

  return {
    success: true,
    count: DUMMY_TEST_PLAYERS.length,
    players: DUMMY_TEST_PLAYERS
  };
}

/**
 * Seeds the two dummy captain candidates into registrations & eligible candidates pool.
 */
export function seedTestCaptains(tournamentId: string = TEST_TOURNAMENT_ID): {
  success: boolean;
  count: number;
  captains: DummyTestCaptainDefinition[];
} {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: Test captains can only be seeded into tournaments with testMode === true.');
  }

  let regMap = inMemoryRegistrations.get(tournamentId);
  if (!regMap) {
    regMap = new Map();
    inMemoryRegistrations.set(tournamentId, regMap);
  }

  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }

  for (const c of DUMMY_TEST_CAPTAINS) {
    pbgAccountRegistry.registerOrUpdateAccount({
      googleUid: c.uid,
      pbgId: c.pbgId,
      displayName: c.displayName,
      email: `${c.pbgId.toLowerCase()}@test.pbg.gg`,
      discordUserId: undefined,
      discordLinked: false,
      discordMemberVerified: false,
      steamId: undefined,
      dotaAccountId: undefined,
      dotaAccountVerified: false,
      isTestAccount: true,
      source: 'TEST_SEED'
    });

    const now = new Date().toISOString();

    const regRecord: TournamentRegistrationRecord = {
      id: `reg-${tournamentId}-${c.uid}`,
      tournamentId,
      userId: c.uid,
      pbgId: c.pbgId,
      ign: c.inGameName,
      declaredMMR: c.mmr,
      tournamentMMR: c.mmr,
      primaryRole: c.primaryRole,
      secondaryRole: c.secondaryRole,
      interestedInCaptaincy: true,
      applyingAsCaptain: true,
      status: 'APPROVED',
      eligibilityStatus: 'ELIGIBLE',
      reviewedAt: now,
      reviewedBy: 'organizer-test-tools',
      createdAt: now,
      updatedAt: now,
      isTestAccount: true,
      source: 'TEST_SEED',
      identitySnapshot: {
        discordUserId: undefined,
        dotaAccountId: undefined,
        steamId: undefined,
        isTestAccount: true,
        source: 'TEST_SEED'
      } as any,
      eligibilityChecks: [
        {
          code: 'PBG_PROFILE_COMPLETE',
          passed: true,
          severity: 'PASS',
          message: 'Test captain identity provisioned.'
        },
        {
          code: 'TEST_IDENTITY_BYPASS',
          passed: true,
          severity: 'PASS',
          message: 'External identity checks bypassed (TEST IDENTITY).'
        }
      ]
    };
    regMap.set(c.uid, regRecord);
  }

  tournamentService.notify();

  return {
    success: true,
    count: DUMMY_TEST_CAPTAINS.length,
    captains: DUMMY_TEST_CAPTAINS
  };
}

/**
 * Assigns dummy captains to Slot 2 and Slot 3 (leaving Slot 1 open for the real second account).
 */
export function assignTestCaptainsToSlots(tournamentId: string = TEST_TOURNAMENT_ID): {
  success: boolean;
  assigned: Array<{ slotId: string; captainId: string; teamName: string }>;
} {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: Test captains can only be assigned in testMode tournaments.');
  }

  // Ensure captains are seeded first
  seedTestCaptains(tournamentId);

  let partMap = inMemoryParticipants.get(tournamentId);
  if (!partMap) {
    partMap = new Map();
    inMemoryParticipants.set(tournamentId, partMap);
  }

  const assigned: Array<{ slotId: string; captainId: string; teamName: string }> = [];

  for (const c of DUMMY_TEST_CAPTAINS) {
    const now = new Date().toISOString();
    const existing = partMap.get(c.uid);

    const partRecord: TournamentParticipantRecord = {
      tournamentId,
      registrationId: existing?.registrationId || `reg-${tournamentId}-${c.uid}`,
      userId: c.uid,
      pbgId: c.pbgId,
      displayName: c.displayName,
      tournamentRole: 'CAPTAIN',
      auctionStatus: 'NOT_IN_POOL',
      participantStatus: 'ACTIVE',
      captainSlotId: c.targetSlot,
      teamId: null,
      eliminated: false,
      isTestAccount: true,
      source: 'TEST_SEED',
      joinedAt: existing?.joinedAt || now,
      updatedAt: now
    };
    partMap.set(c.uid, partRecord);

    // Also register team into dotaAuctionEngine
    const engine = getAuctionEngine(tournamentId);
    if (engine) {
      if (!engine.hasTeam(`team-${c.targetSlot}`)) {
        engine.hydrateTeamFromExternal({
          id: `team-${c.targetSlot}`,
          name: c.defaultTeamName,
          tag: c.defaultTeamTag,
          captainId: c.uid,
          color: c.color,
          logo: c.logo,
          roster: [],
          purse: 1000,
          currentBid: 0
        });
      }
    }

    assigned.push({
      slotId: c.targetSlot,
      captainId: c.uid,
      teamName: c.defaultTeamName
    });
  }

  tournamentService.notify();

  return {
    success: true,
    assigned
  };
}

/**
 * Resets auction test data while preserving real registrations unless explicitly requested.
 */
export function resetAuctionTestData(
  tournamentId: string = TEST_TOURNAMENT_ID,
  fullResetIncludingReal: boolean = false
): {
  success: boolean;
  preservedRealRegistrationsCount: number;
  message: string;
} {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: Auction test reset is only permitted on testMode tournaments.');
  }

  // 1. Reset auction session in memory
  inMemoryAuctionSessions.delete(tournamentId);

  // 2. Reset dotaAuctionEngine instance
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    engine.purge();
  }

  // 3. Clear action audits for this tournament
  const filteredAudits = inMemoryActionAudits.filter(a => (a.details as any)?.tournamentId !== tournamentId);
  inMemoryActionAudits.length = 0;
  inMemoryActionAudits.push(...filteredAudits);

  const regMap = inMemoryRegistrations.get(tournamentId);
  const partMap = inMemoryParticipants.get(tournamentId);

  let realPreserved = 0;

  if (fullResetIncludingReal) {
    // Purge everything
    inMemoryRegistrations.delete(tournamentId);
    inMemoryParticipants.delete(tournamentId);
  } else {
    // Keep real registrations, reset their participant auction state to AVAILABLE, and keep dummy registrations
    if (regMap && partMap) {
      for (const [uid, part] of partMap.entries()) {
        const isTest = part.isTestAccount || part.source === 'TEST_SEED' || uid.startsWith('pbg-test-');
        if (!isTest) {
          realPreserved++;
          // Reset real participant auction status
          part.auctionStatus = part.tournamentRole === 'CAPTAIN' ? 'NOT_IN_POOL' : 'AVAILABLE';
          part.teamId = null;
        } else {
          // Reset dummy participant
          if (part.tournamentRole === 'CAPTAIN') {
            part.auctionStatus = 'NOT_IN_POOL';
            part.teamId = null;
          } else {
            part.auctionStatus = 'AVAILABLE';
            part.teamId = null;
          }
        }
      }
    }
  }

  tournamentService.notify();

  return {
    success: true,
    preservedRealRegistrationsCount: realPreserved,
    message: fullResetIncludingReal
      ? 'Fully purged all test and real registrations for this tournament.'
      : `Auction runtime reset complete. ${realPreserved} real participant registration(s) preserved.`
  };
}

/**
 * Deletes all dummy test fixtures (players and captains) from the tournament.
 */
export function deleteTestFixtures(tournamentId: string = TEST_TOURNAMENT_ID): {
  success: boolean;
  deletedCount: number;
} {
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: deleteTestFixtures is only permitted on testMode tournaments.');
  }

  let deletedCount = 0;

  const regMap = inMemoryRegistrations.get(tournamentId);
  if (regMap) {
    for (const [uid, reg] of Array.from(regMap.entries())) {
      if (reg.isTestAccount || reg.source === 'TEST_SEED' || uid.startsWith('pbg-test-')) {
        regMap.delete(uid);
        deletedCount++;
      }
    }
  }

  const partMap = inMemoryParticipants.get(tournamentId);
  if (partMap) {
    for (const [uid, part] of Array.from(partMap.entries())) {
      if (part.isTestAccount || part.source === 'TEST_SEED' || uid.startsWith('pbg-test-')) {
        partMap.delete(uid);
      }
    }
  }

  inMemoryAuctionSessions.delete(tournamentId);
  const engine = getAuctionEngine(tournamentId);
  if (engine) {
    engine.purge();
  }

  tournamentService.notify();

  return {
    success: true,
    deletedCount
  };
}

/**
 * Runs a comprehensive Auction Integrity Check:
 * - Purse integrity: spent + remaining === totalPurse (1000)
 * - Roster limits: 5 primary max, 1 stand-in max
 * - Distinct player assignments
 * - Verifies real account satisfying real rules
 */
export function runAuctionIntegrityCheck(tournamentId: string = TEST_TOURNAMENT_ID): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    totalTeams: number;
    totalPlayersDrafted: number;
    totalUnsold: number;
    totalAvailable: number;
    realCaptainsCount: number;
    testCaptainsCount: number;
  };
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const session = inMemoryAuctionSessions.get(tournamentId);
  const partMap = inMemoryParticipants.get(tournamentId);
  const regMap = inMemoryRegistrations.get(tournamentId);

  let realCaptainsCount = 0;
  let testCaptainsCount = 0;

  if (partMap) {
    for (const [uid, p] of partMap.entries()) {
      if (p.tournamentRole === 'CAPTAIN') {
        const isTest = p.isTestAccount || p.source === 'TEST_SEED' || uid.startsWith('pbg-test-');
        if (isTest) {
          testCaptainsCount++;
        } else {
          realCaptainsCount++;
          // Check real captain Discord/Dota eligibility
          const reg = regMap?.get(uid);
          if (!reg?.identitySnapshot?.discordUserId) {
            warnings.push(`Real captain (${p.displayName}) has not connected Discord yet.`);
          }
        }
      }
    }
  }

  let totalDrafted = 0;
  let totalUnsold = 0;
  let totalAvailable = 0;
  let totalTeams = 0;

  if (session) {
    totalTeams = Object.keys(session.teams).length;
    const seenPlayers = new Set<string>();

    for (const [teamId, team] of Object.entries(session.teams)) {
      // 1. Purse check
      const spent = team.primaryRosterUserIds
        .filter(uid => uid !== team.captainUserId)
        .reduce((sum, uid) => {
          const b = session.bidHistory.filter(h => h.playerId === uid && h.teamId === teamId).pop();
          return sum + (b ? b.amount : 0);
        }, 0);

      const calculatedRemaining = team.purseTotal - spent;
      if (Math.abs(calculatedRemaining - team.purseRemaining) > 1) {
        errors.push(`Purse imbalance on team ${team.name}: calculated ${calculatedRemaining} vs stored ${team.purseRemaining}.`);
      }

      // 2. Roster count checks
      if (team.primaryRosterUserIds.length > 5) {
        errors.push(`Primary roster overflow on team ${team.name}: ${team.primaryRosterUserIds.length} players (max 5).`);
      }
      if (team.standInUserIds.length > 1) {
        errors.push(`Stand-in roster overflow on team ${team.name}: ${team.standInUserIds.length} stand-ins (max 1).`);
      }

      // 3. Duplicate check
      for (const pId of [...team.primaryRosterUserIds, ...team.standInUserIds]) {
        if (seenPlayers.has(pId)) {
          errors.push(`Duplicate player assignment detected: player ${pId} on multiple teams.`);
        }
        seenPlayers.add(pId);
        totalDrafted++;
      }
    }

    for (const p of Object.values(session.players)) {
      if (p.status === 'AVAILABLE') totalAvailable++;
      if (p.status === 'UNSOLD') totalUnsold++;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalTeams,
      totalPlayersDrafted: totalDrafted,
      totalUnsold,
      totalAvailable,
      realCaptainsCount,
      testCaptainsCount
    }
  };
}

/**
 * Executes an audited action on behalf of a test captain by an organizer/admin.
 * STRICTLY ENFORCES:
 * - tournament.testMode === true
 * - target captain.isTestAccount === true
 * - Real captain can NEVER be impersonated!
 */
export async function executeImpersonatedCaptainAction(params: {
  tournamentId: string;
  actorAdminUserId: string;
  actingAsTestCaptainUserId: string;
  action:
    | { type: 'BID'; bidAmount: number }
    | { type: 'NOMINATE'; playerId: string; openingBid?: number }
    | { type: 'CUSTOMIZE_TEAM'; teamName: string; teamTag?: string; color?: string; logo?: string };
}): Promise<{
  success: boolean;
  result?: any;
  audit: TestCaptainActionAudit;
}> {
  const { tournamentId, actorAdminUserId, actingAsTestCaptainUserId, action } = params;

  // 1. Security Check: tournament must be in testMode
  if (!isTournamentInTestMode(tournamentId)) {
    throw new Error('SECURITY_VIOLATION: Test captain control is prohibited in production tournaments.');
  }

  // 2. Security Check: target captain must be an explicit test account
  const partMap = inMemoryParticipants.get(tournamentId);
  const targetCaptain = partMap?.get(actingAsTestCaptainUserId);
  const isTest = targetCaptain?.isTestAccount === true || targetCaptain?.source === 'TEST_SEED' || actingAsTestCaptainUserId.startsWith('pbg-test-');

  if (!isTest) {
    throw new Error('SECURITY_VIOLATION: Cannot control real user account. Impersonation only permitted for test captains.');
  }

  let executionResult: any;

  // 3. Execute exact authoritative business logic without bypassing rules
  if (action.type === 'BID') {
    executionResult = await placeBidAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      bidAmount: action.bidAmount
    });
  } else if (action.type === 'NOMINATE') {
    executionResult = await nominatePlayerAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      playerId: action.playerId,
      openingBid: action.openingBid
    });
  } else if (action.type === 'CUSTOMIZE_TEAM') {
    const session = inMemoryAuctionSessions.get(tournamentId);
    const team = Object.values(session?.teams || {}).find(t => t.captainUserId === actingAsTestCaptainUserId);
    if (!team) {
      throw new Error('TEAM_NOT_FOUND: Test captain does not own an active auction team.');
    }
    executionResult = await updateTeamBrandingAuthoritative({
      tournamentId,
      actorUserId: actingAsTestCaptainUserId,
      teamId: team.teamId,
      branding: {
        name: action.teamName,
        tag: action.teamTag,
        color: action.color,
        logo: action.logo
      },
      isOrganiser: true
    });
  }

  // 4. Record audit entry
  const audit: TestCaptainActionAudit = {
    auditId: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    actorAdminUserId,
    actingAsTestCaptainUserId,
    testCaptainName: targetCaptain?.displayName || actingAsTestCaptainUserId,
    actionType: action.type,
    details: {
      action,
      tournamentId
    },
    testMode: true
  };

  inMemoryActionAudits.push(audit);

  return {
    success: true,
    result: executionResult,
    audit
  };
}

/**
 * Returns recorded audit logs for test captain control.
 */
export function getTestCaptainActionAudits(tournamentId: string = TEST_TOURNAMENT_ID): TestCaptainActionAudit[] {
  return inMemoryActionAudits.filter(a => (a.details as any)?.tournamentId === tournamentId);
}
