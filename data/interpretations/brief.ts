import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import type { PersonalityProfile } from "./personality";
import type { Caution } from "./cautions";
import { NAKSHATRAS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";

/**
 * The short, precise layer of every scored section.
 *
 * Nothing here judges anything new. It selects from what the section builders
 * already computed and weighted: the strongest supporting and opposing
 * evidence, the top-ranked options, the next timing windows. The full prose
 * those builders write stays available behind a "Full reasoning" toggle, so a
 * brief is always a faithful digest of the reasoning, never a second opinion.
 *
 * Rules:
 *  - a point is one sentence: the fact and what it means;
 *  - points are ordered by |weight|, so the decisive factors come first;
 *  - both directions are always shown when both exist — a brief that lists
 *    only support reads as a promise.
 */

export interface BriefPoint {
  text: string;
  lean: "up" | "down" | "flat";
  source?: string;
}

export interface SectionBrief {
  points: BriefPoint[];
  top: { label: string; score: number; verdict: string; why?: string }[];
  /** The next one or two windows that have not passed. */
  next: TimingWindow[];
}

const MAX_POINT_CHARS = 220;

/**
 * Drop the inline glossary parentheticals the plain-language voice adds —
 * "(the 'Lagna' — the sign that was coming up over the eastern horizon…)".
 * They are right in the full reading and noise in a one-line digest, and their
 * inner em-dash would otherwise be mistaken for a clause break.
 */
export function stripGlosses(text: string): string {
  return text.replace(/\s*\((?:[^()]*?(?: — |'))[^()]*\)/g, "").replace(/\s+([,.;:])/g, "$1");
}

/**
 * One sentence, at most ~220 characters: the first sentence of `text`, and if
 * that is still long, cut at the first em-dash clause. Never cuts mid-word.
 */
export function oneSentence(text: string): string {
  const t = stripGlosses(text.trim());
  const end = t.search(/[.!?](\s|$)/);
  let s = end >= 0 ? t.slice(0, end + 1) : t;
  // Cut a long sentence at its em-dash only when there is exactly one (a tail
  // clause); a paired aside is not a safe place to end a sentence.
  if (s.length > MAX_POINT_CHARS && s.split(" — ").length === 2) {
    const dash = s.indexOf(" — ");
    if (dash > 40) s = s.slice(0, dash) + ".";
  }
  if (s.length > MAX_POINT_CHARS) {
    const cut = s.lastIndexOf(" ", MAX_POINT_CHARS - 1);
    s = s.slice(0, cut > 0 ? cut : MAX_POINT_CHARS - 1).replace(/[,;:]$/, "") + "…";
  }
  return s;
}

const leanOf = (w: number): BriefPoint["lean"] => (w > 0 ? "up" : w < 0 ? "down" : "flat");

/**
 * A point's text: one sentence, and when the clause before an em-dash is a
 * complete statement on its own (≥ 50 characters), only that clause. Evidence
 * text often ends in a generic gloss ("— a wealth combination is worth more
 * here than any single strong planet") that repeats across points.
 */
export function compactPoint(text: string): string {
  let one = oneSentence(text);
  // A paired aside ("confinement — physical or moral — is the real distress")
  // is removed, never cut at: cutting at its first dash would end the sentence
  // mid-thought and can invert its meaning.
  // Only a SHORT aside with no list punctuation qualifies — dashes are also
  // used as list separators ("Jupiter — in your 3rd…; Sun — in your 10th…"),
  // and removing "between the dashes" there would splice one planet's
  // placement onto another. Anything else is left exactly as written.
  for (;;) {
    const a = one.indexOf(" — ");
    const b = a >= 0 ? one.indexOf(" — ", a + 3) : -1;
    if (b < 0) break;
    const aside = one.slice(a + 3, b);
    // "…house — Jupiter's special 5th-house aspect — its blessing on…" is a
    // chain of descriptions, not an aside: what follows starts a noun phrase.
    const after = one.slice(b + 3);
    if (aside.length > 40 || /[;:,]/.test(aside) || /^(its|the|a|an|his|her|their)\b/.test(after)) break;
    one = one.slice(0, a) + one.slice(b + 2);
  }
  // What is left: a dash after a complete opening clause (≥ 50 characters)
  // starts a gloss or description chain and is safe to cut at; a dash after a
  // short opener ("Working for you: Jupiter — …") is structure and is kept.
  const dash = one.indexOf(" — ");
  return dash >= 50 ? one.slice(0, dash).replace(/[,;:]$/, "") + "." : one;
}

function toPoint(e: Evidence): BriefPoint {
  return {
    text: compactPoint(e.text),
    lean: leanOf(e.weight),
    source: e.source ? `${e.source.work}${e.source.ref ? `, ${e.source.ref}` : ""}` : undefined,
  };
}

/**
 * Pick the decisive evidence: up to `max` points by |weight|, but always at
 * least one from the opposite direction when the section has any.
 */
export function decisive(evidence: Evidence[], max = 6): BriefPoint[] {
  const seen = new Set<string>();
  const unique = evidence.filter((e) => {
    const k = compactPoint(e.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const ranked = [...unique].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const picked = ranked.slice(0, max);
  const hasUp = picked.some((e) => e.weight > 0);
  const hasDown = picked.some((e) => e.weight < 0);
  const swapIn = (want: (e: Evidence) => boolean) => {
    const extra = ranked.find((e) => want(e) && !picked.includes(e));
    if (extra && picked.length) picked[picked.length - 1] = extra;
  };
  if (!hasDown) swapIn((e) => e.weight < 0);
  else if (!hasUp) swapIn((e) => e.weight > 0);
  return picked.sort((a, b) => b.weight - a.weight).map(toPoint);
}

function topItems(items: RankedItem[] | undefined, n = 3): SectionBrief["top"] {
  return (items ?? []).slice(0, n).map((it) => {
    const best = [...it.reasons].sort((a, b) => b.weight - a.weight)[0];
    return { label: it.label, score: it.score, verdict: it.verdict, why: best ? compactPoint(best.text) : undefined };
  });
}

/** The next not-yet-passed windows, soonest first. */
export function nextWindows(windows: TimingWindow[] | null | undefined, n = 2): TimingWindow[] {
  return (windows ?? [])
    .filter((w) => w.phase !== "past")
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, n);
}

export function briefOfSection(report: SectionReport, windows?: TimingWindow[] | null): SectionBrief {
  // Section-level evidence plus the evidence behind the two leading options:
  // in ranked sections (career, wealth, foreign) the decisive reasons live on
  // the options, and section-level reasons alone can be a side question.
  const blockReasons = report.blocks.flatMap((b) => b.reasons ?? []);
  const itemBlock = report.blocks.find((b) => b.items && b.items.length);
  const evidence = [...blockReasons, ...(itemBlock?.items ?? []).slice(0, 2).flatMap((it) => it.reasons)];
  return {
    points: decisive(evidence),
    top: topItems(itemBlock?.items),
    next: nextWindows(windows),
  };
}

/**
 * Cautions: the weightiest few, each with the first sentence of its
 * counter-measure. Cautions that are one template applied to several planets
 * ("Saturn rules houses that pull against your interests…", then the same for
 * Mercury and Venus) are merged into one line naming all of them, so a single
 * rule cannot crowd every other caution out of the digest.
 */
export function briefOfCautions(cautions: Caution[], max = 5): { text: string; remedy: string }[] {
  const names = Object.values(PLANET_NAMES);
  const groups = new Map<string, { planets: string[]; text: string; remedy: string; weight: number }>();
  for (const c of [...cautions].sort((a, b) => a.caution.weight - b.caution.weight)) {
    const text = oneSentence(c.caution.text);
    const remedy = oneSentence(c.counterMeasure);
    const planet = names.find((n) => text.startsWith(n + " "));
    const key = planet ? `${text.slice(planet.length)}|${remedy.split(planet).join("{P}")}` : `${text}|${remedy}`;
    const g = groups.get(key);
    if (g && planet) g.planets.push(planet);
    else groups.set(key, { planets: planet ? [planet] : [], text, remedy, weight: c.caution.weight });
  }
  return [...groups.values()].slice(0, max).map((g) => {
    if (g.planets.length < 2) return { text: g.text, remedy: g.remedy };
    const first = g.planets[0];
    const list = g.planets.join(", ");
    return {
      text: `${list} — each${g.text.slice(first.length)}`,
      remedy: g.remedy.split(`${first}'s`).join("these planets'").split(first).join("these planets"),
    };
  });
}

/** Openers that define a term rather than say anything about this chart. */
const DEFINITIONAL = /^(In Vedic astrology|The (Sun|Moon|rising sign|rising degree|Navamsa|Arudha Lagna)(?: \([^)]*\))? (stands|describes|is|also)|Each planet|Every planet|Shadbala is|A '?yoga'? is|Which planets|Tradition reads|If the birth chart|A planet that rules|Note this|In simple terms|It is less)/;

function sentenceScore(sentence: string): number {
  let score = 0;
  if (SIGNS.some((x) => sentence.includes(x))) score += 2;
  if (NAKSHATRAS.some((x) => sentence.includes(x))) score += 2;
  if (/\d/.test(sentence)) score += 2;
  if (/^With /.test(sentence)) score += 2;
  // A sentence that names the planet holding a Jaimini role beats one that
  // refers back to it ("Its Karakamsa…"), which reads orphaned on its own.
  if (/your (Atmakaraka|Darakaraka|Amatyakaraka)/.test(sentence)) score += 3;
  if (/^(Your|You|Working for you|Working against you|Venus is|Saturn is|Mars is|Jupiter is|Mercury is|Moon is|Sun is)/.test(sentence)) score += 1;
  if (DEFINITIONAL.test(sentence)) score -= 5;
  return score;
}

/**
 * Personality: the most chart-specific sentences of each facet — the ones that
 * name a sign, nakshatra, degree or score, or begin a trait ("With Aries
 * rising…") — never the definitional opener. The three seats (Lagna, Moon,
 * Sun) get two lines, placement and trait; every other facet gets one.
 */
export function briefOfPersonality(profile: PersonalityProfile): { heading: string; line: string }[] {
  return profile.sections
    .filter((s) => s.paragraphs.length)
    .map((s, idx) => {
      const sentences = s.paragraphs
        .flatMap((p) => stripGlosses(p).split(/(?<=[.!?])\s+/))
        .map((x, i) => ({ x: x.trim(), i, score: sentenceScore(x.trim()) }))
        .filter((x) => x.x.length > 0);
      const take = idx < 3 ? 2 : 1;
      const chosen = [...sentences].sort((a, b) => b.score - a.score || a.i - b.i).slice(0, take).sort((a, b) => a.i - b.i);
      return { heading: s.heading, line: chosen.map((c) => compactPoint(c.x)).join(" ") };
    });
}
