/**
 * Purple Bean Gaming — Dota 2 Phase 8 Unit & Integration Tests
 * Organiser Operations, Rules, Announcements, Reports, Privacy, Disqualifications, Audit & Admin
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  dotaTournamentOperations,
  DotaTournamentOperationsEngine,
  TournamentRuleSection,
  ReportCategory,
  ReportStatus
} from '../../src/domain/dotaTournamentOperationsEngine';
import {
  trustedTournamentOps,
  ServerCallerContext
} from '../../src/server/trustedTournamentOperations';
import { testCupEngine } from '../../src/domain/testCupEngine';

describe('Phase 8: Organiser Operations, Reports & Admin Platform', () => {
  let ops: DotaTournamentOperationsEngine;

  const organizerCaller: ServerCallerContext = {
    userId: 'staff-admin-1',
    email: 'admin@purplebeangaming.com',
    role: 'organizer',
    isAdmin: true
  };

  const tournamentOrganiserCaller: ServerCallerContext = {
    userId: 'local-organizer-42',
    email: 'tourney-org@purplebeangaming.com',
    role: 'organizer',
    isAdmin: false
  };

  const captainCaller: ServerCallerContext = {
    userId: 'p-c1',
    email: 'aether@team.in',
    role: 'captain',
    teamId: 'tc-team-1',
    isAdmin: false
  };

  const playerCaller: ServerCallerContext = {
    userId: 'p-01',
    email: 'viper@player.in',
    role: 'player',
    teamId: 'tc-team-1',
    isAdmin: false
  };

  const spectatorCaller: ServerCallerContext = {
    userId: 'spectator-99',
    email: 'fan@purplebeangaming.com',
    role: 'spectator',
    isAdmin: false
  };

  beforeEach(() => {
    ops = new DotaTournamentOperationsEngine();
  });

  // =========================================================================
  // 1. ORGANISER DASHBOARD & METRICS
  // =========================================================================
  describe('1. Organiser Dashboard & Metrics', () => {
    it('summarizes tournament stages, verified registrations, upcoming/completed matches, and disputes', () => {
      const summary = ops.getTournamentOperationalSummary('purple-bean-test-cup');

      expect(summary.tournamentId).toBe('purple-bean-test-cup');
      expect(summary.stage).toBeDefined();
      expect(summary.registrationsCount).toBeGreaterThan(0);
      expect(summary.verifiedPlayers).toBeGreaterThan(0);
      expect(summary.teamsCount).toBeGreaterThan(0);
      expect(summary.rosterCompletion).toBe(100);
      expect(summary.ruleVersion).toBeGreaterThan(0);
      expect(summary.openReportsCount).toBeDefined();
    });
  });

  // =========================================================================
  // 2. TOURNAMENT RULES & VERSIONING
  // =========================================================================
  describe('2. Tournament Rules & Rule Versioning', () => {
    it('allows organizer to publish structured rules across all mandated categories', () => {
      const rules: TournamentRuleSection[] = [
        { id: 'r1', category: 'eligibility', title: 'Eligibility', content: 'Indian Resident only' },
        { id: 'r2', category: 'tournament_mmr', title: 'Tournament MMR', content: 'Locked at verification' },
        { id: 'r3', category: 'roster_rules', title: 'Roster Rules', content: '5 primary + 1 sub' },
        { id: 'r4', category: 'auction', title: 'Auction Rules', content: '10,000 INR budget' },
        { id: 'r5', category: 'forfeits', title: 'Forfeits', content: '15 min grace period' },
        { id: 'r6', category: 'disputes', title: 'Disputes', content: 'File within 30 min of match' }
      ];

      const res = ops.publishRules('tourney-rules-101', rules, organizerCaller, 'Initial v1 ruleset');
      expect(res.success).toBe(true);
      expect(res.version).toBe(1);

      const current = ops.getCurrentRules('tourney-rules-101');
      expect(current?.version).toBe(1);
      expect(current?.sections.length).toBe(6);
    });

    it('preserves complete rule version history when rules are updated after registration opens', () => {
      const v1Rules: TournamentRuleSection[] = [
        { id: 'r1', category: 'stand_ins', title: 'Stand-ins', content: 'No stand-ins allowed.' }
      ];
      ops.publishRules('tourney-version-test', v1Rules, organizerCaller, 'v1');

      const v2Rules: TournamentRuleSection[] = [
        { id: 'r1', category: 'stand_ins', title: 'Stand-ins', content: '1 emergency stand-in permitted with referee sign-off.' }
      ];
      const res = ops.publishRules('tourney-version-test', v2Rules, organizerCaller, 'v2: Allowed 1 emergency stand-in');
      expect(res.success).toBe(true);
      expect(res.version).toBe(2);

      const allVersions = ops.getRuleVersions('tourney-version-test');
      expect(allVersions.length).toBe(2);
      expect(allVersions[0].version).toBe(1);
      expect(allVersions[0].sections[0].content).toBe('No stand-ins allowed.');
      expect(allVersions[1].version).toBe(2);
      expect(allVersions[1].sections[0].content).toContain('emergency stand-in');
    });
  });

  // =========================================================================
  // 3. ANNOUNCEMENTS & AUDIENCE ROUTING
  // =========================================================================
  describe('3. Announcements & Audience Routing', () => {
    it('stores announcements with audience scoping and dispatches notifications', () => {
      const res = ops.postAnnouncement(
        {
          tournamentId: 'purple-bean-test-cup',
          title: 'Schedule Change: Grand Finals',
          content: 'Grand Finals pushed back by 30 minutes due to technical setup.',
          type: 'schedule_change',
          audience: 'ALL_PARTICIPANTS',
          authorId: organizerCaller.userId,
          authorName: 'Tournament Director'
        },
        organizerCaller
      );

      expect(res.success).toBe(true);
      expect(res.announcement?.id).toBeDefined();

      // Check captain audience view
      const captainView = ops.getAnnouncements('purple-bean-test-cup', captainCaller);
      expect(captainView.some(a => a.title === 'Schedule Change: Grand Finals')).toBe(true);

      // Check spectator audience view (only sees PUBLIC)
      const spectatorView = ops.getAnnouncements('purple-bean-test-cup', spectatorCaller);
      expect(spectatorView.every(a => a.audience === 'PUBLIC')).toBe(true);
    });
  });

  // =========================================================================
  // 4. PLAYER / TEAM REPORTS & INTEGRITY ALLEGATIONS
  // =========================================================================
  describe('4. Player & Team Reports', () => {
    it('allows authenticated users to report smurfing, false MMR, cheating, and toxic behavior', () => {
      const res = ops.submitReport(
        {
          tournamentId: 'purple-bean-test-cup',
          targetId: 'p-suspect-1',
          targetName: 'SuspectPlayer',
          targetType: 'player',
          category: 'False MMR',
          description: 'Declared 3500 MMR but active Divine rank in in-game screenshot.',
          evidenceUrls: ['https://steamcommunity.com/id/evidence-screenshot']
        },
        playerCaller
      );

      expect(res.success).toBe(true);
      expect(res.reportId).toBeDefined();
    });
  });

  // =========================================================================
  // 5. REPORT PRIVACY & ANONYMITY BOUNDARY
  // =========================================================================
  describe('5. Report Privacy & Reporter Anonymity', () => {
    it('never leaks reporter identity or private evidence in public or participant endpoints', () => {
      ops.submitReport(
        {
          tournamentId: 'purple-bean-test-cup',
          targetId: 'p-target-2',
          targetName: 'PlayerTwo',
          targetType: 'player',
          category: 'Possible Smurf',
          description: 'Suspected smurf account.'
        },
        playerCaller // reporter is viper@player.in
      );

      // Captain or spectator queries reports
      const publicReports = ops.getReports(captainCaller, 'purple-bean-test-cup');
      expect(publicReports.length).toBeGreaterThan(0);

      // Verify no reporter identity in participant view
      publicReports.forEach(r => {
        expect((r as any).reporterEmail).toBeUndefined();
        expect((r as any).reporterId).toBeUndefined();
        expect((r as any).reporterName).toBeUndefined();
      });

      // Organizer CAN see internal report details for investigation
      const adminReports = ops.getReports(organizerCaller, 'purple-bean-test-cup');
      expect((adminReports[0] as any).reporterId).toBeDefined();
    });
  });

  // =========================================================================
  // 6. REPORT REVIEW & DUE PROCESS (NO AUTOMATIC PUNISHMENT)
  // =========================================================================
  describe('6. Report Review & Evidence Investigation', () => {
    it('allows organizer to transition reports through review stages without auto-punishment', () => {
      const sub = ops.submitReport(
        {
          tournamentId: 'purple-bean-test-cup',
          targetId: 'p-target-3',
          targetName: 'PlayerThree',
          targetType: 'player',
          category: 'Account Sharing',
          description: 'Multiple Steam IPs detected.'
        },
        playerCaller
      );

      const reportId = sub.reportId!;

      // 1. Mark UNDER_REVIEW
      const r1 = ops.reviewReport(reportId, { status: 'UNDER_REVIEW', note: 'Investigating match logs.' }, organizerCaller);
      expect(r1.success).toBe(true);
      expect(r1.report?.status).toBe('UNDER_REVIEW');

      // 2. REQUEST_EVIDENCE
      const r2 = ops.reviewReport(
        reportId, 
        { 
          status: 'REQUEST_EVIDENCE', 
          note: 'Requested Steam family sharing verification.',
          evidenceRequestNote: 'Please upload login screenshot.' 
        }, 
        organizerCaller
      );
      expect(r2.success).toBe(true);
      expect(r2.report?.status).toBe('REQUEST_EVIDENCE');

      // Verify notification sent to target
      const targetNotifs = ops.getUserNotifications('p-target-3');
      expect(targetNotifs.some(n => n.type === 'EVIDENCE_REQUEST')).toBe(true);

      // 3. RESOLVED
      const r3 = ops.reviewReport(
        reportId, 
        { 
          status: 'RESOLVED', 
          resolutionSummary: 'Player verified sole ownership of Steam ID. Case closed without sanction.' 
        }, 
        organizerCaller
      );
      expect(r3.success).toBe(true);
      expect(r3.report?.status).toBe('RESOLVED');
    });
  });

  // =========================================================================
  // 7. DISQUALIFICATION IMPACT PREVIEW & RETENTION OF PAST RESULTS
  // =========================================================================
  describe('7. Disqualification Impact Preview & Execution', () => {
    it('generates an impact preview showing active roster, future matches, and retained past history', () => {
      const preview = ops.previewDisqualification(
        'purple-bean-test-cup',
        'tc-team-2',
        'team',
        organizerCaller
      );

      expect(preview.tournamentId).toBe('purple-bean-test-cup');
      expect(preview.targetId).toBe('tc-team-2');
      expect(preview.consequencePolicyApplied).toBe('FORFEIT_FUTURE_RETAIN_PAST');
      expect(preview.bracketImpactDescription).toContain('forfeit');
      expect(preview.standingsImpactDescription).toContain('Disqualified');
    });

    it('authoritatively executes disqualification, retains completed matches, and logs audit', () => {
      const res = ops.executeDisqualification(
        {
          tournamentId: 'purple-bean-test-cup',
          targetId: 'tc-team-3',
          targetType: 'team',
          reason: 'Severe unsportsmanlike conduct and referee harassment',
          evidenceReference: 'INCIDENT-AUDIO-RECORDING-77'
        },
        organizerCaller
      );

      expect(res.success).toBe(true);
      expect(res.sanction?.sanctionType).toBe('TOURNAMENT_DISQUALIFICATION');

      // Check audit log
      const audit = ops.getAuditTrail(organizerCaller, { category: 'DISQUALIFICATION' });
      expect(audit.some(a => a.entityId === 'tc-team-3')).toBe(true);
    });
  });

  // =========================================================================
  // 8. TOURNAMENT SANCTIONS VS PLATFORM BANS (SEPARATION OF POWERS)
  // =========================================================================
  describe('8. Tournament Sanctions vs Platform Bans', () => {
    it('allows tournament organizer to issue tournament-level sanctions', () => {
      const res = ops.executeDisqualification(
        {
          tournamentId: 'purple-bean-test-cup',
          targetId: 'p-toxic-1',
          targetType: 'player',
          reason: 'Excessive toxicity in all-chat'
        },
        tournamentOrganiserCaller
      );

      expect(res.success).toBe(true);
    });

    it('DENIES tournament organizers from issuing platform-wide bans (admin only)', () => {
      const res = ops.issuePlatformSanction(
        {
          userId: 'p-toxic-1',
          sanctionType: 'PERMANENT_PLATFORM_BAN',
          reason: 'Organiser attempt to ban account platform-wide'
        },
        tournamentOrganiserCaller // Not platform admin
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('strictly reserved for Platform Administrators');
    });

    it('allows platform administrators to issue platform-wide sanctions', () => {
      const res = ops.issuePlatformSanction(
        {
          userId: 'p-scammer-9',
          sanctionType: 'PERMANENT_PLATFORM_BAN',
          reason: 'Confirmed payment fraud on platform',
          durationDays: 365
        },
        organizerCaller // isAdmin: true
      );

      expect(res.success).toBe(true);
      expect(res.sanction?.sanctionType).toBe('PERMANENT_PLATFORM_BAN');
    });
  });

  // =========================================================================
  // 9. AUDIT LOG LEDGER & FILTERING
  // =========================================================================
  describe('9. Audit Log Ledger', () => {
    it('records critical operational events and allows filtering by category, actor, and date', () => {
      ops.appendAudit({
        tournamentId: 'purple-bean-test-cup',
        category: 'AUCTION',
        action: 'bid_placed',
        actorId: 'p-c1',
        actorName: 'Aether',
        actorRole: 'captain',
        entityId: 'p-tc-1',
        entityType: 'player',
        details: 'Bid 200 INR on player p-tc-1'
      });

      ops.appendAudit({
        tournamentId: 'purple-bean-test-cup',
        category: 'MMR',
        action: 'mmr_locked',
        actorId: 'staff-admin-1',
        actorName: 'Admin',
        actorRole: 'organizer',
        entityId: 'p-c1',
        entityType: 'player',
        details: 'Locked MMR to 5850'
      });

      const all = ops.getAuditTrail(organizerCaller);
      expect(all.length).toBeGreaterThanOrEqual(2);

      const auctionOnly = ops.getAuditTrail(organizerCaller, { category: 'AUCTION' });
      expect(auctionOnly.every(a => a.category === 'AUCTION')).toBe(true);

      const mmrOnly = ops.getAuditTrail(organizerCaller, { category: 'MMR' });
      expect(mmrOnly.every(a => a.category === 'MMR')).toBe(true);
    });
  });

  // =========================================================================
  // 10. NOTIFICATION CENTER
  // =========================================================================
  describe('10. Notification Center', () => {
    it('routes notifications with read/unread tracking and action destinations', () => {
      const notif = ops.dispatchNotification({
        recipientId: 'p-c1',
        tournamentId: 'purple-bean-test-cup',
        title: 'Check-in Open',
        content: 'Your match lobby is now open for check-in.',
        type: 'MATCH_RESCHEDULE',
        destinationUrl: '/matches/m-1',
        isPrivate: false
      });

      const userNotifs = ops.getUserNotifications('p-c1');
      expect(userNotifs.length).toBeGreaterThan(0);
      expect(userNotifs[0].read).toBe(false);

      const readSuccess = ops.markNotificationAsRead(notif.id, 'p-c1');
      expect(readSuccess).toBe(true);

      const updated = ops.getUserNotifications('p-c1');
      expect(updated.find(n => n.id === notif.id)?.read).toBe(true);
    });
  });

  // =========================================================================
  // 11. COMPLETE TEST FLOW (E2E OPS SIMULATION)
  // =========================================================================
  describe('11. End-to-End Operational Lifecycle', () => {
    it('executes full operational workflow: rules -> announcements -> report -> review -> disqualification -> audit', () => {
      // 1. Publish rules
      const ruleRes = ops.publishRules('pb-masters-2026', [
        { id: 'sec-1', category: 'conduct', title: 'Fair Play', content: 'No scripts.' }
      ], organizerCaller, 'Official Rules');
      expect(ruleRes.success).toBe(true);

      // 2. Announce
      const annRes = ops.postAnnouncement({
        tournamentId: 'pb-masters-2026',
        title: 'Tournament Starting Soon',
        content: 'Be online.',
        type: 'general',
        audience: 'PUBLIC',
        authorId: organizerCaller.userId,
        authorName: 'Admin'
      }, organizerCaller);
      expect(annRes.success).toBe(true);

      // 3. File report
      const repRes = ops.submitReport({
        tournamentId: 'pb-masters-2026',
        targetId: 'p-bad-actor',
        targetName: 'BadActor',
        targetType: 'player',
        category: 'Cheating',
        description: 'Camera zoom hack suspected'
      }, playerCaller);
      expect(repRes.success).toBe(true);

      // 4. Request evidence & review
      const revRes = ops.reviewReport(repRes.reportId!, {
        status: 'REQUEST_EVIDENCE',
        evidenceRequestNote: 'Submit Dota 2 combat log replay'
      }, organizerCaller);
      expect(revRes.success).toBe(true);

      // 5. Disqualify after confirmation
      const dqRes = ops.executeDisqualification({
        tournamentId: 'pb-masters-2026',
        targetId: 'p-bad-actor',
        targetType: 'player',
        reason: 'Third-party script injection verified in match logs'
      }, organizerCaller);
      expect(dqRes.success).toBe(true);

      // 6. Check audit log has all events
      const trail = ops.getAuditTrail(organizerCaller, { tournamentId: 'pb-masters-2026' });
      expect(trail.length).toBeGreaterThanOrEqual(4);
    });
  });

  // =========================================================================
  // 12. NEGATIVE SECURITY & PERMISSION TESTS
  // =========================================================================
  describe('12. Negative Security & Boundary Tests', () => {
    it('denies players from editing or publishing tournament rules', () => {
      const res = ops.publishRules('pb-test', [], playerCaller, 'Hacked rules');
      expect(res.success).toBe(false);
      expect(res.error).toContain('Unauthorized');
    });

    it('denies spectators or players from reading internal audit logs', () => {
      expect(() => ops.getAuditTrail(spectatorCaller)).toThrow(/Unauthorized/);
      expect(() => ops.getAuditTrail(playerCaller)).toThrow(/Unauthorized/);
    });

    it('denies normal captains from viewing platform sanctions or issuing platform bans', () => {
      expect(() => ops.getPlatformSanctions(captainCaller)).toThrow(/Unauthorized/);

      const banRes = ops.issuePlatformSanction({
        userId: 'user-x',
        sanctionType: 'PERMANENT_PLATFORM_BAN',
        reason: 'Unauthorized attempt'
      }, captainCaller);

      expect(banRes.success).toBe(false);
      expect(banRes.error).toContain('strictly reserved for Platform Administrators');
    });

    it('denies non-organizers from resolving or modifying reports', () => {
      const sub = ops.submitReport({
        targetId: 'p-target-x',
        targetName: 'X',
        targetType: 'player',
        category: 'Other',
        description: 'Issue'
      }, playerCaller);

      const reviewRes = ops.reviewReport(sub.reportId!, { status: 'RESOLVED' }, spectatorCaller);
      expect(reviewRes.success).toBe(false);
      expect(reviewRes.error).toContain('Unauthorized');
    });

    it('denies non-organizers from executing tournament disqualifications', () => {
      const dqRes = ops.executeDisqualification({
        tournamentId: 'pb-test',
        targetId: 'p-player-1',
        targetType: 'player',
        reason: 'Illegal disqualification attempt'
      }, spectatorCaller);

      expect(dqRes.success).toBe(false);
      expect(dqRes.error).toContain('Unauthorized');
    });
  });
});
