import { useEffect, useState } from 'react';
import { Cpu, MemoryStick, Network, Clock, X, GripHorizontal } from 'lucide-react';
import { CH } from '../ipc';

// The always-on-top desktop widget (its own frameless, transparent BrowserWindow,
// routed via the #overlay hash). Compact, draggable, glanceable: live CPU/RAM/ports
// + a clock. Reads which tiles + opacity to show from overlay:get; polls stats like
// the titlebar. The whole card is a drag region except the close button.
type Tiles = { cpu: boolean; ram: boolean; ports: boolean; clock: boolean };

export default function OverlayView() {
  const [tiles, setTiles] = useState<Tiles>({ cpu: true, ram: true, ports: true, clock: true });
  const [opacity, setOpacity] = useState(0.92);
  const [stats, setStats] = useState<{ cpu: string; ram: string }>({ cpu: '—', ram: '—' });
  const [portCount, setPortCount] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

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

  const close = () => window.api?.invoke(CH.overlayToggle, false);
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
      <div className="h-full w-full rounded-2xl border border-border2/80 bg-surface/80 backdrop-blur-xl shadow-2xl flex flex-col ring-1 ring-black/40">
        {/* Header / drag handle */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-1.5 text-muted">
            <GripHorizontal className="w-3.5 h-3.5" />
            <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-muted2">ONYX</span>
          </div>
          <button
            onClick={close}
            aria-label="Hide overlay"
            className="p-1 -mr-1 rounded-md text-muted hover:text-text hover:bg-surface3 transition-colors"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Tiles */}
        <div className={`flex-1 grid gap-1.5 px-2.5 pb-2.5 ${shown.length <= 2 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {shown.length === 0 ? (
            <div className="flex items-center justify-center text-[10px] text-muted font-mono">No tiles enabled</div>
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
      </div>
    </div>
  );
}
