import { aspectsOnSign, naturalBenefics } from "./aspects";
import type { ChartData, PlanetId } from "./types";

/**
 * Sudarshana Chakra — the same twelve houses judged three times over, counted
 * from the Lagna, from the Moon and from the Sun.
 *
 * The classical use is corroboration rather than novelty: a matter promised
 * from one of the three frames is a possibility, a matter promised from all
 * three is something the chart is actually committed to. Reading only from the
 * Lagna is the commonest way to over-read a single placement.
 *
 * NOTE ON PROVENANCE: `rectification/rectify.ts` contains a check by the same
 * name, but it is a different thing — it asks whether an *event's* bhava is lit
 * up by the dasha lords running at the time, which only makes sense with a
 * dated event in hand. This module is the natal technique, and shares no code
 * with it. (BENCHMARK.md originally described the rectification version as the
 * natal feature "already implemented"; that was wrong, and this is the
 * correction.)
 *
 * Pure: no ephemeris, no "now", no dasha. Whole-sign throughout, consistent
 * with the rest of the engine.
 */

export type FrameKey = "lagna" | "moon" | "sun";

export const FRAME_LABELS: Record<FrameKey, string> = {
  lagna: "from your rising sign",
  moon: "from your Moon",
  sun: "from your Sun",
};

export interface FrameReading {
  frame: FrameKey;
  /** Sidereal sign this house falls in, counted from that frame's anchor. */
  sign: number;
  occupants: PlanetId[];
  /** Planets casting drishti on the sign (occupancy excluded). */
  aspecting: PlanetId[];
  /** Benefic influences minus malefic ones, occupancy and drishti together. */
  net: number;
}

export interface SudarshanaHouse {
  house: number;
  frames: FrameReading[];
  /** How many of the three frames carry net benefic support (0-3). */
  supported: number;
  /** How many carry net malefic pressure (0-3). */
  strained: number;
  /**
   * True when all three frames agree in the same direction — the state the
   * technique exists to identify.
   */
  unanimous: boolean;
}

/**
 * The full chakra: twelve houses, each read from all three anchors.
 *
 * A frame is "supported" when benefic influence on its sign outweighs malefic
 * influence, counting occupancy and drishti equally. That equal weighting is
 * this app's simplification, not a classical rule — the texts describe the
 * chakra qualitatively — so the UI reports the counts rather than deriving a
 * score from them.
 */
export function computeSudarshana(chart: ChartData): SudarshanaHouse[] {
  const benefics = naturalBenefics(chart);
  const moon = chart.planets.find((p) => p.id === "Mo");
  const sun = chart.planets.find((p) => p.id === "Su");

  const anchors: { frame: FrameKey; sign: number }[] = [
    { frame: "lagna", sign: chart.ascendant.sign },
    ...(moon ? [{ frame: "moon" as const, sign: moon.sign }] : []),
    ...(sun ? [{ frame: "sun" as const, sign: sun.sign }] : []),
  ];

  const lean = (id: PlanetId): number => (benefics.includes(id) ? 1 : -1);

  const out: SudarshanaHouse[] = [];
  for (let house = 1; house <= 12; house++) {
    const frames: FrameReading[] = anchors.map(({ frame, sign: anchorSign }) => {
      const sign = (anchorSign + house - 1) % 12;
      const occupants = chart.planets.filter((p) => p.sign === sign).map((p) => p.id);
      const aspecting = aspectsOnSign(chart, sign);
      const net = [...occupants, ...aspecting].reduce((s, id) => s + lean(id), 0);
      return { frame, sign, occupants, aspecting, net };
    });

    const supported = frames.filter((f) => f.net > 0).length;
    const strained = frames.filter((f) => f.net < 0).length;
    out.push({
      house,
      frames,
      supported,
      strained,
      unanimous: supported === frames.length || strained === frames.length,
    });
  }
  return out;
}

/** Houses the whole chakra agrees are well-supported. */
export function unanimouslySupported(chakra: SudarshanaHouse[]): SudarshanaHouse[] {
  return chakra.filter((h) => h.unanimous && h.supported > 0);
}

/** Houses the whole chakra agrees are under pressure. */
export function unanimouslyStrained(chakra: SudarshanaHouse[]): SudarshanaHouse[] {
  return chakra.filter((h) => h.unanimous && h.strained > 0);
}
