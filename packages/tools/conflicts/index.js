// Detects other tools running that could fight Onyx for the same OS resources, so
// the UI can warn instead of silently conflicting. Today: vendor power/system
// managers (which also flip Windows power profiles, clashing with OS Power
// Manager) and whether the global hotkey actually registered.
const { ipcMain } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { parseTasklistImages, matchPowerTools } = require('./match');

const execFileAsync = promisify(execFile);

// One cheap `tasklist` call (no shell → no injection); returns the set of image
// names. Never throws — a missing tasklist (non-Windows) just yields no conflicts.
async function runningImageNames() {
  try {
    const { stdout } = await execFileAsync('tasklist', ['/fo', 'csv', '/nh'], {
      windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024,
    });
    return parseTasklistImages(stdout);
  } catch { return []; }
}

async function scanPowerTools() {
  return matchPowerTools(await runningImageNames());
}

// getHotkeyStatus: a function provided by main that reports whether the global
// shortcut is currently registered (false ⇒ another app grabbed it first).
module.exports = function initConflicts(getHotkeyStatus) {
  // The running-process set barely changes; cache the tasklist scan briefly so
  // re-opening the Power/Settings views doesn't spawn tasklist every time. The
  // hotkey status is cheap, so it's always read fresh.
  let cache = { at: 0, tools: [] };
  const CACHE_MS = 30000;

  ipcMain.handle('app:getConflicts', async () => {
    const now = Date.now();
    if (now - cache.at > CACHE_MS) cache = { at: now, tools: await scanPowerTools() };
    return {
      powerTools: cache.tools,
      hotkeyRegistered: typeof getHotkeyStatus === 'function' ? !!getHotkeyStatus() : true,
    };
  });
};
