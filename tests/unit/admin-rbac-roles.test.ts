import { describe, expect, it, beforeEach } from 'vitest';
import { 
  tournamentService, 
  PRIMARY_PROJECT_ADMIN_EMAIL, 
  ROLE_PERMISSIONS,
  UserSession 
} from '../../src/services/firebaseService';

describe('Admin RBAC Role & Access Control Invariants', () => {
  const primaryAdminSession: UserSession = {
    id: 'primary-admin-uid',
    email: PRIMARY_PROJECT_ADMIN_EMAIL,
    displayName: 'Primary Lead Admin',
    role: 'organizer',
    isAdmin: true,
    isPrimaryAdmin: true
  };

  const guestSession: UserSession = {
    id: 'guest-spectator',
    email: '',
    displayName: 'Guest Spectator',
    role: 'spectator',
    isAdmin: false
  };

  beforeEach(() => {
    tournamentService.setCurrentUser(primaryAdminSession);
  });

  it('enforces immutable lead admin root authority', async () => {
    // Attempting to change PRIMARY_PROJECT_ADMIN_EMAIL role away from admin should fail
    const result = await tournamentService.assignUserRole(PRIMARY_PROJECT_ADMIN_EMAIL, 'organizer');
    expect(result.success).toBe(false);
    expect(result.message).toContain('cannot be altered');

    // Attempting to revoke PRIMARY_PROJECT_ADMIN_EMAIL should fail
    const revokeResult = await tournamentService.revokeUserRole(PRIMARY_PROJECT_ADMIN_EMAIL);
    expect(revokeResult.success).toBe(false);
    expect(revokeResult.message).toContain('cannot be removed or demoted');
  });

  it('prevents non-admins from assigning roles (security check)', async () => {
    // Switch to unprivileged user
    tournamentService.setCurrentUser(guestSession);

    const result = await tournamentService.assignUserRole('hacker@evil.com', 'admin');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Unauthorized: Only administrators');

    // Restore admin session
    tournamentService.setCurrentUser(primaryAdminSession);
  });

  it('validates permission matrix for Admin, Organiser, and Moderator roles', () => {
    // Admin has role delegation authority
    expect(ROLE_PERMISSIONS.admin).toContain('MANAGE_ROLES');
    expect(ROLE_PERMISSIONS.admin).toContain('VIEW_AUDIT_LOGS');
    expect(ROLE_PERMISSIONS.admin).toContain('CREATE_TOURNAMENT');
    expect(ROLE_PERMISSIONS.admin).toContain('AUCTION_CONTROL');
    expect(ROLE_PERMISSIONS.admin).toContain('RESOLVE_DISPUTES');

    // Organiser cannot manage roles or system settings, but has full tournament operations
    expect(ROLE_PERMISSIONS.organizer).not.toContain('MANAGE_ROLES');
    expect(ROLE_PERMISSIONS.organizer).not.toContain('SYSTEM_SETTINGS');
    expect(ROLE_PERMISSIONS.organizer).toContain('CREATE_TOURNAMENT');
    expect(ROLE_PERMISSIONS.organizer).toContain('MANAGE_TOURNAMENT');
    expect(ROLE_PERMISSIONS.organizer).toContain('AUCTION_CONTROL');
    expect(ROLE_PERMISSIONS.organizer).toContain('MATCH_OPERATIONS');

    // Moderator only has dispute & referee authority
    expect(ROLE_PERMISSIONS.moderator).not.toContain('MANAGE_ROLES');
    expect(ROLE_PERMISSIONS.moderator).not.toContain('CREATE_TOURNAMENT');
    expect(ROLE_PERMISSIONS.moderator).not.toContain('DELETE_TOURNAMENT');
    expect(ROLE_PERMISSIONS.moderator).not.toContain('AUCTION_CONTROL');
    expect(ROLE_PERMISSIONS.moderator).toContain('RESOLVE_DISPUTES');
    expect(ROLE_PERMISSIONS.moderator).toContain('MODERATE_PLAYERS');
    expect(ROLE_PERMISSIONS.moderator).toContain('VIEW_AUDIT_LOGS');

    // Spectator is read-only
    expect(ROLE_PERMISSIONS.spectator).toEqual(['PUBLIC_VIEW']);
  });

  it('assigns, updates, and revokes roles while maintaining an immutable audit log', async () => {
    const testEmail = 'referee.tournament@purplebeangaming.com';

    // 1. Assign moderator role
    const assignRes = await tournamentService.assignUserRole(testEmail, 'moderator', {
      displayName: 'Senior Match Referee',
      notes: 'Assigned for DPC South Asia Cup',
      pbgId: 'PBG-000999'
    });
    expect(assignRes.success).toBe(true);

    const roles = tournamentService.getRoleAssignments();
    const assigned = roles.find(r => r.email.toLowerCase() === testEmail);
    expect(assigned).toBeDefined();
    expect(assigned?.role).toBe('moderator');
    expect(assigned?.displayName).toBe('Senior Match Referee');

    // 2. Check audit log has recorded the assignment
    const logsAfterAssign = tournamentService.getRoleAuditLogs();
    const assignLog = logsAfterAssign.find(l => l.targetEmail === testEmail && l.action === 'ROLE_ASSIGNED');
    expect(assignLog).toBeDefined();
    expect(assignLog?.targetRole).toBe('moderator');

    // 3. Promote to organizer
    const promoteRes = await tournamentService.assignUserRole(testEmail, 'organizer', {
      displayName: 'Promoted Organiser'
    });
    expect(promoteRes.success).toBe(true);

    const updatedRoles = tournamentService.getRoleAssignments();
    const updated = updatedRoles.find(r => r.email.toLowerCase() === testEmail);
    expect(updated?.role).toBe('organizer');

    // 4. Revoke access
    const revokeRes = await tournamentService.revokeUserRole(testEmail, 'Contract concluded');
    expect(revokeRes.success).toBe(true);

    const rolesAfterRevoke = tournamentService.getRoleAssignments();
    const revoked = rolesAfterRevoke.find(r => r.email.toLowerCase() === testEmail);
    expect(revoked).toBeUndefined();

    // 5. Verify revoke audit log exists
    const logsAfterRevoke = tournamentService.getRoleAuditLogs();
    const revokeLog = logsAfterRevoke.find(l => l.targetEmail === testEmail && l.action === 'ROLE_REVOKED');
    expect(revokeLog).toBeDefined();
    expect(revokeLog?.notes).toContain('Contract concluded');
  });

  it('displays friend neelapuharsha@gmail.com in role assignments and allows revocation', async () => {
    // 1. Verify neelapuharsha@gmail.com is listed in role assignments
    const initialAssignments = tournamentService.getRoleAssignments();
    const friend = initialAssignments.find(r => r.email.toLowerCase() === 'neelapuharsha@gmail.com');
    expect(friend).toBeDefined();
    expect(friend?.email).toBe('neelapuharsha@gmail.com');
    expect(friend?.role).toBe('admin');
    expect(friend?.displayName).toContain('Harsha');

    // 2. Primary admin can revoke this access
    const revokeRes = await tournamentService.revokeUserRole('neelapuharsha@gmail.com', 'Requested role revocation by owner');
    expect(revokeRes.success).toBe(true);

    // 3. Confirm removed from role assignments
    const updatedAssignments = tournamentService.getRoleAssignments();
    const removedFriend = updatedAssignments.find(r => r.email.toLowerCase() === 'neelapuharsha@gmail.com');
    expect(removedFriend).toBeUndefined();

    // 4. Confirm audit log recorded the revocation
    const logs = tournamentService.getRoleAuditLogs();
    const friendRevokeLog = logs.find(l => l.targetEmail === 'neelapuharsha@gmail.com' && l.action === 'ROLE_REVOKED');
    expect(friendRevokeLog).toBeDefined();
    expect(friendRevokeLog?.notes).toContain('Requested role revocation by owner');
  });
});
