import { describe, it, expect } from "vitest";
import { parseDisplayedUnitPrice } from "../../src/pricing/parse-displayed-unit-price";

describe("parseDisplayedUnitPrice", () => {
  it("parses a weight unit price", () => {
    const result = parseDisplayedUnitPrice("$0.12/lb");
    expect(result).not.toBeNull();
    expect(result!.dimension).toBe("weight");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.0075, 5);
  });

  it("parses a volume unit price", () => {
    const result = parseDisplayedUnitPrice("$0.50 / fl oz");
    expect(result).not.toBeNull();
    expect(result!.dimension).toBe("volume");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.5, 5);
  });

  it("parses a count unit price", () => {
    const result = parseDisplayedUnitPrice("$0.99/ct");
    expect(result).not.toBeNull();
    expect(result!.dimension).toBe("count");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.99, 5);
  });

  it("parses Walmart's price-per-N-units form", () => {
    const result = parseDisplayedUnitPrice("$1.06/100 ct");
    expect(result).not.toBeNull();
    expect(result!.dimension).toBe("count");
    expect(result!.pricePerBaseUnit).toBeCloseTo(0.0106, 5);
  });

  it("parses cent-denominated forms as fractions of a dollar", () => {
    const per100 = parseDisplayedUnitPrice("26.0 ¢/100 ct");
    expect(per100).not.toBeNull();
    expect(per100!.dimension).toBe("count");
    expect(per100!.pricePerBaseUnit).toBeCloseTo(0.0026, 6);

    const perCount = parseDisplayedUnitPrice("5.9 ¢/count");
    expect(perCount).not.toBeNull();
    expect(perCount!.dimension).toBe("count");
    expect(perCount!.pricePerBaseUnit).toBeCloseTo(0.059, 5);

    const perEach = parseDisplayedUnitPrice("4.2 ¢/ea");
    expect(perEach).not.toBeNull();
    expect(perEach!.pricePerBaseUnit).toBeCloseTo(0.042, 5);
  });

  it("returns null for null input", () => {
    expect(parseDisplayedUnitPrice(null)).toBeNull();
  });

  it("returns null for unparseable text", () => {
    expect(parseDisplayedUnitPrice("was $5.00")).toBeNull();
    expect(parseDisplayedUnitPrice("Buy 2 save $1")).toBeNull();
  });

  it("returns null for a recognizable price but unknown unit", () => {
    expect(parseDisplayedUnitPrice("$0.12/widget")).toBeNull();
  });
});
