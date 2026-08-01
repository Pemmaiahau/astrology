import {
  DIURNAL_PLANETS,
  EXALTATION,
  isOddSign,
  MOOLATRIKONA,
  NAISARGIKA_BALA,
  OWN_SIGNS,
  PLANET_GENDER,
  SHADBALA_MINIMUM,
  SHADBALA_PLANETS,
  SIGN_LORDS,
  VARA_LORDS,
  type PlanetId7,
} from "./constants";
import { declination, nextSunrise, sunriseFor, sunsetFor } from "./ephemeris";
import { norm360, separation, signOf } from "./math";
import { naturalRelation, temporalRelation } from "./states";
import type { ChartData, PlanetId, PlanetPosition } from "./types";
import { vargaSign, type VargaId, type VargaSet } from "./varga";

/**
 * Shadbala — the classical six-fold strength — per BPHS (Shadbala adhyaya).
 *
 * All values are in virupas (60 virupas = 1 rupa). The six limbs:
 *   1. Sthana  (positional): Uchcha, Saptavargaja, Ojha-Yugma, Kendradi, Drekkana
 *   2. Dig     (directional)
 *   3. Kala    (temporal): Nathonnatha, Paksha, Tribhaga, Abda/Masa/Vara/Hora,
 *               Ayana, Yuddha
 *   4. Cheshta (motional)
 *   5. Naisargika (natural)
 *   6. Drik    (aspectual)
 *
 * Only the seven classical planets take Shadbala; Rahu/Ketu are excluded.
 * Requires a real birth anchor (time + place): returns null otherwise, and
 * consumers fall back to the heuristic composite in strength.ts.
 *
 * Implementation notes on deliberate approximations (all flagged inline):
 * - Nathonnatha/Tribhaga use temporal (seasonal) hours anchored on the actual
 *   sunrise/sunset arcs rather than ghatis from apparent midnight.
 * - Seeghrocca for Cheshta uses J2000 mean-element longitudes (the standard
 *   modern-software formulation, e.g. Jagannatha Hora).
 * - Sputa drishti implements the BPHS piecewise curve with step bonuses for
 *   the special aspects (variants exist; see SOURCES.md).
 * Expect small per-sub-bala deltas versus published hand calculations that
 * used log tables — the ordering of planets should agree.
 */

export interface BalaFactor {
  label: string;
  virupas: number;
}

export interface PlanetShadbala {
  id: PlanetId7;
  sthana: BalaFactor[];
  dig: BalaFactor[];
  kala: BalaFactor[];
  cheshta: BalaFactor[];
  naisargika: BalaFactor[];
  drik: BalaFactor[];
  totalVirupas: number;
  rupas: number;
  /** Classical minimum requirement in virupas and the achieved ratio. */
  required: number;
  ratio: number;
  /** Ishta (benefic capacity) and Kashta (malefic capacity) phala, 0–60. */
  ishta: number;
  kashta: number;
}

export interface ShadbalaSet {
  planets: Record<PlanetId7, PlanetShadbala>;
  strongest: PlanetId7;
  weakest: PlanetId7;
}

const sum = (fs: BalaFactor[]): number => fs.reduce((a, f) => a + f.virupas, 0);

// ---------------------------------------------------------------------------
// 1. Sthana bala
// ---------------------------------------------------------------------------

/** Uchcha bala: distance from deep debilitation / 3 (max 60). */
function uchchaBala(id: PlanetId7, lon: number): number {
  const ex = EXALTATION[id]!;
  const deepDebilitation = norm360(ex.sign * 30 + ex.deg + 180);
  return separation(lon, deepDebilitation) / 3;
}

/**
 * Saptavargaja bala: relationship with the dispositor in each of
 * D1, D2, D3, D7, D9, D12, D30. Virupas per BPHS:
 * moolatrikona 45, own 30, great friend 22.5, friend 15, neutral 7.5,
 * enemy 3.75, great enemy 1.875. The tatkalika (temporal) component is
 * fixed from the rashi chart, per standard practice.
 */
const SAPTAVARGA_IDS: VargaId[] = ["D1", "D2", "D3", "D7", "D9", "D12", "D30"];

function saptavargajaBala(id: PlanetId7, lon: number, rashiSigns: Partial<Record<PlanetId, number>>): number {
  let total = 0;
  for (const vid of SAPTAVARGA_IDS) {
    const sign = vargaSign(vid, lon);
    const mt = MOOLATRIKONA[id];
    if (vid === "D1" && mt && sign === mt.sign && (lon % 30) >= mt.from && (lon % 30) < mt.to) {
      total += 45;
      continue;
    }
    if (OWN_SIGNS[id].includes(sign) || SIGN_LORDS[sign] === id) {
      total += 30;
      continue;
    }
    const lord = SIGN_LORDS[sign];
    const natural = naturalRelation(id, lord);
    const lordRashi = rashiSigns[lord];
    const temporal = lordRashi !== undefined ? temporalRelation(rashiSigns[id]!, lordRashi) : 0;
    const score = natural + temporal;
    total += score >= 2 ? 22.5 : score === 1 ? 15 : score === 0 ? 7.5 : score === -1 ? 3.75 : 1.875;
  }
  return total;
}

/** Ojha-Yugma: Moon and Venus favour even signs, the rest odd — 15 each for rashi and navamsa. */
function ojhaYugmaBala(id: PlanetId7, lon: number): number {
  const wantsEven = id === "Mo" || id === "Ve";
  const rashiOk = isOddSign(signOf(lon)) !== wantsEven;
  const navOk = isOddSign(vargaSign("D9", lon)) !== wantsEven;
  return (rashiOk ? 15 : 0) + (navOk ? 15 : 0);
}

/** Kendradi: 60 in a kendra, 30 in a panaphara, 15 in an apoklima (whole-sign from Lagna). */
function kendradiBala(house: number): number {
  const offset = (house - 1) % 3;
  return offset === 0 ? 60 : offset === 1 ? 30 : 15;
}

/** Drekkana: male planets in the 1st decanate, female in the 2nd, neuter in the 3rd → 15. */
function drekkanaBala(id: PlanetId7, lon: number): number {
  const part = Math.floor((lon % 30) / 10); // 0,1,2
  const gender = PLANET_GENDER[id];
  const wanted = gender === "male" ? 0 : gender === "female" ? 1 : 2;
  return part === wanted ? 15 : 0;
}

// ---------------------------------------------------------------------------
// 2. Dig bala
// ---------------------------------------------------------------------------

/**
 * Dig bala: arc distance from the planet's powerless point / 3.
 * Strong houses: Ju/Me in the 1st, Su/Ma in the 10th, Sa in the 7th,
 * Mo/Ve in the 4th. The powerless point is the opposite cusp. Uses real
 * cusps (ascendant/MC) when available, whole-sign approximations otherwise.
 */
function digBala(id: PlanetId7, lon: number, chart: ChartData): number {
  const asc = chart.ascendant.longitude;
  const mc = chart.mc ?? norm360(asc + 270);
  const strongPoint =
    id === "Ju" || id === "Me" ? asc :
    id === "Su" || id === "Ma" ? mc :
    id === "Sa" ? norm360(asc + 180) :
    norm360(mc + 180); // Mo, Ve → 4th cusp (IC)
  const nadir = norm360(strongPoint + 180);
  return separation(lon, nadir) / 3;
}

// ---------------------------------------------------------------------------
// 3. Kala bala
// ---------------------------------------------------------------------------

interface DayFrame {
  /** Temporal "hour" of birth on a 0–24 scale where 6 = sunrise, 12 = apparent noon, 18 = sunset. */
  temporalHour: number;
  /** True when birth fell between sunrise and sunset. */
  isDay: boolean;
  /** Third of the day (0–2) or of the night (0–2). */
  tribhaga: number;
  /** Sunrise anchoring the astrological day of birth. */
  daySunrise: Date;
}

function dayFrame(chart: ChartData): DayFrame | null {
  const { birthUtc, lat, lon } = chart;
  if (!birthUtc || lat === undefined || lon === undefined) return null;
  // sunriseFor/sunsetFor return the most recent event AT OR BEFORE the instant,
  // so: last event was a sunrise → day birth; last event was a sunset → night.
  const rise = sunriseFor(birthUtc, lat, lon);
  const set = sunsetFor(birthUtc, lat, lon);
  if (!rise || !set) return null; // polar latitudes etc. — caller degrades

  if (set < rise) {
    // Day birth: daylight arc runs rise → the sunset that follows the birth.
    const nextSet = sunsetFor(new Date(birthUtc.getTime() + MS_DAY), lat, lon);
    if (!nextSet || nextSet <= rise) return null;
    const f = clamp01((birthUtc.getTime() - rise.getTime()) / (nextSet.getTime() - rise.getTime()));
    return { temporalHour: 6 + f * 12, isDay: true, tribhaga: Math.min(2, Math.floor(f * 3)), daySunrise: rise };
  }
  // Night birth: night arc runs set → next sunrise.
  const nrise = nextSunrise(birthUtc, lat, lon);
  if (!nrise || nrise <= set) return null;
  const f = clamp01((birthUtc.getTime() - set.getTime()) / (nrise.getTime() - set.getTime()));
  return {
    temporalHour: (18 + f * 12) % 24,
    isDay: false,
    tribhaga: Math.min(2, Math.floor(f * 3)),
    daySunrise: rise,
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Nathonnatha: diurnal planets peak (60) at apparent noon, nocturnal at
 * midnight, Mercury always 60. Measured in temporal hours (approximation
 * of the classical ghatis-from-midnight rule).
 */
function nathonnathaBala(id: PlanetId7, frame: DayFrame): number {
  if (id === "Me") return 60;
  const distFromNoon = Math.abs(frame.temporalHour - 12) / 12; // 0 at noon, 1 at midnight
  const unnata = (1 - distFromNoon) * 60;
  return DIURNAL_PLANETS.includes(id) ? unnata : 60 - unnata;
}

/** Paksha bala: benefics grow with the waxing Moon; the Moon's own value is doubled. */
function pakshaBala(id: PlanetId7, moonLon: number, sunLon: number): number {
  const elong = separation(moonLon, sunLon); // 0–180, 180 = full moon
  const benefic = id === "Mo" || id === "Me" || id === "Ju" || id === "Ve";
  const value = benefic ? elong / 3 : (180 - elong) / 3;
  return id === "Mo" ? value * 2 : value;
}

/** Tribhaga: day thirds are lorded by Me/Su/Sa, night thirds by Mo/Ve/Ma; Jupiter always 60. */
function tribhagaBala(id: PlanetId7, frame: DayFrame): number {
  if (id === "Ju") return 60;
  const lords: PlanetId7[] = frame.isDay ? ["Me", "Su", "Sa"] : ["Mo", "Ve", "Ma"];
  return lords[frame.tribhaga] === id ? 60 : 0;
}

const MS_DAY = 86400000;
/** Julian day number of the UTC calendar date (for ahargana day-count differences). */
function julianDay(date: Date): number {
  return Math.floor(date.getTime() / MS_DAY) + 2440588;
}

/**
 * Weekday 0=Sunday of the astrological day, in the chart's timezone —
 * the SAME convention as panchang.ts (sunrise-anchored day), so the Vara
 * lord always agrees with the Panchang panel.
 */
function varaWeekday(frame: DayFrame, timeZone?: string): number {
  if (timeZone) {
    try {
      const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(frame.daySunrise);
      const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
      if (idx >= 0) return idx;
    } catch {
      /* fall through to UTC */
    }
  }
  return frame.daySunrise.getUTCDay();
}

/**
 * Abda/Masa/Vara/Hora bala (15/30/45/60 to the respective lords).
 * Year and month lords per the classical ahargana rule: the weekday lord of
 * the first day of the current 360-day "year" / 30-day "month" counted from
 * the Kali epoch (Feb 18, 3102 BCE — JD 588466, a Friday). Since consecutive
 * days advance the weekday by one, lord-of-start = (vara − elapsed) mod 7.
 * Epoch conventions vary by a day between texts; this sub-bala is low-weight
 * and treated as approximate. Hora: temporal (seasonal) planetary hours from
 * sunrise in the descending Chaldean order starting from the Vara lord.
 */
function abdadiBala(id: PlanetId7, frame: DayFrame, timeZone?: string): number {
  const jd = julianDay(frame.daySunrise);
  const KALI_JD = 588466;
  const ahargana = jd - KALI_JD;
  const vara = varaWeekday(frame, timeZone);
  let total = 0;

  const yearElapsed = ((ahargana % 360) + 360) % 360;
  if (VARA_LORDS[(((vara - yearElapsed) % 7) + 7) % 7] === id) total += 15;

  const monthElapsed = ((ahargana % 30) + 30) % 30;
  if (VARA_LORDS[(((vara - monthElapsed) % 7) + 7) % 7] === id) total += 30;

  if (VARA_LORDS[vara] === id) total += 45;

  // Planetary hours: descending Chaldean order Sa-Ju-Ma-Su-Ve-Me-Mo, starting
  // from the Vara lord at sunrise; temporal hours (day/night each split in 12).
  const CHALDEAN: PlanetId7[] = ["Sa", "Ju", "Ma", "Su", "Ve", "Me", "Mo"];
  const hoursFromSunrise = Math.floor((frame.temporalHour - 6 + 24) % 24);
  const startIdx = CHALDEAN.indexOf(VARA_LORDS[vara] as PlanetId7);
  const horaLord = CHALDEAN[(startIdx + hoursFromSunrise) % 7];
  if (horaLord === id) total += 60;

  return total;
}

/**
 * Ayana bala: (23.98 ± declination) / 47.96 × 60. Su/Ma/Ju/Ve favour north
 * declination, Mo/Sa south, Mercury takes |declination|. The Sun's value is
 * doubled (BPHS).
 */
function ayanaBala(id: PlanetId7, birthUtc: Date): number {
  const dec = declination(id, birthUtc);
  const eff =
    id === "Me" ? Math.abs(dec) :
    id === "Mo" || id === "Sa" ? -dec :
    dec;
  // Clamped to [0,60]: the Moon's ecliptic latitude (±5°) can push its
  // declination past the obliquity, overflowing the classical formula, which
  // assumed the Sun's ±23.98° range.
  const value = Math.max(0, Math.min(60, ((23.98 + eff) / 47.96) * 60));
  return id === "Su" ? value * 2 : value;
}

// ---------------------------------------------------------------------------
// 4. Cheshta bala
// ---------------------------------------------------------------------------

/** Days since J2000.0. */
function daysFromJ2000(date: Date): number {
  return (date.getTime() - Date.UTC(2000, 0, 1, 12)) / MS_DAY;
}

/** Mean tropical longitude of the Sun (J2000 mean elements). */
function meanSun(date: Date): number {
  return norm360(280.46646 + 0.98564736 * daysFromJ2000(date));
}

/**
 * Cheshta bala for the five tara grahas: seeghra-kendra (seeghrocca − true
 * longitude) folded to 0–180, / 3. Seeghrocca = mean Sun for Ma/Ju/Sa; the
 * planet's own mean heliocentric longitude for Me/Ve (J2000 mean elements).
 * The Sun's Cheshta equals its Ayana bala and the Moon's equals its Paksha
 * bala, per the standard BPHS convention.
 */
function cheshtaBala(id: PlanetId7, lon: number, birthUtc: Date, ayanamshaValue: number): number {
  const d = daysFromJ2000(birthUtc);
  let seeghrocca: number;
  if (id === "Me") seeghrocca = norm360(252.25084 + 4.09233445 * d);
  else if (id === "Ve") seeghrocca = norm360(181.97973 + 1.60213034 * d);
  else seeghrocca = meanSun(birthUtc);
  // Both seeghrocca and the natal longitude must be in the same zodiac:
  // natal longitudes are sidereal, mean elements tropical — shift them.
  const seeghroccaSidereal = norm360(seeghrocca - ayanamshaValue);
  const kendra = separation(seeghroccaSidereal, lon); // folded 0–180
  return kendra / 3;
}

// ---------------------------------------------------------------------------
// 6. Drik bala
// ---------------------------------------------------------------------------

/**
 * Sputa drishti (BPHS piecewise curve): value of the aspect cast by a planet
 * at angular distance D (aspecting → aspected, 0–360):
 *   30–60: (D−30)/2 · 60–90: D−45 · 90–120: (120−D)/2+30 · 120–150: 150−D
 *   150–180: (D−150)×2 · 180–300: (300−D)/2 · else 0.
 * Special-aspect bonuses (common implementation; variants exist):
 *   Mars +15 on the 4th/8th arcs, Jupiter +30 on the 5th/9th, Saturn +45 on
 *   the 3rd/10th — capped at 60.
 */
export function sputaDrishti(aspecter: PlanetId, D: number): number {
  const d = norm360(D);
  let value = 0;
  if (d >= 30 && d < 60) value = (d - 30) / 2;
  else if (d >= 60 && d < 90) value = d - 45;
  else if (d >= 90 && d < 120) value = (120 - d) / 2 + 30;
  else if (d >= 120 && d < 150) value = 150 - d;
  else if (d >= 150 && d < 180) value = (d - 150) * 2;
  else if (d >= 180 && d <= 300) value = (300 - d) / 2;

  if (aspecter === "Ma" && ((d >= 90 && d < 120) || (d >= 210 && d < 240))) value += 15;
  if (aspecter === "Ju" && ((d >= 120 && d < 150) || (d >= 240 && d < 270))) value += 30;
  if (aspecter === "Sa" && ((d >= 60 && d < 90) || (d >= 270 && d < 300))) value += 45;
  return Math.min(60, value);
}

/**
 * Drik bala: (benefic drishti received − malefic drishti received) / 4.
 * Benefics here: Ju, Ve, Me, waxing Mo; malefics: Su, Ma, Sa, waning Mo.
 */
function drikBala(target: PlanetPosition, planets: PlanetPosition[], moonWaxing: boolean): number {
  let benefic = 0;
  let malefic = 0;
  for (const p of planets) {
    if (p.id === target.id || p.id === "Ra" || p.id === "Ke") continue;
    const D = norm360(target.longitude - p.longitude);
    const value = sputaDrishti(p.id, D);
    const isBenefic =
      p.id === "Ju" || p.id === "Ve" || p.id === "Me" || (p.id === "Mo" && moonWaxing);
    if (isBenefic) benefic += value;
    else malefic += value;
  }
  return (benefic - malefic) / 4;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function computeShadbala(chart: ChartData): ShadbalaSet | null {
  const { birthUtc, lat, lon } = chart;
  if (!birthUtc || lat === undefined || lon === undefined) return null;
  const frame = dayFrame(chart);
  if (!frame) return null;

  const byId = new Map(chart.planets.map((p) => [p.id, p]));
  const moon = byId.get("Mo");
  const sun = byId.get("Su");
  if (!moon || !sun) return null;
  const moonWaxing = norm360(moon.longitude - sun.longitude) < 180;

  const rashiSigns: Partial<Record<PlanetId, number>> = {};
  for (const p of chart.planets) rashiSigns[p.id] = p.sign;

  const planets = {} as Record<PlanetId7, PlanetShadbala>;

  for (const id of SHADBALA_PLANETS) {
    const p = byId.get(id);
    if (!p) return null; // degenerate manual input

    const sthana: BalaFactor[] = [
      { label: "Uchcha", virupas: uchchaBala(id, p.longitude) },
      { label: "Saptavargaja", virupas: saptavargajaBala(id, p.longitude, rashiSigns) },
      { label: "Ojha-Yugma", virupas: ojhaYugmaBala(id, p.longitude) },
      { label: "Kendradi", virupas: kendradiBala(p.house) },
      { label: "Drekkana", virupas: drekkanaBala(id, p.longitude) },
    ];
    const dig: BalaFactor[] = [{ label: "Dig", virupas: digBala(id, p.longitude, chart) }];

    const paksha = pakshaBala(id, moon.longitude, sun.longitude);
    const ayana = ayanaBala(id, birthUtc);
    const kala: BalaFactor[] = [
      { label: "Nathonnatha", virupas: nathonnathaBala(id, frame) },
      { label: "Paksha", virupas: paksha },
      { label: "Tribhaga", virupas: tribhagaBala(id, frame) },
      { label: "Abda/Masa/Vara/Hora", virupas: abdadiBala(id, frame, chart.meta.timezone) },
      { label: "Ayana", virupas: ayana },
      // Yuddha adjustment appended after totals (needs both combatants' sums).
    ];

    const cheshtaValue =
      id === "Su" ? ayana :
      id === "Mo" ? paksha :
      cheshtaBala(id, p.longitude, birthUtc, chart.meta.ayanamshaValue);
    const cheshta: BalaFactor[] = [{ label: "Cheshta", virupas: cheshtaValue }];

    const naisargika: BalaFactor[] = [{ label: "Naisargika", virupas: NAISARGIKA_BALA[id] }];
    const drik: BalaFactor[] = [{ label: "Drik", virupas: drikBala(p, chart.planets, moonWaxing) }];

    const totalVirupas = sum(sthana) + sum(dig) + sum(kala) + sum(cheshta) + sum(naisargika) + sum(drik);
    const uchcha = sthana[0].virupas;
    const cheshtaForPhala = Math.min(60, cheshtaValue);
    planets[id] = {
      id,
      sthana, dig, kala, cheshta, naisargika, drik,
      totalVirupas,
      rupas: totalVirupas / 60,
      required: SHADBALA_MINIMUM[id],
      ratio: totalVirupas / SHADBALA_MINIMUM[id],
      ishta: Math.sqrt(Math.max(0, uchcha * cheshtaForPhala)),
      kashta: Math.sqrt(Math.max(0, (60 - uchcha) * (60 - cheshtaForPhala))),
    };
  }

  // Graha yuddha (Kala sub-bala): the difference of the combatants' totals is
  // transferred from the loser to the winner (BPHS). Uses the already-set
  // warWith/warWinner flags from states.ts.
  const adjusted = new Set<PlanetId7>();
  for (const id of SHADBALA_PLANETS) {
    const p = byId.get(id)!;
    if (!p.warWith || adjusted.has(id)) continue;
    const other = p.warWith as PlanetId7;
    if (!SHADBALA_PLANETS.includes(other) || adjusted.has(other)) continue;
    const a = planets[id];
    const b = planets[other];
    const diff = Math.abs(a.totalVirupas - b.totalVirupas);
    const winner = p.warWinner ? a : b;
    const loser = p.warWinner ? b : a;
    winner.kala.push({ label: "Yuddha (won)", virupas: diff });
    loser.kala.push({ label: "Yuddha (lost)", virupas: -diff });
    winner.totalVirupas += diff;
    loser.totalVirupas -= diff;
    winner.rupas = winner.totalVirupas / 60;
    loser.rupas = loser.totalVirupas / 60;
    winner.ratio = winner.totalVirupas / winner.required;
    loser.ratio = loser.totalVirupas / loser.required;
    adjusted.add(id);
    adjusted.add(other);
  }

  const order = [...SHADBALA_PLANETS].sort(
    (x, y) => planets[y].totalVirupas - planets[x].totalVirupas
  );
  return { planets, strongest: order[0], weakest: order[order.length - 1] };
}

/**
 * Bhava Bala (BPHS Bhava-bala adhyaya): per-house strength =
 * Bhavadhipati bala (the lord's total Shadbala) + Bhava Dig bala (sign-class
 * vs house-type table) + Bhava Drishti bala (net sputa drishti on the bhava
 * madhya, benefics minus malefics, / 4).
 */
export interface BhavaBala {
  house: number;
  factors: BalaFactor[];
  totalVirupas: number;
  rupas: number;
}

/**
 * Bhava Dig bala: houses gain by the class of sign on them —
 * human signs strong in the Lagna group, quadruped in the 10th group,
 * watery in the 4th group, insect (Scorpio) in the 7th group (BPHS).
 */
function bhavaDigBala(house: number, sign: number): number {
  // Sign classes (BPHS): human Ge, Vi, Li, Aq, first half Sg; quadruped Ar,
  // Ta, Le, second half Sg, second half Cp; watery Cn, Pi, first half Cp;
  // insect Sc. Half-sign splits are approximated at whole-sign level by their
  // dominant class (Sg → human, Cp → watery), noted as an approximation.
  // Value = 60 minus 10 per house of circular distance from the strong house
  // (Raman, "Graha and Bhava Balas").
  const HUMAN = [2, 5, 6, 8, 10];
  const QUADRUPED = [0, 1, 4];
  const WATERY = [3, 9, 11];
  const strongHouse =
    HUMAN.includes(sign) ? 1 :        // strongest in the Lagna
    QUADRUPED.includes(sign) ? 10 :   // strongest in the 10th
    WATERY.includes(sign) ? 4 :       // strongest in the 4th
    7;                                // Scorpio (insect): strongest in the 7th
  const raw = Math.abs(house - strongHouse);
  const dist = Math.min(raw, 12 - raw); // circular, 0–6
  return Math.max(0, 60 - 10 * dist);
}

export function computeBhavaBala(chart: ChartData, shadbala: ShadbalaSet): BhavaBala[] {
  const moon = chart.planets.find((p) => p.id === "Mo");
  const sun = chart.planets.find((p) => p.id === "Su");
  const moonWaxing =
    moon && sun ? norm360(moon.longitude - sun.longitude) < 180 : true;

  const result: BhavaBala[] = [];
  for (let house = 1; house <= 12; house++) {
    const sign = (chart.ascendant.sign + house - 1) % 12;
    // Bhava madhya: real cusp when available, sign midpoint otherwise.
    const madhya = chart.cusps ? chart.cusps[house - 1] : norm360(sign * 30 + 15);

    const lordId = SIGN_LORDS[sign];
    const lordBala =
      lordId in shadbala.planets ? shadbala.planets[lordId as PlanetId7].totalVirupas : 0;

    let benefic = 0;
    let malefic = 0;
    for (const p of chart.planets) {
      if (p.id === "Ra" || p.id === "Ke") continue;
      const value = sputaDrishti(p.id, norm360(madhya - p.longitude));
      const isBenefic =
        p.id === "Ju" || p.id === "Ve" || p.id === "Me" || (p.id === "Mo" && moonWaxing);
      if (isBenefic) benefic += value;
      else malefic += value;
    }

    const factors: BalaFactor[] = [
      { label: "Bhavadhipati (lord's Shadbala)", virupas: lordBala },
      { label: "Bhava Dig", virupas: bhavaDigBala(house, sign) },
      { label: "Bhava Drishti", virupas: (benefic - malefic) / 4 },
    ];
    const totalVirupas = sum(factors);
    result.push({ house, factors, totalVirupas, rupas: totalVirupas / 60 });
  }
  return result;
}
