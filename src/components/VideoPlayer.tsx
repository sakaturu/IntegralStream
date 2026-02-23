import React, { useRef, useState, useEffect, useMemo } from 'react';
import { VideoItem } from '../types';

interface VideoPlayerProps {
  video: VideoItem | null;
  isFavorite?: boolean;
  isPlaying: boolean;
  onPlayStateChange: (isPlaying: boolean) => void;
  onEnded?: () => void;
  onToggleLike?: () => void;
  onToggleDislike?: () => void;
  onToggleFavorite?: () => void;
  onViewIncrement?: () => void;
  onWriteReview?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  video, 
  isFavorite = false,
  isPlaying, 
  onPlayStateChange, 
  onEnded, 
  onToggleLike, 
  onToggleDislike,
  onToggleFavorite,
  onViewIncrement,
  onWriteReview
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [viewCounted, setViewCounted] = useState(false);
  const controlsTimeoutRef = useRef<number | null>(null);

  const getCleanId = (input: string) => {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[1] && match[1].length === 11) ? match[1] : null;
  };

  const youtubeId = useMemo(() => video ? getCleanId(video.url) : null, [video?.url]);
  const isYouTube = !!youtubeId;
  const videoId = video?.id;

  useEffect(() => {
    setIsSyncing(true);
    setViewCounted(false);
    const timer = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timer);
  }, [videoId]);

  useEffect(() => {
    if (isPlaying && !viewCounted && videoId && video?.status === 'ready') {
      const timer = window.setTimeout(() => {
        onViewIncrement?.();
        setViewCounted(true);
      }, 10000);
      return () => window.clearTimeout(timer);
    }
  }, [isPlaying, viewCounted, onViewIncrement, videoId, video?.status]);

  useEffect(() => {
    if (!isYouTube) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'onStateChange') {
          if (data.info === 0) onEnded?.();
          else if (data.info === 1) onPlayStateChange(true);
          else if (data.info === 2) onPlayStateChange(false);
        }
      } catch (e) {}
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isYouTube, onEnded, onPlayStateChange]);

  const sendYoutubeCommand = (func: string, args: any = '') => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args }), '*');
    }
  };

  useEffect(() => {
    if (isYouTube) {
      sendYoutubeCommand(isPlaying ? 'playVideo' : 'pauseVideo');
      sendYoutubeCommand('unMute');
      sendYoutubeCommand('setVolume', 80);
    } else if (videoRef.current) {
      if (isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
      videoRef.current.volume = 0.8;
      videoRef.current.muted = false;
    }
  }, [isPlaying, isYouTube, videoId]);

  const handlePlayerClick = () => {
    const nextPlaying = !isPlaying;
    onPlayStateChange(nextPlaying);
    setShowControls(!nextPlaying);
  };

  const triggerControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = window.setTimeout(() => { if (isPlaying) setShowControls(false); }, 2500);
  };

  if (!video) {
    return (
      <div className="w-full aspect-video rounded-[2rem] overflow-hidden bg-slate-950 border border-white/5 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center mb-4">
          <i className="fa-solid fa-cloud text-slate-800 text-xl"></i>
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-800">Archive Standby</p>
      </div>
    );
  }

  const youtubeUrl = isYouTube 
    ? `https://www.youtube.com/embed/${youtubeId}?autoplay=0&mute=0&rel=0&modestbranding=1&controls=0&enablejsapi=1&origin=${window.location.origin}`
    : '';

  const isHUDVisible = !isPlaying || showControls;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-black group animate-fade-in"
      onMouseMove={triggerControls}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <div 
        onClick={handlePlayerClick}
        className={`absolute inset-0 z-10 cursor-pointer transition-opacity duration-500 ${isHUDVisible ? 'opacity-100' : 'opacity-0'} bg-gradient-to-t from-black/60 via-transparent to-black/20`}
      ></div>

      <div className={`absolute top-8 left-8 z-20 flex flex-col gap-4 transition-all duration-700 ease-out ${isHUDVisible ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
          className={`w-12 h-12 rounded-2xl glass border flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${
            isFavorite ? 'bg-red-600/40 border-red-500/60 text-[#ff3b3b] shadow-[0_0_30px_rgba(255,59,59,0.7)]' : 'bg-black/40 border-white/10 text-slate-500 hover:text-white'
          }`}
        >
          <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-lg drop-shadow-[0_0_2px_rgba(0,0,0,0.5)]`}></i>
        </button>
      </div>

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 transition-all duration-700 ease-out ${isHUDVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <div className="flex items-center gap-3 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl">
          <button onClick={(e) => { e.stopPropagation(); onToggleLike?.(); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${video.isLiked ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><i className="fa-solid fa-thumbs-up"></i></button>
          <button onClick={(e) => { e.stopPropagation(); onToggleDislike?.(); }} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${video.isDisliked ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-400 hover:text-white'}`}><i className="fa-solid fa-thumbs-down"></i></button>
          <div className="w-px h-6 bg-white/10 mx-1"></div>
          <button onClick={(e) => { e.stopPropagation(); onWriteReview?.(); }} className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center transition-all hover:bg-white/20"><i className="fa-solid fa-pen-nib"></i></button>
        </div>
      </div>

      <div className="w-full h-full relative bg-black">
        {isYouTube ? (
          <div className="w-full h-full relative">
            {isSyncing && (
              <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-2 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
              </div>
            )}
            <iframe ref={iframeRef} width="100%" height="100%" src={youtubeUrl} frameBorder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" className="w-full h-full pointer-events-none"></iframe>
          </div>
        ) : (
          <video key={video.url} ref={videoRef} src={video.url} playsInline className="w-full h-full object-cover" onPlay={() => onPlayStateChange(true)} onPause={() => onPlayStateChange(false)} onEnded={onEnded} />
        )}
      </div>
    </div>
  );
};

export default VideoPlayer;