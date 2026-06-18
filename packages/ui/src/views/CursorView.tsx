import { useEffect, useRef, useState } from 'react';
import { Power, EyeOff, Moon, Settings2, BellOff, ChevronUp, ChevronDown, ShieldBan, Plus, X, ShieldAlert } from 'lucide-react';
import Switch from '../components/Switch';
import ViewHeader from '../components/ViewHeader';
import PomodoroTimer from '../components/PomodoroTimer';
import { CH, EV } from '../ipc';

// Focus-Mode app blocker: while active, listed distraction apps (Discord, Steam, …)
// are force-closed in the background. Opt-in, explicit list only; the backend keeps a
// hardcoded denylist so OS-critical processes can never be added.
function AppBlocker() {
  const [state, setState] = useState<{ enabled: boolean; apps: string[]; blockedCount: number }>({ enabled: false, apps: [], blockedCount: 0 });
  const [draft, setDraft] = useState('');
  const [justBlocked, setJustBlocked] = useState<string | null>(null);
  const timer = useRef<any>(null);

  useEffect(() => {
    window.api?.invoke(CH.blockerGet).then((s: any) => s && setState(s));
    // Live feedback when the backend closes something.
    const unsub = window.api?.on(EV.blockerBlocked, (data: any) => {
      setState((s) => ({ ...s, blockedCount: data?.count ?? s.blockedCount + 1 }));
      setJustBlocked(data?.name || 'app');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setJustBlocked(null), 2600);
    });
    return () => { unsub?.(); clearTimeout(timer.current); };
  }, []);

  const toggle = async () => {
    const res = await window.api?.invoke(CH.blockerToggle, !state.enabled);
    if (res) setState(res);
  };
  const addApp = async () => {
    const v = draft.trim();
    if (!v) return;
    const apps = Array.from(new Set([...state.apps, v]));
    const res = await window.api?.invoke(CH.blockerSet, { apps });
    if (res) setState((s) => ({ ...s, ...res }));
    setDraft('');
  };
  const removeApp = async (app: string) => {
    const res = await window.api?.invoke(CH.blockerSet, { apps: state.apps.filter((a) => a !== app) });
    if (res) setState((s) => ({ ...s, ...res }));
  };

  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-sm font-semibold text-text tracking-tight flex items-center gap-2"><ShieldBan className="w-4 h-4 text-primary" /> App Blocker</h3>

      <div className="p-6 border border-border rounded-xl bg-surface/40 shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="pr-6">
            <h4 className="font-medium text-[13px] text-text">Block distraction apps</h4>
            <p className="text-[10px] text-muted/80 leading-relaxed mt-1 max-w-[280px]">While active, the apps below are force-closed in the background so you stay in flow.</p>
          </div>
          <div className="flex items-center gap-3">
            {state.blockedCount > 0 && (
              <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2.5 py-1">{state.blockedCount} closed</span>
            )}
            <Switch active={state.enabled} activeColor="bg-danger" label="Enable app blocker" onClick={toggle} />
          </div>
        </div>

        {justBlocked && (
          <div className="text-[11px] text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            Closed <span className="font-mono font-semibold">{justBlocked}</span> — stay focused.
          </div>
        )}

        <div className="flex items-stretch gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addApp(); }}
            placeholder="e.g. Discord.exe"
            aria-label="App to block"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-[12px] font-mono text-text placeholder:text-muted/60 outline-none focus:border-primary/50 transition-colors"
          />
          <button onClick={addApp} className="px-3 rounded-lg bg-surface3 hover:bg-border2 border border-border text-text flex items-center gap-1.5 text-[11px] font-semibold transition-colors active:scale-95">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {state.apps.length === 0 ? (
          <p className="text-[11px] text-muted/70 text-center py-2">No apps blocked yet. Add one above.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {state.apps.map((app) => (
              <span key={app} className="group inline-flex items-center gap-1.5 bg-surface3/70 border border-border rounded-full pl-3 pr-1.5 py-1 text-[11px] font-mono text-text">
                {app}
                <button onClick={() => removeApp(app)} aria-label={`Remove ${app}`} className="rounded-full p-0.5 text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted/60 leading-relaxed flex items-start gap-1.5">
          <ShieldAlert className="w-3 h-3 mt-0.5 flex-shrink-0" />
          OS-critical processes and Onyx itself can never be blocked. Apps are force-closed, so save your work first.
        </p>
      </div>
    </div>
  );
}

// Accessible stepper, hoisted to module scope so it isn't recreated each render
// (the old inline version was readOnly and lost focus on every keystroke).
function NumInput({ val, onChange, label }: { val: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-stretch bg-background border border-border rounded-lg overflow-hidden shadow-inner focus-within:border-primary/50 transition-colors">
      <input
        type="number"
        min={1}
        value={val}
        aria-label={label}
        onChange={e => { const v = parseInt(e.target.value, 10); if (!Number.isNaN(v)) onChange(v); }}
        className="w-14 bg-transparent py-2 text-sm text-center font-mono font-semibold text-text no-spin-buttons outline-none"
      />
      <div className="flex flex-col border-l border-border bg-surface3/50 h-auto">
        <button aria-label={`Increase ${label}`} onClick={() => onChange(val + 1)} className="px-2 hover:bg-surface hover:text-text text-muted transition-colors border-b border-border flex items-center justify-center flex-1 active:scale-90">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(val - 1)} className="px-2 hover:bg-surface hover:text-text text-muted transition-colors flex items-center justify-center flex-1 active:scale-90">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function CursorView() {
  const [config, setConfig] = useState<any>({ seconds: 5, deadzone: 4, active: false, dnd: false, dim: false });

  useEffect(() => {
    if (window.api) {
      window.api.invoke(CH.cursorGetConfig).then((c: any) => setConfig(c));
    }
  }, []);

  const toggle = async (key: string) => {
    const val = !config[key];
    const newConfig = { ...config, [key]: val };
    setConfig(newConfig);
    if (window.api) {
      if (key === 'active') await window.api.invoke(CH.cursorToggle);
      else await window.api.invoke(CH.cursorSetConfig, { [key]: val });
    }
  };

  const saveConfig = async (key: string, value: number) => {
    if (value < 1) value = 1;
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    if (window.api) await window.api.invoke(CH.cursorSetConfig, { [key]: value });
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-4xl mx-auto h-full overflow-y-auto no-scrollbar animate-in fade-in duration-300">
      <div className="mb-8 pb-8 border-b border-border/60">
        <ViewHeader icon={EyeOff} title="Focus Mode" subtitle="Distraction-free workspace module" />
      </div>

      <div className="mb-8">
        <PomodoroTimer />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Core Cursor Auto Hide */}
        <div className="flex flex-col gap-5">
           <h3 className="text-sm font-semibold text-text tracking-tight flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary"/> Cursor Auto-Hide</h3>
           
           <div className="flex items-center justify-between p-5 bg-surface/80 backdrop-blur border border-border rounded-xl shadow-sm">
            <div>
              <h4 className="font-medium text-[13px] text-text">Engine Status</h4>
              <p className="text-[11px] text-muted mt-1">Background mouse tracking</p>
            </div>
            <button 
              onClick={() => toggle('active')}
              className={`px-5 py-2 rounded-lg text-[10px] font-bold tracking-widest font-mono flex items-center gap-2 transition-all duration-300 ${
                config.active 
                  ? 'bg-primary text-background shadow-[0_0_15px_rgb(var(--primary)/0.3)] border border-transparent' 
                  : 'bg-surface3 text-text hover:bg-border2 border border-border'
              }`}
            >
              <Power className="w-3 h-3" />
              {config.active ? 'ACTIVE' : 'INACTIVE'}
            </button>
          </div>

          <div className="p-6 border border-border rounded-xl bg-surface/40 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="w-2/3 pr-6">
                <label className="text-[13px] font-medium text-text block mb-1">Inactivity Timeout <span className="text-[9px] text-muted font-normal ml-2 tracking-widest">(SEC)</span></label>
                <p className="text-[10px] text-muted/70 leading-relaxed mt-1">Hide cursor after absolute inactivity.</p>
              </div>
              <div className="w-1/3 flex justify-end">
                 <NumInput val={config.seconds} onChange={(v) => saveConfig('seconds', v)} label="Inactivity timeout in seconds" />
              </div>
            </div>
            <div className="h-px bg-border/80 w-full"></div>
            <div className="flex items-center justify-between">
              <div className="w-2/3 pr-6">
                <label className="text-[13px] font-medium text-text block mb-1">Hardware Deadzone <span className="text-[9px] text-muted font-normal ml-2 tracking-widest">(PX)</span></label>
                <p className="text-[10px] text-muted/70 leading-relaxed mt-1">Ignore minor mouse drifting.</p>
              </div>
              <div className="w-1/3 flex justify-end">
                 <NumInput val={config.deadzone} onChange={(v) => saveConfig('deadzone', v)} label="Hardware deadzone in pixels" />
              </div>
            </div>
          </div>
        </div>

        {/* Deep Focus Modes */}
        <div className="flex flex-col gap-5">
           <h3 className="text-sm font-semibold text-text tracking-tight flex items-center gap-2"><Moon className="w-4 h-4 text-primary"/> Environment Control</h3>
           
           <div className="p-1 border border-border rounded-xl bg-surface/40 flex flex-col">
              
              <div className="p-5 flex items-center justify-between border-b border-border/50 hover:bg-surface/60 transition-colors rounded-t-xl group">
                <div className="flex items-center gap-4">
                  <div className="bg-background border border-border p-2 rounded-lg text-muted group-hover:text-warning group-hover:border-warning/30 transition-all"><Moon className="w-4 h-4"/></div>
                  <div>
                    <h4 className="font-medium text-[13px] text-text">Keep Awake (Hardware)</h4>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed max-w-[200px]">Prevents OS and monitor from sleeping while coding.</p>
                  </div>
                </div>
                <Switch
                  active={!!config.keepAwake}
                  activeColor="bg-warning"
                  label="Keep awake (prevent sleep)"
                  onClick={async () => {
                     const ns = !config.keepAwake;
                     setConfig({...config, keepAwake: ns});
                     if (window.api) await window.api.invoke(CH.envKeepAwake, ns);
                  }}
                />
              </div>

              <div className="p-5 flex items-center justify-between hover:bg-surface/60 transition-colors rounded-b-xl group">
                <div className="flex items-center gap-4">
                  <div className="bg-background border border-border p-2 rounded-lg text-muted group-hover:text-danger group-hover:border-danger/30 transition-all"><BellOff className="w-4 h-4"/></div>
                  <div>
                    <h4 className="font-medium text-[13px] text-text">Deep Focus OS Rules</h4>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed max-w-[230px]">Triggers Do-Not-Disturb and overlays workspace universally.</p>
                  </div>
                </div>
                <Switch
                  active={!!config.focusMode}
                  activeColor="bg-danger"
                  label="Deep focus OS rules"
                  onClick={async () => {
                     const ns = !config.focusMode;
                     setConfig({...config, focusMode: ns});
                     if (window.api) await window.api.invoke(CH.envFocusMode, ns);
                  }}
                />
              </div>

           </div>
        </div>

      </div>

      <div className="mt-8 pt-8 border-t border-border/60">
        <AppBlocker />
      </div>
    </div>
  );
}
