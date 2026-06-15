const { ipcMain, powerMonitor, app, Notification } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { parseBatteryHealth } = require('./battery');

// Windows power-mode overlays — what the Settings "Power mode" slider sets.
// Applied through the powrprof.dll API: unlike `powercfg /overlaysetactive`,
// it works WITHOUT elevation and the result can be read back to verify.
// Overlays never carry brightness, which is what made scheme switching
// change the screen brightness as a side effect (#24).
const OVERLAY_GUIDS = {
  battery_saver: '961cc777-2547-4f9d-8174-7d86181b8a7a', // Best power efficiency
  balanced: '00000000-0000-0000-0000-000000000000', // Balanced
  performance: 'ded574b5-45a0-4f42-8737-46345c09c238', // Best performance
};

// Legacy full power schemes, used only when overlays are unavailable.
// Every scheme persists its own AC/DC brightness, so the legacy path
// preserves the current brightness across the switch.
const SCHEME_GUIDS = {
  battery_saver: 'a1841308-3541-4fab-bc81-f71556f20b4a', // Power saver
  balanced: '381b4222-f694-41f0-9685-ff5bb260df2e', // Balanced
  performance: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', // High performance
};

const PROFILES = Object.keys(OVERLAY_GUIDS);
// Labelled honestly: these are Windows power-mode overlays, NOT Windows Battery
// Saver. "Efficiency" reflects what the GUID actually selects (Best power
// efficiency) — the old "Battery Saver" name implied the OS feature it isn't.
const PROFILE_LABELS = {
  battery_saver: 'Efficiency',
  balanced: 'Balanced',
  performance: 'Max Performance',
};

// Absolute path: don't resolve binaries via PATH.
const SYSTEM32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
const POWERSHELL = path.join(SYSTEM32, 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const POWERCFG = path.join(SYSTEM32, 'powercfg.exe');

// P/Invoke shim for the overlay API (PowerShell 5.1 compatible).
const PWRPROF_TYPE =
  '$t = Add-Type -Namespace OnyxPower -Name Native -PassThru -MemberDefinition ' +
  "'[DllImport(\"powrprof.dll\")] public static extern uint PowerSetActiveOverlayScheme(Guid g);" +
  '[DllImport("powrprof.dll")] public static extern uint PowerGetActualOverlayScheme(out Guid g);\'; ';

// -EncodedCommand (UTF-16LE Base64) sidesteps every Win32 command-line
// quoting layer — the scripts above embed both quote styles.
function runPs(script) {
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 10000 },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout).trim()))
    );
  });
}

function runPowercfg(args) {
  return new Promise((resolve, reject) => {
    execFile(POWERCFG, args, { windowsHide: true, timeout: 10000 }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout))
    );
  });
}

const GUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

// Returns the active overlay GUID, or null when overlays are unsupported.
async function getActualOverlay() {
  try {
    const out = await runPs(
      PWRPROF_TYPE + '$g=[Guid]::Empty; if ($t::PowerGetActualOverlayScheme([ref]$g) -eq 0) { $g.ToString() }'
    );
    const m = out.match(GUID_RE);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// Sets an overlay and verifies it actually applied (the CLI equivalent
// reports success even when it silently does nothing un-elevated).
async function setOverlayProfile(profile) {
  const guid = OVERLAY_GUIDS[profile];
  const out = await runPs(
    PWRPROF_TYPE +
      `$null=$t::PowerSetActiveOverlayScheme([Guid]'${guid}'); ` +
      '$g=[Guid]::Empty; $null=$t::PowerGetActualOverlayScheme([ref]$g); $g.ToString()'
  );
  return out.toLowerCase().includes(guid.toLowerCase());
}

async function getActiveScheme() {
  try {
    const m = (await runPowercfg(['/getactivescheme'])).match(GUID_RE);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

// Laptop panel brightness via WMI; null on desktops/external monitors.
async function readBrightness() {
  try {
    const out = await runPs(
      '(Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop).CurrentBrightness'
    );
    const n = parseInt(out, 10);
    return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
  } catch {
    return null;
  }
}

async function restoreBrightness(level) {
  try {
    await runPs(
      'Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | ' +
        `Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=[uint32]0; Brightness=[byte]${level}}`
    );
  } catch {
    /* best effort */
  }
}

// Overlay support cannot change at runtime; cache only the positive result
// so a transient PS failure doesn't permanently disable the overlay path.
let overlaySupported = null;
async function overlaysAvailable() {
  if (overlaySupported === true) return true;
  if ((await getActualOverlay()) !== null) {
    overlaySupported = true;
    return true;
  }
  return false;
}

// Applies a profile and verifies it took effect. Never persists state for
// switches that did not actually happen.
async function applyProfileNative(profile, preserveBrightness) {
  if (process.platform !== 'win32') {
    return { ok: false, method: 'none', detail: 'Power profiles are only supported on Windows' };
  }
  if (await overlaysAvailable()) {
    try {
      if (await setOverlayProfile(profile)) return { ok: true, method: 'overlay' };
      return { ok: false, method: 'overlay', detail: 'Windows rejected the power-mode change' };
    } catch (e) {
      return { ok: false, method: 'overlay', detail: e.message };
    }
  }
  // Legacy systems: full scheme switch with brightness preservation.
  try {
    const guid = SCHEME_GUIDS[profile];
    const schemes = (await runPowercfg(['/l'])).toLowerCase();
    if (!schemes.includes(guid)) {
      return { ok: false, method: 'scheme', detail: `The "${PROFILE_LABELS[profile]}" power scheme does not exist on this system` };
    }
    const brightness = preserveBrightness ? await readBrightness() : null;
    await runPowercfg(['/setactive', guid]);
    if ((await getActiveScheme()) !== guid) {
      return { ok: false, method: 'scheme', detail: 'The power scheme did not activate' };
    }
    if (brightness !== null) await restoreBrightness(brightness);
    return { ok: true, method: 'scheme' };
  } catch (e) {
    return { ok: false, method: 'scheme', detail: e.message };
  }
}

module.exports = function initPowerManager() {
  const CFG_PATH = path.join(app.getPath('userData'), 'power-manager.json');
  const DEFAULTS = {
    activeProfile: 'balanced',
    aiEnabled: false,
    events: [],
    lastUserProfile: 'balanced',
    autoNotify: true,
    preserveBrightness: true,
  };
  // Single in-memory config: every handler mutates THIS object, so an async
  // PS call in one handler can never clobber another handler's write with a
  // stale read-modify-write copy (the old execSync code was accidentally
  // race-free; with multi-second async calls the races became real).
  let cfg;
  try {
    cfg = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')) };
  } catch {
    cfg = { ...DEFAULTS };
  }
  if (!PROFILES.includes(cfg.activeProfile)) cfg.activeProfile = 'balanced';
  if (!PROFILES.includes(cfg.lastUserProfile)) cfg.lastUserProfile = 'balanced';
  if (!Array.isArray(cfg.events)) cfg.events = [];

  function saveCfg() {
    fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2));
  }

  function addEvent(type, msg) {
    cfg.events.unshift({ time: new Date().toLocaleTimeString(), type, msg });
    if (cfg.events.length > 50) cfg.events = cfg.events.slice(0, 50);
  }

  // Serializes every operation that applies OS state and then mutates cfg,
  // so an in-flight switch and the poll's reconcile can't interleave.
  let opQueue = Promise.resolve();
  function serialize(fn) {
    const run = opQueue.then(fn, fn);
    opQueue = run.catch(() => {});
    return run;
  }

  // Debounced auto-switching: a single shared timer means an AC flap within
  // the window cancels the pending battery switch (and vice versa). The
  // target is RESOLVED when the timer fires (not when the event arrived) and
  // the power source is re-checked then too.
  let autoTimer = null;
  function scheduleAutoSwitch(resolveTarget, reason, delayMs) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => serialize(async () => {
      if (!cfg.aiEnabled) return;
      const targetProfile = resolveTarget();
      if (!PROFILES.includes(targetProfile)) return;
      const onBattery = powerMonitor.isOnBatteryPower();
      const stillValid = targetProfile === 'battery_saver' ? onBattery : !onBattery;
      if (!stillValid || cfg.activeProfile === targetProfile) return;
      const res = await applyProfileNative(targetProfile, cfg.preserveBrightness);
      if (res.ok) {
        cfg.activeProfile = targetProfile;
        addEvent('AI_AGENT', `${reason} → power mode set to ${PROFILE_LABELS[targetProfile]}`);
        if (cfg.autoNotify) {
          new Notification({
            title: 'Onyx Power Planner',
            body: `${reason}: power mode set to ${PROFILE_LABELS[targetProfile]}.`,
          }).show();
        }
      } else {
        addEvent('AI_AGENT', `${reason} → could not switch power mode: ${res.detail}`);
      }
      saveCfg();
    }), delayMs);
  }

  app.whenReady().then(() => {
    powerMonitor.on('on-battery', () => {
      addEvent('OS_EVENT', 'Running on battery');
      saveCfg();
      if (cfg.aiEnabled) scheduleAutoSwitch(() => 'battery_saver', 'On battery', 30000);
    });

    powerMonitor.on('on-ac', () => {
      addEvent('OS_EVENT', 'AC power connected');
      saveCfg();
      // Restore what the user last chose — never force performance (#24).
      if (cfg.aiEnabled) scheduleAutoSwitch(() => cfg.lastUserProfile, 'AC power restored', 10000);
    });
  });

  // Reconcile our saved profile with what Windows actually reports, so
  // changes made in Windows Settings don't desync the UI. Throttled: the
  // view polls every 5s but spawning PowerShell that often would be rude.
  // lastSync is set before the read so concurrent polls can't stampede;
  // the tradeoff is that a failed probe isn't retried for 30s.
  let lastSync = 0;
  function syncActualProfile() {
    if (process.platform !== 'win32' || Date.now() - lastSync < 30000) return Promise.resolve();
    lastSync = Date.now();
    return serialize(async () => {
      const overlay = await getActualOverlay();
      let actual = null;
      if (overlay !== null) {
        actual = PROFILES.find((p) => OVERLAY_GUIDS[p] === overlay) || null;
      } else {
        const scheme = await getActiveScheme();
        actual = PROFILES.find((p) => SCHEME_GUIDS[p] === scheme) || null;
      }
      // Unknown GUIDs (custom schemes, intermediate overlay) leave cfg untouched.
      if (actual && actual !== cfg.activeProfile) {
        cfg.activeProfile = actual;
        addEvent('OS_EVENT', `Power mode changed outside Onyx (now: ${PROFILE_LABELS[actual]})`);
        saveCfg();
      }
    });
  }

  ipcMain.handle('power:get', async () => {
    await syncActualProfile();
    return { ...cfg, batteryState: { charging: !powerMonitor.isOnBatteryPower() } };
  });

  ipcMain.handle('power:setProfile', (_, profile) => {
    if (!PROFILES.includes(profile)) return { ...cfg }; // renderer input is untrusted
    return serialize(async () => {
      const res = await applyProfileNative(profile, cfg.preserveBrightness);
      if (res.ok) {
        cfg.activeProfile = profile;
        cfg.lastUserProfile = profile;
        addEvent('ACTION', `User switched power mode to ${PROFILE_LABELS[profile]}`);
      } else {
        addEvent('ACTION', `Could not switch to ${PROFILE_LABELS[profile]}: ${res.detail}`);
      }
      saveCfg();
      return { ...cfg };
    });
  });

  ipcMain.handle('power:setAI', (_, state) => {
    return serialize(async () => {
      cfg.aiEnabled = !!state;
      addEvent('AI_TOGGLE', `Auto power planner ${state ? 'enabled' : 'disabled'}`);
      if (state) {
        if (powerMonitor.isOnBatteryPower() && cfg.activeProfile !== 'battery_saver') {
          // Conservative: only the efficiency direction applies immediately;
          // enabling on AC keeps the user's current profile (#24 set
          // brightness to MAX by force-switching to performance here).
          const res = await applyProfileNative('battery_saver', cfg.preserveBrightness);
          if (res.ok) {
            cfg.activeProfile = 'battery_saver';
            addEvent('AI_AGENT', 'On battery → power mode set to Battery Saver');
          } else {
            addEvent('AI_AGENT', `Could not switch power mode: ${res.detail}`);
          }
        } else {
          addEvent('AI_AGENT', 'Armed — will manage the power mode on AC/battery changes');
        }
      } else {
        clearTimeout(autoTimer);
      }
      saveCfg();
      return { ...cfg };
    });
  });

  // Read-only battery health + vendor detection (audit #5). Design-vs-full
  // capacity gives real wear %; the manufacturer drives the per-vendor charge-
  // limit guidance. Onyx does NOT write the charge threshold — that needs the
  // vendor's own driver/service and isn't reliable via standard WMI.
  ipcMain.handle('power:getBatteryHealth', async () => {
    if (process.platform !== 'win32') return parseBatteryHealth('');
    try {
      const out = await runPs(
        '$cs = Get-CimInstance Win32_ComputerSystem; ' +
        '$sd = Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1; ' +
        '$fc = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1; ' +
        'ConvertTo-Json -Compress @{ manufacturer = $cs.Manufacturer; model = $cs.Model; design = $sd.DesignedCapacity; full = $fc.FullChargedCapacity }'
      );
      return parseBatteryHealth(out);
    } catch {
      return parseBatteryHealth('');
    }
  });

  ipcMain.handle('power:setConfig', (_, patch) => {
    if (patch && typeof patch === 'object') {
      if (typeof patch.autoNotify === 'boolean') cfg.autoNotify = patch.autoNotify;
      if (typeof patch.preserveBrightness === 'boolean') cfg.preserveBrightness = patch.preserveBrightness;
    }
    saveCfg();
    return { ...cfg };
  });
};
