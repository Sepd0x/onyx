// Single source of truth for IPC channel names.
//
// Shared by the preload allowlist (preload.js), the main-process handlers, and
// (by name) the renderer. Every `ipcMain.handle(...)` and every renderer
// `window.api.invoke(...)` MUST use a channel from this list — enforced by
// packages/core/test/channels.test.js so a channel can never exist in one layer
// but be missing from another (the class of bug that broke notifications).

const INVOKE_CHANNELS = [
  // Ports
  'ports:get', 'ports:kill',
  // Cursor / focus
  'cursor:getConfig', 'cursor:setConfig', 'cursor:toggle',
  // Git
  'git:getRepos', 'git:addRepo', 'git:removeRepo', 'git:autoScan', 'git:generateCommit', 'git:addGithubRepo',
  'git:getScanRoots', 'git:addScanRoot', 'git:removeScanRoot',
  // Dev watcher
  'dev:startWatch', 'dev:stopWatch', 'dev:status', 'dev:getDevProcesses',
  // App / settings / updates
  'app:getConfig', 'app:setConfig', 'app:getStats', 'app:notify', 'app:checkForUpdates', 'app:installUpdate',
  // Window
  'window:close', 'window:minimize', 'window:openExternal',
  // Environment
  'env:keepAwake', 'env:focusMode',
  // Cleaner
  'cleaner:scan', 'cleaner:delete',
  // Snippets
  'snippets:get', 'snippets:save',
  // Launchers
  'launchers:get', 'launchers:save', 'launchers:start', 'launchers:stop', 'launchers:status',
  // Tray
  'tray:openMain',
  // Power
  'power:get', 'power:setProfile', 'power:setAI', 'power:setConfig',
  // AI (key management; model calls run in main, key never crosses the bridge)
  'ai:getStatus', 'ai:setKey',
];

// Main -> renderer push events (used with window.api.on).
const EVENT_CHANNELS = ['refresh-data', 'dev:notification', 'app:update-available', 'app:update-downloaded', 'git:scanProgress'];

module.exports = { INVOKE_CHANNELS, EVENT_CHANNELS };
