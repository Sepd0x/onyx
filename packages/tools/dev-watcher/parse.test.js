import { describe, it, expect } from 'vitest';
import {
  parseWinProcessJson,
  parsePosixPs,
  scoreDevProcess,
  extractDevProcesses,
} from './parse.js';

describe('parseWinProcessJson', () => {
  it('parses a JSON array from Get-CimInstance', () => {
    const stdout = JSON.stringify([
      { ProcessId: 1234, Name: 'node.exe', CommandLine: 'node C:\\app\\src\\index.js' },
      { ProcessId: 5678, Name: 'Code.exe', CommandLine: null },
    ]);
    expect(parseWinProcessJson(stdout)).toEqual([
      { pid: '1234', name: 'node.exe', command: 'node C:\\app\\src\\index.js' },
      { pid: '5678', name: 'Code.exe', command: '' },
    ]);
  });

  it('tolerates a bare object (single process without the @() wrapper)', () => {
    const stdout = JSON.stringify({ ProcessId: 42, Name: 'vite.exe', CommandLine: 'vite --port 3000' });
    expect(parseWinProcessJson(stdout)).toEqual([
      { pid: '42', name: 'vite.exe', command: 'vite --port 3000' },
    ]);
  });

  it('keeps comma-laden command lines intact (the old CSV parser shifted fields)', () => {
    const cmd = 'node --max-old-space-size=4096 "C:\\a, b\\src\\main.js" --flag=1,2,3';
    const stdout = JSON.stringify([{ ProcessId: 9, Name: 'node.exe', CommandLine: cmd }]);
    expect(parseWinProcessJson(stdout)[0]).toEqual({ pid: '9', name: 'node.exe', command: cmd });
  });

  it('skips entries without ProcessId or Name', () => {
    const stdout = JSON.stringify([
      { ProcessId: null, Name: 'x.exe', CommandLine: '' },
      { ProcessId: 1, Name: '', CommandLine: '' },
      null,
    ]);
    expect(parseWinProcessJson(stdout)).toEqual([]);
  });

  it('returns null on unparseable JSON so the caller can log it', () => {
    expect(parseWinProcessJson('not json')).toBeNull();
    // OEM best-fit encoding can inject raw quotes into command lines,
    // corrupting the document — must be reported, not silently empty.
    expect(parseWinProcessJson('[{"ProcessId":1,"Name":"x.exe","CommandLine":"a"b"c"}]')).toBeNull();
  });

  it('returns [] on empty or valid-but-resultless input', () => {
    expect(parseWinProcessJson('')).toEqual([]);
    expect(parseWinProcessJson(undefined)).toEqual([]);
    expect(parseWinProcessJson('null')).toEqual([]);
    expect(parseWinProcessJson('[]')).toEqual([]);
  });
});

describe('parsePosixPs', () => {
  it('parses ps output and skips the header', () => {
    const stdout = [
      '  PID COMM             ARGS',
      '  123 node             node /home/dev/src/server.js',
      '  456 bash             -bash',
    ].join('\n');
    expect(parsePosixPs(stdout)).toEqual([
      { pid: '123', name: 'node', command: 'node /home/dev/src/server.js' },
      { pid: '456', name: 'bash', command: '-bash' },
    ]);
  });

  it('skips malformed lines and non-numeric pids', () => {
    const stdout = 'PID COMM ARGS\ngarbage\nabc node node x.js\n';
    expect(parsePosixPs(stdout)).toEqual([]);
  });

  it('returns [] on empty input', () => {
    expect(parsePosixPs('')).toEqual([]);
    expect(parsePosixPs(undefined)).toEqual([]);
  });
});

describe('scoreDevProcess', () => {
  it('scores dev tooling above the 0.35 threshold', () => {
    expect(scoreDevProcess('node.exe', 'node c:\\proj\\src\\index.js')).toBeGreaterThanOrEqual(0.35);
    expect(scoreDevProcess('code.exe', '')).toBeGreaterThanOrEqual(0.35);
    expect(scoreDevProcess('python.exe', 'python -m venv run')).toBeGreaterThanOrEqual(0.35);
  });

  it('scores Windows back-slash src paths (separator-agnostic)', () => {
    const win = scoreDevProcess('myapp.exe', 'c:\\work\\myproj\\src\\main.rs');
    const posix = scoreDevProcess('myapp', '/work/myproj/src/main.rs');
    expect(win).toBeGreaterThan(0);
    expect(win).toBe(posix);
  });

  it('scores unrelated system processes below the threshold', () => {
    expect(scoreDevProcess('svchost.exe', '')).toBeLessThan(0.35);
    expect(scoreDevProcess('explorer.exe', 'c:\\windows\\explorer.exe')).toBeLessThan(0.35);
  });
});

describe('extractDevProcesses', () => {
  it('shapes results for IPC: lowercase name, .exe-stripped type, percent confidence', () => {
    const out = extractDevProcesses([
      { pid: '10', name: 'Node.EXE', command: 'node node_modules/.bin/vite' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].pid).toBe('10');
    expect(out[0].name).toBe('node.exe');
    expect(out[0].type).toBe('node');
    expect(out[0].confidence).toMatch(/^[0-9]+%$/);
  });

  it('drops low-confidence processes and dedupes by pid', () => {
    const out = extractDevProcesses([
      { pid: '1', name: 'svchost.exe', command: '' },
      { pid: '2', name: 'node.exe', command: 'vite' },
      { pid: '2', name: 'node.exe', command: 'vite' },
      { pid: '', name: 'node.exe', command: 'vite' },
    ]);
    expect(out.map((p) => p.pid)).toEqual(['2']);
  });

  it('never surfaces Onyx itself (packaged onyx.exe), whatever it scores', () => {
    const out = extractDevProcesses([
      { pid: '100', name: 'onyx.exe', command: 'onyx --inspect node_modules vite localhost' },
      { pid: '101', name: 'node.exe', command: 'vite' },
    ]);
    expect(out.map((p) => p.pid)).toEqual(['101']);
  });

  it('excludes our own Electron pids (main/renderer/gpu) passed by the handler', () => {
    const list = [
      { pid: '200', name: 'electron.exe', command: 'electron node_modules vite localhost --inspect' },
      { pid: '201', name: 'node.exe', command: 'vite' },
    ];
    expect(extractDevProcesses(list, ['200']).map((p) => p.pid)).toEqual(['201']);
    expect(extractDevProcesses(list, new Set(['200'])).map((p) => p.pid)).toEqual(['201']);
    // Without exclusion the dev renderer would (wrongly) show up.
    expect(extractDevProcesses(list).map((p) => p.pid)).toContain('200');
  });

  it('caps confidence at 99%', () => {
    const out = extractDevProcesses([
      {
        pid: '7',
        name: 'node.exe',
        command: 'node --inspect node_modules vite build model localhost src/x cargo .py venv',
      },
    ]);
    expect(out[0].confidence).toBe('99%');
  });
});
