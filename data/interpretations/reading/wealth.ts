import { aspectedSigns } from "@/utils/astrology/aspects";
import { buildWealthReport, wealthTimingWindows } from "../wealth";
import { compactPoint } from "../brief";
import { houseSubsection, windowBullets } from "./common";
import { fmtRatio, joinAnd, lordOf, name, names, ord, ratio, sentences, SIGNS, type ReadingContext, type ReadingPart, type ReadingSubsection } from "./context";

const WEALTH_YOGA = (key: string) =>
  key.startsWith("dhana-") || key === "lakshmi" || key === "chandra-mangala" || key.startsWith("vrj-") ||
  key === "daridra" || key.startsWith("parivartana") || key.startsWith("shubha-kartari") || key === "vesi" || key === "vasi" || key === "ubhayachari";

export function wealthPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const subsections: ReadingSubsection[] = [
    houseSubsection(rc, 2, `The 2nd house (wealth you keep): ${SIGNS[(lagna + 1) % 12]}`),
    houseSubsection(rc, 11, `The 11th house (income and gains): ${SIGNS[(lagna + 10) % 12]}`),
  ];

  // Wealth yogas and the Indu Lagna.
  {
    const bullets = [...rc.yogas, ...rc.extended]
      .filter((y) => WEALTH_YOGA(y.key))
      .map((y) => `${y.name}${y.planets.length ? ` (${names(y.planets)})` : ""}: ${sentences(y.description, 1)[0]}`);
    const indu = rc.special?.induLagna;
    if (indu) {
      const sign = indu.sign;
      const touch = chart.planets
        .filter((p) => p.sign === sign || (p.sign !== sign && aspectedSigns(p.id, p.sign).includes(sign)))
        .map((p) => p.id);
      const ben = touch.filter((id) => ["Ju", "Ve", "Me", "Mo"].includes(id));
      bullets.push(
        `Your Indu Lagna, the classical wealth point, is ${SIGNS[sign]} in the ${ord(indu.house)}${touch.length ? `, touched by ${names(touch)}` : ""}. ${ben.length ? "Benefic contact here supports steady accumulation." : touch.length ? "Only malefics touch it, so savings build slowly and need protecting." : "Nothing touches it, so accumulation rests on the 2nd and 11th lords."}`
      );
    }
    subsections.push({ heading: "Wealth yogas and the Indu Lagna", lead: [], bullets: bullets.length ? bullets : ["No classical wealth yoga forms; income tracks effort and the strength of the 2nd and 11th lords."] });
  }

  // The D-2 Hora.
  if (rc.vargas) {
    const d2 = rc.vargas.charts.D2.positions.filter((p) => p.id !== "Ra" && p.id !== "Ke");
    const sun = d2.filter((p) => p.sign === 4).map((p) => p.id);
    const moon = d2.filter((p) => p.sign !== 4).map((p) => p.id);
    subsections.push({
      heading: `Hora (D2): ${sun.length} of 7 planets in the Sun's hora`,
      lead: [`Sun's hora (Leo): ${names(sun) || "none"}. Moon's hora (Cancer): ${names(moon) || "none"}.`],
      bullets: [
        sun.length > moon.length
          ? "Money is something you earn: effort, initiative and visible work convert to income more reliably than luck or inheritance."
          : sun.length < moon.length
            ? "Money accumulates: savings, family resources, property and steady compounding suit you better than aggressive earning."
            : "Earning and accumulating are balanced — both effort and patience pay.",
      ],
    });
  }

  // Streams.
  const report = buildWealthReport(chart, rc.vargas, rc.strengths, rc.yogas, { extended: rc.extended, special: rc.special });
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  // A reason already given for a higher-ranked option is not repeated.
  const usedWhy = new Set<string>();
  subsections.push({
    heading: "Where money comes from",
    lead: [report.headline, `Split of the wealth signal: ${report.split.map((s) => `${s.label.split(" (")[0]} ${s.percent}%`).join(", ")}.`],
    bullets: items.slice(0, 3).map((it, i) => {
      const why = [...it.reasons]
        .sort((a, b) => b.weight - a.weight)
        .map((r) => compactPoint(r.text).replace(/\.$/, ""))
        .filter((t) => !usedWhy.has(t))
        .slice(0, 2);
      why.forEach((t) => usedWhy.add(t));
      return `${i + 1}. ${it.label.split(" (")[0]} — ${it.score}/100 (${it.verdict}). Why: ${joinAnd(why)}.`;
    }),
  });

  if (withTiming && items[0]) {
    const windows = wealthTimingWindows(chart, rc.dashaTree, rc.ayanamsha, rc.av, items[0].key, rc.now);
    const w = windowBullets(windows);
    subsections.push({ heading: `When ${items[0].label.split(" (")[0].toLowerCase()} grows`, lead: [], bullets: w.length ? w : ["This stream runs steadily rather than in bursts — no single period stands out."] });
  }

  const l2 = lordOf(rc, 2);
  const l11 = lordOf(rc, 11);
  const r2 = ratio(rc, l2);
  const r11 = ratio(rc, l11);
  return {
    key: "wealth",
    number: 3,
    title: "Wealth",
    subsections,
    summary: [
      report.headline,
      `The 2nd lord ${name(l2)}${r2 !== null ? ` (${fmtRatio(r2)})` : ""} decides what you keep and the 11th lord ${name(l11)}${r11 !== null ? ` (${fmtRatio(r11)})` : ""} what comes in; the yogas above decide how much of it stays.`,
    ],
  };
}
