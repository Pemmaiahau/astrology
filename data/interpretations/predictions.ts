import { HOUSE_SIGNIFICATIONS, PLANET_NAMES, SIGNS } from "@/utils/astrology/constants";
import type { ActiveDasha } from "@/utils/astrology/dasha";
import { DIGNITY_LABELS } from "@/utils/astrology/states";
import type { ChartData, PlanetId, TransitInfo } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import { ordinal } from "./synthesis";
import { DASHA_THEMES, TRANSIT_TABLES } from "./transitTexts";

export interface PredictionSection {
  heading: string;
  paragraphs: string[];
}

export function dashaLordAssessment(chart: ChartData, lord: PlanetId, role: string): string {
  const p = chart.planets.find((q) => q.id === lord);
  if (!p) return "";
  const owned = ownedHouses(lord, chart.ascendant.sign);
  const ownedStr =
    owned.length > 0
      ? `As lord of the ${owned.map(ordinal).join(" and ")}, its period activates ${owned
          .map((h) => HOUSE_SIGNIFICATIONS[h - 1].split(",")[0])
          .join(" and ")}.`
      : `As a nodal graha it delivers the agenda of its dispositor and conjunctions.`;
  const condition = `${PLANET_NAMES[lord]} sits natally in your ${ordinal(p.house)} house in ${SIGNS[p.sign]} — ${DIGNITY_LABELS[p.dignity]}${p.retrograde ? ", retrograde" : ""}${p.combust ? ", combust" : ""}.`;
  const quality =
    p.dignity === "exalted" || p.dignity === "moolatrikona" || p.dignity === "own" || p.dignity === "greatFriend"
      ? "Expect this period to deliver its promises with interest — its natal strength converts effort into durable results."
      : p.dignity === "debilitated" || p.dignity === "greatEnemy" || p.dignity === "enemy"
        ? "Because the period lord is natally strained, its results arrive discounted and delayed; double the diligence on its portfolios and treat windfalls with suspicion."
        : "The period lord's neutral condition means results will track your conduct closely — this is an earned-outcome stretch, not a fated one.";
  return `${role}: ${DASHA_THEMES[lord]} ${condition} ${ownedStr} ${quality}`;
}

export function buildYearlyPrediction(
  chart: ChartData,
  active: ActiveDasha | null,
  transits: TransitInfo[],
  sadeSati: "rising" | "peak" | "setting" | null,
  now: Date
): PredictionSection[] {
  const sections: PredictionSection[] = [];
  const year = now.getFullYear();

  if (active) {
    sections.push({
      heading: `Dasha Climate for ${year}`,
      paragraphs: [
        dashaLordAssessment(chart, active.maha.lord, `Mahadasha of ${PLANET_NAMES[active.maha.lord]} (until ${active.maha.end.toLocaleDateString()})`),
        dashaLordAssessment(chart, active.antar.lord, `Antardasha of ${PLANET_NAMES[active.antar.lord]} (until ${active.antar.end.toLocaleDateString()})`),
      ],
    });
  }

  const gocharaParas: string[] = [];
  for (const id of ["Sa", "Ju", "Ra", "Ke"] as PlanetId[]) {
    const t = transits.find((x) => x.id === id);
    const table = TRANSIT_TABLES[id];
    if (t && table) {
      gocharaParas.push(
        `${PLANET_NAMES[id]} currently transits ${SIGNS[t.sign]} — your ${ordinal(t.houseFromMoon)} from the Moon and ${ordinal(t.houseFromLagna)} from the Lagna${t.retrograde ? " (retrograde)" : ""}. ${table[t.houseFromMoon - 1]}`
      );
    }
  }
  if (sadeSati) {
    const phaseText = {
      rising: "You are in the first (rising) phase of Sade Sati — the seven-and-a-half-year Saturn audit has opened its file. Expenses and inner restlessness lead; front-load savings and simplify.",
      peak: "You are in the peak phase of Sade Sati, Saturn crossing your natal Moon. This is the deepest stretch of the audit: guard health and morale, defer irreversible decisions where possible, and let Saturn strip only the inessential.",
      setting: "You are in the final (setting) phase of Sade Sati. The audit is closing its ledger — burdens visibly lighten through this phase, and what remains standing is certified load-bearing.",
    }[sadeSati];
    gocharaParas.unshift(phaseText);
  }
  sections.push({ heading: "Gochara — Slow-Moving Transits Over the Year", paragraphs: gocharaParas });

  if (active) {
    const md = chart.planets.find((p) => p.id === active.maha.lord);
    const ad = chart.planets.find((p) => p.id === active.antar.lord);
    const focus: string[] = [];
    if (md) focus.push(ordinal(md.house));
    if (ad && ad.house !== md?.house) focus.push(ordinal(ad.house));
    sections.push({
      heading: "Where the Year Concentrates",
      paragraphs: [
        `The running dasha lords occupy your ${focus.join(" and ")} house${focus.length > 1 ? "s" : ""}, so events cluster around ${[md, ad]
          .filter((p, i, a) => p && a.findIndex((q) => q?.house === p.house) === i)
          .map((p) => HOUSE_SIGNIFICATIONS[(p as NonNullable<typeof p>).house - 1].split(",")[0])
          .join(", then ")}. Time major initiatives to the stronger lord's sub-periods, and use the weaker stretches for consolidation rather than launch.`,
      ],
    });
  }
  return sections;
}

export function buildMonthlyPrediction(
  chart: ChartData,
  active: ActiveDasha | null,
  transits: TransitInfo[],
  now: Date
): PredictionSection[] {
  const sections: PredictionSection[] = [];
  const monthName = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  if (active) {
    sections.push({
      heading: `Operative Sub-Periods — ${monthName}`,
      paragraphs: [
        dashaLordAssessment(chart, active.pratyantar.lord, `Pratyantardasha of ${PLANET_NAMES[active.pratyantar.lord]} (${active.pratyantar.start.toLocaleDateString()} – ${active.pratyantar.end.toLocaleDateString()})`),
        `Within the ${PLANET_NAMES[active.maha.lord]}–${PLANET_NAMES[active.antar.lord]} framework, this pratyantar sets the month's day-to-day texture: schedule its favourable portfolios early in the period and hold its risk areas to routine maintenance.`,
      ],
    });
  }

  const su = transits.find((t) => t.id === "Su");
  const ma = transits.find((t) => t.id === "Ma");
  const fastParas: string[] = [];
  if (su) {
    fastParas.push(
      `The Sun spends this month energising your ${ordinal(su.houseFromLagna)} house — visibility, decisions and authority-dealings concentrate on ${HOUSE_SIGNIFICATIONS[su.houseFromLagna - 1].split(",")[0]}. Government or boss-level interactions this month route through that agenda.`
    );
  }
  if (ma) {
    fastParas.push(
      `Mars drives through your ${ordinal(ma.houseFromLagna)} house${ma.retrograde ? " (retrograde — re-litigating old campaigns)" : ""}: expect heat, urgency and initiative pressure in ${HOUSE_SIGNIFICATIONS[ma.houseFromLagna - 1].split(",")[0]}. Channel it into scheduled effort before it self-schedules as friction.`
    );
  }
  sections.push({ heading: "Fast Transit Currents", paragraphs: fastParas });

  return sections;
}
