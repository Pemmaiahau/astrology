import { drishtiOnHouse } from "@/utils/astrology/aspects";
import {
  HOUSE_SIGNIFICATIONS,
  NAKSHATRA_QUALITIES,
  NAKSHATRAS,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
} from "@/utils/astrology/constants";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { fmtDeg } from "@/utils/astrology/math";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { ChartData, PlanetId, PlanetPosition, YogaFinding } from "@/utils/astrology/types";
import type { VargaSet } from "@/utils/astrology/varga";
import { drishtiCharacter } from "./aspectTexts";
import { FUNCTIONAL_ROLES } from "./lordships";
import { ordinal } from "./synthesis";

/**
 * The personality profile: a single composed reading of *who the native is*,
 * as distinct from the house-by-house reading of what happens to them.
 *
 * Classical practice reads character from three seats at once — the Lagna (the
 * body and its bearing), the Moon (the mind and its weather) and the Sun (the
 * will and the core self) — then modifies all three by which planets are
 * actually strong, which yogas have formed, and which grahas work for or
 * against this particular rising sign. Every input here is already computed;
 * this file is pure text composition.
 */

/** Lagna sign → bodily bearing and outward temperament. */
const LAGNA_TEMPERAMENT: string[] = [
  "direct, competitive and quick to start — a pioneer's bearing that would rather act and correct than wait and be certain. Physical courage is real; patience is the lesson of the life.",
  "steady, sensual and immovable once settled, built for accumulation and endurance rather than speed. Comfort is sought sincerely and change resisted instinctively.",
  "quick, curious and verbally agile, sampling widely and committing late. Versatility is the gift; depth is a choice this native has to keep making deliberately.",
  "receptive, protective and tidally emotional — the native reads a room before entering it. Security matters more than status, and old hurts are archived rather than discarded.",
  "warm, proud and naturally centre-stage, where dignity is not vanity but a working requirement. Generous when respected, brittle when overlooked.",
  "precise, analytical and quietly self-critical — the bearing of someone who notices what others miss and cannot then unnotice it. Service is genuine; perfectionism is the tax on it.",
  "gracious, balancing and relationship-oriented; this native thinks by consulting. Charm is effortless, decisiveness is not.",
  "intense, private and penetrating, with feeling that runs deep and is rarely displayed. Loyalty is absolute and so is its withdrawal — this temperament does not do half-measures.",
  "expansive, principled and restless for meaning, needing both a horizon and a doctrine. Optimism is native; tact is acquired.",
  "disciplined, ambitious and realistic to the point of severity — the native builds slowly and never expected the world to be fair. Authority arrives with age and is deserved when it does.",
  "detached, systemic and unconventionally principled, thinking in groups and futures rather than individuals and moments. Independent to a fault, and warm in a way that surprises people.",
  "impressionable, compassionate and porous to atmosphere, absorbing whatever surrounds it and needing boundaries it is reluctant to build. Imagination and faith are the standing strengths.",
];

/** Moon sign → the mind's habitual weather. */
const MOON_MIND: string[] = [
  "reacts before it deliberates — fast, hot and honest about it. Emotions arrive at full strength and clear just as quickly.",
  "is steady, sensory and slow to disturb; once settled on something it does not let go. Comfort and routine are genuine emotional needs here, not indulgences.",
  "is restless and verbal, processing feeling by talking about it. Moods turn over quickly and are rarely as serious as they sound.",
  "is on home ground — deeply feeling, nurturing and retentive, with an unusually strong bond to mother, home and the past. Emotional memory is very long.",
  "needs to be seen and appreciated; feelings run dramatic, generous and proud, and slights land harder than this native will admit.",
  "runs on analysis and self-correction, examining feelings rather than simply having them. Worry is the default idle state.",
  "seeks harmony and calibrates itself against others, so emotional equilibrium depends on the relationships being in order. Open conflict is genuinely destabilising.",
  "runs deep, secretive and intense, with feelings neither displayed nor discarded. This is the Moon's hardest station and the compensation is formidable psychological depth.",
  "is optimistic and philosophical and needs room; feeling attaches itself to meaning and to freedom, and confinement — physical or moral — is the real distress.",
  "is disciplined and emotionally economical, having learned early that feelings are not always useful. Warmth exists but is rationed and has to be earned.",
  "is detached and observational, feeling at one remove and more comfortable with humanity than with individuals. Emotional independence is real, occasionally to the point of remoteness.",
  "is porous, imaginative and compassionate, absorbing others' states as its own. Escape is the standing temptation and devotion the standing gift.",
];

/** Sun sign → the shape of the will and the core self. */
const SUN_CORE: string[] = [
  "pioneering and self-starting: identity is built on being first and being brave.",
  "patient and acquisitive: identity rests on what has been built and held.",
  "curious and communicative: identity rests on knowing things and saying them well.",
  "protective and rooted: identity rests on belonging, and on caring for one's own.",
  "sovereign and creative: identity is the most solid thing in this chart, and the native is unmistakably themselves.",
  "discerning and useful: identity rests on competence and on getting things right.",
  "relational and consultative: identity is negotiated rather than asserted, which costs the Sun its natural authority but produces genuine fairness.",
  "intense and investigative: identity is forged through crisis and rarely displayed intact.",
  "principled and expansive: identity rests on beliefs held, defended and taught.",
  "disciplined and structural: identity rests on responsibility carried and authority earned.",
  "independent and reforming: identity rests on principle rather than on approval.",
  "compassionate and self-effacing: identity dissolves easily into causes and into other people.",
];

export interface PersonalitySection {
  heading: string;
  paragraphs: string[];
}

export interface PersonalityProfile {
  headline: string;
  sections: PersonalitySection[];
  strongest: PlanetId | null;
  weakest: PlanetId | null;
}

/**
 * "a" or "an" for a sign name. Aries and Aquarius are the vowel-initial two,
 * but the test is on the string so a renamed or translated table stays correct.
 */
function article(sign: number): string {
  return /^[AEIOU]/.test(SIGNS[sign]) ? "an" : "a";
}

function Article(sign: number): string {
  return article(sign) === "an" ? "An" : "A";
}

function nakClause(p: PlanetPosition): string {
  return `${NAKSHATRAS[p.nakshatra]} pada ${p.pada} (lord ${PLANET_NAMES[p.nakshatraLord]}) — ${NAKSHATRA_QUALITIES[p.nakshatra]}`;
}

function relationClause(p: PlanetPosition): string {
  switch (p.nakshatraRelation) {
    case "self":
      return `Sitting in its own nakshatra, ${PLANET_NAMES[p.id]} expresses this without interference.`;
    case "friend":
      return `Its nakshatra lord ${PLANET_NAMES[p.nakshatraLord]} is a friend, so this quality comes through warmly and legibly.`;
    case "enemy":
      return `Its nakshatra lord ${PLANET_NAMES[p.nakshatraLord]} is an enemy, so this quality is filtered through an unsympathetic agent and often reads to others as something the native did not intend.`;
    default:
      return `Its nakshatra lord ${PLANET_NAMES[p.nakshatraLord]} is neutral, transmitting this quality plainly and without colour.`;
  }
}

function gradeOf(strengths: Partial<Record<PlanetId, PlanetStrength>>, id: PlanetId): string {
  const s = strengths[id];
  return s ? `${s.score}/100 (${s.grade})` : "not scored";
}

/** Yoga keys that speak to character rather than to circumstance. */
function isTemperamentYoga(key: string): boolean {
  return (
    key.startsWith("mahapurusha-") ||
    key === "gajakesari" ||
    key === "budhaditya" ||
    key === "chandra-mangala" ||
    // The lunar-support yogas describe the mind's backing, which is character
    // rather than circumstance. Their absent counterpart, Kemadruma, already
    // reaches the reader through `cautions.ts`; leaving these three out of the
    // temperament section kept that exchange one-sided.
    key === "sunapha" ||
    key === "anapha" ||
    key === "durudhara" ||
    key.startsWith("yk-")
  );
}

/** Optional deep-analysis inputs; every section they power degrades gracefully when absent. */
export interface PersonalityExtras {
  vargas?: VargaSet | null;
  jaimini?: JaiminiInfo | null;
  shadbala?: ShadbalaSet | null;
}

export function buildPersonalityProfile(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  yogas: YogaFinding[],
  extras: PersonalityExtras = {}
): PersonalityProfile {
  const lagnaSign = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagnaSign];
  const lagnaLordId = SIGN_LORDS[lagnaSign];
  const lagnaLord = chart.planets.find((p) => p.id === lagnaLordId) ?? null;
  const moon = chart.planets.find((p) => p.id === "Mo") ?? null;
  const sun = chart.planets.find((p) => p.id === "Su") ?? null;

  const scored = chart.planets
    .map((p) => ({ p, s: strengths[p.id] }))
    .filter((x): x is { p: PlanetPosition; s: PlanetStrength } => x.s !== undefined)
    .sort((a, b) => b.s.score - a.s.score);
  const strongest = scored.length ? scored[0] : null;
  const weakest = scored.length ? scored[scored.length - 1] : null;

  const sections: PersonalitySection[] = [];

  /* --- 1. Lagna: body and bearing --- */
  const lagnaParas: string[] = [
    `${SIGNS[lagnaSign]} rises at ${fmtDeg(chart.ascendant.degInSign)}, in ${NAKSHATRAS[chart.ascendant.nakshatra]} pada ${chart.ascendant.pada}. The outward temperament is ${LAGNA_TEMPERAMENT[lagnaSign]}`,
    `The rising nakshatra colours the body and first impression: ${NAKSHATRA_QUALITIES[chart.ascendant.nakshatra]}.`,
  ];
  if (lagnaLord) {
    lagnaParas.push(
      `The Lagna lord ${PLANET_NAMES[lagnaLordId]} sits in the ${ordinal(lagnaLord.house)} house in ${SIGNS[lagnaLord.sign]} — ${DIGNITY_LABELS[lagnaLord.dignity]}${lagnaLord.retrograde ? ", retrograde" : ""}${lagnaLord.combust ? ", combust" : ""}, composite strength ${gradeOf(strengths, lagnaLordId)}. The life's centre of gravity therefore leans toward ${HOUSE_SIGNIFICATIONS[lagnaLord.house - 1].split(",")[0]}: that agenda colours everything this chart attempts, and the native's sense of self is bound up in it.`
    );
    lagnaParas.push(
      `${PLANET_NAMES[lagnaLordId]} occupies ${nakClause(lagnaLord)}. ${relationClause(lagnaLord)}`
    );
  } else {
    lagnaParas.push(
      `The Lagna lord ${PLANET_NAMES[lagnaLordId]} has not been placed in this chart, so the rising sign's temperament stands unmodified — place ${PLANET_NAMES[lagnaLordId]} to sharpen this reading considerably.`
    );
  }
  lagnaParas.push(roles.note);
  sections.push({ heading: "Lagna — the body and the bearing", paragraphs: lagnaParas });

  /* --- 2. Moon: the mind --- */
  if (moon) {
    sections.push({
      heading: "Chandra — the mind and its weather",
      paragraphs: [
        `The Moon is in ${SIGNS[moon.sign]} in the ${ordinal(moon.house)} house — ${DIGNITY_LABELS[moon.dignity]}, composite strength ${gradeOf(strengths, "Mo")}. The mind ${MOON_MIND[moon.sign]}`,
        `Its nakshatra is ${nakClause(moon)}. This is the single most personal signature in the chart — it sets the Vimshottari dasha sequence and describes how the native actually experiences their own life from the inside. ${relationClause(moon)}`,
        `Placed in the ${ordinal(moon.house)}, the emotional life orbits ${HOUSE_SIGNIFICATIONS[moon.house - 1].split(",")[0]}; that is where this native goes for comfort and where they are most easily unsettled.`,
      ],
    });
  }

  /* --- 3. Sun: the will --- */
  if (sun) {
    sections.push({
      heading: "Surya — the will and the self",
      paragraphs: [
        `The Sun is in ${SIGNS[sun.sign]} in the ${ordinal(sun.house)} house — ${DIGNITY_LABELS[sun.dignity]}, composite strength ${gradeOf(strengths, "Su")}. The will is ${SUN_CORE[sun.sign]}`,
        `In the ${ordinal(sun.house)} house, that identity is staked on ${HOUSE_SIGNIFICATIONS[sun.house - 1].split(",")[0]} — this is the arena in which the native needs to matter, and failure here is felt as a failure of self rather than of circumstance.`,
        `The Sun occupies ${nakClause(sun)}. ${relationClause(sun)}`,
      ],
    });
  }

  /* --- 4. The strong / weak axis --- */
  if (strongest && weakest && strongest.p.id !== weakest.p.id) {
    const sName = PLANET_NAMES[strongest.p.id];
    const wName = PLANET_NAMES[weakest.p.id];
    sections.push({
      heading: "The chart's strong and weak axis",
      paragraphs: [
        `${sName} is the strongest graha in this chart at ${strongest.s.score}/100 (${strongest.s.grade}), placed in the ${ordinal(strongest.p.house)} house in ${SIGNS[strongest.p.sign]}. Its qualities are the ones this native reaches for by default and performs best under pressure — ${sName}'s significations are where they are genuinely, reliably competent. Its top contributions are ${strongest.s.factors
          .filter((f) => f.delta > 0)
          .slice(0, 3)
          .map((f) => f.label)
          .join("; ") || "modest across the board"}.`,
        `${wName} is the weakest at ${weakest.s.score}/100 (${weakest.s.grade}), in the ${ordinal(weakest.p.house)} house in ${SIGNS[weakest.p.sign]}. This is the chart's soft flank: ${wName}'s significations are where the native over-compensates, avoids, or quietly outsources to other people. Its heaviest drags are ${weakest.s.factors
          .filter((f) => f.delta < 0)
          .slice(0, 3)
          .map((f) => f.label)
          .join("; ") || "diffuse rather than acute"}.`,
        `The personality is largely the negotiation between these two. Growth in this chart looks less like adding to ${sName} — which needs no help — and more like refusing to let ${wName}'s weakness set the terms, since it is precisely the area the native is most tempted to route around.`,
      ],
    });
  }

  /* --- 4b. The soul's own signature: Atmakaraka and Karakamsa --- */
  const { jaimini, vargas, shadbala } = extras;
  if (jaimini) {
    const ak = chart.planets.find((p) => p.id === jaimini.karakas.AK);
    const akParas: string[] = [];
    if (ak) {
      akParas.push(
        `${PLANET_NAMES[ak.id]} is the Atmakaraka (the soul significator — the planet that travelled furthest through its sign, at ${fmtDeg(ak.degInSign)}). In simple terms: whatever ${PLANET_NAMES[ak.id]} stands for — placed in your ${ordinal(ak.house)} house in ${SIGNS[ak.sign]} — is the lesson this life keeps returning to, in relationships, in work, everywhere. It is less "what you do" and more "what you cannot avoid becoming good at".`
      );
      akParas.push(
        `Its Karakamsa (the Navamsa sign of the Atmakaraka) is ${SIGNS[jaimini.karakamsa]}: the inner room where that lesson is actually worked out. ${Article(jaimini.karakamsa)} ${SIGNS[jaimini.karakamsa]} Karakamsa colours the soul's work: ${LAGNA_TEMPERAMENT[jaimini.karakamsa]}`
      );
    }
    if (akParas.length) {
      sections.push({ heading: "Atmakaraka — what this life is for", paragraphs: akParas });
    }
  }

  /* --- 4c. Navamsa lagna: the inner person --- */
  if (vargas) {
    const d9 = vargas.charts.D9;
    const navParas: string[] = [
      `The Navamsa (D-9) Lagna is ${SIGNS[d9.ascendant]}. If the birth chart is how life presents itself, the Navamsa is how you are on the inside once the noise settles — and ${article(d9.ascendant)} ${SIGNS[d9.ascendant]} inner nature is ${LAGNA_TEMPERAMENT[d9.ascendant]} When the outer (${SIGNS[lagnaSign]}) and inner (${SIGNS[d9.ascendant]}) signs differ in element, people who only know you casually often misread you; those close to you meet the Navamsa.`,
    ];
    if (vargas.vargottama.length) {
      navParas.push(
        `${vargas.vargottama.map((id) => PLANET_NAMES[id]).join(", ")} ${vargas.vargottama.length === 1 ? "is" : "are"} Vargottama — occupying the same sign in both D-1 and D-9. A Vargottama planet keeps its promises: what it shows on the surface is what it actually is underneath, and it holds steady under pressure.`
      );
    }
    sections.push({ heading: "Navamsa — the inner person", paragraphs: navParas });
  }

  /* --- 4d. Six-fold strength (Shadbala) --- */
  if (shadbala) {
    const s = shadbala.planets[shadbala.strongest];
    const w = shadbala.planets[shadbala.weakest];
    sections.push({
      heading: "By the classical six-fold measure (Shadbala)",
      paragraphs: [
        `Measured the full classical way — position, direction, time of birth, motion, nature and aspects together — ${PLANET_NAMES[shadbala.strongest]} is this chart's strongest planet at ${s.rupas.toFixed(2)} rupas (${Math.round(s.ratio * 100)}% of its required strength) and ${PLANET_NAMES[shadbala.weakest]} the weakest at ${w.rupas.toFixed(2)} rupas (${Math.round(w.ratio * 100)}%). ${shadbala.strongest === (strongest?.p.id ?? "") ? "This agrees with the quick composite score above, which strengthens the reading." : "Note this differs from the quick composite score above — the six-fold measure weighs birth-time and motion factors the composite does not; where they disagree, the Shadbala verdict is the classical one."}`,
        `Practically: lean on ${PLANET_NAMES[shadbala.strongest]}'s themes when stakes are high, and give ${PLANET_NAMES[shadbala.weakest]}'s themes more preparation time than feels necessary.`,
      ],
    });
  }

  /* --- 4e. Glances on the Lagna --- */
  {
    const drishtis = drishtiOnHouse(chart, 1);
    if (drishtis.length) {
      const paras = drishtis.map((d) => {
        const glance = drishtiCharacter(d.from, d.offset);
        return `${PLANET_NAMES[d.from]} casts its ${d.special ? "special " : ""}${ordinal(d.offset)} glance onto the Lagna — ${glance}`;
      });
      paras.push(
        "Aspects on the first house edit the personality others meet: each glance above adds its colour on top of the rising sign itself."
      );
      sections.push({ heading: "Glances on the Lagna — who edits the personality", paragraphs: paras });
    }
  }

  /* --- 4f. Perceived vs actual: Arudha Lagna --- */
  if (jaimini) {
    const al = jaimini.arudhaLagna;
    const same = al === lagnaSign;
    sections.push({
      heading: "How you are seen vs how you are (Arudha Lagna)",
      paragraphs: [
        same
          ? `The Arudha Lagna (how the world perceives you) falls in ${SIGNS[al]} — the same sign as the Lagna itself. What you project and what you are largely coincide: people's image of this native is unusually accurate, which builds trust but also means there is nowhere to hide on a bad day.`
          : `The Arudha Lagna (how the world perceives you) falls in ${SIGNS[al]}, while the actual rising sign is ${SIGNS[lagnaSign]}. The public image runs on ${SIGNS[al]}'s wavelength — ${LAGNA_TEMPERAMENT[al].split("—")[0].trim()} — while the person underneath operates as ${SIGNS[lagnaSign]}. The gap is not dishonesty; it is simply that reputation forms around the ${ordinal(((al - lagnaSign + 12) % 12) + 1)} house's themes. Knowing which conversations are about the image and which are about you is a lifelong advantage.`,
      ],
    });
  }

  /* --- 5. Yoga signatures --- */
  const temperament = yogas.filter((y) => isTemperamentYoga(y.key));
  const resilience = yogas.filter((y) => y.key.startsWith("nbrj-") || y.key.startsWith("vrj-"));
  /** Distinct names, order preserved — two findings can share a yoga name. */
  const uniqueNames = (ys: YogaFinding[]): string => [...new Set(ys.map((y) => y.name))].join(", ");

  const yogaParas: string[] = [];
  if (temperament.length) {
    yogaParas.push(
      `${temperament.length === 1 ? "One combination stamps itself" : `${temperament.length} combinations stamp themselves`} directly on the character: ${uniqueNames(temperament)}.`
    );
    for (const y of temperament) yogaParas.push(`${y.name} — ${y.description}`);
  }
  if (resilience.length) {
    yogaParas.push(
      `Beneath that sits a resilience signature — ${uniqueNames(resilience)} — the combinations that convert this chart's difficulties into capability rather than damage. They rarely show early; they are what the native is left holding after the hard decade.`
    );
    for (const y of resilience) yogaParas.push(`${y.name} — ${y.description}`);
  }
  if (!yogaParas.length) {
    yogaParas.push(
      "No classical yoga from the detected set forms in this chart. That is not a deficiency — it means the personality is written by placement, dignity and dasha rather than by a single dominant combination, and it will read as more balanced and less extreme than a chart carrying a Mahapurusha or Raja yoga."
    );
  }
  sections.push({ heading: "Yoga signatures in the personality", paragraphs: yogaParas });

  /* --- 6. Functional weather --- */
  const describe = (id: PlanetId): string => {
    const p = chart.planets.find((q) => q.id === id);
    if (!p) return `${PLANET_NAMES[id]} (not placed)`;
    return `${PLANET_NAMES[id]} in the ${ordinal(p.house)}, ${DIGNITY_LABELS[p.dignity]}, ${gradeOf(strengths, id)}`;
  };
  const functionalParas: string[] = [];
  if (roles.yogakaraka) {
    const yk = roles.yogakaraka;
    functionalParas.push(
      `${PLANET_NAMES[yk]} is the yogakaraka for ${SIGNS[lagnaSign]} Lagna — ${describe(yk)}. Its condition is the single best predictor of how far this personality converts into standing in the world, because it rules a kendra and a trikona at once.`
    );
  }
  if (roles.benefics.length) {
    functionalParas.push(
      `Working for this Lagna: ${roles.benefics.map(describe).join("; ")}. The traits these planets govern are the ones the native can lean on without second-guessing, and their dashas feel like the personality working as designed.`
    );
  }
  if (roles.malefics.length) {
    functionalParas.push(
      `Working against it: ${roles.malefics.map(describe).join("; ")}. These are not evil planets — they are the ones whose natural instincts pull against this particular rising sign's interests. Where they are strong, the native has a talent that repeatedly gets them into trouble; where weak, a blind spot they rarely notice.`
    );
  }
  if (roles.neutrals.length) {
    functionalParas.push(
      `Neutral: ${roles.neutrals.map(describe).join("; ")} — these take their colour from whatever they associate with rather than carrying an agenda of their own.`
    );
  }
  sections.push({ heading: "Functional weather — who works for this Lagna", paragraphs: functionalParas });

  /* --- Headline --- */
  const headlineBits: string[] = [`${SIGNS[lagnaSign]} rising`];
  if (moon) headlineBits.push(`${SIGNS[moon.sign]} Moon in ${NAKSHATRAS[moon.nakshatra]}`);
  if (sun) headlineBits.push(`${SIGNS[sun.sign]} Sun`);
  const headline =
    `${headlineBits.join(", ")}` +
    (strongest ? ` — a personality led by ${PLANET_NAMES[strongest.p.id]}` : "") +
    (weakest && strongest && weakest.p.id !== strongest.p.id
      ? ` and tested through ${PLANET_NAMES[weakest.p.id]}.`
      : ".");

  return {
    headline,
    sections,
    strongest: strongest?.p.id ?? null,
    weakest: weakest?.p.id ?? null,
  };
}
