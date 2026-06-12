// Encrypted-at-rest store for the Anthropic API key, cloned from the gitpulse
// safeStorage pattern (`v1:` prefix, refuse-to-persist when encryption is
// unavailable). Lives in its OWN ai.json under userData — NEVER goes through
// app:setConfig, which is plaintext and round-trips across the context bridge.
//
// The key NEVER leaves the main process: getStatus()/setKey() are the only things
// the renderer can reach; getKey() is main-process-internal (used by the AI calls,
// which also run in main because the packaged CSP blocks renderer egress).
const { app, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const DEFAULT_MODEL = 'claude-haiku-4-5';

function cfgPath() {
  return path.join(app.getPath('userData'), 'ai.json');
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(cfgPath(), 'utf8')); }
  catch { return {}; }
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

// Renderer-safe: reports whether a key is configured WITHOUT ever returning it.
function getStatus() {
  const cfg = loadConfig();
  return {
    configured: !!decryptKey(cfg.key),
    encryptionAvailable: encryptionAvailable(),
    model: cfg.model || DEFAULT_MODEL,
  };
}

// Empty/whitespace key clears the stored credential.
function setKey(key) {
  const cfg = loadConfig();
  const trimmed = typeof key === 'string' ? key.trim() : '';
  if (!trimmed) {
    delete cfg.key;
    saveConfig(cfg);
    return { ok: true, configured: false, encryptionAvailable: encryptionAvailable() };
  }
  const enc = encryptKey(trimmed);
  if (!enc) {
    return { ok: false, configured: false, encryptionAvailable: encryptionAvailable(), warning: 'Secure storage unavailable on this system; key not stored.' };
  }
  cfg.key = enc;
  saveConfig(cfg);
  return { ok: true, configured: true, encryptionAvailable: encryptionAvailable() };
}

// Main-process-internal: the decrypted key for outbound AI calls. Not exposed via IPC.
function getKey() { return decryptKey(loadConfig().key); }
function getModel() { return loadConfig().model || DEFAULT_MODEL; }

module.exports = { DEFAULT_MODEL, getStatus, setKey, getKey, getModel };
