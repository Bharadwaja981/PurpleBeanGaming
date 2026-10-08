import React, { useState } from 'react';
import { 
  X, 
  Tv, 
  Video, 
  Settings, 
  Copy, 
  Check, 
  Radio, 
  Sparkles, 
  Trophy, 
  ExternalLink,
  Flame,
  Swords,
  Info,
  Layers
} from 'lucide-react';
import { Match } from '../../types/tournament';
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
  const [activeTab, setActiveTab] = useState<'stream' | 'obs' | 'scores'>('stream');
  
  // Stream settings
  const [streamType, setStreamType] = useState<'twitch' | 'youtube' | 'obs' | 'custom'>(
    match.streamType || (match.streamUrl?.includes('youtube') ? 'youtube' : match.streamUrl?.includes('twitch') ? 'twitch' : 'custom')
  );
  const [streamUrl, setStreamUrl] = useState(match.streamUrl || '');
  const [streamTitle, setStreamTitle] = useState(match.streamTitle || `${match.tournamentName} · ${match.round}`);
  const [casterNames, setCasterNames] = useState(match.casterNames || 'Synderen & SUNSfan');
  const [isLiveStream, setIsLiveStream] = useState(match.status === 'LIVE' || match.isLive);
  
  // Score & Telemetry settings
  const [scoreA, setScoreA] = useState(match.teamA.score || 0);
  const [scoreB, setScoreB] = useState(match.teamB.score || 0);
  const [currentGame, setCurrentGame] = useState(match.currentGame || 1);
  const [teamAKills, setTeamAKills] = useState(match.telemetry?.teamAKills ?? 21);
  const [teamBKills, setTeamBKills] = useState(match.telemetry?.teamBKills ?? 16);
  const [goldLead, setGoldLead] = useState(match.telemetry?.goldLead ?? 3850);
  const [goldLeadTeam, setGoldLeadTeam] = useState<'A' | 'B'>(match.telemetry?.goldLeadTeam ?? 'A');

  // Status feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copiedObs, setCopiedObs] = useState(false);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://pbgesports.in';
  const obsOverlayUrl = `${origin}/overlay/match/${match.id}`;

  const handleCopyObsUrl = () => {
    navigator.clipboard.writeText(obsOverlayUrl).then(() => {
      setCopiedObs(true);
      setTimeout(() => setCopiedObs(false), 2500);
    }).catch(() => {});
  };

  const handleQuickPreset = (preset: 'twitch' | 'youtube' | 'obs' | 'demo') => {
    if (preset === 'twitch') {
      setStreamType('twitch');
      setStreamUrl('https://www.twitch.tv/dota2ti');
    } else if (preset === 'youtube') {
      setStreamType('youtube');
      setStreamUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk');
    } else if (preset === 'obs') {
      setStreamType('obs');
      setStreamUrl('http://localhost:8088/live/stream.m3u8');
    } else if (preset === 'demo') {
      setStreamType('custom');
      setStreamUrl('');
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
      telemetry: {
        gameDuration: '28:44',
        gameNumber: currentGame,
        teamAKills,
        teamBKills,
        goldLead,
        goldLeadTeam,
        roshanStatus: 'Alive',
        currentMap: `Map ${currentGame}`
      }
    };

    // 1. Update in local firebaseService & persist directly to Firestore
    const localRes = await tournamentService.updateMatchBroadcast(match.id, {
      ...broadcastData,
      tournamentId: match.tournamentId
    });

    // 2. Authoritative server push (updates backend memory + admin Firestore doc)
    await competitionClientService.updateBroadcast({
      tournamentId: match.tournamentId,
      matchId: match.id,
      ...broadcastData
    });

    setIsSaving(false);
    setSaveSuccess(true);

    if (localRes.match) {
      onBroadcastUpdated(localRes.match);
    } else {
      onBroadcastUpdated({
        ...match,
        ...broadcastData,
        teamA: { ...match.teamA, score: scoreA },
        teamB: { ...match.teamB, score: scoreB },
        status: isLiveStream ? 'LIVE' : match.status,
        isLive: isLiveStream
      });
    }

    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white border-[4px] border-black shadow-[10px_10px_0px_0px_#000] my-6 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="bg-[#FFE600] border-b-[3.5px] border-black p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-black" />
            <div>
              <span className="px-1.5 py-0.2 bg-black text-[#FFE600] font-mono text-[10px] font-black uppercase">
                ORGANISER / ADMIN
              </span>
              <h3 className="font-sans font-black text-xl text-black uppercase leading-tight">
                BROADCAST &amp; VIDEO CONTROLS
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 bg-white hover:bg-black hover:text-white text-black border-2 border-black font-black flex items-center justify-center cursor-pointer shadow-[2px_2px_0px_0px_#000] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-stone-100 border-b-2 border-black p-2 flex items-center gap-2 overflow-x-auto shrink-0 font-mono text-xs">
          <button
            onClick={() => setActiveTab('stream')}
            className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stream' ? 'bg-[#7C3AED] text-white' : 'bg-white text-black hover:bg-stone-50'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>1. Link Stream</span>
          </button>

          <button
            onClick={() => setActiveTab('obs')}
            className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'obs' ? 'bg-[#7C3AED] text-white' : 'bg-white text-black hover:bg-stone-50'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>2. OBS Studio Tools</span>
          </button>

          <button
            onClick={() => setActiveTab('scores')}
            className={`px-3 py-1.5 border-2 border-black font-black uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'scores' ? 'bg-[#7C3AED] text-white' : 'bg-white text-black hover:bg-stone-50'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>3. Match Telemetry</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 font-mono text-xs flex-1">
          
          {/* TAB 1: Stream Link */}
          {activeTab === 'stream' && (
            <div className="space-y-4">
              {/* Quick Preset Buttons */}
              <div className="space-y-1.5">
                <span className="font-bold text-stone-700 uppercase block">
                  Quick Stream Presets:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('twitch')}
                    className={`p-2 border-2 border-black text-center font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                      streamType === 'twitch' ? 'bg-[#9146FF] text-white' : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    🟣 Twitch Stream
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('youtube')}
                    className={`p-2 border-2 border-black text-center font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                      streamType === 'youtube' ? 'bg-[#FF0000] text-white' : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    🔴 YouTube Live
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('obs')}
                    className={`p-2 border-2 border-black text-center font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                      streamType === 'obs' ? 'bg-black text-[#FFE600]' : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    🎥 Direct OBS
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickPreset('demo')}
                    className={`p-2 border-2 border-black text-center font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer ${
                      streamType === 'custom' && !streamUrl ? 'bg-[#7C3AED] text-white' : 'bg-white hover:bg-stone-50'
                    }`}
                  >
                    ⚡ PBG Arena HUD
                  </button>
                </div>
              </div>

              {/* Stream URL / Channel ID Input */}
              <div className="space-y-1.5">
                <label className="font-black text-black uppercase block flex items-center justify-between">
                  <span>Stream URL, Twitch Channel, or YouTube Video ID:</span>
                  <span className="text-stone-500 font-normal text-[11px]">
                    {streamType === 'twitch' ? 'e.g. dota2ti or https://twitch.tv/dota2ti' : streamType === 'youtube' ? 'e.g. jfKfPfyJRdk or https://youtube.com/watch?v=...' : 'e.g. HLS .m3u8 or video link'}
                  </span>
                </label>
                <input
                  type="text"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="Paste Twitch URL, YouTube Link, or OBS Stream URL..."
                  className="w-full border-2 border-black p-2.5 bg-stone-50 text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              {/* Stream Title */}
              <div className="space-y-1.5">
                <label className="font-black text-black uppercase block">
                  Broadcast Stream Title:
                </label>
                <input
                  type="text"
                  value={streamTitle}
                  onChange={(e) => setStreamTitle(e.target.value)}
                  placeholder="e.g. PBG Cup 2026 - Lower Bracket Survival Decider"
                  className="w-full border-2 border-black p-2.5 bg-stone-50 text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              {/* Caster Names */}
              <div className="space-y-1.5">
                <label className="font-black text-black uppercase block">
                  Desk Commentators &amp; Casters:
                </label>
                <input
                  type="text"
                  value={casterNames}
                  onChange={(e) => setCasterNames(e.target.value)}
                  placeholder="e.g. Synderen & SUNSfan (English) / Arjun & Rohan (Hindi)"
                  className="w-full border-2 border-black p-2.5 bg-stone-50 text-xs font-mono font-bold focus:bg-white focus:outline-none shadow-[2px_2px_0px_0px_#000]"
                />
              </div>

              {/* Go Live Toggle */}
              <div className="p-3 border-2 border-black bg-[#F3E8FF] flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="font-black text-black uppercase block">Broadcast Live Status:</span>
                  <p className="text-stone-600 text-[11px]">
                    Turn ON to activate the live observer stream banner and pulse red status light for all viewers.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLiveStream}
                    onChange={(e) => setIsLiveStream(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5757] border-2 border-black"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: OBS Studio Integration */}
          {activeTab === 'obs' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#FFE600]/30 border-2 border-black space-y-2">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-black" />
                  <span className="font-black text-black uppercase text-sm">
                    Link Directly to OBS Studio
                  </span>
                </div>
                <p className="text-stone-700 text-xs leading-relaxed">
                  You can stream from OBS Studio to YouTube or Twitch and embed the player above, OR you can add an official <strong>OBS Browser Source Overlay</strong> to your OBS broadcast so your viewers see live scores and rosters!
                </p>
              </div>

              {/* OBS Browser Source URL Box */}
              <div className="space-y-1.5">
                <label className="font-black text-black uppercase block">
                  OBS Browser Source Scorebug URL:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={obsOverlayUrl}
                    className="flex-1 border-2 border-black p-2.5 bg-stone-100 text-xs font-mono font-bold select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyObsUrl}
                    className="px-4 py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white border-2 border-black font-black uppercase text-xs shadow-[2px_2px_0px_0px_#000] cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    {copiedObs ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedObs ? 'COPIED!' : 'COPY URL'}</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div className="p-4 border-2 border-black bg-stone-50 space-y-3">
                <span className="font-black text-black uppercase text-xs block">
                  3-Step OBS Studio Setup:
                </span>
                
                <ol className="space-y-2 list-decimal list-inside text-stone-800 text-xs">
                  <li>
                    In <strong>OBS Studio</strong>, navigate to your <strong>Sources</strong> dock, click <strong>+</strong>, and choose <strong>Browser</strong>.
                  </li>
                  <li>
                    Name it <code>PBG Match HUD</code>, paste the copied URL into the <strong>URL</strong> field, and set:
                    <div className="mt-1 pl-4 space-y-0.5 text-stone-600 font-bold">
                      <div>• Width: <code>1920</code></div>
                      <div>• Height: <code>1080</code></div>
                      <div>• Check: <code>Shutdown source when not visible</code></div>
                    </div>
                  </li>
                  <li>
                    Click <strong>OK</strong>. The transparent live scorebug, team names, kill counters, and series status will now render dynamically on top of your game feed!
                  </li>
                </ol>
              </div>

              {/* Recommended OBS Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-stone-500 font-bold block text-[10px]">VIDEO BITRATE</span>
                  <span className="font-black text-black">6,000 Kbps</span>
                </div>
                <div className="p-2 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-stone-500 font-bold block text-[10px]">CANVAS / OUTPUT</span>
                  <span className="font-black text-black">1920x1080 @ 60 FPS</span>
                </div>
                <div className="p-2 border-2 border-black bg-white shadow-[2px_2px_0px_0px_#000]">
                  <span className="text-stone-500 font-bold block text-[10px]">KEYFRAME INTERVAL</span>
                  <span className="font-black text-black">2.0 Seconds</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Match Telemetry & Scorekeeper */}
          {activeTab === 'scores' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Team A */}
                <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                  <span className="font-black text-black uppercase block truncate">
                    {match.teamA.name} ({match.teamA.tag})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScoreA(Math.max(0, scoreA - 1))}
                      className="w-10 h-10 bg-white border-2 border-black font-black text-xl hover:bg-stone-100 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center text-3xl font-black">{scoreA}</span>
                    <button
                      type="button"
                      onClick={() => setScoreA(scoreA + 1)}
                      className="w-10 h-10 bg-white border-2 border-black font-black text-xl hover:bg-stone-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px] text-stone-500 text-center block">Series Score</span>
                </div>

                {/* Team B */}
                <div className="p-4 border-2 border-black bg-stone-50 space-y-2">
                  <span className="font-black text-black uppercase block truncate">
                    {match.teamB.name} ({match.teamB.tag})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setScoreB(Math.max(0, scoreB - 1))}
                      className="w-10 h-10 bg-white border-2 border-black font-black text-xl hover:bg-stone-100 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center text-3xl font-black">{scoreB}</span>
                    <button
                      type="button"
                      onClick={() => setScoreB(scoreB + 1)}
                      className="w-10 h-10 bg-white border-2 border-black font-black text-xl hover:bg-stone-100 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-[10px] text-stone-500 text-center block">Series Score</span>
                </div>
              </div>

              {/* Map Number & Kills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 uppercase text-[10px]">Current Map:</label>
                  <select
                    value={currentGame}
                    onChange={(e) => setCurrentGame(parseInt(e.target.value, 10) || 1)}
                    className="w-full border-2 border-black p-2 bg-white font-bold"
                  >
                    <option value={1}>Game 1</option>
                    <option value={2}>Game 2</option>
                    <option value={3}>Game 3 (Decider)</option>
                    <option value={4}>Game 4</option>
                    <option value={5}>Game 5 (Grand Finals)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-700 uppercase text-[10px]">{match.teamA.tag} Kills:</label>
                  <input
                    type="number"
                    value={teamAKills}
                    onChange={(e) => setTeamAKills(parseInt(e.target.value, 10) || 0)}
                    className="w-full border-2 border-black p-2 bg-white font-bold text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-stone-700 uppercase text-[10px]">{match.teamB.tag} Kills:</label>
                  <input
                    type="number"
                    value={teamBKills}
                    onChange={(e) => setTeamBKills(parseInt(e.target.value, 10) || 0)}
                    className="w-full border-2 border-black p-2 bg-white font-bold text-center"
                  />
                </div>
              </div>

              {/* Gold Lead */}
              <div className="p-3 border-2 border-black bg-stone-50 flex items-center justify-between gap-3">
                <span className="font-bold uppercase text-xs">Gold Advantage:</span>
                <div className="flex items-center gap-2">
                  <select
                    value={goldLeadTeam}
                    onChange={(e) => setGoldLeadTeam(e.target.value as 'A' | 'B')}
                    className="border-2 border-black p-1.5 bg-white font-bold text-xs"
                  >
                    <option value="A">+{match.teamA.name}</option>
                    <option value="B">+{match.teamB.name}</option>
                  </select>
                  <input
                    type="number"
                    value={goldLead}
                    onChange={(e) => setGoldLead(parseInt(e.target.value, 10) || 0)}
                    className="w-24 border-2 border-black p-1.5 bg-white font-bold text-center text-xs"
                  />
                  <span className="font-bold text-stone-600">Gold</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="bg-stone-100 border-t-2 border-black p-4 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-stone-200 text-black border-2 border-black font-mono text-xs font-bold uppercase cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSaveBroadcast}
            disabled={isSaving}
            className="px-6 py-2.5 bg-[#70FFAF] hover:bg-emerald-300 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
          >
            {isSaving ? (
              <span>Saving Broadcast...</span>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-900" />
                <span>SAVED &amp; BROADCASTING!</span>
              </>
            ) : (
              <span>Save &amp; Update Stream</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
