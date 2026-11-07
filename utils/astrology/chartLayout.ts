import { PLANET_NAMES } from "./constants";
import { fmtDeg } from "./math";
import { DIGNITY_SHORT } from "./states";
import type { ChartData, PlanetPosition } from "./types";
import type { VargaChart } from "./varga";

/**
 * Chart geometry and contents, shared by the on-screen charts and the PDF
 * export so the two can never draw a different chart.
 *
 * Pure data: no React and no drawing. A chart reduces to a list of entries per
 * sign (`rashiModel`, `vargaModel`), and each layout says where those entries
 * go. The two layouts differ in what is fixed: South Indian fixes the signs and
 * moves the Lagna; North Indian fixes the houses and moves the signs.
 */

export type ChartLayout = "south" | "north";

export type EntryTone = "strong" | "weak" | "plain" | "lagna";

export interface ChartEntry {
  /** Short body label: "Su", or "Asc" for the Lagna. */
  id: string;
  /** Degree in a rashi chart, dignity in a varga. */
  detail?: string;
  /** "R·C", the Vargottama star and the like. */
  flags?: string;
  /** Bhava Chalit marker, "→B3", when the planet changes house. */
  shift?: string;
  tone: EntryTone;
  title: string;
}

export interface ChartModel {
  lagnaSign: number;
  /** Entries by sign index 0–11. */
  bySign: ChartEntry[][];
}

const emptySigns = (): ChartEntry[][] => Array.from({ length: 12 }, () => []);

function planetEntry(p: PlanetPosition, chalit: boolean): ChartEntry {
  const flags: string[] = [];
  if (p.retrograde) flags.push("R");
  if (p.combust) flags.push("C");
  if (p.warWith) flags.push(p.warWinner ? "W+" : "W−");
  return {
    id: p.id,
    detail: fmtDeg(p.degInSign),
    flags: flags.length ? flags.join("·") : undefined,
    shift: chalit && p.bhava !== p.house ? `→B${p.bhava}` : undefined,
    tone: ["exalted", "moolatrikona", "own"].includes(p.dignity)
      ? "strong"
      : p.dignity === "debilitated"
        ? "weak"
        : "plain",
    title: `${PLANET_NAMES[p.id]} — ${p.dignity}`,
  };
}

export function rashiModel(chart: ChartData, chalit = false): ChartModel {
  const bySign = emptySigns();
  bySign[chart.ascendant.sign].push({
    id: "Asc",
    detail: fmtDeg(chart.ascendant.degInSign),
    tone: "lagna",
    title: "Lagna",
  });
  for (const p of chart.planets) bySign[p.sign].push(planetEntry(p, chalit));
  return { lagnaSign: chart.ascendant.sign, bySign };
}

const STRONG = ["exalted", "moolatrikona", "own", "greatFriend"];
const WEAK = ["debilitated", "greatEnemy", "enemy"];

export function vargaModel(chart: VargaChart): ChartModel {
  const bySign = emptySigns();
  for (const p of chart.positions) {
    bySign[p.sign].push({
      id: p.id,
      detail: DIGNITY_SHORT[p.dignity],
      flags: p.vargottama ? "★" : undefined,
      tone: STRONG.includes(p.dignity) ? "strong" : WEAK.includes(p.dignity) ? "weak" : "plain",
      title: `${PLANET_NAMES[p.id]} — ${p.dignity}`,
    });
  }
  return { lagnaSign: chart.ascendant, bySign };
}

/** Whole-sign house 1–12 of a sign. */
export function houseOfSign(sign: number, lagnaSign: number): number {
  return ((sign - lagnaSign + 12) % 12) + 1;
}

/** Sign index 0–11 standing in a house. */
export function signOfHouse(house: number, lagnaSign: number): number {
  return (lagnaSign + house - 1) % 12;
}

/** South Indian grid cell [row, col] per sign: Aries second in the top row, clockwise. */
export const SOUTH_SIGN_CELL: Record<number, [number, number]> = {
  11: [0, 0], 0: [0, 1], 1: [0, 2], 2: [0, 3],
  10: [1, 0], 3: [1, 3],
  9: [2, 0], 4: [2, 3],
  8: [3, 0], 7: [3, 1], 6: [3, 2], 5: [3, 3],
};

// ---------------------------------------------------------------------------
// North Indian diamond, drawn on a 100 × 100 square
// ---------------------------------------------------------------------------

export type Point = [number, number];

const A: Point = [0, 0];
const B: Point = [100, 0];
const C: Point = [100, 100];
const D: Point = [0, 100];
const TOP: Point = [50, 0];
const RIGHT: Point = [100, 50];
const BOTTOM: Point = [50, 100];
const LEFT: Point = [0, 50];
const NW: Point = [25, 25];
const NE: Point = [75, 25];
const SE: Point = [75, 75];
const SW: Point = [25, 75];
const O: Point = [50, 50];

/**
 * The twelve houses, index 0 = house 1. The Lagna is always the top diamond and
 * the houses run anticlockwise from it; the signs are what move.
 */
export const NORTH_HOUSES: Point[][] = [
  [TOP, NE, O, NW],
  [A, TOP, NW],
  [A, NW, LEFT],
  [LEFT, NW, O, SW],
  [LEFT, SW, D],
  [D, SW, BOTTOM],
  [BOTTOM, SW, O, SE],
  [BOTTOM, SE, C],
  [C, SE, RIGHT],
  [RIGHT, SE, O, NE],
  [RIGHT, NE, B],
  [B, NE, TOP],
];

/** Where each house prints its sign number: at the point nearest the chart's centre. */
export const NORTH_SIGN_ANCHOR: Point[] = [
  [50, 44], [25, 21], [21, 25], [44, 50], [21, 75], [25, 79],
  [50, 56], [75, 79], [79, 75], [56, 50], [79, 25], [75, 21],
];

export type LabelAlign = "start" | "middle" | "end";

export interface NorthSlot {
  x: number;
  y: number;
  align: LabelAlign;
}

export interface NorthSlots {
  slots: NorthSlot[];
  /** Multiplier for the label size; below 1 when a house is crowded. */
  scale: number;
}

type HouseShape = "kite" | "top" | "bottom" | "left" | "right";

const HOUSE_SHAPE: HouseShape[] = [
  "kite", "top", "left", "kite", "left", "bottom",
  "kite", "bottom", "right", "kite", "right", "top",
];

/** Label block centre for a kite, or the anchor edge of a triangle. */
const HOUSE_ANCHOR: Point[] = [
  [50, 24], [25, 5], [2, 25], [24, 50], [2, 75], [25, 95],
  [50, 76], [75, 95], [98, 75], [76, 50], [98, 25], [75, 5],
];

const ROW = 3.7;
const COLUMN = 16.5;

/**
 * Text positions for `count` labels in a house. Triangles narrow towards the
 * centre of the chart, so their labels start at the wide edge and stack inward.
 * `wide` drops to one column for labels that carry flags as well as a degree.
 */
export function northSlots(house: number, count: number, wide = false): NorthSlots {
  const shape = HOUSE_SHAPE[house - 1];
  const [ax, ay] = HOUSE_ANCHOR[house - 1];
  const sideways = shape === "left" || shape === "right";
  const cols = sideways || wide ? 1 : 2;
  const capacity = shape === "kite" ? (wide ? 4 : 6) : sideways ? 4 : wide ? 3 : 4;
  const scale = count <= capacity ? 1 : count <= capacity + 2 ? 0.84 : 0.72;
  const row = ROW * scale;
  const column = COLUMN * scale;
  const rows = Math.ceil(count / cols);

  const slots: NorthSlot[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols);
    const inRow = Math.min(cols, count - r * cols);
    const c = i % cols;
    const x = sideways ? ax : ax + (c - (inRow - 1) / 2) * column;
    const y =
      shape === "top"
        ? ay + r * row
        : shape === "bottom"
          ? ay - (rows - 1 - r) * row
          : ay + (r - (rows - 1) / 2) * row;
    slots.push({ x, y, align: shape === "left" ? "start" : shape === "right" ? "end" : "middle" });
  }
  return { slots, scale };
}

/** True when any label in a house needs the single-column layout. */
export function isWideHouse(entries: ChartEntry[]): boolean {
  return entries.some((e) => Boolean(e.flags || e.shift));
}
