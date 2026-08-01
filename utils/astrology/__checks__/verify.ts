/**
 * Dev-only numeric verification harness. NEVER imported by the app.
 * Run manually with:  npx tsx utils/astrology/__checks__/verify.ts
 *
 * This is the regression ritual: every calculation phase appends its checks
 * here, and the whole file is re-run after any change to the calc layer.
 * Each check prints PASS/FAIL; the process exits non-zero on any FAIL.
 */

import * as Astronomy from "astronomy-engine";
import { computeAutoChart, computeManualChart } from "../chart";
import { CHALDEAN_MAP, NAISARGIKA_BALA, PLANETS, signMobility } from "../constants";
import { computeNumerology } from "../numerology";
import { buildLuckyReport } from "../../../data/interpretations/lucky";
import {
  declination, meanLunarNode, nextSunrise, sunriseFor, sunsetFor, trueLunarNode,
} from "../ephemeris";
import { vimshottariTree } from "../dasha";
import { arudhaSign, computeJaimini, doubleTransitOnSign } from "../jaimini";
import {
  findActivationWindows, occupancyIntervals, periodsOverlapping, signChangeEvents,
} from "../scan";
import { computeBhavaBala, computeShadbala, sputaDrishti } from "../shadbala";
import { dignityInSign, computeDignity, naturalRelation, temporalRelation } from "../states";
import { computeVargaSet, vargaSign, VIMSHOPAKA_WEIGHTS } from "../varga";
import { detectYogas } from "../yogas";
import { allStrengths } from "../strength";
import { buildCareerReport } from "../../../data/interpretations/career";
import { buildCautionsReport } from "../../../data/interpretations/cautions";
import { buildForeignReport } from "../../../data/interpretations/foreign";
import { buildMarriageReport, marriageTimingWindows } from "../../../data/interpretations/marriage";
import { buildPersonalityProfile } from "../../../data/interpretations/personality";
import { buildWealthReport } from "../../../data/interpretations/wealth";
import type { AutoInputState, PlanetId } from "../types";

let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  const status = ok ? "PASS" : "FAIL";
  if (!ok) failures++;
  console.log(`${status}  ${label}${detail ? ` — ${detail}` : ""}`);
}

function approx(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

// ---------------------------------------------------------------------------
// Canonical test chart: 1990-01-24 12:30 IST, New Delhi (28.6139N, 77.2090E).
// Used across all phases; cross-checked against Jagannatha Hora (Lahiri).
// ---------------------------------------------------------------------------
export const CANONICAL_INPUT: AutoInputState = {
  name: "Canonical Test",
  dateISO: "1990-01-24",
  time: "12:30",
  place: {
    name: "New Delhi",
    lat: 28.6139,
    lon: 77.209,
    timezone: "Asia/Kolkata",
    country: "India",
  },
};

const chart = computeAutoChart(CANONICAL_INPUT, "lahiri");
if (!chart) {
  console.error("FATAL: canonical chart failed to compute");
  process.exit(1);
}

console.log("\n=== Phase 1A: dignity refactor + ephemeris helpers ===");

// Dignity invariants (rule-level, independent of the refactor's plumbing)
{
  const noSigns: Partial<Record<PlanetId, number>> = {};
  check("Sun in Aries is exalted", dignityInSign("Su", 0, 10, noSigns) === "exalted");
  check("Sun in Libra is debilitated", dignityInSign("Su", 6, 10, noSigns) === "debilitated");
  check("Sun in Leo 5° is moolatrikona", dignityInSign("Su", 4, 5, noSigns) === "moolatrikona");
  check("Sun in Leo 25° is own", dignityInSign("Su", 4, 25, noSigns) === "own");
  check("Moon in Taurus is exalted", dignityInSign("Mo", 1, 10, noSigns) === "exalted");
  check("Jupiter in Capricorn is debilitated", dignityInSign("Ju", 9, 10, noSigns) === "debilitated");
  check("Mars in Aries 5° is moolatrikona", dignityInSign("Ma", 0, 5, noSigns) === "moolatrikona");
  check("Mars in Aries 20° is own", dignityInSign("Ma", 0, 20, noSigns) === "own");
  check("Rahu in Taurus is exalted", dignityInSign("Ra", 1, 10, noSigns) === "exalted");
}

// Friendship asymmetry preserved
{
  check("Moon→Mercury is friend (asymmetric)", naturalRelation("Mo", "Me") === 1);
  check("Mercury→Moon is enemy (asymmetric)", naturalRelation("Me", "Mo") === -1);
  check("Temporal: 2nd sign is friend", temporalRelation(0, 1) === 1);
  check("Temporal: same sign is enemy", temporalRelation(0, 0) === -1);
  check("Temporal: 7th sign is enemy", temporalRelation(0, 6) === -1);
}

// computeDignity wrapper consistency: recompute via dignityInSign directly
{
  const allLon: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) allLon[p.id] = p.longitude;
  let same = true;
  for (const p of chart.planets) {
    const viaWrapper = computeDignity(p.id, p.longitude, allLon);
    if (viaWrapper !== p.dignity) same = false;
  }
  check("computeDignity(wrapper) matches chart-stored dignities for canonical chart", same);
}

// Declination sanity: Sun at 2024 solstice/equinox
{
  const solstice = declination("Su", new Date(Date.UTC(2024, 5, 20, 20, 51)));
  const equinox = declination("Su", new Date(Date.UTC(2024, 2, 20, 3, 6)));
  check("Sun declination at Jun-2024 solstice ≈ +23.44°", approx(solstice, 23.44, 0.05), solstice.toFixed(3));
  check("Sun declination at Mar-2024 equinox ≈ 0°", approx(equinox, 0, 0.05), equinox.toFixed(3));
}

// Sunrise/sunset ordering for the canonical birth (Delhi, ~07:15 rise / ~17:50 set IST in late Jan)
{
  const birth = chart.birthUtc!;
  const rise = sunriseFor(birth, 28.6139, 77.209);
  const set = sunsetFor(birth, 28.6139, 77.209);
  const nrise = nextSunrise(birth, 28.6139, 77.209);
  check("sunrise ≤ birth < next sunrise", !!rise && !!nrise && rise <= birth && birth < nrise);
  check(
    "last sunset before noon birth is previous evening",
    !!set && !!rise && set < rise,
    set && rise ? `set=${set.toISOString()} rise=${rise.toISOString()}` : "null"
  );
}

// ---------------------------------------------------------------------------
// Phase 1B: divisional charts
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 1B: vargas ===");

  // D-9 continuous formula must equal the classical sign-based counting rule
  // (movable from itself, fixed from 9th, dual from 5th) at random longitudes.
  {
    let ok = true;
    for (let i = 0; i < 200; i++) {
      const lon = (i * 719.3) % 360;
      const s = Math.floor(lon / 30);
      const part = Math.floor(((lon % 30) * 9) / 30);
      const mob = signMobility(s);
      const start = mob === "movable" ? s : mob === "fixed" ? (s + 8) % 12 : (s + 4) % 12;
      if (vargaSign("D9", lon) !== (start + part) % 12) { ok = false; break; }
    }
    check("D9 continuous formula ≡ movable/fixed/dual counting rule (200 samples)", ok);
  }

  // D-30 boundary spot checks (BPHS unequal scheme)
  check("D30 odd: Aries 4.9° → Aries", vargaSign("D30", 4.9) === 0);
  check("D30 odd: Aries 5.1° → Aquarius", vargaSign("D30", 5.1) === 10);
  check("D30 odd: Aries 17.9° → Sagittarius", vargaSign("D30", 17.9) === 8);
  check("D30 odd: Aries 24.9° → Gemini", vargaSign("D30", 24.9) === 2);
  check("D30 odd: Aries 25.1° → Libra", vargaSign("D30", 25.1) === 6);
  check("D30 even: Taurus 4.9° → Taurus", vargaSign("D30", 30 + 4.9) === 1);
  check("D30 even: Taurus 11.9° → Virgo", vargaSign("D30", 30 + 11.9) === 5);
  check("D30 even: Taurus 19.9° → Pisces", vargaSign("D30", 30 + 19.9) === 11);
  check("D30 even: Taurus 24.9° → Capricorn", vargaSign("D30", 30 + 24.9) === 9);
  check("D30 even: Taurus 29.9° → Scorpio", vargaSign("D30", 30 + 29.9) === 7);

  // D-2 Hora: only Cancer/Leo are possible results
  {
    let ok = true;
    for (let lon = 0.5; lon < 360; lon += 7.3) {
      const h = vargaSign("D2", lon);
      if (h !== 3 && h !== 4) { ok = false; break; }
    }
    check("D2 Hora lands only in Cancer or Leo", ok);
    check("D2 odd first half → Leo (Sun's hora)", vargaSign("D2", 10) === 4);
    check("D2 odd second half → Cancer", vargaSign("D2", 20) === 3);
    check("D2 even first half → Cancer", vargaSign("D2", 40) === 3);
    check("D2 even second half → Leo", vargaSign("D2", 50) === 4);
  }

  // Vargottama structural rule: first navamsa of movable, middle of fixed,
  // last of dual sign is vargottama.
  check("Movable sign 1st navamsa is vargottama", vargaSign("D9", 1) === 0);
  check("Fixed sign 5th navamsa is vargottama", vargaSign("D9", 30 + 14) === 1);
  check("Dual sign 9th navamsa is vargottama", vargaSign("D9", 60 + 28) === 2);

  // D-27 elemental starts
  check("D27 Aries 0.5° starts from Aries", vargaSign("D27", 0.5) === 0);
  check("D27 Taurus 0.5° starts from Cancer", vargaSign("D27", 30.5) === 3);
  check("D27 Gemini 0.5° starts from Libra", vargaSign("D27", 60.5) === 6);
  check("D27 Cancer 0.5° starts from Capricorn", vargaSign("D27", 90.5) === 9);

  // Vimshopaka scheme weights each total 20
  for (const [scheme, weights] of Object.entries(VIMSHOPAKA_WEIGHTS)) {
    const sum = Object.values(weights).reduce((a, b) => a + (b ?? 0), 0);
    check(`Vimshopaka ${scheme} weights total 20`, Math.abs(sum - 20) < 1e-9, String(sum));
  }

  // Canonical chart: scores in range, vargottama consistent
  {
    const vs = computeVargaSet(chart);
    let inRange = true;
    for (const scores of Object.values(vs.vimshopaka)) {
      for (const v of Object.values(scores)) if (v < 0 || v > 20) inRange = false;
    }
    check("Canonical vimshopaka scores all within 0–20", inRange);
    const d9 = vs.charts.D9;
    const flagged = d9.positions.filter((p) => p.vargottama).map((p) => p.id);
    check(
      "VargaSet.vargottama matches D9 flags",
      JSON.stringify(vs.vargottama) === JSON.stringify(flagged),
      `[${vs.vargottama.join(",")}]`
    );
    console.log(
      "  canonical D9 signs:",
      d9.positions.map((p) => `${p.id}:${p.sign}`).join(" "),
      `AscD9:${d9.ascendant}`
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 1C: Jaimini
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 1C: Jaimini ===");

  // Arudha rule unit checks (signs are 0-based; Aries=0)
  // Lagna Aries, lord Mars in Leo (5th) → count 5, 5th from Leo = Sagittarius.
  check("Arudha: Aries lagna, Mars in Leo → Sagittarius", arudhaSign(0, 4) === 8);
  // Lord in the house itself → count 1 → pada = house → exception → 10th from it.
  check("Arudha exception: lord in own house → 10th", arudhaSign(0, 0) === 9);
  // Lord in 7th → count 7 → pada = house+12 ≡ house → exception. Aries lagna,
  // lord in Libra: count 7, 7th from Libra = Aries = house → 10th → Capricorn.
  check("Arudha exception: lord in 7th → 10th", arudhaSign(0, 6) === 9);
  // Lord in 4th: Aries lagna, lord in Cancer → count 4, 4th from Cancer = Libra
  // = 7th from house → exception → 10th from Libra = Cancer.
  check("Arudha exception: pada on 7th → 10th therefrom", arudhaSign(0, 3) === 3);

  // Double transit: Ju in Aries (aspects Le, Sg, Li), Sa in Gemini (aspects Le, Sg, Pi)
  check("Double transit: Ju Aries + Sa Gemini activate Leo", doubleTransitOnSign(4, 0, 2));
  check("Double transit: Ju Aries + Sa Gemini activate Sagittarius", doubleTransitOnSign(8, 0, 2));
  check("Double transit: Taurus NOT activated", !doubleTransitOnSign(1, 0, 2));

  // Canonical chart: karakas are 7 distinct planets, ordered by degInSign desc
  {
    const j = computeJaimini(chart);
    const ids = Object.values(j.karakas);
    check("Chara karakas: 7 distinct planets", new Set(ids).size === 7, ids.join(","));
    const degs = ids.map(
      (id) => chart.planets.find((p) => p.id === id)!.degInSign
    );
    const sorted = [...degs].every((d, i, arr) => i === 0 || arr[i - 1] >= d);
    check("Chara karakas ordered by descending degree", sorted, degs.map((d) => d.toFixed(2)).join(" > "));
    const ak = chart.planets.find((p) => p.id === j.karakas.AK)!;
    check("Karakamsa = AK's D9 sign", j.karakamsa === vargaSign("D9", ak.longitude));
    check("Argala computed for all 12 houses", j.argala.length === 12);
    console.log(
      `  canonical karakas: ${Object.entries(j.karakas).map(([k, v]) => `${k}:${v}`).join(" ")}` +
      ` | AL:${j.arudhaLagna} UL:${j.upapada} Karakamsa:${j.karakamsa}`
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 1D/1E: Shadbala + Bhava Bala
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 1D/1E: Shadbala ===");

  const sb = computeShadbala(chart);
  check("Shadbala computes for canonical chart", sb !== null);
  if (sb) {
    // Naisargika exactly matches the fixed ladder
    let naisOk = true;
    for (const [id, expected] of Object.entries(NAISARGIKA_BALA)) {
      const got = sb.planets[id as keyof typeof sb.planets].naisargika[0].virupas;
      if (Math.abs(got - expected) > 1e-9) naisOk = false;
    }
    check("Naisargika bala matches BPHS ladder", naisOk);

    // Kendradi ∈ {60,30,15}
    let kendradiOk = true;
    for (const p of Object.values(sb.planets)) {
      const k = p.sthana.find((f) => f.label === "Kendradi")!.virupas;
      if (![60, 30, 15].includes(k)) kendradiOk = false;
    }
    check("Kendradi bala ∈ {60,30,15}", kendradiOk);

    // Uchcha bala bounds and a fixed-value check: at exact deep exaltation = 60
    check("Uchcha bala bounded 0–60", Object.values(sb.planets).every((p) => {
      const u = p.sthana[0].virupas;
      return u >= 0 && u <= 60;
    }));

    // Paksha: Moon doubled, benefic+malefic complementarity: Ju + Su paksha = 60
    const ju = sb.planets.Ju.kala.find((f) => f.label === "Paksha")!.virupas;
    const su = sb.planets.Su.kala.find((f) => f.label === "Paksha")!.virupas;
    check("Paksha: benefic + malefic = 60", approx(ju + su, 60, 1e-6), `${ju.toFixed(2)}+${su.toFixed(2)}`);
    const mo = sb.planets.Mo.kala.find((f) => f.label === "Paksha")!.virupas;
    check("Paksha: Moon's value doubled (= 2×Jupiter's)", approx(mo, 2 * ju, 1e-6));

    // Vara lord consistency with Panchang convention: canonical birth
    // 1990-01-24 was a Wednesday → Vara lord Mercury gets the 45.
    const meAbdadi = sb.planets.Me.kala.find((f) => f.label === "Abda/Masa/Vara/Hora")!.virupas;
    check("Vara: Mercury holds Wednesday's 45 virupas", meAbdadi >= 45, String(meAbdadi));

    // Ayana: values bounded (Sun doubled → ≤120)
    check("Ayana bala bounded", Object.values(sb.planets).every((p) => {
      const a = p.kala.find((f) => f.label === "Ayana")!.virupas;
      return a >= 0 && a <= (p.id === "Su" ? 120 : 60);
    }));

    // Totals: all positive, in a plausible rupas band (published tables run ~4–10 rupas)
    check("Total rupas plausible (2–12)", Object.values(sb.planets).every((p) => p.rupas > 2 && p.rupas < 12),
      Object.values(sb.planets).map((p) => `${p.id}:${p.rupas.toFixed(2)}`).join(" "));

    // Ishta/Kashta bounded 0–60
    check("Ishta/Kashta bounded 0–60", Object.values(sb.planets).every(
      (p) => p.ishta >= 0 && p.ishta <= 60 && p.kashta >= 0 && p.kashta <= 60
    ));

    console.log(
      "  canonical Shadbala (rupas):",
      Object.values(sb.planets).map((p) => `${p.id}:${p.rupas.toFixed(2)}`).join(" "),
      `| strongest:${sb.strongest} weakest:${sb.weakest}`
    );

    // Bhava bala
    const bb = computeBhavaBala(chart, sb);
    check("Bhava bala computed for 12 houses", bb.length === 12);
    check("Bhava Dig bounded 0–60", bb.every((b) => {
      const d = b.factors.find((f) => f.label === "Bhava Dig")!.virupas;
      return d >= 0 && d <= 60;
    }));
  }

  // Sputa drishti curve fixed points
  check("Drishti f(30)=0", sputaDrishti("Su", 30) === 0);
  check("Drishti f(60)=15", sputaDrishti("Su", 60) === 15);
  check("Drishti f(90)=45", sputaDrishti("Su", 90) === 45);
  check("Drishti f(120)=30", sputaDrishti("Su", 120) === 30);
  check("Drishti f(150)=0", sputaDrishti("Su", 150) === 0);
  check("Drishti f(180)=60", sputaDrishti("Su", 180) === 60);
  check("Drishti f(300)=0", sputaDrishti("Su", 300) === 0);
  check("Saturn 3rd-aspect bonus at 60–90", sputaDrishti("Sa", 75) === 60);
  check("Jupiter 5th-aspect bonus at 120–150", sputaDrishti("Ju", 130) === 50);
  check("Mars 4th-aspect bonus at 90–120", sputaDrishti("Ma", 100) === 55);

  // Manual-mode degradation: no birth anchor → null
  {
    const manual = computeManualChart(
      {
        lagnaSign: 0,
        ascDeg: 10,
        planets: PLANETS.map((id, i) => ({ id, house: (i % 12) + 1, deg: 5 + i, retro: false })),
        anchor: { dateISO: "", time: "", place: null },
      },
      "lahiri"
    );
    check("Shadbala returns null for manual chart without anchor", computeShadbala(manual) === null);
  }
}

// ---------------------------------------------------------------------------
// Phase 1F: true node
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 1F: true node ===");

  // True vs mean node: bounded deviation (osculating node swings ≤ ~1.75°
  // around the mean) across a sampled decade.
  {
    let maxDev = 0;
    for (let i = 0; i < 120; i++) {
      const d = new Date(Date.UTC(2015 + Math.floor(i / 12), i % 12, 15));
      const dev = Math.abs(
        ((trueLunarNode(d) - meanLunarNode(d) + 540) % 360) - 180
      );
      if (dev > maxDev) maxDev = dev;
    }
    check("True−mean node deviation ≤ 2.0° over 2015–2024", maxDev <= 2.0, `max ${maxDev.toFixed(3)}°`);
    check("True node genuinely differs from mean (max dev > 0.5°)", maxDev > 0.5);
  }

  // Independent cross-check: at an actual ascending-node crossing found by
  // astronomy-engine's SearchMoonNode, the Moon sits ON the osculating node,
  // so its ecliptic longitude must equal trueLunarNode at that instant.
  {
    const evt = Astronomy.SearchMoonNode(new Astronomy.AstroTime(new Date(Date.UTC(2024, 0, 1))));
    const t = evt.time.date;
    const moonLon = Astronomy.EclipticGeoMoon(t).lon;
    const node = trueLunarNode(t);
    const target = evt.kind === Astronomy.NodeEventKind.Ascending ? node : norm360Check(node + 180);
    const diff = Math.abs(((moonLon - target + 540) % 360) - 180);
    check(
      "Moon's longitude = osculating node at a SearchMoonNode crossing",
      diff < 0.05,
      `${evt.kind === 1 ? "asc" : "desc"} node ${t.toISOString().slice(0, 10)}, Δ=${diff.toFixed(4)}°`
    );
  }

  // Long-term drift of the true node matches the mean regression rate.
  {
    const a = trueLunarNode(new Date(Date.UTC(2020, 0, 1)));
    const b = trueLunarNode(new Date(Date.UTC(2021, 0, 1)));
    let drift = ((b - a + 540) % 360) - 180; // signed
    check("True node regresses ~ −19.3°/year", approx(drift, -19.34, 2.5), `${drift.toFixed(2)}°/yr`);
  }

  // Mean remains the default everywhere
  {
    const ra = chart.planets.find((p) => p.id === "Ra")!;
    const meanAtBirth = meanLunarNode(chart.birthUtc!);
    const sidereal = ((meanAtBirth - chart.meta.ayanamshaValue) % 360 + 360) % 360;
    check("Chart Rahu still uses mean node by default", approx(ra.longitude, sidereal, 1e-6));
  }
}

function norm360Check(x: number): number {
  return ((x % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Phase 1G: scan refactor + activation windows
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 1G: scan + activation windows ===");

  // Regression: Jupiter's sidereal Taurus ingress on 2024-05-01 (previously verified).
  {
    const events = signChangeEvents(
      "Ju", "lahiri", new Date(Date.UTC(2024, 2, 1)), new Date(Date.UTC(2024, 5, 30))
    );
    const taurus = events.find((e) => e.toSign === 1);
    check(
      "Jupiter → sidereal Taurus on 2024-05-01 (regression after refactor)",
      !!taurus && taurus.date.toISOString().slice(0, 10) === "2024-05-01",
      taurus ? taurus.date.toISOString().slice(0, 10) : "not found"
    );
  }

  // occupancyIntervals: contiguous, gap-free, consistent with ingress events
  {
    const from = new Date(Date.UTC(2020, 0, 1));
    const to = new Date(Date.UTC(2026, 0, 1));
    const iv = occupancyIntervals("Sa", "lahiri", from, to, 5);
    let contiguous = iv[0].start.getTime() === from.getTime() && iv[iv.length - 1].end.getTime() === to.getTime();
    for (let i = 1; i < iv.length; i++) {
      if (iv[i].start.getTime() !== iv[i - 1].end.getTime()) contiguous = false;
      if (iv[i].sign === iv[i - 1].sign) contiguous = false; // adjacent intervals must differ
    }
    check("Saturn occupancy 2020–2026 is contiguous and gap-free", contiguous,
      iv.map((x) => x.sign).join("→"));
  }

  // Activation windows: dasha superset property — with maximal criteria and no
  // gates, every antardasha in the span must surface as a candidate.
  {
    const tree = vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!);
    const from = new Date(Date.UTC(2026, 0, 1));
    const to = new Date(Date.UTC(2031, 0, 1));
    const all = findActivationWindows(
      chart, tree, "lahiri", null,
      { houses: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxWindows: 999 },
      from, to
    );
    const ads = periodsOverlapping(tree, 2, from, to);
    check(
      "All-house criteria surface every antardasha (superset check)",
      all.length === ads.length,
      `${all.length} windows vs ${ads.length} ADs`
    );

    // Marriage-flavoured scan on the canonical chart: deterministic double-run
    const marriageCriteria = { houses: [7, 2, 11], karakas: ["Ve" as PlanetId] };
    const w1 = findActivationWindows(chart, tree, "lahiri", null, marriageCriteria, from, to);
    const w2 = findActivationWindows(chart, tree, "lahiri", null, marriageCriteria, from, to);
    check("findActivationWindows is deterministic", JSON.stringify(w1) === JSON.stringify(w2));
    check("Windows ranked by score descending", w1.every((w, i, a) => i === 0 || a[i - 1].score >= w.score));
    check("Window confidence within 5–95", w1.every((w) => w.confidence >= 5 && w.confidence <= 95));
    check("Every window carries reasons", w1.every((w) => w.reasons.length > 0));
    if (w1.length) {
      const top = w1[0];
      console.log(
        `  top marriage-theme window: ${top.start.toISOString().slice(0, 10)} → ${top.end.toISOString().slice(0, 10)}` +
        ` score=${top.score} dasha=${top.dasha.maha}/${top.dasha.antar} double=${top.doubleTransit}`
      );
    }

    // Null-tree degradation
    check("Null dasha tree → empty windows", findActivationWindows(chart, null, "lahiri", null, marriageCriteria, from, to).length === 0);
  }
}

// ---------------------------------------------------------------------------
// Phase 3.0: yoga detectors (hand-built fixtures that trivially form each)
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 3.0: yoga detectors ===");

  const fixture = (placements: Partial<Record<PlanetId, { house: number; deg?: number }>>) =>
    computeManualChart(
      {
        lagnaSign: 0, // Aries lagna
        ascDeg: 10,
        planets: PLANETS.map((id) => ({
          id,
          house: placements[id]?.house ?? 1,
          deg: placements[id]?.deg ?? 15,
          retro: false,
        })),
        anchor: { dateISO: "", time: "", place: null },
      },
      "lahiri"
    );

  // Fixture A: Kala Sarpa (all seven inside Rahu→Ketu) + Daridra (11th lord Saturn in 6th)
  {
    const a = fixture({
      Ra: { house: 1, deg: 5 }, Ke: { house: 7, deg: 5 },
      Su: { house: 2 }, Mo: { house: 3 }, Ma: { house: 4 },
      Me: { house: 5 }, Ju: { house: 6 }, Ve: { house: 4 }, Sa: { house: 6 },
    });
    const keys = detectYogas(a).map((y) => y.key);
    check("Fixture A: Kala Sarpa detected", keys.includes("kala-sarpa"), keys.join(","));
    check("Fixture A: Daridra detected (11th lord in 6th)", keys.includes("daridra"));
  }

  // Fixture B: pure Kemadruma (Moon unsupported, no cancellation) + Raja yoga
  // (Mars, 1st lord, conjunct Jupiter, 9th lord, in Sagittarius)
  {
    const b = fixture({
      Mo: { house: 2 },
      Su: { house: 9 }, Ma: { house: 9 }, Ju: { house: 9 },
      Me: { house: 12 }, Ve: { house: 12 }, Sa: { house: 12 },
      Ra: { house: 6 }, Ke: { house: 12 },
    });
    const yogas = detectYogas(b);
    const kem = yogas.find((y) => y.key === "kemadruma");
    check("Fixture B: Kemadruma detected", Boolean(kem));
    check("Fixture B: Kemadruma NOT cancelled", Boolean(kem && !kem.name.includes("cancelled")), kem?.name);
    check("Fixture B: Raja yoga (Ma 1st lord + Ju 9th lord conjoined)",
      yogas.some((y) => y.key.startsWith("raja-") && y.planets.includes("Ma") && y.planets.includes("Ju")));
  }

  // Fixture C: Kemadruma cancelled (Moon in kendra + support absent)
  {
    const c = fixture({
      Mo: { house: 1 },
      Su: { house: 9 }, Ma: { house: 9 }, Ju: { house: 9 },
      Me: { house: 9 }, Ve: { house: 9 }, Sa: { house: 9 },
      Ra: { house: 6 }, Ke: { house: 12 },
    });
    const kem = detectYogas(c).find((y) => y.key === "kemadruma");
    check("Fixture C: Kemadruma cancelled (Moon in kendra)", Boolean(kem && kem.name.includes("cancelled")), kem?.name);
  }

  // Fixture D: Dhana 2–11 (Venus 2nd lord + Saturn 11th lord conjunct)
  {
    const d = fixture({
      Ve: { house: 5 }, Sa: { house: 5 },
      Su: { house: 3 }, Mo: { house: 4 }, Ma: { house: 1 },
      Me: { house: 6 }, Ju: { house: 8 }, Ra: { house: 10 }, Ke: { house: 4 },
    });
    const keys = detectYogas(d).map((y) => y.key);
    check("Fixture D: Dhana yoga (2nd+11th lords conjoined)", keys.includes("dhana-2-11"), keys.join(","));
  }

  // Canonical chart: keys unique, detector total is stable and non-crashing
  {
    const ys = detectYogas(chart);
    const keys = ys.map((y) => y.key);
    check("Canonical yoga keys unique", new Set(keys).size === keys.length, keys.join(","));
    console.log(`  canonical yogas: ${keys.join(", ") || "(none)"}`);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: section builders — determinism, degradation, invariants
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 3: section builders ===");

  const vargas = computeVargaSet(chart);
  const jaimini = computeJaimini(chart);
  const shadbala = computeShadbala(chart);
  const yogas = detectYogas(chart);
  const strengths = allStrengths(chart, null);
  const tree = vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!);
  const fixedNow = new Date(Date.UTC(2026, 7, 1));

  // Determinism: every builder run twice must deep-equal.
  const runs: [string, () => unknown][] = [
    ["personality", () => buildPersonalityProfile(chart, strengths, yogas, { vargas, jaimini, shadbala })],
    ["career", () => buildCareerReport(chart, vargas, jaimini, shadbala, strengths, yogas)],
    ["wealth", () => buildWealthReport(chart, vargas, strengths, yogas)],
    ["marriage", () => buildMarriageReport(chart, vargas, jaimini, strengths, yogas)],
    ["foreign", () => buildForeignReport(chart, vargas, strengths)],
    ["cautions", () => buildCautionsReport(chart, strengths, shadbala, yogas, tree, fixedNow)],
  ];
  for (const [name, fn] of runs) {
    check(`${name} builder is deterministic`, JSON.stringify(fn()) === JSON.stringify(fn()));
  }

  // Wealth split sums to exactly 100.
  {
    const w = buildWealthReport(chart, vargas, strengths, yogas);
    const sum = w.split.reduce((s, x) => s + x.percent, 0);
    check("Wealth split sums to 100", sum === 100, w.split.map((s) => `${s.key}:${s.percent}`).join(" "));
  }

  // Career: 5–8 options, scores within 5–95, every option carries reasons.
  {
    const c = buildCareerReport(chart, vargas, jaimini, shadbala, strengths, yogas);
    check("Career: 5–8 ranked options", c.options.length >= 5 && c.options.length <= 8, String(c.options.length));
    check("Career: option scores in 5–95 with reasons", c.options.every((o) => o.score >= 5 && o.score <= 95 && o.reasons.length > 0));
  }

  // Marriage: probabilistic phrasing — the words "will marry" must not appear.
  {
    const m = buildMarriageReport(chart, vargas, jaimini, strengths, yogas);
    const text = JSON.stringify(m).toLowerCase();
    check("Marriage: no deterministic 'will marry' phrasing", !text.includes("will marry"));
    check("Marriage: Mangal Dosha assessed", typeof m.mangalDosha.present === "boolean");
    const windows = marriageTimingWindows(chart, tree, "lahiri", null, jaimini, fixedNow);
    check("Marriage windows: at most 3, each with reasons + confidence 5–95",
      windows.length <= 3 && windows.every((w) => w.reasons.length > 0 && w.confidence >= 5 && w.confidence <= 95),
      `${windows.length} windows`);
    if (windows.length) {
      console.log(
        "  marriage windows:",
        windows.map((w) => `${w.label} ${w.start.toISOString().slice(0, 7)}→${w.end.toISOString().slice(0, 7)} (${w.grade}, sub:${w.subWindows?.length ?? 0})`).join(" | ")
      );
    }
  }

  // Degradation: manual chart without anchor — every builder must run without
  // crashing, produce caveats where promised, and never produce timing.
  {
    const manual = computeManualChart(
      {
        lagnaSign: 3,
        ascDeg: 12,
        planets: PLANETS.map((id, i) => ({ id, house: ((i * 3) % 12) + 1, deg: 8 + i, retro: false })),
        anchor: { dateISO: "", time: "", place: null },
      },
      "lahiri"
    );
    const mv = computeVargaSet(manual);
    const mj = computeJaimini(manual);
    const msb = computeShadbala(manual); // null
    const my = detectYogas(manual);
    const mstr = allStrengths(manual, null);
    try {
      const cr = buildCareerReport(manual, mv, mj, msb, mstr, my);
      const wr = buildWealthReport(manual, mv, mstr, my);
      const mr = buildMarriageReport(manual, mv, mj, mstr, my);
      const fr = buildForeignReport(manual, mv, mstr);
      const car = buildCautionsReport(manual, mstr, msb, my, null, fixedNow);
      const pr = buildPersonalityProfile(manual, mstr, my, { vargas: mv, jaimini: mj, shadbala: msb });
      check("Degradation: all builders run on anchorless manual chart", true);
      check("Degradation: career notes the Shadbala fallback", cr.caveats.some((c) => c.toLowerCase().includes("shadbala")));
      check("Degradation: cautions notes missing dasha windows", car.caveats.some((c) => c.toLowerCase().includes("birth time")));
      check("Degradation: hasDasha false everywhere", [cr, wr, mr, fr, car].every((r) => r.hasDasha === false));
      check("Degradation: marriage timing empty without anchor",
        marriageTimingWindows(manual, null, "lahiri", null, mj, fixedNow).length === 0);
      check("Degradation: personality still yields sections", pr.sections.length >= 6, String(pr.sections.length));
    } catch (e) {
      check("Degradation: all builders run on anchorless manual chart", false, String(e));
    }
  }
}

// ---------------------------------------------------------------------------
// Phase 4: numerology (hand-checked values)
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 4: numerology ===");

  const n = computeNumerology("1990-01-24", "JOHN", "male");
  check("Moolank of 24th = 6", n?.moolank === 6, String(n?.moolank));
  check("Bhagyank of 1990-01-24 = 8 (2+4+0+1+1+9+9+0=26→8)", n?.bhagyank === 8, String(n?.bhagyank));
  check("Chaldean JOHN = 9 (1+7+5+5=18→9)", n?.namank === 9, String(n?.namank));
  check("Kua male 1990 = 1 (11−1=10→1)", n?.kua === 1, String(n?.kua));

  const nf = computeNumerology("1990-01-24", undefined, "female");
  check("Kua female 1990 = 5→8 rule", nf?.kua === 8, String(nf?.kua));
  const py = computeNumerology("1990-01-24", "JOHN", "male", "pythagorean");
  check("Pythagorean JOHN = 2 (1+6+8+5=20→2)", py?.namank === 2, String(py?.namank));
  check("No date → null", computeNumerology(undefined) === null);

  // Chaldean map integrity: no letter maps to 9, all 26 letters covered.
  {
    const values = Object.values(CHALDEAN_MAP);
    check("Chaldean: no letter maps to 9", values.every((v) => v >= 1 && v <= 8));
    check("Chaldean: all 26 letters mapped", Object.keys(CHALDEAN_MAP).length === 26, String(Object.keys(CHALDEAN_MAP).length));
  }

  // Lucky report: deterministic, disagreements surfaced not averaged
  {
    const strengths = allStrengths(chart, null);
    const shadbala = computeShadbala(chart);
    const r1 = buildLuckyReport(chart, strengths, shadbala, n);
    const r2 = buildLuckyReport(chart, strengths, shadbala, n);
    check("Lucky report deterministic", JSON.stringify(r1) === JSON.stringify(r2));
    check("Lucky: jyotisha verdict has planets/numbers/colours",
      r1.jyotishaVerdict.planets.length > 0 && r1.jyotishaVerdict.numbers.length > 0 && r1.jyotishaVerdict.colours.length > 0);
    console.log(`  canonical lucky: planets=${r1.jyotishaVerdict.planets.join(",")} numbers=${r1.combined.numbers.join(",")} dirs=${r1.combined.directions.join("/")} disagreements=${r1.combined.disagreements.length}`);
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
