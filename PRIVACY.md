# Privacy

Onyx is a local-first desktop app. Your data — repositories, files, ports, processes,
clipboard, snippets, API keys — stays on your machine. This document explains the one
optional thing that can leave your device: **anonymous usage telemetry**.

## Telemetry is opt-in and off by default

Nothing is collected or sent unless **you** turn on **Settings → Data → Share anonymous
usage** (or the optional toggle at the end of first-run setup). It is off until you
enable it, and you can turn it off again at any time.

## What is sent (only if you opt in)

A small, fixed set of low-detail values, batched and bucketed by day:

- **App version** (e.g. `1.3.0`)
- **Operating system**, coarse (e.g. `Windows 11`) — never the full build string
- **CPU architecture** (e.g. `x64`)
- **Language** (e.g. `pt`) — never the full region tag
- **Theme** (e.g. `midnight`)
- **A random, resettable id** generated on your device — used only to avoid
  double-counting. It is not derived from your hardware, and you can reset it anytime
  in Settings.
- **Which tool views you open**, as daily counts (e.g. `git: 3`). Just the tool name —
  never what's inside it.

That's the complete list. You can see the exact payload before enabling, via
**Settings → Data → "See exactly what we send"**.

## What is never sent

File paths, repository or branch names, port numbers, process names, clipboard
contents, snippets, AI prompts or responses, API keys, your GitHub token, hostnames,
your username, your IP address, or any free-form text. The collector **drops the IP
address at the edge** and never stores it.

## Where it goes

To a small endpoint we operate ourselves (a Cloudflare Worker), which stores only
aggregate counts — not per-event rows. We do not use a third-party analytics service,
and we do not share or sell anything.

## In development builds

Telemetry never runs in development/unpackaged builds, regardless of the setting.

## Questions

Open an issue at https://github.com/Sepd0x/onyx/issues.
