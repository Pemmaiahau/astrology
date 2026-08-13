/** Angle helpers shared across the engine. */

export const DEG = Math.PI / 180;

export function norm360(x: number): number {
  const v = x % 360;
  return v < 0 ? v + 360 : v;
}

/** Signed smallest difference a-b in (-180, 180] */
export function angleDiff(a: number, b: number): number {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d;
}

/** Absolute angular separation 0–180 */
export function separation(a: number, b: number): number {
  return Math.abs(angleDiff(a, b));
}

/** Is x within the arc going forward from start to end (circular)? */
export function inArc(x: number, start: number, end: number): boolean {
  const span = norm360(end - start);
  const off = norm360(x - start);
  return off < span;
}

export function signOf(longitude: number): number {
  return Math.floor(norm360(longitude) / 30);
}

export function degInSign(longitude: number): number {
  return norm360(longitude) % 30;
}

export function nakshatraOf(longitude: number): number {
  return Math.floor(norm360(longitude) / (360 / 27));
}

export function padaOf(longitude: number): number {
  return (Math.floor(norm360(longitude) / (360 / 108)) % 4) + 1;
}

/** House 1–12 of a sign counted from the lagna sign */
export function houseFromSign(sign: number, lagnaSign: number): number {
  return ((sign - lagnaSign + 12) % 12) + 1;
}

/**
 * Format 14.372° → 14°22'.
 *
 * Arcminutes are **truncated, not rounded**. Every caller passes a
 * degree-in-sign, and rounding carried 29°59.5'+ up to an impossible `30°00'`
 * inside a sign. Truncation also keeps the printed value consistent with
 * `signOf`/`nakshatraOf`/`padaOf`, which all floor — so the displayed degree
 * can never contradict the sign, nakshatra and pada shown beside it.
 */
export function fmtDeg(deg: number): string {
  const d = Math.floor(deg);
  // Truncating raw binary fractions loses a whole arcminute on values that are
  // mathematically exact (5.05° − 5 is 0.04999…, which floors to 2' not 3'),
  // so absorb representation error first — then clamp, because the epsilon
  // must never be what carries a 59.9999…' value up to an impossible 60'.
  const m = Math.min(59, Math.floor((deg - d) * 60 + 1e-9));
  return `${d}°${String(m).padStart(2, "0")}'`;
}

export function fmtLongitude(lon: number): string {
  return fmtDeg(degInSign(lon));
}
