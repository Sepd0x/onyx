const { exec, execFile } = require('child_process');
const { ipcMain } = require('electron');
const path = require('path');
const { parseNetstat, parseTasklistCsv, parseCimProcesses } = require('./parse');

// Absolute path: don't resolve powershell.exe via PATH (binary-planting hardening).
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
);

module.exports = function initPortMapper() {
  const NO_WIN = process.platform === 'win32' ? { windowsHide: true } : {};

  // Resolve pid → { name, ppid, path, ram } on Windows. Prefer CIM (gives the
  // executable path + parent PID + working set for the "owning process" detail
  // and process tree); fall back to tasklist (name + ram only) if PowerShell
  // is unavailable or returns nothing.
  function getProcMapWin() {
    return new Promise((resolve) => {
      const cmd =
        '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
        'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | ' +
        'Select-Object ProcessId,ParentProcessId,Name,ExecutablePath,WorkingSetSize)';
      execFile(
        POWERSHELL,
        ['-NoProfile', '-NonInteractive', '-Command', cmd],
        { windowsHide: true, timeout: 8000, maxBuffer: 10 * 1024 * 1024 },
        (err, out) => {
          if (!err && out) {
            const m = parseCimProcesses(out);
            if (Object.keys(m).length) return resolve(m);
          }
          exec('tasklist /fo csv /nh', { windowsHide: true, timeout: 6000 }, (e2, out2) =>
            resolve(e2 ? {} : parseTasklistCsv(out2))
          );
        }
      );
    });
  }

  ipcMain.handle('ports:get', () => new Promise((resolve) => {
    exec('netstat -ano', { ...NO_WIN, timeout: 8000 }, async (err, stdout) => {
      if (err) return resolve([]);
      const rows = parseNetstat(stdout);
      if (process.platform === 'win32') {
        const procMap = await getProcMapWin();
        for (const r of rows) {
          const info = procMap[r.pid] || {};
          // PID 4 is the Windows kernel/System; 0 is the idle process.
          r.process = info.name || (r.pid === '4' ? 'System' : r.pid === '0' ? 'System Idle' : 'system');
          r.ram = info.ram || null;
          r.path = info.path || null;
          r.ppid = info.ppid || null;
          r.cpu = '-';
        }
        resolve(rows.sort((a, b) => +a.port - +b.port));
      } else {
        for (const r of rows) { r.process = 'system'; r.ram = null; r.path = null; r.ppid = null; r.cpu = '-'; }
        resolve(rows);
      }
    });
  }));

  ipcMain.handle('ports:kill', (_, pid) => new Promise((resolve) => {
    const pidStr = String(pid);
    if (!/^[0-9]+$/.test(pidStr)) return resolve(false); // reject non-numeric PIDs (no shell, no injection)
    const file = process.platform === 'win32' ? 'taskkill' : 'kill';
    const args = process.platform === 'win32' ? ['/F', '/PID', pidStr] : ['-9', pidStr];
    execFile(file, args, { ...NO_WIN }, (err) => resolve(!err));
  }));
};
