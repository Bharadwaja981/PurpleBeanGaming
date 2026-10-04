/**
 * Purple Bean Gaming — Client-Side Auction Test Service
 * 
 * Safe browser client for communicating with server-authoritative test endpoints:
 * /api/tournaments/:tournamentId/test-tools/*
 * 
 * Never imports server-only modules or firebase-admin.
 */

import { auth } from './firebaseConfig';
import { tournamentService } from './firebaseService';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';
import {
  TEST_TOURNAMENT_ID,
  DUMMY_TEST_PLAYERS,
  DUMMY_TEST_CAPTAINS,
  TestCaptainActionAudit,
  isTournamentInTestMode
} from '../domain/auctionTestFixtures';

async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
    }
  } catch {}

  const user = tournamentService.getCurrentUser();
  const fallbackUid = user.email || user.id || '11106cm009@gmail.com';
  return {
    'Authorization': `Bearer test-token-${fallbackUid}`,
    'Content-Type': 'application/json'
  };
}

export interface TestIdentitiesState {
  tournamentId: string;
  testMode: boolean;
  registrations: any[];
  participants: any[];
  session: any | null;
  audits: TestCaptainActionAudit[];
}

export class AuctionTestClient {
  public async seedPlayers(tournamentId: string = TEST_TOURNAMENT_ID): Promise<{ success: boolean; count: number; players: any[] }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/seed-players`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to seed dummy test players.');
    }
    const data = await res.json();
    return data.result;
  }

  public async seedCaptains(tournamentId: string = TEST_TOURNAMENT_ID): Promise<{ success: boolean; count: number; captains: any[] }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/seed-captains`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to seed dummy test captains.');
    }
    const data = await res.json();
    return data.result;
  }

  public async assignCaptains(tournamentId: string = TEST_TOURNAMENT_ID): Promise<{ success: boolean; assigned: any[] }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/assign-captains`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to assign test captains.');
    }
    const data = await res.json();
    return data.result;
  }

  public async resetTestData(tournamentId: string = TEST_TOURNAMENT_ID, fullReset = false): Promise<{ success: boolean; message: string }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/reset-test-data`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fullResetIncludingReal: fullReset })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to reset auction test data.');
    }
    const data = await res.json();
    return data.result;
  }

  public async deleteFixtures(tournamentId: string = TEST_TOURNAMENT_ID): Promise<{ success: boolean; deletedCount: number }> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/delete-fixtures`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to delete dummy test fixtures.');
    }
    const data = await res.json();
    return data.result;
  }

  public async runIntegrityCheck(tournamentId: string = TEST_TOURNAMENT_ID): Promise<any> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/integrity-check`, {
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute auction integrity check.');
    }
    const data = await res.json();
    return data.report;
  }

  public async controlCaptainAction(
    tournamentId: string = TEST_TOURNAMENT_ID,
    actingAsTestCaptainUserId: string,
    action: any
  ): Promise<any> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/control-captain`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        actingAsTestCaptainUserId,
        action
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to execute captain action.');
    }
    return await res.json();
  }

  public async getIdentities(tournamentId: string = TEST_TOURNAMENT_ID): Promise<TestIdentitiesState> {
    const headers = await getAuthHeader();
    const res = await fetch(`/api/tournaments/${tournamentId}/test-tools/identities`, {
      headers
    });
    if (!res.ok) {
      // Gracefully fall back to local client state if offline
      return this.getLocalIdentities(tournamentId);
    }
    const data = await res.json();
    return data;
  }

  public getLocalIdentities(tournamentId: string = TEST_TOURNAMENT_ID): TestIdentitiesState {
    const engine = getAuctionEngine(tournamentId);
    const regs = tournamentService.getTournamentRegistrations(tournamentId);
    const teams = engine.getTeams();
    const state = engine.getState();

    return {
      tournamentId,
      testMode: isTournamentInTestMode(tournamentId),
      registrations: regs,
      participants: regs.map((r: any) => ({
        userId: r.userId,
        tournamentId,
        registrationId: r.id || r.userId,
        pbgId: r.pbgId || r.userId,
        displayName: r.identitySnapshot?.displayName || r.ign || r.pbgId || r.userId,
        tournamentRole: r.interestedInCaptaincy || r.applyingAsCaptain ? 'CAPTAIN' : 'PLAYER',
        auctionStatus: 'AVAILABLE',
        participantStatus: 'ACTIVE',
        isTestAccount: Boolean(r.isTestAccount),
        source: r.source || 'TEST_SEED'
      })),
      session: state ? {
        status: state.status,
        currentPhase: state.roundPhase,
        currentNomination: state.nominee ? {
          playerId: state.nominee.id,
          playerName: (state.nominee as any).name || (state.nominee as any).ign || state.nominee.id,
          currentBid: state.currentBid || 0,
          highestBidderTeamId: state.leadingTeamId
        } : null,
        teams: teams.reduce((acc, t: any) => {
          acc[t.id] = {
            teamId: t.id,
            teamName: t.name,
            tag: t.tag,
            captainUserId: t.captainId,
            purseRemaining: t.purseRemaining ?? t.credits ?? 1000,
            rosterCount: t.roster?.length ?? 1
          };
          return acc;
        }, {} as any),
        players: {}
      } : null,
      audits: []
    };
  }
}

export const auctionTestClient = new AuctionTestClient();
