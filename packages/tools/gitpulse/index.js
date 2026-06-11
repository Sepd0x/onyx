const { ipcMain, dialog, app, safeStorage } = require('electron');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = function initGitPulse() {
  const NO_WIN = process.platform === 'win32' ? { windowsHide: true, timeout: 10000 } : { timeout: 10000 };
  const CFG_PATH = path.join(app.getPath('userData'), 'gitpulse.json');

  function loadCfg() {
    try { return JSON.parse(fs.readFileSync(CFG_PATH, 'utf8')) }
    catch { return { repos: [], token: '' } }
  }
  function saveCfg(cfg) { fs.writeFileSync(CFG_PATH, JSON.stringify(cfg, null, 2)) }

  // Encrypt the PAT at rest with the OS keychain (DPAPI/Keychain) via Electron safeStorage.
  // If encryption is unavailable we refuse to persist the token rather than store it recoverably.
  function encryptToken(token) {
    if (!token) return '';
    try {
      if (safeStorage && safeStorage.isEncryptionAvailable()) {
        return 'v1:' + safeStorage.encryptString(token).toString('base64');
      }
    } catch (e) {}
    return '';
  }

  function decryptToken(stored) {
    if (!stored || typeof stored !== 'string') return '';
    if (stored.startsWith('v1:')) {
      try { return safeStorage.decryptString(Buffer.from(stored.slice(3), 'base64')); }
      catch (e) { return ''; }
    }
    return ''; // legacy/plaintext tokens are intentionally ignored
  }

  function git(args, cwd) {
    try {
      return execSync(`git ${args.join(' ')}`, { cwd, ...NO_WIN, stdio:['ignore','pipe','ignore'] }).toString().trim()
    } catch { return '' }
  }

  async function getRemoteRepo(r) {
    let dirty = 0, pull = 0, push = 0, risk = [], activity = [0,0,0,0,0,0,0];
    let branch = 'main';
    try {
      const hdrs = { 'User-Agent': 'Onyx' };
      if (r.token) { const tok = decryptToken(r.token); if (tok) hdrs['Authorization'] = `token ${tok}`; }
      
      const now = Date.now();
      if (!r._lastCheck || (now - r._lastCheck) > 60000) {
         const res = await fetch(`https://api.github.com/repos/${r.match}`, { headers: hdrs });
         if (!res.ok) throw new Error('API request failed');
         const data = await res.json();
         branch = data.default_branch || 'main';
         dirty = data.open_issues_count || 0;
         
         const commitsRes = await fetch(`https://api.github.com/repos/${r.match}/commits?per_page=1`, { headers: hdrs });
         let lastCommit = 'Unknown';
         if (commitsRes.ok) {
            const commitsData = await commitsRes.json();
            if (commitsData && commitsData.length > 0) {
               lastCommit = commitsData[0].commit.message;
            }
         }
         r._cachedData = { branch, dirty, lastCommit };
         r.lastCommit = lastCommit;
         r._lastCheck = now;
         
         // Non-blocking save to config
         const cfg = loadCfg();
         const ref = cfg.repos.find(x => x.url === r.url);
         if (ref) {
            ref._cachedData = r._cachedData;
            ref._lastCheck = r._lastCheck;
            saveCfg(cfg);
         }
      } else {
         branch = r._cachedData.branch;
         dirty = r._cachedData.dirty;
         r.lastCommit = r._cachedData.lastCommit;
      }
      
      let commitWarning = null;
      if (r.lastCommit && r.lastCommit.length < 5) commitWarning = 'Bad commit message detected';
      
      activity = [0,0,Math.floor(dirty/2),0,1,dirty,pull];
      
      return { type:'remote', path:r.url, name:r.match, branch, dirty, pull, push, risk, ready:true, activity, lastCommit: r.lastCommit || 'Unknown', commitWarning };
    } catch (e) {
      return { type:'remote', path:r.url, name:r.match, branch:'?', dirty:0, pull:0, push:0, risk:['API Error'], ready:false, activity, lastCommit:e.message, commitWarning:'Failed to sync.' };
    }
  }

  function getLocalRepo(repoPath) {
    if (!fs.existsSync(path.join(repoPath, '.git'))) return null;
    const branch = git(['rev-parse','--abbrev-ref','HEAD'], repoPath) || 'main';

    let dirty = 0, pull = 0, push = 0;
    try {
      dirty = git(['status','--short'], repoPath).split('\n').filter(Boolean).length;
      git(['fetch','--quiet','--no-tags'], repoPath);
      pull = parseInt(git(['rev-list','--count','HEAD..@{u}'], repoPath)) || 0;
      push = parseInt(git(['rev-list','--count','@{u}..HEAD'], repoPath)) || 0;
    } catch {}

    const risk = [];
    try {
      const statusStr = git(['status', '--short'], repoPath);
      if (statusStr.includes('.env')) risk.push('Exposed .env');
      if (statusStr.includes('node_modules/')) risk.push('Exposed node_modules');
      if (statusStr.includes('.pem') || statusStr.includes('.key')) risk.push('Exposed Keys');
    } catch {}

    const ready = fs.existsSync(path.join(repoPath, 'README.md')) && fs.existsSync(path.join(repoPath, 'LICENSE'));

    // Try to get last commit msg
    const lastCommit = git(['log', '-1', '--pretty=%B'], repoPath) || 'No commits';
    let commitWarning = null;
    const lC = lastCommit.toLowerCase();
    if (lC === 'update' || lC === 'fix' || lC === 'stuff' || lC === 'test' || lC.length < 5) {
      commitWarning = `Bad commit message detected: "${lastCommit.replace(/\n/g, '')}"`;
    }

    const activity = [Math.floor(Math.random()*2),Math.floor(Math.random()*5),0,0,Math.floor(Math.random()*10),dirty,pull];

    return { type:'local', path:repoPath, name:path.basename(repoPath), branch, dirty, pull, push, risk, ready, activity, lastCommit, commitWarning };
  }

  ipcMain.handle('git:getRepos', async () => {
    const cfg = loadCfg();
    const results = [];
    for (const entry of cfg.repos) {
      if (entry.type === 'local') {
        const r = getLocalRepo(entry.path);
        if (r) results.push(r);
      } else if (entry.type === 'remote') {
        results.push(await getRemoteRepo(entry));
      }
    }
    return results;
  });

  ipcMain.handle('git:addRepo', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title:'Select Git Repository', properties:['openDirectory'] })
    if (canceled || !filePaths.length) return null
    const p = filePaths[0]
    if (!fs.existsSync(path.join(p,'.git'))) return { error:'Not a valid git repository.' }
    const cfg = loadCfg()
    if (!cfg.repos.find(r=>r.type==='local'&&r.path===p)) { cfg.repos.push({ type:'local', path:p }); saveCfg(cfg); }
    return { ok:true }
  });

  ipcMain.handle('git:removeRepo', async (event, p) => {
    const cfg = loadCfg();
    cfg.repos = cfg.repos.filter(r => r.path !== p);
    saveCfg(cfg);
    return { ok: true };
  });

  ipcMain.handle('git:autoScan', async () => {
    const cfg = loadCfg();
    const searchDirs = [
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Documents', 'GitHub'),
      path.join(os.homedir(), 'source', 'repos'),
      path.join(os.homedir(), 'Projects'),
      path.join(os.homedir(), 'Code'),
      path.join(os.homedir(), 'dev')
    ];

    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              const full = path.join(dir, item.name);
              if (fs.existsSync(path.join(full, '.git'))) {
                if (!cfg.repos.find(r => r.type === 'local' && r.path === full)) {
                  cfg.repos.push({ type: 'local', path: full });
                }
              }
            }
          }
        } catch {}
      }
    }
    saveCfg(cfg);
    return { ok: true };
  });

  ipcMain.handle('git:addGithubRepo', async (event, url, token) => {
    try {
      if (!url.startsWith('https://github.com/')) return { error: 'Must be a valid GitHub URL' };
      const cfg = loadCfg();
      const safeToken = encryptToken(token);

      const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (!match) return { error: 'Invalid repository format' };

      const repoUrl = `https://github.com/${match[1]}/${match[2].replace('.git','')}`;

      if (!cfg.repos.find(r => r.type === 'remote' && r.url === repoUrl)) {
        cfg.repos.push({ type: 'remote', url: repoUrl, match: `${match[1]}/${match[2].replace('.git','')}`, token: safeToken });
        saveCfg(cfg);
        if (token && !safeToken) return { ok: true, warning: 'Token not stored: secure storage is unavailable on this system.' };
        return { ok: true };
      }
      return { error: 'Repository already added' };
    } catch(e) {
      return { error: e.message };
    }
  });

  // MOCK AI COMMITS
  ipcMain.handle('git:generateCommit', async (event, p) => {
    return new Promise(resolve => {
       setTimeout(() => {
          let diffStr = '';
          try {
             diffStr = git(['diff', 'HEAD'], p);
             if (!diffStr) diffStr = git(['diff', '--cached'], p); // maybe staged args
          } catch {}
          
          if (!diffStr) return resolve("chore: minor updates and cleanup");
          
          if (diffStr.includes('package.json') || diffStr.includes('npm install')) return resolve("build: update project dependencies");
          if (diffStr.includes('console.log') || diffStr.includes('debugger')) return resolve("fix: remove debug artifacts");
          if (diffStr.includes('function ') || diffStr.includes('const ')) return resolve("feat: implement core logic improvements");
          if (diffStr.includes('class=') || diffStr.includes('className=')) return resolve("style: refine ui component layouts");
          
          resolve("refactor: structural improvements across modules");
       }, 1500); // simulate think time
    });
  });
  
  // Expose it to the context bridge! (needs to be added to preload.js)
};
