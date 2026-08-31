import { aspectedSigns } from "../aspects";
import { computeAutoChart } from "../chart";
import { DASHA_YEARS, NAKSHATRA_LORDS, SIGN_LORDS } from "../constants";
import { vimshottariTree } from "../dasha";
import { degInSign, nakshatraOf, padaOf } from "../math";
import { solarReturn } from "../scan";
import { localToUtc, tzOffsetMinutes, utcOffsetLabel } from "../time";
import { computeVargaSet, vargaSign, type VargaSet } from "../varga";
import type { AutoInputState, AyanamshaId, ChartData, DashaPeriod, PlanetId } from "../types";
import { checkBirthDate } from "../validate";
import { EVENT_RULES, resolveHouses } from "./eventRules";
import { dashaShiftDaysPerMinute } from "./dashaFitness";
import {
  aggregate,
  degreesOfFreedom,
  distribution,
  eventSampleInstants,
  leaveOneOut,
  scoreEvent,
  tiedInterval,
  verdictFor,
  COMFORTABLE_EVENTS,
  MIN_EVENTS,
} from "./score";
import { transitSnapshot, type TransitSnapshot } from "./transitFitness";
import {
  VARGA_SENSITIVITY_NOTE,
  type CandidateScore,
  type CrossCheck,
  type DualAyanamshaResult,
  type LifeEvent,
  type Reconciliation,
  type RectificationResult,
  type RectifyBirth,
} from "./types";

/**
 * Birth Time Rectification orchestrator (Janma Samaya Shodhana).
 *
 * Sweeps candidate birth minutes around a recorded time, scores each against
 * the supplied life events, and runs the whole pipeline TWICE — once under
 * Lahiri (Chitra Paksha) and once under Pushya-paksha — fully independently.
 * The two results are then reconciled but never averaged, blended or chosen
 * between: they are two schools' answers, and their agreement is the honest
 * confidence signal.
 */

/** Half-width of the search window, in civil minutes either side of the record. */
export const RECTIFY_WINDOW_MIN = 15;
/** Step between candidates, in civil minutes. */
export const RECTIFY_STEP_MIN = 1;

/** A Lagna sandhi this close to the recorded time makes the window high-leverage. */
export const SANDHI_ALERT_MIN = 4;

const AYANAMSHAS: AyanamshaId[] = ["lahiri", "pushya"];

// ---------------------------------------------------------------------------
// Civil-time stepping
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Shift a civil local date/time by whole minutes using plain calendar
 * arithmetic (so it steps in CLOCK minutes, which is what "the record may be
 * ±15 minutes out" actually means). Whether those clock minutes are also
 * uniform UTC minutes is checked separately — that is the DST test.
 */
export function shiftLocalCivil(
  dateISO: string,
  time: string,
  minutes: number
): { dateISO: string; time: string } {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) + minutes * 60000);
  return {
    dateISO: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}

function offsets(windowMin: number, stepMin: number): number[] {
  const out: number[] = [];
  for (let m = -windowMin; m <= windowMin; m += stepMin) out.push(m);
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const PRECISIONS = ["exact", "month", "year"];
const RELIABILITIES = ["certain", "probable", "hearsay"];

export interface RectifyRequest {
  birth: RectifyBirth;
  events: LifeEvent[];
  windowMin?: number;
  stepMin?: number;
}

/**
 * Manual validation, matching the repo's zero-dependency stance (no zod).
 * Returns the parsed request or a list of human-readable problems.
 */
export function validateRectifyRequest(
  body: unknown
): { ok: true; value: RectifyRequest; warnings: string[] } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["Body must be a JSON object."] };
  const b = body as Record<string, unknown>;

  const birthRaw = b.birth;
  if (typeof birthRaw !== "object" || birthRaw === null) {
    return { ok: false, errors: ["`birth` is required and must be an object."] };
  }
  const br = birthRaw as Record<string, unknown>;
  const str = (k: string): string | null => (typeof br[k] === "string" && br[k] ? (br[k] as string) : null);
  const dateISO = str("dateISO");
  const time = str("time");
  const timezone = str("timezone");
  const lat = typeof br.lat === "number" ? br.lat : NaN;
  const lon = typeof br.lon === "number" ? br.lon : NaN;

  if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) errors.push("`birth.dateISO` must be YYYY-MM-DD.");
  else {
    // Same ayanamsha-validity bound the UI enforces on the birth date input:
    // a rectification sweep outside it would refine a minute against a zodiac
    // this engine cannot place accurately.
    for (const issue of checkBirthDate(dateISO)) {
      if (issue.severity === "error") errors.push(`\`birth.dateISO\`: ${issue.message}`);
      else warnings.push(issue.message);
    }
  }
  if (!time || !/^\d{2}:\d{2}$/.test(time)) errors.push("`birth.time` must be HH:mm.");
  if (!timezone) errors.push("`birth.timezone` must be an IANA zone name.");
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push("`birth.lat` must be a number in −90…90.");
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) errors.push("`birth.lon` must be a number in −180…180 (east positive).");
  if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      errors.push(`\`birth.timezone\` "${timezone}" is not a recognised IANA zone.`);
    }
  }

  const eventsRaw = b.events;
  if (!Array.isArray(eventsRaw)) {
    errors.push("`events` must be an array.");
  } else {
    if (eventsRaw.length < MIN_EVENTS) {
      errors.push(`At least ${MIN_EVENTS} dated life events are required; ${eventsRaw.length} supplied.`);
    } else if (eventsRaw.length < COMFORTABLE_EVENTS) {
      warnings.push(
        `Only ${eventsRaw.length} events supplied. Below ${COMFORTABLE_EVENTS} the fit is easy to achieve by chance — treat the result as provisional.`
      );
    }
    eventsRaw.forEach((e, i) => {
      if (typeof e !== "object" || e === null) {
        errors.push(`events[${i}] must be an object.`);
        return;
      }
      const ev = e as Record<string, unknown>;
      if (typeof ev.type !== "string" || !(ev.type in EVENT_RULES)) {
        errors.push(`events[${i}].type "${String(ev.type)}" is not a supported event type.`);
      }
      if (typeof ev.dateISO !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ev.dateISO)) {
        errors.push(`events[${i}].dateISO must be YYYY-MM-DD (use the 1st for month/year precision).`);
      }
      if (typeof ev.precision !== "string" || !PRECISIONS.includes(ev.precision)) {
        errors.push(`events[${i}].precision must be one of ${PRECISIONS.join(", ")}.`);
      }
      if (typeof ev.reliability !== "string" || !RELIABILITIES.includes(ev.reliability)) {
        errors.push(`events[${i}].reliability must be one of ${RELIABILITIES.join(", ")}.`);
      }
    });
  }

  const windowMin = typeof b.windowMin === "number" ? b.windowMin : RECTIFY_WINDOW_MIN;
  const stepMin = typeof b.stepMin === "number" ? b.stepMin : RECTIFY_STEP_MIN;
  if (!(windowMin > 0) || windowMin > 240) errors.push("`windowMin` must be between 1 and 240.");
  if (!(stepMin > 0) || stepMin > windowMin) errors.push("`stepMin` must be positive and no larger than `windowMin`.");

  if (errors.length) return { ok: false, errors };

  const events = (eventsRaw as Record<string, unknown>[]).map((e, i) => ({
    id: typeof e.id === "string" && e.id ? e.id : `e${i + 1}`,
    type: e.type as LifeEvent["type"],
    dateISO: e.dateISO as string,
    precision: e.precision as LifeEvent["precision"],
    reliability: e.reliability as LifeEvent["reliability"],
    note: typeof e.note === "string" ? e.note : undefined,
  }));

  return {
    ok: true,
    warnings,
    value: {
      birth: {
        name: str("name") ?? undefined,
        dateISO: dateISO!,
        time: time!,
        timezone: timezone!,
        lat,
        lon,
        placeName: str("placeName") ?? undefined,
        gender: (br.gender === "female" || br.gender === "male" || br.gender === "other"
          ? br.gender
          : undefined) as RectifyBirth["gender"],
        nodeMode: br.nodeMode === "true" ? "true" : "mean",
      },
      events,
      windowMin,
      stepMin,
    },
  };
}

// ---------------------------------------------------------------------------
// Timezone sanity
// ---------------------------------------------------------------------------

/**
 * A wrong historical UTC offset ruins a rectification more completely than any
 * astrological mistake, and the failure is silent — the chart still computes.
 * These checks make the three ways it happens visible: a Local-Mean-Time-era
 * record (offsets that are not whole quarter-hours), a DST transition inside
 * the search window (civil minutes stop being UTC minutes), and a historical
 * offset that differs from the zone's modern one.
 */
export function timezoneWarnings(birth: RectifyBirth, windowMin: number, stepMin: number): string[] {
  const warnings: string[] = [];
  const base = localToUtc(birth.timezone, birth.dateISO, birth.time);
  const baseOffset = tzOffsetMinutes(birth.timezone, base);

  if (baseOffset % 15 !== 0) {
    warnings.push(
      `The timezone database gives ${birth.timezone} an offset of ${utcOffsetLabel(birth.timezone, base)} on this date — not a whole quarter-hour. That is a Local Mean Time era record. Confirm whether the birth was recorded in LMT or in a standard zone time; the two differ by many minutes and would move the true birth instant outside this ±${windowMin}-minute window.`
    );
  }

  // Uniformity across the window: civil minutes must map to UTC minutes.
  const stamps = offsets(windowMin, stepMin).map((m) => {
    const local = shiftLocalCivil(birth.dateISO, birth.time, m);
    return localToUtc(birth.timezone, local.dateISO, local.time).getTime();
  });
  let nonUniform = false;
  for (let i = 1; i < stamps.length; i++) {
    if (Math.abs(stamps[i] - stamps[i - 1] - stepMin * 60000) > 1000) nonUniform = true;
  }
  if (nonUniform) {
    warnings.push(
      `A clock change (daylight saving or a zone redefinition) falls inside the ±${windowMin}-minute search window. Candidate minutes are not uniformly spaced in real time, and the recorded clock time may be ambiguous or non-existent. Verify which clock the birth was recorded on before trusting any result here.`
    );
  }

  // Same-day transition, even if outside the window itself.
  const dayBefore = tzOffsetMinutes(birth.timezone, new Date(base.getTime() - 86400000));
  const dayAfter = tzOffsetMinutes(birth.timezone, new Date(base.getTime() + 86400000));
  if (!nonUniform && (dayBefore !== baseOffset || dayAfter !== baseOffset)) {
    warnings.push(
      `${birth.timezone} changes its UTC offset within 24 hours of this birth (${dayBefore / 60}h → ${baseOffset / 60}h → ${dayAfter / 60}h). Records around a clock change are frequently written in the wrong offset.`
    );
  }

  const modernOffset = tzOffsetMinutes(birth.timezone, new Date());
  if (Math.abs(modernOffset - baseOffset) >= 30) {
    warnings.push(
      `${birth.timezone} used ${utcOffsetLabel(birth.timezone, base)} on this date but ${utcOffsetLabel(birth.timezone, new Date())} today. The historical offset has been applied, which is correct — but if the birth certificate was written using today's offset, the recorded time is out by ${Math.abs(modernOffset - baseOffset)} minutes.`
    );
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Candidate construction
// ---------------------------------------------------------------------------

interface Candidate {
  offsetMin: number;
  local: { dateISO: string; time: string };
  chart: ChartData;
  tree: DashaPeriod[] | null;
  vargas: VargaSet;
}

function buildCandidates(
  birth: RectifyBirth,
  ayanamsha: AyanamshaId,
  windowMin: number,
  stepMin: number
): Candidate[] {
  const input = (local: { dateISO: string; time: string }): AutoInputState => ({
    name: birth.name ?? "",
    dateISO: local.dateISO,
    time: local.time,
    place: {
      name: birth.placeName ?? "Birth place",
      lat: birth.lat,
      lon: birth.lon,
      timezone: birth.timezone,
    },
    gender: birth.gender,
  });

  const out: Candidate[] = [];
  for (const m of offsets(windowMin, stepMin)) {
    const local = shiftLocalCivil(birth.dateISO, birth.time, m);
    const chart = computeAutoChart(input(local), ayanamsha, birth.nodeMode ?? "mean");
    if (!chart) continue;
    const moon = chart.planets.find((p) => p.id === "Mo");
    const tree = moon && chart.birthUtc ? vimshottariTree(moon.longitude, chart.birthUtc) : null;
    out.push({ offsetMin: m, local, chart, tree, vargas: computeVargaSet(chart) });
  }
  return out;
}

/**
 * Minutes from this candidate to the Lagna's nearest sign change, using the
 * Lagna's own measured speed rather than a textbook 4-minutes-per-degree —
 * the real rate depends on latitude and on which sign is rising (0.300°/min on
 * the canonical Delhi chart, i.e. one degree every 3.3 minutes).
 */
function minutesToSandhi(candidates: Candidate[], index: number): number {
  const asc = candidates[index].chart.ascendant.longitude;
  const prev = candidates[Math.max(0, index - 1)].chart.ascendant.longitude;
  const next = candidates[Math.min(candidates.length - 1, index + 1)].chart.ascendant.longitude;
  const span = Math.max(1, Math.min(candidates.length - 1, index + 1) - Math.max(0, index - 1));
  let speed = (((next - prev + 540) % 360) - 180) / span; // degrees per minute
  if (Math.abs(speed) < 1e-6) speed = 0.25;
  const d = degInSign(asc);
  return Math.min(d, 30 - d) / Math.abs(speed);
}

// ---------------------------------------------------------------------------
// Cross-checks on the winner (reported, never scored)
// ---------------------------------------------------------------------------

function crossChecks(
  candidates: CandidateScore[],
  winner: Candidate,
  winnerScore: CandidateScore,
  events: LifeEvent[],
  ayanamsha: AyanamshaId
): CrossCheck[] {
  const checks: CrossCheck[] = [];
  const chart = winner.chart;

  // 1. Ascendant nakshatra & pada stability across the top candidates.
  const top = [...candidates].sort((a, b) => b.score - a.score).slice(0, 5);
  const combos = [...new Set(top.map((c) => `${c.ascNakshatra}:${c.ascPada}`))];
  checks.push({
    key: "asc-nakshatra",
    label: "Ascendant nakshatra & pada across the top 5 candidates",
    detail:
      combos.length === 1
        ? `All five agree: nakshatra ${winnerScore.ascNakshatra + 1}, pada ${winnerScore.ascPada}. The rising star is settled even where the minute is not.`
        : `${combos.length} different nakshatra/pada combinations appear among the top five candidates, so the rising star itself is not settled by these events.`,
  });

  // 2. Lagna sandhi distance.
  checks.push({
    key: "lagna-sandhi",
    label: "Distance to the nearest Lagna sandhi",
    detail:
      winnerScore.minutesToLagnaSandhi <= SANDHI_ALERT_MIN
        ? `${winnerScore.minutesToLagnaSandhi.toFixed(1)} minutes — the recorded time sits on a Lagna sign boundary. This is a HIGH-LEVERAGE window: the whole-sign chart itself changes inside it, so the rashi evidence is unusually strong here and the result deserves more weight than in an ordinary window.`
        : `${winnerScore.minutesToLagnaSandhi.toFixed(1)} minutes. The Lagna sign does not change inside the search window, so the rashi (D-1) house placements are a weak discriminator and the divisional charts are carrying the result.`,
  });

  // 3. Sudarshana Chakra: does the event bhava light up from Lagna, Moon AND Sun?
  const moon = chart.planets.find((p) => p.id === "Mo");
  const sun = chart.planets.find((p) => p.id === "Su");
  const frames: { label: string; sign: number }[] = [
    { label: "Lagna", sign: chart.ascendant.sign },
    ...(moon ? [{ label: "Moon", sign: moon.sign }] : []),
    ...(sun ? [{ label: "Sun", sign: sun.sign }] : []),
  ];
  const sudarshana = events.map((ev) => {
    const es = winnerScore.events.find((e) => e.eventId === ev.id);
    const lords = es?.lords ? [es.lords.maha, es.lords.antar, es.lords.pratyantar] : [];
    const houses = resolveHouses(EVENT_RULES[ev.type].primaryHouses);
    const lit = frames.filter((f) =>
      houses.some((h) => {
        const sign = (f.sign + h - 1) % 12;
        const occupied = chart.planets.some((p) => p.sign === sign && lords.includes(p.id));
        const aspected = chart.planets.some(
          (p) => lords.includes(p.id) && p.sign !== sign && aspectedSigns(p.id, p.sign).includes(sign)
        );
        return occupied || aspected || lords.includes(SIGN_LORDS[sign]);
      })
    );
    return { type: ev.type, lit: lit.length, of: frames.length, frames: lit.map((f) => f.label) };
  });
  const allThree = sudarshana.filter((s) => s.lit === s.of).length;
  checks.push({
    key: "sudarshana",
    label: "Sudarshana Chakra (event bhava read from Lagna, Moon and Sun)",
    detail: `${allThree} of ${events.length} events have their bhava activated by a running dasha lord in all three frames. ${sudarshana
      .map((s) => `${EVENT_RULES[s.type].label}: ${s.lit}/${s.of}${s.lit ? ` (${s.frames.join(", ")})` : ""}`)
      .join(" · ")}`,
  });

  // 4. Varshaphala anchor — solar return and Muntha for each event year.
  if (chart.birthUtc) {
    const years = [...new Set(events.map((e) => Number(e.dateISO.slice(0, 4))))].sort();
    const lines = years.slice(0, 8).map((year) => {
      const sr = solarReturn(chart, ayanamsha, year);
      const age = year - chart.birthUtc!.getUTCFullYear();
      const munthaHouse = ((age % 12) + 12) % 12 + 1;
      const munthaSign = (chart.ascendant.sign + munthaHouse - 1) % 12;
      return `${year}: return ${sr ? sr.toISOString().slice(0, 10) : "n/a"}, Muntha in the ${munthaHouse}${munthaHouse === 1 ? "st" : munthaHouse === 2 ? "nd" : munthaHouse === 3 ? "rd" : "th"} (lord ${SIGN_LORDS[munthaSign]})`;
    });
    checks.push({
      key: "varshaphala",
      label: "Solar return and Muntha for the event years",
      detail: `${lines.join(" · ")}. Muntha is advanced one sign per completed year from the natal Lagna; the full Tajika year-lord procedure (five candidates, sahams, mudda dasha) is not implemented in this engine, so this is an anchor, not a Varshaphala reading.`,
    });
  }

  // 5. Resolution of the dasha evidence for THIS chart.
  const moonSpeed = moon ? Math.abs(moon.speed) : 13.18;
  const openingLord = NAKSHATRA_LORDS[moon ? nakshatraOf(moon.longitude) : 0];
  const shift = dashaShiftDaysPerMinute(moonSpeed, openingLord);
  checks.push({
    key: "dasha-resolution",
    label: "Dasha resolution in this window",
    detail: `The Moon is moving ${moonSpeed.toFixed(2)}°/day and the opening lord is ${openingLord} (${DASHA_YEARS[openingLord]} years), so one minute of birth time translates every boundary in the 120-year cycle by ${shift.toFixed(2)} days — ${(shift * (candidates.length - 1) / 2).toFixed(0)} days across the whole window. Mahadasha and Antardasha boundaries barely move at that scale; Pratyantardasha boundaries, which can be nine days apart, move a long way.`,
  });

  return checks;
}

// ---------------------------------------------------------------------------
// One full sweep under one ayanamsha
// ---------------------------------------------------------------------------

function sweep(
  birth: RectifyBirth,
  events: LifeEvent[],
  ayanamsha: AyanamshaId,
  windowMin: number,
  stepMin: number
): RectificationResult {
  const candidates = buildCandidates(birth, ayanamsha, windowMin, stepMin);
  if (!candidates.length) throw new Error("No candidate chart could be computed for this birth record.");

  // Transits depend on the event instant and the ayanamsha, never on the birth
  // minute — so one snapshot set serves all 31 candidates.
  const snapshots = new Map<string, TransitSnapshot[]>();
  for (const ev of events) {
    snapshots.set(
      ev.id,
      eventSampleInstants(ev).map((t) => transitSnapshot(ayanamsha, t, birth.nodeMode ?? "mean"))
    );
  }

  const scored: CandidateScore[] = candidates.map((c, i) => {
    const eventScores = events.map((ev) =>
      scoreEvent(c.chart, c.tree, c.vargas, ev, birth.gender, snapshots.get(ev.id)!)
    );
    const moon = c.chart.planets.find((p) => p.id === "Mo");
    const moonNak = moon ? nakshatraOf(moon.longitude) : 0;
    return {
      offsetMin: c.offsetMin,
      localTime: c.local.time,
      utcMs: c.chart.birthUtc ? c.chart.birthUtc.getTime() : 0,
      score: aggregate(eventScores),
      events: eventScores,
      ascendant: c.chart.ascendant.longitude,
      ascSign: c.chart.ascendant.sign,
      ascNakshatra: nakshatraOf(c.chart.ascendant.longitude),
      ascPada: padaOf(c.chart.ascendant.longitude),
      d9LagnaSign: vargaSign("D9", c.chart.ascendant.longitude),
      d60LagnaSign: vargaSign("D60", c.chart.ascendant.longitude),
      moonNakshatra: moonNak,
      openingLord: NAKSHATRA_LORDS[moonNak],
      minutesToLagnaSandhi: minutesToSandhi(candidates, i),
      bhavaShifted: c.chart.planets.filter((p) => p.bhava !== p.house).map((p) => p.id),
    };
  });

  // Ties are broken toward the recorded time: with no evidence to separate two
  // minutes, the record itself is the least-invented answer.
  const best = [...scored].sort(
    (a, b) => b.score - a.score || Math.abs(a.offsetMin) - Math.abs(b.offsetMin)
  )[0];
  const others = scored.filter((c) => c.offsetMin !== best.offsetMin);
  const runnerUp = others.length
    ? [...others].sort((a, b) => b.score - a.score || Math.abs(a.offsetMin) - Math.abs(b.offsetMin))[0]
    : null;

  const interval = tiedInterval(scored, best);
  const stats = distribution(scored, best, interval);
  const { verdict, reason } = verdictFor(stats);
  const stability = leaveOneOut(scored, best);
  const winner = candidates.find((c) => c.offsetMin === best.offsetMin)!;

  const edgeWarning = Math.abs(best.offsetMin) >= windowMin;
  const signsInWindow = new Set(scored.map((c) => c.ascSign));
  const highLeverageWindow = signsInWindow.size > 1 || best.minutesToLagnaSandhi <= SANDHI_ALERT_MIN;

  const warnings: string[] = [];
  if (edgeWarning) {
    warnings.push(
      `The best candidate sits at the ${best.offsetMin > 0 ? "+" : ""}${best.offsetMin}-minute edge of the search window. The true optimum most likely lies outside it — re-run with a wider window before taking this time seriously.`
    );
  }
  if (!stability.stable) {
    warnings.push(
      `Unstable: removing ${stability.hinges.map((h) => EVENT_RULES[h.type].label.toLowerCase()).join(" or ")} moves the winning minute. The result hangs on ${stability.hinges.length === 1 ? "that single event" : "those events"}.`
    );
  }
  if (events.length < COMFORTABLE_EVENTS) {
    warnings.push(
      `Only ${events.length} events against ${scored.length} candidate minutes. With this few constraints a convincing-looking peak can be pure noise.`
    );
  }
  if (signsInWindow.size === 1) {
    warnings.push(
      "The Ascendant sign is the same for every candidate, so the rashi (D-1) chart contributes almost nothing here. The ranking is being driven by the divisional charts — chiefly the D-60 — and by which sub-sub-period each candidate places the events in."
    );
  }

  return {
    ayanamsha,
    candidates: scored,
    best,
    runnerUp,
    stats,
    verdict,
    verdictReason: reason,
    interval: {
      startOffsetMin: interval.startOffsetMin,
      endOffsetMin: interval.endOffsetMin,
      startLocal: scored.find((c) => c.offsetMin === interval.startOffsetMin)!.localTime,
      endLocal: scored.find((c) => c.offsetMin === interval.endOffsetMin)!.localTime,
    },
    stability,
    dof: degreesOfFreedom(events, scored.length),
    edgeWarning,
    highLeverageWindow,
    crossChecks: crossChecks(scored, winner, best, events, ayanamsha),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Reconciliation — never average, never pick a winner
// ---------------------------------------------------------------------------

function reconcile(
  lahiri: RectificationResult,
  pushya: RectificationResult,
  events: LifeEvent[]
): Reconciliation {
  const divergenceMin = Math.abs(lahiri.best.offsetMin - pushya.best.offsetMin);
  const tier = divergenceMin <= 2 ? "High" : divergenceMin <= 5 ? "Moderate" : "Low";

  const lNak = lahiri.best.moonNakshatra;
  const pNak = pushya.best.moonNakshatra;
  const nakshatraDivergence = lNak !== pNak;

  const eventSplit = events.map((ev) => {
    const l = lahiri.best.events.find((e) => e.eventId === ev.id)!;
    const p = pushya.best.events.find((e) => e.eventId === ev.id)!;
    const d = l.score - p.score;
    return {
      eventId: ev.id,
      type: ev.type,
      lahiriScore: l.score,
      pushyaScore: p.score,
      favours: (Math.abs(d) < 0.02 ? "tie" : d > 0 ? "lahiri" : "pushya") as "lahiri" | "pushya" | "tie",
    };
  });

  const notes: string[] = [];
  notes.push(
    `Pushya-paksha runs 1.122° behind Lahiri, so every sidereal longitude is 1.122° higher under Pushya — 8.4% of a nakshatra and 2.24 shashtiamsas.`
  );
  if (nakshatraDivergence) {
    notes.push(
      `THE NATAL MOON FALLS IN A DIFFERENT NAKSHATRA UNDER THE TWO AYANAMSHAS (${NAKSHATRA_LORDS[lNak]} under Lahiri, ${NAKSHATRA_LORDS[pNak]} under Pushya). The two systems therefore run entirely different Vimshottari sequences — different opening lord, different balance at birth, different order of all nine Mahadashas. The two rectified times are answering two different questions and must not be averaged or reconciled. Decide which ayanamsha you are working in first, then read only that column.`
    );
  } else {
    notes.push(
      `The natal Moon stays in the same nakshatra (${NAKSHATRA_LORDS[lNak]}-ruled) under both ayanamshas, so both systems run the same Vimshottari sequence and the dasha evidence is comparable between them.`
    );
  }
  notes.push(VARGA_SENSITIVITY_NOTE);
  notes.push(
    `Ayanamsha-robust evidence here: transit angles to the natal Moon and Lagna, the Guru–Shani double transit, vedha, bhava cusp positions, and dasha-boundary distance while the nakshatra is unchanged. Ayanamsha-sensitive evidence: every varga lord (D-9, D-10, D-60), sign-based dignity, and nakshatra lordship near a boundary.`
  );
  const favL = eventSplit.filter((e) => e.favours === "lahiri").length;
  const favP = eventSplit.filter((e) => e.favours === "pushya").length;
  notes.push(
    `Per-event split: ${favL} event${favL === 1 ? "" : "s"} fit better under Lahiri, ${favP} under Pushya, ${eventSplit.length - favL - favP} tied. That split is often more informative than either winning time — a system that fits your marriage but not your career is telling you something about the rule set, not about the minute.`
  );
  notes.push(
    "The two columns are never averaged, blended or chosen between. They are two schools' answers to the same question."
  );

  return {
    divergenceMin,
    tier,
    nakshatraDivergence,
    lahiriOpening: { nakshatra: lNak, lord: NAKSHATRA_LORDS[lNak] },
    pushyaOpening: { nakshatra: pNak, lord: NAKSHATRA_LORDS[pNak] },
    eventSplit,
    notes,
  };
}

// ---------------------------------------------------------------------------

/**
 * Run the full dual-ayanamsha rectification. Pure: no `Date.now()` reaches any
 * astrological decision, and the input `ChartData` is never mutated — every
 * candidate gets a freshly computed chart.
 */
export function rectify(req: RectifyRequest): DualAyanamshaResult {
  const started = Date.now();
  const windowMin = req.windowMin ?? RECTIFY_WINDOW_MIN;
  const stepMin = req.stepMin ?? RECTIFY_STEP_MIN;

  const results = AYANAMSHAS.map((a) => sweep(req.birth, req.events, a, windowMin, stepMin));
  const [lahiri, pushya] = results;

  return {
    birth: req.birth,
    events: req.events,
    windowMin,
    stepMin,
    lahiri,
    pushya,
    reconciliation: reconcile(lahiri, pushya, req.events),
    timeWarnings: timezoneWarnings(req.birth, windowMin, stepMin),
    elapsedMs: Date.now() - started,
  };
}

/** Re-exported so callers do not need to reach into three modules. */
export { EVENT_LABELS, EVENT_RULES, EVENT_TYPES } from "./eventRules";
export { COMFORTABLE_EVENTS, MIN_EVENTS } from "./score";

/** Helper for the UI: houses this event type reads, already Bhavat-Bhavam resolved. */
export function primaryHousesFor(type: LifeEvent["type"]): number[] {
  return resolveHouses(EVENT_RULES[type].primaryHouses);
}
