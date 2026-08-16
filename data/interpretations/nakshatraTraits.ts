import { NAKSHATRAS } from "@/utils/astrology/constants";

/**
 * Shared nakshatra character tables for the Speculation and Intimacy sections.
 *
 * Three layers live here, and they do NOT have the same evidential standing —
 * the distinction is deliberate and is repeated in `SOURCES.md`:
 *
 *  1. **Yoni (animal) per nakshatra, and the yoni's sex** — classical. The
 *     27-row assignment and the seven enemy-yoni pairs come from the Yoni-kuta
 *     limb of the ashtakuta matching scheme (Muhurta Chintamani / Jataka
 *     Parijata tradition; the same table is reproduced across the standard
 *     matching literature). Rows verified against that published table.
 *  2. **Gana (Deva / Manushya / Rakshasa)** — classical. Standard
 *     nakshatra taxonomy, also an ashtakuta limb.
 *  3. **The `speculation`, `sensual` and `appetite` columns** — **modern
 *     synthesis.** No classical text assigns a trading temperament to a
 *     nakshatra, and none ranks nakshatras by libido. These strings are read
 *     off each nakshatra's classical symbol, deity, dispositor and published
 *     quality (the same material `NAKSHATRA_QUALITIES` in `constants.ts`
 *     summarises), then written for the two subjects at hand. `appetite` is
 *     derived from the yoni's size/vigour ordering used in Yoni-kuta scoring
 *     rather than asserted per nakshatra — see the disagreement log.
 *
 * Pure data + tiny lookups: no astronomy, no chart access, no `Date.now()`.
 */

export type Yoni =
  | "horse" | "elephant" | "goat" | "serpent" | "dog" | "cat" | "rat"
  | "cow" | "buffalo" | "tiger" | "deer" | "monkey" | "mongoose" | "lion";

export type Gana = "Deva" | "Manushya" | "Rakshasa";

/** How much drive the yoni class classically carries, as appetite language. */
export type Appetite = "high" | "moderate" | "reserved";

export interface YoniInfo {
  label: string;
  /**
   * The single classical enemy yoni. The seven pairs are horse–buffalo,
   * elephant–lion, goat–monkey, serpent–mongoose, dog–deer, cat–rat and
   * cow–tiger; the relation is symmetric, so this map is its own inverse.
   */
  enemy: Yoni;
  /**
   * Modern synthesis: the classical Yoni-kuta ordering grades these animals by
   * size and vigour, and that ordering is what is being read here as appetite.
   * The ordering is classical; calling it "appetite" is this app's reading.
   */
  appetite: Appetite;
  /** Physical style and pace — modern synthesis over the same ordering. */
  style: string;
}

export const YONI_INFO: Record<Yoni, YoniInfo> = {
  horse: {
    label: "horse", enemy: "buffalo", appetite: "high",
    style: "quick to arousal, restless, better with movement and spontaneity than with ceremony",
  },
  elephant: {
    label: "elephant", enemy: "lion", appetite: "high",
    style: "slow to start and very slow to finish; weight, endurance and physical closeness matter more than novelty",
  },
  goat: {
    label: "goat", enemy: "monkey", appetite: "moderate",
    style: "willing and adaptable, led more by affection than by urgency",
  },
  serpent: {
    label: "serpent", enemy: "mongoose", appetite: "high",
    style: "intense, coiled and slow-burning; magnetism carried in stillness rather than display",
  },
  dog: {
    label: "dog", enemy: "deer", appetite: "moderate",
    style: "loyal, physically demonstrative, and thrown badly by being ignored",
  },
  cat: {
    label: "cat", enemy: "rat", appetite: "reserved",
    style: "selective and self-contained; needs to want it first, and does not perform on request",
  },
  rat: {
    label: "rat", enemy: "cat", appetite: "reserved",
    style: "quick, frequent and low-ceremony; appetite arrives in short bursts rather than long arcs",
  },
  cow: {
    label: "cow", enemy: "tiger", appetite: "moderate",
    style: "warm, unhurried and comfort-led; safety is the precondition, not the reward",
  },
  buffalo: {
    label: "buffalo", enemy: "horse", appetite: "high",
    style: "strong, deliberate and stubborn; slow to be moved and slow to let go",
  },
  tiger: {
    label: "tiger", enemy: "cow", appetite: "high",
    style: "forceful and possessive, with a real taste for the chase and for being wanted visibly",
  },
  deer: {
    label: "deer", enemy: "dog", appetite: "reserved",
    style: "sensitive, easily startled, and at its best when nothing is being demanded",
  },
  monkey: {
    label: "monkey", enemy: "goat", appetite: "moderate",
    style: "playful, inventive and easily bored; variety does more for it than intensity",
  },
  mongoose: {
    label: "mongoose", enemy: "serpent", appetite: "moderate",
    style: "alert and defensive; opens slowly, and only where it trusts",
  },
  lion: {
    label: "lion", enemy: "elephant", appetite: "high",
    style: "proud and initiating; wants to be admired in the act, not merely accepted",
  },
};

export interface NakshatraTrait {
  /** 0–26, index into `NAKSHATRAS`. */
  index: number;
  name: string;
  /** Classical (Yoni-kuta table). */
  yoni: Yoni;
  /** Classical (Yoni-kuta table). */
  yoniSex: "male" | "female";
  /** Classical (ashtakuta gana taxonomy). */
  gana: Gana;
  /** Modern synthesis — character for speculative activity. */
  speculation: string;
  /** Modern synthesis — sensual and relational character. */
  sensual: string;
}

/**
 * The 27 rows. Yoni animal + sex and gana are the classical columns; the two
 * prose columns are this app's synthesis (see the module note above).
 *
 * Note on the table's own asymmetry: `mongoose` occurs exactly once
 * (Uttara Ashadha) while `serpent` occurs twice, so the mongoose has no
 * same-yoni counterpart anywhere in the scheme. That is a property of the
 * classical table, not a transcription error, and it is left as it stands.
 */
export const NAKSHATRA_TRAITS: NakshatraTrait[] = [
  {
    index: 0, name: NAKSHATRAS[0], yoni: "horse", yoniSex: "male", gana: "Deva",
    speculation: "fast in and faster out — opens on impulse, and is right often enough to keep doing it",
    sensual: "quick to kindle, physically direct, and happier starting something than settling into it",
  },
  {
    index: 1, name: NAKSHATRAS[1], yoni: "elephant", yoniSex: "male", gana: "Manushya",
    speculation: "carries heavy positions and heavy drawdowns; this star deals in extremes, not averages",
    sensual: "strong appetite with real weight behind it — desire here is a force to be managed rather than coaxed",
  },
  {
    index: 2, name: NAKSHATRAS[2], yoni: "goat", yoniSex: "female", gana: "Rakshasa",
    speculation: "cuts losers cleanly and without sentiment; sharp on entry, unbothered about having been wrong",
    sensual: "hot and critical at once — attraction burns quickly and judges quickly, sometimes in the same evening",
  },
  {
    index: 3, name: NAKSHATRAS[3], yoni: "serpent", yoniSex: "male", gana: "Manushya",
    speculation: "wealth-attracting and patient; accumulation suits it far better than churn does",
    sensual: "the most straightforwardly sensual star in the set — magnetic, tactile, and drawn to beauty and comfort",
  },
  {
    index: 4, name: NAKSHATRAS[4], yoni: "serpent", yoniSex: "female", gana: "Deva",
    speculation: "searches restlessly for the next setup; excellent at scouting, poor at sitting still",
    sensual: "curious and pursuit-led; the seeking is part of the pleasure, and satisfaction rarely ends the search",
  },
  {
    index: 5, name: NAKSHATRAS[5], yoni: "dog", yoniSex: "female", gana: "Manushya",
    speculation: "storm and volatility — thrives exactly where prices break and most accounts do not",
    sensual: "intense and turbulent; desire runs close to emotion here, and neither is quiet",
  },
  {
    index: 6, name: NAKSHATRAS[6], yoni: "cat", yoniSex: "female", gana: "Deva",
    speculation: "recovers and re-enters after loss; the return trade is where this star's money actually is",
    sensual: "affectionate and forgiving — comes back, repairs, and treats intimacy as something renewable",
  },
  {
    index: 7, name: NAKSHATRAS[7], yoni: "goat", yoniSex: "male", gana: "Deva",
    speculation: "nourishing and steady: superb for long accumulation, genuinely poor for gambling",
    sensual: "warm, dutiful and slow-building; intimacy deepens through care rather than through heat",
  },
  {
    index: 8, name: NAKSHATRAS[8], yoni: "cat", yoniSex: "male", gana: "Rakshasa",
    speculation: "cunning and entwining — strong at reading intent, and exposed to deceptive setups",
    sensual: "hypnotic and strategic; attraction here is a game of proximity and withdrawal, played well",
  },
  {
    index: 9, name: NAKSHATRAS[9], yoni: "rat", yoniSex: "male", gana: "Rakshasa",
    speculation: "trades on legacy and on size; pride is the expensive part of this placement",
    sensual: "proud and appetite-led, with a strong pull toward being admired by whoever is in the room",
  },
  {
    index: 10, name: NAKSHATRAS[10], yoni: "rat", yoniSex: "female", gana: "Manushya",
    speculation: "money as enjoyment — profits tend to leave about as quickly as they arrive",
    sensual: "openly pleasure-seeking and playful; this is the star of enjoyment, and it does not apologise for it",
  },
  {
    index: 11, name: NAKSHATRAS[11], yoni: "cow", yoniSex: "male", gana: "Manushya",
    speculation: "contract-minded and steady; regular income beats speculation for this star, by some distance",
    sensual: "companionable and loyal — the arrangement matters as much as the attraction does",
  },
  {
    index: 12, name: NAKSHATRAS[12], yoni: "buffalo", yoniSex: "female", gana: "Deva",
    speculation: "skilled hands and quick execution; craft carries this one further than conviction does",
    sensual: "tactile and skilful, attentive to what a partner actually responds to rather than to theory",
  },
  {
    index: 13, name: NAKSHATRAS[13], yoni: "tiger", yoniSex: "female", gana: "Rakshasa",
    speculation: "builds a beautiful thesis and then defends it for too long",
    sensual: "visually charged and strongly drawn to beauty; attraction starts with the eyes and stays there",
  },
  {
    index: 14, name: NAKSHATRAS[14], yoni: "buffalo", yoniSex: "male", gana: "Deva",
    speculation: "the independent merchant — trades its own book and dislikes being told anything",
    sensual: "needs room; closeness works here only when it does not feel like confinement",
  },
  {
    index: 15, name: NAKSHATRAS[15], yoni: "tiger", yoniSex: "male", gana: "Rakshasa",
    speculation: "twin-goal determination; holds through pain to reach a number it has already decided on",
    sensual: "ardent and goal-directed — pursues deliberately, and rarely loses interest halfway",
  },
  {
    index: 16, name: NAKSHATRAS[16], yoni: "deer", yoniSex: "female", gana: "Deva",
    speculation: "gains through alliance and discipline: the syndicate rather than the lone bet",
    sensual: "devoted and slow to open, with real depth once it does; friendship and desire run together here",
  },
  {
    index: 17, name: NAKSHATRAS[17], yoni: "deer", yoniSex: "male", gana: "Rakshasa",
    speculation: "authority won through trials — sharp, guarded, and prone to wanting control of the position",
    sensual: "intense and protective, with a streak of possessiveness that reads as passion from the inside",
  },
  {
    index: 18, name: NAKSHATRAS[18], yoni: "dog", yoniSex: "male", gana: "Rakshasa",
    speculation: "root-destruction: dangerous to capital, and unusually good at finding what is rotten",
    sensual: "goes to the root of things, including in intimacy; attachments here are rarely casual and rarely tidy",
  },
  {
    index: 19, name: NAKSHATRAS[19], yoni: "monkey", yoniSex: "male", gana: "Manushya",
    speculation: "early invincible runs, with overconfidence as the tax collected later",
    sensual: "exuberant and confident, drawn to pleasure without much guilt attached to it",
  },
  {
    index: 20, name: NAKSHATRAS[20], yoni: "mongoose", yoniSex: "female", gana: "Manushya",
    speculation: "later, lasting victory — patient positions outperform quick ones here, consistently",
    sensual: "reserved at first and durable afterwards; this star commits slowly and then stays",
  },
  {
    index: 21, name: NAKSHATRAS[21], yoni: "monkey", yoniSex: "female", gana: "Deva",
    speculation: "listens and learns; excellent at gathering information, weaker at acting on conviction",
    sensual: "responsive to words and to being heard — conversation is genuinely part of the foreplay here",
  },
  {
    index: 22, name: NAKSHATRAS[22], yoni: "lion", yoniSex: "female", gana: "Rakshasa",
    speculation: "wealth-attracting rhythm; timing and tempo are this star's real edge",
    sensual: "rhythmic and performative, with strong physical confidence and a taste for being watched",
  },
  {
    index: 23, name: NAKSHATRAS[23], yoni: "horse", yoniSex: "female", gana: "Rakshasa",
    speculation: "veiled and esoteric instruments; the unregulated corner of a market suits it unusually well",
    sensual: "private and unconventional — desire runs deep and mostly out of sight of other people",
  },
  {
    index: 24, name: NAKSHATRAS[24], yoni: "lion", yoniSex: "male", gana: "Manushya",
    speculation: "intensity behind an austere face: extreme positions, and correspondingly extreme outcomes",
    sensual: "fierce and two-sided — ascetic restraint and sudden intensity living in the same person",
  },
  {
    index: 25, name: NAKSHATRAS[25], yoni: "cow", yoniSex: "female", gana: "Manushya",
    speculation: "deep-water patience; slow, profound, and very hard to shake out of a position",
    sensual: "gentle, deep and unhurried; this star is content in long intimacy and poor at short ones",
  },
  {
    index: 26, name: NAKSHATRAS[26], yoni: "elephant", yoniSex: "female", gana: "Deva",
    speculation: "safe passage and gentle endings — protects capital considerably better than it grows it",
    sensual: "tender, imaginative and merging; desire here is romantic before it is physical",
  },
];

/** Trait row for a nakshatra index (0–26). */
export function traitOf(nakshatra: number): NakshatraTrait {
  return NAKSHATRA_TRAITS[((nakshatra % 27) + 27) % 27];
}

/** The classical enemy yoni of a nakshatra's yoni. */
export function enemyYoniOf(nakshatra: number): Yoni {
  return YONI_INFO[traitOf(nakshatra).yoni].enemy;
}

/** Every nakshatra whose yoni clashes with the given nakshatra's yoni. */
export function clashingNakshatras(nakshatra: number): NakshatraTrait[] {
  const enemy = enemyYoniOf(nakshatra);
  return NAKSHATRA_TRAITS.filter((t) => t.yoni === enemy);
}

/** Appetite tier carried by a nakshatra's yoni (modern synthesis — see above). */
export function appetiteOf(nakshatra: number): Appetite {
  return YONI_INFO[traitOf(nakshatra).yoni].appetite;
}

/**
 * Gandanta — the "knot" at a water/fire sign junction: the last pada of
 * Ashlesha, Jyeshtha or Revati, and the first pada of Magha, Mula or Ashwini.
 * Classical (BPHS / Muhurta literature); read here as difficulty to work with,
 * never as doom.
 */
const GANDANTA_END = [8, 17, 26]; // Ashlesha, Jyeshtha, Revati
const GANDANTA_START = [9, 18, 0]; // Magha, Mula, Ashwini

export function isGandanta(nakshatra: number, pada: number): boolean {
  return (
    (GANDANTA_END.includes(nakshatra) && pada === 4) ||
    (GANDANTA_START.includes(nakshatra) && pada === 1)
  );
}

/** Human phrasing of the gana temperament, used by the intimacy reading. */
export const GANA_TEMPERAMENT: Record<Gana, string> = {
  Deva: "gentle and refined in temperament — you tend to want intimacy to feel considerate, and you withdraw from coarseness rather than confront it.",
  Manushya: "mixed and negotiable in temperament — appetite and restraint take turns with you, and both are genuine.",
  Rakshasa: "intense and unapologetic in temperament — you carry a stronger, blunter charge than the people around you usually expect, and pretending otherwise costs you.",
};
