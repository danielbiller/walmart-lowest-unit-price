import { describe, it, expect } from "vitest";
import { toBaseUnit, groupByComparableUnit, parseUnitToken } from "../../src/pricing/units";

describe("toBaseUnit", () => {
  it("converts weight units to base oz", () => {
    expect(toBaseUnit(1, "oz")).toEqual({ dimension: "weight", baseValue: 1 });
    expect(toBaseUnit(1, "lb")).toEqual({ dimension: "weight", baseValue: 16 });
    expect(toBaseUnit(1, "g").baseValue).toBeCloseTo(0.035274, 5);
    expect(toBaseUnit(1, "kg").baseValue).toBeCloseTo(35.274, 3);
  });

  it("converts volume units to base fl oz", () => {
    expect(toBaseUnit(1, "fl oz")).toEqual({ dimension: "volume", baseValue: 1 });
    expect(toBaseUnit(1, "ml").baseValue).toBeCloseTo(0.033814, 5);
    expect(toBaseUnit(1, "l").baseValue).toBeCloseTo(33.814, 3);
    expect(toBaseUnit(1, "qt")).toEqual({ dimension: "volume", baseValue: 32 });
    expect(toBaseUnit(1, "gal")).toEqual({ dimension: "volume", baseValue: 128 });
  });

  it("converts count units to base ct", () => {
    expect(toBaseUnit(3, "ct")).toEqual({ dimension: "count", baseValue: 3 });
    expect(toBaseUnit(3, "ea")).toEqual({ dimension: "count", baseValue: 3 });
  });

  it("scales base value with the input quantity", () => {
    expect(toBaseUnit(2.5, "lb").baseValue).toBeCloseTo(40, 5);
  });
});

describe("groupByComparableUnit", () => {
  it("groups tiles by dimension without mixing dimensions", () => {
    const groups = groupByComparableUnit([
      { tileId: "a", dimension: "weight" },
      { tileId: "b", dimension: "volume" },
      { tileId: "c", dimension: "weight" },
      { tileId: "d", dimension: "count" },
    ]);

    const byDimension = new Map(groups.map((g) => [g.dimension, g.tileIds]));
    expect(byDimension.get("weight")).toEqual(["a", "c"]);
    expect(byDimension.get("volume")).toEqual(["b"]);
    expect(byDimension.get("count")).toEqual(["d"]);

    // No group should contain a tile that belongs to a different dimension.
    for (const group of groups) {
      expect(groups.filter((g) => g.dimension === group.dimension)).toHaveLength(1);
    }
  });

  it("returns an empty array for no entries", () => {
    expect(groupByComparableUnit([])).toEqual([]);
  });
});

describe("parseUnitToken", () => {
  it("normalizes spelled-out count to ct", () => {
    expect(parseUnitToken("count")).toBe("ct");
    expect(parseUnitToken("Count")).toBe("ct");
  });

  it("returns null for unknown tokens", () => {
    expect(parseUnitToken("widget")).toBeNull();
  });
});
