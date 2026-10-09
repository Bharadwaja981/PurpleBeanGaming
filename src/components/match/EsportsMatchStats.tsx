import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Clock, 
  Swords, 
  Shield, 
  TrendingUp, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  BarChart2,
  List,
  Target,
  Flame,
  Layers,
  Sparkles
} from 'lucide-react';
import { Match, SeriesGameRecord } from '../../types/tournament';
import { openDotaService, OpenDotaMatchSnapshot } from '../../services/openDotaService';
import { getHeroName, getHeroImage } from '../../services/dotaConstants';
import { DotaItemIcon } from '../dota/DotaItemIcon';

interface EsportsMatchStatsProps {
  match: Match;
  selectedGame?: SeriesGameRecord | null;
  activeTab: 'OVERVIEW' | 'SCOREBOARD' | 'GRAPHS' | 'TIMELINE' | 'DRAFT';
  onTabChange: (tab: 'OVERVIEW' | 'SCOREBOARD' | 'GRAPHS' | 'TIMELINE' | 'DRAFT') => void;
  isOrganizer: boolean;
  onRefreshData?: () => void;
}

export function EsportsMatchStats({
  match,
  selectedGame,
  activeTab,
  onTabChange,
  isOrganizer,
  onRefreshData
}: EsportsMatchStatsProps) {
  const [matchData, setMatchData] = useState<OpenDotaMatchSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parseRequested, setParseRequested] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Active Valve Match ID from selected game or match level
  const valveMatchId = (selectedGame?.valveMatchId || match.valveMatchId || '').trim();

  // Load OpenDota data if a valid Valve Match ID is present
  useEffect(() => {
    let isCancelled = false;
    if (!valveMatchId || !/^\d+$/.test(valveMatchId)) {
      setMatchData(null);
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      try {
        const data = await openDotaService.fetchMatch(valveMatchId);
        if (!isCancelled) {
          setMatchData(data);
          setIsLoading(false);
        }
      } catch {
        if (!isCancelled) {
          setMatchData(null);
          setIsLoading(false);
        }
      }
    };

    loadData();
    return () => { isCancelled = true; };
  }, [valveMatchId]);

  const handleCopyMatchId = () => {
    if (!valveMatchId) return;
    navigator.clipboard?.writeText(valveMatchId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }).catch(() => {});
  };

  const handleRequestParse = async () => {
    if (!valveMatchId) return;
    setParseRequested(true);
    try {
      await fetch(`/api/opendota/matches/${valveMatchId}/request-parse`, { method: 'POST' });
    } catch {}
    setTimeout(async () => {
      try {
        const refreshed = await openDotaService.fetchMatch(valveMatchId, true);
        setMatchData(refreshed);
      } catch {}
      setParseRequested(false);
    }, 4000);
  };

  // Format seconds to mm:ss
  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs)) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const radiantPlayers = matchData?.players?.filter(p => p.slot < 128) || [];
  const direPlayers = matchData?.players?.filter(p => p.slot >= 128) || [];

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Tab Navigation Buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b-2 border-black">
        {(['OVERVIEW', 'SCOREBOARD', 'GRAPHS', 'TIMELINE', 'DRAFT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`px-4 py-2 border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] shrink-0 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 ${
              activeTab === tab
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {tab}
          </button>
        ))}

        {valveMatchId && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-stone-500 font-bold hidden sm:inline">
              VALVE MATCH ID:
            </span>
            <button
              onClick={handleCopyMatchId}
              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 border border-black font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="Copy Valve Match ID"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-stone-600" />}
              <span>{valveMatchId}</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading state for OpenDota */}
      {isLoading && (
        <div className="bg-white border-[3.5px] border-black p-8 text-center space-y-3 shadow-[6px_6px_0px_0px_#000]">
          <div className="w-8 h-8 border-4 border-black border-t-[#FFE600] rounded-full animate-spin mx-auto" />
          <p className="font-bold text-black uppercase">Loading Valve &amp; OpenDota Match Data...</p>
        </div>
      )}

      {/* When no Valve Match ID is configured */}
      {!isLoading && !valveMatchId && (
        <div className="bg-white border-[3.5px] border-black p-8 text-center space-y-3 shadow-[6px_6px_0px_0px_#000]">
          <div className="w-12 h-12 bg-amber-100 border-2 border-black rounded-full flex items-center justify-center mx-auto text-amber-800">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="font-sans font-black text-lg text-black uppercase">
            No Valve Match ID Linked
          </h4>
          <p className="text-stone-600 max-w-md mx-auto text-xs">
            Detailed in-game statistics, scoreboards, and draft logs require a verified Valve Dota 2 Match ID. Organizers can add the match ID via Admin Controls.
          </p>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {!isLoading && valveMatchId && activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Match Duration & Result */}
            <div className="bg-white border-[3.5px] border-black p-4 space-y-2 shadow-[4px_4px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 font-black uppercase block">GAME OUTCOME</span>
              <div className="text-xl font-black text-black">
                {matchData?.radiantWin ? (
                  <span className="text-emerald-700">Radiant Victory</span>
                ) : matchData ? (
                  <span className="text-rose-700">Dire Victory</span>
                ) : (
                  <span>Match Finished</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-stone-600 text-xs">
                <Clock className="w-3.5 h-3.5" />
                <span>Duration: {formatTime(matchData?.durationSeconds)}</span>
              </div>
            </div>

            {/* Radiant vs Dire Kill Score */}
            <div className="bg-white border-[3.5px] border-black p-4 space-y-2 shadow-[4px_4px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 font-black uppercase block">KILL SCORE</span>
              <div className="flex items-center gap-3 text-2xl font-black">
                <span className="text-emerald-600">{matchData?.radiantScore ?? '--'}</span>
                <span className="text-stone-300">-</span>
                <span className="text-rose-600">{matchData?.direScore ?? '--'}</span>
              </div>
              <div className="text-[10px] text-stone-500">
                Radiant: {match.teamA.name} · Dire: {match.teamB.name}
              </div>
            </div>

            {/* Parse Status & OpenDota Link */}
            <div className="bg-white border-[3.5px] border-black p-4 space-y-2 shadow-[4px_4px_0px_0px_#000]">
              <span className="text-[10px] text-stone-500 font-black uppercase block">PARSING ATTRIBUTION</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 border border-black font-black text-[10px] uppercase ${
                  matchData?.parsed ? 'bg-[#70FFAF] text-black' : 'bg-amber-100 text-amber-900'
                }`}>
                  {matchData?.parsed ? 'PARSED' : 'BASIC RECORD'}
                </span>
                {!matchData?.parsed && (
                  <button
                    onClick={handleRequestParse}
                    disabled={parseRequested}
                    className="px-2 py-0.5 bg-[#FFE600] hover:bg-yellow-300 border border-black font-black text-[10px] uppercase cursor-pointer"
                  >
                    {parseRequested ? 'Requesting...' : 'Request Parse'}
                  </button>
                )}
              </div>
              <a
                href={`https://www.opendota.com/matches/${valveMatchId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#7C3AED] hover:underline font-bold text-xs"
              >
                <span>View on OpenDota</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCOREBOARD */}
      {!isLoading && valveMatchId && activeTab === 'SCOREBOARD' && (
        <div className="space-y-6">
          {/* Radiant Team Scoreboard */}
          <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
            <div className="bg-emerald-50 border-b-2 border-black p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-600 text-white font-black text-[10px] uppercase border border-black">
                  RADIANT
                </span>
                <span className="font-sans font-black text-sm text-black">
                  {match.teamA.name}
                </span>
                {matchData?.radiantWin && (
                  <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" /> WINNER
                  </span>
                )}
              </div>
              <span className="font-black text-sm text-emerald-800">
                {matchData?.radiantScore ?? 0} Kills
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 border-b border-black text-[10px] uppercase text-stone-600 font-black">
                    <th className="p-2.5">Player / Hero</th>
                    <th className="p-2.5 text-center">LVL</th>
                    <th className="p-2.5 text-center">K / D / A</th>
                    <th className="p-2.5 text-center">NET</th>
                    <th className="p-2.5 text-center">GPM / XPM</th>
                    <th className="p-2.5 text-center">LH / DN</th>
                    <th className="p-2.5">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {radiantPlayers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-stone-50">
                      <td className="p-2.5 flex items-center gap-2">
                        <img 
                          src={getHeroImage(p.heroId)} 
                          alt={p.heroName} 
                          className="w-10 h-6 object-cover border border-black shrink-0" 
                        />
                        <div>
                          <div className="font-black text-black truncate max-w-[120px]">
                            {p.personaname || `Player ${idx + 1}`}
                          </div>
                          <div className="text-[10px] text-stone-500 font-bold truncate">
                            {p.heroName}
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-center font-bold">{p.level ?? '--'}</td>
                      <td className="p-2.5 text-center font-black">
                        <span className="text-emerald-700">{p.kills}</span> /{' '}
                        <span className="text-rose-700">{p.deaths}</span> /{' '}
                        <span className="text-stone-600">{p.assists}</span>
                      </td>
                      <td className="p-2.5 text-center font-black text-amber-800">
                        {p.netWorth ? `${(p.netWorth / 1000).toFixed(1)}k` : '--'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-stone-600">
                        {p.goldPerMin || '--'} / {p.xpPerMin || '--'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-stone-600">
                        {p.lastHits || 0} / {p.denies || 0}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.items?.map((item, iIdx) => (
                            <DotaItemIcon key={iIdx} itemId={item} size="sm" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dire Team Scoreboard */}
          <div className="bg-white border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden">
            <div className="bg-rose-50 border-b-2 border-black p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] uppercase border border-black">
                  DIRE
                </span>
                <span className="font-sans font-black text-sm text-black">
                  {match.teamB.name}
                </span>
                {!matchData?.radiantWin && matchData && (
                  <span className="text-rose-700 font-bold text-xs flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5" /> WINNER
                  </span>
                )}
              </div>
              <span className="font-black text-sm text-rose-800">
                {matchData?.direScore ?? 0} Kills
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 border-b border-black text-[10px] uppercase text-stone-600 font-black">
                    <th className="p-2.5">Player / Hero</th>
                    <th className="p-2.5 text-center">LVL</th>
                    <th className="p-2.5 text-center">K / D / A</th>
                    <th className="p-2.5 text-center">NET</th>
                    <th className="p-2.5 text-center">GPM / XPM</th>
                    <th className="p-2.5 text-center">LH / DN</th>
                    <th className="p-2.5">Items</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {direPlayers.map((p, idx) => (
                    <tr key={idx} className="hover:bg-stone-50">
                      <td className="p-2.5 flex items-center gap-2">
                        <img 
                          src={getHeroImage(p.heroId)} 
                          alt={p.heroName} 
                          className="w-10 h-6 object-cover border border-black shrink-0" 
                        />
                        <div>
                          <div className="font-black text-black truncate max-w-[120px]">
                            {p.personaname || `Player ${idx + 6}`}
                          </div>
                          <div className="text-[10px] text-stone-500 font-bold truncate">
                            {p.heroName}
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 text-center font-bold">{p.level ?? '--'}</td>
                      <td className="p-2.5 text-center font-black">
                        <span className="text-emerald-700">{p.kills}</span> /{' '}
                        <span className="text-rose-700">{p.deaths}</span> /{' '}
                        <span className="text-stone-600">{p.assists}</span>
                      </td>
                      <td className="p-2.5 text-center font-black text-amber-800">
                        {p.netWorth ? `${(p.netWorth / 1000).toFixed(1)}k` : '--'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-stone-600">
                        {p.goldPerMin || '--'} / {p.xpPerMin || '--'}
                      </td>
                      <td className="p-2.5 text-center font-bold text-stone-600">
                        {p.lastHits || 0} / {p.denies || 0}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.items?.map((item, iIdx) => (
                            <DotaItemIcon key={iIdx} itemId={item} size="sm" />
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: GRAPHS */}
      {!isLoading && valveMatchId && activeTab === 'GRAPHS' && (
        <div className="space-y-4">
          {/* Net Worth Advantage Graph */}
          {matchData?.radiantGoldAdv && matchData.radiantGoldAdv.length > 0 ? (
            <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-3">
              <div className="flex items-center justify-between border-b-2 border-black pb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
                  <h4 className="font-sans font-black text-sm uppercase text-black">
                    Net Worth Advantage Over Time
                  </h4>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold">
                  <span className="text-emerald-700">▲ Radiant Lead</span>
                  <span className="text-rose-700">▼ Dire Lead</span>
                </div>
              </div>

              {/* Render dynamic SVG advantage chart */}
              <div className="h-48 w-full bg-stone-50 border border-black relative flex items-center justify-center p-2">
                {(() => {
                  const data = matchData.radiantGoldAdv;
                  const maxAdv = Math.max(...data.map(v => Math.abs(v)), 1000);
                  const points = data.map((val, idx) => {
                    const x = (idx / (data.length - 1)) * 100;
                    // 50% is 0 line; above 50% is positive (radiant); below is negative (dire)
                    const y = 50 - (val / maxAdv) * 45;
                    return `${x},${y}`;
                  }).join(' ');

                  return (
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Zero line */}
                      <line x1="0" y1="50" x2="100" y2="50" stroke="#000" strokeWidth="0.8" strokeDasharray="1 1" />
                      {/* Advantage curve */}
                      <polyline
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth="1.8"
                        points={points}
                      />
                    </svg>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="bg-white border-[3.5px] border-black p-8 text-center text-stone-600">
              <BarChart2 className="w-8 h-8 mx-auto text-stone-400 mb-2" />
              <p className="font-bold uppercase text-xs">Advantage Graphs Unavailable</p>
              <p className="text-[11px] text-stone-500">
                Detailed minute-by-minute gold and XP graph data is available once this match replay is parsed on OpenDota.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TIMELINE */}
      {!isLoading && valveMatchId && activeTab === 'TIMELINE' && (
        <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <div className="border-b-2 border-black pb-2 flex items-center justify-between">
            <h4 className="font-sans font-black text-sm uppercase text-black">
              Objective &amp; Teamfight Timeline
            </h4>
            <span className="text-[10px] text-stone-500 font-bold uppercase">
              Chronological Events
            </span>
          </div>

          {matchData?.objectives && matchData.objectives.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {matchData.objectives.map((obj, idx) => (
                <div key={idx} className="p-2 border border-black bg-stone-50 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 bg-black text-[#FFE600] font-black text-[10px]">
                      {formatTime(obj.time)}
                    </span>
                    <span className="font-bold text-black uppercase">
                      {obj.type?.replace(/_/g, ' ') || 'Objective Event'}
                    </span>
                    {obj.key && (
                      <span className="text-stone-500 font-mono text-[11px]">
                        ({obj.key})
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 border border-black ${
                    obj.team === 2 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                  }`}>
                    {obj.team === 2 ? 'Radiant' : 'Dire'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 text-xs">
              <p className="font-bold">No event timeline records found for this match.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: DRAFT */}
      {!isLoading && valveMatchId && activeTab === 'DRAFT' && (
        <div className="bg-white border-[3.5px] border-black p-5 shadow-[6px_6px_0px_0px_#000] space-y-4">
          <div className="border-b-2 border-black pb-2 flex items-center justify-between">
            <h4 className="font-sans font-black text-sm uppercase text-black">
              Captains Draft: Picks &amp; Bans
            </h4>
            <span className="text-[10px] text-stone-500 font-bold uppercase">
              Hero Selection Phase
            </span>
          </div>

          {matchData?.picksBans && matchData.picksBans.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Radiant Picks & Bans */}
              <div className="border-2 border-black p-3 space-y-2 bg-emerald-50/50">
                <span className="font-black text-xs text-emerald-800 uppercase block border-b border-black pb-1">
                  Radiant Picks &amp; Bans ({match.teamA.name})
                </span>
                <div className="space-y-1.5">
                  {matchData.picksBans.filter(pb => pb.team === 'radiant').map((pb, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-white border border-black">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getHeroImage(pb.heroId)} 
                          alt={pb.heroName} 
                          className="w-8 h-5 object-cover border border-black" 
                        />
                        <span className="font-bold">{pb.heroName}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 border border-black ${
                        pb.isPick ? 'bg-[#70FFAF] text-black' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {pb.isPick ? 'PICK' : 'BAN'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dire Picks & Bans */}
              <div className="border-2 border-black p-3 space-y-2 bg-rose-50/50">
                <span className="font-black text-xs text-rose-800 uppercase block border-b border-black pb-1">
                  Dire Picks &amp; Bans ({match.teamB.name})
                </span>
                <div className="space-y-1.5">
                  {matchData.picksBans.filter(pb => pb.team === 'dire').map((pb, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-white border border-black">
                      <div className="flex items-center gap-2">
                        <img 
                          src={getHeroImage(pb.heroId)} 
                          alt={pb.heroName} 
                          className="w-8 h-5 object-cover border border-black" 
                        />
                        <span className="font-bold">{pb.heroName}</span>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.2 border border-black ${
                        pb.isPick ? 'bg-[#70FFAF] text-black' : 'bg-stone-200 text-stone-700'
                      }`}>
                        {pb.isPick ? 'PICK' : 'BAN'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-stone-500 text-xs">
              <p className="font-bold">Hero draft picks and bans not recorded for this match.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
