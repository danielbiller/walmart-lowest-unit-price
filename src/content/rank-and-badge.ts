// Responsibility: reorder tile DOM elements by resolved unit price within
// each comparable group (largest group first), push unpriced tiles to the
// end in original order, and badge/tag tiles accordingly.

import type { TileRecord } from "./dom-scanner";
import { groupByComparableUnit } from "../pricing/units";
import type { EstimatedUnitPrice } from "../pricing/estimate-unit-price";

const BADGE_CLASS = "lup-badge";
const BADGE_TEXT = "Best value";

const ESTIMATE_CLASS = "lup-estimate";
const ESTIMATE_TOOLTIP = "Estimated from product title — please verify.";

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

/** Renders a computed unit price as `≈ $0.25/oz · est.` (2 decimals, 4 when sub-cent). */
export function formatEstimate(unitPrice: EstimatedUnitPrice): string {
  const unit = unitPrice.dimension === "weight" ? "oz" : unitPrice.dimension === "volume" ? "fl oz" : "ct";
  const decimals = unitPrice.pricePerBaseUnit < 0.1 ? 4 : 2;
  return `≈ $${unitPrice.pricePerBaseUnit.toFixed(decimals)}/${unit} · est.`;
}

export type RankGroupSummary = {
  dimension: EstimatedUnitPrice["dimension"];
  count: number;
  cheapestTitle: string;
};

export type RankSummary = {
  pricedCount: number;
  unpricedCount: number;
  groupCount: number;
  groups: RankGroupSummary[];
};

function ensureEstimateTag(tileEl: HTMLElement, unitPrice: EstimatedUnitPrice | null): void {
  const existing = tileEl.querySelector<HTMLElement>(`:scope > .${ESTIMATE_CLASS}`);
  if (unitPrice?.source === "computed") {
    const text = formatEstimate(unitPrice);
    if (existing) {
      existing.textContent = text;
      return;
    }
    const tag = document.createElement("span");
    tag.className = ESTIMATE_CLASS;
    tag.textContent = text;
    tag.title = ESTIMATE_TOOLTIP;
    tileEl.appendChild(tag);
  } else if (existing) {
    existing.remove();
  }
}

/** Removes all estimate tags under scope (used by restore). */
export function removeEstimateTags(scope: ParentNode): void {
  for (const tag of Array.from(scope.querySelectorAll(`.${ESTIMATE_CLASS}`))) {
    tag.remove();
  }
}

/** Removes all best-value badges under scope (used by restore). */
export function removeBadges(scope: ParentNode): void {
  for (const badge of Array.from(scope.querySelectorAll(`.${BADGE_CLASS}`))) {
    badge.remove();
  }
}

/** Removes all ranking stamps under scope (used by restore). */
export function removeRankStamps(scope: ParentNode): void {
  for (const stamped of Array.from(scope.querySelectorAll("[data-lup-ranked]"))) {
    stamped.removeAttribute("data-lup-ranked");
    stamped.removeAttribute("data-lup-unit-price");
  }
}

/**
 * Reorders tile elements in the DOM: each comparable group ascending by unit
 * price (largest group first, ties keep first-seen order), then every
 * tile without a resolved unit price in original relative order. Badges the
 * cheapest tile per group and stamps every priced tile with data-lup-*
 * attributes. Unpriced tiles get no badge and no stamp.
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
): RankSummary {
  const tilesById = new Map(tiles.map((tile) => [tile.id, tile]));

  for (const tile of tiles) {
    const unitPrice = unitPrices.get(tile.id) ?? null;
    if (!unitPrice) {
      ensureEstimateTag(tile.element, null);
      continue;
    }
    tile.element.setAttribute("data-lup-ranked", "true");
    tile.element.setAttribute("data-lup-unit-price", String(unitPrice.pricePerBaseUnit));
    ensureEstimateTag(tile.element, unitPrice);
  }

  const entries = tiles
    .map((tile) => {
      const unitPrice = unitPrices.get(tile.id);
      return unitPrice ? { tileId: tile.id, dimension: unitPrice.dimension } : null;
    })
    .filter((entry): entry is { tileId: string; dimension: EstimatedUnitPrice["dimension"] } => entry !== null);

  // Largest group first; Array.sort is stable so ties keep first-seen order.
  const groups = groupByComparableUnit(entries).sort(
    (a, b) => b.tileIds.length - a.tileIds.length
  );

  const groupSummaries: RankGroupSummary[] = [];

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
    const cheapest = sorted[0];
    groupSummaries.push({
      dimension: group.dimension,
      count: groupTiles.length,
      cheapestTitle: cheapest?.title ?? "",
    });
  }

  // Unpriced tiles trail all priced groups in original relative order.
  for (const tile of tiles) {
    if (unitPrices.get(tile.id)) continue;
    const node = getMovableNode(tile);
    const parent = node.parentElement;
    if (!parent) continue;
    parent.appendChild(node);
    ensureBadge(tile.element, false);
  }

  return {
    pricedCount: entries.length,
    unpricedCount: tiles.length - entries.length,
    groupCount: groups.length,
    groups: groupSummaries,
  };
}
