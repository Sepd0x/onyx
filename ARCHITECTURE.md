# Onyx Architecture

## High-Level Topology

The Onyx app is a Monorepo using npm workspaces.

```text
/
├── packages/
│   ├── ui/       # React + Vite (Frontend)
│   ├── core/     # Electron Main Process & IPC Preload
│   └── tools/    # Pure Node.js utilities (Networking, Git)
├── package.json
└── README.md
```

## Security & IPC Boundaries
- **Context Isolation** is fully enabled in Electron.
- The UI runs in a sandboxed generic Web Context with zero native Node.js privileges.
- Inter-Process Communication (IPC) is handled explicitly through `@electron/contextBridge` which exposes `window.api`.

### Development Fallback (Mock API)
In local development (running `npm run dev` in standard Chrome/Firefox without Electron runtime attached), `window.api` does not natively exist.
To solve this, `packages/ui/src/main.tsx` calls `injectMockApi()` before the React app mounts, which attaches `window.api` only when it is absent (i.e. outside Electron). This permits full UI, CSS layout, and state logic development directly in the browser.

## Plugin system (signed extensions)
Third-party functionality ships as **signed plugin bundles**, never as arbitrary code:
- **Signature is the trust root.** Each bundle is signed offline with the Onyx Ed25519 private key (`infra/plugin-signing/`); the app ships only the public key (`packages/core/src/plugins/public-key.js`) and verifies every bundle *before requiring a single line*. Verification **fails closed** — no key, or a bad/altered signature, means nothing loads.
- **Capability model.** A plugin's manifest declares the permissions it needs from a **closed catalog** (`packages/core/src/plugins/permissions.js`). The user approves them, and the host API handed to the plugin exposes *only* the approved capabilities.
- **Single gated channel.** Plugins never register their own IPC channels. The renderer reaches plugin code only through `plugin:invoke`, gated by: installed → verified → enabled → method declared in the manifest. The core channel allowlist stays closed and `channels.test.js` keeps enforcing it.
- Verified plugins load from `userData/plugins/`; the runtime lives in `packages/tools/plugins/`. See `infra/plugin-signing/README.md` to sign one, and the curated registry at `Sepd0x/onyx-plugins`.

## Themes
The application styling natively bridges Tailwind utility classes with core CSS variables (see `index.css`).
Themes switch dynamically by setting `data-theme` attribute on the root HTML element.
