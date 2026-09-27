import React, { useState, useEffect } from 'react';
import { 
  Gavel, 
  Clock, 
  Coins, 
  Users, 
  Flame, 
  ArrowUpRight, 
  Check, 
  Shield, 
  Sparkles, 
  Layers,
  CheckCircle2,
  MapPin,
  Pause,
  Play,
  UserCheck,
  AlertCircle,
  Crown,
  ChevronRight,
  RefreshCw,
  Trophy,
  History,
  Info,
  Lock
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';
import { 
  dotaAuctionEngine, 
  DotaAuctionPlayer, 
  DotaAuctionTeam, 
  DotaAuctionState, 
  DotaBidRecord, 
  DotaNominationAudit 
} from '../domain/dotaAuctionEngine';

export function AuctionDraft() {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer';
  const isCaptain = currentUser.role === 'captain';
  const isSpectator = currentUser.role === 'spectator' || (!isOrganiser && !isCaptain);

  // Synchronized auction state
  const [auctionState, setAuctionState] = useState<DotaAuctionState>(() => dotaAuctionEngine.getState());
  const [teams, setTeams] = useState<DotaAuctionTeam[]>(() => dotaAuctionEngine.getTeams());
  const [availablePlayers, setAvailablePlayers] = useState<DotaAuctionPlayer[]>(() => dotaAuctionEngine.getAvailablePlayers());
  const [soldPlayers, setSoldPlayers] = useState<DotaAuctionPlayer[]>(() => dotaAuctionEngine.getSoldPlayers());
  const [unsoldPlayers, setUnsoldPlayers] = useState<DotaAuctionPlayer[]>(() => dotaAuctionEngine.getUnsoldPlayers());
  const [unselectedPlayers, setUnselectedPlayers] = useState<DotaAuctionPlayer[]>(() => dotaAuctionEngine.getUnselectedPlayers());
  const [bidHistory, setBidHistory] = useState<DotaBidRecord[]>(() => dotaAuctionEngine.getBidHistory());
  const [nominationAudits, setNominationAudits] = useState<DotaNominationAudit[]>(() => dotaAuctionEngine.getNominationAudits());

  // UI state
  const [activeTab, setActiveTab] = useState<'live' | 'sold' | 'unsold' | 'unselected' | 'teams' | 'audit'>('live');
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState<string>('');
  const [selectedBidTeamId, setSelectedBidTeamId] = useState<string>(() => {
    if (currentUser.teamId) return currentUser.teamId;
    const firstTeam = dotaAuctionEngine.getTeams()[0];
    return firstTeam ? firstTeam.id : '';
  });

  // Stand-in assignment modal state
  const [standInModalOpen, setStandInModalOpen] = useState(false);
  const [standInTeamId, setStandInTeamId] = useState<string>('');
  const [standInPlayerId, setStandInPlayerId] = useState<string>('');

  // Subscribe to domain engine events
  useEffect(() => {
    const handleSync = () => {
      setAuctionState(dotaAuctionEngine.getState());
      setTeams(dotaAuctionEngine.getTeams());
      setAvailablePlayers(dotaAuctionEngine.getAvailablePlayers());
      setSoldPlayers(dotaAuctionEngine.getSoldPlayers());
      setUnsoldPlayers(dotaAuctionEngine.getUnsoldPlayers());
      setUnselectedPlayers(dotaAuctionEngine.getUnselectedPlayers());
      setBidHistory(dotaAuctionEngine.getBidHistory());
      setNominationAudits(dotaAuctionEngine.getNominationAudits());
    };

    handleSync();
    return dotaAuctionEngine.subscribe(handleSync);
  }, []);

  // Update selected bid team if current user changes or teams load
  useEffect(() => {
    if (currentUser.teamId) {
      setSelectedBidTeamId(currentUser.teamId);
    } else if (!selectedBidTeamId && teams.length > 0) {
      setSelectedBidTeamId(teams[0].id);
    }
  }, [currentUser.teamId, teams]);

  // Current active nominee
  const currentNominee = auctionState.nominee;
  const config = dotaAuctionEngine.getConfig();

  // Find user's active team
  const myTeam = teams.find(t => t.id === selectedBidTeamId) || teams[0];

  // Calculate reserve rule details for selected team
  const currentPrimaryCount = myTeam ? myTeam.primaryRoster.length : 1;
  const remainingMandatorySlots = Math.max(0, config.primaryRosterSize - currentPrimaryCount - 1);
  const mandatoryReserveNeeded = remainingMandatorySlots * config.reservePerSlot;
  const maxAllowableBid = myTeam ? Math.max(0, myTeam.remainingCredits - mandatoryReserveNeeded) : 0;

  // Actions
  const handlePlaceBid = (increment: number) => {
    setBidError(null);
    setBidSuccess(null);

    if (!myTeam) {
      setBidError('No team selected to bid.');
      return;
    }

    const proposedAmount = auctionState.currentBid + increment;
    const res = tournamentService.placeDotaAuctionBid({
      teamId: myTeam.id,
      bidAmount: proposedAmount,
      expectedRevision: auctionState.revision
    });

    if (res.success) {
      setBidSuccess(`✓ Bid accepted! ${res.leadingTeamName} leads at ${res.currentBid} credits.`);
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Bid rejected.');
      setTimeout(() => setBidError(null), 4000);
    }
  };

  const handleNominatePlayer = (playerId: string) => {
    setBidError(null);
    setBidSuccess(null);
    const res = tournamentService.nominateDotaPlayer(playerId);
    if (!res.success) {
      setBidError(res.error || 'Failed to nominate player.');
      setTimeout(() => setBidError(null), 4000);
    } else {
      setSelectedNomineeId('');
      setBidSuccess(`✓ ${res.nominee?.username} nominated at opening bid of ${config.minimumBid} credits.`);
      setTimeout(() => setBidSuccess(null), 3000);
    }
  };

  const handleConcludeSale = () => {
    setBidError(null);
    setBidSuccess(null);
    try {
      const res = tournamentService.concludeDotaAuctionItem(true);
      if (res.outcome === 'SOLD') {
        setBidSuccess(`✓ SOLD! ${res.player.username} awarded to ${res.teamName} for ${res.winningBid} credits!`);
      } else if (res.outcome === 'AUCTION_COMPLETED') {
        setBidSuccess('🎉 AUCTION COMPLETED! All team mandatory rosters (5/5) have been filled!');
      } else {
        setBidSuccess(`✓ Lot concluded with outcome: ${res.outcome}`);
      }
      setTimeout(() => setBidSuccess(null), 4000);
    } catch (err: any) {
      setBidError(err.message || 'Failed to conclude lot.');
    }
  };

  const handlePassUnsold = () => {
    setBidError(null);
    setBidSuccess(null);
    try {
      const res = tournamentService.concludeDotaAuctionItem(false);
      setBidError(`Contender ${res.player.username} passed as UNSOLD.`);
      setTimeout(() => setBidError(null), 4000);
    } catch (err: any) {
      setBidError(err.message || 'Failed to pass lot.');
    }
  };

  const handleFinalizeAuction = () => {
    if (!confirm('Are you sure you want to finalize the auction and lock all rosters?')) return;
    const res = tournamentService.finalizeDotaAuction();
    if (res.success) {
      setBidSuccess(`✓ Auction finalized! ${res.unselectedCount} untouched contenders marked UNSELECTED.`);
    }
  };

  const handleAssignStandInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!standInTeamId || !standInPlayerId) return;
    const res = tournamentService.assignDotaStandIn(standInTeamId, standInPlayerId);
    if (res.success) {
      setBidSuccess(`✓ Optional stand-in assigned to ${res.team?.name}!`);
      setStandInModalOpen(false);
      setStandInPlayerId('');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to assign stand-in.');
    }
  };

  return (
    <div className="w-full space-y-6 font-mono">
      {/* Top Banner & State Ticker */}
      <div className="bg-white border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FF70A6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Gavel className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-[#FFE600] px-1.5 py-0.5 border border-black">
                DOTA 2 PHASE 2 · LIVE PLAYER AUCTION
              </span>
              <span className={`px-1.5 py-0.5 border border-black text-[10px] font-black uppercase ${
                auctionState.isCompleted ? 'bg-[#70FFAF] text-black' :
                auctionState.status === 'LIVE' ? 'bg-[#FFDE59] text-black animate-pulse' :
                'bg-stone-200 text-stone-700'
              }`}>
                {auctionState.status}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-tight">
              {config.tournamentName} · FRANCHISE DRAFT
            </h1>
            <p className="text-xs text-stone-600">
              Starting Purse: {config.startingCredits} Credits • Minimum Increment: +{config.bidIncrement} • Reserve per unfilled slot: {config.reservePerSlot} Credits
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="bg-stone-50 border-2 border-black px-3 py-1.5">
            <span className="text-[9px] uppercase text-stone-500 block">Available</span>
            <span className="font-black text-black">{availablePlayers.length}</span>
          </div>
          <div className="bg-[#70FFAF]/30 border-2 border-black px-3 py-1.5">
            <span className="text-[9px] uppercase text-emerald-800 block">Sold</span>
            <span className="font-black text-emerald-900">{soldPlayers.length}</span>
          </div>
          <div className="bg-[#FFDE59]/40 border-2 border-black px-3 py-1.5">
            <span className="text-[9px] uppercase text-amber-800 block">Unsold</span>
            <span className="font-black text-amber-900">{unsoldPlayers.length}</span>
          </div>
          <div className="bg-stone-200 border-2 border-black px-3 py-1.5">
            <span className="text-[9px] uppercase text-stone-600 block">Unselected</span>
            <span className="font-black text-stone-800">{unselectedPlayers.length}</span>
          </div>
        </div>
      </div>

      {/* Role Alert / Banner */}
      {isSpectator && (
        <div className="p-3 bg-[#E0F2FE] border-2 border-black text-xs text-stone-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span><strong>Spectator Mode Active:</strong> Viewing real-time bids and lots. Captain bidding controls are hidden.</span>
          </div>
          <span className="text-[10px] font-bold text-stone-500">Live Telemetry Delay: 0s</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b-2 border-black pb-2 text-xs font-black uppercase">
        <button
          onClick={() => setActiveTab('live')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'live' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Live Floor
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'teams' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Teams & Rosters ({teams.length})
        </button>
        <button
          onClick={() => setActiveTab('sold')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'sold' ? 'bg-[#70FFAF] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Sold ({soldPlayers.length})
        </button>
        <button
          onClick={() => setActiveTab('unsold')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'unsold' ? 'bg-[#FFDE59] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Unsold ({unsoldPlayers.length})
        </button>
        <button
          onClick={() => setActiveTab('unselected')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'unselected' ? 'bg-stone-300 text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Unselected ({unselectedPlayers.length})
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 border-2 border-black cursor-pointer transition-all ${
            activeTab === 'audit' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-100'
          }`}
        >
          Nomination Audit ({nominationAudits.length})
        </button>
      </div>

      {/* FEEDBACK BANNERS */}
      {bidError && (
        <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{bidError}</span>
        </div>
      )}
      {bidSuccess && (
        <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{bidSuccess}</span>
        </div>
      )}

      {/* TAB 1: LIVE FLOOR */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage: Current Nominee Block */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FF5757]" />
                  <span className="font-black text-xs uppercase tracking-tight">CURRENT AUCTION LOT</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-black">
                  <Clock className="w-4 h-4 text-[#7C3AED]" />
                  <span>Clock: {auctionState.secondsRemaining}s</span>
                </div>
              </div>

              {currentNominee ? (
                <div className="space-y-6">
                  {/* Player Hero Section */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-stone-50 border-2 border-black p-5 shadow-[3px_3px_0px_0px_#000]">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-[#FFDE59] border-[2.5px] border-black flex items-center justify-center text-3xl shadow-[2px_2px_0px_0px_#000]">
                        {currentNominee.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black uppercase text-black font-sans">
                            {currentNominee.username}
                          </h2>
                          <span className="bg-[#70FFAF] border border-black px-1.5 py-0.2 text-[9px] font-black uppercase">
                            NOMINATED
                          </span>
                        </div>
                        <div className="text-xs text-stone-600 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-[#7C3AED]" />
                          <span>{currentNominee.city || 'India'}</span>
                          <span>•</span>
                          <span className="font-bold text-purple-700">{currentNominee.primaryRole}</span>
                        </div>
                      </div>
                    </div>

                    {/* Calibrated MMR Badge */}
                    <div className="bg-white border-2 border-black p-3 text-right shrink-0">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block flex items-center gap-1 justify-end">
                        <Lock className="w-3 h-3 text-emerald-700" />
                        <span>Tournament MMR</span>
                      </span>
                      <span className="text-2xl font-black text-[#7C3AED]">
                        {currentNominee.tournamentMmr.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-stone-500 block">Rating: {currentNominee.rating}</span>
                    </div>
                  </div>

                  {/* Bidding Grid: Price & Leading Bidder */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Current High Bid</span>
                      <div className="text-3xl font-black text-black">
                        {auctionState.currentBid.toLocaleString()} <span className="text-sm font-bold text-stone-600">Credits</span>
                      </div>
                      <span className="text-[10px] text-stone-500 block">State Revision #{auctionState.revision}</span>
                    </div>

                    <div className="bg-[#F3E8FF] border-2 border-black p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Leading Franchise</span>
                      <div className="text-2xl font-black text-[#7C3AED] truncate">
                        {auctionState.leadingTeamName || 'No Bids Yet'}
                      </div>
                      <span className="text-[10px] text-stone-500 block">
                        {auctionState.leadingTeamId ? `Team ID: ${auctionState.leadingTeamId}` : 'Opening floor bid'}
                      </span>
                    </div>
                  </div>

                  {/* CAPTAIN BID CONTROLS */}
                  {!isSpectator && (
                    <div className="bg-stone-50 border-2 border-black p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                        <div>
                          <span className="text-[10px] uppercase font-black text-stone-500 block">Bidding as Team:</span>
                          <span className="font-black text-black text-sm">{myTeam?.name || 'Unassigned'}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-stone-500 block">Purse Available / Reserve Needed:</span>
                          <span className="font-black text-emerald-800 text-sm">
                            {myTeam?.remainingCredits.toLocaleString()} Cr / {mandatoryReserveNeeded} Cr
                          </span>
                        </div>
                      </div>

                      <div className="text-[11px] text-stone-600 bg-white border border-black p-2 flex items-center justify-between">
                        <span>
                          <strong>Reserve Rule:</strong> Max allowable bid is <strong>{maxAllowableBid.toLocaleString()} Cr</strong> (retaining {config.reservePerSlot} Cr × {remainingMandatorySlots} unfilled slots).
                        </span>
                        <span className="font-bold text-[#7C3AED]">Primary: {myTeam?.primaryRoster.length}/5</span>
                      </div>

                      {/* Quick Bid Increment Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[10, 25, 50, 100].map(inc => {
                          const proposed = auctionState.currentBid + inc;
                          const disabled = proposed > maxAllowableBid || auctionState.isCompleted;
                          return (
                            <button
                              key={inc}
                              onClick={() => handlePlaceBid(inc)}
                              disabled={disabled}
                              className="py-2.5 px-3 bg-[#FFE600] hover:bg-yellow-400 disabled:opacity-40 disabled:hover:bg-[#FFE600] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed"
                            >
                              +{inc} Cr ({proposed})
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ORGANISER LOT CONCLUSION CONTROLS */}
                  {isOrganiser && (
                    <div className="bg-[#FFFBEB] border-2 border-black p-4 space-y-3">
                      <span className="text-[10px] font-black uppercase text-stone-600 block">
                        Organiser Floor Certification
                      </span>
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleConcludeSale}
                          disabled={!auctionState.leadingTeamId}
                          className="flex-1 py-2.5 px-4 bg-[#70FFAF] hover:bg-emerald-400 disabled:opacity-40 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed"
                        >
                          Conclude & Sell to {auctionState.leadingTeamName || 'Leading Bidder'}
                        </button>
                        <button
                          onClick={handlePassUnsold}
                          className="flex-1 py-2.5 px-4 bg-white hover:bg-stone-100 text-[#FF5757] border-2 border-[#FF5757] text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FF5757] cursor-pointer"
                        >
                          Pass as UNSOLD
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Floor Idle / Next Nomination */
                <div className="p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-stone-100 border-2 border-black flex items-center justify-center text-2xl mx-auto shadow-[3px_3px_0px_0px_#000]">
                    🏛️
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-black uppercase font-sans">Floor is currently empty</h3>
                    <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
                      {auctionState.isCompleted 
                        ? 'All mandatory franchise team rosters (5/5) have been completely filled!' 
                        : 'Select an available contender from the registry below to open the next bidding block.'}
                    </p>
                  </div>

                  {isOrganiser && !auctionState.isCompleted && availablePlayers.length > 0 && (
                    <div className="max-w-md mx-auto space-y-2 pt-2 text-left">
                      <span className="text-[10px] font-black uppercase text-stone-500 block">Quick Nominate Contender:</span>
                      <div className="flex gap-2">
                        <SelectDropdown
                          value={selectedNomineeId}
                          onChange={(val) => setSelectedNomineeId(val)}
                          options={[
                            { value: '', label: `-- Choose contender (${availablePlayers.length}) --` },
                            ...availablePlayers.map(p => ({
                              value: p.id,
                              label: `${p.username} · MMR ${p.tournamentMmr} · ${p.primaryRole}`
                            }))
                          ]}
                          className="flex-1"
                          placeholder="-- Choose contender --"
                        />
                        <button
                          onClick={() => selectedNomineeId && handleNominatePlayer(selectedNomineeId)}
                          disabled={!selectedNomineeId}
                          className="px-4 py-2 bg-[#FFE600] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          Nominate
                        </button>
                      </div>
                    </div>
                  )}

                  {isOrganiser && !auctionState.isCompleted && (
                    <div className="pt-4 border-t border-black/10">
                      <button
                        onClick={handleFinalizeAuction}
                        className="px-4 py-2 bg-black text-white hover:bg-stone-800 border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                      >
                        Force Finalize Auction & Lock Rosters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Available Player Pool Table */}
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#7C3AED]" />
                  <h3 className="text-sm font-black uppercase text-black font-sans">
                    Available Contender Pool ({availablePlayers.length})
                  </h3>
                </div>
                <span className="text-[10px] text-stone-500 font-bold">Strictly Verified Contenders</span>
              </div>

              {availablePlayers.length === 0 ? (
                <div className="p-6 text-center text-stone-500 text-xs">
                  No contenders currently AVAILABLE in the pool.
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto divide-y divide-black/10">
                  {availablePlayers.map(player => (
                    <div key={player.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{player.avatar}</span>
                        <div>
                          <strong className="text-black block">{player.username}</strong>
                          <span className="text-[10px] text-stone-500">{player.city || 'India'} • {player.primaryRole}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#7C3AED] block">
                            MMR: {player.tournamentMmr.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-stone-400">Rating: {player.rating}</span>
                        </div>
                        {isOrganiser && !auctionState.nominee && !auctionState.isCompleted && (
                          <button
                            onClick={() => handleNominatePlayer(player.id)}
                            className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2.5 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                          >
                            Nominate
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Rail: Live Bids Stream & Quick Team Standings */}
          <div className="space-y-6">
            {/* Live Bids Activity Stream */}
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#7C3AED]" />
                  <h3 className="text-sm font-black uppercase text-black font-sans">
                    Bid Telemetry Stream
                  </h3>
                </div>
                <span className="text-[10px] text-stone-500 font-bold">{bidHistory.length} Total Bids</span>
              </div>

              {bidHistory.length === 0 ? (
                <div className="p-6 text-center text-stone-400 text-xs">
                  No bids recorded in this auction session.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {bidHistory.slice(0, 15).map((bid) => (
                    <div key={bid.id} className="p-2.5 bg-stone-50 border border-black text-xs space-y-0.5">
                      <div className="flex justify-between items-center">
                        <strong className="text-purple-700">{bid.teamName}</strong>
                        <span className="font-black text-emerald-800">{bid.amount.toLocaleString()} Cr</span>
                      </div>
                      <div className="text-[10px] text-stone-400 flex justify-between">
                        <span>Lot: {bid.nomineeId}</span>
                        <span>{new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Teams Purse & Roster Tracker */}
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-3">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <span className="text-xs font-black uppercase text-black">Franchise Purse Trackers</span>
                <span className="text-[10px] text-stone-500 font-bold">{teams.length} Teams</span>
              </div>
              <div className="space-y-2">
                {teams.map(t => (
                  <div key={t.id} className="p-2.5 bg-stone-50 border border-black text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-black truncate">{t.name}</span>
                      <span className="font-bold text-emerald-700">{t.remainingCredits.toLocaleString()} Cr</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-stone-500">
                      <span>Primary Roster: <strong>{t.primaryRoster.length}/5</strong></span>
                      <span>Stand-ins: <strong>{t.standIns.length}/1</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TEAMS & ROSTERS */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border-[3.5px] border-black p-4 shadow-[4px_4px_0px_0px_#000]">
            <div>
              <h3 className="font-black text-base uppercase text-black font-sans">Official Franchise Rosters</h3>
              <p className="text-xs text-stone-600">
                Primary roster requirement: 5/5 players (including captain). Optional stand-in limit: 0/1.
              </p>
            </div>
            {isOrganiser && (
              <button
                onClick={() => setStandInModalOpen(true)}
                className="bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black px-3.5 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                + Assign Optional Stand-in
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div key={team.id} className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{team.logo}</span>
                    <h4 className="font-black text-base uppercase text-black font-sans">{team.name}</h4>
                  </div>
                  <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                    [{team.tag}]
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-[#FFF9E6] border border-black">
                    <span className="text-[9px] uppercase text-stone-500 block">Remaining Purse</span>
                    <strong className="text-emerald-800 text-sm">{team.remainingCredits.toLocaleString()} Cr</strong>
                  </div>
                  <div className="p-2 bg-[#F3E8FF] border border-black">
                    <span className="text-[9px] uppercase text-stone-500 block">Primary Roster</span>
                    <strong className="text-[#7C3AED] text-sm">{team.primaryRoster.length}/5</strong>
                  </div>
                </div>

                {/* Primary Roster List */}
                <div className="space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase text-stone-500 block">Primary Roster (Mandatory 5/5)</span>
                  {team.primaryRoster.map((player, idx) => (
                    <div key={player.id} className="p-2 bg-stone-50 border border-stone-300 flex justify-between items-center text-[11px]">
                      <div>
                        {idx === 0 ? '👑 ' : `${idx + 1}. `}<strong>{player.username}</strong>
                        <span className="text-[10px] text-stone-500 block">{player.primaryRole}</span>
                      </div>
                      <span className="font-mono font-bold text-purple-700">{player.tournamentMmr.toLocaleString()}</span>
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, 5 - team.primaryRoster.length) }).map((_, i) => (
                    <div key={i} className="p-2 border border-dashed border-stone-300 text-stone-400 text-[10px] italic">
                      Slot {team.primaryRoster.length + i + 1}: Unfilled
                    </div>
                  ))}
                </div>

                {/* Optional Stand-in */}
                <div className="pt-2 border-t border-black/10 text-xs">
                  <span className="text-[10px] font-black uppercase text-stone-500 block mb-1">Optional Stand-in (0/1)</span>
                  {team.standIns.length > 0 ? (
                    <div className="p-2 bg-[#70FFAF]/20 border border-emerald-400 flex justify-between items-center text-[11px]">
                      <strong>{team.standIns[0].username}</strong>
                      <span className="font-mono text-xs">{team.standIns[0].tournamentMmr} MMR</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 italic">None assigned (Optional)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SOLD PLAYERS */}
      {activeTab === 'sold' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="font-black text-base uppercase text-black font-sans">
              Sold Contenders ({soldPlayers.length})
            </h3>
            <span className="text-xs text-stone-500 font-bold">Awarded to Franchise Teams</span>
          </div>

          {soldPlayers.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">No players sold yet.</div>
          ) : (
            <div className="divide-y divide-black/10">
              {soldPlayers.map(p => (
                <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-black text-sm">{p.username}</strong>
                        {p.isCaptain && <span className="bg-[#FFE600] border border-black px-1 text-[9px] font-black uppercase">CAPTAIN</span>}
                        {p.isStandIn && <span className="bg-[#70FFAF] border border-black px-1 text-[9px] font-black uppercase">STAND-IN</span>}
                      </div>
                      <span className="text-[10px] text-stone-500">{p.city || 'India'} • {p.primaryRole}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <span className="text-[10px] text-stone-500 uppercase block">Purchased By</span>
                      <strong className="text-purple-700">{p.teamName || 'Team Captain'}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-500 uppercase block">Winning Price</span>
                      <strong className="text-emerald-800 font-mono text-sm">{p.soldAmount ? `${p.soldAmount} Cr` : 'Captain Slot'}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: UNSOLD PLAYERS */}
      {activeTab === 'unsold' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div>
              <h3 className="font-black text-base uppercase text-black font-sans">
                Unsold Contenders ({unsoldPlayers.length})
              </h3>
              <p className="text-[11px] text-stone-500">
                Nominated to the auction block, but lot closed without meeting winning bid.
              </p>
            </div>
            <span className="bg-[#FFDE59] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              Distinct from Unselected
            </span>
          </div>

          {unsoldPlayers.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">No unsold players at this time.</div>
          ) : (
            <div className="divide-y divide-black/10">
              {unsoldPlayers.map(p => (
                <div key={p.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <strong className="text-black text-sm">{p.username}</strong>
                      <span className="text-[10px] text-stone-500 block">{p.city || 'India'} • {p.primaryRole}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-purple-700 font-bold">MMR: {p.tournamentMmr.toLocaleString()}</span>
                    {isOrganiser && !auctionState.nominee && !auctionState.isCompleted && (
                      <button
                        onClick={() => handleNominatePlayer(p.id)}
                        className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2.5 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                      >
                        Re-Nominate
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: UNSELECTED PLAYERS */}
      {activeTab === 'unselected' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div>
              <h3 className="font-black text-base uppercase text-black font-sans">
                Unselected Contenders ({unselectedPlayers.length})
              </h3>
              <p className="text-[11px] text-stone-500">
                Never nominated because all mandatory team rosters (5/5) reached capacity and the auction ended.
              </p>
            </div>
            <span className="bg-stone-200 border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              Distinct from Unsold
            </span>
          </div>

          {unselectedPlayers.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">
              No unselected players recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-black/10">
              {unselectedPlayers.map(p => (
                <div key={p.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <strong className="text-black">{p.username}</strong>
                      <span className="text-[10px] text-stone-500 block">{p.city || 'India'} • {p.primaryRole}</span>
                    </div>
                  </div>
                  <span className="font-mono text-stone-600 font-bold">{p.tournamentMmr.toLocaleString()} MMR</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: NOMINATION AUDIT HISTORY */}
      {activeTab === 'audit' && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <h3 className="font-black text-base uppercase text-black font-sans">
              Authoritative Nomination History ({nominationAudits.length})
            </h3>
            <span className="text-xs text-stone-500 font-bold">Immutable Event Trail</span>
          </div>

          {nominationAudits.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">No lots concluded yet.</div>
          ) : (
            <div className="divide-y divide-black/10">
              {nominationAudits.map((audit, idx) => (
                <div key={idx} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-black text-sm">{audit.nomineeUsername}</strong>
                      <span className={`px-1.5 py-0.2 text-[9px] font-black uppercase border border-black ${
                        audit.outcome === 'SOLD' ? 'bg-[#70FFAF] text-black' : 'bg-[#FFDE59] text-black'
                      }`}>
                        {audit.outcome}
                      </span>
                    </div>
                    <span className="text-[10px] text-stone-500">{audit.role} • MMR: {audit.tournamentMmr} • {audit.bidsCount} Bids</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-black block">
                      {audit.outcome === 'SOLD' ? `${audit.winningTeamName} (${audit.winningBid} Cr)` : 'Passed as Unsold'}
                    </span>
                    <span className="text-[10px] text-stone-400">
                      {new Date(audit.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STAND-IN ASSIGNMENT MODAL */}
      {standInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h3 className="font-black text-base uppercase text-black font-sans">
                Assign Optional Stand-in (0/1)
              </h3>
              <button
                onClick={() => setStandInModalOpen(false)}
                className="font-black text-sm p-1 border border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignStandInSubmit} className="space-y-4 text-xs">
              <div>
                <SelectDropdown
                  label="Select Franchise Team:"
                  value={standInTeamId}
                  onChange={(val) => setStandInTeamId(val)}
                  options={[
                    { value: '', label: '-- Choose Team --' },
                    ...teams.filter(t => t.standIns.length === 0).map(t => ({
                      value: t.id,
                      label: `${t.name} (Primary: ${t.primaryRoster.length}/5)`
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Select Stand-in Contender:"
                  value={standInPlayerId}
                  onChange={(val) => setStandInPlayerId(val)}
                  options={[
                    { value: '', label: '-- Choose Contender --' },
                    ...[...availablePlayers, ...unsoldPlayers, ...unselectedPlayers].map(p => ({
                      value: p.id,
                      label: `${p.username} (MMR: ${p.tournamentMmr}, Status: ${p.status})`
                    }))
                  ]}
                  className="w-full"
                />
              </div>

              <p className="text-[10px] text-stone-500 leading-relaxed">
                Note: Stand-in slots (0/1) are purely optional and do not block tournament progression.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStandInModalOpen(false)}
                  className="px-3 py-2 bg-stone-100 border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!standInTeamId || !standInPlayerId}
                  className="px-4 py-2 bg-[#70FFAF] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-40"
                >
                  Confirm Stand-in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
