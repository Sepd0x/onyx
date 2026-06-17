// Pure Pomodoro timer logic (issue #9 — Focus Mode timers), kept separate from the
// view so it's unit-testable and so the timer can survive the view unmounting:
// state is timestamp-based (endsAt), persisted to localStorage, and `tick` catches
// up any phases that elapsed while the view was closed or the machine slept.
// `now` is always passed in (never reads the clock) so tests are deterministic.

export type Phase = 'work' | 'short' | 'long';

export interface PomodoroConfig {
  work: number;   // minutes
  short: number;  // minutes
  long: number;   // minutes
  longEvery: number; // a long break after this many work phases
}

export const DEFAULT_CONFIG: PomodoroConfig = { work: 25, short: 5, long: 15, longEvery: 4 };

export interface PomodoroState {
  phase: Phase;
  running: boolean;
  endsAt: number | null; // epoch ms the current phase ends (when running)
  remaining: number;     // seconds left, authoritative when paused
  completedWork: number; // finished work phases (drives the long-break cadence)
}

export function phaseSeconds(phase: Phase, config: PomodoroConfig): number {
  const mins = phase === 'work' ? config.work : phase === 'short' ? config.short : config.long;
  return Math.max(1, Math.round(mins * 60));
}

export function initialState(config: PomodoroConfig = DEFAULT_CONFIG): PomodoroState {
  return { phase: 'work', running: false, endsAt: null, remaining: phaseSeconds('work', config), completedWork: 0 };
}

// Which phase follows the current one, and the updated work tally.
export function nextPhase(phase: Phase, completedWork: number, config: PomodoroConfig): { phase: Phase; completedWork: number } {
  if (phase === 'work') {
    const cw = completedWork + 1;
    return { phase: cw % Math.max(1, config.longEvery) === 0 ? 'long' : 'short', completedWork: cw };
  }
  return { phase: 'work', completedWork };
}

// Seconds left right now (handles both running and paused states).
export function remainingAt(state: PomodoroState, now: number): number {
  if (!state.running || state.endsAt == null) return state.remaining;
  return Math.max(0, Math.round((state.endsAt - now) / 1000));
}

export function start(state: PomodoroState, now: number, config: PomodoroConfig): PomodoroState {
  if (state.running) return state;
  const rem = state.remaining > 0 ? state.remaining : phaseSeconds(state.phase, config);
  return { ...state, running: true, remaining: rem, endsAt: now + rem * 1000 };
}

export function pause(state: PomodoroState, now: number): PomodoroState {
  if (!state.running) return state;
  return { ...state, running: false, endsAt: null, remaining: remainingAt(state, now) };
}

export function reset(config: PomodoroConfig): PomodoroState {
  return initialState(config);
}

// Jump to the next phase immediately (keeps running if it was running).
export function skip(state: PomodoroState, now: number, config: PomodoroConfig): PomodoroState {
  const np = nextPhase(state.phase, state.completedWork, config);
  const secs = phaseSeconds(np.phase, config);
  return { ...state, phase: np.phase, completedWork: np.completedWork, remaining: secs, endsAt: state.running ? now + secs * 1000 : null };
}

// Advance through every phase that has finished since `endsAt` — one step normally,
// several if the view was closed / the machine slept for a while. Returns the new
// state plus the list of phases that completed (so the UI can notify once).
export function tick(state: PomodoroState, now: number, config: PomodoroConfig): { state: PomodoroState; completed: Phase[] } {
  if (!state.running || state.endsAt == null) return { state, completed: [] };
  let s = state;
  const completed: Phase[] = [];
  let guard = 0;
  while (s.running && s.endsAt != null && now >= s.endsAt && guard < 1000) {
    completed.push(s.phase);
    const np = nextPhase(s.phase, s.completedWork, config);
    const secs = phaseSeconds(np.phase, config);
    s = { ...s, phase: np.phase, completedWork: np.completedWork, endsAt: (s.endsAt as number) + secs * 1000, remaining: secs };
    guard++;
  }
  return { state: s, completed };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export const PHASE_LABEL: Record<Phase, string> = { work: 'Focus', short: 'Short break', long: 'Long break' };
