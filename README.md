<div align="center">

# Onyx

**One native app for the small, recurring chores of local development.**

Free a stuck port, keep your machine awake until a build finishes, see which repos are dirty or behind, reclaim disk from old `node_modules`, switch power plans, and keep your go-to commands one click away — all behind a single keyboard shortcut, with a tray dashboard next to your clock.

<p>
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-0F172A?style=for-the-badge&logo=tailwind-css&logoColor=38BDF8" alt="Tailwind">
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License">
</p>

<sub>Local-first · no account · no telemetry · Windows 10/11</sub>

</div>

---

## Why Onyx

Every local project leaks the same small tasks across a dozen tools and terminal tabs: *what's on port 3000?*, *don't sleep mid-build*, *which repos did I forget to push?*, *where did my SSD go?*. Onyx pulls those into one fast, native panel with a consistent design and a quick-access tray — so the busywork takes a click instead of a context switch.

It runs entirely on your machine. There's no account and no telemetry; the optional AI features only run when you add your own API key, and only on the data shown in that panel.

## What's inside

| Module | What it does |
|---|---|
| **Port Mapper** | Live list of listening/established ports grouped by process — free any one in a click. |
| **Session Guard** | Hold a system wake-lock tied to a build/PID so the OS won't sleep mid-task, then auto-release and notify when it exits. |
| **Git Pulse** | Track local & GitHub repos at a glance: branch, dirty files, ahead/behind, risk flags, 14-day activity — with optional AI commit messages. |
| **Dev Cleanser** | Scan common dev folders for heavy `node_modules` and reclaim the space, with a guarded, confirmed delete. |
| **OS Power Manager** | Switch Windows power modes (optionally auto, on AC/battery) without touching brightness. |
| **Focus Mode** | Cursor auto-hide and distraction-free window rules. |
| **Launchers** | Start a whole local stack (frontend, API, database…) as one named profile. |
| **Snippets** | Keep the shell one-liners you keep retyping, one click to copy. |
| **Inspector** | A unified, local read-out of repo sync state and detected dev processes, with optional AI briefings. |
| **System Tray** | A customisable mini-dashboard (CPU, RAM, ports, guards) next to the clock. |

**Optional AI** — bring your own key for **Anthropic (Claude)**, **OpenAI (ChatGPT)** or **Google (Gemini)**. Keys are encrypted at rest in the OS keychain and never leave your machine except for the call you trigger.

**Themes** — Midnight, Pure OLED and Dracula, plus a pickable accent colour.

> **Status:** approaching the first tagged release. Core modules work end-to-end; see [`CHANGELOG.md`](CHANGELOG.md) for what's landed.

## Getting started

```bash
git clone https://github.com/Sepd0x/onyx.git
cd onyx
npm install
```

```bash
npm run onyx     # run the app (Vite UI + Electron together)
npm run build    # build a Windows installer + portable .exe into dist/
npm test         # run the test suite
```

You can also run the UI alone in a browser with `npm run dev` — a mock backend is injected so it's fully interactive without Electron.

**Requirements:** Node.js 20+ and npm; Windows 10/11 (primary target — some modules are Windows-specific).

## How it's built

- **Main process** — Node.js + Electron: a single source of truth for IPC channels, OS hardware events, native notifications, encrypted-at-rest secrets, auto-update.
- **Renderer** — React + Vite + TypeScript, Tailwind CSS with CSS-variable theming.
- **Security** — `contextIsolation` on, `nodeIntegration` off, sandboxed preload, a CSP, no secrets in plaintext, and no renderer access to the shell or filesystem (everything goes through validated IPC).

```
packages/
  core/    Electron main process, preload bridge, security, settings
  tools/   Native Node backends (ports, git, cleaner, power, AI, …)
  ui/      React + Vite renderer
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the security model and IPC boundaries, and [`CONTRIBUTING.md`](CONTRIBUTING.md) to get involved.

## License

[MIT](LICENSE).
