/**
 * Worked example for the rectification module. Dev-only, never imported by the
 * app. Run with:  npx tsx utils/astrology/__checks__/rectifyDemo.ts
 */
import { EVENT_RULES } from "../rectification/eventRules";
import { rectify, type RectifyRequest } from "../rectification/rectify";
import type { LifeEvent, RectificationResult } from "../rectification/types";

const REQ: RectifyRequest = {
  birth: {
    name: "Worked Example",
    dateISO: "1988-06-14",
    time: "04:35",
    timezone: "Asia/Kolkata",
    lat: 18.9388,
    lon: 72.8354,
    placeName: "Mumbai, India",
    gender: "female",
    nodeMode: "mean",
  },
  events: [
    { id: "e1", type: "higherEducation", dateISO: "2006-07-01", precision: "month", reliability: "certain" },
    { id: "e2", type: "careerStart", dateISO: "2010-08-16", precision: "exact", reliability: "certain" },
    { id: "e3", type: "marriage", dateISO: "2014-11-28", precision: "exact", reliability: "certain" },
    { id: "e4", type: "foreignTravel", dateISO: "2016-03-01", precision: "month", reliability: "probable" },
    { id: "e5", type: "childbirth", dateISO: "2018-02-09", precision: "exact", reliability: "certain" },
    { id: "e6", type: "property", dateISO: "2020-01-01", precision: "year", reliability: "probable" },
    { id: "e7", type: "fatherDeath", dateISO: "2022-09-04", precision: "exact", reliability: "certain" },
  ] as LifeEvent[],
};

const r = rectify(REQ);

function curve(res: RectificationResult): void {
  const scores = res.candidates.map((c) => c.score);
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = hi - lo || 1;
  for (const c of res.candidates) {
    const bar = "█".repeat(Math.round(((c.score - lo) / span) * 40));
    const mark = c.offsetMin === res.best.offsetMin ? " ←BEST" : c.offsetMin === 0 ? " (recorded)" : "";
    console.log(
      `  ${String(c.offsetMin).padStart(3)}m ${c.localTime}  ${c.score.toFixed(4)}  ` +
        `asc ${c.ascendant.toFixed(2)}° D9:${c.d9LagnaSign} D60:${c.d60LagnaSign}  ${bar}${mark}`
    );
  }
}

function report(res: RectificationResult): void {
  console.log(`\n===== ${res.ayanamsha.toUpperCase()} =====`);
  curve(res);
  console.log(`\n  verdict: ${res.verdict.toUpperCase()} — ${res.verdictReason}`);
  console.log(
    `  best ${res.best.localTime} (${res.best.offsetMin >= 0 ? "+" : ""}${res.best.offsetMin}m), interval ${res.interval.startLocal}–${res.interval.endLocal}`
  );
  console.log(
    `  stats: median ${res.stats.median.toFixed(4)} mean ${res.stats.mean.toFixed(4)} sd ${res.stats.stdDev.toFixed(4)} z ${res.stats.zScore.toFixed(2)} margin ${res.stats.margin.toFixed(4)}`
  );
  console.log(
    `  dof: ${res.dof.events} events (effective ${res.dof.effectiveEvents.toFixed(2)}) vs ${res.dof.candidates} candidates, ${res.dof.freeParameters} free parameter`
  );
  console.log(`  stability: ${res.stability.stable ? "stable" : "UNSTABLE"} ${JSON.stringify(res.stability.hinges)}`);
  console.log(`  edge: ${res.edgeWarning}  highLeverage: ${res.highLeverageWindow}`);
  console.log("  warnings:");
  for (const w of res.warnings) console.log(`   ! ${w}`);
  console.log("  per-event at the winner:");
  for (const e of res.best.events) {
    console.log(
      `   ${e.hit ? "✓" : "·"} ${EVENT_RULES[e.type].label.padEnd(28)} ${e.score.toFixed(3)} (D ${e.dasha.score.toFixed(2)} T ${e.transit.score.toFixed(2)} V ${e.varga.score.toFixed(2)}, w ${e.weight.toFixed(2)}, n=${e.samples})`
    );
    console.log(`      ${e.summary}`);
  }
  console.log("  cross-checks:");
  for (const c of res.crossChecks) console.log(`   • ${c.label}: ${c.detail}`);
}

report(r.lahiri);
report(r.pushya);

console.log("\n===== RECONCILIATION =====");
console.log(`  divergence ${r.reconciliation.divergenceMin} min → ${r.reconciliation.tier} confidence`);
console.log(`  nakshatra divergence: ${r.reconciliation.nakshatraDivergence}`);
console.log(
  `  opening lord: Lahiri ${r.reconciliation.lahiriOpening.lord} (nak ${r.reconciliation.lahiriOpening.nakshatra + 1}) / Pushya ${r.reconciliation.pushyaOpening.lord} (nak ${r.reconciliation.pushyaOpening.nakshatra + 1})`
);
for (const s of r.reconciliation.eventSplit) {
  console.log(
    `   ${EVENT_RULES[s.type].label.padEnd(28)} L ${s.lahiriScore.toFixed(3)} | P ${s.pushyaScore.toFixed(3)} → ${s.favours}`
  );
}
for (const n of r.reconciliation.notes) console.log(`   - ${n}`);
console.log("\n  time warnings:");
for (const w of r.timeWarnings) console.log(`   ! ${w}`);
console.log(`\n  elapsed ${r.elapsedMs} ms`);
