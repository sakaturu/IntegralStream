import React, { useRef, useMemo, useEffect, useState } from 'react';
import { VideoItem } from '../types';

interface VideoPlayerProps {
  video: VideoItem | null;
  isFavorite?: boolean;
  isPlaying: boolean;
  onPlayStateChange: (isPlaying: boolean) => void;
  onToggleLike?: () => void;
  onToggleDislike?: () => void;
  onToggleFavorite?: () => void;
  onWriteReview?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  isFavorite = false,
  isPlaying,
  onPlayStateChange,
  onToggleLike,
  onToggleDislike,
  onToggleFavorite,
  onWriteReview,
}) => {
  const iframeRef   = useRef<HTMLIFrameElement>(null);
  const [hovered, setHovered]     = useState(false);
  const [flashIcon, setFlashIcon] = useState<'play'|'pause'|null>(null);
  const [iframeSrc, setIframeSrc] = useState('');
  const [showPauseScreen, setShowPauseScreen] = useState(false);
  const flashTimer  = useRef<ReturnType<typeof setTimeout>>();
  const prevYtId    = useRef<string | null>(null);

  const getSimpleId = (url: string) => {
    if (!url) return null;
    if (url.includes('youtu.be/'))  return url.split('youtu.be/')[1]?.split(/[?&#]/)[0];
    if (url.includes('/shorts/'))   return url.split('/shorts/')[1]?.split(/[?&#]/)[0];
    if (url.includes('/embed/'))    return url.split('/embed/')[1]?.split(/[?&#]/)[0];
    if (url.includes('v='))         return url.split('v=')[1]?.split(/[&#]/)[0];
    return null;
  };

  const ytId = useMemo(() => video ? getSimpleId(video.url) : null, [video?.url]);

  const postCmd = (cmd: string) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: cmd, args: [] }), '*'
      );
    } catch {}
  };

  // Only reload iframe when video changes — NEVER on play/pause
  useEffect(() => {
    if (!ytId || prevYtId.current === ytId) return;
    prevYtId.current = ytId;
    setShowPauseScreen(false);
    // autoplay=1 always — let it start, we control pause via postMessage + overlay
    setIframeSrc(
      `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=${isPlaying ? 1 : 0}&controls=0&rel=0&playsinline=1&enablejsapi=1&modestbranding=1`
    );
  }, [ytId]);

  // Listen for YouTube events
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (d?.event === 'onStateChange') {
          const s = Number(d?.info);
          if (s === 1) { setShowPauseScreen(false); onPlayStateChange(true); }
          if (s === 2) { onPlayStateChange(false); }
          if (s === 0) { onPlayStateChange(false); }
        }
      } catch {}
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onPlayStateChange]);

  // When isPlaying changes from parent — use postMessage, NO iframe reload
  const prevIsPlaying = useRef<boolean | null>(null);
  useEffect(() => {
    if (prevIsPlaying.current === isPlaying) return;
    prevIsPlaying.current = isPlaying;
    if (!ytId) return;

    if (isPlaying) {
      setShowPauseScreen(false);
      postCmd('playVideo');
    } else {
      setShowPauseScreen(true);
      postCmd('pauseVideo');
    }
  }, [isPlaying, ytId]);

  const showFlash = (type: 'play' | 'pause') => {
    clearTimeout(flashTimer.current);
    setFlashIcon(type);
    flashTimer.current = setTimeout(() => setFlashIcon(null), 900);
  };

  // Click = toggle using postMessage only, NO reload
  const handleClick = () => {
    if (!ytId) return;
    if (isPlaying) {
      postCmd('pauseVideo');
      setShowPauseScreen(true);
      onPlayStateChange(false);
      showFlash('pause');
    } else {
      postCmd('playVideo');
      setShowPauseScreen(false);
      onPlayStateChange(true);
      showFlash('play');
    }
  };

  if (!video || !ytId) return null;

  const showOverlay = showPauseScreen || hovered;

  return (
    <div
      className="w-full bg-black rounded-[1.5rem] overflow-hidden border border-white/5 shadow-2xl"
      style={{ aspectRatio: '16/9', position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* iframe — only changes src when video changes, NOT on pause/play */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="w-full h-full border-0 absolute inset-0"
        allow="autoplay; encrypted-media; fullscreen"
        allowFullScreen
        title="Video Player"
        style={{ zIndex: 1 }}
      />

      {/* Fake pause screen — covers iframe but doesn't reload it */}
      {showPauseScreen && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ zIndex: 6, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }}
        >
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(0,0,0,0.7)',
            border: '2px solid rgba(255,255,255,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 0, height: 0, borderTop: '18px solid transparent', borderBottom: '18px solid transparent', borderLeft: '32px solid #fff', marginLeft: 6 }} />
          </div>
        </div>
      )}

      {/* Click layer */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ zIndex: 10 }}
        onClick={handleClick}
      />

      {/* Flash icon */}
      {flashIcon && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 110, height: 110, borderRadius: '50%',
          background: 'rgba(0,0,0,0.72)',
          border: '3px solid rgba(255,255,255,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', zIndex: 30,
          animation: 'isFlashFade 0.9s ease forwards',
        }}>
          {flashIcon === 'pause'
            ? <div style={{ display: 'flex', gap: 11 }}>
                <div style={{ width: 12, height: 42, background: '#fff', borderRadius: 3 }} />
                <div style={{ width: 12, height: 42, background: '#fff', borderRadius: 3 }} />
              </div>
            : <div style={{ width: 0, height: 0, borderTop: '22px solid transparent', borderBottom: '22px solid transparent', borderLeft: '38px solid #fff', marginLeft: 9 }} />
          }
        </div>
      )}

      {/* Overlay gradient + buttons */}
      <div
        className="absolute inset-0 flex flex-col justify-between"
        style={{
          zIndex: 20,
          opacity: showOverlay ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none',
          background: showOverlay
            ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, transparent 55%, rgba(0,0,0,0.75) 100%)'
            : 'transparent',
        }}
      >
        <div
          className="flex justify-end p-3 gap-2"
          style={{ pointerEvents: 'auto' }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={onToggleLike} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm hover:bg-green-500/20 flex items-center justify-center text-slate-300 hover:text-green-400 border border-white/10 hover:border-green-500/40 transition-all" title="Like">
            <i className="fa-solid fa-thumbs-up text-xs" />
          </button>
          <button onClick={onToggleDislike} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm hover:bg-red-500/20 flex items-center justify-center text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/40 transition-all" title="Dislike">
            <i className="fa-solid fa-thumbs-down text-xs" />
          </button>
          <button onClick={onWriteReview} className="w-9 h-9 rounded-xl bg-black/60 backdrop-blur-sm hover:bg-purple-500/20 flex items-center justify-center text-slate-300 hover:text-purple-400 border border-white/10 hover:border-purple-500/40 transition-all" title="Review">
            <i className="fa-solid fa-pen-nib text-xs" />
          </button>
          <button
            onClick={onToggleFavorite}
            className={`w-9 h-9 rounded-xl backdrop-blur-sm border flex items-center justify-center transition-all ${isFavorite ? 'bg-red-500/30 border-red-500/60 text-red-400' : 'bg-black/60 border-white/10 text-slate-300 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/20'}`}
            title="Favorite"
          >
            <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-xs`} />
          </button>
        </div>

        <div className="px-5 pb-4 pt-8">
          <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/80 mb-0.5">{video.category}</p>
          <h2 className="text-[14px] font-bold text-white leading-tight" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
            {video.prompt || video.title || 'Untitled'}
          </h2>
        </div>
      </div>

      <style>{`
        @keyframes isFlashFade {
          0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          60%  { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
        }
      `}</style>
    </div>
  );
};

export default VideoPlayer;
