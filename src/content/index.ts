// Entry point: wires dom-scanner -> paginate -> pricing -> rank-and-badge.
// No scanning/pricing/ranking logic lives here — stub wiring only.

import { scanTiles } from "./dom-scanner";
import type { TileRecord } from "./dom-scanner";
import { estimateUnitPrice } from "../pricing/estimate-unit-price";
import { rankAndBadge, removeBadges, removeEstimateTags, removeRankStamps } from "./rank-and-badge";
import type { RankSummary } from "./rank-and-badge";
import { collectPageRange } from "./paginate";
import type { PageTile } from "./paginate";
import { updateOverlay, renderResultPanel } from "./overlay";
import { findGridAncestor, findSlot, excludeRailTiles } from "./grid-container";

const DEFAULT_PAGE_LIMIT = 1;
const MAX_PAGE_LIMIT = 20;

/** Default page cap for fresh sorts; adjustable from the results panel stepper. */
let defaultPageCap = DEFAULT_PAGE_LIMIT;

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
  await initialSort(DEFAULT_PAGE_LIMIT);
}

// A completed sort run: everything incremental fetching needs to resume.
type SortSession = {
  sourceUrl: string;
  outerRow: Element;
  slotByTileId: Map<string, Element>;
  mergedTiles: TileRecord[];
  /** Next page index to attempt (starts at 2). */
  nextPage: number;
  /** Total pages contributing tiles, including the current one. */
  pagesFetched: number;
  /** Extra pages attempted beyond the current one (including empty ones). */
  extraAttempted: number;
  /** Pre-sort grid state for restore (child order + inline display values). */
  snapshot: { order: Element[]; displays: Map<Element, string> };
};

let session: SortSession | null = null;

function hideNonProductCells(outerRow: Element, knownSlots: Set<Element>): void {
  // The grid row can also contain non-product cells (e.g. a promotional
  // "tile take-over" ad slot) that aren't tracked as tiles, so they're never
  // reordered and end up interspersed among the sorted results. Hide any
  // grid-row cell that isn't one of our known product slots.
  for (const child of Array.from(outerRow.children)) {
    if (!knownSlots.has(child)) {
      (child as HTMLElement).style.display = "none";
    }
  }
}

function mergePageTiles(session: SortSession, pageTiles: PageTile[]): void {
  // Other pages' tiles/slots belong to detached DOMParser documents. Import
  // each tile's own grid-cell wrapper (not just the tile) so cross-page
  // products carry the same real Walmart cell markup, then append it into
  // the live row alongside the current page's own cells.
  for (const { tile, slot } of pageTiles) {
    const importedSlot = document.importNode(slot, true) as HTMLElement;
    session.outerRow.appendChild(importedSlot);
    const importedTileEl = importedSlot.matches("[data-item-id]")
      ? importedSlot
      : importedSlot.querySelector<HTMLElement>("[data-item-id]");
    tile.element = importedTileEl ?? importedSlot;
    session.slotByTileId.set(tile.id, importedSlot);
    session.mergedTiles.push(tile);
  }
}

function sortAndReport(session: SortSession): void {
  const unitPrices = computeUnitPrices(session.mergedTiles);
  const summary = rankAndBadge(
    session.mergedTiles,
    unitPrices,
    (tile) => session.slotByTileId.get(tile.id) ?? tile.element
  );

  // Extra pages were attempted (e.g. blocked/empty) but contributed nothing:
  // say so instead of silently reporting a single-page sort as the full set.
  const stalled =
    session.extraAttempted > 0 && session.pagesFetched === 1;
  lastReport = { url: session.sourceUrl, summary, pagesFetched: session.pagesFetched, stalled };
  renderReport(summary, session.pagesFetched, stalled, session.pagesFetched < MAX_PAGE_LIMIT);
}

/** Renders toast + panel for a report with zero scanning/fetching/DOM work. */
function renderReport(summary: RankSummary, pagesFetched: number, stalled: boolean, canFetchMore: boolean): void {
  const stalledNote = stalled ? " No tiles found on further pages." : "";
  if (summary.pricedCount === 0) {
    updateOverlay(`No unit prices found — nothing sorted.${stalledNote}`);
    renderResultPanel([], 0, summary.unpricedCount, defaultPageCap, canFetchMore, panelCallbacks());
    return;
  }
  updateOverlay(
    `Sorted ${summary.pricedCount} by unit price · ${summary.unpricedCount} moved to end · ` +
      `${summary.groupCount} group(s) · ${pagesFetched} page(s).${stalledNote}`
  );
  renderResultPanel(
    summary.groups,
    summary.pricedCount,
    summary.unpricedCount,
    defaultPageCap,
    canFetchMore,
    panelCallbacks()
  );
}

// Last completed report: reshow reproduces it with zero work. Cleared by restore.
let lastReport: {
  url: string;
  summary: RankSummary;
  pagesFetched: number;
  stalled: boolean;
} | null = null;

/** Callbacks wiring the results panel to this module's actions. */
function panelCallbacks() {
  return {
    onFetchMore: (count: number | "all") => {
      void runExclusive(() => fetchMore(count === "all" ? MAX_PAGE_LIMIT : count));
    },
    onRestore: () => {
      restore();
    },
    onCapChange: (cap: number) => {
      defaultPageCap = Math.min(MAX_PAGE_LIMIT, Math.max(1, cap));
    },
  };
}

async function fetchIntoSession(session: SortSession, fromPage: number, toPage: number): Promise<void> {
  const endPage = Math.min(toPage, MAX_PAGE_LIMIT);
  if (endPage < fromPage) return;
  const { pageTiles, pagesFetched, lastAttempted } = await collectPageRange(
    session.sourceUrl,
    fromPage,
    endPage,
    (pageIndex) => updateOverlay(`Loading page ${pageIndex}…`)
  );
  mergePageTiles(session, pageTiles);
  session.pagesFetched += pagesFetched;
  session.extraAttempted += lastAttempted - fromPage + 1;
  session.nextPage = lastAttempted + 1;
}

/** Scans the current grid, optionally fetches extra pages, then sorts. Exported for testing. */
export async function initialSort(maxPages: number = defaultPageCap): Promise<void> {
  // Rail/carousel tiles are excluded before anything else so a fat rail can
  // never win the grid-ancestor vote or leak into moves and counts.
  const scanned = scanTiles();
  const currentTiles = excludeRailTiles(scanned);
  if (currentTiles.length === 0) {
    updateOverlay(
      scanned.length === 0 ? "No products found on this page." : "Results grid not identified — nothing sorted."
    );
    session = null;
    return;
  }

  // The real Walmart grid: one shared row containing one grid-cell wrapper
  // per product. Reordering moves those cell wrappers (preserving Walmart's
  // exact markup/CSS) rather than replacing the grid with anything of our
  // own, so the layout looks identical — only the item order changes.
  const outerRow = findGridAncestor(currentTiles) as Element;
  // Only tiles inside the shared grid row take part: side sections (e.g. a
  // "Buy it again" rail) match the tile selector too but are not search
  // results, so they are neither moved, stamped, nor counted.
  const gridTiles = currentTiles.filter((tile) => outerRow.contains(tile.element));
  const slotByTileId = new Map<string, Element>();
  for (const tile of gridTiles) {
    slotByTileId.set(tile.id, findSlot(tile.element, outerRow));
  }

  // Snapshot before any mutation so restore can return the grid exactly.
  const snapshot = {
    order: Array.from(outerRow.children),
    displays: new Map(Array.from(outerRow.children).map((child) => [child, (child as HTMLElement).style.display])),
  };
  hideNonProductCells(outerRow, new Set(slotByTileId.values()));

  const newSession: SortSession = {
    sourceUrl: location.href,
    outerRow,
    slotByTileId,
    mergedTiles: [...gridTiles],
    nextPage: 2,
    pagesFetched: 1,
    extraAttempted: 0,
    snapshot,
  };
  session = newSession;

  if (maxPages >= 2) {
    // Don't claim a total page count while loading: it can only be estimated
    // from Walmart's result count ÷ page-1 tile count, and page 1's tile count
    // is an unreliable stand-in for "items per page" (ads/duplicate placements
    // vary per page) — this has been observed wrong in both directions. Only
    // the current page number is ever shown; the real total is only stated
    // once known, in the completion message below.
    updateOverlay("Loading page 2…");
    await fetchIntoSession(newSession, 2, maxPages);
  }

  sortAndReport(newSession);
}

/**
 * Fetches up to `count` more pages continuing after the last fetched page,
 * then re-sorts. Falls back to a fresh default sort with no live session.
 * Exported for the results panel (and testing).
 */
export async function fetchMore(count: number): Promise<void> {
  if (!session || session.sourceUrl !== location.href) {
    await initialSort(defaultPageCap);
    return;
  }
  await fetchIntoSession(session, session.nextPage, session.nextPage + count - 1);
  sortAndReport(session);
}

/**
 * Returns the grid to its pre-sort state: fetched tiles removed, original
 * child order and display values restored, badges/tags/stamps stripped.
 * Clears the session, so the next activation starts fresh. Exported for the
 * results panel (and testing).
 */
export function restore(): void {
  const live = session;
  if (!live) return;
  const inSnapshot = new Set(live.snapshot.order);
  for (const child of Array.from(live.outerRow.children)) {
    if (!inSnapshot.has(child)) child.remove();
  }
  for (const child of live.snapshot.order) {
    live.outerRow.appendChild(child);
    (child as HTMLElement).style.display = live.snapshot.displays.get(child) ?? "";
  }
  // Markers are stripped document-wide (not just the row): priced tiles in
  // side carousels get stamped/tagged in place, and all markers are lup-*
  // namespaced so Walmart's own markup can't collide.
  removeBadges(document);
  removeEstimateTags(document);
  removeRankStamps(document);
  session = null;
  lastReport = null;
  updateOverlay("Restored original order.");
}

let isActivating = false;

/**
 * Test-only: clears session state. Content scripts reload on every page load
 * in production, so module state never leaks across pages there.
 */
export function __resetState(): void {
  session = null;
  lastReport = null;
}async function runExclusive(job: () => Promise<void>): Promise<void> {
  if (isActivating) return;
  isActivating = true;
  try {
    await job();
  } catch (error) {
    console.error(error);
    updateOverlay("Something went wrong while sorting — showing partial/original results.");
  } finally {
    isActivating = false;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "lup:activate") return;
  if (!isActivating && lastReport && lastReport.url === location.href && session) {
    renderReport(lastReport.summary, lastReport.pagesFetched, lastReport.stalled, session.pagesFetched < MAX_PAGE_LIMIT);
    return;
  }
  void runExclusive(() => activate());
});

