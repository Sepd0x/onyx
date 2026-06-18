// Pure, dependency-free helpers for battery health + per-vendor charge-limit
// capability, so they can be unit-tested without WMI/PowerShell or Electron.

// Map a raw Win32_ComputerSystem.Manufacturer string to a known vendor key.
function normalizeVendor(manufacturer) {
  const m = String(manufacturer || '').toLowerCase();
  if (m.includes('lenovo')) return 'lenovo';
  if (m.includes('dell')) return 'dell';
  if (m.includes('asus')) return 'asus';
  if (m.includes('hewlett') || /\bhp\b/.test(m)) return 'hp';
  if (m.includes('microsoft')) return 'surface';
  if (m.includes('acer')) return 'acer';
  if (m.includes('micro-star') || m.includes('msi')) return 'msi';
  if (m.includes('samsung')) return 'samsung';
  if (m.includes('razer')) return 'razer';
  return 'unknown';
}

// The vendor app where a user sets a charge limit when Onyx can't drive it.
const VENDOR_APP = {
  lenovo: 'Lenovo Vantage', dell: 'Dell Power Manager', asus: 'MyASUS',
  hp: 'HP Command Center', surface: 'the Surface app', acer: 'Acer Care Center',
  msi: 'MSI Center', samsung: 'Samsung Settings', razer: 'Razer Synapse',
};
function vendorApp(vendor) { return VENDOR_APP[vendor] || null; }

// Vendors whose charge-limit Onyx can RELIABLY drive itself. Empty on purpose:
// setting the charge threshold / conservation mode needs the vendor's own
// driver/service (Vantage, Dell Command, …) and isn't reliable via standard WMI,
// so Onyx never shows a toggle that silently does nothing — it points to the
// vendor app instead (honest guidance). This table is the extension point: add a
// vendor here only once a verified write path exists for it.
const VENDOR_CHARGE_CONTROL = {};
function canControlChargeLimit(vendor) { return VENDOR_CHARGE_CONTROL[vendor] === true; }

// Battery wear: how far the full-charge capacity has fallen from the design
// capacity, as a 0–100 percentage. Null when the figures aren't usable.
function computeWearPct(design, full) {
  const d = Number(design), f = Number(full);
  if (!Number.isFinite(d) || !Number.isFinite(f) || d <= 0 || f <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((1 - f / d) * 100)));
}

// Build the battery-health payload from the JSON the PowerShell probe emits:
//   { manufacturer, model, present, charge, design, full }
// `present`/`charge` come from Win32_Battery (reliable presence signal);
// design/full are mWh from root\wmi BatteryStaticData / BatteryFullChargedCapacity,
// which many laptops (notably Lenovo) leave EMPTY even with a battery present.
// hasBattery must therefore reflect PRESENCE, not whether wear could be computed —
// otherwise a perfectly real battery reads as "no battery detected".
function parseBatteryHealth(jsonStr) {
  let d = {};
  if (typeof jsonStr === 'string' && jsonStr.trim()) {
    try { d = JSON.parse(jsonStr) || {}; } catch { d = {}; }
  }
  const vendor = normalizeVendor(d.manufacturer);
  const wearPct = computeWearPct(d.design, d.full);
  const present = d.present === true || d.present === 1 || d.present === 'true';
  const chargeN = Number(d.charge);
  const chargePercent = Number.isFinite(chargeN) && chargeN >= 0 && chargeN <= 100 ? Math.round(chargeN) : null;
  return {
    manufacturer: d.manufacturer ? String(d.manufacturer).trim() : null,
    model: d.model ? String(d.model).trim() : null,
    vendor,
    vendorApp: vendorApp(vendor),
    canControlChargeLimit: canControlChargeLimit(vendor),
    designCapacity: Number.isFinite(Number(d.design)) && Number(d.design) > 0 ? Number(d.design) : null,
    fullCapacity: Number.isFinite(Number(d.full)) && Number(d.full) > 0 ? Number(d.full) : null,
    chargePercent,
    wearPct,
    healthPct: wearPct == null ? null : 100 - wearPct,
    // Wear figures need both capacities; presence does not.
    wearKnown: wearPct != null,
    hasBattery: present || wearPct != null,
  };
}

module.exports = { normalizeVendor, vendorApp, canControlChargeLimit, computeWearPct, parseBatteryHealth };
