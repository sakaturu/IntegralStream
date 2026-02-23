import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VideoItem, VideoCategory } from './types';

interface PlaylistProps {
  videos: VideoItem[];
  categories: VideoCategory[];
  categoryColors: Record<string, string>;
  currentVideo?: VideoItem | null;
  onSelect: (video: VideoItem) => void;
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  userFavorites: string[];
  onMoveVideo: (id: string, direction: 'up' | 'down') => void;
  onAddRandom: () => void;
  isGeneratingRandom?: boolean;
  onAddManualVideo: (url: string, prompt: string, category: VideoCategory) => void;
  onAddCategory: (name: string, color?: string) => void;
  onRemoveCategory: (name: string) => void;
  onUpdateCategoryColor: (category: string, color: string) => void;
  onPurgeAll: () => void;
  activeTab: VideoCategory | 'All' | 'Vault';
  setActiveTab: (tab: VideoCategory | 'All' | 'Vault') => void;
  isAuthorized: boolean;
}

const COLOR_PALETTE = [
  ['#60a5fa', '#38bdf8', '#0ea5e9', '#06b6d4', '#22d3ee', '#67e8f9', '#818cf8', '#a5b4fc', '#6366f1', '#4f46e5', '#a855f7', '#d946ef'],
  ['#34d399', '#10b981', '#4ade80', '#22c55e', '#84cc16', '#a3e635', '#bef264', '#d9f99d', '#2dd4bf', '#5eead4', '#14b8a6', '#0d9488'],
  ['#fb923c', '#f97316', '#fbbf24', '#facc15', '#fde047', '#f472b6', '#ec4899', '#f0abfc', '#d8b4fe', '#cbd5e1', '#e2e8f0', '#94a3b8']
];

const Playlist: React.FC<PlaylistProps> = ({ 
  videos, 
  categories,
  categoryColors,
  currentVideo, 
  onSelect, 
  onRemove, 
  onToggleFavorite, 
  userFavorites,
  onMoveVideo,
  onAddRandom,
  isGeneratingRandom = false,
  onAddManualVideo,
  onAddCategory,
  onRemoveCategory,
  onUpdateCategoryColor,
  onPurgeAll,
  activeTab, 
  setActiveTab, 
  isAuthorized,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCat, setNewCat] = useState<VideoCategory | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareSuccessId, setShareSuccessId] = useState<string | null>(null);
  
  const [isAddingCategoryInline, setIsAddingCategoryInline] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0][0]);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);

  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddForm && urlInputRef.current) urlInputRef.current.focus();
  }, [showAddForm]);

  const getCleanId = (input: string) => {
    if (!input) return null;
    const trimmed = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[1] && match[1].length === 11) ? match[1] : null;
  };

  useEffect(() => {
    const videoId = getCleanId(newUrl);
    if (videoId && !newPrompt) {
      setIsFetchingTitle(true);
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
        .then(res => res.json())
        .then(data => { if (data && data.title) setNewPrompt(data.title); })
        .catch(() => {})
        .finally(() => setIsFetchingTitle(false));
    }
  }, [newUrl, newPrompt]);

  const handleShare = (video: VideoItem) => {
    const url = video.url.includes('http') ? video.url : `https://www.youtube.com/watch?v=${getCleanId(video.url)}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareSuccessId(video.id);
      setTimeout(() => setShareSuccessId(null), 2000);
    });
  };

  const filteredVideos = useMemo(() => {
    if (activeTab === 'All') return videos;
    if (activeTab === 'Vault') return videos.filter(v => userFavorites.includes(v.id));
    return videos.filter(v => v.category === activeTab);
  }, [videos, activeTab, userFavorites]);

  const allTabs = useMemo(() => {
    const baseTabs = [{ name: 'All' as const }, { name: 'Vault' as const }];
    const categoryTabs = categories.map(cat => ({ name: cat }));
    return [...baseTabs, ...categoryTabs];
  }, [categories]);

  const firstRowTabs = useMemo(() => allTabs.slice(0, 4), [allTabs]);
  const overflowTabs = useMemo(() => allTabs.slice(4), [allTabs]);

  const getThumbnailUrl = (video: VideoItem) => {
    if (video.thumbnail) return video.thumbnail;
    const youtubeId = getCleanId(video.url);
    if (youtubeId) return `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;
    return 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=200';
  };

  const resetForm = () => { setNewUrl(''); setNewPrompt(''); setNewCat(null); setShowAddForm(false); setIsAddingCategoryInline(false); setInlineCategoryName(''); };

  const handleInlineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || !newCat) return;
    onAddManualVideo(newUrl, newPrompt || "Trace_X", newCat);
    resetForm();
  };

  const handleAddCategoryInline = (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineCategoryName.trim()) {
      onAddCategory(inlineCategoryName.trim(), selectedColor);
      setNewCat(inlineCategoryName.trim());
      setInlineCategoryName('');
      setIsAddingCategoryInline(false);
    }
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getTagStyles = (category: string) => {
    const color = categoryColors[category] || '#cbd5e1';
    return { color: color, borderColor: `${color}60`, backgroundColor: `${color}20` };
  };

  const getTabThematicColor = (tabName: string) => {
    if (tabName === 'All') return '#f8fafc';
    if (tabName === 'Vault') return '#ff3b3b';
    return categoryColors[tabName] || '#cbd5e1';
  };

  const getTabStyles = (tabName: string) => {
    const color = getTabThematicColor(tabName);
    const isActive = activeTab === tabName;
    if (isActive) {
      return { color: color, backgroundColor: `${color}25`, borderColor: `${color}50`, transform: 'scale(1.02)' };
    }
    return { color: `${color}90`, borderColor: 'transparent', backgroundColor: 'transparent' };
  };

  const renderTab = (tab: { name: string }) => {
    const isDeletable = isAuthorized && !['All', 'Vault'].includes(tab.name);
    return (
      <div key={tab.name} className="relative group/tab">
        <button
          onClick={() => setActiveTab(tab.name as any)}
          style={getTabStyles(tab.name)}
          className={`w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center px-1 border relative cursor-pointer`}
        >
          <span className="truncate w-full text-center px-1">{tab.name}</span>
        </button>
        {isDeletable && (
          <button 
            onClick={(e) => { e.stopPropagation(); onRemoveCategory(tab.name); }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity z-10 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-[8px]"></i>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative bg-transparent">
      <div className="flex-none pb-4 z-20 px-4 pt-6">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Library Matrix
          </h3>
          <div className="flex items-center gap-4">
            {isAuthorized && (
              <button onClick={() => { if(confirm('Purge all?')) onPurgeAll(); }} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-all flex items-center gap-2">
                <i className="fa-solid fa-eraser text-[11px]"></i>
              </button>
            )}
            <button onClick={onAddRandom} className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles text-[11px]"></i>
            </button>
            {isAuthorized && (
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border shadow-lg z-30 ${
                  showAddForm ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 rotate-45' : 'bg-white text-black border-white hover:bg-slate-100'
                }`}
              >
                <i className="fa-solid fa-plus text-xs"></i>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="bg-black/40 rounded-xl border border-white/5 shadow-inner p-1">
            <div className="flex items-center gap-1">
              <div className="grid grid-cols-4 gap-1 flex-1">{firstRowTabs.map(renderTab)}</div>
              <button onClick={() => setIsExpanded(!isExpanded)} className={`w-8 h-7 flex-shrink-0 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300 ${isExpanded ? 'bg-white/10 text-white rotate-180' : 'bg-transparent text-slate-700'}`}>
                <i className="fa-solid fa-chevron-down text-[10px]"></i>
              </button>
            </div>
            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[600px] mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="grid grid-cols-4 gap-1 border-t border-white/5 pt-1">
                {overflowTabs.map(renderTab)}
              </div>
            </div>
          </div>

          {isAuthorized && showAddForm && (
            <div className="animate-fade-in bg-slate-900/90 border border-white/10 rounded-2xl p-6 mt-2 shadow-2xl space-y-4">
              <div className="flex flex-col gap-2">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Manual Injection</h4>
                {!isAddingCategoryInline && (
                  <button type="button" onClick={() => setIsAddingCategoryInline(true)} className="w-full h-8 rounded-lg bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-2 text-slate-500 hover:bg-white/10 hover:text-white transition-all">
                    <span className="text-[8px] font-black uppercase tracking-widest">Add Category</span>
                  </button>
                )}
              </div>
              {isAddingCategoryInline && (
                <form onSubmit={handleAddCategoryInline} className="space-y-3 p-3 bg-black/40 rounded-xl border border-white/5">
                  <input autoFocus type="text" placeholder="Cat Name..." value={inlineCategoryName} onChange={(e) => setInlineCategoryName(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none" />
                  <div className="flex gap-1.5 flex-wrap justify-center">
                    {COLOR_PALETTE.flat().map(color => (
                      <button key={color} type="button" onClick={() => setSelectedColor(color)} className={`w-3 h-3 rounded-full border transition-all ${selectedColor === color ? 'border-white scale-125 shadow-[0_0_8px_white]' : 'border-transparent opacity-40'}`} style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setIsAddingCategoryInline(false)} className="flex-1 text-[8px] font-black uppercase text-slate-600">Cancel</button>
                    <button type="submit" className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase">Create</button>
                  </div>
                </form>
              )}
              <form onSubmit={handleInlineSubmit} className="space-y-4">
                <input required type="text" placeholder="URL..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-white/20" />
                <input type="text" placeholder="Title..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-white/20" />
                <div className="flex flex-wrap gap-1">
                  {categories.map(cat => (
                    <button key={cat} type="button" onClick={() => setNewCat(cat)} className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase transition-all ${newCat === cat ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5 text-slate-500'}`}>{cat}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={resetForm} className="flex-1 bg-white/5 border border-white/10 text-slate-500 py-3 rounded-xl text-[9px] font-black uppercase">Abort</button>
                  <button type="submit" disabled={!newUrl || !newCat} className="flex-1 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase shadow-lg disabled:opacity-30">Inject</button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 space-y-1 overflow-y-auto px-4 custom-scrollbar mt-2 pb-10">
        {filteredVideos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
            <i className="fa-solid fa-wind text-3xl text-slate-700 mb-6"></i>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Archive Depleted</p>
          </div>
        ) : filteredVideos.map((video) => {
          const isFavorited = userFavorites.includes(video.id);
          return (
            <div key={video.id} onClick={() => onSelect(video)} className={`group flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border relative animate-fade-in pr-10 ${currentVideo?.id === video.id ? 'bg-white/5 border-white/10 shadow-lg' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
              <div className="absolute top-2 right-3 flex flex-col items-center gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite(video.id); }} 
                  className={`transition-all hover:scale-125 ${isFavorited ? 'text-[#ff3b3b] scale-110' : 'text-slate-600 hover:text-white'}`}
                >
                  <i className={`fa-${isFavorited ? 'solid' : 'regular'} fa-heart text-[16px]`}></i>
                </button>
                {isAuthorized && (<button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(video.id); }} className="text-red-500 transition-all hover:scale-125"><i className="fa-solid fa-xmark text-[13px]"></i></button>)}
              </div>
              {confirmingDeleteId === video.id && (
                <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-2xl flex items-center justify-between px-6 border border-red-500/20" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Delete Video?</span>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmingDeleteId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                    <button onClick={(e) => { e.stopPropagation(); onRemove(video.id); setConfirmingDeleteId(null); }} className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase">Destroy</button>
                  </div>
                </div>
              )}
              <div className={`w-24 h-14 rounded-xl bg-slate-900 flex-shrink-0 overflow-hidden relative border ${currentVideo?.id === video.id ? 'border-white/20' : 'border-white/5'}`}>
                <img src={getThumbnailUrl(video)} className="w-full h-full object-cover grayscale-[0.4] group-hover:grayscale-0 transition-all" alt="" />
                <div className={`absolute inset-0 flex items-center justify-center ${currentVideo?.id === video.id ? 'bg-white/10' : 'bg-transparent'}`}>
                  <i className={`fa-solid fa-play text-white text-[10px] ${currentVideo?.id === video.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}></i>
                </div>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col justify-center gap-1.5 pr-2">
                <p className={`text-[14px] font-bold leading-tight truncate text-slate-400 transition-colors duration-300`}>{video.prompt}</p>
                <div className="flex items-center gap-3 text-[9px] font-black uppercase tracking-widest">
                  <span className="px-1.5 py-0.5 rounded-md border shrink-0" style={getTagStyles(video.category)}>{video.category}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-orange-500">Views::</span>
                    <span className="text-white">{formatCount(video.viewCount)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-blue-500">Likes::</span>
                    <span className="text-white">{formatCount(video.likeCount)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Playlist;