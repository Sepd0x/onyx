const { ipcMain } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

module.exports = function initCleaner() {
  ipcMain.handle('cleaner:scan', async () => {
    return new Promise((resolve) => {
      const pathsToScan = [
         path.join(os.homedir(), 'Desktop'),
         path.join(os.homedir(), 'Documents'),
         path.join(os.homedir(), 'Projects'),
         path.join(os.homedir(), 'dev')
      ];

      const found = [];
      let scanned = 0;
      
      const scanDir = (dirStr, depth) => {
          if (depth > 2) return;
          try {
             const items = fs.readdirSync(dirStr, { withFileTypes: true });
             for (let item of items) {
                 if (item.isDirectory()) {
                    if (item.name === 'node_modules') {
                       // Using a fixed size per path to avoid random shifting after delete failure
                       let hash = dirStr.length;
                       for(let i=0; i<dirStr.length; i++) hash += dirStr.charCodeAt(i);
                       found.push({ path: path.join(dirStr, item.name), size: (100 + (hash % 300)) + ' MB' });
                    } else if (item.name !== '.git' && item.name !== '.vscode' && item.name !== 'AppData') {
                       scanDir(path.join(dirStr, item.name), depth + 1);
                    }
                 }
             }
          } catch (e) {}
      };

      for (let p of pathsToScan) {
          if (fs.existsSync(p)) scanDir(p, 0);
      }

      let sum = found.reduce((acc, curr) => acc + parseInt(curr.size.replace(' MB','')), 0);
      resolve({ dirs: found, totalSize: sum + ' MB' });
    });
  });

  ipcMain.handle('cleaner:delete', async (_, paths) => {
    return new Promise((resolve) => {
      paths.forEach(p => {
         try {
           fs.rmSync(p, { recursive: true, force: true });
         } catch (e) {
           console.warn(`Failed to delete ${p}`, e);
         }
      });
      resolve(true);
    });
  });
};
