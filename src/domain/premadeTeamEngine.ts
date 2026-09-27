/**
 * Purple Bean Gaming — Premade Team Registration & Review Engine
 * 
 * Supports Model B tournament registration:
 * Entire teams register with full rosters, captain, roles, and substitutes.
 * Organizers review, approve, reject, or request correction on team applications.
 */

import { getGameDefinition } from './gameDefinitions';
import { TournamentConfig } from './tournamentConfig';

export interface PremadeRosterPlayer {
  id: string;
  inGameName: string;
  displayName: string;
  role: string;
  ratingOrMmr: number;
  isCaptain: boolean;
  isSubstitute: boolean;
}

export interface PremadeTeamApplication {
  id: string;
  tournamentId: string;
  teamName: string;
  tag: string;
  logo: string;
  homeCity: string;
  managerOrCaptainId: string;
  managerEmail: string;
  roster: PremadeRosterPlayer[];
  substitutes: PremadeRosterPlayer[];
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CORRECTION_NEEDED';
  organizerNotes?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export class PremadeTeamEngine {
  private applications = new Map<string, PremadeTeamApplication>();
  private auditLogs: Array<{ action: string; teamId: string; note: string; timestamp: string }> = [];

  /**
   * Validates a roster submission against the game and tournament configuration rules.
   */
  public static validateRoster(
    roster: PremadeRosterPlayer[],
    substitutes: PremadeRosterPlayer[],
    config: TournamentConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const gameDef = getGameDefinition(config.identity.gameId);

    const requiredPrimary = config.roster.primaryRosterSize;
    if (roster.length !== requiredPrimary) {
      errors.push(`Primary roster must contain exactly ${requiredPrimary} players (currently ${roster.length}).`);
    }

    // Captain check
    const captains = roster.filter(p => p.isCaptain);
    if (captains.length !== 1) {
      errors.push('The team roster must specify exactly one captain.');
    }

    // Duplicate check
    const allIds = [...roster, ...substitutes].map(p => p.id || p.inGameName.toLowerCase());
    const uniqueIds = new Set(allIds);
    if (uniqueIds.size !== allIds.length) {
      errors.push('A player cannot be registered multiple times in the same roster or as a substitute.');
    }

    // Substitutes check
    if (substitutes.length > config.roster.substituteSlots) {
      errors.push(`Team has ${substitutes.length} substitutes, but the maximum allowed is ${config.roster.substituteSlots}.`);
    }

    if (config.roster.substituteRequired && substitutes.length < 1) {
      errors.push('At least one substitute is mandatory for this tournament.');
    }

    // Role check against game definition
    roster.forEach(player => {
      if (!player.role || player.role.trim() === '') {
        errors.push(`Player ${player.inGameName} is missing an assigned role.`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Submits a premade team application for organizer review.
   */
  public submitTeam(
    application: Omit<PremadeTeamApplication, 'status' | 'submittedAt'>,
    config: TournamentConfig
  ): { success: boolean; application?: PremadeTeamApplication; errors?: string[] } {
    const validation = PremadeTeamEngine.validateRoster(application.roster, application.substitutes, config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const fullApp: PremadeTeamApplication = {
      ...application,
      status: 'PENDING_REVIEW',
      submittedAt: new Date().toISOString()
    };

    this.applications.set(fullApp.id, fullApp);
    this.logAudit('team_submitted', fullApp.id, `Application submitted for ${fullApp.teamName}`);

    return {
      success: true,
      application: fullApp
    };
  }

  /**
   * Organizer approves a premade team application.
   */
  public approveTeam(teamId: string, reviewerId = 'organiser-admin'): { success: boolean; error?: string } {
    const app = this.applications.get(teamId);
    if (!app) return { success: false, error: 'Team application not found.' };

    app.status = 'APPROVED';
    app.reviewedAt = new Date().toISOString();
    app.reviewedBy = reviewerId;

    this.logAudit('team_approved', teamId, `Approved by ${reviewerId}`);
    return { success: true };
  }

  /**
   * Organizer rejects a premade team application with reason.
   */
  public rejectTeam(teamId: string, reason: string, reviewerId = 'organiser-admin'): { success: boolean; error?: string } {
    const app = this.applications.get(teamId);
    if (!app) return { success: false, error: 'Team application not found.' };

    app.status = 'REJECTED';
    app.organizerNotes = reason;
    app.reviewedAt = new Date().toISOString();
    app.reviewedBy = reviewerId;

    this.logAudit('team_rejected', teamId, `Rejected by ${reviewerId}: ${reason}`);
    return { success: true };
  }

  /**
   * Organizer requests a correction (e.g. role adjustment, substitute change).
   */
  public requestCorrection(teamId: string, notes: string, reviewerId = 'organiser-admin'): { success: boolean; error?: string } {
    const app = this.applications.get(teamId);
    if (!app) return { success: false, error: 'Team application not found.' };

    app.status = 'CORRECTION_NEEDED';
    app.organizerNotes = notes;
    app.reviewedAt = new Date().toISOString();
    app.reviewedBy = reviewerId;

    this.logAudit('team_correction_requested', teamId, `Correction requested: ${notes}`);
    return { success: true };
  }

  public getApplication(teamId: string): PremadeTeamApplication | undefined {
    return this.applications.get(teamId);
  }

  public getApplicationsForTournament(tournamentId: string): PremadeTeamApplication[] {
    return Array.from(this.applications.values()).filter(a => a.tournamentId === tournamentId);
  }

  public getApprovedTeams(tournamentId: string): PremadeTeamApplication[] {
    return this.getApplicationsForTournament(tournamentId).filter(a => a.status === 'APPROVED');
  }

  private logAudit(action: string, teamId: string, note: string) {
    this.auditLogs.push({
      action,
      teamId,
      note,
      timestamp: new Date().toISOString()
    });
  }

  public getAuditLogs(): Array<{ action: string; teamId: string; note: string; timestamp: string }> {
    return [...this.auditLogs];
  }
}

export const premadeTeamEngine = new PremadeTeamEngine();
