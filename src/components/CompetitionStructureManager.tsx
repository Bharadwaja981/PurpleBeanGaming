import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Swords, 
  Lock, 
  Unlock, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Sliders, 
  Shuffle, 
  Sparkles,
  Info,
  Calendar,
  ChevronRight
} from 'lucide-react';
import { tournamentService } from '../services/firebaseService';
import { 
  dotaCompetitionEngine, 
  CompetitionStructureState, 
  SeedingMode, 
  CompetitionFormat, 
  SeriesFormat 
} from '../domain/dotaCompetitionEngine';

interface CompetitionStructureManagerProps {
  tournamentId: string;
}

export function CompetitionStructureManager({ tournamentId }: CompetitionStructureManagerProps) {
  const currentUser = tournamentService.getCurrentUser();
  const isOrganiser = currentUser.role === 'organizer';

  const [structure, setStructure] = useState<CompetitionStructureState | undefined>(() =>
    dotaCompetitionEngine.getStructure(tournamentId)
  );

  const [seedingMode, setSeedingMode] = useState<SeedingMode>('rating');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [showTiebreakModal, setShowTiebreakModal] = useState(false);

  useEffect(() => {
    const handleSync = () => {
      setStructure(dotaCompetitionEngine.getStructure(tournamentId));
    };
    handleSync();
    return dotaCompetitionEngine.subscribe(handleSync);
  }, [tournamentId]);

  const clearFeedback = () => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
  };

  const handleGenerateSeeds = (mode: SeedingMode) => {
    clearFeedback();
    const res = tournamentService.generateCompetitionSeeds({
      tournamentId,
      seedingMode: mode
    });

    if (res.success) {
      setFeedbackSuccess(`✓ Generated ${mode} seeds for ${res.seededTeams?.length} teams!`);
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } else {
      setFeedbackError(res.error || 'Failed to generate seeds.');
    }
  };

  const handleGenerateStructure = () => {
    clearFeedback();
    const res = tournamentService.generateCompetitionStructure(tournamentId);

    if (res.success) {
      setFeedbackSuccess(`✓ Competition structure generated (${res.structure?.matches.length} matches)!`);
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } else {
      setFeedbackError(res.error || 'Failed to generate structure.');
    }
  };

  const handleLockStructure = () => {
    clearFeedback();
    if (!confirm('Are you sure you want to LOCK this competition structure? Once locked, seeds and match progression cannot be modified.')) {
      return;
    }

    const res = tournamentService.lockCompetitionStructure(tournamentId);
    if (res.success) {
      setFeedbackSuccess('✓ Competition structure and match progression officially LOCKED!');
      setTimeout(() => setFeedbackSuccess(null), 4000);
    } else {
      setFeedbackError(res.error || 'Failed to lock structure.');
    }
  };

  const isLocked = structure?.status === 'LOCKED';
  const tiebreakRules = dotaCompetitionEngine.getTiebreakRulesDescription();

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner */}
      <div className="bg-white border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#FFE600] border-2 border-black">
            <Sliders className="w-6 h-6 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-[#70FFAF] px-1.5 py-0.5 border border-black">
                PHASE 4 · COMPETITION STRUCTURE
              </span>
              <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 border border-black ${
                isLocked ? 'bg-[#7C3AED] text-white' : 'bg-amber-100 text-amber-900'
              }`}>
                {structure?.status || 'UNINITIALIZED'}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black uppercase text-black font-sans leading-tight">
              SEEDING, BRACKET GENERATION &amp; TIEBREAKS
            </h2>
            <p className="text-xs text-stone-600">
              Format: {structure?.config.format.replace('_', ' ').toUpperCase()} • Series Default: {structure?.config.defaultSeriesFormat} • Teams: {structure?.seededTeams.length || 0}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase">
          <button
            onClick={() => setShowTiebreakModal(true)}
            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border-2 border-black cursor-pointer flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Tiebreak Rules</span>
          </button>

          {isOrganiser && !isLocked && (
            <>
              <button
                onClick={handleGenerateStructure}
                className="px-3 py-1.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generate Structure</span>
              </button>

              <button
                onClick={handleLockStructure}
                disabled={!structure || structure.matches.length === 0}
                className="px-4 py-1.5 bg-[#7C3AED] hover:bg-purple-700 disabled:opacity-40 text-white border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock Structure</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {feedbackError && (
        <div className="p-3 bg-[#FF5757]/15 border-2 border-[#FF5757] text-[#D90429] text-xs font-black flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{feedbackError}</span>
        </div>
      )}
      {feedbackSuccess && (
        <div className="p-3 bg-[#70FFAF]/30 border-2 border-black text-black text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{feedbackSuccess}</span>
        </div>
      )}

      {/* SEEDING CONTROL BAR (ORGANISER) */}
      {isOrganiser && !isLocked && (
        <div className="bg-[#FFFBEB] border-2 border-black p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/15 pb-2">
            <span className="text-xs font-black uppercase text-black flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#7C3AED]" />
              <span>Seeding Configuration Desk</span>
            </span>
            <span className="text-[10px] text-stone-500 font-bold">Review seeds before locking structure</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[11px] font-bold text-stone-700">Seeding Mode:</span>
            <button
              onClick={() => {
                setSeedingMode('rating');
                handleGenerateSeeds('rating');
              }}
              className={`px-3 py-1 border-2 border-black font-black uppercase cursor-pointer ${
                seedingMode === 'rating' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white'
              }`}
            >
              Rating-Based (MMR Strength)
            </button>
            <button
              onClick={() => {
                setSeedingMode('random');
                handleGenerateSeeds('random');
              }}
              className={`px-3 py-1 border-2 border-black font-black uppercase cursor-pointer ${
                seedingMode === 'random' ? 'bg-[#FFE600] text-black shadow-[2px_2px_0px_0px_#000]' : 'bg-white'
              }`}
            >
              Random Draw
            </button>
          </div>
        </div>
      )}

      {/* SEEDED TEAMS REVIEW TABLE */}
      {structure && structure.seededTeams.length > 0 && (
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="text-xs font-black uppercase text-black font-sans">
              Tournament Seed Order ({structure.seededTeams.length} Teams)
            </span>
            <span className="text-[10px] text-stone-500 font-bold">
              {isLocked ? 'Locked & Historical' : 'Editable in Preview'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {structure.seededTeams.map((team) => (
              <div key={team.teamId} className="p-3 bg-stone-50 border-2 border-black space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 bg-[#FFE600] border border-black text-[10px] font-black">
                    Seed #{team.seed}
                  </span>
                  <span className="font-mono text-[10px] text-stone-500">[{team.tag}]</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xl">{team.logo}</span>
                  <strong className="text-black truncate">{team.teamName}</strong>
                </div>
                <div className="text-[10px] text-stone-500 flex justify-between pt-1 border-t border-black/10">
                  <span>Strength MMR:</span>
                  <span className="font-bold text-[#7C3AED] font-mono">{team.rosterStrengthRating.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GROUPS / ROUND ROBIN STANDINGS (IF APPLICABLE) */}
      {structure?.groups && (
        <div className="space-y-6">
          {Object.values(structure.groups).map((grp) => (
            <div key={grp.groupId} className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <h3 className="font-black text-base uppercase text-black font-sans">{grp.groupName} Standings</h3>
                <span className="text-[10px] font-bold text-stone-500">Top 2 Advance to Semifinals</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-stone-100 border-y-2 border-black text-[10px] font-black uppercase text-stone-700">
                      <th className="p-2">Rank</th>
                      <th className="p-2">Team</th>
                      <th className="p-2 text-center">Played</th>
                      <th className="p-2 text-center">Won</th>
                      <th className="p-2 text-center">Lost</th>
                      <th className="p-2 text-center">Series</th>
                      <th className="p-2 text-center">Game Diff</th>
                      <th className="p-2 text-center">Points</th>
                      <th className="p-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10 font-mono">
                    {grp.standings.map((row) => (
                      <tr key={row.teamId} className={row.qualified ? 'bg-[#70FFAF]/20' : 'bg-white'}>
                        <td className="p-2 font-black">#{row.rank}</td>
                        <td className="p-2 flex items-center gap-2">
                          <span>{row.logo}</span>
                          <strong className="text-black">{row.teamName}</strong>
                          <span className="text-stone-400 text-[10px]">[{row.tag}]</span>
                        </td>
                        <td className="p-2 text-center">{row.played}</td>
                        <td className="p-2 text-center text-emerald-700 font-bold">{row.won}</td>
                        <td className="p-2 text-center text-red-600">{row.lost}</td>
                        <td className="p-2 text-center font-bold">{row.seriesRecord}</td>
                        <td className="p-2 text-center font-bold">{row.gameDiff > 0 ? `+${row.gameDiff}` : row.gameDiff}</td>
                        <td className="p-2 text-center font-black text-black">{row.points} pts</td>
                        <td className="p-2 text-right">
                          {row.qualified ? (
                            <span className="px-1.5 py-0.5 bg-[#70FFAF] border border-black text-[9px] font-black uppercase">
                              Qualified
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400">In contention</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIEBREAK RULES MODAL */}
      {showTiebreakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h3 className="font-black text-base uppercase text-black font-sans">
                Official Tournament Tiebreak Rules
              </h3>
              <button
                onClick={() => setShowTiebreakModal(false)}
                className="font-black text-sm p-1 border border-black hover:bg-black hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Ties in Round Robin and Group standings are resolved strictly through the following deterministic priority order. Random draws are never employed.
            </p>

            <div className="space-y-2 bg-stone-50 border-2 border-black p-3 text-xs">
              {tiebreakRules.map((rule, idx) => (
                <div key={idx} className="p-2 bg-white border border-stone-300 font-bold text-stone-800">
                  {rule}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowTiebreakModal(false)}
                className="px-4 py-2 bg-[#FFE600] border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
