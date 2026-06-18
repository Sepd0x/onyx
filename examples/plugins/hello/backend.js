// Reference Onyx plugin backend. The contract:
//  - optional activate(host): grab the capability-scoped host API (only the capabilities
//    declared in manifest.permissions AND granted by the user are present).
//  - handlers: a map whose keys match manifest.channels. Each is reachable from the
//    renderer via window.api.invoke('plugin:invoke', { id, method, args }).
// Keep handlers pure-ish and defensive: they run in the main process.

let host = null;

module.exports = {
  activate(h) { host = h; },
  handlers: {
    greet(args) {
      const name = (args && typeof args.name === 'string' && args.name.trim()) || 'world';
      const message = `Hello, ${name}! — from ${host ? host.id : 'onyx.hello'}`;
      // host.notify only exists if the user granted the "notify" capability.
      if (host && host.notify) host.notify('Hello World plugin', message);
      return { message };
    },
  },
};
