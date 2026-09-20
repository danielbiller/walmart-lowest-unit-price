// Entry point: wires dom-scanner -> paginate -> pricing -> rank-and-badge.
// No scanning/pricing/ranking logic lives here — stub wiring only.

import { scanTiles } from "./dom-scanner";
import type { TileRecord } from "./dom-scanner";
import { estimateUnitPrice } from "../pricing/estimate-unit-price";
import { rankAndBadge } from "./rank-and-badge";
import { collectAllPages } from "./paginate";
import { updateOverlay } from "./overlay";
import { findGridAncestor, findSlot } from "./grid-container";

const MAX_PAGES = 20;

function computeUnitPrices(tiles: TileRecord[]) {
  return new Map(
    tiles.map((tile) => [
      tile.id,
      estimateUnitPrice({
        title: tile.title,
        priceText: tile.priceText,
        displayedUnitPriceText: tile.displayedUnitPriceText,
      }),
    ])
  );
}

async function activate(): Promise<void> {
  const currentTiles = scanTiles();
  if (currentTiles.length === 0) {
    updateOverlay("No products found on this page.");
    return;
  }

  // Don't claim a total page count while loading: it can only be estimated
  // from Walmart's result count ÷ page-1 tile count, and page 1's tile count
  // is an unreliable stand-in for "items per page" (ads/duplicate placements
  // vary per page) — this has been observed wrong in both directions. Only
  // the current page number is ever shown; the real total is only stated
  // once known, in the completion message below.
  updateOverlay("Loading page 2…");

  const { pageTiles: otherPageTiles, pagesFetched: otherPagesFetched } = await collectAllPages(
    location.href,
    MAX_PAGES,
    (pageIndex) => updateOverlay(`Loading page ${pageIndex}…`)
  );
  const pagesFetched = 1 + otherPagesFetched;

  // The real Walmart grid: one shared row containing one grid-cell wrapper
  // per product. Reordering moves those cell wrappers (preserving Walmart's
  // exact markup/CSS) rather than replacing the grid with anything of our
  // own, so the layout looks identical — only the item order changes.
  const outerRow = findGridAncestor(currentTiles) as Element;
  const slotByTileId = new Map<string, Element>();
  for (const tile of currentTiles) {
    slotByTileId.set(tile.id, findSlot(tile.element, outerRow));
  }

  // Other pages' tiles/slots belong to detached DOMParser documents. Import
  // each tile's own grid-cell wrapper (not just the tile) so cross-page
  // products carry the same real Walmart cell markup, then append it into
  // the live row alongside the current page's own cells.
  const otherTiles: TileRecord[] = [];
  for (const { tile, slot } of otherPageTiles) {
    const importedSlot = document.importNode(slot, true) as HTMLElement;
    outerRow.appendChild(importedSlot);
    const importedTileEl = importedSlot.matches("[data-item-id]")
      ? importedSlot
      : importedSlot.querySelector<HTMLElement>("[data-item-id]");
    tile.element = importedTileEl ?? importedSlot;
    slotByTileId.set(tile.id, importedSlot);
    otherTiles.push(tile);
  }

  const mergedTiles = [...currentTiles, ...otherTiles];

  // The grid row can also contain non-product cells (e.g. a promotional
  // "tile take-over" ad slot) that aren't tracked as tiles, so they're never
  // reordered and end up interspersed among the sorted results. Hide any
  // grid-row cell that isn't one of our known product slots.
  const knownSlots = new Set(slotByTileId.values());
  for (const child of Array.from(outerRow.children)) {
    if (!knownSlots.has(child)) {
      (child as HTMLElement).style.display = "none";
    }
  }

  const unitPrices = computeUnitPrices(mergedTiles);
  rankAndBadge(mergedTiles, unitPrices, (tile) => slotByTileId.get(tile.id) ?? tile.element);

  updateOverlay(
    `Showing ${mergedTiles.length} products across ${pagesFetched} page(s), sorted by unit price.`
  );
}

let isActivating = false;

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "lup:activate" || isActivating) return;
  isActivating = true;
  (async () => {
    try {
      await activate();
    } catch (error) {
      console.error(error);
      updateOverlay("Something went wrong while sorting — showing partial/original results.");
    } finally {
      isActivating = false;
    }
  })();
});

