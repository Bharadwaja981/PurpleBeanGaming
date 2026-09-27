import { useState } from 'react';
import { X, AlertTriangle, ShieldAlert, CheckCircle, Ban, Send, HelpCircle } from 'lucide-react';
import { ReportItem } from '../types/tournament';

interface ReportDetailModalProps {
  report: ReportItem | null;
  isOpen?: boolean;
  onClose: () => void;
  onUpdateStatus: (id: string, newStatus: ReportItem['status']) => void;
}

export function ReportDetailModal({
  report,
  onClose,
  onUpdateStatus
}: ReportDetailModalProps) {
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!report) return null;

  const handleAction = (status: ReportItem['status'], message: string) => {
    onUpdateStatus(report.id, status);
    setFeedbackMsg(message);
    setTimeout(() => {
      setFeedbackMsg(null);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div 
        className="w-full max-w-xl max-h-[92vh] flex flex-col bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="bg-[#FF5757] text-white border-b-[3px] border-black px-4 py-2.5 flex items-center justify-between font-mono text-xs font-black shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 fill-white text-black" />
            <span className="truncate">INCIDENT REVIEW #{report.id.toUpperCase()}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black text-white border border-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 font-mono text-xs overflow-y-auto flex-1">
          {feedbackMsg ? (
            <div className="p-6 bg-[#38EF7D] border-2 border-black text-center font-black text-sm text-black space-y-2">
              <CheckCircle className="w-8 h-8 mx-auto" />
              <div>{feedbackMsg}</div>
            </div>
          ) : (
            <>
              {/* Target & Status */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-stone-100 border-2 border-black">
                <div>
                  <span className="text-[10px] text-stone-500 uppercase font-black">Subject</span>
                  <div className="font-black text-black text-sm">{report.reportedEntity}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-stone-500 uppercase font-black">Classification</span>
                  <div className="font-bold text-red-600 bg-red-100 px-2 py-0.5 border border-black inline-block ml-1">
                    {report.reason}
                  </div>
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-white border-2 border-black">
                  <span className="text-stone-500 block">Submitted By:</span>
                  <span className="font-black text-black">{report.reporter}</span>
                </div>
                <div className="p-2.5 bg-white border-2 border-black">
                  <span className="text-stone-500 block">Reported Timestamp:</span>
                  <span className="font-bold text-black">{report.submittedTime}</span>
                </div>
              </div>

              {/* Evidence box */}
              <div>
                <span className="font-black uppercase text-[11px] block mb-1">
                  Incident Evidence & Referee Notes:
                </span>
                <div className="p-3 bg-[#FFFBEB] border-2 border-black text-stone-800 leading-relaxed font-sans text-xs">
                  &ldquo;{report.evidenceText}&rdquo;
                </div>
              </div>

              {/* Current Status tag */}
              <div className="flex items-center gap-2">
                <span className="font-black uppercase text-[11px]">Current Status:</span>
                <span className={`px-2 py-0.5 border border-black font-black uppercase text-[10px] ${
                  report.status === 'Pending' ? 'bg-[#FFDE59]' :
                  report.status === 'Reviewing' ? 'bg-[#5CE1E6]' :
                  report.status === 'Resolved' ? 'bg-[#38EF7D]' : 'bg-stone-300'
                }`}>
                  {report.status}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t-2 border-black space-y-2">
                <span className="font-black uppercase text-[10px] text-stone-500 block">
                  Referee Actions (Mock):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAction('Reviewing', 'Evidence request sent to player Steam profile')}
                    className="p-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    <span>Req Evidence</span>
                  </button>

                  <button
                    onClick={() => handleAction('Reviewing', 'Formal tournament warning dispatched')}
                    className="p-2 bg-[#FFDE59] hover:bg-[#ebd048] text-black border-2 border-black font-mono font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    <span>Warn Player</span>
                  </button>

                  <button
                    onClick={() => handleAction('Resolved', 'Dispute closed & resolved by admin')}
                    className="p-2 bg-[#38EF7D] hover:bg-[#30d46e] text-black border-2 border-black font-mono font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <CheckCircle className="w-3 h-3" />
                    <span>Resolve</span>
                  </button>

                  <button
                    onClick={() => handleAction('Dismissed', 'Report dismissed as insufficient grounds')}
                    className="p-2 bg-stone-200 hover:bg-stone-300 text-black border-2 border-black font-mono font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Dismiss</span>
                  </button>

                  <button
                    onClick={() => handleAction('Resolved', 'Player disqualified from tournament bracket')}
                    className="p-2 bg-[#FF5757] hover:bg-[#e04545] text-white border-2 border-black font-mono font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer col-span-2 sm:col-span-1 flex items-center justify-center gap-1"
                  >
                    <Ban className="w-3 h-3" />
                    <span>Disqualify</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
