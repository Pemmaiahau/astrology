import { naturalBenefics, planetsAspecting } from "./aspects";
import type { AshtakavargaResult } from "./ashtakavarga";
import {
  NAKSHATRA_LORDS,
  NAKSHATRAS,
  NATURAL_ENEMIES,
  NATURAL_FRIENDS,
  PLANET_NAMES,
  PLANETS,
} from "./constants";
import type { ChartData, Dignity, PlanetId } from "./types";

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
  nakshatraRelation: "self" | "friend" | "neutral" | "enemy";
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

function grade(score: number): StrengthGrade {
  if (score >= 75) return "Excellent";
  if (score >= 60) return "Strong";
  if (score >= 45) return "Moderate";
  if (score >= 30) return "Weak";
  return "Afflicted";
}

export function nakshatraRelation(id: PlanetId, nakshatra: number): { lord: PlanetId; relation: "self" | "friend" | "neutral" | "enemy" } {
  const lord = NAKSHATRA_LORDS[nakshatra];
  if (lord === id) return { lord, relation: "self" };
  if (NATURAL_FRIENDS[id].includes(lord)) return { lord, relation: "friend" };
  if (NATURAL_ENEMIES[id].includes(lord)) return { lord, relation: "enemy" };
  return { lord, relation: "neutral" };
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

  const nak = nakshatraRelation(id, p.nakshatra);
  const nakDelta = { self: 6, friend: 4, neutral: 0, enemy: -4 }[nak.relation];
  add(`Nakshatra lord ${PLANET_NAMES[nak.lord]} (${NAKSHATRAS[p.nakshatra]}) — ${nak.relation}`, nakDelta);

  if (ashtakavarga && ashtakavarga.bav[id]) {
    const bindus = ashtakavarga.bav[id][p.sign];
    const delta = Math.max(-8, Math.min(8, (bindus - 4) * 2));
    add(`Ashtakavarga ${bindus} bindus in sign`, delta);
  }

  const raw = BASE + factors.reduce((s, f) => s + f.delta, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return { id, score, grade: grade(score), factors, nakshatraLord: nak.lord, nakshatraRelation: nak.relation };
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
