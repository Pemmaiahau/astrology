import { aspectedSigns } from "../aspects";
import { DASHA_YEARS, SIGN_LORDS } from "../constants";
import { activeDashaAt, type ActiveDasha } from "../dasha";
import { houseFromSign } from "../math";
import type { ChartData, DashaPeriod, Gender, PlanetId } from "../types";
import { EVENT_RULES, NAISARGIKA_ROLE, resolveHouses, type EventRule } from "./eventRules";
import type { EventType, FitnessComponent, RectifyReason } from "./types";

/**
 * Dasha-lord fitness for a life event.
 *
 * BPHS ch. 46–52 (Dasha phala), Phaladeepika ch. 19–20, Jataka Parijata:
 * a dasha lord delivers the results of
 *   1. the bhavas it OWNS,
 *   2. the bhava it OCCUPIES,
 *   3. the bhavas it ASPECTS by graha drishti,
 *   4. the bhava owned/occupied by its NAKSHATRA DISPOSITOR (the Nadi
 *      refinement — weighted below the direct rules, not equal to them),
 *   5. its NAISARGIKA KARAKA role,
 *   6. and — for Rahu and Ketu, which own nothing — the results of their
 *      DISPOSITOR and of any planet CONJOINING them (BPHS).
 *
 * An event fires when the Maha, Antar and Pratyantar lords JOINTLY signify the
 * bhava: the Mahadasha lord grants permission, the Antardasha lord is the
 * trigger, the Pratyantardasha lord fine-times it — which is why the Antar
 * carries the heaviest weight of the three.
 */

// --- Tunable weights (engineering choices, not shastra) --------------------

/** Joint-signification weights: permission / trigger / fine-timing. */
export const DASHA_LEVEL_WEIGHTS = { maha: 0.3, antar: 0.45, pratyantar: 0.25 };

/** How each mode of signification contributes, before house-class scaling. */
export const SIGNIFICATION_WEIGHTS = {
  owns: 1.0,
  /** Occupancy by whole-sign house only, or by Sripati bhava only. */
  occupiesPartial: 0.7,
  /** Occupancy confirmed by BOTH the whole-sign house and the Sripati bhava. */
  occupiesBoth: 1.0,
  aspects: 0.6,
  /** Nakshatra dispositor's own signification, per §3a's ~0.6 factor. */
  nakshatraDispositor: 0.6,
  karaka: 0.5,
  /** Rahu/Ketu acting for their dispositor and co-tenants. */
  nodeDelegation: 0.8,
};

/** House-class scaling applied to every mode above. */
const HOUSE_CLASS = { primary: 1.0, supporting: 0.5, negating: -0.8 };

/** Saturation constant: raw signification 1.2 maps to ~0.63 fitness. */
const SATURATION = 1.2;

/** How much a negating-house signification eats into a positive one. */
const NEGATION_WEIGHT = 0.6;

/** Bonus when the event sits in the opening stretch of a signifying period. */
const ONSET_BONUS = { antar: 0.08, pratyantar: 0.07 };
const ONSET_FRACTION = { antar: 0.2, pratyantar: 0.25 };

const DAY_MS = 86400000;
const YEAR_MS = 365.25 * DAY_MS;

// ---------------------------------------------------------------------------

export interface Signification {
  /** 0–1 after saturation and negation. */
  score: number;
  /** Raw positive weight before saturation, for diagnostics. */
  positive: number;
  /** Raw negating weight before saturation. */
  negative: number;
  /** Short phrases: "5L", "occupies the 7th", "aspects the 10th". */
  claims: string[];
}

interface HouseSets {
  primary: number[];
  supporting: number[];
  negating: number[];
}

function houseSets(rule: EventRule): HouseSets {
  return {
    primary: resolveHouses(rule.primaryHouses),
    supporting: resolveHouses(rule.supportingHouses),
    negating: resolveHouses(rule.negatingHouses),
  };
}

function classOf(house: number, sets: HouseSets): keyof typeof HOUSE_CLASS | null {
  if (sets.primary.includes(house)) return "primary";
  if (sets.supporting.includes(house)) return "supporting";
  if (sets.negating.includes(house)) return "negating";
  return null;
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Houses a planet rules for this Lagna (local copy — yogas.ts owns the canonical one). */
function ownedHousesOf(id: PlanetId, lagnaSign: number): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) if (SIGN_LORDS[(lagnaSign + h - 1) % 12] === id) out.push(h);
  return out;
}

/**
 * How strongly one planet signifies an event's bhava set. Direct rules first,
 * then the nakshatra-dispositor refinement, then the nodal delegation.
 */
export function planetSignification(
  chart: ChartData,
  id: PlanetId,
  rule: EventRule,
  gender: Gender | undefined,
  depth = 0
): Signification {
  const sets = houseSets(rule);
  const lagnaSign = chart.ascendant.sign;
  const planet = chart.planets.find((p) => p.id === id);
  const claims: string[] = [];
  let positive = 0;
  let negative = 0;

  const add = (weight: number, cls: keyof typeof HOUSE_CLASS, claim: string) => {
    const v = weight * HOUSE_CLASS[cls];
    if (v >= 0) positive += v;
    else negative += -v;
    claims.push(claim);
  };

  // 1. Ownership.
  for (const h of ownedHousesOf(id, lagnaSign)) {
    const cls = classOf(h, sets);
    if (cls) add(SIGNIFICATION_WEIGHTS.owns, cls, `${h}L`);
  }

  if (planet) {
    // 2. Occupancy — whole-sign house AND Sripati bhava. Inside a ±15-minute
    // window the whole-sign house is effectively frozen while the bhava moves
    // with the cusps, so confirmation by both is what discriminates here.
    const byHouse = classOf(planet.house, sets);
    const byBhava = classOf(planet.bhava, sets);
    if (byHouse && byBhava && planet.house === planet.bhava) {
      add(SIGNIFICATION_WEIGHTS.occupiesBoth, byHouse, `occupies the ${ord(planet.house)}`);
    } else {
      if (byHouse)
        add(SIGNIFICATION_WEIGHTS.occupiesPartial, byHouse, `sits in the ${ord(planet.house)} by sign`);
      if (byBhava)
        add(SIGNIFICATION_WEIGHTS.occupiesPartial, byBhava, `falls in bhava ${planet.bhava} by cusp`);
    }

    // 3. Graha drishti onto the bhava (whole-sign, per aspects.ts).
    const aspected = aspectedSigns(id, planet.sign).map((s) => houseFromSign(s, lagnaSign));
    for (const h of new Set(aspected)) {
      if (h === planet.house) continue; // occupancy is not an aspect
      const cls = classOf(h, sets);
      if (cls) add(SIGNIFICATION_WEIGHTS.aspects, cls, `aspects the ${ord(h)}`);
    }

    // 4. Nakshatra dispositor — the Nadi refinement, at 0.6 of a direct rule.
    if (depth < 2 && planet.nakshatraLord !== id) {
      const disp = planetSignification(chart, planet.nakshatraLord, rule, gender, depth + 2);
      if (disp.positive > 0 || disp.negative > 0) {
        const scaled = SIGNIFICATION_WEIGHTS.nakshatraDispositor;
        positive += scaled * disp.positive;
        negative += scaled * disp.negative;
        claims.push(`its star-lord ${planet.nakshatraLord} ${disp.claims.slice(0, 2).join(", ")}`);
      }
    }

    // 6. Rahu/Ketu own no sign: they act for their dispositor and for any
    // planet sharing their sign (BPHS). Delegation is scored once, at 0.8.
    if ((id === "Ra" || id === "Ke") && depth < 2) {
      const dispositor = SIGN_LORDS[planet.sign];
      const agents: PlanetId[] = [dispositor];
      for (const q of chart.planets) {
        if (q.id !== id && q.sign === planet.sign && !agents.includes(q.id)) agents.push(q.id);
      }
      let bestPos = 0;
      let bestNeg = 0;
      let bestAgent: PlanetId | null = null;
      for (const a of agents) {
        if (a === "Ra" || a === "Ke") continue;
        const s = planetSignification(chart, a, rule, gender, depth + 2);
        if (s.positive - s.negative > bestPos - bestNeg) {
          bestPos = s.positive;
          bestNeg = s.negative;
          bestAgent = a;
        }
      }
      if (bestAgent && (bestPos > 0 || bestNeg > 0)) {
        const w = SIGNIFICATION_WEIGHTS.nodeDelegation;
        positive += w * bestPos;
        negative += w * bestNeg;
        claims.push(`acts for ${bestAgent === dispositor ? `its dispositor ${bestAgent}` : `${bestAgent}, which it joins`}`);
      }
    }
  }

  // 5. Naisargika karaka role.
  const karakas = [...rule.karakas, ...(gender === "female" ? rule.karakasFemale ?? [] : [])];
  if (karakas.includes(id)) {
    positive += SIGNIFICATION_WEIGHTS.karaka;
    claims.push(`karaka of ${NAISARGIKA_ROLE[id]}`);
  }

  const pos = 1 - Math.exp(-positive / SATURATION);
  const neg = 1 - Math.exp(-negative / SATURATION);
  const score = Math.max(0, Math.min(1, pos - NEGATION_WEIGHT * neg));
  return { score, positive, negative, claims };
}

// ---------------------------------------------------------------------------

export interface DashaFitness extends FitnessComponent {
  active: ActiveDasha | null;
  /** Days from the instant to the nearest Pratyantardasha boundary. */
  daysToPratyantarBoundary: number | null;
  /** Days from the instant to the nearest Antardasha boundary. */
  daysToAntarBoundary: number | null;
  perLevel: { maha: number; antar: number; pratyantar: number } | null;
}

function boundaryDays(period: DashaPeriod, t: number): number {
  return Math.min(Math.abs(t - period.start.getTime()), Math.abs(period.end.getTime() - t)) / DAY_MS;
}

/**
 * Fitness of the running Maha/Antar/Pratyantar lords for one event instant.
 *
 * The Vimshottari tree this engine builds is a rigid translation: its origin is
 * `birthUtc − frac × DASHA_YEARS[firstLord]` and every period after that has a
 * fixed duration, so shifting the birth minute moves EVERY boundary in the
 * 120-year cycle by the same absolute amount — about 1.7 days per minute for a
 * 7-year opening lord, 4.8 for a 20-year one. Mahadasha and Antardasha
 * boundaries barely care; a Pratyantardasha can be as short as nine days and is
 * therefore genuinely replaceable inside a ±15-minute sweep. That is why the
 * boundary distance is reported in absolute days, not as a fraction.
 */
export function dashaFitness(
  chart: ChartData,
  tree: DashaPeriod[] | null,
  type: EventType,
  gender: Gender | undefined,
  at: Date
): DashaFitness {
  const rule = EVENT_RULES[type];
  if (!tree) {
    return {
      score: 0,
      reasons: [{ text: "No birth anchor, so no Vimshottari sequence to read.", weight: 0 }],
      active: null,
      daysToPratyantarBoundary: null,
      daysToAntarBoundary: null,
      perLevel: null,
    };
  }
  const active = activeDashaAt(tree, at);
  if (!active) {
    return {
      score: 0,
      reasons: [{ text: "The event date falls outside the computed 120-year dasha cycle.", weight: 0 }],
      active: null,
      daysToPratyantarBoundary: null,
      daysToAntarBoundary: null,
      perLevel: null,
    };
  }

  const t = at.getTime();
  const reasons: RectifyReason[] = [];
  const levels: [keyof typeof DASHA_LEVEL_WEIGHTS, DashaPeriod, string][] = [
    ["maha", active.maha, "Main period"],
    ["antar", active.antar, "Sub-period"],
    ["pratyantar", active.pratyantar, "Sub-sub-period"],
  ];

  const perLevel = { maha: 0, antar: 0, pratyantar: 0 };
  let score = 0;
  for (const [key, period, label] of levels) {
    const sig = planetSignification(chart, period.lord, rule, gender);
    perLevel[key] = sig.score;
    const contribution = DASHA_LEVEL_WEIGHTS[key] * sig.score;
    score += contribution;
    reasons.push({
      text: sig.claims.length
        ? `${label} of ${period.lord}: ${sig.claims.join("; ")}.`
        : `${label} of ${period.lord} signifies nothing in this event's bhavas.`,
      weight: Math.round(contribution * 100) / 100,
      source: { work: "Brihat Parashara Hora Shastra", ref: "ch. 46–52 (Dasha phala)" },
    });
  }

  // Onset bonus: classical practice reads a result as arriving with the period
  // that carries it, not evenly across it.
  const antarFrac =
    (t - active.antar.start.getTime()) / (active.antar.end.getTime() - active.antar.start.getTime());
  const pratFrac =
    (t - active.pratyantar.start.getTime()) /
    (active.pratyantar.end.getTime() - active.pratyantar.start.getTime());
  if (perLevel.antar > 0.4 && antarFrac <= ONSET_FRACTION.antar) {
    score += ONSET_BONUS.antar;
    reasons.push({
      text: `The event falls in the opening ${Math.round(ONSET_FRACTION.antar * 100)}% of a signifying ${active.antar.lord} sub-period.`,
      weight: ONSET_BONUS.antar,
      source: { work: "Phaladeepika", ref: "ch. 19" },
    });
  }
  if (perLevel.pratyantar > 0.4 && pratFrac <= ONSET_FRACTION.pratyantar) {
    score += ONSET_BONUS.pratyantar;
    reasons.push({
      text: `It also opens the ${active.pratyantar.lord} sub-sub-period, which fine-times it.`,
      weight: ONSET_BONUS.pratyantar,
      source: { work: "Phaladeepika", ref: "ch. 19" },
    });
  }

  const dPrat = boundaryDays(active.pratyantar, t);
  const dAntar = boundaryDays(active.antar, t);
  if (dPrat < 10) {
    reasons.push({
      text: `The event sits ${dPrat.toFixed(1)} days from a sub-sub-period boundary — this reading is highly sensitive to the birth minute.`,
      weight: 0,
    });
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    reasons,
    active,
    daysToPratyantarBoundary: dPrat,
    daysToAntarBoundary: dAntar,
    perLevel,
  };
}

/**
 * How far the whole dasha tree translates per minute of birth time, in days.
 * `Δfrac_per_min × DASHA_YEARS[openingLord]`, where the Moon's nakshatra
 * fraction advances by `moonSpeed / (360/27)` per minute. Reported so the UI
 * can state the actual resolution of the dasha evidence for THIS chart rather
 * than quoting a textbook average.
 */
export function dashaShiftDaysPerMinute(moonSpeedPerDay: number, openingLord: PlanetId): number {
  const nakSpan = 360 / 27;
  const fracPerMinute = moonSpeedPerDay / 1440 / nakSpan;
  return (fracPerMinute * DASHA_YEARS[openingLord] * YEAR_MS) / DAY_MS;
}
