/**
 * Dev-only smoke run for the Life Events timeline. NEVER imported by the app.
 *
 *   node utils/astrology/__checks__/run.mjs utils/astrology/__checks__/lifeEventsDemo.ts
 *
 * Prints the whole timeline for the canonical chart against a pinned "now",
 * so the shape and the plausibility of the output can be eyeballed without
 * starting the dev server.
 */

import { computeAshtakavarga } from "../ashtakavarga";
import { computeAutoChart } from "../chart";
import { PLANETS } from "../constants";
import { vimshottariTree } from "../dasha";
import { computeJaimini } from "../jaimini";
import { computeBhavaBala, computeShadbala } from "../shadbala";
import { allStrengths } from "../strength";
import { buildLifeEventTimeline } from "../../../data/interpretations/lifeEvents";
import type { AutoInputState, PlanetId } from "../types";

const NOW = new Date("2026-06-15T00:00:00.000Z");

const INPUT: AutoInputState = {
  name: "Canonical",
  dateISO: "1990-01-24",
  time: "12:30",
  place: { name: "New Delhi", country: "India", lat: 28.6139, lon: 77.209, timezone: "Asia/Kolkata" },
  gender: "male",
};

const chart = computeAutoChart(INPUT, "lahiri", "mean");
if (!chart || !chart.birthUtc) throw new Error("fixture failed to cast");

const signs: Partial<Record<PlanetId, number>> = {};
for (const id of PLANETS) {
  const p = chart.planets.find((q) => q.id === id);
  if (p) signs[id] = p.sign;
}
const av = computeAshtakavarga(signs, chart.ascendant.sign);
const shadbala = computeShadbala(chart);
const bhavaBala = shadbala ? computeBhavaBala(chart, shadbala) : null;

const t0 = Date.now();
const timeline = buildLifeEventTimeline({
  chart,
  dashaTree: vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc),
  ayanamsha: "lahiri",
  ashtakavarga: av,
  shadbala,
  bhavaBala,
  strengths: allStrengths(chart, av),
  jaimini: computeJaimini(chart),
  now: NOW,
});
const ms = Date.now() - t0;

const day = (d: Date) => d.toISOString().slice(0, 10);

console.log(`Built in ${ms} ms — ${timeline.entries.length} windows across ${timeline.promises.length} events`);
console.log(`Age now: ${timeline.currentAge?.toFixed(1)}\n`);

console.log("--- NATAL PROMISE (does the chart hold the event at all?) ---");
for (const p of timeline.promises) {
  console.log(
    `  ${String(p.score).padStart(3)}  ${p.verdict.padEnd(15)} ${p.label}${p.silent ? "   [no window cleared the floor]" : ""}`
  );
}

console.log("\n--- TIMELINE ---");
for (const e of timeline.entries) {
  const w = e.window;
  console.log(
    `  ${day(w.start)} → ${day(w.end)}  age ${String(w.ageRange.from).padStart(2)}–${String(w.ageRange.to).padEnd(2)}  ` +
      `${String(e.score).padStart(3)}/${String(w.confidence).padStart(2)}%  ${w.phase.padEnd(7)} ${e.label}`
  );
  console.log(`        ${w.label} — ${e.reasoning.headline}`);
  for (const s of w.subWindows ?? []) {
    console.log(`        · ${day(s.start)} → ${day(s.end)}  ${s.label.slice(0, 100)}`);
  }
}

console.log("\n--- ONE FULL REASONING PANEL ---");
const sample = timeline.entries.find((e) => e.window.phase !== "past") ?? timeline.entries[0];
if (sample) {
  console.log(`${sample.label}: ${day(sample.window.start)} → ${day(sample.window.end)}`);
  console.log(`  ${sample.reasoning.dashaLabel}`);
  console.log(`  Natal promise ${sample.reasoning.promiseScore}/100 (${sample.reasoning.promiseVerdict})`);
  console.log(`  Houses: primary ${sample.reasoning.houses.primary.join("/")} · negating ${sample.reasoning.houses.negating.join("/") || "none"}`);
  console.log(`  Karakas: ${sample.reasoning.karakas.join(", ")}`);
  console.log("  Weighted reasons:");
  for (const r of sample.reasoning.weighted) console.log(`    ${r.weight > 0 ? "+" : ""}${r.weight}  ${r.text}`);
  console.log("  Natal evidence:");
  for (const r of sample.reasoning.promiseEvidence) console.log(`    ${r.weight > 0 ? "+" : ""}${r.weight}  ${r.text}`);
  console.log("  Gochara:");
  for (const g of sample.reasoning.gocharaLines) console.log(`    ${g}`);
  if (sample.reasoning.saturnLine) console.log(`  Saturn: ${sample.reasoning.saturnLine}`);
  console.log(`  Doctrine: ${sample.reasoning.doctrine}`);
}

console.log("\n--- CAVEATS ---");
for (const c of timeline.caveats) console.log(`  · ${c}`);
