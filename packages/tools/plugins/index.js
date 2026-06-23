const { app, ipcMain, dialog, BrowserWindow, Notification, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const logger = require('../../core/src/logger');
const { loadBundle, canInvoke, narrowGrant, SIG_NAME } = require('./registry');
const { buildHost } = require('./host');
const { ONYX_PLUGIN_PUBLIC_KEY } = require('../../core/src/plugins/public-key');

// Plugin runtime (Fase 2). Loads owner-signed plugins from userData/plugins/<id>/, each
// holding manifest.json + onyx.sig + its files. Every bundle is signature-verified
// against the bundled public key BEFORE a single line of its code is required — an
// unsigned, tampered, or foreign-signed bundle never loads (fail closed). Verified
// plugins run in the main process (the signature is the trust root); the host API they
// receive is scoped to the capabilities the user granted. Per-plugin state (enabled +
// granted permissions) persists in plugins-state.json.

module.exports = function initPlugins(opts) {
  const o = opts || {};
  const getConfig = o.getConfig || (() => ({}));
  const appVersion = o.appVersion || (app.getVersion ? app.getVersion() : 'dev');
  const publicKey = o.publicKey != null ? o.publicKey : ONYX_PLUGIN_PUBLIC_KEY;
  const baseDir = o.dir || path.join(app.getPath('userData'), 'plugins');
  const stateFile = o.stateFile || path.join(app.getPath('userData'), 'plugins-state.json');

  let state = {}; // { [id]: { enabled: boolean, granted: string[] } }
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) || {}; } catch {}
  const saveState = () => { try { fs.writeFileSync(stateFile, JSON.stringify(state)); } catch {} };

  const loaded = new Map(); // id -> { plugin, dir, backend?, handlers?, error? }

  // A bundle the user picked + we verified, awaiting their permission consent. Held in main
  // (never handed to the renderer as a path) so the renderer can't drive an arbitrary copy:
  // it approves an id, and only this pre-verified source for that id is ever installed.
  let pendingInstall = null; // { dir, plugin } | null

  // Read a plugin folder into the shape registry.loadBundle expects (everything but the
  // signature file, plus the signature string itself).
  const readBundle = (dir) => {
    const files = [];
    let signature = '';
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (!fs.statSync(full).isFile()) continue;
      if (name === SIG_NAME) { signature = fs.readFileSync(full, 'utf8').trim(); continue; }
      files.push({ path: name, data: fs.readFileSync(full) });
    }
    return { files, signature };
  };

  // Real implementations behind each capability. buildHost only exposes the ones the
  // plugin both declared and was granted.
  const hostImpl = {
    getConfig: () => getConfig(),
    notify: (title, body) => {
      if (getConfig().enableNotifications === false) return;
      try { new Notification({ title: String(title || ''), body: String(body || '') }).show(); } catch {}
    },
    readClipboard: () => { try { return clipboard.readText(); } catch { return ''; } },
    openExternal: (url) => {
      try { const u = new URL(String(url)); if (u.protocol === 'http:' || u.protocol === 'https:') return shell.openExternal(u.href); } catch {}
      return false;
    },
    fetch: (...a) => (typeof fetch === 'function' ? fetch(...a) : Promise.reject(new Error('no fetch'))),
    // fs:read intentionally not wired yet — declaring it grants nothing until we add a
    // safe, user-scoped reader. The capability stays inert rather than over-broad.
  };

  const grantedFor = (id) => (state[id] && state[id].granted) || [];

  // Require + activate a verified plugin's backend. Isolated in try/catch so a broken
  // plugin can never take down the main process.
  const activate = (rec) => {
    try {
      const backend = require(path.join(rec.dir, rec.plugin.main));
      const host = buildHost(rec.plugin, grantedFor(rec.plugin.id), hostImpl);
      if (typeof backend.activate === 'function') backend.activate(host);
      rec.backend = backend;
      rec.handlers = (backend && backend.handlers) || {};
      rec.error = null;
    } catch (e) {
      logger.error(`Plugin ${rec.plugin.id} failed to activate:`, (e && e.stack) || e);
      rec.error = 'activation failed';
    }
  };

  const loadAll = () => {
    loaded.clear();
    let dirs = [];
    try { dirs = fs.existsSync(baseDir) ? fs.readdirSync(baseDir) : []; } catch {}
    for (const name of dirs) {
      const dir = path.join(baseDir, name);
      try {
        if (!fs.statSync(dir).isDirectory()) continue;
        const { files, signature } = readBundle(dir);
        const res = loadBundle({ files, signature, publicKey, appVersion });
        if (!res.ok) { logger.warn(`Plugin in "${name}" rejected: ${res.error}`); continue; }
        const rec = { plugin: res.plugin, dir };
        loaded.set(res.plugin.id, rec);
        // First time we see a plugin, default to enabled with exactly the permissions it
        // declared (the install-consent UI is where the user trims/approves these).
        if (state[res.plugin.id] == null) state[res.plugin.id] = { enabled: true, granted: res.plugin.permissions };
        if (state[res.plugin.id].enabled !== false) activate(rec);
      } catch (e) { logger.warn(`Plugin in "${name}" failed to load:`, (e && e.message) || e); }
    }
    saveState();
  };

  loadAll();

  const publicView = (rec) => ({
    ...rec.plugin,
    enabled: !(state[rec.plugin.id] && state[rec.plugin.id].enabled === false),
    granted: grantedFor(rec.plugin.id),
    error: rec.error || null,
  });

  // Installed plugins + their manifests, enabled state, and granted permissions.
  ipcMain.handle('plugin:list', () => Array.from(loaded.values()).map(publicView));

  // Step 1 of install — pick a plugin folder and VERIFY it (no copy, no code run). The
  // signature/manifest gate runs here so an unsigned or tampered bundle never even reaches
  // the consent dialog. On success we stash the verified source in `pendingInstall` and hand
  // the renderer only the manifest preview (the permissions it must consent to).
  ipcMain.handle('plugin:pickBundle', async (_e) => {
    const win = BrowserWindow.getFocusedWindow();
    let pick;
    try {
      pick = await dialog.showOpenDialog(win || undefined, {
        title: 'Select a signed Onyx plugin folder',
        properties: ['openDirectory'],
      });
    } catch (e) { logger.error('Plugin pick dialog failed:', e); return { ok: false, error: 'could not open picker' }; }
    if (!pick || pick.canceled || !pick.filePaths || !pick.filePaths[0]) return { ok: false, canceled: true };

    const sourceDir = pick.filePaths[0];
    let res;
    try { const { files, signature } = readBundle(sourceDir); res = loadBundle({ files, signature, publicKey, appVersion }); }
    catch (e) { return { ok: false, error: 'could not read bundle' }; }
    if (!res.ok) return { ok: false, error: res.error };

    pendingInstall = { dir: sourceDir, plugin: res.plugin };
    const p = res.plugin;
    return {
      ok: true,
      preview: {
        id: p.id, name: p.name, version: p.version, description: p.description,
        author: p.author, official: p.official, permissions: p.permissions, channels: p.channels,
        alreadyInstalled: loaded.has(p.id),
      },
    };
  });

  // Step 2 of install — the user consented. Commit ONLY the pending pre-verified source for
  // this exact id, granting at most the permissions it declared (never more). Copying a
  // verified bundle is the only way trusted code reaches userData/plugins.
  ipcMain.handle('plugin:install', (_e, data) => {
    const id = data && data.id;
    if (!pendingInstall || !id || pendingInstall.plugin.id !== id) return { ok: false, error: 'nothing to install' };
    const plugin = pendingInstall.plugin;

    // The renderer can only narrow, never widen: granted ⊆ declared permissions.
    const granted = narrowGrant(plugin.permissions, data && data.granted);

    const dest = path.join(baseDir, plugin.id);
    try {
      fs.mkdirSync(baseDir, { recursive: true });
      fs.rmSync(dest, { recursive: true, force: true });
      if (pendingInstall.dir) {
        // From a local folder (pick-a-bundle): copy the verified source.
        if (!fs.existsSync(pendingInstall.dir)) { pendingInstall = null; return { ok: false, error: 'source no longer available' }; }
        fs.cpSync(pendingInstall.dir, dest, { recursive: true });
      } else if (Array.isArray(pendingInstall.files)) {
        // From the registry: write the pre-verified bytes we downloaded (files + signature).
        // f.path was already validated as a plain filename by loadBundle, so no traversal.
        fs.mkdirSync(dest, { recursive: true });
        for (const f of pendingInstall.files) fs.writeFileSync(path.join(dest, path.basename(f.path)), f.data);
        fs.writeFileSync(path.join(dest, SIG_NAME), pendingInstall.signature);
      } else {
        return { ok: false, error: 'nothing to install' };
      }
    } catch (e) { logger.error('Plugin install write failed:', e); return { ok: false, error: 'install failed' }; }

    // Seed state with exactly what the user approved BEFORE loadAll, so the auto-grant path
    // (first-seen → grant-all) never overrides the user's choice.
    state[plugin.id] = { enabled: true, granted };
    pendingInstall = null;
    loadAll();
    return { ok: true, id: plugin.id };
  });

  // The curated registry — a hardcoded, trusted repo. Never user-supplied (no SSRF), and
  // every download is signature-verified before it touches disk, so even a compromised
  // mirror can't install anything we didn't sign.
  const REGISTRY_RAW = 'https://raw.githubusercontent.com/Sepd0x/onyx-plugins/main';
  const httpText = async (url) => { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); };
  const httpBuf = async (url) => { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error('HTTP ' + r.status); return Buffer.from(await r.arrayBuffer()); };

  // Read-only browse: the list of available plugins + whether each is already installed.
  // Nothing is downloaded or run here.
  ipcMain.handle('plugin:registryList', async () => {
    if (typeof fetch !== 'function') return { ok: false, error: 'network unavailable' };
    try {
      const idx = JSON.parse(await httpText(`${REGISTRY_RAW}/registry.json`));
      const plugins = (Array.isArray(idx.plugins) ? idx.plugins : []).map((p) => ({
        id: p.id, name: p.name, version: p.version, description: p.description, author: p.author,
        official: !!p.official, permissions: Array.isArray(p.permissions) ? p.permissions : [],
        installed: loaded.has(p.id),
      }));
      return { ok: true, plugins };
    } catch (e) { logger.warn('Registry list failed:', (e && e.message) || e); return { ok: false, error: 'could not reach the registry' }; }
  });

  // Download a registry plugin's bundle and VERIFY it (no install yet) — the same gate as
  // the folder picker. On success, stash the verified bytes as pendingInstall and return the
  // preview for the consent modal. A bad signature never reaches install.
  ipcMain.handle('plugin:registryPreview', async (_e, data) => {
    const id = data && data.id;
    if (typeof fetch !== 'function') return { ok: false, error: 'network unavailable' };
    let entry;
    try {
      const idx = JSON.parse(await httpText(`${REGISTRY_RAW}/registry.json`));
      entry = (Array.isArray(idx.plugins) ? idx.plugins : []).find((p) => p && p.id === id);
    } catch { return { ok: false, error: 'could not reach the registry' }; }
    if (!entry || typeof entry.path !== 'string') return { ok: false, error: 'plugin not in registry' };
    // Hard-bound the path to the registry's plugins/ tree — no traversal, no absolute URLs.
    const base = entry.path.replace(/^\/+|\/+$/g, '');
    if (!/^plugins\/[a-z0-9][a-z0-9._-]*$/i.test(base)) return { ok: false, error: 'bad registry path' };

    let manifestText, signature;
    try {
      manifestText = await httpText(`${REGISTRY_RAW}/${base}/manifest.json`);
      signature = (await httpText(`${REGISTRY_RAW}/${base}/${SIG_NAME}`)).trim();
    } catch { return { ok: false, error: 'could not download the plugin' }; }

    let manifest;
    try { manifest = JSON.parse(manifestText); } catch { return { ok: false, error: 'invalid manifest in registry' }; }

    const files = [{ path: 'manifest.json', data: Buffer.from(manifestText) }];
    // Fetch exactly the files the manifest references (plain filenames only).
    const refs = [manifest.main, manifest.ui].filter((f) => typeof f === 'string' && /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(f));
    for (const fn of refs) {
      try { files.push({ path: fn, data: await httpBuf(`${REGISTRY_RAW}/${base}/${fn}`) }); }
      catch { return { ok: false, error: `could not download ${fn}` }; }
    }

    const res = loadBundle({ files, signature, publicKey, appVersion });
    if (!res.ok) return { ok: false, error: res.error };

    pendingInstall = { files, signature, plugin: res.plugin };
    const p = res.plugin;
    return {
      ok: true,
      preview: {
        id: p.id, name: p.name, version: p.version, description: p.description,
        author: p.author, official: p.official, permissions: p.permissions, channels: p.channels,
        alreadyInstalled: loaded.has(p.id),
      },
    };
  });

  ipcMain.handle('plugin:setEnabled', (_e, data) => {
    const id = data && data.id;
    const enabled = !!(data && data.enabled);
    const rec = loaded.get(id);
    if (!rec) return false;
    state[id] = { granted: grantedFor(id).length ? grantedFor(id) : rec.plugin.permissions, enabled };
    saveState();
    if (enabled && !rec.backend) activate(rec);
    return true;
  });

  // The one channel plugins are reached through. Gated: installed → enabled → method
  // declared → handler exists. The renderer can never reach plugin code any other way.
  ipcMain.handle('plugin:invoke', async (_e, data) => {
    const id = data && data.id;
    const method = data && data.method;
    const rec = loaded.get(id);
    const enabled = !(state[id] && state[id].enabled === false);
    if (!canInvoke(rec && rec.plugin, method, enabled)) return { ok: false, error: 'not allowed' };
    if (!rec.handlers || typeof rec.handlers[method] !== 'function') return { ok: false, error: 'no handler' };
    try { return { ok: true, result: await rec.handlers[method](data && data.args) }; }
    catch (e) { logger.error(`Plugin ${id}.${method} threw:`, (e && e.message) || e); return { ok: false, error: 'handler error' }; }
  });

  ipcMain.handle('plugin:uninstall', (_e, data) => {
    const id = data && data.id;
    const rec = loaded.get(id);
    if (!rec) return false;
    try { fs.rmSync(rec.dir, { recursive: true, force: true }); } catch (e) { logger.error('Plugin uninstall failed:', e); }
    loaded.delete(id);
    delete state[id];
    saveState();
    return true;
  });

  return { loadAll, list: () => Array.from(loaded.keys()) };
};
