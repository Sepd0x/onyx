// Emulates the Electron IPC backend for the browser preview
// so it operates fully functional using localStorage.

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Rich seed data for demo mode (?demo=1). Lets the otherwise-empty views show a
// realistic, populated state — used for screenshots and for exercising features
// without real data — while normal dev (no flag) still tests the empty states.
const DEMO_SNIPPETS = [
  { id: 'demo-s1', title: 'Kill port 3000', command: 'npx kill-port 3000' },
  { id: 'demo-s2', title: 'Who owns a port', command: 'netstat -ano | findstr :3000' },
  { id: 'demo-s3', title: 'Nuke node_modules', command: 'Remove-Item -Recurse -Force node_modules' },
  { id: 'demo-s4', title: 'Clear NPM cache', command: 'npm cache clean --force' },
  { id: 'demo-s5', title: 'Recent commits', command: 'git log --oneline -10' },
  { id: 'demo-s6', title: 'Prune merged branches', command: 'git branch --merged | grep -v main | xargs git branch -d' },
];

// A local repo already merged with its GitHub twin (origin slug match) → one card.
const DEMO_UNIFIED = {
  type: 'unified',
  name: 'onyx',
  branch: 'main',
  dirty: 4,
  pull: 0,
  push: 2,
  path: 'C:/dev/onyx',
  activity: [0, 1, 0, 3, 5, 0, 2, 1, 0, 4, 2, 0, 1, 3],
  risk: ['Exposed .env'],
  ready: true,
  commitWarning: null,
  remoteSlug: 'Sepd0x/onyx',
  remote: {
    slug: 'Sepd0x/onyx',
    url: 'https://github.com/Sepd0x/onyx',
    branch: 'main',
    openIssues: 3,
    lastCommit: 'feat: premium overhaul — multi-provider AI',
  },
};

const DEMO_LAUNCHERS = [
  {
    id: 'demo-mern',
    title: 'MERN Stack · storefront',
    commands: [
      { name: 'Frontend', cmd: 'npm run dev', path: 'C:/dev/storefront/web' },
      { name: 'API', cmd: 'npm run start:api', path: 'C:/dev/storefront/api' },
      { name: 'Database', cmd: 'docker compose up db', path: 'C:/dev/storefront' },
    ],
  },
  {
    id: 'demo-docs',
    title: 'Docs site',
    commands: [{ name: 'Docs', cmd: 'npm run docs:dev', path: 'C:/dev/docs' }],
  },
];

class MockApi {
  private config: any = { launchOnStartup: false, startMinimized: false, autoHideCursorOnStart: false, autoScanGit: true, enableAIFeatures: true, enableTrayDashboard: true, enableGlobalHotkey: true, enableNotifications: true, enableAnimations: true, onboarded: true };
  private cursorConfig: any = { seconds: 5, deadzone: 4, active: false, dim: false, dnd: false };
  private repos: any[] = [
    { name: 'onyx-core', branch: 'main', dirty: 4, pull: 0, push: 2, path: 'C:/dev/onyx-core', activity: [0,1,0,3,5,0,2,1,0,4,2,0,1,3], risk: ['Contains .env'], ready: true, commitWarning: null },
    { name: 'Focus-Tools', branch: 'dev', dirty: 0, pull: 2, push: 0, path: 'C:/dev/focus', activity: [0,0,1,0,0,0,0,0,2,0,0,1,0,0], risk: [], ready: true, commitWarning: null }
  ];
  private demo = false;
  private watchedProcesses: any[] = [];
  private cleanerDirs: { path: string; name: string; bytes: number }[] = [
    { path: '~/Projects/old-react-app/node_modules', name: 'node_modules', bytes: 340 * 1024 * 1024 },
    { path: '~/Documents/GitHub/test-repo/node_modules', name: 'node_modules', bytes: 512 * 1024 * 1024 },
    { path: '~/Desktop/temp-js/node_modules', name: 'node_modules', bytes: 120 * 1024 * 1024 },
  ];
  private fmtSize(bytes: number) {
    if (bytes >= 1024 ** 3) return (bytes / 1024 ** 3).toFixed(1) + ' GB';
    return Math.round(bytes / 1024 / 1024) + ' MB';
  }

  constructor() {
    try {
      this.demo = /(?:^|[?&#])demo(?:=1)?(?:&|$|#)/.test(location.search + location.hash);
    } catch {}
    try {
      const savedConfig = localStorage.getItem('onyx-config');
      if (savedConfig) this.config = JSON.parse(savedConfig);

      const savedCursor = localStorage.getItem('onyx-cursor');
      if (savedCursor) this.cursorConfig = JSON.parse(savedCursor);

      const savedRepos = localStorage.getItem('onyx-repos');
      if (savedRepos) this.repos = JSON.parse(savedRepos);
    } catch {}

    if (this.demo) {
      // Two tasks already guarded so Session Guard shows live wake-locks.
      this.watchedProcesses = [
        { id: 'demo-g1', type: 'pid', target: '18420', name: 'vite build · onyx-ui' },
        { id: 'demo-g2', type: 'pid', target: '22107', name: 'next dev · storefront' },
      ];
    }
  }

  private save() {
    localStorage.setItem('onyx-config', JSON.stringify(this.config));
    localStorage.setItem('onyx-cursor', JSON.stringify(this.cursorConfig));
    localStorage.setItem('onyx-repos', JSON.stringify(this.repos));
  }

  private mockScanRoots: string[] = ['C:/dev', 'C:/Users/dev/Projects'];

  // The browser mock has no backend push events; provided so window.api.on is safe.
  // Returns a no-op unsubscribe to mirror the real preload bridge contract.
  on(_channel: string, _listener: (...args: any[]) => void) { return () => {}; }

  async invoke(channel: string, ...args: any[]) {
    await delay(100); // simulate IPC latency

    switch (channel) {
      case 'app:getConfig': return this.config;
      case 'app:setConfig': 
        this.config = { ...this.config, ...args[0] };
        this.save();
        return this.config;
        
      case 'cursor:getConfig': return this.cursorConfig;
      case 'cursor:setConfig':
        this.cursorConfig = { ...this.cursorConfig, ...args[0] };
        this.save();
        return this.cursorConfig;
      case 'cursor:toggle':
        this.cursorConfig.active = !this.cursorConfig.active;
        this.save();
        return this.cursorConfig.active;
        
      case 'git:getRepos': return this.demo ? [DEMO_UNIFIED, ...this.repos] : this.repos;
      case 'git:linkRepo':
      case 'git:unlinkRepo':
        return { ok: true };
      case 'git:aiRepoAction': {
        await delay(900);
        if (!this.demo && localStorage.getItem('onyx-ai-configured') !== '1') return { error: 'no-key' };
        const demoText: Record<string, string> = {
          explain: '• Adds a command palette (Ctrl+K) for view navigation and theme switching.\n• Introduces a demo-data mode in the mock backend for screenshots and testing.\n• Refactors the Git Pulse card to merge a local repo with its GitHub twin.',
          pr: 'Unify a local repo with its GitHub twin in Git Pulse.\n\n## Changes\n- Auto-match by normalising the origin remote against the GitHub slug\n- Manual link / unlink for absent or ambiguous origins, persisted\n- New git:linkRepo / git:unlinkRepo channels across all layers\n- Pure pairRepoCards logic with unit tests',
          history: '• Recent work centres on a premium UX pass: command palette, demo mode, richer screenshots.\n• Git Pulse gained local↔GitHub unification.\n• Session Guard no longer detects Onyx itself.',
        };
        return { text: demoText[args[1]] || demoText.explain, usage: { input: 900, output: 160 }, cached: false };
      }
      case 'git:addRepo':
        const newRepo = { name: 'New-Project-' + Math.floor(Math.random()*100), branch: 'master', dirty: Math.floor(Math.random()*5), pull: 0, push: 0, path: 'C:/dev/new-project', activity: [0,0,0,0,0,0,0,0,0,0,0,0,0,0],risk: [], ready: false };
        this.repos.push(newRepo);
        this.save();
        return { ok: true };
      case 'git:removeRepo':
        this.repos = this.repos.filter(r => r.path !== args[0]);
        this.save();
        return { ok: true };
      case 'git:autoScan': {
        await delay(1200);
        // Exercise the new return shape and surface a freshly "discovered" repo.
        const discovered = 'C:/dev/discovered-app';
        if (!this.repos.find(r => r.path === discovered)) {
          this.repos.push({ name: 'discovered-app', branch: 'main', dirty: 1, pull: 0, push: 0, path: discovered, activity: [0,0,0,0,1,0,2,0,0,3,0,1,0,2], risk: [], ready: true, commitWarning: null });
          this.save();
        }
        return { ok: true, found: [discovered], scanned: 87 };
      }
      case 'git:getScanRoots':
        return this.mockScanRoots;
      case 'git:addScanRoot':
        // No OS folder picker in the browser; append a deterministic sample root.
        const newRoot = 'C:/dev/added-root-' + (this.mockScanRoots.length + 1);
        if (!this.mockScanRoots.includes(newRoot)) this.mockScanRoots.push(newRoot);
        return { ok: true, scanRoots: this.mockScanRoots };
      case 'git:removeScanRoot':
        this.mockScanRoots = this.mockScanRoots.filter(r => r !== args[0]);
        return { ok: true, scanRoots: this.mockScanRoots };
      case 'git:generateCommit':
        await delay(2000);
        const options = [
          "feat: Implement new experimental UI module structure, removing technical debt.",
          "fix: Resolves the IPC event listener memory leak during hot reloads.",
          "refactor: Migrate legacy context states to React signals to boost render performance.",
          "chore: Update npm dependencies and apply security patching for Electron vault."
        ];
        return options[Math.floor(Math.random() * options.length)];

      case 'ports:get':
        return [
          { port: '3000', process: 'node', pid: '1234', local: '0.0.0.0:3000', state: 'LISTENING', proto: 'TCP', cpu: '1.2%', ram: '120MB' },
          { port: '5432', process: 'postgres', pid: '5678', local: '127.0.0.1:5432', state: 'LISTENING', proto: 'TCP', cpu: '0.5%', ram: '80MB' },
          { port: '5173', process: 'vite', pid: '8910', local: '127.0.0.1:5173', state: 'LISTENING', proto: 'TCP', cpu: '2.5%', ram: '65MB' },
          { port: '443', process: 'system', pid: '4', local: '0.0.0.0:443', state: 'LISTEN', proto: 'TCP', cpu: '0.1%', ram: '12MB' }
        ];
      case 'ports:kill':
        console.log('Killed PID: ', args[0]);
        return true;
        
      case 'app:getStats':
        return {
          cpu: Math.floor(Math.random() * 20 + 5) + '%',
          ram: (Math.random() * 2 + 4).toFixed(1) + 'GB'
        };
      case 'tray:openMain':
        console.log('Opened main window from tray dashboard');
        window.location.hash = '';
        return true;
      case 'env:keepAwake':
      case 'env:focusMode':
      case 'window:openExternal':
        console.log('Environment / window mock action:', channel, args);
        return true;
      case 'git:addGithubRepo':
        const rName = args[0]?.match(/github\.com\/([^\/]+)\/([^\/]+)/)?.[2] || 'Imported Repo';
        this.repos.push({ 
           name: rName, 
           branch: 'main', 
           dirty: 0, 
           pull: 2, // Mock slightly out-of-sync for the "Análise de Sincronização" feature 
           push: 0, 
           path: '~/Documents/GitHub/' + rName, // Deteção Repo Remoto -> Local
           activity: [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
           risk: [], 
           ready: true, 
           commitWarning: null,
           syncStatus: 'Outdated' 
        });
        this.save();
        return { ok: true };
      case 'cleaner:scan': {
        await delay(600);
        const dirs = this.cleanerDirs.map(d => ({ path: d.path, name: d.name, size: this.fmtSize(d.bytes) }));
        const total = this.cleanerDirs.reduce((a, d) => a + d.bytes, 0);
        return { dirs, totalSize: this.fmtSize(total) };
      }
      case 'cleaner:delete': {
        // Mirror the real { ok, deleted, rejected, failed } shape AND mutate state so a
        // rescan reflects the deletion (no confirm dialog in the browser preview).
        const targets: string[] = Array.isArray(args[0]) ? args[0] : [];
        const before = this.cleanerDirs.length;
        this.cleanerDirs = this.cleanerDirs.filter(d => !targets.includes(d.path));
        const deleted = before - this.cleanerDirs.length;
        return { ok: true, deleted, rejected: targets.length - deleted, failed: [] };
      }
      case 'snippets:get': {
        // Real backend starts empty — the mock exercises the empty state by
        // default, and a populated shelf under ?demo=1.
        const saved = localStorage.getItem('onyx-snippets');
        if (saved) return JSON.parse(saved);
        return this.demo ? DEMO_SNIPPETS : [];
      }
      case 'snippets:save':
        localStorage.setItem('onyx-snippets', JSON.stringify(args[0]));
        return true;
      case 'launchers:get': {
        const lp = localStorage.getItem('onyx-launchers');
        if (lp) return JSON.parse(lp);
        return this.demo ? DEMO_LAUNCHERS : [];
      }
      case 'launchers:save':
        localStorage.setItem('onyx-launchers', JSON.stringify(args[0]));
        return true;
      case 'launchers:start':
        return { ok: true, started: 1 };
      case 'launchers:stop':
        return { ok: true };
      case 'launchers:status':
        // One profile shown as running in demo mode.
        return this.demo ? ['demo-mern'] : [];
      case 'dev:status':
        return this.watchedProcesses;
      case 'dev:startWatch':
        // Real dev:status returns only {id, type, target, name} — keep the mock identical.
        this.watchedProcesses.push({ id: Math.random().toString(), type: args[0].type, target: args[0].target, name: args[0].name || 'Process' });
        return true;
      case 'dev:stopWatch':
        this.watchedProcesses = this.watchedProcesses.filter(p => p.id !== args[0]);
        return true;
      case 'dev:getDevProcesses':
        // Mirrors the real handler shape: lowercase name, .exe-stripped type, percent confidence.
        return [
          { pid: '8912', name: 'claude.exe', type: 'claude', confidence: '45%' },
          { pid: '4123', name: 'code.exe', type: 'code', confidence: '45%' }
        ];
        
      case 'power:get': {
        // Mirrors the real handler shape (incl. batteryState + config fields).
        const defaults = { activeProfile: 'balanced', aiEnabled: false, events: [{time: new Date().toLocaleTimeString(), type: 'INFO', msg: 'Power Manager initialized.'}], lastUserProfile: 'balanced', autoNotify: true, preserveBrightness: true };
        const lpwr = localStorage.getItem('onyx-power');
        const stored = lpwr ? JSON.parse(lpwr) : {};
        return { ...defaults, ...stored, batteryState: { charging: true } };
      }
      case 'power:setProfile': {
        const curPWR = JSON.parse(localStorage.getItem('onyx-power') || '{"aiEnabled": false, "events": []}');
        // Real handler validates the profile and records lastUserProfile.
        if (['battery_saver', 'balanced', 'performance'].includes(args[0])) {
          curPWR.activeProfile = args[0];
          curPWR.lastUserProfile = args[0];
          curPWR.events.unshift({time: new Date().toLocaleTimeString(), type: 'ACTION', msg: 'User switched power mode to: ' + args[0]});
          localStorage.setItem('onyx-power', JSON.stringify(curPWR));
        }
        return curPWR;
      }
      case 'power:setAI':
        const cp = JSON.parse(localStorage.getItem('onyx-power') || '{"activeProfile": "balanced", "events": []}');
        cp.aiEnabled = args[0];
        cp.events.unshift({time: new Date().toLocaleTimeString(), type: 'AI_TOGGLE', msg: 'AI Dynamic OS Power Planner ' + (args[0] ? 'ENABLED' : 'DISABLED')});
        localStorage.setItem('onyx-power', JSON.stringify(cp));
        return cp;
      case 'power:setConfig': {
        const pc = JSON.parse(localStorage.getItem('onyx-power') || '{"activeProfile": "balanced", "events": []}');
        if (args[0] && typeof args[0] === 'object') {
          if (typeof args[0].autoNotify === 'boolean') pc.autoNotify = args[0].autoNotify;
          if (typeof args[0].preserveBrightness === 'boolean') pc.preserveBrightness = args[0].preserveBrightness;
        }
        localStorage.setItem('onyx-power', JSON.stringify(pc));
        return pc;
      }
        
      case 'ai:getStatus':
        return {
          configured: this.demo || localStorage.getItem('onyx-ai-configured') === '1',
          encryptionAvailable: true,
          model: 'claude-haiku-4-5',
        };
      case 'ai:setKey': {
        // Never store a real key in the browser mock — just track configured state.
        const has = typeof args[0] === 'string' && args[0].trim().length > 0;
        if (has) localStorage.setItem('onyx-ai-configured', '1');
        else localStorage.removeItem('onyx-ai-configured');
        return { ok: true, configured: has, encryptionAvailable: true };
      }
      case 'ai:insights':
      case 'ai:explainPower':
      case 'ai:analyzeLogs': {
        // Browser mock has no real model; gate on the same configured flag and
        // return a canned briefing so the result UI can be exercised in dev.
        await delay(900);
        if (!this.demo && localStorage.getItem('onyx-ai-configured') !== '1') return { error: 'no-key' };
        const demo: Record<string, string> = {
          'ai:insights': '• onyx-core: 4 uncommitted files and 2 unpushed commits — commit & push before they grow stale.\n• onyx-core: a .env file is tracked as a risk — add it to .gitignore.\n• Focus-Tools: 2 commits behind origin — pull to avoid a divergent history.\n• 2 dev servers (claude.exe, code.exe) are running — guard them in Session Guard so the machine stays awake.',
          'ai:explainPower': 'You are on AC power in Balanced mode. The auto-planner switched to Battery Saver twice earlier when unplugged, then restored Balanced on reconnect — exactly the intended conservative behaviour. Nothing here needs changing for a laptop dev workload.',
          'ai:analyzeLogs': '• Repeated "Invalid IPC channel" warnings around startup — likely a renderer calling a channel before the handler registered; harmless but worth ordering. \n• One unhandled promise rejection in the updater check — wrap the network call. \n• Otherwise the logs look healthy.',
        };
        return { text: demo[channel], usage: { input: 1200, output: 180 }, cached: false };
      }

      case 'app:notify':
        if (this.config.enableNotifications !== false) {
           window.dispatchEvent(new CustomEvent('mock-event', {detail: {type: 'notification', title: args[0].title, body: args[0].body}}));
        }
        return true;

      case 'window:minimize':
      case 'window:close':
        console.log('Window action: ', channel);
        return true;
        
      default:
        console.warn('Unhandled mock IPC:', channel);
        return null;
    }
  }
}

export function injectMockApi() {
  if (!(window as any).api) {
    (window as any).api = new MockApi();
    console.log('Mock API injected. App is now fully functional in browser.');
  }
}
