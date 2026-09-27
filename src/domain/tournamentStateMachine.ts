/**
 * Purple Bean Gaming — Tournament Lifecycle State Machine
 * 
 * Enforces centralized state transitions. Direct or arbitrary jumps
 * (e.g. registration -> completed) are mathematically rejected.
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

export const VALID_TOURNAMENT_TRANSITIONS: Readonly<Record<TournamentStatus, readonly TournamentStatus[]>> = {
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

export function canTransitionTournament(from: TournamentStatus, to: TournamentStatus): boolean {
  const allowed = VALID_TOURNAMENT_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

export function validateTournamentTransition(from: TournamentStatus, to: TournamentStatus): { valid: boolean; reason?: string } {
  if (from === to) {
    return { valid: true };
  }
  if (!canTransitionTournament(from, to)) {
    return { 
      valid: false, 
      reason: `Illegal tournament state transition: cannot jump from '${from}' to '${to}'. Allowed: [${(VALID_TOURNAMENT_TRANSITIONS[from] || []).join(', ')}]` 
    };
  }
  return { valid: true };
}
