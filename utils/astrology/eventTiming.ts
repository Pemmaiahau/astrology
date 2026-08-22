import { aspectedSigns, drishtiOnHouse, naturalBenefics } from "./aspects";
import type { AshtakavargaResult } from "./ashtakavarga";
import { PLANET_NAMES, SHADBALA_MINIMUM, SIGN_LORDS, type PlanetId7 } from "./constants";
import { activeDashaAt } from "./dasha";
import { ordinal } from "./format";
import {
  contactCoverage,
  contactsFromOccupancy,
  contactStepDays,
  gocharaAt,
  saturnStanceAt,
  snapshotAt,
  type SaturnStance,
  type TransitContact,
} from "./gochara";
import { doubleTransitOnSign } from "./jaimini";
import { occupancyIntervals, periodsOverlapping, type OccupancyInterval } from "./scan";
import { planetSignification, type Signification } from "./rectification/dashaFitness";
import type { EventRule } from "./rectification/eventRules";
import type { BhavaBala, ShadbalaSet } from "./shadbala";
import type { PlanetStrength } from "./strength";
import type { AyanamshaId, ChartData, DashaPeriod, Gender, PlanetId } from "./types";

/**
 * Life-event timing engine — the inverse of the rectification pipeline.
 *
 * Rectification asks "given this date, how well does the chart fit?" and
 * scores a known instant. This module asks the opposite question — "given the
 * chart, which stretches of life carry this event?" — and returns ranked
 * windows. Because the two are inverses over the same doctrine, the classical
 * knowledge is not restated here: the event→bhava→karaka table and the
 * per-planet signification scorer are imported from the rectification layer
 * (`EventRule`, `planetSignification`), and the gochara table from
 * `gochara.ts`. What is genuinely new is (a) *natal promise* — whether the
 * chart promises the event at all, which a dated scorer never has to ask —
 * and (b) window generation and ranking.
 *
 * Method, in the order the score is built:
 *   1. Natal promise: Bhava Bala of the event's bhavas, Shadbala of their
 *      lords and of the karakas, drishti on the bhavas, the nakshatra lords of
 *      the bhava cusps, and Sarvashtakavarga support. A chart that does not
 *      promise an event does not get strong windows for it, however good the
 *      dasha looks — this is the classical order (promise, then timing).
 *   2. Vimshottari: every Antardasha whose Maha or Antar lord signifies the
 *      event's bhava set is a candidate window.
 *   3. Gochara: the Guru–Shani double transit over the bhavas, the slow
 *      grahas' own contacts with the bhavas and karakas, the Moon-frame
 *      Gochara Phala with vedha, and Saturn's standing stance.
 *   4. Age plausibility: a caller-supplied prior (see `ageBands.ts`).
 *
 * Pure. Nothing reads `Date.now()`; every window is a function of the chart,
 * the tree and the scan range, so past life stages scan exactly like future
 * ones. No `data/` import except the rules seam, which is itself a re-export.
 *
 * HONESTY NOTE: the weighting of these four limbs against each other is a
 * modern synthesis. The limbs are classical; the arithmetic that blends them
 * is not, and every window carries its own weighted reason list so a reader
 * can see — and discount — each contribution separately.
 */

const YEAR_MS = 365.2425 * 86400000;

/** Shortest stretch that may be named a window's peak. */
const MIN_PEAK_MS = 21 * 86400000;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** "a", "a and b", "a, b and c" — used wherever a reason lists its parts. */
function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Shared context — computed once per chart, reused by every event
// ---------------------------------------------------------------------------

/** The slow grahas whose ingresses drive every transit judgement below. */
export const SLOW_BODIES: PlanetId[] = ["Ju", "Sa", "Ra", "Ke"];

export interface TimingContext {
  chart: ChartData;
  tree: DashaPeriod[];
  ayanamsha: AyanamshaId;
  av: AshtakavargaResult | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  gender: Gender | undefined;
  birthUtc: Date;
  /** The scanned life span. */
  from: Date;
  to: Date;
  /** "Today" — used only to phase-label windows, never to bound the scan. */
  now: Date;
  /** One ingress scan per slow body over the whole span, shared by all events. */
  occupancy: Record<string, OccupancyInterval[]>;
  /** Instants at which the double-transit state can change. */
  boundaries: number[];
}

/**
 * Build the shared context. Returns null for charts without a birth anchor —
 * every window below is a dasha window, and there is no dasha without one.
 *
 * `spanYears` is the life the timeline covers. 96 matches the Sade Sati
 * scanner's default: long enough that a full Vimshottari cycle plus the
 * opening balance is visible, short enough that the four ingress scans stay
 * in the low thousands of ephemeris samples.
 */
export function buildTimingContext(opts: {
  chart: ChartData;
  tree: DashaPeriod[] | null;
  ayanamsha: AyanamshaId;
  av: AshtakavargaResult | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  now: Date;
  spanYears?: number;
}): TimingContext | null {
  const { chart, tree, ayanamsha, now } = opts;
  if (!tree || !chart.birthUtc) return null;

  const birthUtc = chart.birthUtc;
  const from = birthUtc;
  const to = new Date(birthUtc.getTime() + (opts.spanYears ?? 96) * YEAR_MS);
  const nodeMode = chart.meta.nodeMode ?? "mean";

  const occupancy: Record<string, OccupancyInterval[]> = {};
  for (const id of SLOW_BODIES) {
    occupancy[id] = occupancyIntervals(id, ayanamsha, from, to, contactStepDays(id), nodeMode);
  }

  const boundaries = [
    from.getTime(),
    ...occupancy.Ju.map((i) => i.end.getTime()),
    ...occupancy.Sa.map((i) => i.end.getTime()),
    to.getTime(),
  ]
    .filter((t, i, a) => a.indexOf(t) === i)
    .sort((a, b) => a - b);

  return {
    chart,
    tree,
    ayanamsha,
    av: opts.av,
    shadbala: opts.shadbala,
    bhavaBala: opts.bhavaBala,
    strengths: opts.strengths,
    gender: chart.meta.gender,
    birthUtc,
    from,
    to,
    now,
    occupancy,
    boundaries,
  };
}

// ---------------------------------------------------------------------------
// Specification of one event
// ---------------------------------------------------------------------------

export interface TimingReason {
  text: string;
  weight: number;
}

export interface EventTimingSpec {
  /** Resolved whole-sign houses 1–12 that carry the event. */
  primaryHouses: number[];
  supportingHouses: number[];
  /** Houses whose activation argues against the event. */
  negatingHouses: number[];
  karakas: PlanetId[];
  /**
   * The rectification rule reused for `planetSignification`. Carrying the rule
   * rather than re-deriving the scoring is what keeps the two directions —
   * "does this date fit?" and "which dates fit?" — reading the same doctrine.
   */
  rule: EventRule;
  /** Extra target signs for the double transit (Upapada, Arudha, Karakamsa). */
  extraSigns?: number[];
  /** Saturn's standing stance: does it corroborate this event or argue against it? */
  saturnStance: "expected" | "contrary" | "neutral";
  /** Whether a node contact on the Lagna/Moon/karaka marks this event. */
  nodeContact: boolean;
  /** 0–1 plausibility prior at instant `t`; windows scoring 0 are dropped. */
  agePriorAt?: (t: number) => number;
  /** Cap on returned windows (default 6). */
  maxWindows?: number;
  /**
   * Below this the window is not reported at all. Defaults to 30 — a window
   * whose only claim is that some dasha lord aspects a supporting house is
   * noise, and printing it would bury the windows that mean something.
   */
  minScore?: number;
}

// ---------------------------------------------------------------------------
// 1. Natal promise
// ---------------------------------------------------------------------------

export interface NatalPromise {
  /** 0–100. 50 is "the chart is neutral on this". */
  score: number;
  evidence: TimingReason[];
  /** Weakest link, named for the caveat line. */
  weakness: string | null;
}

/** Shadbala ratio (achieved / required) for a graha, or null for the nodes. */
function shadbalaRatio(shadbala: ShadbalaSet | null, id: PlanetId): number | null {
  if (!shadbala) return null;
  if (!(id in SHADBALA_MINIMUM)) return null; // Rahu/Ketu take no Shadbala
  return shadbala.planets[id as PlanetId7]?.ratio ?? null;
}

/**
 * Does the chart promise this event at all?
 *
 * The classical order is promise first, timing second: a dasha cannot deliver
 * what the birth chart does not hold. Every limb here is a natal fact — none
 * of them moves with time — and the result modulates every window the event
 * produces rather than being reported once and forgotten.
 */
export function natalPromise(ctx: TimingContext, spec: EventTimingSpec): NatalPromise {
  const { chart } = ctx;
  const lagna = chart.ascendant.sign;
  const evidence: TimingReason[] = [];
  const add = (text: string, weight: number) => {
    if (weight !== 0) evidence.push({ text, weight: Math.round(weight * 10) / 10 });
  };

  const benefics = naturalBenefics(chart);
  const houses = spec.primaryHouses;

  // --- Bhava Bala of the event's bhavas, against the chart's own mean -------
  if (ctx.bhavaBala) {
    const mean = ctx.bhavaBala.reduce((s, b) => s + b.rupas, 0) / ctx.bhavaBala.length;
    for (const h of houses) {
      const bb = ctx.bhavaBala[h - 1];
      if (!bb) continue;
      const delta = clamp((bb.rupas - mean) * 3.2, -6, 6);
      add(
        `The ${ordinal(h)} house carries ${bb.rupas.toFixed(1)} rupas of Bhava Bala against a chart average of ${mean.toFixed(1)}`,
        delta
      );
    }
  }

  // --- The bhava lords -----------------------------------------------------
  for (const h of houses) {
    const sign = (lagna + h - 1) % 12;
    const lordId = SIGN_LORDS[sign];
    const lord = chart.planets.find((p) => p.id === lordId);
    if (!lord) continue;

    const ratio = shadbalaRatio(ctx.shadbala, lordId);
    if (ratio !== null) {
      const delta = clamp((ratio - 1) * 9, -7, 7);
      add(
        `${PLANET_NAMES[lordId]}, lord of the ${ordinal(h)}, reaches ${Math.round(ratio * 100)}% of its required Shadbala`,
        delta
      );
    } else {
      // No Shadbala for the nodes, and none at all in a chart without a birth
      // anchor — fall back to the composite score the engine always has.
      const s = ctx.strengths[lordId];
      if (s) add(`${PLANET_NAMES[lordId]}, lord of the ${ordinal(h)}, scores ${s.score}/100 composite strength (${s.grade})`, clamp((s.score - 50) / 8, -6, 6));
    }

    // A lord in a dusthana counted FROM ITS OWN HOUSE damages what it rules
    // (Bhavat Bhavam) — the standard reading, and sharper than judging its
    // house from the Lagna alone.
    const fromOwn = ((lord.sign - sign + 12) % 12) + 1;
    if ([6, 8, 12].includes(fromOwn)) {
      add(
        `${PLANET_NAMES[lordId]} stands in the ${ordinal(fromOwn)} from the very house it rules, which classically weakens that house`,
        -4
      );
    } else if ([1, 4, 5, 7, 9, 10].includes(fromOwn)) {
      add(`${PLANET_NAMES[lordId]} stands in the ${ordinal(fromOwn)} from its own house — a supporting placement`, 2.5);
    }

    if (lord.combust) add(`${PLANET_NAMES[lordId]} is combust, burnt by proximity to the Sun`, -3.5);
  }

  // --- Occupants and drishti on the bhavas ---------------------------------
  for (const h of houses) {
    const sign = (lagna + h - 1) % 12;
    for (const p of chart.planets) {
      if (p.sign !== sign) continue;
      const good = benefics.includes(p.id);
      add(
        `${PLANET_NAMES[p.id]} occupies the ${ordinal(h)}${good ? ", a benefic in the house itself" : ", a malefic in the house itself"}`,
        good ? 3.5 : -2.5
      );
    }
    for (const d of drishtiOnHouse(chart, h)) {
      const good = benefics.includes(d.from);
      add(
        `${PLANET_NAMES[d.from]} casts its ${ordinal(d.offset)} drishti on the ${ordinal(h)}`,
        good ? 2.5 : -2
      );
    }
  }

  // --- Karakas -------------------------------------------------------------
  for (const k of spec.karakas) {
    const ratio = shadbalaRatio(ctx.shadbala, k);
    if (ratio !== null) {
      add(
        `${PLANET_NAMES[k]}, the karaka for this event, reaches ${Math.round(ratio * 100)}% of its required Shadbala`,
        clamp((ratio - 1) * 8, -6, 6)
      );
    } else {
      const s = ctx.strengths[k];
      if (s) add(`${PLANET_NAMES[k]}, the karaka for this event, scores ${s.score}/100 composite strength`, clamp((s.score - 50) / 9, -5, 5));
    }
    // Bhava Karaka Bhava Nashaya: a karaka standing in the very house it
    // signifies is held to spoil it. Applied only where the tradition applies
    // it — the karaka's own bhava, not any of the event's houses.
    const p = chart.planets.find((q) => q.id === k);
    if (p && KARAKA_OWN_BHAVA[k] === p.house) {
      add(
        `${PLANET_NAMES[k]} sits in the ${ordinal(p.house)}, the very house it signifies — karako bhava nashaya, which the tradition reads as spoiling rather than strengthening`,
        -3
      );
    }
  }

  // --- Nakshatra lords of the bhava cusps ----------------------------------
  // The Nadi refinement: a bhava is delivered by the star-lord of its cusp as
  // much as by its sign-lord. Its own signification of the event's house set
  // is what decides whether the delivery lands.
  if (chart.cusps) {
    for (const h of houses) {
      const cusp = chart.cusps[h - 1];
      const starLord = starLordOf(cusp);
      const sig = planetSignification(chart, starLord, spec.rule, ctx.gender);
      if (sig.score > 0.05) {
        add(
          `The nakshatra lord of the ${ordinal(h)} cusp is ${PLANET_NAMES[starLord]}, which itself signifies this theme (${sig.claims.slice(0, 2).join(", ")})`,
          clamp(sig.score * 6, 0, 6)
        );
      }
    }
  }

  // --- Sarvashtakavarga support -------------------------------------------
  if (ctx.av) {
    for (const h of houses) {
      const sign = (lagna + h - 1) % 12;
      const bindus = ctx.av.sav[sign];
      if (bindus === undefined) continue;
      // 28 is the mean of the 337-point Sarva total spread over twelve signs.
      add(`The ${ordinal(h)} holds ${bindus} Sarvashtakavarga bindus`, clamp((bindus - 28) * 0.9, -5, 5));
    }
  }

  // --- Negating houses ----------------------------------------------------
  for (const h of spec.negatingHouses) {
    const sign = (lagna + h - 1) % 12;
    const lordId = SIGN_LORDS[sign];
    const lord = chart.planets.find((p) => p.id === lordId);
    if (!lord) continue;
    if (spec.primaryHouses.includes(lord.house)) {
      add(
        `${PLANET_NAMES[lordId]} rules the ${ordinal(h)}, which argues against this event, and it sits in the ${ordinal(lord.house)} — inside the very houses that carry it`,
        -5
      );
    }
    const aspected = aspectedSigns(lordId, lord.sign).map((s) => ((s - lagna + 12) % 12) + 1);
    const hit = spec.primaryHouses.filter((ph) => aspected.includes(ph) && ph !== lord.house);
    if (hit.length) {
      add(
        `${PLANET_NAMES[lordId]}, lord of the obstructing ${ordinal(h)}, aspects the ${hit.map(ordinal).join(" and ")}`,
        -3
      );
    }
  }

  const raw = 50 + evidence.reduce((s, e) => s + e.weight, 0);
  const score = Math.round(clamp(raw, 0, 100));
  const weakest = [...evidence].sort((a, b) => a.weight - b.weight)[0];

  return {
    score,
    evidence: evidence.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    weakness: weakest && weakest.weight < -2 ? weakest.text : null,
  };
}

/** The bhava each naisargika karaka signifies, for karako bhava nashaya. */
const KARAKA_OWN_BHAVA: Partial<Record<PlanetId, number>> = {
  Su: 9, Mo: 4, Ma: 3, Me: 4, Ju: 5, Ve: 7, Sa: 8,
};

/** Vimshottari lord of the nakshatra a longitude falls in. */
function starLordOf(longitude: number): PlanetId {
  const CYCLE: PlanetId[] = ["Ke", "Ve", "Su", "Mo", "Ma", "Ra", "Ju", "Sa", "Me"];
  return CYCLE[Math.floor((((longitude % 360) + 360) % 360) / (360 / 27)) % 9];
}

// ---------------------------------------------------------------------------
// 2. Windows
// ---------------------------------------------------------------------------

export interface EventPeak {
  start: Date;
  end: Date;
  label: string;
}

/**
 * A slow-graha contact, carrying *why* the sign it stands in is a target.
 *
 * Without the note a reader sees "Jupiter transits Gemini — the 3rd from your
 * Lagna" under a higher-studies window and has no way to tell that Gemini is
 * being watched because the 9th lord stands there. The note is the difference
 * between a transit list and an explanation.
 */
export interface EventContact extends TransitContact {
  note: string;
}

export interface EventWindow {
  start: Date;
  end: Date;
  /** 0–100 composite. */
  score: number;
  /** 5–95 belief that the window is genuinely activated. */
  confidence: number;
  dasha: { maha: PlanetId; antar: PlanetId };
  /** Signification claims of the two dasha lords, for the reasoning panel. */
  mahaClaims: string[];
  antarClaims: string[];
  /** Saturn and Jupiter jointly influencing the bhavas, as a 0–1 fraction. */
  doubleTransit: number;
  /** Slow-graha contacts with the event's bhavas, lords and karakas. */
  contacts: EventContact[];
  /** Moon-frame gochara at the window's midpoint, −1 … +1. */
  gochara: number;
  gocharaText: string[];
  saturn: SaturnStance;
  agePrior?: number;
  phase: "past" | "current" | "future";
  /** Tightest sub-stretch inside the window, when one stands out. */
  peak: EventPeak | null;
  reasons: TimingReason[];
}

/**
 * Ranked windows for one event over the context's life span.
 *
 * A window is one Antardasha, clipped to the span. It becomes a candidate when
 * the Maha or the Antar lord signifies the event's bhava set at all; from
 * there the transit, gochara, age and promise limbs decide its score. Windows
 * are returned chronologically — a timeline reads as a life, not as a
 * leaderboard — with the score carried on each for callers that want to rank.
 */
export function findEventWindows(
  ctx: TimingContext,
  spec: EventTimingSpec,
  promise: NatalPromise
): EventWindow[] {
  const { chart, ayanamsha } = ctx;
  const lagna = chart.ascendant.sign;

  const bhavaSigns = spec.primaryHouses.map((h) => (lagna + h - 1) % 12);
  const doubleTargets = [...bhavaSigns, ...(spec.extraSigns ?? [])];

  // Signs a slow transit must reach to count as a contact: the event's bhavas,
  // the signs its lords stand in, and the signs its karakas stand in — the
  // three natal points the Gochara chapter watches. Each is recorded with what
  // it is, so a contact can explain itself.
  // Roles are collected per sign and per planet before being worded, so a
  // Jupiter that rules both the 9th and the 12th and is also the karaka reads
  // as one clause naming three roles rather than as the same planet listed
  // three times.
  const houseTargets = new Map<number, number[]>();
  const planetTargets = new Map<number, Map<PlanetId, string[]>>();
  const addHouse = (sign: number, house: number) => {
    const list = houseTargets.get(sign);
    if (list) list.push(house);
    else houseTargets.set(sign, [house]);
  };
  const addRole = (sign: number, id: PlanetId, role: string) => {
    let byPlanet = planetTargets.get(sign);
    if (!byPlanet) planetTargets.set(sign, (byPlanet = new Map()));
    const roles = byPlanet.get(id);
    if (roles) {
      if (!roles.includes(role)) roles.push(role);
    } else byPlanet.set(id, [role]);
  };

  for (const h of spec.primaryHouses) {
    const sign = (lagna + h - 1) % 12;
    addHouse(sign, h);
    const lordId = SIGN_LORDS[sign];
    const lord = chart.planets.find((p) => p.id === lordId);
    if (lord) addRole(lord.sign, lordId, `your ${ordinal(h)} lord`);
  }
  for (const k of spec.karakas) {
    const p = chart.planets.find((q) => q.id === k);
    if (p) addRole(p.sign, k, "the karaka for this event");
  }

  const targetSigns = [...new Set([...houseTargets.keys(), ...planetTargets.keys()])];
  const noteFor = (sign: number): string => {
    const parts: string[] = [];
    const houses = houseTargets.get(sign);
    if (houses?.length) {
      parts.push(`your ${houses.map(ordinal).join(" and ")} house${houses.length > 1 ? "s" : ""}`);
    }
    for (const [id, roles] of planetTargets.get(sign) ?? []) {
      parts.push(`${PLANET_NAMES[id]} (${joinClauses(roles)})`);
    }
    return joinClauses(parts);
  };

  const allContacts: EventContact[] = [];
  for (const id of SLOW_BODIES) {
    for (const c of contactsFromOccupancy(chart, id, ctx.occupancy[id], targetSigns)) {
      allContacts.push({ ...c, note: noteFor(c.sign) });
    }
  }

  const juAt = (t: number) => intervalAt(ctx.occupancy.Ju, t);
  const saAt = (t: number) => intervalAt(ctx.occupancy.Sa, t);
  const doubleAt = (t: number): boolean => {
    const ju = juAt(t);
    const sa = saAt(t);
    return !!ju && !!sa && doubleTargets.some((s) => doubleTransitOnSign(s, ju.sign, sa.sign));
  };

  // Signification is a property of a planet and a rule, not of a period, so
  // the nine grahas are scored once and every Antardasha reads the cache.
  const sigCache = new Map<PlanetId, Signification>();
  const sigOf = (id: PlanetId): Signification => {
    let s = sigCache.get(id);
    if (!s) {
      s = planetSignification(chart, id, spec.rule, ctx.gender);
      sigCache.set(id, s);
    }
    return s;
  };

  const nowMs = ctx.now.getTime();
  const windows: EventWindow[] = [];

  for (const md of periodsOverlapping(ctx.tree, 1, ctx.from, ctx.to)) {
    const mahaSig = sigOf(md.lord);
    for (const ad of md.children ?? []) {
      if (ad.start >= ctx.to || ad.end <= ctx.from) continue;
      const antarSig = sigOf(ad.lord);
      if (mahaSig.score < 0.08 && antarSig.score < 0.08) continue;

      const start = ad.start > ctx.from ? ad.start : ctx.from;
      const end = ad.end < ctx.to ? ad.end : ctx.to;
      const mid = (start.getTime() + end.getTime()) / 2;

      const reasons: TimingReason[] = [];
      const add = (text: string, weight: number) => {
        reasons.push({ text, weight: Math.round(weight) });
      };

      // --- Age band. Checked first: outside it there is nothing to score. ---
      let agePrior: number | undefined;
      if (spec.agePriorAt) {
        const prior = spec.agePriorAt(mid);
        if (prior <= 0) continue;
        agePrior = prior;
      }

      // --- Vimshottari -----------------------------------------------------
      // The Antardasha lord leads: it is the period that actually delivers,
      // while the Mahadasha lord sets what is available to be delivered.
      const dashaWeight = 34 * (0.35 * mahaSig.score + 0.65 * antarSig.score);
      add(
        [
          mahaSig.score >= 0.08
            ? `Mahadasha lord ${PLANET_NAMES[md.lord]} — ${mahaSig.claims.slice(0, 3).join("; ")}`
            : null,
          antarSig.score >= 0.08
            ? `Antardasha lord ${PLANET_NAMES[ad.lord]} — ${antarSig.claims.slice(0, 3).join("; ")}`
            : null,
        ]
          .filter(Boolean)
          .join(". "),
        dashaWeight
      );

      // --- Natal promise ---------------------------------------------------
      const promiseWeight = (promise.score - 50) * 0.28;
      add(
        promise.score >= 60
          ? `The birth chart itself promises this: the houses and karakas involved score ${promise.score}/100 for natal support`
          : promise.score <= 40
            ? `The birth chart is reserved about this event — the houses and karakas involved score only ${promise.score}/100, so the period can offer the opportunity but has less to work with`
            : `The birth chart is balanced on this event (${promise.score}/100 natal support), so the period's own quality decides the outcome`,
        promiseWeight
      );

      // --- Guru–Shani double transit --------------------------------------
      let covered = 0;
      const total = end.getTime() - start.getTime();
      for (let i = 0; i < ctx.boundaries.length - 1; i++) {
        const s = Math.max(ctx.boundaries[i], start.getTime());
        const e = Math.min(ctx.boundaries[i + 1], end.getTime());
        if (e <= s) continue;
        if (doubleAt(s)) covered += e - s;
      }
      const doubleFraction = total > 0 ? covered / total : 0;
      if (doubleFraction > 0.02) {
        add(
          `Jupiter and Saturn jointly influence the houses of this event for ${Math.round(doubleFraction * 100)}% of the period — the strongest single confirmation the tradition offers`,
          12 * doubleFraction
        );
      }

      // --- Slow-graha contacts --------------------------------------------
      const contacts = allContacts.filter(
        (c) => c.start.getTime() < end.getTime() && c.end.getTime() > start.getTime()
      );
      const coverage = contactCoverage(contacts, start, end);
      if (coverage > 0.02) {
        const who = [...new Set(contacts.map((c) => PLANET_NAMES[c.id]))].join(", ");
        add(
          `${who} transit${contacts.length === 1 ? "s" : ""} the houses, lords or karakas of this event across ${Math.round(coverage * 100)}% of the period`,
          10 * coverage
        );
      }

      // --- Gochara Phala at the midpoint ----------------------------------
      const snap = snapshotAt(chart, ayanamsha, new Date(mid));
      const results = gocharaAt(chart, ayanamsha, new Date(mid), SLOW_BODIES, snap);
      // Weighted, not a flat mean. Rahu and Ketu are always six signs apart, so
      // at most one of them can occupy an upachaya house from the Moon at a
      // time and a flat mean would drag every window negative for a reason
      // that says nothing about the window. They also rest on convention
      // rather than on the classical seven-graha table, which is the same
      // reason `gochara.ts` flags them — so they carry half a vote each.
      const GOCHARA_VOTE: Partial<Record<PlanetId, number>> = { Ju: 1, Sa: 1, Ra: 0.5, Ke: 0.5 };
      const voteTotal = results.reduce((s, r) => s + (GOCHARA_VOTE[r.id] ?? 1), 0);
      const gochara = results.reduce((s, r) => s + r.value * (GOCHARA_VOTE[r.id] ?? 1), 0) / voteTotal;
      const gocharaText = results.map((r) => r.text);
      if (Math.abs(gochara) > 0.01) {
        add(
          gochara > 0
            ? "Judged from your Moon, the slow grahas stand in favourable houses through the middle of this period"
            : "Judged from your Moon, the slow grahas stand outside their favourable houses through the middle of this period",
          7 * gochara
        );
      }

      // --- Saturn's stance -------------------------------------------------
      const saturn = saturnStanceAt(chart, ayanamsha, new Date(mid));
      if (saturn && spec.saturnStance !== "neutral") {
        const isSadeSati = saturn.startsWith("sadeSati");
        const corroborates = spec.saturnStance === "expected";
        add(
          corroborates
            ? `${isSadeSati ? "Sade Sati" : "Saturn's hard passage from your Moon"} runs through this period, which for an event of this kind corroborates rather than contradicts`
            : `${isSadeSati ? "Sade Sati" : "Saturn's hard passage from your Moon"} runs through this period, which classically argues against an event of this kind landing cleanly`,
          corroborates ? 6 : -6
        );
      }

      // --- Node contact ----------------------------------------------------
      if (spec.nodeContact) {
        const moon = chart.planets.find((p) => p.id === "Mo");
        const nodeTargets = new Set<number>([lagna]);
        if (moon) nodeTargets.add(moon.sign);
        for (const k of spec.karakas) {
          const p = chart.planets.find((q) => q.id === k);
          if (p) nodeTargets.add(p.sign);
        }
        const nodeHit = (["Ra", "Ke"] as PlanetId[]).filter((id) => nodeTargets.has(snap.sign[id]));
        if (nodeHit.length) {
          add(
            `${nodeHit.map((id) => PLANET_NAMES[id]).join(" and ")} transit${nodeHit.length === 1 ? "s" : ""} your Lagna, Moon or the karaka — the mark of a sudden or unlooked-for turn, which is how this kind of event usually arrives`,
            5
          );
        }
      }

      // --- Age prior -------------------------------------------------------
      if (agePrior !== undefined) {
        const w = 30 * (agePrior - 0.5);
        add(
          agePrior >= 0.85
            ? "This falls in the years when this event most commonly occurs"
            : agePrior < 0.4
              ? "This sits at the edge of the usual age range for this event"
              : "This falls within the usual age range for this event",
          w
        );
      }

      // --- Negation --------------------------------------------------------
      // `planetSignification` already nets negation into its 0–1 score, but
      // that netting hides the *shape* of a mixed lord. A lord that signifies
      // the 7th and the 6th-from-the-7th equally scores near zero and would
      // simply drop out; one that signifies the 7th strongly while also
      // touching its obstructor survives with a good score and no mention of
      // the pull. This surfaces the second case, weighted by how much of the
      // Antardasha lord's total claim is obstructive.
      const antarShare = antarSig.negative / (antarSig.negative + antarSig.positive || 1);
      if (antarShare > 0.1) {
        add(
          `${PLANET_NAMES[ad.lord]} also carries houses that obstruct this event, so the period pulls in both directions`,
          -18 * antarShare
        );
      }

      const score = compositeScore(reasons);
      if (score < (spec.minScore ?? DEFAULT_MIN_SCORE)) continue;

      const phase: EventWindow["phase"] =
        start.getTime() > nowMs ? "future" : end.getTime() <= nowMs ? "past" : "current";

      windows.push({
        start,
        end,
        score,
        confidence: confidenceOf(score, { mahaSig, antarSig, doubleFraction, coverage, promise }),
        dasha: { maha: md.lord, antar: ad.lord },
        mahaClaims: mahaSig.claims,
        antarClaims: antarSig.claims,
        doubleTransit: doubleFraction,
        contacts,
        gochara,
        gocharaText,
        saturn,
        agePrior,
        phase,
        peak: findPeak(ctx, ad, contacts, sigOf),
        reasons: reasons.filter((r) => r.weight !== 0).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
      });
    }
  }

  // Selection is a quota, not a top-N: elapsed windows routinely outscore
  // upcoming ones — a chart whose marriage yoga peaked at 27 will keep
  // returning 27 forever — and a pure score sort would crowd out everything
  // the reader can still act on. Half the slots are reserved for non-past
  // windows; whichever pool is short returns its slots to the other.
  windows.sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());

  // At most two windows per Mahadasha. Consecutive Antardashas under one Maha
  // lord share that lord's signification and usually the same slow transit, so
  // they score alike and the raw list reads as the same window repeated four
  // times — four "study abroad" rows spanning ages 22 to 25 that are really
  // one long stretch. Keeping the best two per Maha preserves the story the
  // timeline is telling (which Mahadasha carried this theme, and when inside
  // it) while dropping the repetition. Applied before the past/future quota so
  // both pools are already deduplicated.
  const perMaha = new Map<PlanetId, number>();
  const deduped = windows.filter((w) => {
    const seen = perMaha.get(w.dasha.maha) ?? 0;
    if (seen >= 2) return false;
    perMaha.set(w.dasha.maha, seen + 1);
    return true;
  });

  const max = spec.maxWindows ?? 6;
  const upcoming = deduped.filter((w) => w.phase !== "past");
  const past = deduped.filter((w) => w.phase === "past");
  const upTake = Math.min(Math.ceil(max / 2), upcoming.length);
  const pastTake = Math.min(max - upTake, past.length);
  const upExtra = Math.min(max - upTake - pastTake, upcoming.length - upTake);

  return [...upcoming.slice(0, upTake + upExtra), ...past.slice(0, pastTake)].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
}

/**
 * Windows below this are not reported. It sits just under the "nothing much
 * supports this" value of `compositeScore([])`, so an event only appears once
 * at least one limb has actually said something.
 */
export const DEFAULT_MIN_SCORE = 48;

/**
 * Blend the weighted reasons into a 0–100 score.
 *
 * Deliberately NOT a plain sum. Summing put every well-supported window at the
 * clamp: a chart with the double transit running, a strong Antardasha and the
 * age band at its peak scored 117 and printed 100, which made a merely good
 * window and an outstanding one indistinguishable, and made the clamp — rather
 * than the chart — the thing deciding the top of the range.
 *
 * Support and adversity are therefore saturated separately, the same
 * exponential idiom `planetSignification` uses on its own two sides. Each
 * further limb still moves the score, but by less than the one before, so the
 * scale keeps headroom no window quite reaches and no single limb can drive a
 * window to certainty on its own.
 */
export function compositeScore(reasons: TimingReason[]): number {
  let supportive = 0;
  let adverse = 0;
  for (const r of reasons) {
    if (r.weight > 0) supportive += r.weight;
    else adverse += -r.weight;
  }
  const lift = 62 * (1 - Math.exp(-supportive / 42));
  const drag = 38 * (1 - Math.exp(-adverse / 30));
  return Math.round(clamp(30 + lift - drag, 0, 100));
}

/** Piecewise lookup into a precomputed occupancy list. */
function intervalAt(intervals: OccupancyInterval[], t: number): OccupancyInterval | undefined {
  return (
    intervals.find((i) => t >= i.start.getTime() && t < i.end.getTime()) ??
    intervals[intervals.length - 1]
  );
}

/**
 * The tightest stretch inside an Antardasha: a Pratyantardasha whose own lord
 * signifies the event, preferably one that overlaps a live slow-graha contact.
 *
 * This is the classical third filter — the Maha says what is available, the
 * Antar says when it is live, the Pratyantar says when it lands — and it is
 * what turns a two-year window into the few months a reader can plan around.
 */
function findPeak(
  ctx: TimingContext,
  antar: DashaPeriod,
  contacts: EventContact[],
  sigOf: (id: PlanetId) => Signification
): EventPeak | null {
  const children = antar.children ?? [];
  if (!children.length) return null;

  let best: { period: DashaPeriod; value: number; contact: EventContact | null } | null = null;
  for (const pd of children) {
    const sig = sigOf(pd.lord);
    if (sig.score < 0.15) continue;
    // A Pratyantardasha shorter than three weeks is not a window a reader can
    // plan around, and inside a short Antardasha (Sun's under Sun's runs six
    // days) every one of them is. Naming such a stretch as "the peak" claims a
    // precision the method does not have.
    if (pd.end.getTime() - pd.start.getTime() < MIN_PEAK_MS) continue;
    const overlapping = contacts.find(
      (c) => c.start.getTime() < pd.end.getTime() && c.end.getTime() > pd.start.getTime()
    );
    // A signifying Pratyantar under a live transit beats a stronger signifier
    // with nothing moving over the houses: the contact is what fires it.
    const value = sig.score + (overlapping ? 0.4 : 0);
    if (!best || value > best.value) best = { period: pd, value, contact: overlapping ?? null };
  }
  if (!best) return null;

  const sig = sigOf(best.period.lord);
  const label =
    `${PLANET_NAMES[best.period.lord]} Pratyantardasha — ${sig.claims.slice(0, 2).join(", ")}` +
    (best.contact
      ? `, with ${PLANET_NAMES[best.contact.id]} transiting the ${ordinal(best.contact.houseFromLagna)} at the same time`
      : "");

  // Clip to the scanned span so a peak never advertises a date outside it.
  const start = best.period.start > ctx.from ? best.period.start : ctx.from;
  const end = best.period.end < ctx.to ? best.period.end : ctx.to;
  return end > start ? { start, end, label } : null;
}

/**
 * Belief that a window is genuinely activated, as distinct from how good it is.
 *
 * A score answers "how strong?"; confidence answers "how much do the limbs
 * agree?". They come apart in the case that matters: a window carried by one
 * limb alone — a strong Antardasha with no transit support and a lukewarm
 * natal promise — can score respectably while resting on a single leg, and
 * saying so is more honest than reporting the score twice.
 */
function confidenceOf(
  score: number,
  parts: {
    mahaSig: Signification;
    antarSig: Signification;
    doubleFraction: number;
    coverage: number;
    promise: NatalPromise;
  }
): number {
  const limbs = [
    parts.mahaSig.score >= 0.25,
    parts.antarSig.score >= 0.25,
    parts.doubleFraction > 0.25,
    parts.coverage > 0.25,
    parts.promise.score >= 55,
  ].filter(Boolean).length;
  // Two agreeing limbs is the neutral case; each further one adds, each
  // missing one subtracts.
  return Math.round(clamp(score + (limbs - 2) * 7, 5, 95));
}

/**
 * The dasha running at an instant, as a display string — "Venus–Jupiter–Sun".
 * The panel prints this beside "today" so a reader can see which period the
 * timeline's current marker sits in without expanding a window.
 */
export function dashaLabelAt(tree: DashaPeriod[], when: Date): string | null {
  const a = activeDashaAt(tree, when);
  if (!a) return null;
  return `${PLANET_NAMES[a.maha.lord]}–${PLANET_NAMES[a.antar.lord]}–${PLANET_NAMES[a.pratyantar.lord]}`;
}
