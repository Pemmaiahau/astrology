import type { AyanamshaId } from "./types";

/** Julian centuries from J2000.0 for a JS Date (UTC). */
export function centuriesFromJ2000(date: Date): number {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - J2000) / (86400000 * 36525);
}

/**
 * Nutation in longitude (Δψ) and in obliquity (Δε), in degrees — the four
 * leading terms of the IAU 1980 series (Meeus, "Astronomical Algorithms" ch.
 * 22), good to about 0.5", which is inside the ephemeris layer's own budget.
 *
 * It lives here rather than in `ephemeris.ts` because the ayanamsha needs it
 * and `ephemeris.ts` already imports this module.
 */
export function nutation(date: Date): { longitude: number; obliquity: number } {
  const T = centuriesFromJ2000(date);
  const rad = Math.PI / 180;
  const omega = (125.04452 - 1934.136261 * T) * rad; // Moon's mean ascending node
  const sun2 = 2 * (280.4665 + 36000.7698 * T) * rad; // twice the Sun's mean longitude
  const moon2 = 2 * (218.3165 + 481267.8813 * T) * rad; // twice the Moon's mean longitude
  const dpsi = -17.2 * Math.sin(omega) - 1.32 * Math.sin(sun2) - 0.23 * Math.sin(moon2) + 0.21 * Math.sin(2 * omega);
  const deps = 9.2 * Math.cos(omega) + 0.57 * Math.cos(sun2) + 0.1 * Math.cos(moon2) - 0.09 * Math.cos(2 * omega);
  return { longitude: dpsi / 3600, obliquity: deps / 3600 };
}

/**
 * Mean Lahiri (Chitra Paksha) ayanamsha — the precession of the mean equinox
 * since the Lahiri zero point, with no nutation in it. Fitted to the Swiss
 * Ephemeris SE_SIDM_LAHIRI value (23°51'25.53" at J2000.0); agrees with it to
 * 0.1" across 1850–2150.
 */
export function meanLahiriAyanamsha(date: Date): number {
  const T = centuriesFromJ2000(date);
  return 23.857092 + 1.396888 * T + 0.0003086 * T * T;
}

/**
 * Lahiri (Chitra Paksha) ayanamsha as it has to be subtracted from this
 * engine's tropical longitudes: the mean ayanamsha PLUS the nutation in
 * longitude — the "true ayanamsha" Indian ephemerides print (23°51'11" at
 * J2000.0).
 *
 * The nutation term is not optional. Every tropical longitude the ephemeris
 * layer produces is measured from the TRUE equinox of date, which wobbles
 * ±17" around the mean equinox over the 18.6-year nodal cycle. Subtracting a
 * nutation-free ayanamsha from a nutated longitude leaves that wobble in the
 * sidereal result; an earlier version did exactly that (it froze the J2000
 * nutation into the constant) and was off by up to ~38" depending on the birth
 * year. With the term in, sidereal positions agree with the Swiss Ephemeris to
 * a few arcseconds.
 */
export function lahiriAyanamsha(date: Date): number {
  return meanLahiriAyanamsha(date) + nutation(date).longitude;
}

/**
 * Pushya-paksha ayanamsha (PVR Narasimha Rao): the zodiac is anchored so that
 * Delta Cancri (Pushya) sits at 106°00'. Its offset from Lahiri is constant
 * since both track the same precession of the equinoxes.
 */
const PUSHYA_OFFSET_FROM_LAHIRI = -1.122;

export function pushyaAyanamsha(date: Date): number {
  return lahiriAyanamsha(date) + PUSHYA_OFFSET_FROM_LAHIRI;
}

/**
 * Raman ayanamsha (B. V. Raman).
 *
 * Raman anchors the zodiac ~1°26' behind Lahiri. Both are defined by an epoch
 * value at the same instant (1900 Jan 0.5 ET, JD 2415020.0) carried forward by
 * the same general precession, so — exactly as with Pushya above — the offset
 * between them is a constant and Raman needs no separate polynomial:
 *
 *   Lahiri @ 1900 = 22.460148° (22°27'37.7")
 *   Raman  @ 1900 = 21.013444° (21°00'48.4")
 *   difference    =  1.446704°
 *
 * (Epoch constants per the Swiss Ephemeris ayanamsha table, SE_SIDM_LAHIRI and
 * SE_SIDM_RAMAN.) Raman inherits the nutation term and the precision of
 * `lahiriAyanamsha`.
 *
 * Raman's practical effect: every sidereal longitude moves ~1°26' forward
 * relative to Lahiri, which is enough to change a Lagna, a Moon nakshatra (and
 * therefore the Vimshottari starting lord), or a varga sign for any body within
 * that distance of a boundary. It is a genuinely different chart, not a nudge.
 */
const RAMAN_OFFSET_FROM_LAHIRI = -1.446704;

export function ramanAyanamsha(date: Date): number {
  return lahiriAyanamsha(date) + RAMAN_OFFSET_FROM_LAHIRI;
}

export function getAyanamsha(id: AyanamshaId, date: Date): number {
  switch (id) {
    case "pushya":
      return pushyaAyanamsha(date);
    case "raman":
      return ramanAyanamsha(date);
    default:
      return lahiriAyanamsha(date);
  }
}

export const AYANAMSHA_LABELS: Record<AyanamshaId, string> = {
  lahiri: "Lahiri (Chitra Paksha)",
  pushya: "Pushya Paksha",
  raman: "Raman",
};

/** Short label for tight UI (the header toggle). */
export const AYANAMSHA_SHORT: Record<AyanamshaId, string> = {
  lahiri: "Lahiri",
  pushya: "Pushya",
  raman: "Raman",
};

/** Every ayanamsha the chart engine can be switched to, in display order. */
export const AYANAMSHA_IDS: AyanamshaId[] = ["lahiri", "pushya", "raman"];
