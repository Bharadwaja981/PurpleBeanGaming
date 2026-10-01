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
}

export function OrganiserDashboardView({ onNavigate, onOpenRegister, onOpenCreateTournament }: OrganiserDashboardViewProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('');
  const currentUser = tournamentService.getCurrentUser();

  useEffect(() => {
    const list = tournamentService.getTournaments('All Games', 'All', true);
    setTournaments(list);
    if (list.length > 0 && !selectedTournamentId) {
      setSelectedTournamentId(list[0].id);
    }

    const unsub = tournamentService.subscribe(() => {
      const updated = tournamentService.getTournaments('All Games', 'All', true);
      setTournaments(updated);
      if (updated.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(updated[0].id);
      }
    });
    return unsub;
  }, [selectedTournamentId]);

  const activeTourney = tournaments.find(t => t.id === selectedTournamentId) || tournaments[0];
  const config = activeTourney 
    ? (tournamentConfigRegistry.getConfig(activeTourney.id) || tournamentToConfig(activeTourney))
    : null;
  const engine = config ? new GenericTournamentEngine(config) : null;

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

      {/* Dynamic Workspace */}
      {config && engine ? (
        <DynamicOrganiserWorkspace 
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
