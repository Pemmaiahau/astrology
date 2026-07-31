import { norm360 } from "./math";
import type { ChartData, PlanetId } from "./types";

/**
 * Parashari graha drishti (planetary aspects), whole-sign based.
 * Every graha aspects the 7th sign from itself; Mars adds the 4th and 8th,
 * Jupiter the 5th and 9th, Saturn the 3rd and 10th. The nodes are given the
 * 5th/9th (+7th) aspects per the common BPHS reading — some traditions omit
 * nodal drishti entirely; that convention choice is documented in ENGINE.md.
 * Offsets are counted inclusively: the "7th aspect" is fromSign + 6 signs.
 * Partial aspects (3/4, 1/2, 1/4 strength) are intentionally not modelled —
 * a drishti either lands on a sign or it does not.
 */
export const SPECIAL_DRISHTI: Partial<Record<PlanetId, number[]>> = {
  Ma: [4, 8],
  Ju: [5, 9],
  Sa: [3, 10],
  Ra: [5, 9],
  Ke: [5, 9],
};

/** Sign indices (0–11) that a planet standing in `fromSign` casts drishti on. */
export function aspectedSigns(id: PlanetId, fromSign: number): number[] {
  const offsets = [7, ...(SPECIAL_DRISHTI[id] ?? [])];
  return offsets.map((o) => (fromSign + o - 1) % 12);
}

/** Planets casting drishti on a given sign (occupancy of the sign is NOT an aspect). */
export function aspectsOnSign(chart: ChartData, sign: number): PlanetId[] {
  return chart.planets
    .filter((p) => p.sign !== sign && aspectedSigns(p.id, p.sign).includes(sign))
    .map((p) => p.id);
}

/** Planets casting drishti on a whole-sign house counted from the Lagna. */
export function aspectsOnHouse(chart: ChartData, house: number): PlanetId[] {
  const sign = (chart.ascendant.sign + house - 1) % 12;
  return aspectsOnSign(chart, sign);
}

/**
 * A single drishti landing on a sign, carrying *which* aspect landed.
 * The offset matters interpretively: Saturn's 3rd glance (grinding persistence)
 * reads differently from its 10th (imposed duty) or its 7th (delay and weight),
 * and Jupiter's 5th (blessing on intelligence/progeny) differs from its 9th
 * (blessing on fortune/dharma). `aspectsOnSign` and friends deliberately keep
 * returning bare ids so existing callers (strength.ts, lifeAreas.ts) are
 * unaffected; this richer shape is what the interpretation layer consumes.
 */
export interface Drishti {
  from: PlanetId;
  /** Inclusive sign-count of the aspect that landed: 3, 4, 5, 7, 8, 9 or 10 */
  offset: number;
  /** False for the universal 7th drishti, true for a planet's special aspects */
  special: boolean;
}

/** Every drishti landing on a sign, with the aspect offset that produced it. */
export function drishtiOnSign(chart: ChartData, sign: number): Drishti[] {
  const out: Drishti[] = [];
  for (const p of chart.planets) {
    if (p.sign === sign) continue; // occupancy is not an aspect
    const offsets = [7, ...(SPECIAL_DRISHTI[p.id] ?? [])];
    for (const o of offsets) {
      if ((p.sign + o - 1) % 12 === sign) {
        out.push({ from: p.id, offset: o, special: o !== 7 });
      }
    }
  }
  return out;
}

/** Every drishti landing on a whole-sign house counted from the Lagna. */
export function drishtiOnHouse(chart: ChartData, house: number): Drishti[] {
  const sign = (chart.ascendant.sign + house - 1) % 12;
  return drishtiOnSign(chart, sign);
}

/** Planets casting drishti on the sign occupied by `target` (conjunction excluded). */
export function planetsAspecting(chart: ChartData, target: PlanetId): PlanetId[] {
  const t = chart.planets.find((p) => p.id === target);
  if (!t) return [];
  return chart.planets
    .filter((p) => p.id !== target && p.sign !== t.sign && aspectedSigns(p.id, p.sign).includes(t.sign))
    .map((p) => p.id);
}

/**
 * Natural (naisargika) benefics for this chart. Jupiter and Venus always;
 * the Moon when waxing (Shukla paksha — elongation from the Sun < 180°);
 * Mercury when not sharing a sign with a natural malefic (Su/Ma/Sa/Ra/Ke).
 */
export function naturalBenefics(chart: ChartData): PlanetId[] {
  const out: PlanetId[] = ["Ju", "Ve"];
  const su = chart.planets.find((p) => p.id === "Su");
  const mo = chart.planets.find((p) => p.id === "Mo");
  if (su && mo && norm360(mo.longitude - su.longitude) < 180) out.push("Mo");
  const me = chart.planets.find((p) => p.id === "Me");
  if (me) {
    const hardMalefics: PlanetId[] = ["Su", "Ma", "Sa", "Ra", "Ke"];
    const afflicted = chart.planets.some((p) => hardMalefics.includes(p.id) && p.sign === me.sign);
    if (!afflicted) out.push("Me");
  }
  return out;
}

/** Complement of naturalBenefics over the nine grahas. */
export function naturalMalefics(chart: ChartData): PlanetId[] {
  const benefics = naturalBenefics(chart);
  return chart.planets.map((p) => p.id).filter((id) => !benefics.includes(id));
}
