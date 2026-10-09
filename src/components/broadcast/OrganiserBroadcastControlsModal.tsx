import React, { useState } from 'react';
import { 
  Radio, 
  Settings, 
  Tv, 
  Video, 
  Link, 
  Check, 
  Copy, 
  ExternalLink,
  Flame,
  Layers,
  Sparkles,
  Info,
  Clock,
  RefreshCw,
  Trophy,
  Download,
  AlertCircle
} from 'lucide-react';
import { Match, SeriesGameRecord } from '../../types/tournament';
import { tournamentService } from '../../services/firebaseService';
import { competitionClientService } from '../../services/competitionClientService';

interface OrganiserBroadcastControlsModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match;
  onBroadcastUpdated: (updatedMatch: Match) => void;
}

export function OrganiserBroadcastControlsModal({
  isOpen,
  onClose,
  match,
  onBroadcastUpdated
}: OrganiserBroadcastControlsModalProps) {
  // Main stream settings
  const [streamType, setStreamType] = useState<'twitch' | 'youtube' | 'obs' | 'custom'>(
    match.streamType || 'youtube'
  );
  const [streamUrl, setStreamUrl] = useState(match.streamUrl || '');
  const [streamTitle, setStreamTitle] = useState(
    match.streamTitle || `${match.tournamentName || 'PBG Championship'} · ${match.round}`
  );
  const [casterNames, setCasterNames] = useState(match.casterNames || 'Synderen & SUNSfan');
  const [isLiveStream, setIsLiveStream] = useState(Boolean(match.isLive));

  // Valve Match ID & Series settings
  const [seriesValveMatchId, setSeriesValveMatchId] = useState(match.valveMatchId || '');
  const [replayAvailable, setReplayAvailable] = useState(Boolean(match.replayAvailable));
  const [replayFileUrl, setReplayFileUrl] = useState(match.replayFileUrl || '');

  // Calculate required game slots from series format
  const formatStr = (match.seriesFormat || 'BO3').toUpperCase();
  const maxGames = formatStr.includes('BO1') ? 1 : formatStr.includes('BO2') ? 2 : formatStr.includes('BO5') ? 5 : 3;

  // Derive initial games list
  const [gamesList, setGamesList] = useState<SeriesGameRecord[]>(() => {
    if (match.games && match.games.length > 0) {
      return match.games;
    }
    // Generate default game slots
    const initial: SeriesGameRecord[] = [];
    for (let i = 1; i <= maxGames; i++) {
      initial.push({
        gameNumber: i,
        status: i === 1 && match.status === 'COMPLETED' ? 'COMPLETED' : i === 1 && match.status === 'LIVE' ? 'LIVE' : 'UPCOMING',
        valveMatchId: i === 1 ? match.valveMatchId || '' : '',
        vodUrl: '',
        replayAvailable: false,
        replayFileUrl: '',
        parseStatus: 'UNPARSED'
      });
    }
    return initial;
  });

  // Series score
  const [scoreA, setScoreA] = useState(match.teamA?.score ?? 0);
  const [scoreB, setScoreB] = useState(match.teamB?.score ?? 0);

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [refreshingMatchId, setRefreshingMatchId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateGameField = (gameNumber: number, field: keyof SeriesGameRecord, value: any) => {
    setGamesList(prev => prev.map(g => g.gameNumber === gameNumber ? { ...g, [field]: value } : g));
  };

  const handleTriggerParse = async (matchIdToParse: string) => {
    if (!matchIdToParse) return;
    setRefreshingMatchId(matchIdToParse);
    try {
      await fetch(`/api/opendota/matches/${encodeURIComponent(matchIdToParse)}/request-parse`, { method: 'POST' });
    } catch {}
    setTimeout(() => {
      setRefreshingMatchId(null);
    }, 2000);
  };

  const handleQuickPreset = (preset: 'twitch' | 'youtube' | 'obs' | 'clear') => {
    if (preset === 'twitch') {
      setStreamType('twitch');
      setStreamUrl('https://www.twitch.tv/dota2ti');
    } else if (preset === 'youtube') {
      setStreamType('youtube');
      setStreamUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    } else if (preset === 'obs') {
      setStreamType('obs');
      setStreamUrl('http://localhost:8088/live/stream.m3u8');
    } else if (preset === 'clear') {
      setStreamType('custom');
      setStreamUrl('');
      setIsLiveStream(false);
    }
  };

  const handleSaveBroadcast = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const broadcastData = {
      streamUrl: streamUrl.trim(),
      streamType,
      streamTitle: streamTitle.trim(),
      casterNames: casterNames.trim(),
      obsStreamUrl: streamType === 'obs' ? streamUrl.trim() : match.obsStreamUrl,
      isLive: isLiveStream,
      scores: { scoreA, scoreB },
      games: gamesList,
      valveMatchId: seriesValveMatchId.trim(),
      replayAvailable,
      replayFileUrl: replayFileUrl.trim(),
      tournamentId: match.tournamentId
    };

    // 1. Update in client service (syncs local state & direct Firestore save)
    const localRes = await tournamentService.updateMatchBroadcast(match.id, broadcastData);

    // 2. Authoritative server push (updates backend memory + Firestore collection)
    await competitionClientService.updateBroadcast({
      tournamentId: match.tournamentId,
      matchId: match.id,
      ...broadcastData
    });

    setIsSaving(false);
    setSaveSuccess(true);

    const updated = localRes.match || {
      ...match,
      ...broadcastData,
      teamA: { ...match.teamA, score: scoreA },
      teamB: { ...match.teamB, score: scoreB },
      status: isLiveStream ? 'LIVE' : match.status,
      isLive: isLiveStream
    };

    onBroadcastUpdated(updated);

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border-[4px] border-black shadow-[10px_10px_0px_0px_#000] my-6 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150 font-mono">
        
        {/* Modal Header */}
        <div className="bg-[#FFE600] border-b-[3.5px] border-black p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-black" />
            <div>
              <span className="px-1.5 py-0.2 bg-black text-[#FFE600] text-[10px] font-black uppercase">
                ORGANISER / ADMIN
              </span>
              <h3 className="font-sans font-black text-xl text-black uppercase leading-tight">
                MATCH CENTER &amp; BROADCAST CONTROLS
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white hover:bg-stone-100 border-2 border-black flex items-center justify-center text-black font-black text-lg cursor-pointer transition-transform active:scale-95 shadow-[2px_2px_0px_0px_#000]"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
          
          {/* Section 1: Stream Provider & Live Link */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                <Video className="w-4 h-4 text-[#7C3AED]" />
                <span>1. Broadcast Stream Feed</span>
              </label>
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-stone-500 font-bold">Presets:</span>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('twitch')}
                  className="px-1.5 py-0.5 bg-stone-100 hover:bg-purple-100 border border-black font-bold uppercase cursor-pointer"
                >
                  Twitch
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('youtube')}
                  className="px-1.5 py-0.5 bg-stone-100 hover:bg-red-100 border border-black font-bold uppercase cursor-pointer"
                >
                  YouTube
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('clear')}
                  className="px-1.5 py-0.5 bg-stone-100 hover:bg-stone-200 border border-black font-bold uppercase cursor-pointer text-stone-600"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Provider Radios */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['twitch', 'youtube', 'obs', 'custom'] as const).map(provider => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setStreamType(provider)}
                  className={`p-2 border-2 border-black font-black uppercase text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-[2px_2px_0px_0px_#000] transition-all ${
                    streamType === provider ? 'bg-[#7C3AED] text-white' : 'bg-stone-50 text-stone-700 hover:bg-white'
                  }`}
                >
                  <span>{provider === 'twitch' ? 'Twitch.tv' : provider === 'youtube' ? 'YouTube' : provider === 'obs' ? 'OBS Feed' : 'Custom'}</span>
                </button>
              ))}
            </div>

            {/* Stream URL Input */}
            <div className="space-y-1">
              <input
                type="text"
                value={streamUrl}
                onChange={e => setStreamUrl(e.target.value)}
                placeholder={
                  streamType === 'twitch' ? 'https://twitch.tv/channel or channel name' :
                  streamType === 'youtube' ? 'https://youtube.com/watch?v=... or live stream URL' :
                  'https://domain.com/live/stream.m3u8 or video source'
                }
                className="w-full bg-white border-2 border-black p-2.5 font-mono text-xs focus:bg-yellow-50 focus:outline-none shadow-[2px_2px_0px_0px_#000]"
              />
              <p className="text-[10px] text-stone-500">
                Pasting any valid YouTube or Twitch live link immediately embeds the authorized stream across all viewer devices.
              </p>
            </div>

            {/* Live Broadcast Status Toggle */}
            <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-black">
              <div>
                <span className="font-black text-xs uppercase block text-black">
                  Broadcast Is Currently LIVE
                </span>
                <span className="text-[10px] text-stone-500">
                  Activates the LIVE broadcast banner and autoplays the player for all spectators.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsLiveStream(!isLiveStream)}
                className={`px-3 py-1.5 border-2 border-black font-black text-xs uppercase cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000] ${
                  isLiveStream ? 'bg-[#FF5757] text-white animate-pulse' : 'bg-stone-200 text-stone-700'
                }`}
              >
                {isLiveStream ? '● BROADCAST LIVE' : 'OFFLINE'}
              </button>
            </div>
          </div>

          {/* Section 2: Match Title & Casters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-stone-700">
                Stream Title
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={e => setStreamTitle(e.target.value)}
                className="w-full bg-white border-2 border-black p-2 text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase text-stone-700">
                Caster Names
              </label>
              <input
                type="text"
                value={casterNames}
                onChange={e => setCasterNames(e.target.value)}
                className="w-full bg-white border-2 border-black p-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Valve Match ID & Replay (.dem) */}
          <div className="space-y-3 p-3 bg-purple-50/50 border-2 border-black">
            <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-[#7C3AED]" />
              <span>2. Valve Match ID &amp; OpenDota Link</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-600 uppercase">Primary Valve Match ID</span>
                <input
                  type="text"
                  value={seriesValveMatchId}
                  onChange={e => setSeriesValveMatchId(e.target.value)}
                  placeholder="e.g. 7123456789"
                  className="w-full bg-white border border-black p-2 text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-stone-600 uppercase">Valve Replay (.dem) File URL</span>
                <input
                  type="text"
                  value={replayFileUrl}
                  onChange={e => setReplayFileUrl(e.target.value)}
                  placeholder="https://.../match_7123456789.dem.bz2"
                  className="w-full bg-white border border-black p-2 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replayAvailable}
                  onChange={e => setReplayAvailable(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="font-bold text-black text-[11px]">Dota 2 Replay File Available for Download</span>
              </label>

              {seriesValveMatchId && (
                <button
                  type="button"
                  onClick={() => handleTriggerParse(seriesValveMatchId)}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-[#FFE600] border border-black font-black text-[10px] uppercase cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshingMatchId === seriesValveMatchId ? 'animate-spin' : ''}`} />
                  <span>Request OpenDota Parse</span>
                </button>
              )}
            </div>
          </div>

          {/* Section 4: Individual Games in Series (BO1, BO2, BO3, BO5) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-black flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#7C3AED]" />
                <span>3. Series Games ({match.seriesFormat || 'BO3'})</span>
              </label>
              <span className="text-[10px] text-stone-500 font-bold">
                Game-specific VODs and Valve IDs
              </span>
            </div>

            <div className="space-y-3">
              {gamesList.map((game) => (
                <div key={game.gameNumber} className="p-3 border-2 border-black bg-stone-50 space-y-2">
                  <div className="flex items-center justify-between border-b border-black/10 pb-1.5 text-xs">
                    <span className="font-black text-black uppercase">
                      Game {game.gameNumber}
                    </span>
                    <div className="flex items-center gap-2">
                      <select
                        value={game.status}
                        onChange={e => handleUpdateGameField(game.gameNumber, 'status', e.target.value)}
                        className="bg-white border border-black px-1.5 py-0.5 text-[10px] font-bold"
                      >
                        <option value="UPCOMING">Upcoming</option>
                        <option value="LIVE">Live</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[9px] text-stone-500 font-bold uppercase block">Game VOD / Recording URL</span>
                      <input
                        type="text"
                        value={game.vodUrl || ''}
                        onChange={e => handleUpdateGameField(game.gameNumber, 'vodUrl', e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or Twitch VOD"
                        className="w-full bg-white border border-black p-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-500 font-bold uppercase block">Game Valve Match ID</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={game.valveMatchId || ''}
                          onChange={e => handleUpdateGameField(game.gameNumber, 'valveMatchId', e.target.value)}
                          placeholder="Valve Match ID"
                          className="w-full bg-white border border-black p-1.5 text-xs font-mono"
                        />
                        {game.valveMatchId && (
                          <button
                            type="button"
                            onClick={() => handleTriggerParse(game.valveMatchId!)}
                            className="p-1.5 bg-stone-200 hover:bg-[#FFE600] border border-black cursor-pointer shrink-0"
                            title="Request Parse"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Series Score Edit */}
          <div className="p-3 bg-stone-50 border-2 border-black flex items-center justify-between text-xs">
            <span className="font-black uppercase text-black">Series Score:</span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-stone-600 font-bold">{match.teamA.name}:</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={scoreA}
                  onChange={e => setScoreA(Number(e.target.value))}
                  className="w-12 bg-white border border-black p-1 text-center font-black"
                />
              </div>
              <span className="font-black text-stone-400">-</span>
              <div className="flex items-center gap-1.5">
                <span className="text-stone-600 font-bold">{match.teamB.name}:</span>
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={scoreB}
                  onChange={e => setScoreB(Number(e.target.value))}
                  className="w-12 bg-white border border-black p-1 text-center font-black"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-100 border-t-[3.5px] border-black p-4 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-stone-600">
            {saveSuccess ? (
              <span className="text-emerald-700 font-black">✓ Broadcast saved and synced across all viewers!</span>
            ) : (
              <span>Authoritative broadcast updates sync in real-time.</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 bg-white hover:bg-stone-50 text-black border-2 border-black font-black uppercase text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveBroadcast}
              disabled={isSaving}
              className="px-6 py-2 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black font-black uppercase text-xs cursor-pointer shadow-[3px_3px_0px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5"
            >
              {isSaving ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save & Broadcast'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
