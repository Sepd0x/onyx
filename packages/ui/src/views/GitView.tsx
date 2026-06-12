import { useEffect, useState } from 'react';
import { Plus, FolderGit2, Trash2, Search, AlertTriangle, CheckCircle2, Wand2, HardDrive, Cpu, X, GitCommit, FolderSearch, FolderPlus } from 'lucide-react';
import { CH, EV } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';

export default function GitView() {
  // No background poll (repo health is expensive); served from cache instantly on
  // tab switch, revalidated when stale or after a mutation via invalidate('git:').
  const repos: any[] = useIpc(CH.gitGetRepos, [], { pollMs: 0 }).data ?? [];
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<{ scanned: number; found: number } | null>(null);
  const [scanRoots, setScanRoots] = useState<string[]>([]);
  const [showRoots, setShowRoots] = useState(false);
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

  const Sparkline = ({ data }: {data: number[]}) => {
    if (!data || data.length < 2) return null;
    const max = Math.max(...data, 1);
    return (
      <div className="flex items-end gap-[3px] h-8 flex-1">
        {data.map((v, i) => {
          const h = Math.max(10, Math.round((v/max)*100));
          const isToday = i === data.length - 1;
          return (
             <div key={i} className={`flex-1 rounded-sm transition-all duration-300 ${isToday ? 'bg-primary shadow-[0_0_8px_rgb(var(--primary)/0.5)]' : v > 0 ? 'bg-primary/30' : 'bg-surface3'}`} style={{ height: `${h}%`}}></div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-transparent relative">
      <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-border/60 z-20 bg-background/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-surface2 border border-border rounded-xl shadow-lg">
              <FolderGit2 className="w-5 h-5 text-text"/>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text tracking-tight">Git Pulse Dashboard</h2>
              <p className="text-[10px] font-mono text-muted tracking-wide mt-1">REPOSITORY HEALTH & AI ASSISTANT</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {scanning && scanProgress && (
              <span className="text-[10px] font-mono text-muted tracking-wide whitespace-nowrap">
                {scanProgress.scanned} scanned · {scanProgress.found} found
              </span>
            )}
            <button onClick={() => setShowRoots(s => !s)} className={`px-4 py-2 text-[11px] font-bold tracking-wider font-mono rounded-lg border transition-all flex items-center gap-2 shadow-sm hover:shadow-md ${showRoots ? 'bg-surface3 text-text border-border2' : 'bg-surface2 text-text border-border hover:bg-surface3'}`} title="Configure folders scanned for repositories">
              <FolderSearch className="w-4 h-4"/> SCAN ROOTS
            </button>
            <button onClick={autoScan} disabled={scanning} className="px-4 py-2 bg-surface2 text-text text-[11px] font-bold tracking-wider font-mono rounded-lg border border-border hover:bg-surface3 transition-all flex items-center gap-2 shadow-sm hover:shadow-md disabled:opacity-50">
              {scanning ? <Search className="w-4 h-4 animate-pulse"/> : <HardDrive className="w-4 h-4"/>}
              {scanning ? 'SCANNING...' : 'AUTO SCAN'}
            </button>
            <button onClick={() => setGhModal({ url: '', token: '', loading: false, error: '' })} className="px-4 py-2 bg-surface2 text-text text-[11px] font-bold tracking-wider font-mono rounded-lg border border-border hover:bg-surface3 transition-all flex items-center gap-2 shadow-sm hover:shadow-md">
              GITHUB IMPORT
            </button>
            <button onClick={add} className="px-4 py-2 bg-primary text-background text-[11px] font-bold tracking-wider font-mono rounded-lg border border-transparent hover:bg-accent transition-all flex items-center gap-2 shadow-[0_0_15px_var(--primary-alpha)] hover:shadow-[0_0_20px_var(--primary-alpha)]">
              <Plus className="w-4 h-4"/> ADD MANUAL
            </button>
          </div>
        </div>

        {showRoots && (
          <div className="mt-4 bg-surface/60 border border-border rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted tracking-widest uppercase">Scan Roots</span>
              <button onClick={addRoot} className="px-3 py-1.5 bg-surface2 text-text text-[10px] font-bold tracking-wider font-mono rounded-lg border border-border hover:bg-surface3 transition-all flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5"/> ADD FOLDER
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {scanRoots.length === 0 ? (
                <span className="text-[10px] font-mono text-muted/70">No roots configured.</span>
              ) : scanRoots.map((root) => (
                <div key={root} className="flex items-center justify-between gap-2 bg-background/60 border border-border/50 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-mono text-text2 truncate" title={root}>{root}</span>
                  <button onClick={() => removeRoot(root)} className="p-1 text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-all flex-shrink-0" title="Remove root">
                    <X className="w-3.5 h-3.5"/>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 pt-6 no-scrollbar pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {repos.map((r: any, i) => {
          const hasRisk = r.risk && r.risk.length > 0;
          return (
            <div key={i} className={`bg-surface/50 backdrop-blur-sm border ${r.commitWarning ? 'border-warning/40 shadow-[0_0_15px_rgb(var(--warning)/0.08)]' : 'border-border'} rounded-xl p-6 hover:border-border2 transition-all relative overflow-hidden group shadow-sm flex flex-col gap-5`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-semibold text-text tracking-tight">{r.name}</h3>
                  <p className="text-[10px] font-mono text-muted mt-1.5 truncate max-w-[200px]" title={r.path}>{r.path}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-[10px] font-mono font-bold tracking-widest px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md shadow-[inset_0_1px_1px_var(--primary-alpha)] text-primary flex items-center gap-1.5">
                    <GitCommit className="w-3 h-3"/> {r.branch}
                  </div>
                </div>
              </div>

              {/* Health Grid */}
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="bg-background/80 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted/70 text-[9px] tracking-widest">MODIFIED</span>
                  <span className={`text-sm font-bold ${r.dirty > 0 ? 'text-amber-400' : 'text-text2'}`}>{r.dirty}</span>
                </div>
                <div className="bg-background/80 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted/70 text-[9px] tracking-widest">PULL</span>
                  <span className={`text-sm font-bold ${r.pull > 0 ? 'text-blue-400' : 'text-text2'}`}>{r.pull}</span>
                </div>
                <div className="bg-background/80 py-3 rounded-lg border border-border/50 flex flex-col items-center justify-center gap-1">
                  <span className="text-muted/70 text-[9px] tracking-widest">PUSH</span>
                  <span className={`text-sm font-bold ${r.push > 0 ? 'text-red-400' : 'text-text2'}`}>{r.push}</span>
                </div>
              </div>

              {/* Risk & Health Indicators */}
              <div className="flex flex-col gap-2">
                <div className="flex gap-2 text-[10px] font-mono tracking-wide">
                  {r.syncStatus === 'Outdated' ? (
                     <div className="flex-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-2.5 rounded-lg flex items-center justify-center gap-2 text-center leading-relaxed font-bold">
                       <AlertTriangle className="w-3.5 h-3.5"/> OUT OF SYNC: LOCAL BEHIND REMOTE
                     </div>
                  ) : hasRisk ? (
                     <div className="flex-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-3 py-2.5 rounded-lg flex items-center justify-center gap-2">
                       <AlertTriangle className="w-3.5 h-3.5"/> RISK: {r.risk[0]}
                     </div>
                  ) : (
                     <div className="flex-1 bg-green-500/10 border border-green-500/20 text-green-500 px-3 py-2.5 rounded-lg flex items-center justify-center gap-2">
                       <CheckCircle2 className="w-3.5 h-3.5"/> SECURE
                     </div>
                  )}
                  {r.ready ? (
                     <div className="flex-1 bg-green-500/10 border border-green-500/20 text-green-500 px-3 py-2.5 rounded-lg flex items-center justify-center gap-2">
                       <CheckCircle2 className="w-3.5 h-3.5"/> DOCS READY
                     </div>
                  ) : (
                     <div className="flex-1 bg-surface3/80 border border-border text-muted px-3 py-2.5 rounded-lg flex items-center justify-center gap-2">
                       <AlertTriangle className="w-3.5 h-3.5"/> DOCS MISSING
                     </div>
                  )}
                </div>
                
                {r.commitWarning && (
                  <div className="bg-amber-500/5 border border-amber-500/20 text-amber-500 p-3 rounded-lg flex items-start gap-2.5 text-[10px] font-mono">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"/>
                    <span className="leading-relaxed whitespace-pre-wrap">{r.commitWarning}</span>
                  </div>
                )}
              </div>

              {/* Activity & AI */}
              <div className="flex justify-between items-end mt-2">
                 <div className="flex-1 pr-6 flex flex-col gap-2.5">
                   <span className="text-[9px] font-mono text-muted/70 tracking-widest">14-DAY ACTIVITY</span>
                   <Sparkline data={r.activity || new Array(14).fill(0)} />
                 </div>
                 <button 
                  onClick={() => openAi(r.path)}
                  className="flex-shrink-0 w-10 h-10 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-sm" title="Suggest commit message">
                   <Wand2 className="w-4 h-4"/>
                 </button>
              </div>
              
              <button 
                onClick={() => removeRepo(r.path)} 
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                title="Remove Tracking"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {repos.length === 0 && !scanning && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center text-muted gap-5 border border-dashed border-border rounded-xl bg-surface/30">
            <FolderGit2 className="w-12 h-12 opacity-20" />
            <p className="text-[11px] font-mono tracking-widest uppercase">No Repositories Tracked</p>
          </div>
        )}
        </div>
      </div>

      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-surface border border-border2 p-6 md:p-8 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200 no-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-3"><Cpu className="w-5 h-5 text-primary"/> Commit Message Helper</h3>
              <button onClick={() => setAiModal(null)} className="p-2 text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="bg-background border border-border rounded-xl p-5 mb-6 min-h-[140px] flex items-center justify-center shadow-inner flex-shrink-0">
              {aiModal.loading ? (
                <div className="flex flex-col items-center gap-4 text-primary">
                  <Wand2 className="w-6 h-6 animate-pulse"/>
                  <span className="text-[11px] font-mono tracking-widest animate-pulse">ANALYZING GIT DIFF...</span>
                </div>
              ) : (
                <div className="text-sm font-mono text-text w-full">
                  <p className="text-muted text-[10px] uppercase tracking-widest mb-3">Suggested Message:</p>
                  <div className="p-4 bg-surface3/50 border border-border2 rounded-xl text-primary font-bold shadow-inner" style={{ userSelect: 'all' }}>
                    {aiModal.msg}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3">
               <button onClick={() => setAiModal(null)} className="px-5 py-2.5 text-[11px] font-mono font-bold tracking-widest bg-surface3 hover:bg-border border border-border rounded-lg transition-colors text-text">CLOSE</button>
               {!aiModal.loading && (
                 <button onClick={handleCopy} className={`px-5 py-2.5 text-[11px] font-mono font-bold tracking-widest text-background rounded-lg transition-all shadow-[0_0_15px_rgb(var(--primary)/0.3)] hover:shadow-[0_0_20px_rgb(var(--primary)/0.5)] ${copied ? 'bg-success' : 'bg-primary hover:bg-accent'}`}>{copied ? 'COPIED!' : 'COPY TO CLIPBOARD'}</button>
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
                 <div className="text-[10px] font-mono text-red-500 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
                   {ghModal.error}
                 </div>
               )}
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Repository URL</label>
                  <input type="text" placeholder="https://github.com/user/repo" value={ghModal.url} onChange={e => setGhModal({...ghModal, url: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none w-full"/>
               </div>
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted">Personal Access Token (PAT) <span className="text-[9px] font-mono opacity-70 ml-2">ENCRYPTED AT REST</span></label>
                  <input type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" value={ghModal.token} onChange={e => setGhModal({...ghModal, token: e.target.value})} className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none w-full"/>
               </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
               <button onClick={() => setGhModal(null)} className="px-5 py-2.5 text-[11px] font-mono font-bold tracking-widest bg-surface3 hover:bg-border border border-border rounded-lg transition-colors text-text">CANCEL</button>
               <button onClick={addRemote} disabled={ghModal.loading || !ghModal.url} className="px-5 py-2.5 flex items-center justify-center gap-2 text-[11px] font-mono font-bold tracking-widest text-background rounded-lg transition-all shadow-[0_0_15px_rgb(var(--primary)/0.3)] hover:shadow-[0_0_20px_rgb(var(--primary)/0.5)] bg-primary hover:bg-accent disabled:opacity-50 disabled:shadow-none">
                 {ghModal.loading ? <Search className="w-4 h-4 animate-spin"/> : <FolderGit2 className="w-4 h-4"/>} IMPORT
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
