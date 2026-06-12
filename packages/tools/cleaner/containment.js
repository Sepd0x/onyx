// Path-containment helpers for the cleaner, extracted so the delete-safety logic can
// be unit-tested with real temp dirs (incl. junctions) without Electron.
const path = require('path');
const fs = require('fs');

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

// Returns the REALPATH to delete if `target` is a `node_modules` directory contained
// in one of the already-resolved roots, else null. Realpathing both sides closes the
// junction asymmetry (a junction can't smuggle a delete outside the roots), and
// returning the resolved path lets the caller rm exactly what was validated (no TOCTOU
// re-resolve after the confirm wait).
function safeDeletePath(target, resolvedRootList) {
  if (typeof target !== 'string' || !target) return null;
  let resolved;
  try { resolved = fs.realpathSync.native(target); } catch { return null; }
  if (path.basename(resolved).toLowerCase() !== 'node_modules') return null;
  const t = norm(resolved);
  const contained = resolvedRootList.some((root) => {
    const r = norm(root);
    return t === r || t.startsWith(r + path.sep);
  });
  return contained ? resolved : null;
}

module.exports = { norm, resolveRoots, safeDeletePath };
