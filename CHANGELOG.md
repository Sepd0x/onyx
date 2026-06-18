# Changelog

All notable changes to Onyx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project aims at
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Desktop overlay** (#8) — an always-on-top, draggable widget that floats above
  your windows with live CPU / RAM / listening-ports / clock tiles. Toggle it from
  the tray menu or Settings → Desktop overlay; pick which tiles show, set its
  opacity, and its position is remembered. Its own frameless, transparent window.
  **Click to expand** into a richer panel — recent clipboard with one-click re-copy
  plus a quick "Open Onyx" action — and collapse back to the compact strip.
- **App blocker in Focus Mode** (#9) — list distraction apps (e.g. `Discord.exe`,
  `Steam.exe`) and, while the blocker is active, Onyx force-closes them in the
  background so you stay in flow, with a per-session "closed" count. Opt-in and
  explicit: OS-critical processes and Onyx itself can never be blocked.
- **Window size & position are remembered** (#9) — Onyx reopens where you left it
  instead of the default 980×680 every launch. Bounds are validated and clamped to a
  connected display, so a window saved on an unplugged monitor can't open off-screen.

- **Opt-in anonymous telemetry** (#27) — **off by default**. If you turn it on (in
  onboarding or Settings → Data) Onyx shares only your app version, OS, language,
  theme and which tools you open (daily aggregates) under a random, resettable id —
  never your code, files, repos, ports, clipboard, AI prompts or any personal data,
  and your IP is dropped at the edge. You can preview the exact payload before
  enabling. Full policy in `PRIVACY.md`; the collector is a self-owned Cloudflare
  Worker (`infra/telemetry-worker/`).
- **Pick your tools, from the start** (#28) — a new "Your tools" step in onboarding
  lets you enable only the tools you want; the rest stay hidden from the sidebar and
  command palette (re-enable any of them later). The same tool catalog — cards with
  an icon, description and an "Official · by Onyx" credit — now powers Settings →
  Tools, ready for community-contributed tools to be credited the same way.
- **Plugins — signed & curated** (#28) — the foundation of an extension system. Onyx
  loads only plugins **signed with the Onyx key**; an unsigned or tampered bundle is
  rejected before any of its code runs (verification fails closed). Each plugin
  declares the capabilities it needs from a closed catalog, is limited to exactly
  those, and is credited to its author. A new **Extensions** view lists what's
  installed, with enable/disable and uninstall. Plugins are distributed from a curated
  registry ([`Sepd0x/onyx-plugins`](https://github.com/Sepd0x/onyx-plugins)).
  **Install with consent** — picking a plugin folder verifies its signature *before*
  anything runs, then shows a consent dialog spelling out every capability it's asking
  for (sorted by risk), each with its own toggle: leave them all on for a one-tap install,
  or withhold any you'd rather not grant and install with just the rest. Only the allowed
  set is granted — never more than the plugin declared — and nothing untrusted ever touches
  disk.

### Changed
- **Settings are organised into categories** — General, Appearance, Surfaces, Tools,
  AI, Data and About — shown one at a time instead of one ever-growing scroll.
- **Tools in Settings** are shown as a richer catalog (shared with onboarding).

### Fixed
- **The hidden cursor always comes back** — the cursor auto-hide tool now restores the
  system cursor on a graceful stop *and* if Onyx crashes or is killed (a watchdog in the
  worker notices the app is gone and reloads the cursor within half a second), plus a
  defensive restore on every start. Previously an abrupt exit while the cursor was hidden
  could leave the whole desktop without a pointer until reboot.
- **"Launch on OS Startup" is actually respected** — packaged builds no longer force
  auto-start on at every launch, so turning the setting off now sticks.
- **Clean uninstall** — the uninstaller removes the auto-start registry entry and offers
  to delete your settings, snippets and installed plugins (kept by default for reinstalls).
- **Settings survive updates cleanly** — the config file is now schema-versioned and
  migrated on launch: a file written by an older version gets any new options filled in
  with safe defaults (and your existing choices are never changed), so an update can't
  leave you with half-applied or missing settings.

## [1.2.0] - 2026-06-18

"New pillars & polish".

### Added
- **Clipboard history** (#7) — a tool that keeps recent copies (text + images):
  search, one-click re-copy, pin, delete, clear, and a pause toggle. History is
  in-memory only (never written to disk, cleared on quit).
- **AI output renders as Markdown** (#10) — the AI panels show headings, lists,
  bold, inline code, code blocks, quotes and links via a tiny, dependency-free,
  XSS-safe renderer (links styled but non-clickable). The prompts now emit concise
  Markdown to match.
- **Pick your tools** (#28 MVP) — a "Tools" section in Settings turns each tool on
  or off; disabled tools are hidden from the sidebar and command palette.
- **Pomodoro timer in Focus Mode** (#9) — focus/break timer with a progress ring,
  start/pause/reset/skip, editable durations and a per-day session count;
  timestamp-based so it survives view switches and catches up after sleep.
- **Rebindable global hotkey** — the show/hide shortcut (was a fixed Ctrl+Alt+D) is
  now editable in Settings, with a fallback if the chosen combo is already taken.
- **Client-side diagnostics breadcrumb** (`app:log`) — the renderer persists what it
  was doing (onboarding step, render-boundary catches) into the day's main log so a
  crash report is reproducible (#29/#30).

### Fixed
- **Battery wrongly reported as "not detected"** on laptops (notably Lenovo) whose
  `root\wmi` capacity classes come back empty. Presence is now read from
  `Win32_Battery` and decoupled from wear %; the card shows "Battery detected" (with
  charge %) when wear data isn't exposed.
- **Command palette (Ctrl/Cmd+K)** — the always-focused search field no longer shows
  the harsh full-width focus box, and the highlighted row is a smoothly rounded,
  inset pill (clean on all sides).
- **Pinned-taskbar icon had a dark background** — the `.exe`/pinned icon is now built
  from the transparent gem (regenerated assets included), scaled to fill the bounds.
- **Renderer-crash resilience** — a dead renderer (OOM/GPU/native) is logged and the
  window reloaded instead of vanishing; `unresponsive`/`responsive` and async/
  unhandled-rejection errors are logged too.
- **First-run wizard hardening** — the initial config/AI-status load is wrapped so a
  failing provider lookup can't take down onboarding.
- **Dev browser mock** mirrors the real AI status shape, handles the clipboard +
  `ai:setProvider`/`setModel`/`test` channels, and broadcasts `config:changed` on
  save (live theme/accent/enabled-tools updates in `npm run dev`).

## [1.1.4] - 2026-06-16

### Fixed
- **Command palette outline** — the modal now has a clean, evenly-rounded border
  on all four sides (a more visible translucent hairline). Earlier builds could
  look like the top edge was missing.

## [1.1.3] - 2026-06-16

### Fixed
- **Command palette (Ctrl/Cmd+K) double outline** — the search field is now
  integrated (one rounded outline from the modal + a hairline divider above the
  results) instead of a box-inside-a-box.
- A render error in any view now shows a **recovery screen** ("Reload Onyx")
  instead of a blank/vanished window.

### Changed
- `npm run build` cleans `dist/` first, so old installers no longer pile up.

## [1.1.2] - 2026-06-15

### Fixed
- **Auto-updater could never install (download loop).** Installer filenames had
  spaces, so `latest.yml` referenced a hyphenated name while GitHub served a
  dotted one — the updater 404'd and retried forever. Installers now build with
  space-free `artifactName`s, so the manifest and the published asset match.
- **Command palette (Ctrl/Cmd+K)** now shows the search field as a fully bordered
  box (all four sides) instead of an open-topped outline.
- The Settings "About" version is read from the running build instead of a
  hard-coded `v1.0.0`.

### Changed
- **Updates are no longer auto-downloaded.** Onyx checks on launch and, if an
  update exists, shows it in the banner with an explicit **Download** button;
  download progress and any error are surfaced (it no longer downloads silently
  or fails without a trace). After download, **Restart & install**.

## [1.1.1] - 2026-06-15

### Added
- **Battery health** in the Power Manager: real wear % (design vs full-charge
  capacity), detected vendor/model, and per-vendor charge-limit guidance (it
  points to the right vendor app rather than writing vendor firmware blindly).
- **Global update banner**: when an update has downloaded, a banner appears in
  any view with a one-click "Restart & install" — previously this was only
  visible on the Settings page.

### Changed
- Tray and taskbar/window icons now use a **transparent gem**; the framed dark
  tile is kept only for the installer / app tile, so the icon sits lighter
  beside other apps.

### Fixed
- The command palette (`Ctrl`/`Cmd`+`K`) search field's top corners now follow
  the modal's rounded top cleanly (no 1px clipping artifact).

## [1.1.0] - 2026-06-15

"The tools go deep" — the flagship views now replace a trip to GitHub / Task
Manager instead of skimming the surface.

### Added
- **Git Pulse — real repository activity** on every card: the last commit (hash,
  author, relative time), a "fetched <when>" line, an expandable details panel
  (changed files + branch list), the 14-day activity sparkline labelled with its
  commit total, and — on the GitHub side of a unified card — open PRs and open
  issues shown separately. New "Open on GitHub" quick action.
- **Port Mapper — premium per-process detail**: a stats strip (total / listening
  / established / processes), grouping by the owning process with its executable
  path, PID/ppid and memory, "kill the whole process" to free all its ports at
  once, the remote peer for live connections, an IPv6 badge, and a wider
  well-known-service map.
- **Battery-health guidance** in the Power Manager: explains where a real charge
  limit lives (the laptop vendor's app / BIOS) and how it differs from Windows
  Battery Saver.

### Changed
- **Git Pulse auto-scan** is deeper and faster — a parallel directory walk to 6
  levels (was 3), more roots (including drive-root dev folders like `C:\dev`),
  with live progress. It no longer misses obvious or nested repositories.
- **Dev Cleanser** now sweeps many regenerable artifact types, not just
  `node_modules` (`dist`, `build`, `.next`, `.nuxt`, `target`, `__pycache__`,
  `.gradle`, `.turbo`, `coverage`, …), each tagged with its kind, via a parallel
  walk to 5 levels with real sizes (biggest first) and live progress. Deletion
  stays guarded by a name whitelist + path containment + a confirmation dialog.
- The Power Manager's misleading **"Battery saver"** mode is renamed
  **"Efficiency"**, with copy clarifying it's a Windows power mode — not Windows
  Battery Saver.

## [Unreleased]

Phase 6 baseline (streaming AI, onboarding, command palette, Git Pulse unify,
backup/restore) shipped in 1.0.0; the depth work above shipped in 1.1.0.

### Added
- **Streaming AI responses** — the longer Inspector outputs (daily briefing,
  repository insights, log triage) now render token-by-token as they arrive, with
  a live cursor, instead of waiting for the whole reply. Falls back to a normal
  completion if streaming fails, so a result always lands.
- **Daily briefing** — one prioritised AI summary in the Inspector that combines
  tracked repos, running dev processes, current power state and today's log tail
  into a single morning glance (security risks first), alongside the existing
  focused insights and log triage.
- **First-run onboarding** — a short guided wizard on first launch: pick a theme
  and accent, optionally add an AI provider key (with a live Test), and a few
  tips. Persists an `onboarded` flag so it shows once.
- **Command palette** (`Ctrl`/`Cmd`+`K`) — a spotlight to jump to any view or
  switch theme from the keyboard, with arrow-key navigation and search.
- **Git Pulse — local ↔ GitHub unification**: a local repo and its tracked GitHub
  twin merge into one card showing both sides (local dirty/ahead-behind/risk/
  activity and remote default branch/open issues/last commit). Auto-matches by
  normalising the local `origin` remote (https + ssh) against the GitHub slug;
  manual **link / unlink** for absent or ambiguous origins, persisted.
- **Git Pulse — per-repo AI actions**: alongside the commit message, the card can
  explain the current diff, draft a PR description, or summarise recent history
  (prompts built in the main process with an untrusted-content guard; output only
  ever displays, never drives an action).
- **Backup & restore** — export your preferences, snippets and launcher profiles
  to a JSON file and restore them on another machine. API keys and the GitHub
  token are never included.
- Public-facing docs and GitHub community standards: a rewritten README (with a
  screenshot gallery) and CONTRIBUTING, plus `SECURITY.md`, `CODE_OF_CONDUCT.md`,
  issue forms and a pull-request template.

### Added (earlier in Phase 6)
- **Opt-in, multi-provider AI** — Anthropic (Claude), OpenAI (ChatGPT) and Google
  (Gemini). Each provider keeps its own key, encrypted via the OS keychain (own
  `ai.json`, never plaintext, never crosses the IPC bridge); the active provider
  and a per-provider **model override** are pickable in Settings. Real
  commit-message generation in Git Pulse with a heuristic fallback, plus
  button-triggered **insights**, **power explanations** and **log triage** —
  every call is built in the main process and cached by input hash, never wired
  into a poll.
- **AI key check + model presets** — saving a key now fires a tiny live request
  and reports immediately whether the provider + key + model actually work (so the
  Gemini "free-tier quota: 0 for this model" case is obvious at setup, not at first
  use); there's also a manual **Test** button and per-provider **model preset**
  chips next to the free-text model field.
- **Git Pulse name search** — filter tracked repositories by name, path or branch.
- **Customisable tray dashboard** — choose which tiles the tray popup shows (CPU,
  RAM, active ports, active guards); the popup height adapts to the selection so
  there is never dead space or clipping.
- **Conflict detection** — when a vendor power tool (Lenovo Vantage, Dell Power
  Manager, Armoury Crate, MyASUS, …) is running, OS Power Manager warns that its
  auto-planner may clash; Settings flags when another app already owns the
  Ctrl+Alt+D global hotkey.
- **User-pickable accent colour** (purple, blue, teal, emerald, amber, rose):
  overrides `--primary`/`--accent` on `<html>`, persists in the config and is
  applied before first paint so there is no flash on relaunch.
- **Git Pulse repository discovery**: a bounded-depth (≤3) async scanner that
  skips symlinks/junctions and heavy dirs, plus user-managed scan roots; real
  14-day commit activity replaces the previous random sparkline.
- Shared **SWR-style IPC cache** (`useIpc`/`invalidate`): view switches are
  instant, each channel polls once regardless of how many views read it, and
  polling pauses when no view is mounted.
- Data-viz and depth primitives — radial battery gauge, count-up, sparkline,
  shared `ViewHeader`, raised-glass panels — and onboarding empty states with a
  one-click example launcher profile and snippet starter pack.

### Changed
- **Honest AI data-egress copy.** "Local only · no telemetry sent" was misleading
  once AI is enabled: the Inspector header is now AI-aware, each AI panel discloses
  that running it sends the shown data to your provider, and the Settings copy says
  requests are sent from the app to your chosen provider.
- **Code-split views** (`React.lazy` + Suspense): the ten views load their chunk on
  first open, so first paint carries only the shell and the landing view.
- **Premium redesign ("calm" pass):** removed the background orbs, heavy glows
  and drop-shadows; flat neutral icon tiles; sentence-case labels instead of
  all-caps mono; quiet tinted buttons. One accent across the UI rather than a
  different colour per view.
- **Dev-watcher** discovers processes with `Get-CimInstance` (UTF-8 forced)
  instead of the removed `WMIC`, so process discovery works on Windows 11.
- **OS Power Manager** switches modes through the Windows power-overlay API
  (P/Invoke) — brightness is never touched — with conservative, debounced
  auto-logic that restores the manual choice on AC.
- Theme integrity: the saved theme is applied before first paint and every
  hard-coded colour is tokenised, with a semantic `success`/`warning`/`danger`/
  `info` status palette (Dracula-native).
- Entrance, tab-switch and toast animations are live via `tailwindcss-animate`,
  all guarded by `prefers-reduced-motion`.
- **AI prompts hardened**: each carries an explicit prompt-injection guard
  (tracked repos, logs, diffs and power events are treated strictly as data,
  never as instructions) and asks for concrete, grounded output. Thinking is
  disabled (`thinkingBudget: 0`) for Gemini 2.5/3.x *flash* models so their
  output budget is no longer eaten by chain-of-thought, with raised token
  ceilings; default Gemini model is `gemini-2.5-flash`.
- **Git Pulse & Dev Cleanser** now scan a shared, much broader set of common dev
  locations under the home folder (Desktop, Documents/GitHub, Projects, Code,
  dev, source, repos, workspace, OneDrive-redirected folders, …) instead of a few
  fixed paths — so they find work spread across the machine, not just one folder.
- **New premium app & tray icon**: a larger isometric "Onyx" gem with gradient
  faces, brand glow, edge highlights and a contact shadow — it fills the tile
  instead of sitting small and flat.

### Fixed
- **Session Guard no longer detects Onyx itself** — the process scan excludes the
  app's own Electron processes (by name and by its own PIDs), so it never offers to
  guard or kill itself.
- **The Settings AI test result no longer truncates** — long provider errors (e.g.
  a Gemini quota message) wrap in their own block, tinted by success or failure.
- **Git Pulse repo names keep priority** — the branch badge was shrunk so a repo
  name no longer truncates aggressively next to it.
- **AI errors now name the real cause.** A failing call surfaces the active
  provider's actual message (e.g. Gemini "free-tier quota: 0 for this model")
  instead of a hard-coded "Anthropic is busy", and the in-panel copy /
  attribution follow the selected provider rather than always saying Claude.
- **Tray live-sync**: theme, accent and feature toggles are broadcast to every
  window on save, so the tray mini-dashboard updates instantly instead of staying
  stale until restart; its RAM tile now shows a real usage bar and the window is
  sized to its content (no dead space).
- Long branch names and step labels no longer overflow their cards (Git Pulse
  branch badge, Session Guard step strip).
- **Resilience:** the main process now logs uncaught exceptions and unhandled
  rejections and stays alive, instead of a single unhandled async error (e.g. in
  an AI call) making the window vanish silently with nothing in the log.
- **AI requests can't hang forever:** the OpenAI and Google HTTP calls gained a
  30 s timeout (matching the Anthropic SDK), so a stalled request fails cleanly
  instead of leaving the panel spinning.
- View headers match their sidebar entry: "Focus Tools" → **Focus Mode**,
  "Launch Profiles" → **Launchers**. Shortened the Snippets input placeholders so
  they no longer truncate.
- **Tray popup fits its content exactly** — the renderer now measures its real
  height and the window sizes to it (on open and whenever tiles change), so the
  "Open dashboard" button is never clipped and there is no dead space, whatever
  combination of tiles is enabled.
- **Less idle work:** the tray popup and the main window pause their 2–3 s
  background polls (stats, ports, guards, config) while hidden/minimised, and
  refetch on show.
- **Port Mapper** formats process memory itself from the raw kilobytes, so a
  non-English locale's digit grouping (e.g. the pt-PT non-breaking space) no
  longer corrupts the value.
- **Dev Cleanser** delete path hardened: realpath'd roots and target (closes a
  TOCTOU window), retries on locked files, and surfaces per-path failures
  instead of silently no-op'ing.
- The tray window no longer shrinks on repeated clicks (fractional-DPI rounding
  in the show/hide toggle), and its Open-dashboard button is wired.

## [1.0.0] - 2026-06-11

The 1.0.0 code baseline. Onyx was hardened from a Google-AI-Studio prototype into a
real product through themed, peer-reviewed pull requests.

### Security
- Store the GitHub Personal Access Token with Electron `safeStorage` (OS keychain)
  instead of reversible base64; refuse to persist if encryption is unavailable.
- Close command-injection paths in `ports:kill` and the dev-watcher by validating
  PIDs and using `execFile` (argv array, no shell).
- Restrict `cleaner:delete` to real `node_modules` folders under known scan roots
  (realpath + case-insensitive on Windows) behind a main-process confirmation.
- Restrict `window:openExternal` to `http(s)`; add a production Content-Security-Policy
  and `sandbox`/`webSecurity` on all windows.

### Added
- Real **Launchers**: spawn each profile command and kill the whole process tree on
  stop and on app quit.
- Real **battery** telemetry (Web Battery API) in the OS Power Manager.
- Real app, tray and installer **icons** generated from `assets/icon.svg`
  (`npm run generate:icon`).
- Self-hosted **Inter / JetBrains Mono** fonts; global keyboard focus ring;
  `prefers-reduced-motion` support.
- Shared accessible `Switch`, theme-aware `Logo`, and an in-app `ConfirmModal`.
- Test suite (vitest) — security setup + extracted pure parsers; CI and tagged-release
  GitHub Actions workflows.
- `MIT` license, repository topics, and an issue-tracked roadmap.

### Changed
- Rebranded the product to **Onyx** (from the prototype's mixed "DevBox / Lumina /
  Nexus" identities) across the app, tray, notifications and docs.
- Reframed the "AI Auditor" into an honest **Inspector** showing real repository and
  process state.
- Port Mapper now confirms before killing a process, shows an error/retry state, and
  its header is responsive.

### Fixed
- Notifications no longer throw in the packaged app (`app:notify` was missing from the
  IPC allowlist).
- Git Pulse now reports a remote repo's last commit on first load.
- The test suite runs green (it previously failed to run at all).

### Removed
- Fake/preview-only behaviour: the "AUTO HEAL" UI, fabricated "Lines Audited" metric,
  random battery simulation, and no-op stub handlers.
- Leftover Google-AI-Studio scaffolding and stale branding.
