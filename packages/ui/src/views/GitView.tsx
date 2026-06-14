import { useEffect, useState } from 'react';
import { Plus, FolderGit2, Trash2, Search, AlertTriangle, CheckCircle2, Wand2, HardDrive, Cpu, X, GitCommit, FolderSearch, FolderPlus } from 'lucide-react';
import { CH, EV } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import Sparkline from '../components/Sparkline';
import ViewHeader from '../components/ViewHeader';

export default function GitView() {
  // No background poll (repo health is expensive); served from cache instantly on
  // tab switch, revalidated when stale or after a mutation via invalidate('git:').
  // Repo health is expensive; served from cache instantly on return, and kept
  // fresh for a minute so a quick out-and-back never re-scans (no loading flash).
  const repos: any[] = useIpc(CH.gitGetRepos, [], { pollMs: 0, ttlMs: 60000 }).data ?? [];
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number; found: number } | null>(null);
  const [scanRoots, setScanRoots] = useState<string[]>([]);
  const [showRoots, setShowRoots] = useState(false);
  const [query, setQuery] = useState('');
  const [aiModal, setAiModal] = useState<any>(null); // { path: string, msg: string, loading: boolean }
  const [ghModal, setGhModal] = useState<any>(null); // { url, token, loading, error }
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiModal.msg);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setAiModal(null);
    }, 1000);
  };

  const add = async () => { if (window.api) { await window.api.invoke(CH.gitAddRepo); invalidate('git:'); } };

  const addRemote = async () => {
    setGhModal({ ...ghModal, loading: true, error: '' });
    if (window.api) {
        const res = await window.api.invoke(CH.gitAddGithubRepo, ghModal.url, ghModal.token);
        if (res.error) setGhModal({ ...ghModal, loading: false, error: res.error });
        else { setGhModal(null); invalidate('git:'); }
    }
  };

  const loadRoots = async () => {
    if (window.api) setScanRoots((await window.api.invoke<string[]>(CH.gitGetScanRoots)) || []);
  };

  const autoScan = async () => {
    if (!window.api) return;
    setScanning(true);
    setScanProgress({ scanned: 0, found: 0 });
    const unsub = window.api.on(EV.gitScanProgress, (p: any) => setScanProgress({ scanned: p.scanned, found: p.found }));
    try {
      const res = await window.api.invoke<any>(CH.gitAutoScan);
      invalidate('git:');
      if (res?.found) setScanProgress({ scanned: res.scanned, found: res.found.length });
    } finally {
      if (typeof unsub === 'function') unsub();
      setScanning(false);
    }
  };

  const addRoot = async () => {
    if (window.api) {
      const res = await window.api.invoke<any>(CH.gitAddScanRoot);
      if (res?.scanRoots) setScanRoots(res.scanRoots);
    }
  };

  const removeRoot = async (root: string) => {
    if (window.api) {
      const res = await window.api.invoke<any>(CH.gitRemoveScanRoot, root);
      if (res?.scanRoots) setScanRoots(res.scanRoots);
    }
  };

  const removeRepo = async (path: string) => { if (window.api) { await window.api.invoke(CH.gitRemoveRepo, path); invalidate('git:'); } };

  const openAi = async (path: string) => {
    setAiModal({ path, msg: '', loading: true });
    if (window.api) {
       const msg = await window.api.invoke(CH.gitGenerateCommit, path);
       setAiModal({ path, msg, loading: false });
    }
  };

  useEffect(() => { loadRoots(); }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? repos.filter((r: any) => `${r.name} ${r.path} ${r.branch}`.toLowerCase().includes(q)) : repos;

  return (
    <div className="h-full flex flex-col bg-transparent relative">
      <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-border/60 z-20 bg-background/50 backdrop-blur-sm">
        <ViewHeader
          icon={FolderGit2}
          title="Git Pulse"
          subtitle="Repository health & AI assistant"
          actions={<>
            {scanning && scanProgress && (
              <span className="text-[10px] font-mono text-muted tracking-wide whitespace-nowrap mr-1">
                {scanProgress.scanned} scanned · {scanProgress.found} found
              </span>
            )}
            <button onClick={() => setShowRoots(s => !s)} className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors flex items-center gap-2 ${showRoots ? 'bg-surface3 text-text border-border2' : 'text-muted2 border-border hover:text-text hover:bg-surface2'}`} title="Configure folders scanned for repositories">
              <FolderSearch className="w-4 h-4"/> Scan roots
            </button>
            <button onClick={autoScan} disabled={scanning} className="px-3 py-2 text-xs font-medium text-muted2 border border-border rounded-lg hover:text-text hover:bg-surface2 transition-colors flex items-center gap-2 disabled:opacity-50">
              {scanning ? <Search className="w-4 h-4 animate-pulse"/> : <HardDrive className="w-4 h-4"/>}
              {scanning ? 'Scanning…' : 'Auto scan'}
            </button>
            <button onClick={() => setGhModal({ url: '', token: '', loading: false, error: '' })} className="px-3 py-2 text-xs font-medium text-muted2 border border-border rounded-lg hover:text-text hover:bg-surface2 transition-colors flex items-center gap-2">
              GitHub import
            </button>
            <button onClick={add} className="px-3 py-2 bg-primary/15 text-accent text-xs font-medium rounded-lg border border-primary/25 hover:bg-primary/25 transition-colors flex items-center gap-2">
              <Plus className="w-4 h-4"/> Add
            </button>
          </>}
        />

        {showRoots && (
          <div className="mt-4 bg-surface/60 border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted2">Scan roots</span>
              <button onClick={addRoot} className="px-3 py-1.5 text-xs font-medium text-muted2 rounded-lg border border-border hover:text-text hover:bg-surface2 transition-colors flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5"/> Add folder
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {scanRoots.length === 0 ? (
                <span className="text-[10px] font-mono text-muted/70">No roots configured.</span>
              ) : scanRoots.map((root) => (
                <div key={root} className="flex items-center justify-between gap-2 bg-background/60 border border-border/50 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-mono text-text2 truncate" title={root}>{root}</span>
                  <button onClick={() => removeRoot(root)} className="p-1 text-muted hover:text-danger hover:bg-danger/10 rounded transition-all flex-shrink-0" title="Remove root">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-6 no-scrollbar pb-24">
        {repos.length > 0 && (
          <div className="mb-6 relative max-w-sm">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories by name…"
              className="w-full bg-surface/60 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-text placeholder:text-muted focus:outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filtered.map((r: any, i) => {
          const hasRisk = r.risk && r.risk.length > 0;
          return (
            <div key={i} className={`bg-surface/50 border ${r.commitWarning ? 'border-warning/30' : 'border-border'} rounded-xl p-6 card-lift relative overflow-hidden group flex flex-col gap-5`}>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-text tracking-tight truncate">{r.name}</h3>
                  <p className="text-[10px] font-mono text-muted mt-1.5 truncate" title={r.path}>{r.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => removeRepo(r.path)}
                    title="Remove tracking"
                    aria-label={`Remove ${r.name} from tracking`}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="text-[11px] font-mono px-2.5 py-1 bg-surface2 border border-border rounded-md text-muted2 flex items-center gap-1.5 max-w-[150px]">
                    <GitCommit className="w-3 h-3 flex-shrink-0"/> <span className="truncate" title={r.branch}>{r.branch}</span>
                  </div>
                </div>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="bg-background/60 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted text-[10px]">Modified</span>
                  <span className={`text-base font-mono font-medium ${r.dirty > 0 ? 'text-warning' : 'text-text2'}`}>{r.dirty}</span>
                </div>
                <div className="bg-background/60 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted text-[10px]">Pull</span>
                  <span className={`text-base font-mono font-medium ${r.pull > 0 ? 'text-text2' : 'text-muted'}`}>{r.pull}</span>
                </div>
                <div className="bg-background/60 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted text-[10px]">Push</span>
                  <span className={`text-base font-mono font-medium ${r.push > 0 ? 'text-accent' : 'text-muted'}`}>{r.push}</span>
                </div>
              </div>

              {/* Risk & Health Indicators */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {r.syncStatus === 'Outdated' ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-warning/10 text-warning">
                       <AlertTriangle className="w-3.5 h-3.5"/> Behind remote
                     </span>
                  ) : hasRisk ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-warning/10 text-warning">
                       <AlertTriangle className="w-3.5 h-3.5"/> {r.risk[0]}
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface2 text-muted2">
                       <CheckCircle2 className="w-3.5 h-3.5 text-success"/> Secure
                     </span>
                  )}
                  {r.ready ? (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface2 text-muted2">
                       <CheckCircle2 className="w-3.5 h-3.5 text-success"/> Docs ready
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-surface2 text-muted">
                       <AlertTriangle className="w-3.5 h-3.5"/> Docs missing
                     </span>
                  )}
                </div>
                
                {r.commitWarning && (
                  <div className="bg-warning/5 border border-warning/20 text-warning p-3 rounded-lg flex items-start gap-2.5 text-[10px] font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                    <span className="leading-relaxed whitespace-pre-wrap">{r.commitWarning}</span>
                  </div>
                )}
              </div>

              {/* Activity & AI */}
              <div className="flex justify-between items-end mt-2">
                 <div className="flex-1 pr-6 flex flex-col gap-2.5">
                   <span className="text-[10px] text-muted">14-day activity</span>
                   <Sparkline data={r.activity || new Array(14).fill(0)} />
                 </div>
                 <button 
                  onClick={() => openAi(r.path)}
                  className="flex-shrink-0 w-10 h-10 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-sm" title="Suggest commit message">
                   <Wand2 className="w-4 h-4"/>
                 </button>
              </div>
              
            </div>
          );
        })}
        {repos.length === 0 && !scanning && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-muted gap-5 border border-dashed border-border rounded-xl bg-surface/30">
            <FolderGit2 className="w-12 h-12 opacity-20" />
            <p className="text-sm">No repositories tracked yet.</p>
          </div>
        )}
        {repos.length > 0 && filtered.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted gap-3">
            <Search className="w-8 h-8 opacity-20" />
            <p className="text-sm">No repositories match "{query.trim()}".</p>
          </div>
        )}
        </div>
      </div>

      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-surface border border-border2 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 no-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-3"><Cpu className="w-5 h-5 text-accent"/> Commit message helper</h3>
              <button onClick={() => setAiModal(null)} className="p-2 text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="bg-background border border-border rounded-xl p-5 mb-6 min-h-[140px] flex items-center justify-center shadow-inner flex-shrink-0">
              {aiModal.loading ? (
                <div className="flex flex-col items-center gap-4 text-primary">
                  <Wand2 className="w-6 h-6 animate-pulse"/>
                  <span className="text-xs animate-pulse">Analysing git diff…</span>
                </div>
              ) : (
                <div className="text-sm font-mono text-text w-full">
                  <p className="text-muted text-[11px] mb-3">Suggested message</p>
                  <div className="p-4 bg-background border border-border2 rounded-xl text-text2 shadow-inner" style={{ userSelect: 'all' }}>
                    {aiModal.msg}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
               <button onClick={() => setAiModal(null)} className="px-4 py-2.5 text-xs font-medium bg-surface2 hover:bg-surface3 border border-border rounded-lg transition-colors text-text2">Close</button>
               {!aiModal.loading && (
                 <button onClick={handleCopy} className={`px-4 py-2.5 text-xs font-medium rounded-lg border transition-colors ${copied ? 'bg-success/20 text-success border-success/30' : 'bg-primary/15 text-accent border-primary/25 hover:bg-primary/25'}`}>{copied ? 'Copied!' : 'Copy'}</button>
               )}
            </div>
          </div>
        </div>
      )}

      {ghModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-surface border border-border2 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-5">
            <div className="flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-3">Import from GitHub</h3>
              <button onClick={() => setGhModal(null)} className="p-2 text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex flex-col gap-4">
               {ghModal.error && (
                 <div className="text-[10px] font-mono text-danger bg-danger/10 border border-danger/20 px-3 py-2 rounded-md">
                   {ghModal.error}
                 </div>
               )}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Repository URL</label>
                  <input type="text" placeholder="https://github.com/user/repo" value={ghModal.url} onChange={e => setGhModal({...ghModal, url: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none w-full"/>
               </div>
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Personal Access Token (PAT) <span className="text-[10px] opacity-70 ml-2">Encrypted at rest</span></label>
                  <input type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" value={ghModal.token} onChange={e => setGhModal({...ghModal, token: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none w-full"/>
               </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
               <button onClick={() => setGhModal(null)} className="px-4 py-2.5 text-xs font-medium bg-surface2 hover:bg-surface3 border border-border rounded-lg transition-colors text-text2">Cancel</button>
               <button onClick={addRemote} disabled={ghModal.loading || !ghModal.url} className="px-4 py-2.5 flex items-center justify-center gap-2 text-xs font-medium rounded-lg border transition-colors bg-primary/15 text-accent border-primary/25 hover:bg-primary/25 disabled:opacity-50">
                 {ghModal.loading ? <Search className="w-4 h-4 animate-spin"/> : <FolderGit2 className="w-4 h-4"/>} Import
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
