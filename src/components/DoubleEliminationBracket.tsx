import React from 'react';
import { Trophy, Swords } from 'lucide-react';
import { tournamentService } from '../services/firebaseService';

interface DoubleEliminationBracketProps {
  tournamentId: string;
  onSelectMatch?: (matchId: string) => void;
}

export const DoubleEliminationBracket: React.FC<DoubleEliminationBracketProps> = ({
  tournamentId,
  onSelectMatch
}) => {
  const matches = tournamentService.getMatches().filter(m => m.tournamentId === tournamentId);
  const teams = tournamentService.getTeams();

  return (
    <div className="space-y-6 bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] font-mono">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#7C3AED]" />
          <h3 className="font-sans font-black text-lg uppercase">Double Elimination Bracket</h3>
        </div>
        <span className="text-xs bg-[#FFE600] px-2 py-0.5 border border-black font-bold uppercase">
          Official Structure
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* UPPER BRACKET */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase bg-[#EDE9FE] text-[#7C3AED] px-2 py-1 border border-black">
            Upper Bracket (Winners)
          </h4>
          <div className="space-y-3">
            {matches.length === 0 ? (
              <div className="p-4 border-2 border-dashed border-stone-300 text-xs text-stone-500 italic text-center">
                Upper bracket matches will populate when tournament starts.
              </div>
            ) : (
              matches.slice(0, 2).map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMatch?.(m.id)}
                  className="border-2 border-black p-3 bg-white hover:bg-stone-50 cursor-pointer shadow-[2px_2px_0px_0px_#000]"
                >
                  <div className="text-[10px] text-stone-500 uppercase font-bold mb-1">{m.round}</div>
                  <div className="flex justify-between items-center text-xs font-bold py-1 border-b border-black/10">
                    <span>{m.teamA.name}</span>
                    <span className="font-black text-[#7C3AED]">{m.teamA.score}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold py-1">
                    <span>{m.teamB.name}</span>
                    <span className="font-black text-[#7C3AED]">{m.teamB.score}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* LOWER BRACKET */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase bg-[#FEF3C7] text-amber-800 px-2 py-1 border border-black">
            Lower Bracket (Elimination)
          </h4>
          <div className="space-y-3">
            <div className="p-4 border-2 border-dashed border-stone-300 text-xs text-stone-500 italic text-center">
              Lower bracket drops dynamically connect from upper bracket losses.
            </div>
          </div>
        </div>

        {/* GRAND FINAL */}
        <div className="space-y-4">
          <h4 className="font-bold text-xs uppercase bg-[#FFE600] text-black px-2 py-1 border border-black">
            Championship Grand Final
          </h4>
          <div className="border-2 border-black p-4 bg-white shadow-[4px_4px_0px_0px_#000] text-center space-y-2">
            <Swords className="w-6 h-6 text-[#7C3AED] mx-auto" />
            <div className="text-xs font-black uppercase">Championship Match (BO5)</div>
            <div className="text-[11px] text-stone-600">Upper Bracket Winner vs Lower Bracket Winner</div>
          </div>
        </div>
      </div>
    </div>
  );
};
