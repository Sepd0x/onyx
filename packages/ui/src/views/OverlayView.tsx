import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Cpu, MemoryStick, Network, Clock, X, GripHorizontal, ChevronDown, ChevronUp, ClipboardList, ExternalLink, Check } from 'lucide-react';
import { CH } from '../ipc';

// The always-on-top desktop widget (its own frameless, transparent BrowserWindow,
// routed via the #overlay hash). Two states:
//  • compact — a glanceable strip of live CPU/RAM/ports/clock tiles.
//  • expanded — click to grow into a richer panel: the same tiles + recent clipboard
//    (one-click re-copy) + quick actions. The window resizes to fit (the renderer
//    measures its card and asks main for the exact size, anchored top-left).
// The whole card is a drag region except interactive controls.
type Tiles = { cpu: boolean; ram: boolean; ports: boolean; clock: boolean };
type Clip = { id: string; type: string; text?: string; preview?: string; pinned?: boolean };

export default function OverlayView() {
  const [tiles, setTiles] = useState<Tiles>({ cpu: true, ram: true, ports: true, clock: true });
  const [opacity, setOpacity] = useState(0.92);
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<{ cpu: string; ram: string }>({ cpu: '—', ram: '—' });
  const [portCount, setPortCount] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [clips, setClips] = useState<Clip[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Live config (tiles/opacity) — polled so Settings changes reflect within ~2s.
  useEffect(() => {
    let alive = true;
    const pull = () => window.api?.invoke(CH.overlayGet).then((c: any) => {
      if (!alive || !c) return;
      if (c.tiles) setTiles((t) => ({ ...t, ...c.tiles }));
      if (typeof c.opacity === 'number') setOpacity(c.opacity);
    });
    pull();
    const id = setInterval(pull, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Live stats — CPU/RAM every 2s, listening ports every 5s, clock every 1s.
  useEffect(() => {
    let alive = true;
    const pullStats = () => window.api?.invoke(CH.appGetStats).then((s: any) => { if (alive && s) setStats(s); });
    pullStats();
    const sid = setInterval(pullStats, 2000);
    const pullPorts = () => window.api?.invoke(CH.portsGet).then((p: any) => {
      if (!alive) return;
      const listening = Array.isArray(p) ? p.filter((x: any) => x.state === 'LISTENING').length : 0;
      setPortCount(listening);
    });
    pullPorts();
    const pid = setInterval(pullPorts, 5000);
    const cid = setInterval(() => alive && setNow(new Date()), 1000);
    return () => { alive = false; clearInterval(sid); clearInterval(pid); clearInterval(cid); };
  }, []);

  // Recent clipboard — only fetched while expanded (no work when collapsed).
  useEffect(() => {
    if (!expanded) return;
    let alive = true;
    const pull = () => window.api?.invoke(CH.clipboardGet).then((r: any) => {
      if (!alive) return;
      const items: Clip[] = Array.isArray(r?.items) ? r.items : Array.isArray(r) ? r : [];
      setClips(items.filter((c) => c.type === 'text' && (c.preview || c.text)).slice(0, 5));
    });
    pull();
    const id = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [expanded]);

  // Resize the window to fit the card whenever the layout changes (expand/collapse,
  // tile count, clip count). Measure the rendered card; add the 6px wrapper padding.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const width = expanded ? 320 : 236;
    const height = el.offsetHeight + 12;
    window.api?.invoke(CH.overlayResize, { width, height });
  }, [expanded, tiles.cpu, tiles.ram, tiles.ports, tiles.clock, clips.length]);

  const close = () => window.api?.invoke(CH.overlayToggle, false);
  const openApp = () => window.api?.invoke(CH.trayOpenMain);
  const copyClip = async (c: Clip) => {
    await window.api?.invoke(CH.clipboardCopy, { id: c.id });
    setCopied(c.id);
    setTimeout(() => setCopied((id) => (id === c.id ? null : id)), 1200);
  };
  const hhmm = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const allTiles: { key: keyof Tiles; icon: any; label: string; value: string }[] = [
    { key: 'cpu', icon: Cpu, label: 'CPU', value: stats.cpu },
    { key: 'ram', icon: MemoryStick, label: 'RAM', value: stats.ram },
    { key: 'ports', icon: Network, label: 'PORTS', value: portCount === null ? '—' : String(portCount) },
    { key: 'clock', icon: Clock, label: 'TIME', value: hhmm },
  ];
  const shown = allTiles.filter((t) => tiles[t.key]);

  return (
    <div
      className="h-screen w-screen p-1.5 overflow-hidden select-none"
      style={{ WebkitAppRegion: 'drag', opacity } as any}
    >
      <div ref={cardRef} className="rounded-2xl border border-border2/80 bg-surface/80 backdrop-blur-xl shadow-2xl flex flex-col ring-1 ring-black/40 overflow-hidden">
        {/* Header / drag handle */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
          <div className="flex items-center gap-1.5 text-muted">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-muted2">ONYX</span>
          </div>
          <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Collapse overlay' : 'Expand overlay'}
              className="p-1 rounded-md text-muted hover:text-text hover:bg-surface3 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={close}
              aria-label="Hide overlay"
              className="p-1 rounded-md text-muted hover:text-text hover:bg-surface3 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Tiles */}
        <div className={`grid gap-1.5 px-2.5 pb-2.5 ${shown.length <= 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {shown.length === 0 ? (
            <div className="flex items-center justify-center text-[10px] text-muted font-mono py-2">No tiles enabled</div>
          ) : (
            shown.map(({ key, icon: Icon, label, value }) => (
              <div key={key} className="flex items-center gap-2 rounded-lg bg-background/60 border border-border/70 px-2.5 py-1.5 min-w-0">
                <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-[8px] font-mono font-bold tracking-widest text-muted leading-none">{label}</div>
                  <div className="text-[13px] font-mono font-semibold text-text leading-tight truncate">{value}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Expanded panel: recent clipboard + quick actions */}
        {expanded && (
          <div className="px-2.5 pb-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="h-px bg-border/70 -mx-0.5" />
            <div className="flex items-center gap-1.5 px-0.5">
              <ClipboardList className="w-3 h-3 text-muted" />
              <span className="text-[8px] font-mono font-bold tracking-widest text-muted">CLIPBOARD</span>
            </div>
            {clips.length === 0 ? (
              <div className="text-[10px] text-muted/70 font-mono px-1 py-1.5">Nothing copied yet.</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-[152px] overflow-y-auto no-scrollbar">
                {clips.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => copyClip(c)}
                    title="Click to copy"
                    className="group flex items-center gap-2 rounded-lg bg-background/50 border border-border/60 px-2 py-1.5 text-left hover:border-primary/40 hover:bg-background/80 transition-colors"
                  >
                    {copied === c.id
                      ? <Check className="w-3 h-3 text-success flex-shrink-0" />
                      : <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.pinned ? 'bg-primary' : 'bg-muted/50'}`} />}
                    <span className="text-[11px] font-mono text-text2 truncate min-w-0">{c.preview || c.text}</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={openApp}
              className="flex items-center justify-center gap-2 rounded-lg bg-surface3/70 hover:bg-border2 border border-border text-text text-[11px] font-semibold py-1.5 transition-colors active:scale-[0.98]"
            >
              <ExternalLink className="w-3 h-3" /> Open Onyx
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
