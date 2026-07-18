import * as Astronomy from "astronomy-engine";
import { norm360 } from "./math";
import { centuriesFromJ2000 } from "./ayanamsha";
import type { PlanetId } from "./types";

/**
 * Tropical geocentric ecliptic-of-date longitudes via astronomy-engine.
 * Astronomy.Ecliptic() returns true-ecliptic-of-date coordinates from a J2000
 * equatorial vector, which is exactly what sidereal astrology needs before
 * subtracting the ayanamsha.
 */

const BODY_MAP: Partial<Record<PlanetId, Astronomy.Body>> = {
  Ma: Astronomy.Body.Mars,
  Me: Astronomy.Body.Mercury,
  Ju: Astronomy.Body.Jupiter,
  Ve: Astronomy.Body.Venus,
  Sa: Astronomy.Body.Saturn,
};

export function tropicalLongitude(id: PlanetId, date: Date): number {
  switch (id) {
    case "Su":
      return norm360(Astronomy.SunPosition(date).elon);
    case "Mo":
      return norm360(Astronomy.EclipticGeoMoon(date).lon);
    case "Ra":
      return meanLunarNode(date);
    case "Ke":
      return norm360(meanLunarNode(date) + 180);
    default: {
      const vec = Astronomy.GeoVector(BODY_MAP[id]!, date, true);
      return norm360(Astronomy.Ecliptic(vec).elon);
    }
  }
}

/** Mean ascending lunar node (tropical), Meeus polynomial. */
export function meanLunarNode(date: Date): number {
  const T = centuriesFromJ2000(date);
  const omega =
    125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441 - (T * T * T * T) / 60616000;
  return norm360(omega);
}

/** Tropical daily motion via central finite difference (deg/day). */
export function dailySpeed(id: PlanetId, date: Date): number {
  const h = 0.5; // days
  const before = tropicalLongitude(id, new Date(date.getTime() - h * 86400000));
  const after = tropicalLongitude(id, new Date(date.getTime() + h * 86400000));
  let d = norm360(after - before);
  if (d > 180) d -= 360;
  return d / (2 * h);
}

export function isRetrograde(id: PlanetId, date: Date): boolean {
  if (id === "Su" || id === "Mo" || id === "Ra" || id === "Ke") return false;
  return dailySpeed(id, date) < 0;
}

/** Mean obliquity of the ecliptic in degrees. */
export function obliquity(date: Date): number {
  const T = centuriesFromJ2000(date);
  return 23.43929111 - 0.0130041667 * T - 1.6388889e-7 * T * T + 5.0361111e-7 * T * T * T;
}

/** Greenwich apparent sidereal time in degrees. */
export function gastDegrees(date: Date): number {
  return norm360(Astronomy.SiderealTime(date) * 15);
}

export interface RiseInfo {
  sunrise: Date | null;
}

export function sunriseFor(date: Date, lat: number, lon: number): Date | null {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    // Search from local midnight-ish: step back 1 day from the instant and find next rise
    const start = new Date(date.getTime() - 86400000);
    let rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, start, 2);
    let last: Date | null = null;
    while (rise && rise.date.getTime() <= date.getTime()) {
      last = rise.date;
      rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, new Date(rise.date.getTime() + 60000), 2);
    }
    return last;
  } catch {
    return null;
  }
}
