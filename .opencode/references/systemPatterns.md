# System Patterns — walmart-lowest-unit-price

## Architecture

```
service-worker (lup:activate msg)
  → content/index.ts activate()
    → dom-scanner.scanTiles()       TileRecord{id, element, title, priceText, displayedUnitPriceText}
    → paginate.collectAllPages()    PageTile{tile, slot} from detached DOMParser docs
    → pricing.estimateUnitPrice()   EstimatedUnitPrice{pricePerBaseUnit, dimension, source}
    → grid-container.findGridAncestor/findSlot
    → rank-and-badge.rankAndBadge() reorder + badge + data-lup-* attrs
    → overlay.updateOverlay()       status banner
```

## Key decisions

- **Selector resilience:** tile selection uses `[data-item-id]` + `data-testid`/
  `data-automation-id` substrings + `aria-label`/visible-text regex. Never
  class names (Walmart obfuscates/churns them). Price prefers `aria-label`
  over concatenated `$`+dollars+cents text nodes.
- **Duplicate ids:** same `data-item-id` can repeat (grid + carousel) → suffix
  `#N` per scan so Map-keyed ranking never collapses distinct DOM nodes.
- **Grid ancestor:** majority-vote climb (≤8 levels) to shared row, ignoring
  minority carousel outliers. `findSlot` = direct child of row wrapping tile;
  moving the slot preserves Walmart cell markup/CSS.
- **Cross-page import:** `document.importNode(slot, true)` per other-page tile,
  appended to live row before ranking.
- **Pricing pipeline:** `parseDisplayedUnitPrice` first (handles `/100 ct`
  denominator form); fallback `estimateUnitPrice` from title (`2x16 oz`,
  `24 Pack`, `500 mL`) + total price. `toBaseUnit` normalizes to oz / fl oz /
  ct; `groupByComparableUnit` buckets by dimension — dimensions never mix.
- **Ranking:** per-group ascending sort, `appendChild` reposition (no
  clone/recreate → SPA listeners intact), `ensureBadge` exactly one
  `Best value` badge per group, `data-lup-ranked`/`data-lup-unit-price` stamps
  for e2e assertions.

## Critical paths

- `src/content/index.ts:activate` — full orchestration, ad-cell hiding.
- `src/content/dom-scanner.ts:scanTiles` — extraction contract.
- `src/pricing/estimate-unit-price.ts:estimateUnitPrice` — displayed-first logic.
