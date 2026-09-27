import { useState, useEffect } from 'react';
import { 
  Shield, 
  Trophy, 
  Users, 
  ArrowLeft, 
  Award, 
  Flame, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  Crown, 
  Coins, 
  Gavel, 
  Plus, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { dotaAuctionEngine, DotaAuctionPlayer, DotaAuctionTeam } from '../domain/dotaAuctionEngine';
import { dotaPlayerRegistry } from '../domain/dotaPlayerEngine';
import { SelectDropdown, DropdownOption } from '../components/ui/Dropdown';

interface CaptainSelectionViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
  tournamentId?: string;
}

export function CaptainSelectionView({ 
  onNavigate, 
  tournamentId = 'purple-bean-test-cup' 
}: CaptainSelectionViewProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer';

  const [teams, setTeams] = useState<DotaAuctionTeam[]>(() => dotaAuctionEngine.getTeams());
  const [candidates, setCandidates] = useState<DotaAuctionPlayer[]>(() => dotaAuctionEngine.getEligibleCaptainCandidates());
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [teamColor, setTeamColor] = useState('#7C3AED');
  const [teamLogo, setTeamLogo] = useState('⚡');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      setTeams(dotaAuctionEngine.getTeams());
      setCandidates(dotaAuctionEngine.getEligibleCaptainCandidates());
    };
    syncState();
    return dotaAuctionEngine.subscribe(syncState);
  }, []);

  const handleAppointCaptain = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!selectedCandidateId) {
      setErrorMsg('Please select a verified contender from the candidates list.');
      return;
    }

    if (!teamName.trim() || !teamTag.trim()) {
      setErrorMsg('Please provide a team name and 2-4 character team tag.');
      return;
    }

    const res = tournamentService.appointDotaCaptain(selectedCandidateId, {
      teamName: teamName.trim(),
      tag: teamTag.trim().toUpperCase(),
      color: teamColor,
      logo: teamLogo
    });

    if (res.success && res.team) {
      setSuccessMsg(`✓ Appointed ${res.team.captainIgn} as captain of ${res.team.name}! Team initialized with ${res.team.startingCredits} credits and 1/5 primary roster.`);
      setSelectedCandidateId('');
      setTeamName('');
      setTeamTag('');
    } else {
      setErrorMsg(res.error || 'Failed to appoint captain.');
    }
  };

  const selectedCandidate = candidates.find(c => c.id === selectedCandidateId);
  const candidateProfile = selectedCandidate ? dotaPlayerRegistry.getPlayer(selectedCandidate.id) : undefined;

  return (
    <div className="space-y-8 pb-16 font-mono">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => onNavigate('organiser_dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-black uppercase text-black hover:underline cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Organiser Dashboard</span>
        </button>

        <button
          onClick={() => onNavigate('auction')}
          className="inline-flex items-center gap-2 text-xs font-black uppercase text-white bg-[#7C3AED] hover:bg-purple-700 px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          <Gavel className="w-4 h-4 text-[#FFE600]" />
          <span>Go to Live Player Auction</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Header Banner */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 text-stone-600 text-xs uppercase font-black">
          <Crown className="w-4 h-4 text-[#7C3AED]" />
          <span>DOTA 2 PHASE 2 · CAPTAIN SELECTION & FRANCHISE FORMATION</span>
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase text-black font-sans leading-none">
              TEAM CAPTAINS PANEL
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 max-w-2xl mt-2 leading-relaxed">
              Designated franchise captains selected strictly from verified contenders. Appointing a captain creates the official tournament team with the captain placed directly into the 1/5 mandatory primary roster.
            </p>
          </div>
          <div className="bg-[#FFF9E6] border-2 border-black p-3 text-xs space-y-1 shrink-0">
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Confirmed Teams:</span>
              <span className="font-black text-black">{teams.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Verified Candidates:</span>
              <span className="font-black text-[#7C3AED]">{candidates.length}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-stone-500">Starting Purse:</span>
              <span className="font-black text-emerald-700">1,000 Credits</span>
            </div>
          </div>
        </div>
      </div>

      {/* ORGANISER CAPTAIN APPOINTMENT DESK */}
      {isOrganiser ? (
        <div className="bg-[#FFFBEB] border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#7C3AED]" />
              <h2 className="text-xl font-black uppercase text-black font-sans">
                Appoint New Franchise Captain
              </h2>
            </div>
            <span className="bg-[#FFE600] border border-black px-2 py-0.5 text-[10px] font-black uppercase">
              Organiser Action Only
            </span>
          </div>

          <form onSubmit={handleAppointCaptain} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contender Selection & Review */}
              <div className="space-y-4">
                <SelectDropdown
                  label="1. Select Verified Contender"
                  value={selectedCandidateId}
                  onChange={(val) => setSelectedCandidateId(val)}
                  options={[
                    { value: '', label: `-- Choose verified contender (${candidates.length} available) --` },
                    ...candidates.map(c => ({
                      value: c.id,
                      label: `${c.username} · MMR ${c.tournamentMmr.toLocaleString()} · ${c.primaryRole.split(' — ')[1] || c.primaryRole}`,
                      badge: `R: ${c.rating}`
                    }))
                  ]}
                  className="w-full"
                  placeholder="-- Choose verified contender --"
                />

                {/* Candidate Deep Review Card */}
                {selectedCandidate && (
                  <div className="bg-white border-2 border-black p-4 space-y-3 shadow-[3px_3px_0px_0px_#000]">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#70FFAF] border-2 border-black flex items-center justify-center text-2xl">
                        {selectedCandidate.avatar}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base uppercase text-black">{selectedCandidate.username}</h4>
                          <span className="bg-[#70FFAF] border border-black px-1 text-[9px] font-black uppercase">VERIFIED</span>
                        </div>
                        <span className="text-[10px] text-stone-500">{selectedCandidate.city || 'India'} · {selectedCandidate.primaryRole}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1 border-t border-black/10">
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Tournament MMR</span>
                        <span className="font-black text-[#7C3AED] text-sm">{selectedCandidate.tournamentMmr.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Purple Bean Rating</span>
                        <span className="font-black text-black text-sm">{selectedCandidate.rating}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Secondary Role</span>
                        <span className="font-bold text-stone-700">{selectedCandidate.secondaryRole || 'None'}</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Captain History</span>
                        <span className="font-bold text-black">{candidateProfile?.captainRecord?.tournamentsCaptained || 0} Events Led</span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Match Win Rate</span>
                        <span className="font-bold text-emerald-700">
                          {candidateProfile?.captainRecord ? `${candidateProfile.captainRecord.matchWins}W - ${candidateProfile.captainRecord.matchLosses}L` : '38W - 12L'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-500 block text-[9px] uppercase">Tournament Snapshots</span>
                        <span className="font-bold text-stone-600">{candidateProfile?.tournamentSnapshots?.length || 1} Past Cups</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Franchise Team Metadata */}
              <div className="space-y-4">
                <label className="block text-xs font-black uppercase text-black">
                  2. Configure Franchise Team
                </label>

                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Team Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Mumbai Mavericks, Bengaluru Blaze"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full bg-white border-2 border-black p-2 text-xs font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Tag (2-4 chars)</span>
                      <input
                        type="text"
                        maxLength={4}
                        placeholder="MM"
                        value={teamTag}
                        onChange={(e) => setTeamTag(e.target.value.toUpperCase())}
                        className="w-full bg-white border-2 border-black p-2 text-xs font-black uppercase"
                      />
                    </div>
                    <div>
                      <SelectDropdown
                        label="Badge Emoji"
                        value={teamLogo}
                        onChange={(val) => setTeamLogo(val)}
                        options={[
                          { value: '⚡', label: '⚡ Lightning' },
                          { value: '🔥', label: '🔥 Fire' },
                          { value: '🛡️', label: '🛡️ Shield' },
                          { value: '👑', label: '👑 Crown' },
                          { value: '🐯', label: '🐯 Tiger' },
                          { value: '🦅', label: '🦅 Eagle' },
                          { value: '⚔️', label: '⚔️ Swords' }
                        ]}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-stone-600 block mb-1">Color</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={teamColor}
                          onChange={(e) => setTeamColor(e.target.value)}
                          className="w-8 h-8 border-2 border-black cursor-pointer p-0"
                        />
                        <span className="text-[10px] font-mono">{teamColor}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-black text-[11px] text-stone-600 leading-relaxed">
                    <strong>Rule:</strong> The newly appointed captain occupies the first mandatory slot (1/5) in the primary roster. The remaining 4 contenders will be drafted during the live player auction.
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-6 py-2.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Appoint Captain & Create Team</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="p-4 bg-white border-2 border-black text-xs flex items-center justify-between">
          <div className="flex items-center gap-2 text-stone-600">
            <Shield className="w-4 h-4 text-[#7C3AED]" />
            <span>Viewing in Contender / Spectator Mode. Captain appointment is restricted to tournament directors.</span>
          </div>
        </div>
      )}

      {/* APPOINTED TEAMS & CAPTAINS GRID */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="text-xl font-black uppercase text-black font-sans">
              Confirmed Franchise Teams ({teams.length})
            </h2>
          </div>
          <span className="text-xs text-stone-500 font-bold">
            Mandatory Primary Roster: 5/5 (Captain + 4 Drafted)
          </span>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white border-[3px] border-black p-8 text-center text-stone-500 text-xs">
            No captains appointed yet. Organisers must select at least 2 captains to initiate the auction.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map(team => (
              <div
                key={team.id}
                className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b-2 border-black pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{team.logo}</span>
                      <h3 className="font-black text-lg text-black uppercase font-sans">
                        {team.name}
                      </h3>
                    </div>
                    <span 
                      className="px-2 py-0.5 border border-black text-[10px] font-black uppercase"
                      style={{ backgroundColor: team.color || '#FFE600' }}
                    >
                      [{team.tag}]
                    </span>
                  </div>

                  {/* Captain Info */}
                  <div className="bg-stone-50 border-2 border-black p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-500 text-[10px] uppercase font-bold flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5 text-[#7C3AED]" />
                        <span>Team Captain</span>
                      </span>
                      <span className="bg-[#70FFAF] border border-black px-1.5 py-0.2 text-[9px] font-black uppercase">
                        1/5 Primary
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-black text-black text-sm">{team.captainIgn}</span>
                      <span className="text-xs font-mono font-bold text-[#7C3AED]">
                        MMR: {team.primaryRoster[0]?.tournamentMmr?.toLocaleString() || '7,400'}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-600">
                      Role: <strong className="text-purple-700">{team.primaryRoster[0]?.primaryRole?.split(' — ')[1] || team.primaryRoster[0]?.primaryRole}</strong>
                    </div>
                  </div>

                  {/* Purse & Roster Tracker */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 bg-[#FFF9E6] border border-black">
                      <span className="text-stone-500 block text-[9px] uppercase font-bold">Purse Remaining</span>
                      <span className="font-black text-emerald-800 text-sm">{team.remainingCredits.toLocaleString()} Cr</span>
                    </div>
                    <div className="p-2.5 bg-[#F3E8FF] border border-black">
                      <span className="text-stone-500 block text-[9px] uppercase font-bold">Roster Filled</span>
                      <span className="font-black text-[#7C3AED] text-sm">{team.primaryRoster.length}/5 Primary</span>
                    </div>
                  </div>

                  {/* Roster list */}
                  <div className="border border-black p-2.5 bg-stone-50 space-y-1.5 text-[11px]">
                    <span className="text-[9px] font-black uppercase text-stone-500 block">Roster Breakdown</span>
                    {team.primaryRoster.map((player, idx) => (
                      <div key={player.id} className="flex justify-between items-center text-xs">
                        <span className="truncate">
                          {idx === 0 ? '👑 ' : `${idx + 1}. `}<strong>{player.username}</strong>
                        </span>
                        <span className="text-[10px] text-stone-500 font-mono">
                          {player.tournamentMmr.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {Array.from({ length: Math.max(0, 5 - team.primaryRoster.length) }).map((_, i) => (
                      <div key={i} className="text-stone-400 italic text-[10px]">
                        Slot {team.primaryRoster.length + i + 1}: Unfilled (Live Draft)
                      </div>
                    ))}
                    {team.standIns.length > 0 && (
                      <div className="pt-1 border-t border-black/10 text-stone-600 text-[10px]">
                        Stand-in: <strong>{team.standIns[0].username}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-black/10 flex justify-between items-center text-[10px]">
                  <span className="text-stone-500 font-bold">Starting Purse: {team.startingCredits}</span>
                  <span className="text-emerald-700 font-black">Auction Ready</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
