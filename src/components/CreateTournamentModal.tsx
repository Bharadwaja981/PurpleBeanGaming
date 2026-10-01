import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  X, 
  Sparkles, 
  Calendar, 
  Users, 
  Gavel, 
  Shield, 
  MapPin, 
  DollarSign, 
  Loader2, 
  AlertCircle, 
  Check,
  Gamepad2,
  Radio,
  Sliders,
  Flame
} from 'lucide-react';
import { 
  TournamentConfig, 
  createDefaultTournamentConfig, 
  validateTournamentConfig,
  formatINR 
} from '../domain/tournamentConfig';
import { tournamentService } from '../services/firebaseService';
import { gameManagementEngine } from '../domain/gameManagementEngine';
import { SelectDropdown } from './ui/Dropdown';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tournamentId: string) => void;
}

export function CreateTournamentModal({ isOpen, onClose, onSuccess }: CreateTournamentModalProps) {
  const activeGames = useMemo(() => gameManagementEngine.getActiveGames(), []);
  const currentUser = tournamentService.getCurrentUser();

  // Form state initialized with sensible defaults
  const [name, setName] = useState('India Esports Championship');
  const [gameId, setGameId] = useState('dota2');
  const [description, setDescription] = useState('Official competitive championship with verified team drafts and ₹ INR prize pool.');
  const [region, setRegion] = useState('Pan India');
  const [locationType, setLocationType] = useState<'ONLINE' | 'LAN'>('ONLINE');
  const [city, setCity] = useState('');
  
  // Format & Team structure
  const [teamFormationMode, setTeamFormationMode] = useState<'AUCTION' | 'PREMADE'>('AUCTION');
  const [numberOfTeams, setNumberOfTeams] = useState<number>(4);
  const [format, setFormat] = useState<'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN'>('SINGLE_ELIMINATION');
  const [seriesFormat, setSeriesFormat] = useState<'BO1' | 'BO3' | 'BO5'>('BO3');

  // Auction specific
  const [startingCredits, setStartingCredits] = useState<number>(1000);
  const [minimumBid, setMinimumBid] = useState<number>(10);
  const [bidIncrement, setBidIncrement] = useState<number>(10);
  const [bidTimerSeconds, setBidTimerSeconds] = useState<number>(25);

  // Prizes & Dates
  const [totalPrizePoolINR, setTotalPrizePoolINR] = useState<number>(50000);
  const [openDate, setOpenDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [closeDate, setCloseDate] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [visibility, setVisibility] = useState<'PUBLIC' | 'DRAFT'>('PUBLIC');

  const [activeTab, setActiveTab] = useState<'basics' | 'structure' | 'prizes'>('basics');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedGame = activeGames.find(g => g.id === gameId || g.name.toLowerCase() === gameId) || activeGames[0] || { id: 'dota2', name: 'Dota 2' };

  // Calculate prize distribution preview
  const prizeBreakdown = [
    { place: '1st (Champion)', pct: 50, amount: totalPrizePoolINR * 0.5 },
    { place: '2nd (Runner-up)', pct: 30, amount: totalPrizePoolINR * 0.3 },
    { place: '3rd Place', pct: 20, amount: totalPrizePoolINR * 0.2 },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    // Build configuration object
    const isAuction = teamFormationMode === 'AUCTION';
    const config: TournamentConfig = {
      identity: {
        tournamentId: `pb-${selectedGame.id}-${Date.now()}`,
        name: name.trim(),
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        description: description.trim(),
        region,
        locationType,
        ...(locationType === 'LAN' && city.trim() ? { city: city.trim() } : {}),
        visibility
      },
      registration: {
        registrationMode: isAuction ? 'INDIVIDUAL' : 'PREMADE_TEAM',
        openDate,
        closeDate,
        maxParticipants: numberOfTeams * (isAuction ? 8 : 1),
        eligibilityRules: {
          minMmrOrRank: 2500,
          regionLocked: region !== 'Pan India'
        }
      },
      teamFormation: {
        mode: teamFormationMode,
        numberOfTeams
      },
      roster: {
        primaryRosterSize: 5,
        captainCountsTowardRoster: true,
        substituteSlots: 1,
        substituteRequired: false,
        optionalStandInAllowed: true,
        maxStandIns: 1
      },
      auction: isAuction ? {
        enabled: true,
        creditAllocationMode: 'CAPTAIN_MMR_BALANCED',
        baseCredits: startingCredits,
        startingCredits,
        startingCreditsPerTeam: startingCredits,
        minimumBid,
        bidIncrement,
        reservePerSlot: minimumBid,
        reservePerRemainingSlot: minimumBid,
        nominationTimerSeconds: 30,
        bidTimerSeconds
      } : {
        enabled: false
      },
      competition: {
        format,
        defaultSeriesFormat: seriesFormat,
        seedingMethod: 'RATING_BASED'
      },
      prizes: {
        totalPrizePoolINR,
        placementDistribution: prizeBreakdown.map(p => ({
          placement: p.place,
          percentage: p.pct,
          amountINR: p.amount
        }))
      },
      integrity: {
        verificationRequired: false,
        organizerApprovalRequired: false
      }
    };

    // Client-side validation
    const validation = validateTournamentConfig(config);
    if (!validation.valid) {
      setErrorMsg(validation.errors.join(' '));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await tournamentService.createTournament(
        config,
        visibility,
        visibility === 'PUBLIC' ? 'REGISTRATION_OPEN' : 'DRAFT'
      );

      if (!res.success) {
        setErrorMsg(res.error || 'Failed to create tournament. Please check inputs.');
      } else {
        onSuccess(res.tournamentId);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Encountered an unexpected error creating the tournament.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-2xl bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto z-10">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-black uppercase px-2 py-0.5 bg-[#FFE600] text-black border border-black">
                Organiser Authority
              </span>
              <span className="font-mono text-[10px] font-black uppercase text-stone-500">
                Host: {currentUser.displayName || currentUser.email || 'Organiser'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black font-sans flex items-center gap-2">
              <Trophy className="w-6 h-6 text-[#7C3AED]" />
              <span>Create Tournament</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 border-2 border-black bg-stone-100 hover:bg-[#FFE600] active:translate-x-0.5 active:translate-y-0.5 text-black cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 gap-2 border-b-2 border-black pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('basics')}
            className={`py-2 px-3 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'basics' 
                ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' 
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            1. Identity &amp; Title
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('structure')}
            className={`py-2 px-3 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'structure' 
                ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' 
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            2. Format &amp; Draft
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('prizes')}
            className={`py-2 px-3 font-mono text-xs font-black uppercase border-2 border-black transition-all cursor-pointer ${
              activeTab === 'prizes' 
                ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' 
                : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
            }`}
          >
            3. Prizes &amp; Launch
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border-2 border-red-500 text-red-700 font-mono text-xs flex items-start gap-2 shadow-[2px_2px_0px_0px_#ef4444]">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <div className="flex-1 break-words">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* TAB 1: Basics & Game */}
          {activeTab === 'basics' && (
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                  Tournament Championship Title *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., PBG All-India Dota 2 Invitational Season 1"
                  className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Esports Game Title *
                  </label>
                  <select
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  >
                    {activeGames.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Geographic Region
                  </label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value="Pan India">Pan India (All Regions)</option>
                    <option value="South India">South India (Bengaluru, Chennai, Hyderabad)</option>
                    <option value="West India">West India (Mumbai, Pune, Ahmedabad)</option>
                    <option value="North India">North India (Delhi NCR, Punjab)</option>
                    <option value="East India">East India (Kolkata, North-East)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Tournament Type / Venue
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLocationType('ONLINE')}
                      className={`p-2.5 border-2 border-black font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                        locationType === 'ONLINE' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Online Web</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocationType('LAN')}
                      className={`p-2.5 border-2 border-black font-mono text-xs font-black uppercase flex items-center justify-center gap-1.5 cursor-pointer ${
                        locationType === 'LAN' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white hover:bg-stone-50'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>LAN Venue</span>
                    </button>
                  </div>
                </div>

                {locationType === 'LAN' ? (
                  <div>
                    <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                      LAN Host City *
                    </label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g., Mumbai, Bengaluru, Hyderabad"
                      className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                      Publication Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value as any)}
                      className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                    >
                      <option value="PUBLIC">Public (Featured in Tournaments Directory)</option>
                      <option value="DRAFT">Draft (Private to Organiser Desk)</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                  Championship Overview &amp; Rules Summary
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('structure')}
                  className="py-2.5 px-6 bg-black hover:bg-stone-900 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Continue to Format &amp; Draft →
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Structure & Draft */}
          {activeTab === 'structure' && (
            <div className="space-y-4">
              <div className="p-3 bg-[#FFF9E6] border-2 border-black space-y-2">
                <span className="font-mono text-xs font-black uppercase text-black block">
                  Choose Tournament Registration Model:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTeamFormationMode('AUCTION')}
                    className={`p-3 text-left border-2 border-black transition-all cursor-pointer ${
                      teamFormationMode === 'AUCTION'
                        ? 'bg-[#FFE600] shadow-[3px_3px_0px_0px_#000]'
                        : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Gavel className="w-4 h-4 text-black" />
                      <span className="font-mono font-black text-xs uppercase text-black">
                        Captain Auction Draft
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-stone-700 leading-snug">
                      Individual players sign up; appointed captains bid with purse credits in the live draft room.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTeamFormationMode('PREMADE')}
                    className={`p-3 text-left border-2 border-black transition-all cursor-pointer ${
                      teamFormationMode === 'PREMADE'
                        ? 'bg-[#FFE600] shadow-[3px_3px_0px_0px_#000]'
                        : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-black" />
                      <span className="font-mono font-black text-xs uppercase text-black">
                        Pre-made Squads
                      </span>
                    </div>
                    <p className="font-mono text-[11px] text-stone-700 leading-snug">
                      Existing 5-player teams register together with a designated captain and squad roster.
                    </p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Number of Teams
                  </label>
                  <select
                    value={numberOfTeams}
                    onChange={(e) => setNumberOfTeams(Number(e.target.value))}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value={2}>2 Teams (Showmatch / Finals)</option>
                    <option value={4}>4 Teams (Semifinals + Finals)</option>
                    <option value={8}>8 Teams (Full Bracket)</option>
                    <option value={16}>16 Teams (Championship)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Bracket Format
                  </label>
                  <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as any)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value="SINGLE_ELIMINATION">Single Elimination (Knockout)</option>
                    <option value="DOUBLE_ELIMINATION">Double Elimination (Upper &amp; Lower)</option>
                    <option value="ROUND_ROBIN">Round Robin (Group Stage)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Series Format
                  </label>
                  <select
                    value={seriesFormat}
                    onChange={(e) => setSeriesFormat(e.target.value as any)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  >
                    <option value="BO1">Best of 1 (BO1)</option>
                    <option value="BO3">Best of 3 (BO3)</option>
                    <option value="BO5">Best of 5 (BO5 Grand Finals)</option>
                  </select>
                </div>
              </div>

              {/* Auction Controls if Auction Mode */}
              {teamFormationMode === 'AUCTION' && (
                <div className="p-3 bg-white border-2 border-black space-y-3">
                  <div className="flex items-center gap-1.5 font-mono text-xs font-black uppercase text-black border-b border-black pb-1.5">
                    <Sliders className="w-3.5 h-3.5 text-[#7C3AED]" />
                    <span>Auction Purse &amp; Timer Parameters</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block font-mono text-[10px] font-black uppercase text-stone-600 mb-0.5">
                        Base Purse Credits
                      </label>
                      <input
                        type="number"
                        min={100}
                        step={50}
                        value={startingCredits}
                        onChange={(e) => setStartingCredits(Number(e.target.value))}
                        className="w-full bg-stone-50 border border-black p-1.5 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] font-black uppercase text-stone-600 mb-0.5">
                        Minimum Opening Bid
                      </label>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={minimumBid}
                        onChange={(e) => setMinimumBid(Number(e.target.value))}
                        className="w-full bg-stone-50 border border-black p-1.5 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] font-black uppercase text-stone-600 mb-0.5">
                        Bid Increment
                      </label>
                      <input
                        type="number"
                        min={5}
                        step={5}
                        value={bidIncrement}
                        onChange={(e) => setBidIncrement(Number(e.target.value))}
                        className="w-full bg-stone-50 border border-black p-1.5 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[10px] font-black uppercase text-stone-600 mb-0.5">
                        Nomination Timer
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={60}
                        value={bidTimerSeconds}
                        onChange={(e) => setBidTimerSeconds(Number(e.target.value))}
                        className="w-full bg-stone-50 border border-black p-1.5 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('basics')}
                  className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-black font-mono text-xs font-black uppercase border-2 border-black cursor-pointer"
                >
                  ← Back to Basics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('prizes')}
                  className="py-2.5 px-6 bg-black hover:bg-stone-900 text-white font-mono text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Continue to Prizes &amp; Dates →
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Prizes & Dates */}
          {activeTab === 'prizes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Registration Opens
                  </label>
                  <input
                    type="date"
                    required
                    value={openDate}
                    onChange={(e) => setOpenDate(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                    Registration Closes
                  </label>
                  <input
                    type="date"
                    required
                    value={closeDate}
                    onChange={(e) => setCloseDate(e.target.value)}
                    className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase text-black mb-1">
                  Total Prize Pool (₹ INR)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  required
                  value={totalPrizePoolINR}
                  onChange={(e) => setTotalPrizePoolINR(Number(e.target.value))}
                  className="w-full bg-white border-2 border-black p-2.5 font-mono text-sm font-black text-black focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              {/* Prize Distribution Breakdown Preview */}
              <div className="p-3 bg-[#FAF8F5] border-2 border-black space-y-2">
                <span className="font-mono text-xs font-black uppercase text-black block">
                  Automated Placement Prize Distribution:
                </span>
                <div className="space-y-1.5 font-mono text-xs">
                  {prizeBreakdown.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-white border border-black">
                      <span className="font-bold">{p.place} ({p.pct}%)</span>
                      <span className="font-black text-[#7C3AED]">{formatINR(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setActiveTab('structure')}
                  className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-black font-mono text-xs font-black uppercase border-2 border-black cursor-pointer"
                >
                  ← Back to Structure
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`py-3 px-8 bg-[#FFE600] hover:bg-yellow-400 text-black font-mono text-xs font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_#000] flex items-center gap-2 ${
                    isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black shrink-0" />
                  ) : (
                    <Flame className="w-4 h-4 text-black shrink-0" />
                  )}
                  <span>{isSubmitting ? 'Creating Championship...' : 'Launch Tournament Now'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
