# Contributing

1. Create a descriptive branch (`feature/new-tool`).
2. Adhere to the OLED Deep Dark typography principles found in `tailwind.config.js`.
3. Never bypass `preload.js`. Backend logic must sit in `packages/tools/` and expose exact signatures to `packages/core/src/preload.js`.
