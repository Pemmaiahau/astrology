import { tropicalAscMc } from "./ascendant";
import { getAyanamsha } from "./ayanamsha";
import { NAKSHATRA_LORDS, SIGN_LORDS, signMobility } from "./constants";
import { computeDayParts, nightKaalas } from "./dayParts";
import { nakshatraOf, norm360, padaOf, signOf } from "./math";
import { siderealLongitudeAt } from "./scan";
import type { AyanamshaId, ChartData, PlanetId } from "./types";

/**
 * Sensitive points that are not grahas: Gulika/Mandi and the Sun-based
 * upagrahas, the time-based special lagnas, Indu Lagna, Yogi/Avayogi and the
 * Bhrigu Bindu. Every formula is the BPHS one as implemented in Jagannatha
 * Hora unless noted; conventions that genuinely differ between schools are
 * stated next to the value they affect.
 *
 * Needs a real birth anchor (instant + coordinates) and a Sun that rises and
 * sets on the date; returns null otherwise, like `shadbala.ts`.
 */

export interface SpecialPoint {
  key: string;
  name: string;
  longitude: number;
  sign: number;
  degInSign: number;
  nakshatra: number;
  pada: number;
  /** Whole-sign house from the Lagna. */
  house: number;
  note: string;
}

export interface SpecialPoints {
  points: SpecialPoint[];
  /** Indu Lagna is a sign, not a degree. */
  induLagna: { sign: number; house: number; kalaSum: number };
  yogi: { point: number; yogi: PlanetId; duplicateYogi: PlanetId; avayogiPoint: number; avayogi: PlanetId };
}

/** BPHS kala values for the Indu Lagna (Rahu/Ketu take none). */
const INDU_KALAS: Partial<Record<PlanetId, number>> = {
  Su: 30, Mo: 16, Ma: 6, Me: 8, Ju: 10, Ve: 12, Sa: 1,
};

const NAK = 360 / 27;

export function computeSpecialPoints(chart: ChartData, ayanamsha: AyanamshaId): SpecialPoints | null {
  const { birthUtc, lat, lon } = chart;
  if (!birthUtc || lat === undefined || lon === undefined) return null;
  const parts = computeDayParts(birthUtc, lat, lon, chart.meta.timezone);
  if (!parts) return null;
  const sun = chart.planets.find((p) => p.id === "Su");
  const moon = chart.planets.find((p) => p.id === "Mo");
  const rahu = chart.planets.find((p) => p.id === "Ra");
  if (!sun || !moon || !rahu) return null;

  const nodeMode = chart.meta.nodeMode ?? "mean";
  const lagna = chart.ascendant;
  const siderealAscAt = (at: Date): number =>
    norm360(tropicalAscMc(at, lat, lon).asc - getAyanamsha(ayanamsha, at));

  const point = (key: string, name: string, longitude: number, note: string): SpecialPoint => {
    const l = norm360(longitude);
    const sign = signOf(l);
    return {
      key, name, longitude: l, sign, degInSign: l % 30,
      nakshatra: nakshatraOf(l), pada: padaOf(l),
      house: ((sign - lagna.sign + 12) % 12) + 1,
      note,
    };
  };

  // --- Gulika / Mandi: the Lagna rising at Saturn's eighth of the day (or of
  // the night, for a night birth). The span is the one the Panchang tab shows
  // as Gulika Kaal, so the two can never disagree.
  const saturnPart = parts.isDay ? parts.gulikaKaal : nightKaalas(parts).gulika;
  const mid = new Date((saturnPart.start.getTime() + saturnPart.end.getTime()) / 2);
  const points: SpecialPoint[] = [
    point("gulika", "Gulika", siderealAscAt(saturnPart.start),
      "Lagna at the start of Saturn's portion of the " + (parts.isDay ? "day" : "night")),
    point("mandi", "Mandi", siderealAscAt(mid),
      "Lagna at the middle of Saturn's portion (Kerala texts often equate Mandi with Gulika — compare both)"),
  ];

  // --- The five Sun-based upagrahas (BPHS Ch.3).
  const dhuma = norm360(sun.longitude + 133 + 20 / 60);
  const vyatipata = norm360(360 - dhuma);
  const parivesha = norm360(vyatipata + 180);
  const indrachapa = norm360(360 - parivesha);
  const upaketu = norm360(indrachapa + 16 + 40 / 60);
  points.push(
    point("dhuma", "Dhuma", dhuma, "Sun + 133°20'"),
    point("vyatipata", "Vyatipata", vyatipata, "360° − Dhuma"),
    point("parivesha", "Parivesha", parivesha, "Vyatipata + 180°"),
    point("indrachapa", "Indrachapa", indrachapa, "360° − Parivesha"),
    point("upaketu", "Upaketu", upaketu, "Indrachapa + 16°40' (= Sun − 30°)"),
  );

  // --- Time-based special lagnas, all counted from the Sun at sunrise of the
  // astrological day (BPHS Ch.4): Bhava lagna one sign per 5 ghatis (2 h),
  // Hora lagna one sign per 2.5 ghatis (1 h), Ghati lagna one sign per ghati
  // (24 min).
  const sunAtSunrise = siderealLongitudeAt("Su", ayanamsha, parts.sunrise, nodeMode);
  const minutes = (birthUtc.getTime() - parts.sunrise.getTime()) / 60000;
  points.push(
    point("bhava-lagna", "Bhava Lagna", sunAtSunrise + (minutes / 120) * 30, "1 sign per 2 hours from sunrise"),
    point("hora-lagna", "Hora Lagna", sunAtSunrise + (minutes / 60) * 30, "1 sign per hour from sunrise — wealth"),
    point("ghati-lagna", "Ghati Lagna", sunAtSunrise + (minutes / 24) * 30, "1 sign per 24 minutes from sunrise — power and position"),
  );

  // Pranapada (BPHS Ch.3): one sign per 15 vighatis (6 minutes) of ishta
  // kala, added to the Sun if it is in a movable sign, to the 9th from it if
  // fixed, to the 5th from it if dual.
  const base = { movable: 0, fixed: 240, dual: 120 }[signMobility(sun.sign)];
  points.push(
    point("pranapada", "Pranapada", sun.longitude + base + (minutes / 6) * 30,
      "1 sign per 6 minutes from sunrise, from the Sun / its 9th / its 5th by sign nature"),
  );

  // Sree Lagna: the Lagna advanced by the fraction of the Moon's nakshatra
  // already elapsed, scaled to a full circle (PVR Narasimha Rao).
  const elapsed = (moon.longitude % NAK) / NAK;
  points.push(point("sree-lagna", "Sree Lagna", lagna.longitude + elapsed * 360, "Lagna + Moon's elapsed nakshatra fraction × 360° — prosperity"));

  // Bhrigu Bindu: the midpoint of the arc from Rahu forward to the Moon.
  points.push(point("bhrigu-bindu", "Bhrigu Bindu", rahu.longitude + norm360(moon.longitude - rahu.longitude) / 2,
    "Midpoint Rahu → Moon — a transit trigger"));

  // --- Indu Lagna (wealth): kalas of the 9th lords from the Lagna and from
  // the Moon, summed, remainder by 12, counted from the Moon's sign.
  const ninthFromLagna = SIGN_LORDS[(lagna.sign + 8) % 12];
  const ninthFromMoon = SIGN_LORDS[(moon.sign + 8) % 12];
  const kalaSum = (INDU_KALAS[ninthFromLagna] ?? 0) + (INDU_KALAS[ninthFromMoon] ?? 0);
  const rem = kalaSum % 12 || 12;
  const induSign = (moon.sign + rem - 1) % 12;

  // --- Yogi / Avayogi: Sun + Moon + 93°20'; the Yogi is that point's
  // nakshatra lord, the duplicate Yogi its sign lord; the Avayogi point lies
  // 186°40' further on (equivalently the 6th nakshatra from the Yogi's).
  const yogiPoint = norm360(sun.longitude + moon.longitude + 93 + 20 / 60);
  const avayogiPoint = norm360(yogiPoint + 186 + 40 / 60);
  points.push(
    point("yogi-point", "Yogi point", yogiPoint, "Sun + Moon + 93°20'"),
    point("avayogi-point", "Avayogi point", avayogiPoint, "Yogi point + 186°40'"),
  );

  return {
    points,
    induLagna: { sign: induSign, house: ((induSign - lagna.sign + 12) % 12) + 1, kalaSum },
    yogi: {
      point: yogiPoint,
      yogi: NAKSHATRA_LORDS[nakshatraOf(yogiPoint)],
      duplicateYogi: SIGN_LORDS[signOf(yogiPoint)],
      avayogiPoint,
      avayogi: NAKSHATRA_LORDS[nakshatraOf(avayogiPoint)],
    },
  };
}
