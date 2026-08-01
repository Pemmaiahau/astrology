import { EXALTATION, OWN_SIGNS, PLANET_NAMES, SIGN_LORDS } from "./constants";
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

  // Helpers shared by the association-based detectors below.
  const nth = (n: number): string =>
    `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
  const lordOfHouse = (h: number): PlanetId => SIGN_LORDS[(lagna + h - 1) % 12];
  const planetOf = (id: PlanetId) => chart.planets.find((q) => q.id === id);
  const sameSign = (a: PlanetId, b: PlanetId): boolean => {
    const pa = planetOf(a);
    const pb = planetOf(b);
    return Boolean(pa && pb && a !== b && pa.sign === pb.sign);
  };
  const mutualSeventh = (a: PlanetId, b: PlanetId): boolean => {
    const pa = planetOf(a);
    const pb = planetOf(b);
    return Boolean(pa && pb && a !== b && (pb.sign - pa.sign + 12) % 12 === 6);
  };
  const inExchange = (a: PlanetId, b: PlanetId): boolean => {
    const pa = planetOf(a);
    const pb = planetOf(b);
    return Boolean(
      pa && pb && a !== b &&
      (OWN_SIGNS[a].includes(pb.sign) || SIGN_LORDS[pb.sign] === a) &&
      (OWN_SIGNS[b].includes(pa.sign) || SIGN_LORDS[pa.sign] === b)
    );
  };

  // --- Raja Yoga: kendra lord associated with trikona lord ---
  // BPHS (Raja Yoga adhyaya): the lords of an angle and a trine in
  // conjunction, mutual aspect or exchange produce authority and rise.
  {
    const kendraLords = [...new Set([1, 4, 7, 10].map(lordOfHouse))];
    const trikonaLords = [...new Set([5, 9].map(lordOfHouse))];
    const seen = new Set<string>();
    for (const k of kendraLords) {
      for (const t of trikonaLords) {
        if (k === t || k === "Ra" || k === "Ke" || t === "Ra" || t === "Ke") continue;
        const pairKey = [k, t].sort().join("-");
        if (seen.has(pairKey)) continue;
        const how = inExchange(k, t)
          ? "exchange signs"
          : sameSign(k, t)
            ? "conjoin"
            : mutualSeventh(k, t)
              ? "stand in mutual aspect"
              : null;
        if (!how) continue;
        seen.add(pairKey);
        out.push({
          key: `raja-${pairKey}`,
          name: "Raja Yoga (Kendra–Trikona link)",
          planets: [k, t],
          description: `${PLANET_NAMES[k]} (an angle lord) and ${PLANET_NAMES[t]} (a trine lord) ${how}. The classical engine of rank: the union of dharma and karma lords lifts status, and its results ripen in the dasha periods of the two planets involved.`,
        });
      }
    }
  }

  // --- Dhana Yoga: 2nd and 11th lords linked (wealth axis) ---
  // Standard Dhana rule set: lords of the 2nd (savings) and 11th (income)
  // in conjunction, mutual aspect or exchange; links from 5th/9th lords to
  // the wealth lords count as secondary dhana connections.
  {
    const second = lordOfHouse(2);
    const eleventh = lordOfHouse(11);
    if (second !== eleventh) {
      const how = inExchange(second, eleventh)
        ? "exchange signs"
        : sameSign(second, eleventh)
          ? "conjoin"
          : mutualSeventh(second, eleventh)
            ? "stand in mutual aspect"
            : null;
      if (how) {
        out.push({
          key: "dhana-2-11",
          name: "Dhana Yoga (2nd–11th lords)",
          planets: [second, eleventh],
          description: `The lords of the 2nd house of savings (${PLANET_NAMES[second]}) and the 11th house of income (${PLANET_NAMES[eleventh]}) ${how}. Earning and keeping reinforce each other — a direct classical wealth combination whose results concentrate in these planets' periods.`,
        });
      }
    }
    // Secondary: trine lords touching the wealth lords.
    for (const trine of [5, 9]) {
      const t = lordOfHouse(trine);
      for (const wealthHouse of [2, 11]) {
        const w = lordOfHouse(wealthHouse);
        if (t === w || t === "Ra" || t === "Ke") continue;
        if (sameSign(t, w) || inExchange(t, w)) {
          const key = `dhana-${trine}-${wealthHouse}`;
          if (out.some((y) => y.key === key)) continue;
          out.push({
            key,
            name: `Dhana Yoga (${nth(trine)}–${nth(wealthHouse)} lords)`,
            planets: [t, w],
            description: `The ${nth(trine)} lord ${PLANET_NAMES[t]} joins the ${nth(wealthHouse)} lord ${PLANET_NAMES[w]} — fortune's lord touching the wealth axis. Money arrives through merit, timing or backing rather than grind alone.`,
          });
        }
      }
    }
  }

  // --- Lakshmi Yoga: 9th lord powerfully placed with a sound Lagna lord ---
  {
    const ninth = planetOf(lordOfHouse(9));
    const lagnaLord = planetOf(lordOfHouse(1));
    if (
      ninth && lagnaLord &&
      ["exalted", "moolatrikona", "own"].includes(ninth.dignity) &&
      [...KENDRA, 5, 9].includes(ninth.house) &&
      !DUSTHANA.includes(lagnaLord.house)
    ) {
      out.push({
        key: "lakshmi",
        name: "Lakshmi Yoga",
        planets: [ninth.id, lagnaLord.id],
        description: `The 9th lord ${PLANET_NAMES[ninth.id]} is ${ninth.dignity === "exalted" ? "exalted" : "in its own field"} in the ${ninth.house}th while the Lagna lord stays sound — the combination named for the goddess of fortune. Prosperity, protection and well-timed luck run through the life, strongest in the 9th lord's periods.`,
      });
    }
  }

  // --- Kemadruma: no support around the Moon ---
  // Definition: no planet (Sun and the nodes excluded) in the 2nd or 12th
  // from the Moon. Standard cancellations reported inside the finding rather
  // than silently suppressing it: a planet in a kendra from the Moon, or the
  // Moon itself in a kendra from the Lagna.
  if (mo) {
    const support = chart.planets.some(
      (p) =>
        !["Mo", "Su", "Ra", "Ke"].includes(p.id) &&
        [1, 11].includes((p.sign - mo.sign + 12) % 12) // 2nd or 12th from Moon
    );
    if (!support) {
      const kendraFromMoon = chart.planets.some(
        (p) =>
          !["Mo", "Ra", "Ke"].includes(p.id) &&
          [0, 3, 6, 9].includes((p.sign - mo.sign + 12) % 12)
      );
      const moonInKendra = KENDRA.includes(mo.house);
      const cancels: string[] = [];
      if (kendraFromMoon) cancels.push("planets occupy kendras from the Moon");
      if (moonInKendra) cancels.push("the Moon itself holds a kendra from the Lagna");
      out.push({
        key: "kemadruma",
        name: cancels.length ? "Kemadruma Yoga (cancelled)" : "Kemadruma Yoga",
        planets: ["Mo"],
        description: cancels.length
          ? `The Moon has no planetary neighbour in the signs beside it — Kemadruma forms — but it is cancelled because ${cancels.join(" and ")}. The isolation shows only as an occasional need for solitude, not as the classical loneliness of the yoga.`
          : "The Moon stands unaccompanied — no planet occupies the signs on either side of it. Classically this brings phases of emotional isolation and fluctuating support; building deliberate human anchors (mentors, community, routine) is the working remedy the texts point toward.",
      });
    }
  }

  // --- Shakata: Moon in the 6th/8th/12th from Jupiter ---
  if (mo && ju) {
    const juPos = planetOf("Ju");
    if (juPos) {
      const offset = ((mo.sign - juPos.sign + 12) % 12) + 1;
      if (DUSTHANA.includes(offset) && !KENDRA.includes(mo.house)) {
        out.push({
          key: "shakata",
          name: "Shakata Yoga",
          planets: ["Mo", "Ju"],
          description:
            "The Moon falls in a dusthana counted from Jupiter — the cart-wheel yoga of alternating fortune. Gains and setbacks cycle; the classical counsel is to build reserves in the good phases and avoid overreach at peaks. A kendra Moon would have cancelled it; here it stands.",
        });
      }
    }
  }

  // --- Daridra: 11th lord in a dusthana ---
  {
    const eleventh = planetOf(lordOfHouse(11));
    if (eleventh && DUSTHANA.includes(eleventh.house) && eleventh.id !== "Ra" && eleventh.id !== "Ke") {
      const vrjToo = out.some((y) => y.key === `vrj-${eleventh.id}`);
      out.push({
        key: "daridra",
        name: "Daridra Yoga",
        planets: [eleventh.id],
        description: `The 11th lord ${PLANET_NAMES[eleventh.id]}, carrier of income and gains, sits in the ${eleventh.house}th — a dusthana. Income arrives with friction: leaks, delays or expenditure that shadows earning.${vrjToo ? " Its simultaneous Vipareeta Raja Yoga softens this — losses can invert into gains after struggle." : ""} Budgeting discipline and diversified income are the practical counters.`,
      });
    }
  }

  // --- Kala Sarpa: all seven planets within the Rahu→Ketu arc ---
  {
    const ra = planetOf("Ra");
    const ke = planetOf("Ke");
    const seven = chart.planets.filter((p) => !["Ra", "Ke"].includes(p.id));
    if (ra && ke && seven.length === 7) {
      const inArc = (lon: number, from: number, to: number): boolean => {
        const span = (to - from + 360) % 360;
        const off = (lon - from + 360) % 360;
        return off > 0 && off < span;
      };
      const allRahuSide = seven.every((p) => inArc(p.longitude, ra.longitude, ke.longitude));
      const allKetuSide = seven.every((p) => inArc(p.longitude, ke.longitude, ra.longitude));
      if (allRahuSide || allKetuSide) {
        out.push({
          key: "kala-sarpa",
          name: "Kala Sarpa Yoga",
          planets: ["Ra", "Ke"],
          description: `All seven planets are hemmed within the ${allRahuSide ? "Rahu-to-Ketu" : "Ketu-to-Rahu"} half of the zodiac. Life tends to move in intense, fated-feeling chapters — long plateaus broken by sudden turns — with the nodal axis houses (${ra.house}th and ${ke.house}th) naming the battleground. The tradition treats it as a driver of extraordinary rises as often as obstacles; discipline during the plateaus is what converts it.`,
        });
      }
    }
  }

  // --- Amala: only benefics in the 10th from Lagna or Moon ---
  {
    const tenthSign = (lagna + 9) % 12;
    const moonTenthSign = mo ? (mo.sign + 9) % 12 : null;
    const NATURAL_BENEFIC: PlanetId[] = ["Ju", "Ve", "Me", "Mo"];
    const occupants = (sign: number) => chart.planets.filter((p) => p.sign === sign);
    for (const [from, sign] of [["Lagna", tenthSign], ["the Moon", moonTenthSign]] as const) {
      if (sign === null) continue;
      const occ = occupants(sign);
      if (occ.length > 0 && occ.every((p) => NATURAL_BENEFIC.includes(p.id))) {
        out.push({
          key: `amala-${from === "Lagna" ? "lagna" : "moon"}`,
          name: "Amala Yoga",
          planets: occ.map((p) => p.id),
          description: `Only natural benefics (${occ.map((p) => PLANET_NAMES[p.id]).join(", ")}) occupy the 10th from ${from}. The "stainless" yoga: reputation stays clean, work is respected, and standing survives controversy. Career fortunes rise on merit rather than manoeuvre.`,
        });
        break; // one Amala finding is enough
      }
    }
  }

  return out;
}
