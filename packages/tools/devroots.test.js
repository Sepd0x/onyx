import { describe, it, expect } from 'vitest';
import os from 'os';
import path from 'path';
import { defaultDevRoots } from './devroots.js';

describe('defaultDevRoots', () => {
  const home = os.homedir();

  it('returns several absolute paths', () => {
    const roots = defaultDevRoots();
    expect(roots.length).toBeGreaterThan(8);
    for (const r of roots) expect(path.isAbsolute(r)).toBe(true);
  });

  it('includes the common home dev locations', () => {
    const roots = defaultDevRoots();
    expect(roots).toContain(path.join(home, 'Desktop'));
    expect(roots).toContain(path.join(home, 'Documents', 'GitHub'));
    expect(roots).toContain(path.join(home, 'source', 'repos'));
    expect(roots).toContain(path.join(home, 'OneDrive', 'Desktop'));
  });

  it('on Windows, also includes drive-root dev folders outside home (e.g. C:\\dev)', () => {
    if (process.platform !== 'win32') return;
    const roots = defaultDevRoots();
    const drive = process.env.SystemDrive || 'C:';
    expect(roots).toContain(path.join(drive + path.sep, 'dev'));
    expect(roots).toContain(path.join(drive + path.sep, 'src'));
  });

  it('has no duplicate roots', () => {
    const roots = defaultDevRoots();
    expect(new Set(roots).size).toBe(roots.length);
  });
});
