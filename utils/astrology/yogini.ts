import { norm360 } from "./math";
import type { PlanetId } from "./types";

/**
 * Yogini dasha — the 36-year nakshatra dasha used alongside Vimshottari as a
 * cross-check on timing (BPHS Ch. on Yogini dasha; the standard modern
 * reference implementation is the one in Jagannatha Hora).
 *
 * Eight yoginis, each ruled by a graha, with 1…8 years:
 *   Mangala (Moon) 1 · Pingala (Sun) 2 · Dhanya (Jupiter) 3 · Bhramari (Mars) 4
 *   Bhadrika (Mercury) 5 · Ulka (Saturn) 6 · Siddha (Venus) 7 · Sankata (Rahu) 8
 *
 * The opening yogini is (birth-nakshatra number + 3) mod 8, a remainder of 0
 * meaning the 8th (Ardra → Mangala, Ashwini → Bhramari). The balance at birth
 * is the unelapsed fraction of the Moon's nakshatra, exactly as in
 * Vimshottari. Antardashas run from the mahadasha's own yogini onward, each
 * lasting (MD years × AD years / 36).
 *
 * A year is 365.25 days, matching `dasha.ts`, so the two systems' dates are
 * directly comparable.
 */

export interface Yogini {
  name: string;
  lord: PlanetId;
  years: number;
}

export const YOGINIS: Yogini[] = [
  { name: "Mangala", lord: "Mo", years: 1 },
  { name: "Pingala", lord: "Su", years: 2 },
  { name: "Dhanya", lord: "Ju", years: 3 },
  { name: "Bhramari", lord: "Ma", years: 4 },
  { name: "Bhadrika", lord: "Me", years: 5 },
  { name: "Ulka", lord: "Sa", years: 6 },
  { name: "Siddha", lord: "Ve", years: 7 },
  { name: "Sankata", lord: "Ra", years: 8 },
];

const CYCLE_YEARS = 36;
const YEAR_MS = 365.25 * 86400000;

export interface YoginiPeriod {
  yogini: Yogini;
  start: Date;
  end: Date;
  level: 1 | 2;
  children?: YoginiPeriod[];
}

/** Index into `YOGINIS` of the yogini running at birth, for a 0-based nakshatra. */
export function openingYoginiIndex(nakshatra: number): number {
  return (nakshatra + 3) % 8;
}

/**
 * Yogini mahadashas (with antardashas) from the period running at birth until
 * the cycle has covered `spanYears` after birth.
 */
export function yoginiDasha(moonSiderealLon: number, birthUtc: Date, spanYears = 120): YoginiPeriod[] {
  const lon = norm360(moonSiderealLon);
  const nakSpan = 360 / 27;
  const nak = Math.floor(lon / nakSpan);
  const frac = (lon % nakSpan) / nakSpan;
  const startIdx = openingYoginiIndex(nak);

  const horizon = birthUtc.getTime() + spanYears * YEAR_MS;
  let t = birthUtc.getTime() - frac * YOGINIS[startIdx].years * YEAR_MS;
  const out: YoginiPeriod[] = [];
  for (let i = 0; t < horizon; i++) {
    const yogini = YOGINIS[(startIdx + i) % 8];
    const durMs = yogini.years * YEAR_MS;
    const children: YoginiPeriod[] = [];
    let ta = t;
    for (let j = 0; j < 8; j++) {
      const sub = YOGINIS[(startIdx + i + j) % 8];
      const subMs = (durMs * sub.years) / CYCLE_YEARS;
      children.push({ yogini: sub, start: new Date(ta), end: new Date(ta + subMs), level: 2 });
      ta += subMs;
    }
    out.push({ yogini, start: new Date(t), end: new Date(t + durMs), level: 1, children });
    t += durMs;
  }
  return out;
}

/** The mahadasha and antardasha running at `when`, if any. */
export function activeYoginiAt(
  tree: YoginiPeriod[],
  when: Date
): { maha: YoginiPeriod; antar: YoginiPeriod } | null {
  const t = when.getTime();
  const maha = tree.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  const antar = maha?.children?.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  return maha && antar ? { maha, antar } : null;
}
