// The capability-scoped host API handed to a plugin backend in activate(host). Only
// capabilities the plugin DECLARED (manifest.permissions) AND the user GRANTED are
// present on the returned object — a plugin physically cannot call a method it didn't ask
// for, because the method isn't there. The signature already proved the code is
// owner-approved; this is the second gate, at the API surface.
//
// Fully dependency-injected (impl supplies the real Electron-backed functions), so it's
// testable without an Electron runtime.

const CAPABILITY_IMPL_KEY = {
  'config:read': 'getConfig',
  'notify': 'notify',
  'clipboard:read': 'readClipboard',
  'shell:open': 'openExternal',
  'net:fetch': 'fetch',
  'fs:read': 'readFile',
};

function buildHost(plugin, granted, impl) {
  const grantedSet = new Set(granted || []);
  const i = impl || {};
  const host = { id: plugin.id, version: plugin.version };
  for (const [perm, key] of Object.entries(CAPABILITY_IMPL_KEY)) {
    // Both the plugin must declare it AND the user must have granted it AND the host must
    // actually implement it — otherwise the capability simply isn't exposed.
    if (plugin.permissions.includes(perm) && grantedSet.has(perm) && typeof i[key] === 'function') {
      host[key] = i[key];
    }
  }
  return host;
}

module.exports = { buildHost, CAPABILITY_IMPL_KEY };
