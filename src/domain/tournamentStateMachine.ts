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
  | 'active'
  | 'on_hold'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'abandoned'
  | 'deleted';

export const normalTransitions: Readonly<Record<TournamentStatus, readonly TournamentStatus[]>> = {
  draft: ['registration', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  registration: ['verification', 'auction_ready', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  verification: ['rating_review', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  rating_review: ['player_pool_locked', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  player_pool_locked: ['auction_ready', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  auction_ready: ['auction_live', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  auction_live: ['auction_paused', 'rosters_locked', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  auction_paused: ['auction_live', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  rosters_locked: ['competition', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  competition: ['completed', 'active', 'on_hold', 'cancelled', 'abandoned', 'deleted'],
  active: ['competition', 'completed', 'on_hold', 'paused', 'cancelled', 'abandoned', 'deleted'],
  on_hold: ['active', 'competition', 'draft', 'registration', 'cancelled', 'abandoned', 'deleted'],
  paused: ['active', 'competition', 'draft', 'registration', 'cancelled', 'abandoned', 'deleted'],
  completed: ['deleted'],
  cancelled: ['deleted'],
  abandoned: ['deleted'],
  deleted: []
};

export function canTransitionTournament(from: string, to: string): boolean {
  const normFrom = from.toLowerCase() as TournamentStatus;
  const normTo = to.toLowerCase() as TournamentStatus;
  if (normFrom === normTo) return true;
  const allowed = normalTransitions[normFrom];
  if (!allowed) {
    // If unknown state, allow transitioning to terminal states
    if (['cancelled', 'completed', 'abandoned', 'deleted', 'on_hold'].includes(normTo)) {
      return true;
    }
    return false;
  }
  return allowed.includes(normTo);
}

export function validateTournamentTransition(from: string, to: string): { valid: boolean; reason?: string } {
  const normFrom = from.toLowerCase() as TournamentStatus;
  const normTo = to.toLowerCase() as TournamentStatus;
  const valid = canTransitionTournament(normFrom, normTo);
  if (!valid) {
    return {
      valid: false,
      reason: `Illegal tournament state transition from '${from}' to '${to}'. State must follow canonical sequence, pause, or terminal cancellation.`
    };
  }
  return { valid: true };
}

export {
  classifyTournamentLifecycle,
  shouldTournamentGrantTemporaryDiscordRoles,
  type TournamentLifecycleCategory,
  type StandardTournamentLifecycleState
} from './tournamentLifecycleEngine';

