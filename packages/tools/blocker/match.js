// Pure matching helpers for the Focus-Mode app blocker (no electron / no
// child_process) so the "which PIDs do we close" decision is unit-testable apart
// from the IPC + process-enumeration plumbing in index.js.
//
// SAFETY MODEL: the blocker only ever closes processes whose image name the user
// explicitly added to their blocklist. A hardcoded denylist of OS-critical (and
// Onyx's own) processes can NEVER be blocked, even if the user types them — so a
// typo or a bad paste can't take down the desktop. Onyx's own PIDs are excluded
// at call time too (belt and braces).

// Processes that must never be killed regardless of the user's blocklist. Stored in
// the SAME normalised form normalizeAppName produces (lower-case, `.exe` suffix) so
// the comparison is apples-to-apples. Keeps a careless/abusive blocklist from
// bricking the session.
const CRITICAL_DENYLIST = [
  'system.exe', 'system idle process.exe', 'registry.exe', 'smss.exe', 'csrss.exe',
  'wininit.exe', 'winlogon.exe', 'services.exe', 'lsass.exe', 'svchost.exe',
  'explorer.exe', 'dwm.exe', 'fontdrvhost.exe', 'ctfmon.exe', 'taskmgr.exe',
  'powershell.exe', 'cmd.exe', 'conhost.exe',
  // Onyx itself (by image name, in addition to the runtime own-PID exclusion).
  'onyx.exe', 'electron.exe',
];

// Normalise a user-typed app to a comparable Windows image name: trim, drop any
// path, lower-case, and ensure a `.exe` suffix. Returns '' for anything that
// isn't a plausible image name (so it can't smuggle args/paths).
function normalizeAppName(input) {
  let s = String(input == null ? '' : input).trim().toLowerCase();
  if (!s) return '';
  // Strip a path if one was pasted (keep the basename).
  s = s.split(/[\\/]/).pop() || '';
  if (!s.endsWith('.exe')) s += '.exe';
  return /^[\w .-]+\.exe$/.test(s) ? s : '';
}

// Clean a user blocklist: normalise, drop invalid + critical entries, de-dupe.
function sanitizeBlocklist(apps) {
  const out = [];
  for (const a of Array.isArray(apps) ? apps : []) {
    const n = normalizeAppName(a);
    if (n && !CRITICAL_DENYLIST.includes(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

// Given running processes [{pid, name}], the user's (already-sanitised) blocklist,
// and Onyx's own PIDs, return the PIDs (as strings) that should be closed.
function pidsToKill(processes, blocklist, ownPids = []) {
  const block = new Set(sanitizeBlocklist(blocklist));
  if (!block.size) return [];
  const own = new Set((ownPids || []).map(String));
  const kill = [];
  for (const p of Array.isArray(processes) ? processes : []) {
    const name = normalizeAppName(p && p.name);
    const pid = String(p && p.pid);
    if (!name || !/^[0-9]+$/.test(pid)) continue;
    if (own.has(pid)) continue;
    if (CRITICAL_DENYLIST.includes(name)) continue;
    if (block.has(name) && !kill.includes(pid)) kill.push(pid);
  }
  return kill;
}

module.exports = { CRITICAL_DENYLIST, normalizeAppName, sanitizeBlocklist, pidsToKill };
