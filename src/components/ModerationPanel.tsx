import React, { useMemo, useState, useEffect } from 'react';
import { VideoItem, Review, VideoCategory } from '../types';
import { LIBRARY_VERSION } from '../services/sampleData';

interface ModerationPanelProps {
  videos: VideoItem[];
  categories: VideoCategory[];
  categoryColors: Record<string, string>;
  onApprove: (videoId: string, reviewId: string) => void;
  onReject: (videoId: string, reviewId: string) => void;
  onAddVideo: (url: string, prompt: string, category: VideoCategory) => void;
  onRemoveVideo: (id: string) => void;
  onResetStats?: () => void;
  onResetToSource?: () => void;
  onClearCategories?: () => void;
  onClose: () => void;
  onSimulateSync?: () => void;
  isCheckingSync: boolean;
  cloudVersion: number;
  onCheckVersion: () => void;
  onHardSync: () => void;
  currentUser: string;
  userFavMap: Record<string, string[]>;
}

interface PendingReview extends Review {
  videoTitle: string;
  videoId: string;
}

const ModerationPanel: React.FC<ModerationPanelProps> = ({ 
  videos, 
  categories,
  onApprove, 
  onReject, 
  onAddVideo,
  onRemoveVideo,
  onClose,
  isCheckingSync,
  cloudVersion,
  onHardSync,
  currentUser,
  userFavMap
}) => {
  const [activeTab, setActiveTab] = useState<'Queue' | 'Forge' | 'Developer'>('Queue');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [newUrl, setNewUrl] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newCat, setNewCat] = useState<VideoCategory>(categories[0] || 'Other');
  const [isFetching, setIsFetching] = useState(false);

  const pendingReviews = useMemo(() => {
    const list: PendingReview[] = [];
    videos.forEach(v => {
      (v.reviews || []).forEach(r => {
        if (!r.isApproved) {
          list.push({ ...r, videoTitle: v.prompt, videoId: v.id });
        }
      });
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [videos]);

  useEffect(() => {
    const getCleanId = (url: string) => {
      const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[1] && match[1].length === 11) ? match[1] : (url.length === 11 ? url : null);
    };

    const videoId = getCleanId(newUrl);
    if (videoId && !newPrompt) {
      setIsFetching(true);
      fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
        .then(res => res.json())
        .then(data => {
          if (data.title) setNewPrompt(data.title);
          setIsFetching(false);
        })
        .catch(() => setIsFetching(false));
    }
  }, [newUrl, newPrompt]);

  const generatedCode = useMemo(() => {
    const data = videos.map(v => ({
      id: v.id.startsWith('m-') ? `v-${Math.random().toString(36).substr(2, 5)}` : v.id,
      prompt: v.prompt,
      category: v.category,
      url: v.url,
      thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.url}/mqdefault.jpg`
    }));
    
    return `import { VideoItem, VideoCategory, Review } from '../types';

export const LIBRARY_VERSION = ${LIBRARY_VERSION};

/**
 * MASTER_IDENTITY: The last active identity during source generation.
 */
export const MASTER_IDENTITY = "${currentUser}";

/**
 * HARDCODED_FAVORITES: Captures ALL user vaults (including SHAWN and NEURAL_NODE_01)
 * This ensures favorites are permanent for specific identities across reloads.
 */
export const HARDCODED_FAVORITES: Record<string, string[]> = ${JSON.stringify(userFavMap, null, 2)};

const INITIAL_VIDEO_DATA: any[] = ${JSON.stringify(data, null, 2)};

export const getSampleLibrary = (): VideoItem[] => {
  return INITIAL_VIDEO_DATA.map((item, idx) => ({
    ...item,
    timestamp: Date.now() - (idx * 100000),
    status: 'ready',
    viewCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    rating: 0,
    isFavorite: false, 
    isLiked: false,
    isDisliked: false,
    reviews: []
  }));
};

export const getSurpriseVideo = (): VideoItem => {
  const pool = ['dQw4w9WgXcQ', 'CHSnz0DQw68', '5Wn4M_9-H9I', 'X_JBFLs3vAk', 'LXO-jKksQkM'];
  const id = pool[Math.floor(Math.random() * pool.length)];
  return {
    id: \`surprise-\${Date.now()}\`,
    prompt: "Neural Surprise Signal",
    category: 'Fav. Pick',
    url: id,
    timestamp: Date.now(),
    status: 'ready',
    viewCount: 0,
    likeCount: 0,
    dislikeCount: 0,
    rating: 0,
    isFavorite: false,
    isLiked: false,
    isDisliked: false,
    reviews: []
  };
};`;
  }, [videos, currentUser, userFavMap]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleTriggerHardSync = () => {
    setIsSyncing(true);
    onHardSync();
  };

  return (
    <div className="w-full animate-fade-in mt-4">
      <div className="bg-[#0f172a]/95 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col ring-1 ring-white/5 max-h-[750px]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-r from-blue-500/10 to-transparent">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600/20 border border-blue-500/40 text-blue-400">
              <i className="fa-solid fa-terminal text-lg"></i>
            </div>
            <div>
              <h2 className="text-[12px] font-black text-white uppercase tracking-tighter">Terminal Console</h2>
              <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">Neural Management Interface</p>
            </div>
          </div>
          
          <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
            <button onClick={() => setActiveTab('Queue')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Queue' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}>Queue ({pendingReviews.length})</button>
            <button onClick={() => setActiveTab('Forge')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Forge' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Forge</button>
            <button onClick={() => setActiveTab('Developer')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Developer' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Source Sync</button>
          </div>

          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10">
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'Queue' ? (
            <div className="grid gap-3">
              {pendingReviews.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center opacity-40">
                  <i className="fa-solid fa-check-double text-3xl mb-4 text-slate-700"></i>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Queue Purged</h3>
                </div>
              ) : (
                pendingReviews.map((review) => (
                  <div key={review.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-black text-purple-400 uppercase tracking-widest">USER::{review.user}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 italic truncate">"{review.text}"</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => onReject(review.videoId, review.id)} className="px-3 py-1.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-[8px] font-black uppercase">Reject</button>
                      <button onClick={() => onApprove(review.videoId, review.id)} className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[8px] font-black uppercase">Approve</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : activeTab === 'Forge' ? (
            <div className="space-y-6 animate-fade-in">
              <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/20">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">Signal Injection</h3>
                <form onSubmit={(e) => { e.preventDefault(); onAddVideo(newUrl, newPrompt, newCat); setNewUrl(''); setNewPrompt(''); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="relative">
                    <input type="text" placeholder="YouTube URL..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] text-white focus:outline-none" />
                    {isFetching && <i className="fa-solid fa-spinner fa-spin absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 text-[10px]"></i>}
                  </div>
                  <input type="text" placeholder="Title..." value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] text-white focus:outline-none" />
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[10px] text-white focus:outline-none">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg">Inject Signal</button>
                </form>
              </div>
              <div className="space-y-2">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-4 flex justify-between">Signal Matrix <span className="text-blue-500">{videos.length} Active</span></h3>
                <div className="grid gap-2">
                  {videos.map(v => (
                    <div key={v.id} className="p-3 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between group">
                      <div className="flex items-center gap-3 overflow-hidden text-ellipsis">
                        <div className="w-10 h-6 rounded bg-slate-900 overflow-hidden shrink-0"><img src={`https://img.youtube.com/vi/${v.url}/mqdefault.jpg`} className="w-full h-full object-cover opacity-50" /></div>
                        <div className="truncate"><p className="text-[10px] font-black text-slate-400 truncate">{v.prompt}</p></div>
                      </div>
                      <button onClick={() => onRemoveVideo(v.id)} className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in pb-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="p-6 rounded-3xl bg-blue-600/5 border border-blue-500/20 flex flex-col justify-between">
                    <div>
                      <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-1 flex items-center gap-2"><i className="fa-solid fa-cloud-arrow-down text-blue-500"></i>PULL: Restore Source</h4>
                      <p className="text-[8px] text-slate-500 uppercase font-bold mb-6">Wipe Local Changes & Reload</p>
                      <p className="text-[9px] text-slate-400 leading-relaxed uppercase font-bold mb-6">Reset everything back to the hardcoded `sampleData.ts`. Use this if you pushed new code to GitHub.</p>
                    </div>
                    <button 
                      onClick={handleTriggerHardSync} 
                      disabled={isSyncing}
                      className={`w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-3 ${isSyncing ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isSyncing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-down"></i>}
                      {isSyncing ? 'Synchronizing...' : 'Sync with GitHub'}
                    </button>
                 </div>
                 
                 <div className="p-6 rounded-3xl bg-purple-600/5 border border-purple-500/20 flex flex-col">
                    <h4 className="text-[11px] font-black text-white uppercase tracking-widest mb-1 flex items-center gap-2"><i className="fa-solid fa-cloud-arrow-up text-purple-500"></i>PUSH: Commit Favorites</h4>
                    <p className="text-[8px] text-slate-500 uppercase font-bold mb-6">Make Personas Permanent</p>
                    <div className="space-y-4 text-[9px] text-slate-400 font-bold uppercase leading-tight">
                       <div className="flex gap-3 items-start"><span className="w-5 h-5 shrink-0 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500 font-black">1</span><span>The snapshot below includes all vaults for: <b>{Object.keys(userFavMap).join(', ')}</b></span></div>
                       <div className="flex gap-3 items-start"><span className="w-5 h-5 shrink-0 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500 font-black">2</span><span>Open <span className="text-purple-400">sampleData.ts</span> on your machine</span></div>
                       <div className="flex gap-3 items-start"><span className="w-5 h-5 shrink-0 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500 font-black">3</span><span>Replace all content with code below</span></div>
                       <div className="flex gap-3 items-start"><span className="w-5 h-5 shrink-0 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-500 font-black">4</span><span>Push to GitHub to lock in SHAWN's vault</span></div>
                    </div>
                 </div>
              </div>

              <div className="p-6 rounded-3xl bg-slate-950 border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Master Data Commit</h4>
                  <button onClick={handleCopyCode} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${copySuccess ? 'bg-green-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                    {copySuccess ? 'Copied to Clipboard!' : 'Copy Code'}
                  </button>
                </div>
                <pre className="p-6 overflow-x-auto text-[10px] text-blue-400 font-mono bg-black/50 rounded-2xl max-h-[300px] border border-white/5 shadow-inner"><code>{generatedCode}</code></pre>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest border-b border-white/5 pb-2 text-slate-500">Local Matrix: v{LIBRARY_VERSION}</div>
                 <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest border-b border-white/5 pb-2 text-emerald-400">Cloud Node: v{cloudVersion}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModerationPanel;