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
  Tv, 
  ExternalLink,
  Video,
  Download,
  Clock,
  AlertCircle,
  Film,
  RotateCcw
} from 'lucide-react';
import { Match, SeriesGameRecord } from '../../types/tournament';

interface EsportsBroadcastPlayerProps {
  match: Match;
  selectedGame?: SeriesGameRecord | null;
  isOrganizer: boolean;
  onOpenBroadcastControls: () => void;
  theaterMode: boolean;
  onToggleTheaterMode: () => void;
}

export function EsportsBroadcastPlayer({
  match,
  selectedGame,
  isOrganizer,
  onOpenBroadcastControls,
  theaterMode,
  onToggleTheaterMode
}: EsportsBroadcastPlayerProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Fullscreen state listener
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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

  // Determine active media URL and provider
  // Priority: if an individual game is selected with its own VOD or stream, use it; otherwise use series match stream
  const activeMediaUrl = (selectedGame?.vodUrl || selectedGame?.streamUrl || match.streamUrl || '').trim();
  const activeStreamType = selectedGame?.streamType || match.streamType || detectStreamType(activeMediaUrl);
  const activeObsUrl = (match.obsStreamUrl || '').trim();

  // A broadcast is genuinely live ONLY when isLive is true AND a stream URL is configured!
  // Never label a broadcast LIVE solely because the match status is live.
  const isGenuinelyLive = Boolean(match.isLive && activeMediaUrl);
  const isFinishedGameWithVod = Boolean(selectedGame?.status === 'COMPLETED' && (selectedGame?.vodUrl || activeMediaUrl));

  function detectStreamType(url: string): 'twitch' | 'youtube' | 'obs' | 'custom' {
    if (!url) return 'custom';
    const lower = url.toLowerCase();
    if (lower.includes('twitch.tv')) return 'twitch';
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('.m3u8') || lower.includes('rtmp') || lower.includes(':808')) return 'obs';
    return 'custom';
  }

  // Parse Twitch channel, video ID, or collection
  const getTwitchParams = (url: string) => {
    if (!url) return { type: 'channel', id: '' };
    const clean = url.trim();
    // Check if it's a VOD (e.g. twitch.tv/videos/123456)
    const vodMatch = clean.match(/twitch\.tv\/videos\/(\d+)/i);
    if (vodMatch && vodMatch[1]) {
      return { type: 'video', id: vodMatch[1] };
    }
    const channel = clean.replace(/https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/$/, '').trim();
    return { type: 'channel', id: channel || '' };
  };

  // Parse YouTube video or live ID
  const getYouTubeId = (url: string) => {
    if (!url) return '';
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
        if (v && v.length === 11) return v;
      }
    } catch {}

    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|live\/)([^#&?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[2] && match[2].length === 11) ? match[2] : trimmed;
  };

  // Compile Twitch parent domains for compliance
  const getTwitchParents = () => {
    const parents = new Set<string>();
    if (typeof window !== 'undefined' && window.location.hostname) {
      parents.add(window.location.hostname);
    }
    parents.add('purplebeangaming.com');
    parents.add('www.purplebeangaming.com');
    parents.add('localhost');
    return Array.from(parents).map(p => `parent=${encodeURIComponent(p)}`).join('&');
  };

  // Timestamp jump handler for video players
  const handleSeekToTimestamp = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
    } else if (iframeRef.current && activeStreamType === 'youtube') {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
        '*'
      );
    }
  };

  // Handle Playback speed for native video
  const handleChangeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const twitchInfo = getTwitchParams(activeMediaUrl);
  const ytVideoId = getYouTubeId(activeMediaUrl);

  const twitchEmbedUrl = twitchInfo.id
    ? twitchInfo.type === 'video'
      ? `https://player.twitch.tv/?video=${twitchInfo.id}&${getTwitchParents()}&autoplay=${isGenuinelyLive}&muted=${isMuted}`
      : `https://player.twitch.tv/?channel=${twitchInfo.id}&${getTwitchParents()}&autoplay=${isGenuinelyLive}&muted=${isMuted}`
    : '';

  const ytEmbedUrl = ytVideoId
    ? `https://www.youtube-nocookie.com/embed/${ytVideoId}?autoplay=${isGenuinelyLive ? 1 : 0}&mute=${isMuted ? 1 : 0}&enablejsapi=1&rel=0&origin=${typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : ''}`
    : '';

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black border-[3.5px] border-black shadow-[6px_6px_0px_0px_#000] overflow-hidden flex flex-col select-none ${
        theaterMode ? 'w-full' : ''
      }`}
    >
      {/* 1. Broadcast HUD Status Bar */}
      <div className="bg-[#111118] border-b-[2.5px] border-black px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-stone-300 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          {isGenuinelyLive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#FF5757] text-white font-black text-[10px] uppercase border border-black shadow-[2px_2px_0px_0px_#000] animate-pulse">
              <Radio className="w-3.5 h-3.5" />
              <span>LIVE BROADCAST</span>
            </div>
          ) : isFinishedGameWithVod ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-[#7C3AED] text-white font-black text-[10px] uppercase border border-black shadow-[2px_2px_0px_0px_#000]">
              <Film className="w-3.5 h-3.5" />
              <span>VOD REPLAY · {selectedGame ? `GAME ${selectedGame.gameNumber}` : 'ARCHIVED'}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-stone-800 text-stone-300 font-bold text-[10px] uppercase border border-stone-700">
              <Tv className="w-3.5 h-3.5 text-stone-400" />
              <span>BROADCAST FEED</span>
            </div>
          )}

          <span className="text-stone-600 font-bold hidden sm:inline">|</span>

          <span className="font-bold text-white uppercase text-[11px] truncate max-w-[200px] sm:max-w-md">
            {match.streamTitle || `${match.tournamentName || 'PBG'} · ${match.round}`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          {/* Stream provider indicator */}
          {activeMediaUrl && (
            <span className="px-2 py-0.5 bg-black/60 border border-stone-700 text-stone-300 font-mono text-[10px] uppercase font-bold">
              {activeStreamType.toUpperCase()}
            </span>
          )}

          {/* Theater Mode Toggle */}
          <button
            onClick={onToggleTheaterMode}
            className="p-1 text-stone-400 hover:text-white cursor-pointer hidden md:block"
            title={theaterMode ? 'Exit Theater Mode' : 'Theater Mode'}
          >
            {theaterMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1 text-stone-400 hover:text-white cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Admin stream controls quick button */}
          {isOrganizer && (
            <button
              onClick={onOpenBroadcastControls}
              className="px-2.5 py-1 bg-[#FFE600] hover:bg-yellow-300 text-black border border-black font-black uppercase text-[10px] flex items-center gap-1 cursor-pointer transition-transform active:scale-95 shadow-[1px_1px_0px_0px_#000]"
              title="Configure Stream, Link Twitch, YouTube, or OBS"
            >
              <Settings className="w-3 h-3" />
              <span>Manage Stream</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Main 16:9 Video Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        
        {/* State A: Twitch Player */}
        {activeStreamType === 'twitch' && twitchEmbedUrl ? (
          <iframe
            ref={iframeRef}
            src={twitchEmbedUrl}
            className="w-full h-full border-0 absolute inset-0"
            allowFullScreen
            title="Twitch Esports Broadcast"
            onError={() => setPlayerError('Failed to load Twitch broadcast stream.')}
          />
        ) : activeStreamType === 'youtube' && ytEmbedUrl ? (
          /* State B: YouTube Player */
          <iframe
            ref={iframeRef}
            src={ytEmbedUrl}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="YouTube Esports Broadcast"
            onError={() => setPlayerError('Failed to load YouTube broadcast stream.')}
          />
        ) : (activeStreamType === 'obs' || activeObsUrl) && (activeObsUrl || activeMediaUrl.endsWith('.m3u8') || activeMediaUrl.endsWith('.mp4')) ? (
          /* State C: Direct OBS / HLS / MP4 native video */
          <video
            ref={videoRef}
            src={activeObsUrl || activeMediaUrl}
            autoPlay={isGenuinelyLive}
            controls
            playsInline
            className="w-full h-full object-contain absolute inset-0"
            onError={() => setPlayerError('OBS Studio direct video stream offline or unreachable.')}
          />
        ) : (
          /* State D: Genuine Offline / Not Configured State */
          <div className="relative w-full h-full bg-[#0a0a12] flex flex-col items-center justify-center p-6 text-center overflow-hidden">
            {/* Subtle tournament backdrop branding */}
            <div 
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#7C3AED 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            <div className="relative z-10 max-w-md w-full bg-[#12121e] border-2 border-stone-800 p-6 space-y-4 shadow-[4px_4px_0px_0px_#000]">
              <div className="w-12 h-12 bg-black border-2 border-stone-700 rounded-full flex items-center justify-center mx-auto text-[#FFE600]">
                {match.status === 'LIVE' ? (
                  <Radio className="w-6 h-6 animate-pulse text-[#FF5757]" />
                ) : match.status === 'COMPLETED' ? (
                  <Film className="w-6 h-6 text-[#70FFAF]" />
                ) : (
                  <Clock className="w-6 h-6 text-[#FFE600]" />
                )}
              </div>

              <div className="space-y-1.5">
                <h4 className="font-sans font-black text-lg text-white uppercase tracking-tight">
                  {match.status === 'COMPLETED'
                    ? 'MATCH RECORDING PENDING'
                    : match.status === 'LIVE'
                    ? 'STREAM OFFLINE / INTERMISSION'
                    : 'BROADCAST SCHEDULED'}
                </h4>
                <p className="font-mono text-xs text-stone-400">
                  {match.status === 'COMPLETED'
                    ? 'This series has concluded. Official match VOD or replay recording has not yet been linked by organizers.'
                    : match.status === 'LIVE'
                    ? 'The competitive series is currently in progress. The official stream feed is temporarily offline or in lobby setup.'
                    : `Scheduled to start at ${match.scheduledTime || 'the announced start time'}. Broadcast will activate once casters go live.`}
                </p>
              </div>

              {/* Match Teams & Score Summary in Offline View */}
              <div className="bg-black/60 border border-stone-800 p-3 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-stone-300 font-bold">{match.teamA.name}</span>
                  <span className="font-black text-white px-1.5 py-0.5 bg-stone-900 border border-stone-700">
                    {match.teamA.score ?? 0}
                  </span>
                </div>
                <span className="text-stone-600 font-bold">VS</span>
                <div className="flex items-center gap-2">
                  <span className="font-black text-white px-1.5 py-0.5 bg-stone-900 border border-stone-700">
                    {match.teamB.score ?? 0}
                  </span>
                  <span className="text-stone-300 font-bold">{match.teamB.name}</span>
                </div>
              </div>

              {/* Organizer Stream Setup CTA */}
              {isOrganizer ? (
                <div className="pt-2">
                  <button
                    onClick={onOpenBroadcastControls}
                    className="w-full px-4 py-2.5 bg-[#FFE600] hover:bg-yellow-300 text-black border-2 border-black font-mono text-xs font-black uppercase shadow-[3px_3px_0px_0px_#000] cursor-pointer flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <Video className="w-4 h-4" />
                    <span>Link Broadcast (Twitch / YouTube / OBS) →</span>
                  </button>
                  <p className="text-[10px] font-mono text-stone-500 mt-2">
                    Enter any valid Twitch channel or YouTube live link to broadcast live to all viewers.
                  </p>
                </div>
              ) : (
                <div className="pt-1 flex items-center justify-center gap-2 text-[11px] font-mono text-stone-500">
                  <Tv className="w-3.5 h-3.5" />
                  <span>Authorized PurpleBeanGaming Esports Broadcast</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Player Error Alert Banner */}
        {playerError && (
          <div className="absolute bottom-4 left-4 right-4 bg-rose-950/90 border border-rose-600 text-rose-200 p-3 flex items-center justify-between text-xs font-mono z-30">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{playerError}</span>
            </div>
            <button
              onClick={() => setPlayerError(null)}
              className="text-stone-400 hover:text-white font-bold ml-2 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 3. Replay VOD Timeline & Game Controls (When VOD/Replay is active) */}
      {(selectedGame?.timestampedEvents && selectedGame.timestampedEvents.length > 0) && (
        <div className="bg-[#181824] border-t-2 border-black p-3 space-y-2 font-mono text-xs text-stone-300">
          <div className="flex items-center justify-between text-[11px] text-stone-400 font-bold uppercase">
            <span>Key Match Timestamps (Click to Seek)</span>
            {selectedGame?.durationFormatted && (
              <span>Duration: {selectedGame.durationFormatted}</span>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {selectedGame.timestampedEvents.map((event, idx) => (
              <button
                key={idx}
                onClick={() => handleSeekToTimestamp(event.timestampSeconds)}
                className="px-2.5 py-1 bg-black/80 hover:bg-[#7C3AED] hover:text-white border border-stone-700 text-stone-200 text-[10px] font-mono shrink-0 cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <span className="text-[#FFE600] font-black">{event.time}</span>
                <span className="truncate max-w-[120px]">{event.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4. Replay File & External Broadcast Direct Link Bar */}
      <div className="bg-[#0e0e16] border-t-2 border-black px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-stone-400">
        <div className="flex items-center gap-3">
          {activeMediaUrl && (
            <a
              href={activeMediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-stone-300 hover:text-[#5CE1E6] underline font-bold"
            >
              <span>Watch on {activeStreamType === 'twitch' ? 'Twitch' : activeStreamType === 'youtube' ? 'YouTube' : 'Provider'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {match.casterNames && (
            <span className="text-stone-400 hidden sm:inline">
              Casters: <strong className="text-white">{match.casterNames}</strong>
            </span>
          )}
        </div>

        {/* Valve Replay File Download (.dem) - Displayed ONLY when actual replay is available */}
        {(selectedGame?.replayAvailable || selectedGame?.replayFileUrl || match.replayAvailable || match.replayFileUrl) && (
          <a
            href={selectedGame?.replayFileUrl || match.replayFileUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#70FFAF] text-black border border-black text-[10px] font-black uppercase shadow-[2px_2px_0px_0px_#000] hover:bg-emerald-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Dota 2 Replay (.dem)</span>
          </a>
        )}
      </div>
    </div>
  );
}
