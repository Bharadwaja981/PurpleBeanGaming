import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateDiscordSnowflake,
  maskDiscordUserId,
  reserveDiscordIdentityClaim,
  rollbackDiscordIdentityReservation,
  finalizeDiscordAccountAuthoritative,
  linkDiscordAccountAuthoritative,
  unlinkDiscordAccountAuthoritative,
  getPrivateDiscordAccount,
  getDiscordLinkDocument,
  reconcilePendingDiscordFinalization,
  _resetDiscordVerificationInMemoryStore,
  _setInMemoryActiveDiscordRegistration
} from '../../src/server/discordVerificationService';
import {
  generateSignedDiscordOAuthState,
  verifyAndConsumeDiscordOAuthState,
  sanitizeTrustedOrigin,
  _resetDiscordOAuthStateStore
} from '../../src/server/discordOAuthState';
import {
  fetchDiscordUserProfile,
  provisionDiscordGuildAndRole
} from '../../src/server/discordProvisioningService';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';

describe('Purple Bean Gaming — Discord OAuth & Identity Verification Audit Suite', () => {
  beforeEach(() => {
    _resetDiscordVerificationInMemoryStore();
    _resetDiscordOAuthStateStore();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. SNOWFLAKE VALIDATION & MASKING
  // =========================================================================
  describe('1. Snowflake Validation & Profile Masking', () => {
    it('validates 17-20 digit Discord Snowflake IDs accurately', () => {
      expect(validateDiscordSnowflake('782910482910492817')).toBe(true);
      expect(validateDiscordSnowflake('1048291048291049281')).toBe(true);
      expect(validateDiscordSnowflake('12345678901234567')).toBe(true); // 17 digits
      expect(validateDiscordSnowflake('12345678901234567890')).toBe(true); // 20 digits

      // Invalid format
      expect(validateDiscordSnowflake('12345')).toBe(false);
      expect(validateDiscordSnowflake('invalid_user_id')).toBe(false);
      expect(validateDiscordSnowflake('')).toBe(false);
      expect(validateDiscordSnowflake('123456789012345678901234')).toBe(false);
    });

    it('masks Discord Snowflake ID safely for public profiles', () => {
      const masked = maskDiscordUserId('782910482910492817');
      expect(masked.endsWith('2817')).toBe(true);
      expect(masked).toContain('••••');
      expect(masked).not.toBe('782910482910492817');
    });
  });

  // =========================================================================
  // 2. DISCORD USER ID SOURCE VERIFICATION
  // =========================================================================
  describe('2. Discord User ID Source Verification', () => {
    it('strictly extracts discord.userId from GET /users/@me response.id and NEVER from Client ID, Guild ID, or Role ID', async () => {
      const MOCK_CLIENT_ID = '1555572540695384074';
      const MOCK_GUILD_ID = '999988887777666655';
      const MOCK_ROLE_ID = '1555885374713237524';
      const ACTUAL_DISCORD_USER_ID = '876543210987654321';

      // Mock Discord API response for GET /users/@me
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: ACTUAL_DISCORD_USER_ID,
          username: 'dota_master',
          global_name: 'Dota Master',
          avatar: 'abcdef123456'
        })
      });

      global.fetch = mockFetch;

      const profile = await fetchDiscordUserProfile('mock_access_token');

      // Assertions proving ID source
      expect(profile.id).toBe(ACTUAL_DISCORD_USER_ID);
      expect(profile.id).not.toBe(MOCK_CLIENT_ID);
      expect(profile.id).not.toBe(MOCK_GUILD_ID);
      expect(profile.id).not.toBe(MOCK_ROLE_ID);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://discord.com/api/v10/users/@me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer mock_access_token'
          })
        })
      );
    });
  });

  // =========================================================================
  // 3. OAUTH STATE REPLAY & TAMPER PROTECTION
  // =========================================================================
  describe('3. OAuth State Replay, Expiration & Tamper Protection', () => {
    it('accepts a valid signed state token on first use', async () => {
      const stateToken = generateSignedDiscordOAuthState('user_123', {
        email: 'user@pbg.com',
        returnUrl: '/profile'
      });

      const result = await verifyAndConsumeDiscordOAuthState(stateToken, {
        expectedUid: 'user_123'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.payload.uid).toBe('user_123');
        expect(result.payload.nonce).toBeDefined();
      }
    });

    it('rejects a state token that has been tampered with or modified', async () => {
      const stateToken = generateSignedDiscordOAuthState('user_123');
      const parts = stateToken.split('.');
      const tamperedToken = `${parts[0]}tampered.${parts[1]}`;

      const result = await verifyAndConsumeDiscordOAuthState(tamperedToken);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('STATE_TAMPERED');
      }
    });

    it('rejects an expired state token', async () => {
      const stateToken = generateSignedDiscordOAuthState('user_123');

      // Verify with a customMaxAge of 0ms to simulate expiry
      const result = await verifyAndConsumeDiscordOAuthState(stateToken, {
        customMaxAgeMs: 0
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('STATE_EXPIRED');
      }
    });

    it('rejects state token on second attempt (Strict Replay Protection)', async () => {
      const stateToken = generateSignedDiscordOAuthState('user_123');

      // First consumption succeeds
      const firstResult = await verifyAndConsumeDiscordOAuthState(stateToken);
      expect(firstResult.success).toBe(true);

      // Replay attempt fails
      const replayResult = await verifyAndConsumeDiscordOAuthState(stateToken);
      expect(replayResult.success).toBe(false);
      if (!replayResult.success) {
        expect(replayResult.error).toBe('STATE_REPLAYED');
        expect(replayResult.details).toMatch(/already been consumed/i);
      }
    });

    it('rejects state token belonging to another authenticated user', async () => {
      const stateToken = generateSignedDiscordOAuthState('victim_user_456');

      const result = await verifyAndConsumeDiscordOAuthState(stateToken, {
        expectedUid: 'attacker_user_789'
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('USER_MISMATCH');
      }
    });
  });

  // =========================================================================
  // 4. IDENTITY CLAIM ORDER & ATOMIC RESERVATION
  // =========================================================================
  describe('4. Identity Claim Order, 1:1 Constraints & Rollback', () => {
    it('reserves Discord ID in discord_links BEFORE external side effects and prevents duplicate claims', async () => {
      const discordUserId = '777788889999000011';

      // Account A reserves the Discord ID
      const resA = await reserveDiscordIdentityClaim({
        userId: 'pbg_user_A',
        discordUserId
      });
      expect(resA.success).toBe(true);

      // Verify status is PENDING
      const linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc?.status).toBe('PENDING');
      expect(linkDoc?.pbgUserId).toBe('pbg_user_A');

      // Account B attempts to reserve the same Discord ID while Account A is linking -> DENIED
      await expect(
        reserveDiscordIdentityClaim({
          userId: 'pbg_user_B',
          discordUserId
        })
      ).rejects.toThrow(/already in progress/i);
    });

    it('rejects claim if Discord ID is already ACTIVE on another PBG account', async () => {
      const discordUserId = '112233445566778899';

      // Complete linking for Account A
      await linkDiscordAccountAuthoritative({
        userId: 'pbg_user_A',
        discordUserId,
        discordUsername: 'player_a'
      });

      const linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc?.status).toBe('ACTIVE');

      // Account B attempts linking -> rejected with DISCORD_ALREADY_LINKED
      await expect(
        reserveDiscordIdentityClaim({
          userId: 'pbg_user_B',
          discordUserId
        })
      ).rejects.toThrow(/already linked to another PurpleBeanGaming account/i);
    });

    it('rolls back pending reservation if Discord guild provisioning fails', async () => {
      const discordUserId = '555566667777888899';

      // Step 1: Reserve
      await reserveDiscordIdentityClaim({
        userId: 'pbg_user_failing',
        discordUserId
      });

      let linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc?.status).toBe('PENDING');

      // Step 2: Rollback (simulating Discord API error)
      await rollbackDiscordIdentityReservation(discordUserId, 'pbg_user_failing');

      linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc).toBeNull();

      // Another user can now reserve and claim the Discord ID
      const secondReserve = await reserveDiscordIdentityClaim({
        userId: 'pbg_user_next',
        discordUserId
      });
      expect(secondReserve.success).toBe(true);
    });

    it('idempotently allows the same user to re-reserve and finalize their Discord account', async () => {
      const discordUserId = '444455556666777788';

      // First link
      await linkDiscordAccountAuthoritative({
        userId: 'same_pbg_user',
        discordUserId,
        discordUsername: 'player_one',
        guildMember: true,
        pbgMemberRole: true
      });

      // Same user reserves again (idempotent)
      const res = await reserveDiscordIdentityClaim({
        userId: 'same_pbg_user',
        discordUserId
      });
      expect(res.success).toBe(true);
      expect(res.isSameUser).toBe(true);

      // Finalize again
      const finalRes = await finalizeDiscordAccountAuthoritative({
        userId: 'same_pbg_user',
        discordUserId,
        discordUsername: 'player_one',
        guildMember: true,
        pbgMemberRole: true
      });
      expect(finalRes.success).toBe(true);
    });
  });

  // =========================================================================
  // 5. GUILD & ROLE PROVISIONING SCENARIOS
  // =========================================================================
  describe('5. Discord Guild & Role Provisioning Scenarios', () => {
    it('provisions new member with 201 Created and assigns role in guild join call', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 201,
        ok: true,
        json: async () => ({
          roles: ['987654321098765432']
        })
      });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: '987654321098765432',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(true);
      expect(res.guildMember).toBe(true);
      expect(res.pbgMemberRole).toBe(true);
      expect(res.alreadyMember).toBe(false);
    });

    it('handles already-in-guild user (204 No Content) and explicitly assigns and verifies role', async () => {
      const mockFetch = vi.fn()
        // First call: PUT /guilds/{id}/members/{user_id} -> 204 No Content
        .mockResolvedValueOnce({
          status: 204,
          ok: true,
          json: async () => ({})
        })
        // Second call: PUT /guilds/{id}/members/{user_id}/roles/{role_id} -> 204 No Content
        .mockResolvedValueOnce({
          status: 204,
          ok: true,
          json: async () => ({})
        })
        // Third call: GET follow-up verification -> 200 OK with member roles
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => ({
            roles: ['987654321098765432']
          })
        });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: '987654321098765432',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(true);
      expect(res.guildMember).toBe(true);
      expect(res.pbgMemberRole).toBe(true);
      expect(res.alreadyMember).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('treats user who already has the role (204 No Content) as success', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ status: 204, ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ status: 204, ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => ({
            roles: ['987654321098765432']
          })
        });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: '987654321098765432',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(true);
      expect(res.pbgMemberRole).toBe(true);
    });

    it('detects incomplete provisioning when member is in guild but role is missing from verified roles', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ status: 204, ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({ status: 204, ok: true, json: async () => ({}) })
        .mockResolvedValueOnce({
          status: 200,
          ok: true,
          json: async () => ({
            roles: ['different_unrelated_role_id']
          })
        });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: '987654321098765432',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.guildMember).toBe(true);
      expect(res.pbgMemberRole).toBe(false);
      expect(res.errorCode).toBe('DISCORD_ROLE_VERIFICATION_FAILED');
    });

    it('detects incorrect/unknown guild ID (404 / 10004)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 404,
        ok: false,
        json: async () => ({ code: 10004, message: 'Unknown Guild' })
      });

      const res = await provisionDiscordGuildAndRole({
        guildId: 'invalid_guild_999',
        botToken: 'bot_token_secret',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DISCORD_INVALID_GUILD_ID');
      expect(res.errorMessage).toMatch(/not found/i);
    });

    it('detects incorrect/unknown role ID (404 / 10011)', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ status: 204, ok: true }) // already member
        .mockResolvedValueOnce({
          status: 404,
          ok: false,
          json: async () => ({ code: 10011, message: 'Unknown Role' })
        });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: 'invalid_role_000',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DISCORD_INVALID_ROLE_ID');
      expect(res.errorMessage).toMatch(/role ID does not exist/i);
    });

    it('detects bot missing "Manage Roles" permission (403 / 50013)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        json: async () => ({ code: 50013, message: 'Missing Permissions' })
      });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DISCORD_BOT_MISSING_PERMISSIONS');
    });

    it('detects role hierarchy failure (403 when assigning role above bot role)', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ status: 204, ok: true }) // in guild
        .mockResolvedValueOnce({
          status: 403,
          ok: false,
          json: async () => ({ code: 50013, message: 'Missing Permissions' })
        });

      const res = await provisionDiscordGuildAndRole({
        guildId: '123456789012345678',
        botToken: 'bot_token_secret',
        roleId: 'super_admin_role_id',
        discordUserId: '111122223333444455',
        accessToken: 'user_oauth_token',
        fetchFn: mockFetch as any
      });

      expect(res.success).toBe(false);
      expect(res.errorCode).toBe('DISCORD_ROLE_HIERARCHY_FAILURE');
      expect(res.errorMessage).toMatch(/hierarchy/i);
    });
  });

  // =========================================================================
  // 6. UNLINK POLICY & TOURNAMENT LOCKS
  // =========================================================================
  describe('6. Unlink Policy & Tournament Lock Enforcement', () => {
    it('blocks unlinking with ACTIVE_TOURNAMENT_LOCK when user is registered in active tournament', async () => {
      await linkDiscordAccountAuthoritative({
        userId: 'tournament_player_99',
        discordUserId: '999900001111222233',
        discordUsername: 'pro_dota_player'
      });

      _setInMemoryActiveDiscordRegistration('tourney-winter-cup', ['tournament_player_99']);

      await expect(unlinkDiscordAccountAuthoritative('tournament_player_99')).rejects.toThrow(
        /registered in an active tournament/i
      );

      // Verify connection remains intact
      const status = await getPrivateDiscordAccount('tournament_player_99');
      expect(status.discordLinked).toBe(true);
    });

    it('removes PBG identity association on unlink while preserving Discord server membership and roles', async () => {
      const discordUserId = '123123123123123123';
      await linkDiscordAccountAuthoritative({
        userId: 'free_player_100',
        discordUserId,
        discordUsername: 'casual_friend',
        guildMember: true,
        pbgMemberRole: true
      });

      const unlinkRes = await unlinkDiscordAccountAuthoritative('free_player_100');
      expect(unlinkRes.success).toBe(true);

      // Verify PBG link is removed
      const status = await getPrivateDiscordAccount('free_player_100');
      expect(status.discordLinked).toBe(false);
      expect(status.discordUserId).toBeNull();

      // Verify discord_links record is freed
      const linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc).toBeNull();

      // Now another user can link that Discord account
      const rebind = await linkDiscordAccountAuthoritative({
        userId: 'new_player_200',
        discordUserId,
        discordUsername: 'new_owner'
      });
      expect(rebind.success).toBe(true);
    });
  });

  // =========================================================================
  // 7. PBG ACCOUNT REGISTRY SYNCHRONIZATION
  // =========================================================================
  describe('7. PBG Account Registry Synchronization', () => {
    it('updates in-memory pbgAccountRegistry when linking Discord', () => {
      const reg = pbgAccountRegistry.getOrCreatePBGAccount({
        googleUid: 'google_uid_audit_test',
        email: 'audit_tester@gmail.com',
        displayName: 'Audit Tester'
      });

      const res = pbgAccountRegistry.linkDiscordAccount('google_uid_audit_test', {
        discordUserId: '333344445555666677',
        discordUsername: 'audit_master',
        discordDisplayName: 'Audit Master | PBG'
      });

      expect(res.success).toBe(true);
      expect(res.account?.discordLinked).toBe(true);
      expect(res.account?.discordUserId).toBe('333344445555666677');

      const lookup = pbgAccountRegistry.getAccountByDiscordId('333344445555666677');
      expect(lookup?.googleUid).toBe('google_uid_audit_test');
    });
  });

  // =========================================================================
  // 8. TRUSTED ORIGIN ALLOWLIST ENFORCEMENT
  // =========================================================================
  describe('8. Trusted Origin Allowlist Security', () => {
    it('allows verified PBG development and production origins', () => {
      const devOrigin = 'https://ais-dev-peyssjszcbcksxhcpybipw-243967175289.europe-west1.run.app';
      const prodOrigin = 'https://purplebeangaming.com';
      const localhostOrigin = 'http://localhost:3000';

      expect(sanitizeTrustedOrigin(devOrigin)).toBe(devOrigin);
      expect(sanitizeTrustedOrigin(prodOrigin)).toBe(prodOrigin);
      expect(sanitizeTrustedOrigin(localhostOrigin)).toBe(localhostOrigin);
    });

    it('rejects arbitrary client-supplied attacker origins and falls back to safe default', () => {
      const attackerOrigin = 'https://malicious-phishing-site.com';
      const result = sanitizeTrustedOrigin(attackerOrigin);

      expect(result).not.toBe(attackerOrigin);
      expect(result).toContain('run.app');
    });
  });

  // =========================================================================
  // 9. PROVISIONED_PENDING_FINALIZATION RECOVERY & RECONCILIATION
  // =========================================================================
  describe('9. Finalization Failure & Self-Healing Reconciliation', () => {
    it('reconciles PROVISIONED_PENDING_FINALIZATION record and auto-heals user profile', async () => {
      const discordUserId = '888899990000111122';
      const userId = 'unfinalized_user_55';

      // Simulate a state where Discord was provisioned, but finalization was interrupted
      await reserveDiscordIdentityClaim({
        userId,
        discordUserId
      });

      // Manually set status to PROVISIONED_PENDING_FINALIZATION
      const linkDoc = await getDiscordLinkDocument(discordUserId);
      expect(linkDoc).toBeDefined();
      if (linkDoc) {
        linkDoc.status = 'PROVISIONED_PENDING_FINALIZATION';
        linkDoc.discordUsername = 'provisioned_hero';
        linkDoc.guildMember = true;
        linkDoc.pbgMemberRole = true;
      }

      // Reconciliation executes
      const reconciled = await reconcilePendingDiscordFinalization(userId);
      expect(reconciled).not.toBeNull();
      expect(reconciled?.discordLinked).toBe(true);
      expect(reconciled?.discordUserId).toBe(discordUserId);

      // Verify link doc status is now ACTIVE
      const updatedLink = await getDiscordLinkDocument(discordUserId);
      expect(updatedLink?.status).toBe('ACTIVE');
    });
  });
});
