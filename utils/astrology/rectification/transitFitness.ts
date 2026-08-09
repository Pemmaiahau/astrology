import { PLANETS, type PlanetId7 } from "../constants";
import { doubleTransitOnSign } from "../jaimini";
import { signOf } from "../math";
import { siderealLongitudeAt } from "../scan";
import { SIGN_LORDS } from "../constants";
import { aspectedSigns } from "../aspects";
import type { AyanamshaId, ChartData, Gender, NodeMode, PlanetId } from "../types";
import { EVENT_RULES, resolveHouses } from "./eventRules";
import type { EventType, FitnessComponent, RectifyReason } from "./types";

/**
 * Gochara (transit) confirmation for a life event.
 *
 * Classical convention, not reversed: transits are judged FROM THE NATAL MOON
 * (Chandra Lagna) first and from the Lagna second — BPHS Gochara adhyaya,
 * Phaladeepika ch. 26. The engine's own `sadeSatiPhase` uses the same
 * house-from-Moon frame.
 *
 * A transit's result is not read in isolation: the classical *vedha*
 * (obstruction) table cancels an otherwise auspicious transit when another
 * graha occupies the obstructing house counted from the same Moon. Skipping
 * vedha is what separates a real Gochara implementation from a toy one, so it
 * is applied here as a hard cancellation, not a soft discount.
 *
 * NOTE ON RESOLUTION: a transit snapshot depends on the event instant and the
 * ayanamsha, NOT on the candidate birth minute — the candidate enters only
 * through the natal Moon sign and Lagna sign, which almost never move inside
 * ±15 minutes. Transit fitness is therefore an ayanamsha-robust check that the
 * event was correctly *classified*, and a weak discriminator of the minute.
 * The scorer weights it accordingly and the report says so.
 */

// --- Tunable weights -------------------------------------------------------

export const TRANSIT_WEIGHTS = {
  /** Guru–Shani double transit: the strongest classical confirmation. */
  doubleTransit: 0.38,
  /** Jupiter's own transit over the bhava, its lord, or the karaka. */
  jupiter: 0.22,
  /** Saturn's stance — Sade Sati, Kantaka/Ashtama Shani. */
  saturn: 0.22,
  /** Rahu/Ketu over the Lagna, the Moon or the karaka. */
  nodes: 0.18,
};

/** The Moon frame leads; the Lagna frame corroborates. */
const FRAME_WEIGHT = { moon: 0.6, lagna: 0.4 };

// --- Classical vedha table -------------------------------------------------

/**
 * Gochara vedha (Phaladeepika ch. 26; the same table appears in the BPHS
 * Gochara chapter). For each graha, the houses counted from the natal Moon in
 * which its transit is auspicious, mapped to the house whose occupation by
 * another graha CANCELS that result.
 *
 * Two classical exceptions apply and are implemented in `vedhaBlocked`:
 * the Sun and Saturn never obstruct each other, and neither do the Moon and
 * Mercury. Rahu and Ketu are given no vedha of their own — the table is a
 * seven-graha table and extending it would be invention, not tradition.
 */
export const VEDHA_TABLE: Record<PlanetId7, Record<number, number>> = {
  Su: { 3: 9, 6: 12, 10: 4, 11: 5 },
  Mo: { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8 },
  Ma: { 3: 12, 6: 9, 11: 5 },
  Me: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12 },
  Ju: { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8 },
  Ve: { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 3, 12: 6 },
  Sa: { 3: 12, 6: 9, 11: 5 },
};

const VEDHA_EXEMPT: [PlanetId, PlanetId][] = [
  ["Su", "Sa"],
  ["Mo", "Me"],
];

function exempt(a: PlanetId, b: PlanetId): boolean {
  return VEDHA_EXEMPT.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// --- Snapshot --------------------------------------------------------------

export interface TransitSnapshot {
  ms: number;
  ayanamsha: AyanamshaId;
  longitude: Record<PlanetId, number>;
  sign: Record<PlanetId, number>;
}

/**
 * All nine grahas' sidereal positions at an instant. Candidate-independent, so
 * the orchestrator computes one of these per (ayanamsha, event sample) and
 * reuses it across all 31 candidate minutes.
 */
export function transitSnapshot(
  ayanamsha: AyanamshaId,
  at: Date,
  nodeMode: NodeMode = "mean"
): TransitSnapshot {
  const longitude = {} as Record<PlanetId, number>;
  const sign = {} as Record<PlanetId, number>;
  for (const id of PLANETS) {
    const lon = siderealLongitudeAt(id, ayanamsha, at, nodeMode);
    longitude[id] = lon;
    sign[id] = signOf(lon);
  }
  return { ms: at.getTime(), ayanamsha, longitude, sign };
}

/**
 * Is `graha`'s auspicious transit at `house` (counted from the Moon) cancelled
 * by another graha standing in its vedha house?
 */
export function vedhaBlocked(
  graha: PlanetId,
  houseFromMoon: number,
  snap: TransitSnapshot,
  moonSign: number
): PlanetId | null {
  const table = VEDHA_TABLE[graha as PlanetId7];
  if (!table) return null;
  const vedhaHouse = table[houseFromMoon];
  if (!vedhaHouse) return null;
  const vedhaSign = (moonSign + vedhaHouse - 1) % 12;
  for (const other of PLANETS) {
    if (other === graha) continue;
    if (!VEDHA_TABLE[other as PlanetId7]) continue; // nodes cause no vedha
    if (exempt(graha, other)) continue;
    if (snap.sign[other] === vedhaSign) return other;
  }
  return null;
}

// ---------------------------------------------------------------------------

function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/** Does a body at `fromSign` occupy or cast graha drishti on `sign`? */
function influences(id: PlanetId, fromSign: number, sign: number): boolean {
  return fromSign === sign || aspectedSigns(id, fromSign).includes(sign);
}

export interface TransitFitness extends FitnessComponent {
  doubleTransit: boolean;
  sadeSati: "rising" | "peak" | "setting" | null;
  kantaka: boolean;
  /** Auspicious transits that the vedha table cancelled. */
  vedhaCancellations: { graha: PlanetId; house: number; blockedBy: PlanetId }[];
}

export function transitFitness(
  chart: ChartData,
  snap: TransitSnapshot,
  type: EventType,
  gender: Gender | undefined
): TransitFitness {
  const rule = EVENT_RULES[type];
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : chart.ascendant.sign;
  const lagnaSign = chart.ascendant.sign;
  const primary = resolveHouses(rule.primaryHouses);
  const dtHouses = rule.transit.doubleTransitHouses
    ? resolveHouses(rule.transit.doubleTransitHouses)
    : primary;

  const reasons: RectifyReason[] = [];
  const vedhaCancellations: TransitFitness["vedhaCancellations"] = [];
  let score = 0;

  const juSign = snap.sign.Ju;
  const saSign = snap.sign.Sa;
  const houseFrom = (sign: number, base: number) => ((sign - base + 12) % 12) + 1;

  // --- 1. Guru–Shani double transit -----------------------------------------
  const dtMoon = dtHouses.filter((h) => doubleTransitOnSign((moonSign + h - 1) % 12, juSign, saSign));
  const dtLagna = dtHouses.filter((h) => doubleTransitOnSign((lagnaSign + h - 1) % 12, juSign, saSign));
  const dtRaw = (dtMoon.length ? FRAME_WEIGHT.moon : 0) + (dtLagna.length ? FRAME_WEIGHT.lagna : 0);
  const doubleTransit = dtRaw > 0;
  if (doubleTransit) {
    score += TRANSIT_WEIGHTS.doubleTransit * dtRaw;
    reasons.push({
      text:
        `Jupiter and Saturn jointly influence the ${[...new Set([...dtMoon, ...dtLagna])].map(ord).join(" and ")}` +
        `${dtMoon.length ? " from the natal Moon" : ""}${dtMoon.length && dtLagna.length ? " and" : ""}` +
        `${dtLagna.length ? " from the Lagna" : ""} — the classical double transit.`,
      weight: Math.round(TRANSIT_WEIGHTS.doubleTransit * dtRaw * 100) / 100,
      source: { work: "Applied Parashari practice (double-transit gate)" },
    });
  } else {
    reasons.push({
      text: "Neither frame shows the Saturn–Jupiter double transit on this event's bhava.",
      weight: -0.05,
    });
  }

  // --- 2. Jupiter's own transit ---------------------------------------------
  // Over the bhava itself, over its lord's natal sign, or over the karaka.
  const karakas = [...rule.karakas, ...(gender === "female" ? rule.karakasFemale ?? [] : [])];
  const juTargets: { sign: number; label: string }[] = [];
  for (const h of primary) {
    juTargets.push({ sign: (moonSign + h - 1) % 12, label: `the ${ord(h)} from the Moon` });
    const lordId = SIGN_LORDS[(lagnaSign + h - 1) % 12];
    const lord = chart.planets.find((p) => p.id === lordId);
    if (lord) juTargets.push({ sign: lord.sign, label: `natal ${lordId}, lord of the ${ord(h)}` });
  }
  for (const k of [...karakas, ...rule.transit.jupiterContacts]) {
    const p = chart.planets.find((q) => q.id === k);
    if (p) juTargets.push({ sign: p.sign, label: `natal ${k}` });
  }
  const juHits = juTargets.filter((t) => influences("Ju", juSign, t.sign));
  if (juHits.length) {
    const juHouseFromMoon = houseFrom(juSign, moonSign);
    const blocked = vedhaBlocked("Ju", juHouseFromMoon, snap, moonSign);
    if (blocked) {
      vedhaCancellations.push({ graha: "Ju", house: juHouseFromMoon, blockedBy: blocked });
      reasons.push({
        text: `Jupiter's transit of the ${ord(juHouseFromMoon)} from the Moon is cancelled by vedha — ${blocked} stands in the obstructing ${ord(VEDHA_TABLE.Ju[juHouseFromMoon])}.`,
        weight: -0.08,
        source: { work: "Phaladeepika", ref: "ch. 26 (Gochara vedha)" },
      });
    } else {
      const frac = Math.min(1, juHits.length / 2);
      score += TRANSIT_WEIGHTS.jupiter * frac;
      reasons.push({
        text: `Jupiter transits or aspects ${juHits.slice(0, 2).map((t) => t.label).join(" and ")}.`,
        weight: Math.round(TRANSIT_WEIGHTS.jupiter * frac * 100) / 100,
        source: { work: "Brihat Parashara Hora Shastra", ref: "Gochara adhyaya" },
      });
    }
  }

  // --- 3. Saturn's stance ----------------------------------------------------
  const saHouseFromMoon = houseFrom(saSign, moonSign);
  const sadeSati: TransitFitness["sadeSati"] =
    saHouseFromMoon === 12 ? "rising" : saHouseFromMoon === 1 ? "peak" : saHouseFromMoon === 2 ? "setting" : null;
  const kantaka = saHouseFromMoon === 4 || saHouseFromMoon === 8 || saHouseFromMoon === 10;

  if (rule.transit.sadeSati === "expected" && sadeSati) {
    score += TRANSIT_WEIGHTS.saturn * 0.6;
    reasons.push({
      text: `Sade Sati is running (${sadeSati} phase, Saturn in the ${ord(saHouseFromMoon)} from the Moon), which this kind of event classically accompanies.`,
      weight: Math.round(TRANSIT_WEIGHTS.saturn * 0.6 * 100) / 100,
      source: { work: "Brihat Parashara Hora Shastra", ref: "Gochara adhyaya" },
    });
  } else if (rule.transit.sadeSati === "contrary" && sadeSati) {
    score -= TRANSIT_WEIGHTS.saturn * 0.5;
    reasons.push({
      text: `Sade Sati is running (${sadeSati} phase) — classically a period of weight and delay, which argues against this event landing here.`,
      weight: -Math.round(TRANSIT_WEIGHTS.saturn * 0.5 * 100) / 100,
      source: { work: "Brihat Parashara Hora Shastra", ref: "Gochara adhyaya" },
    });
  }
  if (rule.transit.kantaka === "expected" && kantaka) {
    const blocked = vedhaBlocked("Sa", saHouseFromMoon, snap, moonSign);
    score += TRANSIT_WEIGHTS.saturn * 0.4;
    reasons.push({
      text: `${saHouseFromMoon === 8 ? "Ashtama" : "Kantaka"} Shani — Saturn in the ${ord(saHouseFromMoon)} from the Moon, the classical obstruction transit.${blocked ? ` (${blocked} sits in its vedha house, softening it.)` : ""}`,
      weight: Math.round(TRANSIT_WEIGHTS.saturn * 0.4 * 100) / 100,
      source: { work: "Phaladeepika", ref: "ch. 26" },
    });
  } else if (rule.transit.sadeSati === "contrary" && kantaka) {
    score -= TRANSIT_WEIGHTS.saturn * 0.25;
    reasons.push({
      text: `Saturn holds the ${ord(saHouseFromMoon)} from the Moon (Kantaka/Ashtama), which obstructs rather than opens.`,
      weight: -Math.round(TRANSIT_WEIGHTS.saturn * 0.25 * 100) / 100,
    });
  }

  // Saturn on the bhava itself, read through the vedha table.
  const saOnBhava = primary.filter((h) => influences("Sa", saSign, (moonSign + h - 1) % 12));
  if (saOnBhava.length && VEDHA_TABLE.Sa[saHouseFromMoon]) {
    const blocked = vedhaBlocked("Sa", saHouseFromMoon, snap, moonSign);
    if (blocked) {
      vedhaCancellations.push({ graha: "Sa", house: saHouseFromMoon, blockedBy: blocked });
      reasons.push({
        text: `Saturn's auspicious ${ord(saHouseFromMoon)}-from-Moon transit is cancelled by vedha from ${blocked}.`,
        weight: -0.05,
        source: { work: "Phaladeepika", ref: "ch. 26 (Gochara vedha)" },
      });
    }
  }

  // --- 4. Rahu/Ketu contact --------------------------------------------------
  if (rule.transit.nodeContact) {
    const nodeTargets: { sign: number; label: string }[] = [
      { sign: lagnaSign, label: "the Lagna" },
      { sign: moonSign, label: "the natal Moon" },
    ];
    for (const k of karakas) {
      const p = chart.planets.find((q) => q.id === k);
      if (p) nodeTargets.push({ sign: p.sign, label: `natal ${k}` });
    }
    const hits: string[] = [];
    for (const n of ["Ra", "Ke"] as PlanetId[]) {
      for (const t of nodeTargets) {
        if (snap.sign[n] === t.sign) hits.push(`${n} over ${t.label}`);
      }
    }
    if (hits.length) {
      const frac = Math.min(1, hits.length / 2);
      score += TRANSIT_WEIGHTS.nodes * frac;
      reasons.push({
        text: `${hits.slice(0, 2).join(" and ")} — the nodal signature of a sudden or unconventional turn.`,
        weight: Math.round(TRANSIT_WEIGHTS.nodes * frac * 100) / 100,
        source: { work: "Brihat Parashara Hora Shastra", ref: "Gochara adhyaya" },
      });
    }
  }

  return {
    score: Math.max(0, Math.min(1, score)),
    reasons,
    doubleTransit,
    sadeSati,
    kantaka,
    vedhaCancellations,
  };
}
