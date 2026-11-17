import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildCautionsReport } from "../cautions";
import { briefOfCautions } from "../brief";
import { marakaPlanets } from "../lordships";
import { houseSubsection } from "./common";
import { joinAnd, lordOf, name, names, ord, planet, PLANETS, SIGNS, type ReadingContext, type ReadingPart, type ReadingSubsection } from "./context";
import { houseState, inSign, judge, planetState, VERDICT_WORD, whoEnd, type Factor } from "./judge";
import { LAGNA_LORD_HEALTH } from "./lordEffects";
import { LAGNA_PHYSIQUE, PLANET_BODY } from "./tables";
import { saturnCycles, topicTiming } from "./timeline";
import { confidenceLine, topicSections } from "./topic";

/** The health evidence, weighed: resilience in Supporting, vulnerabilities in Opposing. */
export function healthFactors(rc: ReadingContext): Factor[] {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const f: Factor[] = [];
  for (const x of houseState(rc, 1).factors) {
    if (x.short.startsWith("lord in") || x.short === "Vipareeta placement") continue;
    f.push(x);
  }
  const ll = SIGN_LORDS[lagna];
  const pl = planet(rc, ll);
  if (pl) f.push({ text: `The Lagna lord ${name(ll)} sits in the ${ord(pl.house)}: ${LAGNA_LORD_HEALTH[pl.house - 1]}.`, w: [6, 8, 12].includes(pl.house) ? -0.8 : 0.5, short: `Lagna lord in the ${ord(pl.house)}` });
  for (const [id, label] of [["Su", "vitality"], ["Mo", "the mind and sleep"]] as [PlanetId, string][]) {
    if (id === ll) continue;
    const st = planetState(rc, id);
    if (st.grade === "strong") f.push({ text: `${id === "Su" ? "The Sun" : "The Moon"}, the karaka of ${label}, is strong: ${st.plus.slice(0, 2).join(", ")}.`, w: 0.8, short: `${name(id)} strong` });
    else if (st.grade === "weak") f.push({ text: `${id === "Su" ? "The Sun" : "The Moon"}, the karaka of ${label}, is weak (${st.minus.slice(0, 2).join(", ")}): watch ${PLANET_BODY[id]}.`, w: -0.8, short: `${name(id)} weak` });
  }
  const p6 = planet(rc, lordOf(rc, 6));
  if (p6) {
    if (p6.house === 1) f.push({ text: `The 6th lord sits in the Lagna, so illness touches the body directly and needs prompt care.`, w: -1, short: "6th lord in the 1st" });
    else if ([8, 12].includes(p6.house)) f.push({ text: `The 6th lord sits in the ${ord(p6.house)} (Vipareeta): disease tends to be overcome.`, w: 0.6, short: "6th lord in a dusthana" });
    else if (p6.house === 6) f.push({ text: `The 6th lord guards its own house: strong resistance to illness and rivals.`, w: 0.6, short: "6th lord in the 6th" });
  }
  const p8 = planet(rc, lordOf(rc, 8));
  if (p8 && p8.house === 1) f.push({ text: "The 8th lord sits in the Lagna: chronic or hidden conditions need early diagnosis.", w: -0.8, short: "8th lord in the 1st" });
  if (p8 && [6, 12].includes(p8.house)) f.push({ text: `The 8th lord sits in the ${ord(p8.house)} (Vipareeta): longevity is protected.`, w: 0.5, short: "8th lord in a dusthana" });
  for (const id of inSign(rc, (lagna + 7) % 12).filter((x) => ["Sa", "Ma", "Ra", "Ke", "Su"].includes(x))) {
    f.push({ text: `${name(id)} in the 8th: watch ${PLANET_BODY[id]}; problems can come suddenly.`, w: -0.5, short: `${name(id)} in the 8th` });
  }
  for (const d of rc.extended.filter((x) => x.kind === "dosha" && !x.key.startsWith("gandanta")).slice(0, 2)) {
    f.push({ text: `${d.name} is present.`, w: -0.4, short: d.name });
  }
  return f;
}

function bodyBlock(rc: ReadingContext): ReadingSubsection {
  const lagna = rc.chart.ascendant.sign;
  const lines: string[] = [];
  lines.push(`From the Lagna (${SIGNS[lagna]}): ${LAGNA_PHYSIQUE[lagna].split(";")[1]?.trim() ?? ""}.`);
  const s6 = (lagna + 5) % 12;
  lines.push(`From the 6th (${SIGNS[s6]}, the house of illness): ${LAGNA_PHYSIQUE[s6].split(";")[1]?.trim() ?? ""}.`);
  const weak = PLANETS.filter((id) => planetState(rc, id).grade === "weak");
  if (weak.length) lines.push(`Weak planets: ${weak.map((id) => `${name(id)} (${PLANET_BODY[id]})`).join("; ")}.`);
  const in68 = rc.chart.planets.filter((p) => p.house === 6 || p.house === 8).map((p) => p.id);
  if (in68.length) lines.push(`Planets in the 6th and 8th: ${in68.map((id) => `${name(id)} (${PLANET_BODY[id]})`).join("; ")}.`);
  return { heading: "Body areas to watch", lead: [], bullets: lines };
}

export function healthPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  // Cut-offs from a 400-chart random sample (≈15% strong, 35% good, 35% mixed, 15% weak); see SOURCES.md.
  const j = judge(healthFactors(rc), { strong: 2.9, good: -0.1, weak: -2.8 });
  const verdictText =
    j.level === "strong"
      ? "A robust constitution that recovers quickly; health is an asset to protect, not a worry."
      : j.level === "good"
        ? "Sound health overall, with a few sensitive areas that respond well to routine and early care."
        : j.level === "mixed"
          ? "Health is reasonable but uneven: the sensitive areas below need regular attention, and stress shows in the body."
          : "Health needs deliberate care — routine, sleep, check-ups and early treatment make the real difference.";
  const mk = marakaPlanets(chart);
  const timing = withTiming
    ? topicTiming(rc, {
        anchor: 6,
        houses: [8, 1],
        karakas: [],
        active: "a health-attention phase: routine check-ups and timely treatment",
        pressure: "a health-sensitive phase: get symptoms checked early and protect sleep",
        transitSigns: [{ sign: lagna, label: "the Lagna" }],
        fromAge: 18,
      })
    : null;
  const extra = withTiming ? saturnCycles(rc) : [];
  if (mk.primary.length) extra.push(`The maraka (health-watch) planets are ${names(mk.primary)}; their sub-periods call for prevention, not alarm.`);

  const cautions = buildCautionsReport(chart, rc.strengths, rc.shadbala, rc.yogas, rc.dashaTree, rc.now, { extended: rc.extended, special: rc.special });
  const helps: ReadingSubsection = {
    heading: "What to watch, and what helps",
    lead: [],
    bullets: briefOfCautions(cautions.cautions).slice(0, 3).map((c) => `${c.text} What helps: ${c.remedy}`),
  };

  const subsections = topicSections({
    j,
    blocks: [bodyBlock(rc)],
    verdict: verdictText,
    confidence: confidenceLine(j.confidence, "the overall health picture"),
    timing,
    timingExtra: extra,
  });

  const detail: ReadingSubsection[] = [
    houseSubsection(rc, 1, `The 1st house (body and vitality): ${SIGNS[lagna]}`),
    houseSubsection(rc, 6, `The 6th house (illness and recovery): ${SIGNS[(lagna + 5) % 12]}`),
    houseSubsection(rc, 8, `The 8th house (chronic matters and longevity): ${SIGNS[(lagna + 7) % 12]}`),
  ];
  for (const id of [SIGN_LORDS[lagna], "Su", "Mo"] as PlanetId[]) {
    if (detail.some((d) => d.heading.startsWith(`${name(id)},`) || d.heading.startsWith(`${name(id)}:`))) continue;
    const st = planetState(rc, id);
    detail.push({
      heading: `${whoEnd(rc, id)}: condition ${st.grade}`,
      lead: [],
      bullets: [...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []), ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : [])],
    });
  }
  detail.push(helps);
  if (mk.secondary.length) detail.push({ heading: "Secondary marakas", lead: [], bullets: mk.secondary.map((s) => `${name(s.id)}: ${joinAnd(s.reasons)}.`) });

  return {
    key: "health",
    number: 6,
    title: "Health and things to watch",
    subsections,
    detail,
    verdict: { word: VERDICT_WORD[j.level], confidence: j.confidence },
    summary: [verdictText, cautions.headline],
  };
}
