import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { loadBundle, SIG_NAME } from './registry.js';
import { ONYX_PLUGIN_PUBLIC_KEY } from '../../core/src/plugins/public-key.js';

// Guards the whole signing pipeline end-to-end: the committed reference plugin must verify
// against the committed public key. Catches a stale signature, a drifted/empty key, or a
// bundle whose bytes were altered before shipping (e.g. a line-ending conversion that
// silently breaks the signature on checkout — see .gitattributes).
describe('reference plugin signature', () => {
  it('examples/plugins/hello verifies against the shipped public key', () => {
    const dir = join(process.cwd(), 'examples/plugins/hello');
    const files = [];
    let signature = '';
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (!statSync(full).isFile()) continue;
      if (name === SIG_NAME) { signature = readFileSync(full, 'utf8').trim(); continue; }
      files.push({ path: name, data: readFileSync(full) });
    }
    const res = loadBundle({ files, signature, publicKey: ONYX_PLUGIN_PUBLIC_KEY, appVersion: '2.0.0' });
    expect(res.ok).toBe(true);
    expect(res.plugin.id).toBe('onyx.hello');
  });
});
