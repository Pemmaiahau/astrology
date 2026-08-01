import * as Astronomy from "astronomy-engine";
import { norm360 } from "./math";
import { centuriesFromJ2000 } from "./ayanamsha";
import type { NodeMode, PlanetId } from "./types";

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

export function tropicalLongitude(id: PlanetId, date: Date, nodeMode: NodeMode = "mean"): number {
  switch (id) {
    case "Su":
      return norm360(Astronomy.SunPosition(date).elon);
    case "Mo":
      return norm360(Astronomy.EclipticGeoMoon(date).lon);
    case "Ra":
      return nodeMode === "true" ? trueLunarNode(date) : meanLunarNode(date);
    case "Ke":
      return norm360((nodeMode === "true" ? trueLunarNode(date) : meanLunarNode(date)) + 180);
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

/**
 * True (osculating) ascending lunar node, tropical of-date. The node is where
 * the Moon's instantaneous orbital plane cuts the ecliptic: with geocentric
 * position r and velocity v (J2000 ecliptic frame via GeoMoonState → rotated),
 * the orbit normal is h = r × v and the ascending node direction is ẑ × h.
 * The result is converted to the ecliptic of date by adding the same
 * precession the of-date frame applies to the mean node's reference.
 */
export function trueLunarNode(date: Date): number {
  // GeoMoonState returns equatorial J2000 (EQJ) position/velocity in AU, AU/day.
  const state = Astronomy.GeoMoonState(date);
  // Rotate position and velocity into the ecliptic-of-date frame (ECT).
  const rot = Astronomy.Rotation_EQJ_ECT(new Astronomy.AstroTime(date));
  const r = Astronomy.RotateVector(rot, new Astronomy.Vector(state.x, state.y, state.z, state.t));
  const v = Astronomy.RotateVector(rot, new Astronomy.Vector(state.vx, state.vy, state.vz, state.t));
  // Orbit normal h = r × v (ecliptic frame; z ≈ orbit pole).
  const hx = r.y * v.z - r.z * v.y;
  const hy = r.z * v.x - r.x * v.z;
  const hz = r.x * v.y - r.y * v.x;
  // Ascending node direction n = ẑ × h = (−hy, hx, 0).
  const node = Math.atan2(hx, -hy) * (180 / Math.PI);
  return norm360(node);
}

/** Tropical daily motion via central finite difference (deg/day). */
export function dailySpeed(id: PlanetId, date: Date, nodeMode: NodeMode = "mean"): number {
  const h = 0.5; // days
  const before = tropicalLongitude(id, new Date(date.getTime() - h * 86400000), nodeMode);
  const after = tropicalLongitude(id, new Date(date.getTime() + h * 86400000), nodeMode);
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

/** Most recent sunset at or before the given instant (mirror of sunriseFor). */
export function sunsetFor(date: Date, lat: number, lon: number): Date | null {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const start = new Date(date.getTime() - 86400000);
    let set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, start, 2);
    let last: Date | null = null;
    while (set && set.date.getTime() <= date.getTime()) {
      last = set.date;
      set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, new Date(set.date.getTime() + 60000), 2);
    }
    return last;
  } catch {
    return null;
  }
}

/** Next sunrise strictly after the given instant (Kala bala needs the enclosing night arc). */
export function nextSunrise(date: Date, lat: number, lon: number): Date | null {
  try {
    const observer = new Astronomy.Observer(lat, lon, 0);
    const rise = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun, observer, +1, new Date(date.getTime() + 1000), 2
    );
    return rise ? rise.date : null;
  } catch {
    return null;
  }
}

/**
 * Geocentric declination (kranti) in degrees, for Ayana bala. Derived from
 * the true-ecliptic-of-date longitude/latitude and the mean obliquity:
 *   sin δ = sin β · cos ε + cos β · sin ε · sin λ
 * For Rahu/Ketu (β = 0 by definition of the node) this reduces to
 * sin δ = sin ε · sin λ.
 */
export function declination(id: PlanetId, date: Date): number {
  let lonDeg: number;
  let latDeg = 0;
  switch (id) {
    case "Su":
      lonDeg = Astronomy.SunPosition(date).elon;
      latDeg = Astronomy.SunPosition(date).elat;
      break;
    case "Mo": {
      const mo = Astronomy.EclipticGeoMoon(date);
      lonDeg = mo.lon;
      latDeg = mo.lat;
      break;
    }
    case "Ra":
    case "Ke":
      lonDeg = tropicalLongitude(id, date);
      latDeg = 0;
      break;
    default: {
      const ecl = Astronomy.Ecliptic(Astronomy.GeoVector(BODY_MAP[id]!, date, true));
      lonDeg = ecl.elon;
      latDeg = ecl.elat;
    }
  }
  const rad = Math.PI / 180;
  const eps = obliquity(date) * rad;
  const lam = lonDeg * rad;
  const bet = latDeg * rad;
  const sinDec = Math.sin(bet) * Math.cos(eps) + Math.cos(bet) * Math.sin(eps) * Math.sin(lam);
  return Math.asin(sinDec) / rad;
}
