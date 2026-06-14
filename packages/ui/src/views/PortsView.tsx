import { useEffect, useState, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Search, Activity, Network } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import ViewHeader from '../components/ViewHeader';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';

// Status as a calm dot + sentence-case label — never a fixed-width pill that can
// overflow (the old "ESTABLISHED" spill). One accent: purple for our own
// listeners, a quiet green for live connections.
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  LISTENING: { label: 'Listening', dot: 'bg-primary', text: 'text-accent' },
  ESTABLISHED: { label: 'Established', dot: 'bg-success', text: 'text-muted2' },
};

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

  const FilterBtn = ({ k, lbl }: {k: string; lbl: string}) => (
    <button
      onClick={() => setFilter(k)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === k ? 'bg-surface3 text-text border border-border2' : 'text-muted hover:text-text2 hover:bg-surface2 border border-transparent'}`}
    >
      {lbl}
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      <div className="p-8 border-b border-border/50 flex flex-col gap-6 relative z-10">
        <ViewHeader
          icon={Network}
          title="Port Mapper"
          subtitle={`${ports.length} ports active`}
          accent="primary"
          actions={<>
            <button onClick={expandAll} className="px-3 py-2 text-xs font-medium text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">Expand all</button>
            <button onClick={collapseAll} className="px-3 py-2 text-xs font-medium text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">Collapse all</button>
            <button onClick={refresh} aria-label="Refresh ports" className="p-2 text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>}
        />
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full">
          <div className="flex flex-wrap md:flex-nowrap bg-surface/50 p-1 rounded-lg border border-border gap-1">
            <FilterBtn k="ALL" lbl="All" />
            <FilterBtn k="LISTEN" lbl="Listening" />
            <FilterBtn k="ESTAB" lbl="Established" />
            <FilterBtn k="UDP" lbl="UDP" />
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
          <div className="mb-4 p-4 bg-danger/10 border border-danger/20 rounded-xl text-xs text-danger flex items-center justify-between gap-3">
            <span>Failed to read ports — the native backend may be unavailable.</span>
            <button onClick={refresh} className="px-3 py-1.5 bg-danger/20 hover:bg-danger/30 text-danger rounded-md font-medium">Retry</button>
          </div>
        )}
        {Object.entries(grouped).map(([proc, prts]: any) => (
          <div key={proc} className="mb-3 border border-border rounded-xl overflow-hidden bg-surface/40 transition-colors">
            <div
              className="px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-surface2/60 transition-colors"
              onClick={() => toggleGroup(proc)}
            >
              <div className="flex items-center gap-2.5 text-sm font-medium text-text min-w-0">
                {expanded[proc] ? <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
                <span className="truncate">{proc}</span>
                <span className="text-[11px] font-mono text-muted bg-surface2 px-2 py-0.5 rounded-md ml-1 flex-shrink-0">{prts.length}</span>
              </div>
            </div>
            {expanded[proc] && (
              <div className="divide-y divide-border/40 border-t border-border/60">
                {prts.map((p: any, i: number) => {
                  const st = STATUS[p.state] || { label: p.state || p.proto, dot: 'bg-muted', text: 'text-muted2' };
                  const profile = detectProfile(p.port);

                  return (
                    <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-surface2/40 transition-colors group">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-sm font-medium text-text flex-shrink-0">:{p.port}</span>
                        <span className={`text-[11px] flex-shrink-0 ${st.text}`}>{st.label}</span>
                        <span className="text-[11px] font-mono text-muted truncate select-all">{p.local}</span>
                        {profile && (
                          <span className="text-[10px] font-mono text-accent bg-primary/10 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">{profile}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="text-[11px] font-mono text-muted whitespace-nowrap hidden sm:inline">PID {p.pid}{p.ram ? ` · ${p.ram}` : ''}</span>
                        <button onClick={() => setConfirmPid(p.pid)} aria-label={`Free port ${p.port} by killing PID ${p.pid}`} className="text-[11px] font-medium text-muted2 border border-border rounded-md px-3 py-1.5 hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-colors flex-shrink-0">
                          Free
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
             <p className="text-sm">No ports match this filter.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirmPid}
        title="Free this port?"
        message={`This will force-terminate PID ${confirmPid} and free its port.`}
        confirmLabel="Free port"
        onConfirm={() => confirmPid && doKill(confirmPid)}
        onCancel={() => setConfirmPid(null)}
      />
    </div>
  );
}
