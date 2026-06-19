import { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, SkipForward, Timer, Minus, Plus } from 'lucide-react';
import { CH } from '../ipc';
import {
  DEFAULT_CONFIG, initialState, remainingAt, phaseSeconds, start, pause, reset, skip, tick, formatTime,
  PHASE_LABEL, type PomodoroState, type PomodoroConfig, type Phase,
} from '../lib/pomodoro';

const STATE_KEY = 'onyx-pomodoro';
const CONFIG_KEY = 'onyx-pomodoro-config';

// Ring + accent per phase (CSS var name) so Focus vs break is obvious at a glance.
const PHASE_VAR: Record<Phase, string> = { work: 'primary', short: 'success', long: 'info' };

function loadState(): PomodoroState {
  try { const s = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); if (s && s.phase) return s; } catch {}
  return initialState(DEFAULT_CONFIG);
}
function loadConfig(): PomodoroConfig {
  try { const c = JSON.parse(localStorage.getItem(CONFIG_KEY) || 'null'); if (c && c.work) return { ...DEFAULT_CONFIG, ...c }; } catch {}
  return DEFAULT_CONFIG;
}

function Stepper({ label, value, suffix, min, onChange }: { label: string; value: number; suffix: string; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2">
      <span className="text-[11px] text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} className="text-muted hover:text-text p-0.5 rounded active:scale-90 transition-transform"><Minus className="w-3 h-3" /></button>
        <span className="text-[12px] font-mono font-semibold text-text tabular-nums w-10 text-center">{value}{suffix}</span>
        <button aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)} className="text-muted hover:text-text p-0.5 rounded active:scale-90 transition-transform"><Plus className="w-3 h-3" /></button>
      </div>
    </div>
  );
}

export default function PomodoroTimer() {
  const [config, setConfig] = useState<PomodoroConfig>(loadConfig);
  const [state, setState] = useState<PomodoroState>(loadState);
  const [now, setNow] = useState(() => Date.now());
  const lastNotified = useRef(0);

  // Catch up any phases that elapsed while this view was unmounted / the app slept.
  useEffect(() => {
    setState((s) => tick(s, Date.now(), config).state);
    setNow(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tick only while running — no wasted renders when paused.
  useEffect(() => {
    if (!state.running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state.running]);

  // Advance + notify when the current phase finishes.
  useEffect(() => {
    if (!state.running || state.endsAt == null || now < state.endsAt) return;
    const { state: ns, completed } = tick(state, now, config);
    setState(ns);
    if (completed.length && now - lastNotified.current > 1000) {
      lastNotified.current = now;
      const finished = completed[completed.length - 1];
      const body = finished === 'work' ? `Focus session done — ${PHASE_LABEL[ns.phase].toLowerCase()} time.` : 'Break over — back to focus.';
      try { window.api?.invoke(CH.appNotify, { title: 'Focus Mode', body }); } catch {}
    }
  }, [now, state, config]);

  useEffect(() => { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch {} }, [state]);
  useEffect(() => { try { localStorage.setItem(CONFIG_KEY, JSON.stringify(config)); } catch {} }, [config]);

  const remaining = remainingAt(state, now);
  const total = phaseSeconds(state.phase, config);
  const progress = total > 0 ? 1 - remaining / total : 0;
  const color = `rgb(var(--${PHASE_VAR[state.phase]}))`;
  const C = 2 * Math.PI * 52; // ring circumference (r=52)

  // Every action syncs `now` to the click instant. Without this the display recomputes
  // against a stale `now` (the interval only ticks while running), so pressing Start at
  // 25:00 briefly showed 25:0X — the time elapsed since mount leaked into the first frame.
  const onStartPause = () => { const t = Date.now(); setNow(t); setState((s) => (s.running ? pause(s, t) : start(s, t, config))); };
  const onReset = () => { setNow(Date.now()); setState(reset(config)); };
  const onSkip = () => { const t = Date.now(); setNow(t); setState((s) => skip(s, t, config)); };

  // Editing a duration while paused re-syncs the remaining time for the live phase.
  const setDuration = (key: keyof PomodoroConfig, v: number) => {
    const next = { ...config, [key]: v };
    setConfig(next);
    setState((s) => (s.running ? s : { ...s, remaining: phaseSeconds(s.phase, next) }));
  };

  return (
    <div className="panel p-6 flex flex-col gap-6">
      <h3 className="text-sm font-semibold text-text tracking-tight flex items-center gap-2">
        <Timer className="w-4 h-4 text-primary" /> Pomodoro timer
        <span className="ml-auto text-[10px] font-mono text-muted">{state.completedWork} focus {state.completedWork === 1 ? 'session' : 'sessions'} today</span>
      </h3>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Ring + time */}
        <div className="relative w-[140px] h-[140px] shrink-0">
          <svg viewBox="0 0 120 120" className="w-[140px] h-[140px] -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" stroke="rgb(var(--surface3))" strokeWidth="7" />
            <circle
              cx="60" cy="60" r="52" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[28px] font-mono font-bold text-text tabular-nums leading-none">{formatTime(remaining)}</span>
            <span className="text-[10px] font-mono uppercase tracking-widest mt-1" style={{ color }}>{PHASE_LABEL[state.phase]}</span>
          </div>
        </div>

        {/* Controls + durations */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={onStartPause}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-background hover:bg-accent transition-colors"
            >
              {state.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {state.running ? 'Pause' : remaining < total ? 'Resume' : 'Start'}
            </button>
            <button onClick={onSkip} title="Skip to next phase" className="px-3 py-2.5 rounded-lg bg-surface2 text-text2 border border-border hover:bg-surface3 transition-colors"><SkipForward className="w-4 h-4" /></button>
            <button onClick={onReset} title="Reset" className="px-3 py-2.5 rounded-lg bg-surface2 text-text2 border border-border hover:bg-surface3 transition-colors"><RotateCcw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stepper label="Focus" value={config.work} suffix="m" min={1} onChange={(v) => setDuration('work', v)} />
            <Stepper label="Short break" value={config.short} suffix="m" min={1} onChange={(v) => setDuration('short', v)} />
            <Stepper label="Long break" value={config.long} suffix="m" min={1} onChange={(v) => setDuration('long', v)} />
            <Stepper label="Long every" value={config.longEvery} suffix="×" min={1} onChange={(v) => setDuration('longEvery', v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
