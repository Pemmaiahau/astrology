import { charaDasha, type CharaPeriod } from "./charaDasha";
import { PLANET_NAMES, SIGNS, SIGN_LORDS } from "./constants";
import { ordinal } from "./format";
import type { ChartData, PlanetId } from "./types";
import { yoginiDasha, type YoginiPeriod } from "./yogini";

/**
 * Cross-checks a Vimshottari timing window against the two other dasha
 * systems the export computes — Yogini (nakshatra-based, 36-year cycle) and
 * Jaimini Chara (sign-based). Classical practice treats an event as firm when
 * independent dasha systems agree on it; this module answers "do they?" for
 * one window and one life theme, and turns the answer into weighted reasons.
 *
 * Read at the window's midpoint, against the theme's ANCHOR house (the first
 * house in the list) and its karakas only:
 *   Yogini — the running Yogini mahadasha / antardasha lord rules or occupies
 *            the anchor house, or is a karaka.
 *   Chara  — the running Chara mahadasha / antardasha sign is the anchor
 *            house's sign, or holds its lord or a karaka.
 * Weights per system: +4 when one level agrees, +7 when both do; −10 when
 * neither system supports the window. Calibrated on a 150-chart sample so the
 * cross-check is close to neutral on average (+1…+2 across marriage, career
 * and foreign themes) instead of lifting every window: ~27% of periods get no
 * support, ~50% one system, ~22% both.
 *
 * The weights are a modern synthesis, like every other blend in the timing
 * layer; the reasons name each system so a reader can discount it.
 */

export interface ConfirmContext {
  chart: ChartData;
  yogini: YoginiPeriod[];
  chara: CharaPeriod[];
}

export interface ConfirmResult {
  yogini: boolean;
  chara: boolean;
  weight: number;
  reasons: { text: string; weight: number }[];
}

export function buildConfirmContext(chart: ChartData): ConfirmContext | null {
  const moon = chart.planets.find((p) => p.id === "Mo");
  if (!moon || !chart.birthUtc) return null;
  return { chart, yogini: yoginiDasha(moon.longitude, chart.birthUtc), chara: charaDasha(chart, chart.birthUtc) };
}

/**
 * Deliberately tighter than the Vimshottari connection test. Only the theme's
 * ANCHOR house (the first in the list — the 7th for marriage, the 10th for
 * career) and its karakas count, and aspects do not: with three houses and
 * aspects allowed, ~94% of all periods "confirmed" on a 150-chart sample, which
 * made the cross-check add the same bonus to everything.
 */
function connects(chart: ChartData, id: PlanetId, anchor: number, karakas: PlanetId[]): boolean {
  const sign = (chart.ascendant.sign + anchor - 1) % 12;
  if (karakas.includes(id)) return true;
  if (SIGN_LORDS[sign] === id) return true;
  return chart.planets.find((q) => q.id === id)?.sign === sign;
}

function charaActivates(chart: ChartData, sign: number, anchor: number, karakas: PlanetId[]): boolean {
  const anchorSign = (chart.ascendant.sign + anchor - 1) % 12;
  if (sign === anchorSign) return true;
  return chart.planets.some((p) => p.sign === sign && (p.id === SIGN_LORDS[anchorSign] || karakas.includes(p.id)));
}

const at = <T extends { start: Date; end: Date }>(list: T[] | undefined, t: number): T | undefined =>
  list?.find((p) => t >= p.start.getTime() && t < p.end.getTime());

export function confirmWindow(
  ctx: ConfirmContext,
  start: Date,
  end: Date,
  houses: number[],
  karakas: PlanetId[] = []
): ConfirmResult {
  const mid = (start.getTime() + end.getTime()) / 2;
  const reasons: ConfirmResult["reasons"] = [];
  const anchor = houses[0];
  if (anchor === undefined) return { yogini: false, chara: false, weight: 0, reasons };
  const lagna = ctx.chart.ascendant.sign;

  const ym = at(ctx.yogini, mid);
  const ya = at(ym?.children, mid);
  const yLevels = [ym, ya].filter((p): p is YoginiPeriod => Boolean(p) && connects(ctx.chart, p!.yogini.lord, anchor, karakas));
  if (yLevels.length) {
    const w = yLevels.length === 2 ? 7 : 4;
    reasons.push({
      text: `Yogini dasha agrees: ${yLevels.map((p) => `${p.yogini.name} (${PLANET_NAMES[p.yogini.lord]}) ${p.level === 1 ? "mahadasha" : "antardasha"}`).join(" and ")} connects to this theme`,
      weight: w,
    });
  }

  const cm = at(ctx.chara, mid);
  const ca = cm?.antardashas.find((a) => mid >= a.start.getTime() && mid < a.end.getTime());
  const cLevels: { sign: number; level: string }[] = [];
  if (cm && charaActivates(ctx.chart, cm.sign, anchor, karakas)) cLevels.push({ sign: cm.sign, level: "mahadasha" });
  if (ca && charaActivates(ctx.chart, ca.sign, anchor, karakas)) cLevels.push({ sign: ca.sign, level: "antardasha" });
  if (cLevels.length) {
    const w = cLevels.length === 2 ? 7 : 4;
    reasons.push({
      text: `Chara dasha agrees: ${cLevels.map((c) => `${SIGNS[c.sign]} ${c.level} (your ${ordinal(((c.sign - lagna + 12) % 12) + 1)} house)`).join(" and ")} activates this theme`,
      weight: w,
    });
  }

  if (!yLevels.length && !cLevels.length) {
    reasons.push({ text: "Neither Yogini nor Chara dasha supports this stretch — Vimshottari stands alone", weight: -10 });
  }
  return {
    yogini: yLevels.length > 0,
    chara: cLevels.length > 0,
    weight: reasons.reduce((s, r) => s + r.weight, 0),
    reasons,
  };
}

/** For display: the Yogini and Chara periods running at an instant. */
export function conditionalDashaLabel(ctx: ConfirmContext, when: Date): string | null {
  const t = when.getTime();
  const ym = at(ctx.yogini, t);
  const ya = at(ym?.children, t);
  const cm = at(ctx.chara, t);
  const ca = cm?.antardashas.find((a) => t >= a.start.getTime() && t < a.end.getTime());
  if (!ym && !cm) return null;
  const y = ym ? `Yogini ${ym.yogini.name}${ya ? `–${ya.yogini.name}` : ""}` : null;
  const c = cm ? `Chara ${SIGNS[cm.sign]}${ca ? `–${SIGNS[ca.sign]}` : ""}` : null;
  return [y, c].filter(Boolean).join(" · ");
}

