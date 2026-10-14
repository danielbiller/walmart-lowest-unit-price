// Responsibility: locate the true shared ancestor of the current page's tiles
// so reordering happens at the right level. Walmart's grid is built from many
// individually-wrapped cells (one tile per wrapper), so a tile's immediate
// parentElement is just its own cell, not "the grid". Page also contains
// small unrelated widgets (e.g. horizontal carousels) that also match our
// tile selector — requiring an ancestor to contain *every* tile would force
// walking up past the real grid row to whatever generic wrapper happens to
// also contain those few outlier tiles. Instead, find the ancestor shared by
// a strict majority of tiles (climbing level by level, shallowest first),
// which lands on the real grid row and ignores a handful of outliers.

import type { TileRecord } from "./dom-scanner";

// Structural carousel/rail markers, observed live: rail tiles sit under a
// carousel container of slide items inside a named horizontal scroller.
// Matched structurally (no heading keywords, no positional hooks), so the
// rule survives copy changes and reorderings.
const RAIL_ANCESTOR_SELECTOR =
  'ul[data-testid="carousel-container"], li[data-slide], [data-testid^="horizontal-scroller-"]';

/** True when the tile lives inside a rail/carousel section, not the results grid. */
export function isRailTile(element: Element): boolean {
  return element.closest(RAIL_ANCESTOR_SELECTOR) !== null;
}

/** Drops rail/carousel tiles so they never enter grid voting, moves, or counts. */
export function excludeRailTiles(tiles: TileRecord[]): TileRecord[] {
  return tiles.filter((tile) => !isRailTile(tile.element));
}

export function findGridAncestor(tiles: TileRecord[]): Element | null {
  if (tiles.length === 0) return null;

  const majority = Math.floor(tiles.length / 2) + 1;
  let level: (Element | null)[] = tiles.map((tile) => tile.element.parentElement);

  for (let depth = 0; depth < 8; depth++) {
    const counts = new Map<Element, number>();
    for (const node of level) {
      if (!node) continue;
      counts.set(node, (counts.get(node) ?? 0) + 1);
    }
    for (const [ancestor, count] of counts) {
      if (count >= majority) return ancestor;
    }
    if (level.every((node) => node === null)) break;
    level = level.map((node) => node?.parentElement ?? null);
  }

  // Fallback: whichever ancestor was shared by the most tiles, even short of a majority.
  let best: Element | null = null;
  let bestCount = 0;
  const counts = new Map<Element, number>();
  for (const tile of tiles) {
    let node: Element | null = tile.element.parentElement;
    for (let depth = 0; depth < 8 && node; depth++) {
      counts.set(node, (counts.get(node) ?? 0) + 1);
      node = node.parentElement;
    }
  }
  for (const [ancestor, count] of counts) {
    if (count > bestCount) {
      best = ancestor;
      bestCount = count;
    }
  }
  return best ?? tiles[0].element.parentElement;
}

/**
 * Finds the direct child of `ancestor` that is-or-contains `element` — i.e.
 * Walmart's own per-item grid cell wrapper for that element. Moving this node
 * (rather than the tile element itself) preserves Walmart's exact cell
 * markup/CSS, so reordering never changes how the grid looks structurally.
 */
export function findSlot(element: Element, ancestor: Element): Element {
  let current = element;
  while (current.parentElement && current.parentElement !== ancestor) {
    current = current.parentElement;
  }
  return current;
}
