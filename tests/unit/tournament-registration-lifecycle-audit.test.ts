import { describe, it, expect, beforeEach } from 'vitest';
import {
  TournamentRegistrationRecord,
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig,
  evaluateRegistrationEligibility,
  createParticipantFromApprovedRegistration,
  assignParticipantAsCaptain,
  removeParticipantFromCaptain,
  validateAuctionReadiness
} from '../../src/domain/tournamentRegistrationEngine';
import {
  getDesiredTournamentDiscordRoles,
  buildDiscordRoleReconciliationPlan,
  DiscordSyncContext
} from '../../src/domain/discordTournamentRoleEngine';
import {
  inMemoryRegistrations,
  inMemoryCaptains,
  inMemoryLifecycles,
  submitTournamentRegistrationAuthoritative,
  reviewTournamentRegistrationAuthoritative,
  selectTournamentCaptainAuthoritative,
  removeTournamentCaptainAuthoritative,
  restoreTeamFromEliminationAuthoritative,
  setTournamentLifecycleAuthoritative
} from '../../src/server/tournamentRegistrationOperations';
import {
  inMemoryParticipants,
  inMemoryTournamentTeams,
  inMemorySyncJobs,
  syncDiscordTournamentRoles,
  cleanupEliminatedTeamDiscordRoles,
  cleanupTournamentCompletionDiscordRoles,
  retryPendingDiscordSyncJobs
} from '../../src/server/discordTournamentSyncService';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';

const TEST_TOURNEY_ID = 'audit-test-tourney';
const PBG_MEMBER_ROLE_ID = '1555885374713237524';
const TOURNEY_PLAYER_ROLE_ID = 'role_tourney_player_999';
const CAPTAIN_ROLE_ID = 'role_captain_888';
const TEAM_ROLE_ID = 'role_team_777';

const mockDiscordConfig: TournamentDiscordConfig = {
  enabled: true,
  guildId: '631715510631006219',
  roles: {
    tournamentPlayerRoleId: TOURNEY_PLAYER_ROLE_ID,
    captainRoleId: CAPTAIN_ROLE_ID
  },
  teamRolesEnabled: true,
  cleanupPolicy: {
    onElimination: true,
    onTournamentCompletion: true
  }
};

describe('Tournament Registration, Captain Selection & Discord Role Synchronization Audit', () => {
  beforeEach(() => {
    inMemoryRegistrations.delete(TEST_TOURNEY_ID);
    inMemoryParticipants.delete(TEST_TOURNEY_ID);
    inMemoryCaptains.delete(TEST_TOURNEY_ID);
    inMemoryTournamentTeams.delete(TEST_TOURNEY_ID);
    inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_OPEN');
    inMemorySyncJobs.clear();
  });

  // -----------------------------------------------------------------
  // 1. Approve same player twice
  // -----------------------------------------------------------------
  it('1. registration approval atomically creates/updates exactly one participant record (no duplicates)', async () => {
    // Seed an approved registration
    const reg: TournamentRegistrationRecord = {
      id: 'user-p1',
      tournamentId: TEST_TOURNEY_ID,
      userId: 'user-p1',
      pbgId: 'PBG-000101',
      status: 'SUBMITTED',
      eligibilityStatus: 'ELIGIBLE',
      captainApplicant: false,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMMR: 5500,
      tournamentMMR: 5500,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identitySnapshot: {
        pbgId: 'PBG-000101',
        displayName: 'Test Carry',
        discordUserId: 'discord-p1'
      },
      tournamentData: {
        declaredMMR: 5500,
        tournamentMMR: 5500,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        captainApplicant: false,
        availabilityConfirmed: true,
        rulesAccepted: true
      },
      eligibilityChecks: [
        { code: 'PBG_PROFILE_COMPLETE', passed: true, severity: 'PASS', message: 'OK' },
        { code: 'DISCORD_LINK_REQUIRED', passed: true, severity: 'PASS', message: 'OK' },
        { code: 'PBG_MEMBER_ROLE_REQUIRED', passed: true, severity: 'PASS', message: 'OK' }
      ]
    };

    const regMap = new Map<string, TournamentRegistrationRecord>();
    regMap.set('user-p1', reg);
    inMemoryRegistrations.set(TEST_TOURNEY_ID, regMap);

    // First approval
    const res1 = await reviewTournamentRegistrationAuthoritative({
      organizerUserId: 'organizer-lead',
      tournamentId: TEST_TOURNEY_ID,
      targetUserId: 'user-p1',
      action: 'APPROVE'
    });

    expect(res1.registration.status).toBe('APPROVED');
    expect(res1.participant).toBeDefined();
    expect(res1.participant?.tournamentRole).toBe('PLAYER');
    expect(res1.participant?.auctionStatus).toBe('AVAILABLE');

    const pMap = inMemoryParticipants.get(TEST_TOURNEY_ID);
    expect(pMap?.size).toBe(1);
    expect(pMap?.get('user-p1')).toBeDefined();

    // Second approval of the same player
    const res2 = await reviewTournamentRegistrationAuthoritative({
      organizerUserId: 'organizer-lead',
      tournamentId: TEST_TOURNEY_ID,
      targetUserId: 'user-p1',
      action: 'APPROVE'
    });

    expect(res2.registration.status).toBe('APPROVED');
    // Participant map still contains exactly one participant
    expect(pMap?.size).toBe(1);
    expect(pMap?.get('user-p1')?.userId).toBe('user-p1');
  });

  // -----------------------------------------------------------------
  // 2. Concurrent duplicate registration
  // -----------------------------------------------------------------
  it('2. concurrent duplicate registration is rejected server-side', async () => {
    // Register user with PBG account in registry
    pbgAccountRegistry.registerOrUpdateAccount({
      pbgId: 'PBG-000199',
      displayName: 'Concurrent Tester',
      email: 'concurrent@pbg.test',
      discordLinked: true,
      discordUserId: 'discord-concurrent-99',
      discordMemberVerified: true,
      dotaAccountLinked: true,
      dotaAccountId: '999111222',
      dotaAccountVerified: true
    });

    const formData = {
      declaredMMR: 5000,
      tournamentMMR: 5000,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      captainApplicant: false,
      availabilityConfirmed: true,
      rulesAccepted: true
    };

    // Fire two registration calls concurrently
    const [call1, call2] = await Promise.allSettled([
      submitTournamentRegistrationAuthoritative({
        userId: 'PBG-000199',
        tournamentId: TEST_TOURNEY_ID,
        formData
      }),
      submitTournamentRegistrationAuthoritative({
        userId: 'PBG-000199',
        tournamentId: TEST_TOURNEY_ID,
        formData
      })
    ]);

    const successes = [call1, call2].filter(c => c.status === 'fulfilled');
    const failures = [call1, call2].filter(c => c.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    if (failures[0].status === 'rejected') {
      expect((failures[0] as PromiseRejectedResult).reason.message).toContain('ALREADY_REGISTERED');
    }
  });

  // -----------------------------------------------------------------
  // 3. Duplicate Discord ID
  // -----------------------------------------------------------------
  it('3. duplicate Discord ID across different players is blocked', () => {
    const existing: TournamentRegistrationRecord = {
      id: 'user-1',
      tournamentId: TEST_TOURNEY_ID,
      userId: 'user-1',
      pbgId: 'PBG-000101',
      status: 'APPROVED',
      eligibilityStatus: 'ELIGIBLE',
      captainApplicant: false,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMMR: 5000,
      tournamentMMR: 5000,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identitySnapshot: {
        pbgId: 'PBG-000101',
        displayName: 'Player One',
        discordUserId: 'shared-discord-id-123'
      },
      tournamentData: {} as any,
      eligibilityChecks: []
    };

    const evaluation = evaluateRegistrationEligibility({
      userId: 'user-2',
      tournamentId: TEST_TOURNEY_ID,
      pbgAccount: {
        pbgId: 'PBG-000102',
        displayName: 'Player Two',
        discordLinked: true,
        discordUserId: 'shared-discord-id-123',
        dotaAccountLinked: true,
        dotaAccountId: '111222333',
        dotaAccountVerified: true
      },
      tournament: { id: TEST_TOURNEY_ID, status: 'OPEN', discordRequired: true, dotaRequired: true },
      formData: {
        declaredMMR: 5000,
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 4 — Soft Support',
        captainApplicant: false,
        availabilityConfirmed: true,
        rulesAccepted: true
      },
      existingRegistrations: [existing]
    });

    expect(evaluation.overallStatus).toBe('INELIGIBLE');
    const dupCheck = evaluation.checks.find(c => c.code === 'DUPLICATE_DISCORD_ID');
    expect(dupCheck).toBeDefined();
    expect(dupCheck?.severity).toBe('FAIL');
    expect(dupCheck?.passed).toBe(false);
  });

  // -----------------------------------------------------------------
  // 4. Duplicate Dota ID
  // -----------------------------------------------------------------
  it('4. duplicate Dota 2 ID across different players is blocked', () => {
    const existing: TournamentRegistrationRecord = {
      id: 'user-1',
      tournamentId: TEST_TOURNEY_ID,
      userId: 'user-1',
      pbgId: 'PBG-000101',
      status: 'APPROVED',
      eligibilityStatus: 'ELIGIBLE',
      captainApplicant: false,
      primaryRole: 'Position 1 — Carry',
      secondaryRole: 'Position 2 — Mid',
      declaredMMR: 5000,
      tournamentMMR: 5000,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identitySnapshot: {
        pbgId: 'PBG-000101',
        displayName: 'Player One',
        dotaAccountId: 'shared-dota-9999'
      },
      tournamentData: {} as any,
      eligibilityChecks: []
    };

    const evaluation = evaluateRegistrationEligibility({
      userId: 'user-2',
      tournamentId: TEST_TOURNEY_ID,
      pbgAccount: {
        pbgId: 'PBG-000102',
        displayName: 'Player Two',
        discordLinked: true,
        discordUserId: 'unique-discord-2',
        dotaAccountLinked: true,
        dotaAccountId: 'shared-dota-9999',
        dotaAccountVerified: true
      },
      tournament: { id: TEST_TOURNEY_ID, status: 'OPEN', discordRequired: true, dotaRequired: true },
      formData: {
        declaredMMR: 5000,
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 4 — Soft Support',
        captainApplicant: false,
        availabilityConfirmed: true,
        rulesAccepted: true
      },
      existingRegistrations: [existing]
    });

    expect(evaluation.overallStatus).toBe('INELIGIBLE');
    const dupCheck = evaluation.checks.find(c => c.code === 'DUPLICATE_DOTA_ID');
    expect(dupCheck).toBeDefined();
    expect(dupCheck?.severity).toBe('FAIL');
    expect(dupCheck?.passed).toBe(false);
  });

  // -----------------------------------------------------------------
  // 5. Captain replacement
  // -----------------------------------------------------------------
  it('5. captain replacement atomic handoff correctly updates both players', async () => {
    const pMap = new Map<string, TournamentParticipantRecord>();
    const playerA: TournamentParticipantRecord = {
      userId: 'user-a',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-a',
      pbgId: 'PBG-000101',
      displayName: 'Captain A',
      participantStatus: 'ACTIVE',
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const playerB: TournamentParticipantRecord = {
      userId: 'user-b',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-b',
      pbgId: 'PBG-000102',
      displayName: 'Player B',
      participantStatus: 'ACTIVE',
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    pMap.set('user-a', playerA);
    pMap.set('user-b', playerB);
    inMemoryParticipants.set(TEST_TOURNEY_ID, pMap);

    // 1. Assign Player A to slot-1
    await selectTournamentCaptainAuthoritative({
      organizerUserId: 'organizer-lead',
      tournamentId: TEST_TOURNEY_ID,
      targetUserId: 'user-a',
      captainSlotId: 'slot-1'
    });

    expect(pMap.get('user-a')?.tournamentRole).toBe('CAPTAIN');
    expect(pMap.get('user-a')?.captainSlotId).toBe('slot-1');
    expect(pMap.get('user-a')?.auctionStatus).toBe('NOT_IN_POOL');
    expect(pMap.get('user-a')?.teamId).toBeNull();

    // 2. Replace slot-1 with Player B
    const replaceRes = await selectTournamentCaptainAuthoritative({
      organizerUserId: 'organizer-lead',
      tournamentId: TEST_TOURNEY_ID,
      targetUserId: 'user-b',
      captainSlotId: 'slot-1'
    });

    // Player B is now captain for slot-1
    expect(replaceRes.participant.tournamentRole).toBe('CAPTAIN');
    expect(replaceRes.participant.captainSlotId).toBe('slot-1');
    expect(replaceRes.participant.auctionStatus).toBe('NOT_IN_POOL');
    expect(replaceRes.participant.teamId).toBeNull();

    // Player A was automatically replaced and returned to PLAYER pool!
    expect(replaceRes.replacedParticipant).toBeDefined();
    expect(replaceRes.replacedParticipant?.userId).toBe('user-a');
    expect(pMap.get('user-a')?.tournamentRole).toBe('PLAYER');
    expect(pMap.get('user-a')?.captainSlotId).toBeNull();
    expect(pMap.get('user-a')?.auctionStatus).toBe('AVAILABLE');
    expect(pMap.get('user-a')?.teamId).toBeNull();
  });

  // -----------------------------------------------------------------
  // 6. Captain removed back to auction pool
  // -----------------------------------------------------------------
  it('6. captain removal restores tournamentRole = PLAYER and auctionStatus = AVAILABLE', async () => {
    const pMap = new Map<string, TournamentParticipantRecord>();
    const cap: TournamentParticipantRecord = {
      userId: 'user-cap',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-cap',
      pbgId: 'PBG-000105',
      displayName: 'Resigning Captain',
      participantStatus: 'ACTIVE',
      tournamentRole: 'CAPTAIN',
      auctionStatus: 'NOT_IN_POOL',
      captainSlotId: 'slot-2',
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    pMap.set('user-cap', cap);
    inMemoryParticipants.set(TEST_TOURNEY_ID, pMap);

    const slotMap = new Map();
    slotMap.set('slot-2', {
      captainSlotId: 'slot-2',
      tournamentId: TEST_TOURNEY_ID,
      userId: 'user-cap',
      pbgId: 'PBG-000105',
      displayName: 'Resigning Captain',
      teamId: null,
      selectedAt: new Date().toISOString(),
      selectedBy: 'organizer'
    });
    inMemoryCaptains.set(TEST_TOURNEY_ID, slotMap);

    const updated = await removeTournamentCaptainAuthoritative({
      organizerUserId: 'organizer-lead',
      tournamentId: TEST_TOURNEY_ID,
      targetUserId: 'user-cap',
      captainSlotId: 'slot-2'
    });

    expect(updated.tournamentRole).toBe('PLAYER');
    expect(updated.captainSlotId).toBeNull();
    expect(updated.auctionStatus).toBe('AVAILABLE');
    expect(updated.teamId).toBeNull();
    expect(inMemoryCaptains.get(TEST_TOURNEY_ID)?.has('slot-2')).toBe(false);
  });

  // -----------------------------------------------------------------
  // 7. Selected captain excluded from auction
  // -----------------------------------------------------------------
  it('7. selected captain is strictly excluded from auction pool', () => {
    const captain = assignParticipantAsCaptain({
      userId: 'cap-1',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-1',
      pbgId: 'PBG-000101',
      displayName: 'Captain 1',
      participantStatus: 'ACTIVE',
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, 'slot-1');

    expect(captain.tournamentRole).toBe('CAPTAIN');
    expect(captain.auctionStatus).toBe('NOT_IN_POOL');
    expect(captain.captainSlotId).toBe('slot-1');
    expect(captain.teamId).toBeNull();

    // Verify auction pool filter ignores captain
    const participants: TournamentParticipantRecord[] = [
      captain,
      {
        userId: 'player-2',
        tournamentId: TEST_TOURNEY_ID,
        registrationId: 'reg-2',
        pbgId: 'PBG-000102',
        displayName: 'Normal Player',
        participantStatus: 'ACTIVE',
        tournamentRole: 'PLAYER',
        auctionStatus: 'AVAILABLE',
        captainSlotId: null,
        teamId: null,
        eliminated: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const report = validateAuctionReadiness({
      lifecycle: 'CAPTAIN_SELECTION',
      participants,
      registrations: [],
      targetCaptainCount: 1
    });

    expect(report.auctionPool.length).toBe(1);
    expect(report.auctionPool[0].userId).toBe('player-2');
    expect(report.auctionPool.some(p => p.userId === 'cap-1')).toBe(false);
  });

  // -----------------------------------------------------------------
  // 8. AUCTION_READY success
  // -----------------------------------------------------------------
  it('8. AUCTION_READY validator passes with 0 blockers when all conditions are met', () => {
    const registrations: TournamentRegistrationRecord[] = [];
    const participants: TournamentParticipantRecord[] = [];

    // 2 Captains and 8 Players
    const userIds = [
      'cap-1', 'cap-2',
      'p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8'
    ];

    userIds.forEach((uid, idx) => {
      const isCap = idx < 2;
      const pbgId = `PBG-000${100 + idx}`;
      const discordId = `discord-user-${idx}`;
      const dotaId = `dota-33633${idx}`;
      const steamId = `76561198${idx}`;

      registrations.push({
        id: uid,
        tournamentId: TEST_TOURNEY_ID,
        userId: uid,
        pbgId,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        captainApplicant: isCap,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMMR: 5000,
        tournamentMMR: 5000,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        identitySnapshot: {
          pbgId,
          displayName: `Player ${uid}`,
          discordUserId: discordId,
          dotaAccountId: dotaId,
          steamId
        },
        tournamentData: {} as any,
        eligibilityChecks: [
          { code: 'PBG_MEMBER_ROLE_REQUIRED', passed: true, severity: 'PASS', message: 'OK' }
        ]
      });

      participants.push({
        userId: uid,
        tournamentId: TEST_TOURNEY_ID,
        registrationId: uid,
        pbgId,
        displayName: `Player ${uid}`,
        participantStatus: 'ACTIVE',
        tournamentRole: isCap ? 'CAPTAIN' : 'PLAYER',
        auctionStatus: isCap ? 'NOT_IN_POOL' : 'AVAILABLE',
        captainSlotId: isCap ? `slot-${idx + 1}` : null,
        teamId: null,
        eliminated: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });

    const report = validateAuctionReadiness({
      lifecycle: 'CAPTAIN_SELECTION',
      participants,
      registrations,
      targetCaptainCount: 2
    });

    expect(report.isReady).toBe(true);
    expect(report.blockers.length).toBe(0);
    expect(report.totalCaptains).toBe(2);
    expect(report.totalAuctionPool).toBe(8);
  });

  // -----------------------------------------------------------------
  // 9. AUCTION_READY blocker cases
  // -----------------------------------------------------------------
  it('9. AUCTION_READY validator returns exact machine-readable blockers for invalid states', () => {
    // Case A: Registration still open
    const openReport = validateAuctionReadiness({
      lifecycle: 'REGISTRATION_OPEN',
      participants: [],
      registrations: [],
      targetCaptainCount: 2
    });
    expect(openReport.isReady).toBe(false);
    expect(openReport.blockers.some(b => b.code === 'REGISTRATION_NOT_CLOSED')).toBe(true);

    // Case B: Unresolved eligibility review
    const pendingReg: TournamentRegistrationRecord = {
      id: 'p-under-review',
      tournamentId: TEST_TOURNEY_ID,
      userId: 'p-under-review',
      pbgId: 'PBG-999',
      status: 'UNDER_REVIEW',
      eligibilityStatus: 'REVIEW_REQUIRED',
      captainApplicant: false,
      primaryRole: 'Position 1',
      secondaryRole: 'Position 2',
      declaredMMR: 4000,
      tournamentMMR: 4000,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      identitySnapshot: { pbgId: 'PBG-999', displayName: 'Pending' },
      tournamentData: {} as any,
      eligibilityChecks: []
    };

    const reviewReport = validateAuctionReadiness({
      lifecycle: 'CAPTAIN_SELECTION',
      participants: [],
      registrations: [pendingReg],
      targetCaptainCount: 2
    });
    expect(reviewReport.blockers.some(b => b.code === 'UNRESOLVED_ELIGIBILITY_REVIEWS')).toBe(true);

    // Case C: Duplicate captain slot assignment
    const dupSlotCaptains: TournamentParticipantRecord[] = [
      {
        userId: 'cap-a',
        tournamentId: TEST_TOURNEY_ID,
        registrationId: 'reg-a',
        pbgId: 'PBG-1',
        displayName: 'Cap A',
        participantStatus: 'ACTIVE',
        tournamentRole: 'CAPTAIN',
        auctionStatus: 'NOT_IN_POOL',
        captainSlotId: 'slot-1',
        teamId: null,
        eliminated: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        userId: 'cap-b',
        tournamentId: TEST_TOURNEY_ID,
        registrationId: 'reg-b',
        pbgId: 'PBG-2',
        displayName: 'Cap B',
        participantStatus: 'ACTIVE',
        tournamentRole: 'CAPTAIN',
        auctionStatus: 'NOT_IN_POOL',
        captainSlotId: 'slot-1', // CONFLICT!
        teamId: null,
        eliminated: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const slotConflictReport = validateAuctionReadiness({
      lifecycle: 'CAPTAIN_SELECTION',
      participants: dupSlotCaptains,
      registrations: [],
      targetCaptainCount: 2
    });
    expect(slotConflictReport.blockers.some(b => b.code === 'CAPTAIN_SLOT_CONFLICT')).toBe(true);

    // Case D: Captain erroneously left AVAILABLE in auction pool
    const contaminatedCaptain: TournamentParticipantRecord = {
      userId: 'cap-bad',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-bad',
      pbgId: 'PBG-3',
      displayName: 'Bad Captain',
      participantStatus: 'ACTIVE',
      tournamentRole: 'CAPTAIN',
      auctionStatus: 'AVAILABLE', // ERROR!
      captainSlotId: 'slot-1',
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const contamReport = validateAuctionReadiness({
      lifecycle: 'CAPTAIN_SELECTION',
      participants: [contaminatedCaptain],
      registrations: [],
      targetCaptainCount: 1
    });
    expect(contamReport.blockers.some(b => b.code === 'CAPTAINS_IN_AUCTION_POOL')).toBe(true);
  });

  // -----------------------------------------------------------------
  // 10. Discord sync retry
  // -----------------------------------------------------------------
  it('10. Discord API network outage creates retryable job and replaying job succeeds without failing PBG state', async () => {
    pbgAccountRegistry.registerOrUpdateAccount({
      pbgId: 'PBG-000555',
      displayName: 'Retry User',
      email: 'retry@pbg.test',
      discordLinked: true,
      discordUserId: 'discord-retry-555',
      discordMemberVerified: true
    });

    const participant: TournamentParticipantRecord = {
      userId: 'PBG-000555',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-retry',
      pbgId: 'PBG-000555',
      displayName: 'Retry User',
      participantStatus: 'ACTIVE',
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const pMap = new Map();
    pMap.set('PBG-000555', participant);
    inMemoryParticipants.set(TEST_TOURNEY_ID, pMap);

    // 1. Mock fetch failure (Discord API 500 / down)
    const failingFetch = (async () => {
      return { ok: false, status: 500, json: async () => ({}) } as any;
    }) as any;

    const resFail = await syncDiscordTournamentRoles({
      userId: 'PBG-000555',
      tournamentId: TEST_TOURNEY_ID,
      fetchFn: failingFetch
    });

    // PBG state is intact, retry job is queued
    expect(resFail.success).toBe(false);
    expect(resFail.jobId).toBeDefined();
    expect(inMemorySyncJobs.has(`sync_${TEST_TOURNEY_ID}_PBG-000555`)).toBe(true);
    expect(inMemorySyncJobs.get(`sync_${TEST_TOURNEY_ID}_PBG-000555`)?.status).toBe('PENDING');

    // 2. Mock fetch recovering (Discord API healthy)
    const successfulFetch = (async () => {
      return { ok: true, status: 200, json: async () => ({ roles: [] }) } as any;
    }) as any;

    const retryRes = await retryPendingDiscordSyncJobs({
      tournamentId: TEST_TOURNEY_ID,
      fetchFn: successfulFetch
    });

    expect(retryRes.totalRetried).toBe(1);
    expect(retryRes.succeeded).toBe(1);
    expect(inMemorySyncJobs.get(`sync_${TEST_TOURNEY_ID}_PBG-000555`)?.status).toBe('SUCCESS');
  });

  // -----------------------------------------------------------------
  // 11. Discord role restoration after result correction
  // -----------------------------------------------------------------
  it('11. result correction un-elimination automatically restores temporary tournament and team roles', async () => {
    const memberId = 'user-contender-1';
    pbgAccountRegistry.registerOrUpdateAccount({
      pbgId: 'PBG-000777',
      displayName: 'Contender 1',
      email: 'contender1@pbg.test',
      discordLinked: true,
      discordUserId: 'discord-contender-777',
      discordMemberVerified: true
    });

    const teamRecord: TournamentTeamRecord = {
      id: 'team-phoenix',
      tournamentId: TEST_TOURNEY_ID,
      name: 'Phoenix Rising',
      tag: 'PR',
      captainUserId: memberId,
      roster: [memberId],
      discord: {
        roleId: TEAM_ROLE_ID,
        roleName: 'Phoenix Rising',
        createdAt: new Date().toISOString()
      },
      status: 'ELIMINATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const teamMap = new Map();
    teamMap.set('team-phoenix', teamRecord);
    inMemoryTournamentTeams.set(TEST_TOURNEY_ID, teamMap);

    const participant: TournamentParticipantRecord = {
      userId: memberId,
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-c1',
      pbgId: 'PBG-000777',
      displayName: 'Contender 1',
      participantStatus: 'ACTIVE',
      tournamentRole: 'CAPTAIN',
      auctionStatus: 'NOT_IN_POOL',
      captainSlotId: 'slot-1',
      teamId: 'team-phoenix',
      eliminated: true, // currently eliminated
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const pMap = new Map();
    pMap.set(memberId, participant);
    inMemoryParticipants.set(TEST_TOURNEY_ID, pMap);

    // Verify: while eliminated, desired roles has only PBG Member
    const eliminatedDesired = getDesiredTournamentDiscordRoles({
      tournament: { id: TEST_TOURNEY_ID, status: 'LIVE', discordConfig: mockDiscordConfig },
      participant,
      team: teamRecord,
      discordLink: { discordLinked: true, discordUserId: 'discord-contender-777', pbgMemberRoleActive: true },
      pbgMemberRoleId: PBG_MEMBER_ROLE_ID
    });
    expect(eliminatedDesired.desiredRoleIds).toEqual([PBG_MEMBER_ROLE_ID]);

    // Now execute result correction restoration
    const successfulFetch = (async () => {
      return { ok: true, status: 204, json: async () => ({}) } as any;
    }) as any;

    const restoreRes = await restoreTeamFromEliminationAuthoritative({
      tournamentId: TEST_TOURNEY_ID,
      teamId: 'team-phoenix',
      fetchFn: successfulFetch
    });

    expect(restoreRes.team.status).toBe('ACTIVE');
    expect(restoreRes.restoredParticipants[0].eliminated).toBe(false);

    // Verify: restored state grants PBG Member + Tournament Player + Captain + Team Role
    const restoredDesired = getDesiredTournamentDiscordRoles({
      tournament: { id: TEST_TOURNEY_ID, status: 'LIVE', discordConfig: mockDiscordConfig },
      participant: restoreRes.restoredParticipants[0],
      team: restoreRes.team,
      discordLink: { discordLinked: true, discordUserId: 'discord-contender-777', pbgMemberRoleActive: true },
      pbgMemberRoleId: PBG_MEMBER_ROLE_ID
    });

    expect(restoredDesired.desiredRoleIds).toContain(PBG_MEMBER_ROLE_ID);
    expect(restoredDesired.desiredRoleIds).toContain(TOURNEY_PLAYER_ROLE_ID);
    expect(restoredDesired.desiredRoleIds).toContain(CAPTAIN_ROLE_ID);
    expect(restoredDesired.desiredRoleIds).toContain(TEAM_ROLE_ID);
  });

  // -----------------------------------------------------------------
  // 12. Repeated tournament cleanup safety
  // -----------------------------------------------------------------
  it('12. tournament completion cleanup is idempotent and safe to run multiple times', async () => {
    const team: TournamentTeamRecord = {
      id: 'team-alpha',
      tournamentId: TEST_TOURNEY_ID,
      name: 'Team Alpha',
      tag: 'ALP',
      captainUserId: 'user-cap-alpha',
      roster: ['user-cap-alpha'],
      discord: {
        roleId: 'role-temp-team-alpha',
        roleName: 'Team Alpha',
        createdAt: new Date().toISOString()
      },
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const participant: TournamentParticipantRecord = {
      userId: 'user-cap-alpha',
      tournamentId: TEST_TOURNEY_ID,
      registrationId: 'reg-alpha',
      pbgId: 'PBG-000888',
      displayName: 'Captain Alpha',
      participantStatus: 'ACTIVE',
      tournamentRole: 'CAPTAIN',
      auctionStatus: 'NOT_IN_POOL',
      captainSlotId: 'slot-1',
      teamId: 'team-alpha',
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const mockFetch = (async () => {
      return { ok: true, status: 204, json: async () => ({}) } as any;
    }) as any;

    // Run 1st cleanup
    const run1 = await cleanupTournamentCompletionDiscordRoles({
      tournamentId: TEST_TOURNEY_ID,
      teams: [team],
      participants: [participant],
      discordConfig: mockDiscordConfig,
      fetchFn: mockFetch
    });

    expect(run1.totalParticipantsCleaned).toBe(1);
    expect(run1.deletedTeamRoles).toBe(1);

    // Run 2nd cleanup immediately after
    const run2 = await cleanupTournamentCompletionDiscordRoles({
      tournamentId: TEST_TOURNEY_ID,
      teams: [team],
      participants: [participant],
      discordConfig: mockDiscordConfig,
      fetchFn: mockFetch
    });

    // Runs cleanly without double-deleting or throwing errors
    expect(run2.totalParticipantsCleaned).toBe(1);
    expect(run2.deletedTeamRoles).toBe(0); // already deleted
  });

  // -----------------------------------------------------------------
  // 13. PBG Member preservation
  // -----------------------------------------------------------------
  it('13. PBG Member role is NEVER removed during tournament cleanup or role revocation', () => {
    // Test elimination plan
    const eliminatedContext: DiscordSyncContext = {
      tournament: { id: TEST_TOURNEY_ID, status: 'LIVE', discordConfig: mockDiscordConfig },
      participant: {
        userId: 'user-elim',
        tournamentId: TEST_TOURNEY_ID,
        registrationId: 'reg-e',
        pbgId: 'PBG-999',
        displayName: 'Eliminated Player',
        participantStatus: 'ACTIVE',
        tournamentRole: 'PLAYER',
        auctionStatus: 'AVAILABLE',
        captainSlotId: null,
        teamId: 'team-dead',
        eliminated: true,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      team: {
        id: 'team-dead',
        tournamentId: TEST_TOURNEY_ID,
        name: 'Eliminated Team',
        tag: 'ET',
        captainUserId: 'other',
        roster: ['user-elim'],
        status: 'ELIMINATED',
        discord: { roleId: TEAM_ROLE_ID, roleName: 'Elim Team', createdAt: '' },
        createdAt: '',
        updatedAt: ''
      },
      discordLink: { discordLinked: true, discordUserId: 'discord-elim-999', pbgMemberRoleActive: true },
      pbgMemberRoleId: PBG_MEMBER_ROLE_ID
    };

    const desiredEliminated = getDesiredTournamentDiscordRoles(eliminatedContext);
    expect(desiredEliminated.desiredRoleIds).toContain(PBG_MEMBER_ROLE_ID);
    expect(desiredEliminated.undesiredRoleIds).toContain(TOURNEY_PLAYER_ROLE_ID);
    expect(desiredEliminated.undesiredRoleIds).toContain(TEAM_ROLE_ID);
    expect(desiredEliminated.undesiredRoleIds).not.toContain(PBG_MEMBER_ROLE_ID);

    // Now generate reconciliation plan where user currently holds PBG Member + Tournament Player + Team Role
    const plan = buildDiscordRoleReconciliationPlan({
      guildId: 'guild-1',
      discordUserId: 'discord-elim-999',
      actualDiscordRoles: [PBG_MEMBER_ROLE_ID, TOURNEY_PLAYER_ROLE_ID, TEAM_ROLE_ID],
      desiredResult: desiredEliminated,
      managedRoleIds: [PBG_MEMBER_ROLE_ID, TOURNEY_PLAYER_ROLE_ID, CAPTAIN_ROLE_ID, TEAM_ROLE_ID],
      pbgMemberRoleId: PBG_MEMBER_ROLE_ID
    });

    // Temporary tournament roles are stripped
    expect(plan.rolesToRemove).toContain(TOURNEY_PLAYER_ROLE_ID);
    expect(plan.rolesToRemove).toContain(TEAM_ROLE_ID);
    // CRUCIAL INVARIANT: PBG Member MUST NEVER be in rolesToRemove!
    expect(plan.rolesToRemove).not.toContain(PBG_MEMBER_ROLE_ID);
  });
});
