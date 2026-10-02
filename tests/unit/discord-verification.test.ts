import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateDiscordSnowflake,
  maskDiscordUserId,
  linkDiscordAccountAuthoritative,
  unlinkDiscordAccountAuthoritative,
  getPrivateDiscordAccount,
  _resetDiscordVerificationInMemoryStore,
  _setInMemoryActiveDiscordRegistration
} from '../../src/server/discordVerificationService';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';

describe('Purple Bean Gaming — Discord OAuth & Direct Verification Engine', () => {
  beforeEach(() => {
    _resetDiscordVerificationInMemoryStore();
  });

  it('1. validates 17-20 digit Discord Snowflake IDs accurately', () => {
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

  it('2. masks Discord Snowflake ID safely for public profiles', () => {
    const masked = maskDiscordUserId('782910482910492817');
    expect(masked.endsWith('2817')).toBe(true);
    expect(masked).toContain('••••');
    expect(masked).not.toBe('782910482910492817');
  });

  it('3. successfully links a valid Discord account authoritatively', async () => {
    const res = await linkDiscordAccountAuthoritative({
      userId: 'user_pbg_999',
      discordUserId: '782910482910492817',
      discordUsername: 'mumbai_carry',
      discordDisplayName: 'Mumbai Carry | PBG',
      verificationMethod: 'direct_snowflake'
    });

    expect(res.success).toBe(true);
    expect(res.account.discordLinked).toBe(true);
    expect(res.account.discordVerified).toBe(true);
    expect(res.account.discordUserId).toBe('782910482910492817');
    expect(res.account.discordUsername).toBe('mumbai_carry');

    const fetched = await getPrivateDiscordAccount('user_pbg_999');
    expect(fetched.discordLinked).toBe(true);
    expect(fetched.discordUserId).toBe('782910482910492817');
  });

  it('4. prevents the same Discord Snowflake from being claimed by two different PBG users', async () => {
    await linkDiscordAccountAuthoritative({
      userId: 'user_first',
      discordUserId: '888810482910492817',
      discordUsername: 'first_player'
    });

    await expect(
      linkDiscordAccountAuthoritative({
        userId: 'user_second',
        discordUserId: '888810482910492817',
        discordUsername: 'imposter'
      })
    ).rejects.toThrow('already linked to another PurpleBeanGaming account');
  });

  it('5. blocks Discord disconnection with ACTIVE_TOURNAMENT_LOCK when in active tournament', async () => {
    await linkDiscordAccountAuthoritative({
      userId: 'tourney_player_1',
      discordUserId: '999910482910492817',
      discordUsername: 'pro_player'
    });

    _setInMemoryActiveDiscordRegistration('tourney-cup-1', ['tourney_player_1']);

    await expect(unlinkDiscordAccountAuthoritative('tourney_player_1')).rejects.toThrow(
      'registered in an active tournament'
    );

    // Verify account remains linked
    const status = await getPrivateDiscordAccount('tourney_player_1');
    expect(status.discordLinked).toBe(true);
  });

  it('6. cleanly disconnects Discord account when no active tournament registration exists', async () => {
    await linkDiscordAccountAuthoritative({
      userId: 'free_player_1',
      discordUserId: '777710482910492817',
      discordUsername: 'casual_gamer'
    });

    const res = await unlinkDiscordAccountAuthoritative('free_player_1');
    expect(res.success).toBe(true);

    const status = await getPrivateDiscordAccount('free_player_1');
    expect(status.discordLinked).toBe(false);
    expect(status.discordUserId).toBeNull();

    // Now another user can claim that Discord ID
    const secondLink = await linkDiscordAccountAuthoritative({
      userId: 'other_player',
      discordUserId: '777710482910492817',
      discordUsername: 'new_owner'
    });
    expect(secondLink.success).toBe(true);
  });

  it('7. updates pbgAccountRegistry when linking Discord', () => {
    const reg = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'test_google_uid_discord',
      email: 'discord_tester@gmail.com',
      displayName: 'Discord Tester'
    });
    const res = pbgAccountRegistry.linkDiscordAccount('test_google_uid_discord', {
      discordUserId: '666610482910492817',
      discordUsername: 'discord_master',
      discordDisplayName: 'Discord Master'
    });

    expect(res.success).toBe(true);
    expect(res.account?.discordLinked).toBe(true);
    expect(res.account?.discordUserId).toBe('666610482910492817');

    const found = pbgAccountRegistry.getAccountByDiscordId('666610482910492817');
    expect(found?.googleUid).toBe('test_google_uid_discord');
  });
});
