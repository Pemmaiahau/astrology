import { occupancyIntervals } from "./scan";
import type { AyanamshaId, ChartData } from "./types";

/**
 * Sade Sati — Saturn's seven-and-a-half-year passage over the three signs
 * centred on the natal Moon (the 12th, the 1st and the 2nd from it).
 *
 * `transits.ts` already answers "is Sade Sati running right now?" from a
 * transit snapshot. That is the cheap question. This module answers the one
 * readers actually ask — *when* — by folding Saturn's sign occupancy over a
 * whole life into dated phases, so a chart can show the passages that have
 * already happened, the one running now, and the one still to come.
 *
 * The phase boundaries are Saturn's sidereal sign ingresses, which is the
 * classical definition: the passage is reckoned by sign, not by degree, and
 * not by the Moon's own longitude within its sign.
 *
 * Retrograde re-entry is real and is handled rather than smoothed over —
 * Saturn can cross back into the previous sign for a few months mid-passage.
 * The scan yields separate occupancy intervals for that, and they are merged
 * back into one span per phase, so a reader sees "Saturn in the 12th from your
 * Moon: Mar 2027 – Jun 2029" rather than three fragments of the same thing.
 */

export type SadeSatiPhaseKey = "rising" | "peak" | "setting";

/** Which house from the natal Moon each phase corresponds to. */
export const SADE_SATI_HOUSE: Record<SadeSatiPhaseKey, number> = {
  rising: 12,
  peak: 1,
  setting: 2,
};

export interface SadeSatiPhaseSpan {
  phase: SadeSatiPhaseKey;
  /** Sidereal sign Saturn occupies during this phase. */
  sign: number;
  start: Date;
  end: Date;
}

export interface SadeSatiPeriod {
  /** 1-based ordinal across the scanned window. */
  index: number;
  start: Date;
  end: Date;
  phases: SadeSatiPhaseSpan[];
  status: "past" | "current" | "future";
  /**
   * True when the passage is clipped by the scan window rather than genuinely
   * beginning/ending there — so the UI can avoid printing a start date that is
   * really just "before we started looking".
   */
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** How long a life to scan, in years, when the caller does not say. */
const DEFAULT_SPAN_YEARS = 96;
const YEAR_MS = 365.2425 * 86400000;

/**
 * A 10-day coarse step. Saturn needs ~2.4 years to cross a sign, so it cannot
 * skip one inside a step; the tighter-than-necessary value is for retrograde
 * loops near a cusp, where two genuine ingresses can fall a few weeks apart
 * and a monthly step could swallow the pair.
 */
const SATURN_STEP_DAYS = 10;

/**
 * Longest gap that still counts as one passage. A retrograde excursion out of
 * the closing sign lasts a few months; the next passage is ~22 years away.
 * Anything inside a year is the same Sade Sati finishing.
 */
const REENTRY_GAP_MS = 365 * 86400000;

/**
 * Every Sade Sati passage between `from` and `to`.
 *
 * Cost is one Saturn ingress scan over the window — a few hundred ephemeris
 * samples — so this belongs behind a lazy boundary rather than on the
 * always-on cascade in `ChartContext`.
 */
export function sadeSatiPeriods(
  chart: ChartData,
  ayanamsha: AyanamshaId,
  now: Date,
  from?: Date,
  to?: Date
): SadeSatiPeriod[] {
  const moon = chart.planets.find((p) => p.id === "Mo");
  if (!moon) return [];

  const anchor = chart.birthUtc ?? now;
  const start = from ?? anchor;
  const end = to ?? new Date(anchor.getTime() + DEFAULT_SPAN_YEARS * YEAR_MS);
  if (end <= start) return [];

  const nodeMode = chart.meta.nodeMode ?? "mean";
  const intervals = occupancyIntervals("Sa", ayanamsha, start, end, SATURN_STEP_DAYS, nodeMode);

  // Which of the three signs — if any — each occupancy interval represents.
  const phaseOf = (sign: number): SadeSatiPhaseKey | null => {
    const fromMoon = ((sign - moon.sign + 12) % 12) + 1;
    if (fromMoon === 12) return "rising";
    if (fromMoon === 1) return "peak";
    if (fromMoon === 2) return "setting";
    return null;
  };

  // Group maximal runs of consecutive in-passage intervals. `occupancyIntervals`
  // returns a contiguous piecewise cover, so "consecutive in the array" is the
  // same as "adjacent in time".
  const runs: SadeSatiPhaseSpan[][] = [];
  let current: SadeSatiPhaseSpan[] = [];
  for (const iv of intervals) {
    const phase = phaseOf(iv.sign);
    if (phase) {
      current.push({ phase, sign: iv.sign, start: iv.start, end: iv.end });
    } else if (current.length) {
      runs.push(current);
      current = [];
    }
  }
  if (current.length) runs.push(current);

  // Stitch runs split by a retrograde excursion. Saturn can leave the 2nd from
  // the Moon, turn retrograde and cross back for a few months — which breaks
  // the run above and would otherwise be reported as a separate three-month
  // "Sade Sati" a few months after the real one ended. Consecutive passages are
  // ~22 years apart and a retrograde excursion cannot exceed a few months, so
  // any gap under a year is the same passage still finishing.
  const stitched: SadeSatiPhaseSpan[][] = [];
  for (const run of runs) {
    const previous = stitched[stitched.length - 1];
    const gapMs = previous ? run[0].start.getTime() - previous[previous.length - 1].end.getTime() : Infinity;
    if (previous && gapMs < REENTRY_GAP_MS) previous.push(...run);
    else stitched.push([...run]);
  }

  const nowMs = now.getTime();
  return stitched.map((run, i) => {
    const periodStart = run[0].start;
    const periodEnd = run[run.length - 1].end;
    return {
      index: i + 1,
      start: periodStart,
      end: periodEnd,
      phases: mergeAdjacentPhases(run),
      status:
        periodEnd.getTime() <= nowMs ? "past" : periodStart.getTime() > nowMs ? "future" : "current",
      clippedStart: periodStart.getTime() <= start.getTime(),
      clippedEnd: periodEnd.getTime() >= end.getTime(),
    };
  });
}

/**
 * Fold a retrograde re-entry back into a single span. Saturn leaving the 12th
 * for the 1st and slipping back for four months produces three intervals for
 * two phases; the reader wants two rows, each with its true outer bounds.
 */
function mergeAdjacentPhases(run: SadeSatiPhaseSpan[]): SadeSatiPhaseSpan[] {
  const byPhase = new Map<SadeSatiPhaseKey, SadeSatiPhaseSpan>();
  for (const span of run) {
    const existing = byPhase.get(span.phase);
    if (!existing) {
      byPhase.set(span.phase, { ...span });
      continue;
    }
    if (span.start < existing.start) existing.start = span.start;
    if (span.end > existing.end) existing.end = span.end;
  }
  // Classical order, not first-seen order: a passage clipped by the scan
  // window can legitimately open on any of the three.
  const order: SadeSatiPhaseKey[] = ["rising", "peak", "setting"];
  return order.map((p) => byPhase.get(p)).filter((s): s is SadeSatiPhaseSpan => s !== undefined);
}

/** The passage running at `now`, if any. */
export function currentSadeSati(periods: SadeSatiPeriod[]): SadeSatiPeriod | null {
  return periods.find((p) => p.status === "current") ?? null;
}

/** The phase running at `now` within a passage, if any. */
export function currentPhase(period: SadeSatiPeriod, now: Date): SadeSatiPhaseSpan | null {
  const t = now.getTime();
  return period.phases.find((s) => t >= s.start.getTime() && t < s.end.getTime()) ?? null;
}
