// Tiny SWR-style cache over the IPC bridge (window.api.invoke).
//
// Why: views used to each own a setInterval + useState and fetch into an empty
// state on mount. Switching tabs unmounted the view, so every return started blank
// and re-fetched. This module keeps one shared entry per (channel, args), serves it
// instantly on re-subscribe, dedupes concurrent invokes, runs ONE interval per key
// (only while something is subscribed — so a hidden/unmounted view stops polling),
// and exposes invalidate() so mutations can force a revalidate.
//
// Renderer-only: zero changes to the main process or the IPC contract.
import { useCallback, useSyncExternalStore } from 'react';
import type { Channel } from '../ipc';

export interface IpcState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  ts: number; // last successful fetch (ms epoch); 0 = never fetched
}

interface Entry {
  channel: string;
  args: any[];
  data: any;
  error: unknown;
  ts: number;
  inflight: Promise<void> | null;
  subs: Map<() => void, number>; // listener -> its pollMs (0 = no polling)
  timer: ReturnType<typeof setInterval> | null;
  timerMs: number;
  snapshot: IpcState<any>;
}

const EMPTY: IpcState<any> = { data: undefined, error: null, loading: false, ts: 0 };

const store = new Map<string, Entry>();

const keyOf = (channel: string, args: any[]) => channel + ':' + JSON.stringify(args ?? []);

function getEntry(channel: string, args: any[]): Entry {
  const key = keyOf(channel, args);
  let e = store.get(key);
  if (!e) {
    e = {
      channel,
      args: args ?? [],
      data: undefined,
      error: null,
      ts: 0,
      inflight: null,
      subs: new Map(),
      timer: null,
      timerMs: 0,
      snapshot: EMPTY,
    };
    store.set(key, e);
  }
  return e;
}

function emit(e: Entry) {
  e.snapshot = { data: e.data, error: e.error, loading: e.inflight !== null, ts: e.ts };
  e.subs.forEach((_pollMs, cb) => cb());
}

function fetchEntry(e: Entry): Promise<void> {
  if (e.inflight) return e.inflight; // dedupe concurrent invokes
  const api = (window as any).api;
  if (!api || typeof api.invoke !== 'function') return Promise.resolve();
  const p = Promise.resolve()
    .then(() => api.invoke(e.channel, ...e.args))
    .then((res: any) => {
      e.data = res;
      e.ts = Date.now();
      e.error = null;
    })
    .catch((err: unknown) => {
      e.error = err;
    })
    .finally(() => {
      e.inflight = null;
      emit(e);
    });
  e.inflight = p;
  emit(e); // surface loading=true immediately
  return p;
}

// One interval per key; cadence = the fastest poll any subscriber asked for.
function reconcileTimer(e: Entry) {
  const polls = [...e.subs.values()].filter((p) => p > 0);
  const want = polls.length ? Math.min(...polls) : 0;
  if (e.timer && (want === 0 || want !== e.timerMs)) {
    clearInterval(e.timer);
    e.timer = null;
    e.timerMs = 0;
  }
  if (want > 0 && !e.timer) {
    e.timerMs = want;
    e.timer = setInterval(() => fetchEntry(e), want);
  }
}

export function subscribe(
  channel: string,
  args: any[],
  pollMs: number,
  ttlMs: number,
  cb: () => void
): () => void {
  const e = getEntry(channel, args);
  e.subs.set(cb, pollMs);
  if (e.ts === 0 || Date.now() - e.ts > ttlMs) fetchEntry(e); // revalidate when stale
  reconcileTimer(e);
  return () => {
    e.subs.delete(cb);
    reconcileTimer(e); // stop polling once the last subscriber leaves
  };
}

// Force matching cached entries to revalidate. Active entries refetch immediately;
// idle ones are marked stale so their next subscribe refetches. Call after a mutation
// with the channel prefix it affects, e.g. invalidate('ports:') after ports:kill.
export function invalidate(channelPrefix: string): void {
  store.forEach((e) => {
    if (!e.channel.startsWith(channelPrefix)) return;
    e.ts = 0;
    if (e.subs.size > 0) fetchEntry(e);
  });
}

// Test-only: reset module state between cases.
export function _clearCache(): void {
  store.forEach((e) => {
    if (e.timer) clearInterval(e.timer);
  });
  store.clear();
}

export function useIpc<T = any>(
  channel: Channel,
  args?: any[],
  opts?: { pollMs?: number; ttlMs?: number }
): IpcState<T> {
  const pollMs = opts?.pollMs ?? 0;
  const ttlMs = opts?.ttlMs ?? 5000;
  const a = args ?? [];
  const key = keyOf(channel, a);

  const subscribeFn = useCallback(
    (cb: () => void) => subscribe(channel, a, pollMs, ttlMs, cb),
    // a is captured via key; channel never changes for a given key
    [key, pollMs, ttlMs] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const getSnapshot = useCallback(() => {
    const e = store.get(key);
    return (e ? e.snapshot : EMPTY) as IpcState<T>;
  }, [key]);

  return useSyncExternalStore(subscribeFn, getSnapshot, getSnapshot);
}
