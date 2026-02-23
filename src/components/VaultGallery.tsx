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
  isAuthorized,
  currentUser
}) => {
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const getThumbnailUrl = (video: VideoItem) => {
    if (video.thumbnail) return video.thumbnail;
    const trimmed = video.url.trim();
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    const youtubeId = (match && match[1] && match[1].length === 11) ? match[1] : (trimmed.length === 11 ? trimmed : null);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    return '';
  };

  const getCategoryStyles = (category: VideoCategory) => {
    const color = categoryColors[category] || '#64748b';
    return {
      color: color,
      borderColor: `${color}4D`,
      backgroundColor: `${color}1A`,
    };
  };

  const handleDelete = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    // Remove from favorites
    onToggleFavorite(videoId);
    setConfirmingDeleteId(null);
    
  };

  return (
    <div className="w-full animate-fade-in mt-4">
      <div className="bg-[#0f172a]/80 backdrop-blur-2xl p-8 rounded-[2.5rem] border border-blue-500/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden ring-1 ring-blue-500/10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h3 className="text-[13px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <i className="fa-solid fa-vault text-blue-600"></i>
              {currentUser.replace(/_/g, ' ')}'S VAULT
            </h3>
            <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1 pl-6">{videos.length} saved videos</p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {videos.length === 0 ? (
            <div className="py-20 text-center opacity-40">
              <i className="fa-solid fa-heart-crack text-4xl mb-4 text-slate-700 block"></i>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No saved videos yet</p>
            </div>
          ) : (
            videos.map((video) => {
              const catStyle = getCategoryStyles(video.category);
              return (
                <div 
                  key={video.id}
                  onClick={() => onSelect(video)}
                  className={`group flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border relative animate-fade-in pr-10 ${
                    currentVideo?.id === video.id 
                    ? 'bg-white/10 border-white/20 ring-1 ring-white/10' 
                    : 'bg-transparent border-transparent hover:bg-white/5'
                  }`}
                >
                  <div className={`w-24 h-14 rounded-xl bg-slate-900 flex-shrink-0 overflow-hidden relative shadow-2xl border ${currentVideo?.id === video.id ? 'border-blue-500/30' : 'border-white/5'}`}>
                    <img src={getThumbnailUrl(video)} className="w-full h-full object-cover" alt="" />
                    <div className={`absolute inset-0 flex items-center justify-center ${currentVideo?.id === video.id ? 'bg-blue-600/30' : 'bg-black/0 group-hover:bg-black/20'}`}>
                      <div className={`w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg transition-transform duration-300 ${currentVideo?.id === video.id ? 'scale-100' : 'scale-0 group-hover:scale-100'}`}>
                        <i className="fa-solid fa-play text-blue-600 text-[10px] ml-0.5"></i>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col justify-center gap-1.5 pr-2">
                    <p className="text-[13px] font-bold leading-tight truncate text-slate-400">
                      {video.prompt}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span 
                        className="text-[10px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md border shrink-0"
                        style={catStyle}
                      >
                        {video.category}
                      </span>
                      <span className="text-[10px] font-black text-orange-500 shrink-0">
                        Views:: <span className="text-slate-300">{video.viewCount.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <div className="absolute top-0 bottom-0 right-3 py-3 flex flex-col items-center justify-center z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(video.id); }} 
                      className="text-red-500 hover:scale-125 transition-transform"
                    >
                      <i className="fa-solid fa-xmark text-[13px]"></i>
                    </button>
                  </div>

                  {/* Confirm delete overlay */}
                  {confirmingDeleteId === video.id && (
                    <div 
                      className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-xl rounded-2xl flex items-center justify-between px-6 animate-fade-in border border-red-500/20" 
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Remove from vault?</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(null); }} 
                          className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-widest text-slate-400"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={(e) => handleDelete(e, video.id)} 
                          className="px-4 py-2 rounded-xl bg-red-600 text-white text-[8px] font-black uppercase tracking-widest shadow-lg"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default VaultGallery;
