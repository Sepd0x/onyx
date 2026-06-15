import { useEffect, useState, useRef } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, Search, Activity, Network, Cpu, ArrowRight, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import ViewHeader from '../components/ViewHeader';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';

// State → calm dot + sentence-case label. One accent: purple for our own
// listeners, quiet green for live connections, amber for waiting/closing.
const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  LISTENING: { label: 'Listening', dot: 'bg-primary', text: 'text-accent' },
  ESTABLISHED: { label: 'Established', dot: 'bg-success', text: 'text-success' },
  TIME_WAIT: { label: 'Time wait', dot: 'bg-warning', text: 'text-warning' },
  CLOSE_WAIT: { label: 'Close wait', dot: 'bg-warning', text: 'text-warning' },
  SYN_SENT: { label: 'Connecting', dot: 'bg-warning', text: 'text-warning' },
  UDP: { label: 'UDP', dot: 'bg-info', text: 'text-info' },
};

// Well-known dev/service ports → a friendly label.
const SERVICES: Record<string, string> = {
  '3000': 'React/Next', '3001': 'Node', '4000': 'Node', '4200': 'Angular', '5000': 'Flask/.NET',
  '5173': 'Vite', '6006': 'Storybook', '8000': 'Django/HTTP', '8080': 'HTTP alt', '8081': 'Metro/RN',
  '8443': 'HTTPS alt', '9000': 'PHP-FPM', '9229': 'Node debug', '27017': 'MongoDB', '5432': 'PostgreSQL',
  '3306': 'MySQL', '6379': 'Redis', '5672': 'RabbitMQ', '9200': 'Elasticsearch', '11211': 'Memcached',
  '1433': 'SQL Server', '80': 'HTTP', '443': 'HTTPS', '22': 'SSH', '21': 'FTP', '53': 'DNS', '3389': 'RDP', '25': 'SMTP',
};

// A "real" remote peer (skip the wildcard/zero addresses netstat prints for listeners).
const hasRemote = (r?: string) => !!r && !/(^\*:\*$)|(:0$)|(\[::\]:0$)/.test(r) && r !== '0.0.0.0:0';

export default function PortsView() {
  const { data, loading, error } = useIpc(CH.portsGet, [], { pollMs: 5000 });
  const ports: any[] = data ?? [];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const initialLoadDone = useRef(false);
  const [confirm, setConfirm] = useState<{ pid: string; name: string; count: number } | null>(null);

  const filteredPorts = ports.filter((p) => {
    if (filter === 'LISTEN' && p.state !== 'LISTENING') return false;
    if (filter === 'ESTAB' && p.state !== 'ESTABLISHED') return false;
    if (filter === 'UDP' && p.proto !== 'UDP') return false;
    if (search) {
      const q = search.toLowerCase();
      return (p.process || '').toLowerCase().includes(q) || p.port.includes(q) || (p.local || '').includes(q) || (p.remote || '').includes(q);
    }
    return true;
  });

  // Group by PID (one OS process per group), keeping the owning-process detail.
  const groups: Record<string, any> = {};
  for (const p of filteredPorts) {
    const key = p.pid || 'system';
    if (!groups[key]) groups[key] = { key, pid: p.pid, name: p.process || 'system', ram: p.ram, path: p.path, ppid: p.ppid, ports: [] };
    groups[key].ports.push(p);
  }
  const groupList = Object.values(groups).sort((a: any, b: any) => {
    const la = a.ports.some((x: any) => x.state === 'LISTENING') ? 1 : 0;
    const lb = b.ports.some((x: any) => x.state === 'LISTENING') ? 1 : 0;
    return lb - la || a.name.localeCompare(b.name);
  });

  const stats = {
    total: ports.length,
    listening: ports.filter((p) => p.state === 'LISTENING').length,
    established: ports.filter((p) => p.state === 'ESTABLISHED').length,
    processes: new Set(ports.map((p) => p.pid)).size,
  };

  useEffect(() => {
    if (!initialLoadDone.current && ports.length) {
      const init: any = {};
      ports.forEach((p: any) => (init[p.pid || 'system'] = true));
      setExpanded(init);
      initialLoadDone.current = true;
    }
  }, [ports]);

  const refresh = () => invalidate('ports:');
  const toggleGroup = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));
  const expandAll = () => { const next: any = {}; groupList.forEach((g: any) => (next[g.key] = true)); setExpanded(next); };
  const collapseAll = () => setExpanded({});

  const doKill = async (pid: string) => {
    setConfirm(null);
    if (window.api) {
      try { await window.api.invoke(CH.portsKill, pid); } catch (e) {}
      invalidate('ports:');
    }
  };

  const FilterBtn = ({ k, lbl }: { k: string; lbl: string }) => (
    <button
      onClick={() => setFilter(k)}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === k ? 'bg-surface3 text-text border border-border2' : 'text-muted hover:text-text2 hover:bg-surface2 border border-transparent'}`}
    >
      {lbl}
    </button>
  );

  const Stat = ({ label, value, accent }: { label: string; value: number; accent?: string }) => (
    <div className="flex-1 bg-surface/50 border border-border rounded-lg px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted">{label}</span>
      <span className={`text-xl font-mono font-semibold ${accent || 'text-text2'}`}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent relative overflow-hidden">
      <div className="p-8 border-b border-border/50 flex flex-col gap-6 relative z-10">
        <ViewHeader
          icon={Network}
          title="Port Mapper"
          subtitle={`${stats.total} ports · ${stats.processes} processes`}
          accent="primary"
          actions={<>
            <button onClick={expandAll} className="px-3 py-2 text-xs font-medium text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">Expand all</button>
            <button onClick={collapseAll} className="px-3 py-2 text-xs font-medium text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">Collapse all</button>
            <button onClick={refresh} aria-label="Refresh ports" className="p-2 text-muted2 hover:text-text border border-border rounded-lg transition-colors hover:bg-surface2">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>}
        />

        <div className="flex gap-3">
          <Stat label="Total" value={stats.total} />
          <Stat label="Listening" value={stats.listening} accent="text-accent" />
          <Stat label="Established" value={stats.established} accent="text-success" />
          <Stat label="Processes" value={stats.processes} />
        </div>

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
              placeholder="Filter by port, process, address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
        {groupList.map((g: any) => {
          const listening = g.ports.filter((p: any) => p.state === 'LISTENING').length;
          return (
            <div key={g.key} className="mb-3 border border-border rounded-xl overflow-hidden bg-surface/40 transition-colors">
              <div className="px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-surface2/60 transition-colors group" onClick={() => toggleGroup(g.key)}>
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {expanded[g.key] ? <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
                  <div className="p-1.5 rounded-lg bg-surface2 border border-border flex-shrink-0"><Cpu className="w-3.5 h-3.5 text-accent" /></div>
                  <div className="min-w-0 flex flex-col">
                    <span className="text-sm font-medium text-text truncate flex items-center gap-2">
                      {g.name}
                      <span className="text-[10px] font-mono text-muted2 bg-surface2 px-1.5 py-0.5 rounded flex-shrink-0">{g.ports.length} port{g.ports.length > 1 ? 's' : ''}</span>
                    </span>
                    {g.path && <span className="text-[10px] font-mono text-muted truncate" title={g.path}>{g.path}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] font-mono text-muted hidden sm:flex flex-col items-end leading-tight">
                    <span>PID {g.pid}{g.ppid ? ` · ppid ${g.ppid}` : ''}</span>
                    {g.ram && <span className="text-muted2">{g.ram}</span>}
                  </span>
                  {/^[0-9]+$/.test(g.pid) && g.pid !== '4' && g.pid !== '0' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirm({ pid: g.pid, name: g.name, count: g.ports.length }); }}
                      aria-label={`Kill ${g.name} (PID ${g.pid})`}
                      className="opacity-0 group-hover:opacity-100 text-[11px] font-medium text-muted2 border border-border rounded-md px-3 py-1.5 hover:text-danger hover:border-danger/40 hover:bg-danger/10 transition-all inline-flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Kill
                    </button>
                  )}
                </div>
              </div>
              {expanded[g.key] && (
                <div className="divide-y divide-border/40 border-t border-border/60">
                  {g.ports.map((p: any, i: number) => {
                    const st = STATUS[p.state] || { label: p.state || p.proto, dot: 'bg-muted', text: 'text-muted2' };
                    const service = SERVICES[p.port];
                    return (
                      <div key={i} className="px-5 py-3 flex items-center gap-4 hover:bg-surface2/40 transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${p.proto === 'UDP' ? 'bg-info/10 text-info' : 'bg-primary/10 text-accent'}`}>{p.proto}</span>
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="font-mono text-sm font-medium text-text flex-shrink-0">:{p.port}</span>
                          <span className={`text-[11px] flex-shrink-0 ${st.text}`}>{st.label}</span>
                          {service && <span className="text-[10px] font-mono text-accent bg-primary/10 px-2 py-0.5 rounded flex-shrink-0 whitespace-nowrap">{service}</span>}
                          {p.ipv6 && <span className="text-[9px] font-mono text-muted2 border border-border rounded px-1 flex-shrink-0">IPv6</span>}
                          {hasRemote(p.remote) && (
                            <span className="text-[10px] font-mono text-muted truncate inline-flex items-center gap-1 select-all">
                              <ArrowRight className="w-3 h-3 flex-shrink-0" /> {p.remote}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-muted whitespace-nowrap hidden sm:inline select-all">{p.local}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {groupList.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-muted gap-4">
            <Activity className="w-10 h-10 opacity-20" />
            <p className="text-sm">No ports match this filter.</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!confirm}
        title="Kill this process?"
        message={confirm ? `Force-terminate ${confirm.name} (PID ${confirm.pid}) and free its ${confirm.count} port${confirm.count > 1 ? 's' : ''}.` : ''}
        confirmLabel="Kill process"
        onConfirm={() => confirm && doKill(confirm.pid)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
