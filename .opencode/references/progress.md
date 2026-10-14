# Progress — walmart-lowest-unit-price

## What works

- Tile scan (`data-item-id`, aria-label price preference, unit-price regex,
  duplicate-id disambiguation, MutationObserver rescan).
- Displayed unit-price parse incl. `$1.06/100 ct` form; title fallback
  (multipack `2x16 oz`, `24 Pack`, simple `16 oz`/`500 mL`) with oz/fl oz/ct
  base conversion.
- Dimension grouping (weight/volume/count never mixed), per-group ascending
  sort, single `Best value` badge, `data-lup-*` stamps.
- Cross-page fetch (pages 2–20, 350ms gap, early stop on empty, detached-doc
  slot import), ad-cell hiding, overlay progress/completion/error states.
- Unit tests for pricing + paginate + grid-container; esbuild build;
  multi-agent + Playwright MCP scaffolding.

## What's left

- Baseline verify: `npm install`, `npm test`, `npm run build` in this env.
- Live-browser validation on real walmart.com (Chromium + `dist/`).
- No open code changes pending; `openspec/specs/` empty (no active changes).

## Known issues

- Walmart markup churn → selectors avoid classes but still depend on
  `data-item-id`/`data-testid` stability.
- Page-1 tile count unreliable as items-per-page (ads/duplicates vary).
- Mixed-dimension result sets rank within groups only — no global winner.
- Branded Chrome ignores `--load-extension`; e2e must use unbranded Chromium.
