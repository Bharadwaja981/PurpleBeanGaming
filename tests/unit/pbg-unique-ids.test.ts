import { describe, it, expect, beforeEach } from 'vitest';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';
import { tournamentService, PRIMARY_PROJECT_ADMIN_EMAIL } from '../../src/services/firebaseService';

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

describe('PBG Unique & Permanent ID Invariants', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    pbgAccountRegistry.reload();
  });

  it('guarantees strictly unique PBG IDs across all users (no duplicates)', () => {
    const userA = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'uid_test_user_alpha',
      email: 'alpha@test.com',
      displayName: 'Player Alpha'
    });

    const userB = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'uid_test_user_beta',
      email: 'beta@test.com',
      displayName: 'Player Beta'
    });

    const userC = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'uid_test_user_gamma',
      email: 'gamma@test.com',
      displayName: 'Player Gamma'
    });

    expect(userA.account.pbgId).not.toBe(userB.account.pbgId);
    expect(userB.account.pbgId).not.toBe(userC.account.pbgId);
    expect(userA.account.pbgId).not.toBe(userC.account.pbgId);

    // Verify format PBG-XXXXXX
    expect(userA.account.pbgId).toMatch(/^PBG-\d{6}$/);
    expect(userB.account.pbgId).toMatch(/^PBG-\d{6}$/);
    expect(userC.account.pbgId).toMatch(/^PBG-\d{6}$/);
  });

  it('guarantees PBG ID permanence across subsequent logins and sessions', () => {
    const firstLogin = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'permanent_uid_456',
      email: 'permanent@test.com',
      displayName: 'Permanent Gamer'
    });

    const assignedId = firstLogin.account.pbgId;
    expect(assignedId).toBeDefined();

    // Second login with same googleUid
    const secondLogin = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'permanent_uid_456',
      email: 'permanent@test.com',
      displayName: 'Permanent Gamer Updated Name'
    });

    expect(secondLogin.account.pbgId).toBe(assignedId);

    // Third login looked up by email
    const byEmail = pbgAccountRegistry.getAccountByEmail('permanent@test.com');
    expect(byEmail?.pbgId).toBe(assignedId);

    // Looked up by PBG ID
    const byId = pbgAccountRegistry.getAccountByPbgId(assignedId);
    expect(byId?.googleUid).toBe('permanent_uid_456');
  });

  it('preserves PBG ID permanently until user requests account deletion', async () => {
    const user = pbgAccountRegistry.getOrCreatePBGAccount({
      googleUid: 'delete_target_uid_789',
      email: 'to_be_deleted@test.com',
      displayName: 'Temporary Player'
    });

    const pbgId = user.account.pbgId;
    expect(pbgAccountRegistry.getAccountByPbgId(pbgId)).toBeDefined();

    // User explicitly requests deletion
    const delRes = await pbgAccountRegistry.deleteAccount('delete_target_uid_789');
    expect(delRes.success).toBe(true);

    // Now account and ID index are removed
    expect(pbgAccountRegistry.getAccountByPbgId(pbgId)).toBeUndefined();
    expect(pbgAccountRegistry.getAccountByUid('delete_target_uid_789')).toBeUndefined();
  });

  it('resolves real-world test accounts: 11106cm009@gmail.com, neelapuharsha@gmail.com, myana.santhosh@gmail.com without collision', () => {
    const leadAcc = pbgAccountRegistry.getAccountByEmail('11106cm009@gmail.com');
    const friendAcc = pbgAccountRegistry.getAccountByEmail('neelapuharsha@gmail.com');
    const santhoshAcc = pbgAccountRegistry.getAccountByEmail('myana.santhosh@gmail.com');

    expect(leadAcc).toBeDefined();
    expect(friendAcc).toBeDefined();
    expect(santhoshAcc).toBeDefined();

    // All three have strictly distinct, unique PBG IDs
    expect(leadAcc?.pbgId).toBe('PBG-000186');
    expect(friendAcc?.pbgId).toBe('PBG-000187');
    expect(santhoshAcc?.pbgId).toBe('PBG-000188');

    const ids = [leadAcc?.pbgId, friendAcc?.pbgId, santhoshAcc?.pbgId];
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });

  it('shows neelapuharsha@gmail.com in role assignments with permanent PBG ID PBG-000187 and allows role revocation by lead admin', async () => {
    tournamentService.setCurrentUser({
      id: 'wUyRsN0f40bYdyCpLp6UNeIJjpD3',
      email: PRIMARY_PROJECT_ADMIN_EMAIL,
      displayName: 'Bharadwaja Anisetti',
      role: 'organizer',
      isAdmin: true,
      isPrimaryAdmin: true,
      pbgId: 'PBG-000186'
    });

    const roles = tournamentService.getRoleAssignments();
    const harsha = roles.find(r => r.email.toLowerCase() === 'neelapuharsha@gmail.com');

    expect(harsha).toBeDefined();
    expect(harsha?.role).toBe('admin');
    expect(harsha?.pbgId).toBe('PBG-000187');
    expect(harsha?.displayName).toContain('Harsha');

    // Test revocation on a test operator to prevent polluting real admin credentials
    const testOperatorEmail = 'test_operator_revoke@pbg.gg';
    await tournamentService.assignUserRole(testOperatorEmail, 'organizer', {
      displayName: 'Test Operator',
      notes: 'Ephemeral test role'
    });

    const rolesBefore = tournamentService.getRoleAssignments();
    expect(rolesBefore.some(r => r.email.toLowerCase() === testOperatorEmail)).toBe(true);

    const revokeRes = await tournamentService.revokeUserRole(testOperatorEmail, 'Role test revoke');
    expect(revokeRes.success).toBe(true);

    const rolesAfter = tournamentService.getRoleAssignments();
    expect(rolesAfter.find(r => r.email.toLowerCase() === testOperatorEmail)).toBeUndefined();
    // Verify Harsha remains intact
    expect(rolesAfter.find(r => r.email.toLowerCase() === 'neelapuharsha@gmail.com')).toBeDefined();
  });
});
