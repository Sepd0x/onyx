const { contextBridge, ipcRenderer } = require('electron');

// NOTE: under `sandbox: true` a preload script cannot `require` local files, so the
// channel allowlists are inlined here rather than imported from ./channels.js.
// channels.test.js asserts these stay in sync with the canonical list in
// packages/core/src/channels.js.
const INVOKE_CHANNELS = [
  'ports:get', 'ports:kill',
  'cursor:getConfig', 'cursor:setConfig', 'cursor:toggle',
  'git:getRepos', 'git:addRepo', 'git:removeRepo', 'git:autoScan', 'git:generateCommit', 'git:addGithubRepo',
  'dev:startWatch', 'dev:stopWatch', 'dev:status', 'dev:getDevProcesses',
  'app:getConfig', 'app:setConfig', 'app:getStats', 'app:notify', 'app:checkForUpdates', 'app:installUpdate',
  'window:close', 'window:minimize', 'window:openExternal',
  'env:keepAwake', 'env:focusMode',
  'cleaner:scan', 'cleaner:delete',
  'snippets:get', 'snippets:save',
  'launchers:get', 'launchers:save', 'launchers:start', 'launchers:stop', 'launchers:status',
  'tray:openMain',
  'power:get', 'power:setProfile', 'power:setAI', 'power:setConfig',
];
const EVENT_CHANNELS = ['refresh-data', 'dev:notification', 'app:update-available', 'app:update-downloaded'];

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => {
    if (INVOKE_CHANNELS.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error("Invalid IPC channel " + channel);
  },
  on: (channel, func) => {
    if (EVENT_CHANNELS.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
