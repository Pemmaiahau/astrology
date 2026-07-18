import {
  FIXED_KARANAS,
  MOVABLE_KARANAS,
  NAKSHATRAS,
  TITHI_NAMES,
  VARA_NAMES,
  YOGA_NAMES,
} from "./constants";
import { sunriseFor } from "./ephemeris";
import { nakshatraOf, norm360 } from "./math";
import type { PanchangData } from "./types";

/**
 * The five limbs of time for a given instant.
 * - Tithi and Karana come from the Moon–Sun elongation (ayanamsha-independent).
 * - Nakshatra and Yoga use sidereal longitudes, so they respond to the
 *   ayanamsha toggle as they should.
 * - Vara follows the Vedic convention of the day beginning at sunrise: if the
 *   moment falls before local sunrise, the previous weekday rules.
 */
export function computePanchang(
  sunSidereal: number,
  moonSidereal: number,
  utc: Date,
  timeZone?: string,
  lat?: number,
  lon?: number
): PanchangData {
  const elong = norm360(moonSidereal - sunSidereal);
  const tithiIndex = Math.floor(elong / 12); // 0..29
  const paksha: "Shukla" | "Krishna" = tithiIndex < 15 ? "Shukla" : "Krishna";

  const yogaIndex = Math.floor(norm360(sunSidereal + moonSidereal) / (360 / 27));

  // Karana: 60 half-tithis. Kimstughna is the first half of Shukla Pratipada,
  // then 7 movable karanas repeat 8 times, then Shakuni/Chatushpada/Naga close.
  const half = Math.floor(elong / 6); // 0..59
  let karanaName: string;
  if (half === 0) karanaName = FIXED_KARANAS[3]; // Kimstughna
  else if (half >= 57) karanaName = FIXED_KARANAS[half - 57]; // Shakuni, Chatushpada, Naga
  else karanaName = MOVABLE_KARANAS[(half - 1) % 7];

  // Vara: weekday at the location, shifted back if before sunrise
  let varaIndex: number;
  let sunrise: Date | undefined;
  if (timeZone !== undefined && lat !== undefined && lon !== undefined) {
    const rise = sunriseFor(utc, lat, lon);
    sunrise = rise ?? undefined;
    const ref = rise && rise.getTime() <= utc.getTime() ? rise : utc;
    varaIndex = weekdayInZone(ref, timeZone);
  } else {
    varaIndex = utc.getUTCDay();
  }

  const nakshatraIndex = nakshatraOf(moonSidereal);

  return {
    tithiIndex,
    tithiName: TITHI_NAMES[tithiIndex],
    paksha,
    varaIndex,
    varaName: VARA_NAMES[varaIndex],
    nakshatraIndex,
    nakshatraName: NAKSHATRAS[nakshatraIndex],
    yogaIndex,
    yogaName: YOGA_NAMES[yogaIndex],
    karanaName,
    sunrise,
  };
}

function weekdayInZone(utc: Date, timeZone: string): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(utc);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}
