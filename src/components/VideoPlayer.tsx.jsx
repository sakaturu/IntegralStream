import { useState, useRef, useEffect } from "react";

export default function App() {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iconVisible, setIconVisible] = useState(false);
  const [iconType, setIconType] = useState("play");
  const [progress, setProgress] = useState(0);
  const [times, setTimes] = useState("0:00 / 0:00");
  const fadeRef = useRef(null);

  function fmt(s) {
    s = Math.floor(s || 0);
    return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
  }

  function toggle() {
    const v = videoRef.current;
    if (!v || !hasVideo) return;
    v.paused ? v.play() : v.pause();
  }

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    function onPlay() {
      setIsPlaying(true);
      setIconType("pause");
      setIconVisible(true);
      clearTimeout(fadeRef.current);
      fadeRef.current = setTimeout(() => setIconVisible(false), 1800);
    }

    function onPause() {
      setIsPlaying(false);
      setIconType("play");
      setIconVisible(true);
      clearTimeout(fadeRef.current);
    }

    function onTime() {
      if (!v.duration) return;
      setProgress(v.currentTime / v.duration * 100);
      setTimes(fmt(v.currentTime) + " / " + fmt(v.duration));
    }

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onPause);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onPause);
      v.removeEventListener("timeupdate", onTime);
    };
  }, []);

  function loadFile(file) {
    if (!file || !file.type.startsWith("video/")) return;
    const v = videoRef.current;
    v.src = URL.createObjectURL(file);
    setHasVideo(true);
    v.play();
  }

  function seek(e) {
    const v = videoRef.current;
    if (!v?.duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
  }

  return (
    <div style={{background:"#0d0d0d", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20}}>
      <div style={{width:"100%", maxWidth:680}}>
        <div style={{position:"relative", width:"100%", aspectRatio:"16/9", background:"#000", borderRadius:12, overflow:"hidden", boxShadow:"0 24px 80px #000"}}>

          <video
            ref={videoRef}
            onClick={toggle}
            style={{position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"contain", cursor:"pointer", zIndex:2, display:"block"}}
          />

          {!hasVideo && (
            <div
              onClick={() => fileInputRef.current.click()}
              style={{position:"absolute", inset:0, zIndex:5, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, color:"rgba(255,255,255,0.35)", fontSize:13, cursor:"pointer", fontFamily:"monospace", letterSpacing:2}}
            >
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect x="2" y="9" width="36" height="26" rx="4" stroke="white" strokeWidth="2" opacity=".3"/>
                <path d="M38 19l14-8v24l-14-8V19z" stroke="white" strokeWidth="2" opacity=".3"/>
              </svg>
              CLICK TO LOAD VIDEO
            </div>
          )}

          {/* BIG ICON - pointerEvents none always */}
          <div style={{
            position:"absolute", top:"50%", left:"50%",
            transform:"translate(-50%,-50%)",
            width:130, height:130, borderRadius:"50%",
            background:"rgba(0,0,0,0.6)",
            border:"3px solid rgba(255,255,255,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center",
            pointerEvents:"none",
            zIndex:10,
            opacity: iconVisible ? 1 : 0,
            transition:"opacity 0.3s ease"
          }}>
            {iconType === "pause"
              ? <div style={{display:"flex", gap:12}}>
                  <div style={{width:13, height:46, background:"#fff", borderRadius:4}}/>
                  <div style={{width:13, height:46, background:"#fff", borderRadius:4}}/>
                </div>
              : <div style={{width:0, height:0, borderTop:"25px solid transparent", borderBottom:"25px solid transparent", borderLeft:"44px solid #fff", marginLeft:10}}/>
            }
          </div>

          <div style={{position:"absolute", bottom:0, left:0, right:0, height:80, background:"linear-gradient(transparent,rgba(0,0,0,0.85))", pointerEvents:"none", zIndex:8}}/>

          <div style={{position:"absolute", bottom:0, left:0, right:0, padding:"10px 16px", display:"flex", alignItems:"center", gap:12, zIndex:20}}>
            <button
              onClick={e => { e.stopPropagation(); toggle(); }}
              style={{background:"none", border:"none", cursor:"pointer", width:34, height:34, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0}}
            >
              {isPlaying
                ? <div style={{display:"flex",gap:5}}><div style={{width:5,height:18,background:"#fff",borderRadius:2}}/><div style={{width:5,height:18,background:"#fff",borderRadius:2}}/></div>
                : <div style={{width:0,height:0,borderTop:"9px solid transparent",borderBottom:"9px solid transparent",borderLeft:"16px solid #fff"}}/>
              }
            </button>
            <div onClick={seek} style={{flex:1, height:5, background:"rgba(255,255,255,0.25)", borderRadius:5, cursor:"pointer"}}>
              <div style={{height:"100%", width:progress+"%", background:"#fff", borderRadius:5, pointerEvents:"none"}}/>
            </div>
            <span style={{color:"rgba(255,255,255,0.7)", fontSize:11, whiteSpace:"nowrap", fontFamily:"monospace"}}>{times}</span>
          </div>
        </div>
        <div style={{marginTop:12, textAlign:"center", color:"rgba(255,255,255,0.12)", fontSize:10, letterSpacing:3, fontFamily:"monospace"}}>CLICK VIDEO TO PLAY · PAUSE</div>
      </div>
      <input ref={fileInputRef} type="file" accept="video/*" style={{display:"none"}} onChange={e => loadFile(e.target.files[0])}/>
    </div>
  );
}
