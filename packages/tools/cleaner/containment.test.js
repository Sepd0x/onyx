import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, realpathSync, symlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, basename } from 'path';
import { resolveRoots, safeDeletePath } from './containment.js';

let base, root, outside;

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'onyx-cleaner-'));
  root = join(base, 'root');
  outside = join(base, 'outside');
  mkdirSync(join(root, 'proj', 'node_modules'), { recursive: true });
  mkdirSync(join(root, 'proj', 'dist'), { recursive: true });
  mkdirSync(join(root, 'proj', 'src'), { recursive: true });
  mkdirSync(join(outside, 'node_modules'), { recursive: true });
});

afterAll(() => { try { rmSync(base, { recursive: true, force: true }); } catch {} });

describe('safeDeletePath', () => {
  it('accepts a node_modules contained in a resolved root and returns its realpath', () => {
    const roots = resolveRoots([root]);
    const target = join(root, 'proj', 'node_modules');
    const out = safeDeletePath(target, roots);
    expect(out).toBeTruthy();
    expect(basename(out).toLowerCase()).toBe('node_modules');
    expect(out).toBe(realpathSync.native(target));
  });

  it('rejects a node_modules outside every root', () => {
    const roots = resolveRoots([root]);
    expect(safeDeletePath(join(outside, 'node_modules'), roots)).toBeNull();
  });

  it('accepts other whitelisted artifact dirs (e.g. dist) inside a root', () => {
    const roots = resolveRoots([root]);
    const out = safeDeletePath(join(root, 'proj', 'dist'), roots);
    expect(out).toBe(realpathSync.native(join(root, 'proj', 'dist')));
  });

  it('rejects a non-whitelisted directory (e.g. src) and bad input', () => {
    const roots = resolveRoots([root]);
    expect(safeDeletePath(join(root, 'proj', 'src'), roots)).toBeNull();
    expect(safeDeletePath('', roots)).toBeNull();
    expect(safeDeletePath(null, roots)).toBeNull();
    expect(safeDeletePath(join(root, 'proj', 'does-not-exist', 'node_modules'), roots)).toBeNull();
  });

  it('resolveRoots drops unresolvable roots', () => {
    const roots = resolveRoots([root, join(base, 'nope')]);
    expect(roots).toHaveLength(1);
    expect(roots[0]).toBe(realpathSync.native(root));
  });

  it('a junction cannot smuggle a delete outside the roots', () => {
    // root/link -> outside ; reaching outside/node_modules through the junction must
    // still resolve to outside and therefore be rejected (the asymmetry bug).
    let madeJunction = true;
    try {
      symlinkSync(outside, join(root, 'link'), 'junction');
    } catch {
      madeJunction = false; // some envs disallow link creation — skip the assertion
    }
    if (!madeJunction) return;
    const roots = resolveRoots([root]);
    expect(safeDeletePath(join(root, 'link', 'node_modules'), roots)).toBeNull();
  });
});
