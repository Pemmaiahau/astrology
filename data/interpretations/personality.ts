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
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { ChartData, PlanetId, PlanetPosition, YogaFinding } from "@/utils/astrology/types";
import type { VargaSet } from "@/utils/astrology/varga";
import { drishtiCharacter } from "./aspectTexts";
import { FUNCTIONAL_ROLES } from "./lordships";
import { DIGNITY_INLINE, DIGNITY_PLAIN, ordinal } from "./synthesis";

/**
 * The personality profile: a single composed reading of *who you are*, as
 * distinct from the house-by-house reading of what happens to you.
 *
 * Classical practice reads character from three seats at once — the rising
 * sign (the body and its bearing), the Moon (the mind and its weather) and
 * the Sun (the will and the core self) — then modifies all three by which
 * planets are actually strong, which yogas have formed, and which planets
 * work for or against this particular rising sign. Every input here is
 * already computed; this file is pure text composition.
 *
 * Voice: second person, and every technical term explained the first time
 * the section uses it. The reader is assumed to know nothing about astrology
 * — but nothing is left out for their sake; the term is kept and glossed.
 */

/** Rising sign → bodily bearing and outward temperament. */
const LAGNA_TEMPERAMENT: string[] = [
  "direct, competitive and quick to start — a pioneer's bearing that would rather act and correct than wait and be certain. Physical courage is real; patience is the lesson of the life.",
  "steady, sensual and immovable once settled, built for accumulation and endurance rather than speed. Comfort is sought sincerely and change resisted instinctively.",
  "quick, curious and verbally agile, sampling widely and committing late. Versatility is the gift; depth is a choice you have to keep making deliberately.",
  "receptive, protective and tidally emotional — you read a room before entering it. Security matters more than status, and old hurts are archived rather than discarded.",
  "warm, proud and naturally centre-stage, where dignity is not vanity but a working requirement. Generous when respected, brittle when overlooked.",
  "precise, analytical and quietly self-critical — the bearing of someone who notices what others miss and cannot then unnotice it. Service is genuine; perfectionism is the tax on it.",
  "gracious, balancing and relationship-oriented; you think by consulting. Charm is effortless, decisiveness is not.",
  "intense, private and penetrating, with feeling that runs deep and is rarely displayed. Loyalty is absolute and so is its withdrawal — this temperament does not do half-measures.",
  "expansive, principled and restless for meaning, needing both a horizon and a doctrine. Optimism is native; tact is acquired.",
  "disciplined, ambitious and realistic to the point of severity — you build slowly and never expected the world to be fair. Authority arrives with age and is deserved when it does.",
  "detached, systemic and unconventionally principled, thinking in groups and futures rather than individuals and moments. Independent to a fault, and warm in a way that surprises people.",
  "impressionable, compassionate and porous to atmosphere, absorbing whatever surrounds you and needing boundaries you are reluctant to build. Imagination and faith are the standing strengths.",
];

/** Moon sign → the mind's habitual weather. */
const MOON_MIND: string[] = [
  "reacts before it deliberates — fast, hot and honest about it. Emotions arrive at full strength and clear just as quickly.",
  "is steady, sensory and slow to disturb; once settled on something it does not let go. Comfort and routine are genuine emotional needs here, not indulgences.",
  "is restless and verbal, processing feeling by talking about it. Moods turn over quickly and are rarely as serious as they sound.",
  "is on home ground — deeply feeling, nurturing and retentive, with an unusually strong bond to mother, home and the past. Emotional memory is very long.",
  "needs to be seen and appreciated; feelings run dramatic, generous and proud, and slights land harder than you will admit.",
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
  "pioneering and self-starting: your identity is built on being first and being brave.",
  "patient and acquisitive: your identity rests on what has been built and held.",
  "curious and communicative: your identity rests on knowing things and saying them well.",
  "protective and rooted: your identity rests on belonging, and on caring for your own.",
  "sovereign and creative: identity is the most solid thing in this chart, and you are unmistakably yourself.",
  "discerning and useful: your identity rests on competence and on getting things right.",
  "relational and consultative: your identity is negotiated rather than asserted, which costs the Sun its natural authority but produces genuine fairness.",
  "intense and investigative: your identity is forged through crisis and rarely displayed intact.",
  "principled and expansive: your identity rests on beliefs held, defended and taught.",
  "disciplined and structural: your identity rests on responsibility carried and authority earned.",
  "independent and reforming: your identity rests on principle rather than on approval.",
  "compassionate and self-effacing: your identity dissolves easily into causes and into other people.",
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

/** "…the nakshatra Mula, quarter 1, whose ruler is Ketu. Its flavour is: …" */
function nakClause(p: PlanetPosition): string {
  return `the nakshatra ${NAKSHATRAS[p.nakshatra]}, in its ${ordinal(p.pada)} quarter, whose ruling planet is ${PLANET_NAMES[p.nakshatraLord]}. The flavour of that nakshatra is: ${NAKSHATRA_QUALITIES[p.nakshatra]}`;
}

function relationClause(p: PlanetPosition): string {
  switch (p.nakshatraRelation) {
    case "self":
      return `${PLANET_NAMES[p.id]} rules that nakshatra itself, so this quality comes through without interference.`;
    case "friend":
      return `${PLANET_NAMES[p.nakshatraLord]}, the nakshatra's ruler, is a friend of ${PLANET_NAMES[p.id]}, so this quality comes through warmly and is easy for others to read.`;
    case "enemy":
      return `${PLANET_NAMES[p.nakshatraLord]}, the nakshatra's ruler, is an enemy of ${PLANET_NAMES[p.id]}, so this quality is filtered through an unsympathetic hand and often reads to others as something you did not intend.`;
    default:
      return `${PLANET_NAMES[p.nakshatraLord]}, the nakshatra's ruler, is neutral toward ${PLANET_NAMES[p.id]}, so this quality comes through plainly — neither boosted nor blocked.`;
  }
}

/** "50 out of 100 (moderate)" — the composite strength, in words a reader can use. */
function gradeOf(strengths: Partial<Record<PlanetId, PlanetStrength>>, id: PlanetId): string {
  const s = strengths[id];
  return s ? `${s.score} out of 100 (${s.grade.toLowerCase()})` : "not scored";
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

  /* --- 1. Rising sign: body and bearing --- */
  const lagnaParas: string[] = [
    `Your rising sign (the 'Lagna' — the sign that was coming up over the eastern horizon at the moment you were born) is ${SIGNS[lagnaSign]}, at ${fmtDeg(chart.ascendant.degInSign)}. The rising sign describes how you come across, the body you live in, and the way you start things. With ${SIGNS[lagnaSign]} rising, the outward temperament is ${LAGNA_TEMPERAMENT[lagnaSign]}`,
    `The rising degree also falls in a nakshatra — one of the 27 star-groups the zodiac is divided into, each with its own character — called ${NAKSHATRAS[chart.ascendant.nakshatra]}, in its ${ordinal(chart.ascendant.pada)} quarter. That nakshatra colours the body and the first impression you make: ${NAKSHATRA_QUALITIES[chart.ascendant.nakshatra]}.`,
  ];
  if (lagnaLord) {
    lagnaParas.push(
      `Every sign has a ruling planet, and the ruler of your rising sign — ${PLANET_NAMES[lagnaLordId]} — is the planet that stands for you personally in the chart. It sits in your ${ordinal(lagnaLord.house)} house in ${SIGNS[lagnaLord.sign]}, which is ${DIGNITY_PLAIN[lagnaLord.dignity]}${lagnaLord.retrograde ? "; it is also retrograde, which turns its energy inward" : ""}${lagnaLord.combust ? "; it is also combust — so close to the Sun that its own light is drowned out" : ""}. Its overall strength (a combined score from its sign, house, aspects and other factors) comes to ${gradeOf(strengths, lagnaLordId)}. Because it sits in the ${ordinal(lagnaLord.house)}, the centre of gravity of your life leans toward ${HOUSE_SIGNIFICATIONS[lagnaLord.house - 1].split(",")[0]}: that is the agenda that colours everything you attempt, and your sense of who you are is bound up in it.`
    );
    lagnaParas.push(
      `${PLANET_NAMES[lagnaLordId]} itself falls in ${nakClause(lagnaLord)}. ${relationClause(lagnaLord)}`
    );
  } else {
    lagnaParas.push(
      `The ruler of your rising sign, ${PLANET_NAMES[lagnaLordId]}, has not been placed in this chart, so the rising sign's temperament stands on its own — place ${PLANET_NAMES[lagnaLordId]} to sharpen this reading considerably.`
    );
  }
  lagnaParas.push(roles.note);
  sections.push({ heading: "Your rising sign — how you come across", paragraphs: lagnaParas });

  /* --- 2. Moon: the mind --- */
  if (moon) {
    sections.push({
      heading: "Your Moon — the mind and its moods",
      paragraphs: [
        `In Vedic astrology the Moon stands for the mind: your moods, your instincts, what you need in order to feel safe. Your Moon is in ${SIGNS[moon.sign]} in your ${ordinal(moon.house)} house, which is ${DIGNITY_PLAIN[moon.dignity]}; its overall strength comes to ${gradeOf(strengths, "Mo")}. With the Moon in ${SIGNS[moon.sign]}, the mind ${MOON_MIND[moon.sign]}`,
        `The Moon falls in ${nakClause(moon)}. This is the single most personal signature in your chart: it sets the sequence of your planetary periods (the Vimshottari dasha, the timing system used throughout this app), and it describes how you actually experience your own life from the inside. ${relationClause(moon)}`,
        `Because the Moon sits in your ${ordinal(moon.house)} house, your emotional life revolves around ${HOUSE_SIGNIFICATIONS[moon.house - 1].split(",")[0]}. That is where you go for comfort, and it is also where you are most easily unsettled.`,
      ],
    });
  }

  /* --- 3. Sun: the will --- */
  if (sun) {
    sections.push({
      heading: "Your Sun — the will and the core self",
      paragraphs: [
        `The Sun stands for your will, your sense of self, and the things you need to be respected for. Your Sun is in ${SIGNS[sun.sign]} in your ${ordinal(sun.house)} house, which is ${DIGNITY_PLAIN[sun.dignity]}; its overall strength comes to ${gradeOf(strengths, "Su")}. With the Sun in ${SIGNS[sun.sign]}, the will is ${SUN_CORE[sun.sign]}`,
        `Because the Sun sits in your ${ordinal(sun.house)} house, your identity is staked on ${HOUSE_SIGNIFICATIONS[sun.house - 1].split(",")[0]}. This is the arena in which you need to matter, and a setback here feels like a failure of self rather than of circumstance.`,
        `The Sun falls in ${nakClause(sun)}. ${relationClause(sun)}`,
      ],
    });
  }

  /* --- 4. The strong / weak axis --- */
  if (strongest && weakest && strongest.p.id !== weakest.p.id) {
    const sName = PLANET_NAMES[strongest.p.id];
    const wName = PLANET_NAMES[weakest.p.id];
    sections.push({
      heading: "Your strongest and weakest planets",
      paragraphs: [
        `Each planet in your chart has been scored for overall strength out of 100 — a combination of the sign it is in, the house, the aspects it receives, and a few other classical factors. ${sName} is your strongest planet at ${strongest.s.score} (${strongest.s.grade.toLowerCase()}), sitting in your ${ordinal(strongest.p.house)} house in ${SIGNS[strongest.p.sign]}. Its qualities are the ones you reach for by default and perform best with under pressure — whatever ${sName} stands for is where you are genuinely, reliably competent. The biggest things in its favour are: ${strongest.s.factors
          .filter((f) => f.delta > 0)
          .slice(0, 3)
          .map((f) => f.label)
          .join("; ") || "modest gains across the board"}.`,
        `${wName} is your weakest at ${weakest.s.score} (${weakest.s.grade.toLowerCase()}), in your ${ordinal(weakest.p.house)} house in ${SIGNS[weakest.p.sign]}. This is the chart's soft flank: whatever ${wName} stands for is where you tend to over-compensate, avoid, or quietly hand off to other people. The biggest things weighing on it are: ${weakest.s.factors
          .filter((f) => f.delta < 0)
          .slice(0, 3)
          .map((f) => f.label)
          .join("; ") || "diffuse rather than acute"}.`,
        `A lot of your personality is the negotiation between these two. Growth, for this chart, looks less like adding to ${sName} — which needs no help — and more like refusing to let ${wName}'s weakness set the terms, because that is precisely the area you are most tempted to route around.`,
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
        `${PLANET_NAMES[ak.id]} is your Atmakaraka — literally the 'soul significator', the planet that has travelled furthest through its sign (${fmtDeg(ak.degInSign)}), which the Jaimini school of astrology treats as the planet carrying the deepest purpose of the life. In simple terms: whatever ${PLANET_NAMES[ak.id]} stands for — placed in your ${ordinal(ak.house)} house in ${SIGNS[ak.sign]} — is the lesson this life keeps returning to, in relationships, in work, everywhere. It is less "what you do" and more "what you cannot avoid becoming good at".`
      );
      akParas.push(
        `Its Karakamsa — the sign the Atmakaraka occupies in the Navamsa, the ninth-division chart — is ${SIGNS[jaimini.karakamsa]}: the inner room where that lesson is actually worked out. ${Article(jaimini.karakamsa)} ${SIGNS[jaimini.karakamsa]} Karakamsa colours the soul's work as ${LAGNA_TEMPERAMENT[jaimini.karakamsa]}`
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
      `The Navamsa (D-9) is a second chart derived from your birth chart by dividing each sign into nine parts. Tradition reads it for the inner person and for marriage, and treats it as the test of whether what the birth chart promises actually holds. Its rising sign is ${SIGNS[d9.ascendant]}. If the birth chart is how life presents itself, the Navamsa is how you are on the inside once the noise settles — and ${article(d9.ascendant)} ${SIGNS[d9.ascendant]} inner nature is ${LAGNA_TEMPERAMENT[d9.ascendant]} When the outer sign (${SIGNS[lagnaSign]}) and inner sign (${SIGNS[d9.ascendant]}) differ in element, people who only know you casually often misread you; those close to you meet the Navamsa.`,
    ];
    if (vargas.vargottama.length) {
      navParas.push(
        `${vargas.vargottama.map((id) => PLANET_NAMES[id]).join(", ")} ${vargas.vargottama.length === 1 ? "is" : "are"} 'Vargottama' — in the same sign in both the birth chart and the Navamsa. A Vargottama planet keeps its promises: what it shows on the surface is what it actually is underneath, and it holds steady under pressure.`
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
        `Shadbala is the full classical strength calculation — six separate measures (position, direction, time of birth, motion, nature and aspects) added together and expressed in units called rupas, with each planet having a minimum it is expected to reach. By that measure ${PLANET_NAMES[shadbala.strongest]} is your strongest planet at ${s.rupas.toFixed(2)} rupas (${Math.round(s.ratio * 100)}% of its required minimum) and ${PLANET_NAMES[shadbala.weakest]} the weakest at ${w.rupas.toFixed(2)} rupas (${Math.round(w.ratio * 100)}%). ${shadbala.strongest === (strongest?.p.id ?? "") ? "This agrees with the quicker overall score above, which makes the reading more solid." : "Note this differs from the quicker overall score above — the six-fold measure weighs birth-time and motion factors the quick score does not; where they disagree, the Shadbala verdict is the classical one."}`,
        `Practically: lean on ${PLANET_NAMES[shadbala.strongest]}'s themes when the stakes are high, and give ${PLANET_NAMES[shadbala.weakest]}'s themes more preparation time than feels necessary.`,
      ],
    });
  }

  /* --- 4e. Aspects on the rising sign --- */
  {
    const drishtis = drishtiOnHouse(chart, 1);
    if (drishtis.length) {
      const paras = [
        "Planets influence houses they do not sit in by 'aspecting' them — casting their influence across the chart to particular houses. Every planet aspects the 7th house from itself, and Mars, Jupiter, Saturn, Rahu and Ketu each have extra special aspects. The following planets aspect your rising sign, and each one edits the personality others meet:",
        ...drishtis.map((d) => {
          const src = chart.planets.find((p) => p.id === d.from);
          const from = src ? ` from your ${ordinal(src.house)} house` : "";
          return `${PLANET_NAMES[d.from]} aspects your rising sign${from} — ${drishtiCharacter(d.from, d.offset)}.`;
        }),
        "Each of these adds its own colour on top of the rising sign itself. If people describe you in ways that do not quite match the rising-sign portrait above, one of these planets is usually why.",
      ];
      sections.push({ heading: "Aspects on your rising sign — who edits the personality", paragraphs: paras });
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
          ? `The Arudha Lagna is the point in the chart that stands for your public image — how the world perceives you, as distinct from how you actually are. Yours falls in ${SIGNS[al]}, the same sign as your rising sign. What you project and what you are largely coincide: people's image of you is unusually accurate, which builds trust but also means there is nowhere to hide on a bad day.`
          : `The Arudha Lagna is the point in the chart that stands for your public image — how the world perceives you, as distinct from how you actually are. Yours falls in ${SIGNS[al]}, while your actual rising sign is ${SIGNS[lagnaSign]}. So the public image runs on ${SIGNS[al]}'s wavelength — ${LAGNA_TEMPERAMENT[al].split(/[.—]/)[0].trim()} — while the person underneath operates as ${SIGNS[lagnaSign]}. The gap is not dishonesty; it is simply that your reputation forms around the themes of your ${ordinal(((al - lagnaSign + 12) % 12) + 1)} house. Knowing which conversations are about the image and which are about you is a lifelong advantage.`,
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
      `A 'yoga' is a named combination of planets that the classical texts single out as producing a specific result. ${temperament.length === 1 ? "One combination in your chart stamps itself" : `${temperament.length} combinations in your chart stamp themselves`} directly on the character: ${uniqueNames(temperament)}.`
    );
    for (const y of temperament) yogaParas.push(`${y.name} — ${y.description}`);
  }
  if (resilience.length) {
    yogaParas.push(
      `Beneath that sits a resilience signature — ${uniqueNames(resilience)} — the combinations that convert this chart's difficulties into capability rather than damage. They rarely show early; they are what you are left holding after the hard decade.`
    );
    for (const y of resilience) yogaParas.push(`${y.name} — ${y.description}`);
  }
  if (!yogaParas.length) {
    yogaParas.push(
      "A 'yoga' is a named combination of planets that the classical texts single out as producing a specific result. None of the character-forming yogas this app checks for is present in your chart. That is not a deficiency — it means your personality is written by placement, sign comfort and planetary periods rather than by a single dominant combination, and it will read as more balanced and less extreme than a chart carrying one of the great named yogas."
    );
  }
  sections.push({ heading: "Yoga signatures in the personality", paragraphs: yogaParas });

  /* --- 6. Which planets work for you --- */
  const describe = (id: PlanetId): string => {
    const p = chart.planets.find((q) => q.id === id);
    if (!p) return `${PLANET_NAMES[id]} (not placed)`;
    return `${PLANET_NAMES[id]} — in your ${ordinal(p.house)} house, ${DIGNITY_INLINE[p.dignity]}, strength ${gradeOf(strengths, id)}`;
  };
  const functionalParas: string[] = [
    `Which planets help you and which hinder you is not fixed — it depends on your rising sign, because the rising sign decides which houses each planet rules. A planet that rules good houses for ${SIGNS[lagnaSign]} rising works in your favour whatever its natural reputation; one that rules difficult houses works against you even if it is a 'good' planet in general.`,
  ];
  if (roles.yogakaraka) {
    const yk = roles.yogakaraka;
    functionalParas.push(
      `${PLANET_NAMES[yk]} is the yogakaraka for ${SIGNS[lagnaSign]} rising — the single most helpful planet your rising sign can have, because it rules one of the corner houses and one of the fortunate houses at the same time. ${describe(yk)}. Its condition is the best single predictor of how far your personality converts into standing in the world.`
    );
  }
  if (roles.benefics.length) {
    functionalParas.push(
      `Working for you: ${roles.benefics.map(describe).join("; ")}. The traits these planets govern are the ones you can lean on without second-guessing, and their main periods (dashas) feel like the personality working as designed.`
    );
  }
  if (roles.malefics.length) {
    functionalParas.push(
      `Working against you: ${roles.malefics.map(describe).join("; ")}. These are not evil planets — they are the ones whose house rulerships pull against your rising sign's interests. Where one of them is strong, you have a talent that repeatedly gets you into trouble; where weak, a blind spot you rarely notice.`
    );
  }
  if (roles.neutrals.length) {
    functionalParas.push(
      `Neutral: ${roles.neutrals.map(describe).join("; ")}. These take their colour from whatever they sit with rather than carrying an agenda of their own.`
    );
  }
  sections.push({ heading: "Which planets work for you, and which against", paragraphs: functionalParas });

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
