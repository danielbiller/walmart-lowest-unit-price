import { describe, it, expect } from "vitest";
import { estimateUnitPrice } from "../../src/pricing/estimate-unit-price";

describe("estimateUnitPrice", () => {
  it("prefers the displayed unit price over a computed one", () => {
    const result = estimateUnitPrice({
      title: "16 oz Bag",
      priceText: "$5.00",
      displayedUnitPriceText: "$0.10/oz",
    });
    expect(result).toEqual({
      pricePerBaseUnit: 0.1,
      dimension: "weight",
      source: "displayed",
    });
  });

  it("parses a multipack title (count x size unit)", () => {
    const result = estimateUnitPrice({
      title: "Snack Bars, 2 x 16 oz",
      priceText: "$8.00",
      displayedUnitPriceText: null,
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("computed");
    expect(result!.dimension).toBe("weight");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.25, 5); // $8 / (2*16 oz)
  });

  it("parses a simple single-unit title", () => {
    const result = estimateUnitPrice({
      title: "16 oz Bag of Chips",
      priceText: "$4.00",
      displayedUnitPriceText: null,
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("computed");
    expect(result!.dimension).toBe("weight");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.25, 5); // $4 / 16 oz
  });

  it("parses a pack/count title (e.g. 24 Pack)", () => {
    const result = estimateUnitPrice({
      title: "Water Bottles, 24 Pack",
      priceText: "$12.00",
      displayedUnitPriceText: null,
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("computed");
    expect(result!.dimension).toBe("count");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.5, 5); // $12 / 24 ct
  });

  it("returns null when the title has no parseable size", () => {
    const result = estimateUnitPrice({
      title: "Bananas",
      priceText: "$1.00",
      displayedUnitPriceText: null,
    });
    expect(result).toBeNull();
  });

  it("returns null when the price text is unparseable", () => {
    const result = estimateUnitPrice({
      title: "16 oz Bag",
      priceText: null,
      displayedUnitPriceText: null,
    });
    expect(result).toBeNull();
  });

  it("converts a mixed-unit title (500 mL) to base fl oz", () => {
    const result = estimateUnitPrice({
      title: "Sparkling Water, 500 mL",
      priceText: "$2.50",
      displayedUnitPriceText: null,
    });
    expect(result).not.toBeNull();
    expect(result!.source).toBe("computed");
    expect(result!.dimension).toBe("volume");
    // baseValue = 500 * (1/29.5735) fl oz ≈ 16.907
    expect(result!.pricePerBaseUnit).toBeCloseTo(2.5 / (500 / 29.5735), 4);
  });
});
