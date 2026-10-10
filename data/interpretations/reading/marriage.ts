import { aspectedSigns } from "@/utils/astrology/aspects";
import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildMarriageReport, checkMangalDosha, marriageTimingWindows } from "../marriage";
import { PLANET_SIGNIFIES } from "../significations";
import { houseSubsection, windowBullets } from "./common";
import {
  deg, DIGNITY_WORD, fmtRatio, isStrongDignity, isWeakDignity, name, names, nakOf, ord, planet, ratio, sentences,
  SIGNS, vargaPos, type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import { article, SIGN_TONE } from "./tables";

const BENEFIC: PlanetId[] = ["Ju", "Ve", "Me", "Mo"];
const MALEFIC: PlanetId[] = ["Sa", "Ma", "Su", "Ra", "Ke"];

function karakaBullet(rc: ReadingContext, id: PlanetId, role: string): string | null {
  const p = planet(rc, id);
  if (!p) return null;
  const r = ratio(rc, id);
  const d9 = vargaPos(rc, id, "D9");
  return `${name(id)} (${role}) is ${DIGNITY_WORD[p.dignity]} in the ${ord(p.house)}${r !== null ? ` at ${fmtRatio(r)}` : ""}${d9 ? `, and ${DIGNITY_WORD[d9.dignity]} in the Navamsa (${SIGNS[d9.sign]})` : ""} — ${
    (isStrongDignity(p.dignity) || (d9 && isStrongDignity(d9.dignity))) && !isWeakDignity(p.dignity)
      ? "a warm, supportive significator"
      : isWeakDignity(p.dignity) || d9?.dignity === "debilitated"
        ? "the significator needs care, which classically shows as delay or adjustment"
        : "an ordinary, workable significator"
  }.`;
}

export function marriagePart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const female = chart.meta.gender === "female";
  const subsections: ReadingSubsection[] = [];

  // 1. The 7th house, with the classical delay markers called out.
  const seventh = houseSubsection(rc, 7, `The 7th house: ${SIGNS[(lagna + 6) % 12]}`);
  const s7 = (lagna + 6) % 12;
  const sa = planet(rc, "Sa");
  if (sa && (sa.sign === s7 || aspectedSigns("Sa", sa.sign).includes(s7))) {
    seventh.bullets.push("Saturn touches the 7th — the classical \"later is better\" marker: marriage tends to come after the mid-twenties or after a period of waiting, and lasts once made.");
  }
  subsections.push(seventh);

  // 2. Karakas.
  {
    const bullets = [karakaBullet(rc, "Ve", "the karaka of marriage"), female ? karakaBullet(rc, "Ju", "the husband-karaka for a woman's chart") : null].filter(Boolean) as string[];
    const ve = planet(rc, "Ve");
    if (ve && ve.combust) bullets.push("Venus is combust: affection can be overshadowed by duty or ego in the early years.");
    subsections.push({ heading: female ? "Venus and Jupiter — the marriage significators" : "Venus — the marriage significator", lead: [], bullets });
  }

  // 3. Darakaraka.
  if (rc.jaimini) {
    const dk = rc.jaimini.karakas.DK;
    const p = planet(rc, dk);
    if (p) {
      subsections.push({
        heading: `Darakaraka: ${name(dk)} in ${SIGNS[p.sign]} in the ${ord(p.house)} house`,
        lead: [`${name(dk)} is at ${deg(p.longitude)} ${SIGNS[p.sign]} (${nakOf(p.longitude).name}), ${DIGNITY_WORD[p.dignity]}.`],
        bullets: [
          `The spouse carries ${name(dk)}'s themes — ${PLANET_SIGNIFIES[dk].phrase} — and ${article(SIGN_TONE[p.sign])} temperament.`,
          isWeakDignity(p.dignity) ? `${name(dk)} is weak by sign, so the partner may face their own struggles, or the relationship asks for patience.` : `${name(dk)} is in reasonable dignity, so the partner is capable in their own right.`,
        ],
      });
    }
  }

  // 4. Upapada Lagna.
  if (rc.jaimini) {
    const ul = rc.jaimini.upapada;
    const ulHouse = ((ul - lagna + 12) % 12) + 1;
    const second = (ul + 1) % 12;
    const onSecond = chart.planets.filter((p) => p.sign === second).map((p) => p.id);
    const ulLord = SIGN_LORDS[ul];
    const ulp = planet(rc, ulLord);
    const bullets = [`The Upapada shows the marriage itself: ${article(SIGN_TONE[ul])} union.`];
    if (ulp) bullets.push(`Its lord ${name(ulLord)} is in your ${ord(ulp.house)}, ${DIGNITY_WORD[ulp.dignity]}.`);
    const mal = onSecond.filter((id) => MALEFIC.includes(id));
    const ben = onSecond.filter((id) => BENEFIC.includes(id));
    bullets.push(
      onSecond.length
        ? `The 2nd from the Upapada (${SIGNS[second]}) holds ${names(onSecond)}: ${mal.length && !ben.length ? "malefics here classically strain the marriage's continuity — it needs conscious maintenance" : ben.length && !mal.length ? "benefics here sustain the marriage over the long run" : "mixed influences — continuity depends on effort from both sides"}.`
        : `The 2nd from the Upapada (${SIGNS[second]}) is empty, so the marriage's continuity rests on the Upapada lord.`
    );
    subsections.push({ heading: `Upapada Lagna: ${SIGNS[ul]} in the ${ord(ulHouse)} house`, lead: [], bullets });
  }

  // 5. Navamsa.
  if (rc.vargas) {
    const d9 = rc.vargas.charts.D9;
    const s = (d9.ascendant + 6) % 12;
    const occ = d9.positions.filter((p) => p.sign === s).map((p) => p.id);
    const l7 = SIGN_LORDS[s];
    const l7pos = vargaPos(rc, l7, "D9");
    subsections.push({
      heading: `The Navamsa (D9): ${SIGNS[d9.ascendant]} rising`,
      lead: [`The Navamsa 7th is ${SIGNS[s]}${occ.length ? `, holding ${names(occ)}` : ""}; its lord ${name(l7)} is ${l7pos ? DIGNITY_WORD[l7pos.dignity] : "unplaced"} in the Navamsa.`],
      bullets: [
        `Married life takes ${article(SIGN_TONE[s])} character.`,
        l7pos && isStrongDignity(l7pos.dignity) ? "A dignified Navamsa 7th lord is one of the best signs of a lasting marriage." : l7pos?.dignity === "debilitated" ? "A debilitated Navamsa 7th lord asks for patience and realistic expectations in marriage." : "The Navamsa 7th lord is of ordinary strength — the marriage is what both of you make of it.",
      ],
    });
  }

  // 6. Mangal Dosha.
  const md = checkMangalDosha(chart);
  subsections.push({ heading: `Mangal Dosha: ${md.present ? (md.effective ? "present" : "present but cancelled") : "absent"}`, lead: [], bullets: sentences(md.text, 2) });

  // 7. Partner and timing from the scored report.
  const report = buildMarriageReport(chart, rc.vargas, rc.jaimini, rc.strengths, rc.yogas);
  const spouse = report.blocks.find((b) => b.heading === "What your partner tends to be like");
  if (spouse) subsections.push({ heading: "What your partner tends to be like", lead: [], bullets: spouse.paragraphs.flatMap((p) => sentences(p, 2)).slice(0, 4) });
  if (withTiming) {
    const w = windowBullets(marriageTimingWindows(chart, rc.dashaTree, rc.ayanamsha, rc.av, rc.jaimini, rc.now));
    subsections.push({ heading: "When marriage is most likely", lead: [], bullets: w.length ? w : ["No marriage-connected main period stands out in the remaining band; Jupiter's transits over the 7th are the trigger to watch."] });
  }

  return {
    key: "marriage",
    number: 4,
    title: "Marriage and relationships",
    subsections,
    summary: [report.headline, `Marriage score ${report.score ?? "—"}/100 — read it together with the windows: timing matters more than the average for this house.`],
  };
}
