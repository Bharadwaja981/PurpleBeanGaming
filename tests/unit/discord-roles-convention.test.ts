import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PBG_DISCORD_ROLE_DEFAULTS,
  validateDiscordRoleConfig,
  getDiscordRoleConfigDiagnostics,
  getDesiredTournamentDiscordRoles,
  buildDiscordRoleReconciliationPlan,
  DiscordSyncContext
} from '../../src/domain/discordTournamentRoleEngine';
import { TournamentParticipantRecord, TournamentTeamRecord } from '../../src/domain/tournamentRegistrationEngine';

describe('PurpleBeanGaming Discord Role Convention & Desired-State Engine', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.DISCORD_PBG_MEMBER_ROLE_ID = '1555885374713237524';
    process.env.DISCORD_PBG_PLAYER_ROLE_ID = '1555884061111746651';
    process.env.DISCORD_PBG_CAPTAIN_ROLE_ID = '1556338549807259658';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Canonical Role IDs and Defaults', () => {
    it('defines official PBG Discord role ID defaults matching PurpleBeanGaming convention', () => {
      expect(PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_MEMBER_ROLE_ID).toBe('1555885374713237524');
      expect(PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_PLAYER_ROLE_ID).toBe('1555884061111746651');
      expect(PBG_DISCORD_ROLE_DEFAULTS.DISCORD_PBG_CAPTAIN_ROLE_ID).toBe('1556338549807259658');
    });

    it('reads custom environment variables when set', () => {
      process.env.DISCORD_PBG_PLAYER_ROLE_ID = '1999888777666555444';
      process.env.DISCORD_PBG_CAPTAIN_ROLE_ID = '1888777666555444333';

      const validation = validateDiscordRoleConfig();
      expect(validation.roles.DISCORD_PBG_PLAYER_ROLE_ID).toBe('1999888777666555444');
      expect(validation.roles.DISCORD_PBG_CAPTAIN_ROLE_ID).toBe('1888777666555444333');
    });
  });

  describe('2. Role Config Validation & Diagnostics', () => {
    it('passes validation when all 3 roles are configured with valid snowflakes', () => {
      const result = validateDiscordRoleConfig();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
      expect(result.roles.DISCORD_PBG_MEMBER_ROLE_ID).toBe('1555885374713237524');
      expect(result.roles.DISCORD_PBG_PLAYER_ROLE_ID).toBe('1555884061111746651');
      expect(result.roles.DISCORD_PBG_CAPTAIN_ROLE_ID).toBe('1556338549807259658');
    });

    it('detects role ID collisions between roles', () => {
      process.env.DISCORD_PBG_PLAYER_ROLE_ID = process.env.DISCORD_PBG_MEMBER_ROLE_ID;
      const result = validateDiscordRoleConfig();
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Collision'))).toBe(true);
    });

    it('warns when a role ID is not a valid 17-20 digit snowflake', () => {
      process.env.DISCORD_PBG_PLAYER_ROLE_ID = 'not_a_snowflake';
      const result = validateDiscordRoleConfig();
      expect(result.warnings.some(w => w.includes('not a standard 17-20 digit Discord snowflake'))).toBe(true);
    });

    it('provides clear diagnostics report with status OK, WARNING, or ERROR', () => {
      const diagOk = getDiscordRoleConfigDiagnostics();
      expect(diagOk.status).toBe('OK');
      expect(diagOk.summary).toContain('matches PurpleBeanGaming convention');

      process.env.DISCORD_PBG_CAPTAIN_ROLE_ID = '';
      delete process.env.DISCORD_PBG_CAPTAIN_ROLE_ID;
      // When unset, falls back to default constant so still valid
      const diagFallback = getDiscordRoleConfigDiagnostics();
      expect(diagFallback.validation.roles.DISCORD_PBG_CAPTAIN_ROLE_ID).toBe('1556338549807259658');
    });
  });

  describe('3. Desired-State Role Engine Mapping', () => {
    const dummyParticipant: TournamentParticipantRecord = {
      userId: 'user-001',
      tournamentId: 'tourney-001',
      registrationId: 'reg-001',
      pbgId: 'PBG-001',
      displayName: 'DragonSlayer',
      participantStatus: 'ACTIVE',
      tournamentRole: 'PLAYER',
      auctionStatus: 'AVAILABLE',
      captainSlotId: null,
      teamId: null,
      eliminated: false,
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    it('maps PBG Member -> DISCORD_PBG_MEMBER_ROLE_ID and PBG Player -> DISCORD_PBG_PLAYER_ROLE_ID for normal active player', () => {
      const context: DiscordSyncContext = {
        tournament: { id: 'tourney-001', status: 'LIVE' },
        participant: dummyParticipant,
        team: null,
        discordLink: {
          discordUserId: 'discord-user-111',
          discordLinked: true,
          pbgMemberRoleActive: true
        }
      };

      const result = getDesiredTournamentDiscordRoles(context);
      expect(result.desiredRoleIds).toContain('1555885374713237524'); // DISCORD_PBG_MEMBER_ROLE_ID
      expect(result.desiredRoleIds).toContain('1555884061111746651'); // DISCORD_PBG_PLAYER_ROLE_ID
      expect(result.desiredRoleIds).not.toContain('1556338549807259658'); // DISCORD_PBG_CAPTAIN_ROLE_ID

      const memberItem = result.roleDetails.find(r => r.roleId === '1555885374713237524');
      expect(memberItem?.roleName).toBe('PBG Member');
      expect(memberItem?.category).toBe('PERSISTENT');

      const playerItem = result.roleDetails.find(r => r.roleId === '1555884061111746651');
      expect(playerItem?.roleName).toBe('PBG Player');
      expect(playerItem?.category).toBe('TOURNAMENT');
    });

    it('maps PBG Captain -> DISCORD_PBG_CAPTAIN_ROLE_ID when participant is a captain', () => {
      const captainParticipant: TournamentParticipantRecord = {
        ...dummyParticipant,
        tournamentRole: 'CAPTAIN',
        captainSlotId: 'slot-1'
      };

      const context: DiscordSyncContext = {
        tournament: { id: 'tourney-001', status: 'LIVE' },
        participant: captainParticipant,
        team: null,
        discordLink: {
          discordUserId: 'discord-user-111',
          discordLinked: true,
          pbgMemberRoleActive: true
        }
      };

      const result = getDesiredTournamentDiscordRoles(context);
      expect(result.desiredRoleIds).toContain('1555885374713237524'); // DISCORD_PBG_MEMBER_ROLE_ID
      expect(result.desiredRoleIds).toContain('1555884061111746651'); // DISCORD_PBG_PLAYER_ROLE_ID
      expect(result.desiredRoleIds).toContain('1556338549807259658'); // DISCORD_PBG_CAPTAIN_ROLE_ID

      const captainItem = result.roleDetails.find(r => r.roleId === '1556338549807259658');
      expect(captainItem?.roleName).toBe('PBG Captain');
      expect(captainItem?.category).toBe('TOURNAMENT');
    });

    it('assigns dynamic team role automatically when active team is present', () => {
      const dynamicTeamRoleId = '1666777888999000111';
      const team: TournamentTeamRecord = {
        id: 'team-phoenix',
        tournamentId: 'tourney-001',
        name: 'Phoenix Esports',
        tag: 'PHX',
        captainUserId: 'user-001',
        roster: ['user-001'],
        status: 'ACTIVE',
        discord: {
          roleId: dynamicTeamRoleId,
          roleName: 'Phoenix Esports',
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const context: DiscordSyncContext = {
        tournament: { id: 'tourney-001', status: 'LIVE' },
        participant: { ...dummyParticipant, tournamentRole: 'CAPTAIN', teamId: 'team-phoenix' },
        team,
        discordLink: {
          discordUserId: 'discord-user-111',
          discordLinked: true,
          pbgMemberRoleActive: true
        }
      };

      const result = getDesiredTournamentDiscordRoles(context);
      expect(result.desiredRoleIds).toContain('1555885374713237524'); // DISCORD_PBG_MEMBER_ROLE_ID
      expect(result.desiredRoleIds).toContain('1555884061111746651'); // DISCORD_PBG_PLAYER_ROLE_ID
      expect(result.desiredRoleIds).toContain('1556338549807259658'); // DISCORD_PBG_CAPTAIN_ROLE_ID
      expect(result.desiredRoleIds).toContain(dynamicTeamRoleId);     // Dynamic team role

      const teamItem = result.roleDetails.find(r => r.roleId === dynamicTeamRoleId);
      expect(teamItem?.roleName).toBe('Phoenix Esports');
      expect(teamItem?.category).toBe('TEAM');
    });

    it('revokes PBG Player, PBG Captain, and dynamic team role on elimination while preserving PBG Member', () => {
      const dynamicTeamRoleId = '1666777888999000111';
      const eliminatedTeam: TournamentTeamRecord = {
        id: 'team-phoenix',
        tournamentId: 'tourney-001',
        name: 'Phoenix Esports',
        tag: 'PHX',
        captainUserId: 'user-001',
        roster: ['user-001'],
        status: 'ELIMINATED',
        discord: {
          roleId: dynamicTeamRoleId,
          roleName: 'Phoenix Esports',
          createdAt: new Date().toISOString()
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const context: DiscordSyncContext = {
        tournament: { id: 'tourney-001', status: 'LIVE' },
        participant: { ...dummyParticipant, tournamentRole: 'CAPTAIN', teamId: 'team-phoenix', eliminated: true },
        team: eliminatedTeam,
        discordLink: {
          discordUserId: 'discord-user-111',
          discordLinked: true,
          pbgMemberRoleActive: true
        }
      };

      const result = getDesiredTournamentDiscordRoles(context);
      expect(result.desiredRoleIds).toContain('1555885374713237524'); // PBG Member PRESERVED
      expect(result.desiredRoleIds).not.toContain('1555884061111746651'); // PBG Player NOT desired
      expect(result.desiredRoleIds).not.toContain('1556338549807259658'); // PBG Captain NOT desired
      expect(result.desiredRoleIds).not.toContain(dynamicTeamRoleId); // Team role NOT desired

      expect(result.undesiredRoleIds).toContain('1555884061111746651'); // DISCORD_PBG_PLAYER_ROLE_ID marked for removal
      expect(result.undesiredRoleIds).toContain('1556338549807259658'); // DISCORD_PBG_CAPTAIN_ROLE_ID marked for removal
      expect(result.undesiredRoleIds).toContain(dynamicTeamRoleId);     // Dynamic team role marked for removal

      // Build reconciliation plan
      const plan = buildDiscordRoleReconciliationPlan({
        guildId: '631715510631006219',
        discordUserId: 'discord-user-111',
        actualDiscordRoles: [
          '1555885374713237524', // PBG Member
          '1555884061111746651', // PBG Player
          '1556338549807259658', // PBG Captain
          dynamicTeamRoleId
        ],
        desiredResult: result,
        managedRoleIds: [
          '1555885374713237524',
          '1555884061111746651',
          '1556338549807259658',
          dynamicTeamRoleId
        ]
      });

      expect(plan.rolesToRemove).toContain('1555884061111746651');
      expect(plan.rolesToRemove).toContain('1556338549807259658');
      expect(plan.rolesToRemove).toContain(dynamicTeamRoleId);
      expect(plan.rolesToRemove).not.toContain('1555885374713237524'); // NEVER remove PBG Member
      expect(plan.rolesToAdd).toHaveLength(0);
    });
  });
});
