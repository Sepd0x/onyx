const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { resolveRoots, safeDeletePath } = require('./containment');

const RAW_SCAN_ROOTS = [
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Projects'),
  path.join(os.homedir(), 'dev'),
];

// Real recursive size of a directory in bytes. Async (yields to the event loop so the
// main process stays responsive) and iterative to avoid deep recursion; skips symlinks
// so junctions can't cause cycles or double-counting.
async function dirSizeBytes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = await fs.promises.readdir(d, { withFileTypes: true }); } catch { continue; }
    const files = [];
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else files.push(full);
    }
    const sizes = await Promise.all(files.map((f) => fs.promises.stat(f).then((s) => s.size).catch(() => 0)));
    for (const s of sizes) total += s;
  }
  return total;
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  return Math.max(0, Math.round(bytes / 1024 / 1024)) + ' MB';
}

module.exports = function initCleaner() {
  ipcMain.handle('cleaner:scan', async () => {
    const found = [];
    const roots = resolveRoots(RAW_SCAN_ROOTS);

    const scanDir = async (dirStr, depth) => {
      if (depth > 2) return;
      let items;
      try { items = await fs.promises.readdir(dirStr, { withFileTypes: true }); } catch { return; }
      for (const item of items) {
        if (!item.isDirectory() || item.isSymbolicLink()) continue; // don't descend junctions
        if (item.name === 'node_modules') {
          const full = path.join(dirStr, item.name);
          found.push({ path: full, name: 'node_modules', bytes: await dirSizeBytes(full) });
        } else if (item.name !== '.git' && item.name !== '.vscode' && item.name !== 'AppData') {
          await scanDir(path.join(dirStr, item.name), depth + 1);
        }
      }
    };

    for (const p of roots) await scanDir(p, 0);

    const totalBytes = found.reduce((acc, f) => acc + f.bytes, 0);
    const dirs = found.map((f) => ({ path: f.path, name: f.name, size: fmtSize(f.bytes) }));
    return { dirs, totalSize: fmtSize(totalBytes) };
  });

  ipcMain.handle('cleaner:delete', async (_event, paths) => {
    if (!Array.isArray(paths) || paths.length === 0) return { ok: false, deleted: 0, rejected: 0, failed: [] };

    // Validate against resolved roots and keep the REALPATHs to delete (closes the
    // junction asymmetry and the TOCTOU re-resolve).
    const roots = resolveRoots(RAW_SCAN_ROOTS);
    const safe = [];
    for (const p of paths) {
      const resolved = safeDeletePath(p, roots);
      if (resolved && !safe.includes(resolved)) safe.push(resolved);
    }
    const rejected = paths.length - safe.length;
    if (safe.length === 0) return { ok: false, deleted: 0, rejected, failed: [] };

    // Require explicit confirmation in the main process — the renderer cannot bypass it.
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
    const shown = safe.slice(0, 10).map((p) => '• ' + p).join('\n');
    const more = safe.length > 10 ? `\n…and ${safe.length - 10} more` : '';
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Delete'],
      defaultId: 0,
      cancelId: 0,
      title: 'Confirm deletion',
      message: `Permanently delete ${safe.length} node_modules folder${safe.length > 1 ? 's' : ''}?`,
      detail: `This cannot be undone.\n\n${shown}${more}`,
    });
    if (response !== 1) return { ok: false, deleted: 0, rejected, cancelled: true, failed: [] };

    let deleted = 0;
    const failed = [];
    for (const p of safe) {
      try {
        await fs.promises.rm(p, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
        deleted++;
      } catch (e) {
        failed.push({ path: p, error: e && e.message ? e.message : String(e) });
      }
    }
    return { ok: failed.length === 0, deleted, rejected, failed };
  });
};
