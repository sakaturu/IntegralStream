import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoItem, VideoCategory } from './types';
import VideoPlayer from './components/VideoPlayer';
import Playlist from './Playlist';
import LoginGate from './components/LoginGate';
import VaultGallery from './components/VaultGallery';
import FloatingReviewHub from './components/FloatingReviewHub';
import ModerationPanel from './components/ModerationPanel';
import { getSampleLibrary, getSurpriseVideo, LIBRARY_VERSION, MASTER_IDENTITY, HARDCODED_FAVORITES } from './services/sampleData';
import {
  loadVideosFromFirestore, saveVideosToFirestore, subscribeToVideos,
  loadMusicFromFirestore, saveMusicToFirestore, subscribeToMusic,
  loadMusicReviewsFromFirestore, saveMusicReviewsToFirestore,
} from './services/firebase';


const DEFAULT_MUSIC_GENRES = ['Affirmations', 'Celestial Meditation', 'Classical', 'Country', 'Dance', 'Drum-N-Bass', 'Electronic', 'Enviro-Nature', 'FAV', 'Guided Meditation', 'Hip-Hop', 'Inspirational', 'Integral Serenity', 'Jazz', 'Lounge', 'Multi-Lang', 'Odd', 'Other', 'Pop', 'Rock', 'Silent Meditation', 'Spanish', 'Spiritual'];
const GENRES_VERSION = 'v3';
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
  ['#0284c7','#0369a1','#1d4ed8','#4f46e5','#7c3aed','#9333ea','#be185d','#e11d48','#b91c1c','#c2410c','#b45309','#4d7c0f'],
];

interface MusicTrack {
  id:string; artist:string; title:string; url:string; thumbnail?:string;
  category:string; addedBy:string; timestamp:number; playCount:number; likeCount:number;
  isFavorite?:boolean; galleryImages?:string[];
}
interface MusicReview {
  id:string; trackId:string; user:string; rating:number; comment:string;
  timestamp:number; approved:boolean;
}
interface MusicAppProps {
  currentUser:string; isAuthorized:boolean; onClose:()=>void;
  nodeId?:string; isUserLocked?:boolean;
  pendingReviewsCount?:number; onLogout?:()=>void; onAdminClick?:()=>void;
  showUserPlaylist?:boolean; onToggleUserPlaylist?:()=>void; onOpenUserPlaylist?:()=>void;
  onPendingReview?:()=>void;
  onUserChange?:(user:string, locked:boolean)=>void;
}

// ─── Shared auth constants (must match APP.tsx) ─────────────────────────────
const AUTH_KEY       = 'integral_v411_auth';
const ADMIN_PASSWORD = 'ADMIN';
const USER_KEY       = 'integral_active_user_v6';
const USER_LOCKED_KEY= 'integral_user_locked_v6';
const USER_NODE_ID_KEY = 'integral_user_node_id';
const FAV_MAP_KEY = 'integral_user_fav_map_v2';
const PROFILE_PIC_KEY = 'integral_profile_pics_v1'; // {username: base64dataUrl}

// ─── Profile pic helpers ─────────────────────────────────────────────────────
const getPicMap  = (): Record<string,string> => { try { return JSON.parse(localStorage.getItem(PROFILE_PIC_KEY)||'{}'); } catch { return {}; } };
const savePicMap = (m: Record<string,string>) => { try { localStorage.setItem(PROFILE_PIC_KEY, JSON.stringify(m)); } catch {} };
const getUserPic = (username: string): string => getPicMap()[username] || '';
const setUserPic = (username: string, pic: string) => { const m = getPicMap(); m[username] = pic; savePicMap(m); };
const ADMIN_USER = 'ADMIN';

const getMusicKey  = (u:string) => `integral_music_${u}_v1`;

// ─── User Playlist types ─────────────────────────────────────────────────────
interface UserPlaylist {
  id: string;
  name: string;
  owner: string;
  videoIds: string[];
  trackIds: string[];
  createdAt: number;
}
const USER_PLAYLISTS_KEY = 'integral_user_playlists_v1';
const getPlaylists = (): UserPlaylist[] => { try { return JSON.parse(localStorage.getItem(USER_PLAYLISTS_KEY)||'[]'); } catch { return []; } };
const savePlaylists = (p: UserPlaylist[]) => { try { localStorage.setItem(USER_PLAYLISTS_KEY, JSON.stringify(p)); } catch {} };
const getSharedKey = () => `integral_music_shared_v1`;

// ── Generate a stylish canvas thumbnail from track metadata ──────────────────
const TrackThumbnail = ({artist,title,category,thumbnail='',className='',style={}}:{artist:string;title:string;category:string;thumbnail?:string;className?:string;style?:React.CSSProperties}) => {
  const palettes: Record<string,[string,string]> = {
    'Electronic':['#7c3aed','#06b6d4'],'Hip-Hop':['#f59e0b','#ef4444'],
    'Rock':['#ef4444','#dc2626'],'Jazz':['#0891b2','#6366f1'],
    'Classical':['#d4a574','#b8860b'],'Pop':['#ec4899','#a855f7'],
    'R&B':['#8b5cf6','#ec4899'],'Metal':['#4b5563','#ef4444'],
    'Folk':['#65a30d','#84cc16'],'Ambient':['#0e7490','#6366f1'],
    'Dance':['#f97316','#ec4899'],'Country':['#d97706','#a16207'],
  };
  const [c1,c2] = palettes[category]??['#a855f7','#6366f1'];
  const [imgFailed, setImgFailed] = React.useState(false);

  // If we have a real thumbnail URL and it hasn't failed, show it
  if(thumbnail && !imgFailed) {
    const src = thumbnail.includes('sndcdn.com') ? `https://wsrv.nl/?url=${encodeURIComponent(thumbnail)}` : thumbnail;
    return (
      <div className={`relative overflow-hidden ${className}`} style={style}>
        <img src={src} alt={title} className="w-full h-full object-cover"
          onError={()=>setImgFailed(true)}/>
      </div>
    );
  }

  // CSS fallback
  const bars = Array.from({length:12},(_,i)=>{
    const h = 20+Math.abs(Math.sin(i*0.7+0.9)*Math.cos(i*0.4))*60;
    return <div key={i} style={{width:3,height:`${h}%`,background:i%2===0?c1:c2,borderRadius:2,opacity:0.8,flexShrink:0}}/>;
  });
  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{background:`linear-gradient(135deg,#08000f 0%,#0d0020 100%)`,...style}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:c1}}/>
      <div style={{position:'absolute',right:-20,top:-20,width:80,height:80,borderRadius:'50%',background:c1,opacity:0.15,filter:'blur(20px)'}}/>
      <div style={{position:'absolute',bottom:4,left:6,right:6,display:'flex',alignItems:'flex-end',gap:2,height:'45%'}}>
        {bars}
      </div>
      <div style={{position:'absolute',top:6,left:8,right:8}}>
        <div style={{fontSize:8,fontWeight:900,color:c2,textTransform:'uppercase',letterSpacing:1,opacity:0.9,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{artist}</div>
        <div style={{fontSize:10,fontWeight:700,color:'#fff',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',marginTop:1}}>{title}</div>
      </div>
      <div style={{position:'absolute',bottom:4,right:6,fontSize:7,color:'rgba(255,255,255,0.2)',fontWeight:700}}>IS</div>
    </div>
  );
};

const extractYoutubeId=(url:string):string=>{
  if(!url)return'';
  const u=url.replace('music.youtube.com','www.youtube.com');
  if(u.includes('youtu.be/'))return u.split('youtu.be/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('/shorts/'))return u.split('/shorts/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('/embed/'))return u.split('/embed/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('v='))return u.split('v=')[1]?.split(/[&#]/)[0]||'';
  // Playlist-only URL — no video ID, return empty
  if(u.includes('list='))return'';
  const m=u.match(/[a-zA-Z0-9_-]{11}/);
  return m?m[0]:'';
};


const getThumbnailUrl = (track: MusicTrack): string => {
  if (track.thumbnail) return track.thumbnail;
  const url = track.url || '';
  const u = url.replace('music.youtube.com','www.youtube.com');
  // YouTube video thumbnail
  const id = extractYoutubeId(url);
  if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  // YouTube playlist — use first video thumbnail via playlist API workaround
  const listMatch = u.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (listMatch) return `https://i.ytimg.com/vi/${listMatch[1].slice(2,13)}/hqdefault.jpg`;
  return '';
};

const getEmbedUrl = (url:string):{embedUrl:string;type:'youtube'|'soundcloud'|'unknown'} => {
  if (url.includes('youtube.com')||url.includes('youtu.be')||url.includes('music.youtube')) {
    const u = url.replace('music.youtube.com','www.youtube.com');
    // Playlist URL
    const listMatch = u.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const vMatch = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (listMatch) {
      const listId = listMatch[1];
      const videoId = vMatch ? vMatch[1] : '';
      const embedUrl = videoId
        ? `https://www.youtube.com/embed/${videoId}?list=${listId}&autoplay=1&enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`
        : `https://www.youtube.com/embed/videoseries?list=${listId}&autoplay=1&enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`;
      return {embedUrl, type:'youtube'};
    }
    const id=extractYoutubeId(url).trim();
    if (id) return {embedUrl:`https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1&rel=0&playsinline=1&origin=${encodeURIComponent(window.location.origin)}`,type:'youtube'};
  }
  if (url.includes('soundcloud.com')) {
    // Strip tracking params (si=, utm_*, in=, etc.) — widget only needs the base track URL
    let scUrl = url;
    try { scUrl = new URL(url).origin + new URL(url).pathname; } catch {}
    return {embedUrl:`https://w.soundcloud.com/player/?url=${encodeURIComponent(scUrl)}&auto_play=true&hide_related=true&show_comments=false&show_user=true&visual=true&color=%23a855f7`,type:'soundcloud'};
  }
  if (url.includes('audiomack.com')) {
    // Fix double slashes after protocol
    const clean = url.replace(/^(https?:\/\/)/, '@@').replace(/\/\/+/g, '/').replace('@@', 'https://').split('?')[0].split('#')[0];
    // Ensure embed path format: audiomack.com/embed/artist/type/slug
    const embedBase = clean.includes('/embed/') ? clean : clean.replace('audiomack.com/', 'audiomack.com/embed/');
    return {embedUrl: embedBase + '?background=1', type: 'audiomack' as any};
  }
  return {embedUrl:url,type:'unknown'};
};

const IntegralLogo = ({className='w-10 h-10'}:{className?:string}) => (
  <svg viewBox="0 0 100 100" className={`${className} transition-transform duration-1000 ease-in-out`}>
    <path d="M35 52 C20 45 10 30 10 15 C25 15 40 25 45 40 Z" fill="#e11d48" transform="rotate(-10,50,50)"/>
    <path d="M50 5 C58 20 58 40 50 52 C42 40 42 20 50 5Z" fill="#0284c7"/>
    <path d="M65 52 C80 45 90 30 90 15 C75 15 60 25 55 40 Z" fill="#f59e0b" transform="rotate(10,50,50)"/>
    <path d="M15 55 C15 85 40 95 50 95" fill="none" stroke="#0ea5e9" strokeWidth="9" strokeLinecap="round"/>
    <path d="M85 55 C85 85 60 95 50 95" fill="none" stroke="#64748b" strokeWidth="9" strokeLinecap="round"/>
    <circle cx="50" cy="78" r="12" fill="#64748b"/>
  </svg>
);

// ─── Reusable Tooltip ─────────────────────────────────────────────────────────
const Tooltip = ({ label, children, position='top' }: { label: string; children: React.ReactNode; position?: 'top'|'bottom' }) => {
  const [coords, setCoords] = React.useState<{x:number;y:number}|null>(null);
  const ref = React.useRef<HTMLDivElement>(null);
  const show = () => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setCoords({ x: r.left + r.width / 2, y: position === 'top' ? r.top : r.bottom });
  };
  return (
    <div ref={ref} className="relative inline-flex" onMouseEnter={show} onMouseLeave={()=>setCoords(null)}>
      {children}
      {coords && (
        <div
          className="fixed z-[9999] pointer-events-none whitespace-nowrap"
          style={{ left: coords.x, top: position === 'top' ? coords.y - 8 : coords.y + 8, transform: position === 'top' ? 'translate(-50%,-100%)' : 'translate(-50%,0)' }}
        >
          <div className="bg-slate-900 border border-white/20 text-white text-[9px] font-black uppercase tracking-wide px-2.5 py-1.5 rounded-lg shadow-2xl">
            {label}
          </div>
          <div className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-white/20 ${position==='top'?'top-full -mt-[5px] border-b border-r':'bottom-full -mb-[5px] border-t border-l'}`}/>
        </div>
      )}
    </div>
  );
};

const VIZ_GROUPS = [
  { group:'Kaleidoscope', modes:['Bloom','Fractal','Storm','Nebula','Crystal'] },
  { group:'Waveform',     modes:['Oscilloscope','Mirror Wave','Ribbon','Lissajous','Spiral Wave'] },
  { group:'Spectrum',     modes:['Classic Bars','3D Bars','Radial Bars','Mountain','Pulse Burst'] },
  { group:'Circular',     modes:['Ring Pulse','Sunburst','Cog','Aurora Ring','Vortex'] },
  { group:'Psychedelic',  modes:['Plasma','Tunnel','Liquid','Prism','Mandala'] },
  { group:'VJ',           modes:['Grid Flash','Scanlines','Strobe','RGB Shift','Color Flood'] },
  { group:'Analytical',   modes:['Freq Chart','BPM Graph','Stereo Field','Harmonic','Particle Storm'] },
  { group:'Cosmos',       modes:['Starfield','Galaxy Spin','Nebula Cloud','Black Hole','Aurora'] },
];
const ALL_MODES   = VIZ_GROUPS.flatMap(g => g.modes);
const GROUP_COLORS= ['#a855f7','#06b6d4','#ef4444','#f59e0b','#ec4899','#3b82f6','#10b981','#60a5fa'];

// Picker-only: shows the mode buttons without the black canvas background
const GallerySlideshow = ({images,onClose,isAuthorized,onAdd,onDelete}:{images:string[];onClose:()=>void;isAuthorized:boolean;onAdd:(url:string)=>void;onDelete:(i:number)=>void;}) => {
  const [idx,setIdx] = React.useState(0);
  const [inputUrl,setInputUrl] = React.useState('');
  const safeIdx = images.length>0 ? idx%images.length : 0;
  React.useEffect(()=>{
    if(images.length<=1) return;
    const t = setInterval(()=>setIdx(i=>(i+1)%images.length),4000);
    return ()=>clearInterval(t);
  },[images.length]);
  return (
    <div style={{position:'absolute',inset:0,zIndex:25,background:'#000',display:'flex',flexDirection:'column',borderRadius:'2rem',overflow:'hidden'}} onClick={e=>e.stopPropagation()}>
      {/* Close button */}
      <button onClick={e=>{e.stopPropagation();onClose();}} style={{position:'absolute',top:10,right:10,zIndex:50,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.3)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><i className="fa-solid fa-xmark" style={{fontSize:11}}/></button>
      {/* Main image — full 100% width and height of display */}
      <div style={{flex:1,position:'relative',overflow:'hidden'}}>
        {images.length>0?(
          <>
            <img key={safeIdx} src={images[safeIdx]} alt="" style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>
            {images.length>1&&<>
              <button onClick={e=>{e.stopPropagation();setIdx(i=>(i-1+images.length)%images.length);}} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:10}}><i className="fa-solid fa-chevron-left" style={{fontSize:12}}/></button>
              <button onClick={e=>{e.stopPropagation();setIdx(i=>(i+1)%images.length);}} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',width:36,height:36,borderRadius:'50%',background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:10}}><i className="fa-solid fa-chevron-right" style={{fontSize:12}}/></button>
              <div style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',display:'flex',gap:5,zIndex:10}}>{images.map((_,i)=><button key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{width:i===safeIdx?16:6,height:6,borderRadius:3,background:i===safeIdx?'#fff':'rgba(255,255,255,0.35)',border:'none',cursor:'pointer',padding:0,transition:'all 0.3s'}}/>)}</div>
            </>}
          </>
        ):(
          <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,color:'#475569'}}>
            <i className="fa-solid fa-images" style={{fontSize:40}}/>
            <p style={{fontSize:11,fontWeight:900,textTransform:'uppercase',letterSpacing:'0.12em'}}>{isAuthorized?'Paste an image URL below':'No images yet'}</p>
          </div>
        )}
      </div>
      {/* Thumbnail strip */}
      <div style={{display:'flex',gap:6,padding:'6px 10px',background:'rgba(0,0,0,0.85)',overflowX:'auto',flexShrink:0,alignItems:'center',minHeight:52}}>
        {images.map((img,i)=>(
          <div key={i} onClick={e=>{e.stopPropagation();setIdx(i);}} style={{flexShrink:0,width:52,height:38,borderRadius:6,overflow:'hidden',border:i===safeIdx?'2px solid #a855f7':'2px solid rgba(255,255,255,0.1)',cursor:'pointer',position:'relative',transition:'border-color 0.3s'}}>
            <img src={img} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            {isAuthorized&&<button onClick={e=>{e.stopPropagation();onDelete(i);}} style={{position:'absolute',top:2,right:2,width:14,height:14,borderRadius:'50%',background:'#dc2626',color:'#fff',border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:7}}>✕</button>}
          </div>
        ))}
      </div>
      {/* URL input — admin only */}
      {isAuthorized&&(
        <div style={{display:'flex',gap:8,padding:'8px 12px',background:'rgba(0,0,0,0.9)',borderTop:'1px solid rgba(255,255,255,0.08)',flexShrink:0}} onClick={e=>e.stopPropagation()}>
          <input value={inputUrl} onChange={e=>setInputUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&inputUrl.trim()){onAdd(inputUrl.trim());setInputUrl('');}}} placeholder="Paste image URL..." style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:8,padding:'7px 12px',color:'#fff',fontSize:11,outline:'none'}}/>
          <button onClick={e=>{e.stopPropagation();if(!inputUrl.trim())return;onAdd(inputUrl.trim());setInputUrl('');}} style={{padding:'7px 18px',background:'#7c3aed',color:'#fff',borderRadius:8,fontSize:10,fontWeight:900,textTransform:'uppercase',border:'none',cursor:'pointer'}}>ADD</button>
        </div>
      )}
    </div>
  );
};

const VisualizerPickerOnly = ({onActivate}:{onActivate?:(mode?:number)=>void}) => {
  const [mode, setMode] = React.useState(0);
  const [groupOpen, setGroupOpen] = React.useState<number|null>(null);
  const currentGroupIdx = VIZ_GROUPS.findIndex(g=>g.modes.includes(ALL_MODES[mode]));
  return (
    <div className="absolute inset-0 pointer-events-none" style={{zIndex:20}}>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto" onClick={e=>e.stopPropagation()}>
        {VIZ_GROUPS.map((g,gi)=>(
          <div key={g.group} className="relative">
            <button
              onClick={()=>setGroupOpen(groupOpen===gi?null:gi)}
              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border ${currentGroupIdx===gi?'text-white border-transparent':'bg-black/60 border-white/10 text-slate-500 hover:text-white'}`}
              style={currentGroupIdx===gi?{background:GROUP_COLORS[gi],boxShadow:`0 0 12px ${GROUP_COLORS[gi]}80`}:{}}>
              {g.group}
            </button>
            {groupOpen===gi&&(
              <div className="absolute top-full mt-1 left-0 bg-black/95 border border-white/10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[110px] z-30 shadow-2xl">
                {g.modes.map(mn=>{
                  const gidx=ALL_MODES.indexOf(mn);
                  return(
                    <button key={mn} onClick={()=>{setMode(gidx);setGroupOpen(null);onActivate&&onActivate(gidx);}}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-left transition-all ${mode===gidx?'text-white':'text-slate-500 hover:text-white hover:bg-white/5'}`}
                      style={mode===gidx?{background:GROUP_COLORS[gi]+'33',color:GROUP_COLORS[gi]}:{}}>
                      {mn}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <button onClick={()=>{onActivate&&onActivate();}} className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-slate-500 hover:text-white transition-all">
          Visuals
        </button>

      </div>
    </div>
  );
};

const VisualizerCanvas = ({onActivate, active=true, initialMode=0, autoStart=false, isPlaying=true}:{onActivate?:()=>void; active?:boolean; initialMode?:number; autoStart?:boolean; isPlaying?:boolean}) => {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const eqRef         = useRef<HTMLCanvasElement>(null);
  const vizRootRef    = useRef<HTMLDivElement>(null);
  const rafRef        = useRef<number>(0);
  const audioRef      = useRef<{ctx:AudioContext;an:AnalyserNode;data:Uint8Array;wave:Uint8Array}|null>(null);
  const modeRef       = useRef(0);
  const isPlayingRef  = useRef(isPlaying);
  useEffect(()=>{ isPlayingRef.current = isPlaying; }, [isPlaying]);
  const prevModeRef = useRef(0);
  const morphRef    = useRef(1); // start at 1 = no transition
  const pendingModeChange = useRef(false);
  const transitionTypeRef = useRef(0);
  const [transitionStyle, setTransitionStyle] = useState(-1); // -1 = Auto
  const [transitionOpen,  setTransitionOpen]  = useState(false);

  const TRANSITION_STYLES = [
    { name: 'Crossfade',       icon: 'fa-circle-half-stroke',  color: '#06b6d4' },
    { name: 'Morphing',        icon: 'fa-wand-magic-sparkles', color: '#a855f7' },
    { name: 'Slice Wipe',      icon: 'fa-sliders',             color: '#f97316' },
    { name: 'Pixel Reveal',    icon: 'fa-bezier-curve',        color: '#10b981' },
    { name: 'Ripple Dissolve', icon: 'fa-staff-snake',         color: '#ec4899' },
    { name: 'Zoom Burst',      icon: 'fa-expand',              color: '#f59e0b' },
    { name: 'Shatter',         icon: 'fa-burst',               color: '#ef4444' },
    { name: 'Iris',            icon: 'fa-circle-dot',          color: '#8b5cf6' },
    { name: 'Diagonal Wipe',   icon: 'fa-angles-right',        color: '#14b8a6' },
    { name: 'Glitch',          icon: 'fa-bolt',                color: '#fb923c' },
    { name: 'Page Turn',       icon: 'fa-book-open',           color: '#38bdf8' },
    { name: 'Kaleidoscope',    icon: 'fa-snowflake',           color: '#c084fc' },
    { name: 'Burn',            icon: 'fa-fire',                color: '#f97316' },
    { name: 'Matrix Rain',     icon: 'fa-code',                color: '#4ade80' },
    { name: 'Vortex',          icon: 'fa-hurricane',           color: '#818cf8' },
    { name: 'TV Static',       icon: 'fa-tv',                  color: '#94a3b8' },
    { name: 'Mosaic',          icon: 'fa-table-cells',         color: '#fb7185' },
    { name: 'Shockwave',       icon: 'fa-circle-radiation',    color: '#fde68a' },
    { name: 'Ink Bleed',       icon: 'fa-droplet',             color: '#7dd3fc' },
    { name: 'Film Burn',       icon: 'fa-film',                color: '#fbbf24' },
  ];
  const AUTO_TRANSITION = { name: 'Auto', icon: 'fa-shuffle', color: '#facc15' };
  // transitionStyle === -1 means Auto (randomly picks on each mode change)
  const [mode,       setMode]      = useState(initialMode);
  const [groupOpen,  setGroupOpen] = useState<number|null>(null);
  const [autoOn,     setAutoOn]    = useState(autoStart);
  const autoOnRef = useRef(autoStart);
  useEffect(()=>{ autoOnRef.current = autoOn; }, [autoOn]);
  const [pickerVisible, setPickerVisible] = useState(true);
  const idleTimerRef = useRef<number>(0);

  const resetIdleTimer = () => {
    setPickerVisible(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setPickerVisible(false), 3000);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = vizRootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        resetIdleTimer();
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    resetIdleTimer();
    return () => clearTimeout(idleTimerRef.current);
  }, []);
  const shuffleRef   = useRef<number>(0);
  const modeIndexRef = useRef(0);
  const lastModeRef  = useRef(-1); // avoid repeating same mode twice

  // Track whether the user has explicitly chosen a transition style
  const userPinnedTransition = useRef(false);

  useEffect(()=>{
    prevModeRef.current = modeRef.current;       // snapshot OLD before updating
    modeRef.current = mode;
    modeIndexRef.current = mode;
    morphRef.current = 0;                        // restart morph progress
    pendingModeChange.current = false;
    // Only randomise if user hasn't pinned a style
    if (!userPinnedTransition.current) {
      transitionTypeRef.current = Math.floor(Math.random() * 20);
    }
  },[mode]);

  useEffect(()=>{
    if (transitionStyle === -1) {
      userPinnedTransition.current = false;      // Auto — let mode-change effect randomise
    } else {
      userPinnedTransition.current = true;       // user explicitly pinned a style
      transitionTypeRef.current = transitionStyle;
    }
  },[transitionStyle]);

  // ── auto-shuffle: random pick every 5s ──────────────────────────────────
  useEffect(()=>{
    clearInterval(shuffleRef.current);
    if(!autoOn) return;
    const pickRandom = () => {
      let next;
      do { next = Math.floor(Math.random() * ALL_MODES.length); }
      while (next === lastModeRef.current && ALL_MODES.length > 1);
      lastModeRef.current = next;
      modeIndexRef.current = next;
      setMode(next);
    };
    shuffleRef.current = window.setInterval(pickRandom, 5000);
    return ()=>clearInterval(shuffleRef.current);
  },[autoOn]);

  // ── handle Auto button click — random jump ───────────────────────────────
  const handleAutoClick = () => {
    let next;
    do { next = Math.floor(Math.random() * ALL_MODES.length); }
    while (next === lastModeRef.current && ALL_MODES.length > 1);
    lastModeRef.current = next;
    setMode(next);
    // first click also turns auto ON; clicking while on just advances
    if(!autoOn) setAutoOn(true);
  };
  const handleAutoToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAutoOn(p => !p);
  };

  // ── no audio capture — visuals use animated simulation ─────────────────────

  // ── render loop ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const canvas = canvasRef.current;
    const eq     = eqRef.current;
    if (!canvas||!eq) return;
    const ctx   = canvas.getContext('2d')!;
    const eqCtx = eq.getContext('2d')!;

    // ── two full-size offscreen buffers for crossfade morphing ───────────────
    const bufA = document.createElement('canvas');
    const bufB = document.createElement('canvas');
    const ctxA = bufA.getContext('2d')!;
    const ctxB = bufB.getContext('2d')!;

    // offscreen source canvas for kaleidoscope — must be declared BEFORE resize()
    const off = document.createElement('canvas'); off.width = 800; off.height = 800;
    const ox  = off.getContext('2d')!;

    const resize = () => {
      // Walk up the DOM to find the first ancestor with real dimensions
      let root: HTMLElement | null = canvas.parentElement;
      while (root && root.clientWidth === 0 && root !== document.body) root = root.parentElement;
      const pw = Math.min(root?.clientWidth  || window.innerWidth,  800);
      const ph = Math.min(root?.clientHeight || window.innerHeight, 600);
      canvas.width  = pw;  canvas.height  = ph;
      eq.width      = pw;  eq.height      = 56;
      bufA.width = pw; bufA.height = ph;
      bufB.width = pw; bufB.height = ph;
      off.width = Math.max(pw, ph); off.height = Math.max(pw, ph);
    };
    resize();
    window.addEventListener('resize', resize);

    const pts = Array.from({length:24},(_,i)=>({
      x:Math.random(), y:Math.random(),
      vx:(Math.random()-.5)*.003, vy:(Math.random()-.5)*.003,
      baseR:18+Math.random()*80, h:(i/32)*360, dh:.3+Math.random()*.7,
      angle:Math.random()*Math.PI*2, da:(Math.random()-.5)*.025,
    }));

    let t=0, bass=0, mid=0, tre=0, hue=0, beat=0;
    let bassRaw=0, midRaw=0, treRaw=0;
    const waveHist:number[][] = [];

    // persistent fake data arrays — reused every frame
    const fakeFreq = new Uint8Array(512);
    const fakeWave = new Uint8Array(1024);

    const drawStar = (c:CanvasRenderingContext2D, r:number, n=5) => {
      c.beginPath();
      for(let i=0;i<n*2;i++){
        const a=(i*Math.PI)/n-Math.PI/2, ri=i%2===0?r:r*.38;
        i===0 ? c.moveTo(Math.cos(a)*ri,Math.sin(a)*ri) : c.lineTo(Math.cos(a)*ri,Math.sin(a)*ri);
      }
      c.closePath();
    };

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      // Always advance morph even when paused so transitions complete
      if (morphRef.current < 1) {
        // 1800ms transition at 60fps → step = 1 / (1.8 * 60) ≈ 0.0093
        const MORPH_SPEED_STEP = 1 / (1.8 * 60);
        morphRef.current = Math.min(1, morphRef.current + MORPH_SPEED_STEP);
      }
      if (isPlayingRef.current || morphRef.current < 1) {
        t += .007;
      }
      const cw = canvas.width, ch = canvas.height;

      // ── always use animated fallback (iframe audio not accessible to Web Audio API) ──
      bassRaw = .35+.35*Math.abs(Math.sin(t*2.1)) * Math.abs(Math.sin(t*.31));
      midRaw  = .28+.28*Math.abs(Math.sin(t*3.3+1.1));
      treRaw  = .20+.20*Math.abs(Math.sin(t*5.7+2.2));
      for(let i=0;i<512;i++){
        const env = Math.exp(-i/55);
        fakeFreq[i] = Math.min(255, Math.floor(
          env*255*bassRaw
          + 130*Math.abs(Math.sin(i*.13+t*3.5))*midRaw
          + 70 *Math.abs(Math.sin(i*.37+t*5.1))*treRaw
          + 20 *Math.random()*bassRaw
        ));
      }
      for(let i=0;i<1024;i++)
        fakeWave[i] = 128
          + Math.floor(110*Math.sin(i*.048+t*5)*bassRaw)
          + Math.floor(40 *Math.sin(i*.19 +t*9)*midRaw)
          + Math.floor(15 *Math.sin(i*.55 +t*13)*treRaw);
      const fd:Uint8Array = fakeFreq;
      const wd:Uint8Array = fakeWave;

      // faster smoothing = more reactive to music
      bass = bass*.55 + bassRaw*.45;
      mid  = mid *.60 + midRaw *.40;
      tre  = tre *.65 + treRaw *.35;
      const beatDelta = Math.max(0, bassRaw - bass);
      beat = Math.max(beat*.75, beatDelta*9);   // stronger beat punch
      hue  = (hue + .5 + bass*4 + beat*3) % 360; // hue races with music

      // ── beat-triggered random visual switch (when autoOn) ────────────────
      if (autoOnRef.current && beat > 0.55 && morphRef.current > 0.9) {
        let next;
        do { next = Math.floor(Math.random() * ALL_MODES.length); }
        while (next === lastModeRef.current && ALL_MODES.length > 1);
        lastModeRef.current = next;
        modeIndexRef.current = next;
        setMode(next);
      }

      // ── render both modes into offscreen buffers ─────────────────────────
      const renderScene = (c:CanvasRenderingContext2D, m:number) => {

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 0 — Kaleidoscope (modes 0–4)
      // ══════════════════════════════════════════════════════════════════════
      if (m < 5) {
        const W=off.width, H=off.height;
        const fade = m===3?.05 : m===2?.18 : .10;
        ox.fillStyle=`rgba(0,0,0,${fade+bass*.18})`; ox.fillRect(0,0,W,H);

        pts.forEach((p,idx)=>{
          const spd = 1+bass*14+mid*6+beat*10;
          p.x+=p.vx*spd; p.y+=p.vy*spd; p.h=(p.h+p.dh)%360; p.angle+=p.da*spd;
          if(p.x<0||p.x>1) p.vx*=-1; if(p.y<0||p.y>1) p.vy*=-1;
          const px=p.x*W, py=p.y*H, ph=(p.h+hue)%360;
          const band = idx%3===0?bass : idx%3===1?mid : tre;
          const sz   = m===2?5.5 : m===3?3 : 2.8;
          const r    = p.baseR*(1+band*sz+beat*2);
          ox.save(); ox.globalAlpha=Math.min(1,.4+band*.55+beat*.3);
          ox.globalCompositeOperation='screen'; ox.translate(px,py); ox.rotate(p.angle);
          if(m===0){
            const g=ox.createRadialGradient(0,0,0,0,0,r);
            g.addColorStop(0,`hsla(${ph},100%,80%,1)`); g.addColorStop(.5,`hsla(${(ph+55)%360},90%,55%,.5)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            ox.fillStyle=g; ox.beginPath(); ox.arc(0,0,r,0,Math.PI*2); ox.fill();
          } else if(m===1){
            const g=ox.createRadialGradient(0,0,0,0,0,r);
            g.addColorStop(0,`hsla(${ph},100%,88%,1)`); g.addColorStop(.6,`hsla(${(ph+80)%360},90%,55%,.6)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            ox.fillStyle=g;
            const sides=3+(idx%3); ox.beginPath();
            for(let s=0;s<sides;s++){const a=(s/sides)*Math.PI*2-Math.PI/2; s===0?ox.moveTo(Math.cos(a)*r,Math.sin(a)*r):ox.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
            ox.closePath(); ox.fill();
          } else if(m===2){
            const len=r*(1+bass*3), nl=2+Math.floor(bass*4);
            for(let l=0;l<nl;l++){
              const a=(l/nl)*Math.PI;
              ox.strokeStyle=`hsla(${(ph+l*30)%360},100%,85%,${.6+bass*.4})`;
              ox.lineWidth=1.5+bass*8; ox.shadowColor=`hsla(${ph},100%,70%,1)`; ox.shadowBlur=10+bass*35;
              ox.beginPath(); ox.moveTo(Math.cos(a)*-len,Math.sin(a)*-len); ox.lineTo(Math.cos(a)*len,Math.sin(a)*len); ox.stroke();
            }
            ox.shadowBlur=0;
          } else if(m===3){
            const rx=r*(1.2+mid*1.5), ry=r*(.5+mid*.8);
            const g=ox.createRadialGradient(0,0,0,0,0,rx);
            g.addColorStop(0,`hsla(${ph},85%,65%,${.5+mid*.35})`); g.addColorStop(.45,`hsla(${(ph+40)%360},90%,45%,.25)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            ox.fillStyle=g; ox.beginPath(); ox.ellipse(0,0,rx,ry,0,0,Math.PI*2); ox.fill();
          } else {
            const g=ox.createRadialGradient(0,0,0,0,0,r);
            g.addColorStop(0,`hsla(${ph},100%,96%,1)`); g.addColorStop(.35,`hsla(${(ph+60)%360},90%,68%,.7)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            ox.fillStyle=g;
            if(idx%3===0){ ox.beginPath(); ox.moveTo(0,-r); ox.lineTo(r*.6,0); ox.lineTo(0,r); ox.lineTo(-r*.6,0); ox.closePath(); ox.fill(); }
            else { drawStar(ox,r,idx%3===1?5:6); ox.fill(); }
          }
          ox.restore();
        });

        c.fillStyle='#000'; c.fillRect(0,0,cw,ch);
        c.save(); c.translate(cw/2,ch/2);
        const speeds=[.22,.38,1.6,.14,.35];
        const cr = Math.sqrt(cw*cw+ch*ch)*0.52*(1+bass*.15+beat*.2);
        c.rotate(t*speeds[m]+bass*1.2+beat*.8);
        const sc=m===1?20:m===4?14:16, sa=(Math.PI*2)/sc;
        for(let i=0;i<sc;i++){
          c.save(); c.rotate(i*sa);
          c.beginPath();
          c.moveTo(0,0);
          c.lineTo(Math.cos(-sa/2)*cr, Math.sin(-sa/2)*cr);
          c.arc(0,0,cr,-sa/2,sa/2);
          c.lineTo(0,0);
          c.closePath(); c.clip();
          if(i%2===1){ c.scale(-1,1); }
          c.drawImage(off, 0, 0, off.width, off.height, -cr, -cr, cr*2, cr*2);
          c.restore();
        }
        c.restore();
        if(beat>.1){ c.save(); c.globalAlpha=beat*.32; c.fillStyle=`hsl(${hue},100%,80%)`; c.fillRect(0,0,cw,ch); c.restore(); }
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 1 — Waveform (5–9)
      // ══════════════════════════════════════════════════════════════════════
      else if (m < 10) {
        c.fillStyle='#000'; c.fillRect(0,0,cw,ch);
        // convert Uint8Array waveform to [-1,1] floats
        const wpts = Array.from(wd).map(v=>(v/128)-1);
        c.save();
        if(m===5){  // Oscilloscope
          c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=2+bass*4;
          c.shadowColor=`hsl(${hue},100%,70%)`; c.shadowBlur=8+bass*20;
          c.beginPath();
          wpts.forEach((v,i)=>{ const x=(i/wpts.length)*cw, y=ch/2+v*(ch*.42)*(1+bass*1.5); i===0?c.moveTo(x,y):c.lineTo(x,y); });
          c.stroke();
        } else if(m===6){  // Mirror Wave
          [1,-1].forEach(flip=>{
            c.strokeStyle=`hsl(${hue},90%,${flip>0?65:55}%)`; c.lineWidth=1.5+bass*3; c.beginPath();
            wpts.forEach((v,i)=>{ const x=(i/wpts.length)*cw, y=ch/2+flip*v*(ch*.38)*(1+bass); i===0?c.moveTo(x,y):c.lineTo(x,y); });
            c.stroke();
          });
        } else if(m===7){  // Ribbon
          const bw = cw/wpts.length;
          wpts.forEach((v,i)=>{
            if(i===0) return;
            const x=(i/wpts.length)*cw, y=ch/2+v*(ch*.4);
            const h2 = 2+Math.abs(v)*40*(1+bass*2);
            c.fillStyle=`hsla(${(hue+i*.3)%360},90%,65%,${.4+Math.abs(v)*.5})`;
            c.fillRect(x,y,bw+1,h2);
          });
        } else if(m===8){  // Lissajous
          c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath();
          for(let i=0;i<512;i++){
            const a=i/512*Math.PI*2;
            const x=cw/2+Math.sin(a*3+bass*2)*cw*.38*(1+bass*.5);
            const y=ch/2+Math.sin(a*2+mid*3)*ch*.38*(1+mid*.5);
            i===0?c.moveTo(x,y):c.lineTo(x,y);
          }
          c.stroke();
        } else {  // Spiral Wave
          wpts.forEach((v,i)=>{
            const a=(i/wpts.length)*Math.PI*8+t;
            const r2=(ch*.3)*(1+v*(1+bass*2));
            c.fillStyle=`hsla(${(hue+i*.5)%360},90%,70%,.7)`;
            c.beginPath(); c.arc(cw/2+Math.cos(a)*r2,ch/2+Math.sin(a)*r2,2+Math.abs(v)*4,0,Math.PI*2); c.fill();
          });
        }
        c.restore();
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 2 — Spectrum (10–14)
      // ══════════════════════════════════════════════════════════════════════
      else if (m < 15) {
        c.fillStyle='rgba(0,0,0,.12)'; c.fillRect(0,0,cw,ch);
        const d = fd;
        if(m===10){  // Classic Bars
          const bars=80, bw=cw/bars;
          for(let i=0;i<bars;i++){
            const v=d[Math.floor(i/bars*d.length*.75)]/255, bh=Math.max(2,v*ch*.85);
            const g=c.createLinearGradient(0,ch-bh,0,ch);
            g.addColorStop(0,`hsl(${(hue+i*3)%360},90%,65%)`); g.addColorStop(1,`hsl(${(hue+i*3+60)%360},90%,35%)`);
            c.fillStyle=g; c.fillRect(i*bw+1,ch-bh,bw-2,bh);
          }
        } else if(m===11){  // 3D Bars
          const bars=50, bw=cw/bars, dep=14;
          for(let i=0;i<bars;i++){
            const v=d[Math.floor(i/bars*d.length*.75)]/255, bh=Math.max(2,v*ch*.75);
            const c1=`hsl(${(hue+i*4)%360},85%,45%)`, c2=`hsl(${(hue+i*4)%360},85%,58%)`, c3=`hsl(${(hue+i*4)%360},85%,32%)`;
            c.fillStyle=c1; c.fillRect(i*bw+1,ch-bh,bw-2,bh);
            c.fillStyle=c2; c.fillRect(i*bw+1+dep,ch-bh-dep,bw-2,bh);
            c.fillStyle=c3; c.beginPath(); c.moveTo(i*bw+1,ch-bh); c.lineTo(i*bw+1+dep,ch-bh-dep); c.lineTo(i*bw+bw-1+dep,ch-bh-dep); c.lineTo(i*bw+bw-1,ch-bh); c.fill();
          }
        } else if(m===12){  // Radial Bars
          c.save(); c.translate(cw/2,ch/2);
          const bars=64, innerR=Math.min(cw,ch)*.1, outerR=Math.min(cw,ch)*.44;
          for(let i=0;i<bars;i++){
            const a=(i/bars)*Math.PI*2, v=d[Math.floor(i/bars*d.length*.75)]/255;
            const blen=Math.max(2,v*(outerR-innerR)*(1+bass*.5));
            c.strokeStyle=`hsl(${(hue+i*5.6)%360},90%,65%)`; c.lineWidth=3;
            c.beginPath(); c.moveTo(Math.cos(a)*innerR,Math.sin(a)*innerR); c.lineTo(Math.cos(a)*(innerR+blen),Math.sin(a)*(innerR+blen)); c.stroke();
          }
          c.restore();
        } else if(m===13){  // Mountain
          for(let b2=4;b2>=0;b2--){
            c.beginPath(); c.moveTo(0,ch);
            for(let i=0;i<cw;i++){
              const v=d[Math.floor(i/cw*d.length*.6)]/255;
              const y=ch-(v*(ch*.6)+b2*(ch*.07))*(1+bass*.5); c.lineTo(i,y);
            }
            c.lineTo(cw,ch); c.closePath();
            c.fillStyle=`hsla(${(hue+b2*30)%360},85%,${40+b2*5}%,${.55+b2*.08})`; c.fill();
          }
        } else {  // Pulse Burst — concentric rings that explode outward on beat
          c.save(); c.translate(cw/2,ch/2);
          const maxR=Math.min(cw,ch)*.5;
          for(let ring=0;ring<8;ring++){
            const v=d[Math.floor(ring/8*d.length*.5)]/255;
            const r2=maxR*(ring/8)*(1+bass*.6+beat*.8);
            const alpha=Math.max(0,1-(ring/8));
            c.strokeStyle=`hsla(${(hue+ring*45)%360},100%,70%,${alpha*(.4+v*.5)})`;
            c.lineWidth=2+v*8+beat*10;
            c.beginPath(); c.arc(0,0,r2,0,Math.PI*2); c.stroke();
          }
          c.restore();
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 3 — Circular (15–19)
      // ══════════════════════════════════════════════════════════════════════
      else if (m < 20) {
        c.fillStyle='rgba(0,0,0,.15)'; c.fillRect(0,0,cw,ch);
        const d = fd;
        c.save(); c.translate(cw/2,ch/2);
        const R = Math.min(cw,ch)*.35;
        if(m===15){  // Ring Pulse
          for(let ring=0;ring<4;ring++){
            const sc2=1+ring*.25+bass*(ring+1)*.15;
            c.strokeStyle=`hsla(${(hue+ring*30)%360},90%,65%,${.8-ring*.15})`; c.lineWidth=2+bass*6;
            c.beginPath(); c.arc(0,0,R*sc2,0,Math.PI*2); c.stroke();
          }
          for(let i=0;i<64;i++){
            const a=(i/64)*Math.PI*2, v=d[Math.floor(i/64*d.length*.75)]/255, r2=R+v*R*.8;
            c.fillStyle=`hsl(${(hue+i*5.6)%360},90%,70%)`;
            c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,2+v*4,0,Math.PI*2); c.fill();
          }
        } else if(m===16){  // Sunburst
          const rays=64;
          for(let i=0;i<rays;i++){
            const a=(i/rays)*Math.PI*2, v=d[Math.floor(i/rays*d.length*.75)]/255;
            const len=R*.25+v*R*(1+bass*.8);
            c.strokeStyle=`hsl(${(hue+i*(360/rays))%360},95%,70%)`; c.lineWidth=1.5+v*4;
            c.beginPath(); c.moveTo(Math.cos(a)*R*.12,Math.sin(a)*R*.12); c.lineTo(Math.cos(a)*(R*.12+len),Math.sin(a)*(R*.12+len)); c.stroke();
          }
        } else if(m===17){  // Cog
          c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=3+bass*5;
          const teeth=32; c.beginPath();
          for(let i=0;i<teeth*2+1;i++){
            const a=(i/(teeth))*Math.PI, r2=i%2===0 ? R*(1+bass*.3) : R*.75;
            i===0 ? c.moveTo(Math.cos(a)*r2,Math.sin(a)*r2) : c.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);
          }
          c.closePath(); c.stroke();
        } else if(m===18){  // Aurora Ring
          for(let i=0;i<128;i++){
            const a=(i/128)*Math.PI*2+t*.3, v=d[Math.floor(i/128*d.length*.75)]/255;
            const r2=R*.6+v*R*.7;
            c.fillStyle=`hsla(${(hue+i*2.8)%360},100%,70%,${.4+v*.5})`;
            c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,2+v*7,0,Math.PI*2); c.fill();
          }
        } else {  // Vortex
          for(let i=0;i<200;i++){
            const a=i*.3+t*(1+bass)*2, r2=(i/200)*R*(1+bass*.4);
            c.fillStyle=`hsla(${(hue+i*1.8)%360},90%,70%,${.3+bass*.4})`;
            c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,1.5+bass*3,0,Math.PI*2); c.fill();
          }
        }
        c.restore();
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 4 — Psychedelic (20–24)
      // ══════════════════════════════════════════════════════════════════════
      else if (m < 25) {
        c.fillStyle='rgba(0,0,0,.09)'; c.fillRect(0,0,cw,ch);
        if(m===20){  // Plasma
          for(let y2=0;y2<ch;y2+=6) for(let x2=0;x2<cw;x2+=6){
            const v = Math.sin(x2*.018+t) + Math.sin(y2*.018+t*1.3)
                    + Math.sin((x2+y2)*.01+bass*3) + Math.sin(Math.sqrt(x2*x2+y2*y2)*.015+t*.7);
            c.fillStyle=`hsl(${(hue+v*60)%360},90%,${48+v*14}%)`;
            c.fillRect(x2,y2,7,7);
          }
        } else if(m===21){  // Tunnel
          for(let ring=20;ring>0;ring--){
            const r2=(ring/20)*(Math.min(cw,ch)*.58)*(1+bass*.3);
            c.strokeStyle=`hsla(${(hue+ring*18+t*30)%360},90%,65%,${ring/20})`;
            c.lineWidth=2; c.beginPath(); c.arc(cw/2,ch/2,r2,0,Math.PI*2); c.stroke();
          }
        } else if(m===22){  // Liquid
          c.globalCompositeOperation='screen';
          for(let i=0;i<6;i++){
            const cx2=cw/2+Math.sin(t*(i+1)*.7)*cw*.32, cy2=ch/2+Math.cos(t*(i+.5)*.6)*ch*.32;
            const rad=90+bass*90;
            const g=c.createRadialGradient(cx2,cy2,0,cx2,cy2,rad);
            g.addColorStop(0,`hsla(${(hue+i*60)%360},100%,70%,.55)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            c.fillStyle=g; c.beginPath(); c.arc(cx2,cy2,rad,0,Math.PI*2); c.fill();
          }
          c.globalCompositeOperation='source-over';
        } else if(m===23){  // Prism
          c.save(); c.translate(cw/2,ch/2);
          for(let i=0;i<12;i++){
            c.save(); c.rotate(i*Math.PI/6+t*.2);
            const g=c.createLinearGradient(0,-ch*.5,0,ch*.5);
            g.addColorStop(0,`rgba(0,0,0,0)`); g.addColorStop(.5,`hsla(${(hue+i*30)%360},100%,70%,.7)`); g.addColorStop(1,`rgba(0,0,0,0)`);
            c.fillStyle=g; c.fillRect(-6,-ch*.5,12+bass*25,ch); c.restore();
          }
          c.restore();
        } else {  // Mandala
          c.save(); c.translate(cw/2,ch/2); c.rotate(t*.15+bass*.5);
          for(let ring=0;ring<5;ring++){
            const petals=6+ring*2, r2=(ring+1)*Math.min(cw,ch)*.065*(1+bass*.35);
            for(let p=0;p<petals;p++){
              const a=(p/petals)*Math.PI*2;
              c.save(); c.rotate(a);
              const g=c.createRadialGradient(r2,0,0,r2,0,r2*.65);
              g.addColorStop(0,`hsla(${(hue+ring*40+p*20)%360},90%,70%,.85)`); g.addColorStop(1,`rgba(0,0,0,0)`);
              c.fillStyle=g; c.beginPath(); c.ellipse(r2,0,r2*.6,r2*.22,0,0,Math.PI*2); c.fill();
              c.restore();
            }
          }
          c.restore();
        }
        const vig2=c.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*.55);
        vig2.addColorStop(0,'rgba(0,0,0,0)'); vig2.addColorStop(1,'rgba(0,0,0,.55)');
        c.fillStyle=vig2; c.fillRect(0,0,cw,ch);
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 5 — VJ (25–29)
      // ══════════════════════════════════════════════════════════════════════
      else if (m < 30) {
        c.fillStyle='#000'; c.fillRect(0,0,cw,ch);
        const d = fd;
        if(m===25){  // Grid Flash — full screen, each cell independently random
          const cols=Math.floor(cw/60), rows=Math.floor(ch/50);
          const gw=cw/cols, gh=ch/rows;
          for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
            const rand=Math.random();
            const v=d[Math.floor(Math.random()*d.length*.75)]/255;
            if(rand < bass*.7+.15){
              c.fillStyle=`hsl(${(hue+Math.random()*180)%360},90%,${30+v*50}%)`;
            } else {
              c.fillStyle=`hsl(${hue},20%,${3+v*5}%)`;
            }
            c.fillRect(col*gw,row*gh,gw-1,gh-1);
          }
        } else if(m===26){  // Scanlines
          for(let y2=0;y2<ch;y2+=3){
            const v=d[Math.floor(y2/ch*d.length*.75)]/255;
            c.fillStyle=`hsla(${(hue+y2*.1)%360},90%,${28+v*42}%,${.45+v*.45})`;
            c.fillRect(0,y2,cw*(v*(1+bass)),2);
          }
        } else if(m===27){  // Strobe
          const brt = beat>.22 ? 78+beat*20 : 4;
          c.fillStyle=`hsl(${hue},${beat>.22?75:50}%,${brt}%)`; c.fillRect(0,0,cw,ch);
          c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath();
          for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw, y2=ch/2-(d[i]/255)*ch*.42; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); }
          c.stroke();
        } else if(m===28){  // RGB Shift
          const shift=bass*18;
          ([[255,0,0],[0,255,0],[0,0,255]] as [number,number,number][]).forEach(([r,g,b],ci)=>{
            c.save(); c.globalCompositeOperation='screen';
            c.strokeStyle=`rgba(${r},${g},${b},.85)`; c.lineWidth=2;
            c.translate((ci-1)*shift,0); c.beginPath();
            for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw, y2=ch/2-(d[i]/255)*ch*.42; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); }
            c.stroke(); c.restore();
          });
        } else {  // Color Flood — full-screen gradient tides that pulse with bass
          const g=c.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*(0.5+bass*.6));
          g.addColorStop(0,`hsla(${hue},100%,${40+bass*30}%,${0.7+bass*.3})`);
          g.addColorStop(.5,`hsla(${(hue+60)%360},90%,${20+mid*25}%,.5)`);
          g.addColorStop(1,`hsla(${(hue+120)%360},80%,5%,0)`);
          c.fillStyle=g; c.fillRect(0,0,cw,ch);
          // overlay shimmer lines
          for(let i=0;i<6;i++){
            const y2=ch/2+Math.sin(t*(i+1)*.4)*ch*.4;
            c.strokeStyle=`hsla(${(hue+i*40)%360},100%,80%,${.1+bass*.2})`;
            c.lineWidth=1+bass*3;
            c.beginPath(); c.moveTo(0,y2); c.bezierCurveTo(cw*.3,y2-50*mid,cw*.7,y2+50*tre,cw,y2); c.stroke();
          }
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 6 — Analytical (30–34)
      // ══════════════════════════════════════════════════════════════════════
      else if (m >= 30 && m < 35) {
        c.fillStyle='rgba(0,0,5,.88)'; c.fillRect(0,0,cw,ch);
        const d = fd;
        // grid lines
        c.strokeStyle='rgba(0,200,100,.15)'; c.lineWidth=1;
        for(let x2=0;x2<cw;x2+=cw/8){ c.beginPath(); c.moveTo(x2,0); c.lineTo(x2,ch); c.stroke(); }
        for(let y2=0;y2<ch;y2+=ch/5){ c.beginPath(); c.moveTo(0,y2); c.lineTo(cw,y2); c.stroke(); }

        if(m===30){  // Freq Chart
          c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=2; c.beginPath();
          for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw, y2=ch-(d[i]/255)*ch*.9; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); }
          c.stroke();
          c.fillStyle=`hsla(${hue},90%,55%,.15)`; c.fill();
        } else if(m===31){  // BPM Graph
          const snap=Array.from({length:20},(_,i)=>d[Math.floor(i/20*d.length*.75)]/255);
          waveHist.push(snap); if(waveHist.length>120) waveHist.shift();
          // draw each tracked band as a scrolling line
          for(let band=0;band<3;band++){
            c.strokeStyle=`hsl(${(hue+band*120)%360},90%,65%)`; c.lineWidth=1.5; c.beginPath();
            waveHist.forEach((s,ti)=>{ const x2=(ti/120)*cw, y2=ch-s[band*7]*ch*.85; ti===0?c.moveTo(x2,y2):c.lineTo(x2,y2); });
            c.stroke();
          }
        } else if(m===32){  // Stereo Field (Lissajous on XY)
          c.save(); c.translate(cw/2,ch/2);
          for(let i=0;i<8;i++){ c.strokeStyle='rgba(0,200,255,.15)'; c.lineWidth=1; c.beginPath(); c.arc(0,0,(i+1)*Math.min(cw,ch)*.055,0,Math.PI*2); c.stroke(); }
          const N=Math.floor(wd.length/2);
          c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath();
          for(let i=0;i<N;i++){
            const lv=(wd[i]-128)/128, rv=(wd[i+N]-128)/128;
            const x2=(lv+rv)*Math.min(cw,ch)*.38, y2=(lv-rv)*Math.min(cw,ch)*.38;
            i===0?c.moveTo(x2,y2):c.lineTo(x2,y2);
          }
          c.stroke(); c.restore();
        } else if(m===33){  // Harmonic overlay
          [0, Math.floor(d.length*.12), Math.floor(d.length*.25), Math.floor(d.length*.5)].forEach((f,fi)=>{
            c.strokeStyle=`hsl(${(hue+fi*90)%360},90%,65%)`; c.lineWidth=2; c.beginPath();
            for(let i=0;i<cw;i++){
              const bin=Math.min(f+Math.floor(i/cw*30), d.length-1);
              const y2=ch/2-(d[bin]/255)*ch*.42;
              i===0?c.moveTo(i,y2):c.lineTo(i,y2);
            }
            c.stroke();
          });
        } else if (m === 34) {  // Particle Storm — bass-driven particle explosion from center
          c.fillStyle='rgba(0,0,0,.18)'; c.fillRect(0,0,cw,ch);
          c.save(); c.translate(cw/2,ch/2);
          const count=80;
          for(let i=0;i<count;i++){
            const angle=(i/count)*Math.PI*2 + t*0.4;
            const v=fd[Math.floor(i/count*fd.length*.8)]/255;
            const speed=(0.15+bass*0.7+beat*0.5)*Math.min(cw,ch)*0.52;
            const r2 = v*speed*(1+bass*0.8);
            const px=Math.cos(angle)*r2, py=Math.sin(angle)*r2;
            const size=2+v*6+beat*8;
            const g=c.createRadialGradient(px,py,0,px,py,size*2);
            g.addColorStop(0,`hsla(${(hue+i*4.5)%360},100%,85%,${0.7+v*0.3})`);
            g.addColorStop(1,'rgba(0,0,0,0)');
            c.fillStyle=g; c.beginPath(); c.arc(px,py,size*2,0,Math.PI*2); c.fill();
          }
          // core burst
          const coreG=c.createRadialGradient(0,0,0,0,0,30+bass*60+beat*40);
          coreG.addColorStop(0,`hsla(${hue},100%,90%,${0.4+beat*0.5})`);
          coreG.addColorStop(1,'rgba(0,0,0,0)');
          c.fillStyle=coreG; c.beginPath(); c.arc(0,0,30+bass*60+beat*40,0,Math.PI*2); c.fill();
          c.restore();
        }
      }

      // ══════════════════════════════════════════════════════════════════════
      // GROUP 7 — Cosmos (modes 35–39)
      // ══════════════════════════════════════════════════════════════════════
      else if (m >= 35) {
        c.fillStyle='#000005'; c.fillRect(0,0,cw,ch);
        const cosmoCx=cw/2, cosmoCy=ch/2;

        if (m === 35) {
          // ── STARFIELD: thousands of blinking stars with warp streaks ──────
          // Deep background — subtle fade so trails persist but sky stays dark
          c.fillStyle='rgba(0,0,6,0.18)'; c.fillRect(0,0,cw,ch);

          const warpSpeed  = 1.2 + bass * 5 + beat * 3.5;
          const beatFlash  = beat * 0.6;

          // ── Layer 1: 2000 stars spread uniformly across the entire canvas ─
          // LCG-based hash gives true uniform distribution (not sin/cos clustering)
          const STATIC = 2000;
          for (let si=0; si<STATIC; si++) {
            // LCG hash — produces well-distributed positions across full canvas
            const hx = (si * 1664525 + 1013904223) & 0x7fffffff;
            const hy = (si * 22695477 + 1)         & 0x7fffffff;
            const sx = (hx / 0x7fffffff) * cw;
            const sy = (hy / 0x7fffffff) * ch;

            // each star has a unique blink speed and phase offset
            const blinkSpeed = 0.5 + (si % 23) * 0.18;
            const blinkPhase = (si * 2.399963) % (Math.PI * 2); // golden-ratio spread
            // sharp twinkle: power-2 makes it pop on/off rather than gently fade
            const raw = Math.sin(t * blinkSpeed + blinkPhase);
            const twinkle = raw * raw * (raw > 0 ? 1 : -1) * 0.5 + 0.5; // 0→1, snappy

            // beat makes ALL stars flash simultaneously — like a pulse
            const brightness = Math.min(1, twinkle * (0.5 + bass * 0.35) + beatFlash * 0.7);

            // size tiers: 60% tiny, 30% medium, 10% large
            const tier = si % 10;
            const baseSize = tier < 6 ? 0.5 : tier < 9 ? 1.1 : 2.0;
            const size2 = baseSize * (0.4 + twinkle * 0.9);

            // colour: 65% cool white, 15% blue, 10% gold, 10% purple/pink
            const ct = si % 20;
            const hh  = ct < 13 ? 0   : ct < 16 ? 210 : ct < 18 ? 45 : 290;
            const sat = ct < 13 ? 5   : ct < 16 ? 80  : ct < 18 ? 90 : 75;

            if (brightness < 0.05) continue; // skip invisible stars — big perf win

            c.fillStyle = `hsla(${hh},${sat}%,97%,${brightness})`;
            c.beginPath(); c.arc(sx, sy, size2, 0, Math.PI*2); c.fill();

            // large & medium stars get a cross-spike sparkle when bright
            if (size2 > 1.0 && twinkle > 0.6) {
              const spikeLen = size2 * (3 + twinkle * 6);
              const alpha = (twinkle - 0.6) * 2.5 * brightness;
              c.strokeStyle = `hsla(${hh},${sat}%,98%,${alpha})`;
              c.lineWidth = 0.7;
              c.beginPath();
              c.moveTo(sx - spikeLen, sy); c.lineTo(sx + spikeLen, sy);
              c.moveTo(sx, sy - spikeLen); c.lineTo(sx, sy + spikeLen);
              c.stroke();
              // glow halo
              const glow = c.createRadialGradient(sx, sy, 0, sx, sy, size2 * 5);
              glow.addColorStop(0, `hsla(${hh},${sat}%,98%,${brightness * 0.5})`);
              glow.addColorStop(1, 'rgba(0,0,0,0)');
              c.fillStyle = glow;
              c.beginPath(); c.arc(sx, sy, size2 * 5, 0, Math.PI*2); c.fill();
            }
          }

          // ── Layer 2: 400 warp-tunnel stars flying outward ─────────────────
          const WARP = 400;
          for (let wi=0; wi<WARP; wi++) {
            const seed = wi * 1.618;
            const angle = (seed * 137.508) % (Math.PI*2);
            const phase = ((seed * 0.07 + t * warpSpeed * 0.014) % 1);
            const dist = phase * Math.max(cw, ch) * 0.78;
            const x2 = cosmoCx + Math.cos(angle) * dist;
            const y2 = cosmoCy + Math.sin(angle) * dist;
            const size3 = phase * phase * (2.5 + bass * 5 + beat * 3);
            const bright2 = phase * phase;
            const hh2 = (hue + wi * 9) % 360;

            // streak trail — longer & brighter with bass
            const trailLen = phase * (20 + bass * 80 + beat * 40);
            const tx2 = cosmoCx + Math.cos(angle) * Math.max(0, dist - trailLen);
            const ty2 = cosmoCy + Math.sin(angle) * Math.max(0, dist - trailLen);
            const trailG = c.createLinearGradient(tx2, ty2, x2, y2);
            trailG.addColorStop(0, 'rgba(255,255,255,0)');
            trailG.addColorStop(0.6, `hsla(${hh2},70%,90%,${bright2 * 0.3})`);
            trailG.addColorStop(1, `hsla(${hh2},90%,98%,${bright2 * 0.9})`);
            c.strokeStyle = trailG;
            c.lineWidth = Math.max(0.5, size3 * 0.6);
            c.beginPath(); c.moveTo(tx2, ty2); c.lineTo(x2, y2); c.stroke();

            // star core
            c.fillStyle = `hsla(${hh2},50%,98%,${bright2})`;
            c.beginPath(); c.arc(x2, y2, Math.max(0.3, size3), 0, Math.PI*2); c.fill();
          }

          // ── Layer 3: beat-triggered nova flash from random stars ──────────
          if (beat > 0.3) {
            const novaCount = Math.floor(beat * 8);
            for (let ni=0; ni<novaCount; ni++) {
              const nx = ((Math.sin((ni+Math.floor(t*10)) * 93.7) * 0.5 + 0.5)) * cw;
              const ny = ((Math.cos((ni+Math.floor(t*10)) * 157.3) * 0.5 + 0.5)) * ch;
              const nr = beat * 40 + ni * 5;
              const ng = c.createRadialGradient(nx, ny, 0, nx, ny, nr);
              ng.addColorStop(0, `hsla(${(hue+ni*40)%360},100%,100%,${beat * 0.9})`);
              ng.addColorStop(0.3, `hsla(${(hue+ni*40)%360},80%,80%,${beat * 0.4})`);
              ng.addColorStop(1, 'rgba(0,0,0,0)');
              c.fillStyle = ng;
              c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI*2); c.fill();
            }
          }

          // ── Centre lens flare / warp core glow ───────────────────────────
          const coreR2 = 6 + bass * 25 + beat * 15;
          const cg2 = c.createRadialGradient(cosmoCx, cosmoCy, 0, cosmoCx, cosmoCy, coreR2 * 4);
          cg2.addColorStop(0, `rgba(255,255,255,${0.7 + bass * 0.3})`);
          cg2.addColorStop(0.15, `hsla(${hue},90%,85%,${0.3 + bass * 0.3})`);
          cg2.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = cg2;
          c.beginPath(); c.arc(cosmoCx, cosmoCy, coreR2 * 4, 0, Math.PI*2); c.fill();

        } else if (m === 36) {
          // ── GALAXY SPIN: spiral arms of a rotating galaxy ─────────────────
          c.fillStyle='rgba(0,0,8,0.18)'; c.fillRect(0,0,cw,ch);
          const arms = 3;
          const particlesPerArm = 180;
          const galRot = t * (0.12 + bass * 0.25);
          for (let arm=0; arm<arms; arm++) {
            const armOffset = (arm / arms) * Math.PI * 2;
            for (let pi=0; pi<particlesPerArm; pi++) {
              const frac = pi / particlesPerArm;
              const armAngle = armOffset + frac * Math.PI * 4 + galRot;
              const radius = frac * Math.min(cw,ch) * 0.44 * (1 + bass * 0.15);
              // scatter perpendicular to arm
              const scatter = (Math.sin(pi * 7.3 + arm * 3.1) * 0.12 + Math.cos(pi * 5.1) * 0.06) * radius;
              const px = cosmoCx + Math.cos(armAngle) * radius + Math.cos(armAngle + Math.PI/2) * scatter;
              const py = cosmoCy + Math.sin(armAngle) * radius + Math.sin(armAngle + Math.PI/2) * scatter;
              const brightness = 0.15 + (1-frac) * 0.7 + bass * 0.2;
              const hh = (200 + arm * 60 + frac * 80 + hue * 0.3) % 360;
              const sz = (1 - frac) * (3 + bass * 5) + 0.5;
              const g = c.createRadialGradient(px,py,0,px,py,sz*2);
              g.addColorStop(0, `hsla(${hh},90%,90%,${brightness})`);
              g.addColorStop(1, 'rgba(0,0,0,0)');
              c.fillStyle = g;
              c.beginPath(); c.arc(px, py, sz*2, 0, Math.PI*2); c.fill();
            }
          }
          // bright galactic core
          const coreR = 18 + bass * 40 + beat * 20;
          const cg = c.createRadialGradient(cosmoCx,cosmoCy,0,cosmoCx,cosmoCy,coreR*2.5);
          cg.addColorStop(0, `hsla(${(hue+40)%360},100%,98%,0.95)`);
          cg.addColorStop(0.3, `hsla(${hue},80%,75%,0.5)`);
          cg.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle=cg; c.beginPath(); c.arc(cosmoCx,cosmoCy,coreR*2.5,0,Math.PI*2); c.fill();

        } else if (m === 37) {
          // ── NEBULA CLOUD: layered volumetric gas clouds ───────────────────
          c.fillStyle='rgba(0,0,12,0.22)'; c.fillRect(0,0,cw,ch);
          // layered blob passes
          const layers = [
            { hh: (hue+0)%360,   scale: 1.0, speed: 0.07, alpha: 0.12 },
            { hh: (hue+60)%360,  scale: 0.7, speed: 0.11, alpha: 0.15 },
            { hh: (hue+140)%360, scale: 0.5, speed: 0.17, alpha: 0.18 },
            { hh: (hue+200)%360, scale: 0.35,speed: 0.25, alpha: 0.22 },
          ];
          for (const layer of layers) {
            for (let bi=0; bi<14; bi++) {
              const bx = cosmoCx + Math.sin(bi*1.7 + t*layer.speed + layer.hh*0.01) * cw * 0.38 * layer.scale;
              const by = cosmoCy + Math.cos(bi*2.3 + t*layer.speed*0.7) * ch * 0.35 * layer.scale;
              const br = (60 + Math.abs(Math.sin(bi*3.1+t*0.05))*120) * layer.scale * (1 + bass*0.5);
              const bg2 = c.createRadialGradient(bx,by,0,bx,by,br);
              bg2.addColorStop(0, `hsla(${layer.hh},90%,65%,${layer.alpha + bass*0.08})`);
              bg2.addColorStop(0.5, `hsla(${(layer.hh+30)%360},80%,45%,${layer.alpha*0.5})`);
              bg2.addColorStop(1, 'rgba(0,0,0,0)');
              c.fillStyle=bg2; c.beginPath(); c.arc(bx,by,br,0,Math.PI*2); c.fill();
            }
          }
          // embedded stars
          for (let si=0; si<80; si++) {
            const sx = (Math.sin(si*127.1)*0.5+0.5)*cw;
            const sy = (Math.cos(si*311.7)*0.5+0.5)*ch;
            const ss = 0.5 + Math.abs(Math.sin(si*7.3+t*2))*2*bass;
            c.fillStyle=`rgba(255,255,255,${0.3+Math.abs(Math.sin(si+t))*0.6})`;
            c.beginPath(); c.arc(sx,sy,ss,0,Math.PI*2); c.fill();
          }

        } else if (m === 38) {
          // ── BLACK HOLE: gravitational lensing accretion disk ──────────────
          c.fillStyle='rgba(0,0,4,0.35)'; c.fillRect(0,0,cw,ch);
          const bhR = 28 + bass * 12;
          const diskR = Math.min(cw,ch) * 0.38 * (1 + bass * 0.2);
          // accretion disk rings
          const diskRings = 60;
          for (let ri=diskRings; ri>=0; ri--) {
            const frac = ri / diskRings;
            const r2 = bhR + frac * (diskR - bhR);
            const hh = (hue + frac * 120 + t * 40) % 360;
            const lit = 30 + frac * 50;
            const alpha = (1 - frac) * 0.9 + bass * 0.1;
            const wobble = Math.sin(frac * 8 + t * 3) * 0.25 + 1;
            c.strokeStyle = `hsla(${hh},100%,${lit}%,${alpha * wobble})`;
            c.lineWidth = 2 + (1-frac) * 6 + bass * 4;
            c.beginPath();
            // flattened ellipse for disk perspective
            c.ellipse(cosmoCx, cosmoCy, r2, r2 * 0.28, t * 0.04, 0, Math.PI*2);
            c.stroke();
          }
          // relativistic jet
          for (let ji=0; ji<2; ji++) {
            const jDir = ji === 0 ? -1 : 1;
            const jLen = ch * 0.42 * (1 + bass * 0.6);
            const jg = c.createLinearGradient(cosmoCx, cosmoCy, cosmoCx, cosmoCy + jDir * jLen);
            jg.addColorStop(0, `hsla(${(hue+180)%360},100%,90%,${0.8+bass*0.2})`);
            jg.addColorStop(0.4, `hsla(${(hue+160)%360},90%,65%,0.3)`);
            jg.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle=jg;
            const jw = 4 + bass * 8;
            c.beginPath();
            c.moveTo(cosmoCx-jw, cosmoCy);
            c.quadraticCurveTo(cosmoCx-jw*2, cosmoCy+jDir*jLen*0.5, cosmoCx, cosmoCy+jDir*jLen);
            c.quadraticCurveTo(cosmoCx+jw*2, cosmoCy+jDir*jLen*0.5, cosmoCx+jw, cosmoCy);
            c.fill();
          }
          // event horizon
          c.fillStyle='#000'; c.beginPath(); c.arc(cosmoCx,cosmoCy,bhR,0,Math.PI*2); c.fill();
          const ehG = c.createRadialGradient(cosmoCx,cosmoCy,bhR*0.7,cosmoCx,cosmoCy,bhR*1.8);
          ehG.addColorStop(0,'rgba(0,0,0,1)'); ehG.addColorStop(1,'rgba(0,0,0,0)');
          c.fillStyle=ehG; c.beginPath(); c.arc(cosmoCx,cosmoCy,bhR*1.8,0,Math.PI*2); c.fill();
          // photon ring
          c.strokeStyle=`hsla(${(hue+60)%360},100%,95%,${0.7+bass*0.3})`;
          c.lineWidth = 1.5+bass*2;
          c.beginPath(); c.arc(cosmoCx,cosmoCy,bhR*1.35,0,Math.PI*2); c.stroke();

        } else if (m === 39) {
          // ── AURORA: northern lights curtains ──────────────────────────────
          c.fillStyle='rgba(0,2,10,0.25)'; c.fillRect(0,0,cw,ch);
          const curtains = 5;
          for (let ci=0; ci<curtains; ci++) {
            const cx3 = (ci / curtains) * cw + (cw / curtains) * 0.5;
            const hh = (160 + ci * 30 + hue * 0.4) % 360;
            const bandW = cw / curtains * (0.7 + bass * 0.5);
            const height = ch * (0.4 + mid * 0.4 + Math.abs(Math.sin(ci+t*0.3)) * 0.25);
            const topY = ch * 0.08 + Math.sin(ci * 2.1 + t * 0.5) * ch * 0.1;
            // multiple vertical wave columns per curtain
            const cols5 = 12;
            for (let wv=0; wv<cols5; wv++) {
              const wx = cx3 - bandW/2 + (wv/cols5)*bandW;
              const waveX = Math.sin(wv * 0.9 + t * 0.8 + ci) * 18 * bass;
              const wh = height * (0.5 + Math.abs(Math.sin(wv*1.3+t*0.6+ci))*0.5);
              const ag = c.createLinearGradient(wx+waveX, topY, wx+waveX, topY+wh);
              ag.addColorStop(0, 'rgba(0,0,0,0)');
              ag.addColorStop(0.15, `hsla(${hh},100%,70%,${0.12+bass*0.15})`);
              ag.addColorStop(0.5, `hsla(${(hh+25)%360},90%,55%,${0.18+mid*0.12})`);
              ag.addColorStop(0.85, `hsla(${(hh+50)%360},80%,40%,${0.08+bass*0.08})`);
              ag.addColorStop(1, 'rgba(0,0,0,0)');
              c.fillStyle=ag;
              c.fillRect(wx+waveX-bandW/cols5, topY, bandW/cols5*1.5, wh);
            }
          }
          // background stars
          for (let si=0; si<120; si++) {
            const sx = (Math.sin(si*93.7)*0.5+0.5)*cw;
            const sy = (Math.cos(si*157.3)*0.5+0.5)*ch*0.65;
            const ss2 = 0.4+Math.abs(Math.sin(si*3.7+t))*1.2;
            c.fillStyle=`rgba(255,255,255,${0.2+Math.abs(Math.sin(si*2.1+t*0.5))*0.5})`;
            c.beginPath(); c.arc(sx,sy,ss2,0,Math.PI*2); c.fill();
          }
          // faint ground glow
          const groundG = c.createLinearGradient(0,ch*0.75,0,ch);
          groundG.addColorStop(0,'rgba(0,0,0,0)');
          groundG.addColorStop(1,`hsla(${(160+hue*0.2)%360},60%,8%,0.6)`);
          c.fillStyle=groundG; c.fillRect(0,ch*0.75,cw,ch*0.25);
        }
      }

      }; // end renderScene

      // ── TRANSITION ENGINE ─────────────────────────────────────────────────
      const morphT = morphRef.current;
      const eased = morphT < 0.5 ? 2*morphT*morphT : 1-Math.pow(-2*morphT+2,2)/2;

      // Drive purely off morphRef — immune to prevMode/curMode ref equality race
      const isMorphing = morphT < 0.999;
      // Once morph completes, sync prevMode so next transition has correct "from"
      if (!isMorphing) prevModeRef.current = modeRef.current;

      if (isMorphing) {
        renderScene(ctxB, prevModeRef.current); // OLD → bufB
        renderScene(ctxA, modeRef.current);     // NEW → bufA

        const style = (transitionTypeRef.current) % 20;

        ctx.clearRect(0,0,cw,ch);

        if (style === 0) {
          // ── CROSSFADE ─────────────────────────────────────────────────────
          ctx.globalAlpha = 1;     ctx.drawImage(bufB, 0,0);
          ctx.globalAlpha = eased; ctx.drawImage(bufA, 0,0);
          ctx.globalAlpha = 1;

        } else if (style === 1) {
          // ── MORPHING: warp-dissolve ────────────────────────────────────────
          ctx.save();
          ctx.globalAlpha = 1 - eased;
          const sc1 = 1 - eased * 0.25;
          ctx.translate(cw/2, ch/2); ctx.rotate(eased * 0.4); ctx.scale(sc1, sc1);
          ctx.drawImage(bufB, -cw/2, -ch/2);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = eased;
          const sc2 = 0.75 + eased * 0.25;
          ctx.translate(cw/2, ch/2); ctx.rotate((eased-1) * 0.4); ctx.scale(sc2, sc2);
          ctx.drawImage(bufA, -cw/2, -ch/2);
          ctx.restore();

        } else if (style === 2) {
          // ── SLICE WIPE: vertical slices reveal ────────────────────────────
          const slices = 20;
          const sw2 = cw / slices;
          for (let s=0; s<slices; s++) {
            const delay = (s / slices) * 0.4;
            const localT = Math.max(0, Math.min(1, (eased - delay) / 0.6));
            const smooth = localT < 0.5 ? 2*localT*localT : 1-Math.pow(-2*localT+2,2)/2;
            const sx = s * sw2;
            ctx.drawImage(bufB, sx, 0, sw2, ch, sx, ch * smooth, sw2, ch);
            ctx.drawImage(bufA, sx, 0, sw2, ch, sx, -ch * (1-smooth), sw2, ch);
          }

        } else if (style === 3) {
          // ── PIXEL REVEAL: radial checker ──────────────────────────────────
          ctx.drawImage(bufB, 0,0);
          const gridSize = 6;
          const cols2 = Math.ceil(cw / gridSize), rows2 = Math.ceil(ch / gridSize);
          for (let r=0; r<rows2; r++) {
            for (let c2=0; c2<cols2; c2++) {
              const dx = (c2/cols2 - 0.5), dy = (r/rows2 - 0.5);
              const dist = Math.sqrt(dx*dx+dy*dy) * 1.4;
              const localT = Math.max(0, Math.min(1, (eased * 1.8) - dist));
              if (localT > 0) {
                ctx.globalAlpha = localT;
                ctx.drawImage(bufA, c2*gridSize, r*gridSize, gridSize, gridSize,
                                    c2*gridSize, r*gridSize, gridSize, gridSize);
              }
            }
          }
          ctx.globalAlpha = 1;

        } else if (style === 4) {
          // ── RIPPLE DISSOLVE: liquid wave warp ────────────────────────────
          ctx.globalAlpha = 1 - eased;
          ctx.drawImage(bufB, 0,0);
          ctx.globalAlpha = 1;
          const tmpC = document.createElement('canvas');
          tmpC.width = cw; tmpC.height = ch;
          const tmpX = tmpC.getContext('2d')!;
          for (let y2=0; y2<ch; y2+=3) {
            const wave = Math.sin(y2 * 0.03 + t * 6) * (1-eased) * 40;
            tmpX.drawImage(bufA, 0, y2, cw, 3, wave, y2, cw, 3);
          }
          ctx.globalAlpha = eased;
          ctx.drawImage(tmpC, 0,0);
          ctx.globalAlpha = 1;
          if (eased > 0.2 && eased < 0.8) {
            const fringe = Math.sin(eased * Math.PI) * 8;
            ctx.globalCompositeOperation = 'screen';
            ctx.globalAlpha = 0.15;
            ctx.drawImage(bufA, fringe, 0);
            ctx.drawImage(bufA, -fringe, 0);
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = 1;
          }

        } else if (style === 5) {
          // ── ZOOM BURST: old explodes outward, new zooms in from tiny ──────
          ctx.save();
          ctx.globalAlpha = 1 - eased;
          const zsc1 = 1 + eased * 0.6;
          ctx.translate(cw/2, ch/2); ctx.scale(zsc1, zsc1);
          ctx.drawImage(bufB, -cw/2, -ch/2);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = eased;
          const zsc2 = 0.4 + eased * 0.6;
          ctx.translate(cw/2, ch/2); ctx.scale(zsc2, zsc2);
          ctx.drawImage(bufA, -cw/2, -ch/2);
          ctx.restore();

        } else if (style === 6) {
          // ── SHATTER: triangular tiles scatter away ────────────────────────
          ctx.drawImage(bufB, 0,0);
          const tileW = cw / 8, tileH = ch / 5;
          for (let tr=0; tr<5; tr++) {
            for (let tc2=0; tc2<8; tc2++) {
              const delay = ((tr+tc2) / 13) * 0.5;
              const localT = Math.max(0, Math.min(1, (eased - delay) / 0.5));
              if (localT <= 0) continue;
              const tx2 = tc2 * tileW, ty2 = tr * tileH;
              const cx2 = tx2 + tileW/2, cy2 = ty2 + tileH/2;
              const angle = Math.atan2(cy2 - ch/2, cx2 - cw/2);
              const dist2 = localT * localT * 120;
              ctx.save();
              ctx.globalAlpha = 1 - localT;
              ctx.translate(cx2 + Math.cos(angle)*dist2, cy2 + Math.sin(angle)*dist2);
              ctx.rotate(localT * 0.8);
              ctx.drawImage(bufB, tx2, ty2, tileW, tileH, -tileW/2, -tileH/2, tileW, tileH);
              ctx.restore();
              ctx.save();
              ctx.globalAlpha = localT;
              ctx.drawImage(bufA, tx2, ty2, tileW, tileH, tx2, ty2, tileW, tileH);
              ctx.restore();
            }
          }

        } else if (style === 7) {
          // ── IRIS: circular reveal from centre ────────────────────────────
          ctx.drawImage(bufB, 0,0);
          const maxR2 = Math.sqrt(cw*cw + ch*ch) / 2;
          const irisR = eased * maxR2 * 1.05;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cw/2, ch/2, irisR, 0, Math.PI*2);
          ctx.clip();
          ctx.drawImage(bufA, 0,0);
          ctx.restore();
          // soft edge
          const irg = ctx.createRadialGradient(cw/2, ch/2, irisR*0.85, cw/2, ch/2, irisR);
          irg.addColorStop(0, 'rgba(0,0,0,0)');
          irg.addColorStop(1, 'rgba(0,0,0,0.6)');
          ctx.fillStyle = irg;
          ctx.beginPath(); ctx.arc(cw/2, ch/2, irisR, 0, Math.PI*2); ctx.fill();

        } else if (style === 8) {
          // ── DIAGONAL WIPE: NW→SE reveal ──────────────────────────────────
          ctx.drawImage(bufB, 0,0);
          const diagOffset = eased * (cw + ch) * 1.1 - ch;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, diagOffset);
          ctx.lineTo(diagOffset + ch, 0);
          ctx.lineTo(cw, 0);
          ctx.lineTo(cw, ch);
          ctx.lineTo(0, ch);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(bufA, 0,0);
          ctx.restore();

        } else if (style === 9) {
          // ── GLITCH: RGB channel split + scanline flicker ─────────────────
          const phase = morphT;
          // base old frame fading
          ctx.globalAlpha = Math.max(0, 1 - eased * 1.5);
          ctx.drawImage(bufB, 0,0);
          ctx.globalAlpha = 1;
          // new frame with RGB channel separation
          const glitchAmt = Math.sin(phase * Math.PI) * 18;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = eased * 0.6;
          // red channel shifted left
          ctx.fillStyle = 'rgba(255,0,0,0.15)';
          ctx.drawImage(bufA, -glitchAmt, 0);
          // blue channel shifted right
          ctx.fillStyle = 'rgba(0,0,255,0.15)';
          ctx.drawImage(bufA, glitchAmt, 0);
          ctx.globalCompositeOperation = 'source-over';
          ctx.restore();
          // composited new frame
          ctx.globalAlpha = eased;
          ctx.drawImage(bufA, 0,0);
          ctx.globalAlpha = 1;
          // scanline flicker overlay
          if (eased < 0.85) {
            for (let sl=0; sl<ch; sl+=4) {
              if (Math.random() < 0.08 * (1 - eased)) {
                ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.07})`;
                ctx.fillRect(0, sl, cw, 2);
              }
            }
          }

        } else if (style === 10) {
          // ── PAGE TURN: right edge curls over like a book page ─────────────
          ctx.drawImage(bufB, 0,0);
          const curl = eased * cw;
          // shadow on old page
          const shadowG = ctx.createLinearGradient(cw - curl - 40, 0, cw - curl + 20, 0);
          shadowG.addColorStop(0, 'rgba(0,0,0,0)');
          shadowG.addColorStop(1, 'rgba(0,0,0,0.4)');
          ctx.fillStyle = shadowG;
          ctx.fillRect(cw - curl - 40, 0, 60, ch);
          // new page revealed underneath
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, cw - curl, ch);
          ctx.clip();
          ctx.drawImage(bufA, 0, 0);
          ctx.restore();
          // curling page face (old content, compressed)
          if (curl < cw) {
            ctx.save();
            ctx.translate(cw - curl, 0);
            ctx.scale(-curl / cw * 0.15 + 1, 1);
            ctx.globalAlpha = 1 - eased * 0.5;
            ctx.drawImage(bufB, 0, 0, cw, ch, 0, 0, cw, ch);
            // page edge highlight
            const edgeG = ctx.createLinearGradient(0, 0, 8, 0);
            edgeG.addColorStop(0, 'rgba(255,255,255,0.6)');
            edgeG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = edgeG;
            ctx.fillRect(0, 0, 8, ch);
            ctx.restore();
          }

        } else if (style === 11) {
          // ── KALEIDOSCOPE: rotational symmetry morph ───────────────────────
          const seg = 6;
          ctx.save();
          ctx.translate(cw/2, ch/2);
          for (let ki=0; ki<seg; ki++) {
            ctx.save();
            ctx.rotate((ki / seg) * Math.PI * 2 + eased * Math.PI);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            const ka = Math.PI * 2 / seg;
            ctx.arc(0, 0, Math.max(cw, ch), -ka/2, ka/2);
            ctx.closePath();
            ctx.clip();
            const kscale = 0.5 + eased * 0.5;
            ctx.scale(kscale, kscale);
            ctx.globalAlpha = ki % 2 === 0 ? 1 - eased * 0.5 : eased;
            ctx.drawImage(ki % 2 === 0 ? bufB : bufA, -cw/2, -ch/2);
            ctx.restore();
          }
          ctx.restore();

        } else if (style === 12) {
          // ── BURN: fire-like erosion from random bright pixels ─────────────
          ctx.drawImage(bufB, 0,0);
          // fire reveal: rows burn from bottom, staggered by column noise
          const rows = 40;
          const rowH2 = ch / rows;
          for (let br=rows-1; br>=0; br--) {
            const rowProgress = (eased * 1.4) - (br / rows) * 0.4;
            const localT = Math.max(0, Math.min(1, rowProgress));
            if (localT <= 0) continue;
            const y2 = br * rowH2;
            ctx.globalAlpha = localT;
            ctx.drawImage(bufA, 0, y2, cw, rowH2, 0, y2, cw, rowH2);
            // fire edge glow
            if (localT < 0.85) {
              const fireH = rowH2 * 1.5;
              const fireG = ctx.createLinearGradient(0, y2 - fireH, 0, y2 + rowH2);
              fireG.addColorStop(0, 'rgba(255,140,0,0)');
              fireG.addColorStop(0.5, `rgba(255,80,0,${(1-localT)*0.7})`);
              fireG.addColorStop(1, 'rgba(255,200,0,0)');
              ctx.globalAlpha = 1;
              ctx.fillStyle = fireG;
              ctx.fillRect(0, y2 - fireH, cw, rowH2 + fireH);
            }
          }
          ctx.globalAlpha = 1;

        } else if (style === 13) {
          // ── MATRIX RAIN: digital green characters fall to reveal ──────────
          ctx.drawImage(bufB, 0,0);
          const cols3 = Math.ceil(cw / 16);
          for (let mc=0; mc<cols3; mc++) {
            const colDelay = (mc / cols3) * 0.5;
            const colT = Math.max(0, Math.min(1, (eased - colDelay) / 0.5));
            if (colT <= 0) continue;
            const revealY = colT * ch;
            // reveal new frame in this column strip
            ctx.globalAlpha = colT;
            ctx.drawImage(bufA, mc*16, 0, 16, revealY, mc*16, 0, 16, revealY);
            ctx.globalAlpha = 1;
            // falling character at the frontier
            if (colT < 0.98) {
              ctx.font = 'bold 12px monospace';
              ctx.fillStyle = `rgba(74,222,128,${0.9 * (1-colT) + 0.1})`;
              const charY = revealY;
              for (let cr=0; cr<6; cr++) {
                ctx.globalAlpha = Math.max(0, (1 - cr * 0.18)) * (1 - colT * 0.5);
                ctx.fillText(String.fromCharCode(0x30A0 + Math.floor(Math.random()*96)), mc*16, charY - cr*14);
              }
              ctx.globalAlpha = 1;
            }
          }

        } else if (style === 14) {
          // ── VORTEX: spiral spin-pull into centre, new spins out ───────────
          ctx.drawImage(bufB, 0,0);
          ctx.save();
          ctx.translate(cw/2, ch/2);
          // old frame spirals inward
          const vAngle = eased * Math.PI * 3;
          const vScale = 1 - eased * 0.85;
          ctx.rotate(vAngle);
          ctx.scale(vScale, vScale);
          ctx.globalAlpha = 1 - eased;
          ctx.drawImage(bufB, -cw/2, -ch/2);
          ctx.restore();
          // new frame spirals out from centre
          ctx.save();
          ctx.translate(cw/2, ch/2);
          const vAngle2 = (eased - 1) * Math.PI * 2;
          const vScale2 = eased;
          ctx.rotate(vAngle2);
          ctx.scale(vScale2, vScale2);
          ctx.globalAlpha = eased;
          ctx.drawImage(bufA, -cw/2, -ch/2);
          ctx.restore();

        } else if (style === 15) {
          // ── TV STATIC: white noise blanket then new image emerges ─────────
          const staticPhase = Math.sin(eased * Math.PI); // peaks at midpoint
          ctx.globalAlpha = 1 - Math.min(eased * 2, 1);
          ctx.drawImage(bufB, 0,0);
          ctx.globalAlpha = Math.max(0, eased * 2 - 1);
          ctx.drawImage(bufA, 0,0);
          ctx.globalAlpha = 1;
          // static noise layer
          if (staticPhase > 0.05) {
            const noiseData = ctx.createImageData(cw, ch);
            const d = noiseData.data;
            for (let ni=0; ni<d.length; ni+=4) {
              const v2 = Math.random() * 255;
              d[ni]=v2; d[ni+1]=v2; d[ni+2]=v2;
              d[ni+3] = staticPhase * 220;
            }
            ctx.putImageData(noiseData, 0, 0);
          }

        } else if (style === 16) {
          // ── MOSAIC: tiles grow from random seeds ──────────────────────────
          ctx.drawImage(bufB, 0,0);
          const tileSize = Math.max(4, Math.floor(80 * (1 - eased)));
          const cols4 = Math.ceil(cw / tileSize);
          const rows4 = Math.ceil(ch / tileSize);
          for (let mr=0; mr<rows4; mr++) {
            for (let mc2=0; mc2<cols4; mc2++) {
              // hash-based per-tile delay
              const hash = ((mr * 1973 + mc2 * 9001) % 100) / 100;
              const localT = Math.max(0, Math.min(1, (eased * 1.5) - hash * 0.5));
              if (localT <= 0) continue;
              ctx.globalAlpha = localT;
              ctx.drawImage(bufA, mc2*tileSize, mr*tileSize, tileSize, tileSize,
                                  mc2*tileSize, mr*tileSize, tileSize, tileSize);
            }
          }
          ctx.globalAlpha = 1;

        } else if (style === 17) {
          // ── SHOCKWAVE: radial ring sweeps outward revealing new ───────────
          ctx.drawImage(bufB, 0,0);
          const maxRad = Math.sqrt(cw*cw + ch*ch) / 2 * 1.1;
          const waveRad = eased * maxRad;
          const waveW = maxRad * 0.25;
          // revealed area inside wave
          ctx.save();
          ctx.beginPath();
          ctx.arc(cw/2, ch/2, Math.max(0, waveRad - waveW), 0, Math.PI*2);
          ctx.clip();
          ctx.drawImage(bufA, 0, 0);
          ctx.restore();
          // bright shockwave ring
          if (waveRad > 0 && waveRad < maxRad + waveW) {
            const ringG = ctx.createRadialGradient(cw/2,ch/2, Math.max(0,waveRad-waveW), cw/2,ch/2, waveRad+8);
            ringG.addColorStop(0, 'rgba(255,255,255,0)');
            ringG.addColorStop(0.6, `rgba(255,255,255,${0.7 * (1-eased*0.5)})`);
            ringG.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = ringG;
            ctx.beginPath(); ctx.arc(cw/2,ch/2,waveRad+8,0,Math.PI*2); ctx.fill();
          }

        } else if (style === 18) {
          // ── INK BLEED: dark ink spreads and dissolves into new ────────────
          ctx.drawImage(bufB, 0,0);
          // multiple ink blob origins
          const blobs = [{x:0.3,y:0.4},{x:0.7,y:0.6},{x:0.5,y:0.2},{x:0.2,y:0.8},{x:0.8,y:0.3}];
          blobs.forEach((b, bi) => {
            const delay = bi * 0.1;
            const localT = Math.max(0, Math.min(1, (eased - delay) / 0.7));
            if (localT <= 0) return;
            const bRad = localT * Math.max(cw, ch) * 0.65;
            ctx.save();
            ctx.beginPath();
            ctx.arc(b.x * cw, b.y * ch, bRad, 0, Math.PI*2);
            ctx.clip();
            ctx.globalAlpha = localT;
            ctx.drawImage(bufA, 0,0);
            // dark ink halo at edge
            const inkG = ctx.createRadialGradient(b.x*cw, b.y*ch, bRad*0.8, b.x*cw, b.y*ch, bRad);
            inkG.addColorStop(0, 'rgba(0,0,0,0)');
            inkG.addColorStop(1, `rgba(0,0,0,${0.5 * (1-localT)})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = inkG;
            ctx.fillRect(0,0,cw,ch);
            ctx.restore();
          });

        } else if (style === 19) {
          // ── FILM BURN: bright overexposure with film grain ────────────────
          ctx.globalAlpha = 1 - eased;
          ctx.drawImage(bufB, 0,0);
          ctx.globalAlpha = eased;
          ctx.drawImage(bufA, 0,0);
          ctx.globalAlpha = 1;
          // white flash peak at midpoint
          const flashPeak = Math.sin(eased * Math.PI);
          if (flashPeak > 0.05) {
            ctx.fillStyle = `rgba(255,245,200,${flashPeak * 0.75})`;
            ctx.fillRect(0,0,cw,ch);
          }
          // film grain
          if (flashPeak > 0.1) {
            for (let fg=0; fg<300; fg++) {
              const gx = Math.random() * cw, gy = Math.random() * ch;
              const gs = Math.random() * 3;
              ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.3 * flashPeak})`;
              ctx.fillRect(gx, gy, gs, gs);
            }
          }
          // vignette darkening at edges
          const vigG = ctx.createRadialGradient(cw/2,ch/2, ch*0.3, cw/2,ch/2, ch*0.75);
          vigG.addColorStop(0, 'rgba(0,0,0,0)');
          vigG.addColorStop(1, `rgba(0,0,0,${flashPeak * 0.4})`);
          ctx.fillStyle = vigG;
          ctx.fillRect(0,0,cw,ch);
        }

      } else {
        // no transition — render direct to main canvas
        renderScene(ctx, modeRef.current);
      }

      // ── EQ bar overlay ────────────────────────────────────────────────────
      const ew=eq.width, eh=eq.height;
      eqCtx.clearRect(0,0,ew,eh);
      const fade=eqCtx.createLinearGradient(0,0,0,eh);
      fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(.45,'rgba(0,0,0,.92)');
      eqCtx.fillStyle=fade; eqCtx.fillRect(0,0,ew,eh);
      const bars=80, bw2=ew/bars;
      for(let i=0;i<bars;i++){
        const bin=Math.floor(i/bars*fd.length*.75);
        const v=fd[bin]/255;
        const bh=Math.max(2,v*eh*.88);
        eqCtx.fillStyle=`hsl(${(hue+i*3.5)%360},85%,${48+v*22}%)`;
        eqCtx.fillRect(i*bw2+.5,eh-bh,bw2-1,bh);
      }
    };

    // Delay one frame so canvas parent has laid out and has non-zero dimensions
    const startTimer = setTimeout(() => {
      resize();
      rafRef.current = requestAnimationFrame(draw);
    }, 150);
    // second resize pass in case first was too early
    const resizeTimer = setTimeout(resize, 400);
    return ()=>{ clearTimeout(startTimer); clearTimeout(resizeTimer); cancelAnimationFrame(rafRef.current); window.removeEventListener('resize',resize); };
  },[]);

  const currentGroupIdx = VIZ_GROUPS.findIndex(g=>g.modes.includes(ALL_MODES[mode]));

  return (
    <div ref={vizRootRef} className="viz-root absolute inset-0 overflow-hidden" style={{background:'transparent',pointerEvents:'none'}}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:active?1:0,pointerEvents:'none'}}/>
      <canvas ref={eqRef} style={{position:'absolute',bottom:0,left:0,right:0,width:'100%',height:56,pointerEvents:'none',opacity:0}}/>

      {/* ── visualizer group/mode picker — hides after 3s of no mouse activity ── */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1" style={{zIndex:100,opacity:pickerVisible?1:0,transition:'opacity 0.5s ease',pointerEvents:pickerVisible?'auto':'none'}} onClick={e=>e.stopPropagation()}>
        {VIZ_GROUPS.map((g,gi)=>(
          <div key={g.group} className="relative">
            <button
              onClick={()=>setGroupOpen(groupOpen===gi?null:gi)}
              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border ${currentGroupIdx===gi?'text-white border-transparent':'bg-black/60 border-white/10 text-slate-500 hover:text-white'}`}
              style={currentGroupIdx===gi?{background:GROUP_COLORS[gi],boxShadow:`0 0 12px ${GROUP_COLORS[gi]}80`}:{}}>
              {g.group}
            </button>
            {groupOpen===gi&&(
              <div className="absolute top-full mt-1 left-0 bg-black/95 border border-white/10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[110px] z-30 shadow-2xl">
                {g.modes.map(mn=>{
                  const gidx=ALL_MODES.indexOf(mn);
                  return(
                    <button key={mn} onClick={()=>{setMode(gidx);setGroupOpen(null);onActivate&&onActivate(gidx);}}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-left transition-all ${mode===gidx?'text-white':'text-slate-500 hover:text-white hover:bg-white/5'}`}
                      style={mode===gidx?{background:GROUP_COLORS[gi]+'33',color:GROUP_COLORS[gi]}:{}}>
                      {mn}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {/* Auto shuffle button */}
        <button onClick={handleAutoToggle}
          className={`flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-lg border transition-all ${autoOn?'bg-yellow-500/20 border-yellow-500/40 text-yellow-300':'bg-black/60 border-white/10 text-slate-500 hover:text-yellow-300 hover:border-yellow-500/30'}`}>
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${autoOn?'bg-yellow-300 animate-pulse':'bg-slate-600'}`}/>
          <span className="text-[8px] font-black uppercase tracking-widest">Auto</span>
        </button>
        {/* Transition style picker — only visible when Auto is on */}
        {autoOn && (() => {
          const isAuto = transitionStyle === -1;
          const activeTs = isAuto ? AUTO_TRANSITION : TRANSITION_STYLES[transitionStyle];
          return (
            <div className="relative ml-1">
              <button onClick={e=>{e.stopPropagation();setTransitionOpen(p=>!p);}}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all bg-black/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                style={transitionOpen?{borderColor:'rgba(255,255,255,0.2)'}:{}}
                title="Transition style">
                <i className="fa-solid fa-film text-[8px]"/>
                <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline">
                  Transitions
                </span>
              </button>
              {transitionOpen&&(
                <div className="absolute top-full mt-1 right-0 bg-black/95 border border-white/10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[160px] z-30 shadow-2xl" onClick={e=>e.stopPropagation()}>
                  {/* Auto — always at top */}
                  <button onClick={()=>{setTransitionStyle(-1);setTransitionOpen(false);}}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-left transition-all ${isAuto?'text-white':'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    style={isAuto?{background:AUTO_TRANSITION.color+'22',color:AUTO_TRANSITION.color}:{}}>
                    <i className={`fa-solid ${AUTO_TRANSITION.icon} text-[9px]`} style={isAuto?{color:AUTO_TRANSITION.color}:{}}/>
                    {AUTO_TRANSITION.name}
                  </button>
                  {/* divider */}
                  <div className="h-px bg-white/10 my-0.5"/>
                  {TRANSITION_STYLES.map((ts,ti)=>(
                    <button key={ts.name} onClick={()=>{setTransitionStyle(ti);setTransitionOpen(false);}}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-left transition-all ${transitionStyle===ti?'text-white':'text-slate-500 hover:text-white hover:bg-white/5'}`}
                      style={transitionStyle===ti?{background:ts.color+'22',color:ts.color}:{}}>
                      <i className={`fa-solid ${ts.icon} text-[9px]`} style={transitionStyle===ti?{color:ts.color}:{}}/>
                      {ts.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────
const SHARED_MUSIC_KEY = 'integral_music_shared_v1';

// ─── Music Playlist Button & Panel ──────────────────────────────────────────
const MUSIC_PL_KEY = 'integral_music_playlists_v1';
interface MusicPL { id:string; name:string; owner:string; trackIds:string[]; createdAt:number; }
const getMusicPLs  = ():MusicPL[] => { try { return JSON.parse(localStorage.getItem(MUSIC_PL_KEY)||'[]'); } catch { return []; } };
const saveMusicPLs = (p:MusicPL[]) => { try { localStorage.setItem(MUSIC_PL_KEY, JSON.stringify(p)); } catch {} };

const MusicPlaylistButton: React.FC<{
  currentUser:string; tracks:any[]; currentTrackId?:string;
  onSelectTrack:(id:string)=>void; triggerAdd?:boolean;
}> = ({currentUser, tracks, currentTrackId, onSelectTrack, triggerAdd=false}) => {
  const [open,    setOpen]    = React.useState(false);
  const [pls,     setPls]     = React.useState<MusicPL[]>(()=>getMusicPLs());
  const [newName, setNewName] = React.useState('');
  const [activeId,setActiveId]= React.useState<string|null>(null);
  const mine = pls.filter(p=>p.owner===currentUser);

  const create = () => {
    const name = newName.trim();
    if(!name) return;
    const pl:MusicPL = {id:`mpl-${Date.now()}`,name,owner:currentUser,trackIds:[],createdAt:Date.now()};
    const next = [...getMusicPLs(), pl]; saveMusicPLs(next); setPls(next);
    setNewName('');
    setActiveId(pl.id);
  };
  const addTrack = (plId:string, tid:string) => { const next=getMusicPLs().map(p=>p.id===plId&&!p.trackIds.includes(tid)?{...p,trackIds:[...p.trackIds,tid]}:p); saveMusicPLs(next); setPls(next); };
  const removeTrack = (plId:string, tid:string) => { const next=getMusicPLs().map(p=>p.id===plId?{...p,trackIds:p.trackIds.filter(x=>x!==tid)}:p); saveMusicPLs(next); setPls(next); };
  const deletePl = (id:string) => { const next=getMusicPLs().filter(p=>p.id!==id); saveMusicPLs(next); setPls(next); if(activeId===id) setActiveId(null); };

  return (
    <div className="relative">
      {triggerAdd ? (
        <button
          onClick={()=>setOpen(v=>!v)}
          style={{width:32,height:32,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${open?'#7c3aed':'rgba(255,255,255,0.1)'}`,background:open?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.05)',color:open?'#a78bfa':'#94a3b8',cursor:'pointer',transition:'all 0.2s',marginLeft:4}}
          title="Add to my playlist"
        >
          <i className="fa-solid fa-plus text-xs"/>
        </button>
      ) : (
        <button
          onClick={()=>setOpen(v=>!v)}
          className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${open?'bg-purple-600 border-purple-500 text-white':'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}
          title="My Music Playlists"
        >
          <i className="fa-solid fa-list text-[11px]"/>
          {mine.length>0&&<span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 rounded-full text-[8px] font-black flex items-center justify-center border-2 border-black">{mine.length}</span>}
        </button>
      )}

      {open&&(
        <div className="absolute top-12 right-0 w-72 bg-slate-950 border border-white/10 rounded-2xl shadow-2xl z-[200] flex flex-col overflow-hidden" style={{maxHeight:420}}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">My Music Lists</p>
            <button onClick={()=>setOpen(false)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xs"/></button>
          </div>

          {/* Create */}
          <div className="px-3 py-2.5 border-b border-white/5 flex gap-2">
            <input
              value={newName} onChange={e=>setNewName(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&create()}
              placeholder="New list name..."
              className="flex-1 h-8 px-3 rounded-xl bg-black/60 border border-white/10 text-white text-[10px] font-bold placeholder-slate-700 focus:outline-none focus:border-purple-500/40 uppercase"
            />
            <button onClick={create} disabled={!newName.trim()} className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white disabled:opacity-30 hover:bg-purple-500 transition-all flex-shrink-0">
              <i className="fa-solid fa-plus text-[10px]"/>
            </button>
          </div>

          {/* Lists */}
          <div className="overflow-y-auto custom-scrollbar flex-1">
            {mine.length===0?(
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-700">
                <i className="fa-solid fa-music text-2xl"/>
                <p className="text-[8px] font-black uppercase tracking-widest">No lists yet</p>
              </div>
            ):(
              <div className="p-2 space-y-1.5">
                {mine.map(pl=>(
                  <div key={pl.id} className={`rounded-xl border transition-all ${activeId===pl.id?'border-purple-500/40 bg-purple-600/10':'border-white/5 hover:border-white/10'}`}>
                    <div className="flex items-center gap-2 px-3 py-2 cursor-pointer" onClick={()=>setActiveId(activeId===pl.id?null:pl.id)}>
                      <i className="fa-solid fa-list text-purple-400 text-[10px] flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-white truncate">{pl.name.replace(/celestial\s*meditation/gi,"Cel.Med")}</p>
                        <p className="text-[7px] text-slate-600 uppercase">{pl.trackIds.length} track{pl.trackIds.length!==1?'s':''}</p>
                      </div>
                      <button onClick={e=>{e.stopPropagation();deletePl(pl.id);}} className="text-slate-700 hover:text-red-400 transition-colors">
                        <i className="fa-solid fa-trash text-[8px]"/>
                      </button>
                    </div>

                    {activeId===pl.id&&(
                      <div className="border-t border-white/5 px-3 py-2 space-y-1">
                        {pl.trackIds.map(tid=>{
                          const t=tracks.find(x=>x.id===tid);
                          if(!t) return null;
                          return(
                            <div key={tid} className="flex items-center gap-2 group/ti">
                              <button onClick={()=>{onSelectTrack(tid);setOpen(false);}} className="flex-1 text-left text-[8px] font-bold text-slate-400 hover:text-white uppercase truncate transition-colors">
                                {t.artist} — {t.title}
                              </button>
                              <button onClick={()=>removeTrack(pl.id,tid)} className="opacity-0 group-hover/ti:opacity-100 text-slate-700 hover:text-red-400 transition-all">
                                <i className="fa-solid fa-xmark text-[8px]"/>
                              </button>
                            </div>
                          );
                        })}
                        {currentTrackId&&(
                          <div className="pt-1 border-t border-white/5 mt-1">
                            {pl.trackIds.includes(currentTrackId)?(
                              <p className="text-[7px] text-green-500 font-black uppercase tracking-widest flex items-center gap-1"><i className="fa-solid fa-check"/>In this list</p>
                            ):(
                              <button onClick={()=>addTrack(pl.id,currentTrackId)} className="w-full h-6 rounded-lg bg-purple-600/20 border border-purple-500/20 text-purple-400 text-[7px] font-black uppercase tracking-widest hover:bg-purple-600/30 transition-all flex items-center justify-center gap-1">
                                <i className="fa-solid fa-plus text-[7px]"/>Add current track
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


// ─── Track sanitisation — fixes iframe HTML stored as URL/artist/title ──────
const sanitiseTrack = (tr: any) => {
  let url = tr.url||'';
  const iframeSrc = url.match(/src=["']([^"']+)["']/i);
  if (iframeSrc) url = iframeSrc[1];
  // Fix double slashes e.g. https://audiomack.com//sakaturu/...
  // Fix double slashes anywhere in the URL after the protocol
  url = url.replace(/^(https?:\/\/)/, '@@PROTO@@').replace(/\/\/+/g, '/').replace('@@PROTO@@', 'https://');
  // Remove /embed/ path (we re-add it in getEmbedUrl correctly)
  if (url.includes('audiomack.com/embed/') && !url.includes('?src=')) {
    url = url.replace('audiomack.com/embed/', 'audiomack.com/');
  }
  const isBad = (s:string) => !s || /iframe/i.test(s) || s.startsWith('<') || s.toLowerCase().includes('src=');
  let artist = (tr.artist||'').replace(/<[^>]+>/g,'').replace(/src=["'][^"']+["']/gi,'').trim();
  let title  = (tr.title||'').replace(/<[^>]+>/g,'').replace(/src=["'][^"']+["']/gi,'').trim();
  if (url.includes('audiomack.com') && (isBad(artist) || isBad(title))) {
    const parts = url.replace(/[?#].*$/,'').replace(/https?:\/\/audiomack\.com\/(?:embed\/)?/,'').split('/').filter(Boolean);
    const toT = (s:string) => s.replace(/-/g,' ').replace(/\b\w/g,(c:string)=>c.toUpperCase());
    if (parts[0]) artist = toT(parts[0]);
    if (parts[2]) title  = toT(parts[2]);
  }
  title = (title||'').replace(/,?\s+by\s+.+$/i,'').trim()||title;
  return {...tr, url, artist, title};
};

// Returns a clean display name — hides auto-generated NEURAL_NODE IDs
const displayName = (user: string) =>
  !user || user.startsWith('NEURAL_NODE') ? 'Username' : user.replace(/_/g, ' ');

const MusicProgressBar: React.FC<{trackId:string;isPlaying:boolean;trackUrl:string}> = ({trackId,isPlaying,trackUrl}) => {
  const [elapsed, setElapsed] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const startRef = React.useRef<number>(0);
  const elapsedRef = React.useRef<number>(0);
  const rafRef = React.useRef<number>(0);
  const BARS = 60;

  React.useEffect(()=>{
    setElapsed(0); elapsedRef.current=0; setDuration(0);
    const vid = trackUrl.includes('youtu.be/') ? trackUrl.split('youtu.be/')[1]?.split(/[?&#]/)[0]
              : trackUrl.includes('v=') ? trackUrl.split('v=')[1]?.split(/[&#]/)[0] : '';
    if(vid) {
      fetch('/yt-api/youtube/v3/videos?part=contentDetails&id='+vid+'&key=AIzaSyD8RJ2blSlO3RkrmZhF1Khp6zzLnMrWvKI')
        .then(r=>r.json()).then(d=>{
          const iso=d?.items?.[0]?.contentDetails?.duration||'';
          const m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if(m) setDuration(((Number(m[1]||0)*3600)+(Number(m[2]||0)*60)+Number(m[3]||0)));
        }).catch(()=>{});
    } else if(trackUrl.includes('soundcloud.com')) {
      let scUrl=trackUrl; try{scUrl=new URL(trackUrl).origin+new URL(trackUrl).pathname;}catch{}
      fetch('https://soundcloud.com/oembed?url='+encodeURIComponent(scUrl)+'&format=json')
        .then(r=>r.json()).then(d=>{ if(d?.duration) setDuration(Math.round(d.duration/1000)); }).catch(()=>{});
    }
  },[trackId]);

  React.useEffect(()=>{
    if(isPlaying){
      startRef.current = Date.now() - elapsedRef.current*1000;
      const tick = () => {
        elapsedRef.current = (Date.now()-startRef.current)/1000;
        setElapsed(elapsedRef.current);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(rafRef.current);
    }
    return ()=>cancelAnimationFrame(rafRef.current);
  },[isPlaying]);

  const fmt = (s:number) => { const m=Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const useDuration = duration>0 ? duration : 600;
    const rect = e.currentTarget.getBoundingClientRect();
    const newPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newElapsed = newPct * useDuration;
    elapsedRef.current = newElapsed;
    setElapsed(newElapsed);
    startRef.current = Date.now() - newElapsed * 1000;
    const iframe = document.getElementById('music-main-player') as HTMLIFrameElement|null;
    if(iframe){
      try{ iframe.contentWindow?.postMessage(JSON.stringify({event:'command',func:'seekTo',args:[newElapsed,true]}),'*'); }catch{}
      try{ iframe.contentWindow?.postMessage(JSON.stringify({method:'seekTo',value:Math.floor(newElapsed*1000)}),'*'); }catch{}
    }
  };

  const effectiveDuration = duration>0 ? duration : 600; // default 10min if unknown
  const pct = Math.min(1, elapsed/effectiveDuration);
  const activeBars = Math.round(pct * BARS);

  return (
    <div style={{padding:'0 16px 10px',background:'linear-gradient(to top,rgba(0,0,0,0.9),transparent)'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{color:'#ff9500',fontSize:10,fontWeight:900,letterSpacing:'0.1em'}}>{fmt(elapsed)}</span>
        <span style={{color:'rgba(255,255,255,0.3)',fontSize:10,fontWeight:700}}>{duration>0?fmt(duration):'--:--'}</span>
      </div>
      <div onClick={seek} style={{display:'flex',alignItems:'flex-end',gap:2,height:44,cursor:'pointer',userSelect:'none'}}>
        {Array.from({length:BARS},(_,i)=>{
          const active = i < activeBars;
          const h = 20 + Math.abs(Math.sin(i*0.4+0.5)*Math.cos(i*0.25))*80;
          return (
            <div key={i} style={{
              flex:1,
              height:`${h}%`,
              borderRadius:2,
              background: active ? `hsl(${25+i*1.2},100%,${50+i*0.4}%)` : 'rgba(255,255,255,0.12)',
              transition:'background 0.15s',
              minWidth:2,
            }}/>
          );
        })}
      </div>
    </div>
  );
};


const MusicApp: React.FC<MusicAppProps> = ({
  currentUser: currentUserProp, isAuthorized: isAuthorizedProp, onClose, isUserLocked: isUserLockedProp=false, onLogout=()=>{}, onAdminClick=()=>{}, showUserPlaylist=false, onToggleUserPlaylist=()=>{}, onOpenUserPlaylist=()=>{}, onPendingReview=()=>{}, onUserChange=(_u:string,_l:boolean)=>{},
}) => {
  // ── Identity: read/write same keys as APP.tsx ─────────────────────────────
  const [currentUser,  setCurrentUser]  = useState<string>(()=> localStorage.getItem(USER_KEY) || currentUserProp);
  const [isUserLocked, setIsUserLocked] = useState<boolean>(()=> localStorage.getItem(USER_LOCKED_KEY)==='true' || isUserLockedProp);
  const [showIdentify, setShowIdentify] = useState(false);
  const [identifyName, setIdentifyName] = useState('');
  const [identifyErr,  setIdentifyErr]  = useState('');
  const [identifyPic,  setIdentifyPic]  = useState('');
  // currentPic: always read fresh from localStorage so it's never stale
  const [picVersion, setPicVersion] = useState(0); // increment to force re-read after upload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const currentPic = useMemo(() => getUserPic(currentUser), [currentUser, picVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const adminPic   = useMemo(() => getUserPic(ADMIN_USER),  [picVersion]);

  // keep in sync if parent prop changes
  useEffect(()=>{ if(currentUserProp && currentUserProp !== currentUser) setCurrentUser(localStorage.getItem(USER_KEY)||currentUserProp); },[currentUserProp]);
  useEffect(()=>{ setIsUserLocked(isUserLockedProp); },[isUserLockedProp]);

  const handleIdentify = () => {
    const name = identifyName.trim().toUpperCase().replace(/\s+/g,'_');
    if(!name){ setIdentifyErr('Enter a name'); return; }
    // Log out admin session first
    setIsAuthorized(false);
    localStorage.removeItem(AUTH_KEY);
    setCurrentUser(name);
    setIsUserLocked(true);
    localStorage.setItem(USER_KEY, name);
    localStorage.setItem(USER_LOCKED_KEY,'true');
    if(identifyPic) setUserPic(name, identifyPic);
    setPicVersion(v => v+1);
    window.dispatchEvent(new Event('picUpdated'));
    onUserChange(name, true);
    setShowIdentify(false);
    setIdentifyName(''); setIdentifyErr('');
  };
  const handleIdentifyLogout = () => {
    setIsUserLocked(false);
    localStorage.removeItem(USER_LOCKED_KEY);
    onUserChange(MASTER_IDENTITY, false);
    onLogout();
  };

  // ── Auth: read/write the same key as APP.tsx so both sides stay in sync ──
  const [isAuthorized, setIsAuthorized] = useState<boolean>(()=>
    isAuthorizedProp || localStorage.getItem(AUTH_KEY)==='true'
  );
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass,      setAdminPass]      = useState('');
  const [adminError,     setAdminError]     = useState('');

  // Keep in sync if parent prop changes (e.g. user logged in on video side)
  useEffect(()=>{ if(isAuthorizedProp) setIsAuthorized(true); },[isAuthorizedProp]);

  // Sync auth if admin logs in/out on the video page (same localStorage key)
  useEffect(()=>{
    const sync=()=>setIsAuthorized(localStorage.getItem(AUTH_KEY)==='true');
    const onStorage=(e:StorageEvent)=>{ if(e.key===AUTH_KEY) sync(); };
    window.addEventListener('storage',onStorage);
    document.addEventListener('visibilitychange',sync);
    return ()=>{ window.removeEventListener('storage',onStorage); document.removeEventListener('visibilitychange',sync); };
  },[]);

  const handleAdminLogin = () => {
    if(adminPass===ADMIN_PASSWORD){
      // Log out any user session first
      setCurrentUser(MASTER_IDENTITY);
      setIsUserLocked(false);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_LOCKED_KEY);
      setIsAuthorized(true);
      localStorage.setItem(AUTH_KEY,'true');
      window.dispatchEvent(new StorageEvent('storage',{key:AUTH_KEY,newValue:'true'}));
      setShowAdminLogin(false);
      setAdminPass(''); setAdminError('');
    } else {
      setAdminError('Incorrect password');
    }
  };
  const handleAdminLogout = () => {
    setIsAuthorized(false);
    localStorage.setItem(AUTH_KEY,'false');
    window.dispatchEvent(new StorageEvent('storage',{key:AUTH_KEY,newValue:'false'}));
  };
  const handleLockClick = () => {
    if(isAuthorized){ handleAdminLogout(); }
    else { setShowAdminLogin(true); setAdminError(''); setAdminPass(''); }
  };
  const [genres,     setGenres]     = useState<string[]>(()=>{
    const ver=localStorage.getItem(MUSIC_GENRES_KEY+'_ver');
    if(ver!==GENRES_VERSION){localStorage.removeItem(MUSIC_GENRES_KEY);localStorage.setItem(MUSIC_GENRES_KEY+'_ver',GENRES_VERSION);}
    const s=localStorage.getItem(MUSIC_GENRES_KEY);return s?JSON.parse(s):DEFAULT_MUSIC_GENRES;
  });
  const [genreColors,setGenreColors]= useState<Record<string,string>>(()=>{const s=localStorage.getItem('integral_music_genre_colors_v1');return s?JSON.parse(s):{...DEFAULT_GENRE_COLORS};});
  const [tracks, setTracks] = useState<MusicTrack[]>(()=>{
    const s=localStorage.getItem(SHARED_MUSIC_KEY);
    const t=s?JSON.parse(s):[];
    return t.map(sanitiseTrack);
  });;
  const [reviews,    setReviews]    = useState<MusicReview[]>(()=>{const s=localStorage.getItem(MUSIC_REVIEWS_KEY);return s?JSON.parse(s):[];});

  const [currentTrackId, setCurrentTrackId] = useState<string|undefined>();
  const [isShuffleMode, setIsShuffleMode] = useState(false);
  const isShuffleModeRef = useRef(false);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [activeTab,  setActiveTab]  = useState('All');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const selectedGenresRef = React.useRef<string[]>([]);
  const setSelectedGenresSafe = (fn: (p: string[]) => string[]) => {
    setSelectedGenres(p => {
      const next = fn(p);
      selectedGenresRef.current = next;
      return next;
    });
  };
  const [search,     setSearch]     = useState('');
  const [showAddForm,setShowAddForm]= useState(false);
  const [showAddGenreForm,setShowAddGenreForm]=useState(false);
  const [showReviewPanel,setShowReviewPanel]=useState(false);
  const [reviewingTrackId,setReviewingTrackId]=useState<string|null>(null);
  const [showMusicReviews,setShowMusicReviews]=useState(false);
  const [showMusicVault,setShowMusicVault]=useState(false);
  const [reviewRating,setReviewRating]=useState(5);
  const [reviewComment,setReviewComment]=useState('');
  const [formUrl,    setFormUrl]    = useState('');
  const [formArtist, setFormArtist] = useState('');
  const [formTitle,  setFormTitle]  = useState('');
  const [formThumbnail, setFormThumbnail] = useState('');
  const [formFetching, setFormFetching] = useState(false);
  const [formCategory,setFormCategory]=useState(()=>{const s=localStorage.getItem(MUSIC_GENRES_KEY);const g=s?JSON.parse(s):DEFAULT_MUSIC_GENRES;return g[0]||'Other';});
  const [newGenre,   setNewGenre]   = useState('');
  const [newGenreColor,setNewGenreColor]=useState(COLOR_PALETTE[0][0]);
  const [confirmDeleteId,setConfirmDeleteId]=useState<string|null>(null);
  const [editingTrackId,setEditingTrackId]=useState<string|null>(null);
  const [editArtist,setEditArtist]=useState('');
  const [editTitle,setEditTitle]=useState('');
  const [editCategory,setEditCategory]=useState('');
  const [galleryTrackId,setGalleryTrackId]=useState<string|null>(null);
  const [galleryInputUrl,setGalleryInputUrl]=useState('');
  const [editUrl,setEditUrl]=useState('');
  const [editThumbnail,setEditThumbnail]=useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [queueTab,   setQueueTab]   = useState<'All'|'Queue'>('All');
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [vizKey, setVizKey] = useState(0);
  const [crossfading, setCrossfading] = useState(false);
  const [vizInitialMode, setVizInitialMode] = useState(0);
  const [vizAutoStart, setVizAutoStart] = useState(false);

  // ── Firestore: load music on mount ──────────────────────────────────────────
  const cleanTitle = (t: any) => sanitiseTrack(t);
  useEffect(()=>{
    loadMusicFromFirestore().then(remote => {
      if (remote && remote.length > 0) {
        const cleaned = remote.map(sanitiseTrack);
        setTracks(cleaned);
        try { localStorage.setItem(SHARED_MUSIC_KEY, JSON.stringify(cleaned)); } catch {}
        // Immediately overwrite bad data in Firestore
        const hadBadData = remote.some((tr:any) => {
          const url = tr.url||'';
          return url.includes('<') || url.includes('iframe') ||
                 (tr.artist||'').includes('<') || (tr.title||'').toLowerCase() === 'song';
        });
        if (hadBadData) saveMusicToFirestore(cleaned);
      }
    });
    loadMusicReviewsFromFirestore().then(remote => {
      if (remote && remote.length > 0) {
        setReviews(remote);
        try { localStorage.setItem(MUSIC_REVIEWS_KEY, JSON.stringify(remote)); } catch {}
      }
    });
    // Live updates from other users
    const unsubTracks = subscribeToMusic(remote => {
      const cleaned = remote.map(sanitiseTrack);
      if (Date.now() - _lastLocalSave.current < 5000) return;
      setTracks(prev => {
        const remoteIds = new Set(cleaned.map((t:any) => t.id));
        const localOnly = prev.filter(t => !remoteIds.has(t.id));
        const merged = localOnly.length > 0 ? [...localOnly, ...cleaned] : cleaned;
        try { localStorage.setItem(SHARED_MUSIC_KEY, JSON.stringify(merged)); } catch {}
        return merged;
      });
      const hadBadData = remote.some((tr:any) => {
        const url = tr.url||'';
        return url.includes('<') || url.includes('iframe') ||
               (tr.artist||'').includes('<') || (tr.title||'').toLowerCase() === 'song';
      });
      if (hadBadData) { setTimeout(() => saveMusicToFirestore(cleaned), 100); }
    });
    return () => { unsubTracks(); };
  }, []);

  // ── Firestore: save music on change (debounced 1.5s) ─────────────────────
  useEffect(()=>{
    const clean = tracks.map(sanitiseTrack);
    const t = setTimeout(()=>{ _lastLocalSave.current = Date.now(); saveMusicToFirestore(clean); }, 1500);
    // Also keep localStorage in sync as fallback
    try {
      const stripped = clean.map((t:any)=>({...t, thumbnail: t.thumbnail?.startsWith('data:') ? '' : (t.thumbnail||'')}));
      localStorage.setItem(SHARED_MUSIC_KEY, JSON.stringify(stripped));
    } catch {}
    return ()=> clearTimeout(t);
  },[tracks]);

  useEffect(()=>{
    const t = setTimeout(()=>{ saveMusicReviewsToFirestore(reviews); }, 1500);
    try { localStorage.setItem(MUSIC_REVIEWS_KEY, JSON.stringify(reviews)); } catch {}
    return ()=> clearTimeout(t);
  },[reviews]);


  // ── User tracks: completely separate from Firestore ──────────────────────
  const [userTracks, setUserTracks] = useState<MusicTrack[]>(()=>{
    try {
      const user = localStorage.getItem(USER_KEY) || currentUser;
      const raw = JSON.parse(localStorage.getItem(`integral_user_tracks_${user}`)||'[]');
      return raw.map((tr:any) => {
        const t = sanitiseTrack(tr);
        // Clear YouTube thumbnails wrongly assigned to AudioMack tracks
        if (t.url.includes('audiomack.com') && (t.thumbnail||'').includes('ytimg.com')) {
          return {...t, thumbnail: ''};
        }
        return t;
      });
    } catch { return []; }
  });
  const saveUserTracks = (tracks: MusicTrack[]) => {
    const user = localStorage.getItem(USER_KEY) || currentUser;
    try { localStorage.setItem(`integral_user_tracks_${user}`, JSON.stringify(tracks)); } catch {}
  };

  useEffect(()=>{localStorage.setItem(MUSIC_GENRES_KEY,JSON.stringify(genres));},[genres]);
  useEffect(()=>{localStorage.setItem('integral_music_genre_colors_v1',JSON.stringify(genreColors));},[genreColors]);

  const currentTrack=useMemo(()=>tracks.find(t=>t.id===currentTrackId)||userTracks.find(t=>t.id===currentTrackId)||null,[tracks,userTracks,currentTrackId]);
  const filteredTracks=useMemo(()=>tracks.filter(t=>{
    if(t.addedBy) return false;
    if(activeTab==='Vault') return t.isFavorite;
    if(selectedGenres.length>0&&!selectedGenres.includes(t.category)) return false;
    return search===''||t.artist.toLowerCase().includes(search.toLowerCase())||t.title.toLowerCase().includes(search.toLowerCase());
  }),[tracks,activeTab,selectedGenres,search]);

  const pendingReviews=useMemo(()=>reviews.filter(r=>!r.approved),[reviews]);
  const approvedReviews=useMemo(()=>reviews.filter(r=>r.approved),[reviews]);
  const allTabs=useMemo(()=>[{name:'All'},{name:'Vault'},...[...genres].sort((a,b)=>a.localeCompare(b)).map(g=>({name:g}))]  ,[genres]);
  const firstRowTabs=useMemo(()=>allTabs.slice(0,4),[allTabs]);
  const overflowTabs=useMemo(()=>allTabs.slice(4),[allTabs]);

  const getTabColor =(n:string)=>n==='All'?'#f8fafc':n==='Vault'?'#ff3b3b':genreColors[n]||'#94a3b8';
  const getTabStyles=(n:string,selGenres?:string[])=>{const sg=selGenres??selectedGenres;const c=getTabColor(n),a=(n==='All'&&activeTab==='All'&&sg.length===0)||(n==='Vault'&&activeTab==='Vault')||(n!=='All'&&n!=='Vault'&&sg.includes(n));return a?{color:c,backgroundColor:`${c}25`,borderColor:`${c}50`,transform:'scale(1.02)'}:{color:`${c}90`,borderColor:'rgba(0,0,0,0)',backgroundColor:'rgba(0,0,0,0)'};};;
  const getTagStyles=(cat:string)=>{const c=genreColors[cat]||'#94a3b8';return{color:c,borderColor:`${c}60`,backgroundColor:`${c}20`};};
  const getTrackRating=(id:string)=>{const r=approvedReviews.filter(r=>r.trackId===id);return r.length?r.reduce((a,b)=>a+b.rating,0)/r.length:0;};

  // Auto-play next track
  const _currentTrackIdRef = useRef<string|undefined>(undefined);
  const trackListRef = useRef<HTMLDivElement>(null);
  const _tracksRef = useRef<MusicTrack[]>([]);
  const _lastLocalSave = useRef<number>(0);
  const _userTracksRef = useRef<MusicTrack[]>([]);
  useEffect(()=>{ isShuffleModeRef.current = isShuffleMode; }, [isShuffleMode]);
  useEffect(()=>{
    _currentTrackIdRef.current = currentTrackId;
    if(currentTrackId && trackListRef.current){
      const el = trackListRef.current.querySelector(`[data-trackid="${currentTrackId}"]`) as HTMLElement;
      if(el) el.scrollIntoView({block:'center',behavior:'smooth'});
    }
  },[currentTrackId]);
  useEffect(()=>{ _tracksRef.current = tracks; }, [tracks]);
  useEffect(()=>{ _userTracksRef.current = userTracks; }, [userTracks]);

  const lastNextTrackTime = useRef<number>(0);
  const _currentTrackStartRef = useRef<number>(Date.now());
  const trackPlayStartTime = useRef<number>(0);
  const playNextTrack = useCallback(() => {
    const now = Date.now();
    lastNextTrackTime.current = now;
    const allT = [..._tracksRef.current, ..._userTracksRef.current];
    if(isShuffleModeRef.current){
      const pool=allT; if(pool.length>1){let r;do{r=pool[Math.floor(Math.random()*pool.length)];}while(r.id===_currentTrackIdRef.current&&pool.length>1);setCurrentTrackId(r.id);setIsPlaying(true);return;}
    }
    const idx = allT.findIndex(t => t.id === _currentTrackIdRef.current);
    if (idx >= 0) { const next = allT[(idx + 1) % allT.length]; setCurrentTrackId(next.id); setIsPlaying(true); setShowVisualizer(v=>v); setVizKey(k=>k+1); _currentTrackStartRef.current=Date.now(); }
    else if (allT.length > 0) { setCurrentTrackId(allT[0].id); setIsPlaying(true); setShowVisualizer(v=>v); setVizKey(k=>k+1); }
  }, []);

  useEffect(()=>{
    const onMsg=(e:MessageEvent)=>{
      try {
        const d=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(d?.method==='ready'&&e.origin.includes('soundcloud')){
          (e.source as Window)?.postMessage(JSON.stringify({method:'addEventListener',value:'finish'}),'*');
          (e.source as Window)?.postMessage(JSON.stringify({method:'getDuration'}),'*');
          return;
        }
        if(d?.method==='finish'&&e.origin.includes('soundcloud')){
          const elapsed=Date.now()-(_currentTrackStartRef.current||0);
          if(elapsed>10000) playNextTrack();
          return;
        }
        if(d?.method==='getDuration'&&e.origin.includes('soundcloud')&&d?.value>0){
          const ms=Number(d.value);
          if(scTimerRef.current){ clearTimeout(scTimerRef.current); scTimerRef.current=null; }
          scTimerRef.current=setTimeout(()=>{ playNextTrack(); }, ms+2000);
          return;
        }
        if(d?.event==='onStateChange'&&d?.info===0){
          const ytM=document.getElementById('yt-player') as HTMLIFrameElement|null;
          if(ytM&&e.source===ytM.contentWindow){ playNextTrack(); return; }
        }
      } catch {}
    };
    window.addEventListener('message',onMsg);
    return ()=>window.removeEventListener('message',onMsg);
  },[playNextTrack]);

    // SoundCloud duration-timer
  const scTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    if(scTimerRef.current){ clearTimeout(scTimerRef.current); scTimerRef.current=null; }
    if(!currentTrack||!isPlaying) return;
    if(!currentTrack.url?.includes('soundcloud.com')) return;
    let cancelled=false;
    const startedAt=Date.now();
    let scUrl=currentTrack.url;
    try{ scUrl=new URL(currentTrack.url).origin+new URL(currentTrack.url).pathname; }catch{}
    fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(scUrl)}&format=json`)
      .then(r=>r.json())
      .then(d=>{
        if(cancelled) return;
        const ms=typeof d?.duration==='number'&&d.duration>5000?d.duration:0;
        const elapsed=Date.now()-startedAt;
        const wait=ms?Math.max(2000,ms-elapsed+2000):Math.max(2000,4*60*1000-elapsed+2000);
        scTimerRef.current=setTimeout(()=>{ if(!cancelled) playNextTrack(); },wait);
      })
      .catch(()=>{
        if(cancelled) return;
        const wait=3*60*1000;
        scTimerRef.current=setTimeout(()=>{ if(!cancelled) playNextTrack(); },wait);
      });
    return ()=>{ cancelled=true; if(scTimerRef.current){clearTimeout(scTimerRef.current);scTimerRef.current=null;} };
  },[currentTrack?.id,isPlaying,playNextTrack]);

  const handleAddGenre=()=>{const g=newGenre.trim();if(!g||genres.includes(g))return;setGenres(p=>[...p,g]);setGenreColors(p=>({...p,[g]:newGenreColor}));setNewGenre('');setShowAddGenreForm(false);};
  const handleRemoveGenre=(g:string)=>{setGenres(p=>p.filter(x=>x!==g));if(activeTab===g)setActiveTab('All');setSelectedGenresSafe(p=>p.filter(x=>x!==g));};
  const isAddingTrack = useRef(false);
  const dragSrcIdx     = useRef<number>(-1);  // admin track list drag
  const userDragSrcIdx = useRef<number>(-1);  // user track list drag

  // Reorder admin/shared tracks by dragging
  const handleDragReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setTracks(prev => {
      const filtered = prev.filter(t => {
        if (activeTab === 'Vault') return t.isFavorite;
        if (activeTab !== 'All') return t.category === activeTab;
        return search === '' || t.artist.toLowerCase().includes(search.toLowerCase()) || t.title.toLowerCase().includes(search.toLowerCase());
      });
      const fromTrack = filtered[fromIdx];
      const toTrack   = filtered[toIdx];
      if (!fromTrack || !toTrack) return prev;
      const fromFullIdx = prev.findIndex(t => t.id === fromTrack.id);
      const toFullIdx   = prev.findIndex(t => t.id === toTrack.id);
      if (fromFullIdx < 0 || toFullIdx < 0) return prev;
      const next = [...prev];
      next.splice(fromFullIdx, 1);
      next.splice(toFullIdx, 0, fromTrack);
      _lastLocalSave.current = Date.now();
      setTimeout(()=>saveMusicToFirestore(next), 100);
      return next;
    });
  };

  // Reorder user tracks by dragging
  const handleUserDragReorder = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    setUserTracks(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };
  const musicReviewRef = useRef<HTMLDivElement>(null);
  const musicPlayerRef = useRef<HTMLDivElement>(null);
  const [isMusicFullscreen, setIsMusicFullscreen] = useState(false);
  useEffect(() => { const h = () => setIsMusicFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  const handleMusicFullscreen = () => {
    const el = musicPlayerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };
  useEffect(()=>{
    if(showMusicReviews && musicReviewRef.current){
      setTimeout(()=>musicReviewRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100);
    }
  },[showMusicReviews, reviewingTrackId]);
  // Extract actual URL if user pastes an <iframe> tag
  const extractUrl = (input: string): string => {
    const m = input.match(/src=["']([^"']+)["']/i);
    return m ? m[1] : input.trim();
  };

  const fetchTrackMeta = async (rawInput: string) => {
    const url = extractUrl(rawInput);
    if (!url.trim()) return;
    setFormFetching(true);
    try {
      // YouTube
      if (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.youtube')) {
        const ytUrl = url.replace('music.youtube.com', 'www.youtube.com');
        const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`);
        if (r.ok) {
          const d = await r.json();
          if (d.author_name) setFormArtist(d.author_name);
          if (d.title) setFormTitle(d.title);
          setFormFetching(false); return;
        }
      }
      // SoundCloud
      if (url.includes('soundcloud.com')) {
        let scClean = url; try { scClean = new URL(url).origin + new URL(url).pathname; } catch {}
        const r = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(scClean)}&format=json`);
        if (r.ok) {
          const d = await r.json();
          if (d.author_name) setFormArtist(d.author_name);
          if (d.title) setFormTitle(d.title);
          setFormFetching(false); return;
        }
      }
      // AudioMack — parse artist/title directly from URL slug (instant)
      if (url.includes('audiomack.com')) {
        const amClean = url.replace(/[?#].*$/, '').replace('/embed/', '/');
        const parts = amClean.replace(/https?:\/\/audiomack\.com\//, '').split('/').filter(Boolean);
        const toTitle = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c:string) => c.toUpperCase());
        if (parts[0]) setFormArtist(toTitle(parts[0]));
        if (parts[2]) setFormTitle(toTitle(parts[2]));
        setFormFetching(false); return;
      }
    } catch {}
    setFormFetching(false);
  };

  const handleAddTrack=async ()=>{
    if(!formUrl.trim())return;
    if(isAddingTrack.current)return;
    const url=extractUrl(formUrl);
    // Check for duplicate
    const allTracks = [...tracks, ...userTracks];
    if(allTracks.some(t=>t.url===url||t.url.replace(/[?#].*/,'')===url.replace(/[?#].*/,''))){
      alert('This track is already in the archive.');
      return;
    }
    isAddingTrack.current=true;
    // Start with whatever the user typed (may be empty)
    let artist=formArtist.trim();
    let title=formTitle.trim();
    let thumbnail='';
    // AudioMack — parse artist/title from URL slug, no thumbnail
    if (url.includes('audiomack.com')) {
      const amClean = url.replace(/[?#].*$/, '').replace('/embed/', '/');
      const parts = amClean.replace(/https?:\/\/audiomack\.com\//, '').split('/').filter(Boolean);
      const toTitle = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c:string) => c.toUpperCase());
      if (!artist && parts[0]) artist = toTitle(parts[0]);
      if (!title && parts[2]) title = toTitle(parts[2]);
    } else {
      // Auto-fetch from oEmbed if YouTube or SoundCloud
      try {
        const ytUrl2 = url.replace('music.youtube.com', 'www.youtube.com');
        const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl2)}&format=json`);
        if(oembed.ok){
          const d=await oembed.json();
          if(!artist && d.author_name) artist=d.author_name;
          if(!title && d.title) title=d.title;
          if(d.thumbnail_url) thumbnail=d.thumbnail_url;
        }
      } catch{}
      try {
        if(!thumbnail){
          let scClean = url; try { scClean = new URL(url).origin + new URL(url).pathname; } catch {}
          const sc = await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(scClean)}&format=json`);
          if(sc.ok){
            const d=await sc.json();
            if(!artist && d.author_name) artist=d.author_name;
            if(!title && d.title) title=d.title;
            if(d.thumbnail_url) thumbnail=d.thumbnail_url;
          }
        }
      } catch{}
      // Fallback: derive YouTube thumbnail directly from URL
      if(!thumbnail){
        let id='';
        if(url.includes('youtu.be/')) id=url.split('youtu.be/')[1]?.split(/[?&/#]/)[0]||'';
        else if(url.includes('v=')) id=url.split('v=')[1]?.split(/[?&/#]/)[0]||'';
        if(id) thumbnail=`https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      }
    }
    if(!artist) artist='Unknown Artist';
    if(!title) title='Unknown Title';
    // Clean up SoundCloud titles like "Song Name, by Artist" → "Song Name"
    title = title.replace(/,?\s+by\s+.+$/i, '').trim();
    const isUserTrack = currentUser !== MASTER_IDENTITY;
    const tk:MusicTrack={id:`m-${Date.now()}`,artist,title,url,thumbnail:formThumbnail.trim()||thumbnail,category:formCategory,...(isUserTrack?{addedBy:currentUser}:{}),timestamp:Date.now(),playCount:0,likeCount:0};
    if(isUserTrack){
      const newUserTracks = [tk, ...userTracks];
      setUserTracks(newUserTracks);
      saveUserTracks(newUserTracks);
      onOpenUserPlaylist();
    }
    else {
      _lastLocalSave.current = Date.now();
      const withNew = [tk, ..._tracksRef.current];
      setTracks(withNew);
      saveMusicToFirestore(withNew);
    }
    setFormUrl('');setFormArtist('');setFormTitle('');setFormThumbnail('');setShowAddForm(false);setCurrentTrackId(tk.id);setIsPlaying(true);
    isAddingTrack.current=false;
  };
  const handleRemoveTrack=(id:string)=>{
    const newUserTracks = userTracks.filter(t=>t.id!==id);
    setUserTracks(newUserTracks);
    saveUserTracks(newUserTracks);
    setTracks(p=>p.filter(t=>t.id!==id));
    if(currentTrackId===id){setCurrentTrackId(undefined);setIsPlaying(false);}
    setConfirmDeleteId(null);
  };

  // thumbnails rendered via <TrackThumbnail> component directly
  const handleSaveEdit=(id:string)=>{
    const update=(t:MusicTrack)=>t.id===id?{...t,artist:editArtist.trim()||t.artist,title:editTitle.trim()||t.title,category:editCategory||t.category,url:editUrl.trim()||t.url,thumbnail:editThumbnail.trim()||t.thumbnail}:t;
    setTracks(p=>{const n=p.map(update);saveMusicToFirestore(n);return n;});
    setUserTracks(p=>p.map(update));
    setEditingTrackId(null);
  };
  const handleToggleFavorite=(id:string,e:React.MouseEvent)=>{e.stopPropagation();if(!isUserLocked&&!isAuthorized){onPendingReview();return;}setTracks(p=>p.map(t=>t.id===id?{...t,isFavorite:!t.isFavorite}:t));const track=tracks.find(t=>t.id===id);if(!track?.isFavorite)setShowMusicVault(true);};
  const selectTrackDebounce = React.useRef(false);
  const handleSelectTrack=(track:MusicTrack)=>{
    if(currentTrackId===track.id){
      setIsPlaying(p=>!p);
    } else {
      if(selectTrackDebounce.current) return;
      selectTrackDebounce.current = true;
      setTimeout(()=>{ selectTrackDebounce.current = false; }, 300);
      setCurrentTrackId(track.id);
      setIsPlaying(true);
      setShowVisualizer(sv=>sv);
      setShowVisualizer(false);
      if(track.addedBy) setUserTracks(p=>p.map(t=>t.id===track.id?{...t,playCount:t.playCount+1}:t));
      else setTracks(p=>p.map(t=>t.id===track.id?{...t,playCount:t.playCount+1}:t));
    }
  };
  // Crossfade on track change - short enough to not confuse users
  useEffect(()=>{
    if(!currentTrackId) return;
    setCrossfading(true);
    const t = setTimeout(()=>setCrossfading(false), 300);
    return ()=>clearTimeout(t);
  },[currentTrackId]);

  const {embedUrl,type}=useMemo(()=>currentTrack?getEmbedUrl(currentTrack.url):{embedUrl:'',type:'unknown' as const},[currentTrack?.url]);

  // Control playback via postMessage
  useEffect(()=>{
    if(type==='youtube') {
      const iframe = document.getElementById('music-main-player') as HTMLIFrameElement|null;
      if(!iframe) return;
      const cmd = isPlaying
        ? JSON.stringify({event:'command',func:'playVideo',args:''})
        : JSON.stringify({event:'command',func:'pauseVideo',args:''});
      try{ iframe.contentWindow?.postMessage(cmd,'https://www.youtube.com'); }catch{}
    } else if(type==='soundcloud') {
      const iframe = document.getElementById('music-main-player') as HTMLIFrameElement|null;
      if(!iframe) return;
      const cmd = isPlaying ? 'play' : 'pause';
      try{ iframe.contentWindow?.postMessage(JSON.stringify({method:cmd}),'*'); }catch{}
    }
  },[isPlaying, currentTrackId, type]);

  const handleLikeTrack=(id:string,e:React.MouseEvent)=>{
    e.stopPropagation();
    if(!isUserLocked&&!isAuthorized){onPendingReview();return;}
    setTracks(p=>p.map(t=>{
      if(t.id!==id) return t;
      const likedBy:string[] = (t as any).likedBy || [];
      if(likedBy.includes(currentUser)) return t; // already liked
      return {...t,likeCount:(t.likeCount||0)+1,likedBy:[...likedBy,currentUser]};
    }));
  };
  const handlePlayNext=()=>{if(!filteredTracks.length)return;const idx=filteredTracks.findIndex(t=>t.id===currentTrackId);const next=filteredTracks[(idx+1)%filteredTracks.length];setCurrentTrackId(next.id);setIsPlaying(true);};
  const handlePlayPrev=()=>{if(!filteredTracks.length)return;const idx=filteredTracks.findIndex(t=>t.id===currentTrackId);const prev=filteredTracks[(idx-1+filteredTracks.length)%filteredTracks.length];setCurrentTrackId(prev.id);setIsPlaying(true);};
  const handleShuffle=()=>{
    const pool=[...tracks,...userTracks];
    if(!pool.length)return;
    setIsShuffleMode(true); isShuffleModeRef.current=true;
    const r=pool[Math.floor(Math.random()*pool.length)];
    setCurrentTrackId(r.id); setIsPlaying(true);
  };
  const handleShuffleOff=(e:React.MouseEvent)=>{ e.stopPropagation(); setIsShuffleMode(false); isShuffleModeRef.current=false; };
  const handleSubmitReview=()=>{
    if(!reviewingTrackId)return;
    const alreadyReviewed = reviews.some(r=>r.trackId===reviewingTrackId&&r.user===currentUser);
    if(alreadyReviewed){ setReviewingTrackId(null); return; }
    const rev:MusicReview={id:`rev-${Date.now()}`,trackId:reviewingTrackId,user:currentUser,rating:reviewRating,comment:reviewComment.trim(),timestamp:Date.now(),approved:isAuthorized};
    setReviews(p=>{
      const updated=[...p,rev];
      // Save immediately so refresh doesn't lose it
      try { localStorage.setItem(MUSIC_REVIEWS_KEY, JSON.stringify(updated)); } catch {}
      saveMusicReviewsToFirestore(updated);
      return updated;
    });
    setReviewComment('');setReviewRating(5);setReviewingTrackId(null);if(!isAuthorized){onPendingReview();}
  };
  const handleApproveReview=(id:string)=>setReviews(p=>p.map(r=>r.id===id?{...r,approved:isAuthorized}:r));
  const handleDeleteReview=(id:string)=>setReviews(p=>p.filter(r=>r.id!==id));

  const renderTab=(tab:{name:string})=>{
    const del=isAuthorized&&!['All','Vault'].includes(tab.name);
    const count = tab.name==='All' ? tracks.length
                : tab.name==='Vault' ? tracks.filter(t=>t.isFavorite).length
                : tracks.filter(t=>t.category===tab.name).length;
    const tipLabel = `${tab.name} · ${count} track${count!==1?'s':''}`;
    // Shorten long display names so they fit the narrow grid cell
    const shortName = (() => {
      const n = tab.name;
      if (n.length <= 10) return n;
      // Smart abbreviations for known long patterns
      if (/celestial.*meditation/i.test(n)) return 'Cel. Med';
      if (/meditation.*silent/i.test(n)) return 'Med. Silent';
      if (/meditation.*guided/i.test(n)) return 'Med. Guided';
      if (/meditation/i.test(n)) return 'Meditation';
      if (/electronic/i.test(n)) return 'Electronic';
      if (/classical/i.test(n)) return 'Classical';
      if (/affirmation/i.test(n)) return 'Affirm.';
      // Generic: keep first 9 chars + ellipsis
      return n.slice(0, 9) + '…';
    })();
    return(
      <div key={tab.name} className="relative group/tab">
        <Tooltip label={tipLabel} position="bottom">
          <button onClick={()=>{
            if(tab.name==='All'){setActiveTab('All');setSelectedGenres([]); selectedGenresRef.current = [];;}
            else if(tab.name==='Vault'){setActiveTab('Vault');setSelectedGenres([]); selectedGenresRef.current = [];;}
            else{
  const name = tab.name;
  const current = selectedGenresRef.current;
  const next = current.includes(name) ? current.filter(x => x !== name) : [...current, name];
  selectedGenresRef.current = next;
  setSelectedGenres(next);
}
          }} style={(()=>{const c2=getTabColor(tab.name),active=(tab.name==='All'&&activeTab==='All'&&selectedGenres.length===0)||(tab.name==='Vault'&&activeTab==='Vault')||(tab.name!=='All'&&tab.name!=='Vault'&&selectedGenres.includes(tab.name));return active?{color:c2,backgroundColor:`${c2}25`,borderColor:`${c2}50`,transform:'scale(1.02)'}:{color:`${c2}90`,borderColor:'rgba(0,0,0,0)',backgroundColor:'rgba(0,0,0,0)'};})()}
            className="w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-normal transition-all flex items-center justify-center px-1 border cursor-pointer">
            <span className="flex items-center justify-center gap-1 w-full px-0.5"><span className="opacity-0 group-hover/tab:opacity-100 text-[7px] group-hover/tab:text-[9px] font-black flex-shrink-0 transition-all duration-150">{count}</span><span className="truncate">{shortName}</span></span>
          </button>
        </Tooltip>
        {del&&<button onClick={e=>{e.stopPropagation();handleRemoveGenre(tab.name);}} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/tab:opacity-100 transition-opacity z-10 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"><i className="fa-solid fa-xmark text-[8px]"/></button>}
      </div>
    );
  };

  const StarRating=({value,onChange,size='text-sm'}:{value:number;onChange?:(v:number)=>void;size?:string})=>(
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(s=>(
        <button key={s} onClick={()=>onChange?.(s)} className={`${onChange?'cursor-pointer hover:scale-125':'cursor-default'} transition-transform`}>
          <i className={`fa-${s<=Math.round(value)?'solid':'regular'} fa-star ${size} ${s<=Math.round(value)?'text-yellow-400':'text-slate-700'}`}/>
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[300] bg-black text-slate-100 flex flex-col font-sans">


      {/* ── Header ── */}
      <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/60 backdrop-blur-xl flex items-center justify-between px-8 z-50 relative">
        <div className="flex items-center gap-4">
          <div className="hover:rotate-[360deg] transition-transform duration-700"><IntegralLogo/></div>
          <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none text-blue-600">IntegralStream</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Personalized Archive</p>
          </div>
        </div>
        {currentUser!==MASTER_IDENTITY&&currentUser!==''&&(
          isAuthorized ? (
            <div className="absolute left-1/2 -translate-x-1/2 h-11 px-5 rounded-xl flex items-center gap-2 border border-white/5 bg-slate-900/40 font-black text-[10px] tracking-widest uppercase opacity-35 cursor-not-allowed select-none text-slate-600" title="Disabled in admin mode">
              <i className="fa-solid fa-list text-sm"/><span>{displayName(currentUser)} Playlist</span>
            </div>
          ) : (
            <button onClick={onToggleUserPlaylist} className={`absolute left-1/2 -translate-x-1/2 h-11 px-5 rounded-xl flex items-center gap-2 border transition-all font-black text-[10px] tracking-widest uppercase ${showUserPlaylist?'bg-white text-black shadow-lg':'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20'}`}><i className="fa-solid fa-list text-sm"/><span>{displayName(currentUser)} Playlist</span></button>
          )
        )}
        <div className="flex gap-3 items-center">

          {/* Identify button — logged-in click = instant logout, logged-out = join panel */}
          <button onClick={()=>{ if(isUserLocked){ handleIdentifyLogout(); } else {
  // 1. Try USER_KEY name → pic lookup
  const savedName = localStorage.getItem(USER_KEY) || '';
  let prefillName = savedName ? savedName.replace(/_/g,' ') : '';
  let savedPic = savedName ? getUserPic(savedName) : '';
  // 2. Fallback: scan picMap for any saved users on this device
  if (!savedPic || !prefillName) {
    const picMap = getPicMap();
    const userKeys = Object.keys(picMap).filter(k => k !== 'ADMIN');
    if (userKeys.length > 0) {
      // Prefer key matching savedName, else use the first (or only) entry
      const match = savedName && userKeys.find(k => k === savedName);
      const best = match || userKeys[0];
      if (!savedPic) savedPic = picMap[best];
      if (!prefillName) prefillName = best.replace(/_/g,' ');
    }
  }
  setShowIdentify(true);
  setIdentifyName(prefillName);
  setIdentifyErr('');
  setIdentifyPic(savedPic);
} }} className={`px-4 h-11 rounded-xl border flex items-center gap-3 transition-all relative overflow-hidden ${isUserLocked?'bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400':'border-purple-500/40 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-500/40 hover:to-blue-500/40 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20'}`}>
            {!isUserLocked && <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-white/5 to-blue-500/0 animate-pulse pointer-events-none"/>}
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{isUserLocked?'My Archive':'Join Now'}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest ${!isUserLocked?'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400':''}`}>{isUserLocked?displayName(currentUser):'Pick a Username'}</span>
            </div>
            <div className="w-8 h-8 rounded-full overflow-hidden border flex-shrink-0 flex items-center justify-center bg-blue-600/20 border-blue-500/40">
              {currentPic?<img src={currentPic} className="w-full h-full object-cover" alt="profile"/>: isUserLocked ? <i className="fa-solid fa-user-astronaut text-[11px] text-blue-400"/> : <div className="hover:rotate-[360deg] transition-transform duration-700"><IntegralLogo className="w-6 h-6"/></div>}
            </div>
          </button>

          {currentUser!==MASTER_IDENTITY&&currentUser!==''&&<MusicPlaylistButton currentUser={currentUser} tracks={tracks} currentTrackId={currentTrackId} onSelectTrack={(id)=>{setCurrentTrackId(id);setIsPlaying(true);}}/>}
          {isAuthorized&&<button onClick={handleLockClick} className="relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer bg-blue-600/10 border-blue-500/30 hover:bg-red-500/10 hover:border-red-500/30 overflow-hidden group/admin">
            {adminPic ? <img src={adminPic} className="w-full h-full object-cover" alt="admin"/> : <i className="fa-solid fa-lock-open text-blue-400"/>}
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover/admin:opacity-100 transition-opacity gap-0.5">
              <i className="fa-solid fa-lock text-red-400 text-[9px]"/>
              <span className="text-[6px] font-black text-red-400 uppercase tracking-wider leading-none">Log Out</span>
            </div>
          </button>}
          {!isAuthorized&&<button onClick={handleLockClick} className="relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer bg-white/5 border-white/10 hover:border-blue-500/30 overflow-hidden group/admin">
            {adminPic ? <img src={adminPic} className="w-full h-full object-cover opacity-50 group-hover/admin:opacity-100 transition-opacity" alt="admin"/> : <i className="fa-solid fa-lock text-slate-500"/>}
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover/admin:opacity-100 transition-opacity gap-0.5">
              <i className="fa-solid fa-unlock text-blue-400 text-[9px]"/>
              <span className="text-[6px] font-black text-blue-400 uppercase tracking-wider leading-none">Admin</span>
            </div>
          </button>}
        </div>
      </header>

      {/* ── Review panel ── */}
      {showReviewPanel&&(
        <div className="flex-shrink-0 border-b border-white/10 bg-slate-950/95 px-8 py-5 max-h-72 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Music Reviews</h4>
              <div className="flex gap-1">
                {(['All','Queue'] as const).map(t=>(
                  <button key={t} onClick={()=>setQueueTab(t)} className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${queueTab===t?'bg-white text-slate-950 shadow-lg':'text-slate-500 hover:text-white'}`}>
                    {t}{t==='Queue'?` (${pendingReviews.length})`:''}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>setShowReviewPanel(false)} className="text-slate-600 hover:text-white text-xs"><i className="fa-solid fa-xmark"/></button>
          </div>
          {(queueTab==='Queue'?pendingReviews:approvedReviews).length===0?(
            <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest">{queueTab==='Queue'?'No pending reviews':'No approved reviews yet'}</p>
          ):(queueTab==='Queue'?pendingReviews:approvedReviews).map(rev=>{
            const tr=tracks.find(t=>t.id===rev.trackId);
            return(
              <div key={rev.id} className="flex items-center gap-4 py-3 border-b border-white/5 last:border-0">
                <div className="flex-1">
                  <p className="text-[11px] font-black text-white">{tr?.artist} — {tr?.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{rev.user.replace(/_/g,' ')} · {rev.comment}</p>
                </div>
                <StarRating value={rev.rating} size="text-xs"/>
                {isAuthorized&&!rev.approved&&<button onClick={()=>handleApproveReview(rev.id)} className="px-3 py-1 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-[9px] font-black uppercase hover:bg-green-600/30 transition-all">Approve</button>}
                {isAuthorized&&<button onClick={()=>handleDeleteReview(rev.id)} className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"><i className="fa-solid fa-xmark text-[10px]"/></button>}
              </div>
            );
          })}
        </div>
      )}

      <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative',zIndex:10,minHeight:0,height:'calc(100vh - 80px)'}}>

        {/* ── Sidebar ── */}
        <aside className="w-[520px] flex-shrink-0 min-w-0 border-r border-white/5 bg-black/20 flex flex-col">
          {/* Toolbar */}
          <div className="flex-none px-4 pt-6 pb-3">
            <div className="flex items-center justify-between mb-4 px-1">
              {/* Left: title + + button */}
              <div className="flex items-center gap-3">
                <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Music Archive
                </h3>
                {(isAuthorized||isUserLocked)&&<button onClick={()=>setShowAddForm(p=>!p)} className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${showAddForm?'bg-purple-600/30 border-purple-500/40 text-purple-300 rotate-45':'bg-purple-600/20 border-purple-500/30 text-purple-400 hover:bg-purple-600/40'}`} title="Add track"><i className="fa-solid fa-plus text-[9px]"/></button>}
              </div>
              {/* Right: toggle + shuffle + search */}
              <div className="flex items-center gap-2">
                <div style={{display:'flex',alignItems:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:2,border:'1px solid rgba(255,255,255,0.1)',width:132,flexShrink:0}}>
                  <button onClick={()=>{ setIsPlaying(false); onClose(); }} style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'transparent',color:'#64748b'}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#fff';(e.currentTarget as HTMLButtonElement).style.background='#2563eb';}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#64748b';(e.currentTarget as HTMLButtonElement).style.background='transparent';}}>
                    <i className="fa-solid fa-film" style={{fontSize:8}}></i> VIDEO
                  </button>
                  <button style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'#7c3aed',color:'#fff'}}>
                    <i className="fa-solid fa-music" style={{fontSize:8}}></i> MUSIC
                  </button>
                </div>
                <>
                <button onClick={handleShuffle} title="Shuffle" className={"text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 "+(isShuffleMode?"text-purple-400":"text-slate-400 hover:text-white")}>
                  <i className="fa-solid fa-shuffle text-[11px]"></i>
                  {isShuffleMode && <span>ON</span>}
                </button>
                {isShuffleMode && <button onClick={handleShuffleOff} className="w-4 h-4 rounded-full bg-purple-500/30 text-purple-300 flex items-center justify-center hover:bg-red-500/40 hover:text-red-300 transition-all"><i className="fa-solid fa-xmark text-[8px]"/></button>}
                </>
                <div className="relative flex-shrink-0">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-7 w-28 pl-7 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none focus:border-purple-500/30"/>
                </div>
              </div>
            </div>

            {/* ── Inline Add Track dropdown ── */}
            {showAddForm && (
              <div className="animate-fade-in bg-slate-900/90 border border-white/10 rounded-2xl p-6 mb-4 shadow-2xl space-y-4">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Add Track</h4>
                <div className="relative">
                  <input autoFocus value={formUrl}
                    onChange={e=>{ const v=e.target.value; const m=v.match(/src=["']([^"']+)["']/i); setFormUrl(m?m[1]:v); setFormArtist(''); setFormTitle(''); }}
                    onBlur={e=>fetchTrackMeta(e.target.value)}
                    onPaste={e=>{ setTimeout(()=>fetchTrackMeta((e.target as HTMLInputElement).value), 50); }}
                    placeholder="YouTube / SoundCloud / AudioMack URL..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-purple-500/30 font-bold placeholder-slate-600"/>
                  {formFetching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-purple-400 font-black uppercase tracking-widest animate-pulse">Fetching...</span>}
                </div>
                <input value={formArtist} onChange={e=>setFormArtist(e.target.value)} placeholder="Artist..." className={`w-full bg-black/40 border rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-purple-500/30 font-bold placeholder-slate-700 transition-all ${formArtist?'border-purple-500/30':'border-white/10'}`}/>
                <input value={formTitle} onChange={e=>setFormTitle(e.target.value)} placeholder="Title..." className={`w-full bg-black/40 border rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-purple-500/30 font-bold placeholder-slate-700 transition-all ${formTitle?'border-purple-500/30':'border-white/10'}`}/>
                <div className="flex gap-2 items-center"><input value={formThumbnail} onChange={e=>setFormThumbnail(e.target.value)} placeholder="Image URL (optional)..." className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-[10px] text-white focus:outline-none focus:border-purple-500/30 font-bold placeholder-slate-700"/>{formThumbnail&&<img src={formThumbnail} alt="" className="w-12 h-10 rounded-lg object-cover border border-white/20 flex-shrink-0" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} onLoad={e=>{(e.target as HTMLImageElement).style.display='block';}}/>}</div>
                <div className="flex flex-wrap gap-1">
                  {[...genres].sort((a,b)=>a.localeCompare(b)).map(g=>(
                    <button key={g} type="button" onClick={()=>setFormCategory(g)}
                      className={`px-2 py-1 rounded-md border text-[8px] font-black uppercase tracking-widest transition-all ${formCategory===g?'bg-white border-white text-black':'bg-white/5 border-white/5 text-slate-500 hover:text-white'}`}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={()=>setShowAddForm(false)} className="flex-1 bg-white/5 border border-white/10 text-slate-500 py-3 rounded-xl text-[9px] font-black uppercase hover:text-white transition-all">Abort</button>
                  <button onClick={handleAddTrack} disabled={!formUrl.trim()} className="flex-1 py-3 bg-white text-black rounded-xl text-[9px] font-black uppercase shadow-lg disabled:opacity-30 hover:bg-slate-100 transition-all">Inject</button>
                </div>
              </div>
            )}

            {/* Genre tabs removed — now in display area header */}
            {isAuthorized&&(
              <div className="mt-1">
                {showAddGenreForm?(
                  <div className="flex flex-col gap-2 px-1">
                    <input autoFocus value={newGenre} onChange={e=>setNewGenre(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddGenre()} placeholder="Genre name..." className="flex-1 h-7 px-2 rounded-lg bg-white/5 border border-purple-500/30 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none"/>
                    <div className="flex flex-wrap gap-1">
                      {COLOR_PALETTE.flat().map(c=>(
                        <button key={c} type="button" onClick={()=>setNewGenreColor(c)} className={`w-5 h-5 rounded-full transition-all hover:scale-125 ${newGenreColor===c?'ring-2 ring-white ring-offset-1 ring-offset-black scale-125':''}`} style={{backgroundColor:c}}/>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleAddGenre} className="h-7 px-3 rounded-lg bg-purple-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-purple-500 transition-all">Add</button>
                      <button type="button" onClick={()=>{setShowAddGenreForm(false);setNewGenre('');}} className="h-7 px-2 rounded-lg bg-white/5 text-slate-400 font-black text-[9px] hover:text-white transition-all">✕</button>
                    </div>
                  </div>
                ):(
                  <button type="button" onClick={()=>setShowAddGenreForm(true)} className="w-full h-7 rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-slate-600 hover:text-purple-400 hover:border-purple-500/30 transition-all">
                    <i className="fa-solid fa-plus text-[9px]"/><span className="text-[8px] font-black uppercase tracking-widest">Add Genre</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Track list */}
          <div ref={trackListRef} className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-10 space-y-1">
            {showUserPlaylist?(
              <>
                <div className="flex items-center justify-between py-2 px-1">
                  <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest">{displayName(currentUser)} · {userTracks.length} tracks</p>
                  <button onClick={onToggleUserPlaylist} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xs"/></button>
                </div>
                {userTracks.length===0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-700">
                    <i className="fa-solid fa-music text-3xl"/>
                    <p className="text-[9px] font-black uppercase tracking-widest">No tracks added yet</p>
                  </div>
                ) : userTracks.map((track, trackIdx)=>{
                  const reviewCount=approvedReviews.filter(r=>r.trackId===track.id).length;
                  return(
                    <div key={track.id}
                      data-trackid={track.id}
                      draggable
                      onDragStart={e=>{ userDragSrcIdx.current=trackIdx; e.dataTransfer.effectAllowed='move'; }}
                      onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                      onDrop={e=>{ e.preventDefault(); handleUserDragReorder(userDragSrcIdx.current, trackIdx); userDragSrcIdx.current=-1; }}
                      onDragEnd={()=>{ userDragSrcIdx.current=-1; }}
                      onClick={()=>handleSelectTrack(track)}
                      className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer border relative ${currentTrackId===track.id?'bg-white/15 border-white/20':'bg-transparent border-transparent hover:bg-white/5'}`}>
                      {confirmDeleteId===track.id&&(
                        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-xl flex items-center justify-between px-6 border border-red-500/20" onClick={e=>e.stopPropagation()}>
                          <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Delete Track?</span>
                          <div className="flex gap-2">
                            <button onClick={()=>setConfirmDeleteId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                            <button onClick={e=>{e.stopPropagation();handleRemoveTrack(track.id);}} className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase">Destroy</button>
                          </div>
                        </div>
                      )}
                      {editingTrackId===track.id&&(
                        <div className="absolute left-0 right-0 z-50 bg-black border border-purple-500/30 rounded-xl shadow-2xl flex flex-col" style={{top:0,height:400}} onClick={e=>e.stopPropagation()}>
                          <div className="px-3 pt-2.5 pb-2 border-b border-white/10 flex-shrink-0"><p className="text-[9px] font-black uppercase tracking-widest text-purple-400 leading-none mb-0.5">{track.artist}</p><p className="text-[12px] font-bold text-white truncate">{track.title}</p></div>
                          <div className="grid grid-cols-2 gap-2 px-3 pt-2 flex-shrink-0"><div className="flex flex-col gap-1"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Artist</label><input value={editArtist} onChange={e=>setEditArtist(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50 w-full"/></div><div className="flex flex-col gap-1"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Title</label><input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50 w-full"/></div></div>
                          <div className="px-3 pt-2 flex-shrink-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">URL</label><input value={editUrl} onChange={e=>setEditUrl(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50"/></div>
                          <div className="px-3 pt-2 flex-shrink-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Thumbnail URL</label><div className="flex gap-2 mt-1 items-center"><input value={editThumbnail} onChange={e=>setEditThumbnail(e.target.value)} placeholder="https://..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50"/>{editThumbnail&&<img src={editThumbnail} alt="" className="w-10 h-8 rounded object-cover border border-white/20 flex-shrink-0" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} onLoad={e=>{(e.target as HTMLImageElement).style.display='block';}}/>}</div></div>
                          <div className="px-3 pt-2 flex-1 flex flex-col min-h-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Genre</label><div className="flex gap-1 flex-wrap overflow-y-auto">{[...genres].sort((a,b)=>a.localeCompare(b)).map(g=><button key={g} onClick={()=>setEditCategory(g)} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex-shrink-0 h-fit transition-all ${editCategory===g?'bg-purple-600 border-purple-500 text-white':'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}>{g}</button>)}</div></div>
                          <div className="flex gap-2 px-3 py-2 border-t border-white/10 flex-shrink-0"><button onClick={()=>setEditingTrackId(null)} className="flex-1 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:bg-white/10 transition-all">Cancel</button><button onClick={()=>handleSaveEdit(track.id)} className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-purple-500 transition-all">Save</button></div>
                        </div>
                      )}
                      {/* Drag handle */}
                      <div onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="flex-shrink-0 flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-blue-400" title="Drag to reorder">
                        <i className="fa-solid fa-grip-vertical text-[10px]"/>
                      </div>
                      <div className={`w-[140px] h-20 rounded-xl flex-shrink-0 border overflow-hidden relative ${currentTrackId===track.id?'border-purple-500/40':'border-white/5'}`}>
                        <TrackThumbnail artist={track.artist} title={track.title} category={track.category} thumbnail={getThumbnailUrl(track)} style={{width:'100%',height:'100%'}}/>
                        {currentTrackId===track.id&&<div className="absolute inset-0 bg-black/50 flex items-center justify-center"><i className={`fa-solid ${isPlaying?'fa-pause':'fa-play'} text-white text-sm`}/></div>}
                      </div>
                      <div className="flex-1 overflow-hidden flex flex-col justify-center gap-0 min-w-0">
                        <p className="text-[14px] font-black uppercase tracking-tight text-purple-400 truncate leading-none">{track.artist}</p>
                        <p className="text-[15px] font-bold leading-none truncate text-slate-300">{track.title}</p>
                        <div className="flex items-center flex-nowrap mt-[4px] overflow-hidden">
                          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 shrink-0">{track.category}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-orange-500 text-[9px] font-black uppercase shrink-0">Listened::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{track.playCount||0}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-blue-500 text-[9px] font-black uppercase shrink-0">Liked::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{track.likeCount||0}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-purple-500 text-[9px] font-black uppercase shrink-0">Reviews::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{reviewCount}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0 flex-shrink-0 ml-2">
                        {isAuthorized ? (
                          <>
                            <button onClick={e=>{e.stopPropagation();setEditingTrackId(track.id);setEditArtist(track.artist);setEditTitle(track.title);setEditCategory(track.category);setEditUrl(track.url||"");setEditThumbnail(track.thumbnail||"");}} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:text-purple-400 transition-all" title="Edit"><i className="fa-solid fa-pen text-[11px]"/></button>
                            <button onClick={e=>{e.stopPropagation();setConfirmDeleteId(track.id);}} className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all" title="Delete"><i className="fa-solid fa-xmark text-[15px]"/></button>
                          </>
                        ) : (
                          <>
                            <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleLikeTrack(track.id,e);}} className={`w-6 h-6 flex items-center justify-center transition-all ${((track as any).likedBy||[]).includes(currentUser)?'text-blue-400':'text-slate-600 hover:text-blue-400'}`} title="Like"><i className={`fa-${((track as any).likedBy||[]).includes(currentUser)?'solid':'regular'} fa-thumbs-up text-[15px]`}/></button>
                            {reviews.some(r=>r.trackId===track.id&&r.user===currentUser)
                              ? <button className="w-6 h-6 flex items-center justify-center cursor-default text-yellow-400" title="Already reviewed"><i className="fa-solid fa-star text-[15px]"/></button>
                              : <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleSelectTrack(track);setReviewingTrackId(track.id);setShowMusicReviews(true);}} className="w-6 h-6 flex items-center justify-center text-slate-600 hover:text-yellow-400 transition-all" title="Review"><i className="fa-regular fa-star text-[15px]"/></button>}
                            <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleToggleFavorite(track.id,e);}} className={`w-6 h-6 flex items-center justify-center transition-all ${track.isFavorite?'text-pink-400':'text-slate-600 hover:text-pink-400'}`} title="Add to vault"><i className={`fa-${track.isFavorite?'solid':'regular'} fa-heart text-[15px]`}/></button>
                            <button onClick={e=>{e.stopPropagation();setConfirmDeleteId(track.id);}} className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all" title="Delete"><i className="fa-solid fa-xmark text-[15px]"/></button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            ):(
            <>{filteredTracks.length===0?(
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                <i className="fa-solid fa-music text-3xl text-slate-700 mb-6"/>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Archive Depleted</p>
              </div>
            ):filteredTracks.map((track, trackIdx)=>{
              const rating=getTrackRating(track.id);
              const reviewCount=approvedReviews.filter(r=>r.trackId===track.id).length;
              return(
                <div key={track.id}
                  data-trackid={track.id}
                  draggable={isAuthorized}
                  onDragStart={e=>{ dragSrcIdx.current=trackIdx; e.dataTransfer.effectAllowed='move'; }}
                  onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='move'; }}
                  onDrop={e=>{ e.preventDefault(); handleDragReorder(dragSrcIdx.current, trackIdx); dragSrcIdx.current=-1; }}
                  onDragEnd={()=>{ dragSrcIdx.current=-1; }}
                  onClick={()=>handleSelectTrack(track)}
                  className={`group flex items-center gap-2 px-[10px] py-[6px] rounded-lg transition-all cursor-pointer border relative ${currentTrackId===track.id?(isPlaying?'bg-purple-500/25 border-purple-400/40 shadow-lg shadow-purple-500/10':'bg-purple-500/25 border-purple-400/40 shadow-lg shadow-purple-500/10 animate-pulse'):'bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/25 hover:border-purple-400/40'}`}>
                  {confirmDeleteId===track.id&&(
                    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-xl flex items-center justify-between px-6 border border-red-500/20" onClick={e=>e.stopPropagation()}>
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Delete Track?</span>
                      <div className="flex gap-2">
                        <button onClick={()=>setConfirmDeleteId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                        <button onClick={e=>{e.stopPropagation();handleRemoveTrack(track.id);}} className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase">Destroy</button>
                      </div>
                    </div>
                  )}
                  {editingTrackId===track.id&&(
                    <div className="absolute left-0 right-0 z-50 bg-black border border-purple-500/30 rounded-xl shadow-2xl flex flex-col" style={{top:0,height:400}} onClick={e=>e.stopPropagation()}>
                      <div className="px-3 pt-2.5 pb-2 border-b border-white/10 flex-shrink-0"><p className="text-[9px] font-black uppercase tracking-widest text-purple-400 leading-none mb-0.5">{track.artist}</p><p className="text-[12px] font-bold text-white truncate">{track.title}</p></div>
                      <div className="grid grid-cols-2 gap-2 px-3 pt-2 flex-shrink-0"><div className="flex flex-col gap-1"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Artist</label><input value={editArtist} onChange={e=>setEditArtist(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50 w-full"/></div><div className="flex flex-col gap-1"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Title</label><input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50 w-full"/></div></div>
                      <div className="px-3 pt-2 flex-shrink-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">URL</label><input value={editUrl} onChange={e=>setEditUrl(e.target.value)} className="w-full mt-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50"/></div>
                      <div className="px-3 pt-2 flex-shrink-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500">Thumbnail URL</label><div className="flex gap-2 mt-1 items-center"><input value={editThumbnail} onChange={e=>setEditThumbnail(e.target.value)} placeholder="https://..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/50"/>{editThumbnail&&<img src={editThumbnail} alt="" className="w-10 h-8 rounded object-cover border border-white/20 flex-shrink-0" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} onLoad={e=>{(e.target as HTMLImageElement).style.display='block';}}/>}</div></div>
                      <div className="px-3 pt-2 flex-1 flex flex-col min-h-0"><label className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Genre</label><div className="flex gap-1 flex-wrap overflow-y-auto">{[...genres].sort((a,b)=>a.localeCompare(b)).map(g=><button key={g} onClick={()=>setEditCategory(g)} className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase border flex-shrink-0 h-fit transition-all ${editCategory===g?'bg-purple-600 border-purple-500 text-white':'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'}`}>{g}</button>)}</div></div>
                      <div className="flex gap-2 px-3 py-2 border-t border-white/10 flex-shrink-0"><button onClick={()=>setEditingTrackId(null)} className="flex-1 py-1.5 bg-white/5 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:bg-white/10 transition-all">Cancel</button><button onClick={()=>handleSaveEdit(track.id)} className="flex-1 py-1.5 bg-purple-600 text-white rounded-lg text-[9px] font-black uppercase hover:bg-purple-500 transition-all">Save</button></div>
                    </div>
                  )}
                  {/* Drag handle — admin only */}
                  {isAuthorized && (
                    <div onMouseDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} className="flex-shrink-0 flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-slate-600 hover:text-purple-400" title="Drag to reorder">
                      <i className="fa-solid fa-grip-vertical text-[10px]"/>
                    </div>
                  )}
                  {/* Thumbnail */}
                  <div className={`w-[140px] h-20 rounded-xl flex-shrink-0 border overflow-hidden relative ${currentTrackId===track.id?'border-purple-500/40':'border-white/5'}`}>
                    <TrackThumbnail artist={track.artist} title={track.title} category={track.category} thumbnail={track.thumbnail||''} style={{width:'100%',height:'100%'}}/>
                    {currentTrackId===track.id&&(
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <i className={`fa-solid ${isPlaying?'fa-pause':'fa-play'} text-white text-[10px]`}/>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 overflow-hidden flex flex-col justify-center gap-0 min-w-0">
                    <p className="text-[14px] font-black uppercase tracking-tight text-purple-400 truncate leading-none">{track.artist}</p>
                    <p className="text-[15px] font-bold leading-none truncate text-slate-300">{track.title}</p>
                    <div className="flex items-center flex-nowrap mt-[4px] overflow-hidden">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mr-1 shrink-0">{track.category}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-orange-500 text-[9px] font-black uppercase shrink-0">Listened::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{track.playCount||0}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-blue-500 text-[9px] font-black uppercase shrink-0">Liked::</span><span className="text-white text-[9px] font-black ml-0.5 mr-1 shrink-0">{track.likeCount||0}</span><span className="text-slate-700 text-[9px] mx-0.5 shrink-0">|</span><span className="text-purple-500 text-[9px] font-black uppercase shrink-0">Reviews::</span><span className="text-white text-[9px] font-black ml-0.5 shrink-0">{reviewCount}</span>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="flex flex-col flex-shrink-0 self-stretch relative w-6 ml-1">
                    {isAuthorized ? (
                      /* Admin: edit + delete only */
                      <>
                        <button onClick={e=>{e.stopPropagation();setEditingTrackId(track.id);setEditArtist(track.artist);setEditTitle(track.title);setEditCategory(track.category);setEditUrl(track.url||"");setEditThumbnail(track.thumbnail||"");}} className="absolute top-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-slate-500 hover:bg-purple-500/20 hover:border-purple-500/40 hover:text-purple-400 transition-all"><i className="fa-solid fa-pen text-[7px]"/></button>
                        <button onClick={e=>{e.stopPropagation();setConfirmDeleteId(track.id);}} className="absolute bottom-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[9px]"/></button>
                      </>
                    ) : (
                      /* User: star/review + like + heart + delete if own track */
                      <>
                        {(reviews.some(r=>r.trackId===track.id&&r.user===currentUser)
                          ? <button className="absolute top-[3px] left-0 w-6 h-6 flex items-center justify-center cursor-default text-yellow-400" title="Already reviewed"><i className="fa-solid fa-star text-[11px]"/></button>
                          : <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleSelectTrack(track);setReviewingTrackId(track.id);setShowMusicReviews(true);}} className="absolute top-[3px] left-0 w-6 h-6 flex items-center justify-center text-slate-600 hover:text-yellow-400 transition-all" title="Review"><i className="fa-regular fa-star text-[11px]"/></button>)}
                        <div className="flex flex-col items-center justify-center flex-1 gap-0.5 pt-7 pb-7">
                          <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleLikeTrack(track.id,e);}} className={`w-6 h-6 flex items-center justify-center transition-all ${((track as any).likedBy||[]).includes(currentUser)?'text-blue-400':'text-slate-600 hover:text-blue-400'}`} title="Like"><i className={`fa-${((track as any).likedBy||[]).includes(currentUser)?'solid':'regular'} fa-thumbs-up text-[11px]`}/></button>
                          <button onClick={e=>{e.stopPropagation();if(!isUserLocked){onPendingReview();return;}handleToggleFavorite(track.id,e);}} className={`w-6 h-6 flex items-center justify-center transition-all ${track.isFavorite?'text-pink-400':'text-slate-600 hover:text-pink-400'}`} title="Add to vault"><i className={`fa-${track.isFavorite?'solid':'regular'} fa-heart text-[11px]`}/></button>
                        </div>
                        {(isUserLocked&&track.addedBy===currentUser)&&<button onClick={e=>{e.stopPropagation();setConfirmDeleteId(track.id);}} className="absolute bottom-[3px] left-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"><i className="fa-solid fa-xmark text-[9px]"/></button>}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            </>
            )}
          </div>
        </aside>

        {/* ── Full-screen visual area ── */}
        <section className="music-visual-section flex-1 flex flex-col bg-transparent overflow-y-auto min-w-0 custom-scrollbar">
          {currentTrack&&(
            <div className="absolute opacity-0 pointer-events-none w-0 h-0">
              {type==='soundcloud'
                ? <iframe key={`sc-${currentTrackId}`} id="sc-player" width="1" height="1" scrolling="no" frameBorder="no" allow="autoplay" src={embedUrl}/>
                : (type as string)!=='audiomack' &&
                  <iframe key={`yt-${currentTrackId}`} id="yt-player" width="1" height="1" src={embedUrl} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen
                    onLoad={e=>{ try{(e.target as HTMLIFrameElement).contentWindow?.postMessage(JSON.stringify({event:'listening',id:1}),'*');}catch{} }}
                  />
              }
            </div>
          )}
          <div className="w-full flex flex-col pt-4 gap-0">
            <div className="flex items-start gap-4 px-8 mb-4">
              {/* Left: label */}
              <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                <span className="w-1 h-4 bg-purple-500 rounded-full flex-shrink-0"/>
                <h2 className="text-purple-500 font-black uppercase text-[10px] tracking-[0.4em] whitespace-nowrap">{currentTrack?'Now Playing':'Select Track'}</h2>
              </div>
              {/* Right: genre tabs — multi-select, accumulates on click */}
              <div className="flex-1 min-w-0" style={{overflow:"visible"}}>
                <div className="flex flex-wrap gap-1 pt-2">
                  {allTabs.map(tab=>{
                    const c = getTabColor(tab.name);
                    const isSelected = tab.name==='All' ? (activeTab==='All' && selectedGenres.length===0)
                      : tab.name==='Vault' ? activeTab==='Vault'
                      : activeTab === tab.name;
                    return (
                      <div key={tab.name} className="relative group/mtab">
                        <button
                          type="button"
                          onMouseEnter={e=>{ if(!isSelected){ const b=e.currentTarget as HTMLButtonElement; b.style.color=c; b.style.borderColor=`${c}70`; }}}
                          onMouseLeave={e=>{ if(!isSelected){ const b=e.currentTarget as HTMLButtonElement; b.style.color='#ffffff'; b.style.borderColor='rgba(255,255,255,0.08)'; }}}
                          onMouseDown={e=>{
                            e.preventDefault(); e.stopPropagation();
                            if(tab.name==='All'){
                              setActiveTab('All'); selectedGenresRef.current=[]; setSelectedGenres([]);
                            } else if(tab.name==='Vault'){
                              setActiveTab('Vault'); selectedGenresRef.current=[]; setSelectedGenres([]);
                            } else {
                              // Single select — clicking same tab goes back to All
                              if(activeTab===tab.name){ setActiveTab('All'); selectedGenresRef.current=[]; setSelectedGenres([]); }
                              else { setActiveTab(tab.name as any); selectedGenresRef.current=[tab.name]; setSelectedGenres([tab.name]); }
                            }
                          }}
                          className="px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                          style={isSelected
                            ? {color:c, backgroundColor:`${c}25`, borderColor:`${c}50`}
                            : {color:'#ffffff', borderColor:'rgba(255,255,255,0.08)', backgroundColor:'transparent'}}
                        >
                          <span className="opacity-0 group-hover/mtab:opacity-100 text-[7px] group-hover/mtab:text-[9px] font-black mr-0.5 transition-all duration-150">{tab.name==="All"?tracks.length:tab.name==="Vault"?tracks.filter(t=>t.isFavorite).length:tracks.filter(t=>t.category===tab.name).length}</span>{tab.name}
                        </button>
                        {isAuthorized && !['All','Vault'].includes(tab.name) && (
                          <button
                            type="button"
                            onMouseDown={e=>{e.stopPropagation();handleRemoveGenre(tab.name);}}
                            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/mtab:opacity-100 transition-opacity z-30 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"
                          ><i className="fa-solid fa-xmark text-[7px]"/></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-8 w-full">
              <div ref={musicPlayerRef} onClick={()=>{if(currentTrackId) setIsPlaying(p=>!p);}} className="w-full max-w-[calc(100%-20px)] max-h-[calc(100vh-240px)] aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative mx-auto" style={{cursor:currentTrackId?'pointer':'default'}}>
                {/* Idle state — only shown when no track selected */}
                {!currentTrackId && (
                  <div style={{position:'absolute',inset:0,zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
                    <video autoPlay muted loop playsInline preload="auto" src="/Default-video.mp4" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>

                  </div>
                )}



                {/* Gallery slideshow */}
                {currentTrack&&galleryTrackId===currentTrack.id&&(
                  <GallerySlideshow
                    images={currentTrack.galleryImages||[]}
                    onClose={()=>setGalleryTrackId(null)}
                    isAuthorized={isAuthorized}
                    onAdd={(url)=>{const imgs=[...(currentTrack.galleryImages||[]),url];setTracks(p=>p.map(t=>t.id===currentTrack.id?{...t,galleryImages:imgs}:t));saveMusicToFirestore([...tracks].map(t=>t.id===currentTrack.id?{...t,galleryImages:imgs}:t));}}
                    onDelete={(i)=>{const imgs=(currentTrack.galleryImages||[]).filter((_,j)=>j!==i);setTracks(p=>p.map(t=>t.id===currentTrack.id?{...t,galleryImages:imgs}:t));saveMusicToFirestore([...tracks].map(t=>t.id===currentTrack.id?{...t,galleryImages:imgs}:t));}}
                  />
                )}
                {/* AudioMack — show only waveform strip, clip promo popup */}
                {currentTrack&&(type as string)==='audiomack'&&(
                  <div style={{position:'absolute',inset:0,zIndex:5,overflow:'hidden',background:'#0a0010'}}>
                    <iframe
                      key={`am-${currentTrackId}`}
                      id="am-player"
                      src={embedUrl}
                      width="100%"
                      height="252"
                      style={{
                        position:'absolute',
                        bottom:0,
                        left:0,
                        width:'100%',
                        height:252,
                        border:'none',
                        display:'block',
                        marginBottom:0
                      }}
                      title={currentTrack.title}
                    />
                  </div>
                )}
                {/* SC iframe — audio only, waveform shows at bottom when playing */}
                {currentTrack&&(type as string)!=='audiomack'&&(
                  <iframe
                    key={`vis-${currentTrackId}`}
                    id="music-main-player"
                    src={embedUrl}
                    width="100%"
                    style={{width:'100%',height:'100%',border:'none',display:'block',position:'absolute',inset:0,zIndex:9,opacity:(type==='soundcloud'&&isPlaying)?1:0,pointerEvents:(type==='soundcloud'&&isPlaying)?'auto':'none',clipPath:'inset(calc(100% - 80px) 0 0 0)',transition:'opacity 0.5s ease 3s'}}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                )}
                {/* Paused: show default video above iframe (zIndex 10 > iframe zIndex 9) */}
                {currentTrack&&(type as string)!=='audiomack'&&!isPlaying&&(
                  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:10}}>
                    <video autoPlay muted loop playsInline preload="auto" src="/Default-video.mp4" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                )}
                {/* Playing: track thumbnail */}
                {currentTrack&&(type as string)!=='audiomack'&&isPlaying&&(
                  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:5}}>
                    <img src={getThumbnailUrl(currentTrack)} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.35,filter:'blur(30px)',transform:'scale(1.08)'}}/>
                    <img src={getThumbnailUrl(currentTrack)} alt={currentTrack.title} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                    {type==='youtube'&&(
                      <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0.6))'}}>
                        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'20px',display:'flex',flexDirection:'column',gap:6}}>
                          <div style={{display:'flex',alignItems:'flex-end',gap:3,height:28,marginBottom:2}}>{Array.from({length:24},(_,i)=>{const h=20+Math.abs(Math.sin(i*0.7+0.9)*Math.cos(i*0.4))*80;return <div key={i} style={{width:3,borderRadius:2,background:`hsl(${200+i*6},90%,65%)`,height:`${h}%`,animation:`scBar ${0.5+i*0.04}s ease-in-out infinite alternate`,animationDelay:`${i*0.06}s`}}/>;})}</div>
                          <p style={{color:'rgba(255,255,255,0.7)',fontWeight:900,fontSize:10,textTransform:'uppercase',letterSpacing:'0.2em',margin:0}}>{currentTrack.artist}</p>
                          <p style={{color:'#fff',fontWeight:700,fontSize:15,margin:0,textShadow:'0 1px 10px rgba(0,0,0,0.9)'}}>{currentTrack.title}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Dark gradient at bottom to blend SC waveform with image */}
                {currentTrack&&type==='soundcloud'&&isPlaying&&(
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:'100px',zIndex:8,background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 100%)',pointerEvents:'none'}}/>
                )}
                {/* Visualizer — always mounted when track present, shown/hidden via opacity only */}
                <div style={{position:'absolute',inset:0,zIndex:10,opacity:showVisualizer?1:0,transition:'opacity 0.4s ease',pointerEvents:showVisualizer?'auto':'none'}} onClick={e=>e.stopPropagation()}>
                  {currentTrack && <VisualizerCanvas key={vizKey} onActivate={()=>setShowVisualizer(true)} active={showVisualizer} initialMode={vizInitialMode} isPlaying={isPlaying} hideEq={type==='soundcloud'}/>}
                </div>
                {/* Open visualizer button */}
                
              </div>
            </div>
            
            <div className="w-full mt-2 px-8">
              <div className="bg-white/5 border border-white/5 rounded-3xl flex flex-wrap items-center px-8 py-4 w-full gap-3">
                {currentTrack?(<><Tooltip label={`${currentTrack.category} · ${tracks.filter(t=>t.category===currentTrack.category).length} tracks`}><span className="px-3 py-1 border text-[10px] font-black uppercase rounded-full tracking-widest shrink-0 cursor-default" style={getTagStyles(currentTrack.category)}>{currentTrack.category}</span></Tooltip><span className="text-slate-600 text-[8px]">|</span><span className="text-[11px] font-black uppercase tracking-widest text-purple-400">{currentTrack.artist}</span><span className="text-slate-600 text-[8px]">—</span><span className="text-[11px] font-bold text-slate-300 truncate">{currentTrack.title}</span><div className="flex items-center gap-6"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Listened::</span><span className="text-[13px] font-black text-white">{currentTrack.playCount||0}</span></div><div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Liked::</span><span className="text-[13px] font-black text-white">{currentTrack.likeCount||0}</span></div><button onClick={()=>{if(!isUserLocked&&!isAuthorized){onPendingReview();return;}setShowMusicReviews(v=>!v);}} className="flex items-center gap-2 hover:opacity-70 transition-opacity"><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Reviews::</span><span className="text-[13px] font-black text-white">{approvedReviews.filter(r=>r.trackId===currentTrack.id).length}</span></button><button onClick={()=>{if(!isUserLocked&&!isAuthorized){onPendingReview();return;}setShowMusicVault(v=>!v);}} className="flex items-center gap-2 hover:opacity-70 transition-opacity"><i className="fa-solid fa-heart text-pink-400 text-[11px]"/><span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">{displayName(currentUser)}'s Music Vault::</span><span className="text-[13px] font-black text-white">{tracks.filter(t=>t.isFavorite).length}</span></button></div><button onClick={()=>setShowVisualizer(v=>!v)} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${showVisualizer?"text-purple-400 bg-purple-500/20 border-purple-500/40":"text-slate-500 hover:text-white border-white/10 bg-white/5"}`}><i className="fa-solid fa-wave-square text-[10px]"/><span>Viz</span></button><button onClick={()=>setGalleryTrackId(v=>v===currentTrack.id?null:currentTrack.id)} className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${galleryTrackId===currentTrack.id?"text-purple-400 bg-purple-500/20 border-purple-500/40":"text-slate-500 hover:text-white border-white/10 bg-white/5"}`}><i className="fa-solid fa-images text-[10px]"/><span>Gallery</span></button><button onClick={handleMusicFullscreen} className="text-slate-500 hover:text-white transition-colors ml-auto" title="Fullscreen"><i className={`fa-solid ${isMusicFullscreen?'fa-compress':'fa-expand'} text-[16px]`}/></button></>):(<div className="flex items-center gap-6"><div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Listened::</span><span className="text-[13px] font-black text-white">0</span></div><div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Liked::</span><span className="text-[13px] font-black text-white">0</span></div><div className="flex items-center gap-2"><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Reviews::</span><span className="text-[13px] font-black text-white">0</span></div></div>)}
              </div>
            </div>

            {/* ── Music Vault (inline) ── */}
            {showMusicVault && (
              <div className="w-full px-8 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-pink-400 flex items-center gap-2"><i className="fa-solid fa-heart"/>{displayName(currentUser)}'s Music Vault</p>
                  <button onClick={()=>setShowMusicVault(false)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xs"/></button>
                </div>
                {tracks.filter(t=>t.isFavorite).length===0 ? (
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center py-4">No favorites yet — click ❤️ to add</p>
                ) : (
                  <div className="space-y-1">
                    {tracks.filter(t=>t.isFavorite).map(t=>(
                      <div key={t.id} onClick={()=>handleSelectTrack(t)} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:bg-white/5 ${currentTrackId===t.id?'bg-white/10':''}`}>
                        <div className="w-10 h-8 rounded-md overflow-hidden flex-shrink-0 border border-white/5">
                          <TrackThumbnail artist={t.artist} title={t.title} category={t.category} thumbnail={getThumbnailUrl(t)} style={{width:'100%',height:'100%'}}/>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-slate-300 truncate leading-none">{t.title}</p>
                          <p className="text-[11px] font-black uppercase text-purple-400 truncate leading-none">{t.artist}</p>
                        </div>
                        <button onClick={e=>{e.stopPropagation();handleToggleFavorite(t.id,e);}} className="text-pink-400 hover:text-slate-500 transition-colors"><i className="fa-solid fa-heart text-[11px]"/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Write review form (inline) ── */}
            {currentTrack && showMusicReviews && (
              <div className="w-full px-8 mt-3" ref={musicReviewRef}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5 w-fit">
                    <button onClick={()=>setReviewingTrackId(null)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${reviewingTrackId!==currentTrack.id?'bg-purple-600 text-white shadow':'text-slate-400 hover:text-white'}`}>Read</button>
                    {!reviews.some(r=>r.trackId===currentTrack.id&&r.user===currentUser) && (
                      <button onClick={()=>setReviewingTrackId(currentTrack.id)} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${reviewingTrackId===currentTrack.id?'bg-purple-600 text-white shadow':'text-slate-400 hover:text-white'}`}>Review</button>
                    )}
                  </div>
                  {reviews.some(r=>r.trackId===currentTrack.id&&r.user===currentUser) && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Already reviewed</span>
                  )}
                </div>
              </div>
            )}

            {reviewingTrackId===currentTrack?.id && showMusicReviews && (
              <div className="w-full px-8 mt-3" ref={el=>el?.scrollIntoView({behavior:'smooth',block:'nearest'})}>
                <div className="bg-white/5 border border-purple-500/20 rounded-2xl px-6 py-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-purple-400">Write a Review</p>
                  <StarRating value={reviewRating} onChange={setReviewRating} size="text-xl"/>
                  <textarea autoFocus value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Write your review..." rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30 resize-none"/>
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>setReviewingTrackId(null)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
                    <button onClick={handleSubmitReview} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase hover:bg-purple-500 transition-all">Submit</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Approved Reviews ── */}
            {currentTrack && showMusicReviews && reviewingTrackId!==currentTrack.id && (
              <div className="w-full px-8 mt-4">
                {/* User's own pending review */}
                {!isAuthorized && reviews.filter(r=>r.trackId===currentTrack.id&&r.user===currentUser&&!r.approved).map(r=>(
                  <div key={r.id} className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-4 flex gap-4 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                      <i className="fa-solid fa-user text-orange-400 text-[10px]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{currentUser?.replace(/_/g,' ')}</span>
                        <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=r.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                        <span className="text-[8px] text-orange-500 font-black uppercase">⏳ Pending</span>
                      </div>
                      {r.comment&&<p className="text-[12px] text-slate-300 leading-relaxed">{r.comment}</p>}
                    </div>
                  </div>
                ))}
                {approvedReviews.filter(r=>r.trackId===currentTrack.id).length===0 ? (
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center py-4">No reviews yet — be the first</p>
                ) : (
                <div className="space-y-2">
                  {approvedReviews.filter(r=>r.trackId===currentTrack.id).map(rev=>(
                    <div key={rev.id} className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                        <i className="fa-solid fa-user text-purple-400 text-[10px]"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">{rev.user.replace(/_/g,' ')}</span>
                          <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=rev.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                          <span className="text-[8px] text-slate-600">{new Date(rev.timestamp).toLocaleDateString()}</span>
                          {isAuthorized&&<button onClick={()=>setReviews(p=>p.filter(r=>r.id!==rev.id))} className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"><i className="fa-solid fa-xmark text-[9px]"/></button>}
                        </div>
                        {rev.comment&&<p className="text-[12px] text-slate-300 leading-relaxed">{rev.comment}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* ── Pending reviews (admin only) ── */}
            {isAuthorized && currentTrack && showMusicReviews && reviews.filter(r=>r.trackId===currentTrack.id&&!r.approved).length>0 && (
              <div className="w-full px-8 mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-2 px-1">Pending Approval</p>
                <div className="space-y-2">
                  {reviews.filter(r=>r.trackId===currentTrack.id&&!r.approved).map(rev=>(
                    <div key={rev.id} className="bg-orange-500/5 border border-orange-500/20 rounded-2xl px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{rev.user.replace(/_/g,' ')}</span>
                        <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=rev.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                      </div>
                      {rev.comment&&<p className="text-[12px] text-slate-300 leading-relaxed mb-2">{rev.comment}</p>}
                      <div className="flex gap-2">
                        <button onClick={()=>setReviews(p=>p.map(r=>r.id===rev.id?{...r,approved:isAuthorized}:r))} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-green-500 transition-all">Approve</button>
                        <button onClick={()=>setReviews(p=>p.filter(r=>r.id!==rev.id))} className="px-3 py-1 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-[8px] font-black uppercase hover:bg-red-600/40 transition-all">Reject</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pb-20"/>
          </div>
        </section>
      </div>

      {/* ── Identify Modal ── */}
      {showIdentify&&(
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center" onClick={()=>setShowIdentify(false)}>
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-8 w-84 shadow-2xl" style={{width:340}} onClick={e=>e.stopPropagation()}>

            {/* Avatar upload */}
            <div className="flex flex-col items-center mb-6">
              <label className="cursor-pointer group relative" title="Click to upload photo">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-blue-500/40 bg-blue-600/10 flex items-center justify-center group-hover:border-blue-400 transition-all shadow-lg">
                  {identifyPic
                    ? <img src={identifyPic} alt="avatar" className="w-full h-full object-cover"/>
                    : <i className="fa-solid fa-user-astronaut text-2xl text-blue-400"/>
                  }
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <i className="fa-solid fa-camera text-white text-sm"/>
                  </div>
                </div>
                <input
                  type="file" accept="image/*" className="hidden"
                  onChange={e=>{
                    const file = e.target.files?.[0];
                    if(!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => setIdentifyPic(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest mt-2">{identifyPic ? 'Click to change photo' : 'Click to add photo'}</p>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <div className="flex-1 h-px bg-white/5"/>
              <p className="text-[9px] font-black uppercase tracking-widest text-blue-400">Identify · IntegralStream</p>
              <div className="flex-1 h-px bg-white/5"/>
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Your Name</label>
              <input
                autoFocus type="text" value={identifyName}
                onChange={e=>{
                  const val = e.target.value;
                  setIdentifyName(val);
                  setIdentifyErr('');
                  // Auto-load saved pic if this name is recognised
                  const key = val.trim().toUpperCase().replace(/\s+/g,'_');
                  const savedPic = key ? getUserPic(key) : '';
                  if(savedPic) setIdentifyPic(savedPic);
                }}
                onKeyDown={e=>e.key==='Enter'&&handleIdentify()}
                placeholder="Enter your name"
                className="w-full h-10 px-4 rounded-xl bg-black/60 border border-white/10 text-white text-sm font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500/40 uppercase"
              />
              {identifyErr&&<p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-2">{identifyErr}</p>}
              {isUserLocked&&!currentUser.startsWith('NEURAL_NODE')&&<p className="text-[9px] text-slate-600 uppercase tracking-widest mt-2">Currently: {displayName(currentUser)}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowIdentify(false)} className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
              <button onClick={handleIdentify} className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">Confirm</button>
            </div>
            {isUserLocked&&(
              <button onClick={handleIdentifyLogout} className="w-full mt-2 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-500 text-[10px] font-black uppercase hover:text-red-400 hover:border-red-500/20 transition-all flex items-center justify-center gap-2">
                <i className="fa-solid fa-arrow-right-from-bracket text-xs"/>Log Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Admin Login Modal ── */}
      {showAdminLogin&&(
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center" onClick={()=>setShowAdminLogin(false)}>
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-8 w-80 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                <i className="fa-solid fa-lock text-blue-400"/>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-blue-400">Admin Access</p>
                <p className="text-[9px] text-slate-600 uppercase tracking-widest">IntegralStream</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Password</label>
              <input
                autoFocus type="password" value={adminPass}
                onChange={e=>{setAdminPass(e.target.value);setAdminError('');}}
                onKeyDown={e=>e.key==='Enter'&&handleAdminLogin()}
                placeholder="Enter admin password"
                className="w-full h-10 px-4 rounded-xl bg-black/60 border border-white/10 text-white text-sm font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500/40"
              />
              {adminError&&<p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-2">{adminError}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowAdminLogin(false)} className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
              <button onClick={handleAdminLogin} className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">Unlock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




const DATA_KEY = `integral_vault_v${LIBRARY_VERSION}`;
const VERSION_KEY = `integral_version_v${LIBRARY_VERSION}`;
const CAT_KEY = `integral_categories_v${LIBRARY_VERSION}`;
const CAT_COLORS_KEY = `integral_cat_colors_v${LIBRARY_VERSION}`;

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
const StarRatingWidget=({value,onChange,size='text-sm'}:{value:number;onChange?:(v:number)=>void;size?:string})=>(
  <div className="flex items-center gap-0.5">
    {[1,2,3,4,5].map(s=>(
      <button key={s} onClick={()=>onChange?.(s)} className={`${onChange?'cursor-pointer hover:scale-125':'cursor-default'} transition-transform`}>
        <i className={`fa-${s<=Math.round(value)?'solid':'regular'} fa-star ${size} ${s<=Math.round(value)?'text-yellow-400':'text-slate-700'}`}/>
      </button>
    ))}
  </div>
);

const App: React.FC = () => {
  const [isVideoShuffleMode, setIsVideoShuffleMode] = useState(false);
  const isVideoShuffleModeRef = useRef(false);
  useEffect(()=>{ isVideoShuffleModeRef.current = isVideoShuffleMode; }, [isVideoShuffleMode]);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return localStorage.getItem(AUTH_KEY) === 'true';
  });
  
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

  const [showMusic, setShowMusic] = useState(false);
  const [showUserPlaylist, setShowUserPlaylist] = useState(false);
  const openMusicWithPlaylist = () => {
    setShowMusic(true);
    setIsPlaying(false);
    // Force pause video iframe since postMessage doesn't work on localhost
    setTimeout(()=>{
      const iframe = document.querySelector('iframe[src*="youtube"]') as HTMLIFrameElement|null;
      if(iframe) {
        const src = iframe.src;
        iframe.src = src.replace('autoplay=1','autoplay=0');
      }
    }, 100);
  };
  const [showLoginOverlay, setShowLoginOverlay] = useState(false);
  const [loginDefaultTab, setLoginDefaultTab] = useState<'Identify'|'Terminal'|'Restore'>('Identify');
  const [playlists, setPlaylists] = useState<UserPlaylist[]>(()=> getPlaylists());
  const [showPlaylistPanel, setShowPlaylistPanel] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [activePlaylistId, setActivePlaylistId] = useState<string|null>(null);
  const userPlaylists = useMemo(() => playlists.filter(p => p.owner === currentUser), [playlists, currentUser]);
  const activePlaylist = useMemo(() => playlists.find(p => p.id === activePlaylistId) || null, [playlists, activePlaylistId]);
  // pic state: just a version counter to force re-renders when pic changes
  const [picVersion, setPicVersion] = useState(0);
  const [currentProfilePic, setCurrentProfilePic] = useState(() => getUserPic(currentUser));
  const adminPic = useMemo(() => getUserPic(ADMIN_USER), [picVersion]);
  useEffect(() => { setCurrentProfilePic(getUserPic(currentUser)); }, [currentUser, picVersion]);
  const [activeSecondaryView, setActiveSecondaryView] = useState<'none' | 'reviews' | 'vault' | 'moderation'>('none');
  const [reviewInitialTab, setReviewInitialTab] = useState<'Read' | 'Write'>('Read');
  const [showVideoReviews, setShowVideoReviews] = useState(false);
  const videoReviewRef = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(showVideoReviews && videoReviewRef.current){
      setTimeout(()=>videoReviewRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100);
    }
  },[showVideoReviews, activeSecondaryView]);
  const [reviewingVideoId, setReviewingVideoId] = useState<string|null>(null);
  const [videoReviewRating, setVideoReviewRating] = useState(5);
  const [videoReviewComment, setVideoReviewComment] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoCrossfading, setVideoCrossfading] = useState(false);
  const currentVideoIdRef = useRef<string | undefined>(undefined);
  const [playlistTab, setPlaylistTab] = useState<VideoCategory | 'All' | 'Vault'>('All');
  const [showAddCatForm, setShowAddCatForm] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#94a3b8');
  const [isSyncingLive, setIsSyncingLive] = useState(false);
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [cloudVersion, setCloudVersion] = useState<number>(LIBRARY_VERSION);
  const [showPendingToast, setShowPendingToast] = useState(false);
  const [showVisitorToast, setShowVisitorToast] = useState(false);
  const [showFeatureToast, setShowFeatureToast] = useState(false);
  const requireUser = () => {
    if (!isUserLocked && !isAuthorized) {
      setShowVisitorToast(true);
      setTimeout(() => setShowVisitorToast(false), 3000);
      return false;
    }
    return true;
  };

  // Morphing text for visitor button
  const VISITOR_TEXTS = ['Pick a Username', 'Log In'];
  const [visitorTextIdx, setVisitorTextIdx] = useState(0);
  const [visitorTextFade, setVisitorTextFade] = useState(true);
  useEffect(() => {
    if (isUserLocked || isAuthorized) return;
    const interval = setInterval(() => {
      setVisitorTextFade(false);
      setTimeout(() => {
        setVisitorTextIdx(i => (i + 1) % VISITOR_TEXTS.length);
        setVisitorTextFade(true);
      }, 400);
    }, 2500);
    return () => clearInterval(interval);
  }, [isUserLocked, isAuthorized]);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  useEffect(() => { const h = () => setIsVideoFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  useEffect(() => { const h = () => setPicVersion(v => v+1); window.addEventListener('picUpdated', h); return () => window.removeEventListener('picUpdated', h); }, []);
  const checkSyncLock = useRef(false);

  useEffect(() => {
    localStorage.setItem(USER_KEY, currentUser);
    localStorage.setItem(USER_LOCKED_KEY, isUserLocked ? 'true' : 'false');
    localStorage.setItem(USER_NODE_ID_KEY, nodeId);
  }, [currentUser, isUserLocked, nodeId]);

  useEffect(() => {
    localStorage.setItem(FAV_MAP_KEY, JSON.stringify(userFavMap));
  }, [userFavMap]);

  useEffect(() => { savePlaylists(playlists); }, [playlists]);



  const handleIdentify = (name: string, remember: boolean, pic?: string) => {
    const cleanName = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (cleanName) {
      // Log out admin session first
      setIsAuthorized(false);
      localStorage.removeItem(AUTH_KEY);
      setCurrentUser(cleanName);
      setIsUserLocked(true);
      if (remember) {
        localStorage.setItem(USER_KEY, cleanName);
        localStorage.setItem(USER_LOCKED_KEY, 'true');
      }
      if (pic) { setUserPic(cleanName, pic); setPicVersion(v => v+1); window.dispatchEvent(new Event('picUpdated')); }
      setShowLoginOverlay(false);
      return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(MASTER_IDENTITY);
    setIsUserLocked(false);
    // Keep USER_KEY so the login panel can pre-fill name + pic on next visit
    localStorage.removeItem(USER_LOCKED_KEY);
    setShowUserPlaylist(false);
    setActiveSecondaryView('none');
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

  // Sync auth state between Music and Video pages
  useEffect(() => {
    const sync = () => setIsAuthorized(localStorage.getItem(AUTH_KEY) === 'true');
    const onStorage = (e: StorageEvent) => { if (e.key === AUTH_KEY) sync(); };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', sync);
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', sync); };
  }, []);

  const handleAdminLogin = (pass: string, remember: boolean) => {
    if (pass === ADMIN_PASSWORD) {
      // Log out any user session first
      setCurrentUser(MASTER_IDENTITY);
      setIsUserLocked(false);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(USER_LOCKED_KEY);
      setIsAuthorized(true);
      localStorage.setItem(AUTH_KEY, 'true');
      window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'true' }));
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
    const savedDataStr = localStorage.getItem(DATA_KEY);
    const savedVersion = localStorage.getItem(VERSION_KEY);
    const isOldVersion = !savedVersion || parseInt(savedVersion, 10) < LIBRARY_VERSION;
    const deletedIds = new Set(JSON.parse(localStorage.getItem(`integral_deleted_videos_v${LIBRARY_VERSION}`) || '[]'));
    if (!savedDataStr || isOldVersion) return currentSource;
    try {
      const baseData: VideoItem[] = JSON.parse(savedDataStr);
      const currentSourceMap = new Map(currentSource.map(v => [v.url, v]));
      const deletedRevIds = new Set(JSON.parse(localStorage.getItem(`integral_deleted_reviews_v${LIBRARY_VERSION}`) || '[]'));
      const syncedData = baseData
        .filter(lv => !deletedIds.has(lv.id))
        .map(lv => { lv = {...lv, reviews: (lv.reviews||[]).filter((r:any)=>!deletedRevIds.has(r.id))};
          const sv = currentSourceMap.get(lv.url);
          if (sv) return { ...sv, id: lv.id, viewCount: lv.viewCount, likeCount: lv.likeCount, dislikeCount: lv.dislikeCount, reviews: lv.reviews || [] };
          return lv;
        });
      const localUrls = new Set(syncedData.map(v => v.url));
      const newItems = currentSource.filter(v => !localUrls.has(v.url) && !deletedIds.has(v.id));
      return [...newItems, ...syncedData];
    } catch (e) { return currentSource; }
  });

  const [currentVideoId, setCurrentVideoId] = useState<string | undefined>(undefined);
  useEffect(() => { currentVideoIdRef.current = currentVideoId; }, [currentVideoId]);

  // ── Firestore: load videos on mount & subscribe to live changes ───────────
  const videoFirestoreUpdating = useRef(false);
  const lastVideoSaveTime = useRef(0);
  const DELETED_IDS_KEY = `integral_deleted_videos_v${LIBRARY_VERSION}`;
  const DELETED_REVIEWS_KEY = `integral_deleted_reviews_v${LIBRARY_VERSION}`;
  const deletedVideoIds = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem(DELETED_IDS_KEY) || '[]')
  ));
  const deletedReviewIds = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem(DELETED_REVIEWS_KEY) || '[]')
  ));
  const unsubVideos = useRef<()=>void>(()=>{});

  useEffect(() => {
    loadVideosFromFirestore().then(remote => {
      if (remote && remote.length > 0) {
        videoFirestoreUpdating.current = true;
        const filtered = (remote as VideoItem[])
          .filter(v => !deletedVideoIds.current.has(v.id))
          .map(v => ({...v, reviews: (v.reviews||[]).filter((r:any)=>!deletedReviewIds.current.has(r.id))}));
        setVideos(filtered);
        try { localStorage.setItem(DATA_KEY, JSON.stringify(filtered)); localStorage.setItem(VERSION_KEY, LIBRARY_VERSION.toString()); } catch {}
      }
    });
    unsubVideos.current = subscribeToVideos(remote => {
      // Always filter out locally deleted videos
      const filtered = (remote as VideoItem[])
        .filter(v => !deletedVideoIds.current.has(v.id))
        .map(v => ({...v, reviews: (v.reviews||[]).filter((r:any)=>!deletedReviewIds.current.has(r.id))}));
      if(Date.now() - lastVideoSaveTime.current < 5000) {
        try { localStorage.setItem(DATA_KEY, JSON.stringify(filtered)); } catch {}
        return;
      }
      videoFirestoreUpdating.current = true;
      setVideos(filtered);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(filtered)); localStorage.setItem(VERSION_KEY, LIBRARY_VERSION.toString()); } catch {}
    });
    return () => unsubVideos.current();
  }, []);

  // ── Firestore: save videos on change (debounced 1.5s) ────────────────────
  useEffect(() => {
    if(videoFirestoreUpdating.current){ videoFirestoreUpdating.current = false; return; }
    const t = setTimeout(() => {
      lastVideoSaveTime.current = Date.now();
      saveVideosToFirestore(videos);
    }, 1500);
    // Keep localStorage in sync as offline fallback
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(videos));
      localStorage.setItem(VERSION_KEY, LIBRARY_VERSION.toString());
      localStorage.setItem(AUTH_KEY, isAuthorized ? 'true' : 'false');
      localStorage.setItem(CAT_KEY, JSON.stringify(categories));
      localStorage.setItem(CAT_COLORS_KEY, JSON.stringify(categoryColors));
    } catch(e) {
      try {
        const minimal = videos.map(v=>({...v, reviews:[]}));
        localStorage.setItem(DATA_KEY, JSON.stringify(minimal));
      } catch {}
    }
    return () => clearTimeout(t);
  }, [videos, isAuthorized, categories, categoryColors]);

  const currentUserFavorites = useMemo(() => userFavMap[currentUser] || [], [userFavMap, currentUser]);
  const vaultCount = useMemo(() => currentUserFavorites.length, [currentUserFavorites]);

  const pendingReviewsCount = useMemo(() => {
    return videos.reduce((acc, video) => {
      return acc + (video.reviews?.filter(r => !r.isApproved).length || 0);
    }, 0);
  }, [videos]);

  const handleRemoveVideo = useCallback((id: string) => {
    deletedVideoIds.current.add(id);
    // Persist deleted IDs so they survive page refresh
    try { localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...deletedVideoIds.current])); } catch {}
    // Unsubscribe so Firestore can't push the video back
    unsubVideos.current();
    unsubVideos.current = () => {};
    setVideos(prev => {
      const filtered = prev.filter(v => v.id !== id);
      if (currentVideoId === id) setCurrentVideoId(filtered.length > 0 ? filtered[0].id : undefined);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(filtered)); } catch {}
      lastVideoSaveTime.current = Date.now();
      saveVideosToFirestore(filtered);
      return filtered;
    });
    setUserFavMap(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(u => { next[u] = next[u].filter(fid => fid !== id); });
      return next;
    });
  }, [currentVideoId]);

  const handleEditVideo = useCallback((id: string, prompt: string, category: string) => {
    setVideos(prev => prev.map(v => v.id === id ? {...v, prompt: prompt||v.prompt, category: (category||v.category) as VideoCategory} : v));
  }, []);

  const handleManualAdd = useCallback((u: string, p: string, c: VideoCategory) => {
    const isUserVideo = isUserLocked && currentUser !== MASTER_IDENTITY;
    const ytId = u.includes('youtu.be/') ? u.split('youtu.be/')[1]?.split(/[?&/#]/)[0] : u.includes('v=') ? u.split('v=')[1]?.split(/[?&/#]/)[0] : '';
    const thumbnail = ytId ? `https://i.ytimg.com/vi/${ytId.trim()}/hqdefault.jpg` : '';
    const nv: any = { id: `m-${Date.now()}`, url: u, prompt: p, category: c, thumbnail, isFavorite: false, viewCount: 0, likeCount: 0, dislikeCount: 0, status: 'ready', timestamp: Date.now(), rating: 0, isLiked: false, isDisliked: false, reviews: [], ...(isUserVideo ? { addedBy: currentUser } : {}) };
    setVideos(prev => [nv, ...prev]);
    if (!currentVideoId) setCurrentVideoId(nv.id);
    if (isUserVideo) setShowUserPlaylist(true);
  }, [currentVideoId, currentUser, isUserLocked]);

  const handlePurgeAll = useCallback(() => { 
    setVideos([]); setCurrentVideoId(undefined); setIsPlaying(false); setActiveSecondaryView('none'); 
    setUserFavMap(prev => ({ ...prev, [currentUser]: [] })); 
  }, [currentUser]);

  // Reorder videos by dragging — fromId moves to position of toId
  const handleReorderVideos = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setVideos(prev => {
      const fromIdx = prev.findIndex(v => v.id === fromId);
      const toIdx   = prev.findIndex(v => v.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const handleToggleFavorite = useCallback((id: string) => {
    if (!requireUser()) return;
    setUserFavMap(prev => {
      const userFavs = prev[currentUser] || [];
      const isAlreadyFav = userFavs.includes(id);
      const updatedFavs = isAlreadyFav 
        ? userFavs.filter(fid => fid !== id) 
        : [...userFavs, id];
      return { 
        ...prev, 
        [currentUser]: updatedFavs 
      };
    });
  }, [currentUser]);

  const handleVideoFullscreen = useCallback(() => {
    const el = playerContainerRef.current?.querySelector('iframe') || playerContainerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);

  const handleToggleLike = useCallback((id: string) => {
    if (!requireUser()) return;
    setVideos(prev => prev.map(v => {
      if(v.id !== id) return v;
      const likedBy:string[] = (v as any).likedBy || [];
      if(likedBy.includes(currentUser)) return v; // already liked
      return {...v, likeCount: v.likeCount + 1, isLiked: true, likedBy: [...likedBy, currentUser]};
    }));
  }, [currentUser]);
  const handleToggleDislike = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, isDisliked: !v.isDisliked, dislikeCount: v.isDisliked ? v.dislikeCount - 1 : v.dislikeCount + 1, isLiked: v.isDisliked ? v.isLiked : false, likeCount: (v.isDisliked || !v.isLiked) ? v.likeCount : v.likeCount - 1 } : v)); }, []);
  const handleIncrementView = useCallback((id: string) => {
    setVideos(prev => {
      const updated = prev.map(v => v.id === id ? { ...v, viewCount: v.viewCount + 1 } : v);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(updated)); } catch {}
      lastVideoSaveTime.current = Date.now();
      saveVideosToFirestore(updated);
      return updated;
    });
  }, []);
  const handleSelectVideo = useCallback((v: VideoItem) => { if (currentVideoId === v.id) { setIsPlaying(prev => !prev); } else { setCurrentVideoId(v.id); setIsPlaying(true); } }, [currentVideoId]);

  // ── Increment view after 5 seconds of watching ───────────────────────────
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewedVideoRef = useRef<string | null>(null);
  useEffect(() => {
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    if (!currentVideoId || !isPlaying) return;
    // Already counted this video this session
    if (viewedVideoRef.current === currentVideoId) return;
    viewTimerRef.current = setTimeout(() => {
      viewedVideoRef.current = currentVideoId;
      handleIncrementView(currentVideoId);
    }, 5000);
    return () => { if (viewTimerRef.current) clearTimeout(viewTimerRef.current); };
  }, [currentVideoId, isPlaying]);

  // Auto-advance video — YouTube API duration timer + postMessage for production
  const videoEndedRef = useRef(false);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const videoIsPlayingRef = useRef(false);
  useEffect(()=>{ videoIsPlayingRef.current = isPlaying; },[isPlaying]);
  useEffect(()=>{
    if(!isPlaying && videoTimerRef.current){ clearTimeout(videoTimerRef.current); videoTimerRef.current=null; }
  },[isPlaying]);
  useEffect(()=>{
    if(videoTimerRef.current){ clearTimeout(videoTimerRef.current); videoTimerRef.current=null; }
    videoEndedRef.current = false;
    if(!currentVideoId || !isPlaying) return;
    let cancelled = false;
    const startedAt = Date.now();
    const advance = () => {
      if(cancelled||videoEndedRef.current) return;
      if(!videoIsPlayingRef.current) return;
      videoEndedRef.current = true;
      const vid = currentVideoIdRef.current;
      setVideoCrossfading(true);
      setTimeout(()=>{ setVideos(prev=>{ const idx=prev.findIndex(v=>v.id===vid); if(idx>=0){ let next; if(isVideoShuffleModeRef.current&&prev.length>1){do{next=prev[Math.floor(Math.random()*prev.length)];}while(next.id===vid&&prev.length>1);}else{next=prev[(idx+1)%prev.length];} setCurrentVideoId(next.id);setIsPlaying(true);} return prev; }); setVideoCrossfading(false); },600);
    };
    const currentVid = videos.find((v:any)=>v.id===currentVideoId);
    const vurl = currentVid?.url||'';
    const vid2 = vurl.includes('youtu.be/') ? vurl.split('youtu.be/')[1]?.split(/[?&#]/)[0] : vurl.includes('v=') ? vurl.split('v=')[1]?.split(/[&#]/)[0] : vurl.includes('/shorts/') ? vurl.split('/shorts/')[1]?.split(/[?&#]/)[0] : '';
    const pollInterval = setInterval(()=>{
      if(cancelled){ clearInterval(pollInterval); return; }
    }, 2000);
    if(vid2) {
      fetch('/yt-api/youtube/v3/videos?part=contentDetails&id='+vid2+'&key=AIzaSyD8RJ2blSlO3RkrmZhF1Khp6zzLnMrWvKI')
        .then(r=>r.json())
        .then(d=>{
          if(cancelled) return;
          const iso=(d?.items?.[0]?.contentDetails?.duration)||'';
          const m=iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          const dur=m?((Number(m[1]||0)*3600)+(Number(m[2]||0)*60)+Number(m[3]||0))*1000:0;
          const elapsed=Date.now()-startedAt;
          const wait=dur>5000?Math.max(2000,dur-elapsed+2000):10*60*1000;
          console.log('[VIDEO] dur:'+(dur/1000)+'s wait:'+Math.round(wait/1000)+'s');
          videoTimerRef.current=setTimeout(()=>{ clearInterval(pollInterval); advance(); },wait);
        })
        .catch(()=>{ if(!cancelled){ console.log('[VIDEO] API failed, using 5min fallback'); videoTimerRef.current=setTimeout(()=>{ clearInterval(pollInterval); advance(); },5*60*1000); } });
    } else {
      console.log('[VIDEO] no YT id, using 5min fallback'); videoTimerRef.current = setTimeout(()=>{ clearInterval(pollInterval); advance(); }, 5*60*1000);
    }
    const onMsg=(e:MessageEvent)=>{
      try {
        const d=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(d?.event==='onStateChange'&&(d?.info===0||d?.info==='0')&&!videoEndedRef.current){
          const ytM=document.getElementById('yt-player') as HTMLIFrameElement|null;
          const scM=document.getElementById('sc-player') as HTMLIFrameElement|null;
          const mmP=document.getElementById('music-main-player') as HTMLIFrameElement|null;
          const isMusic=(ytM&&e.source===ytM.contentWindow)||(scM&&e.source===scM.contentWindow)||(mmP&&e.source===mmP.contentWindow);
          if(isMusic) return;
          videoEndedRef.current=true;
          if(videoTimerRef.current){clearTimeout(videoTimerRef.current);videoTimerRef.current=null;}
          clearInterval(pollInterval);
          advance();
        }
      } catch {}
    };
    window.addEventListener('message',onMsg);
    return ()=>{ cancelled=true; clearInterval(pollInterval); window.removeEventListener('message',onMsg); if(videoTimerRef.current){clearTimeout(videoTimerRef.current);videoTimerRef.current=null;} };
  },[currentVideoId]);

  const handleCreatePlaylist = () => {
    const name = newPlaylistName.trim();
    if (!name || currentUser === MASTER_IDENTITY) return;
    const pl: UserPlaylist = { id: `pl-${Date.now()}`, name, owner: currentUser, videoIds: [], trackIds: [], createdAt: Date.now() };
    const next = [...getPlaylists(), pl]; savePlaylists(next); setPlaylists(next);
    setNewPlaylistName('');
    setActivePlaylistId(pl.id);
  };
  const handleDeletePlaylist = (id: string) => {
    const next = getPlaylists().filter(p => p.id !== id);
    savePlaylists(next); setPlaylists(next);
    if (activePlaylistId === id) setActivePlaylistId(null);
  };
  const handleAddToPlaylist = (plId: string, videoId: string) => {
    const next = getPlaylists().map(p => p.id === plId && !p.videoIds.includes(videoId) ? { ...p, videoIds: [...p.videoIds, videoId] } : p);
    savePlaylists(next); setPlaylists(next);
  };
  const handleRemoveFromPlaylist = (plId: string, videoId: string) => {
    const next = getPlaylists().map(p => p.id === plId ? { ...p, videoIds: p.videoIds.filter(id => id !== videoId) } : p);
    savePlaylists(next); setPlaylists(next);
  };

  const handleAddCategory = (name: string, color?: string) => { if (!categories.includes(name)) { setCategories(prev => [...prev, name]); setCategoryColors(prev => ({ ...prev, [name]: color || '#94a3b8' })); } };
  const handleRemoveCategory = (name: string) => { setCategories(prev => prev.filter(c => c !== name)); if (playlistTab === name) setPlaylistTab('All'); };
  const [renamingCategory, setRenamingCategory] = useState<string|null>(null);
  const [renameCategoryVal, setRenameCategoryVal] = useState('');
  const handleRenameCategory = (oldName: string, newName: string) => {
    const n = newName.trim();
    if (!n || n === oldName) return;
    setCategories(prev => prev.map(c => c === oldName ? n : c));
    setCategoryColors(prev => { const c = {...prev}; c[n] = c[oldName]; delete c[oldName]; return c; });
    setVideos(prev => {
      const updated = prev.map(v => v.category === oldName ? {...v, category: n as any} : v);
      try { localStorage.setItem(DATA_KEY, JSON.stringify(updated)); } catch {}
      lastVideoSaveTime.current = Date.now();
      saveVideosToFirestore(updated);
      return updated;
    });
    if (playlistTab === oldName) setPlaylistTab(n as any);
    setRenamingCategory(null); setRenameCategoryVal('');
  };
  
  const currentVideo = useMemo(() => videos.find(v => v.id === currentVideoId) || null, [videos, currentVideoId]);

  return (
    <div className="h-screen bg-transparent text-slate-100 flex flex-col font-sans relative selection:bg-blue-500/30 overflow-hidden">
      <style>{`@keyframes scBar{from{transform:scaleY(0.2);opacity:0.5}to{transform:scaleY(1);opacity:1}}@keyframes scPulse{0%,100%{transform:scale(1)}25%{transform:scale(1.04) rotate(0.4deg)}50%{transform:scale(1.02) rotate(-0.3deg)}75%{transform:scale(1.03) rotate(0.2deg)}}`}</style>
      {/* Pending Review Toast */}
      {showPendingToast && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-black/90 border border-red-500/40 rounded-2xl px-10 py-6 flex flex-col items-center gap-2 shadow-2xl animate-pulse">
            <span className="text-4xl">⏳</span>
            <p className="text-[22px] font-black uppercase tracking-widest text-red-500 text-center">Your review is pending approval</p>
          </div>
        </div>
      )}
      {/* Feature requires username toast */}
      {showFeatureToast && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-black/95 border border-purple-500/40 rounded-2xl px-10 py-6 flex flex-col items-center gap-3 shadow-2xl">
            <span className="text-4xl">👤</span>
            <p className="text-[20px] font-black uppercase tracking-widest text-purple-400 text-center">Please choose a username</p>
            <p className="text-[12px] text-slate-500 uppercase tracking-widest text-center">for this feature to work</p>
          </div>
        </div>
      )}
      {showVisitorToast && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="bg-black/90 border border-blue-500/40 rounded-2xl px-10 py-6 flex flex-col items-center gap-3 shadow-2xl">
            <span className="text-4xl">👤</span>
            <p className="text-[22px] font-black uppercase tracking-widest text-blue-400 text-center">Please choose a username</p>
            <p className="text-[12px] text-slate-500 uppercase tracking-widest text-center">to like, review & save your favourites</p>
          </div>
        </div>
      )}
      {/* Background Watermark Logo — hidden when music is open */}
      {!showMusic && <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] opacity-[0.03] pointer-events-none z-0 rotate-12 select-none">
        <IntegralLogo className="w-full h-full" />
      </div>}

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

      <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-8 z-50 relative">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveSecondaryView('none')}>
          <div className="hover:rotate-[360deg] transition-transform duration-700"><IntegralLogo /></div>
          <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none text-blue-600">IntegralStream</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Personalized Archive</p>
            </div>
          </div>
        </div>
        {currentUser!==MASTER_IDENTITY&&isUserLocked&&(<button onClick={()=>setShowUserPlaylist(v=>!v)} className={`absolute left-1/2 -translate-x-1/2 h-11 px-5 rounded-xl flex items-center gap-2 border transition-all font-black text-[10px] tracking-widest uppercase ${showUserPlaylist?'bg-white text-black shadow-lg':'border-white/10 bg-white/5 text-slate-400 hover:text-white hover:border-white/20'}`}><i className="fa-solid fa-list text-sm"/><span>{displayName(currentUser)} Playlist</span></button>)}
        
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-end relative group">
            <div 
              onClick={() => { if(isUserLocked){ handleLogout(); } else { setLoginDefaultTab('Identify'); setShowLoginOverlay(true); } }}
              className={`px-4 h-11 rounded-xl border flex items-center gap-3 transition-all cursor-pointer relative overflow-hidden ${isUserLocked?'bg-blue-600/10 border-blue-500/20 hover:bg-red-500/10 hover:border-red-500/30':' border-purple-500/40 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-500/40 hover:to-blue-500/40 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-500/20'}`}
            >
              {!isUserLocked && <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-white/5 to-blue-500/0 animate-pulse pointer-events-none"/>}
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                   {isUserLocked ? (
                     <><i className="fa-solid fa-lock text-[7px] text-blue-500/60 group-hover:hidden"></i><i className="fa-solid fa-arrow-right-from-bracket text-[7px] text-red-400 hidden group-hover:inline-block"></i></>
                   ) : (
                     <i className="fa-solid fa-user-plus text-[7px] text-purple-400 animate-pulse"></i>
                   )}
                   <span className="text-[7px] font-black uppercase tracking-widest group-hover:hidden">{isUserLocked?<span className="text-blue-500/60">Verified</span>:<span className="text-purple-400/80">Join Now</span>}</span>
                   {isUserLocked&&<span className="text-[7px] font-black text-red-400 uppercase tracking-widest hidden group-hover:inline-block">Log Out</span>}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest transition-all duration-400 ${isUserLocked?'text-blue-500 group-hover:text-red-400':'text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400'}`} style={!isUserLocked?{opacity:visitorTextFade?1:0,transform:visitorTextFade?'translateY(0)':'translateY(4px)',transition:'opacity 0.4s ease, transform 0.4s ease'}:{}}>{isUserLocked ? displayName(currentUser) : VISITOR_TEXTS[visitorTextIdx]}</span>
              </div>
              <div className="w-8 h-8 rounded-full overflow-hidden border border-purple-500/40 flex-shrink-0 flex items-center justify-center bg-purple-600/10">
                {currentProfilePic
                  ? <img src={currentProfilePic} className="w-full h-full object-cover" alt="profile"/>
                  : isUserLocked
                    ? <i className="fa-solid fa-user-lock text-blue-500 text-xs"/>
                    : <div className="hover:rotate-[360deg] transition-transform duration-700"><IntegralLogo className="w-6 h-6"/></div>
                }
              </div>
            </div>
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
            onClick={() => {
              if (isAuthorized) {
                setIsAuthorized(false);
                localStorage.setItem(AUTH_KEY, 'false');
                window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'false' }));
              } else {
                setLoginDefaultTab('Terminal');
                setShowLoginOverlay(true);
              }
            }} 
            className={`relative w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer overflow-hidden group/admin ${isAuthorized ? 'bg-blue-600/10 border-blue-500/20 hover:border-red-500/30' : 'bg-white/5 border-white/10 hover:border-blue-500/30'}`}
          >
            {adminPic
              ? <img src={adminPic} className={`w-full h-full object-cover ${isAuthorized ? '' : 'opacity-50 group-hover/admin:opacity-100 transition-opacity'}`} alt="admin"/>
              : <i className={`fa-solid ${isAuthorized ? 'fa-unlock text-blue-400' : 'fa-lock text-slate-500'}`}></i>
            }
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center opacity-0 group-hover/admin:opacity-100 transition-opacity gap-0.5">
              <i className={`fa-solid ${isAuthorized ? 'fa-lock text-red-400' : 'fa-unlock text-blue-400'} text-[9px]`}/>
              <span className={`text-[6px] font-black uppercase tracking-wider leading-none ${isAuthorized ? 'text-red-400' : 'text-blue-400'}`}>
                {isAuthorized ? 'Log Out' : 'Admin'}
              </span>
            </div>
          </button>


        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10" style={{minHeight:0}}>
        <aside className="w-[520px] flex-shrink-0 min-w-0 border-r border-white/5 bg-black/20 overflow-y-auto custom-scrollbar">
          <Playlist videos={videos} categories={categories} categoryColors={categoryColors} currentVideo={currentVideo} onSelect={handleSelectVideo} onRemove={handleRemoveVideo} onToggleFavorite={handleToggleFavorite} userFavorites={currentUserFavorites} onAddRandom={() => { const available = videos.filter(v => v.id !== currentVideoId); const r = available.length ? available[Math.floor(Math.random()*available.length)] : videos[0]; if(r){setCurrentVideoId(r.id);setIsPlaying(true);} }} isVideoShuffleMode={isVideoShuffleMode} onToggleVideoShuffle={(on:boolean)=>{setIsVideoShuffleMode(on);isVideoShuffleModeRef.current=on;}} onAddManualVideo={handleManualAdd} onEditVideo={handleEditVideo} onMoveVideo={handleReorderVideos} onPurgeAll={handlePurgeAll} activeTab={playlistTab} setActiveTab={setPlaylistTab} isAuthorized={isAuthorized} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory} onRenameCategory={handleRenameCategory} onUpdateCategoryColor={() => {}} onOpenMusicApp={openMusicWithPlaylist} isUserLocked={isUserLocked} onShowUserPlaylist={showUserPlaylist&&currentUser!==MASTER_IDENTITY} onHideUserPlaylist={()=>setShowUserPlaylist(false)} onMoveToFavPick={() => {}} onToggleLike={handleToggleLike} isPlaying={isPlaying} onWriteReview={(videoId) => { setCurrentVideoId(videoId); setVideoReviewRating(5); setVideoReviewComment(''); setShowVideoReviews(true); setActiveSecondaryView('reviews'); }} currentUser={currentUser} onAddToPlaylist={currentUser !== MASTER_IDENTITY ? () => setShowPlaylistPanel(v => !v) : undefined} onRequestIdentify={()=>{setShowVisitorToast(true);setTimeout(()=>setShowVisitorToast(false),3000);}}/>
        </aside>

        <section className="flex-1 flex flex-col bg-transparent overflow-y-auto min-w-0 custom-scrollbar">
          <div className="w-full flex flex-col pt-4 gap-0">
            <div className="flex items-start gap-4 px-8 mb-4">
              {/* Left: label */}
              <div className="flex items-center gap-3 flex-shrink-0 pt-1">
                <span className="w-1 h-4 bg-blue-600 rounded-full flex-shrink-0"/>
                <h2 className="text-blue-600 font-black uppercase text-[10px] tracking-[0.4em] whitespace-nowrap">{currentVideo ? 'Now Playing' : 'Select Video'}</h2>
              </div>
              {/* Right: category tabs — wrapping rows, multi-select accumulates */}
              <div className="flex-1 min-w-0" style={{overflow:"visible"}}>
                <div className="flex flex-wrap gap-1 pt-2">
                  {(['All', 'Vault', ...([...categories].sort((a,b)=>a.localeCompare(b)))] as const).map(tabName => {
                    const color = tabName === 'All' ? '#f8fafc' : tabName === 'Vault' ? '#ef4444' : (categoryColors[tabName] || '#94a3b8');
                    const isSelected = playlistTab === tabName;
                    const isDeletable = isAuthorized && !['All','Vault'].includes(tabName);
                    return (
                      <div key={tabName} className="relative group/vtab">
                        <button
                          type="button"
                          onMouseEnter={e=>{ if(!isSelected){ const b=e.currentTarget as HTMLButtonElement; b.style.color=color; b.style.borderColor=`${color}70`; }}}
                          onMouseLeave={e=>{ if(!isSelected){ const b=e.currentTarget as HTMLButtonElement; b.style.color='#ffffff'; b.style.borderColor='rgba(255,255,255,0.08)'; }}}
                          onClick={()=>setPlaylistTab(tabName as any)}
                          className="px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                          style={isSelected
                            ? {color, backgroundColor:`${color}25`, borderColor:`${color}50`}
                            : {color:'#ffffff', borderColor:'rgba(255,255,255,0.08)', backgroundColor:'transparent'}}
                        >
                          {tabName}
                        </button>
                        {isDeletable && (<>
                          <button type="button" onClick={e=>{e.stopPropagation();handleRemoveCategory(tabName);}} className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/vtab:opacity-100 transition-opacity z-30 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"><i className="fa-solid fa-xmark text-[7px]"/></button>
                          <button type="button" onClick={e=>{e.stopPropagation();setRenamingCategory(tabName);setRenameCategoryVal(tabName);}} className="absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center opacity-0 group-hover/vtab:opacity-100 transition-opacity z-30 hover:scale-125 shadow-lg border border-white/20 cursor-pointer"><i className="fa-solid fa-pen text-[7px]"/></button>
                          {renamingCategory===tabName&&(<div className="absolute top-full mt-1 left-0 z-50 flex gap-1 bg-slate-900 border border-white/10 rounded-xl p-1.5 shadow-2xl" onClick={e=>e.stopPropagation()}><input autoFocus value={renameCategoryVal} onChange={e=>setRenameCategoryVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleRenameCategory(tabName,renameCategoryVal);if(e.key==='Escape')setRenamingCategory(null);}} className="h-6 w-24 px-2 rounded-lg bg-white/5 border border-blue-500/30 text-white text-[9px] font-bold focus:outline-none"/><button onClick={()=>handleRenameCategory(tabName,renameCategoryVal)} className="h-6 px-2 rounded-lg bg-blue-600 text-white text-[8px] font-black uppercase hover:bg-blue-500">OK</button><button onClick={()=>setRenamingCategory(null)} className="h-6 px-1.5 rounded-lg bg-white/5 text-slate-400 text-[8px] hover:text-white">✕</button></div>)}
                        </>)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="px-8 w-full" ref={playerContainerRef}>
               <div onClick={()=>{if(currentVideoId) setIsPlaying(p=>!p);}} className="w-full max-w-[calc(100%-20px)] max-h-[calc(100vh-240px)] aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl relative mx-auto" style={{cursor:currentVideoId?'pointer':'default'}}>
                {currentVideo ? (
                  <>
                  {/* Click overlay to pause/resume — always on top */}
                  <div style={{position:'absolute',inset:0,zIndex:50,cursor:'pointer',background:'transparent'}} onClick={(e)=>{e.stopPropagation();setIsPlaying(p=>!p);}}/>
                  {/* Default video shown when paused */}
                  {!isPlaying && (
                    <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:2}}>
                      <video autoPlay muted loop playsInline preload="auto" src="/video-section.mp4" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                  )}
                  <div style={{opacity:videoCrossfading?0:1,transform:videoCrossfading?'scale(0.98)':'scale(1)',transition:'opacity 0.6s ease, transform 0.6s ease'}}>
                  <VideoPlayer key={currentVideo.id} video={currentVideo} isFavorite={currentUserFavorites.includes(currentVideo.id)} isPlaying={isPlaying} onPlayStateChange={setIsPlaying} onEnded={()=>{ videoEndedRef.current=false; const vid=currentVideoIdRef.current; setVideoCrossfading(true); setTimeout(()=>{ setVideos(prev=>{ const idx=prev.findIndex(v=>v.id===vid); if(idx>=0){const next=prev[(idx+1)%prev.length];setCurrentVideoId(next.id);setIsPlaying(true);} return prev; }); setVideoCrossfading(false); },600); }} onToggleLike={() => handleToggleLike(currentVideo.id)} onToggleDislike={() => handleToggleDislike(currentVideo.id)} onToggleFavorite={() => handleToggleFavorite(currentVideo.id)} onWriteReview={() => { setReviewInitialTab('Write'); setActiveSecondaryView('reviews'); }} />
                  </div>
                  </>
                ) : videos.length > 0 ? (
                  <div className="absolute inset-0" onClick={() => { setCurrentVideoId(videos[0].id); setIsPlaying(true); }}>
                    <video autoPlay muted loop playsInline preload="auto" src="/video-section.mp4" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 uppercase font-black text-xs gap-4 bg-slate-950"><i className="fa-solid fa-cloud fa-3x animate-pulse text-slate-900"></i> Select Video</div>
                )}
              </div>
            </div>
            {currentVideo && (
              <div className="w-full animate-fade-in mt-6 px-8">
                <div className="bg-white/5 border border-white/5 rounded-3xl flex flex-wrap items-center justify-between px-8 py-4 w-full gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <Tooltip label={`${currentVideo.category} · ${videos.filter(v=>v.category===currentVideo.category).length} videos`}><span className="px-3 py-1 border text-[10px] font-black uppercase rounded-full tracking-widest shrink-0 cursor-default" style={{ color: categoryColors[currentVideo.category], borderColor: `${categoryColors[currentVideo.category]}60`, background: `${categoryColors[currentVideo.category]}20` }}>{currentVideo.category}</span></Tooltip>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Views::</span><span className="text-[13px] font-black text-white">{currentVideo.viewCount.toLocaleString()}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Likes::</span><span className="text-[13px] font-black text-white">{currentVideo.likeCount.toLocaleString()}</span></div>
                      <button onClick={()=>{if(!isUserLocked&&!isAuthorized){onPendingReview();return;}setShowVideoReviews(v=>!v);}} className="flex items-center gap-2 hover:opacity-70 transition-opacity"><span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Reviews::</span><span className="text-[13px] font-black text-white">{(currentVideo.reviews?.filter(r=>r.isApproved)?.length||0).toLocaleString()}</span></button>
                      {(isUserLocked||isAuthorized)&&<button onClick={() => setActiveSecondaryView(v => v === 'vault' ? 'none' : 'vault')} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-vault text-[11px]"></i><span>{currentUser.replace(/_/g, ' ')}'S VAULT::</span><span className="text-[13px] font-black text-white ml-0.5">{vaultCount.toLocaleString()}</span></button>}
                    </div>
                  </div>
                  <button onClick={handleVideoFullscreen} className="text-slate-500 hover:text-white transition-colors ml-auto" title="Fullscreen">
                    <i className={`fa-solid ${isVideoFullscreen ? 'fa-compress' : 'fa-expand'} text-[16px]`}/>
                  </button>
                </div>
              </div>
            )}

            {/* ── Read/Review toggle ── */}
            {currentVideo && showVideoReviews && (
              <div className="w-full px-8 mt-3" ref={videoReviewRef}>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5 w-fit">
                    <button onClick={()=>setActiveSecondaryView('none')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeSecondaryView!=='reviews'?'bg-blue-600 text-white shadow':'text-slate-400 hover:text-white'}`}>Read</button>
                    {!currentVideo.reviews?.some(r=>r.user===currentUser) && (
                      <button onClick={()=>setActiveSecondaryView('reviews')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeSecondaryView==='reviews'?'bg-blue-600 text-white shadow':'text-slate-400 hover:text-white'}`}>Review</button>
                    )}
                  </div>
                  {currentVideo.reviews?.some(r=>r.user===currentUser) && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Already reviewed</span>
                  )}
                </div>
              </div>
            )}

            {/* ── Write review form (inline) ── */}
            {activeSecondaryView === 'reviews' && showVideoReviews && currentVideo && (
              <div className="w-full px-8 mt-3" ref={el=>el?.scrollIntoView({behavior:'smooth',block:'nearest'})}>
                <div className="bg-white/5 border border-blue-500/20 rounded-2xl px-6 py-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Write a Review</p>
                  <StarRatingWidget value={videoReviewRating} onChange={setVideoReviewRating} size="text-xl"/>
                  <textarea autoFocus value={videoReviewComment} onChange={e=>setVideoReviewComment(e.target.value)} placeholder="Write your review..." rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/30 resize-none"/>
                  <div className="flex gap-2 justify-end">
                    <button onClick={()=>setActiveSecondaryView('none')} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
                    <button onClick={()=>{
                      const alreadyReviewed = currentVideo.reviews?.some(r=>r.user===currentUser);
                      if(alreadyReviewed){ setActiveSecondaryView('none'); return; }
                      const review = {id:`r-${Date.now()}`,rating:videoReviewRating,text:videoReviewComment.trim(),user:currentUser,timestamp:Date.now(),isApproved:isAuthorized};
                      setVideos(prev=>{
                        const updated = prev.map(v=>v.id===currentVideo.id?{...v,reviews:[review,...(v.reviews||[])]}:v);
                        try { localStorage.setItem(DATA_KEY, JSON.stringify(updated)); } catch {}
                        lastVideoSaveTime.current = Date.now();
                        saveVideosToFirestore(updated);
                        return updated;
                      });
                      setVideoReviewComment('');setVideoReviewRating(5);setActiveSecondaryView('none');if(!isAuthorized){setShowPendingToast(true);setTimeout(()=>setShowPendingToast(false),5000);}
                    }} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-500 transition-all">Submit</button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Approved video reviews ── */}
            {currentVideo && showVideoReviews && activeSecondaryView !== 'reviews' && (
              <div className="w-full px-8 mt-4">
                {/* User's own pending review */}
                {!isAuthorized && currentVideo.reviews?.filter(r=>r.user===currentUser&&!r.isApproved).map(r=>(
                  <div key={r.id} className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-6 py-4 flex gap-4 mb-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                      <i className="fa-solid fa-user text-orange-400 text-[10px]"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{currentUser?.replace(/_/g,' ')}</span>
                        <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=r.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                        <span className="text-[8px] text-orange-500 font-black uppercase">⏳ Pending</span>
                      </div>
                      {r.text&&<p className="text-[12px] text-slate-300 leading-relaxed">{r.text}</p>}
                    </div>
                  </div>
                ))}
                {currentVideo.reviews?.filter(r=>r.isApproved).length === 0 ? (
                  <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center py-4">No reviews yet — be the first</p>
                ) : (
                <div className="space-y-2">
                  {currentVideo.reviews.filter(r=>r.isApproved).map(rev=>(
                    <div key={rev.id} className="bg-white/5 border border-white/5 rounded-2xl px-6 py-4 flex gap-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                        <i className="fa-solid fa-user text-blue-400 text-[10px]"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{rev.user?.replace(/_/g,' ')}</span>
                          <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=rev.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                          <span className="text-[8px] text-slate-600">{new Date(rev.timestamp).toLocaleDateString()}</span>
                          {isAuthorized && <button onClick={()=>{
                            deletedReviewIds.current.add(rev.id);
                            try{localStorage.setItem(DELETED_REVIEWS_KEY,JSON.stringify([...deletedReviewIds.current]));}catch{}

                            setVideos(p=>{
                              const updated=p.map(v=>v.id===currentVideo.id?{...v,reviews:v.reviews?.filter(r=>r.id!==rev.id)}:v);
                              try{localStorage.setItem(DATA_KEY,JSON.stringify(updated));}catch{}
                              lastVideoSaveTime.current=Date.now();
                              saveVideosToFirestore(updated);
                              return updated;
                            });
                          }} className="ml-auto w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"><i className="fa-solid fa-xmark text-[9px]"/></button>}
                        </div>
                        {rev.text && <p className="text-[12px] text-slate-300 leading-relaxed">{rev.text}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* ── Pending video reviews (admin only) ── */}
            {isAuthorized && currentVideo && showVideoReviews && currentVideo.reviews?.filter(r=>!r.isApproved).length > 0 && (
              <div className="w-full px-8 mt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-2 px-1">Pending Approval</p>
                <div className="space-y-2">
                  {currentVideo.reviews.filter(r=>!r.isApproved).map(rev=>(
                    <div key={rev.id} className="bg-orange-500/5 border border-orange-500/20 rounded-2xl px-6 py-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{rev.user?.replace(/_/g,' ')}</span>
                        <div className="flex items-center gap-0.5">{[1,2,3,4,5].map(s=><i key={s} className={`fa-solid fa-star text-[8px] ${s<=rev.rating?'text-yellow-400':'text-slate-700'}`}/>)}</div>
                      </div>
                      {rev.text && <p className="text-[12px] text-slate-300 leading-relaxed mb-2">{rev.text}</p>}
                      <div className="flex gap-2">
                        <button onClick={()=>{setVideos(p=>{const u=p.map(v=>v.id===currentVideo.id?{...v,reviews:v.reviews?.map(r=>r.id===rev.id?{...r,isApproved:isAuthorized}:r)}:v);try{localStorage.setItem(DATA_KEY,JSON.stringify(u));}catch{}lastVideoSaveTime.current=Date.now();saveVideosToFirestore(u);return u;});}} className="px-3 py-1 bg-green-600 text-white rounded-lg text-[8px] font-black uppercase hover:bg-green-500 transition-all">Approve</button>
                        <button onClick={()=>{setVideos(p=>{const u=p.map(v=>v.id===currentVideo.id?{...v,reviews:v.reviews?.filter(r=>r.id!==rev.id)}:v);try{localStorage.setItem(DATA_KEY,JSON.stringify(u));}catch{}lastVideoSaveTime.current=Date.now();saveVideosToFirestore(u);return u;});}} className="px-3 py-1 bg-red-600/20 border border-red-500/30 text-red-400 rounded-lg text-[8px] font-black uppercase hover:bg-red-600/40 transition-all">Reject</button>
                      </div>
                    </div>
                  ))}
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
            onClose={() => setShowLoginOverlay(false)} 
            defaultName={(() => {
              if (currentUser && currentUser !== MASTER_IDENTITY && !currentUser.startsWith('NEURAL_NODE')) return currentUser;
              const saved = localStorage.getItem('integral_active_user_v6') || '';
              return (!saved || saved === MASTER_IDENTITY || saved.startsWith('NEURAL_NODE')) ? '' : saved;
            })()}
            defaultTab={loginDefaultTab}
          />
        </div>
      )}
      {/* ── User Playlist Panel ── */}
      {showPlaylistPanel && currentUser !== MASTER_IDENTITY && (
        <div className="fixed inset-y-0 right-0 w-80 z-[80] bg-slate-950 border-l border-white/10 flex flex-col shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div>
              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">My Playlists</p>
              <p className="text-[8px] text-slate-600 uppercase tracking-widest">{displayName(currentUser)}</p>
            </div>
            <button onClick={() => setShowPlaylistPanel(false)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all">
              <i className="fa-solid fa-xmark text-xs"/>
            </button>
          </div>

          {/* Create new playlist */}
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex gap-2">
              <input
                value={newPlaylistName}
                onChange={e => setNewPlaylistName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreatePlaylist()}
                placeholder="New playlist name..."
                className="flex-1 h-9 px-3 rounded-xl bg-black/60 border border-white/10 text-white text-xs font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500/40 uppercase"
              />
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white disabled:opacity-30 hover:bg-blue-500 transition-all"
              >
                <i className="fa-solid fa-plus text-xs"/>
              </button>
            </div>
          </div>

          {/* Playlist list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {userPlaylists.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-700">
                <i className="fa-solid fa-list text-3xl"/>
                <p className="text-[9px] font-black uppercase tracking-widest">No playlists yet</p>
                <p className="text-[8px] uppercase tracking-wider">Create one above</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {userPlaylists.map(pl => (
                  <div
                    key={pl.id}
                    className={`rounded-xl border transition-all cursor-pointer ${activePlaylistId === pl.id ? 'border-blue-500/40 bg-blue-600/10' : 'border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/10'}`}
                  >
                    <div className="flex items-center gap-3 px-3 py-2.5" onClick={() => setActivePlaylistId(activePlaylistId === pl.id ? null : pl.id)}>
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <i className="fa-solid fa-list text-blue-400 text-xs"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white truncate">{pl.name}</p>
                        <p className="text-[8px] text-slate-600 uppercase tracking-wider">{pl.videoIds.length} video{pl.videoIds.length !== 1 ? 's' : ''}</p>
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeletePlaylist(pl.id); }}
                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all flex-shrink-0"
                      >
                        <i className="fa-solid fa-xmark text-[9px]"/>
                      </button>
                    </div>

                    {/* Videos in this playlist */}
                    {activePlaylistId === pl.id && pl.videoIds.length > 0 && (
                      <div className="border-t border-white/5 px-3 py-2 space-y-1.5">
                        {pl.videoIds.map(vid => {
                          const v = videos.find(x => x.id === vid);
                          if (!v) return null;
                          return (
                            <div key={vid} className="flex items-center gap-2 group/item">
                              <button
                                onClick={() => { setCurrentVideoId(v.id); setShowPlaylistPanel(false); }}
                                className="flex-1 text-left text-[9px] font-bold text-slate-400 hover:text-white uppercase tracking-wider truncate transition-colors"
                              >
                                {v.prompt || v.url}
                              </button>
                              <button
                                onClick={() => handleRemoveFromPlaylist(pl.id, vid)}
                                className="opacity-0 group-hover/item:opacity-100 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition-all"
                              >
                                <i className="fa-solid fa-xmark text-[8px]"/>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add current video to this playlist */}
                    {activePlaylistId === pl.id && currentVideo && (
                      <div className="border-t border-white/5 px-3 py-2">
                        {pl.videoIds.includes(currentVideo.id) ? (
                          <p className="text-[8px] text-green-500 font-black uppercase tracking-widest flex items-center gap-1.5">
                            <i className="fa-solid fa-check"/> Current video in list
                          </p>
                        ) : (
                          <button
                            onClick={() => handleAddToPlaylist(pl.id, currentVideo.id)}
                            className="w-full h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 text-blue-400 text-[8px] font-black uppercase tracking-widest hover:bg-blue-600/30 transition-all flex items-center justify-center gap-1.5"
                          >
                            <i className="fa-solid fa-plus text-[8px]"/> Add current video
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Music App Overlay — always mounted so listeners survive */}
      <div style={{display: showMusic ? 'block' : 'none', position:'fixed', inset:0, zIndex: showMusic ? 300 : -1, pointerEvents: showMusic ? 'auto' : 'none'}}>
          <MusicApp
            currentUser={currentUser}
            isAuthorized={isAuthorized}
            onClose={() => {
              // Re-read identity from localStorage on close as safety net
              const savedUser = localStorage.getItem(USER_KEY);
              const savedLocked = localStorage.getItem(USER_LOCKED_KEY) === 'true';
              if (savedUser && savedUser !== currentUser) setCurrentUser(savedUser);
              if (savedLocked !== isUserLocked) setIsUserLocked(savedLocked);
              setShowMusic(false);
            }}
            isUserLocked={isUserLocked}
            onLogout={handleLogout}
            onAdminClick={() => setShowLoginOverlay(true)}
            showUserPlaylist={showUserPlaylist}
            onToggleUserPlaylist={()=>setShowUserPlaylist(v=>!v)}
            onOpenUserPlaylist={()=>setShowUserPlaylist(true)}
            onPendingReview={()=>{if(!isUserLocked&&!isAuthorized){setShowVisitorToast(true);setTimeout(()=>setShowVisitorToast(false),3000);}else{setShowPendingToast(true);setTimeout(()=>setShowPendingToast(false),5000);}}}
            onUserChange={(user, locked) => { setCurrentUser(user); setIsUserLocked(locked); }}
          />
      </div>

    </div>
  );
};

export default App;