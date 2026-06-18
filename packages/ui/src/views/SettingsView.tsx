import { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Zap, Power, Palette, KeyRound, BrainCircuit, LayoutGrid, AlertTriangle, Download, Upload, PictureInPicture2 } from 'lucide-react';
import Switch from '../components/Switch';
import KeyCapture from '../components/KeyCapture';
import ViewHeader from '../components/ViewHeader';
import ToolCatalog from '../components/ToolCatalog';
import { CH, EV } from '../ipc';
import { useIpc, invalidate } from '../lib/ipcCache';
import { ACCENTS, applyAccent } from '../lib/accents';

export default function SettingsView() {
  const [config, setConfig] = useState<any>({ launchOnStartup: false, startMinimized: false, autoScanGit: false, autoHideCursorOnStart: false, theme: 'midnight' });
  const [updateStatus, setUpdateStatus] = useState<string>('');
  // Update flow state for the buttons (string above is the human message).
  const [updatePhase, setUpdatePhase] = useState<'idle' | 'available' | 'downloading' | 'ready'>('idle');
  const [aiStatus, setAiStatus] = useState<any>({ provider: 'anthropic', configured: false, encryptionAvailable: true, model: 'claude-haiku-4-5', providers: [] });
  const [aiKey, setAiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  // Desktop overlay state lives in its own backend (overlay:*), not appConfig.
  const [overlay, setOverlay] = useState<{ enabled: boolean; opacity: number; tiles: Record<string, boolean> }>({ enabled: false, opacity: 0.92, tiles: { cpu: true, ram: true, ports: true, clock: true } });
  // Settings are grouped into categories (the page grew too long as one scroll).
  // One category shows at a time; sections keep their place in the tree and are
  // hidden via a class when their category isn't active (no remount, no churn).
  const [cat, setCat] = useState('general');
  // Conflict surface: whether the global hotkey actually registered (another app
  // may have grabbed Ctrl+Alt+D first).
  const conflicts = useIpc(CH.appGetConflicts, [], { pollMs: 0 }).data as any;

  const loadAiStatus = async () => {
    if (window.api) {
      const s: any = await window.api.invoke(CH.aiGetStatus);
      if (s) { setAiStatus(s); setAiModel(s.model || ''); }
    }
  };

  const saveModel = async () => {
    if (!window.api) return;
    await window.api.invoke(CH.aiSetModel, { provider: aiStatus.provider, model: aiModel.trim() });
    await loadAiStatus();
    invalidate('ai:');
  };

  // Pick a preset model: set + persist directly (don't rely on aiModel state,
  // which updates asynchronously).
  const pickModel = async (m: string) => {
    setAiModel(m);
    if (!window.api) return;
    await window.api.invoke(CH.aiSetModel, { provider: aiStatus.provider, model: m });
    await loadAiStatus();
    invalidate('ai:');
  };

  useEffect(() => {
    if (window.api) {
      window.api.invoke(CH.appGetConfig).then((c: any) => {
        setConfig(c || {});
        if(c?.theme) {
          document.documentElement.setAttribute('data-theme', c.theme);
        }
      });
      loadAiStatus();
      window.api.invoke(CH.overlayGet).then((o: any) => o && setOverlay(o));
      window.api.on(EV.appUpdateAvailable, (version: string) => {
        setUpdatePhase('available');
        setUpdateStatus(`Update ${version} available.`);
      });
      window.api.on(EV.appUpdateProgress, (pct: number) => {
        setUpdatePhase('downloading');
        setUpdateStatus(`Downloading… ${pct}%`);
      });
      window.api.on(EV.appUpdateDownloaded, () => {
        setUpdatePhase('ready');
        setUpdateStatus('Update ready to install');
      });
      window.api.on(EV.appUpdateError, (m: string) => {
        setUpdatePhase('idle');
        setUpdateStatus(`Update failed: ${m}`);
        setTimeout(() => setUpdateStatus(''), 6000);
      });
    }
  }, []);

  const saveAiKey = async () => {
    if (!window.api || !aiKey.trim()) return;
    setAiBusy(true);
    setAiMsg('');
    try {
      const res: any = await window.api.invoke(CH.aiSetKey, { provider: aiStatus.provider, key: aiKey });
      if (res?.warning) { setAiMsg(res.warning); return; }
      if (res?.ok) {
        setAiKey('');
        await loadAiStatus();
        invalidate('ai:'); // refresh the status the Inspector/Power panels read
        await testKey('Key saved'); // tell the user right away if it actually works
      }
    } finally {
      setAiBusy(false);
    }
  };

  // A tiny live call so the user learns immediately whether the active provider +
  // key + model work (catches the "free-tier quota: 0 for this model" case).
  const testKey = async (prefix = 'Key') => {
    if (!window.api) return;
    setAiMsg(`${prefix} — testing…`);
    const t: any = await window.api.invoke(CH.aiTest);
    if (t?.ok) setAiMsg(`${prefix} and working ✓`);
    else setAiMsg(t?.detail || `${prefix}, but the test failed: ${t?.error || 'unknown'}`);
  };

  const selectProvider = async (provider: string) => {
    if (!window.api || provider === aiStatus.provider) return;
    setAiKey('');
    setAiMsg('');
    await window.api.invoke(CH.aiSetProvider, provider);
    await loadAiStatus();
    invalidate('ai:');
  };

  const clearAiKey = async () => {
    if (!window.api) return;
    setAiBusy(true);
    setAiMsg('');
    try {
      await window.api.invoke(CH.aiSetKey, { provider: aiStatus.provider, key: '' });
      setAiKey('');
      setAiMsg('API key removed.');
      await loadAiStatus();
      invalidate('ai:'); // refresh the status the Inspector/Power panels read
    } finally {
      setAiBusy(false);
    }
  };

  // Backup & restore (#26): export/import config + snippets + launchers. Never
  // touches API keys or the GitHub token. Import applies via the existing save
  // channels so each tool's in-memory state stays in sync.
  const exportSettings = async () => {
    if (!window.api) return;
    setBackupMsg('');
    const [snippets, launchers] = await Promise.all([
      window.api.invoke(CH.snippetsGet),
      window.api.invoke(CH.launchersGet),
    ]);
    const res: any = await window.api.invoke(CH.settingsExport, { config, snippets, launchers });
    if (res?.ok) setBackupMsg('Settings exported ✓');
    else if (res?.error) setBackupMsg(res.error);
  };

  const importSettings = async () => {
    if (!window.api) return;
    setBackupMsg('');
    const res: any = await window.api.invoke(CH.settingsImport);
    if (res?.canceled) return;
    if (res?.error) { setBackupMsg(res.error); return; }
    const d = res?.data || {};
    if (d.config && typeof d.config === 'object') {
      await window.api.invoke(CH.appSetConfig, d.config);
      setConfig((c: any) => ({ ...c, ...d.config }));
      if (d.config.theme) document.documentElement.setAttribute('data-theme', d.config.theme);
      if ('accent' in d.config) applyAccent(d.config.accent);
    }
    if (Array.isArray(d.snippets)) await window.api.invoke(CH.snippetsSave, d.snippets);
    if (Array.isArray(d.launchers)) await window.api.invoke(CH.launchersSave, d.launchers);
    invalidate('app:'); invalidate('snippets:'); invalidate('launchers:');
    setBackupMsg('Settings imported ✓');
  };

  const checkForUpdates = async () => {
    setUpdateStatus('Checking for updates…');
    const res = await window.api?.invoke(CH.appCheckForUpdates);
    if (res?.state === 'available') {
      // The update-available event sets the phase + Download button; keep the message.
      setUpdateStatus(res.message);
      return;
    }
    setUpdateStatus(res?.message ?? 'Update check unavailable right now.');
    setTimeout(() => setUpdateStatus(''), 5000);
  };

  const downloadUpdate = () => {
    setUpdatePhase('downloading');
    setUpdateStatus('Downloading… 0%');
    window.api?.invoke(CH.appDownloadUpdate);
  };

  const installUpdate = () => {
    window.api?.invoke(CH.appInstallUpdate);
  };

  // Defaults so a toggle reads correctly before its key is ever written. Without
  // this, default-on switches (undefined in a fresh config) needed two clicks to
  // turn off because `!undefined` is `true`.
  const TOGGLE_DEFAULTS: Record<string, boolean> = {
    enableGlobalHotkey: true, enableNotifications: true, enableAnimations: true,
    enableAIFeatures: true, enableTrayDashboard: true,
    trayShowCpu: true, trayShowRam: true, trayShowPorts: true, trayShowGuards: false,
  };

  const toggle = async (key: string) => {
    const cur = config[key] ?? (TOGGLE_DEFAULTS[key] ?? false);
    const newConfig = { ...config, [key]: !cur };
    setConfig(newConfig);
    if (window.api) {
      await window.api.invoke(CH.appSetConfig, newConfig);
    }
  };

  // Desktop overlay controls (separate backend, not appConfig).
  const toggleOverlay = async () => {
    const en = await window.api?.invoke(CH.overlayToggle, !overlay.enabled);
    setOverlay((o) => ({ ...o, enabled: !!en }));
  };
  const setOverlayOpacity = async (opacity: number) => {
    setOverlay((o) => ({ ...o, opacity })); // instant feedback
    const r: any = await window.api?.invoke(CH.overlaySet, { opacity });
    if (r) setOverlay((o) => ({ ...o, ...r }));
  };
  const toggleOverlayTile = async (key: string) => {
    const tiles = { ...overlay.tiles, [key]: !overlay.tiles[key] };
    setOverlay((o) => ({ ...o, tiles }));
    const r: any = await window.api?.invoke(CH.overlaySet, { tiles });
    if (r) setOverlay((o) => ({ ...o, ...r }));
  };

  const DEFAULT_HOTKEY = 'CommandOrControl+Alt+D';
  const setGlobalHotkey = async (accel: string) => {
    const newConfig = { ...config, globalHotkey: accel };
    setConfig(newConfig);
    if (window.api) await window.api.invoke(CH.appSetConfig, newConfig);
  };

  // Tool enable/disable (#28 MVP): a disabled tool is hidden from the sidebar +
  // command palette. Stored as an exclusion list so new tools default to enabled.
  const toggleTool = async (id: string) => {
    const disabled: string[] = Array.isArray(config.disabledTools) ? config.disabledTools : [];
    const next = disabled.includes(id) ? disabled.filter((d) => d !== id) : [...disabled, id];
    const newConfig = { ...config, disabledTools: next };
    setConfig(newConfig);
    if (window.api) await window.api.invoke(CH.appSetConfig, newConfig);
  };

  const setTheme = async (theme: string) => {
    const newConfig = { ...config, theme };
    setConfig(newConfig);
    document.documentElement.setAttribute('data-theme', theme);
    if (window.api) {
      await window.api.invoke(CH.appSetConfig, newConfig);
    }
  }

  const setAccent = async (accent: string) => {
    const newConfig = { ...config, accent };
    setConfig(newConfig);
    applyAccent(accent); // instant feedback; App's poll reconciles too
    if (window.api) await window.api.invoke(CH.appSetConfig, newConfig);
  };

  // Active-provider metadata (label, placeholder, key URL) for the AI section.
  const providers: any[] = aiStatus.providers || [];
  const activeMeta: any = providers.find((p) => p.key === aiStatus.provider) || { label: 'AI provider', placeholder: 'API key', keyUrl: '' };

  // Category nav. A section's wrapper uses sectionCls(id) so only the active
  // category renders; everything else collapses to `hidden`.
  const CATS: { id: string; label: string; icon: any }[] = [
    { id: 'general', label: 'General', icon: Power },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'surfaces', label: 'Surfaces', icon: LayoutGrid },
    { id: 'tools', label: 'Tools', icon: LayoutGrid },
    { id: 'ai', label: 'AI', icon: BrainCircuit },
    { id: 'data', label: 'Data', icon: Download },
    { id: 'about', label: 'About', icon: ShieldCheck },
  ];
  const sectionCls = (c: string) => (cat === c ? 'flex flex-col gap-4' : 'hidden');

  return (
    <div className="h-full flex flex-col bg-transparent relative">
      <div className="flex-shrink-0 px-10 pt-10 pb-6 border-b border-border/60 z-20 bg-background/50 backdrop-blur-sm">
        <ViewHeader icon={Settings} title="System Configuration" subtitle="Global preferences & modules" />
      </div>

      <div className="flex-1 overflow-y-auto p-10 pt-8 no-scrollbar pb-24">
        <div className="max-w-2xl mx-auto flex flex-col gap-8">

        {/* Category nav — one settings group at a time, instead of one long scroll. */}
        <div className="flex flex-wrap gap-1.5 -mb-2">
          {CATS.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${cat === c.id ? 'bg-surface2 text-text border-border2' : 'text-muted2 border-border hover:bg-surface2 hover:text-text'}`}
              >
                <Icon className="w-3.5 h-3.5" /> {c.label}
              </button>
            );
          })}
        </div>

        <div className={sectionCls('general')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><Power className="w-4 h-4 text-accent"/> Core run state</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Launch on OS Startup</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Automatically start Onyx in the background.</p>
              </div>
              <Switch active={config.launchOnStartup} onClick={() => toggle('launchOnStartup')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Start Minimized to System Tray</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Keep the main window hidden when launching.</p>
              </div>
              <Switch active={config.startMinimized} onClick={() => toggle('startMinimized')} />
            </div>
          </div>
        </div>

        <div className={sectionCls('general')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><Zap className="w-4 h-4 text-accent"/> Module automation</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Auto-activate Cursor Auto-Hide</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Enable Focus Mode engine automatically upon startup.</p>
              </div>
              <Switch active={config.autoHideCursorOnStart} onClick={() => toggle('autoHideCursorOnStart')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Auto-scan Repositories</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Git Pulse will automatically locate new local projects.</p>
              </div>
              <Switch active={config.autoScanGit} onClick={() => toggle('autoScanGit')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Global Hotkey</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Toggle Onyx visibility from anywhere in the OS.</p>
                {conflicts && conflicts.hotkeyRegistered === false && (config.enableGlobalHotkey ?? true) && (
                  <p className="text-[10px] text-warning mt-1.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> The current combo is already used by another app — pick a different one below.
                  </p>
                )}
              </div>
              <Switch active={config.enableGlobalHotkey ?? true} onClick={() => toggle('enableGlobalHotkey')} />
            </div>
            {(config.enableGlobalHotkey ?? true) && (
              <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors gap-4">
                <div className="min-w-0">
                  <h3 className="font-medium text-[13px] text-text">Show/hide shortcut</h3>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">Click, then press your combo (a modifier is required). Change it if another app already uses it.</p>
                </div>
                <KeyCapture
                  value={config.globalHotkey || DEFAULT_HOTKEY}
                  onChange={setGlobalHotkey}
                  onReset={config.globalHotkey && config.globalHotkey !== DEFAULT_HOTKEY ? () => setGlobalHotkey(DEFAULT_HOTKEY) : undefined}
                />
              </div>
            )}
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable System Notifications</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Allow tools and AI agents to send OS-level notifications.</p>
              </div>
              <Switch active={config.enableNotifications ?? true} onClick={() => toggle('enableNotifications')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Rich Animations</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show particle glows, motion transitions, and UI effects.</p>
              </div>
              <Switch active={config.enableAnimations ?? true} onClick={() => toggle('enableAnimations')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable Inspector</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Shows the Inspector tab with real repo-sync and dev-process readouts (local; the optional AI insights send the shown data to your provider).</p>
              </div>
              <Switch active={config.enableAIFeatures ?? true} onClick={() => toggle('enableAIFeatures')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Enable System Tray Mini-Dashboard</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show a discreet quick-access panel next to the system clock.</p>
              </div>
              <Switch active={config.enableTrayDashboard ?? true} onClick={() => toggle('enableTrayDashboard')} />
            </div>
          </div>
        </div>
        
        <div className={sectionCls('surfaces')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-accent"/> Tray dashboard</h3>
           <div className={`bg-surface border border-border rounded-xl overflow-hidden shadow-sm transition-opacity ${(config.enableTrayDashboard ?? true) ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">CPU tile</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show live CPU usage in the tray popup.</p>
              </div>
              <Switch active={config.trayShowCpu ?? true} onClick={() => toggle('trayShowCpu')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">RAM tile</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show live memory usage in the tray popup.</p>
              </div>
              <Switch active={config.trayShowRam ?? true} onClick={() => toggle('trayShowRam')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Active ports tile</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show the count of listening ports.</p>
              </div>
              <Switch active={config.trayShowPorts ?? true} onClick={() => toggle('trayShowPorts')} />
            </div>
            <div className="px-6 py-4 flex items-center justify-between hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Active guards tile</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">Show how many Session Guard wake-locks are held.</p>
              </div>
              <Switch active={config.trayShowGuards ?? false} onClick={() => toggle('trayShowGuards')} />
            </div>
           </div>
           <p className="text-[10px] text-muted/70 -mt-1">Tray layout updates the next time you open the popup.</p>
        </div>

        <div className={sectionCls('surfaces')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><PictureInPicture2 className="w-4 h-4 text-accent"/> Desktop overlay <span className="text-[9px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded">Always on top</span></h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 hover:bg-surface2 transition-colors">
              <div>
                <h3 className="font-medium text-[13px] text-text">Show desktop overlay</h3>
                <p className="text-[11px] text-muted mt-1 leading-relaxed">A small, draggable widget that floats above your windows with live system stats.</p>
              </div>
              <Switch active={overlay.enabled} onClick={toggleOverlay} />
            </div>
            <div className={`transition-opacity ${overlay.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
              <div className="px-6 py-4 flex items-center justify-between border-b border-border/50 gap-6">
                <div className="min-w-0">
                  <h3 className="font-medium text-[13px] text-text">Opacity</h3>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">How transparent the widget sits over your desktop.</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <input
                    type="range" min={0.3} max={1} step={0.02}
                    value={overlay.opacity}
                    onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                    aria-label="Overlay opacity"
                    className="w-32 accent-primary"
                  />
                  <span className="text-[10px] font-mono text-muted2 w-8 text-right">{Math.round(overlay.opacity * 100)}%</span>
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-medium text-[13px] text-text">Tiles</h3>
                  <p className="text-[11px] text-muted mt-1 leading-relaxed">Choose which readouts the overlay shows.</p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {([['cpu', 'CPU'], ['ram', 'RAM'], ['ports', 'Ports'], ['clock', 'Clock']] as [string, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => toggleOverlayTile(key)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${overlay.tiles[key] ? 'bg-surface2 text-text border-border2' : 'text-muted2 border-border hover:bg-surface2 hover:text-text'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
           </div>
           <p className="text-[10px] text-muted/70 -mt-1">Drag the widget anywhere; its position is remembered. Also toggleable from the tray menu.</p>
        </div>

        <div className={sectionCls('tools')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><LayoutGrid className="w-4 h-4 text-accent"/> Tools <span className="text-[9px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded">Pick what you use</span></h3>
           <ToolCatalog config={config} onToggle={toggleTool} />
           <p className="text-[10px] text-muted/70 -mt-1">Disabled tools are hidden from the sidebar and command palette — turn them back on any time.</p>
        </div>

        <div className={sectionCls('ai')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><BrainCircuit className="w-4 h-4 text-accent"/> AI assistant <span className="text-[9px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded">Opt-in</span></h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden shadow-sm p-6 flex flex-col gap-4">
             {/* Provider picker — Anthropic / OpenAI / Google. Each keeps its own key. */}
             <div className="grid grid-cols-3 gap-1.5 bg-background border border-border rounded-lg p-1">
               {providers.map((p) => (
                 <button
                   key={p.key}
                   onClick={() => selectProvider(p.key)}
                   className={`relative px-2 py-2 rounded-md text-[11px] font-medium transition-colors ${aiStatus.provider === p.key ? 'bg-surface2 text-text border border-border2' : 'text-muted2 hover:text-text hover:bg-surface2/60 border border-transparent'}`}
                 >
                   {p.label.split(' ')[0]}
                   {p.configured && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-success" title="Key configured" />}
                 </button>
               ))}
             </div>

             <div className="flex items-start justify-between gap-4">
               <div className="min-w-0">
                 <h3 className="font-medium text-[13px] text-text flex items-center gap-2">
                   <KeyRound className="w-3.5 h-3.5 text-muted" /> {activeMeta.label} API Key
                 </h3>
                 <p className="text-[11px] text-muted mt-1 leading-relaxed">
                   Powers real commit-message generation and Inspector insights. Stored encrypted on this device via the OS keychain; requests are sent from the app (never the browser) to your chosen provider{activeMeta.keyUrl ? <>. Get a key at {activeMeta.keyUrl}</> : ''}.
                 </p>
               </div>
               <span className={`flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md ${aiStatus.configured ? 'bg-surface2 text-muted2' : 'bg-surface2 text-muted'}`}>
                 {aiStatus.configured && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
                 {aiStatus.configured ? 'Configured' : 'Not set'}
               </span>
             </div>

             {!aiStatus.encryptionAvailable && (
               <div className="text-[10px] font-mono text-warning bg-warning/10 border border-warning/20 px-3 py-2 rounded-md">
                 Secure storage is unavailable on this system — the key cannot be stored safely and will not be saved.
               </div>
             )}

             <div className="flex flex-col sm:flex-row gap-3">
               <input
                 type="password"
                 placeholder={aiStatus.configured ? '•••••••••••••• (saved)' : activeMeta.placeholder}
                 value={aiKey}
                 onChange={e => setAiKey(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && saveAiKey()}
                 className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:border-primary/50 outline-none"
               />
               <div className="flex gap-2">
                 <button
                   onClick={saveAiKey}
                   disabled={aiBusy || !aiKey.trim() || !aiStatus.encryptionAvailable}
                   className="px-4 py-2 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                 >
                   Save
                 </button>
                 {aiStatus.configured && (
                   <button
                     onClick={() => testKey('Key')}
                     disabled={aiBusy}
                     className="px-4 py-2 bg-surface2 hover:bg-surface3 text-text2 border border-border text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                     title="Send a tiny request to check the key + model work"
                   >
                     Test
                   </button>
                 )}
                 {aiStatus.configured && (
                   <button
                     onClick={clearAiKey}
                     disabled={aiBusy}
                     className="px-4 py-2 bg-surface2 hover:bg-danger/10 hover:text-danger hover:border-danger/30 text-text2 border border-border text-xs font-medium rounded-lg transition-colors disabled:opacity-40"
                   >
                     Clear
                   </button>
                 )}
               </div>
             </div>

             <div className="flex items-center justify-between gap-3">
               <div className="flex items-center gap-2 min-w-0">
                 <span className="text-[10px] font-mono text-muted shrink-0">Model:</span>
                 <input
                   value={aiModel}
                   onChange={e => setAiModel(e.target.value)}
                   onBlur={saveModel}
                   onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                   placeholder={activeMeta.defaultModel || ''}
                   spellCheck={false}
                   className="bg-background border border-border rounded px-2 py-1 text-[10px] font-mono text-text2 focus:border-primary/50 outline-none w-52"
                 />
               </div>
             </div>

             {aiMsg && (
               <div className={`text-[10px] font-mono leading-relaxed break-words rounded-md px-3 py-2 ${/fail|error|reject|unavailable|quota|invalid/i.test(aiMsg) ? 'text-warning bg-warning/10 border border-warning/20' : 'text-accent/90 bg-primary/5 border border-primary/20'}`}>
                 {aiMsg}
               </div>
             )}

             {activeMeta.presets?.length > 0 && (
               <div className="flex flex-wrap items-center gap-1.5">
                 <span className="text-[10px] font-mono text-muted/70 mr-1">Presets:</span>
                 {activeMeta.presets.map((m: string) => (
                   <button
                     key={m}
                     onClick={() => pickModel(m)}
                     className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${aiModel === m ? 'bg-surface2 text-text border-border2' : 'text-muted2 border-border hover:bg-surface2 hover:text-text'}`}
                   >
                     {m}
                   </button>
                 ))}
               </div>
             )}
           </div>
        </div>

        <div className={sectionCls('appearance')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><Palette className="w-4 h-4 text-accent"/> Visual identity</h3>
           <div className="bg-surface border border-border rounded-xl overflow-hidden grid grid-cols-3 gap-[1px] bg-border p-[1px]">
             <button onClick={() => setTheme('midnight')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'midnight' || !config.theme ? 'bg-surface2 text-text' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#12121a] border border-[#232328] flex items-center justify-center">
                 {(config.theme === 'midnight' || !config.theme) && <span className="w-2 h-2 rounded-full bg-accent" />}
               </span>
               <span className="text-[11px] font-medium mt-2">Midnight</span>
             </button>
             <button onClick={() => setTheme('oled')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'oled' ? 'bg-surface2 text-text' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#000000] border border-[#1f1f1f] flex items-center justify-center">
                 {config.theme === 'oled' && <span className="w-2 h-2 rounded-full bg-accent" />}
               </span>
               <span className="text-[11px] font-medium mt-2">Pure OLED</span>
             </button>
             <button onClick={() => setTheme('dracula')} className={`p-4 flex flex-col items-center justify-center gap-2 transition-colors ${config.theme === 'dracula' ? 'bg-surface2 text-text' : 'bg-surface text-muted hover:bg-surface2/50'}`}>
               <span className="w-5 h-5 rounded-full bg-[#282a36] border border-[#ff79c6] flex items-center justify-center">
                 {config.theme === 'dracula' && <span className="w-2 h-2 rounded-full bg-[#ff79c6]" />}
               </span>
               <span className="text-[11px] font-medium mt-2">Dracula</span>
             </button>
           </div>

           <div className="bg-surface border border-border rounded-xl p-5">
             <div className="text-[11px] text-muted mb-3">Accent colour</div>
             <div className="flex flex-wrap gap-2.5">
               {ACCENTS.map((a) => {
                 const isActive = (config.accent || 'purple') === a.key;
                 return (
                   <button
                     key={a.key}
                     onClick={() => setAccent(a.key)}
                     aria-label={`Accent ${a.label}`}
                     className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${isActive ? 'border-border2 bg-surface2 text-text' : 'border-border text-muted2 hover:bg-surface2 hover:text-text'}`}
                   >
                     <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: a.swatch }} />
                     {a.label}
                   </button>
                 );
               })}
             </div>
           </div>
        </div>

        <div className={sectionCls('data')}>
           <h3 className="text-sm font-semibold flex items-center gap-2"><Download className="w-4 h-4 text-accent"/> Backup &amp; restore</h3>
           <div className="bg-surface border border-border rounded-xl shadow-sm p-6 flex flex-col gap-4">
             <p className="text-[11px] text-muted leading-relaxed">
               Export your preferences, snippets and launcher profiles to a JSON file — or restore them on another machine. API keys and the GitHub token are never included.
             </p>
             <div className="flex flex-wrap items-center gap-3">
               <button onClick={exportSettings} className="flex items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 border border-border text-text2 text-xs font-medium rounded-lg transition-colors">
                 <Download className="w-3.5 h-3.5"/> Export settings
               </button>
               <button onClick={importSettings} className="flex items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 border border-border text-text2 text-xs font-medium rounded-lg transition-colors">
                 <Upload className="w-3.5 h-3.5"/> Import settings
               </button>
               {backupMsg && <span className="text-[11px] font-mono text-accent/90">{backupMsg}</span>}
             </div>
           </div>
        </div>

        <div className={`mt-2 p-5 bg-background border border-border rounded-xl grid grid-cols-2 gap-4 items-center ${cat === 'about' ? '' : 'hidden'}`}>
           <div>
             <h4 className="text-sm font-medium text-text tracking-tight flex items-center gap-2">
              Onyx <span className="px-2 py-0.5 text-[9px] font-mono bg-surface2 text-muted2 border border-border rounded-md">v{config.appVersion || '—'}</span>
             </h4>
             <p className="text-[11px] font-mono text-muted mt-1.5 leading-relaxed">
               Centralized power toolkit &amp; system guard.
             </p>
             <div className="mt-4 flex items-center gap-3">
               <button
                 onClick={checkForUpdates}
                 className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border hover:bg-surface2 text-text2 text-xs font-medium rounded-lg transition-colors cursor-pointer"
               >
                 Check updates
               </button>
               {updatePhase === 'available' && (
                 <button
                   onClick={downloadUpdate}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                 >
                   Download update
                 </button>
               )}
               {updatePhase === 'ready' && (
                 <button
                   onClick={installUpdate}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                 >
                   Restart & install
                 </button>
               )}
               {updateStatus && updatePhase !== 'ready' && (
                 <span className="text-[11px] font-mono text-primary/80">{updateStatus}</span>
               )}
             </div>
           </div>
           <div className="flex justify-end">
             <button 
               onClick={() => window.api?.invoke(CH.windowOpenExternal, 'https://github.com/Sepd0x/onyx')}
               className="flex items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 text-text2 border border-border text-xs font-medium rounded-lg transition-colors cursor-pointer"
             >
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.5-1.4 6.5-7a4.6 4.6 0 0 0-1.39-3.2 4.6 4.6 0 0 0-.08-3.2s-1.1-.35-3.5 1.25a11.39 11.39 0 0 0-6.2 0C6.5 2.8 5.4 3.15 5.4 3.15a4.6 4.6 0 0 0-.08 3.2A4.6 4.6 0 0 0 3.93 9.5c0 5.6 3.35 6.65 6.5 7a4.8 4.8 0 0 0-1 3.03V22"/><path d="M9 20c-5 1.5-5-2.5-7-3"/></svg>
               GitHub repo
             </button>
           </div>
        </div>

        <div className={`p-5 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-4 ${cat === 'about' ? '' : 'hidden'}`}>
           <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
           <div>
             <h4 className="text-sm font-medium text-primary tracking-tight">Secure Context Enforced</h4>
             <p className="text-[11px] font-mono text-muted mt-1.5 leading-relaxed opacity-80">
               All tools operate in a sandboxed Node.js environment via IPC tunnels. The UI layer has no direct access to your file system or system processes.
             </p>
           </div>
        </div>

        </div>
      </div>
    </div>
  );
}
