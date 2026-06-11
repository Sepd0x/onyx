const { ipcMain, app } = require('electron');
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

  ipcMain.handle('app:getConfig', () => config);
  
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
    return config;
  });
  
  return config;
};
