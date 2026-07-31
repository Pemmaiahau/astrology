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
 * Compound dignity: naisargika (natural) relationship combined with
 * tatkalika (temporal) friendship. Planets in the 2nd, 3rd, 4th, 10th,
 * 11th and 12th signs from a planet are its temporal friends.
 */
export function computeDignity(
  id: PlanetId,
  longitude: number,
  allLongitudes: Partial<Record<PlanetId, number>>
): Dignity {
  const sign = signOf(longitude);
  const deg = longitude % 30;

  const ex = EXALTATION[id];
  if (ex && sign === ex.sign) return "exalted";
  if (ex && sign === (ex.sign + 6) % 12) return "debilitated";

  const mt = MOOLATRIKONA[id];
  if (mt && sign === mt.sign && deg >= mt.from && deg < mt.to) return "moolatrikona";
  if (OWN_SIGNS[id].includes(sign)) return "own";

  const lord = SIGN_LORDS[sign];
  if (lord === id) return "own";

  // Natural relation with the dispositor
  let natural = 0; // -1 enemy, 0 neutral, +1 friend
  if (NATURAL_FRIENDS[id].includes(lord)) natural = 1;
  else if (NATURAL_ENEMIES[id].includes(lord)) natural = -1;

  // Temporal relation: where does the dispositor sit relative to this planet?
  const lordLon = allLongitudes[lord];
  let temporal = 0;
  if (lordLon !== undefined) {
    const rel = ((signOf(lordLon) - sign + 12) % 12) + 1; // sign of lord counted from planet's sign
    temporal = [2, 3, 4, 10, 11, 12].includes(rel) ? 1 : -1;
  }

  const score = natural + temporal;
  if (score >= 2) return "greatFriend";
  if (score === 1) return "friend";
  if (score === 0) return "neutral";
  if (score === -1) return "enemy";
  return "greatEnemy";
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
