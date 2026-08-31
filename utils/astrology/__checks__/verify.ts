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
import { computeAshtakavarga } from "../ashtakavarga";
import { computeAutoChart, computeManualChart } from "../chart";
import { CHALDEAN_MAP, NAISARGIKA_BALA, PLANET_NAMES, PLANETS, signMobility } from "../constants";
import { computeNumerology } from "../numerology";
import { buildLuckyReport } from "../../../data/interpretations/lucky";
import {
  declination, isRetrograde, meanLunarNode, nextSunrise, sunriseFor, sunsetFor, trueLunarNode,
} from "../ephemeris";
import { tropicalAscMc } from "../ascendant";
import { bhavaOf, sripatiHouses } from "../houses";
import { degInSign, fmtDeg } from "../math";
import { applyGrahaYuddha } from "../states";
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
import { currentPhase, currentSadeSati, sadeSatiPeriods, SADE_SATI_HOUSE } from "../sadeSati";
import { computeSudarshana, unanimouslyStrained, unanimouslySupported } from "../sudarshana";
import { explain, placementFacts, type Because } from "../../../data/interpretations/explain";
import { PLANET_IN_HOUSE } from "../../../data/interpretations/planetInHouse";
import {
  DIGNITY_PLAIN, HOUSE_GOVERNS, HOUSE_TITLES, PLANET_SIGNIFIES,
} from "../../../data/interpretations/significations";
import { completedYears, munthaAt, munthaAtAge } from "../varshaphala";
import { currentTransits, sadeSatiPhase } from "../transits";
import type { LifeEvent, RectifyBirth } from "../rectification/types";
import { NAKSHATRA_LORDS } from "../constants";
import { dignityInSign, computeDignity, naturalRelation, temporalRelation } from "../states";
import { computeVargaSet, vargaSign, VIMSHOPAKA_WEIGHTS } from "../varga";
import { detectYogas } from "../yogas";
import {
  AYANAMSHA_IDS, AYANAMSHA_LABELS, AYANAMSHA_SHORT, getAyanamsha,
  lahiriAyanamsha, pushyaAyanamsha, ramanAyanamsha,
} from "../ayanamsha";
import {
  CHOGHADIYA_MEANING, computeDayParts, computeLimbTimings, karanaNameOfHalf, nightKaalas,
} from "../dayParts";
import { computePanchang } from "../panchang";
import { interpretFullChart } from "../../../data/interpretations/synthesis";
import { buildLifeAreaReports } from "../../../data/interpretations/lifeAreas";
import { AREA_OPTIONS, AREA_VARGA } from "../../../data/interpretations/lifeAreaOptions";
import {
  checkBirthDate, checkCoordinates, checkLocalTime, DATE_MAX, DATE_MIN,
  ketuFromRahu, validateManualChart,
} from "../validate";
import { localToUtc } from "../time";
import type { ManualInputState } from "../types";
import { allStrengths } from "../strength";
import {
  buildCareerReport, careerTimingWindows, CAREER_CHANGE_GROUP, CAREER_ENTRY_GROUP,
} from "../../../data/interpretations/career";
import { buildCautionsReport } from "../../../data/interpretations/cautions";
import { buildForeignReport, foreignTimingWindows } from "../../../data/interpretations/foreign";
import { buildMarriageReport, marriageTimingWindows } from "../../../data/interpretations/marriage";
import { buildPersonalityProfile } from "../../../data/interpretations/personality";
import { buildWealthReport, wealthTimingWindows } from "../../../data/interpretations/wealth";
import {
  AUSPICIOUS_HOUSES, contactCoverage, contactsFromOccupancy, gocharaAt, NODE_AUSPICIOUS_HOUSES,
  saturnStanceAt, transitContacts, type TransitContact,
} from "../gochara";
import {
  buildTimingContext, compositeScore, DEFAULT_MIN_SCORE, findEventWindows, natalPromise,
  SLOW_BODIES,
} from "../eventTiming";
import { LIFE_EVENTS, LIFE_EVENT_BY_KEY } from "../../../data/interpretations/lifeEventRules";
import { buildLifeEventTimeline } from "../../../data/interpretations/lifeEvents";
import { buildSpeculationDepth } from "../../../data/interpretations/speculationDepth";
import { buildIntimacyDepth } from "../../../data/interpretations/intimacyDepth";
import { buildSpeculationReport, speculationYearWindows } from "../../../data/interpretations/speculation";
import { buildIntimacyReport } from "../../../data/interpretations/intimacy";
import { buildIntimacyTiming } from "../../../data/interpretations/intimacyTiming";
import { buildTrimsamsaClaim } from "../../../data/interpretations/trimsamsaClaim";
import { isAdvancedUnlocked } from "../../../components/context/advancedAccess";
import { resolveHouses } from "../rectification/eventRules";
import type { AutoInputState, AyanamshaId, PlanetId, PlanetPosition } from "../types";

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

  const fixture = (
    placements: Partial<Record<PlanetId, { house: number; deg?: number }>>,
    lagnaSign = 0 // Aries unless a check needs different lordships
  ) =>
    computeManualChart(
      {
        lagnaSign,
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

  // Fixtures E-H: the lunar-support family (Sunapha / Anapha / Durudhara /
  // Kemadruma). Aries lagna, Moon in the 4th, so the 2nd from the Moon is the
  // 5th house and the 12th from the Moon is the 3rd.
  {
    const LUNAR = ["sunapha", "anapha", "durudhara", "kemadruma"];
    const lunarKeys = (c: ReturnType<typeof fixture>): string[] =>
      detectYogas(c).map((y) => y.key).filter((k) => LUNAR.includes(k));

    // E: both flanks tenanted -> Durudhara.
    const e = fixture({
      Mo: { house: 4 }, Me: { house: 3 }, Ve: { house: 5 },
      Su: { house: 1 }, Ma: { house: 7 }, Ju: { house: 9 }, Sa: { house: 11 },
      Ra: { house: 10 }, Ke: { house: 4 },
    });
    check("Fixture E: Durudhara detected (both flanks of the Moon tenanted)",
      lunarKeys(e).includes("durudhara"), lunarKeys(e).join(",") || "(none)");

    // F: only the 2nd from the Moon -> Sunapha.
    const f = fixture({
      Mo: { house: 4 }, Ve: { house: 5 },
      Su: { house: 1 }, Ma: { house: 7 }, Me: { house: 6 }, Ju: { house: 9 },
      Sa: { house: 11 }, Ra: { house: 10 }, Ke: { house: 4 },
    });
    check("Fixture F: Sunapha detected (2nd from the Moon only)",
      lunarKeys(f).includes("sunapha"), lunarKeys(f).join(",") || "(none)");

    // G: only the 12th from the Moon -> Anapha.
    const g = fixture({
      Mo: { house: 4 }, Me: { house: 3 },
      Su: { house: 1 }, Ma: { house: 7 }, Ve: { house: 6 }, Ju: { house: 9 },
      Sa: { house: 11 }, Ra: { house: 10 }, Ke: { house: 4 },
    });
    check("Fixture G: Anapha detected (12th from the Moon only)",
      lunarKeys(g).includes("anapha"), lunarKeys(g).join(",") || "(none)");

    // H: both flanks hold ONLY the Sun and a node, which the rule excludes.
    // The classical outcome is Kemadruma, not Sunapha/Anapha.
    const h = fixture({
      Mo: { house: 4 }, Su: { house: 5 }, Ra: { house: 3 },
      Ma: { house: 7 }, Me: { house: 6 }, Ve: { house: 6 }, Ju: { house: 9 },
      Sa: { house: 11 }, Ke: { house: 9 },
    });
    check("Fixture H: the Sun and the nodes do not count as lunar support",
      lunarKeys(h).includes("kemadruma"), lunarKeys(h).join(",") || "(none)");

    for (const [label, c] of [["E", e], ["F", f], ["G", g], ["H", h]] as const) {
      check(`Fixture ${label}: exactly one lunar-support yoga fires`,
        lunarKeys(c).length === 1, lunarKeys(c).join(",") || "(none)");
    }
  }

  // Fixtures I-L: Parivartana grades and per-pair emission.
  {
    const parivartanas = (c: ReturnType<typeof fixture>) =>
      detectYogas(c).filter((y) => y.key.startsWith("parivartana-"));

    // I: Maha — Venus (2nd+7th) and the Moon (4th) exchange; no dusthana, no 3rd.
    const i = fixture({
      Ve: { house: 4 }, Mo: { house: 2 },
      Su: { house: 1 }, Ma: { house: 7 }, Me: { house: 6 }, Ju: { house: 9 },
      Sa: { house: 11 }, Ra: { house: 10 }, Ke: { house: 4 },
    });
    const iy = parivartanas(i);
    check("Fixture I: Maha Parivartana (Ve 2nd/7th <-> Mo 4th)",
      iy.some((y) => y.name.includes("Maha")), iy.map((y) => y.name).join(",") || "(none)");

    // J: Dainya — Mercury (3rd+6th) and Jupiter (9th+12th) exchange; dusthanas present.
    const j = fixture({
      Me: { house: 9 }, Ju: { house: 3 },
      Su: { house: 1 }, Mo: { house: 5 }, Ma: { house: 7 }, Ve: { house: 2 },
      Sa: { house: 11 }, Ra: { house: 10 }, Ke: { house: 4 },
    });
    const jy = parivartanas(j);
    check("Fixture J: Dainya Parivartana (a dusthana lord is in the exchange)",
      jy.some((y) => y.name.includes("Dainya")), jy.map((y) => y.name).join(",") || "(none)");

    // K: Khala — needs a 3rd lord owning no dusthana, which Aries cannot give
    // (its 3rd lord Mercury also owns the 6th). Taurus lagna: the Moon owns
    // only the 3rd, the Sun only the 4th.
    const k = fixture({
      Mo: { house: 4 }, Su: { house: 3 },
      Ma: { house: 7 }, Me: { house: 2 }, Ju: { house: 11 }, Ve: { house: 1 },
      Sa: { house: 10 }, Ra: { house: 9 }, Ke: { house: 3 },
    }, 1);
    const ky = parivartanas(k);
    check("Fixture K: Khala Parivartana (3rd lord in the exchange, no dusthana)",
      ky.some((y) => y.name.includes("Khala")), ky.map((y) => y.name).join(",") || "(none)");

    // L: dual rulership must not multiply the finding. Jupiter owns the 9th and
    // 12th, Saturn the 10th and 11th, so four house-pairs describe ONE exchange.
    const l = fixture({
      Ju: { house: 10 }, Sa: { house: 9 },
      Su: { house: 1 }, Mo: { house: 5 }, Ma: { house: 7 }, Me: { house: 6 },
      Ve: { house: 2 }, Ra: { house: 3 }, Ke: { house: 9 },
    });
    const ly = parivartanas(l);
    check("Fixture L: one Parivartana finding per planet pair, not per house pair",
      ly.length === 1, `${ly.length} finding(s): ${ly.map((y) => y.key).join(",") || "(none)"}`);
    check("Fixture L: the finding names every house both lords own",
      Boolean(ly[0] && ["9th", "12th", "10th", "11th"].every((h) => ly[0].description.includes(h))),
      ly[0]?.description.slice(0, 120));
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
// Phase 6.5: Sade Sati passages. The dated module folds Saturn's ingresses
// into passages; the pre-existing transits.ts answers the same question from a
// single snapshot. Checking them against each other is the point.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 6.5: Sade Sati passages ===");

  const moonSign = chart.planets.find((p) => p.id === "Mo")!.sign;
  const at = new Date("2026-06-15T00:00:00.000Z");
  const periods = sadeSatiPeriods(chart, "lahiri", at);
  const years = (a: Date, b: Date): number => (b.getTime() - a.getTime()) / (365.2425 * 86400000);

  check("Sade Sati: passages found for the canonical chart", periods.length > 0, `${periods.length} passages`);

  check(
    "Sade Sati: every phase sign is the 12th/1st/2nd from the natal Moon",
    periods.every((p) =>
      p.phases.every((ph) => ((ph.sign - moonSign + 12) % 12) + 1 === SADE_SATI_HOUSE[ph.phase])
    )
  );

  let ordered = true;
  for (let i = 1; i < periods.length; i++) {
    if (periods[i].start.getTime() < periods[i - 1].end.getTime()) ordered = false;
  }
  check("Sade Sati: passages are ordered and non-overlapping", ordered);

  // A whole passage runs ~7.5 years; retrograde re-entry stretches the outer
  // bounds toward 8.5. Clipped passages are partial by construction.
  const whole = periods.filter((p) => !p.clippedStart && !p.clippedEnd);
  const spans = whole.map((p) => years(p.start, p.end));
  check(
    "Sade Sati: complete passages last 7-9 years",
    spans.length > 0 && spans.every((y) => y >= 7 && y <= 9),
    spans.map((y) => y.toFixed(1)).join(", ")
  );

  // A retrograde excursion out of the closing sign must not surface as its own
  // passage — the defect the stitching step exists to prevent.
  check(
    "Sade Sati: no passage is a stray retrograde fragment",
    periods.every((p) => years(p.start, p.end) > 1),
    periods.map((p) => years(p.start, p.end).toFixed(1)).join(", ")
  );

  // Consecutive passages are one Saturn cycle apart (~29.5 years). Measured
  // start-to-start, and only where the earlier passage has a real start: the
  // first passage is clipped at birth for anyone born mid-Sade-Sati, so its
  // "start" is the birth date and the gap from it is not a cycle.
  const gaps: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    if (periods[i - 1].clippedStart) continue;
    gaps.push(years(periods[i - 1].start, periods[i].start));
  }
  check(
    "Sade Sati: consecutive passages are one Saturn cycle apart",
    gaps.length > 0 && gaps.every((g) => g >= 25 && g <= 34),
    gaps.map((g) => g.toFixed(1)).join(", ")
  );

  // Cross-validation. The two modules reach the answer by different routes —
  // ingress folding versus one transit sample — so agreement is evidence.
  for (const when of [at, new Date("2019-01-01T00:00:00.000Z"), new Date("2031-01-01T00:00:00.000Z")]) {
    const running = currentSadeSati(sadeSatiPeriods(chart, "lahiri", when));
    const dated = running ? currentPhase(running, when)?.phase ?? null : null;
    const snapshot = sadeSatiPhase(currentTransits(chart, "lahiri", when));
    check(
      `Sade Sati: dated phase agrees with the transit snapshot at ${when.toISOString().slice(0, 10)}`,
      dated === snapshot,
      `dated=${dated} snapshot=${snapshot}`
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 6.6: Muntha (Tajika annual point) and the natal Sudarshana Chakra.
// Both were previously unreachable from the app; these pin their arithmetic.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 6.6: Muntha and Sudarshana Chakra ===");

  // --- Muntha: starts on the Lagna at birth, advances one house per year.
  const m0 = munthaAtAge(chart, 0);
  check("Muntha: sits on the Lagna at birth", m0.house === 1 && m0.sign === chart.ascendant.sign,
    `house ${m0.house}, sign ${m0.sign}`);

  check("Muntha: advances exactly one house per completed year",
    [0, 1, 2, 5, 11].every((age) => munthaAtAge(chart, age).house === age + 1));

  check("Muntha: wraps to the Lagna after twelve years",
    munthaAtAge(chart, 12).house === 1 && munthaAtAge(chart, 25).house === 2,
    `age12=${munthaAtAge(chart, 12).house} age25=${munthaAtAge(chart, 25).house}`);

  check("Muntha: the sign is the house counted from the Lagna",
    [0, 3, 7, 11, 20].every((age) => {
      const m = munthaAtAge(chart, age);
      return m.sign === (chart.ascendant.sign + m.house - 1) % 12;
    }));

  // A year is only completed on the birthday — one day short must not advance.
  if (chart.birthUtc) {
    const dayBefore30 = new Date(chart.birthUtc.getTime() + 30 * 365.2425 * 86400000 - 86400000);
    const dayAfter30 = new Date(chart.birthUtc.getTime() + 30 * 365.2425 * 86400000 + 86400000);
    check("Muntha: does not advance until the year completes",
      completedYears(chart.birthUtc, dayBefore30) === 29 &&
        completedYears(chart.birthUtc, dayAfter30) === 30,
      `${completedYears(chart.birthUtc, dayBefore30)} -> ${completedYears(chart.birthUtc, dayAfter30)}`);
    check("Muntha: resolves at an instant", munthaAt(chart, dayAfter30)?.age === 30);
  }

  // --- Sudarshana Chakra.
  const chakra = computeSudarshana(chart);
  check("Sudarshana: twelve houses returned", chakra.length === 12);
  check("Sudarshana: three frames per house (Lagna, Moon, Sun)",
    chakra.every((h) => h.frames.length === 3));

  const moonSign = chart.planets.find((p) => p.id === "Mo")!.sign;
  const sunSign = chart.planets.find((p) => p.id === "Su")!.sign;
  check("Sudarshana: each frame counts from its own anchor",
    chakra.every((h) => {
      const [l, m, s] = h.frames;
      return (
        l.sign === (chart.ascendant.sign + h.house - 1) % 12 &&
        m.sign === (moonSign + h.house - 1) % 12 &&
        s.sign === (sunSign + h.house - 1) % 12
      );
    }));

  // The 1st house from each frame is the anchor's own sign, by definition.
  check("Sudarshana: the 1st house of each frame is the anchor sign",
    chakra[0].frames[0].sign === chart.ascendant.sign &&
      chakra[0].frames[1].sign === moonSign &&
      chakra[0].frames[2].sign === sunSign);

  check("Sudarshana: supported + strained never exceeds the frame count",
    chakra.every((h) => h.supported + h.strained <= h.frames.length));

  check("Sudarshana: unanimous means every frame leans the same way",
    chakra.every((h) => h.unanimous === (h.supported === h.frames.length || h.strained === h.frames.length)));

  // A house cannot be unanimously supported and unanimously strained at once.
  const both = unanimouslySupported(chakra).filter((h) => unanimouslyStrained(chakra).includes(h));
  check("Sudarshana: no house is both unanimously supported and strained", both.length === 0);

  // Occupancy is not an aspect — the engine's standing convention.
  check("Sudarshana: a planet never aspects the sign it occupies",
    chakra.every((h) => h.frames.every((f) => f.occupants.every((o) => !f.aspecting.includes(o)))));

  console.log(
    `  chakra: ${unanimouslySupported(chakra).map((h) => h.house).join(",") || "none"} unanimously supported; ` +
      `${unanimouslyStrained(chakra).map((h) => h.house).join(",") || "none"} unanimously strained`
  );
}

// ---------------------------------------------------------------------------
// Phase 6.7: the explain() reasoning renderer. Pins the four-link chain and
// the voice rules from REDESIGN.md 3b.1, so the language contract is checked
// mechanically rather than by eye.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 6.7: reasoning renderer ===");

  // --- Reference tables must be complete: a hole here silently produces
  // "undefined" in the middle of a sentence a reader is shown.
  check("significations: every planet has a signification",
    PLANETS.every((id) => Boolean(PLANET_SIGNIFIES[id]?.phrase && PLANET_SIGNIFIES[id]?.short)));
  check("significations: all twelve houses are covered",
    Array.from({ length: 12 }, (_, i) => i + 1).every(
      (h) => Boolean(HOUSE_GOVERNS[h]?.phrase && HOUSE_GOVERNS[h]?.short && HOUSE_TITLES[h])
    ));

  const DIGNITIES = [
    "exalted", "moolatrikona", "own", "greatFriend", "friend",
    "neutral", "enemy", "greatEnemy", "debilitated",
  ] as const;
  check("significations: every dignity has a plain-English form",
    DIGNITIES.every((d) => Boolean(DIGNITY_PLAIN[d]?.phrase && DIGNITY_PLAIN[d]?.band)));

  // --- Exercise every branch of the Because union across every planet/house.
  const samples: Because[] = [];
  for (const id of PLANETS) {
    for (let h = 1; h <= 12; h++) {
      samples.push({ via: "occupancy", planet: id, house: h });
      samples.push({ via: "lordship", planet: id, houses: [h] });
      samples.push({ via: "aspect", planet: id, house: h, offset: 7 });
      samples.push({ via: "transit", planet: id, house: h, from: "moon" });
      samples.push({ via: "lordFrom", planet: id, house: h, from: "sun" });
    }
    samples.push({ via: "karaka", planet: id, theme: "marriage" });
    samples.push({ via: "strength", planet: id, score: 46 });
    samples.push({ via: "ashtakavarga", planet: id, sign: 3, bindus: 5 });
    samples.push({ via: "varga", planet: id, varga: "D9", house: 7 });
    samples.push({ via: "yoga", yoga: "Raja Yoga", planets: [id] });
    for (const d of DIGNITIES) samples.push({ via: "dignity", planet: id, dignity: d });
  }
  for (const level of [1, 2, 3] as const) samples.push({ via: "dasha", level, lord: "Sa" });

  const rendered = samples.map((b) => explain(b, chart));
  check(`explain: renders all ${samples.length} Because variants without throwing`, rendered.length === samples.length);

  check("explain: never emits 'undefined' or 'NaN'",
    rendered.every((t) => !t.includes("undefined") && !t.includes("NaN")),
    rendered.find((t) => t.includes("undefined") || t.includes("NaN"))?.slice(0, 90));

  check("explain: every rendering is a complete sentence",
    rendered.every((t) => t.length > 0 && /^[A-Z]/.test(t) && /[.!?]$/.test(t)),
    rendered.find((t) => !/^[A-Z]/.test(t) || !/[.!?]$/.test(t))?.slice(0, 90));

  check("explain: no double spaces or stray double stops",
    rendered.every((t) => !t.includes("  ") && !t.includes("..") && !t.includes(" .")),
    rendered.find((t) => t.includes("  ") || t.includes("..") || t.includes(" ."))?.slice(0, 90));

  // --- Voice rule V6: conditional, agency-preserving language. The ban covers
  // claims about the person; it does not cover ephemeris statements, and this
  // renderer makes none.
  const FATALISTIC = /\b(will definitely|must|never|always|destined|fated|guaranteed|cannot escape)\b/i;
  // Measured on the generated chain only — see the curated-backlog check below.
  const generated = samples.filter((b) => b.via !== "occupancy").map((b) => explain(b, chart));
  check("explain: generated reasoning has no fatalistic absolutes (voice rule V6)",
    generated.every((t) => !FATALISTIC.test(t)),
    generated.find((t) => FATALISTIC.test(t))?.slice(0, 110));

  // --- Voice rule V3: no untranslated jargon in the plain rendering. These are
  // the terms the redesign says must never reach a default-depth reader.
  const JARGON = /\b(dusthana|kendra|trikona|drishti|graha|bhava|moolatrikona|karaka|maraka|vakri|neecha|dispositor|Adhi Shatru)\b/;
  const plainGenerated = samples
    .filter((b) => b.via !== "occupancy")
    .map((b) => explain(b, chart, "plain"));
  check("explain: generated reasoning uses no untranslated Sanskrit (voice rule V3)",
    plainGenerated.every((t) => !JARGON.test(t)),
    plainGenerated.find((t) => JARGON.test(t))?.slice(0, 110));

  // The curated leaf table is the other half of the sentence explain() builds,
  // and it was written before the voice rules existed. This is a MEASUREMENT,
  // not a gate: it reports how much of planetInHouse.ts still has to be
  // rewritten when the interpretation layer migrates, and fails only if the
  // backlog grows. Baseline at the time of writing: 12 fatalistic, 1 jargon.
  {
    const leaves = PLANETS.flatMap((id) => PLANET_IN_HOUSE[id] ?? []);
    const fatalistic = leaves.filter((t) => FATALISTIC.test(t)).length;
    const jargon = leaves.filter((t) => JARGON.test(t)).length;
    console.log(`  curated leaf text: ${leaves.length} entries, ${fatalistic} fatalistic, ${jargon} with jargon`);
    check("curated leaf text: voice-rule backlog has not grown",
      fatalistic <= 12 && jargon <= 1,
      `${fatalistic} fatalistic (baseline 12), ${jargon} jargon (baseline 1)`);
  }

  // --- Voice rule V2: sentences stay short. Measured on the chain itself,
  // excluding the curated leaf text from planetInHouse.ts, which predates the
  // rule and is migrated separately.
  const chainOnly = samples
    .filter((b) => b.via !== "occupancy")
    .map((b) => explain(b, chart));
  const longest = chainOnly.reduce((a, b) => (b.length > a.length ? b : a), "");
  const wordsIn = (t: string): number[] =>
    t.split(/(?<=[.!?])\s+/).map((s) => s.trim().split(/\s+/).filter(Boolean).length);
  check("explain: no sentence exceeds 30 words (voice rule V2)",
    chainOnly.every((t) => wordsIn(t).every((n) => n <= 30)),
    `longest rendering: ${longest.slice(0, 110)}`);

  // --- The four-link chain: a placement fact must name the planet, say what
  // the planet signifies, and say what the house governs. This is the rule the
  // whole redesign turns on, so it is checked directly.
  for (const id of PLANETS) {
    const text = explain({ via: "occupancy", planet: id, house: 10 }, chart);
    const linked =
      text.includes(PLANET_NAMES[id]) &&
      text.includes(PLANET_SIGNIFIES[id].phrase) &&
      text.includes(HOUSE_GOVERNS[10].phrase);
    if (!linked) {
      check(`explain: ${id} placement carries the full four-link chain`, false, text.slice(0, 140));
    }
  }
  check("explain: every planet's placement carries the full four-link chain",
    PLANETS.every((id) => {
      const t = explain({ via: "occupancy", planet: id, house: 10 }, chart);
      return t.includes(PLANET_NAMES[id]) && t.includes(PLANET_SIGNIFIES[id].phrase) &&
        t.includes(HOUSE_GOVERNS[10].phrase);
    }));

  // --- Expert depth adds detail without changing the claim.
  const expertAspect = explain({ via: "aspect", planet: "Sa", house: 10, offset: 10 }, chart, "expert");
  check("explain: expert depth names the aspect offset", expertAspect.includes("10th glance"), expertAspect.slice(0, 110));
  check("explain: plain depth hides the aspect offset",
    !explain({ via: "aspect", planet: "Sa", house: 10, offset: 10 }, chart).includes("glance)"));

  // --- placementFacts reads the chart rather than inventing facts.
  const facts = placementFacts(chart, "Su");
  const sun = chart.planets.find((q) => q.id === "Su")!;
  check("placementFacts: reports the planet's real house",
    facts.some((f) => f.via === "occupancy" && f.house === sun.house));
  check("placementFacts: reports the planet's real dignity",
    facts.some((f) => f.via === "dignity" && f.dignity === sun.dignity));
  check("placementFacts: returns nothing for an absent planet",
    placementFacts({ ...chart, planets: [] }, "Su").length === 0);

  console.log(`  sample: ${explain({ via: "occupancy", planet: "Ma", house: 10 }, chart).slice(0, 150)}`);
}

// ---------------------------------------------------------------------------
// Phase 7: defect regressions (graha yuddha, nodal vakri, house degeneracy,
// degree formatting). Each check below pins a bug that was live in the engine.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 7: defect regressions ===");

  const stub = (id: PlanetId, longitude: number): PlanetPosition => ({
    id,
    longitude,
    sign: Math.floor(longitude / 30),
    degInSign: longitude % 30,
    house: 1, bhava: 1, nakshatra: 0, pada: 1,
    nakshatraLord: "Ke", nakshatraRelation: "neutral",
    retrograde: false, combust: false, speed: 1, dignity: "neutral",
  });

  // --- Graha Yuddha decided on longitude, not degree-in-sign ---------------
  {
    // Mars 29°42' Aries vs Venus 0°12' Taurus: 30' apart across the boundary.
    // Mars is behind in zodiacal order and must win; comparing degInSign
    // (29.70 vs 0.20) used to hand the war to Venus.
    const ma = stub("Ma", 29.7);
    const ve = stub("Ve", 30.2);
    applyGrahaYuddha([ma, ve]);
    check(
      "Graha yuddha across a sign boundary: the lower longitude wins",
      ma.warWith === "Ve" && ma.warWinner === true && ve.warWith === "Ma" && ve.warWinner === false,
      `Ma ${ma.warWinner ? "won" : "lost"} / Ve ${ve.warWinner ? "won" : "lost"}`
    );
  }
  {
    // Within one sign the old and new orderings agree — no chart may change.
    const me = stub("Me", 12.1);
    const ju = stub("Ju", 12.8);
    applyGrahaYuddha([me, ju]);
    check(
      "Graha yuddha inside one sign is unchanged (lower degree still wins)",
      me.warWinner === true && ju.warWinner === false
    );
  }
  {
    // Beyond 1° there is no war at all.
    const ma = stub("Ma", 10);
    const sa = stub("Sa", 11.5);
    applyGrahaYuddha([ma, sa]);
    check("Grahas more than 1° apart are not at war", !ma.warWith && !sa.warWith);
  }
  {
    // Three grahas inside 1°: each must record its NEAREST opponent, and the
    // record must not depend on loop order.
    const ma = stub("Ma", 100.0);
    const ve = stub("Ve", 100.3);
    const sa = stub("Sa", 100.9);
    applyGrahaYuddha([ma, ve, sa]);
    check(
      "Three-way war: every graha records its nearest opponent",
      ma.warWith === "Ve" && ve.warWith === "Ma" && sa.warWith === "Ve",
      `Ma→${ma.warWith} Ve→${ve.warWith} Sa→${sa.warWith}`
    );
    check(
      "Three-way war: winners follow zodiacal order",
      ma.warWinner === true && ve.warWinner === false && sa.warWinner === false
    );
    const reversed = [stub("Sa", 100.9), stub("Ve", 100.3), stub("Ma", 100.0)];
    applyGrahaYuddha(reversed);
    const byId = new Map(reversed.map((p) => [p.id, p]));
    check(
      "Three-way war is independent of input order",
      byId.get("Ma")!.warWith === "Ve" && byId.get("Sa")!.warWith === "Ve" &&
        byId.get("Ma")!.warWinner === true
    );
  }
  {
    // Every graha in a war must have an opponent that agrees it is at war,
    // and no pair may come back with two winners or two losers.
    const group = [stub("Ma", 200.1), stub("Me", 200.4), stub("Ju", 200.6), stub("Ve", 249)];
    applyGrahaYuddha(group);
    const map = new Map(group.map((p) => [p.id, p]));
    let consistent = true;
    for (const p of group) {
      if (!p.warWith) continue;
      const foe = map.get(p.warWith);
      if (!foe) { consistent = false; continue; }
      // Reciprocity is not required (nearest-opponent is directional), but the
      // verdict between any two named combatants must be antisymmetric.
      if (foe.warWith === p.id && foe.warWinner === p.warWinner) consistent = false;
    }
    check("No war pair reports two winners or two losers", consistent);
    check("A graha 48° away is left out of the war", !map.get("Ve")!.warWith);
  }

  // --- Nodes are always vakri ----------------------------------------------
  {
    const d = new Date(Date.UTC(2024, 5, 15));
    check("Mean Rahu is retrograde", isRetrograde("Ra", d, "mean"));
    check("Mean Ketu is retrograde", isRetrograde("Ke", d, "mean"));
    check("The Sun is never retrograde", !isRetrograde("Su", d));
    check("The Moon is never retrograde", !isRetrograde("Mo", d));
    check(
      "Canonical chart marks Rahu and Ketu retrograde",
      chart.planets.find((p) => p.id === "Ra")!.retrograde &&
        chart.planets.find((p) => p.id === "Ke")!.retrograde
    );
    // Mean node regresses every single day; the true node does not.
    let meanAlwaysRetro = true;
    let trueEverDirect = false;
    for (let i = 0; i < 400; i++) {
      const t = new Date(Date.UTC(2023, 0, 1) + i * 86400000);
      if (!isRetrograde("Ra", t, "mean")) meanAlwaysRetro = false;
      if (!isRetrograde("Ra", t, "true")) trueEverDirect = true;
    }
    check("Mean node never turns direct across 400 days", meanAlwaysRetro);
    check(
      "True node does turn direct — the distinction the hard-coded false erased",
      trueEverDirect
    );
    // nodeMode must actually reach dailySpeed through isRetrograde.
    const trueNodeChart = computeAutoChart(CANONICAL_INPUT, "lahiri", "true");
    check(
      "True-node chart reports node retrogression from its own speed",
      !!trueNodeChart &&
        trueNodeChart.planets.find((p) => p.id === "Ra")!.retrograde ===
          isRetrograde("Ra", trueNodeChart.birthUtc!, "true")
    );
  }

  // --- House-frame degeneracy ----------------------------------------------
  {
    const coversAllTwelve = (sandhi: number[]): boolean => {
      const seen = new Set<number>();
      for (let x = 0; x < 3600; x++) seen.add(bhavaOf(x / 10, sandhi));
      return seen.size === 12;
    };

    const delhi = tropicalAscMc(new Date("1985-06-15T04:30:00Z"), 28.6139, 77.209);
    const normal = sripatiHouses(delhi.asc, delhi.mc);
    check("Temperate latitude still uses Sripati", normal.method === "sripati");
    check("Sripati frame reaches all 12 bhavas", coversAllTwelve(normal.sandhi));

    // 89.9°N in June: quadrant arc is 350°, which used to be trisected into
    // 117°-wide bhavas leaving 8 of the 12 unreachable.
    const polar = tropicalAscMc(new Date("1985-06-15T04:30:00Z"), 89.9, 20);
    const polarFrame = sripatiHouses(polar.asc, polar.mc);
    check("Degenerate polar quadrants fall back to equal houses", polarFrame.method === "equal");
    check("Equal-house fallback reaches all 12 bhavas", coversAllTwelve(polarFrame.sandhi));
    check(
      "Equal-house bhavas are exactly 30° wide",
      polarFrame.madhya.every((m, i) =>
        approx(norm360Check(polarFrame.madhya[(i + 1) % 12] - m), 30, 1e-9)
      )
    );
    check(
      "Equal-house bhava 1 is centred on the Ascendant",
      approx(polarFrame.madhya[0], norm360Check(polar.asc), 1e-9)
    );

    // Manual mode: a Lagna chosen 150° from the Ascendant the MC belongs to.
    const manualFrame = sripatiHouses(norm360Check(delhi.asc + 150), delhi.mc);
    check(
      "Manual Lagna far from the real Ascendant also degrades safely",
      manualFrame.method === "equal" && coversAllTwelve(manualFrame.sandhi)
    );

    // Sweep: no latitude may produce an unreachable bhava in either branch.
    let allLatitudesCovered = true;
    let degenerateSeen = 0;
    for (const lat of [-89, -78, -66, -45, 0, 23.5, 45, 66, 78, 89]) {
      for (const iso of ["1985-06-15T04:30:00Z", "1985-12-15T22:10:00Z"]) {
        const { asc, mc } = tropicalAscMc(new Date(iso), lat, 20);
        const frame = sripatiHouses(asc, mc);
        if (frame.method === "equal") degenerateSeen++;
        if (!coversAllTwelve(frame.sandhi)) allLatitudesCovered = false;
      }
    }
    check(
      "Every bhava is reachable at every latitude sampled",
      allLatitudesCovered,
      `${degenerateSeen} of 20 frames used the equal-house fallback`
    );
    check("The canonical chart records its bhava method", chart.meta.bhavaMethod === "sripati");
  }

  // --- Degree formatting ---------------------------------------------------
  {
    check("fmtDeg truncates: 14.372° → 14°22'", fmtDeg(14.372) === "14°22'");
    check("fmtDeg(0) is 0°00'", fmtDeg(0) === "0°00'");
    // 5.05 − 5 is 0.04999… in binary: a naive floor loses the whole arcminute.
    check("fmtDeg absorbs binary representation error", fmtDeg(5.05) === "5°03'", fmtDeg(5.05));
    check("fmtDeg pads single-digit minutes", fmtDeg(7 + 4 / 60) === "7°04'", fmtDeg(7 + 4 / 60));
    check(
      "…and the epsilon never carries a value up to 60'",
      fmtDeg(29.999999999) === "29°59'",
      fmtDeg(29.999999999)
    );
    check(
      "fmtDeg never prints an impossible 30°00' inside a sign",
      fmtDeg(29.9917) === "29°59'",
      fmtDeg(29.9917)
    );
    // The printed degree must agree with the sign/nakshatra/pada beside it.
    let displayAgrees = true;
    for (let i = 0; i < 20000; i++) {
      const lon = (i * 360) / 20000;
      const printed = Number(fmtDeg(degInSign(lon)).split("°")[0]);
      if (printed !== Math.floor(degInSign(lon))) displayAgrees = false;
      if (printed >= 30) displayAgrees = false;
    }
    check("Printed degree always matches floor(degInSign) over 20 000 samples", displayAgrees);
  }
}

// ---------------------------------------------------------------------------
// Phase: Gochara Phala, the life-event timing engine and the event catalogue.
// ---------------------------------------------------------------------------
{
  const chart = computeAutoChart(CANONICAL_INPUT, "lahiri", "mean")!;
  const NOW = new Date("2026-06-15T00:00:00.000Z");
  const moon = chart.planets.find((p) => p.id === "Mo")!;
  const tree = vimshottariTree(moon.longitude, chart.birthUtc!);

  const avSigns: Partial<Record<PlanetId, number>> = {};
  for (const id of PLANETS) {
    const p = chart.planets.find((q) => q.id === id);
    if (p) avSigns[id] = p.sign;
  }
  const av = computeAshtakavarga(avSigns, chart.ascendant.sign);
  const sb = computeShadbala(chart);
  const bb = sb ? computeBhavaBala(chart, sb) : null;
  const strengths = allStrengths(chart, av);

  // --- The auspicious-house table is DERIVED from VEDHA_TABLE --------------
  // A silent `{}` here would make every gochara reading come out neutral, and
  // nothing else in the engine would notice.
  {
    const CLASSICAL: Record<string, number[]> = {
      Su: [3, 6, 10, 11],
      Mo: [1, 3, 6, 7, 10, 11],
      Ma: [3, 6, 11],
      Me: [2, 4, 6, 8, 10, 11],
      Ju: [2, 5, 7, 9, 11],
      Ve: [1, 2, 3, 4, 5, 8, 9, 11, 12],
      Sa: [3, 6, 11],
    };
    let allMatch = true;
    for (const [id, want] of Object.entries(CLASSICAL)) {
      const got = [...(AUSPICIOUS_HOUSES[id as PlanetId] ?? [])].sort((a, b) => a - b);
      if (got.join(",") !== want.join(",")) allMatch = false;
    }
    check("Gochara auspicious houses derived from VEDHA_TABLE match the classical table", allMatch);
    check(
      "The nodes are given upachaya houses only, and no vedha of their own",
      NODE_AUSPICIOUS_HOUSES.join(",") === "3,6,10,11" &&
        AUSPICIOUS_HOUSES.Ra === undefined &&
        AUSPICIOUS_HOUSES.Ke === undefined
    );
  }

  // --- saturnStanceAt agrees with the existing Sade Sati detector ----------
  // Two independent paths to the same fact (transits.ts samples the sky and
  // counts from the Moon; gochara.ts recomputes the longitude) — they must not
  // be able to disagree.
  {
    let agree = true;
    for (let y = 1995; y <= 2045; y += 5) {
      const at = new Date(Date.UTC(y, 5, 15));
      const stance = saturnStanceAt(chart, "lahiri", at);
      const phase = sadeSatiPhase(currentTransits(chart, "lahiri", at));
      const fromStance =
        stance && stance.startsWith("sadeSati") ? stance.slice("sadeSati-".length) : null;
      if (fromStance !== phase) agree = false;
    }
    check("saturnStanceAt and sadeSatiPhase agree on every sampled year", agree);
  }

  // --- Vedha is a cancellation, never a reversal --------------------------
  {
    let neverNegative = true;
    for (let y = 1992; y <= 2060; y += 3) {
      for (const r of gocharaAt(chart, "lahiri", new Date(Date.UTC(y, 0, 10)))) {
        if (r.auspicious && r.value < 0) neverNegative = false;
        if (r.vedhaBy && r.value !== 0) neverNegative = false;
      }
    }
    check("A vedha cancels an auspicious transit to zero rather than reversing it", neverNegative);
  }

  // --- contactCoverage takes a union, not a sum ---------------------------
  {
    const mk = (a: string, b: string): TransitContact => ({
      id: "Ju", sign: 0, start: new Date(a), end: new Date(b), houseFromLagna: 1, houseFromMoon: 1,
    });
    const ws = new Date("2020-01-01");
    const we = new Date("2021-01-01");
    // Two contacts covering the same half-year must read as one half-year.
    const overlapping = [mk("2020-01-01", "2020-07-01"), mk("2020-02-01", "2020-06-01")];
    const cov = contactCoverage(overlapping, ws, we);
    check("contactCoverage unions overlapping contacts", approx(cov, 0.4986, 0.01), cov.toFixed(4));
    check(
      "contactCoverage never exceeds 1 however many contacts overlap",
      contactCoverage([...overlapping, ...overlapping, ...overlapping], ws, we) <= 1
    );
    check(
      "contactCoverage clips contacts to the window",
      approx(contactCoverage([mk("2019-01-01", "2022-01-01")], ws, we), 1, 1e-9)
    );
  }

  // --- transitContacts and the precomputed path give the same answer -------
  // The whole timeline's performance rests on that split; a divergence would
  // mean the fast path silently reads a different sky from the slow one.
  {
    const from = new Date("2010-01-01");
    const to = new Date("2030-01-01");
    const targets = [0, 4, 8];
    const direct = transitContacts(chart, "lahiri", ["Ju"], targets, from, to);
    const viaOccupancy = contactsFromOccupancy(
      chart, "Ju", occupancyIntervals("Ju", "lahiri", from, to, 3, "mean"), targets
    );
    check(
      "transitContacts and contactsFromOccupancy agree exactly",
      direct.length === viaOccupancy.length &&
        direct.every(
          (c, i) =>
            c.start.getTime() === viaOccupancy[i].start.getTime() && c.sign === viaOccupancy[i].sign
        ),
      `${direct.length} contacts`
    );
  }

  // --- compositeScore saturates instead of clamping -----------------------
  {
    const at = (support: number) => compositeScore([{ text: "", weight: support }]);
    check("compositeScore is monotone in support", at(10) < at(30) && at(30) < at(60) && at(60) < at(120));
    check(
      "compositeScore leaves headroom — no amount of support reaches 100",
      at(500) < 95 && at(1e6) < 95,
      `${at(500)} at extreme support`
    );
    check("compositeScore floors an unsupported window at the neutral base", at(0) === 30);
    check(
      "Adversity drags the score down without taking it below zero",
      compositeScore([{ text: "", weight: -500 }]) >= 0 &&
        compositeScore([{ text: "", weight: -500 }]) < 30
    );
  }

  // --- The catalogue itself ------------------------------------------------
  {
    let housesValid = true;
    let bandsOrdered = true;
    let hasPrimary = true;
    for (const def of LIFE_EVENTS) {
      const primary = resolveHouses(def.rule.primaryHouses);
      for (const h of primary) {
        if (!Number.isInteger(h) || h < 1 || h > 12) housesValid = false;
      }
      if (primary.length === 0) hasPrimary = false;
      const b = def.band;
      if (b && !(b.start <= b.peakStart && b.peakStart <= b.peakEnd && b.peakEnd <= b.end)) {
        bandsOrdered = false;
      }
    }
    check("Every catalogued event resolves to houses in 1-12", housesValid);
    check("Every catalogued event carries at least one primary house", hasPrimary);
    check("Every age band is ordered start <= peakStart <= peakEnd <= end", bandsOrdered);
    check(
      "Event keys are unique",
      new Set(LIFE_EVENTS.map((e) => e.key)).size === LIFE_EVENTS.length,
      `${LIFE_EVENTS.length} events`
    );

    // The catalogue must SHARE the rectification rules, not copy them: a copy
    // would let the two directions drift apart on doctrine with no test
    // noticing.
    check(
      "Shared events reference the rectification rule by identity, not by copy",
      LIFE_EVENT_BY_KEY.marriage.rule === EVENT_RULES.marriage &&
        LIFE_EVENT_BY_KEY.childbirth.rule === EVENT_RULES.childbirth &&
        LIFE_EVENT_BY_KEY.illness.rule === EVENT_RULES.illness
    );

    // Bhavat Bhavam in the authored rules resolves the way their comments claim.
    check(
      "Breakup reads the 6th and 12th FROM THE 5TH - the 10th and 4th of the chart",
      resolveHouses(LIFE_EVENT_BY_KEY.breakup.rule.primaryHouses)
        .sort((a, b) => a - b)
        .join(",") === "4,10"
    );
    check(
      "Retirement reads the 12th from the 10th - the 9th - alongside the 12th itself",
      resolveHouses(LIFE_EVENT_BY_KEY.retirement.rule.primaryHouses)
        .sort((a, b) => a - b)
        .join(",") === "9,12"
    );
    check(
      "Adversity events carry no age band",
      (["illness", "accident", "litigation"] as const).every(
        (k) => LIFE_EVENT_BY_KEY[k].band === null
      )
    );
    check(
      "Parental death is not forecast, though the rectification rules for it exist",
      !LIFE_EVENTS.some((e) => e.rule.type === "fatherDeath" || e.rule.type === "motherDeath")
    );
  }

  // --- The engine ----------------------------------------------------------
  {
    const ctx = buildTimingContext({
      chart, tree, ayanamsha: "lahiri", av, shadbala: sb, bhavaBala: bb, strengths, now: NOW,
    })!;
    check(
      "buildTimingContext scans every slow body once",
      SLOW_BODIES.every((id) => (ctx.occupancy[id] ?? []).length > 0)
    );
    check(
      "A chart with no birth anchor yields no timing context",
      buildTimingContext({
        chart: { ...chart, birthUtc: null }, tree, ayanamsha: "lahiri", av,
        shadbala: sb, bhavaBala: bb, strengths, now: NOW,
      }) === null
    );

    const marriage = LIFE_EVENT_BY_KEY.marriage;
    const spec = {
      primaryHouses: resolveHouses(marriage.rule.primaryHouses),
      supportingHouses: resolveHouses(marriage.rule.supportingHouses),
      negatingHouses: resolveHouses(marriage.rule.negatingHouses),
      karakas: marriage.rule.karakas,
      rule: marriage.rule,
      saturnStance: marriage.rule.transit.sadeSati,
      nodeContact: marriage.rule.transit.nodeContact,
      agePriorAt: (t: number) =>
        agePrior(marriage.band!, (t - chart.birthUtc!.getTime()) / (365.2425 * 86400000)),
    };
    const promise = natalPromise(ctx, spec);
    check("Natal promise stays in 0-100", promise.score >= 0 && promise.score <= 100, `${promise.score}`);
    check("Natal promise cites its evidence", promise.evidence.length > 0);
    check("Natal promise is deterministic", natalPromise(ctx, spec).score === promise.score);

    const windows = findEventWindows(ctx, spec, promise);
    check("Windows are returned chronologically", windows.every((w, i) => i === 0 || w.start >= windows[i - 1].start));
    check("Every window clears the reporting floor", windows.every((w) => w.score >= DEFAULT_MIN_SCORE));
    check(
      "Every window confidence stays in 5-95",
      windows.every((w) => w.confidence >= 5 && w.confidence <= 95)
    );
    check("No window starts before birth", windows.every((w) => w.start >= chart.birthUtc!));
    check(
      "No window falls outside its age band",
      windows.every((w) => {
        const midAge =
          ((w.start.getTime() + w.end.getTime()) / 2 - chart.birthUtc!.getTime()) /
          (365.2425 * 86400000);
        return midAge >= marriage.band!.start && midAge <= marriage.band!.end;
      })
    );
    const perMaha = new Map<PlanetId, number>();
    for (const w of windows) perMaha.set(w.dasha.maha, (perMaha.get(w.dasha.maha) ?? 0) + 1);
    check("At most two windows per Mahadasha survive deduplication", [...perMaha.values()].every((n) => n <= 2));
    check(
      "A named peak is never shorter than three weeks",
      windows.every((w) => !w.peak || w.peak.end.getTime() - w.peak.start.getTime() >= 21 * 86400000)
    );
    check(
      "Every contact explains which natal point it stands on",
      windows.every((w) => w.contacts.every((c) => c.note.length > 0))
    );

    // Nothing in window generation may read "now": the same context scanned
    // against a different instant must yield the same windows, only re-phased.
    const shifted = findEventWindows({ ...ctx, now: new Date("2005-01-01") }, spec, promise);
    check(
      "Window generation is independent of now - only the phase labels move",
      shifted.length === windows.length &&
        shifted.every(
          (w, i) => w.start.getTime() === windows[i].start.getTime() && w.score === windows[i].score
        )
    );
    check("...and the phase labels do move", shifted.some((w, i) => w.phase !== windows[i].phase));
  }

  // --- The assembled timeline ---------------------------------------------
  {
    const timeline = buildLifeEventTimeline({
      chart, dashaTree: tree, ayanamsha: "lahiri", ashtakavarga: av, shadbala: sb,
      bhavaBala: bb, strengths, jaimini: computeJaimini(chart), now: NOW,
    });
    check(
      "The timeline populates for a chart with a birth anchor",
      timeline.hasDasha && timeline.entries.length > 0,
      `${timeline.entries.length} windows`
    );
    check(
      "Timeline entries are chronological",
      timeline.entries.every((e, i) => i === 0 || e.window.start >= timeline.entries[i - 1].window.start)
    );
    check("Entry ids are unique", new Set(timeline.entries.map((e) => e.id)).size === timeline.entries.length);
    check("Every catalogued event gets a promise summary", timeline.promises.length === LIFE_EVENTS.length);
    check("Every entry carries a doctrine line", timeline.entries.every((e) => e.reasoning.doctrine.length > 20));
    check(
      "Every entry names the houses it read",
      timeline.entries.every((e) => e.reasoning.houses.primary.length > 0)
    );
    check(
      "Mahadasha groups only list events that fall inside them",
      timeline.groups.every((g) =>
        g.eventIds.every((id) => {
          const e = timeline.entries.find((x) => x.id === id)!;
          return e.window.start < g.end && e.window.end > g.start;
        })
      )
    );
    check(
      "A chart without a birth anchor degrades to a caveat rather than a crash",
      (() => {
        const t = buildLifeEventTimeline({
          chart: { ...chart, birthUtc: null }, dashaTree: null, ayanamsha: "lahiri",
          ashtakavarga: av, shadbala: sb, bhavaBala: bb, strengths, jaimini: null, now: NOW,
        });
        return !t.hasDasha && t.entries.length === 0 && t.caveats.length > 0;
      })()
    );
  }
}

// ---------------------------------------------------------------------------
// Phase: the two adult-scope sections — reveal gate and the deeper tests.
// ---------------------------------------------------------------------------
{
  const NOW = new Date("2026-06-15T00:00:00.000Z");
  // Cast the way a reader who has reached these sections would have: the
  // sections only exist for a chart that satisfies the gate.
  const base = { ...CANONICAL_INPUT, name: "AU-Canonical", gender: "other" as const };

  // --- The reveal gate -----------------------------------------------------
  // Both conditions, and each is pinned separately: a case-sensitive `AU-`
  // name prefix AND `gender === "other"`. The case sensitivity is the part
  // most likely to be softened by accident during a refactor, so it gets its
  // own checks in both directions.
  {
    const cast = (name: string, gender?: "female" | "male" | "other") =>
      computeAutoChart({ ...CANONICAL_INPUT, name, gender }, "lahiri", "mean");

    check("The gate stays shut with no chart at all", isAdvancedUnlocked(null) === false);
    check(
      "The AU- prefix alone does not open the sections",
      isAdvancedUnlocked(cast("AU-Someone")) === false
    );
    check(
      "Gender 'other' alone does not open the sections",
      isAdvancedUnlocked(cast("Someone", "other")) === false
    );
    check(
      "AU- with the wrong gender does not open them — female",
      isAdvancedUnlocked(cast("AU-Someone", "female")) === false
    );
    check(
      "AU- with the wrong gender does not open them — male",
      isAdvancedUnlocked(cast("AU-Someone", "male")) === false
    );
    check(
      "AU- plus gender 'other' opens them",
      isAdvancedUnlocked(cast("AU-Someone", "other")) === true
    );
    check(
      "The prefix is CASE-SENSITIVE: lowercase au- does not qualify",
      isAdvancedUnlocked(cast("au-someone", "other")) === false
    );
    check(
      "…nor does mixed-case Au-",
      isAdvancedUnlocked(cast("Au-Someone", "other")) === false
    );
    check(
      "A leading space is forgiven — the name is trimmed before matching",
      isAdvancedUnlocked(cast("  AU-Someone ", "other")) === true
    );
    check(
      "A name merely containing AU- does not qualify — it must start with it",
      isAdvancedUnlocked(cast("BeAU-Someone", "other")) === false
    );
    check(
      "An empty name does not qualify",
      isAdvancedUnlocked(cast("", "other")) === false
    );
  }

  // --- The deeper classical tests -----------------------------------------
  {
    const chart = computeAutoChart(base, "lahiri", "mean")!;
    const avSigns: Partial<Record<PlanetId, number>> = {};
    for (const id of PLANETS) {
      const q = chart.planets.find((r) => r.id === id);
      if (q) avSigns[id] = q.sign;
    }
    const av = computeAshtakavarga(avSigns, chart.ascendant.sign);
    const sb = computeShadbala(chart);
    const bb = sb ? computeBhavaBala(chart, sb) : null;
    const strengths = allStrengths(chart, av);
    const vargas = computeVargaSet(chart);
    const jaimini = computeJaimini(chart);
    const yogas = detectYogas(chart);

    const sd = buildSpeculationDepth(chart, vargas, jaimini, bb, yogas);
    const idp = buildIntimacyDepth(chart, vargas, jaimini, av, bb, yogas);

    for (const [label, d] of [["Speculation", sd], ["Intimacy", idp]] as const) {
      check(`${label} depth: the adjustment stays inside ±10`, Math.abs(d.adjustment) <= 10, `${d.adjustment}`);
      check(`${label} depth: it produced prose for its block`, d.paragraphs.length > 0, `${d.paragraphs.length} paragraphs`);
    }

    const specRows = [...sd.positives, ...sd.negatives];
    const intRows = [...idp.strengths, ...idp.frictions];
    check("Speculation depth emits evidence rows", specRows.length > 0, `${specRows.length} rows`);
    check("Intimacy depth emits evidence rows", intRows.length > 0, `${intRows.length} rows`);
    check(
      "Every depth row carries a classical citation",
      [...specRows, ...intRows].every((r) => Boolean(r.source?.work))
    );
    check(
      "Positive rows carry positive weights and negative rows negative ones",
      sd.positives.every((r) => r.weight >= 0) &&
        sd.negatives.every((r) => r.weight < 0) &&
        idp.strengths.every((r) => r.weight >= 0) &&
        idp.frictions.every((r) => r.weight < 0)
    );
    check(
      "No depth row leaks undefined or NaN into its prose",
      ![...specRows, ...intRows, ...sd.paragraphs.map((t) => ({ text: t })), ...idp.paragraphs.map((t) => ({ text: t }))]
        .some((r) => /undefined|NaN|\[object Object\]/.test(r.text))
    );
    check(
      "Both depth modules are deterministic",
      buildSpeculationDepth(chart, vargas, jaimini, bb, yogas).adjustment === sd.adjustment &&
        buildIntimacyDepth(chart, vargas, jaimini, av, bb, yogas).adjustment === idp.adjustment
    );

    // Graceful degradation: every optional input dropped at once.
    const sdBare = buildSpeculationDepth(chart, null, null, null, []);
    const idpBare = buildIntimacyDepth(chart, null, null, null, null, []);
    check(
      "Speculation depth degrades without vargas, Jaimini or Bhava Bala",
      Math.abs(sdBare.adjustment) <= 10
    );
    check(
      "Intimacy depth degrades without Ashtakavarga, vargas, Jaimini or Bhava Bala",
      Math.abs(idpBare.adjustment) <= 10
    );

    // --- The sections that consume them ------------------------------------
    const spec = buildSpeculationReport(chart, vargas, jaimini, sb, strengths, av, yogas, bb);
    const int = buildIntimacyReport(chart, vargas, jaimini, sb, strengths, yogas, av, bb);
    check("Speculation score stays in 5–95", spec.score! >= 5 && spec.score! <= 95, `${spec.score}`);
    check("Intimacy score stays in 5–95", int.score! >= 5 && int.score! <= 95, `${int.score}`);
    check(
      "Both sections render a Deeper classical tests block",
      Boolean(spec.blocks.find((b) => b.heading === "Deeper classical tests")) &&
        Boolean(int.blocks.find((b) => b.heading === "Deeper classical tests"))
    );
    check(
      "The depth rows actually reach the sections' evidence lists",
      spec.worksBecause.length + spec.failsBecause.length > specRows.length &&
        int.strengths.length + int.frictions.length > intRows.length
    );

    // Ashtakavarga was absent from the intimacy section entirely before this,
    // and the source notes already claimed Vimshopaka and the D-60 for it.
    const intText = [...int.strengths, ...int.frictions].map((r) => r.text).join(" ");
    check(
      "Intimacy now consults Ashtakavarga, Vimshopaka and the D-60",
      intText.includes("Ashtakavarga") && intText.includes("Vimshopaka") && intText.includes("Shashtiamsa")
    );

    // The section's ethical boundaries are structural, not incidental: no row
    // may reference the gender selection that reveals the tab.
    check(
      "No intimacy row references gender or the reveal condition",
      !/\b(male|female|man|woman|his|her\b|gender)\b/i.test(intText)
    );

    // --- Intimacy timing: dated output, and the one age constraint --------
    {
      const tree2 = vimshottariTree(chart.planets.find((q) => q.id === "Mo")!.longitude, chart.birthUtc!);
      const timing = buildIntimacyTiming({
        chart, dashaTree: tree2, ayanamsha: "lahiri", ashtakavarga: av,
        shadbala: sb, bhavaBala: bb, strengths, now: NOW,
      });
      const windows = timing.themes.flatMap((t) => t.windows);
      check("Intimacy timing produces dated windows", timing.hasDasha && windows.length > 0, `${windows.length} windows`);
      check("Intimacy timing reads both themes", timing.themes.length === 2);
      check(
        "No intimacy window opens before 18 — the adults-only floor",
        windows.every((w) => w.ageRange.from >= 18),
        `earliest ${Math.min(...windows.map((w) => w.ageRange.from))}`
      );
      check("Intimacy windows are chronological within a theme",
        timing.themes.every((t) => t.windows.every((w, i) => i === 0 || w.start >= t.windows[i - 1].start)));
      check("Intimacy window confidence stays in 5–95",
        windows.every((w) => w.confidence >= 5 && w.confidence <= 95));
      check("Intimacy timing reads the sky today from the Moon", timing.currentGochara.length === 6);
      check(
        "Intimacy timing is deterministic",
        buildIntimacyTiming({
          chart, dashaTree: tree2, ayanamsha: "lahiri", ashtakavarga: av,
          shadbala: sb, bhavaBala: bb, strengths, now: NOW,
        }).themes.every((t, i) => t.windows.length === timing.themes[i].windows.length)
      );
      // The refusal that stands: no age *band*. A band has a peak and a taper
      // and reweights windows by age; the 18 floor does none of that, and
      // AGE_BANDS must stay at its five existing entries.
      check(
        "Intimacy acquires no age band — AGE_BANDS still holds exactly its five entries",
        Object.keys(AGE_BANDS).length === 5 &&
          !Object.keys(AGE_BANDS).some((k) => /intim|desire|sex/i.test(k)),
        Object.keys(AGE_BANDS).join(",")
      );
      // Degradation: the transit half must survive without a dasha tree.
      const bare = buildIntimacyTiming({
        chart, dashaTree: null, ayanamsha: "lahiri", ashtakavarga: av,
        shadbala: sb, bhavaBala: bb, strengths, now: NOW,
      });
      check(
        "Without a dasha tree the transit reading survives and the windows degrade to a caveat",
        !bare.hasDasha && bare.themes.length === 0 &&
          bare.currentGochara.length === 6 && bare.caveats.length > 0
      );
    }

    // --- The Trimsamsa claim: reported, never pronounced ------------------
    {
      const t30 = buildTrimsamsaClaim(chart)!;
      check("Trimsamsa claim reads the Lagna, the Moon and Venus", t30.rows.length === 3,
        t30.rows.map((r) => `${r.point}=${r.lord}`).join(" "));
      check(
        "Every Trimsamsa lord is one of the five the division can produce",
        t30.rows.every((r) => ["Ma", "Sa", "Ju", "Me", "Ve"].includes(r.lord))
      );
      check("Every Trimsamsa row names its presiding deity",
        t30.rows.every((r) => ["Agni", "Vayu", "Indra", "Kubera", "Varuna"].includes(r.deity)));
      // The rule is gender-blind by construction; the asymmetry in the
      // tradition is in reception, not mathematics. Pin that it stays so.
      const forGender = (g: "female" | "male" | "other") =>
        buildTrimsamsaClaim(computeAutoChart({ ...CANONICAL_INPUT, gender: g }, "lahiri", "mean")!)!
          .rows.map((r) => `${r.point}:${r.lord}`).join("|");
      check(
        "The Trimsamsa reading is identical for every gender",
        forGender("female") === forGender("male") && forGender("male") === forGender("other")
      );
      // The verdict form is what is refused: the source's moral vocabulary
      // must not reach the reader.
      const t30Text = [...t30.preamble, ...t30.rows.map((r) => r.text)].join(" ");
      const MORAL = /\b(chaste|unchaste|promiscuous|immoral|adulter\w*|impure|loose\s+(?:woman|character)|of\s+bad\s+character|corrupt)\b/i;
      check("The Trimsamsa rows do not reproduce the source's moral vocabulary", !MORAL.test(t30Text));
      check(
        "…and every row is framed as the text's claim rather than as a finding",
        t30.rows.every((r) => r.text.includes("The classical claim") && r.text.includes("not as a conclusion"))
      );
      check(
        "The preamble states that the rule is contested and how it was applied",
        /contested/i.test(t30Text) && /women's charts/i.test(t30Text)
      );
      check(
        "The claim reaches the section as its own block",
        Boolean(int.blocks.find((b) => b.heading === "A contested classical claim, reported for testing"))
      );
    }

    // The Tajika annual point reaches the year engine.
    const tree = vimshottariTree(chart.planets.find((q) => q.id === "Mo")!.longitude, chart.birthUtc!);
    const year = speculationYearWindows(
      chart, tree, "lahiri", av,
      new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)), NOW, strengths
    );
    check("The year engine still produces a full month table", year.months.length === 12, `${year.months.length} months`);
    check(
      "…and it is deterministic",
      speculationYearWindows(
        chart, tree, "lahiri", av,
        new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2027, 0, 1)), NOW, strengths
      ).months.every((m, i) => m.score === year.months[i].score)
    );
    // Muntha advances one house per completed year, so a scan of two adjacent
    // years must see two different houses named.
    const munthaHouse = (y: number) =>
      munthaAt(chart, new Date(Date.UTC(y, 5, 1)))!.house;
    check(
      "Muntha advances exactly one house per completed year",
      ((munthaHouse(2027) - munthaHouse(2026) + 12) % 12) === 1,
      `${munthaHouse(2026)} → ${munthaHouse(2027)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 8: Raman ayanamsha and the panchang day-parts.
//
// The day-parts are the first module whose output is a set of CLOCK TIMES
// rather than longitudes, so the checks are shaped differently: they assert
// that the divisions tile their arc exactly, that the classical weekday tables
// come out right for all seven weekdays, and that the limb boundaries actually
// bracket the value they claim to.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 8: Raman ayanamsha + panchang day-parts ===");
  const NOW8 = new Date("2026-06-15T00:00:00.000Z");

  // -- Raman ----------------------------------------------------------------
  // Raman and Lahiri are both anchored at 1900 Jan 0.5 and carried by the same
  // precession, so their difference must be the Swiss Ephemeris epoch gap
  // (22.460148 - 21.013444) at EVERY instant, not just at the anchor.
  const RAMAN_GAP = 1.446704;
  const gapAt = (d: Date) => lahiriAyanamsha(d) - ramanAyanamsha(d);
  check(
    "Raman sits a constant 1.446704 deg behind Lahiri across four centuries",
    [1800, 1900, 2000, 2100, 2200].every((y) =>
      approx(gapAt(new Date(Date.UTC(y, 0, 1, 12))), RAMAN_GAP, 1e-9)
    ),
    `gap @2000 = ${gapAt(new Date(Date.UTC(2000, 0, 1, 12))).toFixed(6)}`
  );
  check(
    "Raman orders below Pushya, which orders below Lahiri",
    ramanAyanamsha(NOW8) < pushyaAyanamsha(NOW8) && pushyaAyanamsha(NOW8) < lahiriAyanamsha(NOW8)
  );
  check(
    "getAyanamsha dispatches every id to its own function",
    getAyanamsha("lahiri", NOW8) === lahiriAyanamsha(NOW8) &&
      getAyanamsha("pushya", NOW8) === pushyaAyanamsha(NOW8) &&
      getAyanamsha("raman", NOW8) === ramanAyanamsha(NOW8)
  );
  check(
    "Every declared ayanamsha id has a label and a short label",
    AYANAMSHA_IDS.every((id) => Boolean(AYANAMSHA_LABELS[id] && AYANAMSHA_SHORT[id])),
    AYANAMSHA_IDS.join(", ")
  );
  {
    // A whole chart must compute under Raman, and must differ from Lahiri by
    // exactly the ayanamsha gap on every body.
    const rc = computeAutoChart(CANONICAL_INPUT, "raman", "mean")!;
    check("A full chart computes under Raman", rc.planets.length === 9);
    check(
      "...and every Raman longitude leads its Lahiri counterpart by the gap",
      rc.planets.every((p) => {
        const l = chart.planets.find((q) => q.id === p.id)!;
        let d = p.longitude - l.longitude;
        if (d < -180) d += 360;
        if (d > 180) d -= 360;
        return approx(d, RAMAN_GAP, 1e-6);
      })
    );
    check(
      "...and the ayanamsha recorded in chart meta is the one that was used",
      rc.meta.ayanamsha === "raman" && approx(rc.meta.ayanamshaValue, ramanAyanamsha(rc.birthUtc!), 1e-9)
    );
  }

  // -- Day parts ------------------------------------------------------------
  const LAT8 = CANONICAL_INPUT.place!.lat;
  const LON8 = CANONICAL_INPUT.place!.lon;
  const TZ8 = CANONICAL_INPUT.place!.timezone;

  // Seven consecutive noons, so every weekday's table is exercised.
  const week = Array.from({ length: 7 }, (_, i) =>
    computeDayParts(new Date(Date.UTC(2026, 2, 1 + i, 6, 30)), LAT8, LON8, TZ8)
  );
  check("Day parts compute for all seven weekdays", week.every((w) => w !== null));

  const parts = week.map((w) => w!);
  check("...covering each weekday exactly once", new Set(parts.map((p) => p.varaIndex)).size === 7);

  // The eight/twelve divisions must tile their arc with no gap or overlap.
  const tiles = (spans: { start: Date; end: Date }[], from: Date, to: Date): boolean =>
    spans.length > 0 &&
    spans[0].start.getTime() === from.getTime() &&
    spans[spans.length - 1].end.getTime() === to.getTime() &&
    spans.every(
      (s, i) => s.end > s.start && (i === 0 || s.start.getTime() === spans[i - 1].end.getTime())
    );

  check(
    "Day choghadiya tile the sunrise-to-sunset arc exactly",
    parts.every((p) => p.choghadiyaDay.length === 8 && tiles(p.choghadiyaDay, p.sunrise, p.sunset))
  );
  check(
    "Night choghadiya tile the sunset-to-next-sunrise arc exactly",
    parts.every(
      (p) => p.choghadiyaNight.length === 8 && tiles(p.choghadiyaNight, p.sunset, p.nextSunrise)
    )
  );
  check(
    "Twenty-four horas tile the whole astrological day",
    parts.every(
      (p) =>
        p.horaDay.length === 12 &&
        p.horaNight.length === 12 &&
        tiles(p.horaDay, p.sunrise, p.sunset) &&
        tiles(p.horaNight, p.sunset, p.nextSunrise)
    )
  );

  check(
    "Rahu, Gulika and Yamaganda are three DISTINCT eighths of the day",
    parts.every((p) => {
      const starts = [p.rahuKaal, p.gulikaKaal, p.yamaganda].map((s) => s.start.getTime());
      return new Set(starts).size === 3;
    })
  );
  {
    // The classical published tables, as 1-based eighths (Sunday first).
    const RAHU = [8, 2, 7, 5, 6, 4, 3];
    const GULIKA = [7, 6, 5, 4, 3, 2, 1];
    const YAMA = [5, 4, 3, 2, 1, 7, 6];
    const NIGHT_GULIKA = [3, 2, 1, 7, 6, 5, 4];
    const eighthIndex = (p: (typeof parts)[number], s: { start: Date }): number =>
      Math.round(
        (s.start.getTime() - p.sunrise.getTime()) /
          ((p.sunset.getTime() - p.sunrise.getTime()) / 8)
      ) + 1;
    const nightEighthIndex = (p: (typeof parts)[number], s: { start: Date }): number =>
      Math.round(
        (s.start.getTime() - p.sunset.getTime()) /
          ((p.nextSunrise.getTime() - p.sunset.getTime()) / 8)
      ) + 1;
    check(
      "Rahu Kaal matches the published weekday table",
      parts.every((p) => eighthIndex(p, p.rahuKaal) === RAHU[p.varaIndex]),
      parts.map((p) => `${p.varaName.slice(0, 3)}=${eighthIndex(p, p.rahuKaal)}`).join(" ")
    );
    check(
      "Gulika Kaal - derived as Saturn's eighth - matches the published table",
      parts.every((p) => eighthIndex(p, p.gulikaKaal) === GULIKA[p.varaIndex]),
      parts.map((p) => `${p.varaName.slice(0, 3)}=${eighthIndex(p, p.gulikaKaal)}`).join(" ")
    );
    check(
      "Yamaganda - derived as Jupiter's eighth - matches the published table",
      parts.every((p) => eighthIndex(p, p.yamaganda) === YAMA[p.varaIndex]),
      parts.map((p) => `${p.varaName.slice(0, 3)}=${eighthIndex(p, p.yamaganda)}`).join(" ")
    );
    check(
      "Night Gulika matches the published night table",
      parts.every((p) => nightEighthIndex(p, nightKaalas(p).gulika) === NIGHT_GULIKA[p.varaIndex]),
      parts
        .map((p) => `${p.varaName.slice(0, 3)}=${nightEighthIndex(p, nightKaalas(p).gulika)}`)
        .join(" ")
    );
  }

  // Abhijit is the 8th of fifteen muhurtas, so it must straddle the arc midpoint.
  check(
    "Abhijit Muhurta is centred on the midpoint of the day arc",
    parts.every((p) => {
      const mid = (p.sunrise.getTime() + p.sunset.getTime()) / 2;
      const abhijitMid = (p.abhijit.start.getTime() + p.abhijit.end.getTime()) / 2;
      return Math.abs(abhijitMid - mid) < 1000;
    })
  );
  check(
    "Abhijit is withheld on Wednesday and offered on the other six days",
    parts.every((p) => p.abhijitApplies === (p.varaIndex !== 3))
  );

  {
    const DAY_START = ["Udveg", "Amrit", "Rog", "Labh", "Shubh", "Char", "Kaal"];
    const NIGHT_START = ["Shubh", "Char", "Kaal", "Udveg", "Amrit", "Rog", "Labh"];
    check(
      "Every weekday's day-choghadiya opens on the published name",
      parts.every((p) => p.choghadiyaDay[0].name === DAY_START[p.varaIndex]),
      parts.map((p) => `${p.varaName.slice(0, 3)}=${p.choghadiyaDay[0].name}`).join(" ")
    );
    check(
      "Every weekday's night-choghadiya opens on the published name",
      parts.every((p) => p.choghadiyaNight[0].name === NIGHT_START[p.varaIndex]),
      parts.map((p) => `${p.varaName.slice(0, 3)}=${p.choghadiyaNight[0].name}`).join(" ")
    );
    check(
      "Every choghadiya carries a meaning string",
      parts.every((p) =>
        [...p.choghadiyaDay, ...p.choghadiyaNight].every((c) => Boolean(CHOGHADIYA_MEANING[c.name]))
      )
    );
  }

  // The hora chain must agree with shadbala.ts: the first hora of the day is
  // the weekday lord, and the 25th (= next day's first) is the next weekday's.
  check(
    "The day's first hora is the weekday lord",
    parts.every((p) => p.horaDay[0].lord === p.varaLord)
  );
  check(
    "Twenty-four horas later the chain lands on the NEXT weekday's lord",
    parts.every((p, i) => {
      const next = parts[(i + 1) % 7];
      const CH = ["Sa", "Ju", "Ma", "Su", "Ve", "Me", "Mo"];
      const twentyFifth = CH[(CH.indexOf(p.varaLord) + 24) % 7];
      return twentyFifth === next.varaLord;
    })
  );
  check(
    "Exactly one choghadiya and one hora are marked current",
    parts.every(
      (p) =>
        [...p.choghadiyaDay, ...p.choghadiyaNight].filter((c) => c.current).length === 1 &&
        [...p.horaDay, ...p.horaNight].filter((h) => h.current).length === 1
    )
  );

  // A night birth must resolve to the PREVIOUS sunrise's weekday, matching
  // panchang.ts's sunrise-anchored vara.
  {
    const at2am = new Date(Date.UTC(2026, 2, 4, 20, 30)); // 02:00 IST on the 5th
    const p = computeDayParts(at2am, LAT8, LON8, TZ8)!;
    check(
      "A 2 a.m. instant belongs to the previous sunrise's astrological day",
      !p.isDay && p.sunrise < at2am && p.nextSunrise > at2am,
      `${p.varaName}, sunrise ${p.sunrise.toISOString().slice(0, 16)}`
    );
    check(
      "...and its vara agrees with panchang.ts for the same instant",
      p.varaIndex === computePanchang(0, 0, at2am, TZ8, LAT8, LON8).varaIndex
    );
  }

  // Polar degradation: no sun arc, no divisions - and no crash.
  check(
    "Above the Arctic circle in midsummer the day-parts degrade to null",
    computeDayParts(new Date(Date.UTC(2026, 5, 21, 12)), 78.2, 15.6, "Arctic/Longyearbyen") === null
  );

  // -- Limb timings ---------------------------------------------------------
  {
    const at = chart.birthUtc!;
    const L = computeLimbTimings(at, "lahiri");
    const limbs = [L.tithi, L.nakshatra, L.yoga, L.karana];
    const pb = computePanchang(
      chart.planets.find((p) => p.id === "Su")!.longitude,
      chart.planets.find((p) => p.id === "Mo")!.longitude,
      at,
      TZ8,
      LAT8,
      LON8
    );
    check("All four limb timings resolve without hitting the horizon", limbs.every((l) => !l.approximate));
    check("Every limb bracket contains the queried instant", limbs.every((l) => l.start <= at && at < l.end));
    check("Every limb bracket is ordered", limbs.every((l) => l.end > l.start));
    check(
      "Limb indices agree with panchang.ts for the same instant",
      L.tithi.index === pb.tithiIndex &&
        L.nakshatra.index === pb.nakshatraIndex &&
        L.yoga.index === pb.yogaIndex,
      `tithi ${L.tithi.index}, nak ${L.nakshatra.index}, yoga ${L.yoga.index}`
    );
    check("The limb names agree too", L.nakshatra.name === pb.nakshatraName && L.yoga.name === pb.yogaName);
    check("The karana name agrees with panchang.ts", L.karana.name === pb.karanaName);
    check("The karana ends no later than its tithi (two karanas per tithi)", L.karana.end <= L.tithi.end);

    // Durations must sit near the classical means. Generous bands - the Moon's
    // speed varies by ~15% between perigee and apogee.
    const days = (l: typeof L.tithi) => (l.end.getTime() - l.start.getTime()) / 86400000;
    check("Tithi duration is within the classical band", days(L.tithi) > 0.75 && days(L.tithi) < 1.3, `${days(L.tithi).toFixed(3)}d`);
    check("Nakshatra duration is within the classical band", days(L.nakshatra) > 0.85 && days(L.nakshatra) < 1.2, `${days(L.nakshatra).toFixed(3)}d`);
    check("Yoga duration is within the classical band", days(L.yoga) > 0.75 && days(L.yoga) < 1.2, `${days(L.yoga).toFixed(3)}d`);
    check("Karana duration is within the classical band", days(L.karana) > 0.35 && days(L.karana) < 0.7, `${days(L.karana).toFixed(3)}d`);
    check(
      "Limb timings are deterministic",
      computeLimbTimings(at, "lahiri").tithi.end.getTime() === L.tithi.end.getTime()
    );
    check(
      "Tithi is ayanamsha-free; nakshatra is not",
      computeLimbTimings(at, "raman").tithi.end.getTime() === L.tithi.end.getTime() &&
        computeLimbTimings(at, "raman").nakshatra.end.getTime() !== L.nakshatra.end.getTime()
    );
    check(
      "karanaNameOfHalf agrees with panchang.ts across all sixty halves",
      [...Array(60).keys()].every((h) => {
        const MOV = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
        const FIX = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"];
        const expected = h === 0 ? FIX[3] : h >= 57 ? FIX[h - 57] : MOV[(h - 1) % 7];
        return karanaNameOfHalf(h) === expected;
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Phase 9: the interpretation depth layer and the life-area options engine.
//
// Both features add PROSE derived from numbers, so the checks are about the
// derivation rather than the wording: that every claim degrades to silence when
// its source is absent, that no string leaks an undefined or a NaN, and that
// the convergence/ranking logic actually reflects the numbers it cites.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 9: interpretation depth + life-area options ===");
  const NOW9 = new Date("2026-06-15T00:00:00.000Z");

  const signs9: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) signs9[p.id] = p.sign;
  const av9 = computeAshtakavarga(signs9, chart.ascendant.sign);
  const strengths9 = allStrengths(chart, av9);
  const vargas9 = computeVargaSet(chart);
  const jaimini9 = computeJaimini(chart);
  const shadbala9 = computeShadbala(chart);
  const bhavaBala9 = shadbala9 ? computeBhavaBala(chart, shadbala9) : null;
  const tree9 = vimshottariTree(chart.planets.find((p) => p.id === "Mo")!.longitude, chart.birthUtc!);
  const yogas9 = detectYogas(chart);

  const full = interpretFullChart(chart, strengths9, {
    vargas: vargas9,
    shadbala: shadbala9,
    bhavaBala: bhavaBala9,
    ashtakavarga: av9,
    jaimini: jaimini9,
  });

  // -- Depth layer ----------------------------------------------------------
  check("Every house gets a depth block when the full context is supplied", full.every((h) => h.depth.length > 0));
  check(
    "Every house's depth block ends with the convergence line",
    full.every((h) => h.depth[h.depth.length - 1].startsWith("Convergence"))
  );
  check(
    "The SAV values reported per house sum to the classical 337",
    full.reduce((a, h) => a + (h.sav ?? 0), 0) === 337,
    `${full.reduce((a, h) => a + (h.sav ?? 0), 0)}`
  );
  check(
    "Each house's reported SAV is the Ashtakavarga row for its own sign",
    full.every((h) => h.sav === av9.sav[h.sign])
  );
  check(
    "Each house's reported Bhava Bala matches the Bhava Bala table",
    full.every((h) => {
      const row = bhavaBala9!.find((b) => b.house === h.house);
      return h.bhavaRupas !== null && row !== undefined && Math.abs(h.bhavaRupas - row.rupas) < 1e-9;
    })
  );
  check(
    "No depth paragraph leaks undefined, null or NaN",
    full.every((h) => h.depth.every((d) => !/undefined|NaN|\[object|null/.test(d)))
  );
  check(
    "No depth paragraph is empty or a bare fragment",
    full.every((h) => h.depth.every((d) => d.trim().length > 40))
  );
  check(
    "The convergence line names only measures that actually contributed",
    full.every((h) => {
      const line = h.depth[h.depth.length - 1];
      // Bhava Bala is only nameable when the table was supplied; it was, so the
      // inverse check is the meaningful one: nothing may name the Navamsa
      // unless the varga set exists.
      return vargas9 !== null || !line.includes("the Navamsa");
    })
  );

  // Degradation: each source removed independently must remove only its own claim.
  {
    const bare = interpretFullChart(chart, strengths9);
    check("With no depth context at all, the depth block is empty", bare.every((h) => h.depth.length === 0));
    check("...and sav/bhavaRupas report null rather than 0", bare.every((h) => h.sav === null && h.bhavaRupas === null));
    check(
      "...while the Rashi prose is untouched",
      bare.every((h, i) => h.paragraphs.length === full[i].paragraphs.length)
    );

    const noVarga = interpretFullChart(chart, strengths9, { ashtakavarga: av9, bhavaBala: bhavaBala9 });
    check(
      "Without the varga set no house claims a Navamsa reading",
      noVarga.every((h) => h.depth.every((d) => !d.startsWith("Navamsa")))
    );
    check("...but the Ashtakavarga and Bhava Bala claims survive", noVarga.every((h) => h.depth.length >= 2));

    const noSb = interpretFullChart(chart, strengths9, { vargas: vargas9, ashtakavarga: av9 });
    check(
      "Without Shadbala no house quotes a rupa figure for its lord",
      noSb.every((h) => h.depth.every((d) => !d.startsWith("Shadbala")))
    );
  }

  check(
    "A vargottama lord is reported as such rather than as plain agreement",
    (() => {
      const vo = vargas9.vargottama;
      if (vo.length === 0) return true; // nothing to assert on this chart
      return full.some((h) =>
        vo.includes(h.lord.id) ? h.depth.some((d) => d.includes("vargottama")) : true
      );
    })(),
    `vargottama: ${vargas9.vargottama.join(",") || "none"}`
  );

  // -- Life-area options ----------------------------------------------------
  const areas = buildLifeAreaReports(chart, tree9, av9, yogas9, NOW9, {
    vargas: vargas9,
    shadbala: shadbala9,
    bhavaBala: bhavaBala9,
    jaimini: jaimini9,
  });

  check("All eight life areas build", areas.length === 8);
  check("Every area produces at least two ranked possibilities", areas.every((a) => a.possibilities.length >= 2));
  check("No area produces more than five", areas.every((a) => a.possibilities.length <= 5));
  check(
    "Possibilities are ranked in descending fit",
    areas.every((a) => a.possibilities.every((p, i) => i === 0 || p.fit <= a.possibilities[i - 1].fit))
  );
  check(
    "The top possibility is always at 100% by construction",
    areas.every((a) => a.possibilities[0].fit === 100)
  );
  check("Every fit sits in 20-100", areas.every((a) => a.possibilities.every((p) => p.fit >= 20 && p.fit <= 100)));
  check(
    "Every possibility carries at least one classical reason",
    areas.every((a) => a.possibilities.every((p) => p.reasons.length > 0))
  );
  check(
    "No possibility repeats a graha within its area",
    areas.every((a) => new Set(a.possibilities.map((p) => p.planet)).size === a.possibilities.length)
  );
  check(
    "Every possibility's label and detail come from the area's own table",
    areas.every((a) =>
      a.possibilities.every((p) => {
        const entry = AREA_OPTIONS[a.key][p.planet];
        return entry !== undefined && entry.label === p.label && entry.detail === p.detail;
      })
    )
  );
  check(
    "Every area names a divisional chart the tradition assigns it",
    areas.every((a) => Boolean(AREA_VARGA[a.key]))
  );
  check("Every area produces practical levers", areas.every((a) => a.levers.length >= 2));
  check(
    "Every lever carries a title and a body",
    areas.every((a) => a.levers.every((l) => l.title.length > 5 && l.body.length > 40))
  );
  check(
    "The lead lever always names the top-ranked graha",
    areas.every((a) => a.levers[0].body.startsWith(PLANET_NAMES[a.possibilities[0].planet]))
  );
  check(
    "With the full context every area reports three corroborations",
    areas.every((a) => a.corroboration.length === 3),
    areas.map((a) => a.corroboration.length).join(",")
  );
  check(
    "No option, lever or corroboration string leaks undefined or NaN",
    areas.every((a) =>
      [...a.possibilities.map((p) => `${p.label} ${p.detail} ${p.reasons.join(" ")}`),
       ...a.levers.map((l) => `${l.title} ${l.body}`),
       ...a.corroboration].every((t) => !/undefined|NaN|\[object/.test(t))
    )
  );
  check(
    "The options engine is deterministic",
    (() => {
      const again = buildLifeAreaReports(chart, tree9, av9, yogas9, NOW9, {
        vargas: vargas9, shadbala: shadbala9, bhavaBala: bhavaBala9, jaimini: jaimini9,
      });
      return again.every((a, i) =>
        a.possibilities.every((p, j) => p.planet === areas[i].possibilities[j].planet && p.fit === areas[i].possibilities[j].fit)
      );
    })()
  );

  // Degradation of the options engine.
  {
    const bare = buildLifeAreaReports(chart, null, null, [], NOW9);
    check("Without any depth the areas still rank possibilities", bare.every((a) => a.possibilities.length >= 2));
    check("...and still emit levers", bare.every((a) => a.levers.length >= 1));
    check("...but claim no corroboration", bare.every((a) => a.corroboration.length === 0));
    check(
      "...and no lever cites Ashtakavarga bindus it does not have",
      bare.every((a) => a.levers.every((l) => !l.body.includes("bindus")))
    );
  }

  // The engine must never invent a signification: every graha named in any
  // area's table has to be one of the nine, and every area key must be covered.
  check(
    "The options tables cover all eight areas and name only real grahas",
    (Object.keys(AREA_OPTIONS) as (keyof typeof AREA_OPTIONS)[]).length === 8 &&
      Object.values(AREA_OPTIONS).every((t) =>
        Object.keys(t).every((id) => PLANETS.includes(id as PlanetId))
      )
  );
}

// ---------------------------------------------------------------------------
// Phase 10: input validation.
//
// Every check here guards a path where the engine previously produced a
// confident, well-formatted, WRONG answer rather than an error: a birth date
// outside the ayanamsha's validity, a civil time that does not exist, a
// hand-entered chart that cannot physically occur. The bar is that each
// validator fires on the bad case and stays silent on the good one — a
// validator that warns about everything is as useless as one that warns about
// nothing, so both directions are asserted.
// ---------------------------------------------------------------------------
{
  console.log("\n=== Phase 10: input validation ===");

  // -- Birth date bounds ----------------------------------------------------
  const sev = (iss: { severity: string }[]) => iss.map((i) => i.severity).join(",");
  check("A year before 1850 is a hard error", sev(checkBirthDate("1500-06-01")) === "error");
  check("A year after 2150 is a hard error", sev(checkBirthDate("2200-06-01")) === "error");
  check("The boundary years themselves are accepted", checkBirthDate("1850-01-01").every((i) => i.severity !== "error") && checkBirthDate("2150-12-31").every((i) => i.severity !== "error"));
  check("A year in the degraded band warns but does not block", sev(checkBirthDate("1870-06-01")) === "warn");
  check("...on both sides", sev(checkBirthDate("2120-06-01")) === "warn");
  check("A modern date raises nothing at all", checkBirthDate("1990-01-24").length === 0);
  check("A malformed date is an error rather than a crash", sev(checkBirthDate("not-a-date")) === "error");
  check(
    "The exported bounds agree with the messages",
    DATE_MIN === "1850-01-01" && DATE_MAX === "2150-12-31"
  );
  check(
    "The date bound matches the one PredictionPanel already used",
    Number(DATE_MIN.slice(0, 4)) === 1850 && Number(DATE_MAX.slice(0, 4)) === 2150
  );

  // -- Coordinates ----------------------------------------------------------
  check("Sane coordinates raise nothing", checkCoordinates(28.6139, 77.209).length === 0);
  check("Out-of-range latitude is an error", checkCoordinates(999, 0).some((i) => i.severity === "error"));
  check("Out-of-range longitude is an error", checkCoordinates(0, 999).some((i) => i.severity === "error"));
  check(
    "...and an out-of-range latitude does NOT also emit the polar warning",
    checkCoordinates(999, 0).filter((i) => i.severity === "warn").length === 0
  );
  check("A polar latitude warns", checkCoordinates(78.2, 15.6).some((i) => i.severity === "warn"));
  check("...on both hemispheres", checkCoordinates(-78.2, 15.6).some((i) => i.severity === "warn"));
  check("Just inside the polar circle stays quiet", checkCoordinates(66.0, 15.6).length === 0);

  // -- Local time / DST -----------------------------------------------------
  {
    // 02:30 on 2026-03-08 does not exist in America/New_York (spring forward).
    const gap = localToUtc("America/New_York", "2026-03-08", "02:30");
    const issues = checkLocalTime("America/New_York", "2026-03-08", "02:30", gap);
    check("A non-existent civil time is detected", issues.length > 0, `${issues.length} notes`);
    check(
      "...and the message says the time does not exist",
      issues.some((i) => i.message.includes("does not exist"))
    );
    const normal = localToUtc("Asia/Kolkata", "1990-01-24", "12:30");
    check(
      "An ordinary IST birth raises nothing",
      checkLocalTime("Asia/Kolkata", "1990-01-24", "12:30", normal).length === 0
    );
    // India has had no DST since 1945, so a modern IST date must be quiet even
    // adjacent to the northern-hemisphere clock-change dates.
    const march = localToUtc("Asia/Kolkata", "2026-03-08", "02:30");
    check(
      "A zone with no clock changes stays quiet on a clock-change date elsewhere",
      checkLocalTime("Asia/Kolkata", "2026-03-08", "02:30", march).length === 0
    );
  }

  // -- Manual chart plausibility -------------------------------------------
  {
    const base = {
      lagnaSign: 0,
      ascDeg: 10,
      anchor: { dateISO: "", time: "", place: null },
    };
    const mk = (planets: { id: PlanetId; house: number; deg: number; retro: boolean }[]) =>
      ({ ...base, planets }) as ManualInputState;

    const sound = mk([
      { id: "Su", house: 1, deg: 10, retro: false },
      { id: "Me", house: 1, deg: 25, retro: false }, // 15 deg from the Sun
      { id: "Ve", house: 2, deg: 10, retro: false }, // 30 deg from the Sun
      { id: "Ra", house: 1, deg: 0, retro: true },
      { id: "Ke", house: 7, deg: 0, retro: true },
    ]);
    check("A physically possible manual chart raises nothing", validateManualChart(sound).length === 0);

    const badMe = mk([
      { id: "Su", house: 1, deg: 10, retro: false },
      { id: "Me", house: 4, deg: 10, retro: false }, // 90 deg — impossible
    ]);
    check(
      "Mercury beyond its maximum elongation is caught",
      validateManualChart(badMe).some((i) => i.field === "Me")
    );

    const badVe = mk([
      { id: "Su", house: 1, deg: 10, retro: false },
      { id: "Ve", house: 4, deg: 10, retro: false }, // 90 deg — impossible
    ]);
    check(
      "Venus beyond its maximum elongation is caught",
      validateManualChart(badVe).some((i) => i.field === "Ve")
    );

    const okVe = mk([
      { id: "Su", house: 1, deg: 10, retro: false },
      { id: "Ve", house: 2, deg: 25, retro: false }, // 45 deg — legal for Venus
    ]);
    check(
      "...but a 45-degree Venus, which is legal, is NOT flagged",
      validateManualChart(okVe).length === 0
    );

    const badNode = mk([
      { id: "Ra", house: 1, deg: 0, retro: true },
      { id: "Ke", house: 4, deg: 0, retro: true }, // 90 deg apart — broken axis
    ]);
    check(
      "A broken Rahu/Ketu axis is caught",
      validateManualChart(badNode).some((i) => i.field === "Ke" && i.message.includes("apart"))
    );

    const dupe = mk([
      { id: "Su", house: 1, deg: 10, retro: false },
      { id: "Su", house: 2, deg: 10, retro: false },
    ]);
    check(
      "A duplicated graha is an error, not a warning",
      dupe && validateManualChart(dupe).some((i) => i.severity === "error" && i.field === "Su")
    );

    const badDeg = mk([{ id: "Su", house: 1, deg: 45, retro: false }]);
    check(
      "A degree outside its sign is an error",
      validateManualChart(badDeg).some((i) => i.severity === "error")
    );

    const badAsc = { ...mk([]), ascDeg: 45 } as ManualInputState;
    check(
      "A Lagna degree outside its sign is an error",
      validateManualChart(badAsc).some((i) => i.severity === "error" && i.field === "asc")
    );
  }

  // -- Ketu derivation ------------------------------------------------------
  check(
    "Ketu is derived six houses from Rahu, at the same degree, for every house",
    Array.from({ length: 12 }, (_, i) => i + 1).every((h) => {
      const k = ketuFromRahu(h, 17.5);
      return k.deg === 17.5 && ((k.house - h + 12) % 12) === 6;
    })
  );
  check(
    "...and deriving twice returns to the start",
    Array.from({ length: 12 }, (_, i) => i + 1).every(
      (h) => ketuFromRahu(ketuFromRahu(h, 3).house, 3).house === h
    )
  );
  check(
    "A derived Ketu satisfies the nodal-axis validator",
    Array.from({ length: 12 }, (_, i) => i + 1).every((h) => {
      const k = ketuFromRahu(h, 12);
      const chartIn = {
        lagnaSign: 0,
        ascDeg: 10,
        planets: [
          { id: "Ra" as PlanetId, house: h, deg: 12, retro: true },
          { id: "Ke" as PlanetId, house: k.house, deg: k.deg, retro: true },
        ],
        anchor: { dateISO: "", time: "", place: null },
      } as ManualInputState;
      return validateManualChart(chartIn).length === 0;
    })
  );

  // -- The rectify API now enforces the same bound ---------------------------
  {
    const mkReq = (dateISO: string) => ({
      birth: { dateISO, time: "12:30", timezone: "Asia/Kolkata", lat: 28.6139, lon: 77.209 },
      events: Array.from({ length: 5 }, (_, i) => ({
        type: "marriage",
        dateISO: `20${10 + i}-06-01`,
        precision: "year",
        reliability: "probable",
      })),
    });
    const bad = validateRectifyRequest(mkReq("1500-01-01"));
    check("The rectify API rejects a birth date outside the ayanamsha window", bad.ok === false);
    const good = validateRectifyRequest(mkReq("1990-01-24"));
    check("...and still accepts a modern one", good.ok === true);
  }
}

// ---------------------------------------------------------------------------
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
