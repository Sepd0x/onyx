# Changelog

All notable changes to Onyx are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project aims at
[Semantic Versioning](https://semver.org/).

## [Unreleased]

Onyx is being hardened from a prototype toward its first stable release
(**v1.0.0**). Work is organized as themed, peer-reviewed pull requests; the full
findings and plan live in [`AUDIT.md`](AUDIT.md).

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
