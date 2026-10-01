/**
 * Purple Bean Gaming — Live Auction Floor Presence Service
 */

export interface PresenceMember {
  userId: string;
  displayName: string;
  role: string;
  teamId?: string;
  lastSeen: number;
}

export class AuctionPresenceManager {
  private members: Map<string, PresenceMember> = new Map();
  private listeners: Set<() => void> = new Set();

  public getActiveMembers(): PresenceMember[] {
    return Array.from(this.members.values());
  }

  public heartbeat(userId: string, displayName: string, role: string, teamId?: string) {
    this.members.set(userId, {
      userId,
      displayName,
      role,
      teamId,
      lastSeen: Date.now()
    });
    this.notify();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }
}

export const auctionPresenceManager = new AuctionPresenceManager();
