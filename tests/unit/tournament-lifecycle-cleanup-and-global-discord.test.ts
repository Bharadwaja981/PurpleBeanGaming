import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyTournamentLifecycle,
  shouldTournamentGrantTemporaryDiscordRoles,
  getUserTournamentRoleEntitlementsFromContexts,
  getDesiredGlobalDiscordRolesForUser,
  TournamentLifecycleContext
} from '../../src/domain/tournamentLifecycleEngine';
import {
  validateTournamentTransition,
  canTransitionTournament
} from '../../src/domain/tournamentStateMachine';
import {
  cleanupTournamentDiscordState,
  softDeleteTournamentAuthoritative
} from '../../src/server/discordTournamentSyncService';
import {
  TournamentParticipantRecord,
  TournamentTeamRecord
} from '../../src/domain/tournamentRegistrationEngine';

describe('PurpleBeanGaming Tournament Lifecycle Cleanup & Global Discord Reconciliation', () => {
  const PBG_MEMBER_ROLE_ID = '1555885374713237524';
  const PBG_PLAYER_ROLE_ID = '1555884061111746651';
  const PBG_CAPTAIN_ROLE_ID = '1556338549807259658';

  // =========================================================================
  // 1. TOURNAMENT LIFECYCLE STATES & CLASSIFICATION
  // =========================================================================
  describe('1. Tournament Lifecycle Classification', () => {
    it('classifies active-like tournaments properly', () => {
      expect(classifyTournamentLifecycle('ACTIVE')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('REGISTRATION')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('REGISTRATION_OPEN')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('AUCTION_READY')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('AUCTION_LIVE')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('COMPETITION')).toBe('ACTIVE_LIKE');
      expect(classifyTournamentLifecycle('LIVE')).toBe('ACTIVE_LIKE');
    });

    it('classifies ON_HOLD tournaments properly', () => {
      expect(classifyTournamentLifecycle('ON_HOLD')).toBe('ON_HOLD');
      expect(classifyTournamentLifecycle('ON HOLD')).toBe('ON_HOLD');
      expect(classifyTournamentLifecycle('PAUSED')).toBe('ON_HOLD');
      expect(classifyTournamentLifecycle('AUCTION_PAUSED')).toBe('ON_HOLD');
    });

    it('classifies terminal tournaments properly', () => {
      expect(classifyTournamentLifecycle('COMPLETED')).toBe('TERMINAL');
      expect(classifyTournamentLifecycle('CANCELLED')).toBe('TERMINAL');
      expect(classifyTournamentLifecycle('CANCELED')).toBe('TERMINAL');
      expect(classifyTournamentLifecycle('ABANDONED')).toBe('TERMINAL');
      expect(classifyTournamentLifecycle('DELETED')).toBe('TERMINAL');
      expect(classifyTournamentLifecycle('SOFT_DELETED')).toBe('TERMINAL');
    });

    it('respects deleted: true on tournament objects', () => {
      expect(classifyTournamentLifecycle({ status: 'ACTIVE', deleted: true })).toBe('TERMINAL');
      expect(classifyTournamentLifecycle({ status: 'REGISTRATION_OPEN', deleted: false })).toBe('ACTIVE_LIKE');
    });
  });

  // =========================================================================
  // 2. DISCORD ROLE LIFECYCLE RULE
  // =========================================================================
  describe('2. Central Rule: shouldTournamentGrantTemporaryDiscordRoles', () => {
    it('returns true for ACTIVE_LIKE tournaments', () => {
      expect(shouldTournamentGrantTemporaryDiscordRoles('ACTIVE')).toBe(true);
      expect(shouldTournamentGrantTemporaryDiscordRoles('registration')).toBe(true);
      expect(shouldTournamentGrantTemporaryDiscordRoles({ status: 'auction_live' })).toBe(true);
    });

    it('returns true for ON_HOLD tournaments (retains temporary roles)', () => {
      expect(shouldTournamentGrantTemporaryDiscordRoles('ON_HOLD')).toBe(true);
      expect(shouldTournamentGrantTemporaryDiscordRoles('PAUSED')).toBe(true);
      expect(shouldTournamentGrantTemporaryDiscordRoles({ status: 'ON_HOLD' })).toBe(true);
    });

    it('returns false for TERMINAL tournaments', () => {
      expect(shouldTournamentGrantTemporaryDiscordRoles('COMPLETED')).toBe(false);
      expect(shouldTournamentGrantTemporaryDiscordRoles('CANCELLED')).toBe(false);
      expect(shouldTournamentGrantTemporaryDiscordRoles('ABANDONED')).toBe(false);
      expect(shouldTournamentGrantTemporaryDiscordRoles('DELETED')).toBe(false);
      expect(shouldTournamentGrantTemporaryDiscordRoles({ status: 'ACTIVE', deleted: true })).toBe(false);
    });
  });

  // =========================================================================
  // 3. GLOBAL ROLE RECONCILIATION ACROSS MULTIPLE TOURNAMENTS
  // =========================================================================
  describe('3. Global Role Reconciliation & Entitlements', () => {
    const userA = 'user-alex';

    it('preserves PBG Player & Captain when user participates in both completed and active tournaments', () => {
      const tourneyCompleted: TournamentLifecycleContext = {
        id: 'tourney-a',
        name: 'Tournament A',
        status: 'COMPLETED',
        participants: [
          {
            userId: userA,
            tournamentId: 'tourney-a',
            registrationId: 'reg-a',
            pbgId: 'PBG-001',
            displayName: 'Alex',
            participantStatus: 'ACTIVE',
            tournamentRole: 'CAPTAIN',
            auctionStatus: 'SOLD',
            captainSlotId: 'slot-1',
            teamId: 'team-a',
            eliminated: false,
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      const tourneyActive: TournamentLifecycleContext = {
        id: 'tourney-b',
        name: 'Tournament B',
        status: 'ACTIVE',
        participants: [
          {
            userId: userA,
            tournamentId: 'tourney-b',
            registrationId: 'reg-b',
            pbgId: 'PBG-001',
            displayName: 'Alex',
            participantStatus: 'ACTIVE',
            tournamentRole: 'CAPTAIN',
            auctionStatus: 'SOLD',
            captainSlotId: 'slot-2',
            teamId: 'team-b',
            eliminated: false,
            joinedAt: '2026-01-02',
            updatedAt: '2026-01-02'
          }
        ]
      };

      const entitlements = getUserTournamentRoleEntitlementsFromContexts(userA, [tourneyCompleted, tourneyActive]);

      expect(entitlements.shouldHavePbgPlayer).toBe(true);
      expect(entitlements.shouldHavePbgCaptain).toBe(true);
      expect(entitlements.activeParticipantTournamentIds).toEqual(['tourney-b']);
      expect(entitlements.activeCaptainTournamentIds).toEqual(['tourney-b']);

      const desired = getDesiredGlobalDiscordRolesForUser({
        userId: userA,
        discordLink: {
          discordUserId: 'discord-snowflake-alex',
          discordLinked: true,
          pbgMemberRoleActive: true
        },
        tournaments: [tourneyCompleted, tourneyActive],
        pbgMemberRoleId: PBG_MEMBER_ROLE_ID,
        pbgPlayerRoleId: PBG_PLAYER_ROLE_ID,
        pbgCaptainRoleId: PBG_CAPTAIN_ROLE_ID
      });

      // User keeps PBG Member, PBG Player, PBG Captain!
      expect(desired.desiredRoleIds).toContain(PBG_MEMBER_ROLE_ID);
      expect(desired.desiredRoleIds).toContain(PBG_PLAYER_ROLE_ID);
      expect(desired.desiredRoleIds).toContain(PBG_CAPTAIN_ROLE_ID);
      expect(desired.undesiredRoleIds).not.toContain(PBG_PLAYER_ROLE_ID);
      expect(desired.undesiredRoleIds).not.toContain(PBG_CAPTAIN_ROLE_ID);
    });

    it('only removes PBG Player and PBG Captain when user has ZERO qualifying active tournaments', () => {
      const tourneyCompleted: TournamentLifecycleContext = {
        id: 'tourney-a',
        name: 'Tournament A',
        status: 'COMPLETED',
        participants: [
          {
            userId: userA,
            tournamentId: 'tourney-a',
            registrationId: 'reg-a',
            pbgId: 'PBG-001',
            displayName: 'Alex',
            participantStatus: 'ACTIVE',
            tournamentRole: 'CAPTAIN',
            auctionStatus: 'SOLD',
            captainSlotId: 'slot-1',
            teamId: 'team-a',
            eliminated: false,
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      const entitlements = getUserTournamentRoleEntitlementsFromContexts(userA, [tourneyCompleted]);
      expect(entitlements.shouldHavePbgPlayer).toBe(false);
      expect(entitlements.shouldHavePbgCaptain).toBe(false);

      const desired = getDesiredGlobalDiscordRolesForUser({
        userId: userA,
        discordLink: {
          discordUserId: 'discord-snowflake-alex',
          discordLinked: true,
          pbgMemberRoleActive: true
        },
        tournaments: [tourneyCompleted],
        pbgMemberRoleId: PBG_MEMBER_ROLE_ID,
        pbgPlayerRoleId: PBG_PLAYER_ROLE_ID,
        pbgCaptainRoleId: PBG_CAPTAIN_ROLE_ID
      });

      // PBG Member is strictly preserved!
      expect(desired.desiredRoleIds).toContain(PBG_MEMBER_ROLE_ID);
      expect(desired.undesiredRoleIds).toContain(PBG_PLAYER_ROLE_ID);
      expect(desired.undesiredRoleIds).toContain(PBG_CAPTAIN_ROLE_ID);
    });

    it('treats ON_HOLD as active for Discord role entitlements', () => {
      const tourneyOnHold: TournamentLifecycleContext = {
        id: 'tourney-hold',
        name: 'Paused Tournament',
        status: 'ON_HOLD',
        participants: [
          {
            userId: userA,
            tournamentId: 'tourney-hold',
            registrationId: 'reg-hold',
            pbgId: 'PBG-001',
            displayName: 'Alex',
            participantStatus: 'ACTIVE',
            tournamentRole: 'PLAYER',
            auctionStatus: 'SOLD',
            captainSlotId: null,
            teamId: 'team-hold',
            eliminated: false,
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      const entitlements = getUserTournamentRoleEntitlementsFromContexts(userA, [tourneyOnHold]);
      expect(entitlements.shouldHavePbgPlayer).toBe(true);
      expect(entitlements.shouldHavePbgCaptain).toBe(false);
    });

    it('excludes disqualified, withdrawn, and eliminated participants from entitlements', () => {
      const tourney: TournamentLifecycleContext = {
        id: 'tourney-active',
        name: 'Active Tournament',
        status: 'ACTIVE',
        participants: [
          {
            userId: 'user-disqualified',
            tournamentId: 'tourney-active',
            registrationId: 'reg-dq',
            pbgId: 'PBG-002',
            displayName: 'Bob',
            participantStatus: 'INACTIVE',
            tournamentRole: 'PLAYER',
            auctionStatus: 'AVAILABLE',
            captainSlotId: null,
            teamId: null,
            eliminated: false,
            status: 'DISQUALIFIED',
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          } as any,
          {
            userId: 'user-eliminated',
            tournamentId: 'tourney-active',
            registrationId: 'reg-elim',
            pbgId: 'PBG-003',
            displayName: 'Charlie',
            participantStatus: 'ACTIVE',
            tournamentRole: 'PLAYER',
            auctionStatus: 'SOLD',
            captainSlotId: null,
            teamId: 'team-elim',
            eliminated: true,
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      const dqEnt = getUserTournamentRoleEntitlementsFromContexts('user-disqualified', [tourney]);
      expect(dqEnt.shouldHavePbgPlayer).toBe(false);

      const elimEnt = getUserTournamentRoleEntitlementsFromContexts('user-eliminated', [tourney]);
      expect(elimEnt.shouldHavePbgPlayer).toBe(false);
    });
  });

  // =========================================================================
  // 4. TEAM ROLES LIFECYCLE (ELIMINATION VS RESTORATION VS TERMINATION)
  // =========================================================================
  describe('4. Team Roles: Elimination vs Termination', () => {
    it('removes team role for eliminated team members but does not delete dynamic role', () => {
      const user = 'user-team-member';
      const teamId = 'team-warriors';
      const teamRoleId = '155999999999999999';

      const tourney: TournamentLifecycleContext = {
        id: 'tourney-match',
        status: 'ACTIVE',
        teams: [
          {
            id: teamId,
            tournamentId: 'tourney-match',
            name: 'Warriors',
            tag: 'WAR',
            captainUserId: user,
            roster: [user],
            status: 'ELIMINATED',
            discord: {
              roleId: teamRoleId,
              roleName: 'Warriors',
              createdAt: '2026-01-01'
            },
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ],
        participants: [
          {
            userId: user,
            tournamentId: 'tourney-match',
            registrationId: 'reg-w',
            pbgId: 'PBG-004',
            displayName: 'Warrior',
            participantStatus: 'ACTIVE',
            tournamentRole: 'CAPTAIN',
            auctionStatus: 'SOLD',
            captainSlotId: 'slot-w',
            teamId: teamId,
            eliminated: true,
            joinedAt: '2026-01-01',
            updatedAt: '2026-01-01'
          }
        ]
      };

      const desired = getDesiredGlobalDiscordRolesForUser({
        userId: user,
        discordLink: {
          discordUserId: 'discord-snowflake-warrior',
          discordLinked: true,
          pbgMemberRoleActive: true
        },
        tournaments: [tourney],
        pbgMemberRoleId: PBG_MEMBER_ROLE_ID,
        pbgPlayerRoleId: PBG_PLAYER_ROLE_ID,
        pbgCaptainRoleId: PBG_CAPTAIN_ROLE_ID
      });

      // Team role is in undesiredRoleIds because team is eliminated
      expect(desired.undesiredRoleIds).toContain(teamRoleId);
      expect(desired.desiredRoleIds).not.toContain(teamRoleId);
    });
  });

  // =========================================================================
  // 5. CENTRAL CLEANUP ENGINE
  // =========================================================================
  describe('5. Central Cleanup Engine: cleanupTournamentDiscordState', () => {
    it('executes authoritative terminal cleanup and returns structured report', async () => {
      const tourneyId = 'tourney-terminal-test';
      const teamRoleId = 'role-team-omega-123';

      const team: TournamentTeamRecord = {
        id: 'team-omega',
        tournamentId: tourneyId,
        name: 'Omega',
        tag: 'OMG',
        captainUserId: 'user-omega-cap',
        roster: ['user-omega-cap'],
        status: 'ACTIVE',
        discord: {
          roleId: teamRoleId,
          roleName: 'Omega',
          createdAt: '2026-01-01'
        },
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01'
      };

      const participant: TournamentParticipantRecord = {
        userId: 'user-omega-cap',
        tournamentId: tourneyId,
        registrationId: 'reg-omega',
        pbgId: 'PBG-005',
        displayName: 'Omega Captain',
        participantStatus: 'ACTIVE',
        tournamentRole: 'CAPTAIN',
        auctionStatus: 'SOLD',
        captainSlotId: 'slot-omega',
        teamId: 'team-omega',
        eliminated: false,
        joinedAt: '2026-01-01',
        updatedAt: '2026-01-01'
      };

      const deletedRoles: string[] = [];
      const removedUserRoles: Array<{ userId: string; roleId: string }> = [];

      const mockFetch = (async (url: string, init?: any) => {
        const method = init?.method || 'GET';
        if (method === 'DELETE') {
          deletedRoles.push(url);
          return { ok: true, status: 204, json: async () => ({}) };
        }
        if (method === 'GET' && url.includes('/members/')) {
          // Member has PBG Member, PBG Player, PBG Captain, and Omega Team role
          return {
            ok: true,
            status: 200,
            json: async () => ({
              roles: [PBG_MEMBER_ROLE_ID, PBG_PLAYER_ROLE_ID, PBG_CAPTAIN_ROLE_ID, teamRoleId]
            })
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      }) as any;

      const report = await cleanupTournamentDiscordState({
        tournamentId: tourneyId,
        teams: [team],
        participants: [participant],
        fetchFn: mockFetch
      });

      // Verify structured report schema
      expect(report.tournamentId).toBe(tourneyId);
      expect(report.participantsProcessed).toBe(1);
      expect(report.teamRolesDeleted).toBe(1);
      expect(report.failures).toEqual([]);

      // Team role object cleared on team
      expect(team.discord).toBeUndefined();

      // Idempotency: Running cleanup a 2nd time causes 0 team roles deleted
      const report2 = await cleanupTournamentDiscordState({
        tournamentId: tourneyId,
        teams: [team],
        participants: [participant],
        fetchFn: mockFetch
      });

      expect(report2.teamRolesDeleted).toBe(0);
      expect(report2.failures).toEqual([]);
    }, 15000);
  });

  // =========================================================================
  // 6. SOFT DELETION
  // =========================================================================
  describe('6. Soft Deletion Flow', () => {
    it('executes cleanup before soft-deleting tournament', async () => {
      const tourneyId = 'tourney-soft-del-test';
      const mockFetch = (async () => ({ ok: true, status: 204, json: async () => ({}) })) as any;

      const res = await softDeleteTournamentAuthoritative({
        tournamentId: tourneyId,
        deletedBy: 'admin-organizer-uid',
        deleteReason: 'Tournament cancelled and archived by organizer',
        fetchFn: mockFetch
      });

      expect(res.success).toBe(true);
      expect(res.tournamentId).toBe(tourneyId);
      expect(res.cleanupReport).toBeDefined();
    }, 15000);
  });

  // =========================================================================
  // 7. TOURNAMENT STATE MACHINE TRANSITIONS
  // =========================================================================
  describe('7. Canonical State Machine Transitions', () => {
    it('allows valid transitions to on_hold, completed, cancelled, abandoned, and deleted', () => {
      expect(canTransitionTournament('registration', 'auction_ready')).toBe(true);
      expect(canTransitionTournament('auction_live', 'on_hold')).toBe(true);
      expect(canTransitionTournament('on_hold', 'active')).toBe(true);
      expect(canTransitionTournament('competition', 'completed')).toBe(true);
      expect(canTransitionTournament('active', 'cancelled')).toBe(true);
      expect(canTransitionTournament('active', 'abandoned')).toBe(true);
      expect(canTransitionTournament('completed', 'deleted')).toBe(true);
      expect(canTransitionTournament('cancelled', 'deleted')).toBe(true);
    });

    it('rejects illegal transitions', () => {
      const check = validateTournamentTransition('completed', 'registration');
      expect(check.valid).toBe(false);
      expect(check.reason).toContain('Illegal tournament state transition');
    });
  });
});
