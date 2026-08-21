import { drishtiOnHouse, naturalBenefics, type Drishti } from "@/utils/astrology/aspects";
import {
  HOUSE_SIGNIFICATIONS,
  NAKSHATRA_QUALITIES,
  NAKSHATRAS,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
} from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import { fmtDeg } from "@/utils/astrology/math";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import {
  conjunctionStrength,
  type ConjunctionStrength,
  type PlanetStrength,
} from "@/utils/astrology/strength";
import type {
  ChartData,
  Dignity,
  NakshatraRelation,
  PlanetId,
  PlanetPosition,
} from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import { ASPECT_ON_HOUSE, drishtiCharacter } from "./aspectTexts";
import { CONJUNCTION_TEXT, conjunctionKey } from "./conjunctions";
import { FUNCTIONAL_ROLES, marakasFor } from "./lordships";
import { PLANET_IN_HOUSE } from "./planetInHouse";

/**
 * The synthesis engine: composes professional prose for every house, occupied
 * or not, by layering
 *   (1) the house's sign and significations,
 *   (2) its lord's placement, dignity, state and nakshatra condition,
 *   (3) the curated core text for each occupant, with its own nakshatra thread,
 *   (4) every drishti landing on the house — the classical way a planet
 *       influences a house it does not occupy,
 *   (5) conjunction dynamics, qualified by measured conjunction strength.
 *
 * A vacant house is judged exactly as the classics judge it: by its lord and by
 * the aspects it receives. Nothing here computes astronomy; every input is
 * already on ChartData or comes from the strength/aspect primitives.
 */

const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];
const DUSTHANA = [6, 8, 12];

/**
 * Re-exported from `utils/astrology/format`, where it now lives so that the
 * utils layer (`yogas.ts`) can reach it too — see that file's header. Every
 * existing `data`-layer importer of `ordinal` keeps working unchanged.
 */
export { ordinal };

/** Comma-joined state flags for inline use, e.g. ", retrograde, combust". */
function flags(p: PlanetPosition): string {
  const out: string[] = [];
  if (p.retrograde) out.push("retrograde");
  if (p.combust) out.push("combust");
  if (p.warWith) out.push(p.warWinner ? `victor over ${PLANET_NAMES[p.warWith]}` : `defeated by ${PLANET_NAMES[p.warWith]}`);
  return out.length ? `, ${out.join(", ")}` : "";
}

export type FunctionalRole = "yogakaraka" | "benefic" | "malefic" | "neutral";

export function functionalRole(id: PlanetId, lagnaSign: number): FunctionalRole {
  const roles = FUNCTIONAL_ROLES[lagnaSign];
  if (roles.yogakaraka === id) return "yogakaraka";
  if (roles.benefics.includes(id)) return "benefic";
  if (roles.malefics.includes(id)) return "malefic";
  return "neutral";
}

const ROLE_WORD: Record<FunctionalRole, string> = {
  yogakaraka: "the yogakaraka",
  benefic: "a functional benefic",
  malefic: "a functional malefic",
  neutral: "functionally neutral",
};

export function lordshipSentence(id: PlanetId, lagnaSign: number): string {
  const name = PLANET_NAMES[id];
  if (id === "Ra" || id === "Ke") {
    return `${name} owns no sign and acts through its dispositor, nakshatra lord and conjunctions — a karmic agent rather than a functional lord.`;
  }
  const houses = ownedHouses(id, lagnaSign);
  const marakas = marakasFor(lagnaSign);
  const houseStr = houses.map((h) => ordinal(h)).join(" and ");
  const sigStr = houses.map((h) => HOUSE_SIGNIFICATIONS[h - 1].split(",")[0]).join(" and ");
  const classification = `${ROLE_WORD[functionalRole(id, lagnaSign)]} for this Lagna`;
  const marakaNote = marakas.includes(id) ? ", carrying maraka responsibility as well" : "";
  return `As lord of the ${houseStr} for ${SIGNS[lagnaSign]} Lagna, ${name} governs ${sigStr} and operates as ${classification}${marakaNote}.`;
}

const DIGNITY_MODIFIER: Record<Dignity, (name: string) => string> = {
  exalted: (n) => `${n} is exalted here — its significations operate at full, sometimes overwhelming, capacity; this is one of the chart's power centres.`,
  moolatrikona: (n) => `${n} sits in its moolatrikona — confident, productive and duty-forward; results come with unusual reliability.`,
  own: (n) => `${n} occupies its own sign, ruling from home ground: stable, self-sufficient results that do not depend on other planets' cooperation.`,
  greatFriend: (n) => `${n} rests in a great friend's sign, well hosted — its promises are delivered with goodwill and modest interest.`,
  friend: (n) => `${n} is in a friendly sign; the placement cooperates with the native rather than resisting.`,
  neutral: (n) => `${n} stands on neutral ground — outcomes here track effort almost exactly, with neither subsidy nor surcharge.`,
  enemy: (n) => `${n} sits in an enemy's sign; its agenda meets friction from the landlord, and results require roughly double the usual persistence.`,
  greatEnemy: (n) => `${n} is lodged with a great enemy — expect its significations to be taxed; remedial strengthening of this planet earns outsized returns.`,
  debilitated: (n) => `${n} is debilitated (neecha): its confidence is structurally undermined and its portfolios need conscious, repeated shoring up — unless a Neechabhanga cancellation (checked in the yoga findings) converts the weakness into eventual strength.`,
};

const NAK_RELATION_TEXT: Record<NakshatraRelation, (planet: string, lord: string) => string> = {
  self: (p) => `${p} occupies its own nakshatra, so its intent reaches the world undiluted — what it promises, it delivers in its own voice.`,
  friend: (p, l) => `Its nakshatra lord ${l} is a natural friend of ${p}, so these results are passed on willingly and arrive in recognisable form.`,
  neutral: (p, l) => `Its nakshatra lord ${l} is neutral toward ${p}: results are transmitted faithfully, but without amplification.`,
  enemy: (p, l) => `Its nakshatra lord ${l} is a natural enemy of ${p}, so even a well-placed ${p} has its results filtered through an unsympathetic agent — expect the promise to arrive altered, later, or at a price.`,
};

/** The nakshatra overlay for one planet: which star it sits in, and how well that host treats it. */
function nakshatraSentence(p: PlanetPosition, label: string): string {
  const name = PLANET_NAMES[p.id];
  const lordName = PLANET_NAMES[p.nakshatraLord];
  return (
    `${label} lies in ${NAKSHATRAS[p.nakshatra]} pada ${p.pada}, ruled by ${lordName} — ${NAKSHATRA_QUALITIES[p.nakshatra]}. ` +
    `${NAK_RELATION_TEXT[p.nakshatraRelation](name, lordName)}`
  );
}

function stateSentences(p: PlanetPosition): string[] {
  const out: string[] = [];
  const name = PLANET_NAMES[p.id];
  out.push(DIGNITY_MODIFIER[p.dignity](name));
  if (p.retrograde) {
    out.push(
      `${name} is retrograde (vakri): its energy internalises and intensifies, revisiting its themes repeatedly across the life — matters conclude on the second or third pass, not the first.`
    );
  }
  if (p.combust) {
    out.push(
      `${name} is combust (asta), scorched within the Sun's orb: its outward significations are weakened while the ego colonises its portfolio; humility and deliberate cultivation of this planet's virtues are the remedy.`
    );
  }
  if (p.warWith) {
    out.push(
      p.warWinner
        ? `${name} has won a graha yuddha (planetary war) against ${PLANET_NAMES[p.warWith]}, emerging dominant — it commandeers the loser's resources in this house.`
        : `${name} has lost a graha yuddha to ${PLANET_NAMES[p.warWith]}; its independent agency is compromised and it serves the victor's agenda more than its own.`
    );
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * House lord
 * ------------------------------------------------------------------ */

export interface HouseLordReading {
  id: PlanetId;
  /** null only when a manual chart omits this graha */
  position: PlanetPosition | null;
  /** House the lord occupies, counted from the house it rules (1 = in its own house) */
  fromOwnHouse: number | null;
}

const STRONG_DIGNITIES: Dignity[] = ["exalted", "moolatrikona", "own", "greatFriend"];
const WEAK_DIGNITIES: Dignity[] = ["debilitated", "greatEnemy", "enemy"];

function fromOwnHouseSentence(name: string, house: number, fromOwn: number): string {
  if (fromOwn === 1) {
    return `It sits in the very house it rules — the strongest possible endorsement of the ${ordinal(house)}'s promise, since the lord defends its own portfolio directly.`;
  }
  if (DUSTHANA.includes(fromOwn)) {
    return `Counted from the ${ordinal(house)} itself, ${name} stands in the ${ordinal(fromOwn)} — a dusthana from its own house. The house's affairs are undermined from within, and repair here takes deliberate, sustained effort rather than good fortune.`;
  }
  if (KENDRA.includes(fromOwn) || TRIKONA.includes(fromOwn)) {
    return `Counted from the ${ordinal(house)} itself, ${name} stands in the ${ordinal(fromOwn)} — a kendra or trikona from its own house, so the lord actively supports what it rules.`;
  }
  return `Counted from the ${ordinal(house)} itself, ${name} stands in the ${ordinal(fromOwn)}, a working but unremarkable station from its own house.`;
}

function lordVerdict(name: string, house: number, p: PlanetPosition, strength?: PlanetStrength): string {
  const score = strength?.score;
  if (score !== undefined) {
    if (score >= 60) {
      return `With a composite strength of ${score}/100 (${strength!.grade}), ${name} is in a position to deliver the ${ordinal(house)}'s significations rather than merely promise them.`;
    }
    if (score >= 45) {
      return `Composite strength ${score}/100 (${strength!.grade}) — ${name} can carry the ${ordinal(house)}, but results here track the native's effort closely and are not gifted.`;
    }
    return `Composite strength is only ${score}/100 (${strength!.grade}); the ${ordinal(house)} is under-resourced at the lord level, and its affairs need conscious support before they will hold weight.`;
  }
  if (STRONG_DIGNITIES.includes(p.dignity)) {
    return `Well dignified, ${name} is able to deliver the ${ordinal(house)}'s significations rather than merely promise them.`;
  }
  if (WEAK_DIGNITIES.includes(p.dignity)) {
    return `Poorly dignified, ${name} leaves the ${ordinal(house)} under-resourced at the lord level; its affairs need conscious support before they will hold weight.`;
  }
  return `${name} is neutrally placed — the ${ordinal(house)}'s results track the native's effort closely and are not gifted.`;
}

/* ------------------------------------------------------------------ *
 * Aspects
 * ------------------------------------------------------------------ */

function aspectQualifier(benefic: boolean, dignity: Dignity, role: FunctionalRole): string {
  const strong = STRONG_DIGNITIES.includes(dignity);
  const weak = WEAK_DIGNITIES.includes(dignity);
  let base: string;
  if (benefic) {
    base = strong
      ? "Coming from a well-dignified benefic, this aspect is a genuine protection and can be relied on when the house is tested."
      : weak
        ? "The benefic intent is present but under-resourced: the protection is real yet thin, and arrives later than the native expects."
        : "As a benefic of moderate standing, its aspect steadies the house without transforming it.";
  } else {
    base = strong
      ? "A strong malefic aspect does not merely afflict — it also forces competence in this house's affairs, exacting the discipline as its price."
      : weak
        ? "A weak malefic aspect afflicts without conferring much capability: friction here comes with little compensating discipline."
        : "As a malefic of moderate standing, its aspect keeps the house honest, applying pressure the native learns to work with.";
  }
  if (role === "yogakaraka") {
    return `${base} As the yogakaraka for this Lagna, its glance is among the chart's best structural supports wherever it lands.`;
  }
  if (benefic && role === "malefic") {
    return `${base} Note the split, though: naturally benefic but functionally adverse for this Lagna, so its blessing here arrives with strings attached.`;
  }
  if (!benefic && role === "benefic") {
    return `${base} Its functional role softens this considerably — a natural malefic that works for this Lagna behaves far better than its reputation.`;
  }
  return base;
}

/** Short lowercase dignity wording for mid-sentence use (DIGNITY_LABELS is title-cased and parenthesised). */
const DIGNITY_INLINE: Record<Dignity, string> = {
  exalted: "exalted",
  moolatrikona: "in moolatrikona",
  own: "own sign",
  greatFriend: "great friend's sign",
  friend: "friendly sign",
  neutral: "neutral sign",
  enemy: "enemy sign",
  greatEnemy: "great enemy's sign",
  debilitated: "debilitated",
};

function aspectParagraph(chart: ChartData, d: Drishti, house: number, benefics: PlanetId[]): string {
  const src = chart.planets.find((p) => p.id === d.from);
  if (!src) return "";
  const name = PLANET_NAMES[d.from];
  const benefic = benefics.includes(d.from);
  const role = functionalRole(d.from, chart.ascendant.sign);
  return [
    `${name} aspects this house from the ${ordinal(src.house)} in ${SIGNS[src.sign]} (${DIGNITY_INLINE[src.dignity]}${flags(src)}) — a natural ${benefic ? "benefic" : "malefic"} and ${ROLE_WORD[role]} for this Lagna. The glance is ${drishtiCharacter(d.from, d.offset)}.`,
    ASPECT_ON_HOUSE[d.from][house - 1],
    aspectQualifier(benefic, src.dignity, role),
  ].join(" ");
}

function aspectBalanceSentence(house: number, beneficCount: number, maleficCount: number): string {
  if (beneficCount + maleficCount === 0) {
    return `No graha casts drishti on the ${ordinal(house)}. Its affairs run on the lord's condition alone, with neither external reinforcement nor interference — outcomes here are quieter and more self-determined than elsewhere in the chart.`;
  }
  if (maleficCount === 0) {
    return `Every drishti reaching this house is benefic — an unusually protected field, and one of the safer areas of the life.`;
  }
  if (beneficCount === 0) {
    return `Every drishti reaching this house is malefic. With no benefic counterweight, these significations need conscious defence, and the house tends to mature through difficulty rather than ease.`;
  }
  return `The house takes ${beneficCount} benefic and ${maleficCount} malefic ${beneficCount + maleficCount === 2 ? "aspect" : "aspects"} — a contested field whose results swing with whichever of these planets is running its dasha.`;
}

/* ------------------------------------------------------------------ *
 * Conjunctions
 * ------------------------------------------------------------------ */

function conjunctionQualifier(cs: ConjunctionStrength): string {
  const leader = PLANET_NAMES[cs.leader];
  const orb = cs.orb.toFixed(1);
  switch (cs.tier) {
    case "Dominant":
      return `This blend runs hot: the grahas sit within ${orb}° with a combined force of ${cs.score}/100, led by ${leader}. The combination expresses strongly and early, and it defines this house rather than merely colouring it.`;
    case "Balanced":
      return `At ${orb}° the planets are genuinely blended — combined force ${cs.score}/100, led by ${leader}. Expect the combination to express steadily rather than dramatically, in proportion to the effort put into it.`;
    case "Weak blend":
      return `The span is ${orb}° and the combined force only ${cs.score}/100: these grahas share a field more than a purpose. The promise is real but muted, and tends to surface mainly during ${leader}'s periods.`;
    default:
      return `Combined force is just ${cs.score}/100 across ${orb}°. This combination is compromised — its difficulties will be felt more reliably than its gifts, and remedial strengthening of ${leader} is the highest-leverage intervention available.`;
  }
}

const GROUP_TIER_NOTE: Record<ConjunctionStrength["tier"], string> = {
  Dominant: "The group acts as a single, life-defining complex that matures across each of their dashas in turn.",
  Balanced: "The pairwise dynamics above braid into one complex whose results arrive in sequence, as each planet's dasha comes round.",
  "Weak blend": "These grahas dilute one another more than they cooperate; the house stays busy without ever becoming decisive.",
  Afflicted: "The concentration is a liability rather than an asset here — the house is overloaded, and its significations need deliberate, sustained repair.",
};

/* ------------------------------------------------------------------ *
 * House interpretation
 * ------------------------------------------------------------------ */

export interface HouseInterpretation {
  house: number;
  sign: number;
  planets: PlanetPosition[];
  occupied: boolean;
  lord: HouseLordReading;
  aspects: Drishti[];
  conjunctions: ConjunctionStrength[];
  title: string;
  paragraphs: string[];
}

export function interpretHouse(
  chart: ChartData,
  house: number,
  strengths: Partial<Record<PlanetId, PlanetStrength>> = {}
): HouseInterpretation {
  const lagnaSign = chart.ascendant.sign;
  const sign = (lagnaSign + house - 1) % 12;
  const occupants = chart.planets.filter((p) => p.house === house);
  const benefics = naturalBenefics(chart);
  const aspects = drishtiOnHouse(chart, house);
  const paragraphs: string[] = [];

  // 1. The field itself.
  paragraphs.push(
    `The ${ordinal(house)} house falls in ${SIGNS[sign]} and rules ${HOUSE_SIGNIFICATIONS[house - 1]}. ` +
      (occupants.length > 1
        ? "Its combined occupancy makes this a major theatre of the life."
        : occupants.length === 1
          ? `${PLANET_NAMES[occupants[0].id]} occupies it, so this house's affairs are lived directly rather than delegated.`
          : "No graha occupies it, so the house is judged — as the classics prescribe — by the condition of its lord and by the drishti it receives.")
  );

  // 2. The lord.
  const lordId = SIGN_LORDS[sign];
  const lordPos = chart.planets.find((p) => p.id === lordId) ?? null;
  const fromOwnHouse = lordPos ? ((lordPos.house - house + 12) % 12) + 1 : null;
  const lordName = PLANET_NAMES[lordId];

  if (lordPos && fromOwnHouse !== null) {
    const lordLines = [
      `The ${ordinal(house)} is ruled by ${lordName}, placed in the ${ordinal(lordPos.house)} house at ${fmtDeg(lordPos.degInSign)} ${SIGNS[lordPos.sign]} — ${DIGNITY_LABELS[lordPos.dignity]}${flags(lordPos)}.`,
      fromOwnHouseSentence(lordName, house, fromOwnHouse),
      `Its placement carries the ${ordinal(house)}'s agenda into ${HOUSE_SIGNIFICATIONS[lordPos.house - 1].split(",")[0]} — that is where these significations actually play out.`,
      lordVerdict(lordName, house, lordPos, strengths[lordId]),
    ];
    paragraphs.push(lordLines.join(" "));
    paragraphs.push(nakshatraSentence(lordPos, `The lord ${lordName}`));
  } else {
    paragraphs.push(
      `The ${ordinal(house)} is ruled by ${lordName}, which has not been placed in this chart. Without the lord's position the house can only be read from the drishti it receives and from its sign — enter ${lordName} to complete the judgement.`
    );
  }

  // 3. Occupants.
  for (const p of occupants) {
    const core = PLANET_IN_HOUSE[p.id][house - 1];
    const lines = [
      `${PLANET_NAMES[p.id]} at ${fmtDeg(p.degInSign)} ${SIGNS[p.sign]}: ${lordshipSentence(p.id, lagnaSign)}`,
      core,
      ...stateSentences(p),
    ];
    if (p.bhava !== p.house && chart.cusps) {
      lines.push(
        `Note (Bhava Chalit): by Sripati cusps this planet actually operates from the ${ordinal(p.bhava)} bhava — read its concrete, event-level results there, while its sign-based dignity stays as above.`
      );
    }
    paragraphs.push(lines.join(" "));
    paragraphs.push(nakshatraSentence(p, PLANET_NAMES[p.id]));
  }

  // 4. Nakshatra threads shared between the lord and the occupants.
  if (lordPos) {
    for (const p of occupants) {
      if (p.id === lordId) continue;
      if (p.nakshatraLord === lordPos.nakshatraLord) {
        paragraphs.push(
          `${PLANET_NAMES[p.id]} and the house lord ${lordName} both sit in nakshatras ruled by ${PLANET_NAMES[p.nakshatraLord]}. They are wired to the same source: their significations rise and fall together, and ${PLANET_NAMES[p.nakshatraLord]}'s own dasha activates this house twice over.`
        );
      }
    }
  }
  for (let i = 0; i < occupants.length; i++) {
    for (let j = i + 1; j < occupants.length; j++) {
      const a = occupants[i];
      const b = occupants[j];
      if (a.nakshatraLord === b.nakshatraLord) {
        paragraphs.push(
          `${PLANET_NAMES[a.id]} and ${PLANET_NAMES[b.id]} share ${PLANET_NAMES[a.nakshatraLord]} as nakshatra lord, which compounds their conjunction: they do not merely share a sign, they answer to the same authority, and ${PLANET_NAMES[a.nakshatraLord]}'s periods bring both to the surface at once.`
        );
      }
    }
  }

  // 5. Drishti on the house.
  let beneficCount = 0;
  let maleficCount = 0;
  for (const d of aspects) {
    if (benefics.includes(d.from)) beneficCount++;
    else maleficCount++;
    const text = aspectParagraph(chart, d, house, benefics);
    if (text) paragraphs.push(text);
  }
  paragraphs.push(aspectBalanceSentence(house, beneficCount, maleficCount));

  // 6. Conjunction dynamics, measured.
  const conjunctions: ConjunctionStrength[] = [];
  if (occupants.length >= 2) {
    for (let i = 0; i < occupants.length; i++) {
      for (let j = i + 1; j < occupants.length; j++) {
        const a = occupants[i];
        const b = occupants[j];
        const t = CONJUNCTION_TEXT[conjunctionKey(a.id, b.id)];
        const cs = conjunctionStrength(chart, strengths, [a.id, b.id]);
        if (cs) conjunctions.push(cs);
        if (t && cs) paragraphs.push(`${t} ${conjunctionQualifier(cs)}`);
        else if (t) paragraphs.push(t);
      }
    }
    if (occupants.length >= 3) {
      const group = conjunctionStrength(chart, strengths, occupants.map((p) => p.id));
      if (group) {
        conjunctions.push(group);
        paragraphs.push(
          `With ${occupants.length} grahas sharing one field, the house becomes a committee: ${PLANET_NAMES[group.leader]} chairs it by composite strength, the group spans ${group.orb.toFixed(1)}° and carries a combined force of ${group.score}/100 (${group.tier}). ${GROUP_TIER_NOTE[group.tier]}`
        );
      }
    }
  }

  // 7. Closing judgement for a vacant house.
  if (occupants.length === 0) {
    paragraphs.push(
      lordPos
        ? `In sum: with no occupant to speak for it, the ${ordinal(house)}'s fortunes rest on ${lordName}'s condition in the ${ordinal(lordPos.house)} and on the drishti above. Strengthen ${lordName} and this house improves; nothing else reaches it directly.`
        : `In sum: the ${ordinal(house)} must be read from its aspects alone until its lord ${lordName} is placed.`
    );
  }

  return {
    house,
    sign,
    planets: occupants,
    occupied: occupants.length > 0,
    lord: { id: lordId, position: lordPos, fromOwnHouse },
    aspects,
    conjunctions,
    title: `${ordinal(house)} House — ${SIGNS[sign]}`,
    paragraphs,
  };
}

/** All twelve houses, in order. Vacant houses are read by lord and drishti, never skipped. */
export function interpretFullChart(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>> = {}
): HouseInterpretation[] {
  const out: HouseInterpretation[] = [];
  for (let h = 1; h <= 12; h++) out.push(interpretHouse(chart, h, strengths));
  return out;
}
