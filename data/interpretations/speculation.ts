import {
  NextGlobalSolarEclipse,
  NextLunarEclipse,
  SearchGlobalSolarEclipse,
  SearchLunarEclipse,
} from "astronomy-engine";
import { aspectedSigns, aspectsOnSign } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import {
  NAKSHATRAS,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
  type PlanetId7,
} from "@/utils/astrology/constants";
import { activeDashaAt } from "@/utils/astrology/dasha";
import { arudhaOfHouse, doubleTransitOnSign, type JaiminiInfo } from "@/utils/astrology/jaimini";
import { norm360, separation } from "@/utils/astrology/math";
import { retrogradeIntervals, siderealLongitudeAt } from "@/utils/astrology/scan";
import {
  transitSnapshot,
  vedhaBlocked,
  VEDHA_TABLE,
} from "@/utils/astrology/rectification/transitFitness";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type {
  AyanamshaId,
  ChartData,
  DashaPeriod,
  Dignity,
  NakshatraRelation,
  PlanetId,
  YogaFinding,
} from "@/utils/astrology/types";
import { munthaAt, type Muntha } from "@/utils/astrology/varshaphala";
import { isGandanta, traitOf } from "./nakshatraTraits";
import { buildSpeculationDepth } from "./speculationDepth";
import type { Evidence, RankedItem, SectionReport } from "./report";
import { plain, themeConnection, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Speculation: what this chart can and cannot do with risk capital, and when.
 *
 * SOURCES (module-level; per-rule citations are attached to the Evidence rows
 * and tabulated in data/interpretations/SOURCES.md):
 *  - The speculation house scheme — 5th (purva punya, the wager itself), 11th
 *    (labha, gains actually realised), 8th (sudden and other people's money),
 *    with the 2nd (accumulation), 6th (debt and borrowed capital), 9th
 *    (bhagya) and 12th (loss) supporting — follows the standard house
 *    significations of BPHS's bhava-phala and Dhana-yoga chapters and
 *    Phaladeepika's house chapters.
 *  - The 5th-lord ↔ 11th-lord association as the single strongest positive
 *    signature is the Dhana-yoga construction applied to the speculation axis.
 *  - Vipareeta Raja Yoga read as the contrarian / distressed / short-side
 *    signature is a **modern synthesis** over a classical yoga: BPHS gives the
 *    yoga, not the market application. Labelled everywhere it is used.
 *  - Gochara is judged **from the natal Moon first and the Lagna second**, with
 *    the classical vedha table applied — this repo's documented convention;
 *    the table itself is reused from `rectification/transitFitness.ts` rather
 *    than duplicated.
 *  - Mercury retrograde as an adverse marker for trading is **market-astrology
 *    convention, not a Parashari rule** — logged in the disagreement log and
 *    labelled in the output.
 *  - Ashtakavarga SAV thresholds (≥30 supportive, ≤25 weak) are the common
 *    applied convention over BPHS's Sarvashtakavarga.
 *
 * NOT FINANCIAL ADVICE, structurally: nothing here names an instrument to buy,
 * a size to take, a return to expect or a probability of profit. The reading
 * describes the chart's tendencies. The panel states this permanently.
 *
 * Deterministic: `now` is injected wherever it is needed and is used only to
 * phase-label windows. No `Date.now()`, no randomness.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpeculationAxisKey = "promise" | "sudden" | "retention" | "risk" | "judgement";

export interface SpeculationAxis {
  key: SpeculationAxisKey;
  label: string;
  /** 0–100. */
  score: number;
  /** One-line reading of what that number means in practice. */
  reading: string;
}

/** One speculation significator, with its nakshatra chain spelled out. */
export interface SignificatorRow {
  id: PlanetId;
  /** Why this planet is on the list ("rules your 5th", "the speculation graha"). */
  roles: string[];
  sign: number;
  house: number;
  dignity: Dignity;
  nakshatra: number;
  nakshatraLord: PlanetId;
  relation: NakshatraRelation;
  gandanta: boolean;
  /** The dispositor chain in plain English. */
  chain: string;
}

export interface SpeculationReport extends SectionReport {
  axes: SpeculationAxis[];
  worksBecause: Evidence[];
  failsBecause: Evidence[];
  instruments: RankedItem[];
  /** Percentages over the instruments above, summing to exactly 100. */
  split: { key: string; label: string; percent: number }[];
  significators: SignificatorRow[];
  riskManagement: string[];
}

export interface SpeculationWindow {
  label: string;
  start: Date;
  end: Date;
  polarity: "favourable" | "adverse";
  /** −100…100. */
  score: number;
  grade: "strong" | "moderate" | "mild";
  /** 5–95. */
  confidence: number;
  reasons: { text: string; weight: number }[];
  phase: "past" | "current" | "future";
}

export interface SpeculationMonth {
  label: string;
  start: Date;
  end: Date;
  /** −100…100. */
  score: number;
  notes: string[];
}

export interface SpeculationYear {
  window: { start: Date; end: Date };
  hasDasha: boolean;
  beforeBirth: boolean;
  months: SpeculationMonth[];
  favourable: SpeculationWindow[];
  adverse: SpeculationWindow[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const DUSTHANA = [6, 8, 12];
const BENEFIC_IDS: PlanetId[] = ["Ju", "Ve", "Me", "Mo"];

/** Houses that make a planet "speculation-connected" for the timing engine. */
const SPEC_HOUSES = [5, 11, 2, 9];
const SPEC_KARAKAS: PlanetId[] = ["Ra", "Ju", "Me", "Ve"];
const LOSS_HOUSES = [6, 8, 12];

interface Ctx {
  chart: ChartData;
  lagna: number;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  planetOf: (id: PlanetId) => ChartData["planets"][number] | undefined;
  lordOf: (house: number) => PlanetId;
  signOfHouse: (house: number) => number;
  score: (id: PlanetId) => number;
  sav: (house: number) => number | null;
}

function makeCtx(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  av: AshtakavargaResult | null
): Ctx {
  const lagna = chart.ascendant.sign;
  const signOfHouse = (house: number) => (lagna + house - 1) % 12;
  return {
    chart,
    lagna,
    strengths,
    planetOf: (id) => chart.planets.find((p) => p.id === id),
    lordOf: (house) => SIGN_LORDS[signOfHouse(house)],
    signOfHouse,
    // 50 is the neutral baseline the composite score is built around.
    score: (id) => strengths[id]?.score ?? 50,
    sav: (house) => (av ? av.sav[signOfHouse(house)] : null),
  };
}

/** Conjunction, mutual 7th, or sign exchange between two planets. */
function associationBetween(ctx: Ctx, a: PlanetId, b: PlanetId): string | null {
  if (a === b) return null;
  const pa = ctx.planetOf(a);
  const pb = ctx.planetOf(b);
  if (!pa || !pb) return null;
  if (pa.sign === pb.sign) return "conjoin in the same sign";
  if ((pb.sign - pa.sign + 12) % 12 === 6) return "stand in mutual aspect across the chart";
  const aRulesB = SIGN_LORDS[pb.sign] === a;
  const bRulesA = SIGN_LORDS[pa.sign] === b;
  if (aRulesB && bRulesA) return `exchange signs (${plain("parivartana")})`;
  if (aspectedSigns(a, pa.sign).includes(pb.sign) || aspectedSigns(b, pb.sign).includes(pa.sign)) {
    return "aspect one another";
  }
  return null;
}

/** Shadbala ratio for a planet, or null when Shadbala is unavailable. */
function shadbalaRatio(shadbala: ShadbalaSet | null, id: PlanetId): number | null {
  if (!shadbala) return null;
  const seven = shadbala.planets[id as PlanetId7];
  return seven ? seven.ratio : null;
}

// ---------------------------------------------------------------------------
// The five axes
// ---------------------------------------------------------------------------

interface AxisResult {
  axis: SpeculationAxis;
  positives: Evidence[];
  negatives: Evidence[];
}

/**
 * A. Promise of speculative gain — the 5th, the 11th and the 9th, and above
 * all the link between the 5th and 11th lords.
 */
function axisPromise(
  ctx: Ctx,
  shadbala: ShadbalaSet | null,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null
): AxisResult {
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  let score = 40;

  const l5 = ctx.lordOf(5);
  const l11 = ctx.lordOf(11);
  const l9 = ctx.lordOf(9);

  for (const [house, lord, weight] of [
    [5, l5, 0.28],
    [11, l11, 0.28],
    [9, l9, 0.14],
  ] as [number, PlanetId, number][]) {
    const p = ctx.planetOf(lord);
    const s = ctx.score(lord);
    const delta = (s - 50) * weight;
    score += delta;
    const row: Evidence = {
      text: `${PLANET_NAMES[lord]} rules your ${ordinal(house)} house${
        house === 5 ? " of speculation and intuition" : house === 11 ? " of gains realised" : " of fortune"
      } and scores ${s}/100${p ? `, sitting ${DIGNITY_LABELS[p.dignity].toLowerCase()} in your ${ordinal(p.house)}` : ""}. ${
        delta >= 0
          ? "A channel is only ever as strong as the planet running it, and this one has a planet in working order behind it — in a trading week that shows up as ideas that survive contact with the market."
          : "A weak ruler here means the promise is real but thin: setups look right and then fail to pay, which is exactly the pattern that tempts people into sizing up to compensate."
      }`,
      weight: Math.round(delta),
      source: { work: "BPHS", ref: "bhava-phala (5th, 9th, 11th)" },
    };
    (delta >= 0 ? positives : negatives).push(row);

    if (p && DUSTHANA.includes(p.house)) {
      score -= 8;
      negatives.push({
        text: `Your ${ordinal(house)} ruler sits in the ${ordinal(p.house)}, one of the difficult houses. Classically the results of that house get spent before they arrive — in market terms, gains that exist on the screen and not in the account.`,
        weight: -8,
        source: { work: "Phaladeepika", ref: "house lord in dusthana" },
      });
    }
    if (p?.combust) {
      score -= 5;
      negatives.push({
        text: `${PLANET_NAMES[lord]}, your ${ordinal(house)} ruler, is combust — too close to the Sun to act on its own account. Decisions in this area tend to get made by ego rather than by evidence, and the tell is trading to be right rather than to be paid.`,
        weight: -5,
        source: { work: "BPHS", ref: "asta (combustion)" },
      });
    }
  }

  // The single strongest positive signature.
  const link = associationBetween(ctx, l5, l11);
  if (link && l5 !== l11) {
    score += 14;
    positives.push({
      text: `${PLANET_NAMES[l5]} and ${PLANET_NAMES[l11]} — the rulers of your 5th and 11th — ${link}. This is the strongest single mark for speculation in the classical scheme: the house that takes the wager and the house that collects are wired together, so a good call actually converts into money you keep rather than into a story you tell.`,
      weight: 14,
      source: { work: "BPHS", ref: "Dhana Yoga adhyaya (lord association)" },
    });
  } else if (l5 === l11) {
    score += 8;
    positives.push({
      text: `${PLANET_NAMES[l5]} rules your 5th and your 11th at once, so the wager and the payout run through one planet. That concentrates the reading: this planet's condition and its periods effectively are your speculation life, for better and for worse.`,
      weight: 8,
      source: { work: "BPHS", ref: "Dhana Yoga adhyaya" },
    });
  } else {
    score -= 4;
    negatives.push({
      text: "The rulers of your 5th and 11th houses have no direct link — no conjunction, no mutual aspect, no exchange. Speculative insight and realised gain sit in separate compartments in this chart, which in practice means good calls that do not automatically become good outcomes; the conversion has to be engineered rather than assumed.",
      weight: -4,
      source: { work: "BPHS", ref: "Dhana Yoga adhyaya" },
    });
  }

  // Occupants of the 5th and 11th.
  for (const house of [5, 11]) {
    for (const p of ctx.chart.planets.filter((q) => q.house === house)) {
      const benefic = BENEFIC_IDS.includes(p.id);
      const delta = benefic ? 5 : p.id === "Ra" ? 4 : -3;
      score += delta;
      (delta >= 0 ? positives : negatives).push({
        text: `${PLANET_NAMES[p.id]} occupies your ${ordinal(house)} house, which puts live activity into it rather than potential. ${
          benefic
            ? "A benefic there tends to show as patience being rewarded — the position you did not panic out of."
            : p.id === "Ra"
              ? "Rahu there is the classic speculator's placement: obsession, appetite for the unfamiliar, and spectacular results in both directions."
              : "A malefic there adds heat and haste, and the cost usually arrives as a position taken one size too large."
        }`,
        weight: delta,
        source: { work: "BPHS", ref: "bhava occupancy" },
      });
    }
  }

  // Ashtakavarga support for the two speculation signs.
  for (const house of [5, 11]) {
    const sav = ctx.sav(house);
    if (sav === null) continue;
    const delta = sav >= 30 ? 4 : sav <= 25 ? -4 : 0;
    score += delta;
    if (delta !== 0) {
      (delta > 0 ? positives : negatives).push({
        text: `Your ${ordinal(house)} house sign holds ${sav} ${plain("Sarvashtakavarga")} points${
          delta > 0
            ? " — above the 30-point line the tradition treats as well supported, so transits through it tend to deliver rather than merely pass through."
            : " — below the 25-point line, so this sign carries little transit support, and periods that should help here often read as flat."
        }`,
        weight: delta,
        source: { work: "BPHS", ref: "Sarvashtakavarga (applied threshold convention)" },
      });
    }
  }

  // Shadbala on the two lords.
  for (const [house, lord] of [[5, l5], [11, l11]] as [number, PlanetId][]) {
    const ratio = shadbalaRatio(shadbala, lord);
    if (ratio === null) continue;
    const sb = shadbala!.planets[lord as PlanetId7];
    const delta = ratio >= 1 ? 4 : -4;
    score += delta;
    (delta > 0 ? positives : negatives).push({
      text: `${PLANET_NAMES[lord]}, your ${ordinal(house)} ruler, reaches ${Math.round(ratio * 100)}% of the strength the classical ${plain("Shadbala")} table asks of it${
        ratio >= 1 ? "" : " — under the bar"
      }, with ${plain("Ishta phala")} ${Math.round(sb.ishta)} against ${plain("Kashta phala")} ${Math.round(sb.kashta)}. ${
        sb.kashta > sb.ishta
          ? "The cost side outweighs the yield side, which is the signature of gains that arrive with something attached — stress, tax, a relationship, a stretch of bad sleep."
          : "The yield side outweighs the cost side, so what this planet gives tends to come cleanly."
      }`,
      weight: delta,
      source: { work: "BPHS", ref: "Shadbala minimum-requirement table" },
    });
  }

  // D-9: does the promise survive magnification?
  if (vargas) {
    for (const [house, lord] of [[5, l5], [11, l11]] as [number, PlanetId][]) {
      const d9 = vargaPositionOf(vargas.charts.D9, lord);
      const d1 = ctx.planetOf(lord);
      if (!d9 || !d1) continue;
      const strongD1 = ["exalted", "moolatrikona", "own", "greatFriend"].includes(d1.dignity);
      const weakD9 = ["debilitated", "greatEnemy", "enemy"].includes(d9.dignity);
      if (strongD1 && weakD9) {
        score -= 6;
        negatives.push({
          text: `${PLANET_NAMES[lord]} looks strong in your main chart but falls to ${DIGNITY_LABELS[d9.dignity].toLowerCase()} in your ${plain("Navamsa")}. The ${ordinal(house)} house promises less than it appears to: results start well and thin out under magnification, which is why size and holding period matter more here than entry does.`,
          weight: -6,
          source: { work: "BPHS", ref: "Ch.6 (Navamsa as the test of strength)" },
        });
      } else if (["exalted", "own", "moolatrikona"].includes(d9.dignity)) {
        score += 5;
        positives.push({
          text: `${PLANET_NAMES[lord]} holds up in your ${plain("Navamsa")} as well as in the main chart, which is the classical test of whether a promise is real. What the ${ordinal(house)} house offers here tends to survive being scaled up.`,
          weight: 5,
          source: { work: "BPHS", ref: "Ch.6 (Navamsa)" },
        });
      }
    }
  }

  // Jaimini: the wealth padas.
  if (jaimini) {
    const a2 = arudhaOfHouse(ctx.chart, 2);
    const gainFromAL = (jaimini.arudhaLagna + 10) % 12;
    const occupantsOfGain = ctx.chart.planets.filter((p) => p.sign === gainFromAL);
    if (occupantsOfGain.length) {
      const delta = occupantsOfGain.some((p) => BENEFIC_IDS.includes(p.id)) ? 5 : -3;
      score += delta;
      (delta > 0 ? positives : negatives).push({
        text: `The 11th sign from your ${plain("Arudha Lagna")} — the Jaimini seat of material gain — is ${SIGNS[gainFromAL]}, with ${occupantsOfGain
          .map((p) => PLANET_NAMES[p.id])
          .join(", ")} in it. ${
          delta > 0
            ? "Benefics there mark gain that other people can see: the money shows in your circumstances, not only in your statements."
            : "Hard planets there mark gain that arrives contested — visible enough to attract attention, and rarely uncomplicated."
        } Your wealth pada (A2) falls in ${SIGNS[a2]}.`,
        weight: delta,
        source: { work: "Jaimini Upadesa Sutras", ref: "arudha padas" },
      });
    }
    const amk = jaimini.karakas.AmK;
    const amkConn = themeConnection(ctx.chart, amk, [5, 11], []);
    if (amkConn) {
      score += 5;
      positives.push({
        text: `${PLANET_NAMES[amk]} is your ${plain("Amatyakaraka")}, and it connects to the speculation houses (${amkConn}). Classically that puts real professional capability behind this area rather than mere interest — the difference between someone who follows markets and someone who could work in them.`,
        weight: 5,
        source: { work: "Jaimini Upadesa Sutras", ref: "chara karakas" },
      });
    }
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    axis: {
      key: "promise",
      label: "Promise of speculative gain",
      score,
      reading:
        score >= 65
          ? "Your 5th–11th axis is genuinely well built: this chart can find an edge and can convert it."
          : score >= 50
            ? "The speculation houses are workable but not exceptional — the edge is real and modest, and it rewards patience over frequency."
            : "The speculation houses are the weaker part of this chart; risk capital here works best as a small, deliberate sleeve rather than as a main activity.",
    },
    positives,
    negatives,
  };
}

/** B. Access to sudden and other people's money — the 8th, and the 2nd–8th axis. */
function axisSudden(ctx: Ctx, vargas: VargaSet | null): AxisResult {
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  let score = 40;

  const l8 = ctx.lordOf(8);
  const l6 = ctx.lordOf(6);
  const p8 = ctx.planetOf(l8);
  const s8 = ctx.score(l8);

  score += (s8 - 50) * 0.25;
  (s8 >= 50 ? positives : negatives).push({
    text: `${PLANET_NAMES[l8]} rules your 8th house — windfalls, inheritance, insurance, leverage, and money that belongs to someone else first — and scores ${s8}/100${
      p8 ? `, placed in your ${ordinal(p8.house)}` : ""
    }. ${
      s8 >= 50
        ? "In working order, that is the planet behind a genuine windfall capacity: money that arrives in one piece rather than in instalments."
        : "Under pressure, the 8th tends to deliver its other face — obligations, margin, and money that arrives already spoken for."
    }`,
    weight: Math.round((s8 - 50) * 0.25),
    source: { work: "BPHS", ref: "8th bhava significations" },
  });

  // The windfall signature versus the margin-call signature.
  const toFive = associationBetween(ctx, l8, ctx.lordOf(5));
  const toEleven = associationBetween(ctx, l8, ctx.lordOf(11));
  if (toFive || toEleven) {
    score += 12;
    const how =
      toFive && toEleven
        ? "Your 8th ruler links to both your 5th and your 11th rulers"
        : toFive
          ? `Your 8th ruler and your 5th ruler ${toFive}`
          : `Your 8th ruler and your 11th ruler ${toEleven}`;
    positives.push({
      text: `${how}. This is the classical windfall wiring: sudden money that actually lands in the gains house rather than passing through. It is also the wiring that makes leverage tempting, because it works often enough to feel safe.`,
      weight: 12,
      source: { work: "BPHS", ref: "Dhana Yoga adhyaya (8th–11th link)" },
    });
  }
  const toSix = associationBetween(ctx, l8, l6);
  const toTwelve = associationBetween(ctx, l8, ctx.lordOf(12));
  if (toSix || toTwelve) {
    score -= 10;
    negatives.push({
      text: `Your 8th ruler and your ${toSix ? "6th ruler of debt" : "12th ruler of loss"} ${toSix ?? toTwelve}, which is the margin-call signature rather than the windfall one. Borrowed money in this chart has a way of compounding in the wrong direction, and the practical reading is to treat leverage as something this chart does not get paid for.`,
      weight: -10,
      source: { work: "Phaladeepika", ref: "6th/8th/12th lord associations" },
    });
  }

  // The 6th on the speculation houses = trading on money that is not yours.
  const sixthOnSpec = [5, 11].filter((h) => {
    const p6 = ctx.planetOf(l6);
    if (!p6) return false;
    const sign = ctx.signOfHouse(h);
    return p6.sign === sign || aspectedSigns(l6, p6.sign).includes(sign);
  });
  if (sixthOnSpec.length) {
    score -= 6;
    negatives.push({
      text: `${PLANET_NAMES[l6]}, your 6th ruler of debt and borrowed capital, ${sixthOnSpec.length === 2 ? "touches both" : "touches"} your ${sixthOnSpec.map(ordinal).join(" and ")} house. Speculation in this chart has a standing pull toward money that is not yours — a credit line, a margin facility, a friend's capital. The counter is structural: a hard wall between risk capital and borrowed capital, decided once rather than each time.`,
      weight: -6,
      source: { work: "BPHS", ref: "6th bhava (rina — debt)" },
    });
  }

  // Rahu in the money-and-risk houses.
  const ra = ctx.planetOf("Ra");
  if (ra && [5, 8, 11].includes(ra.house)) {
    const raScore = ctx.score("Ra");
    const delta = raScore >= 55 ? 9 : 3;
    score += delta;
    positives.push({
      text: `Rahu sits in your ${ordinal(ra.house)} house at ${raScore}/100. Rahu is the speculation graha above all others — leverage, novelty, the unregulated corner, and the appetite that keeps a position open past the point of reason. Placed here it can give sudden, outsized gain; the same placement is what makes a blow-up possible, and the difference between the two outcomes is almost entirely position size.`,
      weight: delta,
      source: { work: "later tradition", ref: "Rahu as karaka of sudden and unconventional gain" },
    });
  }

  const sav8 = ctx.sav(8);
  if (sav8 !== null) {
    const delta = sav8 >= 30 ? 3 : sav8 <= 25 ? -3 : 0;
    score += delta;
    if (delta !== 0) {
      (delta > 0 ? positives : negatives).push({
        text: `Your 8th house sign carries ${sav8} ${plain("Sarvashtakavarga")} points, ${delta > 0 ? "which supports the sudden-money side of this chart" : "which leaves the sudden-money side poorly supported — windfalls here tend to be smaller and rarer than the placements alone suggest"}.`,
        weight: delta,
        source: { work: "BPHS", ref: "Sarvashtakavarga" },
      });
    }
  }

  // D-30 as loss exposure (never as character).
  if (vargas) {
    const d30 = vargaPositionOf(vargas.charts.D30, ctx.lordOf(5));
    if (d30 && ["debilitated", "greatEnemy"].includes(d30.dignity)) {
      score -= 5;
      negatives.push({
        text: `In your ${plain("Trimsamsa")} — the chart read for where things go wrong — your 5th ruler falls in a weak sign. Read narrowly, that marks speculation as one of the places this chart is exposed, which argues for smaller units and pre-decided exits rather than for avoiding the activity.`,
        weight: -5,
        source: { work: "BPHS", ref: "Ch.6 (Trimsamsa — misfortune)" },
      });
    }
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    axis: {
      key: "sudden",
      label: "Access to sudden & other people's money",
      score,
      reading:
        score >= 65
          ? "The 8th house works for you: windfall, leverage and other people's capital are live channels in this chart."
          : score >= 50
            ? "Sudden money is available but not abundant — it shows up occasionally rather than as a repeatable channel."
            : "The 8th house reads as obligation more than windfall here, which is a direct argument against leverage in any form.",
    },
    positives,
    negatives,
  };
}

/** C. Capital retention — the 2nd and 12th, and the classical drains. */
function axisRetention(ctx: Ctx, vargas: VargaSet | null, yogas: YogaFinding[]): AxisResult {
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  let score = 50;

  const l2 = ctx.lordOf(2);
  const l11 = ctx.lordOf(11);
  const l5 = ctx.lordOf(5);
  const p2 = ctx.planetOf(l2);
  const p11 = ctx.planetOf(l11);
  const p5 = ctx.planetOf(l5);

  const s2 = ctx.score(l2);
  score += (s2 - 50) * 0.3;
  (s2 >= 50 ? positives : negatives).push({
    text: `${PLANET_NAMES[l2]} rules your 2nd house of accumulated wealth at ${s2}/100${p2 ? `, from your ${ordinal(p2.house)}` : ""}. ${
      s2 >= 50
        ? "A sound 2nd ruler is what turns a good year into a bigger balance — the money stops somewhere instead of passing through."
        : "A weak 2nd ruler is the quiet problem in a speculative chart: earning is not the difficulty, keeping is."
    }`,
    weight: Math.round((s2 - 50) * 0.3),
    source: { work: "BPHS", ref: "2nd bhava (dhana)" },
  });

  // The four classical drains.
  if (p11 && p11.house === 12) {
    score -= 12;
    negatives.push({
      text: "Your 11th ruler — the planet that governs gains — sits in your 12th house of loss and outflow. This is the classical leak: income arrives and immediately finds an exit. In a trading account it reads as a good month followed by an expense that consumes it, repeatedly, until the pattern is made structural rather than fought each time. Automating a transfer out of the account on a fixed date is the counter that actually works on this placement.",
      weight: -12,
      source: { work: "Phaladeepika", ref: "11th lord in the 12th" },
    });
  }
  if (p2 && DUSTHANA.includes(p2.house)) {
    score -= 10;
    negatives.push({
      text: `Your 2nd ruler sits in the ${ordinal(p2.house)}, a difficult house — accumulated capital erodes from within rather than being lost dramatically. The practical counter is separation: risk capital in one place, reserves somewhere you do not have same-day access to.`,
      weight: -10,
      source: { work: "Phaladeepika", ref: "2nd lord in dusthana" },
    });
  }
  const ke = ctx.planetOf("Ke");
  if (ke && [2, 11].includes(ke.house)) {
    score -= 8;
    negatives.push({
      text: `Ketu occupies your ${ordinal(ke.house)} house. Ketu's signature is value that vanishes without a clear cause — the gain that evaporates between decision and settlement, the position closed for reasons that make no sense a week later. It is not a prohibition on gain; it is an argument for banking profits in defined tranches rather than trusting a running total.`,
      weight: -8,
      source: { work: "later tradition", ref: "Ketu as karaka of sudden loss and detachment" },
    });
  }
  if (p5 && DUSTHANA.includes(p5.house)) {
    score -= 10;
    negatives.push({
      text: `Your 5th ruler — the planet of the wager itself — sits in the ${ordinal(p5.house)}. Classically that converts speculation into debt rather than into gain. Read plainly: this chart's losing trades tend to become obligations, so the single most valuable discipline here is a hard loss limit set before the position exists.`,
      weight: -10,
      source: { work: "Phaladeepika", ref: "5th lord in dusthana" },
    });
  }

  // Saturn's discipline on the money houses.
  const sa = ctx.planetOf("Sa");
  if (sa) {
    const touchesMoney = [2, 11].some((h) => {
      const sign = ctx.signOfHouse(h);
      return sa.sign === sign || aspectedSigns("Sa", sa.sign).includes(sign);
    });
    if (touchesMoney && ctx.score("Sa") >= 50) {
      score += 7;
      positives.push({
        text: "Saturn, in reasonable condition, touches your money houses. Saturn is the one graha that reliably makes someone keep what they earn: it imposes patience, dislikes churn and rewards the boring position held for years. In a speculative context that is a genuine asset — it is the part of you that will not chase.",
        weight: 7,
        source: { work: "BPHS", ref: "Saturn as karaka of restraint and duration" },
      });
    }
  }

  // Daridra / Vipareeta interplay from the detected yogas.
  const daridra = yogas.find((y) => y.key === "daridra");
  if (daridra) {
    score -= 7;
    negatives.push({
      text: "Daridra Yoga forms in your chart — the gains ruler placed in a difficult house. Income arrives with friction attached: leaks, delays, or expenditure that shadows earning. Diversified income and automated saving are the counters the tradition itself points to, and both are plumbing rather than willpower.",
      weight: -7,
      source: { work: "classical yoga literature", ref: "Daridra Yoga" },
    });
  }

  if (vargas) {
    const d2 = vargas.charts.D2;
    let sunHora = 0;
    let moonHora = 0;
    for (const p of d2.positions) {
      if (p.id === "Ra" || p.id === "Ke") continue;
      if (p.sign === 4) sunHora++;
      else moonHora++;
    }
    const selfEarned = sunHora > moonHora;
    positives.push({
      text: `Your ${plain("Hora")} puts ${selfEarned ? `${sunHora} of 7 planets on the Sun's side` : `${moonHora} of 7 planets on the Moon's side`}, which marks money in this chart as ${
        selfEarned
          ? "something earned rather than received. For speculation that matters: capital you built yourself is defended differently from capital that arrived, and this chart tends to defend it well."
          : "something that accumulates rather than something forced. For speculation that cuts both ways — the patience is real, and so is the tendency to leave a position running because closing it feels like work."
      }`,
      weight: 3,
      source: { work: "BPHS", ref: "Ch.6 (Hora varga)" },
    });
    score += 3;
  }

  const sav12 = ctx.sav(12);
  if (sav12 !== null && sav12 >= 30) {
    score -= 3;
    negatives.push({
      text: `Your 12th house sign carries ${sav12} ${plain("Sarvashtakavarga")} points — a well-supported house of outflow. Expenditure in this chart is energetic and finds routes easily; the reading is not poverty, it is that money moves, so the account balance is a poor measure of how a year actually went.`,
      weight: -3,
      source: { work: "BPHS", ref: "Sarvashtakavarga" },
    });
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    axis: {
      key: "retention",
      label: "Capital retention",
      score,
      reading:
        score >= 65
          ? "This chart keeps what it makes — the rarer and more valuable half of a speculative profile."
          : score >= 50
            ? "Retention is adequate: money stays if the structure supports it, and drains if it does not."
            : "Retention is the weak point here. Gains in this chart are real and leave quickly, which makes withdrawal discipline worth more than any entry technique.",
    },
    positives,
    negatives,
  };
}

/**
 * D. Risk-carrying capacity — the Lagna, the Lagna lord, and above all the
 * Moon. The axis most readings omit, and the one that decides real outcomes.
 */
function axisRisk(ctx: Ctx, shadbala: ShadbalaSet | null, yogas: YogaFinding[]): AxisResult {
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  let score = 45;

  const lagnaLord = ctx.lordOf(1);
  const sL = ctx.score(lagnaLord);
  score += (sL - 50) * 0.3;
  (sL >= 50 ? positives : negatives).push({
    text: `${PLANET_NAMES[lagnaLord]} rules your rising sign at ${sL}/100 — this is the planet that says whether you come out of a bad stretch intact. ${
      sL >= 50
        ? "A sound Lagna ruler means a drawdown costs you money and not much else: you sleep, you keep your judgement, and you are still there afterwards."
        : "A pressured Lagna ruler means a drawdown costs more than money — health, sleep and confidence go with it, and the recovery takes longer than the loss did."
    }`,
    weight: Math.round((sL - 50) * 0.3),
    source: { work: "BPHS", ref: "Lagna and its lord" },
  });

  const mo = ctx.planetOf("Mo");
  const sMo = ctx.score("Mo");
  score += (sMo - 50) * 0.4;
  if (mo) {
    (sMo >= 50 ? positives : negatives).push({
      text: `Your Moon stands ${DIGNITY_LABELS[mo.dignity].toLowerCase()} in your ${ordinal(mo.house)} house at ${sMo}/100. The Moon is the mind under pressure, and in speculation that is the whole game: it decides whether a 20% drawdown is information or an emergency. ${
        sMo >= 50
          ? "Yours holds its shape, which is worth more than any amount of analytical skill."
          : "Yours is under strain, and the honest reading is that this chart's losses will mostly come from reacting to losses rather than from the original position."
      }`,
      weight: Math.round((sMo - 50) * 0.4),
      source: { work: "BPHS", ref: "Chandra as karaka of the mind" },
    });

    const onMoon = aspectsOnSign(ctx.chart, mo.sign);
    const withMoon = ctx.chart.planets.filter((p) => p.sign === mo.sign && p.id !== "Mo").map((p) => p.id);
    for (const hard of ["Sa", "Ra", "Ke"] as PlanetId[]) {
      if (!onMoon.includes(hard) && !withMoon.includes(hard)) continue;
      score -= 7;
      negatives.push({
        text: `${PLANET_NAMES[hard]} ${withMoon.includes(hard) ? "sits with" : "aspects"} your Moon. ${
          hard === "Sa"
            ? "Saturn on the Moon reads as fear that arrives before the evidence does — the position closed at the low because holding it felt unbearable rather than because anything changed."
            : hard === "Ra"
              ? "Rahu on the Moon reads as obsession: the screen at midnight, the size taken because the last one worked, the inability to stop while it is still working."
              : "Ketu on the Moon reads as sudden withdrawal — walking away from something mid-way, often correctly and often at exactly the wrong moment."
        } Naming it is most of the work; the counter is a rule written down while calm and followed while not.`,
        weight: -7,
        source: { work: "BPHS", ref: "malefic influence on Chandra" },
      });
    }
  }

  if (shadbala) {
    const moonSb = shadbala.planets.Mo;
    const paksha = moonSb.kala.find((f) => f.label.toLowerCase().includes("paksha"));
    if (paksha) {
      const delta = paksha.virupas >= 30 ? 5 : -5;
      score += delta;
      (delta > 0 ? positives : negatives).push({
        text: `Your Moon carries ${Math.round(paksha.virupas)} of 60 virupas of paksha bala — the strength it takes from being waxing or waning. ${
          delta > 0
            ? "A bright Moon holds emotional reserve, and reserve is exactly what a losing streak consumes."
            : "A dark Moon has less reserve to spend, so the same drawdown lands harder here than it would elsewhere. Smaller units are the practical answer, not more resolve."
        }`,
        weight: delta,
        source: { work: "BPHS", ref: "Paksha bala" },
      });
    }
  }
  // When Shadbala is absent the axis simply proceeds on the composite score;
  // the caller reports the degradation as a caveat.

  const kemadruma = yogas.find((y) => y.key === "kemadruma");
  if (kemadruma) {
    const cancelled = kemadruma.name.includes("cancelled");
    score -= cancelled ? 4 : 12;
    negatives.push({
      text: cancelled
        ? "Kemadruma Yoga forms around your Moon but your chart cancels it. The isolation shows only as an occasional need to be left alone — worth knowing, because a bad week is when you will most want to disappear and most need not to."
        : "Kemadruma Yoga stands in your chart — your Moon has no planetary company on either side. Classically this is emotional isolation, and in a trading context it is the most expensive pattern on this page: decisions made alone, at the worst moment, with nobody to say the obvious thing. A standing weekly conversation with someone who knows what you hold is a structural fix, not a soft one.",
      weight: cancelled ? -4 : -12,
      source: { work: "classical yoga literature", ref: "Kemadruma" },
    });
  }

  if (mo && [1, 4, 7, 10].includes(mo.house)) {
    score += 4;
    positives.push({
      text: `Your Moon holds a ${plain("kendra")}, which classically steadies the mind and gives it somewhere to stand. Under pressure you tend to have a floor rather than a slide.`,
      weight: 4,
      source: { work: "BPHS", ref: "kendra placement" },
    });
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    axis: {
      key: "risk",
      label: "Risk-carrying capacity",
      score,
      reading:
        score >= 65
          ? "You can hold a drawdown without it holding you — the single most valuable thing in this whole reading."
          : score >= 50
            ? "Your tolerance for drawdown is ordinary: fine at sizes that do not frighten you, and not much beyond that."
            : "This is the fragile axis. However good the rest of the chart looks, the chart says losses get reacted to rather than absorbed — so the size that works here is the one you would not notice losing.",
    },
    positives,
    negatives,
  };
}

/** E. Judgement quality — Mercury the merchant, Jupiter the expander. */
function axisJudgement(ctx: Ctx, yogas: YogaFinding[]): AxisResult {
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  let score = 45;

  const me = ctx.planetOf("Me");
  const sMe = ctx.score("Me");
  score += (sMe - 50) * 0.4;
  if (me) {
    (sMe >= 50 ? positives : negatives).push({
      text: `Mercury — the merchant graha, and the one that actually does the arithmetic — stands ${DIGNITY_LABELS[me.dignity].toLowerCase()} in your ${ordinal(me.house)} at ${sMe}/100. ${
        sMe >= 50
          ? "Calculation, record-keeping and the unglamorous part of trading come naturally here, which is most of the edge that exists."
          : "The analytical side needs external structure in this chart: a written checklist and a journal do more for these results than any further study will."
      }`,
      weight: Math.round((sMe - 50) * 0.4),
      source: { work: "BPHS", ref: "Budha as karaka of commerce and calculation" },
    });
    if (me.combust) {
      score -= 12;
      negatives.push({
        text: "Mercury is combust in your chart — the calculating faculty sits inside the Sun's glare. Classically that is judgement burnt by ego, and in practice it is the decision made to defend a view rather than to test it. The counter is mechanical: write the thesis and the invalidation level down before entering, so the ego argues with a piece of paper rather than with the market.",
        weight: -12,
        source: { work: "BPHS", ref: "asta (combustion)" },
      });
    }
    if (me.retrograde) {
      score -= 5;
      negatives.push({
        text: "Your natal Mercury is retrograde. Read carefully, that is not weakness — retrograde planets are strong in cheshta — but it does describe a mind that revisits: re-entering the same trade, re-reading the same thesis, changing an order twice. Slower, fewer, larger decisions suit this placement better than fast ones.",
        weight: -5,
        source: { work: "BPHS", ref: "vakri (retrograde) motion" },
      });
    }
  }

  const bhadra = yogas.find((y) => y.key === "mahapurusha-Me");
  if (bhadra) {
    score += 12;
    positives.push({
      text: "Bhadra Yoga forms in your chart — Mercury dignified in an angle, one of the five great-person combinations. This is a genuine analytical edge: fast comprehension, commercial fluency, and the ability to hold a complicated position in your head. It is the strongest single argument in this chart for treating markets as a skill rather than a gamble.",
      weight: 12,
      source: { work: "BPHS", ref: "Pancha Mahapurusha (Bhadra)" },
    });
  }
  const budhaditya = yogas.find((y) => y.key === "budhaditya");
  if (budhaditya) {
    const delta = me?.combust ? 2 : 6;
    score += delta;
    positives.push({
      text: `Budhaditya Yoga is present — Sun and Mercury together${me?.combust ? ", though with Mercury combust, so the gift arrives tangled with ego and needs the written-thesis habit above" : ", giving articulate, administratively sharp intelligence that reads situations quickly"}.`,
      weight: delta,
      source: { work: "classical yoga literature", ref: "Budhaditya" },
    });
  }

  const ju = ctx.planetOf("Ju");
  const sJu = ctx.score("Ju");
  score += (sJu - 50) * 0.25;
  if (ju) {
    const saOnJu = aspectsOnSign(ctx.chart, ju.sign).includes("Sa") ||
      ctx.chart.planets.some((p) => p.id === "Sa" && p.sign === ju.sign);
    if (sJu >= 60 && !saOnJu) {
      score -= 5;
      negatives.push({
        text: "Jupiter is strong in your chart and Saturn does not touch it. Jupiter is the bull — it expands price expectations and position sizes with equal enthusiasm, and without Saturn's restraint there is nothing in the chart arguing for smaller. Optimism is an asset until it becomes leverage; a fixed maximum position size, set once, does the job Saturn is not doing here.",
        weight: -5,
        source: { work: "BPHS", ref: "Guru as karaka of expansion" },
      });
    } else if (sJu >= 55) {
      score += 6;
      positives.push({
        text: `Jupiter stands ${DIGNITY_LABELS[ju.dignity].toLowerCase()} in your ${ordinal(ju.house)} at ${sJu}/100, and it is restrained rather than unchecked. That combination — expansion with a brake on it — is what long-horizon capital growth actually looks like from the inside.`,
        weight: 6,
        source: { work: "BPHS", ref: "Guru as karaka of growth" },
      });
    }
  }

  const sasa = yogas.find((y) => y.key === "mahapurusha-Sa");
  if (sasa) {
    score += 8;
    positives.push({
      text: "Sasa Yoga forms — Saturn dignified in an angle. Contrarian discipline in its strongest classical form: the patience to be early and wrong for a long time before being right, and the stomach to buy what everybody else is finished with.",
      weight: 8,
      source: { work: "BPHS", ref: "Pancha Mahapurusha (Sasa)" },
    });
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    axis: {
      key: "judgement",
      label: "Judgement & execution quality",
      score,
      reading:
        score >= 65
          ? "Analysis and execution are dependable here — the part of the process least likely to fail you."
          : score >= 50
            ? "Judgement is sound but not self-correcting: it holds up when written down and drifts when kept in your head."
            : "Judgement is the axis to build scaffolding around — checklists, journals and a second reader do more for this chart than more information will.",
    },
    positives,
    negatives,
  };
}

// ---------------------------------------------------------------------------
// Instrument fit
// ---------------------------------------------------------------------------

interface InstrumentDef {
  key: string;
  label: string;
  blurb: string;
  houses: number[];
  karakas: PlanetId[];
  /** Nakshatras (0–26) whose temperament particularly suits this instrument. */
  nakshatras?: number[];
}

const INSTRUMENTS: InstrumentDef[] = [
  {
    key: "intraday", label: "Intraday & short-term trading",
    blurb: "positions opened and closed inside days",
    houses: [3, 5], karakas: ["Me", "Mo", "Ma"],
  },
  {
    key: "swing", label: "Positional & swing trading",
    blurb: "weeks to months, riding a move rather than a tick",
    houses: [5, 11], karakas: ["Ju", "Me"],
  },
  {
    key: "longterm", label: "Long-term investing",
    blurb: "years, compounding, boredom as a feature",
    houses: [2, 9, 11], karakas: ["Sa", "Ju"],
  },
  {
    key: "derivatives", label: "Derivatives & leverage",
    blurb: "borrowed exposure, defined risk in theory and undefined in practice",
    houses: [8, 5, 11], karakas: ["Ra", "Ma"],
  },
  {
    key: "crypto", label: "Crypto & unregulated digital assets",
    blurb: "new, unbacked, and outside the usual rules",
    houses: [8, 11], karakas: ["Ra", "Sa"],
    nakshatras: [5, 23, 14], // Ardra, Shatabhisha, Swati
  },
  {
    key: "chance", label: "Lottery, betting & pure chance",
    blurb: "no edge available, only luck and grace",
    houses: [5, 9, 11], karakas: ["Ra", "Ju"],
  },
  {
    key: "commodities", label: "Commodities & metals",
    blurb: "physical goods, energy, the things that get dug up",
    houses: [4, 2, 11], karakas: ["Ma", "Ve", "Sa"],
  },
  {
    key: "property", label: "Real estate & land",
    blurb: "slow, lumpy, and hard to sell in a hurry",
    houses: [4, 2, 11], karakas: ["Ma", "Sa"],
  },
  {
    key: "ipo", label: "IPOs & new issues",
    blurb: "buying the story before there is a record",
    houses: [5, 11, 8], karakas: ["Ra", "Ju"],
  },
  {
    key: "contrarian", label: "Contrarian, distressed & short-side",
    blurb: "profiting where others are being carried out",
    houses: [6, 8, 12, 11], karakas: ["Sa", "Ke"],
  },
];

/** D-4 lifts the property row specifically; D-10 lifts everything if trading could be the job. */
function scoreInstruments(
  ctx: Ctx,
  vargas: VargaSet | null,
  yogas: YogaFinding[]
): { def: InstrumentDef; raw: number; evidence: Evidence[] }[] {
  const rows = INSTRUMENTS.map((def) => {
    const evidence: Evidence[] = [];
    let raw = 0;

    for (const h of def.houses) {
      const lord = ctx.lordOf(h);
      const s = ctx.score(lord);
      const w = (s - 45) / 2.5;
      raw += w;
      evidence.push({
        text: `${PLANET_NAMES[lord]} rules your ${ordinal(h)} house and scores ${s}/100 — this route is as strong as the planet running it.`,
        weight: Math.round(w),
      });
      for (const p of ctx.chart.planets.filter((q) => q.house === h)) {
        const delta = BENEFIC_IDS.includes(p.id) ? 5 : 3;
        raw += delta;
        evidence.push({
          text: `${PLANET_NAMES[p.id]} occupies your ${ordinal(h)}, which puts real activity into this route rather than potential.`,
          weight: delta,
        });
      }
    }
    for (const k of def.karakas) {
      const s = ctx.score(k);
      if (s >= 58) {
        raw += 6;
        evidence.push({
          text: `${PLANET_NAMES[k]} naturally governs this kind of risk and is strong in your chart (${s}/100), so the route has a willing planet behind it.`,
          weight: 6,
        });
      } else if (s <= 38) {
        raw -= 5;
        evidence.push({
          text: `${PLANET_NAMES[k]} naturally governs this kind of risk and is under pressure in your chart (${s}/100) — the route asks for something this chart does not readily supply.`,
          weight: -5,
        });
      }
    }
    return { def, raw, evidence };
  });

  const bump = (key: string, delta: number, text: string, source?: Evidence["source"]) => {
    if (delta === 0) return;
    const row = rows.find((r) => r.def.key === key);
    if (!row) return;
    row.raw += delta;
    row.evidence.push({ text, weight: delta, ...(source ? { source } : {}) });
  };

  // Vipareeta Raja Yogas → the contrarian / distressed / short-side seat.
  const vrj = yogas.filter((y) => y.key.startsWith("vrj-"));
  if (vrj.length) {
    bump(
      "contrarian",
      12,
      `${vrj.map((y) => y.name).join(" and ")} ${vrj.length > 1 ? "form" : "forms"} in your chart. A difficult-house lord hidden in a difficult house is the classical reversal: adversity turns on itself, and rivals' trouble becomes your opportunity. Applied to markets that is the contrarian and distressed seat specifically — buying what has already broken, and being comfortable where the mood is bad. The classical yoga is BPHS; reading it as a market posture is this app's synthesis.`,
      { work: "BPHS + modern synthesis", ref: "Vipareeta Raja Yoga applied to contrarian positioning" }
    );
  }

  // Rahu's condition drives the four high-volatility rows.
  const ra = ctx.planetOf("Ra");
  const sRa = ctx.score("Ra");
  if (ra) {
    const linked = [5, 8, 11].includes(ra.house) ||
      [5, 11].some((h) => aspectedSigns("Ra", ra.sign).includes(ctx.signOfHouse(h)));
    for (const key of ["derivatives", "crypto", "chance", "ipo"]) {
      const delta = linked && sRa >= 55 ? 8 : linked ? 2 : sRa <= 40 ? -7 : -2;
      bump(
        key,
        delta,
        delta > 0
          ? `Rahu — the graha of leverage, novelty and the unregulated — sits in your ${ordinal(ra.house)} and connects to your speculation houses at ${sRa}/100. This is the route Rahu actually favours in your chart.`
          : `Rahu, which governs this route, ${linked ? `is connected but only ${sRa}/100` : `sits in your ${ordinal(ra.house)} without touching your speculation houses`}. Appetite for this route tends to outrun the chart's capacity to survive it.`,
        { work: "later tradition", ref: "Rahu as karaka of speculation and leverage" }
      );
    }
  }

  // Saturn strong on the 5th makes a poor gambler and an excellent investor.
  const sa = ctx.planetOf("Sa");
  const sSa = ctx.score("Sa");
  if (sa) {
    const fifthSign = ctx.signOfHouse(5);
    const onFifth = sa.sign === fifthSign || aspectedSigns("Sa", sa.sign).includes(fifthSign);
    if (onFifth && sSa >= 50) {
      bump("longterm", 10, "Saturn, in good condition, sits on or aspects your 5th house. That combination makes a poor gambler and an excellent long-horizon investor: it removes the pleasure from the wager and replaces it with patience. This chart is built to hold, not to trade.", { work: "BPHS", ref: "Shani on the 5th bhava" });
      bump("property", 6, "The same Saturn influence favours slow, illiquid assets that reward waiting.");
      bump("chance", -10, "Saturn on your 5th removes the luck-based route almost entirely — pure-chance outcomes are the one thing Saturn never sponsors.");
      bump("intraday", -6, "Saturn on your 5th argues against speed; short-horizon churn is the style this placement punishes most.");
    }
  }

  // Mars–Rahu contact touching 5/8/11 is the classic leverage blow-up.
  const ma = ctx.planetOf("Ma");
  if (ma && ra) {
    const contact = ma.sign === ra.sign ||
      aspectedSigns("Ma", ma.sign).includes(ra.sign) ||
      aspectedSigns("Ra", ra.sign).includes(ma.sign);
    const touches = [ma.house, ra.house].some((h) => [5, 8, 11].includes(h));
    if (contact && touches) {
      bump("derivatives", -12, "Mars and Rahu are in contact and the pair touches your 5th, 8th or 11th house. This is the classical leverage blow-up signature: aggression fused with appetite, on the money axis. It does not forbid derivatives, but it says clearly that the failure mode here is size rather than direction — and that a hard cap on leverage, decided once, is the single most useful rule this chart can adopt.", { work: "later tradition", ref: "Mars–Rahu contact on the money axis" });
      bump("crypto", -6, "The same Mars–Rahu contact makes the most volatile asset class the least suitable one here.");
    }
  }

  // Mercury + Moon quality drives the intraday row specifically.
  const fastScore = (ctx.score("Me") + ctx.score("Mo")) / 2;
  bump(
    "intraday",
    fastScore >= 58 ? 8 : fastScore <= 42 ? -8 : 0,
    fastScore >= 58
      ? `Mercury and the Moon together average ${Math.round(fastScore)}/100 — quick calculation paired with a steady mind, which is exactly what a short horizon asks for.`
      : `Mercury and the Moon together average ${Math.round(fastScore)}/100. Short-horizon trading punishes precisely that combination when it is under strain: the decisions come fast and the recovery does not.`
  );

  // Nakshatra emphasis (crypto and the esoteric corner).
  const VOLATILE_CARRIERS: PlanetId[] = ["Ra", "Ke", "Sa"];
  for (const row of rows) {
    const stars = row.def.nakshatras;
    if (!stars) continue;
    const hits = ctx.chart.planets.filter(
      (p) => VOLATILE_CARRIERS.includes(p.id) && stars.includes(p.nakshatra)
    );
    if (hits.length) {
      row.raw += 5;
      row.evidence.push({
        text: `${hits.map((p) => `${PLANET_NAMES[p.id]} in ${NAKSHATRAS[p.nakshatra]}`).join(" and ")} — ${hits.map((p) => traitOf(p.nakshatra).speculation).join("; ")}. That temperament suits the unregulated, high-variance corner more than it suits anything orderly.`,
        weight: 5,
        source: { work: "modern synthesis", ref: "nakshatra temperament table" },
      });
    }
  }

  // Venus for valuation, and D-4 for the property row.
  if (ctx.score("Ve") >= 58) {
    bump("commodities", 5, `Venus reaches ${ctx.score("Ve")}/100 — the valuation sense, the instinct for what something is actually worth rather than what it is priced at.`);
  }
  if (vargas) {
    const d4 = vargas.charts.D4;
    const fourth = (d4.ascendant + 3) % 12;
    const occupied = d4.positions.filter((p) => p.sign === fourth && BENEFIC_IDS.includes(p.id));
    if (occupied.length) {
      bump("property", 7, `In your D-4 — the divisional chart of property and fixed assets — ${occupied.map((p) => PLANET_NAMES[p.id]).join(" and ")} occupies the 4th house. Land and buildings are supported in the chart that is actually read for them, not merely in the main chart.`, { work: "BPHS", ref: "Ch.6 (Chaturthamsa)" });
    }
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Significator rows (the nakshatra layer)
// ---------------------------------------------------------------------------

function buildSignificators(ctx: Ctx): SignificatorRow[] {
  const roleMap = new Map<PlanetId, string[]>();
  const addRole = (id: PlanetId, role: string) => {
    const list = roleMap.get(id) ?? [];
    list.push(role);
    roleMap.set(id, list);
  };

  addRole(ctx.lordOf(5), "rules your 5th house of speculation");
  addRole(ctx.lordOf(11), "rules your 11th house of gains");
  addRole(ctx.lordOf(2), "rules your 2nd house of accumulated wealth");
  addRole(ctx.lordOf(8), "rules your 8th house of sudden and borrowed money");
  addRole("Ra", "the speculation graha — leverage, novelty and appetite");
  addRole("Ju", "the graha of expansion and of price going up");
  addRole("Me", "the merchant graha — calculation and execution");
  addRole("Mo", "the mind under pressure");
  addRole("Sa", "the graha of patience, structure and the contrarian hold");

  const rows: SignificatorRow[] = [];
  for (const [id, roles] of roleMap) {
    const p = ctx.planetOf(id);
    if (!p) continue;
    const nl = p.nakshatraLord;
    const nlPos = ctx.planetOf(nl);
    const trait = traitOf(p.nakshatra);
    const gandanta = isGandanta(p.nakshatra, p.pada);

    const relationPhrase =
      p.nakshatraRelation === "self"
        ? "it sits in its own star, so the results come through undiluted"
        : p.nakshatraRelation === "friend"
          ? "a friendly dispositor, so the transmission is clean"
          : p.nakshatraRelation === "enemy"
            ? "an unfriendly dispositor, so the results arrive distorted — the planet promises one thing and delivers another"
            : "a neutral dispositor, so the transmission is neither helped nor hindered";

    const chain =
      `${PLANET_NAMES[id]} occupies ${NAKSHATRAS[p.nakshatra]} pada ${p.pada}, ruled by ${PLANET_NAMES[nl]} — ${relationPhrase}. ` +
      (nlPos
        ? `Because a planet delivers through its star's ruler, ${PLANET_NAMES[id]}'s results are routed through your ${ordinal(nlPos.house)} house, where ${PLANET_NAMES[nl]} sits${
            DUSTHANA.includes(nlPos.house)
              ? " — a difficult house, so what this planet earns tends to leak into that department before you see it"
              : nlPos.house === 11 || nlPos.house === 2
                ? " — a money house, so what this planet earns actually reaches your balance"
                : ""
          }. `
        : "")
      + `The star's own temperament for risk: ${trait.speculation}.` +
      (gandanta
        ? ` This placement also sits in ${plain("Gandanta")} — the junction between a water and a fire sign — which the tradition reads as a knot in that department's karma. It is a difficulty to work with rather than a verdict: expect this planet's money themes to need untangling more than once.`
        : "");

    rows.push({
      id,
      roles,
      sign: p.sign,
      house: p.house,
      dignity: p.dignity,
      nakshatra: p.nakshatra,
      nakshatraLord: nl,
      relation: p.nakshatraRelation,
      gandanta,
      chain,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// The report
// ---------------------------------------------------------------------------

export function buildSpeculationReport(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  shadbala: ShadbalaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  ashtakavarga: AshtakavargaResult | null,
  yogas: YogaFinding[],
  bhavaBala: BhavaBala[] | null
): SpeculationReport {
  const ctx = makeCtx(chart, strengths, ashtakavarga);
  const caveats: string[] = [];

  if (!shadbala) {
    caveats.push(
      "Shadbala — the classical six-fold strength measure — needs an exact birth time and place, and this chart does not carry one. The five gauges below fall back on the quicker composite score, and the Ishta/Kashta reading (what a gain costs you) is simply absent rather than guessed at."
    );
  }
  if (!vargas) {
    caveats.push(
      "The divisional charts could not be built for this chart, so the D-9 test of whether the promise survives magnification, the D-2 earned-versus-accumulated lean and the D-30 loss-exposure reading are all missing from what follows."
    );
  }
  if (!jaimini) {
    caveats.push(
      "The Jaimini layer is unavailable here, so the wealth pada and the 11th from the Arudha Lagna — the Jaimini seat of material gain — are not part of the score."
    );
  }
  if (!ashtakavarga) {
    caveats.push(
      "Ashtakavarga could not be computed for this chart, so nothing below is weighted by how much transit support each sign actually carries."
    );
  }
  if (!bhavaBala) {
    caveats.push(
      "Bhava Bala — the strength of the houses themselves, as opposed to their rulers — is unavailable for this chart, so the deeper tests below judge the money houses only through the planets that rule them."
    );
  }
  if (!chart.birthUtc) {
    caveats.push(
      "Without a birth time there are no dasha periods, so the year engine below cannot run at all. The standing reading of the chart still holds; the timing layer is absent rather than weak."
    );
  }

  const a = axisPromise(ctx, shadbala, vargas, jaimini);
  const b = axisSudden(ctx, vargas);
  const c = axisRetention(ctx, vargas, yogas);
  const d = axisRisk(ctx, shadbala, yogas);
  const e = axisJudgement(ctx, yogas);

  // The deeper classical tests: Bhava Bala, Vimshopaka, Jaimini argala, the
  // badhaka lord, natal vakri motion, the Sudarshana Chakra and the yoga
  // cross-checks. Kept in their own module because they ask different
  // questions from the five axes rather than re-weighting them, and because
  // this file is long enough already.
  const depth = buildSpeculationDepth(chart, vargas, jaimini, bhavaBala, yogas);

  const axes = [a.axis, b.axis, c.axis, d.axis, e.axis];
  // Weighted because these axes are not equally decisive: a chart can be full
  // of Dhana yogas and still blow up on the risk axis, which is why capacity
  // to hold and capacity to keep together outweigh raw promise.
  const overall = clamp(
    Math.round(
      a.axis.score * 0.26 +
        b.axis.score * 0.14 +
        c.axis.score * 0.22 +
        d.axis.score * 0.22 +
        e.axis.score * 0.16 +
        // The deeper tests adjust rather than form their own axis: they are
        // corroboration of the five, not a sixth independent question, and
        // giving them an axis of their own would double-count the same lords.
        depth.adjustment
    ),
    5,
    95
  );

  const worksBecause = [
    ...a.positives, ...b.positives, ...c.positives, ...d.positives, ...e.positives,
    ...depth.positives,
  ].sort((x, y) => y.weight - x.weight);
  const failsBecause = [
    ...a.negatives, ...b.negatives, ...c.negatives, ...d.negatives, ...e.negatives,
    ...depth.negatives,
  ].sort((x, y) => x.weight - y.weight);

  // --- Instrument fit + a split that sums to exactly 100 ---------------------
  const rows = scoreInstruments(ctx, vargas, yogas);
  const floorRaw = Math.min(...rows.map((r) => r.raw));
  const shifted = rows.map((r) => ({ ...r, pos: r.raw - floorRaw + 5 }));
  const total = shifted.reduce((s, r) => s + r.pos, 0);
  const rawPercents = shifted.map((r) => (r.pos / total) * 100);
  const floors = rawPercents.map(Math.floor);
  const remainder = 100 - floors.reduce((x, y) => x + y, 0);
  const order = rawPercents
    .map((p, i) => ({ i, frac: p - floors[i] }))
    .sort((x, y) => y.frac - x.frac || x.i - y.i);
  const percents = [...floors];
  for (let k = 0; k < remainder; k++) percents[order[k].i] += 1;

  const maxPos = Math.max(...shifted.map((r) => r.pos));
  const withPercent = shifted.map((r, i) => {
    const fit = clamp(Math.round((r.pos / maxPos) * 90 + 5), 5, 95);
    return {
      key: r.def.key,
      label: `${r.def.label} (${r.def.blurb})`,
      score: fit,
      verdict: verdictOf(fit) as string,
      reasons: r.evidence,
      percent: percents[i],
      plainLabel: r.def.label,
    };
  });
  withPercent.sort((x, y) => y.percent - x.percent || x.key.localeCompare(y.key));

  const instruments: RankedItem[] = withPercent.map((r) => ({
    key: r.key,
    label: r.label,
    score: r.score,
    verdict: r.verdict,
    reasons: r.reasons,
  }));
  const split = withPercent.map((r) => ({ key: r.key, label: r.plainLabel, percent: r.percent }));

  // --- Risk management, derived from the retention and risk axes -------------
  const riskManagement: string[] = [];
  riskManagement.push(
    d.axis.score >= 65
      ? "Your drawdown tolerance is the strong part of this chart, which means position size can be set by your analysis rather than by your nerves. That is a rare position to be in, and the way it usually gets wasted is by treating it as permission to use leverage — the tolerance is for volatility, not for borrowed money."
      : d.axis.score >= 50
        ? "Your drawdown tolerance is ordinary, so the useful rule is the boring one: size every position so that being completely wrong about it changes your month and not your year. The chart's failure mode is reacting to a loss, and small enough positions simply remove the trigger."
        : "This chart's honest constraint is emotional rather than analytical: losses get reacted to rather than absorbed. The size that works here is the size you could lose entirely without changing your behaviour — and if no size passes that test today, sitting out is a legitimate position rather than a failure to participate."
  );
  riskManagement.push(
    c.axis.score >= 60
      ? "On the retention side you are structurally sound — what you make tends to stay. The habit that keeps it that way is separation: gains moved out of the trading account on a schedule you set once, so the decision is never made in the middle of a good run."
      : "Retention is where this chart leaks, so the counter belongs in the plumbing rather than in your discipline: a standing transfer out of the account after a profitable stretch, and reserves held somewhere with a delay on withdrawal. Chart patterns like this one are fixed by architecture, not by resolve."
  );
  riskManagement.push(
    b.axis.score >= 60 && d.axis.score >= 60
      ? "Leverage is the one place the chart and the psychology agree here, and both say the same thing: it is available and it is still the fastest route to losing everything the rest of the chart earned. Treat a leverage cap as a permanent setting rather than a per-trade decision."
      : "Leverage is the clearest 'no' in this reading. The 8th house and the risk axis do not jointly support borrowed exposure, and the classical pattern for charts like this is a good run followed by one leveraged position that erases it."
  );
  riskManagement.push(
    "None of this is financial advice, and none of it should replace a plan you would be willing to show someone. A chart can describe temperament and timing; it cannot describe a market, and no reading here implies an expected return, a win rate or a probability of profit."
  );

  const significators = buildSignificators(ctx);

  const confidence = clamp(
    42 + (shadbala ? 10 : -6) + (vargas ? 8 : -4) + (jaimini ? 6 : 0) + (ashtakavarga ? 6 : -4) + (chart.birthUtc ? 6 : -8),
    25,
    88
  );

  const headline =
    overall >= 62
      ? "Your chart supports deliberate speculation — the promise is real and, more importantly, you can hold a losing stretch without it undoing you."
      : overall >= 50
        ? "Your chart supports speculation in a limited, structured way: the edge exists, and the reading turns almost entirely on size and on the instrument you choose."
        : overall >= 40
          ? "Your chart is a difficult one for speculation as a habit. The capacity to gain is not the problem; the capacity to keep it and to sit through a drawdown is, and that is what the plan has to be built around."
          : "Your chart argues against speculation as a significant activity. That is a statement about temperament and structure, not about intelligence — and the instrument ranking below shows where the same money would meet less resistance.";

  return {
    key: "speculation",
    title: "Speculation & Risk Capital",
    headline,
    score: overall,
    verdict: verdictOf(overall),
    confidence,
    blocks: [
      {
        heading: "How this reading is built",
        paragraphs: [
          "Five things are judged separately, because a chart can be excellent at one and fatal at another: what your chart promises in speculative gain, whether sudden or borrowed money is available to you, whether you keep what you make, how much of a drawdown you can carry, and how reliable your judgement is under pressure. A chart full of wealth combinations that fails on the fourth of those is the classic account-blowing profile, and averaging the five would hide exactly that.",
          "The reading describes tendencies in your chart. It is not financial advice, it names no instrument, ticker, exchange or amount, and nothing here implies an expected return or a probability of profit.",
        ],
        reasons: worksBecause.slice(0, 3),
      },
      {
        heading: "Which routes this chart actually supports",
        paragraphs: [
          "Each route below is weighed from the planets that rule and occupy its houses, the planets that naturally stand for that kind of risk, and the combinations in your chart that lift or sink it. The percentages describe the balance of support between routes — not amounts, not allocations and not a forecast.",
          "Read the bottom of the list as carefully as the top: those are the routes that cost this chart more than they return, whatever the market is doing.",
        ],
        items: instruments,
      },
      ...(depth.paragraphs.length
        ? [
            {
              heading: "Deeper classical tests",
              paragraphs: [
                "The five gauges above are read from the birth chart, the composite strengths and the transits. What follows asks a set of different questions the same chart can answer — how strong the money houses are in themselves rather than through their rulers, whether the promise survives being subdivided sixteen ways, who intervenes on it, and whether the Moon and the Sun agree with the rising sign about any of it.",
                ...depth.paragraphs,
              ],
              reasons: [...depth.positives.slice(0, 4), ...depth.negatives.slice(0, 4)],
            },
          ]
        : []),
      {
        heading: "Position sizing, leverage and drawdown behaviour",
        paragraphs: riskManagement,
      },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    axes,
    worksBecause,
    failsBecause,
    instruments,
    split,
    significators,
    riskManagement,
  };
}

// ---------------------------------------------------------------------------
// The year engine
// ---------------------------------------------------------------------------

/** A window is twelve months at most, matching `buildMonthlyBreakdown`. */
const MAX_MONTHS = 12;

/**
 * Eclipse peak instants inside [from, to].
 *
 * The installed `astronomy-engine@^2.1.19` **does** expose eclipse search —
 * `SearchGlobalSolarEclipse` / `NextGlobalSolarEclipse` and
 * `SearchLunarEclipse` / `NextLunarEclipse`, verified against the shipped type
 * declarations before this was written, which is why the layer exists at all.
 * If the library refuses an instant (far-past or far-future windows), the
 * failure is reported back to the caller and the year summary says the layer
 * was left out — it is never estimated or faked.
 */
function eclipsePeaks(
  from: Date,
  to: Date
): { peaks: { at: Date; kind: "solar" | "lunar" }[]; failed: boolean } {
  const peaks: { at: Date; kind: "solar" | "lunar" }[] = [];
  try {
    let solar = SearchGlobalSolarEclipse(from);
    for (let i = 0; i < 8 && solar.peak.date <= to; i++) {
      if (solar.peak.date >= from) peaks.push({ at: solar.peak.date, kind: "solar" });
      solar = NextGlobalSolarEclipse(solar.peak);
    }
    let lunar = SearchLunarEclipse(from);
    for (let i = 0; i < 8 && lunar.peak.date <= to; i++) {
      if (lunar.peak.date >= from) peaks.push({ at: lunar.peak.date, kind: "lunar" });
      lunar = NextLunarEclipse(lunar.peak);
    }
  } catch {
    return { peaks: [], failed: true };
  }
  return { peaks, failed: false };
}

interface MonthScore {
  score: number;
  reasons: { text: string; weight: number }[];
}

function scoreMonth(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  monthStart: Date,
  monthEnd: Date,
  retro: Record<string, { start: Date; end: Date }[]>,
  eclipses: { at: Date; kind: "solar" | "lunar" }[],
  strengths: Partial<Record<PlanetId, PlanetStrength>>
): MonthScore {
  const reasons: { text: string; weight: number }[] = [];
  let score = 0;
  const add = (text: string, weight: number) => {
    if (weight === 0) return;
    score += weight;
    reasons.push({ text, weight: Math.round(weight) });
  };

  const nodeMode = chart.meta.nodeMode ?? "mean";
  const mid = new Date((monthStart.getTime() + monthEnd.getTime()) / 2);
  const lagna = chart.ascendant.sign;
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : lagna;
  const monthMs = monthEnd.getTime() - monthStart.getTime();

  // --- 1. Dasha: Maha > Antar > Pratyantar ---------------------------------
  if (dashaTree && chart.birthUtc) {
    const active = activeDashaAt(dashaTree, mid);
    if (active) {
      const levels: [PlanetId, number, string][] = [
        [active.maha.lord, 12, "main period"],
        [active.antar.lord, 9, "sub-period"],
        [active.pratyantar.lord, 5, "sub-sub-period"],
      ];
      for (const [lord, weight, label] of levels) {
        const good = themeConnection(chart, lord, SPEC_HOUSES, SPEC_KARAKAS);
        const bad = themeConnection(chart, lord, LOSS_HOUSES);
        if (good && !bad) {
          add(`Your ${label} runs under ${PLANET_NAMES[lord]}, which connects to the speculation houses (${good})`, weight);
        } else if (good && bad) {
          add(`Your ${label} runs under ${PLANET_NAMES[lord]}, which touches both the gain houses (${good}) and the difficult ones (${bad}) — mixed rather than clean`, weight * 0.3);
        } else if (bad) {
          add(`Your ${label} runs under ${PLANET_NAMES[lord]}, connected only to the difficult houses (${bad}) — the stretch where this chart tends to give money back`, -weight * 0.85);
        }
      }
      // The peak configuration.
      const l5 = SIGN_LORDS[(lagna + 4) % 12];
      const l11 = SIGN_LORDS[(lagna + 10) % 12];
      if (active.maha.lord === l11 && active.antar.lord === l5) {
        add("Your main period lord rules the 11th and your sub-period lord rules the 5th — the strongest speculation configuration the dasha scheme offers", 10);
      } else if (active.maha.lord === l5 && active.antar.lord === l11) {
        add("Your main and sub-period lords are the rulers of your 5th and 11th houses — the speculation axis is lit from both ends", 9);
      }
    }
  }

  // --- 2. Gochara from the Moon first, the Lagna second ---------------------
  const snap = transitSnapshot(ayanamsha, mid, nodeMode);
  const juSign = snap.sign.Ju;
  const saSign = snap.sign.Sa;
  const houseFrom = (sign: number, base: number) => ((sign - base + 12) % 12) + 1;
  const juFromMoon = houseFrom(juSign, moonSign);
  const saFromMoon = houseFrom(saSign, moonSign);

  if ([2, 5, 9, 11].includes(juFromMoon)) {
    const blocked = vedhaBlocked("Ju", juFromMoon, snap, moonSign);
    if (blocked) {
      add(
        `Jupiter's expansive transit of the ${ordinal(juFromMoon)} from your Moon is cancelled by vedha — ${PLANET_NAMES[blocked]} stands in the obstructing ${ordinal(VEDHA_TABLE.Ju[juFromMoon])}`,
        -3
      );
    } else {
      add(`Jupiter transits the ${ordinal(juFromMoon)} from your Moon — the classical expansion signal, and the strongest ordinary tailwind in gochara`, 10);
    }
  } else if ([4, 8, 12].includes(juFromMoon)) {
    add(`Jupiter transits the ${ordinal(juFromMoon)} from your Moon, a stretch the tradition reads as costly rather than expansive`, -5);
  }

  if ([3, 6, 11].includes(saFromMoon)) {
    const blocked = vedhaBlocked("Sa", saFromMoon, snap, moonSign);
    if (blocked) {
      add(`Saturn's supportive ${ordinal(saFromMoon)}-from-Moon transit is cancelled by vedha from ${PLANET_NAMES[blocked]}`, -2);
    } else {
      add(`Saturn transits the ${ordinal(saFromMoon)} from your Moon — one of its three favourable houses, which classically rewards grinding persistence over flair`, 8);
    }
  } else if ([5, 8, 12].includes(saFromMoon)) {
    add(`Saturn transits the ${ordinal(saFromMoon)} from your Moon — contraction, and a stretch where holding capital matters more than deploying it`, -8);
  }

  const juFromLagna = houseFrom(juSign, lagna);
  if ([2, 5, 9, 11].includes(juFromLagna)) {
    add(`Jupiter also transits your ${ordinal(juFromLagna)} house from the rising sign, corroborating the Moon reading`, 4);
  }

  // --- 3. The Saturn + Jupiter double transit ------------------------------
  const specSigns = [(lagna + 4) % 12, (lagna + 10) % 12];
  const dt = specSigns.filter((s) => doubleTransitOnSign(s, juSign, saSign));
  if (dt.length) {
    add(
      `Saturn and Jupiter jointly influence your ${dt.map((s) => (s === specSigns[0] ? "5th" : "11th")).join(" and ")} house sign — the strongest gate the tradition recognises for a theme actually delivering`,
      12
    );
  }

  // --- 4. Ashtakavarga -----------------------------------------------------
  if (av) {
    for (const [id, sign] of [["Jupiter", juSign], ["Saturn", saSign]] as [string, number][]) {
      const sav = av.sav[sign];
      const delta = sav >= 30 ? 4 : sav <= 25 ? -4 : 0;
      if (delta !== 0) {
        add(
          `${id} transits ${SIGNS[sign]}, a sign holding ${sav} ${sav >= 30 ? "well-supported" : "thin"} Sarvashtakavarga points`,
          delta
        );
      }
    }
    // A transiting planet's *own* Bhinnashtakavarga bindus in the sign it
    // occupies is the standard applied refinement on top of the Sarva figure
    // — the same idea the Kaksha subdivision formalises. Jupiter was already
    // scored this way; Saturn, which does at least as much of the damage in
    // this section, was not.
    for (const [id, sign, label] of [
      ["Ju", juSign, "Jupiter"],
      ["Sa", saSign, "Saturn"],
    ] as [PlanetId, number, string][]) {
      const bav = av.bav[id]?.[sign];
      if (bav === undefined) continue;
      add(
        `${label} carries ${bav} of its own 8 bindus in the sign it transits${
          bav >= 5 ? " — a transit its own points support" : bav <= 3 ? " — a transit its own points do not support" : ""
        }`,
        clamp((bav - 4) * 1.5, -6, 6)
      );
    }
  }

  // --- 5. Retrogression ----------------------------------------------------
  const overlapFraction = (iv: { start: Date; end: Date }): number => {
    const s = Math.max(iv.start.getTime(), monthStart.getTime());
    const e = Math.min(iv.end.getTime(), monthEnd.getTime());
    return monthMs > 0 ? Math.max(0, e - s) / monthMs : 0;
  };
  const RETRO_WEIGHT: Record<string, { w: number; text: string }> = {
    Me: {
      w: -12,
      text: "Mercury is retrograde — the market-astrology convention treats this as the sharpest adverse marker for trading (mispricing, execution error, orders that need re-entering). It is a modern convention rather than a Parashari rule, and it is weighted as one",
    },
    Ve: { w: -6, text: "Venus is retrograde, which classically muddles valuation — what something is worth becomes harder to judge than usual" },
    Ma: { w: -5, text: "Mars is retrograde, which turns decisive action into repeated, half-finished action — the stretch where positions get re-entered rather than held" },
  };
  for (const [id, cfg] of Object.entries(RETRO_WEIGHT)) {
    const frac = (retro[id] ?? []).reduce((s, iv) => s + overlapFraction(iv), 0);
    if (frac > 0.15) {
      add(`${cfg.text} for about ${Math.round(Math.min(1, frac) * 100)}% of this month`, cfg.w * Math.min(1, frac));
    }
  }

  // --- 5b. Muntha: the Tajika annual point ---------------------------------
  // The section carries a *year* selector, and the annual point is the one
  // classical technique built for exactly that question. It advances one house
  // per completed year of life, so it is constant across most of a window and
  // steps once on the birthday — which is why it is evaluated per month rather
  // than once for the window.
  const muntha = munthaAt(chart, mid);
  if (muntha) {
    const GAIN = [1, 2, 5, 9, 10, 11];
    const LOSS = [6, 8, 12];
    const lordScore = strengths[muntha.lord]?.score ?? 50;
    if (GAIN.includes(muntha.house)) {
      add(
        `Your ${plain("Muntha")} — the Tajika annual point — stands in your ${ordinal(muntha.house)} house this year, one of the houses the annual tradition reads as productive. Its lord ${PLANET_NAMES[muntha.lord]} scores ${lordScore}/100, which is what decides how much of that the year actually delivers`,
        clamp(4 + (lordScore - 50) * 0.08, 0, 7)
      );
    } else if (LOSS.includes(muntha.house)) {
      add(
        `Your ${plain("Muntha")} stands in your ${ordinal(muntha.house)} this year — one of the difficult houses in the ${plain("Varshaphala")} scheme. The annual tradition reads this as a year for consolidation rather than expansion, and its lord ${PLANET_NAMES[muntha.lord]} at ${lordScore}/100 sets how sharply that lands`,
        clamp(-5 + (lordScore - 50) * 0.05, -8, -1)
      );
    }
  }

  // --- 6. Saturn's stance on the Moon: capital-preservation flags -----------
  if (saFromMoon === 12 || saFromMoon === 1 || saFromMoon === 2) {
    add(
      `${plain("Sade Sati")} is running (${saFromMoon === 12 ? "opening" : saFromMoon === 1 ? "peak" : "closing"} phase) — a capital-preservation stretch by classical reading, whatever the market is doing`,
      -6
    );
  } else if (saFromMoon === 4 || saFromMoon === 10) {
    add(`Saturn holds the ${ordinal(saFromMoon)} from your Moon (Kantaka Shani), the classical obstruction transit`, -5);
  } else if (saFromMoon === 8) {
    add("Saturn holds the 8th from your Moon (Ashtama Shani) — the stretch where the tradition is most explicit about protecting what you have", -7);
  }

  // --- 7. Rahu/Ketu over the sensitive points ------------------------------
  const raSign = snap.sign.Ra;
  const keSign = snap.sign.Ke;
  const natal5 = (lagna + 4) % 12;
  const natal8 = (lagna + 7) % 12;
  const natal11 = (lagna + 10) % 12;
  if (raSign === natal5 || raSign === natal11) {
    add("Rahu transits your 5th or 11th house sign — appetite and opportunity both rise, and so does the chance of confusing a mania for an edge", 5);
  }
  if (raSign === moonSign || keSign === moonSign) {
    add(`${raSign === moonSign ? "Rahu" : "Ketu"} transits your natal Moon sign — the mind runs hot or hollow, and decisions made in this stretch read differently a month later`, -8);
  }
  if (keSign === natal5 || keSign === natal8 || keSign === natal11) {
    add("Ketu transits one of your money-and-risk house signs, which classically thins out results rather than destroying them — the month where positions quietly fail to pay", -5);
  }

  // --- 8. Eclipse proximity to a natal speculation significator ------------
  const sensitive: { id: PlanetId | "Lagna"; lon: number }[] = [
    { id: "Lagna", lon: chart.ascendant.longitude },
  ];
  for (const id of [SIGN_LORDS[natal5], SIGN_LORDS[natal11], SIGN_LORDS[natal8], "Ra", "Mo"] as PlanetId[]) {
    const p = chart.planets.find((q) => q.id === id);
    if (p) sensitive.push({ id, lon: p.longitude });
  }
  for (const ec of eclipses) {
    if (ec.at < monthStart || ec.at >= monthEnd) continue;
    const sunLon = siderealLongitudeAt("Su", ayanamsha, ec.at, nodeMode);
    // A solar eclipse sits at the Sun; a lunar eclipse straddles the Sun–Moon
    // axis, so the opposite point is equally sensitive.
    const points = ec.kind === "solar" ? [sunLon] : [sunLon, norm360(sunLon + 180)];
    for (const s of sensitive) {
      const near = points.some((pt) => separation(pt, s.lon) <= 5);
      if (!near) continue;
      add(
        `A ${ec.kind} eclipse falls within 5° of ${s.id === "Lagna" ? "your rising degree" : `your natal ${PLANET_NAMES[s.id as PlanetId]}`} this month — a volatility marker rather than a direction, and a reason to size down rather than to predict`,
        -6
      );
      break;
    }
  }

  return { score: clamp(Math.round(score), -100, 100), reasons };
}

/**
 * Best and worst speculation stretches inside a selected window.
 *
 * Every month is scored on a signed −100…+100 scale from the running dashas
 * and the gochara, contiguous months of the same polarity are merged, and the
 * result is returned as ranked favourable and adverse sets plus the full
 * month table. `now` is used only to phase-label the windows.
 */
export function speculationYearWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  ashtakavarga: AshtakavargaResult | null,
  start: Date,
  end: Date,
  now: Date,
  strengths: Partial<Record<PlanetId, PlanetStrength>> = {}
): SpeculationYear {
  const hasDasha = Boolean(dashaTree && chart.birthUtc);
  const beforeBirth = Boolean(chart.birthUtc && end.getTime() <= chart.birthUtc.getTime());
  const nodeMode = chart.meta.nodeMode ?? "mean";

  // Retrograde stretches, scanned once for the whole window rather than per month.
  const retro: Record<string, { start: Date; end: Date }[]> = {};
  for (const id of ["Me", "Ve", "Ma"] as PlanetId[]) {
    retro[id] = retrogradeIntervals(id, ayanamsha, start, end, 2, nodeMode);
  }
  const { peaks, failed: eclipseFailed } = eclipsePeaks(start, end);

  // --- Month table ---------------------------------------------------------
  const months: SpeculationMonth[] = [];
  const scored: MonthScore[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < MAX_MONTHS && cursor.getTime() < end.getTime(); i++) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const blockEnd = next.getTime() > end.getTime() ? new Date(end) : next;
    const mid = new Date((cursor.getTime() + blockEnd.getTime()) / 2);

    const ms = scoreMonth(
      chart, dashaTree, ayanamsha, ashtakavarga, new Date(cursor), blockEnd, retro, peaks, strengths
    );
    scored.push(ms);
    months.push({
      label: mid.toLocaleString("en-US", { month: "long", year: "numeric" }),
      start: new Date(cursor),
      end: blockEnd,
      score: ms.score,
      notes: [...ms.reasons]
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, 4)
        .map((r) => r.text),
    });
    cursor.setTime(next.getTime());
  }

  // --- Merge contiguous months of the same polarity ------------------------
  const FAVOURABLE_CUT = 12;
  const ADVERSE_CUT = -12;
  const polarityOf = (s: number): "favourable" | "adverse" | null =>
    s >= FAVOURABLE_CUT ? "favourable" : s <= ADVERSE_CUT ? "adverse" : null;

  const windows: SpeculationWindow[] = [];
  let runStart = 0;
  let runPolarity: "favourable" | "adverse" | null = null;

  /** "Jupiter transits the 11th from your Moon — the classical…" → the clause. */
  const headClause = (text: string): string => {
    const cut = text.search(/ — |, which | \(/);
    return cut === -1 ? text : text.slice(0, cut);
  };

  const flush = (endIndex: number) => {
    const polarity = runPolarity;
    if (polarity === null) return;
    const members = months.slice(runStart, endIndex);
    const memberScores = scored.slice(runStart, endIndex);
    if (!members.length) return;
    const mean = Math.round(members.reduce((s, m) => s + m.score, 0) / members.length);
    const magnitude = Math.abs(mean);
    const grade: SpeculationWindow["grade"] =
      magnitude >= 45 ? "strong" : magnitude >= 25 ? "moderate" : "mild";

    // Aggregate reasons across the run: identical texts add up, then top 5.
    const byText = new Map<string, number>();
    for (const ms of memberScores) {
      for (const r of ms.reasons) byText.set(r.text, (byText.get(r.text) ?? 0) + r.weight);
    }
    const reasons = [...byText.entries()]
      .map(([text, weight]) => ({ text, weight: Math.round(weight / members.length) }))
      .filter((r) => (polarity === "favourable" ? r.weight > 0 : r.weight < 0))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 5);

    const first = members[0];
    const last = members[members.length - 1];
    const range =
      members.length === 1
        ? first.label
        : `${first.label.split(" ")[0]} → ${last.label.split(" ")[0]} ${last.label.split(" ")[1]}`;

    windows.push({
      label: reasons[0] ? `${range} · ${headClause(reasons[0].text)}` : range,
      start: first.start,
      end: last.end,
      polarity,
      score: mean,
      grade,
      confidence: clamp(Math.round(38 + magnitude / 2 + (hasDasha ? 10 : -12)), 5, 95),
      reasons,
      phase: last.end <= now ? "past" : first.start > now ? "future" : "current",
    });
  };

  for (let i = 0; i < months.length; i++) {
    const p = polarityOf(months[i].score);
    if (p !== runPolarity) {
      flush(i);
      runPolarity = p;
      runStart = i;
    }
  }
  flush(months.length);

  const favourable = windows
    .filter((w) => w.polarity === "favourable")
    .sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());
  const adverse = windows
    .filter((w) => w.polarity === "adverse")
    .sort((a, b) => a.score - b.score || a.start.getTime() - b.start.getTime());

  // --- Summary -------------------------------------------------------------
  const best = favourable[0];
  const worst = adverse[0];
  const mean = months.length
    ? Math.round(months.reduce((s, m) => s + m.score, 0) / months.length)
    : 0;

  /**
   * "December 2026" or "March 2026 → May 2026" — the window as months, never
   * dates. Read back off the month table rather than formatted from the
   * window's bounds: a month block's `end` is *exclusive*, so formatting it
   * directly would name the following month (and, in a timezone east of UTC,
   * the following year).
   */
  const rangeOf = (w: SpeculationWindow): string => {
    const first = months.find((m) => m.start.getTime() === w.start.getTime());
    const last = [...months].reverse().find((m) => m.end.getTime() === w.end.getTime());
    if (!first || !last) return "that stretch";
    return first.label === last.label ? first.label : `${first.label} → ${last.label}`;
  };
  /**
   * Lowercase a leading article or possessive so a reason can be spliced
   * mid-sentence. Planet names lead many of these strings and must keep their
   * capital, so only this closed set is touched.
   */
  const softenLead = (text: string): string =>
    text.replace(/^(Your|A|The) /, (m) => m.toLowerCase());

  const parts: string[] = [];
  parts.push(
    mean >= 10
      ? "Taken as a whole, this window leans supportive for risk capital — more of it helps than hinders."
      : mean <= -10
        ? "Taken as a whole, this window leans defensive: the balance of periods and transits favours holding capital over deploying it."
        : "Taken as a whole, this window is mixed — the average tells you little, and the individual stretches tell you everything."
  );
  if (best) {
    parts.push(
      `The most supported stretch runs across ${rangeOf(best)}, mainly because ${
        best.reasons[0] ? softenLead(headClause(best.reasons[0].text)) : "several supportive factors line up there"
      }.`
    );
  } else {
    parts.push("No stretch in this window clears the bar for a genuinely favourable period, which is itself useful information: this is a year for building the process rather than pressing it.");
  }
  if (worst) {
    parts.push(
      `The stretch to be smallest in runs across ${rangeOf(worst)}${
        worst.reasons[0] ? `, where ${softenLead(headClause(worst.reasons[0].text))}` : ""
      }.`
    );
  }
  if (!hasDasha) {
    parts.push("Without a birth time the period layer is missing entirely, so these scores rest on transits alone and should be read as the sky's weather rather than as your own.");
  }
  if (beforeBirth) {
    parts.push("This window predates the birth date, so no personal period has begun — the transits below are real, the personal reading is not yet running.");
  }
  if (eclipseFailed) {
    parts.push("The eclipse layer could not be computed for this window and has been left out of the scoring rather than estimated.");
  }

  return {
    window: { start, end },
    hasDasha,
    beforeBirth,
    months,
    favourable,
    adverse,
    summary: parts.join(" "),
  };
}
