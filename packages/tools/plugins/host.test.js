import { describe, it, expect } from 'vitest';
import { buildHost } from './host.js';

const plugin = { id: 'acme.demo', version: '1.0.0', permissions: ['notify', 'config:read'] };
const impl = {
  getConfig: () => ({ theme: 'midnight' }),
  notify: () => 'notified',
  readClipboard: () => 'secret',
  openExternal: () => true,
};

describe('plugin host — capability gating', () => {
  it('exposes only capabilities that are declared AND granted AND implemented', () => {
    const host = buildHost(plugin, ['notify', 'config:read'], impl);
    expect(typeof host.notify).toBe('function');
    expect(typeof host.getConfig).toBe('function');
    // clipboard:read was never declared by the plugin → absent even though impl has it.
    expect(host.readClipboard).toBeUndefined();
  });

  it('hides a declared-but-not-granted capability', () => {
    const host = buildHost(plugin, ['config:read'], impl); // notify granted = false
    expect(host.notify).toBeUndefined();
    expect(typeof host.getConfig).toBe('function');
  });

  it('hides a capability the host does not implement', () => {
    const p = { ...plugin, permissions: ['fs:read'] };
    const host = buildHost(p, ['fs:read'], impl); // impl has no readFile
    expect(host.readFile).toBeUndefined();
  });

  it('always carries id + version, never grants beyond the catalog', () => {
    const host = buildHost(plugin, ['notify', 'config:read'], impl);
    expect(host.id).toBe('acme.demo');
    expect(host.version).toBe('1.0.0');
  });
});
