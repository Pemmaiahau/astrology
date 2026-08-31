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
 * SE_SIDM_RAMAN.) Raman inherits the same sub-arcminute bias as `lahiriAyanamsha`,
 * which is the documented precision budget of this layer — see SOURCES.md.
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
