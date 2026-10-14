# Tech Context — walmart-lowest-unit-price

## Stack

- TypeScript 5.5 strict (`noUnusedLocals`, `noUnusedParameters`,
  `noImplicitReturns`), target ES2020, `moduleResolution: bundler`, `noEmit`.
- esbuild 0.23 bundles `src/content/index.ts → dist/content.js` (IIFE) and
  `src/background/service-worker.ts → dist/background.js` + copies
  `manifest.json`, `styles.css`, `icons/`. `npm run watch` for rebuild-on-change.
- Vitest 2 + jsdom 29. `vitest.config.ts`: `environment: node` default;
  `tests/content/*.test.ts` opt into jsdom via `// @vitest-environment jsdom`
  (needs `DOMParser`/`document`).
- No runtime dependencies. MV3, no `default_popup` (so `onClicked` fires),
  service worker only relays `lup:activate`.

## Layout

- `src/content/` — `index.ts`, `dom-scanner.ts`, `grid-container.ts`,
  `paginate.ts`, `rank-and-badge.ts`, `overlay.ts`, `styles.css`.
- `src/pricing/` — `units.ts`, `parse-displayed-unit-price.ts`,
  `estimate-unit-price.ts`.
- `src/background/service-worker.ts` — click relay.
- `tests/pricing/`, `tests/content/` — mirror of modules above.
- `.github/agents/` — architect/dom-scraper/pricing/ranking/qa/e2e/
  orchestrator/reviewer role defs. `.vscode/mcp.json` — Playwright MCP on
  unbranded Chromium (`--load-extension=dist`, branded Chrome drops the flag).

## Constraints

- `npm test` (vitest run), `npm run build` must pass; manifest stays MV3-valid.
- Live e2e needs `npx @playwright/mcp install-browser chromium` once, then
  single-navigation runs asserting only on `data-lup-*`/badge markers.
- `dist/`, `node_modules/`, `.playwright-mcp/` gitignored.
