import { describe, it, expect } from 'vitest';
import { parseInline, parseBlocks } from './markdown';

describe('parseInline', () => {
  it('returns a single text node for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ t: 'text', v: 'hello world' }]);
  });

  it('parses bold, italic and inline code', () => {
    expect(parseInline('**b**')).toEqual([{ t: 'bold', v: [{ t: 'text', v: 'b' }] }]);
    expect(parseInline('_i_')).toEqual([{ t: 'italic', v: [{ t: 'text', v: 'i' }] }]);
    expect(parseInline('`c`')).toEqual([{ t: 'code', v: 'c' }]);
  });

  it('keeps surrounding text around a span', () => {
    expect(parseInline('a **b** c')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'bold', v: [{ t: 'text', v: 'b' }] },
      { t: 'text', v: ' c' },
    ]);
  });

  it('does not format inside inline code', () => {
    expect(parseInline('`**not bold**`')).toEqual([{ t: 'code', v: '**not bold**' }]);
  });

  it('parses a link into label + href', () => {
    expect(parseInline('see [docs](https://x.dev)')).toEqual([
      { t: 'text', v: 'see ' },
      { t: 'link', v: 'docs', href: 'https://x.dev' },
    ]);
  });

  it('treats an unterminated marker as literal text', () => {
    expect(parseInline('a * b')).toEqual([{ t: 'text', v: 'a * b' }]);
  });
});

describe('parseBlocks', () => {
  it('parses headings with their level', () => {
    expect(parseBlocks('## Title')).toEqual([{ t: 'heading', level: 2, children: [{ t: 'text', v: 'Title' }] }]);
  });

  it('groups a unordered list (incl. the • bullet the AI prompts use)', () => {
    const blocks = parseBlocks('• one\n• two');
    expect(blocks).toEqual([{ t: 'ul', items: [[{ t: 'text', v: 'one' }], [{ t: 'text', v: 'two' }]] }]);
  });

  it('parses dash and ordered lists', () => {
    expect(parseBlocks('- a\n- b')[0].t).toBe('ul');
    const ol = parseBlocks('2. a\n3. b')[0];
    expect(ol).toMatchObject({ t: 'ol', start: 2 });
  });

  it('parses a fenced code block with a language', () => {
    expect(parseBlocks('```js\nconst x=1\n```')).toEqual([{ t: 'code', lang: 'js', code: 'const x=1' }]);
  });

  it('treats an unterminated fence as a code block (streaming-safe)', () => {
    expect(parseBlocks('```\npartial')).toEqual([{ t: 'code', lang: '', code: 'partial' }]);
  });

  it('separates paragraphs on blank lines and a label from its list', () => {
    const blocks = parseBlocks('Repos:\n• a\n• b');
    expect(blocks[0]).toEqual({ t: 'p', children: [{ t: 'text', v: 'Repos:' }] });
    expect(blocks[1].t).toBe('ul');
  });

  it('parses blockquotes and horizontal rules', () => {
    expect(parseBlocks('> quoted')[0]).toEqual({ t: 'quote', children: [{ t: 'text', v: 'quoted' }] });
    expect(parseBlocks('---')[0]).toEqual({ t: 'hr' });
  });

  it('handles empty input', () => {
    expect(parseBlocks('')).toEqual([]);
  });
});
