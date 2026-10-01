import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trophy, 
  Clock, 
  Radio, 
  Shield, 
  Swords, 
  MapPin, 
  Tv, 
  CheckCircle2, 
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Match, ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';

interface MatchDetailViewProps {
  matchId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function MatchDetailView({ matchId, onNavigate }: MatchDetailViewProps) {
  const [match, setMatch] = useState<Match | undefined>(undefined);

  useEffect(() => {
    if (matchId) {
      const found = tournamentService.getMatchById(matchId);
      setMatch(found || tournamentService.getMatches()[0]);
    } else {
      setMatch(tournamentService.getMatches()[0]);
    }

    const unsub = tournamentService.subscribe(() => {
      if (matchId) {
        setMatch(tournamentService.getMatchById(matchId) || tournamentService.getMatches()[0]);
      }
    });
    return unsub;
  }, [matchId]);

  if (!match) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4">
        <h2 className="text-2xl font-black uppercase text-black font-sans">
          Match Not Found
        </h2>
        <p className="font-mono text-xs text-stone-600">
          The requested competitive match could not be retrieved from the active tournament schedule.
        </p>
        <button
          onClick={() => onNavigate('matches')}
          className="px-5 py-2.5 bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          ← Return to All Matches
        </button>
      </div>
    );
  }

  const isLive = match.status === 'LIVE' || match.isLive;
  const isCompleted = match.status === 'COMPLETED';

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Back Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate('matches')}
          className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Matches</span>
        </button>

        <div className="flex items-center gap-2 font-mono text-xs font-bold text-stone-600">
          <span>Tournament:</span>
          <button
            onClick={() => onNavigate('tournament_detail', match.tournamentId)}
            className="text-[#7C3AED] hover:underline font-black cursor-pointer uppercase flex items-center gap-1"
          >
            <span>{match.tournamentName || 'Tournament'}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Match Banner & Scoreboard */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
        {/* Top Status Header */}
        <div className="bg-black text-white p-4 flex flex-wrap items-center justify-between gap-3 font-mono text-xs font-black uppercase">
          <div className="flex items-center gap-2">
            <span className="text-[#FFE600]">{match.round}</span>
            <span>·</span>
            <span className="text-stone-300">{match.seriesFormat || 'Best of 3'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 border border-white text-[10px] ${
              isLive ? 'bg-[#FF5757] text-white animate-pulse' :
              isCompleted ? 'bg-[#70FFAF] text-black' :
              'bg-stone-800 text-stone-300'
            }`}>
              {isLive ? '🔴 LIVE BROADCAST' : isCompleted ? 'FINAL RESULT' : 'UPCOMING FIXTURE'}
            </span>
            <span className="text-stone-400">{match.scheduledTime}</span>
          </div>
        </div>

        {/* Head-to-Head Main Section */}
        <div className="p-6 sm:p-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Team A */}
          <div 
            onClick={() => onNavigate('team_profile', match.teamA.id)}
            className={`p-6 border-2 border-black space-y-3 cursor-pointer transition-all hover:-translate-y-0.5 shadow-[4px_4px_0px_0px_#000] ${
              match.winnerId === match.teamA.id ? 'bg-[#70FFAF]/30' : 'bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{match.teamA.logo || '🛡️'}</span>
              <div>
                <h3 className="font-sans font-black text-xl uppercase text-black">
                  {match.teamA.name}
                </h3>
                <span className="font-mono text-xs font-bold text-stone-600 block">
                  [{match.teamA.tag}] {match.teamA.city ? `· ${match.teamA.city}` : ''}
                </span>
              </div>
            </div>
            {match.winnerId === match.teamA.id && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#70FFAF] text-black border border-black font-mono text-[10px] font-black uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> Winner
              </div>
            )}
          </div>

          {/* Versus & Score Core */}
          <div className="text-center space-y-2">
            <div className="font-mono text-4xl sm:text-6xl font-black text-black tracking-widest flex items-center justify-center gap-4">
              <span className={match.winnerId === match.teamA.id ? 'text-black' : 'text-stone-700'}>
                {match.teamA.score ?? 0}
              </span>
              <span className="text-stone-300">:</span>
              <span className={match.winnerId === match.teamB.id ? 'text-black' : 'text-stone-700'}>
                {match.teamB.score ?? 0}
              </span>
            </div>
            <span className="font-mono text-xs font-black uppercase bg-[#FFE600] text-black px-2.5 py-0.5 border border-black inline-block">
              {isCompleted ? 'Match Completed' : isLive ? 'Series in Progress' : 'Awaiting Match Start'}
            </span>
          </div>

          {/* Team B */}
          <div 
            onClick={() => onNavigate('team_profile', match.teamB.id)}
            className={`p-6 border-2 border-black space-y-3 cursor-pointer transition-all hover:-translate-y-0.5 shadow-[4px_4px_0px_0px_#000] ${
              match.winnerId === match.teamB.id ? 'bg-[#70FFAF]/30' : 'bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <span className="text-4xl">{match.teamB.logo || '🛡️'}</span>
              <div>
                <h3 className="font-sans font-black text-xl uppercase text-black">
                  {match.teamB.name}
                </h3>
                <span className="font-mono text-xs font-bold text-stone-600 block">
                  [{match.teamB.tag}] {match.teamB.city ? `· ${match.teamB.city}` : ''}
                </span>
              </div>
            </div>
            {match.winnerId === match.teamB.id && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#70FFAF] text-black border border-black font-mono text-[10px] font-black uppercase">
                <CheckCircle2 className="w-3.5 h-3.5" /> Winner
              </div>
            )}
          </div>
        </div>

        {/* Live Stream / Broadcast Link */}
        {isLive && (
          <div className="bg-[#FF5757] text-white p-4 border-t-2 border-black flex items-center justify-between font-mono text-xs font-black uppercase">
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4 animate-pulse" />
              <span>Official Observer Broadcast Active</span>
            </div>
            <button 
              onClick={() => window.open(match.streamUrl || 'https://twitch.tv', '_blank')}
              className="px-4 py-1.5 bg-black text-white hover:bg-stone-900 border border-white flex items-center gap-1.5 cursor-pointer"
            >
              <span>Watch Live Stream ↗</span>
            </button>
          </div>
        )}
      </div>

      {/* Series Match Details & Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <h4 className="font-sans font-black text-lg uppercase text-black flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#7C3AED]" />
            <span>Match Operations & Verification</span>
          </h4>
          <div className="space-y-3 font-mono text-xs text-stone-700">
            <div className="flex justify-between border-b border-black/10 pb-2">
              <span className="font-bold text-stone-500 uppercase">Server Region:</span>
              <span className="font-black text-black">India / Mumbai Dedicated Valve Relay</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-2">
              <span className="font-bold text-stone-500 uppercase">Anti-Cheat Enforcement:</span>
              <span className="font-black text-black">VAC + Server Audit Trail Enabled</span>
            </div>
            <div className="flex justify-between border-b border-black/10 pb-2">
              <span className="font-bold text-stone-500 uppercase">Lobby Referee:</span>
              <span className="font-black text-black">Purple Bean Tournament Marshal</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold text-stone-500 uppercase">Roster Integrity:</span>
              <span className="font-black text-emerald-700">✓ 5 Verified Registered Contenders</span>
            </div>
          </div>
        </div>

        <div className="bg-[#F3E8FF] border-[3.5px] border-black p-6 space-y-4 shadow-[6px_6px_0px_0px_#000]">
          <h4 className="font-sans font-black text-lg uppercase text-black flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <span>Bracket Advancement</span>
          </h4>
          <p className="font-mono text-xs text-stone-700 leading-relaxed">
            The winning team advances directly to the next stage of the double-elimination bracket. Losers fall into Lower Bracket deciders according to standard tournament routing rules.
          </p>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('bracket')}
              className="px-4 py-2 bg-black text-[#FFE600] border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              View Full Tournament Bracket →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
