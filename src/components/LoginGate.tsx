import React, { useState, useEffect } from 'react';

const PROFILE_PIC_KEY = 'integral_profile_pics_v1';
const ADMIN_USER = 'ADMIN';

const getPicMap  = (): Record<string,string> => { try { return JSON.parse(localStorage.getItem(PROFILE_PIC_KEY)||'{}'); } catch { return {}; } };
const setUserPic = (username: string, pic: string) => { const m = getPicMap(); m[username] = pic; try { localStorage.setItem(PROFILE_PIC_KEY, JSON.stringify(m)); } catch {} };
const getUserPic = (username: string): string => getPicMap()[username] || '';

interface LoginGateProps {
  onLogin: (pass: string, remember: boolean) => boolean;
  onIdentify: (name: string, remember: boolean, pic?: string) => boolean;
  onRestore: (key: string) => boolean;
  onForget?: () => void;
  onClose?: () => void;
  defaultName?: string;
  isIdentityLocked?: boolean;
  defaultTab?: 'Identify' | 'Terminal' | 'Restore';
}

const LoginGate: React.FC<LoginGateProps> = ({
  onLogin,
  onIdentify,
  onRestore,
  onForget,
  onClose,
  defaultName = '',
  isIdentityLocked = false,
  defaultTab = 'Identify'
}) => {
  const [activeTab, setActiveTab] = useState<'Identify' | 'Terminal' | 'Restore'>(defaultTab);
  const [pass, setPass]           = useState('');
  const [personaName, setPersonaName] = useState(defaultName);
  const [nodeKey, setNodeKey]     = useState('');
  const [remember, setRemember]   = useState(true);
  const [error, setError]         = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  // Photo state
  const [photoPrev, setPhotoPrev] = useState<string>('');

  useEffect(() => {
    if (defaultName) setPersonaName(defaultName);
  }, [defaultName]);

  // When tab changes, load the correct pic for that tab — never bleed between tabs
  useEffect(() => {
    if (activeTab === 'Terminal') {
      setPhotoPrev(getUserPic(ADMIN_USER));
    } else if (activeTab === 'Identify') {
      const key = (defaultName || '').trim().toUpperCase().replace(/\s+/g,'_');
      setPhotoPrev(key ? getUserPic(key) : '');
    } else {
      setPhotoPrev('');
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 120;
        const ratio = Math.min(MAX / img.width, MAX / img.height);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setPhotoPrev(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);
    setError(false);

    setTimeout(() => {
      let success = false;
      if (activeTab === 'Identify') {
        success = onIdentify(personaName, remember, photoPrev || undefined);
        if (success && photoPrev) {
          const key = personaName.trim().toUpperCase().replace(/\s+/g,'_');
          setUserPic(key, photoPrev);
          // Dispatch twice to ensure both MusicApp and main App catch it
          window.dispatchEvent(new Event('picUpdated'));
          setTimeout(() => window.dispatchEvent(new Event('picUpdated')), 100);
        }
      } else if (activeTab === 'Terminal') {
        success = onLogin(pass, remember);
        if (success && photoPrev) {
          setUserPic(ADMIN_USER, photoPrev);
          window.dispatchEvent(new Event('picUpdated'));
        }
      } else {
        success = onRestore(nodeKey);
      }

      if (!success) {
        setError(true);
        setIsVerifying(false);
        setPass('');
      } else if (activeTab === 'Restore') {
        setRestoreSuccess(true);
        setTimeout(() => onClose?.(), 1000);
      }
    }, 1000);
  };

  const showPhoto = activeTab === 'Identify' || activeTab === 'Terminal';

  return (
    <div className="w-full max-w-md animate-fade-in relative z-10">
      <div className="text-center mb-6 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10 z-20"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
        <h1 className="text-xl font-black text-white uppercase tracking-[0.3em] mb-1 leading-none">ARCHIVE ACCESS</h1>
        <p className="text-[8px] font-bold text-blue-500 uppercase tracking-[0.5em] animate-pulse">Neural Handshake Required</p>
      </div>

      <div className="glass p-8 rounded-[2rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] space-y-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30"></div>

        {/* Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 mb-2">
          <button
            onClick={() => { setActiveTab('Identify'); setError(false); }}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Identify' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            {isIdentityLocked ? 'Switch' : 'Identify'}
          </button>
          <button
            onClick={() => { setActiveTab('Terminal'); setError(false); }}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Terminal' ? 'bg-white text-slate-950 shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Admin
          </button>
          <button
            onClick={() => { setActiveTab('Restore'); setError(false); }}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'Restore' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
          >
            Restore
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Photo upload — shown for Identify and Admin tabs */}
          {showPhoto && (
            <div className="flex items-center gap-4">
              <label className="cursor-pointer group/photo relative flex-shrink-0" title="Click to upload photo">
                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500/40 bg-slate-900 flex items-center justify-center group-hover/photo:border-blue-400 transition-all">
                  {photoPrev
                    ? <img src={photoPrev} alt="avatar" className="w-full h-full object-cover"/>
                    : <i className={`fa-solid ${activeTab === 'Terminal' ? 'fa-lock' : 'fa-user'} text-xl text-slate-600`}/>
                  }
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity">
                    <i className="fa-solid fa-camera text-white text-sm"/>
                  </div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange}/>
              </label>
              <div className="flex-1">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  {activeTab === 'Terminal' ? 'Admin Photo' : 'Profile Photo'}
                </p>
                <p className="text-[8px] text-slate-700 uppercase tracking-wider">Click avatar to upload</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <i className={`fa-solid ${activeTab === 'Identify' ? 'fa-user' : activeTab === 'Terminal' ? 'fa-key' : 'fa-dna'}`}></i>
                {activeTab === 'Identify' ? 'Persona Identifier' : activeTab === 'Terminal' ? 'Security Token' : 'Neural Node Key'}
              </label>
              {error && <span className="text-[8px] font-black text-red-500 uppercase tracking-widest animate-bounce">Access Denied</span>}
            </div>

            <div className="relative">
              {activeTab === 'Identify' ? (
                <input
                  autoFocus required type="text"
                  placeholder="USERNAME..."
                  value={personaName}
                  onChange={(e) => setPersonaName(e.target.value.toUpperCase())}
                  disabled={isVerifying}
                  className={`w-full bg-slate-950/80 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-6 py-4 text-center text-base tracking-[0.2em] text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px] placeholder:font-black`}
                />
              ) : activeTab === 'Terminal' ? (
                <input
                  autoFocus required type="password"
                  placeholder="TOKEN ID..."
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  disabled={isVerifying}
                  className={`w-full bg-slate-950/80 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-6 py-4 text-center text-base tracking-[0.4em] text-white focus:outline-none focus:border-blue-500 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px] placeholder:font-black`}
                />
              ) : (
                <input
                  autoFocus required type="text"
                  placeholder="INT-XXXX-XX..."
                  value={nodeKey}
                  onChange={(e) => setNodeKey(e.target.value.toUpperCase())}
                  disabled={isVerifying}
                  className={`w-full bg-slate-950/80 border ${error ? 'border-red-500' : 'border-white/10'} rounded-xl px-6 py-4 text-center text-base tracking-[0.1em] text-white focus:outline-none focus:border-blue-500 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px]`}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <label className="flex items-center cursor-pointer group/toggle select-none">
              <div className="relative w-10 h-6">
                <input type="checkbox" className="sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)}/>
                <div className={`absolute inset-0 rounded-full transition-all duration-300 ${remember ? 'bg-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.4)]' : 'bg-slate-900'}`}></div>
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 transform ${remember ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest ml-3 ${remember ? 'text-blue-400' : 'text-slate-500'}`}>
                Persist Persona
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={isVerifying || (activeTab === 'Terminal' ? !pass : activeTab === 'Identify' ? !personaName : !nodeKey)}
            className={`w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.4em] transition-all relative overflow-hidden shadow-xl ${
              isVerifying
              ? 'bg-slate-800 text-slate-500 cursor-wait'
              : restoreSuccess
              ? 'bg-green-600 text-white'
              : activeTab === 'Identify'
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-white text-slate-950 hover:bg-blue-50'
            }`}
          >
            {isVerifying ? 'SYNCING MATRIX...' : restoreSuccess ? 'NODE RESTORED' : activeTab === 'Identify' ? (isIdentityLocked ? 'UPDATE PERSONA' : 'INITIALIZE NODE') : 'AUTHORIZE ACCESS'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginGate;
