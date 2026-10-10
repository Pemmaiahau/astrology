import { contributesBindu, type AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { computeAvasthas, type AvasthaSet } from "@/utils/astrology/avasthas";
import { charaDasha, type CharaPeriod } from "@/utils/astrology/charaDasha";
import { PLANETS } from "@/utils/astrology/constants";
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
import { yoginiDasha, type YoginiPeriod } from "@/utils/astrology/yogini";

/**
 * The expert layers of the Markdown export — computed only when someone
 * downloads the file, never on the always-on context cascade.
 *
 * Everything here is assembled from engine functions (`dasha.ts`, `yogini.ts`,
 * `charaDasha.ts`, `gochara.ts`, `sadeSati.ts`, `scan.ts`, `specialPoints.ts`,
 * `extendedYogas.ts`); this module adds no astrology of its own beyond the
 * small Tara/Chandra-bala and kakshya lookups below, which are table reads.
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
  };
}
