import { useState, useEffect } from 'react';
import { Network, GitBranch, MousePointer2, ShieldAlert, Minus, X, Settings, Activity, TerminalSquare, Rocket, BrainCircuit } from 'lucide-react';
import PortsView from './views/PortsView';
import GitView from './views/GitView';
import CursorView from './views/CursorView';
import DevWatcherView from './views/DevWatcherView';
import SettingsView from './views/SettingsView';
import CleanserView from './views/CleanserView';
import SnippetsView from './views/SnippetsView';
import LaunchersView from './views/LaunchersView';
import TrayView from './views/TrayView';
import AIAuditorView from './views/AIAuditorView';

import PowerOSView from './views/PowerOSView';

export default function App() {
  const [activeTab, setActiveTab] = useState('watcher');
  const [stats, setStats] = useState({ cpu: '14%', ram: '4.2GB' });
  const [isTrayMode, setIsTrayMode] = useState(false);
  const [appConfig, setAppConfig] = useState<any>({});
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (window.location.hash === '#tray') {
      setIsTrayMode(true);
    }
    const getConfig = async () => {
      if (window.api) {
         try {
            const c = await window.api.invoke('app:getConfig');
            if (c) setAppConfig(c);
         } catch(e) {}
      }
    };
    getConfig();
    // listen to theme updates etc.
    const iv = setInterval(getConfig, 3000);

    // Mock notification listener in preview
    const notifHandler = (e: any) => {
      if (e.detail?.type === 'notification') {
        const id = Math.random().toString();
        setNotifications(prev => [...prev, { id, title: e.detail.title, body: e.detail.body }]);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
      }
    };
    window.addEventListener('mock-event', notifHandler);

    return () => {
       clearInterval(iv);
       window.removeEventListener('mock-event', notifHandler);
    }
  }, []);

  const closeWindow = () => window.api?.invoke('window:close');
  const minimizeWindow = () => window.api?.invoke('window:minimize');

  useEffect(() => {
    if (isTrayMode) return;
    const getStats = async () => {
      if (window.api) {
        try {
          const s = await window.api.invoke('app:getStats');
          if (s) setStats(s);
        } catch (e) {}
      }
    };
    getStats();
    const iv = setInterval(getStats, 2000);
    return () => clearInterval(iv);
  }, [isTrayMode]);

  if (isTrayMode) {
    return <TrayView />;
  }

  return (
    <div className={`flex flex-col h-screen rounded-xl border border-border2 bg-[#000000] shadow-2xl overflow-hidden relative selection:bg-primary/30 ${appConfig.enableAnimations === false ? 'disable-animations' : ''}`}>
      {/* Premium Glow effect / Orbs */}
      {appConfig.enableAnimations !== false ? (
         <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-50">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[130px] rounded-full animate-blob"></div>
            <div className="absolute top-[30%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full animate-blob animation-delay-2000"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-purple-500/15 blur-[140px] rounded-full animate-blob animation-delay-4000"></div>
         </div>
      ) : (
         <div className="absolute top-0 left-0 w-full h-full bg-premium-gradient pointer-events-none opacity-20"></div>
      )}
      
      {/* Titlebar (Draggable) */}
      <div 
        className="h-[42px] bg-surface/80 backdrop-blur-md flex items-center justify-between px-4 border-b border-border relative z-10"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="16" height="16" className="drop-shadow-[0_0_8px_rgba(147,51,234,0.8)]">
            <path d="M 64 8 L 112 36 L 64 64 L 16 36 Z" fill="#9333EA" fillOpacity="0.8"/>
            <path d="M 16 36 L 64 64 L 64 120 L 16 92 Z" fill="#7E22CE"/>
            <path d="M 112 36 L 112 92 L 64 120 L 64 64 Z" fill="#6B21A8"/>
            <path d="M 64 8 L 112 36 L 64 64 L 16 36 Z" fill="none" stroke="#D8B4FE" strokeWidth="3" strokeLinejoin="round"/>
            <path d="M 16 36 L 64 64 L 64 120 L 16 92 Z" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinejoin="round"/>
            <path d="M 112 36 L 112 92 L 64 120 L 64 64 Z" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinejoin="round"/>
          </svg>
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-muted2">ONYX</span>
        </div>
        <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="hidden md:flex items-center gap-3 mr-2">
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-muted">
               <span className="text-primary">CPU</span> {stats.cpu}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-muted">
               <span className="text-primary">RAM</span> {stats.ram}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={minimizeWindow} className="p-1.5 hover:bg-surface3 rounded-md text-muted transition-all">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button onClick={closeWindow} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-muted transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside className="w-56 bg-surface/40 backdrop-blur-sm border-r border-border p-4 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-mono font-bold tracking-widest text-muted uppercase mb-2 pl-2">Tools</div>
            <Tab icon={<ShieldAlert className="w-4 h-4" />} label="Session Guard" isActive={activeTab === 'watcher'} onClick={() => setActiveTab('watcher')} />
            {(appConfig.enableAIFeatures ?? true) && (
              <Tab icon={<BrainCircuit className="w-4 h-4 text-purple-400" />} label="Inspector" isActive={activeTab === 'aiauditor'} onClick={() => setActiveTab('aiauditor')} />
            )}
            <Tab icon={<MousePointer2 className="w-4 h-4" />} label="Focus Mode" isActive={activeTab === 'cursor'} onClick={() => setActiveTab('cursor')} />
            <Tab icon={<Network className="w-4 h-4" />} label="Port Mapper" isActive={activeTab === 'ports'} onClick={() => setActiveTab('ports')} />
            <Tab icon={<GitBranch className="w-4 h-4" />} label="Git Pulse" isActive={activeTab === 'git'} onClick={() => setActiveTab('git')} />
            <Tab icon={<Activity className="w-4 h-4" />} label="Dev Cleanser" isActive={activeTab === 'cleaner'} onClick={() => setActiveTab('cleaner')} />
            <Tab icon={<Rocket className="w-4 h-4" />} label="Launchers" isActive={activeTab === 'launchers'} onClick={() => setActiveTab('launchers')} />
            <Tab icon={<TerminalSquare className="w-4 h-4" />} label="Snippets" isActive={activeTab === 'snippets'} onClick={() => setActiveTab('snippets')} />
            <Tab icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 12 3.3 17"/></svg>} label="OS Power Manager" isActive={activeTab === 'power'} onClick={() => setActiveTab('power')} />
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="h-px w-full bg-border my-2"></div>
            <Tab icon={<Settings className="w-4 h-4" />} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-transparent relative no-scrollbar">
          <div className="absolute inset-0 z-0 bg-background/50 pointer-events-none"></div>
          <div className="relative z-10 h-full">
            {activeTab === 'ports' && <PortsView />}
            {activeTab === 'git' && <GitView />}
            {activeTab === 'cursor' && <CursorView />}
            {activeTab === 'watcher' && <DevWatcherView isAIEnabled={appConfig.enableAIFeatures ?? true} />}
            {activeTab === 'aiauditor' && <AIAuditorView />}
            {activeTab === 'cleaner' && <CleanserView />}
            {activeTab === 'launchers' && <LaunchersView />}
            {activeTab === 'snippets' && <SnippetsView />}
            {activeTab === 'settings' && <SettingsView />}
            {activeTab === 'power' && <PowerOSView />}
          </div>
        </main>
      </div>

      {notifications.length > 0 && (
         <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {notifications.map(n => (
               <div key={n.id} className="bg-surface/90 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl flex items-start gap-3 w-80 animate-in slide-in-from-right-4 fade-in duration-300 pointer-events-auto">
                 <div className="bg-primary/20 text-primary p-2 rounded-lg flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 21h4"/><path d="m19 12-2.5-1.5-.5-5.5-2.5-2v0a2 2 0 0 0-4 0v0l-2.5 2-.5 5.5L4 12V8l2.5-1.5L7 1l2.5 2v0a2 2 0 0 0 4 0v0L16 1l.5 5.5L19 8v4z"/></svg>
                 </div>
                 <div>
                    <h4 className="text-[12px] font-bold text-text mb-0.5 leading-tight">{n.title}</h4>
                    <p className="text-[10px] font-mono text-muted leading-relaxed">{n.body}</p>
                 </div>
               </div>
            ))}
         </div>
      )}
    </div>
  );
}

function Tab({ icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-200 w-full ${
        isActive 
          ? 'bg-surface3/80 text-text shadow-sm border border-border2 shadow-[0_4px_12px_rgba(0,0,0,0.2)]' 
          : 'text-muted2 hover:text-text hover:bg-surface2 border border-transparent'
      }`}
    >
      <span className={`transition-colors duration-200 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}>{icon}</span>
      <span className="truncate">{label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"></div>}
    </button>
  );
}
