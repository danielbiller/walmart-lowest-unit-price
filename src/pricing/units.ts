// Responsibility: shared unit vocabulary and grouping of tiles into
// comparable-unit buckets (e.g. all "per fl oz" items together).

export type Unit =
  | "oz"
  | "lb"
  | "fl oz"
  | "ml"
  | "l"
  | "g"
  | "kg"
  | "ct"
  | "ea"
  | "qt"
  | "gal";

export type UnitDimension = "weight" | "volume" | "count";

/** Dimension each unit belongs to; dimensions are never mixed for comparison. */
const UNIT_DIMENSION: Record<Unit, UnitDimension> = {
  oz: "weight",
  lb: "weight",
  g: "weight",
  kg: "weight",
  "fl oz": "volume",
  ml: "volume",
  l: "volume",
  qt: "volume",
  gal: "volume",
  ct: "count",
  ea: "count",
};

/** Multiply a unit's value by this factor to get its base-unit value. */
const TO_BASE_FACTOR: Record<Unit, number> = {
  oz: 1,
  lb: 16,
  g: 1 / 28.3495,
  kg: 1000 / 28.3495,
  "fl oz": 1,
  ml: 1 / 29.5735,
  l: 1000 / 29.5735,
  qt: 32,
  gal: 128,
  ct: 1,
  ea: 1,
};

export type ComparableGroup = {
  dimension: UnitDimension;
  tileIds: string[];
};

const UNIT_ALIASES: Record<string, Unit> = {
  oz: "oz",
  lb: "lb",
  "fl oz": "fl oz",
  "floz": "fl oz",
  ml: "ml",
  l: "l",
  g: "g",
  kg: "kg",
  ct: "ct",
  ea: "ea",
  qt: "qt",
  gal: "gal",
};

/** Normalizes a raw unit token (e.g. "Fl. Oz", "LB") to a canonical Unit. */
export function parseUnitToken(raw: string): Unit | null {
  const key = raw.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  return UNIT_ALIASES[key] ?? UNIT_ALIASES[key.replace(/\s+/g, "")] ?? null;
}

/**
 * Converts a value in the given unit to its dimension's base unit
 * (oz for weight, fl oz for volume, ct for count).
 */
export function toBaseUnit(
  value: number,
  unit: Unit
): { dimension: UnitDimension; baseValue: number } {
  return { dimension: UNIT_DIMENSION[unit], baseValue: value * TO_BASE_FACTOR[unit] };
}

/**
 * Groups tile ids by comparable dimension; dimensions are never mixed.
 */
export function groupByComparableUnit(
  entries: Array<{ tileId: string; dimension: UnitDimension }>
): ComparableGroup[] {
  const groups = new Map<UnitDimension, string[]>();
  for (const { tileId, dimension } of entries) {
    const tileIds = groups.get(dimension);
    if (tileIds) {
      tileIds.push(tileId);
    } else {
      groups.set(dimension, [tileId]);
    }
  }
  return Array.from(groups, ([dimension, tileIds]) => ({ dimension, tileIds }));
}
