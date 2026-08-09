import type { EventType } from "@/utils/astrology/rectification/types";
import type { PlanetId } from "@/utils/astrology/types";
import type { VargaId } from "@/utils/astrology/varga";

/**
 * Event → bhava / karaka / varga mapping for birth-time rectification.
 *
 * This is the declarative table the whole rectification pipeline reads; the
 * scoring modules contain no event-specific knowledge of their own. Adding or
 * re-tuning an event type is an edit here and nowhere else — the same
 * convention `data/interpretations/lifeAreas.ts` uses for `AREA_CONFIGS`.
 *
 * Sources: BPHS ch. 11–24 (bhava phala) for the house significations,
 * ch. 46–52 (dasha phala) for what a dasha lord delivers, Phaladeepika ch. 19–20
 * for the karaka set, and Phaladeepika ch. 26 / BPHS Gochara for the transit
 * expectations. Bhavat Bhavam ("a house from a house") is expressed literally
 * as `{ house, from }` rather than pre-resolved, so the classical derivation
 * stays readable next to the number it produces.
 */

/**
 * A bhava, optionally counted from another bhava (Bhavat Bhavam).
 * `{ house: 6, from: 7 }` = "the 6th from the 7th" = the 12th of the chart.
 */
export interface HouseRef {
  house: number;
  from?: number;
}

/** Resolve a Bhavat Bhavam reference to a plain house number 1–12. */
export function resolveHouse(ref: HouseRef): number {
  const base = ref.from ?? 1;
  return (((base - 1 + ref.house - 1) % 12) + 12) % 12 + 1;
}

export function resolveHouses(refs: HouseRef[]): number[] {
  return [...new Set(refs.map(resolveHouse))];
}

/** Human rendering of a reference: "the 12th (6th from the 7th)". */
export function describeHouse(ref: HouseRef): string {
  const n = resolveHouse(ref);
  return ref.from ? `${ord(n)} (${ord(ref.house)} from the ${ord(ref.from)})` : ord(n);
}

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** What the classical Gochara chapter expects to be running at this event. */
export interface TransitExpectation {
  /**
   * Bhavas the Guru–Shani double transit should be lighting. Defaults to the
   * rule's primary houses when omitted.
   */
  doubleTransitHouses?: HouseRef[];
  /**
   * Natal points Jupiter's own transit should be contacting, beyond the
   * primary houses and their lords: normally the event's karaka.
   */
  jupiterContacts: PlanetId[];
  /**
   * Sade Sati stance. "expected" — the phase corroborates this kind of event
   * (loss, hardship, heavy duty, parental death); "contrary" — its presence
   * argues *against* the event (marriage, promotion); "neutral" — no signal.
   */
  sadeSati: "expected" | "contrary" | "neutral";
  /** Kantaka/Ashtama Shani (Saturn 4th/8th/10th from the Moon) expected? */
  kantaka: "expected" | "neutral";
  /** Rahu/Ketu contact on Lagna / Moon / karaka marks sudden or foreign events. */
  nodeContact: boolean;
}

export interface EventRule {
  type: EventType;
  label: string;
  /** Bhavas that must be signified for the event to fire at all. */
  primaryHouses: HouseRef[];
  /** Bhavas that corroborate but cannot carry the event alone. */
  supportingHouses: HouseRef[];
  /** Bhavas whose activation argues against the event. */
  negatingHouses: HouseRef[];
  /** Naisargika karakas (BPHS Karakadhyaya / Phaladeepika ch. 19). */
  karakas: PlanetId[];
  /** Karakas added only when the chart is a woman's (classical convention). */
  karakasFemale?: PlanetId[];
  /**
   * Divisional charts to test, most specific first. Availability is checked
   * against `VARGA_IDS` at runtime; anything missing degrades to D1/D9/D60.
   */
  vargas: VargaId[];
  transit: TransitExpectation;
  /** Shown next to the score so a reader can audit the rule that fired. */
  doctrine: string;
}

export const EVENT_RULES: Record<EventType, EventRule> = {
  marriage: {
    type: "marriage",
    label: "Marriage",
    primaryHouses: [{ house: 7 }],
    supportingHouses: [{ house: 2 }, { house: 11 }],
    // 6th, 10th and 12th from the 7th = the 12th, 4th and 6th: denial,
    // separation and loss of the partnership.
    negatingHouses: [{ house: 6, from: 7 }, { house: 10, from: 7 }, { house: 12, from: 7 }],
    karakas: ["Ve"],
    karakasFemale: ["Ju"],
    vargas: ["D9", "D60"],
    transit: {
      jupiterContacts: ["Ve"],
      sadeSati: "contrary",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 7th is the bhava of union, the 2nd of the family it creates and the 11th of its gain; " +
      "Venus is karaka, with Jupiter added for a woman's chart. Read in the Navamsa.",
  },

  divorce: {
    type: "divorce",
    label: "Divorce or separation",
    // The 6th and 12th from the 7th — dispute and loss of the partnership.
    primaryHouses: [{ house: 6, from: 7 }, { house: 12, from: 7 }],
    supportingHouses: [{ house: 8 }],
    negatingHouses: [{ house: 7 }],
    karakas: ["Sa", "Ke", "Ra"],
    vargas: ["D9", "D60"],
    transit: {
      jupiterContacts: ["Ve"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: true,
    },
    doctrine:
      "Bhavat Bhavam on the 7th: its 6th is dispute, its 12th is its loss. Saturn separates by " +
      "attrition, Ketu by severance, Rahu by disruption.",
  },

  childbirth: {
    type: "childbirth",
    label: "Birth of a child",
    primaryHouses: [{ house: 5 }],
    supportingHouses: [{ house: 2 }, { house: 11 }, { house: 9 }],
    negatingHouses: [{ house: 1 }, { house: 4 }, { house: 10 }],
    karakas: ["Ju"],
    vargas: ["D7", "D60"],
    transit: {
      jupiterContacts: ["Ju"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 5th is progeny, the 9th the grandchild-bearing dharma line, the 2nd and 11th the " +
      "family's increase. Jupiter is karaka and its transit over the 5th or its lord is the trigger. " +
      "Read in the Saptamsa.",
  },

  careerStart: {
    type: "careerStart",
    label: "Career start or new job",
    primaryHouses: [{ house: 10 }],
    supportingHouses: [{ house: 6 }, { house: 2 }, { house: 11 }],
    negatingHouses: [{ house: 5 }, { house: 8 }, { house: 12 }],
    karakas: ["Sa", "Su", "Me"],
    vargas: ["D10", "D60"],
    transit: {
      jupiterContacts: ["Sa"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 10th is the karma bhava, the 6th is service and employment, the 2nd and 11th are its " +
      "pay. Saturn karaka of labour, Sun of office, Mercury of commerce. Read in the Dasamsa.",
  },

  promotion: {
    type: "promotion",
    label: "Promotion or recognition",
    primaryHouses: [{ house: 10 }, { house: 11 }],
    supportingHouses: [{ house: 1 }, { house: 9 }],
    negatingHouses: [],
    karakas: ["Su", "Ju"],
    vargas: ["D10", "D60"],
    transit: {
      jupiterContacts: ["Su"],
      sadeSati: "contrary",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 10th gives the office and the 11th its gain; the 9th is fortune backing it and the 1st " +
      "the person raised. Sun is authority, Jupiter is the blessing on it.",
  },

  jobLoss: {
    type: "jobLoss",
    label: "Job loss or business failure",
    // The 8th and 12th from the 10th = the 5th and the 9th: rupture of the
    // profession and its dissolution.
    primaryHouses: [{ house: 8, from: 10 }, { house: 12, from: 10 }],
    supportingHouses: [{ house: 6 }],
    negatingHouses: [{ house: 10 }],
    karakas: ["Sa", "Ke"],
    vargas: ["D10", "D60"],
    transit: {
      jupiterContacts: ["Sa"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: true,
    },
    doctrine:
      "Bhavat Bhavam on the 10th: its 8th is the rupture of the work, its 12th its loss. Saturn " +
      "grinds it down, Ketu cuts it off.",
  },

  fatherDeath: {
    type: "fatherDeath",
    label: "Father's death",
    // The 9th is the father; the 8th from the 9th (= the 4th) is his longevity
    // ending; the 12th from the 9th (= the 8th) is his departure.
    primaryHouses: [{ house: 9 }, { house: 8, from: 9 }],
    supportingHouses: [{ house: 12, from: 9 }],
    negatingHouses: [],
    karakas: ["Su"],
    vargas: ["D60"],
    transit: {
      jupiterContacts: ["Su"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: false,
    },
    doctrine:
      "The 9th is the father (Pitrikaraka Sun). His maraka is read Bhavat Bhavam — the 8th from " +
      "the 9th, and the 12th from the 9th for the departure itself.",
  },

  motherDeath: {
    type: "motherDeath",
    label: "Mother's death",
    // The 4th is the mother; the 8th from the 4th is the 11th.
    primaryHouses: [{ house: 4 }, { house: 8, from: 4 }],
    supportingHouses: [{ house: 3 }],
    negatingHouses: [],
    karakas: ["Mo"],
    vargas: ["D60"],
    transit: {
      jupiterContacts: ["Mo"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: false,
    },
    doctrine:
      "The 4th is the mother (Matrikaraka Moon); the 8th from the 4th is her longevity ending, " +
      "and the 3rd — the 12th from the 4th — her departure.",
  },

  illness: {
    type: "illness",
    label: "Major illness or surgery",
    primaryHouses: [{ house: 6 }, { house: 8 }],
    supportingHouses: [{ house: 12 }],
    negatingHouses: [{ house: 1 }],
    karakas: ["Ma", "Sa"],
    vargas: ["D30", "D60"],
    transit: {
      jupiterContacts: ["Sa"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: false,
    },
    doctrine:
      "The 6th is disease, the 8th its crisis, the 12th the hospital bed; the 1st is the body " +
      "resisting. Mars cuts (surgery), Saturn wears down (chronic). Read in the Trimsamsa.",
  },

  accident: {
    type: "accident",
    label: "Accident",
    primaryHouses: [{ house: 6 }, { house: 8 }],
    supportingHouses: [{ house: 4 }],
    negatingHouses: [],
    karakas: ["Ma", "Ra", "Sa"],
    vargas: ["D60"],
    transit: {
      jupiterContacts: ["Ma"],
      sadeSati: "expected",
      kantaka: "expected",
      nodeContact: true,
    },
    doctrine:
      "The 8th is sudden rupture, the 6th injury, the 4th the vehicle. Mars is the blow, Rahu the " +
      "suddenness, Saturn the fall.",
  },

  foreignTravel: {
    type: "foreignTravel",
    label: "Foreign travel or relocation",
    primaryHouses: [{ house: 12 }, { house: 9 }],
    supportingHouses: [{ house: 3 }, { house: 7 }],
    negatingHouses: [{ house: 4 }],
    karakas: ["Ra", "Mo"],
    vargas: ["D60"],
    transit: {
      jupiterContacts: ["Ra"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: true,
    },
    doctrine:
      "The 12th is the distant land, the 9th the long journey, the 3rd the short one and the 7th " +
      "residence away from home; the 4th is the home that holds you. Rahu carries abroad, the " +
      "Moon makes it a move rather than a trip.",
  },

  higherEducation: {
    type: "higherEducation",
    label: "Higher-education admission",
    primaryHouses: [{ house: 4 }, { house: 9 }, { house: 5 }],
    supportingHouses: [{ house: 11 }],
    negatingHouses: [],
    karakas: ["Me", "Ju"],
    vargas: ["D24", "D60"],
    transit: {
      jupiterContacts: ["Me"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 4th is formal schooling, the 5th the intelligence that learns and the 9th higher " +
      "learning and the teacher. Mercury is the student, Jupiter the guru. Read in the Siddhamsa.",
  },

  property: {
    type: "property",
    label: "Property or home purchase",
    primaryHouses: [{ house: 4 }],
    supportingHouses: [{ house: 2 }, { house: 11 }],
    negatingHouses: [{ house: 3 }, { house: 12 }],
    karakas: ["Ma", "Ve"],
    vargas: ["D4", "D60"],
    transit: {
      jupiterContacts: ["Ma"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: false,
    },
    doctrine:
      "The 4th is land and dwelling, the 2nd and 11th the funds; the 3rd and 12th disperse them. " +
      "Mars is karaka of land, Venus of comfort and vehicles. Read in the Chaturthamsa.",
  },

  windfall: {
    type: "windfall",
    label: "Windfall or inheritance",
    primaryHouses: [{ house: 8 }, { house: 11 }],
    supportingHouses: [{ house: 2 }, { house: 5 }, { house: 9 }],
    negatingHouses: [],
    karakas: ["Ju", "Ve"],
    vargas: ["D60"],
    transit: {
      jupiterContacts: ["Ju"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: true,
    },
    doctrine:
      "The 8th is what arrives unearned — legacies, insurance, another's wealth — and the 11th is " +
      "its receipt; the 2nd holds it, the 5th and 9th are the merit behind it.",
  },

  spiritual: {
    type: "spiritual",
    label: "Spiritual initiation",
    primaryHouses: [{ house: 9 }, { house: 12 }],
    supportingHouses: [{ house: 5 }, { house: 8 }],
    negatingHouses: [],
    karakas: ["Ke", "Ju"],
    vargas: ["D20", "D60"],
    transit: {
      jupiterContacts: ["Ke"],
      sadeSati: "neutral",
      kantaka: "neutral",
      nodeContact: true,
    },
    doctrine:
      "The 9th is the guru and dharma, the 12th moksha and withdrawal; the 5th is mantra and the " +
      "8th the occult. Ketu renounces, Jupiter initiates. Read in the Vimsamsa.",
  },
};

export const EVENT_TYPES = Object.keys(EVENT_RULES) as EventType[];

export const EVENT_LABELS: Record<EventType, string> = Object.fromEntries(
  EVENT_TYPES.map((t) => [t, EVENT_RULES[t].label])
) as Record<EventType, string>;

/**
 * Naisargika karaka roles (BPHS Karakadhyaya). Used when a dasha lord signifies
 * an event through what it *naturally* stands for rather than through the
 * houses it owns or occupies.
 */
export const NAISARGIKA_ROLE: Record<PlanetId, string> = {
  Su: "father, authority and office",
  Mo: "mother, mind and the public",
  Ma: "siblings, land, machinery and surgery",
  Me: "education, speech and commerce",
  Ju: "children, wealth, the guru and law",
  Ve: "marriage, pleasure and vehicles",
  Sa: "longevity, loss, labour and delay",
  Ra: "the foreign, the sudden and the unconventional",
  Ke: "separation, severance and moksha",
};
