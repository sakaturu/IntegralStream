import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'orbit' | 'spectrum' | 'radial' | 'waveform';

interface Transition { from: Mode; to: Mode; progress: number; active: boolean; }

interface AudioRefs {
  ctx:       AudioContext | null;
  analyser:  AnalyserNode | null;
  source:    AudioNode | null;
  micStream: MediaStream | null;
}

export interface VisualizerCanvasProps {
  initialMode?:  number;
  /** Pass your template's <audio> element to keep play/pause in sync */
  externalAudio?: HTMLAudioElement | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;
const ease  = (t: number) => t * t * (3 - 2 * t);
const avgBand = (d: Uint8Array | Float32Array, lo: number, hi: number) => {
  let s = 0; for (let i = lo; i <= hi && i < d.length; i++) s += d[i];
  return s / (hi - lo + 1);
};
const lerpArrays = (a: Uint8Array, b: Uint8Array, t: number): Float32Array => {
  const out = new Float32Array(Math.min(a.length, b.length));
  for (let i = 0; i < out.length; i++) out[i] = lerp(a[i], b[i], t);
  return out;
};

// ─── Draw functions ───────────────────────────────────────────────────────────

type FD = Uint8Array | Float32Array;

function drawOrbit(c: CanvasRenderingContext2D, w: number, h: number, freq: FD, t: number, bass: number) {
  c.fillStyle = `rgba(5,5,8,${0.18 + bass * 0.0003})`; c.fillRect(0, 0, w, h);
  c.save(); c.translate(w / 2, h / 2);
  const scale = 1 + bass / 180;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 + t * 0.4;
    const fVal  = freq[Math.floor((i / 8) * freq.length * 0.6)] / 255;
    const dist  = (120 + fVal * 110) * scale;
    const size  = (32 + fVal * 55) * scale;
    const hue   = (t * 35 + i * 45) % 360;
    const ox = Math.cos(angle) * dist, oy = Math.sin(angle) * dist;
    const g = c.createRadialGradient(ox, oy, 0, ox, oy, size * 1.8);
    g.addColorStop(0, `hsla(${hue},100%,72%,${0.45 + fVal * 0.45})`);
    g.addColorStop(1, 'transparent');
    c.fillStyle = g; c.beginPath(); c.arc(ox, oy, size * 1.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = `hsla(${hue},100%,88%,${0.7 + fVal * 0.3})`;
    c.beginPath(); c.arc(ox, oy, size * 0.28, 0, Math.PI * 2); c.fill();
  }
  const cHue = (t * 60) % 360, cR = 24 + bass / 12;
  const cg = c.createRadialGradient(0, 0, 0, 0, 0, cR * 2.5);
  cg.addColorStop(0, `hsla(${cHue},100%,95%,0.9)`); cg.addColorStop(1, 'transparent');
  c.fillStyle = cg; c.beginPath(); c.arc(0, 0, cR * 2.5, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawSpectrum(c: CanvasRenderingContext2D, w: number, h: number, freq: FD, t: number, bass: number) {
  c.fillStyle = 'rgba(5,5,8,0.3)'; c.fillRect(0, 0, w, h);
  const bars = 90, gap = 2, barW = (w - gap * (bars - 1)) / bars;
  const baseY = h * 0.72, maxH = h * 0.62, bScale = 1 + bass / 320;
  for (let i = 0; i < bars; i++) {
    const val  = freq[Math.floor(i * freq.length * 0.55 / bars)] / 255;
    const barH = val * maxH * bScale + 2, x = i * (barW + gap);
    const hue  = 195 + val * 130 + bass * 0.15, lit = 42 + val * 32;
    c.fillStyle = `hsla(${hue},90%,${lit}%,0.18)`; c.fillRect(x, baseY, barW, barH * 0.45);
    const gr = c.createLinearGradient(x, baseY - barH, x, baseY);
    gr.addColorStop(0, `hsla(${hue},100%,${lit + 20}%,1)`);
    gr.addColorStop(1, `hsla(${hue},70%,25%,0.6)`);
    c.fillStyle = gr; c.fillRect(x, baseY - barH, barW, barH);
    if (val > 0.45) { c.fillStyle = `hsla(${hue},100%,92%,${val * 0.9})`; c.fillRect(x, baseY - barH - 3, barW, 3); }
  }
  c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(0, baseY); c.lineTo(w, baseY); c.stroke();
}

function drawRadial(c: CanvasRenderingContext2D, w: number, h: number, freq: FD, t: number, bass: number) {
  c.fillStyle = 'rgba(5,5,8,0.22)'; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, cnt = 160, iR = 70 + bass * 0.35;
  for (let i = 0; i < cnt; i++) {
    const angle = (i / cnt) * Math.PI * 2 - Math.PI / 2;
    const val   = freq[Math.floor(i * freq.length * 0.5 / cnt)] / 255;
    const oR    = iR + val * Math.min(w, h) * 0.34;
    const hue   = (i / cnt * 300 + t * 60) % 360;
    c.beginPath(); c.strokeStyle = `hsla(${hue},100%,68%,${0.5 + val * 0.5})`;
    c.lineWidth = 1.2 + val * 3.5;
    c.moveTo(cx + Math.cos(angle) * iR, cy + Math.sin(angle) * iR);
    c.lineTo(cx + Math.cos(angle) * oR, cy + Math.sin(angle) * oR); c.stroke();
  }
  const og = c.createRadialGradient(cx, cy, 0, cx, cy, iR * 0.55);
  og.addColorStop(0, `hsla(${(t * 80) % 360},100%,90%,${0.25 + bass / 900})`);
  og.addColorStop(1, 'transparent');
  c.fillStyle = og; c.beginPath(); c.arc(cx, cy, iR * 0.55, 0, Math.PI * 2); c.fill();
}

function drawWaveform(c: CanvasRenderingContext2D, w: number, h: number, time: FD, t: number, bass: number) {
  c.fillStyle = 'rgba(5,5,8,0.28)'; c.fillRect(0, 0, w, h);
  const baseHue = (t * 40) % 360, ampScale = 1 + bass / 220, sw = w / time.length;
  for (const layer of [{ yo:0, lw:2.5, a:0.92, dh:0 }, { yo:-6, lw:1.2, a:0.35, dh:20 }, { yo:6, lw:1.2, a:0.35, dh:-20 }]) {
    const hue = (baseHue + layer.dh + 360) % 360;
    c.beginPath(); c.strokeStyle = `hsla(${hue},100%,65%,${layer.a})`; c.lineWidth = layer.lw;
    c.shadowBlur = layer.lw > 2 ? 14 : 0; c.shadowColor = `hsl(${hue},100%,65%)`;
    for (let i = 0; i < time.length; i++) {
      const y = h / 2 + (time[i] / 128 - 1) * ampScale * h * 0.38 + layer.yo;
      i === 0 ? c.moveTo(0, y) : c.lineTo(i * sw, y);
    }
    c.stroke();
  }
  c.shadowBlur = 0;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES: Mode[]    = ['orbit', 'spectrum', 'radial', 'waveform'];
const LABELS           = ['ORBIT', 'SPECTRUM', 'RADIAL', 'WAVEFORM'];
const TRANSITION_MS    = 600;
const BEAT_COOLDOWN_MS = 1800;
const BEAT_MULT        = 1.35;

// ─── Component ────────────────────────────────────────────────────────────────

const VisualizerCanvas: React.FC<VisualizerCanvasProps> = ({ initialMode = 0, externalAudio }) => {

  // All refs declared at top so render loop closure is never stale
  const containerRef  = useRef<HTMLDivElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const osA           = useRef(document.createElement('canvas'));
  const osB           = useRef(document.createElement('canvas'));
  const audioRefs     = useRef<AudioRefs>({ ctx: null, analyser: null, source: null, micStream: null });
  const audioElRef    = useRef<HTMLAudioElement>(null);
  const audioFileRef  = useRef<HTMLInputElement>(null);
  const imageFileRef  = useRef<HTMLInputElement>(null);
  const bgImgRef      = useRef<HTMLImageElement | null>(null);

  // pausedRef is the single source of truth for the render loop
  const pausedRef     = useRef(false);

  const autoRef       = useRef(true);
  const modeRef       = useRef<Mode>(MODES[initialMode] ?? 'orbit');
  const transRef      = useRef<Transition>({ from: modeRef.current, to: modeRef.current, progress: 1, active: false });
  const transStart    = useRef(0);
  const frozenFreq    = useRef(new Uint8Array(1024).fill(0));
  const frozenTime    = useRef(new Uint8Array(1024).fill(128));
  const beatAvg       = useRef(0);
  const lastBeat      = useRef(0);
  const modeIdx       = useRef(initialMode ?? 0);

  // React state — only for re-rendering UI
  const [paused,      setPaused]     = useState(false);
  const [flashIcon,   setFlashIcon]  = useState<'pause'|'play'|null>(null);
  const [fullscreen,  setFullscreen] = useState(false);
  const [activeMode,  setActiveMode] = useState<Mode>(modeRef.current);
  const [auto,        setAuto]       = useState(true);
  const [isLive,      setIsLive]     = useState(false);
  const [isMic,       setIsMic]      = useState(false);
  const [trackName,   setTrackName]  = useState('');
  const [imageName,   setImageName]  = useState('');

  const flashTimer = useRef<ReturnType<typeof setTimeout>|null>(null);

  // Keep autoRef in sync
  useEffect(() => { autoRef.current = auto; }, [auto]);

  // ── External audio events ────────────────────────────────────────────────────
  useEffect(() => {
    if (!externalAudio) return;
    const onPlay  = () => { pausedRef.current = false; setPaused(false); };
    const onPause = () => { pausedRef.current = true;  setPaused(true);  };
    externalAudio.addEventListener('play',  onPlay);
    externalAudio.addEventListener('pause', onPause);
    return () => {
      externalAudio.removeEventListener('play',  onPlay);
      externalAudio.removeEventListener('pause', onPause);
    };
  }, [externalAudio]);

  // ── Fullscreen listener ──────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // ── Native DOM click — bypasses React synthetic events entirely ──────────────
  // Attaching directly to the DOM node means no React event system,
  // no parent stopPropagation, no stale closure issues.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      // Ignore clicks on buttons (controls)
      if ((e.target as HTMLElement).closest('button')) return;
      const audioEl = externalAudio ?? audioElRef.current;
      const actx    = audioRefs.current.ctx;
      if (pausedRef.current) {
        pausedRef.current = false; setPaused(false);
        audioEl?.play(); actx?.resume(); setFlashIcon('play');
      } else {
        pausedRef.current = true; setPaused(true);
        audioEl?.pause(); setFlashIcon('pause');
      }
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setFlashIcon(null), 800);
    };
    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [externalAudio]);

  // ── DISPLAY CLICK → pause / resume ──────────────────────────────────────────
  // This is the ONLY handler on the container div.
  // pausedRef.current is a plain ref so the render loop always reads the latest value.
  const handleDisplayClick = useCallback(() => {
    const audioEl = externalAudio ?? audioElRef.current;
    const actx    = audioRefs.current.ctx;

    if (pausedRef.current) {
      pausedRef.current = false;  // render loop sees this immediately next frame
      setPaused(false);
      audioEl?.play();
      actx?.resume();
      setFlashIcon('play');
    } else {
      pausedRef.current = true;   // render loop sees this immediately next frame
      setPaused(true);
      audioEl?.pause();
      setFlashIcon('pause');
    }
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashIcon(null), 800);
  }, [externalAudio]);

  // ── Mode change ──────────────────────────────────────────────────────────────
  const changeMode = useCallback((next: Mode, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (next === modeRef.current) return;
    modeIdx.current = MODES.indexOf(next);
    const an = audioRefs.current.analyser;
    if (an) {
      const f = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(f);
      const td = new Uint8Array(an.frequencyBinCount); an.getByteTimeDomainData(td);
      frozenFreq.current = f; frozenTime.current = td;
    }
    transRef.current   = { from: modeRef.current, to: next, progress: 0, active: true };
    transStart.current = performance.now();
    modeRef.current    = next;
    setActiveMode(next);
  }, []);

  // ── Audio init ───────────────────────────────────────────────────────────────
  const initAnalyser = useCallback((src: AudioNode, actx: AudioContext) => {
    if (audioRefs.current.analyser) audioRefs.current.analyser.disconnect();
    const an = actx.createAnalyser();
    an.fftSize = 2048; an.smoothingTimeConstant = 0.82;
    src.connect(an); an.connect(actx.destination);
    audioRefs.current.analyser = an;
    setIsLive(true);
  }, []);

  // ── Load audio file ──────────────────────────────────────────────────────────
  const handleAudio = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    setTrackName(file.name.replace(/\.[^/.]+$/, ''));
    const el = audioElRef.current!;
    el.src = URL.createObjectURL(file); el.load();
    let actx = audioRefs.current.ctx;
    if (!actx) { actx = new AudioContext(); audioRefs.current.ctx = actx; }
    if (actx.state === 'suspended') actx.resume();
    if (!audioRefs.current.source) {
      const src = actx.createMediaElementSource(el);
      audioRefs.current.source = src; initAnalyser(src, actx);
    } else if (audioRefs.current.analyser) setIsLive(true);
    el.play();
    pausedRef.current = false; setPaused(false);
  }, [initAnalyser]);

  // ── Load image file ──────────────────────────────────────────────────────────
  const handleImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) return;
    const img = new Image();
    img.onload = () => { bgImgRef.current = img; };
    img.src = URL.createObjectURL(file);
    setImageName(file.name.replace(/\.[^/.]+$/, ''));
  }, []);

  // ── Mic ──────────────────────────────────────────────────────────────────────
  const toggleMic = useCallback(async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isMic) {
      audioRefs.current.micStream?.getTracks().forEach(t => t.stop());
      audioRefs.current.micStream = null; audioRefs.current.analyser = null;
      setIsMic(false); setIsLive(false); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioRefs.current.micStream = stream;
      let actx = audioRefs.current.ctx;
      if (!actx) { actx = new AudioContext(); audioRefs.current.ctx = actx; }
      if (actx.state === 'suspended') actx.resume();
      initAnalyser(actx.createMediaStreamSource(stream), actx);
      setIsMic(true); setTrackName('MICROPHONE');
    } catch { alert('Microphone access denied.'); }
  }, [isMic, initAnalyser]);

  // ── Demo ─────────────────────────────────────────────────────────────────────
  const playDemo = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    let actx = audioRefs.current.ctx;
    if (!actx) { actx = new AudioContext(); audioRefs.current.ctx = actx; }
    if (actx.state === 'suspended') actx.resume();
    const gain = actx.createGain(); gain.gain.value = 0.001;
    const osc = (f: number, type: OscillatorType, g: number) => {
      const o = actx!.createOscillator(), gn = actx!.createGain();
      o.type = type; o.frequency.value = f; gn.gain.value = g;
      o.connect(gn); gn.connect(gain); o.start();
    };
    osc(60,'sawtooth',0.5); osc(120,'square',0.2);
    osc(440,'sine',0.15);   osc(880,'sine',0.08); osc(2200,'sine',0.04);
    const bps = 128/60, now = actx.currentTime;
    for (let i = 0; i < 64; i++) {
      gain.gain.setValueAtTime(0.4, now + i/bps);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i/bps + 0.35);
    }
    gain.connect(actx.destination); initAnalyser(gain, actx);
    setTrackName('DEMO BEAT — 128 BPM');
    pausedRef.current = false; setPaused(false);
  }, [initAnalyser]);

  const toggleFs = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  // ── Render loop — empty deps, reads everything via refs ──────────────────────
  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number, t = 0;

    const resize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      canvas.width = w; canvas.height = h;
      osA.current.width = w; osA.current.height = h;
      osB.current.width = w; osB.current.height = h;
    };
    window.addEventListener('resize', resize); resize();

    const drawTo = (target: HTMLCanvasElement, mode: Mode, freq: FD, time: FD) => {
      const c2 = target.getContext('2d')!, w2 = target.width, h2 = target.height;
      const b  = avgBand(freq, 0, 8);
      if (mode === 'orbit')    drawOrbit(c2, w2, h2, freq, t, b);
      if (mode === 'spectrum') drawSpectrum(c2, w2, h2, freq, t, b);
      if (mode === 'radial')   drawRadial(c2, w2, h2, freq, t, b);
      if (mode === 'waveform') drawWaveform(c2, w2, h2, time, t, b);
    };

    const render = () => {
      raf = requestAnimationFrame(render);

      // pausedRef is read here every single frame — no closure staleness
      if (pausedRef.current) return;

      t += 0.015;
      const w = canvas.width, h = canvas.height;
      const an = audioRefs.current.analyser;

      let lFreq = new Uint8Array(1024).fill(0);
      let lTime = new Uint8Array(1024).fill(128);
      if (an) {
        lFreq = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(lFreq);
        lTime = new Uint8Array(an.frequencyBinCount); an.getByteTimeDomainData(lTime);
      } else {
        for (let i = 0; i < 1024; i++) {
          lFreq[i] = Math.max(0, Math.sin(t * 1.2 + i * 0.18) * 38 + 22);
          lTime[i] = 128 + Math.sin(t * 2 + i * 0.12) * 18;
        }
      }

      const bass = avgBand(lFreq, 0, 8);

      // Beat detection
      beatAvg.current = beatAvg.current * 0.92 + bass * 0.08;
      if (autoRef.current && beatAvg.current > 10 && bass > beatAvg.current * BEAT_MULT
          && performance.now() - lastBeat.current > BEAT_COOLDOWN_MS && !transRef.current.active) {
        lastBeat.current = performance.now();
        const ni = (modeIdx.current + 1) % MODES.length;
        modeIdx.current = ni;
        frozenFreq.current = new Uint8Array(lFreq); frozenTime.current = new Uint8Array(lTime);
        transRef.current = { from: modeRef.current, to: MODES[ni], progress: 0, active: true };
        transStart.current = performance.now();
        modeRef.current = MODES[ni];
        setActiveMode(MODES[ni]);
      }

      // Advance transition
      const tr = transRef.current;
      if (tr.active) {
        tr.progress = Math.min((performance.now() - transStart.current) / TRANSITION_MS, 1);
        if (tr.progress >= 1) tr.active = false;
      }

      // Background image
      ctx.clearRect(0, 0, w, h);
      const bg = bgImgRef.current;
      if (bg?.complete) {
        const ia = bg.naturalWidth / bg.naturalHeight, ca = w / h;
        let sx = 0, sy = 0, sw = bg.naturalWidth, sh = bg.naturalHeight;
        if (ia > ca) { sw = sh * ca; sx = (bg.naturalWidth - sw) / 2; }
        else         { sh = sw / ca; sy = (bg.naturalHeight - sh) / 2; }
        ctx.save(); ctx.globalAlpha = 0.22;
        ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, w, h); ctx.restore();
      }

      // Composite
      if (!tr.active || tr.from === tr.to) {
        drawTo(osA.current, tr.to, lFreq, lTime);
        ctx.drawImage(osA.current, 0, 0);
      } else {
        const p = ease(tr.progress);
        const mF = lerpArrays(frozenFreq.current, lFreq, p);
        const mT = lerpArrays(frozenTime.current, lTime, p);
        drawTo(osA.current, tr.from, mF, mT);
        drawTo(osB.current, tr.to, lFreq, lTime);
        ctx.globalAlpha = 1 - p; ctx.drawImage(osA.current, 0, 0);
        ctx.globalAlpha = p;     ctx.drawImage(osB.current, 0, 0);
        ctx.globalAlpha = 1;
      }
    };

    render();
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
  }, []); // empty — everything read via refs

  // ─── JSX ─────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden bg-[#050508] cursor-pointer select-none"
    >
      <audio ref={audioElRef} style={{ display:'none' }} />
      <input ref={audioFileRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={handleAudio} />
      <input ref={imageFileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImage} />

      {/* Canvas — pointer-events-none so ALL clicks reach the container div */}
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

      {/* Pause overlay (persistent while paused, hidden during flash) */}
      {paused && !flashIcon && (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center"
          style={{ background:'rgba(5,5,8,0.5)' }}>
          <div style={{ width:56, height:56, border:'1.5px solid rgba(255,255,255,0.2)',
            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ display:'flex', gap:6 }}>
              <div style={{ width:4, height:18, background:'rgba(255,255,255,0.3)', borderRadius:2 }} />
              <div style={{ width:4, height:18, background:'rgba(255,255,255,0.3)', borderRadius:2 }} />
            </div>
          </div>
        </div>
      )}

      {/* Flash icon (fades out after 800ms) */}
      {flashIcon && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center"
          style={{ background:'rgba(5,5,8,0.3)', animation:'vizFade 0.8s ease forwards' }}>
          <div style={{ width:72, height:72, border:'2px solid rgba(255,255,255,0.7)',
            borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {flashIcon === 'pause'
              ? <div style={{ display:'flex', gap:7 }}>
                  <div style={{ width:5, height:24, background:'rgba(255,255,255,0.9)', borderRadius:2 }} />
                  <div style={{ width:5, height:24, background:'rgba(255,255,255,0.9)', borderRadius:2 }} />
                </div>
              : <div style={{ width:0, height:0, marginLeft:6,
                  borderTop:'12px solid transparent', borderBottom:'12px solid transparent',
                  borderLeft:'22px solid rgba(255,255,255,0.9)' }} />
            }
          </div>
        </div>
      )}

      <style>{`@keyframes vizFade { 0%,60%{opacity:1} 100%{opacity:0} }`}</style>

      {/* Border */}
      <div className="absolute inset-0 border border-white/5 pointer-events-none z-10" />

      {/* Track / image name */}
      {(trackName || imageName) && (
        <div className="absolute top-3 left-4 z-20 pointer-events-none flex flex-col gap-1">
          {trackName && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background:isLive?'#0af5ff':'#555', boxShadow:isLive?'0 0 6px #0af5ff':'none' }} />
              <span className="text-white/50 text-[10px] tracking-[0.2em] uppercase font-mono truncate max-w-[180px]">{trackName}</span>
            </div>
          )}
          {imageName && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background:'#f5a623', boxShadow:'0 0 6px #f5a623' }} />
              <span className="text-[#f5a623]/60 text-[10px] tracking-[0.2em] uppercase font-mono truncate max-w-[150px]">{imageName}</span>
              <button onClick={e => { e.stopPropagation(); bgImgRef.current = null; setImageName(''); }}
                className="text-[9px] text-white/30 hover:text-white/70 pointer-events-auto transition-colors">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Idle hint */}
      {!isLive && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <p className="text-white/20 text-[10px] tracking-[0.3em] uppercase font-mono">
            load a track · mic · demo · click to pause
          </p>
        </div>
      )}

      {/* Mode switcher + AUTO — stopPropagation on wrapper prevents pause trigger */}
      <div className="absolute top-3 right-4 z-20 flex gap-1 items-center"
        onClick={e => e.stopPropagation()}>
        {MODES.map((m, i) => (
          <button key={m} onClick={e => changeMode(m, e)}
            className={`text-[9px] tracking-[0.18em] font-mono uppercase px-2.5 py-1 border transition-all duration-150
              ${activeMode===m ? 'border-[#0af5ff] text-[#0af5ff] bg-[rgba(10,245,255,0.08)]'
                               : 'border-white/10 text-white/25 hover:text-white/50'}`}>
            {LABELS[i]}
          </button>
        ))}
        <span className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={e => { e.stopPropagation(); setAuto(v => !v); }}
          className={`text-[9px] tracking-[0.18em] font-mono uppercase px-2.5 py-1 border transition-all duration-150
            ${auto ? 'border-[#ff2d55] text-[#ff2d55] bg-[rgba(255,45,85,0.1)]'
                   : 'border-white/10 text-white/25 hover:text-white/50'}`}>
          {auto ? '⬤ AUTO' : '○ AUTO'}
        </button>
      </div>

      {/* Bottom controls — stopPropagation on wrapper prevents pause trigger */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2"
        onClick={e => e.stopPropagation()}>
        <button onClick={e => { e.stopPropagation(); audioFileRef.current?.click(); }}
          className="text-[10px] tracking-[0.15em] font-mono uppercase px-4 py-2 border border-[#f5a623] text-[#f5a623] bg-[rgba(245,166,35,0.07)] hover:bg-[rgba(245,166,35,0.16)] transition-all">
          ♪ AUDIO
        </button>
        <button onClick={e => { e.stopPropagation(); imageFileRef.current?.click(); }}
          className="text-[10px] tracking-[0.15em] font-mono uppercase px-4 py-2 border border-[#7bff6a] text-[#7bff6a] bg-[rgba(123,255,106,0.06)] hover:bg-[rgba(123,255,106,0.14)] transition-all">
          ⬛ IMAGE
        </button>
        <button onClick={e => toggleMic(e)}
          className={`text-[10px] tracking-[0.15em] font-mono uppercase px-4 py-2 border transition-all
            ${isMic ? 'border-[#ff2d55] text-[#ff2d55] bg-[rgba(255,45,85,0.12)]'
                    : 'border-white/15 text-white/35 hover:text-white/60'}`}>
          ⬤ MIC
        </button>
        <button onClick={e => playDemo(e)}
          className="text-[10px] tracking-[0.15em] font-mono uppercase px-4 py-2 border border-white/15 text-white/35 hover:text-white/60 transition-all">
          ◈ DEMO
        </button>
        <button onClick={toggleFs}
          className="text-[10px] tracking-[0.15em] font-mono uppercase px-4 py-2 border border-white/15 text-white/35 hover:text-white/60 transition-all">
          {fullscreen ? '⊡ EXIT' : '⛶ FULL'}
        </button>
      </div>
    </div>
  );
};

export default VisualizerCanvas;
