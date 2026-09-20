# Walmart Lowest Unit Price

A Chrome extension (Manifest V3) that re-sorts Walmart search/browse result
pages by **unit price** (price per ounce/count/etc.), so the genuinely
cheapest product is easy to spot instead of just the lowest sticker price.

## How it works

Click the extension icon on any `walmart.com/search` or `walmart.com/browse`
page. The content script:

1. Scans the visible grid for product tiles and parses each one's displayed
   unit price (e.g. `$0.82/oz`).
2. Fetches and parses every subsequent results page (up to 20) so the whole
   result set can be ranked, not just the first page.
3. Reorders Walmart's own grid cells in place — so the layout looks identical
   to the normal Walmart grid, just sorted lowest-unit-price first — and
   badges the best-value item.

Non-product cells (ads, promo tiles) are left untouched instead of being
folded into the sort.

## Development

```bash
npm install
npm test          # vitest unit tests
npm run build      # bundles src/ -> dist/ via esbuild
npm run watch       # rebuild on change
```

Load the extension for local testing:

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select the `dist/` folder.

## Project layout

- `src/content/` — content script: DOM scanning, pagination, grid
  reordering/badging, status overlay.
- `src/pricing/` — unit price parsing and unit conversion.
- `src/background/` — service worker that activates the content script when
  the toolbar icon is clicked.
- `tests/` — Vitest unit tests for the modules above.
- `.github/agents/` — role definitions used to build this extension with a
  multi-agent workflow (architecture, DOM scraping, pricing logic, ranking
  UI, QA, live e2e validation, review).

## Live browser validation

This repo includes a [Playwright MCP](https://github.com/microsoft/playwright-mcp)
config (`.vscode/mcp.json`, `.vscode/playwright-mcp.config.json`) for driving
a real Chromium instance with the unpacked extension loaded, to validate
behavior against live walmart.com pages.

**Note:** branded Google Chrome ignores `--load-extension`/
`--disable-extensions-except`; the config targets unbranded **Chromium**
(`browserName: "chromium"`) instead, installable via:

```bash
npx @playwright/mcp install-browser chromium
```

## License

[MIT](LICENSE)
