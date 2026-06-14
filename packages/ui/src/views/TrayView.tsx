import { useEffect, useRef, useState } from 'react';
import { Network, Cpu, MemoryStick, Maximize2, Activity, ShieldCheck } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc } from '../lib/ipcCache';
import CountUp from '../components/CountUp';
import Logo from '../components/Logo';

export default function TrayView() {
  // The tray popup hides on blur but stays mounted; without this it would keep
  // polling every 2s in the background. Pause the feeds while hidden and resume
  // (with a fresh fetch) on show.
  const [active, setActive] = useState(typeof document !== 'undefined' ? !document.hidden : true);
  useEffect(() => {
    const onVis = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  const poll = active ? 2000 : 0;

  // Separate BrowserWindow → its own cache instance.
  const stats = useIpc(CH.appGetStats, [], { pollMs: poll }).data ?? { cpu: '0%', ram: '0GB' };
  const portsData = useIpc(CH.portsGet, [], { pollMs: poll }).data;
  const guardsData = useIpc(CH.devStatus, [], { pollMs: poll }).data;
  // Tile visibility is user-configurable (Settings → Tray dashboard). Config syncs
  // live via App's config:changed listener (cache is invalidated on every save).
  const cfg: any = useIpc(CH.appGetConfig, [], { pollMs: 0 }).data ?? {};

  const activePorts = Array.isArray(portsData) ? portsData.length : 0;
  const activeGuards = Array.isArray(guardsData) ? guardsData.length : 0;
  const cpuPct = Math.min(100, parseInt(stats.cpu) || 0);
  const ramPct = Math.min(100, Math.round((stats as any).ramPct) || 0);

  const showCpu = cfg.trayShowCpu !== false;
  const showRam = cfg.trayShowRam !== false;
  const showPorts = cfg.trayShowPorts !== false;
  const showGuards = cfg.trayShowGuards === true;

  const openApp = () => window.api?.invoke(CH.trayOpenMain);

  // Tell main the popup's exact rendered height so it can size the window to fit
  // (no clipped footer, no dead space) — on mount, on every content change
  // (tiles toggled), and on show (the window gets focus).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const report = () => window.api?.invoke(CH.trayResize, Math.ceil(el.getBoundingClientRect().height));
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    window.addEventListener('focus', report);
    return () => { ro.disconnect(); window.removeEventListener('focus', report); };
  }, []);

  return (
    <div ref={rootRef} className="w-screen bg-background text-text flex flex-col p-4 select-none animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Logo className="w-5 h-5" />
          <span className="text-xs font-bold tracking-[0.25em] text-text">ONYX</span>
          <span className="relative flex h-1.5 w-1.5 ml-1" title="Running">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
          </span>
        </div>
        <button onClick={openApp} aria-label="Open the main Onyx window" className="p-1.5 rounded-lg bg-surface2 hover:bg-surface3 border border-border text-muted hover:text-primary transition-colors active:scale-90">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stat tiles (CPU / RAM) */}
      {(showCpu || showRam) && (
        <div className={`grid ${showCpu && showRam ? 'grid-cols-2' : 'grid-cols-1'} gap-3 mb-3`}>
          {showCpu && (
            <div className="panel p-3.5 flex flex-col card-lift">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-accent"><Cpu className="w-3.5 h-3.5"/></div>
              </div>
              <span className="text-xl font-mono font-bold text-text leading-none">
                <CountUp value={cpuPct} suffix="%" />
              </span>
              <span className="text-[10px] text-muted mt-1.5">CPU usage</span>
              <div className="h-1 rounded-full bg-surface3 mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${cpuPct}%` }} />
              </div>
            </div>
          )}
          {showRam && (
            <div className="panel p-3.5 flex flex-col card-lift">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-accent"><MemoryStick className="w-3.5 h-3.5"/></div>
              </div>
              <span className="text-xl font-mono font-bold text-text leading-none">{stats.ram}</span>
              <span className="text-[10px] text-muted mt-1.5">RAM usage</span>
              <div className="h-1 rounded-full bg-surface3 mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${ramPct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active ports */}
      {showPorts && (
        <div className="panel p-3.5 flex items-center justify-between mb-3 card-lift">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-accent"><Network className="w-3.5 h-3.5"/></div>
            <span className="text-[11px] text-muted">Active ports</span>
          </div>
          <span className="text-base font-mono font-bold text-text"><CountUp value={activePorts} /></span>
        </div>
      )}

      {/* Active guards */}
      {showGuards && (
        <div className="panel p-3.5 flex items-center justify-between mb-3 card-lift">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-accent"><ShieldCheck className="w-3.5 h-3.5"/></div>
            <span className="text-[11px] text-muted">Active guards</span>
          </div>
          <span className="text-base font-mono font-bold text-text"><CountUp value={activeGuards} /></span>
        </div>
      )}

      {/* Footer */}
      <button
        onClick={openApp}
        className="mt-3 w-full py-2.5 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
      >
        <Activity className="w-3.5 h-3.5" /> Open dashboard
      </button>
    </div>
  );
}
