const { ipcMain, dialog, app, safeStorage } = require('electron');
const { execFile } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseGithubUrl, classifyCommitMessage, bucketCommitDates, capDiff } = require('./parse');
const aiStore = require('../ai/store');
const aiComplete = require('../ai/complete');

const execFileAsync = promisify(execFile);

// Offline/no-key fallback: a crude commit message from coarse diff signals.
function heuristicCommit(diffStr) {
  if (diffStr.includes('package.json') || diffStr.includes('npm install')) return 'build: update project dependencies';
  if (diffStr.includes('console.log') || diffStr.includes('debugger')) return 'fix: remove debug artifacts';
  if (diffStr.includes('function ') || diffStr.includes('const ')) return 'feat: implement core logic improvements';
  if (diffStr.includes('class=') || diffStr.includes('className=')) return 'style: refine ui component layouts';
  return 'refactor: structural improvements across modules';
}

module.exports = function initGitPulse() {
  const CFG_PATH = path.join(app.getPath('userData'), 'gitpulse.json');

  // Default roots scanned for local repositories (overridable via cfg.scanRoots).
  const DEFAULT_ROOTS = [
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents', 'GitHub'),
    path.join(os.homedir(), 'source', 'repos'),
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'Code'),
    path.join(os.homedir(), 'dev'),
  ];
  // Directory names never descended into during an auto-scan (lowercase compare).
  const SKIP_DIRS = new Set([
    'node_modules', '.git', 'appdata', '$recycle.bin', 'program files', 'windows',
    'dist', 'build', '.cache', '.vscode', '.idea', 'venv', '.venv', '__pycache__', 'vendor',
  ]);
  const MAX_DEPTH = 3;       // directories below a root to descend
  const MAX_VISITED = 20000; // hard cap on dirs read per scan

  // Per-repo `git fetch` throttle. Session-scoped Map instead of persisting on the
  // cfg entry: avoids the load/save clobber race the remote `_lastCheck` path has
  // under the concurrent getRepos pool, at the cost of one fetch per repo per launch.
  const lastFetchByPath = new Map();
  const FETCH_THROTTLE_MS = 60000;

  function scanRootsFrom(cfg) {
    return Array.isArray(cfg.scanRoots) && cfg.scanRoots.length ? cfg.scanRoots : DEFAULT_ROOTS;
  }

  // Today as local-calendar ISO (YYYY-MM-DD), matching git's format-local output.
  function todayISO() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

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

  // Run git without a shell (execFile → no injection) and never throw.
  async function git(args, cwd) {
    try {
      const { stdout } = await execFileAsync('git', args, { cwd, timeout: 10000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
      return stdout.trim();
    } catch { return ''; }
  }

  // Bounded-concurrency map so getRepos doesn't spawn a git process per repo at once.
  async function mapPool(items, limit, fn) {
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const idx = next++;
        results[idx] = await fn(items[idx], idx);
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  async function getRemoteRepo(r) {
    let dirty = 0, pull = 0, push = 0, risk = [], activity = new Array(14).fill(0);
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

      // No cheap per-day history from the REST API; leave the sparkline flat rather
      // than fabricate it (local repos get real 14-day buckets from git log).
      return { type:'remote', path:r.url, name:r.match, branch, dirty, pull, push, risk, ready:true, activity, lastCommit: r.lastCommit || 'Unknown', commitWarning };
    } catch (e) {
      return { type:'remote', path:r.url, name:r.match, branch:'?', dirty:0, pull:0, push:0, risk:['API Error'], ready:false, activity, lastCommit:e.message, commitWarning:'Failed to sync.' };
    }
  }

  async function getLocalRepo(repoPath) {
    if (!fs.existsSync(path.join(repoPath, '.git'))) return null;
    const branch = await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath) || 'main';

    const statusStr = await git(['status', '--short'], repoPath);
    const dirty = statusStr.split('\n').filter(Boolean).length;

    // Throttle fetch so the polling getRepos isn't a fetch storm per repo.
    const now = Date.now();
    if (now - (lastFetchByPath.get(repoPath) || 0) > FETCH_THROTTLE_MS) {
      await git(['fetch', '--quiet', '--no-tags'], repoPath);
      lastFetchByPath.set(repoPath, now);
    }
    const pull = parseInt(await git(['rev-list', '--count', 'HEAD..@{u}'], repoPath)) || 0;
    const push = parseInt(await git(['rev-list', '--count', '@{u}..HEAD'], repoPath)) || 0;

    const risk = [];
    if (statusStr.includes('.env')) risk.push('Exposed .env');
    if (statusStr.includes('node_modules/')) risk.push('Exposed node_modules');
    if (statusStr.includes('.pem') || statusStr.includes('.key')) risk.push('Exposed Keys');

    const ready = fs.existsSync(path.join(repoPath, 'README.md')) && fs.existsSync(path.join(repoPath, 'LICENSE'));

    const lastCommit = await git(['log', '-1', '--pretty=%B'], repoPath) || 'No commits';
    const commitWarning = classifyCommitMessage(lastCommit).warning;

    // Real 14-day activity (local-day buckets) — replaces the old Math.random sparkline.
    const logOut = await git(['log', '--since=14 days ago', '--pretty=%cd', '--date=format-local:%Y-%m-%d'], repoPath);
    const activity = bucketCommitDates(logOut ? logOut.split('\n').filter(Boolean) : [], 14, todayISO());

    return { type: 'local', path: repoPath, name: path.basename(repoPath), branch, dirty, pull, push, risk, ready, activity, lastCommit, commitWarning };
  }

  ipcMain.handle('git:getRepos', async () => {
    const cfg = loadCfg();
    const results = await mapPool(cfg.repos, 4, async (entry) => {
      if (entry.type === 'local') return getLocalRepo(entry.path);
      if (entry.type === 'remote') return getRemoteRepo(entry);
      return null;
    });
    return results.filter(Boolean);
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

  // Bounded-depth async walk for local git repos. Skips symlinks/junctions and known
  // heavy dirs, stops descending at a repo root, and caps total dirs visited.
  async function runAutoScan(onProgress) {
    const cfg = loadCfg();
    const known = new Set(cfg.repos.filter(r => r.type === 'local').map(r => r.path));
    const found = [];
    let scanned = 0;
    const queue = scanRootsFrom(cfg).filter(r => fs.existsSync(r)).map(dir => ({ dir, depth: 0 }));

    while (queue.length && scanned < MAX_VISITED) {
      const { dir, depth } = queue.shift();
      scanned++;
      let entries;
      try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); }
      catch { continue; }

      if (entries.some(e => e.name === '.git')) {
        // dir is a repo root (covers worktree .git files too): record, don't descend.
        if (!known.has(dir)) { known.add(dir); found.push(dir); }
      } else if (depth < MAX_DEPTH) {
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          if (typeof e.isSymbolicLink === 'function' && e.isSymbolicLink()) continue;
          if (SKIP_DIRS.has(e.name.toLowerCase())) continue;
          queue.push({ dir: path.join(dir, e.name), depth: depth + 1 });
        }
      }
      if (onProgress && scanned % 50 === 0) onProgress({ dir, found: found.length, scanned });
    }

    if (found.length) {
      for (const p of found) {
        if (!cfg.repos.find(r => r.type === 'local' && r.path === p)) cfg.repos.push({ type: 'local', path: p });
      }
      saveCfg(cfg);
    }
    return { ok: true, found, scanned };
  }

  ipcMain.handle('git:autoScan', async (event) => {
    return runAutoScan((p) => { try { event.sender.send('git:scanProgress', p); } catch {} });
  });

  ipcMain.handle('git:getScanRoots', async () => scanRootsFrom(loadCfg()));

  ipcMain.handle('git:addScanRoot', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Select a folder to scan for repositories', properties: ['openDirectory'] });
    if (canceled || !filePaths.length) return null;
    const cfg = loadCfg();
    const roots = scanRootsFrom(cfg).slice();
    if (!roots.includes(filePaths[0])) roots.push(filePaths[0]);
    cfg.scanRoots = roots;
    saveCfg(cfg);
    return { ok: true, scanRoots: roots };
  });

  ipcMain.handle('git:removeScanRoot', async (event, p) => {
    const cfg = loadCfg();
    cfg.scanRoots = scanRootsFrom(cfg).filter(r => r !== p);
    saveCfg(cfg);
    return { ok: true, scanRoots: cfg.scanRoots };
  });

  ipcMain.handle('git:addGithubRepo', async (event, url, token) => {
    try {
      const parsed = parseGithubUrl(url);
      if (!parsed) return { error: 'Must be a valid GitHub URL' };
      const cfg = loadCfg();
      const safeToken = encryptToken(token);

      if (!cfg.repos.find(r => r.type === 'remote' && r.url === parsed.url)) {
        cfg.repos.push({ type: 'remote', url: parsed.url, match: parsed.slug, token: safeToken });
        saveCfg(cfg);
        if (token && !safeToken) return { ok: true, warning: 'Token not stored: secure storage is unavailable on this system.' };
        return { ok: true };
      }
      return { error: 'Repository already added' };
    } catch(e) {
      return { error: e.message };
    }
  });

  // Real commit message via Claude when an API key is configured (opt-in, user-triggered
  // only). Runs in MAIN (packaged CSP blocks renderer egress). Returns null so the caller
  // falls back to the heuristic on no-key / SDK-missing / any API error.
  async function aiCommitMessage(repoPath, diffStr) {
    if (!aiStore.getKey()) return null;
    const subjects = await git(['log', '-5', '--pretty=%s'], repoPath);
    const cappedDiff = capDiff(diffStr, 30000, 8000) || '(empty)';
    // Shared MAIN-side helper (SDK setup + error→null fallback + result cache).
    return aiComplete.completeText({
      feature: 'commit',
      maxTokens: 200,
      cacheKey: cappedDiff,
      system: 'You are a senior engineer writing a git commit message. Given a diff and the repo\'s recent commit subjects (for style reference only), write ONE concise message in Conventional Commits style (e.g. "feat: ...", "fix: ...", "refactor: ..."). Output ONLY the message — no quotes, no preamble, no body. Keep the subject under ~72 characters.',
      user: `Recent commit subjects (style reference):\n${subjects || '(none)'}\n\nDiff:\n${cappedDiff}`,
    });
  }

  ipcMain.handle('git:generateCommit', async (event, p) => {
    let diffStr = await git(['diff', 'HEAD'], p);
    if (!diffStr) diffStr = await git(['diff', '--cached'], p);
    if (!diffStr) return 'chore: minor updates and cleanup';

    const ai = await aiCommitMessage(p, diffStr);
    return ai || heuristicCommit(diffStr);
  });

  // Exposed so main.js can trigger a quiet auto-scan at startup when enabled.
  return { runAutoScan };
};
