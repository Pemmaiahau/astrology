import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { checkMangalDosha } from "../marriage";
import { houseSubsection } from "./common";
import {
  deg, DIGNITY_WORD, joinAnd, lordOf, name, names, nakOf, ord, planet, sav, sentences, SIGNS, vargaPos,
  type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import {
  aspectingSign, houseOfSign, houseState, inSign, judge, planetState, savOfSign, VERDICT_WORD, whoEnd, type Factor,
} from "./judge";
import { SEVENTH_LORD_IN } from "./lordEffects";
import { LAGNA_PHYSIQUE, PLANET_BODY } from "./tables";
import { relevance, topicTiming, type TimingSpec } from "./timeline";
import { confidenceLine, topicSections } from "./topic";

const MALEFIC: PlanetId[] = ["Sa", "Ma", "Su", "Ra", "Ke"];
const BENEFIC: PlanetId[] = ["Ju", "Ve", "Me", "Mo"];
const YEAR = 365.25 * 86400000;

/** The partner's temperament by planet (7th occupant, 7th lord, Darakaraka). */
const SPOUSE_BY: Record<PlanetId, string> = {
  Su: "proud, principled and status-conscious",
  Mo: "caring, emotional and family-minded",
  Ma: "energetic, direct and competitive",
  Me: "youthful, witty and communicative",
  Ju: "wise, ethical and well educated",
  Ve: "attractive, refined, affectionate and well turned out",
  Sa: "practical, hardworking, responsible and composed",
  Ra: "unconventional and ambitious",
  Ke: "reserved, private or spiritually inclined",
};

/** The partner's temperament by the 7th sign. */
const SPOUSE_SIGN: string[] = [
  "spirited and independent", "steady and sensual", "lively and talkative", "nurturing and sensitive",
  "dignified and generous", "practical and precise", "graceful and fair-minded", "intense and loyal",
  "principled and outgoing", "practical, hardworking and possibly career-oriented", "independent and unconventional", "gentle and intuitive",
];

function spec(rc: ReadingContext): TimingSpec {
  const female = rc.chart.meta.gender === "female";
  const karakas: TimingSpec["karakas"] = [{ id: "Ve", label: "the marriage karaka" }];
  if (female) karakas.push({ id: "Ju", label: "the husband karaka" });
  if (rc.jaimini) karakas.push({ id: rc.jaimini.karakas.DK, label: "the Darakaraka" });
  return {
    anchor: 7,
    houses: [2, 11],
    karakas,
    signs: rc.jaimini ? [{ sign: rc.jaimini.upapada, label: "the Upapada" }] : [],
    varga: { id: "D9", houses: [1, 7] },
    active: "relationship activity: commitment, marriage or a deepening bond",
    pressure: "relationship strain: misunderstandings, distance, outside interference or the spouse's health",
    transitSigns: [{ sign: (rc.chart.ascendant.sign + 6) % 12, label: "the 7th" }],
    nodeTargets: ["Ve"],
    fromAge: 20,
  };
}

/** The marriage evidence, weighed. Shared by the reading part and the marriage card. */
export function marriageFactors(rc: ReadingContext): Factor[] {
  const { chart } = rc;
  const f: Factor[] = [];
  const l7 = lordOf(rc, 7);
  const p7 = planet(rc, l7);
  for (const x of houseState(rc, 7).factors) {
    if (x.short.startsWith("lord in") || x.short === "Vipareeta placement" || x.short === "Venus in it") continue;
    f.push(x);
  }
  if (p7) {
    const good = [1, 2, 4, 5, 7, 9, 10, 11].includes(p7.house);
    f.push({ text: `The 7th lord ${name(l7)} sits in the ${ord(p7.house)}: ${SEVENTH_LORD_IN[p7.house - 1]}.`, w: good ? 0.6 : -0.8, short: `7th lord in the ${ord(p7.house)}` });
    const d = p7.longitude % 30;
    const nodes = (["Ra", "Ke"] as PlanetId[]).filter((n) => { const q = planet(rc, n); return q && q.sign === p7.sign && Math.abs((q.longitude % 30) - d) <= 5; });
    if ((d < 1 || d > 29) && nodes.length) f.push({ text: `The 7th lord ${name(l7)} is at a sign junction and tight with ${names(nodes)}.`, w: -0.6, short: "7th lord at junction" });
  }

  // Venus, the karaka.
  const ve = planet(rc, "Ve");
  const sv = planetState(rc, "Ve");
  if (ve) {
    const extra = sv.plus.filter((x) => !x.startsWith(DIGNITY_WORD[ve.dignity]));
    if (sv.grade === "strong" || ["exalted", "own", "moolatrikona", "greatFriend"].includes(ve.dignity)) f.push({ text: `Venus, the marriage karaka, is in the ${ord(ve.house)} ${DIGNITY_WORD[ve.dignity]}${extra.length ? ` (${extra.slice(0, 2).join(", ")})` : ""}.`, w: sv.grade === "weak" ? 0.3 : 0.9, short: "Venus well placed" });
    if (sv.grade === "weak") f.push({ text: `Venus, the marriage karaka, is weak: ${sv.minus.slice(0, 2).join(", ")}.`, w: -1, short: "Venus weak" });
    const asp = aspectingSign(rc, ve.sign).filter((id) => MALEFIC.includes(id));
    const drik = rc.shadbala?.planets.Ve.drik[0]?.virupas;
    if (asp.length) f.push({ text: `Venus is aspected by ${names(asp)}${drik !== undefined ? ` (Drik Bala ${drik.toFixed(1)})` : ""}.`, w: -0.4 * asp.length, short: "Venus afflicted" });
    if (ve.house === 7) f.push({ text: "Venus, the karaka, sits in the 7th it signifies (karako bhava nashaya), which raises expectations of the relationship.", w: -0.4, short: "karaka in own house" });
  }
  if (chart.meta.gender === "female") {
    const sj = planetState(rc, "Ju");
    if (sj.grade !== "moderate") f.push({ text: `Jupiter, the husband karaka, is ${sj.grade}${sj.grade === "strong" ? `: ${sj.plus.slice(0, 2).join(", ")}` : `: ${sj.minus.slice(0, 2).join(", ")}`}.`, w: sj.grade === "strong" ? 0.8 : -0.8, short: `Jupiter ${sj.grade}` });
  }

  // The Navamsa.
  if (rc.vargas) {
    const d9 = rc.vargas.charts.D9;
    const lag = d9.ascendant;
    const lagOcc = d9.positions.filter((p) => p.sign === lag).map((p) => p.id);
    const s7 = (lag + 6) % 12;
    const l7d9 = SIGN_LORDS[s7];
    const l7pos = vargaPos(rc, l7d9, "D9");
    const good: string[] = [];
    if (["Ve", "Ju", "Mo", "Me"].includes(SIGN_LORDS[lag]) || lagOcc.some((id) => BENEFIC.includes(id))) {
      good.push(`the Lagna is ${SIGNS[lag]}${["Ve", "Ju"].includes(SIGN_LORDS[lag]) ? ` (${name(SIGN_LORDS[lag])}'s sign)` : ""}${lagOcc.length ? ` with ${joinAnd(lagOcc.map((id) => (id === "Mo" ? "the Moon" : name(id))))} in it` : ""}`);
    }
    if (l7pos && ["exalted", "moolatrikona", "own"].includes(l7pos.dignity)) good.push(`the D9 7th lord ${name(l7d9)} is ${DIGNITY_WORD[l7pos.dignity]}`);
    if (good.length) f.push({ text: `D9: ${joinAnd(good)}.`, w: 0.6 * good.length, short: "D9 support" });
    if (l7pos?.dignity === "debilitated") f.push({ text: `The D9 7th lord ${name(l7d9)} is debilitated.`, w: -0.8, short: "D9 7th lord weak" });
    const veD9 = vargaPos(rc, "Ve", "D9");
    if (veD9) {
      const withVe = d9.positions.filter((p) => p.sign === veD9.sign && p.id !== "Ve").map((p) => p.id);
      const mal = withVe.filter((id) => ["Sa", "Ra", "Ke", "Ma"].includes(id));
      if (mal.length) f.push({ text: `In D9, Venus is with ${names(mal)}, giving a ${mal.includes("Sa") ? "duty-bound marriage" : "testing bond"}${mal.includes("Ke") ? " with phases of emotional distance" : ""}.`, w: -0.6, short: "Venus afflicted in D9" });
      if (veD9.dignity === "debilitated") f.push({ text: "Venus is debilitated in the Navamsa.", w: -0.8, short: "Venus debilitated in D9" });
    }
  }

  // Upapada, A7 and the Darakaraka.
  if (rc.jaimini) {
    const ul = rc.jaimini.upapada;
    const ulLord = SIGN_LORDS[ul];
    const st = planetState(rc, ulLord);
    const rank = rc.shadbala?.strongest === ulLord ? ", the strongest planet" : "";
    f.push({ text: `The Upapada is ${SIGNS[ul]} (your ${ord(houseOfSign(rc, ul))}), ruled by ${name(ulLord)}${rank}, which is ${st.grade}.`, w: st.grade === "strong" ? 0.8 : st.grade === "weak" ? -0.8 : 0.2, short: "Upapada" });
    const second = (ul + 1) % 12;
    const on2 = inSign(rc, second);
    const mal = on2.filter((id) => MALEFIC.includes(id));
    const ben = on2.filter((id) => BENEFIC.includes(id));
    if (mal.length && !ben.length) f.push({ text: `${names(mal)} ${mal.length > 1 ? "sit" : "sits"} in the 2nd from the Upapada (${SIGNS[second]}). This brings periodic strain on the marriage, often over money or family interference.`, w: -1, short: "malefic 2nd from UL" });
    else if (ben.length && !mal.length) f.push({ text: `${names(ben)} in the 2nd from the Upapada (${SIGNS[second]}) sustains the marriage over the long run.`, w: 0.8, short: "benefic 2nd from UL" });
    const a7 = rc.jaimini.padas[6];
    const s = savOfSign(rc, a7);
    if (s !== null && s >= 30) f.push({ text: `A7 is in ${SIGNS[a7]}, with SAV ${s}.`, w: 0.5, short: `A7 SAV ${s}` });
    else if (s !== null && s < 25) f.push({ text: `A7 is in ${SIGNS[a7]}, with only SAV ${s}.`, w: -0.4, short: `A7 SAV ${s}` });
    const dk = rc.jaimini.karakas.DK;
    const sd = planetState(rc, dk);
    if (sd.grade === "strong") f.push({ text: `The Darakaraka ${name(dk)} is strong (${sd.plus.slice(0, 2).join(", ")}).`, w: 0.6, short: "Darakaraka strong" });
    else if (sd.grade === "weak") f.push({ text: `The Darakaraka ${name(dk)} is weak (${sd.minus.slice(0, 2).join(", ")}).`, w: -0.6, short: "Darakaraka weak" });
  }

  // Mangal Dosha.
  const md = checkMangalDosha(chart);
  if (md.present) {
    const refs = [md.fromLagna ? "the Lagna" : "", md.fromMoon ? "the Moon" : "", md.fromVenus ? "Venus" : ""].filter(Boolean);
    f.push({
      text: `Mangal Dosha forms from ${joinAnd(refs)}${md.effective ? "" : `, though it is cancelled (${md.cancellations[0]?.split(/[—.]/)[0].trim() ?? "by a classical exception"})`}.`,
      w: md.effective ? -0.5 * refs.length : -0.2,
      short: "Mangal Dosha",
    });
  }
  return f;
}

function spouseBlock(rc: ReadingContext): ReadingSubsection {
  const s7 = (rc.chart.ascendant.sign + 6) % 12;
  const occ = inSign(rc, s7);
  const dk = rc.jaimini?.karakas.DK;
  const traits: string[] = [];
  if (dk && !occ.includes(dk)) traits.push(SPOUSE_BY[dk]);
  traits.push(SPOUSE_SIGN[s7]);
  for (const id of occ) traits.push(SPOUSE_BY[id]);
  const by = [`A ${SIGNS[s7]} 7th`, dk ? `${name(dk)} as Darakaraka` : "", occ.length ? `${names(occ)} in the 7th` : ""].filter(Boolean);
  const foreign = [...occ, ...aspectingSign(rc, s7)].some((id) => id === "Ra" || id === "Ke") || (planet(rc, "Ve") && inSign(rc, planet(rc, "Ve")!.sign).includes("Ra"));
  const body = (LAGNA_PHYSIQUE[s7].split(";")[1] ?? "").trim().replace(/^the /, "").replace(/ (are|is) (the )?sensitive( areas?)?$/, "").replace(/ need watching$/, "");
  const unique = [...new Set(traits.join(", ").split(/, | and /).map((x) => x.trim()).filter(Boolean))];
  return {
    heading: "Spouse",
    lead: [
      `${by.length ? `${joinAnd(by)} point to` : "The chart points to"} a spouse who is ${joinAnd(unique.slice(0, 8))}.${foreign ? " The spouse may come from a different background (a node touches the 7th or Venus)." : ""}`,
    ],
    bullets: [`Health tendencies for the spouse: ${body || "no particular area"}${dk && !PLANET_BODY[dk].split(/, | and /).every((x) => body.includes(x.replace(/^the /, ""))) ? `; with ${name(dk)} as Darakaraka, also ${PLANET_BODY[dk]}` : ""}.`],
  };
}

export function marriagePart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  // Cut-offs from a 400-chart random sample (≈15% strong, 35% good, 35% mixed, 15% weak); see SOURCES.md.
  const j = judge(marriageFactors(rc), { strong: 3.2, good: -0.3, weak: -3.6 });
  const sum = j.oppose.map((x) => x.short);
  const verdictText =
    j.level === "strong"
      ? "A happy, lasting marriage with real warmth and support."
      : j.level === "good"
        ? `A lasting marriage built on ${sum.includes("Venus afflicted in D9") || sum.includes("7th lord at junction") ? "duty and shared goals" : "affection and shared goals"}.${j.oppose.length >= 4 ? " The emotional temperature needs conscious tending, and there are periodic stress tests." : ""}`
        : j.level === "mixed"
          ? `A lasting marriage built on duty and shared goals rather than easy romance. The emotional temperature needs conscious tending, and there are periodic stress tests.`
          : "Marriage asks for patience and realistic expectations; delays, distance or strain are likely, and timing and partner choice matter a great deal.";

  let timing = withTiming ? topicTiming(rc, spec(rc)) : null;
  // The most likely marriage window, from the ages when marriage is usual.
  if (timing && rc.dashaTree && chart.birthUtc) {
    const sp = spec(rc);
    const b = chart.birthUtc.getTime();
    const now = rc.now.getTime();
    if (now - b > 24 * YEAR) {
      const cands = rc.dashaTree.flatMap((md) => (md.children ?? []).map((ad) => ({ md, ad })))
        .filter(({ ad }) => ad.start.getTime() >= b + 21 * YEAR && ad.end.getTime() <= Math.min(now, b + 36 * YEAR))
        .map(({ md, ad }) => ({ md, ad, s: relevance(rc, sp, md.lord).score + relevance(rc, sp, ad.lord).score }))
        .filter((x) => x.s >= 4)
        .sort((x, y) => y.s - x.s);
      if (cands.length) {
        const top = cands[0];
        const sameMd = cands.filter((c) => c.md === top.md).slice(0, 3).sort((x, y) => x.ad.start.getTime() - y.ad.start.getTime());
        const yr = (d: Date) => d.getUTCFullYear();
        const r = relevance(rc, sp, top.md.lord);
        const chara = rc.confirm?.chara.find((c) => c.start.getTime() <= top.ad.end.getTime() && c.end.getTime() >= top.ad.start.getTime() && (c.sign === rc.jaimini?.upapada || c.sign === (lagna + 6) % 12));
        timing = {
          ...timing,
          past: [
            `Most likely marriage window: ${yr(sameMd[0].ad.start)}–${yr(sameMd[sameMd.length - 1].ad.end)}. This was the ${name(top.md.lord)} Mahadasha (${name(top.md.lord)} is ${joinAnd(r.tags.slice(0, 2))}); the sub-periods ${joinAnd(sameMd.map((c) => `${name(c.md.lord)}–${name(c.ad.lord)} (${yr(c.ad.start)}–${yr(c.ad.end)}, ${relevance(rc, sp, c.ad.lord).tags[0] ?? "supporting"})`))} fall here${chara ? `, inside Chara ${SIGNS[chara.sign]} (${chara.sign === rc.jaimini?.upapada ? "the Upapada sign" : "the 7th"}, ${yr(chara.start)}–${yr(chara.end)})` : ""}.`,
            ...timing.past.filter((p) => !p.startsWith("The ")),
          ],
          now: timing.now.map((n) => `If unmarried: ${n} If married: the same period brings shared assets, a home or a joint venture as easily as strain.`),
        };
      }
    }
  }

  const subsections = topicSections({
    j,
    blocks: [spouseBlock(rc)],
    verdict: verdictText,
    confidence: confidenceLine(j.confidence, "the marriage promise"),
    timing,
  });

  const detail: ReadingSubsection[] = [houseSubsection(rc, 7, `The 7th house: ${SIGNS[(lagna + 6) % 12]}`)];
  for (const id of ["Ve", lordOf(rc, 7), ...(rc.jaimini ? [rc.jaimini.karakas.DK] : [])] as PlanetId[]) {
    const p = planet(rc, id);
    if (!p || detail.some((d) => d.heading.includes(name(id)))) continue;
    const st = planetState(rc, id);
    detail.push({
      heading: `${whoEnd(rc, id)}${rc.jaimini?.karakas.DK === id ? " — Darakaraka" : id === "Ve" ? " — marriage karaka" : ""}`,
      lead: [`At ${deg(p.longitude)} ${SIGNS[p.sign]} (${nakOf(p.longitude).name}) in the ${ord(p.house)}; condition ${st.grade}.`],
      bullets: [...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []), ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : [])],
    });
  }
  if (rc.vargas) {
    const d9 = rc.vargas.charts.D9;
    detail.push({
      heading: `The Navamsa (D9): ${SIGNS[d9.ascendant]} rising`,
      lead: [],
      bullets: d9.positions.map((p) => `${name(p.id)}: ${SIGNS[p.sign]}, D9 ${ord(((p.sign - d9.ascendant + 12) % 12) + 1)}, ${DIGNITY_WORD[p.dignity]}.`),
    });
  }
  const md = checkMangalDosha(chart);
  detail.push({ heading: `Mangal Dosha: ${md.present ? (md.effective ? "present" : "present but cancelled") : "absent"}`, lead: [], bullets: sentences(md.text, 3) });
  const s7 = sav(rc, 7);
  if (s7 !== null) detail.push({ heading: "Ashtakavarga", lead: [`The 7th holds ${s7} SAV bindus.`], bullets: [] });

  return {
    key: "marriage",
    number: 4,
    title: "Marriage and relationships",
    subsections,
    detail,
    verdict: { word: VERDICT_WORD[j.level], confidence: j.confidence },
    summary: [verdictText],
  };
}
