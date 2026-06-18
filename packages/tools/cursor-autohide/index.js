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
    // The .ps1 is asarUnpack'd (see electron-builder config); powershell.exe -File
    // cannot read inside app.asar, so resolve to the unpacked path. No-op in dev.
    const script = path.join(__dirname, 'backend.ps1').replace('app.asar', 'app.asar.unpacked');
    const seconds = Math.max(1, parseInt(config.seconds, 10) || 5);
    const deadzone = Math.max(0, parseInt(config.deadzone, 10) || 4);
    psProcess = spawn('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-WindowStyle', 'Hidden',
      '-File', script,
      '-Seconds', String(seconds),
      '-DeadZone', String(deadzone),
      '-StopFile', stopFile,
      // The worker watches this PID; if Onyx dies without a graceful stop, it restores
      // the system cursor on its own rather than leaving it hidden until reboot.
      '-ParentPid', String(process.pid)
    ], { windowsHide: true });
    psProcess.on('error', () => { psProcess = null; });
    psProcess.on('exit', () => { psProcess = null; });
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

  // Graceful stop on app exit — signals the worker to restore the cursor before we go.
  // (The worker's parent-PID watchdog is the backstop for a crash that skips this.)
  app.on('will-quit', () => { try { stopWorker(); } catch {} });
};
