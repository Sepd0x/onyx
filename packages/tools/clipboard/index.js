// Clipboard history manager (issue #7). Polls the OS clipboard in MAIN and keeps a
// recent history the renderer can browse, re-copy, pin, delete and clear.
//
// PRIVACY: history is IN-MEMORY only — it is never written to disk, so nothing a
// user copied (passwords, tokens) survives a restart. Capture can be paused. The
// list logic (dedup / cap / pin) lives in ./history.js (pure + unit-tested).
const { ipcMain, clipboard, nativeImage } = require('electron');
const { addEntry, togglePin, removeEntry, clearUnpinned, makePreview } = require('./history');

const CAP = 100;       // total entries kept (pinned are always kept on top of this)
const POLL_MS = 1500;  // how often the OS clipboard is sampled

module.exports = function initClipboard() {
  let history = [];
  let paused = false;
  let seq = 0;
  // Signatures of what we last saw, so a static clipboard isn't re-added each poll.
  let lastText = '';
  let lastImage = '';

  const newId = () => `clip-${++seq}`;

  function sample() {
    if (paused) return;
    try {
      const text = clipboard.readText();
      if (text && text !== lastText) {
        lastText = text;
        lastImage = '';
        history = addEntry(history, {
          id: newId(), type: 'text', text,
          preview: makePreview(text), bytes: Buffer.byteLength(text, 'utf8'),
          at: Date.now(), pinned: false,
        }, CAP);
        return;
      }
      if (!text) {
        const img = clipboard.readImage();
        if (img && !img.isEmpty()) {
          const dataUrl = img.toDataURL();
          if (dataUrl && dataUrl !== lastImage) {
            lastImage = dataUrl;
            lastText = '';
            const { width, height } = img.getSize();
            history = addEntry(history, {
              id: newId(), type: 'image', dataUrl,
              preview: `Image · ${width}×${height}`, bytes: dataUrl.length,
              at: Date.now(), pinned: false,
            }, CAP);
          }
        }
      }
    } catch {}
  }

  const timer = setInterval(sample, POLL_MS);
  if (timer.unref) timer.unref(); // don't keep the process alive for the poll
  sample();

  ipcMain.handle('clipboard:get', () => ({ paused, items: history }));

  // Re-copy an entry back to the OS clipboard and float it to the top.
  ipcMain.handle('clipboard:copy', (_e, arg) => {
    const id = arg && arg.id;
    const item = history.find((h) => h.id === id);
    if (!item) return false;
    try {
      if (item.type === 'image') {
        clipboard.writeImage(nativeImage.createFromDataURL(item.dataUrl));
        lastImage = item.dataUrl; lastText = '';
      } else {
        clipboard.writeText(item.text);
        lastText = item.text; lastImage = '';
      }
    } catch { return false; }
    history = addEntry(history, { ...item, at: Date.now() }, CAP);
    return true;
  });

  ipcMain.handle('clipboard:togglePin', (_e, arg) => { history = togglePin(history, arg && arg.id); return true; });
  ipcMain.handle('clipboard:delete', (_e, arg) => { history = removeEntry(history, arg && arg.id); return true; });
  ipcMain.handle('clipboard:clear', () => { history = clearUnpinned(history); return true; });
  ipcMain.handle('clipboard:setPaused', (_e, arg) => { paused = !!(arg && arg.paused); return paused; });
};
