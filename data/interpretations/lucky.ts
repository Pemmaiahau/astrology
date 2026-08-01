import {
  PLANET_COLOURS,
  PLANET_DIRECTION,
  PLANET_GEMSTONES,
  PLANET_NAMES,
  PLANET_NUMBER,
  SIGN_LORDS,
  VARA_LORDS,
  VARA_NAMES,
} from "@/utils/astrology/constants";
import type { NumerologyResult } from "@/utils/astrology/numerology";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import type { ChartData, PlanetId } from "@/utils/astrology/types";
import { FUNCTIONAL_ROLES } from "./lordships";
import type { SectionReport } from "./report";

/**
 * Lucky numbers, colours, days and directions — numerology and Jyotisha
 * judged SEPARATELY, then combined; wherever the two systems disagree the
 * disagreement is shown, never silently averaged.
 *
 * Sources: number→planet rulership per the Cheiro/Vedic numerology
 * convention (1 Sun, 2 Moon, 3 Jupiter, 4 Rahu, 5 Mercury, 6 Venus,
 * 7 Ketu, 8 Saturn, 9 Mars); planet→colour per BPHS Ch.3 graha
 * descriptions + tradition; planet→direction per the digpati scheme;
 * planet→day per the weekday lords; auspicious planets for the lagna per
 * the Parashari functional-benefic scheme; gemstones are listed as
 * classical information only.
 */

const NUMBER_PLANET: Record<number, PlanetId> = Object.fromEntries(
  (Object.entries(PLANET_NUMBER) as [PlanetId, number][]).map(([p, n]) => [n, p])
) as Record<number, PlanetId>;

/** Kua number → favourable directions (Eight Mansions convention). */
const KUA_DIRECTIONS: Record<number, string[]> = {
  1: ["South-East", "East", "South", "North"],
  2: ["North-East", "West", "North-West", "South-West"],
  3: ["South", "North", "South-East", "East"],
  4: ["North", "South", "East", "South-East"],
  6: ["West", "North-East", "South-West", "North-West"],
  7: ["North-West", "South-West", "North-East", "West"],
  8: ["South-West", "North-West", "West", "North-East"],
  9: ["East", "South-East", "North", "South"],
};

export interface LuckyVerdict {
  numbers: number[];
  avoidNumbers: number[];
  colours: string[];
  avoidColours: string[];
  directions: string[];
  days: string[];
  planets: PlanetId[];
}

export interface LuckyReport extends SectionReport {
  numerologyVerdict: LuckyVerdict | null;
  jyotishaVerdict: LuckyVerdict;
  combined: {
    numbers: number[];
    colours: string[];
    directions: string[];
    days: string[];
    disagreements: string[];
  };
  gemstoneNote: string;
}

const dayOf = (id: PlanetId): string | null => {
  const idx = VARA_LORDS.indexOf(id);
  return idx === -1 ? null : VARA_NAMES[idx];
};

function verdictFromPlanets(good: PlanetId[], bad: PlanetId[]): LuckyVerdict {
  const numbers = [...new Set(good.map((p) => PLANET_NUMBER[p]))];
  const avoidNumbers = [...new Set(bad.map((p) => PLANET_NUMBER[p]))].filter((n) => !numbers.includes(n));
  const colours = [...new Set(good.map((p) => PLANET_COLOURS[p].primary))];
  const avoidColours = [...new Set(bad.map((p) => PLANET_COLOURS[p].primary))].filter((c) => !colours.includes(c));
  const directions = [...new Set(good.map((p) => PLANET_DIRECTION[p]).filter((d): d is string => Boolean(d)))];
  const days = [...new Set(good.map(dayOf).filter((d): d is string => Boolean(d)))];
  return { numbers, avoidNumbers, colours, avoidColours, directions, days, planets: good };
}

export function buildLuckyReport(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  shadbala: ShadbalaSet | null,
  numerology: NumerologyResult | null
): LuckyReport {
  const lagna = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagna];
  const caveats: string[] = [...(numerology?.caveats ?? [])];

  // ---- Jyotisha side: the auspicious planets for THIS chart -----------------
  const lagnaLord = SIGN_LORDS[lagna];
  const moon = chart.planets.find((p) => p.id === "Mo");
  const nakLord = moon ? moon.nakshatraLord : null;

  const good: PlanetId[] = [lagnaLord];
  if (roles.yogakaraka) good.push(roles.yogakaraka);
  if (nakLord && !good.includes(nakLord)) good.push(nakLord);
  // Strongest functional benefic, by Shadbala when available.
  const beneficPool = roles.benefics.filter((b) => !good.includes(b));
  const strongestBenefic = beneficPool.sort((a, b) => {
    const sa = shadbala?.planets[a as keyof ShadbalaSet["planets"]]?.totalVirupas ?? strengths[a]?.score ?? 0;
    const sb = shadbala?.planets[b as keyof ShadbalaSet["planets"]]?.totalVirupas ?? strengths[b]?.score ?? 0;
    return sb - sa;
  })[0];
  if (strongestBenefic) good.push(strongestBenefic);
  const bad = roles.malefics.filter((m) => !good.includes(m));

  const jyotishaVerdict = verdictFromPlanets(good, bad);

  // ---- Numerology side ------------------------------------------------------
  let numerologyVerdict: LuckyVerdict | null = null;
  if (numerology) {
    const numPlanets: PlanetId[] = [];
    for (const n of [numerology.moolank, numerology.bhagyank, numerology.namank].filter(
      (x): x is number => x !== null
    )) {
      const p = NUMBER_PLANET[n];
      if (p && !numPlanets.includes(p)) numPlanets.push(p);
    }
    numerologyVerdict = verdictFromPlanets(numPlanets, []);
    numerologyVerdict.numbers = [
      ...new Set(
        [numerology.moolank, numerology.bhagyank, numerology.namank].filter((x): x is number => x !== null)
      ),
    ];
    if (numerology.kua && KUA_DIRECTIONS[numerology.kua]) {
      numerologyVerdict.directions = KUA_DIRECTIONS[numerology.kua].slice(0, 2);
    }
  } else {
    caveats.push("Numerology needs a birth date — only the Jyotisha verdict is shown.");
  }

  // ---- Combine: intersection first, disagreements surfaced -----------------
  const disagreements: string[] = [];
  const combine = <T,>(a: T[], b: T[] | undefined, label: string): T[] => {
    if (!b || !b.length) return a;
    const both = a.filter((x) => b.includes(x));
    if (both.length) return [...both, ...a.filter((x) => !both.includes(x)), ...b.filter((x) => !a.includes(x) && !both.includes(x))].slice(0, 4);
    disagreements.push(
      `${label}: Jyotisha favours ${a.slice(0, 2).join(", ")} while numerology favours ${b.slice(0, 2).join(", ")} — no overlap. When systems disagree, this app ranks the Jyotisha (birth-chart) verdict first because it is computed from your full chart rather than the calendar date alone; both are listed so you can choose.`
    );
    return [...a.slice(0, 2), ...b.slice(0, 2)];
  };

  const combined = {
    numbers: combine(jyotishaVerdict.numbers, numerologyVerdict?.numbers, "Numbers"),
    colours: combine(jyotishaVerdict.colours, numerologyVerdict?.colours, "Colours"),
    directions: combine(jyotishaVerdict.directions, numerologyVerdict?.directions, "Directions"),
    days: combine(jyotishaVerdict.days, numerologyVerdict?.days, "Days"),
    disagreements,
  };

  const gemstoneNote = `Classical gemstone associations for your auspicious planets: ${good
    .map((p) => `${PLANET_NAMES[p]} — ${PLANET_GEMSTONES[p]}`)
    .join("; ")}. Listed as classical information only: consult a qualified astrologer before wearing any gemstone, since a wrongly chosen stone is traditionally held to amplify the wrong planet.`;

  const confidence = Math.max(35, Math.min(80, 55 + (shadbala ? 8 : 0) + (numerology ? 5 : -5) + (numerology?.namank ? 4 : 0)));

  return {
    key: "lucky",
    title: "Lucky Number, Colour & Direction",
    headline: `Your auspicious planets are ${good.map((p) => PLANET_NAMES[p]).join(", ")} — numbers ${combined.numbers.slice(0, 3).join(", ")}, ${combined.colours[0] ?? "—"}, facing ${combined.directions[0] ?? "—"}.`,
    confidence,
    blocks: [
      {
        heading: "How this was derived",
        paragraphs: [
          `Jyotisha side: your Lagna lord (${PLANET_NAMES[lagnaLord]}), ${roles.yogakaraka ? `yogakaraka (${PLANET_NAMES[roles.yogakaraka]}), ` : ""}Moon-nakshatra lord${nakLord ? ` (${PLANET_NAMES[nakLord]})` : ""} and strongest functional benefic${strongestBenefic ? ` (${PLANET_NAMES[strongestBenefic]})` : ""} are the planets that work FOR this chart — their numbers, colours, days and directions are yours.`,
          numerology
            ? `Numerology side: birth-date numbers Moolank ${numerology.moolank} and Bhagyank ${numerology.bhagyank}${numerology.namank ? `, name number ${numerology.namank} (${numerology.namankSystem})` : ""}${numerology.kua ? `, Kua ${numerology.kua}` : ""} — each ruled by its classical planet.`
            : "Numerology side: unavailable without a birth date.",
        ],
      },
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    numerologyVerdict,
    jyotishaVerdict,
    combined,
    gemstoneNote,
  };
}
