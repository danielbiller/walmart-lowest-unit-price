# Active Context — walmart-lowest-unit-price

## Current focus

Change `priced-first-sort-and-fetch-panel` archived 2026-10-14
(15/15 tasks, 4 main specs synced, validated). Single commit pending.
Next change: dup-id merge, ads/SPA resolution (needs user DevTools
checks), per-dimension badge labels — all diagnosed, none implemented.

## Recent changes

- Initial commit only (`c5dcf2f`). `?? .opencode/` (commands + node_modules)
  and `?? openspec/` (config + empty `.gitkeep`s) uncommitted.
- No `dist/`, no root `node_modules/` — `npm install/test/build` not yet run
  in this session.

## Next steps

1. `npm install && npm test && npm run build` to verify baseline.
2. Optional live e2e via Playwright MCP Chromium against one Walmart search URL.
3. Keep memory bank updated on significant changes (pricing regex, grid
   heuristics, pagination limit).

## Active decisions / learnings

- Page-total estimates from result-count ÷ page-1 tiles proven wrong both
  directions → overlay shows only current page while loading.
- Majority-vote grid ancestor (not every-tile containment) handles side
  carousels; trailing empty page excluded from `pagesFetched`.
- `.opencode/.gitignore` excludes its own `node_modules/package*.json` —
  commit commands + references, never those.
