import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Trophy, 
  CheckCircle, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Settings2, 
  Trash2, 
  RefreshCw, 
  Lock, 
  Unlock, 
  AlertTriangle, 
  Swords, 
  Users, 
  ChevronRight, 
  Gavel,
  Shield,
  Eye,
  Check,
  Edit3
} from 'lucide-react';
import { 
  dotaCompetitionEngine, 
  TournamentStageType, 
  TournamentStageConfig, 
  MultiStageTournamentStructure,
  SeededTeam
} from '../domain/dotaCompetitionEngine';
import { getAuctionEngine } from '../domain/dotaAuctionEngine';
import { tournamentService } from '../services/firebaseService';

interface CompetitionStructureManagerProps {
  tournamentId: string;
  onStructureUpdated?: () => void;
}

export const CompetitionStructureManager: React.FC<CompetitionStructureManagerProps> = ({ 
  tournamentId,
  onStructureUpdated 
}) => {
  const getResolvedTeams = () => {
    const tourney = tournamentService.getTournamentById(tournamentId);
    if (tourney && Array.isArray((tourney as any).teams) && (tourney as any).teams.length > 0) {
      return (tourney as any).teams;
    }
    const engine = getAuctionEngine(tournamentId);
    const auctionTeams = engine.getTeams();
    if (auctionTeams.length > 0) return auctionTeams;
    return tournamentService.getTeams().filter(t => (t as any).tournamentId === tournamentId);
  };

  const [teams, setTeams] = useState(getResolvedTeams);
  const [structure, setStructure] = useState<MultiStageTournamentStructure>(() => {
    const rawTeams = getResolvedTeams();
    return dotaCompetitionEngine.getOrCreateStructure(tournamentId, rawTeams);
  });

  const [editingStage, setEditingStage] = useState<TournamentStageConfig | null>(null);
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null);

  useEffect(() => {
    const rawTeams = getResolvedTeams();
    setTeams(rawTeams);
    const struct = dotaCompetitionEngine.getOrCreateStructure(tournamentId, rawTeams);
    setStructure({ ...struct });
  }, [tournamentId]);

  const refreshStructure = () => {
    const struct = dotaCompetitionEngine.getStructure(tournamentId);
    if (struct) setStructure({ ...struct });
    if (onStructureUpdated) onStructureUpdated();
  };

  const handleAddStage = (type: TournamentStageType) => {
    dotaCompetitionEngine.addStage(tournamentId, type);
    setShowAddStageModal(false);
    refreshStructure();
    setNoticeMsg({ text: `✓ Added new ${type.replace('_', ' ')} stage to tournament pipeline.`, type: 'success' });
  };

  const handleMoveStage = (stageId: string, dir: 'UP' | 'DOWN') => {
    dotaCompetitionEngine.moveStage(tournamentId, stageId, dir);
    refreshStructure();
  };

  const handleDeleteStage = (stageId: string) => {
    if (structure.stages.length <= 1) {
      setNoticeMsg({ text: 'A tournament must have at least one competition stage.', type: 'warn' });
      return;
    }
    dotaCompetitionEngine.deleteStage(tournamentId, stageId);
    refreshStructure();
    setNoticeMsg({ text: '✓ Stage deleted.', type: 'success' });
  };

  const handleGenerateStructure = () => {
    const latestTeams = getResolvedTeams();
    setTeams(latestTeams);
    const res = dotaCompetitionEngine.generateFullStructure(tournamentId, latestTeams);
    setStructure({ ...res.structure });
    setPreviewMode(true);
    setNoticeMsg({ 
      text: `✓ Structure generated with ${res.structure.matches?.length || 0} preliminary matchups across ${res.structure.stages.length} stage(s). Review draft below before publishing.`, 
      type: 'success' 
    });
    if (onStructureUpdated) onStructureUpdated();
  };

  const handlePublishStructure = () => {
    const res = dotaCompetitionEngine.publishStructure(tournamentId);
    if (res.success) {
      setStructure({ ...res.structure });
      setNoticeMsg({ text: '✓ Competition structure officially PUBLISHED! Stages are now active for live play.', type: 'success' });
      if (onStructureUpdated) onStructureUpdated();
    }
  };

  const handleUnlockForEditing = () => {
    const res = dotaCompetitionEngine.editPublishedStructure(tournamentId);
    if (res.hasStartedMatches) {
      setNoticeMsg({ text: '⚠️ Warning: Matches have already been played. Structural changes should only affect unplayed fixtures.', type: 'warn' });
    } else {
      setNoticeMsg({ text: 'Structure unlocked for editing.', type: 'success' });
    }
    refreshStructure();
  };

  return (
    <div className="bg-white border-[3.5px] border-black p-6 sm:p-8 shadow-[6px_6px_0px_0px_#000] font-mono space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-sans font-black text-xl uppercase text-black">
              Competition Structure &amp; Stage Builder
            </h3>
          </div>
          <p className="text-xs text-stone-600 mt-1">
            Configure tournament stages (Group Stage → Bracket, Double Elimination, Swiss, or custom pipelines).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 border-2 border-black text-xs font-black uppercase ${
            structure.status === 'PUBLISHED' ? 'bg-[#70FFAF] text-black' : 'bg-[#FFE600] text-black'
          }`}>
            {structure.status === 'PUBLISHED' ? 'PUBLISHED & LOCKED' : 'DRAFT MODE'}
          </span>
          {structure.status === 'PUBLISHED' ? (
            <button
              onClick={handleUnlockForEditing}
              className="bg-stone-100 hover:bg-stone-200 border-2 border-black px-3 py-1 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-600" />
              Edit Structure
            </button>
          ) : (
            <button
              onClick={() => setShowAddStageModal(true)}
              className="bg-[#FFE600] hover:bg-yellow-400 border-2 border-black px-3 py-1 text-xs font-black uppercase flex items-center gap-1 shadow-[2px_2px_0px_0px_#000] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Stage
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner */}
      {noticeMsg && (
        <div className={`p-3 border-2 border-black text-xs font-bold flex items-center justify-between ${
          noticeMsg.type === 'success' ? 'bg-[#E6FFFA] text-emerald-900 border-emerald-900' :
          noticeMsg.type === 'warn' ? 'bg-[#FFFBEB] text-amber-900 border-amber-900' :
          'bg-rose-50 text-rose-900 border-rose-900'
        }`}>
          <span>{noticeMsg.text}</span>
          <button onClick={() => setNoticeMsg(null)} className="text-xs uppercase underline cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Pipeline Stage Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs font-black text-stone-500 uppercase">
          <span>Tournament Stage Sequence ({structure.stages.length} Stages)</span>
          <span>{teams.length} Confirmed Franchises</span>
        </div>

        {structure.stages.map((stage, idx) => (
          <div 
            key={stage.id}
            className="border-[3px] border-black p-4 bg-white hover:bg-stone-50 transition-colors shadow-[4px_4px_0px_0px_#000] space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 bg-black text-[#FFE600] font-black text-sm flex items-center justify-center border-2 border-black">
                  {stage.sequence}
                </span>
                <div>
                  <h4 className="font-sans font-black text-base uppercase text-black">
                    {stage.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600 font-bold mt-0.5">
                    <span className="bg-purple-100 text-purple-900 border border-purple-300 px-1.5 py-0.2">
                      {stage.type.replace('_', ' ')}
                    </span>
                    <span>·</span>
                    {stage.type === 'GROUP_STAGE' ? (
                      <span>{stage.groupCount || 2} Groups · {stage.teamsPerGroup || 4} Teams each · {stage.defaultSeriesFormat || 'BO2'}</span>
                    ) : (
                      <span>{stage.teamCount || 8} Teams · {stage.defaultSeriesFormat || 'BO3'} · Finals {stage.grandFinalSeriesFormat || 'BO5'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  disabled={idx === 0 || structure.isLocked}
                  onClick={() => handleMoveStage(stage.id, 'UP')}
                  className="p-1.5 border border-black bg-stone-100 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={idx === structure.stages.length - 1 || structure.isLocked}
                  onClick={() => handleMoveStage(stage.id, 'DOWN')}
                  className="p-1.5 border border-black bg-stone-100 hover:bg-stone-200 disabled:opacity-30 cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={structure.isLocked}
                  onClick={() => setEditingStage(stage)}
                  className="bg-white hover:bg-stone-100 border border-black px-2.5 py-1 text-xs font-bold uppercase flex items-center gap-1 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  Configure
                </button>
                <button
                  disabled={structure.isLocked}
                  onClick={() => handleDeleteStage(stage.id)}
                  className="p-1.5 border border-black bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-30 cursor-pointer"
                  title="Delete Stage"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Generated Matches Counter */}
            {stage.matches && stage.matches.length > 0 && (
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
                <span>{stage.matches.length} Scheduled Matchups Generated</span>
                <span className="text-emerald-700 font-bold">✓ Ready for Play</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-black">
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateStructure}
            disabled={structure.isLocked}
            className="bg-[#FFE600] hover:bg-yellow-400 disabled:opacity-50 text-black border-2 border-black px-5 py-2.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>GENERATE STRUCTURE</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePublishStructure}
            disabled={structure.status === 'PUBLISHED'}
            className="bg-[#70FFAF] hover:bg-[#58e094] disabled:opacity-50 text-black border-2 border-black px-5 py-2.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            <Lock className="w-4 h-4" />
            <span>PUBLISH &amp; ACTIVATE MATCHES</span>
          </button>
        </div>
      </div>

      {/* Add Stage Modal */}
      {showAddStageModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_#000]">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-sans font-black text-lg uppercase text-black">Select Stage Type</h3>
              <button onClick={() => setShowAddStageModal(false)} className="font-black text-sm cursor-pointer">✕</button>
            </div>
            <p className="text-xs text-stone-600">Choose the tournament format for this stage in the sequence:</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              {[
                { type: 'GROUP_STAGE', label: 'Group Stage', desc: 'Round-robin groups with advancing slots' },
                { type: 'DOUBLE_ELIMINATION', label: 'Double Elimination', desc: 'Upper and Lower elimination brackets' },
                { type: 'SINGLE_ELIMINATION', label: 'Single Elimination', desc: 'Knockout bracket' },
                { type: 'ROUND_ROBIN', label: 'Round Robin', desc: 'All vs All league matches' },
                { type: 'SWISS', label: 'Swiss System', desc: 'Paired by match records' },
                { type: 'PLAY_IN', label: 'Play-In Gauntlet', desc: 'Last chance qualifier round' },
                { type: 'LEAGUE', label: 'League Play', desc: 'Extended multi-week schedule' },
                { type: 'CUSTOM', label: 'Custom / Manual', desc: 'Fully organizer-defined matchups' }
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => handleAddStage(opt.type as any)}
                  className="p-3 border-2 border-black text-left hover:bg-[#FFE600] transition-colors cursor-pointer"
                >
                  <div className="font-black text-black">{opt.label}</div>
                  <div className="text-[10px] text-stone-600 font-normal">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Stage Config Modal */}
      {editingStage && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_#000] font-mono text-xs">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <h3 className="font-sans font-black text-base uppercase text-black">Configure {editingStage.name}</h3>
              <button onClick={() => setEditingStage(null)} className="font-black text-sm cursor-pointer">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Stage Title</label>
                <input
                  type="text"
                  value={editingStage.name}
                  onChange={e => setEditingStage({ ...editingStage, name: e.target.value })}
                  className="w-full border-2 border-black p-2 font-bold bg-white"
                />
              </div>

              {editingStage.type === 'GROUP_STAGE' && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Group Count</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={editingStage.groupCount || 2}
                        onChange={e => setEditingStage({ ...editingStage, groupCount: Number(e.target.value) })}
                        className="w-full border-2 border-black p-2 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Teams Per Group</label>
                      <input
                        type="number"
                        min="2"
                        max="16"
                        value={editingStage.teamsPerGroup || 4}
                        onChange={e => setEditingStage({ ...editingStage, teamsPerGroup: Number(e.target.value) })}
                        className="w-full border-2 border-black p-2 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Series Format</label>
                    <select
                      value={editingStage.defaultSeriesFormat || 'BO2'}
                      onChange={e => setEditingStage({ ...editingStage, defaultSeriesFormat: e.target.value as any })}
                      className="w-full border-2 border-black p-2 font-bold"
                    >
                      <option value="BO1">Best of 1</option>
                      <option value="BO2">Best of 2 (Draws Allowed)</option>
                      <option value="BO3">Best of 3</option>
                    </select>
                  </div>
                </>
              )}

              {(editingStage.type === 'DOUBLE_ELIMINATION' || editingStage.type === 'SINGLE_ELIMINATION') && (
                <>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Series Format (Standard)</label>
                    <select
                      value={editingStage.defaultSeriesFormat || 'BO3'}
                      onChange={e => setEditingStage({ ...editingStage, defaultSeriesFormat: e.target.value as any })}
                      className="w-full border-2 border-black p-2 font-bold"
                    >
                      <option value="BO1">Best of 1</option>
                      <option value="BO3">Best of 3</option>
                      <option value="BO5">Best of 5</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-stone-600 mb-1">Grand Final Format</label>
                    <select
                      value={editingStage.grandFinalSeriesFormat || 'BO5'}
                      onChange={e => setEditingStage({ ...editingStage, grandFinalSeriesFormat: e.target.value as any })}
                      className="w-full border-2 border-black p-2 font-bold"
                    >
                      <option value="BO3">Best of 3</option>
                      <option value="BO5">Best of 5</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="pt-3 border-t-2 border-black flex justify-end gap-2">
              <button
                onClick={() => setEditingStage(null)}
                className="px-3 py-1.5 border border-black font-bold uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  dotaCompetitionEngine.updateStageConfig(tournamentId, editingStage.id, editingStage);
                  setEditingStage(null);
                  refreshStructure();
                }}
                className="px-4 py-1.5 bg-[#FFE600] border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
