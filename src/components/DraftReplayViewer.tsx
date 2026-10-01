import React from 'react';
import { Gavel, Clock } from 'lucide-react';

interface DraftReplayViewerProps {
  tournamentId?: string;
}

export const DraftReplayViewer: React.FC<DraftReplayViewerProps> = ({ tournamentId }) => {
  return (
    <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] font-mono space-y-4">
      <div className="flex items-center gap-2 border-b-2 border-black pb-3">
        <Gavel className="w-5 h-5 text-[#7C3AED]" />
        <h3 className="font-sans font-black text-lg uppercase">Draft History & Replay</h3>
      </div>
      <p className="text-xs text-stone-600">
        Review immutable append-only draft logs, bid timestamp sequences, and purse balance audits.
      </p>
      <div className="p-8 border-2 border-dashed border-stone-300 text-center text-xs text-stone-500 italic">
        Draft replay logs are recorded live and archived upon auction completion.
      </div>
    </div>
  );
};
