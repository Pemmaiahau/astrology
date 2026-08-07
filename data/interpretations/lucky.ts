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
    caveats.push(
      "Numerology needs a birth date, which is missing here, so only the chart-based verdict is shown below. Nothing has been guessed to fill the gap."
    );
  }

  // ---- Combine: intersection first, disagreements surfaced -----------------
  const disagreements: string[] = [];
  const combine = <T,>(a: T[], b: T[] | undefined, label: string): T[] => {
    if (!b || !b.length) return a;
    const both = a.filter((x) => b.includes(x));
    if (both.length) return [...both, ...a.filter((x) => !both.includes(x)), ...b.filter((x) => !a.includes(x) && !both.includes(x))].slice(0, 4);
    disagreements.push(
      `${label}: your chart favours ${a.slice(0, 2).join(", ")} while numerology favours ${b.slice(0, 2).join(", ")}, and the two do not overlap at all. Rather than average them into something neither system said, both are shown. Where they disagree this page puts the chart-based answer first, because it is derived from your whole birth chart rather than from the calendar date alone — but the choice is yours to make.`
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

  const gemstoneNote = `Tradition attaches a stone to each of the planets working in your favour: ${good
    .map((p) => `${PLANET_NAMES[p]} — ${PLANET_GEMSTONES[p]}`)
    .join("; ")}. This is listed as classical information rather than as a recommendation. If you are considering wearing one, take it to a qualified astrologer first — the tradition holds that a wrongly chosen stone amplifies the wrong planet, which is the opposite of what you were after.`;

  const confidence = Math.max(35, Math.min(80, 55 + (shadbala ? 8 : 0) + (numerology ? 5 : -5) + (numerology?.namank ? 4 : 0)));

  return {
    key: "lucky",
    title: "Lucky Number, Colour & Direction",
    headline: `The planets working in your favour are ${good.map((p) => PLANET_NAMES[p]).join(", ")} — which gives you numbers ${combined.numbers.slice(0, 3).join(", ")}, the colour ${combined.colours[0] ?? "—"}, and ${combined.directions[0] ?? "—"} to face.`,
    confidence,
    blocks: [
      {
        heading: "Where these come from",
        paragraphs: [
          `From your chart: the ruler of your rising sign (${PLANET_NAMES[lagnaLord]})${roles.yogakaraka ? `, your yogakaraka (${PLANET_NAMES[roles.yogakaraka]})` : ""}, the ruler of your Moon's nakshatra${nakLord ? ` (${PLANET_NAMES[nakLord]})` : ""} and your strongest supportive planet${strongestBenefic ? ` (${PLANET_NAMES[strongestBenefic]})` : ""} are the ones working in your favour. Their numbers, colours, days and directions are what this section calls yours.`,
          numerology
            ? `From your birth date: Moolank ${numerology.moolank} and Bhagyank ${numerology.bhagyank}${numerology.namank ? `, and a name number of ${numerology.namank} on the ${numerology.namankSystem} system` : ""}${numerology.kua ? `, with a Kua number of ${numerology.kua}` : ""} — each of which tradition assigns to a planet.`
            : "From your birth date: nothing, because no date was available — the numerology half of this reading is simply absent.",
          "Treat all of this the way tradition actually intends it: as a set of preferences that tilt the odds slightly and cost nothing to follow, not as rules that decide outcomes. Wearing your colour to an interview is worth about as much as the confidence it gives you, which is not nothing.",
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
