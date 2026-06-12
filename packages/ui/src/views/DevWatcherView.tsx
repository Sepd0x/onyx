import { useEffect, useState } from 'react';
import { ShieldAlert, Activity, Coffee, Cpu, Zap, Search, MousePointerClick, Lock, BellRing, ChevronRight } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';

export default function DevWatcherView({ isAIEnabled = true }: { isAIEnabled?: boolean }) {
  const [pid, setPid] = useState('');
  // Active guards poll through the shared cache; the suggested-process scan stays
  // manual (mount + RESCAN button) since it's user-triggered, not a live feed.
  const active: any[] = useIpc(CH.devStatus, [], { pollMs: 3000 }).data ?? [];
  const [suggested, setSuggested] = useState<any[]>([]);
  const [loadingProcs, setLoadingProcs] = useState(false);

  const fetchSuggested = async () => {
    if (window.api) {
      setLoadingProcs(true);
      const procs = await window.api.invoke(CH.devGetDevProcesses);
      setSuggested(procs || []);
      setLoadingProcs(false);
    }
  };

  useEffect(() => { fetchSuggested(); }, []);

  const watch = async (targetPid: string, name?: string) => {
    if (!targetPid) return;
    if (window.api) {
      await window.api.invoke(CH.devStartWatch, { type: 'pid', target: targetPid, name: name || 'Process' });
    }
    setPid('');
    invalidate('dev:status');
  };

  const stop = async (id: string) => {
    if (window.api) await window.api.invoke(CH.devStopWatch, id);
    invalidate('dev:status');
  };

  return (
    <div className="p-8 pb-24 max-w-4xl mx-auto h-full overflow-y-auto no-scrollbar">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-surface2 border border-border shadow-lg text-text rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">
              Session Guard
            </h2>
            <p className="micro-label mt-1.5">Smart wake-lock emulator</p>
          </div>
        </div>

        {/* How it works — compact step strip (replaces the marketing prose) */}
        <div className="bg-surface/50 border border-border rounded-xl px-5 py-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-0">
          {[
            { icon: MousePointerClick, title: 'Pick a process', desc: 'auto-detected or by PID' },
            { icon: Lock, title: 'Onyx holds a wake lock', desc: 'the OS won’t sleep mid-task' },
            { icon: BellRing, title: 'Auto-release + notify', desc: 'the moment the task exits' },
          ].map((s, i) => (
            <div key={s.title} className="flex items-center flex-1 animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards" style={{ animationDelay: `${i * 90}ms` }}>
              {i > 0 && <ChevronRight className="hidden sm:block w-4 h-4 text-muted/50 mx-3 flex-shrink-0" />}
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary flex-shrink-0">
                  <s.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-text leading-tight">{s.title}</div>
                  <div className="text-[10px] text-muted font-mono mt-0.5 truncate">{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-surface/80 border border-border p-6 rounded-xl flex flex-col shadow-sm">
          <h3 className="text-[13px] font-semibold text-text flex items-center gap-2.5 mb-5"><Zap className="w-4 h-4 text-primary"/> Auto-Detected Tasks</h3>
          <div className="flex flex-col gap-2 flex-1">
            {loadingProcs ? (
                <div className="flex flex-col gap-2" aria-label="Scanning processes">
                  <Skeleton className="h-[58px]" />
                  <Skeleton className="h-[58px]" />
                  <Skeleton className="h-[58px]" />
                </div>
            ) : suggested.length === 0 ? (
                <EmptyState compact icon={Search} title="No dev processes detected" description="Start a dev server, build or IDE and rescan — likely tasks show up here with one-click guarding." />
            ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {suggested.map((p, i) => {
                  const isWatched = active.some(a => a.target === p.pid);
                  return (
                    <div key={p.pid} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background/50 hover:bg-surface2 transition-colors animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards">
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
                          <button onClick={() => window.api?.invoke(CH.portsKill, p.pid).then(fetchSuggested)} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 text-[9px] font-mono font-bold tracking-widest rounded-md transition-all">
                            KILL
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] font-mono font-bold text-success bg-success/10 px-3 py-2 rounded-md border border-success/20">GUARDING</span>
                      )}
                    </div>
                  );
                })}
                </div>
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
              className="mt-3 px-4 py-3.5 bg-primary hover:bg-accent disabled:opacity-50 disabled:bg-surface3 disabled:text-muted disabled:border-border text-background border border-transparent rounded-lg text-[11px] font-bold tracking-widest font-mono transition-all shadow-[0_4px_15px_rgb(var(--primary)/0.25)] hover:shadow-[0_4px_20px_rgb(var(--primary)/0.4)] disabled:shadow-none"
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
            <EmptyState compact icon={Coffee} title="Nothing guarded right now" description="Guard a task above and your machine will stay awake exactly until it finishes — then you get notified." />
          )}
          {active.map(task => (
            <div key={task.id} className="relative flex justify-between items-center p-5 border border-primary/30 bg-primary/5 rounded-xl shadow-sm">
              <div className="flex items-center gap-5">
                <div className="relative mr-2 flex-shrink-0">
                  <div className="p-2.5 bg-background border border-border rounded-xl z-10 relative">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <span className="absolute -top-1 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full animate-ping z-20"></span>
                  <span className="absolute -top-1 -right-0.5 w-2.5 h-2.5 rounded-full z-20 bg-green-400"></span>
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="text-sm font-semibold text-text">{task.name || 'External Process'}</div>
                  <div className="text-[10px] font-mono text-muted mt-1 tracking-wide">PID: <span className="text-text2">{task.target}</span> • WAKE LOCK ACQUIRED</div>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end min-w-[120px]">
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
