import { describe, it, expect } from 'vitest';
import { osLabel, language, dayKey, sanitizeToolOpens, buildPayload, assertNoPii } from './payload.js';

describe('osLabel', () => {
  it('maps Windows builds to 10/11 by build number', () => {
    expect(osLabel('win32', '10.0.22631')).toBe('Windows 11');
    expect(osLabel('win32', '10.0.19045')).toBe('Windows 10');
    expect(osLabel('win32', 'weird')).toBe('Windows');
  });
  it('maps other platforms coarsely', () => {
    expect(osLabel('darwin', '')).toBe('macOS');
    expect(osLabel('linux', '')).toBe('Linux');
    expect(osLabel('freebsd', '')).toBe('Other');
  });
});

describe('language', () => {
  it('keeps only the language, dropping the region', () => {
    expect(language('pt-PT')).toBe('pt');
    expect(language('en-US')).toBe('en');
    expect(language('')).toBe('und');
  });
});

describe('dayKey', () => {
  it('buckets to a UTC day', () => {
    expect(dayKey(Date.UTC(2026, 5, 18, 13, 45))).toBe('2026-06-18');
  });
});

describe('sanitizeToolOpens', () => {
  it('keeps only known tool ids with positive counts', () => {
    expect(sanitizeToolOpens({ git: 3, ports: 0, bogus: 9, cleaner: 2.6 })).toEqual({ git: 3, cleaner: 3 });
  });
  it('handles junk input', () => {
    expect(sanitizeToolOpens(null)).toEqual({});
  });
});

describe('buildPayload', () => {
  const base = { analyticsId: 'abcd-1234', version: '1.3.0', platform: 'win32', release: '10.0.22631', arch: 'x64', locale: 'pt-PT', theme: 'midnight' };
  it('only contains the allow-listed, anonymous fields', () => {
    const p = buildPayload({ ...base, toolOpens: { git: 2 }, launchedToday: true });
    expect(Object.keys(p).sort()).toEqual(['app', 'arch', 'events', 'id', 'lang', 'os', 'theme', 'v']);
    expect(p.os).toBe('Windows 11');
    expect(p.lang).toBe('pt');
  });
  it('emits app_launched, tool_opened and update_applied as expected', () => {
    const p = buildPayload({ ...base, toolOpens: { git: 2, ports: 1 }, launchedToday: true, updatedFrom: '1.2.0' });
    const kinds = p.events.map((e) => e.e);
    expect(kinds).toContain('app_launched');
    expect(kinds).toContain('update_applied');
    expect(p.events.filter((e) => e.e === 'tool_opened')).toHaveLength(2);
    expect(p.events.find((e) => e.e === 'update_applied')).toMatchObject({ from: '1.2.0', to: '1.3.0' });
  });
  it('omits update_applied when version is unchanged', () => {
    const p = buildPayload({ ...base, updatedFrom: '1.3.0', toolOpens: {}, launchedToday: false });
    expect(p.events).toEqual([]);
  });
});

describe('assertNoPii', () => {
  const ok = { v: 1, id: 'abcd-1234', app: '1.3.0', os: 'Windows 11', arch: 'x64', lang: 'pt', theme: 'midnight', events: [{ e: 'tool_opened', tool: 'git', count: 2 }] };
  it('passes a clean payload', () => {
    expect(assertNoPii(ok)).toBe(true);
  });
  it('rejects unknown keys', () => {
    expect(assertNoPii({ ...ok, hostname: 'RAFA-PC' })).toBe(false);
  });
  it('rejects path/email-looking values', () => {
    expect(assertNoPii({ ...ok, theme: 'C:\\Users\\Rafa' })).toBe(false);
    expect(assertNoPii({ ...ok, arch: 'a@b.com' })).toBe(false);
  });
  it('rejects an unknown tool id in events', () => {
    expect(assertNoPii({ ...ok, events: [{ e: 'tool_opened', tool: 'secret' }] })).toBe(false);
  });
});
