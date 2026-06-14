const { exec, execFile } = require('child_process');
const { ipcMain } = require('electron');

// tasklist prints memory in the OS locale (e.g. "60 964 K" on pt-PT, where the
// grouping separator is a non-breaking space that mangles to U+FFFD under UTF-8,
// or "60,964 K" elsewhere). Keep only the digits and format it ourselves.
function formatMem(rawKb) {
  const kb = parseInt(String(rawKb).replace(/\D+/g, ''), 10);
  if (!Number.isFinite(kb)) return null;
  if (kb >= 1024) return (kb / 1024).toFixed(1) + ' MB';
  return kb + ' KB';
}

module.exports = function initPortMapper() {
  const NO_WIN = process.platform === 'win32' ? { windowsHide: true } : {};
  
  ipcMain.handle('ports:get', () => new Promise(resolve => {
    exec('netstat -ano', { ...NO_WIN, timeout: 8000 }, (err, stdout) => {
      if (err) return resolve([]);
      const rows = [], seen = new Set();
      for (const line of stdout.split('\n')) {
        const p = line.trim().split(/\s+/);
        if (p.length < 4) continue;
        const proto = p[0].toUpperCase();
        if (!['TCP','UDP'].includes(proto)) continue;
        const local = p[1] || '';
        const portStr = local.split(':').pop();
        if (!portStr || isNaN(portStr)) continue;
        const isTcp = proto === 'TCP';
        const state = isTcp ? (p[3] || '') : 'UDP';
        const pid   = (isTcp ? p[4] : p[3] || '').trim();
        const key   = `${portStr}|${pid}|${state}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ proto, port: portStr, local, state, pid, ram: 'N/A', cpu: 'N/A' });
      }
      if (process.platform === 'win32') {
        // Advanced info gathering for Windows
        exec('tasklist /fo csv /nh', { ...NO_WIN, timeout: 6000 }, (e2, out2) => {
          const names = {};
          const mems = {};
          if (!e2) {
            for (const l of out2.split('\n')) {
              // Parse the quoted CSV fields directly so a locale comma inside the
              // memory column ("60,964 K") can't split the value in two.
              const fields = (l.match(/"([^"]*)"/g) || []).map(s => s.slice(1, -1));
              if (fields.length >= 5) {
                const pid = fields[1].trim();
                names[pid] = fields[0].replace(/\.exe$/i, '');
                mems[pid] = formatMem(fields[4]);
              }
            }
          }
          for (const r of rows) {
            r.process = names[r.pid] || 'system';
            r.ram = mems[r.pid] || null;
            r.cpu = '-';
          }
          resolve(rows.sort((a,b) => +a.port - +b.port));
        });
      } else {
        for (const r of rows) r.process = 'system';
        resolve(rows);
      }
    });
  }));

  ipcMain.handle('ports:kill', (_, pid) => new Promise(resolve => {
    const pidStr = String(pid);
    if (!/^[0-9]+$/.test(pidStr)) return resolve(false); // reject non-numeric PIDs (no shell, no injection)
    const file = process.platform === 'win32' ? 'taskkill' : 'kill';
    const args = process.platform === 'win32' ? ['/F', '/PID', pidStr] : ['-9', pidStr];
    execFile(file, args, { ...NO_WIN }, err => resolve(!err));
  }));
};
