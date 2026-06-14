import { describe, it, expect } from 'vitest';
import { parseGithubUrl, parseRemoteSlug, pairRepoCards, classifyCommitMessage, bucketCommitDates, capDiff } from './parse.js';

describe('parseRemoteSlug', () => {
  it('normalises https and ssh origins to owner/repo, dropping .git', () => {
    expect(parseRemoteSlug('https://github.com/Sepd0x/onyx.git')).toBe('Sepd0x/onyx');
    expect(parseRemoteSlug('https://github.com/Sepd0x/onyx')).toBe('Sepd0x/onyx');
    expect(parseRemoteSlug('git@github.com:Sepd0x/onyx.git')).toBe('Sepd0x/onyx');
    expect(parseRemoteSlug('git@github.com:Sepd0x/onyx')).toBe('Sepd0x/onyx');
  });

  it('returns null for non-GitHub or empty remotes', () => {
    expect(parseRemoteSlug('https://gitlab.com/a/b.git')).toBeNull();
    expect(parseRemoteSlug('')).toBeNull();
    expect(parseRemoteSlug(undefined)).toBeNull();
  });
});

describe('pairRepoCards', () => {
  const local = (path, remoteSlug) => ({ type: 'local', path, name: path.split('/').pop(), remoteSlug });
  const remote = (slug) => ({ type: 'remote', path: `https://github.com/${slug}`, name: slug, branch: 'main', dirty: 2, lastCommit: 'feat: x' });

  it('merges a local repo with the GitHub twin matching its origin slug (case-insensitive)', () => {
    const out = pairRepoCards([local('C:/dev/onyx', 'Sepd0x/Onyx')], [remote('sepd0x/onyx')]);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('unified');
    expect(out[0].path).toBe('C:/dev/onyx');
    expect(out[0].remote).toEqual({ slug: 'sepd0x/onyx', url: 'https://github.com/sepd0x/onyx', branch: 'main', openIssues: 2, lastCommit: 'feat: x' });
  });

  it('leaves unmatched local and remote cards standalone', () => {
    const out = pairRepoCards([local('C:/dev/a', 'me/a')], [remote('me/b')]);
    expect(out.map((c) => c.type)).toEqual(['local', 'remote']);
  });

  it('suppresses an auto-match when the pair is unlinked', () => {
    const directives = { 'C:/dev/onyx': { unlinked: ['https://github.com/me/onyx'] } };
    const out = pairRepoCards([local('C:/dev/onyx', 'me/onyx')], [remote('me/onyx')], directives);
    expect(out.map((c) => c.type)).toEqual(['local', 'remote']);
  });

  it('forces a pairing via an explicit link even when slugs differ or origin is absent', () => {
    const directives = { 'C:/dev/onyx': { link: 'https://github.com/me/other' } };
    const out = pairRepoCards([local('C:/dev/onyx', null)], [remote('me/other')], directives);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('unified');
    expect(out[0].remote.slug).toBe('me/other');
  });
});

describe('parseGithubUrl', () => {
  it('parses a standard repo url', () => {
    expect(parseGithubUrl('https://github.com/Sepd0x/onyx')).toEqual({
      owner: 'Sepd0x',
      repo: 'onyx',
      slug: 'Sepd0x/onyx',
      url: 'https://github.com/Sepd0x/onyx',
    });
  });

  it('strips a trailing .git', () => {
    expect(parseGithubUrl('https://github.com/a/b.git').repo).toBe('b');
  });

  it('ignores extra path segments', () => {
    expect(parseGithubUrl('https://github.com/a/b/tree/main').slug).toBe('a/b');
  });

  it('rejects non-github or malformed input', () => {
    expect(parseGithubUrl('https://gitlab.com/a/b')).toBeNull();
    expect(parseGithubUrl('http://github.com/a/b')).toBeNull();
    expect(parseGithubUrl('not a url')).toBeNull();
    expect(parseGithubUrl(null)).toBeNull();
  });
});

describe('classifyCommitMessage', () => {
  it('flags low-effort messages', () => {
    expect(classifyCommitMessage('fix').warning).toBeTruthy();
    expect(classifyCommitMessage('Update').warning).toBeTruthy();
    expect(classifyCommitMessage('wip').warning).toBeTruthy(); // length < 5
  });

  it('accepts descriptive messages', () => {
    expect(classifyCommitMessage('feat: add real launchers').warning).toBeNull();
    expect(classifyCommitMessage('No commits').warning).toBeNull();
  });

  it('is null-safe', () => {
    expect(classifyCommitMessage(undefined).warning).toBeNull();
  });
});

describe('bucketCommitDates', () => {
  const today = '2026-06-12';

  it('returns a zero array of the requested length for no commits', () => {
    expect(bucketCommitDates([], 14, today)).toEqual(new Array(14).fill(0));
  });

  it('puts today\'s commits in the last bucket', () => {
    const out = bucketCommitDates([today, today], 14, today);
    expect(out[13]).toBe(2);
    expect(out.slice(0, 13)).toEqual(new Array(13).fill(0));
  });

  it('places older commits at the right offset and ignores out-of-window dates', () => {
    const out = bucketCommitDates(['2026-06-12', '2026-06-11', '2026-05-01'], 14, today);
    expect(out[13]).toBe(1); // today
    expect(out[12]).toBe(1); // yesterday
    expect(out.reduce((a, b) => a + b, 0)).toBe(2); // 2026-05-01 is >13 days ago, dropped
  });

  it('ignores malformed or future dates and bad input', () => {
    const out = bucketCommitDates(['not-a-date', '2026-06-20', null, undefined], 14, today);
    expect(out).toEqual(new Array(14).fill(0));
    expect(bucketCommitDates('nope', 14, today)).toEqual(new Array(14).fill(0));
    expect(bucketCommitDates([today], 14, 'bad-today')).toEqual(new Array(14).fill(0));
  });
});

describe('capDiff', () => {
  it('returns empty for non-string or empty input', () => {
    expect(capDiff('')).toBe('');
    expect(capDiff(null)).toBe('');
    expect(capDiff(undefined)).toBe('');
  });

  it('passes a small diff through unchanged', () => {
    const d = 'diff --git a/x b/x\n+hello\n';
    expect(capDiff(d)).toBe(d);
  });

  it('truncates an oversized single-file diff', () => {
    const big = 'diff --git a/big b/big\n' + 'x'.repeat(20000);
    const out = capDiff(big, 30000, 8000);
    expect(out.length).toBeLessThan(big.length);
    expect(out).toContain('[file diff truncated]');
  });

  it('stops adding files once the total cap is reached', () => {
    const file = (n) => `diff --git a/f${n} b/f${n}\n` + 'y'.repeat(5000) + '\n';
    const diff = file(1) + file(2) + file(3) + file(4) + file(5) + file(6);
    const out = capDiff(diff, 12000, 8000);
    expect(out.length).toBeLessThanOrEqual(12000 + 40);
    expect(out).toContain('[diff truncated to fit context]');
    expect(out).toContain('a/f1'); // earliest file kept
  });
});
