import { describe, it, expect } from 'vitest';
import { formatMem, formatBytes, parseNetstat, parseTasklistCsv, parseCimProcesses } from './parse.js';

describe('formatMem', () => {
  it('formats locale-mangled tasklist memory strings', () => {
    expect(formatMem('60,964 K')).toBe('59.5 MB');
    expect(formatMem('512 K')).toBe('512 KB');
    expect(formatMem('1 024 K')).toBe('1.0 MB'); // non-breaking-space locale
  });
  it('is null-safe', () => {
    expect(formatMem('N/A')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats CIM WorkingSetSize bytes', () => {
    expect(formatBytes(125829120)).toBe('120 MB');
    expect(formatBytes(2147483648)).toBe('2.0 GB');
    expect(formatBytes(40960)).toBe('40 KB');
  });
  it('is null-safe for zero/garbage', () => {
    expect(formatBytes(0)).toBeNull();
    expect(formatBytes('nope')).toBeNull();
  });
});

describe('parseNetstat', () => {
  const sample = [
    'Active Connections',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234',
    '  TCP    127.0.0.1:5173         127.0.0.1:54321        ESTABLISHED     8910',
    '  TCP    [::]:135               [::]:0                 LISTENING       4',
    '  UDP    0.0.0.0:5353           *:*                                    5678',
    '  TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING       1234', // duplicate
  ].join('\n');

  it('parses TCP rows with state, pid and the remote address', () => {
    const rows = parseNetstat(sample);
    const r3000 = rows.find((r) => r.port === '3000');
    expect(r3000).toMatchObject({ proto: 'TCP', port: '3000', state: 'LISTENING', pid: '1234', remote: '0.0.0.0:0', ipv6: false });
    const estab = rows.find((r) => r.port === '5173');
    expect(estab).toMatchObject({ state: 'ESTABLISHED', pid: '8910', remote: '127.0.0.1:54321' });
  });

  it('parses UDP rows (no state column) and flags IPv6', () => {
    const rows = parseNetstat(sample);
    const udp = rows.find((r) => r.proto === 'UDP');
    expect(udp).toMatchObject({ port: '5353', state: 'UDP', pid: '5678' });
    const v6 = rows.find((r) => r.port === '135');
    expect(v6.ipv6).toBe(true);
    expect(v6.pid).toBe('4');
  });

  it('de-dupes identical rows and ignores headers/garbage', () => {
    const rows = parseNetstat(sample);
    expect(rows.filter((r) => r.port === '3000')).toHaveLength(1);
    expect(parseNetstat('')).toEqual([]);
    expect(parseNetstat(undefined)).toEqual([]);
  });
});

describe('parseTasklistCsv', () => {
  it('maps pid → { name, ram }, stripping .exe', () => {
    const out = parseTasklistCsv('"node.exe","1234","Console","1","120,000 K"\n"postgres.exe","5678","Services","0","80,000 K"');
    expect(out['1234']).toMatchObject({ name: 'node', ram: '117.2 MB' });
    expect(out['5678'].name).toBe('postgres');
  });
  it('is empty-safe', () => {
    expect(parseTasklistCsv('')).toEqual({});
  });
});

describe('parseCimProcesses', () => {
  it('maps pid → { name, ppid, path, ram } from CIM JSON', () => {
    const json = JSON.stringify([
      { ProcessId: 1234, ParentProcessId: 600, Name: 'node.exe', ExecutablePath: 'C:\\Program Files\\nodejs\\node.exe', WorkingSetSize: 125829120 },
      { ProcessId: 4, ParentProcessId: 0, Name: 'System', ExecutablePath: null, WorkingSetSize: 40960 },
    ]);
    const out = parseCimProcesses(json);
    expect(out['1234']).toEqual({ name: 'node', ppid: '600', path: 'C:\\Program Files\\nodejs\\node.exe', ram: '120 MB' });
    expect(out['4']).toMatchObject({ name: 'System', ppid: '0', path: null });
  });
  it('tolerates a single bare object and bad JSON', () => {
    const one = parseCimProcesses(JSON.stringify({ ProcessId: 9, Name: 'x.exe', WorkingSetSize: 1048576 }));
    expect(one['9'].name).toBe('x');
    expect(parseCimProcesses('not json')).toEqual({});
    expect(parseCimProcesses('')).toEqual({});
  });
});
