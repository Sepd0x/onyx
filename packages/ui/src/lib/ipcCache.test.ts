import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { subscribe, invalidate, _clearCache } from './ipcCache';

// Drain the full .then/.catch/.finally microtask chain in fetchEntry (incl. the
// extra hops from unwrapping the mock's returned promise).
const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };

let invoke: ReturnType<typeof vi.fn>;
const BASE = 1_000_000; // non-zero so a fetched ts never collides with the "never fetched" sentinel (0)

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(BASE); // deterministic clock for ttl staleness checks
  invoke = vi.fn().mockResolvedValue([{ ok: true }]);
  (globalThis as any).window = { api: { invoke } };
  _clearCache();
});

afterEach(() => {
  _clearCache();
  vi.useRealTimers();
  delete (globalThis as any).window;
});

describe('ipcCache', () => {
  it('dedupes concurrent invokes and shares one entry across subscribers', async () => {
    const a = subscribe('ports:get', [], 0, 5000, () => {});
    const b = subscribe('ports:get', [], 0, 5000, () => {});
    await flush();
    // second subscribe joined the in-flight request rather than firing a new one
    expect(invoke).toHaveBeenCalledTimes(1);
    a(); b();
  });

  it('revalidates a stale entry when re-subscribed past its ttl', async () => {
    const u1 = subscribe('git:getRepos', [], 0, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1);
    u1();

    vi.setSystemTime(BASE + 6000); // age the entry beyond ttl (5s)
    const u2 = subscribe('git:getRepos', [], 0, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(2);
    u2();
  });

  it('serves a fresh entry from cache without refetching', async () => {
    const u1 = subscribe('git:getRepos', [], 0, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1);
    u1();

    vi.setSystemTime(BASE + 1000); // still within ttl
    const u2 = subscribe('git:getRepos', [], 0, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1); // no refetch — cache hit
    u2();
  });

  it('polls only while there is a subscriber', async () => {
    const u = subscribe('dev:status', [], 1000, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1); // initial fetch

    await vi.advanceTimersByTimeAsync(3000); // three poll ticks
    expect(invoke).toHaveBeenCalledTimes(4);

    u(); // last subscriber leaves → interval stops
    await vi.advanceTimersByTimeAsync(3000);
    expect(invoke).toHaveBeenCalledTimes(4);
  });

  it('invalidate() refetches active matching entries by channel prefix', async () => {
    const u = subscribe('power:get', [], 0, 5000, () => {});
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1);

    invalidate('ports:'); // different prefix → no-op
    await flush();
    expect(invoke).toHaveBeenCalledTimes(1);

    invalidate('power:'); // matches → refetch
    await flush();
    expect(invoke).toHaveBeenCalledTimes(2);
    u();
  });

  it('notifies subscribers when data arrives', async () => {
    const cb = vi.fn();
    const u = subscribe('app:getStats', [], 0, 5000, cb);
    await flush();
    expect(cb).toHaveBeenCalled(); // loading=true emit + resolve emit
    u();
  });
});
