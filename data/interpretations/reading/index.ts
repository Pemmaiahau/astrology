import { careerPart } from "./career";
import { foreignPart } from "./foreign";
import { healthPart } from "./health";
import { marriagePart } from "./marriage";
import { personalityPart } from "./personality";
import { timingPart } from "./timing";
import { wealthPart } from "./wealth";
import type { ReadingContext, ReadingPart } from "./context";

export type { ReadingContext, ReadingPart, ReadingSubsection } from "./context";
export { buildReadingContext } from "./context";

export const PART_BUILDERS: { key: string; build: (rc: ReadingContext, withTiming: boolean) => ReadingPart }[] = [
  { key: "personality", build: (rc) => personalityPart(rc) },
  { key: "career", build: careerPart },
  { key: "wealth", build: wealthPart },
  { key: "marriage", build: marriagePart },
  { key: "foreign", build: foreignPart },
  { key: "health", build: healthPart },
  { key: "timing", build: (rc) => timingPart(rc) },
];

/**
 * The whole report. `withTiming` adds the window scans (career, wealth,
 * marriage, foreign, Sade Sati), which cost a few hundred milliseconds — the
 * UI builds each part on demand, so it passes true only for opened parts.
 */
export function buildReading(rc: ReadingContext, opts: { withTiming: boolean }): ReadingPart[] {
  return PART_BUILDERS.map((p) => p.build(rc, opts.withTiming));
}
