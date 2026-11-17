import type { PlanetId } from "@/utils/astrology/types";
import { VERDICT_WORD, type Factor, type Judgement } from "./judge";
import type { TopicTiming } from "./timeline";
import type { ReadingSubsection } from "./context";

/**
 * The layout every life-topic part shares, modelled on a consultant's
 * write-up: Supporting → Opposing → topic-specific blocks → Verdict with
 * confidence → Timing (past, now, ahead, transits). Supporting and Opposing
 * are both always shown, so a reader sees what the verdict weighed.
 */
export function topicSections(opts: {
  j: Judgement;
  blocks?: ReadingSubsection[];
  verdict: string;
  confidence: string;
  timing: TopicTiming | null;
  /** Extra timing lines (Saturn cycles and the like). */
  timingExtra?: string[];
  max?: number;
}): ReadingSubsection[] {
  const max = opts.max ?? 12;
  const out: ReadingSubsection[] = [];
  out.push({ heading: "Supporting", lead: [], bullets: opts.j.support.slice(0, max).map((f) => f.text) });
  out.push({ heading: "Opposing", lead: [], bullets: opts.j.oppose.length ? opts.j.oppose.slice(0, max).map((f) => f.text) : ["Nothing significant opposes this area."] });
  out.push(...(opts.blocks ?? []).filter((b) => b.lead.length + b.bullets.length > 0));
  out.push({ heading: `Verdict: ${VERDICT_WORD[opts.j.level]}`, lead: [opts.verdict], bullets: [`Confidence: ${opts.confidence}`] });
  const t = opts.timing;
  if (t) {
    if (t.past.length) out.push({ heading: "Timing: past", lead: [], bullets: t.past });
    if (t.now.length) out.push({ heading: "Timing: now", lead: [], bullets: t.now });
    const ahead = [...t.ahead, ...t.transits, ...(opts.timingExtra ?? [])];
    if (ahead.length) out.push({ heading: "Timing: ahead", lead: [], bullets: ahead });
  } else if (opts.timingExtra?.length) {
    out.push({ heading: "Timing: ahead", lead: [], bullets: opts.timingExtra });
  }
  return out;
}

/** Replace a house factor (matched by its short label) with topic wording. */
export function retext(factors: Factor[], match: (f: Factor) => boolean, text: (f: Factor) => string): Factor[] {
  return factors.map((f) => (match(f) ? { ...f, text: text(f) } : f));
}

/** Mark which house each factor came from, for factors that read "the Nth". */
export function only(factors: Factor[], drop: (f: Factor) => boolean): Factor[] {
  return factors.filter((f) => !drop(f));
}

/** "the Moon" / "Mars" — article-aware planet naming for mid-sentence use. */
export function the(id: PlanetId, n: string): string {
  return id === "Su" || id === "Mo" ? `the ${n}` : n;
}

/** Confidence wording: "High on the strength of the career. Medium on the exact field." */
export function confidenceLine(main: Judgement["confidence"], about: string, second?: { level: Judgement["confidence"]; about: string }): string {
  return `${main} on ${about}.${second ? ` ${second.level} on ${second.about}.` : ""}`;
}
