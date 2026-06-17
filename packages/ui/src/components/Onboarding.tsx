import { useEffect, useState } from 'react';
import { ArrowRight, Check, KeyRound, Sparkles, Command as CommandIcon, LayoutDashboard, Rocket } from 'lucide-react';
import { CH } from '../ipc';
import { invalidate } from '../lib/ipcCache';
import { ACCENTS, applyAccent } from '../lib/accents';
import Logo from './Logo';

const STEP_NAMES = ['Welcome', 'Appearance', 'AI assistant', 'All set'];
// Best-effort breadcrumb into the main log, so a first-run crash report can be
// traced to the exact step the user reached (see issue #30). Never throws.
const logStep = (message: string) => { try { window.api?.invoke(CH.appLog, { level: 'info', message: `onboarding: ${message}` }); } catch {} };

// First-run wizard: appearance → optional AI key → a couple of tips. Each choice
// is applied + persisted as you go, so finishing (or skipping) just flips the
// `onboarded` flag. Shown by App until config.onboarded === true.
export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [step, setStep] = useState(0);
  const [theme, setThemeState] = useState('midnight');
  const [accent, setAccentState] = useState('purple');

  // AI step state
  const [providers, setProviders] = useState<any[]>([]);
  const [provider, setProvider] = useState('anthropic');
  const [aiKey, setAiKey] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const activeMeta: any = providers.find((p) => p.key === provider) || { label: 'AI provider', placeholder: 'API key', keyUrl: '' };

  useEffect(() => {
    logStep('opened (first-run wizard mounted)');
    (async () => {
      if (!window.api) return;
      try {
        const cfg: any = await window.api.invoke(CH.appGetConfig);
        if (cfg?.theme) setThemeState(cfg.theme);
        if (cfg?.accent) setAccentState(cfg.accent);
        const s: any = await window.api.invoke(CH.aiGetStatus);
        if (s?.providers) { setProviders(s.providers); setProvider(s.provider || 'anthropic'); }
      } catch (e: any) {
        logStep(`init failed: ${String(e?.message || e)}`);
      }
    })();
  }, []);

  // Breadcrumb each step the user reaches — the last line before a crash localizes it.
  useEffect(() => { logStep(`reached step ${step} (${STEP_NAMES[step] || step})`); }, [step]);

  const setTheme = (t: string) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    window.api?.invoke(CH.appSetConfig, { theme: t });
  };
  const setAccent = (a: string) => {
    setAccentState(a);
    applyAccent(a);
    window.api?.invoke(CH.appSetConfig, { accent: a });
  };

  const selectProvider = async (p: string) => {
    setProvider(p);
    setAiKey('');
    setAiMsg('');
    await window.api?.invoke(CH.aiSetProvider, p);
  };

  const saveAndTest = async () => {
    if (!window.api || !aiKey.trim()) return;
    setAiBusy(true);
    setAiMsg('Saving…');
    try {
      const res: any = await window.api.invoke(CH.aiSetKey, { provider, key: aiKey });
      if (res?.warning) { setAiMsg(res.warning); return; }
      setAiKey('');
      setAiMsg('Testing…');
      const t: any = await window.api.invoke(CH.aiTest);
      setAiMsg(t?.ok ? 'Saved and working ✓' : (t?.detail || `Saved, but the test failed: ${t?.error || 'unknown'}`));
      invalidate('ai:');
    } finally {
      setAiBusy(false);
    }
  };

  const finish = async () => {
    logStep(`finished (from step ${step})`);
    await window.api?.invoke(CH.appSetConfig, { onboarded: true });
    invalidate('app:getConfig');
    onFinish();
  };

  const steps = STEP_NAMES;

  return (
    <div className="absolute inset-0 z-[70] flex items-center justify-center bg-background/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-surface border border-border2 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        {/* Progress dots */}
        <div className="flex items-center gap-2 px-7 pt-6">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 rounded-full transition-all duration-300 ${i === step ? 'w-7 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-4 bg-border'}`} />
          ))}
          <button onClick={finish} className="ml-auto text-[10px] font-mono text-muted hover:text-text transition-colors">Skip</button>
        </div>

        <div className="px-7 py-7 min-h-[340px] flex flex-col">
          {step === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-5">
              <Logo className="w-16 h-16" />
              <div>
                <h2 className="text-2xl font-semibold text-text tracking-tight">Welcome to Onyx</h2>
                <p className="text-sm text-muted mt-2 leading-relaxed max-w-sm">
                  One native panel for the small, recurring chores of local development. Let's set it up in a few seconds.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex-1 flex flex-col gap-6">
              <div>
                <h2 className="text-lg font-semibold text-text">Make it yours</h2>
                <p className="text-[12px] text-muted mt-1">Pick a theme and accent — you can change these any time in Settings.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: 'midnight', label: 'Midnight', dot: '#12121a', ring: '#232328' },
                  { key: 'oled', label: 'Pure OLED', dot: '#000000', ring: '#1f1f1f' },
                  { key: 'dracula', label: 'Dracula', dot: '#282a36', ring: '#ff79c6' },
                ].map((t) => (
                  <button key={t.key} onClick={() => setTheme(t.key)} className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-colors ${theme === t.key ? 'border-primary/50 bg-surface2' : 'border-border hover:bg-surface2/60'}`}>
                    <span className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: t.dot, border: `1px solid ${t.ring}` }}>
                      {theme === t.key && <span className="w-2 h-2 rounded-full bg-accent" />}
                    </span>
                    <span className="text-[11px] font-medium text-text">{t.label}</span>
                  </button>
                ))}
              </div>
              <div>
                <div className="text-[11px] text-muted mb-2.5">Accent colour</div>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((a) => (
                    <button key={a.key} onClick={() => setAccent(a.key)} aria-label={`Accent ${a.label}`} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${accent === a.key ? 'border-border2 bg-surface2 text-text' : 'border-border text-muted2 hover:bg-surface2 hover:text-text'}`}>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: a.swatch }} />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex-1 flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-semibold text-text flex items-center gap-2">AI assistant <span className="text-[9px] font-mono text-muted bg-surface2 border border-border px-1.5 py-0.5 rounded">Optional</span></h2>
                <p className="text-[12px] text-muted mt-1 leading-relaxed">Bring your own key for commit messages and insights. Stored encrypted on this device; requests are sent from the app to your chosen provider. You can skip and add it later.</p>
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-background border border-border rounded-lg p-1">
                {providers.map((p) => (
                  <button key={p.key} onClick={() => selectProvider(p.key)} className={`relative px-2 py-2 rounded-md text-[11px] font-medium transition-colors ${provider === p.key ? 'bg-surface2 text-text border border-border2' : 'text-muted2 hover:text-text hover:bg-surface2/60 border border-transparent'}`}>
                    {p.label.split(' ')[0]}
                    {p.configured && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-success" />}
                  </button>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 flex items-center gap-2 bg-background border border-border rounded-lg px-3">
                  <KeyRound className="w-3.5 h-3.5 text-muted shrink-0" />
                  <input
                    type="password"
                    placeholder={activeMeta.placeholder}
                    value={aiKey}
                    onChange={(e) => setAiKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveAndTest()}
                    className="flex-1 bg-transparent py-2 text-sm font-mono text-text focus:outline-none"
                  />
                </div>
                <button onClick={saveAndTest} disabled={aiBusy || !aiKey.trim()} className="px-4 py-2 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium rounded-lg transition-colors disabled:opacity-40">
                  Save &amp; test
                </button>
              </div>
              {aiMsg && (
                <div className={`text-[10px] font-mono leading-relaxed break-words rounded-md px-3 py-2 ${/fail|error|reject|unavailable|quota|invalid/i.test(aiMsg) ? 'text-warning bg-warning/10 border border-warning/20' : 'text-accent/90 bg-primary/5 border border-primary/20'}`}>
                  {aiMsg}
                </div>
              )}
              {activeMeta.keyUrl && <p className="text-[10px] text-muted/70">Get a key at {activeMeta.keyUrl}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="flex-1 flex flex-col gap-5">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-success/15 border border-success/30 flex items-center justify-center">
                  <Check className="w-6 h-6 text-success" />
                </div>
                <h2 className="text-lg font-semibold text-text">You're all set</h2>
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { icon: CommandIcon, title: 'Command palette', desc: 'Press Ctrl+K to jump to any view or switch theme.' },
                  { icon: LayoutDashboard, title: 'Tray dashboard', desc: 'A mini-dashboard lives next to your clock — CPU, RAM, ports, guards.' },
                  { icon: Rocket, title: 'Start anywhere', desc: 'Free a port, guard a build, or check your repos from the sidebar.' },
                ].map((t) => (
                  <div key={t.title} className="flex items-start gap-3 p-3 rounded-lg bg-background/50 border border-border">
                    <span className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-accent shrink-0"><t.icon className="w-4 h-4" /></span>
                    <div>
                      <div className="text-[13px] font-medium text-text">{t.title}</div>
                      <div className="text-[11px] text-muted leading-relaxed">{t.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-7 py-4 border-t border-border bg-surface/60">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="text-xs font-medium text-muted2 hover:text-text transition-colors disabled:opacity-0">Back</button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="px-4 py-2 bg-primary/15 text-accent border border-primary/25 hover:bg-primary/25 text-xs font-medium rounded-lg transition-colors flex items-center gap-2">
              Continue <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button onClick={finish} className="px-4 py-2 bg-primary text-background text-xs font-bold tracking-wide rounded-lg transition-colors flex items-center gap-2 hover:bg-accent">
              <Sparkles className="w-3.5 h-3.5" /> Start using Onyx
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
