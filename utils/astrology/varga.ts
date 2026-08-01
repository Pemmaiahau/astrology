import { signMobility, isOddSign, SHADBALA_PLANETS, type PlanetId7 } from "./constants";
import { norm360, signOf } from "./math";
import { dignityInSign } from "./states";
import type { ChartData, Dignity, PlanetId } from "./types";

/**
 * Shodasavarga divisional charts per BPHS Ch.6 (Shodasavarga adhyaya).
 *
 * Vargas are pure longitude→sign remapping functions of the already-sidereal
 * natal longitudes — no ephemeris work happens here. Where classical sources
 * disagree on a scheme, the BPHS reading is implemented and the variant is
 * noted in a comment (see also data/interpretations/SOURCES.md).
 *
 * Sources: BPHS Ch.6 (varga definitions and Vimshopaka weight tables).
 * D-27 elemental starts and D-40/D-45 starts follow the same chapter.
 */

export type VargaId =
  | "D1" | "D2" | "D3" | "D4" | "D7" | "D9" | "D10" | "D12"
  | "D16" | "D20" | "D24" | "D27" | "D30" | "D40" | "D45" | "D60";

export const VARGA_IDS: VargaId[] = [
  "D1", "D2", "D3", "D4", "D7", "D9", "D10", "D12",
  "D16", "D20", "D24", "D27", "D30", "D40", "D45", "D60",
];

export const VARGA_NAMES: Record<VargaId, string> = {
  D1: "Rashi", D2: "Hora", D3: "Drekkana", D4: "Chaturthamsa",
  D7: "Saptamsa", D9: "Navamsa", D10: "Dasamsa", D12: "Dwadasamsa",
  D16: "Shodasamsa", D20: "Vimsamsa", D24: "Siddhamsa", D27: "Bhamsa",
  D30: "Trimsamsa", D40: "Khavedamsa", D45: "Akshavedamsa", D60: "Shashtiamsa",
};

/** What each varga is classically read for (display strings). */
export const VARGA_SIGNIFICATIONS: Record<VargaId, string> = {
  D1: "the body and life as a whole",
  D2: "wealth and sustenance",
  D3: "siblings, courage and effort",
  D4: "property, home and fortune",
  D7: "children and lineage",
  D9: "marriage, dharma and the planet's true strength",
  D10: "career, profession and public deeds",
  D12: "parents and ancestry",
  D16: "vehicles, comforts and happiness",
  D20: "spiritual practice and worship",
  D24: "learning and education",
  D27: "strengths and vitality",
  D30: "misfortunes and their sources",
  D40: "auspicious and inauspicious effects (maternal line)",
  D45: "general conduct (paternal line)",
  D60: "the sum of past karma",
};

/**
 * Sign occupied in the given varga by a body at the given sidereal longitude.
 * All rules per BPHS Ch.6; each case comments the counting rule used.
 */
export function vargaSign(vargaId: VargaId, longitude: number): number {
  const lon = norm360(longitude);
  const s = signOf(lon);
  const d = lon % 30;
  const odd = isOddSign(s);
  const mobility = signMobility(s);

  switch (vargaId) {
    case "D1":
      return s;

    case "D2": {
      // BPHS Hora: odd signs — first half Sun's hora (Leo), second Moon's (Cancer);
      // even signs reversed. (Variant not implemented: cyclical/Kashinatha hora.)
      const firstHalf = d < 15;
      if (odd) return firstHalf ? 4 : 3;
      return firstHalf ? 3 : 4;
    }

    case "D3": {
      // Drekkana: 1st third → same sign, 2nd → 5th from it, 3rd → 9th from it.
      const part = Math.floor(d / 10);
      return (s + part * 4) % 12;
    }

    case "D4": {
      // Chaturthamsa: quarters go to the sign itself and its kendras (1,4,7,10).
      const part = Math.floor(d / 7.5);
      return (s + part * 3) % 12;
    }

    case "D7": {
      // Saptamsa: odd sign counts from itself, even sign from its 7th.
      const part = Math.floor((d * 7) / 30);
      return (s + (odd ? 0 : 6) + part) % 12;
    }

    case "D9": {
      // Navamsa: movable from itself, fixed from its 9th, dual from its 5th —
      // equivalent to a continuous count of 3°20' arcs from Aries 0°.
      return Math.floor((lon * 9) / 30) % 12;
    }

    case "D10": {
      // Dasamsa: odd sign counts from itself, even sign from its 9th.
      const part = Math.floor(d / 3);
      return (s + (odd ? 0 : 8) + part) % 12;
    }

    case "D12": {
      // Dwadasamsa: always counts from the sign itself.
      const part = Math.floor(d / 2.5);
      return (s + part) % 12;
    }

    case "D16": {
      // Shodasamsa: movable start Aries, fixed start Leo, dual start Sagittarius.
      const part = Math.floor((d * 16) / 30);
      const start = mobility === "movable" ? 0 : mobility === "fixed" ? 4 : 8;
      return (start + part) % 12;
    }

    case "D20": {
      // Vimsamsa: movable start Aries, fixed start Sagittarius, dual start Leo.
      const part = Math.floor((d * 20) / 30);
      const start = mobility === "movable" ? 0 : mobility === "fixed" ? 8 : 4;
      return (start + part) % 12;
    }

    case "D24": {
      // Siddhamsa: odd signs count from Leo, even signs from Cancer.
      const part = Math.floor((d * 24) / 30);
      return ((odd ? 4 : 3) + part) % 12;
    }

    case "D27": {
      // Bhamsa: fiery signs from Aries, earthy from Cancer, airy from Libra,
      // watery from Capricorn.
      const part = Math.floor((d * 27) / 30);
      const start = (s % 4) * 3; // Ar/Le/Sg→0, Ta/Vi/Cp→3, Ge/Li/Aq→6, Cn/Sc/Pi→9
      return (start + part) % 12;
    }

    case "D30": {
      // Trimsamsa (BPHS unequal): odd — Ma 0–5 (Aries), Sa 5–10 (Aquarius),
      // Ju 10–18 (Sagittarius), Me 18–25 (Gemini), Ve 25–30 (Libra);
      // even signs reverse the order into the lords' other signs.
      // (Variant not implemented: equal/Parivritti trimsamsa.)
      if (odd) {
        if (d < 5) return 0;   // Aries (Mars)
        if (d < 10) return 10; // Aquarius (Saturn)
        if (d < 18) return 8;  // Sagittarius (Jupiter)
        if (d < 25) return 2;  // Gemini (Mercury)
        return 6;              // Libra (Venus)
      }
      if (d < 5) return 1;     // Taurus (Venus)
      if (d < 12) return 5;    // Virgo (Mercury)
      if (d < 20) return 11;   // Pisces (Jupiter)
      if (d < 25) return 9;    // Capricorn (Saturn)
      return 7;                // Scorpio (Mars)
    }

    case "D40": {
      // Khavedamsa: odd signs count from Aries, even signs from Libra.
      const part = Math.floor((d * 40) / 30);
      return ((odd ? 0 : 6) + part) % 12;
    }

    case "D45": {
      // Akshavedamsa: movable from Aries, fixed from Leo, dual from Sagittarius.
      const part = Math.floor((d * 45) / 30);
      const start = mobility === "movable" ? 0 : mobility === "fixed" ? 4 : 8;
      return (start + part) % 12;
    }

    case "D60": {
      // Shashtiamsa: sixty half-degree parts counted from the sign itself.
      const part = Math.floor(d * 2);
      return (s + part) % 12;
    }
  }
}

export interface VargaPosition {
  id: PlanetId;
  sign: number;
  /** Compound dignity in this varga (temporal component from varga placements). */
  dignity: Dignity;
  /** True when the D-1 and D-9 signs coincide (only meaningful on D9 entries). */
  vargottama: boolean;
}

export interface VargaChart {
  varga: VargaId;
  /** Sign of the varga lagna. */
  ascendant: number;
  positions: VargaPosition[];
}

export interface VimshopakaScores {
  /** Each scheme totals 20 for a planet dignified in every varga. */
  shad: number;
  sapta: number;
  dasha: number;
  shodasha: number;
}

export interface VargaSet {
  charts: Record<VargaId, VargaChart>;
  /** Planets whose D-1 and D-9 signs coincide. */
  vargottama: PlanetId[];
  vimshopaka: Record<PlanetId7, VimshopakaScores>;
}

/** Whole-sign house of a sign counted from a varga chart's lagna. */
export function houseInVarga(vc: VargaChart, sign: number): number {
  return ((sign - vc.ascendant + 12) % 12) + 1;
}

/** Position entry for one planet inside a varga chart (undefined if absent). */
export function vargaPositionOf(vc: VargaChart, id: PlanetId): VargaPosition | undefined {
  return vc.positions.find((p) => p.id === id);
}

export function computeVargaChart(chart: ChartData, vargaId: VargaId): VargaChart {
  const ascendant = vargaSign(vargaId, chart.ascendant.longitude);
  const d1Signs = new Map<PlanetId, number>();
  const vSigns: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) {
    d1Signs.set(p.id, p.sign);
    vSigns[p.id] = vargaSign(vargaId, p.longitude);
  }
  const positions: VargaPosition[] = chart.planets.map((p) => {
    const sign = vSigns[p.id]!;
    return {
      id: p.id,
      sign,
      // Degree inside a varga sign has no classical meaning — dignity is
      // judged at sign level (moolatrikona counts by sign here).
      dignity: dignityInSign(p.id, sign, undefined, vSigns),
      vargottama: vargaId === "D9" && sign === d1Signs.get(p.id),
    };
  });
  return { varga: vargaId, ascendant, positions };
}

/**
 * BPHS Vimshopaka weight tables. Each scheme's weights total 20
 * (verified in __checks__/verify.ts).
 */
export const VIMSHOPAKA_WEIGHTS: Record<
  keyof VimshopakaScores,
  Partial<Record<VargaId, number>>
> = {
  shad: { D1: 6, D2: 2, D3: 4, D9: 5, D12: 2, D30: 1 },
  sapta: { D1: 5, D2: 2, D3: 3, D7: 2.5, D9: 4.5, D12: 2, D30: 1 },
  dasha: { D1: 3, D2: 1.5, D3: 1.5, D7: 1.5, D9: 1.5, D10: 1.5, D12: 1.5, D16: 1.5, D30: 1.5, D60: 5 },
  shodasha: {
    D1: 3.5, D2: 1, D3: 1, D4: 0.5, D7: 0.5, D9: 3, D10: 0.5, D12: 0.5,
    D16: 2, D20: 0.5, D24: 0.5, D27: 0.5, D30: 1, D40: 0.5, D45: 0.5, D60: 4,
  },
};

/**
 * Fraction of a varga's weight earned per dignity, per the BPHS Vimshopaka
 * grading (20/18/15/10/7/5 twentieths for own/great-friend/friend/neutral/
 * enemy/great-enemy; exaltation and moolatrikona count as own; debilitation
 * as great enemy).
 */
const VIMSHOPAKA_FRACTION: Record<Dignity, number> = {
  exalted: 1, moolatrikona: 1, own: 1,
  greatFriend: 0.9, friend: 0.75, neutral: 0.5,
  enemy: 0.35, greatEnemy: 0.25, debilitated: 0.25,
};

function schemeScore(
  weights: Partial<Record<VargaId, number>>,
  dignities: Partial<Record<VargaId, Dignity>>
): number {
  let total = 0;
  for (const [varga, weight] of Object.entries(weights) as [VargaId, number][]) {
    const dig = dignities[varga];
    if (dig) total += weight * VIMSHOPAKA_FRACTION[dig];
  }
  return total;
}

export function computeVargaSet(chart: ChartData): VargaSet {
  const charts = {} as Record<VargaId, VargaChart>;
  for (const id of VARGA_IDS) charts[id] = computeVargaChart(chart, id);

  const vargottama = charts.D9.positions.filter((p) => p.vargottama).map((p) => p.id);

  const vimshopaka = {} as Record<PlanetId7, VimshopakaScores>;
  for (const pid of SHADBALA_PLANETS) {
    const dignities: Partial<Record<VargaId, Dignity>> = {};
    for (const vid of VARGA_IDS) {
      const pos = vargaPositionOf(charts[vid], pid);
      if (pos) dignities[vid] = pos.dignity;
    }
    vimshopaka[pid] = {
      shad: schemeScore(VIMSHOPAKA_WEIGHTS.shad, dignities),
      sapta: schemeScore(VIMSHOPAKA_WEIGHTS.sapta, dignities),
      dasha: schemeScore(VIMSHOPAKA_WEIGHTS.dasha, dignities),
      shodasha: schemeScore(VIMSHOPAKA_WEIGHTS.shodasha, dignities),
    };
  }

  return { charts, vargottama, vimshopaka };
}
