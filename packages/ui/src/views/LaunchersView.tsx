import { useState, useEffect, useRef } from 'react';
import { Rocket, Plus, Play, Square, Trash2, Sparkles } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import EmptyState from '../components/EmptyState';
import ViewHeader from '../components/ViewHeader';

export default function LaunchersView() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [activeProfiles, setActiveProfiles] = useState<string[]>([]);
  const [launchError, setLaunchError] = useState('');

  // Profiles are user-edited (write-through); only the running-status feed is polled.
  // Optimistic launch/stop updates stay local and the poll reconciles them.
  const statusData = useIpc(CH.launchersStatus, [], { pollMs: 3000 }).data;
  useEffect(() => { if (Array.isArray(statusData)) setActiveProfiles(statusData); }, [statusData]);

  useEffect(() => {
    if (window.api) window.api.invoke(CH.launchersGet).then(setProfiles);
  }, []);

  const addProfile = async () => {
    if (!newTitle.trim()) return;
    // One visible blank command row — nothing silently pre-filled.
    const item = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      commands: [ { name: '', cmd: '', path: '' } ]
    };
    const updated = [...profiles, item];
    setProfiles(updated);
    setNewTitle('');
    if (window.api) await window.api.invoke(CH.launchersSave, updated);
  };

  const addExampleProfile = async () => {
    const item = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Dev Server (example)',
      commands: [
        { name: 'Frontend', cmd: 'npm run dev', path: 'C:\\path\\to\\your\\project' },
        { name: 'API', cmd: 'npm run start:api', path: 'C:\\path\\to\\your\\project' },
      ]
    };
    const updated = [...profiles, item];
    setProfiles(updated);
    if (window.api) await window.api.invoke(CH.launchersSave, updated);
  };

  const removeProfile = async (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    setProfiles(updated);
    if (window.api) await window.api.invoke(CH.launchersSave, updated);
  };

  const addCommandToProfile = async (pid: string) => {
    const updated = profiles.map(p => {
      if (p.id === pid) {
        return { ...p, commands: [...p.commands, { name: 'New Service', cmd: '', path: '' }] };
      }
      return p;
    });
    setProfiles(updated);
    if (window.api) await window.api.invoke(CH.launchersSave, updated);
  };

  // Typing updates locally right away; the IPC write is debounced so we
  // don't hit the disk on every keystroke.
  const saveTimer = useRef<number | undefined>(undefined);
  const updateCommand = (pid: string, idx: number, key: string, value: string) => {
    const updated = profiles.map(p => {
      if (p.id === pid) {
        const nCommands = [...p.commands];
        nCommands[idx] = { ...nCommands[idx], [key]: value };
        return { ...p, commands: nCommands };
      }
      return p;
    });
    setProfiles(updated);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      if (window.api) window.api.invoke(CH.launchersSave, updated);
    }, 500);
  };

  const launchProfile = async (id: string) => {
    setLaunchError('');
    if (!window.api) { setActiveProfiles([...activeProfiles, id]); return; }
    const res: any = await window.api.invoke(CH.launchersStart, id);
    if (res?.ok) {
      setActiveProfiles(prev => [...prev, id]);
      if (res.errors && res.errors.length) setLaunchError(res.errors.join(' · '));
    } else {
      setLaunchError(res?.error || 'Failed to start profile');
    }
    invalidate('launchers:status'); // reconcile against the real running set
  };

  const stopProfile = async (id: string) => {
    if (window.api) await window.api.invoke(CH.launchersStop, id);
    setActiveProfiles(activeProfiles.filter(p => p !== id));
    invalidate('launchers:status');
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="mb-10">
        <ViewHeader icon={Rocket} title="Launch Profiles" subtitle="1-Click local environments" />
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
          <div className="bg-danger/10 border border-danger/30 text-danger text-xs font-mono px-4 py-3 rounded-lg flex items-center justify-between gap-3">
            <span className="min-w-0 break-words">{launchError}</span>
            <button onClick={() => setLaunchError('')} className="text-danger hover:text-danger flex-shrink-0">✕</button>
          </div>
        )}

        {/* Profiles List */}
        {profiles.length === 0 && (
          <EmptyState
            icon={Rocket}
            title="No launch profiles yet"
            description="A profile is a named group of commands (frontend, API, database…) that start together with one click and stop together — your whole dev stack as a single button."
          >
            <button onClick={addExampleProfile} className="px-5 py-2.5 bg-primary hover:bg-accent text-background text-[11px] font-bold font-mono tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgb(var(--primary)/0.3)] hover:shadow-[0_0_20px_rgb(var(--primary)/0.5)] flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> ADD EXAMPLE PROFILE
            </button>
          </EmptyState>
        )}
        <div className="flex flex-col gap-5">
          {profiles.map((p, pi) => {
             const isActive = activeProfiles.includes(p.id);
             return (
              <div key={p.id} style={{ animationDelay: `${Math.min(pi, 6) * 60}ms` }} className={`p-6 rounded-xl border transition-colors animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards ${isActive ? 'bg-surface/80 border-primary/40 shadow-[0_0_20px_rgb(var(--primary)/0.07)]' : 'bg-surface/40 border-border'}`}>
                <div className="flex items-center justify-between mb-5">
                   <h3 className="text-sm font-bold text-text flex items-center gap-3">
                     {p.title}
                     {isActive && (
                       <span className="text-[9px] font-mono font-bold bg-success/15 text-success px-2.5 py-1 rounded-md border border-success/30 flex items-center gap-1.5">
                         <span className="relative flex h-1.5 w-1.5">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success"></span>
                         </span>
                         RUNNING
                       </span>
                     )}
                   </h3>
                   <div className="flex items-center gap-2">
                     <button onClick={() => removeProfile(p.id)} className="p-2 hover:bg-danger/20 text-muted hover:text-danger rounded-md transition-colors"><Trash2 className="w-4 h-4"/></button>
                     {isActive ? (
                       <button onClick={() => stopProfile(p.id)} className="px-5 py-2 text-xs font-mono font-bold bg-danger/10 hover:bg-danger/20 border border-danger/30 text-danger rounded-lg flex items-center gap-2 transition-colors"><Square className="w-3.5 h-3.5"/> STOP ALL</button>
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
                         placeholder="Project folder (absolute path)" 
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
