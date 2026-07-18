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
