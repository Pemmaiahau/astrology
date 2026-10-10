import { aspectedSigns, naturalBenefics, naturalMalefics } from "./aspects";
import { isOddSign } from "./constants";
import { computeDayParts } from "./dayParts";
import { naturalRelation } from "./states";
import type { ChartData, Dignity, PlanetId } from "./types";

/**
 * Planetary avasthas (states) — BPHS Ch. 45 (Avastha adhyaya), with the
 * Deeptadi list in the form Phaladeepika and Jagannatha Hora use.
 *
 *   Baladi      — age by degree: how much of its result a graha can give.
 *   Jagradadi   — awake / dreaming / asleep by dignity.
 *   Deeptadi    — nine moods by dignity, combustion and association.
 *   Lajjitadi   — six conditions from placement, association and aspect;
 *                 several can hold at once.
 *   Shayanadi   — twelve activity states from a numeric formula.
 *
 * Conventions where the texts disagree are stated at each function.
 */

export interface AvasthaSet {
  id: PlanetId;
  baladi: { state: string; result: string };
  jagradadi: { state: string; result: string };
  deeptadi: { state: string; alsoVikala: boolean };
  lajjitadi: string[];
  /** Null when the birth time or sunrise is unknown. */
  shayanadi: { index: number; state: string } | null;
}

const BALADI = [
  { state: "Bala (infant)", result: "a quarter of its results" },
  { state: "Kumara (youth)", result: "half of its results" },
  { state: "Yuva (adult)", result: "full results" },
  { state: "Vriddha (old)", result: "meagre results" },
  { state: "Mrita (dead)", result: "no results" },
];

/**
 * Baladi: 6° bands. Odd signs run Bala → Mrita through the sign; even signs
 * run the other way (Mrita → Bala).
 */
export function baladi(sign: number, degInSign: number): { state: string; result: string } {
  const band = Math.min(4, Math.floor(degInSign / 6));
  return BALADI[isOddSign(sign) ? band : 4 - band];
}

/** Jagradadi: own/moolatrikona/exalted awake, friend/neutral dreaming, enemy/debilitated asleep. */
export function jagradadi(dignity: Dignity): { state: string; result: string } {
  if (["exalted", "moolatrikona", "own"].includes(dignity)) return { state: "Jagrat (awake)", result: "full results" };
  if (["greatFriend", "friend", "neutral"].includes(dignity)) return { state: "Swapna (dreaming)", result: "middling results" };
  return { state: "Sushupti (asleep)", result: "little or no result" };
}

/**
 * Deeptadi, in the order of precedence used here: a combust graha is Kopa
 * (angry) whatever its sign; otherwise the state follows dignity — Deepta
 * (exalted), Swastha (own/moolatrikona), Mudita (great friend), Shanta
 * (friend), Deena (neutral), Duhkhita (enemy), Khala (great enemy or
 * debilitated). Vikala (crippled — conjoined with a natural malefic) is
 * reported alongside rather than replacing the dignity state.
 */
export function deeptadi(
  dignity: Dignity,
  combust: boolean,
  withMalefic: boolean
): { state: string; alsoVikala: boolean } {
  if (combust) return { state: "Kopa (angry — combust)", alsoVikala: withMalefic };
  const byDignity: Record<Dignity, string> = {
    exalted: "Deepta (blazing)",
    moolatrikona: "Swastha (at ease)",
    own: "Swastha (at ease)",
    greatFriend: "Mudita (delighted)",
    friend: "Shanta (calm)",
    neutral: "Deena (wretched)",
    enemy: "Duhkhita (distressed)",
    greatEnemy: "Khala (wicked)",
    debilitated: "Khala (wicked)",
  };
  return { state: byDignity[dignity], alsoVikala: withMalefic };
}

const WATERY = [3, 7, 11];

/**
 * Lajjitadi (BPHS 45). Friends and enemies are naisargika (natural)
 * relations; aspects are full Parashari graha drishti by sign.
 *   Lajjita   — in the 5th with Rahu, Ketu, the Sun, Saturn or Mars.
 *   Garvita   — exalted or in moolatrikona.
 *   Kshudhita — in an enemy's sign, or joined/aspected by an enemy, or with Saturn.
 *   Trushita  — in a watery sign, aspected by a malefic and by no benefic.
 *   Mudita    — in a friend's sign, or joined/aspected by a friend, or with Jupiter.
 *   Kshobhita — with the Sun and joined or aspected by a malefic or an enemy.
 */
export function lajjitadi(chart: ChartData, id: PlanetId): string[] {
  const p = chart.planets.find((q) => q.id === id);
  if (!p) return [];
  const others = chart.planets.filter((q) => q.id !== id);
  const conj = others.filter((q) => q.sign === p.sign).map((q) => q.id);
  const aspecting = others.filter((q) => q.sign !== p.sign && aspectedSigns(q.id, q.sign).includes(p.sign)).map((q) => q.id);
  const touching = [...conj, ...aspecting];
  const benefics = naturalBenefics(chart);
  const malefics = naturalMalefics(chart);
  const enemyOf = (q: PlanetId) => naturalRelation(id, q) === -1;
  const friendOf = (q: PlanetId) => naturalRelation(id, q) === 1;
  const out: string[] = [];

  if (p.house === 5 && conj.some((q) => ["Ra", "Ke", "Su", "Sa", "Ma"].includes(q))) out.push("Lajjita (ashamed)");
  if (p.dignity === "exalted" || p.dignity === "moolatrikona") out.push("Garvita (proud)");
  if (["enemy", "greatEnemy"].includes(p.dignity) || touching.some(enemyOf) || conj.includes("Sa")) out.push("Kshudhita (starved)");
  if (WATERY.includes(p.sign) && aspecting.some((q) => malefics.includes(q)) && !aspecting.some((q) => benefics.includes(q))) {
    out.push("Trushita (thirsty)");
  }
  if (["friend", "greatFriend"].includes(p.dignity) || touching.some(friendOf) || conj.includes("Ju")) out.push("Mudita (delighted)");
  if (id !== "Su" && conj.includes("Su") && touching.some((q) => q !== "Su" && (malefics.includes(q) || enemyOf(q)))) {
    out.push("Kshobhita (agitated)");
  }
  return out;
}

const SHAYANADI = [
  "Shayana (lying down)", "Upaveshana (sitting)", "Netrapani (hand to the eyes)", "Prakasha (shining)",
  "Gamana (going)", "Agamana (returning)", "Sabha (in assembly)", "Agama (arriving)",
  "Bhojana (eating)", "Nrityalipsa (wishing to dance)", "Kautuka (eager)", "Nidra (sleeping)",
];
const SERIAL: Record<PlanetId, number> = { Su: 1, Mo: 2, Ma: 3, Me: 4, Ju: 5, Ve: 6, Sa: 7, Ra: 8, Ke: 9 };

/**
 * Shayanadi (BPHS 45): (planet's nakshatra number × planet's serial number ×
 * navamsa number) + Janma nakshatra number + ghatis since sunrise + Lagna
 * sign number, remainder by 12 (0 counts as 12).
 *
 * Conventions: nakshatras count from Ashwini = 1; serial Sun 1 … Saturn 7,
 * Rahu 8, Ketu 9; the navamsa number is the pada of the sign the graha
 * occupies (1–9); ghatis are the completed ghatis (24 minutes each) since the
 * sunrise of the astrological day; the Lagna number counts Aries = 1.
 */
export function shayanadi(
  planetNakshatra: number,
  id: PlanetId,
  degInSign: number,
  janmaNakshatra: number,
  ghatis: number,
  lagnaSign: number
): { index: number; state: string } {
  const navamsa = Math.min(8, Math.floor(degInSign / (30 / 9))) + 1;
  const total = (planetNakshatra + 1) * SERIAL[id] * navamsa + (janmaNakshatra + 1) + ghatis + (lagnaSign + 1);
  const index = total % 12 || 12;
  return { index, state: SHAYANADI[index - 1] };
}

export function computeAvasthas(chart: ChartData): AvasthaSet[] {
  const moon = chart.planets.find((p) => p.id === "Mo");
  const malefics = naturalMalefics(chart);

  let ghatis: number | null = null;
  if (chart.birthUtc && chart.lat !== undefined && chart.lon !== undefined) {
    const parts = computeDayParts(chart.birthUtc, chart.lat, chart.lon, chart.meta.timezone);
    if (parts) ghatis = Math.floor((chart.birthUtc.getTime() - parts.sunrise.getTime()) / (24 * 60000));
  }

  return chart.planets.map((p) => {
    const withMalefic = chart.planets.some((q) => q.id !== p.id && q.sign === p.sign && malefics.includes(q.id));
    return {
      id: p.id,
      baladi: baladi(p.sign, p.degInSign),
      jagradadi: jagradadi(p.dignity),
      deeptadi: deeptadi(p.dignity, p.combust, withMalefic),
      lajjitadi: lajjitadi(chart, p.id),
      shayanadi:
        ghatis !== null && moon
          ? shayanadi(p.nakshatra, p.id, p.degInSign, moon.nakshatra, ghatis, chart.ascendant.sign)
          : null,
    };
  });
}
