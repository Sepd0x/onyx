import { useMemo } from 'react';
import { BrainCircuit, Activity, Box, HardDrive, GitMerge, FileArchive, AlertTriangle, CheckCircle2, ScrollText } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc } from '../lib/ipcCache';
import ViewHeader from '../components/ViewHeader';
import Skeleton from '../components/Skeleton';
import AiPanel from '../components/AiPanel';

export default function AIAuditorView() {
  // Both feeds come from the shared cache (15s here, and instantly reused from
  // Git Pulse / Session Guard which read the same channels).
  const reposState = useIpc(CH.gitGetRepos, [], { pollMs: 15000 });
  const procsState = useIpc(CH.devGetDevProcesses, [], { pollMs: 15000 });
  const loaded = reposState.data !== undefined && procsState.data !== undefined;
  // Status only (no poll); AI calls are explicit, never wired into the feeds above.
  const aiStatus = useIpc(CH.aiGetStatus, [], { pollMs: 0 }).data as any;
  const aiConfigured = aiStatus?.configured ?? false;
  const aiProvider = aiStatus?.provider;

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
      <div className="mb-10">
        <ViewHeader
          icon={BrainCircuit}
          title="Inspector"
          subtitle="Unified repository & dev-process telemetry"
          badge={<span className="bg-surface2 text-muted2 border border-border px-2 py-0.5 rounded-md text-[10px] font-mono">Repo &amp; process</span>}
          actions={
            <div className="flex flex-col items-end gap-1">
              <div className="text-[11px] text-muted2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                Active monitoring
              </div>
              <p className="text-[10px] text-muted">Local only · no telemetry sent</p>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AiPanel
          title="Repository briefing"
          description="A prioritized, plain-English read on your tracked repos & running dev processes."
          cta="Generate"
          configured={aiConfigured}
          provider={aiProvider}
          run={async () => (await window.api?.invoke(CH.aiInsights, {
            repos: (reposState.data ?? []).map((r: any) => ({ name: r.name, branch: r.branch, dirty: r.dirty, pull: r.pull, push: r.push, risk: r.risk, ready: r.ready })),
            processes: trackedBinaries.map((b) => ({ name: b.name, type: b.type, confidence: b.confidence })),
          })) ?? { error: 'failed' }}
        />
        <AiPanel
          title="Log triage"
          icon={ScrollText}
          description="Scan today's app log for errors, likely causes and quick fixes."
          cta="Analyse"
          configured={aiConfigured}
          provider={aiProvider}
          run={async () => (await window.api?.invoke(CH.aiAnalyzeLogs)) ?? { error: 'failed' }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 flex flex-col gap-6">
          <div className="panel p-6">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-5">
              <HardDrive className="w-4 h-4 text-accent" /> Tracked repositories
            </h3>
            <div className="flex flex-col gap-3">
              {!loaded ? (
                <><Skeleton className="h-[68px]" /><Skeleton className="h-[68px]" /></>
              ) : trackedRepos.length === 0 ? (
                <div className="text-sm text-muted p-4 text-center border border-dashed border-border rounded-lg">No tracked repositories</div>
              ) : trackedRepos.map((repo, i) => (
                <div key={repo.id} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} className="flex flex-col md:flex-row justify-between md:items-center p-4 bg-background/50 border border-border rounded-lg gap-4 card-lift animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-[13px] font-medium text-text flex items-center gap-2">
                      <GitMerge className="w-3.5 h-3.5 text-muted"/> {repo.name}
                    </span>
                    <span className="text-[10px] font-mono text-muted truncate max-w-[280px]" title={repo.path}>{repo.path}</span>
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-2 text-[11px]">
                    {repo.risk.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10 text-warning">
                        <AlertTriangle className="w-3 h-3"/> {repo.risk.length} risk{repo.risk.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {repo.outOfSync ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10 text-warning">Out of sync</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface2 text-muted2"><CheckCircle2 className="w-3 h-3 text-success"/> Synced</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6 flex-1">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-5">
              <Box className="w-4 h-4 text-accent" /> Detected dev processes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!loaded ? (
                <><Skeleton className="h-[84px]" /><Skeleton className="h-[84px]" /></>
              ) : trackedBinaries.length === 0 ? (
                <div className="col-span-2 text-sm text-muted p-4 text-center border border-dashed border-border rounded-lg">No active dev processes</div>
              ) : trackedBinaries.map((bin, i) => (
                <div key={bin.id} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} className="p-4 rounded-lg border bg-background/50 border-border relative overflow-hidden card-lift animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-sm font-medium text-text flex items-center gap-2 min-w-0">
                      <FileArchive className="w-3.5 h-3.5 text-muted shrink-0"/> <span className="truncate">{bin.name}</span>
                    </span>
                    <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                    <span className="px-2 py-1 bg-surface2 rounded">PID {bin.id}</span>
                    {bin.confidence && (
                      <span className="px-2 py-1 bg-primary/10 border border-primary/20 text-accent rounded">{bin.confidence} dev</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel shadow-inner flex flex-col h-[600px] font-mono overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
            <Activity className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-text">Live issues</span>
            {audits.length > 0 && <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full bg-danger/15 text-danger">{audits.length}</span>}
          </div>
          <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-4">
            {audits.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 h-full text-center text-muted">
                <CheckCircle2 className="w-8 h-8 text-success/70" />
                <span className="text-sm">No issues detected</span>
              </div>
            ) : audits.map((a, i) => (
              <div key={a.key} style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0 animate-in fade-in slide-in-from-right-1 fill-mode-backwards">
                <div className="flex items-center justify-between text-[9px] text-muted">
                  <span>{a.app}</span>
                  <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-1
                    ${a.level === 'CRITICAL' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>
                    {a.level === 'CRITICAL' && <AlertTriangle className="w-2.5 h-2.5" />}{a.level === 'CRITICAL' ? 'Critical' : 'Warning'}
                  </span>
                </div>
                <div className={`text-[11px] leading-relaxed mt-1 ${a.level === 'CRITICAL' ? 'text-danger/90' : 'text-text/80'}`}>
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
