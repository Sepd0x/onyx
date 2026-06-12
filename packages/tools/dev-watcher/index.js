const { ipcMain, powerSaveBlocker, Notification } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { parseWinProcessJson, parsePosixPs, extractDevProcesses } = require('./parse');

// Absolute path: don't resolve powershell.exe via PATH (binary-planting hardening).
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
);

module.exports = function initDevWatcher() {
  const activeWatches = new Map();

  const isProcessRunning = (pid) => {
    return new Promise(resolve => {
      const pidStr = String(pid);
      if (!/^[0-9]+$/.test(pidStr)) return resolve(false); // numeric PIDs only — argv array, no shell
      const NO_WIN = process.platform === 'win32' ? { windowsHide: true } : {};
      const file = process.platform === 'win32' ? 'tasklist' : 'ps';
      const args = process.platform === 'win32'
        ? ['/FI', `PID eq ${pidStr}`, '/NH']
        : ['-p', pidStr, '-o', 'pid='];

      execFile(file, args, NO_WIN, (err, stdout) => {
        if (err || !stdout) resolve(false);
        else resolve(stdout.includes(pidStr));
      });
    });
  };

  const generateId = () => Math.random().toString(36).substring(7);

    // dev:heal removed — it was a no-op stub (see AUDIT.md COR-05 / ARCH-07).

  ipcMain.handle('dev:getDevProcesses', () => {
    return new Promise(resolve => {
      const onScan = (parse) => (err, stdout) => {
        if (err || !stdout) {
          // Surface failures: the old wmic path died silently when WMIC was
          // removed in Windows 11 24H2 and the UI just looked empty (#21).
          console.error('[dev-watcher] process scan failed:', err ? err.message : 'empty output');
          return resolve([]);
        }
        const list = parse(stdout);
        if (list === null) {
          console.error('[dev-watcher] process scan output could not be parsed');
          return resolve([]);
        }
        resolve(extractDevProcesses(list));
      };

      if (process.platform === 'win32') {
        // WMIC is removed on Windows 11 24H2+; query CIM via PowerShell 5.1.
        // Get-CimInstance (not Get-Process): CommandLine on Get-Process needs PS7+.
        // -InputObject @(...) keeps single results as a JSON array.
        // The hidden console defaults to the OEM codepage, whose best-fit
        // encoder maps curly quotes to raw 0x22 AFTER JSON escaping — one
        // smart quote in any command line would corrupt the whole document,
        // so force UTF-8 output before emitting JSON.
        const psCmd =
          '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
          'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,Name,CommandLine)';
        execFile(
          POWERSHELL,
          ['-NoProfile', '-NonInteractive', '-Command', psCmd],
          { windowsHide: true, maxBuffer: 1024 * 1024 * 10, timeout: 15000 },
          onScan(parseWinProcessJson)
        );
      } else {
        execFile(
          'ps',
          ['-A', '-o', 'pid,comm,args'],
          { maxBuffer: 1024 * 1024 * 10, timeout: 15000 },
          onScan(parsePosixPs)
        );
      }
    });
  });

  ipcMain.handle('dev:startWatch', async (event, req) => {
    if (req.type !== 'pid') return false;
    const pid = req.target;
    if (!/^[0-9]+$/.test(String(pid))) return false; // reject non-numeric targets

    const blockerId = powerSaveBlocker.start('prevent-display-sleep');
    const id = generateId();
    
    const intervalId = setInterval(async () => {
      const running = await isProcessRunning(pid);
      if (!running) {
        clearInterval(activeWatches.get(id).intervalId);
        powerSaveBlocker.stop(activeWatches.get(id).blockerId);
        activeWatches.delete(id);
        
        new Notification({
          title: 'Onyx Session Guard',
          body: `Task finished! Wake lock released for PID ${pid}.`
        }).show();
      }
    }, 5000);

    activeWatches.set(id, { id, type: 'pid', target: pid, name: req.name, intervalId, blockerId });
    return true;
  });

  ipcMain.handle('dev:stopWatch', (event, id) => {
    if (activeWatches.has(id)) {
      clearInterval(activeWatches.get(id).intervalId);
      powerSaveBlocker.stop(activeWatches.get(id).blockerId);
      activeWatches.delete(id);
    }
  });

  ipcMain.handle('dev:status', () => {
    const res = [];
    for (const val of activeWatches.values()) {
       res.push({ id: val.id, type: val.type, target: val.target, name: val.name });
    }
    return res;
  });
};
