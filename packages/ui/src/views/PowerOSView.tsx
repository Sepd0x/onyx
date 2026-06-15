import { useState, useEffect, useRef } from 'react';
import { Battery, BatteryCharging, Zap, BrainCircuit, Activity, AlertTriangle, Loader2, HeartPulse, Leaf } from 'lucide-react';
import Switch from '../components/Switch';
import BatteryGauge from '../components/BatteryGauge';
import ViewHeader from '../components/ViewHeader';
import AiPanel from '../components/AiPanel';
import { MessageSquareText } from 'lucide-react';
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
  const [pending, setPending] = useState<string | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autoNotify, setAutoNotify] = useState(true);
  const [events, setEvents] = useState<any[]>([]);
  const [sysInfo, setSysInfo] = useState<{ battery: number | null; charging: boolean; estimatedTime: string | null }>(
    { battery: null, charging: false, estimatedTime: null }
  );
  const hasBatteryApi = useRef(false);
  // Status only (no poll); the explanation call is explicit, never wired to the 5s feed.
  const aiStatus = useIpc(CH.aiGetStatus, [], { pollMs: 0 }).data as any;
  const aiConfigured = aiStatus?.configured ?? false;
  const aiProvider = aiStatus?.provider;
  // Other vendor power tools running ⇒ Onyx's mode switching can fight them.
  const conflicts = useIpc(CH.appGetConflicts, [], { pollMs: 0 }).data as any;
  const powerTools: string[] = conflicts?.powerTools ?? [];

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

  // Switching the power mode spawns PowerShell (~1–2s). Track which profile is
  // in flight so the buttons show a pending state and can't be spammed — every
  // extra click would otherwise queue another PS call (audit B3).
  const setProfile = async (p: string) => {
    if (!window.api || aiEnabled || pending || p === activeProfile) return;
    setPending(p);
    try {
      await window.api.invoke(CH.powerSetProfile, p);
      invalidate('power:');
    } finally {
      setPending(null);
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
      <div className="mb-10">
        <ViewHeader
          icon={Zap}
          title="OS Power Manager"
          subtitle="Performance & battery lifespan controller"
          badge={<span className="bg-surface2 text-muted2 border border-border px-2 py-0.5 rounded-md text-[10px] font-mono">System hook</span>}
        />
      </div>

      {powerTools.length > 0 && (
        <div className="mb-8 flex items-start gap-3 bg-warning/10 border border-warning/30 text-warning rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="text-[12px] leading-relaxed">
            <span className="font-semibold">{powerTools.join(', ')}</span> {powerTools.length > 1 ? 'are' : 'is'} also running and {powerTools.length > 1 ? 'manage' : 'manages'} Windows power profiles.
            Onyx's auto-planner can conflict with {powerTools.length > 1 ? 'them' : 'it'} — keep only one in charge of power, or disable the dynamic planner below.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 flex flex-col gap-6">

          {/* AI Control Card */}
          <div className={`border p-6 rounded-xl relative overflow-hidden transition-colors ${aiEnabled ? 'bg-primary/5 border-primary/30' : 'bg-surface/40 border-border'}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-[14px] font-semibold text-text flex items-center gap-2 mb-1">
                  <BrainCircuit className={`w-4 h-4 ${aiEnabled ? 'text-accent' : 'text-muted'}`} /> Dynamic OS power planner
                </h3>
                <p className="text-[11px] text-muted leading-relaxed max-w-md mb-4">
                  Automatically adjusts the Windows power mode (the same control as the Settings power slider) from AC/battery state. Switches are debounced, your manual choice is restored on AC, and brightness is never touched.
                </p>
              </div>
              <Switch active={aiEnabled} onClick={toggleAI} label="Toggle AI power planner" />
            </div>
            {aiEnabled && (
              <>
                <div className="mt-2 text-[11px] text-accent bg-primary/10 border border-primary/20 px-3 py-2 rounded-md flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Auto-managing power mode from AC/battery events
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[11px] text-muted">Notify on each automatic switch</span>
                  <Switch active={autoNotify} onClick={toggleAutoNotify} label="Toggle auto-switch notifications" />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="micro-label">Windows power mode</span>
            <span className="text-[10px] font-mono text-muted/70">same as the Settings power slider</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Efficiency (Best power efficiency overlay — NOT Windows Battery Saver) */}
            <button
              onClick={() => setProfile('battery_saver')}
              disabled={aiEnabled || pending !== null}
              aria-busy={pending === 'battery_saver'}
              className={`p-5 rounded-xl border text-left transition-colors ${activeProfile === 'battery_saver' ? 'bg-primary/10 border-primary/40' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled || pending !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Leaf className={`w-5 h-5 mb-3 ${activeProfile === 'battery_saver' ? 'text-accent' : 'text-muted'}`} />
              <div className="text-[13px] font-semibold text-text">Efficiency</div>
              <div className="text-[11px] text-muted mt-1 leading-relaxed">Windows "Best efficiency" mode — caps CPU boost &amp; background work. Not Windows Battery Saver.</div>
              {pending === 'battery_saver'
                ? <div className="mt-3 text-[10px] font-medium text-accent flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Switching…</div>
                : activeProfile === 'battery_saver' && <div className="mt-3 text-[10px] font-medium text-accent">Active</div>}
            </button>

            {/* Balanced */}
            <button
              onClick={() => setProfile('balanced')}
              disabled={aiEnabled || pending !== null}
              aria-busy={pending === 'balanced'}
              className={`p-5 rounded-xl border text-left transition-colors ${activeProfile === 'balanced' ? 'bg-primary/10 border-primary/40' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled || pending !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Activity className={`w-5 h-5 mb-3 ${activeProfile === 'balanced' ? 'text-accent' : 'text-muted'}`} />
              <div className="text-[13px] font-semibold text-text">Balanced</div>
              <div className="text-[11px] text-muted mt-1 leading-relaxed">Default OS limits. Recommended for mixed usage.</div>
              {pending === 'balanced'
                ? <div className="mt-3 text-[10px] font-medium text-accent flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Switching…</div>
                : activeProfile === 'balanced' && <div className="mt-3 text-[10px] font-medium text-accent">Active</div>}
            </button>

            {/* Performance */}
            <button
              onClick={() => setProfile('performance')}
              disabled={aiEnabled || pending !== null}
              aria-busy={pending === 'performance'}
              className={`p-5 rounded-xl border text-left transition-colors ${activeProfile === 'performance' ? 'bg-primary/10 border-primary/40' : 'bg-surface/50 border-border hover:bg-surface2'} ${aiEnabled || pending !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Zap className={`w-5 h-5 mb-3 ${activeProfile === 'performance' ? 'text-accent' : 'text-muted'}`} />
              <div className="text-[13px] font-semibold text-text">Max performance</div>
              <div className="text-[11px] text-muted mt-1 leading-relaxed">Windows best-performance mode. Full CPU boost.</div>
              {pending === 'performance'
                ? <div className="mt-3 text-[10px] font-medium text-accent flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Switching…</div>
                : activeProfile === 'performance' && <div className="mt-3 text-[10px] font-medium text-accent">Active</div>}
            </button>
          </div>

          {/* Battery health + Windows Battery Saver guidance (#5/#6): be honest about
              what Onyx controls vs. what lives in Windows / the laptop vendor's app. */}
          <div className="bg-surface/40 border border-border rounded-xl p-5 flex flex-col gap-3">
            <h3 className="text-[13px] font-semibold text-text flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-accent" /> Battery health &amp; Windows Battery Saver
            </h3>
            <p className="text-[11px] text-muted leading-relaxed">
              The modes above are <span className="text-text2">Windows power modes</span> — they cap performance, not charging, and are <span className="text-text2">not</span> the same as <span className="text-text2">Windows Battery Saver</span>, which Windows enables automatically at a low charge.
            </p>
            <p className="text-[11px] text-muted leading-relaxed">
              To protect long-term battery health, cap charging at ~80%.{' '}
              {powerTools.length > 0 ? (
                <>Your laptop ships <span className="text-accent">{powerTools.join(', ')}</span> — set the charge limit there.</>
              ) : (
                <>Most laptops expose a charge limit in their vendor app (Lenovo Vantage, Dell Power Manager, MyASUS, …) or BIOS.</>
              )}
            </p>
            <p className="text-[10px] font-mono text-muted/60 leading-relaxed">
              Onyx doesn't change your charge threshold itself — that's vendor-specific firmware, and doing it blindly could misreport or fail. It points you to the right place instead.
            </p>
          </div>

          <AiPanel
            title="Explain power activity"
            icon={MessageSquareText}
            description="Why the planner switched modes recently, and whether your setup makes sense."
            cta="Explain"
            configured={aiConfigured}
            provider={aiProvider}
            run={async () => (await window.api?.invoke(CH.aiExplainPower, {
              profile: activeProfile,
              onBattery: !sysInfo.charging,
              battery: sysInfo.battery,
              charging: sysInfo.charging,
              conflicts: powerTools,
              events,
            })) ?? { error: 'failed' }}
          />
        </div>

        {/* Sidebar Stats & Logs */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface border border-border rounded-xl p-6 relative overflow-hidden card-lift">
            <div className="flex items-center gap-3 mb-2">
              {sysInfo.charging ? <BatteryCharging className="w-5 h-5 text-success" /> : <Battery className="w-5 h-5 text-text" />}
              <span className="text-[13px] font-semibold text-text">Battery</span>
            </div>
            {sysInfo.battery !== null ? (
              <div className="flex justify-center mt-3 mb-1">
                <BatteryGauge level={sysInfo.battery} charging={sysInfo.charging} />
              </div>
            ) : (
              <div className="mt-3 mb-1 h-[132px] flex flex-col items-center justify-center">
                <Zap className="w-8 h-8 text-success mb-2" />
                <span className="text-xl font-bold text-text">AC Power</span>
                <span className="micro-label mt-1">No battery detected</span>
              </div>
            )}
            <div className="mt-4 text-[10px] font-mono text-muted flex justify-between">
              <span>Status:</span> <span className="text-text">{sysInfo.charging ? 'Charging (AC)' : sysInfo.battery !== null ? 'On Battery' : 'Plugged in'}</span>
            </div>
            {sysInfo.estimatedTime && (
              <div className="mt-1.5 text-[10px] font-mono text-muted flex justify-between">
                <span>{sysInfo.charging ? 'Until full:' : 'Remaining:'}</span> <span className="text-text">{sysInfo.estimatedTime}</span>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl shadow-inner flex flex-col flex-1 max-h-[400px] font-mono">
            <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
              <Activity className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-text">Power audit log</span>
            </div>
            <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-3">
              {events.length === 0 ? (
                <div className="text-sm text-muted text-center py-6">No power events yet</div>
              ) : events.map((e, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-border/40 pb-3 last:border-0">
                  <div className="flex items-center justify-between text-[9px] text-muted">
                    <span>[{e.time}]</span>
                    <span className={`px-1.5 py-0.5 rounded font-medium ${e.type === 'AI_AGENT' ? 'text-accent bg-primary/15' : 'bg-surface2 text-text'}`}>
                      {e.type}
                    </span>
                  </div>
                  <div className={`text-[10px] leading-relaxed mt-1 ${e.type === 'AI_AGENT' ? 'text-accent/90' : 'text-text/80'}`}>
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
