import { AGE_BANDS, agePriorFor, dateAtAge } from "@/utils/astrology/ageBands";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGN_LORDS } from "@/utils/astrology/constants";
import { findActivationWindows } from "@/utils/astrology/scan";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import { plain, toTimingWindow, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Sources of income.
 *
 * Sources: the Dhana (wealth) house scheme — 2nd (accumulation), 11th
 * (income), 5th/9th (fortune trikonas) — per BPHS's Dhana Yoga chapter;
 * 6th (service income), 8th (inheritance, insurance, others' money),
 * 4th (property/vehicles), 12th (foreign and expenditure) per the standard
 * house significations (BPHS Ch.11 vein, Phaladeepika house chapters);
 * D-2 Hora reading (Sun's hora = self-earned drive, Moon's hora = liquidity
 * and inherited ease) per the Shodasavarga tradition (BPHS Ch.6).
 */

interface StreamDef {
  key: string;
  label: string;
  houses: number[];
  karakas: PlanetId[];
  blurb: string;
}

const STREAMS: StreamDef[] = [
  { key: "salary", label: "Salaried employment", houses: [6, 10], karakas: ["Sa", "Su"], blurb: "a wage, paid regularly, for work someone else organises" },
  { key: "business", label: "Business & self-employment", houses: [7, 3], karakas: ["Me", "Ma"], blurb: "trade, your own practice, partnerships you have a stake in" },
  { key: "passive", label: "Investments & assets", houses: [2, 4, 11], karakas: ["Ju", "Ve"], blurb: "savings that compound, property, vehicles, rent coming in" },
  { key: "speculative", label: "Speculation & windfalls", houses: [5, 8], karakas: ["Ra"], blurb: "markets, sudden gains, money that belongs to other people first" },
  { key: "foreign", label: "Foreign-linked income", houses: [12, 9], karakas: ["Ra", "Ke"], blurb: "postings abroad, exports, remote work for clients in another country" },
];

export interface WealthReport extends SectionReport {
  streams: RankedItem[];
  /** Percentages over the streams above, summing to exactly 100. */
  split: { key: string; label: string; percent: number }[];
  payers: PlanetId[];
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function buildWealthReport(
  chart: ChartData,
  vargas: VargaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  yogas: YogaFinding[]
): WealthReport {
  const lagna = chart.ascendant.sign;
  const caveats: string[] = [];

  // ---- Score each stream by lords + occupants + karakas ---------------------
  const rawScores: { def: StreamDef; score: number; evidence: Evidence[] }[] = STREAMS.map((def) => {
    const evidence: Evidence[] = [];
    let score = 0;
    for (const h of def.houses) {
      const lord = SIGN_LORDS[(lagna + h - 1) % 12];
      const s = strengths[lord];
      if (s) {
        const w = (s.score - 40) / 2; // strength above/below baseline
        score += w;
        evidence.push({
          text: `${PLANET_NAMES[lord]} rules your ${ordinal(h)} house and scores ${s.score}/100 — this channel is as strong as the planet running it`,
          weight: Math.round(w),
        });
      }
      const occupants = chart.planets.filter((p) => p.house === h);
      for (const p of occupants) {
        score += 6;
        evidence.push({
          text: `${PLANET_NAMES[p.id]} sits in your ${ordinal(h)} house, which puts real activity into this channel rather than just potential`,
          weight: 6,
        });
      }
    }
    for (const k of def.karakas) {
      const s = strengths[k];
      if (s && s.score >= 60) {
        score += 5;
        evidence.push({
          text: `${PLANET_NAMES[k]} is a natural giver of this kind of money and it is strong in your chart (${s.score}/100), so the channel has a willing planet behind it`,
          weight: 5,
        });
      }
    }
    return { def, score, evidence };
  });

  // ---- Dhana yogas boost the streams their planets touch --------------------
  const dhanaYogas = yogas.filter((y) => y.key.startsWith("dhana-") || y.key === "lakshmi" || y.key === "chandra-mangala" || y.key.startsWith("vrj-"));
  for (const y of dhanaYogas) {
    // Wealth yogas primarily feed accumulation + income; Vipareeta feeds windfalls.
    const targets = y.key.startsWith("vrj-") ? ["speculative"] : ["passive", "business"];
    for (const t of targets) {
      const row = rawScores.find((r) => r.def.key === t);
      if (row) {
        row.score += 8;
        row.evidence.push({
          text: `${y.name} forms in your chart, and it feeds this channel specifically — a wealth combination is worth more here than any single strong planet`,
          weight: 8,
          source: { work: "BPHS", ref: "Dhana Yoga chapter" },
        });
      }
    }
  }

  // ---- D-2 Hora tally -------------------------------------------------------
  if (vargas) {
    const d2 = vargas.charts.D2;
    let sunHora = 0;
    let moonHora = 0;
    for (const p of d2.positions) {
      if (p.id === "Ra" || p.id === "Ke") continue;
      if (p.sign === 4) sunHora++;
      else moonHora++;
    }
    const horaText =
      sunHora > moonHora
        ? `In your ${plain("Hora")}, ${sunHora} of 7 planets fall on the Sun's side, which marks money as something you earn rather than receive. Effort converts to income more reliably for you than luck does — which is tiring, but it is also dependable.`
        : moonHora > sunHora
          ? `In your ${plain("Hora")}, ${moonHora} of 7 planets fall on the Moon's side, which marks money that arrives through flow rather than force: savings, family support, things that accumulate while you are not watching. Pushing harder is not usually what moves the number for you.`
          : `Your ${plain("Hora")} splits evenly between the Sun's and the Moon's sides — earning and accumulating are equally open to you, and the sensible plan uses both rather than betting on one.`;
    const salaryRow = rawScores.find((r) => r.def.key === (sunHora >= moonHora ? "salary" : "passive"))!;
    salaryRow.score += 4;
    salaryRow.evidence.push({ text: horaText, weight: 4, source: { work: "BPHS", ref: "Ch.6 (Hora varga)" } });
  } else {
    caveats.push(
      "The D-2 Hora chart could not be built here, so the self-earned-versus-accumulated lean is missing from the reading below. The stream ranking itself is unaffected."
    );
  }

  // ---- Normalize into ranked streams + a 100% split -------------------------
  const floor = Math.min(...rawScores.map((r) => r.score));
  const shifted = rawScores.map((r) => ({ ...r, pos: r.score - floor + 5 }));
  const total = shifted.reduce((s, r) => s + r.pos, 0);
  const rawPercents = shifted.map((r) => (r.pos / total) * 100);
  // Round while keeping the sum at exactly 100.
  const floors = rawPercents.map(Math.floor);
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = rawPercents
    .map((p, i) => ({ i, frac: p - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const percents = [...floors];
  for (let k = 0; k < remainder; k++) percents[order[k].i] += 1;

  const maxScore = Math.max(...shifted.map((r) => r.pos));
  const streams: RankedItem[] = shifted
    .map((r, i) => ({
      key: r.def.key,
      label: `${r.def.label} (${r.def.blurb})`,
      score: clamp(Math.round((r.pos / maxScore) * 90 + 5), 5, 95),
      verdict: verdictOf(clamp(Math.round((r.pos / maxScore) * 90 + 5), 5, 95)),
      reasons: r.evidence,
      percent: percents[i],
    }))
    .sort((a, b) => b.percent - a.percent);

  const split = streams.map((s) => ({
    key: s.key,
    label: STREAMS.find((d) => d.key === s.key)!.label,
    percent: (s as RankedItem & { percent: number }).percent,
  }));

  // ---- The planets that "pay" -----------------------------------------------
  const second = SIGN_LORDS[(lagna + 1) % 12];
  const eleventh = SIGN_LORDS[(lagna + 10) % 12];
  const payers = [...new Set<PlanetId>([second, eleventh])];

  const confidence = clamp(
    45 + dhanaYogas.length * 6 + (vargas ? 8 : 0),
    35,
    88
  );

  return {
    key: "wealth",
    title: "Sources of Income",
    headline: `Your money is most likely to come through ${split[0].label.toLowerCase()} — about ${split[0].percent}% of the wealth signal in your chart sits there.`,
    score: streams[0]?.score,
    verdict: streams[0]?.verdict as WealthReport["verdict"],
    confidence,
    blocks: [
      {
        heading: "Where your money is most likely to come from",
        paragraphs: [
          "Each channel below is weighed from the planets that rule and occupy its houses, the planets that naturally stand for that kind of money, any wealth combinations in your chart, and the D-2 chart that splits earning from accumulating.",
          "The percentages describe the balance of promise between channels, not amounts and not a forecast. Read them as where the chart leans: the channel at the top is the one that tends to reward attention, and the ones at the bottom are the ones that cost more than they return for you specifically.",
        ],
        items: streams,
      },
      {
        heading: "The planets that pay you",
        paragraphs: [
          `${payers.map((p) => PLANET_NAMES[p]).join(" and ")} rule your 2nd house of savings and your 11th of income, so money questions in your chart route through ${payers.length === 1 ? "that planet" : "those planets"} whatever else is happening. When ${payers.length === 1 ? "its main period runs" : "their main periods run"}, earning capacity tends to step up or down noticeably — and the condition ${payers.length === 1 ? "it is in" : "they are in"} is the honest ceiling on how much of it stays with you. That is worth knowing in advance, because it makes a lean year legible instead of frightening.`,
        ],
      },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    streams,
    split,
    payers,
  };
}

/**
 * Per-stream activation windows — expensive, computed on demand. Scanned
 * across the accumulation arc (ages 25–65) rather than a rolling 15 years, so
 * the earning years you have already lived are shown alongside the ones ahead.
 * `now` only labels each window past/current/future.
 */
export function wealthTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  streamKey: string,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const def = STREAMS.find((d) => d.key === streamKey);
  if (!def) return [];
  const birth = chart.birthUtc;
  const band = AGE_BANDS.wealth;
  return findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    {
      houses: [...def.houses, 2, 11],
      karakas: def.karakas,
      maxWindows: 4,
      agePriorAt: agePriorFor(birth, band),
      relativeTo: now,
    },
    dateAtAge(birth, band.start), dateAtAge(birth, band.end)
  ).map((w) =>
    toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`, birth)
  );
}
