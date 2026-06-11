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

function rendererSources() {
  const files = ['packages/ui/src/App.tsx'];
  const viewsDir = join(ROOT, 'packages/ui/src/views');
  for (const name of readdirSync(viewsDir)) {
    if (name.endsWith('.tsx')) files.push(`packages/ui/src/views/${name}`);
  }
  return files.map(read);
}

function extract(text, re) {
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
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

  it('every renderer invoke() call targets a declared channel', () => {
    const calls = rendererSources().flatMap((t) => extract(t, /\.invoke\(\s*['"]([^'"]+)['"]/g));
    for (const ch of calls) expect(INVOKE_CHANNELS).toContain(ch);
  });

  it('every renderer on() subscription targets a declared event channel', () => {
    const subs = rendererSources().flatMap((t) => extract(t, /api\.on\(\s*['"]([^'"]+)['"]/g));
    for (const ch of subs) expect(EVENT_CHANNELS).toContain(ch);
  });

  it('preload derives its allowlist from channels.js', () => {
    const preload = read('packages/core/src/preload.js');
    expect(preload).toContain("require('./channels')");
    expect(preload).toContain('INVOKE_CHANNELS');
  });
});
