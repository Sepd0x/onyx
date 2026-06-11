const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => {
    const validChannels = [
      'ports:get', 'ports:kill', 
      'cursor:getConfig', 'cursor:setConfig', 'cursor:toggle',
      'git:getRepos', 'git:addRepo', 'git:removeRepo', 'git:autoScan', 'git:generateCommit',
      'dev:startWatch', 'dev:stopWatch', 'dev:status', 'dev:getDevProcesses',
      'app:getConfig', 'app:setConfig', 'app:getStats',
      'window:close', 'window:minimize', 'window:openExternal',
      'env:keepAwake', 'env:focusMode',
      'cleaner:scan', 'cleaner:delete',
      'snippets:get', 'snippets:save',
      'launchers:get', 'launchers:save', 'launchers:start', 'launchers:stop',
      'tray:openMain', 'git:addGithubRepo', 'dev:heal', 'power:get', 'power:setProfile', 'power:setAI',
      'app:checkForUpdates', 'app:installUpdate', 'app:notify'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    throw new Error("Invalid IPC channel " + channel);
  },
  on: (channel, func) => {
    const validChannels = ['refresh-data', 'dev:notification', 'app:update-available', 'app:update-downloaded'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  }
});
