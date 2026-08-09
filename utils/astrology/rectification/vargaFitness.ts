import { SHADBALA_PLANETS, SIGN_LORDS, type PlanetId7 } from "../constants";
import {
  houseInVarga,
  vargaPositionOf,
  VARGA_IDS,
  VARGA_NAMES,
  type VargaChart,
  type VargaId,
  type VargaSet,
} from "../varga";
import type { ChartData, Gender, PlanetId } from "../types";
import { EVENT_RULES, resolveHouses } from "./eventRules";
import type { EventType, FitnessComponent, RectifyReason } from "./types";

/**
 * Divisional-chart confirmation.
 *
 * Inside a ±15-minute window the vargas are the only high-resolution sieve the
 * chart offers, because the varga Lagna moves 9/10/60× faster than the rashi
 * Lagna. Measured on the canonical chart (Delhi, Aries rising) the rashi Lagna
 * advances 0.300°/minute, which makes the Lagna amsha change roughly every
 *   D-7  4°17'  → ~14 min      D-9  3°20' → ~11 min
 *   D-10 3°00'  → ~10 min      D-60 0°30' → ~1.7 min
 * so the Shashtiamsa is the single strongest signal available here, and
 * Parashara treats the D-60 as the deciding varga for the whole life. It is
 * therefore weighted heaviest and reported on its own line.
 *
 * AYANAMSHA WARNING: 1.122° is 2.244 shashtiamsas. D-60 placements are NOT
 * comparable between Lahiri and Pushya, and agreement there must never be read
 * as corroboration — see `VARGA_SENSITIVITY_NOTE` in types.ts.
 */

/** Weight of the Shashtiamsa in the varga component. */
export const D60_WEIGHT = 0.4;
/** Weight of the rashi chart, kept small — it barely moves in this window. */
export const D1_WEIGHT = 0.15;

/** Per-varga scoring contributions. */
const VARGA_POINTS = {
  bhavaLordIsDashaLord: 0.35,
  lagnaLordIsDashaLord: 0.15,
  karakaIsDashaLord: 0.15,
  dashaLordInPrimaryHouse: 0.2,
  karakaInPrimaryHouse: 0.15,
  karakaInKendraTrikona: 0.1,
  karakaInDusthana: -0.1,
};

/** Vimshopaka acts only as a tie-breaker, never as a primary score. */
const VIMSHOPAKA_TIEBREAK = 0.05;

const KENDRA_TRIKONA = [1, 4, 5, 7, 9, 10];
const DUSTHANA = [6, 8, 12];

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export interface VargaScore {
  varga: VargaId;
  name: string;
  score: number;
  weight: number;
  notes: string[];
}

export interface VargaFitness extends FitnessComponent {
  perVarga: VargaScore[];
  /** The Shashtiamsa score on its own — the ~2-minute-resolution signal. */
  d60Score: number | null;
  /** Vargas the rule asked for that this engine does not implement. */
  unavailable: VargaId[];
}

/**
 * Which vargas to test, and how to weight them. A varga the rule names but the
 * engine does not implement degrades to D-1 + D-9 + D-60 rather than failing —
 * availability is checked against `VARGA_IDS` at runtime, not assumed.
 */
export function vargaPlan(type: EventType): { list: VargaId[]; weights: Record<string, number>; unavailable: VargaId[] } {
  const rule = EVENT_RULES[type];
  const available = rule.vargas.filter((v) => VARGA_IDS.includes(v));
  const unavailable = rule.vargas.filter((v) => !VARGA_IDS.includes(v));
  const wanted = available.length ? available : (["D9", "D60"] as VargaId[]);
  const list = [...new Set<VargaId>(["D1", ...wanted, ...(unavailable.length ? (["D9", "D60"] as VargaId[]) : [])])];

  const weights: Record<string, number> = { D1: D1_WEIGHT };
  const hasD60 = list.includes("D60");
  if (hasD60) weights.D60 = D60_WEIGHT;
  const rest = list.filter((v) => v !== "D1" && v !== "D60");
  const restTotal = 1 - D1_WEIGHT - (hasD60 ? D60_WEIGHT : 0);
  if (rest.length) {
    for (const v of rest) weights[v] = restTotal / rest.length;
  } else if (hasD60) {
    weights.D60 += restTotal;
  } else {
    weights.D1 += restTotal;
  }
  return { list, weights, unavailable };
}

function scoreOneVarga(
  vc: VargaChart,
  primaryHouses: number[],
  karakas: PlanetId[],
  lords: PlanetId[]
): { score: number; notes: string[] } {
  const notes: string[] = [];
  let score = 0;

  // The varga Lagna lord.
  const lagnaLord = SIGN_LORDS[vc.ascendant];
  if (lords.includes(lagnaLord)) {
    score += VARGA_POINTS.lagnaLordIsDashaLord;
    notes.push(`${lagnaLord} rules this varga's Lagna and is a running dasha lord`);
  }

  // The lords of the event's bhavas inside this varga.
  const bhavaLords = primaryHouses.map((h) => ({
    house: h,
    lord: SIGN_LORDS[(vc.ascendant + h - 1) % 12],
  }));
  const lordHits = bhavaLords.filter((b) => lords.includes(b.lord));
  if (lordHits.length) {
    score += VARGA_POINTS.bhavaLordIsDashaLord;
    notes.push(
      `${lordHits.map((b) => `${b.lord} rules its ${ord(b.house)}`).join(", ")} and runs in the dasha`
    );
  }

  // Karakas that are themselves running.
  const karakaLords = karakas.filter((k) => lords.includes(k));
  if (karakaLords.length) {
    score += VARGA_POINTS.karakaIsDashaLord;
    notes.push(`the karaka ${karakaLords.join("/")} is a running dasha lord`);
  }

  // Dasha lords standing in the event's bhavas of this varga.
  const placed = lords.filter((l) => {
    const pos = vargaPositionOf(vc, l);
    return pos ? primaryHouses.includes(houseInVarga(vc, pos.sign)) : false;
  });
  if (placed.length) {
    score += VARGA_POINTS.dashaLordInPrimaryHouse * Math.min(1, placed.length / 2);
    notes.push(`${placed.join("/")} stands in the event's bhava here`);
  }

  // The karaka's own placement in this varga.
  for (const k of karakas) {
    const pos = vargaPositionOf(vc, k);
    if (!pos) continue;
    const h = houseInVarga(vc, pos.sign);
    if (primaryHouses.includes(h)) {
      score += VARGA_POINTS.karakaInPrimaryHouse;
      notes.push(`${k} occupies the ${ord(h)} of this varga`);
    } else if (KENDRA_TRIKONA.includes(h)) {
      score += VARGA_POINTS.karakaInKendraTrikona;
      notes.push(`${k} holds a kendra/trikona here (${ord(h)})`);
    } else if (DUSTHANA.includes(h)) {
      score += VARGA_POINTS.karakaInDusthana;
      notes.push(`${k} falls in the ${ord(h)} of this varga`);
    }
  }

  return { score: Math.max(0, Math.min(1, score)), notes };
}

export function vargaFitness(
  chart: ChartData,
  vargas: VargaSet,
  type: EventType,
  gender: Gender | undefined,
  lords: PlanetId[]
): VargaFitness {
  const rule = EVENT_RULES[type];
  const primaryHouses = resolveHouses(rule.primaryHouses);
  const karakas = [...rule.karakas, ...(gender === "female" ? rule.karakasFemale ?? [] : [])];
  const { list, weights, unavailable } = vargaPlan(type);

  const perVarga: VargaScore[] = [];
  let score = 0;
  for (const vid of list) {
    const vc = vargas.charts[vid];
    if (!vc) continue;
    const { score: s, notes } = scoreOneVarga(vc, primaryHouses, karakas, lords);
    const w = weights[vid] ?? 0;
    score += w * s;
    perVarga.push({ varga: vid, name: VARGA_NAMES[vid], score: s, weight: w, notes });
  }

  // Vimshopaka tie-break: are the planets carrying this event dignified across
  // the divisional set, relative to the rest of the chart? Never a primary
  // score — it moves the result by at most ±0.05.
  const involved = new Set<PlanetId>([
    ...karakas,
    ...primaryHouses.map((h) => SIGN_LORDS[(chart.ascendant.sign + h - 1) % 12]),
  ]);
  const all = SHADBALA_PLANETS.map((p) => vargas.vimshopaka[p].shodasha).sort((a, b) => a - b);
  const median = all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2;
  const involved7 = [...involved].filter((p): p is PlanetId7 => SHADBALA_PLANETS.includes(p as PlanetId7));
  let tiebreak = 0;
  if (involved7.length) {
    const above = involved7.filter((p) => vargas.vimshopaka[p].shodasha > median).length;
    tiebreak = VIMSHOPAKA_TIEBREAK * (2 * (above / involved7.length) - 1);
    score += tiebreak;
  }

  const reasons: RectifyReason[] = [];
  const d60 = perVarga.find((v) => v.varga === "D60");
  if (d60) {
    reasons.push({
      text: d60.notes.length
        ? `Shashtiamsa (D-60): ${d60.notes.join("; ")}.`
        : "Shashtiamsa (D-60): nothing in this event's bhavas connects to the running lords.",
      weight: Math.round(d60.weight * d60.score * 100) / 100,
      source: { work: "Brihat Parashara Hora Shastra", ref: "ch. 6 (Shodasavarga)" },
    });
  }
  for (const v of perVarga) {
    if (v.varga === "D60" || !v.notes.length) continue;
    reasons.push({
      text: `${v.name} (${v.varga}): ${v.notes.join("; ")}.`,
      weight: Math.round(v.weight * v.score * 100) / 100,
      source: { work: "Brihat Parashara Hora Shastra", ref: "ch. 6 (Shodasavarga)" },
    });
  }
  if (involved7.length) {
    reasons.push({
      text: `Vimshopaka of the planets carrying this event sits ${tiebreak >= 0 ? "above" : "below"} the chart median — a tie-break only.`,
      weight: Math.round(tiebreak * 100) / 100,
    });
  }
  if (unavailable.length) {
    reasons.push({
      text: `${unavailable.join("/")} is not implemented in this engine; the reading fell back to D-1, D-9 and D-60.`,
      weight: 0,
    });
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    reasons,
    perVarga,
    d60Score: d60 ? d60.score : null,
    unavailable,
  };
}
