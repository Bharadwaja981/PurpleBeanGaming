import { describe, it, expect, beforeEach } from 'vitest';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';

// Mock browser storage for Node test environment
const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    }
  };
})();

(globalThis as any).localStorage = storageMock;
(globalThis as any).sessionStorage = storageMock;
(globalThis as any).window = globalThis;

describe('PBG Account Registry — Onboarding Walkthrough Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('1. does not flag an existing account as first-time on login', () => {
    const acc = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'existing_user_123',
      email: 'existing_user@gmail.com',
      displayName: 'Existing Gamer'
    });

    // Mark onboarding complete
    pbgAccountRegistry.completeOnboarding('existing_user_123');

    // On second login / session check
    const secondLogin = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'existing_user_123',
      email: 'existing_user@gmail.com',
      displayName: 'Existing Gamer'
    });

    expect(secondLogin.isFirstTime).toBe(false);
    expect(pbgAccountRegistry.hasUserCompletedOnboarding('existing_user_123')).toBe(true);
  });

  it('2. recognizes accounts with linked Steam or Discord as already onboarded', () => {
    const userUid = 'gamer_with_credentials_999';
    pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: userUid,
      email: 'credentialed_user@gmail.com',
      displayName: 'Pro Gamer'
    });

    // Link discord
    pbgAccountRegistry.linkDiscordAccount(userUid, {
      discordUserId: '123456789012345678',
      discordUsername: 'pro_gamer'
    });

    expect(pbgAccountRegistry.hasUserCompletedOnboarding(userUid)).toBe(true);
  });

  it('3. permanently stores onboarding completion in localStorage', () => {
    const uid = 'onboard_test_user_456';
    pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: uid,
      email: 'onboard_test@gmail.com',
      displayName: 'Test User'
    });

    pbgAccountRegistry.completeOnboarding(uid);
    expect(localStorage.getItem(`pbg_onboarded_${uid}`)).toBe('true');
    expect(pbgAccountRegistry.hasUserCompletedOnboarding(uid)).toBe(true);
  });
});
