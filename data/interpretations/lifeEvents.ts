import { ageAt, agePrior, ageYearsAt, dateAtAge } from "@/utils/astrology/ageBands";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import {
  buildTimingContext,
  findEventWindows,
  natalPromise,
  type EventTimingSpec,
  type EventWindow,
  type NatalPromise,
  type TimingContext,
} from "@/utils/astrology/eventTiming";
import { SATURN_STANCE_TEXT } from "@/utils/astrology/gochara";
import { ordinal } from "@/utils/astrology/format";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { resolveHouses } from "@/utils/astrology/rectification/eventRules";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId } from "@/utils/astrology/types";
import {
  CATEGORY_ORDER,
  LIFE_EVENTS,
  type LifeEventCategory,
  type LifeEventDef,
  type LifeEventKey,
} from "./lifeEventRules";
import { plain, verdictOf, type Evidence, type TimingWindow, type Verdict } from "./report";

/**
 * The Life Events timeline: every event in the catalogue, scanned across the
 * native's life, returned chronologically with the reasoning that produced it.
 *
 * This module is the seam between the timing engine (`utils/astrology/
 * eventTiming.ts`, which knows arithmetic and no prose) and the panel (which
 * knows layout and no astrology). It walks `LIFE_EVENTS`, turns each entry's
 * classical rule into an `EventTimingSpec`, runs the engine, and dresses the
 * windows in the display shapes the Interpretation tab already uses —
 * `TimingWindow`, `Evidence`, `Verdict` — so the timeline can render through
 * the existing `WhyList` / `ConfidenceBadge` / `TimingWindows` vocabulary
 * rather than inventing a second one.
 *
 * Pure function of (chart, tree, ayanamsha, precomputed strengths, now). One
 * shared `TimingContext` carries the four slow-graha ingress scans for all
 * twenty-five events, so the whole timeline costs roughly what a single event
 * would cost computed naively.
 */

export interface EventReasoning {
  /** One sentence naming the combination, for the collapsed row. */
  headline: string;
  dashaLabel: string;
  mahaClaims: string[];
  antarClaims: string[];
  /** The natal-promise limb: does the chart hold this event at all? */
  promiseScore: number;
  promiseVerdict: Verdict;
  promiseEvidence: Evidence[];
  /** Guru–Shani coverage as a percentage of the window. */
  doubleTransitPct: number;
  contactLines: string[];
  gocharaLines: string[];
  saturnLine: string | null;
  ageLine: string | null;
  /** Every weighted contribution to the score, strongest first. */
  weighted: Evidence[];
  /** The classical rule this window was read from. */
  doctrine: string;
  /** Houses actually consulted, for the audit line. */
  houses: { primary: number[]; supporting: number[]; negating: number[] };
  karakas: PlanetId[];
}

export interface LifeEventOccurrence {
  /** Stable identity for React keys and filter state. */
  id: string;
  key: LifeEventKey;
  category: LifeEventCategory;
  label: string;
  blurb: string;
  window: TimingWindow;
  score: number;
  reasoning: EventReasoning;
}

/** A Mahadasha spanning part of the life, with the events that fall inside it. */
export interface DashaGroup {
  lord: PlanetId;
  start: Date;
  end: Date;
  ageFrom: number;
  ageTo: number;
  phase: "past" | "current" | "future";
  eventIds: string[];
}

export interface EventPromiseSummary {
  key: LifeEventKey;
  label: string;
  category: LifeEventCategory;
  score: number;
  verdict: Verdict;
  /** Null when the chart raises no specific objection. */
  weakness: string | null;
  /** True when the scan produced no window above the event's floor. */
  silent: boolean;
}

export interface LifeEventTimeline {
  entries: LifeEventOccurrence[];
  groups: DashaGroup[];
  promises: EventPromiseSummary[];
  /** Categories that actually produced at least one entry. */
  categories: LifeEventCategory[];
  hasDasha: boolean;
  currentAge: number | null;
  span: { from: Date; to: Date } | null;
  caveats: string[];
}

const EMPTY: LifeEventTimeline = {
  entries: [],
  groups: [],
  promises: [],
  categories: [],
  hasDasha: false,
  currentAge: null,
  span: null,
  caveats: [],
};

const fmtMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

/**
 * Turn a catalogue entry into the engine's spec.
 *
 * `resolveHouses` collapses the Bhavat Bhavam references to plain house
 * numbers here rather than in the engine, so the engine never has to know that
 * "the 12th from the 10th" and "the 9th" are the same thing — and the
 * reasoning panel can still print the unresolved form from the rule.
 */
function specFor(
  def: LifeEventDef,
  ctx: TimingContext,
  jaimini: JaiminiInfo | null
): EventTimingSpec {
  const rule = def.rule;
  const karakas: PlanetId[] = [
    ...rule.karakas,
    ...(ctx.gender === "female" ? rule.karakasFemale ?? [] : []),
  ];

  // Jaimini padas as extra double-transit targets, where the tradition names
  // one for the theme: the Upapada for union, the Arudha Lagna for standing.
  const extraSigns: number[] = [];
  if (jaimini) {
    if (def.category === "relationships") extraSigns.push(jaimini.upapada);
    if (def.category === "career" || def.key === "wealthPeak") extraSigns.push(jaimini.arudhaLagna);
    if (def.category === "spiritual") extraSigns.push(jaimini.karakamsa);
  }

  return {
    primaryHouses: resolveHouses(rule.primaryHouses),
    supportingHouses: resolveHouses(rule.supportingHouses),
    negatingHouses: resolveHouses(rule.negatingHouses),
    karakas,
    rule,
    extraSigns,
    saturnStance: rule.transit.sadeSati,
    nodeContact: rule.transit.nodeContact,
    agePriorAt: def.band
      ? (t: number) => agePrior(def.band!, ageAt(ctx.birthUtc, new Date(t)))
      : undefined,
    maxWindows: def.maxWindows ?? 5,
    minScore: def.minScore,
  };
}

/** The scan range for one event: its age band, clipped to the context's span. */
function rangeFor(def: LifeEventDef, ctx: TimingContext): { from: Date; to: Date } {
  if (!def.band) return { from: ctx.from, to: ctx.to };
  const from = dateAtAge(ctx.birthUtc, def.band.start);
  const to = dateAtAge(ctx.birthUtc, def.band.end);
  return {
    from: from > ctx.from ? from : ctx.from,
    to: to < ctx.to ? to : ctx.to,
  };
}

function grade(score: number): TimingWindow["grade"] {
  return score >= 68 ? "strong" : score >= 50 ? "moderate" : "weak";
}

/**
 * The engine's `EventWindow` dressed as the display `TimingWindow`.
 *
 * `report.toTimingWindow` is deliberately not reused: it is typed against
 * `scan.ts`'s `ActivationWindow`, whose `doubleTransit` is a boolean where
 * this engine carries a coverage fraction. Widening that type to accept both
 * would make the older callers' `doubleTransit` field mean two things
 * depending on who produced it, which is worse than the ten lines below.
 */
function toWindow(def: LifeEventDef, w: EventWindow, birthUtc: Date): TimingWindow {
  const subWindows: TimingWindow[] = [];
  if (w.peak) {
    subWindows.push({
      label: w.peak.label,
      start: w.peak.start,
      end: w.peak.end,
      grade: "strong",
      confidence: Math.min(w.confidence + 5, 90),
      reasons: [
        "The tightest stretch inside this window — where the Pratyantardasha lord signifies the same houses as the period around it",
      ],
      ageRange: { from: ageYearsAt(birthUtc, w.peak.start), to: ageYearsAt(birthUtc, w.peak.end) },
      phase: w.peak.end <= w.start ? "past" : w.phase,
    });
  }
  for (const c of w.contacts.slice(0, 3)) {
    subWindows.push({
      label: `${PLANET_NAMES[c.id]} transits ${SIGNS[c.sign]} — over ${c.note || `the ${ordinal(c.houseFromLagna)} from your Lagna`}`,
      start: c.start,
      end: c.end,
      grade: "moderate",
      confidence: w.confidence,
      reasons: [
        "A slow graha standing on the houses, lords or karakas of this event is the classical trigger inside a period — the months where a window tends to actually deliver",
      ],
      ageRange: { from: ageYearsAt(birthUtc, c.start), to: ageYearsAt(birthUtc, c.end) },
      phase: w.phase,
    });
  }

  return {
    label: `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`,
    start: w.start,
    end: w.end,
    grade: grade(w.score),
    confidence: w.confidence,
    reasons: w.reasons.slice(0, 3).map((r) => r.text),
    ageRange: { from: ageYearsAt(birthUtc, w.start), to: ageYearsAt(birthUtc, w.end) },
    phase: w.phase,
    group: def.label,
    subWindows: subWindows.sort((a, b) => a.start.getTime() - b.start.getTime()),
  };
}

function buildReasoning(
  def: LifeEventDef,
  spec: EventTimingSpec,
  w: EventWindow,
  promise: NatalPromise
): EventReasoning {
  const maha = PLANET_NAMES[w.dasha.maha];
  const antar = PLANET_NAMES[w.dasha.antar];

  const trigger =
    w.doubleTransit > 0.25
      ? `with Jupiter and Saturn jointly on the ${spec.primaryHouses.map(ordinal).join(" and ")}`
      : w.contacts.length
        ? `with ${PLANET_NAMES[w.contacts[0].id]} transiting the ${ordinal(w.contacts[0].houseFromLagna)}`
        : "on the strength of the period alone";

  const headline = `${maha}–${antar} ${trigger}.`;

  const ageLine =
    w.agePrior === undefined
      ? null
      : w.agePrior >= 0.85
        ? "These are the years this event most commonly occurs in."
        : w.agePrior < 0.4
          ? "This sits at the edge of the usual age range, so the chart is carrying more of the claim than the age is."
          : "This falls inside the usual age range for the event.";

  return {
    headline,
    dashaLabel: `${maha} Mahadasha · ${antar} Antardasha`,
    mahaClaims: w.mahaClaims,
    antarClaims: w.antarClaims,
    promiseScore: promise.score,
    promiseVerdict: verdictOf(promise.score),
    promiseEvidence: promise.evidence.slice(0, 8).map((e) => ({ text: e.text, weight: e.weight })),
    doubleTransitPct: Math.round(w.doubleTransit * 100),
    contactLines: w.contacts.map(
      (c) =>
        `${fmtMonth(c.start)} → ${fmtMonth(c.end)}: ${PLANET_NAMES[c.id]} in ${SIGNS[c.sign]} — over ${c.note} (${ordinal(c.houseFromLagna)} from Lagna, ${ordinal(c.houseFromMoon)} from Moon)`
    ),
    gocharaLines: w.gocharaText,
    saturnLine: w.saturn ? SATURN_STANCE_TEXT[w.saturn] : null,
    ageLine,
    weighted: w.reasons.map((r) => ({ text: r.text, weight: r.weight })),
    doctrine: def.rule.doctrine,
    houses: {
      primary: spec.primaryHouses,
      supporting: spec.supportingHouses,
      negating: spec.negatingHouses,
    },
    karakas: spec.karakas,
  };
}

/**
 * The whole timeline.
 *
 * Expensive by the standards of this codebase — four ingress scans plus one
 * `planetSignification` pass per event — so callers should keep it behind a
 * lazy boundary (the panel computes it in a `useMemo` that only runs once the
 * tab is opened), exactly as the Sade Sati and rectification panels do.
 */
export function buildLifeEventTimeline(opts: {
  chart: ChartData;
  dashaTree: DashaPeriod[] | null;
  ayanamsha: AyanamshaId;
  ashtakavarga: AshtakavargaResult | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  jaimini: JaiminiInfo | null;
  now: Date;
}): LifeEventTimeline {
  const { chart, dashaTree, ayanamsha, now } = opts;

  const ctx = buildTimingContext({
    chart,
    tree: dashaTree,
    ayanamsha,
    av: opts.ashtakavarga,
    shadbala: opts.shadbala,
    bhavaBala: opts.bhavaBala,
    strengths: opts.strengths,
    now,
  });

  if (!ctx) {
    return {
      ...EMPTY,
      caveats: [
        "This timeline is built entirely from Vimshottari dasha periods, and a dasha needs an exact birth moment. Supply a birth date, time and place — or a birth anchor in Manual Configuration — and the whole timeline populates.",
      ],
    };
  }

  const caveats: string[] = [];
  if (!opts.shadbala) {
    caveats.push(
      `Shadbala could not be computed for this chart, so the natal-promise scores below fall back on the engine's composite planetary strength. That is a coarser measure — ${plain("Shadbala")} is what the classical rule actually asks for.`
    );
  }
  if (!opts.ashtakavarga) {
    caveats.push(
      `Ashtakavarga is unavailable for this chart, so ${plain("Sarvashtakavarga")} support is not counted in the natal promise.`
    );
  }
  if (chart.meta.bhavaMethod === "equal") {
    caveats.push(
      "This chart's quadrant geometry could not support a Sripati trisection, so an equal-house frame was used. Cusp-based readings — the nakshatra lords of the house cusps in particular — are correspondingly softer here."
    );
  }
  if (!chart.meta.gender) {
    caveats.push(
      "No gender was recorded, so the classical gender-specific karakas (Jupiter added for a woman's marriage reading) are omitted. Both readings are treated as the ungendered default."
    );
  }

  const entries: LifeEventOccurrence[] = [];
  const promises: EventPromiseSummary[] = [];

  for (const def of LIFE_EVENTS) {
    const spec = specFor(def, ctx, opts.jaimini);
    const promise = natalPromise(ctx, spec);
    const range = rangeFor(def, ctx);

    const windows =
      range.to > range.from
        ? findEventWindows({ ...ctx, from: range.from, to: range.to }, spec, promise)
        : [];

    for (const w of windows) {
      entries.push({
        id: `${def.key}:${w.start.getTime()}`,
        key: def.key,
        category: def.category,
        label: def.label,
        blurb: def.blurb,
        window: toWindow(def, w, ctx.birthUtc),
        score: w.score,
        reasoning: buildReasoning(def, spec, w, promise),
      });
    }

    promises.push({
      key: def.key,
      label: def.label,
      category: def.category,
      score: promise.score,
      verdict: verdictOf(promise.score),
      weakness: promise.weakness,
      silent: windows.length === 0,
    });
  }

  entries.sort((a, b) => a.window.start.getTime() - b.window.start.getTime());

  // --- Mahadasha grouping --------------------------------------------------
  const groups: DashaGroup[] = [];
  for (const md of ctx.tree) {
    if (md.end <= ctx.from || md.start >= ctx.to) continue;
    const start = md.start > ctx.from ? md.start : ctx.from;
    const end = md.end < ctx.to ? md.end : ctx.to;
    const eventIds = entries
      .filter((e) => e.window.start < end && e.window.end > start)
      .map((e) => e.id);
    groups.push({
      lord: md.lord,
      start,
      end,
      ageFrom: ageYearsAt(ctx.birthUtc, start),
      ageTo: ageYearsAt(ctx.birthUtc, end),
      phase:
        start.getTime() > now.getTime()
          ? "future"
          : end.getTime() <= now.getTime()
            ? "past"
            : "current",
      eventIds,
    });
  }

  const categories = CATEGORY_ORDER.filter((c) => entries.some((e) => e.category === c));

  const silent = promises.filter((p) => p.silent);
  if (silent.length) {
    caveats.push(
      `No window cleared the reporting threshold for: ${silent.map((p) => p.label).join(", ")}. That is a statement about this chart, not a gap in the scan — the natal-promise panel still shows what the chart holds for each of them.`
    );
  }

  return {
    entries,
    groups,
    promises: promises.sort((a, b) => b.score - a.score),
    categories,
    hasDasha: true,
    currentAge: ageAt(ctx.birthUtc, now),
    span: { from: ctx.from, to: ctx.to },
    caveats,
  };
}
