import {
  COMBUSTION_ORBS,
  EXALTATION,
  MOOLATRIKONA,
  NAKSHATRA_LORDS,
  NATURAL_ENEMIES,
  NATURAL_FRIENDS,
  OWN_SIGNS,
  PLANETS,
  SIGN_LORDS,
} from "./constants";
import { angleDiff, separation, signOf } from "./math";
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
 *
 * The Moon and Mercury share their exaltation sign with their moolatrikona
 * (BPHS): the Moon is exalted in Taurus 0°–3° and moolatrikona from 3°;
 * Mercury is exalted in Virgo 0°–15°, moolatrikona 15°–20° and in its own sign
 * after 20°. With a degree supplied, a placement past the exaltation band falls
 * through to the moolatrikona/own tests below; without one (vargas) the sign
 * still reads as exalted.
 *
 * `temporalFromSign` is the sign the tatkalika (temporal) friendship is
 * counted from. It defaults to `sign`; varga callers pass the planet's rashi
 * sign, because temporal friendship is a fact of the rashi chart (the same
 * convention Saptavargaja bala uses).
 */
export function dignityInSign(
  id: PlanetId,
  sign: number,
  degInSign: number | undefined,
  allSigns: Partial<Record<PlanetId, number>>,
  temporalFromSign: number = sign
): Dignity {
  const ex = EXALTATION[id];
  const mt = MOOLATRIKONA[id];
  if (ex && sign === ex.sign) {
    const pastExaltationBand =
      degInSign !== undefined && mt !== undefined && mt.sign === sign && degInSign >= mt.from;
    if (!pastExaltationBand) return "exalted";
  }
  if (ex && sign === (ex.sign + 6) % 12) return "debilitated";

  if (mt && sign === mt.sign && (degInSign === undefined || (degInSign >= mt.from && degInSign < mt.to)))
    return "moolatrikona";
  if (OWN_SIGNS[id].includes(sign)) return "own";

  const lord = SIGN_LORDS[sign];
  if (lord === id) return "own";

  const natural = naturalRelation(id, lord);
  const lordSign = allSigns[lord];
  const temporal = lordSign !== undefined ? temporalRelation(temporalFromSign, lordSign) : 0;

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
 * Venus, Saturn) within 1° of each other.
 *
 * Winner, per Surya Siddhanta 7 and Brihat Samhita 17: the graha with the
 * more **northerly ecliptic latitude**. That needs real latitudes, which only
 * ephemeris charts carry (`PlanetPosition.latitude`). When either combatant
 * lacks one (manual charts), or the two latitudes are equal, the fallback is
 * the older convention: the graha with the lower longitude — the one behind
 * in zodiacal order — wins.
 *
 * For the fallback the comparison must be made on the **longitude**, not the degree-in-sign.
 * A war straddling a sign boundary (Mars 29°42' Aries vs Venus 0°12' Taurus,
 * 30' apart) puts the *higher* degInSign on the graha that is actually
 * behind, so a degInSign comparison hands the war to the wrong planet — and
 * `computeShadbala` then transfers the full virupa difference in the wrong
 * direction. Within a single sign the two orderings are identical, so this
 * only changes cross-boundary wars.
 *
 * `PlanetPosition` records one opponent per graha. When three or more fall
 * inside 1°, each records its **nearest** opponent — stable and meaningful,
 * rather than whichever pair the loop happened to visit last.
 */
export function applyGrahaYuddha(planets: PlanetPosition[]): void {
  const taras: PlanetId[] = ["Ma", "Me", "Ju", "Ve", "Sa"];
  const combatants = planets.filter((p) => taras.includes(p.id));
  for (const p of combatants) {
    p.warWith = undefined;
    p.warWinner = undefined;
  }
  for (const a of combatants) {
    let nearest: PlanetPosition | undefined;
    let nearestSep = Infinity;
    for (const b of combatants) {
      if (b.id === a.id) continue;
      const sep = separation(a.longitude, b.longitude);
      if (sep <= 1 && sep < nearestSep) {
        nearest = b;
        nearestSep = sep;
      }
    }
    if (!nearest) continue;
    a.warWith = nearest.id;
    if (a.latitude !== undefined && nearest.latitude !== undefined && a.latitude !== nearest.latitude) {
      // Classical rule: the more northerly graha wins.
      a.warWinner = a.latitude > nearest.latitude;
      continue;
    }
    // Fallback: angleDiff < 0 ⇒ `a` lies behind its opponent in zodiacal
    // order ⇒ `a` wins. Exactly-coincident longitudes are broken by natural
    // planet order so the pair never comes back with two losers.
    const d = angleDiff(a.longitude, nearest.longitude);
    a.warWinner = d < 0 || (d === 0 && PLANETS.indexOf(a.id) < PLANETS.indexOf(nearest.id));
  }
}

export const DIGNITY_LABELS: Record<Dignity, string> = {
  exalted: "Exalted (Uchcha)",
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
