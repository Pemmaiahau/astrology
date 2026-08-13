import { aspectedSigns } from "./aspects";
import type { AshtakavargaResult } from "./ashtakavarga";
import { getAyanamsha } from "./ayanamsha";
import { isRetrograde, tropicalLongitude } from "./ephemeris";
import { doubleTransitOnSign } from "./jaimini";
import { angleDiff, norm360, signOf } from "./math";
import { ownedHouses } from "./yogas";
import type { AyanamshaId, ChartData, DashaPeriod, NodeMode, PlanetId } from "./types";

/**
 * Date-range scanning helpers used by the year-forecast feature.
 * Everything here is a pure function of (chart/tree, ayanamsha, date window);
 * nothing depends on "now", so any past or future window can be analysed.
 */

const DAY = 86400000;
const HOUR = 3600000;

/** Sidereal longitude of a body at an arbitrary instant. */
export function siderealLongitudeAt(
  id: PlanetId,
  ayanamsha: AyanamshaId,
  date: Date,
  nodeMode: NodeMode = "mean"
): number {
  return norm360(tropicalLongitude(id, date, nodeMode) - getAyanamsha(ayanamsha, date));
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
/**
 * Generic bisection: given a predicate that is `true` at `lo` and `false` at
 * `hi` (or vice versa — it refines the first change point), narrow the change
 * to within `tolMs` and return the later edge. Extracted from the previously
 * inlined bisections so any crossing (sign ingress, return, transit contact)
 * shares one root-finder.
 */
export function refineCrossing(
  atStart: boolean,
  predicate: (t: number) => boolean,
  lo: number,
  hi: number,
  tolMs: number
): number {
  while (hi - lo > tolMs) {
    const mid = (lo + hi) / 2;
    if (predicate(mid) === atStart) lo = mid;
    else hi = mid;
  }
  return hi;
}

export function signChangeEvents(
  id: PlanetId,
  ayanamsha: AyanamshaId,
  start: Date,
  end: Date,
  stepDays = 3,
  nodeMode: NodeMode = "mean"
): SignChange[] {
  const events: SignChange[] = [];
  const endMs = end.getTime();
  const step = stepDays * DAY;
  let tPrev = start.getTime();
  let sPrev = signOf(siderealLongitudeAt(id, ayanamsha, new Date(tPrev), nodeMode));

  while (tPrev < endMs) {
    const tc = Math.min(tPrev + step, endMs);
    const sCur = signOf(siderealLongitudeAt(id, ayanamsha, new Date(tc), nodeMode));
    if (sCur !== sPrev) {
      const cross = refineCrossing(
        true,
        (t) => signOf(siderealLongitudeAt(id, ayanamsha, new Date(t), nodeMode)) === sPrev,
        tPrev,
        tc,
        HOUR
      );
      const cdate = new Date(cross);
      events.push({
        id, date: cdate, fromSign: sPrev, toSign: sCur,
        retrograde: isRetrograde(id, cdate, nodeMode),
      });
    }
    sPrev = sCur;
    tPrev = tc;
  }
  return events;
}

export interface OccupancyInterval {
  sign: number;
  start: Date;
  end: Date;
}

/**
 * Piecewise-constant sign occupancy of a body over [start, end], folded from
 * its ingress events. Retrograde re-entries naturally produce separate
 * intervals for the same sign.
 */
export function occupancyIntervals(
  id: PlanetId,
  ayanamsha: AyanamshaId,
  start: Date,
  end: Date,
  stepDays = 3,
  nodeMode: NodeMode = "mean"
): OccupancyInterval[] {
  const events = signChangeEvents(id, ayanamsha, start, end, stepDays, nodeMode);
  const intervals: OccupancyInterval[] = [];
  let curSign = signOf(siderealLongitudeAt(id, ayanamsha, start, nodeMode));
  let curStart = start;
  for (const e of events) {
    intervals.push({ sign: curSign, start: curStart, end: e.date });
    curSign = e.toSign;
    curStart = e.date;
  }
  intervals.push({ sign: curSign, start: curStart, end });
  return intervals;
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
      const cross = refineCrossing(
        true,
        (mid) => angleDiff(siderealLongitudeAt("Su", ayanamsha, new Date(mid)), target) <= 0,
        tPrev,
        t,
        60000
      );
      return new Date(cross);
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

// ---------------------------------------------------------------------------
// Activation windows: dasha ∩ double transit ∩ ashtakavarga
// ---------------------------------------------------------------------------

export interface ActivationCriteria {
  /** Whole-sign houses (1–12) whose lords/occupants/aspectors activate the theme. */
  houses: number[];
  /** Planets that activate the theme regardless of lordship (natural/Jaimini karakas). */
  karakas?: PlanetId[];
  /** Additional target signs to watch for the double transit (e.g. Upapada). */
  extraSigns?: number[];
  /** When true, windows without any Saturn+Jupiter double-transit coverage are dropped. */
  requireDoubleTransit?: boolean;
  /** Minimum Jupiter BAV bindus in Jupiter's transited sign for the bindu bonus (default 4 of 8). */
  minBindus?: number;
  /** Maximum windows returned (default 8, mirroring the Life Areas horizon). */
  maxWindows?: number;
  /**
   * 0–1 prior for a window centred at instant `t`. Windows scoring 0 are
   * dropped. Injected as a function so this module stays free of domain age
   * tables — see `ageBands.ts` for the tables themselves.
   */
  agePriorAt?: (t: number) => number;
  /**
   * "Today", used only to phase-label windows — never to bound the scan.
   * When absent, no window is treated as elapsed (everything reads "future").
   */
  relativeTo?: Date;
}

export interface WindowReason {
  text: string;
  weight: number;
}

export interface ActivationWindow {
  start: Date;
  end: Date;
  /** Composite 0–100 desirability used for ranking. */
  score: number;
  /** 5–95 belief that the window is genuinely activated. */
  confidence: number;
  dasha: { maha: PlanetId; antar: PlanetId };
  /** True when Saturn and Jupiter jointly influence a target sign throughout. */
  doubleTransit: boolean;
  /** Relative to criteria.relativeTo; "current" = the instant falls inside the window. */
  phase: "past" | "current" | "future";
  /** The agePriorAt value at the window midpoint, when supplied. */
  agePrior?: number;
  reasons: WindowReason[];
}

/** How a planet connects to the criteria, or null when it does not. */
function connectionReasons(
  chart: ChartData,
  id: PlanetId,
  criteria: ActivationCriteria
): string[] {
  const reasons: string[] = [];
  const lagnaSign = chart.ascendant.sign;
  const planet = chart.planets.find((p) => p.id === id);
  const owned = ownedHouses(id, lagnaSign).filter((h) => criteria.houses.includes(h));
  if (owned.length) reasons.push(`lord of house ${owned.join("/")}`);
  if (planet && criteria.houses.includes(planet.house)) reasons.push(`occupies house ${planet.house}`);
  if (criteria.karakas?.includes(id)) reasons.push("karaka for this theme");
  if (planet) {
    const targets = criteria.houses.map((h) => (lagnaSign + h - 1) % 12);
    const aspected = aspectedSigns(id, planet.sign).filter((s) => targets.includes(s));
    if (aspected.length) {
      const houses = aspected.map((s) => ((s - lagnaSign + 12) % 12) + 1);
      reasons.push(`aspects house ${houses.join("/")}`);
    }
  }
  return reasons;
}

/**
 * Ranked activation windows for a life theme over [from, to]:
 *  1. every Antardasha whose Maha or Antar lord connects to the criteria
 *     (lordship / occupancy / karaka / aspect) is a candidate;
 *  2. candidates are refined by the Saturn+Jupiter double transit over the
 *     target signs (piecewise on ingress intervals — no daily sampling);
 *  3. Jupiter's Ashtakavarga bindus in its transited sign weight the result;
 *  4. an optional caller-supplied age prior nudges windows toward the years
 *     the event commonly happens in, and drops those outside the band.
 * The returned set is quota-balanced between elapsed and upcoming windows and
 * ordered chronologically (each window still carries its own score).
 * Deterministic, and cheap: a 20-year span costs ~25 ingress bisections.
 * Nothing here reads "now" — `[from, to]` may lie entirely in the past.
 */
export function findActivationWindows(
  chart: ChartData,
  tree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  criteria: ActivationCriteria,
  from: Date,
  to: Date
): ActivationWindow[] {
  if (!tree || !chart.birthUtc || to <= from) return [];
  const lagnaSign = chart.ascendant.sign;
  const nodeMode = chart.meta.nodeMode ?? "mean";
  const targetSigns = [
    ...criteria.houses.map((h) => (lagnaSign + h - 1) % 12),
    ...(criteria.extraSigns ?? []),
  ];

  // Piecewise Jupiter/Saturn sign occupancy over the whole span.
  const juIntervals = occupancyIntervals("Ju", ayanamsha, from, to, 3, nodeMode);
  const saIntervals = occupancyIntervals("Sa", ayanamsha, from, to, 5, nodeMode);
  const juSignAt = (t: number): OccupancyInterval =>
    juIntervals.find((i) => t >= i.start.getTime() && t < i.end.getTime()) ??
    juIntervals[juIntervals.length - 1];
  const saSignAt = (t: number): OccupancyInterval =>
    saIntervals.find((i) => t >= i.start.getTime() && t < i.end.getTime()) ??
    saIntervals[saIntervals.length - 1];

  // Boundaries where the double-transit state can change.
  const boundaries = [
    from.getTime(),
    ...juIntervals.map((i) => i.end.getTime()),
    ...saIntervals.map((i) => i.end.getTime()),
    to.getTime(),
  ]
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort((a, b) => a - b);

  const doubleTransitAt = (t: number): boolean =>
    targetSigns.some((s) => doubleTransitOnSign(s, juSignAt(t).sign, saSignAt(t).sign));

  const windows: ActivationWindow[] = [];
  const maha = periodsOverlapping(tree, 1, from, to);
  for (const md of maha) {
    const mahaReasons = connectionReasons(chart, md.lord, criteria);
    for (const ad of md.children ?? []) {
      if (ad.start >= to || ad.end <= from) continue;
      const antarReasons = connectionReasons(chart, ad.lord, criteria);
      if (!mahaReasons.length && !antarReasons.length) continue;

      const start = ad.start > from ? ad.start : from;
      const end = ad.end < to ? ad.end : to;

      // Base score from the dasha connection.
      let score = mahaReasons.length && antarReasons.length ? 60 : antarReasons.length ? 45 : 35;
      const reasons: WindowReason[] = [];
      if (mahaReasons.length)
        reasons.push({ text: `Mahadasha lord ${md.lord}: ${mahaReasons.join("; ")}`, weight: 25 });
      if (antarReasons.length)
        reasons.push({ text: `Antardasha lord ${ad.lord}: ${antarReasons.join("; ")}`, weight: 30 });

      // Double-transit coverage across the window (piecewise on boundaries).
      let covered = 0;
      const total = end.getTime() - start.getTime();
      for (let i = 0; i < boundaries.length - 1; i++) {
        const s = Math.max(boundaries[i], start.getTime());
        const e = Math.min(boundaries[i + 1], end.getTime());
        if (e <= s) continue;
        if (doubleTransitAt(s)) covered += e - s;
      }
      const fraction = total > 0 ? covered / total : 0;
      const hasDouble = fraction > 0.25;
      if (criteria.requireDoubleTransit && fraction === 0) continue;
      if (hasDouble) {
        score += Math.round(20 * fraction);
        reasons.push({
          text: `Saturn and Jupiter jointly influence the theme for ${Math.round(fraction * 100)}% of this period`,
          weight: Math.round(20 * fraction),
        });
      }

      // Ashtakavarga: Jupiter's bindus in the sign it transits mid-window.
      if (av) {
        const midJu = juSignAt((start.getTime() + end.getTime()) / 2);
        const bindus = av.bav.Ju?.[midJu.sign];
        if (bindus !== undefined) {
          const minB = criteria.minBindus ?? 4;
          const delta = Math.max(-10, Math.min(10, (bindus - minB) * 2.5));
          score += delta;
          reasons.push({
            text: `Jupiter transits a sign holding ${bindus} of its 8 Ashtakavarga bindus`,
            weight: Math.round(delta),
          });
        }
      }

      // Age prior: how commonly this kind of event happens at this stage of a
      // life. Supplied by the caller (see `ageBands.ts`) so this module holds
      // no domain tables of its own.
      let agePrior: number | undefined;
      if (criteria.agePriorAt) {
        const prior = criteria.agePriorAt((start.getTime() + end.getTime()) / 2);
        if (prior <= 0) continue; // outside the band entirely
        agePrior = prior;
        const weight = Math.round(30 * (prior - 0.5)); // −15 … +15
        score += weight;
        reasons.push({
          text:
            prior >= 0.85
              ? "This falls in the years when this event most commonly occurs"
              : prior < 0.4
                ? "This sits at the edge of the usual age range for this event"
                : "This falls within the usual age range for this event",
          weight,
        });
      }

      score = Math.max(0, Math.min(100, Math.round(score)));
      const ref = criteria.relativeTo?.getTime();
      const phase: ActivationWindow["phase"] =
        ref === undefined || start.getTime() > ref
          ? "future"
          : end.getTime() <= ref
            ? "past"
            : "current";

      windows.push({
        start,
        end,
        score,
        confidence: Math.max(5, Math.min(95, score)),
        dasha: { maha: md.lord, antar: ad.lord },
        doubleTransit: hasDouble,
        phase,
        agePrior,
        reasons,
      });
    }
  }

  // Selection is a quota, not a plain top-N: elapsed windows often outscore
  // upcoming ones (that is the point of scanning backwards), and a pure
  // score sort would let them crowd out everything the reader can still act
  // on. Half the slots are reserved for non-past windows; whichever pool is
  // short gives its slots back to the other.
  windows.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  const max = criteria.maxWindows ?? 8;
  const upcoming = windows.filter((w) => w.phase !== "past");
  const past = windows.filter((w) => w.phase === "past");
  const upTake = Math.min(Math.ceil(max / 2), upcoming.length);
  const pastTake = Math.min(max - upTake, past.length);
  const upExtra = Math.min(max - upTake - pastTake, upcoming.length - upTake);
  const selected = [...upcoming.slice(0, upTake + upExtra), ...past.slice(0, pastTake)];

  // Chronological output reads as a life story; the score is still carried
  // on each window for callers that want to rank.
  return selected.sort((a, b) => a.start.getTime() - b.start.getTime());
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
