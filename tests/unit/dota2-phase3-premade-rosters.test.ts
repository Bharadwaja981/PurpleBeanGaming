/**
 * Purple Bean Gaming — Dota 2 Phase 3 Unit & Integration Tests
 * Premade Teams + Roster Management + India Dota Open 8 Teams
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaPremadeTeamEngine, 
  DotaPremadeTeamEngine,
  PremadeTeamRegistration 
} from '../../src/domain/dotaPremadeTeamEngine';
import { 
  dotaPlayerRegistry, 
  DotaRolePosition 
} from '../../src/domain/dotaPlayerEngine';
import { 
  trustedTournamentOps, 
  ServerCallerContext 
} from '../../src/server/trustedTournamentOperations';
import { testCupEngine } from '../../src/domain/testCupEngine';

describe('Dota 2 Phase 3 — Premade Teams + Authoritative Roster Management', () => {
  const TOURNAMENT_ID = 'india-dota-open-2026';
  const ORGANISER_ID = 'organiser-staff-1';

  let engine: DotaPremadeTeamEngine;

  const orgCaller: ServerCallerContext = {
    userId: ORGANISER_ID,
    email: 'admin@purplebean.gg',
    role: 'organizer',
    isAdmin: true
  };

  const capCaller = (capId: string, teamId: string): ServerCallerContext => ({
    userId: capId,
    email: `${capId}@team.gg`,
    role: 'captain',
    teamId,
    isAdmin: false
  });

  const playerCaller = (pId: string): ServerCallerContext => ({
    userId: pId,
    email: `${pId}@player.gg`,
    role: 'player',
    isAdmin: false
  });

  beforeEach(() => {
    dotaPlayerRegistry.seedInitialPlayers();
    engine = new DotaPremadeTeamEngine();
    engine.registerTournamentConfig({
      tournamentId: TOURNAMENT_ID,
      tournamentName: 'India Dota Open 2026',
      maxTeams: 8,
      primaryRosterSize: 5,
      standInLimit: 1,
      requirePlayerConsent: true,
      prizePoolINR: 100000
    });
  });

  // Helper to register and verify players for India Dota Open
  function createVerifiedContender(id: string, ign: string, mmr: number, role: DotaRolePosition): string {
    const secRole: DotaRolePosition = role === 'Position 5 — Hard Support' 
      ? 'Position 4 — Soft Support' 
      : 'Position 5 — Hard Support';

    dotaPlayerRegistry.submitTournamentRegistration({
      tournamentId: TOURNAMENT_ID,
      userId: id,
      ign,
      primaryRole: role,
      secondaryRole: secRole,
      declaredMmr: mmr,
      rulesAccepted: true
    });
    dotaPlayerRegistry.verifyRegistration(TOURNAMENT_ID, id, ORGANISER_ID, mmr);
    return id;
  }

  // =========================================================================
  // 1. Premade Team Registration & Validation
  // =========================================================================
  describe('1. Premade Team Registration & Roster Building', () => {
    it('creates team in DRAFT state with verified captain counting as 1/5 primary roster', () => {
      const capId = createVerifiedContender('ido-c1', 'CaptainSky', 7600, 'Position 1 — Carry');

      const res = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Mumbai Mavericks',
        tag: 'MM',
        captainUserId: capId,
        creatorUserId: capId
      });

      expect(res.success).toBe(true);
      expect(res.team).toBeDefined();
      expect(res.team?.status).toBe('DRAFT');
      expect(res.team?.captainId).toBe(capId);
      expect(res.team?.captainIgn).toBe('CaptainSky');
      expect(res.team?.primaryRoster.length).toBe(1);
      expect(res.team?.primaryRoster[0].isCaptain).toBe(true);
      expect(res.team?.primaryRoster[0].consentStatus).toBe('ACCEPTED');
    });

    it('rejects team registration if captain is unverified', () => {
      // Register contender without verifying
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'unverified-cap',
        ign: 'NoobCap',
        primaryRole: 'Position 2 — Mid',
        declaredMmr: 4000,
        rulesAccepted: true
      });

      const res = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Unverified FC',
        tag: 'UFC',
        captainUserId: 'unverified-cap',
        creatorUserId: 'unverified-cap'
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Captain must have a VERIFIED tournament registration/i);
    });
  });

  // =========================================================================
  // 2. Roster Building & Player Consent
  // =========================================================================
  describe('2. Roster Building & Player Consent Flow', () => {
    let team: PremadeTeamRegistration;
    let capId: string;
    let p2: string;
    let p3: string;
    let p4: string;
    let p5: string;
    let s1: string;

    beforeEach(() => {
      capId = createVerifiedContender('ido-cap-1', 'Aether', 7800, 'Position 1 — Carry');
      p2 = createVerifiedContender('ido-p2', 'Nova', 7600, 'Position 2 — Mid');
      p3 = createVerifiedContender('ido-p3', 'Karma', 7400, 'Position 3 — Offlane');
      p4 = createVerifiedContender('ido-p4', 'Chakra', 7200, 'Position 4 — Soft Support');
      p5 = createVerifiedContender('ido-p5', 'Zenith', 7100, 'Position 5 — Hard Support');
      s1 = createVerifiedContender('ido-s1', 'SubZero', 7150, 'Position 4 — Soft Support');

      team = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Bengaluru Blaze',
        tag: 'BB',
        captainUserId: capId,
        creatorUserId: capId
      }).team!;
    });

    it('adds verified players as INVITED and requires consent before submission', () => {
      // Add players
      engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: p2,
        actorUserId: capId
      });
      engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: p3,
        actorUserId: capId
      });
      engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: p4,
        actorUserId: capId
      });
      engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: p5,
        actorUserId: capId
      });

      expect(team.primaryRoster.length).toBe(5);

      // Attempting to submit while consents are pending -> REJECTED
      const subFail = engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
      expect(subFail.success).toBe(false);
      expect(subFail.error).toMatch(/Pending player consents/i);

      // Players accept invitations
      engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: p2, accept: true });
      engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: p3, accept: true });
      engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: p4, accept: true });
      engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: p5, accept: true });

      // Now submission succeeds
      const subSuccess = engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
      expect(subSuccess.success).toBe(true);
      expect(team.status).toBe('SUBMITTED');
    });

    it('handles player declining invitation by releasing slot', () => {
      engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: p2,
        actorUserId: capId
      });
      expect(team.primaryRoster.length).toBe(2);

      // Player declines
      const declineRes = engine.respondToRosterInvitation({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        playerId: p2,
        accept: false
      });
      expect(declineRes.success).toBe(true);
      expect(team.primaryRoster.length).toBe(1); // Reverted to captain only
      expect(engine.getPlayerTeam(TOURNAMENT_ID, p2)).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Organiser Review, Changes Requested & Approval
  // =========================================================================
  describe('3. Organiser Review Lifecycle (APPROVE, REQUEST_CHANGES, REJECT, LOCK)', () => {
    let team: PremadeTeamRegistration;
    let capId: string;

    beforeEach(() => {
      capId = createVerifiedContender('rev-cap', 'ReviewLead', 7700, 'Position 1 — Carry');
      const p2 = createVerifiedContender('rev-p2', 'P2', 7500, 'Position 2 — Mid');
      const p3 = createVerifiedContender('rev-p3', 'P3', 7400, 'Position 3 — Offlane');
      const p4 = createVerifiedContender('rev-p4', 'P4', 7200, 'Position 4 — Soft Support');
      const p5 = createVerifiedContender('rev-p5', 'P5', 7100, 'Position 5 — Hard Support');

      team = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Review Titans',
        tag: 'RT',
        captainUserId: capId,
        creatorUserId: capId
      }).team!;

      // Populate & accept
      [p2, p3, p4, p5].forEach(pid => {
        engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, candidateUserId: pid, actorUserId: capId });
        engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: pid, accept: true });
      });

      engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
    });

    it('enforces mandatory reason for REQUEST_CHANGES and permits captain re-submission', () => {
      // Organiser requests changes without reason -> REJECTED
      const failReq = engine.reviewTeamSubmission({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        action: 'REQUEST_CHANGES',
        reason: '',
        staffActorId: ORGANISER_ID
      });
      expect(failReq.success).toBe(false);
      expect(failReq.error).toMatch(/justification reason is strictly required/i);

      // Organiser requests changes with reason
      const validReq = engine.reviewTeamSubmission({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        action: 'REQUEST_CHANGES',
        reason: 'Please substitute Offlane position due to timezone conflict.',
        staffActorId: ORGANISER_ID
      });
      expect(validReq.success).toBe(true);
      expect(team.status).toBe('CHANGES_REQUESTED');
      expect(team.changesRequestedReason).toMatch(/timezone conflict/i);

      // Captain replaces player and re-submits
      const newOfflane = createVerifiedContender('rev-new-off', 'IronWall', 7450, 'Position 3 — Offlane');
      engine.removePlayerFromRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: 'rev-p3', actorUserId: capId });
      engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, candidateUserId: newOfflane, actorUserId: capId });
      engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: newOfflane, accept: true });

      const resub = engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
      expect(resub.success).toBe(true);
      expect(team.status).toBe('SUBMITTED');
    });

    it('approves team, creates historical snapshot, and locks roster at lock point', () => {
      // Approve
      const appRes = engine.reviewTeamSubmission({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        action: 'APPROVE',
        reason: 'All 5 players validated.',
        staffActorId: ORGANISER_ID
      });
      expect(appRes.success).toBe(true);
      expect(team.status).toBe('APPROVED');

      // Verify immutable historical snapshot created
      const snap = engine.getHistoricalSnapshot(TOURNAMENT_ID, team.teamId);
      expect(snap).toBeDefined();
      expect(snap?.primaryRoster.length).toBe(5);
      expect(snap?.primaryRoster[0].ign).toBe('ReviewLead');
      expect(snap?.version).toBe(1);

      // Lock roster
      const lockRes = engine.lockPremadeRoster(TOURNAMENT_ID, team.teamId, ORGANISER_ID);
      expect(lockRes.success).toBe(true);
      expect(team.status).toBe('LOCKED');
      expect(team.lockedAt).toBeDefined();

      // Later edit attempt by captain is strictly blocked
      const editBlocked = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        candidateUserId: 'any-user',
        actorUserId: capId
      });
      expect(editBlocked.success).toBe(false);
      expect(editBlocked.error).toMatch(/Cannot modify roster while team status is 'LOCKED'/i);
    });
  });

  // =========================================================================
  // 4. Emergency Roster Changes
  // =========================================================================
  describe('4. Emergency Roster Changes & History Preservation', () => {
    it('executes organiser emergency replacement, increments snapshot version, and preserves audit trail', () => {
      const capId = createVerifiedContender('emg-cap', 'Lead', 7800, 'Position 1 — Carry');
      const p2 = createVerifiedContender('emg-p2', 'P2', 7500, 'Position 2 — Mid');
      const p3 = createVerifiedContender('emg-p3', 'P3', 7400, 'Position 3 — Offlane');
      const p4 = createVerifiedContender('emg-p4', 'P4', 7200, 'Position 4 — Soft Support');
      const p5 = createVerifiedContender('emg-p5', 'P5', 7100, 'Position 5 — Hard Support');

      const team = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Emergency FC',
        tag: 'EFC',
        captainUserId: capId,
        creatorUserId: capId
      }).team!;

      [p2, p3, p4, p5].forEach(pid => {
        engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, candidateUserId: pid, actorUserId: capId });
        engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: pid, accept: true });
      });

      engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
      engine.reviewTeamSubmission({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, action: 'APPROVE', staffActorId: ORGANISER_ID });
      engine.lockPremadeRoster(TOURNAMENT_ID, team.teamId, ORGANISER_ID);

      // Contender injured -> Organiser executes emergency replacement
      const incomingId = createVerifiedContender('emg-sub', 'SuperSub', 7300, 'Position 2 — Mid');
      const emgRes = engine.executeEmergencyRosterChange({
        tournamentId: TOURNAMENT_ID,
        teamId: team.teamId,
        outgoingPlayerId: p2,
        incomingPlayerId: incomingId,
        reason: 'Medical emergency confirmed by team manager.',
        staffActorId: ORGANISER_ID
      });

      expect(emgRes.success).toBe(true);
      expect(team.snapshotVersion).toBe(2);

      // Verify incoming player is in primary roster and outgoing is removed
      expect(team.primaryRoster.some(s => s.userId === incomingId)).toBe(true);
      expect(team.primaryRoster.some(s => s.userId === p2)).toBe(false);

      // Verify historical snapshot contains emergency log
      const snapshot = engine.getHistoricalSnapshot(TOURNAMENT_ID, team.teamId);
      expect(snapshot?.version).toBe(2);
      expect(snapshot?.emergencyChanges.length).toBe(1);
      expect(snapshot?.emergencyChanges[0].reason).toMatch(/Medical emergency/i);
    });
  });

  // =========================================================================
  // 5. India Dota Open Test Fixture: 8 Teams Full Lifecycle
  // =========================================================================
  describe('5. India Dota Open Test Fixture (8 Teams)', () => {
    it('registers 8 premade teams, reviews and approves all, and locks all rosters', () => {
      const createdTeams: PremadeTeamRegistration[] = [];

      for (let i = 1; i <= 8; i++) {
        const capId = createVerifiedContender(`ido-cap-${i}`, `Captain_${i}`, 7500 + i * 20, 'Position 1 — Carry');
        const p2 = createVerifiedContender(`ido-t${i}-p2`, `Mid_${i}`, 7400 + i * 15, 'Position 2 — Mid');
        const p3 = createVerifiedContender(`ido-t${i}-p3`, `Off_${i}`, 7300 + i * 10, 'Position 3 — Offlane');
        const p4 = createVerifiedContender(`ido-t${i}-p4`, `Soft_${i}`, 7150 + i * 5, 'Position 4 — Soft Support');
        const p5 = createVerifiedContender(`ido-t${i}-p5`, `Hard_${i}`, 7050 + i * 5, 'Position 5 — Hard Support');
        const s1 = createVerifiedContender(`ido-t${i}-s1`, `Sub_${i}`, 7100, 'Position 4 — Soft Support');

        // 1. Register Team
        const team = engine.registerPremadeTeam({
          tournamentId: TOURNAMENT_ID,
          teamName: `India Team ${i}`,
          tag: `IT${i}`,
          captainUserId: capId,
          creatorUserId: capId
        }).team!;

        // 2. Add remaining 4 primary players + 1 standin
        [p2, p3, p4, p5].forEach(pid => {
          engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, candidateUserId: pid, actorUserId: capId });
          engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: pid, accept: true });
        });
        engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, candidateUserId: s1, isStandIn: true, actorUserId: capId });
        engine.respondToRosterInvitation({ tournamentId: TOURNAMENT_ID, teamId: team.teamId, playerId: s1, accept: true });

        // 3. Submit Roster
        const sub = engine.submitTeamRoster(TOURNAMENT_ID, team.teamId, capId);
        expect(sub.success).toBe(true);

        // 4. Organiser reviews and approves
        const app = engine.reviewTeamSubmission({
          tournamentId: TOURNAMENT_ID,
          teamId: team.teamId,
          action: 'APPROVE',
          reason: `Team ${i} verified.`,
          staffActorId: ORGANISER_ID
        });
        expect(app.success).toBe(true);

        // 5. Lock Roster
        const lock = engine.lockPremadeRoster(TOURNAMENT_ID, team.teamId, ORGANISER_ID);
        expect(lock.success).toBe(true);

        createdTeams.push(team);
      }

      // Verify all 8 teams are created and locked
      expect(createdTeams.length).toBe(8);
      const allLocked = createdTeams.every(t => t.status === 'LOCKED');
      expect(allLocked).toBe(true);

      // Verify 9th team registration is rejected due to maxTeams = 8
      const cap9 = createVerifiedContender('ido-cap-9', 'Captain_9', 7500, 'Position 1 — Carry');
      const extraTeam = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Extra Squad',
        tag: 'XS',
        captainUserId: cap9,
        creatorUserId: cap9
      });
      expect(extraTeam.success).toBe(false);
      expect(extraTeam.error).toMatch(/maximum capacity of 8 teams/i);
    });
  });

  // =========================================================================
  // 6. Comprehensive Negative Tests
  // =========================================================================
  describe('6. Negative Invariant Enforcement', () => {
    let teamA: PremadeTeamRegistration;
    let capA: string;

    beforeEach(() => {
      capA = createVerifiedContender('neg-cap-a', 'AlphaLead', 7800, 'Position 1 — Carry');
      teamA = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Alpha Squad',
        tag: 'AS',
        captainUserId: capA,
        creatorUserId: capA
      }).team!;
    });

    it('rejects adding unverified player to roster', () => {
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: TOURNAMENT_ID,
        userId: 'unverified-p',
        ign: 'Ghost',
        primaryRole: 'Position 2 — Mid',
        declaredMmr: 7000,
        rulesAccepted: true
      });

      const res = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: teamA.teamId,
        candidateUserId: 'unverified-p',
        actorUserId: capA
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Contender must be VERIFIED/i);
    });

    it('rejects duplicate player in same roster', () => {
      const p1 = createVerifiedContender('neg-dup-1', 'DupMan', 7300, 'Position 2 — Mid');
      engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: teamA.teamId, candidateUserId: p1, actorUserId: capA });

      // Add same player again
      const dup = engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: teamA.teamId, candidateUserId: p1, actorUserId: capA });
      expect(dup.success).toBe(false);
      expect(dup.error).toMatch(/already on this team's roster/i);
    });

    it('rejects adding player who is already registered on another team in this tournament', () => {
      const pCommon = createVerifiedContender('neg-common-1', 'TwoTimer', 7400, 'Position 3 — Offlane');
      engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: teamA.teamId, candidateUserId: pCommon, actorUserId: capA });

      // Create Team B
      const capB = createVerifiedContender('neg-cap-b', 'BravoLead', 7600, 'Position 1 — Carry');
      const teamB = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Bravo Squad',
        tag: 'BS',
        captainUserId: capB,
        creatorUserId: capB
      }).team!;

      // Team B attempts to recruit same player
      const recruitConflict = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: teamB.teamId,
        candidateUserId: pCommon,
        actorUserId: capB
      });
      expect(recruitConflict.success).toBe(false);
      expect(recruitConflict.error).toMatch(/already committed to another team/i);
    });

    it('rejects adding 6th primary player', () => {
      for (let i = 1; i <= 4; i++) {
        const p = createVerifiedContender(`neg-fill-${i}`, `Fill_${i}`, 7100, 'Position 2 — Mid');
        engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: teamA.teamId, candidateUserId: p, actorUserId: capA });
      }
      expect(teamA.primaryRoster.length).toBe(5);

      // Attempt 6th primary player
      const p6 = createVerifiedContender('neg-p6', 'ExtraGuy', 7200, 'Position 3 — Offlane');
      const overflow = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: teamA.teamId,
        candidateUserId: p6,
        isStandIn: false,
        actorUserId: capA
      });
      expect(overflow.success).toBe(false);
      expect(overflow.error).toMatch(/Primary roster is already full/i);
    });

    it('rejects second stand-in beyond configured limit (1)', () => {
      const s1 = createVerifiedContender('neg-s1', 'Stand1', 7000, 'Position 4 — Soft Support');
      engine.addPlayerToRoster({ tournamentId: TOURNAMENT_ID, teamId: teamA.teamId, candidateUserId: s1, isStandIn: true, actorUserId: capA });

      const s2 = createVerifiedContender('neg-s2', 'Stand2', 7000, 'Position 5 — Hard Support');
      const overflowStandin = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: teamA.teamId,
        candidateUserId: s2,
        isStandIn: true,
        actorUserId: capA
      });
      expect(overflowStandin.success).toBe(false);
      expect(overflowStandin.error).toMatch(/Maximum stand-in limit reached/i);
    });

    it('rejects captain editing rival team roster', () => {
      const capB = createVerifiedContender('neg-cap-rival', 'RivalCap', 7500, 'Position 1 — Carry');
      const teamB = engine.registerPremadeTeam({
        tournamentId: TOURNAMENT_ID,
        teamName: 'Rival Team',
        tag: 'RT',
        captainUserId: capB,
        creatorUserId: capB
      }).team!;

      const pNew = createVerifiedContender('neg-p-new', 'Fresh', 7200, 'Position 2 — Mid');
      const rivalEdit = engine.addPlayerToRoster({
        tournamentId: TOURNAMENT_ID,
        teamId: teamB.teamId,
        candidateUserId: pNew,
        actorUserId: capA // Captain A attempting to mutate Team B
      });

      expect(rivalEdit.success).toBe(false);
      expect(rivalEdit.error).toMatch(/Permission Denied.*Only team captain/i);
    });

    it('denies client directly setting APPROVED or LOCKED via server authority', () => {
      const normalCaller = playerCaller('unauthorized-user');
      expect(() => {
        trustedTournamentOps.executeReviewPremadeTeam(normalCaller, {
          tournamentId: TOURNAMENT_ID,
          teamId: teamA.teamId,
          action: 'APPROVE'
        });
      }).toThrow(/Unauthorized.*Only.*organizers/i);

      expect(() => {
        trustedTournamentOps.executeLockPremadeRoster(normalCaller, {
          tournamentId: TOURNAMENT_ID,
          teamId: teamA.teamId
        });
      }).toThrow(/Unauthorized.*Only.*organizers/i);
    });
  });

  // =========================================================================
  // 7. Auction Regression Preservation
  // =========================================================================
  describe('7. Auction Tournament Regression Invariant', () => {
    it('ensures Purple Bean Test Cup auction tournament continues to function without interference', () => {
      const capRes = testCupEngine.confirmCaptainsAndTeams();
      expect(capRes.success).toBe(true);
      expect(capRes.teams.length).toBe(3);
      expect(testCupEngine.getStatus()).toBe('Drafting');
    });
  });
});
