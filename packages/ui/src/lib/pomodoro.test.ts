import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, initialState, nextPhase, remainingAt, start, pause, reset, skip, tick, phaseSeconds, formatTime } from './pomodoro';

const cfg = { work: 25, short: 5, long: 15, longEvery: 4 };
const T0 = 1_000_000_000_000;

describe('phaseSeconds / nextPhase', () => {
  it('converts minutes to seconds per phase', () => {
    expect(phaseSeconds('work', cfg)).toBe(1500);
    expect(phaseSeconds('short', cfg)).toBe(300);
    expect(phaseSeconds('long', cfg)).toBe(900);
  });
  it('inserts a long break every longEvery work phases', () => {
    expect(nextPhase('work', 0, cfg)).toEqual({ phase: 'short', completedWork: 1 });
    expect(nextPhase('work', 3, cfg)).toEqual({ phase: 'long', completedWork: 4 });
    expect(nextPhase('short', 1, cfg)).toEqual({ phase: 'work', completedWork: 1 });
    expect(nextPhase('long', 4, cfg)).toEqual({ phase: 'work', completedWork: 4 });
  });
});

describe('start / pause / remainingAt', () => {
  it('starts the timer with an endsAt derived from now', () => {
    const s = start(initialState(cfg), T0, cfg);
    expect(s.running).toBe(true);
    expect(s.endsAt).toBe(T0 + 1500 * 1000);
    expect(remainingAt(s, T0 + 10_000)).toBe(1490); // 10s elapsed
  });
  it('pause freezes the remaining time', () => {
    const s = pause(start(initialState(cfg), T0, cfg), T0 + 60_000);
    expect(s.running).toBe(false);
    expect(s.endsAt).toBeNull();
    expect(s.remaining).toBe(1440); // 25:00 - 1:00
    // resuming continues from the frozen remainder
    expect(start(s, T0 + 100_000, cfg).endsAt).toBe(T0 + 100_000 + 1440 * 1000);
  });
  it('remaining never goes negative', () => {
    expect(remainingAt(start(initialState(cfg), T0, cfg), T0 + 9_999_999)).toBe(0);
  });
});

describe('skip / reset', () => {
  it('skip advances to the next phase keeping the running flag', () => {
    const s = skip(start(initialState(cfg), T0, cfg), T0, cfg);
    expect(s.phase).toBe('short');
    expect(s.completedWork).toBe(1);
    expect(s.running).toBe(true);
    expect(s.endsAt).toBe(T0 + 300 * 1000);
  });
  it('reset returns to a fresh focus phase', () => {
    expect(reset(cfg)).toEqual(initialState(cfg));
  });
});

describe('tick (auto-advance + catch-up)', () => {
  it('does nothing while time remains', () => {
    const s = start(initialState(cfg), T0, cfg);
    expect(tick(s, T0 + 1000, cfg).completed).toEqual([]);
  });
  it('advances one phase when the current one ends', () => {
    const s = start(initialState(cfg), T0, cfg);
    const r = tick(s, T0 + 1500 * 1000, cfg);
    expect(r.completed).toEqual(['work']);
    expect(r.state.phase).toBe('short');
    expect(r.state.completedWork).toBe(1);
  });
  it('catches up multiple phases elapsed while away', () => {
    const s = start(initialState(cfg), T0, cfg);
    // jump far enough to finish work(25) + short(5) + work(25) = 55 min
    const r = tick(s, T0 + 56 * 60 * 1000, cfg);
    expect(r.completed).toEqual(['work', 'short', 'work']);
    expect(r.state.phase).toBe('short');
    expect(r.state.completedWork).toBe(2);
  });
  it('is a no-op when paused', () => {
    expect(tick(pause(start(initialState(cfg), T0, cfg), T0), T0 + 99_999_999, cfg).completed).toEqual([]);
  });
});

describe('formatTime', () => {
  it('formats MM:SS with zero-padding', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(1500)).toBe('25:00');
  });
});

describe('DEFAULT_CONFIG', () => {
  it('is a sensible classic pomodoro', () => {
    expect(DEFAULT_CONFIG).toEqual({ work: 25, short: 5, long: 15, longEvery: 4 });
  });
});
