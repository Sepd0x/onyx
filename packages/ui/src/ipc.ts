// Typed renderer-side IPC surface.
//
// Channel names mirror the single source of truth in packages/core/src/channels.js
// (the preload allowlist derives from it). channels.test.js asserts these stay in sync.
// Because window.api is typed with the Channel union below, every
// `window.api.invoke('...')` call is checked by `tsc` — an unknown channel is a
// compile error, which kills the "channel exists in one layer but not another" bug class.

export const CH = {
  // Ports
  portsGet: 'ports:get',
  portsKill: 'ports:kill',
  // Cursor / focus
  cursorGetConfig: 'cursor:getConfig',
  cursorSetConfig: 'cursor:setConfig',
  cursorToggle: 'cursor:toggle',
  // Git
  gitGetRepos: 'git:getRepos',
  gitAddRepo: 'git:addRepo',
  gitRemoveRepo: 'git:removeRepo',
  gitAutoScan: 'git:autoScan',
  gitGenerateCommit: 'git:generateCommit',
  gitAddGithubRepo: 'git:addGithubRepo',
  gitGetScanRoots: 'git:getScanRoots',
  gitAddScanRoot: 'git:addScanRoot',
  gitRemoveScanRoot: 'git:removeScanRoot',
  gitLinkRepo: 'git:linkRepo',
  gitUnlinkRepo: 'git:unlinkRepo',
  gitAiRepoAction: 'git:aiRepoAction',
  // Dev watcher
  devStartWatch: 'dev:startWatch',
  devStopWatch: 'dev:stopWatch',
  devStatus: 'dev:status',
  devGetDevProcesses: 'dev:getDevProcesses',
  // App / settings / updates
  appGetConfig: 'app:getConfig',
  appSetConfig: 'app:setConfig',
  appGetStats: 'app:getStats',
  appNotify: 'app:notify',
  appCheckForUpdates: 'app:checkForUpdates',
  appInstallUpdate: 'app:installUpdate',
  appGetConflicts: 'app:getConflicts',
  // Window
  windowClose: 'window:close',
  windowMinimize: 'window:minimize',
  windowOpenExternal: 'window:openExternal',
  // Environment
  envKeepAwake: 'env:keepAwake',
  envFocusMode: 'env:focusMode',
  // Cleaner
  cleanerScan: 'cleaner:scan',
  cleanerDelete: 'cleaner:delete',
  // Snippets
  snippetsGet: 'snippets:get',
  snippetsSave: 'snippets:save',
  // Launchers
  launchersGet: 'launchers:get',
  launchersSave: 'launchers:save',
  launchersStart: 'launchers:start',
  launchersStop: 'launchers:stop',
  launchersStatus: 'launchers:status',
  // Settings backup / restore
  settingsExport: 'settings:export',
  settingsImport: 'settings:import',
  // Tray
  trayOpenMain: 'tray:openMain',
  trayResize: 'tray:resize',
  // Power
  powerGet: 'power:get',
  powerSetProfile: 'power:setProfile',
  powerSetAI: 'power:setAI',
  powerSetConfig: 'power:setConfig',
  // AI
  aiGetStatus: 'ai:getStatus',
  aiSetKey: 'ai:setKey',
  aiSetProvider: 'ai:setProvider',
  aiSetModel: 'ai:setModel',
  aiTest: 'ai:test',
  aiInsights: 'ai:insights',
  aiExplainPower: 'ai:explainPower',
  aiAnalyzeLogs: 'ai:analyzeLogs',
  aiBriefing: 'ai:briefing',
  aiStream: 'ai:stream',
} as const;

export const EV = {
  refreshData: 'refresh-data',
  devNotification: 'dev:notification',
  appUpdateAvailable: 'app:update-available',
  appUpdateDownloaded: 'app:update-downloaded',
  gitScanProgress: 'git:scanProgress',
  cleanerScanProgress: 'cleaner:scanProgress',
  configChanged: 'config:changed',
  aiStreamDelta: 'ai:streamDelta',
} as const;

export type Channel = typeof CH[keyof typeof CH];
export type EventChannel = typeof EV[keyof typeof EV];

export interface OnyxApi {
  invoke<T = any>(channel: Channel, ...args: any[]): Promise<T>;
  // Returns an unsubscribe function (no-op in the browser mock / for unknown channels).
  on(channel: EventChannel, listener: (...args: any[]) => void): () => void;
}

declare global {
  interface Window {
    api?: OnyxApi;
  }
}
