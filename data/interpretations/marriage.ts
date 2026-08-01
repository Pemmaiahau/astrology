import { aspectsOnSign } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import {
  PLANET_DIRECTION,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
} from "@/utils/astrology/constants";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { findActivationWindows, occupancyIntervals } from "@/utils/astrology/scan";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type {
  AyanamshaId, ChartData, DashaPeriod, Gender, PlanetId, YogaFinding,
} from "@/utils/astrology/types";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { Evidence, SectionReport, TimingWindow } from "./report";
import { ordinal } from "./synthesis";

/**
 * Marriage: timing windows, spouse indications, harmony and delay factors.
 *
 * Sources: 7th house/lord and Venus as kalatra-karaka per BPHS and
 * Phaladeepika (marriage chapters); Jupiter additionally judged for a
 * female chart per the classical convention (Saravali tradition);
 * Upapada Lagna per Jaimini Upadesa Sutras / BPHS Padadhyaya;
 * D-9 Navamsa as the marriage varga per BPHS Ch.6; Darakaraka per Jaimini.
 * Mangal Dosha house set (1,4,7,8,12 from Lagna and Moon) with the
 * widely-attested cancellation list — the dosha is a matching tradition,
 * not a BPHS sutra, and is presented as such.
 * Timing: Vimshottari periods of marriage-connected lords intersected with
 * Jupiter transits and the Saturn+Jupiter double transit — the standard
 * applied-Parashari method (a modern synthesis; labelled as such).
 *
 * All timing language is probabilistic by construction: windows, not dates.
 */

export interface MangalDosha {
  present: boolean;
  fromLagna: boolean;
  fromMoon: boolean;
  cancellations: string[];
  /** present && cancellations.length === 0 */
  effective: boolean;
  text: string;
}

export interface MarriageReport extends SectionReport {
  mangalDosha: MangalDosha;
  spouseIndications: string[];
  harmonyFactors: Evidence[];
  delayFactors: Evidence[];
  remedies: string[];
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------------------
// Mangal Dosha with cancellation rules
// ---------------------------------------------------------------------------

export function checkMangalDosha(chart: ChartData): MangalDosha {
  const mars = chart.planets.find((p) => p.id === "Ma");
  const moon = chart.planets.find((p) => p.id === "Mo");
  if (!mars) {
    return { present: false, fromLagna: false, fromMoon: false, cancellations: [], effective: false, text: "Mars is not placed in this chart, so Mangal Dosha cannot be assessed." };
  }
  const DOSHA_HOUSES = [1, 4, 7, 8, 12];
  const fromLagna = DOSHA_HOUSES.includes(mars.house);
  const fromMoon = moon ? DOSHA_HOUSES.includes(((mars.sign - moon.sign + 12) % 12) + 1) : false;
  const present = fromLagna || fromMoon;

  const cancellations: string[] = [];
  if (present) {
    // Widely-attested cancellation list (conservative subset; these are
    // matching-tradition rules, not BPHS sutras):
    if (["own", "moolatrikona", "exalted"].includes(mars.dignity)) {
      cancellations.push(
        `Mars stands in ${mars.dignity === "exalted" ? "exaltation" : "its own sign"} (${SIGNS[mars.sign]}) — a dignified Mars is held not to afflict`
      );
    }
    const aspectors = aspectsOnSign(chart, mars.sign);
    if (aspectors.includes("Ju")) {
      cancellations.push("Jupiter aspects Mars — the classical benefic override");
    }
    const withJu = chart.planets.some((p) => p.id === "Ju" && p.sign === mars.sign);
    if (withJu) cancellations.push("Jupiter conjoins Mars in the same sign");
    // Mars in 2nd in Gemini/Virgo, 4th in own, 7th in Cancer/Capricorn, 8th in
    // Sagittarius/Pisces, 12th in Taurus/Libra — the sign-specific exemption
    // list as commonly published; implemented for the houses in our set.
    const signExempt: Record<number, number[]> = { 4: [0, 7], 7: [3, 9], 8: [8, 11], 12: [1, 6] };
    const exemptSigns = signExempt[mars.house];
    if (exemptSigns?.includes(mars.sign) && !cancellations.length) {
      cancellations.push(`Mars in the ${ordinal(mars.house)} in ${SIGNS[mars.sign]} is on the traditional exemption list for that house`);
    }
  }

  const effective = present && cancellations.length === 0;
  const where = [fromLagna ? "from the Lagna" : null, fromMoon ? "from the Moon" : null]
    .filter(Boolean)
    .join(" and ");

  const text = !present
    ? "No Mangal Dosha: Mars avoids the 1st, 4th, 7th, 8th and 12th houses from both your Lagna and your Moon."
    : effective
      ? `Mars occupies the ${ordinal(mars.house)} house — Mangal Dosha forms ${where}, with no standard cancellation applying. Tradition reads this as a hot-tempered start to partnership and recommends conscious patience in the early married years (and, in matching practice, a partner whose chart balances it). It softens naturally with maturity; it is a factor to work with, never a prohibition.`
      : `Mars occupies the ${ordinal(mars.house)} house, which technically forms Mangal Dosha ${where} — but it is cancelled in your chart: ${cancellations.join("; ")}. In practice it behaves as ordinary Mars energy in partnership: directness, not affliction.`;

  return { present, fromLagna, fromMoon, cancellations, effective, text };
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function buildMarriageReport(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  yogas: YogaFinding[]
): MarriageReport {
  const lagna = chart.ascendant.sign;
  const gender: Gender | undefined = chart.meta.gender;
  const caveats: string[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  const seventhSign = (lagna + 6) % 12;
  const seventhLordId = SIGN_LORDS[seventhSign];
  const seventhLord = planetOf(seventhLordId);
  const venus = planetOf("Ve");
  const jupiter = planetOf("Ju");
  const dk = jaimini ? planetOf(jaimini.karakas.DK) : undefined;

  const harmonyFactors: Evidence[] = [];
  const delayFactors: Evidence[] = [];

  // --- 7th house condition ---
  const seventhOccupants = chart.planets.filter((p) => p.house === 7);
  for (const p of seventhOccupants) {
    const benefic = ["Ju", "Ve", "Me", "Mo"].includes(p.id);
    (benefic ? harmonyFactors : delayFactors).push({
      text: `${PLANET_NAMES[p.id]} occupies your 7th house — ${benefic ? "a natural benefic warming the partnership arena" : "a natural malefic that classically firms up (and can delay) partnership until maturity"}`,
      weight: benefic ? 6 : -5,
      source: { work: "BPHS / Phaladeepika", ref: "7th-house occupancy" },
    });
  }
  if (seventhLord) {
    const s = strengths[seventhLordId];
    harmonyFactors.push({
      text: `Your 7th lord ${PLANET_NAMES[seventhLordId]} sits in the ${ordinal(seventhLord.house)} house, ${DIGNITY_LABELS[seventhLord.dignity]}${s ? `, strength ${s.score}/100` : ""}`,
      weight: s ? Math.round((s.score - 50) / 8) : 0,
    });
    if ([6, 8, 12].includes(seventhLord.house)) {
      delayFactors.push({
        text: `The 7th lord in the ${ordinal(seventhLord.house)} (a difficult house) is a classical delay-and-friction marker for partnership`,
        weight: -5,
        source: { work: "Phaladeepika", ref: "7th lord in dusthana" },
      });
    }
  }

  // --- Karakas: Venus always; Jupiter additionally for a female chart ---
  const karakaPlanets: PlanetId[] = ["Ve"];
  if (gender === "female") karakaPlanets.push("Ju");
  if (!gender) {
    karakaPlanets.push("Ju");
    caveats.push(
      "Gender was not provided, so both Venus and Jupiter are read as marriage karakas (classically Venus for a male chart, Venus + Jupiter for a female chart)."
    );
  }
  for (const kid of karakaPlanets) {
    const k = planetOf(kid);
    if (!k) continue;
    const s = strengths[kid];
    const afflicted = k.combust || k.dignity === "debilitated" || (k.warWith && !k.warWinner);
    (afflicted ? delayFactors : harmonyFactors).push({
      text: `${PLANET_NAMES[kid]}, marriage karaka, is ${DIGNITY_LABELS[k.dignity]} in your ${ordinal(k.house)} house${k.combust ? ", combust" : ""}${s ? ` (${s.score}/100)` : ""}`,
      weight: afflicted ? -4 : s ? Math.round((s.score - 45) / 8) : 2,
      source: { work: "BPHS", ref: "kalatra karaka" },
    });
  }

  // --- Upapada Lagna ---
  let upapadaText: string | null = null;
  if (jaimini) {
    const ul = jaimini.upapada;
    const ulLord = SIGN_LORDS[ul];
    const ulLordPos = planetOf(ulLord);
    upapadaText = `Your Upapada Lagna (the marriage pada) falls in ${SIGNS[ul]}; its lord ${PLANET_NAMES[ulLord]}${ulLordPos ? ` sits in your ${ordinal(ulLordPos.house)} house, ${DIGNITY_LABELS[ulLordPos.dignity]}` : " is unplaced"}. The Upapada describes the marriage as an institution in your life — its dignity speaks to the standing and durability of the union.`;
    if (ulLordPos && ["exalted", "own", "moolatrikona", "greatFriend"].includes(ulLordPos.dignity)) {
      harmonyFactors.push({ text: `The Upapada lord is well dignified — a classical marker of a stable, respected union`, weight: 5, source: { work: "Jaimini Upadesa Sutras", ref: "Upapada" } });
    }
  }

  // --- Navamsa ---
  let navamsaText: string | null = null;
  if (vargas) {
    const d9 = vargas.charts.D9;
    const d9LagnaLord = SIGN_LORDS[d9.ascendant];
    const d9Seventh = (d9.ascendant + 6) % 12;
    const d9SeventhOcc = d9.positions.filter((p) => p.sign === d9Seventh && p.id !== "Ra" && p.id !== "Ke");
    const veD9 = vargaPositionOf(d9, "Ve");
    navamsaText = `In the Navamsa (the marriage chart proper): the D-9 lagna is ${SIGNS[d9.ascendant]} (lord ${PLANET_NAMES[d9LagnaLord]}); the 7th of the Navamsa is ${SIGNS[d9Seventh]}${d9SeventhOcc.length ? `, occupied by ${d9SeventhOcc.map((p) => PLANET_NAMES[p.id]).join(", ")}` : ", unoccupied"}; Venus falls in ${veD9 ? SIGNS[veD9.sign] : "—"}${veD9 && veD9.vargottama ? " (Vargottama — its promises hold)" : ""}. The inner texture of married life reads from here more than from the birth chart's surface.`;
    if (veD9 && ["exalted", "own"].includes(veD9.dignity)) {
      harmonyFactors.push({ text: "Venus is dignified in the Navamsa — affection deepens rather than erodes with time", weight: 5, source: { work: "BPHS", ref: "Ch.6 (Navamsa)" } });
    }
  }

  // --- Darakaraka ---
  if (jaimini && dk) {
    harmonyFactors.push({
      text: `${PLANET_NAMES[dk.id]} is your Darakaraka (spouse significator by degree), placed in your ${ordinal(dk.house)} house — the spouse carries ${PLANET_NAMES[dk.id]}'s signature`,
      weight: 2,
      source: { work: "Jaimini Upadesa Sutras", ref: "chara karakas" },
    });
  }

  // --- Delay factors: Saturn/nodes on the 7th ---
  const seventhAspectors = aspectsOnSign(chart, seventhSign);
  for (const a of seventhAspectors) {
    if (a === "Sa" || a === "Ra" || a === "Ke") {
      delayFactors.push({
        text: `${PLANET_NAMES[a]} aspects your 7th house — classically a "later is better" influence on marriage timing`,
        weight: -3,
        source: { work: "Phaladeepika", ref: "malefic influence on the 7th" },
      });
    }
  }

  // --- Mangal Dosha ---
  const mangalDosha = checkMangalDosha(chart);
  if (mangalDosha.effective) {
    delayFactors.push({ text: "Effective Mangal Dosha (see below)", weight: -4, source: { work: "matching tradition", ref: "Kuja Dosha" } });
  }

  // --- Spouse indications ---
  const spouseIndications: string[] = [];
  if (seventhLord) {
    const dir = PLANET_DIRECTION[seventhLordId];
    spouseIndications.push(
      `The 7th lord ${PLANET_NAMES[seventhLordId]} suggests a partner carrying ${PLANET_NAMES[seventhLordId]}'s nature; ${dir ? `the classical direction indication is ${dir} of your birthplace (indicative only — direction rules are the softest technique in this list)` : "no direction indication applies"}.`
    );
    if ([9, 12].includes(seventhLord.house) || seventhOccupants.some((p) => p.id === "Ra")) {
      spouseIndications.push(
        "The 7th axis touches the 9th/12th houses or Rahu — a classical pointer toward a partner from a different region, community or country."
      );
    } else {
      spouseIndications.push("No strong foreign markers on the 7th axis — the classical reading leans toward a partner from a familiar cultural circle.");
    }
  }
  if (dk) {
    spouseIndications.push(`As Darakaraka, ${PLANET_NAMES[dk.id]} colours the spouse's temperament: expect a strong ${PLANET_NAMES[dk.id]} signature in who you choose.`);
  }

  // --- Remedies (tradition, framed as such) ---
  const remedies: string[] = [];
  if (mangalDosha.effective) {
    remedies.push("Tradition offers Mangal Dosha remedies (Mangal shanti, matching with a similar chart). Treat them as cultural practice; the practical remedy is patience and honest conflict habits early in the marriage.");
  }
  if (delayFactors.length > harmonyFactors.length) {
    remedies.push("Where Saturn or the nodes touch the 7th, tradition favours later marriage and deliberate courtship — time itself is the classical remedy for this pattern.");
  }
  remedies.push("Strengthening Venus the traditional way (Friday observances, white clothing, respect toward one's partner) is described in the standard literature; its real value is attention to the relationship itself.");

  // --- Score & confidence ---
  const harmonySum = harmonyFactors.reduce((s, e) => s + e.weight, 0);
  const delaySum = delayFactors.reduce((s, e) => s + e.weight, 0);
  const score = clamp(55 + harmonySum + delaySum, 10, 92);
  const confidence = clamp(
    42 + (vargas ? 10 : 0) + (jaimini ? 10 : 0) + (chart.birthUtc ? 8 : -10) + (gender ? 5 : 0),
    30,
    88
  );
  if (!chart.birthUtc) caveats.push("Without a birth time, the timing windows below cannot be computed and house cusps are approximate.");

  return {
    key: "marriage",
    title: "Marriage — Timing & Married Life",
    headline:
      score >= 60
        ? "The marriage houses are well supported — partnership is a strength of this chart, and the question is when, not whether."
        : score >= 45
          ? "Marriage indications are mixed — supportive karakas balanced against some classical delay factors. The windows below matter more than averages."
          : "The chart carries real delay-and-friction markers for partnership — which classically means later, more deliberate marriage, not absence of it.",
    score,
    confidence,
    blocks: [
      {
        heading: "The marriage houses and karakas",
        paragraphs: [
          upapadaText,
          navamsaText,
        ].filter((x): x is string => Boolean(x)),
        reasons: [...harmonyFactors, ...delayFactors],
      },
      { heading: "Mangal Dosha", paragraphs: [mangalDosha.text] },
      { heading: "Spouse indications", paragraphs: spouseIndications },
      { heading: "Traditional remedies", paragraphs: remedies },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    mangalDosha,
    spouseIndications,
    harmonyFactors,
    delayFactors,
    remedies,
  };
}

// ---------------------------------------------------------------------------
// Timing: top-3 year windows with Jupiter-transit month sub-windows
// ---------------------------------------------------------------------------

export function marriageTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  jaimini: JaiminiInfo | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const lagna = chart.ascendant.sign;
  const gender = chart.meta.gender;
  const horizon = new Date(now.getTime() + 15 * 365.25 * 86400000);

  const karakas: PlanetId[] = ["Ve"];
  if (gender === "female" || !gender) karakas.push("Ju");
  if (jaimini) karakas.push(jaimini.karakas.DK);

  const extraSigns = jaimini ? [jaimini.upapada] : [];
  const windows = findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    { houses: [7, 2, 11], karakas, extraSigns, maxWindows: 3 },
    now, horizon
  );

  // Month-level sub-windows: Jupiter transiting the 7th (from Lagna and from
  // the Moon) or the Upapada — the classical gochara trigger for marriage.
  const moon = chart.planets.find((p) => p.id === "Mo");
  const targetSigns = new Set<number>([(lagna + 6) % 12]);
  if (moon) targetSigns.add((moon.sign + 6) % 12);
  if (moon) targetSigns.add(moon.sign);
  if (jaimini) targetSigns.add(jaimini.upapada);

  return windows.map((w) => {
    const ju = occupancyIntervals("Ju", ayanamsha, w.start, w.end, 3, chart.meta.nodeMode ?? "mean");
    const subWindows: TimingWindow[] = ju
      .filter((iv) => targetSigns.has(iv.sign))
      .map((iv) => ({
        label: `Jupiter transits ${SIGNS[iv.sign]}${moon && iv.sign === moon.sign ? " (your Moon sign)" : jaimini && iv.sign === jaimini.upapada ? " (your Upapada)" : " (a 7th-house sign)"}`,
        start: iv.start,
        end: iv.end,
        grade: "moderate" as const,
        confidence: Math.min(w.confidence + 5, 90),
        reasons: ["Jupiter's transit over a marriage point is the classical gochara trigger"],
      }));
    return {
      label: `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`,
      start: w.start,
      end: w.end,
      grade: w.score >= 70 ? ("strong" as const) : w.score >= 50 ? ("moderate" as const) : ("weak" as const),
      confidence: w.confidence,
      reasons: w.reasons.map((r) => r.text),
      subWindows,
    };
  });
}
