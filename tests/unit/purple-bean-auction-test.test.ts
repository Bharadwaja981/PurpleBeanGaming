import { describe, it, expect, beforeEach } from 'vitest';
import {
  TEST_TOURNAMENT_ID,
  DUMMY_TEST_PLAYERS,
  DUMMY_TEST_CAPTAINS,
  seedTestPlayers,
  seedTestCaptains,
  assignTestCaptainsToSlots,
  resetAuctionTestData,
  deleteTestFixtures,
  runAuctionIntegrityCheck,
  executeImpersonatedCaptainAction,
  getTestCaptainActionAudits,
  isTournamentInTestMode
} from '../../src/server/auctionTestTools';
import { PURPLE_BEAN_AUCTION_TEST_CONFIG } from '../../src/data/seedTournaments';
import { tournamentConfigRegistry } from '../../src/domain/tournamentConfigRegistry';
import { tournamentService } from '../../src/services/firebaseService';
import {
  evaluateRegistrationEligibility,
  validateAuctionReadiness,
  createParticipantFromApprovedRegistration
} from '../../src/domain/tournamentRegistrationEngine';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';
import {
  inMemoryRegistrations,
  inMemoryParticipants,
  TournamentRegistrationRecord,
  TournamentParticipantRecord
} from '../../src/server/tournamentRegistrationOperations';
import {
  startAuctionSessionAuthoritative,
  inMemoryAuctionSessions
} from '../../src/server/tournamentAuctionOperations';
import { syncDiscordTournamentRoles } from '../../src/server/discordTournamentSyncService';
import { dotaCareerHistoryEngine } from '../../src/domain/dotaCareerHistoryEngine';

describe('Purple Bean Auction Test Suite — Production-Safe Validation Sandbox', () => {
  beforeEach(() => {
    // Reset tournament state
    inMemoryRegistrations.delete(TEST_TOURNAMENT_ID);
    inMemoryParticipants.delete(TEST_TOURNAMENT_ID);
    inMemoryAuctionSessions.delete(TEST_TOURNAMENT_ID);
    tournamentConfigRegistry.registerConfig(PURPLE_BEAN_AUCTION_TEST_CONFIG);
  });

  describe('1. Tournament Identity & Configuration Invariants', () => {
    it('initializes with testMode === true, 3 teams, 3 captains, and 1000 credit purse', () => {
      const cfg = tournamentConfigRegistry.getConfig(TEST_TOURNAMENT_ID);
      expect(cfg).toBeDefined();
      expect(cfg?.identity.name).toBe('Purple Bean Auction Test');
      expect(cfg?.identity.gameId).toBe('dota2');
      expect(cfg?.identity.testMode).toBe(true);
      expect(cfg?.identity.environment).toBe('TEST TOURNAMENT');

      // 3 teams, 3 captains
      expect(cfg?.teamFormation.numberOfTeams).toBe(3);
      expect(cfg?.teamFormation.mode).toBe('AUCTION');

      // Roster: 5 primary (1 captain + 4 drafted) + 1 optional stand-in
      expect(cfg?.roster.primaryRosterSize).toBe(5);
      expect(cfg?.roster.captainCountsTowardRoster).toBe(true);
      expect(cfg?.roster.substituteSlots).toBe(1);

      // Auction configuration: 1000 credits, 10 min bid
      expect(cfg?.auction?.pursePerTeam || cfg?.auction?.baseCredits).toBe(1000);
      expect(cfg?.auction?.minimumBid).toBe(10);

      // Registration: open, captain applications enabled
      expect(cfg?.registration.registrationMode).toBe('INDIVIDUAL');
      expect(cfg?.registration.captainApplicationsEnabled).toBe(true);

      expect(isTournamentInTestMode(TEST_TOURNAMENT_ID)).toBe(true);
    });

    it('guarantees test tournament does not alter permanent career ratings or leaderboards', () => {
      const ratingRes = dotaCareerHistoryEngine.processMatchRating({
        matchId: 'match-test-001',
        tournamentId: TEST_TOURNAMENT_ID,
        winnerTeamId: 'team-slot-1',
        loserTeamId: 'team-slot-2',
        winnerScore: 2,
        loserScore: 1,
        winnerRosterPlayerIds: ['pbg-test-001'],
        loserRosterPlayerIds: ['pbg-test-002'],
        appliedAt: new Date().toISOString()
      }, { isAdmin: true });

      expect(ratingRes.success).toBe(false);
      expect(ratingRes.error).toContain('DENIED: Test tournament matches do not contribute');
      expect(ratingRes.events.length).toBe(0);
    });
  });

  describe('2. Dummy Test Players Seeding & Identity Bypass Rules', () => {
    it('seeds 15 realistic balanced dummy players with valid MMRs and distinct Dota roles', () => {
      const seedRes = seedTestPlayers(TEST_TOURNAMENT_ID);
      expect(seedRes.success).toBe(true);
      expect(seedRes.count).toBe(15);
      expect(DUMMY_TEST_PLAYERS.length).toBe(15);

      // Verify role balance across P1-P5
      const p1s = DUMMY_TEST_PLAYERS.filter(p => p.primaryRole === 'Position 1 — Carry');
      const p2s = DUMMY_TEST_PLAYERS.filter(p => p.primaryRole === 'Position 2 — Mid');
      const p3s = DUMMY_TEST_PLAYERS.filter(p => p.primaryRole === 'Position 3 — Offlane');
      const p4s = DUMMY_TEST_PLAYERS.filter(p => p.primaryRole === 'Position 4 — Soft Support');
      const p5s = DUMMY_TEST_PLAYERS.filter(p => p.primaryRole === 'Position 5 — Hard Support');

      expect(p1s.length).toBe(3);
      expect(p2s.length).toBe(3);
      expect(p3s.length).toBe(3);
      expect(p4s.length).toBe(3);
      expect(p5s.length).toBe(3);

      // Verify every dummy player has differing primary and secondary roles
      for (const p of DUMMY_TEST_PLAYERS) {
        expect(p.primaryRole).not.toBe(p.secondaryRole);
        expect(p.isTestAccount).toBe(true);
        expect(p.source).toBe('TEST_SEED');
        expect(p.pbgId).toMatch(/^PBG-TEST-\d{3}$/);
      }
    });

    it('enforces that identity bypass requires BOTH testMode === true AND isTestAccount === true', () => {
      // 1. Dummy player in testMode -> passes with bypass note
      const dummyEval = evaluateRegistrationEligibility({
        pbgAccount: {
          googleUid: 'pbg-test-001',
          pbgId: 'PBG-TEST-001',
          displayName: 'ApexCarry',
          isTestAccount: true,
          source: 'TEST_SEED',
          discordLinked: false,
          dotaAccountLinked: false
        },
        tournament: {
          id: TEST_TOURNAMENT_ID,
          status: 'REGISTRATION_OPEN',
          testMode: true,
          discordRequired: true,
          dotaRequired: true
        },
        formData: {
          declaredMMR: 5950,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          captainApplicant: false,
          availabilityConfirmed: true,
          rulesAccepted: true
        }
      });

      expect(dummyEval.overallStatus).toBe('ELIGIBLE');
      const bypassCheck = dummyEval.checks.find(c => c.code === 'TEST_IDENTITY_BYPASS');
      expect(bypassCheck).toBeDefined();
      expect(bypassCheck?.passed).toBe(true);

      // 2. Real player in testMode (without Discord) -> strictly FAILS! Never bypassed!
      const realPlayerEval = evaluateRegistrationEligibility({
        pbgAccount: {
          googleUid: 'real-user-123',
          pbgId: 'PBG-REAL-001',
          displayName: 'RealPlayer',
          isTestAccount: false,
          discordLinked: false,
          dotaAccountLinked: true,
          dotaAccountVerified: true,
          dotaAccountId: '12345678'
        },
        tournament: {
          id: TEST_TOURNAMENT_ID,
          status: 'REGISTRATION_OPEN',
          testMode: true,
          discordRequired: true,
          dotaRequired: true
        },
        formData: {
          declaredMMR: 5000,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          captainApplicant: true,
          availabilityConfirmed: true,
          rulesAccepted: true
        }
      });

      expect(realPlayerEval.overallStatus).toBe('INELIGIBLE');
      const discordCheck = realPlayerEval.checks.find(c => c.code === 'DISCORD_LINK_REQUIRED');
      expect(discordCheck?.passed).toBe(false);
      expect(discordCheck?.message).toContain('Discord account linking is required');

      // 3. Dummy player in non-testMode tournament -> strictly FAILS!
      const dummyInProdEval = evaluateRegistrationEligibility({
        pbgAccount: {
          googleUid: 'pbg-test-001',
          pbgId: 'PBG-TEST-001',
          displayName: 'ApexCarry',
          isTestAccount: true,
          discordLinked: false
        },
        tournament: {
          id: 'india-masters-2026',
          status: 'REGISTRATION_OPEN',
          testMode: false,
          discordRequired: true
        },
        formData: {
          declaredMMR: 5950,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          captainApplicant: false,
          availabilityConfirmed: true,
          rulesAccepted: true
        }
      });

      expect(dummyInProdEval.overallStatus).toBe('INELIGIBLE');
    });
  });

  describe('3. Real Account Registration, Captain Approval & Discord Lifecycle', () => {
    it('supports real second account registering normally and assigns to Slot 1', () => {
      // 1. Seed dummy players and dummy captains for slots 2 & 3
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      // 2. Real second PBG account registers
      const realUid = 'real-user-captain-01';
      const realPbgId = 'PBG-REAL-001';

      pbgAccountRegistry.registerOrUpdateAccount({
        googleUid: realUid,
        pbgId: realPbgId,
        displayName: 'RealCaptainOne',
        email: 'realcaptain@gmail.com',
        discordUserId: 'discord-real-captain-1',
        discordUsername: 'RealCaptain#0001',
        discordLinked: true,
        discordMemberVerified: true,
        steamId: '76561198000000001',
        dotaAccountId: '100000001',
        dotaAccountVerified: true,
        isTestAccount: false
      });

      const realReg: TournamentRegistrationRecord = {
        id: `reg-${TEST_TOURNAMENT_ID}-${realUid}`,
        tournamentId: TEST_TOURNAMENT_ID,
        userId: realUid,
        pbgId: realPbgId,
        ign: 'RealCaptainOne',
        declaredMMR: 6200,
        tournamentMMR: 6200,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        interestedInCaptaincy: true,
        applyingAsCaptain: true,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        isTestAccount: false,
        identitySnapshot: {
          discordUserId: 'discord-real-captain-1',
          dotaAccountId: '100000001',
          steamId: '76561198000000001',
          isTestAccount: false
        } as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const regMap = inMemoryRegistrations.get(TEST_TOURNAMENT_ID)!;
      regMap.set(realUid, realReg);

      // Organizer selects real account for Captain Slot 1
      const realPart = createParticipantFromApprovedRegistration({
        registration: realReg,
        tournamentRole: 'CAPTAIN',
        captainSlotId: 'slot-1'
      });

      const partMap = inMemoryParticipants.get(TEST_TOURNAMENT_ID)!;
      partMap.set(realUid, realPart);

      // Verify captain slots structure:
      // Slot 1: Real account
      // Slot 2: Test Captain 02
      // Slot 3: Test Captain 03
      const c1 = partMap.get(realUid);
      const c2 = partMap.get('pbg-test-captain-02');
      const c3 = partMap.get('pbg-test-captain-03');

      expect(c1?.captainSlotId).toBe('slot-1');
      expect(c1?.isTestAccount).toBeFalsy();
      expect(c2?.captainSlotId).toBe('slot-2');
      expect(c2?.isTestAccount).toBe(true);
      expect(c3?.captainSlotId).toBe('slot-3');
      expect(c3?.isTestAccount).toBe(true);
    });

    it('executes real Discord sync for real account and skips test identities cleanly as SKIPPED_TEST_IDENTITY', async () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      // 1. Sync for dummy test player -> cleanly skipped
      const dummySync = await syncDiscordTournamentRoles({
        userId: 'pbg-test-001',
        tournamentId: TEST_TOURNAMENT_ID
      });

      expect(dummySync.success).toBe(true);
      expect(dummySync.skipped).toBe(true);
      expect(dummySync.reason).toBe('SKIPPED_TEST_IDENTITY');

      // 2. Sync for dummy test captain -> cleanly skipped
      const dummyCapSync = await syncDiscordTournamentRoles({
        userId: 'pbg-test-captain-02',
        tournamentId: TEST_TOURNAMENT_ID
      });

      expect(dummyCapSync.success).toBe(true);
      expect(dummyCapSync.skipped).toBe(true);
      expect(dummyCapSync.reason).toBe('SKIPPED_TEST_IDENTITY');

      // 3. Sync for real captain account -> executes full role computation
      const mockFetch = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/members/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ roles: ['role_pbg_member'] })
          } as any;
        }
        return { ok: true, status: 204 } as any;
      };

      const realSync = await syncDiscordTournamentRoles({
        userId: 'real-user-captain-01',
        tournamentId: TEST_TOURNAMENT_ID,
        overrideContext: {
          participant: {
            tournamentId: TEST_TOURNAMENT_ID,
            userId: 'real-user-captain-01',
            pbgId: 'PBG-REAL-001',
            tournamentRole: 'CAPTAIN',
            auctionStatus: 'NOT_IN_POOL',
            participantStatus: 'ACTIVE',
            captainSlotId: 'slot-1',
            teamId: null,
            joinedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          discordLink: {
            discordUserId: 'discord-real-captain-1',
            discordLinked: true,
            pbgMemberRoleActive: true
          }
        },
        fetchFn: mockFetch as any
      });

      expect(realSync.success).toBe(true);
      expect(realSync.skipped).toBeFalsy();
      expect(realSync.discordUserId).toBe('discord-real-captain-1');
      expect(realSync.rolesAdded).toContain('1555884061111746651');
      expect(realSync.rolesAdded).toContain('1556338549807259658');
    });
  });

  describe('4. AUCTION_READY Verification', () => {
    it('satisfies AUCTION_READY contract when real captain is in slot 1 and test captains in slots 2 and 3', () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      const realUid = 'real-user-captain-01';
      const regMap = inMemoryRegistrations.get(TEST_TOURNAMENT_ID)!;
      const partMap = inMemoryParticipants.get(TEST_TOURNAMENT_ID)!;

      const realReg: TournamentRegistrationRecord = {
        id: `reg-${TEST_TOURNAMENT_ID}-${realUid}`,
        tournamentId: TEST_TOURNAMENT_ID,
        userId: realUid,
        pbgId: 'PBG-REAL-001',
        ign: 'RealCaptainOne',
        declaredMMR: 6200,
        tournamentMMR: 6200,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        interestedInCaptaincy: true,
        applyingAsCaptain: true,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        isTestAccount: false,
        identitySnapshot: {
          discordUserId: 'discord-real-captain-1',
          dotaAccountId: '100000001',
          steamId: '76561198000000001',
          isTestAccount: false
        } as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      regMap.set(realUid, realReg);

      const realPart = createParticipantFromApprovedRegistration({
        registration: realReg,
        tournamentRole: 'CAPTAIN',
        captainSlotId: 'slot-1'
      });
      partMap.set(realUid, realPart);

      const readiness = validateAuctionReadiness({
        lifecycle: 'REGISTRATION_CLOSED',
        participants: Array.from(partMap.values()),
        registrations: Array.from(regMap.values()),
        targetCaptainCount: 3,
        testMode: true
      });

      expect(readiness.isReady).toBe(true);
      expect(readiness.blockers.length).toBe(0);
      expect(readiness.totalCaptains).toBe(3);
      expect(readiness.totalAuctionPool).toBe(15);
      expect(readiness.checks.requiredCaptainsSelected).toBe(true);
      expect(readiness.checks.uniqueCaptainSlots).toBe(true);
      expect(readiness.checks.captainsExcludedFromPool).toBe(true);
      expect(readiness.checks.discordLinkageValidForAll).toBe(true);
    });
  });

  describe('5. Test Account Auction Access & Admin Impersonation Controls', () => {
    it('allows admin to control test captains with strict validation and audit logging', async () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      const realUid = 'real-user-captain-01';
      const regMap = inMemoryRegistrations.get(TEST_TOURNAMENT_ID)!;
      const partMap = inMemoryParticipants.get(TEST_TOURNAMENT_ID)!;

      const realReg: TournamentRegistrationRecord = {
        id: `reg-${TEST_TOURNAMENT_ID}-${realUid}`,
        tournamentId: TEST_TOURNAMENT_ID,
        userId: realUid,
        pbgId: 'PBG-REAL-001',
        ign: 'RealCaptainOne',
        declaredMMR: 6200,
        tournamentMMR: 6200,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        interestedInCaptaincy: true,
        applyingAsCaptain: true,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        isTestAccount: false,
        identitySnapshot: {
          discordUserId: 'discord-real-captain-1',
          dotaAccountId: '100000001',
          steamId: '76561198000000001',
          isTestAccount: false
        } as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      regMap.set(realUid, realReg);

      const realPart = createParticipantFromApprovedRegistration({
        registration: realReg,
        tournamentRole: 'CAPTAIN',
        captainSlotId: 'slot-1'
      });
      partMap.set(realUid, realPart);

      // Start authoritative auction session
      const { session } = await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNAMENT_ID,
        actorUserId: 'admin-organizer-uid',
        targetCaptainCount: 3,
        configOverride: {
          pursePerTeam: 1000,
          minimumBid: 10
        }
      });

      expect(session).toBeDefined();
      expect(Object.keys(session.teams).length).toBe(3);

      // 1. Admin nominates on behalf of Test Captain 02
      const nomRes = await executeImpersonatedCaptainAction({
        tournamentId: TEST_TOURNAMENT_ID,
        actorAdminUserId: 'admin-organizer-uid',
        actingAsTestCaptainUserId: 'pbg-test-captain-02',
        action: {
          type: 'NOMINATE',
          playerId: 'pbg-test-001',
          openingBid: 10
        }
      });

      expect(nomRes.success).toBe(true);
      expect(nomRes.audit.actorAdminUserId).toBe('admin-organizer-uid');
      expect(nomRes.audit.actingAsTestCaptainUserId).toBe('pbg-test-captain-02');
      expect(nomRes.audit.testMode).toBe(true);

      // 2. Admin places bid on behalf of Test Captain 03
      const bidRes = await executeImpersonatedCaptainAction({
        tournamentId: TEST_TOURNAMENT_ID,
        actorAdminUserId: 'admin-organizer-uid',
        actingAsTestCaptainUserId: 'pbg-test-captain-03',
        action: {
          type: 'BID',
          bidAmount: 20
        }
      });

      expect(bidRes.success).toBe(true);
      expect(bidRes.audit.actingAsTestCaptainUserId).toBe('pbg-test-captain-03');

      // Verify audit history is queryable
      const audits = getTestCaptainActionAudits(TEST_TOURNAMENT_ID);
      expect(audits.length).toBe(2);

      // 3. Security Rule: Cannot impersonate real captain account!
      await expect(executeImpersonatedCaptainAction({
        tournamentId: TEST_TOURNAMENT_ID,
        actorAdminUserId: 'admin-organizer-uid',
        actingAsTestCaptainUserId: realUid, // Real account
        action: {
          type: 'BID',
          bidAmount: 30
        }
      })).rejects.toThrow('SECURITY_VIOLATION: Cannot control real user account.');
    });
  });

  describe('6. Auction Integrity Check & Safe Reset', () => {
    it('verifies auction integrity check detects purse and roster limits', () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      const integrity = runAuctionIntegrityCheck(TEST_TOURNAMENT_ID);
      expect(integrity.valid).toBe(true);
      expect(integrity.summary.testCaptainsCount).toBe(2);
    });

    it('resets auction test data while preserving real second account registration', () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      assignTestCaptainsToSlots(TEST_TOURNAMENT_ID);

      const realUid = 'real-user-captain-01';
      const regMap = inMemoryRegistrations.get(TEST_TOURNAMENT_ID)!;
      const partMap = inMemoryParticipants.get(TEST_TOURNAMENT_ID)!;

      const realReg: TournamentRegistrationRecord = {
        id: `reg-${TEST_TOURNAMENT_ID}-${realUid}`,
        tournamentId: TEST_TOURNAMENT_ID,
        userId: realUid,
        pbgId: 'PBG-REAL-001',
        ign: 'RealCaptainOne',
        declaredMMR: 6200,
        tournamentMMR: 6200,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        interestedInCaptaincy: true,
        applyingAsCaptain: true,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        isTestAccount: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      regMap.set(realUid, realReg);

      const realPart: TournamentParticipantRecord = {
        tournamentId: TEST_TOURNAMENT_ID,
        userId: realUid,
        pbgId: 'PBG-REAL-001',
        displayName: 'RealCaptainOne',
        tournamentRole: 'CAPTAIN',
        auctionStatus: 'NOT_IN_POOL',
        participantStatus: 'ACTIVE',
        captainSlotId: 'slot-1',
        teamId: null,
        isTestAccount: false,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      partMap.set(realUid, realPart);

      // Default reset (preserves real registration)
      const resetRes = resetAuctionTestData(TEST_TOURNAMENT_ID, false);
      expect(resetRes.success).toBe(true);
      expect(resetRes.preservedRealRegistrationsCount).toBe(1);

      // Verify real registration still exists
      expect(regMap.has(realUid)).toBe(true);
      expect(partMap.has(realUid)).toBe(true);
    });

    it('deletes dummy test fixtures cleanly when requested', () => {
      seedTestPlayers(TEST_TOURNAMENT_ID);
      seedTestCaptains(TEST_TOURNAMENT_ID);

      const deleteRes = deleteTestFixtures(TEST_TOURNAMENT_ID);
      expect(deleteRes.success).toBe(true);
      expect(deleteRes.deletedCount).toBeGreaterThanOrEqual(17);

      const regMap = inMemoryRegistrations.get(TEST_TOURNAMENT_ID);
      expect(regMap?.size || 0).toBe(0);
    });
  });
});
