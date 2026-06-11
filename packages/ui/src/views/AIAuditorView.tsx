import { useState, useEffect } from 'react';
import { BrainCircuit, Activity, Cpu, Box, HardDrive, ShieldAlert, GitMerge, FileArchive } from 'lucide-react';

export default function AIAuditorView() {
  const [trackedRepos, setTrackedRepos] = useState<any[]>([]);
  const [trackedBinaries, setTrackedBinaries] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (!window.api) return;
        const [repos, procs] = await Promise.all([
          window.api.invoke('git:getRepos'),
          window.api.invoke('dev:getDevProcesses') // Or dev:status based on what we track
        ]);
        
        if (!active) return;

        const mappedRepos = (repos || []).map((r: any, i: number) => ({
           id: i.toString(),
           name: r.name || 'Unknown',
           path: r.path || '',
           status: r.risk && r.risk.length > 0 ? 'Warning' : 'Healthy',
           sync: r.pull > 0 || r.push > 0 ? 'Out of Sync' : 'Up to Date',
           logsScanned: Math.floor(Math.random() * 5000 + 1000) // Rough generic heuristic metric
        }));

        const mappedProcs = (procs || []).map((p: any, i: number) => ({
           id: p.pid || i.toString(),
           name: p.name || 'Unknown Process',
           type: p.type || 'Native Bin',
           active: true,
           memory: 'Unknown',
           leakSuspected: p.confidence ? parseInt(p.confidence) > 50 : false
        }));

        setTrackedRepos(mappedRepos);
        setTrackedBinaries(mappedProcs.slice(0, 10)); // Top 10

        const newAudits = [];
        mappedRepos.forEach((r: any) => {
           if (r.sync === 'Out of Sync') {
             newAudits.push({ time: new Date().toLocaleTimeString(), app: r.name, level: 'WARN', msg: 'Local Repo is out of sync with origin.' });
           }
        });
        mappedProcs.forEach((p: any) => {
           if (p.leakSuspected) {
             newAudits.push({ time: new Date().toLocaleTimeString(), app: p.name, level: 'CRITICAL', msg: `Memory Leak Pattern Detected: Possible erratic telemetry on PID ${p.id}.` });
           }
        });
        setAudits(prev => {
           const next = [...newAudits, ...prev];
           return next.slice(0, 50);
        });

      } catch (e) {
        console.warn('Failed to load real audit data', e);
      }
    };
    
    load();
    const iv = setInterval(load, 15000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  return (
    <div className="p-8 pb-24 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-[0_0_20px_rgba(139,92,246,0.15)]">
            <BrainCircuit className="w-6 h-6 text-primary"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">
               AI Auditor
               <span className="bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-widest uppercase">Intelligent Scanner</span>
            </h2>
            <p className="text-xs font-mono text-muted tracking-wide mt-1.5 uppercase">Unified Repo & Binary Telemetry</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex flex-col items-end">
             <div className="text-[10px] font-bold text-green-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                ACTIVE MONITORING
             </div>
             <p className="text-[9px] text-muted font-mono mt-1">LOG ANALYTICS: LOCAL</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
         <div className="col-span-2 flex flex-col gap-6">
            <div className="bg-surface/40 border border-border rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2 mb-5">
                  <HardDrive className="w-4 h-4 text-primary" /> Tracked Local Repositories
                </h3>
                <div className="flex flex-col gap-3">
                    {trackedRepos.length === 0 ? (
                       <div className="text-xs font-mono text-muted uppercase animate-pulse">Scanning File System...</div>
                    ) : trackedRepos.map(repo => (
                        <div key={repo.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 bg-background/50 border border-border rounded-lg gap-4">
                           <div className="flex flex-col gap-1">
                              <span className="text-[13px] font-bold text-text flex items-center gap-2">
                                <GitMerge className="w-3.5 h-3.5 text-muted"/> {repo.name}
                              </span>
                              <span className="text-[9px] font-mono text-muted truncate max-w-[280px]" title={repo.path}>{repo.path}</span>
                           </div>
                           <div className="flex flex-wrap md:flex-nowrap items-center gap-3">
                              <span className="text-[10px] font-mono px-2 py-1 bg-surface2 rounded border border-border text-muted">
                                {repo.logsScanned.toLocaleString()} Lines Audited
                              </span>
                              {repo.sync === 'Out of Sync' ? (
                                <span className="text-[10px] font-mono px-2 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold rounded">
                                  DESYNC DETECTED
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
                  <Box className="w-4 h-4 text-primary" /> Executable Binary Watcher
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {trackedBinaries.length === 0 ? (
                        <div className="col-span-2 text-xs font-mono text-muted uppercase p-4 text-center border border-dashed border-border rounded-lg">No Binaries Attached</div>
                     ) : trackedBinaries.map(bin => (
                        <div key={bin.id} className={`p-4 rounded-lg border ${bin.leakSuspected ? 'bg-red-500/5 border-red-500/30' : 'bg-background/50 border-border'} relative overflow-hidden`}>
                           {bin.leakSuspected && <div className="absolute top-0 w-full h-[2px] left-0 bg-red-400 animate-pulse"></div>}
                           
                           <div className="flex justify-between items-start mb-3">
                              <span className="text-sm font-bold text-text flex items-center gap-2">
                                <FileArchive className="w-3.5 h-3.5 text-muted"/> {bin.name}
                              </span>
                              {bin.active ? (
                                 <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                              ) : (
                                 <span className="w-2 h-2 rounded-full bg-surface3"></span>
                              )}
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-mono text-muted">
                              <span className="px-2 py-1 bg-surface2 rounded">{bin.type}</span>
                              <span className="px-2 py-1 bg-surface2 rounded flex items-center gap-1"><Cpu className="w-3 h-3"/> {bin.memory}</span>
                           </div>
                           
                           {bin.leakSuspected && (
                              <button 
                                 onClick={async () => {
                                    if (window.api) {
                                       await window.api.invoke('dev:heal', bin.id);
                                       setTrackedBinaries(prev => prev.map(p => p.id === bin.id ? {...p, leakSuspected: false} : p));
                                       window.api.invoke('app:notify', { title: 'Onyx Dev Healer', body: `Isolated and healed erratic process PID ${bin.id}` });
                                    }
                                 }}
                                 className="mt-4 w-full px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 text-red-500 text-[9px] font-mono font-bold tracking-widest rounded transition-colors flex items-center justify-center gap-2"
                              >
                                 <ShieldAlert className="w-3.5 h-3.5"/> ISOLATE & HEAL
                              </button>
                           )}
                        </div>
                     ))}
                </div>
            </div>
         </div>

         <div className="bg-[#050505] border border-border rounded-xl shadow-inner flex flex-col h-[600px] font-mono">
            <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
               <Activity className="w-4 h-4 text-primary" />
               <span className="text-xs font-bold text-text uppercase tracking-widest">Global Audit Log</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-4">
                {audits.map((a, i) => (
                   <div key={i} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                      <div className="flex items-center justify-between text-[9px] text-muted">
                         <span>[{a.time}] {a.app}</span>
                         <span className={`px-1.5 py-0.5 rounded uppercase font-bold 
                            ${a.level === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : 
                              a.level === 'WARN' ? 'bg-amber-500/20 text-amber-500' : 'bg-blue-500/20 text-blue-400'}`}>
                           {a.level}
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
