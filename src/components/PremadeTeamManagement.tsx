import React from 'react';
import { Users, Shield, ArrowRight } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';

interface PremadeTeamManagementProps {
  tournamentId: string;
  onNavigateTeamProfile?: (teamId: string) => void;
}

export const PremadeTeamManagement: React.FC<PremadeTeamManagementProps> = ({
  tournamentId,
  onNavigateTeamProfile
}) => {
  const teams = tournamentService.getTeams().filter(t => !t.tournamentId || t.tournamentId === tournamentId);

  return (
    <div className="space-y-6 font-mono">
      <div className="flex items-center justify-between border-b-2 border-black pb-3 bg-white p-4 border-[3px] shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#7C3AED]" />
          <h3 className="font-sans font-black text-lg uppercase">Registered Squads & Rosters</h3>
        </div>
        <span className="text-xs bg-[#70FFAF] px-2 py-0.5 border border-black font-bold uppercase">
          {teams.length} Squads Active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((t) => (
          <div
            key={t.id}
            className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b-2 border-black pb-2">
                <span className="text-2xl">{t.logo || '🛡️'}</span>
                <span className="text-xs font-black uppercase text-[#7C3AED] bg-[#EDE9FE] px-2 py-0.5 border border-black">
                  {t.tag}
                </span>
              </div>
              <h4 className="font-sans font-black text-base uppercase">{t.name}</h4>
              <p className="text-xs text-stone-600">Captain: {t.captainName}</p>
            </div>

            <button
              onClick={() => onNavigateTeamProfile?.(t.id)}
              className="w-full bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black py-2 px-3 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>View Roster Profile</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
