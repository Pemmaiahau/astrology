import {
  COMBUSTION_ORBS,
  EXALTATION,
  MOOLATRIKONA,
  NAKSHATRA_LORDS,
  NATURAL_ENEMIES,
  NATURAL_FRIENDS,
  OWN_SIGNS,
  SIGN_LORDS,
} from "./constants";
import { separation, signOf } from "./math";
import type { Dignity, NakshatraRelation, PlanetId, PlanetPosition } from "./types";

/**
 * Naisargika (natural) relation of planet `a` toward planet `b`.
 * NOTE: the classical friendship tables are asymmetric (the Moon calls
 * Mercury a friend; Mercury calls the Moon an enemy) — always query
 * directionally.
 */
export function naturalRelation(a: PlanetId, b: PlanetId): -1 | 0 | 1 {
  if (NATURAL_FRIENDS[a].includes(b)) return 1;
  if (NATURAL_ENEMIES[a].includes(b)) return -1;
  return 0;
}

/**
 * Tatkalika (temporal) friendship: a planet in the 2nd, 3rd, 4th, 10th,
 * 11th or 12th sign from another is its temporal friend; everywhere else
 * (including the same sign) a temporal enemy. Binary by rule — never neutral.
 */
export function temporalRelation(signOfPlanet: number, signOfOther: number): -1 | 1 {
  const rel = ((signOfOther - signOfPlanet + 12) % 12) + 1;
  return [2, 3, 4, 10, 11, 12].includes(rel) ? 1 : -1;
}

/**
 * Compound (panchadha maitri) dignity of `id` placed in `sign`, given the
 * rashi sign of every planet (for the temporal component). Longitude-free so
 * that varga charts and Shadbala's Saptavargaja bala can score placements
 * that have a sign but no meaningful degree. `degInSign` is only needed to
 * resolve the moolatrikona degree band; when omitted the whole sign counts
 * as moolatrikona for its MT lord (the standard sign-level convention).
 */
export function dignityInSign(
  id: PlanetId,
  sign: number,
  degInSign: number | undefined,
  allSigns: Partial<Record<PlanetId, number>>
): Dignity {
  const ex = EXALTATION[id];
  if (ex && sign === ex.sign) return "exalted";
  if (ex && sign === (ex.sign + 6) % 12) return "debilitated";

  const mt = MOOLATRIKONA[id];
  if (mt && sign === mt.sign && (degInSign === undefined || (degInSign >= mt.from && degInSign < mt.to)))
    return "moolatrikona";
  if (OWN_SIGNS[id].includes(sign)) return "own";

  const lord = SIGN_LORDS[sign];
  if (lord === id) return "own";

  const natural = naturalRelation(id, lord);
  const lordSign = allSigns[lord];
  const temporal = lordSign !== undefined ? temporalRelation(sign, lordSign) : 0;

  const score = natural + temporal;
  if (score >= 2) return "greatFriend";
  if (score === 1) return "friend";
  if (score === 0) return "neutral";
  if (score === -1) return "enemy";
  return "greatEnemy";
}

/**
 * Compound dignity: naisargika (natural) relationship combined with
 * tatkalika (temporal) friendship. Planets in the 2nd, 3rd, 4th, 10th,
 * 11th and 12th signs from a planet are its temporal friends.
 * Thin wrapper over `dignityInSign` for callers holding longitudes.
 */
export function computeDignity(
  id: PlanetId,
  longitude: number,
  allLongitudes: Partial<Record<PlanetId, number>>
): Dignity {
  const allSigns: Partial<Record<PlanetId, number>> = {};
  for (const [pid, lon] of Object.entries(allLongitudes)) {
    if (lon !== undefined) allSigns[pid as PlanetId] = signOf(lon);
  }
  return dignityInSign(id, signOf(longitude), longitude % 30, allSigns);
}

/**
 * The nakshatra dispositor (Vimshottari lord of the occupied nakshatra) and the
 * planet's naisargika relation to it. A planet in its own nakshatra acts with
 * undiluted intent; in an enemy's nakshatra its results are filtered through a
 * hostile agent even when the sign-based dignity is strong. Lives here beside
 * `computeDignity` because it is a per-planet state, and so that `chart.ts` can
 * populate it without importing the strength/ashtakavarga graph.
 */
export function nakshatraRelation(
  id: PlanetId,
  nakshatra: number
): { lord: PlanetId; relation: NakshatraRelation } {
  const lord = NAKSHATRA_LORDS[nakshatra];
  if (lord === id) return { lord, relation: "self" };
  if (NATURAL_FRIENDS[id].includes(lord)) return { lord, relation: "friend" };
  if (NATURAL_ENEMIES[id].includes(lord)) return { lord, relation: "enemy" };
  return { lord, relation: "neutral" };
}

export function isCombust(id: PlanetId, longitude: number, sunLongitude: number, retro: boolean): boolean {
  const orb = COMBUSTION_ORBS[id];
  if (!orb) return false;
  return separation(longitude, sunLongitude) <= (retro ? orb.retro : orb.direct);
}

/**
 * Graha Yuddha: two of the five tara grahas (Mars, Mercury, Jupiter,
 * Venus, Saturn) within 1° of each other. By the common convention the
 * planet with the lower longitude wins the war.
 */
export function applyGrahaYuddha(planets: PlanetPosition[]): void {
  const taras: PlanetId[] = ["Ma", "Me", "Ju", "Ve", "Sa"];
  const combatants = planets.filter((p) => taras.includes(p.id));
  for (let i = 0; i < combatants.length; i++) {
    for (let j = i + 1; j < combatants.length; j++) {
      const a = combatants[i];
      const b = combatants[j];
      if (separation(a.longitude, b.longitude) <= 1) {
        const aWins = a.degInSign <= b.degInSign;
        a.warWith = b.id;
        b.warWith = a.id;
        a.warWinner = aWins;
        b.warWinner = !aWins;
      }
    }
  }
}

export const DIGNITY_LABELS: Record<Dignity, string> = {
  exalted: "Exalted (Parama Ucha)",
  moolatrikona: "Moolatrikona",
  own: "Own Sign (Swarashi)",
  greatFriend: "Great Friend's Sign (Adhi Mitra)",
  friend: "Friend's Sign (Mitra)",
  neutral: "Neutral Sign (Sama)",
  enemy: "Enemy Sign (Shatru)",
  greatEnemy: "Great Enemy's Sign (Adhi Shatru)",
  debilitated: "Debilitated (Neecha)",
};

export const DIGNITY_SHORT: Record<Dignity, string> = {
  exalted: "Ex",
  moolatrikona: "MT",
  own: "Own",
  greatFriend: "GF",
  friend: "Fr",
  neutral: "Nu",
  enemy: "En",
  greatEnemy: "GE",
  debilitated: "Db",
};
