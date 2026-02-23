import React, { useState, useMemo } from 'react';
import { generateVideo } from '../services/gemini';
import { VideoItem, VideoCategory } from '../types';

interface GenerationModalProps {
  onStart: (prompt: string, category: VideoCategory) => string;
  onUpdate: (id: string, progress: string) => void;
  onComplete: (id: string, url: string) => void;
  onFail: (id: string, error: string) => void;
  onClose: () => void;
  categories: VideoCategory[];
}

const GenerationModal: React.FC<GenerationModalProps> = ({ onStart, onUpdate, onComplete, onFail, onClose, categories }) => {
  const [prompt, setPrompt] = useState('');
  const [category, setCategory] = useState<VideoCategory>(categories[0] || 'Other');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState('');

  // PROGRESS CHECKPOINTS - Enhanced matching logic for persistent display
  const checkpoints = useMemo(() => [
    { id: 'auth', label: 'Signal Authorization', complete: !!status },
    { id: 'synth', label: 'Neural Synthesis', complete: /pixels|motion|lighting|lighting|Refining|Synthesizing|Crafting/i.test(status) },
    { id: 'pixel', label: 'Pixels Refinement', complete: /Refining|Details|Finalizing|Applying/i.test(status) },
    { id: 'deploy', label: 'Final Deployment', complete: /Finalizing|Export/i.test(status) }
  ], [status]);

  const activeCheckpointIndex = useMemo(() => {
    const lastComplete = [...checkpoints].reverse().findIndex(cp => cp.complete);
    const index = lastComplete === -1 ? 0 : checkpoints.length - 1 - lastComplete;
    // Cap at array length - 1, and ensure it doesn't drop back unless status is reset
    return Math.min(index, checkpoints.length - 1);
  }, [checkpoints]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt || isGenerating) return;

    setIsGenerating(true);
    setStatus('Allocating Vault Slot...');
    
    // Allocate slot first for immediate persistence
    const allocatedId = onStart(prompt, category);

    try {
      const videoUrl = await generateVideo({
        prompt,
        category,
        aspectRatio: '16:9',
        resolution: '720p'
      }, (msg) => {
        setStatus(msg);
        onUpdate(allocatedId, msg);
      });

      onComplete(allocatedId, videoUrl);
    } catch (error) {
      onFail(allocatedId, "Generation Interrupted");
      alert("Generation failed. Ensure you have selected a valid paid API key and have appropriate quota.");
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl animate-fade-in">
      <div className="w-full max-w-2xl glass p-1 rounded-[3.5rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col md:flex-row h-auto md:h-[500px]">
        {isGenerating ? (
          <div className="flex-1 flex flex-col md:flex-row animate-fade-in">
            {/* ROADMAP SIDEBAR - Always present during synthesis */}
            <div className="w-full md:w-64 bg-slate-950/50 p-10 border-r border-white/5 flex flex-col">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.4em] mb-10">Synthesis Roadmap</h4>
              <div className="space-y-8 relative">
                {/* Vertical Line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-px bg-white/5"></div>
                
                {checkpoints.map((cp, idx) => (
                  <div key={cp.id} className="flex items-center gap-4 relative z-10">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      cp.complete 
                      ? 'bg-blue-600 border-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.4)]' 
                      : idx === activeCheckpointIndex 
                      ? 'bg-slate-900 border-blue-500/50 animate-pulse' 
                      : 'bg-slate-900 border-white/10'
                    }`}>
                      {cp.complete ? (
                        <i className="fa-solid fa-check text-[10px] text-white"></i>
                      ) : (
                        <div className={`w-1 h-1 rounded-full ${idx === activeCheckpointIndex ? 'bg-blue-400' : 'bg-slate-700'}`}></div>
                      )}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${
                      cp.complete ? 'text-white' : idx === activeCheckpointIndex ? 'text-blue-400' : 'text-slate-700'
                    }`}>
                      {cp.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* MAIN STATUS AREA */}
            <div className="flex-1 p-12 flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 mb-10 relative">
                <div className="absolute inset-0 border-4 border-blue-500/10 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <i className="fa-solid fa-atom text-blue-500 text-3xl animate-pulse"></i>
                </div>
              </div>
              <h3 className="text-xl font-black text-white uppercase tracking-[0.3em] mb-4">Synthesizing Signal</h3>
              <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest animate-pulse h-4">{status}</p>
              <div className="mt-12 w-full max-w-xs space-y-2">
                 <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${((activeCheckpointIndex + 1) / checkpoints.length) * 100}%` }}></div>
                 </div>
                 <p className="text-[8px] text-slate-500 uppercase tracking-widest text-right italic">Checkpoint {(activeCheckpointIndex + 1).toString().padStart(2, '0')} initialized</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 p-10 flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">Signal Injection Terminal</h2>
              <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-500 hover:text-white transition-all">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleGenerate} className="flex-1 flex flex-col">
              <div className="flex-1 space-y-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                    Visual Input Parameter
                  </label>
                  <textarea 
                    autoFocus
                    required
                    placeholder="Provide vision details... (e.g., A cinematic landscape of frozen waves in slow motion)"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="w-full h-32 bg-slate-950/80 border border-white/10 rounded-3xl p-6 text-[11px] text-white focus:outline-none focus:border-blue-500/50 resize-none transition-all placeholder:text-slate-800"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                    Categorical Matrix
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {categories.map(cat => (
                      <button 
                        key={cat} 
                        type="button" 
                        onClick={() => setCategory(cat)}
                        className={`py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all ${
                          category === cat 
                          ? 'bg-blue-600 border-blue-400 text-white shadow-[0_0_15px_rgba(37,99,235,0.3)]' 
                          : 'bg-white/5 border-white/5 text-slate-500 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-10 flex flex-col items-center gap-4">
                <button 
                  type="submit" 
                  className="w-full py-6 bg-white text-slate-950 rounded-3xl text-[11px] font-black uppercase tracking-[0.5em] hover:bg-blue-50 hover:scale-[1.01] active:scale-95 transition-all shadow-xl"
                >
                  Initiate Synthesis
                </button>
                <div className="flex items-center gap-6">
                  <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-credit-card"></i> PAID PROJECT REQUIRED
                  </span>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-[8px] font-black text-blue-500 uppercase tracking-widest hover:text-white transition-colors border-b border-blue-500/20 pb-0.5">
                    BILLING DOCS <i className="fa-solid fa-external-link text-[6px] ml-1"></i>
                  </a>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationModal;