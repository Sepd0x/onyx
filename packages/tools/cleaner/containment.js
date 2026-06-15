// Path-containment helpers for the cleaner, extracted so the delete-safety logic can
// be unit-tested with real temp dirs (incl. junctions) without Electron.
const path = require('path');
const fs = require('fs');

// The ONLY directory names the cleaner will ever scan for or delete — a curated
// whitelist of regenerable build/cache artifacts, keyed to a friendly kind label.
// Both the scanner and the delete-safety check use this single source of truth,
// so a path whose basename isn't here can never be deleted (closes the "delete
// any folder" risk that generalising beyond node_modules would otherwise open).
const CLEANABLE_TARGETS = {
  'node_modules': 'Node',
  'dist': 'Build output',
  'build': 'Build output',
  'out': 'Build output',
  '.next': 'Next.js',
  '.nuxt': 'Nuxt',
  '.svelte-kit': 'SvelteKit',
  '.angular': 'Angular',
  '.turbo': 'Turborepo',
  '.parcel-cache': 'Parcel',
  '.cache': 'Cache',
  'target': 'Rust / Java',
  '__pycache__': 'Python',
  '.pytest_cache': 'Pytest',
  '.gradle': 'Gradle',
  'coverage': 'Coverage',
};
const CLEANABLE_NAMES = new Set(Object.keys(CLEANABLE_TARGETS));

// Case-fold on Windows (its FS is case-insensitive) so containment compares correctly.
const norm = (s) => (process.platform === 'win32' ? path.resolve(s).toLowerCase() : path.resolve(s));

// Realpath each raw root (collapsing junctions/symlinks). Unresolvable roots
// (missing dirs) are dropped so they can't widen or break the containment set.
function resolveRoots(rawRoots) {
  const out = [];
  for (const r of rawRoots) {
    try { out.push(fs.realpathSync.native(r)); } catch { /* skip missing/unresolvable */ }
  }
  return out;
}

// Returns the REALPATH to delete if `target` is a whitelisted cleanable directory
// (basename ∈ CLEANABLE_NAMES) contained in one of the already-resolved roots, else
// null. Realpathing both sides closes the junction asymmetry (a junction can't smuggle
// a delete outside the roots), and returning the resolved path lets the caller rm
// exactly what was validated (no TOCTOU re-resolve after the confirm wait).
function safeDeletePath(target, resolvedRootList, allowedNames = CLEANABLE_NAMES) {
  if (typeof target !== 'string' || !target) return null;
  let resolved;
  try { resolved = fs.realpathSync.native(target); } catch { return null; }
  if (!allowedNames.has(path.basename(resolved).toLowerCase())) return null;
  const t = norm(resolved);
  const contained = resolvedRootList.some((root) => {
    const r = norm(root);
    return t === r || t.startsWith(r + path.sep);
  });
  return contained ? resolved : null;
}

module.exports = { norm, resolveRoots, safeDeletePath, CLEANABLE_TARGETS, CLEANABLE_NAMES };
