const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const { buildBackup, parseBackup } = require('./parse');

// Export / import the portable, non-secret settings (config + snippets + launchers).
// The renderer gathers the current state via the existing get channels and applies
// an import via the existing save channels, so in-memory tool state never goes
// stale and no API key / token is ever read or written here.
module.exports = function initPortability() {
  const ownerWindow = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;

  ipcMain.handle('settings:export', async (event, bundle, exportedAt) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog(ownerWindow(), {
        title: 'Export Onyx settings',
        defaultPath: 'onyx-settings-backup.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePath) return { canceled: true };
      fs.writeFileSync(filePath, JSON.stringify(buildBackup(bundle, exportedAt), null, 2));
      return { ok: true, path: filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('settings:import', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(ownerWindow(), {
        title: 'Import Onyx settings',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (canceled || !filePaths.length) return { canceled: true };
      return parseBackup(fs.readFileSync(filePaths[0], 'utf8'));
    } catch (e) {
      return { error: e.message };
    }
  });
};
