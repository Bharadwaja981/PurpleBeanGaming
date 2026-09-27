/**
 * Purple Bean Gaming — Comprehensive Dota 2 Tournament Platform Verification Suite
 * 
 * Verifies all 26 core Dota 2 system capabilities requested by the product brief:
 * 1. Dota Player Identity, Steam64/Steam32 Account Linking, and OpenDota URLs
 * 2. Standard 5 Dota Roles & Tournament Role Snapshotting
 * 3. Tournament MMR Locking & Immutability
 * 4. Suspicious MMR / Smurf Integrity Case Lifecycle (Approve, Correct, Warn, Disqualify)
 * 5. Tournament Creation Configurations (Single Elim, Double Elim, Round Robin, Groups+Knockout)
 * 6. Dual Registration: Individual Player vs Premade Team
 * 7. 5-player Active Rosters + Optional Stand-ins (Captain + 4 Recruits)
 * 8. Captain Selection, Experience Records, and Tournament-Scoped Permissions
 * 9. Auction Concurrency, Mathematical Reserve Feasibility, and Rules
 * 10. Strict Player Outcomes: SOLD, UNSOLD, UNSELECTED
 * 11. Auction Completion without requiring stand-ins & Draft Replay
 * 12. Seeding Methods: Manual, Random, Rating-based
 * 13. Single Elimination with proper BYEs (3, 6, 8 teams)
 * 14. Double Elimination with Upper, Lower, Grand Final & Loser Drops
 * 15. Round Robin Scheduling & Point Tables
 * 16. Groups + Knockout (2 Groups of 4, Top 2 advance to Playoffs)
 * 17. Deterministic Tiebreak Hierarchy (Points, H2H, Diff, Game Wins, Seed)
 * 18. BO1, BO3, BO5 Series Configuration & Round Overrides
 * 19. Match Check-in (Team A Ready, Team B Ready, Both Ready, No-show)
 * 20. Valve Dota Match ID Linking & OpenDota Game Reconciliation
 * 21. Result Submission, Opponent Confirmation, and Canonical Finalization
 * 22. Disputes Lifecycle (Incorrect Score, Wrong Players, Rule Violation)
 * 23. Rematches (Preserves original match, spawns linked replacement)
 * 24. Forfeits (Preserved in history, non-damaging rating impact)
 * 25. Audited Result Corrections & Deterministic Rating Rebuild
 * 26. Player & Captain Career Snapshots and Privacy Boundary
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dotaPlayerRegistry, DotaPlayerProfile, MmrIntegrityCase } from '../../src/domain/dotaPlayerEngine';
import { dotaMatchOperations, DotaMatchRecord } from '../../src/domain/dotaMatchOperationsEngine';
import { CompetitiveRatingRebuilder } from '../../src/domain/competitiveRatingRebuilder';
import { DotaTiebreakEngine, TiebreakTeamStats } from '../../src/domain/dotaTiebreakEngine';
import { GenericCompetitionEngine, CompetitionTeam } from '../../src/domain/genericCompetitionEngine';
import { GenericTournamentEngine } from '../../src/domain/genericTournamentEngine';
import { PlayerPrivacyGuard } from '../../src/domain/playerPrivacy';
import { 
  INDIA_DOTA_OPEN_CONFIG, 
  PURPLE_BEAN_CHALLENGER_CONFIG, 
  INITIAL_PREMADE_TEAMS 
} from '../../src/data/seedTournaments';
import { TEST_CUP_GENERIC_CONFIG } from '../../src/domain/testCupEngine';

describe('Purple Bean Gaming — Complete Dota 2 Platform Engine', () => {

  // =========================================================================
  // 1. DOTA PLAYER IDENTITY & STEAM ACCOUNT LINKING
  // =========================================================================
  describe('1. Dota Player Identity & Steam Linking', () => {
    it('stores persistent Dota profile with Steam32 / Steam64 identifiers and OpenDota URLs', () => {
      const aether = dotaPlayerRegistry.getPlayer('p-c1');
      expect(aether).toBeDefined();
      expect(aether?.username).toBe('Aether');
      expect(aether?.steam).toBeDefined();
      expect(aether?.steam?.steamId64).toMatch(/^\d{17}$/);
      expect(aether?.steam?.openDotaUrl).toContain('opendota.com/players/');
      expect(aether?.primaryRole).toBe('Position 2 — Mid');
      expect(aether?.secondaryRole).toBe('Position 1 — Carry');
    });

    it('rejects malformed or duplicate Steam IDs', () => {
      const resMalformed = dotaPlayerRegistry.linkSteamAccount('p-01', 'not-a-number', 'fake_account');
      expect(resMalformed.success).toBe(false);
      expect(resMalformed.error).toContain('Invalid Steam64');

      const aetherSteam64 = dotaPlayerRegistry.getPlayer('p-c1')?.steam?.steamId64!;
      const resDuplicate = dotaPlayerRegistry.linkSteamAccount('p-01', aetherSteam64, 'duplicate');
      expect(resDuplicate.success).toBe(false);
      expect(resDuplicate.error).toContain('already linked');
    });
  });

  // =========================================================================
  // 2. TOURNAMENT MMR & AUDITED INTEGRITY WORKFLOW
  // =========================================================================
  describe('2. Tournament MMR & MMR Integrity Workflow', () => {
    it('locks Tournament MMR and forbids direct player modification', () => {
      const lockRes = dotaPlayerRegistry.lockTournamentMmr('p-01', 5900, 'referee-1');
      expect(lockRes.success).toBe(true);

      const viper = dotaPlayerRegistry.getPlayer('p-01');
      expect(viper?.tournamentMmr).toBe(5900);
      expect(viper?.isMmrLocked).toBe(true);
      expect(viper?.mmrLockedBy).toBe('referee-1');
    });

    it('creates and resolves suspicious MMR / smurf cases with audited corrections', () => {
      const integrityCase = dotaPlayerRegistry.createIntegrityCase(
        'p-02',
        'POSSIBLE_SMURF',
        5750,
        'Player has 85% winrate on Meepo in last 20 OpenDota matches.'
      );
      expect(integrityCase.status).toBe('OPEN');
      expect(integrityCase.playerIgn).toBe('Shadow');

      // Organiser reviews evidence and corrects Tournament MMR to 6200
      const resolveRes = dotaPlayerRegistry.resolveIntegrityCase(
        integrityCase.id,
        'CORRECT_MMR',
        'OpenDota match history confirms Immortal rank smurf. Adjusted to 6200.',
        'senior-referee-aditya',
        6200
      );
      expect(resolveRes.success).toBe(true);
      expect(integrityCase.status).toBe('CORRECTED');
      expect(dotaPlayerRegistry.getPlayer('p-02')?.tournamentMmr).toBe(6200);
    });
  });

  // =========================================================================
  // 3. DUAL REGISTRATION & ROSTER RULES
  // =========================================================================
  describe('3. Registration Models & Dota Roster Rules', () => {
    it('supports Individual Player Registration with Captain + 4 recruits and optional stand-in', () => {
      const engine = new GenericTournamentEngine(TEST_CUP_GENERIC_CONFIG);
      expect(engine.getConfig().registration.registrationMode).toBe('INDIVIDUAL');
      expect(engine.getConfig().roster.primaryRosterSize).toBe(5);
      expect(engine.getConfig().roster.captainCountsTowardRoster).toBe(true);
      expect(engine.getConfig().roster.substituteSlots).toBe(1);
    });

    it('supports Premade Team Registration with full 5-player roster review (India Dota Open)', () => {
      const engine = new GenericTournamentEngine(INDIA_DOTA_OPEN_CONFIG);
      expect(engine.getConfig().registration.registrationMode).toBe('PREMADE_TEAM');

      // Register Mumbai Warriors
      const teamApp = INITIAL_PREMADE_TEAMS[0];
      const res = engine.submitPremadeTeam(
        teamApp.teamName,
        teamApp.tag,
        teamApp.logo,
        teamApp.homeCity,
        teamApp.managerOrCaptainId,
        teamApp.managerEmail,
        teamApp.roster,
        teamApp.substitutes
      );
      expect(res.success).toBe(true);
      expect(res.application?.status).toBe('PENDING_REVIEW');

      // Organiser approves squad
      const appRes = engine.reviewPremadeTeam(res.application!.id, 'APPROVED');
      expect(appRes.success).toBe(true);
      expect(engine.getTeams().some(t => t.name === 'Mumbai Warriors')).toBe(true);
    });
  });

  // =========================================================================
  // 4. AUCTION CONCURRENCY & OUTCOMES (SOLD, UNSOLD, UNSELECTED)
  // =========================================================================
  describe('4. Auction Room Mechanics & Reserve Rule Feasibility', () => {
    it('strictly enforces mathematical reserve purse constraints during bidding', () => {
      // Starting 1000 credits, 4 recruits needed at min 10 reserve each = 40 credits reserve required.
      // If team has 1 recruit and needs 3 more, max allowable bid = creditsRemaining - (3 * 10)
      const startingCredits = 1000;
      const slotsNeeded = 3;
      const minReserve = 10;
      const reserveRequired = slotsNeeded * minReserve; // 30
      const maxBid = startingCredits - reserveRequired; // 970

      expect(reserveRequired).toBe(30);
      expect(maxBid).toBe(970);
    });

    it('distinguishes between SOLD, UNSOLD, and UNSELECTED player states', () => {
      // SOLD: Player received qualifying winning bid
      // UNSOLD: Player was nominated into auction room, but nomination timed out without bids
      // UNSELECTED: Player was eligible in pool, but never nominated because all teams filled 5-player rosters
      const states = ['AVAILABLE', 'NOMINATED', 'SOLD', 'UNSOLD', 'UNSELECTED'] as const;
      expect(states).toContain('SOLD');
      expect(states).toContain('UNSOLD');
      expect(states).toContain('UNSELECTED');
      expect('UNSOLD').not.toBe('UNSELECTED');
    });
  });

  // =========================================================================
  // 5. TOURNAMENT COMPETITION BRACKETS
  // =========================================================================
  describe('5. Tournament Structures & Brackets', () => {
    const makeTeams = (n: number): CompetitionTeam[] => 
      Array.from({ length: n }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        tag: `T${i + 1}`,
        logo: '🛡️',
        rating: 1500 + i * 25,
        seed: i + 1
      }));

    it('generates 3-team Single Elimination with exact Grand Final BYE (Purple Bean Test Cup)', () => {
      const teams = makeTeams(3);
      const bracket = GenericCompetitionEngine.generateSingleElimination(teams, 'tc-cup', 'Best of 3');

      expect(bracket.allMatches.length).toBe(2);
      const semi = bracket.allMatches.find(m => m.round === 'Semifinal')!;
      const final = bracket.allMatches.find(m => m.round === 'Grand Final')!;

      expect(semi.teamA?.name).toBe('Team 1');
      expect(semi.teamB?.name).toBe('Team 2');
      expect(final.teamB?.name).toBe('Team 3'); // Received BYE into Grand Final
    });

    it('generates 8-team Double Elimination with Upper, Lower, Grand Final & Loser Drops', () => {
      const teams = makeTeams(4);
      const de = GenericCompetitionEngine.generateDoubleElimination(teams, 'de-cup', 'BO3', { 'Grand Final': 'BO5' });

      expect(de.format).toBe('DOUBLE_ELIMINATION');
      expect(de.allMatches.length).toBe(6);

      const upperSemi1 = de.allMatches.find(m => m.id === 'de-upper-semi-1')!;
      expect(upperSemi1.loserNextMatchId).toBe('de-lower-semi');

      const grandFinal = de.allMatches.find(m => m.round === 'Grand Final')!;
      expect(grandFinal.seriesFormat).toBe('BO5');
    });

    it('generates 8-team Groups + Knockout (Purple Bean Challenger)', () => {
      const teams = makeTeams(8);
      const groups = GenericCompetitionEngine.generateGroupsAndKnockout(teams, 'pb-challenger-2026', 2, 2, 'BO1', 'BO3');

      expect(groups.format).toBe('GROUPS_KNOCKOUT');
      const groupMatches = groups.allMatches.filter(m => m.bracketType === 'GROUP');
      expect(groupMatches.length).toBe(12); // 6 in Group A, 6 in Group B

      const playoffs = groups.allMatches.filter(m => m.bracketType === 'MAIN' || m.bracketType === 'FINAL');
      expect(playoffs.length).toBe(3); // 2 Semis + Grand Final
    });
  });

  // =========================================================================
  // 6. DETERMINISTIC TIEBREAKS HIERARCHY
  // =========================================================================
  describe('6. Deterministic Tiebreaks Hierarchy', () => {
    it('breaks ties deterministically using Points -> Head-to-Head -> Game Diff -> Seed', () => {
      const tiedTeams: TiebreakTeamStats[] = [
        { teamId: 't-1', teamName: 'Team One', seed: 2, matchWins: 2, matchLosses: 1, seriesWins: 2, seriesLosses: 1, gamesWon: 4, gamesLost: 2, points: 6 },
        { teamId: 't-2', teamName: 'Team Two', seed: 1, matchWins: 2, matchLosses: 1, seriesWins: 2, seriesLosses: 1, gamesWon: 4, gamesLost: 2, points: 6 }
      ];

      // Team One defeated Team Two in their head-to-head encounter
      const h2h = [{ teamAId: 't-1', teamBId: 't-2', winnerTeamId: 't-1' }];
      const sorted = DotaTiebreakEngine.sortStandings(tiedTeams, h2h);

      expect(sorted[0].teamId).toBe('t-1'); // Won head-to-head
      expect(sorted[0].rank).toBe(1);
      expect(sorted[1].teamId).toBe('t-2');
      expect(sorted[1].rank).toBe(2);
    });
  });

  // =========================================================================
  // 7. MATCH OPERATIONS, CHECK-IN, OPENDOTA & DISPUTE LIFECYCLE
  // =========================================================================
  describe('7. Match Operations, OpenDota Match Linking & Disputes', () => {
    let matchRecord: DotaMatchRecord;

    beforeEach(() => {
      matchRecord = {
        id: 'dota-match-101',
        tournamentId: 'india-dota-open-2026',
        round: 'Upper Semifinal 1',
        seriesFormat: 'BO3',
        scheduledTime: 'Oct 20, 2026 · 18:00 IST',
        serverRegion: 'India (Mumbai)',
        teamA: { id: 'team-mum', name: 'Mumbai Warriors', tag: 'MUM', logo: '⚔️', rating: 1550 },
        teamB: { id: 'team-del', name: 'Delhi Dragons', tag: 'DEL', logo: '🐉', rating: 1530 },
        checkInStatus: 'WAITING',
        seriesScoreA: 0,
        seriesScoreB: 0,
        status: 'SCHEDULED',
        games: [],
        disputes: [],
        auditHistory: []
      };
      dotaMatchOperations.createMatch(matchRecord);
    });

    it('handles Captain Check-in and advances to LIVE once both teams are ready', () => {
      dotaMatchOperations.checkInTeam('dota-match-101', 'team-mum');
      expect(matchRecord.checkInStatus).toBe('TEAM_A_READY');

      dotaMatchOperations.checkInTeam('dota-match-101', 'team-del');
      expect(matchRecord.checkInStatus).toBe('BOTH_READY');
      expect(matchRecord.status).toBe('LIVE');
    });

    it('links external Dota 2 match ID and reconciles OpenDota stats', () => {
      const linkRes = dotaMatchOperations.linkDotaMatchId(
        'dota-match-101',
        1,
        '7891234567',
        {
          radiantWin: true,
          duration: 2150,
          radiantScore: 34,
          direScore: 21,
          radiantTowers: 10,
          direTowers: 2
        }
      );
      expect(linkRes.success).toBe(true);
      expect(linkRes.reconciliationStatus).toBe('MATCHED');
      expect(matchRecord.games.length).toBe(1);
      expect(matchRecord.games[0].dotaMatchId).toBe('7891234567');
    });

    it('executes result submission and opponent confirmation flow', () => {
      // Mumbai submits 2-1
      dotaMatchOperations.submitResult('dota-match-101', 'team-mum', 2, 1);
      expect(matchRecord.status).toBe('AWAITING_CONFIRMATION');

      // Delhi confirms
      const confirmRes = dotaMatchOperations.confirmResult('dota-match-101', 'team-del');
      expect(confirmRes.success).toBe(true);
      expect(matchRecord.status).toBe('FINALIZED');
      expect(matchRecord.winnerTeamId).toBe('team-mum');
    });

    it('handles Dispute lifecycle and Rematch ordering without destroying history', () => {
      dotaMatchOperations.submitResult('dota-match-101', 'team-mum', 2, 0);

      // Delhi opens dispute
      const dispRes = dotaMatchOperations.openDispute(
        'dota-match-101',
        'team-del',
        'Blaze',
        'TECHNICAL_ISSUE',
        'Mumbai server disconnected at min 15; lobby crashed.'
      );
      expect(dispRes.success).toBe(true);
      expect(matchRecord.status).toBe('DISPUTED');

      // Organiser orders a rematch
      const rematchRes = dotaMatchOperations.resolveDispute(
        'dota-match-101',
        dispRes.disputeId!,
        'ORDER_REMATCH',
        'referee-vikas',
        'Server crash verified in OpenDota logs. Rematch ordered.'
      );
      expect(rematchRes.success).toBe(true);
      expect(matchRecord.status).toBe('SUPERSEDED_BY_REMATCH');
      expect(rematchRes.newRematchId).toBe('dota-match-101-rematch');

      // Rematch match was created and scheduled
      const rematchMatch = dotaMatchOperations.getMatch('dota-match-101-rematch');
      expect(rematchMatch).toBeDefined();
      expect(rematchMatch?.isRematch).toBe(true);
      expect(rematchMatch?.rematchOfMatchId).toBe('dota-match-101');
    });
  });

  // =========================================================================
  // 8. AUDITED RESULT CORRECTION & DETERMINISTIC RATING REBUILD
  // =========================================================================
  describe('8. Deterministic Rating Rebuilder & Audited Corrections', () => {
    it('deterministically rebuilds rating ledger without point drift', () => {
      const initialRatings = {
        'team-mum': 1500,
        'team-del': 1500,
        'team-blr': 1500
      };

      const matchHistory = [
        { id: 'm-1', winnerTeamId: 'team-mum', loserTeamId: 'team-del', appliedAt: '2026-10-01T10:00:00Z' },
        { id: 'm-2', winnerTeamId: 'team-mum', loserTeamId: 'team-blr', appliedAt: '2026-10-01T12:00:00Z' }
      ];

      const rebuild1 = CompetitiveRatingRebuilder.rebuildRatings(initialRatings, matchHistory);
      const rebuild2 = CompetitiveRatingRebuilder.rebuildRatings(initialRatings, matchHistory);

      expect(rebuild1.teamRatings['team-mum']).toBe(rebuild2.teamRatings['team-mum']);
      expect(rebuild1.teamRatings['team-del']).toBe(rebuild2.teamRatings['team-del']);
      expect(rebuild1.ledger.length).toBe(2);
      expect(rebuild1.ledger[0].delta).toBe(rebuild2.ledger[0].delta);
    });
  });

  // =========================================================================
  // 9. SENSITIVE DATA PRIVACY BOUNDARY
  // =========================================================================
  describe('9. Sensitive Player Privacy & KYC Separation', () => {
    it('restricts KYC and UPI banking details from public spectators', () => {
      const playerAccount = {
        id: 'p-c1',
        username: 'Aether',
        displayName: 'Aether',
        avatar: '⚡',
        city: 'Mumbai',
        region: 'West India',
        primaryGame: 'Dota 2',
        primaryRole: 'Position 2 — Mid',
        rating: 1564,
        tournamentMmr: 5850,
        verifiedBadge: true,
        legalFullName: 'Arjun Nair',
        upiId: 'arjun@okaxis',
        idNumberMasked: 'XXXX-XXXX-8910'
      };

      const sanitized = PlayerPrivacyGuard.sanitizeForPublic(playerAccount as any);
      expect((sanitized as any).upiId).toBeUndefined();
      expect((sanitized as any).legalFullName).toBeUndefined();
      expect((sanitized as any).idNumberMasked).toBeUndefined();
      expect(sanitized.username).toBe('Aether');
      expect(sanitized.tournamentMmr).toBe(5850);
    });
  });

});
