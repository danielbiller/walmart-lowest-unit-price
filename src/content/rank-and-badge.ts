// Responsibility: reorder tile DOM elements by resolved unit price within
// each comparable group, and badge each tile with its unit price / rank.

import type { TileRecord } from "./dom-scanner";
import { groupByComparableUnit } from "../pricing/units";
import type { EstimatedUnitPrice } from "../pricing/estimate-unit-price";

const BADGE_CLASS = "lup-badge";
const BADGE_TEXT = "Best value";

function ensureBadge(tileEl: HTMLElement, isCheapest: boolean): void {
  const existing = tileEl.querySelector<HTMLElement>(`:scope > .${BADGE_CLASS}`);
  if (isCheapest) {
    if (existing) return;
    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = BADGE_TEXT;
    tileEl.prepend(badge);
  } else if (existing) {
    existing.remove();
  }
}

/**
 * Reorders each comparable group's tile elements in the DOM by ascending
 * unit price, badges the cheapest tile per group, and stamps every priced
 * tile with data-lup-* attributes. Tiles without a resolved unit price are
 * left untouched (not reordered, not grouped, no badge).
 *
 * `getMovableNode` lets the caller move a different node than the tile
 * element itself (e.g. Walmart's own per-item grid-cell wrapper around the
 * tile), so reordering can preserve the page's exact original grid markup.
 * Defaults to the tile element for backward compatibility.
 */
export function rankAndBadge(
  tiles: TileRecord[],
  unitPrices: Map<string, EstimatedUnitPrice | null>,
  getMovableNode: (tile: TileRecord) => Element = (tile) => tile.element
): void {
  const tilesById = new Map(tiles.map((tile) => [tile.id, tile]));

  for (const tile of tiles) {
    const unitPrice = unitPrices.get(tile.id);
    if (!unitPrice) continue;
    tile.element.setAttribute("data-lup-ranked", "true");
    tile.element.setAttribute("data-lup-unit-price", String(unitPrice.pricePerBaseUnit));
  }

  const entries = tiles
    .map((tile) => {
      const unitPrice = unitPrices.get(tile.id);
      return unitPrice ? { tileId: tile.id, dimension: unitPrice.dimension } : null;
    })
    .filter((entry): entry is { tileId: string; dimension: EstimatedUnitPrice["dimension"] } => entry !== null);

  const groups = groupByComparableUnit(entries);

  for (const group of groups) {
    const groupTiles = group.tileIds
      .map((id) => tilesById.get(id))
      .filter((tile): tile is TileRecord => tile !== undefined);

    const sorted = [...groupTiles].sort((a, b) => {
      const priceA = unitPrices.get(a.id)?.pricePerBaseUnit ?? Infinity;
      const priceB = unitPrices.get(b.id)?.pricePerBaseUnit ?? Infinity;
      return priceA - priceB;
    });

    // Same-parent siblings only move relative to each other; appendChild on
    // an existing node repositions it without cloning/recreating it.
    sorted.forEach((tile, index) => {
      const node = getMovableNode(tile);
      const parent = node.parentElement;
      if (!parent) return;
      parent.appendChild(node);
      ensureBadge(tile.element, index === 0);
    });
  }
}
