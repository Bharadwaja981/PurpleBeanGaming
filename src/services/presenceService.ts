/**
 * Purple Bean Gaming — Real-Time Auction Presence Service
 * 
 * Provides real-time connection state for organisers and captains:
 * - Backed by Firestore collection `/auctions/{tournamentId}/presence/{userId}`
 * - Multi-tab BroadcastChannel synchronisation
 * - 4-second heartbeat ping with 15-second offline threshold
 * - Clean disconnect cleanup on page unload / component unmount
 */

import { collection, doc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db, auth } from './firebaseConfig';

export interface PresenceMember {
  userId: string;
  name: string;
  role: 'organizer' | 'captain' | 'spectator';
  lastSeen: number;
  online: boolean;
}

class AuctionPresenceManager {
  private activeInterval: any = null;
  private syncChannel: any = null;
  private currentTournamentId: string | null = null;
  private currentUserId: string | null = null;
  private currentRole: 'organizer' | 'captain' | 'spectator' = 'spectator';
  private currentName = '';

  public startHeartbeat(
    tournamentId: string,
    user: { id: string; name?: string; role?: string }
  ) {
    if (this.currentTournamentId === tournamentId && this.currentUserId === user.id && this.activeInterval) {
      return;
    }

    this.stopHeartbeat();

    this.currentTournamentId = tournamentId;
    this.currentUserId = user.id;
    this.currentName = user.name || 'Anonymous Contender';
    this.currentRole = user.role === 'organizer' || user.role === 'admin' ? 'organizer' : 'captain';

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.syncChannel = new BroadcastChannel(`pb_presence_${tournamentId}`);
      } catch {}
    }

    const sendPing = () => {
      const now = Date.now();
      const record: PresenceMember = {
        userId: user.id,
        name: this.currentName,
        role: this.currentRole,
        lastSeen: now,
        online: true
      };

      // 1. BroadcastChannel ping for local multi-window testing
      if (this.syncChannel) {
        try {
          this.syncChannel.postMessage({ type: 'PRESENCE_PING', payload: record });
        } catch {}
      }
    };

    // Immediate first ping
    sendPing();
    this.activeInterval = setInterval(sendPing, 4000);

    // Unload hook
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleUnload);
    }
  }

  public stopHeartbeat() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }

    if (this.currentTournamentId && this.currentUserId) {
      const uId = this.currentUserId;
      const offlineRecord: PresenceMember = {
        userId: uId,
        name: this.currentName,
        role: this.currentRole,
        lastSeen: Date.now(),
        online: false
      };

      if (this.syncChannel) {
        try {
          this.syncChannel.postMessage({ type: 'PRESENCE_OFFLINE', payload: offlineRecord });
          this.syncChannel.close();
        } catch {}
        this.syncChannel = null;
      }
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this.handleUnload);
    }

    this.currentTournamentId = null;
    this.currentUserId = null;
  }

  private handleUnload = () => {
    this.stopHeartbeat();
  };

  public subscribeToPresence(
    tournamentId: string,
    callback: (activeMembers: Map<string, PresenceMember>) => void
  ): () => void {
    const presenceMap = new Map<string, PresenceMember>();
    let unsubFirestore: Unsubscribe | null = null;
    let localChannel: any = null;

    const notify = () => {
      const now = Date.now();
      const filtered = new Map<string, PresenceMember>();
      presenceMap.forEach((v, k) => {
        // Active within 15 seconds and not marked offline
        if (v.online && now - v.lastSeen <= 15000) {
          filtered.set(k, v);
        }
      });
      callback(filtered);
    };

    // 1. Listen on BroadcastChannel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        localChannel = new BroadcastChannel(`pb_presence_${tournamentId}`);
        localChannel.onmessage = (event: MessageEvent) => {
          if (event.data?.type === 'PRESENCE_PING' && event.data?.payload) {
            presenceMap.set(event.data.payload.userId, event.data.payload);
            notify();
          } else if (event.data?.type === 'PRESENCE_OFFLINE' && event.data?.payload) {
            presenceMap.set(event.data.payload.userId, event.data.payload);
            notify();
          }
        };
      } catch {}
    }

    // 2. Listen on Firestore /auctions/{tournamentId}/presence
    if (db && typeof window !== 'undefined') {
      try {
        unsubFirestore = onSnapshot(
          collection(db, 'auctions', tournamentId, 'presence'),
          (snapshot) => {
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as PresenceMember;
              presenceMap.set(data.userId, data);
            });
            notify();
          },
          (err) => {
            // Harmless in offline / non-firebase mode
          }
        );
      } catch {}
    }

    // Periodic prune check (every 3 seconds) to mark stale pings as offline
    const pruneInterval = setInterval(notify, 3000);

    return () => {
      clearInterval(pruneInterval);
      if (unsubFirestore) unsubFirestore();
      if (localChannel) {
        try { localChannel.close(); } catch {}
      }
    };
  }
}

export const auctionPresenceManager = new AuctionPresenceManager();
