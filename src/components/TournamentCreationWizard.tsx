/**
 * Purple Bean Gaming — Tournament Creation Wizard
 * 
 * 10-step guided wizard allowing tournament organizers to configure
 * and publish new tournaments across any supported game and format
 * without code changes.
 */

import React, { useState } from 'react';
import { 
  Trophy, 
  Gamepad2, 
  Users, 
  Shield, 
  Coins, 
  Calendar, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  Settings,
  HelpCircle,
  AlertCircle
} from 'lucide-react';
import { TournamentConfig, validateTournamentConfig, formatINR } from '../domain/tournamentConfig';
import { getAllGameDefinitions, getGameDefinition } from '../domain/gameDefinitions';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface TournamentCreationWizardProps {
  onTournamentCreated: (config: TournamentConfig) => void;
  onCancel: () => void;
}

export const TournamentCreationWizard: React.FC<TournamentCreationWizardProps> = ({
  onTournamentCreated,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const games = getAllGameDefinitions();

  // Step 1: Basics
  const [name, setName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('dota2');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('Pan India');
  const [locationType, setLocationType] = useState<'ONLINE' | 'LAN'>('ONLINE');
  const [city, setCity] = useState('Bengaluru');

  // Step 2: Entry Mode
  const [registrationMode, setRegistrationMode] = useState<'INDIVIDUAL' | 'PREMADE_TEAM'>('INDIVIDUAL');

  // Step 3: Team Rules
  const [teamCount, setTeamCount] = useState(4);
  const [primaryRosterSize, setPrimaryRosterSize] = useState(5);
  const [captainCountsTowardRoster, setCaptainCountsTowardRoster] = useState(true);
  const [substituteSlots, setSubstituteSlots] = useState(1);
  const [substituteRequired, setSubstituteRequired] = useState(false);

  // Step 4: Team Formation
  const [teamFormationMode, setTeamFormationMode] = useState<'AUCTION' | 'DRAFT' | 'ORGANIZER_ASSIGNMENT' | 'PREMADE'>('AUCTION');

  // Step 5: Competition Format
  const [competitionFormat, setCompetitionFormat] = useState<
    'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'GROUPS_KNOCKOUT'
  >('SINGLE_ELIMINATION');

  // Step 6: Match Settings
  const [defaultSeries, setDefaultSeries] = useState<'BO1' | 'BO3' | 'BO5' | 'Best of 3'>('BO3');
  const [grandFinalSeries, setGrandFinalSeries] = useState<'BO1' | 'BO3' | 'BO5'>('BO5');
  const [seedingMethod, setSeedingMethod] = useState<'RATING_BASED' | 'MANUAL' | 'RANDOM'>('RATING_BASED');

  // Step 7: Auction (if applicable)
  const [startingCredits, setStartingCredits] = useState(1000);
  const [minimumBid, setMinimumBid] = useState(10);
  const [bidIncrement, setBidIncrement] = useState(10);
  const [reservePerSlot, setReservePerSlot] = useState(10);

  // Step 8: Prizes
  const [totalPrizePoolINR, setTotalPrizePoolINR] = useState(50000);

  // Step 9: Registration Dates & Integrity
  const [openDate, setOpenDate] = useState('2026-10-01');
  const [closeDate, setCloseDate] = useState('2026-10-14');
  const [verificationRequired, setVerificationRequired] = useState(true);
  const [organizerApprovalRequired, setOrganizerApprovalRequired] = useState(true);
  const [minMmr, setMinMmr] = useState(0);

  // When game changes, synchronize default roster size
  const handleGameSelect = (gId: string) => {
    setSelectedGameId(gId);
    const def = getGameDefinition(gId);
    setPrimaryRosterSize(def.defaultRosterSize);
  };

  // Build the complete config
  const selectedGameDef = getGameDefinition(selectedGameId);

  const buildConfig = (): TournamentConfig => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const tournamentId = slug ? `pb-${slug}-${Date.now().toString().slice(-4)}` : `pb-tourney-${Date.now()}`;

    // Compute prize split
    const p1 = Math.round(totalPrizePoolINR * 0.6);
    const p2 = Math.round(totalPrizePoolINR * 0.25);
    const p3 = Math.round(totalPrizePoolINR * 0.15);

    return {
      identity: {
        tournamentId,
        name: name.trim() || `${selectedGameDef.name} Tournament`,
        gameId: selectedGameDef.id,
        gameName: selectedGameDef.name,
        description: description || `Competitive ${selectedGameDef.name} tournament on Purple Bean Gaming.`,
        region,
        locationType,
        city: locationType === 'LAN' ? city : undefined,
        bannerUrl: selectedGameDef.bannerImage
      },
      registration: {
        registrationMode,
        openDate,
        closeDate,
        maxParticipants: registrationMode === 'INDIVIDUAL' ? teamCount * primaryRosterSize + 6 : teamCount,
        eligibilityRules: {
          minMmrOrRank: minMmr,
          regionLocked: region !== 'Pan India',
          requireKyc: verificationRequired
        }
      },
      teamFormation: {
        mode: registrationMode === 'PREMADE_TEAM' ? 'PREMADE' : teamFormationMode,
        numberOfTeams: teamCount
      },
      roster: {
        primaryRosterSize,
        captainCountsTowardRoster,
        substituteSlots,
        substituteRequired
      },
      auction: teamFormationMode === 'AUCTION' && registrationMode === 'INDIVIDUAL' ? {
        enabled: true,
        startingCredits,
        minimumBid,
        bidIncrement,
        reservePerRemainingSlot: reservePerSlot,
        nominationTimerSeconds: 30,
        bidTimerSeconds: 15
      } : undefined,
      competition: {
        format: competitionFormat,
        defaultSeriesFormat: defaultSeries,
        roundOverrides: {
          'Grand Final': grandFinalSeries
        },
        seedingMethod,
        groupsConfig: competitionFormat === 'GROUPS_KNOCKOUT' ? {
          groupCount: 2,
          advancePerGroup: 2
        } : undefined
      },
      prizes: {
        totalPrizePoolINR,
        placementDistribution: [
          { placement: '1st Place (Champion)', percentage: 60, amountINR: p1 },
          { placement: '2nd Place (Runner-up)', percentage: 25, amountINR: p2 },
          { placement: '3rd Place', percentage: 15, amountINR: p3 }
        ]
      },
      integrity: {
        verificationRequired,
        organizerApprovalRequired
      }
    };
  };

  const handleNext = () => {
    if (currentStep === 1 && !name.trim()) {
      alert('Please enter a tournament name to continue.');
      return;
    }
    // Skip Step 7 (Auction) if not individual auction
    if (currentStep === 6 && (registrationMode === 'PREMADE_TEAM' || teamFormationMode !== 'AUCTION')) {
      setCurrentStep(8);
      return;
    }
    if (currentStep < 10) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 8 && (registrationMode === 'PREMADE_TEAM' || teamFormationMode !== 'AUCTION')) {
      setCurrentStep(6);
      return;
    }
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    const config = buildConfig();
    const val = validateTournamentConfig(config);
    if (!val.valid) {
      alert(`Configuration validation errors:\n• ${val.errors.join('\n• ')}`);
      return;
    }
    onTournamentCreated(config);
  };

  const stepsList = [
    'Basics',
    'Entry',
    'Roster Rules',
    'Formation',
    'Format',
    'Match Rules',
    'Auction',
    'Prizes',
    'Registration',
    'Review'
  ];

  return (
    <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000] p-6 max-w-4xl mx-auto my-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-6">
        <div>
          <span className="bg-[#FFE600] text-black border-2 border-black px-2 py-0.5 font-mono text-xs font-black uppercase">
            TOURNAMENT ARCHITECT
          </span>
          <h2 className="text-2xl font-black uppercase tracking-tight mt-1">Create New Tournament</h2>
          <p className="text-xs text-stone-600 font-mono">
            Configures game rules, registration model, team formation & bracket logic.
          </p>
        </div>
        <button
          onClick={onCancel}
          className="border-2 border-black px-3 py-1 font-mono text-xs font-bold hover:bg-stone-100"
        >
          Cancel
        </button>
      </div>

      {/* Stepper Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-[11px] font-mono font-bold mb-2">
          <span>STEP {currentStep} OF 10: {stepsList[currentStep - 1].toUpperCase()}</span>
          <span>{Math.round((currentStep / 10) * 100)}% COMPLETE</span>
        </div>
        <div className="w-full bg-stone-200 h-3 border-2 border-black p-0.5">
          <div 
            className="bg-[#7C3AED] h-full transition-all duration-300"
            style={{ width: `${(currentStep / 10) * 100}%` }}
          />
        </div>
        <div className="grid grid-cols-5 md:grid-cols-10 gap-1 mt-2">
          {stepsList.map((st, i) => (
            <button
              key={st}
              onClick={() => setCurrentStep(i + 1)}
              className={`text-[9px] font-mono py-1 px-0.5 border text-center truncate ${
                currentStep === i + 1 
                  ? 'bg-black text-[#FFE600] font-black border-black'
                  : currentStep > i + 1
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold'
                  : 'bg-stone-50 text-stone-400 border-stone-200'
              }`}
            >
              {i + 1}. {st}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="min-h-[360px]">
        {/* STEP 1: BASICS */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Gamepad2 className="w-4 h-4 text-[#7C3AED]" />
              Step 1: Tournament Identity & Game
            </h3>

            <div>
              <label className="block font-mono text-xs font-black uppercase mb-1">
                Tournament Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. India Dota Open 2026 or Bengaluru Dota Masters"
                className="w-full border-2 border-black p-2.5 font-bold font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
              />
            </div>

            <div>
              <label className="block font-mono text-xs font-black uppercase mb-1">
                Select Game Title <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {games.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleGameSelect(g.id)}
                    className={`p-3 border-2 text-left font-mono transition-all ${
                      selectedGameId === g.id
                        ? 'border-black bg-[#FFE600] shadow-[3px_3px_0px_0px_#000] font-black'
                        : 'border-stone-300 hover:border-black bg-stone-50 text-stone-700'
                    }`}
                  >
                    <div className="text-2xl mb-1">{g.iconImage}</div>
                    <div className="text-xs font-black leading-tight">{g.name}</div>
                    <div className="text-[10px] text-stone-500 uppercase mt-0.5">{g.competitionType}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <SelectDropdown
                  label="Region"
                  value={region}
                  onChange={(val) => setRegion(val)}
                  options={[
                    { value: 'Pan India', label: 'Pan India' },
                    { value: 'South India', label: 'South India' },
                    { value: 'West India', label: 'West India' },
                    { value: 'North India', label: 'North India' },
                    { value: 'East India', label: 'East India' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Environment"
                  value={locationType}
                  onChange={(val) => setLocationType(val as 'ONLINE' | 'LAN')}
                  options={[
                    { value: 'ONLINE', label: 'Online Tournament' },
                    { value: 'LAN', label: 'LAN / Venue Event' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Host City"
                  value={city}
                  onChange={(val) => setCity(val)}
                  options={[
                    { value: 'Bengaluru', label: 'Bengaluru' },
                    { value: 'Mumbai', label: 'Mumbai' },
                    { value: 'Delhi', label: 'Delhi' },
                    { value: 'Hyderabad', label: 'Hyderabad' },
                    { value: 'Chennai', label: 'Chennai' },
                    { value: 'Pune', label: 'Pune' },
                    { value: 'Kolkata', label: 'Kolkata' },
                    { value: 'Ahmedabad', label: 'Ahmedabad' }
                  ]}
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs font-black uppercase mb-1">Description / Brief</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the tournament format, rules, and expectations..."
                rows={2}
                className="w-full border-2 border-black p-2 font-mono text-xs"
              />
            </div>
          </div>
        )}

        {/* STEP 2: ENTRY MODE */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Users className="w-4 h-4 text-[#7C3AED]" />
              Step 2: Supported Registration Model
            </h3>
            <p className="text-xs font-mono text-stone-600">
              Purple Bean Gaming supports both individual player registrations and premade team applications.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRegistrationMode('INDIVIDUAL');
                  setTeamFormationMode('AUCTION');
                }}
                className={`p-5 border-4 text-left font-mono transition-all ${
                  registrationMode === 'INDIVIDUAL'
                    ? 'border-black bg-[#FFE600] shadow-[5px_5px_0px_0px_#000]'
                    : 'border-stone-300 hover:border-black bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm uppercase">MODEL A</span>
                  <span className="text-xs bg-black text-white px-2 py-0.5">INDIVIDUAL PLAYERS</span>
                </div>
                <h4 className="font-black text-lg mb-1">Individual Registration</h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  Players register as solo competitors. Roster creation is conducted via Captain Auction, Snake Draft, or Organizer Team Assignment.
                </p>
                <div className="mt-4 text-[11px] font-bold text-stone-600">
                  Ideal for: Captain Auction cups, Community leagues, Solo tournaments.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRegistrationMode('PREMADE_TEAM');
                  setTeamFormationMode('PREMADE');
                }}
                className={`p-5 border-4 text-left font-mono transition-all ${
                  registrationMode === 'PREMADE_TEAM'
                    ? 'border-black bg-[#FFE600] shadow-[5px_5px_0px_0px_#000]'
                    : 'border-stone-300 hover:border-black bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm uppercase">MODEL B</span>
                  <span className="text-xs bg-[#7C3AED] text-white px-2 py-0.5">PREMADE SQUADS</span>
                </div>
                <h4 className="font-black text-lg mb-1">Premade Team Registration</h4>
                <p className="text-xs text-stone-700 leading-relaxed">
                  Captains or managers submit their complete squad (primary roster + optional substitutes). Organizer reviews and approves the full roster before seeding.
                </p>
                <div className="mt-4 text-[11px] font-bold text-stone-600">
                  Ideal for: India Dota Open, National Qualifiers, Pro/Semi-pro team cups.
                </div>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: TEAM RULES */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Shield className="w-4 h-4 text-[#7C3AED]" />
              Step 3: Team Count & Game-Aware Roster Rules
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <SelectDropdown
                  label="Number of Teams"
                  value={String(teamCount)}
                  onChange={(val) => setTeamCount(Number(val))}
                  options={[
                    { value: '2', label: '2 Teams (Direct Finals)' },
                    { value: '3', label: '3 Teams (Single Elim with BYE)' },
                    { value: '4', label: '4 Teams (Semifinals + Finals)' },
                    { value: '6', label: '6 Teams (Quarters with 2 BYEs)' },
                    { value: '8', label: '8 Teams (Standard Bracket)' },
                    { value: '12', label: '12 Teams' },
                    { value: '16', label: '16 Teams (Championship Size)' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Primary Roster Size ({selectedGameDef.name} Default: {selectedGameDef.defaultRosterSize})
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={primaryRosterSize}
                  onChange={(e) => setPrimaryRosterSize(Number(e.target.value))}
                  className="w-full border-2 border-black p-2 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Substitute / Stand-in Slots Allowed"
                  value={String(substituteSlots)}
                  onChange={(val) => setSubstituteSlots(Number(val))}
                  options={[
                    { value: '0', label: '0 (Strict primary roster only)' },
                    { value: '1', label: '1 Optional Substitute' },
                    { value: '2', label: '2 Optional Substitutes' }
                  ]}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="subReq"
                  checked={substituteRequired}
                  onChange={(e) => setSubstituteRequired(e.target.checked)}
                  className="w-4 h-4 border-2 border-black text-[#7C3AED]"
                />
                <label htmlFor="subReq" className="font-mono text-xs font-bold">
                  Substitute is Mandatory to finalize roster
                </label>
              </div>
            </div>

            <div className="p-3 bg-stone-100 border-2 border-black font-mono text-xs">
              <span className="font-black text-[#7C3AED]">Game Profile:</span> {selectedGameDef.name} utilizes {selectedGameDef.roles.map(r => r.shortName).join(' · ')}.
            </div>
          </div>
        )}

        {/* STEP 4: TEAM FORMATION */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Settings className="w-4 h-4 text-[#7C3AED]" />
              Step 4: Team Formation Model
            </h3>

            {registrationMode === 'PREMADE_TEAM' ? (
              <div className="p-6 bg-stone-50 border-2 border-black font-mono">
                <h4 className="font-black text-sm uppercase text-emerald-800 mb-1">Premade Team Application Flow</h4>
                <p className="text-xs text-stone-600 mb-3">
                  Teams submit complete rosters with their captain, assigned roles, and substitutes directly.
                </p>
                <div className="text-xs font-bold bg-white border border-stone-300 p-3">
                  Formation Mode: <span className="bg-[#FFE600] px-1.5 py-0.5 border border-black">PREMADE REGISTRATION</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTeamFormationMode('AUCTION')}
                  className={`p-4 border-2 text-left font-mono ${
                    teamFormationMode === 'AUCTION'
                      ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                      : 'border-stone-300 bg-stone-50'
                  }`}
                >
                  <h4 className="text-sm font-black mb-1">Captain Auction</h4>
                  <p className="text-xs text-stone-600 font-normal">
                    Captains bid credits live to draft verified players into primary and optional stand-in slots.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTeamFormationMode('DRAFT')}
                  className={`p-4 border-2 text-left font-mono ${
                    teamFormationMode === 'DRAFT'
                      ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                      : 'border-stone-300 bg-stone-50'
                  }`}
                >
                  <h4 className="text-sm font-black mb-1">Snake Draft</h4>
                  <p className="text-xs text-stone-600 font-normal">
                    Captains take turns selecting players round-by-round in reverse order (1-2-3-3-2-1).
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTeamFormationMode('ORGANIZER_ASSIGNMENT')}
                  className={`p-4 border-2 text-left font-mono ${
                    teamFormationMode === 'ORGANIZER_ASSIGNMENT'
                      ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                      : 'border-stone-300 bg-stone-50'
                  }`}
                >
                  <h4 className="text-sm font-black mb-1">Organizer Assignment</h4>
                  <p className="text-xs text-stone-600 font-normal">
                    Tournament organizers balance MMR/rating and assign players directly into teams.
                  </p>
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: COMPETITION FORMAT */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Trophy className="w-4 h-4 text-[#7C3AED]" />
              Step 5: Competition Format
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCompetitionFormat('SINGLE_ELIMINATION')}
                className={`p-4 border-2 text-left font-mono ${
                  competitionFormat === 'SINGLE_ELIMINATION'
                    ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                    : 'border-stone-300 bg-stone-50'
                }`}
              >
                <h4 className="text-sm font-black mb-1">Single Elimination (Knockout)</h4>
                <p className="text-xs text-stone-600 font-normal">
                  Lose one match and the team is eliminated. Supports any team count with automatic BYE allocation.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCompetitionFormat('DOUBLE_ELIMINATION')}
                className={`p-4 border-2 text-left font-mono ${
                  competitionFormat === 'DOUBLE_ELIMINATION'
                    ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                    : 'border-stone-300 bg-stone-50'
                }`}
              >
                <h4 className="text-sm font-black mb-1">Double Elimination</h4>
                <p className="text-xs text-stone-600 font-normal">
                  Features Upper Bracket, Lower Bracket, and Grand Final. Losers in Upper bracket drop to Lower bracket.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCompetitionFormat('ROUND_ROBIN')}
                className={`p-4 border-2 text-left font-mono ${
                  competitionFormat === 'ROUND_ROBIN'
                    ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                    : 'border-stone-300 bg-stone-50'
                }`}
              >
                <h4 className="text-sm font-black mb-1">Round Robin (League)</h4>
                <p className="text-xs text-stone-600 font-normal">
                  Every team plays against all other teams. Points and map differential determine final rankings.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCompetitionFormat('GROUPS_KNOCKOUT')}
                className={`p-4 border-2 text-left font-mono ${
                  competitionFormat === 'GROUPS_KNOCKOUT'
                    ? 'border-black bg-[#FFE600] font-black shadow-[3px_3px_0px_0px_#000]'
                    : 'border-stone-300 bg-stone-50'
                }`}
              >
                <h4 className="text-sm font-black mb-1">Groups + Knockout Playoffs</h4>
                <p className="text-xs text-stone-600 font-normal">
                  Teams are partitioned into groups for initial round robin. Top teams advance to Single Elimination playoffs.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: MATCH SETTINGS */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              Step 6: Series Formats & Seeding Method
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <SelectDropdown
                  label="Default Series Format"
                  value={defaultSeries}
                  onChange={(val) => setDefaultSeries(val as any)}
                  options={[
                    { value: 'BO1', label: 'Best of 1 (BO1)' },
                    { value: 'BO3', label: 'Best of 3 (BO3)' },
                    { value: 'BO5', label: 'Best of 5 (BO5)' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Grand Final Override"
                  value={grandFinalSeries}
                  onChange={(val) => setGrandFinalSeries(val as any)}
                  options={[
                    { value: 'BO3', label: 'Best of 3 (BO3)' },
                    { value: 'BO5', label: 'Best of 5 (BO5)' }
                  ]}
                  className="w-full"
                />
              </div>

              <div>
                <SelectDropdown
                  label="Bracket Seeding Method"
                  value={seedingMethod}
                  onChange={(val) => setSeedingMethod(val as any)}
                  options={[
                    { value: 'RATING_BASED', label: 'Rating / MMR-Based Seeding' },
                    { value: 'RANDOM', label: 'Random Draw Seeding' },
                    { value: 'MANUAL', label: 'Manual Organizer Seeding' }
                  ]}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: AUCTION (IF APPLICABLE) */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Coins className="w-4 h-4 text-[#7C3AED]" />
              Step 7: Auction Rules & Purse Reserves
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Starting Purse (Credits)
                </label>
                <input
                  type="number"
                  value={startingCredits}
                  onChange={(e) => setStartingCredits(Number(e.target.value))}
                  className="w-full border-2 border-black p-2 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Minimum Opening Bid
                </label>
                <input
                  type="number"
                  value={minimumBid}
                  onChange={(e) => setMinimumBid(Number(e.target.value))}
                  className="w-full border-2 border-black p-2 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Bid Increment
                </label>
                <input
                  type="number"
                  value={bidIncrement}
                  onChange={(e) => setBidIncrement(Number(e.target.value))}
                  className="w-full border-2 border-black p-2 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">
                  Reserve Per Slot
                </label>
                <input
                  type="number"
                  value={reservePerSlot}
                  onChange={(e) => setReservePerSlot(Number(e.target.value))}
                  className="w-full border-2 border-black p-2 font-mono text-sm font-bold"
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 border-2 border-amber-400 font-mono text-xs text-amber-900">
              <span className="font-bold">Reserve Purse Invariant:</span> Captains must maintain at least {reservePerSlot} credits for each unfilled mandatory roster slot.
            </div>
          </div>
        )}

        {/* STEP 8: PRIZES */}
        {currentStep === 8 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Trophy className="w-4 h-4 text-[#7C3AED]" />
              Step 8: Prize Pool (INR) & Placement Payouts
            </h3>

            <div>
              <label className="block font-mono text-xs font-black uppercase mb-1">
                Total Guaranteed Prize Pool (₹ INR)
              </label>
              <input
                type="number"
                step={5000}
                value={totalPrizePoolINR}
                onChange={(e) => setTotalPrizePoolINR(Number(e.target.value))}
                className="w-full border-2 border-black p-2.5 font-mono text-base font-black text-[#7C3AED]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-3 bg-stone-100 border-2 border-black font-mono">
                <span className="text-[10px] text-stone-500 uppercase font-black">CHAMPION (1ST)</span>
                <div className="text-lg font-black text-emerald-700">{formatINR(Math.round(totalPrizePoolINR * 0.6))}</div>
                <div className="text-[11px] text-stone-600">60% of prize pool</div>
              </div>

              <div className="p-3 bg-stone-100 border-2 border-black font-mono">
                <span className="text-[10px] text-stone-500 uppercase font-black">RUNNER-UP (2ND)</span>
                <div className="text-lg font-black text-stone-900">{formatINR(Math.round(totalPrizePoolINR * 0.25))}</div>
                <div className="text-[11px] text-stone-600">25% of prize pool</div>
              </div>

              <div className="p-3 bg-stone-100 border-2 border-black font-mono">
                <span className="text-[10px] text-stone-500 uppercase font-black">3RD PLACE</span>
                <div className="text-lg font-black text-amber-700">{formatINR(Math.round(totalPrizePoolINR * 0.15))}</div>
                <div className="text-[11px] text-stone-600">15% of prize pool</div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 9: REGISTRATION DATES & INTEGRITY */}
        {currentStep === 9 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2">
              <Calendar className="w-4 h-4 text-[#7C3AED]" />
              Step 9: Registration Window & Integrity Checks
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">Registration Open Date</label>
                <input
                  type="date"
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                  className="w-full border-2 border-black p-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-black uppercase mb-1">Registration Close Date</label>
                <input
                  type="date"
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-full border-2 border-black p-2 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 font-mono text-xs font-bold">
                <input
                  type="checkbox"
                  checked={verificationRequired}
                  onChange={(e) => setVerificationRequired(e.target.checked)}
                  className="w-4 h-4 border-2 border-black text-[#7C3AED]"
                />
                Require Organizer Verification / KYC approval before eligibility
              </label>

              <label className="flex items-center gap-2 font-mono text-xs font-bold">
                <input
                  type="checkbox"
                  checked={organizerApprovalRequired}
                  onChange={(e) => setOrganizerApprovalRequired(e.target.checked)}
                  className="w-4 h-4 border-2 border-black text-[#7C3AED]"
                />
                Require Staff Approval for team name & logo submissions
              </label>
            </div>
          </div>
        )}

        {/* STEP 10: REVIEW & CONFIRMATION */}
        {currentStep === 10 && (
          <div className="space-y-4">
            <h3 className="font-mono text-sm font-black uppercase flex items-center gap-2 border-b-2 border-stone-200 pb-2 text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Step 10: Review Tournament Configuration
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs">
              <div className="p-3 bg-stone-50 border-2 border-black space-y-1.5">
                <div className="text-[10px] text-stone-500 uppercase font-black">Identity</div>
                <div><span className="font-bold">Name:</span> {name || 'Untitled Tournament'}</div>
                <div><span className="font-bold">Game:</span> {selectedGameDef.name} ({selectedGameDef.competitionType})</div>
                <div><span className="font-bold">Region:</span> {region} · {locationType}</div>
                <div><span className="font-bold">Prize Pool:</span> {formatINR(totalPrizePoolINR)}</div>
              </div>

              <div className="p-3 bg-stone-50 border-2 border-black space-y-1.5">
                <div className="text-[10px] text-stone-500 uppercase font-black">Structure & Competition</div>
                <div><span className="font-bold">Registration:</span> {registrationMode === 'INDIVIDUAL' ? 'Individual Players' : 'Premade Teams'}</div>
                <div><span className="font-bold">Team Formation:</span> {registrationMode === 'PREMADE_TEAM' ? 'Premade Squads' : teamFormationMode}</div>
                <div><span className="font-bold">Teams:</span> {teamCount} Teams</div>
                <div><span className="font-bold">Roster:</span> {primaryRosterSize} Primary + {substituteSlots} Substitute</div>
                <div><span className="font-bold">Format:</span> {competitionFormat} ({defaultSeries})</div>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border-2 border-emerald-400 font-mono text-xs text-emerald-900">
              ✓ Ready to publish to Purple Bean Gaming. Organizers will be able to manage registration, verify participants, and run brackets directly in the Organiser Workspace.
            </div>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between border-t-4 border-black pt-4 mt-6">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`border-2 border-black px-4 py-2 font-mono text-xs font-black uppercase flex items-center gap-1.5 ${
            currentStep === 1
              ? 'opacity-40 cursor-not-allowed bg-stone-100'
              : 'hover:bg-stone-100 cursor-pointer shadow-[2px_2px_0px_0px_#000]'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>

        {currentStep < 10 ? (
          <button
            type="button"
            onClick={handleNext}
            className="bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black px-5 py-2 font-mono text-xs font-black uppercase flex items-center gap-1.5 shadow-[3px_3px_0px_0px_#000] cursor-pointer"
          >
            Next Step <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinish}
            className="bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black px-6 py-2.5 font-mono text-xs font-black uppercase flex items-center gap-1.5 shadow-[4px_4px_0px_0px_#000] cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FFE600]" />
            CREATE TOURNAMENT NOW
          </button>
        )}
      </div>
    </div>
  );
};
