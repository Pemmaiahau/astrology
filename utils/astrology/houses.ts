import { inArc, norm360 } from "./math";
import type { BhavaMethod } from "./types";

export interface HouseFrame {
  /** Bhava madhya (house middles), 12 sidereal longitudes. */
  madhya: number[];
  /** Bhava sandhi (house boundaries); bhava i+1 spans sandhi[i-1]..sandhi[i]. */
  sandhi: number[];
  /** Which construction produced this frame. */
  method: BhavaMethod;
}

/**
 * Equal houses: 30° per bhava measured from the Ascendant, madhya on the Asc
 * degree and sandhi 15° either side. The fallback frame for charts whose
 * quadrant geometry cannot support a trisection (see `sripatiHouses`).
 */
export function equalHouses(ascSidereal: number): HouseFrame {
  const asc = norm360(ascSidereal);
  return {
    madhya: Array.from({ length: 12 }, (_, i) => norm360(asc + i * 30)),
    sandhi: Array.from({ length: 12 }, (_, i) => norm360(asc + 15 + i * 30)),
    method: "equal",
  };
}

/**
 * Sripati Bhava Chalit.
 * 1. Porphyry cusps: quadrants between the four angles (Asc, IC, Dsc, MC)
 *    are each trisected.
 * 2. In the Sripati convention those cusps are treated as bhava madhya
 *    (house middles); the house boundaries (sandhi) are the midpoints
 *    between consecutive madhyas.
 *
 * The trisection assumes the four angles fall in zodiacal order
 * Asc → IC → Dsc → MC. Because Dsc = Asc+180 and IC = MC+180, all four
 * quadrant arcs are fixed by the first one: arc(Asc→IC) = arc(Dsc→MC) = q and
 * arc(IC→Dsc) = arc(MC→Asc) = 180 − q. So the single test `0 < q < 180`
 * decides whether a valid quadrant frame exists at all.
 *
 * It fails in two real cases: above the polar circle (measured at 89.9°N,
 * q = 350° — trisecting it gave 117°-wide bhavas and left 8 of the 12
 * unreachable by `bhavaOf`), and in manual mode when a hand-picked Lagna sits
 * far from the Ascendant the supplied MC actually belongs to. Both used to
 * emit a silently wrong frame; both now fall back to `equalHouses` and report
 * `method: "equal"` so the caller can say so.
 */
export function sripatiHouses(ascSidereal: number, mcSidereal: number): HouseFrame {
  const asc = norm360(ascSidereal);
  const mc = norm360(mcSidereal);
  const ic = norm360(mc + 180);
  const dsc = norm360(asc + 180);

  const quadrant = norm360(ic - asc);
  if (!(quadrant > 0 && quadrant < 180)) return equalHouses(asc);

  const madhya = new Array<number>(12);
  madhya[0] = asc; // bhava 1
  madhya[9] = mc; // bhava 10
  madhya[3] = ic; // bhava 4
  madhya[6] = dsc; // bhava 7

  // Quadrant Asc -> IC gives bhavas 2, 3
  const q1 = norm360(ic - asc);
  madhya[1] = norm360(asc + q1 / 3);
  madhya[2] = norm360(asc + (2 * q1) / 3);

  // IC -> Dsc gives bhavas 5, 6
  const q2 = norm360(dsc - ic);
  madhya[4] = norm360(ic + q2 / 3);
  madhya[5] = norm360(ic + (2 * q2) / 3);

  // Dsc -> MC gives bhavas 8, 9
  const q3 = norm360(mc - dsc);
  madhya[7] = norm360(dsc + q3 / 3);
  madhya[8] = norm360(dsc + (2 * q3) / 3);

  // MC -> Asc gives bhavas 11, 12
  const q4 = norm360(asc - mc);
  madhya[10] = norm360(mc + q4 / 3);
  madhya[11] = norm360(mc + (2 * q4) / 3);

  // Sandhi i = midpoint of madhya[i] -> madhya[i+1]; bhava (i+1) spans sandhi[i-1] .. sandhi[i]
  const sandhi = new Array<number>(12);
  for (let i = 0; i < 12; i++) {
    const a = madhya[i];
    const b = madhya[(i + 1) % 12];
    sandhi[i] = norm360(a + norm360(b - a) / 2);
  }
  return { madhya, sandhi, method: "sripati" };
}

/** Bhava number 1–12 for a sidereal longitude given sandhi boundaries. */
export function bhavaOf(longitude: number, sandhi: number[]): number {
  for (let i = 0; i < 12; i++) {
    const start = sandhi[(i + 11) % 12];
    const end = sandhi[i];
    if (inArc(norm360(longitude), start, end)) return i + 1;
  }
  return 1;
}
