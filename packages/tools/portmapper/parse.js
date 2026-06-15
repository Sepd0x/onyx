// Pure, dependency-free parsing for the Port Mapper so it can be unit-tested
// without spawning netstat / tasklist / PowerShell or Electron.

// tasklist prints memory in the OS locale (e.g. "60 964 K" on pt-PT, where the
// grouping separator is a non-breaking space that mangles to U+FFFD under UTF-8,
// or "60,964 K" elsewhere). Keep only the digits and format it ourselves.
function formatMem(rawKb) {
  const kb = parseInt(String(rawKb).replace(/\D+/g, ''), 10);
  if (!Number.isFinite(kb)) return null;
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb + ' KB';
}

// CIM's WorkingSetSize is raw bytes.
function formatBytes(n) {
  const b = Number(n);
  if (!Number.isFinite(b) || b <= 0) return null;
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB';
  if (b >= 1048576) return Math.round(b / 1048576) + ' MB';
  return Math.max(1, Math.round(b / 1024)) + ' KB';
}

// Parse `netstat -ano` (Windows) into rows. TCP rows are
//   Proto  Local  Foreign  State  PID
// UDP rows have no State column:
//   Proto  Local  Foreign  PID
// Captures the foreign (remote) address and flags IPv6 ([::]-style) endpoints.
// De-dupes identical rows. Pure + deterministic.
function parseNetstat(stdout) {
  if (typeof stdout !== 'string') return [];
  const rows = [], seen = new Set();
  for (const line of stdout.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const proto = p[0].toUpperCase();
    if (proto !== 'TCP' && proto !== 'UDP') continue;
    const local = p[1] || '';
    const remote = p[2] || '';
    const portStr = local.split(':').pop();
    if (!portStr || isNaN(Number(portStr))) continue;
    const isTcp = proto === 'TCP';
    const state = isTcp ? (p[3] || '') : 'UDP';
    const pid = (isTcp ? p[4] : p[3] || '').trim();
    const ipv6 = local.includes('[');
    const key = `${proto}|${portStr}|${pid}|${state}|${remote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ proto, port: portStr, local, remote, state, pid, ipv6 });
  }
  return rows;
}

// Parse `tasklist /fo csv /nh` into { pid: { name, ram } }. Reads the quoted CSV
// fields directly so a locale comma inside the memory column ("60,964 K") can't
// split the value in two. Fallback when CIM is unavailable.
function parseTasklistCsv(stdout) {
  const map = {};
  if (typeof stdout !== 'string') return map;
  for (const l of stdout.split('\n')) {
    const fields = (l.match(/"([^"]*)"/g) || []).map((s) => s.slice(1, -1));
    if (fields.length >= 5) {
      const pid = fields[1].trim();
      map[pid] = { name: fields[0].replace(/\.exe$/i, ''), ram: formatMem(fields[4]), ppid: null, path: null };
    }
  }
  return map;
}

// Parse the JSON emitted by:
//   Get-CimInstance Win32_Process | Select ProcessId,ParentProcessId,Name,ExecutablePath,WorkingSetSize | ConvertTo-Json
// into { pid: { name, ppid, path, ram } }. A bare object (single process) is
// tolerated. Pure + deterministic.
function parseCimProcesses(jsonStr) {
  const map = {};
  if (typeof jsonStr !== 'string' || !jsonStr.trim()) return map;
  let data;
  try { data = JSON.parse(jsonStr); } catch { return map; }
  if (!Array.isArray(data)) data = data ? [data] : [];
  for (const p of data) {
    if (!p || p.ProcessId == null) continue;
    map[String(p.ProcessId)] = {
      name: p.Name ? String(p.Name).replace(/\.exe$/i, '') : null,
      ppid: p.ParentProcessId != null ? String(p.ParentProcessId) : null,
      path: p.ExecutablePath || null,
      ram: p.WorkingSetSize != null ? formatBytes(p.WorkingSetSize) : null,
    };
  }
  return map;
}

module.exports = { formatMem, formatBytes, parseNetstat, parseTasklistCsv, parseCimProcesses };
