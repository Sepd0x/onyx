import { useState } from 'react';
import { Trash2, Search, Skull, FolderX } from 'lucide-react';
import { CH } from '../ipc';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ViewHeader from '../components/ViewHeader';

// "340 MB" → MB number, for proportional size bars.
const sizeToMB = (s: string) => {
  const m = String(s).match(/([\d.]+)\s*(KB|MB|GB|TB)/i);
  if (!m) return 0;
  const v = parseFloat(m[1]);
  return { KB: v / 1024, MB: v, GB: v * 1024, TB: v * 1024 * 1024 }[m[2].toUpperCase() as 'KB' | 'MB' | 'GB' | 'TB'] || 0;
};

export default function CleanserView() {
  const [dirs, setDirs] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scannedSize, setScannedSize] = useState('0 MB');
  const [notice, setNotice] = useState('');

  const scan = async () => {
    setScanning(true);
    setDirs([]);
    setScannedSize('0 MB');
    setNotice('');
    try {
      const data: any = await window.api?.invoke(CH.cleanerScan);
      if (data) {
        setDirs(data.dirs || []);
        setScannedSize(data.totalSize || '0 MB');
      }
    } finally {
      setScanning(false);
    }
  };

  const clean = async (path?: string) => {
    setCleaning(true);
    try {
      const targets = path ? [path] : dirs.map(d => d.path);
      const res: any = await window.api?.invoke(CH.cleanerDelete, targets);
      // The main process shows a confirmation dialog; if cancelled, leave the list as-is.
      if (res && !res.cancelled) {
        await scan(); // authoritative refresh from disk (also clears stale notices)
        const problems: string[] = [];
        if (res.rejected) problems.push(`${res.rejected} skipped (not a safe node_modules path)`);
        if (res.failed?.length) problems.push(`${res.failed.length} could not be deleted — likely in use`);
        if (problems.length) setNotice(problems.join(' · '));
      }
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="mb-10">
        <ViewHeader
          icon={Skull}
          title="Dev Cleanser"
          subtitle="node_modules & target graveyard"
          actions={
            <button
              onClick={scan}
              disabled={scanning || cleaning}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium bg-primary/15 text-accent border border-primary/25 rounded-lg hover:bg-primary/25 transition-colors disabled:opacity-50"
            >
              <Search className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`}/>
              Scan system
            </button>
          }
        />
      </div>

      {notice && (
        <div className="mb-6 px-4 py-3 bg-warning/10 border border-warning/30 rounded-lg text-[11px] font-mono text-warning flex items-center justify-between gap-3">
          <span className="min-w-0 break-words">{notice}</span>
          <button onClick={() => setNotice('')} className="text-warning hover:text-warning flex-shrink-0" aria-label="Dismiss">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 md:col-span-2 bg-surface/50 border border-border p-6 rounded-xl flex flex-col min-h-[300px]">
           <h3 className="text-[13px] font-semibold text-text mb-4">Detected folders</h3>
           <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
             {dirs.length === 0 && !scanning && (
               <EmptyState compact icon={FolderX} title="Nothing scanned yet" description="Hit Scan system to find heavy node_modules folders eating your SSD — sizes are real, deletion is guarded and confirmed." />
             )}
             {scanning && dirs.length === 0 && (
               <div className="flex flex-col gap-2" aria-label="Scanning directories">
                 <Skeleton className="h-[64px]" />
                 <Skeleton className="h-[64px]" />
                 <Skeleton className="h-[64px]" />
               </div>
             )}
             {dirs.map((d, i) => {
                const pct = Math.max(4, Math.round((sizeToMB(d.size) / Math.max(...dirs.map(x => sizeToMB(x.size)), 1)) * 100));
                return (
                <div key={d.path} style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }} className="flex flex-col p-3.5 bg-background/40 hover:bg-surface2 border border-border rounded-lg transition-colors group animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards">
                   <div className="flex justify-between items-center">
                     <div className="flex flex-col min-w-0 pr-4">
                       <span className="text-xs font-medium text-text truncate" title={d.path}>{d.name || d.path.split(/[\\/]/).pop()}</span>
                       <span className="text-[10px] font-mono text-muted/70 truncate" title={d.path}>{d.path}</span>
                     </div>
                     <div className="flex items-center gap-4 flex-shrink-0">
                       <span className="text-xs font-mono font-bold text-danger">{d.size}</span>
                       <button onClick={() => clean(d.path)} disabled={cleaning} aria-label={`Delete ${d.path}`} title="Delete this node_modules folder" className="p-1.5 hover:bg-danger/20 text-muted hover:text-danger rounded-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100">
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                   <div className="h-[3px] rounded-full bg-surface3 mt-2.5 overflow-hidden">
                     <div className="h-full rounded-full bg-danger/40 transition-all duration-700" style={{ width: `${pct}%` }} />
                   </div>
                </div>
                );
             })}
           </div>
        </div>

        <div className="bg-surface/50 border border-border p-6 rounded-xl flex flex-col justify-between">
           <div>
             <h3 className="text-[13px] font-semibold text-text mb-2">Total recoverable</h3>
             <p className="text-[11px] text-muted leading-relaxed mb-6">This will permanently delete these heavy caching folders to reclaim SSD space.</p>
           </div>
           
           <div className="flex flex-col gap-4">
             <div className="text-4xl lg:text-5xl font-mono font-bold text-text truncate">
               {scannedSize}
             </div>
             
             <button
               onClick={() => clean()}
               disabled={dirs.length === 0 || cleaning || scanning}
               className="w-full mt-2 flex justify-center items-center gap-2 px-4 py-3 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 font-medium text-sm rounded-lg transition-colors disabled:opacity-30"
             >
               <Trash2 className="w-4 h-4"/>
               {cleaning ? 'Cleaning…' : 'Clean all'}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
