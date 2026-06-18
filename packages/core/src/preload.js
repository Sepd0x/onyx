const { contextBridge, ipcRenderer } = require('electron');

// NOTE: under `sandbox: true` a preload script cannot `require` local files, so the
// channel allowlists are inlined here rather than imported from ./channels.js.
// channels.test.js asserts these stay in sync with the canonical list in
// packages/core/src/channels.js.
const INVOKE_CHANNELS = [
  'ports:get', 'ports:kill',
  'cursor:getConfig', 'cursor:setConfig', 'cursor:toggle',
  'blocker:get', 'blocker:set', 'blocker:toggle',
  'overlay:get', 'overlay:set', 'overlay:toggle', 'overlay:resize',
  'git:getRepos', 'git:addRepo', 'git:removeRepo', 'git:autoScan', 'git:generateCommit', 'git:addGithubRepo',
  'git:getScanRoots', 'git:addScanRoot', 'git:removeScanRoot', 'git:linkRepo', 'git:unlinkRepo', 'git:aiRepoAction',
  'dev:startWatch', 'dev:stopWatch', 'dev:status', 'dev:getDevProcesses',
  'app:getConfig', 'app:setConfig', 'app:getStats', 'app:notify', 'app:checkForUpdates', 'app:downloadUpdate', 'app:installUpdate', 'app:getConflicts', 'app:log',
  'telemetry:track', 'telemetry:getPreview', 'telemetry:resetId',
  'window:close', 'window:minimize', 'window:openExternal',
  'env:keepAwake', 'env:focusMode',
  'cleaner:scan', 'cleaner:delete',
  'snippets:get', 'snippets:save',
  'clipboard:get', 'clipboard:copy', 'clipboard:togglePin', 'clipboard:delete', 'clipboard:clear', 'clipboard:setPaused',
  'launchers:get', 'launchers:save', 'launchers:start', 'launchers:stop', 'launchers:status',
  'settings:export', 'settings:import',
  'tray:openMain', 'tray:resize',
  'power:get', 'power:setProfile', 'power:setAI', 'power:setConfig', 'power:getBatteryHealth',
  'ai:getStatus', 'ai:setKey', 'ai:setProvider', 'ai:setModel', 'ai:test', 'ai:insights', 'ai:explainPower', 'ai:analyzeLogs', 'ai:briefing', 'ai:stream',
];
const EVENT_CHANNELS = ['refresh-data', 'dev:notification', 'app:update-available', 'app:update-none', 'app:update-progress', 'app:update-downloaded', 'app:update-error', 'git:scanProgress', 'cleaner:scanProgress', 'config:changed', 'ai:streamDelta', 'blocker:blocked'];

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error("Invalid IPC channel " + channel);
  },
  // Returns an unsubscribe fn so renderers can detach listeners (no leak on remount).
  on: (channel, func) => {
    if (!EVENT_CHANNELS.includes(channel)) return () => {};
    const wrapped = (event, ...args) => func(...args);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  }
});
