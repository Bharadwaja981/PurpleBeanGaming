/**
 * Purple Bean Gaming — Dota 2 Phase 2 Engine
 * Captain Selection & Authoritative Player Auction
 * 
 * Strict Domain Invariants:
 * 1. Captains can ONLY be appointed from VERIFIED contenders.
 * 2. Captain assignment is tournament-scoped; normal players cannot self-assign.
 * 3. Selecting a captain creates the tournament team with captain as 1/5 in primary roster.
 * 4. Auction parameters (purse, min bid, increment, reserve, timers) are tournament-configurable.
 * 5. Player states are strictly: AVAILABLE, NOMINATED, SOLD, UNSOLD, UNSELECTED.
 * 6. UNSOLD and UNSELECTED are distinct and never merged.
 * 7. Reserve rule: team must retain enough credits for remaining MANDATORY primary slots.
 *    Optional stand-ins do NOT consume mandatory reserve.
 * 8. Auction completes when ALL teams reach mandatory 5/5 primary rosters.
 * 9. Optional stand-in (0/1) supported without blocking tournament progression.
 * 10. Complete, immutable audit history preserved across refreshes.
 */

import { DotaRolePosition, dotaPlayerRegistry, DotaTournamentRegistration, DotaPlayerProfile } from './dotaPlayerEngine';
import { Player } from '../types/tournament';

export type AuctionPlayerStatus = 'AVAILABLE' | 'NOMINATED' | 'SOLD' | 'UNSOLD' | 'UNSELECTED';

export interface DotaAuctionConfig {
  tournamentId: string;
  tournamentName: string;
  startingCredits: number;
  minimumBid: number;
  bidIncrement: number;
  reservePerSlot: number;
  primaryRosterSize: number; // default 5 (Captain + 4 drafted)
  optionalStandInLimit: number; // default 1 (0/1 optional)
  nominationTimerSeconds: number; // default 30
  bidTimerSeconds: number; // default 25
  spectatorDelaySeconds?: number;
}

export interface DotaAuctionPlayer {
  id: string;
  userId: string;
  username: string; // IGN
  displayName: string;
  avatar: string;
  city?: string;
  region?: string;
  tournamentMmr: number;
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;
  rating: number; // Purple Bean Rating
  isCaptain: boolean;
  status: AuctionPlayerStatus;
  teamId?: string;
  teamName?: string;
  soldAmount?: number;
  isStandIn?: boolean;
}

export interface DotaAuctionTeam {
  id: string;
  name: string;
  tag: string;
  logo: string;
  color: string;
  captainId: string;
  captainIgn: string;
  startingCredits: number;
  remainingCredits: number;
  creditsUsed: number;
  primaryRoster: DotaAuctionPlayer[]; // Max primaryRosterSize (includes captain)
  standIns: DotaAuctionPlayer[]; // Max optionalStandInLimit
}

export interface DotaBidRecord {
  id: string;
  nomineeId: string;
  teamId: string;
  teamName: string;
  amount: number;
  timestamp: string;
  captainUserId: string;
}

export interface DotaNominationAudit {
  nomineeId: string;
  nomineeUsername: string;
  tournamentMmr: number;
  role: string;
  outcome: 'SOLD' | 'UNSOLD';
  winningTeamId?: string;
  winningTeamName?: string;
  winningBid?: number;
  bidsCount: number;
  timestamp: string;
}

export interface DotaAuctionState {
  tournamentId: string;
  status: 'PENDING' | 'LIVE' | 'PAUSED' | 'COMPLETED';
  revision: number;
  currentBid: number;
  leadingTeamId: string;
  leadingTeamName: string;
  nominee: DotaAuctionPlayer | null;
  secondsRemaining: number;
  soldCount: number;
  unsoldCount: number;
  unselectedCount: number;
  isCompleted: boolean;
  completedAt?: string;
}

export class DotaAuctionEngine {
  private config: DotaAuctionConfig;
  private players: Map<string, DotaAuctionPlayer> = new Map();
  private teams: Map<string, DotaAuctionTeam> = new Map();
  private state: DotaAuctionState;
  private bidHistory: DotaBidRecord[] = [];
  private nominationAudits: DotaNominationAudit[] = [];
  private auditLog: Array<{ action: string; actor: string; details: string; timestamp: string }> = [];
  private listeners: Array<() => void> = [];

  constructor(customConfig?: Partial<DotaAuctionConfig>) {
    this.config = {
      tournamentId: customConfig?.tournamentId || 'purple-bean-test-cup',
      tournamentName: customConfig?.tournamentName || 'Purple Bean Test Cup',
      startingCredits: customConfig?.startingCredits ?? 1000,
      minimumBid: customConfig?.minimumBid ?? 10,
      bidIncrement: customConfig?.bidIncrement ?? 10,
      reservePerSlot: customConfig?.reservePerSlot ?? 10,
      primaryRosterSize: customConfig?.primaryRosterSize ?? 5,
      optionalStandInLimit: customConfig?.optionalStandInLimit ?? 1,
      nominationTimerSeconds: customConfig?.nominationTimerSeconds ?? 30,
      bidTimerSeconds: customConfig?.bidTimerSeconds ?? 25,
      spectatorDelaySeconds: customConfig?.spectatorDelaySeconds ?? 0
    };

    this.state = {
      tournamentId: this.config.tournamentId,
      status: 'PENDING',
      revision: 1,
      currentBid: this.config.minimumBid,
      leadingTeamId: '',
      leadingTeamName: '',
      nominee: null,
      secondsRemaining: this.config.nominationTimerSeconds,
      soldCount: 0,
      unsoldCount: 0,
      unselectedCount: 0,
      isCompleted: false
    };

    this.initializeFromRegistrations();
  }

  // ---------------------------------------------------------------------------
  // Initialization & Hydration
  // ---------------------------------------------------------------------------
  public initializeFromRegistrations() {
    this.players.clear();
    this.teams.clear();
    this.bidHistory = [];
    this.nominationAudits = [];
    this.auditLog = [];

    // Get verified registrations for this tournament
    const regs = dotaPlayerRegistry.getTournamentRegistrations(this.config.tournamentId)
      .filter(r => r.status === 'VERIFIED');

    // If test cup and few registrations, populate from registered players
    if (regs.length === 0 && this.config.tournamentId === 'purple-bean-test-cup') {
      this.populateTestCupPool();
      return;
    }

    for (const reg of regs) {
      const profile = dotaPlayerRegistry.getPlayer(reg.userId);
      const auctionPlayer: DotaAuctionPlayer = {
        id: reg.userId,
        userId: reg.userId,
        username: reg.ign,
        displayName: profile?.displayName || reg.ign,
        avatar: profile?.avatar || '🎮',
        city: reg.city || profile?.city,
        region: reg.region || profile?.region,
        tournamentMmr: reg.tournamentMmr || reg.declaredMmr,
        primaryRole: reg.primaryRole,
        secondaryRole: reg.secondaryRole,
        rating: profile?.competitiveRating || Math.round((reg.tournamentMmr || reg.declaredMmr) / 4) + 100,
        isCaptain: false,
        status: 'AVAILABLE'
      };
      this.players.set(reg.userId, auctionPlayer);
    }
  }

  private populateTestCupPool() {
    const rawRoster = [
      { id: 'p-c1', ign: 'Aether', name: 'Arjun Nair', avatar: '⚡', city: 'Mumbai', mmr: 5850, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1564 },
      { id: 'p-c2', ign: 'Nova', name: 'Rohan Sharma', avatar: '🔥', city: 'Delhi', mmr: 5600, pRole: 'Position 1 — Carry', sRole: 'Position 3 — Offlane', rating: 1500 },
      { id: 'p-c3', ign: 'Karma', name: 'Karthik Raja', avatar: '🛡️', city: 'Bengaluru', mmr: 5400, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1450 },
      { id: 'p-tc-04', ign: 'Viper', name: 'Vikram Singh', avatar: '🐍', city: 'Hyderabad', mmr: 7500, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1610 },
      { id: 'p-tc-05', ign: 'Shadow', name: 'Sameer Sen', avatar: '🗡️', city: 'Kolkata', mmr: 7350, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1590 },
      { id: 'p-tc-06', ign: 'Bulldozer', name: 'Baljit Gill', avatar: '🦏', city: 'Chandigarh', mmr: 7200, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1570 },
      { id: 'p-tc-07', ign: 'Chakra', name: 'Chaitanya Joshi', avatar: '🔮', city: 'Pune', mmr: 7100, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1560 },
      { id: 'p-tc-08', ign: 'Zenith', name: 'Zaid Khan', avatar: '🌟', city: 'Mumbai', mmr: 7050, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1550 },
      { id: 'p-tc-09', ign: 'Phantom', name: 'Pranav Nair', avatar: '👻', city: 'Bengaluru', mmr: 7300, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1585 },
      { id: 'p-tc-10', ign: 'Titan', name: 'Tarun Reddy', avatar: '🗿', city: 'Hyderabad', mmr: 7450, pRole: 'Position 2 — Mid', sRole: 'Position 3 — Offlane', rating: 1605 },
      { id: 'p-tc-11', ign: 'Oracle', name: 'Omkar Deshmukh', avatar: '👁️', city: 'Pune', mmr: 7150, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1565 },
      { id: 'p-tc-12', ign: 'Frost', name: 'Faizan Ahmed', avatar: '❄️', city: 'Delhi', mmr: 7250, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1575 },
      { id: 'p-tc-13', ign: 'Blaze', name: 'Bhavin Patel', avatar: '🌋', city: 'Ahmedabad', mmr: 7300, pRole: 'Position 3 — Offlane', sRole: 'Position 1 — Carry', rating: 1580 },
      { id: 'p-tc-14', ign: 'Spectre', name: 'Siddharth Iyer', avatar: '⚔️', city: 'Chennai', mmr: 7400, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1595 },
      { id: 'p-tc-15', ign: 'Echo', name: 'Eshan Roy', avatar: '🔊', city: 'Kolkata', mmr: 7100, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1555 },
      { id: 'p-tc-16', ign: 'Tempest', name: 'Tejas Saxena', avatar: '🌪️', city: 'Jaipur', mmr: 7200, pRole: 'Position 2 — Mid', sRole: 'Position 1 — Carry', rating: 1570 },
      { id: 'p-tc-17', ign: 'Vortex', name: 'Varun Menon', avatar: '🌀', city: 'Kochi', mmr: 7000, pRole: 'Position 5 — Hard Support', sRole: 'Position 4 — Soft Support', rating: 1540 },
      { id: 'p-tc-18', ign: 'Raptor', name: 'Rishi Verma', avatar: '🦖', city: 'Lucknow', mmr: 7150, pRole: 'Position 3 — Offlane', sRole: 'Position 4 — Soft Support', rating: 1560 },
      { id: 'p-tc-19', ign: 'Krypton', name: 'Karan Mehra', avatar: '💎', city: 'Delhi', mmr: 7050, pRole: 'Position 1 — Carry', sRole: 'Position 2 — Mid', rating: 1550 },
      { id: 'p-tc-20', ign: 'Apex', name: 'Ayush Sharma', avatar: '🏔️', city: 'Indore', mmr: 7200, pRole: 'Position 3 — Offlane', sRole: 'Position 2 — Mid', rating: 1570 },
      { id: 'p-tc-21', ign: 'Helix', name: 'Harshil Shah', avatar: '🧬', city: 'Surat', mmr: 7250, pRole: 'Position 4 — Soft Support', sRole: 'Position 5 — Hard Support', rating: 1575 }
    ];

    for (const r of rawRoster) {
      // Ensure in dotaPlayerRegistry as verified
      dotaPlayerRegistry.submitTournamentRegistration({
        tournamentId: this.config.tournamentId,
        userId: r.id,
        ign: r.ign,
        primaryRole: r.pRole as DotaRolePosition,
        secondaryRole: r.sRole as DotaRolePosition,
        declaredMmr: r.mmr,
        rulesAccepted: true,
        city: r.city
      });
      dotaPlayerRegistry.verifyRegistration(this.config.tournamentId, r.id, 'system-seed', r.mmr);

      const p: DotaAuctionPlayer = {
        id: r.id,
        userId: r.id,
        username: r.ign,
        displayName: r.name,
        avatar: r.avatar,
        city: r.city,
        region: 'India',
        tournamentMmr: r.mmr,
        primaryRole: r.pRole as DotaRolePosition,
        secondaryRole: r.sRole as DotaRolePosition,
        rating: r.rating,
        isCaptain: false,
        status: 'AVAILABLE'
      };
      this.players.set(r.id, p);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Captain Selection & Team Creation
  // ---------------------------------------------------------------------------

  /**
   * Returns contenders who are VERIFIED and therefore eligible to be captains.
   */
  public getEligibleCaptainCandidates(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => !p.isCaptain);
  }

  /**
   * Appoints a VERIFIED contender as captain, automatically creating a tournament team.
   * Captain counts as 1/5 in the mandatory primary roster.
   */
  public appointCaptain(
    candidateUserId: string,
    teamMetadata: {
      teamName: string;
      tag: string;
      color?: string;
      logo?: string;
    },
    staffActorId: string
  ): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    // 1. Strict Invariant: Contender MUST be registered and VERIFIED
    const reg = dotaPlayerRegistry.getRegistration(this.config.tournamentId, candidateUserId);
    if (!reg) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament registration pool.` };
    }
    if (reg.status !== 'VERIFIED') {
      return { 
        success: false, 
        error: `Cannot appoint '${reg.ign}' as captain: Only VERIFIED contenders are eligible for captaincy.` 
      };
    }

    // 2. Verify candidate is in the player pool
    const player = this.players.get(candidateUserId);
    if (!player) {
      return { success: false, error: `Contender '${candidateUserId}' not found in tournament player pool.` };
    }

    // 3. Contender cannot already be a captain
    if (player.isCaptain) {
      return { success: false, error: `'${player.username}' is already appointed as a team captain.` };
    }

    // 4. Create the tournament team
    const teamId = `team-${candidateUserId.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now() % 10000}`;
    player.isCaptain = true;
    player.status = 'SOLD'; // Captain is locked to their own team
    player.teamId = teamId;
    player.teamName = teamMetadata.teamName;

    const team: DotaAuctionTeam = {
      id: teamId,
      name: teamMetadata.teamName,
      tag: teamMetadata.tag.toUpperCase(),
      logo: teamMetadata.logo || player.avatar || '🛡️',
      color: teamMetadata.color || '#FFE600',
      captainId: candidateUserId,
      captainIgn: player.username,
      startingCredits: this.config.startingCredits,
      remainingCredits: this.config.startingCredits,
      creditsUsed: 0,
      primaryRoster: [player], // Captain counts as 1/5 in primary roster
      standIns: []
    };

    this.teams.set(teamId, team);

    this.logAudit(
      'captain_appointed',
      staffActorId,
      `Appointed ${player.username} (MMR: ${player.tournamentMmr}) as captain of ${team.name}. Primary roster: 1/${this.config.primaryRosterSize}.`
    );

    this.notify();
    return { success: true, team };
  }

  // ---------------------------------------------------------------------------
  // 2. Live Auction Room Operations
  // ---------------------------------------------------------------------------

  /**
   * Starts or resumes the live auction room.
   */
  public startAuction(staffActorId: string): { success: boolean; error?: string } {
    if (this.teams.size < 2) {
      return { success: false, error: 'Cannot start auction: At least 2 teams with appointed captains are required.' };
    }

    this.state.status = 'LIVE';
    this.logAudit('auction_started', staffActorId, `Auction started with ${this.teams.size} teams.`);
    this.notify();
    return { success: true };
  }

  /**
   * Organiser nominates an AVAILABLE contender to the floor.
   */
  public nominatePlayer(
    playerId: string,
    staffActorId: string
  ): { success: boolean; error?: string; nominee?: DotaAuctionPlayer } {
    if (this.state.isCompleted) {
      return { success: false, error: 'Auction is completed. Cannot nominate additional players.' };
    }

    if (this.state.nominee) {
      return { success: false, error: `Current lot for '${this.state.nominee.username}' must be concluded first.` };
    }

    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, error: `Player '${playerId}' not found.` };
    }

    if (player.isCaptain) {
      return { success: false, error: `Cannot nominate captain '${player.username}'.` };
    }

    if (player.status !== 'AVAILABLE') {
      return { success: false, error: `Player '${player.username}' is not AVAILABLE (current status: ${player.status}).` };
    }

    player.status = 'NOMINATED';
    this.state.nominee = player;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = '';
    this.state.leadingTeamName = '';
    this.state.secondsRemaining = this.config.nominationTimerSeconds;
    this.state.revision += 1;

    this.logAudit(
      'player_nominated',
      staffActorId,
      `Nominated ${player.username} (${player.primaryRole}, MMR: ${player.tournamentMmr}, Rating: ${player.rating}) at opening bid of ${this.config.minimumBid} credits.`
    );

    this.notify();
    return { success: true, nominee: player };
  }

  /**
   * Validates and executes an authoritative bid from a team captain.
   */
  public placeBid(params: {
    teamId: string;
    captainUserId: string;
    bidAmount: number;
    expectedRevision?: number;
  }): { success: boolean; error?: string; currentBid?: number; revision?: number; leadingTeamName?: string } {
    const { teamId, captainUserId, bidAmount, expectedRevision } = params;

    // 1. Auction status check
    if (this.state.status !== 'LIVE' || this.state.isCompleted) {
      return { success: false, error: `Auction is currently ${this.state.status}. Bidding is closed.` };
    }

    // 2. Active nominee check
    if (!this.state.nominee) {
      return { success: false, error: 'No player is currently on the auction block.' };
    }

    // 3. Team check
    const team = this.teams.get(teamId);
    if (!team) {
      return { success: false, error: `Team '${teamId}' not found.` };
    }

    // 4. Scoped Captain Verification: Only the captain of this team can bid
    if (team.captainId !== captainUserId) {
      return { 
        success: false, 
        error: `Permission Denied: User '${captainUserId}' is not the authorized captain of ${team.name}.` 
      };
    }

    // 5. Revision optimistic lock (Concurrency / Stale Bid Prevention)
    if (expectedRevision !== undefined && expectedRevision !== this.state.revision) {
      return { 
        success: false, 
        error: `Stale Bid: Auction revision changed (expected ${expectedRevision}, current ${this.state.revision}). Please refresh.` 
      };
    }

    // 6. Minimum bid & Increment check
    if (bidAmount < this.config.minimumBid) {
      return { success: false, error: `Bid must meet minimum ${this.config.minimumBid} credits.` };
    }

    if (bidAmount <= this.state.currentBid) {
      return { 
        success: false, 
        error: `Proposed bid (${bidAmount}) must exceed current bid (${this.state.currentBid}).` 
      };
    }

    // Increment validation: must be a valid multiple of bidIncrement
    const diff = bidAmount - this.state.currentBid;
    if (diff % this.config.bidIncrement !== 0) {
      return { 
        success: false, 
        error: `Bid increment must be a multiple of ${this.config.bidIncrement} credits.` 
      };
    }

    // 7. Purse check (Overspend prevention)
    if (team.remainingCredits < bidAmount) {
      return { 
        success: false, 
        error: `Insufficient credits: ${team.name} has ${team.remainingCredits} credits, cannot bid ${bidAmount}.` 
      };
    }

    // 8. Roster capacity check
    const currentPrimaryCount = team.primaryRoster.length;
    const isPrimaryFull = currentPrimaryCount >= this.config.primaryRosterSize;
    const isStandInFull = team.standIns.length >= this.config.optionalStandInLimit;

    if (isPrimaryFull && isStandInFull) {
      return { success: false, error: `${team.name} roster is completely full (${currentPrimaryCount}/5 primary, ${team.standIns.length}/${this.config.optionalStandInLimit} stand-in).` };
    }

    // 9. MANDATORY RESERVE RULE:
    // A team must retain enough credits to fill every remaining MANDATORY primary roster slot.
    // Optional stand-ins are NOT included in the mandatory reserve requirement.
    if (!isPrimaryFull) {
      const remainingUnfilledPrimarySlots = Math.max(0, this.config.primaryRosterSize - currentPrimaryCount - 1);
      const minReserveNeeded = remainingUnfilledPrimarySlots * this.config.reservePerSlot;
      const purseAfterBid = team.remainingCredits - bidAmount;

      if (purseAfterBid < minReserveNeeded) {
        return { 
          success: false, 
          error: `Reserve Rule Violation: Must retain at least ${minReserveNeeded} credits for remaining ${remainingUnfilledPrimarySlots} mandatory primary slots.` 
        };
      }
    }

    // 10. Commit Bid
    this.state.currentBid = bidAmount;
    this.state.leadingTeamId = team.id;
    this.state.leadingTeamName = team.name;
    this.state.revision += 1;
    this.state.secondsRemaining = this.config.bidTimerSeconds; // Anti-snipe reset

    const bidRecord: DotaBidRecord = {
      id: `bid-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      nomineeId: this.state.nominee.id,
      teamId: team.id,
      teamName: team.name,
      amount: bidAmount,
      timestamp: new Date().toISOString(),
      captainUserId
    };
    this.bidHistory.unshift(bidRecord);

    this.logAudit(
      'bid_accepted',
      captainUserId,
      `Bid of ${bidAmount} credits accepted from ${team.name} for ${this.state.nominee.username} (rev ${this.state.revision}).`
    );

    this.notify();
    return {
      success: true,
      currentBid: bidAmount,
      revision: this.state.revision,
      leadingTeamName: team.name
    };
  }

  /**
   * Concludes the active nomination:
   * - If sellToWinner is true and there is a leading bid -> player SOLD, credits deducted, roster updated.
   * - Otherwise -> player UNSOLD.
   * Then checks if mandatory 5/5 rosters are full across all teams.
   */
  public concludeNomination(
    sellToWinner: boolean,
    staffActorId: string
  ): {
    outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED';
    player: DotaAuctionPlayer;
    teamName?: string;
    winningBid?: number;
  } {
    const nominee = this.state.nominee;
    if (!nominee) {
      throw new Error('No nominee currently on the auction block to conclude.');
    }

    let outcome: 'SOLD' | 'UNSOLD' | 'AUCTION_COMPLETED' = 'UNSOLD';
    let winningTeamName: string | undefined;
    let winningBid: number | undefined;

    if (sellToWinner && this.state.leadingTeamId) {
      const winnerTeam = this.teams.get(this.state.leadingTeamId);
      if (!winnerTeam) throw new Error('Winning team record not found.');

      const winningPrice = this.state.currentBid;
      winnerTeam.remainingCredits -= winningPrice;
      winnerTeam.creditsUsed += winningPrice;

      nominee.status = 'SOLD';
      nominee.teamId = winnerTeam.id;
      nominee.teamName = winnerTeam.name;
      nominee.soldAmount = winningPrice;

      // Assign to primary roster if < 5, else stand-in
      if (winnerTeam.primaryRoster.length < this.config.primaryRosterSize) {
        nominee.isStandIn = false;
        winnerTeam.primaryRoster.push(nominee);
      } else if (winnerTeam.standIns.length < this.config.optionalStandInLimit) {
        nominee.isStandIn = true;
        winnerTeam.standIns.push(nominee);
      }

      this.state.soldCount += 1;
      outcome = 'SOLD';
      winningTeamName = winnerTeam.name;
      winningBid = winningPrice;

      this.logAudit(
        'player_sold',
        staffActorId,
        `Player ${nominee.username} SOLD to ${winnerTeam.name} for ${winningPrice} credits. Roster: ${winnerTeam.primaryRoster.length}/${this.config.primaryRosterSize} primary.`
      );
    } else {
      // UNSOLD: nominated but nomination closed without winning bid
      nominee.status = 'UNSOLD';
      this.state.unsoldCount += 1;
      outcome = 'UNSOLD';

      this.logAudit(
        'player_unsold',
        staffActorId,
        `Player ${nominee.username} passed as UNSOLD.`
      );
    }

    // Record nomination audit
    this.nominationAudits.unshift({
      nomineeId: nominee.id,
      nomineeUsername: nominee.username,
      tournamentMmr: nominee.tournamentMmr,
      role: nominee.primaryRole,
      outcome: outcome === 'SOLD' ? 'SOLD' : 'UNSOLD',
      winningTeamId: outcome === 'SOLD' ? this.state.leadingTeamId : undefined,
      winningTeamName,
      winningBid,
      bidsCount: this.bidHistory.filter(b => b.nomineeId === nominee.id).length,
      timestamp: new Date().toISOString()
    });

    this.state.nominee = null;
    this.state.currentBid = this.config.minimumBid;
    this.state.leadingTeamId = '';
    this.state.leadingTeamName = '';
    this.state.revision += 1;

    // Check if ALL teams have completed their mandatory 5/5 primary rosters!
    const allMandatoryRostersFilled = Array.from(this.teams.values()).every(
      t => t.primaryRoster.length >= this.config.primaryRosterSize
    );

    if (allMandatoryRostersFilled) {
      this.finalizeAuction(staffActorId);
      outcome = 'AUCTION_COMPLETED';
    }

    this.notify();
    return {
      outcome,
      player: nominee,
      teamName: winningTeamName,
      winningBid
    };
  }

  /**
   * Assigns an optional stand-in (0/1) to a team from AVAILABLE, UNSOLD, or UNSELECTED players.
   * Stand-in absence never prevents tournament progression.
   */
  public assignOptionalStandIn(
    teamId: string,
    playerId: string,
    staffActorId: string
  ): { success: boolean; error?: string; team?: DotaAuctionTeam } {
    const team = this.teams.get(teamId);
    if (!team) return { success: false, error: `Team '${teamId}' not found.` };

    if (team.standIns.length >= this.config.optionalStandInLimit) {
      return { success: false, error: `${team.name} already has maximum allowed stand-ins (${this.config.optionalStandInLimit}).` };
    }

    const player = this.players.get(playerId);
    if (!player) return { success: false, error: `Player '${playerId}' not found.` };

    if (player.status !== 'AVAILABLE' && player.status !== 'UNSOLD' && player.status !== 'UNSELECTED') {
      return { success: false, error: `Player '${player.username}' is not eligible for stand-in (status: ${player.status}).` };
    }

    player.status = 'SOLD';
    player.teamId = team.id;
    player.teamName = team.name;
    player.isStandIn = true;
    team.standIns.push(player);

    this.logAudit(
      'standin_assigned',
      staffActorId,
      `Optional stand-in ${player.username} assigned to ${team.name}. Primary: 5/5, Stand-ins: ${team.standIns.length}/1.`
    );

    this.notify();
    return { success: true, team };
  }

  /**
   * Finalizes the auction:
   * - Closes live bidding and prevents future bids.
   * - Preserves SOLD and UNSOLD players.
   * - Marks all untouched AVAILABLE players as UNSELECTED.
   * - Idempotent.
   */
  public finalizeAuction(staffActorId = 'system'): { success: boolean; unselectedCount: number } {
    if (this.state.isCompleted) {
      return { success: true, unselectedCount: this.state.unselectedCount };
    }

    this.state.status = 'COMPLETED';
    this.state.isCompleted = true;
    this.state.completedAt = new Date().toISOString();
    this.state.nominee = null;

    // Convert all remaining untouched AVAILABLE players to UNSELECTED (distinct from UNSOLD!)
    let count = 0;
    for (const player of this.players.values()) {
      if (player.status === 'AVAILABLE') {
        player.status = 'UNSELECTED';
        count += 1;
      }
    }
    this.state.unselectedCount = count;

    this.logAudit(
      'auction_completed',
      staffActorId,
      `Auction finalized! All ${this.teams.size} teams reached mandatory rosters. ${this.state.soldCount} SOLD, ${this.state.unsoldCount} UNSOLD, ${count} UNSELECTED.`
    );

    this.notify();
    return { success: true, unselectedCount: count };
  }

  // ---------------------------------------------------------------------------
  // Queries & State Inspection
  // ---------------------------------------------------------------------------
  public getState(): DotaAuctionState {
    return { ...this.state };
  }

  public getConfig(): DotaAuctionConfig {
    return { ...this.config };
  }

  public getTeams(): DotaAuctionTeam[] {
    return Array.from(this.teams.values()).map(t => ({
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    }));
  }

  public getTeam(teamId: string): DotaAuctionTeam | undefined {
    const t = this.teams.get(teamId);
    if (!t) return undefined;
    return {
      ...t,
      primaryRoster: [...t.primaryRoster],
      standIns: [...t.standIns]
    };
  }

  public getPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values());
  }

  public getPlayer(playerId: string): DotaAuctionPlayer | undefined {
    return this.players.get(playerId);
  }

  public getAvailablePlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'AVAILABLE');
  }

  public getSoldPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'SOLD');
  }

  public getUnsoldPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'UNSOLD');
  }

  public getUnselectedPlayers(): DotaAuctionPlayer[] {
    return Array.from(this.players.values()).filter(p => p.status === 'UNSELECTED');
  }

  public getBidHistory(): DotaBidRecord[] {
    return [...this.bidHistory];
  }

  public getNominationAudits(): DotaNominationAudit[] {
    return [...this.nominationAudits];
  }

  public getAuditTrail(): Array<{ action: string; actor: string; details: string; timestamp: string }> {
    return [...this.auditLog];
  }

  // ---------------------------------------------------------------------------
  // Subscriptions & Audit Logging
  // ---------------------------------------------------------------------------
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Auction listener error:', err); }
    });
  }

  private logAudit(action: string, actor: string, details: string) {
    this.auditLog.unshift({
      action,
      actor,
      details,
      timestamp: new Date().toISOString()
    });
  }
}

// Default singleton instance
export const dotaAuctionEngine = new DotaAuctionEngine();
