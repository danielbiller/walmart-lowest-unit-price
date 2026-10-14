// Responsibility: find product tiles in the Walmart listing DOM and emit
// TileRecord data for the pricing pipeline. No pricing/ranking logic here.
//
// Walmart's tile markup uses obfuscated/auto-generated class names that churn
// frequently, so selection/extraction below intentionally avoids class names
// and instead relies on: the `data-item-id` attribute (still present on tiles
// in search/browse grids), `data-testid`/`data-automation-id` substrings,
// `aria-label`/`alt` text, and regex matching against visible text content.

export type TileRecord = {
  id: string;
  element: HTMLElement;
  title: string;
  priceText: string | null;
  displayedUnitPriceText: string | null;
};

const TILE_SELECTOR = "[data-item-id]";

// Matches a plain total price like "$12.98" (not "$0.12/oz"). Requires a
// decimal point so we never accept a value formed by concatenating
// separately-rendered dollar/cents DOM nodes (e.g. "$6" + "84" -> "$684").
const PRICE_REGEX = /\$\s?\d[\d,]*\.\d{1,2}/;

// Matches Walmart's displayed unit price, e.g. "$0.12/fl oz", "$1.50 / lb",
// the "price per N units" form "$1.06/100 ct", or cent forms "26.0 ¢/100 ct"
// (symbol may lead or trail the amount, but one is required).
const UNIT_PRICE_REGEX =
  /(?:[$¢]\s?\d[\d,]*(?:\.\d{1,2})?\s?¢?|\d[\d,]*(?:\.\d{1,2})?\s?¢)\s*\/\s*\d*\s*(?:fl\.?\s?oz|oz|lb|ct|ea|count|l|ml|g|kg|qt|gal)\b/i;

const TITLE_TESTID_SELECTOR =
  '[data-testid*="product-title" i], [data-testid*="productName" i], [data-automation-id*="product-title" i]';

const PRICE_TESTID_SELECTOR =
  '[data-testid*="price" i], [data-automation-id*="price" i]';

/**
 * Finds the top-level tile elements within root, skipping nested elements
 * that also happen to carry data-item-id (e.g. sub-widgets inside a tile).
 */
function findTileElements(root: ParentNode): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>(TILE_SELECTOR));
  return all.filter((el) => {
    const ancestorTile = el.parentElement?.closest(TILE_SELECTOR);
    return !ancestorTile;
  });
}

/** Leaf-ish descendants (no element children) with non-empty trimmed text. */
function collectTextCandidates(tileEl: HTMLElement): { element: Element; text: string }[] {
  const candidates: { element: Element; text: string }[] = [];
  const descendants = tileEl.querySelectorAll("*");
  for (const el of Array.from(descendants)) {
    if (el.children.length > 0) continue;
    const text = (el.textContent ?? "").trim();
    if (text.length > 0) candidates.push({ element: el, text });
  }
  return candidates;
}

function extractPriceText(
  tileEl: HTMLElement,
  candidates: { element: Element; text: string }[]
): string | null {
  // Walmart renders the dollars/cents as separate DOM nodes (e.g. "$" "6"
  // "84"), so reading textContent naively yields "$684" instead of "$6.84".
  // The price container's aria-label carries the correctly formatted value
  // (e.g. `aria-label="Price $ 6.84 $1.06/100 ct Options from $6.84 – $11.98"`),
  // so prefer that over reconstructing text from child nodes.
  const testidEl = tileEl.querySelector<HTMLElement>(PRICE_TESTID_SELECTOR);
  const ariaLabel = testidEl?.getAttribute("aria-label") ?? tileEl.getAttribute("aria-label");
  if (ariaLabel) {
    const match = ariaLabel.match(PRICE_REGEX);
    if (match) return match[0].trim();
  }

  if (testidEl) {
    const text = (testidEl.textContent ?? "").trim();
    const match = text.match(PRICE_REGEX);
    if (match) return match[0].trim();
  }

  for (const { text } of candidates) {
    if (UNIT_PRICE_REGEX.test(text)) continue;
    const match = text.match(PRICE_REGEX);
    if (match) return match[0].trim();
  }

  return null;
}

function extractUnitPriceText(
  tileEl: HTMLElement,
  candidates: { element: Element; text: string }[]
): string | null {
  const testidEl = tileEl.querySelector<HTMLElement>(PRICE_TESTID_SELECTOR);
  const ariaLabel = testidEl?.getAttribute("aria-label") ?? tileEl.getAttribute("aria-label");
  if (ariaLabel) {
    const match = ariaLabel.match(UNIT_PRICE_REGEX);
    if (match) return match[0].trim();
  }

  for (const { text } of candidates) {
    const match = text.match(UNIT_PRICE_REGEX);
    if (match) return match[0].trim();
  }

  // Walmart sometimes splits value and unit across sibling nodes ("$0.82" +
  // "/oz"), so no single leaf matches. Joining trimmed leaves separator-free
  // is safe here (unlike total price): the regex still requires $<num>/<unit>
  // adjacency, which a bare "$684"-style digit pile-up cannot satisfy.
  const joined = candidates.map(({ text }) => text).join("");
  const joinedMatch = joined.match(UNIT_PRICE_REGEX);
  if (joinedMatch) return joinedMatch[0].trim();

  return null;
}

function extractTitle(
  tileEl: HTMLElement,
  priceText: string | null,
  unitPriceText: string | null,
  candidates: { element: Element; text: string }[]
): string {
  const testidEl = tileEl.querySelector<HTMLElement>(TITLE_TESTID_SELECTOR);
  if (testidEl) {
    const text = (testidEl.textContent ?? "").trim();
    if (text.length > 0) return text;
  }

  const ariaLabel = tileEl.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const labelledAnchor = tileEl.querySelector<HTMLElement>("a[aria-label]");
  const anchorLabel = labelledAnchor?.getAttribute("aria-label")?.trim();
  if (anchorLabel) return anchorLabel;

  const img = tileEl.querySelector<HTMLImageElement>("img[alt]");
  const altText = img?.getAttribute("alt")?.trim();
  if (altText) return altText;

  let best = "";
  for (const { text } of candidates) {
    if (text === priceText || text === unitPriceText) continue;
    if (PRICE_REGEX.test(text) || UNIT_PRICE_REGEX.test(text)) continue;
    if (text.length > best.length) best = text;
  }
  return best;
}

/** Simple deterministic string hash for fallback ids (djb2). */
function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function buildTileRecord(tileEl: HTMLElement, index: number): TileRecord {
  const candidates = collectTextCandidates(tileEl);
  const priceText = extractPriceText(tileEl, candidates);
  const displayedUnitPriceText = extractUnitPriceText(tileEl, candidates);
  const title = extractTitle(tileEl, priceText, displayedUnitPriceText, candidates);

  const rawId = tileEl.getAttribute("data-item-id")?.trim();
  const id =
    rawId && rawId.length > 0
      ? rawId
      : `fallback-${index}-${hashString(title + priceText)}`;

  return { id, element: tileEl, title, priceText, displayedUnitPriceText };
}

/**
 * Scans the current document for product tiles and returns their raw data.
 *
 * The same product (data-item-id) can appear more than once on a listing page
 * (e.g. main grid plus a sponsored/carousel section), which would otherwise
 * produce duplicate TileRecord ids. Downstream code (rankAndBadge) keys tiles
 * by id in a Map, so a duplicate id would silently collapse two distinct DOM
 * elements into one and badge/rank the wrong instance. Disambiguate repeats
 * within a single scan so every DOM occurrence gets its own unique id.
 */
export function scanTiles(root: ParentNode = document): TileRecord[] {
  const records = findTileElements(root).map((el, index) => buildTileRecord(el, index));
  const seen = new Map<string, number>();
  for (const record of records) {
    const occurrence = seen.get(record.id) ?? 0;
    seen.set(record.id, occurrence + 1);
    if (occurrence > 0) {
      record.id = `${record.id}#${occurrence}`;
    }
  }
  return records;
}

const OBSERVE_DEBOUNCE_MS = 150;

/**
 * Observes the DOM for tile additions/removals (e.g. infinite scroll,
 * client-side re-render) and invokes the callback with the updated set.
 */
export function observeTiles(
  root: ParentNode,
  onChange: (tiles: TileRecord[]) => void
): { disconnect: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rescan = () => {
    timer = undefined;
    onChange(scanTiles(root));
  };

  const observer = new MutationObserver(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(rescan, OBSERVE_DEBOUNCE_MS);
  });

  const target = root instanceof Node ? root : document;
  observer.observe(target, { childList: true, subtree: true });

  return {
    disconnect(): void {
      if (timer !== undefined) clearTimeout(timer);
      observer.disconnect();
    },
  };
}
