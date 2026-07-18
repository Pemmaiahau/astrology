import {
  HOUSE_SIGNIFICATIONS,
  PLANET_NAMES,
  SIGNS,
} from "@/utils/astrology/constants";
import { fmtDeg } from "@/utils/astrology/math";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { ChartData, Dignity, PlanetId, PlanetPosition } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import { CONJUNCTION_TEXT, conjunctionKey } from "./conjunctions";
import { FUNCTIONAL_ROLES, marakasFor } from "./lordships";
import { PLANET_IN_HOUSE } from "./planetInHouse";

/**
 * The synthesis engine: composes professional prose per occupied house by
 * layering (1) lagna-specific functional lordship, (2) the curated core
 * placement text, (3) dignity and state modifiers, (4) conjunction dynamics.
 */

const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];

export function ordinal(n: number): string {
  return ORDINALS[n] ?? `${n}th`;
}

export function lordshipSentence(id: PlanetId, lagnaSign: number): string {
  const name = PLANET_NAMES[id];
  if (id === "Ra" || id === "Ke") {
    return `${name} owns no sign and acts through its dispositor, nakshatra lord and conjunctions — a karmic agent rather than a functional lord.`;
  }
  const houses = ownedHouses(id, lagnaSign);
  const roles = FUNCTIONAL_ROLES[lagnaSign];
  const marakas = marakasFor(lagnaSign);
  const houseStr = houses.map((h) => ordinal(h)).join(" and ");
  const sigStr = houses.map((h) => HOUSE_SIGNIFICATIONS[h - 1].split(",")[0]).join(" and ");

  let classification: string;
  if (roles.yogakaraka === id) classification = "the yogakaraka for this Lagna";
  else if (roles.benefics.includes(id)) classification = "a functional benefic for this Lagna";
  else if (roles.malefics.includes(id)) classification = "a functional malefic for this Lagna";
  else classification = "functionally neutral for this Lagna";

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
  debilitated: (n) => `${n} is debilitated (neecha): its confidence is structurally undermined and its portfolios need conscious, repeated shoring up — unless a Neechabhanga cancellation (checked below) converts the weakness into eventual strength.`,
};

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

export interface HouseInterpretation {
  house: number;
  sign: number;
  planets: PlanetPosition[];
  title: string;
  paragraphs: string[];
}

export function interpretHouse(chart: ChartData, house: number): HouseInterpretation | null {
  const occupants = chart.planets.filter((p) => p.house === house);
  if (occupants.length === 0) return null;
  const lagnaSign = chart.ascendant.sign;
  const sign = (lagnaSign + house - 1) % 12;
  const paragraphs: string[] = [];

  paragraphs.push(
    `The ${ordinal(house)} house (${SIGNS[sign]}) rules ${HOUSE_SIGNIFICATIONS[house - 1]}. ` +
      `${occupants.length > 1 ? "Its combined occupancy makes this a major theatre of the life." : ""}`
  );

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
  }

  if (occupants.length >= 2) {
    const pairTexts: string[] = [];
    for (let i = 0; i < occupants.length; i++) {
      for (let j = i + 1; j < occupants.length; j++) {
        const key = conjunctionKey(occupants[i].id, occupants[j].id);
        const t = CONJUNCTION_TEXT[key];
        if (t) pairTexts.push(t);
      }
    }
    if (occupants.length === 3) {
      pairTexts.push(
        `With three grahas sharing one field, the house becomes a committee: the strongest by dignity (${strongestName(occupants)}) chairs it, and the pairwise dynamics above braid into a single, life-defining complex that matures across all three planets' dashas.`
      );
    }
    paragraphs.push(...pairTexts);
  }

  return {
    house,
    sign,
    planets: occupants,
    title: `${ordinal(house)} House — ${SIGNS[sign]}`,
    paragraphs,
  };
}

const DIGNITY_RANK: Dignity[] = [
  "exalted", "moolatrikona", "own", "greatFriend", "friend", "neutral", "enemy", "greatEnemy", "debilitated",
];

function strongestName(planets: PlanetPosition[]): string {
  const sorted = [...planets].sort(
    (a, b) => DIGNITY_RANK.indexOf(a.dignity) - DIGNITY_RANK.indexOf(b.dignity)
  );
  return PLANET_NAMES[sorted[0].id];
}

export function lagnaOverview(chart: ChartData): string[] {
  const lagnaSign = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagnaSign];
  const lagnaLordId = ownedLordOf(lagnaSign);
  const lagnaLord = chart.planets.find((p) => p.id === lagnaLordId);
  const out: string[] = [];
  out.push(
    `${SIGNS[lagnaSign]} rises at ${fmtDeg(chart.ascendant.degInSign)}. ${roles.note}`
  );
  if (lagnaLord) {
    out.push(
      `The Lagna lord ${PLANET_NAMES[lagnaLord.id]} is placed in the ${ordinal(lagnaLord.house)} house in ${SIGNS[lagnaLord.sign]} (${DIGNITY_LABELS[lagnaLord.dignity]}${lagnaLord.retrograde ? ", retrograde" : ""}${lagnaLord.combust ? ", combust" : ""}). The life's centre of gravity leans toward ${HOUSE_SIGNIFICATIONS[lagnaLord.house - 1].split(",")[0]} — the ${ordinal(lagnaLord.house)} house agenda colours everything this chart attempts.`
    );
  }
  return out;
}

function ownedLordOf(sign: number): PlanetId {
  const lords: PlanetId[] = ["Ma", "Ve", "Me", "Mo", "Su", "Me", "Ve", "Ma", "Ju", "Sa", "Sa", "Ju"];
  return lords[sign];
}

export function interpretFullChart(chart: ChartData): HouseInterpretation[] {
  const out: HouseInterpretation[] = [];
  for (let h = 1; h <= 12; h++) {
    const hi = interpretHouse(chart, h);
    if (hi) out.push(hi);
  }
  return out;
}
