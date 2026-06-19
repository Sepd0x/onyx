const { app, ipcMain, BrowserWindow, Notification } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { sanitizeBlocklist, pidsToKill, normalizeAppName, CRITICAL_DENYLIST } = require('./match');

// Absolute path: don't resolve powershell.exe via PATH (binary-planting hardening).
const POWERSHELL = path.join(
  process.env.SystemRoot || 'C:\\Windows',
  'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'
);
const POLL_MS = 4000;

// Focus-Mode app blocker. While enabled, periodically closes any running process
// whose image name the user explicitly added to their blocklist (e.g. Discord,
// Steam). SAFETY: a hardcoded denylist (match.js) plus Onyx's own PIDs are never
// touched, so a typo can't take down the desktop. Off by default; opt-in only.
module.exports = function initBlocker() {
  const file = path.join(app.getPath('userData'), 'blocker-config.json');
  let config = { enabled: false, apps: [], notify: true };
  try { config = { ...config, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  config.apps = sanitizeBlocklist(config.apps);

  let timer = null;
  let blockedCount = 0;
  let scanning = false;

  const save = () => {
    try { fs.writeFileSync(file, JSON.stringify({ enabled: config.enabled, apps: config.apps, notify: config.notify })); } catch {}
  };

  const broadcast = (channel, payload) => {
    for (const w of BrowserWindow.getAllWindows()) { try { w.webContents.send(channel, payload); } catch {} }
  };

  const listProcesses = () => new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    // CIM via PowerShell 5.1 (WMIC is gone on Win11 24H2+). Force UTF-8 so an odd
    // codepage can't corrupt the JSON. Mirrors the dev-watcher enumeration.
    const psCmd =
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
      'ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | Select-Object ProcessId,Name)';
    execFile(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', psCmd], { windowsHide: true, maxBuffer: 1024 * 1024 * 10, timeout: 12000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      try {
        const arr = JSON.parse(stdout);
        resolve((Array.isArray(arr) ? arr : [arr]).map((p) => ({ pid: p.ProcessId, name: p.Name })));
      } catch { resolve([]); }
    });
  });

  // User-facing apps currently running — those with a visible main window (Discord,
  // Steam, a browser…), so the UI can offer a pick-list instead of asking the user to
  // know the exact image name. System/background processes and the critical denylist are
  // filtered out; de-duped by normalised image name.
  const listRunningApps = () => new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve([]);
    const psCmd =
      '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' +
      'ConvertTo-Json -Compress -InputObject @(Get-Process | Where-Object { $_.MainWindowTitle } | Select-Object Name, MainWindowTitle)';
    execFile(POWERSHELL, ['-NoProfile', '-NonInteractive', '-Command', psCmd], { windowsHide: true, maxBuffer: 1024 * 1024 * 5, timeout: 10000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      let arr;
      try { arr = JSON.parse(stdout); } catch { return resolve([]); }
      const seen = new Set();
      const out = [];
      for (const p of (Array.isArray(arr) ? arr : [arr])) {
        const name = normalizeAppName(p && p.Name); // lower-case + `.exe`, matches the blocklist form
        if (!name || CRITICAL_DENYLIST.includes(name) || seen.has(name)) continue;
        seen.add(name);
        out.push({ name, title: String((p && p.MainWindowTitle) || '').slice(0, 80) });
      }
      out.sort((a, b) => a.name.localeCompare(b.name));
      resolve(out);
    });
  });

  const killPid = (pid) => new Promise((resolve) => {
    if (!/^[0-9]+$/.test(String(pid))) return resolve(false); // numeric PID, argv array, no shell
    execFile('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true }, (err) => resolve(!err));
  });

  const sweep = async () => {
    if (scanning || !config.enabled || !config.apps.length) return;
    scanning = true;
    try {
      const procs = await listProcesses();
      let ownPids = [];
      try { ownPids = app.getAppMetrics().map((m) => m.pid); } catch {}
      const targets = pidsToKill(procs, config.apps, ownPids);
      for (const pid of targets) {
        const proc = procs.find((p) => String(p.pid) === pid);
        const name = proc ? proc.name : `PID ${pid}`;
        if (await killPid(pid)) {
          blockedCount += 1;
          broadcast('blocker:blocked', { name, count: blockedCount });
          if (config.notify !== false) {
            try { new Notification({ title: 'Focus Mode', body: `${name} was closed to keep you focused.` }).show(); } catch {}
          }
        }
      }
    } finally {
      scanning = false;
    }
  };

  const start = () => {
    if (timer) return;
    sweep();
    timer = setInterval(sweep, POLL_MS);
    if (timer.unref) timer.unref(); // don't keep the event loop alive for the poll
  };
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };

  if (config.enabled && process.platform === 'win32') start();

  const state = () => ({ enabled: config.enabled, apps: config.apps, blockedCount });

  ipcMain.handle('blocker:get', () => state());
  ipcMain.handle('blocker:listRunning', () => listRunningApps());
  ipcMain.handle('blocker:set', (_, data) => {
    if (data && Array.isArray(data.apps)) config.apps = sanitizeBlocklist(data.apps);
    if (data && typeof data.notify === 'boolean') config.notify = data.notify;
    save();
    return state();
  });
  ipcMain.handle('blocker:toggle', (_, on) => {
    config.enabled = typeof on === 'boolean' ? on : !config.enabled;
    if (config.enabled) blockedCount = 0; // count is per active session
    save();
    if (config.enabled && process.platform === 'win32') start(); else stop();
    return state();
  });

  return { stop };
};
