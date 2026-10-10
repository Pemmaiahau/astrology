import { aspectedSigns } from "@/utils/astrology/aspects";
import { PLANET_NAMES, SIGN_LORDS, signMobility } from "@/utils/astrology/constants";
import type { ChartData, PlanetId } from "@/utils/astrology/types";

export interface FunctionalRoles {
  yogakaraka: PlanetId | null;
  benefics: PlanetId[];
  malefics: PlanetId[];
  neutrals: PlanetId[];
  note: string;
}

/**
 * Functional classification per Lagna, following the Parashari scheme as
 * published in the standard literature (kendra/trikona lordships weighed
 * against trishadaya and dusthana lordships). Marakas are derived
 * programmatically from 2nd/7th lordship.
 */
export const FUNCTIONAL_ROLES: FunctionalRoles[] = [
  {
    // Aries
    yogakaraka: null,
    benefics: ["Ju", "Su", "Ma"],
    malefics: ["Sa", "Me", "Ve"],
    neutrals: ["Mo"],
    note: "For Aries rising, Jupiter is the most helpful planet, because it rules your 9th house of fortune; the Sun, ruling your 5th house of intelligence and children, supports it. Mars is on your side as the ruler of your rising sign, even though it also rules the difficult 8th. Saturn (your 10th and 11th houses), Mercury (3rd and 6th) and Venus (2nd and 7th — one of the two 'health-watch' houses) each need to be well placed before their periods deliver cleanly.",
  },
  {
    // Taurus
    yogakaraka: "Sa",
    benefics: ["Sa", "Me", "Su"],
    malefics: ["Mo", "Ju", "Ma"],
    neutrals: ["Ve"],
    note: "For Taurus rising, Saturn is the textbook yogakaraka — it rules both your 9th house of fortune and your 10th house of career, so its strong periods build career and fortune together. Jupiter (your 8th and 11th) and the Moon (your 3rd) work against the grain for this rising sign. Mars, as ruler of your 7th, is one of the two planets the tradition watches for health in its periods.",
  },
  {
    // Gemini
    yogakaraka: null,
    benefics: ["Ve", "Sa", "Me"],
    malefics: ["Ma", "Ju", "Su"],
    neutrals: ["Mo"],
    note: "For Gemini rising, Venus is the finest planet — it rules your 5th house of intelligence and children and your 12th; Saturn, ruling your 9th house of fortune, supports your luck. Mars (your 6th and 11th) is the sharpest planet working against you. Jupiter rules your 7th and 10th, two corner houses, which by a classical rule ('kendradhipati dosha') dilutes a gentle planet's goodness — and it also carries the 7th-house health-watch duty.",
  },
  {
    // Cancer
    yogakaraka: "Ma",
    benefics: ["Ma", "Ju", "Mo"],
    // Saturn owns the 7th and the 8th. Its 7th (kendra) lordship does not
    // soften the 8th, and BPHS names it maraka for this Lagna, so it is
    // classed malefic, not neutral (decision logged in SOURCES.md).
    malefics: ["Ve", "Me", "Sa"],
    neutrals: ["Su"],
    note: "For Cancer rising, Mars is the yogakaraka — it rules your 5th house of intelligence and your 10th house of career, so it converts intelligence into achievement. Jupiter, ruling your 9th house of fortune, blesses. Venus (your 4th and 11th) and Mercury (your 3rd and 12th) run counter to your interests. Saturn rules your 7th and your 8th, so it works against you too: its periods bring delay and strain, and it is one of the two planets to watch for health.",
  },
  {
    // Leo
    yogakaraka: "Ma",
    benefics: ["Ma", "Su", "Ju"],
    malefics: ["Me", "Ve", "Sa"],
    neutrals: ["Mo"],
    note: "For Leo rising, Mars is the yogakaraka — it rules your 4th house of home and property and your 9th house of fortune, pairing the two. Jupiter, ruling your 5th, is a clean helper. Saturn rules your 6th and 7th, so it is both an obstacle-setter and one of the two planets watched for health. Venus and Mercury need to be strong before they behave well for you.",
  },
  {
    // Virgo
    yogakaraka: null,
    benefics: ["Ve", "Me"],
    malefics: ["Ma", "Ju", "Mo"],
    neutrals: ["Su", "Sa"],
    note: "For Virgo rising, Venus rules your 2nd house of wealth and your 9th house of fortune, which makes it your wealth-and-fortune engine (with the 2nd-house health-watch duty riding along). Mercury is on your side as ruler of your rising sign. Mars (your 3rd and 8th) is the harshest planet for you; Jupiter rules your 4th and 7th, two corner houses, which by a classical rule dilutes its natural grace.",
  },
  {
    // Libra
    yogakaraka: "Sa",
    benefics: ["Sa", "Me", "Ve"],
    malefics: ["Ju", "Su", "Ma"],
    neutrals: ["Mo"],
    note: "For Libra rising, Saturn is the yogakaraka — it rules your 4th house of home and your 5th house of intelligence, giving a patient, structural rise. Mercury, ruling your 9th house of fortune, carries your luck. Jupiter (your 3rd and 6th) is the chief planet working against you; Mars rules your 2nd and 7th, the two houses the tradition watches for health.",
  },
  {
    // Scorpio
    yogakaraka: null,
    benefics: ["Ju", "Mo", "Su", "Ma"],
    malefics: ["Me", "Ve"],
    neutrals: ["Sa"],
    note: "For Scorpio rising, the Moon (ruler of your 9th house of fortune) and Jupiter (ruler of your 2nd house of wealth and 5th of intelligence) are your main helpers; the Sun, ruling your 10th house of career, adds authority. Venus (your 7th and 12th) and Mercury (your 8th and 11th) are the planets working against you, and both carry the health-watch duty of the 2nd/7th.",
  },
  {
    // Sagittarius
    yogakaraka: null,
    benefics: ["Ma", "Su", "Ju"],
    malefics: ["Ve", "Sa"],
    neutrals: ["Mo", "Me"],
    note: "For Sagittarius rising, Mars (ruler of your 5th and 12th) and the Sun (ruler of your 9th house of fortune) drive your sense of purpose and initiative; Jupiter is on your side as ruler of your rising sign. Venus (your 6th and 11th) and Saturn (your 2nd and 3rd — with the 2nd-house health-watch duty) are the planets to check carefully before trusting their periods.",
  },
  {
    // Capricorn
    yogakaraka: "Ve",
    benefics: ["Ve", "Me", "Sa"],
    malefics: ["Ma", "Ju", "Mo"],
    neutrals: ["Su"],
    note: "For Capricorn rising, Venus is the yogakaraka — it rules your 5th house of intelligence and creativity and your 10th house of career, so creativity gets crowned with career. Mercury, ruling your 9th house of fortune, blesses. Mars (your 4th and 11th) is the sharpest planet working against you; Jupiter (your 3rd and 12th) tends to leak resources, and the Moon, as ruler of your 7th, carries the health-watch duty.",
  },
  {
    // Aquarius
    yogakaraka: "Ve",
    benefics: ["Ve", "Sa"],
    malefics: ["Ju", "Mo", "Ma"],
    neutrals: ["Su", "Me"],
    note: "For Aquarius rising, Venus is the yogakaraka — it rules your 4th house of home and your 9th house of fortune. Saturn is on your side as ruler of your rising sign (and of your 12th). Jupiter rules your 2nd and 11th, so it accumulates wealth but also carries the 2nd-house health-watch duty; the Moon (your 6th) and Mars (your 3rd and 10th) need to be well placed before their periods reward you.",
  },
  {
    // Pisces
    yogakaraka: null,
    benefics: ["Mo", "Ma", "Ju"],
    malefics: ["Ve", "Sa", "Su", "Me"],
    neutrals: [],
    note: "For Pisces rising, the Moon (ruler of your 5th house of intelligence) and Mars (ruler of your 2nd house of wealth and 9th of fortune) are your wealth-and-fortune pair; Jupiter guards you as ruler of your rising sign. Venus (your 3rd and 8th), Saturn (your 11th and 12th) and Mercury (your 4th and 7th — two corner houses, plus the 7th-house health-watch duty) all carry friction for this rising sign.",
  },
];

/** Marakas = lords of the 2nd and 7th houses, computed for any lagna. */
export function marakasFor(lagnaSign: number): PlanetId[] {
  const second = SIGN_LORDS[(lagnaSign + 1) % 12];
  const seventh = SIGN_LORDS[(lagnaSign + 6) % 12];
  return second === seventh ? [second] : [second, seventh];
}

export interface MarakaSet {
  /** Lords of the 2nd and 7th — the primary marakas. */
  primary: PlanetId[];
  /** Secondary marakas with the rule that made each one. */
  secondary: { id: PlanetId; reasons: string[] }[];
}

/**
 * The full maraka picture for a chart (BPHS Maraka adhyaya): the 2nd and 7th
 * lords first; then, as secondary marakas, planets occupying the 2nd or 7th,
 * planets conjoined with a primary maraka, the 12th lord, and Saturn when it
 * is connected to the maraka houses or lords (in the 2nd/7th, with a maraka
 * lord, or aspecting the 2nd/7th).
 *
 * Reporting only: health-caution timing (`cautions.ts`) deliberately keeps
 * using `marakasFor`, the primary lords, so this list widens what is shown
 * without widening the windows that are flagged.
 */
export function marakaPlanets(chart: ChartData): MarakaSet {
  const lagna = chart.ascendant.sign;
  const primary = marakasFor(lagna);
  const secondary = new Map<PlanetId, string[]>();
  const add = (id: PlanetId, reason: string) => {
    if (primary.includes(id)) return;
    secondary.set(id, [...(secondary.get(id) ?? []), reason]);
  };
  const at = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const marakaSigns = [(lagna + 1) % 12, (lagna + 6) % 12];

  for (const p of chart.planets) {
    if (p.house === 2 || p.house === 7) add(p.id, `occupies the ${p.house === 2 ? "2nd" : "7th"}`);
    for (const m of primary) {
      const mp = at(m);
      if (mp && p.id !== m && p.sign === mp.sign) add(p.id, `conjoined with the maraka lord ${PLANET_NAMES[m]}`);
    }
  }
  add(SIGN_LORDS[(lagna + 11) % 12], "lord of the 12th");

  const sa = at("Sa");
  if (sa) {
    const connected =
      marakaSigns.includes(sa.sign) ||
      primary.some((m) => at(m)?.sign === sa.sign) ||
      aspectedSigns("Sa", sa.sign).some((s) => marakaSigns.includes(s));
    if (connected) add("Sa", "Saturn connected to the maraka houses or lords");
  }

  return {
    primary,
    secondary: [...secondary.entries()].map(([id, reasons]) => ({ id, reasons: [...new Set(reasons)] })),
  };
}

/**
 * Badhaka (obstructor) lord — the standard scheme: for a movable lagna the
 * 11th lord, for a fixed lagna the 9th lord, for a dual lagna the 7th lord.
 */
export function badhakaFor(lagnaSign: number): { house: number; lord: PlanetId } {
  const mobility = signMobility(lagnaSign);
  const house = mobility === "movable" ? 11 : mobility === "fixed" ? 9 : 7;
  return { house, lord: SIGN_LORDS[(lagnaSign + house - 1) % 12] };
}
