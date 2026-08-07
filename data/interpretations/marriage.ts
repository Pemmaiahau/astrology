import { AGE_BANDS, ageYearsAt, agePriorFor, dateAtAge } from "@/utils/astrology/ageBands";
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
import { plain, toTimingWindow } from "./report";
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
    return { present: false, fromLagna: false, fromMoon: false, cancellations: [], effective: false, text: "Mars is not placed in this chart, so there is nothing to assess Mangal Dosha against. Treat the question as unanswered here rather than answered in your favour." };
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
    ? "You do not have Mangal Dosha. Mars stays clear of the 1st, 4th, 7th, 8th and 12th houses counted from both your rising sign and your Moon, which are the placements the matching tradition watches for. In practical terms, the question that worries so many families at the matching stage simply does not arise in your chart."
    : effective
      ? `Mars sits in your ${ordinal(mars.house)} house, so Mangal Dosha forms ${where}, and none of the standard cancellations applies. What tradition is describing is heat: you bring force and impatience into close partnership, and the early married years are where that shows — quick reactions, a low tolerance for being managed. It settles with maturity, and the practical work is learning to slow your first response down. This is a factor to work with, not a prohibition on marrying.`
      : `Mars sits in your ${ordinal(mars.house)} house, which technically forms Mangal Dosha ${where} — but your chart cancels it: ${cancellations.join("; ")}. That means the heat is there without the affliction the tradition warns about. In daily life it reads as directness rather than damage: you say the difficult thing early, which is usually kinder than the alternative.`;

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
      text: benefic
        ? `${PLANET_NAMES[p.id]} sits in your 7th house, the house of the person you live your life beside — a gentle planet in a tender place. Partnership tends to be somewhere you soften rather than somewhere you brace.`
        : `${PLANET_NAMES[p.id]} sits in your 7th house, which classically firms partnership up and slows it down. In practice you take relationships seriously young and often arrive at the real one later, with a clearer idea of what you actually want.`,
      weight: benefic ? 6 : -5,
      source: { work: "BPHS / Phaladeepika", ref: "7th-house occupancy" },
    });
  }
  if (seventhLord) {
    const s = strengths[seventhLordId];
    harmonyFactors.push({
      text: `Your 7th house is ruled by ${PLANET_NAMES[seventhLordId]}, and it sits in your ${ordinal(seventhLord.house)} house, ${DIGNITY_LABELS[seventhLord.dignity]}${s ? `, scoring ${s.score}/100 for strength` : ""}. That is where your partnership life gets carried out — ${ordinal(seventhLord.house)}-house matters and your marriage tend to move together.`,
      weight: s ? Math.round((s.score - 50) / 8) : 0,
    });
    if ([6, 8, 12].includes(seventhLord.house)) {
      delayFactors.push({
        text: `Your 7th ruler sits in the ${ordinal(seventhLord.house)}, one of the harder houses — the classical marker for partnership that takes longer and costs more effort. Day to day it reads as relationships that need work to hold their shape, and as a marriage that improves once you stop expecting it to be effortless.`,
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
      "You did not give a gender, so both Venus and Jupiter are read as marriage significators here. Classically it is Venus for a male chart and Venus with Jupiter for a female one; reading both is the cautious choice rather than a guess."
    );
  }
  for (const kid of karakaPlanets) {
    const k = planetOf(kid);
    if (!k) continue;
    const s = strengths[kid];
    const afflicted = k.combust || k.dignity === "debilitated" || (k.warWith && !k.warWinner);
    (afflicted ? delayFactors : harmonyFactors).push({
      text: `${PLANET_NAMES[kid]} is your natural significator for marriage, and it stands ${DIGNITY_LABELS[k.dignity]} in your ${ordinal(k.house)} house${k.combust ? ", too close to the Sun to shine on its own" : ""}${s ? ` (${s.score}/100)` : ""}. ${
        afflicted
          ? "A significator under pressure usually shows up as a slower, more deliberate route into partnership — you tend to learn about love the long way, which is not the same as being denied it."
          : "A significator in good condition shows up as ease in being close to someone: affection you can express, and a partnership that gets easier rather than heavier with time."
      }`,
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
    upapadaText = `Your ${plain("Upapada Lagna")} falls in ${SIGNS[ul]}, and ${PLANET_NAMES[ulLord]} rules it${ulLordPos ? `, sitting in your ${ordinal(ulLordPos.house)} house, ${DIGNITY_LABELS[ulLordPos.dignity]}` : ", though it is unplaced in this chart"}. This point describes marriage as a standing institution in your life rather than as romance — the household, the in-laws, the public fact of being married. Its condition is the best single indicator of how settled and respected that arrangement tends to feel from the inside.`;
    if (ulLordPos && ["exalted", "own", "moolatrikona", "greatFriend"].includes(ulLordPos.dignity)) {
      harmonyFactors.push({
        text: "The ruler of your marriage pada is well placed, which classically marks a union with standing — one that holds up in front of family and over time. It usually shows as a marriage other people treat as solid, and that you can rely on when other parts of life wobble.",
        weight: 5,
        source: { work: "Jaimini Upadesa Sutras", ref: "Upapada" },
      });
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
    navamsaText = `Your ${plain("Navamsa")} is where married life is actually read, and it says this: the Navamsa rising sign is ${SIGNS[d9.ascendant]}, ruled by ${PLANET_NAMES[d9LagnaLord]}; its 7th house falls in ${SIGNS[d9Seventh]}${d9SeventhOcc.length ? `, with ${d9SeventhOcc.map((p) => PLANET_NAMES[p.id]).join(", ")} there` : ", with nothing in it"}; and Venus lands in ${veD9 ? SIGNS[veD9.sign] : "—"}${veD9 && veD9.vargottama ? `, ${plain("Vargottama")}, which means what it promises tends to hold` : ""}. Treat this as the private texture of the marriage — what the two of you are like at home on an ordinary Tuesday, rather than what the relationship looks like to everyone else.`;
    if (veD9 && ["exalted", "own"].includes(veD9.dignity)) {
      harmonyFactors.push({
        text: "Venus is strong in your Navamsa, the chart that describes married life from the inside. Affection in your marriage tends to deepen with the years instead of wearing thin — the tenderness is still there after the novelty has gone.",
        weight: 5,
        source: { work: "BPHS", ref: "Ch.6 (Navamsa)" },
      });
    }
  }

  // --- Darakaraka ---
  if (jaimini && dk) {
    harmonyFactors.push({
      text: `${PLANET_NAMES[dk.id]} is your ${plain("Darakaraka")}, and it sits in your ${ordinal(dk.house)} house. The person you marry tends to carry that planet's signature — its temperament, its pace, its way of handling difficulty — closely enough that the description usually feels familiar once you meet them.`,
      weight: 2,
      source: { work: "Jaimini Upadesa Sutras", ref: "chara karakas" },
    });
  }

  // --- Delay factors: Saturn/nodes on the 7th ---
  const seventhAspectors = aspectsOnSign(chart, seventhSign);
  for (const a of seventhAspectors) {
    if (a === "Sa" || a === "Ra" || a === "Ke") {
      delayFactors.push({
        text: `${PLANET_NAMES[a]} casts its aspect on your 7th house, which the classics read as a "later is better" influence on marriage. In ordinary terms: early partnerships tend to teach rather than last, and the ones you choose after about thirty hold much better.`,
        weight: -3,
        source: { work: "Phaladeepika", ref: "malefic influence on the 7th" },
      });
    }
  }

  // --- Mangal Dosha ---
  const mangalDosha = checkMangalDosha(chart);
  if (mangalDosha.effective) {
    delayFactors.push({
      text: `An uncancelled ${plain("Mangal Dosha")} is present (the full reading is below). It points at heat in the early married years rather than at anything structural, and patience is the whole of the remedy.`,
      weight: -4,
      source: { work: "matching tradition", ref: "Kuja Dosha" },
    });
  }

  // --- Spouse indications ---
  const spouseIndications: string[] = [];
  if (seventhLord) {
    const dir = PLANET_DIRECTION[seventhLordId];
    spouseIndications.push(
      `Because ${PLANET_NAMES[seventhLordId]} rules your 7th house, the person you marry tends to carry that planet's nature — you are drawn to it, and you recognise it quickly. ${dir ? `Tradition also reads a direction from this, ${dir} of your birthplace, but hold that one loosely: direction rules are the softest technique on this page.` : "No direction indication follows from this placement, which is honest — the rule needs a planet that carries one."}`
    );
    if ([9, 12].includes(seventhLord.house) || seventhOccupants.some((p) => p.id === "Ra")) {
      spouseIndications.push(
        "Your marriage axis touches the 9th or 12th house, or Rahu sits on it — the classical pointer toward a partner from a different region, community or country. In everyday terms, the person who fits you is unlikely to come from the street you grew up on."
      );
    } else {
      spouseIndications.push(
        "There are no strong foreign markers on your marriage axis, which leans the reading toward a partner from a familiar cultural circle. That is a tendency in the chart, not a boundary on your life — plenty of these charts marry across every kind of distance."
      );
    }
  }
  if (dk) {
    spouseIndications.push(
      `${PLANET_NAMES[dk.id]}, as your spouse significator, colours their temperament more than anything else here. Look for a strong ${PLANET_NAMES[dk.id]} signature in whom you actually choose — it is usually more visible in how they behave under stress than in how they present at first.`
    );
  }

  // --- Remedies (tradition, framed as such) ---
  const remedies: string[] = [];
  if (mangalDosha.effective) {
    remedies.push(
      "Tradition offers remedies for Mangal Dosha — Mangal shanti, matching with a chart that carries the same placement. Treat those as cultural practice rather than mechanism. The remedy that actually changes outcomes is patience in the first years and honest habits around conflict: saying the difficult thing early, and not letting a bad evening become a bad month."
    );
  }
  if (delayFactors.length > harmonyFactors.length) {
    remedies.push(
      "Where Saturn or the lunar nodes touch the 7th house, the tradition is unanimous: marry later and court deliberately. Time itself is the classical remedy for this pattern, and it works because the pattern is about readiness rather than luck."
    );
  }
  remedies.push(
    "The standard literature recommends strengthening Venus in the traditional way — Friday observances, white clothing, courtesy toward your partner. The last of those is the one that carries the weight: attention paid to the relationship is what the practice is really training."
  );

  // --- Score & confidence ---
  const harmonySum = harmonyFactors.reduce((s, e) => s + e.weight, 0);
  const delaySum = delayFactors.reduce((s, e) => s + e.weight, 0);
  const score = clamp(55 + harmonySum + delaySum, 10, 92);
  const confidence = clamp(
    42 + (vargas ? 10 : 0) + (jaimini ? 10 : 0) + (chart.birthUtc ? 8 : -10) + (gender ? 5 : 0),
    30,
    88
  );
  if (!chart.birthUtc)
    caveats.push(
      "Without a birth time the windows below cannot be computed at all, and the house boundaries are approximate — so read the placements here as indications rather than as measurements."
    );

  return {
    key: "marriage",
    title: "Marriage — Timing & Married Life",
    headline:
      score >= 60
        ? "Your marriage houses are well supported — partnership is one of the stronger things in this chart, and the interesting question is when rather than whether."
        : score >= 45
          ? "Your marriage indications are mixed: warm significators on one side, some classical delay markers on the other. For a chart like this the windows matter far more than the average does."
          : "Your chart carries real delay-and-friction markers around partnership. Classically that means marriage arrives later and more deliberately — it is a description of pace, not of absence.",
    score,
    confidence,
    blocks: [
      {
        heading: "The marriage houses and significators",
        paragraphs: [
          `Marriage is read from your 7th house and from the planets that naturally stand for partnership. Below are the two deeper views the tradition adds to that: the marriage pada, which describes the institution, and the Navamsa, which describes the daily life inside it.`,
          upapadaText,
          navamsaText,
        ].filter((x): x is string => Boolean(x)),
        reasons: [...harmonyFactors, ...delayFactors],
      },
      { heading: "Mangal Dosha", paragraphs: [mangalDosha.text] },
      { heading: "What your partner tends to be like", paragraphs: spouseIndications },
      { heading: "What tradition offers, and what actually helps", paragraphs: remedies },
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
// Timing: windows across the marriage age band, with Jupiter-transit sub-windows
// ---------------------------------------------------------------------------

/**
 * Marriage windows are scanned across the *life stage* when marriage commonly
 * happens (ages 22–45), not across the next 15 years from today. Windows that
 * have already elapsed are returned too, marked `phase: "past"` — if the
 * marriage happened, the chart says it most likely happened there, and that is
 * a check on the reading rather than a prediction. `now` is used only to label
 * each window past/current/future; it never bounds the scan.
 */
export function marriageTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  jaimini: JaiminiInfo | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const birth = chart.birthUtc;
  const lagna = chart.ascendant.sign;
  const gender = chart.meta.gender;
  const band = AGE_BANDS.marriage;

  const karakas: PlanetId[] = ["Ve"];
  if (gender === "female" || !gender) karakas.push("Ju");
  if (jaimini) karakas.push(jaimini.karakas.DK);

  const extraSigns = jaimini ? [jaimini.upapada] : [];
  const windows = findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    {
      houses: [7, 2, 11],
      karakas,
      extraSigns,
      maxWindows: 4,
      agePriorAt: agePriorFor(birth, band),
      relativeTo: now,
    },
    dateAtAge(birth, band.start), dateAtAge(birth, band.end)
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
        reasons: [
          "Jupiter passing over one of your marriage points is the classical trigger inside a window — the months where a period tends to actually deliver something",
        ],
        ageRange: { from: ageYearsAt(birth, iv.start), to: ageYearsAt(birth, iv.end) },
        phase:
          iv.end <= now ? ("past" as const) : iv.start > now ? ("future" as const) : ("current" as const),
      }));
    return {
      ...toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`, birth),
      subWindows,
    };
  });
}
