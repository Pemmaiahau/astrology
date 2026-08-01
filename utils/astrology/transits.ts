import { getAyanamsha } from "./ayanamsha";
import { isRetrograde, tropicalLongitude } from "./ephemeris";
import { degInSign, norm360, signOf } from "./math";
import type { AyanamshaId, ChartData, PlanetId, TransitInfo } from "./types";

const TRANSIT_BODIES: PlanetId[] = ["Ju", "Sa", "Ra", "Ke", "Su", "Ma"];

export function currentTransits(chart: ChartData, ayanamsha: AyanamshaId, now: Date): TransitInfo[] {
  const ay = getAyanamsha(ayanamsha, now);
  const nodeMode = chart.meta.nodeMode ?? "mean";
  const moon = chart.planets.find((p) => p.id === "Mo");
  const moonSign = moon ? moon.sign : chart.ascendant.sign;
  const lagnaSign = chart.ascendant.sign;

  return TRANSIT_BODIES.map((id) => {
    const lon = norm360(tropicalLongitude(id, now, nodeMode) - ay);
    const sign = signOf(lon);
    return {
      id,
      longitude: lon,
      sign,
      degInSign: degInSign(lon),
      retrograde: isRetrograde(id, now),
      houseFromMoon: ((sign - moonSign + 12) % 12) + 1,
      houseFromLagna: ((sign - lagnaSign + 12) % 12) + 1,
    };
  });
}

/** Sade Sati: Saturn transiting the 12th, 1st or 2nd from the natal Moon. */
export function sadeSatiPhase(transits: TransitInfo[]): "rising" | "peak" | "setting" | null {
  const sat = transits.find((t) => t.id === "Sa");
  if (!sat) return null;
  if (sat.houseFromMoon === 12) return "rising";
  if (sat.houseFromMoon === 1) return "peak";
  if (sat.houseFromMoon === 2) return "setting";
  return null;
}
