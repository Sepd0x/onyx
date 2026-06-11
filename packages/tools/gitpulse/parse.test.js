import { describe, it, expect } from 'vitest';
import { parseGithubUrl, classifyCommitMessage } from './parse.js';

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
