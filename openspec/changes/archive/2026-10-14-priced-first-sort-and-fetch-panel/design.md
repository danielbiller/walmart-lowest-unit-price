# Design

## Context

See proposal.md (Why). Current state: `activate()` in `src/content/index.ts` scans → fetches pages 2–20 → merges via `importNode` → `rankAndBadge` sorts priced groups in input order, leaving unpriced tiles as anchors → unconditional success toast. Overlay (`overlay.ts`) is text-only with a dismiss button. No order snapshot exists, so restore is impossible without reload.

## Goals / Non-Goals

**Goals:**
- Priced-first ordering with largest-group-first, zero visual change for unpriced relative order.
- One-page default with incremental fetch that reuses the existing merge path.
- Reversible sorts via a pre-sort snapshot; honest counts everywhere.

**Non-Goals:**
- Separate `options_page` settings UI (stepper lives in the panel).
- Surviving Walmart SPA re-renders (out of scope; documented risk).
- Changing pricing/extraction logic or unit vocabulary.

## Decisions

- **Unpriced tail inside `rankAndBadge`, not `index.ts`.** After per-group appends, append each unpriced tile's movable node in original array order. Rationale: single function owns all ordering; `index.ts` keeps hiding ad cells first so hidden nodes never interleave. Alternative (two-pass in index) rejected: splits ordering logic across modules.
- **Largest-group-first via group-length sort, stable.** Sort the `ComparableGroup[]` by descending `tileIds.length`, keeping first-seen order on ties (stable sort). Rationale: two-line change in the existing loop; no cross-dimension price comparison (meaningless across dimensions).
- **Split `activate()` into `initialSort()` + `fetchMore(n)`.** Shared core: `mergePages(tiles)` + `resort()`. Rationale: the +5/all buttons reuse the exact tested merge path instead of a second implementation. Page cursor (`lastFetchedPage`) persists in module state for the session.
- **Snapshot = ordered slot list + hidden-cell list.** Before first mutation, record `outerRow` children order and which children were hidden. Restore re-appends in recorded order, unhides, strips badges/tags/stamps. Rationale: slot-level (not tile-level) snapshot restores imported nodes and ad cells exactly; no Walmart markup knowledge needed.
- **Reshow without re-sort via run record.** Keep `{ url, counts, groups, snapshot }` of the last completed run; icon message on the same URL with a live run record only re-renders the toast. Rationale: toolbar clicks are idempotent and free; new URL/reload invalidates the record.
- **Estimate tags via `EstimatedUnitPrice.source`.** In the stamp loop, `source === "computed"` inserts `span.lup-estimate` (`≈ $X/unit · est.`, `title` tooltip) next to the price node using `createElement`/`textContent`. Rationale: source field already distinguishes; no new plumbing. Rounding: 2 decimals weight/volume, up to 4 for sub-cent count values.
- **Panel extends the overlay root.** Toast line + hidden expandable section in the same fixed bottom-right container; buttons wire to `fetchMore`/restore/stepper. Rationale: immune to Walmart re-renders, reuses existing styles/positioning that survived live testing.

## Risks / Trade-offs

- [Risk] Walmart SPA re-render drops imported nodes or restores order → panel counts then disagree with the grid. Mitigation: reshow/row-verify on panel expand; document as known limitation.
- [Risk] Page-2+ `fetch()` bot-blocked (observed live: `/blocked`, 0 tiles) → fetch-more silently yields one page. Mitigation: surface “extra pages returned no tiles” in the toast instead of silent success.
- [Risk] Snapshot memory on huge merges (hundreds of nodes) → negligible (references only, no clones).
- [Trade-off] Largest-group-first can bury a tiny group the user cares about → accepted; per-group rows in the panel make every group visible.

## Migration Plan

No migration: additive behavior changes behind the same toolbar click. Rollback = prior `dist/` build.

## Open Questions

None — panel copy finalizes during implementation from spec scenarios.
