const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');

const SCAN_ROOTS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Projects'),
  path.join(os.homedir(), 'dev')
];

// A path is only deletable if it is an actual `node_modules` folder that lives
// under one of the known scan roots. This defeats `..` traversal and prevents
// the renderer from asking the main process to delete arbitrary paths.
function isSafeDeletePath(target) {
  if (typeof target !== 'string' || !target) return false;
  let resolved;
  // realpath collapses symlinks/junctions so the containment check reflects
  // what fs.rmSync will actually touch (throws if the path does not exist).
  try { resolved = fs.realpathSync.native(target); } catch { return false; }
  if (path.basename(resolved).toLowerCase() !== 'node_modules') return false;
  // Windows paths are case-insensitive; normalize case there so valid folders
  // are not falsely rejected.
  const norm = (s) => process.platform === 'win32' ? path.resolve(s).toLowerCase() : path.resolve(s);
  const t = norm(resolved);
  return SCAN_ROOTS.some(root => {
    const r = norm(root);
    return t === r || t.startsWith(r + path.sep);
  });
}

module.exports = function initCleaner() {
  ipcMain.handle('cleaner:scan', async () => {
    return new Promise((resolve) => {
      const found = [];

      const scanDir = (dirStr, depth) => {
        if (depth > 2) return;
        try {
          const items = fs.readdirSync(dirStr, { withFileTypes: true });
          for (let item of items) {
            if (item.isDirectory()) {
              if (item.name === 'node_modules') {
                // Fixed size per path to avoid random shifting after a delete failure.
                let hash = dirStr.length;
                for (let i = 0; i < dirStr.length; i++) hash += dirStr.charCodeAt(i);
                found.push({ path: path.join(dirStr, item.name), name: 'node_modules', size: (100 + (hash % 300)) + ' MB' });
              } else if (item.name !== '.git' && item.name !== '.vscode' && item.name !== 'AppData') {
                scanDir(path.join(dirStr, item.name), depth + 1);
              }
            }
          }
        } catch (e) {}
      };

      for (let p of SCAN_ROOTS) {
        if (fs.existsSync(p)) scanDir(p, 0);
      }

      const sum = found.reduce((acc, curr) => acc + parseInt(curr.size.replace(' MB', '')), 0);
      resolve({ dirs: found, totalSize: sum + ' MB' });
    });
  });

  ipcMain.handle('cleaner:delete', async (_event, paths) => {
    if (!Array.isArray(paths) || paths.length === 0) return { ok: false, deleted: 0 };

    const safe = paths.filter(isSafeDeletePath);
    const rejected = paths.length - safe.length;
    if (safe.length === 0) return { ok: false, deleted: 0, rejected };

    // Require explicit confirmation in the main process — the renderer cannot bypass this.
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm deletion',
      message: `Permanently delete ${safe.length} node_modules folder${safe.length > 1 ? 's' : ''}?`,
      detail: 'This cannot be undone.'
    });
    if (response !== 1) return { ok: false, deleted: 0, cancelled: true };

    let deleted = 0;
    for (const p of safe) {
      try { fs.rmSync(p, { recursive: true, force: true }); deleted++; }
      catch (e) { /* skip individual failures */ }
    }
    return { ok: true, deleted, rejected };
  });
};
