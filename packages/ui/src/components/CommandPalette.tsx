import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export type Command = {
  id: string;
  label: string;
  section: string;
  hint?: string;
  keywords?: string;
  icon?: ComponentType<{ className?: string }>;
  run: () => void;
};

// Spotlight-style launcher (Ctrl/Cmd+K): jump to any view or switch theme without
// reaching for the mouse. Pure presentation — App owns the command list + open state.
export default function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset and focus on each open.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      // Focus after the entrance frame so the autofocus sticks.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      `${c.label} ${c.section} ${c.keywords ?? ''}`.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Keep the active index in range as the list shrinks.
  useEffect(() => { setActive((a) => Math.min(a, Math.max(0, filtered.length - 1))); }, [filtered.length]);

  // Scroll the active row into view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  if (!open) return null;

  const run = (i: number) => {
    const cmd = filtered[i];
    if (!cmd) return;
    onClose();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(active); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  // Section headers between groups.
  let lastSection = '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh] px-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl bg-surface/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-label="Command palette"
      >
        {/* Integrated search row — one outline (the modal's); a hairline divides it
            from the results. No inner box, so no double border. */}
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a view or switch theme…"
            className="flex-1 bg-transparent py-4 text-sm text-text placeholder:text-muted focus:outline-none"
          />
          <kbd className="text-[10px] font-mono text-muted border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto custom-scrollbar py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted">No matching commands.</div>
          ) : (
            filtered.map((c, i) => {
              const header = c.section !== lastSection ? c.section : null;
              lastSection = c.section;
              const Icon = c.icon;
              return (
                <div key={c.id}>
                  {header && <div className="micro-label px-4 pt-3 pb-1.5">{header}</div>}
                  <button
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => run(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === active ? 'bg-surface3 text-text' : 'text-muted2 hover:text-text'
                    }`}
                  >
                    {Icon && (
                      <span className={`flex-shrink-0 ${i === active ? 'text-primary' : 'text-muted'}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                    )}
                    <span className="text-sm flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="text-[10px] font-mono text-muted">{c.hint}</span>}
                    {i === active && <CornerDownLeft className="w-3.5 h-3.5 text-muted flex-shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
