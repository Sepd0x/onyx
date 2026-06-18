// Pure payload helpers for opt-in, anonymous telemetry (no electron / no network),
// so what we would send is fully unit-testable apart from the IPC + fetch plumbing.
//
// PRIVACY MODEL (see vault/15 + PRIVACY.md): we only ever build a payload from a
// fixed, allow-listed set of low-cardinality fields — app version, a coarse OS
// label, arch, language (not full locale), theme, a random resettable id, and
// daily aggregate counts of which tool views were opened. NEVER paths, repo names,
// ports, process names, clipboard, AI text, hostnames or the username. buildPayload
// is structural only; assertNoPii is a belt-and-braces guard the backend runs
// before sending so a future change can't silently start leaking.

// Coarse OS label — never the full build string (which is higher-entropy).
function osLabel(platform, release) {
  if (platform === 'win32') {
    const m = String(release || '').match(/^10\.0\.(\d+)/);
    if (m) return Number(m[1]) >= 22000 ? 'Windows 11' : 'Windows 10';
    return 'Windows';
  }
  if (platform === 'darwin') return 'macOS';
  if (platform === 'linux') return 'Linux';
  return 'Other';
}

// Language only (e.g. "pt"), never the full "pt-PT" region tag.
function language(locale) {
  return String(locale || '').toLowerCase().split('-')[0].slice(0, 3) || 'und';
}

// UTC day bucket — we never send precise timestamps, only which day.
function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

// Only known tool ids may appear in tool_opened (no free-form strings leak through).
const TOOL_IDS = ['watcher', 'aiauditor', 'cursor', 'ports', 'git', 'cleaner', 'launchers', 'snippets', 'clipboard', 'power'];

function sanitizeToolOpens(counts) {
  const out = {};
  for (const id of TOOL_IDS) {
    const n = counts && Number(counts[id]);
    if (Number.isFinite(n) && n > 0) out[id] = Math.round(n);
  }
  return out;
}

// Assemble the batch. `launchedToday` adds the once-per-day app_launched event;
// `toolOpens` becomes one tool_opened event per tool with its daily count.
function buildPayload({ analyticsId, version, platform, release, arch, locale, theme, toolOpens, launchedToday, updatedFrom }) {
  const events = [];
  if (launchedToday) events.push({ e: 'app_launched' });
  if (updatedFrom && updatedFrom !== version) events.push({ e: 'update_applied', from: String(updatedFrom), to: String(version) });
  const opens = sanitizeToolOpens(toolOpens);
  for (const [tool, count] of Object.entries(opens)) events.push({ e: 'tool_opened', tool, count });
  return {
    v: 1,
    id: String(analyticsId || ''),
    app: String(version || ''),
    os: osLabel(platform, release),
    arch: String(arch || ''),
    lang: language(locale),
    theme: String(theme || 'midnight'),
    events,
  };
}

// Belt-and-braces: reject a payload whose values look like PII (paths, emails,
// the user's home dir, etc.) or whose keys aren't in the known allow-list.
const ALLOWED_KEYS = new Set(['v', 'id', 'app', 'os', 'arch', 'lang', 'theme', 'events']);
// Reject path separators, emails, the home-dir word and file extensions. A single
// space is allowed because the OS label legitimately contains one ("Windows 11").
const PII_RE = /[\\/@]|\busers\b|\.(exe|js|ts|env)\b/i;
function assertNoPii(payload) {
  if (!payload || typeof payload !== 'object') return false;
  for (const k of Object.keys(payload)) if (!ALLOWED_KEYS.has(k)) return false;
  for (const k of ['app', 'os', 'arch', 'lang', 'theme']) {
    if (payload[k] && PII_RE.test(String(payload[k]))) return false;
  }
  // id is a UUID; allow hex + hyphens only.
  if (payload.id && !/^[0-9a-f-]{0,40}$/i.test(payload.id)) return false;
  for (const ev of payload.events || []) {
    if (ev.e === 'tool_opened' && !TOOL_IDS.includes(ev.tool)) return false;
  }
  return true;
}

module.exports = { osLabel, language, dayKey, sanitizeToolOpens, buildPayload, assertNoPii, TOOL_IDS };
