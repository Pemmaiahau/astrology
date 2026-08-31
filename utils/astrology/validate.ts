import { tzOffsetMinutes } from "./time";
import type { ManualInputState, PlanetId } from "./types";

/**
 * Input validation shared by both entry paths and the rectify API.
 *
 * Everything here returns *warnings*, never hard blocks, with one exception
 * (`DATE_MIN`/`DATE_MAX` are enforced on the date input itself because a
 * year-0001 chart is not a judgement call). The reason is that hand-copied
 * charts from an almanac genuinely do disagree with the ephemeris by a degree
 * or two, and refusing to compute them would break a legitimate workflow. The
 * user is told what looks wrong and left to decide.
 */

export type Severity = "warn" | "error";

export interface ValidationIssue {
  severity: Severity;
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Date bounds
// ---------------------------------------------------------------------------

/**
 * The window in which this engine's ayanamsha polynomial is trustworthy.
 *
 * `ayanamsha.ts` documents accuracy "well under an arcminute across ±150 years
 * of J2000"; `PredictionPanel` already clamps its forecast year to exactly
 * 1850–2150. The birth date — which everything else derives from — was the one
 * input with no bound at all, so a year-0001 chart computed and rendered with
 * full confidence. These are the same numbers, now applied at the source.
 */
export const DATE_MIN = "1850-01-01";
export const DATE_MAX = "2150-12-31";
const YEAR_MIN = 1850;
const YEAR_MAX = 2150;

/** Softer band inside the hard bounds, where precision is degrading but usable. */
const SOFT_MIN = 1900;
const SOFT_MAX = 2100;

export function checkBirthDate(dateISO: string): ValidationIssue[] {
  const year = Number(dateISO.slice(0, 4));
  if (!Number.isFinite(year)) {
    return [{ severity: "error", field: "date", message: "Birth date is not a valid date." }];
  }
  if (year < YEAR_MIN || year > YEAR_MAX) {
    return [
      {
        severity: "error",
        field: "date",
        message:
          `${year} is outside the range this engine can compute honestly (${YEAR_MIN}–${YEAR_MAX}). ` +
          `The ayanamsha is a polynomial fitted around J2000 and its error grows without bound outside that window, ` +
          `so a chart for this date would look precise and be wrong.`,
      },
    ];
  }
  if (year < SOFT_MIN || year > SOFT_MAX) {
    return [
      {
        severity: "warn",
        field: "date",
        message:
          `${year} is inside the computable range but outside the ±100-year band where the ayanamsha is ` +
          `sub-arcminute accurate. Sign and nakshatra placements near a boundary should be treated as provisional.`,
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Timezone / DST
// ---------------------------------------------------------------------------

/**
 * Detect a civil time that does not exist (the spring-forward gap) or one that
 * occurs twice (the autumn fall-back).
 *
 * `localToUtc` iterates to a fixed point and silently lands on a nearby instant
 * for a non-existent time, which is a defensible behaviour but a silent one.
 * `tzOffsetMinutes` already exists to judge exactly this and is used by
 * rectification's `timezoneWarnings` — it was simply never called on the main
 * input path.
 */
export function checkLocalTime(
  timeZone: string,
  dateISO: string,
  time: string,
  utc: Date
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  try {
    const before = tzOffsetMinutes(timeZone, new Date(utc.getTime() - 6 * 3600000));
    const after = tzOffsetMinutes(timeZone, new Date(utc.getTime() + 6 * 3600000));
    if (before !== after) {
      out.push({
        severity: "warn",
        field: "time",
        message:
          `A clock change falls within six hours of this birth time in ${timeZone} ` +
          `(offset moves from ${fmtOffset(before)} to ${fmtOffset(after)}). If the recorded time came from a ` +
          `clock that had not been adjusted, the chart may be an hour out — which moves the Lagna by roughly ` +
          `15 degrees. Worth confirming against a second source.`,
      });
    }
    // A non-existent civil time round-trips to a different wall-clock reading.
    const roundTrip = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(utc);
    const [hh, mm] = time.split(":");
    const wanted = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}`;
    if (roundTrip !== wanted) {
      out.push({
        severity: "warn",
        field: "time",
        message:
          `${wanted} does not exist on ${dateISO} in ${timeZone} — it falls inside a daylight-saving gap, ` +
          `and the nearest real instant (${roundTrip} local) was used instead. Check the recorded time.`,
      });
    }
  } catch {
    /* An unknown zone is caught by the geocoder; nothing to add here. */
  }
  return out;
}

function fmtOffset(mins: number): string {
  const sign = mins >= 0 ? "+" : "-";
  const a = Math.abs(mins);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

export function checkCoordinates(lat: number, lon: number): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    out.push({ severity: "error", field: "lat", message: "Latitude must be between −90 and 90." });
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    out.push({ severity: "error", field: "lon", message: "Longitude must be between −180 and 180." });
  }
  // Only meaningful for a latitude that is actually on the globe; an
  // out-of-range value has already been reported as an error above.
  if (Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lat) > 66.5) {
    out.push({
      severity: "warn",
      field: "lat",
      message:
        `Above the polar circle (${lat.toFixed(2)}°) the Sun does not rise and set every day, so the ` +
        `sunrise-anchored constructions degrade: Panchang day-parts may be unavailable, Shadbala's Kala limb ` +
        `cannot be built, and the Sripati quadrants can become un-trisectable and fall back to equal houses. ` +
        `The chart is still computed; the affected panels say so where it applies.`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Manual chart plausibility
// ---------------------------------------------------------------------------

/** Maximum geocentric elongation from the Sun, in degrees. */
const MAX_ELONGATION: Partial<Record<PlanetId, number>> = {
  Me: 28,
  Ve: 48,
};

/**
 * Astronomical plausibility of a hand-entered chart.
 *
 * Manual mode lets every graha be placed in any house at any degree with no
 * cross-planet constraint, so it will happily compute, score and confidently
 * interpret charts that cannot physically exist. The worst of these is a broken
 * nodal axis: nothing derives Ketu from Rahu, so a mis-entered node produces a
 * chart where `detectYogas` evaluates Kala Sarpa against a nonsense arc.
 *
 * Returned as warnings, not blocks — see the module header.
 */
export function validateManualChart(input: ManualInputState): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const lagna = input.lagnaSign;
  const lonOf = (id: PlanetId): number | null => {
    const p = input.planets.find((q) => q.id === id);
    if (!p) return null;
    return (((lagna + p.house - 1) % 12) * 30 + p.deg) % 360;
  };

  const sun = lonOf("Su");

  /** Angular separation of two longitudes, folded to 0-180. */
  const separation = (a: number, b: number): number => Math.abs((((a - b) % 360) + 540) % 360 - 180);

  // Inner-planet elongation.
  if (sun !== null) {
    for (const [id, max] of Object.entries(MAX_ELONGATION) as [PlanetId, number][]) {
      const lon = lonOf(id);
      if (lon === null) continue;
      const d = separation(lon, sun);
      if (d > max) {
        out.push({
          severity: "warn",
          field: id,
          message:
            `${id} is ${d.toFixed(1)}° from the Sun, but its maximum possible elongation is about ${max}°. ` +
            `This placement cannot occur — check the house or the degree.`,
        });
      }
    }
  }

  // Nodal axis.
  const ra = lonOf("Ra");
  const ke = lonOf("Ke");
  if (ra !== null && ke !== null) {
    const actual = separation(ke, ra);
    if (Math.abs(actual - 180) > 1) {
      out.push({
        severity: "warn",
        field: "Ke",
        message:
          `Rahu and Ketu are ${actual.toFixed(1)}° apart. They are always exactly opposite — two ends of one ` +
          `axis — so one of the two is mis-entered. Kala Sarpa detection and every nodal reading will be wrong ` +
          `until this is fixed. Use “derive Ketu from Rahu” to correct it automatically.`,
      });
    }
  }

  // Duplicate placements of the same graha.
  const seen = new Set<PlanetId>();
  for (const p of input.planets) {
    if (seen.has(p.id)) {
      out.push({ severity: "error", field: p.id, message: `${p.id} is entered more than once.` });
    }
    seen.add(p.id);
  }

  // Degrees outside a sign.
  for (const p of input.planets) {
    if (p.deg < 0 || p.deg >= 30) {
      out.push({
        severity: "error",
        field: p.id,
        message: `${p.id} has a degree of ${p.deg}, which is outside the 0–30 range of a sign.`,
      });
    }
  }
  if (input.ascDeg < 0 || input.ascDeg >= 30) {
    out.push({
      severity: "error",
      field: "asc",
      message: `The Lagna degree ${input.ascDeg} is outside the 0–30 range of a sign.`,
    });
  }

  return out;
}

/** Ketu's house and degree, derived from Rahu — the axis is always exact. */
export function ketuFromRahu(
  rahuHouse: number,
  rahuDeg: number
): { house: number; deg: number } {
  return { house: ((rahuHouse + 5) % 12) + 1, deg: rahuDeg };
}
