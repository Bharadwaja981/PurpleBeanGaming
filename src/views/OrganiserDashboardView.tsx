import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Shield, 
  Users, 
  Gavel, 
  ArrowRight, 
  Sparkles, 
  Settings, 
  Play, 
  Pause,
  StopCircle,
  Trash2,
  Calendar, 
  Plus, 
  RefreshCw,
  Crown
} from 'lucide-react';
import { Tournament, ViewType } from '../types/tournament';
import { tournamentService, tournamentToConfig } from '../services/firebaseService';
import { tournamentConfigRegistry } from '../domain/tournamentConfigRegistry';
import { GenericTournamentEngine } from '../domain/genericTournamentEngine';
import { DynamicOrganiserWorkspace } from '../components/DynamicOrganiserWorkspace';
import { SelectDropdown } from '../components/ui/Dropdown';

interface OrganiserDashboardViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  onOpenRegister?: (tourneyId?: string) => void;
  onOpenCreateTournament?: () => void;
  initialTournamentId?: string;
}

export function OrganiserDashboardView({ 
  onNavigate, 
  onOpenRegister, 
  onOpenCreateTournament,
  initialTournamentId 
}: OrganiserDashboardViewProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId || '');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const currentUser = tournamentService.getCurrentUser();

  // Keep selected tournament in sync when initialTournamentId prop changes
  useEffect(() => {
    if (initialTournamentId) {
      setSelectedTournamentId(initialTournamentId);
    }
  }, [initialTournamentId]);

  useEffect(() => {
    const list = tournamentService.getTournaments('All Games', 'All', true);
    setTournaments(list);
    if (list.length > 0 && !selectedTournamentId) {
      const match = initialTournamentId ? list.find(t => t.id === initialTournamentId) : null;
      setSelectedTournamentId(match ? match.id : list[0].id);
    }

    const unsub = tournamentService.subscribe(() => {
      const updated = tournamentService.getTournaments('All Games', 'All', true);
      setTournaments(updated);
      if (updated.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(updated[0].id);
      }
    });
    return unsub;
  }, [selectedTournamentId, initialTournamentId]);

  const activeTourney = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];
  const config = activeTourney 
    ? (tournamentConfigRegistry.getConfig(activeTourney.id) || tournamentToConfig(activeTourney))
    : null;
  const engine = config ? new GenericTournamentEngine(config) : null;

  const showNotice = (message: string, type: 'success' | 'error' = 'success') => {
    setActionNotice({ message, type });
    setTimeout(() => setActionNotice(null), 4500);
  };

  const handleAdvanceLifecycle = async () => {
    if (!activeTourney) return;
    const status = activeTourney.status;
    let nextStage: 'DRAFTING' | 'LIVE' | 'COMPLETED' = 'DRAFTING';
    if (status === 'Registration Open' || activeTourney.lifecycle === 'REGISTRATION_OPEN') {
      nextStage = 'DRAFTING';
    } else if (status === 'Drafting' || activeTourney.lifecycle === 'DRAFTING') {
      nextStage = 'LIVE';
    } else if (status === 'Live' || activeTourney.lifecycle === 'LIVE') {
      nextStage = 'COMPLETED';
    }

    setLifecycleBusy(true);
    const res = await tournamentService.setTournamentLifecycle(activeTourney.id, nextStage);
    setLifecycleBusy(false);
    if (res.success) {
      showNotice(res.message || `Advanced tournament to ${nextStage}!`);
    } else {
      showNotice(res.error || 'Failed to advance lifecycle', 'error');
    }
  };

  const handleHoldOrResume = async () => {
    if (!activeTourney) return;
    const isOnHold = activeTourney.status === 'On Hold' || activeTourney.lifecycle === 'ON_HOLD';
    setLifecycleBusy(true);
    if (isOnHold) {
      const res = await tournamentService.resumeTournament(activeTourney.id);
      setLifecycleBusy(false);
      if (res.success) {
        showNotice(res.message || 'Resumed tournament from hold.');
      } else {
        showNotice(res.error || 'Failed to resume tournament.', 'error');
      }
    } else {
      const reason = window.prompt('Enter reason for holding tournament (e.g. Schedule adjustment, server outage):', 'Operational delay');
      if (reason === null) {
        setLifecycleBusy(false);
        return;
      }
      const res = await tournamentService.setTournamentLifecycle(activeTourney.id, 'ON_HOLD', reason.trim());
      setLifecycleBusy(false);
      if (res.success) {
        showNotice(res.message || 'Tournament placed on hold.');
      } else {
        showNotice(res.error || 'Failed to hold tournament.', 'error');
      }
    }
  };

  const handleCancelTournament = async () => {
    if (!activeTourney) return;
    setLifecycleBusy(true);
    const res = await tournamentService.setTournamentLifecycle(activeTourney.id, 'CANCELLED');
    setLifecycleBusy(false);
    if (res.success) {
      showNotice(res.message || 'Tournament cancelled successfully.');
    } else {
      showNotice(res.error || 'Failed to cancel tournament.', 'error');
    }
  };

  const handleDeleteTournament = async () => {
    if (!activeTourney) return;
    const targetTourney = activeTourney;
    setLifecycleBusy(true);
    const res = await tournamentService.deleteTournament(targetTourney.id);
    setLifecycleBusy(false);
    if (res.success) {
      showNotice(`Tournament '${targetTourney.name}' deleted.`);
      const remaining = tournaments.filter(t => t.id !== targetTourney.id);
      setTournaments(remaining);
      setSelectedTournamentId(remaining[0]?.id || '');
    } else {
      showNotice(res.error || 'Failed to delete tournament.', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-[#7C3AED] text-white border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-black uppercase bg-[#FFE600] text-black px-2.5 py-1 border border-black">
                Lead Organiser Workspace
              </span>
              <span className="font-mono text-xs font-black uppercase bg-black text-white px-2.5 py-1 border border-white">
                Role: {currentUser.role}
              </span>
            </div>

            {onOpenCreateTournament && (
              <button
                type="button"
                onClick={onOpenCreateTournament}
                className="px-4 py-2 bg-[#FFE600] hover:bg-[#FFDE59] active:translate-x-0.5 active:translate-y-0.5 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Create Tournament</span>
              </button>
            )}
          </div>

          <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight font-sans">
            Tournament Operations Console
          </h1>
          <p className="font-mono text-xs text-purple-100 max-w-2xl leading-relaxed">
            Manage registrations, appoint franchise team captains, audit locked Tournament MMR, control live auction room bidding, and advance competition brackets.
          </p>
        </div>
      </div>

      {/* Tournament Selector Bar */}
      {tournaments.length > 0 && (
        <div className="bg-white border-[3.5px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-black uppercase text-black shrink-0">Active Circuit:</span>
            <SelectDropdown
              value={selectedTournamentId}
              onChange={(val) => setSelectedTournamentId(val)}
              options={tournaments.map(t => ({
                value: t.id,
                label: t.name,
                subtitle: t.game || 'Dota 2'
              }))}
              size="sm"
              icon={Trophy}
              mobileTitle="Select Active Circuit"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onOpenCreateTournament && (
              <button
                type="button"
                onClick={onOpenCreateTournament}
                className="px-3.5 py-1.5 bg-white hover:bg-stone-50 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Tournament</span>
              </button>
            )}

            <button
              onClick={() => onNavigate('captain_selection', activeTourney?.id)}
              className="px-3.5 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
            >
              <Crown className="w-3.5 h-3.5 text-black" />
              <span>Captain Selection Room →</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Notification Banner */}
      {actionNotice && (
        <div className={`p-4 border-[3px] border-black font-mono text-xs font-black flex items-center justify-between shadow-[4px_4px_0px_0px_#000] animate-in fade-in ${
          actionNotice.type === 'error' ? 'bg-red-50 text-red-900 border-red-950' : 'bg-[#70FFAF] text-black'
        }`}>
          <span>{actionNotice.message}</span>
          <button 
            onClick={() => setActionNotice(null)}
            className="px-1.5 py-0.5 border border-black hover:bg-black hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Organiser Lifecycle Governance Controls Bar */}
      {activeTourney && (
        <div className="bg-[#FFFDE8] border-[3.5px] border-black p-4 sm:p-5 shadow-[4px_4px_0px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex items-center gap-1.5 font-black uppercase text-black bg-[#FFE600] px-2 py-0.5 border border-black">
              <Shield className="w-3.5 h-3.5 text-black" />
              <span>Lifecycle Status:</span>
            </span>
            <span className={`px-2.5 py-1 font-black uppercase border-2 border-black shadow-[1px_1px_0px_0px_#000] ${
              activeTourney.status === 'Live' || activeTourney.lifecycle === 'LIVE' ? 'bg-[#38EF7D] text-black animate-pulse' :
              activeTourney.status === 'Drafting' || activeTourney.lifecycle === 'DRAFTING' ? 'bg-[#8B5CF6] text-white' :
              activeTourney.status === 'On Hold' || activeTourney.lifecycle === 'ON_HOLD' ? 'bg-amber-400 text-black' :
              activeTourney.status === 'Completed' || activeTourney.lifecycle === 'COMPLETED' ? 'bg-stone-300 text-stone-800' :
              activeTourney.status === 'Cancelled' || activeTourney.lifecycle === 'CANCELLED' ? 'bg-red-500 text-white' :
              'bg-[#FFE600] text-black'
            }`}>
              {activeTourney.status}
            </span>
            {(activeTourney as any).statusReason && (
              <span className="text-stone-600 italic">
                ("{(activeTourney as any).statusReason}")
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Advance Lifecycle */}
            {(activeTourney.status === 'Registration Open' || activeTourney.lifecycle === 'REGISTRATION_OPEN') && (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={handleAdvanceLifecycle}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Gavel className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Advance to Draft →</span>
              </button>
            )}

            {(activeTourney.status === 'Drafting' || activeTourney.lifecycle === 'DRAFTING') && (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={handleAdvanceLifecycle}
                className="px-3 py-1.5 bg-[#38EF7D] hover:bg-emerald-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-black" />
                <span>Start Matches (Live) →</span>
              </button>
            )}

            {(activeTourney.status === 'Live' || activeTourney.lifecycle === 'LIVE') && (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={handleAdvanceLifecycle}
                className="px-3 py-1.5 bg-black hover:bg-stone-800 text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trophy className="w-3.5 h-3.5 text-[#FFE600]" />
                <span>Conclude Tournament (Completed)</span>
              </button>
            )}

            {/* Hold / Resume */}
            {(activeTourney.status === 'On Hold' || activeTourney.lifecycle === 'ON_HOLD') ? (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={handleHoldOrResume}
                className="px-3 py-1.5 bg-[#38EF7D] hover:bg-emerald-400 text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 text-black" />
                <span>Continue / Resume</span>
              </button>
            ) : (
              activeTourney.status !== 'Completed' && activeTourney.status !== 'Cancelled' && (
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={handleHoldOrResume}
                  className="px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Pause className="w-3.5 h-3.5 text-amber-950" />
                  <span>Hold Tournament</span>
                </button>
              )
            )}

            {/* Cancel Tournament */}
            {activeTourney.status !== 'Cancelled' && activeTourney.status !== 'Completed' && (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={handleCancelTournament}
                className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <StopCircle className="w-3.5 h-3.5 text-rose-700" />
                <span>Cancel</span>
              </button>
            )}

            {/* Delete Tournament */}
            <button
              type="button"
              disabled={lifecycleBusy}
              onClick={handleDeleteTournament}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Permanently remove tournament"
            >
              <Trash2 className="w-3.5 h-3.5 text-white" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Workspace with Key for Strict Tournament State Isolation */}
      {config && engine ? (
        <DynamicOrganiserWorkspace 
          key={activeTourney?.id}
          config={config} 
          engine={engine} 
          onNavigate={onNavigate} 
        />
      ) : (
        <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="text-xl font-black uppercase text-black font-sans">
            No Tournaments Configured
          </h3>
          <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
            You don't have any active tournaments right now. Create a new championship to open the operations workspace.
          </p>
          {onOpenCreateTournament && (
            <button
              type="button"
              onClick={onOpenCreateTournament}
              className="px-6 py-3 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[4px_4px_0px_0px_#000] inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Your First Tournament</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
