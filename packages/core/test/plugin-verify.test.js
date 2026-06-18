import { describe, it, expect } from 'vitest';
import { canonicalDigest, generateKeyPair, sign, verify } from '../src/plugins/verify.js';

const entries = [
  { path: 'manifest.json', data: '{"id":"acme.demo"}' },
  { path: 'backend.js', data: 'module.exports = {}' },
];

describe('plugin signature (Ed25519)', () => {
  it('verifies a correctly signed bundle', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const digest = canonicalDigest(entries);
    expect(verify(digest, sign(digest, privateKey), publicKey)).toBe(true);
  });

  it('rejects a tampered file', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const sig = sign(canonicalDigest(entries), privateKey);
    const tampered = canonicalDigest([entries[0], { path: 'backend.js', data: 'evil()' }]);
    expect(verify(tampered, sig, publicKey)).toBe(false);
  });

  it('rejects a signature made with a different key', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const digest = canonicalDigest(entries);
    expect(verify(digest, sign(digest, a.privateKey), b.publicKey)).toBe(false);
  });

  it('fails closed when no public key is configured', () => {
    const { privateKey } = generateKeyPair();
    const digest = canonicalDigest(entries);
    expect(verify(digest, sign(digest, privateKey), '')).toBe(false);
  });

  it('digest is order-independent (keyed by path)', () => {
    expect(canonicalDigest(entries).equals(canonicalDigest([entries[1], entries[0]]))).toBe(true);
  });
});
