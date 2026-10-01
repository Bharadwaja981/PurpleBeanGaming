import React from 'react';
import { Layers, Trophy, CheckCircle } from 'lucide-react';

interface CompetitionStructureManagerProps {
  tournamentId: string;
}

export const CompetitionStructureManager: React.FC<CompetitionStructureManagerProps> = ({ tournamentId }) => {
  return (
    <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] font-mono space-y-4">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#7C3AED]" />
          <h3 className="font-sans font-black text-lg uppercase">Competition Structure & Format</h3>
        </div>
        <span className="text-xs bg-[#70FFAF] text-black px-2 py-0.5 border border-black font-bold uppercase flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          <span>Configured</span>
        </span>
      </div>
      <p className="text-xs text-stone-600">
        Review tournament seeding, elimination structure rules, and automated playoff progression paths.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold pt-2">
        <div className="border-2 border-black p-3 bg-stone-50">
          <div className="text-[10px] text-stone-500 uppercase">Elimination Format</div>
          <div className="text-sm font-black text-black">Championship Series</div>
        </div>
        <div className="border-2 border-black p-3 bg-stone-50">
          <div className="text-[10px] text-stone-500 uppercase">Series Format</div>
          <div className="text-sm font-black text-black">Best of 3 (Finals BO5)</div>
        </div>
        <div className="border-2 border-black p-3 bg-stone-50">
          <div className="text-[10px] text-stone-500 uppercase">Seeding Algorithm</div>
          <div className="text-sm font-black text-black">Competitive MMR / Rating</div>
        </div>
      </div>
    </div>
  );
};
