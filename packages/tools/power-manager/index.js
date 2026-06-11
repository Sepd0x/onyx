const { ipcMain, powerMonitor, app, Notification } = require('electron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = function initPowerManager() {
  const CFG_PATH = path.join(app.getPath('userData'), 'power-manager.json');
  function loadCfg() {
    try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')) }
    catch { return { activeProfile: 'balanced', aiEnabled: false, events: [] } }
  }
  function saveCfg(cfg) { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)) }

  function addEvent(cfg, type, msg) {
    cfg.events.unshift({ time: new Date().toLocaleTimeString(), type, msg });
    if (cfg.events.length > 50) cfg.events = cfg.events.slice(0, 50);
  }

  function applyProfile(profile) {
    if (process.platform === 'win32') {
      try {
        if (profile === 'battery_saver') {
          execSync('powercfg -setactive a1841308-3541-4fab-bc81-f71556f20b4a');
        } else if (profile === 'balanced') {
          execSync('powercfg -setactive 381b4222-f694-41f0-9685-ff5bb260df2e');
        } else if (profile === 'performance') {
          execSync('powercfg -setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');
        }
      } catch (e) {
        console.warn('Could not apply power profile:', e.message);
      }
    }
  }

  app.whenReady().then(() => {
    powerMonitor.on('on-ac', () => {
      const cfg = loadCfg();
      addEvent(cfg, 'OS_EVENT', 'AC Power Connected');
      if (cfg.aiEnabled && cfg.activeProfile !== 'performance') {
         cfg.activeProfile = 'performance';
         addEvent(cfg, 'AI_AGENT', 'AI shifted to Performance Mode (AC detected)');
         applyProfile('performance');
         new Notification({ title: 'Onyx Power Planner', body: 'AC Power Connected: Shifted to Max Performance.' }).show();
      }
      saveCfg(cfg);
    });

    powerMonitor.on('on-battery', () => {
      const cfg = loadCfg();
      addEvent(cfg, 'OS_EVENT', 'Running on Battery');
      if (cfg.aiEnabled && cfg.activeProfile !== 'battery_saver') {
         cfg.activeProfile = 'battery_saver';
         addEvent(cfg, 'AI_AGENT', 'AI shifted to Battery Saver (Disconnected from AC)');
         applyProfile('battery_saver');
         new Notification({ title: 'Onyx Power Planner', body: 'Battery Power: Shifted to Battery Saver Mode.' }).show();
      }
      saveCfg(cfg);
    });
  });

  ipcMain.handle('power:get', async () => {
    const cfg = loadCfg();
    const batteryState = {
      charging: !powerMonitor.isOnBatteryPower()
    };
    return { ...cfg, batteryState };
  });

  ipcMain.handle('power:setProfile', async (_, profile) => {
    const cfg = loadCfg();
    cfg.activeProfile = profile;
    addEvent(cfg, 'ACTION', 'User switched profile to: ' + profile);
    applyProfile(profile);
    saveCfg(cfg);
    return cfg;
  });

  ipcMain.handle('power:setAI', async (_, state) => {
    const cfg = loadCfg();
    cfg.aiEnabled = state;
    addEvent(cfg, 'AI_TOGGLE', 'AI Dynamic OS Power Planner ' + (state ? 'ENABLED' : 'DISABLED'));
    
    // Evaluate right away if enabled
    if (state) {
       const isBattery = powerMonitor.isOnBatteryPower();
       const nextProfile = isBattery ? 'battery_saver' : 'performance';
       if (cfg.activeProfile !== nextProfile) {
          cfg.activeProfile = nextProfile;
          addEvent(cfg, 'AI_AGENT', `Initial AI shift to ${nextProfile} (${isBattery ? 'Battery' : 'AC'})`);
          applyProfile(nextProfile);
       }
    }

    saveCfg(cfg);
    return cfg;
  });
};
