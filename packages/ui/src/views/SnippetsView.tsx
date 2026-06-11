import { useState, useEffect } from 'react';
import { TerminalSquare, Plus, Copy, Trash2, CheckSquare } from 'lucide-react';
import { CH } from '../ipc';

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

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-lg">
            <TerminalSquare className="w-5 h-5"/>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-text tracking-tight flex items-center gap-3">Command Snippets</h2>
            <p className="text-[10px] font-mono text-muted tracking-wide mt-1.5 uppercase">Terminal & Shell Shortcuts</p>
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
          {snippets.map((s) => (
            <div key={s.id} className="bg-surface/50 border border-border rounded-xl p-5 flex flex-col justify-between group hover:border-border/80 transition-colors">
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
                  {copiedId === s.id ? <CheckSquare className="w-3.5 h-3.5 text-green-400"/> : <Copy className="w-3.5 h-3.5 text-muted"/>}
                  {copiedId === s.id ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>
          ))}
          {snippets.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-border/50 rounded-xl text-muted">
               <TerminalSquare className="w-8 h-8 opacity-20 mb-3"/>
               <p className="text-xs font-mono tracking-widest uppercase opacity-60">No Snippets Found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
