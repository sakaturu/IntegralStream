import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VideoItem, VideoCategory } from '../types';

interface PlaylistProps {
  videos: VideoItem[];
  categories: VideoCategory[];
  categoryColors: Record<string, string>;
  currentVideo?: VideoItem | null;
  onSelect: (video: VideoItem) => void;
  onRemove: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleLike?: (id: string) => void;
  isPlaying?: boolean;
  userFavorites: string[];
  onMoveVideo: (fromId: string, toId: string) => void;
  onAddRandom: () => void;
  isGeneratingRandom?: boolean;
  onAddManualVideo: (url: string, prompt: string, category: VideoCategory) => void;
  onAddCategory: (name: string, color?: string) => void;
  onRemoveCategory: (name: string) => void;
  onRenameCategory?: (oldName: string, newName: string) => void;
  onUpdateCategoryColor: (category: string, color: string) => void;
  onPurgeAll: () => void;
  activeTab: VideoCategory | 'All' | 'Vault';
  setActiveTab: (tab: VideoCategory | 'All' | 'Vault') => void;
  isAuthorized: boolean;
  currentUser?: string;
  onAddToPlaylist?: () => void;
  onOpenMusicApp?: () => void;
  onShowUserPlaylist?: boolean;
  onHideUserPlaylist?: () => void;
  isUserLocked?: boolean;
  onWriteReview?: (videoId: string, rating: number, comment: string) => void;
  onRequestIdentify?: () => void;
  onEditVideo?: (id: string, prompt: string, category: string) => void;
}

const COLOR_PALETTE = [
  ['#3b82f6', '#60a5fa', '#2563eb', '#1d4ed8', '#0ea5e9', '#38bdf8', '#0284c7', '#0369a1', '#0c4a6e', '#6366f1', '#818cf8', '#4f46e5'],
  ['#10b981', '#34d399', '#059669', '#22c55e', '#4ade80', '#16a34a', '#84cc16', '#a3e635', '#65a30d', '#14b8a6', '#2dd4bf', '#0d9488'],
  ['#f97316', '#fb923c', '#ea580c', '#f59e0b', '#fbbf24', '#d97706', '#facc15', '#ca8a04', '#94a3b8', '#8b5cf6', '#a78bfa', '#7c3aed']
];

const Playlist: React.FC<PlaylistProps> = ({ 
  videos, 
  categories,
  categoryColors,
  currentVideo, 
  onSelect, 
  onRemove, 
  onToggleFavorite, 
  onToggleLike,
  isPlaying = false,
  userFavorites,
  onMoveVideo,
  onAddRandom,
  isGeneratingRandom = false,
  onAddManualVideo,
  onAddCategory,
  onRemoveCategory,
  onRenameCategory,
  onUpdateCategoryColor,
  onPurgeAll,
  activeTab, 
  setActiveTab, 
  isAuthorized,
  currentUser = '',
  onAddToPlaylist,
  onOpenMusicApp,
  onShowUserPlaylist = false,
  onHideUserPlaylist,
  isUserLocked = false,
  onWriteReview,
  onRequestIdentify,
  onEditVideo,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [renamingTab, setRenamingTab] = useState<string|null>(null);
  const [renameTabVal, setRenameTabVal] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCat, setNewCat] = useState<VideoCategory | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [editCat, setEditCat] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [shareSuccessId, setShareSuccessId] = useState<string | null>(null);
  
  const [isAddingCategoryInline, setIsAddingCategoryInline] = useState(false);
  const [inlineCategoryName, setInlineCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0][0]);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [search, setSearch] = useState('');

  const urlInputRef = useRef<HTMLInputElement>(null);
  const dragSrcId   = useRef<string>('');
  const userDragSrcId = useRef<string>('');

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
    let base = videos.filter(v => !(v as any).addedBy);
    if (activeTab === 'Vault') base = base.filter(v => userFavorites.includes(v.id));
    else if (activeTab !== 'All') base = base.filter(v => v.category === activeTab);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      base = base.filter(v => v.prompt?.toLowerCase().includes(q) || v.category?.toLowerCase().includes(q));
    }
    return base;
  }, [videos, activeTab, userFavorites, search]);

  const allTabs = useMemo(() => {
    const baseTabs = [{ name: 'All' as const }, { name: 'Vault' as const }];
    const categoryTabs = [...categories].sort((a,b)=>a.localeCompare(b)).map(cat => ({ name: cat }));
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

  const shortCat = (name: string) => {
    if (!name) return name;
    if (name.length <= 6) return name;
    // Use first letter of each word
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) return words.map(w => w[0].toUpperCase()).join('');
    // Single long word — take first 4 chars
    return name.slice(0, 4).toUpperCase();
  };

  const getTagStyles = (category: string) => {
    const color = categoryColors[category] || '#94a3b8';
    return { color: color, borderColor: `${color}40`, backgroundColor: `${color}1A` };
  };

  const getTabThematicColor = (tabName: string) => {
    if (tabName === 'All') return '#f8fafc';
    if (tabName === 'Vault') return '#ef4444';
    return categoryColors[tabName] || '#94a3b8';
  };

  const getTabStyles = (tabName: string) => {
    const color = getTabThematicColor(tabName);
    const isActive = activeTab === tabName;
    if (isActive) {
      return { color: color, backgroundColor: `${color}1A`, borderColor: `${color}33`, transform: 'scale(1.02)' };
    }
    return { color: '#ffffff', borderColor: 'transparent', backgroundColor: 'transparent' };
  };

  const renderTab = (tab: { name: string }) => {
    const isDeletable = isAuthorized && !['All', 'Vault'].includes(tab.name);
    const color = getTabThematicColor(tab.name);
    const isActive = activeTab === tab.name;
    return (
      <div key={tab.name} className="relative group/tab">
        <button
          onClick={() => { setActiveTab(tab.name as any); if (onShowUserPlaylist) onHideUserPlaylist?.(); }}
          style={getTabStyles(tab.name)}
          onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = color; }}
          onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.color = '#ffffff'; }}
          className={`w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center px-1 border relative cursor-pointer`}
        >
          <span className="truncate w-full text-center px-1">{tab.name}</span>
        </button>
        {isDeletable && (<>
          <button onClick={(e) => { e.stopPropagation(); onRemoveCategory(tab.name); }} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity z-10 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"><i className="fa-solid fa-xmark text-[8px]"></i></button>
          <button onClick={e=>{e.stopPropagation();setRenamingTab(tab.name);setRenameTabVal(tab.name);}} className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity z-10 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"><i className="fa-solid fa-pen text-[7px]"/></button>
          {renamingTab===tab.name&&(<div className="absolute top-full mt-1 left-0 z-50 flex gap-1 bg-slate-900 border border-white/10 rounded-xl p-1.5 shadow-2xl" onClick={e=>e.stopPropagation()}><input autoFocus value={renameTabVal} onChange={e=>setRenameTabVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){onRenameCategory?.(tab.name,renameTabVal);setRenamingTab(null);}if(e.key==='Escape')setRenamingTab(null);}} className="h-6 w-24 px-2 rounded-lg bg-white/5 border border-blue-500/30 text-white text-[9px] font-bold focus:outline-none"/><button onClick={()=>{onRenameCategory?.(tab.name,renameTabVal);setRenamingTab(null);}} className="h-6 px-2 rounded-lg bg-blue-600 text-white text-[8px] font-black uppercase hover:bg-blue-500">OK</button><button onClick={()=>setRenamingTab(null)} className="h-6 px-1.5 rounded-lg bg-white/5 text-slate-400 text-[8px] hover:text-white">✕</button></div>)}
        </>)}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full relative bg-transparent">
      <div className="flex-none pb-4 z-20 px-4 pt-6">
        <div className="flex items-center justify-between mb-4 px-1">
          {/* Left: title + playlist btn + add btn */}
          <div className="flex items-center gap-3">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
              Library Matrix
            </h3>
            {(isAuthorized || isUserLocked) && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${showAddForm ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 rotate-45' : 'bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/40'}`}
                title="Add video"
              >
                <i className="fa-solid fa-plus text-[9px]"/>
              </button>
            )}
          </div>
          {/* Right: VIDEO|MUSIC + shuffle + search + purge */}
          <div className="flex items-center gap-2">
            <div style={{display:'flex',alignItems:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:2,border:'1px solid rgba(255,255,255,0.1)',width:132,flexShrink:0}}>
              <button style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'#2563eb',color:'#fff'}}>
                <i className="fa-solid fa-film" style={{fontSize:8}}></i> VIDEO
              </button>
              <button
                onClick={onOpenMusicApp}
                style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'transparent',color:'#64748b'}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#fff';(e.currentTarget as HTMLButtonElement).style.background='#7c3aed';}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#64748b';(e.currentTarget as HTMLButtonElement).style.background='transparent';}}
              >
                <i className="fa-solid fa-music" style={{fontSize:8}}></i> MUSIC
              </button>
            </div>
            <button onClick={()=>{if(!isUserLocked&&!isAuthorized){onRequestIdentify?.();return;}onAddRandom();}} title="Shuffle" className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center"><i className="fa-solid fa-shuffle text-[11px]"></i></button>
            <div className="relative flex-shrink-0">
              <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="h-7 w-28 pl-7 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500/30"/>
            </div>
            {isAuthorized && (
              <button onClick={() => { if(confirm('Purge all?')) onPurgeAll(); }} className="text-[9px] font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-all flex items-center">
                <i className="fa-solid fa-eraser text-[11px]"></i>
              </button>
            )}
          </div>
        </div>

        {showAddForm && (isAuthorized || isUserLocked) && (
          <div className="animate-fade-in bg-slate-900/90 border border-white/10 rounded-2xl p-6 mb-4 shadow-2xl space-y-4">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Add Video</h4>
            <input autoFocus type="text" placeholder="URL..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-white/20" />
            <input type="text" placeholder="Title..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-white/20" />
            <div className="flex flex-wrap gap-1">
              {[...categories].sort((a,b)=>a.localeCompare(b)).map(cat => (
                <button key={cat} type="button" onClick={() => setNewCat(cat)} className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase transition-all ${newCat === cat ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5 text-slate-500'}`}>{cat}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetForm} className="flex-1 bg-white/5 border border-white/10 text-slate-500 py-3 rounded-xl text-[9px] font-black uppercase">Abort</button>
              <button type="button" onClick={(e)=>{e.preventDefault();if(!newUrl||!newCat)return;const clean=(u:string)=>u.replace(/[?#].*/,'');if(videos.some(v=>v.url===newUrl||clean(v.url)===clean(newUrl))){alert('This video is already in the archive.');return;}onAddManualVideo(newUrl,newPrompt||"Trace_X",newCat);resetForm();}} disabled={!newUrl || !newCat} className="flex-1 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase shadow-lg disabled:opacity-30">Inject</button>
            </div>
          </div>
        )}

        {/* Add Category form — admin only, same location as music Add Genre */}
        {isAuthorized && (
          <div className="mt-1 px-1">
            {isAddingCategoryInline ? (
              <div className="flex flex-col gap-2">
                <input
                  autoFocus
                  value={inlineCategoryName}
                  onChange={e => setInlineCategoryName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && inlineCategoryName.trim()) { onAddCategory(inlineCategoryName.trim(), selectedColor); setInlineCategoryName(''); setIsAddingCategoryInline(false); } }}
                  placeholder="Category name..."
                  className="flex-1 h-7 px-2 rounded-lg bg-white/5 border border-blue-500/30 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {COLOR_PALETTE.flat().map(c => (
                    <button key={c} type="button" onClick={() => setSelectedColor(c)} className={`w-5 h-5 rounded-full transition-all hover:scale-125 ${selectedColor === c ? 'ring-2 ring-white ring-offset-1 ring-offset-black scale-125' : ''}`} style={{ backgroundColor: c }}/>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { if (inlineCategoryName.trim()) { onAddCategory(inlineCategoryName.trim(), selectedColor); setInlineCategoryName(''); setIsAddingCategoryInline(false); } }} className="h-7 px-3 rounded-lg bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 transition-all">Add</button>
                  <button type="button" onClick={() => { setIsAddingCategoryInline(false); setInlineCategoryName(''); }} className="h-7 px-2 rounded-lg bg-white/5 text-slate-400 font-black text-[9px] hover:text-white transition-all">✕</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setIsAddingCategoryInline(true)} className="w-full h-7 rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-slate-600 hover:text-blue-400 hover:border-blue-500/30 transition-all">
                <i className="fa-solid fa-plus text-[9px]"/><span className="text-[8px] font-black uppercase tracking-widest">Add Category</span>
              </button>
            )}
          </div>
        )}

      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar mt-2 pb-10">
        {onShowUserPlaylist ? (
          <div className="px-4 space-y-2 pt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">{currentUser?.replace(/_/g,' ')} Playlist <span className="text-slate-600 ml-1">· {videos.filter(v=>(v as any).addedBy===currentUser).length} videos</span></p>
              <button onClick={onHideUserPlaylist} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xs"/></button>
            </div>
            {videos.filter(v => (v as any).addedBy === currentUser).length > 0 ? (
              <div className="space-y-1">
                {videos.filter(v => (v as any).addedBy === currentUser).map((v, _vi) => (
                  <div key={v.id}
                    draggable
                    onDragStart={e=>{ userDragSrcId.current=v.id; e.dataTransfer.effectAllowed='move'; }}
                    onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                    onDrop={e=>{ e.preventDefault(); if(userDragSrcId.current && userDragSrcId.current!==v.id) onMoveVideo(userDragSrcId.current, v.id); userDragSrcId.current=''; }}
                    onDragEnd={()=>{ userDragSrcId.current=''; }}
                    className="group flex items-center gap-2 px-1.5 py-0.5 border-b border-white/5 last:border-0">
                    {/* Drag handle */}
                    <div onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="flex-shrink-0 flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-blue-400" title="Drag to reorder">
                      <i className="fa-solid fa-grip-vertical text-[10px]"/>
                    </div>
                    <div className="w-[140px] h-20 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 border border-white/5 cursor-pointer" onClick={() => { onSelect(v); onHideUserPlaylist?.(); }}><img src={getThumbnailUrl(v)} className="w-full h-full object-cover" alt=""/></div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { onSelect(v); onHideUserPlaylist?.(); }}>
                      <p className="text-[14px] font-black uppercase tracking-tight text-blue-400 truncate leading-none">{v.category}</p>
                      <p className="text-[15px] font-bold leading-none truncate text-slate-300">{v.prompt || v.url}</p>
                      <div className="flex items-center flex-nowrap mt-[4px] overflow-hidden">
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 shrink-0">{shortCat(v.category)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-orange-500 text-[9px] font-black uppercase shrink-0">Views::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{formatCount(v.viewCount)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-blue-500 text-[9px] font-black uppercase shrink-0">Likes::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{formatCount(v.likeCount)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-purple-500 text-[9px] font-black uppercase shrink-0">Reviews::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{(v.reviews||[]).filter((r:any)=>r.isApproved).length}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-0 flex-shrink-0">
                      {isAuthorized ? (
                        <>
                          <button onClick={e=>{e.stopPropagation();setEditingVideoId(v.id);setEditPrompt(v.prompt||'');setEditCat(v.category||'');}} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-purple-400 transition-all" title="Edit"><i className="fa-solid fa-pen text-[11px]"/></button>
                          <button onClick={e => { e.stopPropagation(); onRemove(v.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[17px]"/></button>
                        </>
                      ) : (
                        <>
                          <button onClick={e=>{e.stopPropagation();onToggleLike?.(v.id);}} className={`w-6 h-6 flex items-center justify-center transition-all ${((v as any).likedBy||[]).includes(currentUser)?'text-blue-400':'text-slate-600 hover:text-blue-400'}`} title="Like"><i className={`fa-${((v as any).likedBy||[]).includes(currentUser)?'solid':'regular'} fa-thumbs-up text-[15px]`}/></button>
                          {(v.reviews||[]).some((r:any)=>r.user===currentUser)
                            ? <button className="w-6 h-6 flex items-center justify-center cursor-default text-yellow-400" title="Already reviewed"><i className="fa-solid fa-star text-[15px]"/></button>
                            : <button onClick={e=>{e.stopPropagation();onSelect(v);onWriteReview?.(v.id,0,'');}} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-yellow-400 transition-all" title="Review"><i className="fa-regular fa-star text-[15px]"/></button>}
                          <button onClick={e=>{e.stopPropagation();onToggleFavorite(v.id);}} className={`w-6 h-6 flex items-center justify-center transition-all ${userFavorites.includes(v.id)?'text-pink-400':'text-slate-600 hover:text-pink-400'}`} title="Add to vault"><i className={`fa-${userFavorites.includes(v.id)?'solid':'regular'} fa-heart text-[15px]`}/></button>
                          <button onClick={e => { e.stopPropagation(); onRemove(v.id); }} className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[17px]"/></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-700"><i className="fa-solid fa-film text-3xl"/><p className="text-[9px] font-black uppercase tracking-widest">No videos uploaded yet</p></div>
            )}
          </div>
        ) : (
          <div className="space-y-1 px-4">
            {filteredVideos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                <i className="fa-solid fa-wind text-3xl text-slate-700 mb-6"></i>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Archive Depleted</p>
              </div>
            ) : filteredVideos.map((video) => (
          <div key={video.id}
            draggable={isAuthorized}
            onDragStart={e=>{ dragSrcId.current=video.id; e.dataTransfer.effectAllowed='move'; }}
            onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
            onDrop={e=>{ e.preventDefault(); if(dragSrcId.current && dragSrcId.current!==video.id) onMoveVideo(dragSrcId.current, video.id); dragSrcId.current=''; }}
            onDragEnd={()=>{ dragSrcId.current=''; }}
            onClick={() => onSelect(video)}
            className={`group flex items-center gap-1 px-[10px] py-[6px] rounded-lg transition-all cursor-pointer border relative ${currentVideo?.id === video.id ? (isPlaying ? 'bg-blue-500/25 border-blue-400/40 shadow-lg shadow-blue-500/10' : 'bg-blue-500/25 border-blue-400/40 shadow-lg shadow-blue-500/10 animate-pulse') : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/25 hover:border-blue-400/40'}`}>
            {confirmingDeleteId === video.id && (
              <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-xl flex items-center justify-between px-6 border border-red-500/20" onClick={(e) => e.stopPropagation()}>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Delete Video?</span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmingDeleteId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                  <button onClick={(e) => { e.stopPropagation(); onRemove(video.id); setConfirmingDeleteId(null); }} className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase">Destroy</button>
                </div>
              </div>
            )}
            {editingVideoId === video.id && (
              <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-xl flex flex-col gap-2 px-4 py-3 border border-blue-500/20" onClick={(e) => e.stopPropagation()}>
                <input value={editPrompt} onChange={e=>setEditPrompt(e.target.value)} placeholder="Title..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-blue-500/40"/>
                <div className="flex gap-1 flex-wrap">
                  {[...categories].sort((a,b)=>a.localeCompare(b)).map(c=><button key={c} onClick={()=>setEditCat(c)} className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border transition-all ${editCat===c?'bg-blue-600 border-blue-500 text-white':'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>{c}</button>)}
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={()=>setEditingVideoId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                  <button onClick={()=>{onEditVideo?.(video.id,editPrompt,editCat);setEditingVideoId(null);}} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-[8px] font-black uppercase">Save</button>
                </div>
              </div>
            )}
            {/* Drag handle — admin only */}
            {isAuthorized && (
              <div onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="flex-shrink-0 flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-blue-400" title="Drag to reorder">
                <i className="fa-solid fa-grip-vertical text-[10px]"/>
              </div>
            )}
            {/* Thumbnail */}
            <div className={`w-[140px] h-20 rounded-xl flex-shrink-0 border overflow-hidden relative ${currentVideo?.id === video.id ? 'border-blue-500/40' : 'border-white/5'}`}>
              <img src={getThumbnailUrl(video)} className="w-full h-full object-cover" alt=""/>
              {currentVideo?.id === video.id && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'} text-white text-[12px]`}/>
                </div>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 overflow-hidden flex flex-col justify-center gap-0 min-w-0">
              <p className="text-[14px] font-black uppercase tracking-tight text-blue-400 truncate leading-none">{video.category}</p>
              <p className="text-[15px] font-bold leading-none truncate text-slate-300">{video.prompt}</p>
              <div className="flex items-center flex-nowrap mt-[4px] overflow-hidden">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 shrink-0">{shortCat(video.category)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-orange-500 text-[9px] font-black uppercase shrink-0">Views::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{formatCount(video.viewCount)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-blue-500 text-[9px] font-black uppercase shrink-0">Likes::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{formatCount(video.likeCount)}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-purple-500 text-[9px] font-black uppercase shrink-0">Reviews::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{(video.reviews?.filter(r=>r.isApproved)?.length||0)}</span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="flex flex-col flex-shrink-0 self-stretch relative w-6">
              {isAuthorized ? (
                <>
                  <button onClick={(e) => { e.stopPropagation(); setEditingVideoId(video.id); setEditPrompt(video.prompt||''); setEditCat(video.category||''); }} className="absolute top-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-500 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-400 transition-all" title="Edit"><i className="fa-solid fa-pen text-[7px]"/></button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(video.id); }} className="absolute bottom-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[9px]"/></button>
                </>
              ) : (
                <>
                  {((video.reviews||[]).some((r:any)=>r.user===currentUser)
                    ? <button className="absolute top-[3px] left-0 w-6 h-6 flex items-center justify-center cursor-default text-yellow-400" title="Already reviewed"><i className="fa-solid fa-star text-[11px]"/></button>
                    : <button onClick={(e) => { e.stopPropagation(); if(!isUserLocked){onRequestIdentify?.();return;} onWriteReview?.(video.id, 0, ''); }} className="absolute top-[3px] left-0 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-yellow-400 transition-all" title="Review"><i className="fa-regular fa-star text-[11px]"/></button>)}
                  <div className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-7 pb-7">
                    <button onClick={(e) => { e.stopPropagation(); if(!isUserLocked){onRequestIdentify?.();return;} onToggleLike?.(video.id); }} className={`w-6 h-6 flex items-center justify-center transition-all ${((video as any).likedBy||[]).includes(currentUser) ? 'text-blue-400' : 'text-slate-600 hover:text-blue-400'}`} title="Like"><i className={`fa-${((video as any).likedBy||[]).includes(currentUser) ? 'solid' : 'regular'} fa-thumbs-up text-[11px]`}/></button>
                    <button onClick={(e) => { e.stopPropagation(); if(!isUserLocked){onRequestIdentify?.();return;} onToggleFavorite(video.id); }} className={`w-6 h-6 flex items-center justify-center transition-all ${userFavorites.includes(video.id) ? 'text-pink-400' : 'text-slate-600 hover:text-pink-400'}`} title="Add to vault"><i className={`fa-${userFavorites.includes(video.id) ? 'solid' : 'regular'} fa-heart text-[11px]`}/></button>
                  </div>
                  {(isUserLocked&&(video as any).addedBy===currentUser) && <button onClick={(e) => { e.stopPropagation(); setConfirmingDeleteId(video.id); }} className="absolute bottom-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[9px]"/></button>}
                </>
              )}
            </div>
          </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Playlist;