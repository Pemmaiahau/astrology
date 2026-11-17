import { aspectedSigns, naturalBenefics } from "@/utils/astrology/aspects";
import { SIGN_LORDS } from "@/utils/astrology/constants";
import type { Dignity, PlanetId } from "@/utils/astrology/types";
import { functionalRole, type FunctionalRole } from "../synthesis";
import {
  avasthaOf, bhavaRupas, DIGNITY_WORD, fmtRatio, houseSign, isGandanta, isVargottama, joinAnd, lordOf, name, names, nakOf,
  ord, owned, planet, ratio, ratioRanking, sav, SIGNS, vargaPos, type ReadingContext,
} from "./context";

/**
 * The judgement layer of the chart reading.
 *
 * A placement never speaks for itself in Parashari astrology: a lord in the
 * 8th is read one way when it is strong, dignified and aspected by benefics,
 * and another way when it is weak, combust and hemmed in by malefics. This
 * module weighs those conditions into two verdicts the topic parts share:
 *
 *   planetState — dignity, Shadbala ratio, Navamsa dignity, vargottama,
 *                 combustion, planetary war, Baladi avastha, sign junction
 *                 (sandhi), gandanta, Drik Bala (aspects received), nodal
 *                 conjunction, Yogi/Avayogi, Neecha Bhanga.
 *   houseState  — Bhava Bala (with rank), SAV (with rank), the lord's
 *                 condition and placement, occupants and aspects weighed by
 *                 natural AND functional nature and by the aspecting planet's
 *                 own strength, directional strength, Argala/Virodha and
 *                 Shubha/Papa Kartari.
 *
 * Every factor is a sentence plus a signed weight (positive supports, negative
 * opposes), so the topic parts can list "Supporting" and "Opposing" evidence
 * and reach a verdict from the balance instead of from a single placement.
 * The weights are a modern synthesis — no classical text assigns numbers to
 * these rules — and are calibrated on a random chart sample (see SOURCES.md).
 */

export interface Factor {
  /** Full sentence for the Supporting / Opposing lists. */
  text: string;
  /** Signed weight: > 0 supports, < 0 opposes. */
  w: number;
  /** Two-to-four-word label for compact rows. */
  short: string;
}

export type Grade = "strong" | "moderate" | "weak";

export interface PlanetState {
  id: PlanetId;
  grade: Grade;
  score: number;
  role: FunctionalRole;
  plus: string[];
  minus: string[];
}

const DIGNITY_SCORE: Record<Dignity, number> = {
  exalted: 3, moolatrikona: 2.5, own: 2, greatFriend: 1.2, friend: 0.6, neutral: 0, enemy: -0.8, greatEnemy: -1.4, debilitated: -3,
};

/** Kendras where each graha gains Dig Bala (directional strength). */
const DIG_HOUSE: Partial<Record<PlanetId, number>> = { Ju: 1, Me: 1, Mo: 4, Ve: 4, Sa: 7, Su: 10, Ma: 10 };

export const KENDRA = [1, 4, 7, 10];
export const TRIKONA = [1, 5, 9];
export const DUSTHANA = [6, 8, 12];
export const UPACHAYA = [3, 6, 10, 11];

const cache = new WeakMap<ReadingContext, Map<string, unknown>>();
function memo<T>(rc: ReadingContext, key: string, f: () => T): T {
  let m = cache.get(rc);
  if (!m) cache.set(rc, (m = new Map()));
  if (!m.has(key)) m.set(key, f());
  return m.get(key) as T;
}

export function roleOf(rc: ReadingContext, id: PlanetId): FunctionalRole {
  return functionalRole(id, rc.chart.ascendant.sign);
}

/** "Mars, the yogakaraka (5th and 10th lord)," — who a planet is for this Lagna, as the subject of a clause (trailing comma included). */
export function who(rc: ReadingContext, id: PlanetId): string {
  const hs = owned(rc, id);
  const role = roleOf(rc, id);
  if (!hs.length) return name(id);
  const lords = `${joinAnd(hs.map(ord))} lord`;
  if (role === "yogakaraka") return `${name(id)}, the yogakaraka (${lords}),`;
  if (hs.includes(1)) return `${name(id)}, the Lagna lord${hs.length > 1 ? ` (also ${joinAnd(hs.filter((h) => h !== 1).map(ord))} lord)` : ""},`;
  return `${name(id)}, the ${lords},`;
}

/** `who` without the closing comma, for the end of a clause. */
export function whoEnd(rc: ReadingContext, id: PlanetId): string {
  return who(rc, id).replace(/,$/, "");
}

// ---------------------------------------------------------------------------
// Planet condition
// ---------------------------------------------------------------------------

export function planetState(rc: ReadingContext, id: PlanetId): PlanetState {
  return memo(rc, `p:${id}`, () => computePlanetState(rc, id));
}

function computePlanetState(rc: ReadingContext, id: PlanetId): PlanetState {
  const p = planet(rc, id);
  const role = roleOf(rc, id);
  if (!p) return { id, grade: "moderate", score: 0, role, plus: [], minus: [] };
  const plus: string[] = [];
  const minus: string[] = [];
  let score = 0;
  const node = id === "Ra" || id === "Ke";

  // Sign dignity, with Neecha Bhanga repairing a debilitation.
  const nb = rc.yogas.some((y) => y.key === `nbrj-${id}`);
  score += DIGNITY_SCORE[p.dignity];
  if (p.dignity === "debilitated" && nb) {
    score += 2.5;
    minus.push(`debilitated in ${SIGNS[p.sign]}, though the debilitation is cancelled (Neecha Bhanga)`);
  } else if (DIGNITY_SCORE[p.dignity] >= 1.2) plus.push(`${DIGNITY_WORD[p.dignity]} (${SIGNS[p.sign]})`);
  else if (DIGNITY_SCORE[p.dignity] < 0) minus.push(`${DIGNITY_WORD[p.dignity]} (${SIGNS[p.sign]})`);

  // Shadbala ratio and rank.
  const r = ratio(rc, id);
  if (r !== null) {
    const rank = ratioRanking(rc);
    const tag = rank[0] === id ? `the strongest planet by Shadbala (${fmtRatio(r)})` : rank[rank.length - 1] === id ? `the weakest planet by Shadbala (${fmtRatio(r)})` : `Shadbala ${fmtRatio(r)}`;
    if (r >= 1.3) { score += 1.5; plus.push(tag); }
    else if (r >= 1.1) { score += 0.8; plus.push(tag); }
    else if (r >= 1) { score += 0.2; if (rank[0] === id) plus.push(tag); }
    else if (r >= 0.8) { score -= 1; minus.push(r < 1 && rank[rank.length - 1] !== id ? `below its Shadbala requirement (${fmtRatio(r)})` : tag); }
    else { score -= 2; minus.push(rank[rank.length - 1] === id ? tag : `well below its Shadbala requirement (${fmtRatio(r)})`); }
  }

  if (p.combust && !node && id !== "Su") { score -= 1.5; minus.push("combust"); }
  if (p.warWith) {
    if (p.warWinner) { score += 0.4; plus.push(`wins its planetary war with ${name(p.warWith)}`); }
    else { score -= 1.5; minus.push(`loses its planetary war with ${name(p.warWith)}`); }
  }
  if (p.retrograde && !node) { score += 0.3; plus.push("retrograde (high Cheshta Bala)"); }

  // The Navamsa: the classical test of whether a D1 promise holds up.
  const d9 = vargaPos(rc, id, "D9");
  if (isVargottama(rc, id)) { score += 1; plus.push("vargottama"); }
  else if (d9) {
    if (["exalted", "moolatrikona", "own"].includes(d9.dignity)) { score += 1; plus.push(`${DIGNITY_WORD[d9.dignity]} in the Navamsa`); }
    else if (d9.dignity === "debilitated") { score -= 1.2; minus.push("debilitated in the Navamsa"); }
  }

  // Nakshatra, avastha, junctions.
  const n = nakOf(p.longitude);
  if (n.lord === id && !node) { score += 0.3; plus.push(`in its own nakshatra (${n.name})`); }
  const d = p.longitude % 30;
  if (!node && (d < 1 || d > 29)) { score -= 0.8; minus.push(`at a sign junction (${d.toFixed(1)}° ${SIGNS[p.sign]})`); }
  else if (!node) {
    const av = avasthaOf(rc, id);
    if (av && /^Mrita/.test(av.baladi.state)) { score -= 0.6; minus.push("in Mrita avastha (a \"dead\" degree, meagre results)"); }
    else if (av && /^Yuva/.test(av.baladi.state)) { score += 0.3; plus.push("in Yuva avastha (full results)"); }
  }
  if (isGandanta(p.longitude)) { score -= 0.8; minus.push("in gandanta"); }

  // Aspects received: Drik Bala where Shadbala exists, otherwise the sign aspects.
  const aspecters = rc.chart.planets
    .filter((q) => q.id !== id && q.sign !== p.sign && !(node && (q.id === "Ra" || q.id === "Ke")) && aspectedSigns(q.id, q.sign).includes(p.sign))
    .map((q) => q.id);
  const ben = naturalBenefics(rc.chart);
  const malAsp = aspecters.filter((a) => !ben.includes(a));
  const benAsp = aspecters.filter((a) => ben.includes(a));
  const drik = !node && rc.shadbala ? rc.shadbala.planets[id as keyof typeof rc.shadbala.planets]?.drik[0]?.virupas ?? null : null;
  if (drik !== null && drik <= -8 && malAsp.length) { score -= 0.8; minus.push(`aspected by ${names(malAsp)} (Drik Bala ${drik.toFixed(1)})`); }
  else if (drik !== null && drik >= 8 && benAsp.length) { score += 0.6; plus.push(`aspected by ${names(benAsp)} (Drik Bala +${drik.toFixed(1)})`); }
  else if (drik === null) {
    if (malAsp.length > benAsp.length && malAsp.length >= 2) { score -= 0.6; minus.push(`aspected by ${names(malAsp)}`); }
    else if (benAsp.includes("Ju") && !malAsp.length) { score += 0.5; plus.push("aspected by Jupiter"); }
  }

  // Nodal conjunction (eclipse-type affliction), within 12°.
  if (!node) {
    for (const nd of ["Ra", "Ke"] as PlanetId[]) {
      const q = planet(rc, nd);
      if (q && q.sign === p.sign && Math.abs((q.longitude % 30) - d) <= 12) { score -= 0.7; minus.push(`closely joined by ${name(nd)}`); }
    }
  }

  // Nodes: upachaya placement is their best use.
  if (node && UPACHAYA.includes(p.house)) { score += 1; plus.push(`in the ${ord(p.house)}, an upachaya house where the nodes do well`); }
  if (node && DUSTHANA.includes(p.house) && p.house !== 6) { score -= 0.5; minus.push(`in the ${ord(p.house)}, a dusthana`); }

  // Yogi / Avayogi.
  if (rc.special) {
    if (rc.special.yogi.avayogi === id) { score -= 0.5; minus.push("the Avayogi (the chart's obstructing planet)"); }
    if (rc.special.yogi.yogi === id) { score += 0.5; plus.push("the Yogi (the chart's luck-bringing planet)"); }
  }

  const grade: Grade = score >= 2 ? "strong" : score <= -1 ? "weak" : "moderate";
  return { id, grade, score, role, plus, minus };
}

/** "strong — own sign, Shadbala 1.44×, own nakshatra" for a compact mention. */
export function stateTag(st: PlanetState, max = 3): string {
  const facts = st.grade === "weak" ? [...st.minus, ...st.plus] : [...st.plus, ...st.minus];
  return `${st.grade}${facts.length ? ` — ${facts.slice(0, max).join(", ")}` : ""}`;
}

// ---------------------------------------------------------------------------
// House condition
// ---------------------------------------------------------------------------

export interface HouseState {
  house: number;
  grade: "strong" | "mixed" | "weak";
  net: number;
  factors: Factor[];
}

export function houseState(rc: ReadingContext, house: number): HouseState {
  return memo(rc, `h:${house}`, () => computeHouseState(rc, house));
}

/** Weight of a planet's influence (by occupation or aspect) on a house. */
function influenceWeight(rc: ReadingContext, id: PlanetId, house: number, mode: "occupies" | "aspects"): number {
  const ben = naturalBenefics(rc.chart);
  const st = planetState(rc, id);
  const role = st.role;
  let w: number;
  if (id === "Ju") w = 1.5;
  else if (ben.includes(id)) w = 1;
  else if (id === "Sa") w = -1;
  else if (id === "Ma" || id === "Ra") w = -0.8;
  else if (id === "Ke") w = -0.6;
  else w = -0.4; // Sun, or a malefic-associated Mercury / waning Moon
  // Natural malefics help the growth houses (3, 6, 11) and the nodes the upachayas.
  if (w < 0 && [3, 6, 11].includes(house)) w = 0.5;
  if (w < 0 && (id === "Ra" || id === "Ke") && house === 10) w = 0.3;
  // Functional nature for this Lagna.
  if (role === "yogakaraka") w += 1;
  else if (role === "benefic") w += 0.5;
  else if (role === "malefic") w -= 0.5;
  // A planet guarding its own house protects it.
  if (owned(rc, id).includes(house)) w = Math.max(w, 0) + 1;
  // The planet's own strength scales a helpful influence; a weak helper helps less.
  if (w > 0) w *= st.grade === "strong" ? 1.2 : st.grade === "weak" ? 0.6 : 1;
  if (mode === "occupies") w *= 1.2;
  return Math.round(w * 10) / 10;
}

function computeHouseState(rc: ReadingContext, house: number): HouseState {
  const factors: Factor[] = [];
  const sign = houseSign(rc, house);
  const H = `the ${ord(house)}`;

  // Bhava Bala with its rank.
  const bb = bhavaRupas(rc, house);
  if (bb !== null && rc.bhavaBala) {
    const rank = [...rc.bhavaBala].sort((a, b) => b.rupas - a.rupas).findIndex((b) => b.house === house) + 1;
    if (rank === 1) factors.push({ text: `${cap1(H)} is the strongest house in the chart (Bhava Bala ${bb.toFixed(2)}, rank 1).`, w: 1.5, short: "strongest Bhava Bala" });
    else if (rank <= 3) factors.push({ text: `${cap1(H)} is among the strongest houses (Bhava Bala ${bb.toFixed(2)}, rank ${rank} of 12).`, w: 0.8, short: `Bhava Bala rank ${rank}` });
    else if (rank >= 10) factors.push({ text: `${cap1(H)} is among the weakest houses (Bhava Bala ${bb.toFixed(2)}, rank ${rank} of 12).`, w: -0.8, short: `Bhava Bala rank ${rank}` });
  }

  // Sarvashtakavarga with its rank.
  const s = sav(rc, house);
  if (s !== null && rc.av) {
    const all = Array.from({ length: 12 }, (_, i) => sav(rc, i + 1)!);
    const top = s === Math.max(...all) ? ", the highest in the chart" : "";
    const low = s === Math.min(...all) ? ", the lowest in the chart" : "";
    if (s >= 30) factors.push({ text: `${cap1(H)} has SAV ${s}${top} — well above the average of 28.`, w: s >= 34 ? 1.2 : 0.8, short: `SAV ${s}` });
    else if (s >= 28) factors.push({ text: `${cap1(H)} has SAV ${s}, only average.`, w: -0.3, short: `SAV ${s} (average)` });
    else if (s >= 25) factors.push({ text: `${cap1(H)} has SAV ${s}${low}, below the average of 28.`, w: -0.7, short: `SAV ${s}` });
    else factors.push({ text: `${cap1(H)} has SAV ${s}${low} — well below average.`, w: -1.2, short: `SAV ${s}` });
  }

  // The lord: its condition and its placement.
  const lord = lordOf(rc, house);
  const lp = planet(rc, lord);
  if (lp) {
    const st = planetState(rc, lord);
    const lordName = who(rc, lord);
    if (st.grade === "strong") factors.push({ text: `Its lord ${lordName} is strong: ${st.plus.slice(0, 3).join(", ")}.`, w: 1.5, short: `strong lord ${name(lord)}` });
    else if (st.grade === "weak") factors.push({ text: `Its lord ${lordName} is weak: ${st.minus.slice(0, 3).join(", ")}.`, w: -1.5, short: `weak lord ${name(lord)}` });
    if (lp.house === house) factors.push({ text: `The lord ${name(lord)} occupies its own house, guarding it.`, w: 1.2, short: "lord in own house" });
    else if (DUSTHANA.includes(lp.house)) {
      if (DUSTHANA.includes(house)) factors.push({ text: `The ${ord(house)} lord in the ${ord(lp.house)} — a dusthana lord in a dusthana — forms Vipareeta Raja Yoga: difficulty turns into gain.`, w: 1, short: "Vipareeta placement" });
      else factors.push({ text: `The ${ord(house)} lord ${name(lord)} sits in the ${ord(lp.house)}, a dusthana${st.grade === "strong" ? "; being strong, it still delivers, but through effort, upheaval or hidden channels" : ""}.`, w: st.grade === "strong" ? -0.8 : -1.5, short: `lord in the ${ord(lp.house)}` });
    } else if ([1, 4, 5, 7, 9, 10].includes(lp.house)) factors.push({ text: `The ${ord(house)} lord ${name(lord)} sits in the ${ord(lp.house)}, a ${TRIKONA.includes(lp.house) ? "trikona" : "kendra"} — well placed.`, w: 0.8, short: `lord in the ${ord(lp.house)}` });
    else if (lp.house === 11) factors.push({ text: `The ${ord(house)} lord ${name(lord)} sits in the 11th, the house of gains.`, w: 0.5, short: "lord in the 11th" });
  }

  // Occupants.
  for (const q of rc.chart.planets.filter((x) => x.house === house)) {
    const w = influenceWeight(rc, q.id, house, "occupies");
    const dig = DIG_HOUSE[q.id] === house;
    const st = planetState(rc, q.id);
    const cond = st.grade === "strong" ? `, strong (${st.plus.slice(0, 2).join(", ")})` : st.grade === "weak" ? `, weak (${st.minus.slice(0, 2).join(", ")})` : "";
    if (w !== 0) factors.push({ text: `${who(rc, q.id)} occupies ${H}${cond}.`, w, short: `${name(q.id)} in it` });
    if (dig) factors.push({ text: `${name(q.id)} has directional strength (Dig Bala) in ${H}.`, w: 0.7, short: `${name(q.id)} Dig Bala` });
  }

  // Aspects.
  for (const q of rc.chart.planets.filter((x) => x.sign !== sign && aspectedSigns(x.id, x.sign).includes(sign))) {
    const w = influenceWeight(rc, q.id, house, "aspects");
    if (w === 0) continue;
    const own = owned(rc, q.id).includes(house);
    factors.push({ text: `${who(rc, q.id)} aspects ${H}${own ? ", protecting its own house" : ""}.`, w, short: `${name(q.id)}'s aspect` });
  }

  // Argala (Jaimini intervention) and its obstruction.
  if (rc.jaimini) {
    const a = rc.jaimini.argala[house - 1];
    if (a.intervening.length && a.intervening.length > a.obstructing.length) {
      factors.push({
        text: `Argala on ${H} comes from ${names(a.intervening)}${a.obstructing.length ? `. Only ${names(a.obstructing)} ${a.obstructing.length > 1 ? "obstruct" : "obstructs"} it` : ", unobstructed"}.`,
        w: 0.8, short: "Argala support",
      });
    } else if (a.intervening.length && a.obstructing.length >= a.intervening.length) {
      factors.push({ text: `Argala on ${H} from ${names(a.intervening)} is blocked by ${names(a.obstructing)} (Virodha Argala).`, w: -0.5, short: "Argala blocked" });
    }
  }

  // Kartari: hemmed in on both sides.
  {
    const ben = naturalBenefics(rc.chart);
    const before = rc.chart.planets.filter((x) => x.sign === (sign + 11) % 12).map((x) => x.id);
    const after = rc.chart.planets.filter((x) => x.sign === (sign + 1) % 12).map((x) => x.id);
    if (before.length && after.length) {
      if ([...before, ...after].every((id) => !ben.includes(id))) factors.push({ text: `${cap1(H)} is hemmed in by malefics on both sides (Papa Kartari: ${names(before)} behind, ${names(after)} ahead).`, w: -1, short: "Papa Kartari" });
      else if ([...before, ...after].every((id) => ben.includes(id))) factors.push({ text: `${cap1(H)} is flanked by benefics on both sides (Shubha Kartari: ${names(before)} and ${names(after)}).`, w: 1, short: "Shubha Kartari" });
    }
  }

  const net = factors.reduce((t, f) => t + f.w, 0);
  return { house, grade: net >= 2.5 ? "strong" : net <= -1.5 ? "weak" : "mixed", net, factors };
}

function cap1(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Factors split for listing, strongest first; duplicates removed. */
export function split(factors: Factor[]): { support: Factor[]; oppose: Factor[] } {
  const seen = new Set<string>();
  const uniq = factors.filter((f) => (seen.has(f.text) ? false : (seen.add(f.text), true)));
  return {
    support: uniq.filter((f) => f.w > 0).sort((a, b) => b.w - a.w),
    oppose: uniq.filter((f) => f.w < 0).sort((a, b) => a.w - b.w),
  };
}

// ---------------------------------------------------------------------------
// Verdict and confidence
// ---------------------------------------------------------------------------

export type VerdictLevel = "strong" | "good" | "mixed" | "weak";

export const VERDICT_WORD: Record<VerdictLevel, string> = {
  strong: "Strong promise",
  good: "Good promise",
  mixed: "Mixed promise",
  weak: "Weak promise",
};

export interface Judgement {
  level: VerdictLevel;
  net: number;
  confidence: "High" | "Medium" | "Low";
  support: Factor[];
  oppose: Factor[];
}

/**
 * The balance of a topic's evidence. `net` is the signed sum; confidence is
 * how one-sided the evidence is (|net| over the total weight) — a chart where
 * every layer agrees earns High, an even split earns Low.
 */
export function judge(factors: Factor[], cut = { strong: 6, good: 2, weak: -2 }): Judgement {
  const { support, oppose } = split(factors);
  const all = [...support, ...oppose];
  const net = all.reduce((t, f) => t + f.w, 0);
  const total = all.reduce((t, f) => t + Math.abs(f.w), 0) || 1;
  const agreement = Math.abs(net) / total;
  const level: VerdictLevel = net >= cut.strong ? "strong" : net >= cut.good ? "good" : net > cut.weak ? "mixed" : "weak";
  // A mixed verdict is itself a finding: with plenty of evidence on both
  // sides it is held with medium confidence, not low.
  let confidence: Judgement["confidence"] =
    all.length < 4 ? "Low" : agreement >= 0.4 ? "High" : agreement >= 0.15 || (level === "mixed" && all.length >= 8) ? "Medium" : "Low";
  // A chart sitting right where the verdict changes direction (good ↔ mixed,
  // mixed ↔ weak) is held less firmly; the strong/good line does not flip the
  // direction, so it does not cost confidence.
  const edge = Math.min(Math.abs(net - cut.good), Math.abs(net - cut.weak));
  if (edge < 0.8) confidence = confidence === "High" ? "Medium" : "Low";
  return { level, net, confidence, support, oppose };
}

/** A house's Moon-chart counterpart: the same house counted from the Moon. */
export function signFromMoon(rc: ReadingContext, house: number): number | null {
  const mo = planet(rc, "Mo");
  return mo ? (mo.sign + house - 1) % 12 : null;
}

/** SAV of an arbitrary sign. */
export function savOfSign(rc: ReadingContext, sign: number): number | null {
  return rc.av ? rc.av.sav[sign] : null;
}

/** Whole-sign house (from the Lagna) of a sign. */
export function houseOfSign(rc: ReadingContext, sign: number): number {
  return ((sign - rc.chart.ascendant.sign + 12) % 12) + 1;
}

/** Planets in a sign. */
export function inSign(rc: ReadingContext, sign: number): PlanetId[] {
  return rc.chart.planets.filter((p) => p.sign === sign).map((p) => p.id);
}

/** Planets aspecting a sign (occupants excluded). */
export function aspectingSign(rc: ReadingContext, sign: number): PlanetId[] {
  return rc.chart.planets.filter((p) => p.sign !== sign && aspectedSigns(p.id, p.sign).includes(sign)).map((p) => p.id);
}

export { SIGN_LORDS };
