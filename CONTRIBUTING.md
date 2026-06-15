<div align="center">

# Contributing to Onyx

Thanks for taking the time to contribute. This guide covers how to set the project up,
the conventions that keep the codebase coherent, and how a change makes its way from a
branch to a merged PR.

</div>

> [!TIP]
> New here? Read [`README.md`](README.md) for what Onyx is and [`ARCHITECTURE.md`](ARCHITECTURE.md)
> for the security model and IPC boundaries. This document is the *how to work in the repo*
> layer on top of those.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting set up](#getting-set-up)
- [Project layout](#project-layout)
- [The golden rules](#the-golden-rules)
- [Branching & commits](#branching--commits)
- [The pre-commit gate](#the-pre-commit-gate)
- [Opening a pull request](#opening-a-pull-request)
- [Design system](#design-system)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)

## Code of conduct

Be respectful, assume good faith, and keep discussion focused on the work. Harassment of
any kind is not welcome. By participating you agree to uphold a friendly, professional space.

## Getting set up

**Prerequisites:** Node.js 20+ and npm. Windows 10/11 is the primary target — several modules
(ports, power plans, process discovery) are Windows-specific.

```bash
git clone https://github.com/Sepd0x/onyx.git
cd onyx
npm install
```

| Command | What it does |
|---|---|
| `npm run onyx` | Run the full app — Vite UI + Electron together. |
| `npm run dev` | Run the UI alone in a browser; a mock backend is injected so it's fully interactive without Electron. Append `?demo=1` to the URL to seed rich demo data (active guards, snippets, launcher profiles, AI briefings) instead of the default empty states. |
| `npm run build:ui` | Build just the renderer. |
| `npm run build` | Build a Windows installer + portable `.exe` into `dist/`. |
| `npm run typecheck` | Type-check the whole workspace (must be clean). |
| `npm test` | Run the test suite (Vitest). |

> [!NOTE]
> If `electron-builder` leaves `tsc`/`vitest` reporting "not recognized" after a build, run
> `npm install` to restore `node_modules/.bin`.

## Project layout

Onyx is a monorepo via npm workspaces:

```
packages/
  core/    Electron main process, preload bridge, security, settings, channels
  tools/   Native Node backends — one per tool (ports, gitpulse, cleaner, power, ai, …)
  ui/      React + Vite + TypeScript renderer (Tailwind, CSS-variable theming)
```

- **Main** (`packages/core/src/`) owns windows, the tray, IPC handlers, OS hardware events,
  native notifications, encrypted-at-rest secrets, and auto-update.
- **Tools** (`packages/tools/*/index.js`) are pure Node backends. Pure logic lives in sibling
  files (`parse.js`, `models.js`, `match.js`, …) with a co-located `.test.js`.
- **UI** (`packages/ui/src/`) talks to main only through `window.api`. `lib/ipcCache.ts` is the
  SWR-style data layer; `ipc.ts` holds the typed `CH`/`EV` constants; `mockApi.ts` is a
  browser-only fake backend.

## The golden rules

These are the conventions that prevent the most common regressions. Please follow them.

1. **One IPC source of truth.** `packages/core/src/channels.js` defines every channel name. A new
   channel must be added to **all** of: `channels.js`, the inlined allowlist in `preload.js`,
   `ipc.ts` (`CH`/`EV`), the tool handler, and `mockApi.ts`. The `channels.test.js` suite enforces
   that every layer stays in lockstep — if you add a channel in only one place, the test fails.

2. **The preload is self-contained.** It is sandboxed and **cannot `require` local files** — only
   `electron` and Node builtins. Keep the channel lists inlined there (the test checks they match).

3. **Security is non-negotiable.** `contextIsolation` on, `nodeIntegration` off, sandboxed preload,
   a CSP. Never pass renderer input to a shell unvalidated — use `execFile`, never a shell string.
   Secrets are encrypted via `safeStorage` and **never cross the bridge**; AI/network calls run in
   **main**, not the renderer. External links go only through the validated `windowOpenExternal`
   path (http/https only).

4. **Real backends over mock.** The UI must not depend on fields that only the mock returns — that
   has historically been the top source of "fine in preview, broken when packaged" bugs. When you
   change a channel's shape, update `mockApi.ts` to match.

5. **Isolate pure logic.** When you add logic to a tool, put the pure part in its own file with a
   `.test.js`. It keeps backends thin and the logic testable without Electron.

## Branching & commits

- **Branch off `main`** with a descriptive, prefixed name: `feat/command-palette`,
  `fix/tray-resize`, `design/git-pulse-cards`, `docs/readme-polish`, `chore/prune-branches`.
- **Conventional Commits** for messages: `type(scope): summary` —
  e.g. `feat(gitpulse): merge local + remote repo cards`. Common types: `feat`, `fix`, `design`,
  `docs`, `chore`, `refactor`, `test`, `perf`.
- **Keep PRs small and themed.** One coherent change per PR reviews faster and reverts cleanly.

## The pre-commit gate

Before you commit, the change must pass — locally — all three:

```bash
npm run typecheck   # clean, no errors
npm test            # green
npm run build       # builds successfully
```

For anything observable in the app, also verify it live (`npm run onyx`) before opening the PR.

## Opening a pull request

1. Push your branch and open a PR against `main`.
2. Describe **what** changed and **why**; link any related issue (`Closes #NN`).
3. Confirm the pre-commit gate passed and note how you verified UI changes.
4. PRs are **squash-merged by the maintainer** — you don't need to squash locally; write a clean
   PR title (it becomes the squash commit subject).

## Design system

Onyx aims for a "calm premium" feel — match the surrounding code rather than inventing new patterns.

- **Theme tokens** are RGB CSS variables in `packages/ui/src/index.css`, used as `bg-surface`,
  `text-muted`, `border-border2`, `bg-primary/20`, etc. Don't hard-code hex colours.
- **Reuse the building blocks:** `EmptyState`, `Skeleton`, the `useIpc`/`invalidate` data hooks,
  and the shared `ViewHeader`. Copy an existing view's structure instead of starting from scratch.
- **Animations** use `tailwindcss-animate` / Framer Motion and must respect `prefers-reduced-motion`
  (already wired globally) — never ship motion without that guard.
- **Themes:** changes should hold up across Midnight, OLED and Dracula.

## Reporting bugs & requesting features

Open an issue with:

- **Bugs:** what you did, what you expected, what happened, and your OS / app version. Logs or a
  screenshot help. Never paste secrets (API keys, tokens) into an issue.
- **Features:** the problem you're trying to solve, not just the solution — it helps shape the fit.

---

<div align="center"><sub>Thanks for helping make Onyx better. 💜</sub></div>
