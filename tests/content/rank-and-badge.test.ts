// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { rankAndBadge as rankAndBadgeTiles, formatEstimate, removeEstimateTags } from "../../src/content/rank-and-badge";
import type { TileRecord } from "../../src/content/dom-scanner";
import type { EstimatedUnitPrice } from "../../src/pricing/estimate-unit-price";

function setup(ids: string[]): { row: HTMLElement; tiles: TileRecord[] } {
  document.body.innerHTML = `<div id="row">${ids.map((id) => `<div class="cell"><div data-item-id="${id}">${id}</div></div>`).join("")}</div>`;
  const tiles = ids.map((id) => {
    const element = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`)!;
    return { id, element, title: id, priceText: null, displayedUnitPriceText: null };
  });
  return { row: document.getElementById("row")!, tiles };
}

function priced(pricePerBaseUnit: number, dimension: EstimatedUnitPrice["dimension"] = "weight"): EstimatedUnitPrice {
  return { pricePerBaseUnit, dimension, source: "displayed" };
}

function rowOrder(row: HTMLElement): string[] {
  return [...row.children].map((cell) => cell.querySelector("[data-item-id]")!.getAttribute("data-item-id")!);
}

// Mirrors production (index.ts): reorder Walmart's per-item cell wrappers,
// not the tile elements themselves.
function rankCells(tiles: TileRecord[], prices: Map<string, EstimatedUnitPrice | null>): void {
  rankAndBadgeTiles(tiles, prices, (tile) => tile.element.parentElement!);
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("rankAndBadge", () => {
  it("moves priced tiles first ascending and unpriced to the end in original order", () => {
    const { row, tiles } = setup(["u1", "p-high", "u2", "p-low"]);
    const prices = new Map<string, EstimatedUnitPrice | null>([
      ["u1", null],
      ["p-high", priced(0.5)],
      ["u2", null],
      ["p-low", priced(0.1)],
    ]);
    rankCells(tiles, prices);
    expect(rowOrder(row)).toEqual(["p-low", "p-high", "u1", "u2"]);
  });

  it("orders groups largest-first with ties keeping first-seen order", () => {
    // volume seen first but smaller -> weight (3) leads; count (1) trails single-tile volume... use tie below
    const { row, tiles } = setup(["v1", "w1", "w2", "c1", "v2", "w3"]);
    const prices = new Map<string, EstimatedUnitPrice | null>([
      ["v1", priced(0.3, "volume")],
      ["w1", priced(0.3, "weight")],
      ["w2", priced(0.1, "weight")],
      ["c1", priced(0.9, "count")],
      ["v2", priced(0.1, "volume")],
      ["w3", priced(0.2, "weight")],
    ]);
    rankCells(tiles, prices);
    // weight(3) first sorted, then volume(2) sorted, then count(1)
    expect(rowOrder(row)).toEqual(["w2", "w3", "w1", "v2", "v1", "c1"]);
  });

  it("keeps first-seen order on group-size ties", () => {
    const { row, tiles } = setup(["c1", "w1", "c2", "w2"]);
    const prices = new Map<string, EstimatedUnitPrice | null>([
      ["c1", priced(0.5, "count")],
      ["w1", priced(0.5, "weight")],
      ["c2", priced(0.1, "count")],
      ["w2", priced(0.1, "weight")],
    ]);
    rankCells(tiles, prices);
    // count seen first, tie 2v2 -> count group leads
    expect(rowOrder(row)).toEqual(["c2", "c1", "w2", "w1"]);
  });

  it("badges exactly the cheapest per group and stamps priced tiles only", () => {
    const { row, tiles } = setup(["u1", "b", "a"]);
    const prices = new Map<string, EstimatedUnitPrice | null>([
      ["u1", null],
      ["b", priced(0.5)],
      ["a", priced(0.1)],
    ]);
    rankCells(tiles, prices);
    expect(row.querySelectorAll(".lup-badge")).toHaveLength(1);
    expect(row.querySelector('[data-item-id="a"] > .lup-badge')?.textContent).toBe("Best value");
    expect(document.querySelector('[data-item-id="a"]')!.getAttribute("data-lup-ranked")).toBe("true");
    expect(document.querySelector('[data-item-id="u1"]')!.hasAttribute("data-lup-ranked")).toBe(false);
    expect(row.querySelector('[data-item-id="u1"] > .lup-badge')).toBeNull();
  });

  it("leaves order unchanged when nothing is priced", () => {
    const { row, tiles } = setup(["x", "y", "z"]);
    rankCells(tiles, new Map([["x", null], ["y", null], ["z", null]]));
    expect(rowOrder(row)).toEqual(["x", "y", "z"]);
    expect(row.querySelectorAll(".lup-badge")).toHaveLength(0);
  });

  it("leaves hidden non-product cells hidden, unbadged, and unstamped", () => {
    const { row, tiles } = setup(["u1", "p1"]);
    const ad = document.createElement("div");
    ad.className = "ad-cell";
    ad.textContent = "promo";
    ad.style.display = "none";
    row.prepend(ad);
    rankCells(
      tiles,
      new Map<string, EstimatedUnitPrice | null>([["u1", null], ["p1", priced(0.2)]])
    );
    expect(ad.style.display).toBe("none");
    expect(ad.querySelector(".lup-badge")).toBeNull();
    expect(ad.hasAttribute("data-lup-ranked")).toBe(false);
    expect(row.querySelectorAll(".lup-badge")).toHaveLength(1);
  });
});

describe("formatEstimate", () => {
  it("formats weight and volume with 2 decimals", () => {
    expect(formatEstimate({ pricePerBaseUnit: 0.25, dimension: "weight", source: "computed" })).toBe(
      "≈ $0.25/oz · est."
    );
    expect(formatEstimate({ pricePerBaseUnit: 2.5, dimension: "volume", source: "computed" })).toBe(
      "≈ $2.50/fl oz · est."
    );
  });

  it("uses 4 decimals for sub-cent values", () => {
    expect(formatEstimate({ pricePerBaseUnit: 0.0106, dimension: "count", source: "computed" })).toBe(
      "≈ $0.0106/ct · est."
    );
    expect(formatEstimate({ pricePerBaseUnit: 0.0075, dimension: "weight", source: "computed" })).toBe(
      "≈ $0.0075/oz · est."
    );
  });

  it("formats ordinary count values with 2 decimals", () => {
    expect(formatEstimate({ pricePerBaseUnit: 0.5, dimension: "count", source: "computed" })).toBe(
      "≈ $0.50/ct · est."
    );
  });
});

describe("estimate tags", () => {
  function computed(pricePerBaseUnit: number): EstimatedUnitPrice {
    return { pricePerBaseUnit, dimension: "weight", source: "computed" };
  }

  it("tags computed tiles and skips displayed tiles", () => {
    const { row, tiles } = setup(["g", "d"]);
    rankCells(
      tiles,
      new Map<string, EstimatedUnitPrice | null>([
        ["g", computed(0.25)],
        ["d", priced(0.1)],
      ])
    );
    const tag = row.querySelector('[data-item-id="g"] > .lup-estimate');
    expect(tag?.textContent).toBe("≈ $0.25/oz · est.");
    expect(tag?.getAttribute("title")).toBe("Estimated from product title — please verify.");
    expect(row.querySelector('[data-item-id="d"] > .lup-estimate')).toBeNull();
  });

  it("is idempotent across re-runs", () => {
    const { row, tiles } = setup(["g"]);
    const prices = new Map<string, EstimatedUnitPrice | null>([["g", computed(0.25)]]);
    rankCells(tiles, prices);
    rankCells(tiles, prices);
    expect(row.querySelectorAll('[data-item-id="g"] > .lup-estimate')).toHaveLength(1);
  });

  it("removeEstimateTags clears tags but leaves badges and stamps intact", () => {
    const { row, tiles } = setup(["g", "d"]);
    rankCells(
      tiles,
      new Map<string, EstimatedUnitPrice | null>([
        ["g", computed(0.5)],
        ["d", priced(0.1)],
      ])
    );
    expect(row.querySelectorAll(".lup-estimate")).toHaveLength(1);
    removeEstimateTags(document);
    expect(row.querySelectorAll(".lup-estimate")).toHaveLength(0);
    expect(row.querySelectorAll(".lup-badge")).toHaveLength(1);
    expect(document.querySelector('[data-item-id="g"]')!.hasAttribute("data-lup-ranked")).toBe(true);
  });
});
