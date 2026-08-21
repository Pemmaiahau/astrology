/**
 * Dev-only golden-output snapshot. NEVER imported by the app.
 *
 *   node utils/astrology/__checks__/run.mjs golden           # compare
 *   node utils/astrology/__checks__/run.mjs golden --write   # accept changes
 *
 * `verify.ts` answers "is this number right?". This answers a different
 * question: "did anything at all change?" — which is what a refactor of the
 * interpretation layer actually needs. It renders every user-visible surface
 * for a fixed panel of charts into one deterministic text file, so a diff
 * shows precisely which readings moved and which did not.
 *
 * DETERMINISM RULES (break these and the snapshot churns for no reason):
 * - "Now" is pinned to `NOW`; never call `new Date()` without an argument.
 * - Every float is rounded at the point of printing (`n2`/`n3`/`n4`).
 * - Iteration follows fixed arrays (`PLANETS`, `VARGA_IDS`), never `Object.keys`.
 * - No `Date#toLocaleString` — it varies with the host ICU/locale. Use ISO.
 *
 * The panel is deliberately small and diverse rather than large: a canonical
 * Indian chart, one that exercises the yoga detectors heavily, a southern
 * hemisphere chart, and a polar chart that forces the equal-house fallback.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { computeAutoChart } from "../chart";
import { computeAshtakavarga } from "../ashtakavarga";
import { activeDashaAt, vimshottariTree } from "../dasha";
import { computeJaimini } from "../jaimini";
import { computePanchang } from "../panchang";
import { computeShadbala, computeBhavaBala } from "../shadbala";
import { allStrengths } from "../strength";
import { currentTransits, sadeSatiPhase } from "../transits";
import { computeVargaSet, VARGA_IDS } from "../varga";
import { detectYogas } from "../yogas";
import { computeNumerology } from "../numerology";
import { PLANETS, SHADBALA_PLANETS, SIGNS } from "../constants";
import { fmtDeg } from "../math";
import type { AutoInputState, ChartData, PlanetId } from "../types";
import { interpretFullChart } from "../../../data/interpretations/synthesis";
import { buildPersonalityProfile } from "../../../data/interpretations/personality";
import { buildCareerReport } from "../../../data/interpretations/career";
import { buildWealthReport } from "../../../data/interpretations/wealth";
import { buildMarriageReport } from "../../../data/interpretations/marriage";
import { buildForeignReport } from "../../../data/interpretations/foreign";
import { buildCautionsReport } from "../../../data/interpretations/cautions";
import { buildLuckyReport } from "../../../data/interpretations/lucky";
import { buildLifeAreaReports } from "../../../data/interpretations/lifeAreas";
import { buildYearForecast } from "../../../data/interpretations/yearForecast";

/** Pinned "today". Every time-relative reading is computed against this. */
const NOW = new Date("2026-06-15T00:00:00.000Z");
/** Pinned forecast window, so the year-forecast section never drifts. */
const YEAR_START = new Date(Date.UTC(2026, 0, 1));
const YEAR_END = new Date(Date.UTC(2027, 0, 1));

interface Fixture {
  label: string;
  note: string;
  input: AutoInputState;
}

const FIXTURES: Fixture[] = [
  {
    label: "canonical-delhi",
    note: "The repo's canonical chart (SOURCES.md verified-against ledger).",
    input: {
      name: "Canonical",
      dateISO: "1990-01-24",
      time: "12:30",
      place: { name: "New Delhi", country: "India", lat: 28.6139, lon: 77.209, timezone: "Asia/Kolkata" },
      gender: "male",
    },
  },
  {
    label: "pune-yoga-dense",
    note: "Aquarius lagna; exercises Neechabhanga (twice), Budhaditya, Chandra-Mangala, Sasa and the Raja-yoga pair loop.",
    input: {
      name: "Priya",
      dateISO: "1994-03-11",
      time: "06:15",
      place: { name: "Pune", country: "India", lat: 18.5204, lon: 73.8567, timezone: "Asia/Kolkata" },
      gender: "female",
    },
  },
  {
    label: "southern-hemisphere",
    note: "Southern latitude and a non-Indian timezone; checks nothing assumes the north.",
    input: {
      name: "Southern",
      dateISO: "1978-11-02",
      time: "21:40",
      place: { name: "Melbourne", country: "Australia", lat: -37.8136, lon: 144.9631, timezone: "Australia/Melbourne" },
      gender: "female",
    },
  },
  {
    label: "polar-equal-house",
    note: "Above the Arctic circle; forces the equal-house fallback in sripatiHouses (bhavaMethod: equal).",
    input: {
      name: "Polar",
      dateISO: "2001-12-21",
      time: "03:05",
      place: { name: "Tromso", country: "Norway", lat: 69.6492, lon: 18.9553, timezone: "Europe/Oslo" },
      gender: "male",
    },
  },
];

/* ------------------------------------------------------------------ *
 * Formatting helpers — every float goes through one of these.
 * ------------------------------------------------------------------ */

const n2 = (x: number): string => x.toFixed(2);
const n3 = (x: number): string => x.toFixed(3);
const n4 = (x: number): string => x.toFixed(4);
const iso = (d: Date): string => d.toISOString().slice(0, 19) + "Z";
const day = (d: Date): string => d.toISOString().slice(0, 10);

const out: string[] = [];
const w = (line = ""): void => void out.push(line);
const section = (title: string): void => {
  w();
  w(`--- ${title} ---`);
};

/** Numbered list of paragraphs — the shape most interpretation output takes. */
function paras(lines: string[], indent = "  "): void {
  lines.forEach((p, i) => w(`${indent}[${i + 1}] ${p}`));
}

/* ------------------------------------------------------------------ *
 * One chart, every surface.
 * ------------------------------------------------------------------ */

function snapshotChart(fx: Fixture): void {
  w();
  w("=".repeat(78));
  w(`CHART ${fx.label}`);
  w(`  ${fx.note}`);
  w(`  ${fx.input.dateISO} ${fx.input.time} ${fx.input.place!.timezone} @ ${fx.input.place!.name} (${n4(fx.input.place!.lat)}, ${n4(fx.input.place!.lon)}) gender=${fx.input.gender}`);
  w("=".repeat(78));

  const chart = computeAutoChart(fx.input, "lahiri", "mean");
  if (!chart) {
    w("  !! chart did not compute");
    return;
  }

  snapshotCore(chart);
  snapshotDerived(chart);
  snapshotInterpretation(chart);
}

function snapshotCore(chart: ChartData): void {
  section("meta");
  w(`  ayanamsha=${chart.meta.ayanamsha} value=${n4(chart.meta.ayanamshaValue)} node=${chart.meta.nodeMode ?? "mean"}`);
  w(`  bhavaMethod=${chart.meta.bhavaMethod ?? "none"} tz=${chart.meta.timezone} local=${chart.meta.localDateTime}`);
  w(`  birthUtc=${chart.birthUtc ? iso(chart.birthUtc) : "null"}`);

  section("ascendant");
  const a = chart.ascendant;
  w(`  ${SIGNS[a.sign]} ${fmtDeg(a.degInSign)} lon=${n4(a.longitude)} nak=${a.nakshatra} pada=${a.pada}`);
  w(`  mc=${chart.mc === undefined ? "none" : n4(chart.mc)}`);

  section("planets");
  for (const id of PLANETS) {
    const p = chart.planets.find((q) => q.id === id);
    if (!p) {
      w(`  ${id}  ABSENT`);
      continue;
    }
    const flags = [p.retrograde ? "R" : "", p.combust ? "C" : "", p.warWith ? `war:${p.warWith}${p.warWinner ? "+" : "-"}` : ""]
      .filter(Boolean)
      .join(",");
    w(
      `  ${id}  ${SIGNS[p.sign].padEnd(11)} ${fmtDeg(p.degInSign).padStart(7)} lon=${n4(p.longitude).padStart(8)} ` +
        `h=${String(p.house).padStart(2)} b=${String(p.bhava).padStart(2)} nak=${String(p.nakshatra).padStart(2)} pada=${p.pada} ` +
        `nakLord=${p.nakshatraLord} nakRel=${p.nakshatraRelation.padEnd(7)} ${p.dignity.padEnd(12)} spd=${n4(p.speed).padStart(8)} ${flags}`
    );
  }

  section("cusps (bhava madhya / sandhi)");
  w(`  madhya: ${(chart.cusps ?? []).map(n2).join(" ")}`);
  w(`  sandhi: ${(chart.sandhis ?? []).map(n2).join(" ")}`);
}

function snapshotDerived(chart: ChartData): void {
  const signs: Partial<Record<PlanetId, number>> = {};
  for (const id of PLANETS) {
    const p = chart.planets.find((q) => q.id === id);
    if (p) signs[id] = p.sign;
  }
  const av = computeAshtakavarga(signs, chart.ascendant.sign);
  const strengths = allStrengths(chart, av);
  const shadbala = computeShadbala(chart);
  const vargas = computeVargaSet(chart);
  const jaimini = computeJaimini(chart);

  section("ashtakavarga");
  for (const key of [...SHADBALA_PLANETS, "As"] as string[]) {
    w(`  ${key.padEnd(3)} ${av.bav[key].map((v) => String(v).padStart(2)).join(" ")}`);
  }
  w(`  SAV ${av.sav.map((v) => String(v).padStart(2)).join(" ")}  total=${av.sav.reduce((s, v) => s + v, 0)}`);

  section("composite strength");
  for (const id of PLANETS) {
    const s = strengths[id];
    if (!s) continue;
    w(`  ${id}  ${String(s.score).padStart(3)}/100 ${s.grade.padEnd(10)} factors=${s.factors.map((f) => `${f.label}:${f.delta}`).join(" | ")}`);
  }

  section("shadbala");
  if (!shadbala) {
    w("  null (no birth anchor)");
  } else {
    for (const id of SHADBALA_PLANETS) {
      const s = shadbala.planets[id];
      w(
        `  ${id}  total=${n3(s.totalVirupas).padStart(9)} rupas=${n3(s.rupas).padStart(7)} req=${n3(s.required).padStart(7)} ` +
          `ratio=${n3(s.ratio)} ishta=${n3(s.ishta)} kashta=${n3(s.kashta)}`
      );
    }
    w(`  strongest=${shadbala.strongest} weakest=${shadbala.weakest}`);

    const bb = computeBhavaBala(chart, shadbala);
    w(`  bhavaBala: ${bb.map((b) => `H${b.house}=${n3(b.totalVirupas)}`).join(" ")}`);
  }

  section("vargas");
  for (const vid of VARGA_IDS) {
    const vc = vargas.charts[vid];
    w(`  ${vid.padEnd(3)} asc=${String(vc.ascendant).padStart(2)}  ${PLANETS.map((id) => {
      const pos = vc.positions.find((p) => p.id === id);
      return `${id}:${pos ? String(pos.sign).padStart(2) : "--"}`;
    }).join(" ")}`);
  }
  w(`  vargottama: ${vargas.vargottama.join(",") || "none"}`);
  for (const id of SHADBALA_PLANETS) {
    const v = vargas.vimshopaka[id];
    w(`  vimshopaka ${id}  shad=${n3(v.shad)} sapta=${n3(v.sapta)} dasha=${n3(v.dasha)} shodasha=${n3(v.shodasha)}`);
  }

  section("jaimini");
  w(`  karakas: ${(Object.keys(jaimini.karakas) as (keyof typeof jaimini.karakas)[]).map((k) => `${k}=${jaimini.karakas[k]}`).join(" ")}`);
  w(`  karakamsa=${jaimini.karakamsa} arudhaLagna=${jaimini.arudhaLagna} upapada=${jaimini.upapada}`);
  jaimini.argala.forEach((ar, i) =>
    w(`  argala H${String(i + 1).padStart(2)} intervening=[${ar.intervening.join(",")}] obstructing=[${ar.obstructing.join(",")}]`)
  );

  section("panchang (at birth)");
  const sun = chart.planets.find((p) => p.id === "Su");
  const moon = chart.planets.find((p) => p.id === "Mo");
  if (chart.birthUtc && sun && moon) {
    const pan = computePanchang(sun.longitude, moon.longitude, chart.birthUtc, chart.meta.timezone, chart.lat, chart.lon);
    w(`  tithi=${pan.tithiIndex} ${pan.tithiName} (${pan.paksha})  vara=${pan.varaIndex} ${pan.varaName}`);
    w(`  nakshatra=${pan.nakshatraIndex} ${pan.nakshatraName}  yoga=${pan.yogaIndex} ${pan.yogaName}  karana=${pan.karanaName}`);
    w(`  sunrise=${pan.sunrise ? iso(pan.sunrise) : "none"}`);
  }

  section("dasha");
  const tree = chart.birthUtc && moon ? vimshottariTree(moon.longitude, chart.birthUtc) : null;
  if (!tree) {
    w("  null");
  } else {
    for (const md of tree) w(`  MD ${md.lord}  ${day(md.start)} -> ${day(md.end)}`);
    const active = activeDashaAt(tree, NOW);
    w(`  active@${day(NOW)}: ${active ? `${active.maha.lord}-${active.antar.lord}-${active.pratyantar.lord}` : "none"}`);
  }

  section("transits + sade sati (pinned now)");
  const transits = currentTransits(chart, "lahiri", NOW);
  for (const t of transits) {
    w(`  ${t.id}  ${SIGNS[t.sign].padEnd(11)} ${fmtDeg(t.degInSign).padStart(7)} fromMoon=${String(t.houseFromMoon).padStart(2)} fromLagna=${String(t.houseFromLagna).padStart(2)} ${t.retrograde ? "R" : ""}`);
  }
  w(`  sadeSatiPhase=${sadeSatiPhase(transits) ?? "none"}`);

  section("numerology");
  const num = computeNumerology(chart.meta.localDateTime?.slice(0, 10), chart.meta.name, chart.meta.gender);
  w(`  ${num ? `moolank=${num.moolank} bhagyank=${num.bhagyank} namank=${num.namank} kua=${num.kua} caveats=${num.caveats.length}` : "null"}`);
}

function snapshotInterpretation(chart: ChartData): void {
  const signs: Partial<Record<PlanetId, number>> = {};
  for (const id of PLANETS) {
    const p = chart.planets.find((q) => q.id === id);
    if (p) signs[id] = p.sign;
  }
  const av = computeAshtakavarga(signs, chart.ascendant.sign);
  const strengths = allStrengths(chart, av);
  const shadbala = computeShadbala(chart);
  const vargas = computeVargaSet(chart);
  const jaimini = computeJaimini(chart);
  const yogas = detectYogas(chart);
  const moon = chart.planets.find((p) => p.id === "Mo");
  const tree = chart.birthUtc && moon ? vimshottariTree(moon.longitude, chart.birthUtc) : null;

  section("yogas");
  if (yogas.length === 0) w("  (none)");
  for (const y of yogas) {
    w(`  [${y.key}] ${y.name}  planets=${y.planets.join(",")}`);
    w(`      ${y.description}`);
  }

  section("personality");
  const per = buildPersonalityProfile(chart, strengths, yogas, { vargas, jaimini, shadbala });
  w(`  headline: ${per.headline}`);
  w(`  strongest=${per.strongest} weakest=${per.weakest}`);
  for (const s of per.sections) {
    w(`  == ${s.heading}`);
    paras(s.paragraphs, "     ");
  }

  section("houses");
  for (const h of interpretFullChart(chart, strengths)) {
    w(`  == ${h.title}  occupied=${h.occupied} lord=${h.lord.id} planets=[${h.planets.map((p) => p.id).join(",")}] aspects=[${h.aspects.map((d) => `${d.from}:${d.offset}`).join(",")}]`);
    paras(h.paragraphs, "     ");
  }

  section("life areas");
  for (const area of buildLifeAreaReports(chart, tree, av, yogas, NOW)) {
    const a = area as unknown as Record<string, unknown>;
    w(`  == ${String(a.key)} score=${String(a.score)} verdict=${String(a.verdict)}`);
  }

  const reports = [
    ["career", buildCareerReport(chart, vargas, jaimini, shadbala, strengths, yogas)],
    ["wealth", buildWealthReport(chart, vargas, strengths, yogas)],
    ["marriage", buildMarriageReport(chart, vargas, jaimini, strengths, yogas)],
    ["foreign", buildForeignReport(chart, vargas, strengths)],
    ["cautions", buildCautionsReport(chart, strengths, shadbala, yogas, tree, NOW)],
    ["lucky", buildLuckyReport(chart, strengths, shadbala, computeNumerology(chart.meta.localDateTime?.slice(0, 10), chart.meta.name, chart.meta.gender))],
  ] as const;

  for (const [name, rep] of reports) {
    section(`section: ${name}`);
    const r = rep as unknown as {
      headline: string;
      score?: number;
      verdict?: string;
      confidence: number;
      caveats: string[];
      blocks: {
        heading: string;
        paragraphs: string[];
        reasons?: { text: string; weight: number; source?: { work: string; ref?: string } }[];
        items?: { key: string; label: string; score: number; verdict: string; reasons: { text: string; weight: number }[] }[];
        windows?: { label: string; grade: string; confidence: number }[];
      }[];
    };
    w(`  headline: ${r.headline}`);
    w(`  score=${r.score ?? "none"} verdict=${r.verdict ?? "none"} confidence=${r.confidence}`);
    if (r.caveats.length) r.caveats.forEach((c) => w(`  caveat: ${c}`));
    for (const b of r.blocks) {
      w(`  == ${b.heading}`);
      paras(b.paragraphs, "     ");
      for (const e of b.reasons ?? []) {
        w(`     why(${e.weight}) ${e.text}${e.source ? ` [${e.source.work}${e.source.ref ? `, ${e.source.ref}` : ""}]` : ""}`);
      }
      for (const it of b.items ?? []) {
        w(`     item ${it.key} score=${it.score} verdict=${it.verdict} :: ${it.label}`);
        for (const e of it.reasons) w(`        why(${e.weight}) ${e.text}`);
      }
      for (const win of b.windows ?? []) w(`     window ${win.label} grade=${win.grade} confidence=${win.confidence}`);
    }
  }

  section("year forecast 2026 (pinned window)");
  const fc = buildYearForecast(chart, tree, "lahiri", YEAR_START, YEAR_END);
  w(`  hasDasha=${fc.hasDasha} beforeBirth=${fc.beforeBirth}`);
  for (const m of fc.mahaSegments) w(`  maha ${m.lord} ${day(m.start)}->${day(m.end)}: ${m.text}`);
  if (fc.sadeSatiText) w(`  sadeSati: ${fc.sadeSatiText}`);
  for (const seg of fc.timeline) {
    w(`  seg ${day(seg.start)}->${day(seg.end)} [${seg.boundaryReason}] ${seg.maha ?? "-"}-${seg.antar ?? "-"}`);
    if (seg.antarText) w(`     antar: ${seg.antarText}`);
    for (const t of seg.transits) w(`     transit ${t.id} sign=${t.sign} fromMoon=${t.houseFromMoon} fromLagna=${t.houseFromLagna}${t.retrograde ? " R" : ""}: ${t.text}`);
    for (const p of seg.pratyantars) w(`     praty ${p.lord} ${day(p.start)}->${day(p.end)}: ${p.theme}`);
  }
  for (const m of fc.months) {
    w(`  month ${m.label} | ${m.dashaLine ?? ""}`);
    paras(m.paragraphs, "     ");
  }
}

/* ------------------------------------------------------------------ *
 * Diffing
 * ------------------------------------------------------------------ */

const MAX_DIFF_LINES = 400;

interface Hunk {
  /** 1-based line number in the baseline where the hunk starts. */
  line: number;
  removed: string[];
  added: string[];
}

/**
 * Line diff via longest common subsequence.
 *
 * A positional `a[i] !== b[i]` walk is not good enough here: inserting or
 * dropping a single line shifts everything after it, so one real change gets
 * reported as hundreds. That turns the only question this harness exists to
 * answer — "what actually moved?" — back into manual reading. Common prefix
 * and suffix are trimmed first, which on a typical run leaves an LCS table of
 * a few dozen rows rather than the full 2,000².
 */
function diffLines(a: string[], b: string[]): Hunk[] {
  let lo = 0;
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
  let hiA = a.length;
  let hiB = b.length;
  while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) {
    hiA--;
    hiB--;
  }

  const x = a.slice(lo, hiA);
  const y = b.slice(lo, hiB);
  const n = x.length;
  const m = y.length;

  // LCS lengths. Int32Array keeps a large middle section affordable.
  const dp = new Int32Array((n + 1) * (m + 1));
  const at = (i: number, j: number): number => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[at(i, j)] =
        x[i] === y[j] ? dp[at(i + 1, j + 1)] + 1 : Math.max(dp[at(i + 1, j)], dp[at(i, j + 1)]);
    }
  }

  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  let current: Hunk | null = null;
  const flush = (): void => {
    if (current && (current.removed.length || current.added.length)) hunks.push(current);
    current = null;
  };

  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      flush();
      i++;
      j++;
      continue;
    }
    if (!current) current = { line: lo + i + 1, removed: [], added: [] };
    if (j < m && (i >= n || dp[at(i, j + 1)] >= dp[at(i + 1, j)])) {
      current.added.push(y[j++]);
    } else {
      current.removed.push(x[i++]);
    }
  }
  flush();
  return hunks;
}

/* ------------------------------------------------------------------ *
 * Entry point: render, then compare or write.
 * ------------------------------------------------------------------ */

w("GOLDEN OUTPUT SNAPSHOT");
w(`pinned now:      ${iso(NOW)}`);
w(`forecast window: ${day(YEAR_START)} -> ${day(YEAR_END)}`);
w(`ayanamsha:       lahiri   node mode: mean`);
w(`fixtures:        ${FIXTURES.length}`);
for (const fx of FIXTURES) snapshotChart(fx);
w();

const rendered = out.join("\n") + "\n";
const snapshotPath = path.join(import.meta.dirname ?? ".", "golden.snapshot.txt");
const write = process.argv.includes("--write");

if (write || !existsSync(snapshotPath)) {
  writeFileSync(snapshotPath, rendered, "utf8");
  const action = write ? "WROTE" : "CREATED (no baseline existed)";
  console.log(`${action} ${snapshotPath}`);
  console.log(`${rendered.split("\n").length} lines, ${rendered.length} bytes`);
} else {
  const expected = readFileSync(snapshotPath, "utf8");
  if (expected === rendered) {
    console.log(`GOLDEN OK — output identical to ${path.basename(snapshotPath)} (${rendered.split("\n").length} lines)`);
  } else {
    const hunks = diffLines(expected.split("\n"), rendered.split("\n"));
    const removed = hunks.reduce((n, h) => n + h.removed.length, 0);
    const added = hunks.reduce((n, h) => n + h.added.length, 0);
    console.log(`GOLDEN DIFF — ${hunks.length} hunk(s): ${removed} line(s) removed, ${added} added\n`);
    let printed = 0;
    for (const h of hunks) {
      if (printed >= MAX_DIFF_LINES) {
        console.log(`  … ${hunks.length - hunks.indexOf(h)} more hunk(s) suppressed`);
        break;
      }
      console.log(`  @@ line ${h.line} @@`);
      for (const l of h.removed) console.log(`    - ${l}`);
      for (const l of h.added) console.log(`    + ${l}`);
      printed += h.removed.length + h.added.length;
    }
    console.log(`\nRe-run with --write to accept these changes as the new baseline.`);
    process.exitCode = 1;
  }
}
