// Versioned migration for onyx-settings.json — pure, Electron-free, unit-testable.
//
// Why this exists: across app updates the persisted config can drift — a new version adds
// keys an old file doesn't have, or (eventually) renames/removes one. Without a migration
// step an old config either misses new keys (falling back to scattered inline defaults) or,
// worse, a future rename silently drops a user's setting. This module is the one place that
// brings any stored config up to the current shape on load.
//
// DESIGN INVARIANT — behaviour preserving: every default below is set to the value the app
// ALREADY assumes when the key is absent (verified against the `=== false` / `?? true` /
// `if (x)` reads across main.js, app-settings.js and the Settings UI). So filling defaults
// can never flip an existing user's toggle: a key only ever appears with the same effect
// that "missing" had. User-set values always win over defaults.

const CURRENT_SCHEMA = 1;

const DEFAULTS = {
  schemaVersion: CURRENT_SCHEMA,

  // Startup (all default OFF — bare-truthy reads)
  launchOnStartup: false,
  startMinimized: false,
  onboarded: false, // absent ⇒ onboarding shows; keep false so that holds

  // Features (default ON — read as `!== false` / `?? true`)
  enableGlobalHotkey: true,
  globalHotkey: 'CommandOrControl+Alt+D',
  enableNotifications: true,
  enableAnimations: true,
  enableAIFeatures: true,
  enableTrayDashboard: true,

  // Tray tiles (CPU/RAM/ports default ON, guards default OFF)
  trayShowCpu: true,
  trayShowRam: true,
  trayShowPorts: true,
  trayShowGuards: false,

  // Behaviour (default OFF — gated by `if (x)`)
  autoScanGit: false,
  autoHideCursorOnStart: false,

  // Privacy — opt-in. MUST default off (read as `=== true`).
  telemetryEnabled: false,

  // Appearance
  theme: 'midnight',
  accent: 'purple',

  // Modularity — list of tool ids the user hid (#28). [] = nothing disabled.
  disabledTools: [],
};

// Ordered migrations. Entry i takes a config at schema version i to version i+1. NEVER edit
// an existing entry once shipped — only append a new one and bump CURRENT_SCHEMA. A throw in
// here is swallowed by migrateConfig so a buggy migration can never wipe a user's settings.
const MIGRATIONS = [
  // v0 (legacy, unversioned) -> v1: first versioned schema. No renames yet — defaults are
  // merged separately — so this is just the version boundary and a home for future v0 fixups.
  (c) => c,
];

// Bring a raw, parsed config object up to the current schema. Returns { config, changed };
// `changed` is true when the on-disk file should be rewritten (a default was filled or the
// schema version advanced), so callers don't churn the disk on an already-current config.
function migrateConfig(raw) {
  const parsed = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const from = Number.isInteger(parsed.schemaVersion) ? parsed.schemaVersion : 0;

  let cfg = { ...parsed };
  for (let v = Math.max(0, from); v < CURRENT_SCHEMA; v++) {
    try {
      if (typeof MIGRATIONS[v] === 'function') cfg = MIGRATIONS[v](cfg) || cfg;
    } catch {
      // A failed migration must never destroy the user's config — keep what we have.
    }
  }

  // Fill only the keys the file is missing, then stamp the schema. We never roll the stored
  // version DOWN: a config written by a newer Onyx (from > current, i.e. a downgrade) keeps
  // its higher stamp and its unknown keys, so the newer app won't wrongly re-migrate it.
  const target = Math.max(CURRENT_SCHEMA, from);
  const config = { ...DEFAULTS, ...cfg, schemaVersion: target };

  // Rewrite the file only if we actually advanced the version or filled a missing key —
  // an already-current (or newer) config is left exactly as it was on disk.
  const advanced = from < CURRENT_SCHEMA;
  const filledMissing = Object.keys(DEFAULTS).some((k) => !(k in parsed));
  const changed = advanced || filledMissing;
  return { config, changed };
}

module.exports = { migrateConfig, DEFAULTS, CURRENT_SCHEMA, MIGRATIONS };
