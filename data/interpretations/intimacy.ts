import { aspectedSigns, drishtiOnHouse, planetsAspecting } from "@/utils/astrology/aspects";
import {
  NAKSHATRAS,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
  type PlanetId7,
} from "@/utils/astrology/constants";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { arudhaOfHouse, type JaiminiInfo } from "@/utils/astrology/jaimini";
import { norm360 } from "@/utils/astrology/math";
import { sputaDrishti, type BhavaBala, type ShadbalaSet } from "@/utils/astrology/shadbala";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { ChartData, PlanetId, YogaFinding } from "@/utils/astrology/types";
import { buildIntimacyDepth } from "./intimacyDepth";
import { buildTrimsamsaClaim } from "./trimsamsaClaim";
import { checkMangalDosha } from "./marriage";
import {
  appetiteOf,
  clashingNakshatras,
  GANA_TEMPERAMENT,
  isGandanta,
  traitOf,
  YONI_INFO,
} from "./nakshatraTraits";
import type { Evidence, SectionReport } from "./report";
import { plain, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Intimacy: sexual attraction, desire and pleasure, read as an adult wellbeing
 * section — frank, clinical-warm, and without moralising in either direction.
 *
 * SOURCES (per-rule citations ride on the Evidence rows; tabulated in
 * data/interpretations/SOURCES.md):
 *  - The **kama trikona** (3rd, 7th, 11th) as the desire trine, from the
 *    purushartha classification of the houses — dharma 1/5/9, artha 2/6/10,
 *    kama 3/7/11, moksha 4/8/12 (BPHS bhava chapters; Phaladeepika).
 *  - The **12th as `shayana sukha`** — the pleasures of the bed — is the
 *    classical remit of that house and the primary house for sexual pleasure
 *    proper (BPHS bhava-phala; Phaladeepika ch. on the 12th). Most popular
 *    readings miss it, which is why it carries real weight here.
 *  - **Venus as kama karaka**, Mars as the karaka of physical drive, the 8th
 *    for sexual energy and the reproductive organs, the 5th for romance and
 *    magnetism — BPHS Karakadhyaya and the standard bhava significations.
 *  - **Yoni kuta** and its seven enemy pairs, and **gana** — the ashtakuta
 *    matching tradition (see `nakshatraTraits.ts` for the table and its
 *    provenance).
 *  - **7th from the Karakamsa** for the character of partnered life — Jaimini
 *    Upadesa Sutras (Karakamsa chapter).
 *
 * ETHICAL BOUNDARIES, encoded here and repeated as visible UI copy:
 *  1. Adults only.
 *  2. Nothing in this file references the gender selection that reveals the
 *     tab, or infers anything about the native's gender, sex or identity.
 *  3. Sexual orientation and gender identity are **never** inferred or
 *     predicted from a chart. All prose is partner-neutral: no partner gender
 *     is assumed anywhere.
 *  4. No moralising. A strong appetite or a pull toward novelty is described
 *     as a temperament to work with, never as a defect.
 *  5. **The classical D-30 character rule is reported, never pronounced.**
 *     Trimsamsa is used in the older literature to judge moral conduct,
 *     overwhelmingly applied to women's charts. The rule is implemented (see
 *     `trimsamsaClaim.ts`) because a section that exists to let classical
 *     claims be checked should not quietly drop the awkward ones — but it is
 *     printed as an attributed claim under test, run identically whatever the
 *     chart's gender, with the source's moral vocabulary not reproduced and
 *     its contested status stated in the reader's own copy. Elsewhere D-30 is
 *     still read only for vulnerability. Recorded in the disagreement log.
 *  6. No medical diagnosis. Fertility, pain, dysfunction and infection are
 *     framed as worth raising with a clinician, never as findings.
 *  7. Analytical register only — no explicit content, no sexual instruction,
 *     and no advice about obtaining sex from another person. Consent and the
 *     other person's agency are assumed throughout and named where relevant.
 *  8. Non-fatalist: no "never", no "denied".
 *
 * Deterministic and pure: no astronomy beyond what the chart already carries,
 * no `Date.now()`, no randomness.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntimacyFacetKey = "attraction" | "desire" | "pleasure" | "fusion";

export interface IntimacyFacet {
  key: IntimacyFacetKey;
  label: string;
  /** 0–100. */
  score: number;
  reading: string;
}

export interface IntimacyCombination {
  key: string;
  name: string;
  /** What it does in practice, in the site's second-person voice. */
  text: string;
  weight: number;
  source?: Evidence["source"];
}

export interface DrishtiNote {
  /** Where the glance lands: a house number, or a planet. */
  target: string;
  from: PlanetId;
  /** Inclusive sign-count of the aspect that landed. */
  offset: number;
  /** Sputa-drishti value in virupas, 0–60 — how much of the glance arrives. */
  strength: number;
  text: string;
}

export interface YoniReading {
  /** Read from the Moon's nakshatra. */
  nakshatra: number;
  yoni: string;
  appetite: string;
  style: string;
  gana: string;
  /** Nakshatra names whose yoni classically clashes with this one. */
  clashesWith: string[];
  paragraphs: string[];
}

export interface IntimacyReport extends SectionReport {
  facets: IntimacyFacet[];
  strengths: Evidence[];
  frictions: Evidence[];
  combinations: IntimacyCombination[];
  drishti: DrishtiNote[];
  yoni: YoniReading;
  /** Nakshatra dispositor chains for the desire significators. */
  chains: string[];
  /** How desire tends to move across the life, by period lord. */
  lifeMovement: { lord: PlanetId; text: string }[];
  /** Every friction paired with something workable. */
  workingWith: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const DUSTHANA = [6, 8, 12];
const BENEFICS: PlanetId[] = ["Ju", "Ve", "Me", "Mo"];

/** Conjunction / mutual aspect / exchange, phrased. */
function link(chart: ChartData, a: PlanetId, b: PlanetId): string | null {
  if (a === b) return null;
  const pa = chart.planets.find((p) => p.id === a);
  const pb = chart.planets.find((p) => p.id === b);
  if (!pa || !pb) return null;
  if (pa.sign === pb.sign) return "share a sign";
  const aRulesB = SIGN_LORDS[pb.sign] === a;
  const bRulesA = SIGN_LORDS[pa.sign] === b;
  if (aRulesB && bRulesA) return `exchange signs (${plain("parivartana")})`;
  if ((pb.sign - pa.sign + 12) % 12 === 6) return "face each other across the chart";
  if (aspectedSigns(a, pa.sign).includes(pb.sign) || aspectedSigns(b, pb.sign).includes(pa.sign)) {
    return "aspect one another";
  }
  return null;
}

/**
 * How much of a glance actually arrives, in virupas (0–60), using the classical
 * sputa-drishti curve rather than treating drishti as on/off. For a *house*
 * there is no single longitude, so the sign's midpoint is used as the target —
 * an approximation, and the only one available at whole-sign resolution.
 */
function glanceStrength(chart: ChartData, from: PlanetId, targetLongitude: number): number {
  const p = chart.planets.find((q) => q.id === from);
  if (!p) return 0;
  return sputaDrishti(from, norm360(targetLongitude - p.longitude));
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function buildIntimacyReport(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  shadbala: ShadbalaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  yogas: YogaFinding[],
  ashtakavarga: AshtakavargaResult | null = null,
  bhavaBala: BhavaBala[] | null = null
): IntimacyReport {
  const lagna = chart.ascendant.sign;
  const caveats: string[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const lordOf = (house: number) => SIGN_LORDS[(lagna + house - 1) % 12];
  const signOfHouse = (house: number) => (lagna + house - 1) % 12;
  const score = (id: PlanetId) => strengths[id]?.score ?? 50;

  const ve = planetOf("Ve");
  const ma = planetOf("Ma");
  const mo = planetOf("Mo");
  const ra = planetOf("Ra");
  const ke = planetOf("Ke");
  const sa = planetOf("Sa");
  const ju = planetOf("Ju");

  const l7 = lordOf(7);
  const l12 = lordOf(12);
  const l8 = lordOf(8);
  const l5 = lordOf(5);

  const strengthRows: Evidence[] = [];
  const frictionRows: Evidence[] = [];
  const combinations: IntimacyCombination[] = [];

  const addCombination = (
    key: string,
    name: string,
    text: string,
    weight: number,
    source?: Evidence["source"]
  ) => {
    combinations.push({ key, name, text, weight, source });
    (weight >= 0 ? strengthRows : frictionRows).push({ text: `${name} — ${text}`, weight, source });
  };

  // --- Degradation notices --------------------------------------------------
  if (!shadbala) {
    caveats.push(
      "Shadbala — the classical strength measure — needs an exact birth time and place, which this chart does not carry. Venus and Mars are therefore graded on the quicker composite score, and the Ishta/Kashta reading (what a pleasure costs) is absent rather than estimated."
    );
  }
  if (!vargas) {
    caveats.push(
      "The divisional charts could not be built here, so the D-9 reading of private partnered life, the D-16 comfort reading and the D-7 reading are all missing from what follows."
    );
  }
  if (!jaimini) {
    caveats.push(
      "The Jaimini layer is unavailable for this chart, so the spouse significator, the 7th from the Karakamsa and the perceived-versus-lived distinction are not part of the reading."
    );
  }
  if (!chart.birthUtc) {
    caveats.push(
      "Without a birth time the house boundaries are approximate and there are no period dates, so the placements below read as indications rather than as measurements, and the life-movement section describes tendencies without attaching them to years."
    );
  }

  // -------------------------------------------------------------------------
  // Facet 1 — Attraction & magnetism
  // -------------------------------------------------------------------------
  let attraction = 45;
  {
    const lagnaLord = lordOf(1);
    const sL = score(lagnaLord);
    attraction += (sL - 50) * 0.3;
    (sL >= 50 ? strengthRows : frictionRows).push({
      text: `${PLANET_NAMES[lagnaLord]} rules your rising sign at ${sL}/100 — this is the planet that sets how you physically land on other people before you have said anything. ${
        sL >= 50
          ? "In good order it reads as presence: people notice you enter a room, and that noticing is not something you have to work for."
          : "Under strain it reads as a gap between how you feel and how you come across — you are often more interesting than your first impression manages to convey, which is a solvable problem rather than a fixed one."
      }`,
      weight: Math.round((sL - 50) * 0.3),
      source: { work: "BPHS", ref: "Lagna and its lord (the body)" },
    });

    const sVe = score("Ve");
    attraction += (sVe - 50) * 0.35;
    if (ve) {
      (sVe >= 50 ? strengthRows : frictionRows).push({
        text: `Venus — the karaka of desire and of everything pleasurable — stands ${DIGNITY_LABELS[ve.dignity].toLowerCase()} in your ${ordinal(ve.house)} house at ${sVe}/100. This is the centre of the whole reading: Venus describes what you find beautiful, what you want, and how easily you can show it.`,
        weight: Math.round((sVe - 50) * 0.35),
        source: { work: "BPHS", ref: "Shukra as kama karaka" },
      });
    }

    const malavya = yogas.find((y) => y.key === "mahapurusha-Ve");
    if (malavya) {
      attraction += 12;
      addCombination(
        "malavya",
        "Malavya Yoga",
        "Venus sits dignified in an angle — one of the five great-person combinations, and the classical signature of physical charm. People find you attractive before they find you interesting, which is pleasant and occasionally a nuisance: it means attention arrives that has nothing to do with who you actually are.",
        12,
        { work: "BPHS", ref: "Pancha Mahapurusha (Malavya)" }
      );
    }
    const ruchaka = yogas.find((y) => y.key === "mahapurusha-Ma");
    if (ruchaka) {
      attraction += 9;
      addCombination(
        "ruchaka",
        "Ruchaka Yoga",
        "Mars sits dignified in an angle. The magnetism here is physical rather than decorative — bearing, energy and a body that reads as capable. It is the kind of attraction that works at a distance and intensifies close up.",
        9,
        { work: "BPHS", ref: "Pancha Mahapurusha (Ruchaka)" }
      );
    }

    // Arudha Lagna versus the Lagna: perceived magnetism vs lived desire.
    if (jaimini) {
      const al = jaimini.arudhaLagna;
      const gap = ((al - lagna + 12) % 12) + 1;
      const alOccupants = chart.planets.filter((p) => p.sign === al);
      const flattering = alOccupants.some((p) => BENEFICS.includes(p.id)) || gap === 1;
      attraction += flattering ? 6 : -2;
      strengthRows.push({
        text: `Your ${plain("Arudha Lagna")} falls in ${SIGNS[al]}, ${gap === 1 ? "the same sign as your rising sign" : `${ordinal(gap)} from it`}${alOccupants.length ? `, with ${alOccupants.map((p) => PLANET_NAMES[p.id]).join(" and ")} there` : ""}. That is the distinction worth having in a reading about attraction: the Arudha describes how you are *perceived*, the rising sign describes what you actually are. ${
          gap === 1
            ? "Yours coincide, which means what people read off you is broadly accurate — there is less mismatch to manage than most people carry."
            : flattering
              ? "Yours diverge, and the perception runs ahead of the reality: you are read as more available or more confident than you privately feel, and that gap is worth naming to a partner early rather than letting it set expectations you did not choose."
              : "Yours diverge, and the perception runs behind the reality: you are read as more reserved than you are. People approach you less often than your actual interest would warrant, which means you tend to have to move first."
        }`,
        weight: flattering ? 6 : -2,
        source: { work: "Jaimini Upadesa Sutras", ref: "Arudha Lagna" },
      });
    }

    const secondOccupants = chart.planets.filter((p) => p.house === 2);
    if (secondOccupants.some((p) => BENEFICS.includes(p.id))) {
      attraction += 4;
      strengthRows.push({
        text: `${secondOccupants.filter((p) => BENEFICS.includes(p.id)).map((p) => PLANET_NAMES[p.id]).join(" and ")} in your 2nd house softens the face and the voice — the classical seat of both. A large part of how attractive people find you is carried in how you speak, which is an asset that does not fade with age the way looks do.`,
        weight: 4,
        source: { work: "BPHS", ref: "2nd bhava (face, speech)" },
      });
    }
  }
  attraction = clamp(Math.round(attraction), 0, 100);

  // -------------------------------------------------------------------------
  // Facet 2 — Desire & drive
  // -------------------------------------------------------------------------
  let desire = 42;
  {
    const sMa = score("Ma");
    desire += (sMa - 50) * 0.3 + (score("Ve") - 50) * 0.2;
    if (ma) {
      (sMa >= 50 ? strengthRows : frictionRows).push({
        text: `Mars stands ${DIGNITY_LABELS[ma.dignity].toLowerCase()} in your ${ordinal(ma.house)} house at ${sMa}/100. Mars is the heat: physical drive, initiative, and the willingness to want something out loud. ${
          sMa >= 50
            ? "In good order that reads as a straightforward libido — you know when you want someone, and you are not embarrassed about it."
            : "Under strain it reads as drive that arrives in bursts and then goes quiet for a while, which is a rhythm rather than a deficiency, and is much easier on a relationship once it is described to the other person."
        }`,
        weight: Math.round((sMa - 50) * 0.3),
        source: { work: "BPHS", ref: "Mangala as karaka of physical drive" },
      });
    }

    // The primary high-libido signature.
    const vm = link(chart, "Ve", "Ma");
    if (vm && ve && ma) {
      const hot = [5, 7, 8, 12].includes(ve.house) || [5, 7, 8, 12].includes(ma.house);
      const delta = hot ? 15 : 10;
      desire += delta;
      addCombination(
        "venus-mars",
        "Venus–Mars contact",
        `Venus and Mars ${vm}${hot ? `, and the contact touches your ${[ve.house, ma.house].filter((h) => [5, 7, 8, 12].includes(h)).map(ordinal).join(" and ")} house` : ""}. This is the primary high-libido signature in the classical scheme: wanting and acting are wired to the same switch. In practice desire arrives as a whole rather than in stages — attraction, arousal and initiative turn up together, and a partner who needs longer to warm up can find that a lot. The workable version of this is saying so early rather than managing it silently.`,
        delta,
        { work: "BPHS / Phaladeepika", ref: "Venus–Mars association" }
      );
    }

    // The kama trikona itself.
    const kamaOccupants = chart.planets.filter((p) => [3, 7, 11].includes(p.house));
    const kamaScore = [3, 7, 11].reduce((s, h) => s + score(lordOf(h)), 0) / 3;
    desire += (kamaScore - 50) * 0.2;
    strengthRows.push({
      text: `Your ${plain("kama trikona")} — the 3rd, 7th and 11th, the trine of desire — is ruled by ${[3, 7, 11].map((h) => PLANET_NAMES[lordOf(h)]).join(", ")}, averaging ${Math.round(kamaScore)}/100${kamaOccupants.length ? `, with ${kamaOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} occupying it` : " and standing empty of occupants"}. This trine is where wanting lives in the classical scheme, as distinct from loving (the 5th) or from the bed itself (the 12th).`,
      weight: Math.round((kamaScore - 50) * 0.2),
      source: { work: "BPHS", ref: "purushartha classification of the bhavas" },
    });

    // The 8th: intensity, taboo, the unspoken layer.
    const eighthOccupants = chart.planets.filter((p) => p.house === 8);
    const s8 = score(l8);
    if (eighthOccupants.length) {
      const delta = eighthOccupants.some((p) => ["Ma", "Ra", "Ve"].includes(p.id)) ? 8 : 3;
      desire += delta;
      strengthRows.push({
        text: `${eighthOccupants.map((p) => PLANET_NAMES[p.id]).join(" and ")} occupies your 8th house — the house of sexual energy, of what is hidden, and of transformation through intimacy. Placements here mark desire that runs deeper and more privately than you show: there is usually a layer you have never said out loud, and it is not the shameful thing you may have assumed it is.`,
        weight: delta,
        source: { work: "BPHS", ref: "8th bhava (guhya — the concealed)" },
      });
    }
    desire += (s8 - 50) * 0.1;

    // Rahu's appetite.
    if (ra && [1, 5, 7, 8, 12].includes(ra.house)) {
      desire += 8;
      addCombination(
        `rahu-${ra.house}`,
        `Rahu in your ${ordinal(ra.house)} house`,
        ra.house === 7
          ? "Rahu on the partnership axis gives real magnetism and a pull toward people outside your usual circle — different background, different culture, different age. It also gives an appetite that convention does not satisfy easily, which is a temperament rather than a problem: it asks for honesty about what you actually want rather than for restraint you will not sustain."
          : ra.house === 12
            ? "Rahu in the 12th runs desire through fantasy and privacy: what happens in your head is a substantial part of your sexual life, and secrecy can become erotic in its own right. Named openly with a partner that is an asset; unnamed it becomes a separate room in the relationship."
            : `Rahu in your ${ordinal(ra.house)} house amplifies appetite and pushes it toward the new. Novelty genuinely works on you — the same thing repeated loses charge faster for you than for most people — and that is a temperament to design around rather than to apologise for.`,
        8,
        { work: "later tradition", ref: "Rahu as karaka of insatiability and the unconventional" }
      );
    }

    if (shadbala) {
      for (const id of ["Ve", "Ma"] as PlanetId7[]) {
        const sb = shadbala.planets[id];
        const delta = sb.ratio >= 1 ? 5 : -5;
        desire += delta * 0.6;
        (delta > 0 ? strengthRows : frictionRows).push({
          text: `${PLANET_NAMES[id]} reaches ${Math.round(sb.ratio * 100)}% of its classical ${plain("Shadbala")} requirement, with ${plain("Ishta phala")} ${Math.round(sb.ishta)} against ${plain("Kashta phala")} ${Math.round(sb.kashta)}. ${
            sb.kashta > sb.ishta
              ? "The cost side runs ahead of the yield side, which in this department reads as pleasure that tends to arrive with complication attached — timing, circumstance, or someone's feelings."
              : "The yield side runs ahead of the cost side, so what this planet gives here tends to come without a bill attached."
          }`,
          weight: delta,
          source: { work: "BPHS", ref: "Shadbala minimum-requirement table" },
        });
      }
    }
  }
  desire = clamp(Math.round(desire), 0, 100);

  // -------------------------------------------------------------------------
  // Facet 3 — Pleasure & satisfaction (the 12th — shayana sukha)
  // -------------------------------------------------------------------------
  let pleasure = 45;
  {
    const s12 = score(l12);
    const p12 = planetOf(l12);
    pleasure += (s12 - 50) * 0.3;
    strengthRows.push({
      text: `${PLANET_NAMES[l12]} rules your 12th house at ${s12}/100${p12 ? `, sitting in your ${ordinal(p12.house)}` : ""}. The 12th is ${plain("shayana sukha")} — the classical house of the bed and its pleasures, and the one most popular readings skip past on their way to the 7th. Its condition says more about whether sex is actually enjoyable for you than the 7th house ever does.`,
      weight: Math.round((s12 - 50) * 0.3),
      source: { work: "BPHS / Phaladeepika", ref: "12th bhava (shayana sukha)" },
    });

    const twelfthOccupants = chart.planets.filter((p) => p.house === 12);
    for (const p of twelfthOccupants) {
      const benefic = BENEFICS.includes(p.id);
      const delta = p.id === "Ve" ? 14 : benefic ? 7 : p.id === "Sa" ? -8 : -4;
      pleasure += delta;
      if (p.id === "Ve") {
        addCombination(
          "venus-12",
          "Venus in the 12th",
          "Venus occupies your 12th house — classically the single best placement in the chart for bed pleasures. The tradition is unambiguous here: comfort, sensuality and genuine enjoyment of the physical side of intimacy. It also tends to mean you need privacy and unhurried time for any of it to work; sex snatched between other commitments is not what this placement is built for.",
          14,
          { work: "Phaladeepika", ref: "Venus in the 12th (shayana sukha)" }
        );
      } else if (p.id === "Sa") {
        addCombination(
          "saturn-12",
          "Saturn in the 12th",
          "Saturn occupies your 12th house, which classically thins the pleasures of the bed and disturbs rest along with them. In practice that reads as long stretches without a sexual life — sometimes chosen, sometimes circumstantial — and as a body that takes longer to relax into intimacy than it should. It also reads as durability: what Saturn slows, it also makes last. Warmth, time and an unhurried setting do more for this placement than anything else, and persistent difficulty relaxing or sleeping is worth raising with a clinician rather than reading only as astrology.",
          -8,
          { work: "Phaladeepika", ref: "Saturn in the 12th" }
        );
      } else {
        strengthRows.push({
          text: `${PLANET_NAMES[p.id]} occupies your 12th house of bed pleasures — ${benefic ? "a gentle planet in a tender place, which reads as ease: you relax into intimacy rather than performing it" : "a hard planet in a tender place, which reads as sleep and intimacy both being more easily disturbed than they need to be"}.`,
          weight: delta,
          source: { work: "BPHS", ref: "12th bhava occupancy" },
        });
      }
    }

    // Benefic drishti on the 12th and the 4th.
    for (const house of [12, 4]) {
      const glances = drishtiOnHouse(chart, house);
      const benefic = glances.filter((g) => BENEFICS.includes(g.from));
      if (benefic.length) {
        const delta = house === 12 ? 6 : 4;
        pleasure += delta;
        strengthRows.push({
          text: `${benefic.map((g) => PLANET_NAMES[g.from]).join(" and ")} ${benefic.length === 1 ? "casts its glance" : "cast their glances"} on your ${ordinal(house)} house${house === 12 ? " of the bed" : " of the home and of feeling safe"} — a benefic aspect on a private house is one of the quieter, more reliable good indications in a chart like this. It shows up as intimacy that feels unforced.`,
          weight: delta,
          source: { work: "BPHS", ref: "benefic drishti on the bhava" },
        });
      }
    }

    const fourthLord = planetOf(lordOf(4));
    if (fourthLord && DUSTHANA.includes(fourthLord.house)) {
      pleasure -= 6;
      frictionRows.push({
        text: `Your 4th ruler sits in the ${ordinal(fourthLord.house)}, one of the harder houses. The 4th is emotional safety and the room you actually sleep in — under pressure it reads as difficulty switching off, and sex is one of the first things that goes when a person cannot relax at home. Fixing the setting often does more here than working on the relationship does.`,
        weight: -6,
        source: { work: "Phaladeepika", ref: "4th lord in dusthana" },
      });
    }

    // D-16: luxuries, comforts, sensual pleasure.
    if (vargas) {
      const d16 = vargas.charts.D16;
      const veD16 = vargaPositionOf(d16, "Ve");
      if (veD16) {
        const good = ["exalted", "own", "moolatrikona", "greatFriend"].includes(veD16.dignity);
        pleasure += good ? 7 : -3;
        (good ? strengthRows : frictionRows).push({
          text: `In your ${plain("Shodasamsa")} — the divisional chart read specifically for comforts and sensual pleasure — Venus lands in ${SIGNS[veD16.sign]}, ${DIGNITY_LABELS[veD16.dignity].toLowerCase()}. ${
            good
              ? "Strong there means the pleasure is real rather than theoretical: your body cooperates, and satisfaction is something you actually reach rather than approach."
              : "Weak there means the appetite can outrun the satisfaction — wanting arrives more reliably than being satisfied does. That is a pacing problem more often than a physical one, and it responds to slowing down."
          }`,
          weight: good ? 7 : -3,
          source: { work: "BPHS", ref: "Ch.6 (Shodasamsa)" },
        });
      }
    }
  }
  pleasure = clamp(Math.round(pleasure), 0, 100);

  // -------------------------------------------------------------------------
  // Facet 4 — Intimacy & emotional fusion
  // -------------------------------------------------------------------------
  let fusion = 45;
  {
    const sMo = score("Mo");
    fusion += (sMo - 50) * 0.35;
    if (mo) {
      (sMo >= 50 ? strengthRows : frictionRows).push({
        text: `Your Moon stands ${DIGNITY_LABELS[mo.dignity].toLowerCase()} in your ${ordinal(mo.house)} house at ${sMo}/100. The Moon decides whether your mind shows up when your body does. ${
          sMo >= 50
            ? "In good order, physical closeness lands emotionally — sex leaves you feeling closer to someone rather than merely satisfied."
            : "Under strain, the body can be fully present while the mind stays a step back. That is not coldness; it is a nervous system that needs more safety before it will let go, and it improves markedly with familiarity and with being unhurried."
        }`,
        weight: Math.round((sMo - 50) * 0.35),
        source: { work: "BPHS", ref: "Chandra as karaka of the mind" },
      });
    }

    const vm = link(chart, "Ve", "Mo");
    if (vm) {
      fusion += 8;
      addCombination(
        "venus-moon",
        "Venus–Moon contact",
        `Venus and the Moon ${vm}. Affection and desire run on the same circuit for you: you want the people you are fond of, and being fond of someone makes them more attractive rather than less. It is an easy temperament to live with and it makes casual encounters less satisfying than they look on paper.`,
        8,
        { work: "BPHS", ref: "Venus–Moon association" }
      );
    }

    const seventhSupport = drishtiOnHouse(chart, 7).filter((g) => BENEFICS.includes(g.from));
    if (seventhSupport.length) {
      fusion += 6;
      strengthRows.push({
        text: `${seventhSupport.map((g) => PLANET_NAMES[g.from]).join(" and ")} aspects your 7th house of partnership. A benefic glance on the 7th is what makes closeness comfortable rather than effortful — arguments resolve, and the ordinary business of living beside someone does not grind.`,
        weight: 6,
        source: { work: "BPHS", ref: "benefic drishti on the 7th" },
      });
    }

    if (ke && [7, 12].includes(ke.house)) {
      fusion -= 8;
      addCombination(
        `ketu-${ke.house}`,
        `Ketu in your ${ordinal(ke.house)} house`,
        ke.house === 7
          ? "Ketu on the partnership axis reads as ambivalence: you can be genuinely close to someone and simultaneously half-detached, and the detachment is not a judgement on them. Classically it also marks a karmic quality to close relationships — they feel already-known and they end without much argument. Naming the ambivalence to a partner is far kinder than letting them interpret it."
          : "Ketu in the 12th reads as withdrawal from the physical side — periods of genuine disinterest that arrive without a cause and lift the same way. With a strong 8th house that redirects rather than disappears: the same energy turns up as practice, discipline or intensity of another kind. Neither version is a defect, and neither is permanent.",
        -8,
        { work: "later tradition", ref: "Ketu as karaka of detachment" }
      );
    }

    // Jupiter dominating the 7th cools raw heat — say it plainly.
    if (ju) {
      const seventhSign = signOfHouse(7);
      const juOn7 = ju.sign === seventhSign || aspectedSigns("Ju", ju.sign).includes(seventhSign);
      if (juOn7 && score("Ju") >= 55) {
        fusion += 5;
        addCombination(
          "jupiter-7",
          "Jupiter on the 7th",
          "Jupiter is strong and influences your 7th house. That is genuinely good for the relationship — generosity, fairness, an ethical frame, a partner treated well — and the classics are equally clear that it cools raw heat. A dominant Jupiter tends to make intimacy respectful and companionable rather than urgent, which suits some people entirely and leaves others quietly wondering where the fire went. If that describes you, the answer is usually deliberate rather than spontaneous: heat here has to be planned for, and that is not a failure.",
          5,
          { work: "Phaladeepika", ref: "Jupiter's influence on the 7th" }
        );
      }
    }

    // D-9: the private texture of partnered life.
    if (vargas) {
      const d9 = vargas.charts.D9;
      const d9Seventh = (d9.ascendant + 6) % 12;
      const d9SeventhOcc = d9.positions.filter((p) => p.sign === d9Seventh && p.id !== "Ra" && p.id !== "Ke");
      const veD9 = vargaPositionOf(d9, "Ve");
      const vargottama = veD9?.vargottama ?? false;
      if (vargottama) fusion += 6;
      strengthRows.push({
        text: `Your ${plain("Navamsa")} rising sign is ${SIGNS[d9.ascendant]}, its 7th house falls in ${SIGNS[d9Seventh]}${d9SeventhOcc.length ? ` with ${d9SeventhOcc.map((p) => PLANET_NAMES[p.id]).join(", ")} there` : " with nothing in it"}, and Venus lands in ${veD9 ? SIGNS[veD9.sign] : "—"}${vargottama ? `, ${plain("Vargottama")}` : ""}. Read this as the private texture of partnered life — what the two of you are actually like behind a closed door, as opposed to what the relationship looks like from outside.${vargottama ? " Venus holding the same sign in both charts is a mark of stability: what it promises tends to hold." : ""}`,
        weight: vargottama ? 6 : 2,
        source: { work: "BPHS", ref: "Ch.6 (Navamsa)" },
      });
    }

    // Jaimini: the 7th from the Karakamsa.
    if (jaimini) {
      const seventhFromKarakamsa = (jaimini.karakamsa + 6) % 12;
      const occ = chart.planets.filter((p) => p.sign === seventhFromKarakamsa);
      const delta = occ.some((p) => p.id === "Ve") ? 8 : occ.some((p) => p.id === "Ra") ? 0 : occ.some((p) => p.id === "Ke") ? -6 : 2;
      fusion += delta;
      strengthRows.push({
        text: `The 7th sign from your ${plain("Karakamsa")} is ${SIGNS[seventhFromKarakamsa]}${occ.length ? `, holding ${occ.map((p) => PLANET_NAMES[p.id]).join(" and ")}` : " and standing empty"}. This is the Jaimini seat for the character of partnered and sexual life. ${
          occ.some((p) => p.id === "Ve")
            ? "Venus there elevates it: pleasure, refinement and a genuine appetite for closeness."
            : occ.some((p) => p.id === "Ra")
              ? "Rahu there makes it unconventional — the shape your intimate life takes is unlikely to be the shape you were raised to expect, and forcing the conventional version rarely works."
              : occ.some((p) => p.id === "Ke")
                ? "Ketu there detaches it: closeness matters to you and something in you keeps a door open to leaving. Worth knowing about yourself, and worth telling someone who is trying to reach you."
                : "With no occupant, the reading falls to the sign's own nature and to whatever aspects it — a quieter signal than an occupied one, and worth weighting accordingly."
        }`,
        weight: delta,
        source: { work: "Jaimini Upadesa Sutras", ref: "7th from the Karakamsa" },
      });

      const dk = planetOf(jaimini.karakas.DK);
      if (dk) {
        strengthRows.push({
          text: `${PLANET_NAMES[dk.id]} is your ${plain("Darakaraka")}, sitting in your ${ordinal(dk.house)} house. The people you are drawn to tend to carry that planet's signature — its temperament and its pace — closely enough that the description usually feels recognisable once you have met a few of them.`,
          weight: 2,
          source: { work: "Jaimini Upadesa Sutras", ref: "chara karakas" },
        });
      }
      const upapada = jaimini.upapada;
      const a7 = arudhaOfHouse(chart, 7);
      strengthRows.push({
        text: `Your ${plain("Upapada Lagna")} falls in ${SIGNS[upapada]} and the arudha of your 7th house in ${SIGNS[a7]}. Those two describe the *institution* of partnership — the household, the public fact of being with someone — as distinct from the desire this section is mostly about. They are worth reading side by side, because a chart can be warm in one and cool in the other, and that mismatch is a common and entirely liveable shape.`,
        weight: 1,
        source: { work: "Jaimini Upadesa Sutras", ref: "Upapada and arudha padas" },
      });
    }
  }
  fusion = clamp(Math.round(fusion), 0, 100);

  // -------------------------------------------------------------------------
  // Remaining named combinations
  // -------------------------------------------------------------------------
  if (ve) {
    for (const other of ["Ra", "Sa", "Ke"] as PlanetId[]) {
      const l = link(chart, "Ve", other);
      if (!l) continue;
      const cfg: Record<string, { text: string; weight: number }> = {
        Ra: {
          text: `Venus and Rahu ${l}. Appetite beyond convention: intensity, curiosity, and a real pull toward what you have not tried. This combination is where the tradition tends to get moralistic, and there is no reason to — it describes a temperament, not a failing. What it genuinely asks for is honesty with the people involved and attention to consent on both sides, because Rahu's appetite is not naturally self-limiting.`,
          weight: 4,
        },
        Sa: {
          text: `Venus and Saturn ${l}. Restraint, delay and durability in one package: desire that takes longer to arrive and lasts considerably longer once it does. Early adult life under this combination is often thinner than you would like, and the later years are usually better than most people's — Saturn pays late, but it does pay.`,
          weight: -3,
        },
        Ke: {
          text: `Venus and Ketu ${l}. Ambivalence about pleasure itself: real desire alongside a quiet suspicion of it, and sometimes guilt that has no clear origin. Classically this marks relationships that feel karmic and end without resolution. The workable version is separating the ambivalence from the person in front of you — it usually belongs to you rather than to them.`,
          weight: -4,
        },
      };
      const c = cfg[other];
      addCombination(`venus-${other}`, `Venus–${PLANET_NAMES[other]} contact`, c.text, c.weight, {
        work: "BPHS / Phaladeepika",
        ref: "Venus associations",
      });
    }
    if (ve.combust) {
      addCombination(
        "venus-combust",
        "Venus combust",
        "Venus sits too close to the Sun to shine on its own — what the tradition calls combustion. Desire is present and its expression gets overshadowed, usually by ego, pride or the need to be seen a particular way. In practice it reads as difficulty asking for what you want plainly, which is a communication problem with a communication fix rather than a fault in the appetite itself.",
        -6,
        { work: "BPHS", ref: "asta (combustion)" }
      );
    }
    if (ve.dignity === "debilitated") {
      const cancelled = yogas.some((y) => y.key === "nbrj-Ve");
      addCombination(
        "venus-debilitated",
        `Venus debilitated${cancelled ? " with cancellation" : ""}`,
        `Venus is debilitated in ${SIGNS[ve.sign]}${cancelled ? `, and your chart carries the ${plain("Neechabhanga")} that cancels it` : ""}. Debilitated Venus classically reads as self-criticism aimed at your own body and your own wanting — a purity conflict, in the older language. ${
          cancelled
            ? "With the cancellation present, this is the part of the chart most likely to improve dramatically with age: what is awkward at twenty-five is often the most confident thing about someone at forty."
            : "Uncancelled, it asks for patience with yourself. The appetite is intact; the permission is what needs building, and that is ordinary work rather than an astrological sentence."
        }`,
        cancelled ? -2 : -7,
        { work: "BPHS", ref: "exaltation/debilitation scheme" }
      );
    }
    if (isGandanta(ve.nakshatra, ve.pada)) {
      addCombination(
        "venus-gandanta",
        "Venus in Gandanta",
        `Venus sits in ${plain("Gandanta")} — the junction where a water sign meets a fire sign, which the tradition reads as a knot. In this department it reads as desire that has something tangled at its root: an early experience, a family attitude, something inherited rather than chosen. Knots come undone; that is what distinguishes them from walls.`,
        -4,
        { work: "BPHS / Muhurta literature", ref: "Gandanta junctions" }
      );
    }
  }
  if (mo && isGandanta(mo.nakshatra, mo.pada)) {
    addCombination(
      "moon-gandanta",
      "Moon in Gandanta",
      `Your Moon sits in ${plain("Gandanta")}. Emotionally that reads as a tender spot right at the centre of how you attach — closeness can trigger something older than the relationship you are actually in. It is workable, and it is the kind of thing that responds better to being talked about than to being managed alone.`,
      -4,
      { work: "BPHS / Muhurta literature", ref: "Gandanta junctions" }
    );
  }

  if (ma && [7, 8, 12].includes(ma.house)) {
    addCombination(
      `mars-${ma.house}`,
      `Mars in your ${ordinal(ma.house)} house`,
      ma.house === 7
        ? "Mars in the 7th brings heat directly into partnership — passion and friction from the same source. Arguments and desire are closely related for you, which some partners find electric and others find exhausting; knowing which one you are with matters more than the placement does."
        : ma.house === 8
          ? "Mars in the 8th is the classical marker of strong sexual energy and of intensity that goes deeper than recreation. It also asks for care around the body: this placement is one where physical symptoms are worth raising with a clinician early rather than pushing through."
          : "Mars in the 12th puts drive into the private house — considerable energy in the bed and a tendency for it to run at odd hours and outside routine. Sleep tends to pay the price, which is worth watching.",
      ma.house === 8 ? 6 : 4,
      { work: "BPHS / Phaladeepika", ref: "Mars in the 7th/8th/12th" }
    );
  }

  const mangal = checkMangalDosha(chart);
  if (mangal.present) {
    addCombination(
      "mangal-dosha",
      mangal.effective ? "Mangal Dosha (uncancelled)" : "Mangal Dosha (cancelled)",
      mangal.effective
        ? `${plain("Mangal Dosha")} forms and none of the standard cancellations applies. Read for this section rather than for matching, it describes heat: force and impatience carried into close partnership, a low tolerance for being managed, and early years where that shows. The overlap with the intimacy reading is direct — the same Mars that makes the dosha is the one supplying the drive.`
        : `${plain("Mangal Dosha")} technically forms but your chart cancels it (${mangal.cancellations.join("; ")}). The heat is present without the affliction the matching tradition warns about — directness rather than damage.`,
      mangal.effective ? -4 : 1,
      { work: "matching tradition", ref: "Kuja Dosha" }
    );
  }

  // 7th ↔ 12th and 5th ↔ 7th/12th links.
  const l7l12 = link(chart, l7, l12);
  if (l7l12 && l7 !== l12) {
    addCombination(
      "7-12-link",
      "7th and 12th rulers linked",
      `The rulers of your 7th and your 12th — ${PLANET_NAMES[l7]} and ${PLANET_NAMES[l12]} — ${l7l12}. This is one of the better indications in the whole scheme: the person you partner with and the bed you share are wired to the same circuit, so the sexual bond inside the partnership is a genuine load-bearing part of it rather than an add-on. Relationships where that side goes quiet tend not to survive for you, which is worth knowing in advance.`,
      10,
      { work: "BPHS", ref: "7th–12th lord association" }
    );
  } else if (l7 === l12) {
    addCombination(
      "7-12-same",
      "One ruler for the 7th and the 12th",
      `${PLANET_NAMES[l7]} rules both your 7th house of partnership and your 12th of the bed, which fuses the two completely: for you, partnership and sexual life are not separable questions. That planet's condition and its periods carry both.`,
      6,
      { work: "BPHS", ref: "shared lordship" }
    );
  }
  for (const target of [7, 12]) {
    const lt = lordOf(target);
    const l5t = link(chart, l5, lt);
    if (l5t && l5 !== lt) {
      addCombination(
        `5-${target}-link`,
        `5th and ${ordinal(target)} rulers linked`,
        `${PLANET_NAMES[l5]}, ruler of your 5th house of romance, and ${PLANET_NAMES[lt]}, ruler of your ${ordinal(target)}, ${l5t}. Romance and ${target === 7 ? "partnership" : "sex"} land in the same person for you rather than in separate ones — being in love and wanting someone are the same event. That makes for intense relationships and it makes arrangements that split the two unsatisfying, whatever their other merits.`,
        7,
        { work: "BPHS", ref: "5th lord association" }
      );
    }
  }
  const p8 = planetOf(l8);
  const p12b = planetOf(l12);
  if ((p8 && p8.house === 12) || (p12b && p12b.house === 8)) {
    addCombination(
      "8-12-exchange",
      "The 8th and 12th houses interlock",
      `${p8 && p8.house === 12 ? `Your 8th ruler ${PLANET_NAMES[l8]} sits in your 12th` : `Your 12th ruler ${PLANET_NAMES[l12]} sits in your 8th`}. Intensity, secrecy and transformation through intimacy: sex is not recreational for you in the way it is for some people — it changes things, and you know it at the time. That is a strength with a cost attached, and the cost is usually that casual arrangements do not stay casual.`,
      3,
      { work: "Phaladeepika", ref: "8th/12th lord interchange" }
    );
  }

  // -------------------------------------------------------------------------
  // Drishti block — sputa-weighted rather than binary
  // -------------------------------------------------------------------------
  const drishti: DrishtiNote[] = [];
  for (const house of [5, 7, 8, 12, 1]) {
    const sign = signOfHouse(house);
    const midpoint = sign * 30 + 15;
    for (const g of drishtiOnHouse(chart, house)) {
      const strength = Math.round(glanceStrength(chart, g.from, midpoint));
      const benefic = BENEFICS.includes(g.from);
      drishti.push({
        target: `${ordinal(house)} house`,
        from: g.from,
        offset: g.offset,
        strength,
        text: `${PLANET_NAMES[g.from]} casts its ${ordinal(g.offset)} glance on your ${ordinal(house)} house${
          strength >= 45 ? " and lands it almost fully" : strength >= 25 ? " at moderate force" : " weakly — the glance is technically there and arrives thin"
        }. ${
          benefic
            ? house === 12
              ? "A gentle planet on the house of the bed eases the whole business: less performance, more comfort."
              : "A gentle planet here softens the house and makes its business less effortful."
            : g.from === "Sa"
              ? "Saturn's glance slows a house down and makes it serious — with this one it means things take longer to arrive and last longer once they do."
              : g.from === "Ma"
                ? "Mars's glance heats a house up: more urgency, less patience, and a shorter fuse in whatever this house governs."
                : "A nodal glance makes the house restless and unconventional — the ordinary version of it rarely satisfies."
        }`,
      });
    }
  }
  for (const target of ["Ve", "Ma"] as PlanetId[]) {
    const tp = planetOf(target);
    if (!tp) continue;
    for (const from of planetsAspecting(chart, target)) {
      const strength = Math.round(glanceStrength(chart, from, tp.longitude));
      drishti.push({
        target: PLANET_NAMES[target],
        from,
        offset: ((tp.sign - (planetOf(from)?.sign ?? 0) + 12) % 12) + 1,
        strength,
        text: `${PLANET_NAMES[from]} aspects your ${PLANET_NAMES[target]} at ${strength} of 60 virupas${
          strength >= 45 ? " — a full-strength glance, so this influence genuinely shapes how that planet behaves" : strength >= 25 ? " — a moderate glance, present without dominating" : " — a thin glance, worth noting and not worth over-reading"
        }. ${
          BENEFICS.includes(from)
            ? `That is a supportive influence on ${target === "Ve" ? "your capacity for pleasure" : "your physical drive"}.`
            : `That is a pressuring influence on ${target === "Ve" ? "your capacity for pleasure — it tends to arrive with conditions attached" : "your physical drive — it makes the drive less even than it looks"}.`
        }`,
      });
    }
  }
  drishti.sort((a, b) => b.strength - a.strength);

  // -------------------------------------------------------------------------
  // Nakshatra & yoni block
  // -------------------------------------------------------------------------
  // The native's own yoni is read from the Moon's nakshatra, which is the
  // classical seat; the rising nakshatra stands in only when the Moon is
  // missing from a degenerate manual chart.
  const yoniNak = mo ? mo.nakshatra : chart.ascendant.nakshatra;
  const trait = traitOf(yoniNak);
  const yInfo = YONI_INFO[trait.yoni];
  const appetite = appetiteOf(yoniNak);
  const clashes = clashingNakshatras(yoniNak);

  const yoniParagraphs: string[] = [];
  yoniParagraphs.push(
    `Your ${plain("Yoni kuta")} class is read from ${mo ? "your Moon's nakshatra" : "your rising nakshatra, since the Moon is not placed in this chart"}, ${NAKSHATRAS[yoniNak]}, which carries the ${yInfo.label} yoni. The classical scheme assigns each nakshatra an animal, and matching traditions use it to judge physical compatibility between two people. Read for one chart it describes your own temperament: ${yInfo.style}.`
  );
  yoniParagraphs.push(
    `The ${yInfo.label} sits in the ${appetite === "high" ? "larger, more vigorous" : appetite === "moderate" ? "middle" : "smaller, gentler"} band of that ordering, which reads as a ${appetite === "high" ? "strong and fairly constant" : appetite === "moderate" ? "moderate and situational" : "lower-key and selective"} appetite. Two honest qualifications: the size ordering is classical, calling it "appetite" is this app's reading rather than a shastric claim, and a single chart cannot tell you what any particular week of your life feels like.`
  );
  yoniParagraphs.push(
    `The ${yInfo.label}'s classical opposite is the ${yInfo.enemy}${clashes.length ? ` (${clashes.map((c) => c.name).join(", ")})` : ""}. In matching terms that pairing is held to grate physically — different pace, different idea of what closeness is for. It is a friction to name rather than a disqualification, and plenty of long relationships run across it. Proper compatibility work needs the other person's chart, and none is being done here.`
  );
  yoniParagraphs.push(
    `Your ${plain("gana")} is ${trait.gana}: ${GANA_TEMPERAMENT[trait.gana]}`
  );
  yoniParagraphs.push(
    `The star's own sensual character: ${trait.sensual}.${
      ve && ve.nakshatra !== yoniNak
        ? ` Venus adds a second layer from ${NAKSHATRAS[ve.nakshatra]} — ${traitOf(ve.nakshatra).sensual} — and where the two disagree, the Moon usually describes what you need and Venus what you are drawn to.`
        : ""
    }`
  );

  const yoni: YoniReading = {
    nakshatra: yoniNak,
    yoni: yInfo.label,
    appetite,
    style: yInfo.style,
    gana: trait.gana,
    clashesWith: clashes.map((c) => c.name),
    paragraphs: yoniParagraphs,
  };

  // Dispositor chains for the desire significators.
  const chainTargets: [PlanetId, string][] = [
    ["Ve", "Venus, your karaka of desire"],
    ["Ma", "Mars, your karaka of physical drive"],
    [l7, `${PLANET_NAMES[l7]}, ruler of your 7th house of partnership`],
    [l12, `${PLANET_NAMES[l12]}, ruler of your 12th house of the bed`],
    [l8, `${PLANET_NAMES[l8]}, ruler of your 8th house of sexual energy`],
    ["Mo", "your Moon, which decides whether the mind arrives with the body"],
  ];
  const seenChain = new Set<PlanetId>();
  const chains: string[] = [];
  for (const [id, role] of chainTargets) {
    if (seenChain.has(id)) continue;
    seenChain.add(id);
    const p = planetOf(id);
    if (!p) continue;
    const nl = p.nakshatraLord;
    const nlPos = planetOf(nl);
    const relPhrase =
      p.nakshatraRelation === "self"
        ? "its own star, so it delivers undiluted"
        : p.nakshatraRelation === "friend"
          ? "a friendly star lord, so the transmission is clean"
          : p.nakshatraRelation === "enemy"
            ? "an unfriendly star lord, so the results arrive distorted — what this planet promises and what it delivers are not quite the same thing"
            : "a neutral star lord, neither helped nor hindered";
    chains.push(
      `${role}, sits in ${NAKSHATRAS[p.nakshatra]} pada ${p.pada}, ruled by ${PLANET_NAMES[nl]} — ${relPhrase}. ` +
        (nlPos
          ? `Because a planet delivers through its star's ruler, this one's results route through your ${ordinal(nlPos.house)} house. ${
              DUSTHANA.includes(nlPos.house)
                ? "That is one of the harder houses, so this part of your intimate life tends to carry friction, secrecy or expense attached — a Venus routed through the 6th behaves very differently from one routed through the 5th, and this is the difference."
                : [5, 7, 11, 12].includes(nlPos.house)
                  ? "That is a house of pleasure or partnership, so the routing supports rather than complicates — this planet's results arrive where you actually want them."
                  : "That is where this planet's results in this department actually get delivered."
            }`
          : "")
    );
  }

  // -------------------------------------------------------------------------
  // How this tends to move across a life
  // -------------------------------------------------------------------------
  const movementFor = (id: PlanetId): string => {
    const p = planetOf(id);
    const s = score(id);
    const where = p ? `from your ${ordinal(p.house)} house` : "unplaced in this chart";
    switch (id) {
      case "Ve":
        return `Venus periods (${where}, ${s}/100) are the ones that classically open this department: appetite rises, you become more visible to other people, and relationships tend to start rather than end. ${s >= 55 ? "With Venus in decent condition, these read as some of the easier stretches of a life." : "With Venus under pressure, they still open things up — they simply ask for more discernment about who walks in."}`;
      case "Ma":
        return `Mars periods (${where}, ${s}/100) raise physical drive and impatience together. Desire is more urgent and less negotiable in these stretches; so is temper. They favour acting on attraction and disfavour handling a delicate conversation the same evening.`;
      case "Ra":
        return `Rahu periods (${where}, ${s}/100) tend to be the unconventional chapters: attraction to people outside your usual pattern, appetite that surprises you, and a pull toward what you have not done. These stretches are where the tradition gets nervous and where honest self-knowledge does more good than restraint. Consent and clarity with the people involved matter more here than in any other period.`;
      case "Sa":
        return `Saturn periods (${where}, ${s}/100) run the other way: restraint, delay, longer gaps, and attraction to people who are older, more serious or less available. They are thin stretches for spontaneity and unusually good ones for building something that lasts. Saturn does not remove desire — it makes it wait.`;
      case "Ke":
        return `Ketu periods (${where}, ${s}/100) tend to bring detachment: interest genuinely drops for a while, sometimes with guilt attached that does not belong to anything. They pass. What they often leave behind is a clearer sense of what you actually want rather than what you had assumed you wanted.`;
      case "Ju":
        return `Jupiter periods (${where}, ${s}/100) bring generosity and an ethical frame — good for partnership, and classically cooler on raw heat. Relationships formed here tend to be the sane ones.`;
      default:
        return `Moon periods (${where}, ${s}/100) make the emotional side of intimacy more prominent than the physical: closeness matters more, and being wanted matters more than wanting.`;
    }
  };
  const lifeMovement = (["Ve", "Ma", "Ra", "Sa", "Ke", "Ju", "Mo"] as PlanetId[]).map((lord) => ({
    lord,
    text: movementFor(lord),
  }));

  // -------------------------------------------------------------------------
  // Constructive close — every friction paired with something workable
  // -------------------------------------------------------------------------
  const workingWith: string[] = [];
  if (desire >= 65 && pleasure < 50) {
    workingWith.push(
      "Your appetite runs ahead of your satisfaction — wanting arrives more reliably than being satisfied does. That gap is usually about pace rather than about capacity, and it responds to slowing the whole encounter down rather than to doing more."
    );
  }
  if (fusion < 45) {
    workingWith.push(
      "Physical closeness does not automatically land emotionally for you, which can read to a partner as distance when it is really a nervous system that needs more safety first. Saying that out loud converts it from a rejection into a piece of information, and it is one of the few things here that a single conversation genuinely fixes."
    );
  }
  if (frictionRows.length > strengthRows.length) {
    workingWith.push(
      "This chart carries more friction than ease in this department, and the honest reading of that is pace: things arrive later, need more deliberate setting-up, and improve markedly with familiarity. None of that is a statement about how good your intimate life can become — it is a statement about how it gets there."
    );
  }
  workingWith.push(
    "Where any of this shows up physically — pain, difficulty with arousal, changes you did not expect, anything to do with fertility — that belongs with a clinician rather than with a chart. Astrology can describe a tendency; it cannot examine you, and nothing here is a diagnosis or a treatment."
  );
  workingWith.push(
    "Everything above describes you. It says nothing about who you are drawn to, and a chart cannot show sexual orientation or gender identity — this reading does not attempt it. It also assumes throughout that the other person is a person with their own wants: consent is the precondition for every part of this, not an obstacle to it."
  );

  // -------------------------------------------------------------------------
  // Deeper classical tests
  // -------------------------------------------------------------------------
  // Ashtakavarga, Bhava Bala, Vimshopaka, the D-60, Jaimini argala and the 2nd
  // from the Upapada, the badhaka, natal vakri motion, the Moon's lunar support
  // and paksha bala, and the Sudarshana Chakra. Kept in their own module: they
  // ask different questions from the four facets rather than re-weighting
  // them, and two of them close a gap between this file and the project's own
  // source notes, which already claimed Vimshopaka and the D-60 for Venus here.
  const depth = buildIntimacyDepth(chart, vargas, jaimini, ashtakavarga, bhavaBala, yogas);

  // The Trimsamsa lord reading. This section used to refuse the rule outright;
  // it is now reported as an attributed classical *claim* with its contested
  // status stated, and the moral vocabulary of the source is not reproduced.
  // See `trimsamsaClaim.ts` for the full reasoning.
  const trimsamsa = buildTrimsamsaClaim(chart);
  strengthRows.push(...depth.strengths);
  frictionRows.push(...depth.frictions);

  if (!ashtakavarga) {
    caveats.push(
      "Ashtakavarga could not be computed for this chart, so the transit-support scores for your 7th, 8th, 12th and 5th are absent from the reading below rather than estimated."
    );
  }
  if (!bhavaBala) {
    caveats.push(
      "Bhava Bala — the strength of the houses themselves as distinct from their rulers — is unavailable here, so those four houses are judged only through the planets that rule them."
    );
  }

  // -------------------------------------------------------------------------
  // Score, verdict, confidence
  // -------------------------------------------------------------------------
  const overall = clamp(
    Math.round(
      attraction * 0.22 +
        desire * 0.28 +
        pleasure * 0.28 +
        fusion * 0.22 +
        // Corroboration, not a fifth facet: these tests re-examine the same
        // houses and karakas from other angles, so giving them a facet of
        // their own would count Venus twice.
        depth.adjustment
    ),
    5,
    95
  );
  const confidence = clamp(
    40 +
      (shadbala ? 10 : -6) +
      (vargas ? 8 : -4) +
      (jaimini ? 6 : 0) +
      (ashtakavarga ? 4 : -3) +
      (bhavaBala ? 3 : -2) +
      (chart.birthUtc ? 8 : -8),
    25,
    90
  );

  const facets: IntimacyFacet[] = [
    {
      key: "attraction",
      label: "Attraction & magnetism",
      score: attraction,
      reading:
        attraction >= 65
          ? "You land strongly on other people — attention arrives without you having to arrange it."
          : attraction >= 50
            ? "You register clearly rather than instantly; people tend to find you more attractive the longer they know you."
            : "Your appeal is not front-loaded. It builds, which means the encounters that work for you are rarely the fast ones.",
    },
    {
      key: "desire",
      label: "Desire & drive",
      score: desire,
      reading:
        desire >= 65
          ? "Libido is a strong, fairly constant presence in this chart — a temperament to design your life around rather than to manage."
          : desire >= 50
            ? "Desire is moderate and situational: it responds to circumstance more than it runs on its own."
            : "Drive runs quieter here and arrives in waves. That is a rhythm rather than a deficit, and it is far easier on a relationship once it is described than once it is guessed at.",
    },
    {
      key: "pleasure",
      label: "Pleasure & satisfaction",
      score: pleasure,
      reading:
        pleasure >= 65
          ? "The 12th house works for you: sex is genuinely enjoyable rather than merely wanted."
          : pleasure >= 50
            ? "Satisfaction is available and conditional — it depends on setting, privacy and not being rushed."
            : "Satisfaction is the part of this reading that takes work. The appetite is not the constraint; comfort, timing and relaxation are.",
    },
    {
      key: "fusion",
      label: "Intimacy & emotional fusion",
      score: fusion,
      reading:
        fusion >= 65
          ? "Physical closeness lands emotionally for you — sex makes you closer to someone rather than merely satisfied."
          : fusion >= 50
            ? "The emotional and physical sides connect when you feel safe and separate when you do not."
            : "Body and mind arrive at different speeds here. Familiarity closes that gap more effectively than intensity does.",
    },
  ];

  strengthRows.sort((a, b) => b.weight - a.weight);
  frictionRows.sort((a, b) => a.weight - b.weight);
  combinations.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));

  const headline =
    overall >= 65
      ? "Your chart is warm and well-built for a sexual life — appetite, pleasure and closeness are supported together rather than one at the expense of the others."
      : overall >= 52
        ? "Your chart supports a good sexual life on its own terms: some parts come easily, others need conditions met, and the reading below is mostly about which is which."
        : overall >= 42
          ? "Your chart carries real friction in this department alongside genuine capacity. The pattern is pace rather than absence — things arrive later and improve with familiarity."
          : "Your chart's harder placements cluster in this area, which classically means intimacy is something you build deliberately rather than something that simply happens. That is a description of the route, not of the destination.";

  return {
    key: "intimacy",
    title: "Attraction, Desire & Sexual Life",
    headline,
    score: overall,
    verdict: verdictOf(overall),
    confidence,
    blocks: [
      {
        heading: "What is being read here, and what is not",
        paragraphs: [
          "This is an adult reading of one chart. It is built from the desire trine (your 3rd, 7th and 11th houses), the 12th house — which classical Jyotisha assigns to the pleasures of the bed and which most popular readings skip entirely — the 8th for intensity and what stays private, the 5th for romance and magnetism, and Venus and Mars as the two planets that carry desire and drive.",
          "Two boundaries are absolute. A chart cannot show sexual orientation or gender identity, and no attempt is made here to infer either; everything below is written about you, not about who you are drawn to, and no partner's gender is assumed anywhere. And the older literature's use of the D-30 chart to judge \"moral character\" — a rule applied overwhelmingly to women's charts — is not implemented: that chart is read here only for vulnerability and health-adjacent themes, and the refusal is recorded in this project's source notes rather than left silent.",
          "There is no moralising in what follows. A strong appetite, a pull toward novelty, a long low-desire stretch — these are temperaments and phases, described so you can work with them.",
        ],
      },
      {
        heading: "The combinations your chart actually forms",
        paragraphs: combinations.length
          ? combinations.map((c) => `${c.name} — ${c.text}`)
          : [
              "None of the named classical combinations for this area forms in your chart. That is a genuinely neutral result rather than an absence of capacity: it means this part of your life is described by the ordinary condition of Venus, Mars, the 12th and the 7th rather than by a headline signature, and those are read in full above and below.",
            ],
      },
      {
        heading: "The Yoni and nakshatra layer",
        paragraphs: yoniParagraphs,
      },
      ...(trimsamsa
        ? [
            {
              heading: "A contested classical claim, reported for testing",
              paragraphs: [...trimsamsa.preamble, ...trimsamsa.rows.map((r) => r.text)],
            },
          ]
        : []),
      {
        heading: "How the star lords route your desire",
        paragraphs: chains,
      },
      ...(depth.paragraphs.length
        ? [
            {
              heading: "Deeper classical tests",
              paragraphs: [
                "The four gauges above are read from the houses, the two karakas and the divisional charts. What follows asks a different set of questions of the same chart: how much transit support these houses actually carry, how strong they are in themselves as opposed to through their rulers, whether Venus survives being re-measured across all sixteen divisions, and whether the Moon and the Sun agree with the rising sign about any of it.",
                ...depth.paragraphs,
              ],
              reasons: [...depth.strengths.slice(0, 4), ...depth.frictions.slice(0, 4)],
            },
          ]
        : []),
      {
        heading: "How this tends to move across a life",
        paragraphs: [
          "Desire is not a constant, and the classical way of describing its rhythm is by which planet's period is running. These are tendencies, not schedules — the actual dates for your chart live on the Dasha tab.",
          ...lifeMovement.map((m) => m.text),
        ],
      },
      {
        heading: "Working with the difficult parts",
        paragraphs: workingWith,
      },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    facets,
    strengths: strengthRows,
    frictions: frictionRows,
    combinations,
    drishti,
    yoni,
    chains,
    lifeMovement,
    workingWith,
  };
}
