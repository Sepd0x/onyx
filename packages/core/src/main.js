const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, shell, powerSaveBlocker, Notification, globalShortcut } = require('electron');
const path = require('path');
const os = require('os');
const { autoUpdater } = require('electron-updater');

const setupSecurity = require('./security');
const initAppSettings = require('./app-settings');
const initPortMapper = require('../../tools/portmapper/index');
const initCursorAutoHide = require('../../tools/cursor-autohide/index');
const initGitPulse = require('../../tools/gitpulse/index');
const initDevWatcher = require('../../tools/dev-watcher/index');
const initCleaner = require('../../tools/cleaner/index');
const initSnippets = require('../../tools/snippets/index');
const initLaunchers = require('../../tools/launchers/index');
const initPowerManager = require('../../tools/power-manager/index');
const logger = require('./logger');

app.setName('Onyx');
if (process.platform === 'win32') app.setAppUserModelId('com.onyx.app');

let win = null;
let tray = null;
let trayWindow = null;
let appConfig = {};

const iconPath = path.join(__dirname, '../../../assets/icon.svg');

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 280,
    height: 380,
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
    const position = getTrayPosition(trayWindow.getBounds());
    trayWindow.setPosition(position.x, position.y, false);
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
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Onyx');
  
  createTrayWindow();

  tray.on('click', toggleTrayWindow);
  tray.on('right-click', () => {
    tray.popUpContextMenu(Menu.buildFromTemplate([
      { label: 'Open Workspace', click: showWindow },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
    ]));
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 680,
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
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
  } else {
    win.loadFile(path.join(__dirname, '../../ui/dist/index.html'));
  }

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

    return { cpu: cpuStr, ram: (used / 1024 / 1024 / 1024).toFixed(1) + 'GB' };
  });

  ipcMain.handle('app:notify', (_, data) => {
    if (appConfig.enableNotifications !== false) {
      new Notification({ title: data.title, body: data.body }).show();
    }
  });

  ipcMain.handle('app:checkForUpdates', async () => {
    if (app.isPackaged) {
      try {
        const result = await autoUpdater.checkForUpdates();
        return result?.updateInfo?.version || 'Latest';
      } catch (err) {
        logger.error('Update check failed:', err);
        return 'Error checking';
      }
    }
    return 'Dev Mode: No updates';
  });

  ipcMain.handle('app:installUpdate', () => {
    if (app.isPackaged) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('update-available', (info) => {
    win.webContents.send('app:update-available', info.version);
  });

  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('app:update-downloaded');
  });

  ipcMain.handle('tray:openMain', () => {
    if (trayWindow) trayWindow.hide();
    showWindow();
    return true;
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
    initPortMapper();
    initCursorAutoHide();
    initGitPulse();
    initDevWatcher();
    initCleaner();
    initSnippets();
    initLaunchers();
    initPowerManager();
    
    createWindow();
    if (appConfig.enableTrayDashboard !== false) {
      createTray();
    }
    
    if (appConfig.enableGlobalHotkey !== false) {
      globalShortcut.register('CommandOrControl+Alt+D', () => {
        if (win) {
          if (win.isVisible()) win.hide();
          else showWindow();
        }
      });
    }

    // Enable Auto Start on Boot
    if (app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
      });
      // Check for updates
      autoUpdater.checkForUpdatesAndNotify();
    }
    
    logger.info('Onyx application initialized successfully.');
  });
}

app.on('config:changed', (config) => {
  appConfig = config;

  // Hotkeys
  globalShortcut.unregisterAll();
  if (config.enableGlobalHotkey !== false) {
    globalShortcut.register('CommandOrControl+Alt+D', () => {
      if (win) {
        if (win.isVisible()) win.hide();
        else showWindow();
      }
    });
  }

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
