const { ipcMain, powerSaveBlocker, Notification } = require('electron');
const { exec, execFile } = require('child_process');

module.exports = function initDevWatcher() {
  const activeWatches = new Map();

  const isProcessRunning = (pid) => {
    return new Promise(resolve => {
      const pidStr = String(pid);
      if (!/^[0-9]+$/.test(pidStr)) return resolve(false); // numeric PIDs only — argv array, no shell
      const NO_WIN = process.platform === 'win32' ? { windowsHide: true } : {};
      const file = process.platform === 'win32' ? 'tasklist' : 'ps';
      const args = process.platform === 'win32'
        ? ['/FI', `PID eq ${pidStr}`, '/NH']
        : ['-p', pidStr, '-o', 'pid='];

      execFile(file, args, NO_WIN, (err, stdout) => {
        if (err || !stdout) resolve(false);
        else resolve(stdout.includes(pidStr));
      });
    });
  };

  const generateId = () => Math.random().toString(36).substring(7);

    ipcMain.handle('dev:heal', (event, id) => {
      // In a real advanced setup, this would restart the process or clear its logs
      // Here we just notify that we attempted to heal it.
      return true;
    });

  ipcMain.handle('dev:getDevProcesses', () => {
    return new Promise(resolve => {
      const isWin = process.platform === 'win32';
      // Use WMIC or PS to get full command line for better AI heuristic context
      const cmd = isWin ? 'wmic process get processid,name,commandline /format:csv' : 'ps -A -o pid,comm,args';
      exec(cmd, { windowsHide: true, maxBuffer: 1024 * 1024 * 5 }, (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const procs = [];
        const lines = stdout.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          let pid, name, command = '';
          
          if (isWin) {
             const parts = line.split(',');
             if (parts.length >= 4) {
               // Node,Commandline,Name,ProcessId
               command = parts[1] || '';
               name = parts[2] || '';
               pid = parts[3] || '';
             }
          } else {
             const parts = line.split(/\s+/);
             if (parts.length >= 3) {
               pid = parts[0];
               name = parts[1];
               command = parts.slice(2).join(' ');
             }
          }
          
          if (!name || !pid) continue;
          
          const pName = name.toLowerCase();
          const cmdLine = command.toLowerCase();
          
          // AI Pattern Heuristic engine
          let aiConfidence = 0.0;
          
          if (pName.includes('node') || cmdLine.includes('node_modules')) aiConfidence += 0.40;
          if (pName.includes('python') || cmdLine.includes('venv') || cmdLine.includes('.py')) aiConfidence += 0.40;
          if (cmdLine.includes('--inspect') || cmdLine.includes('-dev')) aiConfidence += 0.30;
          if (pName.includes('docker') || pName.includes('containerd')) aiConfidence += 0.35;
          if (cmdLine.includes('build') || cmdLine.includes('start') || cmdLine.includes('run')) aiConfidence += 0.20;
          if (cmdLine.includes('vite') || cmdLine.includes('webpack') || cmdLine.includes('esbuild')) aiConfidence += 0.45;
          if (pName.includes('code') || pName.includes('cursor')) aiConfidence += 0.45;
          if (pName.includes('ollama') || pName.includes('llama') || cmdLine.includes('model')) aiConfidence += 0.50;
          if (pName.includes('rustc') || pName.includes('cargo')) aiConfidence += 0.45;
          
          // Dynamic analysis points based on path characteristics
          if (cmdLine.match(/\/[a-z0-9_-]+\/src\//i)) aiConfidence += 0.15;
          if (cmdLine.includes('localhost') || cmdLine.includes('127.0.0.1')) aiConfidence += 0.25;

          if (aiConfidence >= 0.35 && !procs.find(p => p.pid === pid)) {
            procs.push({ 
              pid, 
              name: pName, 
              type: pName.replace('.exe', ''),
              confidence: Math.min(99, Math.round(aiConfidence * 100)) + '%'
            });
          }
        }
        resolve(procs);
      });
    });
  });

  ipcMain.handle('dev:startWatch', async (event, req) => {
    if (req.type !== 'pid') return false;
    const pid = req.target;
    if (!/^[0-9]+$/.test(String(pid))) return false; // reject non-numeric targets

    const blockerId = powerSaveBlocker.start('prevent-display-sleep');
    const id = generateId();
    
    const intervalId = setInterval(async () => {
      const running = await isProcessRunning(pid);
      if (!running) {
        clearInterval(activeWatches.get(id).intervalId);
        powerSaveBlocker.stop(activeWatches.get(id).blockerId);
        activeWatches.delete(id);
        
        new Notification({
          title: 'Onyx Session Guard',
          body: `Task finished! Wake lock released for PID ${pid}.`
        }).show();
      }
    }, 5000);

    activeWatches.set(id, { id, type: 'pid', target: pid, name: req.name, intervalId, blockerId });
    return true;
  });

  ipcMain.handle('dev:stopWatch', (event, id) => {
    if (activeWatches.has(id)) {
      clearInterval(activeWatches.get(id).intervalId);
      powerSaveBlocker.stop(activeWatches.get(id).blockerId);
      activeWatches.delete(id);
    }
  });

  ipcMain.handle('dev:status', () => {
    const res = [];
    for (const val of activeWatches.values()) {
       res.push({ id: val.id, type: val.type, target: val.target, name: val.name });
    }
    return res;
  });
};
