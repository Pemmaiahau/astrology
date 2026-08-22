import { aspectedSigns } from "@/utils/astrology/aspects";
import {
  PLANET_NAMES,
  SIGN_LORDS,
  SIGNS,
  signMobility,
  type PlanetId7,
} from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import { arudhaOfHouse, type JaiminiInfo } from "@/utils/astrology/jaimini";
import type { BhavaBala } from "@/utils/astrology/shadbala";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import {
  computeSudarshana,
  FRAME_LABELS,
  unanimouslyStrained,
  unanimouslySupported,
} from "@/utils/astrology/sudarshana";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { ChartData, PlanetId, YogaFinding } from "@/utils/astrology/types";
import { badhakaFor } from "./lordships";
import type { Evidence } from "./report";
import { plain } from "./report";

/**
 * Speculation, deeper natal tests.
 *
 * `speculation.ts` reads the five axes from the rashi chart, the composite
 * strengths, a few vargas and the gochara. Everything in this module is a
 * classical test the engine already *computes* but that section never
 * consulted — Bhava Bala, Vimshopaka, Jaimini argala, the badhaka lord, the
 * Sudarshana Chakra, natal vakri motion, vargottama, and the Drekkana. Each is
 * a genuinely different question from the ones the axes ask, which is why they
 * are additive rather than a re-weighting of what is already there.
 *
 * Sources: BPHS Bhava-bala adhyaya (Bhava Bala); BPHS Vimshopaka bala adhyaya;
 * Jaimini Upadesa Sutras (argala/virodha); Prasna Marga (the badhaka scheme,
 * as already used by `cautions.ts`); the Sudarshana Chakra as the standard
 * three-frame corroboration; BPHS on vakri motion as cheshta bala; BPHS
 * Shodasavarga adhyaya (vargottama, D-3).
 *
 * The application of each to *speculation* specifically — argala on the 11th
 * read as intervention on gains, the badhaka read as what blocks a payout — is
 * this app's synthesis over a classical technique, and every row says so where
 * it matters. Pure: no ephemeris, no `Date.now()`.
 */

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** The houses this module tests, and what each one is for. */
const HOUSE_ROLE: Record<number, string> = {
  5: "the wager itself",
  11: "the payout",
  2: "what you keep",
  8: "sudden and borrowed money",
};

export interface SpeculationDepth {
  positives: Evidence[];
  negatives: Evidence[];
  /** Prose for the "Deeper classical tests" block. */
  paragraphs: string[];
  /** Net adjustment to the overall score, bounded to ±10. */
  adjustment: number;
}

export function buildSpeculationDepth(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  bhavaBala: BhavaBala[] | null,
  yogas: YogaFinding[]
): SpeculationDepth {
  const lagna = chart.ascendant.sign;
  const positives: Evidence[] = [];
  const negatives: Evidence[] = [];
  const paragraphs: string[] = [];
  let adjustment = 0;

  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const lordOf = (house: number) => SIGN_LORDS[(lagna + house - 1) % 12];
  const signOfHouse = (house: number) => (lagna + house - 1) % 12;
  const add = (row: Evidence) => {
    adjustment += row.weight;
    (row.weight >= 0 ? positives : negatives).push(row);
  };

  const l5 = lordOf(5);
  const l11 = lordOf(11);
  const l2 = lordOf(2);
  const specLords = [...new Set([l5, l11, l2])];

  // ------------------------------------------------------------------
  // 1. Bhava Bala — the houses' own strength, not their lords'
  // ------------------------------------------------------------------
  // A house lord can be strong while the house it rules is weak, and the
  // reverse. The five axes only ever measured the lord, so this is the first
  // time the bhava itself is asked anything.
  if (bhavaBala) {
    const mean = bhavaBala.reduce((s, b) => s + b.rupas, 0) / bhavaBala.length;
    const lines: string[] = [];
    for (const house of [5, 11, 2, 8]) {
      const bb = bhavaBala[house - 1];
      if (!bb) continue;
      const delta = clamp((bb.rupas - mean) * 1.6, -4, 4);
      lines.push(
        `${ordinal(house)} (${HOUSE_ROLE[house]}): ${bb.rupas.toFixed(1)} rupas${
          bb.rupas >= mean ? " — above" : " — below"
        } your chart's own average of ${mean.toFixed(1)}`
      );
      if (Math.abs(delta) < 1) continue;
      add({
        text: `Your ${ordinal(house)} house — ${HOUSE_ROLE[house]} — carries ${bb.rupas.toFixed(1)} rupas of Bhava Bala against a chart average of ${mean.toFixed(1)}. ${
          delta > 0
            ? "The house itself is well built, not merely well ruled: the structure holds even in the periods when its lord is quiet."
            : "The house itself is thin, whatever its lord is doing. Results here depend more than usual on the period running, and drop away when a favourable one ends."
        }`,
        weight: Math.round(delta),
        source: { work: "BPHS", ref: "Bhava-bala adhyaya" },
      });
    }
    if (lines.length) {
      paragraphs.push(
        `**Bhava Bala** measures the houses themselves rather than their rulers, and the two genuinely come apart — a strong 11th lord parked in a feeble 11th is a common profile, and it reads as gains that are available but never structurally secure. Your four money-and-risk houses: ${lines.join("; ")}.`
      );
    }
  }

  // ------------------------------------------------------------------
  // 2. Vimshopaka — does the promise survive all sixteen divisions?
  // ------------------------------------------------------------------
  // The rashi chart is one of sixteen. A planet that looks strong in D-1 and
  // dissolves across the vargas gives a promise that never converts, which in
  // this section is exactly the failure mode worth naming.
  if (vargas) {
    const rows: string[] = [];
    for (const id of specLords) {
      const v = vargas.vimshopaka[id as PlanetId7];
      if (!v) continue; // the nodes take no Vimshopaka
      const outOf20 = v.shodasha;
      const owned = [5, 11, 2].filter((h) => lordOf(h) === id);
      rows.push(`${PLANET_NAMES[id]} ${outOf20.toFixed(1)}/20`);
      const delta = clamp((outOf20 - 10) * 0.55, -4, 4);
      if (Math.abs(delta) < 1) continue;
      add({
        text: `${PLANET_NAMES[id]}, ruler of your ${owned.map(ordinal).join(" and ")}, scores ${outOf20.toFixed(1)} of 20 on ${plain("Vimshopaka")} across all sixteen divisional charts. ${
          delta > 0
            ? "A promise that holds up under magnification is a promise that converts: this planet is not merely well placed in the birth chart, it stays well placed when the chart is subdivided sixteen ways."
            : "The birth chart flatters this planet more than the divisions do. That gap is the classical signature of a result that looks available and does not arrive — worth knowing before sizing a position on it."
        }`,
        weight: Math.round(delta),
        source: { work: "BPHS", ref: "Vimshopaka bala adhyaya" },
      });
    }
    if (rows.length) {
      paragraphs.push(
        `**Vimshopaka** re-scores each planet across all sixteen vargas rather than the one. Your speculation rulers: ${rows.join(", ")}. Ten of twenty is the midpoint; below it the rashi chart is the most flattering view of that planet you will get.`
      );
    }

    // Vargottama — the same sign in D-1 and D-9 — is the stability mark.
    const vargottamaSpec = specLords.filter((id) => vargas.vargottama.includes(id));
    if (vargottamaSpec.length) {
      add({
        text: `${vargottamaSpec.map((id) => PLANET_NAMES[id]).join(" and ")} ${vargottamaSpec.length === 1 ? "is" : "are"} ${plain("Vargottama")} — holding the same sign in your birth chart and your Navamsa. On the speculation axis that reads as consistency rather than brilliance: this part of your chart behaves the same way in a good year and a bad one, which is the quality that lets a method be tested at all.`,
        weight: 3,
        source: { work: "BPHS", ref: "Shodasavarga adhyaya" },
      });
    }

    // D-3 Drekkana: courage and initiative — the nerve to take the position.
    const d3 = vargas.charts.D3;
    const maD3 = vargaPositionOf(d3, "Ma");
    if (maD3) {
      const strong = ["exalted", "moolatrikona", "own", "greatFriend"].includes(maD3.dignity);
      const weak = ["debilitated", "greatEnemy", "enemy"].includes(maD3.dignity);
      if (strong || weak) {
        add({
          text: `In the ${plain("Drekkana")} — the D-3, which the tradition reads for courage and self-effort — Mars stands ${DIGNITY_LABELS[maD3.dignity].toLowerCase()} in ${SIGNS[maD3.sign]}. ${
            strong
              ? "Nerve is not this chart's problem. The risk that follows from that is the opposite one: a chart that can hold a losing position long past the point where holding it is still a decision."
              : "Nerve is the scarce resource here. Positions tend to be closed at the point of maximum discomfort rather than at the point the plan named, which costs more over a year than any single bad entry."
          }`,
          weight: strong ? 2 : -3,
          source: { work: "BPHS", ref: "Shodasavarga adhyaya (D-3)" },
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 3. Jaimini argala — who intervenes on the wager and on the payout
  // ------------------------------------------------------------------
  if (jaimini) {
    for (const house of [5, 11]) {
      const a = jaimini.argala[house - 1];
      if (!a) continue;
      const net = a.intervening.length - a.obstructing.length;
      if (a.intervening.length === 0 && a.obstructing.length === 0) continue;
      const delta = clamp(net * 1.8, -4, 4);
      add({
        text: `Jaimini ${plain("argala")} on your ${ordinal(house)} — ${HOUSE_ROLE[house]}: ${
          a.intervening.length
            ? `${a.intervening.map((p) => PLANET_NAMES[p]).join(", ")} intervene${a.intervening.length === 1 ? "s" : ""} on it`
            : "nothing intervenes on it"
        }, and ${
          a.obstructing.length
            ? `${a.obstructing.map((p) => PLANET_NAMES[p]).join(", ")} obstruct${a.obstructing.length === 1 ? "s" : ""} that intervention`
            : "nothing obstructs"
        }. ${
          net > 0
            ? "Argala is the classical description of a house getting help it did not ask for — an outside push on the matter. Unobstructed, that is the difference between a result that has to be worked for and one that arrives."
            : net < 0
              ? "The obstruction outweighs the intervention here, which classically reads as help that is offered and then withdrawn — support that shows up in the setup and not in the settlement."
              : "Intervention and obstruction cancel, so this house is left to its own lord and occupants."
        }`,
        weight: Math.round(delta),
        source: { work: "Jaimini Upadesa Sutras", ref: "argala / virodha" },
      });
    }

    // The 11th from the Arudha Lagna is the Jaimini seat of material gain; the
    // arudha of the 5th is how the wager is *perceived*, which is a different
    // and useful question for anyone whose speculation is public.
    const a5 = arudhaOfHouse(chart, 5);
    {
      const occupants = chart.planets.filter((p) => p.sign === a5).map((p) => p.id);
      paragraphs.push(
        `**The arudha of your 5th** — how your speculation is *seen* rather than how it performs — falls in ${SIGNS[a5]}${
          occupants.length
            ? `, with ${occupants.map((id) => PLANET_NAMES[id]).join(" and ")} standing there`
            : ", with no planet standing there"
        }. Jaimini treats the pada as the image a matter projects. Where the pada is strong and the house is not, the reputation for calling markets runs ahead of the account; where the reverse holds, the results are real and nobody hears about them.`
      );
    }
  }

  // ------------------------------------------------------------------
  // 4. Badhaka — the classical obstructor for this rising sign
  // ------------------------------------------------------------------
  const badhaka = badhakaFor(lagna);
  const badhakaPlanet = planetOf(badhaka.lord);
  if (badhakaPlanet) {
    const touchesSpec = [5, 11, 2].filter((h) => {
      const sign = signOfHouse(h);
      return badhakaPlanet.sign === sign || aspectedSigns(badhaka.lord, badhakaPlanet.sign).includes(sign);
    });
    if (touchesSpec.length) {
      add({
        text: `${PLANET_NAMES[badhaka.lord]} is your ${plain("badhaka")} — for a ${signMobility(lagna)} rising sign the obstructor is the ${ordinal(badhaka.house)} lord — and it ${badhakaPlanet.sign === signOfHouse(touchesSpec[0]) ? "sits in" : "aspects"} your ${touchesSpec.map(ordinal).join(" and ")}. The badhaka does not destroy a matter; it interposes. On this axis it reads as the recurring obstacle between a correct call and a settled payout — the counterparty, the platform, the paperwork, the timing that slips.`,
        weight: -4,
        source: { work: "Prasna Marga", ref: "badhaka scheme" },
      });
    } else {
      add({
        text: `Your ${plain("badhaka")}, ${PLANET_NAMES[badhaka.lord]}, stays clear of your 5th, 11th and 2nd. Whatever else obstructs results in this chart, the classical obstructor is not standing on the money axis.`,
        weight: 2,
        source: { work: "Prasna Marga", ref: "badhaka scheme" },
      });
    }
  }

  // ------------------------------------------------------------------
  // 5. Natal vakri motion of the speculation rulers
  // ------------------------------------------------------------------
  // The section already scores *transiting* retrogrades. Natal vakri is the
  // opposite claim — BPHS scores it as cheshta bala, i.e. strength — and it
  // was missing entirely.
  for (const id of specLords) {
    const p = planetOf(id);
    if (!p || !p.retrograde || id === "Ra" || id === "Ke") continue;
    const owned = [5, 11, 2].filter((h) => lordOf(h) === id);
    add({
      text: `${PLANET_NAMES[id]}, ruler of your ${owned.map(ordinal).join(" and ")}, is ${plain("vakri")} in the birth chart. Note that this is the opposite of the transiting retrograde the month table scores against you: BPHS counts natal retrogression as *cheshta bala* — motional strength — and reads it as a result that is delayed, revisited, and then delivered with more force than a direct planet would have managed. In practice this is the chart that does badly with a first attempt at a market and well with a second.`,
      weight: 3,
      source: { work: "BPHS", ref: "Shadbala adhyaya (cheshta bala)" },
    });
  }

  // ------------------------------------------------------------------
  // 6. Sudarshana Chakra — the same houses read from Lagna, Moon and Sun
  // ------------------------------------------------------------------
  const chakra = computeSudarshana(chart);
  const supported = unanimouslySupported(chakra).map((h) => h.house);
  const strained = unanimouslyStrained(chakra).map((h) => h.house);
  for (const house of [5, 11, 2]) {
    if (supported.includes(house)) {
      add({
        text: `Your ${ordinal(house)} — ${HOUSE_ROLE[house]} — is supported from all three of the Lagna, the Moon and the Sun at once. The Sudarshana Chakra exists precisely to separate a promise seen from one angle from one the whole chart agrees on, and this is the latter.`,
        weight: 4,
        source: { work: "Sudarshana Chakra", ref: "three-frame corroboration" },
      });
    } else if (strained.includes(house)) {
      add({
        text: `Your ${ordinal(house)} — ${HOUSE_ROLE[house]} — reads as strained from the Lagna, the Moon and the Sun alike. Unanimity across the three frames is the strongest negative the technique produces: this is not one difficult placement being over-read, it is the same difficulty visible from every angle.`,
        weight: -5,
        source: { work: "Sudarshana Chakra", ref: "three-frame corroboration" },
      });
    }
  }
  const specChakra = chakra.filter((h) => h.house === 5 || h.house === 11);
  if (specChakra.length === 2) {
    paragraphs.push(
      `**The Sudarshana Chakra** reads the same house three times, counted from the rising sign, the Moon and the Sun. Your 5th is supported in ${specChakra[0].supported} of the three frames and strained in ${specChakra[0].strained}; your 11th, ${specChakra[1].supported} and ${specChakra[1].strained}. Reading only ${FRAME_LABELS.lagna} is the commonest way to over-read a single placement, and where the frames disagree the honest answer is that the matter is genuinely mixed rather than that one frame is right.`
    );
  }

  // ------------------------------------------------------------------
  // 7. Yoga cross-checks the axes do not make
  // ------------------------------------------------------------------
  const nbrj = yogas.filter((y) => y.key.startsWith("nbrj-") && y.planets.some((p) => specLords.includes(p)));
  for (const y of nbrj) {
    add({
      text: `${y.name} forms on ${y.planets.map((p) => PLANET_NAMES[p]).join(" and ")}, which rules your speculation axis. A debilitation that is cancelled is not the same as a debilitation that never happened: the classical reading is a late reversal, strength that arrives after a period of visibly not having it. On this axis that is the profile of someone whose first serious loss is what makes the method.`,
      weight: 4,
      source: { work: "BPHS", ref: "Neechabhanga Raja Yoga" },
    });
  }

  const kalaSarpa = yogas.find((y) => y.key === "kala-sarpa");
  if (kalaSarpa) {
    add({
      text: `${kalaSarpa.name} is present — every graha hemmed inside the Rahu–Ketu axis. This is later tradition rather than a BPHS sutra, and it is included because of what it describes rather than what it predicts: a life that moves in long concentrated runs with little in between. Applied to risk capital, that is a chart whose results arrive in a few large episodes, so an average year is a misleading way to judge it and position sizing that assumes a smooth distribution will misjudge the tails.`,
      weight: -2,
      source: { work: "Later tradition", ref: "not in BPHS — labelled" },
    });
  }

  const parivartanaSpec = yogas.filter(
    (y) => y.key.startsWith("parivartana-") && y.planets.some((p) => specLords.includes(p))
  );
  for (const y of parivartanaSpec) {
    add({
      text: `${y.name} involves ${y.planets.map((p) => PLANET_NAMES[p]).join(" and ")}, one of which rules your speculation axis. An exchange of signs fuses two houses so that neither can be read alone — whatever happens to one shows up in the other. On this axis it means the money houses are not independent of whatever else the exchange touches, and a reversal in that other area will be felt here whether or not the market moved.`,
      weight: 2,
      source: { work: "Standard yoga literature", ref: "Parivartana grading" },
    });
  }

  return {
    positives: positives.sort((a, b) => b.weight - a.weight),
    negatives: negatives.sort((a, b) => a.weight - b.weight),
    paragraphs,
    adjustment: clamp(Math.round(adjustment), -10, 10),
  };
}
