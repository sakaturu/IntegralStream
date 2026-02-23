import React, { useState, useEffect } from 'react';

interface LoginGateProps {
  onLogin: (pass: string, remember: boolean) => boolean;
  onIdentify: (name: string, remember: boolean) => boolean;
  onRestore: (key: string) => boolean;
  onForget?: () => void;
  onClose?: () => void;
  defaultName?: string;
  isIdentityLocked?: boolean;
  profilePic?: string;
  onProfilePicChange?: (pic: string) => void;
}

const LoginGate: React.FC<LoginGateProps> = ({
  onLogin,
  onIdentify,
  onRestore,
  onClose,
  defaultName = '',
  isIdentityLocked = false,
  profilePic = '',
  onProfilePicChange,
}) => {
  const [activeTab, setActiveTab] = useState<'identity' | 'admin'>('identity');
  const [identitySubTab, setIdentitySubTab] = useState<'identify' | 'restore'>('identify');

  const [personaName, setPersonaName] = useState(defaultName);
  const [nodeKey, setNodeKey] = useState('');
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(true);

  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  useEffect(() => {
    if (defaultName) setPersonaName(defaultName);
  }, [defaultName]);

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    setTimeout(() => {
      if (identitySubTab === 'identify') {
        const success = onIdentify(personaName, remember);
        if (!success) { setError('Invalid persona name'); setIsVerifying(false); }
      } else {
        const success = onRestore(nodeKey);
        if (success) {
          setRestoreSuccess(true);
          setTimeout(() => onClose?.(), 1200);
        } else {
          setError('Node key not recognized');
          setIsVerifying(false);
        }
      }
    }, 900);
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    setTimeout(() => {
      const success = onLogin(pass, remember);
      if (!success) {
        setError('Access denied — invalid token');
        setPass('');
      }
      setIsVerifying(false);
    }, 900);
  };

  const switchTab = (tab: 'identity' | 'admin') => {
    setActiveTab(tab);
    setError('');
    setPass('');
  };

  return (
    <div className="w-full max-w-lg animate-fade-in relative z-10">
      {/* Header */}
      <div className="text-center mb-8 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-2 -right-2 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all border border-white/10"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        )}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-px h-6 bg-gradient-to-b from-transparent via-blue-500 to-transparent"></div>
          <h1 className="text-2xl font-black text-white uppercase tracking-[0.3em] leading-none">
            ARCHIVE ACCESS
          </h1>
          <div className="w-px h-6 bg-gradient-to-b from-transparent via-blue-500 to-transparent"></div>
        </div>
        <p className="text-[8px] font-bold text-blue-500 uppercase tracking-[0.5em]">
          Neural Handshake Protocol
        </p>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => switchTab('identity')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
            activeTab === 'identity'
              ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)]'
              : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'
          }`}
        >
          <i className="fa-solid fa-user-astronaut"></i>
          User Identity
        </button>
        <button
          onClick={() => switchTab('admin')}
          className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
            activeTab === 'admin'
              ? 'bg-white border-white text-slate-950 shadow-lg'
              : 'bg-white/5 border-white/10 text-slate-500 hover:text-white hover:border-white/20'
          }`}
        >
          <i className="fa-solid fa-terminal"></i>
          Admin
        </button>
      </div>

      {/* Panel */}
      <div className="glass rounded-[2rem] border border-white/10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.6)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent"></div>

        {/* USER IDENTITY PANEL */}
        {activeTab === 'identity' && (
          <div className="p-8 space-y-6">
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
              <button
                onClick={() => { setIdentitySubTab('identify'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  identitySubTab === 'identify' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                {isIdentityLocked ? 'Switch Persona' : 'New Persona'}
              </button>
              <button
                onClick={() => { setIdentitySubTab('restore'); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  identitySubTab === 'restore' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'
                }`}
              >
                Restore Node
              </button>
            </div>

            <form onSubmit={handleIdentitySubmit} className="space-y-5">
              {identitySubTab === 'identify' ? (
                <div className="space-y-3">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-fingerprint text-blue-500"></i>
                    Persona Identifier
                  </label>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-blue-500/30 flex-shrink-0 bg-slate-900">
                      {profilePic ? (
                        <img src={profilePic} className="w-full h-full object-cover" alt="profile" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="fa-solid fa-user text-slate-600 text-xl"></i>
                        </div>
                      )}
                      <div className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity" onClick={(e) => { e.preventDefault(); e.stopPropagation(); const inp = document.getElementById('pic-upload') as HTMLInputElement; inp?.click(); }}>
                        <i className="fa-solid fa-camera text-white text-sm"></i>
                      </div>
                      <input id="pic-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => onProfilePicChange?.(ev.target?.result as string);
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>
                    <p className="text-[8px] text-slate-500 uppercase tracking-widest leading-relaxed">Click to upload your profile photo</p>
                  </div>
                  <input
                    autoFocus
                    required
                    type="text"
                    placeholder="ENTER YOUR NAME..."
                    value={personaName}
                    onChange={(e) => { setPersonaName(e.target.value.toUpperCase()); setError(''); }}
                    disabled={isVerifying}
                    className={`w-full bg-slate-950/80 border ${error ? 'border-red-500/60' : 'border-white/10'} rounded-xl px-6 py-4 text-center text-base tracking-[0.2em] text-white focus:outline-none focus:border-blue-500/50 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px] placeholder:font-black placeholder:text-slate-700`}
                  />
                  <p className="text-[8px] text-slate-600 uppercase tracking-widest text-center px-4 leading-relaxed">
                    Your name is your personal archive key — all favorites & settings are saved to this identity.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <i className="fa-solid fa-dna text-blue-500"></i>
                    Neural Node Key
                  </label>
                  <input
                    autoFocus
                    required
                    type="text"
                    placeholder="INT-XXXX-XX..."
                    value={nodeKey}
                    onChange={(e) => { setNodeKey(e.target.value.toUpperCase()); setError(''); }}
                    disabled={isVerifying}
                    className={`w-full bg-slate-950/80 border ${error ? 'border-red-500/60' : 'border-white/10'} rounded-xl px-6 py-4 text-center text-base tracking-[0.1em] text-white focus:outline-none focus:border-blue-500 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px]`}
                  />
                  <p className="text-[8px] text-slate-600 uppercase tracking-widest text-center px-4 leading-relaxed">
                    Restore a previous session using your node key (format: INT-XXXX-XX)
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <i className="fa-solid fa-triangle-exclamation text-red-500 text-xs"></i>
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{error}</span>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer select-none px-1">
                <div className="relative w-10 h-6 flex-shrink-0">
                  <input type="checkbox" className="sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <div className={`absolute inset-0 rounded-full transition-all ${remember ? 'bg-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.4)]' : 'bg-slate-800'}`}></div>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all transform ${remember ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${remember ? 'text-blue-400' : 'text-slate-600'}`}>
                  Remember me across sessions
                </span>
              </label>

              <button
                type="submit"
                disabled={isVerifying || (identitySubTab === 'identify' ? !personaName : !nodeKey)}
                className={`w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.4em] transition-all shadow-xl disabled:opacity-30 ${
                  restoreSuccess
                    ? 'bg-green-600 text-white'
                    : isVerifying
                    ? 'bg-slate-800 text-slate-500 cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-500'
                }`}
              >
                {isVerifying
                  ? 'Syncing matrix...'
                  : restoreSuccess
                  ? '✓ Node Restored'
                  : identitySubTab === 'identify'
                  ? isIdentityLocked ? 'Update Persona' : 'Initialize Node'
                  : 'Restore Node'}
              </button>
            </form>
          </div>
        )}

        {/* ADMIN PANEL */}
        {activeTab === 'admin' && (
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-shield-halved text-amber-500"></i>
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Admin Terminal</p>
                <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Full archive control — restricted access</p>
              </div>
            </div>

            <form onSubmit={handleAdminSubmit} className="space-y-5">
              <div className="space-y-3">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <i className="fa-solid fa-key text-amber-500"></i>
                  Security Token
                </label>
                <input
                  autoFocus
                  required
                  type="password"
                  placeholder="ENTER ADMIN TOKEN..."
                  value={pass}
                  onChange={(e) => { setPass(e.target.value); setError(''); }}
                  disabled={isVerifying}
                  className={`w-full bg-slate-950/80 border ${error ? 'border-red-500/60' : 'border-amber-500/20'} rounded-xl px-6 py-4 text-center text-base tracking-[0.4em] text-white focus:outline-none focus:border-amber-500/50 transition-all font-mono placeholder:tracking-normal placeholder:text-[9px] placeholder:font-black placeholder:text-slate-700`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <i className="fa-solid fa-triangle-exclamation text-red-500 text-xs"></i>
                  <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">{error}</span>
                </div>
              )}

              <label className="flex items-center gap-3 cursor-pointer select-none px-1">
                <div className="relative w-10 h-6 flex-shrink-0">
                  <input type="checkbox" className="sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <div className={`absolute inset-0 rounded-full transition-all ${remember ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.4)]' : 'bg-slate-800'}`}></div>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all transform ${remember ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${remember ? 'text-amber-400' : 'text-slate-600'}`}>
                  Keep admin session active
                </span>
              </label>

              <button
                type="submit"
                disabled={isVerifying || !pass}
                className={`w-full py-4 rounded-xl text-[9px] font-black uppercase tracking-[0.4em] transition-all shadow-xl disabled:opacity-30 ${
                  isVerifying ? 'bg-slate-800 text-slate-500 cursor-wait' : 'bg-white text-slate-950 hover:bg-amber-50'
                }`}
              >
                {isVerifying ? 'Authorizing...' : 'Authorize Admin Access'}
              </button>
            </form>

            <div className="pt-4 border-t border-white/5">
              <p className="text-[8px] text-slate-700 uppercase tracking-widest text-center leading-relaxed">
                Admin grants full control: add/remove videos, manage all users, approve reviews & sync source
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoginGate;
