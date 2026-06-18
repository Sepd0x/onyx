// Onyx telemetry collector — a tiny Cloudflare Worker.
//
// Receives the opt-in, anonymous payload from the desktop app (see PRIVACY.md and
// packages/tools/telemetry/payload.js), validates it, and writes ONLY aggregate
// counters to Workers Analytics Engine. It never logs or stores the client IP, and
// never stores per-event rows.
//
// Deploy (owner, one-time):
//   1. npm i -g wrangler && wrangler login
//   2. wrangler deploy            (from this folder; uses wrangler.toml)
//   3. put the resulting URL in TELEMETRY_ENDPOINT in
//      packages/tools/telemetry/index.js, then ship a build.

const ALLOWED_KEYS = ['v', 'id', 'app', 'os', 'arch', 'lang', 'theme', 'events'];
const TOOL_IDS = ['watcher', 'aiauditor', 'cursor', 'ports', 'git', 'cleaner', 'launchers', 'snippets', 'clipboard', 'power'];

function isClean(p) {
  if (!p || typeof p !== 'object') return false;
  for (const k of Object.keys(p)) if (!ALLOWED_KEYS.includes(k)) return false;
  if (typeof p.id !== 'string' || !/^[0-9a-f-]{0,40}$/i.test(p.id)) return false;
  for (const k of ['app', 'os', 'arch', 'lang', 'theme']) {
    if (p[k] != null && (typeof p[k] !== 'string' || /[\\/@]/.test(p[k]))) return false;
  }
  if (!Array.isArray(p.events)) return false;
  return true;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('', { status: 405 });
    let body;
    try { body = await request.json(); } catch { return new Response('', { status: 400 }); }
    if (!isClean(body)) return new Response('', { status: 422 });

    const os = String(body.os || 'Other');
    const ver = String(body.app || '');
    const lang = String(body.lang || 'und');

    // Aggregate only — no IP (we never read request.headers CF-Connecting-IP),
    // no per-event rows. Analytics Engine bins these into counters.
    const ae = env && env.ONYX_TELEMETRY;
    if (ae && typeof ae.writeDataPoint === 'function') {
      for (const ev of body.events) {
        if (ev.e === 'app_launched') {
          ae.writeDataPoint({ blobs: ['app_launched', os, ver, lang], doubles: [1], indexes: [os] });
        } else if (ev.e === 'update_applied') {
          ae.writeDataPoint({ blobs: ['update_applied', String(ev.from || ''), String(ev.to || '')], doubles: [1], indexes: ['update'] });
        } else if (ev.e === 'tool_opened' && TOOL_IDS.includes(ev.tool)) {
          ae.writeDataPoint({ blobs: ['tool_opened', ev.tool, ver], doubles: [Number(ev.count) || 1], indexes: [ev.tool] });
        }
      }
    }

    return new Response('', { status: 204 });
  },
};
