// Responsibility: parse Walmart's own displayed unit-price string
// (e.g. "$0.12/fl oz") into a structured value, when present on the tile.

import { toBaseUnit, parseUnitToken, type UnitDimension } from "./units";

export type ParsedUnitPrice = {
  pricePerBaseUnit: number;
  dimension: UnitDimension;
};

// Matches "$0.12/fl oz", "$1.50 / lb", "$0.99/ct", "$2.10 /ea", Walmart's
// "price per N units" form "$1.06/100 ct", and cent-denominated forms
// "26.0 ¢/100 ct", "5.9 ¢/count" (amount then reads as cents, not dollars).
const UNIT_PRICE_REGEX =
  /([$¢])?\s?(\d[\d,]*(?:\.\d{1,2})?)\s?(¢)?\s*\/\s*(\d+(?:\.\d+)?)?\s*(fl\.?\s?oz|oz|lb|ml|kg|g|l|qt|gal|ct|ea|count)\b/i;

/**
 * Parses a displayed unit-price string as shown on a Walmart tile.
 * Returns null when the text does not contain a recognizable unit price.
 */
export function parseDisplayedUnitPrice(
  displayedUnitPriceText: string | null
): ParsedUnitPrice | null {
  if (!displayedUnitPriceText) return null;

  const match = displayedUnitPriceText.match(UNIT_PRICE_REGEX);
  if (!match || (!match[1] && !match[3])) return null;

  let amount = Number(match[2].replace(/,/g, ""));
  if (!Number.isFinite(amount)) return null;
  if (match[1] === "¢" || match[3] === "¢") amount /= 100;

  const denominator = match[4] ? Number(match[4]) : 1;
  if (!Number.isFinite(denominator) || denominator <= 0) return null;

  const unit = parseUnitToken(match[5]);
  if (!unit) return null;

  const { dimension, baseValue } = toBaseUnit(1, unit);
  // amount is price per `denominator` units of `unit`; convert to price per 1 base unit.
  return { pricePerBaseUnit: amount / denominator / baseValue, dimension };
}


