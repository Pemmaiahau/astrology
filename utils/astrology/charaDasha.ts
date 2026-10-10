import { resolvedLordSign } from "./jaimini";
import type { ChartData, PlanetId } from "./types";

/**
 * Jaimini Chara (sign) dasha, in the form taught by K.N. Rao ("Predicting
 * Through Jaimini's Chara Dasha") — the most widely used modern reading.
 *
 * - Savya (direct-counted) signs: Aries, Taurus, Gemini, Libra, Scorpio,
 *   Sagittarius. The others are apasavya (counted in reverse).
 * - Sequence: the dashas start from the Lagna sign and run zodiacally when the
 *   9th from the Lagna is a savya sign, in reverse otherwise.
 * - Duration: count from the dasha sign to its lord — forward for a savya
 *   sign, backward for an apasavya one — and subtract one. A lord in the sign
 *   itself gives 12 years. One year is added for an exalted lord and one taken
 *   off for a debilitated lord (not applied when the lord sits in the sign
 *   itself, where the 12-year rule already governs).
 * - Scorpio/Aquarius use the co-lord resolution in `jaimini.ts`.
 * - The second cycle runs in the same order, each sign getting 12 minus its
 *   first-cycle years.
 * - Antardashas: twelve equal parts, starting from the sign after the dasha
 *   sign (forward for a savya dasha sign, backward otherwise) so the dasha
 *   sign's own antardasha comes last.
 *
 * Chara dasha starts at birth — there is no balance.
 */

const SAVYA = [0, 1, 2, 6, 7, 8];
const YEAR_MS = 365.25 * 86400000;

export interface CharaPeriod {
  sign: number;
  /** Lord used for the duration count (resolved co-lord for Sc/Aq). */
  lord: PlanetId;
  years: number;
  cycle: 1 | 2;
  start: Date;
  end: Date;
  /** Antardasha signs in order, each 1/12 of the dasha. */
  antardashas: { sign: number; start: Date; end: Date }[];
}

export function isSavya(sign: number): boolean {
  return SAVYA.includes(sign);
}

/** First-cycle years for one sign, with the lord used. */
export function charaDashaYears(chart: ChartData, sign: number): { lord: PlanetId; years: number } {
  const { lord, sign: lordSign } = resolvedLordSign(chart, sign);
  const count = isSavya(sign)
    ? ((lordSign - sign + 12) % 12) + 1
    : ((sign - lordSign + 12) % 12) + 1;
  if (count === 1) return { lord, years: 12 };
  let years = count - 1;
  const dignity = chart.planets.find((p) => p.id === lord)?.dignity;
  if (dignity === "exalted") years += 1;
  if (dignity === "debilitated") years -= 1;
  return { lord, years: Math.max(0, years) };
}

/** Chara mahadashas from birth, first and second cycle, up to `spanYears`. */
export function charaDasha(chart: ChartData, birthUtc: Date, spanYears = 120): CharaPeriod[] {
  const lagna = chart.ascendant.sign;
  const forward = isSavya((lagna + 8) % 12);
  const order = Array.from({ length: 12 }, (_, i) => (lagna + (forward ? i : 12 - i)) % 12);
  const first = order.map((sign) => ({ sign, ...charaDashaYears(chart, sign) }));

  const horizon = birthUtc.getTime() + spanYears * YEAR_MS;
  const out: CharaPeriod[] = [];
  let t = birthUtc.getTime();
  for (const cycle of [1, 2] as const) {
    for (const f of first) {
      if (t >= horizon) return out;
      const years = cycle === 1 ? f.years : 12 - f.years;
      if (years <= 0) continue;
      const durMs = years * YEAR_MS;
      const step = isSavya(f.sign) ? 1 : 11;
      const antardashas = Array.from({ length: 12 }, (_, i) => ({
        sign: (f.sign + step * (i + 1)) % 12,
        start: new Date(t + (durMs * i) / 12),
        end: new Date(t + (durMs * (i + 1)) / 12),
      }));
      out.push({
        sign: f.sign, lord: f.lord, years, cycle,
        start: new Date(t), end: new Date(t + durMs), antardashas,
      });
      t += durMs;
    }
  }
  return out;
}
