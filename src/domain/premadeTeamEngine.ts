/**
 * Purple Bean Gaming — Premade Team Application & Validation Engine
 */

import { TournamentConfig } from './tournamentConfig';

export interface PremadeRosterPlayer {
  id: string;
  inGameName: string;
  displayName: string;
  role: string;
  ratingOrMmr: number;
  isCaptain: boolean;
  isSubstitute: boolean;
}

export interface PremadeTeamApplication {
  id: string;
  tournamentId: string;
  teamName: string;
  tag: string;
  logo?: string;
  homeCity?: string;
  managerEmail?: string;
  managerOrCaptainId?: string;
  captainId?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  roster: PremadeRosterPlayer[];
  substitutes: PremadeRosterPlayer[];
  status: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW';
  averageRating?: number;
}

export class PremadeTeamEngine {
  public static validateRoster(
    roster: PremadeRosterPlayer[],
    substitutes: PremadeRosterPlayer[],
    config: TournamentConfig
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const expectedSize = config.roster?.primaryRosterSize || 5;

    if (roster.length !== expectedSize) {
      errors.push(`Primary roster must contain exactly ${expectedSize} players (provided: ${roster.length}).`);
    }

    const captains = roster.filter(p => p.isCaptain);
    if (captains.length !== 1) {
      errors.push('Primary roster must specify exactly one captain.');
    }

    const maxSubs = config.roster?.substituteSlots ?? 1;
    if (substitutes.length > maxSubs) {
      errors.push(`Substitutes exceed allowed limit of ${maxSubs}.`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
