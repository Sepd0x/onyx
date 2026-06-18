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
  // Focus-Mode app blocker (closes user-listed distraction apps while active)
  'blocker:get', 'blocker:set', 'blocker:toggle',
  // Desktop overlay (always-on-top widget)
  'overlay:get', 'overlay:set', 'overlay:toggle', 'overlay:resize',
  // Git
  'git:getRepos', 'git:addRepo', 'git:removeRepo', 'git:autoScan', 'git:generateCommit', 'git:addGithubRepo',
  'git:getScanRoots', 'git:addScanRoot', 'git:removeScanRoot', 'git:linkRepo', 'git:unlinkRepo', 'git:aiRepoAction',
  // Dev watcher
  'dev:startWatch', 'dev:stopWatch', 'dev:status', 'dev:getDevProcesses',
  // App / settings / updates
  'app:getConfig', 'app:setConfig', 'app:getStats', 'app:notify', 'app:checkForUpdates', 'app:downloadUpdate', 'app:installUpdate', 'app:getConflicts', 'app:log',
  // Telemetry (opt-in, anonymous, off by default)
  'telemetry:track', 'telemetry:getPreview', 'telemetry:resetId',
  // Window
  'window:close', 'window:minimize', 'window:openExternal',
  // Environment
  'env:keepAwake', 'env:focusMode',
  // Cleaner
  'cleaner:scan', 'cleaner:delete',
  // Snippets
  'snippets:get', 'snippets:save',
  // Clipboard history (in-memory in main; never persisted)
  'clipboard:get', 'clipboard:copy', 'clipboard:togglePin', 'clipboard:delete', 'clipboard:clear', 'clipboard:setPaused',
  // Launchers
  'launchers:get', 'launchers:save', 'launchers:start', 'launchers:stop', 'launchers:status',
  // Settings backup / restore (config + snippets + launchers; never secrets)
  'settings:export', 'settings:import',
  // Tray
  'tray:openMain', 'tray:resize',
  // Power
  'power:get', 'power:setProfile', 'power:setAI', 'power:setConfig', 'power:getBatteryHealth',
  // AI (key management; model calls run in main, key never crosses the bridge)
  'ai:getStatus', 'ai:setKey', 'ai:setProvider', 'ai:setModel', 'ai:test', 'ai:insights', 'ai:explainPower', 'ai:analyzeLogs', 'ai:briefing', 'ai:stream',
];

// Main -> renderer push events (used with window.api.on).
const EVENT_CHANNELS = ['refresh-data', 'dev:notification', 'app:update-available', 'app:update-none', 'app:update-progress', 'app:update-downloaded', 'app:update-error', 'git:scanProgress', 'cleaner:scanProgress', 'config:changed', 'ai:streamDelta', 'blocker:blocked'];

module.exports = { INVOKE_CHANNELS, EVENT_CHANNELS };
