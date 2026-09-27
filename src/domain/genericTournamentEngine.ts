/**
 * Purple Bean Gaming — Generic Configurable Tournament Engine
 * 
 * Reusable engine capable of operating any esports tournament:
 * Individual (Auction/Draft) or Premade Team,
 * Single Elimination, Double Elimination, Round Robin, Groups + Knockout.
 */

import { TournamentConfig, validateTournamentConfig, formatINR } from './tournamentConfig';
import { GenericCompetitionEngine, CompetitionTeam, CompetitionMatch, CompetitionStructure } from './genericCompetitionEngine';
import { GenericTournamentLifecycle, GenericLifecycleStage } from './genericTournamentLifecycle';
import { ratingLedger, RatingAdjustmentRecord } from './competitiveRatingEngine';
import { PremadeTeamApplication, PremadeTeamEngine, PremadeRosterPlayer } from './premadeTeamEngine';

export interface GenericPlayerParticipant {
  id: string;
  inGameName: string;
  displayName: string;
  avatar: string;
  city: string;
  region: string;
  rating: number;
  tournamentMmr: number;
  primaryRole: string;
  secondaryRole?: string;
  status: 'Registered' | 'Under Review' | 'Verified' | 'Rejected';
  isCaptain?: boolean;
  assignedTeamId?: string;
  draftStatus?: 'AVAILABLE' | 'NOMINATED' | 'SOLD' | 'UNSOLD' | 'UNSELECTED';
  draftPriceCredits?: number;
  isStandIn?: boolean;
}

export interface GenericTournamentTeam {
  id: string;
  name: string;
  tag: string;
  logo: string;
  captainId: string;
  captainName: string;
  city: string;
  creditsRemaining: number;
  creditsSpent: number;
  roster: GenericPlayerParticipant[];
  standIns: GenericPlayerParticipant[];
  rating: number;
  placement?: string;
  earningsINR?: string;
  seed?: number;
}

export class GenericTournamentEngine {
  private config: TournamentConfig;
  private currentStage: GenericLifecycleStage = 'DRAFT';
  private players: GenericPlayerParticipant[] = [];
  private teams: GenericTournamentTeam[] = [];
  private premadeApplications: PremadeTeamApplication[] = [];
  private competition: CompetitionStructure | null = null;
  private matches: CompetitionMatch[] = [];
  private auditTrail: Array<{ action: string; details: string; timestamp: string }> = [];
  private listeners: Array<() => void> = [];

  // Auction State (for individual auction tournaments)
  private auctionState = {
    revision: 1,
    currentBid: 10,
    leadingTeamId: '',
    leadingTeamName: '',
    nominee: null as GenericPlayerParticipant | null,
    soldCount: 0,
    unsoldCount: 0,
    unselectedCount: 0,
    isCompleted: false
  };

  constructor(config: TournamentConfig) {
    const val = validateTournamentConfig(config);
    if (!val.valid) {
      throw new Error(`Invalid tournament configuration: ${val.errors.join('; ')}`);
    }
    this.config = config;
    this.auctionState.currentBid = config.auction?.minimumBid || 10;
    this.currentStage = 'REGISTRATION_OPEN';
    this.logAudit('tournament_initialized', `Initialized "${config.identity.name}" for ${config.identity.gameName} (${config.registration.registrationMode} - ${config.teamFormation.mode})`);
  }

  public getConfig(): TournamentConfig {
    return this.config;
  }

  public getCurrentStage(): GenericLifecycleStage {
    return this.currentStage;
  }

  public getStages() {
    return GenericTournamentLifecycle.getStagesForConfig(this.config);
  }

  public setStage(targetStage: GenericLifecycleStage): { success: boolean; reason?: string } {
    const check = GenericTournamentLifecycle.validateTransition(this.currentStage, targetStage, this.config);
    if (!check.valid) {
      return { success: false, reason: check.reason };
    }

    const prev = this.currentStage;
    this.currentStage = targetStage;
    this.logAudit('stage_transition', `Transitioned stage from ${prev} to ${targetStage}`);
    this.notify();
    return { success: true };
  }

  // =========================================================================
  // PARTICIPANTS & REGISTRATION (INDIVIDUAL)
  // =========================================================================

  public registerPlayer(playerData: Omit<GenericPlayerParticipant, 'status' | 'draftStatus'>): GenericPlayerParticipant {
    if (this.currentStage !== 'REGISTRATION_OPEN') {
      throw new Error(`Cannot register players while tournament stage is '${this.currentStage}'. Must be REGISTRATION_OPEN.`);
    }

    const newPlayer: GenericPlayerParticipant = {
      ...playerData,
      status: this.config.integrity.verificationRequired ? 'Under Review' : 'Verified',
      draftStatus: 'AVAILABLE'
    };

    this.players.push(newPlayer);
    this.logAudit('player_registered', `Registered player ${newPlayer.inGameName} (${newPlayer.primaryRole})`);
    this.notify();
    return newPlayer;
  }

  public verifyPlayer(playerId: string, status: 'Verified' | 'Rejected'): void {
    const player = this.players.find(p => p.id === playerId);
    if (!player) throw new Error(`Player ${playerId} not found.`);

    player.status = status;
    player.draftStatus = status === 'Verified' ? 'AVAILABLE' : undefined;
    this.logAudit('player_verified', `Player ${player.inGameName} marked as ${status}`);
    this.notify();
  }

  public setAllPlayers(players: GenericPlayerParticipant[]): void {
    this.players = [...players];
    this.notify();
  }

  public getPlayers(): GenericPlayerParticipant[] {
    return [...this.players];
  }

  // =========================================================================
  // PREMADE TEAM REGISTRATION (MODEL B)
  // =========================================================================

  public submitPremadeTeam(
    teamName: string,
    tag: string,
    logo: string,
    city: string,
    managerOrCaptainId: string,
    managerEmail: string,
    roster: PremadeRosterPlayer[],
    substitutes: PremadeRosterPlayer[]
  ): { success: boolean; application?: PremadeTeamApplication; errors?: string[] } {
    if (this.config.registration.registrationMode !== 'PREMADE_TEAM') {
      return { success: false, errors: ['This tournament does not accept premade team registration.'] };
    }

    const validation = PremadeTeamEngine.validateRoster(roster, substitutes, this.config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const app: PremadeTeamApplication = {
      id: `premade-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tournamentId: this.config.identity.tournamentId,
      teamName,
      tag,
      logo,
      homeCity: city,
      managerOrCaptainId,
      managerEmail,
      roster,
      substitutes,
      status: 'PENDING_REVIEW',
      submittedAt: new Date().toISOString()
    };

    this.premadeApplications.push(app);
    this.logAudit('premade_team_submitted', `Submitted premade team application for ${teamName} (${roster.length} players)`);
    this.notify();
    return { success: true, application: app };
  }

  public reviewPremadeTeam(
    teamId: string,
    decision: 'APPROVED' | 'REJECTED' | 'CORRECTION_NEEDED',
    notes?: string
  ): { success: boolean; error?: string } {
    const app = this.premadeApplications.find(a => a.id === teamId);
    if (!app) return { success: false, error: 'Application not found.' };

    app.status = decision;
    app.organizerNotes = notes;
    app.reviewedAt = new Date().toISOString();

    if (decision === 'APPROVED') {
      // Build a GenericTournamentTeam record
      const captainPlayer = app.roster.find(p => p.isCaptain);
      const avgRating = Math.round(app.roster.reduce((sum, p) => sum + p.ratingOrMmr, 0) / app.roster.length);

      const teamRoster: GenericPlayerParticipant[] = app.roster.map(p => ({
        id: p.id,
        inGameName: p.inGameName,
        displayName: p.displayName,
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=200&q=80',
        city: app.homeCity,
        region: this.config.identity.region,
        rating: p.ratingOrMmr,
        tournamentMmr: p.ratingOrMmr,
        primaryRole: p.role,
        status: 'Verified',
        isCaptain: p.isCaptain,
        assignedTeamId: app.id
      }));

      const teamSubs: GenericPlayerParticipant[] = app.substitutes.map(p => ({
        id: p.id,
        inGameName: p.inGameName,
        displayName: p.displayName,
        avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=200&q=80',
        city: app.homeCity,
        region: this.config.identity.region,
        rating: p.ratingOrMmr,
        tournamentMmr: p.ratingOrMmr,
        primaryRole: p.role,
        status: 'Verified',
        isCaptain: false,
        isStandIn: true,
        assignedTeamId: app.id
      }));

      const newTeam: GenericTournamentTeam = {
        id: app.id,
        name: app.teamName,
        tag: app.tag,
        logo: app.logo,
        captainId: captainPlayer ? captainPlayer.id : app.managerOrCaptainId,
        captainName: captainPlayer ? captainPlayer.inGameName : 'Captain',
        city: app.homeCity,
        creditsRemaining: 0,
        creditsSpent: 0,
        roster: teamRoster,
        standIns: teamSubs,
        rating: avgRating
      };

      // Add to teams if not already present
      const existingIdx = this.teams.findIndex(t => t.id === app.id);
      if (existingIdx >= 0) {
        this.teams[existingIdx] = newTeam;
      } else {
        this.teams.push(newTeam);
      }
    }

    this.logAudit('premade_team_reviewed', `Team ${app.teamName} marked as ${decision}`);
    this.notify();
    return { success: true };
  }

  public getPremadeApplications(): PremadeTeamApplication[] {
    return [...this.premadeApplications];
  }

  // =========================================================================
  // TEAMS & CAPTAINS (AUCTION / DRAFT)
  // =========================================================================

  public setTeams(teams: GenericTournamentTeam[]): void {
    this.teams = [...teams];
    this.notify();
  }

  public getTeams(): GenericTournamentTeam[] {
    return [...this.teams];
  }

  // =========================================================================
  // COMPETITION GENERATION & SEEDING
  // =========================================================================

  public generateCompetition(manualOrder?: string[]): CompetitionStructure {
    if (this.teams.length < 2) {
      throw new Error(`Cannot generate competition bracket: tournament requires at least 2 teams (found ${this.teams.length}).`);
    }

    // Convert teams into CompetitionTeam records
    const compTeams: CompetitionTeam[] = this.teams.map((t, idx) => ({
      id: t.id,
      name: t.name,
      tag: t.tag,
      logo: t.logo,
      rating: t.rating,
      city: t.city,
      seed: t.seed || idx + 1
    }));

    // Seed according to config
    const seeded = GenericCompetitionEngine.seedTeams(
      compTeams,
      this.config.competition.seedingMethod,
      manualOrder
    );

    // Apply back seeds to teams
    seeded.forEach((st, idx) => {
      const matchTeam = this.teams.find(t => t.id === st.id);
      if (matchTeam) matchTeam.seed = st.seed;
    });

    let structure: CompetitionStructure;
    const format = this.config.competition.format;
    const defaultBO = this.config.competition.defaultSeriesFormat;
    const overrides = this.config.competition.roundOverrides || {};

    if (format === 'SINGLE_ELIMINATION') {
      structure = GenericCompetitionEngine.generateSingleElimination(
        seeded,
        this.config.identity.tournamentId,
        defaultBO,
        overrides
      );
    } else if (format === 'DOUBLE_ELIMINATION') {
      structure = GenericCompetitionEngine.generateDoubleElimination(
        seeded,
        this.config.identity.tournamentId,
        defaultBO,
        overrides
      );
    } else if (format === 'ROUND_ROBIN') {
      structure = GenericCompetitionEngine.generateRoundRobin(
        seeded,
        this.config.identity.tournamentId,
        defaultBO
      );
    } else if (format === 'GROUPS_KNOCKOUT') {
      const gCount = this.config.competition.groupsConfig?.groupCount || 2;
      const adv = this.config.competition.groupsConfig?.advancePerGroup || 2;
      structure = GenericCompetitionEngine.generateGroupsAndKnockout(
        seeded,
        this.config.identity.tournamentId,
        gCount,
        adv,
        defaultBO,
        overrides['Playoffs'] || 'BO3'
      );
    } else {
      // Default to Single Elimination
      structure = GenericCompetitionEngine.generateSingleElimination(
        seeded,
        this.config.identity.tournamentId,
        defaultBO,
        overrides
      );
    }

    this.competition = structure;
    this.matches = structure.allMatches;
    this.currentStage = 'COMPETITION';

    this.logAudit('competition_generated', `Generated ${format} competition for ${this.teams.length} teams.`);
    this.notify();
    return structure;
  }

  public getCompetition(): CompetitionStructure | null {
    return this.competition;
  }

  public getMatches(): CompetitionMatch[] {
    return [...this.matches];
  }

  // =========================================================================
  // MATCH EXECUTION & IDEMPOTENT RESULTS
  // =========================================================================

  public executeMatchResult(
    matchId: string,
    scoreA: number,
    scoreB: number
  ): { success: boolean; match?: CompetitionMatch; winner?: GenericTournamentTeam; loser?: GenericTournamentTeam; error?: string } {
    const match = this.matches.find(m => m.id === matchId);
    if (!match) return { success: false, error: `Match ${matchId} not found.` };
    if (!match.teamA || !match.teamB) return { success: false, error: 'Match does not have two teams assigned.' };

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.status = 'COMPLETED';

    const winnerCompTeam = scoreA > scoreB ? match.teamA : match.teamB;
    const loserCompTeam = scoreA > scoreB ? match.teamB : match.teamA;
    match.winnerId = winnerCompTeam.id;
    match.loserId = loserCompTeam.id;

    const winnerTeam = this.teams.find(t => t.id === winnerCompTeam.id);
    const loserTeam = this.teams.find(t => t.id === loserCompTeam.id);

    // Apply idempotent rating adjustment
    if (winnerTeam && loserTeam) {
      const ratingRes = ratingLedger.applyMatchResult(
        match.id,
        winnerTeam.id,
        loserTeam.id,
        winnerTeam.rating,
        loserTeam.rating
      );
      winnerTeam.rating = ratingRes.record.winnerNewRating;
      loserTeam.rating = ratingRes.record.loserNewRating;
    }

    // Advance winner through winnerNextMatchId
    if (match.winnerNextMatchId) {
      const nextMatch = this.matches.find(m => m.id === match.winnerNextMatchId);
      if (nextMatch) {
        if (match.winnerNextSlot === 'teamA') nextMatch.teamA = winnerCompTeam;
        else nextMatch.teamB = winnerCompTeam;
      }
    }

    // Advance loser through loserNextMatchId (for Double Elimination)
    if (match.loserNextMatchId) {
      const nextLoserMatch = this.matches.find(m => m.id === match.loserNextMatchId);
      if (nextLoserMatch) {
        if (match.loserNextSlot === 'teamA') nextLoserMatch.teamA = loserCompTeam;
        else nextLoserMatch.teamB = loserCompTeam;
      }
    }

    this.logAudit('match_completed', `${match.round}: ${winnerCompTeam.name} defeated ${loserCompTeam.name} (${scoreA}-${scoreB})`);
    this.notify();
    return { success: true, match, winner: winnerTeam, loser: loserTeam };
  }

  // =========================================================================
  // TOURNAMENT COMPLETION & PRIZE PLACEMENTS
  // =========================================================================

  public completeTournament(championTeamId: string, runnerUpTeamId: string, thirdPlaceTeamId?: string): { success: boolean } {
    const champ = this.teams.find(t => t.id === championTeamId);
    const runner = this.teams.find(t => t.id === runnerUpTeamId);
    const third = thirdPlaceTeamId ? this.teams.find(t => t.id === thirdPlaceTeamId) : undefined;

    const dist = this.config.prizes.placementDistribution;
    const p1Dist = dist.find(d => d.placement.includes('1st') || d.placement.includes('Champion'));
    const p2Dist = dist.find(d => d.placement.includes('2nd') || d.placement.includes('Runner'));
    const p3Dist = dist.find(d => d.placement.includes('3rd'));

    if (champ) {
      champ.placement = '1st Place (Champion)';
      champ.earningsINR = formatINR(p1Dist ? p1Dist.amountINR : this.config.prizes.totalPrizePoolINR * 0.6);
    }
    if (runner) {
      runner.placement = '2nd Place (Runner-up)';
      runner.earningsINR = formatINR(p2Dist ? p2Dist.amountINR : this.config.prizes.totalPrizePoolINR * 0.25);
    }
    if (third) {
      third.placement = '3rd Place';
      third.earningsINR = formatINR(p3Dist ? p3Dist.amountINR : this.config.prizes.totalPrizePoolINR * 0.15);
    }

    this.currentStage = 'COMPLETED';
    this.logAudit('tournament_completed', `Champion crowned: ${champ?.name || championTeamId}`);
    this.notify();
    return { success: true };
  }

  // =========================================================================
  // AUDIT & SUBSCRIPTIONS
  // =========================================================================

  public logAudit(action: string, details: string): void {
    this.auditTrail.push({
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  public getAuditTrail() {
    return [...this.auditTrail];
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}
