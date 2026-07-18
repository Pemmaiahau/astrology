import type { AyanamshaId } from "./types";

/** Julian centuries from J2000.0 for a JS Date (UTC). */
export function centuriesFromJ2000(date: Date): number {
  const J2000 = Date.UTC(2000, 0, 1, 12, 0, 0);
  return (date.getTime() - J2000) / (86400000 * 36525);
}

/**
 * Lahiri (Chitra Paksha) ayanamsha.
 * Anchored at 23°51'11" (23.85306°) on J2000.0 with the general precession
 * rate; accurate to well under an arcminute across ±150 years of J2000,
 * which matches the precision budget of the ephemeris layer.
 */
export function lahiriAyanamsha(date: Date): number {
  const T = centuriesFromJ2000(date);
  return 23.85306 + 1.3969713 * T + 0.0003086 * T * T;
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

export function getAyanamsha(id: AyanamshaId, date: Date): number {
  return id === "pushya" ? pushyaAyanamsha(date) : lahiriAyanamsha(date);
}

export const AYANAMSHA_LABELS: Record<AyanamshaId, string> = {
  lahiri: "Lahiri (Chitra Paksha)",
  pushya: "Pushya Paksha",
};
