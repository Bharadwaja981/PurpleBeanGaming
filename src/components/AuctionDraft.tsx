import React, { useState, useEffect, useRef } from 'react';
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
  Lock,
  Settings,
  Send,
  ArrowRight,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Bell
} from 'lucide-react';
import { ConfirmationModal } from './ui/ConfirmationModal';

// Web Audio API Synthesizer for Auction Floor Sound Effects (Calling Once, Twice, Thrice, Sold, Anti-Snipe)
function playAuctionSound(type: 'call_once' | 'call_twice' | 'call_thrice' | 'sold' | 'antisnipe') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'call_once') {
      // Single clear bell chime (D5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'call_twice') {
      // Double urgent chime (D5 -> E5)
      [587.33, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.18);
        gain.gain.setValueAtTime(0.32, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.5);
      });
    } else if (type === 'call_thrice') {
      // Triple rapid urgent warning chimes (E5 -> G5 -> A5)
      [659.25, 783.99, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.13);
        gain.gain.setValueAtTime(0.35, now + i * 0.13);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.13 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.13);
        osc.stop(now + i * 0.13 + 0.4);
      });
    } else if (type === 'sold') {
      // Gavel strike heavy impact thud
      const oscThump = ctx.createOscillator();
      const gainThump = ctx.createGain();
      oscThump.type = 'sine';
      oscThump.frequency.setValueAtTime(140, now);
      oscThump.frequency.exponentialRampToValueAtTime(35, now + 0.25);
      gainThump.gain.setValueAtTime(0.7, now);
      gainThump.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      oscThump.connect(gainThump);
      gainThump.connect(ctx.destination);
      oscThump.start(now);
      oscThump.stop(now + 0.25);

      // Triumph chord (C5 - E5 - G5 - C6)
      [523.25, 659.25, 783.99, 1046.50].forEach(freq => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + 0.08);
        gain.gain.setValueAtTime(0.22, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + 0.08);
        osc.stop(now + 1.2);
      });
    } else if (type === 'antisnipe') {
      // Electric extension laser sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.35);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    }
  } catch {
    // Audio context not allowed or supported in client context
  }
}
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown } from './ui/Dropdown';
import { 
  dotaAuctionEngine, 
  getAuctionEngine,
  DotaAuctionEngine,
  DotaAuctionPlayer, 
  DotaAuctionTeam, 
  DotaAuctionState, 
  DotaBidRecord, 
  DotaNominationAudit 
} from '../domain/dotaAuctionEngine';
import { 
  CreditAllocationMode, 
  AuctionPurseAllocationAudit, 
  EXPLANATION_TEXT 
} from '../domain/dotaAuctionMmrBalancer';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { auctionPresenceManager, PresenceMember } from '../services/presenceService';

export interface AuctionDraftProps {
  onNavigate?: (view: any, entityId?: string) => void;
  tournamentId?: string;
}

export function AuctionDraft({ onNavigate, tournamentId }: AuctionDraftProps = {}) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiserUser = currentUser.role === 'organizer' || currentUser.isAdmin;
  const isActualCaptain = currentUser.role === 'captain';

  const tournaments = tournamentService.getTournaments();
  const selectedTournamentId = tournamentId || '';

  const currentTournament = selectedTournamentId ? tournaments.find(t => t.id === selectedTournamentId) : undefined;
  const isAuctionSupported = selectedTournamentId ? tournamentConfigRegistry.isAuctionSupported(selectedTournamentId) : false;

  // Tournament-scoped domain engine instance
  const activeEngine = getAuctionEngine(selectedTournamentId || 'purple-bean-test-cup');

  // Synchronized auction state
  const [auctionState, setAuctionState] = useState<DotaAuctionState>(() => activeEngine.getState());
  const [teams, setTeams] = useState<DotaAuctionTeam[]>(() => activeEngine.getTeams());
  const [availablePlayers, setAvailablePlayers] = useState<DotaAuctionPlayer[]>(() => activeEngine.getAvailablePlayers());
  const [soldPlayers, setSoldPlayers] = useState<DotaAuctionPlayer[]>(() => activeEngine.getSoldPlayers());
  const [unsoldPlayers, setUnsoldPlayers] = useState<DotaAuctionPlayer[]>(() => activeEngine.getUnsoldPlayers());
  const [unselectedPlayers, setUnselectedPlayers] = useState<DotaAuctionPlayer[]>(() => activeEngine.getUnselectedPlayers());
  const [bidHistory, setBidHistory] = useState<DotaBidRecord[]>(() => activeEngine.getBidHistory());
  const [nominationAudits, setNominationAudits] = useState<DotaNominationAudit[]>(() => activeEngine.getNominationAudits());

  // UI state & perspective simulation for testing
  const [activeTab, setActiveTab] = useState<'live' | 'teams' | 'sold' | 'unsold' | 'unselected' | 'audit'>('live');
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidSuccess, setBidSuccess] = useState<string | null>(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState<string>('');
  const [customBidAmount, setCustomBidAmount] = useState<string>('');
  const [customExtendSeconds, setCustomExtendSeconds] = useState<string>('15');

  // Captain team branding & customization state
  const [showTeamCustomizerModal, setShowTeamCustomizerModal] = useState(false);
  const [customTeamName, setCustomTeamName] = useState('');
  const [customTeamTag, setCustomTeamTag] = useState('');
  const [customTeamLogo, setCustomTeamLogo] = useState('🛡️');
  const [customTeamColor, setCustomTeamColor] = useState('#7C3AED');
  const [customTeamBanner, setCustomTeamBanner] = useState('linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)');
  const [spectatorCheerMsg, setSpectatorCheerMsg] = useState('');
  const [cheersList, setCheersList] = useState<{ id: string; user: string; text: string; time: string }[]>([
    { id: 'c-1', user: 'Spectator_01', text: '🔥 Let the bidding battle begin!', time: '12:00' },
    { id: 'c-2', user: 'DotaFanatic', text: '⚡ Big bids incoming for the mid-laners!', time: '12:01' }
  ]);

  // Organiser simulated perspective: allows organisers/testers to switch to captain live bidding device
  const [simulatedCaptainTeamId, setSimulatedCaptainTeamId] = useState<string>('');

  // Stand-in assignment modal state
  const [standInModalOpen, setStandInModalOpen] = useState(false);
  const [standInTeamId, setStandInTeamId] = useState<string>('');
  const [standInPlayerId, setStandInPlayerId] = useState<string>('');
  const [isFinalizeConfirmOpen, setIsFinalizeConfirmOpen] = useState(false);

  // MMR-balanced purse allocation state
  const [purseAudit, setPurseAudit] = useState<AuctionPurseAllocationAudit | null>(() => activeEngine.getPurseAllocationAudit());

  // Auction sound & live call stage state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeAntiSnipeNotice, setActiveAntiSnipeNotice] = useState<{
    teamName: string;
    amount: number;
    extendedSeconds: number;
    timestamp: number;
  } | null>(null);

  const lastSoundPlayedRef = useRef<{ phase: string; nomineeId: string; revision: number }>({
    phase: '',
    nomineeId: '',
    revision: 0
  });
  const lastAntiSnipeTsRef = useRef<number>(0);
  const lastLotResultTsRef = useRef<string>('');

  // Anti-snipe detection and dynamic toast notification
  useEffect(() => {
    if (auctionState.lastAntiSnipe && auctionState.lastAntiSnipe.timestamp > lastAntiSnipeTsRef.current) {
      lastAntiSnipeTsRef.current = auctionState.lastAntiSnipe.timestamp;
      setActiveAntiSnipeNotice(auctionState.lastAntiSnipe);
      // Reset sound tracking so calling once/twice/thrice chime fresh on the extended clock
      lastSoundPlayedRef.current = {
        phase: '',
        nomineeId: auctionState.nominee?.id || '',
        revision: auctionState.revision
      };
      if (soundEnabled) {
        playAuctionSound('antisnipe');
      }
      const t = setTimeout(() => {
        setActiveAntiSnipeNotice(null);
      }, 6500);
      return () => clearTimeout(t);
    }
  }, [auctionState.lastAntiSnipe, auctionState.nominee?.id, auctionState.revision, soundEnabled]);

  // Audio & announcement synchronization for Calling Once, Twice, Thrice
  useEffect(() => {
    if (auctionState.status !== 'LIVE' || !auctionState.nominee) return;

    const nomId = auctionState.nominee.id;
    const sec = auctionState.secondsRemaining;
    const hasBids = Boolean(auctionState.leadingTeamId);
    let currentCall = '';

    // Only play formal gavel call chimes if at least one bid is on the floor
    if (hasBids) {
      if (sec <= 2 && sec > 0) {
        currentCall = 'thrice';
      } else if (sec <= 5 && sec > 2) {
        currentCall = 'twice';
      } else if (sec <= 8 && sec > 5) {
        currentCall = 'once';
      }
    }

    if (
      currentCall &&
      (lastSoundPlayedRef.current.phase !== currentCall ||
        lastSoundPlayedRef.current.nomineeId !== nomId ||
        lastSoundPlayedRef.current.revision !== auctionState.revision)
    ) {
      lastSoundPlayedRef.current = {
        phase: currentCall,
        nomineeId: nomId,
        revision: auctionState.revision
      };
      if (soundEnabled) {
        if (currentCall === 'once') playAuctionSound('call_once');
        if (currentCall === 'twice') playAuctionSound('call_twice');
        if (currentCall === 'thrice') playAuctionSound('call_thrice');
      }
    }
  }, [
    auctionState.secondsRemaining,
    auctionState.status,
    auctionState.nominee?.id,
    auctionState.revision,
    auctionState.leadingTeamId,
    soundEnabled
  ]);

  // SOLD gavel drop sound effect
  useEffect(() => {
    if (auctionState.lastLotResult && auctionState.lastLotResult.timestamp !== lastLotResultTsRef.current) {
      lastLotResultTsRef.current = auctionState.lastLotResult.timestamp;
      if (auctionState.lastLotResult.outcome === 'SOLD' && soundEnabled) {
        playAuctionSound('sold');
      }
    }
  }, [auctionState.lastLotResult, soundEnabled]);

  // Subscribe to domain engine events for this specific tournament
  useEffect(() => {
    if (!selectedTournamentId) return;
    const engine = getAuctionEngine(selectedTournamentId);
    const handleSync = () => {
      setAuctionState(engine.getState());
      setTeams(engine.getTeams());
      setAvailablePlayers(engine.getAvailablePlayers());
      setSoldPlayers(engine.getSoldPlayers());
      setUnsoldPlayers(engine.getUnsoldPlayers());
      setUnselectedPlayers(engine.getUnselectedPlayers());
      setBidHistory(engine.getBidHistory());
      setNominationAudits(engine.getNominationAudits());
      setPurseAudit(engine.getPurseAllocationAudit());
    };

    handleSync();
    return engine.subscribe(handleSync);
  }, [selectedTournamentId]);

  // Direct URL Security Check 0: Tournament ID not provided (global access attempt)
  if (!selectedTournamentId) {
    const auctionTourneys = tournaments.filter(t => tournamentConfigRegistry.isAuctionSupported(t.id));
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8 font-mono">
        <AlertCircle className="w-12 h-12 text-[#FF5757] mx-auto" />
        <h2 className="font-sans font-black text-2xl uppercase text-black">Tournament Context Required</h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          Each tournament has its own dedicated auction room, franchises, and contenders. Select which tournament's auction room you wish to enter:
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {auctionTourneys.map(t => (
            <button
              key={t.id}
              onClick={() => onNavigate && onNavigate('auction', t.id)}
              className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              Enter {t.name} Auction →
            </button>
          ))}
          <button
            onClick={() => onNavigate && onNavigate('tournaments')}
            className="bg-white hover:bg-stone-100 text-black border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Browse All Tournaments
          </button>
        </div>
      </div>
    );
  }

  // Direct URL Security Check 1: Tournament does not exist
  if (!currentTournament && tournaments.length > 0 && !tournamentConfigRegistry.getConfig(selectedTournamentId)) {
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8 font-mono">
        <AlertCircle className="w-12 h-12 text-[#FF5757] mx-auto" />
        <h2 className="font-sans font-black text-2xl uppercase text-black">Tournament Not Found</h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          The requested tournament '{selectedTournamentId}' does not exist or has not been published yet.
        </p>
        <button
          onClick={() => onNavigate && onNavigate('tournaments')}
          className="bg-[#FFE600] border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          Browse Tournaments
        </button>
      </div>
    );
  }

  // Direct URL Security Check 2: Tournament does NOT support auction (e.g. Premade Team Squads)
  if (!isAuctionSupported) {
    return (
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-8 text-center space-y-4 my-8 font-mono">
        <AlertCircle className="w-12 h-12 text-[#FF5757] mx-auto" />
        <div className="bg-[#FFE600] text-black border border-black px-3 py-1 text-xs font-black uppercase inline-block">
          Team Formation: {currentTournament?.format?.toLowerCase().includes('premade') ? 'PREMADE SQUAD' : 'NON-AUCTION'}
        </div>
        <h2 className="font-sans font-black text-2xl uppercase text-black">Auction Not Available</h2>
        <p className="text-sm text-stone-600 max-w-md mx-auto">
          {currentTournament?.name || 'This tournament'} does not feature a live captain auction. It is configured for premade squads or direct team registrations.
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => onNavigate && onNavigate('tournament_detail', selectedTournamentId)}
            className="bg-[#7C3AED] text-white border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            ← Return to Tournament Overview
          </button>
          <button
            onClick={() => onNavigate && onNavigate('tournaments')}
            className="bg-white hover:bg-stone-100 text-black border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            All Tournaments
          </button>
        </div>
      </div>
    );
  }

  // Environment check: Perspective switcher is development/testing functionality ONLY
  const isDevMode = Boolean(import.meta.env?.DEV);

  // In production, perspective switching is completely disabled and excluded
  const effectiveSimulatedCaptainTeamId = isDevMode ? simulatedCaptainTeamId : '';

  // Determine active captain team based on authenticated identity, email, or appointed registration in THIS tournament
  const matchedUserCaptainTeam = teams.find(t => 
    t.captainId === currentUser.id ||
    (currentUser.email && ((t as any).captainEmail?.toLowerCase() === currentUser.email.toLowerCase() || t.captainId?.toLowerCase() === currentUser.email.toLowerCase())) ||
    (currentUser.displayName && (t.captainIgn?.toLowerCase() === currentUser.displayName.toLowerCase() || t.captainId?.toLowerCase() === currentUser.displayName.toLowerCase())) ||
    Boolean(tournamentService.getTournamentRegistrations(selectedTournamentId).find(r => 
      (r.userId === currentUser.id || (currentUser.email && r.userEmail?.toLowerCase() === currentUser.email.toLowerCase()) || (currentUser.displayName && r.ign?.toLowerCase() === currentUser.displayName.toLowerCase())) &&
      r.isCaptainApproved && (r.teamId === t.id || t.captainId === r.userId)
    ))
  );

  const effectiveCaptainTeam = (() => {
    if (effectiveSimulatedCaptainTeamId) {
      return teams.find(t => t.id === effectiveSimulatedCaptainTeamId);
    }
    if (matchedUserCaptainTeam) {
      return matchedUserCaptainTeam;
    }
    if (isActualCaptain) {
      // Must be an appointed captain of a team in THIS tournament!
      return teams.find(t => t.captainId === currentUser.id);
    }
    return undefined;
  })();

  // Role authority checks
  const canOperateThisAuction = tournamentConfigRegistry.canUserManageTournamentAuction(currentUser, selectedTournamentId);
  const isCaptainViewActive = Boolean(effectiveCaptainTeam && (!isOrganiserUser || effectiveSimulatedCaptainTeamId));
  const isOrganiserDeskActive = isOrganiserUser && canOperateThisAuction && !effectiveSimulatedCaptainTeamId;

  // Inform engine whether this client acts as authoritative organiser host
  useEffect(() => {
    activeEngine.setOrganiserHost(Boolean(isOrganiserDeskActive));
  }, [isOrganiserDeskActive, activeEngine]);

  // Active nominee & configuration from tournament engine
  const currentNominee = auctionState.nominee;
  const config = activeEngine.getConfig();

  // Stand-in round & roster capacity invariants
  const isStandInRoundActive = Boolean(auctionState.standInRoundActive);
  const captainPrimaryCount = effectiveCaptainTeam ? effectiveCaptainTeam.primaryRoster.length : 0;
  const isCaptainPrimaryFull = captainPrimaryCount >= config.primaryRosterSize;
  const isCaptainStandInFull = effectiveCaptainTeam ? effectiveCaptainTeam.standIns.length >= config.optionalStandInLimit : false;
  
  // Rule: Teams whose primary roster is full (5/5) CANNOT BID unless the organiser officially opens the Stand-in auction round!
  const canCaptainBid = !isStandInRoundActive ? !isCaptainPrimaryFull : !isCaptainStandInFull;

  // Reserve rule details for active captain team
  const captainRemainingMandatorySlots = effectiveCaptainTeam ? Math.max(0, config.primaryRosterSize - captainPrimaryCount - 1) : 0;
  const captainMandatoryReserveNeeded = captainRemainingMandatorySlots * config.reservePerSlot;
  const captainMaxAllowableBid = effectiveCaptainTeam && canCaptainBid
    ? Math.max(0, effectiveCaptainTeam.remainingCredits - (!isStandInRoundActive ? captainMandatoryReserveNeeded : 0))
    : 0;

  // Leading team check
  const isLeading = Boolean(effectiveCaptainTeam && auctionState.leadingTeamId === effectiveCaptainTeam.id);
  const isOutbid = Boolean(effectiveCaptainTeam && auctionState.leadingTeamId && auctionState.leadingTeamId !== effectiveCaptainTeam.id);

  // -------------------------------------------------------------
  // Actions (Tournament-Scoped)
  // -------------------------------------------------------------
  const handleStartAuction = () => {
    setBidError(null);
    const res = activeEngine.startAuction(currentUser.id);
    if (res.success) {
      setBidSuccess('Live Auction Floor opened! Contenders can now be nominated.');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to start auction.');
    }
  };

  const handleRecalculatePurses = () => {
    setBidError(null);
    const res = activeEngine.recalculatePurses(currentUser.id);
    if (res.success) {
      setPurseAudit(res.audit || null);
      setBidSuccess('Starting auction credits recalculated and balanced successfully!');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to recalculate purses.');
    }
  };

  const handleToggleAllocationMode = (newMode: CreditAllocationMode) => {
    setBidError(null);
    const res = activeEngine.setAllocationMode(newMode, currentUser.id);
    if (res.success) {
      setPurseAudit(res.audit || null);
      setBidSuccess(`Allocation mode switched to ${newMode}`);
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to switch allocation mode.');
    }
  };

  const handlePauseAuction = () => {
    setBidError(null);
    const res = tournamentService.pauseDotaAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess('Auction floor PAUSED by organiser.');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to pause auction.');
    }
  };

  const handleResumeAuction = () => {
    setBidError(null);
    const res = tournamentService.resumeDotaAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess('Auction floor RESUMED.');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to resume auction.');
    }
  };

  const handleToggleAntiSnipe = () => {
    const currentConfig = activeEngine.getConfig();
    const updated = activeEngine.updateConfig({
      bidExtensionEnabled: !currentConfig.bidExtensionEnabled
    });
    setBidSuccess(`Anti-sniping Bid Extension ${updated.bidExtensionEnabled ? 'ENABLED (+5s on bids within 5s window)' : 'DISABLED'}.`);
    setTimeout(() => setBidSuccess(null), 3000);
  };

  const handleNominatePlayer = (playerId: string) => {
    setBidError(null);
    setBidSuccess(null);
    const res = tournamentService.nominateDotaPlayer(playerId, selectedTournamentId);
    if (!res.success) {
      setBidError(res.error || 'Failed to nominate player.');
      setTimeout(() => setBidError(null), 4000);
    } else {
      setSelectedNomineeId('');
      setBidSuccess(`✓ ${res.nominee?.username} is now LIVE on the auction floor! 30s countdown started.`);
      setTimeout(() => setBidSuccess(null), 3500);
    }
  };

  const handlePlaceQuickBid = (increment: number) => {
    setBidError(null);
    setBidSuccess(null);

    if (!effectiveCaptainTeam) {
      setBidError('No team selected to bid.');
      return;
    }

    if (!canCaptainBid) {
      setBidError(isCaptainPrimaryFull && !isStandInRoundActive
        ? `Roster Full: ${effectiveCaptainTeam.name} already has a complete primary roster (5/5). Teams with complete rosters cannot bid while other teams are still filling their primary rosters. Stand-in round will open only after all teams have full rosters.`
        : `Stand-in slot full: Bidding is closed for your team.`);
      return;
    }

    const proposedAmount = auctionState.currentBid + increment;
    const res = tournamentService.placeDotaAuctionBid({
      tournamentId: selectedTournamentId,
      teamId: effectiveCaptainTeam.id,
      bidAmount: proposedAmount,
      increment,
      expectedRevision: auctionState.revision,
      simulatedCaptainId: isDevMode && effectiveSimulatedCaptainTeamId ? effectiveCaptainTeam.captainId : undefined
    });

    if (res.success) {
      setBidSuccess(`✓ Bid accepted! ${res.leadingTeamName} leads at ${res.currentBid} credits.`);
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Bid rejected.');
      setTimeout(() => setBidError(null), 4000);
    }
  };

  const handlePlaceCustomBid = (e: React.FormEvent) => {
    e.preventDefault();
    setBidError(null);
    setBidSuccess(null);

    const amount = Number(customBidAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      setBidError('Please enter a valid bid amount.');
      return;
    }

    if (!effectiveCaptainTeam) {
      setBidError('No team selected to bid.');
      return;
    }

    if (!canCaptainBid) {
      setBidError(isCaptainPrimaryFull && !isStandInRoundActive
        ? `Roster Full: ${effectiveCaptainTeam.name} already has a complete primary roster (5/5). Teams with complete rosters cannot bid while other teams are still filling their primary rosters. Stand-in round will open only after all teams have full rosters.`
        : `Stand-in slot full: Bidding is closed for your team.`);
      return;
    }

    const res = tournamentService.placeDotaAuctionBid({
      tournamentId: selectedTournamentId,
      teamId: effectiveCaptainTeam.id,
      bidAmount: amount,
      expectedRevision: auctionState.revision,
      simulatedCaptainId: isDevMode && effectiveSimulatedCaptainTeamId ? effectiveCaptainTeam.captainId : undefined
    });

    if (res.success) {
      setBidSuccess(`✓ Custom bid accepted! ${res.leadingTeamName} leads at ${res.currentBid} credits.`);
      setCustomBidAmount('');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Custom bid rejected.');
      setTimeout(() => setBidError(null), 4000);
    }
  };

  const handleConcludeSale = () => {
    setBidError(null);
    setBidSuccess(null);
    try {
      const res = tournamentService.concludeDotaAuctionItem(true, selectedTournamentId);
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
      const res = tournamentService.concludeDotaAuctionItem(false, selectedTournamentId);
      setBidError(`Contender ${res.player.username} passed as UNSOLD.`);
      setTimeout(() => setBidError(null), 4000);
    } catch (err: any) {
      setBidError(err.message || 'Failed to pass lot.');
    }
  };

  const handleFinalizeAuction = () => {
    const teamsBelowCapacity = teams.filter(t => t.primaryRoster.length < config.primaryRosterSize);
    if (teamsBelowCapacity.length > 0) {
      setBidError(`Cannot finalize auction: All teams must reach full ${config.primaryRosterSize}/${config.primaryRosterSize} roster before finalizing. Current: ${teamsBelowCapacity.map(t => `${t.name} (${t.primaryRoster.length}/${config.primaryRosterSize})`).join(', ')}`);
      setTimeout(() => setBidError(null), 5000);
      return;
    }
    setIsFinalizeConfirmOpen(true);
  };

  const executeFinalizeAuction = () => {
    setIsFinalizeConfirmOpen(false);
    const res = tournamentService.finalizeDotaAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess(`✓ Auction finalized! All teams reached full ${config.primaryRosterSize}/${config.primaryRosterSize} rosters.`);
    } else {
      setBidError((res as any).error || 'Failed to finalize auction.');
    }
  };

  const handleAssignStandInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!standInTeamId || !standInPlayerId) return;
    const res = tournamentService.assignDotaStandIn(standInTeamId, standInPlayerId, selectedTournamentId);
    if (res.success) {
      setBidSuccess(`✓ Optional stand-in assigned to ${res.team?.name}!`);
      setStandInModalOpen(false);
      setStandInPlayerId('');
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to assign stand-in.');
    }
  };

  const handleStartStandInAuction = () => {
    setBidError(null);
    const res = tournamentService.startStandInAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess('✓ Stand-in auction round commenced! Teams can now bid to draft 1 optional stand-in player.');
      setTimeout(() => setBidSuccess(null), 3500);
    } else {
      setBidError(res.error || 'Failed to start stand-in auction.');
      setTimeout(() => setBidError(null), 4000);
    }
  };

  const handleConcludeStandInAuction = () => {
    setBidError(null);
    const res = tournamentService.concludeStandInAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess('✓ Stand-in round concluded and auction finalized!');
      setTimeout(() => setBidSuccess(null), 3500);
    } else {
      setBidError(res.error || 'Failed to conclude stand-in auction.');
    }
  };

  const handleReopenAuction = () => {
    setBidError(null);
    const res = tournamentService.reopenDotaAuction(selectedTournamentId);
    if (res.success) {
      setBidSuccess('✓ Auction floor reopened! Contenders can now be nominated.');
      setTimeout(() => setBidSuccess(null), 3000);
    }
  };

  const handleReauctionPlayer = (playerId: string) => {
    setBidError(null);
    const res = tournamentService.reauctionDotaPlayer(playerId, selectedTournamentId);
    if (res.success) {
      setBidSuccess(`✓ Contender ${res.player?.username || ''} returned to AVAILABLE pool for re-auction.`);
      setTimeout(() => setBidSuccess(null), 3000);
    } else {
      setBidError(res.error || 'Failed to re-auction player.');
    }
  };

  const handleReauctionAndNominatePlayer = (playerId: string) => {
    setBidError(null);
    const res = tournamentService.reauctionAndNominateDotaPlayer(playerId, selectedTournamentId);
    if (res.success) {
      setBidSuccess(`✓ Contender ${res.nominee?.username || ''} re-auctioned & LIVE on the block!`);
      setTimeout(() => setBidSuccess(null), 3500);
    } else {
      setBidError(res.error || 'Failed to nominate player.');
    }
  };

  const handleReauctionAllUnsold = () => {
    setBidError(null);
    const res = tournamentService.startDotaUnsoldSecondPass(selectedTournamentId);
    if (res.success) {
      setBidSuccess(`✓ Re-auction started! ${res.reauctionCount} unsold contenders returned to pool.`);
      setTimeout(() => setBidSuccess(null), 3500);
    } else {
      setBidError(res.error || 'Failed to start second pass.');
    }
  };

  return (
    <div className="w-full space-y-6 font-mono pb-16">
      {/* Top Banner & State Ticker */}
      <div className="bg-white border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#FF70A6] border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <Gavel className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-[#FFE600] px-1.5 py-0.5 border border-black">
                DOTA 2 PHASE 2 · LIVE CAPTAIN AUCTION
              </span>
              <span className={`px-1.5 py-0.5 border border-black text-[10px] font-black uppercase ${
                auctionState.isCompleted ? 'bg-[#70FFAF] text-black' :
                auctionState.status === 'LIVE' ? 'bg-[#FFDE59] text-black animate-pulse' :
                auctionState.status === 'PAUSED' ? 'bg-amber-300 text-black' :
                'bg-stone-200 text-stone-700'
              }`}>
                {auctionState.status}
              </span>
              {auctionState.standInRoundActive && (
                <span className="px-1.5 py-0.5 border border-black text-[10px] font-black uppercase bg-[#C7D2FE] text-indigo-950 animate-pulse font-mono">
                  STAND-IN ROUND
                </span>
              )}
              {config.bidExtensionEnabled && (
                <span className="text-[9px] font-black uppercase bg-[#00F0FF]/30 border border-black px-1.5 py-0.5 text-cyan-950 flex items-center gap-1 font-bold">
                  <span>⚡</span> Anti-Snipe +{config.extensionTimeSeconds || 8}s
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-tight mt-0.5">
              {config.tournamentName} · FRANCHISE DRAFT
            </h1>
            <p className="text-xs text-stone-600">
              Purse: {config.startingCredits} Credits • Min Increment: +{config.bidIncrement} • Reserve: {config.reservePerSlot} Cr/slot
            </p>
          </div>
        </div>

        {/* Status Indicators & Navigation */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onNavigate && (
            <button
              onClick={() => onNavigate('tournament_detail', selectedTournamentId)}
              className="bg-white hover:bg-stone-100 text-black border-2 border-black px-3 py-1.5 font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1 cursor-pointer mr-1"
              title="Return to tournament details and overview"
            >
              ← Tournament Hub
            </button>
          )}

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`px-2.5 py-1.5 border-2 border-black font-mono text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer mr-1 ${
              soundEnabled ? 'bg-[#70FFAF] text-black hover:bg-emerald-300' : 'bg-stone-200 text-stone-600 hover:bg-stone-300'
            }`}
            title={soundEnabled ? 'Auction sound effects enabled (Calling chimes, Gavel, Anti-Snipe)' : 'Sound effects muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{soundEnabled ? 'SFX ON' : 'SFX MUTED'}</span>
          </button>
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

      {/* PERSPECTIVE / TESTING SWITCHER (DEV mode only - strictly excluded from production build) */}
      {isDevMode && isOrganiserUser && (
        <div className="bg-[#FFF9E6] border-2 border-black p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#7C3AED]" />
            <span className="font-black uppercase text-black">Dev Perspective Simulator:</span>
            <span className="text-stone-600">
              {effectiveSimulatedCaptainTeamId 
                ? `Viewing as Captain: ${effectiveCaptainTeam?.name} (${effectiveCaptainTeam?.captainIgn})` 
                : 'Viewing as Tournament Organiser (Referee Controls)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-black text-stone-500 shrink-0">Perspective:</span>
            <SelectDropdown
              value={effectiveSimulatedCaptainTeamId}
              onChange={(val) => setSimulatedCaptainTeamId(val)}
              options={[
                { value: '', label: 'Organiser Desk (Controls & Telemetry)', subtitle: 'Full referee authority' },
                ...teams.map(t => ({
                  value: t.id,
                  label: `${t.name} [${t.tag}]`,
                  subtitle: `Captain: ${t.captainIgn} · ${t.remainingCredits} Credits`
                }))
              ]}
              size="sm"
              mobileTitle="Select Simulation Perspective"
            />
          </div>
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
          {isCaptainViewActive ? 'Captain Live Bidding Floor' : 'Organiser Auction Desk'}
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

      {/* UNSOLD PLAYERS PROMINENT ALERT & RE-AUCTION BANNER */}
      {unsoldPlayers.length > 0 && (
        <div className="p-3.5 bg-[#FFF9E6] border-2 border-black shadow-[3px_3px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚠️</span>
            <div>
              <strong className="text-black uppercase font-black block">
                {unsoldPlayers.length} Contender(s) Passed as UNSOLD in Auction
              </strong>
              <span className="text-stone-600 text-[11px] block">
                These players had no winning bids. You can re-auction them individually or all at once so teams can choose them.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('unsold')}
              className={`px-3 py-1.5 border-2 border-black font-black uppercase text-xs shadow-[1px_1px_0px_0px_#000] cursor-pointer ${
                activeTab === 'unsold' ? 'bg-black text-white' : 'bg-white hover:bg-stone-100 text-black'
              }`}
            >
              View Unsold Tab ({unsoldPlayers.length}) →
            </button>
            {isOrganiserDeskActive && (
              <button
                type="button"
                onClick={handleReauctionAllUnsold}
                className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase text-xs shadow-[1px_1px_0px_0px_#000] cursor-pointer"
              >
                ⚡ Re-Auction All Unsold ({unsoldPlayers.length})
              </button>
            )}
          </div>
        </div>
      )}

      {/* WINNER / OUTCOME ANNOUNCEMENT NOTIFICATION WITH GAVEL SLAM CELEBRATION */}
      {auctionState.lastLotResult && !currentNominee && (
        <div className={`p-6 border-[4px] border-black shadow-[8px_8px_0px_0px_#000] relative overflow-hidden transition-all duration-300 ${
          auctionState.lastLotResult.outcome === 'SOLD'
            ? 'bg-gradient-to-r from-[#70FFAF]/50 via-[#FFE600]/40 to-[#70FFAF]/50'
            : 'bg-[#FFDE59]/50'
        }`}>
          {/* SOLD RUBBER STAMP BADGE ANIMATION */}
          {auctionState.lastLotResult.outcome === 'SOLD' && (
            <div className="absolute top-2 right-2 sm:top-4 sm:right-6 pointer-events-none animate-sold-stamp z-10">
              <div className="border-[5px] border-dashed border-[#D90429] bg-[#D90429]/15 px-4 sm:px-6 py-1.5 sm:py-2 text-[#D90429] font-black text-2xl sm:text-4xl tracking-widest uppercase shadow-[3px_3px_0px_0px_rgba(217,4,41,0.3)] select-none">
                🔨 SOLD!
              </div>
            </div>
          )}

          {auctionState.lastLotResult.outcome === 'SOLD' ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-black pb-4 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#FFE600] border-[3.5px] border-black flex items-center justify-center text-3xl sm:text-5xl shadow-[4px_4px_0px_0px_#000] animate-gavel-slam shrink-0">
                    🔨
                  </div>
                  <div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <span className="bg-black text-[#70FFAF] text-[10px] font-black uppercase px-2 py-0.5 border border-black tracking-widest">
                        GAVEL STRIKE · LOT CONCLUDED
                      </span>
                      <span className="bg-[#70FFAF] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                        OFFICIALLY DRAFTED
                      </span>
                      <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold animate-pulse">
                        CONGRATULATIONS!
                      </span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans mt-1">
                      🔨 SOLD! SOLD! SOLD!
                    </h2>
                    <p className="text-xs sm:text-sm font-bold text-stone-800 mt-0.5">
                      The gavel has officially dropped! Player drafted to <strong>{auctionState.lastLotResult.winningTeamName}</strong>.
                    </p>
                  </div>
                </div>

                <div className="bg-white border-2 border-black p-3 text-center sm:text-right shrink-0">
                  <span className="text-[10px] font-black uppercase text-stone-500 block">Winning Bid</span>
                  <span className="text-2xl sm:text-3xl font-black text-[#7C3AED]">
                    {auctionState.lastLotResult.winningBid?.toLocaleString()} Cr
                  </span>
                </div>
              </div>

              {/* Player & Awarded Team Presentation */}
              <div className="bg-white border-2 border-black p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{auctionState.lastLotResult.player.avatar}</span>
                  <div>
                    <strong className="text-black text-lg block">
                      {auctionState.lastLotResult.player.username}
                    </strong>
                    <span className="text-xs text-stone-600 block">
                      {auctionState.lastLotResult.player.city || 'India'} • {auctionState.lastLotResult.player.primaryRole} • MMR {auctionState.lastLotResult.player.tournamentMmr.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-[#F3E8FF] border border-black px-4 py-2">
                  <span className="text-xl">🏆</span>
                  <div>
                    <span className="text-[9px] uppercase font-black text-stone-500 block">Awarded To Franchise:</span>
                    <strong className="text-black text-base uppercase block">
                      {auctionState.lastLotResult.winningTeamName}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                {isOrganiserDeskActive ? (
                  <button
                    onClick={() => dotaAuctionEngine.dismissLastLotResult()}
                    className="px-5 py-2.5 bg-black hover:bg-stone-800 text-white border-2 border-black text-xs font-black uppercase shadow-[3px_3px_0px_0px_#FFE600] cursor-pointer"
                  >
                    Nominate Next Contender →
                  </button>
                ) : (
                  <button
                    onClick={() => dotaAuctionEngine.dismissLastLotResult()}
                    className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* UNSOLD LOT NOTIFICATION */
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚠️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#FF70A6] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black">
                      PASSED AS UNSOLD
                    </span>
                  </div>
                  <strong className="text-black text-base block mt-1">
                    {auctionState.lastLotResult.player.username} concluded without winning bids.
                  </strong>
                  <p className="text-xs text-stone-600">
                    Contender was moved to the Unsold Contenders Pool. Organiser can re-auction this player at any time.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isOrganiserDeskActive && (
                  <button
                    onClick={() => handleReauctionPlayer(auctionState.lastLotResult!.player.id)}
                    className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                  >
                    ⚡ Re-Auction Now
                  </button>
                )}
                <button
                  onClick={() => dotaAuctionEngine.dismissLastLotResult()}
                  className="px-3 py-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: LIVE FLOOR */}
      {activeTab === 'live' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Stage: Current Nominee Block & Live Controls */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6">
              
              {/* Header Clock & Status */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-[#FF5757]" />
                  <span className="font-black text-xs uppercase tracking-tight">
                    {isCaptainViewActive 
                      ? 'CAPTAIN LIVE BIDDING FLOOR' 
                      : isOrganiserDeskActive 
                      ? 'ORGANISER AUCTION DESK' 
                      : 'LIVE SPECTATOR BROADCAST'}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className={`flex items-center gap-1.5 text-xs font-black px-2.5 py-1 border-2 border-black transition-all ${
                    activeAntiSnipeNotice 
                      ? 'bg-[#00F0FF] text-black animate-pulse shadow-[2px_2px_0px_0px_#000]'
                      : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 2 && auctionState.status === 'LIVE'
                      ? 'bg-[#FF3333] text-white animate-calling-thrice shadow-[2px_2px_0px_0px_#000]'
                      : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 5 && auctionState.status === 'LIVE'
                      ? 'bg-[#FF9900] text-black shadow-[2px_2px_0px_0px_#000]'
                      : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 8 && auctionState.status === 'LIVE'
                      ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]'
                      : auctionState.secondsRemaining <= 5 && auctionState.status === 'LIVE'
                      ? 'bg-[#FF5757] text-white animate-pulse'
                      : 'bg-[#F3E8FF] text-[#7C3AED]'
                  }`}>
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>
                      {activeAntiSnipeNotice 
                        ? `⚡ Anti-Snipe +${activeAntiSnipeNotice.extendedSeconds}s (${auctionState.secondsRemaining}s)`
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 2 && auctionState.status === 'LIVE'
                        ? `🚨 Calling Thrice · ${auctionState.secondsRemaining}s`
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 5 && auctionState.status === 'LIVE'
                        ? `🔨 Calling Twice · ${auctionState.secondsRemaining}s`
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 8 && auctionState.status === 'LIVE'
                        ? `🔨 Calling Once · ${auctionState.secondsRemaining}s`
                        : `Clock: ${auctionState.secondsRemaining}s`}
                    </span>
                  </div>
                  {isOrganiserDeskActive && auctionState.status === 'LIVE' && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          activeEngine.addTime(10, currentUser.id);
                          setBidSuccess('+10s added to clock');
                          setTimeout(() => setBidSuccess(null), 2000);
                        }}
                        className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[10px] font-black uppercase cursor-pointer"
                        title="Add 10 seconds to auction clock"
                      >
                        +10s
                      </button>
                      <button
                        onClick={() => {
                          activeEngine.addTime(15, currentUser.id);
                          setBidSuccess('+15s added to clock');
                          setTimeout(() => setBidSuccess(null), 2000);
                        }}
                        className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[10px] font-black uppercase cursor-pointer"
                        title="Add 15 seconds to auction clock"
                      >
                        +15s
                      </button>
                      <button
                        onClick={() => {
                          activeEngine.addTime(30, currentUser.id);
                          setBidSuccess('+30s added to clock');
                          setTimeout(() => setBidSuccess(null), 2000);
                        }}
                        className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[10px] font-black uppercase cursor-pointer"
                        title="Add 30 seconds to auction clock"
                      >
                        +30s
                      </button>
                      <button
                        onClick={() => {
                          activeEngine.addTime(60, currentUser.id);
                          setBidSuccess('+60s added to clock');
                          setTimeout(() => setBidSuccess(null), 2000);
                        }}
                        className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-1.5 py-0.5 text-[10px] font-black uppercase cursor-pointer"
                        title="Add 60 seconds to auction clock"
                      >
                        +60s
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION: CURRENT PLAYER ACTIVE ON FLOOR                       */}
              {/* ------------------------------------------------------------- */}
              {currentNominee ? (
                <div className="space-y-6">
                  {/* CAPTAIN LEADING / OUTBID REAL-TIME STATUS BANNER */}
                  {isCaptainViewActive && effectiveCaptainTeam && (
                    <div className={`p-4 border-[2.5px] border-black shadow-[3px_3px_0px_0px_#000] flex items-center justify-between gap-3 ${
                      isLeading 
                        ? 'bg-[#70FFAF] text-black' 
                        : isOutbid 
                        ? 'bg-[#FF5757] text-white animate-pulse' 
                        : 'bg-[#FFE600] text-black'
                    }`}>
                      <div className="flex items-center gap-3">
                        {isLeading ? (
                          <Crown className="w-6 h-6 text-black shrink-0" />
                        ) : isOutbid ? (
                          <AlertCircle className="w-6 h-6 text-white shrink-0" />
                        ) : (
                          <Gavel className="w-6 h-6 text-black shrink-0" />
                        )}
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider block">
                            {isLeading ? 'CURRENT LEADER' : isOutbid ? 'ATTENTION REQUIRED' : 'FLOOR OPEN'}
                          </span>
                          <strong className="text-base sm:text-lg font-black uppercase font-sans leading-none block">
                            {isLeading ? 'YOU ARE LEADING!' : isOutbid ? `OUTBID BY ${auctionState.leadingTeamName}!` : 'READY TO BID'}
                          </strong>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold block uppercase opacity-80">
                          {isLeading ? 'Your High Bid' : isOutbid ? 'Leading Bid' : 'Opening Bid'}
                        </span>
                        <span className="text-xl sm:text-2xl font-black">
                          {auctionState.currentBid.toLocaleString()} Cr
                        </span>
                      </div>
                    </div>
                  )}

                  {/* PROMINENT ANTI-SNIPE EXTENSION NOTIFICATION BANNER */}
                  {activeAntiSnipeNotice && (
                    <div className="bg-[#00F0FF] border-[3.5px] border-black p-4 shadow-[5px_5px_0px_0px_#000] text-black animate-electric-snipe flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-[#FFE600] border-2 border-black flex items-center justify-center text-3xl font-black shrink-0 animate-bounce shadow-[2px_2px_0px_0px_#000]">
                          ⚡
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-black text-[#00F0FF] text-[10px] font-black uppercase px-2 py-0.5 border border-black tracking-widest font-mono">
                              ANTI-SNIPE TRIGGERED
                            </span>
                            <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                              +{activeAntiSnipeNotice.extendedSeconds}s CLOCK EXTENDED
                            </span>
                            <span className="bg-white text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                              CALLS RESET
                            </span>
                          </div>
                          <h3 className="font-sans font-black text-sm sm:text-base uppercase text-black mt-1 leading-snug">
                            ⚡ {activeAntiSnipeNotice.teamName} BID {activeAntiSnipeNotice.amount.toLocaleString()} CR IN THE FINAL SECONDS!
                          </h3>
                          <p className="text-xs text-stone-900 font-bold mt-0.5">
                            Timer extended to <strong>{auctionState.secondsRemaining}s</strong> so other franchises can counter. Calling once / twice / thrice announcements have been reset!
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <div className="bg-black text-[#00F0FF] border-2 border-black px-3 py-1.5 text-center shadow-[2px_2px_0px_0px_#000]">
                          <span className="text-[9px] uppercase font-black tracking-wider block text-yellow-300 font-mono">CLOCK</span>
                          <span className="text-2xl font-black font-mono leading-none">
                            {auctionState.secondsRemaining}s
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveAntiSnipeNotice(null)}
                          className="px-2 py-1 bg-white hover:bg-stone-200 border-2 border-black text-black cursor-pointer text-xs font-black"
                          title="Dismiss notification"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC AUCTIONEER GAVEL ANNOUNCEMENTS: CALLING ONCE, TWICE, THRICE */}
                  {(() => {
                    const hasBids = Boolean(auctionState.leadingTeamId);
                    const sec = auctionState.secondsRemaining;

                    if (hasBids) {
                      if (sec <= 2 && sec > 0) {
                        return (
                          <div className="p-4 sm:p-5 bg-[#FF3333] border-[3.5px] border-black text-white shadow-[5px_5px_0px_0px_#000] animate-calling-thrice space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-3xl sm:text-4xl animate-bounce">🔨</span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-black text-[#FFE600] text-[10px] font-black uppercase px-2 py-0.5 border border-white tracking-widest font-mono">
                                      URGENT · FINAL CALL
                                    </span>
                                    <span className="bg-white text-red-600 text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                                      GAVEL DESCENDING
                                    </span>
                                  </div>
                                  <h3 className="text-xl sm:text-3xl font-black uppercase font-sans tracking-wide text-white mt-1">
                                    🚨 CALLING THRICE! GOING THREE TIMES!
                                  </h3>
                                </div>
                              </div>
                              <div className="bg-black text-white border-2 border-white px-3 sm:px-4 py-1.5 text-center shrink-0 shadow-[2px_2px_0px_0px_#fff]">
                                <span className="text-[9px] uppercase font-bold text-red-400 block font-mono">FINAL SECONDS</span>
                                <span className="text-2xl sm:text-4xl font-black font-mono leading-none text-[#FFE600]">
                                  {sec}s
                                </span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm font-black text-yellow-200 leading-snug">
                              Going thrice at <span className="underline decoration-2 font-mono">{auctionState.currentBid.toLocaleString()} Cr</span> to <span className="underline decoration-2">{auctionState.leadingTeamName}</span>! Counter-bid RIGHT NOW or this contender is SOLD!
                            </p>
                          </div>
                        );
                      } else if (sec <= 5 && sec > 2) {
                        return (
                          <div className="p-4 bg-[#FF9900] border-[3.5px] border-black text-black shadow-[4px_4px_0px_0px_#000] space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl sm:text-3xl animate-pulse">🔨</span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 border border-black tracking-widest font-mono">
                                      AUCTIONEER FLOOR DESK
                                    </span>
                                    <span className="bg-[#FFE600] text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                                      SECOND CALL
                                    </span>
                                  </div>
                                  <h3 className="text-lg sm:text-2xl font-black uppercase font-sans tracking-wide text-black mt-1">
                                    🔨 CALLING TWICE! GOING TWICE!
                                  </h3>
                                </div>
                              </div>
                              <div className="bg-white text-black border-2 border-black px-3 sm:px-4 py-1.5 text-center shrink-0 shadow-[2px_2px_0px_0px_#000]">
                                <span className="text-[9px] uppercase font-bold text-stone-500 block font-mono">CLOCK</span>
                                <span className="text-2xl sm:text-3xl font-black font-mono leading-none text-orange-600">
                                  {sec}s
                                </span>
                              </div>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
                              Going twice at <strong className="font-mono">{auctionState.currentBid.toLocaleString()} Cr</strong> to <strong>{auctionState.leadingTeamName}</strong>! Any franchise raising the bid before the final call?
                            </p>
                          </div>
                        );
                      } else if (sec <= 8 && sec > 5) {
                        return (
                          <div className="p-3.5 bg-[#FFE600] border-[3.5px] border-black text-black shadow-[4px_4px_0px_0px_#000] space-y-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🔨</span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 border border-black tracking-widest font-mono">
                                      AUCTIONEER FLOOR DESK
                                    </span>
                                    <span className="bg-white text-black text-[10px] font-black uppercase px-2 py-0.5 border border-black font-bold">
                                      FIRST CALL
                                    </span>
                                  </div>
                                  <h3 className="text-base sm:text-xl font-black uppercase font-sans tracking-wide text-black mt-0.5">
                                    🔨 CALLING ONCE... GOING ONCE!
                                  </h3>
                                </div>
                              </div>
                              <div className="bg-white text-black border-2 border-black px-3 py-1 text-center shrink-0 shadow-[2px_2px_0px_0px_#000]">
                                <span className="text-[9px] uppercase font-bold text-stone-500 block font-mono">CLOCK</span>
                                <span className="text-xl sm:text-2xl font-black font-mono leading-none text-stone-900">
                                  {sec}s
                                </span>
                              </div>
                            </div>
                            <p className="text-xs font-bold text-stone-800">
                              First call at <strong className="font-mono">{auctionState.currentBid.toLocaleString()} Cr</strong> to <strong>{auctionState.leadingTeamName}</strong>. Floor remains open for bids!
                            </p>
                          </div>
                        );
                      }
                    } else {
                      // No bids placed yet on this contender
                      if (sec <= 8 && sec > 0) {
                        return (
                          <div className="p-3 bg-[#FFF3CD] border-2 border-black text-amber-950 shadow-[3px_3px_0px_0px_#000] flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">⏳</span>
                              <div>
                                <strong className="text-xs uppercase font-black block">PASSING COUNTDOWN · NO BIDS PLACED YET</strong>
                                <span className="text-[11px] block text-amber-900">
                                  Contender will pass as UNSOLD in {sec}s unless a franchise opens the bidding floor at {config.minimumBid} Cr!
                                </span>
                              </div>
                            </div>
                            <div className="bg-white border-2 border-black px-2.5 py-1 text-center shrink-0 shadow-[1px_1px_0px_0px_#000]">
                              <span className="text-xl font-black font-mono text-red-600">{sec}s</span>
                            </div>
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}

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
                        <div className="text-xs text-stone-600 flex items-center gap-2 mt-1">
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3.5 h-3.5 text-[#7C3AED]" />
                            <span>{currentNominee.city || 'India'}</span>
                          </span>
                          <span>•</span>
                          <span className="font-bold text-purple-700">{currentNominee.primaryRole}</span>
                          {currentNominee.secondaryRole && (
                            <>
                              <span>/</span>
                              <span className="text-stone-500">{currentNominee.secondaryRole}</span>
                            </>
                          )}
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
                      <span className="text-[10px] text-stone-500 block">
                        Purple Bean Rating: <strong>{currentNominee.rating}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Bidding Grid: Price, Leading Bidder & Live Floor Clock */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-[#FFF9E6] border-2 border-black p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Current High Bid</span>
                      <div className="text-3xl font-black text-black">
                        {auctionState.currentBid.toLocaleString()} <span className="text-sm font-bold text-stone-600">Credits</span>
                      </div>
                      <span className="text-[10px] text-stone-500 block">Revision #{auctionState.revision}</span>
                    </div>

                    <div className="bg-[#F3E8FF] border-2 border-black p-4 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-stone-500 block">Leading Franchise</span>
                      <div className="text-2xl font-black text-[#7C3AED] truncate">
                        {auctionState.leadingTeamName || 'No Bids Yet'}
                      </div>
                      <span className="text-[10px] text-stone-500 block">
                        {auctionState.leadingTeamId ? `Team ID: ${auctionState.leadingTeamId}` : 'Opening floor minimum'}
                      </span>
                    </div>

                    {/* Prominent Live Floor Clock & Gavel Call Status */}
                    <div className={`border-2 border-black p-4 space-y-1 transition-all ${
                      activeAntiSnipeNotice
                        ? 'bg-[#00F0FF]/30 border-cyan-500'
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 2
                        ? 'bg-[#FF3333]/20 border-red-500'
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 5
                        ? 'bg-[#FF9900]/20 border-orange-500'
                        : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 8
                        ? 'bg-[#FFE600]/30 border-yellow-500'
                        : 'bg-stone-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-stone-500 block">Auctioneer Clock</span>
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 border border-black ${
                          activeAntiSnipeNotice
                            ? 'bg-[#00F0FF] text-black animate-pulse'
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 2
                            ? 'bg-[#FF3333] text-white animate-bounce'
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 5
                            ? 'bg-[#FF9900] text-black'
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 8
                            ? 'bg-[#FFE600] text-black'
                            : Boolean(auctionState.leadingTeamId)
                            ? 'bg-[#70FFAF] text-black'
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          {activeAntiSnipeNotice
                            ? `⚡ +${activeAntiSnipeNotice.extendedSeconds}s EXTENDED`
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 2
                            ? '🚨 CALLING THRICE'
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 5
                            ? '🔨 CALLING TWICE'
                            : Boolean(auctionState.leadingTeamId) && auctionState.secondsRemaining <= 8
                            ? '🔨 CALLING ONCE'
                            : Boolean(auctionState.leadingTeamId)
                            ? '🟢 BIDDING OPEN'
                            : auctionState.secondsRemaining <= 8
                            ? '⚠️ PASSING SOON'
                            : '⏱️ FLOOR OPEN'}
                        </span>
                      </div>
                      <div className="text-3xl font-black font-mono text-black flex items-center gap-2">
                        <span>{auctionState.secondsRemaining}s</span>
                        <Clock className={`w-5 h-5 ${
                          auctionState.secondsRemaining <= 5 ? 'text-red-600 animate-spin' : 'text-stone-400'
                        }`} />
                      </div>
                      <div className="w-full bg-stone-200 h-2 border border-black overflow-hidden mt-1">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            auctionState.secondsRemaining <= 2 
                              ? 'bg-[#FF3333]' 
                              : auctionState.secondsRemaining <= 5 
                              ? 'bg-[#FF9900]' 
                              : auctionState.secondsRemaining <= 8 
                              ? 'bg-[#FFE600]' 
                              : 'bg-[#70FFAF]'
                          }`}
                          style={{
                            width: `${Math.min(100, Math.max(0, (auctionState.secondsRemaining / (config.nominationTimerSeconds || 30)) * 100))}%`
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* --------------------------------------------------------- */}
                  {/* CAPTAIN BID CONTROLS (Only for Captains)                  */}
                  {/* --------------------------------------------------------- */}
                  {isCaptainViewActive && effectiveCaptainTeam && (
                    <div className="bg-stone-50 border-2 border-black p-5 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div>
                            <span className="text-[10px] uppercase font-black text-stone-500 block">My Team:</span>
                            <span className="font-black text-black text-base">{effectiveCaptainTeam.name} [{effectiveCaptainTeam.tag}]</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomTeamName(effectiveCaptainTeam.name);
                              setCustomTeamTag(effectiveCaptainTeam.tag);
                              setCustomTeamLogo(effectiveCaptainTeam.logo || '🛡️');
                              setCustomTeamColor(effectiveCaptainTeam.color || '#7C3AED');
                              setCustomTeamBanner((effectiveCaptainTeam as any).bannerUrl || 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)');
                              setShowTeamCustomizerModal(true);
                            }}
                            className="ml-2 bg-white hover:bg-[#FFE600] text-black border-2 border-black px-2.5 py-1 text-[10px] font-black uppercase cursor-pointer shadow-[2px_2px_0px_0px_#000] inline-flex items-center gap-1"
                          >
                            🎨 Customize Name & Banner
                          </button>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-black text-stone-500 block">Credits Remaining:</span>
                          <span className="font-black text-emerald-800 text-base">
                            {effectiveCaptainTeam.remainingCredits.toLocaleString()} Credits
                          </span>
                        </div>
                      </div>

                      {/* Roster & Reserve Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-white border border-black p-2.5">
                        <div>
                          <span className="text-[9px] uppercase text-stone-400 block">Primary Roster</span>
                          <span className="font-bold text-[#7C3AED]">{captainPrimaryCount} / 5</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-stone-400 block">Stand-in</span>
                          <span className="font-bold text-stone-700">{effectiveCaptainTeam.standIns.length} / 1</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-stone-400 block">Slots Remaining</span>
                          <span className="font-bold text-stone-800">{Math.max(0, 5 - captainPrimaryCount)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase text-stone-400 block">Max Allowable Bid</span>
                          <span className="font-black text-emerald-700">{captainMaxAllowableBid.toLocaleString()} Cr</span>
                        </div>
                      </div>

                      {/* Roster Complete Banner with Name & Banner Submission */}
                      {captainPrimaryCount >= 5 ? (
                        <div className="bg-[#70FFAF] border-2 border-black p-4 space-y-2 shadow-[2px_2px_0px_0px_#000]">
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl">🎉</span>
                            <div>
                              <span className="font-black text-xs uppercase text-black block">ROSTER ASSEMBLED (5/5 Players Drafted)</span>
                              <span className="text-[11px] text-stone-800 block mt-0.5 leading-relaxed">
                                Your full franchise squad is drafted! Submit your official team name, 3-4 letter tag, custom banner, and logo so the Organiser can seed your team into group stages and upper/lower brackets.
                              </span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setCustomTeamName(effectiveCaptainTeam.name);
                                setCustomTeamTag(effectiveCaptainTeam.tag);
                                setCustomTeamLogo(effectiveCaptainTeam.logo || '🛡️');
                                setCustomTeamColor(effectiveCaptainTeam.color || '#7C3AED');
                                setCustomTeamBanner((effectiveCaptainTeam as any).bannerUrl || 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)');
                                setShowTeamCustomizerModal(true);
                              }}
                              className="bg-black hover:bg-stone-800 text-white border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] flex items-center gap-1.5 cursor-pointer"
                            >
                              🎨 Submit Team Name, Banner &amp; Identity →
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-stone-600 bg-[#E0F2FE] border border-blue-300 p-2">
                          <strong>Reserve Invariant:</strong> Must retain at least <strong>{captainMandatoryReserveNeeded} Cr</strong> ({config.reservePerSlot} Cr × {captainRemainingMandatorySlots} unfilled mandatory primary slots).
                        </div>
                      )}

                      {/* Bidding Controls or Roster Full Restriction Card */}
                      {!canCaptainBid ? (
                        <div className="bg-[#FFF4E5] border-2 border-black p-4 space-y-2 text-xs shadow-[2px_2px_0px_0px_#000]">
                          <div className="flex items-start gap-2.5">
                            <span className="text-2xl">🛑</span>
                            <div>
                              <strong className="text-black uppercase font-black block text-sm">
                                {isCaptainPrimaryFull && !isStandInRoundActive 
                                  ? 'ROSTER COMPLETE (5/5) — BIDDING RESTRICTED' 
                                  : 'STAND-IN COMPLETE (1/1) — BIDDING CLOSED'}
                              </strong>
                              <p className="text-stone-700 text-xs mt-1 leading-relaxed">
                                {isCaptainPrimaryFull && !isStandInRoundActive
                                  ? `Your team roster is already full (${captainPrimaryCount}/${config.primaryRosterSize}). As per tournament rules, teams whose rosters are already full cannot bid while other teams are still completing their primary rosters. Only after all teams have filled their rosters will the organiser start the auction for Stand-Ins.`
                                  : `Your team has already drafted the maximum allowed stand-in (${effectiveCaptainTeam?.standIns.length}/${config.optionalStandInLimit}). Bidding is closed for your team.`}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {isStandInRoundActive && (
                            <div className="bg-[#E0E7FF] border-2 border-indigo-600 p-2.5 text-xs text-indigo-950 font-bold flex items-center gap-2">
                              <span>⚡</span>
                              <span>STAND-IN AUCTION ROUND: Placing bids to draft your team's optional stand-in player (1 slot available).</span>
                            </div>
                          )}

                          {/* Quick Bid Increment Buttons */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] font-black uppercase text-stone-500 block">Quick Bid Increments:</span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[10, 20, 50, 100].map(inc => {
                                const proposed = auctionState.currentBid + inc;
                                const disabled = proposed > captainMaxAllowableBid || auctionState.status !== 'LIVE' || isLeading;
                                return (
                                  <button
                                    key={inc}
                                    onClick={() => handlePlaceQuickBid(inc)}
                                    disabled={disabled}
                                    className="py-3 px-3 bg-[#FFE600] hover:bg-yellow-400 disabled:opacity-40 disabled:hover:bg-[#FFE600] text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed transition-all"
                                  >
                                    +{inc} Cr ({proposed})
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Custom Bid Input Form */}
                          <form onSubmit={handlePlaceCustomBid} className="pt-2 border-t border-black/10 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                            <div className="flex-1 min-w-0">
                              <div className="relative">
                                <input
                                  type="number"
                                  min={auctionState.currentBid + config.bidIncrement}
                                  max={captainMaxAllowableBid}
                                  step={config.bidIncrement}
                                  value={customBidAmount}
                                  onChange={(e) => setCustomBidAmount(e.target.value)}
                                  placeholder={`Min ${auctionState.currentBid + config.bidIncrement} Cr`}
                                  className="w-full bg-white border-2 border-black px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                                />
                                <span className="absolute right-3 top-2 text-xs font-bold text-stone-400">Credits</span>
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={!customBidAmount || Number(customBidAmount) > captainMaxAllowableBid || auctionState.status !== 'LIVE' || isLeading}
                              className="px-4 py-2.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed text-center shrink-0 min-h-[44px]"
                            >
                              Submit Custom Bid
                            </button>
                          </form>
                        </>
                      )}
                    </div>
                  )}

                  {/* SPECTATOR READ-ONLY BROADCAST NOTICE */}
                  {!isCaptainViewActive && !isOrganiserDeskActive && (
                    <div className="bg-[#F8FAFC] border-2 border-black p-4 space-y-3 text-xs">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2.5">
                          <Users className="w-5 h-5 text-sky-700 shrink-0" />
                          <div>
                            <span className="font-black uppercase text-black block">Live Spectator Broadcast</span>
                            <span className="text-stone-600 text-[11px] block">
                              Real-time synchronized floor feed (read-only mode). Captain bidding is in progress.
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-sky-100 border border-black text-[10px] font-black uppercase text-sky-800 shrink-0">
                          Spectator Mode
                        </span>
                      </div>

                      {/* Interactive Cheer & Reaction Bar */}
                      <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-black uppercase text-stone-500">Live Cheers:</span>
                          {[
                            { emoji: '🔥', text: 'Hype!' },
                            { emoji: '👏', text: 'Well Bid!' },
                            { emoji: '⚡', text: 'Steal!' },
                            { emoji: '🤯', text: 'Big Bid!' },
                            { emoji: '👑', text: 'Captain Move!' }
                          ].map(c => (
                            <button
                              key={c.text}
                              type="button"
                              onClick={() => {
                                setCheersList(prev => [
                                  { id: `cheer-${Date.now()}-${Math.random()}`, user: currentUser.displayName || 'Spectator', text: `${c.emoji} ${c.text}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
                                  ...prev.slice(0, 15)
                                ]);
                              }}
                              className="px-2 py-0.5 bg-white hover:bg-[#FFE600] border border-black text-[10px] font-bold cursor-pointer transition-all shadow-[1px_1px_0px_0px_#000]"
                            >
                              {c.emoji} {c.text}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Live Cheer Ticker */}
                      {cheersList.length > 0 && (
                        <div className="bg-white border border-black p-2 max-h-20 overflow-y-auto space-y-1 text-[11px] font-mono">
                          {cheersList.slice(0, 4).map(ch => (
                            <div key={ch.id} className="flex items-center justify-between text-stone-700">
                              <span><strong>{ch.user}:</strong> {ch.text}</span>
                              <span className="text-[9px] text-stone-400">{ch.time}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* --------------------------------------------------------- */}
                  {/* ORGANISER AUCTION DESK (Organiser Bid Controls Removed)    */}
                  {/* --------------------------------------------------------- */}
                  {isOrganiserDeskActive && (
                    <div className="bg-[#FFFBEB] border-2 border-black p-5 space-y-4 shadow-[3px_3px_0px_0px_#000]">
                      <div className="flex items-center justify-between border-b border-black/10 pb-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-amber-700" />
                          <span className="text-xs font-black uppercase text-amber-900">
                            Organiser Live Auction Desk
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-[#FFE600] border border-black px-2 py-0.5">
                          Referee &amp; Timer Authority
                        </span>
                      </div>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        Captains bid simultaneously from their own devices. As the tournament organiser, you control the clock, extend bidding time, and execute floor certification when bidding concludes.
                      </p>

                      {/* Organiser Floor Certification Buttons */}
                      <div className="flex flex-wrap gap-3 pt-1">
                        <button
                          onClick={handleConcludeSale}
                          disabled={!auctionState.leadingTeamId}
                          className="flex-1 py-3 px-4 bg-[#70FFAF] hover:bg-emerald-400 disabled:opacity-40 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:cursor-not-allowed"
                        >
                          End Nomination &amp; Sell to {auctionState.leadingTeamName || 'Leading Bidder'}
                        </button>
                        <button
                          onClick={handlePassUnsold}
                          className="py-3 px-4 bg-white hover:bg-stone-100 text-[#FF5757] border-2 border-[#FF5757] text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FF5757] cursor-pointer"
                        >
                          Mark as UNSOLD
                        </button>
                        {auctionState.status === 'LIVE' ? (
                          <button
                            onClick={handlePauseAuction}
                            className="py-3 px-3 bg-amber-200 hover:bg-amber-300 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                          >
                            <Pause className="w-4 h-4 inline mr-1" />
                            Pause
                          </button>
                        ) : (
                          <button
                            onClick={handleResumeAuction}
                            className="py-3 px-3 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                          >
                            <Play className="w-4 h-4 inline mr-1" />
                            Resume
                          </button>
                        )}
                      </div>

                      {/* PROMINENT ORGANISER EXTEND AUCTION TIME SECTION */}
                      <div className="p-3.5 bg-white border-2 border-black space-y-3 shadow-[2px_2px_0px_0px_#000]">
                        <div className="flex items-center justify-between border-b border-black/10 pb-1.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-[#7C3AED]" />
                            <strong className="text-xs font-black uppercase text-black">
                              Extend Auction Time &amp; Clock Controls
                            </strong>
                          </div>
                          <span className="text-[11px] font-mono font-black text-[#7C3AED] bg-[#F3E8FF] px-2 py-0.5 border border-black">
                            {auctionState.secondsRemaining}s remaining
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase text-stone-700">
                              ⚡ Extend Active Auction Time:
                            </span>
                            <span className="text-[10px] text-stone-500 font-mono">
                              Instantly adds seconds to clock for all captains
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {[10, 15, 30, 45, 60].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  activeEngine.addTime(sec, currentUser.id);
                                  setBidSuccess(`✓ Extended auction time by +${sec}s!`);
                                  setTimeout(() => setBidSuccess(null), 2500);
                                }}
                                className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                              >
                                +{sec}s
                              </button>
                            ))}

                            <div className="flex items-center gap-1.5 ml-auto">
                              <input
                                type="number"
                                min="5"
                                max="300"
                                step="5"
                                value={customExtendSeconds}
                                onChange={(e) => setCustomExtendSeconds(e.target.value)}
                                className="w-16 bg-stone-50 border-2 border-black px-2 py-1 text-xs font-mono font-bold text-center"
                                placeholder="sec"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const sec = parseInt(customExtendSeconds, 10);
                                  if (!isNaN(sec) && sec > 0) {
                                    activeEngine.addTime(sec, currentUser.id);
                                    setBidSuccess(`✓ Extended auction time by +${sec}s!`);
                                    setTimeout(() => setBidSuccess(null), 2500);
                                  }
                                }}
                                className="px-3 py-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] cursor-pointer"
                              >
                                Extend Time
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Reset Exact Seconds & Jump to Calling Stages */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-black/10">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-black uppercase text-amber-900">Set Clock / Test Calls:</span>
                            <button
                              type="button"
                              onClick={() => {
                                activeEngine.adjustTimer(8, currentUser.id);
                                setBidSuccess('Jumped to 8s · Calling Once stage active');
                                setTimeout(() => setBidSuccess(null), 2500);
                              }}
                              className="px-2 py-0.5 bg-[#FFE600] hover:bg-yellow-400 border border-black text-[10px] font-black cursor-pointer"
                              title="Test Calling Once stage (8s)"
                            >
                              8s (Once)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                activeEngine.adjustTimer(5, currentUser.id);
                                setBidSuccess('Jumped to 5s · Calling Twice stage active');
                                setTimeout(() => setBidSuccess(null), 2500);
                              }}
                              className="px-2 py-0.5 bg-[#FF9900] hover:bg-orange-400 border border-black text-[10px] font-black cursor-pointer"
                              title="Test Calling Twice stage (5s)"
                            >
                              5s (Twice)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                activeEngine.adjustTimer(2, currentUser.id);
                                setBidSuccess('Jumped to 2s · Calling Thrice stage active');
                                setTimeout(() => setBidSuccess(null), 2500);
                              }}
                              className="px-2 py-0.5 bg-[#FF3333] hover:bg-red-600 text-white border border-black text-[10px] font-black cursor-pointer"
                              title="Test Calling Thrice stage (2s)"
                            >
                              2s (Thrice)
                            </button>
                            {[15, 30, 45, 60, 90].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => {
                                  activeEngine.adjustTimer(sec, currentUser.id);
                                  setBidSuccess(`✓ Reset auction clock to ${sec}s.`);
                                  setTimeout(() => setBidSuccess(null), 2500);
                                }}
                                className="px-2 py-0.5 bg-stone-50 hover:bg-stone-100 border border-black text-[10px] font-bold cursor-pointer"
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>

                          {unsoldPlayers.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const res = activeEngine.startUnsoldSecondPass(currentUser.id);
                                if (res.success) {
                                  setBidSuccess(`✓ Re-auction started! ${res.reauctionCount} unsold contenders returned to pool.`);
                                } else {
                                  setBidError(res.error || 'Failed to start second pass.');
                                }
                              }}
                              className="bg-[#BAE6FD] hover:bg-sky-200 text-black border border-black px-2 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                            >
                              ⚡ Re-Auction Unsold ({unsoldPlayers.length})
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ------------------------------------------------------------- */
                /* FLOOR IDLE / NEXT NOMINATION DESK                             */
                /* ------------------------------------------------------------- */
                <div className="p-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-[#FFF9E6] border-2 border-black flex items-center justify-center text-3xl mx-auto shadow-[3px_3px_0px_0px_#000]">
                    🏛️
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-black uppercase font-sans">
                      {auctionState.isCompleted ? 'Auction Complete' : 'Auction Floor is Idle'}
                    </h3>
                    <p className="text-xs text-stone-600 max-w-md mx-auto mt-1 leading-relaxed">
                      {auctionState.isCompleted 
                        ? 'All mandatory franchise team rosters (5/5) have been completely filled!' 
                        : availablePlayers.length > 0
                        ? isOrganiserDeskActive 
                          ? 'Select an available contender from the registry below to start the next live bidding lot.'
                          : 'Waiting for the tournament organiser to nominate the next contender.'
                        : 'No contenders are currently active on the auction floor.'}
                    </p>
                  </div>

                  {/* ORGANISER POST-AUCTION & RE-AUCTION CONTROLS */}
                  {isOrganiserDeskActive && auctionState.isCompleted && (
                    <div className="max-w-lg mx-auto bg-white border-4 border-black p-5 shadow-[4px_4px_0px_0px_#000] text-left space-y-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-[#7C3AED] block">
                          AUCTION SUMMARY &amp; CONTROLS
                        </span>
                        <h4 className="font-sans font-black text-base text-black uppercase">
                          Tournament Rosters Assembled
                        </h4>
                        <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
                          All mandatory 5/5 rosters have been drafted. You can re-auction unsold players or start the optional stand-in round.
                        </p>
                      </div>

                      {unsoldPlayers.length > 0 && (
                        <div className="p-3.5 bg-[#FFF4E5] border-2 border-black space-y-3">
                          <div className="flex items-center justify-between">
                            <strong className="text-xs text-black uppercase block">⚠️ {unsoldPlayers.length} Unsold Contenders</strong>
                            <span className="text-[10px] font-black uppercase bg-[#FF70A6] text-black px-1.5 py-0.5 border border-black">
                              Unsold
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600">
                            These players went unsold during bidding. Re-auction them individually or all at once to return them to the draft pool so teams can choose them.
                          </p>
                          <div className="divide-y divide-black/10 max-h-56 overflow-y-auto bg-white border border-black p-2">
                            {unsoldPlayers.map(p => (
                              <div key={p.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">{p.avatar}</span>
                                  <div>
                                    <span className="font-bold text-black">{p.username}</span>
                                    <span className="text-[10px] text-stone-500 block">{p.primaryRole} • MMR: {p.tournamentMmr}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleReauctionPlayer(p.id)}
                                    className="bg-white hover:bg-stone-100 text-black border border-black px-2 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    title="Return contender to pool"
                                  >
                                    To Pool
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReauctionAndNominatePlayer(p.id)}
                                    className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2 py-0.5 text-[9px] font-black uppercase cursor-pointer shadow-[1px_1px_0px_0px_#000]"
                                    title="Re-auction and put directly on live block"
                                  >
                                    Re-Nominate ⚡
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={handleReauctionAllUnsold}
                            className="w-full py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                          >
                            ⚡ Re-Auction All Unsold Contenders ({unsoldPlayers.length})
                          </button>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleStartStandInAuction}
                          className="flex-1 py-2 px-3 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer text-center"
                        >
                          ⚡ Start Stand-In Auction
                        </button>
                        <button
                          type="button"
                          onClick={handleReopenAuction}
                          className="py-2 px-3 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer text-center"
                        >
                          Reopen Auction Room
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CAPTAIN / SPECTATOR POST-AUCTION UNSOLD CONTENDERS LIST */}
                  {!isOrganiserDeskActive && auctionState.isCompleted && unsoldPlayers.length > 0 && (
                    <div className="max-w-md mx-auto bg-white border-4 border-black p-5 shadow-[4px_4px_0px_0px_#000] text-left space-y-3">
                      <div className="flex items-center justify-between border-b-2 border-black pb-2">
                        <strong className="text-xs text-black uppercase block">⚠️ {unsoldPlayers.length} Unsold Contenders</strong>
                        <span className="text-[10px] font-black uppercase bg-[#FF70A6] text-black px-1.5 py-0.5 border border-black">
                          Unsold
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600">
                        These contenders passed without winning bids during the primary auction. They are eligible to be re-auctioned by the organiser.
                      </p>
                      <div className="divide-y divide-black/10 max-h-48 overflow-y-auto border border-black/20 p-2 bg-stone-50">
                        {unsoldPlayers.map(p => (
                          <div key={p.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span>{p.avatar}</span>
                              <div>
                                <span className="font-bold text-black">{p.username}</span>
                                <span className="text-[10px] text-stone-500 block">{p.primaryRole} • MMR {p.tournamentMmr}</span>
                              </div>
                            </div>
                            <span className="bg-[#FFDE59] border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase">
                              Awaiting Re-Auction
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pre-requisite team check */}
                  {teams.length < 2 && (
                    <div className="bg-[#FFF9E6] border-2 border-black p-4 text-left max-w-md mx-auto space-y-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-sans font-black text-xs uppercase text-black">
                          Franchise Formation Required ({teams.length}/2 Teams)
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        At least 2 franchise teams with appointed captains are required to conduct an auction. Visit the Captain Selection desk to appoint verified contenders as captains.
                      </p>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('captain_selection')}
                          className="mt-1 px-3 py-1.5 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Crown className="w-3.5 h-3.5 text-[#FFE600]" />
                          <span>Go to Captain Selection →</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Organiser controls when floor is idle */}
                  {isOrganiserDeskActive && !auctionState.isCompleted && (
                    <div className="max-w-md mx-auto space-y-4 pt-2 text-left">
                      {/* MMR-BALANCED AUCTION PURSE ORGANISER REVIEW */}
                      {teams.length >= 2 && (
                        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 text-left space-y-3 font-mono">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black pb-2">
                            <div className="flex items-center gap-2">
                              <Coins className="w-4 h-4 text-[#FFE600] shrink-0" />
                              <h3 className="font-sans font-black text-xs uppercase text-black">
                                Starting Credit Allocation Review
                              </h3>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black ${
                                purseAudit?.isFrozen ? 'bg-stone-100 text-stone-700' : 'bg-[#70FFAF] text-black'
                              }`}>
                                {purseAudit?.isFrozen ? 'LOCKED & FROZEN' : 'PRE-AUCTION REVIEW'}
                              </span>
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-[#FFE600] text-black border border-black">
                                Mode: {purseAudit?.allocationMode || config.creditAllocationMode || 'CAPTAIN_MMR_BALANCED'}
                              </span>
                            </div>
                          </div>

                          {/* Explanation Banner */}
                          <div className="p-2.5 bg-[#FFFBEB] border border-amber-300 text-[11px] text-stone-700 leading-relaxed font-mono">
                            <p>
                              "{EXPLANATION_TEXT}"
                            </p>
                          </div>

                          {/* Missing Locked MMR Blocking Alert */}
                          {activeEngine.getMissingLockedMmrCaptain() && (
                            <div className="p-3 bg-[#FFEEEE] border-2 border-[#FF5757] text-xs font-mono space-y-1">
                              <div className="flex items-center gap-2 font-black text-[#D32F2F] uppercase">
                                <AlertCircle className="w-4 h-4" />
                                <span>Auction Setup Blocked</span>
                              </div>
                              <p className="text-stone-700">
                                Captain <strong>{activeEngine.getMissingLockedMmrCaptain()?.name}</strong> lacks locked Tournament MMR. Complete verification before auction lobby can open.
                              </p>
                            </div>
                          )}

                          {/* Purse Review Table */}
                          <div className="overflow-x-auto border-2 border-black">
                            <table className="w-full text-xs font-mono">
                              <thead className="bg-black text-white font-black uppercase text-[10px]">
                                <tr>
                                  <th className="p-2 text-left">CAPTAIN</th>
                                  <th className="p-2 text-center">TOURNAMENT MMR</th>
                                  <th className="p-2 text-center">MMR VS AVG</th>
                                  <th className="p-2 text-right">STARTING CREDITS</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-black bg-white text-[11px]">
                                {(purseAudit?.entries || teams.map(t => {
                                  const p = activeEngine.getPlayers().find(x => x.id === t.captainId);
                                  return {
                                    captainId: t.captainId,
                                    captainIgn: t.captainIgn,
                                    tournamentMmr: p?.tournamentMmr || 8000,
                                    mmrDiffFromAvg: 0,
                                    finalStartingCredits: t.startingCredits
                                  };
                                })).map((entry, idx) => (
                                  <tr key={entry.captainId || idx} className="hover:bg-yellow-50/50">
                                    <td className="p-2 font-black text-black">
                                      {entry.captainIgn}
                                    </td>
                                    <td className="p-2 text-center font-bold text-stone-800">
                                      {entry.tournamentMmr}
                                    </td>
                                    <td className={`p-2 text-center font-black ${
                                      entry.mmrDiffFromAvg > 0 ? 'text-[#FF5757]' : entry.mmrDiffFromAvg < 0 ? 'text-emerald-700' : 'text-stone-600'
                                    }`}>
                                      {entry.mmrDiffFromAvg > 0 ? `+${entry.mmrDiffFromAvg}` : entry.mmrDiffFromAvg}
                                    </td>
                                    <td className="p-2 text-right font-black text-[#7C3AED]">
                                      {entry.finalStartingCredits} Cr
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-stone-100 font-bold border-t-2 border-black text-[11px]">
                                <tr>
                                  <td className="p-2 uppercase text-stone-600">Total / Average</td>
                                  <td className="p-2 text-center text-stone-800">
                                    Avg: {purseAudit?.averageCaptainMmr || '—'}
                                  </td>
                                  <td className="p-2 text-center text-stone-500">—</td>
                                  <td className="p-2 text-right font-black text-black">
                                    {purseAudit?.totalCredits || teams.reduce((acc, t) => acc + t.startingCredits, 0)} Cr
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Recalculate & Allocation Controls (Organiser Only) */}
                          {!purseAudit?.hasBidsStarted && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-stone-500 uppercase font-black">Mode:</span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllocationMode('CAPTAIN_MMR_BALANCED')}
                                  className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black cursor-pointer ${
                                    purseAudit?.allocationMode === 'CAPTAIN_MMR_BALANCED' ? 'bg-[#FFE600] text-black shadow-[1px_1px_0px_0px_#000]' : 'bg-white text-stone-600'
                                  }`}
                                >
                                  MMR Balanced
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllocationMode('EQUAL')}
                                  className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black cursor-pointer ${
                                    purseAudit?.allocationMode === 'EQUAL' ? 'bg-[#FFE600] text-black shadow-[1px_1px_0px_0px_#000]' : 'bg-white text-stone-600'
                                  }`}
                                >
                                  Equal (1000 Cr)
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={handleRecalculatePurses}
                                disabled={purseAudit?.hasBidsStarted}
                                className="px-2.5 py-1 bg-black hover:bg-stone-800 text-white border-2 border-black text-[11px] font-black uppercase shadow-[2px_2px_0px_0px_#FFE600] cursor-pointer disabled:opacity-40"
                              >
                                ↻ Recalculate Auction Purses
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Start Auction button if still pending */}
                      {auctionState.status === 'PENDING' && (
                        <div className="p-3 bg-[#E0F2FE] border-2 border-black space-y-2">
                          <span className="text-xs font-black uppercase text-blue-950 block">Auction Pending:</span>
                          <button
                            onClick={handleStartAuction}
                            disabled={Boolean(activeEngine.getMissingLockedMmrCaptain()) || teams.length < 2}
                            className="w-full py-2.5 bg-[#70FFAF] hover:bg-emerald-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer disabled:opacity-40"
                          >
                            {activeEngine.getMissingLockedMmrCaptain() 
                              ? `⚠ Blocked: Missing ${activeEngine.getMissingLockedMmrCaptain()?.name} MMR` 
                              : '▶ Start Auction Floor'}
                          </button>
                        </div>
                      )}

                      {/* Nominate contender */}
                      {(availablePlayers.length > 0 || unsoldPlayers.length > 0) && (
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-stone-500 block">Select Contender to Nominate:</span>
                          <div className="flex gap-2">
                            <SelectDropdown
                              value={selectedNomineeId}
                              onChange={(val) => setSelectedNomineeId(val)}
                              options={[
                                { value: '', label: `-- Choose Contender (${availablePlayers.length + unsoldPlayers.length} Available / Unsold) --` },
                                ...availablePlayers.map(p => ({
                                  value: p.id,
                                  label: `${p.username} · MMR ${p.tournamentMmr} · ${p.primaryRole}`
                                })),
                                ...unsoldPlayers.map(p => ({
                                  value: p.id,
                                  label: `[UNSOLD] ${p.username} · MMR ${p.tournamentMmr} · ${p.primaryRole} (Re-nominate)`
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

                      {/* Default Lot Nomination Duration */}
                      <div className="p-3 bg-white border-2 border-black text-xs space-y-2 shadow-[2px_2px_0px_0px_#000]">
                        <div className="flex items-center justify-between">
                          <strong className="block text-black font-black uppercase">Default Lot Nomination Duration:</strong>
                          <span className="font-mono text-[10px] font-black bg-[#FFE600] px-2 py-0.5 border border-black">
                            Current: {config.nominationTimerSeconds}s
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {[15, 20, 30, 45, 60, 90].map((sec) => (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                activeEngine.setDefaultNominationSeconds(sec, currentUser.id);
                                setBidSuccess(`✓ Default nomination timer set to ${sec}s.`);
                                setTimeout(() => setBidSuccess(null), 2000);
                              }}
                              className={`px-2.5 py-1 text-xs font-black uppercase border border-black cursor-pointer ${
                                config.nominationTimerSeconds === sec
                                  ? 'bg-[#7C3AED] text-white shadow-[1px_1px_0px_0px_#000]'
                                  : 'bg-stone-50 hover:bg-stone-100 text-black'
                              }`}
                            >
                              {sec}s
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Anti-snipe toggle setting */}
                      <div className="flex items-center justify-between p-3 bg-stone-50 border border-black text-xs">
                        <div>
                          <strong className="block text-black">Anti-Sniping Timer Extension</strong>
                          <span className="text-[10px] text-stone-500">Resets to 5s if bid placed within final 5s</span>
                        </div>
                        <button
                          onClick={handleToggleAntiSnipe}
                          className={`px-3 py-1 border border-black text-[10px] font-black uppercase cursor-pointer ${
                            config.bidExtensionEnabled ? 'bg-[#70FFAF] text-black' : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {config.bidExtensionEnabled ? 'ON' : 'OFF'}
                        </button>
                      </div>

                      {/* Stand-In Auction Controls */}
                      <div className="p-3 bg-[#E0E7FF] border-2 border-black space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <strong className="block text-black font-black uppercase">Stand-In Auction Round:</strong>
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 border border-black ${
                            auctionState.standInRoundActive ? 'bg-[#70FFAF] text-black animate-pulse' : 'bg-stone-200 text-stone-700'
                          }`}>
                            {auctionState.standInRoundActive ? 'ACTIVE (Round in progress)' : 'ROUND NOT STARTED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-600 leading-relaxed">
                          {teams.every(t => t.primaryRoster.length >= config.primaryRosterSize)
                            ? 'All teams have completed their mandatory 5/5 primary rosters. Organiser can now officially start the auction for optional 6th slot stand-in players.'
                            : `Stand-in auction is locked: ${teams.filter(t => t.primaryRoster.length < config.primaryRosterSize).length} team(s) still need to fill their mandatory 5/5 primary rosters first.`}
                        </p>
                        {teams.every(t => t.primaryRoster.length >= config.primaryRosterSize) && (
                          <div className="pt-1">
                            {!auctionState.standInRoundActive ? (
                              <button
                                type="button"
                                onClick={handleStartStandInAuction}
                                className="w-full py-2 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                              >
                                ⚡ Start Auction for Stand-Ins
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleConcludeStandInAuction}
                                className="w-full py-2 bg-black hover:bg-stone-800 text-white border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                              >
                                🔒 Conclude Stand-Ins &amp; Finalize Auction
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Re-Auction Unsold Contenders Quick Action */}
                      {unsoldPlayers.length > 0 && (
                        <div className="p-3 bg-[#FFF4E5] border-2 border-black space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <strong className="block text-black font-black uppercase">Unsold Contenders ({unsoldPlayers.length})</strong>
                            <span className="text-[10px] font-black uppercase bg-[#FF70A6] text-black px-1.5 py-0.5 border border-black">
                              Unsold
                            </span>
                          </div>
                          <p className="text-[11px] text-stone-600">
                            {unsoldPlayers.length} player(s) passed without winning bids. Return them to the available pool so teams with open slots or needing stand-ins can choose them.
                          </p>
                          <button
                            type="button"
                            onClick={handleReauctionAllUnsold}
                            className="w-full py-2 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                          >
                            ⚡ Re-Auction All Unsold Contenders ({unsoldPlayers.length})
                          </button>
                        </div>
                      )}

                      {/* Finalize Auction */}
                      <div className="pt-2 text-center space-y-1">
                        <button
                          onClick={handleFinalizeAuction}
                          disabled={teams.some(t => t.primaryRoster.length < config.primaryRosterSize)}
                          className="px-4 py-2 bg-black text-white hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                        >
                          Finalize Auction & Lock Rosters
                        </button>
                        {teams.some(t => t.primaryRoster.length < config.primaryRosterSize) && (
                          <span className="block text-[10px] text-stone-500 font-mono">
                            Both teams must reach mandatory 5/5 rosters before auction can be finalized.
                          </span>
                        )}
                      </div>
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
                        {isOrganiserDeskActive && !auctionState.nominee && !auctionState.isCompleted && (
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

            {/* Unsold Contender Pool Table on Live Floor */}
            {unsoldPlayers.length > 0 && (
              <div className="bg-[#FFF9E6] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <h3 className="text-sm font-black uppercase text-black font-sans">
                        Unsold Contenders Pool ({unsoldPlayers.length})
                      </h3>
                      <span className="text-[10px] text-stone-600 block">
                        Passed without winning bids — click Re-Nominate or Return to Pool to allow teams to choose them.
                      </span>
                    </div>
                  </div>
                  {isOrganiserDeskActive && (
                    <button
                      type="button"
                      onClick={handleReauctionAllUnsold}
                      className="bg-[#BAE6FD] hover:bg-sky-200 text-black border border-black px-2.5 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                    >
                      ⚡ Re-Auction All Unsold ({unsoldPlayers.length})
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-black/10">
                  {unsoldPlayers.map(player => (
                    <div key={player.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{player.avatar}</span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <strong className="text-black">{player.username}</strong>
                            <span className="bg-[#FF70A6] text-black text-[9px] font-black uppercase px-1.5 py-0.5 border border-black">
                              Unsold
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-500">{player.city || 'India'} • {player.primaryRole}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="font-mono font-bold text-[#7C3AED]">
                          MMR: {player.tournamentMmr.toLocaleString()}
                        </span>
                        {isOrganiserDeskActive && !auctionState.nominee && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleReauctionPlayer(player.id)}
                              className="bg-white hover:bg-stone-100 text-black border border-black px-2 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                              title="Return contender to available pool"
                            >
                              Return to Pool
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReauctionAndNominatePlayer(player.id)}
                              className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                              title="Re-auction and put directly on auction block"
                            >
                              Re-Nominate ⚡
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Rail: Chronological Bid History & Team Purses */}
          <div className="space-y-6">
            {/* Live Chronological Bid History */}
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#7C3AED]" />
                  <h3 className="text-sm font-black uppercase text-black font-sans">
                    Live Bid History
                  </h3>
                </div>
                <span className="text-[10px] text-stone-500 font-bold">{bidHistory.length} Bids</span>
              </div>

              {bidHistory.length === 0 ? (
                <div className="p-6 text-center text-stone-400 text-xs">
                  No bids placed yet in this session.
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {bidHistory.slice(0, 20).map((bid, idx) => {
                    const isLatestLeading = idx === 0;
                    return (
                      <div 
                        key={bid.id} 
                        className={`p-2.5 border text-xs space-y-0.5 transition-all ${
                          isLatestLeading 
                            ? 'bg-[#FFF9E6] border-2 border-black shadow-[2px_2px_0px_0px_#000]' 
                            : 'bg-stone-50 border-stone-300'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-[10px] text-stone-500">{bid.timestamp}</span>
                          <strong className={isLatestLeading ? 'text-[#7C3AED]' : 'text-stone-800'}>
                            {bid.teamName}
                          </strong>
                          <span className="font-black text-emerald-800 font-mono">
                            {bid.amount.toLocaleString()} Cr
                          </span>
                        </div>
                        {isLatestLeading && (
                          <div className="text-[9px] font-black text-amber-800 uppercase flex items-center gap-1">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>Current Leader</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Team Purses & Roster Progress */}
            <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-3">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <span className="text-xs font-black uppercase text-black">Team Purses & Roster Progress</span>
                <span className="text-[10px] text-stone-500 font-bold">{teams.length} Teams</span>
              </div>
              <div className="space-y-3">
                {teams.map(t => {
                  const pct = Math.min(100, Math.round((t.primaryRoster.length / 5) * 100));
                  const isUserTeam = effectiveCaptainTeam?.id === t.id;
                  return (
                    <div 
                      key={t.id} 
                      className={`p-3 border text-xs space-y-1.5 ${
                        isUserTeam ? 'bg-[#F3E8FF] border-2 border-[#7C3AED]' : 'bg-stone-50 border-black'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-black text-black block">{t.name}</span>
                          <span className="text-[10px] text-stone-500">Captain: {t.captainIgn}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-800 text-sm block">{t.remainingCredits.toLocaleString()} Cr</span>
                          <span className="text-[10px] text-stone-400">Used: {t.creditsUsed} Cr</span>
                        </div>
                      </div>

                      {/* Visual Roster Progress Bar */}
                      <div>
                        <div className="flex justify-between text-[10px] font-bold text-stone-600 mb-0.5">
                          <span>Primary: {t.primaryRoster.length}/5</span>
                          <span>Stand-ins: {t.standIns.length}/1</span>
                        </div>
                        <div className="w-full bg-stone-200 border border-black h-2 overflow-hidden">
                          <div 
                            className="bg-[#7C3AED] h-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
            {isOrganiserUser && (
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
          <div className="flex flex-wrap items-center justify-between border-b-2 border-black pb-3 gap-3">
            <div>
              <h3 className="font-black text-base uppercase text-black font-sans">
                Unsold Contenders ({unsoldPlayers.length})
              </h3>
              <p className="text-[11px] text-stone-500">
                Nominated to the auction block, but lot closed without meeting winning bid. You can re-auction them so players can be chosen.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isOrganiserDeskActive && unsoldPlayers.length > 0 && (
                <button
                  type="button"
                  onClick={handleReauctionAllUnsold}
                  className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-3 py-1.5 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  ⚡ Re-Auction All Unsold ({unsoldPlayers.length})
                </button>
              )}
              <span className="bg-[#FFDE59] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
                Distinct from Unselected
              </span>
            </div>
          </div>

          {unsoldPlayers.length === 0 ? (
            <div className="p-8 text-center text-stone-400 text-xs">No unsold players at this time.</div>
          ) : (
            <div className="divide-y divide-black/10">
              {unsoldPlayers.map(p => (
                <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.avatar}</span>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <strong className="text-black text-sm">{p.username}</strong>
                        <span className="bg-[#FF70A6] text-black text-[9px] font-black uppercase px-1.5 py-0.5 border border-black">
                          Unsold
                        </span>
                      </div>
                      <span className="text-[10px] text-stone-500 block">{p.city || 'India'} • {p.primaryRole}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-purple-700 font-bold">MMR: {p.tournamentMmr.toLocaleString()}</span>
                    {isOrganiserDeskActive && !auctionState.nominee && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleReauctionPlayer(p.id)}
                          className="bg-white hover:bg-stone-100 text-black border border-black px-2.5 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                          title="Return player to available pool"
                        >
                          Return to Pool
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReauctionAndNominatePlayer(p.id)}
                          className="bg-[#FFE600] hover:bg-yellow-400 text-black border border-black px-2.5 py-1 text-[10px] font-black uppercase shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                          title="Put directly on live auction block"
                        >
                          Re-Nominate ⚡
                        </button>
                      </div>
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
                      {audit.timestamp}
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

      {/* CAPTAIN TEAM BRANDING & BANNER CUSTOMIZATION MODAL */}
      {showTeamCustomizerModal && effectiveCaptainTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4 font-mono">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#FFE600] shrink-0" />
                <h3 className="font-black text-base uppercase text-black font-sans">
                  Submit Team Branding & Banner
                </h3>
              </div>
              <button
                onClick={() => setShowTeamCustomizerModal(false)}
                className="font-black text-sm p-1 border border-black hover:bg-black hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              As team captain, finalize your official team name, tag, logo, and banner. These will appear across match lobbies and tournament brackets.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const res = tournamentService.updateAuctionTeamIdentity(selectedTournamentId, effectiveCaptainTeam.id, {
                  name: customTeamName.trim() || effectiveCaptainTeam.name,
                  tag: (customTeamTag.trim().toUpperCase() || effectiveCaptainTeam.tag).slice(0, 4),
                  logo: customTeamLogo,
                  color: customTeamColor,
                  bannerUrl: customTeamBanner
                });
                if (res.success) {
                  setBidSuccess(`✓ Team identity updated for ${res.team?.name || 'your franchise'}!`);
                  setShowTeamCustomizerModal(false);
                  setTimeout(() => setBidSuccess(null), 3500);
                } else {
                  setBidError(res.error || 'Failed to update team identity.');
                }
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block text-xs font-black uppercase mb-1">Official Team Name</label>
                <input
                  type="text"
                  required
                  value={customTeamName}
                  onChange={(e) => setCustomTeamName(e.target.value)}
                  placeholder="e.g. Phoenix Rising"
                  className="w-full border-2 border-black p-2 font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Team Tag (3-4 Chars)</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={customTeamTag}
                    onChange={(e) => setCustomTeamTag(e.target.value.toUpperCase())}
                    placeholder="PHX"
                    className="w-full border-2 border-black p-2 font-black text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black uppercase mb-1">Team Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={customTeamColor}
                      onChange={(e) => setCustomTeamColor(e.target.value)}
                      className="w-10 h-8 border border-black cursor-pointer"
                    />
                    <span className="font-bold text-xs">{customTeamColor}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">Team Logo / Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {['🛡️', '⚡', '👑', '🐉', '🦅', '🦁', '⚔️', '🎯', '🔥', '💎'].map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setCustomTeamLogo(em)}
                      className={`w-9 h-9 border-2 flex items-center justify-center text-lg cursor-pointer ${
                        customTeamLogo === em ? 'bg-[#FFE600] border-black scale-110 shadow-[2px_2px_0px_0px_#000]' : 'bg-stone-50 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase mb-1">Franchise Banner Theme</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Cyber Yellow', value: 'linear-gradient(135deg, #f59e0b 0%, #FFE600 100%)' },
                    { label: 'Nebula Purple', value: 'linear-gradient(135deg, #1e1b4b 0%, #7C3AED 100%)' },
                    { label: 'Crimson Fury', value: 'linear-gradient(135deg, #881337 0%, #FF5757 100%)' },
                    { label: 'Emerald Pulse', value: 'linear-gradient(135deg, #064e3b 0%, #70FFAF 100%)' }
                  ].map((b) => (
                    <div
                      key={b.label}
                      onClick={() => setCustomTeamBanner(b.value)}
                      className={`p-2.5 border-2 cursor-pointer transition-all ${
                        customTeamBanner === b.value ? 'border-black ring-2 ring-black font-black' : 'border-stone-300'
                      }`}
                      style={{ background: b.value }}
                    >
                      <span className="text-[10px] font-black uppercase text-white drop-shadow-md">
                        {b.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Banner */}
              <div
                className="p-4 border-2 border-black text-white space-y-1 shadow-[2px_2px_0px_0px_#000]"
                style={{ background: customTeamBanner }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{customTeamLogo}</span>
                  <div>
                    <h4 className="font-black text-sm uppercase drop-shadow">{customTeamName || 'Team Name Preview'} [{customTeamTag || 'TAG'}]</h4>
                    <p className="text-[10px] text-white/90">Official Franchise Squad · Captain {currentUser.displayName || 'Captain'}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowTeamCustomizerModal(false)}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-black text-xs font-bold uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#70FFAF] hover:bg-emerald-400 text-black border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                >
                  ✓ Submit Official Team Info
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Neo-brutalist Finalize Auction Confirmation Modal */}
      <ConfirmationModal
        isOpen={isFinalizeConfirmOpen}
        onClose={() => setIsFinalizeConfirmOpen(false)}
        onConfirm={executeFinalizeAuction}
        title="Finalize Auction & Lock Rosters"
        subtitle="Competitive Integrity · Stage Finalization"
        message="Are you sure you want to finalize the auction and lock all rosters? This will transition the auction stage, record all winning player acquisitions, and lock the tournament team compositions."
        confirmLabel="YES, FINALIZE AUCTION"
        cancelLabel="CONTINUE DRAFTING"
        variant="warning"
        details={
          <div className="space-y-1">
            <div><span className="font-bold">Total Franchises:</span> {teams.length} Teams</div>
            <div><span className="font-bold">Roster Target:</span> {config.primaryRosterSize} Main Squad Members Per Team</div>
          </div>
        }
      />
    </div>
  );
}
