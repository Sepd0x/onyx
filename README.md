<div align="center">
  <h1>Onyx</h1>
  <p><strong>A centralized power toolkit and system guard for developers.</strong></p>
  <p>Local-first · privacy-respecting · zero distractions.</p>

  <p>
    <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
    <img src="https://img.shields.io/badge/Tailwind_CSS-0F172A?style=for-the-badge&logo=tailwind-css&logoColor=38BDF8" alt="Tailwind">
    <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License">
  </p>
</div>

---

## What is Onyx?

Onyx is a desktop control panel that bundles the small, recurring chores of local development into one fast, native app: finding and freeing ports, watching long-running build processes, tracking the health of your git repositories, reclaiming disk space from stale `node_modules`, managing OS power profiles, and quick-access snippets — all behind a single keyboard shortcut.

Built with Electron + React. Everything runs locally; there is no telemetry and no account.

## Features

| Module | What it does | Status |
|---|---|---|
| **Port Mapper** | Lists listening ports with process/PID and frees them | ✅ Stable |
| **Session Guard** | Watches a build PID and holds a wake-lock until it exits | ✅ Stable |
| **Git Pulse** | Tracks local & remote repos (branch, dirty, ahead/behind, risk flags) | ✅ Stable |
| **Dev Cleanser** | Scans for heavy `node_modules` folders and reclaims space | ✅ Stable |
| **Snippets** | Persistent, one-click-copy command snippets | ✅ Stable |
| **OS Power Manager** | Switches Windows power plans, optionally on AC/battery events | ✅ Stable |
| **Focus Mode** | Cursor auto-hide + distraction-free window rules | ✅ Stable |
| **System Tray** | Quick-glance dashboard next to the clock | ✅ Stable |
| **Launchers** | One-click multi-service local environments | ✅ Stable |
| **Inspector** | Real repo-sync & dev-process telemetry (heuristic, local) | ✅ Stable |

> Onyx reached its first stable release (**v1.0.0**). [`AUDIT.md`](AUDIT.md) is the audit that drove the hardening; [`CHANGELOG.md`](CHANGELOG.md) lists what shipped, and [`ROADMAP.md`](ROADMAP.md) covers what's next.

## Requirements

- Node.js **20+** and npm
- Windows 10/11 (primary target; some modules are Windows-specific)

## Getting started

```bash
git clone https://github.com/Sepd0x/onyx.git
cd onyx
npm install
```

### Develop

```bash
# Starts the Vite UI dev server and the Electron shell together
npm run onyx
```

You can also run the UI alone in a browser with `npm run dev` (a mock backend is injected automatically so the UI is fully interactive without Electron).

### Build a Windows installer

```bash
npm run build
```

Artifacts land in `dist/` (an NSIS installer and a portable `.exe`). Filenames track the version in `package.json`.

### Test

```bash
npm test
```

## Tech stack

- **Main process:** Node.js + Electron (IPC bridge, OS hardware events, native notifications, auto-update)
- **Renderer:** React + Vite + TypeScript
- **Styling:** Tailwind CSS v3 with CSS-variable theming (Midnight, Pure OLED, Dracula)

## Project layout

```
packages/
  core/    Electron main process, preload bridge, security, settings
  tools/   Native Node backends (ports, git, cleaner, power, …)
  ui/      React + Vite renderer
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the security model and IPC boundaries, and [`CONTRIBUTING.md`](CONTRIBUTING.md) to get involved.

## License

MIT.
