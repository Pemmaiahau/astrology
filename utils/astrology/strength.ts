import { naturalBenefics, planetsAspecting } from "./aspects";
import type { AshtakavargaResult } from "./ashtakavarga";
import { NAKSHATRAS, PLANET_NAMES, PLANETS } from "./constants";
import { separation } from "./math";
import { nakshatraRelation } from "./states";
import type { ChartData, Dignity, NakshatraRelation, PlanetId } from "./types";

/** Re-exported from states.ts, where it now lives beside the other per-planet state derivations. */
export { nakshatraRelation };

/**
 * Composite planetary strength: a transparent 0–100 score assembled from the
 * factors the engine already computes (dignity, combustion, retrogression,
 * graha yuddha, house placement, Ashtakavarga bindus) plus the aspects module
 * and the nakshatra-dispositor relationship. This is deliberately NOT
 * Shadbala — it is a pragmatic, explainable score whose every contribution
 * is listed in `factors`. See ENGINE.md §10a for the design rationale.
 */

export interface StrengthFactor {
  label: string;
  delta: number;
}

export type StrengthGrade = "Excellent" | "Strong" | "Moderate" | "Weak" | "Afflicted";

export interface PlanetStrength {
  id: PlanetId;
  score: number;
  grade: StrengthGrade;
  factors: StrengthFactor[];
  /** The planet's nakshatra dispositor and its natural relation to the planet. */
  nakshatraLord: PlanetId;
  nakshatraRelation: NakshatraRelation;
}

const BASE = 40;

const DIGNITY_DELTA: Record<Dignity, number> = {
  exalted: 25,
  moolatrikona: 20,
  own: 15,
  greatFriend: 10,
  friend: 5,
  neutral: 0,
  enemy: -8,
  greatEnemy: -12,
  debilitated: -20,
};

/** House whose occupancy grants dig bala (directional strength). */
const DIG_BALA_HOUSE: Partial<Record<PlanetId, number>> = {
  Su: 10, Ma: 10, Ju: 1, Me: 1, Mo: 4, Ve: 4, Sa: 7,
};

const HOUSE_DELTA: Record<number, number> = {
  1: 8, 2: 3, 3: 0, 4: 6, 5: 6, 6: -2, 7: 6, 8: -8, 9: 6, 10: 6, 11: 3, 12: -8,
};

const NAKSHATRA_RELATION_DELTA: Record<NakshatraRelation, number> = {
  self: 6, friend: 4, neutral: 0, enemy: -4,
};

function grade(score: number): StrengthGrade {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 45) return "Moderate";
  if (score >= 30) return "Weak";
  return "Afflicted";
}

export function computeStrength(
  chart: ChartData,
  ashtakavarga: AshtakavargaResult | null,
  id: PlanetId
): PlanetStrength | null {
  const p = chart.planets.find((q) => q.id === id);
  if (!p) return null;

  const factors: StrengthFactor[] = [];
  const add = (label: string, delta: number) => {
    if (delta !== 0) factors.push({ label, delta });
  };

  add("Dignity: " + p.dignity, DIGNITY_DELTA[p.dignity]);

  if (p.combust) add("Combust", -15);
  if (p.retrograde && !["Ra", "Ke"].includes(id)) add("Retrograde (cheshta)", 5);
  if (p.warWith) add(p.warWinner ? `Won graha yuddha vs ${PLANET_NAMES[p.warWith]}` : `Lost graha yuddha to ${PLANET_NAMES[p.warWith]}`, p.warWinner ? 5 : -12);

  const digHouse = DIG_BALA_HOUSE[id];
  if (digHouse) {
    if (p.house === digHouse) add("Dig bala (directional strength)", 8);
    else if (p.house === ((digHouse + 5) % 12) + 1) add("Opposite dig bala direction", -5);
  }

  add(`House placement (${p.house})`, HOUSE_DELTA[p.house] ?? 0);

  const benefics = naturalBenefics(chart);
  for (const q of planetsAspecting(chart, id)) {
    if (benefics.includes(q)) add(`Aspect from ${PLANET_NAMES[q]}`, 6);
    else add(`Aspect from ${PLANET_NAMES[q]}`, -5);
  }

  const nakDelta = NAKSHATRA_RELATION_DELTA[p.nakshatraRelation];
  add(
    `Nakshatra lord ${PLANET_NAMES[p.nakshatraLord]} (${NAKSHATRAS[p.nakshatra]}) — ${p.nakshatraRelation}`,
    nakDelta
  );

  if (ashtakavarga && ashtakavarga.bav[id]) {
    const bindus = ashtakavarga.bav[id][p.sign];
    const delta = Math.max(-8, Math.min(8, (bindus - 4) * 2));
    add(`Ashtakavarga ${bindus} bindus in sign`, delta);
  }

  const raw = BASE + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    id,
    score,
    grade: grade(score),
    factors,
    nakshatraLord: p.nakshatraLord,
    nakshatraRelation: p.nakshatraRelation,
  };
}

export function allStrengths(
  chart: ChartData,
  ashtakavarga: AshtakavargaResult | null
): Partial<Record<PlanetId, PlanetStrength>> {
  const out: Partial<Record<PlanetId, PlanetStrength>> = {};
  for (const id of PLANETS) {
    const s = computeStrength(chart, ashtakavarga, id);
    if (s) out[id] = s;
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Conjunction strength
 * ------------------------------------------------------------------ */

export type ConjunctionTier = "Dominant" | "Balanced" | "Weak blend" | "Afflicted";

export interface ConjunctionStrength {
  members: PlanetId[];
  /**
   * Widest pairwise separation among the members, in degrees — the group's
   * *span*. For a two-planet conjunction this is simply the orb; for three or
   * more it measures how fused the group actually is (three grahas spread over
   * 25° of one sign share a sign, not a blend).
   */
  orb: number;
  /** 0–100 expressive force of the combination */
  score: number;
  tier: ConjunctionTier;
  /** Member with the highest composite strength — the planet that sets the tone */
  leader: PlanetId;
  factors: StrengthFactor[];
}

/** Orb-band contribution: tightness intensifies a blend, distance dilutes it. */
function orbFactor(orb: number): StrengthFactor {
  const band =
    orb <= 1 ? { delta: 12, word: "exact — the grahas act as one body" }
    : orb <= 3 ? { delta: 8, word: "tight" }
    : orb <= 6 ? { delta: 4, word: "close" }
    : orb <= 10 ? { delta: 0, word: "moderate" }
    : orb <= 15 ? { delta: -4, word: "wide" }
    : { delta: -8, word: "very wide — a shared sign more than a true blend" };
  return { label: `Orb ${orb.toFixed(1)}° (${band.word})`, delta: band.delta };
}

function conjunctionTier(score: number, orb: number): ConjunctionTier {
  if (score >= 65 && orb <= 6) return "Dominant";
  if (score >= 52) return "Balanced";
  if (score >= 38) return "Weak blend";
  return "Afflicted";
}

/**
 * Expressive force of a conjunction, built on top of the composite scores the
 * members already carry. Base 50 plus each member's deviation from 50 (shared
 * out so the members average to their mean), plus the orb band, plus the two
 * genuinely *conjunction-level* afflictions that a per-planet score cannot see:
 * a graha yuddha fought between two members, and a member burnt by a Sun that
 * is itself part of the group. Individual dignity, retrogression and general
 * combustion are already inside each member's composite and are not re-charged.
 */
export function conjunctionStrength(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  members: PlanetId[]
): ConjunctionStrength | null {
  if (members.length < 2) return null;
  const positions = members
    .map((id) => chart.planets.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);
  if (positions.length < 2) return null;

  let orb = 0;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      orb = Math.max(orb, separation(positions[i].longitude, positions[j].longitude));
    }
  }

  const factors: StrengthFactor[] = [];
  const share = positions.length;
  for (const p of positions) {
    const s = strengths[p.id];
    if (!s) continue;
    factors.push({
      label: `${PLANET_NAMES[p.id]} composite ${s.score}/100 (${s.grade})`,
      delta: Math.round((s.score - 50) / share),
    });
  }

  factors.push(orbFactor(orb));

  const ids = positions.map((p) => p.id);
  const warPair = positions.find((p) => p.warWith && ids.includes(p.warWith));
  if (warPair && warPair.warWith) {
    factors.push({
      label: `Graha yuddha fought inside the conjunction (${PLANET_NAMES[warPair.id]} vs ${PLANET_NAMES[warPair.warWith]})`,
      delta: -6,
    });
  }

  if (ids.includes("Su")) {
    for (const p of positions) {
      if (p.id !== "Su" && p.combust) {
        factors.push({ label: `${PLANET_NAMES[p.id]} burnt by the Sun within the group`, delta: -6 });
      }
    }
  }

  const raw = 50 + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const leader = [...positions].sort(
    (a, b) => (strengths[b.id]?.score ?? 0) - (strengths[a.id]?.score ?? 0)
  )[0].id;

  return { members: ids, orb, score, tier: conjunctionTier(score, orb), leader, factors };
}
