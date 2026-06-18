# Onyx plugin signing

The trust root for the Fase 2 plugin system. Onyx only loads a third-party plugin whose
bundle is **signed with the Onyx private key** — the app ships the matching public key
and verifies every install. No signature → the plugin never runs.

## Files

| File | Committed? | What it is |
|------|-----------|------------|
| `keygen.js` | ✅ | Generates the Ed25519 key pair (run once). |
| `sign.js` | ✅ | Signs a plugin folder so the app will trust it. |
| `onyx-plugin-private.pem` | ❌ **never** | The secret key. gitignored via `*.pem`. |
| `../../packages/core/src/plugins/public-key.js` | ✅ | The public key that ships in the app. |

## One-time setup (owner)

```
node infra/plugin-signing/keygen.js
```

This writes the **private** key (gitignored — keep it offline, e.g. a password manager)
and the **public** key into `public-key.js` (commit that). Until this runs, verification
fails closed and no plugin can load.

> If the private key ever leaks, delete the `.pem`, re-run `keygen.js`, and ship a build
> with the new public key. Old signatures stop being trusted.

## Signing a plugin

```
node infra/plugin-signing/sign.js path/to/plugin-folder
```

The folder needs a `manifest.json` (validated against `packages/core/src/plugins/manifest.js`)
plus the files it references. The command writes `onyx.sig` into the folder. Distribute
the whole folder (including `onyx.sig`) via the `Sepd0x/onyx-plugins` registry.

## Why Ed25519 + Node crypto

No native dependency, tiny signatures, modern and fast. The signature covers a canonical
digest of every file in the bundle, so reordering files or flipping a single byte breaks
verification. See `packages/core/src/plugins/verify.js`.
