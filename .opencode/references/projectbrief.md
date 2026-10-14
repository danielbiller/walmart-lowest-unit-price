# Project Brief — walmart-lowest-unit-price

Chrome extension (Manifest V3) that re-sorts Walmart `search`/`browse` result
pages by **unit price** (price per oz/fl oz/lb/ct/etc.), so the genuinely
cheapest product surfaces first instead of the lowest sticker price.

## Core requirements

- Click toolbar icon on any `walmart.com/search` or `walmart.com/browse` page
  → content script activates via `chrome.tabs.sendMessage({type: "lup:activate"})`.
- Scan visible grid for product tiles, parse each displayed unit price
  (e.g. `$0.82/oz`, `$1.06/100 ct`).
- Fetch subsequent result pages (up to 20, `?page=N`, 350ms delay, stop on
  empty page) so the whole result set is ranked, not just page 1.
- Reorder Walmart's own grid-cell wrappers in place (layout identical, only
  order changes) and badge the best-value item per comparable group.
- Leave non-product cells (ads, promo takeovers) untouched/hidden, never
  folded into the sort.

## Scope boundaries

- `host_permissions` + `content_scripts` scoped strictly to Walmart
  search/browse paths. No broad hosts, no `default_popup`.
- No `innerHTML`/`insertAdjacentHTML`/`eval`/remote code (third-party page
  content). Safe DOM APIs only (`createElement`, `textContent`).
- Pricing modules are pure (no DOM); DOM modules never compute prices.

## Source of truth

This file defines scope. `productContext.md` (why), `systemPatterns.md`
(architecture), `techContext.md` (stack) build on it.
