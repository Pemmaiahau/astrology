import type { AgeBand } from "@/utils/astrology/ageBands";
import { AGE_BANDS } from "@/utils/astrology/ageBands";
import type { EventRule, HouseRef } from "@/utils/astrology/rectification/eventRules";
import { EVENT_RULES } from "@/utils/astrology/rectification/eventRules";
import type { EventType } from "@/utils/astrology/rectification/types";
import type { PlanetId } from "@/utils/astrology/types";

/**
 * The Life Events catalogue: which events the timeline predicts, the bhavas
 * and karakas each is read from, and the ages at which each commonly occurs.
 *
 * This is the one declarative table the whole Life Events feature reads —
 * the same convention `AREA_CONFIGS` (Life Areas) and `EVENT_RULES`
 * (rectification) already follow. Adding an event is an edit here and nowhere
 * else: the timing engine, the report builder and the UI are all driven off
 * this table.
 *
 * RELATIONSHIP TO `EVENT_RULES`. Fifteen of these events already have a
 * classical rule written for birth-time rectification. Those are *spread*
 * from `EVENT_RULES`, not restated, so the two directions — "does this date
 * fit the chart?" and "which dates does the chart favour?" — can never drift
 * apart on doctrine. The nine events with no rectification counterpart carry
 * a full rule authored here, each with a `basis` naming the rectification
 * type whose scoring shape it borrows (`EventRule.type` is a closed union, so
 * an authored rule has to declare which member it stands in for; nothing reads
 * that field except the diagnostics).
 *
 * Sources for the authored rules: BPHS ch. 11–24 (bhava phala) for the house
 * significations and Phaladeepika ch. 19–20 for the karaka set — the same two
 * works the rectification table cites. Bhavat Bhavam references are written as
 * `{ house, from }` so the derivation stays readable beside the number.
 *
 * WHAT IS DELIBERATELY ABSENT. `EVENT_RULES` carries `fatherDeath` and
 * `motherDeath`, and they are correct there: rectification scores a date the
 * native has already lived through and reported. Running the same rules
 * forward to hand someone a predicted window for a parent's death is a
 * different act, and this catalogue does not do it.
 */

export type LifeEventCategory =
  | "education"
  | "relationships"
  | "career"
  | "milestones"
  | "finance"
  | "adversity"
  | "spiritual";

export const CATEGORY_LABELS: Record<LifeEventCategory, string> = {
  education: "Education",
  relationships: "Relationships",
  career: "Career",
  milestones: "Life Milestones",
  finance: "Money & Assets",
  adversity: "Adversities",
  spiritual: "Inner Life",
};

export const CATEGORY_ORDER: LifeEventCategory[] = [
  "education",
  "relationships",
  "career",
  "milestones",
  "finance",
  "adversity",
  "spiritual",
];

export type LifeEventKey =
  | "graduation"
  | "higherStudies"
  | "studyAbroad"
  | "firstLove"
  | "marriage"
  | "breakup"
  | "divorce"
  | "remarriage"
  | "firstJob"
  | "promotion"
  | "jobChange"
  | "businessStart"
  | "jobLoss"
  | "retirement"
  | "childbirth"
  | "property"
  | "vehicle"
  | "relocation"
  | "foreignSettlement"
  | "windfall"
  | "wealthPeak"
  | "illness"
  | "accident"
  | "litigation"
  | "spiritualTurn";

export interface LifeEventDef {
  key: LifeEventKey;
  category: LifeEventCategory;
  label: string;
  /** One line telling the reader what this event actually covers. */
  blurb: string;
  /** The classical rule, spread from `EVENT_RULES` or authored here. */
  rule: EventRule;
  /**
   * Ages at which this commonly happens, or null for the events that have no
   * meaningful age — see the note on `ADVERSITY_HAS_NO_BAND` below.
   */
  band: AgeBand | null;
  /**
   * Floor below which a window is not reported. Raised above the engine
   * default for events whose bhava set is broad enough to catch stray periods
   * (the 8th and 12th appear in half the adversity rules).
   */
  minScore?: number;
  /** Cap on windows shown for this event. */
  maxWindows?: number;
}

/**
 * HONESTY NOTE ON THE AGE BANDS — the same one `ageBands.ts` carries, repeated
 * here because this table is where the numbers actually live.
 *
 * No Parashari text says a first job happens between 22 and 30. These are a
 * modern demographic convention: the ages at which these events commonly occur
 * in contemporary life. The chart supplies the timing; the band supplies the
 * plausibility, and the two are weighted separately so a reader whose life ran
 * on a different clock can discount the band and keep the chart. Five bands
 * (marriage, career entry, career change, wealth, foreign) are imported from
 * `AGE_BANDS` rather than restated, so the Interpretation tab and this
 * timeline can never disagree about when a marriage window opens.
 *
 * `ADVERSITY_HAS_NO_BAND`: illness, accident and litigation get `band: null`.
 * They are genuinely age-independent — a person is not more "due" an accident
 * at 34 than at 54 — and `ageBands.ts` already takes this position for its
 * cautions section. A null band means the engine applies no age prior at all
 * and the window count alone bounds the output.
 */
const band = (start: number, peakStart: number, peakEnd: number, end: number): AgeBand => ({
  start,
  peakStart,
  peakEnd,
  end,
});

// ---------------------------------------------------------------------------
// Authored rules — the nine events with no rectification counterpart
// ---------------------------------------------------------------------------

/** Shorthand for the authored rules' shared transit shape. */
function transit(
  jupiterContacts: PlanetId[],
  sadeSati: "expected" | "contrary" | "neutral",
  kantaka: "expected" | "neutral",
  nodeContact: boolean,
  doubleTransitHouses?: HouseRef[]
) {
  return { jupiterContacts, sadeSati, kantaka, nodeContact, ...(doubleTransitHouses ? { doubleTransitHouses } : {}) };
}

const GRADUATION: EventRule = {
  type: "higherEducation",
  label: "Graduation",
  // The 4th is vidya — formal schooling and the certificate that closes it;
  // the 5th is the intelligence that earns it. The 9th belongs to the degree
  // *after* this one, so it supports rather than carries.
  primaryHouses: [{ house: 4 }, { house: 5 }],
  supportingHouses: [{ house: 2 }, { house: 9 }, { house: 11 }],
  // The 8th interrupts a course; the 12th scatters the attention it needs.
  negatingHouses: [{ house: 8 }, { house: 12 }],
  karakas: ["Me", "Ju"],
  vargas: ["D24", "D9"],
  transit: transit(["Me"], "neutral", "neutral", false),
  doctrine:
    "The 4th is vidya — schooling and its formal completion — and the 5th the intelligence that carries it; " +
    "Mercury is karaka of learning, Jupiter of the teaching received. Read in the Chaturvimsamsa (D-24).",
};

const STUDY_ABROAD: EventRule = {
  type: "foreignTravel",
  label: "Study abroad",
  // The 12th is the foreign land, the 9th the higher learning; the pair is
  // the standard reading, and a node contact is what usually fires it.
  primaryHouses: [{ house: 12 }, { house: 9 }],
  supportingHouses: [{ house: 4 }, { house: 5 }, { house: 3 }],
  negatingHouses: [{ house: 2 }],
  karakas: ["Ra", "Ju", "Me"],
  vargas: ["D24", "D9"],
  transit: transit(["Me", "Ra"], "neutral", "neutral", true),
  doctrine:
    "The 12th is the distant land and the 9th the higher learning sought there; the 4th of rootedness " +
    "and the 2nd of the family table are what one leaves. Rahu is the karaka of the foreign.",
};

const FIRST_LOVE: EventRule = {
  type: "marriage",
  label: "First love",
  // The 5th is romance — purva punya expressing itself as attraction — and it
  // is read before the 7th, which is the contract rather than the feeling.
  primaryHouses: [{ house: 5 }],
  supportingHouses: [{ house: 7 }, { house: 11 }, { house: 2 }],
  negatingHouses: [{ house: 6 }, { house: 12 }],
  karakas: ["Ve", "Mo"],
  vargas: ["D9"],
  transit: transit(["Ve"], "contrary", "neutral", false),
  doctrine:
    "The 5th is the bhava of romance and attraction, distinct from the 7th of formal union; " +
    "Venus is karaka of love and the Moon of the feeling that attaches to it.",
};

const BREAKUP: EventRule = {
  type: "divorce",
  label: "Breakup",
  // Bhavat Bhavam on the 5th: its 6th (= the 10th) is the quarrel inside the
  // romance, its 12th (= the 4th) its loss. Written unresolved so the
  // derivation is visible — these are NOT the career and home houses being
  // read as such.
  primaryHouses: [{ house: 6, from: 5 }, { house: 12, from: 5 }],
  supportingHouses: [{ house: 8 }, { house: 12 }],
  negatingHouses: [{ house: 5 }, { house: 11 }],
  karakas: ["Sa", "Ke", "Ma"],
  vargas: ["D9"],
  transit: transit(["Sa"], "expected", "expected", true),
  doctrine:
    "Counted from the 5th itself: its 6th is discord within the romance and its 12th its loss. " +
    "Saturn brings the cooling, Ketu the severance, Mars the rupture.",
};

const REMARRIAGE: EventRule = {
  type: "marriage",
  label: "Second marriage",
  // Two conventions exist and disagree. The Bhavat Bhavam one — the 2nd from
  // the 7th, i.e. the 8th — is used here because it derives rather than
  // asserts; the alternative (the 9th, as the 3rd from the 7th) is recorded in
  // the doctrine line so a reader can see the tradition is not unanimous.
  primaryHouses: [{ house: 2, from: 7 }, { house: 7 }],
  supportingHouses: [{ house: 9 }, { house: 11 }, { house: 2 }],
  negatingHouses: [{ house: 6, from: 7 }],
  karakas: ["Ve"],
  karakasFemale: ["Ju"],
  vargas: ["D9", "D60"],
  transit: transit(["Ve"], "contrary", "neutral", false),
  doctrine:
    "The second union is read from the 2nd counted from the 7th (the 8th of the chart); a competing " +
    "tradition reads it from the 9th instead, and the two do not agree — treat this window as the " +
    "weaker of the marriage readings.",
};

const JOB_CHANGE: EventRule = {
  type: "careerStart",
  label: "Job change",
  // The 10th is the work; its 12th (= the 9th) is leaving the current post.
  // The 3rd supplies the initiative to move, the 6th the new service.
  primaryHouses: [{ house: 10 }, { house: 12, from: 10 }],
  supportingHouses: [{ house: 3 }, { house: 6 }, { house: 11 }],
  negatingHouses: [{ house: 4 }],
  karakas: ["Sa", "Me", "Ra"],
  vargas: ["D10"],
  transit: transit(["Sa", "Me"], "neutral", "expected", true),
  doctrine:
    "The 10th is the work and its 12th — the 9th of the chart — the departure from the present post; " +
    "the 3rd gives the initiative to move and the 6th the new service taken up. The 4th, of settled " +
    "ground, argues for staying.",
};

const BUSINESS_START: EventRule = {
  type: "careerStart",
  label: "Starting a business",
  // The 7th is vyapara — trade and the dealing public — and it is what
  // separates a business from a job. The 6th, of service and employment,
  // argues the other way.
  primaryHouses: [{ house: 7 }, { house: 10 }],
  supportingHouses: [{ house: 3 }, { house: 11 }, { house: 2 }],
  negatingHouses: [{ house: 6 }, { house: 8 }],
  karakas: ["Me", "Ma", "Ra"],
  vargas: ["D10"],
  transit: transit(["Me", "Ju"], "neutral", "neutral", true),
  doctrine:
    "The 7th is vyapara — trade and the dealing public — read with the 10th of karma; the 3rd is " +
    "self-effort and the 11th the gain. The 6th of salaried service argues for employment instead. " +
    "Mercury is karaka of commerce, Mars of enterprise, Rahu of the appetite for risk.",
};

const RETIREMENT: EventRule = {
  type: "jobLoss",
  label: "Retirement",
  // Leaving work read the same way as any departure from the 10th — its 12th,
  // the 9th — but with the 12th of withdrawal rather than the 6th of a new
  // post, and the 10th itself now arguing against.
  primaryHouses: [{ house: 12, from: 10 }, { house: 12 }],
  supportingHouses: [{ house: 4 }, { house: 9 }],
  negatingHouses: [{ house: 10 }, { house: 11 }],
  karakas: ["Sa", "Ke"],
  vargas: ["D10"],
  transit: transit(["Sa"], "expected", "neutral", false),
  doctrine:
    "Withdrawal from work: the 12th from the 10th for the departure, the 12th of the chart for the " +
    "retreat itself, and the 4th for the return to home ground. Saturn, karaka of both work and age, " +
    "governs the handover; a still-active 10th and 11th argue that the work is not finished.",
};

const VEHICLE: EventRule = {
  type: "property",
  label: "Vehicle",
  primaryHouses: [{ house: 4 }],
  supportingHouses: [{ house: 11 }, { house: 2 }],
  negatingHouses: [{ house: 12 }, { house: 6 }],
  karakas: ["Ve", "Ma"],
  vargas: ["D4"],
  transit: transit(["Ve"], "neutral", "expected", false),
  doctrine:
    "Vahana sukha belongs to the 4th along with home and comfort; Venus is karaka of conveyances and " +
    "Mars of the machine itself.",
};

const RELOCATION: EventRule = {
  type: "foreignTravel",
  label: "Relocation",
  // A move within one's own country: the 4th of residence disturbed, the 3rd
  // of short journeys active, the 12th of leaving. Distinct from
  // foreignSettlement, where the 12th leads rather than follows.
  primaryHouses: [{ house: 4 }, { house: 3 }],
  supportingHouses: [{ house: 12 }, { house: 10 }, { house: 9 }],
  negatingHouses: [{ house: 2 }],
  karakas: ["Mo", "Ma", "Ra"],
  vargas: ["D4"],
  transit: transit(["Mo", "Ma"], "neutral", "expected", true),
  doctrine:
    "A change of residence disturbs the 4th and activates the 3rd of journeys, with the 12th supplying " +
    "the leaving. The Moon is karaka of the dwelling, Mars of the uprooting.",
};

const WEALTH_PEAK: EventRule = {
  type: "windfall",
  label: "Peak earning years",
  primaryHouses: [{ house: 2 }, { house: 11 }],
  supportingHouses: [{ house: 5 }, { house: 9 }, { house: 10 }],
  negatingHouses: [{ house: 12 }, { house: 6 }],
  karakas: ["Ju", "Ve"],
  vargas: ["D2", "D10"],
  transit: transit(["Ju"], "contrary", "neutral", false),
  doctrine:
    "The 2nd holds what is kept and the 11th what comes in; the 5th and 9th are the purva punya that " +
    "makes either possible. Jupiter is dhana-karaka. The 12th of outflow argues against accumulation.",
};

const LITIGATION: EventRule = {
  type: "illness",
  label: "Dispute or litigation",
  primaryHouses: [{ house: 6 }],
  supportingHouses: [{ house: 8 }, { house: 12 }, { house: 7 }],
  negatingHouses: [{ house: 9 }, { house: 11 }],
  karakas: ["Ma", "Sa", "Ra"],
  vargas: ["D30"],
  transit: transit(["Ma", "Sa"], "expected", "expected", true),
  doctrine:
    "The 6th is the bhava of enemies, debts and litigation; the 7th is the opposing party and the 8th " +
    "the cost of the fight. Mars is karaka of conflict, Saturn of its length.",
};

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const LIFE_EVENTS: LifeEventDef[] = [
  // --- Education ----------------------------------------------------------
  {
    key: "graduation",
    category: "education",
    label: "Graduation",
    blurb: "completing a first degree or the formal end of schooling",
    rule: GRADUATION,
    band: band(18, 21, 24, 28),
  },
  {
    key: "higherStudies",
    category: "education",
    label: "Higher studies",
    blurb: "postgraduate, professional or specialist study taken up after the first degree",
    rule: EVENT_RULES.higherEducation,
    band: band(20, 22, 28, 38),
  },
  {
    key: "studyAbroad",
    category: "education",
    label: "Study abroad",
    blurb: "leaving the country to study — the education and the migration read together",
    rule: STUDY_ABROAD,
    band: band(17, 20, 28, 36),
    minScore: 52,
  },

  // --- Relationships ------------------------------------------------------
  {
    key: "firstLove",
    category: "relationships",
    label: "Love & romance",
    blurb: "attraction, courtship and the affairs of the heart — the 5th house, not the 7th",
    rule: FIRST_LOVE,
    band: band(15, 18, 27, 40),
  },
  {
    key: "marriage",
    category: "relationships",
    label: "Marriage",
    blurb: "formal union and the household it creates",
    rule: EVENT_RULES.marriage,
    band: AGE_BANDS.marriage,
    maxWindows: 6,
  },
  {
    key: "breakup",
    category: "relationships",
    label: "Breakup",
    blurb: "the ending of a romance short of a formal separation",
    rule: BREAKUP,
    band: band(16, 20, 32, 45),
    minScore: 55,
  },
  {
    key: "divorce",
    category: "relationships",
    label: "Separation or divorce",
    blurb: "the dissolution of a formal union",
    rule: EVENT_RULES.divorce,
    band: band(24, 29, 42, 62),
    minScore: 55,
  },
  {
    key: "remarriage",
    category: "relationships",
    label: "Second marriage",
    blurb: "a second formal union — the weakest of the marriage readings, and flagged as such",
    rule: REMARRIAGE,
    band: band(28, 33, 48, 64),
    minScore: 60,
    maxWindows: 3,
  },

  // --- Career -------------------------------------------------------------
  {
    key: "firstJob",
    category: "career",
    label: "First job",
    blurb: "entry into a profession and the first real establishment in it",
    rule: EVENT_RULES.careerStart,
    band: AGE_BANDS.careerEntry,
  },
  {
    key: "promotion",
    category: "career",
    label: "Promotion & recognition",
    blurb: "elevation in rank, authority or public standing",
    rule: EVENT_RULES.promotion,
    band: band(24, 30, 46, 60),
  },
  {
    key: "jobChange",
    category: "career",
    label: "Job change",
    blurb: "leaving one post for another — the move itself, not the elevation",
    rule: JOB_CHANGE,
    band: AGE_BANDS.careerChange,
  },
  {
    key: "businessStart",
    category: "career",
    label: "Starting a business",
    blurb: "going independent — trade and enterprise rather than salaried service",
    rule: BUSINESS_START,
    band: band(22, 28, 44, 58),
  },
  {
    key: "jobLoss",
    category: "career",
    label: "Job loss or setback",
    blurb: "losing a post, or a business reversal serious enough to end it",
    rule: EVENT_RULES.jobLoss,
    band: band(21, 28, 50, 62),
    minScore: 55,
  },
  {
    key: "retirement",
    category: "career",
    label: "Retirement",
    blurb: "leaving working life, whether by age or by choice",
    rule: RETIREMENT,
    band: band(50, 58, 66, 76),
  },

  // --- Life milestones ----------------------------------------------------
  {
    key: "childbirth",
    category: "milestones",
    label: "Birth of a child",
    blurb: "children — the 5th house and Jupiter as putra-karaka",
    rule: EVENT_RULES.childbirth,
    band: band(21, 26, 36, 48),
    maxWindows: 6,
  },
  {
    key: "property",
    category: "milestones",
    label: "Property or home",
    blurb: "buying land, a house or immovable assets",
    rule: EVENT_RULES.property,
    band: band(24, 30, 46, 62),
  },
  {
    key: "vehicle",
    category: "milestones",
    label: "Vehicle",
    blurb: "acquiring a conveyance — the smaller half of the 4th house's comforts",
    rule: VEHICLE,
    band: band(19, 24, 40, 58),
    minScore: 52,
  },
  {
    key: "relocation",
    category: "milestones",
    label: "Relocation",
    blurb: "a change of residence within your own country",
    rule: RELOCATION,
    band: band(17, 22, 42, 62),
    minScore: 52,
  },
  {
    key: "foreignSettlement",
    category: "milestones",
    label: "Foreign travel or settlement",
    blurb: "leaving the country to live or work",
    rule: EVENT_RULES.foreignTravel,
    band: AGE_BANDS.foreign,
  },

  // --- Money & assets -----------------------------------------------------
  {
    key: "windfall",
    category: "finance",
    label: "Windfall or inheritance",
    blurb: "money arriving from outside your own labour",
    rule: EVENT_RULES.windfall,
    band: band(20, 30, 55, 72),
    minScore: 55,
  },
  {
    key: "wealthPeak",
    category: "finance",
    label: "Peak earning years",
    blurb: "the stretch in which accumulation runs fastest",
    rule: WEALTH_PEAK,
    band: AGE_BANDS.wealth,
  },

  // --- Adversities --------------------------------------------------------
  // No age band by design — see the honesty note above. Higher floors and
  // tighter caps stand in for the band, because the 6th, 8th and 12th are
  // active often enough that an unbounded scan would print noise.
  {
    key: "illness",
    category: "adversity",
    label: "Major health episode",
    blurb: "serious illness, surgery or a sustained decline in health",
    rule: EVENT_RULES.illness,
    band: null,
    minScore: 56,
    maxWindows: 5,
  },
  {
    key: "accident",
    category: "adversity",
    label: "Accident or injury",
    blurb: "sudden physical harm — the node-driven half of the 6th and 8th",
    rule: EVENT_RULES.accident,
    band: null,
    minScore: 58,
    maxWindows: 4,
  },
  {
    key: "litigation",
    category: "adversity",
    label: "Dispute or litigation",
    blurb: "enemies, debts, legal proceedings and the cost of fighting them",
    rule: LITIGATION,
    band: null,
    minScore: 56,
    maxWindows: 4,
  },

  // --- Inner life ---------------------------------------------------------
  {
    key: "spiritualTurn",
    category: "spiritual",
    label: "Spiritual turn",
    blurb: "initiation, a teacher, or the inward turn that reorders the rest",
    rule: EVENT_RULES.spiritual,
    band: band(22, 34, 60, 80),
  },
];

export const LIFE_EVENT_BY_KEY: Record<LifeEventKey, LifeEventDef> = Object.fromEntries(
  LIFE_EVENTS.map((e) => [e.key, e])
) as Record<LifeEventKey, LifeEventDef>;

/** Rectification event types the catalogue reuses, for the diagnostics line. */
export const REUSED_EVENT_TYPES: EventType[] = [
  ...new Set(LIFE_EVENTS.map((e) => e.rule.type)),
];
