import type { ChartData, DashaPeriod, Gender, PlanetId } from "../types";
import type { VargaSet } from "../varga";
import { dashaFitness } from "./dashaFitness";
import { transitFitness, type TransitSnapshot } from "./transitFitness";
import { vargaFitness } from "./vargaFitness";
import { EVENT_RULES } from "./eventRules";
import type {
  CandidateScore,
  DegreesOfFreedom,
  EventScore,
  LifeEvent,
  Precision,
  Reliability,
  StabilityCheck,
  Verdict,
} from "./types";

/**
 * Scoring and the statistics that keep it honest.
 *
 * With 31 candidate minutes and at most 10 events, a good-looking fit is
 * routinely noise. Everything in this file exists to make that visible rather
 * than to hide it: the winner is reported against the distribution of all 31
 * candidates, a leave-one-event-out pass says whether the answer hangs on a
 * single event, and a margin below threshold produces the verdict
 * "indeterminate at this resolution" instead of a fabricated minute.
 */

// --- Tunable weights and thresholds ----------------------------------------

/** Component weights inside one event's score. */
export const COMPONENT_WEIGHTS = { dasha: 0.45, transit: 0.3, varga: 0.25 };

/**
 * Confidence multiplier by date precision. A year-precision event carries half
 * the weight of a timestamped one, and is scored by integrating over the year
 * rather than by pretending it happened on 1 January.
 */
export const PRECISION_CONFIDENCE: Record<Precision, number> = {
  exact: 1.0,
  month: 0.8,
  year: 0.5,
};

/** Confidence multiplier by how well the native trusts the report. */
export const RELIABILITY_WEIGHT: Record<Reliability, number> = {
  certain: 1.0,
  probable: 0.75,
  hearsay: 0.4,
};

/** An event counts as "hit" for display purposes above this score. */
export const HIT_THRESHOLD = 0.5;

/**
 * Thresholds calibrated against a NULL, not chosen by taste.
 *
 * The winner of a 31-candidate sweep is the maximum of 31 draws, so it stands
 * well above the median *by construction* — a naive "z > 1" test would call
 * almost every random result significant. Measuring it: 48 sweeps of this
 * engine driven by seven randomly generated events each (both ayanamshas,
 * canonical Mumbai chart) produced
 *
 *     z      median 1.86   p75 2.26   p90 2.60   p95 2.66   max 3.26
 *     margin median 0.0071 p75 0.0125 p90 0.0171 p95 0.0184 max 0.0279
 *
 * A result must clear BOTH to be called determinate. Sweeping 80 null sweeps
 * against candidate pairs, the joint false-positive rate is
 *
 *     z>=2.0 & m>=0.020 → 6.3%     z>=2.4 & m>=0.015 → 10.0%
 *     z>=2.4 & m>=0.020 → 5.0%     z>=2.6 & m>=0.020 →  2.5%
 *
 * so (2.4, 0.020) is an honest α = 0.05 test, and it is the pair used below.
 * A planted positive control — events generated FROM a known +7-minute chart —
 * recovers that minute at z 2.54 / margin 0.0238 and passes.
 *
 * This is deliberately hard to clear: with ≤10 events over a window in which
 * the Lagna sign never changes, most charts genuinely do not resolve to a
 * minute, and saying so is the correct output rather than a failure. The
 * harness re-runs both the null and the positive control.
 */
export const MIN_MARGIN = 0.02;
export const MIN_Z = 2.4;
/** Candidates within this of the best are reported as a tied interval. */
export const INTERVAL_TOLERANCE = 0.01;

/** Minimum events to run at all; below the comfort threshold we warn. */
export const MIN_EVENTS = 5;
export const COMFORTABLE_EVENTS = 7;

// --- Precision-interval sampling -------------------------------------------

const NOON_MS = 12 * 3600000;

/**
 * The instants a single event is evaluated at. An "exact" date is one sample at
 * 12:00 UTC (the event's own clock time is not known and, at this resolution,
 * does not matter); a "month" date integrates over four days spread through the
 * month; a "year" date integrates over the middle of each of its twelve months.
 */
export function eventSampleInstants(event: LifeEvent): Date[] {
  const [y, m, d] = event.dateISO.split("-").map(Number);
  if (event.precision === "exact") {
    return [new Date(Date.UTC(y, (m || 1) - 1, d || 1) + NOON_MS)];
  }
  if (event.precision === "month") {
    const month = (m || 1) - 1;
    const lastDay = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    return [4, 11, 18, 25]
      .filter((day) => day <= lastDay)
      .map((day) => new Date(Date.UTC(y, month, day) + NOON_MS));
  }
  return Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(y, i, 15) + NOON_MS));
}

export function eventWeight(event: LifeEvent): number {
  return PRECISION_CONFIDENCE[event.precision] * RELIABILITY_WEIGHT[event.reliability];
}

// --- One event against one candidate ---------------------------------------

/**
 * Score one event for one candidate chart. `snapshots` must be aligned with
 * `eventSampleInstants(event)`; the orchestrator computes them once per
 * (ayanamsha, instant) because transits do not depend on the birth minute.
 */
export function scoreEvent(
  chart: ChartData,
  tree: DashaPeriod[] | null,
  vargas: VargaSet,
  event: LifeEvent,
  gender: Gender | undefined,
  snapshots: TransitSnapshot[]
): EventScore {
  const instants = eventSampleInstants(event);
  const mid = Math.floor(instants.length / 2);

  // The middle sample is the representative one: its components carry the
  // reason strings shown in the UI, while the score integrates over all of them.
  let total = 0;
  const repDasha = dashaFitness(chart, tree, event.type, gender, instants[mid]);
  const repTransit = transitFitness(chart, snapshots[mid], event.type, gender);
  const repVarga = vargaFitness(chart, vargas, event.type, gender, lordsOf(repDasha.active));

  for (let i = 0; i < instants.length; i++) {
    const d = i === mid ? repDasha : dashaFitness(chart, tree, event.type, gender, instants[i]);
    const t = i === mid ? repTransit : transitFitness(chart, snapshots[i], event.type, gender);
    const v =
      i === mid
        ? repVarga
        : vargaFitness(chart, vargas, event.type, gender, lordsOf(d.active));
    total +=
      COMPONENT_WEIGHTS.dasha * d.score +
      COMPONENT_WEIGHTS.transit * t.score +
      COMPONENT_WEIGHTS.varga * v.score;
  }
  const score = total / instants.length;

  return {
    eventId: event.id,
    type: event.type,
    score,
    dasha: { score: repDasha.score, reasons: repDasha.reasons },
    transit: { score: repTransit.score, reasons: repTransit.reasons },
    varga: { score: repVarga.score, reasons: repVarga.reasons },
    weight: eventWeight(event),
    samples: instants.length,
    hit: score >= HIT_THRESHOLD,
    summary: summarise(event, repDasha.active, repTransit, repVarga.d60Score, score),
    lords: repDasha.active
      ? {
          maha: repDasha.active.maha.lord,
          antar: repDasha.active.antar.lord,
          pratyantar: repDasha.active.pratyantar.lord,
        }
      : null,
    daysToPratyantarBoundary: repDasha.daysToPratyantarBoundary,
  };
}

function lordsOf(active: ReturnType<typeof dashaFitness>["active"]): PlanetId[] {
  if (!active) return [];
  return [...new Set([active.maha.lord, active.antar.lord, active.pratyantar.lord])];
}

/** The one-line classical reason string the UI shows next to every score. */
function summarise(
  event: LifeEvent,
  active: ReturnType<typeof dashaFitness>["active"],
  transit: ReturnType<typeof transitFitness>,
  d60Score: number | null,
  score: number
): string {
  const parts: string[] = [];
  if (active) {
    parts.push(`${active.maha.lord} MD, ${active.antar.lord} AD, ${active.pratyantar.lord} PD`);
  }
  if (transit.doubleTransit) parts.push("Guru–Shani double transit active");
  if (transit.sadeSati) parts.push(`Sade Sati ${transit.sadeSati}`);
  if (transit.kantaka) parts.push("Kantaka/Ashtama Shani");
  if (transit.vedhaCancellations.length) {
    parts.push(
      `vedha cancels ${transit.vedhaCancellations.map((v) => `${v.graha} (by ${v.blockedBy})`).join(", ")}`
    );
  }
  if (d60Score !== null) parts.push(`D-60 fit ${(d60Score * 100).toFixed(0)}%`);
  const verdict = score >= HIT_THRESHOLD ? "supports" : score >= 0.3 ? "partly supports" : "does not support";
  return `${parts.join("; ")} — ${verdict} ${EVENT_RULES[event.type].label.toLowerCase()}.`;
}

// --- Aggregation ------------------------------------------------------------

/**
 * Weighted MEAN of the per-event scores, never a sum: a chart must not score
 * higher simply because more events were supplied.
 */
export function aggregate(events: EventScore[]): number {
  let num = 0;
  let den = 0;
  for (const e of events) {
    num += e.weight * e.score;
    den += e.weight;
  }
  return den > 0 ? num / den : 0;
}

/** The same aggregation with one event withheld — the leave-one-out pass. */
export function aggregateWithout(events: EventScore[], eventId: string): number {
  return aggregate(events.filter((e) => e.eventId !== eventId));
}

// --- Distribution statistics ------------------------------------------------

export interface Distribution {
  median: number;
  mean: number;
  stdDev: number;
  zScore: number;
  margin: number;
}

/**
 * `interval` is the contiguous run of minutes statistically tied with the best.
 * The margin is measured against the best candidate OUTSIDE that run: adjacent
 * tied minutes are one peak, not two competing hypotheses, and scoring them
 * against each other would report a margin of zero for a perfectly clean result.
 */
export function distribution(
  candidates: CandidateScore[],
  best: CandidateScore,
  interval: { startOffsetMin: number; endOffsetMin: number }
): Distribution {
  const scores = candidates.map((c) => c.score);
  const sorted = [...scores].sort((a, b) => a - b);
  const median =
    sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const outside = candidates
    .filter((c) => c.offsetMin < interval.startOffsetMin || c.offsetMin > interval.endOffsetMin)
    .map((c) => c.score);
  // With no candidate outside the tied run, the whole window is one flat peak
  // and there is no rival to measure against.
  const rival = outside.length ? Math.max(...outside) : best.score;
  return {
    median,
    mean,
    stdDev,
    zScore: stdDev > 1e-9 ? (best.score - median) / stdDev : 0,
    margin: best.score - rival,
  };
}

export function verdictFor(dist: Distribution): { verdict: Verdict; reason: string } {
  if (dist.stdDev <= 1e-9) {
    return {
      verdict: "indeterminate",
      reason:
        "Every candidate minute scores identically — nothing in these events distinguishes one minute from another at this resolution.",
    };
  }
  if (dist.margin < MIN_MARGIN && dist.zScore < MIN_Z) {
    return {
      verdict: "indeterminate",
      reason: `The winning window leads the next-best minute by only ${(dist.margin * 100).toFixed(2)} points and sits ${dist.zScore.toFixed(2)}σ above the median candidate. That is inside the noise; no minute in this window is supported over any other.`,
    };
  }
  if (dist.margin < MIN_MARGIN) {
    return {
      verdict: "indeterminate",
      reason: `The winning window stands ${dist.zScore.toFixed(2)}σ above the median, but leads the next-best minute by only ${(dist.margin * 100).toFixed(2)} points — there is a peak, but it is not separated from its neighbours.`,
    };
  }
  if (dist.zScore < MIN_Z) {
    return {
      verdict: "indeterminate",
      reason: `The winning window leads the next-best minute clearly but sits only ${dist.zScore.toFixed(2)}σ above the median candidate — the whole window scores alike, so the lead is not meaningful.`,
    };
  }
  return {
    verdict: "determinate",
    reason: `The winning window leads the next-best minute outside it by ${(dist.margin * 100).toFixed(2)} points and stands ${dist.zScore.toFixed(2)}σ above the median candidate.`,
  };
}

// --- Tied interval ----------------------------------------------------------

/**
 * The contiguous run of candidates statistically tied with the best. This is
 * what gets reported as the answer — a rectified interval, with the point
 * estimate named inside it. Reporting a bare minute would be false precision.
 */
export function tiedInterval(
  candidates: CandidateScore[],
  best: CandidateScore
): { startOffsetMin: number; endOffsetMin: number } {
  const ordered = [...candidates].sort((a, b) => a.offsetMin - b.offsetMin);
  const bestIdx = ordered.findIndex((c) => c.offsetMin === best.offsetMin);
  const floor = best.score - INTERVAL_TOLERANCE;
  let lo = bestIdx;
  let hi = bestIdx;
  while (lo > 0 && ordered[lo - 1].score >= floor) lo--;
  while (hi < ordered.length - 1 && ordered[hi + 1].score >= floor) hi++;
  return { startOffsetMin: ordered[lo].offsetMin, endOffsetMin: ordered[hi].offsetMin };
}

// --- Leave-one-out stability ------------------------------------------------

/**
 * Drop each event in turn and re-pick the winner. If any single event changes
 * the winning minute, the result is unstable and the event it hinges on is
 * named — a rectification that rests on one recollection is worth knowing about.
 */
export function leaveOneOut(candidates: CandidateScore[], best: CandidateScore): StabilityCheck {
  const hinges: StabilityCheck["hinges"] = [];
  const ids = candidates[0]?.events.map((e) => e.eventId) ?? [];
  for (const id of ids) {
    let winner = candidates[0];
    let winnerScore = -Infinity;
    for (const c of candidates) {
      const s = aggregateWithout(c.events, id);
      if (s > winnerScore) {
        winnerScore = s;
        winner = c;
      }
    }
    if (winner.offsetMin !== best.offsetMin) {
      const ev = best.events.find((e) => e.eventId === id)!;
      hinges.push({ eventId: id, type: ev.type, movesToOffsetMin: winner.offsetMin });
    }
  }
  return { stable: hinges.length === 0, hinges };
}

// --- Degrees of freedom -----------------------------------------------------

export function degreesOfFreedom(events: LifeEvent[], candidateCount: number): DegreesOfFreedom {
  return {
    events: events.length,
    effectiveEvents: events.reduce((a, e) => a + eventWeight(e), 0),
    candidates: candidateCount,
    // One free parameter is being fitted: the birth minute.
    freeParameters: 1,
  };
}
