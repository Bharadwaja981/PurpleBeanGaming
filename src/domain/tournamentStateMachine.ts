/**
 * Purple Bean Gaming — Tournament State Machine
 */

export type TournamentStatus = 
  | 'draft'
  | 'registration'
  | 'verification'
  | 'rating_review'
  | 'player_pool_locked'
  | 'auction_ready'
  | 'auction_live'
  | 'auction_paused'
  | 'rosters_locked'
  | 'competition'
  | 'completed'
  | 'cancelled';

export const normalTransitions: Readonly<Record<TournamentStatus, readonly TournamentStatus[]>> = {
  draft: ['registration', 'cancelled'],
  registration: ['verification', 'cancelled'],
  verification: ['rating_review', 'cancelled'],
  rating_review: ['player_pool_locked', 'cancelled'],
  player_pool_locked: ['auction_ready', 'cancelled'],
  auction_ready: ['auction_live', 'cancelled'],
  auction_live: ['auction_paused', 'rosters_locked', 'cancelled'],
  auction_paused: ['auction_live', 'cancelled'],
  rosters_locked: ['competition', 'cancelled'],
  competition: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

export function canTransitionTournament(from: string, to: string): boolean {
  const normFrom = from.toLowerCase() as TournamentStatus;
  const normTo = to.toLowerCase() as TournamentStatus;
  const allowed = normalTransitions[normFrom];
  if (!allowed) return false;
  return allowed.includes(normTo);
}

export function validateTournamentTransition(from: string, to: string): { valid: boolean; reason?: string } {
  const normFrom = from.toLowerCase() as TournamentStatus;
  const normTo = to.toLowerCase() as TournamentStatus;
  const valid = canTransitionTournament(normFrom, normTo);
  if (!valid) {
    return {
      valid: false,
      reason: `Illegal tournament state transition from '${from}' to '${to}'. State must follow canonical sequence or cancellation.`
    };
  }
  return { valid: true };
}
