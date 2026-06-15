const { app, ipcMain, powerSaveBlocker, Notification } = require('electron');
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

  // Resolves a PID's image name (e.g. "node.exe") once at watch start, so the
  // guard can recognise the same task after it re-spawns under a new PID.
  const getProcessName = (pid) => {
    return new Promise(resolve => {
      const pidStr = String(pid);
      if (!/^[0-9]+$/.test(pidStr)) return resolve(null);
      if (process.platform === 'win32') {
        execFile('tasklist', ['/FI', `PID eq ${pidStr}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
          const m = !err && stdout && String(stdout).match(/^"([^"]+)"/);
          resolve(m ? m[1] : null);
        });
      } else {
        execFile('ps', ['-p', pidStr, '-o', 'comm='], (err, stdout) => {
          if (err || !stdout) return resolve(null);
          resolve(String(stdout).trim().split('/').pop() || null);
        });
      }
    });
  };

  // Live PIDs (as strings) for a given image name. Name is validated to a plain
  // image name so it's safe to pass as an argv filter (no shell).
  const findPidsByName = (name) => {
    return new Promise(resolve => {
      if (!name) return resolve([]);
      if (process.platform === 'win32') {
        if (!/^[\w .-]+\.exe$/i.test(name)) return resolve([]);
        execFile('tasklist', ['/FI', `IMAGENAME eq ${name}`, '/FO', 'CSV', '/NH'], { windowsHide: true }, (err, stdout) => {
          if (err || !stdout) return resolve([]);
          const pids = [];
          for (const line of String(stdout).split(/\r?\n/)) {
            const m = line.match(/^"[^"]+","(\d+)"/); // image name, then PID
            if (m) pids.push(m[1]);
          }
          resolve(pids);
        });
      } else {
        if (!/^[\w.-]+$/.test(name)) return resolve([]);
        execFile('pgrep', ['-x', name], (err, stdout) => {
          if (err || !stdout) return resolve([]);
          resolve(String(stdout).split(/\s+/).filter(s => /^\d+$/.test(s)));
        });
      }
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
        // Exclude Onyx's own Electron processes (main/renderer/gpu) so the app
        // never offers to guard or kill itself (#A2).
        let ownPids = [];
        try { ownPids = app.getAppMetrics().map((m) => m.pid); } catch {}
        resolve(extractDevProcesses(list, ownPids));
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
    const pid = String(req.target);
    if (!/^[0-9]+$/.test(pid)) return false; // reject non-numeric targets

    // Resolve the image name + the same-name PIDs that already exist, so a
    // later re-spawn (the guarded PID dies and a NEW same-name PID appears) is
    // recognised and the lock follows it instead of being released silently —
    // the failure the old PID-only watch had with dev tools (audit B2).
    const procName = await getProcessName(pid);
    const knownPids = new Set(procName ? await findPidsByName(procName) : []);

    const blockerId = powerSaveBlocker.start('prevent-display-sleep');
    const id = generateId();

    const intervalId = setInterval(async () => {
      const w = activeWatches.get(id);
      if (!w) return;
      if (await isProcessRunning(w.target)) return; // exact PID still alive

      // The watched PID is gone. If a genuinely new process of the same name
      // exists, the task re-spawned — adopt it and keep holding the lock.
      if (procName) {
        const livePids = await findPidsByName(procName);
        const fresh = livePids.find(p => !knownPids.has(p));
        if (fresh) {
          knownPids.add(fresh);
          w.target = fresh;
          w.respawns = (w.respawns || 0) + 1;
          return;
        }
      }

      // Genuinely finished — release the lock and notify.
      clearInterval(w.intervalId);
      powerSaveBlocker.stop(w.blockerId);
      activeWatches.delete(id);
      new Notification({
        title: 'Onyx Session Guard',
        body: `${w.name || `PID ${w.target}`} finished — wake lock released.`
      }).show();
    }, 5000);

    activeWatches.set(id, { id, type: 'pid', target: pid, name: req.name, procName, respawns: 0, intervalId, blockerId });
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
       res.push({ id: val.id, type: val.type, target: val.target, name: val.name, procName: val.procName, respawns: val.respawns || 0 });
    }
    return res;
  });
};
