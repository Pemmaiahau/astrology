import { NAKSHATRAS, TITHI_NAMES, VARA_LORDS, VARA_NAMES, YOGA_NAMES } from "./constants";
import { moonRiseSetFrom, nextSunrise, nextSunset, sunriseFor, sunsetFor } from "./ephemeris";
import { norm360 } from "./math";
import { refineCrossing, siderealLongitudeAt } from "./scan";
import type { AyanamshaId, NodeMode, PlanetId } from "./types";

/**
 * Panchang day-parts — the practical half of the panchang.
 *
 * `panchang.ts` answers "which tithi/vara/nakshatra/yoga/karana is running?" at
 * an instant. That is the *classificatory* panchang. This module answers the
 * questions a panchang is actually consulted for day to day:
 *
 *   - when does the current tithi / nakshatra / yoga / karana **end**?
 *   - which stretches of today are Rahu Kaal, Gulika Kaal, Yamaganda?
 *   - when is Abhijit Muhurta?
 *   - what is the choghadiya and the hora right now?
 *   - when do the Sun and Moon rise and set?
 *
 * Every day-part here is a division of the **sunrise→sunset** (day) or
 * **sunset→next sunrise** (night) arc, never of the civil clock. That is the
 * classical construction and it is also why these times drift through the year
 * and differ by latitude: an eighth of a Chennai day in June is not an eighth
 * of a Srinagar day in December.
 *
 * Sources
 * -------
 * - Kaala divisions (Rahu/Gulika/Yamaganda as fixed eighths of the day arc,
 *   and their night counterparts): Muhurta Chintamani; Phaladeepika ch. 3.
 * - Gulika and Yamaganda are *derived* here rather than tabulated, because they
 *   are exactly the Saturn- and Jupiter-ruled eighths under the classical rule
 *   that the day's eight parts are lorded from the weekday lord onward in
 *   weekday order (the eighth being lordless). Both derivations reproduce the
 *   published tables for all seven weekdays; see the checks harness.
 * - Rahu Kaal is *not* derivable that way — Rahu holds no weekday lordship and
 *   takes the lordless eighth on Sunday — so it stays a table.
 * - Abhijit: the 8th of the day's fifteen muhurtas, centred on apparent noon.
 * - Choghadiya and Hora: standard Muhurta usage; conventions noted at each table.
 *
 * Deliberately NOT implemented: Varjyam and Amrit Kaal. Both need the
 * per-nakshatra vishaghati fractions, and the published tables disagree on
 * several nakshatras. Guessing them would put invented numbers next to derived
 * ones, which is the one thing this engine does not do.
 */

const MINUTE = 60000;

export interface TimeSpan {
  start: Date;
  end: Date;
}

/** A named division of the day or night arc. */
export interface NamedSpan extends TimeSpan {
  name: string;
  /** Graha ruling this division, where the scheme assigns one. */
  lord: PlanetId;
  quality: "auspicious" | "neutral" | "inauspicious";
  /** 1-based index within its own (day or night) sequence. */
  index: number;
  /** True when the queried instant falls inside this span. */
  current: boolean;
}

/** One of the five limbs, with the boundaries it runs between. */
export interface LimbSpan extends TimeSpan {
  /** Display name of the limb value that is running. */
  name: string;
  /** 0-based index of the limb value (tithi 0–29, nakshatra 0–26, …). */
  index: number;
  /** True when `start`/`end` were clipped by the search horizon rather than found. */
  approximate: boolean;
}

export interface DayParts {
  /** The sunrise that opens the astrological day containing the query instant. */
  sunrise: Date;
  sunset: Date;
  /** The sunrise that closes it. */
  nextSunrise: Date;
  moonrise: Date | null;
  moonset: Date | null;
  /** 0 = Sunday. Sunrise-anchored, matching `panchang.ts`. */
  varaIndex: number;
  varaName: string;
  varaLord: PlanetId;
  /** True when the query instant falls between sunrise and sunset. */
  isDay: boolean;

  rahuKaal: TimeSpan;
  gulikaKaal: TimeSpan;
  yamaganda: TimeSpan;
  abhijit: TimeSpan;
  /** Abhijit is not observed on Wednesday in the common convention. */
  abhijitApplies: boolean;

  choghadiyaDay: NamedSpan[];
  choghadiyaNight: NamedSpan[];
  horaDay: NamedSpan[];
  horaNight: NamedSpan[];
  /** Whichever choghadiya/hora contains the query instant. */
  currentChoghadiya: NamedSpan | null;
  currentHora: NamedSpan | null;
}

/** The five limbs with their start and end instants. */
export interface LimbTimings {
  tithi: LimbSpan;
  nakshatra: LimbSpan;
  yoga: LimbSpan;
  karana: LimbSpan;
}

// ---------------------------------------------------------------------------
// Kaala tables
// ---------------------------------------------------------------------------

/**
 * Rahu Kaal as a 1-based eighth of the day arc, indexed by weekday (0 = Sunday).
 * Sun 8th · Mon 2nd · Tue 7th · Wed 5th · Thu 6th · Fri 4th · Sat 3rd.
 * Verified against the canonical 06:00–18:00 reference day, where these give
 * the familiar 16:30, 07:30, 15:00, 12:00, 13:30, 10:30 and 09:00 starts.
 */
const RAHU_KAAL_PART: number[] = [8, 2, 7, 5, 6, 4, 3];

/**
 * The eight parts of the day arc are lorded from the weekday lord onward in
 * weekday order (Su → Mo → Ma → Me → Ju → Ve → Sa, cycling), the eighth part
 * being lordless. So the part ruled by graha `g` is found by solving
 * `VARA_LORDS[(vara + k − 1) mod 7] === g` for k.
 *
 * Gulika is Saturn's part; Yamaganda is Jupiter's.
 */
function partRuledBy(lordIndexInWeekOrder: number, vara: number): number {
  return (((lordIndexInWeekOrder - vara) % 7) + 7) % 7 + 1;
}

const SATURN_WEEK_INDEX = VARA_LORDS.indexOf("Sa"); // 6
const JUPITER_WEEK_INDEX = VARA_LORDS.indexOf("Ju"); // 4

/**
 * At night the eight parts are lorded from the 5th weekday lord onward, so the
 * same solve shifts by four. This reproduces the published night-Gulika table
 * (Sun 3rd · Mon 2nd · Tue 1st · Wed 7th · Thu 6th · Fri 5th · Sat 4th).
 */
function nightPartRuledBy(lordIndexInWeekOrder: number, vara: number): number {
  return partRuledBy(lordIndexInWeekOrder, (vara + 4) % 7);
}

/**
 * Choghadiya cycle, in the order the day's divisions advance through it.
 *
 * The day's first choghadiya is the one belonging to the weekday lord, which
 * reproduces every published day-sequence start (Sun Udveg · Mon Amrit ·
 * Tue Rog · Wed Labh · Thu Shubh · Fri Char · Sat Kaal).
 *
 * The night's first choghadiya is the 5th onward in this same cycle, which
 * likewise reproduces every published night start (Sun Shubh · Mon Char ·
 * Tue Kaal · Wed Udveg · Thu Amrit · Fri Rog · Sat Labh). The cycle then
 * continues in the same direction as by day — that continuation is the one
 * element of this module taken from the rule rather than from a table, and it
 * is flagged here so it can be checked against a preferred panchang.
 */
const CHOGHADIYA_CYCLE: { name: string; lord: PlanetId; quality: NamedSpan["quality"] }[] = [
  { name: "Udveg", lord: "Su", quality: "inauspicious" },
  { name: "Char", lord: "Ve", quality: "neutral" },
  { name: "Labh", lord: "Me", quality: "auspicious" },
  { name: "Amrit", lord: "Mo", quality: "auspicious" },
  { name: "Kaal", lord: "Sa", quality: "inauspicious" },
  { name: "Shubh", lord: "Ju", quality: "auspicious" },
  { name: "Rog", lord: "Ma", quality: "inauspicious" },
];

export const CHOGHADIYA_MEANING: Record<string, string> = {
  Udveg: "anxiety — government and official work only; avoid new undertakings",
  Char: "movable — travel, movement and errands; neutral for everything else",
  Labh: "profit — trade, negotiation, anything meant to earn",
  Amrit: "nectar — the most auspicious of the eight; suitable for anything",
  Kaal: "death — avoid beginnings; acceptable for accumulation and repair",
  Shubh: "auspicious — ceremony, marriage, and work you want to endure",
  Rog: "disease — conflict and confrontation only; avoid health and travel matters",
};

/**
 * Hora (planetary hour) order — descending Chaldean, starting from the weekday
 * lord at sunrise. Identical to the sequence `shadbala.ts` uses for the Hora
 * sub-bala, so the two can never disagree about who rules a given hour.
 */
const CHALDEAN: PlanetId[] = ["Sa", "Ju", "Ma", "Su", "Ve", "Me", "Mo"];

const HORA_QUALITY: Record<PlanetId, NamedSpan["quality"]> = {
  Ju: "auspicious", Ve: "auspicious", Me: "auspicious", Mo: "auspicious",
  Su: "neutral",
  Sa: "inauspicious", Ma: "inauspicious",
  Ra: "inauspicious", Ke: "inauspicious",
};

export const HORA_USE: Partial<Record<PlanetId, string>> = {
  Su: "authority, government, dealings with superiors",
  Mo: "travel, public matters, anything needing goodwill",
  Ma: "disputes, surgery, physical exertion; avoid agreements",
  Me: "study, writing, accounts, negotiation",
  Ju: "ceremony, teaching, finance, anything meant to last",
  Ve: "marriage, art, purchases, hospitality",
  Sa: "labour, repair, endings; avoid beginnings",
};

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

function weekdayInZone(at: Date, timeZone?: string): number {
  if (timeZone) {
    try {
      const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(at);
      const i = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
      if (i >= 0) return i;
    } catch {
      /* fall through */
    }
  }
  return at.getUTCDay();
}

/** Equal divisions of an arc, as [start, end] pairs. */
function divide(start: Date, end: Date, parts: number): TimeSpan[] {
  const t0 = start.getTime();
  const width = (end.getTime() - t0) / parts;
  return Array.from({ length: parts }, (_, i) => ({
    start: new Date(t0 + i * width),
    end: new Date(t0 + (i + 1) * width),
  }));
}

function contains(span: TimeSpan, at: Date): boolean {
  return at.getTime() >= span.start.getTime() && at.getTime() < span.end.getTime();
}

/**
 * Every day-part for the astrological day containing `at`.
 *
 * Returns null where the day arc itself is undefined — above the polar circles
 * the Sun can fail to rise or set for months, and there is no classical
 * construction for an eighth of a day that never ends. Callers degrade to the
 * five limbs alone rather than inventing a frame, exactly as `shadbala.ts`
 * degrades to the composite score.
 */
export function computeDayParts(
  at: Date,
  lat: number,
  lon: number,
  timeZone?: string
): DayParts | null {
  const rise = sunriseFor(at, lat, lon);
  const set = sunsetFor(at, lat, lon);
  if (!rise || !set) return null;

  // `sunriseFor`/`sunsetFor` both return the most recent event at or before
  // `at`, so whichever is later tells us which arc we are inside.
  const isDay = set < rise;

  let daySunrise: Date;
  let daySunset: Date;
  let dayNextSunrise: Date;

  if (isDay) {
    // Inside the daylight arc: it opened at `rise` and closes at the next sunset.
    daySunrise = rise;
    const ns = nextSunset(at, lat, lon);
    if (!ns || ns <= rise) return null;
    daySunset = ns;
    const nr = nextSunrise(daySunset, lat, lon);
    if (!nr) return null;
    dayNextSunrise = nr;
  } else {
    // Inside the night arc: it opened at `set`, and the astrological day it
    // belongs to opened at the sunrise before that sunset.
    daySunrise = rise;
    daySunset = set;
    const nr = nextSunrise(at, lat, lon);
    if (!nr) return null;
    dayNextSunrise = nr;
  }

  const varaIndex = weekdayInZone(daySunrise, timeZone);
  const varaLord = VARA_LORDS[varaIndex];

  const dayEighths = divide(daySunrise, daySunset, 8);
  const nightEighths = divide(daySunset, dayNextSunrise, 8);

  const rahuKaal = dayEighths[RAHU_KAAL_PART[varaIndex] - 1];
  const gulikaKaal = dayEighths[partRuledBy(SATURN_WEEK_INDEX, varaIndex) - 1];
  const yamaganda = dayEighths[partRuledBy(JUPITER_WEEK_INDEX, varaIndex) - 1];

  // Abhijit: the 8th of fifteen muhurtas across the day arc.
  const abhijit = divide(daySunrise, daySunset, 15)[7];

  const dayStart = CHOGHADIYA_CYCLE.findIndex((c) => c.lord === varaLord);
  const nightStart = (dayStart + 5) % 7;

  const buildChoghadiya = (spans: TimeSpan[], startIdx: number): NamedSpan[] =>
    spans.map((s, i) => {
      const c = CHOGHADIYA_CYCLE[(startIdx + i) % 7];
      return { ...s, name: c.name, lord: c.lord, quality: c.quality, index: i + 1, current: contains(s, at) };
    });

  const horaStart = CHALDEAN.indexOf(varaLord);
  const buildHora = (spans: TimeSpan[], offset: number): NamedSpan[] =>
    spans.map((s, i) => {
      const lord = CHALDEAN[(horaStart + offset + i) % 7];
      return {
        ...s,
        name: `${lord} hora`,
        lord,
        quality: HORA_QUALITY[lord],
        index: i + 1,
        current: contains(s, at),
      };
    });

  const choghadiyaDay = buildChoghadiya(dayEighths, dayStart);
  const choghadiyaNight = buildChoghadiya(nightEighths, nightStart);
  // Night horas continue the same descending-Chaldean run: 12 day horas precede them.
  const horaDay = buildHora(divide(daySunrise, daySunset, 12), 0);
  const horaNight = buildHora(divide(daySunset, dayNextSunrise, 12), 12);

  const moon = moonRiseSetFrom(daySunrise, lat, lon);

  return {
    sunrise: daySunrise,
    sunset: daySunset,
    nextSunrise: dayNextSunrise,
    moonrise: moon.rise,
    moonset: moon.set,
    varaIndex,
    varaName: VARA_NAMES[varaIndex],
    varaLord,
    isDay,
    rahuKaal,
    gulikaKaal,
    yamaganda,
    abhijit,
    abhijitApplies: varaIndex !== 3, // not observed on Wednesday
    choghadiyaDay,
    choghadiyaNight,
    horaDay,
    horaNight,
    currentChoghadiya:
      [...choghadiyaDay, ...choghadiyaNight].find((c) => c.current) ?? null,
    currentHora: [...horaDay, ...horaNight].find((h) => h.current) ?? null,
  };
}

/** The night-arc counterparts, for a native born after sunset. */
export function nightKaalas(parts: DayParts): { gulika: TimeSpan; yamaganda: TimeSpan } {
  const nightEighths = divide(parts.sunset, parts.nextSunrise, 8);
  return {
    gulika: nightEighths[nightPartRuledBy(SATURN_WEEK_INDEX, parts.varaIndex) - 1],
    yamaganda: nightEighths[nightPartRuledBy(JUPITER_WEEK_INDEX, parts.varaIndex) - 1],
  };
}

// ---------------------------------------------------------------------------
// Limb start/end times
// ---------------------------------------------------------------------------

/**
 * Bracket the limb value running at `at` and refine both edges to the minute.
 *
 * All four limbs are floor-divisions of a quantity that increases
 * monotonically: the Moon–Sun elongation (tithi, karana), the Moon's sidereal
 * longitude (nakshatra), and their sum (yoga). None can reverse, so a coarse
 * forward/backward walk followed by bisection is exact rather than heuristic.
 * A 20-minute coarse step is well inside the fastest limb — the karana, whose
 * 6° of elongation takes about 12 hours.
 */
function limbSpan(
  valueAt: (t: number) => number,
  spanDeg: number,
  at: Date,
  horizonMs: number
): { index: number; start: Date; end: Date; approximate: boolean } {
  const STEP = 20 * MINUTE;
  const t = at.getTime();
  const indexAt = (ms: number) => Math.floor(valueAt(ms) / spanDeg);
  const here = indexAt(t);

  let endLo = t;
  let endHi = t;
  let found = false;
  while (endHi - t < horizonMs) {
    endHi = Math.min(endLo + STEP, t + horizonMs);
    if (indexAt(endHi) !== here) {
      found = true;
      break;
    }
    endLo = endHi;
  }
  const endApprox = !found;
  const end = found
    ? refineCrossing(true, (ms) => indexAt(ms) === here, endLo, endHi, MINUTE)
    : endHi;

  let startHi = t;
  let startLo = t;
  let foundStart = false;
  while (t - startLo < horizonMs) {
    startLo = Math.max(startHi - STEP, t - horizonMs);
    if (indexAt(startLo) !== here) {
      foundStart = true;
      break;
    }
    startHi = startLo;
  }
  const start = foundStart
    ? refineCrossing(false, (ms) => indexAt(ms) === here, startLo, startHi, MINUTE)
    : startLo;

  return {
    index: here,
    start: new Date(start),
    end: new Date(end),
    approximate: endApprox || !foundStart,
  };
}

/**
 * Start and end instants of the tithi, nakshatra, yoga and karana running at
 * `at`. Ayanamsha-dependent for nakshatra and yoga (both read sidereal
 * longitudes) and ayanamsha-free for tithi and karana (both read an elongation,
 * which is a difference and so cancels the ayanamsha out) — the same split
 * `panchang.ts` documents.
 */
export function computeLimbTimings(
  at: Date,
  ayanamsha: AyanamshaId,
  nodeMode: NodeMode = "mean"
): LimbTimings {
  const sun = (ms: number) => siderealLongitudeAt("Su", ayanamsha, new Date(ms), nodeMode);
  const moon = (ms: number) => siderealLongitudeAt("Mo", ayanamsha, new Date(ms), nodeMode);
  const elong = (ms: number) => norm360(moon(ms) - sun(ms));
  const sum = (ms: number) => norm360(sun(ms) + moon(ms));

  const DAY_MS = 86400000;
  const tithi = limbSpan(elong, 12, at, 2 * DAY_MS);
  const karana = limbSpan(elong, 6, at, DAY_MS);
  const nak = limbSpan(moon, 360 / 27, at, 2 * DAY_MS);
  const yoga = limbSpan(sum, 360 / 27, at, 2 * DAY_MS);

  return {
    tithi: { ...tithi, name: TITHI_NAMES[tithi.index] },
    nakshatra: { ...nak, name: NAKSHATRAS[nak.index] },
    yoga: { ...yoga, name: YOGA_NAMES[yoga.index] },
    karana: { ...karana, name: karanaNameOfHalf(karana.index) },
  };
}

/**
 * Karana name for a half-tithi index 0–59. Same construction as `panchang.ts`:
 * Kimstughna opens the lunar month, seven movable karanas then repeat eight
 * times, and Shakuni/Chatushpada/Naga close it.
 */
export function karanaNameOfHalf(half: number): string {
  const MOVABLE = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"];
  const FIXED = ["Shakuni", "Chatushpada", "Naga", "Kimstughna"];
  if (half === 0) return FIXED[3];
  if (half >= 57) return FIXED[half - 57];
  return MOVABLE[(half - 1) % 7];
}
