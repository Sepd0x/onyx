// Tiny, dependency-free Markdown parser for AI output (issue #10).
//
// Why not react-markdown: it pulls a large remark/micromark tree, and AI output
// only ever DISPLAYS (the security model forbids it driving actions). We parse a
// safe subset into a plain data model here (pure + unit-tested), and Markdown.tsx
// renders that model to React nodes — no `dangerouslySetInnerHTML`, so no XSS
// surface from untrusted model text. Tolerant of partial input (streaming).

export type Inline =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: Inline[] }
  | { t: 'italic'; v: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string };

export type Block =
  | { t: 'heading'; level: number; children: Inline[] }
  | { t: 'p'; children: Inline[] }
  | { t: 'ul'; items: Inline[][] }
  | { t: 'ol'; start: number; items: Inline[][] }
  | { t: 'code'; lang: string; code: string }
  | { t: 'quote'; children: Inline[] }
  | { t: 'hr' };

// Parse a single line's inline spans. Recursive for nesting (bold>italic etc.).
// Precedence: inline code (opaque) → bold → italic → link → literal text.
export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let buf = '';
  let i = 0;
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = ''; } };

  while (i < text.length) {
    const c = text[i];

    // `inline code` — opaque, no formatting inside.
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) { flush(); out.push({ t: 'code', v: text.slice(i + 1, end) }); i = end + 1; continue; }
    }

    // **bold** / __bold__
    if (text.startsWith('**', i) || text.startsWith('__', i)) {
      const marker = text.slice(i, i + 2);
      const end = text.indexOf(marker, i + 2);
      if (end > i + 1) { flush(); out.push({ t: 'bold', v: parseInline(text.slice(i + 2, end)) }); i = end + 2; continue; }
    }

    // *italic* / _italic_
    if (c === '*' || c === '_') {
      const end = text.indexOf(c, i + 1);
      if (end > i + 1) { flush(); out.push({ t: 'italic', v: parseInline(text.slice(i + 1, end)) }); i = end + 1; continue; }
    }

    // [label](href)
    if (c === '[') {
      const close = text.indexOf(']', i + 1);
      if (close > i && text[close + 1] === '(') {
        const pend = text.indexOf(')', close + 2);
        if (pend > close) { flush(); out.push({ t: 'link', v: text.slice(i + 1, close), href: text.slice(close + 2, pend) }); i = pend + 1; continue; }
      }
    }

    buf += c;
    i++;
  }
  flush();
  return out;
}

const BULLET_RE = /^\s*([-*+•])\s+(.*)$/;
const ORDERED_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const HR_RE = /^\s*([-*_])\1{2,}\s*$/;

// Parse Markdown text into a flat list of blocks. Tolerant of unterminated fences
// (streaming): an open ``` consumes the rest as a code block.
export function parseBlocks(src: string): Block[] {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) { blocks.push({ t: 'p', children: parseInline(para.join(' ')) }); para = []; }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flushPara();
      const lang = fence[1].trim();
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) { body.push(lines[i]); i++; }
      i++; // skip closing fence (or run off the end when unterminated)
      blocks.push({ t: 'code', lang, code: body.join('\n') });
      continue;
    }

    if (line.trim() === '') { flushPara(); i++; continue; }

    if (HR_RE.test(line)) { flushPara(); blocks.push({ t: 'hr' }); i++; continue; }

    const h = line.match(HEADING_RE);
    if (h) { flushPara(); blocks.push({ t: 'heading', level: h[1].length, children: parseInline(h[2]) }); i++; continue; }

    if (line.startsWith('>')) {
      flushPara();
      const quoted: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) { quoted.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push({ t: 'quote', children: parseInline(quoted.join(' ')) });
      continue;
    }

    if (BULLET_RE.test(line)) {
      flushPara();
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = lines[i].match(BULLET_RE);
        if (!m) break;
        items.push(parseInline(m[2]));
        i++;
      }
      blocks.push({ t: 'ul', items });
      continue;
    }

    if (ORDERED_RE.test(line)) {
      flushPara();
      const first = line.match(ORDERED_RE)!;
      const start = parseInt(first[1], 10) || 1;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const m = lines[i].match(ORDERED_RE);
        if (!m) break;
        items.push(parseInline(m[2]));
        i++;
      }
      blocks.push({ t: 'ol', start, items });
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flushPara();
  return blocks;
}
