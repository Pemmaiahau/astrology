import type { PlanetId } from "@/utils/astrology/types";

/**
 * What each planet stands for, and what each house governs — in plain English.
 *
 * These are the two middle links of the reasoning chain the interpretation
 * layer is meant to produce (see REDESIGN.md §3b):
 *
 *   [placement] -> [what the planet signifies] -> [what the house governs] -> [therefore]
 *
 * Link 1 comes from the chart, link 4 from the existing 108-entry
 * `planetInHouse.ts` table. Only links 2 and 3 were missing, which is why this
 * file is small: it is the last piece needed to generate the "why" from data
 * rather than writing it out by hand at every call site.
 *
 * `constants.ts` already holds `HOUSE_SIGNIFICATIONS`, but those are keyword
 * lists written for a practitioner ("career, status, authority, karma and
 * public achievement"). What a sentence needs is a short noun phrase that
 * reads naturally mid-clause. Both are kept: the keyword list for tables and
 * headings, the phrase below for prose.
 *
 * Nothing here computes anything, and nothing here is chart-specific — which
 * is what makes the whole set translatable by swapping the file.
 */

export interface Signification {
  /** Fits "X is the planet of ___" / "the Nth house governs ___". */
  phrase: string;
  /** One or two words for a chip, table cell or heading. */
  short: string;
}

/**
 * Planetary significations, in the order a reader meets them. Chosen for the
 * *middle* of a sentence: "Mars is the planet of drive, courage and
 * confrontation" has to read as English, not as a keyword dump.
 *
 * Rahu and Ketu own no sign and are agents rather than rulers, so their
 * phrasing avoids "planet of" language the rest of the set uses comfortably.
 */
export const PLANET_SIGNIFIES: Record<PlanetId, Signification> = {
  Su: { phrase: "authority, confidence and the sense of self", short: "self & authority" },
  Mo: { phrase: "the mind, mood and what makes you feel safe", short: "mind & feeling" },
  Ma: { phrase: "drive, courage and confrontation", short: "drive & courage" },
  Me: { phrase: "thinking, speech, trade and everything written down", short: "thought & speech" },
  Ju: { phrase: "growth, judgement, teaching and good faith", short: "wisdom & growth" },
  Ve: { phrase: "affection, beauty, comfort and give-and-take", short: "love & comfort" },
  Sa: { phrase: "time, limits, patience and earned authority", short: "time & discipline" },
  Ra: { phrase: "hunger, ambition and the pull of the unfamiliar", short: "ambition & the foreign" },
  Ke: { phrase: "detachment, depth and letting go", short: "detachment & depth" },
};

/**
 * What each house governs, indexed 1-12. Written to sit after "governs" or
 * "the house of", so they carry no leading article and no trailing full stop.
 */
export const HOUSE_GOVERNS: Record<number, Signification> = {
  1: { phrase: "your body, your temperament and how you come across", short: "self & body" },
  2: { phrase: "money you keep, family, food and what you say", short: "wealth & family" },
  3: { phrase: "courage, effort, siblings and short journeys", short: "courage & effort" },
  4: { phrase: "home, your mother, land and peace of mind", short: "home & mother" },
  5: { phrase: "children, creativity, study and what you enjoy", short: "children & creativity" },
  6: { phrase: "work you owe others, health, debts and rivals", short: "health & rivals" },
  7: { phrase: "marriage, partnership and everyone you deal with directly", short: "partnership" },
  8: { phrase: "upheaval, inheritance, other people's money and hidden things", short: "upheaval & depth" },
  9: { phrase: "fortune, belief, teachers, your father and long journeys", short: "fortune & belief" },
  10: { phrase: "career, status and how the public sees you", short: "career & status" },
  11: { phrase: "income, gains, friends and what you hope for", short: "income & gains" },
  12: { phrase: "expenditure, sleep, foreign places and what happens out of sight", short: "loss & retreat" },
};

/**
 * Plain-English names for the twelve houses — for headings and tabs, where
 * "10th House" tells a first-time reader nothing at all.
 */
export const HOUSE_TITLES: Record<number, string> = {
  1: "Self & Body",
  2: "Wealth & Family",
  3: "Courage & Effort",
  4: "Home & Mother",
  5: "Children & Creativity",
  6: "Health & Rivals",
  7: "Marriage & Partnership",
  8: "Upheaval & Depth",
  9: "Fortune & Belief",
  10: "Career & Reputation",
  11: "Income & Gains",
  12: "Loss & Retreat",
};

/** Dignity in plain words, with the strength band it implies. */
export const DIGNITY_PLAIN: Record<
  string,
  { phrase: string; band: "strong" | "moderate" | "weak" }
> = {
  exalted: { phrase: "is exceptionally well placed", band: "strong" },
  moolatrikona: { phrase: "sits in its own favourite sign", band: "strong" },
  own: { phrase: "sits in its own sign", band: "strong" },
  greatFriend: { phrase: "sits in a close ally's sign", band: "moderate" },
  friend: { phrase: "sits in a friendly sign", band: "moderate" },
  neutral: { phrase: "sits in a neutral sign", band: "moderate" },
  enemy: { phrase: "is uncomfortably placed", band: "weak" },
  greatEnemy: { phrase: "is badly placed", band: "weak" },
  debilitated: { phrase: "is at its weakest", band: "weak" },
};
