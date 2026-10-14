# Product Context — walmart-lowest-unit-price

## Why it exists

Walmart sticker prices mislead: a $4 small bag can cost more per ounce than
a $9 family pack. Shoppers want the true cheapest option without mental math
across pages of results.

## How it works (user view)

1. User navigates to a Walmart search or browse listing.
2. User clicks the extension toolbar icon.
3. Bottom-right overlay reports progress: `Loading page 2…` … `Loading page N…`.
4. Grid reorders lowest-unit-price first; cheapest tile per comparable group
   gets a green `Best value` badge.
5. Overlay completes: `Showing X products across N page(s), sorted by unit price.`
   Dismissible via × button. Failures show partial/original-results message.

## UX goals

- Grid looks identical to Walmart's own (same cell markup/CSS) — only order
  changes, so no visual jank or broken SPA listeners.
- Never mix incompatible units ($/oz vs $/ct are separate groups, each with
  its own best-value winner).
- Unpriced tiles (no displayed + no computable unit price) stay in place,
  unstamped, unbadged — never guessed.
- Non-product cells hidden rather than sorted, so ads don't pollute ranking.
