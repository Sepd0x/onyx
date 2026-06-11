import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { INVOKE_CHANNELS, EVENT_CHANNELS } from '../src/channels.js';

const ROOT = process.cwd(); // vitest runs from the repo root

const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');

function mainProcessSources() {
  const files = ['packages/core/src/main.js', 'packages/core/src/app-settings.js'];
  const toolsDir = join(ROOT, 'packages/tools');
  for (const name of readdirSync(toolsDir)) {
    const rel = `packages/tools/${name}/index.js`;
    if (existsSync(join(ROOT, rel))) files.push(rel);
  }
  return files.map(read);
}

function extract(text, re) {
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

// Pull the string-literal values out of the CH / EV objects in the UI's ipc.ts.
function ipcConstants() {
  const ipc = read('packages/ui/src/ipc.ts');
  const slice = (from, to) => ipc.slice(ipc.indexOf(from), to ? ipc.indexOf(to) : undefined);
  const ch = extract(slice('export const CH', 'export const EV'), /'([^']+)'/g);
  const ev = extract(slice('export const EV', 'export type'), /'([^']+)'/g);
  return { ch, ev };
}

describe('IPC channel contract', () => {
  it('has no duplicate invoke channels', () => {
    expect(new Set(INVOKE_CHANNELS).size).toBe(INVOKE_CHANNELS.length);
  });

  it('every ipcMain.handle channel is declared in channels.js', () => {
    const handlers = mainProcessSources().flatMap((t) => extract(t, /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g));
    expect(handlers.length).toBeGreaterThan(0);
    for (const ch of handlers) expect(INVOKE_CHANNELS).toContain(ch);
  });

  it('the renderer CH constants mirror channels.js exactly', () => {
    const { ch } = ipcConstants();
    expect(ch.length).toBeGreaterThan(0);
    expect([...ch].sort()).toEqual([...INVOKE_CHANNELS].sort());
  });

  it('the renderer EV constants mirror the event channels exactly', () => {
    const { ev } = ipcConstants();
    expect([...ev].sort()).toEqual([...EVENT_CHANNELS].sort());
  });

  it('preload derives its allowlist from channels.js', () => {
    const preload = read('packages/core/src/preload.js');
    expect(preload).toContain("require('./channels')");
    expect(preload).toContain('INVOKE_CHANNELS');
  });
});
