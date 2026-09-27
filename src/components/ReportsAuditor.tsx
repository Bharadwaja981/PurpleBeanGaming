import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Eye, 
  Lock, 
  HelpCircle,
  Gavel,
  FileText
} from 'lucide-react';
import { 
  dotaTournamentOperations, 
  PlayerTeamReport, 
  ReportStatus 
} from '../domain/dotaTournamentOperationsEngine';
import { tournamentService } from '../services/firebaseService';
import { SelectDropdown, DropdownOption } from './ui/Dropdown';

interface ReportsAuditorProps {
  tournamentId: string;
}

export const ReportsAuditor: React.FC<ReportsAuditorProps> = ({ tournamentId }) => {
  const curUser = tournamentService.getCurrentUser();
  const caller = {
    userId: curUser.id,
    email: curUser.email,
    role: (curUser.role || 'organizer') as any,
    isAdmin: Boolean(curUser.isAdmin)
  };

  const [reports, setReports] = useState<PlayerTeamReport[]>(() => 
    dotaTournamentOperations.getReports(caller, tournamentId) as PlayerTeamReport[]
  );

  const [selectedReport, setSelectedReport] = useState<PlayerTeamReport | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [actionNote, setActionNote] = useState('');
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshReports = () => {
    setReports(dotaTournamentOperations.getReports(caller, tournamentId) as PlayerTeamReport[]);
  };

  const handleUpdateStatus = (newStatus: ReportStatus) => {
    if (!selectedReport) return;

    const res = dotaTournamentOperations.reviewReport(
      selectedReport.id,
      {
        status: newStatus,
        note: actionNote || undefined,
        evidenceRequestNote: newStatus === 'REQUEST_EVIDENCE' ? actionNote : undefined,
        resolutionSummary: newStatus === 'RESOLVED' ? resolutionSummary : undefined
      },
      caller
    );

    if (res.success) {
      refreshReports();
      setSelectedReport(res.report || null);
      setActionNote('');
      setResolutionSummary('');
      setFeedback(`Case ${selectedReport.id} transitioned to ${newStatus}`);
      setTimeout(() => setFeedback(null), 3000);
    } else {
      setFeedback(`Error: ${res.error}`);
    }
  };

  const filtered = reports.filter(r => {
    if (filterCategory === 'ALL') return true;
    return r.category === filterCategory;
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="bg-[#FFFBEB] border-[3px] border-black p-4 shadow-[4px_4px_0px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-black text-sm uppercase text-black font-sans">
              INTEGRITY INVESTIGATION &amp; REPORTS DESK
            </h3>
          </div>
          <p className="text-stone-600 text-[11px] mt-0.5">
            Allegations are investigated under due process. Reporter identities remain confidential.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-[#FF5757] text-white px-2 py-1 border border-black font-black uppercase text-[10px]">
            {reports.filter(r => r.status === 'OPEN' || r.status === 'UNDER_REVIEW').length} Pending Review
          </span>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-[#70FFAF] border-2 border-black text-black font-bold">
          {feedback}
        </div>
      )}

      {/* Reports Table & Dossier Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
          <div className="p-3 bg-stone-100 border-b-2 border-black flex items-center justify-between gap-2">
            <span className="font-black uppercase text-black text-xs shrink-0">Active Docket</span>
            <SelectDropdown
              value={filterCategory}
              onChange={val => setFilterCategory(val)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                { value: 'Possible Smurf', label: 'Possible Smurf' },
                { value: 'False MMR', label: 'False MMR' },
                { value: 'Account Sharing', label: 'Account Sharing' },
                { value: 'Cheating', label: 'Cheating' },
                { value: 'Toxic / Abusive Behaviour', label: 'Toxic / Abusive Behaviour' }
              ]}
              size="sm"
            />
          </div>

          <div className="divide-y divide-stone-200 max-h-[600px] overflow-y-auto">
            {filtered.map(rep => (
              <div
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                className={`p-3.5 transition-colors cursor-pointer space-y-1.5 ${
                  selectedReport?.id === rep.id ? 'bg-[#FFE600]/30 border-l-4 border-l-black' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-black">{rep.targetName}</span>
                  <span className={`px-2 py-0.5 border border-black text-[9px] font-black uppercase ${
                    rep.status === 'RESOLVED' ? 'bg-[#70FFAF] text-black' :
                    rep.status === 'UNDER_REVIEW' ? 'bg-[#FFE600] text-black' :
                    rep.status === 'REQUEST_EVIDENCE' ? 'bg-[#5CE1E6] text-black' :
                    'bg-[#FF5757] text-white'
                  }`}>
                    {rep.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-stone-500">
                  <span className="bg-stone-100 px-1.5 py-0.5 border border-stone-300 font-bold text-red-600">
                    {rep.category}
                  </span>
                  <span>·</span>
                  <span>{new Date(rep.timestamp).toLocaleDateString()}</span>
                </div>

                <p className="text-stone-700 text-[11px] line-clamp-2">
                  {rep.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Dossier Details */}
        <div className="lg:col-span-5 bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
          {selectedReport ? (
            <>
              <div className="border-b-2 border-black pb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block font-bold">Investigation Dossier</span>
                  <span className="font-black text-base uppercase text-black font-sans">{selectedReport.id}</span>
                </div>
                <span className="text-[10px] bg-black text-white px-2 py-0.5 font-bold uppercase">
                  {selectedReport.category}
                </span>
              </div>

              {/* Target & Confidential Reporter Info */}
              <div className="p-3 bg-stone-50 border-2 border-black space-y-2">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase block font-bold">Accused Subject:</span>
                  <span className="font-black text-sm text-black">{selectedReport.targetName} ({selectedReport.targetId})</span>
                </div>

                <div className="pt-2 border-t border-stone-200">
                  <span className="text-[10px] text-stone-500 uppercase block font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-stone-700" />
                    <span>Confidential Reporter (Admin Only):</span>
                  </span>
                  <span className="font-bold text-stone-800 text-[11px]">
                    {selectedReport.reporterName} ({selectedReport.reporterEmail || 'Anonymous'})
                  </span>
                </div>
              </div>

              {/* Allegation Description */}
              <div className="space-y-1">
                <span className="font-bold text-black uppercase text-[10px] block">Allegation Narrative:</span>
                <div className="p-3 bg-white border border-stone-300 text-stone-800 text-xs leading-relaxed">
                  {selectedReport.description}
                </div>
              </div>

              {/* Audit History */}
              <div className="space-y-1">
                <span className="font-bold text-stone-600 uppercase text-[10px] block">Audit Timeline:</span>
                <div className="max-h-28 overflow-y-auto space-y-1 p-2 bg-stone-50 border border-stone-300 text-[10px]">
                  {selectedReport.auditTrail?.map((a, i) => (
                    <div key={i} className="text-stone-600">
                      <strong className="text-black">{a.action}</strong> by {a.performedBy} ({new Date(a.timestamp).toLocaleTimeString()})
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Controls */}
              <div className="pt-2 border-t-2 border-black space-y-3">
                <span className="font-black text-xs uppercase text-black block">Moderator Adjudication:</span>

                <div className="space-y-1">
                  <input
                    type="text"
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    placeholder="Enter audit note or evidence request..."
                    className="w-full p-2 bg-stone-50 border border-black text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleUpdateStatus('UNDER_REVIEW')}
                    className="py-1.5 px-2 bg-[#FFE600] text-black font-bold uppercase border border-black hover:bg-yellow-400 cursor-pointer text-[10px]"
                  >
                    Mark Under Review
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('REQUEST_EVIDENCE')}
                    className="py-1.5 px-2 bg-[#5CE1E6] text-black font-bold uppercase border border-black hover:bg-cyan-300 cursor-pointer text-[10px]"
                  >
                    Request Evidence
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('RESOLVED')}
                    className="py-1.5 px-2 bg-[#70FFAF] text-black font-bold uppercase border border-black hover:bg-emerald-300 cursor-pointer text-[10px]"
                  >
                    Resolve Case
                  </button>
                  <button
                    onClick={() => handleUpdateStatus('DISMISSED')}
                    className="py-1.5 px-2 bg-stone-200 text-stone-700 font-bold uppercase border border-black hover:bg-stone-300 cursor-pointer text-[10px]"
                  >
                    Dismiss Allegation
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-stone-500 font-mono">
              Select an investigation case from the docket to inspect evidence and adjudicate.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
