const { app, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { restoreBounds, sanitizeBounds } = require('./state');

// Persists each window's size/position so Onyx reopens where the user left it
// (audit: "window opens smaller than the screenshots" / remember last size). Bounds
// are validated + clamped to a connected display on restore so a window saved on a
// now-unplugged monitor can't open off-screen. Debounced writes keep it cheap.
module.exports = function initWindowState() {
  const file = path.join(app.getPath('userData'), 'window-state.json');
  let store = {};
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')) || {}; } catch {}

  const persist = () => { try { fs.writeFileSync(file, JSON.stringify(store)); } catch {} };

  // Returns { bounds, maximized } to construct/restore a window with.
  const getBounds = (name, defaults) => {
    const entry = store[name] || {};
    const bounds = restoreBounds(entry.bounds, screen.getAllDisplays(), defaults);
    return { bounds, maximized: !!entry.maximized };
  };

  // Attach listeners that persist this window's state as it changes.
  const track = (win, name) => {
    let t = null;
    const save = () => {
      if (!win || win.isDestroyed()) return;
      const entry = store[name] || (store[name] = {});
      entry.maximized = win.isMaximized();
      // Only capture *normal* bounds — never the maximized rectangle — so
      // un-maximizing returns to the previous floating size, not full-screen.
      if (!entry.maximized && !win.isMinimized()) {
        const b = sanitizeBounds(win.getBounds());
        if (b) entry.bounds = b;
      }
      persist();
    };
    const debounced = () => { clearTimeout(t); t = setTimeout(save, 400); };
    win.on('resize', debounced);
    win.on('move', debounced);
    win.on('maximize', save);
    win.on('unmaximize', save);
    win.on('close', save);
  };

  return { getBounds, track };
};
