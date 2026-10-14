# Tasks

## 1. Ranking core (unpriced tail + largest-group-first)

- [x] 1.1 Reorder `rankAndBadge` to sort groups largest-first (stable on ties), then append unpriced movable nodes in original order; verify with new Vitest cases (mixed priced/unpriced, multi-group sizes, tie order) via `npm test`.
- [x] 1.2 Confirm unpriced tiles get no badge/stamp and ad-cell hiding still precedes ordering; verify via jsdom test asserting hidden cells stay hidden and unranked tiles keep relative order.

## 2. Fetch default + incremental core

- [x] 2.1 Set default max pages to 1 and split activation into initial-sort plus resumable fetch-more from last-fetched page; verify `npm test` incl. `maxPages=1` fires zero fetches.
- [x] 2.2 Surface fetch-block signal: when extra pages yield zero tiles, report it in the outcome instead of silent success; verify with mocked empty/blocked page-2 test.

## 3. Estimate tags

- [x] 3.1 Insert `≈ $X/unit · est.` tag with verify tooltip on `source === "computed"` tiles only (createElement/textContent, `lup-estimate` class); verify with unit tests for formatting per dimension and a jsdom test that displayed-source tiles get no tag.
- [x] 3.2 Strip tags on restore path; verify via restore test asserting zero `.lup-estimate` nodes remain.

## 4. Panel (toast honesty, dashboard, restore, reshow)

- [x] 4.1 Honest toast counts (priced / moved-to-end / groups / pages) with zero-priced state; verify via jsdom assertions on overlay text for partial and empty outcomes.
- [x] 4.2 Expandable dashboard: per-group rows, page-cap stepper (1–20, default 1), +5/all buttons wired to incremental fetch, restore control from pre-sort slot snapshot; verify snapshot/restore round-trip test returns children order, badges, tags, and hidden cells exactly.
- [x] 4.3 Run-record reshow: icon re-click on same URL reopens toast with no fetch/DOM work; new URL reloads fresh; verify with message-handler tests for both branches.
- [x] 4.4 Persistent bottom-right placement with `aria-live` toast and dismiss/supersede/navigation-hide rules; verify via jsdom visibility tests.

## 5. Integration verification

- [x] 5.1 `npm test` full suite green and `npm run build` produces valid `dist/`; verify with both commands passing.
- [x] 5.2 Live scratch validation (paper towels): priced-front order, panel states, restore, incremental fetch; verify with marker assertions plus screenshots in `/tmp` harness.

## 6. Rail-proofing (scan scope + abort)

- [x] 6.1 Add rail-tile exclusion in `grid-container.ts` (carousel-container / slide-item / horizontal-scroller ancestors; no heading keywords, no positional hooks); verify with jsdom unit tests mirroring the live rail structure.
- [x] 6.2 Wire exclusion pre-vote in `initialSort` and `fetchPageTiles` (keep `contains()` backstop); verify with tests for rail-ignored counts/moves/stamps and rail-outnumbers-grid still finding the grid.
- [x] 6.3 Honest abort with a distinct toast and zero DOM mutation when exclusion leaves no tiles; verify with an all-rail jsdom test plus full `npm test` green and `npm run build` valid.
