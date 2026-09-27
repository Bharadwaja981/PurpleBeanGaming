/**
 * Purple Bean Gaming — Generic Dynamic Tournament Lifecycle
 * 
 * Computes valid lifecycle stages and state transitions dynamically
 * based on the tournament configuration.
 */

import { TournamentConfig } from './tournamentConfig';

export type GenericLifecycleStage = 
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'VERIFICATION'
  | 'CAPTAIN_SELECTION'
  | 'AUCTION'
  | 'DRAFTING'
  | 'PREMADE_REVIEW'
  | 'TEAMS_FINALIZED'
  | 'SEEDING'
  | 'COMPETITION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface StageDefinition {
  id: GenericLifecycleStage;
  label: string;
  order: number;
  description: string;
  isTerminal?: boolean;
}

export class GenericTournamentLifecycle {
  /**
   * Generates the sequential list of stages for a tournament based on its configuration.
   */
  public static getStagesForConfig(config: TournamentConfig): StageDefinition[] {
    const stages: StageDefinition[] = [
      { id: 'DRAFT', label: 'Draft / Setup', order: 1, description: 'Tournament configured and ready for announcement.' },
      { id: 'REGISTRATION_OPEN', label: 'Registration Open', order: 2, description: 'Accepting player or team applications.' },
      { id: 'REGISTRATION_CLOSED', label: 'Registration Closed', order: 3, description: 'Registration window has elapsed.' }
    ];

    let currentOrder = 4;

    if (config.registration.registrationMode === 'INDIVIDUAL') {
      if (config.integrity.verificationRequired) {
        stages.push({
          id: 'VERIFICATION',
          label: 'KYC & Verification',
          order: currentOrder++,
          description: 'Organizer verifies eligible participants.'
        });
      }

      if (config.teamFormation.mode === 'AUCTION') {
        stages.push(
          {
            id: 'CAPTAIN_SELECTION',
            label: 'Captain Selection',
            order: currentOrder++,
            description: 'Selecting captains to lead franchise teams.'
          },
          {
            id: 'AUCTION',
            label: 'Live Auction',
            order: currentOrder++,
            description: 'Captains bid credits to draft verified players.'
          }
        );
      } else if (config.teamFormation.mode === 'DRAFT') {
        stages.push(
          {
            id: 'CAPTAIN_SELECTION',
            label: 'Captain Selection',
            order: currentOrder++,
            description: 'Selecting captains to draft players.'
          },
          {
            id: 'DRAFTING',
            label: 'Snake Draft',
            order: currentOrder++,
            description: 'Captains pick players in round-robin snake order.'
          }
        );
      }
    } else {
      // PREMADE_TEAM
      stages.push({
        id: 'PREMADE_REVIEW',
        label: 'Team Review & Approval',
        order: currentOrder++,
        description: 'Organizer reviews rosters, captain assignments, and substitutes.'
      });
    }

    stages.push(
      {
        id: 'TEAMS_FINALIZED',
        label: 'Teams & Rosters Finalized',
        order: currentOrder++,
        description: 'All participant rosters are locked.'
      },
      {
        id: 'SEEDING',
        label: 'Bracket Seeding',
        order: currentOrder++,
        description: 'Teams seeded manually, randomly, or by rating.'
      },
      {
        id: 'COMPETITION',
        label: 'Live Matches & Play',
        order: currentOrder++,
        description: 'Matches are scheduled and scores executed.'
      },
      {
        id: 'COMPLETED',
        label: 'Tournament Completed',
        order: currentOrder++,
        description: 'Winners declared, ratings updated, prizes awarded.',
        isTerminal: true
      }
    );

    return stages;
  }

  /**
   * Validates whether a tournament can transition from currentStage to targetStage.
   */
  public static validateTransition(
    currentStage: GenericLifecycleStage,
    targetStage: GenericLifecycleStage,
    config: TournamentConfig
  ): { valid: boolean; reason?: string } {
    if (currentStage === targetStage) return { valid: true };
    if (targetStage === 'CANCELLED') return { valid: true };

    const stages = this.getStagesForConfig(config);
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    const targetIndex = stages.findIndex(s => s.id === targetStage);

    if (currentIndex === -1 || targetIndex === -1) {
      return { valid: false, reason: `Unknown stage in lifecycle: ${currentStage} -> ${targetStage}` };
    }

    // Only allow progressing to the immediate next stage or going back one step for corrections
    if (targetIndex === currentIndex + 1) {
      return { valid: true };
    }

    // Allow rollback by 1 step if not in completed
    if (targetIndex === currentIndex - 1 && currentStage !== 'COMPLETED') {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Illegal lifecycle transition: Cannot transition directly from '${stages[currentIndex].label}' to '${stages[targetIndex].label}'. Must follow tournament lifecycle.`
    };
  }
}
