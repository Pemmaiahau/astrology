import { aspectedSigns } from "@/utils/astrology/aspects";
import { SIGNS } from "@/utils/astrology/constants";
import { activeDashaAt } from "@/utils/astrology/dasha";
import { occupancyIntervals, siderealLongitudeAt } from "@/utils/astrology/scan";
import { currentPhase, sadeSatiPeriods } from "@/utils/astrology/sadeSati";
import type { DashaPeriod, PlanetId } from "@/utils/astrology/types";
import type { VargaId } from "@/utils/astrology/varga";
import type { CharaPeriod } from "@/utils/astrology/charaDasha";
import type { YoginiPeriod } from "@/utils/astrology/yogini";
import { HOUSE_GOVERNS } from "../significations";
import { houseOfSign, planetState, DUSTHANA } from "./judge";
import { houseSign, joinAnd, lordOf, name, ord, owned, planet, vargaPos, type ReadingContext } from "./context";

/**
 * Topic timing — "Past / Now / Ahead" — read the way an astrologer reads it:
 *
 *   1. Vimshottari: which Mahadasha and Antardasha lords are tied to the topic
 *      (lord of its anchor house, occupant, aspect, karaka, the topic's own
 *      varga), and whether that lord is strong enough to deliver.
 *   2. Chara dasha and Yogini dasha as independent confirmations — a period
 *      that two or three systems point to is the one to trust.
 *   3. Slow transits: Saturn and Jupiter together on the anchor sign (the
 *      double transit), and the nodes entering it or crossing a natal karaka.
 *
 * Nothing here recomputes a dasha or an ephemeris; it reads the trees the
 * chart context already holds and the existing transit scan.
 */

export interface TimingSpec {
  /** The topic's anchor house (10 for career, 7 for marriage). */
  anchor: number;
  /** Secondary houses that also carry the topic. */
  houses: number[];
  karakas: { id: PlanetId; label: string }[];
  /** Extra sensitive signs (the Upapada, an arudha). */
  signs?: { sign: number; label: string }[];
  /** The topic's divisional chart and the varga houses that matter. */
  varga?: { id: VargaId; houses: number[] };
  /** "career activity: a role change, raise, wider responsibility or new client base". */
  active: string;
  /** "pressure at work: heavier load and friction with seniors". */
  pressure: string;
  /** Signs watched for the Saturn–Jupiter double transit (default: anchor sign). */
  transitSigns?: { sign: number; label: string }[];
  /** Signs where Jupiter's own transit (without Saturn) is worth naming. */
  jupiterOver?: { sign: number; label: string }[];
  /** Natal planets whose degree Rahu/Ketu crossing is worth naming. */
  nodeTargets?: PlanetId[];
  /** Earliest age worth narrating in "Past" (default 16). */
  fromAge?: number;
}

const YEAR = 365.25 * 86400000;
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const yr = (d: Date) => d.getUTCFullYear();
const span = (a: Date, b: Date) => `${yr(a)}–${String(yr(b)).slice(yr(a) === yr(b) ? 0 : 2)}`;
const range = (a: Date, b: Date) => `${fmt(a)} – ${fmt(b)}`;

interface Relevance {
  score: number;
  tags: string[];
  tone: "strong" | "active" | "pressure";
}

export function relevance(rc: ReadingContext, spec: TimingSpec, id: PlanetId): Relevance {
  const tags: string[] = [];
  let score = 0;
  const p = planet(rc, id);
  const hs = owned(rc, id);
  if (lordOf(rc, spec.anchor) === id) { score += 3; tags.push(spec.anchor === 1 ? "the Lagna lord" : `the ${ord(spec.anchor)} lord`); }
  const other = spec.houses.filter((h) => lordOf(rc, h) === id && h !== spec.anchor);
  if (other.length) { score += 2; tags.push(other.length === 1 && other[0] === 1 ? "the Lagna lord" : `the ${joinAnd(other.map(ord))} lord`); }
  if (p?.house === spec.anchor) { score += 2; tags.push(`in the ${ord(spec.anchor)}`); }
  else if (p && spec.houses.includes(p.house)) { score += 1; tags.push(`in the ${ord(p.house)}`); }
  for (const k of spec.karakas) if (k.id === id) { score += 2; tags.push(k.label); }
  for (const s of spec.signs ?? []) {
    if (lordOf(rc, houseOfSign(rc, s.sign)) === id) { score += 2; tags.push(`ruler of ${s.label}`); }
    else if (p?.sign === s.sign) { score += 1; tags.push(`in ${s.label}`); }
  }
  let vargaDusthana = false;
  if (spec.varga && rc.vargas) {
    const vc = rc.vargas.charts[spec.varga.id];
    const vp = vargaPos(rc, id, spec.varga.id);
    if (vp) {
      const h = ((vp.sign - vc.ascendant + 12) % 12) + 1;
      if (spec.varga.houses.includes(h)) { score += 1.5; tags.push(h === 1 ? `in the ${spec.varga.id} Lagna` : `in the ${spec.varga.id} ${ord(h)}`); }
      else if (DUSTHANA.includes(h) && ["Su", "Ma", "Sa", "Ra", "Ke"].includes(id)) { vargaDusthana = true; tags.push(`in the ${spec.varga.id} ${ord(h)}`); }
    }
  }
  if (p && p.house !== spec.anchor && aspectedSigns(id, p.sign).includes(houseSign(rc, spec.anchor))) { score += 1; tags.push(`aspects the ${ord(spec.anchor)}`); }
  const st = planetState(rc, id);
  const dusthanaLord = hs.some((h) => DUSTHANA.includes(h)) && !hs.some((h) => h === spec.anchor || h === 1 || h === 5 || h === 9);
  const maleficInDusthana = Boolean(p) && DUSTHANA.includes(p!.house) && ["Su", "Ma", "Sa", "Ra", "Ke"].includes(id) && st.grade !== "strong";
  const tone = st.grade === "weak" || vargaDusthana || maleficInDusthana || (st.role === "malefic" && dusthanaLord) ? "pressure" : st.grade === "strong" || st.role === "yogakaraka" || st.role === "benefic" ? "strong" : "active";
  return { score, tags, tone };
}

const at = <T extends { start: Date; end: Date }>(list: T[] | undefined, t: number): T | undefined =>
  list?.find((x) => t >= x.start.getTime() && t < x.end.getTime());

function charaActivates(rc: ReadingContext, spec: TimingSpec, sign: number): string | null {
  const anchorSign = houseSign(rc, spec.anchor);
  const h = houseOfSign(rc, sign);
  if (sign === anchorSign) return `the ${ord(h)} house`;
  const s = spec.signs?.find((x) => x.sign === sign);
  if (s) return s.label;
  if (spec.houses.includes(h)) return `the ${ord(h)} house`;
  const inside = rc.chart.planets.filter((p) => p.sign === sign && (lordOf(rc, spec.anchor) === p.id || spec.karakas.some((k) => k.id === p.id)));
  return inside.length ? `holding ${joinAnd(inside.map((p) => name(p.id)))}` : null;
}

interface Agreement {
  systems: string[];
}

/** Which of Chara and Yogini agree with a Vimshottari stretch (at its midpoint). */
function confirmAt(rc: ReadingContext, spec: TimingSpec, t: number): Agreement {
  const systems: string[] = [];
  if (!rc.confirm) return { systems };
  const cm = at<CharaPeriod>(rc.confirm.chara, t);
  const ca = cm?.antardashas.find((a) => t >= a.start.getTime() && t < a.end.getTime());
  if (ca) {
    const why = charaActivates(rc, spec, ca.sign);
    if (why) systems.push(`Chara ${SIGNS[ca.sign]} antardasha (${why}, ${range(ca.start, ca.end)})`);
  }
  if (cm && !systems.length) {
    const why = charaActivates(rc, spec, cm.sign);
    if (why) systems.push(`Chara ${SIGNS[cm.sign]} dasha (${why}, ${span(cm.start, cm.end)})`);
  }
  const ym = at<YoginiPeriod>(rc.confirm.yogini, t);
  const ya = at<YoginiPeriod>(ym?.children, t);
  for (const y of [ya, ym]) {
    if (!y) continue;
    const r = relevance(rc, spec, y.yogini.lord);
    if (r.score >= 2) {
      systems.push(`Yogini ${name(y.yogini.lord)}, ${r.tags[0]} (${y.level === 2 ? range(y.start, y.end) : span(y.start, y.end)})`);
      break;
    }
  }
  return { systems };
}

export interface TopicTiming {
  past: string[];
  now: string[];
  ahead: string[];
  transits: string[];
}

export function topicTiming(rc: ReadingContext, spec: TimingSpec): TopicTiming | null {
  const tree = rc.dashaTree;
  const birth = rc.chart.birthUtc;
  if (!tree || !birth) return null;
  const now = rc.now.getTime();
  const out: TopicTiming = { past: [], now: [], ahead: [], transits: [] };
  const rel = (id: PlanetId) => relevance(rc, spec, id);
  const tagStr = (r: Relevance) => joinAnd(r.tags.slice(0, 2));
  const fromT = birth.getTime() + (spec.fromAge ?? 16) * YEAR;

  // ---- Past: Mahadashas tied to the topic, with Chara support --------------
  const saturnPeaks = (() => {
    try {
      return sadeSatiPeriods(rc.chart, rc.ayanamsha, rc.now)
        .flatMap((p) => p.phases.filter((ph) => ph.phase === "peak"))
        .map((ph) => ({ start: ph.start.getTime(), end: ph.end.getTime() }));
    } catch {
      return [];
    }
  })();
  for (const md of tree.filter((m) => m.end.getTime() <= now && m.end.getTime() > fromT)) {
    const r = rel(md.lord);
    if (r.score < 2) continue;
    const ch = (rc.confirm?.chara ?? []).find((c) => {
      const ov = Math.min(c.end.getTime(), md.end.getTime()) - Math.max(c.start.getTime(), md.start.getTime());
      return ov > 2 * YEAR && charaActivates(rc, spec, c.sign);
    });
    out.past.push(
      `The ${name(md.lord)} Mahadasha (${span(md.start, md.end)})${ch ? `, together with Chara ${SIGNS[ch.sign]} (${span(ch.start, ch.end)})` : ""}: ${name(md.lord)} is ${tagStr(r)} — ${r.tone === "pressure" ? `a demanding stretch for ${spec.active.split(":")[0]}` : `a formative stretch for ${spec.active.split(":")[0]}`}.`
    );
  }
  const cur = activeDashaAt(tree, rc.now);
  if (cur) {
    const mdR = rel(cur.maha.lord);
    const passed = (cur.maha.children ?? []).filter((ad) => ad.end.getTime() <= now && ad.start.getTime() >= fromT);
    if (cur.maha.start.getTime() < now && mdR.score >= 1) {
      const mp = planet(rc, cur.maha.lord);
      out.past.push(`The ${name(cur.maha.lord)} Mahadasha (from ${yr(cur.maha.start)}) ${mdR.score >= 2 ? `ties to the topic: ${name(cur.maha.lord)} is ${tagStr(mdR)}` : `works on it through the ${mp ? `${ord(mp.house)} — ${HOUSE_GOVERNS[mp.house].phrase}` : "its placement"}`}.`);
    }
    for (const ad of passed) {
      const r = rel(ad.lord);
      const peak = saturnPeaks.some((p) => Math.min(p.end, ad.end.getTime()) - Math.max(p.start, ad.start.getTime()) > 0.3 * YEAR);
      if (r.score >= 2 && r.tone === "pressure") out.past.push(`${name(cur.maha.lord)}–${name(ad.lord)} (${span(ad.start, ad.end)}${peak ? ", overlapping the Sade Sati peak" : ""}) was a pressure phase: ${name(ad.lord)} is ${tagStr(r)} but weak.`);
      else if (r.score >= 3) out.past.push(`${name(cur.maha.lord)}–${name(ad.lord)} (${span(ad.start, ad.end)}) was an active phase: ${name(ad.lord)} is ${tagStr(r)}.`);
    }
  }

  // ---- Now: how many systems agree ------------------------------------------
  if (cur) {
    const ar = rel(cur.antar.lord);
    const mr = rel(cur.maha.lord);
    const agree = confirmAt(rc, spec, now);
    const vim = ar.score >= 2 ? `${name(cur.maha.lord)}–${name(cur.antar.lord)} (${tagStr(ar)}, to ${fmt(cur.antar.end)})` : null;
    const systems = [vim, ...agree.systems].filter(Boolean) as string[];
    const n = systems.length;
    if (n >= 2) {
      out.now.push(`${n === 3 ? "Three systems agree" : "Two systems agree"}. ${joinAnd(systems)} all point to ${spec.active.split(":")[0]}. ${capFirst(ar.tone === "pressure" ? spec.pressure : spec.active)}. ${n === 3 ? "High" : "Medium"} confidence.`);
    } else if (vim) {
      out.now.push(`${vim} activates the topic: ${ar.tone === "pressure" ? spec.pressure : spec.active}. Chara and Yogini do not confirm it, so read it as a moderate period.`);
    } else {
      out.now.push(`The running sub-period, ${name(cur.maha.lord)}–${name(cur.antar.lord)} (to ${fmt(cur.antar.end)}), is not tied to this topic${mr.score >= 2 ? `; the Mahadasha lord ${name(cur.maha.lord)} (${tagStr(mr)}) keeps it in the background` : ""}${agree.systems.length ? `, though ${agree.systems[0]} touches it` : ""}. A quieter phase for this area.`);
    }
  }

  // ---- Ahead: sub-periods in the next ~8 years and the next Mahadasha -------
  {
    const horizon = now + 8 * YEAR;
    const ads = tree.flatMap((md) => (md.children ?? []).map((ad) => ({ md, ad }))).filter(({ ad }) => ad.start.getTime() > now && ad.start.getTime() < horizon);
    let n = 0;
    for (const { md, ad } of ads) {
      const r = rel(ad.lord);
      if (r.score < 2) continue;
      const mid = (ad.start.getTime() + ad.end.getTime()) / 2;
      const agree = confirmAt(rc, spec, mid);
      const both = agree.systems.length;
      out.ahead.push(
        `${name(md.lord)}–${name(ad.lord)} (${range(ad.start, ad.end)}): ${name(ad.lord)} is ${tagStr(r)} — ${r.tone === "pressure" ? spec.pressure : spec.active}${both ? `. ${agree.systems[0]} agrees${both > 1 ? `, and so does ${agree.systems[1]}` : ""}` : ""}.`
      );
      if (++n >= 5) break;
    }
    const nextMd: DashaPeriod | undefined = tree.find((m) => m.start.getTime() > now && m.start.getTime() < now + 20 * YEAR);
    if (nextMd) {
      const r = rel(nextMd.lord);
      const st = planetState(rc, nextMd.lord);
      out.ahead.push(
        `The ${name(nextMd.lord)} Mahadasha (${span(nextMd.start, nextMd.end)}): ${r.score >= 2 ? `${name(nextMd.lord)} is ${tagStr(r)}, and its condition is ${st.grade}, so ${r.tone === "pressure" ? "this area is tested" : "this area matures and steadies"}` : `${name(nextMd.lord)} is not directly tied to this area, so it moves through sub-periods rather than the whole period`}.`
      );
    }
  }

  // ---- Transits: double transit and the nodes ---------------------------------
  try {
    out.transits.push(...transitNotes(rc, spec));
  } catch {
    // A transit scan failure must not take the reading down.
  }
  return out;
}

function capFirst(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Saturn and Jupiter both touching a sign (by occupation or aspect). */
function transitNotes(rc: ReadingContext, spec: TimingSpec): string[] {
  const start = rc.now;
  const end = new Date(rc.now.getTime() + 3.5 * YEAR);
  const nodeMode = rc.chart.meta.nodeMode ?? "mean";
  const sa = occupancyIntervals("Sa", rc.ayanamsha, start, end, 3, nodeMode);
  const ju = occupancyIntervals("Ju", rc.ayanamsha, start, end, 3, nodeMode);
  const out: string[] = [];
  const signs = spec.transitSigns ?? [{ sign: houseSign(rc, spec.anchor), label: `the ${ord(spec.anchor)}` }];
  const touch = (id: PlanetId, from: number, target: number) => from === target || aspectedSigns(id, from).includes(target);
  for (const t of signs) {
    const spans: { s: number; e: number; saSign: number; juSign: number }[] = [];
    for (const a of sa) {
      if (!touch("Sa", a.sign, t.sign)) continue;
      for (const b of ju) {
        if (!touch("Ju", b.sign, t.sign)) continue;
        const s = Math.max(a.start.getTime(), b.start.getTime());
        const e = Math.min(a.end.getTime(), b.end.getTime());
        if (e - s > 30 * 86400000) spans.push({ s, e, saSign: a.sign, juSign: b.sign });
      }
    }
    spans.sort((x, y) => x.s - y.s);
    if (!spans.length) continue;
    const f = spans[0];
    const how = (id: "Saturn" | "Jupiter", from: number) => (from === t.sign ? `${id} transits ${SIGNS[t.sign]}` : `${id} in ${SIGNS[from]} aspects ${SIGNS[t.sign]}`);
    const when = spans
      .slice(0, 3)
      .map((x) => (x.e >= end.getTime() - 86400000 ? `from ${fmt(new Date(x.s))}` : range(new Date(x.s), new Date(x.e))))
      .join(" and ");
    out.push(`${when}: ${how("Saturn", f.saSign)} while ${how("Jupiter", f.juSign).replace(/^Jupiter/, "Jupiter")} — a double transit on ${t.label}, the classical trigger for events in this area.`);
  }

  for (const t of spec.jupiterOver ?? []) {
    const hits = ju.filter((b) => b.sign === t.sign && b.end.getTime() - b.start.getTime() > 30 * 86400000);
    if (hits.length) out.push(`Jupiter transits ${SIGNS[t.sign]} (${t.label}) ${joinAnd(hits.map((b) => range(b.start, b.end)))}: a supportive transit for this area.`);
  }

  // Nodes entering the anchor sign or crossing a natal karaka.
  const anchorSign = houseSign(rc, spec.anchor);
  for (const nd of ["Ra", "Ke"] as PlanetId[]) {
    const occ = occupancyIntervals(nd, rc.ayanamsha, start, end, 5, nodeMode);
    const entry = occ.find((o, i) => i > 0 && o.sign === anchorSign);
    if (entry) out.push(`${name(nd)} enters ${SIGNS[anchorSign]} (the ${ord(spec.anchor)}) on ${entry.start.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}: ${nd === "Ra" ? "an 18-month spell of intensity, ambition and outside influence on this area" : "an 18-month spell of detachment or loss of interest in this area"}.`);
    for (const target of spec.nodeTargets ?? []) {
      const p = planet(rc, target);
      if (!p) continue;
      const hit = nodeCrossing(rc, nd, p.longitude, start, end);
      if (hit) out.push(`${name(nd)} passes over natal ${name(target)} (${Math.floor(p.longitude % 30)}° ${SIGNS[p.sign]}) around ${fmt(hit)}: ${nd === "Ra" ? "a peak of intensity, temptation or outside interference for what it signifies" : "a phase of distance or disenchantment for what it signifies"}.`);
    }
  }
  return out;
}

function nodeCrossing(rc: ReadingContext, nd: PlanetId, lon: number, start: Date, end: Date): Date | null {
  const nodeMode = rc.chart.meta.nodeMode ?? "mean";
  const diff = (t: number) => {
    let d = siderealLongitudeAt(nd, rc.ayanamsha, new Date(t), nodeMode) - lon;
    d = ((d + 540) % 360) - 180;
    return d;
  };
  const step = 15 * 86400000;
  let prev = diff(start.getTime());
  for (let t = start.getTime() + step; t <= end.getTime(); t += step) {
    const d = diff(t);
    if (Math.abs(d) < 1.5 || (Math.sign(d) !== Math.sign(prev) && Math.abs(d - prev) < 10)) return new Date(t);
    prev = d;
  }
  return null;
}

/** Saturn's stance relative to the natal Moon now and next: Sade Sati, Kantaka, Ashtama. */
export function saturnCycles(rc: ReadingContext): string[] {
  const out: string[] = [];
  const mo = planet(rc, "Mo");
  if (!mo) return out;
  try {
    const periods = sadeSatiPeriods(rc.chart, rc.ayanamsha, rc.now);
    const curSS = periods.find((p) => p.status === "current");
    if (curSS) {
      const ph = currentPhase(curSS, rc.now);
      out.push(`Sade Sati is running (${range(curSS.start, curSS.end)})${ph ? `, ${ph.phase} phase` : ""}: discipline, simplification, and protecting health and sleep.`);
    }
    const next = periods.find((p) => p.status === "future");
    if (next && !curSS) out.push(`Next Sade Sati: ${range(next.start, next.end)}.`);
    const end = new Date(rc.now.getTime() + 3.5 * YEAR);
    const sa = occupancyIntervals("Sa", rc.ayanamsha, rc.now, end, 3, rc.chart.meta.nodeMode ?? "mean");
    const merge = (pick: (h: number) => boolean) => {
      const spans: { s: Date; e: Date; hs: Set<number> }[] = [];
      for (const iv of sa) {
        const h = ((iv.sign - mo.sign + 12) % 12) + 1;
        if (!pick(h)) continue;
        const last = spans[spans.length - 1];
        if (last && iv.start.getTime() - last.e.getTime() < 200 * 86400000) { last.e = iv.end; last.hs.add(h); }
        else spans.push({ s: iv.start, e: iv.end, hs: new Set([h]) });
      }
      return spans;
    };
    const until = (x: { s: Date; e: Date }) => (x.e.getTime() >= end.getTime() - 86400000 ? `from ${fmt(x.s)}` : x.s <= rc.now ? `until ${fmt(x.e)}` : range(x.s, x.e));
    for (const x of merge((h) => h === 8)) out.push(`Ashtama Shani (Saturn 8th from the Moon) ${until(x)}: health, sudden obstacles and hidden worries need care.`);
    for (const x of merge((h) => [4, 7, 10].includes(h))) out.push(`Kantaka Shani (Saturn in the ${joinAnd([...x.hs].map(ord))} from the Moon) ${until(x)}: delays, paperwork snags or repairs — check titles and contracts carefully.`);
  } catch {
    // ignore transit failures
  }
  return [...new Set(out)];
}
