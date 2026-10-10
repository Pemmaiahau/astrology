import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { computeAvasthas, type AvasthaSet } from "@/utils/astrology/avasthas";
import { NAKSHATRAS, NAKSHATRA_LORDS, PLANETS, PLANET_NAMES, SHADBALA_PLANETS, SIGNS, SIGN_LORDS, type PlanetId7 } from "@/utils/astrology/constants";
import type { ConfirmContext } from "@/utils/astrology/dashaConfirm";
import type { ExtendedFinding } from "@/utils/astrology/extendedYogas";
import { ordinal } from "@/utils/astrology/format";
import type { CharaKarakaId, JaiminiInfo } from "@/utils/astrology/jaimini";
import { padaOf, separation } from "@/utils/astrology/math";
import type { BhavaBala, ShadbalaSet } from "@/utils/astrology/shadbala";
import type { SpecialPoints } from "@/utils/astrology/specialPoints";
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { AyanamshaId, ChartData, DashaPeriod, Dignity, PlanetId, PlanetPosition, YogaFinding } from "@/utils/astrology/types";
import type { VargaId, VargaSet } from "@/utils/astrology/varga";
import { ownedHouses } from "@/utils/astrology/yogas";
import { HOUSE_GOVERNS, PLANET_SIGNIFIES } from "../significations";

/**
 * The astrologer's report — "Part 1: Personality … Part 7: Timing" — built as
 * headed subsections, each a factual lead (degrees, nakshatra, strength
 * figures) followed by what it gives, and a closing summary.
 *
 * Every sentence is assembled from computed facts and the app's curated
 * text tables; nothing here is free-floating prose. When a fact is missing
 * (no birth time, no Shadbala) the sentence that needs it is simply left out.
 */

export interface ReadingSubsection {
  heading: string;
  /** Factual lead — the placements and figures the bullets interpret. */
  lead: string[];
  /** "What this gives" — one interpretation per bullet. */
  bullets: string[];
}

export interface ReadingPart {
  key: string;
  number: number;
  title: string;
  subsections: ReadingSubsection[];
  summary: string[];
}

export interface ReadingContext {
  chart: ChartData;
  ayanamsha: AyanamshaId;
  now: Date;
  vargas: VargaSet | null;
  jaimini: JaiminiInfo | null;
  shadbala: ShadbalaSet | null;
  bhavaBala: BhavaBala[] | null;
  av: AshtakavargaResult | null;
  strengths: Partial<Record<PlanetId, PlanetStrength>>;
  yogas: YogaFinding[];
  extended: ExtendedFinding[];
  special: SpecialPoints | null;
  dashaTree: DashaPeriod[] | null;
  confirm: ConfirmContext | null;
  avasthas: AvasthaSet[];
}

export function buildReadingContext(
  base: Omit<ReadingContext, "avasthas">
): ReadingContext {
  return { ...base, avasthas: computeAvasthas(base.chart) };
}

// ---------------------------------------------------------------------------
// Fact helpers
// ---------------------------------------------------------------------------

export const ord = ordinal;
export const name = (id: PlanetId) => PLANET_NAMES[id];
export const names = (ids: PlanetId[]) => joinAnd(ids.map(name));

export function joinAnd(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

export function cap(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Degree in sign as D°MM' (truncated, never rounded up to 30°). */
export function deg(longitude: number): string {
  const d = longitude % 30;
  const whole = Math.floor(d);
  const min = Math.min(59, Math.floor((d - whole) * 60 + 1e-9));
  return `${whole}°${String(min).padStart(2, "0")}'`;
}

export function planet(rc: ReadingContext, id: PlanetId): PlanetPosition | undefined {
  return rc.chart.planets.find((p) => p.id === id);
}

export function nakOf(longitude: number): { name: string; pada: number; lord: PlanetId; index: number } {
  const index = Math.floor((((longitude % 360) + 360) % 360) / (360 / 27));
  return { name: NAKSHATRAS[index], pada: padaOf(longitude), lord: NAKSHATRA_LORDS[index], index };
}

export const DIGNITY_WORD: Record<Dignity, string> = {
  exalted: "exalted",
  moolatrikona: "in its moolatrikona",
  own: "in its own sign",
  greatFriend: "in a great friend's sign",
  friend: "in a friend's sign",
  neutral: "in a neutral sign",
  enemy: "in an enemy's sign",
  greatEnemy: "in a great enemy's sign",
  debilitated: "debilitated",
};

export const isStrongDignity = (d: Dignity) => d === "exalted" || d === "moolatrikona" || d === "own";
export const isWeakDignity = (d: Dignity) => d === "debilitated" || d === "greatEnemy" || d === "enemy";

/** Shadbala ratio (achieved ÷ required) for the seven grahas, when available. */
export function ratio(rc: ReadingContext, id: PlanetId): number | null {
  if (!rc.shadbala || !(SHADBALA_PLANETS as PlanetId[]).includes(id)) return null;
  return rc.shadbala.planets[id as PlanetId7].ratio;
}

/** The seven grahas ordered by Shadbala ratio, strongest first. */
export function ratioRanking(rc: ReadingContext): PlanetId[] {
  if (!rc.shadbala) return [];
  return [...SHADBALA_PLANETS].sort((a, b) => rc.shadbala!.planets[b].ratio - rc.shadbala!.planets[a].ratio);
}

export const fmtRatio = (r: number) => `${r.toFixed(2)}×`;

/** "the strongest planet by Shadbala ratio (1.62× required)" etc., or null for the middle of the field. */
export function strengthRankPhrase(rc: ReadingContext, id: PlanetId): string | null {
  const rank = ratioRanking(rc);
  const r = ratio(rc, id);
  if (r === null || !rank.length) return null;
  if (rank[0] === id) return `the strongest planet by Shadbala ratio (${fmtRatio(r)} required)`;
  if (rank[rank.length - 1] === id) return `the weakest planet in Shadbala (${fmtRatio(r)})`;
  return null;
}

export function vimshopaka(rc: ReadingContext, id: PlanetId): number | null {
  if (!rc.vargas || !(SHADBALA_PLANETS as PlanetId[]).includes(id)) return null;
  return rc.vargas.vimshopaka[id as PlanetId7].shodasha;
}

export function vimshopakaRank(rc: ReadingContext): PlanetId[] {
  if (!rc.vargas) return [];
  return [...SHADBALA_PLANETS].sort((a, b) => rc.vargas!.vimshopaka[b].shodasha - rc.vargas!.vimshopaka[a].shodasha);
}

export function vargaPos(rc: ReadingContext, id: PlanetId, v: VargaId) {
  return rc.vargas?.charts[v].positions.find((p) => p.id === id);
}

export function isVargottama(rc: ReadingContext, id: PlanetId): boolean {
  return Boolean(rc.vargas?.vargottama.includes(id));
}

/**
 * Strong or weak dignities in the three vargas a reading leans on most —
 * "own sign in the Navamsa, exalted in D2 and exalted in D10".
 */
export function vargaHighlights(rc: ReadingContext, id: PlanetId): { good: string[]; bad: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  const label: Record<string, string> = { D9: "the Navamsa", D2: "D2", D10: "D10" };
  for (const v of ["D9", "D2", "D10"] as VargaId[]) {
    const p = vargaPos(rc, id, v);
    if (!p) continue;
    if (p.dignity === "exalted") good.push(`exalted in ${label[v]}`);
    else if (p.dignity === "own" || p.dignity === "moolatrikona") good.push(`own sign in ${label[v]}`);
    else if (p.dignity === "debilitated") bad.push(`debilitated in ${label[v]}`);
  }
  return { good, bad };
}

export function isGandanta(longitude: number): boolean {
  const sign = Math.floor(longitude / 30) % 12;
  const d = longitude % 30;
  return ([3, 7, 11].includes(sign) && d >= 30 - 10 / 3) || ([0, 4, 8].includes(sign) && d < 10 / 3);
}

export function conjuncts(rc: ReadingContext, id: PlanetId): PlanetId[] {
  const p = planet(rc, id);
  if (!p) return [];
  return rc.chart.planets.filter((q) => q.id !== id && q.sign === p.sign).map((q) => q.id);
}

export function houseSign(rc: ReadingContext, house: number): number {
  return (rc.chart.ascendant.sign + house - 1) % 12;
}

export function lordOf(rc: ReadingContext, house: number): PlanetId {
  return SIGN_LORDS[houseSign(rc, house)];
}

export function occupants(rc: ReadingContext, house: number): PlanetId[] {
  return rc.chart.planets.filter((p) => p.house === house).map((p) => p.id);
}

export function owned(rc: ReadingContext, id: PlanetId): number[] {
  return id === "Ra" || id === "Ke" ? [] : ownedHouses(id, rc.chart.ascendant.sign);
}

/** "Mars rules the 5th and 12th, linking drive, courage and confrontation to …" */
export function lordshipBullet(rc: ReadingContext, id: PlanetId): string | null {
  const hs = owned(rc, id);
  if (!hs.length) return null;
  return `${name(id)} rules your ${joinAnd(hs.map(ord))}, so ${PLANET_SIGNIFIES[id].phrase} ${hs.length > 1 ? "run" : "runs"} through ${joinAnd(hs.map((h) => HOUSE_GOVERNS[h].short))}.`;
}

export function sav(rc: ReadingContext, house: number): number | null {
  return rc.av ? rc.av.sav[houseSign(rc, house)] : null;
}

/** Houses ordered by SAV, lowest first. */
export function savOrder(rc: ReadingContext): number[] {
  if (!rc.av) return [];
  return Array.from({ length: 12 }, (_, i) => i + 1).sort((a, b) => sav(rc, a)! - sav(rc, b)!);
}

export function bhavaRupas(rc: ReadingContext, house: number): number | null {
  return rc.bhavaBala?.find((b) => b.house === house)?.rupas ?? null;
}

export function karakaRoles(rc: ReadingContext, id: PlanetId): CharaKarakaId[] {
  if (!rc.jaimini) return [];
  return (Object.keys(rc.jaimini.karakas) as CharaKarakaId[]).filter((k) => rc.jaimini!.karakas[k] === id);
}

export function aspectorsOfSign(rc: ReadingContext, sign: number, aspected: (id: PlanetId, from: number) => number[]): PlanetId[] {
  return rc.chart.planets
    .filter((p) => p.sign !== sign && aspected(p.id, p.sign).includes(sign))
    .map((p) => p.id);
}

/** A planet's one-line status: "at 13°24' Sagittarius (Purva Ashadha pada 1), in a great friend's sign". */
export function placementLine(rc: ReadingContext, id: PlanetId): string {
  const p = planet(rc, id)!;
  const n = nakOf(p.longitude);
  const flags = [p.retrograde && id !== "Ra" && id !== "Ke" ? "retrograde" : null, p.combust ? "combust" : null]
    .filter(Boolean)
    .join(", ");
  return `${deg(p.longitude)} ${SIGNS[p.sign]} (${n.name} pada ${n.pada}) in the ${ord(p.house)} house, ${DIGNITY_WORD[p.dignity]}${flags ? `, ${flags}` : ""}`;
}

export function avasthaOf(rc: ReadingContext, id: PlanetId) {
  return rc.avasthas.find((a) => a.id === id);
}

/** True when two longitudes are within `orb` degrees. */
export const within = (a: number, b: number, orb: number) => separation(a, b) <= orb;

/** Sentences of a curated paragraph, glossary-free, first `n`. */
export function sentences(text: string, n: number): string[] {
  return text
    .replace(/\s*\((?:[^()]*?(?: — |'))[^()]*\)/g, "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, n);
}

export { PLANETS, SIGNS };

/**
 * How well a planet can deliver its periods for this Lagna: role × strength.
 * Strong = a working planet (functional benefic, yogakaraka or Lagna lord)
 * that either meets its Shadbala requirement or is dignified in at least two
 * of D9/D2/D10 — varga dignity is the classical check on whether a D1
 * weakness is real. Demanding = a functional malefic below strength with no
 * varga support. Everything else is mixed. `why` names the deciding facts.
 */
export function lordQuality(
  rc: ReadingContext,
  id: PlanetId,
  role: "yogakaraka" | "benefic" | "malefic" | "neutral"
): { q: "strong" | "mixed" | "demanding"; why: string } {
  const working = role === "benefic" || role === "yogakaraka" || id === SIGN_LORDS[rc.chart.ascendant.sign];
  const r = ratio(rc, id);
  const vh = vargaHighlights(rc, id);
  const strongBy = r !== null && r >= 1 ? `meets its Shadbala requirement (${fmtRatio(r)})` : vh.good.length >= 2 ? `is ${joinAnd(vh.good)}${r !== null ? `, which outweighs a ${fmtRatio(r)} Shadbala` : ""}` : null;
  if (working && strongBy) return { q: "strong", why: `a working planet for your Lagna that ${strongBy}` };
  if (role === "malefic" && (r ?? 1) < 1 && vh.good.length === 0) return { q: "demanding", why: `a functional malefic below its strength requirement${r !== null ? ` (${fmtRatio(r)})` : ""}` };
  return { q: "mixed", why: working ? "a working planet without enough strength to deliver fully" : `a functional ${role}${strongBy ? ` that ${strongBy}` : ""}` };
}
