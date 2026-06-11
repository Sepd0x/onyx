const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');

module.exports = function initSnippets() {
  const file = path.join(app.getPath('userData'), 'onyx-snippets.json');
  let snippets = [];
  try {
    snippets = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch(e) {}

  ipcMain.handle('snippets:get', () => snippets);
  
  ipcMain.handle('snippets:save', (_, newSnippets) => {
    snippets = newSnippets;
    fs.writeFileSync(file, JSON.stringify(snippets, null, 2));
    return snippets;
  });
};
