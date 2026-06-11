// Emulates the Electron IPC backend for the browser preview
// so it operates fully functional using localStorage.

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

class MockApi {
  private config: any = { launchOnStartup: false, startMinimized: false, autoHideCursorOnStart: false, autoScanGit: true, enableAIFeatures: true, enableTrayDashboard: true, enableGlobalHotkey: true, enableNotifications: true, enableAnimations: true };
  private cursorConfig: any = { seconds: 5, deadzone: 4, active: false, dim: false, dnd: false };
  private repos: any[] = [
    { name: 'onyx-core', branch: 'main', dirty: 4, pull: 0, push: 2, path: 'C:/dev/onyx-core', activity: [0,1,0,3,5,0,2], risk: ['Contains .env'], ready: true, commitWarning: null },
    { name: 'Focus-Tools', branch: 'dev', dirty: 0, pull: 2, push: 0, path: 'C:/dev/focus', activity: [0,0,1,0,0,0,0], risk: [], ready: true, commitWarning: null }
  ];
  private watchedProcesses: any[] = [];
  
  constructor() {
    try {
      const savedConfig = localStorage.getItem('onyx-config');
      if (savedConfig) this.config = JSON.parse(savedConfig);
      
      const savedCursor = localStorage.getItem('onyx-cursor');
      if (savedCursor) this.cursorConfig = JSON.parse(savedCursor);
      
      const savedRepos = localStorage.getItem('onyx-repos');
      if (savedRepos) this.repos = JSON.parse(savedRepos);
    } catch {}
  }

  private save() {
    localStorage.setItem('onyx-config', JSON.stringify(this.config));
    localStorage.setItem('onyx-cursor', JSON.stringify(this.cursorConfig));
    localStorage.setItem('onyx-repos', JSON.stringify(this.repos));
  }

  // The browser mock has no backend push events; provided so window.api.on is safe.
  on(_channel: string, _listener: (...args: any[]) => void) {}

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
        
      case 'git:getRepos': return this.repos;
      case 'git:addRepo':
        const newRepo = { name: 'New-Project-' + Math.floor(Math.random()*100), branch: 'master', dirty: Math.floor(Math.random()*5), pull: 0, push: 0, path: 'C:/dev/new-project', activity: [0,0,0,0,0,0,0], risk: [], ready: false };
        this.repos.push(newRepo);
        this.save();
        return { ok: true };
      case 'git:removeRepo':
        this.repos = this.repos.filter(r => r.path !== args[0]);
        this.save();
        return { ok: true };
      case 'git:autoScan':
        await delay(1500);
        return { ok: true };
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
           activity: [0,0,0,0,0,0,0], 
           risk: [], 
           ready: true, 
           commitWarning: null,
           syncStatus: 'Outdated' 
        });
        this.save();
        return { ok: true };
      case 'cleaner:scan':
        return {
          dirs: [
            { path: '~/Projects/old-react-app/node_modules', size: '340 MB' },
            { path: '~/Documents/GitHub/test-repo/node_modules', size: '512 MB' },
            { path: '~/Desktop/temp-js/node_modules', size: '120 MB' }
          ],
          totalSize: '972 MB'
        };
      case 'cleaner:delete':
        return true;
      case 'snippets:get':
        const saved = localStorage.getItem('onyx-snippets');
        if (saved) return JSON.parse(saved);
        return [
          { id: '1', title: 'Clear NPM Cache', command: 'npm cache clean --force' },
          { id: '2', title: 'Kill Port 3000', command: 'npx kill-port 3000' }
        ];
      case 'snippets:save':
        localStorage.setItem('onyx-snippets', JSON.stringify(args[0]));
        return true;
      case 'launchers:get':
        const lp = localStorage.getItem('onyx-launchers');
        if (lp) return JSON.parse(lp);
        return [{ id: '1', title: 'Start Fullstack', commands: [{name: 'Backend', cmd: 'node index.js', path: './server'}] }];
      case 'launchers:save':
        localStorage.setItem('onyx-launchers', JSON.stringify(args[0]));
        return true;
      case 'launchers:start':
        return { ok: true, started: 1 };
      case 'launchers:stop':
        return { ok: true };
      case 'launchers:status':
        return [];
      case 'dev:status':
        return this.watchedProcesses;
      case 'dev:startWatch':
        this.watchedProcesses.push({ id: Math.random().toString(), type: args[0].type, target: args[0].target, name: args[0].name || 'Process', aiError: null, crash: false });
        return true;
      case 'dev:heal':
        const proc = this.watchedProcesses.find(p => p.id === args[0]);
        if (proc) {
           proc.aiError = null;
           proc.crash = false;
        }
        return true;
      case 'dev:stopWatch':
        this.watchedProcesses = this.watchedProcesses.filter(p => p.id !== args[0]);
        return true;
      case 'dev:getDevProcesses':
        return [
          { pid: '8912', name: 'claude.exe', type: 'claude' },
          { pid: '4123', name: 'Code.exe', type: 'code'}
        ];
        
      case 'power:get':
        const lpwr = localStorage.getItem('onyx-power');
        if (lpwr) return JSON.parse(lpwr);
        return { activeProfile: 'balanced', aiEnabled: false, events: [{time: new Date().toLocaleTimeString(), type: 'INFO', msg: 'Power Manager initialized.'}] };
      case 'power:setProfile':
        const curPWR = JSON.parse(localStorage.getItem('onyx-power') || '{"aiEnabled": false, "events": []}');
        curPWR.activeProfile = args[0];
        curPWR.events.unshift({time: new Date().toLocaleTimeString(), type: 'ACTION', msg: 'Profile switched to: ' + args[0]});
        localStorage.setItem('onyx-power', JSON.stringify(curPWR));
        return curPWR;
      case 'power:setAI':
        const cp = JSON.parse(localStorage.getItem('onyx-power') || '{"activeProfile": "balanced", "events": []}');
        cp.aiEnabled = args[0];
        cp.events.unshift({time: new Date().toLocaleTimeString(), type: 'AI_TOGGLE', msg: 'AI Dynamic OS Power Planner ' + (args[0] ? 'ENABLED' : 'DISABLED')});
        localStorage.setItem('onyx-power', JSON.stringify(cp));
        return cp;
      case 'power:mockAIEvent':
        const cmock = JSON.parse(localStorage.getItem('onyx-power') || '{"activeProfile": "balanced", "events": [], "aiEnabled": true}');
        if (cmock.aiEnabled) {
             const profiles = ['battery_saver', 'balanced', 'performance'];
             const reasons = ['Detected unplugged + compiler running', 'Cable connected', 'Inactivity detected', 'High CPU load detected on IDE'];
             const nextProfile = profiles[Math.floor(Math.random()*profiles.length)];
             const reason = reasons[Math.floor(Math.random()*reasons.length)];
             cmock.activeProfile = nextProfile;
             cmock.events.unshift({time: new Date().toLocaleTimeString(), type: 'AI_AGENT', msg: `AI moved OS to ${nextProfile} (${reason})`});
             localStorage.setItem('onyx-power', JSON.stringify(cmock));
             
             // Trigger global notification event directly for mock preview
             window.dispatchEvent(new CustomEvent('mock-event', {detail: {type: 'notification', title: 'Onyx Power Planner', body: `Adjusted OS power to ${nextProfile.replace('_', ' ').toUpperCase()}: ${reason}`}}));
        }
        return cmock;
        
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
