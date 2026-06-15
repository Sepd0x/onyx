import { describe, it, expect } from 'vitest';
import { normalizeVendor, vendorApp, canControlChargeLimit, computeWearPct, parseBatteryHealth } from './battery.js';

describe('normalizeVendor', () => {
  it('maps known manufacturer strings', () => {
    expect(normalizeVendor('LENOVO')).toBe('lenovo');
    expect(normalizeVendor('Dell Inc.')).toBe('dell');
    expect(normalizeVendor('ASUSTeK COMPUTER INC.')).toBe('asus');
    expect(normalizeVendor('Hewlett-Packard')).toBe('hp');
    expect(normalizeVendor('HP')).toBe('hp');
    expect(normalizeVendor('Microsoft Corporation')).toBe('surface');
  });
  it('returns unknown for unrecognised/empty input', () => {
    expect(normalizeVendor('Some Whitebox')).toBe('unknown');
    expect(normalizeVendor('')).toBe('unknown');
    expect(normalizeVendor(undefined)).toBe('unknown');
  });
});

describe('canControlChargeLimit / vendorApp', () => {
  it('drives no vendor itself yet; each points to its vendor app instead', () => {
    expect(canControlChargeLimit('lenovo')).toBe(false);
    expect(canControlChargeLimit('dell')).toBe(false);
    expect(canControlChargeLimit('unknown')).toBe(false);
    expect(vendorApp('lenovo')).toBe('Lenovo Vantage');
    expect(vendorApp('dell')).toBe('Dell Power Manager');
    expect(vendorApp('unknown')).toBeNull();
  });
});

describe('computeWearPct', () => {
  it('computes wear from design vs full capacity', () => {
    expect(computeWearPct(50000, 50000)).toBe(0);
    expect(computeWearPct(50000, 40000)).toBe(20);
    expect(computeWearPct(50000, 45500)).toBe(9);
  });
  it('clamps and rejects bad input', () => {
    expect(computeWearPct(50000, 60000)).toBe(0); // full > design → clamp to 0
    expect(computeWearPct(0, 100)).toBeNull();
    expect(computeWearPct('x', 'y')).toBeNull();
    expect(computeWearPct(undefined, undefined)).toBeNull();
  });
});

describe('parseBatteryHealth', () => {
  it('builds a full payload for a Lenovo with a worn battery', () => {
    const out = parseBatteryHealth(JSON.stringify({ manufacturer: 'LENOVO', model: 'ThinkPad X1', design: 57000, full: 49000 }));
    expect(out).toMatchObject({
      manufacturer: 'LENOVO', model: 'ThinkPad X1', vendor: 'lenovo',
      vendorApp: 'Lenovo Vantage', canControlChargeLimit: false,
      designCapacity: 57000, fullCapacity: 49000, wearPct: 14, healthPct: 86, hasBattery: true,
    });
  });
  it('flags a desktop / no-battery machine and a non-controllable vendor', () => {
    const out = parseBatteryHealth(JSON.stringify({ manufacturer: 'Dell Inc.', model: 'OptiPlex', design: 0, full: 0 }));
    expect(out.vendor).toBe('dell');
    expect(out.canControlChargeLimit).toBe(false);
    expect(out.hasBattery).toBe(false);
    expect(out.wearPct).toBeNull();
  });
  it('is safe on empty / bad JSON', () => {
    expect(parseBatteryHealth('').vendor).toBe('unknown');
    expect(parseBatteryHealth('not json').hasBattery).toBe(false);
  });
});
