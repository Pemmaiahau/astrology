import { SIGN_LORDS } from "@/utils/astrology/constants";
import { currentPhase, currentSadeSati, sadeSatiPeriods } from "@/utils/astrology/sadeSati";
import { saturnStanceAt, SATURN_STANCE_TEXT } from "@/utils/astrology/gochara";
import { buildCautionsReport } from "../cautions";
import { briefOfCautions } from "../brief";
import { marakaPlanets } from "../lordships";
import { houseSubsection } from "./common";
import {
  avasthaOf, bhavaRupas, DIGNITY_WORD, fmtRatio, isGandanta, name, names, ord, planet, PLANETS, ratio, ratioRanking,
  sav, SIGNS, type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import { PLANET_BODY } from "./tables";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

export function healthPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const subsections: ReadingSubsection[] = [];

  // 1. Vitality: the Lagna, its lord, the Sun and the Moon.
  {
    const ll = SIGN_LORDS[lagna];
    const bullets: string[] = [];
    const s = sav(rc, 1);
    const bb = bhavaRupas(rc, 1);
    if (s !== null || bb !== null) bullets.push(`The 1st house holds ${s ?? "—"} SAV bindus${bb !== null ? ` and ${bb.toFixed(1)} rupas of Bhava Bala` : ""} — ${s !== null && s >= 28 ? "a sound base constitution" : "a constitution that needs routine and rest to stay strong"}.`);
    for (const id of [ll, "Su", "Mo"] as const) {
      const p = planet(rc, id);
      const r = ratio(rc, id);
      if (!p) continue;
      const role = id === ll ? "the Lagna lord (body and resilience)" : id === "Su" ? "vitality" : "the mind and sleep";
      bullets.push(`${name(id)}, ${role}, is ${DIGNITY_WORD[p.dignity]} in the ${ord(p.house)}${r !== null ? ` at ${fmtRatio(r)}` : ""}${p.combust ? ", combust" : ""} — ${(r ?? 1) >= 1 && !["debilitated", "greatEnemy"].includes(p.dignity) ? "well supported" : `watch ${PLANET_BODY[id]}`}.`);
    }
    subsections.push({ heading: `Vitality: ${SIGNS[lagna]} Lagna and its lord ${name(ll)}`, lead: [], bullets });
  }

  // 2. The 6th and 8th houses.
  subsections.push(houseSubsection(rc, 6, `The 6th house (illness and recovery): ${SIGNS[(lagna + 5) % 12]}`));
  subsections.push(houseSubsection(rc, 8, `The 8th house (chronic matters and longevity): ${SIGNS[(lagna + 7) % 12]}`));

  // 3. Planets to watch.
  {
    const rank = ratioRanking(rc);
    const weak = rank.filter((id) => (ratio(rc, id) ?? 1) < 1);
    const bullets = weak.map((id) => `${name(id)} is below its Shadbala requirement (${fmtRatio(ratio(rc, id)!)}): give extra care to ${PLANET_BODY[id]}.`);
    for (const id of PLANETS) {
      const p = planet(rc, id);
      if (!p) continue;
      if (p.dignity === "debilitated" && !weak.includes(id)) bullets.push(`${name(id)} is debilitated: ${PLANET_BODY[id]} are the sensitive area in its periods.`);
      if (isGandanta(p.longitude)) bullets.push(`${name(id)} is in gandanta: health matters linked to ${PLANET_BODY[id]} can come suddenly and need prompt attention.`);
      const av = avasthaOf(rc, id);
      if (av && /^Mrita/.test(av.baladi.state) && id !== "Ra" && id !== "Ke") bullets.push(`${name(id)} is in Mrita avastha (a "dead" degree): it gives little on its own, so its body areas (${PLANET_BODY[id]}) depend on routine care.`);
    }
    const doshas = rc.extended.filter((x) => x.kind === "dosha" && !x.key.startsWith("gandanta"));
    for (const d of doshas) bullets.push(`${d.name}: ${d.description.split(". ")[0]}.`);
    subsections.push({ heading: "Planets and conditions to watch", lead: [], bullets: bullets.length ? bullets : ["No planet falls below its strength requirement and no dosha forms — a resilient chart."] });
  }

  // 4. Marakas.
  {
    const mk = marakaPlanets(chart);
    subsections.push({
      heading: `Marakas: ${names(mk.primary)}`,
      lead: [`${mk.primary.length === 1 ? `${name(mk.primary[0])} rules both the 2nd and the 7th` : `The 2nd and 7th lords are ${names(mk.primary)}`}${mk.secondary.length ? `; secondary marakas: ${mk.secondary.map((s) => `${name(s.id)} (${s.reasons.join("; ")})`).join(", ")}` : ""}.`],
      bullets: ["Their main periods are when health deserves a little extra attention — routine check-ups, sleep and stress management. This is a prompt for prevention, not a prediction of anything dramatic."],
    });
  }

  // 5. Saturn's cycles.
  if (withTiming) {
    const periods = sadeSatiPeriods(chart, rc.ayanamsha, rc.now);
    const cur = currentSadeSati(periods);
    const next = periods.find((p) => p.status === "future");
    const bullets: string[] = [];
    const stance = saturnStanceAt(chart, rc.ayanamsha, rc.now);
    if (stance && !stance.startsWith("sadeSati")) bullets.push(`${SATURN_STANCE_TEXT[stance]}.`);
    if (cur) {
      const ph = currentPhase(cur, rc.now);
      bullets.push(`Sade Sati is running now (${fmt(cur.start)} – ${fmt(cur.end)})${ph ? `, ${ph.phase} phase in ${SIGNS[ph.sign]}` : ""}: a stretch for discipline, simplification and protecting health and sleep.`);
    }
    if (next) bullets.push(`Next Sade Sati: ${fmt(next.start)} – ${fmt(next.end)}.`);
    if (!bullets.length) bullets.push("No Sade Sati runs within the scanned span.");
    subsections.push({ heading: "Saturn's cycles", lead: [], bullets });
  }

  // 6. What helps — the weightiest cautions with their remedies.
  const cautions = buildCautionsReport(chart, rc.strengths, rc.shadbala, rc.yogas, rc.dashaTree, rc.now, { extended: rc.extended, special: rc.special });
  subsections.push({
    heading: "What to watch, and what helps",
    lead: [],
    bullets: briefOfCautions(cautions.cautions).map((c) => `${c.text} What helps: ${c.remedy}`),
  });

  return {
    key: "health",
    number: 6,
    title: "Health and things to watch",
    subsections,
    summary: [cautions.headline],
  };
}
