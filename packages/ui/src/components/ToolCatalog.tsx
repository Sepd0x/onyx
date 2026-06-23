import { useState } from 'react';
import { BadgeCheck, Search } from 'lucide-react';
import Switch from './Switch';
import { TOOLS } from '../lib/tools';

// Reusable tool "catalog" — the visual half of the modular / pick-your-tools idea
// (#28). Shows every tool as a card (icon, name, description, author + Official
// badge) with an enable toggle. Used both in onboarding ("pick your tools") and in
// Settings → Tools, so the experience is identical in both places. Toggling writes
// config.disabledTools via the caller's onToggle; future community plugins will add
// their own cards here with the contributor credited in place of "Onyx".
//
// `searchable` (Settings) adds a filter + an enabled count so the list stays scannable
// as the toolset grows — the "Settings is getting busy" fix.
export default function ToolCatalog({
  config,
  onToggle,
  columns = 1,
  searchable = false,
}: {
  config: any;
  onToggle: (id: string) => void;
  columns?: 1 | 2;
  searchable?: boolean;
}) {
  const disabled: string[] = Array.isArray(config?.disabledTools) ? config.disabledTools : [];
  const enabled = (id: string) => !disabled.includes(id);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const shown = query
    ? TOOLS.filter((t) => t.label.toLowerCase().includes(query) || t.description.toLowerCase().includes(query))
    : TOOLS;
  const enabledCount = TOOLS.filter((t) => enabled(t.id)).length;

  return (
    <div className="flex flex-col gap-2.5">
      {searchable && (
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-background border border-border rounded-lg px-3">
            <Search className="w-3.5 h-3.5 text-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tools…"
              aria-label="Search tools"
              className="flex-1 bg-transparent py-2 text-[12px] text-text placeholder:text-muted/60 outline-none"
            />
          </div>
          <span className="text-[10px] font-mono text-muted2 shrink-0 whitespace-nowrap">{enabledCount}/{TOOLS.length} on</span>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-[11px] text-muted/70 text-center py-3">No tools match “{q}”.</p>
      ) : (
        <div className={`grid gap-2 ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {shown.map((t) => {
        const Icon = t.icon;
        const on = enabled(t.id);
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${on ? 'border-border2 bg-surface2/40' : 'border-border bg-surface/40'}`}
          >
            <span className={`p-1.5 rounded-lg border shrink-0 mt-0.5 transition-colors ${on ? 'bg-primary/10 border-primary/20 text-accent' : 'bg-surface2 border-border text-muted'}`}>
              <Icon className="w-4 h-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-[13px] font-medium text-text">{t.label}</h4>
                <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold tracking-wide text-muted2 bg-surface3/60 border border-border rounded px-1 py-0.5">
                  <BadgeCheck className="w-2.5 h-2.5" /> OFFICIAL
                </span>
              </div>
              <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                {t.description}{t.requiresAI ? ' Needs the AI assistant on.' : ''}
              </p>
              <div className="text-[9px] font-mono text-muted/60 mt-1">by Onyx</div>
            </div>
            <Switch active={on} onClick={() => onToggle(t.id)} label={`Toggle ${t.label}`} />
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}
