import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildForeignReport } from "../foreign";
import { houseSubsection } from "./common";
import { lordOf, name, names, nakOf, ord, planet, sentences, SIGNS, type ReadingContext, type ReadingPart, type ReadingSubsection } from "./context";
import { houseState, inSign, judge, planetState, VERDICT_WORD, whoEnd, type Factor } from "./judge";
import { TWELFTH_LORD_IN } from "./lordEffects";
import { topicTiming } from "./timeline";
import { confidenceLine, topicSections } from "./topic";

const MOVABLE = [0, 3, 6, 9];
const FIXED = [1, 4, 7, 10];
const WATERY = [3, 7, 11];

/** The foreign evidence, weighed. Shared by the reading part and the foreign card. */
export function foreignFactors(rc: ReadingContext): Factor[] {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const f: Factor[] = [];
  const l12 = lordOf(rc, 12);
  const l9 = lordOf(rc, 9);
  const ll = SIGN_LORDS[lagna];
  const p12 = planet(rc, l12);
  const p9 = planet(rc, l9);
  const pl = planet(rc, ll);

  // The 12th and 9th as houses: planets there, their strength, SAV.
  for (const h of [12, 9]) {
    for (const x of houseState(rc, h).factors) {
      if (x.short.startsWith("lord in") || x.short === "Vipareeta placement" || x.short.startsWith("strong lord") || x.short.startsWith("weak lord")) continue;
      if (x.short.endsWith(" in it")) f.push({ ...x, w: Math.abs(x.w) * 0.8, text: `${x.text.replace(/\.$/, "")} — activating ${h === 12 ? "foreign residence" : "long-distance travel"}.` });
      else if (x.short.startsWith("SAV") || x.short.startsWith("Bhava")) f.push({ ...x, w: x.w * 0.5 });
    }
  }
  if (p12) {
    const strong = [3, 4, 7, 9, 12, 1, 10].includes(p12.house);
    f.push({ text: `The 12th lord ${name(l12)} sits in the ${ord(p12.house)}: ${TWELFTH_LORD_IN[p12.house - 1]}.`, w: strong ? 1 : 0.2, short: `12th lord in the ${ord(p12.house)}` });
  }
  if (pl && [9, 12, 7].includes(pl.house)) f.push({ text: `The Lagna lord ${name(ll)} sits in the ${ord(pl.house)}, pulling your own direction toward ${pl.house === 12 ? "foreign lands" : pl.house === 9 ? "long journeys and distant places" : "others and other places"}.`, w: pl.house === 12 ? 1.2 : 0.7, short: `Lagna lord in the ${ord(pl.house)}` });
  if (p9 && [12, 3, 7].includes(p9.house)) f.push({ text: `The 9th lord ${name(l9)} sits in the ${ord(p9.house)}, linking fortune with travel.`, w: 0.6, short: `9th lord in the ${ord(p9.house)}` });
  if (pl && p12 && pl.sign === p12.sign && ll !== l12) f.push({ text: `The Lagna lord and the 12th lord sit together — a classical settlement-abroad link.`, w: 1, short: "Lagna & 12th lords joined" });

  // Rahu, the karaka of the foreign.
  const ra = planet(rc, "Ra");
  if (ra) {
    const st = planetState(rc, "Ra");
    if ([3, 7, 9, 10, 12, 1].includes(ra.house)) f.push({ text: `Rahu, the karaka of the foreign, is in the ${ord(ra.house)} (${SIGNS[ra.sign]}, ${nakOf(ra.longitude).name}), a classical foreign placement${st.grade === "strong" ? ", and strong" : ""}.`, w: st.grade === "strong" ? 1.2 : 0.8, short: `Rahu in the ${ord(ra.house)}` });
    else f.push({ text: `Rahu is in the ${ord(ra.house)}, so the pull of the unfamiliar works through that house more than through relocation.`, w: -0.3, short: `Rahu in the ${ord(ra.house)}` });
  }

  // The 4th: leaving home.
  {
    const s4 = (lagna + 3) % 12;
    const mal = inSign(rc, s4).filter((id) => ["Sa", "Ra", "Ke", "Ma", "Su"].includes(id));
    const l4 = planet(rc, lordOf(rc, 4));
    if (mal.length) f.push({ text: `${names(mal)} in the 4th unsettles the home base — a push away from the birthplace.`, w: 0.6, short: "4th disturbed" });
    if (l4 && [12, 8, 6].includes(l4.house)) f.push({ text: `The 4th lord sits in the ${ord(l4.house)}, a classical marker of living away from the birthplace.`, w: 0.8, short: `4th lord in the ${ord(l4.house)}` });
    if (houseState(rc, 4).grade === "strong" && !mal.length) f.push({ text: "A strong, undisturbed 4th keeps you rooted near home.", w: -0.8, short: "strong 4th" });
  }

  // Sign mobility of the Lagna and Moon.
  const mo = planet(rc, "Mo");
  if (MOVABLE.includes(lagna)) f.push({ text: `A movable (chara) Lagna, ${SIGNS[lagna]}, favours movement and change of place.`, w: 0.4, short: "movable Lagna" });
  if (FIXED.includes(lagna)) f.push({ text: `A fixed Lagna, ${SIGNS[lagna]}, prefers staying put.`, w: -0.4, short: "fixed Lagna" });
  if (mo && (WATERY.includes(mo.sign) || mo.house === 12 || mo.house === 9)) f.push({ text: `The Moon ${mo.house === 12 || mo.house === 9 ? `in the ${ord(mo.house)}` : `in a watery sign (${SIGNS[mo.sign]})`} adds a restless pull toward travel across water.`, w: 0.4, short: "Moon placement" });
  if (rc.vargas) {
    const d9 = rc.vargas.charts.D9;
    const raD9 = d9.positions.find((p) => p.id === "Ra");
    if (raD9 && [1, 7, 12, 9].includes(((raD9.sign - d9.ascendant + 12) % 12) + 1)) f.push({ text: `Rahu is in the D9 ${ord(((raD9.sign - d9.ascendant + 12) % 12) + 1)}, repeating the foreign signature in the Navamsa.`, w: 0.5, short: "Rahu in D9" });
  }
  // The calibrated foreign scan (data/interpretations/foreign.ts, tuned on a
  // 400-chart sample): its best scenario's verdict and strongest reasons.
  const report = buildForeignReport(chart, rc.vargas, rc.strengths);
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  const best = [...items].sort((a, b) => b.score - a.score)[0];
  if (best) {
    const W: Record<string, number> = { "Strong promise": 2, Supportive: 1.2, Mixed: 0.3, "Needs effort": -0.6, Challenged: -1.2 };
    const label = best.label.split(" — ")[0].toLowerCase();
    f.push({ text: `The foreign-settlement scan rates "${label}" as ${best.verdict.toLowerCase()}, the best of the three scenarios.`, w: W[best.verdict] ?? 0, short: "foreign scan" });
    const seen = new Set(f.map((x) => x.short));
    for (const r of [...best.reasons].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 3)) {
      const t = r.text.split(/(?<=[.!?])\s/)[0].replace(/\s*\([^)]*\)/g, "").trim();
      if (!seen.has(t)) f.push({ text: t.endsWith(".") ? t : `${t}.`, w: r.weight > 0 ? 0.6 : -0.6, short: t.slice(0, 30) });
    }
  }
  return f;
}

export function foreignPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  // Cut-offs from a 400-chart random sample (≈15% strong, 35% good, 35% mixed, 15% weak); see SOURCES.md.
  const j = judge(foreignFactors(rc), { strong: 7.9, good: 5.2, weak: 2.3 });
  const report = buildForeignReport(chart, rc.vargas, rc.strengths);
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  const purpose = report.blocks.find((b) => b.heading === "What tends to take you there");
  const bestItem = [...items].sort((a, b) => b.score - a.score)[0];
  const bestLabel = bestItem && ["Strong promise", "Supportive", "Mixed"].includes(bestItem.verdict) ? bestItem.label.split(" — ")[0].toLowerCase() : null;
  const blocks: ReadingSubsection[] = [
    {
      heading: "Three lives abroad",
      lead: [],
      bullets: items.map((it) => `${it.label}: ${it.verdict.toLowerCase()}.`),
    },
  ];
  if (purpose) blocks.push({ heading: "What takes you there", lead: [], bullets: purpose.paragraphs.flatMap((p) => sentences(p, 2)).slice(0, 2) });
  const verdictText =
    j.level === "strong"
      ? "A strong foreign signature: long stays or settlement abroad are clearly indicated."
      : j.level === "good"
        ? "A real foreign link: travel and periods abroad are likely, and settlement is possible if the timing supports it."
        : j.level === "mixed"
          ? `Foreign links are real but conditional${bestLabel ? `: the likeliest form is ${bestLabel}` : ""}. It comes with effort rather than easily, and timing decides it.`
          : `The foreign signature is lighter than in most charts${bestLabel ? `; if it happens, the likeliest form is ${bestLabel}` : ""}. Foreign links come mostly through work or contacts, in the right periods, rather than as a defining theme.`;

  const timing = withTiming
    ? topicTiming(rc, {
        anchor: 12,
        houses: [9, 3, 7],
        karakas: [{ id: "Ra", label: "the karaka of the foreign" }],
        varga: { id: "D9", houses: [12, 9] },
        active: "foreign links: travel, a posting, study abroad or relocation",
        pressure: "travel with strain, visa or paperwork delays, or plans that stall",
        transitSigns: [{ sign: (lagna + 11) % 12, label: "the 12th" }, { sign: (lagna + 8) % 12, label: "the 9th" }],
        fromAge: 18,
      })
    : null;

  const subsections = topicSections({
    j,
    blocks,
    verdict: verdictText,
    confidence: confidenceLine(j.confidence, "the strength of the foreign link"),
    timing,
  });

  const detail: ReadingSubsection[] = [
    houseSubsection(rc, 12, `The 12th house (foreign lands): ${SIGNS[(lagna + 11) % 12]}`),
    houseSubsection(rc, 9, `The 9th house (long journeys): ${SIGNS[(lagna + 8) % 12]}`),
  ];
  for (const id of [lordOf(rc, 12), "Ra"] as PlanetId[]) {
    const st = planetState(rc, id);
    detail.push({
      heading: `${whoEnd(rc, id)}: condition ${st.grade}`,
      lead: [],
      bullets: [...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []), ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : [])],
    });
  }
  detail.push({ heading: "Scored scenarios", lead: [report.headline], bullets: items.map((it) => `${it.label}: ${it.verdict.toLowerCase()}.`) });

  return {
    key: "foreign",
    number: 5,
    title: "Foreign travel and settlement",
    subsections,
    detail,
    verdict: { word: VERDICT_WORD[j.level], confidence: j.confidence },
    summary: [verdictText],
  };
}
