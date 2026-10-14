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

- DONE 2026-10-14 (`priced-first-sort-and-fetch-panel`, apply all_done):
  priced-first ordering with largest-group-first, unpriced tail, 1-page
  default + incremental fetch-more, honest toast → expandable panel
  (stepper/+5/all/restore/reshow/nav-guard), `≈ $X/unit · est.` tags on
  title guesses. 62/62 Vitest (was 33), live PASS 10/10 incl. exact restore
  (40/40 cells, 0 markers) and honest fetch-block stall note.
- Live verification also fixed a real bug found by the harness: restore now
  strips lup-* markers document-wide (carousel outliers kept stamps).
- Next: review diff, then `/opsx-archive` (syncs 4 new specs to mains).
  `tsc --noEmit` still reports pre-existing `chrome`-type errors (no
  @types/chrome); esbuild build unaffected — not introduced by this change.
- FIX 2026-10-14: stray extra `}` after `.lup-estimate` in
  `src/content/styles.css` (introduced with the tag styles) removed; braces
  verified balanced, `dist/` rebuilt. Base toast rules were untouched —
  if Brave still shows unstyled text after extension reload, cause is
  missing/blocked stylesheet injection, not the file.
- FIX 2026-10-14 (user-reported, post-change): (a) split-node unit prices
  (`$0.82`+`/oz` across spans, no aria) now caught via separator-free
  joined-leaf fallback in `extractUnitPriceText` — these tiles previously
  fell through to title-guess est tags; (b) grid scoping — tiles outside
  the majority grid row (Buy-it-again rails, carousels) are excluded from
  slots/merge/counts in `initialSort` and `fetchPageTiles`. 67/67 Vitest.
- OPEN: user reports duplicate same-dimension groups (impossible per
  `groupByComparableUnit` — likely oz vs fl oz); awaiting exact panel
  rows to confirm before touching grouping.
- SPEC UPDATE 2026-10-14 (post-apply, validated): rail/carousel exclusion
  + honest abort added to `unit-sort`/`result-panel` deltas from the user's
  live DOM (carousel-container/slide/horizontal-scroller hooks; no heading
  keywords, no positional hooks). No implementation tasks yet — follow-up.
- IMPLEMENTED 2026-10-14 (Group 6, apply all_done 15/15): rail exclusion
  pre-vote in `initialSort`/`fetchPageTiles` (`isRailTile` structural match,
  `contains()` backstop kept), distinct abort toast, 76/76 Vitest, `dist/`
  rebuilt. Your DOM also confirmed: `tile-take-over` ads + video cells carry
  no item-id (already hidden), a11y price spans validate the ¢-parse path.
- ARCHIVED 2026-10-14: change → `openspec/changes/archive/
  2026-10-14-priced-first-sort-and-fetch-panel/`; 4 main specs created
  (unit-sort, result-fetching, result-panel, price-estimates), validated.
  No active changes remain.
- FIX 2026-10-14 (post-change, user data): cent-denominated unit prices
  (`26.0 ¢/100 ct` → $0.0026/ct, `5.9 ¢/count`, `4.2 ¢/ea`) now parsed in
  `parse-displayed-unit-price.ts` + extraction regex, `count` aliased to
  ct in `units.ts`. These tiles previously fell to the tail. 71/71 Vitest.

## Known issues

- Walmart markup churn → selectors avoid classes but still depend on
  `data-item-id`/`data-testid` stability.
- Page-1 tile count unreliable as items-per-page (ads/duplicates vary).
- Mixed-dimension result sets rank within groups only — no global winner.
- Branded Chrome ignores `--load-extension`; e2e must use unbranded Chromium.
- LIVE FINDING 2026-10-14: extension `fetch()` of `?page=2` returns HTTP 200
  but lands on `/blocked` ("Robot or human?", 0 tiles) while full page
  navigation passes — PerimeterX keys on navigation-like requests, so
  `collectAllPages` early-stops and live runs sort page 1 only
  ("70 products across 1 page(s)"). Possible future fix: scrape page 2 via
  hidden tab/iframe instead of `fetch()`. Unit tests unaffected (mocked).
