/**
 * Purple Bean Gaming — Generic Configurable Tournament Engine Test Suite
 * 
 * Verifies all generic tournament capabilities:
 * 1. Tournament Configuration Validation (Dota auction, Premade, Invalid rejections)
 * 2. Game Definitions & Game-Aware Roster Rules (Dota 2, CS2, Valorant, BGMI, PUBG, substitutes)
 * 3. Competition Engine Formats:
 *    - 3-team Single Elimination with BYE
 *    - 4-team Single Elimination
 *    - 6-team Single Elimination with 2 BYEs
 *    - 8-team Single Elimination
 *    - Double Elimination (Upper, Lower, Grand Final)
 *    - Round Robin (Berger schedule, win/loss/draw points, standings)
 *    - Groups + Knockout (Group round-robin advancing to playoffs)
 * 4. Seeding Methods (Manual, Random, Rating-based)
 * 5. Registration Modes (Individual vs Premade Team)
 * 6. Team Formation Models (Captain Auction vs Premade Review)
 * 7. Dynamic Lifecycle Transitions (valid progression vs illegal jumps)
 * 8. Sensitive Player Data Separation & Privacy
 * 9. Multi-game Player Identity & Game-Specific Ratings
 * 10. India Dota Open Premade Tournament End-to-End Simulation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TournamentConfig, 
  validateTournamentConfig, 
  createDefaultTournamentConfig 
} from '../../src/domain/tournamentConfig';
import { 
  getGameDefinition, 
  getAllGameDefinitions, 
  isBattleRoyaleGame 
} from '../../src/domain/gameDefinitions';
import { 
  GenericCompetitionEngine, 
  CompetitionTeam 
} from '../../src/domain/genericCompetitionEngine';
import { 
  GenericTournamentLifecycle 
} from '../../src/domain/genericTournamentLifecycle';
import { 
  PremadeTeamEngine, 
  PremadeRosterPlayer 
} from '../../src/domain/premadeTeamEngine';
import { 
  GenericTournamentEngine 
} from '../../src/domain/genericTournamentEngine';
import { 
  PlayerPrivacyGuard, 
  PublicPlayerProfile, 
  PrivateKycRecord, 
  PrizePaymentRecord 
} from '../../src/domain/playerPrivacy';
import { 
  MultiGameRatingRegistry, 
  CanonicalPlayer 
} from '../../src/domain/gameProfiles';
import { 
  INDIA_DOTA_OPEN_CONFIG, 
  INITIAL_PREMADE_TEAMS 
} from '../../src/data/seedTournaments';

describe('Generic Tournament Architecture & Engine', () => {

  describe('1. Tournament Configuration Validation', () => {
    it('validates a standard Dota 2 individual auction tournament', () => {
      const config = createDefaultTournamentConfig('dota2');
      const result = validateTournamentConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('validates a premade-team tournament config (India Dota Open)', () => {
      const result = validateTournamentConfig(INDIA_DOTA_OPEN_CONFIG);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('rejects invalid configurations (missing name, < 2 teams, auction without credits)', () => {
      const invalidConfig: TournamentConfig = {
        identity: {
          tournamentId: 'bad-tourney',
          name: '', // Empty name!
          gameId: 'dota2',
          gameName: 'Dota 2',
          description: '',
          region: 'Pan India',
          locationType: 'ONLINE'
        },
        registration: {
          registrationMode: 'INDIVIDUAL',
          openDate: '2026-10-01',
          closeDate: '2026-10-14',
          maxParticipants: 10
        },
        teamFormation: {
          mode: 'AUCTION',
          numberOfTeams: 1 // Less than 2 teams!
        },
        roster: {
          primaryRosterSize: 0, // Invalid roster size!
          captainCountsTowardRoster: true,
          substituteSlots: 0,
          substituteRequired: false
        },
        auction: {
          enabled: true,
          startingCredits: 0, // Zero credits!
          minimumBid: 10,
          bidIncrement: 10,
          reservePerRemainingSlot: 10
        },
        competition: {
          format: 'SINGLE_ELIMINATION',
          defaultSeriesFormat: 'BO3',
          seedingMethod: 'RATING_BASED'
        },
        prizes: {
          totalPrizePoolINR: -500, // Negative prize pool!
          placementDistribution: []
        },
        integrity: {
          verificationRequired: true,
          organizerApprovalRequired: true
        }
      };

      const result = validateTournamentConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
      expect(result.errors.some(e => e.includes('Tournament name is required'))).toBe(true);
      expect(result.errors.some(e => e.includes('at least 2 teams'))).toBe(true);
      expect(result.errors.some(e => e.includes('Primary roster size must be at least 1'))).toBe(true);
      expect(result.errors.some(e => e.includes('credits must be greater than zero'))).toBe(true);
    });

    it('rejects illegal pairing of Premade Registration with Captain Auction', () => {
      const config = createDefaultTournamentConfig('dota2');
      config.registration.registrationMode = 'PREMADE_TEAM';
      config.teamFormation.mode = 'AUCTION';

      const result = validateTournamentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Premade team registration does not support Captain Auction'))).toBe(true);
    });
  });

  describe('2. Game Definitions & Game-Aware Roster Rules', () => {
    it('defines distinct roster requirements and competition models for supported games', () => {
      const dota = getGameDefinition('dota2');
      const cs2 = getGameDefinition('cs2');
      const val = getGameDefinition('valorant');
      const bgmi = getGameDefinition('bgmi');
      const pubg = getGameDefinition('pubg');

      expect(dota.defaultRosterSize).toBe(5);
      expect(dota.competitionType).toBe('HEAD_TO_HEAD');
      expect(dota.roles.length).toBe(5);

      expect(cs2.defaultRosterSize).toBe(5);
      expect(cs2.competitionType).toBe('HEAD_TO_HEAD');

      expect(val.defaultRosterSize).toBe(5);
      expect(val.competitionType).toBe('HEAD_TO_HEAD');

      // Battle Royale titles require 4-player primary squads
      expect(bgmi.defaultRosterSize).toBe(4);
      expect(bgmi.competitionType).toBe('BATTLE_ROYALE');
      expect(isBattleRoyaleGame('bgmi')).toBe(true);

      expect(pubg.defaultRosterSize).toBe(4);
      expect(pubg.competitionType).toBe('BATTLE_ROYALE');
      expect(isBattleRoyaleGame('pubg')).toBe(true);
    });

    it('validates Dota 2, CS2, Valorant 5-player rosters and BGMI/PUBG 4-player rosters', () => {
      const dotaConfig = createDefaultTournamentConfig('dota2');
      dotaConfig.roster.primaryRosterSize = 5;
      dotaConfig.roster.substituteSlots = 1;

      const validRoster: PremadeRosterPlayer[] = [
        { id: 'p1', inGameName: 'Carry', displayName: 'Carry', role: 'Position 1 — Carry', ratingOrMmr: 5000, isCaptain: true, isSubstitute: false },
        { id: 'p2', inGameName: 'Mid', displayName: 'Mid', role: 'Position 2 — Mid', ratingOrMmr: 5200, isCaptain: false, isSubstitute: false },
        { id: 'p3', inGameName: 'Off', displayName: 'Off', role: 'Position 3 — Offlane', ratingOrMmr: 4800, isCaptain: false, isSubstitute: false },
        { id: 'p4', inGameName: 'Supp1', displayName: 'Supp1', role: 'Position 4 — Soft Support', ratingOrMmr: 4700, isCaptain: false, isSubstitute: false },
        { id: 'p5', inGameName: 'Supp2', displayName: 'Supp2', role: 'Position 5 — Hard Support', ratingOrMmr: 4600, isCaptain: false, isSubstitute: false }
      ];

      const validSub: PremadeRosterPlayer[] = [
        { id: 'sub1', inGameName: 'Sub', displayName: 'Sub', role: 'Position 1 — Carry', ratingOrMmr: 4500, isCaptain: false, isSubstitute: true }
      ];

      const checkValid = PremadeTeamEngine.validateRoster(validRoster, validSub, dotaConfig);
      expect(checkValid.valid).toBe(true);

      // Incomplete roster (4 players instead of 5 for Dota)
      const checkIncomplete = PremadeTeamEngine.validateRoster(validRoster.slice(0, 4), validSub, dotaConfig);
      expect(checkIncomplete.valid).toBe(false);
      expect(checkIncomplete.errors[0]).toContain('Primary roster must contain exactly 5 players');

      // Missing captain
      const noCaptainRoster = validRoster.map(p => ({ ...p, isCaptain: false }));
      const checkNoCap = PremadeTeamEngine.validateRoster(noCaptainRoster, validSub, dotaConfig);
      expect(checkNoCap.valid).toBe(false);
      expect(checkNoCap.errors[0]).toContain('must specify exactly one captain');
    });
  });

  describe('3. Generic Competition Engine Formats', () => {
    const makeTeams = (count: number): CompetitionTeam[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `team-${i + 1}`,
        name: `Team ${i + 1}`,
        tag: `T${i + 1}`,
        logo: '🛡️',
        rating: 1500 + i * 50
      }));
    };

    it('generates 3-team Single Elimination with BYE (Purple Bean Test Cup format)', () => {
      const teams = makeTeams(3);
      const structure = GenericCompetitionEngine.generateSingleElimination(teams, 'test-cup-tourney');

      expect(structure.format).toBe('SINGLE_ELIMINATION');
      expect(structure.allMatches.length).toBe(2);

      const semi = structure.allMatches.find(m => m.round === 'Semifinal');
      expect(semi).toBeDefined();
      expect(semi?.teamA?.name).toBe('Team 1');
      expect(semi?.teamB?.name).toBe('Team 2');

      const final = structure.allMatches.find(m => m.round === 'Grand Final');
      expect(final).toBeDefined();
      expect(final?.teamB?.name).toBe('Team 3'); // Received BYE into Grand Final
    });

    it('generates 4-team Single Elimination bracket without BYEs', () => {
      const teams = makeTeams(4);
      const structure = GenericCompetitionEngine.generateSingleElimination(teams, 'four-team-tourney');

      expect(structure.allMatches.length).toBe(3); // 2 Semifinals + 1 Grand Final
      const semis = structure.allMatches.filter(m => m.round === 'Semifinals');
      expect(semis.length).toBe(2);
      expect(structure.allMatches.some(m => m.status === 'BYE')).toBe(false);
    });

    it('generates 6-team Single Elimination bracket with exactly 2 BYEs', () => {
      const teams = makeTeams(6);
      const structure = GenericCompetitionEngine.generateSingleElimination(teams, 'six-team-tourney');

      // 6 teams in power-of-2 (8): 8 - 6 = 2 BYEs in Quarterfinals
      const quarterMatches = structure.rounds[0].matches;
      expect(quarterMatches.length).toBe(4);
      const byes = quarterMatches.filter(m => m.status === 'BYE');
      expect(byes.length).toBe(2);
    });

    it('generates 8-team Single Elimination bracket (4 Quarters, 2 Semis, 1 Final)', () => {
      const teams = makeTeams(8);
      const structure = GenericCompetitionEngine.generateSingleElimination(teams, 'eight-team-tourney');

      expect(structure.allMatches.length).toBe(7);
      expect(structure.rounds.length).toBe(3);
      expect(structure.rounds[0].matches.length).toBe(4); // Quarterfinals
      expect(structure.rounds[1].matches.length).toBe(2); // Semifinals
      expect(structure.rounds[2].matches.length).toBe(1); // Grand Final
    });

    it('generates true Double Elimination with Upper, Lower, and Grand Final brackets', () => {
      const teams = makeTeams(4);
      const structure = GenericCompetitionEngine.generateDoubleElimination(teams, 'de-tourney', 'BO3', { 'Grand Final': 'BO5' });

      expect(structure.format).toBe('DOUBLE_ELIMINATION');
      expect(structure.allMatches.length).toBe(6);

      const upperMatches = structure.allMatches.filter(m => m.bracketType === 'UPPER');
      expect(upperMatches.length).toBe(3); // Upper Semi 1, Upper Semi 2, Upper Final

      const lowerMatches = structure.allMatches.filter(m => m.bracketType === 'LOWER');
      expect(lowerMatches.length).toBe(2); // Lower Semi, Lower Final

      const grandFinal = structure.allMatches.find(m => m.bracketType === 'FINAL');
      expect(grandFinal).toBeDefined();
      expect(grandFinal?.seriesFormat).toBe('BO5');

      // Verify loser progression metadata
      expect(upperMatches[0].loserNextMatchId).toBe('de-lower-semi');
      expect(upperMatches[1].loserNextMatchId).toBe('de-lower-semi');
    });

    it('generates Round Robin schedule and calculates table standings', () => {
      const teams = makeTeams(4);
      const structure = GenericCompetitionEngine.generateRoundRobin(teams, 'rr-tourney', 'BO1');

      // 4 teams -> n*(n-1)/2 = 6 matches
      expect(structure.format).toBe('ROUND_ROBIN');
      expect(structure.allMatches.length).toBe(6);

      // Simulate match outcomes
      const m1 = structure.allMatches[0];
      m1.status = 'COMPLETED';
      m1.scoreA = 1;
      m1.scoreB = 0;

      const standings = GenericCompetitionEngine.calculateRoundRobinStandings(teams, structure.allMatches);
      expect(standings.length).toBe(4);
      expect(standings[0].played).toBe(1);
      expect(standings[0].won).toBe(1);
      expect(standings[0].points).toBe(3);
    });

    it('generates Groups + Knockout structure with round-robin group play and playoff bracket', () => {
      const teams = makeTeams(8);
      const structure = GenericCompetitionEngine.generateGroupsAndKnockout(teams, 'groups-tourney', 2, 2, 'BO1', 'BO3');

      expect(structure.format).toBe('GROUPS_KNOCKOUT');
      const groupMatches = structure.allMatches.filter(m => m.bracketType === 'GROUP');
      // 2 groups of 4: each group has 6 matches = 12 total group matches
      expect(groupMatches.length).toBe(12);

      const playoffMatches = structure.allMatches.filter(m => m.bracketType === 'MAIN' || m.bracketType === 'FINAL');
      expect(playoffMatches.length).toBe(3); // 2 Semifinals + 1 Grand Final
    });
  });

  describe('4. Seeding Methods', () => {
    const teams: CompetitionTeam[] = [
      { id: 't1', name: 'Alpha', tag: 'ALP', logo: '', rating: 1200 },
      { id: 't2', name: 'Beta', tag: 'BET', logo: '', rating: 1800 },
      { id: 't3', name: 'Gamma', tag: 'GAM', logo: '', rating: 1500 }
    ];

    it('seeds teams by rating descending', () => {
      const seeded = GenericCompetitionEngine.seedTeams(teams, 'RATING_BASED');
      expect(seeded[0].name).toBe('Beta'); // 1800
      expect(seeded[0].seed).toBe(1);
      expect(seeded[1].name).toBe('Gamma'); // 1500
      expect(seeded[1].seed).toBe(2);
      expect(seeded[2].name).toBe('Alpha'); // 1200
      expect(seeded[2].seed).toBe(3);
    });

    it('seeds teams manually according to provided order', () => {
      const seeded = GenericCompetitionEngine.seedTeams(teams, 'MANUAL', ['t3', 't1', 't2']);
      expect(seeded[0].id).toBe('t3');
      expect(seeded[1].id).toBe('t1');
      expect(seeded[2].id).toBe('t2');
    });
  });

  describe('5. Dynamic Lifecycle Transitions', () => {
    it('generates auction stages for Individual Auction tournaments and rejects illegal jumps', () => {
      const config = createDefaultTournamentConfig('dota2');
      config.teamFormation.mode = 'AUCTION';
      const stages = GenericTournamentLifecycle.getStagesForConfig(config);

      expect(stages.some(s => s.id === 'AUCTION')).toBe(true);
      expect(stages.some(s => s.id === 'CAPTAIN_SELECTION')).toBe(true);

      // Valid: DRAFT -> REGISTRATION_OPEN
      const validTrans = GenericTournamentLifecycle.validateTransition('DRAFT', 'REGISTRATION_OPEN', config);
      expect(validTrans.valid).toBe(true);

      // Illegal: DRAFT directly to COMPETITION
      const illegalTrans = GenericTournamentLifecycle.validateTransition('DRAFT', 'COMPETITION', config);
      expect(illegalTrans.valid).toBe(false);
      expect(illegalTrans.reason).toContain('Illegal lifecycle transition');
    });

    it('omits Auction and Captain Selection for Premade-Team tournaments', () => {
      const stages = GenericTournamentLifecycle.getStagesForConfig(INDIA_DOTA_OPEN_CONFIG);
      expect(stages.some(s => s.id === 'AUCTION')).toBe(false);
      expect(stages.some(s => s.id === 'CAPTAIN_SELECTION')).toBe(false);
      expect(stages.some(s => s.id === 'PREMADE_REVIEW')).toBe(true);
    });
  });

  describe('6. Sensitive Player Data Separation & Privacy Guard', () => {
    it('sanitizes public profiles, stripping KYC and UPI payment details', () => {
      const fullRecord = {
        id: 'player-101',
        username: 'Viper',
        displayName: 'Viper',
        avatar: '🐍',
        city: 'Mumbai',
        region: 'West India',
        primaryGame: 'Dota 2',
        primaryRole: 'Position 1 — Carry',
        rating: 5800,
        tournamentMmr: 5800,
        verifiedBadge: true,
        // Sensitive data:
        legalFullName: 'Vivek Sharma',
        idNumberMasked: 'XXXX-XXXX-9912',
        upiId: 'vivek@oksbi',
        panNumberMasked: 'ABCDE1234F'
      };

      const publicProfile = PlayerPrivacyGuard.sanitizeForPublic(fullRecord as any);
      expect((publicProfile as any).legalFullName).toBeUndefined();
      expect((publicProfile as any).upiId).toBeUndefined();
      expect((publicProfile as any).idNumberMasked).toBeUndefined();
      expect((publicProfile as any).panNumberMasked).toBeUndefined();
      expect(publicProfile.username).toBe('Viper');
      expect(publicProfile.rating).toBe(5800);
    });

    it('enforces role-based authorization on KYC and Payment records', () => {
      const regularPlayer = { userId: 'player-202', roles: ['player' as const] };
      const organizer = { userId: 'org-1', roles: ['organiser' as const] };
      const admin = { userId: 'admin-1', roles: ['admin' as const] };

      // Player can access their own KYC
      expect(PlayerPrivacyGuard.canAccessKyc(regularPlayer, 'player-202')).toBe(true);
      // Player cannot access other player's KYC
      expect(PlayerPrivacyGuard.canAccessKyc(regularPlayer, 'player-999')).toBe(false);
      // Organizer can access any player's KYC
      expect(PlayerPrivacyGuard.canAccessKyc(organizer, 'player-999')).toBe(true);

      // Only admin can access private payment/banking data
      expect(PlayerPrivacyGuard.canAccessPaymentData(organizer, 'player-999')).toBe(false);
      expect(PlayerPrivacyGuard.canAccessPaymentData(admin, 'player-999')).toBe(true);
    });
  });

  describe('7. Multi-Game Player Identity & Game-Specific Ratings', () => {
    it('maintains distinct competitive ratings for Dota 2, CS2, and Valorant without cross-polluting', () => {
      const registry = new MultiGameRatingRegistry();

      const aether: CanonicalPlayer = {
        id: 'p-aether',
        username: 'Aether',
        displayName: 'Aether',
        avatar: '⚡',
        country: 'India',
        city: 'Mumbai',
        region: 'West India',
        joinedAt: '2026-01-01',
        gameProfiles: {
          dota2: {
            gameId: 'dota2',
            gameName: 'Dota 2',
            inGameName: 'Aether',
            rating: 5850,
            ratingDisplay: '5,850 MMR',
            primaryRole: 'Position 2 — Mid',
            rankBadge: 'Immortal',
            matchesPlayed: 42,
            wins: 28,
            winRate: 67,
            lastActive: '2026-09-26'
          },
          cs2: {
            gameId: 'cs2',
            gameName: 'Counter-Strike 2',
            inGameName: 'AetherCS',
            rating: 17400,
            ratingDisplay: '17,400 CS Rating',
            primaryRole: 'Primary AWPer',
            rankBadge: 'Global Elite',
            matchesPlayed: 15,
            wins: 10,
            winRate: 67,
            lastActive: '2026-09-20'
          }
        },
        careerSnapshots: []
      };

      registry.registerPlayer(aether);

      expect(registry.getGameRating('p-aether', 'dota2')).toBe(5850);
      expect(registry.getGameRating('p-aether', 'cs2')).toBe(17400);

      // Record a Dota 2 tournament win
      registry.recordTournamentFinish('p-aether', {
        tournamentId: 'pb-test-cup',
        tournamentName: 'Purple Bean Test Cup',
        gameId: 'dota2',
        gameName: 'Dota 2',
        teamId: 'tc-team-mumbai',
        teamName: 'Mumbai Mavericks',
        rosterRole: 'Captain & Mid',
        placement: 'Champion (1st Place)',
        prizeWonINR: 15000,
        finishedAt: '2026-09-26',
        ratingDelta: 24
      });

      // Dota rating increases, CS rating remains completely unchanged
      expect(registry.getGameRating('p-aether', 'dota2')).toBe(5874);
      expect(registry.getGameRating('p-aether', 'cs2')).toBe(17400);
      expect(aether.careerSnapshots.length).toBe(1);
    });
  });

  describe('8. Premade Team Tournament End-to-End Execution (India Dota Open)', () => {
    it('executes team submission, organizer approval, bracket generation, and match completion', () => {
      const engine = new GenericTournamentEngine(INDIA_DOTA_OPEN_CONFIG);

      expect(engine.getConfig().identity.name).toBe('India Dota Open');
      expect(engine.getCurrentStage()).toBe('REGISTRATION_OPEN');

      // Submit 4 premade teams
      INITIAL_PREMADE_TEAMS.forEach(app => {
        const subRes = engine.submitPremadeTeam(
          app.teamName,
          app.tag,
          app.logo,
          app.homeCity,
          app.managerOrCaptainId,
          app.managerEmail,
          app.roster,
          app.substitutes
        );
        expect(subRes.success).toBe(true);
        if (subRes.application) {
          // Approve application
          const reviewRes = engine.reviewPremadeTeam(subRes.application.id, 'APPROVED');
          expect(reviewRes.success).toBe(true);
        }
      });

      // Verify approved teams entered eligible pool
      const teams = engine.getTeams();
      expect(teams.length).toBe(INITIAL_PREMADE_TEAMS.length);
      expect(teams.some(t => t.name === 'Mumbai Warriors')).toBe(true);
      expect(teams.some(t => t.name === 'Delhi Dragons')).toBe(true);

      // Generate Double Elimination bracket
      const structure = engine.generateCompetition();
      expect(structure.format).toBe('DOUBLE_ELIMINATION');
      expect(structure.allMatches.length).toBe(6);

      // Execute Upper Semifinal 1: Mumbai Warriors (2) vs Hyderabad Hawks (0)
      const upperSemi1 = structure.allMatches[0];
      const matchRes = engine.executeMatchResult(upperSemi1.id, 2, 0);
      expect(matchRes.success).toBe(true);
      expect(matchRes.winner?.name).toBe('Mumbai Warriors');

      // Complete tournament and crown champion
      engine.completeTournament(teams[0].id, teams[1].id, teams[2].id);
      expect(engine.getCurrentStage()).toBe('COMPLETED');
      expect(teams[0].placement).toBe('1st Place (Champion)');
      expect(teams[0].earningsINR).toContain('₹50,000');
    });
  });

});
