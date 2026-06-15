const { ipcMain, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const { resolveRoots, safeDeletePath, CLEANABLE_TARGETS, CLEANABLE_NAMES } = require('./containment');

// Shared with Git Pulse so both tools sweep the same common dev locations.
const RAW_SCAN_ROOTS = require('../devroots').defaultDevRoots();

const MAX_DEPTH = 5;        // was 2 — too shallow; nested projects were missed
const MAX_VISITED = 30000;  // hard cap on dirs read per scan
const SCAN_CONCURRENCY = 12; // parallel readdir workers
const SIZE_CONCURRENCY = 6;  // parallel directory-size measurements
// Directories never descended into (besides the cleanable targets themselves).
const SKIP_DESCEND = new Set(['.git', 'appdata', '$recycle.bin', 'windows', 'program files', '.vscode', '.idea']);

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

// Bounded-concurrency map (used for the size pass).
async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; results[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

module.exports = function initCleaner() {
  ipcMain.handle('cleaner:scan', async (event) => {
    const roots = resolveRoots(RAW_SCAN_ROOTS);
    const found = [];   // { path, name, kind }
    const seen = new Set();
    let scanned = 0, active = 0;
    const queue = [];
    for (const r of roots) if (!seen.has(r)) { seen.add(r); queue.push({ dir: r, depth: 0 }); }

    const emit = () => { try { event.sender.send('cleaner:scanProgress', { scanned, found: found.length }); } catch {} };

    async function processDir(dir, depth) {
      let entries;
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (!e.isDirectory() || e.isSymbolicLink()) continue; // never descend junctions
        const lower = e.name.toLowerCase();
        const full = path.join(dir, e.name);
        if (CLEANABLE_NAMES.has(lower)) {
          // A cleanable target: record it and DON'T descend (its size includes children).
          found.push({ path: full, name: e.name, kind: CLEANABLE_TARGETS[lower] });
        } else if (depth < MAX_DEPTH && !SKIP_DESCEND.has(lower) && !seen.has(full)) {
          seen.add(full);
          queue.push({ dir: full, depth: depth + 1 });
        }
      }
      if (scanned % 25 === 0) emit();
    }

    await new Promise((resolve) => {
      const pump = () => {
        if (queue.length === 0 && active === 0) return resolve();
        while (active < SCAN_CONCURRENCY && queue.length && scanned < MAX_VISITED) {
          const { dir, depth } = queue.shift();
          active++; scanned++;
          processDir(dir, depth).catch(() => {}).finally(() => { active--; pump(); });
        }
        if (scanned >= MAX_VISITED && active === 0) resolve();
      };
      pump();
    });

    // Measure real sizes in parallel, then sort biggest-first.
    const sized = await mapPool(found, SIZE_CONCURRENCY, async (f) => ({ ...f, bytes: await dirSizeBytes(f.path) }));
    sized.sort((a, b) => b.bytes - a.bytes);
    emit();

    const totalBytes = sized.reduce((acc, f) => acc + f.bytes, 0);
    const dirs = sized.map((f) => ({ path: f.path, name: f.name, kind: f.kind, size: fmtSize(f.bytes), bytes: f.bytes }));
    return { dirs, totalSize: fmtSize(totalBytes) };
  });

  ipcMain.handle('cleaner:delete', async (_event, paths) => {
    if (!Array.isArray(paths) || paths.length === 0) return { ok: false, deleted: 0, rejected: 0, failed: [] };

    // Validate against resolved roots AND the cleanable-name whitelist, keeping the
    // REALPATHs to delete (closes the junction asymmetry and the TOCTOU re-resolve).
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
      message: `Permanently delete ${safe.length} build/cache folder${safe.length > 1 ? 's' : ''}?`,
      detail: `This cannot be undone. They will be regenerated on the next build/install.\n\n${shown}${more}`,
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
