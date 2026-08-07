/**
 * Age bands for probable-window scanning.
 *
 * The timing scanner (`scan.ts`) is a pure function of a date range, so the
 * question "which range?" has to be answered somewhere. Answering it as
 * "now → now + 15 years" is wrong: it shows a 52-year-old marriage windows at
 * 52–67, shows a 12-year-old career windows starting at 12, and hides the
 * 22–30 window that may have been the strongest marriage yoga in the chart
 * from anyone who is already past it. This module supplies the missing piece
 * — the native's *life stage* — as an explicit, inspectable table.
 *
 * HONESTY NOTE — these bands are NOT a classical shastric rule. No Parashari
 * text says marriage happens between 22 and 45. They are a modern demographic
 * convention: the ages at which these events commonly occur in contemporary
 * life. The chart supplies the timing; the band supplies the plausibility, and
 * the two are weighted separately so a reader can discount the band if their
 * own life does not match it. This is recorded in the disagreement log in
 * `data/interpretations/SOURCES.md` and surfaced as a caveat in the UI.
 *
 * Pure: no astronomy, no `Date.now()`, no chart access.
 */

export interface AgeBand {
  /** Band opens (years). Windows entirely before this are not scanned. */
  start: number;
  /** Band closes (years). */
  end: number;
  /** Highest-probability sub-range. */
  peakStart: number;
  peakEnd: number;
}

export type BandKey = "marriage" | "careerEntry" | "careerChange" | "wealth" | "foreign";

/**
 * Modern demographic convention (see the honesty note above), not classical.
 * `cautions` deliberately has no band: health and adversity are age-independent,
 * so that section keeps a rolling forward horizon instead.
 */
export const AGE_BANDS: Record<BandKey, AgeBand> = {
  // Tapers hard after 40 — the ramp from 32 to 45 is the longest here.
  marriage: { start: 22, end: 45, peakStart: 24, peakEnd: 32 },
  // First establishment in a profession.
  careerEntry: { start: 22, end: 30, peakStart: 24, peakEnd: 28 },
  // Change, elevation, independence.
  careerChange: { start: 28, end: 50, peakStart: 32, peakEnd: 42 },
  // The accumulation arc.
  wealth: { start: 25, end: 65, peakStart: 32, peakEnd: 50 },
  // Study migration early, work migration later.
  foreign: { start: 18, end: 55, peakStart: 22, peakEnd: 38 },
};

/** Mean tropical year in days — the same convention used for age arithmetic below. */
const YEAR_DAYS = 365.2425;
const YEAR_MS = YEAR_DAYS * 86400000;

/**
 * A soft floor at the band edges, so probability tapers rather than cliffs:
 * being one year outside the peak is not the same as being outside the band.
 */
export const EDGE_PRIOR = 0.15;

/** Fractional age in years at `date` (365.2425-day years). Negative before birth. */
export function ageAt(birthUtc: Date, date: Date): number {
  return (date.getTime() - birthUtc.getTime()) / YEAR_MS;
}

/** The instant the native turns `age`. */
export function dateAtAge(birthUtc: Date, age: number): Date {
  return new Date(birthUtc.getTime() + age * YEAR_MS);
}

/**
 * 0–1 probability prior for an event at `age`:
 *  - 1.0 inside [peakStart, peakEnd];
 *  - linear ramp EDGE_PRIOR → 1.0 across [start, peakStart];
 *  - linear ramp 1.0 → EDGE_PRIOR across [peakEnd, end];
 *  - 0 strictly outside [start, end].
 */
export function agePrior(band: AgeBand, age: number): number {
  if (age < band.start || age > band.end) return 0;
  if (age >= band.peakStart && age <= band.peakEnd) return 1;
  if (age < band.peakStart) {
    const span = band.peakStart - band.start;
    if (span <= 0) return 1;
    return EDGE_PRIOR + (1 - EDGE_PRIOR) * ((age - band.start) / span);
  }
  const span = band.end - band.peakEnd;
  if (span <= 0) return 1;
  return 1 - (1 - EDGE_PRIOR) * ((age - band.peakEnd) / span);
}

/**
 * Convenience for builders: an `agePriorAt(t)` closure over epoch milliseconds,
 * which is the shape `ActivationCriteria` wants.
 */
export function agePriorFor(birthUtc: Date, band: AgeBand): (t: number) => number {
  return (t: number) => agePrior(band, ageAt(birthUtc, new Date(t)));
}

/** Whole-year age at an instant, for display ("age 24–29"). */
export function ageYearsAt(birthUtc: Date, date: Date): number {
  return Math.round(ageAt(birthUtc, date));
}

/**
 * How the native's current age sits against a band — drives the card copy for
 * the "too young yet" and "band has closed" cases.
 */
export function bandStance(
  band: AgeBand,
  currentAge: number
): "before" | "inside" | "after" {
  if (currentAge < band.start) return "before";
  if (currentAge > band.end) return "after";
  return "inside";
}
