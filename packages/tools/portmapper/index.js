const { exec } = require('child_process');
const { ipcMain } = require('electron');

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
              const parts = l.trim().replace(/"/g,'').split(',');
              if (parts.length >= 5) {
                names[parts[1].trim()] = parts[0].replace(/\.exe$/i,'');
                mems[parts[1].trim()] = parts[4].replace(' K', 'KB'); // Memory usage
              }
            }
          }
          for (const r of rows) {
            r.process = names[r.pid] || 'system';
            r.ram = mems[r.pid] || '~';
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
    const cmd = process.platform === 'win32' ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
    exec(cmd, { ...NO_WIN }, err => resolve(!err));
  }));
};
