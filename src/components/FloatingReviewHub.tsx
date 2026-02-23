import React, { useState, useMemo, useEffect } from 'react';
import { VideoItem } from '../types';

interface FloatingReviewHubProps {
  video: VideoItem;
  isOpen: boolean;
  onClose: () => void;
  onSubmitReview: (rating: number, text: string) => void;
  initialTab?: 'Read' | 'Write';
}

const FloatingReviewHub: React.FC<FloatingReviewHubProps> = ({ video, isOpen, onClose, onSubmitReview, initialTab = 'Read' }) => {
  const [activeTab, setActiveTab] = useState<'Read' | 'Write'>(initialTab);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const approvedReviews = useMemo(() => {
    return (video.reviews || [])
      .filter(r => r.isApproved)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [video]);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      setRating(0);
      setText('');
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (showSuccess) {
      const timer = setTimeout(() => onClose(), 3000);
      return () => clearTimeout(timer);
    }
  }, [showSuccess, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !text.trim()) return;
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitReview(rating, text);
      setIsSubmitting(false);
      setShowSuccess(true);
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="w-full animate-fade-in mt-4">
      <div className="bg-slate-900/90 p-8 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
        {showSuccess ? (
          <div className="py-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center mb-6 border border-purple-500/20 shadow-lg">
              <i className="fa-solid fa-check text-2xl"></i>
            </div>
            <h3 className="text-white text-[14px] font-black uppercase tracking-widest mb-2">Review Submitted</h3>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Awaiting verification...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex gap-6">
                <button 
                  onClick={() => setActiveTab('Read')} 
                  className={`text-[9px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'Read' ? 'text-purple-500 border-purple-500' : 'text-purple-500/40 border-transparent hover:text-purple-500/70'
                  }`}
                >
                  Read ({approvedReviews.length})
                </button>
                <button 
                  onClick={() => setActiveTab('Write')} 
                  className={`text-[9px] font-black uppercase tracking-widest pb-2 border-b-2 transition-all cursor-pointer ${
                    activeTab === 'Write' ? 'text-purple-500 border-purple-500' : 'text-purple-500/40 border-transparent hover:text-purple-500/70'
                  }`}
                >
                  Write
                </button>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 text-slate-500 hover:text-white flex items-center justify-center transition-all border border-white/10 cursor-pointer">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {activeTab === 'Write' ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex justify-center gap-4 py-4 bg-black/40 rounded-2xl border border-white/5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} className="transition-all hover:scale-125 focus:outline-none cursor-pointer">
                      <i className={`fa-solid fa-star text-xl ${star <= rating ? 'text-purple-500 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'text-slate-800'}`}></i>
                    </button>
                  ))}
                </div>
                <textarea 
                  autoFocus 
                  value={text} 
                  onChange={(e) => setText(e.target.value)} 
                  placeholder="Share your experience..." 
                  className="w-full h-32 bg-black/40 border border-white/10 rounded-2xl p-6 text-[12px] text-white placeholder:text-slate-800 focus:outline-none focus:border-purple-500/30 resize-none transition-all" 
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting || rating === 0 || !text.trim()} 
                  className={`w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all ${
                    isSubmitting ? 'bg-slate-800 text-slate-600 cursor-wait' : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer'
                  }`}
                >
                  {isSubmitting ? 'Syncing...' : 'Publish'}
                </button>
              </form>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                {approvedReviews.length === 0 ? (
                  <div className="py-16 text-center opacity-10 flex flex-col items-center">
                    <i className="fa-solid fa-comment-slash text-3xl mb-4 text-white"></i>
                    <p className="text-[9px] font-black uppercase tracking-widest">No reviews detected</p>
                  </div>
                ) : (
                  approvedReviews.map((review) => (
                    <div key={review.id} className="p-5 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-3 shadow-sm hover:border-white/10 transition-all">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{review.user}</span>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((s) => <i key={s} className={`fa-solid fa-star text-[10px] ${s <= review.rating ? 'text-purple-500' : 'text-slate-800'}`}></i>)}
                        </div>
                      </div>
                      <p className="text-[12px] text-slate-400 italic leading-relaxed pl-4 border-l-2 border-white/5">"{review.text}"</p>
                      <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest text-right">{new Date(review.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FloatingReviewHub;