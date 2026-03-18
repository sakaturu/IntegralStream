import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { VideoItem, VideoCategory } from './types';
import VideoPlayer from './components/VideoPlayer';
import Playlist from './Playlist';
import LoginGate from './components/LoginGate';
import VaultGallery from './components/VaultGallery';
import FloatingReviewHub from './components/FloatingReviewHub';
import ModerationPanel from './components/ModerationPanel';
import { getSampleLibrary, getSurpriseVideo, LIBRARY_VERSION, MASTER_IDENTITY, HARDCODED_FAVORITES } from './services/sampleData';


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
  ['#0284c7','#0369a1','#1d4ed8','#4f46e5','#7c3aed','#9333ea','#be185d','#e11d48','#b91c1c','#c2410c','#b45309','#4d7c0f'],
];

interface MusicTrack {
  id:string; artist:string; title:string; url:string; thumbnail?:string;
  category:string; addedBy:string; timestamp:number; playCount:number; likeCount:number;
  isFavorite?:boolean;
}
interface MusicReview {
  id:string; trackId:string; user:string; rating:number; comment:string;
  timestamp:number; approved:boolean;
}
interface MusicAppProps {
  currentUser:string; isAuthorized:boolean; onClose:()=>void;
  profilePic?:string; nodeId?:string; isUserLocked?:boolean;
  pendingReviewsCount?:number; onLogout?:()=>void; onAdminClick?:()=>void;
}

// ─── Shared auth constants ───────────────────────────────────────────────────
const AUTH_KEY        = 'integral_v411_auth';
const ADMIN_PASSWORD  = 'ADMIN';
const USER_KEY        = 'integral_active_user_v6';
const USER_LOCKED_KEY = 'integral_user_locked_v6';
const USER_NODE_ID_KEY = 'integral_user_node_id';
const FAV_MAP_KEY     = 'integral_user_fav_map_v2';

const getMusicKey  = (u:string) => `integral_music_${u}_v1`;
const getSharedKey = () => `integral_music_shared_v1`;

// ── TrackThumbnail ────────────────────────────────────────────────────────────
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

  if(thumbnail && !imgFailed) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={style}>
        <img src={thumbnail} alt={title} className="w-full h-full object-cover" onError={()=>setImgFailed(true)}/>
      </div>
    );
  }

  const bars = Array.from({length:12},(_,i)=>{
    const h = 20+Math.abs(Math.sin(i*0.7+0.9)*Math.cos(i*0.4))*60;
    return <div key={i} style={{width:3,height:`${h}%`,background:i%2===0?c1:c2,borderRadius:2,opacity:0.8,flexShrink:0}}/>;
  });
  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}
      style={{background:`linear-gradient(135deg,#08000f 0%,#0d0020 100%)`,...style}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:4,background:c1}}/>
      <div style={{position:'absolute',right:-20,top:-20,width:80,height:80,borderRadius:'50%',background:c1,opacity:0.15,filter:'blur(20px)'}}/>
      <div style={{position:'absolute',bottom:4,left:6,right:6,display:'flex',alignItems:'flex-end',gap:2,height:'45%'}}>{bars}</div>
      <div style={{position:'absolute',top:6,left:8,right:8}}>
        <div style={{fontSize:8,fontWeight:900,color:c2,textTransform:'uppercase',letterSpacing:1,opacity:0.9,overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis'}}>{artist}</div>
        <div style={{fontSize:10,fontWeight:700,color:'#fff',overflow:'hidden',whiteSpace:'nowrap',textOverflow:'ellipsis',marginTop:1}}>{title}</div>
      </div>
      <div style={{position:'absolute',bottom:4,right:6,fontSize:7,color:'rgba(255,255,255,0.2)',fontWeight:700}}>IS</div>
    </div>
  );
};

const getThumbnailUrl = (track: MusicTrack): string => {
  if (track.thumbnail) return track.thumbnail;
  const u = track.url || '';
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    let id = '';
    if (u.includes('youtu.be/')) id = u.split('youtu.be/')[1]?.split(/[?&/#]/)[0] || '';
    else if (u.includes('v=')) id = u.split('v=')[1]?.split(/[?&/#]/)[0] || '';
    else if (u.includes('/embed/')) id = u.split('/embed/')[1]?.split(/[?&/#]/)[0] || '';
    id = id.trim();
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return '';
};

const extractYoutubeId=(url:string):string=>{
  if(!url)return'';
  const u=url.replace('music.youtube.com','www.youtube.com');
  if(u.includes('youtu.be/'))return u.split('youtu.be/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('/shorts/'))return u.split('/shorts/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('/embed/'))return u.split('/embed/')[1]?.split(/[?&#]/)[0]||'';
  if(u.includes('v='))return u.split('v=')[1]?.split(/[&#]/)[0]||'';
  const m=u.match(/[a-zA-Z0-9_-]{11}/);
  return m?m[0]:'';
};

const getEmbedUrl = (url:string, autoplay=false):{embedUrl:string;type:'youtube'|'soundcloud'|'unknown'} => {
  if (url.includes('youtube.com')||url.includes('youtu.be')||url.includes('music.youtube')) {
    const id=extractYoutubeId(url).trim();
    if (id) return {embedUrl:`https://www.youtube-nocookie.com/embed/${id}?autoplay=${autoplay?1:0}&enablejsapi=1&rel=0&playsinline=1`,type:'youtube'};
  }
  if (url.includes('soundcloud.com')) {
    return {embedUrl:`https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=${autoplay}&hide_related=true&show_comments=false&show_user=true&visual=true&color=%23a855f7`,type:'soundcloud'};
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

// ─── Visualizer ───────────────────────────────────────────────────────────────
const VIZ_GROUPS = [
  { group:'Kaleidoscope', modes:['Bloom','Fractal','Storm','Nebula','Crystal'] },
  { group:'Waveform',     modes:['Oscilloscope','Mirror Wave','Ribbon','Lissajous','Spiral Wave'] },
  { group:'Spectrum',     modes:['Classic Bars','3D Bars','Radial Bars','Mountain','Pulse Burst'] },
  { group:'Circular',     modes:['Ring Pulse','Sunburst','Cog','Aurora Ring','Vortex'] },
  { group:'Psychedelic',  modes:['Plasma','Tunnel','Liquid','Prism','Mandala'] },
  { group:'VJ',           modes:['Grid Flash','Scanlines','Strobe','RGB Shift','Color Flood'] },
  { group:'Analytical',   modes:['Freq Chart','BPM Graph','Stereo Field','Harmonic','Particle Storm'] },
];
const ALL_MODES    = VIZ_GROUPS.flatMap(g => g.modes);
const GROUP_COLORS = ['#a855f7','#06b6d4','#ef4444','#f59e0b','#ec4899','#3b82f6','#10b981'];

const VisualizerPickerOnly = ({onActivate}:{onActivate?:(mode?:number)=>void}) => {
  const [mode, setMode] = React.useState(0);
  const [groupOpen, setGroupOpen] = React.useState<number|null>(null);
  const currentGroupIdx = VIZ_GROUPS.findIndex(g=>g.modes.includes(ALL_MODES[mode]));
  return (
    <div className="absolute inset-0 pointer-events-none" style={{zIndex:20}}>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-auto" onClick={e=>e.stopPropagation()}>
        {VIZ_GROUPS.map((g,gi)=>(
          <div key={g.group} className="relative">
            <button onClick={()=>setGroupOpen(groupOpen===gi?null:gi)}
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
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const eqRef       = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const isPlayingRef = useRef(isPlaying);
  const modeRef     = useRef(0);
  const prevModeRef = useRef(0);
  const morphRef    = useRef(0);
  const transitionTypeRef = useRef(0);
  const [transitionStyle, setTransitionStyle] = useState(0);
  const [transitionOpen,  setTransitionOpen]  = useState(false);

  const TRANSITION_STYLES = [
    { name: 'Crossfade',         icon: 'fa-circle-half-stroke',  color: '#06b6d4' },
    { name: 'Morphing',          icon: 'fa-wand-magic-sparkles', color: '#a855f7' },
    { name: 'Visual Transition', icon: 'fa-sliders',             color: '#f97316' },
    { name: 'Interpolation',     icon: 'fa-bezier-curve',        color: '#10b981' },
    { name: 'Metamorphosis',     icon: 'fa-staff-snake',         color: '#ec4899' },
    { name: 'Auto',              icon: 'fa-shuffle',             color: '#fbbf24' },
  ];
  const [mode,      setMode]      = useState(initialMode);
  const [groupOpen, setGroupOpen] = useState<number|null>(null);
  const [autoOn,    setAutoOn]    = useState(autoStart);
  const autoOnRef = useRef(autoStart);
  const [pickerVisible, setPickerVisible] = useState(true);
  const idleTimerRef = useRef<number>(0);

  const resetIdleTimer = () => {
    setPickerVisible(true);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = window.setTimeout(() => setPickerVisible(false), 2000);
  };

  useEffect(() => {
    resetIdleTimer();
    return () => clearTimeout(idleTimerRef.current);
  }, []);

  const shuffleRef   = useRef<number>(0);
  const modeIndexRef = useRef(0);
  const lastModeRef  = useRef(-1);

  useEffect(()=>{
    prevModeRef.current = modeRef.current;
    modeRef.current = mode;
    modeIndexRef.current = mode;
    morphRef.current = 0;
    transitionTypeRef.current = Math.floor(Math.random() * 5);
  },[mode]);

  useEffect(()=>{ transitionTypeRef.current = transitionStyle; },[transitionStyle]);
  useEffect(()=>{ autoOnRef.current = autoOn; },[autoOn]);
  useEffect(()=>{ isPlayingRef.current = isPlaying; },[isPlaying]);

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

  const handleAutoToggle = (e: React.MouseEvent) => { e.stopPropagation(); setAutoOn(p => !p); };

  useEffect(()=>{
    const canvas = canvasRef.current;
    const eq     = eqRef.current;
    if (!canvas||!eq) return;
    const ctx   = canvas.getContext('2d')!;
    const eqCtx = eq.getContext('2d')!;

    const bufA = document.createElement('canvas');
    const bufB = document.createElement('canvas');
    const ctxA = bufA.getContext('2d')!;
    const ctxB = bufB.getContext('2d')!;

    const off = document.createElement('canvas'); off.width = 800; off.height = 800;
    const ox  = off.getContext('2d')!;

    const resize = () => {
      const root = canvas.closest('.viz-root') as HTMLElement || canvas.parentElement;
      const pw = root?.clientWidth  || window.innerWidth;
      const ph = root?.clientHeight || window.innerHeight;
      canvas.width  = pw;  canvas.height  = ph;
      eq.width      = pw;  eq.height      = 56;
      bufA.width = pw; bufA.height = ph;
      bufB.width = pw; bufB.height = ph;
      off.width = Math.max(pw, ph); off.height = Math.max(pw, ph);
    };
    resize();
    const ro = new ResizeObserver(resize);
    const rootEl = canvas.closest('.viz-root') as HTMLElement || canvas.parentElement;
    if (rootEl) ro.observe(rootEl);
    window.addEventListener('resize', resize);

    const pts = Array.from({length:48},(_,i)=>({
      x:Math.random(), y:Math.random(),
      vx:(Math.random()-.5)*.003, vy:(Math.random()-.5)*.003,
      baseR:18+Math.random()*80, h:(i/32)*360, dh:.3+Math.random()*.7,
      angle:Math.random()*Math.PI*2, da:(Math.random()-.5)*.025,
    }));

    let t=0, bass=0, mid=0, tre=0, hue=0, beat=0;
    let bassRaw=0, midRaw=0, treRaw=0;
    const waveHist:number[][] = [];
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
      if (!isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      t += .007;
      const cw = canvas.width, ch = canvas.height;

      bassRaw = .35+.35*Math.abs(Math.sin(t*2.1)) * Math.abs(Math.sin(t*.31));
      midRaw  = .28+.28*Math.abs(Math.sin(t*3.3+1.1));
      treRaw  = .20+.20*Math.abs(Math.sin(t*5.7+2.2));
      for(let i=0;i<512;i++){
        const env = Math.exp(-i/55);
        fakeFreq[i] = Math.min(255, Math.floor(
          env*255*bassRaw + 130*Math.abs(Math.sin(i*.13+t*3.5))*midRaw
          + 70*Math.abs(Math.sin(i*.37+t*5.1))*treRaw + 20*Math.random()*bassRaw
        ));
      }
      for(let i=0;i<1024;i++)
        fakeWave[i] = 128
          + Math.floor(110*Math.sin(i*.048+t*5)*bassRaw)
          + Math.floor(40 *Math.sin(i*.19 +t*9)*midRaw)
          + Math.floor(15 *Math.sin(i*.55 +t*13)*treRaw);
      const fd:Uint8Array = fakeFreq;
      const wd:Uint8Array = fakeWave;

      bass = bass*.55 + bassRaw*.45;
      mid  = mid *.60 + midRaw *.40;
      tre  = tre *.65 + treRaw *.35;
      const beatDelta = Math.max(0, bassRaw - bass);
      beat = Math.max(beat*.75, beatDelta*9);
      hue  = (hue + .5 + bass*4 + beat*3) % 360;

      if (autoOnRef.current && beat > 0.55 && morphRef.current > 0.9) {
        let next;
        do { next = Math.floor(Math.random() * ALL_MODES.length); }
        while (next === lastModeRef.current && ALL_MODES.length > 1);
        lastModeRef.current = next;
        modeIndexRef.current = next;
        setMode(next);
      }

      const renderScene = (c:CanvasRenderingContext2D, m:number) => {
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
            c.beginPath(); c.moveTo(0,0);
            c.lineTo(Math.cos(-sa/2)*cr, Math.sin(-sa/2)*cr);
            c.arc(0,0,cr,-sa/2,sa/2); c.lineTo(0,0);
            c.closePath(); c.clip();
            if(i%2===1){ c.scale(-1,1); }
            c.drawImage(off, 0, 0, off.width, off.height, -cr, -cr, cr*2, cr*2);
            c.restore();
          }
          c.restore();
          if(beat>.1){ c.save(); c.globalAlpha=beat*.32; c.fillStyle=`hsl(${hue},100%,80%)`; c.fillRect(0,0,cw,ch); c.restore(); }
        }
        else if (m < 10) {
          c.fillStyle='#000'; c.fillRect(0,0,cw,ch);
          const wpts = Array.from(wd).map(v=>(v/128)-1);
          c.save();
          if(m===5){ c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=2+bass*4; c.shadowColor=`hsl(${hue},100%,70%)`; c.shadowBlur=8+bass*20; c.beginPath(); wpts.forEach((v,i)=>{ const x=(i/wpts.length)*cw, y=ch/2+v*(ch*.42)*(1+bass*1.5); i===0?c.moveTo(x,y):c.lineTo(x,y); }); c.stroke(); }
          else if(m===6){ [1,-1].forEach(flip=>{ c.strokeStyle=`hsl(${hue},90%,${flip>0?65:55}%)`; c.lineWidth=1.5+bass*3; c.beginPath(); wpts.forEach((v,i)=>{ const x=(i/wpts.length)*cw, y=ch/2+flip*v*(ch*.38)*(1+bass); i===0?c.moveTo(x,y):c.lineTo(x,y); }); c.stroke(); }); }
          else if(m===7){ const bw=cw/wpts.length; wpts.forEach((v,i)=>{ if(i===0)return; const x=(i/wpts.length)*cw, y=ch/2+v*(ch*.4), h2=2+Math.abs(v)*40*(1+bass*2); c.fillStyle=`hsla(${(hue+i*.3)%360},90%,65%,${.4+Math.abs(v)*.5})`; c.fillRect(x,y,bw+1,h2); }); }
          else if(m===8){ c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath(); for(let i=0;i<512;i++){ const a=i/512*Math.PI*2, x=cw/2+Math.sin(a*3+bass*2)*cw*.38*(1+bass*.5), y=ch/2+Math.sin(a*2+mid*3)*ch*.38*(1+mid*.5); i===0?c.moveTo(x,y):c.lineTo(x,y); } c.stroke(); }
          else { wpts.forEach((v,i)=>{ const a=(i/wpts.length)*Math.PI*8+t, r2=(ch*.3)*(1+v*(1+bass*2)); c.fillStyle=`hsla(${(hue+i*.5)%360},90%,70%,.7)`; c.beginPath(); c.arc(cw/2+Math.cos(a)*r2,ch/2+Math.sin(a)*r2,2+Math.abs(v)*4,0,Math.PI*2); c.fill(); }); }
          c.restore();
        }
        else if (m < 15) {
          c.fillStyle='rgba(0,0,0,.12)'; c.fillRect(0,0,cw,ch);
          const d=fd;
          if(m===10){ const bars=80,bw=cw/bars; for(let i=0;i<bars;i++){ const v=d[Math.floor(i/bars*d.length*.75)]/255,bh=Math.max(2,v*ch*.85); const g=c.createLinearGradient(0,ch-bh,0,ch); g.addColorStop(0,`hsl(${(hue+i*3)%360},90%,65%)`); g.addColorStop(1,`hsl(${(hue+i*3+60)%360},90%,35%)`); c.fillStyle=g; c.fillRect(i*bw+1,ch-bh,bw-2,bh); } }
          else if(m===11){ const bars=50,bw=cw/bars,dep=14; for(let i=0;i<bars;i++){ const v=d[Math.floor(i/bars*d.length*.75)]/255,bh=Math.max(2,v*ch*.75); const c1=`hsl(${(hue+i*4)%360},85%,45%)`,c2=`hsl(${(hue+i*4)%360},85%,58%)`,c3=`hsl(${(hue+i*4)%360},85%,32%)`; c.fillStyle=c1; c.fillRect(i*bw+1,ch-bh,bw-2,bh); c.fillStyle=c2; c.fillRect(i*bw+1+dep,ch-bh-dep,bw-2,bh); c.fillStyle=c3; c.beginPath(); c.moveTo(i*bw+1,ch-bh); c.lineTo(i*bw+1+dep,ch-bh-dep); c.lineTo(i*bw+bw-1+dep,ch-bh-dep); c.lineTo(i*bw+bw-1,ch-bh); c.fill(); } }
          else if(m===12){ c.save(); c.translate(cw/2,ch/2); const bars=64,innerR=Math.min(cw,ch)*.1,outerR=Math.min(cw,ch)*.44; for(let i=0;i<bars;i++){ const a=(i/bars)*Math.PI*2,v=d[Math.floor(i/bars*d.length*.75)]/255,blen=Math.max(2,v*(outerR-innerR)*(1+bass*.5)); c.strokeStyle=`hsl(${(hue+i*5.6)%360},90%,65%)`; c.lineWidth=3; c.beginPath(); c.moveTo(Math.cos(a)*innerR,Math.sin(a)*innerR); c.lineTo(Math.cos(a)*(innerR+blen),Math.sin(a)*(innerR+blen)); c.stroke(); } c.restore(); }
          else if(m===13){ for(let b2=4;b2>=0;b2--){ c.beginPath(); c.moveTo(0,ch); for(let i=0;i<cw;i++){ const v=d[Math.floor(i/cw*d.length*.6)]/255,y=ch-(v*(ch*.6)+b2*(ch*.07))*(1+bass*.5); c.lineTo(i,y); } c.lineTo(cw,ch); c.closePath(); c.fillStyle=`hsla(${(hue+b2*30)%360},85%,${40+b2*5}%,${.55+b2*.08})`; c.fill(); } }
          else { c.save(); c.translate(cw/2,ch/2); const maxR=Math.min(cw,ch)*.5; for(let ring=0;ring<8;ring++){ const v=d[Math.floor(ring/8*d.length*.5)]/255,r2=maxR*(ring/8)*(1+bass*.6+beat*.8),alpha=Math.max(0,1-(ring/8)); c.strokeStyle=`hsla(${(hue+ring*45)%360},100%,70%,${alpha*(.4+v*.5)})`; c.lineWidth=2+v*8+beat*10; c.beginPath(); c.arc(0,0,r2,0,Math.PI*2); c.stroke(); } c.restore(); }
        }
        else if (m < 20) {
          c.fillStyle='rgba(0,0,0,.15)'; c.fillRect(0,0,cw,ch);
          const d=fd; c.save(); c.translate(cw/2,ch/2); const R=Math.min(cw,ch)*.35;
          if(m===15){ for(let ring=0;ring<4;ring++){ const sc2=1+ring*.25+bass*(ring+1)*.15; c.strokeStyle=`hsla(${(hue+ring*30)%360},90%,65%,${.8-ring*.15})`; c.lineWidth=2+bass*6; c.beginPath(); c.arc(0,0,R*sc2,0,Math.PI*2); c.stroke(); } for(let i=0;i<64;i++){ const a=(i/64)*Math.PI*2,v=d[Math.floor(i/64*d.length*.75)]/255,r2=R+v*R*.8; c.fillStyle=`hsl(${(hue+i*5.6)%360},90%,70%)`; c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,2+v*4,0,Math.PI*2); c.fill(); } }
          else if(m===16){ const rays=64; for(let i=0;i<rays;i++){ const a=(i/rays)*Math.PI*2,v=d[Math.floor(i/rays*d.length*.75)]/255,len=R*.25+v*R*(1+bass*.8); c.strokeStyle=`hsl(${(hue+i*(360/rays))%360},95%,70%)`; c.lineWidth=1.5+v*4; c.beginPath(); c.moveTo(Math.cos(a)*R*.12,Math.sin(a)*R*.12); c.lineTo(Math.cos(a)*(R*.12+len),Math.sin(a)*(R*.12+len)); c.stroke(); } }
          else if(m===17){ c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=3+bass*5; const teeth=32; c.beginPath(); for(let i=0;i<teeth*2+1;i++){ const a=(i/(teeth))*Math.PI,r2=i%2===0?R*(1+bass*.3):R*.75; i===0?c.moveTo(Math.cos(a)*r2,Math.sin(a)*r2):c.lineTo(Math.cos(a)*r2,Math.sin(a)*r2); } c.closePath(); c.stroke(); }
          else if(m===18){ for(let i=0;i<128;i++){ const a=(i/128)*Math.PI*2+t*.3,v=d[Math.floor(i/128*d.length*.75)]/255,r2=R*.6+v*R*.7; c.fillStyle=`hsla(${(hue+i*2.8)%360},100%,70%,${.4+v*.5})`; c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,2+v*7,0,Math.PI*2); c.fill(); } }
          else { for(let i=0;i<200;i++){ const a=i*.3+t*(1+bass)*2,r2=(i/200)*R*(1+bass*.4); c.fillStyle=`hsla(${(hue+i*1.8)%360},90%,70%,${.3+bass*.4})`; c.beginPath(); c.arc(Math.cos(a)*r2,Math.sin(a)*r2,1.5+bass*3,0,Math.PI*2); c.fill(); } }
          c.restore();
        }
        else if (m < 25) {
          c.fillStyle='rgba(0,0,0,.09)'; c.fillRect(0,0,cw,ch);
          if(m===20){ for(let y2=0;y2<ch;y2+=6) for(let x2=0;x2<cw;x2+=6){ const v=Math.sin(x2*.018+t)+Math.sin(y2*.018+t*1.3)+Math.sin((x2+y2)*.01+bass*3)+Math.sin(Math.sqrt(x2*x2+y2*y2)*.015+t*.7); c.fillStyle=`hsl(${(hue+v*60)%360},90%,${48+v*14}%)`; c.fillRect(x2,y2,7,7); } }
          else if(m===21){ for(let ring=20;ring>0;ring--){ const r2=(ring/20)*(Math.min(cw,ch)*.58)*(1+bass*.3); c.strokeStyle=`hsla(${(hue+ring*18+t*30)%360},90%,65%,${ring/20})`; c.lineWidth=2; c.beginPath(); c.arc(cw/2,ch/2,r2,0,Math.PI*2); c.stroke(); } }
          else if(m===22){ c.globalCompositeOperation='screen'; for(let i=0;i<6;i++){ const cx2=cw/2+Math.sin(t*(i+1)*.7)*cw*.32,cy2=ch/2+Math.cos(t*(i+.5)*.6)*ch*.32,rad=90+bass*90; const g=c.createRadialGradient(cx2,cy2,0,cx2,cy2,rad); g.addColorStop(0,`hsla(${(hue+i*60)%360},100%,70%,.55)`); g.addColorStop(1,`rgba(0,0,0,0)`); c.fillStyle=g; c.beginPath(); c.arc(cx2,cy2,rad,0,Math.PI*2); c.fill(); } c.globalCompositeOperation='source-over'; }
          else if(m===23){ c.save(); c.translate(cw/2,ch/2); for(let i=0;i<12;i++){ c.save(); c.rotate(i*Math.PI/6+t*.2); const g=c.createLinearGradient(0,-ch*.5,0,ch*.5); g.addColorStop(0,`rgba(0,0,0,0)`); g.addColorStop(.5,`hsla(${(hue+i*30)%360},100%,70%,.7)`); g.addColorStop(1,`rgba(0,0,0,0)`); c.fillStyle=g; c.fillRect(-6,-ch*.5,12+bass*25,ch); c.restore(); } c.restore(); }
          else { c.save(); c.translate(cw/2,ch/2); c.rotate(t*.15+bass*.5); for(let ring=0;ring<5;ring++){ const petals=6+ring*2,r2=(ring+1)*Math.min(cw,ch)*.065*(1+bass*.35); for(let p=0;p<petals;p++){ const a=(p/petals)*Math.PI*2; c.save(); c.rotate(a); const g=c.createRadialGradient(r2,0,0,r2,0,r2*.65); g.addColorStop(0,`hsla(${(hue+ring*40+p*20)%360},90%,70%,.85)`); g.addColorStop(1,`rgba(0,0,0,0)`); c.fillStyle=g; c.beginPath(); c.ellipse(r2,0,r2*.6,r2*.22,0,0,Math.PI*2); c.fill(); c.restore(); } } c.restore(); }
          const vig2=c.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*.55); vig2.addColorStop(0,'rgba(0,0,0,0)'); vig2.addColorStop(1,'rgba(0,0,0,.55)'); c.fillStyle=vig2; c.fillRect(0,0,cw,ch);
        }
        else if (m < 30) {
          c.fillStyle='#000'; c.fillRect(0,0,cw,ch); const d=fd;
          if(m===25){ const cols=Math.floor(cw/60),rows=Math.floor(ch/50),gw=cw/cols,gh=ch/rows; for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){ const rand=Math.random(),v=d[Math.floor(Math.random()*d.length*.75)]/255; c.fillStyle=rand<bass*.7+.15?`hsl(${(hue+Math.random()*180)%360},90%,${30+v*50}%)`:`hsl(${hue},20%,${3+v*5}%)`; c.fillRect(col*gw,row*gh,gw-1,gh-1); } }
          else if(m===26){ for(let y2=0;y2<ch;y2+=3){ const v=d[Math.floor(y2/ch*d.length*.75)]/255; c.fillStyle=`hsla(${(hue+y2*.1)%360},90%,${28+v*42}%,${.45+v*.45})`; c.fillRect(0,y2,cw*(v*(1+bass)),2); } }
          else if(m===27){ const brt=beat>.22?78+beat*20:4; c.fillStyle=`hsl(${hue},${beat>.22?75:50}%,${brt}%)`; c.fillRect(0,0,cw,ch); c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath(); for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw,y2=ch/2-(d[i]/255)*ch*.42; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); } c.stroke(); }
          else if(m===28){ const shift=bass*18; ([[255,0,0],[0,255,0],[0,0,255]] as [number,number,number][]).forEach(([r,g,b],ci)=>{ c.save(); c.globalCompositeOperation='screen'; c.strokeStyle=`rgba(${r},${g},${b},.85)`; c.lineWidth=2; c.translate((ci-1)*shift,0); c.beginPath(); for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw,y2=ch/2-(d[i]/255)*ch*.42; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); } c.stroke(); c.restore(); }); }
          else { const g=c.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,Math.max(cw,ch)*(0.5+bass*.6)); g.addColorStop(0,`hsla(${hue},100%,${40+bass*30}%,${0.7+bass*.3})`); g.addColorStop(.5,`hsla(${(hue+60)%360},90%,${20+mid*25}%,.5)`); g.addColorStop(1,`hsla(${(hue+120)%360},80%,5%,0)`); c.fillStyle=g; c.fillRect(0,0,cw,ch); for(let i=0;i<6;i++){ const y2=ch/2+Math.sin(t*(i+1)*.4)*ch*.4; c.strokeStyle=`hsla(${(hue+i*40)%360},100%,80%,${.1+bass*.2})`; c.lineWidth=1+bass*3; c.beginPath(); c.moveTo(0,y2); c.bezierCurveTo(cw*.3,y2-50*mid,cw*.7,y2+50*tre,cw,y2); c.stroke(); } }
        }
        else {
          c.fillStyle='rgba(0,0,5,.88)'; c.fillRect(0,0,cw,ch); const d=fd;
          c.strokeStyle='rgba(0,200,100,.15)'; c.lineWidth=1;
          for(let x2=0;x2<cw;x2+=cw/8){ c.beginPath(); c.moveTo(x2,0); c.lineTo(x2,ch); c.stroke(); }
          for(let y2=0;y2<ch;y2+=ch/5){ c.beginPath(); c.moveTo(0,y2); c.lineTo(cw,y2); c.stroke(); }
          if(m===30){ c.strokeStyle=`hsl(${hue},90%,65%)`; c.lineWidth=2; c.beginPath(); for(let i=0;i<d.length;i++){ const x2=(i/d.length)*cw,y2=ch-(d[i]/255)*ch*.9; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); } c.stroke(); c.fillStyle=`hsla(${hue},90%,55%,.15)`; c.fill(); }
          else if(m===31){ const snap=Array.from({length:20},(_,i)=>d[Math.floor(i/20*d.length*.75)]/255); waveHist.push(snap); if(waveHist.length>120) waveHist.shift(); for(let band=0;band<3;band++){ c.strokeStyle=`hsl(${(hue+band*120)%360},90%,65%)`; c.lineWidth=1.5; c.beginPath(); waveHist.forEach((s,ti)=>{ const x2=(ti/120)*cw,y2=ch-s[band*7]*ch*.85; ti===0?c.moveTo(x2,y2):c.lineTo(x2,y2); }); c.stroke(); } }
          else if(m===32){ c.save(); c.translate(cw/2,ch/2); for(let i=0;i<8;i++){ c.strokeStyle='rgba(0,200,255,.15)'; c.lineWidth=1; c.beginPath(); c.arc(0,0,(i+1)*Math.min(cw,ch)*.055,0,Math.PI*2); c.stroke(); } const N=Math.floor(wd.length/2); c.strokeStyle=`hsl(${hue},90%,70%)`; c.lineWidth=1.5; c.beginPath(); for(let i=0;i<N;i++){ const lv=(wd[i]-128)/128,rv=(wd[i+N]-128)/128,x2=(lv+rv)*Math.min(cw,ch)*.38,y2=(lv-rv)*Math.min(cw,ch)*.38; i===0?c.moveTo(x2,y2):c.lineTo(x2,y2); } c.stroke(); c.restore(); }
          else if(m===33){ [0,Math.floor(d.length*.12),Math.floor(d.length*.25),Math.floor(d.length*.5)].forEach((f,fi)=>{ c.strokeStyle=`hsl(${(hue+fi*90)%360},90%,65%)`; c.lineWidth=2; c.beginPath(); for(let i=0;i<cw;i++){ const bin=Math.min(f+Math.floor(i/cw*30),d.length-1),y2=ch/2-(d[bin]/255)*ch*.42; i===0?c.moveTo(i,y2):c.lineTo(i,y2); } c.stroke(); }); }
          else { c.fillStyle='rgba(0,0,0,.18)'; c.fillRect(0,0,cw,ch); c.save(); c.translate(cw/2,ch/2); const count=80; for(let i=0;i<count;i++){ const angle=(i/count)*Math.PI*2+t*0.4,v=fd[Math.floor(i/count*fd.length*.8)]/255,speed=(0.15+bass*0.7+beat*0.5)*Math.min(cw,ch)*0.52,r2=v*speed*(1+bass*0.8),px=Math.cos(angle)*r2,py=Math.sin(angle)*r2,size=2+v*6+beat*8; const g=c.createRadialGradient(px,py,0,px,py,size*2); g.addColorStop(0,`hsla(${(hue+i*4.5)%360},100%,85%,${0.7+v*0.3})`); g.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=g; c.beginPath(); c.arc(px,py,size*2,0,Math.PI*2); c.fill(); } const coreG=c.createRadialGradient(0,0,0,0,0,30+bass*60+beat*40); coreG.addColorStop(0,`hsla(${hue},100%,90%,${0.4+beat*0.5})`); coreG.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=coreG; c.beginPath(); c.arc(0,0,30+bass*60+beat*40,0,Math.PI*2); c.fill(); c.restore(); }
        }
      }; // end renderScene

      const TRANSITION_DURATION = 2.8;
      const MORPH_SPEED_STEP = 1 / (TRANSITION_DURATION * 60);
      if (morphRef.current < 1) morphRef.current = Math.min(1, morphRef.current + MORPH_SPEED_STEP);
      const morphT = morphRef.current;
      const eased = morphT < 0.5 ? 2*morphT*morphT : 1-Math.pow(-2*morphT+2,2)/2;
      const isMorphing = autoOnRef.current && eased < 0.999 && prevModeRef.current !== modeRef.current;

      if (isMorphing) {
        renderScene(ctxB, prevModeRef.current);
        renderScene(ctxA, modeRef.current);
        const style = transitionTypeRef.current === 5 ? Math.floor(Math.random() * 5) : transitionTypeRef.current % 5;
        ctx.clearRect(0,0,cw,ch);
        if (style === 0) {
          ctx.globalAlpha=1; ctx.drawImage(bufB,0,0); ctx.globalAlpha=eased; ctx.drawImage(bufA,0,0); ctx.globalAlpha=1;
        } else if (style === 1) {
          ctx.save(); ctx.globalAlpha=1-eased; const sc1=1-eased*0.25; ctx.translate(cw/2,ch/2); ctx.rotate(eased*0.4); ctx.scale(sc1,sc1); ctx.drawImage(bufB,-cw/2,-ch/2); ctx.restore();
          ctx.save(); ctx.globalAlpha=eased; const sc2=0.75+eased*0.25; ctx.translate(cw/2,ch/2); ctx.rotate((eased-1)*0.4); ctx.scale(sc2,sc2); ctx.drawImage(bufA,-cw/2,-ch/2); ctx.restore();
        } else if (style === 2) {
          const slices=20, sw=cw/slices;
          for(let s=0;s<slices;s++){ const delay=(s/slices)*0.4, localT=Math.max(0,Math.min(1,(eased-delay)/0.6)), smooth=localT<0.5?2*localT*localT:1-Math.pow(-2*localT+2,2)/2, sx=s*sw; ctx.drawImage(bufB,sx,0,sw,ch,sx,ch*smooth,sw,ch); ctx.drawImage(bufA,sx,0,sw,ch,sx,-ch*(1-smooth),sw,ch); }
        } else if (style === 3) {
          ctx.drawImage(bufB,0,0); const gridSize=6, cols2=Math.ceil(cw/gridSize), rows2=Math.ceil(ch/gridSize);
          for(let r=0;r<rows2;r++) for(let c2=0;c2<cols2;c2++){ const dx=(c2/cols2-0.5),dy=(r/rows2-0.5),dist=Math.sqrt(dx*dx+dy*dy)*1.4,localT=Math.max(0,Math.min(1,(eased*1.8)-dist)); if(localT>0){ ctx.globalAlpha=localT; ctx.drawImage(bufA,c2*gridSize,r*gridSize,gridSize,gridSize,c2*gridSize,r*gridSize,gridSize,gridSize); } }
          ctx.globalAlpha=1;
        } else {
          ctx.globalAlpha=1-eased; ctx.drawImage(bufB,0,0); ctx.globalAlpha=1;
          const tmpC=document.createElement('canvas'); tmpC.width=cw; tmpC.height=ch; const tmpX=tmpC.getContext('2d')!;
          for(let y2=0;y2<ch;y2+=3){ const wave=Math.sin(y2*0.03+t*6)*(1-eased)*40; tmpX.drawImage(bufA,0,y2,cw,3,wave,y2,cw,3); }
          ctx.globalAlpha=eased; ctx.drawImage(tmpC,0,0); ctx.globalAlpha=1;
          if(eased>0.2&&eased<0.8){ const fringe=Math.sin(eased*Math.PI)*8; ctx.globalCompositeOperation='screen'; ctx.globalAlpha=0.15; ctx.drawImage(bufA,fringe,0); ctx.drawImage(bufA,-fringe,0); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1; }
        }
      } else {
        renderScene(ctx, modeRef.current);
      }

      const ew=eq.width, eh=eq.height;
      eqCtx.clearRect(0,0,ew,eh);
      const fade=eqCtx.createLinearGradient(0,0,0,eh);
      fade.addColorStop(0,'rgba(0,0,0,0)'); fade.addColorStop(.45,'rgba(0,0,0,.92)');
      eqCtx.fillStyle=fade; eqCtx.fillRect(0,0,ew,eh);
      const bars=80, bw2=ew/bars;
      for(let i=0;i<bars;i++){ const bin=Math.floor(i/bars*fd.length*.75), v=fd[bin]/255, bh=Math.max(2,v*eh*.88); eqCtx.fillStyle=`hsl(${(hue+i*3.5)%360},85%,${48+v*22}%)`; eqCtx.fillRect(i*bw2+.5,eh-bh,bw2-1,bh); }

      rafRef.current = requestAnimationFrame(draw);
    };

    const startTimer = setTimeout(() => { resize(); rafRef.current = requestAnimationFrame(draw); }, 150);
    const resizeTimer = setTimeout(resize, 400);
    return ()=>{ clearTimeout(startTimer); clearTimeout(resizeTimer); cancelAnimationFrame(rafRef.current); ro.disconnect(); window.removeEventListener('resize',resize); };
  },[]);

  const currentGroupIdx = VIZ_GROUPS.findIndex(g=>g.modes.includes(ALL_MODES[mode]));

  return (
    <div className={`viz-root ${active?"absolute inset-0 overflow-hidden":"absolute inset-0 overflow-hidden pointer-events-none"}`} style={{background:'transparent'}} onMouseMove={resetIdleTimer} onClick={active?()=>{setGroupOpen(null);setTransitionOpen(false);}:undefined}>
      <canvas ref={canvasRef} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:active?1:0}}/>
      <canvas ref={eqRef} style={{position:'absolute',bottom:0,left:0,right:0,width:'100%',height:56,pointerEvents:'none',opacity:active?1:0}}/>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1" style={{zIndex:100,pointerEvents:'auto',opacity:pickerVisible?1:0,transition:'opacity 0.4s ease'}} onMouseEnter={resetIdleTimer} onClick={e=>e.stopPropagation()}>
        {VIZ_GROUPS.map((g,gi)=>(
          <div key={g.group} className="relative">
            <button onClick={()=>setGroupOpen(groupOpen===gi?null:gi)}
              className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border ${currentGroupIdx===gi?'text-white border-transparent':'bg-black/60 border-white/10 text-slate-500 hover:text-white'}`}
              style={currentGroupIdx===gi?{background:GROUP_COLORS[gi],boxShadow:`0 0 12px ${GROUP_COLORS[gi]}80`}:{}}>
              {g.group}
            </button>
            {groupOpen===gi&&(
              <div className="absolute top-full mt-1 left-0 bg-black/95 border border-white/10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[110px] z-30 shadow-2xl">
                {g.modes.map(mn=>{ const gidx=ALL_MODES.indexOf(mn); return(
                  <button key={mn} onClick={()=>{setMode(gidx);setGroupOpen(null);onActivate&&onActivate(gidx);}}
                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-left transition-all ${mode===gidx?'text-white':'text-slate-500 hover:text-white hover:bg-white/5'}`}
                    style={mode===gidx?{background:GROUP_COLORS[gi]+'33',color:GROUP_COLORS[gi]}:{}}>
                    {mn}
                  </button>
                );})}
              </div>
            )}
          </div>
        ))}
        <button onClick={handleAutoToggle}
          className={`flex items-center gap-1.5 ml-1 px-2.5 py-1 rounded-lg border transition-all ${autoOn?'bg-yellow-500/20 border-yellow-500/40 text-yellow-300':'bg-black/60 border-white/10 text-slate-500 hover:text-yellow-300 hover:border-yellow-500/30'}`}>
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${autoOn?'bg-yellow-300 animate-pulse':'bg-slate-600'}`}/>
          <span className="text-[8px] font-black uppercase tracking-widest">Auto</span>
        </button>
          {autoOn && (
          <div className="relative ml-1">
          <button onClick={e=>{e.stopPropagation();setTransitionOpen(p=>!p);}}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all bg-black/60 border-white/10 text-slate-400 hover:text-white hover:border-white/20"
            style={transitionOpen?{borderColor:TRANSITION_STYLES[transitionStyle].color+'60',color:TRANSITION_STYLES[transitionStyle].color}:{}} title="Transition style">
            <i className={`fa-solid ${TRANSITION_STYLES[transitionStyle].icon} text-[8px]`} style={{color:TRANSITION_STYLES[transitionStyle].color}}/>
            <span className="text-[8px] font-black uppercase tracking-wider hidden sm:inline" style={{color:TRANSITION_STYLES[transitionStyle].color}}>{TRANSITION_STYLES[transitionStyle].name}</span>
          </button>
          {transitionOpen&&(
            <div className="absolute top-full mt-1 right-0 bg-black/95 border border-white/10 rounded-xl p-1.5 flex flex-col gap-0.5 min-w-[150px] z-30 shadow-2xl" onClick={e=>e.stopPropagation()}>
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
          )}
      </div>
    </div>
  );
};

// ─── MusicApp ─────────────────────────────────────────────────────────────────
const SHARED_MUSIC_KEY = 'integral_music_shared_v1';

const MusicApp: React.FC<MusicAppProps> = ({
  currentUser: currentUserProp, isAuthorized: isAuthorizedProp, onClose, profilePic='', isUserLocked: isUserLockedProp=false, onLogout=()=>{}, onAdminClick=()=>{},
}) => {
  const [currentUser,  setCurrentUser]  = useState<string>(()=> localStorage.getItem(USER_KEY) || currentUserProp);
  const [isUserLocked, setIsUserLocked] = useState<boolean>(()=> localStorage.getItem(USER_LOCKED_KEY)==='true' || isUserLockedProp);
  const [showIdentify, setShowIdentify] = useState(false);
  const [identifyName, setIdentifyName] = useState('');
  const [identifyErr,  setIdentifyErr]  = useState('');

  useEffect(()=>{ if(currentUserProp && currentUserProp !== currentUser) setCurrentUser(localStorage.getItem(USER_KEY)||currentUserProp); },[currentUserProp]);
  useEffect(()=>{ setIsUserLocked(isUserLockedProp); },[isUserLockedProp]);

  const handleIdentify = () => {
    const name = identifyName.trim().toUpperCase().replace(/\s+/g,'_');
    if(!name){ setIdentifyErr('Enter a name'); return; }
    setCurrentUser(name); setIsUserLocked(true);
    localStorage.setItem(USER_KEY, name); localStorage.setItem(USER_LOCKED_KEY,'true');
    setShowIdentify(false); setIdentifyName(''); setIdentifyErr('');
  };
  const handleIdentifyLogout = () => { setIsUserLocked(false); localStorage.removeItem(USER_LOCKED_KEY); onLogout(); };

  const [isAuthorized, setIsAuthorized] = useState<boolean>(()=> isAuthorizedProp || localStorage.getItem(AUTH_KEY)==='true');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPass,      setAdminPass]      = useState('');
  const [adminError,     setAdminError]     = useState('');

  useEffect(()=>{ if(isAuthorizedProp) setIsAuthorized(true); },[isAuthorizedProp]);
  useEffect(()=>{
    const sync=()=>setIsAuthorized(localStorage.getItem(AUTH_KEY)==='true');
    const onStorage=(e:StorageEvent)=>{ if(e.key===AUTH_KEY) sync(); };
    window.addEventListener('storage',onStorage); document.addEventListener('visibilitychange',sync);
    return ()=>{ window.removeEventListener('storage',onStorage); document.removeEventListener('visibilitychange',sync); };
  },[]);

  const handleAdminLogin = () => {
    if(adminPass===ADMIN_PASSWORD){
      setIsAuthorized(true); localStorage.setItem(AUTH_KEY,'true');
      window.dispatchEvent(new StorageEvent('storage',{key:AUTH_KEY,newValue:'true'}));
      setShowAdminLogin(false); setAdminPass(''); setAdminError('');
    } else { setAdminError('Incorrect password'); }
  };
  const handleAdminLogout = () => { setIsAuthorized(false); localStorage.setItem(AUTH_KEY,'false'); window.dispatchEvent(new StorageEvent('storage',{key:AUTH_KEY,newValue:'false'})); };
  const handleLockClick = () => { if(isAuthorized){ handleAdminLogout(); } else { setShowAdminLogin(true); setAdminError(''); setAdminPass(''); } };

  const [genres,      setGenres]      = useState<string[]>(()=>{const s=localStorage.getItem(MUSIC_GENRES_KEY);return s?JSON.parse(s):DEFAULT_MUSIC_GENRES;});
  const [genreColors, setGenreColors] = useState<Record<string,string>>(()=>{const s=localStorage.getItem('integral_music_genre_colors_v1');return s?JSON.parse(s):{...DEFAULT_GENRE_COLORS};});
  const [tracks,      setTracks]      = useState<MusicTrack[]>(()=>{const s=localStorage.getItem(SHARED_MUSIC_KEY);return s?JSON.parse(s):[];});
  const [reviews,     setReviews]     = useState<MusicReview[]>(()=>{const s=localStorage.getItem(MUSIC_REVIEWS_KEY);return s?JSON.parse(s):[];});
  const [currentTrackId, setCurrentTrackId] = useState<string|undefined>(()=>{ const s=localStorage.getItem(SHARED_MUSIC_KEY); const t=s?JSON.parse(s):[]; return t[0]?.id; });
  const [isPlaying,   setIsPlaying]   = useState(false);
  const [activeTab,   setActiveTab]   = useState('All');
  const [search,      setSearch]      = useState('');
  const [showAddForm,     setShowAddForm]     = useState(false);
  const [showAddGenreForm,setShowAddGenreForm]= useState(false);
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewingTrackId,setReviewingTrackId]= useState<string|null>(null);
  const [reviewRating,    setReviewRating]    = useState(5);
  const [reviewComment,   setReviewComment]   = useState('');
  const [formUrl,     setFormUrl]     = useState('');
  const [formArtist,  setFormArtist]  = useState('');
  const [formTitle,   setFormTitle]   = useState('');
  const [formCategory,setFormCategory]= useState(()=>{const s=localStorage.getItem(MUSIC_GENRES_KEY);const g=s?JSON.parse(s):DEFAULT_MUSIC_GENRES;return g[0]||'Other';});
  const [newGenre,       setNewGenre]       = useState('');
  const [newGenreColor,  setNewGenreColor]  = useState(COLOR_PALETTE[0][0]);
  const [confirmDeleteId,setConfirmDeleteId]= useState<string|null>(null);
  const [isExpanded,  setIsExpanded]  = useState(false);
  const [queueTab,    setQueueTab]    = useState<'All'|'Queue'>('All');
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [crossfading,    setCrossfading]    = useState(false);
  const musicPlayerRef = useRef<HTMLDivElement>(null);
  const [isMusicFullscreen, setIsMusicFullscreen] = useState(false);
  useEffect(() => {
    const h = () => setIsMusicFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const [vizInitialMode, setVizInitialMode] = useState(Math.floor(Math.random() * 35));
  const [vizAutoStart,   setVizAutoStart]   = useState(false);

  useEffect(()=>{ localStorage.setItem(SHARED_MUSIC_KEY, JSON.stringify(tracks)); },[tracks]);
  useEffect(()=>{ localStorage.setItem(MUSIC_REVIEWS_KEY,JSON.stringify(reviews)); },[reviews]);
  useEffect(()=>{ localStorage.setItem(MUSIC_GENRES_KEY,JSON.stringify(genres)); },[genres]);
  useEffect(()=>{ localStorage.setItem('integral_music_genre_colors_v1',JSON.stringify(genreColors)); },[genreColors]);

  const currentTrack    = useMemo(()=>tracks.find(t=>t.id===currentTrackId)||null,[tracks,currentTrackId]);
  const filteredTracks  = useMemo(()=>tracks.filter(t=>{
    if(activeTab==='Vault') return t.isFavorite;
    if(activeTab!=='All'&&t.category!==activeTab) return false;
    return search===''||t.artist.toLowerCase().includes(search.toLowerCase())||t.title.toLowerCase().includes(search.toLowerCase());
  }),[tracks,activeTab,search]);
  const pendingReviews  = useMemo(()=>reviews.filter(r=>!r.approved),[reviews]);
  const approvedReviews = useMemo(()=>reviews.filter(r=>r.approved),[reviews]);
  const allTabs         = useMemo(()=>[{name:'All'},{name:'Vault'},...genres.map(g=>({name:g}))]  ,[genres]);
  const firstRowTabs    = useMemo(()=>allTabs.slice(0,4),[allTabs]);
  const overflowTabs    = useMemo(()=>allTabs.slice(4),[allTabs]);

  const getTabColor  = (n:string)=>n==='All'?'#f8fafc':n==='Vault'?'#ff3b3b':genreColors[n]||'#94a3b8';
  const getTabStyles = (n:string)=>{const c=getTabColor(n),a=activeTab===n;return a?{color:c,backgroundColor:`${c}25`,borderColor:`${c}50`,transform:'scale(1.02)'}:{color:`${c}90`,borderColor:'rgba(0,0,0,0)',backgroundColor:'rgba(0,0,0,0)'};};
  const getTagStyles = (cat:string)=>{const c=genreColors[cat]||'#94a3b8';return{color:c,borderColor:`${c}60`,backgroundColor:`${c}20`};};
  const getTrackRating = (id:string)=>{const r=approvedReviews.filter(r=>r.trackId===id);return r.length?r.reduce((a,b)=>a+b.rating,0)/r.length:0;};

  useEffect(()=>{
    const onMsg=(e:MessageEvent)=>{
      try {
        const d=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(d?.event==='onStateChange'&&d?.info===0){
          const idx=tracks.findIndex(t=>t.id===currentTrackId);
          if(idx>=0){const next=tracks[(idx+1)%tracks.length];setCurrentTrackId(next.id);setIsPlaying(true);}
        }
      } catch {}
    };
    window.addEventListener('message',onMsg);
    return ()=>window.removeEventListener('message',onMsg);
  },[currentTrackId,tracks]);

  const handleAddGenre   = ()=>{const g=newGenre.trim();if(!g||genres.includes(g))return;setGenres(p=>[...p,g]);setGenreColors(p=>({...p,[g]:newGenreColor}));setNewGenre('');setShowAddGenreForm(false);};
  const handleRemoveGenre= (g:string)=>{setGenres(p=>p.filter(x=>x!==g));if(activeTab===g)setActiveTab('All');};

  const handleAddTrack=async ()=>{
    if(!formUrl.trim())return;
    const url=formUrl.trim(); let artist=formArtist.trim(), title=formTitle.trim(), thumbnail='';
    try { const oe=await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`); if(oe.ok){const d=await oe.json();if(!artist&&d.author_name)artist=d.author_name;if(!title&&d.title)title=d.title;if(d.thumbnail_url)thumbnail=d.thumbnail_url;} } catch{}
    try { if(!thumbnail){const sc=await fetch(`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`);if(sc.ok){const d=await sc.json();if(!artist&&d.author_name)artist=d.author_name;if(!title&&d.title)title=d.title;if(d.thumbnail_url)thumbnail=d.thumbnail_url;}} } catch{}
    if(!thumbnail){let id='';if(url.includes('youtu.be/'))id=url.split('youtu.be/')[1]?.split(/[?&/#]/)[0]||'';else if(url.includes('v='))id=url.split('v=')[1]?.split(/[?&/#]/)[0]||'';if(id)thumbnail=`https://i.ytimg.com/vi/${id}/hqdefault.jpg`;}
    if(!artist)artist='Unknown Artist'; if(!title)title='Unknown Title';
    const tk:MusicTrack={id:`m-${Date.now()}`,artist,title,url,thumbnail,category:formCategory,addedBy:currentUser,timestamp:Date.now(),playCount:0,likeCount:0};
    setTracks(p=>[tk,...p]);setFormUrl('');setFormArtist('');setFormTitle('');setShowAddForm(false);setCurrentTrackId(tk.id);setIsPlaying(true);
  };

  const handleRemoveTrack   = (id:string)=>{setTracks(p=>p.filter(t=>t.id!==id));if(currentTrackId===id){setCurrentTrackId(undefined);setIsPlaying(false);}setConfirmDeleteId(null);};
  const handleToggleFavorite= (id:string,e:React.MouseEvent)=>{e.stopPropagation();setTracks(p=>p.map(t=>t.id===id?{...t,isFavorite:!t.isFavorite}:t));};
  const handleSelectTrack   = (track:MusicTrack)=>{
    if(currentTrackId===track.id){ setIsPlaying(p=>!p); }
    else{ setCurrentTrackId(track.id); setIsPlaying(true); setTracks(p=>p.map(t=>t.id===track.id?{...t,playCount:t.playCount+1}:t)); }
  };

  useEffect(()=>{
    if(!currentTrackId) return;
    setCrossfading(true);
    const t=setTimeout(()=>setCrossfading(false),600);
    return ()=>clearTimeout(t);
  },[currentTrackId]);

  const {embedUrl,type}=useMemo(()=>currentTrack?getEmbedUrl(currentTrack.url, false):{embedUrl:'',type:'unknown' as const},[currentTrack?.url]);

  useEffect(()=>{
    const send = () => {
      const iframe=document.getElementById('yt-player') as HTMLIFrameElement|null;
      if(!iframe||type!=='youtube') return;
      const cmd=isPlaying?JSON.stringify({event:'command',func:'playVideo',args:''}):JSON.stringify({event:'command',func:'pauseVideo',args:''});
      try{ iframe.contentWindow?.postMessage(cmd,'*'); }catch{}
    };
    send();
    const t = setTimeout(send, 800);
    return () => clearTimeout(t);
  },[isPlaying, currentTrackId, type]);

  const handleLikeTrack   = (id:string,e:React.MouseEvent)=>{ e.stopPropagation(); setTracks(p=>p.map(t=>t.id===id?{...t,likeCount:(t.likeCount||0)+1}:t)); };
  const handlePlayNext    = ()=>{if(!filteredTracks.length)return;const idx=filteredTracks.findIndex(t=>t.id===currentTrackId);const next=filteredTracks[(idx+1)%filteredTracks.length];setCurrentTrackId(next.id);setIsPlaying(true);};
  const handlePlayPrev    = ()=>{if(!filteredTracks.length)return;const idx=filteredTracks.findIndex(t=>t.id===currentTrackId);const prev=filteredTracks[(idx-1+filteredTracks.length)%filteredTracks.length];setCurrentTrackId(prev.id);setIsPlaying(true);};
  const handleShuffle     = ()=>{if(!filteredTracks.length)return;const r=filteredTracks[Math.floor(Math.random()*filteredTracks.length)];setCurrentTrackId(r.id);setIsPlaying(true);};
  const handleSubmitReview= ()=>{
    if(!reviewingTrackId)return;
    const rev:MusicReview={id:`rev-${Date.now()}`,trackId:reviewingTrackId,user:currentUser,rating:reviewRating,comment:reviewComment.trim(),timestamp:Date.now(),approved:false};
    setReviews(p=>[...p,rev]);setReviewComment('');setReviewRating(5);setReviewingTrackId(null);
  };
  const handleApproveReview=(id:string)=>setReviews(p=>p.map(r=>r.id===id?{...r,approved:true}:r));
  const handleDeleteReview =(id:string)=>setReviews(p=>p.filter(r=>r.id!==id));

  const renderTab=(tab:{name:string})=>{
    const del=isAuthorized&&!['All','Vault'].includes(tab.name);
    return(
      <div key={tab.name} className="relative group/tab">
        <button onClick={()=>setActiveTab(tab.name)} style={getTabStyles(tab.name)}
          className="w-full h-7 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center px-1 border cursor-pointer">
          <span className="truncate w-full text-center px-1">{tab.name}</span>
        </button>
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
      <header className="h-20 flex-shrink-0 border-b border-white/5 bg-black/60 backdrop-blur-xl flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-4">
          <div className="hover:rotate-[360deg] transition-transform duration-700"><IntegralLogo/></div>
          <div className="flex flex-col">
            <h1 className="font-black text-xl uppercase tracking-tighter leading-none text-blue-600">IntegralStream</h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Personalized Archive</p>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {isAuthorized&&pendingReviews.length>0&&(
            <button onClick={()=>{setShowReviewPanel(true);setQueueTab('Queue');}} className="relative px-3 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-600/20 transition-all">
              Reviews<span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-black">{pendingReviews.length}</span>
            </button>
          )}
          <button onClick={()=>setShowReviewPanel(p=>!p)} className="px-3 h-9 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest hover:bg-purple-600/20 transition-all">
            <i className="fa-solid fa-star mr-1"/>Reviews
          </button>
          <button onClick={()=>{setShowIdentify(true);setIdentifyName(isUserLocked?currentUser.replace(/_/g,' '):'');setIdentifyErr('');}} className="px-4 h-11 rounded-xl border flex items-center gap-3 bg-blue-600/10 border-blue-500/20 text-blue-400 hover:bg-blue-600/20 transition-all">
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-black uppercase tracking-widest opacity-60">{isUserLocked?'My Archive':'Identify'}</span>
              <span className="text-[10px] font-black uppercase tracking-widest">{currentUser.replace(/_/g,' ')}</span>
            </div>
            <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-500/40 flex-shrink-0 flex items-center justify-center bg-blue-600/20">
              {profilePic?<img src={profilePic} className="w-full h-full object-cover" alt="profile"/>:<i className="fa-solid fa-user-astronaut text-[11px] text-blue-400"/>}
            </div>
          </button>
          {isUserLocked&&<button onClick={handleIdentifyLogout} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"><i className="fa-solid fa-arrow-right-from-bracket text-[11px]"/></button>}
          {isAuthorized&&<button onClick={handleLockClick} className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"><i className="fa-solid fa-lock-open"/></button>}
          {!isAuthorized&&<button onClick={handleLockClick} className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20"><i className="fa-solid fa-lock"/></button>}
        </div>
      </header>

      {/* ── Add Track Form ── */}
      {showAddForm&&(
        <div className="flex-shrink-0 border-b border-white/10 bg-slate-900/90 px-8 py-5">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Add Track</h4>
          <p className="text-[9px] text-slate-600 mb-4">Paste a YouTube or SoundCloud URL — artist, title &amp; artwork auto-fill from source</p>
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase tracking-widest text-purple-400">URL <span className="text-purple-600">*</span></label><input value={formUrl} onChange={e=>setFormUrl(e.target.value)} placeholder="YouTube or SoundCloud URL" className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold placeholder-slate-600 focus:outline-none focus:border-purple-500/30 w-72"/></div>
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Artist <span className="text-slate-700">(optional)</span></label><input value={formArtist} onChange={e=>setFormArtist(e.target.value)} placeholder="Auto-fetched from source" className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold placeholder-slate-700 focus:outline-none focus:border-purple-500/30 w-44"/></div>
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Title <span className="text-slate-700">(optional)</span></label><input value={formTitle} onChange={e=>setFormTitle(e.target.value)} placeholder="Auto-fetched from source" className="h-9 px-3 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-bold placeholder-slate-700 focus:outline-none focus:border-purple-500/30 w-48"/></div>
            <div className="flex flex-col gap-1"><label className="text-[9px] font-black uppercase tracking-widest text-purple-400">Genre</label><select value={formCategory} onChange={e=>setFormCategory(e.target.value)} className="h-9 px-3 rounded-xl bg-black border border-white/10 text-white text-xs font-bold focus:outline-none">{genres.map(g=><option key={g} value={g}>{g}</option>)}</select></div>
            <button onClick={handleAddTrack} className="h-9 px-4 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Inject</button>
            <button onClick={()=>setShowAddForm(false)} className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase hover:text-white transition-all">Abort</button>
          </div>
        </div>
      )}

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
                <div className="flex-1"><p className="text-[11px] font-black text-white">{tr?.artist} — {tr?.title}</p><p className="text-[10px] text-slate-500 mt-0.5">{rev.user.replace(/_/g,' ')} · {rev.comment}</p></div>
                <StarRating value={rev.rating} size="text-xs"/>
                {isAuthorized&&!rev.approved&&<button onClick={()=>handleApproveReview(rev.id)} className="px-3 py-1 rounded-lg bg-green-600/20 border border-green-500/30 text-green-400 text-[9px] font-black uppercase hover:bg-green-600/30 transition-all">Approve</button>}
                {isAuthorized&&<button onClick={()=>handleDeleteReview(rev.id)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600/20 transition-all"><i className="fa-solid fa-xmark text-xs"/></button>}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Write review modal ── */}
      {reviewingTrackId&&(
        <div className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center" onClick={()=>setReviewingTrackId(null)}>
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-6 w-96 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <h3 className="text-[11px] font-black uppercase tracking-widest text-purple-400 mb-4">Rate & Review</h3>
            {tracks.find(t=>t.id===reviewingTrackId) && <p className="text-sm font-bold text-white mb-3">{tracks.find(t=>t.id===reviewingTrackId)!.artist} — {tracks.find(t=>t.id===reviewingTrackId)!.title}</p>}
            <div className="mb-4"><StarRating value={reviewRating} onChange={setReviewRating} size="text-xl"/></div>
            <textarea value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Write your review..." rows={3} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/30 resize-none mb-4"/>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setReviewingTrackId(null)} className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
              <button onClick={handleSubmitReview} className="px-4 py-2 rounded-xl bg-purple-600 text-white text-[10px] font-black uppercase hover:bg-purple-500 transition-all">Submit</button>
            </div>
          </div>
        </div>
      )}

      <div style={{flex:1,display:'flex',overflow:'hidden',position:'relative',zIndex:10,minHeight:0,height:'calc(100vh - 80px)'}}>
        {/* ── Sidebar ── */}
        <aside className="w-[490px] flex-shrink-0 min-w-0 border-r border-white/5 bg-black/20 flex flex-col">
          <div className="flex-none px-4 pt-6 pb-3">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>Music Archive</h3>
              <div className="flex items-center gap-2">
                <div style={{display:'flex',alignItems:'center',background:'rgba(255,255,255,0.05)',borderRadius:8,padding:2,border:'1px solid rgba(255,255,255,0.1)',width:132,flexShrink:0}}>
                  <button onClick={()=>{ setIsPlaying(false); onClose(); }} style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'transparent',color:'#64748b'}} onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#fff';(e.currentTarget as HTMLButtonElement).style.background='#2563eb';}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#64748b';(e.currentTarget as HTMLButtonElement).style.background='transparent';}}>
                    <i className="fa-solid fa-film" style={{fontSize:8}}></i> VIDEO
                  </button>
                  <button style={{width:64,minWidth:64,height:24,borderRadius:6,fontSize:9,fontWeight:900,letterSpacing:'0.1em',display:'flex',alignItems:'center',justifyContent:'center',gap:4,flexShrink:0,border:'none',cursor:'pointer',background:'#7c3aed',color:'#fff'}}>
                    <i className="fa-solid fa-music" style={{fontSize:8}}></i> MUSIC
                  </button>
                </div>
                <button onClick={handleShuffle} title="Shuffle" className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center"><i className="fa-solid fa-shuffle text-[11px]"></i></button>
                <div className="relative flex-shrink-0">
                  <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." className="h-7 w-28 pl-7 pr-3 rounded-lg bg-white/5 border border-white/10 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none focus:border-purple-500/30"/>
                </div>
                {isAuthorized&&<button onClick={()=>setShowAddForm(p=>!p)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border shadow-lg z-30 ${showAddForm?'bg-purple-500/10 text-purple-400 border-purple-500/20 rotate-45':'bg-white text-black border-white hover:bg-slate-100'}`}><i className="fa-solid fa-plus text-xs"></i></button>}
              </div>
            </div>
            {/* Genre tabs */}
            <div className="bg-black/40 rounded-xl border border-white/5 shadow-inner p-1">
              <div className="flex items-center gap-1">
                <div className="grid grid-cols-4 gap-1 flex-1">{firstRowTabs.map(renderTab)}</div>
                <button onClick={()=>setIsExpanded(!isExpanded)} className={`w-8 h-7 flex-shrink-0 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300 ${isExpanded?'bg-white/10 text-white rotate-180':'bg-transparent text-slate-700'}`}><i className="fa-solid fa-chevron-down text-[10px]"/></button>
              </div>
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded?'max-h-[600px] mt-1 opacity-100':'max-h-0 opacity-0'}`}>
                <div className="grid grid-cols-4 gap-1 border-t border-white/5 pt-1">{overflowTabs.map(renderTab)}</div>
                {isAuthorized&&(
                  <div className="mt-2 border-t border-white/5 pt-2">
                    {showAddGenreForm?(
                      <div className="flex flex-col gap-2 px-1">
                        <input autoFocus value={newGenre} onChange={e=>setNewGenre(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddGenre()} placeholder="Genre name..." className="flex-1 h-7 px-2 rounded-lg bg-white/5 border border-purple-500/30 text-white text-[10px] font-bold placeholder-slate-600 focus:outline-none"/>
                        <div className="flex flex-wrap gap-1">{COLOR_PALETTE.flat().map(c=>(<button key={c} onClick={()=>setNewGenreColor(c)} className={`w-5 h-5 rounded-full transition-all hover:scale-125 ${newGenreColor===c?'ring-2 ring-white ring-offset-1 ring-offset-black scale-125':''}`} style={{backgroundColor:c}}/>))}</div>
                        <div className="flex gap-2">
                          <button onClick={handleAddGenre} className="h-7 px-3 rounded-lg bg-purple-600 text-white font-black text-[9px] uppercase tracking-widest hover:bg-purple-500 transition-all">Add</button>
                          <button onClick={()=>{setShowAddGenreForm(false);setNewGenre('');}} className="h-7 px-2 rounded-lg bg-white/5 text-slate-400 font-black text-[9px] hover:text-white transition-all">✕</button>
                        </div>
                      </div>
                    ):(
                      <button onClick={()=>setShowAddGenreForm(true)} className="w-full h-7 rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-slate-600 hover:text-purple-400 hover:border-purple-500/30 transition-all">
                        <i className="fa-solid fa-plus text-[9px]"/><span className="text-[8px] font-black uppercase tracking-widest">Add Genre</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Track list */}
          <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-10 space-y-1">
            {filteredTracks.length===0?(
              <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-20">
                <i className="fa-solid fa-music text-3xl text-slate-700 mb-6"/>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700">Archive Depleted</p>
              </div>
            ):filteredTracks.map(track=>{
              const rating=getTrackRating(track.id), reviewCount=approvedReviews.filter(r=>r.trackId===track.id).length;
              return(
                <div key={track.id} onClick={()=>handleSelectTrack(track)}
                  className={`group flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer border relative ${currentTrackId===track.id?'bg-white/15 border-white/20 shadow-lg':'bg-transparent border-transparent hover:bg-white/5'}`}>
                  {confirmDeleteId===track.id&&(
                    <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md rounded-2xl flex items-center justify-between px-6 border border-red-500/20" onClick={e=>e.stopPropagation()}>
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Delete Track?</span>
                      <div className="flex gap-2">
                        <button onClick={()=>setConfirmDeleteId(null)} className="px-3 py-1 bg-white/5 rounded-lg text-[8px] font-black uppercase text-slate-400">Cancel</button>
                        <button onClick={e=>{e.stopPropagation();handleRemoveTrack(track.id);}} className="px-3 py-1 bg-red-600 text-white rounded-lg text-[8px] font-black uppercase">Destroy</button>
                      </div>
                    </div>
                  )}
                  <div className={`w-28 h-[63px] rounded-xl flex-shrink-0 border overflow-hidden relative ${currentTrackId===track.id?'border-purple-500/40':'border-white/5'}`}>
                    <TrackThumbnail artist={track.artist} title={track.title} category={track.category} thumbnail={track.thumbnail||''} style={{width:'100%',height:'100%'}}/>
                    {currentTrackId===track.id&&isPlaying&&(<div className="absolute inset-0 bg-black/50 flex items-center justify-center"><i className="fa-solid fa-pause text-white text-sm"/></div>)}
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col justify-center gap-1 min-w-0">
                    <p className="text-[13px] font-bold leading-tight truncate text-white">{track.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded-md border text-[10px] font-black uppercase shrink-0" style={getTagStyles(track.category)}>{track.category}</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Listened:: <span className="text-[13px] text-white">{track.playCount}</span></span>
                      <span className="text-white/10">·</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-pink-400">Liked:: <span className="text-[13px] text-white">{track.likeCount||0}</span></span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={e=>handleToggleFavorite(track.id,e)} className={`w-6 h-6 flex items-center justify-center rounded-lg transition-all ${track.isFavorite?'text-pink-400 bg-pink-500/10':'text-slate-600 hover:text-pink-400'}`}><i className={`fa-${track.isFavorite?'solid':'regular'} fa-heart text-xs`}/></button>
                    <button onClick={e=>{e.stopPropagation();setReviewingTrackId(track.id);}} className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-yellow-400 transition-all"><i className="fa-regular fa-star text-xs"/></button>
                    {isAuthorized&&<button onClick={e=>{e.stopPropagation();setConfirmDeleteId(track.id);}} className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-600 hover:text-red-400 transition-all"><i className="fa-solid fa-xmark text-xs"/></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Visual area ── */}
        <section className='music-visual-section flex-1 flex flex-col overflow-y-auto min-w-0 custom-scrollbar' style={{background:'#0a0010'}}>
          {currentTrack&&(
            <div className="absolute opacity-0 pointer-events-none w-0 h-0">
              {type==='soundcloud'
                ? <iframe key={`sc-${currentTrackId}`} id="sc-player" width="1" height="1" scrolling="no" frameBorder="no" allow="autoplay" src={embedUrl}/>
                : <iframe key={`yt-${currentTrackId}`} id="yt-player" width="1" height="1" src={embedUrl} frameBorder="0" allow="autoplay; encrypted-media" allowFullScreen
                    onLoad={e=>{ try{(e.target as HTMLIFrameElement).contentWindow?.postMessage(JSON.stringify({event:'listening',id:1}),'*');}catch{} }}/>
              }
            </div>
          )}

          <div className="w-full flex flex-col gap-0">

            {/* Canvas block */}
            <div className="w-full px-8 pt-8">
              <div ref={musicPlayerRef} className="w-full bg-black rounded-[1.5rem] overflow-hidden border border-white/10 shadow-2xl relative" style={{height:'calc(100vh - 320px)',minHeight:300,opacity:crossfading?0:1,transition:'opacity 0.6s ease',cursor:isPlaying?'none':'default'}}>
                {/* Idle/paused background */}
                <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,background:'radial-gradient(ellipse at 50% 50%,#1a0035 0%,#0a001a 60%,#000 100%)',opacity:(currentTrack&&isPlaying)?0:1,transition:'opacity 0.4s ease',pointerEvents:(currentTrack&&isPlaying)?'none':'auto'}}>
                  {currentTrack?(
                    <TrackThumbnail artist={currentTrack.artist} title={currentTrack.title} category={currentTrack.category} thumbnail={currentTrack.thumbnail||''} className="relative z-10 rounded-2xl shadow-2xl border border-white/10" style={{width:'50%',height:'45%',maxWidth:320,maxHeight:200,opacity:0.7}}/>
                  ):(
                    <div className="flex items-end justify-center gap-[3px] h-40 w-1/2">
                      {Array.from({length:36}).map((_,i)=>(<div key={i} style={{flex:1,borderRadius:'2px 2px 0 0',height:`${15+Math.abs(Math.sin(i*.6))*65+(i%4)*8}%`,background:`hsl(${265+i*3},70%,55%)`}}/>))}
                    </div>
                  )}
                  <i className="fa-solid fa-music" style={{fontSize:36,color:'#a855f7',opacity:0.5}}/>
                  <p className="text-[11px] font-black uppercase tracking-widest text-purple-400">{currentTrack?'Paused — Click Play':'Select a Track to Begin'}</p>
                  {currentTrack&&(<button onClick={()=>setIsPlaying(true)} className="mt-2 px-6 py-2 rounded-xl bg-purple-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/30"><i className="fa-solid fa-play mr-2"/>Play</button>)}
                </div>
                {/* Artwork */}
                {currentTrack&&(
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'radial-gradient(ellipse at 50% 40%,#0d001a 0%,#000 80%)',opacity:(isPlaying&&!showVisualizer)?1:0,transition:'opacity 0.4s ease',pointerEvents:(isPlaying&&!showVisualizer)?'auto':'none'}} onClick={()=>setIsPlaying(p=>!p)}>
                    <img src={currentTrack.thumbnail} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.25,filter:'blur(40px)',transform:'scale(1.1)'}}/>
                    <img src={currentTrack.thumbnail} alt={currentTrack.title} style={{position:'relative',zIndex:1,width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                )}
                {/* Visualizer */}
                <div
                  style={{position:'absolute',inset:0,zIndex:10,opacity:showVisualizer?1:0,transition:'opacity 0.4s ease',pointerEvents:showVisualizer?'auto':'none',cursor:showVisualizer&&isPlaying?'none':'default'}}
                  onClick={()=>{ setIsPlaying(p=>!p); }}
                >
                  <VisualizerCanvas onActivate={()=>setShowVisualizer(true)} active={showVisualizer} initialMode={vizInitialMode} autoStart={vizAutoStart} isPlaying={isPlaying}/>
                  {/* Pause indicator shown in fullscreen when paused */}
                  {isMusicFullscreen && !isPlaying && (
                    <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.4)',zIndex:20,pointerEvents:'none'}}>
                      <div style={{width:80,height:80,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'2px solid rgba(255,255,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                        <div style={{display:'flex',gap:8}}>
                          <div style={{width:10,height:34,background:'#fff',borderRadius:3}}/>
                          <div style={{width:10,height:34,background:'#fff',borderRadius:3}}/>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {(currentTrack&&isPlaying&&!showVisualizer)&&(
                  <VisualizerPickerOnly onActivate={(m)=>{if(m===-1){setVizAutoStart(true);setShowVisualizer(true);}else{setVizInitialMode(m??Math.floor(Math.random()*35));setVizAutoStart(false);setShowVisualizer(true);}}}/>
                )}
              </div>
            </div>

            {/* ── Track Info Bar — exact same position/style as video stats bar ── */}
            {currentTrack&&(
              <div className="w-full animate-fade-in px-8 pb-20">
                <div className="bg-white/5 border border-white/5 rounded-3xl flex flex-wrap items-center justify-between px-8 py-4 w-full gap-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="px-3 py-1 border text-[10px] font-black uppercase rounded-full tracking-widest shrink-0" style={{color:genreColors[currentTrack.category]||'#94a3b8',borderColor:`${genreColors[currentTrack.category]||'#94a3b8'}60`,background:`${genreColors[currentTrack.category]||'#94a3b8'}20`}}>{currentTrack.category}</span>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Listened::</span><span className="text-[13px] font-black text-white">{currentTrack.playCount.toLocaleString()}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Liked::</span><span className="text-[13px] font-black text-white">{(currentTrack.likeCount||0).toLocaleString()}</span></div>
                      <button onClick={()=>setShowReviewPanel(p=>!p)} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-message text-[11px]"/><span>Reviews::</span><span className="text-[13px] font-black text-white ml-0.5">{approvedReviews.filter(r=>r.trackId===currentTrack.id).length}</span></button>
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Vault::</span><span className="text-[13px] font-black text-white">{tracks.filter(t=>t.isFavorite).length}</span></div>
                    </div>
                  </div>
                  <button
                    onClick={()=>{ if(!document.fullscreenElement){musicPlayerRef.current?.requestFullscreen?.();}else{document.exitFullscreen();} }}
                    className="w-9 h-9 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex-shrink-0"
                    title="Fullscreen"
                  >
                    <i className="fa-solid fa-expand text-xs" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Identify Modal ── */}
      {showIdentify&&(
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center" onClick={()=>setShowIdentify(false)}>
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-8 w-80 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center"><i className="fa-solid fa-user-astronaut text-blue-400"/></div><div><p className="text-[11px] font-black uppercase tracking-widest text-blue-400">Identify</p><p className="text-[9px] text-slate-600 uppercase tracking-widest">IntegralStream Archive</p></div></div>
            <div className="mb-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Your Name</label>
              <input autoFocus type="text" value={identifyName} onChange={e=>{setIdentifyName(e.target.value);setIdentifyErr('');}} onKeyDown={e=>e.key==='Enter'&&handleIdentify()} placeholder="Enter your name" className="w-full h-10 px-4 rounded-xl bg-black/60 border border-white/10 text-white text-sm font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500/40 uppercase"/>
              {identifyErr&&<p className="text-[9px] text-red-400 font-black uppercase tracking-widest mt-2">{identifyErr}</p>}
              {isUserLocked&&<p className="text-[9px] text-slate-600 uppercase tracking-widest mt-2">Currently: {currentUser.replace(/_/g,' ')}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={()=>setShowIdentify(false)} className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-400 text-[10px] font-black uppercase hover:text-white transition-all">Cancel</button>
              <button onClick={handleIdentify} className="flex-1 h-9 rounded-xl bg-blue-600 text-white text-[10px] font-black uppercase hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20">Confirm</button>
            </div>
            {isUserLocked&&(<button onClick={handleIdentifyLogout} className="w-full mt-2 h-9 rounded-xl bg-white/5 border border-white/10 text-slate-500 text-[10px] font-black uppercase hover:text-red-400 hover:border-red-500/20 transition-all flex items-center justify-center gap-2"><i className="fa-solid fa-arrow-right-from-bracket text-xs"/>Log Out</button>)}
          </div>
        </div>
      )}

      {/* ── Admin Login Modal ── */}
      {showAdminLogin&&(
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center" onClick={()=>setShowAdminLogin(false)}>
          <div className="bg-slate-950 border border-white/10 rounded-2xl p-8 w-80 shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center"><i className="fa-solid fa-lock text-blue-400"/></div><div><p className="text-[11px] font-black uppercase tracking-widest text-blue-400">Admin Access</p><p className="text-[9px] text-slate-600 uppercase tracking-widest">IntegralStream</p></div></div>
            <div className="mb-4">
              <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Password</label>
              <input autoFocus type="password" value={adminPass} onChange={e=>{setAdminPass(e.target.value);setAdminError('');}} onKeyDown={e=>e.key==='Enter'&&handleAdminLogin()} placeholder="Enter admin password" className="w-full h-10 px-4 rounded-xl bg-black/60 border border-white/10 text-white text-sm font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500/40"/>
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


// ─── App (Video side) ──────────────────────────────────────────────────────────

const DATA_KEY       = `integral_vault_v${LIBRARY_VERSION}`;
const VERSION_KEY    = `integral_version_v${LIBRARY_VERSION}`;
const CAT_KEY        = `integral_categories_v${LIBRARY_VERSION}`;
const CAT_COLORS_KEY = `integral_cat_colors_v${LIBRARY_VERSION}`;

const generateNodeId = () => {
  const parts = ['INT', Math.random().toString(36).substring(2, 6).toUpperCase(), Math.floor(Math.random() * 90 + 10)];
  return parts.join('-');
};

const DEFAULT_CATEGORIES: VideoCategory[] = [
  'Meditation','Tribal','Dance','Integral Serenity','Permia Community','Spanish','Fav. Pick','Environment','Other'
];

const DEFAULT_CAT_COLORS: Record<string, string> = {
  'Meditation':'#10b981','Tribal':'#f97316','Dance':'#d946ef','Integral Serenity':'#3b82f6',
  'Permia Community':'#fbbf24','Spanish':'#8b5cf6','Fav. Pick':'#ec4899','Environment':'#22c55e','Other':'#94a3b8'
};

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => localStorage.getItem(AUTH_KEY) === 'true');
  const [currentUser,  setCurrentUser]  = useState<string>(() => localStorage.getItem(USER_KEY) || MASTER_IDENTITY);
  const [isUserLocked, setIsUserLocked] = useState<boolean>(() => localStorage.getItem(USER_LOCKED_KEY) === 'true');
  const [showNameTooltip, setShowNameTooltip] = useState<boolean>(() => localStorage.getItem('integral_name_tooltip_dismissed') !== 'true');

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
    return { ...HARDCODED_FAVORITES, ...localMap };
  });

  const [showMusic,            setShowMusic]            = useState(false);
  const [showLoginOverlay,     setShowLoginOverlay]     = useState(() => !localStorage.getItem(USER_KEY));
  const [activeSecondaryView,  setActiveSecondaryView]  = useState<'none'|'reviews'|'vault'|'moderation'>('none');
  const [reviewInitialTab,     setReviewInitialTab]     = useState<'Read'|'Write'>('Read');
  const [isPlaying,            setIsPlaying]            = useState(false);
  const [videoCrossfading,     setVideoCrossfading]     = useState(false);
  const [playlistTab,          setPlaylistTab]          = useState<VideoCategory|'All'|'Vault'>('All');
  const [isSyncingLive,        setIsSyncingLive]        = useState(false);
  const [isCheckingSync,       setIsCheckingSync]       = useState(false);
  const [cloudVersion,         setCloudVersion]         = useState<number>(LIBRARY_VERSION);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  useEffect(() => { const h = () => setIsVideoFullscreen(!!document.fullscreenElement); document.addEventListener('fullscreenchange', h); return () => document.removeEventListener('fullscreenchange', h); }, []);
  const checkSyncLock = useRef(false);

  useEffect(() => {
    localStorage.setItem(USER_KEY, currentUser);
    localStorage.setItem(USER_LOCKED_KEY, isUserLocked ? 'true' : 'false');
    localStorage.setItem(USER_NODE_ID_KEY, nodeId);
  }, [currentUser, isUserLocked, nodeId]);

  useEffect(() => { localStorage.setItem(FAV_MAP_KEY, JSON.stringify(userFavMap)); }, [userFavMap]);

  const handleIdentify = (name: string, remember: boolean) => {
    const cleanName = name.trim().toUpperCase().replace(/\s+/g, '_');
    if (cleanName) {
      setCurrentUser(cleanName); setIsUserLocked(true);
      if (remember) { localStorage.setItem(USER_KEY, cleanName); localStorage.setItem(USER_LOCKED_KEY, 'true'); }
      localStorage.setItem('integral_name_tooltip_dismissed', 'true');
      setShowNameTooltip(false);
      setShowLoginOverlay(false); return true;
    }
    return false;
  };

  const handleLogout = () => {
    setCurrentUser(MASTER_IDENTITY); setIsUserLocked(false);
    localStorage.removeItem(USER_KEY); localStorage.removeItem(USER_LOCKED_KEY);
    setActiveSecondaryView('none'); setShowLoginOverlay(true);
  };

  const handleRestoreNode = (key: string) => {
    if (key.startsWith('INT-')) { setNodeId(key); setIsUserLocked(true); setShowLoginOverlay(false); return true; }
    return false;
  };

  useEffect(() => {
    const sync = () => setIsAuthorized(localStorage.getItem(AUTH_KEY) === 'true');
    const onStorage = (e: StorageEvent) => { if (e.key === AUTH_KEY) sync(); };
    window.addEventListener('storage', onStorage); document.addEventListener('visibilitychange', sync);
    return () => { window.removeEventListener('storage', onStorage); document.removeEventListener('visibilitychange', sync); };
  }, []);

  const handleAdminLogin = (pass: string, remember: boolean) => {
    if (pass === ADMIN_PASSWORD) {
      setIsAuthorized(true); localStorage.setItem(AUTH_KEY, 'true');
      window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'true' }));
      if (remember) localStorage.setItem(AUTH_KEY, 'true');
      setShowLoginOverlay(false); return true;
    }
    return false;
  };

  const triggerReload         = useCallback(() => { window.location.reload(); }, []);
  const triggerSyncSequence   = useCallback(() => { setIsSyncingLive(true); setTimeout(triggerReload, 1500); }, [triggerReload]);
  const handleHardSyncSource  = useCallback(() => {
    setIsSyncingLive(true);
    localStorage.removeItem(DATA_KEY); localStorage.removeItem(CAT_KEY);
    localStorage.removeItem(CAT_COLORS_KEY); localStorage.removeItem(VERSION_KEY); localStorage.removeItem(FAV_MAP_KEY);
    setTimeout(triggerReload, 2000);
  }, [triggerReload]);

  const checkVersion = useCallback(async (manual = false) => {
    if (checkSyncLock.current) return;
    checkSyncLock.current = true; setIsCheckingSync(true);
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
    } catch (e) {} finally { setIsCheckingSync(false); checkSyncLock.current = false; }
  }, [triggerSyncSequence]);

  useEffect(() => {
    checkVersion(false);
    const interval = setInterval(() => checkVersion(false), 60000);
    return () => clearInterval(interval);
  }, [checkVersion]);

  const [categories,     setCategories]     = useState<VideoCategory[]>(() => { const s=localStorage.getItem(CAT_KEY); return s?JSON.parse(s):DEFAULT_CATEGORIES; });
  const [categoryColors, setCategoryColors] = useState<Record<string,string>>(() => { const s=localStorage.getItem(CAT_COLORS_KEY); return s?JSON.parse(s):DEFAULT_CAT_COLORS; });

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
    localStorage.setItem(DATA_KEY, JSON.stringify(videos));
    localStorage.setItem(VERSION_KEY, LIBRARY_VERSION.toString());
    localStorage.setItem(AUTH_KEY, isAuthorized ? 'true' : 'false');
    localStorage.setItem(CAT_KEY, JSON.stringify(categories));
    localStorage.setItem(CAT_COLORS_KEY, JSON.stringify(categoryColors));
  }, [videos, isAuthorized, categories, categoryColors]);

  const currentUserFavorites = useMemo(() => userFavMap[currentUser] || [], [userFavMap, currentUser]);
  const vaultCount           = useMemo(() => currentUserFavorites.length, [currentUserFavorites]);
  const pendingReviewsCount  = useMemo(() => videos.reduce((acc, video) => acc + (video.reviews?.filter(r => !r.isApproved).length || 0), 0), [videos]);

  const handleRemoveVideo = useCallback((id: string) => {
    setVideos(prev => { const filtered = prev.filter(v => v.id !== id); if (currentVideoId === id) setCurrentVideoId(filtered.length > 0 ? filtered[0].id : undefined); return filtered; });
    setUserFavMap(prev => { const next = { ...prev }; Object.keys(next).forEach(u => { next[u] = next[u].filter(fid => fid !== id); }); return next; });
  }, [currentVideoId]);

  const handleManualAdd = useCallback((u: string, p: string, c: VideoCategory) => {
    const nv: VideoItem = { id:`m-${Date.now()}`,url:u,prompt:p,category:c,isFavorite:false,viewCount:0,likeCount:0,dislikeCount:0,status:'ready',timestamp:Date.now(),rating:0,isLiked:false,isDisliked:false,reviews:[] };
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
      return { ...prev, [currentUser]: isAlreadyFav ? userFavs.filter(fid => fid !== id) : [...userFavs, id] };
    });
  }, [currentUser]);

  const handleVideoFullscreen = useCallback(() => {
    const el = playerContainerRef.current?.querySelector('iframe') || playerContainerRef.current;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen();
    else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
  }, []);

  const handleToggleLike    = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, isLiked: !v.isLiked, likeCount: v.isLiked ? v.likeCount - 1 : v.likeCount + 1, isDisliked: v.isLiked ? v.isDisliked : false, dislikeCount: (v.isLiked || !v.isDisliked) ? v.dislikeCount : v.dislikeCount - 1 } : v)); }, []);
  const handleToggleDislike = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, isDisliked: !v.isDisliked, dislikeCount: v.isDisliked ? v.dislikeCount - 1 : v.dislikeCount + 1, isLiked: v.isDisliked ? v.isLiked : false, likeCount: (v.isDisliked || !v.isLiked) ? v.likeCount : v.likeCount - 1 } : v)); }, []);
  const handleIncrementView = useCallback((id: string) => { setVideos(prev => prev.map(v => v.id === id ? { ...v, viewCount: v.viewCount + 1 } : v)); }, []);
  const handleSelectVideo   = useCallback((v: VideoItem) => { if (currentVideoId === v.id) { setIsPlaying(prev => !prev); } else { setCurrentVideoId(v.id); setIsPlaying(true); } }, [currentVideoId]);

  // Increment view after 5 continuous seconds of playback
  const viewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (viewTimerRef.current) clearTimeout(viewTimerRef.current);
    if (isPlaying && currentVideoId) {
      viewTimerRef.current = setTimeout(() => { handleIncrementView(currentVideoId); }, 10000);
    }
    return () => { if (viewTimerRef.current) clearTimeout(viewTimerRef.current); };
  }, [isPlaying, currentVideoId]);

  // Auto-advance on video end
  useEffect(()=>{
    const onMsg=(e:MessageEvent)=>{
      try {
        const d=typeof e.data==='string'?JSON.parse(e.data):e.data;
        if(d?.event==='onStateChange'&&d?.info===0){
          setVideoCrossfading(true);
          setTimeout(()=>{
            setVideos(prev=>{
              const idx=prev.findIndex(v=>v.id===currentVideoId);
              if(idx>=0){ const next=prev[(idx+1)%prev.length]; setCurrentVideoId(next.id); setIsPlaying(true); }
              return prev;
            });
            setVideoCrossfading(false);
          },600);
        }
      } catch {}
    };
    window.addEventListener('message',onMsg);
    return ()=>window.removeEventListener('message',onMsg);
  },[currentVideoId]);

  const handleAddCategory    = (name: string, color?: string) => { if (!categories.includes(name)) { setCategories(prev => [...prev, name]); setCategoryColors(prev => ({ ...prev, [name]: color || '#94a3b8' })); } };
  const handleRemoveCategory = (name: string) => { setCategories(prev => prev.filter(c => c !== name)); if (playlistTab === name) setPlaylistTab('All'); };

  const currentVideo = useMemo(() => videos.find(v => v.id === currentVideoId) || null, [videos, currentVideoId]);

  return (
    <div className="h-screen bg-transparent text-slate-100 flex flex-col font-sans relative selection:bg-blue-500/30 overflow-hidden">
      {/* Background Watermark */}
      <div className="fixed bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] opacity-[0.03] pointer-events-none z-0 rotate-12 select-none">
        <IntegralLogo className="w-full h-full" />
      </div>

      {isSyncingLive && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center animate-fade-in backdrop-blur-3xl">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center"><i className="fa-brands fa-github text-blue-500 text-3xl animate-pulse"></i></div>
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
            <div className="flex items-center gap-2 mt-1"><p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Personalized Archive</p></div>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex flex-col items-end relative group" id="user-btn-anchor">
            {/* Onboarding tooltip — shows until user picks a name */}
            {showNameTooltip && (
              <div style={{position:'absolute',top:'52px',right:0,zIndex:9999,pointerEvents:'auto'}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
                  {/* Arrow */}
                  <div style={{width:0,height:0,borderLeft:'9px solid transparent',borderRight:'9px solid transparent',borderBottom:'9px solid #2563eb',marginRight:18}}/>
                  {/* Box */}
                  <div style={{background:'#0f172a',border:'2px solid #2563eb',borderRadius:14,padding:'12px 18px 10px',boxShadow:'0 0 32px #2563eb60, 0 8px 32px rgba(0,0,0,0.8)',minWidth:200}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                      <span style={{fontSize:8,fontWeight:900,letterSpacing:'0.2em',color:'#facc15',textTransform:'uppercase'}}>👤 USER</span>
                      <button onClick={()=>{ localStorage.setItem('integral_name_tooltip_dismissed','true'); setShowNameTooltip(false); }} style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:10,lineHeight:1,padding:'0 0 0 8px'}}>✕</button>
                    </div>
                    <p style={{fontSize:12,fontWeight:900,color:'#fff',margin:'0 0 4px',letterSpacing:'0.02em'}}>Pick a name for yourself!</p>
                    <p style={{fontSize:9,color:'#93c5fd',margin:0,fontWeight:600}}>Click here to sign up ↑</p>
                  </div>
                </div>
              </div>
            )}
            <div onClick={() => isUserLocked ? handleLogout() : setShowLoginOverlay(true)}
              className="px-4 h-11 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center gap-3 transition-all cursor-pointer hover:bg-blue-600/20">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5">
                  {isUserLocked ? (<i className="fa-solid fa-lock text-[7px] text-blue-500/60 group-hover:hidden"></i>) : currentUser === MASTER_IDENTITY ? (<i className="fa-solid fa-code text-[7px] text-blue-500"></i>) : (<div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>)}
                  {isUserLocked && <i className="fa-solid fa-arrow-right-from-bracket text-[7px] text-white hidden group-hover:inline-block"></i>}
                  <span className="text-[7px] font-black text-blue-500/60 uppercase tracking-widest group-hover:text-white transition-colors">{isUserLocked ? 'Verified (Disconnect)' : 'Identified Persona'}</span>
                </div>
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest group-hover:text-blue-400 transition-colors">{currentUser}</span>
              </div>
              <i className={`fa-solid ${isUserLocked ? 'fa-user-lock' : 'fa-id-badge'} text-blue-500 text-xs`}></i>
            </div>
          </div>
          {isAuthorized && (
            <button onClick={() => setActiveSecondaryView(v => v === 'moderation' ? 'none' : 'moderation')}
              className={`h-11 px-4 rounded-xl flex items-center gap-2 border transition-all relative font-black text-[10px] tracking-widest uppercase ${activeSecondaryView === 'moderation' ? 'bg-white text-black shadow-lg' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:border-white/20'}`}>
              <i className="fa-solid fa-terminal text-base"></i><span>Console</span>
              {pendingReviewsCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 rounded-full text-[10px] font-black flex items-center justify-center border-2 border-black shadow-lg">{pendingReviewsCount}</span>}
            </button>
          )}
          <button onClick={() => {
            if (isAuthorized) { setIsAuthorized(false); localStorage.setItem(AUTH_KEY, 'false'); window.dispatchEvent(new StorageEvent('storage', { key: AUTH_KEY, newValue: 'false' })); }
            else { setShowLoginOverlay(true); }
          }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${isAuthorized ? 'bg-blue-600/10 border-blue-500/20 text-blue-400' : 'bg-white/5 border-white/10 text-slate-500 hover:text-white'}`}>
            <i className={`fa-solid ${isAuthorized ? 'fa-unlock' : 'fa-lock'}`}></i>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10" style={{minHeight:0}}>
        <aside className="w-[490px] flex-shrink-0 min-w-0 border-r border-white/5 bg-black/20 overflow-y-auto custom-scrollbar">
          <Playlist videos={videos} categories={categories} categoryColors={categoryColors} currentVideo={currentVideo} onSelect={handleSelectVideo} onRemove={handleRemoveVideo} onToggleFavorite={handleToggleFavorite} userFavorites={currentUserFavorites} onAddRandom={() => { const v = getSurpriseVideo(); setVideos(p => [v, ...p]); setCurrentVideoId(v.id); }} onAddManualVideo={handleManualAdd} onMoveVideo={() => {}} onPurgeAll={handlePurgeAll} activeTab={playlistTab} setActiveTab={setPlaylistTab} isAuthorized={isAuthorized} onAddCategory={handleAddCategory} onRemoveCategory={handleRemoveCategory} onUpdateCategoryColor={() => {}} onOpenMusicApp={() => { setShowMusic(true); setIsPlaying(false); }} onMoveToFavPick={() => {}} onWriteReview={(videoId, rating, comment) => { const review = { id: `r-${Date.now()}`, rating: rating||5, text: comment||'', user: currentUser, timestamp: Date.now(), isApproved: false }; setVideos(prev => prev.map(v => v.id === videoId ? { ...v, reviews: [review, ...(v.reviews || [])] } : v)); }} />
        </aside>

        {/* ── Main video section — NO Controls Row here ── */}
        <section className="flex-1 flex flex-col bg-transparent overflow-y-auto min-w-0 custom-scrollbar">
          <div className="w-full flex flex-col pt-8 gap-0">
            <div className="flex items-center justify-between px-8 mb-6">
              <h2 className="text-blue-600 font-black uppercase text-[10px] tracking-[0.4em] flex items-center gap-3"><span className="w-1 h-4 bg-blue-600 rounded-full"></span>{currentVideo ? "Current Video Stream" : "Select Video"}</h2>
            </div>
            <div className="px-8 w-full" ref={playerContainerRef}>
              {currentVideo ? (
                <div style={{opacity:videoCrossfading?0:1,transition:'opacity 0.6s ease'}}>
                  <VideoPlayer key={currentVideo.id} video={currentVideo} isFavorite={currentUserFavorites.includes(currentVideo.id)} isPlaying={isPlaying} onPlayStateChange={setIsPlaying} onToggleLike={() => handleToggleLike(currentVideo.id)} onToggleDislike={() => handleToggleDislike(currentVideo.id)} onToggleFavorite={() => handleToggleFavorite(currentVideo.id)} onWriteReview={() => { setReviewInitialTab('Write'); setActiveSecondaryView('reviews'); }} />
                </div>
              ) : (
                <div className="w-full aspect-video bg-slate-950 rounded-[1.5rem] border border-white/5 flex flex-col items-center justify-center text-slate-600 uppercase font-black text-xs gap-4">
                  <i className="fa-solid fa-cloud fa-3x animate-pulse text-slate-900"></i> Select Video
                </div>
              )}
            </div>
            {currentVideo && (
              <div className="w-full animate-fade-in px-8">
                <div className="bg-white/5 border border-white/5 rounded-3xl flex items-center justify-between px-8 py-4 w-full gap-4">
                  <div className="flex items-center gap-4 flex-wrap flex-1 min-w-0">
                    <span className="px-3 py-1 border text-[10px] font-black uppercase rounded-full tracking-widest shrink-0" style={{ color: categoryColors[currentVideo.category], borderColor: `${categoryColors[currentVideo.category]}60`, background: `${categoryColors[currentVideo.category]}20` }}>{currentVideo.category}</span>
                    <div className="flex items-center gap-6 flex-wrap">
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Views::</span><span className="text-[13px] font-black text-white">{currentVideo.viewCount.toLocaleString()}</span></div>
                      <div className="flex items-center gap-2"><span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Likes::</span><span className="text-[13px] font-black text-white">{currentVideo.likeCount.toLocaleString()}</span></div>
                      <button onClick={() => { setReviewInitialTab('Read'); setActiveSecondaryView('reviews'); }} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-message text-[11px]"></i><span>Reviews::</span><span className="text-[13px] font-black text-white ml-0.5">{(currentVideo.reviews?.length || 0).toLocaleString()}</span></button>
                      <button onClick={() => setActiveSecondaryView(v => v === 'vault' ? 'none' : 'vault')} className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 flex items-center gap-2 transition-colors"><i className="fa-solid fa-vault text-[11px]"></i><span>{currentUser.replace(/_/g, ' ')}'S VAULT::</span><span className="text-[13px] font-black text-white ml-0.5">{vaultCount.toLocaleString()}</span></button>
                    </div>
                  </div>
                  <button onClick={() => { const el = playerContainerRef.current?.querySelector('iframe') || playerContainerRef.current; if (!el) return; if (!document.fullscreenElement) { (el as HTMLElement).requestFullscreen?.(); } else { document.exitFullscreen(); } }} className="w-9 h-9 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex-shrink-0" title="Fullscreen"><i className="fa-solid fa-expand text-xs" /></button>
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
            </div>
          </div>
        </section>
      </div>

      {showLoginOverlay && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6 backdrop-blur-3xl">
          <LoginGate onLogin={handleAdminLogin} onIdentify={handleIdentify} onRestore={handleRestoreNode} isIdentityLocked={isUserLocked} onClose={() => isUserLocked && setShowLoginOverlay(false)} defaultName={currentUser !== MASTER_IDENTITY ? currentUser : ''} />
        </div>
      )}

      {showMusic && (
        <MusicApp currentUser={currentUser} isAuthorized={isAuthorized} onClose={() => { setShowMusic(false); }} isUserLocked={isUserLocked} onLogout={handleLogout} onAdminClick={() => setShowLoginOverlay(true)} />
      )}
    </div>
  );
};

export default App;
