// Responsibility: derive a unit price for a tile when Walmart does not
// display one, by combining total price with a parsed package size/unit.

import { toBaseUnit, parseUnitToken } from "./units";
import type { UnitDimension } from "./units";
import { parseDisplayedUnitPrice } from "./parse-displayed-unit-price";

export type EstimateUnitPriceInput = {
  title: string;
  priceText: string | null;
  displayedUnitPriceText: string | null;
};

export type EstimatedUnitPrice = {
  pricePerBaseUnit: number;
  dimension: UnitDimension;
  source: "displayed" | "computed";
};

const UNIT_TOKEN = "fl\\.?\\s?oz|oz|lb|ml|kg|g|l|qt|gal|ct|ea";

// "2 x 16 oz", "2X16 oz" — multipack: count x size unit.
const MULTIPACK_REGEX = new RegExp(
  `(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`,
  "i"
);

// "12 Pack", "24 ct pack", "12-pack", "6 pk" — plain pack/count.
const PACK_COUNT_REGEX = /(\d+(?:\.\d+)?)\s*-?\s*(?:pack|pk)\b/i;

// "16 oz", "1.5 lb", "500 mL", "1 L" — simple quantity + unit.
const SIMPLE_QUANTITY_REGEX = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, "i");

function parseTotalPrice(priceText: string | null): number | null {
  if (!priceText) return null;
  const match = priceText.match(/\$\s?(\d[\d,]*(?:\.\d{1,2})?)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

function parseTitleQuantity(
  title: string
): { totalValue: number; unit: ReturnType<typeof parseUnitToken> } | null {
  const multipack = title.match(MULTIPACK_REGEX);
  if (multipack) {
    const count = Number(multipack[1]);
    const size = Number(multipack[2]);
    const unit = parseUnitToken(multipack[3]);
    if (unit && Number.isFinite(count) && Number.isFinite(size)) {
      return { totalValue: count * size, unit };
    }
  }

  const pack = title.match(PACK_COUNT_REGEX);
  if (pack) {
    const count = Number(pack[1]);
    if (Number.isFinite(count)) {
      return { totalValue: count, unit: "ct" };
    }
  }

  const simple = title.match(SIMPLE_QUANTITY_REGEX);
  if (simple) {
    const value = Number(simple[1]);
    const unit = parseUnitToken(simple[2]);
    if (unit && Number.isFinite(value)) {
      return { totalValue: value, unit };
    }
  }

  return null;
}

/**
 * Resolves a final unit price for a tile: prefers Walmart's own displayed
 * unit price, falling back to estimating one from title + total price.
 */
export function estimateUnitPrice(
  input: EstimateUnitPriceInput
): EstimatedUnitPrice | null {
  const displayed = parseDisplayedUnitPrice(input.displayedUnitPriceText);
  if (displayed) {
    return { ...displayed, source: "displayed" };
  }

  const totalPrice = parseTotalPrice(input.priceText);
  if (totalPrice === null) return null;

  const quantity = parseTitleQuantity(input.title);
  if (!quantity || !quantity.unit) return null;

  const { dimension, baseValue } = toBaseUnit(quantity.totalValue, quantity.unit);
  if (baseValue <= 0) return null;

  return { pricePerBaseUnit: totalPrice / baseValue, dimension, source: "computed" };
}

