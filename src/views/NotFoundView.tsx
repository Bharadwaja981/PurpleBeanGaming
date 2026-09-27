import { AlertOctagon, ArrowLeft, Swords } from 'lucide-react';
import { ViewType } from '../types/tournament';

interface NotFoundViewProps {
  onNavigate: (view: ViewType) => void;
}

export function NotFoundView({ onNavigate }: NotFoundViewProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center py-12">
      <div className="w-full max-w-lg bg-white border-[3.5px] border-black shadow-[10px_10px_0px_0px_#000] p-8 sm:p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-[#FF5757] text-white border-[3px] border-black shadow-[4px_4px_0px_0px_#000] mx-auto flex items-center justify-center text-4xl">
          <AlertOctagon className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs font-black uppercase text-stone-500 bg-stone-100 px-2 py-0.5 border border-black inline-block">
            ERROR CODE 404
          </span>
          <h1 className="text-4xl sm:text-5xl font-black uppercase text-black font-sans tracking-tight">
            BRACKET NOT FOUND
          </h1>
          <p className="font-mono text-xs sm:text-sm text-stone-600 leading-relaxed max-w-md mx-auto">
            Looks like this match went somewhere it wasn&apos;t supposed to. The bracket path, player profile, or tournament lobby may have been forfeited or rescheduled.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => onNavigate('home')}
            className="w-full sm:w-auto px-6 py-3 bg-[#FFDE59] hover:bg-[#ebd048] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <button
            onClick={() => onNavigate('tournaments')}
            className="w-full sm:w-auto px-6 py-3 bg-stone-100 hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Swords className="w-4 h-4" />
            <span>Explore Tournaments</span>
          </button>
        </div>
      </div>
    </div>
  );
}
