import { ageYearsAt } from "@/utils/astrology/ageBands";
import { aspectedSigns } from "@/utils/astrology/aspects";
import { ownedHouses } from "@/utils/astrology/yogas";
import type { ChartData, PlanetId } from "@/utils/astrology/types";
import type { ActivationWindow as ScanWindow } from "@/utils/astrology/scan";
import { ordinal } from "./synthesis";

/**
 * Shared shapes for the scored Interpretation-tab sections (career, wealth,
 * marriage, foreign, cautions, lucky). Every section builder returns a
 * `SectionReport`: the reading, the reasoning that produced it, and an honest
 * confidence figure. Pure types + tiny helpers — no astronomy here.
 */

/** A classical citation. `ref` names a chapter/verse only when verified. */
export interface Citation {
  work: string;
  ref?: string;
}

/** One piece of evidence: what was seen, how much it weighs, where it comes from. */
export interface Evidence {
  text: string;
  /** Signed contribution to the section's judgement (positive = supportive). */
  weight: number;
  source?: Citation;
}

/** A ranked item: a career option, an income stream, a settlement scenario… */
export interface RankedItem {
  key: string;
  label: string;
  /** Fit score 0–100. */
  score: number;
  verdict: string;
  reasons: Evidence[];
}

/** A timing window with confidence; superset of the Life Areas window shape. */
export interface TimingWindow {
  label: string;
  start: Date;
  end: Date;
  grade: "strong" | "moderate" | "weak";
  /** 5–95. */
  confidence: number;
  reasons: string[];
  /** Native's age at the window's start and end, rounded to whole years. */
  ageRange: { from: number; to: number };
  phase: "past" | "current" | "future";
  /** Optional grouping heading, e.g. "Entry & establishment (22–30)". */
  group?: string;
  /** Month-level refinements inside the window (e.g. Jupiter contacts). */
  subWindows?: TimingWindow[];
}

/** One block of a section: heading + prose, optionally with items/windows. */
export interface ReportBlock {
  heading: string;
  paragraphs: string[];
  reasons?: Evidence[];
  items?: RankedItem[];
  windows?: TimingWindow[];
}

/** Verdict tiers shared with the Life Areas tab (same thresholds). */
export type Verdict = "Strong promise" | "Supportive" | "Mixed" | "Needs effort" | "Challenged";

export function verdictOf(score: number): Verdict {
  if (score >= 68) return "Strong promise";
  if (score >= 56) return "Supportive";
  if (score >= 45) return "Mixed";
  if (score >= 34) return "Needs effort";
  return "Challenged";
}

export interface SectionReport {
  key: string;
  title: string;
  /** Plain-English one-line summary. */
  headline: string;
  score?: number;
  verdict?: Verdict;
  /** Overall belief in the section's reading, 5–95. */
  confidence: number;
  blocks: ReportBlock[];
  /** Degradation notices: what was missing and how the reading adapted. */
  caveats: string[];
  hasDasha: boolean;
}

/**
 * How a planet connects to a theme (houses + karakas), as a human sentence —
 * the same lord/occupant/karaka/aspect vocabulary the Life Areas tab uses.
 * Returns null when unconnected.
 */
export function themeConnection(
  chart: ChartData,
  id: PlanetId,
  houses: number[],
  karakas: PlanetId[] = []
): string | null {
  const lagna = chart.ascendant.sign;
  const reasons: string[] = [];
  const owned = ownedHouses(id, lagna).filter((h) => houses.includes(h));
  if (owned.length) reasons.push(`lord of the ${owned.map(ordinal).join("/")}`);
  const p = chart.planets.find((q) => q.id === id);
  if (p && houses.includes(p.house)) reasons.push(`occupies the ${ordinal(p.house)}`);
  if (karakas.includes(id)) reasons.push("karaka");
  if (p) {
    const aspected = houses.filter((h) => {
      const sign = (lagna + h - 1) % 12;
      return p.sign !== sign && aspectedSigns(id, p.sign).includes(sign);
    });
    if (aspected.length) reasons.push(`aspects the ${aspected.map(ordinal).join("/")}`);
  }
  return reasons.length ? reasons.join("; ") : null;
}

/**
 * Convert a scan.ts ActivationWindow into the display TimingWindow shape.
 * `birthUtc` is what turns dates into ages — the reader's own life stage is
 * the frame the windows are meant to be read in.
 */
export function toTimingWindow(
  w: ScanWindow,
  label: string,
  birthUtc: Date,
  group?: string
): TimingWindow {
  return {
    label,
    start: w.start,
    end: w.end,
    grade: w.score >= 70 ? "strong" : w.score >= 50 ? "moderate" : "weak",
    confidence: w.confidence,
    reasons: w.reasons.map((r) => r.text),
    ageRange: { from: ageYearsAt(birthUtc, w.start), to: ageYearsAt(birthUtc, w.end) },
    phase: w.phase,
    ...(group ? { group } : {}),
  };
}

/**
 * Attach a plain-English gloss to a Sanskrit term the first time a section
 * uses it: plain("Upapada Lagna") → "Upapada Lagna (the marriage pada)".
 * Terms outside the glossary pass through unchanged.
 */
const GLOSSARY: Record<string, string> = {
  "Atmakaraka": "the soul significator — the planet most advanced by degree",
  "Amatyakaraka": "the career counselor planet — second most advanced by degree",
  "Darakaraka": "the spouse significator — least advanced by degree",
  "Karakamsa": "the Navamsa sign of the Atmakaraka",
  "Arudha Lagna": "how the world perceives you",
  "Upapada Lagna": "the marriage pada — the arudha of the 12th house",
  "Navamsa": "the D-9 divisional chart of marriage and inner strength",
  "Dasamsa": "the D-10 divisional chart of career",
  "Hora": "the D-2 divisional chart of wealth",
  "Shadbala": "the classical six-fold strength measure",
  "Vimshopaka": "composite dignity across the divisional charts",
  "badhaka": "the obstructor lord for this rising sign",
  "maraka": "a planet linked to the 2nd/7th houses, classically watched for health",
  "dusthana": "the difficult houses 6, 8 and 12",
  "kendra": "the angular houses 1, 4, 7 and 10",
  "trikona": "the trinal houses 1, 5 and 9",
  "Mangal Dosha": "the Mars placement traditionally checked before marriage",
  "gochara": "transit",
  "Vargottama": "the same sign in both D-1 and D-9 — a mark of stability",
  // Added for the Speculation and Intimacy sections. Same rule as above: a
  // Sanskrit term is only used in prose if it is glossed here on first mention.
  "purva punya": "the merit carried in from before this life — the 5th house's other name",
  "Vipareeta Raja Yoga": "the reversal combination — a difficult-house lord hidden in a difficult house, which turns adversity to advantage",
  "Sarvashtakavarga": "the points table that scores every sign for transit support",
  "Sade Sati": "the seven-and-a-half-year Saturn passage over the signs around your Moon",
  "Trimsamsa": "the D-30 divisional chart, read for vulnerability",
  "Shodasamsa": "the D-16 divisional chart of comforts and sensual pleasure",
  "Saptamsa": "the D-7 divisional chart of children and lineage",
  "Ishta phala": "the benefic yield a planet gives from its strength",
  "Kashta phala": "the cost that comes attached to that yield",
  "parivartana": "an exchange of signs between two planets",
  "Neechabhanga": "the cancellation of a planet's debilitation",
  "Gandanta": "a knot at the junction of a water and a fire sign",
  "kama trikona": "the desire trine — houses 3, 7 and 11",
  "shayana sukha": "the pleasures of the bed — the 12th house's classical remit",
  "Yoni kuta": "the animal-temperament limb of traditional compatibility matching",
  "gana": "the Deva, Manushya or Rakshasa temperament class of a nakshatra",
};

export function plain(term: string): string {
  const gloss = GLOSSARY[term];
  return gloss ? `${term} (${gloss})` : term;
}
