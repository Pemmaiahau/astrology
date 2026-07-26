import { getAyanamsha } from "./ayanamsha";
import { isRetrograde, tropicalLongitude } from "./ephemeris";
import { angleDiff, norm360, signOf } from "./math";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId } from "./types";

/**
 * Date-range scanning helpers used by the year-forecast feature.
 * Everything here is a pure function of (chart/tree, ayanamsha, date window);
 * nothing depends on "now", so any past or future window can be analysed.
 */

const DAY = 86400000;
const HOUR = 3600000;

/** Sidereal longitude of a body at an arbitrary instant. */
export function siderealLongitudeAt(id: PlanetId, ayanamsha: AyanamshaId, date: Date): number {
  return norm360(tropicalLongitude(id, date) - getAyanamsha(ayanamsha, date));
}

export interface SignChange {
  id: PlanetId;
  date: Date;
  fromSign: number;
  toSign: number;
  retrograde: boolean;
}

/**
 * All sidereal sign ingresses of `id` within [start, end]. Coarse-scans at
 * `stepDays` then bisects each detected crossing to ~1-hour precision. A
 * `stepDays` of 3 is safe for the slow movers (Jupiter/Saturn/Rahu/Ketu),
 * which cannot traverse a whole sign inside one step even near a station.
 * Retrograde loops legitimately produce multiple ingresses near a cusp.
 */
export function signChangeEvents(
  id: PlanetId,
  ayanamsha: AyanamshaId,
  start: Date,
  end: Date,
  stepDays = 3
): SignChange[] {
  const events: SignChange[] = [];
  const endMs = end.getTime();
  const step = stepDays * DAY;
  let tPrev = start.getTime();
  let sPrev = signOf(siderealLongitudeAt(id, ayanamsha, new Date(tPrev)));

  while (tPrev < endMs) {
    const tc = Math.min(tPrev + step, endMs);
    const sCur = signOf(siderealLongitudeAt(id, ayanamsha, new Date(tc)));
    if (sCur !== sPrev) {
      let lo = tPrev;
      let hi = tc;
      while (hi - lo > HOUR) {
        const mid = (lo + hi) / 2;
        if (signOf(siderealLongitudeAt(id, ayanamsha, new Date(mid))) === sPrev) lo = mid;
        else hi = mid;
      }
      const cdate = new Date(hi);
      events.push({ id, date: cdate, fromSign: sPrev, toSign: sCur, retrograde: isRetrograde(id, cdate) });
    }
    sPrev = sCur;
    tPrev = tc;
  }
  return events;
}

/**
 * Instant in `year` when the transiting Sun returns to its natal sidereal
 * longitude (the Vedic solar-return / Varshaphal anchor). Searches ±3 days
 * around the birthday of `year`; returns null when there is no birth data.
 */
export function solarReturn(chart: ChartData, ayanamsha: AyanamshaId, year: number): Date | null {
  if (!chart.birthUtc) return null;
  const natalSun = chart.planets.find((p) => p.id === "Su");
  if (!natalSun) return null;
  const target = natalSun.longitude;

  const center = new Date(chart.birthUtc);
  center.setUTCFullYear(year);
  const startMs = center.getTime() - 3 * DAY;
  const endMs = center.getTime() + 3 * DAY;
  const step = 6 * HOUR;

  let tPrev = startMs;
  let fPrev = angleDiff(siderealLongitudeAt("Su", ayanamsha, new Date(tPrev)), target);
  for (let t = tPrev + step; t <= endMs; t += step) {
    const fCur = angleDiff(siderealLongitudeAt("Su", ayanamsha, new Date(t)), target);
    // Sun longitude is monotonically increasing here, so the return is the
    // point where (sun - natal) crosses zero from negative to positive.
    if (fPrev <= 0 && fCur >= 0) {
      let lo = tPrev;
      let hi = t;
      while (hi - lo > 60000) {
        const mid = (lo + hi) / 2;
        const fm = angleDiff(siderealLongitudeAt("Su", ayanamsha, new Date(mid)), target);
        if (fm <= 0) lo = mid;
        else hi = mid;
      }
      return new Date(hi);
    }
    fPrev = fCur;
    tPrev = t;
  }
  return null;
}

/** All dasha periods at a given level that overlap the window. */
export function periodsOverlapping(
  tree: DashaPeriod[],
  level: 1 | 2 | 3,
  start: Date,
  end: Date
): DashaPeriod[] {
  const s = start.getTime();
  const e = end.getTime();
  const out: DashaPeriod[] = [];
  const walk = (periods: DashaPeriod[]) => {
    for (const p of periods) {
      if (p.level === level) {
        if (p.start.getTime() < e && p.end.getTime() > s) out.push(p);
      } else if (p.children) {
        walk(p.children);
      }
    }
  };
  walk(tree);
  return out;
}

/** Start timestamps of level-`level` periods that begin strictly inside the window. */
export function boundariesWithin(
  tree: DashaPeriod[],
  level: 1 | 2 | 3,
  start: Date,
  end: Date
): number[] {
  const s = start.getTime();
  const e = end.getTime();
  const set = new Set<number>();
  for (const p of periodsOverlapping(tree, level, start, end)) {
    const st = p.start.getTime();
    if (st > s && st < e) set.add(st);
  }
  return [...set].sort((a, b) => a - b);
}
