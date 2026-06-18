const { ipcMain, app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { migrateConfig } = require('./settings-migrate');

module.exports = function initAppSettings() {
  const file = path.join(app.getPath('userData'), 'onyx-settings.json');
  // Load whatever is on disk, then bring it up to the current schema (fills any keys a
  // pre-update file is missing, with behaviour-preserving defaults). Persist back only if
  // the migration actually changed something, so we don't rewrite an up-to-date file.
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file, 'utf8')); } catch(e) {}
  const { config: migrated, changed } = migrateConfig(raw);
  let config = migrated;
  if (changed) { try { fs.writeFileSync(file, JSON.stringify(config)); } catch(e) {} }

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
