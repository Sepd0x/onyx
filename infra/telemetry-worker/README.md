# Onyx telemetry collector (Cloudflare Worker)

The self-hosted endpoint for Onyx's **opt-in, anonymous** telemetry. It validates the
payload, writes **only aggregate counters** to Workers Analytics Engine, and **never**
logs or stores the client IP. See the repo's `PRIVACY.md` for the user-facing policy.

## Deploy (one-time)

```sh
npm i -g wrangler
wrangler login
cd infra/telemetry-worker
wrangler deploy
```

Then copy the deployed URL (e.g. `https://onyx-telemetry.<subdomain>.workers.dev`) into
`TELEMETRY_ENDPOINT` in `packages/tools/telemetry/index.js` and ship a build. Until
that constant is set, the app's toggle and batching work end-to-end but nothing is
transmitted.

## What it accepts

A single `POST` of the JSON payload built by `packages/tools/telemetry/payload.js`
(app version, coarse OS, arch, language, theme, a random resettable id, and daily
`tool_opened` / `app_launched` / `update_applied` counts). Anything with extra keys or
PII-looking values is rejected with `422`. The free Workers tier is ample.
