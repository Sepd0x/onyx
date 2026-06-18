import { describe, it, expect } from 'vitest';
import { validateManifest, pluginChannel } from '../src/plugins/manifest.js';

const base = () => ({
  id: 'acme.ports',
  name: 'Acme Ports',
  version: '1.0.0',
  description: 'Does a thing',
  author: { handle: 'acme-dev', url: 'https://github.com/acme-dev' },
  permissions: ['config:read', 'notify'],
  channels: ['listThings', 'doThing'],
  main: 'backend.js',
});

describe('plugin manifest validation', () => {
  it('accepts a well-formed manifest and normalises defaults', () => {
    const r = validateManifest(base());
    expect(r.ok).toBe(true);
    expect(r.value.official).toBe(false);
    expect(r.value.ui).toBe(null);
    expect(r.value.engines.onyx).toBe('*');
  });

  it('requires author handle + https url (credit is mandatory)', () => {
    expect(validateManifest({ ...base(), author: undefined }).ok).toBe(false);
    expect(validateManifest({ ...base(), author: { handle: 'x', url: 'http://insecure' } }).ok).toBe(false);
    expect(validateManifest({ ...base(), author: { handle: 'x' } }).ok).toBe(false);
  });

  it('rejects unknown permissions', () => {
    const r = validateManifest({ ...base(), permissions: ['config:read', 'root:everything'] });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/unknown permission/);
  });

  it('rejects bad ids and versions', () => {
    expect(validateManifest({ ...base(), id: 'NoNamespace' }).ok).toBe(false);
    expect(validateManifest({ ...base(), id: 'Acme.Ports' }).ok).toBe(false);
    expect(validateManifest({ ...base(), version: '1.0' }).ok).toBe(false);
  });

  it('rejects path traversal / non-plain filenames in main + ui', () => {
    expect(validateManifest({ ...base(), main: '../../etc/passwd' }).ok).toBe(false);
    expect(validateManifest({ ...base(), main: 'sub/dir.js' }).ok).toBe(false);
    expect(validateManifest({ ...base(), ui: '../ui.js' }).ok).toBe(false);
  });

  it('rejects invalid channel method names and duplicates', () => {
    expect(validateManifest({ ...base(), channels: ['ok', 'has:colon'] }).ok).toBe(false);
    expect(validateManifest({ ...base(), channels: ['dup', 'dup'] }).ok).toBe(false);
    expect(validateManifest({ ...base(), permissions: ['notify', 'notify'] }).ok).toBe(false);
  });

  it('namespaces channels by plugin id so a plugin can never name a core channel', () => {
    expect(pluginChannel('acme.ports', 'doThing')).toBe('plugin:acme.ports:doThing');
  });
});
