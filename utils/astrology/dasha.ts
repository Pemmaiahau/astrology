import { DASHA_SEQUENCE, DASHA_YEARS, NAKSHATRA_LORDS } from "./constants";
import { norm360 } from "./math";
import type { DashaPeriod, PlanetId } from "./types";

const YEAR_MS = 365.25 * 86400000;
const CYCLE_YEARS = 120;

/**
 * Full Vimshottari tree (Mahadasha -> Antardasha -> Pratyantardasha),
 * anchored on the Moon's exact sidereal longitude at birth. The first
 * Mahadasha's start precedes birth by the elapsed fraction of the Moon's
 * nakshatra — the standard "balance of dasha" construction.
 */
export function vimshottariTree(moonSiderealLon: number, birthUtc: Date): DashaPeriod[] {
  const lon = norm360(moonSiderealLon);
  const nakSpan = 360 / 27;
  const nakIndex = Math.floor(lon / nakSpan);
  const frac = (lon % nakSpan) / nakSpan; // elapsed fraction of the nakshatra
  const startLord = NAKSHATRA_LORDS[nakIndex];
  const startIdx = DASHA_SEQUENCE.indexOf(startLord);

  const periods: DashaPeriod[] = [];
  let t = birthUtc.getTime() - frac * DASHA_YEARS[startLord] * YEAR_MS;

  for (let i = 0; i < 9; i++) {
    const lord = DASHA_SEQUENCE[(startIdx + i) % 9];
    const durMs = DASHA_YEARS[lord] * YEAR_MS;
    const md: DashaPeriod = {
      lord,
      start: new Date(t),
      end: new Date(t + durMs),
      level: 1,
      children: buildSubPeriods(lord, t, durMs, 2),
    };
    periods.push(md);
    t += durMs;
  }
  return periods;
}

function buildSubPeriods(parentLord: PlanetId, startMs: number, parentDurMs: number, level: 2 | 3): DashaPeriod[] {
  const seqStart = DASHA_SEQUENCE.indexOf(parentLord);
  const out: DashaPeriod[] = [];
  let t = startMs;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_SEQUENCE[(seqStart + i) % 9];
    const durMs = (parentDurMs * DASHA_YEARS[lord]) / CYCLE_YEARS;
    out.push({
      lord,
      start: new Date(t),
      end: new Date(t + durMs),
      level,
      children: level === 2 ? buildSubPeriods(lord, t, durMs, 3) : undefined,
    });
    t += durMs;
  }
  return out;
}

export interface ActiveDasha {
  maha: DashaPeriod;
  antar: DashaPeriod;
  pratyantar: DashaPeriod;
}

export function activeDashaAt(tree: DashaPeriod[], when: Date): ActiveDasha | null {
  const t = when.getTime();
  const maha = tree.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  if (!maha || !maha.children) return null;
  const antar = maha.children.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  if (!antar || !antar.children) return null;
  const pratyantar = antar.children.find((p) => t >= p.start.getTime() && t < p.end.getTime());
  if (!pratyantar) return null;
  return { maha, antar, pratyantar };
}

/** Balance of the opening Mahadasha at birth, in years. */
export function openingBalanceYears(tree: DashaPeriod[], birthUtc: Date): { lord: PlanetId; years: number } {
  const first = tree[0];
  const remainMs = first.end.getTime() - birthUtc.getTime();
  return { lord: first.lord, years: remainMs / YEAR_MS };
}
