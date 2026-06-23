# Writing an Onyx plugin

Onyx extensions are **signed plugin bundles**. This guide is the end-to-end path: what a
plugin is, how to build one, how to test it locally, and how to submit it to the curated
registry so it ships to users with credit to you.

> **Read this first — the trust model (and its honest limits).**
> Onyx only runs plugins **signed with the Onyx key**, and the Onyx maintainer **reviews**
> a plugin before signing it. That review + signature is the real security boundary.
>
> A verified plugin's backend runs **in the main process with full Node access** — the
> capability system (below) is *least-privilege over the host API* and *transparency for
> review*, **not** a hard sandbox. A signed plugin you didn't review could do anything.
> So: only the maintainer signs, and only after review. (A future release will run plugin
> backends in a Node-less isolated process to make capabilities truly enforced — see
> [`ARCHITECTURE.md`](../ARCHITECTURE.md).)

---

## 1. Anatomy of a plugin

A plugin is a **folder** with a manifest, a backend, and (after signing) a signature:

```
my-plugin/
  manifest.json     # metadata + declared capabilities + entry points
  backend.js        # the code (runs in the main process)
  onyx.sig          # added by the signing step — do not write this yourself
```

### manifest.json

Validated against [`packages/core/src/plugins/manifest.js`](../packages/core/src/plugins/manifest.js).

```json
{
  "id": "yourhandle.toolname",
  "name": "Tool Name",
  "version": "1.0.0",
  "description": "One line, ≤ 200 chars.",
  "author": { "handle": "yourhandle", "url": "https://github.com/yourhandle" },
  "official": false,
  "engines": { "onyx": ">=1.3.0" },
  "permissions": ["notify"],
  "channels": ["doThing"],
  "main": "backend.js"
}
```

| Field | Rules |
|---|---|
| `id` | `namespace.name`, lowercase (e.g. `acme.ports`). Unique in the registry. |
| `name` | Non-empty, ≤ 60 chars. |
| `version` | Semver `x.y.z`. |
| `author` | **Required.** `handle` (1–39 chars) + an **https** `url`. This is how you're credited — no anonymous plugins. |
| `official` | `false` for community plugins (only Onyx's own are `true`). |
| `engines.onyx` | Version range the plugin needs: `*`, `x.y.z`, or one comparator (`>=1.3.0`). |
| `permissions` | Capabilities you need, from the **closed catalog** (below). Requesting anything else fails validation. |
| `channels` | The method names the renderer can invoke. Bare names (`doThing`), never full IPC channels. |
| `main` | The backend filename in the bundle. `ui` is also allowed for a future UI chunk. |

### backend.js — the contract

```js
// Runs in the main process. Export an optional activate(host) and a handlers map.
let host = null;

module.exports = {
  // Called once on load. `host` exposes ONLY the capabilities you declared AND the user
  // granted — a withheld capability simply isn't on the object.
  activate(h) { host = h; },

  // One function per name in manifest.channels. Reached from the renderer via
  // window.api.invoke('plugin:invoke', { id, method, args }). Keep them defensive.
  handlers: {
    async doThing(args) {
      if (host?.notify) host.notify('My plugin', 'did the thing');
      return { ok: true, echo: args };
    },
  },
};
```

See the reference plugin in [`examples/plugins/hello`](../examples/plugins/hello).

---

## 2. The capability catalog

A plugin may request **only** these (source of truth:
[`packages/core/src/plugins/permissions.js`](../packages/core/src/plugins/permissions.js)).
Each maps to one method on `host`, present only when declared **and** granted:

| Permission | Risk | `host` method | Does |
|---|---|---|---|
| `config:read` | low | `host.getConfig()` | Read the user's Onyx settings (theme, toggles). |
| `notify` | low | `host.notify(title, body)` | Show a desktop notification. |
| `clipboard:read` | medium | `host.readClipboard()` | Read current clipboard text. |
| `shell:open` | medium | `host.openExternal(url)` | Open an `http(s)` URL in the default browser. |
| `net:fetch` | high | `host.fetch(...)` | Make an outbound network request (`fetch`). |
| `fs:read` | high | `host.readFile(...)` | *Declared-only for now — intentionally not wired until a safe, user-scoped reader exists.* |

`host.id` and `host.version` are always present. The catalog is deliberately small; new
capabilities widen the attack surface and are added only after review.

---

## 3. Calling a plugin from the UI

Everything goes through the single gated channel — there is no other path to plugin code:

```ts
const res = await window.api.invoke('plugin:invoke', {
  id: 'yourhandle.toolname',
  method: 'doThing',      // must be in manifest.channels
  args: { any: 'json' },
});
// res === { ok: true, result: <your return value> } | { ok: false, error: '...' }
```

The dispatch is gated: **installed → signature-verified → enabled → method declared**. A
method you didn't list in `channels`, or a disabled plugin, is unreachable.

---

## 4. Build & test locally

1. Scaffold the folder with `manifest.json` + `backend.js` (copy `examples/plugins/hello`).
2. **Sign it** (needs the Onyx private key — see [`infra/plugin-signing/README.md`](../infra/plugin-signing/README.md)):
   ```
   node infra/plugin-signing/sign.js path/to/my-plugin
   ```
   This writes `onyx.sig`. (Community authors don't hold the key — you submit the folder
   and the maintainer signs during review; see §5.)
3. In the app: **Extensions → Install from file**, pick the folder. The signature is verified
   *before* anything runs; then you consent to its capabilities and it installs.
4. Invoke it from the renderer (or another plugin's UI) and check the result.

> **Line-endings gotcha:** a signed bundle's bytes are exact. If you commit one to git,
> mark it `-text` in `.gitattributes` (autocrlf would rewrite line endings and break the
> signature). See the repo's `.gitattributes`.

---

## 5. Submitting to the registry (review → sign → publish)

Community plugins are distributed from the curated registry
**[`Sepd0x/onyx-plugins`](https://github.com/Sepd0x/onyx-plugins)**. The flow:

1. **Open a PR** to the registry with your plugin folder (manifest + backend, **no** `onyx.sig`).
2. **Review.** The maintainer reads the code — especially anything using `net:fetch` /
   `shell:open` — confirms the manifest is accurate, and that the author credit is real.
3. **Sign.** On approval the maintainer signs the bundle with the Onyx key and publishes it.
4. **Credit.** Your `author.handle` + `url` show on the plugin's card and in the consent
   dialog. That's the recognition — real attribution, linked back to you.

There is **no anonymous self-publish**. A plugin with no traceable author is rejected at
manifest validation, and nothing runs without the maintainer's signature.

---

## Checklist

- [ ] `manifest.json` valid (id, semver, https author url, capabilities from the catalog).
- [ ] `backend.js` exports `handlers` matching `channels`; defensive, no crashes.
- [ ] Requests the **fewest** capabilities it needs.
- [ ] Tested locally end-to-end (install → consent → invoke).
- [ ] PR to `Sepd0x/onyx-plugins` for review + signing.
