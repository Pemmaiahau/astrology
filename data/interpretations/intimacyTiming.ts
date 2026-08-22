import { ageYearsAt, dateAtAge } from "@/utils/astrology/ageBands";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import {
  buildTimingContext,
  findEventWindows,
  natalPromise,
  type EventTimingSpec,
  type EventWindow,
  type TimingContext,
} from "@/utils/astrology/eventTiming";
import { ordinal } from "@/utils/astrology/format";
import { gocharaAt, SATURN_STANCE_TEXT, saturnStanceAt } from "@/utils/astrology/gochara";
import type { EventRule } from "@/utils/astrology/rectification/eventRules";
import { retrogradeIntervals } from "@/utils/astrology/scan";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId } from "@/utils/astrology/types";
import type { TimingWindow } from "./report";

/**
 * Intimacy, dated: Vimshottari windows and gochara for the desire houses.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT WHAT WAS REFUSED. The disagreement log
 * records a decision not to age-band this section: a demographic "peak years
 * for desire" band would describe when a person is *allowed to want* something,
 * and the evidence for it is a stereotype rather than a demographic fact. That
 * reasoning rules out an age prior. It does not rule out dasha periods and
 * transits, which are derived from the chart rather than from a population —
 * and without them the section produced nothing datable, so nothing in it could
 * be checked against a life. This module supplies the dates and leaves
 * `agePriorAt` deliberately undefined; `AGE_BANDS` is untouched.
 *
 * THE ONE AGE CONSTRAINT, and what it is not. The scan starts at 18. That is
 * the section's standing adults-only boundary applied to its own output, not a
 * band: there is no peak, no taper and no weighting — windows before 18 are
 * simply not produced, and every window from 18 onward is scored purely on the
 * chart.
 *
 * Everything here reuses the Life Events engine (`utils/astrology/
 * eventTiming.ts`) and the gochara module rather than restating either: the
 * same `planetSignification`, the same Guru-Shani double transit, the same
 * Moon-frame Gochara Phala with its vedha cancellations.
 *
 * The boundaries `intimacy.ts` states apply here without exception: nothing
 * infers orientation or gender identity, no partner gender is assumed, nothing
 * references what revealed the tab, and no window is phrased as a certainty.
 */

const YEAR_MS = 365.2425 * 86400000;

/**
 * Two themes, because they genuinely separate and a chart can be warm in one
 * and cool in the other — which is the mismatch worth being able to date.
 */
export type IntimacyThemeKey = "desire" | "closeness";

const DESIRE_RULE: EventRule = {
  // `EventRule.type` is a closed union owned by the rectification layer; the
  // nearest member is named so `planetSignification` can be reused unchanged.
  // Nothing reads the field except diagnostics.
  type: "marriage",
  label: "Desire and physical intensity",
  // The 12th is shayana sukha — the classical house of the pleasures of the
  // bed — read with the 8th for intensity and what stays private.
  primaryHouses: [{ house: 12 }, { house: 8 }],
  supportingHouses: [{ house: 5 }, { house: 3 }, { house: 7 }],
  // The 6th is friction, illness and daily grind: the classical opposite of
  // ease. The 10th is duty and the public role, which crowds out the private.
  negatingHouses: [{ house: 6 }, { house: 10 }],
  karakas: ["Ve", "Ma"],
  vargas: ["D16", "D9", "D30"],
  transit: {
    jupiterContacts: ["Ve", "Ma"],
    sadeSati: "contrary",
    kantaka: "neutral",
    nodeContact: false,
  },
  doctrine:
    "The 12th is shayana sukha, the classical house of the pleasures of the bed, and the 8th is " +
    "sexual energy and what stays private; the 5th supplies romance and the 3rd raw appetite. " +
    "Venus is kama karaka and Mars the karaka of physical drive. The 6th of friction and the 10th " +
    "of public duty argue the other way.",
};

const CLOSENESS_RULE: EventRule = {
  type: "marriage",
  label: "Closeness and partnered warmth",
  primaryHouses: [{ house: 7 }, { house: 5 }],
  supportingHouses: [{ house: 2 }, { house: 11 }, { house: 12 }],
  // The 6th and the 12th-from-the-7th (the 6th of the chart, again) are the
  // classical discord houses for a union; the 8th here reads as concealment
  // rather than intensity.
  negatingHouses: [{ house: 6 }, { house: 12, from: 7 }],
  karakas: ["Ve", "Mo"],
  vargas: ["D9", "D16"],
  transit: {
    jupiterContacts: ["Ve", "Mo"],
    sadeSati: "contrary",
    kantaka: "neutral",
    nodeContact: false,
  },
  doctrine:
    "The 7th is the sanctioned union and the 5th romance and magnetism, with the 2nd of the " +
    "household and the 11th of fulfilled desire supporting. Venus is kama karaka and the Moon " +
    "carries the emotional receptivity that lets closeness land.",
};

interface ThemeDef {
  key: IntimacyThemeKey;
  label: string;
  blurb: string;
  rule: EventRule;
}

const THEMES: ThemeDef[] = [
  {
    key: "desire",
    label: "Desire and physical intensity",
    blurb: "the stretches where appetite runs highest and pleasure comes most easily",
    rule: DESIRE_RULE,
  },
  {
    key: "closeness",
    label: "Closeness and partnered warmth",
    blurb: "the stretches most favourable to partnered life landing emotionally rather than only physically",
    rule: CLOSENESS_RULE,
  },
];

export interface GocharaLine {
  text: string;
  polarity: "supportive" | "pressuring" | "neutral";
}

export interface RetroStretch {
  id: PlanetId;
  start: Date;
  end: Date;
  text: string;
}

export interface IntimacyTheme {
  key: IntimacyThemeKey;
  label: string;
  blurb: string;
  /** 0-100 natal promise for this theme — what the periods have to work with. */
  promise: number;
  windows: TimingWindow[];
  doctrine: string;
}

export interface IntimacyTiming {
  hasDasha: boolean;
  /** Where the sky stands today against this chart, judged from the Moon. */
  currentGochara: GocharaLine[];
  saturnStance: string | null;
  /** Venus and Mars retrograde stretches ahead — the classical revisiting periods. */
  retrograde: RetroStretch[];
  themes: IntimacyTheme[];
  caveats: string[];
}

const EMPTY: IntimacyTiming = {
  hasDasha: false,
  currentGochara: [],
  saturnStance: null,
  retrograde: [],
  themes: [],
  caveats: [],
};

/** The engine's window in the display shape the Interpretation tab already uses. */
function toTimingWindow(w: EventWindow, birthUtc: Date, group: string): TimingWindow {
  const subWindows: TimingWindow[] = [];
  if (w.peak) {
    subWindows.push({
      label: w.peak.label,
      start: w.peak.start,
      end: w.peak.end,
      grade: "strong",
      confidence: Math.min(w.confidence + 5, 90),
      reasons: [
        "The tightest stretch inside this window — the sub-sub-period whose lord signifies the same houses as the period around it",
      ],
      ageRange: { from: ageYearsAt(birthUtc, w.peak.start), to: ageYearsAt(birthUtc, w.peak.end) },
      phase: w.phase,
    });
  }
  for (const c of w.contacts.slice(0, 2)) {
    subWindows.push({
      label: `${PLANET_NAMES[c.id]} transits ${SIGNS[c.sign]} — over ${c.note || `the ${ordinal(c.houseFromLagna)} from your Lagna`}`,
      start: c.start,
      end: c.end,
      grade: "moderate",
      confidence: w.confidence,
      reasons: [
        "A slow graha standing on the houses, lords or karakas of this theme is the classical trigger inside a period",
      ],
      ageRange: { from: ageYearsAt(birthUtc, c.start), to: ageYearsAt(birthUtc, c.end) },
      phase: w.phase,
    });
  }

  return {
    label: `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`,
    start: w.start,
    end: w.end,
    grade: w.score >= 68 ? "strong" : w.score >= 50 ? "moderate" : "weak",
    confidence: w.confidence,
    reasons: w.reasons.slice(0, 3).map((r) => r.text),
    ageRange: { from: ageYearsAt(birthUtc, w.start), to: ageYearsAt(birthUtc, w.end) },
    phase: w.phase,
    group,
    subWindows: subWindows.sort((a, b) => a.start.getTime() - b.start.getTime()),
  };
}

function specFor(theme: ThemeDef, ctx: TimingContext): EventTimingSpec {
  const rule = theme.rule;
  return {
    primaryHouses: rule.primaryHouses.map((h) => resolve(h.house, h.from)),
    supportingHouses: rule.supportingHouses.map((h) => resolve(h.house, h.from)),
    negatingHouses: rule.negatingHouses.map((h) => resolve(h.house, h.from)),
    karakas: [...rule.karakas, ...(ctx.gender === "female" ? rule.karakasFemale ?? [] : [])],
    rule,
    saturnStance: rule.transit.sadeSati,
    nodeContact: rule.transit.nodeContact,
    // Deliberately absent — see the module docstring. No age prior, no band.
    agePriorAt: undefined,
    maxWindows: 6,
    minScore: 52,
  };
}

/** Bhavat Bhavam resolution, matching `rectification/eventRules.ts`. */
function resolve(house: number, from?: number): number {
  const base = from ?? 1;
  return (((base - 1 + house - 1) % 12) + 12) % 12 + 1;
}

/**
 * The whole timing layer.
 *
 * Expensive by this codebase's standards — four slow-graha ingress scans plus
 * a signification pass per theme — so callers keep it behind an explicit
 * affordance, the same habit `SpeculationPanel` uses for its year engine.
 */
export function buildIntimacyTiming(opts: {
  chart: ChartData;
  dashaTree: DashaPeriod[] | null;
  ayanamsha: AyanamshaId;
  ashtakavarga: AshtakavargaResult | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  now: Date;
}): IntimacyTiming {
  const { chart, ayanamsha, now } = opts;

  // --- The transit reading works without a dasha tree ----------------------
  const currentGochara: GocharaLine[] = gocharaAt(
    chart,
    ayanamsha,
    now,
    ["Ju", "Sa", "Ra", "Ke", "Ve", "Ma"]
  ).map((g) => ({
    text: g.text,
    polarity: g.value > 0 ? "supportive" : g.value < 0 ? "pressuring" : "neutral",
  }));

  const stance = saturnStanceAt(chart, ayanamsha, now);
  const saturnStance = stance ? SATURN_STANCE_TEXT[stance] : null;

  // Venus and Mars retrograde stretches over the next eight years. BPHS scores
  // vakri motion as cheshta bala, so these are named as revisiting rather than
  // as adverse — the opposite of the market-astrology convention the
  // speculation section uses, and the contrast is stated in the text.
  const nodeMode = chart.meta.nodeMode ?? "mean";
  const horizonEnd = new Date(now.getTime() + 8 * YEAR_MS);
  const retrograde: RetroStretch[] = [];
  for (const id of ["Ve", "Ma"] as PlanetId[]) {
    for (const iv of retrogradeIntervals(id, ayanamsha, now, horizonEnd, 2, nodeMode)) {
      retrograde.push({
        id,
        start: iv.start,
        end: iv.end,
        text:
          id === "Ve"
            ? "Venus turns retrograde — classically a stretch for revisiting rather than beginning. Old attractions resurface, what you actually want becomes clearer in hindsight than in the moment, and decisions about a relationship made here tend to read differently afterwards."
            : "Mars turns retrograde — drive that stalls and restarts rather than proceeding. Initiative taken here usually needs a second attempt, and the classical reading is that the second one carries more force than the first would have.",
      });
    }
  }
  retrograde.sort((a, b) => a.start.getTime() - b.start.getTime());

  const ctx = buildTimingContext({
    chart,
    tree: opts.dashaTree,
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
      currentGochara,
      saturnStance,
      retrograde,
      caveats: [
        "The dated windows below are Vimshottari periods, and a dasha needs an exact birth moment. Supply a birth date, time and place — or a birth anchor in Manual Configuration — and they populate. The transit reading above does not need one and holds as it stands.",
      ],
    };
  }

  // The adults-only floor. Not a band: no peak, no taper, no weighting — the
  // scan simply does not start before 18, and everything from there on is
  // scored on the chart alone.
  const from = dateAtAge(ctx.birthUtc, 18);
  const scanFrom = from > ctx.from ? from : ctx.from;

  const themes: IntimacyTheme[] = [];
  for (const theme of THEMES) {
    const spec = specFor(theme, ctx);
    const promise = natalPromise(ctx, spec);
    const windows = findEventWindows({ ...ctx, from: scanFrom }, spec, promise);
    themes.push({
      key: theme.key,
      label: theme.label,
      blurb: theme.blurb,
      promise: promise.score,
      doctrine: theme.rule.doctrine,
      windows: windows.map((w) => toTimingWindow(w, ctx.birthUtc, theme.label)),
    });
  }

  const caveats: string[] = [
    "These windows carry no age assumption. Every other timed section in this app weights its windows by the ages at which an event commonly occurs; this one deliberately does not, because there is no demographic fact about when a person is supposed to want closeness — only a stereotype. The scan starts at 18 and is otherwise scored purely on your chart.",
  ];
  if (!opts.shadbala) {
    caveats.push(
      "Shadbala is unavailable for this chart, so the natal promise behind each theme falls back on the composite planetary score."
    );
  }
  if (!opts.ashtakavarga) {
    caveats.push(
      "Ashtakavarga is unavailable, so the transit-support weighting is absent from the window scores rather than estimated."
    );
  }

  return { hasDasha: true, currentGochara, saturnStance, retrograde, themes, caveats };
}
