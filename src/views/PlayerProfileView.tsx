import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Trophy, 
  Shield, 
  User, 
  MapPin, 
  CheckCircle2, 
  Flame, 
  Star, 
  Award, 
  BarChart3,
  Swords,
  Crown,
  ExternalLink
} from 'lucide-react';
import { Player, ViewType } from '../types/tournament';
import { tournamentService } from '../services/firebaseService';
import { dotaPlayerRegistry } from '../domain/dotaPlayerEngine';

interface PlayerProfileViewProps {
  playerId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export function PlayerProfileView({ playerId, onNavigate }: PlayerProfileViewProps) {
  const [player, setPlayer] = useState<Player | undefined>(undefined);

  useEffect(() => {
    if (playerId) {
      const p = tournamentService.getPlayerById(playerId);
      if (p) {
        setPlayer(p);
      } else {
        const dotaP = dotaPlayerRegistry.getPlayer(playerId);
        if (dotaP) {
          setPlayer({
            id: dotaP.id,
            username: dotaP.username,
            displayName: dotaP.displayName,
            realName: dotaP.displayName,
            avatar: dotaP.avatar || '🎮',
            country: 'India',
            flag: '🇮🇳',
            city: dotaP.city || 'Mumbai',
            region: dotaP.region || 'Pan India',
            primaryGame: 'Dota 2',
            mmr: dotaP.tournamentMmr || 5500,
            tournamentMmr: dotaP.tournamentMmr || 5500,
            platformRating: dotaP.competitiveRating || 1500,
            primaryRole: dotaP.primaryRole || 'Position 1 — Carry',
            secondaryRole: dotaP.secondaryRole || 'Position 2 — Mid',
            teamId: (dotaP as any).teamId,
            teamName: (dotaP as any).teamName,
            status: 'Verified',
            matches: 24,
            wins: 16,
            losses: 8,
            winRate: 67,
            tournamentWins: 2,
            mvps: 4,
            experienceYears: 4,
            bio: 'Competitive Indian esports contender registered on the Purple Bean Gaming Circuit.',
            heroPool: [
              { hero: 'Shadow Fiend', games: 12, winRate: 75 },
              { hero: 'Invoker', games: 8, winRate: 62 },
              { hero: 'Storm Spirit', games: 4, winRate: 50 }
            ]
          });
        } else {
          setPlayer(tournamentService.getPlayers()[0]);
        }
      }
    } else {
      setPlayer(tournamentService.getPlayers()[0]);
    }
  }, [playerId]);

  if (!player) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4">
        <h2 className="text-2xl font-black uppercase text-black font-sans">
          Player Profile Not Found
        </h2>
        <p className="font-mono text-xs text-stone-600">
          The requested contender record could not be found in the player directory.
        </p>
        <button
          onClick={() => onNavigate('players')}
          className="px-5 py-2.5 bg-[#FFE600] text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer"
        >
          ← Return to Player Directory
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Back Button */}
      <div>
        <button
          onClick={() => onNavigate('players')}
          className="px-4 py-2 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to All Players</span>
        </button>
      </div>

      {/* Main Profile Header */}
      <div className="bg-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b-2 border-black">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-[#FFE600] border-[3.5px] border-black text-4xl flex items-center justify-center shadow-[4px_4px_0px_0px_#000]">
              {player.avatar || '🎮'}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-4xl font-black uppercase text-black font-sans">
                  {player.username}
                </h1>
                <span className="px-2 py-0.5 bg-[#70FFAF] text-black border border-black font-mono text-[10px] font-black uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-black" />
                  <span>{player.status || 'Verified'}</span>
                </span>
              </div>
              <p className="font-mono text-xs text-stone-600 flex items-center gap-2">
                <span>{player.realName || player.displayName}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-stone-500" />
                  {player.city || 'India'} ({player.region || 'Pan India'}) {player.flag || '🇮🇳'}
                </span>
              </p>
            </div>
          </div>

          {/* Team Affiliation Badge */}
          {player.teamName ? (
            <div 
              onClick={() => player.teamId && onNavigate('team_profile', player.teamId)}
              className="bg-[#F3E8FF] border-2 border-black p-3.5 shadow-[3px_3px_0px_0px_#000] cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">
                Current Franchise
              </span>
              <span className="font-sans font-black text-sm uppercase text-[#7C3AED] flex items-center gap-1.5">
                <span>{player.teamName}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </span>
            </div>
          ) : (
            <div className="bg-stone-100 border-2 border-black p-3.5 font-mono text-xs font-bold text-stone-600">
              Free Agent / Auction Pool
            </div>
          )}
        </div>

        {/* Stats Matrix Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-stone-50 border-2 border-black p-4 space-y-1 shadow-[2px_2px_0px_0px_#000]">
            <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Tournament MMR</span>
            <span className="font-mono text-2xl font-black text-black">
              {player.tournamentMmr || player.mmr || 5000}
            </span>
          </div>

          <div className="bg-stone-50 border-2 border-black p-4 space-y-1 shadow-[2px_2px_0px_0px_#000]">
            <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Platform Rating</span>
            <span className="font-mono text-2xl font-black text-[#7C3AED]">
              {player.platformRating || 1500}
            </span>
          </div>

          <div className="bg-stone-50 border-2 border-black p-4 space-y-1 shadow-[2px_2px_0px_0px_#000]">
            <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Win Rate</span>
            <span className="font-mono text-2xl font-black text-emerald-700">
              {player.winRate ?? 65}%
            </span>
          </div>

          <div className="bg-stone-50 border-2 border-black p-4 space-y-1 shadow-[2px_2px_0px_0px_#000]">
            <span className="font-mono text-[10px] font-black uppercase text-stone-500 block">Matches Played</span>
            <span className="font-mono text-2xl font-black text-black">
              {player.matches ?? 20}
            </span>
          </div>
        </div>

        {/* Roles and Hero Pool */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Roles Breakdown */}
          <div className="border-2 border-black p-5 space-y-3 bg-white">
            <h4 className="font-sans font-black text-sm uppercase text-black flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#7C3AED]" />
              <span>Competitive Role Versatility</span>
            </h4>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between p-2 bg-stone-50 border border-black">
                <span className="text-stone-600 font-bold uppercase">Primary Role:</span>
                <span className="font-black text-black">{player.primaryRole}</span>
              </div>
              <div className="flex justify-between p-2 bg-stone-50 border border-black">
                <span className="text-stone-600 font-bold uppercase">Secondary Role:</span>
                <span className="font-black text-black">{player.secondaryRole}</span>
              </div>
            </div>
          </div>

          {/* Signature Heroes */}
          <div className="border-2 border-black p-5 space-y-3 bg-white">
            <h4 className="font-sans font-black text-sm uppercase text-black flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>Signature Hero Pool</span>
            </h4>
            <div className="space-y-2 font-mono text-xs">
              {(player.heroPool && player.heroPool.length > 0 ? player.heroPool : [
                { hero: 'Invoker', games: 15, winRate: 72 },
                { hero: 'Shadow Fiend', games: 11, winRate: 64 },
                { hero: 'Storm Spirit', games: 8, winRate: 60 }
              ]).map(h => (
                <div key={h.hero} className="flex justify-between items-center p-2 bg-stone-50 border border-black">
                  <span className="font-black text-black">{h.hero}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-stone-500">{h.games} Games</span>
                    <span className="font-black text-emerald-700">{h.winRate}% WR</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
