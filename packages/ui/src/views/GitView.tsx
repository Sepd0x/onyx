import { useEffect, useState } from 'react';
import { Plus, FolderGit2, Trash2, Search, AlertTriangle, CheckCircle2, Wand2, HardDrive, Cpu, X, GitCommit, FolderSearch, FolderPlus, Github, Link2, Unlink } from 'lucide-react';
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
  const [linkModal, setLinkModal] = useState<any>(null); // { path, name }
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

  // Local ↔ GitHub pairing (#23b): unify a local repo with its remote twin, or break it.
  const linkRepo = async (localPath: string, remoteUrl: string) => {
    if (window.api) { await window.api.invoke(CH.gitLinkRepo, localPath, remoteUrl); invalidate('git:'); }
    setLinkModal(null);
  };
  const unlinkRepo = async (localPath: string, remoteUrl: string) => {
    if (window.api) { await window.api.invoke(CH.gitUnlinkRepo, localPath, remoteUrl); invalidate('git:'); }
  };

  // Per-repo AI actions (#23): a menu on each card → result, both in one modal.
  const AI_ACTIONS = [
    { id: 'commit', label: 'Commit message', desc: 'Generate a message for the current diff' },
    { id: 'explain', label: 'Explain changes', desc: 'Plain-English read of the uncommitted diff' },
    { id: 'pr', label: 'Draft PR description', desc: 'A summary + changes list for a pull request' },
    { id: 'history', label: 'Summarize history', desc: 'A changelog of recent commit themes' },
  ];

  const openAiMenu = (repo: any) => setAiModal({ path: repo.path, name: repo.name, mode: 'menu' });

  const runAiAction = async (actId: string, label: string) => {
    const repoPath = aiModal.path;
    setAiModal((m: any) => ({ ...m, mode: 'result', title: label, loading: true, msg: '' }));
    let msg = 'AI request failed.';
    if (window.api) {
      if (actId === 'commit') {
        msg = await window.api.invoke(CH.gitGenerateCommit, repoPath);
      } else {
        const r: any = await window.api.invoke(CH.gitAiRepoAction, repoPath, actId);
        msg = r?.text || r?.detail || (r?.error === 'no-key' ? 'Add an AI API key in Settings to enable this.' : 'AI request failed.');
      }
    }
    setAiModal((m: any) => ({ ...m, loading: false, msg }));
  };

  useEffect(() => { loadRoots(); }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? repos.filter((r: any) => `${r.name} ${r.path} ${r.branch}`.toLowerCase().includes(q)) : repos;
  // Standalone GitHub repos a local card can be manually linked to.
  const remoteOptions = filtered.filter((r: any) => r.type === 'remote');

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
                  <h3 className="text-base font-semibold text-text tracking-tight truncate flex items-center gap-2">
                    <span className="truncate">{r.name}</span>
                    {r.remote && <Github className="w-3.5 h-3.5 text-accent flex-shrink-0" aria-label="Linked to GitHub" />}
                  </h3>
                  <p className="text-[10px] font-mono text-muted mt-1.5 truncate" title={r.path}>{r.path}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!r.remote && r.type !== 'remote' && remoteOptions.length > 0 && (
                    <button
                      onClick={() => setLinkModal({ path: r.path, name: r.name })}
                      title="Link to a GitHub repo"
                      aria-label={`Link ${r.name} to a GitHub repo`}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-accent hover:bg-primary/10 rounded-lg transition-all active:scale-90"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => removeRepo(r.path)}
                    title="Remove tracking"
                    aria-label={`Remove ${r.name} from tracking`}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-all active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="text-[11px] font-mono px-2.5 py-1 bg-surface2 border border-border rounded-md text-muted2 flex items-center gap-1.5 max-w-[110px]">
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

              {/* Unified card: the GitHub side of a local repo paired with its remote twin */}
              {r.remote && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-accent inline-flex items-center gap-1.5 min-w-0">
                      <Github className="w-3.5 h-3.5 flex-shrink-0"/>
                      <span className="truncate" title={r.remote.slug}>{r.remote.slug}</span>
                    </span>
                    <button
                      onClick={() => unlinkRepo(r.path, r.remote.url)}
                      title="Unlink this local repo from its GitHub twin"
                      className="text-[10px] font-mono text-muted hover:text-danger inline-flex items-center gap-1 transition-colors flex-shrink-0"
                    >
                      <Unlink className="w-3 h-3"/> Unlink
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="flex items-center justify-between bg-background/50 rounded px-2 py-1.5">
                      <span className="text-muted">default</span><span className="text-text2">{r.remote.branch}</span>
                    </div>
                    <div className="flex items-center justify-between bg-background/50 rounded px-2 py-1.5">
                      <span className="text-muted">open issues</span><span className="text-text2">{r.remote.openIssues}</span>
                    </div>
                  </div>
                  {r.remote.lastCommit && (
                    <div className="text-[10px] font-mono text-muted truncate" title={r.remote.lastCommit}>
                      last remote: <span className="text-muted2">{r.remote.lastCommit}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Activity & AI */}
              <div className="flex justify-between items-end mt-2">
                 <div className="flex-1 pr-6 flex flex-col gap-2.5">
                   <span className="text-[10px] text-muted">14-day activity</span>
                   <Sparkline data={r.activity || new Array(14).fill(0)} />
                 </div>
                 <button
                  onClick={() => openAiMenu(r)}
                  className="flex-shrink-0 w-10 h-10 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl flex items-center justify-center transition-all hover:scale-105 shadow-sm" title="AI actions">
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
              <h3 className="text-lg font-semibold flex items-center gap-3 min-w-0">
                <Cpu className="w-5 h-5 text-accent flex-shrink-0"/>
                <span className="truncate">{aiModal.mode === 'menu' ? 'AI actions' : aiModal.title}</span>
              </h3>
              <button onClick={() => setAiModal(null)} className="p-2 text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors"><X className="w-5 h-5"/></button>
            </div>

            {aiModal.mode === 'menu' ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-mono text-muted mb-2 truncate">{aiModal.name}</p>
                {AI_ACTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => runAiAction(a.id, a.label)}
                    className="flex items-start gap-3 px-4 py-3 bg-background/60 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/10 transition-colors text-left"
                  >
                    <Wand2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0"/>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-text">{a.label}</div>
                      <div className="text-[11px] text-muted">{a.desc}</div>
                    </div>
                  </button>
                ))}
                <p className="text-[10px] text-muted/70 mt-3 leading-relaxed">Runs in the cloud — sends this repo's diff or commit history to your configured AI provider.</p>
              </div>
            ) : (
              <>
                <div className="bg-background border border-border rounded-xl p-5 mb-6 min-h-[140px] flex items-center justify-center shadow-inner flex-shrink-0">
                  {aiModal.loading ? (
                    <div className="flex flex-col items-center gap-4 text-primary">
                      <Wand2 className="w-6 h-6 animate-pulse"/>
                      <span className="text-xs animate-pulse">Working…</span>
                    </div>
                  ) : (
                    <div className="text-sm w-full">
                      <div className="p-4 bg-background border border-border2 rounded-xl text-text2 shadow-inner whitespace-pre-wrap leading-relaxed font-mono text-[12px]" style={{ userSelect: 'all' }}>
                        {aiModal.msg}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex justify-between gap-3">
                  <button onClick={() => setAiModal((m: any) => ({ path: m.path, name: m.name, mode: 'menu' }))} className="px-4 py-2.5 text-xs font-medium bg-surface2 hover:bg-surface3 border border-border rounded-lg transition-colors text-text2">Back</button>
                  <div className="flex gap-3">
                    <button onClick={() => setAiModal(null)} className="px-4 py-2.5 text-xs font-medium bg-surface2 hover:bg-surface3 border border-border rounded-lg transition-colors text-text2">Close</button>
                    {!aiModal.loading && (
                      <button onClick={handleCopy} className={`px-4 py-2.5 text-xs font-medium rounded-lg border transition-colors ${copied ? 'bg-success/20 text-success border-success/30' : 'bg-primary/15 text-accent border-primary/25 hover:bg-primary/25'}`}>{copied ? 'Copied!' : 'Copy'}</button>
                    )}
                  </div>
                </div>
              </>
            )}
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

      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 md:p-8">
          <div className="bg-surface border border-border2 p-6 md:p-8 rounded-2xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-5">
            <div className="flex justify-between items-center flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-3"><Link2 className="w-5 h-5 text-accent"/> Link to GitHub</h3>
              <button onClick={() => setLinkModal(null)} className="p-2 text-muted hover:text-text rounded-md hover:bg-surface2 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Pair <span className="text-text2 font-mono">{linkModal.name}</span> with a tracked GitHub repo to show both sides on one card.
            </p>
            <div className="flex flex-col gap-2">
              {remoteOptions.length === 0 ? (
                <span className="text-[11px] font-mono text-muted/70">No GitHub repos imported yet.</span>
              ) : remoteOptions.map((rem: any) => (
                <button
                  key={rem.path}
                  onClick={() => linkRepo(linkModal.path, rem.path)}
                  className="flex items-center gap-2.5 px-4 py-3 bg-background/60 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/10 transition-colors text-left"
                >
                  <Github className="w-4 h-4 text-muted flex-shrink-0"/>
                  <span className="text-sm font-mono text-text2 truncate">{rem.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
