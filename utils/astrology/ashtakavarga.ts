import type { PlanetId } from "./types";

/**
 * Classical Parashari Bhinna Ashtakavarga benefic-place tables.
 * BENEFIC_PLACES[planet][contributor] = houses (1–12, counted from the
 * contributor's sign) where the planet receives a bindu.
 * Contributors: the seven planets plus "As" (Lagna).
 */
type Contributor = PlanetId | "As";

const T: Record<string, Partial<Record<Contributor, number[]>>> = {
  Su: {
    Su: [1, 2, 4, 7, 8, 9, 10, 11],
    Mo: [3, 6, 10, 11],
    Ma: [1, 2, 4, 7, 8, 9, 10, 11],
    Me: [3, 5, 6, 9, 10, 11, 12],
    Ju: [5, 6, 9, 11],
    Ve: [6, 7, 12],
    Sa: [1, 2, 4, 7, 8, 9, 10, 11],
    As: [3, 4, 6, 10, 11, 12],
  },
  Mo: {
    Su: [3, 6, 7, 8, 10, 11],
    Mo: [1, 3, 6, 7, 10, 11],
    Ma: [2, 3, 5, 6, 9, 10, 11],
    Me: [1, 3, 4, 5, 7, 8, 10, 11],
    Ju: [1, 4, 7, 8, 10, 11, 12],
    Ve: [3, 4, 5, 7, 9, 10, 11],
    Sa: [3, 5, 6, 11],
    As: [3, 6, 10, 11],
  },
  Ma: {
    Su: [3, 5, 6, 10, 11],
    Mo: [3, 6, 11],
    Ma: [1, 2, 4, 7, 8, 10, 11],
    Me: [3, 5, 6, 11],
    Ju: [6, 10, 11, 12],
    Ve: [6, 8, 11, 12],
    Sa: [1, 4, 7, 8, 9, 10, 11],
    As: [1, 3, 6, 10, 11],
  },
  Me: {
    Su: [5, 6, 9, 11, 12],
    Mo: [2, 4, 6, 8, 10, 11],
    Ma: [1, 2, 4, 7, 8, 9, 10, 11],
    Me: [1, 3, 5, 6, 9, 10, 11, 12],
    Ju: [6, 8, 11, 12],
    Ve: [1, 2, 3, 4, 5, 8, 9, 11],
    Sa: [1, 2, 4, 7, 8, 9, 10, 11],
    As: [1, 2, 4, 6, 8, 10, 11],
  },
  Ju: {
    Su: [1, 2, 3, 4, 7, 8, 9, 10, 11],
    Mo: [2, 5, 7, 9, 11],
    Ma: [1, 2, 4, 7, 8, 10, 11],
    Me: [1, 2, 4, 5, 6, 9, 10, 11],
    Ju: [1, 2, 3, 4, 7, 8, 10, 11],
    Ve: [2, 5, 6, 9, 10, 11],
    Sa: [3, 5, 6, 12],
    As: [1, 2, 4, 5, 6, 7, 9, 10, 11],
  },
  Ve: {
    Su: [8, 11, 12],
    Mo: [1, 2, 3, 4, 5, 8, 9, 11, 12],
    Ma: [3, 5, 6, 9, 11, 12],
    Me: [3, 5, 6, 9, 11],
    Ju: [5, 8, 9, 10, 11],
    Ve: [1, 2, 3, 4, 5, 8, 9, 10, 11],
    Sa: [3, 4, 5, 8, 9, 10, 11],
    As: [1, 2, 3, 4, 5, 8, 9, 11],
  },
  Sa: {
    Su: [1, 2, 4, 7, 8, 10, 11],
    Mo: [3, 6, 11],
    Ma: [3, 5, 6, 10, 11, 12],
    Me: [6, 8, 9, 10, 11, 12],
    Ju: [5, 6, 11, 12],
    Ve: [6, 11, 12],
    Sa: [3, 5, 6, 11],
    As: [1, 3, 4, 6, 10, 11],
  },
  As: {
    Su: [3, 4, 6, 10, 11, 12],
    Mo: [3, 6, 10, 11, 12],
    Ma: [1, 3, 6, 10, 11],
    Me: [1, 2, 4, 6, 8, 10, 11],
    Ju: [1, 2, 4, 5, 6, 7, 9, 10, 11],
    Ve: [1, 2, 3, 4, 5, 8, 9],
    Sa: [1, 3, 4, 6, 10, 11],
    As: [3, 6, 10, 11],
  },
};

export const AV_PLANETS: PlanetId[] = ["Su", "Mo", "Ma", "Me", "Ju", "Ve", "Sa"];

export interface AshtakavargaResult {
  /** bav[planetOrLagna][sign 0-11] = bindus */
  bav: Record<string, number[]>;
  /** Sarvashtakavarga per sign (sum of the seven planets' BAV; total 337) */
  sav: number[];
}

/**
 * @param signs sign index (0–11) of each of the 7 planets, plus lagna sign.
 */
export function computeAshtakavarga(planetSigns: Partial<Record<PlanetId, number>>, lagnaSign: number): AshtakavargaResult {
  const contributorSign = (c: Contributor): number =>
    c === "As" ? lagnaSign : (planetSigns[c] as number);

  const bav: Record<string, number[]> = {};
  const charts: Contributor[] = [...AV_PLANETS, "As"];
  for (const chart of charts) {
    const grid = new Array(12).fill(0);
    const table = T[chart];
    for (const contrib of Object.keys(table) as Contributor[]) {
      const from = contributorSign(contrib);
      for (const h of table[contrib]!) {
        grid[(from + h - 1) % 12] += 1;
      }
    }
    bav[chart] = grid;
  }

  const sav = new Array(12).fill(0);
  for (const p of AV_PLANETS) {
    for (let s = 0; s < 12; s++) sav[s] += bav[p][s];
  }
  return { bav, sav };
}
