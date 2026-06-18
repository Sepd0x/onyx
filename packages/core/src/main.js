const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell, powerSaveBlocker, Notification, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

const setupSecurity = require('./security');
const initAppSettings = require('./app-settings');
const initPortMapper = require('../../tools/portmapper/index');
const initCursorAutoHide = require('../../tools/cursor-autohide/index');
const initBlocker = require('../../tools/blocker/index');
const initOverlay = require('../../tools/overlay/index');
const initWindowState = require('../../tools/window-state/index');
const initGitPulse = require('../../tools/gitpulse/index');
const initDevWatcher = require('../../tools/dev-watcher/index');
const initCleaner = require('../../tools/cleaner/index');
const initSnippets = require('../../tools/snippets/index');
const initClipboard = require('../../tools/clipboard/index');
const initLaunchers = require('../../tools/launchers/index');
const initPowerManager = require('../../tools/power-manager/index');
const initAI = require('../../tools/ai/index');
const initConflicts = require('../../tools/conflicts/index');
const initPortability = require('../../tools/portability/index');
const logger = require('./logger');

app.setName('Onyx');
if (process.platform === 'win32') app.setAppUserModelId('com.onyx.app');

// Last-resort crash guards. Without these a single unhandled rejection in any
// async IPC handler (e.g. an AI call) kills the main process silently — no log,
// the window just vanishes. Log the cause and keep the app alive rather than
// disappearing on the user; registering the listener also prevents Node's
// default hard-exit on an uncaught exception.
process.on('uncaughtException', (err) => {
  try { logger.error('Uncaught exception:', err && err.stack ? err.stack : String(err)); } catch {}
});
process.on('unhandledRejection', (reason) => {
  try { logger.error('Unhandled rejection:', reason && reason.stack ? reason.stack : String(reason)); } catch {}
});

let win = null;
let tray = null;
let trayWindow = null;
let appConfig = {};
let windowState = null;
let overlayCtl = null;

const iconPath = path.join(__dirname, '../../../assets/icon.png');
const trayIconPath = path.join(__dirname, '../../../assets/tray.png');

// Fixed tray-window size. Re-asserted on every show via setBounds — on Windows
// with fractional DPI scaling, repeated show/setPosition cycles shrink a
// frameless window by a rounding pixel each time (the "tray keeps getting
// smaller" bug). Driving size from constants makes it idempotent.
const TRAY_W = 300;

// Tray height adapts to which tiles the user enabled (Settings → Tray dashboard),
// so the popup is always snug — no dead space, no clipping. Mirrors TrayView's
// layout: p-4 padding + header + (stats row) + (ports row) + (guards row) + footer.
function trayHeight() {
  const showCpu = appConfig.trayShowCpu !== false;
  const showRam = appConfig.trayShowRam !== false;
  const showPorts = appConfig.trayShowPorts !== false;
  const showGuards = appConfig.trayShowGuards === true;
  // Generous starting estimate; the renderer reports the exact height via
  // tray:resize the moment it mounts/shows, so this only needs to be in the
  // ballpark and slightly over (a window that shrinks reads better than a
  // clipped one that grows).
  let h = 36 + 48 + 56; // p-4 (top+bottom) + header(+mb) + footer button
  if (showCpu || showRam) h += 128; // stats grid row + gap
  if (showPorts) h += 68;           // ports row + gap
  if (showGuards) h += 68;          // guards row + gap
  return Math.max(176, h);
}

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: TRAY_W,
    height: trayHeight(),
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: false,
    backgroundColor: '#040405',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // No DevTools in the packaged app — a "system guard" must not expose its
      // renderer/IPC surface via Ctrl+Shift+I in production (audit B1).
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    trayWindow.loadURL('http://localhost:3000/#tray');
  } else {
    trayWindow.loadFile(path.join(__dirname, '../../ui/dist/index.html'), { hash: 'tray' });
  }

  trayWindow.on('blur', () => {
    if (!trayWindow.webContents.isDevToolsOpened()) {
      trayWindow.hide();
    }
  });
}

const toggleTrayWindow = () => {
  if (trayWindow.isVisible()) {
    trayWindow.hide();
  } else {
    const h = trayHeight();
    const position = getTrayPosition({ width: TRAY_W, height: h });
    // setBounds (not setPosition) — re-assert the canonical size every show so
    // DPI rounding can't accumulate and shrink the window across clicks. Height is
    // recomputed each show so tray-tile changes take effect on next open.
    trayWindow.setBounds({ x: position.x, y: position.y, width: TRAY_W, height: h });
    trayWindow.show();
    trayWindow.focus();
  }
};

const getTrayPosition = (windowBounds) => {
  const trayBounds = tray.getBounds();
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;

  let x, y;

  if (process.platform === 'win32') {
    x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    y = Math.round(trayBounds.y - windowBounds.height - 10);
  } else {
    // macOS
    x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    y = Math.round(trayBounds.y + trayBounds.height + 4);
  }

  // Prevent going off-screen
  if (x < workArea.x) x = workArea.x;
  if (x + windowBounds.width > workArea.x + workArea.width) x = workArea.x + workArea.width - windowBounds.width;

  return { x, y };
};

function createTray() {
  const icon = nativeImage.createFromPath(trayIconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Onyx');
  
  createTrayWindow();

  tray.on('click', toggleTrayWindow);
  tray.on('right-click', () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: 'Open Workspace', click: showWindow },
      {
        label: 'Desktop overlay',
        type: 'checkbox',
        checked: !!(overlayCtl && overlayCtl.isVisible()),
        click: () => { if (overlayCtl) overlayCtl.toggle(); },
      },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]));
  });
}

function createWindow() {
  // Restore the last size/position (clamped to a connected display) so Onyx
  // reopens where the user left it instead of the default 980×680 every time.
  const { bounds, maximized } = windowState.getBounds('main', { width: 980, height: 680 });
  win = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 800,
    minHeight: 500,
    show: false,
    frame: false,
    icon: iconPath,
    transparent: false,
    backgroundColor: '#040405',
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      // No DevTools in the packaged app (audit B1) — see the tray window above.
      devTools: !app.isPackaged,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Persist size/position as the user resizes/moves; re-apply the maximized state.
  windowState.track(win, 'main');
  if (maximized) win.maximize();

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../../ui/dist/index.html'));
  }

  // If the renderer process itself dies (OOM/GPU/native — NOT a JS error the
  // renderer ErrorBoundary can catch), the window just vanishes. Log the reason so
  // a "the app crashed" report (e.g. issue #30) leaves a trace, and reload once so
  // the user isn't left staring at a dead window.
  win.webContents.on('render-process-gone', (_e, details) => {
    try { logger.error('Renderer process gone:', JSON.stringify(details)); } catch {}
    try { if (details && details.reason !== 'clean-exit' && win && !win.isDestroyed()) win.reload(); } catch {}
  });
  win.webContents.on('unresponsive', () => { try { logger.warn('Renderer became unresponsive'); } catch {} });
  win.webContents.on('responsive', () => { try { logger.info('Renderer responsive again'); } catch {} });

  ipcMain.handle('window:minimize', () => win.minimize());
  ipcMain.handle('window:close', () => win.hide());
  ipcMain.handle('window:openExternal', (_, url) => {
    try {
      const u = new URL(String(url));
      if (u.protocol === 'http:' || u.protocol === 'https:') return shell.openExternal(u.href);
    } catch (e) {}
    return false;
  });

  let sleepId = null;
  ipcMain.handle('env:keepAwake', (_, state) => {
    if (state && sleepId === null) {
      sleepId = powerSaveBlocker.start('prevent-display-sleep');
      new Notification({ title: 'System Guard', body: 'Display Sleep prevented.' }).show();
    } else if (!state && sleepId !== null) {
      powerSaveBlocker.stop(sleepId);
      sleepId = null;
      new Notification({ title: 'System Guard', body: 'Display Sleep allowed.' }).show();
    }
  });

  ipcMain.handle('env:focusMode', (_, state) => {
    if (state) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.maximize();
      new Notification({ title: 'Focus Center', body: 'DND OS rules activated on workspace.' }).show();
    } else {
      win.setAlwaysOnTop(false);
      win.unmaximize();
      new Notification({ title: 'Focus Center', body: 'DND OS rules deactivated.' }).show();
    }
  });

  let prevCpus = os.cpus();
  ipcMain.handle('app:getStats', () => {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const cpus = os.cpus();
    let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
    let pUser = 0, pNice = 0, pSys = 0, pIdle = 0, pIrq = 0;
    for(let i = 0; i < cpus.length; i++) {
        user += cpus[i].times.user; nice += cpus[i].times.nice;
        sys += cpus[i].times.sys; idle += cpus[i].times.idle; irq += cpus[i].times.irq;
        pUser += prevCpus[i].times.user; pNice += prevCpus[i].times.nice;
        pSys += prevCpus[i].times.sys; pIdle += prevCpus[i].times.idle; pIrq += prevCpus[i].times.irq;
    }
    const totalDiff = (user - pUser) + (nice - pNice) + (sys - pSys) + (idle - pIdle) + (irq - pIrq);
    const idleDiff = idle - pIdle;
    const cpuStr = totalDiff === 0 ? '0%' : Math.round(100 * (1 - idleDiff / totalDiff)) + '%';
    prevCpus = cpus;

    return { cpu: cpuStr, ram: (used / 1024 / 1024 / 1024).toFixed(1) + 'GB', ramPct: Math.round(100 * used / total) };
  });

  ipcMain.handle('app:notify', (_, data) => {
    if (appConfig.enableNotifications !== false) {
      new Notification({ title: data.title, body: data.body }).show();
    }
  });

  // Renderer-side diagnostics breadcrumb: lets the UI persist what it was doing
  // (onboarding step reached, a render-boundary catch) into today's main log, so a
  // user's crash report is reproducible from logs/onyx-<date>.log instead of vague.
  // Best-effort and bounded; never trusts the renderer to pick a real log level.
  ipcMain.handle('app:log', (_, data) => {
    try {
      const level = ['info', 'warn', 'error', 'debug'].includes(data && data.level) ? data.level : 'info';
      const message = '[client] ' + String((data && data.message) || '').slice(0, 500);
      logger[level](message, (data && data.meta) || {});
    } catch {}
    return true;
  });

  // Don't auto-download: the user explicitly chooses to download (no silent
  // surprise), then to install. Route updater logs through our logger so a stuck
  // update leaves a trail instead of failing silently.
  autoUpdater.autoDownload = false;
  autoUpdater.logger = logger;
  const sendToWin = (channel, payload) => { try { win && !win.isDestroyed() && win.webContents.send(channel, payload); } catch {} };

  // Check only — returns a structured result; download is a separate, explicit step.
  ipcMain.handle('app:checkForUpdates', async () => {
    if (!app.isPackaged) {
      return { state: 'dev', message: 'Updates are disabled in development builds.' };
    }
    const current = app.getVersion();
    try {
      const result = await autoUpdater.checkForUpdates();
      const latest = result?.updateInfo?.version;
      if (latest && latest !== current) {
        return { state: 'available', version: latest, message: `Update ${latest} available.` };
      }
      return { state: 'latest', version: current, message: `You're on the latest version (${current}).` };
    } catch (err) {
      logger.error('Update check failed:', err);
      const msg = String((err && err.message) || err);
      if (/404|latest\.yml|No published|ENOENT|Unable to find|Cannot find/i.test(msg)) {
        return { state: 'no-feed', message: `No update channel yet — you're on the latest build (${current}).` };
      }
      return { state: 'error', message: "Couldn't reach the update server. Check your connection and try again." };
    }
  });

  // Explicit download (after the user opts in). Errors surface to the UI.
  ipcMain.handle('app:downloadUpdate', async () => {
    if (!app.isPackaged) return { ok: false };
    try { await autoUpdater.downloadUpdate(); return { ok: true }; }
    catch (err) { logger.error('Update download failed:', err); return { ok: false, error: String((err && err.message) || err) }; }
  });

  ipcMain.handle('app:installUpdate', () => {
    if (app.isPackaged) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-available', (info) => sendToWin('app:update-available', info.version));
  autoUpdater.on('update-not-available', () => sendToWin('app:update-none'));
  autoUpdater.on('download-progress', (p) => sendToWin('app:update-progress', Math.round(p.percent || 0)));
  autoUpdater.on('update-downloaded', () => sendToWin('app:update-downloaded'));
  autoUpdater.on('error', (err) => {
    logger.error('Auto-updater error:', err);
    sendToWin('app:update-error', String((err && err.message) || err));
  });

  ipcMain.handle('tray:openMain', () => {
    if (trayWindow) trayWindow.hide();
    showWindow();
    return true;
  });

  // The tray popup measures its own rendered content and asks for an exact fit, so
  // the footer is never clipped and the height tracks tile changes live — no
  // pixel-guessing. Grows/shrinks upward so the bottom edge stays by the tray.
  ipcMain.handle('tray:resize', (_e, height) => {
    if (!trayWindow || trayWindow.isDestroyed()) return;
    const h = Math.max(160, Math.min(720, Math.round(Number(height)) || trayHeight()));
    const b = trayWindow.getBounds();
    if (b.height === h) return;
    const bottom = b.y + b.height;
    trayWindow.setBounds({ x: b.x, y: bottom - h, width: TRAY_W, height: h });
  });

  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
  
  win.once('ready-to-show', () => {
    if (!appConfig.startMinimized) {
      win.show();
    }
  });
}

function showWindow() {
  win.show();
  win.focus();
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    logger.info('Onyx application starting up...');
    setupSecurity();
    appConfig = initAppSettings();
    windowState = initWindowState();
    initPortMapper();
    initCursorAutoHide();
    initBlocker();
    overlayCtl = initOverlay({
      preload: path.join(__dirname, 'preload.js'),
      isDev: process.env.NODE_ENV === 'development',
      indexHtml: path.join(__dirname, '../../ui/dist/index.html'),
    });
    const gitPulse = initGitPulse();
    initDevWatcher();
    initCleaner();
    initSnippets();
    initClipboard();
    initLaunchers();
    initPowerManager();
    initAI();
    initConflicts(() => globalShortcut.isRegistered('CommandOrControl+Alt+D'));
    initPortability();

    createWindow();
    if (appConfig.enableTrayDashboard !== false) {
      createTray();
    }

    // Honour the "Auto-scan Repositories" setting: a quiet bounded scan shortly after launch.
    if (appConfig.autoScanGit && gitPulse && gitPulse.runAutoScan) {
      setTimeout(() => { gitPulse.runAutoScan().catch((err) => logger.error('Auto-scan failed:', err)); }, 5000);
    }
    
    applyGlobalHotkey();

    // Enable Auto Start on Boot
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
      });
      // Check for updates on launch (download is user-initiated; autoDownload=false).
      autoUpdater.checkForUpdates().catch((e) => logger.error('Startup update check failed:', e));
    }
    
    logger.info('Onyx application initialized successfully.');
  });
}

// The system-wide show/hide hotkey is user-configurable (Settings → Shortcuts).
// Default matches what shipped before this became editable. Registration can fail
// if the user's combo is already taken by another app — we log it and fall back to
// the default so the feature never silently dies.
const DEFAULT_GLOBAL_HOTKEY = 'CommandOrControl+Alt+D';
function applyGlobalHotkey() {
  globalShortcut.unregisterAll();
  if (appConfig.enableGlobalHotkey === false) return;
  const toggle = () => { if (win) { if (win.isVisible()) win.hide(); else showWindow(); } };
  const accel = (typeof appConfig.globalHotkey === 'string' && appConfig.globalHotkey.trim()) || DEFAULT_GLOBAL_HOTKEY;
  try {
    if (!globalShortcut.register(accel, toggle)) throw new Error('combo already in use');
  } catch (e) {
    logger.error(`Global hotkey "${accel}" failed to register:`, (e && e.message) || e);
    if (accel !== DEFAULT_GLOBAL_HOTKEY) {
      try { globalShortcut.register(DEFAULT_GLOBAL_HOTKEY, toggle); } catch {}
    }
  }
}

app.on('config:changed', (config) => {
  appConfig = config;

  // Hotkeys — re-applied from the (possibly edited) config.
  applyGlobalHotkey();

  // Tray
  if (config.enableTrayDashboard === false && tray) {
    tray.destroy();
    tray = null;
    if (trayWindow) trayWindow.destroy();
    trayWindow = null;
  } else if (config.enableTrayDashboard !== false && !tray) {
    createTray();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
