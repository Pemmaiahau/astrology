import { PLANET_NAMES, PLANETS } from "./constants";
import { ordinal } from "./format";
import { signOf } from "./math";
import { occupancyIntervals, siderealLongitudeAt, type OccupancyInterval } from "./scan";
import {
  transitSnapshot,
  vedhaBlocked,
  VEDHA_TABLE,
  type TransitSnapshot,
} from "./rectification/transitFitness";
import type { AyanamshaId, ChartData, NodeMode, PlanetId } from "./types";

/**
 * Gochara Phala — classical transit results, judged from the natal Moon.
 *
 * The rectification layer already owns the pieces this needs: `VEDHA_TABLE`
 * and `vedhaBlocked` (Phaladeepika ch. 26 / BPHS Gochara adhyaya) and
 * `transitSnapshot`. What it does NOT own is the shape the Life Events
 * timeline wants — gochara evaluated *continuously across a date range*
 * rather than at one known instant, because here the instant is the unknown.
 * This module supplies that and nothing else: no event knowledge, no dasha,
 * no scoring policy. Pure functions of (chart, ayanamsha, window).
 *
 * Sources: BPHS Gochara adhyaya and Phaladeepika ch. 26 for the auspicious
 * house sets and the vedha cancellations; Sade Sati and Kantaka/Ashtama Shani
 * per the same chapters. Nodal gochara has no classical vedha table and is
 * flagged as convention wherever it is used.
 */

const DAY = 86400000;

/**
 * Houses from the natal Moon in which each graha's transit is auspicious.
 *
 * Derived from `VEDHA_TABLE`, not restated: that table is keyed by exactly the
 * auspicious houses (each mapping to the house whose occupation cancels the
 * result), so restating the set here would be a second copy free to drift from
 * the first. It yields Sun 3/6/10/11, Moon 1/3/6/7/10/11, Mars 3/6/11,
 * Mercury 2/4/6/8/10/11, Jupiter 2/5/7/9/11, Venus 1/2/3/4/5/8/9/11/12,
 * Saturn 3/6/11 — the standard Gochara table.
 */
export const AUSPICIOUS_HOUSES: Partial<Record<PlanetId, number[]>> = Object.fromEntries(
  Object.entries(VEDHA_TABLE).map(([id, table]) => [id, Object.keys(table).map(Number)])
) as Partial<Record<PlanetId, number[]>>;

/**
 * Rahu and Ketu by convention rather than by the seven-graha table: taken as
 * favourable in the upachaya houses 3, 6, 10 and 11 counted from the Moon.
 * They cause no vedha and suffer none — extending the classical table to them
 * would be invention. Callers weight nodal gochara below the seven grahas for
 * exactly that reason.
 */
export const NODE_AUSPICIOUS_HOUSES = [3, 6, 10, 11];

/** Saturn's standing afflictions counted from the natal Moon. */
export type SaturnStance =
  | "sadeSati-rising"
  | "sadeSati-peak"
  | "sadeSati-setting"
  | "kantaka-4"
  | "kantaka-10"
  | "ashtama"
  | null;

const SATURN_STANCE: Record<number, NonNullable<SaturnStance>> = {
  12: "sadeSati-rising",
  1: "sadeSati-peak",
  2: "sadeSati-setting",
  4: "kantaka-4",
  8: "ashtama",
  10: "kantaka-10",
};

export const SATURN_STANCE_TEXT: Record<NonNullable<SaturnStance>, string> = {
  "sadeSati-rising":
    "Sade Sati is rising — Saturn has entered the 12th from your Moon, and the drain starts before the pressure does",
  "sadeSati-peak":
    "Sade Sati is at its peak — Saturn stands on your Moon itself, the heaviest of the three phases",
  "sadeSati-setting":
    "Sade Sati is setting — Saturn has moved to the 2nd from your Moon, where the weight falls on resources and family rather than on you directly",
  "kantaka-4":
    "Kantaka Shani — Saturn transits the 4th from your Moon, the classical obstruction to home, property and peace of mind",
  "kantaka-10":
    "Kantaka Shani — Saturn transits the 10th from your Moon, the classical obstruction to work and standing",
  ashtama:
    "Ashtama Shani — Saturn transits the 8th from your Moon, traditionally the most health-sensitive of Saturn's passages",
};

/** One graha's transit result at an instant, with the vedha applied. */
export interface GocharaResult {
  id: PlanetId;
  sign: number;
  houseFromMoon: number;
  houseFromLagna: number;
  /** Before vedha. */
  auspicious: boolean;
  /** The graha whose placement cancels an auspicious result, when one does. */
  vedhaBy: PlanetId | null;
  /** −1 … +1 after vedha; 0 means neither classical result applies. */
  value: number;
  text: string;
}

const GOCHARA_MALEFICS: PlanetId[] = ["Sa", "Ma", "Ra", "Ke", "Su"];

/**
 * Gochara for a set of bodies at one instant.
 *
 * A vedha does not merely reduce an auspicious transit — the classical rule
 * cancels it, so the value drops to 0 rather than going negative. Houses
 * outside the auspicious set score −1 for the malefics and 0 for the benefics,
 * which is the asymmetry the texts actually describe: Jupiter in a non-listed
 * house is quiet, Saturn in one is not.
 */
export function gocharaAt(
  chart: ChartData,
  ayanamsha: AyanamshaId,
  at: Date,
  bodies: PlanetId[] = ["Ju", "Sa", "Ra", "Ke"],
  snap?: TransitSnapshot
): GocharaResult[] {
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : chart.ascendant.sign;
  const lagnaSign = chart.ascendant.sign;
  const nodeMode: NodeMode = chart.meta.nodeMode ?? "mean";
  const snapshot = snap ?? transitSnapshot(ayanamsha, at, nodeMode);

  return bodies.map((id) => {
    const sign = snapshot.sign[id] ?? signOf(siderealLongitudeAt(id, ayanamsha, at, nodeMode));
    const houseFromMoon = ((sign - moonSign + 12) % 12) + 1;
    const houseFromLagna = ((sign - lagnaSign + 12) % 12) + 1;
    const isNode = id === "Ra" || id === "Ke";
    const good = isNode ? NODE_AUSPICIOUS_HOUSES : AUSPICIOUS_HOUSES[id] ?? [];
    const auspicious = good.includes(houseFromMoon);
    const vedhaBy = auspicious && !isNode ? vedhaBlocked(id, houseFromMoon, snapshot, moonSign) : null;
    const value = auspicious ? (vedhaBy ? 0 : 1) : GOCHARA_MALEFICS.includes(id) ? -1 : 0;

    const where = `${PLANET_NAMES[id]} transits the ${ordinal(houseFromMoon)} from your Moon`;
    const text = auspicious
      ? vedhaBy
        ? `${where} — an auspicious passage, but ${PLANET_NAMES[vedhaBy]} standing in its vedha house cancels the result`
        : `${where}, one of its favourable houses, with no vedha obstructing it`
      : GOCHARA_MALEFICS.includes(id)
        ? `${where}, outside its favourable set — a pressuring passage`
        : `${where}, neither favoured nor obstructive`;

    return { id, sign, houseFromMoon, houseFromLagna, auspicious, vedhaBy, value, text };
  });
}

/** Saturn's standing affliction (if any) at an instant, judged from the Moon. */
export function saturnStanceAt(chart: ChartData, ayanamsha: AyanamshaId, at: Date): SaturnStance {
  const moon = chart.planets.find((p) => p.id === "Mo");
  if (!moon) return null;
  const nodeMode: NodeMode = chart.meta.nodeMode ?? "mean";
  const sign = signOf(siderealLongitudeAt("Sa", ayanamsha, at, nodeMode));
  return SATURN_STANCE[((sign - moon.sign + 12) % 12) + 1] ?? null;
}

/**
 * A stretch of time during which a slow graha occupies one of a set of target
 * signs — the classical transit trigger inside a dasha window.
 */
export interface TransitContact {
  id: PlanetId;
  sign: number;
  start: Date;
  end: Date;
  /** Whole-sign house of `sign` counted from the Lagna. */
  houseFromLagna: number;
  /** Whole-sign house of `sign` counted from the natal Moon. */
  houseFromMoon: number;
}

/**
 * Every interval in [from, to] where one of `ids` stands in one of
 * `targetSigns`.
 *
 * Built on `occupancyIntervals`, so the cost is one ingress scan per body over
 * the whole window rather than daily sampling, and a retrograde re-entry into
 * a target sign correctly yields two contacts rather than one long one. Step
 * sizes match the bodies: Jupiter needs 3 days, Saturn and the nodes 5 —
 * neither can cross a sign inside a step. Contacts shorter than a month are
 * dropped: a retrograde graze across a cusp is not a passage over the house.
 */
export function transitContacts(
  chart: ChartData,
  ayanamsha: AyanamshaId,
  ids: PlanetId[],
  targetSigns: number[],
  from: Date,
  to: Date
): TransitContact[] {
  if (to <= from || !targetSigns.length) return [];
  const nodeMode: NodeMode = chart.meta.nodeMode ?? "mean";
  const out: TransitContact[] = [];
  for (const id of ids) {
    const intervals = occupancyIntervals(id, ayanamsha, from, to, contactStepDays(id), nodeMode);
    out.push(...contactsFromOccupancy(chart, id, intervals, targetSigns));
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Coarse ingress step that no body of interest can outrun inside one step. */
export function contactStepDays(id: PlanetId): number {
  return id === "Ju" ? 3 : 5;
}

/**
 * The filtering half of `transitContacts`, split out so a caller scanning many
 * themes over one lifetime can compute each body's occupancy once and reuse
 * it. `eventTiming.ts` does exactly that: two dozen events sharing four
 * ingress scans instead of running ninety-six.
 */
export function contactsFromOccupancy(
  chart: ChartData,
  id: PlanetId,
  intervals: OccupancyInterval[],
  targetSigns: number[]
): TransitContact[] {
  if (!targetSigns.length) return [];
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : chart.ascendant.sign;
  const lagnaSign = chart.ascendant.sign;
  const targets = new Set(targetSigns);

  const out: TransitContact[] = [];
  for (const iv of intervals) {
    if (!targets.has(iv.sign)) continue;
    if (iv.end.getTime() - iv.start.getTime() < 30 * DAY) continue;
    out.push({
      id,
      sign: iv.sign,
      start: iv.start,
      end: iv.end,
      houseFromLagna: ((iv.sign - lagnaSign + 12) % 12) + 1,
      houseFromMoon: ((iv.sign - moonSign + 12) % 12) + 1,
    });
  }
  return out;
}

/**
 * Fraction of [start, end] during which at least one contact is live.
 *
 * The union is taken, not the sum: two bodies contacting simultaneously are
 * one covered stretch, not two, and summing them would let coverage exceed 1
 * and silently inflate every score built on it.
 */
export function contactCoverage(contacts: TransitContact[], start: Date, end: Date): number {
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  const spans = contacts
    .map((c): [number, number] => [
      Math.max(c.start.getTime(), start.getTime()),
      Math.min(c.end.getTime(), end.getTime()),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = -Infinity;
  for (const [s, e] of spans) {
    const openFrom = Math.max(s, cursor);
    if (e > openFrom) covered += e - openFrom;
    cursor = Math.max(cursor, e);
  }
  return Math.min(1, covered / total);
}

/** All nine grahas' signs at an instant — the seam callers use for `gocharaAt`. */
export function snapshotAt(chart: ChartData, ayanamsha: AyanamshaId, at: Date): TransitSnapshot {
  return transitSnapshot(ayanamsha, at, chart.meta.nodeMode ?? "mean");
}

/**
 * How many grahas carry a derived auspicious-house set. Exists so the checks
 * harness can assert the derivation from `VEDHA_TABLE` still covers all seven
 * — a silent `{}` here would make every gochara reading read as neutral.
 */
export function auspiciousHouseCount(): number {
  return PLANETS.filter((id) => (AUSPICIOUS_HOUSES[id] ?? []).length > 0).length;
}
