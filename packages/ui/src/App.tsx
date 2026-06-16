import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { Network, GitBranch, MousePointer2, ShieldAlert, Minus, X, Settings, Activity, TerminalSquare, Rocket, BrainCircuit, Zap, Palette, Command, Sparkles, ClipboardList } from 'lucide-react';

// Views are code-split (React.lazy): each tab's chunk loads on first open, so the
// initial bundle/first paint only carries the shell + the landing view.
const PortsView = lazy(() => import('./views/PortsView'));
const GitView = lazy(() => import('./views/GitView'));
const CursorView = lazy(() => import('./views/CursorView'));
const DevWatcherView = lazy(() => import('./views/DevWatcherView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
const CleanserView = lazy(() => import('./views/CleanserView'));
const SnippetsView = lazy(() => import('./views/SnippetsView'));
const ClipboardView = lazy(() => import('./views/ClipboardView'));
const LaunchersView = lazy(() => import('./views/LaunchersView'));
const TrayView = lazy(() => import('./views/TrayView'));
const AIAuditorView = lazy(() => import('./views/AIAuditorView'));
const PowerOSView = lazy(() => import('./views/PowerOSView'));

import Logo from './components/Logo';
import CommandPalette, { type Command as PaletteCommand } from './components/CommandPalette';
import Onboarding from './components/Onboarding';
import { CH, EV } from './ipc';
import { useIpc, invalidate } from './lib/ipcCache';
import { applyAccent } from './lib/accents';

export default function App() {
  const [activeTab, setActiveTab] = useState('watcher');
  const [isTrayMode, setIsTrayMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [onboardDone, setOnboardDone] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  // Global update indicator: the auto-updater fires these from main; show a banner
  // in any view (not just Settings) so an update is impossible to miss.
  const [update, setUpdate] = useState<{ status: 'available' | 'downloading' | 'ready' | 'error'; version?: string; pct?: number; message?: string } | null>(null);

  // Pause the background polls while the window is hidden (closed to tray /
  // minimised) — no point fetching stats every 2s for a window nobody can see.
  const [active, setActive] = useState(typeof document !== 'undefined' ? !document.hidden : true);
  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const idle = isTrayMode || !active;

  // Shared cache: config + system stats poll once per channel, served instantly on
  // re-render and shared with any other view that reads them.
  const appConfigState = useIpc(CH.appGetConfig, [], { pollMs: idle ? 0 : 3000 });
  const appConfig = appConfigState.data ?? {};
  const stats = useIpc(CH.appGetStats, [], { pollMs: idle ? 0 : 2000 }).data ?? { cpu: '14%', ram: '4.2GB' };

  // First-run onboarding: shown once config has loaded and the flag isn't set
  // (or forced via ?onboarding for previews). Dismissal flips the flag in config.
  const forceOnboarding = typeof window !== 'undefined' && /[?&]onboarding/.test(window.location.search);
  const showOnboarding = appConfigState.data !== undefined && !onboardDone && (forceOnboarding || appConfig.onboarded !== true);

  // Theme authority (#30): apply the saved theme on every window as soon as the
  // config arrives (and on later changes), mirroring to localStorage so the
  // next launch paints with the right theme immediately (see main.tsx).
  useEffect(() => {
    const theme = appConfig.theme || 'midnight';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('onyx-theme', theme); } catch {}
  }, [appConfig.theme]);

  // User-picked accent colour: override --primary/--accent (or clear to fall
  // back to the theme), mirrored to localStorage for a flash-free next launch.
  useEffect(() => {
    applyAccent(appConfig.accent);
    try {
      if (appConfig.accent) localStorage.setItem('onyx-accent', appConfig.accent);
      else localStorage.removeItem('onyx-accent');
    } catch {}
  }, [appConfig.accent]);

  // Live config sync: main broadcasts config:changed on every save. Revalidate the
  // shared config cache so theme/accent/feature toggles update instantly in this
  // window — critical for the tray window, which otherwise never re-reads config.
  useEffect(() => {
    const unsub = window.api?.on(EV.configChanged, () => invalidate('app:getConfig'));
    return () => unsub?.();
  }, []);

  useEffect(() => {
    if (window.location.hash === '#tray') {
      setIsTrayMode(true);
    }
    // Mock notification listener in preview
    const notifHandler = (e: any) => {
      if (e.detail?.type === 'notification') {
        const id = Math.random().toString();
        setNotifications(prev => [...prev, { id, title: e.detail.title, body: e.detail.body }]);
        // Mark as leaving shortly before removal so the exit animation can play.
        setTimeout(() => setNotifications(prev => prev.map(n => n.id === id ? { ...n, leaving: true } : n)), 4650);
        setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
      }
    };
    window.addEventListener('mock-event', notifHandler);
    return () => window.removeEventListener('mock-event', notifHandler);
  }, []);

  // Auto-updater events from main → drive the global update banner.
  useEffect(() => {
    const subs = [
      window.api?.on(EV.appUpdateAvailable, (v: string) => setUpdate({ status: 'available', version: v })),
      window.api?.on(EV.appUpdateProgress, (pct: number) => setUpdate((u) => ({ ...(u || {}), status: 'downloading', pct }))),
      window.api?.on(EV.appUpdateDownloaded, () => setUpdate((u) => ({ ...(u || {}), status: 'ready' }))),
      window.api?.on(EV.appUpdateError, (m: string) => setUpdate({ status: 'error', message: m })),
    ];
    return () => subs.forEach((u) => u?.());
  }, []);
  const downloadUpdate = () => { setUpdate((u) => ({ ...(u || {}), status: 'downloading', pct: 0 })); window.api?.invoke(CH.appDownloadUpdate); };
  const installUpdate = () => window.api?.invoke(CH.appInstallUpdate);

  // Command palette (Ctrl/Cmd+K): toggle from anywhere, even inside inputs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setTheme = (theme: string) => {
    document.documentElement.setAttribute('data-theme', theme); // instant, no flash
    window.api?.invoke(CH.appSetConfig, { theme });
    invalidate('app:getConfig');
  };

  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const views: { id: string; label: string; icon: any }[] = [
      { id: 'watcher', label: 'Session Guard', icon: ShieldAlert },
      ...((appConfig.enableAIFeatures ?? true) ? [{ id: 'aiauditor', label: 'Inspector', icon: BrainCircuit }] : []),
      { id: 'cursor', label: 'Focus Mode', icon: MousePointer2 },
      { id: 'ports', label: 'Port Mapper', icon: Network },
      { id: 'git', label: 'Git Pulse', icon: GitBranch },
      { id: 'cleaner', label: 'Dev Cleanser', icon: Activity },
      { id: 'launchers', label: 'Launchers', icon: Rocket },
      { id: 'snippets', label: 'Snippets', icon: TerminalSquare },
      { id: 'clipboard', label: 'Clipboard', icon: ClipboardList },
      { id: 'power', label: 'OS Power Manager', icon: Zap },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];
    const nav: PaletteCommand[] = views.map((v) => ({
      id: `go:${v.id}`,
      label: v.label,
      section: 'Go to',
      hint: 'View',
      keywords: 'open view navigate',
      icon: v.icon,
      run: () => setActiveTab(v.id),
    }));
    const themes: PaletteCommand[] = [
      { id: 'theme:midnight', label: 'Midnight', section: 'Theme' },
      { id: 'theme:oled', label: 'Pure OLED', section: 'Theme' },
      { id: 'theme:dracula', label: 'Dracula', section: 'Theme' },
    ].map((t) => ({
      ...t,
      hint: 'Theme',
      keywords: 'theme colour color appearance dark',
      icon: Palette,
      run: () => setTheme(t.id.split(':')[1]),
    }));
    return [...nav, ...themes];
  }, [appConfig.enableAIFeatures]);

  const closeWindow = () => window.api?.invoke(CH.windowClose);
  const minimizeWindow = () => window.api?.invoke(CH.windowMinimize);

  if (isTrayMode) {
    return <Suspense fallback={null}><TrayView /></Suspense>;
  }

  return (
    <div className={`flex flex-col h-screen rounded-xl border border-border2 bg-background shadow-2xl overflow-hidden relative selection:bg-primary/30 ${appConfig.enableAnimations === false ? 'disable-animations' : ''}`}>
      {/* Titlebar (Draggable) */}
      <div 
        className="h-[42px] bg-surface/80 backdrop-blur-md flex items-center justify-between px-4 border-b border-border relative z-10"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        <div className="flex items-center gap-3">
          <Logo className="w-4 h-4" />
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-muted2">ONYX</span>
        </div>
        <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => setPaletteOpen(true)}
            title="Command palette (Ctrl+K)"
            aria-label="Open command palette"
            className="hidden md:flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-md border border-border text-muted hover:text-text hover:bg-surface2 transition-colors"
          >
            <Command className="w-3 h-3" />
            <kbd className="text-[9px] font-mono font-bold tracking-wider">Ctrl K</kbd>
          </button>
          <div className="hidden md:flex items-center gap-3 mr-2">
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-muted">
               <span className="text-primary">CPU</span> {stats.cpu}
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-muted">
               <span className="text-primary">RAM</span> {stats.ram}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={minimizeWindow} aria-label="Minimize window" className="p-1.5 hover:bg-surface3 rounded-md text-muted transition-all">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button onClick={closeWindow} aria-label="Close window" className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-md text-muted transition-all">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
      {/* Hairline accent under the titlebar */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent relative z-10 flex-shrink-0"></div>

      {/* Global update banner — visible in every view, not just Settings */}
      {update && (
        <div className={`flex items-center justify-between gap-3 px-4 py-2 border-b relative z-10 flex-shrink-0 animate-in slide-in-from-top-1 fade-in duration-200 ${update.status === 'error' ? 'bg-danger/10 border-danger/30' : 'bg-primary/15 border-primary/30'}`}>
          <span className={`text-[12px] flex items-center gap-2 min-w-0 ${update.status === 'error' ? 'text-danger' : 'text-accent'}`}>
            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {update.status === 'available' && `Update${update.version ? ` ${update.version}` : ''} available.`}
              {update.status === 'downloading' && `Downloading update… ${update.pct ?? 0}%`}
              {update.status === 'ready' && `Update${update.version ? ` ${update.version}` : ''} ready to install.`}
              {update.status === 'error' && `Update failed: ${update.message || 'unknown error'}`}
            </span>
          </span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {update.status === 'available' && (
              <button onClick={downloadUpdate} className="text-[11px] font-medium px-3 py-1 rounded-md bg-primary/25 text-accent border border-primary/30 hover:bg-primary/35 transition-colors">Download</button>
            )}
            {update.status === 'ready' && (
              <button onClick={installUpdate} className="text-[11px] font-medium px-3 py-1 rounded-md bg-primary/25 text-accent border border-primary/30 hover:bg-primary/35 transition-colors">Restart &amp; install</button>
            )}
            {(update.status === 'available' || update.status === 'error') && (
              <button onClick={() => setUpdate(null)} aria-label="Dismiss update banner" className="text-muted hover:text-text transition-colors"><X className="w-3.5 h-3.5" /></button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar */}
        <aside className="w-56 bg-surface/40 backdrop-blur-sm border-r border-border p-4 flex flex-col justify-between">
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-mono font-bold tracking-widest text-muted uppercase mb-2 pl-2">Tools</div>
            <Tab idx={0} icon={<ShieldAlert className="w-4 h-4" />} label="Session Guard" isActive={activeTab === 'watcher'} onClick={() => setActiveTab('watcher')} />
            {(appConfig.enableAIFeatures ?? true) && (
              <Tab idx={1} icon={<BrainCircuit className="w-4 h-4" />} label="Inspector" isActive={activeTab === 'aiauditor'} onClick={() => setActiveTab('aiauditor')} />
            )}
            <Tab idx={2} icon={<MousePointer2 className="w-4 h-4" />} label="Focus Mode" isActive={activeTab === 'cursor'} onClick={() => setActiveTab('cursor')} />
            <Tab idx={3} icon={<Network className="w-4 h-4" />} label="Port Mapper" isActive={activeTab === 'ports'} onClick={() => setActiveTab('ports')} />
            <Tab idx={4} icon={<GitBranch className="w-4 h-4" />} label="Git Pulse" isActive={activeTab === 'git'} onClick={() => setActiveTab('git')} />
            <Tab idx={5} icon={<Activity className="w-4 h-4" />} label="Dev Cleanser" isActive={activeTab === 'cleaner'} onClick={() => setActiveTab('cleaner')} />
            <Tab idx={6} icon={<Rocket className="w-4 h-4" />} label="Launchers" isActive={activeTab === 'launchers'} onClick={() => setActiveTab('launchers')} />
            <Tab idx={7} icon={<TerminalSquare className="w-4 h-4" />} label="Snippets" isActive={activeTab === 'snippets'} onClick={() => setActiveTab('snippets')} />
            <Tab idx={8} icon={<ClipboardList className="w-4 h-4" />} label="Clipboard" isActive={activeTab === 'clipboard'} onClick={() => setActiveTab('clipboard')} />
            <Tab idx={9} icon={<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 12 3.3 17"/></svg>} label="OS Power Manager" isActive={activeTab === 'power'} onClick={() => setActiveTab('power')} />
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="h-px w-full bg-border my-2"></div>
            <Tab idx={10} icon={<Settings className="w-4 h-4" />} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-transparent relative no-scrollbar">
          {/* Keyed wrapper: re-mounts on tab change so every view gets a uniform entrance. */}
          <div key={activeTab} className="relative z-10 h-full animate-in fade-in slide-in-from-bottom-1 duration-200">
            <Suspense fallback={<div className="p-8"><div className="shimmer h-9 w-56 rounded-lg" /></div>}>
              {activeTab === 'ports' && <PortsView />}
              {activeTab === 'git' && <GitView />}
              {activeTab === 'cursor' && <CursorView />}
              {activeTab === 'watcher' && <DevWatcherView isAIEnabled={appConfig.enableAIFeatures ?? true} />}
              {activeTab === 'aiauditor' && <AIAuditorView />}
              {activeTab === 'cleaner' && <CleanserView />}
              {activeTab === 'launchers' && <LaunchersView />}
              {activeTab === 'snippets' && <SnippetsView />}
              {activeTab === 'clipboard' && <ClipboardView />}
              {activeTab === 'settings' && <SettingsView />}
              {activeTab === 'power' && <PowerOSView />}
            </Suspense>
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />

      {showOnboarding && <Onboarding onFinish={() => setOnboardDone(true)} />}

      {notifications.length > 0 && (
         <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
            {notifications.map(n => (
               <div key={n.id} className={`bg-surface/90 backdrop-blur-md border border-border p-4 rounded-xl shadow-2xl flex items-start gap-3 w-80 pointer-events-auto ${n.leaving ? 'animate-out slide-out-to-right-4 fade-out duration-300 fill-mode-forwards' : 'animate-in slide-in-from-right-4 fade-in duration-300'}`}>
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

function Tab({ icon, label, isActive, onClick, idx = 0 }: any) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${idx * 28}ms` }}
      className={`flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium rounded-lg transition-all duration-200 w-full active:scale-[0.98] animate-in fade-in slide-in-from-left-2 fill-mode-backwards ${
        isActive
          ? 'bg-surface2 text-text border border-border2'
          : 'text-muted2 hover:text-text hover:bg-surface2/60 border border-transparent'
      }`}
    >
      <span className={`transition-colors duration-200 flex-shrink-0 ${isActive ? 'text-primary' : 'text-muted'}`}>{icon}</span>
      <span className="truncate">{label}</span>
      {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"></div>}
    </button>
  );
}
