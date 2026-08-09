import type { AyanamshaId, Gender, NodeMode, PlanetId } from "../types";
import type { VargaId } from "../varga";

/**
 * Birth Time Rectification (Janma Samaya Shodhana) — shared shapes.
 *
 * The module sweeps candidate birth minutes around a recorded time, scores
 * each candidate against dated life events using Parashari rules, and reports
 * a ranked list *independently* under Lahiri and Pushya ayanamsha.
 *
 * Nothing here computes; these are the contracts the fitness modules, the
 * scorer, the orchestrator, the API route and the UI all agree on.
 */

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventType =
  | "marriage"
  | "divorce"
  | "childbirth"
  | "careerStart"
  | "promotion"
  | "jobLoss"
  | "fatherDeath"
  | "motherDeath"
  | "illness"
  | "accident"
  | "foreignTravel"
  | "higherEducation"
  | "property"
  | "windfall"
  | "spiritual";

/**
 * How precisely the event date is known. A `month` date means "some day in
 * that month"; a `year` date means "some month in that year". The scorer
 * integrates over the stated interval rather than pretending a timestamp.
 */
export type Precision = "exact" | "month" | "year";

/** How much the native trusts the report of the event itself. */
export type Reliability = "certain" | "probable" | "hearsay";

export interface LifeEvent {
  id: string;
  type: EventType;
  /** YYYY-MM-DD. Day is meaningful only when precision is "exact"; day and
   *  month are meaningful only when precision is "exact" or "month". */
  dateISO: string;
  precision: Precision;
  reliability: Reliability;
  note?: string;
}

/** Recorded birth record the sweep is centred on. */
export interface RectifyBirth {
  name?: string;
  /** YYYY-MM-DD, civil local date at the birth place. */
  dateISO: string;
  /** HH:mm, civil local time as recorded. */
  time: string;
  /** IANA zone of the birth place. */
  timezone: string;
  lat: number;
  /** East-positive longitude. */
  lon: number;
  placeName?: string;
  gender?: Gender;
  nodeMode?: NodeMode;
}

// ---------------------------------------------------------------------------
// Reasons — structurally identical to data/interpretations/report.ts Evidence,
// so `WhyList` renders these directly without this layer importing the
// interpretation layer (utils must not depend on data/).
// ---------------------------------------------------------------------------

export interface RectifyCitation {
  work: string;
  ref?: string;
}

export interface RectifyReason {
  text: string;
  /** Signed contribution; positive supports the candidate. */
  weight: number;
  source?: RectifyCitation;
}

/** One scored technique (dasha / transit / varga) for one event instant. */
export interface FitnessComponent {
  /** 0–1. */
  score: number;
  reasons: RectifyReason[];
}

// ---------------------------------------------------------------------------
// Per-event and per-candidate scores
// ---------------------------------------------------------------------------

export interface EventScore {
  eventId: string;
  type: EventType;
  /** Combined 0–1 fitness, already integrated over the precision interval. */
  score: number;
  dasha: FitnessComponent;
  transit: FitnessComponent;
  varga: FitnessComponent;
  /** precision confidence × reliability weight. */
  weight: number;
  /** How many instants were sampled inside the precision interval. */
  samples: number;
  /** score >= HIT_THRESHOLD. */
  hit: boolean;
  /** One-line classical reason string for the UI. */
  summary: string;
  /** Maha/Antar/Pratyantar lords at the representative instant. */
  lords: { maha: PlanetId; antar: PlanetId; pratyantar: PlanetId } | null;
  /**
   * Days from the representative instant to the nearest Pratyantardasha
   * boundary. Small values mark an event whose dasha reading is genuinely
   * sensitive to the birth minute (the tree translates ~1–5 days per minute).
   */
  daysToPratyantarBoundary: number | null;
}

export interface CandidateScore {
  /** Minutes from the recorded time; 0 is the recorded time itself. */
  offsetMin: number;
  /** Civil local HH:mm of this candidate. */
  localTime: string;
  utcMs: number;
  /** Weighted mean of the event scores, 0–1. */
  score: number;
  events: EventScore[];
  /** Sidereal Lagna longitude. */
  ascendant: number;
  ascSign: number;
  /** Sidereal Lagna nakshatra and pada — a stability cross-check. */
  ascNakshatra: number;
  ascPada: number;
  /** Lagna sign in the high-resolution vargas. */
  d9LagnaSign: number;
  d60LagnaSign: number;
  /** Natal Moon nakshatra — decides the whole Vimshottari sequence. */
  moonNakshatra: number;
  /** Opening Mahadasha lord implied by that nakshatra. */
  openingLord: PlanetId;
  /** Minutes to the next Lagna sign change (sandhi) at this candidate. */
  minutesToLagnaSandhi: number;
  /** Planets whose Sripati bhava differs from their whole-sign house here. */
  bhavaShifted: PlanetId[];
}

// ---------------------------------------------------------------------------
// Result of one full sweep under one ayanamsha
// ---------------------------------------------------------------------------

export type Verdict = "determinate" | "indeterminate";

export interface StabilityCheck {
  /** True when dropping any single event leaves the winning minute unchanged. */
  stable: boolean;
  /** Events whose removal moves the winner, with where it moves to. */
  hinges: { eventId: string; type: EventType; movesToOffsetMin: number }[];
}

export interface DegreesOfFreedom {
  events: number;
  /** Sum of per-event weights — the effective sample size. */
  effectiveEvents: number;
  candidates: number;
  /** Free parameters being fitted: the birth minute. */
  freeParameters: number;
}

export interface CrossCheck {
  key: string;
  label: string;
  detail: string;
}

export interface RectificationResult {
  ayanamsha: AyanamshaId;
  /** All candidates, ordered by offsetMin ascending (the score curve). */
  candidates: CandidateScore[];
  best: CandidateScore;
  runnerUp: CandidateScore | null;
  /** Distribution statistics across every candidate — the anti-overfitting core. */
  stats: {
    median: number;
    mean: number;
    stdDev: number;
    /** (best − median) / stdDev; 0 when the distribution is flat. */
    zScore: number;
    /** best − runner-up, on the same 0–1 scale. */
    margin: number;
  };
  verdict: Verdict;
  /** Why the verdict came out as it did, in plain words. */
  verdictReason: string;
  /** Contiguous run of candidates statistically tied with the best. */
  interval: { startOffsetMin: number; endOffsetMin: number; startLocal: string; endLocal: string };
  stability: StabilityCheck;
  dof: DegreesOfFreedom;
  /** Best candidate sits on the window boundary — the optimum may lie outside. */
  edgeWarning: boolean;
  /** Recorded time is close to a Lagna sandhi: the window is high-leverage. */
  highLeverageWindow: boolean;
  crossChecks: CrossCheck[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Dual-ayanamsha reconciliation
// ---------------------------------------------------------------------------

export type ConfidenceTier = "High" | "Moderate" | "Low";

export interface Reconciliation {
  /** |t_lahiri − t_pushya| in minutes. */
  divergenceMin: number;
  tier: ConfidenceTier;
  /**
   * True when the natal Moon falls in a *different* nakshatra under the two
   * ayanamshas. The two systems then run entirely different Vimshottari
   * sequences and the two rectified times answer different questions.
   */
  nakshatraDivergence: boolean;
  lahiriOpening: { nakshatra: number; lord: PlanetId };
  pushyaOpening: { nakshatra: number; lord: PlanetId };
  /** Per-event: which ayanamsha fit it better, at each system's own best time. */
  eventSplit: {
    eventId: string;
    type: EventType;
    lahiriScore: number;
    pushyaScore: number;
    favours: AyanamshaId | "tie";
  }[];
  notes: string[];
}

export interface DualAyanamshaResult {
  birth: RectifyBirth;
  events: LifeEvent[];
  windowMin: number;
  stepMin: number;
  lahiri: RectificationResult;
  pushya: RectificationResult;
  reconciliation: Reconciliation;
  /** Timezone / DST / LMT problems found with the recorded birth record. */
  timeWarnings: string[];
  /** Milliseconds the whole sweep took. */
  elapsedMs: number;
}

// ---------------------------------------------------------------------------
// Technique classification (§2): which signals survive an ayanamsha change
// ---------------------------------------------------------------------------

export type AyanamshaSensitivity = "robust" | "sensitive";

/**
 * A technique is *robust* when it reads degrees or house-counts that shift by
 * the same 1.122° in both systems (transit angle to the natal Moon/Lagna,
 * dasha-boundary distance when the Moon's nakshatra is unchanged), and
 * *sensitive* when it reads a discrete sign/nakshatra label that 1.122° can
 * flip (varga lords, sign dignity, nakshatra lordship near a boundary).
 *
 * 1.122° is 2.244 shashtiamsas, so D-60 placements are NEVER comparable
 * across ayanamshas — agreement there is coincidence, not corroboration.
 */
export const TECHNIQUE_SENSITIVITY: Record<string, AyanamshaSensitivity> = {
  "dasha-lord-signification": "sensitive",
  "dasha-boundary-proximity": "robust",
  "transit-from-moon": "robust",
  "transit-double-transit": "robust",
  "transit-vedha": "robust",
  "varga-lagna-lord": "sensitive",
  "varga-d60": "sensitive",
  "sign-dignity": "sensitive",
  "bhava-cusp": "robust",
};

export const VARGA_SENSITIVITY_NOTE =
  "Pushya sidereal longitudes run 1.122° higher than Lahiri — 2.24 shashtiamsas. " +
  "D-60 agreement between the two systems is therefore never corroboration.";

/** Vargas whose lagna moves fast enough to discriminate inside ±15 minutes. */
export const HIGH_RESOLUTION_VARGAS: VargaId[] = ["D60", "D10", "D9", "D7"];
