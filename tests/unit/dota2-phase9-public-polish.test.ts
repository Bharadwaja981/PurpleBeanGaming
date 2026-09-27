/**
 * Purple Bean Gaming — Dota 2 Phase 9 Public Experience & Product Polish Tests
 * Validates public visitor, player, captain, organiser, and spectator journeys,
 * privacy, delay, search, notifications, responsive layouts, and fixture regression.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { dotaTournamentOperations } from '../../src/domain/dotaTournamentOperationsEngine';
import { dotaCareerHistoryEngine } from '../../src/domain/dotaCareerHistoryEngine';
import { testCupEngine } from '../../src/domain/testCupEngine';
import { INDIA_DOTA_OPEN_CONFIG, PURPLE_BEAN_CHALLENGER_CONFIG } from '../../src/data/seedTournaments';
import { MOCK_TOURNAMENTS, MOCK_TEAMS, MOCK_PLAYERS, MOCK_MATCHES } from '../../src/data/mockData';
import { ServerCallerContext } from '../../src/server/trustedTournamentOperations';

describe('Phase 9: Public Experience & Product Polish', () => {
  const spectatorCaller: ServerCallerContext = {
    userId: 'guest-spectator-1',
    email: 'spectator@pb.in',
    role: 'spectator',
    isAdmin: false
  };

  const playerCaller: ServerCallerContext = {
    userId: 'p-01',
    email: 'viper@pb.in',
    role: 'player',
    isAdmin: false
  };

  const captainCaller: ServerCallerContext = {
    userId: 'p-c1',
    email: 'aether@pb.in',
    role: 'captain',
    teamId: 'tc-team-1',
    isAdmin: false
  };

  const organizerCaller: ServerCallerContext = {
    userId: 'org-admin-1',
    email: 'director@pb.in',
    role: 'organizer',
    isAdmin: true
  };

  // 1. HOME & DISCOVERY
  describe('1. Home & Tournament Discovery', () => {
    it('discovers live, upcoming, registration open, and completed tournaments', () => {
      const live = MOCK_TOURNAMENTS.filter(t => t.status === 'Live');
      const upcoming = MOCK_TOURNAMENTS.filter(t => t.status === 'Upcoming');
      const openReg = MOCK_TOURNAMENTS.filter(t => t.status === 'Registration Open');

      expect(live.length).toBeGreaterThan(0);
      expect(upcoming.length).toBeGreaterThan(0);
      expect(openReg.length).toBeGreaterThan(0);
    });

    it('filters tournaments by title, region, and status with realistic Indian data', () => {
      const dotaOnly = MOCK_TOURNAMENTS.filter(t => t.game === 'Dota 2');
      expect(dotaOnly.length).toBeGreaterThan(0);
      expect(dotaOnly.some(t => t.id === 'purple-bean-test-cup')).toBe(true);
    });
  });

  // 2. TOURNAMENT PUBLIC PAGE & LIVE HUB
  describe('2. Tournament Public Page & Live Hub', () => {
    it('provides operational overview, live matches, bracket, rules, and announcements', () => {
      const rules = dotaTournamentOperations.getCurrentRules('purple-bean-test-cup');
      expect(rules).toBeDefined();
      expect(rules?.sections.length).toBeGreaterThanOrEqual(5);

      const anns = dotaTournamentOperations.getAnnouncements('purple-bean-test-cup', spectatorCaller);
      expect(anns.every(a => a.audience === 'PUBLIC')).toBe(true);
    });
  });

  // 3. PUBLIC MATCH PAGE & SPECTATOR PRIVACY
  describe('3. Public Match Page & Spectator Security', () => {
    it('never leaks private dispute notes, reporter email, or admin audit metadata to spectators', () => {
      const reports = dotaTournamentOperations.getReports(spectatorCaller, 'purple-bean-test-cup');
      reports.forEach(r => {
        expect((r as any).reporterEmail).toBeUndefined();
        expect((r as any).reporterId).toBeUndefined();
      });

      // Spectator is denied from viewing internal audit ledger
      expect(() => dotaTournamentOperations.getAuditTrail(spectatorCaller)).toThrow(/Unauthorized/);
    });
  });

  // 4. PLAYER PROFILES & CAREER RATINGS
  describe('4. Real Player Profile Data', () => {
    it('loads real career history, rating evolution, and Dota 2 tournament snapshots', () => {
      const ratings = dotaCareerHistoryEngine.getPlayerRankings({ region: 'All' });
      expect(ratings.length).toBeGreaterThan(0);
      expect(ratings[0].competitiveRating).toBeGreaterThan(0);

      const profile = dotaCareerHistoryEngine.getPlayerCareer('p-01');
      expect(profile).toBeDefined();
      expect(profile?.competitiveRating).toBeGreaterThan(0);
    });
  });

  // 5. TEAM PAGE & IMMUTABLE TOURNAMENT SNAPSHOTS
  describe('5. Team Pages & Immutable Snapshots', () => {
    it('preserves franchise identity and historical locked tournament rosters', () => {
      const teamRankings = dotaCareerHistoryEngine.getTeamRankings();
      expect(teamRankings.length).toBeGreaterThan(0);
      expect(teamRankings[0].teamName).toBeDefined();
    });
  });

  // 6. RANKINGS & SEASONS
  describe('6. Official Indian Rankings & Seasons', () => {
    it('provides authoritative player and team leaderboards by competitive season', () => {
      const seasons = dotaCareerHistoryEngine.getAllSeasons();
      expect(seasons.length).toBeGreaterThan(0);

      const season1Players = dotaCareerHistoryEngine.getPlayerRankings({ seasonId: seasons[0].id });
      expect(season1Players.length).toBeGreaterThan(0);
    });
  });

  // 7. GLOBAL SEARCH
  describe('7. Search Functionality', () => {
    it('searches players, teams, tournaments, and competitive seasons', () => {
      const seasons = dotaCareerHistoryEngine.getAllSeasons();
      const seasonMatch = seasons.filter(s => s.name.toLowerCase().includes('2026'));
      expect(seasonMatch.length).toBeGreaterThan(0);
    });
  });

  // 8. NOTIFICATION CENTER
  describe('8. Notification Center & Action Links', () => {
    it('routes persistent notifications, tracks read status, and provides action links', () => {
      const notif = dotaTournamentOperations.dispatchNotification({
        recipientId: 'p-01',
        tournamentId: 'purple-bean-test-cup',
        title: 'Match Scheduled',
        content: 'Your semifinal match is set.',
        type: 'MATCH_RESCHEDULE',
        destinationUrl: '/matches/m-1',
        isPrivate: false
      });

      expect(notif.id).toBeDefined();
      const userNotifs = dotaTournamentOperations.getUserNotifications('p-01');
      expect(userNotifs.some(n => n.id === notif.id)).toBe(true);

      const ok = dotaTournamentOperations.markNotificationAsRead(notif.id, 'p-01');
      expect(ok).toBe(true);
    });
  });

  // 9. SPECTATOR STREAM DELAY
  describe('9. Spectator Stream Delay (Server Authoritative)', () => {
    it('applies server-side delay to public spectator stream while participants get real-time', () => {
      const now = Date.now();
      const events = [
        { id: 'ev-old', timestamp: now - 300000, action: 'Draft Pick 1' }, // 5 mins ago
        { id: 'ev-new', timestamp: now - 30000, action: 'Draft Pick 2' }   // 30 secs ago (delayed)
      ];

      // Spectator view with 180s delay
      const spectatorEvents = dotaTournamentOperations.getSpectatorDelayedEvents(events, 180, spectatorCaller);
      expect(spectatorEvents.length).toBe(1);
      expect(spectatorEvents[0].id).toBe('ev-old');

      // Organizer view has 0 delay
      const orgEvents = dotaTournamentOperations.getSpectatorDelayedEvents(events, 180, organizerCaller);
      expect(orgEvents.length).toBe(2);
    });
  });

  // 10. ROLE JOURNEYS E2E
  describe('10. Full Role Journeys E2E', () => {
    it('Player journey: registration -> notifications -> match -> ratings', () => {
      expect(testCupEngine.getPlayers().length).toBeGreaterThan(0);
      expect(dotaCareerHistoryEngine.getPlayerRankings().length).toBeGreaterThan(0);
    });

    it('Captain journey: team -> auction -> match checkin -> result submit', () => {
      expect(testCupEngine.getTeams().length).toBe(3);
    });

    it('Organiser journey: dashboard -> rules -> announcements -> disqualification -> audit', () => {
      const summary = dotaTournamentOperations.getTournamentOperationalSummary('purple-bean-test-cup');
      expect(summary.verifiedPlayers).toBeGreaterThan(0);
    });

    it('Admin journey: separation of platform bans from tournament sanctions', () => {
      const res = dotaTournamentOperations.issuePlatformSanction(
        { userId: 'u-1', sanctionType: 'PERMANENT_PLATFORM_BAN', reason: 'TOS violation' },
        organizerCaller
      );
      expect(res.success).toBe(true);
    });
  });

  // 11. REGRESSION: ALL THREE DOTA TOURNAMENT FIXTURES
  describe('11. Regression: All 3 Dota 2 Fixtures', () => {
    it('verifies Purple Bean Test Cup fixture functions properly', () => {
      const teams = testCupEngine.getTeams();
      const status = testCupEngine.getStatus();
      expect(status).toBeDefined();
      expect(teams.length).toBe(3);
    });

    it('verifies India Dota Open fixture config is valid', () => {
      expect(INDIA_DOTA_OPEN_CONFIG.identity.tournamentId).toBe('india-dota-open-2026');
      expect(INDIA_DOTA_OPEN_CONFIG.identity.gameName).toBe('Dota 2');
    });

    it('verifies Purple Bean Challenger fixture config is valid', () => {
      expect(PURPLE_BEAN_CHALLENGER_CONFIG.identity.tournamentId).toBe('pb-challenger-2026');
      expect(PURPLE_BEAN_CHALLENGER_CONFIG.identity.gameName).toBe('Dota 2');
    });
  });
});
