// Encrypted-at-rest store for AI provider credentials (Anthropic / OpenAI / Google).
// Cloned from the gitpulse safeStorage pattern (`v1:` prefix, refuse-to-persist
// when encryption is unavailable). Lives in its OWN ai.json under userData —
// NEVER goes through app:setConfig, which is plaintext and round-trips across the
// context bridge.
//
// Keys NEVER leave the main process: getStatus()/setKey()/setProvider() are the
// only things the renderer can reach; getKey() is main-process-internal (used by
// the AI calls, which also run in main because the packaged CSP blocks renderer
// egress).
const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Supported providers. Each call branches on the active provider in complete.js.
const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', defaultModel: 'claude-haiku-4-5', placeholder: 'sk-ant-...', keyUrl: 'console.anthropic.com',
    presets: ['claude-haiku-4-5', 'claude-sonnet-4-6'] },
  openai: { label: 'OpenAI (ChatGPT)', defaultModel: 'gpt-4o-mini', placeholder: 'sk-...', keyUrl: 'platform.openai.com/api-keys',
    presets: ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4o'] },
  google: { label: 'Google (Gemini)', defaultModel: 'gemini-2.5-flash', placeholder: 'AIza...', keyUrl: 'aistudio.google.com/app/apikey',
    presets: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'] },
};
const DEFAULT_PROVIDER = 'anthropic';
// Back-compat: the previous single-provider model id, still the Anthropic default.
const DEFAULT_MODEL = PROVIDERS.anthropic.defaultModel;

function cfgPath() {
  return path.join(app.getPath('userData'), 'ai.json');
}

function loadConfig() {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); }
  catch { cfg = {}; }
  // Migrate the old single-key shape ({ key, model }) into the new per-provider one.
  if (cfg.key && !cfg.keys) {
    cfg.keys = { anthropic: cfg.key };
    if (cfg.model) cfg.models = { anthropic: cfg.model };
    cfg.provider = 'anthropic';
    delete cfg.key;
    delete cfg.model;
  }
  if (!cfg.keys) cfg.keys = {};
  if (!cfg.models) cfg.models = {};
  if (!PROVIDERS[cfg.provider]) cfg.provider = DEFAULT_PROVIDER;
  return cfg;
}

function saveConfig(cfg) {
  fs.writeFileSync(cfgPath(), JSON.stringify(cfg, null, 2));
}

function encryptionAvailable() {
  try { return !!(safeStorage && safeStorage.isEncryptionAvailable()); }
  catch { return false; }
}

// Encrypt with the OS keychain (DPAPI/Keychain). If unavailable, refuse to persist
// rather than store the key recoverably.
function encryptKey(key) {
  if (!key) return '';
  try {
    if (encryptionAvailable()) return 'v1:' + safeStorage.encryptString(key).toString('base64');
  } catch {}
  return '';
}

function decryptKey(stored) {
  if (!stored || typeof stored !== 'string' || !stored.startsWith('v1:')) return '';
  try { return safeStorage.decryptString(Buffer.from(stored.slice(3), 'base64')); }
  catch { return ''; }
}

function normProvider(p) { return PROVIDERS[p] ? p : DEFAULT_PROVIDER; }

function modelFor(cfg, provider) {
  return (cfg.models && cfg.models[provider]) || PROVIDERS[provider].defaultModel;
}

// Renderer-safe: reports the active provider, whether each provider has a key, and
// the active model — WITHOUT ever returning a key.
function getStatus() {
  const cfg = loadConfig();
  const provider = normProvider(cfg.provider);
  return {
    provider,
    configured: !!decryptKey(cfg.keys[provider]),
    encryptionAvailable: encryptionAvailable(),
    model: modelFor(cfg, provider),
    providers: Object.entries(PROVIDERS).map(([key, meta]) => ({
      key,
      label: meta.label,
      placeholder: meta.placeholder,
      keyUrl: meta.keyUrl,
      configured: !!decryptKey(cfg.keys[key]),
      model: modelFor(cfg, key),
      defaultModel: meta.defaultModel,
      presets: meta.presets || [],
    })),
  };
}

// Override the model for a provider (empty clears back to the provider default).
// Accepts ({ provider, model }) or (model) for the active provider.
function setModel(arg) {
  const cfg = loadConfig();
  let provider = normProvider(cfg.provider);
  let model = '';
  if (arg && typeof arg === 'object') {
    if (arg.provider) provider = normProvider(arg.provider);
    model = typeof arg.model === 'string' ? arg.model : '';
  } else {
    model = typeof arg === 'string' ? arg : '';
  }
  const trimmed = model.trim();
  if (!trimmed) delete cfg.models[provider];
  else cfg.models[provider] = trimmed;
  saveConfig(cfg);
  return getStatus();
}

// Switch the active provider (no key change). Unknown providers fall back to the default.
function setProvider(provider) {
  const cfg = loadConfig();
  cfg.provider = normProvider(provider);
  saveConfig(cfg);
  return getStatus();
}

// Set/clear a key. Accepts (key) for the active provider, or ({ provider, key }).
// Empty/whitespace key clears the stored credential for that provider.
function setKey(arg) {
  const cfg = loadConfig();
  let provider = normProvider(cfg.provider);
  let key = '';
  if (arg && typeof arg === 'object') {
    if (arg.provider) provider = normProvider(arg.provider);
    key = typeof arg.key === 'string' ? arg.key : '';
  } else {
    key = typeof arg === 'string' ? arg : '';
  }
  const trimmed = key.trim();
  if (!trimmed) {
    delete cfg.keys[provider];
    saveConfig(cfg);
    return { ok: true, configured: false, encryptionAvailable: encryptionAvailable() };
  }
  const enc = encryptKey(trimmed);
  if (!enc) {
    return { ok: false, configured: false, encryptionAvailable: encryptionAvailable(), warning: 'Secure storage unavailable on this system; key not stored.' };
  }
  cfg.keys[provider] = enc;
  // Selecting/saving a key for a provider also makes it the active one.
  cfg.provider = provider;
  saveConfig(cfg);
  return { ok: true, configured: true, encryptionAvailable: encryptionAvailable() };
}

// Main-process-internal: the decrypted key + model + provider for outbound AI
// calls. Not exposed via IPC. Returns the credentials for the ACTIVE provider.
function getProvider() { return normProvider(loadConfig().provider); }
function getKey() { const cfg = loadConfig(); return decryptKey(cfg.keys[normProvider(cfg.provider)]); }
function getModel() { const cfg = loadConfig(); return modelFor(cfg, normProvider(cfg.provider)); }

module.exports = { PROVIDERS, DEFAULT_PROVIDER, DEFAULT_MODEL, getStatus, setProvider, setModel, setKey, getProvider, getKey, getModel };
