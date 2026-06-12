const { ipcMain } = require('electron');
const store = require('./store');

// Registers the renderer-facing AI key-management channels. The key itself never
// crosses the bridge — only its status does. Actual model calls live in the
// feature handlers (e.g. git:generateCommit) and run in the main process.
module.exports = function initAI() {
  ipcMain.handle('ai:getStatus', async () => store.getStatus());
  ipcMain.handle('ai:setKey', async (_event, key) => store.setKey(typeof key === 'string' ? key : ''));
};
