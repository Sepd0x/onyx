# Onyx — Production Readiness Audit

> ✅ **Status (2026-06-11):** this was the *pre-remediation* baseline. The prioritized phases below are now **complete and shipped** — see [`CHANGELOG.md`](CHANGELOG.md). Kept as a historical record of the v1.0.0 hardening.

**Date:** 2026-06-10
**Scope:** First-party code only (`packages/**`, `scripts/**`, root config & docs). `node_modules` and build output excluded.
**Method:** Six parallel reviewers (security, correctness, architecture, UX/design, testing/build, documentation), each reading the actual source. **Every critical/high finding was re-verified by an independent adversarial agent** that re-read the cited code. Of the findings sent to verification: **0 were refuted**, a few had their severity corrected. This document supersedes the previous `AUDITORIA.md`, which contained multiple "already fixed" claims that do not match the code.

> This is the authoritative, honest baseline. Where the old docs say a feature "works", this audit states whether it actually works **in the packaged Electron build** vs. only in the browser mock preview.

---

## Severity summary

| Severity | Count | Meaning |
|---|---|---|
| 🔴 Critical | 1 | Security hole / data loss / broken-on-launch |
| 🟠 High | 21 | Feature broken or wrong in the common path; real security weakness |
| 🟡 Medium | 26 | Noticeable bug or quality gap |
| ⚪ Low | 14 | Polish / nit |

**The single structural root cause behind most "high" bugs:** the UI was built against `packages/ui/src/mockApi.ts` (a browser preview backed by `localStorage`). The real native backends in `packages/tools/*` return **different shapes** than the mock, and there is **no shared IPC contract**, so many features look perfect in the browser preview but are blank, broken, or throw in the real app. The verification agents confirmed this pattern repeatedly.

---

## 🔴 Critical

### SEC-01 — GitHub token stored in reversible base64, not encrypted
`packages/tools/gitpulse/index.js:176,28` · docs falsely call it "encryption" (`AUDITORIA.md:85`)
The GitHub Personal Access Token is saved to `userData/gitpulse.json` as `Buffer.from(token).toString('base64')` and decoded on read. Base64 is **encoding, not encryption** — anyone who can read that file (malware, backup sync, another user) recovers the live full-scope token in one step.
**Fix:** store with Electron `safeStorage` (OS-backed DPAPI/Keychain) or the OS credential vault; never persist the raw/base64 token; redact from logs.

---

## 🟠 High (broken in production / real weakness)

### Security
- **SEC-02 — Command injection via PID in `ports:kill`** · `portmapper/index.js:55` — renderer-supplied `pid` is interpolated into `` `taskkill /F /PID ${pid}` `` / `kill -9 ${pid}` and run through a shell. **Fix:** validate `pid` is a positive integer; use `execFile`/`spawn` with an argv array (no shell).
- **SEC-03 — Command injection via PID in dev-watcher** · `dev-watcher/index.js:10-14` — same class, in the 5s `isProcessRunning` poll; `req.target` is never validated. **Fix:** validate numeric at `dev:startWatch` and use `execFile`.
- **SEC-04 — `cleaner:delete` force-deletes any renderer-supplied path** · `cleaner/index.js:48-52` — `fs.rmSync(p, { recursive: true, force: true })` over whatever array the renderer sends, no validation, no confirmation. **Fix:** in main, assert `basename === 'node_modules'`, contain paths under known scan roots (`path.resolve` + `startsWith`), confirm via `dialog.showMessageBox`, prefer `shell.trashItem`.

### Correctness (mock-vs-real)
- **COR-01 — `app:notify` missing from preload allowlist** · `preload.js` — UI calls it (Power, AI Auditor) but it isn't allowlisted, so every notification throws `Invalid IPC channel` in the real app (works in mock). **Fix (trivial):** add `'app:notify'` to `validChannels`. *(Fixed in this baseline PR.)*
- **COR-02 — `power:mockAIEvent` has no real handler and isn't allowlisted** · `PowerOSView.tsx:25` — the AI power loop throws every ~3s in production. **Fix:** remove the mock loop and drive the feed from the real `powerMonitor` events, or implement + allowlist a real handler.
- **COR-03 — Tray/window icon loaded from `.svg` via `nativeImage`** · `main.js:26,93,117` — Electron can't decode SVG; the tray icon is **blank** on Windows. **Fix:** ship `.ico`/`.png` and point `iconPath` at it.
- **COR-04 — `gitpulse` never sets `lastCommit` on first fetch** · `gitpulse/index.js:38-68` — remote repos always show `Unknown` and never raise the bad-commit warning until a cached call. **Fix (trivial):** `r.lastCommit = lastCommit` in the fetch branch.
- **COR-05 — Dev Watcher "AI fault detection / AUTO HEAL" is dead** · real `dev:status` returns only `{id,type,target,name}`; `crash`/`aiError` exist only in the mock; `dev:heal` is a no-op. The whole healing UI never appears in the real app.
- **COR-06 — "Track executable by name" is broken** · `DevWatcherView` sends a binary name as a PID; `tasklist /FI "PID eq myapp.exe"` matches nothing → it falsely reports "task finished" after 5s. **Fix:** resolve name→PID, or add an image-name watch mode, or reject non-numeric input.
- **COR-07 — Launchers START/STOP do nothing** · `launchers/index.js:20-31` — pure `console.log` stubs; the "1-click local environments" headline feature never spawns a process while the UI shows a green "RUNNING" badge.

### Architecture
- **ARCH-01 — `app:notify` allowlist gap** (same root as COR-01) — symptom of having **no single source of truth** for channel names across mock/preload/main/views.
- **ARCH-02 — "Lumina" brand leaks into production** · real settings file `lumina-settings.json`, a live OS notification titled `"Lumina Session Guard"`, `localStorage` keys `lumina-*`, mock seed data, `AUDITORIA.md` title. **Fix:** rename to `devbox-*` with a one-time settings migration; grep-gate `/lumina/i` in CI.

### UX / Accessibility
- **A11Y-02 — Focus outlines stripped, not replaced** · `outline-none`/`focus:outline-none` everywhere with no `:focus-visible`; keyboard focus is invisible on nearly every control. **Fix:** global `*:focus-visible` ring in `index.css`.
- **UX-03 — Destructive actions have no confirmation** · "NUKE ALL" (delete every node_modules), "FREE PORT" (kill process) fire instantly. One mis-click = irreversible loss. **Fix:** confirmation modal/two-step.

### Testing / Build / Release
- **TEST-01 — The only test fails** · `npm test` is red: `vi.mock('electron')` (ESM) doesn't replace the CJS `require('electron')` in `security.js`, so `app` is undefined and it throws. `fakeApp` is dead code. **Fix:** inject `app` into `setupSecurity(app)` or mock coherently.
- **TEST-03 — All high-value logic is untested and structurally untestable** · parsers/heuristics live inside `ipcMain.handle` closures with nothing exported (netstat parser, GitHub URL parser, commit heuristic, process-list parser). **Fix:** extract pure functions, add vitest suites.
- **BUILD-01 — No Windows icon configured** · `build.win.icon`/`build.icon` unset; only an unusable `icon.svg` exists → installer/taskbar ship the default Electron icon. **Fix:** generate `icon.ico` + `icon.png`, set `build.win.icon`.
- **CI-01 — Auto-update is wired but nothing publishes releases** · full `electron-updater` setup, `publish: ["github"]`, but **no `.github/` at all** → `latest.yml` is never produced, so updates can never be found. **Fix:** GitHub Actions release workflow on `v*` tags (`electron-builder --publish always`).

### Documentation accuracy
- **DOC-02 — Launch Profiles documented "done" but the backend is a stub** (see COR-07).
- **DOC-03 — "AI Auditor / AI commit assistant" marketed as AI but are mocks** · `// MOCK AI COMMITS`; "Lines Audited" is `Math.random()`; "memory leak" detection is a keyword score with `memory: 'Unknown'`. **Fix:** relabel as heuristic/demo or remove the fabricated metric.
- **DOC-04 — Notifications documented as working, but throw in production** (same root as COR-01).

---

## 🟡 Medium (selected — full list tracked in remediation plan)

| ID | Title | Files |
|---|---|---|
| SEC-05 | `window:openExternal` forwards any scheme to the shell | `main.js:136` |
| SEC-06 | No Content-Security-Policy meta tag | `ui/index.html` |
| SEC-07 | Windows omit `sandbox:true` / explicit `webSecurity` | `main.js:38,121` |
| COR-08 | Power view battery readout is fake random data even in prod | `PowerOSView.tsx` |
| COR-09 | "OUT OF SYNC" banner never shows for real remote repos (mock-only field) | `GitView.tsx:140` |
| COR-11 | Uncoordinated 3s config polling → stale Settings toggles | `App.tsx`, `SettingsView.tsx` |
| ARCH-03 | 3 product names in UI/docs ("DevTools Unified" / "Nexus DevBox" / "DevBox") | many |
| ARCH-04 | No `.gitignore`, no CI | repo root *(gitignore fixed here)* |
| ARCH-05 | `packages/tools` isn't a real workspace (no package.json); brittle `../../tools` requires | `main.js:8-15` |
| ARCH-07 | Stub IPC handlers shipped as if functional (launchers, dev:heal) | tools |
| ARCH-08 | No shared IPC contract/types — channel strings duplicated in 4 layers; all state `any` | mock/preload/views/tools |
| ARCH-10 | Each tool writes its own ad-hoc JSON in userData, inconsistent naming | tools |
| UX-01 | Inter / JetBrains Mono declared but never loaded → system-font fallback | `index.css`, `tailwind.config.js` |
| A11Y-01 | Icon-only buttons have no `aria-label`; zero a11y attributes | UI-wide |
| A11Y-03 | No `prefers-reduced-motion` support | `index.css` |
| UX-04 | IPC failures swallowed — no error state anywhere | UI-wide |
| UX-05 | Four inconsistent hand-rolled toggle switches | Settings/Cursor/Power |
| BUILD-03 | Dependency drift (root vite ^8 unused; runtime dep at root not in core) | package.json(s) |
| CI-02 / CI-03 | No lint/typecheck; concrete CI+release workflows recommended | package.json |
| DOC-01/05/06/07/08/10 | Misleading/duplicated docs; wrong injection description; 3 names; bilingual README; stale version | docs |

## ⚪ Low
`SEC-09` (docs narrate personal workflow), `SEC-10` (PS `-ExecutionPolicy Bypass`), `SEC-11` (no code signing), `COR-10` (Windows path split shows full path), `COR-12` (AIAuditor index keys + duplicate log spam), `ARCH-06` (dead icon scripts download a TypeScript logo), `ARCH-09` (`GEMINI.md`+`ARCHITECTURE.md` overlap), `ARCH-11` (ARCHITECTURE.md wrong about mock injection), `UX-06/07/08` (loading affordances, cramped Ports header, low-fidelity inline logo), `TEST-02` (dead `fakeApp`), `BUILD-02` (test dir shipped into the app), `DOC-09` (no screenshots, wrong Tailwind version).

## 🕵️ Privacy / anonymity (owner request: repo must carry no personal identity)
- **SEC-08** — Personal **real name** and **GitHub handle** are baked into `package.json` (author), `README`, `SettingsView`, and docs. The handle is also compiled into the production bundle and the updater config. *(The real-name leak in `package.json` author is removed in this baseline PR; the rest is queued in Phase 1.)*

---

## Prioritized remediation roadmap

**Phase 0 — Baseline & hygiene (this PR)**
`.gitignore` · this `AUDIT.md` · fix `app:notify` allowlist (COR-01/ARCH-01/DOC-04) · remove real-name leak from `package.json`.

**Phase 1 — Stop the bleeding: critical security + broken-in-production**
SEC-01 (safeStorage token) · SEC-02/03/04 (input validation + destructive guards) · SEC-08 (finish anonymization) · COR-03/BUILD-01 (real icon) · COR-02 (power mock loop) · COR-04 (lastCommit) · COR-06 (watch-by-name).

**Phase 2 — Make features real (no false affordances)**
COR-05/ARCH-07 (implement or hide dev:heal + launchers) · COR-07 (real `child_process.spawn`) · COR-08/09 (real power/git-sync data) · DOC-02/03/10 truth-ups.

**Phase 3 — Hardening, tests & CI**
SEC-05/06/07 (openExternal allowlist, CSP, sandbox) · TEST-01/02 (fix the test) · TEST-03 (extract pure fns + suites) · CI-01/02/03 (CI + tagged release with auto-update publish) · BUILD-02/03.

**Phase 4 — Premium UX/design pass**
UX-01 (self-host fonts) · A11Y-01/02/03 (labels, focus ring, reduced-motion) · UX-03 (confirmations) · UX-04 (error states) · UX-05/06/07/08 (shared Switch, loading states, responsive Ports, theme-aware logo).

**Phase 5 — Architecture & docs**
ARCH-02 (Lumina→DevBox + migration) · ARCH-03 (one product name) · ARCH-05/08/10 (real workspace, typed IPC contract, shared config helper) · DOC consolidation (CHANGELOG/AGENTS) · README rewrite + screenshots.

---
*Generated by an automated multi-agent audit with adversarial verification. All findings cite real `file:line` evidence and were confirmed against the source.*
