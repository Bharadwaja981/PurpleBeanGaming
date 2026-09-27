import React, { useState } from 'react';
import { 
  Gavel, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle, 
  HelpCircle, 
  UserX,
  Users
} from 'lucide-react';
import { 
  dotaTournamentOperations, 
  DisqualificationImpactPreview,
  TournamentSanction
} from '../domain/dotaTournamentOperationsEngine';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface DisqualificationDeskProps {
  tournamentId: string;
}

export const DisqualificationDesk: React.FC<DisqualificationDeskProps> = ({ tournamentId }) => {
  const curUser = tournamentService.getCurrentUser();
  const caller = {
    userId: curUser.id,
    email: curUser.email,
    role: (curUser.role || 'organizer') as any,
    isAdmin: Boolean(curUser.isAdmin)
  };

  const [targetId, setTargetId] = useState('tc-team-2');
  const [targetType, setTargetType] = useState<'player' | 'team'>('team');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<DisqualificationImpactPreview | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sanctions, setSanctions] = useState<TournamentSanction[]>(() => 
    dotaTournamentOperations.getTournamentSanctions(tournamentId)
  );

  const handleGeneratePreview = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const p = dotaTournamentOperations.previewDisqualification(tournamentId, targetId, targetType, caller);
      setPreview(p);
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    }
  };

  const handleConfirmDisqualification = () => {
    if (!reason) {
      setFeedback('Error: Disqualification reason is required.');
      return;
    }

    const res = dotaTournamentOperations.executeDisqualification(
      {
        tournamentId,
        targetId,
        targetType,
        reason
      },
      caller
    );

    if (res.success) {
      setSanctions(dotaTournamentOperations.getTournamentSanctions(tournamentId));
      setPreview(null);
      setReason('');
      setFeedback(`Authoritative disqualification executed against ${targetType} ${targetId}! Past records retained; future matches forfeited.`);
      setTimeout(() => setFeedback(null), 4000);
    } else {
      setFeedback(`Error: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-red-600" />
            <h3 className="font-black text-sm uppercase text-black font-sans">
              SANCTIONS &amp; DISQUALIFICATION ARBITRATION
            </h3>
          </div>
          <p className="text-stone-600 text-[11px] mt-0.5">
            Atomic disqualification calculates impact on active rosters, brackets, and standings before confirmation. Past match history is preserved.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-[#70FFAF] border-2 border-black text-black font-bold">
          {feedback}
        </div>
      )}

      {/* Target Selection & Preview Generator */}
      <form onSubmit={handleGeneratePreview} className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
        <span className="font-black text-sm uppercase text-black block border-b-2 border-black pb-2">
          Step 1: Select Subject &amp; Generate Impact Preview
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <SelectDropdown
              label="Entity Type:"
              value={targetType}
              onChange={val => setTargetType(val as any)}
              options={[
                { value: 'team', label: 'Franchise / Team' },
                { value: 'player', label: 'Individual Player' }
              ]}
              className="w-full"
            />
          </div>

          <div>
            <label className="font-bold text-black uppercase text-[10px] block mb-1">Target ID / Tag:</label>
            <input
              type="text"
              required
              value={targetId}
              onChange={e => setTargetId(e.target.value)}
              placeholder="e.g. tc-team-2 or p-01"
              className="w-full p-2 bg-stone-50 border-2 border-black text-xs font-mono"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full p-2 bg-[#FFE600] text-black font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_#000] hover:bg-yellow-400 cursor-pointer"
            >
              Calculate Impact Preview →
            </button>
          </div>
        </div>
      </form>

      {/* Impact Preview Modal / Card */}
      {preview && (
        <div className="bg-[#FFF5F5] border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 space-y-4">
          <div className="border-b-2 border-black pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span className="font-black text-base uppercase text-black font-sans">
                DISQUALIFICATION IMPACT PREVIEW
              </span>
            </div>
            <span className="bg-red-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
              HIGH GRAVITY ACTION
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white border-2 border-black space-y-2">
              <span className="font-black text-xs text-black uppercase block">Active Roster Impact:</span>
              <ul className="list-disc pl-4 space-y-1 text-stone-700 text-[11px]">
                {preview.activeRosterImpact.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-white border-2 border-black space-y-2">
              <span className="font-black text-xs text-black uppercase block">Upcoming Match Impact:</span>
              <p className="text-stone-700 text-[11px] leading-relaxed">
                {preview.upcomingMatchesImpacted.length > 0 
                  ? `${preview.upcomingMatchesImpacted.length} scheduled matches will be awarded as administrative forfeit wins to opponents.`
                  : 'No active upcoming matches scheduled.'}
              </p>
            </div>
          </div>

          <div className="p-3 bg-white border-2 border-black space-y-1">
            <span className="font-black text-xs text-black uppercase block">Tournament Retention &amp; Policy:</span>
            <div className="text-stone-700 text-xs leading-relaxed space-y-1">
              <div>• Consequence Policy: <strong className="text-black">{preview.consequencePolicyApplied}</strong></div>
              <div>• Bracket Impact: {preview.bracketImpactDescription}</div>
              <div>• Standings Impact: {preview.standingsImpactDescription}</div>
            </div>
          </div>

          {/* Reason & Final Confirmation */}
          <div className="pt-2 border-t-2 border-black space-y-3">
            <div>
              <label className="font-bold text-black uppercase text-[10px] block mb-1">
                Official Sanction Reason (Mandatory for Audit):
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g. Verified multi-accounting / falsified MMR verification"
                className="w-full p-2.5 bg-white border-2 border-black text-xs font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPreview(null)}
                className="px-4 py-2 bg-stone-200 text-black font-black uppercase border-2 border-black cursor-pointer"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={handleConfirmDisqualification}
                className="px-4 py-2 bg-[#FF5757] text-white font-black uppercase border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:bg-red-600 cursor-pointer"
              >
                Authoritatively Execute Disqualification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Sanctions Registry */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <div className="p-3 bg-stone-100 border-b-2 border-black font-black uppercase text-black text-xs">
          Tournament Sanctions Issued ({sanctions.length})
        </div>

        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-stone-50 border-b border-stone-300 uppercase text-[10px] font-black text-stone-600">
            <tr>
              <th className="p-3">Sanction ID</th>
              <th className="p-3">Target</th>
              <th className="p-3">Sanction Type</th>
              <th className="p-3">Reason</th>
              <th className="p-3">Issued By</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y border-stone-200">
            {sanctions.map(s => (
              <tr key={s.id} className="hover:bg-stone-50">
                <td className="p-3 font-bold">{s.id}</td>
                <td className="p-3 font-black text-black">{s.targetType}: {s.targetId}</td>
                <td className="p-3 text-red-600 font-bold">{s.sanctionType}</td>
                <td className="p-3 text-stone-700">{s.reason}</td>
                <td className="p-3 text-stone-500">{s.issuedBy}</td>
                <td className="p-3 font-bold text-emerald-600">{s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
