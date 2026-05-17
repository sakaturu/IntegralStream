import React, { useState, useEffect, useRef } from 'react';

// ─── Constants & Types ──────────────────────────────────────────────────────

interface MusicTrack {
  id: string;
  artist: string;
  title: string;
  url: string;
  category: string;
}

const STARTER_SONGS: MusicTrack[] = [
  { id: '1', artist: 'Lofi Girl', title: 'Study Beats', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk', category: 'Lo-Fi' },
  { id: '2', artist: 'Synthwave', title: 'Neon Nights', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY', category: 'Electronic' }
];

// ─── Sub-Components ─────────────────────────────────────────────────────────

const VisualizerCanvas = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let t = 0;

    const render = () => {
      t += 0.02;
      // Set internal resolution to match display size
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;

      ctx.fillStyle = 'rgba(5, 0, 10, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.strokeStyle = '#22d3ee'; // Cyan-400
      ctx.lineWidth = 2;
      ctx.beginPath();
      for(let i = 0; i < canvas.width; i += 5) {
        const y = canvas.height / 2 + Math.sin(i * 0.01 + t) * 50;
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

// ─── Main Application ───────────────────────────────────────────────────────

/**
 * @export default 
 * This ensures index.tsx finds the 'default' export it is looking for.
 */
export default function MusicApp() {
  const [activeTrack, setActiveTrack] = useState<MusicTrack | null>(null);
  const [isVizOpen, setIsVizOpen] = useState(true);
  const [library, setLibrary] = useState<MusicTrack[]>(STARTER_SONGS);

  // Load from local storage if available
  useEffect(() => {
    const saved = localStorage.getItem('integral_music_library');
    if (saved) {
      try {
        setLibrary(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse library", e);
      }
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-[#05000a] text-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-tr from-rose-500 to-amber-500 rounded-lg rotate-45 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full -rotate-45" />
          </div>
          <span className="font-black italic tracking-tighter text-xl uppercase">
            INTEGRAL<span className="text-cyan-400">MUSIC</span>
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Stage */}
        <div className="flex-1 relative bg-black flex items-center justify-center group">
          {activeTrack ? (
            <div className="w-full h-full flex flex-col items-center justify-center">
              {/* This is a placeholder for the VideoPlayer component */}
              <div className="text-center z-10 p-8 bg-black/60 rounded-2xl border border-white/10 backdrop-blur-md">
                <h2 className="text-2xl font-black text-cyan-400 mb-2">{activeTrack.title}</h2>
                <p className="text-slate-400 uppercase tracking-widest text-xs font-bold">{activeTrack.artist}</p>
                <p className="mt-4 text-[10px] text-slate-600 truncate max-w-xs">{activeTrack.url}</p>
              </div>
              
              {isVizOpen && <VisualizerCanvas active={true} />}
              
              <button 
                onClick={() => setIsVizOpen(!isVizOpen)}
                className="absolute bottom-10 px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold tracking-widest hover:bg-white/10 transition-all z-20"
              >
                {isVizOpen ? 'HIDE VISUALS' : 'SHOW VISUALS'}
              </button>
            </div>
          ) : (
            <div className="text-center opacity-30">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Select a track from the library</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-80 border-l border-white/10 bg-black/40 flex flex-col">
          <div className="p-6 border-b border-white/5">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Music Library</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {library.map((track) => (
              <button 
                key={track.id}
                onClick={() => setActiveTrack(track)}
                className={`w-full text-left p-4 rounded-xl transition-all border ${
                  activeTrack?.id === track.id 
                    ? 'bg-cyan-500/10 border-cyan-500/50' 
                    : 'bg-white/5 border-transparent hover:border-white/10 hover:bg-white/[0.07]'
                }`}
              >
                <div className={`text-sm font-bold ${activeTrack?.id === track.id ? 'text-cyan-400' : 'text-slate-200'}`}>
                  {track.title}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-medium">{track.artist}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}