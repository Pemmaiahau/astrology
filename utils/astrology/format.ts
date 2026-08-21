/**
 * Text formatting helpers shared across the engine.
 *
 * Separate from `math.ts` (which formats *angles*) because these are consumed
 * by both layers: `utils/astrology/*` and `data/interpretations/*`. `ordinal`
 * previously lived in `data/interpretations/synthesis.ts`, which put it out of
 * reach of `utils/astrology/yogas.ts` — the dependency only runs utils → data,
 * never the reverse. `yogas.ts` therefore hand-rolled `${house}th` and emitted
 * "the 1th house". Anything in `utils` that needs an ordinal imports it here;
 * `synthesis.ts` re-exports it so existing `data`-layer importers are unchanged.
 */

/**
 * English ordinal for an integer: 1 → "1st", 12 → "12th", 21 → "21st".
 *
 * Derived from the suffix rule rather than a lookup table, so it stays correct
 * past the twelve houses the table used to cover. The 11/12/13 exception is
 * checked before the units digit — otherwise 11, 12 and 13 would take the
 * st/nd/rd suffixes their last digit suggests.
 */
export function ordinal(n: number): string {
  const whole = Math.trunc(n);
  const tens = Math.abs(whole) % 100;
  const units = Math.abs(whole) % 10;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : units === 1 ? "st" : units === 2 ? "nd" : units === 3 ? "rd" : "th";
  return `${whole}${suffix}`;
}
