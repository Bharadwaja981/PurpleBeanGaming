/**
 * Purple Bean Gaming — Generic Configurable Tournament Engine
 */

import { TournamentConfig } from './tournamentConfig';
import { GenericCompetitionEngine, CompetitionStructure, CompetitionTeam, CompetitionMatch } from './genericCompetitionEngine';

export class GenericTournamentEngine {
  private config: TournamentConfig;
  private currentStage = 'REGISTRATION_OPEN';
  private teams: CompetitionTeam[] = [];
  private applications: any[] = [];
  private structure: CompetitionStructure | null = null;
  private auditTrail: any[] = [];

  constructor(config: TournamentConfig) {
    this.config = config;
  }

  public getConfig(): TournamentConfig {
    return this.config;
  }

  public getCurrentStage(): string {
    return this.currentStage;
  }

  public submitPremadeTeam(
    teamName: string,
    tag: string,
    logo: string,
    homeCity?: string,
    managerOrCaptainId?: string,
    managerEmail?: string,
    roster?: any[],
    substitutes?: any[]
  ): { success: boolean; application?: any } {
    const application = {
      id: `app-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      teamName,
      tag,
      logo,
      homeCity,
      managerOrCaptainId,
      managerEmail,
      roster: roster || [],
      substitutes: substitutes || [],
      status: 'PENDING_REVIEW'
    };
    this.applications.push(application);
    this.auditTrail.push({
      action: 'premade_team_submitted',
      details: `Team ${teamName} submitted premade application.`,
      timestamp: new Date().toISOString()
    });
    return { success: true, application };
  }

  public reviewPremadeTeam(applicationId: string, status: 'APPROVED' | 'REJECTED' | string, notes?: string): { success: boolean } {
    const app = this.applications.find(a => a.id === applicationId);
    if (!app) return { success: false };
    app.status = status;
    if (status === 'APPROVED') {
      this.teams.push({
        id: `team-${app.id}`,
        name: app.teamName,
        tag: app.tag,
        logo: app.logo,
        rating: 1500
      });
    }
    this.auditTrail.push({
      action: `premade_team_${status.toLowerCase()}`,
      details: `Team application ${applicationId} ${status}. ${notes || ''}`,
      timestamp: new Date().toISOString()
    });
    return { success: true };
  }

  public getPremadeApplications(): any[] {
    return this.applications;
  }

  public registerTeam(team: CompetitionTeam): void {
    if (!this.teams.some(t => t.id === team.id)) {
      this.teams.push(team);
    }
  }

  public generateTournamentStructure(): CompetitionStructure {
    return this.generateCompetition();
  }

  public getTeams(): CompetitionTeam[] {
    return this.teams;
  }

  public getMatches(): CompetitionMatch[] {
    return this.structure?.allMatches || [];
  }

  public getAuditTrail(): any[] {
    return this.auditTrail;
  }

  public completeTournament(...args: any[]): void {
    this.currentStage = 'COMPLETED';
    const first = this.teams.find(t => t.id === args[0]) || this.teams[0];
    if (first) {
      (first as any).placement = '1st Place (Champion)';
      (first as any).earningsINR = '₹50,000';
    }
    const second = this.teams.find(t => t.id === args[1]) || this.teams[1];
    if (second) {
      (second as any).placement = '2nd Place';
      (second as any).earningsINR = '₹30,000';
    }
    const third = this.teams.find(t => t.id === args[2]) || this.teams[2];
    if (third) {
      (third as any).placement = '3rd Place';
      (third as any).earningsINR = '₹20,000';
    }
    this.auditTrail.push({
      action: 'tournament_completed',
      details: `Tournament completed. Placements: ${args.join(', ')}`,
      timestamp: new Date().toISOString()
    });
  }

  public generateCompetition(): CompetitionStructure {
    this.structure = GenericCompetitionEngine.generateDoubleElimination(
      this.teams,
      this.config.identity.tournamentId
    );
    this.currentStage = 'COMPETITION';
    return this.structure;
  }

  public executeMatchResult(matchId: string, scoreA: number, scoreB: number): any {
    if (!this.structure) return { success: false };
    const match = this.structure.allMatches.find(m => m.id === matchId);
    if (!match) return { success: false };

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.status = 'COMPLETED';
    const winner = scoreA > scoreB ? match.teamA : match.teamB;
    const loser = scoreA > scoreB ? match.teamB : match.teamA;
    match.winner = winner;
    match.winnerId = winner?.id;
    match.loser = loser;

    // Check for Grand Final Reset in Double Elimination:
    // If GF1 is won by the Lower Bracket winner (teamB) defeating Upper Bracket winner (teamA),
    // and grandFinalResetEnabled is true, generate Grand Final Reset match.
    if (
      this.config.competition?.grandFinalResetEnabled &&
      match.round === 'Grand Final' &&
      winner?.id === match.teamB?.id
    ) {
      const resetMatch: any = {
        id: `match-gf-reset-${Date.now()}`,
        tournamentId: this.config.identity.tournamentId,
        round: 'Grand Final Reset',
        bracketType: 'FINAL',
        bracket: 'LOWER',
        teamA: match.teamA,
        teamB: match.teamB,
        status: 'UPCOMING',
        seriesFormat: (match as any).seriesFormat || 'BO3',
        bestOf: (match as any).bestOf || 3
      };
      this.structure.allMatches.push(resetMatch);
    }

    return {
      success: true,
      match,
      winner
    };
  }
}
