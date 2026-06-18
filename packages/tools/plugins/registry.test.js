import { describe, it, expect } from 'vitest';
import { loadBundle, canInvoke, satisfiesEngine, narrowGrant } from './registry.js';
import { canonicalDigest, generateKeyPair, sign } from '../../core/src/plugins/verify.js';

const KEYS = generateKeyPair();

const manifest = {
  id: 'acme.demo',
  name: 'Demo',
  version: '1.0.0',
  author: { handle: 'acme', url: 'https://github.com/acme' },
  permissions: ['notify'],
  channels: ['greet'],
  main: 'backend.js',
  engines: { onyx: '>=1.0.0' },
};

// Build a bundle (files + signature) signed with a given key.
function makeBundle(overrides = {}, key = KEYS.privateKey) {
  const m = { ...manifest, ...overrides };
  const files = [
    { path: 'manifest.json', data: JSON.stringify(m) },
    { path: 'backend.js', data: 'module.exports = { handlers: {} }' },
  ];
  return { files, signature: sign(canonicalDigest(files), key) };
}

describe('plugin registry — loadBundle', () => {
  it('loads a correctly signed bundle', () => {
    const { files, signature } = makeBundle();
    const res = loadBundle({ files, signature, publicKey: KEYS.publicKey, appVersion: '2.0.0' });
    expect(res.ok).toBe(true);
    expect(res.plugin.id).toBe('acme.demo');
  });

  it('rejects an unsigned bundle (fail closed)', () => {
    const { files } = makeBundle();
    expect(loadBundle({ files, signature: '', publicKey: KEYS.publicKey, appVersion: '2.0.0' }).ok).toBe(false);
  });

  it('rejects a bundle signed with a foreign key', () => {
    const other = generateKeyPair();
    const { files, signature } = makeBundle({}, other.privateKey);
    const res = loadBundle({ files, signature, publicKey: KEYS.publicKey, appVersion: '2.0.0' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/signature/);
  });

  it('rejects a tampered file even with a valid-looking signature', () => {
    const { files, signature } = makeBundle();
    const tampered = files.map((f) => (f.path === 'backend.js' ? { ...f, data: 'evil()' } : f));
    expect(loadBundle({ files: tampered, signature, publicKey: KEYS.publicKey, appVersion: '2.0.0' }).ok).toBe(false);
  });

  it('rejects when the app version does not satisfy engines.onyx', () => {
    const { files, signature } = makeBundle({ engines: { onyx: '>=3.0.0' } });
    const res = loadBundle({ files, signature, publicKey: KEYS.publicKey, appVersion: '2.0.0' });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/requires Onyx/);
  });

  it('rejects when the declared main file is missing from the bundle', () => {
    const { files, signature } = makeBundle({ main: 'nope.js' });
    expect(loadBundle({ files, signature, publicKey: KEYS.publicKey, appVersion: '2.0.0' }).ok).toBe(false);
  });
});

describe('plugin registry — guards', () => {
  it('canInvoke requires enabled + declared method', () => {
    const p = { channels: ['greet'] };
    expect(canInvoke(p, 'greet', true)).toBe(true);
    expect(canInvoke(p, 'greet', false)).toBe(false);
    expect(canInvoke(p, 'secret', true)).toBe(false);
    expect(canInvoke(null, 'greet', true)).toBe(false);
  });

  it('satisfiesEngine handles *, exact and comparators', () => {
    expect(satisfiesEngine('2.0.0', '*')).toBe(true);
    expect(satisfiesEngine('2.0.0', '2.0.0')).toBe(true);
    expect(satisfiesEngine('2.0.0', '>=1.5.0')).toBe(true);
    expect(satisfiesEngine('2.0.0', '>=3.0.0')).toBe(false);
    expect(satisfiesEngine('2.0.0', 'garbage')).toBe(false);
  });

  it('narrowGrant can only narrow the declared permission set, never widen it', () => {
    const declared = ['notify', 'net:fetch'];
    // A subset request is honoured.
    expect(narrowGrant(declared, ['notify'])).toEqual(['notify']);
    // A request for something NOT declared is dropped (no privilege escalation).
    expect(narrowGrant(declared, ['notify', 'fs:read'])).toEqual(['notify']);
    // An empty request grants nothing.
    expect(narrowGrant(declared, [])).toEqual([]);
    // No/invalid request falls back to exactly what was declared.
    expect(narrowGrant(declared, undefined)).toEqual(declared);
    expect(narrowGrant(declared, null)).toEqual(declared);
    // Result order follows the declared manifest order.
    expect(narrowGrant(declared, ['net:fetch', 'notify'])).toEqual(['notify', 'net:fetch']);
  });
});
