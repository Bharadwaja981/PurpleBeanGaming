import React from 'react';
import { AlertCircle, ArrowLeft, Home, Trophy } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface NotFoundViewProps {
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function NotFoundView({ onNavigate }: NotFoundViewProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border-[3.5px] border-black p-8 text-center shadow-[8px_8px_0px_0px_#000] space-y-6">
        <div className="w-16 h-16 bg-[#FF5757] border-[3.5px] border-black shadow-[4px_4px_0px_0px_#000] mx-auto flex items-center justify-center">
          <AlertCircle className="w-9 h-9 text-white" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs font-black uppercase text-[#FF5757] bg-red-100 px-2 py-0.5 border border-black inline-block">
            404 Error · Page Missing
          </span>
          <h2 className="text-3xl font-black uppercase text-black font-sans">
            Arena Not Found
          </h2>
          <p className="font-mono text-xs text-stone-600 leading-relaxed">
            The requested tournament view, bracket sheet, or contender record does not exist or has been archived.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#FFE600] hover:bg-yellow-400 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </button>
          <button
            onClick={() => onNavigate('tournaments')}
            className="w-full sm:w-auto px-5 py-2.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span>Tournaments</span>
          </button>
        </div>
      </div>
    </div>
  );
}
