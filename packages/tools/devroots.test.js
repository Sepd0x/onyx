import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { defaultDevRoots } from './devroots.js';

describe('defaultDevRoots', () => {
  const home = os.homedir();

  it('returns several absolute paths, all under the home folder', () => {
    const roots = defaultDevRoots();
    expect(roots.length).toBeGreaterThan(8);
    for (const r of roots) expect(r.startsWith(home)).toBe(true);
  });

  it('includes the common dev locations', () => {
    const roots = defaultDevRoots();
    expect(roots).toContain(path.join(home, 'Desktop'));
    expect(roots).toContain(path.join(home, 'Documents', 'GitHub'));
    expect(roots).toContain(path.join(home, 'source', 'repos'));
    expect(roots).toContain(path.join(home, 'OneDrive', 'Desktop'));
  });

  it('has no duplicate roots', () => {
    const roots = defaultDevRoots();
    expect(new Set(roots).size).toBe(roots.length);
  });
});
