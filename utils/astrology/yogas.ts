import { EXALTATION, PLANET_NAMES, SIGN_LORDS } from "./constants";
import type { ChartData, PlanetId, YogaFinding } from "./types";

const KENDRA = [1, 4, 7, 10];
const DUSTHANA = [6, 8, 12];

function houseOf(chart: ChartData, id: PlanetId): number | undefined {
  return chart.planets.find((p) => p.id === id)?.house;
}

function signOfPlanet(chart: ChartData, id: PlanetId): number | undefined {
  return chart.planets.find((p) => p.id === id)?.sign;
}

/** Houses owned by a planet for this lagna (whole-sign). */
export function ownedHouses(id: PlanetId, lagnaSign: number): number[] {
  const houses: number[] = [];
  for (let h = 1; h <= 12; h++) {
    if (SIGN_LORDS[(lagnaSign + h - 1) % 12] === id) houses.push(h);
  }
  return houses;
}

export function detectYogas(chart: ChartData): YogaFinding[] {
  const out: YogaFinding[] = [];
  const lagna = chart.ascendant.sign;
  const moonHouse = houseOf(chart, "Mo");

  for (const p of chart.planets) {
    // --- Neechabhanga Raja Yoga ---
    if (p.dignity === "debilitated") {
      const debSign = p.sign;
      const dispositor = SIGN_LORDS[debSign];
      const exaltedHere = (Object.keys(EXALTATION) as PlanetId[]).find(
        (q) => EXALTATION[q]?.sign === debSign && q !== p.id
      );
      const conditions: string[] = [];
      const dispHouse = houseOf(chart, dispositor);
      if (dispHouse && KENDRA.includes(dispHouse)) {
        conditions.push(`its dispositor ${PLANET_NAMES[dispositor]} occupies a kendra from Lagna`);
      }
      if (moonHouse && dispHouse && KENDRA.includes(((dispHouse - moonHouse + 12) % 12) + 1)) {
        conditions.push(`its dispositor stands in a kendra from the Moon`);
      }
      if (exaltedHere) {
        const exHouse = houseOf(chart, exaltedHere);
        if (exHouse && KENDRA.includes(exHouse)) {
          conditions.push(
            `${PLANET_NAMES[exaltedHere]}, exalted in that very sign's field, occupies a kendra`
          );
        }
      }
      const dispDignity = chart.planets.find((q) => q.id === dispositor)?.dignity;
      if (dispDignity === "exalted") {
        conditions.push(`its dispositor ${PLANET_NAMES[dispositor]} is itself exalted`);
      }
      if (conditions.length > 0) {
        out.push({
          key: `nbrj-${p.id}`,
          name: "Neechabhanga Raja Yoga",
          planets: [p.id],
          description: `${PLANET_NAMES[p.id]}'s debilitation is cancelled because ${conditions.join("; and ")}. What begins as the chart's weakest point matures into a source of unusual strength, typically after early-life struggle in that portfolio.`,
        });
      }
    }

    // --- Vipareeta Raja Yoga ---
    const owned = ownedHouses(p.id, lagna);
    const dusthanaLordships = owned.filter((h) => DUSTHANA.includes(h));
    if (dusthanaLordships.length > 0 && DUSTHANA.includes(p.house) && p.id !== "Ra" && p.id !== "Ke") {
      const names: Record<number, string> = { 6: "Harsha", 8: "Sarala", 12: "Vimala" };
      const kind = names[dusthanaLordships[0]];
      out.push({
        key: `vrj-${p.id}`,
        name: `Vipareeta Raja Yoga (${kind})`,
        planets: [p.id],
        description: `${PLANET_NAMES[p.id]}, lord of the ${dusthanaLordships.join(" and ")}, sits in the ${p.house}th — a dusthana lord hidden in a dusthana. Adversity turns on itself: rivals self-destruct, crises resolve in the native's favour, and gains arrive through difficulty others cannot stomach.`,
      });
    }
  }

  // --- Gajakesari ---
  const ju = houseOf(chart, "Ju");
  if (ju && moonHouse && KENDRA.includes(((ju - moonHouse + 12) % 12) + 1)) {
    out.push({
      key: "gajakesari",
      name: "Gajakesari Yoga",
      planets: ["Ju", "Mo"],
      description:
        "Jupiter stands in a kendra from the Moon. The mind is backed by wisdom: reputation, counsel-worthiness and resilience in public life, strongest when Jupiter is dignified.",
    });
  }

  // --- Budhaditya ---
  const su = chart.planets.find((p) => p.id === "Su");
  const me = chart.planets.find((p) => p.id === "Me");
  if (su && me && su.sign === me.sign) {
    out.push({
      key: "budhaditya",
      name: "Budhaditya Yoga",
      planets: ["Su", "Me"],
      description: `Sun and Mercury conjoin in the ${su.house}th house: sharp administrative intellect and articulate authority${me.combust ? ", though Mercury's combustion demands the native learn to separate ego from analysis" : ""}.`,
    });
  }

  // --- Chandra-Mangala ---
  const mo = chart.planets.find((p) => p.id === "Mo");
  const ma = chart.planets.find((p) => p.id === "Ma");
  if (mo && ma && mo.sign === ma.sign) {
    out.push({
      key: "chandra-mangala",
      name: "Chandra-Mangala Yoga",
      planets: ["Mo", "Ma"],
      description:
        "Moon and Mars conjoin — an earning combination: entrepreneurial drive fused with instinct. Wealth through self-effort, with a temper that needs channels, not suppression.",
    });
  }

  // --- Pancha Mahapurusha Yogas ---
  // One of the five tara grahas in its own sign or exaltation AND in a kendra
  // from the Lagna. Read from the Rashi (whole-sign) house, consistent with the
  // rest of this file. Moolatrikona counts as own-sign for this purpose.
  const MAHAPURUSHA: Record<string, { name: string; trait: string }> = {
    Ma: {
      name: "Ruchaka",
      trait:
        "a commanding, athletic physicality and fearless executive nerve. The native leads from the front, thrives in competition, defence, surgery or engineering, and carries authority that is taken rather than granted. Anger is the tax on the gift.",
    },
    Me: {
      name: "Bhadra",
      trait:
        "an exceptionally quick, articulate and commercially fluent intelligence. Learning comes fast, speech persuades, and the native is trusted with analysis, negotiation and the written word. Restlessness and over-cleverness are the failure modes.",
    },
    Ju: {
      name: "Hamsa",
      trait:
        "a dignified, principled and genuinely wise bearing. Others bring this native their decisions; teaching, counsel, law and philanthropy come naturally, and reputation outruns self-promotion. Moral certainty is the only excess to watch.",
    },
    Ve: {
      name: "Malavya",
      trait:
        "beauty, refinement and magnetic social grace, with real comfort and artistic capacity in the life. Relationships, luxury, design and diplomacy all favour this native. Indulgence, not scarcity, is the discipline required.",
    },
    Sa: {
      name: "Sasa",
      trait:
        "formidable endurance and organisational authority built slowly and held for a long time. The native governs systems, labour and institutions, and outlasts flashier rivals. Coldness and a taste for control are the shadow.",
    },
  };

  for (const p of chart.planets) {
    const mp = MAHAPURUSHA[p.id];
    if (!mp) continue;
    const dignified = p.dignity === "exalted" || p.dignity === "own" || p.dignity === "moolatrikona";
    if (!dignified || !KENDRA.includes(p.house)) continue;
    out.push({
      key: `mahapurusha-${p.id}`,
      name: `${mp.name} Yoga (Pancha Mahapurusha)`,
      planets: [p.id],
      description: `${PLANET_NAMES[p.id]} is ${p.dignity === "exalted" ? "exalted" : p.dignity === "moolatrikona" ? "in its moolatrikona" : "in its own sign"} and occupies the ${p.house}th house, a kendra — one of the five Mahapurusha ("great person") combinations. It stamps the whole personality with ${mp.trait}`,
    });
  }

  // --- Yogakaraka placement ---
  const YOGAKARAKA: Partial<Record<number, PlanetId>> = {
    3: "Ma", 4: "Ma", 1: "Sa", 6: "Sa", 9: "Ve", 10: "Ve",
  };
  const yk = YOGAKARAKA[lagna];
  if (yk) {
    const p = chart.planets.find((q) => q.id === yk);
    if (p && (KENDRA.includes(p.house) || [5, 9].includes(p.house))) {
      out.push({
        key: `yk-${yk}`,
        name: "Yogakaraka in Strength",
        planets: [yk],
        description: `${PLANET_NAMES[yk]}, the yogakaraka for this Lagna (simultaneous kendra and trikona lord), occupies the ${p.house}th house. A single-planet raja yoga engine: its dasha periods carry the chart's biggest promotions in status and material standing.`,
      });
    }
  }

  return out;
}
