/**
 * Purple Bean Gaming — Generic Configurable Tournament Lifecycle State Machine
 */

import { TournamentConfig } from './tournamentConfig';

export interface LifecycleStage {
  id: string;
  name: string;
  order: number;
}

export class GenericTournamentLifecycle {
  public static getStagesForConfig(config: TournamentConfig): LifecycleStage[] {
    const isAuction = config.teamFormation?.mode === 'AUCTION';

    if (isAuction) {
      return [
        { id: 'DRAFT', name: 'Draft Setup', order: 1 },
        { id: 'REGISTRATION_OPEN', name: 'Registration Open', order: 2 },
        { id: 'REGISTRATION_CLOSED', name: 'Registration Closed', order: 3 },
        { id: 'CAPTAIN_SELECTION', name: 'Captain Selection', order: 4 },
        { id: 'AUCTION', name: 'Live Auction Draft', order: 5 },
        { id: 'COMPETITION', name: 'Competition Playoffs', order: 6 },
        { id: 'COMPLETED', name: 'Tournament Completed', order: 7 }
      ];
    }

    return [
      { id: 'DRAFT', name: 'Draft Setup', order: 1 },
      { id: 'REGISTRATION_OPEN', name: 'Squad Registration Open', order: 2 },
      { id: 'REGISTRATION_CLOSED', name: 'Registration Closed', order: 3 },
      { id: 'PREMADE_REVIEW', name: 'Roster Review & Seeding', order: 4 },
      { id: 'COMPETITION', name: 'Competition Playoffs', order: 5 },
      { id: 'COMPLETED', name: 'Tournament Completed', order: 6 }
    ];
  }

  public static validateTransition(
    from: string,
    to: string,
    config: TournamentConfig
  ): { valid: boolean; reason?: string } {
    const stages = this.getStagesForConfig(config);
    const fromIdx = stages.findIndex(s => s.id === from);
    const toIdx = stages.findIndex(s => s.id === to);

    if (to === 'CANCELLED') return { valid: true };

    if (fromIdx === -1 || toIdx === -1) {
      return { valid: false, reason: `Unknown lifecycle stage '${from}' or '${to}'.` };
    }

    if (toIdx === fromIdx + 1) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Illegal lifecycle transition from '${from}' to '${to}'. State must progress sequentially.`
    };
  }
}
