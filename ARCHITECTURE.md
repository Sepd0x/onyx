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

## Themes
The application styling natively bridges Tailwind utility classes with core CSS variables (see `index.css`).
Themes switch dynamically by setting `data-theme` attribute on the root HTML element.
