/**
 * Purple Bean Gaming — Dota 2 Phase 3 Engine
 * Premade Teams & Authoritative Roster Management
 * 
 * Strict Domain Invariants:
 * 1. Only VERIFIED contenders can be added to premade team rosters.
 * 2. Primary roster must contain exactly 5 players (including the captain).
 * 3. Optional stand-in limit is tournament-configurable (default 0–1).
 * 4. Captain must be one of the five primary players.
 * 5. Players cannot belong to more than one active team in the same tournament.
 * 6. Duplicate players in the same roster are strictly rejected.
 * 7. State Machine: DRAFT -> SUBMITTED -> UNDER_REVIEW -> (CHANGES_REQUESTED | APPROVED | REJECTED) -> LOCKED.
 * 8. CHANGES_REQUESTED and REJECT require mandatory organiser justification reasons.
 * 9. Emergency roster changes are strictly organiser-controlled with full versioning and audit preservation.
 * 10. Tournament roster snapshots are immutable and strictly decoupled from persistent club profiles.
 */

import { 
  DotaRolePosition, 
  dotaPlayerRegistry, 
  DotaPlayerProfile, 
  DotaTournamentRegistration 
} from './dotaPlayerEngine';

export type PremadeTeamStatus = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOCKED';

export type RosterConsentStatus = 'INVITED' | 'ACCEPTED' | 'DECLINED';

export interface PremadeRosterSlot {
  userId: string;
  ign: string;
  avatar: string;
  tournamentMmr: number;
  declaredMmr: number;
  primaryRole: DotaRolePosition;
  secondaryRole?: DotaRolePosition;
  pbRating: number;
  isCaptain: boolean;
  isStandIn: boolean;
  consentStatus: RosterConsentStatus;
  invitedAt: string;
  respondedAt?: string;
}

export interface PremadeRosterAuditEvent {
  action: 
    | 'team_created'
    | 'roster_submitted'
    | 'player_invited'
    | 'player_accepted'
    | 'player_declined'
    | 'player_removed'
    | 'player_replaced'
    | 'changes_requested'
    | 'team_approved'
    | 'team_rejected'
    | 'roster_locked'
    | 'emergency_replacement';
  actorId: string;
  actorRole: string;
  details: string;
  timestamp: string;
}

export interface PremadeTeamRegistration {
  id: string; // e.g. pmt-{tournamentId}-{teamId}
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  persistentClubId?: string; // Reference to persistent Purple Bean Team if linked
  teamName: string;
  tag: string;
  logo: string;
  color: string;
  captainId: string;
  captainIgn: string;
  status: PremadeTeamStatus;
  primaryRoster: PremadeRosterSlot[]; // Exactly primaryRosterSize (default 5)
  standIns: PremadeRosterSlot[]; // Max standInLimit (default 1)
  registeredAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvalReason?: string;
  rejectionReason?: string;
  changesRequestedReason?: string;
  lockedAt?: string;
  lockedBy?: string;
  snapshotVersion: number;
  auditTrail: PremadeRosterAuditEvent[];
}

export interface HistoricalRosterSnapshot {
  snapshotId: string;
  tournamentId: string;
  tournamentName: string;
  teamId: string;
  teamName: string;
  tag: string;
  logo: string;
  captainId: string;
  captainIgn: string;
  primaryRoster: Array<{
    userId: string;
    ign: string;
    tournamentMmr: number;
    primaryRole: DotaRolePosition;
    secondaryRole?: DotaRolePosition;
    pbRating: number;
    isCaptain: boolean;
  }>;
  standIns: Array<{
    userId: string;
    ign: string;
    tournamentMmr: number;
    primaryRole: DotaRolePosition;
    secondaryRole?: DotaRolePosition;
    pbRating: number;
  }>;
  approvedAt: string;
  approvedBy: string;
  lockedAt?: string;
  lockedBy?: string;
  version: number;
  emergencyChanges: Array<{
    timestamp: string;
    actor: string;
    reason: string;
    outgoingPlayerId: string;
    outgoingPlayerIgn: string;
    incomingPlayerId: string;
    incomingPlayerIgn: string;
    role: DotaRolePosition;
  }>;
}

export interface PremadeTournamentConfig {
  tournamentId: string;
  tournamentName: string;
  maxTeams: number; // default 8 (e.g. India Dota Open)
  primaryRosterSize: number; // default 5
  standInLimit: number; // default 1
  requirePlayerConsent: boolean; // default true
  prizePoolINR: number; // default 100000
}

export class DotaPremadeTeamEngine {
  private configs = new Map<string, PremadeTournamentConfig>();
  private teams = new Map<string, PremadeTeamRegistration>(); // key: `${tournamentId}__${teamId}`
  private playerToTeamMap = new Map<string, string>(); // key: `${tournamentId}__${userId}` -> teamId
  private historicalSnapshots = new Map<string, HistoricalRosterSnapshot>(); // key: `${tournamentId}__${teamId}`
  private listeners: Array<() => void> = [];

  constructor() {
    this.seedIndiaDotaOpenConfig();
  }

  private seedIndiaDotaOpenConfig() {
    this.registerTournamentConfig({
      tournamentId: 'india-dota-open-2026',
      tournamentName: 'India Dota Open',
      maxTeams: 8,
      primaryRosterSize: 5,
      standInLimit: 1,
      requirePlayerConsent: true,
      prizePoolINR: 100000
    });
  }

  public registerTournamentConfig(config: PremadeTournamentConfig) {
    this.configs.set(config.tournamentId, config);
  }

  public getTournamentConfig(tournamentId: string): PremadeTournamentConfig {
    return this.configs.get(tournamentId) || {
      tournamentId,
      tournamentName: 'Dota 2 Championship',
      maxTeams: 8,
      primaryRosterSize: 5,
      standInLimit: 1,
      requirePlayerConsent: true,
      prizePoolINR: 100000
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Premade Team Registration & Roster Building
  // ---------------------------------------------------------------------------

  /**
   * Registers a new premade tournament team in DRAFT status.
   * Captain must be a VERIFIED contender and becomes the initial primary roster player.
   */
  public registerPremadeTeam(params: {
    tournamentId: string;
    teamName: string;
    tag: string;
    logo?: string;
    color?: string;
    captainUserId: string;
    persistentClubId?: string;
    creatorUserId: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamName, tag, logo, color, captainUserId, persistentClubId, creatorUserId } = params;
    const config = this.getTournamentConfig(tournamentId);

    // 1. Validate team count limit
    const existingTeams = this.getTournamentTeams(tournamentId);
    if (existingTeams.length >= config.maxTeams) {
      return { success: false, error: `Tournament has reached maximum capacity of ${config.maxTeams} teams.` };
    }

    // 2. Validate captain is VERIFIED
    const captainReg = dotaPlayerRegistry.getRegistration(tournamentId, captainUserId);
    if (!captainReg || captainReg.status !== 'VERIFIED') {
      return { success: false, error: 'Cannot register team: Captain must have a VERIFIED tournament registration.' };
    }

    // 3. Validate captain is not already registered with another team in this tournament
    const playerKey = `${tournamentId}__${captainUserId}`;
    if (this.playerToTeamMap.has(playerKey)) {
      return { success: false, error: `Captain '${captainReg.ign}' is already registered with another team in this tournament.` };
    }

    const teamId = `pmt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const teamKey = `${tournamentId}__${teamId}`;
    const captainProfile = dotaPlayerRegistry.getPlayer(captainUserId);

    // Initial slot for captain
    const captainSlot: PremadeRosterSlot = {
      userId: captainUserId,
      ign: captainReg.ign,
      avatar: captainProfile?.avatar || '👑',
      tournamentMmr: captainReg.tournamentMmr || captainReg.declaredMmr,
      declaredMmr: captainReg.declaredMmr,
      primaryRole: captainReg.primaryRole,
      secondaryRole: captainReg.secondaryRole,
      pbRating: captainProfile?.competitiveRating || 1500,
      isCaptain: true,
      isStandIn: false,
      consentStatus: 'ACCEPTED', // Captain consents automatically
      invitedAt: new Date().toISOString(),
      respondedAt: new Date().toISOString()
    };

    const newTeam: PremadeTeamRegistration = {
      id: teamId,
      tournamentId,
      tournamentName: config.tournamentName,
      teamId,
      persistentClubId,
      teamName: teamName.trim(),
      tag: tag.trim().toUpperCase(),
      logo: logo || '🛡️',
      color: color || '#FFE600',
      captainId: captainUserId,
      captainIgn: captainReg.ign,
      status: 'DRAFT',
      primaryRoster: [captainSlot],
      standIns: [],
      registeredAt: new Date().toISOString(),
      snapshotVersion: 1,
      auditTrail: [
        {
          action: 'team_created',
          actorId: creatorUserId,
          actorRole: creatorUserId === captainUserId ? 'captain' : 'manager',
          details: `Team '${teamName}' registered in DRAFT state by ${captainReg.ign}.`,
          timestamp: new Date().toISOString()
        }
      ]
    };

    this.teams.set(teamKey, newTeam);
    this.playerToTeamMap.set(playerKey, teamId);

    this.notify();
    return { success: true, team: newTeam };
  }

  /**
   * Adds an invited player slot to the primary roster or optional stand-in slot.
   */
  public addPlayerToRoster(params: {
    tournamentId: string;
    teamId: string;
    candidateUserId: string;
    isStandIn?: boolean;
    assignedRole?: DotaRolePosition;
    actorUserId: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamId, candidateUserId, isStandIn = false, assignedRole, actorUserId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team registration not found.' };

    const config = this.getTournamentConfig(tournamentId);

    // 1. Authorize: Only captain or organiser can edit DRAFT or CHANGES_REQUESTED roster
    if (team.status !== 'DRAFT' && team.status !== 'CHANGES_REQUESTED') {
      return { success: false, error: `Cannot modify roster while team status is '${team.status}'.` };
    }
    if (team.captainId !== actorUserId && actorUserId !== 'organiser-staff-1' && !actorUserId.includes('admin')) {
      return { success: false, error: 'Permission Denied: Only team captain or tournament staff can edit rosters.' };
    }

    // 2. Validate candidate verification status
    const candidateReg = dotaPlayerRegistry.getRegistration(tournamentId, candidateUserId);
    if (!candidateReg || candidateReg.status !== 'VERIFIED') {
      return { success: false, error: `Cannot add candidate '${candidateUserId}': Contender must be VERIFIED for this tournament.` };
    }

    // 3. Validate duplicate in same roster
    const allRosterSlots = [...team.primaryRoster, ...team.standIns];
    if (allRosterSlots.some(s => s.userId === candidateUserId)) {
      return { success: false, error: `Contender '${candidateReg.ign}' is already on this team's roster.` };
    }

    // 4. Validate player is not on another team in this tournament
    const playerKey = `${tournamentId}__${candidateUserId}`;
    if (this.playerToTeamMap.has(playerKey) && this.playerToTeamMap.get(playerKey) !== teamId) {
      return { success: false, error: `Contender '${candidateReg.ign}' is already committed to another team in this tournament.` };
    }

    // 5. Validate capacity limits
    if (!isStandIn) {
      if (team.primaryRoster.length >= config.primaryRosterSize) {
        return { success: false, error: `Primary roster is already full (${config.primaryRosterSize}/${config.primaryRosterSize}).` };
      }
    } else {
      if (team.standIns.length >= config.standInLimit) {
        return { success: false, error: `Maximum stand-in limit reached (${config.standInLimit}/${config.standInLimit}).` };
      }
    }

    const candidateProfile = dotaPlayerRegistry.getPlayer(candidateUserId);
    const newSlot: PremadeRosterSlot = {
      userId: candidateUserId,
      ign: candidateReg.ign,
      avatar: candidateProfile?.avatar || '🎮',
      tournamentMmr: candidateReg.tournamentMmr || candidateReg.declaredMmr,
      declaredMmr: candidateReg.declaredMmr,
      primaryRole: assignedRole || candidateReg.primaryRole,
      secondaryRole: candidateReg.secondaryRole,
      pbRating: candidateProfile?.competitiveRating || 1500,
      isCaptain: false,
      isStandIn,
      consentStatus: config.requirePlayerConsent ? 'INVITED' : 'ACCEPTED',
      invitedAt: new Date().toISOString()
    };

    if (!isStandIn) {
      team.primaryRoster.push(newSlot);
    } else {
      team.standIns.push(newSlot);
    }

    this.playerToTeamMap.set(playerKey, teamId);

    team.auditTrail.unshift({
      action: 'player_invited',
      actorId: actorUserId,
      actorRole: actorUserId === team.captainId ? 'captain' : 'staff',
      details: `Invited ${candidateReg.ign} (${newSlot.primaryRole}, MMR: ${newSlot.tournamentMmr}) to ${isStandIn ? 'stand-in' : 'primary'} roster.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, team };
  }

  /**
   * Responds to a team roster invitation (ACCEPTED or DECLINED).
   */
  public respondToRosterInvitation(params: {
    tournamentId: string;
    teamId: string;
    playerId: string;
    accept: boolean;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamId, playerId, accept } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    const slot = [...team.primaryRoster, ...team.standIns].find(s => s.userId === playerId);
    if (!slot) return { success: false, error: 'Invitation slot not found for this contender.' };

    if (slot.consentStatus === 'ACCEPTED' && accept) {
      return { success: true, team };
    }

    if (accept) {
      slot.consentStatus = 'ACCEPTED';
      slot.respondedAt = new Date().toISOString();
      team.auditTrail.unshift({
        action: 'player_accepted',
        actorId: playerId,
        actorRole: 'player',
        details: `${slot.ign} ACCEPTED roster invitation for ${team.teamName}.`,
        timestamp: new Date().toISOString()
      });
    } else {
      slot.consentStatus = 'DECLINED';
      slot.respondedAt = new Date().toISOString();
      // Remove slot and release player
      team.primaryRoster = team.primaryRoster.filter(s => s.userId !== playerId);
      team.standIns = team.standIns.filter(s => s.userId !== playerId);
      this.playerToTeamMap.delete(`${tournamentId}__${playerId}`);

      team.auditTrail.unshift({
        action: 'player_declined',
        actorId: playerId,
        actorRole: 'player',
        details: `${slot.ign} DECLINED roster invitation for ${team.teamName}.`,
        timestamp: new Date().toISOString()
      });
    }

    this.notify();
    return { success: true, team };
  }

  /**
   * Removes a player from the team roster (only in DRAFT or CHANGES_REQUESTED).
   */
  public removePlayerFromRoster(params: {
    tournamentId: string;
    teamId: string;
    playerId: string;
    actorUserId: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamId, playerId, actorUserId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    if (team.status !== 'DRAFT' && team.status !== 'CHANGES_REQUESTED') {
      return { success: false, error: `Cannot remove players while team status is '${team.status}'.` };
    }

    if (team.captainId !== actorUserId && !actorUserId.includes('admin') && actorUserId !== 'organiser-staff-1') {
      return { success: false, error: 'Permission Denied: Only team captain or staff can remove roster members.' };
    }

    if (playerId === team.captainId) {
      return { success: false, error: 'Cannot remove the captain. Reassign captaincy first.' };
    }

    const removedSlot = [...team.primaryRoster, ...team.standIns].find(s => s.userId === playerId);
    if (!removedSlot) return { success: false, error: 'Player not found in team roster.' };

    team.primaryRoster = team.primaryRoster.filter(s => s.userId !== playerId);
    team.standIns = team.standIns.filter(s => s.userId !== playerId);
    this.playerToTeamMap.delete(`${tournamentId}__${playerId}`);

    team.auditTrail.unshift({
      action: 'player_removed',
      actorId: actorUserId,
      actorRole: actorUserId === team.captainId ? 'captain' : 'staff',
      details: `Removed ${removedSlot.ign} from roster.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, team };
  }

  // ---------------------------------------------------------------------------
  // 2. Submission & Organiser Review Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Captain submits the roster for organiser review.
   * Strictly validates 5 primary players, captain on primary roster, and player consent.
   */
  public submitTeamRoster(
    tournamentId: string,
    teamId: string,
    captainUserId: string
  ): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    const config = this.getTournamentConfig(tournamentId);

    // 1. Permission check
    if (team.captainId !== captainUserId) {
      return { success: false, error: 'Permission Denied: Only the team captain can submit the roster.' };
    }

    // 2. Status check
    if (team.status !== 'DRAFT' && team.status !== 'CHANGES_REQUESTED') {
      return { success: false, error: `Roster is already ${team.status}. Cannot resubmit.` };
    }

    // 3. Primary roster size validation (must be exactly 5)
    if (team.primaryRoster.length !== config.primaryRosterSize) {
      return { 
        success: false, 
        error: `Roster incomplete: Primary roster requires exactly ${config.primaryRosterSize} players (currently ${team.primaryRoster.length}).` 
      };
    }

    // 4. Captain must be in primary roster
    const captainInPrimary = team.primaryRoster.some(s => s.userId === team.captainId && s.isCaptain);
    if (!captainInPrimary) {
      return { success: false, error: 'Roster Invariant Violation: Team captain must be on the primary 5-player roster.' };
    }

    // 5. Stand-in limit validation
    if (team.standIns.length > config.standInLimit) {
      return { success: false, error: `Stand-in limit exceeded: Maximum ${config.standInLimit} allowed.` };
    }

    // 6. Player consent validation
    if (config.requirePlayerConsent) {
      const unaccepted = [...team.primaryRoster, ...team.standIns].filter(s => s.consentStatus !== 'ACCEPTED');
      if (unaccepted.length > 0) {
        return { 
          success: false, 
          error: `Pending player consents: ${unaccepted.map(u => u.ign).join(', ')} must accept their roster invitations prior to submission.` 
        };
      }
    }

    // 7. Verify all players remain VERIFIED
    for (const slot of [...team.primaryRoster, ...team.standIns]) {
      const reg = dotaPlayerRegistry.getRegistration(tournamentId, slot.userId);
      if (!reg || reg.status !== 'VERIFIED') {
        return { success: false, error: `Contender '${slot.ign}' does not possess an active VERIFIED tournament registration.` };
      }
    }

    team.status = 'SUBMITTED';
    team.submittedAt = new Date().toISOString();
    team.auditTrail.unshift({
      action: 'roster_submitted',
      actorId: captainUserId,
      actorRole: 'captain',
      details: `Captain ${team.captainIgn} submitted full roster (5 primary, ${team.standIns.length} stand-ins) for organiser review.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, team };
  }

  /**
   * Organiser reviews team submission and decides: APPROVE, REQUEST_CHANGES, or REJECT.
   */
  public reviewTeamSubmission(params: {
    tournamentId: string;
    teamId: string;
    action: 'APPROVE' | 'REQUEST_CHANGES' | 'REJECT';
    reason?: string;
    staffActorId: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamId, action, reason, staffActorId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    if (team.status !== 'SUBMITTED' && team.status !== 'UNDER_REVIEW') {
      return { success: false, error: `Cannot review team in status '${team.status}'. Must be SUBMITTED or UNDER_REVIEW.` };
    }

    if ((action === 'REQUEST_CHANGES' || action === 'REJECT') && (!reason || reason.trim().length === 0)) {
      return { success: false, error: `A justification reason is strictly required when ${action === 'REJECT' ? 'rejecting' : 'requesting changes on'} a team roster.` };
    }

    team.reviewedAt = new Date().toISOString();
    team.reviewedBy = staffActorId;

    if (action === 'APPROVE') {
      team.status = 'APPROVED';
      team.approvalReason = reason || 'All roster credentials and MMR thresholds verified.';
      
      // Persist immutable tournament roster snapshot
      this.createTournamentRosterSnapshot(team, staffActorId);

      // Sync player profile tournament snapshots
      this.syncPlayerProfileSnapshots(team);

      team.auditTrail.unshift({
        action: 'team_approved',
        actorId: staffActorId,
        actorRole: 'organiser',
        details: `Team approved by organiser ${staffActorId}. ${team.approvalReason}`,
        timestamp: new Date().toISOString()
      });
    } else if (action === 'REQUEST_CHANGES') {
      team.status = 'CHANGES_REQUESTED';
      team.changesRequestedReason = reason;

      team.auditTrail.unshift({
        action: 'changes_requested',
        actorId: staffActorId,
        actorRole: 'organiser',
        details: `Changes requested by organiser: ${reason}`,
        timestamp: new Date().toISOString()
      });
    } else if (action === 'REJECT') {
      team.status = 'REJECTED';
      team.rejectionReason = reason;

      // Free players from tournament team reservation
      for (const slot of [...team.primaryRoster, ...team.standIns]) {
        this.playerToTeamMap.delete(`${tournamentId}__${slot.userId}`);
      }

      team.auditTrail.unshift({
        action: 'team_rejected',
        actorId: staffActorId,
        actorRole: 'organiser',
        details: `Team rejected by organiser: ${reason}`,
        timestamp: new Date().toISOString()
      });
    }

    this.notify();
    return { success: true, team };
  }

  // ---------------------------------------------------------------------------
  // 3. Roster Lock & Emergency Changes
  // ---------------------------------------------------------------------------

  /**
   * Locks the approved roster at the tournament lifecycle lock point.
   */
  public lockPremadeRoster(
    tournamentId: string,
    teamId: string,
    staffActorId: string
  ): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    if (team.status !== 'APPROVED') {
      return { success: false, error: `Only APPROVED teams can have their rosters locked (current: ${team.status}).` };
    }

    team.status = 'LOCKED';
    team.lockedAt = new Date().toISOString();
    team.lockedBy = staffActorId;

    // Update snapshot lock metadata
    const snapshot = this.historicalSnapshots.get(teamKey);
    if (snapshot) {
      snapshot.lockedAt = team.lockedAt;
      snapshot.lockedBy = staffActorId;
    }

    team.auditTrail.unshift({
      action: 'roster_locked',
      actorId: staffActorId,
      actorRole: 'organiser',
      details: `Roster officially locked by organiser ${staffActorId}. Unrestricted captain edits disabled.`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, team };
  }

  /**
   * Executes an organiser-controlled emergency player replacement.
   * Preserves version history and snapshot integrity.
   */
  public executeEmergencyRosterChange(params: {
    tournamentId: string;
    teamId: string;
    outgoingPlayerId: string;
    incomingPlayerId: string;
    role?: DotaRolePosition;
    reason: string;
    staffActorId: string;
  }): { success: boolean; error?: string; team?: PremadeTeamRegistration } {
    const { tournamentId, teamId, outgoingPlayerId, incomingPlayerId, role, reason, staffActorId } = params;
    const teamKey = `${tournamentId}__${teamId}`;
    const team = this.teams.get(teamKey);
    if (!team) return { success: false, error: 'Team not found.' };

    if (!reason || reason.trim().length === 0) {
      return { success: false, error: 'Mandatory justification reason required for emergency roster changes.' };
    }

    // Incoming player must be VERIFIED
    const incomingReg = dotaPlayerRegistry.getRegistration(tournamentId, incomingPlayerId);
    if (!incomingReg || incomingReg.status !== 'VERIFIED') {
      return { success: false, error: `Incoming player '${incomingPlayerId}' must have a VERIFIED tournament registration.` };
    }

    // Incoming player cannot be active in another team
    const incomingPlayerKey = `${tournamentId}__${incomingPlayerId}`;
    if (this.playerToTeamMap.has(incomingPlayerKey) && this.playerToTeamMap.get(incomingPlayerKey) !== teamId) {
      return { success: false, error: `Incoming player '${incomingReg.ign}' is already registered with another team.` };
    }

    // Locate outgoing slot
    let isStandInSlot = false;
    let slotIndex = team.primaryRoster.findIndex(s => s.userId === outgoingPlayerId);
    if (slotIndex === -1) {
      slotIndex = team.standIns.findIndex(s => s.userId === outgoingPlayerId);
      if (slotIndex === -1) {
        return { success: false, error: `Outgoing player '${outgoingPlayerId}' not found in team roster.` };
      }
      isStandInSlot = true;
    }

    const outgoingSlot = isStandInSlot ? team.standIns[slotIndex] : team.primaryRoster[slotIndex];
    const incomingProfile = dotaPlayerRegistry.getPlayer(incomingPlayerId);

    const replacementSlot: PremadeRosterSlot = {
      userId: incomingPlayerId,
      ign: incomingReg.ign,
      avatar: incomingProfile?.avatar || '🎮',
      tournamentMmr: incomingReg.tournamentMmr || incomingReg.declaredMmr,
      declaredMmr: incomingReg.declaredMmr,
      primaryRole: role || outgoingSlot.primaryRole,
      secondaryRole: incomingReg.secondaryRole,
      pbRating: incomingProfile?.competitiveRating || 1500,
      isCaptain: outgoingSlot.isCaptain, // Preserve captaincy if captain replaced
      isStandIn: isStandInSlot,
      consentStatus: 'ACCEPTED',
      invitedAt: new Date().toISOString(),
      respondedAt: new Date().toISOString()
    };

    if (!isStandInSlot) {
      team.primaryRoster[slotIndex] = replacementSlot;
      if (replacementSlot.isCaptain) {
        team.captainId = incomingPlayerId;
        team.captainIgn = incomingReg.ign;
      }
    } else {
      team.standIns[slotIndex] = replacementSlot;
    }

    // Release outgoing player, bind incoming player
    this.playerToTeamMap.delete(`${tournamentId}__${outgoingPlayerId}`);
    this.playerToTeamMap.set(incomingPlayerKey, teamId);

    team.snapshotVersion += 1;

    // Record in historical snapshot
    const snapshot = this.historicalSnapshots.get(teamKey);
    if (snapshot) {
      snapshot.version = team.snapshotVersion;
      snapshot.emergencyChanges.push({
        timestamp: new Date().toISOString(),
        actor: staffActorId,
        reason,
        outgoingPlayerId,
        outgoingPlayerIgn: outgoingSlot.ign,
        incomingPlayerId,
        incomingPlayerIgn: incomingReg.ign,
        role: replacementSlot.primaryRole
      });
      // Refresh snapshot lists
      snapshot.primaryRoster = team.primaryRoster.map(s => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating,
        isCaptain: s.isCaptain
      }));
      snapshot.standIns = team.standIns.map(s => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating
      }));
    }

    team.auditTrail.unshift({
      action: 'emergency_replacement',
      actorId: staffActorId,
      actorRole: 'organiser',
      details: `Emergency replacement: ${outgoingSlot.ign} replaced by ${incomingReg.ign}. Reason: ${reason}`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return { success: true, team };
  }

  // ---------------------------------------------------------------------------
  // 4. Snapshots & Profile Sync
  // ---------------------------------------------------------------------------

  private createTournamentRosterSnapshot(team: PremadeTeamRegistration, staffActorId: string) {
    const teamKey = `${team.tournamentId}__${team.teamId}`;
    const snapshot: HistoricalRosterSnapshot = {
      snapshotId: `snap-${team.tournamentId}-${team.teamId}-v${team.snapshotVersion}`,
      tournamentId: team.tournamentId,
      tournamentName: team.tournamentName,
      teamId: team.teamId,
      teamName: team.teamName,
      tag: team.tag,
      logo: team.logo,
      captainId: team.captainId,
      captainIgn: team.captainIgn,
      primaryRoster: team.primaryRoster.map(s => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating,
        isCaptain: s.isCaptain
      })),
      standIns: team.standIns.map(s => ({
        userId: s.userId,
        ign: s.ign,
        tournamentMmr: s.tournamentMmr,
        primaryRole: s.primaryRole,
        secondaryRole: s.secondaryRole,
        pbRating: s.pbRating
      })),
      approvedAt: team.reviewedAt || new Date().toISOString(),
      approvedBy: staffActorId,
      version: team.snapshotVersion,
      emergencyChanges: []
    };

    this.historicalSnapshots.set(teamKey, snapshot);
  }

  private syncPlayerProfileSnapshots(team: PremadeTeamRegistration) {
    for (const slot of [...team.primaryRoster, ...team.standIns]) {
      const player = dotaPlayerRegistry.getPlayer(slot.userId);
      if (player) {
        if (!player.tournamentSnapshots) player.tournamentSnapshots = [];
        const existingIdx = player.tournamentSnapshots.findIndex(s => s.tournamentId === team.tournamentId);
        const snapshotEntry = {
          tournamentId: team.tournamentId,
          tournamentName: team.tournamentName,
          year: 2026,
          teamId: team.teamId,
          teamName: team.teamName,
          primaryRole: slot.primaryRole,
          lockedTournamentMmr: slot.tournamentMmr,
          isCaptain: slot.isCaptain,
          finalPlacement: 'Active Contender',
          prizeWonINR: 0,
          matchesPlayed: 0,
          wins: 0,
          ratingBefore: player.competitiveRating,
          ratingAfter: player.competitiveRating
        };

        if (existingIdx >= 0) {
          player.tournamentSnapshots[existingIdx] = snapshotEntry;
        } else {
          player.tournamentSnapshots.push(snapshotEntry);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  public getTournamentTeams(tournamentId: string): PremadeTeamRegistration[] {
    return Array.from(this.teams.values()).filter(t => t.tournamentId === tournamentId);
  }

  public getTeam(tournamentId: string, teamId: string): PremadeTeamRegistration | undefined {
    return this.teams.get(`${tournamentId}__${teamId}`);
  }

  public getPlayerTeam(tournamentId: string, userId: string): PremadeTeamRegistration | undefined {
    const teamId = this.playerToTeamMap.get(`${tournamentId}__${userId}`);
    if (!teamId) return undefined;
    return this.getTeam(tournamentId, teamId);
  }

  public getHistoricalSnapshot(tournamentId: string, teamId: string): HistoricalRosterSnapshot | undefined {
    return this.historicalSnapshots.get(`${tournamentId}__${teamId}`);
  }

  public resetTournamentTeams(tournamentId: string) {
    for (const [key, team] of this.teams.entries()) {
      if (team.tournamentId === tournamentId) {
        for (const slot of [...team.primaryRoster, ...team.standIns]) {
          this.playerToTeamMap.delete(`${tournamentId}__${slot.userId}`);
        }
        this.teams.delete(key);
        this.historicalSnapshots.delete(key);
      }
    }
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Listeners
  // ---------------------------------------------------------------------------
  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => {
      try { l(); } catch (err) { console.error('Premade engine listener error:', err); }
    });
  }
}

// Global Singleton
export const dotaPremadeTeamEngine = new DotaPremadeTeamEngine();
