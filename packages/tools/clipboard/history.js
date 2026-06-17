// Pure history-list logic for the clipboard manager (issue #7), isolated from the
// Electron `clipboard` polling in index.js so it can be unit-tested. No I/O here.
//
// An entry: { id, type:'text'|'image', text?|dataUrl?, preview, bytes, at, pinned }.
// History is newest-first. Re-copying existing content moves it to the top
// (dedup by content), and the list is capped while always keeping pinned items.

function sameContent(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  return a.type === 'image' ? a.dataUrl === b.dataUrl : a.text === b.text;
}

// One-line, length-bounded preview for text entries.
function makePreview(text, max = 140) {
  const oneLine = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

// Trim to `cap` items, but never drop a pinned one: pinned are always kept, then
// the most-recent unpinned fill the remaining slots. Original order is preserved.
function capHistory(history, cap) {
  if (history.length <= cap) return history;
  const pinnedCount = history.filter((h) => h.pinned).length;
  const room = Math.max(0, cap - pinnedCount);
  let kept = 0;
  return history.filter((h) => {
    if (h.pinned) return true;
    if (kept < room) { kept++; return true; }
    return false;
  });
}

// Prepend an entry, removing any existing copy of the same content first (so a
// re-copy moves it to the top instead of duplicating), then cap. Empty entries
// (no text / no image) are ignored.
function addEntry(history, entry, cap = 100) {
  if (!entry || (entry.type === 'text' && !String(entry.text || '').trim()) || (entry.type === 'image' && !entry.dataUrl)) {
    return history;
  }
  // Preserve a pin if the same content was already pinned.
  const prior = history.find((h) => sameContent(h, entry));
  const merged = prior ? { ...entry, pinned: entry.pinned || prior.pinned } : entry;
  const filtered = history.filter((h) => !sameContent(h, entry));
  return capHistory([merged, ...filtered], cap);
}

function togglePin(history, id) {
  return history.map((h) => (h.id === id ? { ...h, pinned: !h.pinned } : h));
}

function removeEntry(history, id) {
  return history.filter((h) => h.id !== id);
}

// Clear everything except pinned entries.
function clearUnpinned(history) {
  return history.filter((h) => h.pinned);
}

module.exports = { sameContent, makePreview, capHistory, addEntry, togglePin, removeEntry, clearUnpinned };
