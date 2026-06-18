const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { buildPayload, assertNoPii } = require('./payload');

// Opt-in, anonymous telemetry (#27). OFF by default — nothing is collected OR sent
// unless the user explicitly enables it (config.telemetryEnabled), and never in dev.
// Decision + privacy model: vault/15 + PRIVACY.md. The collector is a self-owned
// Cloudflare Worker (infra/telemetry-worker) that drops the IP at the edge and stores
// aggregate counters only. Live endpoint below; if blanked, the toggle + batching
// still work end-to-end but nothing is transmitted.
const TELEMETRY_ENDPOINT = 'https://onyx-telemetry.onyx-dev.workers.dev';
const FLUSH_MS = 10 * 60 * 1000;

module.exports = function initTelemetry(opts) {
  const getConfig = (opts && opts.getConfig) || (() => ({}));
  const appVersion = (opts && opts.appVersion) || (app.getVersion ? app.getVersion() : 'dev');
  const file = path.join(app.getPath('userData'), 'telemetry-state.json');

  let state = { analyticsId: '', lastLaunchDay: '', lastKnownVersion: '', pending: { launch: false, update: null, toolOpens: {} } };
  try { state = { ...state, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  if (!state.analyticsId) state.analyticsId = crypto.randomUUID();
  if (!state.pending) state.pending = { launch: false, update: null, toolOpens: {} };

  const save = () => { try { fs.writeFileSync(file, JSON.stringify(state)); } catch {} };

  // Consent + environment gate. Disabled OR a dev build → collect nothing, send nothing.
  const enabled = () => getConfig().telemetryEnabled === true && app.isPackaged;

  const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);

  // Record a once-per-day launch and a version change, only while opted in.
  const recordLaunch = () => {
    if (!enabled()) return;
    const today = dayKey(Date.now());
    if (state.lastLaunchDay !== today) { state.pending.launch = true; state.lastLaunchDay = today; }
    if (state.lastKnownVersion && state.lastKnownVersion !== appVersion) {
      state.pending.update = { from: state.lastKnownVersion, to: appVersion };
    }
    state.lastKnownVersion = appVersion;
    save();
  };

  const currentPayload = () => buildPayload({
    analyticsId: state.analyticsId,
    version: appVersion,
    platform: process.platform,
    release: os.release(),
    arch: process.arch,
    locale: app.getLocale ? app.getLocale() : '',
    theme: getConfig().theme,
    toolOpens: state.pending.toolOpens,
    launchedToday: state.pending.launch,
    updatedFrom: state.pending.update ? state.pending.update.from : null,
  });

  const flush = async () => {
    if (!enabled() || !TELEMETRY_ENDPOINT || typeof fetch !== 'function') return;
    const payload = currentPayload();
    if (!payload.events.length) return; // nothing to send
    if (!assertNoPii(payload)) return;  // refuse anything that looks like PII
    try {
      const res = await fetch(TELEMETRY_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res && res.ok) {
        // Sent — clear the accumulators so nothing is double-counted.
        state.pending = { launch: false, update: null, toolOpens: {} };
        save();
      }
    } catch {/* best-effort; no retry storm */}
  };

  recordLaunch();
  const timer = setInterval(flush, FLUSH_MS);
  if (timer.unref) timer.unref();
  app.on('will-quit', () => { try { flush(); } catch {} });

  // Renderer reports a tool view opening (id only, never content). Counted per day,
  // only while opted in.
  ipcMain.handle('telemetry:track', (_, data) => {
    if (!enabled()) return false;
    const tool = data && typeof data.tool === 'string' ? data.tool : '';
    if (!/^[a-z]+$/.test(tool)) return false;
    state.pending.toolOpens[tool] = (state.pending.toolOpens[tool] || 0) + 1;
    save();
    return true;
  });

  // "See exactly what we'd send" for the consent UI — the real payload shape with
  // the live (or representative) values, plus the current enabled state + id.
  ipcMain.handle('telemetry:getPreview', () => ({
    enabled: getConfig().telemetryEnabled === true,
    packaged: app.isPackaged,
    analyticsId: state.analyticsId,
    endpointConfigured: !!TELEMETRY_ENDPOINT,
    sample: buildPayload({
      analyticsId: state.analyticsId,
      version: appVersion,
      platform: process.platform,
      release: os.release(),
      arch: process.arch,
      locale: app.getLocale ? app.getLocale() : '',
      theme: getConfig().theme,
      toolOpens: Object.keys(state.pending.toolOpens).length ? state.pending.toolOpens : { git: 3, ports: 1 },
      launchedToday: true,
      updatedFrom: null,
    }),
  }));

  // Reset the anonymous id (Settings → Privacy).
  ipcMain.handle('telemetry:resetId', () => {
    state.analyticsId = crypto.randomUUID();
    save();
    return state.analyticsId;
  });

  return { flush };
};
