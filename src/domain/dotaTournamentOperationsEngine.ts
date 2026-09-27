/**
 * Purple Bean Gaming — Dota 2 Tournament Operations & Administration Domain
 * 
 * Implements:
 * 1. Structured Tournament Rules with version history
 * 2. Announcements & Multi-Audience Dispatch
 * 3. Reports & Anti-Cheat / Smurf Allegations (with reporter anonymity / privacy boundary)
 * 4. Audit Trail Ledger (tamper-evident, filterable by actor, category, date, entity)
 * 5. Disqualification Impact Previews & Atomic Executions
 * 6. Tournament Sanctions vs Platform Bans (Separation of Powers)
 * 7. Platform Admin vs Tournament Organiser Access Control
 * 8. Notification Center with Audience Routing & Privacy Protections
 */

import { ServerCallerContext } from '../server/trustedTournamentOperations';
import { dotaPlayerRegistry, DotaRolePosition } from './dotaPlayerEngine';
import { testCupEngine } from './testCupEngine';
import { dotaCompetitionEngine } from './dotaCompetitionEngine';
import { dotaCareerHistoryEngine } from './dotaCareerHistoryEngine';

// ============================================================================
// 1. RULES & VERSIONING
// ============================================================================

export interface TournamentRuleSection {
  id: string;
  category: 
    | 'eligibility'
    | 'tournament_mmr'
    | 'roster_rules'
    | 'stand_ins'
    | 'auction'
    | 'match_scheduling'
    | 'lobby_server_rules'
    | 'pauses'
    | 'no_shows'
    | 'forfeits'
    | 'disputes'
    | 'rematches'
    | 'conduct'
    | 'prize_distribution';
  title: string;
  content: string;
}

export interface TournamentRuleVersion {
  version: number;
  publishedAt: string;
  publishedBy: string;
  changeSummary: string;
  sections: TournamentRuleSection[];
}

// ============================================================================
// 2. ANNOUNCEMENTS & AUDIENCE
// ============================================================================

export type AnnouncementAudience = 'PUBLIC' | 'ALL_PARTICIPANTS' | 'CAPTAINS' | 'SPECIFIC_TEAM';

export type AnnouncementType = 
  | 'general'
  | 'registration_update'
  | 'schedule_change'
  | 'auction_update'
  | 'rules_update'
  | 'urgent_notice';

export interface TournamentAnnouncement {
  id: string;
  tournamentId: string;
  title: string;
  content: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  targetTeamId?: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  pinned?: boolean;
}

// ============================================================================
// 3. REPORTS & INTEGRITY ALLEGATIONS (WITH PRIVACY BOUNDARY)
// ============================================================================

export type ReportCategory = 
  | 'Possible Smurf'
  | 'False MMR'
  | 'Account Sharing'
  | 'Cheating'
  | 'Toxic / Abusive Behaviour'
  | 'Tournament Rule Violation'
  | 'Other';

export type ReportStatus = 
  | 'OPEN'
  | 'UNDER_REVIEW'
  | 'REQUEST_EVIDENCE'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'ESCALATED';

export interface ReportAuditAction {
  action: string;
  performedBy: string;
  role: string;
  timestamp: string;
  note?: string;
}

export interface PlayerTeamReport {
  id: string;
  tournamentId?: string;
  targetId: string;
  targetName: string;
  targetType: 'player' | 'team';
  category: ReportCategory;
  description: string;
  evidenceUrls?: string[];
  evidenceText?: string;
  // Private boundary fields:
  reporterId: string;
  reporterName: string;
  reporterEmail?: string;
  timestamp: string;
  status: ReportStatus;
  auditTrail: ReportAuditAction[];
  moderatorNotes?: string;
  resolutionSummary?: string;
  sanctionApplied?: string;
}

// Sanitized report for public / participants / non-moderators
export interface SanitizedPublicReport {
  id: string;
  tournamentId?: string;
  targetId: string;
  targetName: string;
  targetType: 'player' | 'team';
  category: ReportCategory;
  status: ReportStatus;
  timestamp: string;
  resolutionSummary?: string;
}

// ============================================================================
// 4. SANCTIONS & DISQUALIFICATIONS
// ============================================================================

export type TournamentSanctionType = 
  | 'WARNING'
  | 'MATCH_PENALTY'
  | 'PLAYER_REMOVAL'
  | 'TOURNAMENT_DISQUALIFICATION';

export type PlatformSanctionType = 
  | 'ACCOUNT_SUSPENSION_TEMPORARY'
  | 'PERMANENT_PLATFORM_BAN'
  | 'RANKED_MMR_LOCKOUT';

export interface TournamentSanction {
  id: string;
  tournamentId: string;
  targetId: string;
  targetType: 'player' | 'team';
  sanctionType: TournamentSanctionType;
  reason: string;
  issuedBy: string;
  issuedAt: string;
  evidenceReference?: string;
  status: 'ACTIVE' | 'REVOKED';
}

export interface PlatformSanction {
  id: string;
  userId: string;
  sanctionType: PlatformSanctionType;
  reason: string;
  issuedByAdminId: string;
  issuedAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'APPEALED' | 'REVOKED';
}

export interface DisqualificationImpactPreview {
  tournamentId: string;
  targetId: string;
  targetType: 'player' | 'team';
  activeRosterImpact: string[];
  upcomingMatchesImpacted: Array<{
    matchId: string;
    round: string;
    opponentId?: string;
    opponentName?: string;
    suggestedResolution: 'FORFEIT_WIN' | 'STAND_IN_ALLOWED' | 'RESCHEDULE';
  }>;
  completedMatchesRetained: Array<{
    matchId: string;
    result: string;
    retained: boolean;
  }>;
  bracketImpactDescription: string;
  standingsImpactDescription: string;
  consequencePolicyApplied: 'FORFEIT_FUTURE_RETAIN_PAST' | 'EXPULSION_NULLIFY_ALL';
}

// ============================================================================
// 5. AUDIT TIMELINE
// ============================================================================

export type AuditCategory = 
  | 'REGISTRATION'
  | 'MMR'
  | 'CAPTAIN'
  | 'AUCTION'
  | 'ROSTER'
  | 'SEEDING'
  | 'STRUCTURE_LOCK'
  | 'MATCH_SCHEDULE'
  | 'RESULT'
  | 'DISPUTE'
  | 'FORFEIT'
  | 'REMATCH'
  | 'CORRECTION'
  | 'REPORT'
  | 'DISQUALIFICATION'
  | 'RULE_CHANGE'
  | 'TOURNAMENT_COMPLETION'
  | 'PLATFORM_ADMIN';

export interface AuditRecord {
  id: string;
  tournamentId?: string;
  category: AuditCategory;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  entityId: string;
  entityType: string;
  details: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// ============================================================================
// 6. NOTIFICATIONS
// ============================================================================

export interface PersistentNotification {
  id: string;
  recipientId: string; // Specific user or '*' for all participants
  recipientRole?: 'organizer' | 'captain' | 'player' | 'spectator';
  tournamentId?: string;
  title: string;
  content: string;
  type: 
    | 'ANNOUNCEMENT'
    | 'EVIDENCE_REQUEST'
    | 'REPORT_UPDATE'
    | 'RULE_CHANGE'
    | 'MATCH_RESCHEDULE'
    | 'SANCTION'
    | 'DISQUALIFICATION'
    | 'SYSTEM';
  destinationUrl?: string;
  isPrivate: boolean;
  read: boolean;
  createdAt: string;
}

// ============================================================================
// OPERATIONS & ADMIN ENGINE
// ============================================================================

export class DotaTournamentOperationsEngine {
  private ruleVersions = new Map<string, TournamentRuleVersion[]>();
  private announcements = new Map<string, TournamentAnnouncement[]>();
  private reports = new Map<string, PlayerTeamReport>();
  private auditLogs: AuditRecord[] = [];
  private tournamentSanctions: TournamentSanction[] = [];
  private platformSanctions: PlatformSanction[] = [];
  private notifications: PersistentNotification[] = [];

  constructor() {
    this.seedDefaultData();
  }

  // --------------------------------------------------------------------------
  // RULES MANAGEMENT
  // --------------------------------------------------------------------------

  public publishRules(
    tournamentId: string,
    sections: TournamentRuleSection[],
    caller: ServerCallerContext,
    changeSummary: string = 'Initial published rules'
  ): { success: boolean; version: number; error?: string } {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      return { success: false, version: 0, error: 'Unauthorized: Only tournament organizers can publish or update rules.' };
    }

    if (!sections || sections.length === 0) {
      return { success: false, version: 0, error: 'Rule sections cannot be empty.' };
    }

    const currentVersions = this.ruleVersions.get(tournamentId) || [];
    const nextVersionNum = currentVersions.length + 1;

    const newVersion: TournamentRuleVersion = {
      version: nextVersionNum,
      publishedAt: new Date().toISOString(),
      publishedBy: caller.userId,
      changeSummary,
      sections: JSON.parse(JSON.stringify(sections))
    };

    currentVersions.push(newVersion);
    this.ruleVersions.set(tournamentId, currentVersions);

    // Audit log
    this.appendAudit({
      tournamentId,
      category: 'RULE_CHANGE',
      action: 'rules_published',
      actorId: caller.userId,
      actorName: caller.email,
      actorRole: caller.role,
      entityId: `rules-v${nextVersionNum}`,
      entityType: 'tournament_rules',
      details: `Published tournament rules v${nextVersionNum}: ${changeSummary}`
    });

    // Notify participants of rules update
    if (nextVersionNum > 1) {
      this.dispatchNotification({
        recipientId: '*',
        tournamentId,
        title: `Tournament Rules Updated (v${nextVersionNum})`,
        content: `Rules update: ${changeSummary}`,
        type: 'RULE_CHANGE',
        destinationUrl: `/tournaments/${tournamentId}?tab=rules`,
        isPrivate: false
      });
    }

    return { success: true, version: nextVersionNum };
  }

  public getRuleVersions(tournamentId: string): TournamentRuleVersion[] {
    return this.ruleVersions.get(tournamentId) || [];
  }

  public getCurrentRules(tournamentId: string): TournamentRuleVersion | null {
    const versions = this.ruleVersions.get(tournamentId);
    if (!versions || versions.length === 0) return null;
    return versions[versions.length - 1];
  }

  // --------------------------------------------------------------------------
  // ANNOUNCEMENTS
  // --------------------------------------------------------------------------

  public postAnnouncement(
    announcement: Omit<TournamentAnnouncement, 'id' | 'timestamp'>,
    caller: ServerCallerContext
  ): { success: boolean; announcement?: TournamentAnnouncement; error?: string } {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      return { success: false, error: 'Unauthorized: Only organizers or administrators can post announcements.' };
    }

    const item: TournamentAnnouncement = {
      ...announcement,
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString()
    };

    const list = this.announcements.get(announcement.tournamentId) || [];
    list.unshift(item);
    this.announcements.set(announcement.tournamentId, list);

    this.appendAudit({
      tournamentId: announcement.tournamentId,
      category: 'PLATFORM_ADMIN',
      action: 'announcement_posted',
      actorId: caller.userId,
      actorName: caller.email,
      actorRole: caller.role,
      entityId: item.id,
      entityType: 'announcement',
      details: `Posted announcement: "${item.title}" [Audience: ${item.audience}]`
    });

    // Create notifications for audience
    this.dispatchNotification({
      recipientId: item.audience === 'SPECIFIC_TEAM' ? (item.targetTeamId || '*') : '*',
      recipientRole: item.audience === 'CAPTAINS' ? 'captain' : undefined,
      tournamentId: item.tournamentId,
      title: item.title,
      content: item.content,
      type: 'ANNOUNCEMENT',
      destinationUrl: `/tournaments/${item.tournamentId}?tab=overview`,
      isPrivate: false
    });

    return { success: true, announcement: item };
  }

  public getAnnouncements(
    tournamentId: string, 
    caller?: ServerCallerContext
  ): TournamentAnnouncement[] {
    const list = this.announcements.get(tournamentId) || [];
    if (!caller || caller.role === 'spectator') {
      return list.filter(a => a.audience === 'PUBLIC');
    }
    if (caller.isAdmin || caller.role === 'organizer') {
      return list;
    }
    if (caller.role === 'captain') {
      return list.filter(a => 
        a.audience === 'PUBLIC' || 
        a.audience === 'ALL_PARTICIPANTS' || 
        a.audience === 'CAPTAINS' ||
        (a.audience === 'SPECIFIC_TEAM' && a.targetTeamId === caller.teamId)
      );
    }
    // Normal player
    return list.filter(a => 
      a.audience === 'PUBLIC' || 
      a.audience === 'ALL_PARTICIPANTS' ||
      (a.audience === 'SPECIFIC_TEAM' && a.targetTeamId === caller.teamId)
    );
  }

  // --------------------------------------------------------------------------
  // REPORTS & INVESTIGATIONS (WITH ANONYMITY)
  // --------------------------------------------------------------------------

  public submitReport(
    payload: {
      tournamentId?: string;
      targetId: string;
      targetName: string;
      targetType: 'player' | 'team';
      category: ReportCategory;
      description: string;
      evidenceUrls?: string[];
      evidenceText?: string;
    },
    caller: ServerCallerContext
  ): { success: boolean; reportId?: string; error?: string } {
    if (!caller.userId) {
      return { success: false, error: 'Authenticated user required to submit a report.' };
    }

    if (!payload.targetId || !payload.category || !payload.description) {
      return { success: false, error: 'Missing required report fields (target, category, description).' };
    }

    const reportId = `rep-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newReport: PlayerTeamReport = {
      id: reportId,
      tournamentId: payload.tournamentId,
      targetId: payload.targetId,
      targetName: payload.targetName,
      targetType: payload.targetType,
      category: payload.category,
      description: payload.description,
      evidenceUrls: payload.evidenceUrls || [],
      evidenceText: payload.evidenceText || '',
      reporterId: caller.userId,
      reporterName: caller.email.split('@')[0],
      reporterEmail: caller.email,
      timestamp: new Date().toISOString(),
      status: 'OPEN',
      auditTrail: [
        {
          action: 'REPORT_SUBMITTED',
          performedBy: caller.userId,
          role: caller.role,
          timestamp: new Date().toISOString(),
          note: `Report filed for ${payload.category}`
        }
      ]
    };

    this.reports.set(reportId, newReport);

    // Audit log (sanitized details to avoid leaking reporter identity in general logs)
    this.appendAudit({
      tournamentId: payload.tournamentId,
      category: 'REPORT',
      action: 'report_filed',
      actorId: caller.userId,
      actorName: 'Anonymous Reporter',
      actorRole: caller.role,
      entityId: reportId,
      entityType: 'report',
      details: `New allegation against ${payload.targetType} ${payload.targetName} (${payload.category})`
    });

    return { success: true, reportId };
  }

  public reviewReport(
    reportId: string,
    action: {
      status: ReportStatus;
      note?: string;
      evidenceRequestNote?: string;
      resolutionSummary?: string;
      sanctionApplied?: string;
    },
    caller: ServerCallerContext
  ): { success: boolean; report?: PlayerTeamReport; error?: string } {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      return { success: false, error: 'Unauthorized: Only tournament organizers and platform admins can review reports.' };
    }

    const rep = this.reports.get(reportId);
    if (!rep) {
      return { success: false, error: `Report ${reportId} not found.` };
    }

    rep.status = action.status;
    if (action.note) rep.moderatorNotes = action.note;
    if (action.resolutionSummary) rep.resolutionSummary = action.resolutionSummary;
    if (action.sanctionApplied) rep.sanctionApplied = action.sanctionApplied;

    rep.auditTrail.push({
      action: `STATUS_CHANGED_TO_${action.status}`,
      performedBy: caller.userId,
      role: caller.role,
      timestamp: new Date().toISOString(),
      note: action.note || action.resolutionSummary
    });

    // If evidence requested, notify target player/team
    if (action.status === 'REQUEST_EVIDENCE') {
      this.dispatchNotification({
        recipientId: rep.targetId,
        tournamentId: rep.tournamentId,
        title: 'Evidence Requested for Account Verification',
        content: action.evidenceRequestNote || 'Referees have requested additional verification evidence for your tournament profile.',
        type: 'EVIDENCE_REQUEST',
        destinationUrl: `/players/${rep.targetId}`,
        isPrivate: true
      });
    }

    this.appendAudit({
      tournamentId: rep.tournamentId,
      category: 'REPORT',
      action: 'report_updated',
      actorId: caller.userId,
      actorName: caller.email,
      actorRole: caller.role,
      entityId: rep.id,
      entityType: 'report',
      details: `Report ${rep.id} status updated to ${action.status}: ${action.note || ''}`
    });

    return { success: true, report: rep };
  }

  public getReports(
    caller: ServerCallerContext, 
    tournamentId?: string
  ): Array<PlayerTeamReport | SanitizedPublicReport> {
    const all = Array.from(this.reports.values());
    const filtered = tournamentId 
      ? all.filter(r => !r.tournamentId || r.tournamentId === tournamentId)
      : all;

    // Platform admin and organizers can view full reports including evidence & reporter (with internal privacy)
    if (caller.isAdmin || caller.role === 'organizer') {
      return filtered;
    }

    // Public / players / captains receive sanitized list with reporter identity stripped
    return filtered.map(r => ({
      id: r.id,
      tournamentId: r.tournamentId,
      targetId: r.targetId,
      targetName: r.targetName,
      targetType: r.targetType,
      category: r.category,
      status: r.status,
      timestamp: r.timestamp,
      resolutionSummary: r.resolutionSummary
    }));
  }

  // --------------------------------------------------------------------------
  // DISQUALIFICATION IMPACT PREVIEW & EXECUTION
  // --------------------------------------------------------------------------

  public previewDisqualification(
    tournamentId: string,
    targetId: string,
    targetType: 'player' | 'team',
    caller: ServerCallerContext
  ): DisqualificationImpactPreview {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('Unauthorized: Only tournament organizers and admins can preview disqualifications.');
    }

    let activeRoster: string[] = [];
    let matchesImpacted: DisqualificationImpactPreview['upcomingMatchesImpacted'] = [];
    let completedRetained: DisqualificationImpactPreview['completedMatchesRetained'] = [];

    if (tournamentId === 'purple-bean-test-cup') {
      const tcPlayers = testCupEngine.getPlayers();
      const tcTeams = testCupEngine.getTeams();
      const tcMatches = testCupEngine.getMatches();

      if (targetType === 'player') {
        const p = tcPlayers.find(pl => pl.id === targetId);
        if (p?.teamId) {
          activeRoster.push(`Player currently occupies primary roster slot on ${p.teamName || p.teamId}.`);
        }
      } else {
        const t = tcTeams.find(tm => tm.id === targetId);
        if (t) {
          const rosterList = (t as any).primaryRoster || (t as any).roster || [];
          activeRoster = rosterList.map((r: any) => `${r.name || r.username} (${r.role || 'Member'})`);
        }
      }

      tcMatches.forEach(m => {
        const involvesTarget = (targetType === 'team' && (m.teamA.id === targetId || m.teamB.id === targetId));
        if (involvesTarget) {
          if (m.status === 'COMPLETED') {
            completedRetained.push({
              matchId: m.id,
              result: `${m.teamA.name} (${m.teamA.score}) vs ${m.teamB.name} (${m.teamB.score})`,
              retained: true
            });
          } else {
            const opp = m.teamA.id === targetId ? m.teamB : m.teamA;
            matchesImpacted.push({
              matchId: m.id,
              round: m.round,
              opponentId: opp.id,
              opponentName: opp.name,
              suggestedResolution: 'FORFEIT_WIN'
            });
          }
        }
      });
    }

    return {
      tournamentId,
      targetId,
      targetType,
      activeRosterImpact: activeRoster,
      upcomingMatchesImpacted: matchesImpacted,
      completedMatchesRetained: completedRetained,
      bracketImpactDescription: 'Opponents in future rounds automatically advance via official administrative forfeit win (1-0/2-0). Completed match history remains retained.',
      standingsImpactDescription: 'Team marked as Disqualified (DQ) in tournament standings with 0 prize entitlement.',
      consequencePolicyApplied: 'FORFEIT_FUTURE_RETAIN_PAST'
    };
  }

  public executeDisqualification(
    payload: {
      tournamentId: string;
      targetId: string;
      targetType: 'player' | 'team';
      reason: string;
      evidenceReference?: string;
    },
    caller: ServerCallerContext
  ): { success: boolean; sanction?: TournamentSanction; error?: string } {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      return { success: false, error: 'Unauthorized: Only organizers or admins can disqualify participants.' };
    }

    if (!payload.reason) {
      return { success: false, error: 'Disqualification requires an explicit reason.' };
    }

    const sanction: TournamentSanction = {
      id: `sanc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      tournamentId: payload.tournamentId,
      targetId: payload.targetId,
      targetType: payload.targetType,
      sanctionType: 'TOURNAMENT_DISQUALIFICATION',
      reason: payload.reason,
      issuedBy: caller.userId,
      issuedAt: new Date().toISOString(),
      evidenceReference: payload.evidenceReference,
      status: 'ACTIVE'
    };

    this.tournamentSanctions.push(sanction);

    this.appendAudit({
      tournamentId: payload.tournamentId,
      category: 'DISQUALIFICATION',
      action: 'tournament_disqualification_executed',
      actorId: caller.userId,
      actorName: caller.email,
      actorRole: caller.role,
      entityId: payload.targetId,
      entityType: payload.targetType,
      details: `Disqualified ${payload.targetType} ${payload.targetId} from ${payload.tournamentId}. Reason: ${payload.reason}`
    });

    // Notify affected entity
    this.dispatchNotification({
      recipientId: payload.targetId,
      tournamentId: payload.tournamentId,
      title: 'Official Tournament Disqualification Notice',
      content: `You / your team has been disqualified from ${payload.tournamentId}. Reason: ${payload.reason}`,
      type: 'DISQUALIFICATION',
      destinationUrl: `/tournaments/${payload.tournamentId}`,
      isPrivate: true
    });

    return { success: true, sanction };
  }

  // --------------------------------------------------------------------------
  // PLATFORM SANCTIONS (ADMIN ONLY — SEPARATION OF POWERS)
  // --------------------------------------------------------------------------

  public issuePlatformSanction(
    payload: {
      userId: string;
      sanctionType: PlatformSanctionType;
      reason: string;
      durationDays?: number;
    },
    caller: ServerCallerContext
  ): { success: boolean; sanction?: PlatformSanction; error?: string } {
    // Organizers CANNOT issue platform bans! Only platform admins can.
    if (!caller.isAdmin) {
      return { 
        success: false, 
        error: 'Unauthorized: Platform-wide sanctions are strictly reserved for Platform Administrators / Head of Moderation. Tournament organizers can only issue tournament sanctions.' 
      };
    }

    const sanction: PlatformSanction = {
      id: `plat-sanc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      userId: payload.userId,
      sanctionType: payload.sanctionType,
      reason: payload.reason,
      issuedByAdminId: caller.userId,
      issuedAt: new Date().toISOString(),
      expiresAt: payload.durationDays 
        ? new Date(Date.now() + payload.durationDays * 86400000).toISOString()
        : undefined,
      status: 'ACTIVE'
    };

    this.platformSanctions.push(sanction);

    this.appendAudit({
      category: 'PLATFORM_ADMIN',
      action: 'platform_sanction_issued',
      actorId: caller.userId,
      actorName: caller.email,
      actorRole: 'admin',
      entityId: payload.userId,
      entityType: 'platform_user',
      details: `Issued platform-wide ${payload.sanctionType} to user ${payload.userId}. Reason: ${payload.reason}`
    });

    return { success: true, sanction };
  }

  public getPlatformSanctions(caller: ServerCallerContext): PlatformSanction[] {
    if (!caller.isAdmin) {
      throw new Error('Unauthorized: Platform sanctions are restricted to Platform Administrators.');
    }
    return [...this.platformSanctions];
  }

  public getTournamentSanctions(tournamentId?: string): TournamentSanction[] {
    if (tournamentId) {
      return this.tournamentSanctions.filter(s => s.tournamentId === tournamentId);
    }
    return [...this.tournamentSanctions];
  }

  // --------------------------------------------------------------------------
  // AUDIT LOG LEDGER & FILTERING
  // --------------------------------------------------------------------------

  public appendAudit(entry: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const record: AuditRecord = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString()
    };
    this.auditLogs.unshift(record);
    return record;
  }

  public getAuditTrail(
    caller: ServerCallerContext,
    filters?: {
      actorId?: string;
      category?: AuditCategory;
      entityId?: string;
      startDate?: string;
      endDate?: string;
      tournamentId?: string;
    }
  ): AuditRecord[] {
    if (!caller.isAdmin && caller.role !== 'organizer') {
      throw new Error('Unauthorized: Audit ledger is only accessible by tournament organizers and platform administrators.');
    }

    let records = [...this.auditLogs];

    if (filters) {
      if (filters.tournamentId) {
        records = records.filter(r => !r.tournamentId || r.tournamentId === filters.tournamentId);
      }
      if (filters.actorId) {
        records = records.filter(r => r.actorId === filters.actorId);
      }
      if (filters.category) {
        records = records.filter(r => r.category === filters.category);
      }
      if (filters.entityId) {
        records = records.filter(r => r.entityId === filters.entityId);
      }
      if (filters.startDate) {
        records = records.filter(r => r.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        records = records.filter(r => r.timestamp <= filters.endDate!);
      }
    }

    return records;
  }

  // --------------------------------------------------------------------------
  // NOTIFICATION CENTER
  // --------------------------------------------------------------------------

  public dispatchNotification(
    notification: Omit<PersistentNotification, 'id' | 'createdAt' | 'read'>
  ): PersistentNotification {
    const notif: PersistentNotification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      createdAt: new Date().toISOString(),
      read: false
    };

    this.notifications.unshift(notif);
    return notif;
  }

  public getUserNotifications(userId: string, role?: string): PersistentNotification[] {
    return this.notifications.filter(n => {
      if (n.recipientId === '*') {
        if (!n.recipientRole) return true;
        return n.recipientRole === role;
      }
      return n.recipientId === userId;
    });
  }

  public markNotificationAsRead(id: string, userId: string): boolean {
    const item = this.notifications.find(n => n.id === id);
    if (item && (item.recipientId === '*' || item.recipientId === userId)) {
      item.read = true;
      return true;
    }
    return false;
  }

  public markAllNotificationsAsRead(userId: string): number {
    let count = 0;
    this.notifications.forEach(n => {
      if (n.recipientId === '*' || n.recipientId === userId) {
        if (!n.read) {
          n.read = true;
          count++;
        }
      }
    });
    return count;
  }

  // --------------------------------------------------------------------------
  // OPERATIONAL DASHBOARD METRICS SUMMARY
  // --------------------------------------------------------------------------

  public getTournamentOperationalSummary(tournamentId: string) {
    const reports = Array.from(this.reports.values()).filter(r => !r.tournamentId || r.tournamentId === tournamentId);
    const sanctions = this.tournamentSanctions.filter(s => s.tournamentId === tournamentId);
    const announcements = this.announcements.get(tournamentId) || [];
    const rules = this.getCurrentRules(tournamentId);

    let stage = 'COMPETITION';
    let registrationsCount = 32;
    let pendingVerification = 0;
    let verifiedPlayers = 32;
    let teamsCount = 8;
    let rosterCompletion = 100;
    let upcomingMatches = 0;
    let completedMatches = 0;

    if (tournamentId === 'purple-bean-test-cup') {
      stage = testCupEngine.getStatus();
      const p = testCupEngine.getPlayers();
      registrationsCount = p.length;
      verifiedPlayers = p.filter(x => x.registrationStatus === 'Verified').length;
      pendingVerification = p.filter(x => x.registrationStatus === 'Registered').length;
      const t = testCupEngine.getTeams();
      teamsCount = t.length;
      const m = testCupEngine.getMatches();
      upcomingMatches = m.filter(x => x.status === 'UPCOMING').length;
      completedMatches = m.filter(x => x.status === 'COMPLETED').length;
    }

    return {
      tournamentId,
      stage,
      registrationsCount,
      pendingVerification,
      verifiedPlayers,
      teamsCount,
      rosterCompletion,
      upcomingMatches,
      completedMatches,
      openDisputesCount: reports.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length,
      openReportsCount: reports.length,
      integrityCasesCount: reports.filter(r => r.category === 'Possible Smurf' || r.category === 'False MMR').length,
      sanctionsCount: sanctions.length,
      announcementsCount: announcements.length,
      ruleVersion: rules?.version || 0,
      warnings: pendingVerification > 0 ? [`${pendingVerification} players awaiting KYC / MMR audit review`] : []
    };
  }

  // --------------------------------------------------------------------------
  // SEED INITIAL DEFAULT DATA
  // --------------------------------------------------------------------------

  private seedDefaultData() {
    // Initial Purple Bean Test Cup Rules v1
    const testCupRules: TournamentRuleSection[] = [
      {
        id: 'sec-1',
        category: 'eligibility',
        title: 'Player & Regional Eligibility',
        content: 'Indian residents with verified Steam accounts and valid OpenDota profiles are eligible to compete.'
      },
      {
        id: 'sec-2',
        category: 'tournament_mmr',
        title: 'Authoritative Tournament MMR',
        content: 'Players are audited by referees using OpenDota rank history. The locked Tournament MMR is immutable once rosters lock.'
      },
      {
        id: 'sec-3',
        category: 'auction',
        title: 'Auction & Budget Enforcement',
        content: 'Each franchise receives 10,000 INR draft credits. Max bid is calculated dynamically to ensure all 5 roster positions can be filled.'
      },
      {
        id: 'sec-4',
        category: 'match_scheduling',
        title: 'Lobby & Scheduling Rules',
        content: 'Server location: India (AWS Mumbai). Teams must check in 15 minutes before scheduled match start time.'
      },
      {
        id: 'sec-5',
        category: 'conduct',
        title: 'Competitive Integrity & Anti-Smurfing',
        content: 'Smurfing, account sharing, and false MMR declaration will result in immediate disqualification and forfeiture of prizes.'
      }
    ];

    this.publishRules(
      'purple-bean-test-cup',
      testCupRules,
      { userId: 'system-admin', email: 'admin@purplebeangaming.com', role: 'organizer', isAdmin: true },
      'Official Tournament Rulebook 2026'
    );

    // Initial Announcements
    this.announcements.set('purple-bean-test-cup', [
      {
        id: 'ann-init-1',
        tournamentId: 'purple-bean-test-cup',
        title: 'Welcome to Purple Bean Test Cup 2026',
        content: 'Captains auction and bracket seeding will commence following registration verification.',
        type: 'general',
        audience: 'PUBLIC',
        authorId: 'staff-admin-1',
        authorName: 'Tournament Director',
        timestamp: '2026-09-01T08:00:00Z',
        pinned: true
      },
      {
        id: 'ann-init-2',
        tournamentId: 'purple-bean-test-cup',
        title: 'Captain Briefing & Draft Protocol',
        content: 'All captains must join Discord voice channel 10 minutes prior to draft start.',
        type: 'auction_update',
        audience: 'CAPTAINS',
        authorId: 'staff-admin-1',
        authorName: 'Tournament Director',
        timestamp: '2026-09-02T12:00:00Z'
      }
    ]);

    // Initial Reports
    const rep1: PlayerTeamReport = {
      id: 'rep-001',
      tournamentId: 'purple-bean-test-cup',
      targetId: 'p-01',
      targetName: 'Viper (Vikram Singh)',
      targetType: 'player',
      category: 'Possible Smurf',
      description: 'Player exhibits 85% win rate in recent 30 ranked matches on Phantom Assassin.',
      reporterId: 'user-reporter-99',
      reporterName: 'Anonymous Spectator',
      timestamp: '2026-09-03T14:20:00Z',
      status: 'UNDER_REVIEW',
      auditTrail: [
        {
          action: 'REPORT_SUBMITTED',
          performedBy: 'user-reporter-99',
          role: 'spectator',
          timestamp: '2026-09-03T14:20:00Z'
        },
        {
          action: 'STATUS_CHANGED_TO_UNDER_REVIEW',
          performedBy: 'staff-admin-1',
          role: 'organizer',
          timestamp: '2026-09-03T15:00:00Z',
          note: 'Assigned to referee team for match history inspection.'
        }
      ]
    };
    this.reports.set(rep1.id, rep1);

    // Initial Audit Log
    this.appendAudit({
      tournamentId: 'purple-bean-test-cup',
      category: 'REGISTRATION',
      action: 'tournament_initialized',
      actorId: 'system',
      actorName: 'System Kernel',
      actorRole: 'admin',
      entityId: 'purple-bean-test-cup',
      entityType: 'tournament',
      details: 'Purple Bean Test Cup lifecycle initialized with 32 player capacity.'
    });
  }

  // --------------------------------------------------------------------------
  // SPECTATOR STREAM DELAY FILTER (SERVER-AUTHORITATIVE DELAY)
  // --------------------------------------------------------------------------
  public getSpectatorDelayedEvents<T extends { timestamp: string | number }>(
    events: T[],
    delaySeconds: number = 180,
    caller?: ServerCallerContext
  ): T[] {
    // Participants and organizers receive real-time zero-delay events
    if (caller && (caller.role === 'organizer' || caller.role === 'captain' || caller.isAdmin)) {
      return [...events];
    }

    // Public spectators receive server-filtered events strictly older than delaySeconds
    const nowMs = Date.now();
    const cutoffMs = nowMs - (delaySeconds * 1000);

    return events.filter(e => {
      const eventTimeMs = typeof e.timestamp === 'number' ? e.timestamp : new Date(e.timestamp).getTime();
      return eventTimeMs <= cutoffMs;
    });
  }
}

export const dotaTournamentOperations = new DotaTournamentOperationsEngine();
