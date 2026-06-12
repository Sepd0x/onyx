import { useState, useEffect } from 'react';
import { TerminalSquare, Plus, Copy, Trash2, CheckSquare, Sparkles } from 'lucide-react';
import { CH } from '../ipc';
import EmptyState from '../components/EmptyState';

// One-click starter pack for the empty state: common Windows-dev commands.
const STARTER_SNIPPETS = [
  { title: 'Clear NPM cache', command: 'npm cache clean --force' },
  { title: 'Kill port 3000', command: 'npx kill-port 3000' },
  { title: 'Who owns a port', command: 'netstat -ano | findstr :3000' },
  { title: 'Force-kill a PID', command: 'taskkill /PID <pid> /F' },
  { title: 'Nuke node_modules', command: 'Remove-Item -Recurse -Force node_modules' },
  { title: 'Recent commits', command: 'git log --oneline -10' },
];

export default function SnippetsView() {
  const [snippets, setSnippets] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newCmd, setNewCmd] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (window.api) {
      window.api.invoke(CH.snippetsGet).then(setSnippets);
    }
  }, []);

  const addSnippet = async () => {
    if (!newTitle.trim() || !newCmd.trim()) return;
    const item = { id: Math.random().toString(36).substr(2, 9), title: newTitle, command: newCmd };
    const updated = [...snippets, item];
    setSnippets(updated);
    setNewTitle('');
    setNewCmd('');
    if (window.api) {
      await window.api.invoke(CH.snippetsSave, updated);
    }
  };

  const removeSnippet = async (id: string) => {
    const updated = snippets.filter(s => s.id !== id);
    setSnippets(updated);
    if (window.api) {
      await window.api.invoke(CH.snippetsSave, updated);
    }
  };

  const copyToClipboard = (id: string, cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const addStarters = async () => {
    const updated = [
      ...snippets,
      ...STARTER_SNIPPETS.map(s => ({ id: Math.random().toString(36).substr(2, 9), ...s })),
    ];
    setSnippets(updated);
    if (window.api) await window.api.invoke(CH.snippetsSave, updated);
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-lg">
            <TerminalSquare className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">Command Snippets</h2>
            <p className="micro-label mt-1.5">Terminal &amp; shell shortcuts</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Add Snippet Form */}
        <div className="bg-surface/30 border border-border p-5 rounded-xl flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <input 
              type="text" 
              placeholder="Snippet Title (e.g. Delete Docker Containers)" 
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              className="bg-background border border-border text-sm text-text px-4 py-2.5 rounded-lg focus:outline-none focus:border-primary/50 flex-1"
            />
            <input 
              type="text" 
              placeholder="Command (e.g. docker rm -f $(docker ps -a -q))" 
              value={newCmd}
              onChange={e => setNewCmd(e.target.value)}
              className="bg-background border border-border text-sm font-mono text-text px-4 py-2.5 rounded-lg focus:outline-none focus:border-primary/50 flex-[2]"
              onKeyDown={e => e.key === 'Enter' && addSnippet()}
            />
            <button 
              onClick={addSnippet}
              disabled={!newTitle.trim() || !newCmd.trim()}
              className="bg-primary hover:bg-accent text-background text-xs font-bold font-mono px-6 py-2.5 rounded-lg tracking-widest disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4"/> ADD
            </button>
          </div>
        </div>

        {/* Snippets List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snippets.map((s, si) => (
            <div key={s.id} style={{ animationDelay: `${Math.min(si, 8) * 45}ms` }} className="bg-surface/50 border border-border rounded-xl p-5 flex flex-col justify-between group card-lift animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-text truncate pr-4">{s.title}</h3>
                  <button 
                    onClick={() => removeSnippet(s.id)}
                    className="text-muted hover:text-red-400 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="bg-background border border-border/60 rounded-lg p-3 overflow-x-auto no-scrollbar relative">
                  <code className="text-[11px] font-mono text-primary/90 whitespace-nowrap">
                    {s.command}
                  </code>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={() => copyToClipboard(s.id, s.command)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface2 hover:bg-surface3 border border-border rounded-md text-[10px] font-mono font-bold tracking-wider text-text transition-colors"
                >
                  {copiedId === s.id ? <CheckSquare className="w-3.5 h-3.5 text-success animate-in zoom-in-50 duration-200"/> : <Copy className="w-3.5 h-3.5 text-muted"/>}
                  {copiedId === s.id ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          ))}
          {snippets.length === 0 && (
            <div className="col-span-full">
              <EmptyState
                icon={TerminalSquare}
                title="Your command shelf is empty"
                description="Snippets are the shell one-liners you keep retyping — kill a port, clean a cache, nuke node_modules. Save them once, copy with one click."
              >
                <button onClick={addStarters} className="px-5 py-2.5 bg-primary hover:bg-accent text-background text-[11px] font-bold font-mono tracking-widest rounded-lg transition-all shadow-[0_0_15px_rgb(var(--primary)/0.3)] hover:shadow-[0_0_20px_rgb(var(--primary)/0.5)] flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> ADD STARTER PACK
                </button>
              </EmptyState>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
