import { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Zap, Power, Palette, KeyRound, BrainCircuit } from 'lucide-react';
import Switch from '../components/Switch';
import { CH, EV } from '../ipc';

export default function SettingsView() {
  const [config, setConfig] = useState<any>({ launchOnStartup: false, startMinimized: false, autoScanGit: false, autoHideCursorOnStart: false, theme: 'midnight' });
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [aiStatus, setAiStatus] = useState<{ configured: boolean; encryptionAvailable: boolean; model: string }>({ configured: false, encryptionAvailable: true, model: 'claude-haiku-4-5' });
  const [aiKey, setAiKey] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');

  const loadAiStatus = async () => {
    if (window.api) {
      const s: any = await window.api.invoke(CH.aiGetStatus);
      if (s) setAiStatus(s);
    }
  };

  useEffect(() => {
    if (window.api) {
      window.api.invoke(CH.appGetConfig).then((c: any) => {
        setConfig(c || {});
        if(c?.theme) {
          document.documentElement.setAttribute('data-theme', c.theme);
        }
      });
      loadAiStatus();
      window.api.on(EV.appUpdateAvailable, (version: string) => {
        setUpdateStatus(`Downloading update ${version}...`);
      });
      window.api.on(EV.appUpdateDownloaded, () => {
        setUpdateStatus('Update ready to install');
      });
    }
  }, []);

  const saveAiKey = async () => {
    if (!window.api || !aiKey.trim()) return;
    setAiBusy(true);
    setAiMsg('');
    try {
      const res: any = await window.api.invoke(CH.aiSetKey, aiKey);
      if (res?.warning) setAiMsg(res.warning);
      else if (res?.ok) { setAiKey(''); setAiMsg('API key saved securely.'); }
      await loadAiStatus();
    } finally {
      setAiBusy(false);
    }
  };

  const clearAiKey = async () => {
    if (!window.api) return;
    setAiBusy(true);
    setAiMsg('');
    try {
      await window.api.invoke(CH.aiSetKey, '');
      setAiKey('');
      setAiMsg('API key removed.');
      await loadAiStatus();
    } finally {
      setAiBusy(false);
    }
  };

  const checkForUpdates = async () => {
    setUpdateStatus('Checking for updates...');
    const res = await window.api?.invoke(CH.appCheckForUpdates);
    if (res && res !== 'Error checking' && !res.includes('Dev Mode')) {
       if (updateStatus === 'Checking for updates...') setUpdateStatus(`Latest or found: ${res}`);
    } else {
       setUpdateStatus(res);
       setTimeout(() => setUpdateStatus(''), 3000);
    }
  };

  const installUpdate = () => {
    window.api?.invoke(CH.appInstallUpdate);
  };

  const toggle = async (key: string) => {
    const val = !config[key];
    const newConfig = { ...config, [key]: val };
    setConfig(newConfig);
    if (window.api) {
      await window.api.invoke(CH.appSetConfig, newConfig);
    }
  };

  const setTheme = async (theme: string) => {
    const newConfig = { ...config, theme };
    setConfig(newConfig);
    document.documentElement.setAttribute('data-theme', theme);
    if (window.api) {
      await window.api.invoke(CH.appSetConfig, newConfig);
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent relative">
      <div className="flex-shrink-0 px-10 pt-10 pb-6 border-b border-border/60 z-20 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-surface2 border border-border rounded-xl shadow-lg">
            <Settings className="w-6 h-6 text-text" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text tracking-tight">System Configuration</h2>
            <p className="text-xs font-mono text-muted mt-1.5 uppercase tracking-widest">Global preferences & modules</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-10 pt-8 no-scrollbar pb-24">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">
        
        <div className="flex flex-col gap-4">
           <h3 className="text-sm font-semibold flex items-center gap-2"><Power className="w-4 h-4 text-primary"/> Core Run State</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Launch on OS Startup</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Automatically start Onyx in the background.</p>
              </div>
              <Switch active={config.launchOnStartup} onClick={() => toggle('launchOnStartup')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Start Minimized to System Tray</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Keep the main window hidden when launching.</p>
              </div>
              <Switch active={config.startMinimized} onClick={() => toggle('startMinimized')} />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
           <h3 className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500"/> Module Automation</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Auto-activate Cursor Auto-Hide</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Enable Focus Mode engine automatically upon startup.</p>
              </div>
              <Switch active={config.autoHideCursorOnStart} onClick={() => toggle('autoHideCursorOnStart')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Auto-scan Repositories</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Git Pulse will automatically locate new local projects.</p>
              </div>
              <Switch active={config.autoScanGit} onClick={() => toggle('autoScanGit')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Global Hotkey (Ctrl+Alt+D)</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Toggle Onyx visibility from anywhere in the OS.</p>
              </div>
              <Switch active={config.enableGlobalHotkey ?? true} onClick={() => toggle('enableGlobalHotkey')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable System Notifications</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Allow tools and AI agents to send OS-level notifications.</p>
              </div>
              <Switch active={config.enableNotifications ?? true} onClick={() => toggle('enableNotifications')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Rich Animations</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show particle glows, motion transitions, and UI effects.</p>
              </div>
              <Switch active={config.enableAnimations ?? true} onClick={() => toggle('enableAnimations')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Inspector</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Shows the Inspector tab with real repo-sync and dev-process telemetry (local only).</p>
              </div>
              <Switch active={config.enableAIFeatures ?? true} onClick={() => toggle('enableAIFeatures')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable System Tray Mini-Dashboard</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show a discreet quick-access panel next to the system clock.</p>
              </div>
              <Switch active={config.enableTrayDashboard ?? true} onClick={() => toggle('enableTrayDashboard')} />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4">
           <h3 className="text-sm font-semibold flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-primary"/> AI Assistant <span className="text-[9px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded tracking-widest uppercase">Opt-in</span></h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm p-6 flex flex-col gap-4">
             <div className="flex items-start justify-between gap-4">
               <div className="min-w-0">
                 <h3 className="font-medium text-[13px] text-text flex items-center gap-2">
                   <KeyRound className="w-3.5 h-3.5 text-muted" /> Anthropic API Key
                 </h3>
                 <p className="text-[11px] text-muted mt-1 leading-relaxed">
                   Powers real commit-message generation and Inspector insights. Stored encrypted on this device via the OS keychain; calls run locally from the app. Get a key at console.anthropic.com.
                 </p>
               </div>
               <span className={`flex-shrink-0 text-[9px] font-mono font-bold tracking-widest px-2.5 py-1 rounded-md border ${aiStatus.configured ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-surface2 border-border text-muted'}`}>
                 {aiStatus.configured ? 'CONFIGURED' : 'NOT SET'}
               </span>
             </div>

             {!aiStatus.encryptionAvailable && (
               <div className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-md">
                 Secure storage is unavailable on this system — the key cannot be stored safely and will not be saved.
               </div>
             )}

             <div className="flex flex-col sm:flex-row gap-3">
               <input
                 type="password"
                 placeholder={aiStatus.configured ? '•••••••••••••• (saved)' : 'sk-ant-...'}
                 value={aiKey}
                 onChange={e => setAiKey(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && saveAiKey()}
                 className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none"
               />
               <div className="flex gap-2">
                 <button
                   onClick={saveAiKey}
                   disabled={aiBusy || !aiKey.trim() || !aiStatus.encryptionAvailable}
                   className="px-4 py-2 bg-primary hover:bg-accent text-background text-[11px] font-mono font-bold tracking-widest rounded-lg transition-colors disabled:opacity-40"
                 >
                   SAVE
                 </button>
                 {aiStatus.configured && (
                   <button
                     onClick={clearAiKey}
                     disabled={aiBusy}
                     className="px-4 py-2 bg-surface2 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 text-text border border-border text-[11px] font-mono font-bold tracking-widest rounded-lg transition-colors disabled:opacity-40"
                   >
                     CLEAR
                   </button>
                 )}
               </div>
             </div>

             <div className="flex items-center justify-between">
               <span className="text-[10px] font-mono text-muted">Model: <span className="text-text2">{aiStatus.model}</span></span>
               {aiMsg && <span className="text-[10px] font-mono text-primary/80">{aiMsg}</span>}
             </div>
           </div>
        </div>

        <div className="flex flex-col gap-4">
           <h3 className="text-sm font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-primary"/> Visual Identity</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm grid grid-cols-3 gap-[1px] bg-border p-[1px]">
             <button onClick={() => setTheme('midnight')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'midnight' || !config.theme ? 'bg-surface2 text-primary' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#12121a] border border-[#232328] shadow-sm flex items-center justify-center">
                 {(config.theme === 'midnight' || !config.theme) && <span className="w-2 h-2 rounded-full bg-primary" />}
               </span>
               <span className="text-xs font-mono font-bold tracking-widest mt-2">MIDNIGHT</span>
             </button>
             <button onClick={() => setTheme('oled')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'oled' ? 'bg-surface2 text-primary' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#000000] border border-[#1f1f1f] shadow-sm flex items-center justify-center">
                 {config.theme === 'oled' && <span className="w-2 h-2 rounded-full bg-primary" />}
               </span>
               <span className="text-xs font-mono font-bold tracking-widest mt-2">PURE OLED</span>
             </button>
             <button onClick={() => setTheme('dracula')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'dracula' ? 'bg-surface2 text-primary' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#282a36] border border-[#ff79c6] shadow-sm flex items-center justify-center">
                 {config.theme === 'dracula' && <span className="w-2 h-2 rounded-full bg-[#ff79c6]" />}
               </span>
               <span className="text-xs font-mono font-bold tracking-widest mt-2">DRACULA</span>
             </button>
           </div>
        </div>

        <div className="mt-2 p-5 bg-background border border-border rounded-xl grid grid-cols-2 gap-4 items-center">
           <div>
             <h4 className="text-sm font-medium text-text tracking-tight flex items-center gap-2">
               Onyx <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-primary/20 text-primary rounded-md">V1.0.0</span>
             </h4>
             <p className="text-[11px] font-mono text-muted mt-1.5 leading-relaxed">
               Centralized power toolkit &amp; system guard.
             </p>
             <div className="mt-4 flex items-center gap-3">
               <button 
                 onClick={checkForUpdates}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-surface2 hover:border-primary/30 text-text text-[10px] font-mono font-bold tracking-widest rounded transition-all cursor-pointer"
               >
                 CHECK UPDATES
               </button>
               {updateStatus === 'Update ready to install' && (
                 <button 
                   onClick={installUpdate}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-background border border-primary text-[10px] font-mono font-bold tracking-widest rounded transition-all cursor-pointer shadow-sm hover:-translate-y-0.5"
                 >
                   RESTART & INSTALL
                 </button>
               )}
               {updateStatus && updateStatus !== 'Update ready to install' && (
                 <span className="text-[11px] font-mono text-primary/80 animate-pulse">{updateStatus}</span>
               )}
             </div>
           </div>
           <div className="flex justify-end">
             <button 
               onClick={() => window.api?.invoke(CH.windowOpenExternal, 'https://github.com/Sepd0x/onyx')}
               className="flex items-center gap-2 px-4 py-2 bg-surface2 hover:bg-primary/20 text-text hover:text-primary border border-border hover:border-primary/50 text-xs font-mono font-bold tracking-widest rounded-lg transition-all cursor-pointer"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.5-1.4 6.5-7a4.6 4.6 0 0 0-1.39-3.2 4.6 4.6 0 0 0-.08-3.2s-1.1-.35-3.5 1.25a11.39 11.39 0 0 0-6.2 0C6.5 2.8 5.4 3.15 5.4 3.15a4.6 4.6 0 0 0-.08 3.2A4.6 4.6 0 0 0 3.93 9.5c0 5.6 3.35 6.65 6.5 7a4.8 4.8 0 0 0-1 3.03V22"/><path d="M9 20c-5 1.5-5-2.5-7-3"/></svg>
               GITHUB REPO
             </button>
           </div>
        </div>

        <div className="p-5 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-4">
           <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
           <div>
             <h4 className="text-sm font-medium text-primary tracking-tight">Secure Context Enforced</h4>
             <p className="text-[11px] font-mono text-muted mt-1.5 leading-relaxed opacity-80">
               All tools operate in a sandboxed Node.js environment via IPC tunnels. The UI layer has no direct access to your file system or system processes.
             </p>
           </div>
        </div>

        </div>
      </div>
    </div>
  );
}
