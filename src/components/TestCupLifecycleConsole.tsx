import React from 'react';
import { Play, Trophy, Users } from 'lucide-react';
import { testCupEngine } from '../domain/testCupEngine';

interface TestCupLifecycleConsoleProps {
  onNavigate?: (view: any, entityId?: string) => void;
}

export const TestCupLifecycleConsole: React.FC<TestCupLifecycleConsoleProps> = ({ onNavigate }) => {
  const status = testCupEngine.getStatus();

  return (
    <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] font-mono space-y-4">
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#7C3AED]" />
          <h3 className="font-sans font-black text-lg uppercase">Purple Bean Test Cup Lifecycle Console</h3>
        </div>
        <span className="text-xs bg-[#FFE600] px-2 py-0.5 border border-black font-bold uppercase">
          {status}
        </span>
      </div>
      <p className="text-xs text-stone-600">
        Controls for driving end-to-end regression simulations for the Purple Bean Test Cup.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => {
            testCupEngine.runFullTournamentSimulation();
            onNavigate?.('tournament_detail', 'purple-bean-test-cup');
          }}
          className="bg-[#70FFAF] hover:bg-[#5CE1E6] text-black border-2 border-black px-4 py-2 text-xs font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5"
        >
          <Play className="w-3.5 h-3.5 fill-black" />
          <span>Execute Full Cup Simulation</span>
        </button>
      </div>
    </div>
  );
};
