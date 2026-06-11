import { useState, useEffect } from 'react';
import { Rocket, Plus, Play, Square, Settings2, Trash2 } from 'lucide-react';

export default function LaunchersView() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [activeProfiles, setActiveProfiles] = useState<string[]>([]);
  const [launchError, setLaunchError] = useState('');

  useEffect(() => {
    if (!window.api) return;
    window.api.invoke('launchers:get').then(setProfiles);
    // Poll real running status so a self-exited/crashed process clears its RUNNING badge.
    const syncStatus = () => { window.api?.invoke('launchers:status').then((ids: any) => { if (Array.isArray(ids)) setActiveProfiles(ids); }); };
    syncStatus();
    const iv = setInterval(syncStatus, 3000);
    return () => clearInterval(iv);
  }, []);

  const addProfile = async () => {
    if (!newTitle.trim()) return;
    const item = { 
      id: Math.random().toString(36).substr(2, 9), 
      title: newTitle, 
      commands: [ { name: 'Frontend', cmd: 'npm run dev', path: './client' } ] 
    };
    const updated = [...profiles, item];
    setProfiles(updated);
    setNewTitle('');
    if (window.api) await window.api.invoke('launchers:save', updated);
  };

  const removeProfile = async (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    if (window.api) await window.api.invoke('launchers:save', updated);
  };

  const addCommandToProfile = async (pid: string) => {
    const updated = profiles.map(p => {
      if (p.id === pid) {
        return { ...p, commands: [...p.commands, { name: 'New Service', cmd: '', path: '' }] };
      }
      return p;
    });
    setProfiles(updated);
    if (window.api) await window.api.invoke('launchers:save', updated);
  };

  const updateCommand = async (pid: string, idx: number, key: string, value: string) => {
    const updated = profiles.map(p => {
      if (p.id === pid) {
        const nCommands = [...p.commands];
        nCommands[idx] = { ...nCommands[idx], [key]: value };
        return { ...p, commands: nCommands };
      }
      return p;
    });
    setProfiles(updated);
    if (window.api) await window.api.invoke('launchers:save', updated);
  };

  const launchProfile = async (id: string) => {
    setLaunchError('');
    if (!window.api) { setActiveProfiles([...activeProfiles, id]); return; }
    const res: any = await window.api.invoke('launchers:start', id);
    if (res?.ok) {
      setActiveProfiles(prev => [...prev, id]);
      if (res.errors && res.errors.length) setLaunchError(res.errors.join(' · '));
    } else {
      setLaunchError(res?.error || 'Failed to start profile');
    }
  };

  const stopProfile = async (id: string) => {
    if (window.api) await window.api.invoke('launchers:stop', id);
    setActiveProfiles(activeProfiles.filter(p => p !== id));
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-lg">
            <Rocket className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text tracking-tight flex items-center gap-3">Launch Profiles</h2>
            <p className="text-[10px] font-mono text-muted tracking-wide mt-1.5 uppercase">1-Click Local Environments</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Create Profile Form */}
        <div className="bg-surface/30 border border-border p-5 rounded-xl flex items-center justify-between gap-4">
          <input 
            type="text" 
            placeholder="New Profile Name (e.g. MERN Stack Local)" 
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProfile()}
            className="bg-background border border-border text-sm text-text px-4 py-2.5 rounded-lg focus:outline-none focus:border-primary/50 flex-1"
          />
          <button 
            onClick={addProfile}
            disabled={!newTitle.trim()}
            className="bg-primary hover:bg-accent text-background text-xs font-bold font-mono px-6 py-2.5 rounded-lg tracking-widest disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4"/> CREATE
          </button>
        </div>

        {launchError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono px-4 py-3 rounded-lg flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{launchError}</span>
            <button onClick={() => setLaunchError('')} className="text-red-300 hover:text-red-200 flex-shrink-0">✕</button>
          </div>
        )}

        {/* Profiles List */}
        <div className="flex flex-col gap-5">
          {profiles.map((p) => {
             const isActive = activeProfiles.includes(p.id);
             return (
              <div key={p.id} className={`p-6 rounded-xl border transition-colors ${isActive ? 'bg-surface/80 border-primary/40' : 'bg-surface/40 border-border'}`}>
                <div className="flex items-center justify-between mb-5">
                   <h3 className="text-sm font-bold text-text flex items-center gap-3">
                     {p.title} 
                     {isActive && <span className="text-[9px] font-mono font-bold bg-green-500/20 text-green-400 px-2.5 py-1 rounded-md border border-green-500/30 animate-pulse">RUNNING</span>}
                   </h3>
                   <div className="flex items-center gap-2">
                     <button onClick={() => removeProfile(p.id)} className="p-2 hover:bg-red-500/20 text-muted hover:text-red-400 rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                     {isActive ? (
                       <button onClick={() => stopProfile(p.id)} className="px-5 py-2 text-xs font-mono font-bold bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-lg flex items-center gap-2 transition-colors"><Square className="w-3.5 h-3.5"/> STOP ALL</button>
                     ) : (
                       <button onClick={() => launchProfile(p.id)} className="px-5 py-2 text-xs font-mono font-bold bg-primary hover:bg-accent text-background rounded-lg flex items-center gap-2 transition-colors"><Play className="w-3.5 h-3.5 fill-current"/> LAUNCH ALL</button>
                     )}
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {p.commands.map((cmd: any, i: number) => (
                    <div key={i} className="flex flex-col md:flex-row gap-3">
                       <input 
                         type="text" 
                         placeholder="Name (ex: API)" 
                         value={cmd.name}
                         onChange={e => updateCommand(p.id, i, 'name', e.target.value)}
                         className="bg-background border border-border text-xs px-3 py-2 rounded-md focus:outline-none focus:border-primary/50 w-full md:w-32" 
                         disabled={isActive}
                       />
                       <input 
                         type="text" 
                         placeholder="CWD Path (ex: ./backend)" 
                         value={cmd.path}
                         onChange={e => updateCommand(p.id, i, 'path', e.target.value)}
                         className="bg-background border border-border text-[11px] font-mono text-muted px-3 py-2 rounded-md focus:outline-none focus:border-primary/50 w-full md:w-48" 
                         disabled={isActive}
                       />
                       <input 
                         type="text" 
                         placeholder="Command (ex: node index.js)" 
                         value={cmd.cmd}
                         onChange={e => updateCommand(p.id, i, 'cmd', e.target.value)}
                         className="bg-background border border-border text-[11px] font-mono text-primary/80 px-3 py-2 rounded-md focus:outline-none focus:border-primary/50 flex-1" 
                         disabled={isActive}
                       />
                    </div>
                  ))}
                  {!isActive && (
                    <button onClick={() => addCommandToProfile(p.id)} className="mt-2 text-[10px] font-mono font-bold text-muted hover:text-text flex items-center gap-2 w-max transition-colors">
                      <Plus className="w-3.5 h-3.5"/> ADD PROCESS
                    </button>
                  )}
                </div>
              </div>
             )
          })}
        </div>
      </div>
    </div>
  );
}
