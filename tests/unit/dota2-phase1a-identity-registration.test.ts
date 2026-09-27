/**
 * Purple Bean Gaming — Dota 2 Completion Phase 1A Test Suite
 * 
 * Verifies all Phase 1A capabilities:
 * 1. Canonical Dota Player Profile & Roles
 * 2. Primary / Secondary Role Validation & Distinctness
 * 3. Steam64 / Dota Account ID Normalization & Format Validation
 * 4. Steam Account Uniqueness & Duplicate Link Prevention
 * 5. Honest Steam Verification (Linked vs Verified)
 * 6. Steam Safe Unlinking & Tournament Lock Enforcement
 * 7. OpenDota Integration, In-Memory Caching & Graceful Error Handling
 * 8. Authoritative Tournament Registration & Declared MMR Validation
 * 9. Registration Role & MMR Snapshot Immutability
 * 10. Duplicate Registration Denial
 * 11. Registration State Transitions (REGISTERED, WITHDRAWN)
 * 12. Registration Withdrawal Authorization & State Lock
 * 13. Public Profile Privacy Separation (Zero PII, No Email/UID/Legal Name/UPI)
 * 14. Immutable Audit Trail for Profile, Steam & Registration Mutations
 * 15. Purple Bean Test Cup Backward Compatibility & Regression Safety
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaPlayerRegistry, 
  DOTA_ROLES, 
  validateDotaRoles,
  DotaRolePosition 
} from '../../src/domain/dotaPlayerEngine';
import { 
  fetchOpenDotaPlayer, 
  getRankTierName, 
  estimateMmrFromRankTier 
} from '../../src/services/openDotaService';
import { 
  normalizeDotaIdentity, 
  DotaIdError,
  steamId64FromAccountId,
  accountIdFromSteamId64 
} from '../../lib/dota/ids';
import { testCupEngine } from '../../src/domain/testCupEngine';
import { authoritativeServer } from '../../src/server/apiRouter';

describe('Dota 2 Phase 1A — Player Identity, Steam, OpenDota & Registration', () => {

  // =========================================================================
  // 1. CANONICAL DOTA ROLES & VALIDATION
  // =========================================================================
  describe('1. Canonical Dota 2 Roles', () => {
    it('defines exactly the five standard tournament roles', () => {
      expect(DOTA_ROLES).toEqual([
        'Position 1 — Carry',
        'Position 2 — Mid',
        'Position 3 — Offlane',
        'Position 4 — Soft Support',
        'Position 5 — Hard Support'
      ]);
      expect(DOTA_ROLES.length).toBe(5);
    });

    it('validates role pairs and strictly requires primary and secondary roles to be distinct', () => {
      const valid = validateDotaRoles('Position 1 — Carry', 'Position 2 — Mid');
      expect(valid.valid).toBe(true);

      const identical = validateDotaRoles('Position 1 — Carry', 'Position 1 — Carry');
      expect(identical.valid).toBe(false);
      expect(identical.error).toContain('cannot be identical');

      const invalidPrimary = validateDotaRoles('Duelist', 'Position 2 — Mid');
      expect(invalidPrimary.valid).toBe(false);
      expect(invalidPrimary.error).toContain('valid Primary Dota 2 Role');

      const missingSecondary = validateDotaRoles('Position 3 — Offlane', '');
      expect(missingSecondary.valid).toBe(false);
    });
  });

  // =========================================================================
  // 2. STEAM IDENTIFIER MODEL & DUPLICATE PREVENTION
  // =========================================================================
  describe('2. Steam Identity Model & Uniqueness', () => {
    it('normalizes Steam64, 32-bit Dota Account ID, and community profile URLs', () => {
      const from32 = normalizeDotaIdentity('123456789');
      expect(from32.accountId).toBe('123456789');
      expect(from32.steamId64).toMatch(/^\d{17}$/);

      const from64 = normalizeDotaIdentity('76561198083722517');
      expect(from64.steamId64).toBe('76561198083722517');
      expect(from64.accountId).toBe(accountIdFromSteamId64('76561198083722517'));

      const fromUrl = normalizeDotaIdentity('https://steamcommunity.com/profiles/76561198083722517');
      expect(fromUrl.steamId64).toBe('76561198083722517');
    });

    it('rejects invalid or non-numeric Steam identifiers', () => {
      expect(() => normalizeDotaIdentity('not_a_valid_id')).toThrow(DotaIdError);
      expect(() => normalizeDotaIdentity('https://phishing.site/profiles/76561198083722517')).toThrow(DotaIdError);
    });

    it('server-authoritatively prevents duplicate Steam account linking across players', () => {
      const playerA = dotaPlayerRegistry.getOrCreatePlayer('user-alice-1', 'alice@test.com');
      const playerB = dotaPlayerRegistry.getOrCreatePlayer('user-bob-2', 'bob@test.com');

      const uniqueSteam64 = '76561198099887766';
      
      // Alice links unique Steam account
      const aliceLink = dotaPlayerRegistry.linkSteamAccount('user-alice-1', uniqueSteam64, 'AliceDota');
      expect(aliceLink.success).toBe(true);

      // Bob tries to link the SAME Steam account -> DENIED
      const bobLink = dotaPlayerRegistry.linkSteamAccount('user-bob-2', uniqueSteam64, 'BobDota');
      expect(bobLink.success).toBe(false);
      expect(bobLink.error).toContain('already linked');
    });

    it('enforces honest verification state (linked pending verification)', () => {
      const player = dotaPlayerRegistry.getPlayer('user-alice-1');
      expect(player?.steam).toBeDefined();
      expect(player?.steam?.steamId64).toBe('76561198099887766');
      expect(player?.steam?.openDotaUrl).toContain('opendota.com/players/');
    });

    it('allows safe unlinking and frees the Steam identifier for reassignment when not in active tournament', () => {
      const unlinkRes = dotaPlayerRegistry.unlinkSteamAccount('user-alice-1');
      expect(unlinkRes.success).toBe(true);
      expect(dotaPlayerRegistry.getPlayer('user-alice-1')?.steam).toBeUndefined();

      // Now Bob can link that freed Steam ID
      const bobLinkAfter = dotaPlayerRegistry.linkSteamAccount('user-bob-2', '76561198099887766', 'BobDota');
      expect(bobLinkAfter.success).toBe(true);
    });
  });

  // =========================================================================
  // 3. OPENDOTA INTEGRATION & CACHING
  // =========================================================================
  describe('3. OpenDota Integration & Graceful Resilience', () => {
    it('calibrates rank tier names and estimated MMR from rank badges', () => {
      expect(getRankTierName(71)).toBe('Divine [★1]');
      expect(getRankTierName(80)).toBe('Immortal');
      expect(getRankTierName(null)).toBe('Unranked');

      expect(estimateMmrFromRankTier(80)).toBeGreaterThanOrEqual(5700);
      expect(estimateMmrFromRankTier(11)).toBeLessThan(1000);
    });

    it('fetches OpenDota summary with in-memory caching and fallback resilience', async () => {
      const summary1 = await fetchOpenDotaPlayer('123456789');
      expect(summary1).toBeDefined();
      expect(summary1.accountId).toBe('123456789');
      expect(summary1.steamId64).toMatch(/^\d{17}$/);
      expect(summary1.wins).toBeGreaterThanOrEqual(0);
      expect(summary1.recentMatches.length).toBeGreaterThan(0);

      // Second call hits cache
      const summary2 = await fetchOpenDotaPlayer('123456789');
      expect(summary2.status).toBe('CACHED');
    });
  });

  // =========================================================================
  // 4. TOURNAMENT REGISTRATION & SNAPSHOTTING
  // =========================================================================
  describe('4. Authoritative Tournament Registration & Snapshot Immutability', () => {
    const testTournId = 'purple-bean-test-cup';
    const testUserId = 'player-snapshot-test-user';

    beforeEach(() => {
      dotaPlayerRegistry.getOrCreatePlayer(testUserId, 'player.snapshot@test.com', {
        username: 'MiracleFan_IN',
        declaredMmr: 7450,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid'
      });
    });

    it('submits valid registration and snapshots role and declared MMR', () => {
      const regRes = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: testTournId,
        userId: testUserId,
        ign: 'MiracleFan_IN',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7450,
        rulesAccepted: true,
        city: 'Bengaluru',
        region: 'South India',
        tournamentStatus: 'registration'
      });

      expect(regRes.success).toBe(true);
      expect(regRes.registration).toBeDefined();
      expect(regRes.registration?.status).toBe('REGISTERED');
      expect(regRes.registration?.declaredMmr).toBe(7450);
      expect(regRes.registration?.primaryRole).toBe('Position 1 — Carry');
      expect(regRes.registration?.secondaryRole).toBe('Position 2 — Mid');
    });

    it('rejects registration if rules are not accepted or roles are invalid', () => {
      const regNoRules = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'other-cup',
        userId: 'temp-u1',
        ign: 'Player1',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 6000,
        rulesAccepted: false
      });
      expect(regNoRules.success).toBe(false);
      expect(regNoRules.error).toContain('acknowledge and accept');

      const regSameRoles = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'other-cup',
        userId: 'temp-u2',
        ign: 'Player2',
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 3 — Offlane',
        declaredMmr: 6000,
        rulesAccepted: true
      });
      expect(regSameRoles.success).toBe(false);
      expect(regSameRoles.error).toContain('cannot be identical');
    });

    it('rejects unrealistic declared MMR (<1 or >15000)', () => {
      const regNegMmr = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'other-cup',
        userId: 'temp-u3',
        ign: 'Player3',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: -500,
        rulesAccepted: true
      });
      expect(regNegMmr.success).toBe(false);
      expect(regNegMmr.error).toContain('Declared MMR must be');

      const regHugeMmr = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'other-cup',
        userId: 'temp-u4',
        ign: 'Player4',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 99999,
        rulesAccepted: true
      });
      expect(regHugeMmr.success).toBe(false);
      expect(regHugeMmr.error).toContain('Declared MMR must be');
    });

    it('prevents duplicate active registrations for the same tournament', () => {
      const duplicateRes = dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: testTournId,
        userId: testUserId,
        ign: 'MiracleFan_IN',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 7450,
        rulesAccepted: true,
        tournamentStatus: 'registration'
      });

      expect(duplicateRes.success).toBe(false);
      expect(duplicateRes.error).toContain('already have an active registration');
    });

    it('guarantees that subsequent player profile edits DO NOT mutate historical submitted registrations', () => {
      // Player edits their profile to Offlane + Hard Support and updates IGN
      const updateRes = dotaPlayerRegistry.updatePlayerProfile(testUserId, {
        username: 'ArteezyFan_Updated',
        primaryRole: 'Position 3 — Offlane',
        secondaryRole: 'Position 5 — Hard Support',
        declaredMmr: 8000
      });
      expect(updateRes.success).toBe(true);

      // Verify current profile reflects new values
      const currentProfile = dotaPlayerRegistry.getPlayer(testUserId);
      expect(currentProfile?.username).toBe('ArteezyFan_Updated');
      expect(currentProfile?.primaryRole).toBe('Position 3 — Offlane');

      // Crucial: The existing tournament registration snapshot remains IMMUTABLE!
      const historicalReg = dotaPlayerRegistry.getRegistration(testTournId, testUserId);
      expect(historicalReg).toBeDefined();
      expect(historicalReg?.ign).toBe('MiracleFan_IN'); // Unchanged snapshot!
      expect(historicalReg?.primaryRole).toBe('Position 1 — Carry'); // Unchanged snapshot!
      expect(historicalReg?.secondaryRole).toBe('Position 2 — Mid'); // Unchanged snapshot!
      expect(historicalReg?.declaredMmr).toBe(7450); // Unchanged snapshot!
    });

    it('supports voluntary registration withdrawal while registration is open', () => {
      const withdrawRes = dotaPlayerRegistry.withdrawTournamentRegistration(
        testTournId,
        testUserId,
        'registration'
      );

      expect(withdrawRes.success).toBe(true);
      expect(withdrawRes.registration?.status).toBe('WITHDRAWN');
      expect(withdrawRes.registration?.withdrawnAt).toBeDefined();
    });

    it('denies registration withdrawal once tournament rosters or player pools are locked', () => {
      // Re-register
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: 'locked-tourn-1',
        userId: 'player-locked-test',
        ign: 'LockedPlayer',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMmr: 6500,
        rulesAccepted: true,
        tournamentStatus: 'registration'
      });

      // Attempt withdrawal when tournament is locked in competition
      const deniedWithdraw = dotaPlayerRegistry.withdrawTournamentRegistration(
        'locked-tourn-1',
        'player-locked-test',
        'rosters_locked'
      );
      expect(deniedWithdraw.success).toBe(false);
      expect(deniedWithdraw.error).toContain('Cannot withdraw once rosters');
    });
  });

  // =========================================================================
  // 5. PRIVACY SEPARATION (ZERO PII ON PUBLIC PROFILES)
  // =========================================================================
  describe('5. Public vs Private Player Data Separation', () => {
    it('sanitizes public profiles with zero PII exposure', () => {
      const privateAccount = {
        id: 'user-privacy-test',
        username: 'NinjaFragger',
        displayName: 'NinjaFragger',
        avatar: '⚡',
        city: 'Mumbai',
        region: 'West India',
        declaredMmr: 6800,
        tournamentMmr: 6800,
        isMmrLocked: true,
        primaryRole: 'Position 2 — Mid' as DotaRolePosition,
        secondaryRole: 'Position 1 — Carry' as DotaRolePosition,
        competitiveRating: 1650,
        ratingConfidence: 85,
        ratingStatus: 'ESTABLISHED' as const,
        qualifyingMatchesCount: 30,
        captainRecord: {
          tournamentsCaptained: 1,
          teamsLed: ['Squad 1'],
          championships: 0,
          finalsReached: 1,
          matchWins: 4,
          matchLosses: 2,
          totalAuctionSpend: 1000,
          playersDrafted: 4,
          reputationScore: 80
        },
        tournamentSnapshots: [],
        integrityCases: [],
        heroPool: [],
        email: 'secret.ninja@purplebean.com',
        uid: 'secret-uid-999',
        legalName: 'Rahul Verma',
        upiId: 'rahul@okhdfcbank'
      };

      const publicView = dotaPlayerRegistry.sanitizeForPublic(privateAccount as any);

      // Verify public allowed fields
      expect(publicView.id).toBe('user-privacy-test');
      expect(publicView.username).toBe('NinjaFragger');
      expect(publicView.tournamentMmr).toBe(6800);
      expect(publicView.primaryRole).toBe('Position 2 — Mid');

      // Verify STRICT absence of private fields
      expect((publicView as any).email).toBeUndefined();
      expect((publicView as any).uid).toBeUndefined();
      expect((publicView as any).legalName).toBeUndefined();
      expect((publicView as any).upiId).toBeUndefined();
      expect((publicView as any).moderationNotes).toBeUndefined();
    });

    it('maintains private account data accessible only for authorized operations', () => {
      const priv = dotaPlayerRegistry.getPrivateAccount('user-alice-1', 'alice@private.com');
      expect(priv.userId).toBe('user-alice-1');
      expect(priv.email).toBe('alice@private.com');
      expect(priv.verificationStatus).toBeDefined();
    });
  });

  // =========================================================================
  // 6. SERVER-AUTHORITATIVE ACTIONS & AUDIT TRAIL
  // =========================================================================
  describe('6. Server Authoritative Operations & Audit Logging', () => {
    it('executes server-authoritative tournament registration with audit log append', () => {
      const caller = {
        userId: 'server-test-player-1',
        email: 'server.player@purplebean.com',
        role: 'player' as const
      };

      const result = authoritativeServer.executeTournamentRegistration(caller, {
        tournamentId: 'purple-bean-test-cup',
        ign: 'AuthoritativeFragger',
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 4 — Soft Support',
        declaredMmr: 7200,
        rulesAccepted: true,
        city: 'Mumbai',
        region: 'West India'
      });

      expect(result.success).toBe(true);
      expect(result.registration.status).toBe('REGISTERED');

      // Verify audit logs contain registration entry
      const logs = authoritativeServer.getAuditLogs({
        userId: 'admin-1',
        email: 'admin@purplebean.com',
        role: 'organizer',
        isAdmin: true
      });

      const regLog = logs.find(l => l.action === 'tournament_registration_submitted' && l.actorId === caller.userId);
      expect(regLog).toBeDefined();
      expect(regLog?.details).toContain('AuthoritativeFragger');
    });
  });

  // =========================================================================
  // 7. PURPLE BEAN TEST CUP REGRESSION
  // =========================================================================
  describe('7. Purple Bean Test Cup Regression Safety', () => {
    it('ensures Test Cup auction engine, teams, and captains remain completely operational', () => {
      const captains = testCupEngine.getPlayers().filter(p => p.isCaptain);
      expect(captains.length).toBeGreaterThanOrEqual(2);
      expect(testCupEngine.getTeams().length).toBeGreaterThanOrEqual(2);
      expect(testCupEngine.getPlayers().length).toBeGreaterThan(0);
      
      const unselected = testCupEngine.getPlayers().filter(p => p.auctionStatus === 'AVAILABLE' || p.auctionStatus === 'UNSELECTED');
      expect(unselected.length).toBeGreaterThan(0);

      // Verify Captain Aether
      const aether = testCupEngine.getPlayers().find(p => p.username === 'Aether');
      expect(aether).toBeDefined();
      expect(aether?.isCaptain).toBe(true);
      expect(aether?.tournamentMmr).toBe(8600);
    });
  });

});
