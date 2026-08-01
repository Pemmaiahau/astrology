import { getAyanamsha } from "./ayanamsha";
import { tropicalAscMc } from "./ascendant";
import { PLANETS } from "./constants";
import { dailySpeed, isRetrograde, tropicalLongitude } from "./ephemeris";
import { bhavaOf, sripatiHouses } from "./houses";
import { degInSign, houseFromSign, nakshatraOf, norm360, padaOf, signOf } from "./math";
import { applyGrahaYuddha, computeDignity, isCombust, nakshatraRelation } from "./states";
import { localToUtc } from "./time";
import type {
  AutoInputState,
  AyanamshaId,
  ChartData,
  ManualInputState,
  NodeMode,
  PlanetId,
  PlanetPosition,
} from "./types";

/** Full ephemeris-driven chart from birth data. */
export function computeAutoChart(
  input: AutoInputState,
  ayanamsha: AyanamshaId,
  nodeMode: NodeMode = "mean"
): ChartData | null {
  if (!input.place || !input.dateISO || !input.time) return null;
  const { lat, lon, timezone } = input.place;
  const utc = localToUtc(timezone, input.dateISO, input.time);
  const ay = getAyanamsha(ayanamsha, utc);

  const { asc: ascTrop, mc: mcTrop } = tropicalAscMc(utc, lat, lon);
  const ascSid = norm360(ascTrop - ay);
  const mcSid = norm360(mcTrop - ay);
  const lagnaSign = signOf(ascSid);
  const { madhya, sandhi } = sripatiHouses(ascSid, mcSid);

  const longitudes: Partial<Record<PlanetId, number>> = {};
  for (const id of PLANETS) longitudes[id] = norm360(tropicalLongitude(id, utc, nodeMode) - ay);

  const sunLon = longitudes.Su!;
  const planets: PlanetPosition[] = PLANETS.map((id) => {
    const lonSid = longitudes[id]!;
    const retro = isRetrograde(id, utc);
    const nak = nakshatraOf(lonSid);
    const nakRel = nakshatraRelation(id, nak);
    return {
      id,
      longitude: lonSid,
      sign: signOf(lonSid),
      degInSign: degInSign(lonSid),
      house: houseFromSign(signOf(lonSid), lagnaSign),
      bhava: bhavaOf(lonSid, sandhi),
      nakshatra: nak,
      pada: padaOf(lonSid),
      nakshatraLord: nakRel.lord,
      nakshatraRelation: nakRel.relation,
      retrograde: retro,
      combust: id !== "Su" && isCombust(id, lonSid, sunLon, retro),
      speed: dailySpeed(id, utc, nodeMode),
      dignity: computeDignity(id, lonSid, longitudes),
    };
  });
  applyGrahaYuddha(planets);

  return {
    ascendant: {
      longitude: ascSid,
      sign: lagnaSign,
      degInSign: degInSign(ascSid),
      nakshatra: nakshatraOf(ascSid),
      pada: padaOf(ascSid),
    },
    mc: mcSid,
    planets,
    cusps: madhya,
    sandhis: sandhi,
    birthUtc: utc,
    lat,
    lon,
    meta: {
      name: input.name || undefined,
      place: [input.place.name, input.place.country].filter(Boolean).join(", "),
      mode: "auto",
      ayanamsha,
      ayanamshaValue: ay,
      timezone,
      localDateTime: `${input.dateISO} ${input.time}`,
      nodeMode,
      gender: input.gender,
    },
  };
}

/** Chart from manually mapped placements; birth anchor powers dasha + chalit. */
export function computeManualChart(input: ManualInputState, ayanamsha: AyanamshaId): ChartData {
  const lagnaSign = input.lagnaSign;
  const ascSid = norm360(lagnaSign * 30 + input.ascDeg);

  let birthUtc: Date | null = null;
  let mcSid: number | undefined;
  let madhya: number[] | undefined;
  let sandhi: number[] | undefined;
  let lat: number | undefined;
  let lon: number | undefined;
  let ay = getAyanamsha(ayanamsha, new Date());

  if (input.anchor.place && input.anchor.dateISO && input.anchor.time) {
    birthUtc = localToUtc(input.anchor.place.timezone, input.anchor.dateISO, input.anchor.time);
    ay = getAyanamsha(ayanamsha, birthUtc);
    lat = input.anchor.place.lat;
    lon = input.anchor.place.lon;
    const angles = tropicalAscMc(birthUtc, lat, lon);
    // Respect the user's manual Lagna: keep their ascendant, but use the
    // computed MC to build Sripati cusps around it.
    mcSid = norm360(angles.mc - ay);
    const houses = sripatiHouses(ascSid, mcSid);
    madhya = houses.madhya;
    sandhi = houses.sandhi;
  }

  const longitudes: Partial<Record<PlanetId, number>> = {};
  for (const p of input.planets) {
    const sign = (lagnaSign + p.house - 1) % 12;
    longitudes[p.id] = norm360(sign * 30 + p.deg);
  }

  const sunLon = longitudes.Su ?? 0;
  const planets: PlanetPosition[] = input.planets.map((mp) => {
    const lonSid = longitudes[mp.id]!;
    const retro = mp.id === "Ra" || mp.id === "Ke" ? false : mp.retro;
    const nak = nakshatraOf(lonSid);
    const nakRel = nakshatraRelation(mp.id, nak);
    return {
      id: mp.id,
      longitude: lonSid,
      sign: signOf(lonSid),
      degInSign: degInSign(lonSid),
      house: mp.house,
      bhava: sandhi ? bhavaOf(lonSid, sandhi) : mp.house,
      nakshatra: nak,
      pada: padaOf(lonSid),
      nakshatraLord: nakRel.lord,
      nakshatraRelation: nakRel.relation,
      retrograde: retro,
      combust: mp.id !== "Su" && isCombust(mp.id, lonSid, sunLon, retro),
      speed: retro ? -0.1 : 0.5,
      dignity: computeDignity(mp.id, lonSid, longitudes),
    };
  });
  applyGrahaYuddha(planets);

  return {
    ascendant: {
      longitude: ascSid,
      sign: lagnaSign,
      degInSign: input.ascDeg,
      nakshatra: nakshatraOf(ascSid),
      pada: padaOf(ascSid),
    },
    mc: mcSid,
    planets,
    cusps: madhya,
    sandhis: sandhi,
    birthUtc,
    lat,
    lon,
    meta: {
      name: input.name || undefined,
      place: input.anchor.place ? input.anchor.place.name : undefined,
      mode: "manual",
      ayanamsha,
      ayanamshaValue: ay,
      timezone: input.anchor.place?.timezone,
      localDateTime:
        input.anchor.dateISO && input.anchor.time ? `${input.anchor.dateISO} ${input.anchor.time}` : undefined,
      gender: input.gender,
    },
  };
}
