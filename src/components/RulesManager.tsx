import React, { useState } from 'react';
import { 
  FileText, 
  Plus, 
  Clock, 
  History, 
  CheckCircle, 
  AlertCircle, 
  Shield, 
  Sparkles,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { 
  dotaTournamentOperations, 
  TournamentRuleSection, 
  TournamentRuleVersion 
} from '../domain/dotaTournamentOperationsEngine';
import { tournamentService } from '../services/firebaseService';

interface RulesManagerProps {
  tournamentId: string;
}

export const RulesManager: React.FC<RulesManagerProps> = ({ tournamentId }) => {
  const [ruleVersions, setRuleVersions] = useState<TournamentRuleVersion[]>(() => 
    dotaTournamentOperations.getRuleVersions(tournamentId)
  );
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  // New rule section draft state
  const currentRules = dotaTournamentOperations.getCurrentRules(tournamentId);
  const [draftSections, setDraftSections] = useState<TournamentRuleSection[]>(() => 
    currentRules ? JSON.parse(JSON.stringify(currentRules.sections)) : []
  );

  const activeVersionData = selectedVersion 
    ? ruleVersions.find(v => v.version === selectedVersion) || currentRules
    : currentRules;

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    const curUser = tournamentService.getCurrentUser();
    const caller = {
      userId: curUser.id,
      email: curUser.email,
      role: (curUser.role || 'organizer') as any,
      isAdmin: Boolean(curUser.isAdmin)
    };

    const res = dotaTournamentOperations.publishRules(
      tournamentId,
      draftSections,
      caller,
      changeSummary || `Rules update v${(currentRules?.version || 0) + 1}`
    );

    if (res.success) {
      setRuleVersions(dotaTournamentOperations.getRuleVersions(tournamentId));
      setIsEditing(false);
      setChangeSummary('');
      setFeedback(`Successfully published rule version v${res.version}!`);
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback(`Error: ${res.error}`);
    }
  };

  const handleUpdateSectionContent = (index: number, content: string) => {
    setDraftSections(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], content };
      return copy;
    });
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Top Banner */}
      <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-black text-sm uppercase text-black font-sans">
              OFFICIAL TOURNAMENT RULEBOOK &amp; VERSIONING
            </h3>
          </div>
          <p className="text-stone-600 text-[11px] mt-0.5">
            Published rules are versioned to preserve historical player expectations. Changes are audited.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 bg-[#FFE600] text-black border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-400 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Amend / Publish Rules</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 bg-stone-200 text-black border-2 border-black font-black uppercase cursor-pointer"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-[#70FFAF] border-2 border-black text-black font-bold">
          {feedback}
        </div>
      )}

      {/* Version History Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-stone-600 uppercase text-[10px]">Version Archive:</span>
        {ruleVersions.map(v => (
          <button
            key={v.version}
            onClick={() => {
              setSelectedVersion(v.version);
              setIsEditing(false);
            }}
            className={`px-2.5 py-1 border border-black font-black text-[11px] uppercase transition-all cursor-pointer ${
              (selectedVersion === v.version || (!selectedVersion && currentRules?.version === v.version))
                ? 'bg-black text-[#FFE600]'
                : 'bg-white text-stone-700 hover:bg-stone-100'
            }`}
          >
            v{v.version} {v.version === currentRules?.version ? '(Current)' : ''}
          </button>
        ))}
      </div>

      {/* Editor Modal / Panel */}
      {isEditing ? (
        <form onSubmit={handlePublish} className="bg-white border-[3px] border-black p-5 shadow-[5px_5px_0px_0px_#000] space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <span className="font-black text-sm uppercase text-black">
              Publish Rule Amendment (v{(currentRules?.version || 0) + 1})
            </span>
            <span className="text-[10px] text-stone-500 font-bold">ALL MANDATED CATEGORIES</span>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-black uppercase text-[10px] block">Change Summary / Changelog Note:</label>
            <input
              type="text"
              required
              value={changeSummary}
              onChange={e => setChangeSummary(e.target.value)}
              placeholder="e.g. Added emergency stand-in policy for knockout matches"
              className="w-full p-2 bg-stone-50 border-2 border-black text-xs font-mono"
            />
          </div>

          <div className="space-y-3 pt-2">
            {draftSections.map((sec, idx) => (
              <div key={sec.id || idx} className="p-3 bg-stone-50 border border-black space-y-1">
                <span className="font-black text-stone-800 text-xs block uppercase">
                  {sec.title} ({sec.category})
                </span>
                <textarea
                  rows={2}
                  value={sec.content}
                  onChange={e => handleUpdateSectionContent(idx, e.target.value)}
                  className="w-full p-2 bg-white border border-stone-400 text-xs font-mono"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-black text-[#70FFAF] font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:bg-stone-800 cursor-pointer"
            >
              Sign &amp; Publish v{(currentRules?.version || 0) + 1}
            </button>
          </div>
        </form>
      ) : (
        /* Rules Viewer */
        <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-6 space-y-6">
          <div className="border-b-2 border-black pb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base uppercase text-black font-sans">
                  RULEBOOK REVISION v{activeVersionData?.version}
                </span>
                <span className="bg-[#70FFAF] text-black px-2 py-0.5 border border-black text-[10px] font-black uppercase">
                  ENFORCED
                </span>
              </div>
              <p className="text-[11px] text-stone-500 mt-0.5">
                Published {activeVersionData?.publishedAt ? new Date(activeVersionData.publishedAt).toLocaleString() : 'N/A'} by {activeVersionData?.publishedBy}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-400 uppercase block font-bold">Changelog:</span>
              <span className="font-bold text-stone-700">{activeVersionData?.changeSummary || 'Original tournament release'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeVersionData?.sections.map(sec => (
              <div key={sec.id} className="p-3.5 bg-stone-50 border-2 border-black space-y-1">
                <span className="font-black text-black text-xs uppercase block flex items-center justify-between">
                  <span>{sec.title}</span>
                  <span className="text-[9px] bg-white border border-stone-400 px-1 text-stone-500 font-bold uppercase">{sec.category}</span>
                </span>
                <p className="text-stone-700 text-xs leading-relaxed">
                  {sec.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
