import { useState } from 'react';
import { Trash2, Search, Skull } from 'lucide-react';

export default function CleanserView() {
  const [dirs, setDirs] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [scannedSize, setScannedSize] = useState('0 MB');

  const scan = async () => {
    setScanning(true);
    setDirs([]);
    setScannedSize('0 MB');
    if (window.api) {
      const data = await window.api.invoke('cleaner:scan');
      if (data) {
         setDirs(data.dirs || []);
         setScannedSize(data.totalSize || '0 MB');
      }
    } else {
      // Mock for web preview
      setTimeout(() => {
        setDirs([
          { path: '~/Projects/old-react-app/node_modules', size: '340 MB' },
          { path: '~/Documents/GitHub/test-repo/node_modules', size: '512 MB' },
          { path: '~/Desktop/temp-js/node_modules', size: '120 MB' }
        ]);
        setScannedSize('972 MB');
        setScanning(false);
      }, 1500);
      return;
    }
    setScanning(false);
  };

  const clean = async (path?: string) => {
    setCleaning(true);
    if (window.api) {
      if (path) {
        await window.api.invoke('cleaner:delete', [path]);
        setDirs(dirs.filter(d => d.path !== path));
      } else {
        await window.api.invoke('cleaner:delete', dirs.map(d => d.path));
        setDirs([]);
      }
    } else {
      // Mock for web preview
      setTimeout(() => {
        if (path) {
          setDirs(dirs.filter(d => d.path !== path));
        } else {
          setDirs([]);
          setScannedSize('0 MB');
        }
        setCleaning(false);
      }, 800);
      return;
    }
    // Update total size heuristically if needed, or rescan
    scan();
    setCleaning(false);
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-lg">
            <Skull className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text tracking-tight flex items-center gap-3">Dev Cleanser</h2>
            <p className="text-[10px] font-mono text-muted tracking-wide mt-1.5 uppercase">Node_Modules & Target Graveyard</p>
          </div>
        </div>
        
        <div className="flex bg-surface border border-border rounded-xl p-1 shadow-sm">
          <button 
            onClick={scan} 
            disabled={scanning || cleaning}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-bold tracking-widest bg-primary text-background rounded-lg hover:bg-accent transition-all disabled:opacity-50"
          >
            {scanning ? <Search className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
            SCAN SYSTEM
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="col-span-1 md:col-span-2 bg-surface/50 border border-border p-6 rounded-xl flex flex-col min-h-[300px]">
           <h3 className="text-[13px] font-semibold text-text mb-4">Detected Folders</h3>
           <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
             {dirs.length === 0 && !scanning && (
               <div className="flex items-center justify-center p-8 text-xs font-mono font-medium text-muted uppercase tracking-widest border border-dashed border-border/60 rounded-lg">
                 No Heavy Folders Found
               </div>
             )}
             {scanning && dirs.length === 0 && (
               <div className="flex items-center justify-center p-8 text-xs font-mono font-medium text-primary uppercase tracking-widest border border-dashed border-primary/20 rounded-lg animate-pulse">
                 Scanning directories...
               </div>
             )}
             {dirs.map((d, i) => (
                <div key={i} className="flex justify-between items-center p-3.5 bg-background/40 hover:bg-surface2 border border-border rounded-lg transition-colors group">
                   <div className="flex flex-col min-w-0 pr-4">
                     <span className="text-xs font-medium text-text truncate" title={d.path}>{d.path.split('/').pop()}</span>
                     <span className="text-[10px] font-mono text-muted/70 truncate" title={d.path}>{d.path}</span>
                   </div>
                   <div className="flex items-center gap-4 flex-shrink-0">
                     <span className="text-xs font-mono font-bold text-red-400">{d.size}</span>
                     <button onClick={() => clean(d.path)} disabled={cleaning} className="p-1.5 hover:bg-red-500/20 text-muted hover:text-red-500 rounded-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-100">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                </div>
             ))}
           </div>
        </div>

        <div className="bg-surface/50 border border-border p-6 rounded-xl flex flex-col justify-between">
           <div>
             <h3 className="text-[13px] font-semibold text-text mb-2">Total Recoverable</h3>
             <p className="text-[10px] text-muted leading-relaxed mb-6 font-mono">This will permanently delete these heavy caching folders to reclaim SSD space.</p>
           </div>
           
           <div className="flex flex-col gap-4">
             <div className="text-4xl lg:text-5xl font-mono font-bold text-text truncate">
               {scannedSize}
             </div>
             
             <button 
               onClick={() => clean()}
               disabled={dirs.length === 0 || cleaning || scanning}
               className="w-full mt-2 flex justify-center items-center gap-2 px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-bold tracking-widest uppercase text-[11px] rounded-lg transition-all disabled:opacity-30"
             >
               <Skull className="w-4 h-4"/> 
               {cleaning ? 'CLEANING...' : 'NUKE ALL'}
             </button>
           </div>
        </div>
      </div>
    </div>
  );
}
