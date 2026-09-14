import { AGE_BANDS, agePriorFor, dateAtAge } from "@/utils/astrology/ageBands";
import { aspectedSigns, aspectsOnSign, planetsAspecting } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import {
  PLANET_DIRECTION,
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
  signMobility,
} from "@/utils/astrology/constants";
import { findActivationWindows } from "@/utils/astrology/scan";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { houseInVarga, type VargaSet } from "@/utils/astrology/varga";
import type { AyanamshaId, ChartData, DashaPeriod, PlanetId } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import type { Evidence, RankedItem, SectionReport, TimingWindow } from "./report";
import { toTimingWindow, verdictOf } from "./report";
import { ordinal } from "./synthesis";

/**
 * Foreign travel & settlement.
 *
 * Sources: 12th house as foreign residence, 9th as long journeys, 3rd as
 * short journeys per the standard house significations (BPHS/Phaladeepika
 * house chapters); the 12th lord's links to the 9th/7th/10th/4th/3rd lords,
 * Rahu joined to the Lagna lord / Moon / 4th lord, Moon in the 12th and Ketu
 * in the 4th per the applied literature (work-level citations — these are
 * consensus rules of practice rather than verse-anchored); Rahu as the
 * karaka of foreign lands (consensus of the standard literature);
 * movable-sign emphasis for mobility and fixed-sign emphasis against it
 * (classical sign taxonomy, BPHS Ch.4); the Lagna lord in the 1st/4th and a
 * well-placed, unafflicted 4th lord counted *against* settlement, so the
 * "why" list can say what holds a person home as well as what pulls them
 * away; D-4 (Chaturthamsa — property, home and fortune)
 * corroboration per Shodasavarga usage. D-12 (Dwadasamsa) is deliberately
 * *not* used here despite appearing in some modern write-ups of this topic:
 * this app's own varga significations (utils/astrology/varga.ts) hold it to
 * its classical remit of parents and ancestry, not residence, so borrowing it
 * for a foreign-settlement corroboration would be citing a chart for
 * something it doesn't classically speak to. Direction indications use the
 * digpati scheme and are explicitly capped at low-to-moderate confidence —
 * they are the weakest technique in this section.
 *
 * Every evidence entry below is tagged with the scenario(s) it actually
 * scores (`tags: ["travel" | "stay" | "settle"]`). The three RankedItems'
 * `reasons` are filtered on those tags rather than matched against keywords
 * in the prose — so what a reader sees under "why" always matches what moved
 * that scenario's number, even after the wording above is edited.
 */

export interface ForeignReport extends SectionReport {
  scenarios: RankedItem[]; // short travel / long stay / settlement
  purpose: string[];
  direction: string | null;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function buildForeignReport(
  chart: ChartData,
  vargas: VargaSet | null,
  strengths: Partial<Record<PlanetId, PlanetStrength>>
): ForeignReport {
  const lagna = chart.ascendant.sign;
  const caveats: string[] = [];
  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  const evidence: Evidence[] = [];
  // Base scores are set so that a chart with no foreign signature at all reads
  // as "Needs effort" for travel and "Challenged" for staying/settling, and a
  // chart carrying three or four of the standard signatures reaches
  // "Supportive"/"Strong promise". Calibrated against a 400-chart random
  // sample AND a known settled-abroad chart (see SOURCES.md, foreign.ts
  // row): the original bases (20/10/5) put 70% of all charts in "Challenged"
  // for living abroad, which no real population matches. Re-tune both
  // together whenever a rule is added — the medians drift up otherwise.
  let travelScore = 24; // short journeys base
  let stayScore = 12;   // long stays abroad
  let settleScore = 6;  // permanent settlement

  const lagnaLordId = SIGN_LORDS[lagna];
  const lagnaLord = planetOf(lagnaLordId);
  const houseSign = (h: number) => (lagna + h - 1) % 12;
  const lordOfHouse = (h: number) => SIGN_LORDS[houseSign(h)];
  const twelfthSign = houseSign(12);
  const twelfthLordId = lordOfHouse(12);
  const twelfthLord = planetOf(twelfthLordId);
  const ninthLordId = lordOfHouse(9);
  const ninthLord = planetOf(ninthLordId);
  const seventhLordId = lordOfHouse(7);
  const seventhLord = planetOf(seventhLordId);
  const tenthLordId = lordOfHouse(10);
  const tenthLord = planetOf(tenthLordId);
  const thirdLordId = lordOfHouse(3);
  const thirdLord = planetOf(thirdLordId);
  const fourthSign = houseSign(4);
  const fourthLordId = lordOfHouse(4);
  const fourthLord = planetOf(fourthLordId);
  const rahu = planetOf("Ra");
  const ketu = planetOf("Ke");
  const moon = planetOf("Mo");
  const saturn = planetOf("Sa");
  const isWater = (sign: number) => sign % 4 === 3; // Cancer, Scorpio, Pisces

  // --- 12th house: foreign residence ---
  const twelfthOccupants = chart.planets.filter((p) => p.house === 12);
  for (const p of twelfthOccupants) {
    stayScore += 8;
    settleScore += 6;
    evidence.push({
      text: `${PLANET_NAMES[p.id]} sits in your 12th house, the house of distant places and of life lived away from where you started. A planet there keeps pulling your attention over the horizon, even in years when you do not move.`,
      weight: 7,
      source: { work: "BPHS", ref: "12th-house significations" },
      tags: ["stay", "settle"],
    });
  }
  if (moon && moon.house === 12) {
    stayScore += 4;
    settleScore += 3;
    evidence.push({
      text: "The Moon in particular is the planet that stands for your mind and for where you feel at home, and it is one of the planets in your 12th. That is the specific signature of someone whose sense of home forms away from where they were born, rather than someone who merely travels.",
      weight: 4,
      source: { work: "standard literature", ref: "Moon in the 12th — residence abroad" },
      tags: ["stay", "settle"],
    });
  }
  if (twelfthLord) {
    const s = strengths[twelfthLordId];
    if (s && s.score >= 55) {
      stayScore += 6;
      evidence.push({ text: `${PLANET_NAMES[twelfthLordId]} rules your 12th house and is strong (${s.score}/100), which is the difference between a foreign house that delivers and one that only drains. Time spent abroad tends to come back to you as something — money, skill, a life — rather than just disappearing.`, weight: 6, tags: ["stay"] });
    }
  }

  // --- Lagna lord in the 12th / 12th lord in the Lagna: the classic swap ---
  if (lagnaLord && lagnaLord.house === 12) {
    stayScore += 12;
    settleScore += 10;
    evidence.push({
      text: `The ruler of your rising sign, ${PLANET_NAMES[lagnaLordId]}, sits in your 12th house — the clearest classical signature there is for a life lived away from where it began. It usually shows up as a pull you feel long before there is a practical reason for it.`,
      weight: 10,
      source: { work: "Phaladeepika", ref: "Lagna lord in the 12th" },
      tags: ["stay", "settle"],
    });
  }
  if (twelfthLord && twelfthLord.house === 1) {
    stayScore += 8;
    settleScore += 4;
    evidence.push({ text: "Your 12th ruler stands in your 1st house, which brings foreign themes right onto your own identity. People often read you as someone who has been elsewhere, sometimes before you have.", weight: 7, tags: ["stay", "settle"] });
  }
  if (lagnaLord && [6, 8].includes(lagnaLord.house)) {
    stayScore += 6;
    settleScore += 5;
    evidence.push({
      text: `The ruler of your rising sign, ${PLANET_NAMES[lagnaLordId]}, sits in your ${ordinal(lagnaLord.house)} house — one of the three "away" houses (the 6th, 8th and 12th). The tradition reads the ruler of the self in any of them as a life lived at a distance from where it began${lagnaLord.house === 6 ? ", and the 6th in particular as a living made through service or employment away from home" : ""}. It is a quieter version of the 12th-house signature, but it points the same way.`,
      weight: 6,
      source: { work: "standard literature", ref: `Lagna lord in the ${ordinal(lagnaLord.house)} — away from the birthplace` },
      tags: ["stay", "settle"],
    });
  }

  // --- Lords looking at the 12th: an aspect is a classical connection too ---
  {
    const lookers = ([
      [lagnaLord, "the ruler of your rising sign"],
      [moon, "your Moon"],
      [ninthLord, "the ruler of your 9th house of long journeys"],
    ] as const)
      .filter(([p]) => p && p.house !== 12 && aspectedSigns(p.id, p.sign).includes(twelfthSign))
      .filter(([p], i, arr) => arr.findIndex(([q]) => q!.id === p!.id) === i)
      .map(([p, label]) => `${PLANET_NAMES[p!.id]} (${label})`);
    if (lookers.length) {
      const gain = Math.min(2, lookers.length);
      stayScore += 2 + 2 * gain;
      settleScore += 2 * gain;
      travelScore += gain;
      evidence.push({
        text: `${lookers.join(" and ")} ${lookers.length > 1 ? "aspect" : "aspects"} your 12th house of distant lands. A planet does not have to sit in a house to be tied to it — its aspect is a classical connection — and when the planets that stand for you, your mind or your fortune keep looking at the house of far-away places, the far-away place keeps coming up in your life.`,
        weight: 2 + 2 * gain,
        source: { work: "standard literature", ref: "Lagna lord / Moon / 9th lord aspecting the 12th" },
        tags: ["travel", "stay", "settle"],
      });
    }
  }

  // --- Where else the 12th lord goes, and who comes to the 12th ---
  // The 12th (foreign residence) linked to the 9th (long journeys, fortune),
  // 7th (partner, the "other place" in horary practice), 10th (work), 4th
  // (home) or 3rd (short journeys) is how the applied literature reads what
  // kind of foreign life the chart is set up for. Each link is counted once,
  // whichever direction it runs in.
  // When one planet rules both houses (Jupiter for Aries rising owns the 9th
  // and 12th, say) the "link" is that planet standing in either house; the
  // wording has to say so rather than pretend two planets met.
  const linked = (a: typeof lagnaLord, aHouse: number, b: typeof lagnaLord, bHouse: number) => {
    if (!a || !b) return false;
    if (a.id === b.id) return a.house === aHouse || a.house === bHouse;
    return a.house === bHouse || b.house === aHouse || a.sign === b.sign;
  };
  const linkPhrase = (a: typeof lagnaLord, aLabel: string, b: typeof lagnaLord, bLabel: string) =>
    a && b && a.id === b.id
      ? `${PLANET_NAMES[a.id]} rules both — ${aLabel} and ${bLabel} — and sits in the ${ordinal(a.house)}`
      : `${PLANET_NAMES[a!.id]} (${aLabel}) and ${PLANET_NAMES[b!.id]} (${bLabel}) sit together or in each other's houses`;
  if (linked(twelfthLord, 12, ninthLord, 9)) {
    stayScore += 8;
    settleScore += 6;
    travelScore += 4;
    evidence.push({
      text: `The rulers of your 12th house (distant lands) and your 9th house (long journeys and fortune) are joined: ${linkPhrase(twelfthLord, "your 12th", ninthLord, "your 9th")}. In the applied tradition this is the strongest single tie between "far away" and "your luck": the good things in your life have a way of being on the other side of a long journey.`,
      weight: 8,
      source: { work: "standard literature", ref: "9th–12th lord connection" },
      tags: ["travel", "stay", "settle"],
    });
  }
  if (linked(twelfthLord, 12, seventhLord, 7)) {
    stayScore += 6;
    settleScore += 4;
    evidence.push({
      text: `Your 12th house (distant lands) and your 7th house (partner, and the people you do business with) are tied together: ${linkPhrase(twelfthLord, "your 12th", seventhLord, "your 7th")}. So foreign life in your chart tends to arrive through a person — a marriage, a partnership, a client — rather than through a plan you made alone.`,
      weight: 6,
      source: { work: "standard literature", ref: "7th–12th lord connection" },
      tags: ["stay", "settle"],
    });
  }
  if (linked(twelfthLord, 12, tenthLord, 10)) {
    stayScore += 7;
    travelScore += 3;
    evidence.push({
      text: `Your 12th house (distant lands) and your 10th house (your working life) are tied together: ${linkPhrase(twelfthLord, "your 12th", tenthLord, "your 10th")}. The most likely door abroad for you is therefore a job — a posting, a transfer, a role that only exists somewhere else — and it tends to open in the periods of these planets.`,
      weight: 6,
      source: { work: "standard literature", ref: "10th–12th lord connection" },
      tags: ["travel", "stay"],
    });
  }
  if (twelfthLord && twelfthLord.house === 4) {
    settleScore += 6;
    stayScore += 3;
    evidence.push({
      text: `Your 12th ruler ${PLANET_NAMES[twelfthLordId]} sits in your 4th house — the house of home. The foreign house has moved into the home house, which is the classical picture of a distant place that eventually becomes where you live, not just where you go.`,
      weight: 6,
      source: { work: "standard literature", ref: "12th lord in the 4th" },
      tags: ["stay", "settle"],
    });
  }
  if (linked(twelfthLord, 12, thirdLord, 3)) {
    travelScore += 5;
    evidence.push({
      text: `Your 12th house (distant lands) and your 3rd house (short trips) are tied together: ${linkPhrase(twelfthLord, "your 12th", thirdLord, "your 3rd")}. This reads as a lot of going and coming rather than one big move: frequent flights, short stints, work that keeps you in motion.`,
      weight: 5,
      tags: ["travel"],
    });
  }

  // --- 9th: long journeys; 3rd: short journeys ---
  const ninthOccupants = chart.planets.filter((p) => p.house === 9);
  if (ninthOccupants.length) {
    travelScore += Math.min(3, ninthOccupants.length) * 6;
    stayScore += Math.min(3, ninthOccupants.length) * 2;
    evidence.push({ text: `${ninthOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} ${ninthOccupants.length > 1 ? "occupy" : "occupies"} your 9th house of long journeys and higher learning, so travel in your life tends to have a purpose attached — study, teaching, belief, or something you went to find.`, weight: 6, source: { work: "BPHS", ref: "9th-house significations" }, tags: ["travel", "stay"] });
  }
  const thirdOccupants = chart.planets.filter((p) => p.house === 3);
  if (thirdOccupants.length) {
    travelScore += Math.min(3, thirdOccupants.length) * 4;
    evidence.push({ text: `${thirdOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} ${thirdOccupants.length > 1 ? "occupy" : "occupies"} your 3rd house of short journeys, which reads as frequent movement rather than distant movement — a life with a lot of trips in it.`, weight: 4, source: { work: "BPHS", ref: "3rd-house significations" }, tags: ["travel"] });
  }
  if (lagnaLord && [3, 7, 9].includes(lagnaLord.house)) {
    const gain = lagnaLord.house === 9 ? 5 : lagnaLord.house === 3 ? 4 : 3;
    travelScore += gain;
    stayScore += lagnaLord.house === 3 ? 0 : 3;
    evidence.push({
      text: `The ruler of your rising sign, ${PLANET_NAMES[lagnaLordId]}, sits in your ${ordinal(lagnaLord.house)} house — ${lagnaLord.house === 9 ? "the house of long journeys" : lagnaLord.house === 3 ? "the house of short journeys" : "the house of the other place and the other person"}. You, personally, are placed in a travelling house, which usually shows up as a life that keeps moving even when you did not plan it to.`,
      weight: gain,
      tags: lagnaLord.house === 3 ? ["travel"] : ["travel", "stay"],
    });
  }
  if (moon && [3, 7, 9].includes(moon.house)) {
    travelScore += 3;
    evidence.push({
      text: `Your Moon — the planet of the mind — sits in your ${ordinal(moon.house)}, one of the houses of movement. The mind itself is restless in a productive way: it settles best when there is a journey somewhere in the calendar.`,
      weight: 3,
      tags: ["travel"],
    });
  }

  // --- 4th house: the roots, loosened or held ---
  const maleficsOnFourth = aspectsOnSign(chart, fourthSign).filter((a) => ["Sa", "Ma", "Ra", "Ke"].includes(a));
  const maleficsInFourth = chart.planets.filter((p) => p.house === 4 && ["Sa", "Ma", "Ra", "Ke"].includes(p.id));
  let rootsLoosened = false;
  if (fourthLord && [6, 8, 12].includes(fourthLord.house)) {
    rootsLoosened = true;
    settleScore += fourthLord.house === 12 ? 9 : 7;
    stayScore += 3;
    evidence.push({
      text: fourthLord.house === 12
        ? `The ruler of your 4th house — home, family land, the place you are from — sits in your 12th, the house of distant lands. Home itself has been placed abroad. Of all the settlement signatures this is one of the most literal, and it often feels less like wanderlust than like the place you were born never quite closing around you.`
        : `The ruler of your 4th house — home, family land, the place you are from — sits in the ${ordinal(fourthLord.house)}, which loosens your roots. That is the classical precondition for settling somewhere else, and it often feels less like wanderlust than like home never quite closing around you.`,
      weight: 7,
      source: { work: "Phaladeepika", ref: "4th lord in dusthana" },
      tags: ["stay", "settle"],
    });
  }
  if (maleficsOnFourth.length >= 2) {
    rootsLoosened = true;
    settleScore += 4;
    evidence.push({ text: `${maleficsOnFourth.map((a) => PLANET_NAMES[a]).join(", ")} press on your 4th house of home. Comfort is something you build rather than inherit, which means you can build it abroad about as easily as you can build it where you were born.`, weight: 3, tags: ["settle"] });
  }
  if (ketu && ketu.house === 4) {
    rootsLoosened = true;
    settleScore += 5;
    stayScore += 2;
    evidence.push({
      text: "Ketu sits in your 4th house. Ketu is the planet of letting go, and in the house of home it loosens the tie to the birthplace from the inside — people with this placement tend to feel that home is something they carry rather than somewhere they return to, which makes leaving easier than it is for most.",
      weight: 5,
      source: { work: "standard literature", ref: "Ketu in the 4th" },
      tags: ["stay", "settle"],
    });
  }
  if (rahu && rahu.house === 4) rootsLoosened = true;
  if (fourthLord) {
    const hard: PlanetId[] = ["Sa", "Ma", "Ra", "Ke"];
    const withLord = chart.planets.filter((p) => p.id !== fourthLord.id && p.sign === fourthLord.sign && hard.includes(p.id)).map((p) => p.id);
    const onLord = planetsAspecting(chart, fourthLord.id).filter((id) => hard.includes(id));
    const afflictors = [...new Set([...withLord, ...onLord])];
    const nodal = afflictors.some((id) => id === "Ra" || id === "Ke");
    if (afflictors.length >= 2 || (nodal && afflictors.length >= 1 && withLord.length)) {
      rootsLoosened = true;
      settleScore += 4;
      stayScore += 2;
      evidence.push({
        text: `${PLANET_NAMES[fourthLordId]}, the ruler of your 4th house of home, is pressed on by ${afflictors.map((id) => PLANET_NAMES[id]).join(" and ")}${withLord.length ? " (sitting with it or aspecting it)" : " (by aspect)"}. The home house itself may look quiet, but its ruler is under strain — which in practice reads as roots that are easier to lift than they appear from outside.`,
        weight: 4,
        source: { work: "standard literature", ref: "afflicted 4th lord" },
        tags: ["stay", "settle"],
      });
    }
  }

  // --- Rahu links ---
  if (rahu) {
    if ([12, 9, 4, 1, 7].includes(rahu.house)) {
      stayScore += 6;
      settleScore += 5;
      evidence.push({
        text: `Rahu, the planet of foreign places and of everything unfamiliar, sits in your ${ordinal(rahu.house)} house. Wherever Rahu falls is where you are willing to be a beginner in a strange place — and that willingness is most of what migration actually asks for.`,
        weight: 6,
        source: { work: "standard literature", ref: "Rahu as videsha karaka" },
        tags: ["stay", "settle"],
      });
    } else if ([3, 10].includes(rahu.house)) {
      travelScore += 4;
      stayScore += 3;
      evidence.push({
        text: `Rahu, the planet of foreign places, sits in your ${ordinal(rahu.house)} house — ${rahu.house === 10 ? "the house of work" : "the house of short journeys"}. That is the signature of foreign contact coming through ${rahu.house === 10 ? "your career: foreign employers, foreign clients, or a posting" : "constant movement: trips that add up rather than one move"}.`,
        weight: 4,
        source: { work: "standard literature", ref: "Rahu as videsha karaka" },
        tags: ["travel", "stay"],
      });
    }
    const rahuWith = ([
      [lagnaLord, "the ruler of your rising sign"],
      [moon, "your Moon"],
      [fourthLord, "the ruler of your 4th house of home"],
      [twelfthLord, "the ruler of your 12th house of distant lands"],
      [ninthLord, "the ruler of your 9th house of long journeys"],
    ] as const)
      .filter(([p]) => p && p.id !== "Ra" && p.id !== "Ke" && p.sign === rahu.sign)
      .map(([p, label]) => `${PLANET_NAMES[p!.id]} (${label})`);
    if (rahuWith.length) {
      const gain = Math.min(2, rahuWith.length);
      stayScore += 5 * gain;
      settleScore += 4 * gain;
      evidence.push({
        text: `Rahu shares a sign with ${rahuWith.join(" and ")}. When the foreign planet sits on the planets that stand for you, your mind or your home, it puts the unfamiliar right at the centre of your life rather than at its edge — this is one of the most common signatures in the charts of people who actually emigrate.`,
        weight: 5 * gain,
        source: { work: "standard literature", ref: "Rahu with the Lagna lord / Moon / 4th lord" },
        tags: ["stay", "settle"],
      });
    }
    const rahuOn = ([
      [lagnaLord, "the ruler of your rising sign"],
      [moon, "your Moon"],
      [fourthLord, "the ruler of your 4th house of home"],
      [twelfthLord, "the ruler of your 12th house of distant lands"],
    ] as const)
      .filter(([p]) => p && p.id !== "Ra" && p.id !== "Ke" && p.sign !== rahu.sign && aspectedSigns("Ra", rahu.sign).includes(p.sign))
      .filter(([p], i, arr) => arr.findIndex(([q]) => q!.id === p!.id) === i)
      .map(([p, label]) => `${PLANET_NAMES[p!.id]} (${label})`);
    if (rahuOn.length) {
      const gain = Math.min(2, rahuOn.length);
      stayScore += 3 * gain;
      settleScore += 3 * gain;
      evidence.push({
        text: `Rahu aspects ${rahuOn.join(" and ")}. An aspect is a lighter touch than sitting together, but it is the same message: the planet of the unfamiliar has a hand on the things that stand for you, your mind, your home or the far-away place — and where Rahu presses, the familiar option tends not to be the one taken.`,
        weight: 3 * gain,
        source: { work: "standard literature", ref: "Rahu's aspect on the Lagna lord / Moon / 4th lord / 12th lord" },
        tags: ["stay", "settle"],
      });
    }
    if (saturn && saturn.sign === rahu.sign) {
      stayScore += 4;
      evidence.push({ text: "Saturn sits with Rahu in your chart, which lengthens foreign stints into something structural. Time abroad tends to come in years rather than months, and to change the shape of your life rather than decorate it.", weight: 4, tags: ["stay"] });
    }
  }
  if (twelfthLord) {
    const company = chart.planets
      .filter((p) => p.id !== twelfthLord.id && p.sign === twelfthLord.sign && ["Sa", "Ra", "Ke"].includes(p.id))
      .filter((p) => !(p.id === "Ra" && rahu && rahu.house === 12)) // Rahu in the 12th is already counted above
      .map((p) => PLANET_NAMES[p.id]);
    if (company.length) {
      stayScore += 4;
      settleScore += 4;
      evidence.push({
        text: `${PLANET_NAMES[twelfthLordId]}, the ruler of your 12th house, sits with ${company.join(" and ")}. Saturn, Rahu and Ketu are the three planets most associated with distance, separation and the unfamiliar; any of them keeping company with the ruler of the house of distant lands colours that house toward a long time away rather than a short one.`,
        weight: 4,
        source: { work: "standard literature", ref: "12th lord with Saturn / Rahu / Ketu" },
        tags: ["stay", "settle"],
      });
    }
  }

  // --- Sign emphasis: movable signs move, fixed signs stay ---
  {
    const triad = [chart.ascendant.sign, ...chart.planets.filter((p) => ["Su", "Mo"].includes(p.id)).map((p) => p.sign)];
    const movers = triad.filter((s) => signMobility(s) === "movable").length;
    const fixed = triad.filter((s) => signMobility(s) === "fixed").length;
    if (movers >= 2) {
      travelScore += 6;
      stayScore += 4;
      evidence.push({ text: `${movers} of your rising sign, Sun and Moon fall in movable signs, so motion is native to you rather than something you force. Staying still for long stretches is usually the thing that costs you effort.`, weight: 5, source: { work: "BPHS", ref: "Ch.4 sign taxonomy" }, tags: ["travel", "stay"] });
    } else if (fixed >= 2) {
      travelScore -= 4;
      stayScore -= 3;
      evidence.push({ text: `${fixed} of your rising sign, Sun and Moon fall in fixed signs, and fixed signs prefer to stay put. Moving is something you do for a reason rather than for its own sake, and once you have arrived somewhere you tend to stay — which counts a little against constant travel, and not at all against a single decisive move.`, weight: -3, source: { work: "BPHS", ref: "Ch.4 sign taxonomy" }, tags: ["travel", "stay"] });
    }
    const watery = [twelfthSign, ...(twelfthLord ? [twelfthLord.sign] : [])].filter(isWater).length;
    if (watery && (twelfthOccupants.length || (twelfthLord && [1, 4, 7, 9, 10].includes(twelfthLord.house)))) {
      travelScore += 2;
      stayScore += 2;
      evidence.push({ text: "Your 12th house, or its ruler, falls in a water sign. The old texts read water on the house of distant lands as journeys across the sea — in modern terms, the foreign place in your chart is more likely to be overseas than over a land border.", weight: 2, source: { work: "standard literature", ref: "watery signs and sea voyages" }, tags: ["travel", "stay"] });
    }
  }

  // --- What holds you where you are (counted against) ---
  if (lagnaLord && [1, 4].includes(lagnaLord.house) && !(rahu && rahu.sign === lagnaLord.sign)) {
    stayScore -= 5;
    settleScore -= 6;
    evidence.push({
      text: `The ruler of your rising sign, ${PLANET_NAMES[lagnaLordId]}, sits in your ${lagnaLord.house === 1 ? "1st house — your own house" : "4th house — the house of home"}. That anchors you: your sense of self is tied to where you are from, and while it does not stop you going abroad, it is the single most common reason a person with foreign chances still chooses to come back.`,
      weight: -5,
      source: { work: "BPHS", ref: `Lagna lord in the ${ordinal(lagnaLord.house)}` },
      tags: ["stay", "settle"],
    });
  }
  if (
    !rootsLoosened &&
    fourthLord &&
    [1, 4, 5, 7, 9, 10].includes(fourthLord.house) &&
    maleficsOnFourth.length === 0 &&
    maleficsInFourth.length === 0
  ) {
    settleScore -= 5;
    stayScore -= 2;
    evidence.push({
      text: `Your 4th house of home is in good order: its ruler ${PLANET_NAMES[fourthLordId]} sits in a supportive house (the ${ordinal(fourthLord.house)}) and no difficult planet presses on the home. Roots that hold this well are a real asset — and they are also the reason permanent settlement elsewhere is less likely for you than a long stay with a return.`,
      weight: -4,
      source: { work: "BPHS", ref: "4th lord well placed" },
      tags: ["stay", "settle"],
    });
  }

  // --- D-4 corroboration (D-12 deliberately excluded — see file header) ---
  if (vargas) {
    const d4 = vargas.charts.D4;
    const d4Twelfth = chart.planets.filter((p) => {
      const pos = d4.positions.find((q) => q.id === p.id);
      return pos && houseInVarga(d4, pos.sign) === 12;
    });
    if (d4Twelfth.length >= 2) {
      settleScore += 4;
      evidence.push({ text: `${d4Twelfth.length} planets fall in the 12th house of your D-4, the chart read specifically for where you live. That is an independent second source agreeing with the relocation reading rather than the same evidence counted twice.`, weight: 3, source: { work: "BPHS", ref: "Ch.6 (Chaturthamsa)" }, tags: ["settle"] });
    }
  } else {
    caveats.push(
      "The D-4 chart, which corroborates where you live, could not be built here. The reading below rests on the birth chart alone, which is workable but thinner than it should be."
    );
  }

  // --- Scenarios ---
  // Each scenario's `reasons` is the evidence actually tagged for it, not a
  // keyword match against the prose — so "why" always agrees with the score
  // above it, even evidence that also feeds another scenario (shown there
  // too, honestly, since it really did move both numbers).
  const norm = (x: number) => clamp(Math.round(x), 5, 95);
  const reasonsFor = (tag: "travel" | "stay" | "settle") => evidence.filter((e) => e.tags?.includes(tag));
  const scenarios: RankedItem[] = [
    {
      key: "travel",
      label: "Travelling often — trips, assignments, pilgrimages, and back home again",
      score: norm(travelScore + stayScore * 0.3),
      verdict: verdictOf(norm(travelScore + stayScore * 0.3)),
      reasons: reasonsFor("travel"),
    },
    {
      key: "stay",
      label: "Living abroad for years at a time — work or study, with a return in mind",
      score: norm(stayScore + travelScore * 0.2),
      verdict: verdictOf(norm(stayScore + travelScore * 0.2)),
      reasons: reasonsFor("stay"),
    },
    {
      key: "settle",
      label: "Settling for good somewhere other than where you were born",
      score: norm(settleScore + stayScore * 0.4),
      verdict: verdictOf(norm(settleScore + stayScore * 0.4)),
      reasons: reasonsFor("settle"),
    },
  ].sort((a, b) => b.score - a.score);

  // --- Purpose ---
  const purpose: string[] = [];
  if (lagnaLord && lagnaLord.house === 12)
    purpose.push("a move you choose rather than one you are pushed into — the initiative is yours");
  const tenthLinks = chart.planets.filter((p) => p.house === 12 && ownedHouses(p.id, lagna).includes(10)).length;
  if (tenthLinks || (twelfthLord && ownedHouses(twelfthLordId, lagna).includes(10)) || linked(twelfthLord, 12, tenthLord, 10) || (rahu && rahu.house === 10))
    purpose.push("work — a posting, a transfer, or a job that only exists somewhere else");
  const ninthLinks = ninthOccupants.length > 0 || linked(twelfthLord, 12, ninthLord, 9);
  if (ninthLinks) purpose.push("study or teaching — going to learn something, or to pass it on");
  if ((rahu && rahu.house === 7) || linked(twelfthLord, 12, seventhLord, 7))
    purpose.push("a marriage or a business partnership that takes you abroad");
  if (!purpose.length)
    purpose.push(
      "mixed motives rather than one clear driver — no single house dominates the foreign axis in your chart, which usually means the reason arrives with the opportunity"
    );

  // --- Direction (capped confidence, prominent caveat) ---
  let direction: string | null = null;
  const strongestForeign = [twelfthLord, rahu, ...twelfthOccupants]
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .sort((a, b) => (strengths[b.id]?.score ?? 0) - (strengths[a.id]?.score ?? 0))[0];
  if (strongestForeign && PLANET_DIRECTION[strongestForeign.id]) {
    direction = `Tradition reads a direction from your strongest foreign significator, which is ${PLANET_NAMES[strongestForeign.id]}: ${PLANET_DIRECTION[strongestForeign.id]} of your birthplace. Hold this one loosely. Direction rules are the weakest technique on this page, and no sensible decision about where to live should turn on them — if a good opportunity points the other way, take the opportunity.`;
  }

  const top = scenarios[0];
  const confidence = clamp(35 + evidence.length * 5 + (vargas ? 5 : 0), 25, 75); // capped ≤75 by design

  const shortLabel = (key: string) =>
    key === "travel" ? "travelling often" : key === "stay" ? "living abroad for a stretch of years" : "settling permanently somewhere else";
  const headline =
    top.score >= 60
      ? `Your chart leans clearly toward ${shortLabel(top.key)}${scenarios[1].score >= 56 ? `, with ${shortLabel(scenarios[1].key)} close behind` : ""}.`
      : top.score >= 45
        ? `Foreign themes are present in your chart at a moderate level — ${shortLabel(top.key)} is the shape they most naturally take, and the place you come from keeps its pull on you.`
        : "Foreign themes are faint in your chart. Life is most likely anchored near where it began, with travel as visits rather than moves — which says nothing about opportunity, only about where the chart's own weight sits.";

  return {
    key: "foreign",
    title: "Foreign Travel & Settlement",
    headline,
    score: top.score,
    verdict: top.verdict as ForeignReport["verdict"],
    confidence,
    blocks: [
      {
        heading: "Three different lives abroad, scored separately",
        paragraphs: [
          "Travelling often, living abroad for years, and settling permanently are three different things, and a chart can be strong for one and quiet on the others. They are scored independently here for that reason.",
          "These are tendencies rather than certainties. A strong score means the chart supports that shape of life and it tends to come easily; a low one means it costs more effort, not that it is closed to you.",
          "Open any row to see what moved its number. A ▲ is a signature that pulls you abroad, a ▼ is something that holds you where you are. A low score with only ▲ reasons under it simply means few of the classical signatures are present — nothing in the chart is pushing back.",
        ],
        items: scenarios,
      },
      {
        heading: "What tends to take you there",
        paragraphs: [
          `The foreign houses in your chart point at ${purpose.join("; ")}. That is usually the thread worth following when an opportunity appears and you are trying to judge whether it is the one.`,
        ],
      },
      ...(direction ? [{ heading: "Direction — the softest reading here", paragraphs: [direction] }] : []),
    ],
    caveats,
    hasDasha: Boolean(chart.birthUtc),
    scenarios,
    purpose,
    direction,
  };
}

/**
 * Foreign-travel activation windows — computed on demand. Scanned across the
 * migration years (ages 18–55: study migration early, work migration later)
 * rather than a rolling 15 years, so a reader who already moved can see which
 * window carried the move. `now` only labels each window past/current/future.
 */
export function foreignTimingWindows(
  chart: ChartData,
  dashaTree: DashaPeriod[] | null,
  ayanamsha: AyanamshaId,
  av: AshtakavargaResult | null,
  now: Date
): TimingWindow[] {
  if (!dashaTree || !chart.birthUtc) return [];
  const birth = chart.birthUtc;
  const band = AGE_BANDS.foreign;
  return findActivationWindows(
    chart, dashaTree, ayanamsha, av,
    {
      houses: [12, 9, 3, 7],
      karakas: ["Ra", "Sa"],
      maxWindows: 5,
      agePriorAt: agePriorFor(birth, band),
      relativeTo: now,
    },
    dateAtAge(birth, band.start), dateAtAge(birth, band.end)
  ).map((w) =>
    toTimingWindow(w, `${PLANET_NAMES[w.dasha.maha]}–${PLANET_NAMES[w.dasha.antar]} period`, birth)
  );
}
