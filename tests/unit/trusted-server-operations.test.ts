import { describe, it, expect, beforeEach } from 'vitest';
import { 
  TrustedTournamentServer, 
  ServerCallerContext 
} from '../../src/server/trustedTournamentOperations';
import { 
  MOCK_TOURNAMENTS, 
  MOCK_MATCHES, 
  MOCK_TEAMS, 
  MOCK_AUCTION_TEAMS, 
  MOCK_AUCTION_PLAYER,
  MOCK_PLAYERS,
  MOCK_BRACKET_NODES
} from '../../src/data/mockData';

describe('Trusted Server Authoritative Operations', () => {
  let server: TrustedTournamentServer;

  beforeEach(() => {
    server = new TrustedTournamentServer({
      auctionState: {
        tournamentId: 'purple-bean-india-masters-2026',
        status: 'open',
        revision: 1,
        currentBid: MOCK_AUCTION_PLAYER.currentBid,
        leadingTeamId: 't-1',
        leadingTeamName: 'Purple Bean Titans',
        currentPlayer: MOCK_PLAYERS[2],
        secondsLeft: 22,
        bidHistory: [...MOCK_AUCTION_PLAYER.bidHistory],
        soldPlayers: [
          { playerId: 'p-1', teamId: 't-1', amount: 320000 },
          { playerId: 'p-2', teamId: 't-2', amount: 290000 }
        ],
        unsoldPlayers: [],
        unselectedPlayers: ['p-9', 'p-13', 'p-14', 'p-15', 'p-16']
      },
      teamBudgets: [...MOCK_AUCTION_TEAMS],
      tournaments: [...MOCK_TOURNAMENTS],
      matches: [...MOCK_MATCHES],
      teams: [...MOCK_TEAMS],
      brackets: [...MOCK_BRACKET_NODES]
    });
  });

  const organizerCaller: ServerCallerContext = {
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'organizer@purplebeangaming.com',
    role: 'organizer',
    teamId: 't-1',
    isAdmin: true
  };

  const captainCallerT2: ServerCallerContext = {
    userId: '00000000-0000-4000-8000-000000000002',
    email: 'captain.mumbai@purplebeangaming.com',
    role: 'captain',
    teamId: 't-2'
  };

  const spectatorCaller: ServerCallerContext = {
    userId: 'guest-spectator',
    email: 'spectator@purplebeangaming.com',
    role: 'spectator'
  };

  describe('1. Server-Authoritative Auction Bids', () => {
    it('successfully processes valid bid from authorized captain', () => {
      const res = server.executeAuthoritativeBid(captainCallerT2, {
        tournamentId: 'purple-bean-india-masters-2026',
        teamId: 't-2',
        incrementAmount: 10000,
        expectedRevision: 1
      });

      expect(res.success).toBe(true);
      expect(res.currentBid).toBe(MOCK_AUCTION_PLAYER.currentBid + 10000);
      expect(res.revision).toBe(2);
      expect(res.leadingTeamName).toBe('Mumbai Cobras');
    });

    it('rejects bid when auction revision is stale (optimistic lock)', () => {
      // First bid updates revision to 2
      server.executeAuthoritativeBid(captainCallerT2, {
        tournamentId: 'purple-bean-india-masters-2026',
        teamId: 't-2',
        incrementAmount: 10000,
        expectedRevision: 1
      });

      // Second bid attempts with stale revision 1 -> must throw Concurrency Conflict
      expect(() => {
        server.executeAuthoritativeBid(organizerCaller, {
          tournamentId: 'purple-bean-india-masters-2026',
          teamId: 't-1',
          incrementAmount: 10000,
          expectedRevision: 1
        });
      }).toThrow('Concurrency Conflict');
    });

    it('denies bid from unprivileged spectators', () => {
      expect(() => {
        server.executeAuthoritativeBid(spectatorCaller, {
          tournamentId: 'purple-bean-india-masters-2026',
          teamId: 't-1',
          incrementAmount: 10000,
          expectedRevision: 1
        });
      }).toThrow('Unauthorized');
    });

    it('denies captain from bidding for a rival team', () => {
      expect(() => {
        server.executeAuthoritativeBid(captainCallerT2, {
          tournamentId: 'purple-bean-india-masters-2026',
          teamId: 't-1', // Rival team
          incrementAmount: 10000,
          expectedRevision: 1
        });
      }).toThrow("Captain cannot submit bids on behalf of rival team 't-1'");
    });
  });

  describe('2. Server-Authoritative Auction Conclusion & UNSELECTED Handling', () => {
    it('correctly concludes item as UNSOLD without winning bid and preserves UNSELECTED', () => {
      const res = server.executeAuthoritativeAuctionConclusion(organizerCaller, {
        tournamentId: 'purple-bean-india-masters-2026',
        sellToWinner: false
      });

      expect(res.outcome).toBe('UNSOLD');
      const snap = server.getAuctionSnapshot();
      expect(snap.unsoldPlayers.length).toBe(1);
      expect(snap.unselectedPlayers.length).toBeGreaterThan(0);
    });

    it('denies non-organizers from concluding auction items', () => {
      expect(() => {
        server.executeAuthoritativeAuctionConclusion(captainCallerT2, {
          tournamentId: 'purple-bean-india-masters-2026',
          sellToWinner: true
        });
      }).toThrow('Unauthorized');
    });
  });

  describe('3. Server-Authoritative Match Finalization & Correction', () => {
    it('finalizes match and calculates rating deterministically', () => {
      const res = server.executeAuthoritativeMatchFinalization(organizerCaller, {
        matchId: 'm-live-1',
        scoreA: 2,
        scoreB: 1,
        winnerId: 't-1'
      });

      expect(res.success).toBe(true);
      expect(res.ratingRecord.delta).toBeGreaterThan(0);
      expect(res.ratingRecord.winnerNewRating).toBeGreaterThan(res.ratingRecord.winnerPreviousRating);
    });

    it('corrects match result and recalculates standings and brackets', () => {
      // First finalize as t-1 winning
      server.executeAuthoritativeMatchFinalization(organizerCaller, {
        matchId: 'm-live-1',
        scoreA: 2,
        scoreB: 0,
        winnerId: 't-1'
      });

      // Referee issues correction: t-2 actually won 2-1
      const correction = server.executeAuthoritativeMatchCorrection(organizerCaller, {
        matchId: 'm-live-1',
        newScoreA: 1,
        newScoreB: 2,
        newWinnerId: 't-2',
        reason: 'Server demo playback verified disputed defuse'
      });

      expect(correction.correctedWinnerId).toBe('t-2');
      expect(correction.ratingRecord.winnerTeamId).toBe('t-2');
      expect(correction.updatedStandings.length).toBeGreaterThan(0);
      expect(correction.auditEvent.details).toContain('Server demo playback verified disputed defuse');
    });
  });

  describe('4. Server-Appended Audit Logs', () => {
    it('automatically generates server audit log on actions and protects it from spectators', () => {
      server.executeAuthoritativeBid(captainCallerT2, {
        tournamentId: 'purple-bean-india-masters-2026',
        teamId: 't-2',
        incrementAmount: 10000,
        expectedRevision: 1
      });

      // Organizer can inspect logs
      const logs = server.getAuditLogs(organizerCaller);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].action).toBe('bid_accepted');

      // Spectator is denied
      expect(() => {
        server.getAuditLogs(spectatorCaller);
      }).toThrow('Unauthorized');
    });
  });
});
