const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Always-on-top desktop overlay — a compact, draggable widget that floats above
// other windows showing live CPU/RAM/ports/clock. Off by default; toggled from the
// tray menu or Settings. Its own window (like the tray popup), reusing the renderer
// bundle via the #overlay hash so it needs no separate build entry.
//
// `opts`: { preload, isDev, indexHtml } supplied by main so the path/load logic
// stays in one place.
module.exports = function initOverlay(opts) {
  const { preload, isDev, indexHtml } = opts || {};
  const file = path.join(app.getPath('userData'), 'overlay-config.json');
  let config = {
    enabled: false,
    opacity: 0.92,
    tiles: { cpu: true, ram: true, ports: true, clock: true },
    bounds: null,
  };
  try { config = { ...config, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}

  const save = () => { try { fs.writeFileSync(file, JSON.stringify(config)); } catch {} };

  let overlay = null;

  const create = () => {
    const b = (config.bounds && typeof config.bounds === 'object') ? config.bounds : {};
    overlay = new BrowserWindow({
      width: b.width || 232,
      height: b.height || 152,
      x: Number.isFinite(b.x) ? b.x : undefined,
      y: Number.isFinite(b.y) ? b.y : undefined,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: true,
      hasShadow: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true,
        devTools: !app.isPackaged,
        preload,
      },
    });
    // Float above normal windows and stay visible across virtual desktops.
    overlay.setAlwaysOnTop(true, 'screen-saver');
    try { overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}

    if (isDev) overlay.loadURL('http://localhost:3000/#overlay');
    else overlay.loadFile(indexHtml, { hash: 'overlay' });

    // Persist position as the user drags it (debounced).
    let t = null;
    const persistBounds = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        if (overlay && !overlay.isDestroyed()) { config.bounds = overlay.getBounds(); save(); }
      }, 400);
    };
    overlay.on('move', persistBounds);
    overlay.on('closed', () => { overlay = null; });
  };

  const show = () => { if (!overlay) create(); overlay.showInactive(); }; // never steals focus
  const hide = () => { if (overlay && !overlay.isDestroyed()) overlay.hide(); };
  const apply = () => { if (config.enabled) show(); else hide(); };

  if (config.enabled) apply();

  const get = () => ({ enabled: config.enabled, opacity: config.opacity, tiles: config.tiles });

  ipcMain.handle('overlay:get', () => get());
  ipcMain.handle('overlay:set', (_, data) => {
    if (data && typeof data === 'object') {
      if (typeof data.opacity === 'number') config.opacity = Math.max(0.3, Math.min(1, data.opacity));
      if (data.tiles && typeof data.tiles === 'object') config.tiles = { ...config.tiles, ...data.tiles };
    }
    save();
    return get();
  });
  ipcMain.handle('overlay:toggle', (_, on) => {
    config.enabled = typeof on === 'boolean' ? on : !config.enabled;
    save();
    apply();
    return config.enabled;
  });

  return {
    toggle: (on) => { config.enabled = typeof on === 'boolean' ? on : !config.enabled; save(); apply(); return config.enabled; },
    isVisible: () => !!(overlay && !overlay.isDestroyed() && overlay.isVisible()),
  };
};
