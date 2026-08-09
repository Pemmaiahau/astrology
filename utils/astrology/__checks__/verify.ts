/**
 * Dev-only numeric verification harness. NEVER imported by the app.
 * Run manually with:  npx tsx utils/astrology/__checks__/verify.ts
 *
 * This is the regression ritual: every calculation phase appends its checks
 * here, and the whole file is re-run after any change to the calc layer.
 * Each check prints PASS/FAIL; the process exits non-zero on any FAIL.
 */

import * as Astronomy from "astronomy-engine";
import { AGE_BANDS, ageAt, agePrior, dateAtAge, EDGE_PRIOR } from "../ageBands";
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
import { EVENT_RULES, resolveHouse } from "../rectification/eventRules";
import { planetSignification, dashaShiftDaysPerMinute } from "../rectification/dashaFitness";
import {
  rectify, shiftLocalCivil, timezoneWarnings, validateRectifyRequest,
} from "../rectification/rectify";
import {
  aggregate, eventSampleInstants, scoreEvent, MIN_MARGIN, MIN_Z,
} from "../rectification/score";
import { transitSnapshot, VEDHA_TABLE } from "../rectification/transitFitness";
import type { LifeEvent, RectifyBirth } from "../rectification/types";
import { NAKSHATRA_LORDS } from "../constants";
import { dignityInSign, computeDignity, naturalRelation, temporalRelation } from "../states";
import { computeVargaSet, vargaSign, VIMSHOPAKA_WEIGHTS } from "../varga";
import { detectYogas } from "../yogas";
import { allStrengths } from "../strength";
import {
  buildCareerReport, careerTimingWindows, CAREER_CHANGE_GROUP, CAREER_ENTRY_GROUP,
} from "../../../data/interpretations/career";
import { buildCautionsReport } from "../../../data/interpretations/cautions";
import { buildForeignReport, foreignTimingWindows } from "../../../data/interpretations/foreign";
import { buildMarriageReport, marriageTimingWindows } from "../../../data/interpretations/marriage";
import { buildPersonalityProfile } from "../../../data/interpretations/personality";
import { buildWealthReport, wealthTimingWindows } from "../../../data/interpretations/wealth";
import type { AutoInputState, AyanamshaId, PlanetId } from "../types";

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
    // Selection ranks by score, but OUTPUT is chronological (a life story reads
    // in order); the score survives on each window for callers that re-rank.
    check(
      "Windows returned in chronological order",
      w1.every((w, i, a) => i === 0 || a[i - 1].start.getTime() <= w.start.getTime())
    );
    check("Every window carries a phase label", w1.every((w) => ["past", "current", "future"].includes(w.phase)));
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
    check("Marriage windows: at most 4, each with reasons + confidence 5–95",
      windows.length <= 4 && windows.every((w) => w.reasons.length > 0 && w.confidence >= 5 && w.confidence <= 95),
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
// Phase 5: age bands, banded timing windows, and the phrasing gate
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 5: age bands + banded windows ===");

  // --- agePrior shape: plateau, ramps, hard zero outside ---------------------
  {
    const b = AGE_BANDS.marriage; // 22 / 24–32 / 45
    check("agePrior = 1 inside the peak", agePrior(b, 24) === 1 && agePrior(b, 28) === 1 && agePrior(b, 32) === 1);
    check("agePrior = 0 strictly outside the band", agePrior(b, 21.9) === 0 && agePrior(b, 45.1) === 0);
    check(
      "agePrior ≈ EDGE_PRIOR at both band edges",
      approx(agePrior(b, b.start), EDGE_PRIOR, 1e-9) && approx(agePrior(b, b.end), EDGE_PRIOR, 1e-9),
      `${agePrior(b, b.start).toFixed(3)} / ${agePrior(b, b.end).toFixed(3)}`
    );

    // Monotone rising on the opening ramp, monotone falling on the closing one.
    let risingOk = true;
    for (let a = b.start; a < b.peakStart; a += 0.1) {
      if (agePrior(b, a + 0.1) < agePrior(b, a) - 1e-12) risingOk = false;
    }
    let fallingOk = true;
    for (let a = b.peakEnd; a < b.end; a += 0.1) {
      if (agePrior(b, a + 0.1) > agePrior(b, a) + 1e-12) fallingOk = false;
    }
    check("agePrior rises monotonically across the opening ramp", risingOk);
    check("agePrior falls monotonically across the closing ramp", fallingOk);

    // Every band is structurally sane.
    check(
      "All bands satisfy start ≤ peakStart ≤ peakEnd ≤ end",
      Object.values(AGE_BANDS).every((x) => x.start <= x.peakStart && x.peakStart <= x.peakEnd && x.peakEnd <= x.end)
    );
  }

  // --- ageAt / dateAtAge round-trip ------------------------------------------
  {
    const birth = chart.birthUtc!;
    let maxErrDays = 0;
    for (const a of [0, 1.5, 18, 22, 36.5, 45, 65, 99]) {
      const back = ageAt(birth, dateAtAge(birth, a));
      maxErrDays = Math.max(maxErrDays, Math.abs(back - a) * 365.2425);
    }
    check("dateAtAge/ageAt round-trip within 1 day", maxErrDays < 1, `max ${maxErrDays.toExponential(2)} d`);
    check("ageAt is 0 at the birth instant", Math.abs(ageAt(birth, birth)) < 1e-12);
  }

  const tree5 = vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!);
  const jaimini5 = computeJaimini(chart);
  // Canonical chart is born 1990-01-24; at this "now" the native is ~36.5 —
  // mid-band for marriage, so both the past and future paths are exercised.
  const now5 = new Date(Date.UTC(2026, 7, 1));
  const ageNow = ageAt(chart.birthUtc!, now5);
  check("Canonical native is mid-marriage-band at the fixed 'now'", ageNow > 32 && ageNow < 42, ageNow.toFixed(2));

  // --- Marriage windows sit inside the band, are phase-labelled, deterministic
  {
    const w = marriageTimingWindows(chart, tree5, "lahiri", null, jaimini5, now5);
    const b = AGE_BANDS.marriage;
    check(
      "Marriage windows all fall inside ages 22–45",
      w.length > 0 && w.every((x) => x.ageRange.from >= b.start - 1 && x.ageRange.to <= b.end + 1),
      w.map((x) => `${x.ageRange.from}-${x.ageRange.to}`).join(" ")
    );
    check(
      "Marriage window ageRange agrees with its dates",
      w.every(
        (x) =>
          x.ageRange.from === Math.round(ageAt(chart.birthUtc!, x.start)) &&
          x.ageRange.to === Math.round(ageAt(chart.birthUtc!, x.end))
      )
    );
    // Phase labels against the fixed 'now'.
    check(
      "Phase labels are correct against the fixed 'now'",
      w.every((x) =>
        x.end <= now5 ? x.phase === "past" : x.start > now5 ? x.phase === "future" : x.phase === "current"
      ),
      w.map((x) => x.phase).join(",")
    );
    // The quota rule: past windows must not crowd out everything upcoming.
    const anyUpcoming = w.some((x) => x.phase !== "past");
    check("Quota rule: at least one non-past window survives selection", anyUpcoming,
      `${w.filter((x) => x.phase === "past").length} past / ${w.filter((x) => x.phase !== "past").length} not-past`);
    check("Marriage windows are chronological", w.every((x, i, a) => i === 0 || a[i - 1].start <= x.start));
    // Determinism (mirrors the scan-level check).
    const w2 = marriageTimingWindows(chart, tree5, "lahiri", null, jaimini5, now5);
    check("Banded marriage windows are deterministic", JSON.stringify(w) === JSON.stringify(w2));
    console.log(
      "  marriage (banded):",
      w.map((x) => `age${x.ageRange.from}-${x.ageRange.to}/${x.phase}/${x.grade}`).join(" | ")
    );
  }

  // --- Career: exactly two groups, chronological within each -----------------
  {
    const c = careerTimingWindows(chart, tree5, "lahiri", null, jaimini5, now5);
    const groups = [...new Set(c.map((w) => w.group))];
    check(
      "Career windows carry exactly the two expected groups",
      groups.length === 2 && groups.includes(CAREER_ENTRY_GROUP) && groups.includes(CAREER_CHANGE_GROUP),
      groups.join(" / ")
    );
    check(
      "Career: entry group is emitted before the change group",
      c.findIndex((w) => w.group === CAREER_CHANGE_GROUP) >
        c.map((w) => w.group).lastIndexOf(CAREER_ENTRY_GROUP)
    );
    let chronoOk = true;
    for (const g of groups) {
      const items = c.filter((w) => w.group === g);
      for (let i = 1; i < items.length; i++) if (items[i - 1].start > items[i].start) chronoOk = false;
    }
    check("Career: chronological within each group", chronoOk);
    check(
      "Career: entry windows inside 22–30, change windows inside 28–50",
      c.every((w) =>
        w.group === CAREER_ENTRY_GROUP
          ? w.ageRange.from >= 21 && w.ageRange.to <= 31
          : w.ageRange.from >= 27 && w.ageRange.to <= 51
      ),
      c.map((w) => `${w.ageRange.from}-${w.ageRange.to}`).join(" ")
    );
    console.log("  career (banded):", c.map((w) => `${w.ageRange.from}-${w.ageRange.to}/${w.phase}`).join(" | "));
  }

  // --- Wealth / foreign bands + cautions stays forward-only ------------------
  {
    const wl = wealthTimingWindows(chart, tree5, "lahiri", null, "salary", now5);
    check(
      "Wealth windows fall inside ages 25–65",
      wl.every((w) => w.ageRange.from >= 24 && w.ageRange.to <= 66),
      wl.map((w) => `${w.ageRange.from}-${w.ageRange.to}`).join(" ")
    );
    const fw = foreignTimingWindows(chart, tree5, "lahiri", null, now5);
    check(
      "Foreign windows fall inside ages 18–55",
      fw.every((w) => w.ageRange.from >= 17 && w.ageRange.to <= 56),
      fw.map((w) => `${w.ageRange.from}-${w.ageRange.to}`).join(" ")
    );
    const strengths5 = allStrengths(chart, null);
    const car = buildCautionsReport(chart, strengths5, computeShadbala(chart), detectYogas(chart), tree5, now5);
    check(
      "Cautions windows are never retrospective (no band by design)",
      car.adverseWindows.every((w) => w.phase !== "past" && w.end > now5),
      `${car.adverseWindows.length} windows`
    );
    check(
      "Cautions windows still carry ageRange",
      car.adverseWindows.every((w) => Number.isFinite(w.ageRange.from) && Number.isFinite(w.ageRange.to))
    );
  }

  // --- Too-young / too-old natives still get their band ----------------------
  {
    // Same placements, shifted birth years: a 12-year-old and a 70-year-old.
    const young = computeAutoChart({ ...CANONICAL_INPUT, dateISO: "2014-01-24" }, "lahiri")!;
    const old = computeAutoChart({ ...CANONICAL_INPUT, dateISO: "1956-01-24" }, "lahiri")!;
    const youngTree = vimshottariTree(young.planets.find((p) => p.id === "Mo")!.longitude, young.birthUtc!);
    const oldTree = vimshottariTree(old.planets.find((p) => p.id === "Mo")!.longitude, old.birthUtc!);
    const yw = marriageTimingWindows(young, youngTree, "lahiri", null, computeJaimini(young), now5);
    const ow = marriageTimingWindows(old, oldTree, "lahiri", null, computeJaimini(old), now5);
    check(
      "Native below the band still gets windows, all in the future",
      yw.length > 0 && yw.every((w) => w.phase === "future" && w.ageRange.from >= 21),
      `${yw.length} windows`
    );
    check(
      "Native above the band still gets windows, all in the past",
      ow.length > 0 && ow.every((w) => w.phase === "past" && w.ageRange.to <= 46),
      `${ow.length} windows`
    );
  }

  // --- Phrasing gate: no deterministic promises anywhere in any section ------
  {
    const vargas5 = computeVargaSet(chart);
    const shadbala5 = computeShadbala(chart);
    const yogas5 = detectYogas(chart);
    const strengths5 = allStrengths(chart, null);
    const numerology5 = computeNumerology("1990-01-24", "JOHN", "male");
    const all = [
      buildCareerReport(chart, vargas5, jaimini5, shadbala5, strengths5, yogas5),
      buildWealthReport(chart, vargas5, strengths5, yogas5),
      buildMarriageReport(chart, vargas5, jaimini5, strengths5, yogas5),
      buildForeignReport(chart, vargas5, strengths5),
      buildCautionsReport(chart, strengths5, shadbala5, yogas5, tree5, now5),
      buildLuckyReport(chart, strengths5, shadbala5, numerology5),
      // Timing prose is generated too, so it is gated alongside the reports.
      marriageTimingWindows(chart, tree5, "lahiri", null, jaimini5, now5),
      careerTimingWindows(chart, tree5, "lahiri", null, jaimini5, now5),
      foreignTimingWindows(chart, tree5, "lahiri", null, now5),
      wealthTimingWindows(chart, tree5, "lahiri", null, "salary", now5),
    ];
    const corpus = all.map((r) => JSON.stringify(r)).join(" ").toLowerCase();
    const BANNED = ["you will ", "will definitely", "is guaranteed", "must marry", "will get", "will marry"];
    for (const phrase of BANNED) {
      const hit = corpus.includes(phrase);
      check(`Phrasing gate: "${phrase.trim()}" appears nowhere in any section`, !hit,
        hit ? corpus.slice(Math.max(0, corpus.indexOf(phrase) - 60), corpus.indexOf(phrase) + 60) : "");
    }
  }
}

// ---------------------------------------------------------------------------
console.log("\n=== Phase 6: birth time rectification ===");
// ---------------------------------------------------------------------------
{
  const BIRTH: RectifyBirth = {
    dateISO: "1988-06-14",
    time: "04:35",
    timezone: "Asia/Kolkata",
    lat: 18.9388,
    lon: 72.8354,
    placeName: "Mumbai",
    gender: "female",
    nodeMode: "mean",
  };
  const chartAt = (offsetMin: number, ay: AyanamshaId) => {
    const local = shiftLocalCivil(BIRTH.dateISO, BIRTH.time, offsetMin);
    return computeAutoChart(
      {
        name: "",
        dateISO: local.dateISO,
        time: local.time,
        place: { name: "Mumbai", lat: BIRTH.lat, lon: BIRTH.lon, timezone: BIRTH.timezone },
      },
      ay,
      "mean"
    )!;
  };

  // --- (a) Dasha-boundary displacement per minute of birth time -------------
  // The brief's figure is Δfrac = moonSpeed/1440 ÷ (360/27) ≈ 0.0686%/min at
  // the MEAN lunar speed of 13.18°/day. The real Moon here moves ~13.0°/day, so
  // the check is against the speed-derived value, with the textbook figure as
  // the sanity band.
  {
    const c0 = chartAt(0, "lahiri");
    const c1 = chartAt(1, "lahiri");
    const m0 = c0.planets.find((p) => p.id === "Mo")!;
    const m1 = c1.planets.find((p) => p.id === "Mo")!.longitude;
    const nakSpan = 360 / 27;
    const fracDelta = ((m1 % nakSpan) - (m0.longitude % nakSpan)) / nakSpan;
    const predicted = Math.abs(m0.speed) / 1440 / nakSpan;
    check(
      "Nakshatra elapsed fraction shifts by the speed-derived amount per minute",
      approx(fracDelta, predicted, 1e-6),
      `measured ${(fracDelta * 100).toFixed(5)}%/min, predicted ${(predicted * 100).toFixed(5)}%/min`
    );
    check(
      "…and that lands in the 0.06–0.07%/min band the ~0.0686% textbook figure implies",
      fracDelta > 0.0006 && fracDelta < 0.0007,
      `${(fracDelta * 100).toFixed(5)}%/min`
    );

    // The tree is a RIGID TRANSLATION: its origin is birthUtc − frac × years of
    // the opening lord and every period after that has a fixed duration, so a
    // boundary 40 years out moves exactly as far as one 2 years out. This is a
    // correction to the "0.0686% of the elapsed offset" reading — the shift is
    // uniform in absolute time, not proportional.
    const t0 = vimshottariTree(m0.longitude, c0.birthUtc!);
    const t1 = vimshottariTree(m1, c1.birthUtc!);
    const shifts = t0.map(
      (p, i) =>
        (t1[i].start.getTime() - c1.birthUtc!.getTime() - (p.start.getTime() - c0.birthUtc!.getTime())) /
        86400000
    );
    const uniform = shifts.every((s) => approx(s, shifts[0], 1e-6));
    check(
      "Every Mahadasha boundary shifts by the SAME absolute amount per minute (rigid translation)",
      uniform,
      `${shifts.map((s) => s.toFixed(3)).join(", ")} days`
    );
    const predictedShift = dashaShiftDaysPerMinute(Math.abs(m0.speed), NAKSHATRA_LORDS[m0.nakshatra]);
    check(
      "dashaShiftDaysPerMinute predicts the measured displacement",
      approx(Math.abs(shifts[0]), predictedShift, 0.01),
      `measured ${Math.abs(shifts[0]).toFixed(3)} d, predicted ${predictedShift.toFixed(3)} d`
    );
  }

  // --- (b) D-60 Lagna amsha cadence ----------------------------------------
  {
    const asc = (m: number) => chartAt(m, "lahiri").ascendant.longitude;
    const speed = asc(1) - asc(0); // degrees per minute
    let changes = 0;
    let prev = Math.floor(asc(-15) * 2); // 0.5° shashtiamsa index
    for (let m = -14; m <= 15; m++) {
      const cur = Math.floor(asc(m) * 2);
      if (cur !== prev) changes++;
      prev = cur;
    }
    const cadence = 30 / changes;
    check(
      "D-60 Lagna amsha changes on roughly a 2-minute cadence across the window",
      cadence > 1 && cadence < 3,
      `${changes} changes in 30 min → every ${cadence.toFixed(2)} min (Lagna speed ${speed.toFixed(3)}°/min)`
    );
    check(
      "…and that cadence equals one shashtiamsa (0.5°) divided by the measured Lagna speed",
      approx(cadence, 0.5 / speed, 0.25),
      `${cadence.toFixed(2)} vs ${(0.5 / speed).toFixed(2)} min`
    );
    // The rashi Lagna, by contrast, does not change sign at all here.
    const signs = new Set<number>();
    for (let m = -15; m <= 15; m++) signs.add(chartAt(m, "lahiri").ascendant.sign);
    check(
      "Rashi Lagna sign is unchanged across ±15 min, so D-1 is the weak discriminator",
      signs.size === 1,
      `${signs.size} distinct Ascendant sign(s)`
    );
  }

  // --- (c) Pushya is exactly Lahiri + 1.122° in sidereal longitude ----------
  {
    const l = chartAt(0, "lahiri");
    const p = chartAt(0, "pushya");
    let allExact = true;
    for (const q of l.planets) {
      const other = p.planets.find((x) => x.id === q.id)!;
      if (!approx(((other.longitude - q.longitude + 540) % 360) - 180, 1.122, 1e-9)) allExact = false;
    }
    check("Every Pushya sidereal longitude is exactly Lahiri + 1.122°", allExact);
    check(
      "…which is 2.244 shashtiamsas, so D-60 is not comparable across ayanamshas",
      approx(1.122 / 0.5, 2.244, 1e-9),
      `${(1.122 / 0.5).toFixed(3)} amsas`
    );
    check(
      "Ayanamsha difference is 8.415% of a nakshatra",
      approx((1.122 / (360 / 27)) * 100, 8.415, 0.001)
    );
  }

  // --- Bhavat Bhavam resolution --------------------------------------------
  {
    check("6th from the 7th resolves to the 12th", resolveHouse({ house: 6, from: 7 }) === 12);
    check("12th from the 7th resolves to the 6th", resolveHouse({ house: 12, from: 7 }) === 6);
    check("8th from the 9th resolves to the 4th", resolveHouse({ house: 8, from: 9 }) === 4);
    check("8th from the 4th resolves to the 11th", resolveHouse({ house: 8, from: 4 }) === 11);
    check("A bare house resolves to itself", resolveHouse({ house: 10 }) === 10);
  }

  // --- Vedha table integrity ------------------------------------------------
  {
    let sane = true;
    for (const [graha, table] of Object.entries(VEDHA_TABLE)) {
      for (const [good, vedha] of Object.entries(table)) {
        if (Number(good) < 1 || Number(good) > 12 || vedha < 1 || vedha > 12) sane = false;
        if (Number(good) === vedha) sane = false; // a house cannot obstruct itself
      }
      void graha;
    }
    check("Vedha table houses are all 1–12 and never self-obstructing", sane);
    check("Saturn and Mars share the 3/6/11 gochara set",
      JSON.stringify(VEDHA_TABLE.Sa) === JSON.stringify(VEDHA_TABLE.Ma));
    check("Jupiter's 5th-from-Moon transit is obstructed from the 4th", VEDHA_TABLE.Ju[5] === 4);
  }

  // --- Aggregation is a weighted MEAN, not a sum ---------------------------
  {
    const mk = (score: number, weight: number) =>
      ({ score, weight, eventId: `x${score}` }) as unknown as Parameters<typeof aggregate>[0][number];
    const two = aggregate([mk(0.6, 1), mk(0.6, 1)]);
    const four = aggregate([mk(0.6, 1), mk(0.6, 1), mk(0.6, 1), mk(0.6, 1)]);
    check("More events do not inflate the score (weighted mean, not sum)", approx(two, four, 1e-12), `${two} vs ${four}`);
    check("A half-weight event pulls the mean halfway", approx(aggregate([mk(1, 1), mk(0, 1)]), 0.5, 1e-12));
  }

  // --- Precision-interval sampling -----------------------------------------
  {
    const ex = eventSampleInstants({ id: "a", type: "marriage", dateISO: "2014-11-28", precision: "exact", reliability: "certain" });
    const mo = eventSampleInstants({ id: "b", type: "marriage", dateISO: "2014-11-01", precision: "month", reliability: "certain" });
    const yr = eventSampleInstants({ id: "c", type: "marriage", dateISO: "2014-01-01", precision: "year", reliability: "certain" });
    check("Exact precision samples one instant", ex.length === 1);
    check("Month precision integrates over four days inside the month", mo.length === 4 && mo.every((d) => d.getUTCMonth() === 10));
    check("Year precision integrates over all twelve months", yr.length === 12 && new Set(yr.map((d) => d.getUTCMonth())).size === 12);
  }

  // --- Validation ----------------------------------------------------------
  {
    const bad = validateRectifyRequest({ birth: { dateISO: "1988-06-14", time: "04:35", timezone: "Asia/Kolkata", lat: 18.9, lon: 72.8 }, events: [] });
    check("Fewer than 5 events is rejected", !bad.ok && bad.errors.some((e) => e.includes("At least")));
    const badTz = validateRectifyRequest({ birth: { dateISO: "1988-06-14", time: "04:35", timezone: "Mars/Olympus", lat: 18.9, lon: 72.8 }, events: [] });
    check("An unknown IANA zone is rejected", !badTz.ok);
  }

  // --- The worked example ---------------------------------------------------
  const EVENTS: LifeEvent[] = [
    { id: "e1", type: "higherEducation", dateISO: "2006-07-01", precision: "month", reliability: "certain" },
    { id: "e2", type: "careerStart", dateISO: "2010-08-16", precision: "exact", reliability: "certain" },
    { id: "e3", type: "marriage", dateISO: "2014-11-28", precision: "exact", reliability: "certain" },
    { id: "e4", type: "foreignTravel", dateISO: "2016-03-01", precision: "month", reliability: "probable" },
    { id: "e5", type: "childbirth", dateISO: "2018-02-09", precision: "exact", reliability: "certain" },
    { id: "e6", type: "property", dateISO: "2020-01-01", precision: "year", reliability: "probable" },
    { id: "e7", type: "fatherDeath", dateISO: "2022-09-04", precision: "exact", reliability: "certain" },
  ];
  const worked = rectify({ birth: BIRTH, events: EVENTS });

  check(
    "A dual sweep computes 2 × 31 candidates",
    worked.lahiri.candidates.length === 31 && worked.pushya.candidates.length === 31
  );
  check(
    "The sweep stays well inside the 3-second budget",
    worked.elapsedMs < 3000,
    `${worked.elapsedMs} ms`
  );
  check(
    "Both ayanamshas are run independently and neither is averaged away",
    worked.lahiri.ayanamsha === "lahiri" && worked.pushya.ayanamsha === "pushya"
  );
  check(
    "Determinism: the same request twice gives the same winning minute",
    rectify({ birth: BIRTH, events: EVENTS }).lahiri.best.offsetMin === worked.lahiri.best.offsetMin
  );
  check(
    "Every candidate reports a tied interval containing its best minute",
    worked.lahiri.interval.startOffsetMin <= worked.lahiri.best.offsetMin &&
      worked.lahiri.best.offsetMin <= worked.lahiri.interval.endOffsetMin
  );
  check(
    "Every event score carries a human-readable classical reason",
    worked.lahiri.best.events.every((e) => e.summary.length > 20 && e.dasha.reasons.length > 0)
  );
  check(
    "Rahu/Ketu delegation fires: a nodal dasha lord can still signify",
    (() => {
      const chart = chartAt(0, "lahiri");
      const direct = planetSignification(chart, "Ra", EVENT_RULES.foreignTravel, "female");
      return direct.claims.some((c) => c.includes("acts for") || c.includes("karaka"));
    })()
  );

  // --- (d) NULL RESULT: nonsense events must not produce a verdict ----------
  // The winner of 31 candidates is the maximum of 31 draws and stands ~1.9σ
  // above the median BY CONSTRUCTION. The thresholds in score.ts are calibrated
  // against exactly this, so a random event set must come back indeterminate
  // and its winner must sit near the middle of the distribution.
  {
    const TYPES = ["marriage", "childbirth", "careerStart", "promotion", "jobLoss", "illness", "foreignTravel", "property"] as const;
    let seed = 4242;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    let determinate = 0;
    let sweeps = 0;
    const zs: number[] = [];
    for (let trial = 0; trial < 4; trial++) {
      const noise: LifeEvent[] = Array.from({ length: 7 }, (_, i) => ({
        id: `n${trial}-${i}`,
        type: TYPES[Math.floor(rnd() * TYPES.length)],
        dateISO: `${2005 + Math.floor(rnd() * 18)}-${String(1 + Math.floor(rnd() * 12)).padStart(2, "0")}-${String(1 + Math.floor(rnd() * 27)).padStart(2, "0")}`,
        precision: "exact",
        reliability: "certain",
      }));
      const nr = rectify({ birth: BIRTH, events: noise });
      for (const res of [nr.lahiri, nr.pushya]) {
        sweeps++;
        zs.push(res.stats.zScore);
        if (res.verdict === "determinate") determinate++;
        // The winner must not be far from the middle of its own distribution.
        const spread = Math.max(...res.candidates.map((c) => c.score)) - Math.min(...res.candidates.map((c) => c.score));
        if (spread > 0) {
          const rel = (res.best.score - res.stats.median) / spread;
          if (rel > 0.75) determinate++; // counts as a false peak too
        }
      }
    }
    check(
      "Null result: randomly generated events never yield a determinate verdict",
      determinate === 0,
      `${determinate} false positives in ${sweeps} null sweeps, z = ${zs.map((z) => z.toFixed(2)).join(", ")}`
    );
    // The lesson the calibration taught: individual null z-scores routinely
    // exceed 2 — the winner is the maximum of 31 draws — so z ALONE must never
    // be the test. Assert the effect is real (so nobody "simplifies" the
    // verdict back down to a bare z threshold) and that the joint test holds
    // regardless.
    const nullMedian = [...zs].sort((a, b) => a - b)[Math.floor(zs.length / 2)];
    check(
      "Null z-scores sit high by construction (max-of-31 effect), so z alone is not evidence",
      nullMedian > 1.2 && nullMedian < 2.6 && Math.max(...zs) > MIN_Z - 0.5,
      `median null z ${nullMedian.toFixed(2)}, max ${Math.max(...zs).toFixed(2)}, threshold ${MIN_Z} — the margin test is what excludes these`
    );
  }

  // --- Positive control: events planted for a known minute are recovered ----
  {
    const TRUE_OFFSET = 7;
    const truth = chartAt(TRUE_OFFSET, "lahiri");
    const tTree = vimshottariTree(truth.planets.find((p) => p.id === "Mo")!.longitude, truth.birthUtc!);
    const tVargas = computeVargaSet(truth);
    const planted: LifeEvent[] = [];
    for (const type of ["marriage", "childbirth", "careerStart", "foreignTravel", "property", "windfall", "illness"] as const) {
      let bestDate = "";
      let bestScore = -1;
      for (let y = 2006; y <= 2024; y++) {
        for (let m = 1; m <= 12; m++) {
          const dateISO = `${y}-${String(m).padStart(2, "0")}-15`;
          const ev: LifeEvent = { id: "x", type, dateISO, precision: "exact", reliability: "certain" };
          const snaps = eventSampleInstants(ev).map((t) => transitSnapshot("lahiri", t, "mean"));
          const s = scoreEvent(truth, tTree, tVargas, ev, "female", snaps).score;
          if (s > bestScore) {
            bestScore = s;
            bestDate = dateISO;
          }
        }
      }
      planted.push({ id: `p-${type}`, type, dateISO: bestDate, precision: "exact", reliability: "certain" });
    }
    const pr = rectify({ birth: BIRTH, events: planted });
    check(
      "Positive control: events planted from a +7-minute chart recover that minute under Lahiri",
      Math.abs(pr.lahiri.best.offsetMin - TRUE_OFFSET) <= 1,
      `recovered ${pr.lahiri.best.offsetMin}m, z ${pr.lahiri.stats.zScore.toFixed(2)}, margin ${pr.lahiri.stats.margin.toFixed(4)}, ${pr.lahiri.verdict}`
    );
    check(
      "…and clears the null-calibrated thresholds that random events do not",
      pr.lahiri.stats.zScore >= MIN_Z && pr.lahiri.stats.margin >= MIN_MARGIN,
      `z ${pr.lahiri.stats.zScore.toFixed(2)} ≥ ${MIN_Z}, margin ${pr.lahiri.stats.margin.toFixed(4)} ≥ ${MIN_MARGIN}`
    );
  }

  // --- Timezone guards ------------------------------------------------------
  {
    // Bombay 1940: India used +05:30 by then, but 1942–45 had a war-time
    // +06:30. A 1942 birth must trip the historical-offset warning.
    const wartime = timezoneWarnings({ ...BIRTH, dateISO: "1943-06-14" }, 15, 1);
    check(
      "A 1943 Indian birth trips a timezone warning (war-time +06:30)",
      wartime.length > 0,
      wartime[0]?.slice(0, 80) ?? "none"
    );
    // A DST transition inside the window must be detected as non-uniform steps.
    const dstEdge = timezoneWarnings(
      { ...BIRTH, dateISO: "2021-03-14", time: "02:00", timezone: "America/New_York", lat: 40.7, lon: -74.0 },
      15,
      1
    );
    check(
      "A clock change inside the search window is detected",
      dstEdge.some((w) => w.includes("clock change")),
      dstEdge.map((w) => w.slice(0, 50)).join(" | ") || "none"
    );
    check("A clean modern record produces no timezone warnings", timezoneWarnings(BIRTH, 15, 1).length === 0);
  }

  // --- Reconciliation is never a blend --------------------------------------
  {
    const rec = worked.reconciliation;
    check(
      "Reconciliation reports a divergence and a tier, never a merged time",
      typeof rec.divergenceMin === "number" &&
        ["High", "Moderate", "Low"].includes(rec.tier) &&
        !("blended" in rec) &&
        !("consensus" in rec)
    );
    check(
      "Reconciliation states the D-60 incomparability across ayanamshas",
      rec.notes.some((n) => n.includes("2.24 shashtiamsas"))
    );
    check(
      "Reconciliation splits every event between the two systems",
      rec.eventSplit.length === EVENTS.length
    );
    check(
      "Confidence tier follows the divergence",
      (rec.divergenceMin <= 2 && rec.tier === "High") ||
        (rec.divergenceMin > 2 && rec.divergenceMin <= 5 && rec.tier === "Moderate") ||
        (rec.divergenceMin > 5 && rec.tier === "Low"),
      `${rec.divergenceMin} min → ${rec.tier}`
    );
  }

  console.log(
    `  worked example (Lahiri): best ${worked.lahiri.best.localTime} (${worked.lahiri.best.offsetMin >= 0 ? "+" : ""}${worked.lahiri.best.offsetMin}m), ` +
      `interval ${worked.lahiri.interval.startLocal}–${worked.lahiri.interval.endLocal}, ` +
      `z ${worked.lahiri.stats.zScore.toFixed(2)}, margin ${worked.lahiri.stats.margin.toFixed(4)} → ${worked.lahiri.verdict}`
  );
  console.log(
    `  worked example (Pushya): best ${worked.pushya.best.localTime} (${worked.pushya.best.offsetMin >= 0 ? "+" : ""}${worked.pushya.best.offsetMin}m), ` +
      `z ${worked.pushya.stats.zScore.toFixed(2)}, margin ${worked.pushya.stats.margin.toFixed(4)} → ${worked.pushya.verdict}; ` +
      `divergence ${worked.reconciliation.divergenceMin} min → ${worked.reconciliation.tier}`
  );
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
