import { SIGN_LORDS } from "./constants";
import type { ChartData, PlanetId } from "./types";

/**
 * Muntha — the annual progressed point of the Tajika (Varshaphala) system.
 *
 * It starts on the natal Lagna at birth and advances one whole sign for each
 * completed year of life, so at age N it occupies the (N mod 12) + 1th house.
 * The house it lands in names the department of life the year is about, and
 * its lord's condition says how that year tends to go.
 *
 * This has existed inside `rectification/rectify.ts` as three inline lines
 * used to date a rectification candidate, where no reader could ever see it.
 * Lifted here so the natal side of the app can use it too.
 *
 * SCOPE: this is the Muntha only, not Varshaphala. The full Tajika procedure —
 * the five year-lord candidates, the sahams, mudda dasha, Tajika aspects and
 * Panchavargiya bala — is not implemented, and a Muntha on its own is an
 * anchor rather than an annual reading. `ENGINE.md §19` records the same
 * boundary for the sidereal solar return.
 */

/** Mean tropical year — matches the convention in `ageBands.ts`. */
const YEAR_MS = 365.2425 * 86400000;

export interface Muntha {
  /** Completed years of life this Muntha is for. */
  age: number;
  /** Whole-sign house from the natal Lagna, 1-12. */
  house: number;
  /** Sidereal sign index 0-11. */
  sign: number;
  /** Lord of the occupied sign — the planet whose condition colours the year. */
  lord: PlanetId;
}

/**
 * Completed years of life at `date`. Floored, because the Muntha advances on
 * the birthday: someone 29 years and 11 months old is still in their 29th
 * Muntha, not their 30th.
 */
export function completedYears(birthUtc: Date, date: Date): number {
  return Math.floor((date.getTime() - birthUtc.getTime()) / YEAR_MS);
}

/** Muntha for a given number of completed years. */
export function munthaAtAge(chart: ChartData, age: number): Muntha {
  // Negative ages (a window before birth) wrap the same way, so the modulo is
  // taken twice rather than trusting JS's sign-preserving `%`.
  const house = (((age % 12) + 12) % 12) + 1;
  const sign = (chart.ascendant.sign + house - 1) % 12;
  return { age, house, sign, lord: SIGN_LORDS[sign] };
}

/** Muntha running at an instant. Null without a birth anchor. */
export function munthaAt(chart: ChartData, date: Date): Muntha | null {
  if (!chart.birthUtc) return null;
  return munthaAtAge(chart, completedYears(chart.birthUtc, date));
}
