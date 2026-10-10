import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildCareerReport, careerTimingWindows, CAREER_FIELDS } from "../career";
import { compactPoint } from "../brief";
import { houseSubsection, windowBullets } from "./common";
import {
  cap, deg, DIGNITY_WORD, fmtRatio, isStrongDignity, isWeakDignity, joinAnd, name, names, nakOf, ord, planet, ratio,
  sentences, SIGNS, vargaPos, type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import { article, SIGN_TONE } from "./tables";

const STATUS_YOGA = (key: string) =>
  key.startsWith("raja-") || key.startsWith("mahapurusha-") || key.startsWith("amala") || key.startsWith("yk-") ||
  key === "lakshmi" || key === "jaimini-raja-ak-amk" || key.startsWith("adhi") || key === "saraswati" || key.startsWith("nbrj-");

export function careerPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const subsections: ReadingSubsection[] = [];
  const lagna = chart.ascendant.sign;

  // 1. The 10th house.
  const tenth = houseSubsection(rc, 10, `The 10th house: ${SIGNS[(lagna + 9) % 12]}`);
  for (const k of ["Su", "Sa"] as PlanetId[]) {
    const p = planet(rc, k);
    const r = ratio(rc, k);
    if (p) tenth.bullets.push(`${name(k)}, the natural karaka of ${k === "Su" ? "authority and status" : "work and endurance"}, is ${DIGNITY_WORD[p.dignity]} in the ${ord(p.house)}${r !== null ? ` at ${fmtRatio(r)}` : ""} — ${isStrongDignity(p.dignity) || (r ?? 0) >= 1.2 ? "a solid support for a working life with standing" : isWeakDignity(p.dignity) || (r ?? 1) < 1 ? "recognition comes later and through persistence" : "steady, unspectacular support"}.`);
  }
  const moon = planet(rc, "Mo");
  if (moon) {
    const tFromMoon = (moon.sign + 9) % 12;
    const l = SIGN_LORDS[tFromMoon];
    const lp = planet(rc, l);
    if (lp) tenth.bullets.push(`Counted from the Moon, the 10th is ${SIGNS[tFromMoon]}; its lord ${name(l)} sits in your ${ord(lp.house)} ${DIGNITY_WORD[lp.dignity]}, so the work that also satisfies you emotionally runs through ${CAREER_FIELDS[l].label.toLowerCase()}.`);
  }
  subsections.push(tenth);

  // 2. The Dasamsa.
  if (rc.vargas) {
    const d10 = rc.vargas.charts.D10;
    const tenthLord = SIGN_LORDS[(lagna + 9) % 12];
    const tl = vargaPos(rc, tenthLord, "D10");
    const kendras = [0, 3, 6, 9].map((o) => (d10.ascendant + o) % 12);
    const inKendra = d10.positions.filter((p) => kendras.includes(p.sign)).map((p) => p.id);
    const strong = d10.positions.filter((p) => isStrongDignity(p.dignity)).map((p) => p.id);
    const weak = d10.positions.filter((p) => p.dignity === "debilitated").map((p) => p.id);
    const bullets: string[] = [
      `${cap(article(SIGNS[d10.ascendant]))} D10 Lagna gives ${article(SIGN_TONE[d10.ascendant])} style at work.`,
    ];
    if (tl) bullets.push(`Your 10th lord ${name(tenthLord)} is ${DIGNITY_WORD[tl.dignity]} in the D10 (${SIGNS[tl.sign]}) — ${isStrongDignity(tl.dignity) ? "the career promise of the birth chart holds up under magnification" : tl.dignity === "debilitated" ? "the career promise needs more effort than the birth chart suggests" : "the career promise holds at an ordinary level"}.`);
    if (inKendra.length) bullets.push(`${names(inKendra)} ${inKendra.length > 1 ? "occupy" : "occupies"} the D10 kendras — these planets' themes shape the visible career.`);
    if (strong.length) bullets.push(`Dignified in the D10: ${names(strong)}. Their periods are the strongest for professional progress.`);
    if (weak.length) bullets.push(`Debilitated in the D10: ${names(weak)}. Their periods need more care at work.`);
    subsections.push({ heading: `The Dasamsa (D10): ${SIGNS[d10.ascendant]} rising`, lead: [], bullets });
  }

  // 3. Amatyakaraka.
  if (rc.jaimini) {
    const amk = rc.jaimini.karakas.AmK;
    const p = planet(rc, amk);
    if (p) {
      const bullets = [
        `${name(amk)} is your Amatyakaraka, the planet of career counsel: it favours ${CAREER_FIELDS[amk].fields}.`,
        `${name(amk)} is ${DIGNITY_WORD[p.dignity]}${ratio(rc, amk) !== null ? ` at ${fmtRatio(ratio(rc, amk)!)}` : ""} — ${isStrongDignity(p.dignity) || (ratio(rc, amk) ?? 0) >= 1.2 ? "help and advancement come readily" : isWeakDignity(p.dignity) ? "advancement comes through your own effort more than through patrons" : "help comes when you ask for it"}.`,
      ];
      const ak = rc.jaimini.karakas.AK;
      if (planet(rc, ak)?.sign === p.sign) bullets.push(`The Atmakaraka ${name(ak)} sits with it — a Jaimini Raja Yoga: status through your own work.`);
      subsections.push({
        heading: `Amatyakaraka: ${name(amk)} in ${SIGNS[p.sign]} in the ${ord(p.house)} house`,
        lead: [`${name(amk)} is at ${deg(p.longitude)} ${SIGNS[p.sign]} (${nakOf(p.longitude).name}).`],
        bullets,
      });
    }
  }

  // 4. Yogas for status.
  {
    const ys = [...rc.yogas, ...rc.extended].filter((y) => STATUS_YOGA(y.key));
    const seen = new Set<string>();
    const bullets = ys
      .filter((y) => (seen.has(y.name + y.planets.join()) ? false : (seen.add(y.name + y.planets.join()), true)))
      .map((y) => `${y.name}${y.planets.length ? ` (${names(y.planets)})` : ""}: ${sentences(y.description, 1)[0]}`);
    subsections.push({
      heading: "Yogas for status",
      lead: [],
      bullets: bullets.length ? bullets : ["No major status yoga forms; rise comes through steady effort and the strength of the 10th lord rather than through a single lucky combination."],
    });
  }

  // 5. Where you fit — from the scored career report.
  const report = buildCareerReport(chart, rc.vargas, rc.jaimini, rc.shadbala, rc.strengths, rc.yogas, { extended: rc.extended, special: rc.special });
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  // A reason already given for a higher-ranked option is not repeated.
  const usedWhy = new Set<string>();
  subsections.push({
    heading: "Where your work fits best",
    lead: [report.headline],
    bullets: items.slice(0, 3).map((it, i) => {
      const why = [...it.reasons]
        .sort((a, b) => b.weight - a.weight)
        .map((r) => compactPoint(r.text).replace(/\.$/, ""))
        .filter((t) => !usedWhy.has(t))
        .slice(0, 2);
      why.forEach((t) => usedWhy.add(t));
      return `${i + 1}. ${it.label} — ${it.score}/100 (${it.verdict}). Why: ${joinAnd(why)}.`;
    }),
  });
  const jb = report.blocks.find((b) => b.heading === "Job or business?");
  if (jb) subsections.push({ heading: "Job or business", lead: [], bullets: jb.paragraphs.flatMap((p) => sentences(p, 2)).slice(0, 3) });

  // 6. Timing.
  if (withTiming) {
    const windows = careerTimingWindows(chart, rc.dashaTree, rc.ayanamsha, rc.av, rc.jaimini, rc.now);
    const w = windowBullets(windows);
    subsections.push({ heading: "When career moves happen", lead: [], bullets: w.length ? w : ["No strongly connected career period lies ahead in the scanned bands; moves are more likely to ride on transits."] });
  }

  const top = items[0];
  const summary = [
    `${report.headline}${top ? ` The leading direction scores ${top.score}/100.` : ""}`,
    `The 10th lord ${name(SIGN_LORDS[(lagna + 9) % 12])} and the Amatyakaraka${rc.jaimini ? ` ${name(rc.jaimini.karakas.AmK)}` : ""} decide how far this goes; their main periods are when it moves.`,
  ];
  return { key: "career", number: 2, title: "Career", subsections, summary };
}
