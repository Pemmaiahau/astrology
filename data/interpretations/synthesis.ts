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
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import {
  houseInVarga,
  vargaPositionOf,
  VARGA_NAMES,
  VARGA_SIGNIFICATIONS,
  type VargaId,
  type VargaSet,
} from "@/utils/astrology/varga";
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
    return `No planet casts an aspect on the ${ordinal(house)}. Its affairs run on the lord's condition alone, with neither external reinforcement nor interference — outcomes here are quieter and more self-determined than elsewhere in the chart.`;
  }
  if (maleficCount === 0) {
    return `Every aspect reaching this house is benefic — an unusually protected field, and one of the safer areas of the life.`;
  }
  if (beneficCount === 0) {
    return `Every aspect reaching this house is malefic. With no benefic counterweight, these significations need conscious defence, and the house tends to mature through difficulty rather than ease.`;
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
      return `This blend runs hot: the planets sit within ${orb}° with a combined force of ${cs.score}/100, led by ${leader}. The combination expresses strongly and early, and it defines this house rather than merely colouring it.`;
    case "Balanced":
      return `At ${orb}° the planets are genuinely blended — combined force ${cs.score}/100, led by ${leader}. Expect the combination to express steadily rather than dramatically, in proportion to the effort put into it.`;
    case "Weak blend":
      return `The span is ${orb}° and the combined force only ${cs.score}/100: these planets share a field more than a purpose. The promise is real but muted, and tends to surface mainly during ${leader}'s periods.`;
    default:
      return `Combined force is just ${cs.score}/100 across ${orb}°. This combination is compromised — its difficulties will be felt more reliably than its gifts, and remedial strengthening of ${leader} is the highest-leverage intervention available.`;
  }
}

const GROUP_TIER_NOTE: Record<ConjunctionStrength["tier"], string> = {
  Dominant: "The group acts as a single, life-defining complex that matures across each of their dashas in turn.",
  Balanced: "The pairwise dynamics above braid into one complex whose results arrive in sequence, as each planet's dasha comes round.",
  "Weak blend": "These planets dilute one another more than they cooperate; the house stays busy without ever becoming decisive.",
  Afflicted: "The concentration is a liability rather than an asset here — the house is overloaded, and its significations need deliberate, sustained repair.",
};

/* ------------------------------------------------------------------ *
 * Depth layer: the classical corroborations
 *
 * Everything above reads the Rashi chart. A practitioner does not stop there —
 * a promise made in the D-1 is confirmed, qualified or withdrawn by four other
 * accounts, all of which this engine already computes and none of which used to
 * reach the prose:
 *
 *   1. the DIVISIONAL chart that owns the house's subject (BPHS Ch.6: each
 *      varga is read for its own bhava, and the D-9 for everything),
 *   2. the house's own BHAVA BALA in rupas (BPHS Bhava-bala adhyaya),
 *   3. the house's SARVASHTAKAVARGA bindus (the classical 25/30 thresholds),
 *   4. the lord's SHADBALA against its classical minimum requirement,
 *   5. ARGALA — which planets intervene in the house and which obstruct that
 *      intervention (Jaimini Sutras 1.1).
 *
 * The point of the layer is not more adjectives; it is that a reader can see
 * WHERE the accounts agree and where they contradict each other. A 10th house
 * strong in the D-1 and collapsed in the D-10 is a genuinely different life
 * from one strong in both, and the old prose could not tell them apart.
 * ------------------------------------------------------------------ */

/** Optional classical corroborations. Every field degrades to silence when absent. */
export interface HouseDepthContext {
  vargas?: VargaSet | null;
  shadbala?: ShadbalaSet | null;
  bhavaBala?: BhavaBala[] | null;
  ashtakavarga?: AshtakavargaResult | null;
  jaimini?: JaiminiInfo | null;
}

/**
 * The divisional chart classically read for each house, beyond the universal
 * D-9. BPHS Ch.6 assigns each varga a subject; these are the pairings where the
 * varga's subject IS the house's subject, so the varga is the second opinion
 * that actually counts.
 *
 * Houses with no specialised varga (the 1st, 8th, 11th) fall back to the D-9
 * alone, which is the classical position rather than a gap: the Navamsa is the
 * general strength test for every graha.
 */
const HOUSE_VARGA: Partial<Record<number, VargaId>> = {
  2: "D2",   // wealth and sustenance
  3: "D3",   // siblings, courage, effort
  4: "D4",   // property, home, fortune
  5: "D7",   // children and lineage
  6: "D30",  // misfortune and its sources
  7: "D9",   // marriage (the D-9's own subject)
  9: "D12",  // fortune, father, ancestry
  10: "D10", // career and public deeds
  12: "D20", // spiritual practice, and the moksha house
};

/** Classical Sarvashtakavarga thresholds: the 12 signs share 337 bindus, mean ~28. */
function savVerdict(bindus: number): { word: string; gloss: string } {
  if (bindus >= 30)
    return {
      word: "strong",
      gloss:
        "Above the 30-bindu mark the house is classically held to prosper on its own account: transits through it tend to give their better results, and the significations hold up under pressure.",
    };
  if (bindus <= 24)
    return {
      word: "weak",
      gloss:
        "Below the 25-bindu mark the classical reading is that the house cannot fund itself: even benefic transits through it under-deliver, and its affairs need support imported from elsewhere in the chart.",
    };
  return {
    word: "middling",
    gloss:
      "Between 25 and 29 bindus the house sits near the 28-bindu average — it neither subsidises nor taxes what passes through it, so results here follow the dasha and the lord rather than the field itself.",
  };
}

/** The Bhava Bala paragraph: the house's own strength, ranked against its eleven peers. */
function bhavaBalaSentence(house: number, table: BhavaBala[]): string {
  const mine = table.find((b) => b.house === house);
  if (!mine) return "";
  const ranked = [...table].sort((a, b) => b.rupas - a.rupas);
  const rank = ranked.findIndex((b) => b.house === house) + 1;
  const lordShare = mine.factors.find((f) => f.label.startsWith("Bhavadhipati"))?.virupas ?? 0;
  const drishtiShare = mine.factors.find((f) => f.label.startsWith("Bhava Drishti"))?.virupas ?? 0;

  const band =
    mine.rupas >= 8
      ? "a genuinely well-funded house — it can carry its significations without borrowing"
      : mine.rupas >= 5
        ? "adequately funded: the house holds, but it does not have reserves to spend on crises"
        : "under-funded — the classical reading is that its affairs will need conscious, repeated support";

  // The rupa band is absolute and the rank is relative, so on a chart with an
  // even spread the two can look like they disagree ("12th of twelve, but
  // adequately funded"). Saying which reading is doing the work removes that.
  const rankNote =
    rank === 1
      ? " Being the best-funded house in the chart, it is where this native has the most to work with."
      : rank === 12
        ? " Last of the twelve: even where the absolute figure is respectable, this is still the house with the least backing relative to the rest of the chart, and it is the first to give way when several are stressed at once."
        : "";

  const composition =
    drishtiShare < -15
      ? ` Note the composition: the lord contributes ${(lordShare / 60).toFixed(2)} rupas while net drishti takes ${Math.abs(drishtiShare / 60).toFixed(2)} back out — this house is strong at the lord and besieged at the field, which shows up as capable people in an obstructive environment.`
      : drishtiShare > 10
        ? ` The composition is favourable on both counts: ${(lordShare / 60).toFixed(2)} rupas from the lord and a further ${(drishtiShare / 60).toFixed(2)} added by net benefic drishti.`
        : "";

  return (
    `Bhava Bala: the ${ordinal(house)} musters ${mine.rupas.toFixed(2)} rupas, ranking ${ordinal(rank)} of the twelve houses in this chart — ${band}.${rankNote}${composition}`
  );
}

/** Shadbala of the house lord against the classical per-planet minimum. */
function shadbalaSentence(lordId: PlanetId, house: number, sb: ShadbalaSet): string {
  const entry = (sb.planets as Record<string, ShadbalaSet["planets"][keyof ShadbalaSet["planets"]]>)[lordId];
  if (!entry) return "";
  const name = PLANET_NAMES[lordId];
  const pct = Math.round(entry.ratio * 100);
  const strongest = sb.strongest === lordId;
  const weakest = sb.weakest === lordId;

  const verdict =
    entry.ratio >= 1.2
      ? `comfortably clear of what the tradition demands of it, so ${name} has the authority to enforce the ${ordinal(house)}'s promises rather than merely hold them`
      : entry.ratio >= 1
        ? `only just over the line, so ${name} is sufficient for the ${ordinal(house)} but has no surplus to spend when the house is tested`
        : `short of its classical minimum, which is the strict Parashari signal that the ${ordinal(house)}'s significations are promised but under-guaranteed`;

  const rank = strongest
    ? ` It is also the strongest graha in the chart, which makes the ${ordinal(house)} one of this life's load-bearing walls.`
    : weakest
      ? ` It is also the weakest graha in the chart, so of the twelve houses this one is the least able to defend itself.`
      : "";

  return `Shadbala: ${name} totals ${entry.rupas.toFixed(2)} rupas against a requirement of ${(entry.required / 60).toFixed(2)} (${pct}% of minimum) — ${verdict}.${rank} Ishta ${entry.ishta.toFixed(1)} / Kashta ${entry.kashta.toFixed(1)} sets the ratio of benefic to malefic capacity it brings to the house.`;
}

/**
 * The divisional second opinion. Reports the lord's and the occupants' fate in
 * the D-9 (universal) and in the house's own varga where one exists, and — the
 * part that actually matters — says explicitly whether the accounts agree.
 */
function vargaParagraphs(
  chart: ChartData,
  house: number,
  lordId: PlanetId,
  lordPos: PlanetPosition | null,
  occupants: PlanetPosition[],
  vargas: VargaSet
): string[] {
  const out: string[] = [];
  const specialised = HOUSE_VARGA[house];

  const describe = (id: PlanetId, vid: VargaId): { text: string; strong: boolean; weak: boolean } | null => {
    const vc = vargas.charts[vid];
    const pos = vargaPositionOf(vc, id);
    if (!pos) return null;
    const strong = ["exalted", "moolatrikona", "own", "greatFriend"].includes(pos.dignity);
    const weak = ["debilitated", "greatEnemy", "enemy"].includes(pos.dignity);
    const h = houseInVarga(vc, pos.sign);
    return {
      text: `${SIGNS[pos.sign]} (${DIGNITY_INLINE[pos.dignity]}), the ${ordinal(h)} house of that chart`,
      strong,
      weak,
    };
  };

  // 1. The lord in the Navamsa — the universal strength test.
  if (lordPos) {
    const d9 = describe(lordId, "D9");
    if (d9) {
      const rashiStrong = STRONG_DIGNITIES.includes(lordPos.dignity);
      const rashiWeak = WEAK_DIGNITIES.includes(lordPos.dignity);
      const vargottama = vargas.vargottama.includes(lordId);

      let agreement: string;
      if (vargottama) {
        agreement = `${PLANET_NAMES[lordId]} is vargottama — it holds the same sign in the Rashi and the Navamsa. This is the strongest corroboration the divisional system offers: whatever the D-1 says about the ${ordinal(house)}, the D-9 says it twice, and the promise is unusually reliable.`;
      } else if (rashiStrong && d9.strong) {
        agreement = `Both accounts agree and both are favourable — a promise made in the D-1 and confirmed in the D-9 is one that actually delivers, rather than one that merely looks good on the birth chart.`;
      } else if (rashiWeak && d9.weak) {
        agreement = `Both accounts agree and both are unfavourable. This is the honest case where the difficulty is structural rather than a single bad placement, and the ${ordinal(house)} should be planned around rather than counted on.`;
      } else if (rashiStrong && d9.weak) {
        agreement = `The accounts contradict each other: strong in the Rashi, weak in the Navamsa. Classically this is the "promise without delivery" signature — the ${ordinal(house)}'s affairs look well-set and repeatedly fail to consolidate, and the D-9 is the account to trust for the outcome.`;
      } else if (rashiWeak && d9.strong) {
        agreement = `The accounts contradict each other in the native's favour: weak in the Rashi, strong in the Navamsa. This is the classical late-blooming signature — the ${ordinal(house)} disappoints early and matures well, typically from the second half of life or from this lord's own dasha onward.`;
      } else if (d9.strong) {
        agreement = `The Rashi is non-committal and the Navamsa is favourable. The D-9 is the account that governs delivery, so this reads as more than the birth chart alone suggests — the ${ordinal(house)} tends to be quietly under-rated on paper and to perform better than expected in practice.`;
      } else if (d9.weak) {
        agreement = `The Rashi is non-committal and the Navamsa is unfavourable. Since the D-9 governs delivery, this is the case where an unremarkable-looking house turns out to be the harder one — the ${ordinal(house)} costs more effort than its birth-chart placement implies.`;
      } else {
        agreement = `Neither account is emphatic, so the ${ordinal(house)} is governed by the dasha sequence and the native's own effort rather than by structural promise.`;
      }

      out.push(
        `Navamsa (D-9), the classical test of whether a placement holds: the lord ${PLANET_NAMES[lordId]} goes to ${d9.text}. ${agreement}`
      );
    }
  }

  // 2. The house's own varga, where the tradition assigns one.
  if (specialised && specialised !== "D9") {
    const vc = vargas.charts[specialised];
    const lines: string[] = [
      `${VARGA_NAMES[specialised]} (${specialised}) is the divisional chart read for ${VARGA_SIGNIFICATIONS[specialised]} — which is this house's own subject, so it is the second opinion that counts most here.`,
    ];
    const ld = lordPos ? describe(lordId, specialised) : null;
    if (ld) {
      lines.push(
        `The ${ordinal(house)} lord ${PLANET_NAMES[lordId]} occupies ${ld.text}${
          ld.strong
            ? " — well dignified, so the specialised account backs the Rashi's reading"
            : ld.weak
              ? " — poorly dignified, so the specialised account withholds what the Rashi promises"
              : ""
        }.`
      );
    }
    // The varga lagna's own lord matters as much as the D-1 lord's placement.
    const vLagnaLord = SIGN_LORDS[vc.ascendant];
    const vll = describe(vLagnaLord, specialised);
    if (vll) {
      lines.push(
        `That chart rises in ${SIGNS[vc.ascendant]}, whose lord ${PLANET_NAMES[vLagnaLord]} sits in ${vll.text} — the divisional lagna lord is what carries the whole varga, so its condition sets the ceiling for everything the ${specialised} promises.`
      );
    }
    out.push(lines.join(" "));
  }

  // 3. Occupants that are vargottama — worth naming individually.
  const vo = occupants.filter((p) => vargas.vargottama.includes(p.id));
  if (vo.length > 0) {
    out.push(
      `${vo.map((p) => PLANET_NAMES[p.id]).join(" and ")} ${vo.length === 1 ? "is" : "are"} vargottama, holding the same sign in the Rashi and the Navamsa. A vargottama occupant is the most dependable thing in a house: it behaves the same way in both accounts, so its results arrive in the form the birth chart describes rather than in some altered version of it.`
    );
  }

  return out;
}

/** Argala — Jaimini's intervention rule, and the obstruction that answers it. */
function argalaSentence(house: number, jaimini: JaiminiInfo): string {
  const a = jaimini.argala[house - 1];
  if (!a) return "";
  const names = (ids: PlanetId[]) => ids.map((id) => PLANET_NAMES[id]).join(", ");
  if (a.intervening.length === 0) {
    return `Argala (Jaimini): no graha occupies the 2nd, 4th or 11th from the ${ordinal(house)}, so nothing intervenes in its affairs from outside. The house is left to its own lord and its own drishti — quieter, and more predictable, than a house under argala.`;
  }
  const net =
    a.obstructing.length === 0
      ? `Nothing stands in the 12th, 10th or 3rd to obstruct it, so the intervention lands unopposed — these planets genuinely steer the ${ordinal(house)}'s outcomes, and their dashas are when that steering happens.`
      : `${names(a.obstructing)} ${a.obstructing.length === 1 ? "stands" : "stand"} in the obstructing houses (virodha argala), so the intervention is contested rather than decisive: the ${ordinal(house)}'s affairs get pulled in two directions, and which way they go depends on which side is running its dasha.`;
  return `Argala (Jaimini): ${names(a.intervening)} ${a.intervening.length === 1 ? "exerts" : "exert"} argala on the ${ordinal(house)} from the 2nd, 4th or 11th from it. ${net}`;
}

/**
 * One closing sentence that puts the accounts side by side.
 *
 * Deliberately the last paragraph of every house: a reader who takes nothing
 * else from the section should still be able to see how many of the five
 * independent measures agree, and which of them is the dissenter.
 */
function convergenceSentence(
  house: number,
  signals: { label: string; positive: boolean | null }[]
): string {
  const scored = signals.filter((s) => s.positive !== null);
  if (scored.length < 2) return "";
  const good = scored.filter((s) => s.positive);
  const bad = scored.filter((s) => !s.positive);

  if (bad.length === 0) {
    return `Convergence: all ${scored.length} independent measures of the ${ordinal(house)} (${scored.map((s) => s.label).join(", ")}) point the same, favourable way. Agreement across separate accounts is the strongest verdict this system produces — treat this house as genuinely reliable.`;
  }
  if (good.length === 0) {
    return `Convergence: all ${scored.length} independent measures of the ${ordinal(house)} (${scored.map((s) => s.label).join(", ")}) point the same, unfavourable way. Unanimity is as meaningful here as it is when positive — this is a structural weakness, not a single unlucky placement, and it should be planned around rather than argued with.`;
  }
  return `Convergence: the measures split — ${good.map((s) => s.label).join(", ")} ${good.length === 1 ? "supports" : "support"} the ${ordinal(house)} while ${bad.map((s) => s.label).join(", ")} ${bad.length === 1 ? "does" : "do"} not. A split verdict is the normal case and it means the house is conditional: it delivers in the periods of the planets backing it and stalls in the others, so timing matters here more than in a house where everything agrees.`;
}

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
  /**
   * The classical corroborations (Navamsa and the house's own varga, Bhava
   * Bala, Sarvashtakavarga, the lord's Shadbala, Argala) plus the convergence
   * verdict. Empty when no depth context was supplied, so the panel can render
   * the Rashi reading alone without a special case.
   */
  depth: string[];
  /** Sarvashtakavarga bindus on this house's sign, when Ashtakavarga was supplied. */
  sav: number | null;
  /** Bhava Bala in rupas, when Shadbala was available to build it. */
  bhavaRupas: number | null;
}

export function interpretHouse(
  chart: ChartData,
  house: number,
  strengths: Partial<Record<PlanetId, PlanetStrength>> = {},
  ctx: HouseDepthContext = {}
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
          : "No planet occupies it, so the house is judged — as the classics prescribe — by the condition of its lord and by the aspects it receives.")
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
      `The ${ordinal(house)} is ruled by ${lordName}, which has not been placed in this chart. Without the lord's position the house can only be read from the aspects it receives and from its sign — enter ${lordName} to complete the judgement.`
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
        `Note: by the more precise house-cusp method (Bhava Chalit, Sripati), this planet actually delivers its concrete, day-to-day results through the ${ordinal(p.bhava)} house rather than the ${ordinal(p.house)} — read its outcomes there, while its sign-based strength and dignity above stay as described.`
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
        ? `In sum: with no occupant to speak for it, the ${ordinal(house)}'s fortunes rest on ${lordName}'s condition in the ${ordinal(lordPos.house)} and on the aspects above. Strengthen ${lordName} and this house improves; nothing else reaches it directly.`
        : `In sum: the ${ordinal(house)} must be read from its aspects alone until its lord ${lordName} is placed.`
    );
  }

  // 8. The classical corroborations, and whether they agree with each other.
  const depth: string[] = [];
  const signals: { label: string; positive: boolean | null }[] = [];

  // The Rashi verdict itself is the first signal, so the convergence line is
  // comparing the depth layer AGAINST the reading above rather than only
  // against itself.
  signals.push({
    label: "the Rashi lord",
    positive: lordPos
      ? STRONG_DIGNITIES.includes(lordPos.dignity)
        ? true
        : WEAK_DIGNITIES.includes(lordPos.dignity)
          ? false
          : null
      : null,
  });
  signals.push({
    label: "aspect balance",
    positive: beneficCount === maleficCount ? null : beneficCount > maleficCount,
  });

  const sav = ctx.ashtakavarga ? ctx.ashtakavarga.sav[sign] : null;
  if (sav !== null) {
    const v = savVerdict(sav);
    depth.push(
      `Sarvashtakavarga: ${SIGNS[sign]} holds ${sav} bindus, which reads as ${v.word} against the classical 25/30 thresholds (the twelve signs share 337, so 28 is the average). ${v.gloss}`
    );
    signals.push({ label: "Sarvashtakavarga", positive: sav >= 30 ? true : sav <= 24 ? false : null });
  }

  if (ctx.bhavaBala) {
    const line = bhavaBalaSentence(house, ctx.bhavaBala);
    if (line) depth.push(line);
    const mine = ctx.bhavaBala.find((b) => b.house === house);
    if (mine) {
      signals.push({
        label: "Bhava Bala",
        positive: mine.rupas >= 8 ? true : mine.rupas < 5 ? false : null,
      });
    }
  }

  if (ctx.shadbala && lordPos) {
    const line = shadbalaSentence(lordId, house, ctx.shadbala);
    if (line) depth.push(line);
    const entry = (ctx.shadbala.planets as Record<string, { ratio: number }>)[lordId];
    if (entry) {
      signals.push({
        label: "the lord's Shadbala",
        positive: entry.ratio >= 1.2 ? true : entry.ratio < 1 ? false : null,
      });
    }
  }

  if (ctx.vargas) {
    depth.push(...vargaParagraphs(chart, house, lordId, lordPos, occupants, ctx.vargas));
    const d9 = vargaPositionOf(ctx.vargas.charts.D9, lordId);
    if (d9) {
      signals.push({
        label: "the Navamsa",
        positive: ["exalted", "moolatrikona", "own", "greatFriend"].includes(d9.dignity)
          ? true
          : ["debilitated", "greatEnemy", "enemy"].includes(d9.dignity)
            ? false
            : null,
      });
    }
  }

  if (ctx.jaimini) {
    const line = argalaSentence(house, ctx.jaimini);
    if (line) depth.push(line);
  }

  if (depth.length > 0) {
    const convergence = convergenceSentence(house, signals);
    if (convergence) depth.push(convergence);
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
    depth,
    sav,
    bhavaRupas: ctx.bhavaBala?.find((b) => b.house === house)?.rupas ?? null,
  };
}

/** All twelve houses, in order. Vacant houses are read by lord and drishti, never skipped. */
export function interpretFullChart(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>> = {},
  ctx: HouseDepthContext = {}
): HouseInterpretation[] {
  const out: HouseInterpretation[] = [];
  for (let h = 1; h <= 12; h++) out.push(interpretHouse(chart, h, strengths, ctx));
  return out;
}
