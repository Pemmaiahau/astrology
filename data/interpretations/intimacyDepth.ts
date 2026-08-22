import { aspectedSigns } from "@/utils/astrology/aspects";
import type { AshtakavargaResult } from "@/utils/astrology/ashtakavarga";
import { PLANET_NAMES, SIGN_LORDS, SIGNS, type PlanetId7 } from "@/utils/astrology/constants";
import { ordinal } from "@/utils/astrology/format";
import type { JaiminiInfo } from "@/utils/astrology/jaimini";
import { norm360 } from "@/utils/astrology/math";
import type { BhavaBala } from "@/utils/astrology/shadbala";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import {
  computeSudarshana,
  unanimouslyStrained,
  unanimouslySupported,
} from "@/utils/astrology/sudarshana";
import { vargaPositionOf, type VargaSet } from "@/utils/astrology/varga";
import type { ChartData, PlanetId, YogaFinding } from "@/utils/astrology/types";
import { badhakaFor } from "./lordships";
import type { Evidence } from "./report";
import { plain } from "./report";

/**
 * Intimacy, deeper classical tests.
 *
 * `intimacy.ts` reads the kama trikona, the 12th, the 8th and the 5th, Venus
 * and Mars, the drishti landing on them, several vargas and the nakshatra
 * layer. This module adds the classical tests the engine already computes but
 * that section never consulted: Ashtakavarga (which it used not at all),
 * Bhava Bala, Vimshopaka, the D-60, Jaimini argala, the badhaka lord, the
 * Sudarshana Chakra, natal vakri motion, the Moon's lunar support and paksha
 * bala, and the 2nd from the Upapada.
 *
 * Two of these close a gap between the code and this project's own source
 * notes, which already claimed "Vimshopaka for Venus" and "D-60 for karmic
 * depth" for this section while the file referenced neither.
 *
 * Sources: BPHS Sarvashtakavarga (the SAV thresholds are the common applied
 * convention, not a sutra); BPHS Bhava-bala and Vimshopaka bala adhyayas;
 * BPHS Shodasavarga adhyaya (D-60); Jaimini Upadesa Sutras (argala, Upapada);
 * Prasna Marga (badhaka); BPHS Chandra-yoga literature (Sunapha/Anapha/
 * Durudhara/Kemadruma); BPHS Shadbala adhyaya (paksha and cheshta bala).
 *
 * The same boundaries `intimacy.ts` states apply here without exception:
 * nothing infers orientation or gender identity, nothing references what
 * revealed the tab, the D-30 "moral character" usage is not implemented, and
 * nothing is phrased as a verdict on the native or on anyone else. Pure: no
 * ephemeris, no `Date.now()`.
 */

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** What each house tested here is being read for. */
const HOUSE_ROLE: Record<number, string> = {
  7: "partnered life and the sanctioned union",
  12: "the pleasures of the bed",
  8: "intensity and what stays private",
  5: "romance and magnetism",
};

export interface IntimacyDepth {
  strengths: Evidence[];
  frictions: Evidence[];
  /** Prose for the "Deeper classical tests" block. */
  paragraphs: string[];
  /** Net adjustment to the overall score, bounded to ±10. */
  adjustment: number;
}

export function buildIntimacyDepth(
  chart: ChartData,
  vargas: VargaSet | null,
  jaimini: JaiminiInfo | null,
  av: AshtakavargaResult | null,
  bhavaBala: BhavaBala[] | null,
  yogas: YogaFinding[]
): IntimacyDepth {
  const lagna = chart.ascendant.sign;
  const strengths: Evidence[] = [];
  const frictions: Evidence[] = [];
  const paragraphs: string[] = [];
  let adjustment = 0;

  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);
  const lordOf = (house: number) => SIGN_LORDS[(lagna + house - 1) % 12];
  const signOfHouse = (house: number) => (lagna + house - 1) % 12;
  const add = (row: Evidence) => {
    adjustment += row.weight;
    (row.weight >= 0 ? strengths : frictions).push(row);
  };

  const ve = planetOf("Ve");
  const ma = planetOf("Ma");
  const mo = planetOf("Mo");
  const su = planetOf("Su");
  const l7 = lordOf(7);
  const l12 = lordOf(12);

  // ------------------------------------------------------------------
  // 1. Ashtakavarga — absent from this section entirely until now
  // ------------------------------------------------------------------
  if (av) {
    const lines: string[] = [];
    for (const house of [7, 12, 8, 5]) {
      const sav = av.sav[signOfHouse(house)];
      if (sav === undefined) continue;
      lines.push(`${ordinal(house)} (${HOUSE_ROLE[house]}): ${sav}`);
      const delta = sav >= 30 ? 3 : sav <= 25 ? -3 : 0;
      if (delta === 0) continue;
      add({
        text: `Your ${ordinal(house)} house — ${HOUSE_ROLE[house]} — holds ${sav} ${plain("Sarvashtakavarga")} points. ${
          delta > 0
            ? "Above thirty is the applied convention for a house that transits actually reward: when a planet crosses this sign, something usually comes of it rather than passing over quietly."
            : "Twenty-five or below is the convention for a thin house. It does not mean the matter is denied — it means transits over this sign tend not to produce much, so the good stretches here come from periods rather than from passing planets."
        }`,
        weight: delta,
        source: { work: "BPHS", ref: "Sarvashtakavarga (thresholds are applied convention)" },
      });
    }
    if (lines.length) {
      paragraphs.push(
        `**Ashtakavarga** scores every sign for how much transit support it carries — a measure this section had not been consulting at all. Your four relevant houses: ${lines.join("; ")}. The working figure is 28, the average across the 337-point table; thirty and above is the applied threshold for a house that repays a transit, twenty-five and below for one that does not.`
      );
    }

    // Venus's own Bhinnashtakavarga in the sign it natally occupies — the
    // karaka's own points, which is a sharper question than the Sarva figure.
    if (ve) {
      const veBav = av.bav.Ve?.[ve.sign];
      if (veBav !== undefined) {
        add({
          text: `Venus carries ${veBav} of its own 8 Ashtakavarga bindus in ${SIGNS[ve.sign]}, the sign it natally occupies. ${
            veBav >= 5
              ? "The karaka of desire is standing on ground its own points support, which reads as a capacity that is available rather than one that has to be worked up to."
              : veBav <= 3
                ? "The karaka of desire is standing on ground its own points do not support. Practically that is a Venus which delivers when a period backs it and goes quiet when one does not, rather than one running at a steady level."
                : "That is the neutral band — neither reinforcing nor undercutting the rest of the Venus reading."
          }`,
          weight: clamp((veBav - 4) * 1.2, -3, 3),
          source: { work: "BPHS", ref: "Bhinnashtakavarga" },
        });
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Bhava Bala — the houses in themselves, not their rulers
  // ------------------------------------------------------------------
  if (bhavaBala) {
    const mean = bhavaBala.reduce((s, b) => s + b.rupas, 0) / bhavaBala.length;
    const lines: string[] = [];
    for (const house of [7, 12, 8, 5]) {
      const bb = bhavaBala[house - 1];
      if (!bb) continue;
      lines.push(`${ordinal(house)}: ${bb.rupas.toFixed(1)} rupas`);
      const delta = clamp((bb.rupas - mean) * 1.4, -3.5, 3.5);
      if (Math.abs(delta) < 1) continue;
      add({
        text: `Your ${ordinal(house)} — ${HOUSE_ROLE[house]} — carries ${bb.rupas.toFixed(1)} rupas of Bhava Bala against a chart average of ${mean.toFixed(1)}. ${
          delta > 0
            ? "The house is well built in itself, not merely well ruled. Matters belonging to it hold their shape even when the planet that rules them is having a quiet decade."
            : "The house is thin in itself, whatever its ruler is doing. That reads as an area more dependent than usual on circumstance and on the period running — good stretches that do not consolidate on their own."
        }`,
        weight: Math.round(delta),
        source: { work: "BPHS", ref: "Bhava-bala adhyaya" },
      });
    }
    if (lines.length) {
      paragraphs.push(
        `**Bhava Bala** asks about the houses themselves rather than the planets that rule them, and the two genuinely come apart: ${lines.join(", ")}, against a chart average of ${mean.toFixed(1)}. A strong 7th lord in a weak 7th is a common and specific shape — partnership that is available and never quite structurally settled.`
      );
    }
  }

  // ------------------------------------------------------------------
  // 3. Vimshopaka and the D-60 for Venus and the 7th lord
  // ------------------------------------------------------------------
  // Both were claimed in this project's source notes for this section and
  // neither was actually implemented here.
  if (vargas) {
    for (const id of [...new Set<PlanetId>(["Ve", l7])]) {
      const v = vargas.vimshopaka[id as PlanetId7];
      if (!v) continue;
      const outOf20 = v.shodasha;
      const role = id === "Ve" ? "the karaka of desire" : `the ruler of your 7th`;
      const delta = clamp((outOf20 - 10) * 0.5, -3.5, 3.5);
      if (Math.abs(delta) < 1) continue;
      add({
        text: `${PLANET_NAMES[id]}, ${role}, scores ${outOf20.toFixed(1)} of 20 on ${plain("Vimshopaka")} — its dignity re-measured across all sixteen divisional charts rather than the birth chart alone. ${
          delta > 0
            ? "A planet that holds up under subdivision is one whose promise survives contact with detail: what it offers at the level of the whole life is still there at the level of a particular relationship."
            : "The birth chart is the most flattering view of this planet. Where the divisions disagree with the rashi chart the classical reading favours the divisions, which here means an attraction that is easier to feel than to sustain."
        }`,
        weight: Math.round(delta),
        source: { work: "BPHS", ref: "Vimshopaka bala adhyaya" },
      });
    }

    // D-60: BPHS weights the Shashtiamsa most heavily of the sixteen, and
    // reads it for the karmic layer under a matter.
    const veD60 = vargaPositionOf(vargas.charts.D60, "Ve");
    if (veD60) {
      const good = ["exalted", "moolatrikona", "own", "greatFriend", "friend"].includes(veD60.dignity);
      add({
        text: `In the ${plain("Shashtiamsa")} Venus stands ${DIGNITY_LABELS[veD60.dignity].toLowerCase()} in ${SIGNS[veD60.sign]}. BPHS weights the D-60 above every other division, and reads it for what a matter is carrying underneath rather than how it presents. ${
          good
            ? "A dignified Venus at this depth is the difference between wanting closeness and being able to be at ease inside it — the part of intimacy that is settled before anyone else is involved."
            : "An undignified Venus at this depth points to something unresolved sitting under the attraction itself — the pattern that keeps reappearing across different people, which is the layer worth working on rather than the choice of partner."
        }`,
        weight: good ? 3 : -3,
        source: { work: "BPHS", ref: "Shodasavarga adhyaya (D-60)" },
      });
    }
  }

  // ------------------------------------------------------------------
  // 4. Jaimini argala on the 7th and 12th
  // ------------------------------------------------------------------
  if (jaimini) {
    for (const house of [7, 12]) {
      const a = jaimini.argala[house - 1];
      if (!a || (!a.intervening.length && !a.obstructing.length)) continue;
      const net = a.intervening.length - a.obstructing.length;
      add({
        text: `Jaimini ${plain("argala")} on your ${ordinal(house)} — ${HOUSE_ROLE[house]}: ${
          a.intervening.length
            ? `${a.intervening.map((p) => PLANET_NAMES[p]).join(", ")} intervene${a.intervening.length === 1 ? "s" : ""}`
            : "nothing intervenes"
        }, ${
          a.obstructing.length
            ? `with ${a.obstructing.map((p) => PLANET_NAMES[p]).join(", ")} obstructing`
            : "with nothing obstructing"
        }. ${
          net > 0
            ? "Unobstructed argala describes a matter that gets pushed along from outside itself — circumstance, family, opportunity, other people's decisions. In this area that usually shows up as things happening sooner and less deliberately than you would have arranged them."
            : net < 0
              ? "The obstruction outweighs the intervention, which reads as outside momentum that arrives and then stalls — the introduction that goes nowhere, the timing that almost worked."
              : "Intervention and obstruction cancel, leaving this house to its own lord and occupants."
        }`,
        weight: clamp(net * 1.6, -3.5, 3.5),
        source: { work: "Jaimini Upadesa Sutras", ref: "argala / virodha" },
      });
    }

    // The 2nd from the Upapada is the classical durability test for a union —
    // distinct from the Upapada itself, which the section already reads.
    const ul2 = (jaimini.upapada + 1) % 12;
    const ul2Lord = SIGN_LORDS[ul2];
    const ul2Occupants = chart.planets.filter((p) => p.sign === ul2);
    const ul2LordP = planetOf(ul2Lord);
    const malefics: PlanetId[] = ["Sa", "Ma", "Ra", "Ke", "Su"];
    const maleficThere = ul2Occupants.filter((p) => malefics.includes(p.id));
    const debilitatedLord = ul2LordP?.dignity === "debilitated";
    if (maleficThere.length || debilitatedLord) {
      add({
        text: `The 2nd from your ${plain("Upapada Lagna")} falls in ${SIGNS[ul2]}${
          maleficThere.length ? `, with ${maleficThere.map((p) => PLANET_NAMES[p.id]).join(" and ")} standing there` : ""
        }${debilitatedLord ? `, and its lord ${PLANET_NAMES[ul2Lord]} is debilitated` : ""}. Jaimini reads this house — not the Upapada itself — for how well a union *lasts*, and this is the difficult reading of it. Take it as a description of strain that needs attending to rather than as a forecast: the technique describes durability, and durability is the part of a partnership most responsive to what the two people actually do.`,
        weight: -4,
        source: { work: "Jaimini Upadesa Sutras", ref: "Upapada — the 2nd from the pada" },
      });
    } else {
      add({
        text: `The 2nd from your ${plain("Upapada Lagna")} falls in ${SIGNS[ul2]}, free of malefic occupation, with its lord ${PLANET_NAMES[ul2Lord]} undebilitated. Jaimini reads that house for the durability of a union rather than its beginning, and this is the clean reading of it: nothing in the technique argues against a partnership holding.`,
        weight: 3,
        source: { work: "Jaimini Upadesa Sutras", ref: "Upapada — the 2nd from the pada" },
      });
    }
  }

  // ------------------------------------------------------------------
  // 5. Badhaka on the 7th
  // ------------------------------------------------------------------
  const badhaka = badhakaFor(lagna);
  const bp = planetOf(badhaka.lord);
  if (bp) {
    const seventhSign = signOfHouse(7);
    const touches =
      bp.sign === seventhSign || aspectedSigns(badhaka.lord, bp.sign).includes(seventhSign);
    if (touches) {
      add({
        text: `${PLANET_NAMES[badhaka.lord]} is your ${plain("badhaka")} and it ${bp.sign === seventhSign ? "occupies" : "aspects"} your 7th. The badhaka interposes rather than denies: what it describes here is the recurring obstruction between wanting a partnership and having one settle — distance, timing, third parties, circumstances that are nobody's fault and keep arriving anyway.`,
        weight: -3,
        source: { work: "Prasna Marga", ref: "badhaka scheme" },
      });
    }
  }

  // ------------------------------------------------------------------
  // 6. Natal vakri motion of Venus and Mars
  // ------------------------------------------------------------------
  for (const p of [ve, ma]) {
    if (!p || !p.retrograde) continue;
    add({
      text: `${PLANET_NAMES[p.id]} is ${plain("vakri")} in your birth chart. BPHS scores retrogression as *cheshta bala* — motional strength — not as weakness, and the practical reading is a planet that works by returning rather than by proceeding. For ${p.id === "Ve" ? "Venus, that is a desire life that recognises what it wanted in retrospect: attractions understood after the fact, and people who matter more the second time round than the first" : "Mars, that is drive that arrives in a second approach rather than a first — initiative that stalls, is set down, and then completes with more force than a direct Mars would have brought"}.`,
      weight: 2,
      source: { work: "BPHS", ref: "Shadbala adhyaya (cheshta bala)" },
    });
  }

  // ------------------------------------------------------------------
  // 7. The Moon: lunar support and paksha bala
  // ------------------------------------------------------------------
  // The Moon is manas-karaka — emotional receptivity — and this section was
  // reading its dignity without ever asking whether it stands supported.
  const lunar = yogas.find((y) =>
    ["durudhara", "sunapha", "anapha", "kemadruma"].includes(y.key)
  );
  if (lunar) {
    const isKemadruma = lunar.key === "kemadruma";
    add({
      text: `${lunar.name} is present. The Moon carries emotional receptivity in this scheme, and the 2nd and 12th from it describe whether that receptivity stands supported or alone. ${
        isKemadruma
          ? "Kemadruma is the isolated reading: an inner life that does not readily hand itself to another person, and closeness that has to be chosen deliberately rather than falling into place. It is a temperament, and the standard cancellations are reported elsewhere in this app rather than assumed away here."
          : "This is the supported reading — the Moon flanked rather than exposed, which shows up as an emotional life that other people can reach without a great deal of effort on either side."
      }`,
      weight: isKemadruma ? -4 : 3,
      source: { work: "BPHS", ref: "Chandra-yoga adhyaya" },
    });
  }

  if (mo && su) {
    // Paksha bala: the Moon's strength from elongation. A waning Moon near the
    // Sun is the weakest state in the Shadbala scheme.
    const elong = norm360(mo.longitude - su.longitude);
    const waxing = elong < 180;
    const nearness = Math.min(elong, 360 - elong); // 0 at new Moon, 180 at full
    if (nearness < 60) {
      add({
        text: `Your Moon sits ${Math.round(nearness)}° from your Sun — ${waxing ? "just past new" : "close to new"}, which is the weakest band for ${plain("paksha bala")} in the Shadbala scheme. A Moon with little paksha bala reads as emotional bandwidth that runs out sooner than the appetite does: not less desire, but less capacity to stay present for the aftermath of it, which is a different thing and a more useful one to know.`,
        weight: -3,
        source: { work: "BPHS", ref: "Shadbala adhyaya (paksha bala)" },
      });
    } else if (nearness > 140) {
      add({
        text: `Your Moon sits ${Math.round(nearness)}° from your Sun — close to full, and near maximum ${plain("paksha bala")}. The classical reading is a mind with reserves: emotional availability that holds up under intensity rather than being spent by it, which in this area is the quality that lets closeness survive its own high points.`,
        weight: 3,
        source: { work: "BPHS", ref: "Shadbala adhyaya (paksha bala)" },
      });
    }
  }

  // ------------------------------------------------------------------
  // 8. Sudarshana Chakra on the 7th and 12th
  // ------------------------------------------------------------------
  const chakra = computeSudarshana(chart);
  const supported = unanimouslySupported(chakra).map((h) => h.house);
  const strained = unanimouslyStrained(chakra).map((h) => h.house);
  for (const house of [7, 12]) {
    if (supported.includes(house)) {
      add({
        text: `Your ${ordinal(house)} — ${HOUSE_ROLE[house]} — is supported from the rising sign, the Moon and the Sun alike. The ${plain("Sudarshana Chakra")} exists to separate a promise visible from one angle from one the whole chart agrees on, and unanimity is the strongest positive it produces.`,
        weight: 4,
        source: { work: "Sudarshana Chakra", ref: "three-frame corroboration" },
      });
    } else if (strained.includes(house)) {
      add({
        text: `Your ${ordinal(house)} — ${HOUSE_ROLE[house]} — reads as strained from all three of the rising sign, the Moon and the Sun. That is not one difficult placement being over-read; it is the same difficulty visible from every angle, which usually means it is structural rather than situational and is worth naming rather than working around.`,
        weight: -5,
        source: { work: "Sudarshana Chakra", ref: "three-frame corroboration" },
      });
    }
  }

  const seventh = chakra.find((h) => h.house === 7);
  const twelfth = chakra.find((h) => h.house === 12);
  if (seventh && twelfth) {
    paragraphs.push(
      `**The Sudarshana Chakra** reads each house three times, counted from the rising sign, from the Moon and from the Sun. Your 7th is supported in ${seventh.supported} of the three frames and strained in ${seventh.strained}; your 12th, ${twelfth.supported} and ${twelfth.strained}. Reading only from the rising sign is the commonest way to over-read a single placement — and where the three frames disagree, the honest conclusion is that the matter is genuinely mixed, not that one frame is the true one.`
    );
  }

  // ------------------------------------------------------------------
  // 9. The 12th lord's own condition, counted from its own house
  // ------------------------------------------------------------------
  // Bhavat Bhavam on the house this section treats as primary. Absent before.
  const l12p = planetOf(l12);
  if (l12p) {
    const fromOwn = ((l12p.sign - signOfHouse(12) + 12) % 12) + 1;
    if ([6, 8, 12].includes(fromOwn)) {
      add({
        text: `${PLANET_NAMES[l12]} rules your 12th — ${plain("shayana sukha")}, the house this reading treats as primary — and stands in the ${ordinal(fromOwn)} counted from that house itself. A lord in a difficult house measured from its own is the classical mark of a matter that gets spent before it arrives: in this area, pleasure that is anticipated more fully than it is had.`,
        weight: -4,
        source: { work: "Phaladeepika", ref: "house lord in dusthana from its own house" },
      });
    } else if ([1, 4, 5, 7, 9, 10].includes(fromOwn)) {
      add({
        text: `${PLANET_NAMES[l12]} rules your 12th — ${plain("shayana sukha")} — and stands in the ${ordinal(fromOwn)} counted from that house, one of the supporting positions. Read from its own house rather than from the rising sign, this lord is in good order, which is the more specific of the two readings and the one the tradition prefers for judging a house's own affairs.`,
        weight: 3,
        source: { work: "BPHS", ref: "Bhavat Bhavam" },
      });
    }
  }

  return {
    strengths: strengths.sort((a, b) => b.weight - a.weight),
    frictions: frictions.sort((a, b) => a.weight - b.weight),
    paragraphs,
    adjustment: clamp(Math.round(adjustment), -10, 10),
  };
}
