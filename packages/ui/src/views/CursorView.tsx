import { useEffect, useState } from 'react';
import { Power, EyeOff, Moon, Settings2, BellOff, ChevronUp, ChevronDown } from 'lucide-react';
import Switch from '../components/Switch';
import { CH } from '../ipc';

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

  const NumInput = ({ val, onChange }: { val: number, onChange: (v: number) => void }) => (
    <div className="flex items-stretch bg-background border border-border rounded-lg overflow-hidden shadow-inner">
      <input 
        type="number" 
        value={val}
        readOnly
        className="w-14 bg-transparent py-2 text-sm text-center font-mono font-semibold text-text no-spin-buttons outline-none"
      />
      <div className="flex flex-col border-l border-border bg-surface3/50 h-auto">
        <button onClick={() => onChange(val + 1)} className="px-2 hover:bg-surface hover:text-text text-muted transition-colors border-b border-border flex items-center justify-center flex-1">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button onClick={() => onChange(val - 1)} className="px-2 hover:bg-surface hover:text-text text-muted transition-colors flex items-center justify-center flex-1">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-8 pb-24 max-w-4xl mx-auto h-full overflow-y-auto no-scrollbar">
      <div className="flex items-center gap-4 mb-10 pb-8 border-b border-border/60">
        <div className={`p-3.5 rounded-xl border shadow-lg transition-all duration-500 bg-surface2 text-text border-border`}>
          <EyeOff className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text tracking-tight">Focus Tools</h2>
          <p className="text-[10px] font-mono text-muted mt-1.5 tracking-widest uppercase">DISTRACTION-FREE WORKSPACE MODULE</p>
        </div>
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
                  ? 'bg-primary text-background shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-transparent' 
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
                 <NumInput val={config.seconds} onChange={(v) => saveConfig('seconds', v)} />
              </div>
            </div>
            <div className="h-px bg-border/80 w-full"></div>
            <div className="flex items-center justify-between">
              <div className="w-2/3 pr-6">
                <label className="text-[13px] font-medium text-text block mb-1">Hardware Deadzone <span className="text-[9px] text-muted font-normal ml-2 tracking-widest">(PX)</span></label>
                <p className="text-[10px] text-muted/70 leading-relaxed mt-1">Ignore minor mouse drifting.</p>
              </div>
              <div className="w-1/3 flex justify-end">
                 <NumInput val={config.deadzone} onChange={(v) => saveConfig('deadzone', v)} />
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
                  <div className="bg-background border border-border p-2 rounded-lg text-muted group-hover:text-amber-400 group-hover:border-amber-400/30 transition-all"><Moon className="w-4 h-4"/></div>
                  <div>
                    <h4 className="font-medium text-[13px] text-text">Keep Awake (Hardware)</h4>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed max-w-[200px]">Prevents OS and monitor from sleeping while coding.</p>
                  </div>
                </div>
                <Switch
                  active={!!config.keepAwake}
                  activeColor="bg-amber-500"
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
                  <div className="bg-background border border-border p-2 rounded-lg text-muted group-hover:text-red-400 group-hover:border-red-400/30 transition-all"><BellOff className="w-4 h-4"/></div>
                  <div>
                    <h4 className="font-medium text-[13px] text-text">Deep Focus OS Rules</h4>
                    <p className="text-[10px] text-muted mt-1 leading-relaxed max-w-[230px]">Triggers Do-Not-Disturb and overlays workspace universally.</p>
                  </div>
                </div>
                <Switch
                  active={!!config.focusMode}
                  activeColor="bg-red-500"
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
    </div>
  );
}
