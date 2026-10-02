import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft,
  Clock,
  Swords,
  Trophy,
  ExternalLink,
  TrendingUp,
  HelpCircle
} from 'lucide-react';
import { ViewType } from '../types/tournament';
import { 
  openDotaService, 
  OpenDotaMatchSnapshot, 
  OpenDotaMatchPlayerSlot,
  DOTA_GAME_MODES,
  DOTA_LOBBY_TYPES
} from '../services/openDotaService';
import { 
  getHeroName, 
  getHeroImage, 
  DOTA_REGIONS 
} from '../services/dotaConstants';
import { DotaItemIcon } from '../components/dota/DotaItemIcon';

interface DotaMatchDetailViewProps {
  matchId?: string;
  onNavigate: (view: ViewType, entityId?: string) => void;
}

export type MatchTab = 
  | 'OVERVIEW'
  | 'DRAFT'
  | 'PERFORMANCE'
  | 'BENCHMARKS'
  | 'DAMAGE'
  | 'PURCHASES'
  | 'FARM'
  | 'COMBAT'
  | 'GRAPHS'
  | 'CASTS'
  | 'VISION'
  | 'OBJECTIVES'
  | 'TEAMFIGHTS'
  | 'ACTIONS'
  | 'ANALYSIS'
  | 'LOG'
  | 'CHAT';

export function DotaMatchDetailView({ matchId, onNavigate }: DotaMatchDetailViewProps) {
  const [matchData, setMatchData] = useState<OpenDotaMatchSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MatchTab>('OVERVIEW');

  // Single GET /matches/{matchId} fetch
  useEffect(() => {
    let isCancelled = false;
    const cleanId = (matchId || '').trim();
    if (!cleanId) {
      setError('No match ID specified.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    openDotaService.fetchMatch(cleanId)
      .then((data) => {
        if (isCancelled) return;
        setMatchData(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Failed to retrieve match:', err);
        const fallback = openDotaService.getMatchSync(cleanId);
        setMatchData(fallback);
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [matchId]);

  const durationMin = matchData ? Math.floor(matchData.durationSeconds / 60) : 0;
  const durationSec = matchData ? matchData.durationSeconds % 60 : 0;
  const radiantWin = matchData?.radiantWin ?? false;

  const radiantPlayers = useMemo(() => {
    return (matchData?.players || []).filter((p) => p.isRadiant);
  }, [matchData]);

  const direPlayers = useMemo(() => {
    return (matchData?.players || []).filter((p) => !p.isRadiant);
  }, [matchData]);

  const radiantKills = radiantPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);
  const direKills = direPlayers.reduce((sum, p) => sum + (p.kills || 0), 0);

  const radiantNet = radiantPlayers.reduce((sum, p) => sum + (p.netWorth || (p.gpm * durationMin) || 0), 0);
  const direNet = direPlayers.reduce((sum, p) => sum + (p.netWorth || (p.gpm * durationMin) || 0), 0);
  const netDiff = Math.abs(radiantNet - direNet);
  const leadTeam = radiantNet >= direNet ? 'The Radiant' : 'The Dire';

  const regionName = matchData?.region && typeof matchData.region === 'number'
    ? DOTA_REGIONS[matchData.region] || `Region #${matchData.region}`
    : 'Global';

  const gameModeName = matchData?.gameMode && typeof matchData.gameMode === 'number'
    ? DOTA_GAME_MODES[matchData.gameMode] || `Mode #${matchData.gameMode}`
    : 'All Pick';

  const lobbyTypeName = matchData?.lobbyType && typeof matchData.lobbyType === 'number'
    ? DOTA_LOBBY_TYPES[matchData.lobbyType] || `Lobby #${matchData.lobbyType}`
    : 'Ranked';

  const raw = matchData?.rawMatch || {};
  const hasDraft = Boolean((matchData?.picksBans && matchData.picksBans.length > 0) || raw.draft_timings);
  const hasBenchmarks = Boolean(matchData?.players?.some((p) => p.benchmarks && Object.keys(p.benchmarks).length > 0));
  const hasPurchases = Boolean(matchData?.players?.some((p) => p.purchase_log && p.purchase_log.length > 0));
  const hasGraphs = Boolean((matchData?.radiantGoldAdv && matchData.radiantGoldAdv.length > 0) || (matchData?.radiantXpAdv && matchData.radiantXpAdv.length > 0));
  const hasVision = Boolean(matchData?.players?.some((p) => (p.obs_log && p.obs_log.length > 0) || (p.sen_log && p.sen_log.length > 0)));
  const hasObjectives = Boolean(matchData?.objectives && matchData.objectives.length > 0);
  const hasTeamfights = Boolean(matchData?.teamfights && matchData.teamfights.length > 0);
  const hasChat = Boolean(matchData?.chat && matchData.chat.length > 0);
  const hasActions = Boolean(matchData?.players?.some((p) => p.actions && Object.keys(p.actions).length > 0));

  const TABS: { id: MatchTab; label: string; available: boolean }[] = [
    { id: 'OVERVIEW', label: 'Overview', available: true },
    { id: 'DRAFT', label: 'Draft', available: hasDraft },
    { id: 'PERFORMANCE', label: 'Performance', available: true },
    { id: 'BENCHMARKS', label: 'Benchmarks', available: hasBenchmarks },
    { id: 'DAMAGE', label: 'Damage', available: true },
    { id: 'PURCHASES', label: 'Purchases', available: hasPurchases },
    { id: 'FARM', label: 'Farm', available: true },
    { id: 'COMBAT', label: 'Combat', available: true },
    { id: 'GRAPHS', label: 'Graphs', available: hasGraphs },
    { id: 'CASTS', label: 'Casts', available: true },
    { id: 'VISION', label: 'Vision', available: hasVision },
    { id: 'OBJECTIVES', label: 'Objectives', available: hasObjectives },
    { id: 'TEAMFIGHTS', label: 'Teamfights', available: hasTeamfights },
    { id: 'ACTIONS', label: 'Actions', available: hasActions },
    { id: 'ANALYSIS', label: 'Analysis', available: true },
    { id: 'LOG', label: 'Log', available: hasPurchases || Boolean(raw.buyback_log) },
    { id: 'CHAT', label: 'Chat', available: hasChat }
  ];

  if (isLoading) {
    return (
      <div className="bg-white border-[3.5px] border-black p-12 text-center shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
        <div className="w-10 h-10 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
        <h3 className="text-xl font-black uppercase text-black font-sans">
          Retrieving Dota 2 Match #{matchId}...
        </h3>
        <p className="text-xs text-stone-600">
          Querying authoritative OpenDota match record and player slot telemetry.
        </p>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="bg-white border-[3.5px] border-black p-10 text-center shadow-[6px_6px_0px_0px_#000] space-y-4 font-mono">
        <h3 className="text-2xl font-black uppercase text-black font-sans">
          Match Not Found
        </h3>
        <p className="text-xs text-stone-600 max-w-md mx-auto">
          {error || `Unable to retrieve official scoreboard for Match #${matchId}.`}
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-[#FFE600] text-black border-2 border-black font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
        >
          ← Return
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-mono animate-in fade-in duration-200 pb-16">
      
      {/* Back Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => window.history.back()}
          className="px-3.5 py-1.5 bg-white hover:bg-stone-100 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500 font-bold uppercase">MATCH ARCHIVE:</span>
          <span className="font-black text-black">#{matchData.matchId}</span>
          <a
            href={`https://www.opendota.com/matches/${matchData.matchId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7C3AED] hover:underline font-bold flex items-center gap-1 text-[11px] ml-2"
          >
            <span>OpenDota</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* TOP HEADER */}
      <div className="bg-[#171a21] text-white border-[3.5px] border-black shadow-[8px_8px_0px_0px_#000] overflow-hidden">
        
        {/* Upper Metadata Ribbon */}
        <div className="bg-black text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-stone-800 font-mono">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[#FFE600] font-black">MATCH #{matchData.matchId}</span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-300 font-bold">{gameModeName}</span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-400">{lobbyTypeName}</span>
            <span className="text-stone-600">·</span>
            <span className="text-stone-400">{regionName}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-stone-400">
              Patch {matchData.patch ? `7.${matchData.patch}` : '7.37e'}
            </span>
            <span className="text-stone-600">·</span>
            <span className={`px-2 py-0.5 border text-[10px] font-black uppercase ${
              matchData.parsed 
                ? 'bg-[#70FFAF] text-black border-black' 
                : 'bg-stone-800 text-stone-400 border-stone-700'
            }`}>
              {matchData.parsed ? 'PARSED REPLAY' : 'UNPARSED'}
            </span>
          </div>
        </div>

        {/* Center Versus Banner */}
        <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          
          {/* Radiant Side */}
          <div className={`p-4 border-2 ${radiantWin ? 'border-emerald-500 bg-emerald-950/30' : 'border-stone-800 bg-black/40'} flex items-center justify-between`}>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-sans font-black text-lg sm:text-xl text-[#38EF7D] uppercase">
                  THE RADIANT
                </span>
                {radiantWin && (
                  <span className="px-2 py-0.5 bg-[#38EF7D] text-black text-[10px] font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">
                    VICTOR
                  </span>
                )}
              </div>
              <span className="text-xs text-stone-400 font-mono block mt-0.5">
                {(radiantNet / 1000).toFixed(1)}k Net Worth
              </span>
            </div>
            <span className="text-4xl sm:text-5xl font-black font-mono text-white">
              {matchData.radiantScore || radiantKills}
            </span>
          </div>

          {/* Center Duration Info */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-stone-900 border border-stone-700 text-[#FFE600] font-black text-sm">
              <Clock className="w-4 h-4" />
              <span>{durationMin}:{durationSec.toString().padStart(2, '0')}</span>
            </div>
            <div className="text-[11px] text-stone-400 font-mono">
              Lead: <strong className="text-white">{leadTeam} +{(netDiff / 1000).toFixed(1)}k</strong>
            </div>
            <div className="text-[10px] text-stone-500">
              {matchData.startTime ? new Date(matchData.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent Match'}
            </div>
          </div>

          {/* Dire Side */}
          <div className={`p-4 border-2 ${!radiantWin ? 'border-red-500 bg-red-950/30' : 'border-stone-800 bg-black/40'} flex items-center justify-between`}>
            <span className="text-4xl sm:text-5xl font-black font-mono text-white order-2 md:order-1">
              {matchData.direScore || direKills}
            </span>
            <div className="text-right order-1 md:order-2">
              <div className="flex items-center justify-end gap-2">
                {!radiantWin && (
                  <span className="px-2 py-0.5 bg-[#FF5757] text-white text-[10px] font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">
                    VICTOR
                  </span>
                )}
                <span className="font-sans font-black text-lg sm:text-xl text-red-400 uppercase">
                  THE DIRE
                </span>
              </div>
              <span className="text-xs text-stone-400 font-mono block mt-0.5">
                {(direNet / 1000).toFixed(1)}k Net Worth
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* MATCH NAVIGATION TABS */}
      <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000] p-1.5 flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-black uppercase transition-all whitespace-nowrap cursor-pointer border ${
                isActive
                  ? 'bg-black text-[#FFE600] border-black shadow-[2px_2px_0px_0px_#000]'
                  : tab.available
                    ? 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-transparent'
                    : 'bg-stone-100 text-stone-400 border-dashed border-stone-300'
              }`}
            >
              {tab.label}
              {!tab.available && (
                <span className="ml-1 text-[9px] text-stone-400 lowercase font-normal">(n/a)</span>
              )}
            </button>
          );
        })}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {renderTeamScoreboard('THE RADIANT', radiantPlayers, true, radiantWin, onNavigate)}
          {renderTeamScoreboard('THE DIRE', direPlayers, false, !radiantWin, onNavigate)}

          {/* Picks & Bans Summary */}
          {hasDraft && matchData.picksBans && (
            <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                <div className="flex items-center gap-2">
                  <Swords className="w-5 h-5 text-black" />
                  <h3 className="font-sans text-base font-black uppercase text-black">
                    Draft &amp; Pick / Ban Sequence
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-500">
                  {matchData.picksBans.length} Phases Logged
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-2">
                {matchData.picksBans.map((pb, idx) => {
                  const heroName = getHeroName(pb.heroId);
                  const heroImg = getHeroImage(pb.heroId);
                  return (
                    <div
                      key={idx}
                      className={`p-2 border-2 ${
                        pb.team === 'radiant' ? 'border-emerald-600 bg-emerald-50/50' : 'border-red-600 bg-red-50/50'
                      } text-center space-y-1.5 shadow-[2px_2px_0px_0px_#000]`}
                    >
                      <span className={`text-[9px] font-black uppercase block ${
                        pb.isPick ? 'text-black' : 'text-stone-400 line-through'
                      }`}>
                        {pb.isPick ? `Pick #${pb.order + 1}` : `Ban #${pb.order + 1}`}
                      </span>
                      <img
                        src={heroImg}
                        alt={heroName}
                        className={`w-12 h-12 object-cover border border-black bg-stone-900 mx-auto ${
                          !pb.isPick ? 'grayscale opacity-60' : ''
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getHeroImage(null);
                        }}
                      />
                      <span className="text-[10px] font-black text-black truncate block">
                        {heroName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advantage Graphs Preview */}
          {hasGraphs && (
            <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-sans text-base font-black uppercase text-black">
                    Radiant Gold &amp; Experience Advantage Timeline
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-500">
                  Per-Minute Differential
                </span>
              </div>

              {renderAdvantageGraph(matchData.radiantGoldAdv || [], 'Gold Advantage (Net Worth)', '#FFE600')}
              {matchData.radiantXpAdv && matchData.radiantXpAdv.length > 0 && (
                renderAdvantageGraph(matchData.radiantXpAdv, 'Experience Advantage (XP)', '#60A5FA')
              )}
            </div>
          )}

          {/* Objectives Timeline */}
          {hasObjectives && matchData.objectives && (
            <div className="bg-white border-[3px] border-black shadow-[6px_6px_0px_0px_#000] p-5 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-black pb-2.5">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h3 className="font-sans text-base font-black uppercase text-black">
                    Major Objectives &amp; Structures Timeline
                  </h3>
                </div>
                <span className="text-xs font-bold text-stone-500">
                  {matchData.objectives.length} Objectives Recorded
                </span>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {matchData.objectives.map((obj: any, idx: number) => {
                  const timeMin = Math.floor((obj.time || 0) / 60);
                  const timeSec = (obj.time || 0) % 60;
                  return (
                    <div 
                      key={idx}
                      className="p-2.5 bg-stone-50 border border-black flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="px-1.5 py-0.5 bg-black text-[#FFE600] font-black text-[10px]">
                          {timeMin}:{timeSec.toString().padStart(2, '0')}
                        </span>
                        <strong className="text-black uppercase">
                          {obj.type ? String(obj.type).replace(/_/g, ' ') : 'Objective Achieved'}
                        </strong>
                        {obj.key && (
                          <span className="text-stone-600 font-normal">({String(obj.key).replace(/_/g, ' ')})</span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-stone-500">
                        {obj.team === 2 ? 'Radiant Team' : obj.team === 3 ? 'Dire Team' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DRAFT TAB */}
      {activeTab === 'DRAFT' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            Full Draft Timings &amp; Pick / Ban Analysis
          </h3>
          {matchData.picksBans && matchData.picksBans.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {matchData.picksBans.map((pb, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 border-2 ${pb.team === 'radiant' ? 'border-emerald-600 bg-emerald-50' : 'border-red-600 bg-red-50'} text-center space-y-2`}
                >
                  <span className="text-xs font-black uppercase text-stone-700">
                    Phase {pb.order + 1} · {pb.team.toUpperCase()}
                  </span>
                  <img
                    src={getHeroImage(pb.heroId)}
                    alt={getHeroName(pb.heroId)}
                    className="w-16 h-16 object-cover border border-black bg-stone-900 mx-auto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = getHeroImage(null);
                    }}
                  />
                  <strong className="block text-xs uppercase">{getHeroName(pb.heroId)}</strong>
                  <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase border border-black ${
                    pb.isPick ? 'bg-[#70FFAF] text-black' : 'bg-[#FF5757] text-white'
                  }`}>
                    {pb.isPick ? 'PICK' : 'BAN'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500">Draft data not parsed for this match.</p>
          )}
        </div>
      )}

      {/* PERFORMANCE / DAMAGE TAB */}
      {(activeTab === 'PERFORMANCE' || activeTab === 'DAMAGE') && (
        <div className="space-y-6">
          {renderTeamScoreboard('THE RADIANT', radiantPlayers, true, radiantWin, onNavigate)}
          {renderTeamScoreboard('THE DIRE', direPlayers, false, !radiantWin, onNavigate)}
        </div>
      )}

      {/* BENCHMARKS TAB */}
      {activeTab === 'BENCHMARKS' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            Player Benchmark Percentiles
          </h3>
          {hasBenchmarks ? (
            <div className="space-y-4">
              {matchData.players.map((p) => {
                const benchmarks = p.benchmarks || {};
                return (
                  <div key={p.playerSlot} className="p-3 bg-stone-50 border-2 border-black space-y-2">
                    <div className="flex items-center gap-3">
                      <img 
                        src={getHeroImage(p.heroId)} 
                        alt={getHeroName(p.heroId)} 
                        className="w-8 h-8 object-cover border border-black bg-stone-900" 
                        onError={(e) => { (e.target as HTMLImageElement).src = getHeroImage(null); }}
                      />
                      <strong className="text-xs font-black uppercase">{getHeroName(p.heroId)}</strong>
                      <span className="text-xs text-stone-600">({p.personaName || 'Anonymous'})</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs">
                      {Object.entries(benchmarks).map(([k, v]: any) => (
                        <div key={k} className="p-1.5 bg-white border border-black text-center">
                          <span className="text-[10px] text-stone-500 uppercase block">{k.replace(/_/g, ' ')}</span>
                          <strong className="text-purple-700 block">{(v.pct * 100).toFixed(0)}%</strong>
                          <span className="text-[9px] text-stone-600">{typeof v.raw === 'number' ? v.raw.toFixed(0) : v.raw}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
              Benchmark percentiles not parsed for this match.
            </div>
          )}
        </div>
      )}

      {/* PURCHASES / LOG TAB */}
      {(activeTab === 'PURCHASES' || activeTab === 'LOG') && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            Item Purchase Timeline Log
          </h3>
          {hasPurchases ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matchData.players.filter((p) => p.purchase_log && p.purchase_log.length > 0).map((p) => (
                <div key={p.playerSlot} className="p-3 bg-stone-50 border-2 border-black space-y-2 max-h-72 overflow-y-auto">
                  <div className="flex items-center gap-2 border-b border-stone-200 pb-1.5">
                    <img 
                      src={getHeroImage(p.heroId)} 
                      alt={getHeroName(p.heroId)} 
                      className="w-6 h-6 object-cover border border-black bg-stone-900" 
                      onError={(e) => { (e.target as HTMLImageElement).src = getHeroImage(null); }}
                    />
                    <strong className="text-xs font-black uppercase">{getHeroName(p.heroId)}</strong>
                    <span className="text-[11px] text-stone-500">({p.personaName || 'Anonymous'})</span>
                  </div>
                  <div className="space-y-1">
                    {(p.purchase_log || []).map((item, idx) => {
                      const min = Math.floor(item.time / 60);
                      const sec = item.time % 60;
                      return (
                        <div key={idx} className="flex items-center justify-between text-xs py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-stone-500 text-[10px] w-10">
                              {min}:{sec.toString().padStart(2, '0')}
                            </span>
                            <DotaItemIcon itemIdOrName={item.key} size="sm" />
                            <span className="text-stone-800 text-[11px] capitalize">
                              {item.key.replace(/^item_/, '').replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-10 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
              Purchase logs not parsed for this match.
            </div>
          )}
        </div>
      )}

      {/* GRAPHS TAB */}
      {activeTab === 'GRAPHS' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-6">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            Match Differential Graphs
          </h3>
          {hasGraphs ? (
            <div className="space-y-6">
              {renderAdvantageGraph(matchData.radiantGoldAdv || [], 'Gold Advantage (Net Worth)', '#FFE600')}
              {matchData.radiantXpAdv && (
                renderAdvantageGraph(matchData.radiantXpAdv, 'Experience Advantage (XP)', '#60A5FA')
              )}
            </div>
          ) : (
            <div className="p-10 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
              Graph trajectories not parsed for this match.
            </div>
          )}
        </div>
      )}

      {/* CHAT TAB */}
      {activeTab === 'CHAT' && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            In-Game Chat Log
          </h3>
          {hasChat && matchData.chat ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {matchData.chat.map((c: any, idx: number) => {
                const min = Math.floor((c.time || 0) / 60);
                const sec = (c.time || 0) % 60;
                return (
                  <div key={idx} className="p-2 bg-stone-50 border border-black flex items-center gap-3 text-xs">
                    <span className="font-mono text-stone-500 text-[10px]">
                      {min}:{sec.toString().padStart(2, '0')}
                    </span>
                    <strong className="text-black uppercase">
                      {c.unit || `Player ${c.player_slot}`}:
                    </strong>
                    <span className="text-stone-800">{c.key || c.text}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-10 bg-stone-50 border-2 border-black text-center text-xs text-stone-500">
              In-game chat log not recorded or empty for this match.
            </div>
          )}
        </div>
      )}

      {/* OTHER TABS FALLBACK */}
      {!['OVERVIEW', 'DRAFT', 'PERFORMANCE', 'DAMAGE', 'BENCHMARKS', 'PURCHASES', 'LOG', 'GRAPHS', 'CHAT'].includes(activeTab) && (
        <div className="bg-white border-[3.5px] border-black p-6 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <h3 className="font-sans text-lg font-black uppercase text-black">
            {activeTab} Analytics
          </h3>
          <div className="p-10 bg-stone-50 border-2 border-black text-center space-y-2 text-xs text-stone-600">
            <HelpCircle className="w-8 h-8 text-stone-400 mx-auto" />
            <p className="font-bold">
              Specific {activeTab.toLowerCase()} data for Match #{matchData.matchId} {matchData.parsed ? 'is available on OpenDota.' : 'requires replay parse.'}
            </p>
            <p className="text-[11px] text-stone-500">
              Only authentic telemetry returned from OpenDota is rendered.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

// 10-Player Team Scoreboard with Real Inventories
function renderTeamScoreboard(
  teamName: string,
  players: OpenDotaMatchPlayerSlot[],
  isRadiant: boolean,
  isVictor: boolean,
  onNavigate: (view: ViewType, entityId?: string) => void
) {
  return (
    <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
      
      {/* Team Header Ribbon */}
      <div className={`px-4 py-2.5 border-b-2 border-black flex flex-wrap items-center justify-between gap-3 ${
        isRadiant ? 'bg-[#38EF7D]/20' : 'bg-[#FF5757]/20'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-3.5 h-3.5 border border-black ${isRadiant ? 'bg-[#38EF7D]' : 'bg-[#FF5757]'}`} />
          <h3 className="font-sans text-base font-black uppercase text-black tracking-wide">
            {teamName}
          </h3>
          {isVictor && (
            <span className="px-2 py-0.2 bg-[#70FFAF] text-black text-[9px] font-black uppercase border border-black shadow-[1px_1px_0px_0px_#000]">
              VICTORY
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-stone-700">
          <span>{players.reduce((sum, p) => sum + (p.kills || 0), 0)} Total Kills</span>
          <span>·</span>
          <span>{players.reduce((sum, p) => sum + (p.lastHits || 0), 0)} Total Last Hits</span>
        </div>
      </div>

      {/* Table of 5 Players */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="bg-stone-100 text-stone-700 text-[10px] font-black uppercase border-b-2 border-black">
              <th className="p-2.5">Player / Hero</th>
              <th className="p-2.5 text-center">LVL</th>
              <th className="p-2.5 text-center">K / D / A</th>
              <th className="p-2.5 text-right">Net Worth</th>
              <th className="p-2.5 text-right">GPM / XPM</th>
              <th className="p-2.5 text-right">LH / DN</th>
              <th className="p-2.5 text-right">DMG (Hero/Tower)</th>
              <th className="p-2.5 text-right">Heal</th>
              <th className="p-2.5">Items (Real Inventory)</th>
              <th className="p-2.5 text-center">Buffs</th>
            </tr>
          </thead>
          <tbody className="divide-y border-b-2 border-black divide-stone-200">
            {players.map((player) => {
              // Real inventory derived independently for THIS player object
              const playerItems = [
                player.item_0,
                player.item_1,
                player.item_2,
                player.item_3,
                player.item_4,
                player.item_5
              ];
              const backpackItems = [
                player.backpack_0,
                player.backpack_1,
                player.backpack_2
              ];

              const heroName = getHeroName(player.heroId);
              const heroImg = getHeroImage(player.heroId);

              const hasAghs = Boolean(player.aghanims_scepter && player.aghanims_scepter > 0);
              const hasShard = Boolean(player.aghanims_shard && player.aghanims_shard > 0);
              const hasMoonshard = Boolean(player.moonshard && player.moonshard > 0);

              const isClickable = Boolean(player.accountId);

              return (
                <tr 
                  key={player.playerSlot}
                  className="hover:bg-[#FFF9E6] transition-colors"
                >
                  {/* Hero Portrait & Player Name */}
                  <td className="p-2.5">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={heroImg}
                        alt={heroName}
                        className="w-10 h-10 object-cover border border-black bg-stone-900 shrink-0 shadow-[1px_1px_0px_0px_#000]"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = getHeroImage(null);
                        }}
                      />
                      <div className="min-w-0">
                        <strong className="text-black font-sans text-xs uppercase block truncate max-w-[140px]">
                          {heroName}
                        </strong>
                        {isClickable ? (
                          <button
                            type="button"
                            onClick={() => onNavigate('dota_game_profile', player.accountId!)}
                            className="text-[#7C3AED] hover:underline font-bold text-[11px] block truncate max-w-[140px] text-left cursor-pointer"
                            title={`View profile for account ${player.accountId}`}
                          >
                            {player.personaName || `Contender #${player.accountId}`}
                          </button>
                        ) : (
                          <span className="text-stone-500 text-[11px] block truncate max-w-[140px]">
                            {player.personaName || 'Anonymous'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Level */}
                  <td className="p-2.5 text-center font-bold text-stone-700">
                    {player.level || '—'}
                  </td>

                  {/* K / D / A */}
                  <td className="p-2.5 text-center font-bold text-xs whitespace-nowrap">
                    <span className="text-emerald-700">{player.kills}</span>
                    <span className="text-stone-400 mx-1">/</span>
                    <span className="text-red-600">{player.deaths}</span>
                    <span className="text-stone-400 mx-1">/</span>
                    <span className="text-stone-600">{player.assists}</span>
                  </td>

                  {/* Net Worth */}
                  <td className="p-2.5 text-right font-black text-amber-700">
                    {player.netWorth ? `${(player.netWorth / 1000).toFixed(1)}k` : '—'}
                  </td>

                  {/* GPM / XPM */}
                  <td className="p-2.5 text-right font-bold text-[11px] text-stone-800 whitespace-nowrap">
                    {player.gpm || '—'} / {player.xpm || '—'}
                  </td>

                  {/* Last Hits / Denies */}
                  <td className="p-2.5 text-right font-bold text-[11px] text-stone-700 whitespace-nowrap">
                    {player.lastHits} {player.denies != null ? `(${player.denies})` : ''}
                  </td>

                  {/* Hero & Tower Damage */}
                  <td className="p-2.5 text-right font-bold text-[11px] whitespace-nowrap">
                    <span className="text-red-700">{(player.heroDamage / 1000).toFixed(1)}k</span>
                    <span className="text-stone-400 mx-1">/</span>
                    <span className="text-stone-600">{(player.towerDamage / 1000).toFixed(1)}k</span>
                  </td>

                  {/* Healing */}
                  <td className="p-2.5 text-right font-bold text-emerald-700 text-[11px]">
                    {player.heroHealing > 0 ? `${(player.heroHealing / 1000).toFixed(1)}k` : '—'}
                  </td>

                  {/* REAL Items Grid */}
                  <td className="p-2.5">
                    <div className="flex items-center gap-1">
                      {/* Main 6 slots */}
                      <div className="grid grid-cols-6 gap-0.5">
                        {playerItems.map((itemId, idx) => (
                          <DotaItemIcon key={idx} itemIdOrName={itemId} size="sm" />
                        ))}
                      </div>

                      {/* Backpack slots */}
                      {backpackItems.some((b) => b && b > 0) && (
                        <div className="flex items-center gap-0.5 pl-1 border-l border-stone-300 opacity-80" title="Backpack">
                          {backpackItems.map((itemId, idx) => (
                            <DotaItemIcon key={idx} itemIdOrName={itemId} size="sm" />
                          ))}
                        </div>
                      )}

                      {/* Neutral Item */}
                      {player.item_neutral ? (
                        <div className="pl-1 border-l border-stone-300" title="Neutral Item">
                          <DotaItemIcon itemIdOrName={player.item_neutral} size="sm" isNeutral />
                        </div>
                      ) : null}
                    </div>
                  </td>

                  {/* Buffs */}
                  <td className="p-2.5 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span 
                        className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[8px] font-black ${
                          hasAghs ? 'bg-[#60A5FA] text-black' : 'bg-stone-200 text-stone-400 opacity-40'
                        }`}
                        title={hasAghs ? "Aghanim's Scepter active" : "No Aghanim's Scepter"}
                      >
                        S
                      </span>
                      <span 
                        className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[8px] font-black ${
                          hasShard ? 'bg-[#38EF7D] text-black' : 'bg-stone-200 text-stone-400 opacity-40'
                        }`}
                        title={hasShard ? "Aghanim's Shard active" : "No Aghanim's Shard"}
                      >
                        H
                      </span>
                      <span 
                        className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[8px] font-black ${
                          hasMoonshard ? 'bg-[#FFE600] text-black' : 'bg-stone-200 text-stone-400 opacity-40'
                        }`}
                        title={hasMoonshard ? "Moonshard consumed" : "No Moonshard consumed"}
                      >
                        M
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Simple SVG Advantage Graph
function renderAdvantageGraph(data: number[], title: string, colorHex: string) {
  if (!data || data.length === 0) return null;

  const maxVal = Math.max(1, ...data.map((v) => Math.abs(v)));
  const width = 600;
  const height = 120;
  const zeroY = height / 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1 || 1)) * width;
    const y = zeroY - (val / maxVal) * (height / 2 - 10);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const currentDiff = data[data.length - 1] || 0;
  const isRadiantAhead = currentDiff >= 0;

  return (
    <div className="p-3 bg-stone-50 border-2 border-black space-y-2">
      <div className="flex items-center justify-between text-xs font-mono font-bold">
        <span>{title}</span>
        <span className={isRadiantAhead ? 'text-emerald-700' : 'text-red-600'}>
          Current: {isRadiantAhead ? 'Radiant' : 'Dire'} +{(Math.abs(currentDiff) / 1000).toFixed(1)}k
        </span>
      </div>

      <div className="w-full bg-stone-900 border border-black overflow-hidden relative p-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 sm:h-28">
          <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#555" strokeDasharray="4 4" strokeWidth="1" />
          <polyline
            fill="none"
            stroke={colorHex}
            strokeWidth="2.5"
            points={points}
          />
        </svg>
      </div>
    </div>
  );
}
