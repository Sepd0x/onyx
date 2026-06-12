import { Network, Cpu, MemoryStick, Rocket } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc } from '../lib/ipcCache';

export default function TrayView() {
  // Separate BrowserWindow → its own cache instance; both feeds poll at 2s.
  const stats = useIpc(CH.appGetStats, [], { pollMs: 2000 }).data ?? { cpu: '0%', ram: '0GB' };
  const portsData = useIpc(CH.portsGet, [], { pollMs: 2000 }).data;
  const activePorts = Array.isArray(portsData) ? portsData.length : 0;

  const openApp = () => {
    window.api?.invoke(CH.trayOpenMain);
  };

  return (
    <div className="h-screen w-screen bg-background text-text flex flex-col p-4 border border-border overflow-hidden select-none">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xs font-bold tracking-widest text-text">ONYX</h1>
        <button onClick={openApp} className="text-[10px] bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-2 py-1 rounded">
          OPEN APP
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-surface2 p-3 rounded-xl border border-border flex flex-col">
          <Cpu className="w-4 h-4 text-muted mb-2"/>
          <span className="text-lg font-mono font-bold text-text">{stats.cpu}</span>
          <span className="text-[9px] text-muted uppercase tracking-wider">CPU Util</span>
        </div>
        <div className="bg-surface2 p-3 rounded-xl border border-border flex flex-col">
          <MemoryStick className="w-4 h-4 text-muted mb-2"/>
          <span className="text-lg font-mono font-bold text-text">{stats.ram}</span>
          <span className="text-[9px] text-muted uppercase tracking-wider">RAM Ocp</span>
        </div>
      </div>
      
      <div className="bg-surface2 p-3 rounded-xl border border-border flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-primary"/>
          <span className="text-[10px] text-muted font-bold">ACTIVE PORTS</span>
        </div>
        <span className="text-sm font-mono font-bold">{activePorts}</span>
      </div>

      <div className="mt-auto flex flex-col gap-2">
        <button onClick={() => window.api?.invoke(CH.trayOpenMain)} className="w-full py-2 bg-surface2 hover:bg-surface3 border border-border rounded-lg text-[10px] tracking-widest font-mono font-bold text-muted hover:text-text flex items-center justify-center gap-2 transition-colors">
          <Rocket className="w-3.5 h-3.5" /> OPEN ONYX
        </button>
      </div>
    </div>
  );
}
