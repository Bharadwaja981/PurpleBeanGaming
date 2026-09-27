import { useState, useMemo, useEffect } from 'react';
import { Shield, Search, Trophy, Users, ArrowRight, MapPin, Gamepad2 } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { Team, ViewType } from '../types/tournament';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface TeamsViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function TeamsView({ onNavigate }: TeamsViewProps) {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('All');
  const [teams, setTeams] = useState<Team[]>(() => tournamentService.getTeams());

  useEffect(() => {
    const unsub = tournamentService.subscribe(() => {
      setTeams(tournamentService.getTeams());
    });
    return unsub;
  }, []);

  const filteredTeams = useMemo(() => {
    return teams.filter((t) => {
      const matchesSearch = 
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.tag.toLowerCase().includes(search.toLowerCase()) ||
        t.captainName.toLowerCase().includes(search.toLowerCase()) ||
        (t.city && t.city.toLowerCase().includes(search.toLowerCase()));
      const matchesRegion = regionFilter === 'All' || t.region === regionFilter;
      return matchesSearch && matchesRegion;
    });
  }, [teams, search, regionFilter]);

  const regionOptions: DropdownOption[] = [
    { value: 'All', label: 'All Indian Regions', icon: MapPin },
    { value: 'Pan India', label: 'Pan India', icon: MapPin },
    { value: 'South India', label: 'South India', icon: MapPin },
    { value: 'West India', label: 'West India', icon: MapPin },
    { value: 'North India', label: 'North India', icon: MapPin },
    { value: 'East India', label: 'East India', icon: MapPin }
  ];

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-stone-600 font-mono text-xs uppercase font-black">
          <Shield className="w-4 h-4 text-[#7C3AED]" />
          <span>PURPLE BEAN GAMING · TEAM DIRECTORY</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans">
          INDIAN ESPORTS TEAMS
        </h1>
        <p className="font-mono text-xs sm:text-sm text-stone-600 max-w-2xl">
          Browse active Indian franchise squads, team captains, city headquarters, ELO ratings, and historical ₹ INR prize earnings.
        </p>
      </div>

      {/* Search & Region Input */}
      <div className="bg-[#FFFBEB] border-[3px] border-black shadow-[4px_4px_0px_0px_#000] p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter teams by name, tag, city (Bengaluru, Mumbai...)"
          className="flex-1 bg-white border-2 border-black px-4 py-2 font-mono text-xs font-bold text-black placeholder:text-stone-400 focus:outline-hidden shadow-[2px_2px_0px_0px_#000]"
        />
        <SelectDropdown
          value={regionFilter}
          onChange={(val) => setRegionFilter(val)}
          options={regionOptions}
          className="w-full sm:w-64"
          placeholder="Select Region"
        />
      </div>

      {/* Grid of Team Cards */}
      {filteredTeams.length === 0 ? (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-12 text-center space-y-3">
          <div className="w-12 h-12 mx-auto bg-stone-100 border-2 border-black flex items-center justify-center text-2xl">
            🛡️
          </div>
          <h2 className="font-sans font-black text-xl uppercase text-black">No Esports Teams Found</h2>
          <p className="font-mono text-xs text-stone-600 max-w-md mx-auto">
            No registered teams or franchises currently match the active filters or search terms.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTeams.map((team) => (
          <div
            key={team.id}
            onClick={() => onNavigate('team_profile', team.id)}
            className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-4 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_#000] transition-all cursor-pointer flex flex-col justify-between group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <span className="text-4xl">{team.logo}</span>
                <div className="flex items-center gap-1.5">
                  <span className="bg-[#FFE600] border-2 border-black px-2 py-0.5 font-mono text-xs font-black uppercase shadow-[1.5px_1.5px_0px_0px_#000]">
                    {team.tag}
                  </span>
                  <span className="bg-[#7C3AED] text-white border border-black px-1.5 py-0.5 font-mono text-[9px] font-black uppercase">
                    {team.primaryGame || 'Dota 2'}
                  </span>
                </div>
              </div>

              <div>
                <h2 className="text-xl font-black uppercase text-black font-sans group-hover:underline">
                  {team.name}
                </h2>
                <p className="font-mono text-xs text-stone-500 font-bold flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-[#7C3AED]" />
                  <span>{team.city}, {team.region}</span>
                </p>
                <p className="font-mono text-[11px] text-stone-600 mt-1">
                  Captain: <strong className="text-black">{team.captainName}</strong>
                </p>
              </div>

              <p className="font-mono text-xs text-stone-600 line-clamp-2 leading-relaxed">
                {team.description}
              </p>
            </div>

            <div className="pt-3 border-t-2 border-black font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Platform Rating:</span>
                <span className="font-black text-black">{team.rating}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Series Record:</span>
                <span className="font-black text-black">{team.record.wins}W - {team.record.losses}L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">INR Earnings:</span>
                <span className="font-black text-[#7C3AED]">{team.earningsINR || '₹5,00,000'}</span>
              </div>

              <div className="pt-2">
                <div className="w-full py-2 bg-stone-100 group-hover:bg-[#FFE600] border-2 border-black font-black uppercase text-[11px] text-center transition-colors">
                  Open Team Profile →
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
