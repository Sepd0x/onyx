import { describe, it, expect } from 'vitest';
import { CRITICAL_DENYLIST, normalizeAppName, sanitizeBlocklist, pidsToKill } from './match.js';

describe('normalizeAppName', () => {
  it('lower-cases and appends .exe', () => {
    expect(normalizeAppName('Discord')).toBe('discord.exe');
    expect(normalizeAppName('Steam.EXE')).toBe('steam.exe');
  });
  it('strips a pasted path to the basename', () => {
    expect(normalizeAppName('C:\\Program Files\\Discord\\Discord.exe')).toBe('discord.exe');
    expect(normalizeAppName('/usr/bin/slack')).toBe('slack.exe');
  });
  it('rejects junk and empty input', () => {
    expect(normalizeAppName('')).toBe('');
    expect(normalizeAppName('  ')).toBe('');
    expect(normalizeAppName('bad;name & rm.exe')).toBe('');
  });
});

describe('sanitizeBlocklist', () => {
  it('normalises, de-dupes and drops invalid entries', () => {
    expect(sanitizeBlocklist(['Discord', 'discord.exe', 'Steam', ''])).toEqual(['discord.exe', 'steam.exe']);
  });
  it('never keeps a critical/OS process even if the user adds it', () => {
    expect(sanitizeBlocklist(['explorer.exe', 'csrss', 'onyx.exe', 'Discord'])).toEqual(['discord.exe']);
    for (const c of CRITICAL_DENYLIST) expect(sanitizeBlocklist([c])).toEqual([]);
  });
  it('handles non-array input', () => {
    expect(sanitizeBlocklist(undefined)).toEqual([]);
  });
});

describe('pidsToKill', () => {
  const procs = [
    { pid: '100', name: 'Discord.exe' },
    { pid: '101', name: 'code.exe' },
    { pid: '102', name: 'steam.exe' },
    { pid: '103', name: 'explorer.exe' }, // critical — must be ignored
  ];
  it('returns only PIDs whose name is in the blocklist', () => {
    expect(pidsToKill(procs, ['discord', 'steam'])).toEqual(['100', '102']);
  });
  it('never returns a critical process even if somehow blocklisted', () => {
    expect(pidsToKill(procs, ['explorer'])).toEqual([]);
  });
  it("excludes Onyx's own PIDs", () => {
    expect(pidsToKill(procs, ['discord'], [100])).toEqual([]);
  });
  it('returns nothing for an empty blocklist', () => {
    expect(pidsToKill(procs, [])).toEqual([]);
  });
  it('ignores malformed process rows', () => {
    expect(pidsToKill([{ pid: 'x', name: 'discord.exe' }, { pid: '5', name: '' }], ['discord'])).toEqual([]);
  });
});
