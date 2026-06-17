import { describe, it, expect } from 'vitest';
import { sameContent, makePreview, capHistory, addEntry, togglePin, removeEntry, clearUnpinned } from './history.js';

const text = (id, t, pinned = false) => ({ id, type: 'text', text: t, preview: t, bytes: t.length, at: id, pinned });

describe('makePreview', () => {
  it('collapses whitespace to a single line', () => {
    expect(makePreview('a\n  b\t c')).toBe('a b c');
  });
  it('truncates with an ellipsis past the cap', () => {
    expect(makePreview('x'.repeat(10), 4)).toBe('xxxx…');
  });
  it('handles null/undefined', () => {
    expect(makePreview(undefined)).toBe('');
  });
});

describe('addEntry', () => {
  it('prepends new content (newest-first)', () => {
    let h = [];
    h = addEntry(h, text(1, 'a'));
    h = addEntry(h, text(2, 'b'));
    expect(h.map((x) => x.text)).toEqual(['b', 'a']);
  });
  it('ignores empty text and missing-image entries', () => {
    expect(addEntry([], text(1, '   '))).toEqual([]);
    expect(addEntry([], { id: 9, type: 'image', dataUrl: '' })).toEqual([]);
  });
  it('moves re-copied content to the top instead of duplicating', () => {
    let h = [text(2, 'b'), text(1, 'a')];
    h = addEntry(h, text(3, 'a'));
    expect(h.map((x) => x.text)).toEqual(['a', 'b']);
    expect(h).toHaveLength(2);
  });
  it('keeps a pin when the same content is re-copied unpinned', () => {
    let h = [text(1, 'a', true)];
    h = addEntry(h, text(2, 'a', false));
    expect(h[0].pinned).toBe(true);
  });
  it('dedupes text and image independently by content', () => {
    const img = { id: 1, type: 'image', dataUrl: 'data:img', preview: 'Image', bytes: 7, at: 1, pinned: false };
    let h = addEntry([], img);
    h = addEntry(h, { ...img, id: 2 });
    expect(h).toHaveLength(1);
  });
});

describe('capHistory', () => {
  it('drops the oldest unpinned beyond the cap', () => {
    const h = [text(3, 'c'), text(2, 'b'), text(1, 'a')];
    expect(capHistory(h, 2).map((x) => x.text)).toEqual(['c', 'b']);
  });
  it('never drops pinned entries, even past the cap', () => {
    // cap 1 with one pinned: the pin fills the only slot (room = cap - pinned = 0).
    expect(capHistory([text(3, 'c'), text(2, 'b'), text(1, 'a', true)], 1).map((x) => x.text)).toEqual(['a']);
    // cap 2 with one pinned: the pin plus the newest unpinned survive.
    expect(capHistory([text(3, 'c'), text(2, 'b'), text(1, 'a', true)], 2).map((x) => x.text)).toEqual(['c', 'a']);
    // all-pinned beyond cap: every pin is kept (the guarantee wins over the cap).
    expect(capHistory([text(2, 'b', true), text(1, 'a', true)], 1)).toHaveLength(2);
  });
});

describe('togglePin / removeEntry / clearUnpinned', () => {
  it('toggles a pin by id', () => {
    const h = [text(1, 'a')];
    expect(togglePin(h, 1)[0].pinned).toBe(true);
    expect(togglePin(togglePin(h, 1), 1)[0].pinned).toBe(false);
  });
  it('removes by id', () => {
    expect(removeEntry([text(1, 'a'), text(2, 'b')], 1).map((x) => x.text)).toEqual(['b']);
  });
  it('clears all but pinned', () => {
    const h = [text(2, 'b'), text(1, 'a', true)];
    expect(clearUnpinned(h).map((x) => x.text)).toEqual(['a']);
  });
});
