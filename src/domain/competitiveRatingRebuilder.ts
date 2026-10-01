/**
 * Purple Bean Gaming — Competitive Rating Rebuilder
 */

import { ratingLedger } from './competitiveRatingEngine';

export class CompetitiveRatingRebuilder {
  public static rebuildRatingsForTournament(tournamentId: string, matches: any[]): void {
    // Replay match results sequentially through rating ledger
    for (const m of matches) {
      if (m.status === 'COMPLETED' && m.winnerId) {
        const loserId = m.winnerId === m.teamA?.id ? m.teamB?.id : m.teamA?.id;
        if (loserId) {
          ratingLedger.applyMatchResult(m.id, m.winnerId, loserId, 1500, 1500);
        }
      }
    }
  }
}
