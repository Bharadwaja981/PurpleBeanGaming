/**
 * Purple Bean Gaming — Multi-Game Player Identity & Rating Registry
 */

export interface GameSpecificProfile {
  gameId: string;
  gameName: string;
  inGameName: string;
  rating: number;
  ratingDisplay?: string;
  primaryRole?: string;
  rankBadge?: string;
  matchesPlayed: number;
  wins: number;
  losses?: number;
}

export interface CanonicalPlayer {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  country: string;
  city?: string;
  region?: string;
  joinedAt: string;
  gameProfiles: Record<string, GameSpecificProfile>;
  careerSnapshots: any[];
}

export class MultiGameRatingRegistry {
  private players = new Map<string, CanonicalPlayer>();

  public registerPlayer(player: CanonicalPlayer): void {
    if (!player.careerSnapshots) player.careerSnapshots = [];
    this.players.set(player.id, player);
  }

  public getPlayer(userId: string): CanonicalPlayer | undefined {
    return this.players.get(userId);
  }

  public getGameProfile(userId: string, gameId: string): GameSpecificProfile | undefined {
    return this.players.get(userId)?.gameProfiles[gameId];
  }

  public getGameRating(userId: string, gameId: string): number {
    return this.getGameProfile(userId, gameId)?.rating || 1500;
  }

  public recordTournamentFinish(userId: string, payload: any): void {
    const player = this.players.get(userId);
    if (!player) return;
    if (!player.careerSnapshots) player.careerSnapshots = [];
    player.careerSnapshots.push(payload);
    const profile = player.gameProfiles[payload.gameId];
    if (profile && payload.ratingDelta) {
      profile.rating += payload.ratingDelta;
    }
  }
}
