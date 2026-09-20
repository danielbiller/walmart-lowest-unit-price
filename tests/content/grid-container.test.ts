// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { findGridAncestor, findSlot } from "../../src/content/grid-container";
import type { TileRecord } from "../../src/content/dom-scanner";

function makeTile(element: HTMLElement): TileRecord {
  return { id: element.getAttribute("data-item-id") ?? "", element, title: "", priceText: null, displayedUnitPriceText: null };
}

describe("findGridAncestor", () => {
  it("walks up past individual per-tile wrapper cells to the shared row", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell"><div data-item-id="a">A</div></div>
        <div class="cell"><div data-item-id="b">B</div></div>
      </div>
    `;
    const a = document.querySelector('[data-item-id="a"]') as HTMLElement;
    const b = document.querySelector('[data-item-id="b"]') as HTMLElement;
    const ancestor = findGridAncestor([makeTile(a), makeTile(b)]);
    expect(ancestor?.id).toBe("row");
  });

  it("returns the immediate parent when tiles already share one directly", () => {
    document.body.innerHTML = `
      <div id="shared">
        <div data-item-id="a">A</div>
        <div data-item-id="b">B</div>
      </div>
    `;
    const a = document.querySelector('[data-item-id="a"]') as HTMLElement;
    const b = document.querySelector('[data-item-id="b"]') as HTMLElement;
    const ancestor = findGridAncestor([makeTile(a), makeTile(b)]);
    expect(ancestor?.id).toBe("shared");
  });

  it("returns null for an empty tile list", () => {
    expect(findGridAncestor([])).toBeNull();
  });

  it("ignores a minority of outlier tiles in an unrelated small carousel", () => {
    // Reproduces the real bug: a page can have a small side carousel (its own
    // ul/li structure) that also matches the tile selector. Requiring an
    // ancestor to contain *every* tile would force climbing past the real
    // grid row up to some generic wrapper that also contains the carousel.
    const gridCells = Array.from({ length: 8 }, (_, i) => i)
      .map((i) => `<div class="cell"><div data-item-id="grid-${i}">G${i}</div></div>`)
      .join("");
    document.body.innerHTML = `
      <section>
        <ul id="carousel">
          <li><div data-item-id="carousel-1">C1</div></li>
        </ul>
        <div id="row">${gridCells}</div>
      </section>
    `;
    const carouselTile = makeTile(document.querySelector('[data-item-id="carousel-1"]') as HTMLElement);
    const gridTiles = Array.from(document.querySelectorAll<HTMLElement>('[data-item-id^="grid-"]')).map(makeTile);
    const ancestor = findGridAncestor([carouselTile, ...gridTiles]);
    expect(ancestor?.id).toBe("row");
  });
});

describe("findSlot", () => {
  it("returns the direct child of ancestor that wraps the tile", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell" id="cell-a"><div data-item-id="a">A</div></div>
      </div>
    `;
    const row = document.getElementById("row") as HTMLElement;
    const a = document.querySelector('[data-item-id="a"]') as HTMLElement;
    const slot = findSlot(a, row);
    expect(slot.id).toBe("cell-a");
  });

  it("returns the element itself when it is already the direct child of ancestor", () => {
    document.body.innerHTML = `<div id="row"><div data-item-id="a">A</div></div>`;
    const row = document.getElementById("row") as HTMLElement;
    const a = document.querySelector('[data-item-id="a"]') as HTMLElement;
    expect(findSlot(a, row)).toBe(a);
  });
});
