import { conditionalDashaLabel } from "@/utils/astrology/dashaConfirm";
import { activeDashaAt, subPeriodsOf } from "@/utils/astrology/dasha";
import type { PlanetId } from "@/utils/astrology/types";
import { HOUSE_GOVERNS } from "../significations";
import { functionalRole } from "../synthesis";
import { dashaLordAssessment } from "../yearForecast";
import { strongerPeriodAhead } from "./personality";
import {
  DIGNITY_WORD, fmtRatio, joinAnd, lordQuality, name, ord, owned, planet, ratio, sentences, type ReadingContext, type ReadingPart,
  type ReadingSubsection,
} from "./context";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
const YEAR = 365.25 * 86400000;

function lordProfile(rc: ReadingContext, id: PlanetId): string {
  const p = planet(rc, id);
  const r = ratio(rc, id);
  const hs = owned(rc, id);
  const role = functionalRole(id, rc.chart.ascendant.sign);
  return `${name(id)} rules ${hs.length ? `your ${joinAnd(hs.map(ord))}` : "no house (a node)"}, sits in your ${p ? ord(p.house) : "—"} ${p ? DIGNITY_WORD[p.dignity] : ""}${r !== null ? ` at ${fmtRatio(r)}` : ""}, and is a functional ${role} for your Lagna`;
}

/** How well a dasha lord can deliver — see `lordQuality`. */
function quality(rc: ReadingContext, id: PlanetId): "strong" | "mixed" | "demanding" {
  return lordQuality(rc, id, functionalRole(id, rc.chart.ascendant.sign)).q;
}

export function timingPart(rc: ReadingContext): ReadingPart {
  const subsections: ReadingSubsection[] = [];
  const tree = rc.dashaTree;
  if (!tree || !rc.chart.birthUtc) {
    return { key: "timing", number: 7, title: "Timing outlook", subsections: [{ heading: "Timing needs a birth time and place", lead: [], bullets: [] }], summary: [] };
  }
  const now = rc.now;
  const a = activeDashaAt(tree, now);

  // 1. Now.
  if (a) {
    const sk = subPeriodsOf(a.pratyantar).find((s) => now >= s.start && now < s.end);
    const cond = rc.confirm ? conditionalDashaLabel(rc.confirm, now) : null;
    subsections.push({
      heading: `Now: ${name(a.maha.lord)} – ${name(a.antar.lord)} – ${name(a.pratyantar.lord)}`,
      lead: [
        `${name(a.maha.lord)} Mahadasha ${fmt(a.maha.start)} – ${fmt(a.maha.end)}; ${name(a.antar.lord)} Antardasha ${fmt(a.antar.start)} – ${fmt(a.antar.end)}; ${name(a.pratyantar.lord)} Pratyantardasha to ${fmt(a.pratyantar.end)}${sk ? `; ${name(sk.lord)} Sookshma to ${fmt(sk.end)}` : ""}.${cond ? ` Cross-check: ${cond}.` : ""}`,
      ],
      bullets: [
        `Main period — ${lordProfile(rc, a.maha.lord)}. ${sentences(dashaLordAssessment(rc.chart, a.maha.lord, `Mahadasha of ${name(a.maha.lord)}`), 2).slice(1).join(" ")}`,
        `Sub-period — ${lordProfile(rc, a.antar.lord)}. Its themes now run through ${joinAnd(owned(rc, a.antar.lord).map((h) => HOUSE_GOVERNS[h].short)) || "its placement"}.`,
      ],
    });
  }

  // 2. The Mahadashas ahead.
  {
    const ahead = tree.filter((md) => md.end > now).slice(0, 4);
    subsections.push({
      heading: "The main periods ahead",
      lead: [],
      bullets: ahead.map((md) => {
        const age = (d: Date) => Math.floor((d.getTime() - rc.chart.birthUtc!.getTime()) / YEAR);
        const q = quality(rc, md.lord);
        const lq = lordQuality(rc, md.lord, functionalRole(md.lord, rc.chart.ascendant.sign));
        return `${name(md.lord)} Mahadasha, ${fmt(md.start)} – ${fmt(md.end)} (age ${age(md.start)}–${age(md.end)}): ${lordProfile(rc, md.lord)} — ${q === "strong" ? "a strong period that delivers" : q === "demanding" ? "a demanding period that rewards patience" : "a mixed period: good in some areas, effortful in others"}, because ${name(md.lord)} is ${lq.why}.`;
      }),
    });
  }

  // 3. Strongest and most demanding sub-periods in the next 15 years.
  {
    const horizon = new Date(now.getTime() + 15 * YEAR);
    const ads = tree.flatMap((md) => (md.children ?? []).map((ad) => ({ md, ad }))).filter(({ ad }) => ad.end > now && ad.start < horizon);
    const label = ({ md, ad }: { md: { lord: PlanetId }; ad: { lord: PlanetId; start: Date; end: Date } }) =>
      `${name(md.lord)}–${name(ad.lord)}, ${fmt(ad.start)} – ${fmt(ad.end)}`;
    const strong = ads.filter(({ md, ad }) => quality(rc, md.lord) === "strong" && quality(rc, ad.lord) === "strong").slice(0, 4);
    const hard = ads.filter(({ md, ad }) => quality(rc, md.lord) === "demanding" && quality(rc, ad.lord) === "demanding").slice(0, 4);
    subsections.push({
      heading: "The strongest and the most demanding stretches (next 15 years)",
      lead: [],
      bullets: [
        strong.length ? `Strongest: ${strong.map(label).join("; ")} — both lords are working planets for your Lagna with the strength (Shadbala or varga dignity) to deliver.` : "No sub-period in the next 15 years has both lords strong and favourable; progress comes through steady effort rather than a single peak.",
        hard.length ? `Most demanding: ${hard.map(label).join("; ")} — both lords are adverse and below strength; consolidate rather than expand in these.` : "No sub-period in the next 15 years has both lords adverse and weak.",
      ],
    });
  }

  const lift = strongerPeriodAhead(rc);
  return { key: "timing", number: 7, title: "Timing outlook", subsections, summary: lift ? [lift] : [] };
}
