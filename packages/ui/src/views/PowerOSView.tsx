import { useState, useEffect } from 'react';
import { Battery, BatteryCharging, Zap, BrainCircuit, Activity, Cpu, Box, AlertTriangle, MonitorSmartphone } from 'lucide-react';

export default function PowerOSView() {
  const [activeProfile, setActiveProfile] = useState('balanced');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [sysInfo, setSysInfo] = useState({ battery: 82, charging: false, estimatedTime: '4h 12m' });

  const load = async () => {
     if (window.api) {
        const d = await window.api.invoke('power:get');
        if (d) {
           setActiveProfile(d.activeProfile);
           setAiEnabled(d.aiEnabled);
           setEvents(d.events || []);
        }
     }
  };

  useEffect(() => {
    load();
    const iv = setInterval(() => {
       if (aiEnabled && Math.random() < 0.1) {
          window.api?.invoke('power:mockAIEvent').then(load);
       }
       if (Math.random() < 0.15) {
          setSysInfo(prev => ({ ...prev, battery: prev.charging ? Math.min(100, prev.battery + 1) : Math.max(0, prev.battery - 1)}));
       }
    }, 3000);
    return () => clearInterval(iv);
  }, [aiEnabled]);

  const setProfile = async (p: string) => {
    if (window.api) {
       await window.api.invoke('power:setProfile', p);
       load();
    }
  };

  const toggleAI = async () => {
     if (window.api) {
        await window.api.invoke('power:setAI', !aiEnabled);
        load();
        window.api.invoke('app:notify', { title: 'Onyx OS Manager', body: !aiEnabled ? 'AI Power Planner Activated.' : 'AI Power Planner Deactivated. Manual control.' });
     }
  };

  const toggleChargeStatus = () => {
     setSysInfo(prev => ({...prev, charging: !prev.charging}));
     if (window.api) {
        window.api.invoke('app:notify', { title: 'OS Hardware Event', body: sysInfo.charging ? 'Power cable disconnected.' : 'Power cable connected.'});
     }
  }

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
            <p className="text-xs font-mono text-muted tracking-wide mt-1.5 uppercase">Performance & Battery Lifespan Controller</p>
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
                          Intelligently shift power plans based on cable state, current open apps (like compilers/IDE), and battery remaining. Sends native system notifications on plan switches.
                       </p>
                   </div>
                   <button 
                     onClick={toggleAI}
                     className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-300 ${aiEnabled ? 'bg-primary' : 'bg-surface3 border border-border2'}`}
                   >
                     <div className={`w-4 h-4 bg-background rounded-full transition-transform duration-300 shadow-sm ${aiEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
                   </button>
                </div>
                {aiEnabled && (
                   <div className="mt-2 text-[10px] font-mono text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-md flex items-center gap-2">
                       <Activity className="w-3.5 h-3.5 animate-pulse" /> ACTIVELY MONITORING HARDWARE STATE & RESOURCES
                   </div>
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
                  <div className="text-[10px] font-mono text-muted mt-1 leading-relaxed">Limit background activity & underclock CPU.</div>
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
                  <div className="text-[10px] font-mono text-muted mt-1 leading-relaxed">Overdrive. Prevents sleep and unthrottles cores.</div>
                  {activeProfile === 'performance' && <div className="mt-3 text-[9px] font-bold text-amber-400 tracking-widest uppercase">Active Profile</div>}
               </button>
            </div>
            
            <div className="bg-surface/30 border border-border rounded-xl p-5 shadow-sm">
               <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted flex items-center gap-2 mb-4">
                  <MonitorSmartphone className="w-3.5 h-3.5" /> Hardware Mock Simulators
               </h4>
               <div className="flex gap-4">
                  <button onClick={toggleChargeStatus} className="px-4 py-2 bg-background border border-border hover:bg-surface2 text-text text-[11px] font-mono rounded-lg transition-colors">
                     Toggle Cable {sysInfo.charging ? '(Unplug)' : '(Plug in)'}
                  </button>
               </div>
            </div>

         </div>

         {/* Sidebar Stats & Logs */}
         <div className="flex flex-col gap-6">
             <div className="bg-[#050505] border border-border rounded-xl p-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                <div className="flex items-center gap-3 mb-2">
                   {sysInfo.charging ? <BatteryCharging className="w-5 h-5 text-green-400" /> : <Battery className="w-5 h-5 text-text" />}
                   <span className="text-[12px] font-bold uppercase tracking-widest text-text">Laptop Battery</span>
                </div>
                <div className="text-4xl font-bold mt-2 text-text flex items-baseline gap-1">
                   {sysInfo.battery}<span className="text-xl text-muted">%</span>
                </div>
                <div className="mt-4 text-[10px] font-mono text-muted flex justify-between">
                   <span>Status:</span> <span className="text-text">{sysInfo.charging ? 'Charging (AC)' : 'Discharging (Battery)'}</span>
                </div>
             </div>

             <div className="bg-[#050505] border border-border rounded-xl shadow-inner flex flex-col flex-1 max-h-[400px] font-mono">
                <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0 bg-surface/50">
                   <Activity className="w-4 h-4 text-green-500" />
                   <span className="text-[10px] font-bold text-text uppercase tracking-widest">Power Audit Log</span>
                </div>
                <div className="p-4 flex-1 overflow-y-auto w-full custom-scrollbar flex flex-col gap-3">
                    {events.map((e, i) => (
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
