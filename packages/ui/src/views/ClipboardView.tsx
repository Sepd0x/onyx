import { useMemo, useState } from 'react';
import { ClipboardList, Copy, Pin, PinOff, Trash2, CheckSquare, Search, Play, Pause, Eraser } from 'lucide-react';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import EmptyState from '../components/EmptyState';
import ViewHeader from '../components/ViewHeader';

type ClipItem = { id: string; type: 'text' | 'image'; text?: string; dataUrl?: string; preview: string; bytes: number; at: number; pinned: boolean };

function relativeTime(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default function ClipboardView() {
  const res = useIpc(CH.clipboardGet, [], { pollMs: 2000 }).data as { paused: boolean; items: ClipItem[] } | undefined;
  const items = res?.items ?? [];
  const paused = res?.paused ?? false;
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q ? items.filter((i) => (i.text || i.preview).toLowerCase().includes(q)) : items;
    // Pinned first, then newest. (Backend already keeps newest-first within each group.)
    return [...matched].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at - a.at);
  }, [items, query]);

  const copy = async (id: string) => {
    await window.api?.invoke(CH.clipboardCopy, { id });
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    invalidate('clipboard:');
  };
  const togglePin = async (id: string) => { await window.api?.invoke(CH.clipboardTogglePin, { id }); invalidate('clipboard:'); };
  const remove = async (id: string) => { await window.api?.invoke(CH.clipboardDelete, { id }); invalidate('clipboard:'); };
  const clear = async () => { await window.api?.invoke(CH.clipboardClear); invalidate('clipboard:'); };
  const setPaused = async (p: boolean) => { await window.api?.invoke(CH.clipboardSetPaused, { paused: p }); invalidate('clipboard:'); };

  const hasUnpinned = items.some((i) => !i.pinned);

  return (
    <div className="p-8 pb-24 md:p-10 max-w-5xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="mb-8">
        <ViewHeader
          icon={ClipboardList}
          title="Clipboard"
          subtitle="Recent copies · in-memory only"
          badge={<span className="text-[10px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded">{items.length}</span>}
          actions={
            <>
              <button
                onClick={() => setPaused(!paused)}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${paused ? 'bg-warning/15 text-warning border-warning/25 hover:bg-warning/25' : 'bg-surface2 text-text2 border-border hover:bg-surface3'}`}
              >
                {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {paused ? 'Resume capture' : 'Pause capture'}
              </button>
              <button
                onClick={clear}
                disabled={!hasUnpinned}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border bg-surface2 text-text2 hover:bg-surface3 transition-colors disabled:opacity-40"
              >
                <Eraser className="w-3.5 h-3.5" /> Clear
              </button>
            </>
          }
        />
      </div>

      <div className="mb-6 flex items-center gap-2 bg-background border border-border rounded-lg px-3">
        <Search className="w-4 h-4 text-muted shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clipboard history…"
          className="flex-1 bg-transparent py-2.5 text-sm text-text focus:outline-none"
        />
      </div>

      {paused && (
        <div className="mb-6 flex items-center gap-2 text-[11px] font-mono text-warning bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
          <Pause className="w-3.5 h-3.5 shrink-0" /> Capture is paused — new copies aren't being recorded.
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={query ? 'No matches' : 'Nothing copied yet'}
          description={query ? 'No clipboard entry matches your search.' : "Copy some text or an image and it shows up here. History lives only in memory — it's never written to disk and clears when you quit Onyx."}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((it, idx) => (
            <div
              key={it.id}
              style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
              className="group flex items-start gap-3 bg-surface/50 border border-border rounded-xl p-4 card-lift animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards"
            >
              <div className="flex-1 min-w-0">
                {it.type === 'image' && it.dataUrl ? (
                  <img src={it.dataUrl} alt={it.preview} className="max-h-28 rounded-lg border border-border object-contain bg-background" />
                ) : (
                  <pre className="text-[12px] font-mono text-text/90 whitespace-pre-wrap break-words line-clamp-4 leading-relaxed">{it.text}</pre>
                )}
                <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-muted/70">
                  {it.pinned && <span className="flex items-center gap-1 text-accent"><Pin className="w-2.5 h-2.5" /> pinned</span>}
                  <span className="uppercase tracking-widest">{it.type}</span>
                  <span>· {formatBytes(it.bytes)}</span>
                  <span>· {relativeTime(it.at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => copy(it.id)} title="Copy" className="p-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors">
                  {copiedId === it.id ? <CheckSquare className="w-3.5 h-3.5 text-success animate-in zoom-in-50 duration-200" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => togglePin(it.id)} title={it.pinned ? 'Unpin' : 'Pin'} className={`p-2 rounded-md transition-colors hover:bg-surface2 ${it.pinned ? 'text-accent' : 'text-muted hover:text-text'}`}>
                  {it.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => remove(it.id)} title="Delete" className="p-2 rounded-md text-muted hover:text-danger hover:bg-surface2 transition-colors opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
