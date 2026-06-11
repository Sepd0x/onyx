const { contextBridge, ipcRenderer } = require('electron');
const { INVOKE_CHANNELS, EVENT_CHANNELS } = require('./channels');

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
