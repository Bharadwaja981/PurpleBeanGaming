import React, { useState } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Shield, 
  Calendar, 
  Tag, 
  User, 
  Clock,
  Layers
} from 'lucide-react';
import { 
  dotaTournamentOperations, 
  AuditRecord, 
  AuditCategory 
} from '../domain/dotaTournamentOperationsEngine';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface AuditLogViewerProps {
  tournamentId: string;
}

const CATEGORIES: AuditCategory[] = [
  'REGISTRATION',
  'MMR',
  'CAPTAIN',
  'AUCTION',
  'ROSTER',
  'SEEDING',
  'STRUCTURE_LOCK',
  'MATCH_SCHEDULE',
  'RESULT',
  'DISPUTE',
  'FORFEIT',
  'REMATCH',
  'CORRECTION',
  'REPORT',
  'DISQUALIFICATION',
  'RULE_CHANGE',
  'TOURNAMENT_COMPLETION',
  'PLATFORM_ADMIN'
];

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ tournamentId }) => {
  const curUser = tournamentService.getCurrentUser();
  const caller = {
    userId: curUser.id,
    email: curUser.email,
    role: (curUser.role || 'organizer') as any,
    isAdmin: Boolean(curUser.isAdmin)
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchEntity, setSearchEntity] = useState<string>('');

  const logs = dotaTournamentOperations.getAuditTrail(caller, {
    tournamentId,
    category: selectedCategory !== 'ALL' ? (selectedCategory as AuditCategory) : undefined,
    entityId: searchEntity || undefined
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-black" />
            <h3 className="font-black text-sm uppercase text-black font-sans">
              IMMUTABLE AUDIT TRAIL LEDGER
            </h3>
          </div>
          <p className="text-stone-600 text-[11px] mt-0.5">
            Cryptographically timestamped ledger of every tournament mutation, MMR review, and referee action.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-black text-[#70FFAF] px-2 py-1 border border-black font-black uppercase text-[10px]">
            {logs.length} Total Audit Records
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SelectDropdown
            label="Filter Category"
            value={selectedCategory}
            onChange={val => setSelectedCategory(val)}
            options={[
              { value: 'ALL', label: `All Categories (${CATEGORIES.length})` },
              ...CATEGORIES.map(cat => ({ value: cat, label: cat }))
            ]}
            size="sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="font-black text-[10px] uppercase text-stone-500">Search Entity ID:</span>
          <input
            type="text"
            value={searchEntity}
            onChange={e => setSearchEntity(e.target.value)}
            placeholder="e.g. p-c1 or tc-team-1"
            className="p-1 bg-stone-50 border border-black text-xs font-mono"
          />
        </div>
      </div>

      {/* Log Feed */}
      <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-stone-100 border-b-2 border-black uppercase text-[10px] font-black text-black">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Category</th>
              <th className="p-3">Action</th>
              <th className="p-3">Actor</th>
              <th className="p-3">Entity</th>
              <th className="p-3">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y border-stone-200">
            {logs.map((rec: AuditRecord) => (
              <tr key={rec.id} className="hover:bg-stone-50">
                <td className="p-3 text-[10px] text-stone-500 whitespace-nowrap">
                  {new Date(rec.timestamp).toLocaleString()}
                </td>
                <td className="p-3">
                  <span className="bg-stone-100 px-1.5 py-0.5 border border-stone-300 text-[10px] font-bold text-black uppercase">
                    {rec.category}
                  </span>
                </td>
                <td className="p-3 font-black text-black">{rec.action}</td>
                <td className="p-3 text-stone-700">
                  <span className="font-bold">{rec.actorName}</span>
                  <span className="text-[9px] text-stone-400 block uppercase">[{rec.actorRole}]</span>
                </td>
                <td className="p-3 font-bold text-stone-800">
                  {rec.entityType}: {rec.entityId}
                </td>
                <td className="p-3 text-stone-600 max-w-xs truncate" title={rec.details}>
                  {rec.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
