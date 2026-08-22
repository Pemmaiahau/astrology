/**
 * Dev-only smoke run for the Speculation and Intimacy sections. NEVER imported
 * by the app.
 *
 *   node utils/astrology/__checks__/run.mjs adult
 */
import { computeAshtakavarga } from "../ashtakavarga";
import { computeAutoChart } from "../chart";
import { PLANETS } from "../constants";
import { vimshottariTree } from "../dasha";
import { computeJaimini } from "../jaimini";
import { computeBhavaBala, computeShadbala } from "../shadbala";
import { allStrengths } from "../strength";
import { computeVargaSet } from "../varga";
import { detectYogas } from "../yogas";
import { buildSpeculationReport, speculationYearWindows } from "../../../data/interpretations/speculation";
import { buildIntimacyReport } from "../../../data/interpretations/intimacy";
import { buildIntimacyTiming } from "../../../data/interpretations/intimacyTiming";
import type { AutoInputState, PlanetId } from "../types";

const NOW = new Date("2026-06-15T00:00:00.000Z");
const INPUT: AutoInputState = {
  name: "AU-Canonical",
  dateISO: "1990-01-24",
  time: "12:30",
  place: { name: "New Delhi", country: "India", lat: 28.6139, lon: 77.209, timezone: "Asia/Kolkata" },
  gender: "other",
};

const chart = computeAutoChart(INPUT, "lahiri", "mean")!;
const signs: Partial<Record<PlanetId, number>> = {};
for (const id of PLANETS) {
  const p = chart.planets.find((q) => q.id === id);
  if (p) signs[id] = p.sign;
}
const av = computeAshtakavarga(signs, chart.ascendant.sign);
const sb = computeShadbala(chart);
const bb = sb ? computeBhavaBala(chart, sb) : null;
const strengths = allStrengths(chart, av);
const vargas = computeVargaSet(chart);
const jaimini = computeJaimini(chart);
const yogas = detectYogas(chart);

const spec = buildSpeculationReport(chart, vargas, jaimini, sb, strengths, av, yogas, bb);
console.log(`=== SPECULATION: ${spec.score}/100 ${spec.verdict} (confidence ${spec.confidence}) ===`);
console.log(`  axes: ${spec.axes.map((a) => `${a.label} ${a.score}`).join(" | ")}`);
console.log(`  works ${spec.worksBecause.length} / fails ${spec.failsBecause.length}`);
const depthBlock = spec.blocks.find((b) => b.heading === "Deeper classical tests");
console.log(`  deeper-tests block: ${depthBlock ? `${depthBlock.paragraphs.length} paragraphs, ${depthBlock.reasons?.length ?? 0} reasons` : "MISSING"}`);
for (const para of depthBlock?.paragraphs ?? []) console.log(`    · ${para.slice(0, 210)}`);
console.log("  top new rows:");
for (const r of [...spec.worksBecause.slice(0, 3), ...spec.failsBecause.slice(0, 3)]) {
  console.log(`    ${r.weight > 0 ? "+" : ""}${r.weight}  ${r.text.slice(0, 170)}`);
}

const tree = vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!);
const year = speculationYearWindows(
  chart, tree, "lahiri", av,
  new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)), NOW, strengths
);
console.log(`\n  2026: ${year.favourable.length} favourable / ${year.adverse.length} adverse windows`);
const munthaNotes = year.months.flatMap((m) => m.notes).filter((n) => n.includes("Muntha"));
console.log(`  Muntha surfaced in ${munthaNotes.length} month notes: ${munthaNotes[0]?.slice(0, 150) ?? "NONE"}`);
const kakshaNotes = year.months.flatMap((m) => m.notes).filter((n) => n.includes("of its own 8 bindus"));
console.log(`  own-bindu rows: ${kakshaNotes.length}; e.g. ${kakshaNotes[0]?.slice(0, 120) ?? "none"}`);

const int = buildIntimacyReport(chart, vargas, jaimini, sb, strengths, yogas, av, bb);
console.log(`\n=== INTIMACY: ${int.score}/100 ${int.verdict} (confidence ${int.confidence}) ===`);
console.log(`  facets: ${int.facets.map((f) => `${f.label} ${f.score}`).join(" | ")}`);
console.log(`  strengths ${int.strengths.length} / frictions ${int.frictions.length}`);
const intDepth = int.blocks.find((b) => b.heading === "Deeper classical tests");
console.log(`  deeper-tests block: ${intDepth ? `${intDepth.paragraphs.length} paragraphs, ${intDepth.reasons?.length ?? 0} reasons` : "MISSING"}`);
for (const para of intDepth?.paragraphs ?? []) console.log(`    · ${para.slice(0, 210)}`);
console.log("  top new rows:");
for (const r of [...int.strengths.slice(0, 3), ...int.frictions.slice(0, 3)]) {
  console.log(`    ${r.weight > 0 ? "+" : ""}${r.weight}  ${r.text.slice(0, 170)}`);
}

const all = [
  ...spec.worksBecause, ...spec.failsBecause, ...int.strengths, ...int.frictions,
].map((r) => r.text).join(" ");
console.log(`\nundefined/NaN leaks across every evidence row: ${(all.match(/undefined|NaN/g) ?? []).length}`);

console.log("\n=== INTIMACY TIMING (point 1) ===");
const timing = buildIntimacyTiming({
  chart, dashaTree: vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!),
  ayanamsha: "lahiri", ashtakavarga: av, shadbala: sb, bhavaBala: bb, strengths, now: NOW,
});
const day = (d: Date) => d.toISOString().slice(0, 10);
console.log(`  hasDasha=${timing.hasDasha}  gochara lines=${timing.currentGochara.length}  retro=${timing.retrograde.length}`);
console.log(`  saturn: ${timing.saturnStance ?? "(no standing stance)"}`);
for (const g of timing.currentGochara) console.log(`    ${g.polarity.padEnd(11)} ${g.text.slice(0, 120)}`);
for (const t of timing.themes) {
  console.log(`  -- ${t.label} (natal promise ${t.promise}/100) — ${t.windows.length} windows`);
  for (const w of t.windows) {
    console.log(`     ${day(w.start)} → ${day(w.end)}  age ${w.ageRange.from}-${w.ageRange.to}  ${w.grade}/${w.confidence}%  ${w.phase}  ${w.label}`);
    for (const sw of w.subWindows ?? []) console.log(`        · ${day(sw.start)} → ${day(sw.end)} ${sw.label.slice(0, 90)}`);
  }
}
const minAge = Math.min(...timing.themes.flatMap((t) => t.windows.map((w) => w.ageRange.from)));
console.log(`  earliest window age: ${minAge} (must be >= 18)`);
for (const r of timing.retrograde.slice(0, 3)) console.log(`  retro ${r.id}: ${day(r.start)} → ${day(r.end)}`);

console.log("\n=== D-30 CLASSICAL CLAIM (point 2) ===");
const t30 = int.blocks.find((b) => b.heading === "A contested classical claim, reported for testing");
if (!t30) console.log("  MISSING");
else for (const para of t30.paragraphs) console.log(`  · ${para.slice(0, 260)}`);
