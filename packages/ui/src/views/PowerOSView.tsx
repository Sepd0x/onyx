import { useState, useEffect, useRef } from 'react';
import { Battery, BatteryCharging, Zap, BrainCircuit, Activity } from 'lucide-react';
import Switch from '../components/Switch';
import { CH } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';

function formatBatteryTime(b: any) {
  const secs = b.charging ? b.chargingTime : b.dischargingTime;
  if (!secs || secs === Infinity || !isFinite(secs)) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export default function PowerOSView() {
  const [activeProfile, setActiveProfile] = useState('balanced');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autoNotify, setAutoNotify] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [sysInfo, setSysInfo] = useState<{ battery: number | null; charging: boolean; estimatedTime: string | null }>(
    { battery: null, charging: false, estimatedTime: null }
  );
  const hasBatteryApi = useRef(false);

  // Profile + power events poll through the shared cache (5s); apply each payload to
  // local state, keeping the hasBatteryApi merge so the Web Battery API stays the
  // source of truth for charge level once it's available.
  const powerData = useIpc(CH.powerGet, [], { pollMs: 5000 }).data;
  useEffect(() => {
    const d = powerData;
    if (!d) return;
    setActiveProfile(d.activeProfile);
    setAiEnabled(d.aiEnabled);
    setAutoNotify(d.autoNotify !== false);
    setEvents(d.events || []);
    if (!hasBatteryApi.current && d.batteryState && typeof d.batteryState.charging === 'boolean') {
      setSysInfo(prev => ({ ...prev, charging: d.batteryState.charging }));
    }
  }, [powerData]);

  // Real battery telemetry via the Web Battery API (falls back to "AC" when absent).
  useEffect(() => {
    let activeFlag = true;
    let bat: any = null;
    const apply = () => {
      if (!activeFlag || !bat) return;
      setSysInfo({
        battery: Math.round((bat.level ?? 1) * 100),
        charging: !!bat.charging,
        estimatedTime: formatBatteryTime(bat)
      });
    };
    const nav: any = navigator;
    if (nav.getBattery) {
      nav.getBattery().then((b: any) => {
        hasBatteryApi.current = true;
        bat = b;
        apply();
        b.addEventListener('levelchange', apply);
        b.addEventListener('chargingchange', apply);
      }).catch(() => {});
    }
    return () => {
      activeFlag = false;
      if (bat) {
        bat.removeEventListener('levelchange', apply);
        bat.removeEventListener('chargingchange', apply);
      }
    };
  }, []);

  const setProfile = async (p: string) => {
    if (window.api) {
      await window.api.invoke(CH.powerSetProfile, p);
      invalidate('power:');
    }
  };

  const toggleAI = async () => {
    if (window.api) {
      await window.api.invoke(CH.powerSetAI, !aiEnabled);
      invalidate('power:');
      window.api.invoke(CH.appNotify, { title: 'Onyx OS Manager', body: !aiEnabled ? 'AI Power Planner Activated.' : 'AI Power Planner Deactivated. Manual control.' });
    }
  };

  const toggleAutoNotify = async () => {
    if (window.api) {
      setAutoNotify(!autoNotify); // optimistic — the 5s poll reconciles
      await window.api.invoke(CH.powerSetConfig, { autoNotify: !autoNotify });
    }
  };

  return (
    <div className="p-8 pb-24 md:p-10 max-w-6xl mx-auto h-full overflow-y-auto no-scrollbar relative animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-surface2 text-text rounded-xl border border-border shadow-[0_0_20px_rgba(34,197,94,0.15)]">
            <Zap className="w-6 h-6 text-green-500"/>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text tracking-tight flex items-center gap-3">
              OS Power Manager
              <span className="bg-green-500/20 text-green-500 border border-green-500/30 px-2 py-0.5 rounded-md text-[10px] font-mono tracking-widest uppercase">System Hook</span>
            </h2>
            <p className="text-xs font-mono text-muted tracking-wide mt-1.5 uppercase">Performance &amp; Battery Lifespan Controller</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 flex flex-col gap-6">

          {/* AI Control Card */}
          <div className={`border p-6 rounded-xl shadow-lg relative overflow-hidden transition-colors ${aiEnabled ? 'bg-[#8b5cf6]/5 border-[#8b5cf6]/30' : 'bg-surface/40 border-border'}`}>
            {aiEnabled && <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#8b5cf6] to-transparent animate-pulse"></div>}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[14px] font-bold text-text flex items-center gap-2 mb-1">
                  <BrainCircuit className={`w-4 h-4 ${aiEnabled ? 'text-primary' : 'text-muted'}`} /> Dynamic OS Power Planner
                </h3>
                <p className="text-[11px] text-muted leading-relaxed max-w-md mb-4">
                  Automatically adjusts the Windows power mode (the same control as the Settings power slider) from AC/battery state. Switches are debounced, your manual choice is restored on AC, and brightness is never touched.
                </p>
              </div>
              <Switch active={aiEnabled} onClick={toggleAI} label="Toggle AI power planner" />
            </div>
            {aiEnabled && (
              <>
                <div className="mt-2 text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-md flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 animate-pulse" /> Auto-managing power mode from AC/battery events
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted">Notify on each automatic switch</span>
                  <Switch active={autoNotify} onClick={toggleAutoNotify} label="Toggle auto-switch notifications" />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Battery Saver */}
            <button
              onClick={() => setProfile('battery_saver')}
              disabled={aiEnabled}
              className={`p-5 rounded-xl border text-left transition-all ${activeProfile === 'battery_saver' ? 'bg-indigo-500/10 border-indigo-500/40 shadow-inner' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Battery className={`w-5 h-5 mb-3 ${activeProfile === 'battery_saver' ? 'text-indigo-400' : 'text-muted'}`} />
              <div className="text-[13px] font-bold text-text">Battery Saver</div>
              <div className="text-[10px] font-mono text-muted mt-1 leading-relaxed">Windows efficiency mode. Less CPU boost &amp; background work.</div>
              {activeProfile === 'battery_saver' && <div className="mt-3 text-[9px] font-bold text-indigo-400 tracking-widest uppercase">Active Profile</div>}
            </button>

            {/* Balanced */}
            <button
              onClick={() => setProfile('balanced')}
              disabled={aiEnabled}
              className={`p-5 rounded-xl border text-left transition-all ${activeProfile === 'balanced' ? 'bg-green-500/10 border-green-500/40 shadow-inner' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Activity className={`w-5 h-5 mb-3 ${activeProfile === 'balanced' ? 'text-green-400' : 'text-muted'}`} />
              <div className="text-[13px] font-bold text-text">Balanced OS</div>
              <div className="text-[10px] font-mono text-muted mt-1 leading-relaxed">Default OS limits. Recommended for mixed usage.</div>
              {activeProfile === 'balanced' && <div className="mt-3 text-[9px] font-bold text-green-400 tracking-widest uppercase">Active Profile</div>}
            </button>

            {/* Performance */}
            <button
              onClick={() => setProfile('performance')}
              disabled={aiEnabled}
              className={`p-5 rounded-xl border text-left transition-all ${activeProfile === 'performance' ? 'bg-amber-500/10 border-amber-500/40 shadow-inner' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap className={`w-5 h-5 mb-3 ${activeProfile === 'performance' ? 'text-amber-400' : 'text-muted'}`} />
              <div className="text-[13px] font-bold text-text">Max Performance</div>
              <div className="text-[10px] font-mono text-muted mt-1 leading-relaxed">Windows best-performance mode. Full CPU boost.</div>
              {activeProfile === 'performance' && <div className="mt-3 text-[9px] font-bold text-amber-400 tracking-widest uppercase">Active Profile</div>}
            </button>
          </div>
        </div>

        {/* Sidebar Stats & Logs */}
        <div className="flex flex-col gap-6">
          <div className="bg-[#050505] border border-border rounded-xl p-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex items-center gap-3 mb-2">
              {sysInfo.charging ? <BatteryCharging className="w-5 h-5 text-green-400" /> : <Battery className="w-5 h-5 text-text" />}
              <span className="text-[12px] font-bold uppercase tracking-widest text-text">Battery</span>
            </div>
            <div className="text-4xl font-bold mt-2 text-text flex items-baseline gap-1">
              {sysInfo.battery !== null ? <>{sysInfo.battery}<span className="text-xl text-muted">%</span></> : <span className="text-2xl text-muted">AC Power</span>}
            </div>
            <div className="mt-4 text-[10px] font-mono text-muted flex justify-between">
              <span>Status:</span> <span className="text-text">{sysInfo.charging ? 'Charging (AC)' : sysInfo.battery !== null ? 'On Battery' : 'Plugged in'}</span>
            </div>
            {sysInfo.estimatedTime && (
              <div className="mt-1.5 text-[10px] font-mono text-muted flex justify-between">
                <span>{sysInfo.charging ? 'Until full:' : 'Remaining:'}</span> <span className="text-text">{sysInfo.estimatedTime}</span>
              </div>
            )}
          </div>

          <div className="bg-[#050505] border border-border rounded-xl shadow-inner flex flex-col flex-1 max-h-[400px] font-mono">
            <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="text-[10px] font-bold text-text uppercase tracking-widest">Power Audit Log</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-3">
              {events.length === 0 ? (
                <div className="text-[10px] text-muted uppercase tracking-widest text-center py-6">No power events yet</div>
              ) : events.map((e, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                  <div className="flex items-center justify-between text-[9px] text-muted">
                    <span>[{e.time}]</span>
                    <span className={`px-1.5 py-0.5 rounded font-bold ${e.type === 'AI_AGENT' ? 'text-primary bg-primary/20' : 'bg-surface2 text-text'}`}>
                      {e.type}
                    </span>
                  </div>
                  <div className={`text-[10px] leading-relaxed mt-1 ${e.type === 'AI_AGENT' ? 'text-primary/90' : 'text-text/80'}`}>
                    {e.msg}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
