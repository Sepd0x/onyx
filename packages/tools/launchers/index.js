const { ipcMain, app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn, execFile, execFileSync } = require('child_process');

module.exports = function initLaunchers() {
  const file = path.join(app.getPath('userData'), 'onyx-launchers.json');
  let profiles = [];
  try { profiles = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}

  // profileId -> array of live child processes
  const running = new Map();

  function resolveCwd(p) {
    if (!p || typeof p !== 'string' || !p.trim()) return os.homedir();
    const resolved = path.isAbsolute(p) ? p : path.resolve(os.homedir(), p);
    try { if (fs.statSync(resolved).isDirectory()) return resolved; } catch (e) {}
    return null; // path was specified but does not exist
  }

  // sync=true (used on app quit) blocks until the tree is gone and uses SIGKILL,
  // so detached posix groups can't be orphaned and win32 taskkill finishes before exit.
  function killChild(child, sync) {
    if (!child || child.killed) return;
    try {
      if (process.platform === 'win32') {
        const args = ['/pid', String(child.pid), '/T', '/F'];
        if (sync) execFileSync('taskkill', args, { windowsHide: true });
        else execFile('taskkill', args, { windowsHide: true });
      } else {
        const sig = sync ? 'SIGKILL' : 'SIGTERM';
        try { process.kill(-child.pid, sig); } // detached => negative pid kills the group
        catch (e) { try { child.kill(sig); } catch (e2) {} }
      }
    } catch (e) {}
  }

  function stopProfile(id, sync) {
    const children = running.get(id);
    if (!children) return 0;
    running.delete(id); // delete first so late 'exit' handlers become no-ops
    let n = 0;
    for (const c of children.slice()) { killChild(c, sync); n++; }
    return n;
  }

  ipcMain.handle('launchers:get', () => profiles);

  ipcMain.handle('launchers:save', (_, newProfiles) => {
    profiles = Array.isArray(newProfiles) ? newProfiles : [];
    fs.writeFileSync(file, JSON.stringify(profiles, null, 2));
    return profiles;
  });

  ipcMain.handle('launchers:start', (_, id) => {
    const profile = profiles.find(p => p.id === id);
    if (!profile || !Array.isArray(profile.commands)) return { ok: false, error: 'Profile not found' };
    if (running.has(id)) return { ok: false, error: 'Profile already running' };

    const children = [];
    const errors = [];
    for (const c of profile.commands) {
      if (!c || typeof c.cmd !== 'string' || !c.cmd.trim()) continue;
      const cwd = resolveCwd(c.path);
      if (!cwd) { errors.push(`Path not found for "${c.name || c.cmd}": ${c.path}`); continue; }
      try {
        // The command is authored by the user (e.g. "npm run dev"), so a shell is intended.
        const child = spawn(c.cmd, {
          cwd,
          shell: true,
          windowsHide: true,
          detached: process.platform !== 'win32',
          stdio: 'ignore'
        });
        child.on('error', () => {});
        child.on('exit', () => {
          const arr = running.get(id);
          if (!arr) return;
          const i = arr.indexOf(child);
          if (i >= 0) arr.splice(i, 1);
          if (arr.length === 0) running.delete(id);
        });
        children.push(child);
      } catch (e) {
        errors.push(`Failed to start "${c.name || c.cmd}": ${e.message}`);
      }
    }

    if (children.length === 0) return { ok: false, error: errors[0] || 'No runnable commands in this profile', errors };
    running.set(id, children);
    return { ok: true, started: children.length, errors };
  });

  ipcMain.handle('launchers:stop', (_, id) => {
    return { ok: true, stopped: stopProfile(id) };
  });

  // Lets the UI reflect what is actually running (survives view remounts).
  ipcMain.handle('launchers:status', () => Array.from(running.keys()));

  app.on('will-quit', () => {
    for (const id of Array.from(running.keys())) stopProfile(id, true); // synchronous + forceful
  });
};
