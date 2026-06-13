import { Network, Cpu, MemoryStick, Maximize2, Activity } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc } from '../lib/ipcCache';
import CountUp from '../components/CountUp';
import Logo from '../components/Logo';

export default function TrayView() {
  // Separate BrowserWindow → its own cache instance; both feeds poll at 2s.
  const stats = useIpc(CH.appGetStats, [], { pollMs: 2000 }).data ?? { cpu: '0%', ram: '0GB' };
  const portsData = useIpc(CH.portsGet, [], { pollMs: 2000 }).data;
  const activePorts = Array.isArray(portsData) ? portsData.length : 0;
  const cpuPct = Math.min(100, parseInt(stats.cpu) || 0);

  const openApp = () => window.api?.invoke(CH.trayOpenMain);

  return (
    <div className="h-screen w-screen bg-background text-text flex flex-col p-4 overflow-hidden select-none animate-in fade-in duration-200">
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

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="panel p-3.5 flex flex-col card-lift">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary"><Cpu className="w-3.5 h-3.5"/></div>
          </div>
          <span className="text-xl font-mono font-bold text-text leading-none">
            <CountUp value={cpuPct} suffix="%" />
          </span>
          <span className="text-[9px] text-muted uppercase tracking-wider mt-1.5">CPU Usage</span>
          <div className="h-1 rounded-full bg-surface3 mt-2 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${cpuPct}%` }} />
          </div>
        </div>
        <div className="panel p-3.5 flex flex-col card-lift">
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary"><MemoryStick className="w-3.5 h-3.5"/></div>
          </div>
          <span className="text-xl font-mono font-bold text-text leading-none">{stats.ram}</span>
          <span className="text-[9px] text-muted uppercase tracking-wider mt-1.5">RAM Usage</span>
          <div className="h-1 rounded-full bg-surface3 mt-2 overflow-hidden" />
        </div>
      </div>

      {/* Active ports */}
      <div className="panel p-3.5 flex items-center justify-between mb-3 card-lift">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-info/10 border border-info/20 text-info"><Network className="w-3.5 h-3.5"/></div>
          <span className="text-[10px] text-muted font-bold uppercase tracking-wider">Active Ports</span>
        </div>
        <span className="text-base font-mono font-bold text-text"><CountUp value={activePorts} /></span>
      </div>

      {/* Footer */}
      <button
        onClick={openApp}
        className="mt-auto w-full py-2.5 bg-primary hover:bg-accent text-background rounded-lg text-[10px] tracking-widest font-mono font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_var(--primary-alpha)] hover:shadow-[0_0_20px_var(--primary-alpha)] active:scale-[0.98]"
      >
        <Activity className="w-3.5 h-3.5" /> OPEN DASHBOARD
      </button>
    </div>
  );
}
