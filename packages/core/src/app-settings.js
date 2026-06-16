const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function initAppSettings() {
  const file = path.join(app.getPath('userData'), 'onyx-settings.json');
  let config = { launchOnStartup: false, startMinimized: false };
  try { config = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}

  // Ensure login item setting is sync'd
  if (app.setLoginItemSettings) {
    app.setLoginItemSettings({
      openAtLogin: config.launchOnStartup,
      openAsHidden: config.startMinimized
    });
  }

  // appVersion is read-only metadata (not persisted); the UI shows it as the build version.
  ipcMain.handle('app:getConfig', () => ({ ...config, appVersion: app.getVersion() }));
  
  ipcMain.handle('app:setConfig', (_, newConfig) => {
    config = { ...config, ...newConfig };
    fs.writeFileSync(file, JSON.stringify(config));
    
    if (app.setLoginItemSettings) {
      app.setLoginItemSettings({
        openAtLogin: config.launchOnStartup,
        openAsHidden: config.startMinimized
      });
    }
    app.emit('config:changed', config);
    // Push the new config to every renderer (main window + tray window) so theme,
    // accent and feature toggles sync live — the tray reads config once and would
    // otherwise stay stale until the app restarts.
    for (const w of BrowserWindow.getAllWindows()) {
      try { w.webContents.send('config:changed', config); } catch {}
    }
    return config;
  });
  
  return config;
};
