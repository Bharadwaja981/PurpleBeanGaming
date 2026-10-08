import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Radio, 
  Settings, 
  RefreshCw, 
  Flame, 
  Tv, 
  Sparkles, 
  Swords, 
  Shield, 
  ExternalLink,
  Video
} from 'lucide-react';
import { Match } from '../../types/tournament';

interface EsportsVideoPlayerProps {
  match: Match;
  isOrganizer: boolean;
  onOpenBroadcastControls: () => void;
  theaterMode: boolean;
  onToggleTheaterMode: () => void;
}

export function EsportsVideoPlayer({
  match,
  isOrganizer,
  onOpenBroadcastControls,
  theaterMode,
  onToggleTheaterMode
}: EsportsVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(1480);
  const [radarPulse, setRadarPulse] = useState(0);
  const [simulatedKillTicker, setSimulatedKillTicker] = useState<string>('Map active · Teams farming lanes');
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic spectator count fluctuation & radar pulse
  useEffect(() => {
    const interval = setInterval(() => {
      setSpectatorCount(prev => prev + (Math.floor(Math.random() * 9) - 4));
      setRadarPulse(p => (p + 1) % 100);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulated in-game clash events ticker for when demo/observer mode is active
  useEffect(() => {
    const events = [
      `⚔️ [14:10] ${match.teamA.name} takes first Roshan! Aegis claimed.`,
      `💥 [18:25] Massive 5v5 teamfight in river! 3 kills for ${match.teamB.name}.`,
      `🛡️ [22:04] Tier 2 Mid Tower destroyed by ${match.teamA.name}.`,
      `🔥 [26:40] Ultra Kill by ${match.teamA.name} Carry! High ground breached!`,
      `⚡ [31:15] Buybacks used across both sides! Aegis expiring in 40s.`
    ];
    let idx = 0;
    const tickerInterval = setInterval(() => {
      idx = (idx + 1) % events.length;
      setSimulatedKillTicker(events[idx]);
    }, 6000);
    return () => clearInterval(tickerInterval);
  }, [match.teamA.name, match.teamB.name]);

  // Fullscreen handler
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Determine stream type and embed URL
  const rawStream = (match.streamUrl || '').trim();
  const rawObs = (match.obsStreamUrl || '').trim();
  const currentStreamType = match.streamType || detectStreamType(rawStream);

  function detectStreamType(url: string): 'twitch' | 'youtube' | 'obs' | 'custom' {
    if (!url) return 'custom';
    const lower = url.toLowerCase();
    if (lower.includes('twitch.tv') || (!lower.includes('/') && !lower.includes('.'))) return 'twitch';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('.m3u8') || lower.includes('obs') || lower.includes('rtmp') || lower.includes(':808')) return 'obs';
    return 'custom';
  }

  // Extract Twitch channel name
  const getTwitchChannel = (url: string) => {
    if (!url) return 'dota2ti';
    const clean = url.replace(/https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/$/, '').trim();
    return clean || 'dota2ti';
  };

  // Extract YouTube video/live ID
  const getYouTubeId = (url: string) => {
    if (!url) return 'jfKfPfyJRdk'; // Fallback esports broadcast
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    try {
      if (trimmed.includes('youtu.be/')) {
        const id = trimmed.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0]?.split('/')[0];
        if (id && id.length === 11) return id;
      }
      if (trimmed.includes('/live/')) {
        const id = trimmed.split('/live/')[1]?.split('?')[0]?.split('&')[0]?.split('/')[0];
        if (id && id.length === 11) return id;
      }
      if (trimmed.includes('/embed/')) {
        const id = trimmed.split('/embed/')[1]?.split('?')[0]?.split('&')[0]?.split('/')[0];
        if (id && id.length === 11) return id;
      }
      if (trimmed.includes('v=')) {
        const afterQuery = trimmed.split('?')[1] || trimmed;
        const params = new URLSearchParams(afterQuery);
        const v = params.get('v');
        if (v) return v;
      }
    } catch {}

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[2] && match[2].length === 11) ? match[2] : trimmed;
  };

  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col select-none ${
        theaterMode ? 'w-full' : ''
      }`}
    >
      {/* Top Stream Status HUD Bar */}
      <div className="bg-[#121212] border-b-2 border-stone-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-stone-300 z-20">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#FF5757] text-white font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_#000]">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>LIVE OBSERVER BROADCAST</span>
          </div>
          <span className="text-stone-500 font-bold hidden sm:inline">|</span>
          <span className="font-bold text-white uppercase text-[11px] truncate max-w-[200px] sm:max-w-xs">
            {match.streamTitle || `${match.tournamentName || 'PBG'} · ${match.round}`}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="hidden md:inline-flex items-center gap-1 text-stone-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>1080p60 · OBS Feed</span>
          </span>

          <span className="inline-flex items-center gap-1 text-stone-300 font-bold">
            <Tv className="w-3.5 h-3.5 text-[#FFE600]" />
            <span>{spectatorCount.toLocaleString()} Viewers</span>
          </span>

          {isOrganizer && (
            <button
              onClick={onOpenBroadcastControls}
              className="px-2 py-0.5 bg-[#FFE600] hover:bg-yellow-300 text-black border border-black font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-[1px_1px_0px_0px_#000]"
              title="Configure Stream, Link OBS, Twitch, or YouTube"
            >
              <Settings className="w-3 h-3" />
              <span>Admin Stream Setup</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Video Viewport (16:9 Aspect Ratio) */}
      <div className="relative aspect-video w-full bg-stone-950 flex items-center justify-center overflow-hidden">
        
        {/* CASE 1: Twitch Embed */}
        {currentStreamType === 'twitch' && rawStream ? (
          <iframe
            src={`https://player.twitch.tv/?channel=${getTwitchChannel(rawStream)}&parent=${hostname}&autoplay=true&muted=${isMuted}`}
            className="w-full h-full border-0 absolute inset-0"
            allowFullScreen
            title="Twitch Esports Stream"
          />
        ) : currentStreamType === 'youtube' && rawStream ? (
          /* CASE 2: YouTube Embed */
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(rawStream)}?autoplay=1&mute=${isMuted ? 1 : 0}&enablejsapi=1&rel=0`}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Esports Stream"
          />
        ) : (currentStreamType === 'obs' || rawObs) && (rawObs || rawStream.endsWith('.m3u8') || rawStream.endsWith('.mp4')) ? (
          /* CASE 3: Direct OBS Stream / Custom Video Feed */
          <video
            src={rawObs || rawStream}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            controls={false}
            className="w-full h-full object-cover absolute inset-0"
          />
        ) : (
          /* CASE 4: Esports Arena Interactive Observer Simulator */
          <div className="relative w-full h-full bg-gradient-to-b from-[#0a0a14] via-[#111122] to-[#080810] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
            
            {/* Animated Grid Lines & Tactical Radar Background */}
            <div 
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(#7C3AED 1px, transparent 1px), linear-gradient(to right, #7C3AED 1px, transparent 1px)',
                backgroundSize: '40px 40px'
              }}
            />

            {/* Simulated Battlefield Arena Map */}
            <div className="relative z-10 w-full max-w-2xl bg-black/60 border-2 border-[#7C3AED]/40 p-4 sm:p-6 backdrop-blur-xs space-y-4 shadow-[0_0_30px_rgba(124,58,237,0.2)]">
              
              {/* Clash Telemetry Header */}
              <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">{match.teamA.name}</span>
                  <span className="text-xl font-black text-white">{match.teamA.score}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[#FFE600] font-black text-sm uppercase">GAME {match.currentGame || 1} IN PROGRESS</span>
                  <span className="text-[11px] text-stone-400 font-mono">MAP CLOCK: 28:44 · ROSHAN RESPAWNED</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-white">{match.teamB.score}</span>
                  <span className="text-rose-400 font-bold">{match.teamB.name}</span>
                </div>
              </div>

              {/* Dynamic Radar Battlefield Simulation */}
              <div className="relative h-28 sm:h-36 bg-[#0c0d18] border border-stone-800 rounded-sm overflow-hidden flex items-center justify-center">
                {/* River & Lanes Graphic */}
                <div className="absolute inset-0 flex items-center justify-center opacity-30">
                  <div className="w-full h-1 bg-[#5CE1E6] transform -rotate-12" />
                  <div className="w-1 h-full bg-[#7C3AED] transform rotate-12" />
                </div>

                {/* Team A Hero Markers (Radiant/Green) */}
                <div 
                  className="absolute transition-all duration-1000 flex items-center gap-1"
                  style={{ left: `${25 + (radarPulse % 10)}%`, top: `${40 + ((radarPulse * 2) % 20)}%` }}
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_#10B981]">
                    {match.teamA.logo || '🛡️'}
                  </div>
                  <span className="text-[9px] font-mono text-emerald-300 font-bold hidden sm:inline">{match.teamA.name}</span>
                </div>

                {/* Team B Hero Markers (Dire/Red) */}
                <div 
                  className="absolute transition-all duration-1000 flex items-center gap-1"
                  style={{ right: `${25 + ((radarPulse * 3) % 15)}%`, bottom: `${35 + (radarPulse % 25)}%` }}
                >
                  <span className="text-[9px] font-mono text-rose-300 font-bold hidden sm:inline">{match.teamB.name}</span>
                  <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[10px] font-black shadow-[0_0_10px_#EF4444]">
                    {match.teamB.logo || '⚔️'}
                  </div>
                </div>

                {/* Central Clash Center */}
                <div className="relative z-10 flex flex-col items-center justify-center p-2 bg-black/80 border border-stone-700">
                  <Swords className="w-6 h-6 text-[#FFE600] animate-pulse" />
                  <span className="text-[10px] font-mono text-stone-300 font-bold mt-1">OFFICIAL OBSERVER FEED</span>
                </div>
              </div>

              {/* Live Play-by-Play Ticker */}
              <div className="bg-[#181828] border border-stone-800 p-2 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-stone-200 truncate">
                  <Flame className="w-4 h-4 text-[#FF5757] shrink-0 animate-bounce" />
                  <span className="truncate">{simulatedKillTicker}</span>
                </div>
                <span className="text-[10px] text-[#7C3AED] font-bold uppercase shrink-0">BATTLE TICKER</span>
              </div>

              {/* Call to Action for Admin / Organiser */}
              {isOrganizer ? (
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={onOpenBroadcastControls}
                    className="px-4 py-2 bg-[#FFE600] hover:bg-yellow-300 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Link Stream (Twitch / YouTube / OBS) →</span>
                  </button>
                  <span className="text-[11px] font-mono text-stone-400">
                    Connect OBS Studio directly or paste any stream link
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-mono text-stone-400">
                  Broadcast commentary and live telemetry provided by Purple Bean Esports Observer.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Bottom Floating Control Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 flex items-center justify-between z-20 text-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 hover:bg-white/20 rounded transition-colors text-white cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-1.5 hover:bg-white/20 rounded transition-colors text-white cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-stone-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            <div className="h-4 w-px bg-stone-700" />

            <div className="flex items-center gap-2 font-mono text-xs text-stone-300">
              <span className="w-2 h-2 rounded-full bg-[#FF5757] animate-ping" />
              <span className="font-bold text-[11px] uppercase">
                {match.status === 'LIVE' ? 'LIVE NOW' : (match.status === 'COMPLETED' ? 'REPLAY / ARCHIVE' : 'UPCOMING MATCH')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Link to open Twitch/YouTube in new window if configured */}
            {rawStream && (
              <a
                href={rawStream.startsWith('http') ? rawStream : `https://twitch.tv/${rawStream}`}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 hover:bg-white/20 rounded text-stone-300 hover:text-white cursor-pointer"
                title="Open stream in external tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onToggleTheaterMode}
              className="p-1.5 hover:bg-white/20 rounded text-stone-300 hover:text-white cursor-pointer hidden sm:block"
              title={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
            >
              <Tv className="w-4 h-4" />
            </button>

            <button
              onClick={handleToggleFullscreen}
              className="p-1.5 hover:bg-white/20 rounded text-stone-300 hover:text-white cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Under-Player Telemetry Bar */}
      <div className="bg-[#1c1c1c] border-t-2 border-stone-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-stone-300">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">FORMAT:</span>
            <span className="font-black text-[#FFE600]">{match.seriesFormat || 'BO3'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">CASTERS:</span>
            <span className="font-bold text-white">{match.casterNames || 'Official PBG Desk'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-stone-400">SOURCE:</span>
            <span className="font-black text-[#70FFAF] uppercase">
              {currentStreamType === 'twitch' ? 'Twitch.tv' : currentStreamType === 'youtube' ? 'YouTube Live' : currentStreamType === 'obs' ? 'OBS Studio Feed' : 'PBG Arena Observer'}
            </span>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBroadcastControls}
              className="text-[#FFE600] hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <span>Change Stream URL / Link OBS</span>
              <span>→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
