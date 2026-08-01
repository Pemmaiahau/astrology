import type { PlanetId } from "./types";

export const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export const SIGNS_SANSKRIT = [
  "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
  "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena",
];

export const PLANETS: PlanetId[] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa", "Ra", "Ke"];

export const PLANET_NAMES: Record<PlanetId, string> = {
  Su: "Sun", Mo: "Moon", Ma: "Mars", Me: "Mercury", Ju: "Jupiter",
  Ve: "Venus", Sa: "Saturn", Ra: "Rahu", Ke: "Ketu",
};

export const PLANET_SANSKRIT: Record<PlanetId, string> = {
  Su: "Surya", Mo: "Chandra", Ma: "Mangala", Me: "Budha", Ju: "Guru",
  Ve: "Shukra", Sa: "Shani", Ra: "Rahu", Ke: "Ketu",
};

/** Sign lords, Aries → Pisces */
export const SIGN_LORDS: PlanetId[] = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];

export const NAKSHATRAS = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];

const LORD_CYCLE: PlanetId[] = ["Ke", "Ve", "Su", "Mo", "Ma", "Ra", "Ju", "Sa", "Me"];
export const NAKSHATRA_LORDS: PlanetId[] = [...LORD_CYCLE, ...LORD_CYCLE, ...LORD_CYCLE];

export const DASHA_YEARS: Record<PlanetId, number> = {
  Ke: 7, Ve: 20, Su: 6, Mo: 10, Ma: 7, Ra: 18, Ju: 16, Sa: 19, Me: 17,
};
export const DASHA_SEQUENCE: PlanetId[] = ["Ke", "Ve", "Su", "Mo", "Ma", "Ra", "Ju", "Sa", "Me"];

export const EXALTATION: Record<PlanetId, { sign: number; deg: number } | null> = {
  Su: { sign: 0, deg: 10 },
  Mo: { sign: 1, deg: 3 },
  Ma: { sign: 9, deg: 28 },
  Me: { sign: 5, deg: 15 },
  Ju: { sign: 3, deg: 5 },
  Ve: { sign: 11, deg: 27 },
  Sa: { sign: 6, deg: 20 },
  Ra: { sign: 1, deg: 20 },
  Ke: { sign: 7, deg: 20 },
};

export const MOOLATRIKONA: Partial<Record<PlanetId, { sign: number; from: number; to: number }>> = {
  Su: { sign: 4, from: 0, to: 20 },
  Mo: { sign: 1, from: 3, to: 30 },
  Ma: { sign: 0, from: 0, to: 12 },
  Me: { sign: 5, from: 15, to: 20 },
  Ju: { sign: 8, from: 0, to: 10 },
  Ve: { sign: 6, from: 0, to: 15 },
  Sa: { sign: 10, from: 0, to: 20 },
};

export const OWN_SIGNS: Record<PlanetId, number[]> = {
  Su: [4], Mo: [3], Ma: [0, 7], Me: [2, 5], Ju: [8, 11], Ve: [1, 6], Sa: [9, 10], Ra: [], Ke: [],
};

/** Naisargika (natural) relationships per Parashara */
export const NATURAL_FRIENDS: Record<PlanetId, PlanetId[]> = {
  Su: ["Mo", "Ma", "Ju"],
  Mo: ["Su", "Me"],
  Ma: ["Su", "Mo", "Ju"],
  Me: ["Su", "Ve"],
  Ju: ["Su", "Mo", "Ma"],
  Ve: ["Me", "Sa"],
  Sa: ["Me", "Ve"],
  Ra: ["Me", "Ve", "Sa"],
  Ke: ["Ma", "Ve", "Sa"],
};

export const NATURAL_ENEMIES: Record<PlanetId, PlanetId[]> = {
  Su: ["Ve", "Sa"],
  Mo: [],
  Ma: ["Me"],
  Me: ["Mo"],
  Ju: ["Me", "Ve"],
  Ve: ["Su", "Mo"],
  Sa: ["Su", "Mo", "Ma"],
  Ra: ["Su", "Mo", "Ma"],
  Ke: ["Su", "Mo"],
};

/** Combustion orbs in degrees of separation from the Sun */
export const COMBUSTION_ORBS: Partial<Record<PlanetId, { direct: number; retro: number }>> = {
  Mo: { direct: 12, retro: 12 },
  Ma: { direct: 17, retro: 17 },
  Me: { direct: 14, retro: 12 },
  Ju: { direct: 11, retro: 11 },
  Ve: { direct: 10, retro: 8 },
  Sa: { direct: 15, retro: 15 },
};

export const TITHI_NAMES = [
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
  "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
  "Trayodashi", "Chaturdashi", "Purnima",
  "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami", "Shashthi",
  "Saptami", "Ashtami", "Navami", "Dashami", "Ekadashi", "Dwadashi",
  "Trayodashi", "Chaturdashi", "Amavasya",
];

export const YOGA_NAMES = [
  "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda",
  "Sukarma", "Dhriti", "Shula", "Ganda", "Vriddhi", "Dhruva",
  "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan",
  "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla",
  "Brahma", "Indra", "Vaidhriti",
];

export const MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
export const FIXED_KARANAS = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"];

export const VARA_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const VARA_LORDS: PlanetId[] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"];

export const HOUSE_SIGNIFICATIONS: string[] = [
  "self, body, vitality, temperament and the overall direction of life",
  "wealth, family, speech, food and accumulated resources",
  "courage, siblings, communication, skills and self-effort",
  "home, mother, emotional foundations, property and inner contentment",
  "intelligence, children, creativity, romance and purva-punya (past merit)",
  "health, debts, enemies, service, litigation and daily discipline",
  "marriage, partnerships, business alliances and public dealings",
  "longevity, transformation, inheritance, occult depth and sudden events",
  "fortune, dharma, higher learning, the guru, father and long journeys",
  "career, status, authority, karma and public achievement",
  "gains, income, networks, elder siblings and fulfilment of desires",
  "expenditure, losses, foreign lands, isolation, sleep and moksha",
];

// ---------------------------------------------------------------------------
// Shadbala / varga / classification tables (BPHS unless noted)
// ---------------------------------------------------------------------------

/** The seven Shadbala grahas (nodes take no Shadbala). */
export type PlanetId7 = "Su" | "Mo" | "Ma" | "Me" | "Ju" | "Ve" | "Sa";
export const SHADBALA_PLANETS: PlanetId7[] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"];

/**
 * Naisargika (natural) bala in virupas — BPHS Ch. on Shadbala: fixed ladder
 * Saturn weakest → Sun strongest, each step 60/7 virupas.
 */
export const NAISARGIKA_BALA: Record<PlanetId7, number> = {
  Su: 60, Mo: 51.43, Ve: 42.86, Ju: 34.29, Me: 25.71, Ma: 17.14, Sa: 8.57,
};

/**
 * Planetary gender per BPHS Ch.3 (graha characteristics). Drekkana bala:
 * male strong in 1st decanate, female in 2nd, neuter in 3rd.
 * Rahu/Ketu attributions are the common tradition (not used by Shadbala).
 */
export const PLANET_GENDER: Record<PlanetId, "male" | "female" | "neuter"> = {
  Su: "male", Ma: "male", Ju: "male",
  Mo: "female", Ve: "female", Ra: "female",
  Me: "neuter", Sa: "neuter", Ke: "neuter",
};

/**
 * Nathonnatha bala: diurnal planets are strong at midday, nocturnal at
 * midnight; Mercury is always strong (gets the full 60).
 */
export const DIURNAL_PLANETS: PlanetId7[] = ["Su", "Ju", "Ve"];
export const NOCTURNAL_PLANETS: PlanetId7[] = ["Mo", "Ma", "Sa"];

/** Odd (male) signs: Aries, Gemini, Leo, Libra, Sagittarius, Aquarius. */
export function isOddSign(sign: number): boolean {
  return sign % 2 === 0;
}

/** Movable (chara) / fixed (sthira) / dual (dvisvabhava) — BPHS Ch.4. */
export function signMobility(sign: number): "movable" | "fixed" | "dual" {
  const m = sign % 3;
  return m === 0 ? "movable" : m === 1 ? "fixed" : "dual";
}

/**
 * Minimum required total Shadbala in virupas (BPHS: 6.5/6/5/7/6.5/5.5/5 rupas).
 * A planet at or above its requirement is deemed strong enough to protect
 * its significations.
 */
export const SHADBALA_MINIMUM: Record<PlanetId7, number> = {
  Su: 390, Mo: 360, Ma: 300, Me: 420, Ju: 390, Ve: 330, Sa: 300,
};

/**
 * Mean daily motion in degrees/day. For Mercury and Venus these are the
 * seeghrocca (heliocentric mean) rates used by the Cheshta bala calculation;
 * for the Sun/Moon they are the mean geocentric rates.
 */
export const MEAN_DAILY_MOTION: Record<PlanetId7, number> = {
  Su: 0.9856, Mo: 13.1764, Ma: 0.5240, Me: 4.0923, Ju: 0.0831, Ve: 1.6021, Sa: 0.0335,
};

// ---------------------------------------------------------------------------
// Lucky number / colour / direction tables (numerology + Jyotisha convention)
// ---------------------------------------------------------------------------

/**
 * Classical 1–9 planetary rulership of numbers (Cheiro/Vedic numerology
 * convention): 1 Sun, 2 Moon, 3 Jupiter, 4 Rahu, 5 Mercury, 6 Venus,
 * 7 Ketu, 8 Saturn, 9 Mars.
 */
export const PLANET_NUMBER: Record<PlanetId, number> = {
  Su: 1, Mo: 2, Ju: 3, Ra: 4, Me: 5, Ve: 6, Ke: 7, Sa: 8, Ma: 9,
};

/**
 * Digpati (lords of the directions) — the standard Vastu/Jyotisha scheme:
 * Sun E, Venus SE, Mars S, Rahu SW, Saturn W, Moon NW, Mercury N, Jupiter NE.
 * Ketu has no direction seat in this scheme (often given SW with Rahu).
 */
export const PLANET_DIRECTION: Partial<Record<PlanetId, string>> = {
  Su: "East", Ve: "South-East", Ma: "South", Ra: "South-West",
  Sa: "West", Mo: "North-West", Me: "North", Ju: "North-East",
};

/** Classical colour associations (BPHS Ch.3 graha complexions + tradition). */
export const PLANET_COLOURS: Record<PlanetId, { primary: string; supporting: string[] }> = {
  Su: { primary: "copper-red / orange", supporting: ["saffron", "gold"] },
  Mo: { primary: "white", supporting: ["cream", "silver", "pearl"] },
  Ma: { primary: "red", supporting: ["scarlet", "coral"] },
  Me: { primary: "green", supporting: ["emerald", "light green"] },
  Ju: { primary: "yellow", supporting: ["gold", "cream-yellow"] },
  Ve: { primary: "white / pastel", supporting: ["silver", "light blue", "pink"] },
  Sa: { primary: "dark blue / black", supporting: ["navy", "iron grey"] },
  Ra: { primary: "smoky grey", supporting: ["electric blue", "dark shades"] },
  Ke: { primary: "variegated / grey", supporting: ["brown", "multi-colour"] },
};

/** Classical gemstones (informational only — not a prescription). */
export const PLANET_GEMSTONES: Record<PlanetId, string> = {
  Su: "Ruby (Manikya)", Mo: "Pearl (Moti)", Ma: "Red Coral (Moonga)",
  Me: "Emerald (Panna)", Ju: "Yellow Sapphire (Pukhraj)", Ve: "Diamond (Heera)",
  Sa: "Blue Sapphire (Neelam)", Ra: "Hessonite (Gomed)", Ke: "Cat's Eye (Lehsunia)",
};

/**
 * Chaldean name-number letter values. Chaldean assigns no letter to 9
 * (the number was held sacred); values run 1–8 only.
 */
export const CHALDEAN_MAP: Record<string, number> = {
  A: 1, I: 1, J: 1, Q: 1, Y: 1,
  B: 2, K: 2, R: 2,
  C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4,
  E: 5, H: 5, N: 5, X: 5,
  U: 6, V: 6, W: 6,
  O: 7, Z: 7,
  F: 8, P: 8,
};

/** Pythagorean letter values: A=1 … I=9, repeating. */
export const PYTHAGOREAN_MAP: Record<string, number> = Object.fromEntries(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch, i) => [ch, (i % 9) + 1])
);

export const NAKSHATRA_QUALITIES: string[] = [
  "swift, pioneering, healing energy; initiates with speed and freshness",
  "intense, transformative bearing; carries burdens and creative extremes",
  "sharp, purifying fire; cuts through falsehood, ambitious and critical",
  "magnetic, sensual growth; fertile creativity and material fascination",
  "restless, searching mind; gentle curiosity that seeks the finer trail",
  "stormy, penetrating intellect; breakthroughs after inner turbulence",
  "renewing optimism; recovers, returns and rebuilds with wisdom",
  "nourishing, dutiful, deeply auspicious; grows what it protects",
  "coiled, hypnotic insight; strategy, secrecy and kundalini intensity",
  "regal ancestral pride; commands, honours lineage, seeks throne-room respect",
  "pleasure-loving warmth; charm, patronage and creative enjoyment",
  "contractual grace; balances generosity with prudent alliance",
  "deft, industrious hands; skilled craft and practical cleverness",
  "brilliant, architectural vision; polishes form into beauty",
  "independent, wind-borne flexibility; scatters then finds its own path",
  "goal-fixated determination; twin ambitions pursued with fervour",
  "loyal, disciplined devotion; friendship as a spiritual force",
  "eldest-born intensity; protective authority won through trials",
  "root-cutting inquiry; destroys to find foundational truth",
  "invincible early victories; proud, philosophical, water-blessed",
  "later, lasting victory; patient universal ambition",
  "attentive listening; learning, fame and connective intelligence",
  "abundant rhythm; music, wealth and adaptive movement",
  "veiled healing; solitary depths, mysticism and medicine",
  "fiery twin-front transformation; intensity behind an austere face",
  "deep-sea serenity; wisdom raised from the depths, slow and profound",
  "nourishing completion; safe passage, prosperity and gentle endings",
];
