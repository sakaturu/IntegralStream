import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import VisualizerCanvas from './VisualizerCanvas';

const DEFAULT_MUSIC_GENRES = ['Dance','Classical','Country','Rock','Jazz','Hip-Hop','Electronic','Pop','Other'];
const MUSIC_GENRES_KEY     = 'integral_music_genres_v1';
const MUSIC_REVIEWS_KEY    = 'integral_music_reviews_v1';
const MUSIC_FAVORITES_KEY  = 'integral_music_favorites_v1';

const DEFAULT_GENRE_COLORS: Record<string,string> = {
  'Dance':'#d946ef','Classical':'#3b82f6','Country':'#f97316',
  'Rock':'#ef4444','Jazz':'#f59e0b','Hip-Hop':'#8b5cf6',
  'Electronic':'#06b6d4','Pop':'#ec4899','Other':'#94a3b8',
};

const COLOR_PALETTE = [
  ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9','#3b82f6','#6366f1'],
  ['#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#64748b','#94a3b8','#cbd5e1','#fbbf24','#fb923c','#f87171','#34d399'],
  ['#0284c7','#0369a1','#1d4ed8', '#4f46e5','#7c3aed','#9333ea','#be185d','#e11d48','#b91c1c','#c2410c','#b45309','#4d7c0f'],
];

interface MusicTrack {
  id:string; artist:string; title:string; url:string; thumbnail?:string;
  category:string; addedBy:string; timestamp:number; playCount:number; likeCount:number;
  isFavorite?:boolean;
}

interface MusicAppProps {
  currentUser:string; isAuthorized:boolean; onClose:()=>void;
  profilePic?:string; nodeId?:string; isUserLocked?:boolean;
  pendingReviewsCount?:number; onLogout?:()=>void; onAdminClick?:()=>void;
}


const MusicApp: React.FC<MusicAppProps> = ({ currentUser, onClose }) => {
  const vizContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleFullscreen = () => {
    const el = vizContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col font-sans text-slate-200">
      <div ref={vizContainerRef} className="flex-1 relative overflow-hidden">
        <VisualizerCanvas />

        {/* Fullscreen button — matches video player style */}
        <button
          onClick={handleFullscreen}
          className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 transition-all z-50"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'} text-xs`} />
        </button>
      </div>

      {/* Close button — moved left to avoid overlap with fullscreen */}
      <button onClick={onClose} className="absolute top-3 right-14 w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white border border-white/10 transition-all z-50">
        <i className="fa-solid fa-xmark text-sm"></i>
      </button>
    </div>
  );
};

export default MusicApp;