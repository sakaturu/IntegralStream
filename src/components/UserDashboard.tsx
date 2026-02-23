import React, { useState, useCallback } from 'react';
import { VideoItem, VideoCategory } from '../types';

interface UserDashboardProps {
  currentUser: string;
  nodeId: string;
  videos: VideoItem[];
  categories: VideoCategory[];
  categoryColors: Record<string, string>;
  userFavorites: string[];
  onAddVideo: (url: string, prompt: string, category: VideoCategory) => void;
  onRemoveVideo: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onSelectVideo: (video: VideoItem) => void;
  onClose: () => void;
  isAuthorized: boolean;
}

const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  nodeId,
  videos,
  categories,
  categoryColors,
  userFavorites,
  onAddVideo,
  onRemoveVideo,
  onToggleFavorite,
  onSelectVideo,
  onClose,
  isAuthorized,
}) => {
  const [activeTab, setActiveTab] = useState<'archive' | 'add' | 'favorites'>('archive');
  const [newUrl, setNewUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCat, setNewCat] = useState<VideoCategory>(categories[0] || 'Other');
  const [isFetching, setIsFetching] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeCopied, setNodeCopied] = useState(false);

  const getCleanId = (url: string) => {
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    return match && match[1]?.length === 11 ? match[1] : null;
  };

  const getThumbnail = (video: VideoItem) => {
    if (video.thumbnail) return video.thumbnail;
    const id = getCleanId(video.url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : '';
  };

  const handleUrlChange = (url: string) => {
    setNewUrl(url);
    const id = getCleanId(url);
    if (id && !newPrompt) {
      setIsFetching(true);
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`)
        .then(r => r.json())
        .then(d => { if (d.title) setNewPrompt(d.title); })
        .catch(() => {})
        .finally(() => setIsFetching(false));
    }
  };

  const handleAddVideo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || !newCat) return;
    onAddVideo(newUrl, newPrompt || 'Untitled', newCat);
    setAddSuccess(true);
    setNewUrl('');
    setNewPrompt('');
    setTimeout(() => { setAddSuccess(false); setActiveTab('archive'); }, 1500);
  };

  const filteredVideos = videos.filter(v =>
    v.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoriteVideos = videos.filter(v => userFavorites.includes(v.id));

  const copyNodeId = () => {
    navigator.clipboard.writeText(nodeId);
    setNodeCopied(true);
    setTimeout(() => setNodeCopied(false), 2000);
  };

  const getCatColor = (cat: string) => categoryColors[cat] || '#94a3b8';

  return (
    <div className="w-full animate-fade-in mt-4">
      <div className="bg-[#0a0f1e]/95 backdrop-blur-2xl rounded-[2.5rem] border border-blue-500/20 shadow-[0_20px_80px_-15px_rgba(0,0,0,0.8)] overflow-hidden ring-1 ring-blue-500/10">

        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-r from-blue-600/10 via-transparent to-transparent flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <i className="fa-solid fa-user-astronaut text-blue-400 text-lg"></i>
            </div>
            <div>
              <h2 className="text-[14px] font-black text-white uppercase tracking-tight">
                {currentUser.replace(/_/g, ' ')}
              </h2>
              <button
                onClick={copyNodeId}
                className="flex items-center gap-1.5 mt-0.5 group"
              >
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest group-hover:text-blue-400 transition-colors font-mono">
                  {nodeId}
                </span>
                <i className={`fa-solid ${nodeCopied ? 'fa-check text-green-500' : 'fa-copy text-slate-700 group-hover:text-blue-400'} text-[8px] transition-colors`}></i>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{videos.length} videos</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-xl">
              <i className="fa-solid fa-heart text-red-400 text-[9px]"></i>
              <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">{userFavorites.length} saved</span>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10">
              <i className="fa-solid fa-xmark text-xs"></i>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {[
            { key: 'archive', label: 'Archive', icon: 'fa-film', count: videos.length },
            { key: 'favorites', label: 'Saved', icon: 'fa-heart', count: userFavorites.length },
            { key: 'add', label: 'Add Video', icon: 'fa-plus', count: null },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border ${
                activeTab === tab.key
                  ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                  : 'bg-transparent border-transparent text-slate-600 hover:text-slate-300'
              }`}
            >
              <i className={`fa-solid ${tab.icon} text-[10px]`}></i>
              {tab.label}
              {tab.count !== null && (
                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black ${activeTab === tab.key ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[500px] overflow-y-auto custom-scrollbar">

          {/* ARCHIVE TAB */}
          {activeTab === 'archive' && (
            <div className="space-y-4">
              <div className="relative">
                <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 text-[11px]"></i>
                <input
                  type="text"
                  placeholder="Search archive..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/30 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                {filteredVideos.length === 0 ? (
                  <div className="py-16 text-center opacity-30">
                    <i className="fa-solid fa-wind text-3xl text-slate-700 mb-4 block"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">No videos found</p>
                  </div>
                ) : filteredVideos.map(video => (
                  <div
                    key={video.id}
                    className="group flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:bg-white/5 hover:border-white/10 transition-all relative"
                  >
                    <div
                      className="w-20 h-12 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 cursor-pointer border border-white/5"
                      onClick={() => { onSelectVideo(video); onClose(); }}
                    >
                      <img src={getThumbnail(video)} className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" alt="" />
                    </div>

                    <div className="flex-1 overflow-hidden">
                      <p
                        className="text-[12px] font-bold text-slate-300 truncate cursor-pointer hover:text-white transition-colors"
                        onClick={() => { onSelectVideo(video); onClose(); }}
                      >
                        {video.prompt}
                      </p>
                      <span
                        className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border mt-1 inline-block"
                        style={{ color: getCatColor(video.category), borderColor: `${getCatColor(video.category)}40`, backgroundColor: `${getCatColor(video.category)}15` }}
                      >
                        {video.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onToggleFavorite(video.id)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          userFavorites.includes(video.id)
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-white/5 text-slate-500 hover:text-red-400 border border-white/5'
                        }`}
                      >
                        <i className={`fa-${userFavorites.includes(video.id) ? 'solid' : 'regular'} fa-heart text-[10px]`}></i>
                      </button>
                      {(isAuthorized) && (
                        <button
                          onClick={() => setConfirmDeleteId(video.id)}
                          className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 flex items-center justify-center transition-all"
                        >
                          <i className="fa-solid fa-trash-can text-[10px]"></i>
                        </button>
                      )}
                    </div>

                    {confirmDeleteId === video.id && (
                      <div
                        className="absolute inset-0 z-50 bg-black/95 rounded-2xl flex items-center justify-between px-5 border border-red-500/20 animate-fade-in"
                        onClick={e => e.stopPropagation()}
                      >
                        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Delete this video?</span>
                        <div className="flex gap-2">
                          <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1.5 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400 border border-white/10">Cancel</button>
                          <button
                            onClick={() => { onRemoveVideo(video.id); setConfirmDeleteId(null); }}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FAVORITES TAB */}
          {activeTab === 'favorites' && (
            <div className="space-y-1.5">
              {favoriteVideos.length === 0 ? (
                <div className="py-16 text-center opacity-30">
                  <i className="fa-solid fa-heart-crack text-3xl text-slate-700 mb-4 block"></i>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">No saved videos yet</p>
                  <p className="text-[8px] text-slate-700 uppercase tracking-widest mt-2">Click the heart icon on any video to save it</p>
                </div>
              ) : favoriteVideos.map(video => (
                <div
                  key={video.id}
                  className="group flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:bg-white/5 hover:border-white/10 transition-all"
                >
                  <div
                    className="w-20 h-12 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 cursor-pointer border border-white/5"
                    onClick={() => { onSelectVideo(video); onClose(); }}
                  >
                    <img src={getThumbnail(video)} className="w-full h-full object-cover opacity-70 hover:opacity-100 transition-opacity" alt="" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p
                      className="text-[12px] font-bold text-slate-300 truncate cursor-pointer hover:text-white transition-colors"
                      onClick={() => { onSelectVideo(video); onClose(); }}
                    >
                      {video.prompt}
                    </p>
                    <span
                      className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border mt-1 inline-block"
                      style={{ color: getCatColor(video.category), borderColor: `${getCatColor(video.category)}40`, backgroundColor: `${getCatColor(video.category)}15` }}
                    >
                      {video.category}
                    </span>
                  </div>
                  <button
                    onClick={() => onToggleFavorite(video.id)}
                    className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/30"
                  >
                    <i className="fa-solid fa-heart-crack text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ADD VIDEO TAB */}
          {activeTab === 'add' && (
            <div className="space-y-5">
              {addSuccess ? (
                <div className="py-12 flex flex-col items-center animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                    <i className="fa-solid fa-check text-green-400 text-xl"></i>
                  </div>
                  <p className="text-[11px] font-black text-white uppercase tracking-widest">Video Added!</p>
                  <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-2">Returning to archive...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-blue-600/5 border border-blue-500/20 rounded-2xl space-y-1">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Add YouTube or Online Video</p>
                    <p className="text-[8px] text-slate-600 uppercase tracking-widest">Paste a YouTube URL or video ID. Title is auto-fetched.</p>
                  </div>

                  <form onSubmit={handleAddVideo} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">YouTube URL or Video ID</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="https://youtube.com/watch?v=... or video ID"
                          value={newUrl}
                          onChange={e => handleUrlChange(e.target.value)}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 transition-all"
                        />
                        {isFetching && (
                          <i className="fa-solid fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 text-[11px]"></i>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Title (auto-filled or custom)</label>
                      <input
                        type="text"
                        placeholder="Video title..."
                        value={newPrompt}
                        onChange={e => setNewPrompt(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Category</label>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(cat => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setNewCat(cat)}
                            className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-wider border transition-all ${
                              newCat === cat ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:border-white/20'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!newUrl || !newCat}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all disabled:opacity-30"
                    >
                      <i className="fa-solid fa-plus mr-2"></i>
                      Add to Archive
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
