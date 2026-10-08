import React, { useState, useEffect } from 'react';
import { Match } from '../../types/tournament';
import { tournamentService } from '../../services/firebaseService';
import { dotaCompetitionEngine } from '../../domain/dotaCompetitionEngine';
import { Radio, Flame, Trophy, Swords } from 'lucide-react';

interface ObsOverlayWidgetProps {
  matchId?: string;
}

export function ObsOverlayWidget({ matchId }: ObsOverlayWidgetProps) {
  const [match, setMatch] = useState<Match | undefined>(undefined);
  const [gameTime, setGameTime] = useState<string>('28:44');

  useEffect(() => {
    const cleanId = (matchId || '').trim();
    if (!cleanId) {
      setMatch(tournamentService.getMatches()[0]);
      return;
    }

    const m = tournamentService.getMatchById(cleanId);
    if (m) {
      setMatch(m);
    } else {
      const comp = dotaCompetitionEngine.findMatch(cleanId);
      if (comp) {
        setMatch(tournamentService.getMatchById(cleanId));
      } else {
        setMatch(tournamentService.getMatches()[0]);
      }
    }

    const unsub = tournamentService.subscribe(() => {
      const updated = tournamentService.getMatchById(cleanId);
      if (updated) setMatch(updated);
    });

    return () => unsub();
  }, [matchId]);

  // Game clock ticker
  useEffect(() => {
    let sec = 44;
    let min = 28;
    const interval = setInterval(() => {
      sec++;
      if (sec >= 60) {
        sec = 0;
        min++;
      }
      setGameTime(`${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!match) return null;

  return (
    <div className="w-full h-full min-h-screen bg-transparent p-6 font-mono select-none overflow-hidden flex flex-col justify-between pointer-events-none">
      
      {/* Top Esports Scorebug (Transparent, OBS-Ready) */}
      <div className="max-w-4xl mx-auto w-full flex items-center justify-center">
        <div className="bg-black/90 border-[3.5px] border-black text-white shadow-[6px_6px_0px_0px_#000] flex items-center overflow-hidden">
          
          {/* Team A */}
          <div className="px-5 py-3 flex items-center gap-3 bg-stone-900 border-r-2 border-stone-800">
            <span className="text-2xl">{match.teamA.logo || '🛡️'}</span>
            <div className="text-left">
              <span className="font-sans font-black text-lg text-white uppercase block leading-none">
                {match.teamA.name}
              </span>
              <span className="text-[10px] text-emerald-400 font-bold">
                {match.teamA.city || 'INDIA'} · [{match.teamA.tag}]
              </span>
            </div>
          </div>

          {/* Team A Score */}
          <div className="px-5 py-3 bg-[#111] text-2xl font-black text-[#FFE600] border-r-2 border-stone-800">
            {match.teamA.score}
          </div>

          {/* Center Match Info / Clock */}
          <div className="px-6 py-2.5 bg-[#7C3AED] text-white flex flex-col items-center justify-center border-r-2 border-stone-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-[#FFE600]">
              {match.round} · {match.seriesFormat || 'BO3'}
            </span>
            <span className="text-sm font-black tracking-widest">
              {gameTime}
            </span>
            <div className="flex items-center gap-1 text-[9px] text-white/90">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />
              <span>MAP {match.currentGame || 1}</span>
            </div>
          </div>

          {/* Team B Score */}
          <div className="px-5 py-3 bg-[#111] text-2xl font-black text-[#FFE600] border-r-2 border-stone-800">
            {match.teamB.score}
          </div>

          {/* Team B */}
          <div className="px-5 py-3 flex items-center gap-3 bg-stone-900">
            <div className="text-right">
              <span className="font-sans font-black text-lg text-white uppercase block leading-none">
                {match.teamB.name}
              </span>
              <span className="text-[10px] text-rose-400 font-bold">
                [{match.teamB.tag}] · {match.teamB.city || 'INDIA'}
              </span>
            </div>
            <span className="text-2xl">{match.teamB.logo || '⚔️'}</span>
          </div>

        </div>
      </div>

      {/* Bottom Caster Lower-Third & Telemetry Banner */}
      <div className="max-w-xl mx-auto w-full">
        <div className="bg-[#FFE600] border-[3px] border-black p-2.5 shadow-[4px_4px_0px_0px_#000] flex items-center justify-between text-black text-xs font-black uppercase">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-600 animate-pulse" />
            <span>PURPLE BEAN TOURNAMENT OBSERVER</span>
          </div>
          <div className="text-[11px] text-stone-800">
            🎙️ {match.casterNames || 'Official Desk'}
          </div>
        </div>
      </div>

    </div>
  );
}
