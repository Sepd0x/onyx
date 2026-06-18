import { describe, it, expect } from 'vitest';
import { migrateConfig, DEFAULTS, CURRENT_SCHEMA } from '../src/settings-migrate.js';

describe('settings migration', () => {
  it('a missing / corrupt config becomes the full defaults at the current schema', () => {
    for (const bad of [undefined, null, {}, [], 'nope', 42]) {
      const { config, changed } = migrateConfig(bad);
      expect(config).toEqual(DEFAULTS);
      expect(config.schemaVersion).toBe(CURRENT_SCHEMA);
      expect(changed).toBe(true);
    }
  });

  it('preserves a legacy (unversioned) config and fills the new keys', () => {
    const legacy = { launchOnStartup: true, startMinimized: false, theme: 'dracula' };
    const { config, changed } = migrateConfig(legacy);

    // User-set values survive untouched...
    expect(config.launchOnStartup).toBe(true);
    expect(config.theme).toBe('dracula');
    // ...new keys arrive with their behaviour-preserving defaults...
    expect(config.enableNotifications).toBe(true);
    expect(config.trayShowCpu).toBe(true);
    expect(config.disabledTools).toEqual([]);
    // ...and the file is stamped + flagged for rewrite.
    expect(config.schemaVersion).toBe(CURRENT_SCHEMA);
    expect(changed).toBe(true);
  });

  it('opt-in / privacy keys default OFF — a fresh config never enables them', () => {
    const { config } = migrateConfig({});
    expect(config.telemetryEnabled).toBe(false); // telemetry stays opt-in
    expect(config.onboarded).toBe(false); // onboarding still shows for new users
    expect(config.autoScanGit).toBe(false);
    expect(config.launchOnStartup).toBe(false);
  });

  it('user values always win over defaults (never silently flipped)', () => {
    const opinionated = {
      schemaVersion: CURRENT_SCHEMA,
      telemetryEnabled: true,
      enableNotifications: false,
      enableGlobalHotkey: false,
      trayShowGuards: true,
    };
    const { config } = migrateConfig(opinionated);
    expect(config.telemetryEnabled).toBe(true);
    expect(config.enableNotifications).toBe(false);
    expect(config.enableGlobalHotkey).toBe(false);
    expect(config.trayShowGuards).toBe(true);
  });

  it('an already-current config is left alone (no needless rewrite)', () => {
    const current = { ...DEFAULTS };
    const { config, changed } = migrateConfig(current);
    expect(config).toEqual(DEFAULTS);
    expect(changed).toBe(false);
  });

  it('keeps unknown keys and the higher stamp from a newer version (safe downgrade)', () => {
    const fromNewer = { ...DEFAULTS, schemaVersion: 999, futureFlag: 'keep-me' };
    const { config, changed } = migrateConfig(fromNewer);
    expect(config.futureFlag).toBe('keep-me');
    // Never roll a newer config's version DOWN, and don't rewrite it.
    expect(config.schemaVersion).toBe(999);
    expect(changed).toBe(false);
  });
});
