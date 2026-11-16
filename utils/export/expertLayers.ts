import { contributesBindu, type AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { tropicalAscMc } from "@/utils/astrology/ascendant";
import { computeAvasthas, type AvasthaSet } from "@/utils/astrology/avasthas";
import { getAyanamsha } from "@/utils/astrology/ayanamsha";
import { charaDasha, type CharaPeriod } from "@/utils/astrology/charaDasha";
import { DASHA_YEARS, PLANETS } from "@/utils/astrology/constants";
import { activeDashaAt, openingBalanceYears, subPeriodsOf, type ActiveDasha } from "@/utils/astrology/dasha";
import { dailySpeed, isRetrograde } from "@/utils/astrology/ephemeris";
import { detectExtendedYogas, type ExtendedFinding } from "@/utils/astrology/extendedYogas";
import { gocharaAt, saturnStanceAt, type GocharaResult, type SaturnStance } from "@/utils/astrology/gochara";
import { doubleTransitOnSign, type JaiminiInfo } from "@/utils/astrology/jaimini";
import { nakshatraOf, norm360, padaOf, separation } from "@/utils/astrology/math";
import { transitSnapshot } from "@/utils/astrology/rectification/transitFitness";
import { sadeSatiPeriods, type SadeSatiPeriod } from "@/utils/astrology/sadeSati";
import { retrogradeIntervals, signChangeEvents, type SignChange } from "@/utils/astrology/scan";
import { computeSpecialPoints, type SpecialPoints } from "@/utils/astrology/specialPoints";
import type { AyanamshaId, ChartData, DashaPeriod, NodeMode, PlanetId } from "@/utils/astrology/types";
import { VARGA_IDS, vargaSign, type VargaId } from "@/utils/astrology/varga";
import { yoginiDasha, type YoginiPeriod } from "@/utils/astrology/yogini";

/**
 * The expert layers of the Markdown export — computed only when someone
 * downloads the file, never on the always-on context cascade.
 *
 * Everything here is assembled from engine functions (`dasha.ts`, `yogini.ts`,
 * `charaDasha.ts`, `gochara.ts`, `sadeSati.ts`, `scan.ts`, `specialPoints.ts`,
 * `extendedYogas.ts`); this module adds no astrology of its own beyond the
 * small Tara/Chandra-bala and kakshya lookups below, which are table reads,
 * and the birth-time sensitivity scan, which re-runs the engine's own Lagna
 * and varga functions at neighbouring instants.
 */

const MONTH_MS = 30.4375 * 86400000;

export interface TransitRow {
  id: PlanetId;
  longitude: number;
  sign: number;
  nakshatra: number;
  pada: number;
  retrograde: boolean;
  speed: number;
  houseFromLagna: number;
  houseFromMoon: number;
  gochara: GocharaResult;
  /** Bindus in the planet's own BAV for the transited sign (7 grahas only). */
  bav: number | null;
  sav: number;
  /** Kakshya (1/8 of the sign) lord, and whether that contributor gave a bindu. */
  kakshya: { lord: PlanetId | "As"; index: number; bindu: boolean } | null;
}

export interface NatalContact {
  transit: PlanetId;
  natal: PlanetId | "As";
  kind: string;
  orb: number;
}

export interface TransitDetail {
  at: Date;
  rows: TransitRow[];
  contacts: NatalContact[];
  tara: { count: number; tara: number; name: string; favourable: boolean };
  chandraBala: { house: number; favourable: boolean };
  saturnStance: SaturnStance;
  sadeSati: SadeSatiPeriod[];
  /** Houses (from Lagna and from Moon) under the Jupiter–Saturn double transit now. */
  doubleTransit: { fromLagna: number[]; fromMoon: number[] };
  ingresses: SignChange[];
  retrogrades: { id: PlanetId; start: Date; end: Date }[];
  window: { from: Date; ingressTo: Date; retroTo: Date };
}

export interface ExpertLayers {
  dashaBalance: { lord: PlanetId; years: number } | null;
  sookshma: { pratyantar: DashaPeriod; periods: DashaPeriod[] }[];
  currentSookshma: DashaPeriod | null;
  yogini: YoginiPeriod[] | null;
  chara: CharaPeriod[] | null;
  special: SpecialPoints | null;
  transit: TransitDetail | null;
  extendedYogas: ExtendedFinding[];
  avasthas: AvasthaSet[];
  sensitivity: BirthTimeSensitivity | null;
}

/**
 * How far the recorded birth time can be wrong before a given part of the
 * chart changes. A reader told only "D-60 Lagna is Libra" cannot know that the
 * statement holds for two minutes either side of the stated time; this layer
 * says so, in minutes, so each technique can be weighted by how much of it
 * survives a realistic clock error.
 */
export interface BirthTimeSensitivity {
  /** Sidereal Lagna motion at birth, in degrees per minute of clock time. */
  lagnaDegPerMinute: number;
  /**
   * Per varga: how many minutes earlier / later the birth could have been with
   * the varga Lagna unchanged. Null means it holds past the scan horizon.
   */
  vargaLagna: { varga: VargaId; sign: number; earlier: number | null; later: number | null }[];
  /** Horizon of the varga-Lagna scan, in minutes either side of birth. */
  horizonMinutes: number;
  /**
   * Grahas whose sign, nakshatra or pada would differ had the birth been up to
   * `boundaryWindowMinutes` earlier or later. `minutes` is signed: negative =
   * an earlier birth changes it, positive = a later one.
   */
  boundaries: { id: PlanetId; kind: "sign" | "nakshatra" | "pada"; minutes: number; arc: number }[];
  boundaryWindowMinutes: number;
  /** The Lagna and grahas within 1° of a sign boundary (rashi sandhi). */
  sandhi: { id: PlanetId | "As"; sign: number; degInSign: number; fromBoundary: number }[];
  /** Vimshottari: days every dasha date moves per minute of birth-time error. */
  dashaDaysPerMinute: number | null;
}

const SENSITIVITY_HORIZON_MIN = 120;
const SENSITIVITY_STEP_SEC = 10;
const BOUNDARY_WINDOW_MIN = 30;
const SANDHI_ORB = 1;

/**
 * Ephemeris charts only: a manual chart's Lagna is typed in, not derived from
 * the clock, so "what if the clock were off" has no answer for it.
 */
function birthTimeSensitivity(chart: ChartData, ayanamsha: AyanamshaId): BirthTimeSensitivity | null {
  const { birthUtc, lat, lon } = chart;
  if (chart.meta.mode !== "auto" || !birthUtc || lat === undefined || lon === undefined) return null;
  const t0 = birthUtc.getTime();
  const ascAt = (ms: number): number => {
    const at = new Date(ms);
    return norm360(tropicalAscMc(at, lat, lon).asc - getAyanamsha(ayanamsha, at));
  };

  let rate = norm360(ascAt(t0 + 60000) - ascAt(t0 - 60000));
  if (rate > 180) rate -= 360;
  const lagnaDegPerMinute = rate / 2;

  // Walk outward from the birth instant in both directions, recording the
  // first step at which each varga's Lagna sign differs from the natal one.
  const natal = VARGA_IDS.map((v) => vargaSign(v, chart.ascendant.longitude));
  const first = (direction: 1 | -1): (number | null)[] => {
    const found: (number | null)[] = VARGA_IDS.map(() => null);
    const steps = (SENSITIVITY_HORIZON_MIN * 60) / SENSITIVITY_STEP_SEC;
    for (let i = 1; i <= steps && found.some((f) => f === null); i++) {
      const asc = ascAt(t0 + direction * i * SENSITIVITY_STEP_SEC * 1000);
      VARGA_IDS.forEach((v, k) => {
        if (found[k] === null && vargaSign(v, asc) !== natal[k]) found[k] = (i * SENSITIVITY_STEP_SEC) / 60;
      });
    }
    return found;
  };
  const later = first(1);
  const earlier = first(-1);

  const boundaries: BirthTimeSensitivity["boundaries"] = [];
  const widths: [BirthTimeSensitivity["boundaries"][number]["kind"], number][] = [
    ["sign", 30], ["nakshatra", 360 / 27], ["pada", 360 / 108],
  ];
  for (const p of chart.planets) {
    const perMinute = Math.abs(p.speed) / 1440;
    if (perMinute === 0) continue;
    // Sign, nakshatra and pada boundaries nest, so only the coarsest one that
    // a given crossing changes is reported.
    const seen = new Set<number>();
    for (const [kind, width] of widths) {
      const behind = norm360(p.longitude) % width;
      const ahead = width - behind;
      // Moving forward, a later birth meets the boundary ahead; retrograde, the one behind.
      const laterArc = p.speed >= 0 ? ahead : behind;
      const earlierArc = p.speed >= 0 ? behind : ahead;
      for (const [arc, sign] of [[laterArc, 1], [earlierArc, -1]] as const) {
        const minutes = arc / perMinute;
        if (minutes > BOUNDARY_WINDOW_MIN || seen.has(sign)) continue;
        seen.add(sign);
        boundaries.push({ id: p.id, kind, minutes: sign * minutes, arc });
      }
    }
  }

  const sandhi: BirthTimeSensitivity["sandhi"] = [];
  const near = (id: PlanetId | "As", longitude: number) => {
    const d = norm360(longitude) % 30;
    const fromBoundary = Math.min(d, 30 - d);
    if (fromBoundary <= SANDHI_ORB) sandhi.push({ id, sign: Math.floor(norm360(longitude) / 30), degInSign: d, fromBoundary });
  };
  near("As", chart.ascendant.longitude);
  for (const p of chart.planets) near(p.id, p.longitude);

  const moon = chart.planets.find((p) => p.id === "Mo");
  const dashaDaysPerMinute = moon
    ? (moon.speed / 1440 / (360 / 27)) * DASHA_YEARS[moon.nakshatraLord] * 365.25
    : null;

  return {
    lagnaDegPerMinute,
    vargaLagna: VARGA_IDS.map((varga, k) => ({ varga, sign: natal[k], earlier: earlier[k], later: later[k] })),
    horizonMinutes: SENSITIVITY_HORIZON_MIN,
    boundaries,
    boundaryWindowMinutes: BOUNDARY_WINDOW_MIN,
    sandhi,
    dashaDaysPerMinute,
  };
}

/** Kakshya lords in order across a sign, 3°45' each (Parashari order). */
const KAKSHYA_LORDS: (PlanetId | "As")[] = ["Sa", "Ju", "Ma", "Su", "Ve", "Me", "Mo", "As"];

const TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyak", "Sadhana", "Naidhana", "Mitra", "Parama Mitra"];
const TARA_GOOD = [2, 4, 6, 8, 9];
const CHANDRA_BALA_GOOD = [1, 3, 6, 7, 10, 11];

/** Degree-based Parashari aspects (angle from transit to natal, forward). */
const ASPECT_ANGLES: Partial<Record<PlanetId, [number, string][]>> = {
  Ma: [[90, "4th aspect"], [210, "8th aspect"]],
  Ju: [[120, "5th aspect"], [240, "9th aspect"]],
  Sa: [[60, "3rd aspect"], [270, "10th aspect"]],
  Ra: [[120, "5th aspect"], [240, "9th aspect"]],
  Ke: [[120, "5th aspect"], [240, "9th aspect"]],
};
const CONTACT_ORB = 3;

function transitDetail(
  chart: ChartData,
  ayanamsha: AyanamshaId,
  nodeMode: NodeMode,
  now: Date,
  ashtakavarga: AshtakavargaResult | null
): TransitDetail {
  const snap = transitSnapshot(ayanamsha, now, nodeMode);
  const gochara = gocharaAt(chart, ayanamsha, now, PLANETS, snap);
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : chart.ascendant.sign;
  const lagnaSign = chart.ascendant.sign;
  const natalSigns: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) natalSigns[p.id] = p.sign;

  const rows: TransitRow[] = PLANETS.map((id, i) => {
    const lon = snap.longitude[id];
    const sign = snap.sign[id];
    const k = Math.min(7, Math.floor((lon % 30) / 3.75));
    const isGraha = !["Ra", "Ke"].includes(id);
    return {
      id, longitude: lon, sign,
      nakshatra: nakshatraOf(lon), pada: padaOf(lon),
      retrograde: isRetrograde(id, now, nodeMode),
      speed: dailySpeed(id, now, nodeMode),
      houseFromLagna: ((sign - lagnaSign + 12) % 12) + 1,
      houseFromMoon: ((sign - moonSign + 12) % 12) + 1,
      gochara: gochara[i],
      bav: ashtakavarga && isGraha ? ashtakavarga.bav[id][sign] : null,
      sav: ashtakavarga ? ashtakavarga.sav[sign] : 0,
      kakshya: ashtakavarga && isGraha
        ? { lord: KAKSHYA_LORDS[k], index: k + 1, bindu: contributesBindu(id, KAKSHYA_LORDS[k], sign, natalSigns, lagnaSign) }
        : null,
    };
  });

  // Transit-to-natal contacts within 3°: conjunction, opposition (7th) and the
  // special aspects, measured by degree.
  const natalPoints: { id: PlanetId | "As"; lon: number }[] = [
    { id: "As", lon: chart.ascendant.longitude },
    ...chart.planets.map((p) => ({ id: p.id as PlanetId | "As", lon: p.longitude })),
  ];
  const contacts: NatalContact[] = [];
  for (const r of rows) {
    if (r.id === "Mo") continue; // the Moon contacts everything within days
    const angles: [number, string][] = [[0, "conjunction"], [180, "7th aspect"], ...(ASPECT_ANGLES[r.id] ?? [])];
    for (const n of natalPoints) {
      const fwd = norm360(n.lon - r.longitude);
      for (const [angle, kind] of angles) {
        const orb = separation(fwd, angle);
        if (orb <= CONTACT_ORB) contacts.push({ transit: r.id, natal: n.id, kind, orb });
      }
    }
  }
  contacts.sort((a, b) => a.orb - b.orb);

  const transitMoonNak = nakshatraOf(snap.longitude.Mo);
  const count = moon ? ((transitMoonNak - moon.nakshatra + 27) % 27) + 1 : 1;
  const tara = ((count - 1) % 9) + 1;
  const chandraHouse = ((snap.sign.Mo - moonSign + 12) % 12) + 1;

  const dtSigns = Array.from({ length: 12 }, (_, s) => s).filter((s) => doubleTransitOnSign(s, snap.sign.Ju, snap.sign.Sa));

  const ingressTo = new Date(now.getTime() + 24 * MONTH_MS);
  const retroTo = new Date(now.getTime() + 12 * MONTH_MS);
  const ingresses = (["Ma", "Ju", "Sa", "Ra", "Ke"] as PlanetId[])
    .flatMap((id) => signChangeEvents(id, ayanamsha, now, ingressTo, id === "Ma" ? 2 : 3, nodeMode))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const retrogrades = (["Me", "Ve", "Ma", "Ju", "Sa"] as PlanetId[])
    .flatMap((id) => retrogradeIntervals(id, ayanamsha, now, retroTo, 2, nodeMode).map((r) => ({ id, ...r })))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return {
    at: now,
    rows,
    contacts,
    tara: { count, tara, name: TARA_NAMES[tara - 1], favourable: TARA_GOOD.includes(tara) },
    chandraBala: { house: chandraHouse, favourable: CHANDRA_BALA_GOOD.includes(chandraHouse) },
    saturnStance: saturnStanceAt(chart, ayanamsha, now),
    sadeSati: sadeSatiPeriods(chart, ayanamsha, now),
    doubleTransit: {
      fromLagna: dtSigns.map((s) => ((s - lagnaSign + 12) % 12) + 1).sort((a, b) => a - b),
      fromMoon: dtSigns.map((s) => ((s - moonSign + 12) % 12) + 1).sort((a, b) => a - b),
    },
    ingresses,
    retrogrades,
    window: { from: now, ingressTo, retroTo },
  };
}

export function buildExpertLayers(input: {
  chart: ChartData;
  ayanamsha: AyanamshaId;
  nodeMode: NodeMode;
  now: Date;
  dashaTree: DashaPeriod[] | null;
  activeDasha: ActiveDasha | null;
  ashtakavarga: AshtakavargaResult | null;
  jaimini: JaiminiInfo | null;
}): ExpertLayers {
  const { chart, ayanamsha, nodeMode, now, dashaTree, activeDasha, ashtakavarga, jaimini } = input;
  const moon = chart.planets.find((p) => p.id === "Mo");
  const birth = chart.birthUtc;

  // Sookshma for the running Pratyantardasha and the one after it.
  const sookshma: ExpertLayers["sookshma"] = [];
  let currentSookshma: DashaPeriod | null = null;
  if (dashaTree && activeDasha) {
    const siblings = activeDasha.antar.children ?? [];
    const idx = siblings.indexOf(activeDasha.pratyantar);
    const next: DashaPeriod | undefined =
      siblings[idx + 1] ??
      activeDashaAt(dashaTree, new Date(activeDasha.pratyantar.end.getTime() + 1000))?.pratyantar;
    for (const pd of next ? [activeDasha.pratyantar, next] : [activeDasha.pratyantar]) {
      sookshma.push({ pratyantar: pd, periods: subPeriodsOf(pd) });
    }
    const t = now.getTime();
    currentSookshma = sookshma[0]?.periods.find((p) => t >= p.start.getTime() && t < p.end.getTime()) ?? null;
  }

  return {
    dashaBalance: dashaTree && birth ? openingBalanceYears(dashaTree, birth) : null,
    sookshma,
    currentSookshma,
    yogini: moon && birth ? yoginiDasha(moon.longitude, birth) : null,
    chara: birth ? charaDasha(chart, birth) : null,
    special: computeSpecialPoints(chart, ayanamsha),
    transit: transitDetail(chart, ayanamsha, nodeMode, now, ashtakavarga),
    extendedYogas: detectExtendedYogas(chart, jaimini),
    avasthas: computeAvasthas(chart),
    sensitivity: birthTimeSensitivity(chart, ayanamsha),
  };
}
