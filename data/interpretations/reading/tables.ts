import type { PlanetId } from "@/utils/astrology/types";

/**
 * Short curated tables the report needs and the rest of the app did not
 * have. Second person, one sentence or phrase each, written to slot into a
 * bullet. Sign and planet descriptions follow the standard classical
 * attributions (BPHS Ch. 4 for signs, Ch. 3 for planets; Phaladeepika for
 * the Lagna-lord placements; Jaimini Upadesa 1.2 for the Karakamsa grahas).
 */

/** Adjective triplets for a planet's sign — "humanitarian, progressive and unconventional". */
export const SIGN_TONE: string[] = [
  "bold, direct and pioneering",
  "steady, sensual and practical",
  "curious, communicative and versatile",
  "protective, emotional and nurturing",
  "proud, generous and authoritative",
  "analytical, precise and service-minded",
  "balanced, diplomatic and aesthetic",
  "intense, private and probing",
  "principled, expansive and philosophical",
  "disciplined, ambitious and patient",
  "humanitarian, progressive and slightly unconventional",
  "compassionate, intuitive and spiritual",
];

/** The shadow side of each rising sign. */
export const LAGNA_SHADOW: string[] = [
  "impatience, a quick temper, and starting more than you finish",
  "stubbornness, possessiveness and resisting change past the point it helps",
  "restlessness, scattered focus and saying more than you mean",
  "moodiness, over-protectiveness and holding on to old hurt",
  "pride, a need for recognition and a tendency to dominate the room",
  "over-criticism, worry and perfectionism that delays finishing",
  "indecision, people-pleasing and avoiding conflict until it is late",
  "suspicion, secrecy and holding grudges",
  "bluntness, over-promising and impatience with detail",
  "rigidity, pessimism and overwork",
  "detachment, a contrarian streak and emotional distance",
  "escapism, unclear boundaries and absorbing other people's moods",
];

/** Classical physique and the body area each rising sign governs. */
export const LAGNA_PHYSIQUE: string[] = [
  "a lean, energetic build and a prominent head or forehead; the head is the sensitive area — headaches, fevers, minor knocks",
  "a sturdy frame, strong neck and shoulders, a pleasant face and voice; the throat and neck are the sensitive area",
  "a tall, slim, youthful frame with expressive hands; nerves, lungs and the shoulders are the sensitive areas",
  "a medium frame with a rounded face and weight that fluctuates; the chest, stomach and fluid balance are sensitive",
  "a broad chest and commanding presence with strong bones; the heart, spine and back are the sensitive areas",
  "a slim, neat, youthful look; digestion, the intestines and nervous tension are the sensitive areas",
  "well-proportioned, attractive and balanced features; the kidneys and lower back are sensitive",
  "a compact frame with intense eyes and a magnetic presence; reproductive and eliminative systems are sensitive",
  "a tall, athletic frame with long limbs and an open face; the hips, thighs and liver are sensitive",
  "a lean, bony frame that can look older when young and younger later; knees, joints, teeth and skin are sensitive",
  "a tall or distinctive look, often slightly unconventional; the calves, ankles and circulation are sensitive",
  "soft features, expressive eyes, a medium frame; the feet, sleep and fluid balance are sensitive",
];

/** What a planet in the 1st house adds to the body and look. */
export const PLANET_ON_LAGNA_BODY: Record<PlanetId, string> = {
  Su: "strong bones, a commanding presence, and sensitivity to heat and the eyes",
  Mo: "soft, rounded features, a pleasant face and weight that changes with mood",
  Ma: "an active, well-built constitution, a sharp or striking face, possibly a mark or scar on the head or face, and proneness to heat-related problems such as headaches, inflammation and minor injuries",
  Me: "a youthful, quick and expressive manner that keeps you looking younger than your age",
  Ju: "a fuller, dignified frame that tends to gain weight with age; the liver needs watching",
  Ve: "attractiveness, grace and a good complexion; you care about how you look",
  Sa: "a lean or serious look, appearing older early; joints, teeth and stamina need care",
  Ra: "an unusual or striking look, and health puzzles that are hard to diagnose",
  Ke: "thin or marked features, possibly a scar, and sudden health episodes that pass as quickly as they come",
};

/** The Lagna lord's house — where your life force goes. */
export const LAGNA_LORD_IN_HOUSE: string[] = [
  "You are your own centre of gravity: self-reliant, with a strong constitution, and your life is shaped mostly by your own decisions.",
  "Your life orients around wealth, family and speech: you build security steadily, your words carry weight, and family values shape you.",
  "You are self-made. Your life improves through your own effort, initiative, communication and skills rather than inheritance or luck, and siblings and short travels matter.",
  "Home, your mother, property and inner peace are central; you do best with a secure base and tend to gain land or vehicles.",
  "Intelligence, creativity and children are central; you think well, enjoy learning, and past merit supports you.",
  "You fight your way up: service, competition and problem-solving define you; health and debts need managing, and you beat rivals through persistence.",
  "Your life orients around partners and the public: marriage and alliances shape your path, and you do well dealing directly with people.",
  "Your life moves through transformation: sudden changes, research, hidden matters and other people's resources; resilience grows with each upheaval.",
  "You are fortunate and principled: luck, teachers, your father and higher learning support you, and dharma guides your choices.",
  "Your life is career-defined: status and public work are central, and you rise through responsibility and visible achievement.",
  "You are gain-oriented: friends, networks and income streams come readily, and most ambitions are fulfilled.",
  "Your life pulls toward foreign places, retreat and spirituality; expenses run high and you do your best work away from the spotlight.",
];

/** Jaimini: what a graha in the Karakamsa (in the Navamsa) points to. */
export const KARAKAMSA_PLANET: Record<PlanetId, string> = {
  Su: "work connected with government or authority, and a soul that wants recognition for principle",
  Mo: "public life, learning and a caring, popular nature",
  Ma: "courage, technical or protective skills, and work with fire, metals or machinery",
  Me: "skill with trade, crafts, writing and the arts",
  Ju: "learning, ethics, and a capacity for teaching or counselling, with a spiritual inclination",
  Ve: "artistic refinement, comfort, and influence through charm, often close to authority",
  Sa: "a reputation built through long effort and service, with recognition that comes later",
  Ra: "unconventional knowledge — technology, medicine, foreign or hidden skills",
  Ke: "spiritual depth, intuition and detachment, oriented toward liberation",
};

/** The body areas each planet governs, for the health part. */
export const PLANET_BODY: Record<PlanetId, string> = {
  Su: "the heart, eyes, bones and overall vitality",
  Mo: "the mind, sleep, chest and body fluids",
  Ma: "blood, muscles, inflammation, injuries and surgery",
  Me: "the nerves, skin, speech and lungs",
  Ju: "the liver, fat metabolism and blood sugar",
  Ve: "the kidneys, reproductive system and hormones",
  Sa: "joints, teeth, chronic conditions and fatigue",
  Ra: "unusual or hard-to-diagnose conditions, toxins and anxiety",
  Ke: "sudden or viral episodes, surgeries and scars",
};

/** How a weak mind-planet shows (Mercury) — used in the intellect section. */
export const MERCURY_WEAK =
  "Your thinking is intuitive and emotional rather than coldly logical. You can be indecisive at times and are sometimes misunderstood in communication; you learn by absorbing rather than memorising.";
export const MERCURY_STRONG =
  "Your thinking is sharp, quick and well organised — analysis, language and numbers come easily, and you explain things clearly.";

/** "a steady…" / "an intense…" — the indefinite article for a generated phrase. */
export function article(phrase: string): string {
  return `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
}
