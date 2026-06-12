import { useMemo } from 'react';
import { BrainCircuit, Activity, Box, HardDrive, GitMerge, FileArchive, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc } from '../lib/ipcCache';

export default function AIAuditorView() {
  // Both feeds come from the shared cache (15s here, and instantly reused from
  // Git Pulse / Session Guard which read the same channels).
  const reposState = useIpc(CH.gitGetRepos, [], { pollMs: 15000 });
  const procsState = useIpc(CH.devGetDevProcesses, [], { pollMs: 15000 });
  const loaded = reposState.data !== undefined && procsState.data !== undefined;

  const trackedRepos = useMemo(() => (reposState.data ?? []).map((r: any, i: number) => ({
    id: (r.path || i).toString(),
    name: r.name || 'Unknown',
    path: r.path || '',
    risk: Array.isArray(r.risk) ? r.risk : [],
    outOfSync: (r.pull || 0) > 0 || (r.push || 0) > 0,
    pull: r.pull || 0,
    push: r.push || 0
  })), [reposState.data]);

  const trackedBinaries = useMemo(() => (procsState.data ?? []).map((p: any, i: number) => ({
    id: (p.pid || i).toString(),
    name: p.name || 'Unknown Process',
    type: p.type || 'process',
    confidence: p.confidence || null
  })).slice(0, 10), [procsState.data]);

  // Live issues derived ONLY from real data (no fabricated metrics, no accumulation).
  const audits = useMemo(() => {
    const issues: any[] = [];
    trackedRepos.forEach((r: any) => {
      if (r.outOfSync) {
        issues.push({ key: `${r.id}:sync`, app: r.name, level: 'WARN', msg: `Out of sync with origin (${r.pull} behind, ${r.push} ahead).` });
      }
      r.risk.forEach((flag: string) => {
        issues.push({ key: `${r.id}:risk:${flag}`, app: r.name, level: 'CRITICAL', msg: flag });
      });
    });
    return issues;
  }, [trackedRepos]);

  return (
    <div className="p-8 pb-24 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-[0_0_20px_rgb(var(--primary)/0.15)]">
            <BrainCircuit className="w-6 h-6 text-primary"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">
              Inspector
              <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-widest uppercase">Repo &amp; Process</span>
            </h2>
            <p className="text-xs font-mono text-muted tracking-wide mt-1.5 uppercase">Unified repository &amp; dev-process telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Active monitoring
            </div>
            <p className="text-[9px] text-muted font-mono mt-1">Local only · no telemetry sent</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 flex flex-col gap-6">
          <div className="bg-surface/40 border border-border rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-5">
              <HardDrive className="w-4 h-4 text-primary" /> Tracked Repositories
            </h3>
            <div className="flex flex-col gap-3">
              {trackedRepos.length === 0 ? (
                <div className={`text-xs font-mono text-muted uppercase ${loaded ? '' : 'animate-pulse'}`}>{loaded ? 'No tracked repositories' : 'Scanning repositories...'}</div>
              ) : trackedRepos.map(repo => (
                <div key={repo.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 bg-background/50 border border-border rounded-lg gap-4">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[13px] font-bold text-text flex items-center gap-2">
                      <GitMerge className="w-3.5 h-3.5 text-muted"/> {repo.name}
                    </span>
                    <span className="text-[9px] font-mono text-muted truncate max-w-[280px]" title={repo.path}>{repo.path}</span>
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                    {repo.risk.length > 0 && (
                      <span className="text-[10px] font-mono px-2 py-1 bg-red-500/10 border border-red-500/20 text-red-400 font-bold rounded">
                        {repo.risk.length} RISK{repo.risk.length > 1 ? 'S' : ''}
                      </span>
                    )}
                    {repo.outOfSync ? (
                      <span className="text-[10px] font-mono px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold rounded">
                        OUT OF SYNC
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-1 bg-green-500/10 border border-green-500/20 text-green-400 font-bold rounded">
                        SYNCED
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface/40 border border-border rounded-xl p-6 shadow-sm flex-1">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-5">
              <Box className="w-4 h-4 text-primary" /> Detected Dev Processes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trackedBinaries.length === 0 ? (
                <div className="col-span-2 text-xs font-mono text-muted uppercase p-4 text-center border border-dashed border-border rounded-lg">No active dev processes</div>
              ) : trackedBinaries.map(bin => (
                <div key={bin.id} className="p-4 rounded-lg border bg-background/50 border-border relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-bold text-text flex items-center gap-2">
                      <FileArchive className="w-3.5 h-3.5 text-muted"/> {bin.name}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                    <span className="px-2 py-1 bg-surface2 rounded">PID {bin.id}</span>
                    {bin.confidence && (
                      <span className="px-2 py-1 bg-primary/10 border border-primary/20 text-primary rounded">{bin.confidence} dev</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl shadow-inner flex flex-col h-[600px] font-mono">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-text uppercase tracking-widest">Live Issues</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-4">
            {audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 h-full text-center text-muted">
                <CheckCircle2 className="w-8 h-8 text-green-500/70" />
                <span className="text-[11px] uppercase tracking-widest">No issues detected</span>
              </div>
            ) : audits.map((a) => (
              <div key={a.key} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                <div className="flex items-center justify-between text-[9px] text-muted">
                  <span>{a.app}</span>
                  <span className={`px-1.5 py-0.5 rounded uppercase font-bold flex items-center gap-1
                    ${a.level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-500'}`}>
                    {a.level === 'CRITICAL' && <AlertTriangle className="w-2.5 h-2.5" />}{a.level}
                  </span>
                </div>
                <div className={`text-[11px] leading-relaxed mt-1 ${a.level === 'CRITICAL' ? 'text-red-300' : 'text-text/80'}`}>
                  {a.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
