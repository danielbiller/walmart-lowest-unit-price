# Proposal

## Why

Live validation showed the sort works but misleads: unpriced items act as fixed anchors (21 of 320 tiles moving is invisible), the success toast claims a sort it barely performed, the 20-page default drags in irrelevant products, and there is no way back except reloading the page. The extension needs honest feedback, user-controlled fetching, and an undo.

## What Changes

- Priced tiles sort first (ascending within each unit group); unpriced tiles move to the end in original relative order, unbadged and unstamped.
- Multi-group order becomes largest-group-first (ties keep first-seen order) instead of input order.
- Default page-fetch cap becomes 1; “+5 more” / “fetch all” (hard ceiling 20) run incrementally from the results panel.
- Toast reports honest counts (priced / moved-to-end / groups) and expands into a dashboard: per-group rows, page-cap stepper, fetch-more buttons, restore original order.
- Title-guessed unit prices get a visible `≈ $X/unit · est.` tag with a verify tooltip; displayed-source prices stay untouched.
- Icon re-click on the same results reopens the toast with no re-sort; panel is viewport-fixed bottom-right and persistent until dismissed, superseded, or navigated away.

## Capabilities

### New Capabilities

- `unit-sort`: priced-first ordering, largest-group-first, unpriced tail in original order.
- `result-fetching`: default 1-page cap with incremental +5 / fetch-all up to 20 pages.
- `result-panel`: honest toast, expandable dashboard, inline page-cap stepper, restore original order, re-click reshow semantics, persistent bottom-right placement.
- `price-estimates`: visible `≈ $X/unit · est.` tag with verify tooltip on title-guessed tiles only, stripped on restore.

### Modified Capabilities

(none — no existing specs in this project)

## Impact

- `src/content/rank-and-badge.ts` (ordering + tags), `src/content/index.ts` (default cap, activate split, pre-sort snapshot, reshow), `src/content/overlay.ts` + `styles.css` (panel), `manifest.json` (only if a settings/options page proves necessary — currently not planned).
- `tests/content/` + `tests/pricing/` extended; live validation via existing scratch Chromium harness in `/tmp`.
- No host-permission changes; no new runtime dependencies.
