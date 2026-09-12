import { AGE_BANDS, agePriorFor, dateAtAge } from "@/utils/astrology/ageBands";
import { aspectsOnSign } from "@/utils/astrology/aspects";
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
 * house chapters); Rahu as the karaka of foreign lands (consensus of the
 * standard literature); movable-sign emphasis for mobility (classical sign
 * taxonomy, BPHS Ch.4); D-4 (Chaturthamsa — property, home and fortune)
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
  let travelScore = 20; // short journeys base
  let stayScore = 10;   // long stays abroad
  let settleScore = 5;  // permanent settlement

  const lagnaLordId = SIGN_LORDS[lagna];
  const lagnaLord = planetOf(lagnaLordId);
  const twelfthSign = (lagna + 11) % 12;
  const twelfthLordId = SIGN_LORDS[twelfthSign];
  const twelfthLord = planetOf(twelfthLordId);
  const rahu = planetOf("Ra");

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
    evidence.push({ text: "Your 12th ruler stands in your 1st house, which brings foreign themes right onto your own identity. People often read you as someone who has been elsewhere, sometimes before you have.", weight: 7, tags: ["stay"] });
  }

  // --- 9th: long journeys; 3rd: short journeys ---
  const ninthOccupants = chart.planets.filter((p) => p.house === 9);
  if (ninthOccupants.length) {
    travelScore += 6 * ninthOccupants.length;
    evidence.push({ text: `${ninthOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} occupies your 9th house of long journeys and higher learning, so travel in your life tends to have a purpose attached — study, teaching, belief, or something you went to find.`, weight: 6, tags: ["travel"] });
  }
  const thirdOccupants = chart.planets.filter((p) => p.house === 3);
  if (thirdOccupants.length) {
    travelScore += 4 * thirdOccupants.length;
    evidence.push({ text: `${thirdOccupants.map((p) => PLANET_NAMES[p.id]).join(", ")} occupies your 3rd house of short journeys, which reads as frequent movement rather than distant movement — a life with a lot of trips in it.`, weight: 4, tags: ["travel"] });
  }

  // --- 4th house afflicted: leaving the homeland ---
  {
    const fourthSign = (lagna + 3) % 12;
    const fourthLordId = SIGN_LORDS[fourthSign];
    const fourthLord = planetOf(fourthLordId);
    const maleficsOnFourth = aspectsOnSign(chart, fourthSign).filter((a) => ["Sa", "Ma", "Ra", "Ke"].includes(a));
    if (fourthLord && [6, 8, 12].includes(fourthLord.house)) {
      settleScore += 7;
      evidence.push({
        text: `The ruler of your 4th house — home, family land, the place you are from — sits in the ${ordinal(fourthLord.house)}, which loosens your roots. That is the classical precondition for settling somewhere else, and it often feels less like wanderlust than like home never quite closing around you.`,
        weight: 6,
        source: { work: "Phaladeepika", ref: "4th lord in dusthana" },
        tags: ["settle"],
      });
    }
    if (maleficsOnFourth.length >= 2) {
      settleScore += 4;
      evidence.push({ text: `${maleficsOnFourth.map((a) => PLANET_NAMES[a]).join(", ")} press on your 4th house of home. Comfort is something you build rather than inherit, which means you can build it abroad about as easily as you can build it where you were born.`, weight: 3, tags: ["settle"] });
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
    }
    const saturn = planetOf("Sa");
    if (saturn && saturn.sign === rahu.sign) {
      stayScore += 4;
      evidence.push({ text: "Saturn sits with Rahu in your chart, which lengthens foreign stints into something structural. Time abroad tends to come in years rather than months, and to change the shape of your life rather than decorate it.", weight: 4, tags: ["stay"] });
    }
  }

  // --- Movable-sign emphasis ---
  {
    const movers = [chart.ascendant.sign, ...chart.planets.filter((p) => ["Su", "Mo"].includes(p.id)).map((p) => p.sign)]
      .filter((s) => signMobility(s) === "movable").length;
    if (movers >= 2) {
      travelScore += 6;
      stayScore += 4;
      evidence.push({ text: `${movers} of your rising sign, Sun and Moon fall in movable signs, so motion is native to you rather than something you force. Staying still for long stretches is usually the thing that costs you effort.`, weight: 5, source: { work: "BPHS", ref: "Ch.4 sign taxonomy" }, tags: ["travel", "stay"] });
    }
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
  if (tenthLinks || (twelfthLord && ownedHouses(twelfthLordId, lagna).includes(10)))
    purpose.push("work — a posting, a transfer, or a job that only exists somewhere else");
  const ninthLinks = ninthOccupants.length > 0;
  if (ninthLinks) purpose.push("study or teaching — going to learn something, or to pass it on");
  if (rahu && rahu.house === 7) purpose.push("a marriage or a business partnership that takes you abroad");
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

  return {
    key: "foreign",
    title: "Foreign Travel & Settlement",
    headline:
      top.score >= 55
        ? `Your chart leans clearly toward ${top.label.toLowerCase()}.`
        : "Foreign themes are present in your chart but moderate — travel, yes, and the place you come from keeps its pull on you.",
    score: top.score,
    verdict: top.verdict as ForeignReport["verdict"],
    confidence,
    blocks: [
      {
        heading: "Three different lives abroad, scored separately",
        paragraphs: [
          "Travelling often, living abroad for years, and settling permanently are three different things, and a chart can be strong for one and quiet on the others. They are scored independently here for that reason.",
          "These are tendencies rather than certainties. A strong score means the chart supports that shape of life and it tends to come easily; a low one means it costs more effort, not that it is closed to you.",
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
