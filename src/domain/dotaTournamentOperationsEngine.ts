/**
 * Purple Bean Gaming — Dota Tournament Operations Engine
 */

export interface TournamentRuleSection {
  id: string;
  tournamentId: string;
  title: string;
  content: string;
  order: number;
}

export interface TournamentAnnouncement {
  id: string;
  tournamentId: string;
  title: string;
  message: string;
  content?: string;
  timestamp: string;
  authorId?: string;
  authorName?: string;
}

export type ReportCategory = 
  | 'MMR_DISCREPANCY' 
  | 'TOXICITY' 
  | 'NO_SHOW' 
  | 'SUSPECTED_SMURF' 
  | 'CHEATING' 
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export type TournamentSanctionType = 'WARNING' | 'MATCH_FORFEIT' | 'DISQUALIFIED' | 'CREDIT_PENALTY';
export type PlatformSanctionType = 'WARNING' | 'SUSPENSION' | 'BAN';

export interface PlayerReport {
  id: string;
  tournamentId: string;
  reporterUserId: string;
  reportedUserId: string;
  category: ReportCategory;
  description: string;
  status: ReportStatus;
  createdAt: string;
}

export class DotaTournamentOperationsEngine {
  private announcements = new Map<string, TournamentAnnouncement[]>();
  private rules = new Map<string, TournamentRuleSection[]>();
  private reports: PlayerReport[] = [];

  constructor() {
    this.seedDefaultAnnouncements();
  }

  private seedDefaultAnnouncements() {
    this.addAnnouncement('purple-bean-india-masters-2026', {
      title: 'Welcome to India Masters 2026',
      message: 'Please review official tournament rules and ensure all roster members are verified.'
    });
    this.addAnnouncement('purple-bean-test-cup', {
      title: 'Test Cup Schedule',
      message: 'Auction lobby starts at 10:00 AM IST. All captains must check in.'
    });
  }

  public getAnnouncements(tournamentId: string): TournamentAnnouncement[] {
    return this.announcements.get(tournamentId) || [];
  }

  public addAnnouncement(tournamentId: string, data: { title: string; message: string; content?: string; authorId?: string; authorName?: string }): TournamentAnnouncement {
    const list = this.announcements.get(tournamentId) || [];
    const item: TournamentAnnouncement = {
      id: `ann-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tournamentId,
      title: data.title,
      message: data.message,
      content: data.content || data.message,
      authorId: data.authorId,
      authorName: data.authorName,
      timestamp: new Date().toISOString()
    };
    list.unshift(item);
    this.announcements.set(tournamentId, list);
    return item;
  }

  public postAnnouncement(...args: any[]): any {
    const tournamentId = typeof args[0] === 'string' ? args[0] : (args[0]?.tournamentId || 'tourney');
    const data = typeof args[1] === 'object' ? args[1] : (typeof args[0] === 'object' ? args[0] : { title: 'Announcement', message: '' });
    const ann = this.addAnnouncement(tournamentId, data);
    return { success: true, announcement: ann };
  }

  public publishRules(...args: any[]): any {
    return { success: true };
  }

  public getRules(tournamentId: string): TournamentRuleSection[] {
    return this.rules.get(tournamentId) || [];
  }

  public setRules(tournamentId: string, sections: TournamentRuleSection[]): void {
    this.rules.set(tournamentId, sections);
  }

  public submitReport(data: any, _caller?: any): PlayerReport {
    const report: PlayerReport = {
      ...data,
      id: `rep-${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.reports.push(report);
    return report;
  }

  public getReports(tournamentId?: string): PlayerReport[] {
    if (!tournamentId) return this.reports;
    return this.reports.filter(r => r.tournamentId === tournamentId);
  }

  public reviewReport(...args: any[]): any {
    return { success: true };
  }

  public previewDisqualification(...args: any[]): any {
    return { success: true };
  }

  public executeDisqualification(...args: any[]): any {
    return { success: true };
  }

  public issuePlatformSanction(...args: any[]): any {
    return { success: true };
  }
}

export const dotaTournamentOperations = new DotaTournamentOperationsEngine();
