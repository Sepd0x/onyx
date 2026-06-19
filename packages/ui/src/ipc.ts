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
  // Focus-Mode app blocker
  blockerGet: 'blocker:get',
  blockerSet: 'blocker:set',
  blockerToggle: 'blocker:toggle',
  blockerListRunning: 'blocker:listRunning',
  // Desktop overlay
  overlayGet: 'overlay:get',
  overlaySet: 'overlay:set',
  overlayToggle: 'overlay:toggle',
  overlayResize: 'overlay:resize',
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
  appDownloadUpdate: 'app:downloadUpdate',
  appInstallUpdate: 'app:installUpdate',
  appGetConflicts: 'app:getConflicts',
  appLog: 'app:log',
  // Telemetry (opt-in, anonymous)
  telemetryTrack: 'telemetry:track',
  telemetryGetPreview: 'telemetry:getPreview',
  telemetryResetId: 'telemetry:resetId',
  // Plugins (Fase 2)
  pluginList: 'plugin:list',
  pluginPickBundle: 'plugin:pickBundle',
  pluginInstall: 'plugin:install',
  pluginSetEnabled: 'plugin:setEnabled',
  pluginInvoke: 'plugin:invoke',
  pluginUninstall: 'plugin:uninstall',
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
  // Clipboard history
  clipboardGet: 'clipboard:get',
  clipboardCopy: 'clipboard:copy',
  clipboardTogglePin: 'clipboard:togglePin',
  clipboardDelete: 'clipboard:delete',
  clipboardClear: 'clipboard:clear',
  clipboardSetPaused: 'clipboard:setPaused',
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
  powerGetBatteryHealth: 'power:getBatteryHealth',
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
  appUpdateNone: 'app:update-none',
  appUpdateProgress: 'app:update-progress',
  appUpdateDownloaded: 'app:update-downloaded',
  appUpdateError: 'app:update-error',
  gitScanProgress: 'git:scanProgress',
  cleanerScanProgress: 'cleaner:scanProgress',
  configChanged: 'config:changed',
  aiStreamDelta: 'ai:streamDelta',
  blockerBlocked: 'blocker:blocked',
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
