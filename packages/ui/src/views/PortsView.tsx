import { useEffect, useState, useRef } from 'react';
import { RefreshCw, Trash2, ChevronDown, ChevronRight, Search, Activity, Network, BoxSelect } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';

export default function PortsView() {
  const { data, loading, error } = useIpc(CH.portsGet, [], { pollMs: 5000 });
  const ports: any[] = data ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const initialLoadDone = useRef(false);
  const [confirmPid, setConfirmPid] = useState<string | null>(null);

  // Expand every process group on the first successful load.
  useEffect(() => {
    if (!initialLoadDone.current && ports.length) {
      const initialExp: any = {};
      ports.forEach((p: any) => (initialExp[p.process || 'system'] = true));
      setExpanded(initialExp);
      initialLoadDone.current = true;
    }
  }, [ports]);

  const refresh = () => invalidate('ports:');

  const toggleGroup = (proc: string) => setExpanded(p => ({ ...p, [proc]: !p[proc] }));
  const expandAll = () => { const next: any = {}; Object.keys(grouped).forEach(k => next[k] = true); setExpanded(next); };
  const collapseAll = () => setExpanded({});

  const doKill = async (pid: string) => {
    setConfirmPid(null);
    if (window.api) {
      try { await window.api.invoke(CH.portsKill, pid); } catch (e) {}
      invalidate('ports:');
    }
  };

  const filteredPorts = ports.filter(p => {
    if (filter === 'LISTEN' && p.state !== 'LISTENING') return false;
    if (filter === 'ESTAB' && p.state !== 'ESTABLISHED') return false;
    if (filter === 'UDP' && p.proto !== 'UDP') return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.process || '').toLowerCase().includes(q) || p.port.includes(q) || p.local.includes(q);
    }
    return true;
  });

  const grouped = filteredPorts.reduce((acc: any, p: any) => {
    const proc = p.process || 'system';
    (acc[proc] = acc[proc] || []).push(p);
    return acc;
  }, {});

  const detectProfile = (port: string) => {
    if (port === '3000' || port === '3001') return 'React/Next';
    if (port === '5173') return 'Vite';
    if (port === '5432') return 'PostgreSQL';
    if (port === '6379') return 'Redis';
    if (port === '27017') return 'MongoDB';
    if (port === '8080') return 'Java/Tomcat';
    return null;
  };

  const FilterBtn = ({ lbl }: {lbl: string}) => (
    <button 
      onClick={() => setFilter(lbl)}
      className={`px-4 py-1.5 text-[10px] font-mono font-bold tracking-widest rounded-md transition-colors ${filter === lbl ? 'bg-primary text-background shadow-[0_0_10px_rgba(139,92,246,0.3)]' : 'text-muted hover:text-text2 hover:bg-surface2'}`}
    >
      {lbl}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      <div className="p-8 border-b border-border/50 flex flex-col gap-6 relative z-10 bg-background/50 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-lg"><Network className="w-5 h-5"/></div>
            <div>
              <h2 className="text-xl font-semibold text-text tracking-tight">Port Mapper</h2>
              <p className="text-[10px] font-mono text-muted tracking-wide mt-1.5">{ports.length} TOTAL PORTS ACTIVE</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={expandAll} className="px-4 py-2 text-[10px] font-mono font-bold tracking-widest text-muted2 hover:text-text bg-surface/50 border border-border rounded-lg transition-all hover:bg-surface2">EXPAND ALL</button>
            <button onClick={collapseAll} className="px-4 py-2 text-[10px] font-mono font-bold tracking-widest text-muted2 hover:text-text bg-surface/50 border border-border rounded-lg transition-all hover:bg-surface2">COLLAPSE ALL</button>
            <button onClick={refresh} className="px-4 py-2 text-[10px] font-mono font-bold tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-lg transition-all hover:bg-primary/20 flex items-center gap-2">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              REFRESH
            </button>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
          <div className="flex flex-wrap md:flex-nowrap bg-surface/50 p-1 rounded-lg border border-border shadow-inner gap-1">
            <FilterBtn lbl="ALL" />
            <FilterBtn lbl="LISTEN" />
            <FilterBtn lbl="ESTAB" />
            <FilterBtn lbl="UDP" />
          </div>
          <div className="flex-1 relative w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input 
              type="text" 
              placeholder="Filter by port, process, or protocol..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-surface/50 border border-border rounded-lg pl-10 pr-4 py-2.5 text-xs font-mono text-text focus:outline-none focus:border-primary/50 transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-8 relative z-10 pb-24">
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] font-mono text-red-300 flex items-center justify-between gap-3">
            <span>Failed to read ports — the native backend may be unavailable.</span>
            <button onClick={refresh} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-md tracking-widest">RETRY</button>
          </div>
        )}
        {Object.entries(grouped).map(([proc, prts]: any) => (
          <div key={proc} className="mb-4 border border-border/80 rounded-xl overflow-hidden bg-surface/40 backdrop-blur-sm shadow-sm hover:border-border transition-colors">
            <div 
              className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-surface2/80 transition-colors border-b border-border/40"
              onClick={() => toggleGroup(proc)}
            >
              <div className="flex items-center gap-3 text-sm font-semibold text-text tracking-tight">
                {expanded[proc] ? <ChevronDown className="w-5 h-5 text-muted" /> : <ChevronRight className="w-5 h-5 text-muted" />}
                {proc.toUpperCase()} 
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded ml-2">{prts.length} TICKETS</span>
              </div>
            </div>
            {expanded[proc] && (
              <div className="divide-y divide-border/40 bg-background/50">
                {prts.map((p: any, i: number) => {
                  const isListen = p.state === 'LISTENING';
                  const isEstab = p.state === 'ESTABLISHED';
                  const badgeCls = isListen ? 'text-green-400 bg-green-400/10 border-green-400/20' : isEstab ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' : 'text-amber-400 bg-amber-400/10 border-amber-400/20';
                  const profile = detectProfile(p.port);
                  
                  return (
                    <div key={i} className="px-5 py-4 flex flex-col md:flex-row items-start md:items-center justify-between text-sm hover:bg-surface2/50 transition-colors group gap-4">
                      <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0 overflow-x-auto no-scrollbar">
                        <div className="w-16 font-mono text-sm font-bold text-text flex-shrink-0">:{p.port}</div>
                        <div className={`w-[72px] text-[9px] font-mono font-bold tracking-widest px-1 py-1 text-center rounded border ${badgeCls} flex-shrink-0`}>
                          {p.state || p.proto}
                        </div>
                        <div className="w-28 md:w-36 text-[10px] font-mono text-muted truncate flex-shrink-0 select-all">{p.local}</div>
                        {profile && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary bg-primary/5 px-2 py-1 rounded border border-primary/10 whitespace-nowrap flex-shrink-0">
                            <BoxSelect className="w-3 h-3"/> {profile}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6 flex-shrink-0 mt-2 md:mt-0">
                        <div className="flex flex-col items-start md:items-end whitespace-nowrap">
                           <span className="text-[10px] font-mono text-muted">PID: {p.pid}</span>
                           <span className="text-[9px] font-mono text-muted/60 mt-0.5">Mem: {p.ram || '~'} | CPU: {p.cpu || '~'}</span>
                        </div>
                        <button onClick={() => setConfirmPid(p.pid)} aria-label={`Free port ${p.port} by killing PID ${p.pid}`} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-[10px] font-mono font-bold tracking-widest text-[#000000] bg-red-400 hover:bg-red-500 px-4 py-2 rounded shadow-[0_0_10px_rgba(248,113,113,0.3)] transition-all whitespace-nowrap flex-shrink-0 flex items-center justify-center">
                          FREE PORT
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
             <Activity className="w-10 h-10 opacity-20" />
             <p className="text-[11px] font-mono tracking-widest">NO PORTS MATCHING FILTER</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmPid}
        title="Kill process?"
        message={`This will force-terminate PID ${confirmPid} and free its port.`}
        confirmLabel="FREE PORT"
        onConfirm={() => confirmPid && doKill(confirmPid)}
        onCancel={() => setConfirmPid(null)}
      />
    </div>
  );
}
