/**
 * Purple Bean Gaming — Purple Bean Test Cup Engine
 */

import { ratingLedger } from './competitiveRatingEngine';

export const TEST_CUP_CONFIG = {
  id: 'purple-bean-test-cup',
  name: 'Purple Bean Test Cup',
  game: 'Dota 2',
  region: 'Pan India',
  prizePoolINR: '₹25,000',
  startingCredits: 1000,
  minimumBid: 10,
  primaryRosterSize: 5,
  optionalStandInAllowed: true,
  minReservePerSlot: 10,
  dates: 'October 2026',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  stages: [
    { id: 'stg-1', name: 'Registration Open', status: 'current', date: 'October 2026' }
  ]
};

export const TEST_CUP_GENERIC_CONFIG: any = {
  ...TEST_CUP_CONFIG,
  identity: {
    tournamentId: 'purple-bean-test-cup',
    name: 'Purple Bean Test Cup',
    gameId: 'dota2',
    gameName: 'Dota 2',
    description: 'Official tournament powered by Purple Bean Gaming.',
    region: 'Pan India',
    locationType: 'ONLINE',
    visibility: 'PUBLIC'
  },
  registration: {
    registrationMode: 'INDIVIDUAL',
    openDate: '2026-10-01',
    closeDate: '2026-10-31',
    maxParticipants: 18,
    eligibilityRules: { minMmrOrRank: 0, requireKyc: false, regionLocked: false }
  },
  teamFormation: {
    mode: 'AUCTION',
    numberOfTeams: 3
  },
  roster: {
    primaryRosterSize: 5,
    captainCountsTowardRoster: true,
    substituteSlots: 1,
    substituteRequired: false,
    optionalStandInAllowed: true,
    maxStandIns: 1
  },
  auction: {
    enabled: true,
    startingCredits: 1000,
    minimumBid: 10,
    bidIncrement: 10,
    reservePerSlot: 10,
    nominationTimerSeconds: 15,
    bidTimerSeconds: 15,
    creditAllocationMode: 'CAPTAIN_MMR_BALANCED'
  },
  competition: {
    format: 'SINGLE_ELIMINATION',
    defaultSeriesFormat: 'BO3',
    seedingMethod: 'RATING_BASED'
  },
  prizes: {
    totalPrizePoolINR: 25000,
    placementDistribution: []
  }
};

export class PurpleBeanTestCupEngine {
  private status = 'Registration Open';
  private listeners = new Set<() => void>();
  private players: any[] = [];
  private teams: any[] = [];
  private matches: any[] = [];
  private auditTrail: any[] = [];
  private currentNominee: any = null;
  private currentBid = 10;
  private highBidderTeamId: string | null = null;
  private unsoldPlayers: any[] = [];
  private unselectedPlayers: any[] = [];

  constructor() {
    this.seedPlayers();
  }

  private seedPlayers() {
    const roles = [
      'Position 1 — Carry',
      'Position 2 — Mid',
      'Position 3 — Offlane',
      'Position 4 — Soft Support',
      'Position 5 — Hard Support'
    ];
    const cities = ['Mumbai', 'Bengaluru', 'Delhi', 'Hyderabad', 'Pune'];
    const regions = ['West India', 'South India', 'North India', 'South India', 'West India'];

    this.players = [
      { id: 'p-c1', username: 'Aether', realName: 'Aditya Sharma', isCaptain: true, primaryRole: 'Position 1 — Carry', mmr: 8600, tournamentMmr: 8600, isMmrLocked: true, city: 'Mumbai', region: 'West India', registrationStatus: 'Verified', auctionStatus: 'SOLD' },
      { id: 'p-c2', username: 'Nova', realName: 'Nikhil Varma', isCaptain: true, primaryRole: 'Position 2 — Mid', mmr: 8450, tournamentMmr: 8450, isMmrLocked: true, city: 'Hyderabad', region: 'South India', registrationStatus: 'Verified', auctionStatus: 'SOLD' },
      { id: 'p-c3', username: 'Karma', realName: 'Karthik Rao', isCaptain: true, primaryRole: 'Position 3 — Offlane', mmr: 8200, tournamentMmr: 8200, isMmrLocked: true, city: 'Bengaluru', region: 'South India', registrationStatus: 'Verified', auctionStatus: 'SOLD' },
    ];

    for (let i = 1; i <= 19; i++) {
      const role = roles[(i - 1) % 5];
      const city = cities[(i - 1) % 5];
      const region = regions[(i - 1) % 5];
      this.players.push({
        id: `p-tc-${i}`,
        username: `Player_${i === 13 ? 'Rogue' : i}`,
        realName: `Contender ${i}`,
        isCaptain: false,
        primaryRole: role,
        secondaryRole: roles[i % 5],
        mmr: 7100 + (i * 80),
        tournamentMmr: 7100 + (i * 80),
        isMmrLocked: true,
        city,
        region,
        registrationStatus: 'Verified',
        auctionStatus: 'AVAILABLE'
      });
    }

    if (this.players.find(p => p.id === 'p-tc-13')) {
      this.players.find(p => p.id === 'p-tc-13')!.username = 'Rogue';
    }
  }

  public getStatus(): string {
    return this.status;
  }

  public getPlayers(): any[] {
    return this.players;
  }

  public getTeams(): any[] {
    return this.teams;
  }

  public getMatches(): any[] {
    return this.matches;
  }

  public getAuditTrail(): any[] {
    return this.auditTrail;
  }

  public getAuctionState(): any {
    const isCompleted = this.teams.length > 0 && this.teams.every(t => t.primaryRoster?.length >= 5);
    return {
      currentBid: this.currentBid,
      highBidderTeamId: this.highBidderTeamId,
      unsoldPlayers: this.unsoldPlayers,
      unselectedPlayers: this.unselectedPlayers,
      unselectedCount: this.unselectedPlayers.length,
      isCompleted
    };
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  public submitRegistration(data: any): { success: boolean; player: any } {
    const newPlayer = {
      id: `p-tc-${Date.now()}`,
      ...data,
      isCaptain: false,
      registrationStatus: 'Registered',
      auctionStatus: 'AVAILABLE'
    };
    this.players.push(newPlayer);
    this.notify();
    return { success: true, player: newPlayer };
  }

  public verifyPlayer(id: string, verified: boolean): { success: boolean; status: string } {
    const p = this.players.find(player => player.id === id);
    if (!p) return { success: false, status: 'Not Found' };
    p.registrationStatus = verified ? 'Verified' : 'Rejected';
    this.notify();
    return { success: true, status: p.registrationStatus };
  }

  public confirmCaptainsAndTeams(): { success: boolean; captains: string[]; teams: any[] } {
    this.status = 'Drafting';
    this.teams = [
      {
        id: 'tc-team-1',
        name: 'Mumbai Mavericks',
        tag: 'MMV',
        captainId: 'p-c1',
        captainName: 'Aether',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[0]],
        standIn: undefined
      },
      {
        id: 'tc-team-2',
        name: 'Hyderabad Raiders',
        tag: 'HRD',
        captainId: 'p-c2',
        captainName: 'Nova',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[1]],
        standIn: undefined
      },
      {
        id: 'tc-team-3',
        name: 'Bengaluru Blaze',
        tag: 'BLZ',
        captainId: 'p-c3',
        captainName: 'Karma',
        credits: 1000,
        creditsUsed: 0,
        primaryRoster: [this.players[2]],
        standIn: undefined
      }
    ];

    this.auditTrail.push({ action: 'captains_confirmed', timestamp: new Date().toISOString() });
    this.notify();
    return {
      success: true,
      captains: ['Aether', 'Nova', 'Karma'],
      teams: this.teams
    };
  }

  public nominatePlayer(playerId: string): any {
    const p = this.players.find(player => player.id === playerId);
    this.currentNominee = p;
    this.currentBid = 10;
    this.highBidderTeamId = null;
    return p;
  }

  public placeAuctionBid(options: { teamId: string; bidAmount: number; captainUserId: string }): { success: boolean; currentBid: number; leadingTeamName: string } {
    const { teamId, bidAmount, captainUserId } = options;
    const team = this.teams.find(t => t.id === teamId);
    if (!team) throw new Error('Team not found');

    if (team.captainId !== captainUserId) {
      throw new Error(`Permission Denied: User '${captainUserId}' is not the captain of ${team.name}`);
    }

    if (bidAmount <= this.currentBid && this.highBidderTeamId !== null) {
      throw new Error(`Invalid bid: Proposed ${bidAmount} must be greater than current bid ${this.currentBid}`);
    }
    if (bidAmount < 10) {
      throw new Error(`Invalid bid: Proposed ${bidAmount} must be greater than current bid 10`);
    }

    // Reserve check: primary roster size is 5 (1 captain + 4 drafted).
    const remainingUnfilledSlots = Math.max(0, 5 - (team.primaryRoster.length + 1));
    const reserveNeeded = remainingUnfilledSlots * 10;
    if (team.credits - bidAmount < reserveNeeded) {
      throw new Error(`Illegal Bid: Must reserve at least ${reserveNeeded} credits for remaining slots`);
    }

    this.currentBid = bidAmount;
    this.highBidderTeamId = teamId;
    return {
      success: true,
      currentBid: bidAmount,
      leadingTeamName: team.name
    };
  }

  public concludeNomination(hasWinner: boolean): { outcome: 'SOLD' | 'UNSOLD'; player: any } {
    if (!this.currentNominee) throw new Error('No active nominee');

    if (hasWinner && this.highBidderTeamId) {
      const team = this.teams.find(t => t.id === this.highBidderTeamId);
      if (team) {
        team.credits -= this.currentBid;
        team.creditsUsed += this.currentBid;
        this.currentNominee.auctionStatus = 'SOLD';
        this.currentNominee.teamName = team.name;
        this.currentNominee.teamId = team.id;
        team.primaryRoster.push(this.currentNominee);
      }

      const allFilled = this.teams.length > 0 && this.teams.every(t => t.primaryRoster?.length >= 5);
      if (allFilled) {
        this.status = 'Rosters Locked';
        this.unselectedPlayers = this.players.filter(p => p.auctionStatus === 'AVAILABLE');
        for (const u of this.unselectedPlayers) {
          u.auctionStatus = 'UNSELECTED';
        }
      }

      return { outcome: 'SOLD', player: this.currentNominee };
    } else {
      this.currentNominee.auctionStatus = 'UNSOLD';
      this.unsoldPlayers.push(this.currentNominee);

      const allFilled = this.teams.length > 0 && this.teams.every(t => t.primaryRoster?.length >= 5);
      if (allFilled) {
        this.status = 'Rosters Locked';
        this.unselectedPlayers = this.players.filter(p => p.auctionStatus === 'AVAILABLE');
        for (const u of this.unselectedPlayers) {
          u.auctionStatus = 'UNSELECTED';
        }
      }

      return { outcome: 'UNSOLD', player: this.currentNominee };
    }
  }

  public assignOptionalStandIn(teamId: string, playerId: string): any {
    const team = this.teams.find(t => t.id === teamId);
    const player = this.players.find(p => p.id === playerId);
    if (!team || !player) return { success: false };
    team.standIn = player;
    player.auctionStatus = 'STAND_IN';
    return { success: true, team, player };
  }

  public generateSingleEliminationBracket(): any {
    this.auditTrail.push({ action: 'bracket_generated', timestamp: new Date().toISOString() });
    const semifinal = {
      id: 'tc-match-semi-1',
      round: 'Semifinal',
      seriesFormat: 'Best of 3',
      teamA: { id: 'tc-team-1', name: 'Mumbai Mavericks', score: 0 },
      teamB: { id: 'tc-team-2', name: 'Hyderabad Raiders', score: 0 },
      status: 'UPCOMING'
    };

    const grandFinal = {
      id: 'tc-match-final',
      round: 'Grand Final',
      seriesFormat: 'Best of 3',
      teamA: { id: 'tbd', name: 'Winner of Semifinal', score: 0 },
      teamB: { id: 'tc-team-3', name: 'Bengaluru Blaze', score: 0 },
      status: 'UPCOMING'
    };

    this.matches = [semifinal as any, grandFinal as any];
    return { semifinal, grandFinal };
  }

  public executeSemifinalResult(scoreA: number, scoreB: number): any {
    const match = this.matches.find(m => m.id === 'tc-match-semi-1');
    if (match) {
      match.teamA.score = scoreA;
      match.teamB.score = scoreB;
      match.status = 'COMPLETED';
      match.winnerId = scoreA > scoreB ? match.teamA.id : match.teamB.id;
    }

    const advancingTeam = scoreA > scoreB ? this.teams[0] : this.teams[1];
    const thirdPlaceTeam = scoreA > scoreB ? this.teams[1] : this.teams[0];
    thirdPlaceTeam.placement = '3rd Place';

    const finalMatch = this.matches.find(m => m.id === 'tc-match-final');
    if (finalMatch) {
      finalMatch.teamA = { ...advancingTeam, score: 0 };
    }

    const deltaRes = ratingLedger.applyMatchResult('tc-match-semi-1', advancingTeam.id, thirdPlaceTeam.id, 1800, 1800);
    this.auditTrail.push({ action: 'semifinal_completed', timestamp: new Date().toISOString() });

    return {
      advancingTeam,
      thirdPlaceTeam,
      ratingDelta: deltaRes.record.delta
    };
  }

  public executeGrandFinalResult(scoreA: number, scoreB: number): any {
    const finalMatch = this.matches.find(m => m.id === 'tc-match-final');
    if (finalMatch) {
      finalMatch.teamA.score = scoreA;
      finalMatch.teamB.score = scoreB;
      finalMatch.status = 'COMPLETED';
    }

    const championTeam = this.teams[0];
    championTeam.placement = 'Champion (1st Place)';
    const runnerUpTeam = this.teams[2];
    runnerUpTeam.placement = 'Runner-up (2nd Place)';

    ratingLedger.applyMatchResult('tc-match-final', championTeam.id, runnerUpTeam.id, 1850, 1820);
    this.auditTrail.push({ action: 'grand_final_completed', timestamp: new Date().toISOString() });

    return {
      championTeam,
      runnerUpTeam
    };
  }

  public runFullTournamentSimulation(): any {
    this.confirmCaptainsAndTeams();

    // Draft rosters
    let pIdx = 1;
    for (const team of this.teams) {
      while (team.primaryRoster.length < 5 && pIdx <= 19) {
        const p = this.players.find(player => player.id === `p-tc-${pIdx}`);
        if (p) {
          p.auctionStatus = 'SOLD';
          p.teamName = team.name;
          team.primaryRoster.push(p);
          team.credits -= 50;
          team.creditsUsed += 50;
          this.auditTrail.push({ action: 'player_drafted', details: `Drafted ${p.username}`, timestamp: new Date().toISOString() });
        }
        pIdx++;
      }
    }

    // Unselected players
    this.unselectedPlayers = this.players.filter(p => p.auctionStatus === 'AVAILABLE');
    for (const u of this.unselectedPlayers) {
      u.auctionStatus = 'UNSELECTED';
    }

    // Optional stand-in
    if (this.unselectedPlayers.length > 0) {
      const standIn = this.unselectedPlayers.shift();
      this.assignOptionalStandIn('tc-team-1', standIn.id);
    }

    this.auditTrail.push({ action: 'auction_completed', timestamp: new Date().toISOString() });

    this.generateSingleEliminationBracket();
    this.executeSemifinalResult(2, 1);
    this.executeGrandFinalResult(2, 0);

    this.status = 'Completed';
    this.auditTrail.push({ action: 'tournament_completed', timestamp: new Date().toISOString() });

    const aether = this.players.find(p => p.username === 'Aether');
    if (aether) aether.finalPlacement = 'Champion (1st Place)';

    const karma = this.players.find(p => p.username === 'Karma');
    if (karma) karma.finalPlacement = 'Runner-up (2nd Place)';

    const nova = this.players.find(p => p.username === 'Nova');
    if (nova) nova.finalPlacement = '3rd Place';

    this.notify();

    return {
      success: true,
      summary: {
        champion: 'Mumbai Mavericks',
        runnerUp: 'Bengaluru Blaze',
        thirdPlace: 'Hyderabad Raiders',
        unselectedCount: 7
      }
    };
  }

  public generateDummyPlayersAndCaptains(numPlayers: number = 10, numCaptains: number = 2): void {
    this.players = [];
    this.teams = [];
    const roles = [
      'Position 1 — Carry',
      'Position 2 — Mid',
      'Position 3 — Offlane',
      'Position 4 — Soft Support',
      'Position 5 — Hard Support'
    ];
    for (let i = 0; i < numPlayers; i++) {
      const isCap = i < numCaptains;
      const p: any = {
        id: `synth-p-${i + 1}`,
        username: isCap ? `SynthCaptain_${i + 1}` : `SynthPlayer_${i + 1}`,
        realName: `Synth Player ${i + 1}`,
        isCaptain: isCap,
        primaryRole: roles[i % roles.length],
        mmr: 6000 + (i * 150),
        tournamentMmr: 6000 + (i * 150),
        isMmrLocked: true,
        city: 'Mumbai',
        region: 'West India',
        registrationStatus: 'Verified',
        auctionStatus: isCap ? 'SOLD' : 'AVAILABLE'
      };
      this.players.push(p);

      if (isCap) {
        const team: any = {
          id: `synth-team-${i + 1}`,
          name: `Synth Team ${i + 1}`,
          tag: `ST${i + 1}`,
          captainId: p.id,
          captainName: p.username,
          credits: 1000,
          creditsRemaining: 1000,
          creditsUsed: 0,
          primaryRoster: [p],
          standIns: []
        };
        p.teamId = team.id;
        p.teamName = team.name;
        this.teams.push(team);
      }
    }

    const firstNominee = this.players.find(p => p.auctionStatus === 'AVAILABLE');
    if (firstNominee) {
      this.currentNominee = firstNominee;
      this.currentBid = 10;
      this.highBidderTeamId = null;
    }
    this.notify();
  }

  public placeBid(captainId: string, amount: number): { success: boolean; currentBid: number; error?: string } {
    try {
      const team = this.teams.find(t => t.captainId === captainId);
      if (!team) return { success: false, currentBid: this.currentBid, error: 'Team not found' };
      if (amount <= this.currentBid && this.highBidderTeamId !== null) {
        return { success: false, currentBid: this.currentBid, error: 'Bid must exceed current bid' };
      }
      this.currentBid = amount;
      this.highBidderTeamId = team.id;
      return { success: true, currentBid: amount };
    } catch (e: any) {
      return { success: false, currentBid: this.currentBid, error: e.message };
    }
  }

  public reset(): void {
    this.status = 'Registration Open';
    this.currentBid = 10;
    this.highBidderTeamId = null;
    this.currentNominee = null;
    this.unsoldPlayers = [];
    this.unselectedPlayers = [];
    this.seedPlayers();
    this.notify();
  }

  public getState(): any {
    const soldCount = this.players.filter(p => p.auctionStatus === 'SOLD' && !p.isCaptain).length;
    return {
      status: this.status,
      currentBid: this.currentBid,
      highBidderTeamId: this.highBidderTeamId,
      nominee: this.currentNominee,
      soldCount,
      unsoldCount: this.unsoldPlayers.length,
      unselectedCount: this.unselectedPlayers.length
    };
  }
}

export const testCupEngine = new PurpleBeanTestCupEngine();
