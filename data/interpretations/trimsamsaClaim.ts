import { PLANET_NAMES, SIGN_LORDS, SIGNS } from "@/utils/astrology/constants";
import { vargaSign } from "@/utils/astrology/varga";
import type { ChartData, PlanetId } from "@/utils/astrology/types";

/**
 * The Trimsamsa (D-30) lord reading, reported as a **classical claim under
 * test** rather than as a finding about the native.
 *
 * WHY THIS IS FRAMED THE WAY IT IS. The older literature reads the D-30 lord
 * of the Lagna, the Moon and Venus as describing a native's conduct, and the
 * chapter is applied overwhelmingly — in several texts exclusively — to
 * women's charts, where its output is a verdict on sexual morality. This app
 * previously refused the rule outright. That refusal removed a genuinely
 * classical technique from a section whose purpose is to let classical claims
 * be checked, so the rule is now implemented, and what is refused instead is
 * the *verdict form*:
 *
 *   - the classical gloss is printed as what the text asserts, attributed,
 *     never as a statement about the reader;
 *   - the same rule is run identically whatever the chart's gender, because
 *     nothing in the D-30 construction is gender-dependent — the asymmetry is
 *     in the reception, not the mathematics;
 *   - the moral vocabulary of the source ("chaste", "corrupt", "of good
 *     conduct") is not reproduced. What is reproduced is the temperament each
 *     lord is said to confer, which is the part of the claim that can actually
 *     be checked against a life;
 *   - every row says, in the reader's own copy, that this is among the most
 *     contested rules in the corpus.
 *
 * The reader gets the claim, its provenance and its contested status, and can
 * judge it. That is the accuracy-testing use; a verdict is not.
 *
 * Sources: BPHS Shodasavarga adhyaya for the unequal Trimsamsa construction
 * (already implemented in `varga.ts` — Mars 5°, Saturn 5°, Jupiter 8°,
 * Mercury 7°, Venus 5° in odd signs, reversed in even); the deity assignment
 * (Agni, Vayu, Indra, Kubera, Varuna) and the per-lord character glosses from
 * the Trimsamsa chapters of BPHS and Phaladeepika.
 *
 * Pure: no ephemeris, no `Date.now()`.
 */

/** The five Trimsamsa lords, their presiding deities and what the texts claim. */
const TRIMSAMSA_LORD: Record<
  string,
  { deity: string; element: string; claim: string }
> = {
  Ma: {
    deity: "Agni",
    element: "fire",
    claim:
      "a forceful, impatient temperament — quick to act on wanting, quick to anger, and disinclined to be governed by anyone else's timetable",
  },
  Sa: {
    deity: "Vayu",
    element: "air",
    claim:
      "an austere, withholding temperament — appetite that is real but held under restraint, and a tendency to treat deprivation as a discipline rather than a loss",
  },
  Ju: {
    deity: "Indra",
    element: "ether",
    claim:
      "a principled, expansive temperament — desire framed by an ethic the person has actually thought about, and a strong preference for conduct that can be stated out loud",
  },
  Me: {
    deity: "Kubera",
    element: "earth",
    claim:
      "an adaptable, curious temperament — appetite routed through talk, imagination and variety more than through the body alone",
  },
  Ve: {
    deity: "Varuna",
    element: "water",
    claim:
      "a refined, pleasure-oriented temperament — an unembarrassed appetite for beauty, comfort and sensual detail, and a low tolerance for coarseness",
  },
};

export interface TrimsamsaClaim {
  /** Which natal point this row reads. */
  point: "Lagna" | "Moon" | "Venus";
  /** The D-30 sign that point falls in. */
  sign: number;
  lord: PlanetId;
  deity: string;
  text: string;
}

export interface TrimsamsaReading {
  rows: TrimsamsaClaim[];
  /** The standing framing, shown above the rows. */
  preamble: string[];
}

/**
 * The D-30 lord of the Lagna, the Moon and Venus, with the classical claim
 * each carries. Returns null when the chart has no usable longitudes.
 */
export function buildTrimsamsaClaim(chart: ChartData): TrimsamsaReading | null {
  const points: { point: TrimsamsaClaim["point"]; longitude: number }[] = [
    { point: "Lagna", longitude: chart.ascendant.longitude },
  ];
  const moon = chart.planets.find((p) => p.id === "Mo");
  const venus = chart.planets.find((p) => p.id === "Ve");
  if (moon) points.push({ point: "Moon", longitude: moon.longitude });
  if (venus) points.push({ point: "Venus", longitude: venus.longitude });
  if (!points.length) return null;

  const WHAT_THE_POINT_IS: Record<TrimsamsaClaim["point"], string> = {
    Lagna: "the body and the way you meet the world",
    Moon: "the mind and what it is receptive to",
    Venus: "desire itself — the karaka this whole section is built around",
  };

  const rows: TrimsamsaClaim[] = points.map(({ point, longitude }) => {
    const sign = vargaSign("D30", longitude);
    const lord = SIGN_LORDS[sign];
    const entry = TRIMSAMSA_LORD[lord] ?? {
      deity: "—",
      element: "—",
      claim: "no classical gloss is recorded for this lord in the Trimsamsa chapter",
    };
    return {
      point,
      sign,
      lord,
      deity: entry.deity,
      text:
        `**${point}** (${WHAT_THE_POINT_IS[point]}) falls in the ${SIGNS[sign]} Trimsamsa, ruled by ` +
        `${PLANET_NAMES[lord]}, whose presiding deity is ${entry.deity} — the ${entry.element} division. ` +
        `*The classical claim:* ${entry.claim}. ` +
        `Recorded as the text's assertion so you can check it against your own life, not as a conclusion this app draws about you.`,
    };
  });

  return {
    rows,
    preamble: [
      "The Trimsamsa is the D-30, the thirtieth division of a sign, and the older literature reads its lord for a native's temperament and conduct. It is included here because a section that exists to let classical claims be tested should not quietly drop the ones that are awkward — but it is included as a claim, not as a finding.",
      "Two things are worth knowing before you read it. First, this is among the most contested rules in the corpus: the chapter is applied in several texts exclusively to women's charts, and its output there is a verdict on sexual morality. That verdict is not reproduced. What is reproduced is the temperament each Trimsamsa lord is said to confer, which is the part of the claim a life can actually confirm or contradict. Second, the rule is run identically here whatever the chart — nothing in the D-30 construction is gender-dependent, and the asymmetry in the tradition is in how the result was received rather than in how it is calculated.",
      "Read each row as: *the text says this; does it match?* That is the only question it is being asked to answer.",
    ],
  };
}
