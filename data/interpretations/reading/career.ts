import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { PlanetId } from "@/utils/astrology/types";
import { buildCareerReport, CAREER_FIELDS } from "../career";
import { compactPoint } from "../brief";
import { houseSubsection } from "./common";
import {
  cap, deg, DIGNITY_WORD, fmtRatio, isStrongDignity, joinAnd, name, names, nakOf, ord, planet, ratio,
  sentences, SIGNS, vargaPos, type ReadingContext, type ReadingPart, type ReadingSubsection,
} from "./context";
import {
  aspectingSign, houseOfSign, houseState, inSign, judge, KENDRA, planetState, savOfSign, signFromMoon, TRIKONA, UPACHAYA,
  VERDICT_WORD, whoEnd, type Factor,
} from "./judge";
import { TENTH_LORD_IN } from "./lordEffects";
import { article, SIGN_TONE } from "./tables";
import { topicTiming } from "./timeline";
import { confidenceLine, retext, topicSections } from "./topic";

const STATUS_YOGA = (key: string) =>
  key.startsWith("raja-") || key.startsWith("mahapurusha-") || key.startsWith("amala") || key.startsWith("yk-") ||
  key === "lakshmi" || key === "jaimini-raja-ak-amk" || key.startsWith("adhi") || key === "saraswati" || key.startsWith("nbrj-");

/** What a planet in a difficult D10 placement does at work. */
const D10_TROUBLE: Record<PlanetId, string> = {
  Su: "friction with bosses or government",
  Mo: "emotional strain and changing moods at work",
  Ma: "conflicts, haste or accidents at work",
  Me: "contract or communication disputes",
  Ju: "advice ignored, or trouble with mentors",
  Ve: "workplace relationships turning complicated",
  Sa: "heavy load and slow recognition",
  Ra: "office politics or being misled",
  Ke: "phases of detachment from work",
};

/** How the public sees the career, by the house A10 falls in. */
const A10_IMAGE: string[] = [
  "a self-made professional whose name is the brand",
  "a reliable steward of money or resources",
  "a skilled communicator and doer",
  "a steady, settled professional, often linked to property, education or institutions",
  "a clever adviser, planner or teacher",
  "a competent, trusted problem-solver or administrator",
  "a client-facing dealmaker or partner",
  "a specialist trusted with risk, research or crises",
  "a principled guide, teacher or expert",
  "a visible authority in your field",
  "a well-networked achiever",
  "a behind-the-scenes or overseas professional",
];

/** What rise comes through, by the house the 10th lord occupies. */
const RISE_BY: string[] = [
  "personal initiative and reputation",
  "financial skill and dependable delivery",
  "skills, communication and sheer effort",
  "stability, education and institutional roles",
  "intelligence, advice and planning",
  "service, competition and solving problems others cannot",
  "clients, partnerships and dealmaking",
  "specialised expertise and handling crises, with a few abrupt turns",
  "mentors, principles and higher learning",
  "steady, visible achievement",
  "networks and large organisations",
  "foreign links or behind-the-scenes work",
];

// ---- Profession indicators -----------------------------------------------------

type Tag = "tech" | "research" | "finance" | "health" | "law" | "consult" | "mgmt" | "govt" | "media" | "trade" | "arts" | "teach" | "property" | "foreign" | "defence" | "hospitality" | "spiritual";

const TAG_LABEL: Record<Tag, string> = {
  tech: "Technical, engineering, IT or data work",
  research: "Research and analytics",
  finance: "Finance, risk, insurance, audit or taxation",
  health: "Healthcare, pharma or hospital administration",
  law: "Law, compliance or HR",
  consult: "Consulting and advisory roles",
  mgmt: "Management in large organisations, multinationals or the public sector",
  govt: "Government, administration or public service",
  media: "Media, communications, writing or marketing",
  trade: "Business, trade and sales",
  arts: "Design, arts, entertainment, fashion or luxury goods",
  teach: "Teaching, academia or training",
  property: "Real estate, construction or infrastructure",
  foreign: "Foreign trade, export or overseas postings",
  defence: "Defence, police, security or sport",
  hospitality: "Hospitality, food, travel or tourism",
  spiritual: "Spiritual, healing or alternative-medicine work",
};

const PLANET_TAGS: Record<PlanetId, Tag[]> = {
  Su: ["govt", "mgmt", "health"],
  Mo: ["hospitality", "health", "mgmt"],
  Ma: ["tech", "defence", "property", "health"],
  Me: ["tech", "trade", "media", "finance", "teach"],
  Ju: ["finance", "law", "teach", "consult"],
  Ve: ["arts", "hospitality", "finance", "media"],
  Sa: ["mgmt", "property", "tech", "law"],
  Ra: ["tech", "foreign", "media", "research"],
  Ke: ["research", "tech", "spiritual", "health"],
};

const HOUSE_TAGS: Tag[][] = [
  ["consult", "mgmt"],
  ["finance", "teach", "hospitality"],
  ["media", "trade", "tech"],
  ["property", "teach", "hospitality"],
  ["teach", "consult", "finance"],
  ["health", "law", "finance"],
  ["trade", "consult", "foreign"],
  ["research", "finance", "health"],
  ["law", "teach", "consult", "foreign"],
  ["govt", "mgmt"],
  ["mgmt", "finance", "tech"],
  ["foreign", "health", "research"],
];

function professions(rc: ReadingContext): { tags: { tag: Tag; by: string[] }[]; indicators: string[] } {
  const lagna = rc.chart.ascendant.sign;
  const votes = new Map<Tag, Set<string>>();
  const indicators: string[] = [];
  const vote = (tags: Tag[], by: string) => {
    for (const t of tags) {
      if (!votes.has(t)) votes.set(t, new Set());
      votes.get(t)!.add(by);
    }
  };
  const l10 = SIGN_LORDS[(lagna + 9) % 12];
  const p10 = planet(rc, l10);
  if (p10) {
    const by = `the 10th lord in the ${ord(p10.house)}`;
    vote(HOUSE_TAGS[p10.house - 1], by);
    vote(PLANET_TAGS[l10], `${name(l10)} as 10th lord`);
    indicators.push(by);
  }
  for (const p of rc.chart.planets.filter((x) => x.house === 10)) { vote(PLANET_TAGS[p.id], `${name(p.id)} in the 10th`); indicators.push(`${name(p.id)} in the 10th`); }
  // Clusters of three or more planets shape the working life too.
  for (let h = 1; h <= 12; h++) {
    const occ = rc.chart.planets.filter((x) => x.house === h && x.id !== "Ke");
    if (occ.length >= 3) { vote(HOUSE_TAGS[h - 1], `the ${ord(h)}-house cluster`); indicators.push(`the ${ord(h)}-house cluster`); }
  }
  const ra = planet(rc, "Ra");
  if (ra && [1, 3, 6, 7, 10, 11, 12].includes(ra.house)) { vote([...HOUSE_TAGS[ra.house - 1].slice(0, 2), "tech"], `Rahu in the ${ord(ra.house)}`); indicators.push(`Rahu in the ${ord(ra.house)}`); }
  if (rc.jaimini) {
    const amk = rc.jaimini.karakas.AmK;
    const ap = planet(rc, amk);
    vote(PLANET_TAGS[amk], `${name(amk)} as Amatyakaraka`);
    if (ap) vote(HOUSE_TAGS[ap.house - 1].slice(0, 2), `the Amatyakaraka in the ${ord(ap.house)}`);
    indicators.push(`${name(amk)} as Amatyakaraka`);
  }
  const mo = planet(rc, "Mo");
  if (mo) { const m10 = SIGN_LORDS[(mo.sign + 9) % 12]; vote(PLANET_TAGS[m10].slice(0, 2), `${name(m10)} ruling the 10th from the Moon`); }
  if (rc.vargas) {
    const d10 = rc.vargas.charts.D10;
    vote(PLANET_TAGS[SIGN_LORDS[d10.ascendant]].slice(0, 2), "the D10 Lagna lord");
    for (const p of d10.positions.filter((x) => ((x.sign - d10.ascendant + 12) % 12) + 1 === 10)) vote(PLANET_TAGS[p.id].slice(0, 2), `${name(p.id)} in the D10 10th`);
  }
  if (rc.shadbala) vote(PLANET_TAGS[rc.shadbala.strongest].slice(0, 2), `${name(rc.shadbala.strongest)} as the strongest planet`);

  const tags = [...votes.entries()]
    .map(([tag, by]) => ({ tag, by: [...by] }))
    .filter((t) => t.by.length >= 2)
    .sort((a, b) => b.by.length - a.by.length)
    .slice(0, 7);
  return { tags, indicators };
}

function jobOrBusiness(rc: ReadingContext): string {
  const lagna = rc.chart.ascendant.sign;
  let job = 0;
  let biz = 0;
  const why: string[] = [];
  const a10 = rc.jaimini ? houseOfSign(rc, rc.jaimini.padas[9]) : null;
  if (a10 === 6) { job += 2; why.push("A10 in the 6th"); }
  else if (a10 === 7 || a10 === 1) { biz += 1.5; why.push(`A10 in the ${ord(a10)}`); }
  const ll = planet(rc, SIGN_LORDS[lagna]);
  if (ll?.house === 6 || ll?.house === 10) { job += 1.5; why.push(`the Lagna lord in the ${ord(ll.house)}`); }
  else if (ll && (ll.house === 7 || ll.house === 1)) { biz += 1.5; why.push(`the Lagna lord in the ${ord(ll.house)}`); }
  const l10 = planet(rc, SIGN_LORDS[(lagna + 9) % 12]);
  if (l10?.house === 7) { biz += 1.5; why.push("the 10th lord in the 7th"); }
  else if (l10?.house === 6) { job += 1; why.push("the 10th lord in the 6th"); }
  else if (l10 && [8, 12].includes(l10.house)) { job += 0.5; }
  const h7 = houseState(rc, 7).grade;
  const h6 = houseState(rc, 6).grade;
  if (h7 === "strong") { biz += 1; why.push("a strong 7th"); }
  if (h6 === "strong") { job += 1; why.push("a strong 6th"); }
  const me = planetState(rc, "Me");
  const mp = planet(rc, "Me");
  if (me.grade === "strong" && mp && KENDRA.includes(mp.house)) { biz += 0.7; why.push("a strong Mercury in a kendra"); }
  const amk = rc.jaimini ? planet(rc, rc.jaimini.karakas.AmK) : undefined;
  const amkLater = amk && amk.house === 7 ? ` With ${name(amk.id)} as Amatyakaraka in the 7th, a client-facing role or a partner-run firm can work later.` : "";
  const by = why.length ? `${cap(joinAnd(why.slice(0, 3)))} ` : "";
  if (job - biz >= 1.5) return `${by}favour${why.length === 1 ? "s" : ""} employment or a service-based business (consultancy, contracting) over pure trading.${amkLater}`;
  if (biz - job >= 1.5) return `${by}favour${why.length === 1 ? "s" : ""} your own business, a practice or a partnership over a salaried ladder.${amkLater}`;
  return `${by ? `${by}pull both ways: ` : ""}a hybrid suits best — salaried work that builds toward your own practice, or a business anchored by one steady client.${amkLater}`;
}

/** The career evidence, weighed. Shared by the reading part and the career card. */
export function careerFactors(rc: ReadingContext): Factor[] {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const l10 = SIGN_LORDS[(lagna + 9) % 12];
  const p10 = planet(rc, l10);
  let f: Factor[] = houseState(rc, 10).factors;
  // The 10th lord's house, in career terms.
  if (p10) {
    f = retext(f, (x) => x.short.startsWith("lord in") || x.short === "Vipareeta placement", () => `The 10th lord sits in the ${ord(p10.house)}: ${TENTH_LORD_IN[p10.house - 1]}.`);
    if (![6, 8, 12, 10].includes(p10.house) && ![1, 4, 5, 7, 9, 11].includes(p10.house)) f.push({ text: `The 10th lord sits in the ${ord(p10.house)}: ${TENTH_LORD_IN[p10.house - 1]}.`, w: 0.2, short: `10th lord in the ${ord(p10.house)}` });
  }
  f = [...f];

  // 10th from the Moon.
  const m10 = signFromMoon(rc, 10);
  if (m10 !== null) {
    const s = savOfSign(rc, m10);
    const all = rc.av ? rc.av.sav : [];
    const top = s !== null && all.length && s === Math.max(...all) ? ", the highest in the chart" : "";
    if (s !== null && s >= 30) f.push({ text: `The 10th from the Moon (${SIGNS[m10]}) has SAV ${s}${top}.`, w: 0.8, short: `10th from Moon SAV ${s}` });
    else if (s !== null && s < 25) f.push({ text: `The 10th from the Moon (${SIGNS[m10]}) has only SAV ${s}.`, w: -0.6, short: `10th from Moon SAV ${s}` });
    const ml = SIGN_LORDS[m10];
    const st = planetState(rc, ml);
    if (ml !== l10 && st.grade !== "moderate") f.push({ text: `${name(ml)}, ruling the 10th from the Moon, is ${st.grade}${st.grade === "strong" ? ` (${st.plus.slice(0, 2).join(", ")})` : ` (${st.minus.slice(0, 2).join(", ")})`}.`, w: st.grade === "strong" ? 0.6 : -0.6, short: `Moon-10th lord ${st.grade}` });
  }

  // Karakas of status (Sun) and work (Saturn).
  for (const k of ["Su", "Sa"] as PlanetId[]) {
    const st = planetState(rc, k);
    const label = k === "Su" ? "the karaka of authority" : "the karaka of work";
    if (st.grade === "strong") f.push({ text: `${name(k)}, ${label}, is strong: ${st.plus.slice(0, 2).join(", ")}.`, w: 0.6, short: `${name(k)} strong` });
    else if (st.grade === "weak") f.push({ text: `${name(k)}, ${label}, is weak: ${st.minus.slice(0, 2).join(", ")}.`, w: -0.6, short: `${name(k)} weak` });
  }

  // The Dasamsa.
  if (rc.vargas) {
    const d10 = rc.vargas.charts.D10;
    const hOf = (sign: number) => ((sign - d10.ascendant + 12) % 12) + 1;
    const good: string[] = [];
    const bad: string[] = [];
    let gw = 0;
    let bw = 0;
    for (const p of d10.positions) {
      const h = hOf(p.sign);
      const strongDig = isStrongDignity(p.dignity) || p.dignity === "greatFriend";
      const weakDig = ["enemy", "greatEnemy", "debilitated"].includes(p.dignity);
      const place = h === 1 ? "the D10 Lagna" : `the D10 ${ord(h)}`;
      if (strongDig && (KENDRA.includes(h) || TRIKONA.includes(h) || h === 11)) {
        good.push(`${name(p.id)} is ${DIGNITY_WORD[p.dignity].replace(/^in /, "in ")} in ${place}`);
        gw += 0.6;
      } else if (rc.jaimini?.karakas.AmK === p.id && (h === 10 || h === 1)) {
        good.push(`the Amatyakaraka ${name(p.id)} is in ${place}`);
        gw += 0.6;
      } else if (["Sa", "Ra", "Ke", "Ma"].includes(p.id) && h === 1) {
        bad.push(`${name(p.id)} in the D10 Lagna (${D10_TROUBLE[p.id]})`);
        bw += 0.4;
      } else if ([6, 8, 12].includes(h) && !strongDig) {
        bad.push(`${name(p.id)} in the D10 ${ord(h)} (${D10_TROUBLE[p.id]})`);
        bw += 0.4;
      } else if (weakDig && KENDRA.includes(h)) {
        bad.push(`${name(p.id)} ${DIGNITY_WORD[p.dignity]} in ${place} (${D10_TROUBLE[p.id]})`);
        bw += 0.4;
      }
    }
    if (good.length) f.push({ text: `D10: ${joinAnd(good.slice(0, 3))}.`, w: Math.min(1.4, gw), short: "D10 support" });
    if (bad.length) f.push({ text: `In D10, ${joinAnd(bad.slice(0, 4))}.`, w: -Math.min(1.5, bw), short: "D10 strain" });
  }

  // A10, the career's public image.
  if (rc.jaimini) {
    const a10 = rc.jaimini.padas[9];
    const h = houseOfSign(rc, a10);
    const occ = inSign(rc, a10);
    const ak = rc.jaimini.karakas.AK;
    const ben = occ.filter((id) => ["Ju", "Ve", "Me", "Mo"].includes(id) || planetState(rc, id).grade === "strong");
    const occTxt = occ.length ? ` with ${joinAnd(occ.map((id) => (id === ak ? `the Atmakaraka ${name(id)}` : name(id))))}` : "";
    f.push({
      text: `A10 is in ${SIGNS[a10]} (your ${ord(h)})${occTxt}. Your public image at work is that of ${A10_IMAGE[h - 1]}.`,
      w: ben.length ? 0.6 : occ.length ? -0.2 : 0.2,
      short: `A10 in the ${ord(h)}`,
    });
  }

  // Amatyakaraka.
  if (rc.jaimini) {
    const amk = rc.jaimini.karakas.AmK;
    const st = planetState(rc, amk);
    const ap = planet(rc, amk);
    if (st.grade === "strong") f.push({ text: `The Amatyakaraka ${name(amk)} is strong (${st.plus.slice(0, 2).join(", ")})${ap ? ` in the ${ord(ap.house)}` : ""}: help and advancement come readily.`, w: 1, short: "strong Amatyakaraka" });
    else if (st.grade === "weak") f.push({ text: `The Amatyakaraka ${name(amk)} is weak (${st.minus.slice(0, 2).join(", ")}): advancement depends on your own effort more than on patrons.`, w: -0.8, short: "weak Amatyakaraka" });
  }

  // Status yogas — weighed by the strength of the planets forming them.
  {
    // One bullet for all status yogas; each adds weight by the strength of its planets.
    const seen = new Set<string>();
    const ys = [...rc.yogas, ...rc.extended].filter((x) => STATUS_YOGA(x.key) && !x.key.startsWith("nbrj-") && (seen.has(x.name) ? false : (seen.add(x.name), true))).slice(0, 4);
    if (ys.length) {
      let w = 0;
      const parts = ys.map((y) => {
        const weak = y.planets.filter((id) => planetState(rc, id).grade === "weak");
        w += weak.length ? 0.4 : 0.8;
        return `${y.name}${y.planets.length ? ` (${names(y.planets)}${weak.length ? `; ${names(weak)} weak, so partial` : ""})` : ""}`;
      });
      f.push({ text: `${ys.length > 1 ? "Status yogas present" : "A status yoga is present"}: ${joinAnd(parts)}.`, w: Math.min(2, w), short: ys.length > 1 ? "status yogas" : ys[0].name.replace(/ \(.*\)$/, "") });
    }
  }

  // The Avayogi touching the career.
  if (rc.special) {
    const av = rc.special.yogi.avayogi;
    const p = planet(rc, av);
    const tenthSign = (lagna + 9) % 12;
    if (p && (av === l10 || [10, 11].includes(p.house) || aspectingSign(rc, tenthSign).includes(av) || rc.jaimini?.karakas.AmK === av)) {
      f.push({ text: `${name(av)} is the Avayogi and touches the career, so its periods bring obstacles or misjudged opportunities at work.`, w: -0.5, short: `${name(av)} Avayogi` });
    }
  }
  return f;
}

export function careerPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const l10 = SIGN_LORDS[(lagna + 9) % 12];
  const p10 = planet(rc, l10);
  // Cut-offs from a 400-chart random sample (≈15% strong, 35% good, 35% mixed, 15% weak); see SOURCES.md.
  const j = judge(careerFactors(rc), { strong: 6, good: 2.5, weak: -0.5 });

  // Profession types.
  const prof = professions(rc);
  const profBlock: ReadingSubsection = {
    heading: `Profession types (${joinAnd(prof.indicators.slice(0, 4))} agree on these)`,
    lead: [],
    bullets: prof.tags.map((t) => `${TAG_LABEL[t.tag]} — ${joinAnd(t.by.slice(0, 3))}.`),
  };
  const jb: ReadingSubsection = { heading: "Job vs. business", lead: [jobOrBusiness(rc)], bullets: [] };

  // Verdict.
  const sun = planetState(rc, "Su");
  const sunP = planet(rc, "Su");
  const rajaWith10 = [...rc.yogas, ...rc.extended].some((y) => (y.key.startsWith("raja-") || y.key.startsWith("yk-")) && y.planets.includes(l10));
  const h10 = houseState(rc, 10).grade;
  const level =
    sun.grade === "strong" && rajaWith10 && p10 && ![6, 8, 12].includes(p10.house) && h10 === "strong"
      ? "Top-level authority is within reach."
      : h10 !== "weak" && j.level !== "weak" && j.level !== "mixed"
        ? `Senior-specialist or managerial authority is indicated${sunP && [6, 8, 12].includes(sunP.house) || sun.grade !== "strong" ? " rather than a top political-style position" : ""}.`
        : "Standing is built step by step, through skill and persistence rather than position.";
  const verdictText = `${j.level === "strong" ? "Strong career promise" : j.level === "good" ? "Good career promise" : j.level === "mixed" ? "Mixed career promise" : "The career asks for sustained effort"}. Rise comes through ${p10 ? RISE_BY[p10.house - 1] : "effort"}. ${level}`;
  const fieldConf = prof.tags[0] && prof.tags[0].by.length >= 4 ? "High" : prof.tags[0] && prof.tags[0].by.length >= 3 ? "Medium" : "Low";

  const timing = withTiming && rc.jaimini
    ? topicTiming(rc, {
        anchor: 10,
        houses: [11, 9],
        karakas: [{ id: rc.jaimini.karakas.AmK, label: "the Amatyakaraka" }, { id: "Su", label: "the karaka of authority" }],
        varga: { id: "D10", houses: [1, 10] },
        active: "career activity: a role change, raise, wider responsibility or a new client base",
        pressure: "career pressure: a heavier load, clashes with authority or an unsettled role — keep a low profile",
        fromAge: 18,
      })
    : withTiming
      ? topicTiming(rc, { anchor: 10, houses: [11, 9], karakas: [{ id: "Su", label: "the karaka of authority" }], active: "career activity: a role change, raise or wider responsibility", pressure: "career pressure: a heavier load or clashes with authority", fromAge: 18 })
      : null;

  const subsections = topicSections({
    j,
    blocks: [profBlock, jb],
    verdict: verdictText,
    confidence: confidenceLine(j.confidence, "the strength of the career", { level: fieldConf, about: "the exact field" }),
    timing,
  });

  // ---- The full working, behind the toggle ----------------------------------------
  const detail: ReadingSubsection[] = [];
  detail.push(houseSubsection(rc, 10, `The 10th house: ${SIGNS[(lagna + 9) % 12]}`));
  if (rc.vargas) {
    const d10 = rc.vargas.charts.D10;
    const tl = vargaPos(rc, l10, "D10");
    detail.push({
      heading: `The Dasamsa (D10): ${SIGNS[d10.ascendant]} rising`,
      lead: [`${cap(article(SIGN_TONE[d10.ascendant]))} D10 Lagna gives ${article(SIGN_TONE[d10.ascendant])} style at work.`],
      bullets: [
        ...(tl ? [`The 10th lord ${name(l10)} is ${DIGNITY_WORD[tl.dignity]} in the D10 (${SIGNS[tl.sign]}, its ${ord(((tl.sign - d10.ascendant + 12) % 12) + 1)}).`] : []),
        ...d10.positions.map((p) => `${name(p.id)}: ${SIGNS[p.sign]}, D10 ${ord(((p.sign - d10.ascendant + 12) % 12) + 1)}, ${DIGNITY_WORD[p.dignity]}.`),
      ],
    });
  }
  if (rc.jaimini) {
    const amk = rc.jaimini.karakas.AmK;
    const p = planet(rc, amk);
    if (p) {
      const st = planetState(rc, amk);
      detail.push({
        heading: `Amatyakaraka: ${name(amk)} in ${SIGNS[p.sign]} in the ${ord(p.house)} house`,
        lead: [`${name(amk)} is at ${deg(p.longitude)} ${SIGNS[p.sign]} (${nakOf(p.longitude).name})${ratio(rc, amk) !== null ? `, Shadbala ${fmtRatio(ratio(rc, amk)!)}` : ""}; condition ${st.grade}.`],
        bullets: [
          `It favours ${CAREER_FIELDS[amk].fields}.`,
          ...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []),
          ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : []),
        ],
      });
    }
  }
  {
    const st = p10 ? planetState(rc, l10) : null;
    if (st && p10) {
      detail.push({
        heading: `The 10th lord: ${whoEnd(rc, l10)}`,
        lead: [`At ${deg(p10.longitude)} ${SIGNS[p10.sign]} (${nakOf(p10.longitude).name}) in the ${ord(p10.house)}; condition ${st.grade}.`],
        bullets: [
          ...(st.plus.length ? [`In its favour: ${st.plus.join(", ")}.`] : []),
          ...(st.minus.length ? [`Against it: ${st.minus.join(", ")}.`] : []),
          UPACHAYA.includes(p10.house) ? "An upachaya placement: results grow with time and effort." : "",
        ].filter(Boolean),
      });
    }
  }
  {
    const report = buildCareerReport(chart, rc.vargas, rc.jaimini, rc.shadbala, rc.strengths, rc.yogas, { extended: rc.extended, special: rc.special });
    const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
    const usedWhy = new Set<string>();
    detail.push({
      heading: "Planet-by-planet career votes",
      lead: ["Each direction below collects votes from the 10th lord (from the Lagna, Moon and Sun), occupants of the 10th, the D10 and the Amatyakaraka. It shows which planets the career runs through; the verdict above weighs how strong they are."],
      bullets: items.slice(0, 4).map((it, i) => {
        const why = [...it.reasons].sort((a, b) => b.weight - a.weight).map((r) => compactPoint(r.text).replace(/\.$/, "")).filter((t) => !usedWhy.has(t)).slice(0, 2);
        why.forEach((t) => usedWhy.add(t));
        return `${i + 1}. ${it.label}${why.length ? ` — ${joinAnd(why)}` : ""}.`;
      }),
    });
    const ys = [...rc.yogas, ...rc.extended].filter((y) => STATUS_YOGA(y.key));
    if (ys.length) detail.push({ heading: "Yogas for status", lead: [], bullets: ys.map((y) => `${y.name}${y.planets.length ? ` (${names(y.planets)})` : ""}: ${sentences(y.description, 1)[0]}`) });
  }

  return {
    key: "career",
    number: 2,
    title: "Career",
    subsections,
    detail,
    verdict: { word: VERDICT_WORD[j.level], confidence: j.confidence },
    summary: [verdictText],
  };
}
