const { ipcMain, app } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

module.exports = function initCursorAutoHide() {
  const configFile = path.join(app.getPath('userData'), 'cursor-config.json');
  let config = { seconds: 5, deadzone: 4, active: false };
  try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch(e) {}
  
  let psProcess = null;
  const stopFile = path.join(app.getPath('temp'), 'cursor_autohide_stop.tmp');

  const startWorker = () => {
    if (psProcess) return;
    if (fs.existsSync(stopFile)) fs.unlinkSync(stopFile);
    const script = path.join(__dirname, 'backend.ps1');
    psProcess = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden',
      '-File', script,
      '-Seconds', config.seconds.toString(),
      '-DeadZone', config.deadzone.toString(),
      '-StopFile', stopFile
    ], { windowsHide: true });
  };

  const stopWorker = () => {
    if (!psProcess) return;
    fs.writeFileSync(stopFile, 'STOP');
    psProcess = null;
  };

  if (config.active && process.platform === 'win32') {
    startWorker();
  }

  ipcMain.handle('cursor:getConfig', () => config);

  ipcMain.handle('cursor:setConfig', (_, newConfig) => {
    config = { ...config, ...newConfig };
    fs.writeFileSync(configFile, JSON.stringify(config));
    if (config.active) {
      stopWorker();
      setTimeout(startWorker, 200); // restart with new settings
    }
  });

  ipcMain.handle('cursor:toggle', () => {
    config.active = !config.active;
    fs.writeFileSync(configFile, JSON.stringify(config));
    if (config.active) startWorker();
    else stopWorker();
    return config.active;
  });
};
