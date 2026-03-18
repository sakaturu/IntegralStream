import React, { useState } from 'react';
import { VideoItem, VideoCategory } from '../types';

interface VaultGalleryProps {
  videos: VideoItem[];
  categoryColors: Record<string, string>;
  currentVideo: VideoItem | null;
  onSelect: (video: VideoItem) => void;
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveVideo: (id: string, direction: 'up' | 'down') => void;
  isAuthorized: boolean;
  currentUser: string;
}

const VaultGallery: React.FC<VaultGalleryProps> = ({ 
  videos, 
  categoryColors,
  currentVideo, 
  onSelect, 
  isOpen, 
  onClose, 
  onToggleFavorite,
  onRemove,
  onMoveVideo,
  isAuthorized,
  currentUser
}) => {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [orderedVideos, setOrderedVideos] = useState<VideoItem[]>(videos);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Sync when videos prop changes (e.g. item removed)
  React.useEffect(() => { setOrderedVideos(videos); }, [videos]);

  if (!isOpen) return null;

  const getThumbnailUrl = (video: VideoItem) => {
    if (video.thumbnail) return video.thumbnail;
    const trimmed = video.url.trim();
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    const youtubeId = (match && match[1] && match[1].length === 11) ? match[1] : (trimmed.length === 11 ? trimmed : null);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200';
  };

  const getCategoryStyles = (category: VideoCategory) => {
    const color = categoryColors[category] || '#64748b';
    return { color, borderColor: `${color}4D`, backgroundColor: `${color}1A` };
  };

  return (
    <div className="w-full animate-fade-in mt-4">
      <div className="bg-[#0f172a]/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-blue-500/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-blue-500/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <i className="fa-solid fa-vault text-blue-600"></i>
              {currentUser.replace(/_/g, ' ')}'S ARCHIVE
            </h3>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1 pl-6">Drag to reorder · Secure Neural Persona Data</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {orderedVideos.length === 0 ? (
            <div className="py-20 text-center opacity-40">
              <i className="fa-solid fa-heart-crack text-4xl mb-4 text-slate-700"></i>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No signals currently vaulted for {currentUser}.</p>
            </div>
          ) : orderedVideos.map((video, idx) => {
            const catStyle = getCategoryStyles(video.category);
            return (
              <div
                key={video.id}
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragIdx === null || dragIdx === idx) return;
                  setOrderedVideos(prev => {
                    const arr = [...prev];
                    const [moved] = arr.splice(dragIdx, 1);
                    arr.splice(idx, 0, moved);
                    return arr;
                  });
                  setDragIdx(null); setDragOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                onClick={() => onSelect(video)}
                className={`group flex items-center gap-3 p-3 rounded-2xl transition-all cursor-grab active:cursor-grabbing border relative animate-fade-in pr-10 ${
                  dragOverIdx === idx ? 'bg-blue-600/20 border-blue-500/40' :
                  currentVideo?.id === video.id ? 'bg-white/10 border-white/20 ring-1 ring-white/10' : 'bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                <i className="fa-solid fa-grip-vertical text-slate-700 group-hover:text-slate-500 text-[10px] flex-shrink-0 transition-colors"/>

                <div className={`w-24 h-14 rounded-xl bg-slate-900 flex-shrink-0 overflow-hidden relative shadow-2xl border transition-all duration-500 ease-out group-hover:scale-[1.03] group-hover:-translate-y-1 ${currentVideo?.id === video.id ? 'border-blue-500/30' : 'border-white/5'}`}>
                  <img src={getThumbnailUrl(video)} className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" alt="" />
                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${currentVideo?.id === video.id ? 'bg-blue-600/30' : 'bg-black/0 group-hover:bg-black/20'}`}>
                    <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg transition-transform duration-300 ${currentVideo?.id === video.id ? 'scale-100' : 'scale-0 group-hover:scale-100'}`}>
                      <i className="fa-solid fa-play text-blue-600 text-[10px] ml-0.5"></i>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col justify-center gap-1.5 pr-2">
                  <p className="text-[13px] font-bold leading-tight truncate transition-colors duration-300 text-slate-400">{video.prompt}</p>
                  <div className="flex items-center gap-1.5 w-full">
                    <span className="text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md border shrink-0" style={{ color: catStyle.color, borderColor: catStyle.borderColor, backgroundColor: catStyle.backgroundColor }}>{video.category}</span>
                    <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest shrink-0 border-l border-white/10 pl-2">
                      <span className="text-orange-500 flex items-center gap-1 shrink-0">Views:: <span className="text-slate-300 text-[12px]">{video.viewCount.toLocaleString()}</span></span>
                      <span className="text-blue-500 flex items-center gap-1 shrink-0">Likes:: <span className="text-slate-300 text-[12px]">{video.likeCount.toLocaleString()}</span></span>
                    </div>
                  </div>
                </div>

                <div className="absolute top-0 bottom-0 right-3 py-3 flex flex-col items-center justify-center z-30 opacity-30 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(video.id); }} className="text-red-500 transition-all hover:scale-125 active:scale-90">
                    <i className="fa-solid fa-xmark text-[13px]"></i>
                  </button>
                </div>

                {confirmingDeleteId === video.id && (
                  <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-xl rounded-2xl flex items-center justify-between px-6 animate-fade-in border border-red-500/20" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Eviction Protocol</span>
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Remove from vault</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirmingDeleteId(null)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest text-slate-400">Abort</button>
                      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(video.id); setConfirmingDeleteId(null); }} className="px-4 py-2 rounded-xl bg-red-600 text-white text-[8px] font-black uppercase tracking-widest shadow-lg">Confirm</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VaultGallery;
