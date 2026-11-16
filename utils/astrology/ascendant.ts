import { DEG, norm360 } from "./math";
import { gastDegrees, trueObliquity } from "./ephemeris";

/**
 * Tropical ascendant and midheaven from UTC instant + geographic coordinates.
 * RAMC = GAST + east longitude, with the true obliquity (GAST is apparent
 * sidereal time, so the equinox it refers to is the true one). Standard
 * spherical formulae.
 */
export function tropicalAscMc(date: Date, lat: number, lonEast: number): { asc: number; mc: number } {
  const ramc = norm360(gastDegrees(date) + lonEast);
  const eps = trueObliquity(date);
  const th = ramc * DEG;
  const e = eps * DEG;
  const phi = lat * DEG;

  const asc = norm360(
    Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) / DEG
  );
  const mc = norm360(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(e)) / DEG);
  return { asc, mc };
}
