import { useEffect, useState } from 'react';
import { ShieldAlert, Activity, Coffee, Cpu, Zap, Search } from 'lucide-react';

export default function DevWatcherView({ isAIEnabled = true }: { isAIEnabled?: boolean }) {
  const [pid, setPid] = useState('');
  const [active, setActive] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);

  const fetchStatus = async () => {
    if (window.api) {
      const list = await window.api.invoke('dev:status');
      setActive(list || []);
    }
  };

  const fetchSuggested = async () => {
    if (window.api) {
      setLoadingProcs(true);
      const procs = await window.api.invoke('dev:getDevProcesses');
      setSuggested(procs || []);
      setLoadingProcs(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSuggested();
    const iv = setInterval(fetchStatus, 3000);
    return () => clearInterval(iv);
  }, []);

  const watch = async (targetPid: string, name?: string) => {
    if (!targetPid) return;
    if (window.api) {
      await window.api.invoke('dev:startWatch', { type: 'pid', target: targetPid, name: name || 'Process' });
    }
    setPid('');
    fetchStatus();
  };

  const stop = async (id: string) => {
    if (window.api) await window.api.invoke('dev:stopWatch', id);
    fetchStatus();
  };

  return (
    <div className="p-8 pb-24 max-w-4xl mx-auto h-full overflow-y-auto no-scrollbar">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-surface2 border border-border shadow-lg text-text rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text tracking-tight flex items-center gap-3">
              Session Guard
            </h2>
            <p className="text-xs font-mono text-muted tracking-wide mt-1.5">SMART WAKE-LOCK EMULATOR</p>
          </div>
        </div>
        
        <div className="bg-surface/50 border border-border border-l-2 border-l-primary p-5 rounded-xl text-xs leading-relaxed text-muted2 shadow-sm">
          <p>
            <strong className="text-text font-medium">The Problem:</strong> You compile a massive Rust binary, train a model or wait for AI logic generation. You close your laptop, the OS sleeps, and sockets break. 
          </p>
          <p className="mt-2.5">
            <strong className="text-text font-medium">The Solution:</strong> Session Guard acquires a system-level Power Save Blocker precisely until your target process exits, then releases the lock and sends a notification.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-surface/80 border border-border p-6 rounded-xl flex flex-col shadow-sm">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-2.5 mb-5"><Zap className="w-4 h-4 text-primary"/> Auto-Detected Tasks</h3>
          <div className="flex flex-col gap-2 flex-1">
            {loadingProcs ? (
                <div className="text-[10px] font-mono text-muted animate-pulse p-4 text-center">Scanning memory...</div>
            ) : suggested.length === 0 ? (
                <div className="text-[10px] font-mono text-muted p-4 text-center bg-surface3/30 rounded-lg border border-border border-dashed">No active dev processes found.</div>
            ) : (
                suggested.slice(0,4).map((p, i) => {
                  const isWatched = active.some(a => a.target === p.pid);
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-surface2 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-text flex items-center gap-2">
                          {p.name}
                          {p.confidence && <span className="text-[9px] font-mono text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded shadow-sm">AI {p.confidence}</span>}
                        </span>
                        <span className="text-[9px] font-mono text-muted mt-0.5">PID: {p.pid}</span>
                      </div>
                      {!isWatched ? (
                        <div className="flex gap-2">
                          <button onClick={() => watch(p.pid, p.name)} className="px-4 py-2 bg-surface3 hover:bg-primary/20 hover:text-primary hover:border-primary/30 border border-border text-[9px] font-mono font-bold tracking-widest rounded-md transition-all">
                            GUARD
                          </button>
                          <button onClick={() => window.api?.invoke('ports:kill', p.pid).then(fetchSuggested)} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 text-[9px] font-mono font-bold tracking-widest rounded-md transition-all">
                            KILL
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono font-bold text-green-400 bg-green-400/10 px-3 py-2 rounded-md border border-green-400/20">GUARDING</span>
                      )}
                    </div>
                  );
                })
            )}
          </div>
          <button onClick={fetchSuggested} className="mt-4 text-[10px] font-mono font-bold tracking-widest text-muted hover:text-primary transition-colors text-left flex items-center justify-center gap-2 py-2 bg-surface2 rounded-lg border border-border hover:border-primary/30"><Search className="w-3 h-3"/> RESCAN</button>
        </div>
        
        <div className="bg-surface/80 border border-border p-6 rounded-xl shadow-sm">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-2.5 mb-5"><Cpu className="w-4 h-4 text-primary"/> Manual PID Entry & Smart Tracker</h3>
          <div className="flex flex-col gap-3">
             <label className="text-[11px] text-muted">Enter a numeric Process ID (PID):</label>
             <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 14420"
              value={pid}
              onChange={e => setPid(e.target.value.replace(/[^0-9]/g, ''))}
              className="bg-background border border-border rounded-lg px-4 py-3.5 text-sm font-mono text-text focus:outline-none focus:border-primary/50 transition-colors shadow-inner"
            />
            <button 
              onClick={() => watch(pid)} 
              disabled={!pid}
              className="mt-3 px-4 py-3.5 bg-primary hover:bg-accent disabled:opacity-50 disabled:bg-surface3 disabled:text-muted disabled:border-border text-background border border-transparent rounded-lg text-[11px] font-bold tracking-widest font-mono transition-all shadow-[0_4px_15px_rgba(139,92,246,0.25)] hover:shadow-[0_4px_20px_rgba(139,92,246,0.4)] disabled:shadow-none"
            >
              TRACK PID
            </button>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border p-6 rounded-xl shadow-sm">
        <h3 className="text-[10px] font-mono font-bold tracking-widest text-muted2 mb-5">ACTIVE GUARDS ({active.length})</h3>
        <div className="flex flex-col gap-3">
          {active.length === 0 && (
            <div className="py-12 border border-dashed border-border rounded-xl text-center flex flex-col items-center gap-4 bg-background/50">
              <Coffee className="w-8 h-8 text-muted border border-border rounded-full p-2 bg-surface" />
              <div className="text-[10px] text-muted font-mono tracking-widest">NO ACTIVE SESSION GUARDS</div>
            </div>
          )}
          {active.map(task => (
            <div key={task.id} className="relative flex justify-between items-center p-5 border border-primary/30 bg-primary/5 rounded-xl shadow-sm">
              <div className="flex items-center gap-5">
                <div className="relative mr-2 flex-shrink-0">
                  <div className={`p-2.5 bg-background border border-border rounded-xl z-10 relative ${task.crash ? 'border-red-500' : ''}`}>
                    <Activity className={`w-5 h-5 ${task.crash ? 'text-red-500' : 'text-primary'}`} />
                  </div>
                  {!task.crash && <span className="absolute -top-1 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping z-20"></span>}
                  <span className={`absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full z-20 ${task.crash ? 'bg-red-500' : 'bg-green-400'}`}></span>
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="text-sm font-semibold text-text">{task.name || 'External Process'}</div>
                  <div className="text-[10px] font-mono text-muted mt-1 tracking-wide">PID: <span className="text-text2">{task.target}</span> • WAKE LOCK ACQUIRED</div>
                  {task.aiError && isAIEnabled && (
                    <div className="mt-3 text-[11px] font-mono bg-red-500/5 border border-red-500/20 p-3 rounded-lg text-red-300 leading-relaxed">
                      {task.aiError}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end min-w-[120px]">
                 {task.aiError && isAIEnabled && (
                    <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-md text-[9px] font-mono font-bold text-red-500 w-full mb-1">
                      <Activity className="w-3 h-3 animate-pulse text-red-500"/> FAULT DETECTED
                    </div>
                 )}
                 {task.crash && isAIEnabled && (
                   <button 
                     onClick={async () => {
                        await window.api?.invoke('dev:heal', task.id);
                        fetchStatus();
                     }}
                     className="w-full px-5 py-2.5 text-[10px] font-mono font-bold tracking-widest text-[#8b5cf6] bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 border border-[#8b5cf6]/30 rounded-lg transition-all"
                   >
                     AUTO HEAL
                   </button>
                 )}
                 <button 
                   onClick={() => stop(task.id)} 
                   className="w-full px-5 py-2.5 text-[10px] font-mono font-bold tracking-widest text-text2 bg-surface hover:text-red-400 hover:bg-red-400/10 border border-border hover:border-red-400/30 rounded-lg transition-all flex items-center justify-center"
                 >
                   ABORT
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
