import { HOUSE_SIGNIFICATIONS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import { activeDashaAt } from "@/utils/astrology/dasha";
import { boundariesWithin, periodsOverlapping, signChangeEvents } from "@/utils/astrology/scan";
import { currentTransits, sadeSatiPhase } from "@/utils/astrology/transits";
import type {
  AyanamshaId,
  ChartData,
  DashaPeriod,
  PlanetId,
  TransitInfo,
} from "@/utils/astrology/types";
import { DASHA_THEMES, TRANSIT_TABLES } from "./transitTexts";
import { dashaLordAssessment } from "./predictions";
import { ordinal } from "./synthesis";

/**
 * Year-forecast engine. Given any [start, end] window (a Gregorian calendar
 * year, or a birthday-to-birthday solar-return year), it produces:
 *   1. a year overview  — the running Mahadasha(s) + Sade Sati for the span,
 *   2. a segmented timeline — the window cut at every Antardasha change and
 *      every slow-planet (Ju/Sa/Ra/Ke) sign ingress, each segment carrying
 *      its antardasha assessment, active slow transits and the pratyantardasha
 *      sequence running inside it,
 *   3. a 12-month breakdown — fast transits (Sun/Mars) + the operative
 *      sub-period for each month of the window.
 *
 * Everything is a pure function of the chart, dasha tree, ayanamsha and dates,
 * so it works identically for past and future years.
 */

const DAY = 86400000;

const clampDate = (d: Date, lo: Date, hi: Date): Date =>
  new Date(Math.min(Math.max(d.getTime(), lo.getTime()), hi.getTime()));

function firstSentence(text: string): string {
  const i = text.indexOf(". ");
  return i === -1 ? text : text.slice(0, i + 1);
}

const SLOW_BODIES: PlanetId[] = ["Ju", "Sa", "Ra", "Ke"];

const SADE_SATI_TEXT: Record<"rising" | "peak" | "setting", string> = {
  rising:
    "Sade Sati is in its opening (rising) phase this year — Saturn in the 12th from the natal Moon. Expenses and inner restlessness lead; front-load savings and simplify commitments.",
  peak: "Sade Sati is at its peak this year, Saturn transiting the natal Moon itself — the deepest stretch of the seven-and-a-half-year audit. Guard health and morale and defer irreversible decisions where you can.",
  setting:
    "Sade Sati is in its closing (setting) phase this year — Saturn in the 2nd from the natal Moon. The audit's ledger is being ruled off; burdens visibly lighten as the phase completes.",
};

// --- Year overview -----------------------------------------------------------

export interface MahaSegment {
  lord: PlanetId;
  start: Date; // clamped to the window
  end: Date; // clamped to the window
  text: string;
}

// --- Segmented timeline ------------------------------------------------------

export interface TransitLine {
  id: PlanetId;
  sign: number;
  houseFromMoon: number;
  houseFromLagna: number;
  retrograde: boolean;
  text: string;
}

export interface PratyantarLine {
  lord: PlanetId;
  start: Date; // clamped to the segment
  end: Date; // clamped to the segment
  theme: string;
}

export interface TimelineSegment {
  start: Date;
  end: Date;
  boundaryReason: string;
  maha?: PlanetId;
  antar?: PlanetId;
  antarText?: string;
  transits: TransitLine[];
  pratyantars: PratyantarLine[];
}

// --- Monthly breakdown -------------------------------------------------------

export interface MonthBlock {
  label: string;
  start: Date;
  end: Date;
  dashaLine?: string;
  paragraphs: string[];
}

export interface YearForecast {
  window: { start: Date; end: Date };
  hasDasha: boolean;
  beforeBirth: boolean;
  mahaSegments: MahaSegment[];
  sadeSati: "rising" | "peak" | "setting" | null;
  sadeSatiText?: string;
  timeline: TimelineSegment[];
  months: MonthBlock[];
}

function slowTransitLines(chart: ChartData, ayanamsha: AyanamshaId, at: Date): TransitLine[] {
  const transits = currentTransits(chart, ayanamsha, at);
  const lines: TransitLine[] = [];
  for (const id of SLOW_BODIES) {
    const t = transits.find((x) => x.id === id);
    const table = TRANSIT_TABLES[id];
    if (!t || !table) continue;
    lines.push({
      id,
      sign: t.sign,
      houseFromMoon: t.houseFromMoon,
      houseFromLagna: t.houseFromLagna,
      retrograde: t.retrograde,
      text: table[t.houseFromMoon - 1],
    });
  }
  return lines;
}

function pratyantarsIn(
  dashaTree: DashaPeriod[],
  segStart: Date,
  segEnd: Date
): PratyantarLine[] {
  return periodsOverlapping(dashaTree, 3, segStart, segEnd).map((p) => ({
    lord: p.lord,
    start: clampDate(p.start, segStart, segEnd),
    end: clampDate(p.end, segStart, segEnd),
    theme: firstSentence(DASHA_THEMES[p.lord]),
  }));
}

export function buildYearForecast(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  start: Date,
  end: Date
): YearForecast {
  const hasDasha = Boolean(dashaTree && chart.birthUtc);
  const beforeBirth = Boolean(chart.birthUtc && end.getTime() <= chart.birthUtc.getTime());

  // Sade Sati assessed at the window midpoint.
  const midYear = new Date((start.getTime() + end.getTime()) / 2);
  const sadeSati = sadeSatiPhase(currentTransits(chart, ayanamsha, midYear));

  // Mahadasha segment(s) spanning the window.
  const mahaSegments: MahaSegment[] = [];
  if (dashaTree) {
    for (const md of periodsOverlapping(dashaTree, 1, start, end)) {
      mahaSegments.push({
        lord: md.lord,
        start: clampDate(md.start, start, end),
        end: clampDate(md.end, start, end),
        text: dashaLordAssessment(chart, md.lord, `Mahadasha of ${PLANET_NAMES[md.lord]}`),
      });
    }
  }

  // Gather segment boundaries: slow-transit ingresses + antardasha changes.
  const boundaries: { t: number; reason: string }[] = [];
  for (const id of SLOW_BODIES) {
    for (const ev of signChangeEvents(id, ayanamsha, start, end)) {
      boundaries.push({
        t: ev.date.getTime(),
        reason: `${PLANET_NAMES[id]} enters ${SIGNS[ev.toSign]}${ev.retrograde ? " (retrograde)" : ""}`,
      });
    }
  }
  if (dashaTree) {
    for (const md of periodsOverlapping(dashaTree, 1, start, end)) {
      const st = md.start.getTime();
      if (st > start.getTime() && st < end.getTime()) {
        boundaries.push({ t: st, reason: `Mahadasha changes to ${PLANET_NAMES[md.lord]}` });
      }
    }
    for (const t of boundariesWithin(dashaTree, 2, start, end)) {
      const active = activeDashaAt(dashaTree, new Date(t + 60000));
      boundaries.push({
        t,
        reason: active ? `Antardasha changes to ${PLANET_NAMES[active.antar.lord]}` : "Antardasha change",
      });
    }
  }
  boundaries.sort((a, b) => a.t - b.t);

  // Merge boundaries within 2 days so a near-simultaneous dasha + ingress
  // does not create a sliver segment.
  const merged: { t: number; reason: string }[] = [];
  for (const b of boundaries) {
    const last = merged[merged.length - 1];
    if (last && b.t - last.t < 2 * DAY) last.reason += "; " + b.reason;
    else merged.push({ ...b });
  }

  const edges = [start.getTime(), ...merged.map((m) => m.t), end.getTime()];
  const reasons = ["Window begins", ...merged.map((m) => m.reason)];

  const timeline: TimelineSegment[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const segStart = new Date(edges[i]);
    const segEnd = new Date(edges[i + 1]);
    if (segEnd.getTime() - segStart.getTime() < 12 * 3600000) continue; // drop <12h slivers
    const mid = new Date((edges[i] + edges[i + 1]) / 2);

    const active = hasDasha ? activeDashaAt(dashaTree!, mid) : null;
    timeline.push({
      start: segStart,
      end: segEnd,
      boundaryReason: reasons[i],
      maha: active?.maha.lord,
      antar: active?.antar.lord,
      antarText: active
        ? dashaLordAssessment(chart, active.antar.lord, `Antardasha of ${PLANET_NAMES[active.antar.lord]}`)
        : undefined,
      transits: slowTransitLines(chart, ayanamsha, mid),
      pratyantars: hasDasha ? pratyantarsIn(dashaTree!, segStart, segEnd) : [],
    });
  }

  return {
    window: { start, end },
    hasDasha,
    beforeBirth,
    mahaSegments,
    sadeSati,
    sadeSatiText: sadeSati ? SADE_SATI_TEXT[sadeSati] : undefined,
    timeline,
    months: buildMonthlyBreakdown(chart, dashaTree, ayanamsha, start, end),
  };
}

function fastTransitParagraphs(transits: TransitInfo[]): string[] {
  const out: string[] = [];
  const su = transits.find((t) => t.id === "Su");
  const ma = transits.find((t) => t.id === "Ma");
  if (su) {
    out.push(
      `The Sun energises your ${ordinal(su.houseFromLagna)} house — visibility, decisions and authority-dealings concentrate on ${HOUSE_SIGNIFICATIONS[su.houseFromLagna - 1].split(",")[0]}.`
    );
  }
  if (ma) {
    out.push(
      `Mars drives through your ${ordinal(ma.houseFromLagna)} house${ma.retrograde ? " (retrograde)" : ""}: heat, urgency and initiative pressure in ${HOUSE_SIGNIFICATIONS[ma.houseFromLagna - 1].split(",")[0]}.`
    );
  }
  return out;
}

export function buildMonthlyBreakdown(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  start: Date,
  end: Date
): MonthBlock[] {
  const hasDasha = Boolean(dashaTree && chart.birthUtc);
  const blocks: MonthBlock[] = [];
  const cursor = new Date(start);

  for (let i = 0; i < 12 && cursor.getTime() < end.getTime(); i++) {
    const next = new Date(cursor);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const blockEnd = next.getTime() > end.getTime() ? new Date(end) : next;
    const mid = new Date((cursor.getTime() + blockEnd.getTime()) / 2);

    const transits = currentTransits(chart, ayanamsha, mid);
    let dashaLine: string | undefined;
    if (hasDasha) {
      const active = activeDashaAt(dashaTree!, mid);
      if (active) {
        dashaLine = `${PLANET_NAMES[active.maha.lord]} – ${PLANET_NAMES[active.antar.lord]} – ${PLANET_NAMES[active.pratyantar.lord]} (Maha – Antar – Pratyantar)`;
      }
    }

    blocks.push({
      label: mid.toLocaleString("en-US", { month: "long", year: "numeric" }),
      start: new Date(cursor),
      end: blockEnd,
      dashaLine,
      paragraphs: fastTransitParagraphs(transits),
    });

    cursor.setTime(next.getTime());
  }
  return blocks;
}
