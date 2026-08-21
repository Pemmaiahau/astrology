import { PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import { ownedHouses } from "@/utils/astrology/yogas";
import type { ChartData, Dignity, PlanetId } from "@/utils/astrology/types";
import type { VargaId } from "@/utils/astrology/varga";
import { DIGNITY_PLAIN, HOUSE_GOVERNS, PLANET_SIGNIFIES } from "./significations";
import { PLANET_IN_HOUSE } from "./planetInHouse";

/**
 * Reasoning as data, rendered to prose by one function.
 *
 * The problem this solves: today the "why" behind a reading is a hardcoded
 * English sentence written at the point of computation —
 *
 *     addVote(l10, `${PLANET_NAMES[l10]} rules your 10th house — the house of
 *                   the work you are known for`, 30);
 *
 * which cannot be translated, cannot be linted, cannot be rendered at two
 * levels of detail, and gets phrased six different ways across six files.
 *
 * A `Because` is a language-free statement of fact about the chart. `explain`
 * turns it into the four-link chain the redesign specifies:
 *
 *   [placement] -> [what the planet signifies] -> [what the house governs] -> [therefore]
 *
 * All four links come from data. Links 2 and 3 are `significations.ts`; link 4
 * is the existing 108-entry `planetInHouse.ts`. Nothing here reads the clock,
 * computes astronomy, or emits markup.
 *
 * STATUS: this is the foundation only. No section builder consumes it yet, so
 * nothing a reader sees changes. Migrating the builders onto `Because[]` is
 * the next step (REDESIGN.md §5, steps 2-6) and is deliberately not done here.
 */

/** A language-free fact about the chart that supports or undercuts a claim. */
export type Because =
  | { via: "lordship"; planet: PlanetId; houses: number[] }
  | { via: "occupancy"; planet: PlanetId; house: number }
  | { via: "aspect"; planet: PlanetId; house: number; offset: number }
  | { via: "karaka"; planet: PlanetId; theme: string }
  | { via: "dignity"; planet: PlanetId; dignity: Dignity }
  | { via: "varga"; planet: PlanetId; varga: VargaId; house: number }
  | { via: "yoga"; yoga: string; planets: PlanetId[] }
  | { via: "strength"; planet: PlanetId; score: number }
  | { via: "ashtakavarga"; planet: PlanetId; sign: number; bindus: number }
  | { via: "dasha"; level: 1 | 2 | 3; lord: PlanetId }
  | { via: "transit"; planet: PlanetId; house: number; from: "moon" | "lagna" }
  | { via: "lordFrom"; planet: PlanetId; house: number; from: "moon" | "sun" };

/** How much of the chain to render. */
export type Depth = "plain" | "expert";

const DASHA_LEVEL: Record<1 | 2 | 3, string> = {
  1: "main period",
  2: "sub-period",
  3: "sub-sub-period",
};

const p = (id: PlanetId): string => PLANET_NAMES[id];
const signifies = (id: PlanetId): string => PLANET_SIGNIFIES[id].phrase;
const governs = (house: number): string => HOUSE_GOVERNS[house].phrase;

/**
 * "Mars is the planet of drive, courage and confrontation" — with the nodes
 * phrased around the fact that they rule nothing and act through others.
 */
function signifierClause(id: PlanetId): string {
  if (id === "Ra" || id === "Ke") return `${p(id)} stands for ${signifies(id)}`;
  return `${p(id)} is the planet of ${signifies(id)}`;
}

/** Sentence-cases a clause and gives it a full stop. */
function sentence(text: string): string {
  const trimmed = text.trim();
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

/**
 * Render one `Because` as plain English.
 *
 * `chart` is accepted so the renderer can reach the curated leaf text (the
 * "therefore" link) and name signs; it never derives new astrology from it.
 */
export function explain(because: Because, chart: ChartData, depth: Depth = "plain"): string {
  switch (because.via) {
    case "lordship": {
      const houses = because.houses.map(ordinal).join(" and ");
      const themes = because.houses.map((h) => governs(h)).join("; and ");
      return sentence(
        `${p(because.planet)} rules your ${houses} house. ${signifierClause(because.planet)}, and that house governs ${themes}`
      );
    }

    case "occupancy": {
      const effect = PLANET_IN_HOUSE[because.planet]?.[because.house - 1];
      const chain = `${p(because.planet)} sits in your ${ordinal(because.house)} house. ${signifierClause(
        because.planet
      )}; the ${ordinal(because.house)} house governs ${governs(because.house)}`;
      return effect ? `${sentence(chain)} ${effect}` : sentence(chain);
    }

    case "aspect": {
      // The offset matters interpretively — Saturn's 3rd glance is not its 10th
      // — but naming it is practitioner detail, so it stays in expert depth.
      const which = depth === "expert" ? ` (its ${ordinal(because.offset)} glance)` : "";
      return sentence(
        `${p(because.planet)} casts an influence on your ${ordinal(because.house)} house${which}. ${signifierClause(
          because.planet
        )}, so it colours ${governs(because.house)} without sitting there`
      );
    }

    case "karaka":
      return sentence(
        `${p(because.planet)} is the natural indicator for ${because.theme}. ${signifierClause(
          because.planet
        )}, so its condition in your chart is read directly for this`
      );

    case "dignity": {
      const d = DIGNITY_PLAIN[because.dignity];
      const label = depth === "expert" ? ` (${because.dignity})` : "";
      return sentence(`${p(because.planet)} ${d.phrase}${label}, so it acts with ${d.band === "strong" ? "full force" : d.band === "weak" ? "reduced force" : "middling force"}`);
    }

    case "varga":
      return sentence(
        `${p(because.planet)} falls in the ${ordinal(because.house)} house of your ${because.varga} chart, which reads the same question from a second, independent angle`
      );

    case "yoga":
      return sentence(
        `${because.yoga} forms in your chart, involving ${because.planets.map(p).join(" and ")}, which lifts everything ${because.planets.length > 1 ? "those planets" : "that planet"} governs`
      );

    case "strength": {
      const band = because.score >= 60 ? "strong" : because.score >= 45 ? "middling" : "weak";
      const figure = depth === "expert" ? ` (${because.score}/100)` : "";
      return sentence(`${p(because.planet)} is ${band} in your chart${figure}`);
    }

    case "ashtakavarga":
      return sentence(
        `${p(because.planet)} has ${because.bindus} of a possible 8 support points in ${SIGNS[because.sign]}, which is ${because.bindus >= 5 ? "above" : because.bindus <= 3 ? "below" : "about"} average`
      );

    case "dasha":
      return sentence(
        `You are running a ${p(because.lord)} ${DASHA_LEVEL[because.level]}. In the Indian timing system the planet whose period is running colours that stretch of life, and ${signifierClause(
          because.lord
        ).toLowerCase()}`
      );

    case "transit": {
      const anchor = because.from === "moon" ? "your Moon" : "your rising sign";
      return sentence(
        `${p(because.planet)} is currently passing through the ${ordinal(because.house)} house counted from ${anchor}. ${signifierClause(
          because.planet
        )}, and that house governs ${governs(because.house)}`
      );
    }

    case "lordFrom": {
      const anchor = because.from === "moon" ? "your Moon" : "your Sun";
      const why =
        because.from === "moon"
          ? "which is what you actually feel at home doing"
          : "which is who you take yourself to be";
      return sentence(
        `${p(because.planet)} rules the ${ordinal(because.house)} house counted from ${anchor}, ${why}`
      );
    }
  }
}

/**
 * Convenience: build the `Because` values a planet's placement supports, read
 * straight off the chart. The shape section builders will move onto.
 */
export function placementFacts(chart: ChartData, id: PlanetId): Because[] {
  const planet = chart.planets.find((q) => q.id === id);
  if (!planet) return [];
  const owned = ownedHouses(id, chart.ascendant.sign);
  const facts: Because[] = [{ via: "occupancy", planet: id, house: planet.house }];
  if (owned.length) facts.push({ via: "lordship", planet: id, houses: owned });
  facts.push({ via: "dignity", planet: id, dignity: planet.dignity });
  return facts;
}
