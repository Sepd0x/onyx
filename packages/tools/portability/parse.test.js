import { describe, it, expect } from 'vitest';
import { buildBackup, parseBackup, MARKER } from './parse.js';

describe('buildBackup', () => {
  it('stamps the marker and keeps config/snippets/launchers', () => {
    const out = buildBackup({ config: { theme: 'oled' }, snippets: [{ id: '1' }], launchers: [{ id: 'a' }] }, '2026-06-14');
    expect(out.onyx).toBe(MARKER);
    expect(out.version).toBe(1);
    expect(out.exportedAt).toBe('2026-06-14');
    expect(out.config).toEqual({ theme: 'oled' });
    expect(out.snippets).toEqual([{ id: '1' }]);
    expect(out.launchers).toEqual([{ id: 'a' }]);
  });

  it('coerces bad shapes to safe empties', () => {
    const out = buildBackup({ config: ['nope'], snippets: 'nope', launchers: null });
    expect(out.config).toEqual({});
    expect(out.snippets).toEqual([]);
    expect(out.launchers).toEqual([]);
  });

  it('tolerates a missing bundle', () => {
    const out = buildBackup(undefined);
    expect(out).toMatchObject({ onyx: MARKER, config: {}, snippets: [], launchers: [] });
  });
});

describe('parseBackup', () => {
  it('round-trips a built backup', () => {
    const raw = JSON.stringify(buildBackup({ config: { accent: 'rose' }, snippets: [{ id: 's' }], launchers: [] }));
    const r = parseBackup(raw);
    expect(r.error).toBeUndefined();
    expect(r.data.config).toEqual({ accent: 'rose' });
    expect(r.data.snippets).toEqual([{ id: 's' }]);
  });

  it('rejects non-JSON', () => {
    expect(parseBackup('not json').error).toMatch(/valid JSON/);
  });

  it('rejects JSON without the Onyx marker', () => {
    expect(parseBackup(JSON.stringify({ config: {} })).error).toMatch(/Onyx settings backup/);
  });

  it('coerces malformed fields on import', () => {
    const raw = JSON.stringify({ onyx: MARKER, config: 'bad', snippets: { not: 'array' }, launchers: 5 });
    const r = parseBackup(raw);
    expect(r.data).toEqual({ config: {}, snippets: [], launchers: [] });
  });
});
