import { PLANET_COLOURS, PLANET_DIRECTION, PLANET_NAMES, SIGNS, VARA_LORDS, VARA_NAMES } from "@/utils/astrology/constants";
import type { ShadbalaSet } from "@/utils/astrology/shadbala";
import type { PlanetStrength } from "@/utils/astrology/strength";
import { periodsOverlapping } from "@/utils/astrology/scan";
import type { ChartData, DashaPeriod, PlanetId, YogaFinding } from "@/utils/astrology/types";
import { ownedHouses } from "@/utils/astrology/yogas";
import { badhakaFor, FUNCTIONAL_ROLES, marakasFor } from "./lordships";
import type { Evidence, SectionReport, TimingWindow } from "./report";
import { ordinal } from "./synthesis";

/**
 * "Things to avoid" — the cautions section.
 *
 * Sources: functional benefic/malefic scheme per Parashara (BPHS,
 * lagna-lordship chapters, as tabulated in the standard literature);
 * marakas from BPHS (Ayurdaya/Maraka adhyaya: 2nd and 7th lords);
 * badhaka per the standard movable/fixed/dual scheme (Prasna Marga
 * tradition); dusthana readings per Phaladeepika's house-lord placements.
 *
 * House rule enforced by the type below: a caution CANNOT be emitted
 * without a constructive counter-measure, and the wording avoids
 * fatalism — risk is stated as a tendency with a practical counter.
 */

export interface Caution {
  caution: Evidence;
  counterMeasure: string;
}

export interface CautionsReport extends SectionReport {
  cautions: Caution[];
  adverseWindows: TimingWindow[];
}

const DUSTHANA = [6, 8, 12];

export function buildCautionsReport(
  chart: ChartData,
  strengths: Partial<Record<PlanetId, PlanetStrength>>,
  shadbala: ShadbalaSet | null,
  yogas: YogaFinding[],
  dashaTree: DashaPeriod[] | null,
  now: Date
): CautionsReport {
  const lagna = chart.ascendant.sign;
  const roles = FUNCTIONAL_ROLES[lagna];
  const cautions: Caution[] = [];
  const caveats: string[] = [];

  const planetOf = (id: PlanetId) => chart.planets.find((p) => p.id === id);

  // --- 1. Functional malefics: instincts that work against this lagna ---
  for (const id of roles.malefics) {
    const p = planetOf(id);
    if (!p) continue;
    const s = strengths[id];
    const strong = s ? s.score >= 60 : false;
    cautions.push({
      caution: {
        text: `${PLANET_NAMES[id]} works against a ${SIGNS[lagna]} rising chart (it rules houses that pull against your interests). ${strong ? `Yours is strong — a talent that can overcommit you to the wrong battles, especially in ${PLANET_NAMES[id]}'s areas.` : `In your chart it sits in the ${ordinal(p.house)} house — watch decisions made in its arenas.`}`,
        weight: strong ? -6 : -3,
        source: { work: "BPHS", ref: "functional lordship scheme for the lagna" },
      },
      counterMeasure: `Before big commitments in ${PLANET_NAMES[id]}'s domains, take one extra day and one outside opinion. On its weekday (${VARA_NAMES[VARA_LORDS.indexOf(id) === -1 ? 6 : VARA_LORDS.indexOf(id)]}), favour routine over launches.`,
    });
  }

  // --- 2. Badhaka: the obstructor lord ---
  {
    const b = badhakaFor(lagna);
    const p = planetOf(b.lord);
    if (p) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[b.lord]} is your badhaka (the obstructor — for your rising sign it is the ${ordinal(b.house)} lord). Delays and inexplicable snags cluster around its themes and its time periods, currently expressed from your ${ordinal(p.house)} house.`,
          weight: -4,
          source: { work: "Prasna Marga tradition", ref: "badhaka scheme: movable→11th, fixed→9th, dual→7th lord" },
        },
        counterMeasure:
          "Build slack into plans touching the badhaka's houses — pad timelines, avoid single points of failure, and treat repeated obstruction as a signal to change route rather than push harder.",
      });
    }
  }

  // --- 3. Marakas: framed as health-attention periods, never as fear ---
  {
    const ms = marakasFor(lagna);
    cautions.push({
      caution: {
        text: `${ms.map((m) => PLANET_NAMES[m]).join(" and ")} are the maraka lords for your lagna (rulers of the 2nd and 7th). Classically their major periods are when health and vitality deserve extra attention — nothing more dramatic than that.`,
        weight: -3,
        source: { work: "BPHS", ref: "maraka: lords of the 2nd and 7th" },
      },
      counterMeasure:
        "During these planets' dasha periods keep health checkups current, insurance in force, and lifestyle basics (sleep, diet, movement) non-negotiable. Prevention is the whole remedy here.",
    });
  }

  // --- 4. Dusthana lords carried into key houses ---
  for (const p of chart.planets) {
    if (p.id === "Ra" || p.id === "Ke") continue;
    const owned = ownedHouses(p.id, lagna);
    const dusthanaOwned = owned.filter((h) => DUSTHANA.includes(h));
    if (!dusthanaOwned.length) continue;
    if ([1, 4, 7, 10, 5, 9].includes(p.house) && !owned.some((h) => [1, 4, 7, 10, 5, 9].includes(h))) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]}, lord of the ${dusthanaOwned.map(ordinal).join("/")} (a difficult house), sits in your ${ordinal(p.house)} — carrying that friction into a key area. Its themes (debt, conflict, loss) can leak into ${ordinal(p.house)}-house matters.`,
          weight: -4,
          source: { work: "Phaladeepika", ref: "house-lord placement chapters (dusthana lords in kendra/trikona)" },
        },
        counterMeasure: `Keep ${ordinal(p.house)}-house matters contractually clean: written agreements, no informal loans, and clear boundaries with the people involved.`,
      });
    }
  }

  // --- 5. Afflicted planets: debilitated / combust / war-losing ---
  for (const p of chart.planets) {
    if (p.dignity === "debilitated") {
      const cancelled = yogas.some((y) => y.key === `nbrj-${p.id}`);
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} is debilitated in ${SIGNS[p.sign]}${cancelled ? ", though its Neechabhanga cancellation converts this into late-blooming strength" : ""}. Early life tends to underdeliver in its areas; do not sign up for roles that lean entirely on it${cancelled ? " until its cancellation has visibly matured" : ""}.`,
          weight: cancelled ? -2 : -5,
          source: { work: "BPHS", ref: "exaltation/debilitation scheme" },
        },
        counterMeasure: cancelled
          ? "Give this planet's arena time — the classical reading is struggle first, unusual strength after. Invest in it steadily rather than betting on it early."
          : `Support ${PLANET_NAMES[p.id]}'s significations with skills and systems rather than willpower: structured routines, mentors, and modest expectations in its dasha periods.`,
      });
    }
    if (p.combust && p.id !== "Su") {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} is combust (too close to the Sun). Its qualities get overshadowed by ego or authority — yours or someone else's — and judgement in its areas blurs when pride is involved.`,
          weight: -3,
          source: { work: "BPHS", ref: "asta (combustion) orbs" },
        },
        counterMeasure: `Separate the decision from the ego: in ${PLANET_NAMES[p.id]} matters, write the reasoning down before acting and let a neutral party check it.`,
      });
    }
    if (p.warWith && p.warWinner === false) {
      cautions.push({
        caution: {
          text: `${PLANET_NAMES[p.id]} lost a planetary war to ${PLANET_NAMES[p.warWith]} (they sit within a degree of each other). Its agenda tends to be crowded out by ${PLANET_NAMES[p.warWith]}'s in daily life.`,
          weight: -2,
          source: { work: "Graha Yuddha convention", ref: "lower-longitude winner" },
        },
        counterMeasure: `Schedule ${PLANET_NAMES[p.id]}'s activities separately from ${PLANET_NAMES[p.warWith]}'s — give the weaker agenda protected time or it will never get any.`,
      });
    }
  }

  // --- 6. Weak by Shadbala ---
  if (shadbala) {
    for (const pid of Object.keys(shadbala.planets) as (keyof typeof shadbala.planets)[]) {
      const sb = shadbala.planets[pid];
      if (sb.ratio < 0.85) {
        cautions.push({
          caution: {
            text: `${PLANET_NAMES[pid]} falls short of its classical strength requirement (${Math.round(sb.ratio * 100)}% of the needed Shadbala). It can promise more than it delivers — treat commitments that rest on it as needing backup.`,
            weight: -3,
            source: { work: "BPHS", ref: "Shadbala minimum-requirement table" },
          },
          counterMeasure: `Double-check plans that depend on ${PLANET_NAMES[pid]}'s themes, and avoid its colours/directions for important first impressions (skip ${PLANET_COLOURS[pid].primary}${PLANET_DIRECTION[pid] ? `, and the ${PLANET_DIRECTION[pid]} direction for critical meetings` : ""}).`,
        });
      }
    }
  } else {
    caveats.push(
      "Shadbala (the classical strength measure) needs an exact birth time and place — weak-planet cautions here use the quick composite score instead."
    );
  }

  // --- 7. Adverse yogas already detected ---
  const ADVERSE = ["kemadruma", "shakata", "daridra", "kala-sarpa"];
  for (const y of yogas.filter((y) => ADVERSE.includes(y.key))) {
    const cancelled = y.name.includes("cancelled");
    cautions.push({
      caution: {
        text: `${y.name}: ${y.description.split(". ")[0]}.`,
        weight: cancelled ? -1 : -4,
        source: { work: "classical yoga literature", ref: y.name.replace(" (cancelled)", "") },
      },
      counterMeasure: cancelled
        ? "Already cancelled in your chart — no action needed beyond awareness."
        : y.key === "kemadruma"
          ? "Build deliberate human anchors: standing commitments with friends or a community that do not depend on your mood."
          : y.key === "shakata"
            ? "Bank the good phases: keep reserves and avoid overextending at peaks, because the cycle turns."
            : y.key === "daridra"
              ? "Automate savings before spending is possible, and route income through more than one stream."
              : "Work with the chapter structure rather than against it: push hard when doors open, consolidate in the plateaus.",
    });
  }

  // --- 8. Adverse dasha windows: both lords functional malefics ---
  const adverseWindows: TimingWindow[] = [];
  if (dashaTree && chart.birthUtc) {
    const horizon = new Date(now.getTime() + 15 * 365.25 * 86400000);
    for (const md of periodsOverlapping(dashaTree, 1, now, horizon)) {
      for (const ad of md.children ?? []) {
        if (ad.end <= now || ad.start >= horizon) continue;
        const mahaBad = roles.malefics.includes(md.lord);
        const antarBad = roles.malefics.includes(ad.lord);
        if (mahaBad && antarBad) {
          adverseWindows.push({
            label: `${PLANET_NAMES[md.lord]}–${PLANET_NAMES[ad.lord]} period`,
            start: ad.start > now ? ad.start : now,
            end: ad.end < horizon ? ad.end : horizon,
            grade: "weak",
            confidence: 55,
            reasons: [
              `both period lords (${PLANET_NAMES[md.lord]}, ${PLANET_NAMES[ad.lord]}) are functional malefics for your rising sign — favour consolidation over expansion here`,
            ],
          });
        }
      }
    }
    adverseWindows.splice(6); // keep the list actionable
  } else {
    caveats.push("Without a birth time, dasha-based caution windows cannot be computed.");
  }

  // Rank the cautions: heaviest first, and cap to keep the section readable.
  cautions.sort((a, b) => a.caution.weight - b.caution.weight);
  const top = cautions.slice(0, 10);

  const netWeight = top.reduce((s, c) => s + c.caution.weight, 0);
  const confidence = Math.max(
    30,
    Math.min(85, 60 + (shadbala ? 10 : -5) + (chart.birthUtc ? 5 : -10))
  );

  return {
    key: "cautions",
    title: "Things to Watch and Avoid",
    headline:
      top.length === 0
        ? "No major structural cautions — ordinary prudence is enough for this chart."
        : `${top.length} areas deserve conscious handling — each one comes with a practical counter-measure, and none of them is a verdict.`,
    score: Math.max(5, Math.min(95, 60 + netWeight)),
    verdict: undefined,
    confidence,
    blocks: [
      {
        heading: "How to read this section",
        paragraphs: [
          "These are tendencies, not sentences. Classical astrology lists them so you can steer around them — every caution below is paired with what actually helps. Nothing here is medical, legal or financial advice.",
        ],
      },
    ],
    caveats,
    hasDasha: Boolean(dashaTree && chart.birthUtc),
    cautions: top,
    adverseWindows,
  };
}
