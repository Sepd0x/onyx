# Security Policy

Onyx is a local-first developer toolkit that handles things like API keys, a GitHub token,
and process/port control. We take its security posture seriously.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via a
[GitHub security advisory](https://github.com/Sepd0x/onyx/security/advisories/new). Include:

- a description of the issue and its impact,
- steps to reproduce (a proof of concept if you have one),
- the Onyx version and your OS.

You can expect an initial acknowledgement within a few days. We'll keep you updated as we
investigate and ship a fix, and we're happy to credit you in the release notes if you'd like.

## Supported versions

Onyx is pre-1.0 release; security fixes target the latest `main` and the most recent tagged
build. Older builds are not patched — please update to the newest release.

## How Onyx protects you

These are the design guarantees the codebase upholds (see [`ARCHITECTURE.md`](ARCHITECTURE.md)):

- **Sandboxed renderer.** `contextIsolation` is on, `nodeIntegration` is off, and the preload
  is sandboxed. The UI has no direct shell or filesystem access — everything goes through a
  validated IPC allowlist.
- **Secrets stay local and encrypted.** API keys and the GitHub token are encrypted at rest via
  the OS keychain (`safeStorage`) and never cross the IPC bridge to the renderer.
- **Network calls run in main.** A Content-Security-Policy blocks renderer egress; AI/network
  requests are made from the main process only, against your own keys.
- **No telemetry.** Onyx makes no network calls of its own. The only outbound traffic is the
  AI request *you* trigger, sent to the provider *you* configured.
- **Validated external links.** Links open through a single validated path that allows `http`/
  `https` only.
