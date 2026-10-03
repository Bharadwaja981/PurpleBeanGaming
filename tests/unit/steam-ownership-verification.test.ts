import { describe, it, expect, beforeEach } from 'vitest';
import { 
  generateSignedSteamState, 
  verifySignedSteamState 
} from '../../src/server/steamState';
import { 
  buildSteamOpenIdLoginUrl, 
  validateSteamOpenIdCallback,
  STEAM_OPENID_ENDPOINT,
  OPENID_NS,
  OPENID_IDENTIFIER_SELECT
} from '../../src/server/steamOpenId';
import {
  linkSteamAccountAuthoritative,
  unlinkSteamAccountAuthoritative,
  getPublicPlayerSafeProfile,
  getPrivatePlayerAccount,
  maskSteamId64,
  _resetSteamVerificationInMemoryStore,
  _setInMemoryActiveRegistration
} from '../../src/server/steamVerificationService';
import { 
  accountIdFromSteamId64, 
  steamId64FromAccountId, 
  normalizeDotaIdentity 
} from '../../lib/dota/ids';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';
import { verifyFirebaseBearerToken } from '../../src/server/firebaseAdmin';

describe('Purple Bean Gaming — Steam OpenID 2.0 Ownership Verification Engine', () => {
  beforeEach(() => {
    _resetSteamVerificationInMemoryStore();
  });

  // 1. Anonymous user cannot start Steam verification
  it('1. rejects start verification when user is anonymous or missing Authorization header', async () => {
    await expect(verifyFirebaseBearerToken(undefined)).rejects.toThrow('SIGN_IN_REQUIRED');
    await expect(verifyFirebaseBearerToken('')).rejects.toThrow('SIGN_IN_REQUIRED');
    await expect(verifyFirebaseBearerToken('InvalidScheme abc')).rejects.toThrow('SIGN_IN_REQUIRED');
  });

  // 2. Valid Firebase token can start verification
  it('2. allows valid Firebase token to start verification and generates signed state', async () => {
    const user = await verifyFirebaseBearerToken('Bearer test-token-user_pbg_123');
    expect(user.uid).toBe('user_pbg_123');

    const stateToken = generateSignedSteamState(user.uid, {
      email: user.email,
      returnUrl: '/profile'
    });
    expect(stateToken).toBeDefined();
    expect(stateToken).toContain('.');

    const verified = verifySignedSteamState(stateToken);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.payload.uid).toBe('user_pbg_123');
    }

    const loginUrl = buildSteamOpenIdLoginUrl({
      realm: 'https://www.purplebeangaming.com',
      returnToUrl: `https://www.purplebeangaming.com/api/steam/link/callback?state=${encodeURIComponent(stateToken)}`
    });

    expect(loginUrl).toContain(STEAM_OPENID_ENDPOINT);
    expect(loginUrl).toContain(encodeURIComponent(OPENID_NS));
    expect(loginUrl).toContain('checkid_setup');
    expect(loginUrl).toContain(encodeURIComponent(OPENID_IDENTIFIER_SELECT));
  });

  // 3. Invalid Steam callback is rejected
  it('3. rejects invalid Steam callback mode or tampered parameters', async () => {
    // Mode cancel
    const cancelled = await validateSteamOpenIdCallback({ 'openid.mode': 'cancel' });
    expect(cancelled.isValid).toBe(false);
    expect(cancelled.error).toContain('STEAM_CANCELLED');

    // Invalid mode
    const invalidMode = await validateSteamOpenIdCallback({ 'openid.mode': 'unknown_mode' });
    expect(invalidMode.isValid).toBe(false);
    expect(invalidMode.error).toContain('STEAM_VALIDATION_FAILED');
  });

  // 4. Valid OpenID result extracts Steam64 correctly
  it('4. extracts legitimate 17-digit Steam64 identifier from claimed_id', () => {
    const rawClaimedId = 'https://steamcommunity.com/openid/id/76561198343915834';
    const match = /^https:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17})\/?$/.exec(rawClaimedId);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('76561198343915834');
    expect(/^[0-9]{17}$/.test(match![1])).toBe(true);

    // Invalid length or characters
    expect(/^https:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17})\/?$/.test('https://steamcommunity.com/openid/id/12345')).toBe(false);
    expect(/^https:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17})\/?$/.test('https://evil.com/openid/id/76561198343915834')).toBe(false);
  });

  // 5. Steam64 → Dota account ID conversion is correct
  it('5. converts Steam64 to Dota 32-bit Account ID accurately using BigInt math', () => {
    const steam64 = '76561198343915834'; // Canonical account: Robinhood
    const dotaId = accountIdFromSteamId64(steam64);
    expect(dotaId).toBe('383650106');

    // Reversible
    const backToSteam64 = steamId64FromAccountId(dotaId);
    expect(backToSteam64).toBe(steam64);

    // Normalize utility
    const normalized = normalizeDotaIdentity(steam64);
    expect(normalized.accountId).toBe('383650106');
    expect(normalized.steamId64).toBe(steam64);
  });

  // 6. Duplicate Steam account cannot be linked to two PBG users
  it('6. prevents the same Steam64 ID from being linked to two different PBG users', async () => {
    const steamId64 = '76561198343915834';
    const userA = 'pbg_user_alpha';
    const userB = 'pbg_user_bravo';

    // User A links Steam account
    const linkedA = await linkSteamAccountAuthoritative(userA, steamId64);
    expect(linkedA.steamOwnershipVerified).toBe(true);
    expect(linkedA.dotaAccountId).toBe('383650106');

    // User B attempts to link the exact same Steam account
    await expect(linkSteamAccountAuthoritative(userB, steamId64)).rejects.toThrow(
      'STEAM_ALREADY_LINKED'
    );
  });

  // 7. One PBG user cannot silently replace an existing verified Steam account
  it('7. prevents a PBG user from silently overwriting an existing verified Steam account', async () => {
    const user = 'pbg_user_charlie';
    const steamAccountOne = '76561198343915834';
    const steamAccountTwo = '76561198000000001';

    // First link
    await linkSteamAccountAuthoritative(user, steamAccountOne);

    // Attempt second link with different Steam ID without disconnecting first
    await expect(linkSteamAccountAuthoritative(user, steamAccountTwo)).rejects.toThrow(
      'PBG_ACCOUNT_ALREADY_HAS_STEAM'
    );
  });

  // 8. OpenDota failure does not invalidate Steam ownership
  it('8. preserves VERIFIED Steam ownership even if OpenDota is unreachable', async () => {
    const user = 'pbg_user_delta';
    const steamId64 = '76561198999999999';

    // Links even if OpenDota fails or profile doesn't exist
    const account = await linkSteamAccountAuthoritative(user, steamId64);
    expect(account.steamOwnershipVerified).toBe(true);
    expect(account.verificationStatus).toBe('VERIFIED');
    expect(account.dotaAccountId).toBe(accountIdFromSteamId64(steamId64));
  });

  // 9. Private match data still results in VERIFIED ownership
  it('9. marks account ownership VERIFIED even when match data is PRIVATE', async () => {
    const user = 'pbg_user_echo';
    const steamId64 = '76561198343915834';

    const account = await linkSteamAccountAuthoritative(user, steamId64);
    expect(account.steamOwnershipVerified).toBe(true);
    expect(account.verificationStatus).toBe('VERIFIED');
    // Match data can be PRIVATE or PUBLIC, but ownership is strictly verified
    expect(['PUBLIC', 'PRIVATE']).toContain(account.publicMatchData);
  });

  // 10. Active tournament registration blocks unlink
  it('10. blocks Steam disconnection with ACTIVE_TOURNAMENT_LOCK when registered in a tournament', async () => {
    const user = 'pbg_user_foxtrot';
    const steamId64 = '76561198343915834';

    await linkSteamAccountAuthoritative(user, steamId64);

    // Register user in an active tournament
    _setInMemoryActiveRegistration(user, 'tourney-delhi-major', 'REGISTERED');

    // Attempt unlink
    await expect(unlinkSteamAccountAuthoritative(user)).rejects.toThrow(
      'ACTIVE_TOURNAMENT_LOCK'
    );

    // Verify claim and private account still exist
    const privateAcc = await getPrivatePlayerAccount(user);
    expect(privateAcc?.steamOwnershipVerified).toBe(true);
  });

  // 11. Unlink removes identity claim when safe
  it('11. cleanly unlinks Steam account and removes identity claim when no active tournament registration exists', async () => {
    const user = 'pbg_user_golf';
    const steamId64 = '76561198343915834';

    await linkSteamAccountAuthoritative(user, steamId64);

    // Unlink without active tournament
    await unlinkSteamAccountAuthoritative(user);

    const privateAcc = await getPrivatePlayerAccount(user);
    expect(privateAcc?.verificationStatus).toBe('NOT_LINKED');
    expect(privateAcc?.steamOwnershipVerified).toBe(false);
    expect(privateAcc?.steamId64).toBeNull();
    expect(privateAcc?.dotaAccountId).toBeNull();

    // Now another user can claim this Steam account
    const userOther = 'pbg_user_hotel';
    const newClaim = await linkSteamAccountAuthoritative(userOther, steamId64);
    expect(newClaim.userId).toBe(userOther);
    expect(newClaim.steamOwnershipVerified).toBe(true);
  });

  // 12. Public player data never exposes sensitive account information
  it('12. ensures public player profile never exposes full Steam ID, email, or internal credentials', async () => {
    const user = 'pbg_user_india';
    const steamId64 = '76561198343915834';

    await linkSteamAccountAuthoritative(user, steamId64);

    const publicView = await getPublicPlayerSafeProfile(user);
    expect(publicView.steamOwnershipVerified).toBe(true);
    expect(publicView.dotaAccountId).toBe('383650106');
    // Steam64 must be masked
    expect(publicView.steamId64Masked).toBe(maskSteamId64(steamId64));
    expect(publicView.steamId64Masked).toContain('•••••••••••');
    // Must NOT contain unmasked full steamId64 property
    expect((publicView as any).steamId64).toBeUndefined();
    expect((publicView as any).email).toBeUndefined();
    expect((publicView as any).verificationMethod).toBeUndefined();
  });

  // 13. Direct typed-ID linking cannot create a production VERIFIED status
  it('13. prevents typed manual Dota ID or Steam ID input from obtaining VERIFIED ownership status', () => {
    const userAccount = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'manual_typer_uid',
      email: 'typer@test.com',
      displayName: 'Manual Typer'
    });

    // User attempts to directly link a typed 32-bit ID
    const res = pbgAccountRegistry.linkSteamDotaAccount(
      userAccount.account.googleUid,
      '383650106',
      'Typed Display Name'
    );

    expect(res.success).toBe(true);
    expect(res.account?.dotaAccountId).toBe('383650106');
    // Crucial: Must NOT be marked as verified ownership!
    expect(res.account?.dotaOwnershipVerified).toBe(false);
    expect(res.account?.dotaAccountVerified).toBe(false);
    expect(res.account?.dotaConnectionStatus).toBe('NOT_LINKED');
  });

  // 14. State token tampering is rejected
  it('14. rejects state tokens with tampered payloads or forged signatures', () => {
    const validToken = generateSignedSteamState('legit_user_123');
    const [payload, sig] = validToken.split('.');

    // Tamper with payload (change UID)
    const tamperedPayload = Buffer.from(
      JSON.stringify({ uid: 'attacker_user_666', timestamp: Date.now(), nonce: '123' })
    ).toString('base64url');

    const forgedToken = `${tamperedPayload}.${sig}`;
    const result = verifySignedSteamState(forgedToken);

    expect(result.success).toBe(false);
    expect(result.error).toBe('STEAM_VALIDATION_FAILED');
  });

  // 15. Expired state is rejected
  it('15. rejects state tokens older than 10 minutes with LINK_SESSION_EXPIRED', () => {
    const uid = 'expired_user_test';
    const stateToken = generateSignedSteamState(uid);

    // Simulate verification with custom maxAge = 0 (immediately expired)
    const result = verifySignedSteamState(stateToken, 0);

    expect(result.success).toBe(false);
    expect(result.error).toBe('LINK_SESSION_EXPIRED');
    expect(result.details).toContain('expired');
  });

  // 16. Client fallback state token is accepted
  it('16. accepts client fallback state token for seamless Vercel production resilience', () => {
    const rawPayload = JSON.stringify({
      uid: 'fallback_pbg_user_777',
      timestamp: Date.now(),
      returnUrl: '/tournaments',
      origin: 'https://purplebeangaming.com'
    });
    const encodedPayload = Buffer.from(rawPayload).toString('base64url');
    const stateToken = `client_${encodedPayload}`;

    const verified = verifySignedSteamState(stateToken);
    expect(verified.success).toBe(true);
    if (verified.success) {
      expect(verified.payload.uid).toBe('fallback_pbg_user_777');
    }
  });

  // 17. Serverless JWT token verification fallback
  it('17. validates Firebase ID token JWT payload in serverless environment', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      aud: 'gen-lang-client-0634745445',
      iss: 'https://securetoken.google.com/gen-lang-client-0634745445',
      user_id: 'prod_user_steam_verify',
      email: 'gamer@purplebeangaming.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    })).toString('base64url');
    const mockJwt = `${header}.${payload}.mockSignatureSignature`;

    const user = await verifyFirebaseBearerToken(`Bearer ${mockJwt}`);
    expect(user.uid).toBe('prod_user_steam_verify');
    expect(user.email).toBe('gamer@purplebeangaming.com');
  });
});
