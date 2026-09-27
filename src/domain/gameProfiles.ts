/**
 * Purple Bean Gaming — Multi-Game Player Identity & Rating Architecture
 * 
 * Preserves a single canonical Player identity while maintaining distinct,
 * game-aware competitive profiles, ratings, and historical career snapshots.
 */

export interface GameSpecificProfile {
  gameId: string;
  gameName: string;
  inGameName: string;
  inGameId?: string; // Steam ID, Riot ID, BGMI Character ID
  rating: number; // e.g. 5850 MMR, 18500 CS Rating, 420 RR
  ratingDisplay: string;
  primaryRole: string;
  secondaryRole?: string;
  rankBadge: string;
  matchesPlayed: number;
  wins: number;
  winRate: number;
  lastActive: string;
}

export interface CareerTournamentSnapshot {
  tournamentId: string;
  tournamentName: string;
  gameId: string;
  gameName: string;
  teamId: string;
  teamName: string;
  rosterRole: string;
  placement: string; // e.g. "Champion", "Runner-up", "Semifinalist"
  prizeWonINR: number;
  finishedAt: string;
  ratingDelta: number;
}

export interface CanonicalPlayer {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  country: string;
  city: string;
  region: string;
  joinedAt: string;
  gameProfiles: Record<string, GameSpecificProfile>;
  careerSnapshots: CareerTournamentSnapshot[];
}

export class MultiGameRatingRegistry {
  private players = new Map<string, CanonicalPlayer>();

  public registerPlayer(player: CanonicalPlayer): void {
    this.players.set(player.id, player);
  }

  public getPlayer(id: string): CanonicalPlayer | undefined {
    return this.players.get(id);
  }

  public getGameRating(playerId: string, gameId: string): number {
    const p = this.players.get(playerId);
    if (!p || !p.gameProfiles[gameId]) return 1000;
    return p.gameProfiles[gameId].rating;
  }

  public recordTournamentFinish(
    playerId: string,
    snapshot: CareerTournamentSnapshot
  ): void {
    const player = this.players.get(playerId);
    if (!player) return;

    // Append historical immutable snapshot
    player.careerSnapshots.push(snapshot);

    // Update game-specific rating
    const profile = player.gameProfiles[snapshot.gameId];
    if (profile) {
      profile.rating = Math.max(100, profile.rating + snapshot.ratingDelta);
      profile.matchesPlayed += 1;
      if (snapshot.placement.toLowerCase().includes('champion') || snapshot.placement.includes('1st')) {
        profile.wins += 1;
      }
      profile.winRate = Math.round((profile.wins / profile.matchesPlayed) * 100);
    }
  }

  public getAllPlayers(): CanonicalPlayer[] {
    return Array.from(this.players.values());
  }
}

export const multiGameRegistry = new MultiGameRatingRegistry();
