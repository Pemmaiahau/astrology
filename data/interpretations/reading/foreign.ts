import { buildForeignReport, foreignTimingWindows } from "../foreign";
import { compactPoint } from "../brief";
import { houseSubsection, windowBullets } from "./common";
import { SIGN_LORDS } from "@/utils/astrology/constants";
import { HOUSE_GOVERNS } from "../significations";
import { DIGNITY_WORD, joinAnd, lordOf, name, nakOf, ord, planet, sentences, SIGNS, type ReadingContext, type ReadingPart, type ReadingSubsection } from "./context";

export function foreignPart(rc: ReadingContext, withTiming: boolean): ReadingPart {
  const { chart } = rc;
  const lagna = chart.ascendant.sign;
  const subsections: ReadingSubsection[] = [
    houseSubsection(rc, 12, `The 12th house (foreign lands): ${SIGNS[(lagna + 11) % 12]}`),
    houseSubsection(rc, 9, `The 9th house (long journeys): ${SIGNS[(lagna + 8) % 12]}`),
  ];
  const ra = planet(rc, "Ra");
  if (ra) {
    subsections.push({
      heading: `Rahu, the planet of the unfamiliar, in the ${ord(ra.house)} (${SIGNS[ra.sign]}, ${nakOf(ra.longitude).name})`,
      lead: [],
      bullets: [
        [3, 7, 9, 10, 12].includes(ra.house)
          ? `Rahu in the ${ord(ra.house)} is one of its classical foreign placements — it pulls the life outward, toward other cultures and places.`
          : `Rahu in the ${ord(ra.house)} channels the pull of the unfamiliar into ${HOUSE_GOVERNS[ra.house].phrase}, more than into relocation.`,
        `Its dispositor ${name(SIGN_LORDS[ra.sign])} decides how that pull is spent.`,
      ],
    });
  }

  const report = buildForeignReport(chart, rc.vargas, rc.strengths);
  const items = report.blocks.find((b) => b.items?.length)?.items ?? [];
  subsections.push({
    heading: "Three lives abroad, scored separately",
    lead: [report.headline],
    bullets: items.map((it) => {
      const why = [...it.reasons].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 2).map((r) => compactPoint(r.text).replace(/\.$/, ""));
      return `${it.label}: ${it.score}/100 (${it.verdict}). Why: ${joinAnd(why)}.`;
    }),
  });
  const purpose = report.blocks.find((b) => b.heading === "What tends to take you there");
  if (purpose) subsections.push({ heading: "What takes you there", lead: [], bullets: purpose.paragraphs.flatMap((p) => sentences(p, 2)).slice(0, 3) });
  if (withTiming) {
    const w = windowBullets(foreignTimingWindows(chart, rc.dashaTree, rc.ayanamsha, rc.av, rc.now));
    subsections.push({ heading: "When foreign doors open", lead: [], bullets: w.length ? w : ["No foreign-connected main period stands out in the remaining band; moves would come through opportunity and transit."] });
  }
  const l12 = planet(rc, lordOf(rc, 12));
  return {
    key: "foreign",
    number: 5,
    title: "Foreign travel and settlement",
    subsections,
    summary: [report.headline, l12 ? `The 12th lord is ${DIGNITY_WORD[l12.dignity]} in your ${ord(l12.house)}; with Rahu in the ${ra ? ord(ra.house) : "—"}, that sets how far the pull abroad goes.` : ""].filter(Boolean),
  };
}
