import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildWealthReport } from "../wealth";
import { houseSubsection } from "./common";
import {
  DIGNITY_WORD, joinAnd, lordOf, name, names, ord, planet, sav, sentences, SIGNS, vargaPos,
  type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import {
  aspectingSign, houseOfSign, houseState, inSign, judge, KENDRA, planetState, VERDICT_WORD, whoEnd, type Factor,
} from "./judge";
import { ELEVENTH_LORD_IN, SECOND_LORD_IN } from "./lordEffects";
import { saturnCycles, topicTiming } from "./timeline";
import { confidenceLine, topicSections } from "./topic";

const WEALTH_YOGA = (key: string, name = "") =>
  key.startsWith("dhana-") || key === "lakshmi" || key === "chandra-mangala" || key.startsWith("vrj-") ||
  (key.startsWith("parivartana") && !/Dainya/i.test(name)) || key === "vasumati" || key === "gajakesari";

/** What a malefic's aspect or presence does to the 2nd house of savings. */
const ON_SECOND: Partial<Record<PlanetId, string>> = {
  Sa: "accumulation is slow and family expenses are significant",
  Ma: "money is fought for and spent quickly",
  Ra: "money comes through unconventional channels and can leak",
  Ke: "savings come and go without gripping",
  Su: "money goes on status, government dues or the father's family",
};

const isBen = (id: PlanetId) => id === "Ju" || id === "Ve" || id === "Me" || id === "Mo";

/** The wealth evidence, weighed. Shared by the reading part and the wealth card. */
export function wealthFactors(rc: ReadingContext): Factor[] {
  const { chart } = rc;
  const f: Factor[] = [];
  const l2 = lordOf(rc, 2);
  const l11 = lordOf(rc, 11);
  const p2 = planet(rc, l2);
  const p11 = planet(rc, l11);

  // The 11th: income.
  for (const x of houseState(rc, 11).factors) {
    if (x.short.startsWith("lord in") || x.short === "Vipareeta placement") continue;
    f.push(x);
  }
  if (p11) {
    const good = [1, 2, 4, 5, 7, 9, 10, 11].includes(p11.house);
    f.push({ text: `The 11th lord ${name(l11)} sits in the ${ord(p11.house)}: ${ELEVENTH_LORD_IN[p11.house - 1]}.`, w: good ? 0.6 : -0.6, short: `11th lord in the ${ord(p11.house)}` });
  }
  // The 2nd: savings — malefic influences glossed in money terms.
  for (const x of houseState(rc, 2).factors) {
    if (x.short.startsWith("lord in") || x.short === "Vipareeta placement") continue;
    const id = (["Sa", "Ma", "Ra", "Ke", "Su"] as PlanetId[]).find((k) => x.short === `${name(k)}'s aspect` || x.short === `${name(k)} in it`);
    f.push(id && x.w < 0 && ON_SECOND[id] ? { ...x, text: `${x.text.replace(/\.$/, "")}, so ${ON_SECOND[id]}.` } : x);
  }
  if (p2) {
    const good = [1, 2, 4, 5, 7, 9, 10, 11].includes(p2.house);
    f.push({ text: `The 2nd lord ${name(l2)} sits in the ${ord(p2.house)}: ${SECOND_LORD_IN[p2.house - 1]}.`, w: good ? 0.6 : -0.8, short: `2nd lord in the ${ord(p2.house)}` });
  }

  // Income against expenses.
  const s11 = sav(rc, 11);
  const s12 = sav(rc, 12);
  if (s11 !== null && s12 !== null) {
    if (s11 >= s12 + 4) f.push({ text: `The 11th SAV (${s11}) is well above the 12th (${s12}), so income tends to exceed expenses and you are a natural saver.`, w: 1, short: "11th SAV > 12th" });
    else if (s12 >= s11 + 4) f.push({ text: `The 12th SAV (${s12}) is above the 11th (${s11}), so expenses tend to outrun income unless budgeted.`, w: -1, short: "12th SAV > 11th" });
  }

  // Arudha Lagna and the 11th/12th from it.
  if (rc.jaimini) {
    const al = rc.jaimini.arudhaLagna;
    const alH = houseOfSign(rc, al);
    if (alH === 11 || alH === 2) f.push({ text: `The Arudha Lagna falls in the ${ord(alH)}, so you are seen as someone who ${alH === 11 ? "earns and gains" : "holds wealth"}, and that perception brings opportunities.`, w: 0.6, short: `AL in the ${ord(alH)}` });
    const g = inSign(rc, (al + 10) % 12);
    const l = inSign(rc, (al + 11) % 12);
    if (g.length) f.push({ text: `${names(g)} ${g.length > 1 ? "occupy" : "occupies"} the 11th from the Arudha Lagna — visible, steady gains.`, w: 0.6, short: "11th from AL occupied" });
    if (l.length && !g.length) f.push({ text: `${names(l)} ${l.length > 1 ? "occupy" : "occupies"} the 12th from the Arudha Lagna — visible spending that others notice.`, w: -0.5, short: "12th from AL occupied" });
  }

  // Jupiter, the wealth karaka.
  {
    const st = planetState(rc, "Ju");
    if (st.grade === "strong") f.push({ text: `Jupiter, the karaka of wealth, is strong: ${st.plus.slice(0, 2).join(", ")}.`, w: 0.8, short: "Jupiter strong" });
    else if (st.grade === "weak") f.push({ text: `Jupiter, the karaka of wealth, is weak: ${st.minus.slice(0, 2).join(", ")}.`, w: -0.8, short: "Jupiter weak" });
  }

  // The Hora (D2).
  if (rc.vargas) {
    const d2 = rc.vargas.charts.D2;
    const good = d2.positions.filter((p) => ["exalted", "moolatrikona", "own"].includes(p.dignity) && p.id !== "Ra" && p.id !== "Ke");
    const bad = d2.positions.filter((p) => p.dignity === "debilitated" && p.id !== "Ra" && p.id !== "Ke");
    const where = (p: { sign: number }) => (p.sign === d2.ascendant ? "the D2 Lagna" : "the D2 2nd");
    if (good.length >= 2) f.push({ text: `D2 is ${good.length >= 3 ? "excellent" : "good"}: ${joinAnd(good.map((p) => `${name(p.id)} is ${DIGNITY_WORD[p.dignity]} in ${where(p)}`))}.`, w: good.length >= 3 ? 1.2 : 0.7, short: "strong D2" });
    if (bad.length) f.push({ text: `In D2, ${names(bad.map((p) => p.id))} ${bad.length > 1 ? "are" : "is"} debilitated, so ${bad.length > 1 ? "their" : "its"} periods strain finances.`, w: -0.5, short: "D2 debilitation" });
  }

  // Hora Lagna and Indu Lagna.
  if (rc.special) {
    const hl = rc.special.points.find((p) => p.key === "hora-lagna");
    if (hl) {
      const occ = inSign(rc, hl.sign);
      const lord = SIGN_LORDS[hl.sign];
      const st = planetState(rc, lord);
      const good = occ.some((id) => isBen(id) || planetState(rc, id).grade === "strong") || st.grade === "strong";
      f.push({
        text: `The Hora Lagna is in ${SIGNS[hl.sign]} (your ${ord(hl.house)})${occ.length ? ` with ${names(occ)}` : ""}; its lord ${name(lord)} is ${st.grade}.`,
        w: good ? 0.7 : st.grade === "weak" ? -0.5 : 0,
        short: "Hora Lagna",
      });
    }
    const indu = rc.special.induLagna;
    const lord = SIGN_LORDS[indu.sign];
    const occ = inSign(rc, indu.sign);
    const st = planetState(rc, lord);
    const md = rc.dashaTree?.find((m) => m.lord === lord && m.end > rc.now);
    f.push({
      text: `The Indu Lagna is in ${SIGNS[indu.sign]} (your ${ord(indu.house)})${occ.length ? ` with ${names(occ)}` : ""}, whose lord is ${name(lord)}${md ? `, so wealth matures in the ${name(lord)} Mahadasha (${md.start.getUTCFullYear()}–${md.end.getUTCFullYear()})` : ""}.`,
      w: st.grade === "weak" ? -0.3 : 0.7,
      short: "Indu Lagna",
    });
  }

  // Wealth yogas and Daridra.
  {
    // One bullet for all wealth yogas; each adds weight by the strength of its planets.
    const seen = new Set<string>();
    const ys = [...rc.yogas, ...rc.extended].filter((x) => WEALTH_YOGA(x.key, x.name) && (seen.has(x.name) ? false : (seen.add(x.name), true))).slice(0, 4);
    if (ys.length) {
      let w = 0;
      const parts = ys.map((y) => {
        const weak = y.planets.filter((id) => planetState(rc, id).grade === "weak");
        w += weak.length ? 0.4 : 0.7;
        return `${y.name}${y.planets.length ? ` (${names(y.planets)}${weak.length ? `; ${names(weak)} weak` : ""})` : ""}`;
      });
      f.push({ text: `${ys.length > 1 ? "Wealth yogas present" : "A wealth yoga is present"}: ${joinAnd(parts)}.`, w: Math.min(2, w), short: ys.length > 1 ? "wealth yogas" : ys[0].name.replace(/ \(.*\)$/, "") });
    }
    // Dainya Parivartana: an exchange with a dusthana lord — gains through upheaval.
    const dainya = rc.yogas.find((y) => y.key.startsWith("parivartana") && /Dainya/i.test(y.name));
    if (dainya) f.push({ text: `${dainya.name} (${names(dainya.planets)}) ties a dusthana into the exchange, so some gains come through upheaval or others' crises.`, w: -0.4, short: "Dainya Parivartana" });
    const dar = rc.yogas.find((y) => y.key === "daridra");
    if (dar) f.push({ text: `${dar.name}: ${sentences(dar.description, 1)[0]}`, w: -1, short: "Daridra Yoga" });
  }

  // Speculation: the 5th.
  {
    const s5 = (chart.ascendant.sign + 4) % 12;
    const mal = (id: PlanetId) => ["Sa", "Ma", "Ra", "Ke"].includes(id);
    const inIt = inSign(rc, s5).filter(mal);
    const asp = aspectingSign(rc, s5).filter(mal);
    const occMe = inSign(rc, s5).includes("Me") && inIt.length ? ["Me" as PlanetId] : [];
    if (inIt.length + asp.length >= 2) {
      f.push({ text: `The 5th is afflicted by ${names([...inIt, ...occMe])}${asp.length ? `, plus ${names(asp)}'s aspect` : ""}, so speculation and trading tend to lose.`, w: -1, short: "5th afflicted" });
    }
  }

  // The Avayogi and the 8th.
  if (rc.special) {
    const av = rc.special.yogi.avayogi;
    const p = planet(rc, av);
    if (p && ([2, 5, 11].includes(p.house) || av === l2 || av === l11)) f.push({ text: `${name(av)} as Avayogi points to risk from "too good to be true" schemes.`, w: -0.5, short: `${name(av)} Avayogi` });
  }
  for (const id of inSign(rc, (chart.ascendant.sign + 7) % 12).filter((x) => ["Ma", "Sa", "Ra", "Ke", "Su"].includes(x))) {
    f.push({ text: `${name(id)} in the 8th brings sudden expenses as well as sudden gains.`, w: -0.4, short: `${name(id)} in the 8th` });
  }
  return f;
}

function propertyBlock(rc: ReadingContext): ReadingSubsection {
  const lines: string[] = [];
  let net = 0;
  const s4 = sav(rc, 4);
  if (s4 !== null) { lines.push(`The 4th SAV is ${s4}`); net += s4 >= 30 ? 1 : s4 < 25 ? -1 : 0; }
  const l4 = lordOf(rc, 4);
  const st4 = planetState(rc, l4);
  lines.push(`the 4th lord ${name(l4)} is ${st4.grade}`);
  net += st4.grade === "strong" ? 1 : st4.grade === "weak" ? -1 : 0;
  const ve = planet(rc, "Ve");
  const sv = planetState(rc, "Ve");
  if (ve) { lines.push(`Venus is ${sv.grade}${KENDRA.includes(ve.house) ? " in a kendra" : ""}`); net += sv.grade === "strong" ? 0.7 : 0; net += KENDRA.includes(ve.house) ? 0.4 : 0; }
  const sm = planetState(rc, "Ma");
  lines.push(`Mars, the property karaka, is ${sm.grade}`);
  net += sm.grade === "strong" ? 0.7 : sm.grade === "weak" ? -0.7 : 0;
  const d4: string[] = [];
  if (rc.vargas) {
    const c = rc.vargas.charts.D4;
    for (const p of c.positions) {
      const h = ((p.sign - c.ascendant + 12) % 12) + 1;
      if ((h === 1 || h === 4) && ["exalted", "moolatrikona", "own"].includes(p.dignity) && p.id !== "Ra" && p.id !== "Ke") { d4.push(`${name(p.id)} is ${DIGNITY_WORD[p.dignity]} in the D4 ${h === 1 ? "Lagna" : "4th"}`); net += 0.6; }
      if ((h === 1 || h === 4) && p.dignity === "debilitated") { d4.push(`${name(p.id)} is debilitated in the D4 ${h === 1 ? "Lagna" : "4th"}`); net -= 0.6; }
    }
  }
  const word = net >= 2 ? "Strong" : net >= 0.5 ? "Good" : net > -1 ? "Moderate" : "Needs care";
  const veh: string[] = [];
  if (rc.vargas) {
    const c = rc.vargas.charts.D16;
    for (const p of c.positions) {
      const h = ((p.sign - c.ascendant + 12) % 12) + 1;
      if (p.id === "Ra" || p.id === "Ke") continue;
      if (p.dignity === "exalted" || p.dignity === "own" || p.dignity === "moolatrikona") veh.push(`${name(p.id)} is ${DIGNITY_WORD[p.dignity]} in the D16 ${h === 1 ? "Lagna" : ord(h)}`);
      if (p.dignity === "debilitated") veh.push(`${name(p.id)} is debilitated in the D16 ${ord(h)}${h === 4 ? ", which means occasional dissatisfaction with comforts, not a lack of them" : ""}`);
    }
  }
  const vehWord = sv.grade !== "weak" && st4.grade !== "weak" ? "Good" : "Moderate";
  return {
    heading: "Property and vehicles",
    lead: [`Property: ${word}. ${capFirst(joinAnd(lines))}${d4.length ? `. In D4, ${joinAnd(d4)}` : ""}.`],
    bullets: [`Vehicles: ${vehWord}. Venus is ${sv.grade} and the 4th lord is ${st4.grade}${veh.length ? `; in D16, ${joinAnd(veh)}` : ""}.`],
  };
}

const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function wealthPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  // Cut-offs from a 400-chart random sample (≈15% strong, 35% good, 35% mixed, 15% weak); see SOURCES.md.
  const j = judge(wealthFactors(rc), { strong: 9.5, good: 5, weak: 1.4 });
  const report = buildWealthReport(chart, rc.vargas, rc.strengths, rc.yogas, { extended: rc.extended, special: rc.special });
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  const opp = j.oppose.map((x) => x.short);
  const streams: string[] = [];
  if (houseState(rc, 10).grade === "strong") streams.push("career income");
  if (/^Property: (Strong|Good)/.test(propertyBlock(rc).lead[0])) streams.push("property");
  for (const it of items) {
    if (streams.length >= 3) break;
    if (it.key === "speculative" && opp.includes("5th afflicted")) continue;
    const label = it.label.split(" (")[0].toLowerCase();
    if (it.key === "salary" && streams.includes("career income")) continue;
    if (it.key === "passive" && streams.includes("property")) continue;
    streams.push(label);
  }
  const losses: string[] = [];
  if (opp.includes("5th afflicted")) losses.push("speculation");
  if (opp.some((s) => s.startsWith("2nd lord in the 6th"))) losses.push("lending and standing guarantee for others");
  if (opp.some((s) => s.endsWith("Avayogi"))) losses.push("trusting the wrong people");
  if (opp.some((s) => s.endsWith("in the 8th"))) losses.push("sudden expenses");
  if (opp.includes("12th SAV > 11th")) losses.push("habitual overspending");
  const level = j.level === "strong" ? "Strong wealth" : j.level === "good" ? "Above-average wealth" : j.level === "mixed" ? "Moderate wealth that tracks effort" : "Wealth builds slowly and needs discipline";
  const verdictText = `${level}${streams.length ? `, built mainly through ${joinAnd(streams)}` : ""}.${losses.length ? ` Losses come from ${joinAnd(losses)}.` : ""}`;

  const timing = withTiming
    ? topicTiming(rc, {
        anchor: 11,
        houses: [2, 9],
        karakas: [{ id: "Ju", label: "the wealth karaka" }],
        active: "gains: income growth, savings and a good year for money",
        pressure: "expenses: taxes, dues, or money tied up in disputes",
        transitSigns: [
          { sign: (lagna + 1) % 12, label: "the 2nd" },
          { sign: (lagna + 10) % 12, label: "the 11th" },
        ],
        jupiterOver: [
          { sign: (lagna + 1) % 12, label: "the 2nd from the Lagna" },
          { sign: (lagna + 10) % 12, label: "the 11th from the Lagna" },
        ],
        fromAge: 20,
      })
    : null;
  const extra = withTiming ? saturnCycles(rc).filter((s) => s.startsWith("Kantaka")) : [];

  const subsections = topicSections({
    j,
    blocks: [propertyBlock(rc)],
    verdict: verdictText,
    confidence: confidenceLine(j.confidence, "the overall level of wealth"),
    timing,
    timingExtra: [...extra, "Investment style: these are astrological indications, not financial advice."],
  });

  const detail: ReadingSubsection[] = [
    houseSubsection(rc, 2, `The 2nd house (wealth you keep): ${SIGNS[(lagna + 1) % 12]}`),
    houseSubsection(rc, 11, `The 11th house (income and gains): ${SIGNS[(lagna + 10) % 12]}`),
  ];
  for (const h of [2, 11]) {
    const l = lordOf(rc, h);
    const st = planetState(rc, l);
    detail.push({
      heading: `The ${ord(h)} lord: ${whoEnd(rc, l)}`,
      lead: [`Condition: ${st.grade}.`],
      bullets: [...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []), ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : [])],
    });
  }
  if (rc.vargas) {
    const d2 = rc.vargas.charts.D2.positions.filter((p) => p.id !== "Ra" && p.id !== "Ke");
    const sun = d2.filter((p) => p.sign === 4).map((p) => p.id);
    const moon = d2.filter((p) => p.sign !== 4).map((p) => p.id);
    detail.push({
      heading: `Hora (D2): ${sun.length} of 7 planets in the Sun's hora`,
      lead: [`Sun's hora (Leo): ${names(sun) || "none"}. Moon's hora (Cancer): ${names(moon) || "none"}.`],
      bullets: [
        sun.length > moon.length
          ? "Money is something you earn: effort and visible work convert to income more reliably than luck or inheritance."
          : sun.length < moon.length
            ? "Money accumulates: savings, family resources, property and steady compounding suit you better than aggressive earning."
            : "Earning and accumulating are balanced — both effort and patience pay.",
        ...rc.vargas.charts.D2.positions.map((p) => `${name(p.id)} in ${SIGNS[p.sign]}, ${DIGNITY_WORD[p.dignity]}.`),
      ],
    });
  }
  detail.push({
    heading: "Where money comes from",
    lead: [report.headline],
    bullets: items.slice(0, 3).map((it, i) => `${i + 1}. ${it.label.split(" (")[0]} — ${it.verdict.toLowerCase()} for your chart.`),
  });
  const ys = [...rc.yogas, ...rc.extended].filter((y) => WEALTH_YOGA(y.key) || y.key === "daridra");  // detail: all exchanges listed
  if (ys.length) detail.push({ heading: "Wealth yogas", lead: [], bullets: ys.map((y) => `${y.name}${y.planets.length ? ` (${names(y.planets)})` : ""}: ${sentences(y.description, 1)[0]}`) });
  const ju = vargaPos(rc, "Ju", "D2");
  if (ju) detail.push({ heading: "Jupiter in D2", lead: [`Jupiter is ${DIGNITY_WORD[ju.dignity]} in D2 (${SIGNS[ju.sign]}).`], bullets: [] });

  return {
    key: "wealth",
    number: 3,
    title: "Wealth",
    subsections,
    detail,
    verdict: { word: VERDICT_WORD[j.level], confidence: j.confidence },
    summary: [verdictText],
  };
}
