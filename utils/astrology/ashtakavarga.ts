import type { PlanetId } from "./types";

/**
 * Classical Parashari Bhinna Ashtakavarga benefic-place tables.
 * BENEFIC_PLACES[planet][contributor] = houses (1–12, counted from the
 * contributor's sign) where the planet receives a bindu.
 * Contributors: the seven planets plus "As" (Lagna).
 */
type Contributor = PlanetId | "As";

const T: Record<string, Partial<Record<Contributor, number[]>>> = {
  Su: {
    Su: [1, 2, 4, 7, 8, 9, 10, 11],
    Mo: [3, 6, 10, 11],
    Ma: [1, 2, 4, 7, 8, 9, 10, 11],
    Me: [3, 5, 6, 9, 10, 11, 12],
    Ju: [5, 6, 9, 11],
    Ve: [6, 7, 12],
    Sa: [1, 2, 4, 7, 8, 9, 10, 11],
    As: [3, 4, 6, 10, 11, 12],
  },
  Mo: {
    Su: [3, 6, 7, 8, 10, 11],
    Mo: [1, 3, 6, 7, 10, 11],
    Ma: [2, 3, 5, 6, 9, 10, 11],
    Me: [1, 3, 4, 5, 7, 8, 10, 11],
    Ju: [1, 4, 7, 8, 10, 11, 12],
    Ve: [3, 4, 5, 7, 9, 10, 11],
    Sa: [3, 5, 6, 11],
    As: [3, 6, 10, 11],
  },
  Ma: {
    Su: [3, 5, 6, 10, 11],
    Mo: [3, 6, 11],
    Ma: [1, 2, 4, 7, 8, 10, 11],
    Me: [3, 5, 6, 11],
    Ju: [6, 10, 11, 12],
    Ve: [6, 8, 11, 12],
    Sa: [1, 4, 7, 8, 9, 10, 11],
    As: [1, 3, 6, 10, 11],
  },
  Me: {
    Su: [5, 6, 9, 11, 12],
    Mo: [2, 4, 6, 8, 10, 11],
    Ma: [1, 2, 4, 7, 8, 9, 10, 11],
    Me: [1, 3, 5, 6, 9, 10, 11, 12],
    Ju: [6, 8, 11, 12],
    Ve: [1, 2, 3, 4, 5, 8, 9, 11],
    Sa: [1, 2, 4, 7, 8, 9, 10, 11],
    As: [1, 2, 4, 6, 8, 10, 11],
  },
  Ju: {
    Su: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Mo: [2, 5, 7, 9, 11],
    Ma: [1, 2, 4, 7, 8, 10, 11],
    Me: [1, 2, 4, 5, 6, 9, 10, 11],
    Ju: [1, 2, 3, 4, 7, 8, 10, 11],
    Ve: [2, 5, 6, 9, 10, 11],
    Sa: [3, 5, 6, 12],
    As: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Ve: {
    Su: [8, 11, 12],
    Mo: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Ma: [3, 5, 6, 9, 11, 12],
    Me: [3, 5, 6, 9, 11],
    Ju: [5, 8, 9, 10, 11],
    Ve: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Sa: [3, 4, 5, 8, 9, 10, 11],
    As: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Sa: {
    Su: [1, 2, 4, 7, 8, 10, 11],
    Mo: [3, 6, 11],
    Ma: [3, 5, 6, 10, 11, 12],
    Me: [6, 8, 9, 10, 11, 12],
    Ju: [5, 6, 11, 12],
    Ve: [6, 11, 12],
    Sa: [3, 5, 6, 11],
    As: [1, 3, 4, 6, 10, 11],
  },
  As: {
    Su: [3, 4, 6, 10, 11, 12],
    Mo: [3, 6, 10, 11, 12],
    Ma: [1, 3, 6, 10, 11],
    Me: [1, 2, 4, 6, 8, 10, 11],
    Ju: [1, 2, 4, 5, 6, 7, 9, 10, 11],
    Ve: [1, 2, 3, 4, 5, 8, 9],
    Sa: [1, 3, 4, 6, 10, 11],
    As: [3, 6, 10, 11],
  },
};

export const AV_PLANETS: PlanetId[] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"];

export interface AshtakavargaResult {
  /** bav[planetOrLagna][sign 0-11] = bindus */
  bav: Record<string, number[]>;
  /** Sarvashtakavarga per sign (sum of the seven planets' BAV; total 337) */
  sav: number[];
}

/**
 * @param signs sign index (0–11) of each of the 7 planets, plus lagna sign.
 */
export function computeAshtakavarga(planetSigns: Partial<Record<PlanetId, number>>, lagnaSign: number): AshtakavargaResult {
  const contributorSign = (c: Contributor): number =>
    c === "As" ? lagnaSign : (planetSigns[c] as number);

  const bav: Record<string, number[]> = {};
  const charts: Contributor[] = [...AV_PLANETS, "As"];
  for (const chart of charts) {
    const grid = new Array(12).fill(0);
    const table = T[chart];
    for (const contrib of Object.keys(table) as Contributor[]) {
      const from = contributorSign(contrib);
      for (const h of table[contrib]!) {
        grid[(from + h - 1) % 12] += 1;
      }
    }
    bav[chart] = grid;
  }

  const sav = new Array(12).fill(0);
  for (const p of AV_PLANETS) {
    for (let s = 0; s < 12; s++) sav[s] += bav[p][s];
  }
  return { bav, sav };
}

/**
 * Prastara (contributor-level) lookup: does `contributor` give a bindu to
 * `target`'s Bhinnashtakavarga in `sign`? The summed `bav` grid cannot answer
 * this — Kakshya transit analysis needs to know *which* contributor's bindu a
 * sign holds, not just how many.
 */
export function contributesBindu(
  target: PlanetId | "As",
  contributor: PlanetId | "As",
  sign: number,
  planetSigns: Partial<Record<PlanetId, number>>,
  lagnaSign: number
): boolean {
  const houses = T[target]?.[contributor];
  if (!houses) return false;
  const from = contributor === "As" ? lagnaSign : planetSigns[contributor];
  if (from === undefined) return false;
  return houses.includes(((sign - from + 12) % 12) + 1);
}

// ---------------------------------------------------------------------------
// Shodhana (reductions) and Shodhya Pinda — BPHS Ashtakavarga adhyayas
// ---------------------------------------------------------------------------

/** The four trines of signs: fire, earth, air, water. */
const TRINES: number[][] = [[0, 4, 8], [1, 5, 9], [2, 6, 10], [3, 7, 11]];

/**
 * Pairs of signs owned by one graha. Cancer and Leo have a single lord each
 * and take no Ekadhipatya reduction.
 */
const EKADHIPATYA_PAIRS: [number, number][] = [[0, 7], [1, 6], [2, 5], [8, 11], [9, 10]];

/** Rashi gunakara (sign multipliers), Aries → Pisces. */
export const RASHI_GUNAKARA = [7, 10, 8, 4, 10, 5, 7, 8, 9, 5, 11, 12];

/** Graha gunakara (planet multipliers). */
export const GRAHA_GUNAKARA: Record<string, number> = { Su: 5, Mo: 5, Ma: 8, Me: 5, Ju: 10, Ve: 7, Sa: 5 };

export interface AshtakavargaReductions {
  /** Each planet's BAV after Trikona Shodhana. */
  trikona: Record<string, number[]>;
  /** Each planet's BAV after Trikona and then Ekadhipatya Shodhana. */
  ekadhipatya: Record<string, number[]>;
  /** Sum of the seven fully reduced BAVs, per sign. */
  reducedSav: number[];
  /** Shodhya Pinda per planet: Rashi Pinda + Graha Pinda. */
  pinda: Record<string, { rashi: number; graha: number; total: number }>;
}

/**
 * Trikona Shodhana: within each trine of signs, subtract the smallest of the
 * three figures from all three. That one statement covers the three BPHS
 * cases — a zero in the trine means no reduction (the minimum is zero), three
 * equal figures all become zero, and otherwise the least is taken off each.
 */
export function trikonaShodhana(bav: number[]): number[] {
  const out = [...bav];
  for (const trine of TRINES) {
    const least = Math.min(...trine.map((s) => bav[s]));
    for (const s of trine) out[s] = bav[s] - least;
  }
  return out;
}

/**
 * Ekadhipatya Shodhana, applied to figures that have already been through
 * Trikona Shodhana. For each pair of signs owned by one graha (BPHS; the same
 * rule set B.V. Raman's "Ashtakavarga System" and Jagannatha Hora use):
 *
 *   - both signs occupied                    → no reduction
 *   - either figure already zero             → no reduction
 *   - one occupied, its figure the smaller   → the unoccupied sign is cut down to it
 *   - one occupied, its figure equal/larger  → the unoccupied sign becomes zero
 *   - neither occupied, figures unequal      → both take the smaller figure
 *   - neither occupied, figures equal        → both become zero
 *
 * `occupied[sign]` is true when one of the seven Ashtakavarga grahas stands in
 * the sign; Rahu and Ketu have no place in the scheme and do not count.
 */
export function ekadhipatyaShodhana(afterTrikona: number[], occupied: boolean[]): number[] {
  const out = [...afterTrikona];
  for (const [a, b] of EKADHIPATYA_PAIRS) {
    const va = afterTrikona[a];
    const vb = afterTrikona[b];
    if (occupied[a] && occupied[b]) continue;
    if (va === 0 || vb === 0) continue;
    if (!occupied[a] && !occupied[b]) {
      const least = va === vb ? 0 : Math.min(va, vb);
      out[a] = least;
      out[b] = least;
      continue;
    }
    const [occ, free] = occupied[a] ? [a, b] : [b, a];
    out[free] = afterTrikona[occ] < afterTrikona[free] ? afterTrikona[occ] : 0;
  }
  return out;
}

/**
 * Both reductions for the seven planets' Bhinnashtakavargas, plus the Shodhya
 * Pinda built from the fully reduced figures:
 *
 *   Rashi Pinda = Σ over signs   (reduced bindus in the sign × the sign's gunakara)
 *   Graha Pinda = Σ over grahas  (reduced bindus in the sign that graha occupies
 *                                 × the graha's gunakara)
 *   Shodhya Pinda = Rashi Pinda + Graha Pinda
 *
 * The Lagna's own Ashtakavarga is left out: the reductions and the pinda are
 * defined for the seven grahas.
 */
export function computeAshtakavargaReductions(
  result: AshtakavargaResult,
  planetSigns: Partial<Record<PlanetId, number>>
): AshtakavargaReductions {
  const occupied = new Array<boolean>(12).fill(false);
  for (const p of AV_PLANETS) {
    const s = planetSigns[p];
    if (s !== undefined) occupied[s] = true;
  }

  const trikona: Record<string, number[]> = {};
  const ekadhipatya: Record<string, number[]> = {};
  const pinda: AshtakavargaReductions["pinda"] = {};
  const reducedSav = new Array<number>(12).fill(0);

  for (const p of AV_PLANETS) {
    trikona[p] = trikonaShodhana(result.bav[p]);
    const reduced = ekadhipatyaShodhana(trikona[p], occupied);
    ekadhipatya[p] = reduced;
    for (let s = 0; s < 12; s++) reducedSav[s] += reduced[s];

    const rashi = reduced.reduce((sum, v, s) => sum + v * RASHI_GUNAKARA[s], 0);
    let graha = 0;
    for (const g of AV_PLANETS) {
      const s = planetSigns[g];
      if (s !== undefined) graha += reduced[s] * GRAHA_GUNAKARA[g];
    }
    pinda[p] = { rashi, graha, total: rashi + graha };
  }

  return { trikona, ekadhipatya, reducedSav, pinda };
}
