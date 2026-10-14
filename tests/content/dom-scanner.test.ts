// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { scanTiles } from "../../src/content/dom-scanner";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("scanTiles unit-price extraction", () => {
  it("catches value and unit split across sibling nodes", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell"><div data-item-id="split"><span>$0.82</span><span>/oz</span></div></div>
      </div>`;
    const [tile] = scanTiles(document);
    expect(tile.displayedUnitPriceText).toBe("$0.82/oz");
  });

  it("still catches single-node and aria-label prices", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell"><div data-item-id="leaf"><span>$0.50/oz</span></div></div>
        <div class="cell"><div data-item-id="aria" aria-label="Price $6.00 $0.43/oz Oil 12 oz">x</div></div>
      </div>`;
    const byId = new Map(scanTiles(document).map((t) => [t.id, t]));
    expect(byId.get("leaf")!.displayedUnitPriceText).toBe("$0.50/oz");
    expect(byId.get("aria")!.displayedUnitPriceText).toBe("$0.43/oz");
  });

  it("catches cent-denominated and spelled-out-count forms", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell"><div data-item-id="cents"><span>26.0 ¢/100 ct</span></div></div>
        <div class="cell"><div data-item-id="count"><span>5.9 ¢/count</span></div></div>
      </div>`;
    const byId = new Map(scanTiles(document).map((t) => [t.id, t]));
    expect(byId.get("cents")!.displayedUnitPriceText).toBe("26.0 ¢/100 ct");
    expect(byId.get("count")!.displayedUnitPriceText).toBe("5.9 ¢/count");
  });

  it("returns null when no unit price is present", () => {
    document.body.innerHTML = `
      <div id="row">
        <div class="cell"><div data-item-id="plain"><span>Bananas</span><span>$1.00</span></div></div>
      </div>`;
    const [tile] = scanTiles(document);
    expect(tile.displayedUnitPriceText).toBeNull();
    expect(tile.priceText).toBe("$1.00");
  });
});
