const { validateManifest } = require('../../core/src/plugins/manifest');
const { canonicalDigest, verify } = require('../../core/src/plugins/verify');

// Pure plugin-loading logic (Fase 2) — no Electron, no fs side effects, fully unit
// testable. The Electron wiring (index.js) reads files off disk and feeds them here.
// This module is the gatekeeper: it decides whether a bundle is trustworthy and loadable
// (signature + manifest + engine), and whether a given invoke is allowed.

const SIG_NAME = 'onyx.sig';

// Tiny semver-range check for engines.onyx — supports '*', 'x.y.z', and a single
// comparator ('>=x.y.z' etc.). Deliberately minimal; a plugin needing richer ranges is a
// signal we're over-complicating the contract.
function satisfiesEngine(appVersion, range) {
  if (!range || range === '*') return true;
  const parse = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] - b[i]; } return 0; };
  const m = /^(>=|>|<=|<|=)?\s*(\d+\.\d+\.\d+)$/.exec(String(range).trim());
  if (!m) return false;
  const op = m[1] || '=';
  const c = cmp(parse(appVersion), parse(m[2]));
  if (op === '>=') return c >= 0;
  if (op === '>') return c > 0;
  if (op === '<=') return c <= 0;
  if (op === '<') return c < 0;
  return c === 0;
}

// Verify a bundle is trustworthy and resolve its manifest. `files` is every file in the
// bundle EXCEPT onyx.sig, as [{ path, data: Buffer|string }]. Returns { ok, plugin } or
// { ok:false, error }. Order of checks is intentional: cheap structural checks first,
// signature (the trust gate) before anything that would imply trusting the bytes.
function loadBundle({ files, signature, publicKey, appVersion }) {
  const manifestEntry = (files || []).find((f) => f.path === 'manifest.json');
  if (!manifestEntry) return { ok: false, error: 'missing manifest.json' };

  let raw;
  try {
    const text = Buffer.isBuffer(manifestEntry.data) ? manifestEntry.data.toString('utf8') : String(manifestEntry.data);
    raw = JSON.parse(text);
  } catch { return { ok: false, error: 'manifest.json is not valid JSON' }; }

  const res = validateManifest(raw);
  if (!res.ok) return { ok: false, error: 'invalid manifest: ' + res.errors.join('; ') };

  // THE trust gate: the bundle's bytes must match a signature made with the Onyx key.
  if (!verify(canonicalDigest(files), signature, publicKey)) {
    return { ok: false, error: 'signature verification failed' };
  }

  if (!satisfiesEngine(appVersion, res.value.engines.onyx)) {
    return { ok: false, error: `requires Onyx ${res.value.engines.onyx} (have ${appVersion})` };
  }

  // The referenced entry files must actually be present inside the signed bundle.
  const names = new Set(files.map((f) => f.path));
  if (!names.has(res.value.main)) return { ok: false, error: `main file "${res.value.main}" not in bundle` };
  if (res.value.ui && !names.has(res.value.ui)) return { ok: false, error: `ui file "${res.value.ui}" not in bundle` };

  return { ok: true, plugin: res.value };
}

// An invoke is allowed only if the plugin is enabled AND the method was declared in the
// manifest's channels — a plugin can never be reached on a method it didn't advertise.
function canInvoke(plugin, method, enabled) {
  return !!plugin && enabled !== false && plugin.channels.includes(method);
}

// What the user actually grants at install time. The consent UI can only ever NARROW the
// declared set — a requested permission that the manifest didn't declare is dropped. This
// is the install-side half of "a plugin can never get more than it openly asked for".
function narrowGrant(declared, requested) {
  const want = new Set(Array.isArray(requested) ? requested : declared || []);
  return (declared || []).filter((p) => want.has(p));
}

module.exports = { loadBundle, canInvoke, satisfiesEngine, narrowGrant, SIG_NAME };
