<!--
  Thanks for the contribution! Keep PRs small and themed.
  See CONTRIBUTING.md for the conventions.
-->

## What & why

<!-- What does this change, and why? Link any related issue. -->

Closes #

## Type of change

- [ ] `feat` — new capability
- [ ] `fix` — bug fix
- [ ] `design` — UI / UX / styling
- [ ] `docs` — documentation only
- [ ] `refactor` / `chore` / `perf` / `test`

## Pre-merge checklist

- [ ] `npm run typecheck` is clean
- [ ] `npm test` is green
- [ ] `npm run build` succeeds
- [ ] If a new IPC channel was added, it's wired in **all** layers (`channels.js`, `preload.js`, `ipc.ts`, the tool handler, `mockApi.ts`)
- [ ] Verified live in the app for anything UI-observable
- [ ] No secrets, personal data, or machine paths in the diff

## Notes for reviewers

<!-- Anything worth calling out: screenshots for UI changes, trade-offs, follow-ups. -->
