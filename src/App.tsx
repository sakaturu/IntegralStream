import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoItem, VideoCategory } from './types';
import VideoPlayer from './components/VideoPlayer';
import Playlist from './Playlist';
import LoginGate from './components/LoginGate';
import VaultGallery from './components/VaultGallery';
import FloatingReviewHub from './components/FloatingReviewHub';
import ModerationPanel from './components/ModerationPanel';
import UserDashboard from './components/UserDashboard';
import { getSampleLibrary, getSurpriseVideo, LIBRARY_VERSION, MASTER_IDENTITY, HARDCODED_FAVORITES } from './services/sampleData';
import { saveUserData, loadUserData, saveLibrary, loadLibrary, subscribeToLibrary } from './services/firebase';


const DATA_KEY = `integral_vault_v${LIBRARY_VERSION}`;
const VERSION_KEY = `integral_version_v${LIBRARY_VERSION}`;
const AUTH_KEY = 'integral_v411_auth';
const CAT_KEY = `integral_categories_v${LIBRARY_VERSION}`;
const CAT_COLORS_KEY = `integral_cat_colors_v${LIBRARY_VERSION}`;
const USER_KEY = 'integral_active_user_v6'; 
const USER_LOCKED_KEY = 'integral_user_locked_v6';
const USER_NODE_ID_KEY = 'integral_user_node_id';
const FAV_MAP_KEY = 'integral_user_fav_map_v2';
const ADMIN_PASSWORD = 'ADMIN';

const generateNodeId = () => {
  const parts = [
    'INT',
    Math.random().toString(36).substring(2, 6).toUpperCase(),
    Math.floor(Math.random() * 90 + 10)
  ];
  return parts.join('-');
};

const DEFAULT_CATEGORIES: VideoCategory[] = [
  'Meditation', 
  'Tribal', 
  'Dance', 
  'Integral Serenity', 
  'Permia Community', 
  'Spanish', 
  'Fav. Pick', 
  'Environment',
  'Other'
];

const DEFAULT_CAT_COLORS: Record<string, string> = {
  'Meditation': '#10b981', 
  'Tribal': '#f97316',     
  'Dance': '#d946ef',     
  'Integral Serenity': '#3b82f6', 
  'Permia Community': '#fbbf24', 
  'Spanish': '#8b5cf6',   
  'Fav. Pick': '#ec4899', 
  'Environment': '#22c55e', 
  'Other': '#94a3b8'
};

const IntegralLogo = ({ className = "w-10 h-10" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={`${className} transition-transform duration-1000 ease-in-out`}>
    <path d="M35 52 C20 45 10 30 10 15 C25 15 40 25 45 40 Z" fill="#e11d48" transform="rotate(-10, 50, 50)" />
    <path d="M50 5 C58 20 58 40 50 52 C42 40 42 20 50 5Z" fill="#0284c7" />
    <path d="M65 52 C80 45 90 30 90 15 C75 15 60 25 55 40 Z" fill="#f59e0b" transform="rotate(10, 50, 50)" />
    <path d="M15 55 C15 85 40 95 50 95" fill="none" stroke="#0ea5e9" strokeWidth="9" strokeLinecap="round" />
    <path d="M85 55 C85 85 60 95 50 95" fill="none" stroke="#64748b" strokeWidth="9" strokeLinecap="round" />
    <circle cx="50" cy="78" r="12" fill="#64748b" />
  </svg>
);

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_KEY) === 'true';
  });
  
  const [profilePic, setProfilePic] = useState<string>(() => localStorage.getItem('integral_profile_pic') || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>(() => {
    return localStorage.getItem(USER_KEY) || MASTER_IDENTITY;
  });
  
  const [isUserLocked, setIsUserLocked] = useState<boolean>(() => {
    return localStorage.getItem(USER_LOCKED_KEY) === 'true';
  });

  const [nodeId, setNodeId] = useState<string>(() => {
    const existing = localStorage.getItem(USER_NODE_ID_KEY);
    if (existing) return existing;
    const newId = generateNodeId();
    localStorage.setItem(USER_NODE_ID_KEY, newId);
    return newId;
  });

  const [userFavMap, setUserFavMap] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem(FAV_MAP_KEY);
    const localMap = saved ? JSON.parse(saved) : {};
    const mergedMap = { ...HARDCODED_FAVORITES, ...localMap };
    return mergedMap;
  });

  const [showLoginOverlay, setShowLoginOverlay] = useState(() => !localStorage.getItem(USER_KEY));
  const [activeSecondaryView, setActiveSecondaryView] = useState<'none' | 'reviews' | 'vault' | 'moderation' | 'userDashboard'>('none');
  const [reviewInitialTab, setReviewInitialTab] = useState<'Read' | 'Write'>('Read');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlistTab, setPlaylistTab] = useState<VideoCategory | 'All' | 'Vault'>('All');
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [cloudVersion, setCloudVersion] = useState<number>(LIBRARY_VERSION);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const checkSyncLock = useRef(false);
  const firebaseSaveTimer = useRef<number | null>(null);



  // On mount: always load from Firebase as source of truth
  useEffect(() => {
    loadLibrary().then(data => {
      if (data && data.videos && data.videos.length > 0) {
        setVideos(data.videos);
        if (data.categories) setCategories(data.categories);
        if (data.categoryColors) setCategoryColors(data.categoryColors);
      }
      setIsLoaded(true);
    }).catch(() => { setIsLoaded(true); });
    const unsub = subscribeToLibrary(() => {});
    if (currentUser && currentUser !== MASTER_IDENTITY) {
      loadUserData(currentUser).then(data => {
        if (data && data.favorites) {
          setUserFavMap(prev => ({ ...prev, [currentUser]: data.favorites }));
        }
      }).catch(() => {});
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profilePic) localStorage.setItem('integral_profile_pic', profilePic);
  }, [profilePic]);

  useEffect(() => {
    localStorage.setItem(USER_KEY, currentUser);
    localStorage.setItem(USER_LOCKED_KEY, isUserLocked ? 'true' : 'false');
    localStorage.setItem(USER_NODE_ID_KEY, nodeId);
  }, [currentUser, isUserLocked, nodeId]);

  useEffect(() => {
    localStorage.setItem(FAV_MAP_KEY, JSON.stringify(userFavMap));
    // Save each user's favorites to Firebase
    Object.entries(userFavMap).forEach(([username, favorites]) => {
      if (username && username !== MASTER_IDENTITY) {
        saveUserData(username, { favorites, username, lastSeen: Date.now() });
      }
    });
  }, [userFavMap]);

  const handleIdentify = (name: string, remember: boolean) => {
    const cleanName = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (cleanName) {
      setCurrentUser(cleanName);
      setIsUserLocked(true);
      if (remember) {
        localStorage.setItem(USER_KEY, cleanName);
        localStorage.setItem(USER_LOCKED_KEY, 'true');
      }
      // Load user data from Firebase
      loadUserData(cleanName).then(data => {
        if (data?.favorites) {
          setUserFavMap(prev => ({ ...prev, [cleanName]: data.favorites }));
        }
        // Save this login to Firebase
        saveUserData(cleanName, { username: cleanName, lastSeen: Date.now() });
      });
      setShowLoginOverlay(false);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(MASTER_IDENTITY);
    setIsUserLocked(false);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(USER_LOCKED_KEY);
    setActiveSecondaryView('none');
    setShowLoginOverlay(true);
  };

  const handleRestoreNode = (key: string) => {
    if (key.startsWith('INT-')) {
      setNodeId(key);
      setIsUserLocked(true);
      setShowLoginOverlay(false);
      return true;
    }
    return false;
  };

  const handleAdminLogin = (pass: string, remember: boolean) => {
    if (pass === ADMIN_PASSWORD) {
      setIsAuthorized(true);
      if (remember) localStorage.setItem(AUTH_KEY, 'true');
      setShowLoginOverlay(false);
      return true;
    }
    return false;
  };

  const triggerReload = useCallback(() => { window.location.reload(); }, []);
  const triggerSyncSequence = useCallback(() => { setIsSyncingLive(true); setTimeout(triggerReload, 1500); }, [triggerReload]);
  const handleHardSyncSource = useCallback(() => { 
    setIsSyncingLive(true); 
    localStorage.removeItem(DATA_KEY); 
    localStorage.removeItem(CAT_KEY); 
    localStorage.removeItem(CAT_COLORS_KEY); 
    localStorage.removeItem(VERSION_KEY); 
    localStorage.removeItem(FAV_MAP_KEY); 
    setTimeout(triggerReload, 2000); 
  }, [triggerReload]);

  const checkVersion = useCallback(async (manual = false) => {
    if (checkSyncLock.current) return;
    checkSyncLock.current = true;
    setIsCheckingSync(true);
    try {
      const response = await fetch(`./index.html?cb=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const metaVersionStr = doc.querySelector('meta[name="version"]')?.getAttribute('content');
        if (metaVersionStr) {
          const metaVersion = parseInt(metaVersionStr, 10);
          setCloudVersion(metaVersion);
          if (metaVersion > LIBRARY_VERSION) triggerSyncSequence();
        }
      }
    } catch (e) {} finally {
      setIsCheckingSync(false);
      checkSyncLock.current = false;
    }
  }, [triggerSyncSequence]);

  useEffect(() => {
    checkVersion(false);
    const interval = setInterval(() => checkVersion(false), 60000);
    return () => clearInterval(interval);
  }, [checkVersion]);

  const [categories, setCategories] = useState<VideoCategory[]>(() => {
    const saved = localStorage.getItem(CAT_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [categoryColors, setCategoryColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem(CAT_COLORS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_CAT_COLORS;
  });

  const [videos, setVideos] = useState<VideoItem[]>(() => {
    const currentSource = getSampleLibrary();
    const currentSourceMap = new Map(currentSource.map(v => [v.url, v]));
    const savedDataStr = localStorage.getItem(DATA_KEY);
    const savedVersion = localStorage.getItem(VERSION_KEY);
    const isOldVersion = !savedVersion || parseInt(savedVersion, 10) < LIBRARY_VERSION;

    if (!savedDataStr || isOldVersion) return currentSource;
    
    try {
      const baseData: VideoItem[] = JSON.parse(savedDataStr);
      const syncedData = baseData.map(lv => {
        const sv = currentSourceMap.get(lv.url);
        if (sv) return { ...sv, id: lv.id, viewCount: lv.viewCount, likeCount: lv.likeCount, dislikeCount: lv.dislikeCount, reviews: lv.reviews || [] };
        return lv;
      });
      const localUrls = new Set(syncedData.map(v => v.url));
      const newItems = currentSource.filter(v => !localUrls.has(v.url));
      return [...newItems, ...syncedData];
    } catch (e) { return currentSource; }
  });

  const [currentVideoId, setCurrentVideoId] = useState<string | undefined>(videos[0]?.id);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(DATA_KEY, JSON.stringify(videos));
    localStorage.setItem(VERSION_KEY, LIBRARY_VERSION.toString());
    localStorage.setItem(AUTH_KEY, isAuthorized ? 'true' : 'false');
    localStorage.setItem(CAT_KEY, JSON.stringify(categories));
    localStorage.setItem(CAT_COLORS_KEY, JSON.stringify(categoryColors));
    // Also persist to Firebase
    saveLibrary({
      videos,
      categories,
      categoryColors,
      version: LIBRARY_VERSION,
    }).catch(() => {});
  }, [videos, isAuthorized, categories, categoryColors, isLoaded]);

  const currentUserFavorites = useMemo(() => userFavMap[currentUser] || [], [userFavMap, currentUser]);
  const vaultCount = useMemo(() => currentUserFavorites.length, [currentUserFavorites]);

  const pendingReviewsCount = useMemo(() => {
    return videos.reduce((acc, video) => {
      return acc + (video.reviews?.filter(r => !r.isApproved).length || 0);
    }, 0);
  }, [videos]);

  const handleRemoveVideo = useCallback((id: string) => {
    setVideos(prev => {
      const filtered = prev.filter(v => v.id !== id);
      if (currentVideoId === id) {
        setIsPlaying(false);
        setCurrentVideoId(filtered.length > 0 ? filtered[0].id : undefined);
      }
      // Save to Firebase immediately so it persists on refresh
      saveLibrary({ videos: filtered, categories, categoryColors, version: LIBRARY_VERSION }).catch(() => {});
      return filtered;
    });
    setUserFavMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(u => { next[u] = (next[u] || []).filter(fid => fid !== id); });
      return next;
    });
    setActiveSecondaryView(prev => prev === 'vault' ? 'none' : prev);
  }, [currentVideoId, categories, categoryColors]);

  const handleManualAdd = useCallback((u: string, p: string, c: VideoCategory) => {
    const nv: VideoItem = { id: `m-${Date.now()}`, url: u, prompt: p, category: c, isFavorite: false, viewCount: 0, likeCount: 0, dislikeCount: 0, status: 'ready', timestamp: Date.now(), rating: 0, isLiked: false, isDisliked: false, reviews: [] };
    setVideos(prev => [nv, ...prev]);
    if (!currentVideoId) setCurrentVideoId(nv.id);
  }, [currentVideoId]);

  const handlePurgeAll = useCallback(() => { 
    setVideos([]); setCurrentVideoId(undefined); setIsPlaying(false); setActiveSecondaryView('none'); 
    setUserFavMap(prev => ({ ...prev, [currentUser]: [] })); 
  }, [currentUser]);

  const handleToggleFavorite = useCallback((id: string) => {
    setUserFavMap(prev => {
      const userFavs = prev[currentUser] || [];
      const isAlreadyFav = userFavs.includes(id);
      const updatedFavs = isAlreadyFav 
        ? userFavs.filter(fid => fid !== id) 
        : [...userFavs, id];
      // Sync this user's favorites to Firebase immediately
      updateUserFavorites(currentUser, updatedFavs).catch(() => {});
      return { 
        ...prev, 
        [currentUser]: updatedFavs 
      };
    });
  }, [currentUser]);

  const handleToggleLike = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, isLiked: !v.isLiked, likeCount: v.isLiked ? v.likeCount - 1 : v.likeCount + 1, isDisliked: v.isLiked ? v.isDisliked : false, dislikeCount: (v.isLiked || !v.isDisliked) ? v.dislikeCount : v.dislikeCount - 1 } : v)); }, []);
  const handleToggleDislike = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, isDisliked: !v.isDisliked, dislikeCount: v.isDisliked ? v.dislikeCount - 1 : v.dislikeCount + 1, isLiked: v.isDisliked ? v.isLiked : false, likeCount: (v.isDisliked || !v.isLiked) ? v.likeCount : v.likeCount - 1 } : v)); }, []);
  const handleIncrementView = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, viewCount: v.viewCount + 1 } : v)); }, []);
  const handleSelectVideo = useCallback((v: VideoItem) => { if (currentVideoId === v.id) { setIsPlaying(prev => !prev); } else { setCurrentVideoId(v.id); setIsPlaying(true); } }, [currentVideoId]);

  const handleAddCategory = (name: string, color?: string) => { if (!categories.includes(name)) { setCategories(prev => [...prev, name]); setCategoryColors(prev => ({ ...prev, [name]: color || '#94a3b8' })); } };
  const handleRemoveCategory = (name: string) => { setCategories(prev => prev.filter(c => c !== name)); if (playlistTab === name) setPlaylistTab('All'); };
  
  const currentVideo = useMemo(() => videos.find(v => v.id === currentVideoId) || null, [videos, currentVideoId]);

  return (
    <div className="h-screen bg-transparent text-slate-100 flex flex-col font-sans relative selection:bg-blue-500/30 overflow-hidden">
      {/* Background Watermark Logo */}
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] opacity-[0.03] pointer-events-none z-0 rotate-12 select-none">
        <IntegralLogo className="w-full h-full" />
      </div>

      {isSyncingLive && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center animate-fade-in backdrop-blur-3xl">
           <div className="relative">
             <div className="w-24 h-24 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
               <i className="fa-brands fa-github text-blue-500 text-3xl animate-pulse"></i>
             </div>
           </div>
           <div className="flex flex-col items-center mt-10">
             <h2 className="text-xl font-black uppercase tracking-[0.5em] text-white">Neural Sync</h2>
             <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest mt-4 max-w-xs text-center leading-relaxed">Adjusting local matrix to source...</p>
           </div>
        </div>
      )}

      <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveSecondaryView('none')}>
          <IntegralLogo />
          <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none text-blue-600">IntegralStream</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Personalized Archive</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4 items-center">
          {/* User Identity Button — click to open dashboard or login */}
          <div className="flex items-center gap-2 relative group">
            <button
              onClick={() => isUserLocked ? setActiveSecondaryView(v => v === 'userDashboard' ? 'none' : 'userDashboard') : setShowLoginOverlay(true)}
              className={`px-4 h-11 rounded-xl border flex items-center gap-3 transition-all cursor-pointer ${
                activeSecondaryView === 'userDashboard'
                  ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                  : 'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20'
              }`}
            >
              <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-widest opacity-60">
                  {isUserLocked ? 'My Archive' : 'Identify'}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest">{currentUser.replace(/_/g, ' ')}</span>
              </div>
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-blue-500/40 flex-shrink-0">
                {profilePic ? (
                  <img src={profilePic} className="w-full h-full object-cover" alt="profile" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-blue-600/20">
                    <i className="fa-solid fa-user-astronaut text-[11px] text-blue-400"></i>
                  </div>
                )}
                <label className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 bg-black/50 flex items-center justify-center transition-opacity">
                  <i className="fa-solid fa-camera text-white text-[10px]"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setProfilePic(ev.target?.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} />
                </label>
              </div>
            </button>
            {isUserLocked && (
              <button
                onClick={handleLogout}
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
                title="Sign out"
              >
                <i className="fa-solid fa-arrow-right-from-bracket text-[11px]"></i>
              </button>
            )}
          </div>

          {isAuthorized && (
            <button 
              onClick={() => setActiveSecondaryView(v => v === 'moderation' ? 'none' : 'moderation')}
              className={`h-11 px-4 rounded-xl flex items-center gap-2 border transition-all relative font-black text-[10px] tracking-widest uppercase ${activeSecondaryView === 'moderation' ? 'bg-white text-black shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}
            >
              <i className="fa-solid fa-terminal text-base"></i>
              <span>Console</span>
              {pendingReviewsCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-black shadow-lg">{pendingReviewsCount}</span>}
            </button>
          )}

          <button 
            onClick={() => isAuthorized ? setIsAuthorized(false) : setShowLoginOverlay(true)} 
            className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${isAuthorized ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}
          >
            <i className={`fa-solid ${isAuthorized ? 'fa-unlock' : 'fa-lock'}`}></i>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <aside className="w-[490px] flex-shrink-0 min-w-0 border-r border-white/5 bg-black/20 overflow-y-auto custom-scrollbar">
          <Playlist videos={videos} categories={categories} categoryColors={categoryColors} currentVideo={currentVideo} onSelect={handleSelectVideo} onRemove={handleRemoveVideo} onToggleFavorite={handleToggleFavorite} userFavorites={currentUserFavorites} onAddRandom={() => { const v = getSurpriseVideo(); setVideos(p => [v, ...p]); setCurrentVideoId(v.id); }} onAddManualVideo={handleManualAdd} onMoveVideo={() => {}} onPurgeAll={handlePurgeAll} activeTab={playlistTab} setActiveTab={setPlaylistTab} isAuthorized={isAuthorized} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory} onUpdateCategoryColor={() => {}} />
        </aside>

        <section className="flex-1 flex flex-col bg-transparent overflow-y-auto min-w-0 custom-scrollbar">
          <div className="w-full flex flex-col pt-8 gap-0">
            <div className="flex items-center justify-between px-8 mb-6">
              <h2 className="text-blue-600 font-black uppercase text-[10px] tracking-[0.4em] flex items-center gap-3"><span className="w-1 h-4 bg-blue-600 rounded-full"></span>{currentVideo ? "Current Video Stream" : "Select Video"}</h2>
            </div>
            <div className="px-8 w-full" ref={playerContainerRef}>
               <div className="w-full max-h-[calc(100vh-240px)] aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative mx-auto">
                {currentVideo ? (
                  <VideoPlayer key={currentVideo.id} video={currentVideo} isFavorite={currentUserFavorites.includes(currentVideo.id)} isPlaying={isPlaying} onPlayStateChange={setIsPlaying} onToggleLike={() => handleToggleLike(currentVideo.id)} onToggleDislike={() => handleToggleDislike(currentVideo.id)} onToggleFavorite={() => handleToggleFavorite(currentVideo.id)} onWriteReview={() => { setReviewInitialTab('Write'); setActiveSecondaryView('reviews'); }} />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 uppercase font-black text-xs gap-4 bg-slate-950"><i className="fa-solid fa-cloud fa-3x animate-pulse text-slate-900"></i> Select Video</div>
                )}
              </div>
            </div>
            {currentVideo && (
              <div className="w-full animate-fade-in mt-6 px-8">
                <div className="bg-white/5 border border-white/5 rounded-3xl flex flex-wrap items-center justify-between px-8 py-4 w-full gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="px-3 py-1 border text-[10px] font-black uppercase rounded-full tracking-widest shrink-0" style={{ color: categoryColors[currentVideo.category], borderColor: `${categoryColors[currentVideo.category]}60`, background: `${categoryColors[currentVideo.category]}20` }}>{currentVideo.category}</span>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Views::</span><span className="text-[13px] font-black text-white">{currentVideo.viewCount.toLocaleString()}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Likes::</span><span className="text-[13px] font-black text-white">{currentVideo.likeCount.toLocaleString()}</span></div>
                      <button onClick={() => { setReviewInitialTab('Read'); setActiveSecondaryView('reviews'); }} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-message text-[11px]"></i><span>Reviews::</span><span className="text-[13px] font-black text-white ml-0.5">{(currentVideo.reviews?.length || 0).toLocaleString()}</span></button>
                      <button onClick={() => setActiveSecondaryView(v => v === 'vault' ? 'none' : 'vault')} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-vault text-[11px]"></i><span>{currentUser.replace(/_/g, ' ')}'S VAULT::</span><span className="text-[13px] font-black text-white ml-0.5">{vaultCount.toLocaleString()}</span></button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="px-8 w-full mt-4 pb-20">
              {activeSecondaryView === 'moderation' && (
                <ModerationPanel videos={videos} categories={categories} categoryColors={categoryColors} onApprove={(vidId, revId) => setVideos(p => p.map(v => v.id === vidId ? {...v, reviews: v.reviews?.map(r => r.id === revId ? {...r, isApproved: true} : r)} : v))} onReject={(vidId, revId) => setVideos(p => p.map(v => v.id === vidId ? {...v, reviews: v.reviews?.filter(r => r.id !== revId)} : v))} onAddVideo={handleManualAdd} onRemoveVideo={handleRemoveVideo} onResetStats={() => {}} onClearCategories={() => {}} onClose={() => setActiveSecondaryView('none')} onSimulateSync={triggerSyncSequence} isCheckingSync={isCheckingSync} cloudVersion={cloudVersion} onCheckVersion={() => checkVersion(true)} onHardSync={handleHardSyncSource} currentUser={currentUser} userFavMap={userFavMap} />
              )}
              {activeSecondaryView === 'vault' && (
                <VaultGallery videos={videos.filter(v => currentUserFavorites.includes(v.id))} categoryColors={categoryColors} currentVideo={currentVideo!} onSelect={(v) => { setCurrentVideoId(v.id); setActiveSecondaryView('none'); }} onRemove={handleRemoveVideo} onToggleFavorite={handleToggleFavorite} isOpen={true} onClose={() => setActiveSecondaryView('none')} isAuthorized={isAuthorized} onMoveVideo={() => {}} currentUser={currentUser} />
              )}
              {activeSecondaryView === 'reviews' && currentVideo && (
                <FloatingReviewHub video={currentVideo} isOpen={true} initialTab={reviewInitialTab} onClose={() => setActiveSecondaryView('none')} onSubmitReview={(r, t) => { const review = { id: `r-${Date.now()}`, rating: r, text: t, user: currentUser, timestamp: Date.now(), isApproved: false }; setVideos(prev => prev.map(v => v.id === currentVideo.id ? { ...v, reviews: [review, ...(v.reviews || [])] } : v)); }} />
              )}
              {activeSecondaryView === 'userDashboard' && (
                <UserDashboard
                  currentUser={currentUser}
                  nodeId={nodeId}
                  videos={videos}
                  categories={categories}
                  categoryColors={categoryColors}
                  userFavorites={currentUserFavorites}
                  onAddVideo={handleManualAdd}
                  onRemoveVideo={handleRemoveVideo}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectVideo={(v) => { setCurrentVideoId(v.id); setIsPlaying(true); setActiveSecondaryView('none'); }}
                  onClose={() => setActiveSecondaryView('none')}
                  isAuthorized={isAuthorized}
                />
              )}
            </div>
          </div>
        </section>
      </div>

      {showLoginOverlay && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-3xl">
          <LoginGate 
            onLogin={handleAdminLogin} 
            onIdentify={handleIdentify}
            onRestore={handleRestoreNode} 
            isIdentityLocked={isUserLocked}
            onClose={() => isUserLocked && setShowLoginOverlay(false)} 
            defaultName={currentUser !== MASTER_IDENTITY ? currentUser : ''}
            profilePic={profilePic}
            onProfilePicChange={setProfilePic}
          />
        </div>
      )}
    </div>
  );
};

export default App;