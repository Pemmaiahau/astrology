import { SHADBALA_PLANETS, SIGN_LORDS, signMobility, type PlanetId7 } from "./constants";
import { vargaSign } from "./varga";
import type { ChartData, PlanetId } from "./types";

/**
 * Jaimini primitives: chara karakas, Karakamsa, Arudha padas and Argala.
 *
 * Sources: Jaimini Upadesa Sutras, Adhyaya 1 Pada 1 (karakas, argala) and
 * Pada 2 (arudha); BPHS also describes chara karakas and Upapada in its
 * Karakadhyaya / Padadhyaya chapters. Where the 7-karaka and 8-karaka
 * (with Rahu) schemes diverge, the 7-karaka scheme is implemented — it
 * matches the AK…DK set requested and the more common Parashari usage.
 */

export type CharaKarakaId = "AK" | "AmK" | "BK" | "MK" | "PiK" | "GK" | "DK";

export const CHARA_KARAKA_NAMES: Record<CharaKarakaId, string> = {
  AK: "Atmakaraka (self)",
  AmK: "Amatyakaraka (career, counsel)",
  BK: "Bhratrikaraka (siblings, guru)",
  MK: "Matrikaraka (mother)",
  PiK: "Pitrikaraka (father)",
  GK: "Gnatikaraka (kin, obstacles)",
  DK: "Darakaraka (spouse)",
};

const KARAKA_ORDER: CharaKarakaId[] = ["AK", "AmK", "BK", "MK", "PiK", "GK", "DK"];

export interface ArgalaOnHouse {
  /** Planets causing argala (intervention) on this house from the 2nd/4th/11th. */
  intervening: PlanetId[];
  /** Planets obstructing (virodha) from the 12th/10th/3rd respectively. */
  obstructing: PlanetId[];
}

export interface JaiminiInfo {
  /** Chara karakas by descending degree-in-sign among the seven planets. */
  karakas: Record<CharaKarakaId, PlanetId7>;
  /** Sign occupied by the Atmakaraka in the Navamsa. */
  karakamsa: number;
  /** Arudha Lagna (A1) sign. */
  arudhaLagna: number;
  /** Upapada Lagna (UL, arudha of the 12th house) sign. */
  upapada: number;
  /** Arudha padas A1…A12 (index 0 = A1 = Arudha Lagna, index 11 = A12 = Upapada). */
  padas: number[];
  /** Argala/virodha per house 1–12 (index 0 = house 1). */
  argala: ArgalaOnHouse[];
}

/**
 * Arudha of a whole-sign house. Count from the house's sign to its lord's
 * sign, then the same count onward from the lord. Exception (standard
 * Jaimini rule): when the result falls in the house itself or its 7th,
 * take the 10th from the computed position.
 *
 * `houseSign` and `lordSign` are sign indices 0–11.
 */
export function arudhaSign(houseSign: number, lordSign: number): number {
  const count = ((lordSign - houseSign + 12) % 12) + 1; // inclusive count, 1–12
  let pada = (lordSign + count - 1) % 12;
  const seventh = (houseSign + 6) % 12;
  if (pada === houseSign || pada === seventh) pada = (pada + 9) % 12; // 10th therefrom
  return pada;
}

/**
 * Jaimini gives Scorpio and Aquarius two lords each: Mars and Ketu, Saturn and
 * Rahu. Every other sign has the single Parashari lord.
 */
export const CO_LORDS: Partial<Record<number, [PlanetId, PlanetId]>> = {
  7: ["Ma", "Ke"],
  10: ["Sa", "Ra"],
};

/**
 * The sign to count to when a sign's lordship has to be resolved to one
 * placement — the arudha count and the Chara dasha duration both need it.
 *
 * Single-lord signs return that lord's sign. For Scorpio and Aquarius the
 * standard Jaimini resolution (as taught by PVR Narasimha Rao and K.N. Rao):
 *   1. both co-lords in the sign itself → the sign itself;
 *   2. exactly one of them in the sign → the other one (the one "outside");
 *   3. otherwise the stronger: conjoined with more planets; then exalted over
 *      not exalted; then by sign nature, dual > fixed > movable; then the
 *      higher degree in sign. A full tie keeps the Parashari lord.
 * Returns the sign index and which lord was used.
 */
export function resolvedLordSign(chart: ChartData, sign: number): { lord: PlanetId; sign: number } {
  const place = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const pair = CO_LORDS[sign];
  if (!pair) {
    const lordId = SIGN_LORDS[sign];
    const lord = place(lordId);
    // Unplaced lord cannot occur for the seven sign lords in a full chart,
    // but guard for degenerate manual input.
    return { lord: lordId, sign: lord ? lord.sign : sign };
  }
  const [a, b] = pair.map(place);
  if (!a || !b) {
    const only = a ?? b;
    return only ? { lord: only.id, sign: only.sign } : { lord: pair[0], sign };
  }
  const aIn = a.sign === sign;
  const bIn = b.sign === sign;
  if (aIn && bIn) return { lord: a.id, sign };
  if (aIn !== bIn) {
    const outside = aIn ? b : a;
    return { lord: outside.id, sign: outside.sign };
  }
  const company = (p: typeof a) => chart.planets.filter((q) => q.id !== p.id && q.sign === p.sign).length;
  const nature = (s: number) => {
    const m = signMobility(s);
    return m === "dual" ? 3 : m === "fixed" ? 2 : 1;
  };
  const keys = (p: typeof a): number[] => [
    company(p),
    p.dignity === "exalted" ? 1 : 0,
    nature(p.sign),
    p.degInSign,
  ];
  const ka = keys(a);
  const kb = keys(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) {
      const winner = ka[i] > kb[i] ? a : b;
      return { lord: winner.id, sign: winner.sign };
    }
  }
  return { lord: a.id, sign: a.sign };
}

/** Arudha pada of house `house` (1–12) of the rashi chart. */
export function arudhaOfHouse(chart: ChartData, house: number): number {
  const houseSign = (chart.ascendant.sign + house - 1) % 12;
  return arudhaSign(houseSign, resolvedLordSign(chart, houseSign).sign);
}

/**
 * Jaimini rashi drishti (sign aspects, Upadesa Sutras 1.1.2–4): a movable sign
 * aspects the three fixed signs except the one next to it; a fixed sign
 * aspects the three movable signs except the one before it; a dual sign
 * aspects the other three dual signs. Planets aspect with their sign.
 */
export function rashiDrishti(sign: number): number[] {
  const m = signMobility(sign);
  if (m === "dual") return [2, 5, 8, 11].filter((s) => s !== sign);
  if (m === "movable") return [1, 4, 7, 10].filter((s) => s !== (sign + 1) % 12);
  return [0, 3, 6, 9].filter((s) => s !== (sign + 11) % 12);
}

/**
 * Jaimini/graha drishti test for the double-transit rule: does the planet at
 * `fromSign` occupy or cast graha drishti on `sign`? Uses the standard
 * Parashari special aspects (Ju 5/9, Sa 3/10) plus the universal 7th —
 * occupancy counts as influence for transit activation purposes.
 */
function influencesSign(planet: "Ju" | "Sa", fromSign: number, sign: number): boolean {
  const offset = ((sign - fromSign + 12) % 12) + 1; // 1 = same sign
  if (offset === 1 || offset === 7) return true;
  if (planet === "Ju") return offset === 5 || offset === 9;
  return offset === 3 || offset === 10;
}

/**
 * The double-transit rule: a house/sign is activated for major life events
 * when transiting Jupiter AND transiting Saturn simultaneously occupy or
 * aspect it (a widely used timing gate in applied Parashari practice —
 * a modern synthesis, not a classical sutra; noted as such in SOURCES.md).
 */
export function doubleTransitOnSign(sign: number, juSign: number, saSign: number): boolean {
  return influencesSign("Ju", juSign, sign) && influencesSign("Sa", saSign, sign);
}

export function computeJaimini(chart: ChartData): JaiminiInfo {
  // --- Chara karakas: seven planets ranked by descending degree in sign.
  // Tie-break (sub-arcsecond ties only): higher absolute longitude first,
  // then the natural planet order — documented, deterministic.
  const ranked = [...SHADBALA_PLANETS]
    .map((id) => chart.planets.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) =>
      b.degInSign !== a.degInSign ? b.degInSign - a.degInSign : b.longitude - a.longitude
    );

  const karakas = {} as Record<CharaKarakaId, PlanetId7>;
  KARAKA_ORDER.forEach((k, i) => {
    // With fewer than 7 placed planets (degenerate manual input) reuse the last.
    const planet = ranked[Math.min(i, ranked.length - 1)];
    karakas[k] = planet.id as PlanetId7;
  });

  // --- Karakamsa: the AK's navamsa sign.
  const ak = chart.planets.find((p) => p.id === karakas.AK)!;
  const karakamsa = vargaSign("D9", ak.longitude);

  // --- Arudha Lagna and Upapada.
  const padas = Array.from({ length: 12 }, (_, i) => arudhaOfHouse(chart, i + 1));
  const arudhaLagna = padas[0];
  const upapada = padas[11];

  // --- Argala per house: intervention from the 2nd, 4th and 11th signs,
  // obstruction from the 12th, 10th and 3rd respectively (Jaimini Upadesa
  // Sutras 1.1; the malefics-in-3rd secondary argala variant is not scored).
  const argala: ArgalaOnHouse[] = [];
  for (let house = 1; house <= 12; house++) {
    const hSign = (chart.ascendant.sign + house - 1) % 12;
    const at = (offset: number): PlanetId[] =>
      chart.planets.filter((p) => p.sign === (hSign + offset) % 12).map((p) => p.id);
    argala.push({
      intervening: [...at(1), ...at(3), ...at(10)],   // 2nd, 4th, 11th signs
      obstructing: [...at(11), ...at(9), ...at(2)],   // 12th, 10th, 3rd signs
    });
  }

  return { karakas, karakamsa, arudhaLagna, upapada, padas, argala };
}
