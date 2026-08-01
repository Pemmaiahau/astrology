import { CHALDEAN_MAP, PYTHAGOREAN_MAP } from "./constants";
import type { Gender } from "./types";

/**
 * Numerology calculations (Cheiro/Chaldean tradition + the Kua/Feng-Shui
 * direction number). Pure arithmetic over the birth date and optional name —
 * kept in utils because it is math, not prose.
 *
 * Conventions implemented (variants noted in SOURCES.md):
 * - Moolank (psychic number): digit root of the day of birth.
 * - Bhagyank (destiny number): digit root of the full date DD+MM+YYYY.
 * - Namank (name number): Chaldean by default (no letter maps to 9 — the
 *   Chaldean scheme reserves it), Pythagorean (A=1…I=9 cycling) as a toggle.
 * - Kua number: male = digit root of (11 − yearRoot); female = digit root of
 *   (yearRoot + 4); a resulting 5 becomes 2 for males and 8 for females.
 *   Year = the birth year as given (the solar-year boundary refinement for
 *   January birthdays is noted as a caveat, not applied — it needs the
 *   Chinese solar calendar).
 */

export type NamankSystem = "chaldean" | "pythagorean";

export interface NumerologyResult {
  moolank: number;
  bhagyank: number;
  namank: number | null;
  namankSystem: NamankSystem;
  kua: number | null;
  caveats: string[];
}

/** Iterated digit sum → 1–9. */
export function digitRoot(n: number): number {
  let x = Math.abs(Math.round(n));
  while (x > 9) {
    x = String(x)
      .split("")
      .reduce((s, d) => s + Number(d), 0);
  }
  return x;
}

/** Name number under the chosen letter map (non-letters ignored). */
export function nameNumber(name: string, system: NamankSystem = "chaldean"): number | null {
  const map = system === "chaldean" ? CHALDEAN_MAP : PYTHAGOREAN_MAP;
  let sum = 0;
  let counted = 0;
  for (const ch of name.toUpperCase()) {
    const v = map[ch];
    if (v !== undefined) {
      sum += v;
      counted++;
    }
  }
  return counted === 0 ? null : digitRoot(sum);
}

export function computeNumerology(
  dateISO: string | undefined,
  name?: string,
  gender?: Gender,
  system: NamankSystem = "chaldean"
): NumerologyResult | null {
  if (!dateISO) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const caveats: string[] = [];

  const moolank = digitRoot(day);
  const bhagyank = digitRoot(day + month + digitRoot(year));

  const namank = name ? nameNumber(name, system) : null;
  if (!name) caveats.push("Add a name to include the name number (Namank).");

  let kua: number | null = null;
  if (gender === "male" || gender === "female") {
    const yearRoot = digitRoot(year);
    kua = gender === "male" ? digitRoot(11 - yearRoot) : digitRoot(yearRoot + 4);
    if (kua === 5) kua = gender === "male" ? 2 : 8;
    if (month === 1) {
      caveats.push(
        "January births near the solar-year boundary (Feb 4) may belong to the previous Kua year — the refinement is not applied here."
      );
    }
  } else {
    caveats.push("Kua (direction) number needs a specified gender; both readings are given elsewhere when it is absent.");
  }

  return { moolank, bhagyank, namank, namankSystem: system, kua, caveats };
}
