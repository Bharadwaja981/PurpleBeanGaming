/**
 * Purple Bean Gaming — Public Draft Replay & Auction History Viewer
 * 
 * Allows spectators, players, and captains to review auction events chronologically:
 * Nominations, live bids, winning team acquisitions, unsold decisions, and filters.
 */

import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Filter, User, Shield, Coins, CheckCircle, XCircle } from 'lucide-react';

export interface AuctionReplayEvent {
  id: string;
  stepNumber: number;
  type: 'NOMINATION' | 'BID' | 'SOLD' | 'UNSOLD';
  timestamp: string;
  playerIgn: string;
  playerRole: string;
  playerMmr: number;
  playerAvatar: string;
  teamName?: string;
  teamTag?: string;
  teamLogo?: string;
  bidAmount?: number;
  details: string;
}

export const SAMPLE_TEST_CUP_REPLAY_EVENTS: AuctionReplayEvent[] = [
  {
    id: 'evt-1',
    stepNumber: 1,
    type: 'NOMINATION',
    timestamp: '14:02:10',
    playerIgn: 'Viper',
    playerRole: 'Position 1 — Carry',
    playerMmr: 5900,
    playerAvatar: '🐍',
    details: 'Viper nominated into auction pool. Opening bid set to 10 credits.'
  },
  {
    id: 'evt-2',
    stepNumber: 2,
    type: 'BID',
    timestamp: '14:02:18',
    playerIgn: 'Viper',
    playerRole: 'Position 1 — Carry',
    playerMmr: 5900,
    playerAvatar: '🐍',
    teamName: 'Mumbai Mavericks',
    teamTag: 'MUM',
    teamLogo: '⚡',
    bidAmount: 100,
    details: 'Mumbai Mavericks opens bidding at 100 credits.'
  },
  {
    id: 'evt-3',
    stepNumber: 3,
    type: 'BID',
    timestamp: '14:02:25',
    playerIgn: 'Viper',
    playerRole: 'Position 1 — Carry',
    playerMmr: 5900,
    playerAvatar: '🐍',
    teamName: 'Hyderabad Raiders',
    teamTag: 'HYD',
    teamLogo: '🔥',
    bidAmount: 180,
    details: 'Hyderabad Raiders counters at 180 credits.'
  },
  {
    id: 'evt-4',
    stepNumber: 4,
    type: 'BID',
    timestamp: '14:02:35',
    playerIgn: 'Viper',
    playerRole: 'Position 1 — Carry',
    playerMmr: 5900,
    playerAvatar: '🐍',
    teamName: 'Mumbai Mavericks',
    teamTag: 'MUM',
    teamLogo: '⚡',
    bidAmount: 240,
    details: 'Mumbai Mavericks increases bid to 240 credits.'
  },
  {
    id: 'evt-5',
    stepNumber: 5,
    type: 'SOLD',
    timestamp: '14:02:50',
    playerIgn: 'Viper',
    playerRole: 'Position 1 — Carry',
    playerMmr: 5900,
    playerAvatar: '🐍',
    teamName: 'Mumbai Mavericks',
    teamTag: 'MUM',
    teamLogo: '⚡',
    bidAmount: 240,
    details: 'HAMMER DOWN! Viper SOLD to Mumbai Mavericks for 240 credits.'
  },
  {
    id: 'evt-6',
    stepNumber: 6,
    type: 'NOMINATION',
    timestamp: '14:03:15',
    playerIgn: 'Bulldozer',
    playerRole: 'Position 3 — Offlane',
    playerMmr: 5500,
    playerAvatar: '🦏',
    details: 'Bulldozer nominated. Opening bid 10 credits.'
  },
  {
    id: 'evt-7',
    stepNumber: 7,
    type: 'BID',
    timestamp: '14:03:22',
    playerIgn: 'Bulldozer',
    playerRole: 'Position 3 — Offlane',
    playerMmr: 5500,
    playerAvatar: '🦏',
    teamName: 'Hyderabad Raiders',
    teamTag: 'HYD',
    teamLogo: '🔥',
    bidAmount: 120,
    details: 'Hyderabad Raiders bids 120 credits.'
  },
  {
    id: 'evt-8',
    stepNumber: 8,
    type: 'SOLD',
    timestamp: '14:03:45',
    playerIgn: 'Bulldozer',
    playerRole: 'Position 3 — Offlane',
    playerMmr: 5500,
    playerAvatar: '🦏',
    teamName: 'Hyderabad Raiders',
    teamTag: 'HYD',
    teamLogo: '🔥',
    bidAmount: 120,
    details: 'HAMMER DOWN! Bulldozer SOLD to Hyderabad Raiders for 120 credits.'
  },
  {
    id: 'evt-9',
    stepNumber: 9,
    type: 'NOMINATION',
    timestamp: '14:04:10',
    playerIgn: 'Glitch',
    playerRole: 'Position 4 — Soft Support',
    playerMmr: 4200,
    playerAvatar: '👾',
    details: 'Glitch nominated. Timer running.'
  },
  {
    id: 'evt-10',
    stepNumber: 10,
    type: 'UNSOLD',
    timestamp: '14:04:40',
    playerIgn: 'Glitch',
    playerRole: 'Position 4 — Soft Support',
    playerMmr: 4200,
    playerAvatar: '👾',
    details: 'Timer expired without qualifying bids. Glitch marked UNSOLD.'
  }
];

export const DraftReplayViewer: React.FC<{ events?: AuctionReplayEvent[] }> = ({
  events = SAMPLE_TEST_CUP_REPLAY_EVENTS
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SOLD' | 'UNSOLD' | 'BID'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = events.filter(evt => {
    if (filterType === 'SOLD' && evt.type !== 'SOLD') return false;
    if (filterType === 'UNSOLD' && evt.type !== 'UNSOLD') return false;
    if (filterType === 'BID' && evt.type !== 'BID') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPlayer = evt.playerIgn.toLowerCase().includes(q);
      const matchTeam = evt.teamName?.toLowerCase().includes(q);
      return matchPlayer || matchTeam;
    }
    return true;
  });

  return (
    <div className="bg-white border-4 border-black p-5 shadow-[6px_6px_0px_0px_#000] font-mono space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-4 border-black pb-4">
        <div>
          <span className="bg-[#FFE600] text-black px-2 py-0.5 text-xs font-black uppercase border border-black">
            HISTORICAL AUCTION REPLAY
          </span>
          <h3 className="text-xl font-black uppercase mt-1">Live Draft Event Ledger</h3>
          <p className="text-xs text-stone-600">
            Immutable chronological record of all captain nominations, bids, and acquisitions.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search player or team..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-2 border-black p-1.5 text-xs font-mono"
          />
          <div className="flex border-2 border-black">
            {(['ALL', 'SOLD', 'UNSOLD', 'BID'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-2.5 py-1 text-[10px] font-black uppercase ${
                  filterType === f ? 'bg-black text-white' : 'bg-white hover:bg-stone-100 text-black'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filteredEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-stone-400">
            No auction replay events match your filter.
          </div>
        ) : (
          filteredEvents.map(evt => (
            <div
              key={evt.id}
              className={`p-3 border-2 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                evt.type === 'SOLD'
                  ? 'bg-emerald-50 border-emerald-500 shadow-[2px_2px_0px_0px_#059669]'
                  : evt.type === 'UNSOLD'
                  ? 'bg-stone-100 border-stone-400'
                  : evt.type === 'BID'
                  ? 'bg-amber-50/60 border-amber-300'
                  : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{evt.playerAvatar}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm">{evt.playerIgn}</span>
                    <span className="text-[10px] bg-black text-white px-1.5 py-0.2 font-bold">
                      {evt.playerMmr} MMR
                    </span>
                    <span className="text-[10px] text-stone-600">{evt.playerRole}</span>
                  </div>
                  <p className="text-xs text-stone-800 mt-0.5">{evt.details}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {evt.bidAmount !== undefined && (
                  <div className="text-right">
                    <div className="text-sm font-black text-[#7C3AED]">
                      {evt.bidAmount} <span className="text-[10px]">PTS</span>
                    </div>
                    {evt.teamName && (
                      <div className="text-[10px] font-bold text-stone-600 flex items-center gap-1 justify-end">
                        <span>{evt.teamLogo}</span> {evt.teamName}
                      </div>
                    )}
                  </div>
                )}

                <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                  evt.type === 'SOLD'
                    ? 'bg-emerald-200 text-emerald-900 border-emerald-500'
                    : evt.type === 'UNSOLD'
                    ? 'bg-stone-300 text-stone-800 border-stone-500'
                    : evt.type === 'BID'
                    ? 'bg-[#FFE600] text-black border-black'
                    : 'bg-purple-100 text-purple-900 border-purple-300'
                }`}>
                  {evt.type}
                </span>

                <span className="text-[10px] text-stone-400 w-14 text-right">
                  {evt.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
