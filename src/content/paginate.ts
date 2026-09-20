// Responsibility: fetch additional Walmart result pages and extract their
// tiles for cross-page aggregation. Read/parse only — never mutates the live
// document (that stays rank-and-badge.ts's job).

import { scanTiles } from "./dom-scanner";
import type { TileRecord } from "./dom-scanner";
import { findGridAncestor, findSlot } from "./grid-container";

const PAGE_FETCH_DELAY_MS = 350;

/** A tile paired with its own page's grid-cell wrapper (still in that page's detached document). */
export type PageTile = { tile: TileRecord; slot: Element };

/** Sets/overwrites the `page` search param on currentUrl. Pure, no DOM/network access. */
export function buildPageUrl(currentUrl: string, pageNumber: number): string {
  const url = new URL(currentUrl);
  url.searchParams.set("page", String(pageNumber));
  return url.toString();
}

/** Fetches url and extracts its tiles (with their grid-cell wrappers); degrades to [] on non-2xx response or any error. */
export async function fetchPageTiles(url: string): Promise<PageTile[]> {
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) return [];
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tiles = scanTiles(doc);
    const ancestor = findGridAncestor(tiles);
    if (!ancestor) return [];
    return tiles.map((tile) => ({ tile, slot: findSlot(tile.element, ancestor) }));
  } catch {
    return [];
  }
}

export type CollectAllPagesResult = {
  pageTiles: PageTile[];
  /** Count of pages (beyond the current one) that actually contributed tiles — excludes a trailing empty/failed page. */
  pagesFetched: number;
};

/**
 * Sequentially fetches pages 2..maxPages, pausing between requests and
 * stopping early once a page yields zero tiles (end of results).
 *
 * `onProgress` fires before each attempt (for "Loading page N…" UI), so it
 * can report a page that turns out to be empty — `pagesFetched` in the
 * returned result only counts pages that actually contributed tiles, so
 * callers get an accurate final count rather than the last attempted index.
 */
export async function collectAllPages(
  currentUrl: string,
  maxPages: number,
  onProgress?: (pageIndex: number, maxPages: number) => void
): Promise<CollectAllPagesResult> {
  if (maxPages < 2) return { pageTiles: [], pagesFetched: 0 };

  const allPageTiles: PageTile[] = [];
  let pagesFetched = 0;
  for (let pageIndex = 2; pageIndex <= maxPages; pageIndex++) {
    if (pageIndex > 2) {
      await new Promise((resolve) => setTimeout(resolve, PAGE_FETCH_DELAY_MS));
    }
    onProgress?.(pageIndex, maxPages);
    const url = buildPageUrl(currentUrl, pageIndex);
    const pageTiles = await fetchPageTiles(url);
    if (pageTiles.length === 0) break;
    allPageTiles.push(...pageTiles);
    pagesFetched++;
  }
  return { pageTiles: allPageTiles, pagesFetched };
}
