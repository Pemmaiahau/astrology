import { aspectsOnSign } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import {
  PLANET_DIRECTION,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
  signMobility,
} from "@/utils/astrology/constants";
import { findActivationWindows } from "@/utils/astrology/scan";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { houseInVarga, type VargaSet } from "@/utils/astrology/varga";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import { toTimingWindow, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Foreign travel & settlement.
 *
 * Sources: 12th house as foreign residence, 9th as long journeys, 3rd as
 * short journeys per the standard house significations (BPHS/Phaladeepika
 * house chapters); Rahu as the karaka of foreign lands (consensus of the
 * standard literature); movable-sign emphasis for mobility (classical sign
 * taxonomy, BPHS Ch.4); D-4 (residence/fortune) and D-12 corroboration per
 * Shodasavarga usage. Direction indications use the digpati scheme and are
 * explicitly capped at low-to-moderate confidence — they are the weakest
 * technique in this section.
 */

export interface ForeignReport extends SectionReport {
  scenarios: RankedItem[]; // short travel / long stay / settlement
  purpose: string[];
  direction: string | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function buildForeignReport(
  chart: ChartData,
  vargas: VargaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>
): ForeignReport {
  const lagna = chart.ascendant.sign;
  const caveats: string[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  const evidence: Evidence[] = [];
  let travelScore = 20; // short journeys base
  let stayScore = 10;   // long stays abroad
  let settleScore = 5;  // permanent settlement

  const lagnaLordId = SIGN_LORDS[lagna];
  const lagnaLord = planetOf(lagnaLordId);
  const twelfthSign = (lagna + 11) % 12;
  const twelfthLordId = SIGN_LORDS[twelfthSign];
  const twelfthLord = planetOf(twelfthLordId);
  const rahu = planetOf("Ra");

  // --- 12th house: foreign residence ---
  const twelfthOccupants = chart.planets.filter((p) => p.house === 12);
  for (const p of twelfthOccupants) {
    stayScore += 8;
    settleScore += 6;
    evidence.push({
      text: `${PLANET_NAMES[p.id]} occupies your 12th house of distant lands`,
      weight: 7,
      source: { work: "BPHS", ref: "12th-house significations" },
    });
  }
  if (twelfthLord) {
    const s = strengths[twelfthLordId];
    if (s && s.score >= 55) {
      stayScore += 6;
      evidence.push({ text: `Your 12th lord ${PLANET_NAMES[twelfthLordId]} is strong (${s.score}/100) — the foreign house delivers rather than drains`, weight: 6 });
    }
  }

  // --- Lagna lord in the 12th / 12th lord in the Lagna: the classic swap ---
  if (lagnaLord && lagnaLord.house === 12) {
    stayScore += 12;
    settleScore += 10;
    evidence.push({
      text: `Your Lagna lord ${PLANET_NAMES[lagnaLordId]} sits in the 12th — the classical signature of a life that relocates away from its birthplace`,
      weight: 10,
      source: { work: "Phaladeepika", ref: "Lagna lord in the 12th" },
    });
  }
  if (twelfthLord && twelfthLord.house === 1) {
    stayScore += 8;
    evidence.push({ text: `The 12th lord stands in your Lagna — foreign themes attach to the self`, weight: 7 });
  }

  // --- 9th: long journeys; 3rd: short journeys ---
  const ninthOccupants = chart.planets.filter((p) => p.house === 9);
  if (ninthOccupants.length) {
    travelScore += 6 * ninthOccupants.length;
    evidence.push({ text: `${ninthOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} in your 9th house of long journeys`, weight: 6 });
  }
  const thirdOccupants = chart.planets.filter((p) => p.house === 3);
  if (thirdOccupants.length) {
    travelScore += 4 * thirdOccupants.length;
    evidence.push({ text: `${thirdOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} in your 3rd house of short journeys`, weight: 4 });
  }

  // --- 4th house afflicted: leaving the homeland ---
  {
    const fourthSign = (lagna + 3) % 12;
    const fourthLordId = SIGN_LORDS[fourthSign];
    const fourthLord = planetOf(fourthLordId);
    const maleficsOnFourth = aspectsOnSign(chart, fourthSign).filter((a) => ["Sa", "Ma", "Ra", "Ke"].includes(a));
    if (fourthLord && [6, 8, 12].includes(fourthLord.house)) {
      settleScore += 7;
      evidence.push({
        text: `Your 4th lord (home and homeland) sits in the ${ordinal(fourthLord.house)} — roots loosen, the classical precondition for settling elsewhere`,
        weight: 6,
        source: { work: "Phaladeepika", ref: "4th lord in dusthana" },
      });
    }
    if (maleficsOnFourth.length >= 2) {
      settleScore += 4;
      evidence.push({ text: `${maleficsOnFourth.map((a) => PLANET_NAMES[a]).join(", ")} press on your 4th house — home comfort is something you build abroad as easily as at home`, weight: 3 });
    }
  }

  // --- Rahu links ---
  if (rahu) {
    if ([12, 9, 4, 1, 7].includes(rahu.house)) {
      stayScore += 6;
      settleScore += 5;
      evidence.push({
        text: `Rahu, karaka of foreign lands, occupies your ${ordinal(rahu.house)} house`,
        weight: 6,
        source: { work: "standard literature", ref: "Rahu as videsha karaka" },
      });
    }
    const saturn = planetOf("Sa");
    if (saturn && saturn.sign === rahu.sign) {
      stayScore += 4;
      evidence.push({ text: "Saturn conjoins Rahu — long, structural stints away from the birthplace", weight: 4 });
    }
  }

  // --- Movable-sign emphasis ---
  {
    const movers = [chart.ascendant.sign, ...chart.planets.filter((p) => ["Su", "Mo"].includes(p.id)).map((p) => p.sign)]
      .filter((s) => signMobility(s) === "movable").length;
    if (movers >= 2) {
      travelScore += 6;
      stayScore += 4;
      evidence.push({ text: `${movers} of your Lagna/Sun/Moon fall in movable signs — mobility is native to this chart`, weight: 5, source: { work: "BPHS", ref: "Ch.4 sign taxonomy" } });
    }
  }

  // --- D-4 / D-12 corroboration ---
  if (vargas) {
    const d4 = vargas.charts.D4;
    const d4Twelfth = chart.planets.filter((p) => {
      const pos = d4.positions.find((q) => q.id === p.id);
      return pos && houseInVarga(d4, pos.sign) === 12;
    });
    if (d4Twelfth.length >= 2) {
      settleScore += 4;
      evidence.push({ text: `${d4Twelfth.length} planets fall in the 12th of your D-4 (residence chart) — corroborating relocation`, weight: 3, source: { work: "BPHS", ref: "Ch.6 (Chaturthamsa)" } });
    }
  } else {
    caveats.push("D-4/D-12 corroboration unavailable for this chart.");
  }

  // --- Scenarios ---
  const norm = (x: number) => clamp(Math.round(x), 5, 95);
  const scenarios: RankedItem[] = [
    {
      key: "travel",
      label: "Frequent foreign travel (trips, assignments, pilgrimages)",
      score: norm(travelScore + stayScore * 0.3),
      verdict: verdictOf(norm(travelScore + stayScore * 0.3)),
      reasons: evidence.filter((e) => e.text.includes("journeys") || e.text.includes("movable")),
    },
    {
      key: "stay",
      label: "Long stints abroad (work, study — years at a time)",
      score: norm(stayScore + travelScore * 0.2),
      verdict: verdictOf(norm(stayScore + travelScore * 0.2)),
      reasons: evidence.filter((e) => !e.text.includes("journeys")),
    },
    {
      key: "settle",
      label: "Permanent settlement away from the birthplace",
      score: norm(settleScore + stayScore * 0.4),
      verdict: verdictOf(norm(settleScore + stayScore * 0.4)),
      reasons: evidence.filter((e) => e.text.includes("12th") || e.text.includes("4th") || e.text.includes("roots")),
    },
  ].sort((a, b) => b.score - a.score);

  // --- Purpose ---
  const purpose: string[] = [];
  if (lagnaLord && lagnaLord.house === 12) purpose.push("self-driven relocation (the person, not circumstances, chooses to go)");
  const tenthLinks = chart.planets.filter((p) => p.house === 12 && ownedHouses(p.id, lagna).includes(10)).length;
  if (tenthLinks || (twelfthLord && ownedHouses(twelfthLordId, lagna).includes(10))) purpose.push("work and career postings");
  const ninthLinks = ninthOccupants.length > 0;
  if (ninthLinks) purpose.push("higher education or teaching");
  if (rahu && rahu.house === 7) purpose.push("marriage or business partnership abroad");
  if (!purpose.length) purpose.push("mixed motives — no single house dominates the foreign axis");

  // --- Direction (capped confidence, prominent caveat) ---
  let direction: string | null = null;
  const strongestForeign = [twelfthLord, rahu, ...twelfthOccupants]
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (strengths[b.id]?.score ?? 0) - (strengths[a.id]?.score ?? 0))[0];
  if (strongestForeign && PLANET_DIRECTION[strongestForeign.id]) {
    direction = `${PLANET_DIRECTION[strongestForeign.id]} of your birthplace (from ${PLANET_NAMES[strongestForeign.id]}, your strongest foreign significator). Treat this as indicative only — direction rules are the weakest classical technique here.`;
  }

  const top = scenarios[0];
  const confidence = clamp(35 + evidence.length * 5 + (vargas ? 5 : 0), 25, 75); // capped ≤75 by design

  return {
    key: "foreign",
    title: "Foreign Travel & Settlement",
    headline:
      top.score >= 55
        ? `The chart leans clearly toward: ${top.label.toLowerCase()}.`
        : "Foreign indications are present but moderate — travel yes, but the birthplace keeps its gravity.",
    score: top.score,
    verdict: top.verdict as ForeignReport["verdict"],
    confidence,
    blocks: [
      {
        heading: "Three scenarios, scored",
        paragraphs: [
          "Short travel, long stints and permanent settlement are scored separately — a chart can be strong for one and weak for another. These are tendencies, not certainties.",
        ],
        items: scenarios,
      },
      { heading: "Most likely purpose", paragraphs: [purpose.join("; ") + "."] },
      ...(direction ? [{ heading: "Direction indication", paragraphs: [direction] }] : []),
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    scenarios,
    purpose,
    direction,
  };
}

/** Foreign-travel activation windows — computed on demand. */
export function foreignTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const horizon = new Date(now.getTime() + 15 * 365.25 * 86400000);
  return findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    { houses: [12, 9, 3, 7], karakas: ["Ra", "Sa"], maxWindows: 5 },
    now, horizon
  ).map((w) => toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`));
}
