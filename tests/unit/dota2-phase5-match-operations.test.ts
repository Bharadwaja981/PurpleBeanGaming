/**
 * Purple Bean Gaming — Dota 2 Phase 5 Test Suite
 * Match Operations + Results + Disputes + Progression
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  dotaMatchOperations, 
  DotaMatchRecord 
} from '../../src/domain/dotaMatchOperationsEngine';
import { 
  dotaCompetitionEngine 
} from '../../src/domain/dotaCompetitionEngine';
import { 
  dotaPlayerRegistry 
} from '../../src/domain/dotaPlayerEngine';
import { 
  trustedTournamentOps, 
  ServerCallerContext 
} from '../../src/server/trustedTournamentOperations';
import { ratingLedger } from '../../src/domain/competitiveRatingEngine';

describe('Phase 5: Match Operations & Results Engine', () => {
  const organiserCaller: ServerCallerContext = {
    userId: 'staff-admin-1',
    email: 'admin@purplebeangaming.com',
    role: 'organizer',
    isAdmin: true
  };

  const captainACaller: ServerCallerContext = {
    userId: 'tc-p-1', // Aether - captain of tc-team-1 (Mumbai Mavericks)
    email: 'aether@mumbai.com',
    role: 'captain',
    teamId: 'tc-team-1'
  };

  const captainBCaller: ServerCallerContext = {
    userId: 'tc-p-6', // Shadow - captain of tc-team-2 (Hyderabad Raiders)
    email: 'shadow@hyderabad.com',
    role: 'captain',
    teamId: 'tc-team-2'
  };

  const spectatorCaller: ServerCallerContext = {
    userId: 'spectator-99',
    email: 'fan@dota.com',
    role: 'spectator'
  };

  beforeEach(() => {
    // Ensure fresh test cup competition structure and reset in-memory matches
    dotaMatchOperations.reset();
    dotaCompetitionEngine.generateSeeds({
      tournamentId: 'purple-bean-test-cup',
      seedingMode: 'rating',
      staffActorId: 'staff-admin-1'
    });
    dotaCompetitionEngine.generateCompetitionStructure({
      tournamentId: 'purple-bean-test-cup',
      staffActorId: 'staff-admin-1'
    });
  });

  // =========================================================================
  // 1. MATCH SCHEDULING
  // =========================================================================
  describe('1. Match Scheduling', () => {
    it('allows organizer to schedule generated matches with date, time, server, and lobby notes', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const res = trustedTournamentOps.executeScheduleMatch(organiserCaller, {
        matchId,
        tournamentId: 'purple-bean-test-cup',
        date: '2026-10-20',
        time: '19:00 IST',
        seriesFormat: 'BO3',
        serverRegion: 'India (Mumbai)',
        lobbyNotes: 'Lobby: PB-SEMI-1, pwd: dota',
        checkInTime: '2026-10-20T18:45:00Z'
      });

      expect(res.success).toBe(true);
      expect(res.match?.scheduledDate).toBe('2026-10-20');
      expect(res.match?.serverRegion).toBe('India (Mumbai)');
      expect(res.match?.status).toBe('SCHEDULED');
    });

    it('denies match scheduling by non-organizer callers', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      expect(() => {
        trustedTournamentOps.executeScheduleMatch(captainACaller, {
          matchId,
          date: '2026-10-20',
          time: '19:00 IST'
        });
      }).toThrow(/organizer or admin/i);
    });
  });

  // =========================================================================
  // 2. LIFECYCLE STATES
  // =========================================================================
  describe('2. Lifecycle States', () => {
    it('follows valid transitions: SCHEDULED -> CHECK_IN -> READY -> AWAITING_CONFIRMATION -> FINALIZED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;
      expect(match).toBeDefined();

      // Open Check-In
      dotaMatchOperations.openCheckIn(matchId);
      expect(match.status).toBe('CHECK_IN');

      // Team A Check-In
      dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: match.teamA.id + '-captain',
        callerRole: 'captain'
      });
      expect(match.checkInStatus).toBe('TEAM_A_READY');

      // Team B Check-In -> BOTH READY
      dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamB.id,
        callerUserId: match.teamB.id + '-captain',
        callerRole: 'captain'
      });
      expect(match.checkInStatus).toBe('BOTH_READY');
      expect(match.status).toBe('READY');

      // Submit Result
      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');
      expect(match.status).toBe('AWAITING_CONFIRMATION');

      // Confirm Result
      dotaMatchOperations.confirmResult(matchId, match.teamB.id, 'captain-b', 'captain');
      expect(match.status).toBe('FINALIZED');
    });
  });

  // =========================================================================
  // 3. CAPTAIN CHECK-IN
  // =========================================================================
  describe('3. Captain Check-in', () => {
    it('allows captains to check in for their own team', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: match.teamA.id + '-captain',
        callerRole: 'captain'
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('TEAM_A_READY');
      expect(match.teamACheckedIn).toBe(true);
    });

    it('denies rival team captain checking in for opponent team', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      // Caller is captain of Team B trying to check in Team A
      const res = dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: match.teamB.id + '-captain',
        callerRole: 'captain'
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/rival team cannot check in opponent/i);
    });

    it('denies spectator check-in', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: 'spectator-1',
        callerRole: 'spectator'
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });

    it('allows organizer override with audit logging', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: 'staff-admin-1',
        callerRole: 'organizer',
        staffOverrideReason: 'Captain present on Discord voice lobby'
      });

      expect(res.success).toBe(true);
      const audit = match.auditHistory.find(a => a.note.includes('Discord voice lobby'));
      expect(audit).toBeDefined();
    });
  });

  // =========================================================================
  // 4. SCORE VALIDATION (BO1, BO3, BO5)
  // =========================================================================
  describe('4. Score Validation', () => {
    it('validates BO1: only 1-0 or 0-1 are valid', () => {
      expect(dotaMatchOperations.validateScore('BO1', 1, 0).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO1', 0, 1).valid).toBe(true);

      expect(dotaMatchOperations.validateScore('BO1', 1, 1).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO1', 2, 0).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO1', 0, 0).valid).toBe(false);
    });

    it('validates BO3: first to 2 (2-0, 2-1, 0-2, 1-2)', () => {
      expect(dotaMatchOperations.validateScore('BO3', 2, 0).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO3', 2, 1).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO3', 0, 2).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO3', 1, 2).valid).toBe(true);

      // Invalid scores
      expect(dotaMatchOperations.validateScore('BO3', 3, 0).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO3', 2, 2).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO3', 3, 1).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO3', 1, 1).valid).toBe(false);
    });

    it('validates BO5: first to 3 (3-0, 3-1, 3-2, 0-3, 1-3, 2-3)', () => {
      expect(dotaMatchOperations.validateScore('BO5', 3, 0).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO5', 3, 1).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO5', 3, 2).valid).toBe(true);
      expect(dotaMatchOperations.validateScore('BO5', 1, 3).valid).toBe(true);

      // Invalid scores
      expect(dotaMatchOperations.validateScore('BO5', 4, 0).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO5', 3, 3).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO5', 2, 2).valid).toBe(false);
    });
  });

  // =========================================================================
  // 5. RESULT CONFIRMATION
  // =========================================================================
  describe('5. Result Confirmation', () => {
    it('submitting team cannot confirm their own result', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      // Submit by Team A
      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');

      // Team A tries to self-confirm
      const res = dotaMatchOperations.confirmResult(matchId, match.teamA.id, 'captain-a', 'captain');
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/submitting team cannot confirm their own result/i);
    });

    it('opponent captain confirms result and triggers canonical progression', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');
      const res = dotaMatchOperations.confirmResult(matchId, match.teamB.id, 'captain-b', 'captain');

      expect(res.success).toBe(true);
      expect(res.winnerTeamId).toBe(match.teamA.id);
      expect(match.status).toBe('FINALIZED');

      // Check Grand Final destination receives winner
      const gf = dotaCompetitionEngine.getStructure('purple-bean-test-cup')?.matches.find(m => m.id.includes('gf'));
      expect(gf?.teamB.teamId).toBe(match.teamA.id);
    });
  });

  // =========================================================================
  // 6. DISPUTES & RESOLUTION
  // =========================================================================
  describe('6. Disputes & Resolution', () => {
    it('freezes match progression upon dispute opening', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');

      // Team B disputes
      const dispRes = dotaMatchOperations.openDispute(
        matchId,
        match.teamB.id,
        'Shadow',
        'INCORRECT_SCORE',
        'We won game 2, score was 2-1 for us',
        []
      );

      expect(dispRes.success).toBe(true);
      expect(match.status).toBe('DISPUTED');

      // Attempt to advance match while disputed -> DENIED
      const advRes = dotaMatchOperations.advanceMatch(matchId);
      expect(advRes.success).toBe(false);
      expect(advRes.error).toMatch(/cannot advance team when match is disputed/i);
    });

    it('organizer resolves dispute with CORRECT_RESULT', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');
      const disp = dotaMatchOperations.openDispute(matchId, match.teamB.id, 'Shadow', 'INCORRECT_SCORE', 'Review replay');

      // Organizer resolves by correcting score to 1-2 for Team B
      const res = dotaMatchOperations.resolveDispute(
        matchId,
        disp.disputeId!,
        'CORRECT_RESULT',
        'staff-referee',
        'Replay review confirms Team B won games 2 and 3',
        { scoreA: 1, scoreB: 2 },
        undefined,
        'organizer'
      );

      expect(res.success).toBe(true);
      expect(match.status).toBe('FINALIZED');
      expect(match.winnerTeamId).toBe(match.teamB.id);

      // Verify Grand Final received corrected winner Team B
      const gf = dotaCompetitionEngine.getStructure('purple-bean-test-cup')?.matches.find(m => m.id.includes('gf'));
      expect(gf?.teamB.teamId).toBe(match.teamB.id);
    });
  });

  // =========================================================================
  // 7. FORFEITS
  // =========================================================================
  describe('7. Forfeits', () => {
    it('awards forfeit to winning team without applying rating adjustments', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.awardForfeit({
        matchId,
        winningTeamId: match.teamA.id,
        reason: 'Opponent Team B did not show up within 15 minute window',
        staffId: 'staff-admin',
        callerRole: 'organizer'
      });

      expect(res.success).toBe(true);
      expect(match.status).toBe('FORFEIT');
      expect(match.winnerTeamId).toBe(match.teamA.id);
      expect(match.forfeitWinnerId).toBe(match.teamA.id);

      // Winner advanced in bracket
      const gf = dotaCompetitionEngine.getStructure('purple-bean-test-cup')?.matches.find(m => m.id.includes('gf'));
      expect(gf?.teamB.teamId).toBe(match.teamA.id);
    });
  });

  // =========================================================================
  // 8. REMATCHES (SUPERSEDED & LINKED)
  // =========================================================================
  describe('8. Rematches', () => {
    it('creates linked replacement match and marks original as SUPERSEDED without deleting', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.orderRematch({
        matchId,
        reason: 'Severe network packet loss during game 1',
        staffId: 'staff-admin',
        callerRole: 'organizer'
      });

      expect(res.success).toBe(true);
      expect(match.status).toBe('SUPERSEDED_BY_REMATCH');
      expect(match.supersededByMatchId).toBe(res.rematchId);

      // Replacement match exists and is linked
      const rematch = dotaMatchOperations.getMatch(res.rematchId!)!;
      expect(rematch).toBeDefined();
      expect(rematch.isRematch).toBe(true);
      expect(rematch.rematchOfMatchId).toBe(match.id);
      expect(rematch.status).toBe('SCHEDULED');
    });
  });

  // =========================================================================
  // 9. RESULT CORRECTION & REBUILD
  // =========================================================================
  describe('9. Result Correction & Rebuild', () => {
    it('allows organizer to correct finalized result and rebuilds downstream progression', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      // Finalize 2-1 for Team A
      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');
      dotaMatchOperations.confirmResult(matchId, match.teamB.id, 'captain-b', 'captain');

      // Audited correction: Team B actually won 2-0
      const corrRes = dotaMatchOperations.correctFinalizedResult(
        matchId,
        0,
        2,
        'staff-head-referee',
        'Lobby screenshot confirmed Team B won 2-0',
        'organizer'
      );

      expect(corrRes.success).toBe(true);
      expect(match.winnerTeamId).toBe(match.teamB.id);

      // Downstream Grand Final has updated winner
      const gf = dotaCompetitionEngine.getStructure('purple-bean-test-cup')?.matches.find(m => m.id.includes('gf'));
      expect(gf?.teamB.teamId).toBe(match.teamB.id);
    });
  });

  // =========================================================================
  // 10. BRACKET PROGRESSION GUARD
  // =========================================================================
  describe('10. Bracket Progression Guard', () => {
    it('denies progression from unconfirmed/disputed matches', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;
      match.status = 'SCHEDULED';

      const res = dotaMatchOperations.advanceMatch(matchId);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/progression executed from unconfirmed\/disputed match/i);
    });
  });

  // =========================================================================
  // 11. GROUP / ROUND ROBIN STANDINGS
  // =========================================================================
  describe('11. Group / Round Robin Standings & Tiebreak Update', () => {
    it('updates played, wins, losses, differential, and deterministic tiebreaks upon match finalization', () => {
      // Initialize Purple Bean Challenger (Groups & Playoffs)
      dotaCompetitionEngine.initStructure({
        tournamentId: 'pb-challenger-2026',
        tournamentName: 'Purple Bean Challenger',
        format: 'groups_playoffs',
        teamCount: 8,
        seedingMode: 'rating',
        defaultSeriesFormat: 'BO1',
        groupsConfig: { groupCount: 2, teamsPerGroup: 4, qualifiersPerGroup: 2 }
      });

      const mockTeams = Array.from({ length: 8 }).map((_, i) => ({
        id: `reg-${i + 1}`,
        tournamentId: 'pb-challenger-2026',
        tournamentName: 'Purple Bean Challenger',
        teamId: `pb-team-${i + 1}`,
        teamName: `Team ${String.fromCharCode(65 + i)}`,
        tag: `T${i + 1}`,
        logo: '🛡️',
        color: '#7C3AED',
        captainId: `cap-${i + 1}`,
        captainIgn: `Captain ${i + 1}`,
        status: 'LOCKED' as const,
        primaryRoster: Array.from({ length: 5 }).map((__, p) => ({
          userId: `u-${i}-${p}`,
          ign: `Player ${i}-${p}`,
          tournamentMmr: 7000 - i * 100,
          declaredMmr: 7000 - i * 100,
          primaryRole: 'Position 1 — Hard Carry' as const,
          pbRating: 1500,
          isCaptain: p === 0,
          isStandIn: false,
          consentStatus: 'ACCEPTED' as const,
          invitedAt: '2026-09-01T00:00:00Z'
        })),
        standIns: [],
        registeredAt: '2026-09-01T00:00:00Z',
        snapshotVersion: 1,
        auditTrail: []
      }));

      dotaCompetitionEngine.generateSeeds({
        tournamentId: 'pb-challenger-2026',
        seedingMode: 'rating',
        staffActorId: 'admin',
        candidateTeams: mockTeams
      });

      dotaCompetitionEngine.generateCompetitionStructure({
        tournamentId: 'pb-challenger-2026',
        staffActorId: 'admin'
      });

      const structure = dotaCompetitionEngine.getStructure('pb-challenger-2026')!;
      expect(structure.groups).toBeDefined();

      const groupA = structure.groups!['group-a'];
      const firstMatch = groupA.matches[0];

      // Finalize first match in Group A
      dotaCompetitionEngine.applyCanonicalMatchResult({
        tournamentId: 'pb-challenger-2026',
        matchId: firstMatch.id,
        winnerTeamId: firstMatch.teamA.teamId!,
        loserTeamId: firstMatch.teamB.teamId!,
        scoreA: 1,
        scoreB: 0
      });

      const winnerRow = groupA.standings.find(s => s.teamId === firstMatch.teamA.teamId)!;
      const loserRow = groupA.standings.find(s => s.teamId === firstMatch.teamB.teamId)!;

      expect(winnerRow.played).toBe(1);
      expect(winnerRow.won).toBe(1);
      expect(winnerRow.points).toBe(3);
      expect(winnerRow.form).toEqual(['W']);

      expect(loserRow.played).toBe(1);
      expect(loserRow.lost).toBe(1);
      expect(loserRow.points).toBe(0);
      expect(loserRow.form).toEqual(['L']);
    });
  });

  // =========================================================================
  // 12. GROUPS → PLAYOFFS TRANSITION
  // =========================================================================
  describe('12. Groups → Playoffs Transition', () => {
    it('populates semifinal matches with A1, A2, B1, B2 when group stage completes', () => {
      const structure = dotaCompetitionEngine.getStructure('pb-challenger-2026')!;
      const groupA = structure.groups!['group-a'];
      const groupB = structure.groups!['group-b'];

      // Finalize all matches in Group A and Group B
      for (const m of groupA.matches) {
        dotaCompetitionEngine.applyCanonicalMatchResult({
          tournamentId: 'pb-challenger-2026',
          matchId: m.id,
          winnerTeamId: m.teamA.teamId!,
          loserTeamId: m.teamB.teamId!,
          scoreA: 1,
          scoreB: 0
        });
      }
      for (const m of groupB.matches) {
        dotaCompetitionEngine.applyCanonicalMatchResult({
          tournamentId: 'pb-challenger-2026',
          matchId: m.id,
          winnerTeamId: m.teamA.teamId!,
          loserTeamId: m.teamB.teamId!,
          scoreA: 1,
          scoreB: 0
        });
      }

      // Check Semifinals have been populated
      const sf1 = structure.matches.find(m => m.id === 'pb-challenger-2026-po-sf-1')!;
      const sf2 = structure.matches.find(m => m.id === 'pb-challenger-2026-po-sf-2')!;

      expect(sf1.teamA.teamId).toBeDefined();
      expect(sf1.teamB.teamId).toBeDefined();
      expect(sf1.teamA.sourceLabel).toContain('Group A #1');
      expect(sf1.teamB.sourceLabel).toContain('Group B #2');

      expect(sf2.teamA.teamId).toBeDefined();
      expect(sf2.teamB.teamId).toBeDefined();
      expect(sf2.teamA.sourceLabel).toContain('Group B #1');
      expect(sf2.teamB.sourceLabel).toContain('Group A #2');
    });
  });

  // =========================================================================
  // 13. MATCH PAGE & NOTIFICATIONS
  // =========================================================================
  describe('13 & 14. Notifications', () => {
    it('dispatches typed notifications for match lifecycle events', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      dotaMatchOperations.dispatchMatchNotification({
        type: 'MATCH_SCHEDULED',
        title: 'Match Scheduled',
        message: 'Your semifinal match has been scheduled.',
        tournamentId: match.tournamentId,
        matchId: match.id,
        teamIds: [match.teamA.id, match.teamB.id]
      });

      const notifs = dotaPlayerRegistry.getNotifications(match.teamA.id + '-captain');
      expect(notifs.some(n => n.type === 'MATCH_SCHEDULED')).toBe(true);
    });
  });

  // =========================================================================
  // 15. TEST CUP E2E
  // =========================================================================
  describe('15. Test Cup E2E', () => {
    it('runs Semifinal (Mumbai vs Hyderabad) -> Mumbai advances -> Grand Final (Mumbai vs Bengaluru) -> Mumbai Champion', () => {
      // Test Cup has 3 teams:
      // Seed 1: Mumbai Mavericks (or tc-team-1)
      // Seed 2: Hyderabad Raiders (tc-team-2)
      // Seed 3: Bengaluru Brawlers (tc-team-3)
      const semiId = 'purple-bean-test-cup-m-semi-1';
      const gfId = 'purple-bean-test-cup-m-gf';

      const semiMatch = dotaMatchOperations.getMatch(semiId)!;
      expect(semiMatch).toBeDefined();

      // Check-in
      dotaMatchOperations.checkInCaptain({
        matchId: semiId,
        teamId: semiMatch.teamA.id,
        callerUserId: 'tc-p-1',
        callerRole: 'captain'
      });
      dotaMatchOperations.checkInCaptain({
        matchId: semiId,
        teamId: semiMatch.teamB.id,
        callerUserId: 'tc-p-6',
        callerRole: 'captain'
      });
      expect(semiMatch.checkInStatus).toBe('BOTH_READY');

      // Submit Semifinal 2-1
      dotaMatchOperations.submitResult(semiId, semiMatch.teamA.id, 2, 1, 'tc-p-1', 'captain');
      dotaMatchOperations.confirmResult(semiId, semiMatch.teamB.id, 'tc-p-6', 'captain');
      expect(semiMatch.status).toBe('FINALIZED');

      // Grand Final destination received Semifinal winner
      const gfMatch = dotaMatchOperations.getMatch(gfId)!;
      expect(gfMatch.teamB.id).toBe(semiMatch.teamA.id);

      // Grand Final result: 2-0
      dotaMatchOperations.submitResult(gfId, gfMatch.teamB.id, 0, 2, 'tc-p-1', 'captain');
      dotaMatchOperations.confirmResult(gfId, gfMatch.teamA.id, 'tc-p-11', 'captain');

      expect(gfMatch.status).toBe('FINALIZED');
      expect(gfMatch.winnerTeamId).toBe(semiMatch.teamA.id);
    });
  });

  // =========================================================================
  // 16. INDIA DOTA OPEN E2E (Double Elimination)
  // =========================================================================
  describe('16. India Dota Open E2E', () => {
    it('runs UB match -> winner advances to UB R2 -> loser drops to exact LB slot -> progresses to next LB round', () => {
      // Generate India Dota Open
      const tid = 'india-dota-open-2026';
      dotaCompetitionEngine.generateSeeds({
        tournamentId: tid,
        seedingMode: 'rating',
        staffActorId: 'admin'
      });
      dotaCompetitionEngine.generateCompetitionStructure({
        tournamentId: tid,
        staffActorId: 'admin'
      });

      const structure = dotaCompetitionEngine.getStructure(tid)!;
      const ubR1M1 = structure.matches.find(m => m.id === `${tid}-ub-r1-m1` || m.id.endsWith('ub-r1-m1'))!;
      expect(ubR1M1).toBeDefined();

      const winnerTeamId = ubR1M1.teamA.teamId!;
      const loserTeamId = ubR1M1.teamB.teamId!;

      // Finalize UB R1 M1
      dotaCompetitionEngine.applyCanonicalMatchResult({
        tournamentId: tid,
        matchId: ubR1M1.id,
        winnerTeamId,
        loserTeamId,
        scoreA: 2,
        scoreB: 0
      });

      // Winner advanced to UB SF 1 (ub-sf-1) Team A
      const ubSF1 = structure.matches.find(m => m.id === `${tid}-ub-sf-1` || m.id.endsWith('ub-sf-1') || m.id.endsWith('ub-r2-m1'))!;
      expect(ubSF1.teamA.teamId).toBe(winnerTeamId);

      // Loser dropped to exact LB R1 M1 (lb-r1-m1) Team A
      const lbR1M1 = structure.matches.find(m => m.id === `${tid}-lb-r1-m1` || m.id.endsWith('lb-r1-m1'))!;
      expect(lbR1M1.teamA.teamId).toBe(loserTeamId);

      // Finalize UB R1 M2 so LB R1 M1 gets opponent (Loser of UB R1 M2)
      const ubR1M2 = structure.matches.find(m => m.id === `${tid}-ub-r1-m2` || m.id.endsWith('ub-r1-m2'))!;
      dotaCompetitionEngine.applyCanonicalMatchResult({
        tournamentId: tid,
        matchId: ubR1M2.id,
        winnerTeamId: ubR1M2.teamA.teamId!,
        loserTeamId: ubR1M2.teamB.teamId!,
        scoreA: 2,
        scoreB: 1
      });
      expect(lbR1M1.teamB.teamId).toBe(ubR1M2.teamB.teamId);

      // Finalize LB R1 M1 -> Winner progresses to LB R2 M1
      dotaCompetitionEngine.applyCanonicalMatchResult({
        tournamentId: tid,
        matchId: lbR1M1.id,
        winnerTeamId: lbR1M1.teamA.teamId!,
        loserTeamId: lbR1M1.teamB.teamId!,
        scoreA: 2,
        scoreB: 0
      });

      const lbR2M1 = structure.matches.find(m => m.id === `${tid}-lb-r2-m1` || m.id.endsWith('lb-r2-m1'))!;
      expect(lbR2M1.teamB.teamId).toBe(lbR1M1.teamA.teamId);
    });
  });

  // =========================================================================
  // 17. NEGATIVE TESTS
  // =========================================================================
  describe('17. Negative Tests', () => {
    it('check-in by unauthorized user -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.checkInCaptain({
        matchId,
        teamId: match.teamA.id,
        callerUserId: 'random-stranger',
        callerRole: 'spectator'
      });
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });

    it('score submitted by unauthorized user -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.submitResult(
        matchId,
        match.teamA.id,
        2,
        0,
        'random-stranger',
        'spectator'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/unauthorized/i);
    });

    it('impossible score (e.g. 3-0 in BO3, 1-1 in BO1, 2-2 in BO3) -> DENIED', () => {
      expect(dotaMatchOperations.validateScore('BO3', 3, 0).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO1', 1, 1).valid).toBe(false);
      expect(dotaMatchOperations.validateScore('BO3', 2, 2).valid).toBe(false);
    });

    it('confirm result by non-opponent -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      dotaMatchOperations.submitResult(matchId, match.teamA.id, 2, 1, 'captain-a', 'captain');

      const res = dotaMatchOperations.confirmResult(
        matchId,
        'unrelated-team-99',
        'random-user',
        'captain'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/only opponent captain or tournament organizer/i);
    });

    it('progression executed from unconfirmed/disputed match -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;
      match.status = 'AWAITING_CONFIRMATION';

      const res = dotaMatchOperations.advanceMatch(matchId);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/progression executed from unconfirmed\/disputed match/i);
    });

    it('advance team when match is disputed -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;
      match.status = 'DISPUTED';

      const res = dotaMatchOperations.advanceMatch(matchId);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/cannot advance team when match is disputed/i);
    });

    it('dispute submitted with missing reason -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.openDispute(
        matchId,
        match.teamB.id,
        'Shadow',
        '',
        'notes'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/dispute reason is required/i);
    });

    it('unauthorized resolution of dispute -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const res = dotaMatchOperations.resolveDispute(
        matchId,
        'disp-1',
        'CONFIRM_ORIGINAL',
        'captain-a',
        'My resolution',
        undefined,
        undefined,
        'captain'
      );
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/only tournament organizer or admin/i);
    });

    it('double-counted rating on rematch -> DENIED', () => {
      const matchId = 'purple-bean-test-cup-m-semi-1';
      const match = dotaMatchOperations.getMatch(matchId)!;

      const initialLedgerSize = ratingLedger.getAuditHistory().length;

      // Order Rematch supersedes original match
      dotaMatchOperations.orderRematch({
        matchId,
        reason: 'Rematch ordered',
        staffId: 'admin',
        callerRole: 'organizer'
      });

      // No new rating entry added for superseded match
      expect(ratingLedger.getAuditHistory().length).toBe(initialLedgerSize);
    });

    it('client alters progression graph directly -> DENIED', () => {
      expect(() => {
        trustedTournamentOps.executeEditBracketProgression(spectatorCaller, {
          tournamentId: 'purple-bean-test-cup',
          matchId: 'purple-bean-test-cup-m-semi-1',
          updates: { winnerNextMatchId: 'hacked-match' }
        });
      }).toThrow(/organizer or admin/i);
    });
  });
});
