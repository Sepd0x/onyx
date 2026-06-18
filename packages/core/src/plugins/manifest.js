const { isKnownPermission } = require('./permissions');

// Plugin manifest validation (Fase 2). Pure + dependency-free, so it runs identically
// in the app (on install) and in the offline signing tool, and is fully unit-testable.
// validateManifest never throws on bad input — it returns { ok, errors, value }.
//
// SECURITY INVARIANTS enforced here (see vault/16):
//  - author.handle + an https author.url are MANDATORY — credit to the author is
//    non-negotiable; a plugin with no traceable author is rejected.
//  - every permission must come from the closed catalog (permissions.js).
//  - method names and file paths are constrained (no IPC-channel smuggling, no path
//    traversal) so a manifest can never request access it didn't openly declare.

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/; // "namespace.name"
const VERSION_RE = /^\d+\.\d+\.\d+$/;
const METHOD_RE = /^[a-z][a-zA-Z0-9]*$/;               // a bare method name, never a full channel
const FILE_RE = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;      // a plain filename inside the bundle, no separators
const HANDLE_RE = /^[a-zA-Z0-9_-]{1,39}$/;

function isHttpsUrl(s) {
  try { const u = new URL(String(s)); return u.protocol === 'https:'; } catch { return false; }
}
function isStr(v) { return typeof v === 'string'; }
function uniq(arr) { return new Set(arr).size === arr.length; }

function validateManifest(raw) {
  const errors = [];
  const m = raw && typeof raw === 'object' ? raw : {};

  if (!isStr(m.id) || !ID_RE.test(m.id)) errors.push('id must be "namespace.name" (lowercase, e.g. "acme.ports")');
  if (!isStr(m.name) || !m.name.trim() || m.name.length > 60) errors.push('name must be a non-empty string ≤ 60 chars');
  if (!isStr(m.version) || !VERSION_RE.test(m.version)) errors.push('version must be semver "x.y.z"');
  if (m.description != null && (!isStr(m.description) || m.description.length > 200)) errors.push('description must be a string ≤ 200 chars');

  const author = m.author && typeof m.author === 'object' ? m.author : null;
  if (!author || !isStr(author.handle) || !HANDLE_RE.test(author.handle)) errors.push('author.handle is required (1–39 chars)');
  if (!author || !isHttpsUrl(author.url)) errors.push('author.url is required and must be https');

  if (m.official != null && typeof m.official !== 'boolean') errors.push('official must be a boolean');

  const perms = m.permissions == null ? [] : m.permissions;
  if (!Array.isArray(perms)) errors.push('permissions must be an array');
  else {
    if (!uniq(perms)) errors.push('permissions must not contain duplicates');
    for (const p of perms) if (!isStr(p) || !isKnownPermission(p)) errors.push(`unknown permission: ${JSON.stringify(p)}`);
  }

  const channels = m.channels == null ? [] : m.channels;
  if (!Array.isArray(channels)) errors.push('channels must be an array');
  else {
    if (!uniq(channels)) errors.push('channels must not contain duplicate method names');
    for (const c of channels) if (!isStr(c) || !METHOD_RE.test(c)) errors.push(`invalid channel method name: ${JSON.stringify(c)}`);
  }

  if (!isStr(m.main) || !FILE_RE.test(m.main)) errors.push('main must be a plain filename inside the bundle (e.g. "backend.js")');
  if (m.ui != null && (!isStr(m.ui) || !FILE_RE.test(m.ui))) errors.push('ui must be a plain filename inside the bundle');

  if (m.engines != null) {
    if (typeof m.engines !== 'object') errors.push('engines must be an object');
    else if (m.engines.onyx != null && !isStr(m.engines.onyx)) errors.push('engines.onyx must be a version range string');
  }

  if (errors.length) return { ok: false, errors, value: null };

  const value = {
    id: m.id,
    name: m.name.trim(),
    version: m.version,
    description: isStr(m.description) ? m.description.trim() : '',
    author: { handle: author.handle, url: author.url },
    official: m.official === true,
    permissions: [...perms],
    channels: [...channels],
    main: m.main,
    ui: isStr(m.ui) ? m.ui : null,
    engines: { onyx: (m.engines && isStr(m.engines.onyx)) ? m.engines.onyx : '*' },
  };
  return { ok: true, errors: [], value };
}

// The full IPC channel a method maps to at dispatch time — always namespaced by plugin
// id, so two plugins can never collide and a plugin can never name a core channel.
function pluginChannel(id, method) { return `plugin:${id}:${method}`; }

module.exports = { validateManifest, pluginChannel };
