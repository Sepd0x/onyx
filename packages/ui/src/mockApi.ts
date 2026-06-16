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
  lastCommitMeta: { hash: 'a1b2c3d', author: 'Sepd0x', relative: '2 hours ago', subject: 'feat: premium overhaul — multi-provider AI' },
  dirtyFiles: [
    { status: 'M', file: 'src/App.tsx' },
    { status: '??', file: '.env' },
    { status: 'M', file: 'package.json' },
    { status: 'A', file: 'src/views/GitView.tsx' },
  ],
  branches: ['main', 'dev', 'feat/git-pulse'],
  lastFetched: Date.now() - 120000,
  remote: {
    slug: 'Sepd0x/onyx',
    url: 'https://github.com/Sepd0x/onyx',
    branch: 'main',
    openIssues: 3,
    openPRs: 1,
    lastCommit: 'feat: premium overhaul — multi-provider AI',
    lastCommitAuthor: 'Sepd0x',
    lastCommitDate: new Date(Date.now() - 3 * 3600000).toISOString(),
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

// Canned AI outputs for the browser mock, shared by the one-shot and streaming paths.
const AI_DEMO: Record<string, string> = {
  'ai:briefing': 'Repos:\n• onyx — a .env file is tracked (security risk): add it to .gitignore now.\n• onyx — 4 uncommitted files + 2 unpushed commits: commit & push before they grow stale.\n• Focus-Tools — 2 commits behind origin: pull to avoid a divergent history.\nProcesses & power:\n• 2 dev servers running (claude.exe, code.exe) — guard them so the machine stays awake.\n• On AC in Balanced mode — sensible for this workload.\nLog:\n• A few startup "Invalid IPC channel" warnings; harmless but worth ordering. Otherwise healthy.',
  'ai:insights': '• onyx-core: 4 uncommitted files and 2 unpushed commits — commit & push before they grow stale.\n• onyx-core: a .env file is tracked as a risk — add it to .gitignore.\n• Focus-Tools: 2 commits behind origin — pull to avoid a divergent history.\n• 2 dev servers (claude.exe, code.exe) are running — guard them in Session Guard so the machine stays awake.',
  'ai:explainPower': 'You are on AC power in Balanced mode. The auto-planner switched to Battery Saver twice earlier when unplugged, then restored Balanced on reconnect — exactly the intended conservative behaviour. Nothing here needs changing for a laptop dev workload.',
  'ai:analyzeLogs': '• Repeated "Invalid IPC channel" warnings around startup — likely a renderer calling a channel before the handler registered; harmless but worth ordering. \n• One unhandled promise rejection in the updater check — wrap the network call. \n• Otherwise the logs look healthy.',
};
const AI_FEATURE_CHANNEL: Record<string, string> = {
  briefing: 'ai:briefing', insights: 'ai:insights', power: 'ai:explainPower', logs: 'ai:analyzeLogs',
};

class MockApi {
  private config: any = { launchOnStartup: false, startMinimized: false, autoHideCursorOnStart: false, autoScanGit: true, enableAIFeatures: true, enableTrayDashboard: true, enableGlobalHotkey: true, enableNotifications: true, enableAnimations: true, onboarded: true, appVersion: 'dev' };
  private cursorConfig: any = { seconds: 5, deadzone: 4, active: false, dim: false, dnd: false };
  private repos: any[] = [
    { name: 'onyx-core', branch: 'main', dirty: 4, pull: 0, push: 2, path: 'C:/dev/onyx-core', activity: [0,1,0,3,5,0,2,1,0,4,2,0,1,3], risk: ['Contains .env'], ready: true, commitWarning: null, lastCommitMeta: { hash: '9f3e2a1', author: 'Sepd0x', relative: '5 hours ago', subject: 'refactor: extract shared config helper' }, dirtyFiles: [{ status: 'M', file: 'src/main.js' }, { status: '??', file: '.env' }, { status: 'M', file: 'package.json' }, { status: 'D', file: 'old.js' }], branches: ['main', 'dev'], lastFetched: Date.now() - 600000 },
    { name: 'Focus-Tools', branch: 'dev', dirty: 0, pull: 2, push: 0, path: 'C:/dev/focus', activity: [0,0,1,0,0,0,0,0,2,0,0,1,0,0], risk: [], ready: true, commitWarning: null, lastCommitMeta: { hash: '4c8d0b2', author: 'Sepd0x', relative: 'yesterday', subject: 'feat: pomodoro timer' }, dirtyFiles: [], branches: ['main', 'dev'], lastFetched: Date.now() - 3600000 }
  ];
  private demo = false;
  private listeners: Record<string, Function[]> = {};
  private watchedProcesses: any[] = [];
  private cleanerDirs: { path: string; name: string; kind: string; bytes: number }[] = [
    { path: '~/Projects/old-react-app/node_modules', name: 'node_modules', kind: 'Node', bytes: 340 * 1024 * 1024 },
    { path: '~/Documents/GitHub/test-repo/node_modules', name: 'node_modules', kind: 'Node', bytes: 512 * 1024 * 1024 },
    { path: '~/dev/rust-cli/target', name: 'target', kind: 'Rust / Java', bytes: 890 * 1024 * 1024 },
    { path: '~/Projects/next-site/.next', name: '.next', kind: 'Next.js', bytes: 210 * 1024 * 1024 },
    { path: '~/dev/py-svc/__pycache__', name: '__pycache__', kind: 'Python', bytes: 18 * 1024 * 1024 },
    { path: '~/Desktop/temp-js/dist', name: 'dist', kind: 'Build output', bytes: 64 * 1024 * 1024 },
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

  // Track listeners so the mock can push events (e.g. ai:streamDelta) like the real
  // bridge; returns an unsubscribe to mirror the preload contract.
  on(channel: string, listener: (...args: any[]) => void) {
    (this.listeners[channel] ||= []).push(listener);
    return () => { this.listeners[channel] = (this.listeners[channel] || []).filter(l => l !== listener); };
  }
  private emit(channel: string, payload: any) {
    (this.listeners[channel] || []).forEach(l => { try { l(payload); } catch {} });
  }

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
          { port: '3000', process: 'node', pid: '1234', ppid: '600', path: 'C:\\Program Files\\nodejs\\node.exe', local: '0.0.0.0:3000', remote: '0.0.0.0:0', state: 'LISTENING', proto: 'TCP', ipv6: false, cpu: '-', ram: '120 MB' },
          { port: '54880', process: 'node', pid: '1234', ppid: '600', path: 'C:\\Program Files\\nodejs\\node.exe', local: '127.0.0.1:54880', remote: '104.18.32.7:443', state: 'ESTABLISHED', proto: 'TCP', ipv6: false, cpu: '-', ram: '120 MB' },
          { port: '5432', process: 'postgres', pid: '5678', ppid: '700', path: 'C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe', local: '127.0.0.1:5432', remote: '0.0.0.0:0', state: 'LISTENING', proto: 'TCP', ipv6: false, cpu: '-', ram: '80 MB' },
          { port: '5173', process: 'vite', pid: '8910', ppid: '1234', path: 'C:\\Program Files\\nodejs\\node.exe', local: '127.0.0.1:5173', remote: '0.0.0.0:0', state: 'LISTENING', proto: 'TCP', ipv6: false, cpu: '-', ram: '65 MB' },
          { port: '5353', process: 'svchost', pid: '2200', ppid: '1', path: null, local: '0.0.0.0:5353', remote: '*:*', state: 'UDP', proto: 'UDP', ipv6: false, cpu: '-', ram: '8 MB' },
          { port: '443', process: 'System', pid: '4', ppid: '0', path: null, local: '[::]:443', remote: '[::]:0', state: 'LISTENING', proto: 'TCP', ipv6: true, cpu: '-', ram: null }
        ];
      case 'ports:kill':
        console.log('Killed PID: ', args[0]);
        return true;
        
      case 'app:getStats':
        return {
          cpu: Math.floor(Math.random() * 20 + 5) + '%',
          ram: (Math.random() * 2 + 4).toFixed(1) + 'GB'
        };
      case 'app:checkForUpdates':
        return { state: 'dev', message: 'Updates are disabled in development builds.' };
      case 'app:downloadUpdate':
        return { ok: false };
      case 'settings:export': {
        // No native save dialog in the browser — trigger a real file download so
        // the preview is genuinely functional.
        try {
          const payload = { onyx: 'onyx-settings-backup', version: 1, ...(args[0] || {}) };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'onyx-settings-backup.json';
          a.click();
          URL.revokeObjectURL(a.href);
        } catch {}
        return { ok: true, path: 'onyx-settings-backup.json' };
      }
      case 'settings:import':
        // No native open dialog in the browser preview.
        return { canceled: true };
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
        const dirs = this.cleanerDirs.map(d => ({ path: d.path, name: d.name, kind: d.kind, size: this.fmtSize(d.bytes), bytes: d.bytes }));
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
        // Mirror the real dev:status shape ({id, type, target, name, procName, respawns}).
        this.watchedProcesses.push({ id: Math.random().toString(), type: args[0].type, target: args[0].target, name: args[0].name || 'Process', procName: args[0].name || null, respawns: 0 });
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
        
      case 'power:getBatteryHealth':
        // Mirrors parseBatteryHealth's shape (a worn Lenovo laptop, for the demo).
        return { manufacturer: 'LENOVO', model: 'ThinkPad X1 Carbon', vendor: 'lenovo', vendorApp: 'Lenovo Vantage', canControlChargeLimit: false, designCapacity: 57000, fullCapacity: 49100, wearPct: 14, healthPct: 86, hasBattery: true };
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
        
      case 'ai:getStatus': {
        // Mirror the real backend shape (providers[] + active provider) so the
        // onboarding AI step and Settings render the same way in the browser mock.
        const configured = this.demo || localStorage.getItem('onyx-ai-configured') === '1';
        const provider = localStorage.getItem('onyx-ai-provider') || 'anthropic';
        const providerMeta = [
          { key: 'anthropic', label: 'Anthropic (Claude)', placeholder: 'sk-ant-...', keyUrl: 'console.anthropic.com', defaultModel: 'claude-haiku-4-5', presets: ['claude-haiku-4-5', 'claude-sonnet-4-6'] },
          { key: 'openai', label: 'OpenAI (ChatGPT)', placeholder: 'sk-...', keyUrl: 'platform.openai.com/api-keys', defaultModel: 'gpt-4o-mini', presets: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'] },
          { key: 'google', label: 'Google (Gemini)', placeholder: 'AIza...', keyUrl: 'aistudio.google.com/app/apikey', defaultModel: 'gemini-2.5-flash', presets: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] },
        ];
        return {
          provider,
          configured,
          encryptionAvailable: true,
          model: 'claude-haiku-4-5',
          providers: providerMeta.map((m) => ({ ...m, configured: configured && m.key === provider, model: m.defaultModel })),
        };
      }
      case 'ai:setProvider':
        localStorage.setItem('onyx-ai-provider', typeof args[0] === 'string' ? args[0] : 'anthropic');
        return { ok: true };
      case 'ai:setModel':
        return { ok: true };
      case 'ai:test':
        return { ok: this.demo || localStorage.getItem('onyx-ai-configured') === '1', error: 'no-key' };
      case 'ai:setKey': {
        // Never store a real key in the browser mock — just track configured state.
        const has = typeof args[0] === 'string' && args[0].trim().length > 0;
        if (has) localStorage.setItem('onyx-ai-configured', '1');
        else localStorage.removeItem('onyx-ai-configured');
        return { ok: true, configured: has, encryptionAvailable: true };
      }
      case 'ai:briefing':
      case 'ai:insights':
      case 'ai:explainPower':
      case 'ai:analyzeLogs': {
        // Browser mock has no real model; gate on the same configured flag and
        // return a canned briefing so the result UI can be exercised in dev.
        await delay(900);
        if (!this.demo && localStorage.getItem('onyx-ai-configured') !== '1') return { error: 'no-key' };
        return { text: AI_DEMO[channel], usage: { input: 1200, output: 180 }, cached: false };
      }
      case 'ai:stream': {
        // Simulate token streaming: emit ai:streamDelta chunks, then resolve final.
        const { id, feature } = args[0] || {};
        if (!this.demo && localStorage.getItem('onyx-ai-configured') !== '1') return { error: 'no-key' };
        const full = AI_DEMO[AI_FEATURE_CHANNEL[feature] || 'ai:insights'] || '';
        const chunks = full.match(/\S+\s*/g) || [full];
        for (let i = 0; i < chunks.length; i++) {
          setTimeout(() => this.emit('ai:streamDelta', { id, delta: chunks[i] }), 22 * i);
        }
        await delay(22 * chunks.length + 120);
        return { text: full, usage: { input: 1200, output: 180 }, cached: false };
      }

      case 'app:log':
        return true;

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
