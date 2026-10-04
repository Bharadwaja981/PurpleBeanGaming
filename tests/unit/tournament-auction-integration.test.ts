process.env.NODE_ENV = 'test';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TournamentRegistrationRecord,
  TournamentParticipantRecord,
  TournamentTeamRecord,
  TournamentDiscordConfig,
  evaluateRegistrationEligibility,
  createParticipantFromApprovedRegistration,
  assignParticipantAsCaptain,
  removeParticipantFromCaptain,
  validateAuctionReadiness
} from '../../src/domain/tournamentRegistrationEngine';
import {
  calculateTournamentAverageMMR,
  calculateTeamMMR,
  validateBidFeasibility,
  validateAuctionRuntimeIntegrity,
  DEFAULT_AUCTION_CONFIG,
  AuthoritativeAuctionSession,
  AuthoritativeAuctionPlayer,
  AuthoritativeAuctionTeam
} from '../../src/domain/tournamentAuctionEngine';
import {
  inMemoryRegistrations,
  inMemoryCaptains,
  inMemoryLifecycles,
  reviewTournamentRegistrationAuthoritative,
  selectTournamentCaptainAuthoritative,
  setTournamentLifecycleAuthoritative,
  clearRegistrationLocks
} from '../../src/server/tournamentRegistrationOperations';
import {
  inMemoryParticipants,
  inMemoryTournamentTeams,
  inMemorySyncJobs,
  syncDiscordTournamentRoles
} from '../../src/server/discordTournamentSyncService';
import {
  inMemoryAuctionSessions,
  startAuctionSessionAuthoritative,
  resolveCaptainAuthorization,
  nominatePlayerAuthoritative,
  placeBidAuthoritative,
  finalizeNominationLotAuthoritative,
  reintroduceUnsoldPlayerAuthoritative,
  startStandInPhaseAuthoritative,
  handleAuctionCompletedAuthoritative,
  finalizeAuctionTeamsAuthoritative,
  updateTeamBrandingAuthoritative,
  executeAuctionCorrectionAuthoritative,
  clearAuctionLocks
} from '../../src/server/tournamentAuctionOperations';
import { pbgAccountRegistry } from '../../src/domain/pbgAccountRegistry';

const TEST_TOURNEY_ID = 'auction-e2e-tourney-01';
const DISCORD_PBG_MEMBER_ROLE_ID = '1555885374713237524';
const DISCORD_PBG_PLAYER_ROLE_ID = '1555884061111746651';
const DISCORD_PBG_CAPTAIN_ROLE_ID = '1556338549807259658';
const GUILD_ID = '631715510631006219';

const mockDiscordConfig: TournamentDiscordConfig = {
  enabled: true,
  guildId: GUILD_ID,
  roles: {
    tournamentPlayerRoleId: DISCORD_PBG_PLAYER_ROLE_ID,
    captainRoleId: DISCORD_PBG_CAPTAIN_ROLE_ID
  },
  teamRolesEnabled: true,
  cleanupPolicy: {
    onElimination: true,
    onTournamentCompletion: true
  }
};

describe('PurpleBeanGaming Auction Integration Phase — Complete End-to-End Suite', () => {
  beforeEach(() => {
    inMemoryRegistrations.delete(TEST_TOURNEY_ID);
    inMemoryParticipants.delete(TEST_TOURNEY_ID);
    inMemoryCaptains.delete(TEST_TOURNEY_ID);
    inMemoryTournamentTeams.delete(TEST_TOURNEY_ID);
    inMemoryAuctionSessions.delete(TEST_TOURNEY_ID);
    inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_OPEN');
    inMemorySyncJobs.clear();
    clearAuctionLocks();
    clearRegistrationLocks();
  });

  // Helper to register, approve, and seed players
  function seedFullTournament(params: {
    captainCount: number;
    playerCount: number;
  }) {
    const regMap = new Map<string, TournamentRegistrationRecord>();
    const pMap = new Map<string, TournamentParticipantRecord>();

    // 1. Seed Captains
    for (let i = 1; i <= params.captainCount; i++) {
      const uid = `cap-${i}`;
      const pbgId = `PBG-CAP-00${i}`;
      pbgAccountRegistry.registerOrUpdateAccount({
        googleUid: uid,
        pbgId,
        displayName: `Captain ${i}`,
        email: `cap${i}@test.com`,
        discordUserId: `discord-cap-${i}`,
        steamId: `7656119800000001${i}`,
        dotaAccountId: String(100000010 + i),
        accountStatus: 'ACTIVE',
        discordLinked: true,
        discordMemberVerified: true
      });

      const reg: TournamentRegistrationRecord = {
        id: uid,
        tournamentId: TEST_TOURNEY_ID,
        userId: uid,
        pbgId,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        captainApplicant: true,
        primaryRole: 'Position 1 — Carry',
        secondaryRole: 'Position 2 — Mid',
        declaredMMR: 5000,
        tournamentMMR: 5000,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        identitySnapshot: {
          pbgId,
          displayName: `Captain ${i}`,
          discordUserId: `discord-cap-${i}`,
          steamId64: `7656119800000001${i}`,
          dotaAccountId: 100000010 + i
        },
        tournamentData: {
          declaredMMR: 5000,
          tournamentMMR: 5000,
          primaryRole: 'Position 1 — Carry',
          secondaryRole: 'Position 2 — Mid',
          captainApplicant: true,
          availabilityConfirmed: true,
          rulesAccepted: true
        }
      };
      regMap.set(uid, reg);

      const part: TournamentParticipantRecord = {
        id: `part-${uid}`,
        tournamentId: TEST_TOURNEY_ID,
        userId: uid,
        pbgId,
        displayName: `Captain ${i}`,
        tournamentRole: 'CAPTAIN',
        participantStatus: 'ACTIVE',
        captainSlotId: `slot-${i}`,
        auctionStatus: 'NOT_IN_POOL',
        teamId: null,
        eliminated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      pMap.set(uid, part);
    }

    // 2. Seed Pool Players
    for (let i = 1; i <= params.playerCount; i++) {
      const uid = `player-${i}`;
      const pbgId = `PBG-PLY-00${i}`;
      pbgAccountRegistry.registerOrUpdateAccount({
        googleUid: uid,
        pbgId,
        displayName: `Player ${i}`,
        email: `ply${i}@test.com`,
        discordUserId: `discord-ply-${i}`,
        steamId: `7656119800000002${i}`,
        dotaAccountId: String(200000010 + i),
        accountStatus: 'ACTIVE',
        discordLinked: true,
        discordMemberVerified: true
      });

      const reg: TournamentRegistrationRecord = {
        id: uid,
        tournamentId: TEST_TOURNEY_ID,
        userId: uid,
        pbgId,
        status: 'APPROVED',
        eligibilityStatus: 'ELIGIBLE',
        captainApplicant: false,
        primaryRole: 'Position 2 — Mid',
        secondaryRole: 'Position 3 — Offlane',
        declaredMMR: 5000,
        tournamentMMR: 5000,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        identitySnapshot: {
          pbgId,
          displayName: `Player ${i}`,
          discordUserId: `discord-ply-${i}`,
          steamId64: `7656119800000002${i}`,
          dotaAccountId: 200000010 + i
        },
        tournamentData: {
          declaredMMR: 5000,
          tournamentMMR: 5000,
          primaryRole: 'Position 2 — Mid',
          secondaryRole: 'Position 3 — Offlane',
          captainApplicant: false,
          availabilityConfirmed: true,
          rulesAccepted: true
        }
      };
      regMap.set(uid, reg);

      const part: TournamentParticipantRecord = {
        id: `part-${uid}`,
        tournamentId: TEST_TOURNEY_ID,
        userId: uid,
        pbgId,
        displayName: `Player ${i}`,
        tournamentRole: 'PLAYER',
        participantStatus: 'ACTIVE',
        captainSlotId: null,
        auctionStatus: 'AVAILABLE',
        teamId: null,
        eliminated: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      pMap.set(uid, part);
    }

    inMemoryRegistrations.set(TEST_TOURNEY_ID, regMap);
    inMemoryParticipants.set(TEST_TOURNEY_ID, pMap);
  }

  // =========================================================================
  // 1. AUCTION INPUT CONTRACT & START GATE
  // =========================================================================
  describe('1. Authoritative Auction Input Contract & Start Gate', () => {
    it('rejects starting auction when tournament is NOT AUCTION_READY (e.g., registration still open)', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_OPEN');

      await expect(
        startAuctionSessionAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        })
      ).rejects.toThrow(/AUCTION_GATE_BLOCKED/);
    });

    it('rejects starting auction if captain appears in auctionPool (violates captain exclusion)', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');

      // Erroneously put Captain 1 into pool
      const pMap = inMemoryParticipants.get(TEST_TOURNEY_ID)!;
      pMap.get('cap-1')!.auctionStatus = 'AVAILABLE';

      await expect(
        startAuctionSessionAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        })
      ).rejects.toThrow(/AUCTION_GATE_BLOCKED/);
    });

    it('successfully initializes auction session strictly from authoritative participants when AUCTION_READY', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');

      const { session, integrity } = await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: {
          pursePerTeam: 1000,
          minimumBid: 50,
          bidIncrement: 10,
          primaryRosterSize: 5,
          standInLimit: 1
        }
      });

      expect(session.status).toBe('LIVE');
      expect(session.currentPhase).toBe('PRIMARY');
      expect(integrity.valid).toBe(true);

      // Verify captain teams: exactly 2 teams
      const teams = Object.values(session.teams);
      expect(teams.length).toBe(2);
      expect(teams[0].captainUserId).toBe('cap-1');
      expect(teams[1].captainUserId).toBe('cap-2');

      // Captain is counted in 5-player primary roster (1/5)
      expect(teams[0].primaryRosterUserIds).toEqual(['cap-1']);
      expect(teams[0].primaryRosterComplete).toBe(false);

      // Captain did NOT consume auction credits (1000 purse remaining)
      expect(teams[0].purseRemaining).toBe(1000);

      // Captains are SOLD and NOT in available pool
      expect(session.players['cap-1'].status).toBe('SOLD');
      expect(session.players['cap-2'].status).toBe('SOLD');

      // Available player pool contains only regular players
      const availablePlayers = Object.values(session.players).filter(p => p.status === 'AVAILABLE');
      expect(availablePlayers.length).toBe(10);
      expect(availablePlayers.some(p => p.userId === 'cap-1' || p.userId === 'cap-2')).toBe(false);
    });
  });

  // =========================================================================
  // 2. SERVER-SIDE CAPTAIN AUTHORIZATION & BIDDING PERMISSIONS
  // =========================================================================
  describe('2. Server-side Captain Authorization & Bidding Permissions', () => {
    beforeEach(async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: { pursePerTeam: 1000, minimumBid: 50, bidIncrement: 10 }
      });
    });

    it('resolves server-side captain authorization strictly from UID -> participant -> CAPTAIN -> slot -> team', () => {
      const capAuth = resolveCaptainAuthorization({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1'
      });
      expect(capAuth.authorized).toBe(true);
      expect(capAuth.team?.captainUserId).toBe('cap-1');

      // Regular player cannot be authorized as captain
      const playerAuth = resolveCaptainAuthorization({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'player-1'
      });
      expect(playerAuth.authorized).toBe(false);
      expect(playerAuth.error).toMatch(/NOT_A_CAPTAIN/);

      // Unknown user
      const strangerAuth = resolveCaptainAuthorization({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'stranger-999'
      });
      expect(strangerAuth.authorized).toBe(false);
    });

    it('rejects nomination by non-captain without organizer override', async () => {
      await expect(
        nominatePlayerAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'player-1', // regular player
          playerId: 'player-2'
        })
      ).rejects.toThrow(/NOT_A_CAPTAIN|UNAUTHORIZED/);
    });

    it('allows captain to nominate an AVAILABLE pool player with opening bid', async () => {
      const session = await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1',
        openingBid: 50
      });

      expect(session.currentNomination).not.toBeNull();
      expect(session.currentNomination?.nominatedPlayerId).toBe('player-1');
      expect(session.currentNomination?.currentBid).toBe(50);
      expect(session.currentNomination?.currentLeaderCaptainId).toBe('cap-1');
      expect(session.players['player-1'].status).toBe('NOMINATED');
    });

    it('denies a non-captain from placing bids', async () => {
      // Nominate player
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1'
      });

      // Regular player attempts bid
      await expect(
        placeBidAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'player-2',
          bidAmount: 60
        })
      ).rejects.toThrow(/NOT_A_CAPTAIN|UNAUTHORIZED/);
    });

    it('denies current high bidder from bidding against themselves', async () => {
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1'
      });

      // Captain 1 is already opening bidder (50)
      await expect(
        placeBidAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-1',
          bidAmount: 70
        })
      ).rejects.toThrow(/ALREADY_HIGH_BIDDER/);
    });

    it('accepts valid competing bid from rival captain and updates leading team', async () => {
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1'
      });

      const { session, bidRecord } = await placeBidAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-2',
        bidAmount: 60
      });

      expect(session.currentNomination?.currentBid).toBe(60);
      expect(session.currentNomination?.currentLeaderCaptainId).toBe('cap-2');
      expect(bidRecord.amount).toBe(60);
      expect(bidRecord.captainUserId).toBe('cap-2');
    });
  });

  // =========================================================================
  // 3. MATHEMATICAL PURSE & RESERVE RULES
  // =========================================================================
  describe('3. Mathematical Purse & Reserve Rules', () => {
    beforeEach(async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: {
          pursePerTeam: 1000,
          minimumBid: 50,
          bidIncrement: 10,
          primaryRosterSize: 5
        }
      });
    });

    it('enforces mathematical reserve: a team must retain enough credits for all remaining mandatory slots', async () => {
      // Team 2 needs 4 players to reach 5.
      // If bidding on 1st player, team needs 3 remaining slots * 50 minimumBid = 150 reserve.
      // Purse = 1000. Max allowable bid = 1000 - 150 = 850.
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1'
      });

      // Bid of 900 leaves only 100 credits, violating 150 reserve
      await expect(
        placeBidAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-2',
          bidAmount: 900
        })
      ).rejects.toThrow(/Reserve Rule/i);

      // Bid of 850 exactly satisfies the 150 reserve
      const { session } = await placeBidAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-2',
        bidAmount: 850
      });
      expect(session.currentNomination?.currentBid).toBe(850);
    });

    it('rejects bids that exceed total available team purse', async () => {
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1'
      });

      await expect(
        placeBidAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-2',
          bidAmount: 1100
        })
      ).rejects.toThrow(/Insufficient credits/i);
    });
  });

  // =========================================================================
  // 4. SOLD FLOW & SUSPENSION OF COMPLETED TEAMS
  // =========================================================================
  describe('4. Sold Flow & Completed Team Suspension', () => {
    beforeEach(async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: {
          pursePerTeam: 1000,
          minimumBid: 50,
          bidIncrement: 10,
          primaryRosterSize: 5
        }
      });
    });

    it('finalizes a winning nomination to SOLD, deducts credits, updates team and participant records', async () => {
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1',
        openingBid: 100
      });

      const { session, result, player, team } = await finalizeNominationLotAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      expect(result).toBe('SOLD');
      expect(player.status).toBe('SOLD');
      expect(player.soldAmount).toBe(100);
      expect(team?.primaryRosterUserIds).toContain('player-1');
      expect(team?.purseRemaining).toBe(900); // 1000 - 100
      expect(session.currentNomination).toBeNull();

      // Check authoritative participant record updated
      const participant = inMemoryParticipants.get(TEST_TOURNEY_ID)!.get('player-1')!;
      expect(participant.auctionStatus).toBe('SOLD');
      expect(participant.teamId).toBe(team?.teamId);
    });

    it('suspends a team from primary bidding as soon as it reaches 5/5 players', async () => {
      // Fill Team 1 to 5 players (Captain 1 + player-1, 2, 3, 4)
      for (let i = 1; i <= 4; i++) {
        await nominatePlayerAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-1',
          playerId: `player-${i}`,
          openingBid: 50
        });
        await finalizeNominationLotAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        });
      }

      const session = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      const team1 = Object.values(session.teams).find(t => t.captainUserId === 'cap-1')!;
      expect(team1.primaryRosterUserIds.length).toBe(5);
      expect(team1.primaryRosterComplete).toBe(true);

      // Nominate player-5 by Captain 2
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-2',
        playerId: 'player-5',
        openingBid: 50
      });

      // Captain 1 tries to bid on player-5 -> Must be rejected because team 1 primary roster is complete!
      await expect(
        placeBidAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-1',
          bidAmount: 60
        })
      ).rejects.toThrow(/suspended from primary bidding/i);
    });
  });

  // =========================================================================
  // 5. UNSOLD FLOW & RE-AUCTION RESTRICTIONS
  // =========================================================================
  describe('5. Unsold Flow & Re-Auction Pool Exhaustion Rule', () => {
    beforeEach(async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: { pursePerTeam: 1000, minimumBid: 50, bidIncrement: 10 }
      });
    });

    it('concludes a nomination with no winning bids to UNSOLD', async () => {
      // Organizer nominates without initial captain leader
      const sessionBefore = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      sessionBefore.players['player-1'].status = 'NOMINATED';
      sessionBefore.currentNomination = {
        nominatedPlayerId: 'player-1',
        nominatedByCaptainId: 'organizer-admin',
        nominatedAt: new Date().toISOString(),
        openingBid: 50,
        currentBid: 0,
        bidCount: 0,
        expiresAt: Date.now() + 10000,
        phase: 'PRIMARY'
      };

      const { result, player } = await finalizeNominationLotAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      expect(result).toBe('UNSOLD');
      expect(player.status).toBe('UNSOLD');
    });

    it('prohibits re-auctioning an UNSOLD player while regular AVAILABLE players remain in pool', async () => {
      // Mark player-1 as UNSOLD
      const session = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      session.players['player-1'].status = 'UNSOLD';

      // 9 regular AVAILABLE players still remain
      await expect(
        reintroduceUnsoldPlayerAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin',
          playerId: 'player-1'
        })
      ).rejects.toThrow(/AVAILABLE_POOL_NOT_EXHAUSTED/);

      // Organizer can force override if explicitly configured
      const updated = await reintroduceUnsoldPlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        playerId: 'player-1',
        forceOverride: true
      });
      expect(updated.players['player-1'].status).toBe('AVAILABLE');
    });
  });

  // =========================================================================
  // 6. STAND-IN PHASE TRANSITION & LIFECYCLE
  // =========================================================================
  describe('6. Stand-in Phase Transition & Lifecycle', () => {
    beforeEach(async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: { pursePerTeam: 1000, minimumBid: 50, primaryRosterSize: 5 }
      });
    });

    it('rejects starting stand-in phase if any team has incomplete primary roster', async () => {
      await expect(
        startStandInPhaseAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        })
      ).rejects.toThrow(/PRIMARY_ROSTERS_INCOMPLETE/);
    });

    it('transitions to PRIMARY_ROSTERS_COMPLETE when all teams reach 5/5, then starts stand-in phase', async () => {
      const session = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      const [t1, t2] = Object.values(session.teams);

      // Draft 4 players for team 1
      for (let i = 1; i <= 4; i++) {
        await nominatePlayerAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-1',
          playerId: `player-${i}`,
          openingBid: 50
        });
        await finalizeNominationLotAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        });
      }

      // Draft 4 players for team 2
      for (let i = 5; i <= 8; i++) {
        await nominatePlayerAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'cap-2',
          playerId: `player-${i}`,
          openingBid: 50
        });
        await finalizeNominationLotAuthoritative({
          tournamentId: TEST_TOURNEY_ID,
          actorUserId: 'organizer-admin'
        });
      }

      expect(session.status).toBe('PRIMARY_ROSTERS_COMPLETE');
      expect(t1.primaryRosterUserIds.length).toBe(5);
      expect(t2.primaryRosterUserIds.length).toBe(5);

      // Now organizer can start stand-in phase
      const standInSession = await startStandInPhaseAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });
      expect(standInSession.status).toBe('STANDIN_PHASE');
      expect(standInSession.currentPhase).toBe('STAND_IN');

      // Draft player-9 as stand-in for Team 1
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-9',
        openingBid: 50
      });
      const lotRes = await finalizeNominationLotAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      expect(lotRes.result).toBe('SOLD');
      expect(lotRes.player.isStandIn).toBe(true);
      expect(t1.standInUserIds).toEqual(['player-9']);
      expect(t1.standInComplete).toBe(true);
    });
  });

  // =========================================================================
  // 7. COMPLETION & UNSELECTED PLAYERS DISTINCTION
  // =========================================================================
  describe('7. Auction Completion & Strict Separation of UNSELECTED vs UNSOLD', () => {
    it('marks remaining untouched AVAILABLE players as UNSELECTED while preserving UNSOLD status', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      const session = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      // Mark player-1 as SOLD
      session.players['player-1'].status = 'SOLD';
      session.players['player-1'].teamId = 'team-1';

      // Mark player-2 as UNSOLD
      session.players['player-2'].status = 'UNSOLD';

      // Players 3..10 remain AVAILABLE

      const { totalSold, totalUnsold, totalUnselected } = await handleAuctionCompletedAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      expect(session.status).toBe('COMPLETED');
      expect(totalSold).toBe(3); // 2 captains + 1 player
      expect(totalUnsold).toBe(1);
      expect(totalUnselected).toBe(8);

      // Verify strict distinction: player-2 is UNSOLD, player-3 is UNSELECTED
      expect(session.players['player-2'].status).toBe('UNSOLD');
      expect(session.players['player-3'].status).toBe('UNSELECTED');
    });
  });

  // =========================================================================
  // 8. AUDITED ORGANIZER CORRECTIONS & DISCORD FINALIZATION
  // =========================================================================
  describe('8. Audited Organizer Corrections & Discord Integration', () => {
    it('correctly executes ROLLBACK_SALE: refunds purse, restores player to AVAILABLE, updates team MMR', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        configOverride: { pursePerTeam: 1000 }
      });

      // Nominate and sell player-1 to Team 1 for 150
      await nominatePlayerAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'cap-1',
        playerId: 'player-1',
        openingBid: 150
      });
      const { team } = await finalizeNominationLotAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      expect(team?.purseRemaining).toBe(850);

      // Execute ROLLBACK_SALE correction
      const correctedSession = await executeAuctionCorrectionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        action: 'ROLLBACK_SALE',
        payload: {
          playerId: 'player-1',
          teamId: team!.teamId
        }
      });

      const updatedTeam = correctedSession.teams[team!.teamId];
      expect(updatedTeam.purseRemaining).toBe(1000); // 850 + 150 refunded
      expect(updatedTeam.primaryRosterUserIds).not.toContain('player-1');
      expect(correctedSession.players['player-1'].status).toBe('AVAILABLE');
      expect(correctedSession.players['player-1'].teamId).toBeNull();
    });

    it('finalizes auction teams, generates Discord team role, and synchronizes desired roles', async () => {
      seedFullTournament({ captainCount: 2, playerCount: 10 });
      inMemoryLifecycles.set(TEST_TOURNEY_ID, 'REGISTRATION_CLOSED');
      await startAuctionSessionAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin'
      });

      const session = inMemoryAuctionSessions.get(TEST_TOURNEY_ID)!;
      const [team1] = Object.values(session.teams);

      // Mock Discord fetch handler
      const mockFetch: typeof fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('/roles') && init?.method === 'POST') {
          return new Response(JSON.stringify({ id: 'discord-role-alpha-99', name: team1.name }), { status: 200 });
        }
        if (url.includes('/roles/')) {
          return new Response('', { status: 204 });
        }
        return new Response(JSON.stringify({ roles: [DISCORD_PBG_MEMBER_ROLE_ID] }), { status: 200 });
      });

      const { finalizedTeams, discordRolesCreated } = await finalizeAuctionTeamsAuthoritative({
        tournamentId: TEST_TOURNEY_ID,
        actorUserId: 'organizer-admin',
        fetchFn: mockFetch
      });

      expect(finalizedTeams.length).toBe(2);
      expect(discordRolesCreated).toBeGreaterThan(0);
      expect(finalizedTeams[0].discord?.roleId).toBe('discord-role-alpha-99');
    });
  });
});
